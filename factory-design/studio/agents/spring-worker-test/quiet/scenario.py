"""Count blender-queue commits, old worker vs new worker, fully offline.
usage: python3 scenario.py <old worker folder> <new worker folder>"""
import base64, json, os, shutil, subprocess, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fakeapi
OLD, NEW = sys.argv[1], sys.argv[2]
BR = 'blender-queue'
REFS = ['factory-design/runway-jobs/goblin-bomber--front.jpg'] + [f'factory-design/runway/goblin-bomber-idle-box-front/frames/idle/f{i:02d}.jpg' for i in (1, 2, 3)]


def job(jid='spring-quiet-test', **k):
    j = {"id": jid, "type": "animate", "asset_id": "goblin-bomber", "status": "queued", "priority": 5,
         "created_at": "2026-10-28T03:30:00Z", "retries": 0, "max_retries": 2, "retry_on_failure": True, "cancel_requested": False,
         "source": {"character": f"local:{HERE}/tiny.glb"}, "request": "test",
         "animations": [{"name": "OH_Test", "description": "test", "frames": [90, 90], "loop": True}],
         "references": REFS, "history": []}
    j.update(k); return j


def setup(name, jobs=(), status='idle'):
    root = os.path.join(HERE, 'runs', name); shutil.rmtree(root, ignore_errors=True)
    app = os.path.join(root, 'appdata', 'OreheartBlenderWorker'); os.makedirs(app)
    open(os.path.join(app, 'blender-path.txt'), 'w').write(os.path.join(HERE, 'fakeblender'))
    json.dump({'claude_exe': os.path.join(HERE, 'fakeclaude'), 'worker_id': 'starr-test', 'allowed_source_roots': [HERE],
               'work_root': os.path.join(root, 'work')}, open(os.path.join(app, 'config.json'), 'w'))
    files = {f'{BR}:blender-jobs/README.md': b'queue'}
    if status:
        files[f'{BR}:blender-jobs/_workers/starr-test.json'] = json.dumps({'worker_id': 'starr-test', 'state': status}).encode()
    for j in jobs:
        files[f'{BR}:blender-jobs/{j["id"]}/job.json'] = json.dumps(j).encode()
    for r in REFS:
        files['main:' + r] = b'\xff\xd8\xff fake jpeg ' + r.encode()
    files['main:factory/blender-worker/prompts/animate.md'] = open(os.path.join(NEW, 'prompts', 'animate.md'), 'rb').read()
    state = os.path.join(root, 'gh.json'); fakeapi.init_state(state, files)
    env = dict(os.environ, LOCALAPPDATA=os.path.join(root, 'appdata'), FAKEGH_STATE=state, FAKECLAUDE_LOG=os.path.join(root, 'claude.log'),
               OREHEART_WORKER_GITHUB_TOKEN='x')
    return root, state, env


def run(code, env, seconds, *extra):
    p = subprocess.run([sys.executable, os.path.join(HERE, 'drive.py'), code, str(seconds), *extra], env=env, capture_output=True, text=True, timeout=600)
    if p.returncode:
        print(p.stdout[-1500:], p.stderr[-2500:])
    return p


def state(st):
    return json.load(open(st))


def commits(st):
    return [e for e in state(st)['log'] if e['branch'] == BR]


def read(st, path, branch=BR):
    s = state(st); t = s['commits'][s['branches'][branch]]['tree']
    return base64.b64decode(s['blobs'][t[path]]) if path in t else None


def jobj(st, jid='spring-quiet-test'):
    return json.loads(read(st, f'blender-jobs/{jid}/job.json'))


def kinds(cs):
    c = collections.Counter()
    for e in cs:
        m = e['message'].replace(' [skip ci] [vercel skip]', '')
        m = m.split(': ', 1)[1] if ': ' in m else m
        m = 'upload <file>' if m.startswith('upload ') else m
        c[m] += 1
    return dict(c)


