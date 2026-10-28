"""Oreheart Blender Worker (Windows).

Runs on the owner's PC. Talks ONLY outbound to GitHub (HTTPS) to pick up 3D production jobs,
does them with the local Blender (and the local Claude Code for animation design), and uploads
the results. Nothing listens on the network; Blender MCP (port 9876) is never exposed.

Uses only the Python standard library, so it runs on the Python that ships inside Blender.

Job queue: branch `blender-queue` of the factory repo, one folder per job:
    blender-jobs/<job-id>/job.json      spec + state (the single source of truth)
    blender-jobs/<job-id>/out/...       results uploaded by this worker
Claiming a job = rewriting job.json with the file's current SHA (compare-and-swap), so two
workers can never both claim it. A claimed job carries a lease that the worker renews with
heartbeats; if the PC or Blender crashes, the lease runs out and the job is picked up again.

Quiet queue (Oct 28): every push to GitHub makes Vercel queue builds, so the worker commits as little as possible.
No timed "idle" commits (the worker status file changes only when the state really changes), one commit per job
stage, lease renewals only when a stage runs long, and all result files go up in ONE commit together with the final
job state. Every commit message carries "[skip ci] [vercel skip]".

Commands:
    python worker.py --setup        store the GitHub token in Windows Credential Manager
    python worker.py                run (polls for jobs)
    python worker.py --once         do at most one job, then exit
    python worker.py --check        verify Blender, Claude Code, Blender MCP and GitHub access
"""
import argparse, base64, ctypes, datetime as dt, getpass, hashlib, json, os, re, shutil, socket, subprocess, sys, time, traceback, urllib.error, urllib.request, uuid
from ctypes import wintypes

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'blender_ops'))
import glbtool  # noqa: E402  (plain-Python GLB tools: meshopt decoding, clip splicing)
APP_DIR = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'OreheartBlenderWorker')
CONFIG_PATH = os.path.join(APP_DIR, 'config.json')
LOG_PATH = os.path.join(APP_DIR, 'worker.log')
CRED_TARGET = 'OreheartBlenderWorker:github'
JOBS_DIR = 'blender-jobs'
LEASE_SECONDS = 900          # a crashed job is picked up again after at most 15 minutes
HEARTBEAT_SECONDS = 90       # how often a running job re-reads job.json (cancel check; a read, never a commit)
LEASE_RENEW_SECONDS = 600    # renew the lease (one commit) only when the last job.json write is this old
SKIP_TAG = ' [skip ci] [vercel skip]'  # on every commit message: hosts that honour it (or an ignore-build command) skip the build
_LOCK = None
STATES = ['queued', 'claimed', 'running', 'validating', 'completed', 'failed', 'awaiting_review', 'cancelled']
# The ONLY operations this worker will ever perform. Anything else in a job is refused.
ALLOWED_JOB_TYPES = {'inspect', 'animate'}
ID_RE = re.compile(r'^[a-z0-9][a-z0-9-]{2,63}$')
NAME_RE = re.compile(r'^[A-Za-z0-9_]{1,48}$')
REF_RE = re.compile(r'^factory-design/(runway|runway-jobs)/[A-Za-z0-9._/-]+\.(jpg|jpeg|png)$')  # reference pictures only
REF_BRANCH_RE = re.compile(r'^[A-Za-z0-9._/-]{1,100}$')
MAX_REFERENCES = 120

DEFAULT_CONFIG = {
    'repo': 'Lummex/Starter',
    'queue_branch': 'blender-queue',
    'base_branch': 'main',
    'blender_exe': '',
    'claude_exe': '',
    'work_root': os.path.join(APP_DIR, 'work'),
    # Source models may only be read from these folders (never written).
    'allowed_source_roots': [os.path.join(os.path.expanduser('~'), 'Downloads'), os.path.join(os.path.expanduser('~'), 'Documents', 'Oreheart')],
    'poll_seconds': 60,
    'worker_id': '',
    'claude_max_turns': 40,
    'claude_timeout_seconds': 1500,
    'blender_timeout_seconds': 900,
    'revision_rounds': 1,
}


# ----------------------------------------------------------------------------- logging / config
def now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def log(*a):
    line = f"{now()} {' '.join(str(x) for x in a)}"
    print(line, flush=True)
    try:
        os.makedirs(APP_DIR, exist_ok=True)
        with open(LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except OSError:
        pass


def load_config():
    os.makedirs(APP_DIR, exist_ok=True)
    cfg = dict(DEFAULT_CONFIG)
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, encoding='utf-8') as f:
            cfg.update(json.load(f))
    if not cfg['worker_id']:
        cfg['worker_id'] = f"{socket.gethostname().lower()}-{uuid.uuid4().hex[:6]}"
    if not cfg['blender_exe'] or not os.path.lexists(cfg['blender_exe']) or os.path.exists(os.path.join(APP_DIR, 'blender-path.txt')):
        cfg['blender_exe'] = find_blender() or ''
    if not cfg['claude_exe']:
        cfg['claude_exe'] = shutil.which('claude') or shutil.which('claude.exe') or os.path.join(os.path.expanduser('~'), '.local', 'bin', 'claude.exe')
    save_config(cfg)
    return cfg


def save_config(cfg):
    os.makedirs(APP_DIR, exist_ok=True)
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=1)


def find_blender():
    alias = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'WindowsApps', 'blender.exe')  # Microsoft Store Blender
    pinned = os.path.join(APP_DIR, 'blender-path.txt')
    if os.path.exists(pinned):
        with open(pinned, encoding='utf-8-sig') as f:
            p = f.read().strip()
        if p:
            return p
    if os.path.exists(alias):
        return alias
    return find_blender_classic()


