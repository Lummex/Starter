import json, os, sys, subprocess, base64, shutil
code, name, missing = sys.argv[1], sys.argv[2], sys.argv[3] == 'missing'
root = f'/home/claude/t/run-{name}'; shutil.rmtree(root, ignore_errors=True); os.makedirs(root)
app = os.path.join(root, 'appdata', 'OreheartBlenderWorker'); os.makedirs(app)
open(os.path.join(app, 'blender-path.txt'), 'w').write('/home/claude/t/fakeblender')
json.dump({'claude_exe': '/home/claude/t/fakeclaude', 'worker_id': 'test-worker', 'allowed_source_roots': ['/home/claude/t']}, open(os.path.join(app, 'config.json'), 'w'))
refs = ['factory-design/runway-jobs/goblin-bomber--front.jpg'] + [f'factory-design/runway/goblin-bomber-idle-box-front/frames/idle/f{i:02d}.jpg' for i in (1, 2, 3)]
job = {"id": "spring-worker-selftest", "type": "animate", "asset_id": "goblin-bomber", "status": "queued", "priority": 5,
       "created_at": "2026-10-28T03:30:00Z", "retries": 0, "max_retries": 2, "retry_on_failure": True, "cancel_requested": False,
       "source": {"character": "local:/home/claude/t/tiny.glb"}, "request": "test",
       "animations": [{"name": "OH_Test", "description": "test", "frames": [30, 30], "loop": True}],
       "references": refs, "history": []}
files = {'blender-queue:blender-jobs/spring-worker-selftest/job.json': base64.b64encode(json.dumps(job).encode()).decode()}
for i, r in enumerate(refs):
    if missing and i == 3: continue
    files['main:' + r] = base64.b64encode(b'\xff\xd8\xff fake jpeg ' + r.encode()).decode()
state = os.path.join(root, 'gh.json'); json.dump({'files': files}, open(state, 'w'))
env = dict(os.environ, LOCALAPPDATA=os.path.join(root, 'appdata'), FAKEGH_STATE=state, FAKECLAUDE_LOG=os.path.join(root, 'claude.log'),
           OREHEART_WORKER_GITHUB_TOKEN='x')
for start in range(1, 7):
    p = subprocess.run([sys.executable, '/home/claude/t/drive.py', code], env=env, capture_output=True, text=True, timeout=120)
    s = json.load(open(state))
    j = json.loads(base64.b64decode(s['files']['blender-queue:blender-jobs/spring-worker-selftest/job.json']))
    print(f"start {start}: status={j['status']} retries={j['retries']} msg={j['progress']['message'][:90]!r}")
    if p.returncode: print(p.stdout[-800:], p.stderr[-1500:])
    if j['status'] == 'failed':
        break
cl = os.path.join(root, 'claude.log')
runs = [json.loads(l) for l in open(cl)] if os.path.exists(cl) else []
print('Claude Code runs:', len(runs), '| refs it could see per run:', [len(r['refs']) for r in runs])
if runs: print('  e.g.', runs[0]['refs'])
print('history:', [(h['status'], h.get('retries'), h.get('next')) for h in j['history']])