results = {}
for label, code in (('OLD', OLD), ('NEW', NEW)):
    print(f'================ {label} worker.py')
    # 1. one idle hour (status file already says idle, like on Ken's PC now)
    root, st, env = setup(f'{label}-idle')
    run(code, env, 3600)
    cs = commits(st); results[(label, 'idle hour')] = len(cs)
    print(f'idle hour: {len(cs)} commits', kinds(cs))
    # 2. restart loop: 10 starts in a row with nothing to do (each start = fresh process)
    root, st, env = setup(f'{label}-restarts')
    for _ in range(10):
        run(code, env, 30, '--once')
    cs = commits(st); results[(label, '10 restarts')] = len(cs)
    print(f'10 restarts: {len(cs)} commits', kinds(cs))
    # 3. one good job, then idle until a full hour has passed
    root, st, env = setup(f'{label}-job', [job()])
    run(code, env, 3600)
    cs = commits(st); j = jobj(st)
    jobc = [c for c in cs if 'spring-quiet-test' in c['message']]
    results[(label, 'one job')] = len(jobc); results[(label, 'hour with one job')] = len(cs)
    outs = sorted(p for p in state(st)['commits'][state(st)['branches'][BR]]['tree'] if '/out/' in p)
    print(f'one job: status={j["status"]} progress={j["progress"]["message"][:60]!r}; job commits={len(jobc)}, hour total={len(cs)}')
    print('   kinds:', kinds(cs))
    print(f'   result files on the branch: {len(outs)}; result entries in job.json: {len(j.get("result", {}).get("files", []))}')
    cl = [json.loads(l) for l in open(os.path.join(root, 'claude.log'))]
    print('   Claude Code runs:', len(cl), 'refs seen:', [len(r['refs']) for r in cl])
    if label == 'NEW':
        tags = all(c['message'].endswith('[skip ci] [vercel skip]') for c in cs)
        print('   every commit tagged [skip ci] [vercel skip]:', tags)
        st_file = json.loads(read(st, 'blender-jobs/_workers/starr-test.json')); print('   worker status file now:', st_file['state'])
        # every file on the branch matches what the worker made
        work = os.path.join(root, 'work', 'spring-quiet-test', 'out')
        bad = [p for p in outs if read(st, p) != open(os.path.join(work, p.split('/out/')[1]), 'rb').read()]
        print('   uploaded files identical to the local results:', not bad, bad[:3])

print('================ NEW worker only: safety checks')
# 4. failing job (Claude writes nothing): retries cap still works, no loop
root, st, env = setup('NEW-fail', [job()])
env['FAKECLAUDE_FAIL'] = '1'
for start in range(1, 6):
    run(NEW, env, 600, '--once')
    j = jobj(st)
    print(f'  fail start {start}: status={j["status"]} retries={j["retries"]}')
    if j['status'] == 'failed':
        break
print('  commits for 3 failed runs:', len(commits(st)), kinds(commits(st)))
# 5. validation fails: the results still go up (in the same commit as "failed")
root, st, env = setup('NEW-valfail', [job(retry_on_failure=False)])
env['FAKE_VALIDATION'] = 'bad'
run(NEW, env, 1200, '--once')
j = jobj(st); outs = [p for p in state(st)['commits'][state(st)['branches'][BR]]['tree'] if '/out/' in p]
print(f'  validation fail: status={j["status"]} files on branch={len(outs)} commits={len(commits(st))} last={commits(st)[-1]["message"]!r}')
# 6. cancel from the dashboard while Claude Code is designing
root, st, env = setup('NEW-cancel', [job()])
run(NEW, env, 1200, '--once', '--cancel-at', '200')
j = jobj(st)
print(f'  cancel at 200 s: status={j["status"]} cancelled at stage={[h for h in j["history"]][-1]} commits={len(commits(st))}')
# 7. crash in the middle of a job, restart after the lease ran out -> recovered (retries +1), finishes
root, st, env = setup('NEW-crash', [job()])
run(NEW, env, 200, '--once')            # the process dies at 200 s (Claude Code still designing)
j = jobj(st); print(f'  crash: status after crash={j["status"]} lease_until={j["lease_until"]}')
s = state(st); head = s['branches'][BR]; tree = dict(s['commits'][head]['tree'])
j['lease_until'] = '2020-01-01T00:00:00Z'  # 15 minutes have passed
b = json.dumps(j).encode(); sh = fakeapi.blob_sha(b); s['blobs'][sh] = base64.b64encode(b).decode(); tree['blender-jobs/spring-quiet-test/job.json'] = sh
c = 'x' * 40; s['commits'][c] = {'tree': tree, 'parents': [head], 'message': 'time passes'}; s['branches'][BR] = c; json.dump(s, open(st, 'w'))
run(NEW, env, 1200, '--once')
j = jobj(st); print(f'  after restart: status={j["status"]} retries={j["retries"]} recovered={[h.get("recovered") for h in j["history"] if h["status"] == "claimed"]}')
# 8. a long stage (Claude Code 25 min): the lease is renewed in time
root, st, env = setup('NEW-long', [job()])
env['FAKE_CLAUDE_SECONDS'] = '1400'
run(NEW, env, 7200, '--once')
j = jobj(st); jc = [c for c in commits(st) if 'spring-quiet-test' in c['message']]
times = [int(c['clock']) for c in jc]; gaps = [b - a for a, b in zip(times, times[1:])]
print(f'  long stage (Claude 23 min): status={j["status"]} job commits={len(jc)} heartbeats={sum("heartbeat" in c["message"] for c in jc)} '
      f'longest gap between job.json writes={max(gaps)} s (lease 900 s)')
print('summary', json.dumps({f'{a} {b}': v for (a, b), v in results.items()}))