def find_blender_classic():
    roots = [os.environ.get('ProgramFiles', r'C:\Program Files'), os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)')]
    found = []
    for r in roots:
        base = os.path.join(r, 'Blender Foundation')
        if os.path.isdir(base):
            for d in os.listdir(base):
                exe = os.path.join(base, d, 'blender.exe')
                if os.path.exists(exe):
                    found.append(exe)
    steam = os.path.join(roots[1], 'Steam', 'steamapps', 'common', 'Blender', 'blender.exe')
    if os.path.exists(steam):
        found.append(steam)
    return sorted(found)[-1] if found else shutil.which('blender')


# ----------------------------------------------------------------------------- Windows Credential Manager
class CREDENTIAL(ctypes.Structure):
    _fields_ = [('Flags', wintypes.DWORD), ('Type', wintypes.DWORD), ('TargetName', wintypes.LPWSTR), ('Comment', wintypes.LPWSTR),
                ('LastWritten', wintypes.FILETIME), ('CredentialBlobSize', wintypes.DWORD), ('CredentialBlob', ctypes.POINTER(ctypes.c_char)),
                ('Persist', wintypes.DWORD), ('AttributeCount', wintypes.DWORD), ('Attributes', ctypes.c_void_p),
                ('TargetAlias', wintypes.LPWSTR), ('UserName', wintypes.LPWSTR)]


def cred_write(secret):
    blob = secret.encode('utf-16-le')
    c = CREDENTIAL()
    c.Type = 1  # CRED_TYPE_GENERIC
    c.TargetName = CRED_TARGET
    c.CredentialBlobSize = len(blob)
    c.CredentialBlob = ctypes.cast(ctypes.create_string_buffer(blob, len(blob)), ctypes.POINTER(ctypes.c_char))
    c.Persist = 2  # CRED_PERSIST_LOCAL_MACHINE
    c.UserName = 'github'
    if not ctypes.windll.advapi32.CredWriteW(ctypes.byref(c), 0):
        raise OSError('Could not save the key in Windows Credential Manager.')


def cred_read():
    if os.name != 'nt':
        return os.environ.get('OREHEART_WORKER_GITHUB_TOKEN')  # for tests off Windows only
    p = ctypes.POINTER(CREDENTIAL)()
    if not ctypes.windll.advapi32.CredReadW(CRED_TARGET, 1, 0, ctypes.byref(p)):
        return None
    try:
        c = p.contents
        return ctypes.string_at(c.CredentialBlob, c.CredentialBlobSize).decode('utf-16-le')
    finally:
        ctypes.windll.advapi32.CredFree(p)


# ----------------------------------------------------------------------------- GitHub (outbound HTTPS only)
class GitHub:
    def __init__(self, repo, token):
        self.repo, self.token = repo, token

    def call(self, method, path, body=None, raw=False, ok404=False):
        url = path if path.startswith('https://') else f'https://api.github.com/repos/{self.repo}' + (f'/{path}' if path else '')
        data = json.dumps(body).encode() if body is not None else None
        for attempt in range(5):
            req = urllib.request.Request(url, data=data, method=method, headers={
                'Authorization': f'Bearer {self.token}', 'Accept': 'application/vnd.github.raw' if raw else 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'oreheart-blender-worker', **({'Content-Type': 'application/json'} if data else {})})
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    b = r.read()
                    return b if raw else (json.loads(b) if b else None)
            except urllib.error.HTTPError as e:
                if e.code == 404 and ok404:
                    return None
                if e.code in (409, 422):
                    raise Conflict(e.read().decode(errors='replace'))
                if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                    time.sleep(5 * (attempt + 1)); continue
                raise RuntimeError(f'GitHub {method} {path} -> {e.code}: {e.read().decode(errors="replace")[:300]}')
            except urllib.error.URLError as e:
                if attempt < 4:
                    time.sleep(5 * (attempt + 1)); continue
                raise RuntimeError(f'Cannot reach GitHub: {e}')

    def get_file(self, path, ref):
        f = self.call('GET', f'contents/{path}?ref={ref}', ok404=True)
        if not f:
            return None, None
        if f.get('content') and f.get('encoding') == 'base64':
            return base64.b64decode(f['content']), f['sha']
        return self.call('GET', f'contents/{path}?ref={ref}', raw=True), f['sha']

    def put_file(self, path, content_bytes, message, branch, sha=None):
        body = {'message': message, 'content': base64.b64encode(content_bytes).decode(), 'branch': branch}
        if sha:
            body['sha'] = sha
        return self.call('PUT', f'contents/{path}', body)['content']['sha']

    def commit_files(self, files, message, branch, expect=None):
        """Write several files (path -> bytes) to a branch in ONE commit (git data API).
        expect = {path: sha or None}: compare-and-swap, raises Conflict if a file is no longer at that sha.
        If someone else pushes in between, the branch update is refused (not a fast-forward) and we retry on the new head.
        Returns {path: blob sha}."""
        blobs = {p: self.call('POST', 'git/blobs', {'content': base64.b64encode(b).decode(), 'encoding': 'base64'})['sha']
                 for p, b in files.items()}
        for attempt in range(6):
            head = self.call('GET', f'git/ref/heads/{branch}')['object']['sha']
            for p, want in (expect or {}).items():
                meta = self.call('GET', f'contents/{p}?ref={head}', ok404=True)
                have = meta.get('sha') if isinstance(meta, dict) else None
                if have != want:
                    raise Conflict(f'{p} changed on GitHub (now {have}, this worker had {want})')
            base_tree = self.call('GET', f'git/commits/{head}')['tree']['sha']
            tree = self.call('POST', 'git/trees', {'base_tree': base_tree, 'tree': [
                {'path': p, 'mode': '100644', 'type': 'blob', 'sha': s} for p, s in blobs.items()]})['sha']
            commit = self.call('POST', 'git/commits', {'message': message, 'tree': tree, 'parents': [head]})['sha']
            try:
                self.call('PATCH', f'git/refs/heads/{branch}', {'sha': commit, 'force': False})
                return blobs
            except Conflict:  # the branch moved (another writer): build the commit again on the new head
                time.sleep(2 + 3 * attempt)
        raise RuntimeError(f'could not commit to {branch} (the branch kept moving)')

    def list_dir(self, path, ref):
        r = self.call('GET', f'contents/{path}?ref={ref}', ok404=True)
        return r if isinstance(r, list) else []

    def ensure_branch(self, branch, base):
        if self.call('GET', f'git/ref/heads/{branch}', ok404=True):
            return
        # The queue branch is an orphan with only the job folder: no game code and no workflow files,
        # so job updates never start any GitHub Actions and the key needs no Workflows permission.
        readme = ('# Blender job queue\n\nOne folder per job: job.json (spec + state) and out/ (results).\n'
                  'Written by the dashboard (3D Production) and the Windows Blender worker. Do not merge into main.\n')
        tree = self.call('POST', 'git/trees', {'tree': [{'path': f'{JOBS_DIR}/README.md', 'mode': '100644', 'type': 'blob', 'content': readme}]})['sha']
        commit = self.call('POST', 'git/commits', {'message': 'Start the Blender job queue' + SKIP_TAG, 'tree': tree, 'parents': []})['sha']
        try:
            self.call('POST', 'git/refs', {'ref': f'refs/heads/{branch}', 'sha': commit})
            log('created queue branch', branch)
        except Conflict:
            pass


class Conflict(Exception):
    pass


class Cancelled(Exception):
    pass


# ----------------------------------------------------------------------------- job handling
class JobRef:
    """A job.json plus the SHA we last saw; every write is compare-and-swap on that SHA."""

    def __init__(self, gh, cfg, job_id):
        self.gh, self.cfg, self.id = gh, cfg, job_id
        self.path = f'{JOBS_DIR}/{job_id}/job.json'
        self.job, self.sha = None, None

    def load(self):
        b, sha = self.gh.get_file(self.path, self.cfg['queue_branch'])
        self.job, self.sha = (json.loads(b) if b else None), sha
        return self.job

    def save(self, msg, extra_files=None):
        """One commit: job.json (compare-and-swap on its sha) plus any extra files (results, worker status)."""
        self.job['updated_at'] = now()
        files = {self.path: (json.dumps(self.job, indent=1) + '\n').encode(), **(extra_files or {})}
        shas = self.gh.commit_files(files, f'blender job {self.id}: {msg}{SKIP_TAG}', self.cfg['queue_branch'], expect={self.path: self.sha})
        self.sha = shas[self.path]

    def update(self, msg, mutate, extra_files=None):
        """Apply mutate(job) and save; on a conflict re-read and retry (someone else edited it, e.g. a cancel)."""
        for _ in range(5):
            mutate(self.job)
            try:
                self.save(msg, extra_files); return
            except Conflict:
                self.load()
                if self.job.get('cancel_requested'):
                    raise Cancelled()
        raise RuntimeError('could not update job.json (too many conflicts)')


def lease_expired(job):
    lu = job.get('lease_until')
    return not lu or dt.datetime.fromisoformat(lu.replace('Z', '+00:00')) < dt.datetime.now(dt.timezone.utc)


def lease_until():
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=LEASE_SECONDS)).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def find_claimable(gh, cfg):
    jobs = []
    for e in gh.list_dir(JOBS_DIR, cfg['queue_branch']):
        if e.get('type') != 'dir' or not ID_RE.match(e['name']):
            continue
        ref = JobRef(gh, cfg, e['name'])
        try:
            j = ref.load()
        except Exception as ex:  # a broken job file must not stop the queue
            log('skip unreadable job', e['name'], ex); continue
        if not j or j.get('cancel_requested'):
            continue
        st = j.get('status')
        if st == 'queued' or (st in ('claimed', 'running', 'validating') and lease_expired(j)):
            if j.get('retries', 0) > j.get('max_retries', 2):
                continue
            jobs.append((-int(j.get('priority', 5)), j.get('created_at', ''), ref))
    jobs.sort(key=lambda x: (x[0], x[1]))
    return [r for _, _, r in jobs]


def claim(ref, cfg):
    was = ref.job.get('status')
    ref.job['retries'] = ref.job.get('retries', 0) + (1 if was != 'queued' else 0)
    ref.job.update(status='claimed', worker_id=cfg['worker_id'], lease_until=lease_until(), heartbeat_at=now(),
                   progress={'stage': 'claimed', 'percent': 0, 'message': 'Picked up by the Blender worker'})
    ref.job.setdefault('history', []).append({'at': now(), 'status': 'claimed', 'worker': cfg['worker_id'], 'recovered': was != 'queued'})
    try:
        # compare-and-swap: fails if another worker got there first. The worker status ("busy") rides in the same commit.
        ref.save('claimed', worker_status_files(cfg, 'busy', {'job': ref.id}))
        _STATUS['state'] = 'busy'
        return True
    except Conflict:
        return False


class Runner:
    """Runs one job. Every external program goes through self.run(), which heartbeats and honours cancel/stop."""
    _oh_refs = 1  # references are built in (fetch_references); the old glbtool.py reload hotfix must leave this class alone

    def __init__(self, gh, cfg, ref):
        self.gh, self.cfg, self.ref = gh, cfg, ref
        self.job = ref.job
        self.work = os.path.join(cfg['work_root'], ref.id)
        self.last_beat = 0                 # last time job.json was checked (cancel)
        self.last_write = time.time()      # last time job.json was written (the claim just now)
        self.pending = {}                  # result files: uploaded in ONE commit with the final job state

    # --- state
    def progress(self, stage, percent, message, status=None):
        def m(j):
            j['progress'] = {'stage': stage, 'percent': percent, 'message': message}
            j['lease_until'] = lease_until(); j['heartbeat_at'] = now()
            if status:
                j['status'] = status
                j.setdefault('history', []).append({'at': now(), 'status': status})
        self.ref.update(f'{stage} {percent}%', m)
        self.job = self.ref.job
        self.last_beat = self.last_write = time.time()
        log(self.ref.id, f'[{stage} {percent}%]', message)

    def beat(self):
        """Every 90 s: re-read job.json (no commit) to see a cancel. Renew the lease (one commit) only when the last
        write is 10 minutes old, so a normal stage makes no heartbeat commits; the lease (15 min) never runs out."""
        if time.time() - self.last_beat < HEARTBEAT_SECONDS:
            return
        self.ref.load()
        self.last_beat = time.time()
        if self.ref.job.get('cancel_requested'):
            raise Cancelled()
        if time.time() - self.last_write >= LEASE_RENEW_SECONDS:
            self.ref.update('heartbeat', lambda j: j.update(lease_until=lease_until(), heartbeat_at=now()))
            self.last_write = time.time()
        self.job = self.ref.job

    def check_control(self):
        if os.path.exists(os.path.join(APP_DIR, 'STOP')) or os.path.exists(os.path.join(APP_DIR, 'CANCEL')):
            raise Cancelled()

    # --- external programs (fixed executables + fixed arguments only; never a shell)
    def run(self, args, timeout, label):
        log(self.ref.id, 'run', label)
        out_path = os.path.join(self.work, 'logs', f'{label}.log')
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, 'w', encoding='utf-8', errors='replace') as out:
            p = subprocess.Popen(args, cwd=self.work, stdout=out, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            t0 = time.time()
            try:
                while p.poll() is None:
                    time.sleep(2)
                    self.check_control(); self.beat()
                    if time.time() - t0 > timeout:
                        p.kill(); raise RuntimeError(f'{label} took longer than {timeout} s and was stopped')
            except BaseException:
                if p.poll() is None:
                    p.kill()
                raise
        with open(out_path, encoding='utf-8', errors='replace') as f:
            text = f.read()
        if p.returncode != 0:
            raise RuntimeError(f'{label} failed (exit {p.returncode}). Last lines:\n' + '\n'.join(text.splitlines()[-25:]))
        return text

    def blender(self, script, *args, label):
        exe = self.cfg['blender_exe']
        if not exe or not os.path.lexists(exe):
            raise RuntimeError('Blender was not found. Set "blender_exe" in ' + CONFIG_PATH)
        ops = os.path.join(HERE, 'blender_ops', script)
        return self.run([exe, '--background', '--factory-startup', '--python-exit-code', '3', '--python', ops, '--', *args],
                        self.cfg['blender_timeout_seconds'], label)

    def claude(self, prompt_file, label):
        exe = self.cfg['claude_exe']
        if not exe or not os.path.lexists(exe):
            raise RuntimeError('Claude Code was not found. Set "claude_exe" in ' + CONFIG_PATH)
        with open(prompt_file, encoding='utf-8') as f:
            prompt = f.read()
        # Headless Claude Code, confined to the job's work folder: it may only read files and write/edit files there.
        # No shell, no web, no MCP: the animation it designs is a small script that the worker checks and then runs in Blender.
        return self.run([exe, '-p', prompt, '--output-format', 'text', '--max-turns', str(self.cfg['claude_max_turns']),
                         '--permission-mode', 'acceptEdits', '--allowedTools', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
                         '--disallowedTools', 'Bash', 'WebFetch', 'WebSearch'],
                        self.cfg['claude_timeout_seconds'], label)

    # --- files
    def resolve_source(self, ref_str, dest_name):
        """Copy a source model into the work folder. Sources are never modified."""
        dest = os.path.join(self.work, 'src', dest_name)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if ref_str.startswith('local:'):
            p = os.path.realpath(os.path.expanduser(ref_str[6:].replace('/', os.sep)))
            roots = [os.path.realpath(r) for r in self.cfg['allowed_source_roots']]
            if not any(os.path.commonpath([p, r]) == r for r in roots):
                raise RuntimeError(f'Source {p} is outside the approved folders')
            if not p.lower().endswith(('.glb', '.gltf')) or not os.path.isfile(p):
                raise RuntimeError(f'Source model not found: {p}')
            shutil.copyfile(p, dest)
        elif ref_str.startswith('repo:'):
            path, _, ref = ref_str[5:].partition('@')
            if '..' in path or not path.lower().endswith('.glb'):
                raise RuntimeError(f'Bad repo source {path}')
            b, _ = self.gh.get_file(path, ref or self.cfg['base_branch'])
            if b is None:
                raise RuntimeError(f'Source not found in GitHub: {path}')
            with open(dest, 'wb') as f:
                f.write(b)
        else:
            raise RuntimeError(f'Unknown source reference: {ref_str}')
        with open(dest, 'rb') as f:
            head = f.read(4)
        if head != b'glTF':
            raise RuntimeError(f'{dest_name} is not a GLB file')
        # Blender cannot read meshopt-compressed or quantized files, so it gets a plain working copy.
        plain = dest[:-4] + '.blender.glb'
        glbtool.decompress(dest, plain, dequantize=True)
        return dest, plain

    def fetch_references(self):
        """Reference pictures: a job may list "references" (pictures in the repo, for example frames of an owner-approved
        Runway video). They are downloaded into the job's work folder (refs/) before Claude Code designs the clip, so it can
        Read them and match the poses. Pictures only (.jpg/.jpeg/.png), only from factory-design/runway/ or runway-jobs/;
        they are saved as data and nothing is ever run. refs/<path minus its first two folders>."""
        refs = self.job.get('references') or []
        if not refs:
            return 0
        self.progress('references', 20, f'Downloading {min(len(refs), MAX_REFERENCES)} reference picture(s)')
        base = os.path.join(self.work, 'refs')
        os.makedirs(base, exist_ok=True)
        got, bad, missing = 0, [], []
        for r in refs[:MAX_REFERENCES]:
            p = (r.get('path', '') if isinstance(r, dict) else str(r)).strip()
            branch = (r.get('ref') if isinstance(r, dict) else None) or self.cfg['base_branch']
            if '..' in p or not REF_RE.match(p) or not REF_BRANCH_RE.match(str(branch)):
                bad.append(p); continue
            dest = os.path.join(base, *p.split('/')[2:])
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            if not os.path.exists(dest):
                b, _ = self.gh.get_file(p, branch)
                if not b:
                    missing.append(p); continue
                with open(dest, 'wb') as f:
                    f.write(b)
            got += 1
            self.check_control(); self.beat()
        log(self.ref.id, f'references: {got} downloaded into refs/, {len(bad)} refused, {len(missing)} not found')
        if bad or missing or not got:
            # Stop before Claude Code runs: without its pictures the job cannot match the video (and would waste usage).
            raise RuntimeError(f'Reference pictures missing: {len(missing)} not found {missing[:3]}, {len(bad)} not allowed {bad[:3]}')
        return got

    def upload_outputs(self, names):
        """Collect the result files. They are committed in ONE commit together with the final job state
        (done or failed) by do_one, instead of one commit per file."""
        base = f'{JOBS_DIR}/{self.ref.id}/out'
        uploaded = []
        for n in names:
            p = os.path.join(self.work, 'out', n)
            if not os.path.exists(p):
                continue
            with open(p, 'rb') as f:
                data = f.read()
            dest = f'{base}/{n.replace(os.sep, "/")}'
            self.pending[dest] = data
            uploaded.append({'file': dest, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        log(self.ref.id, f'{len(uploaded)} result file(s) ready; they go up in one commit with the final job state')
        return uploaded

    # --- the job
    def execute(self):
        if os.path.isdir(self.work):
            shutil.rmtree(self.work, ignore_errors=True)  # idempotent: a re-run starts clean
        os.makedirs(os.path.join(self.work, 'out'), exist_ok=True)
        j = self.job
        if j.get('type') not in ALLOWED_JOB_TYPES:
            raise RuntimeError(f'Job type {j.get("type")!r} is not allowed')
        if not ID_RE.match(str(j.get('asset_id', ''))):
            raise RuntimeError('Bad asset_id')
        self.progress('preparing', 5, 'Copying the source model into a private work folder', status='running')
        orig, src = self.resolve_source(j['source']['character'], 'character.glb')
        parts = {}
        for name, r in (j['source'].get('parts') or {}).items():
            if not ID_RE.match(name):
                raise RuntimeError(f'Bad part name {name}')
            parts[name] = self.resolve_source(r, f'part-{name}.glb')[1]

        self.progress('inspecting', 15, 'Reading the model, skeleton and animations in Blender')
        self.blender('inspect_asset.py', '--in', src, '--out', os.path.join(self.work, 'out', 'inspection.json'), label='inspect')
        with open(os.path.join(self.work, 'out', 'inspection.json'), encoding='utf-8') as f:
            insp = json.load(f)

        if j['type'] == 'inspect':
            self.blender('render_preview.py', '--in', src, '--out', os.path.join(self.work, 'out'), '--action', '', label='preview')
            files = self.upload_outputs(['inspection.json', 'preview-rest.png', 'preview-rest-side.png'])
            return {'summary': summarize_inspection(insp), 'files': files}

        # ---------------- animate
        anims = j.get('animations') or []
        if not anims:
            raise RuntimeError('No animations requested')
        for a in anims:
            if not NAME_RE.match(a.get('name', '')):
                raise RuntimeError(f'Bad animation name {a.get("name")!r} (letters, digits and _ only)')
        existing = [a['name'] for a in insp.get('actions', [])]
        clash = [a['name'] for a in anims if a['name'] in existing and not a.get('replace')]
        if clash:
            raise RuntimeError(f'Animation(s) {clash} already exist; set "replace": true to replace them')

        spec_path = os.path.join(self.work, 'job-spec.json')
        with open(spec_path, 'w', encoding='utf-8') as f:
            json.dump({'job': {k: j[k] for k in ('asset_id', 'request', 'animations', 'attachments') if k in j}, 'inspection': insp}, f, indent=1)
        shutil.copyfile(os.path.join(HERE, 'blender_ops', 'anim_api.md'), os.path.join(self.work, 'ANIMATION-API.md'))
        self.fetch_references()

        rounds = int(self.cfg.get('revision_rounds', 1))
        for rnd in range(rounds + 1):
            self.progress('designing', 25 + rnd * 20, 'Claude Code is designing the animation' + (' (revision)' if rnd else ''))
            prompt = build_prompt(j, rnd)
            pf = os.path.join(self.work, f'prompt-{rnd}.md')
            with open(pf, 'w', encoding='utf-8') as f:
                f.write(prompt)
            self.claude(pf, f'claude-{rnd}')
            for a in anims:
                sp = os.path.join(self.work, 'anims', f'{a["name"]}.py')
                if not os.path.exists(sp):
                    raise RuntimeError(f'Claude Code did not write anims/{a["name"]}.py')
                check_anim_script(sp)  # static allowlist check before Blender ever runs it
            self.progress('animating', 35 + rnd * 20, 'Building the keyframes in Blender and rendering previews')
            self.blender('build_animation.py', '--in', src, '--orig', orig, '--spec', spec_path, '--anims', os.path.join(self.work, 'anims'),
                         '--parts', json.dumps(parts), '--out', os.path.join(self.work, 'out'), label=f'build-{rnd}')
            if rnd < rounds:
                with open(os.path.join(self.work, 'out', 'build-report.json'), encoding='utf-8') as f:
                    br = json.load(f)
                if not br.get('problems'):
                    break

        self.progress('validating', 80, 'Re-loading the exported GLB and checking skeleton, clips and events', status='validating')
        out_dir = os.path.join(self.work, 'out')
        with open(os.path.join(out_dir, 'build-report.json'), encoding='utf-8') as f:
            br = json.load(f)
        out_glb = os.path.join(out_dir, 'char.glb')
        if not os.path.exists(out_glb):
            raise RuntimeError('No finished model was made: ' + '; '.join(br.get('problems', [])[:6]))
        verify_copy = os.path.join(self.work, 'verify.blender.glb')
        glbtool.decompress(out_glb, verify_copy, dequantize=True)
        self.blender('verify_export.py', '--in', verify_copy, '--source-report', os.path.join(out_dir, 'inspection.json'),
                     '--spec', spec_path, '--out', os.path.join(out_dir, 'validation.json'), '--renders', out_dir, label='verify')
        with open(os.path.join(out_dir, 'validation.json'), encoding='utf-8') as f:
            val = json.load(f)
        val['build_problems'] = br.get('problems', [])
        val['splice'] = br.get('splice')
        if br.get('problems'):
            val['ok'] = False
            val['problems'] = val.get('problems', []) + br['problems']
        with open(os.path.join(out_dir, 'validation.json'), 'w', encoding='utf-8') as f:
            json.dump(val, f, indent=1)
        log(self.ref.id, '[uploading 90%] Collecting the results (one commit with the final state)')
        names = ['char.glb', 'events.json', 'inspection.json', 'build-report.json', 'validation.json', 'preview-weapon.glb']
        names += sorted(n for n in os.listdir(out_dir) if n.endswith('.png'))
        for a in anims:  # keep the animation scripts with the results (they are how the clip was made)
            shutil.copyfile(os.path.join(self.work, 'anims', f'{a["name"]}.py'), os.path.join(out_dir, f'anim-{a["name"]}.py.txt'))
            names.append(f'anim-{a["name"]}.py.txt')
        files = self.upload_outputs(names)
        if not val.get('ok'):
            raise RuntimeError('Validation failed: ' + '; '.join(val.get('problems', [])))
        return {'summary': f'{len(anims)} animation(s) built and checked: ' + ', '.join(a['name'] for a in anims), 'files': files, 'validation': val}


def summarize_inspection(i):
    arm = i.get('armature') or {}
    return (f"{len(i.get('meshes', []))} mesh(es), {arm.get('bone_count', 0)} bones, "
            f"{len(i.get('actions', []))} animation(s): {', '.join(a['name'] for a in i.get('actions', []))}")


FORBIDDEN_NAMES = {'exec', 'eval', 'compile', 'open', '__import__', 'getattr', 'setattr', 'delattr', 'globals', 'locals', 'vars', 'input', 'breakpoint', 'memoryview'}
ALLOWED_IMPORTS = {'math', 'mathutils', 'random'}


def check_anim_script(path):
    """Static allowlist check of an AI-written animation script before Blender runs it."""
    import ast
    with open(path, encoding='utf-8') as f:
        src = f.read()
    if len(src) > 60000:
        raise RuntimeError(f'{os.path.basename(path)} is too long')
    tree = ast.parse(src, filename=path)
    has_build = False
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            mods = [a.name for a in node.names] if isinstance(node, ast.Import) else [node.module or '']
            for m in mods:
                if m.split('.')[0] not in ALLOWED_IMPORTS:
                    raise RuntimeError(f'{os.path.basename(path)} imports {m!r}, which is not allowed')
        elif isinstance(node, ast.Name) and node.id in FORBIDDEN_NAMES:
            raise RuntimeError(f'{os.path.basename(path)} uses {node.id!r}, which is not allowed')
        elif isinstance(node, ast.Attribute) and node.attr.startswith('__'):
            raise RuntimeError(f'{os.path.basename(path)} uses {node.attr!r}, which is not allowed')
        elif isinstance(node, ast.Name) and node.id == 'bpy':
            raise RuntimeError(f'{os.path.basename(path)} touches bpy directly; use the ctx helpers only')
        elif isinstance(node, ast.FunctionDef) and node.name == 'build':
            has_build = True
    if not has_build:
        raise RuntimeError(f'{os.path.basename(path)} has no build(ctx) function')


def build_prompt(job, rnd):
    with open(os.path.join(HERE, 'prompts', 'animate.md'), encoding='utf-8') as f:
        t = f.read()
    t = t.replace('{{ASSET}}', job['asset_id']).replace('{{REQUEST}}', job.get('request', '').strip() or '(see animations)')
    t = t.replace('{{ANIMATIONS}}', json.dumps(job['animations'], indent=1))
    note = (job.get('review') or {}).get('note')
    if note:
        t += f'\n\n## The owner looked at the last version and asked for changes\n{note.strip()[:2000]}\n'
    if rnd:
        t += ('\n\n## Revision round\nThe previous version was built. Look at `out/build-report.json` and the preview pictures '
              '`out/preview-<AnimationName>-*.png` (Read them). Fix every problem listed and anything that does not read clearly '
              'as the requested action, then rewrite the scripts in `anims/`.\n')
    return t


# ----------------------------------------------------------------------------- checks / main loop
def self_check(cfg, gh, full=False):
    res = {'worker_id': cfg['worker_id'], 'at': now(), 'python': sys.version.split()[0]}
    res['blender_exe'] = cfg['blender_exe']; res['blender_found'] = bool(cfg['blender_exe'] and os.path.lexists(cfg['blender_exe']))
    if res['blender_found']:
        try:
            v = subprocess.run([cfg['blender_exe'], '--version'], capture_output=True, text=True, timeout=120)
            res['blender_version'] = (v.stdout or '').splitlines()[0] if v.stdout else v.stderr[:200]
        except Exception as e:
            res['blender_version'] = f'error: {e}'
    res['claude_exe'] = cfg['claude_exe']; res['claude_found'] = bool(cfg['claude_exe'] and os.path.lexists(cfg['claude_exe']))
    if res['claude_found']:
        for key, args in (('claude_version', ['--version']), ('claude_mcp', ['mcp', 'list'])):
            try:
                v = subprocess.run([cfg['claude_exe'], *args], capture_output=True, text=True, timeout=120)
                res[key] = ((v.stdout or '') + (v.stderr or '')).strip()[:800]
            except Exception as e:
                res[key] = f'error: {e}'
    if res['claude_found'] and full:
        # Prove headless Claude Code really answers (logged in, allowed to run without a window).
        try:
            v = subprocess.run([cfg['claude_exe'], '-p', 'Reply with exactly the word READY and nothing else.', '--max-turns', '1',
                                '--output-format', 'text', '--disallowedTools', 'Bash', 'WebFetch', 'WebSearch', 'Write', 'Edit'],
                               capture_output=True, text=True, timeout=180, cwd=APP_DIR, stdin=subprocess.DEVNULL)
            out = ((v.stdout or '') + (v.stderr or '')).strip()
            res['claude_headless'] = 'ok' if 'READY' in out else f'unexpected answer: {out[:300]}'
        except Exception as e:
            res['claude_headless'] = f'error: {e}'
    s = socket.socket(); s.settimeout(2)
    try:
        s.connect(('127.0.0.1', 9876)); res['blender_mcp_port_9876'] = 'open (local only)'
    except OSError:
        res['blender_mcp_port_9876'] = 'closed (Blender with the MCP add-on is not running right now)'
    finally:
        s.close()
    try:
        gh.call('GET', '')
        res['github'] = 'ok'
    except Exception as e:
        res['github'] = f'error: {e}'
    return res


_STATUS = {'state': None}  # the state the status file on GitHub has now (kept in memory)


def worker_status_files(cfg, state, extra=None):
    path = f'{JOBS_DIR}/_workers/{cfg["worker_id"]}.json'
    body = {'worker_id': cfg['worker_id'], 'state': state, 'at': now(), 'host': socket.gethostname(), **(extra or {})}
    return {path: (json.dumps(body, indent=1) + '\n').encode()}


def post_worker_status(gh, cfg, state, extra=None):
    """Write the worker status file ONLY when the state really changes (idle / busy / stopped / checked).
    No timed "I'm alive" commits: every commit makes Vercel queue builds. "at" = when the state last changed."""
    if _STATUS['state'] == state:
        return
    path = f'{JOBS_DIR}/_workers/{cfg["worker_id"]}.json'
    try:
        if _STATUS['state'] is None:  # first time since this start: maybe the file already says so (a restart)
            b, _ = gh.get_file(path, cfg['queue_branch'])
            if b and json.loads(b).get('state') == state:
                _STATUS['state'] = state; return
        gh.commit_files(worker_status_files(cfg, state, extra), f'blender worker {cfg["worker_id"]}: {state}{SKIP_TAG}', cfg['queue_branch'])
        _STATUS['state'] = state
    except Exception as e:
        log('could not post worker status:', e)


SYNC_DIRS = ('blender_ops', 'prompts')  # Blender-side scripts and prompts follow the repo's main branch


def sync_code(gh, cfg):
    """Keep the Blender scripts and prompts in step with factory/blender-worker on main (the owner's repo).
    Only .py/.md files in these two folders are updated; worker.py itself changes only through the installer."""
    changed = []
    for d in SYNC_DIRS:
        for e in gh.list_dir(f'factory/blender-worker/{d}', cfg['base_branch']):
            name = e.get('name', '')
            if e.get('type') != 'file' or not re.match(r'^[A-Za-z0-9_.-]+\.(py|md)$', name):
                continue
            local = os.path.join(HERE, d, name)
            if os.path.exists(local):
                with open(local, 'rb') as f:
                    data = f.read()
                if hashlib.sha1(b'blob %d\0' % len(data) + data).hexdigest() == e.get('sha'):
                    continue
            b, _ = gh.get_file(e['path'], cfg['base_branch'])
            if b is None:
                continue
            os.makedirs(os.path.dirname(local), exist_ok=True)
            with open(local, 'wb') as f:
                f.write(b)
            changed.append(f'{d}/{name}')
    if changed:
        log('updated from GitHub:', ', '.join(changed))
        import importlib
        importlib.reload(glbtool)
    return changed


def do_one(gh, cfg):
    jobs = find_claimable(gh, cfg)
    if jobs:
        try:
            sync_code(gh, cfg)
        except Exception as e:
            log('could not update scripts from GitHub (using the installed ones):', e)
    for ref in jobs:
        if not claim(ref, cfg):
            continue
        log('claimed job', ref.id, ref.job.get('type'), ref.job.get('asset_id'))
        r = Runner(gh, cfg, ref)
        idle = worker_status_files(cfg, 'idle')
        try:
            result = r.execute()
            final = 'awaiting_review' if ref.job.get('type') == 'animate' else 'completed'
            r.ref.load()
            r.ref.update('done', lambda j: j.update(status=final, result=result, error=None, lease_until=None,
                                                     progress={'stage': 'done', 'percent': 100, 'message': result['summary']},
                                                     history=j.get('history', []) + [{'at': now(), 'status': final}]),
                         {**r.pending, **idle})  # ONE commit: all result files + final state + worker idle
            _STATUS['state'] = 'idle'
            log('job', ref.id, '->', final, result['summary'])
        except Cancelled:
            r.ref.load()
            if os.path.exists(os.path.join(APP_DIR, 'STOP')) and not r.ref.job.get('cancel_requested'):
                # The worker is being stopped: give the job back to the queue.
                r.ref.update('released', lambda j: j.update(status='queued', worker_id=None, lease_until=None,
                                                            progress={'stage': 'queued', 'percent': 0, 'message': 'Worker was stopped; waiting to restart'}), idle)
            else:
                r.ref.update('cancelled', lambda j: j.update(status='cancelled', lease_until=None,
                                                              progress={'stage': 'cancelled', 'percent': 0, 'message': 'Cancelled'},
                                                              history=j.get('history', []) + [{'at': now(), 'status': 'cancelled'}]), idle)
            _STATUS['state'] = 'idle'
            try: os.remove(os.path.join(APP_DIR, 'CANCEL'))
            except OSError: pass
            log('job', ref.id, 'stopped/cancelled')
        except Exception as e:
            err = f'{e}'
            log('job', ref.id, 'FAILED', err, traceback.format_exc())
            try:
                r.ref.load()

                def failed(j, err=err):
                    # Every failure uses up one retry. Once retries reaches max_retries (or retry_on_failure is off)
                    # the job stays "failed", so a job that keeps failing can never loop and burn Claude usage.
                    tries, cap = int(j.get('retries', 0) or 0), int(j.get('max_retries', 2) or 0)
                    retry = bool(j.get('retry_on_failure', False)) and tries < cap
                    j.update(status='queued' if retry else 'failed', retries=tries + 1 if retry else tries,
                             error={'message': err[:4000], 'at': now()}, lease_until=None,
                             progress={'stage': 'failed', 'percent': 0,
                                       'message': (f'Retry {tries + 1} of {cap}: ' if retry else 'Stopped (no retries left): ') + err[:300]},
                             history=j.get('history', []) + [{'at': now(), 'status': 'failed', 'retries': tries + 1 if retry else tries,
                                                              'next': 'queued' if retry else 'stopped'}])
                r.ref.update('failed', failed, {**r.pending, **idle})  # results made so far (e.g. failed validation) go up too
                _STATUS['state'] = 'idle'
                log('job', ref.id, '->', r.ref.job.get('status'), f"(retries {r.ref.job.get('retries')}/{r.ref.job.get('max_retries', 2)})")
            except Exception as e2:
                log('could not record failure:', e2)
        post_worker_status(gh, cfg, 'idle')  # only commits if the final commit above did not get through
        return True
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--setup', action='store_true'); ap.add_argument('--once', action='store_true'); ap.add_argument('--check', action='store_true')
    # Also runs inside Blender (blender --background --python worker.py -- --setup); then our options follow '--'.
    if '--' in sys.argv:
        argv = sys.argv[sys.argv.index('--') + 1:]
    elif '--python' in sys.argv:  # started by Blender with no options of ours
        argv = []
    else:
        argv = sys.argv[1:]
    a = ap.parse_args(argv)
    cfg = load_config()
    if a.setup:
        print('Paste your GitHub fine-grained token for', cfg['repo'], '(it will not be shown, and is saved only in Windows Credential Manager).')
        tok = getpass.getpass('Token: ').strip()
        if not tok:
            print('No token entered.'); return 1
        cred_write(tok)
        print('Saved. Checking it works…')
    token = cred_read()
    if not token:
        msg = 'No GitHub key saved yet. Run Install-Blender-Worker.cmd.'
        print(msg); log(msg)
        if a.check:
            with open(os.path.join(APP_DIR, 'last-check.json'), 'w', encoding='utf-8') as f:
                json.dump({'github': 'no key saved'}, f)
        return 1
    gh = GitHub(cfg['repo'], token)
    if a.setup or a.check:
        res = self_check(cfg, gh, full=True)
        if res.get('github') == 'ok':
            try:
                gh.ensure_branch(cfg['queue_branch'], cfg['base_branch'])
                post_worker_status(gh, cfg, 'checked', {'check': res})
                res['queue_branch'] = 'ok'
            except Exception as e:
                res['github'] = f'error creating the queue branch: {e}'
        with open(os.path.join(APP_DIR, 'last-check.json'), 'w', encoding='utf-8') as f:
            json.dump(res, f, indent=1)
        print(json.dumps(res, indent=1))
        log('check:', json.dumps(res))
        return 0
    gh.ensure_branch(cfg['queue_branch'], cfg['base_branch'])
    # Only one worker may run on this PC (autostart + a manual start must not both take jobs).
    global _LOCK
    _LOCK = open(os.path.join(APP_DIR, 'worker.lock'), 'a+')
    try:
        if os.name == 'nt':
            import msvcrt
            _LOCK.seek(0)
            msvcrt.locking(_LOCK.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(_LOCK.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print('Another Oreheart Blender Worker is already running on this PC. This one will close.')
        log('second worker start refused (one is already running)')
        return 0
    for f in ('STOP', 'CANCEL'):
        try: os.remove(os.path.join(APP_DIR, f))
        except OSError: pass
    log('worker', cfg['worker_id'], 'started; polling', cfg['repo'], 'branch', cfg['queue_branch'])
    chk = self_check(cfg, gh)
    log('start check:', json.dumps(chk))
    post_worker_status(gh, cfg, 'idle', {'check': chk})  # commits only if the status file did not already say "idle"
    while True:
        if os.path.exists(os.path.join(APP_DIR, 'STOP')):
            post_worker_status(gh, cfg, 'stopped'); log('stopped'); return 0
        if os.path.exists(os.path.join(APP_DIR, 'PAUSE')):
            time.sleep(10); continue
        try:
            did = do_one(gh, cfg)
        except Exception as e:
            log('poll error:', e); did = False
        if a.once:
            return 0
        if not did:
            for _ in range(int(cfg['poll_seconds'] / 5)):
                if os.path.exists(os.path.join(APP_DIR, 'STOP')):
                    break
                time.sleep(5)


if __name__ == '__main__':
    sys.exit(main() or 0)
