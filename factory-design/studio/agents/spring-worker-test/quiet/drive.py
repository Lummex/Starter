"""Start the REAL worker.py once (fresh process = like a restart on Ken's PC) with GitHub faked at the HTTP level,
a virtual clock (an hour passes in seconds) and fake Blender / Claude Code that "take" realistic virtual time.
usage: python3 drive.py <worker folder> <virtual seconds to run> [--once] [--cancel-at <virtual s>]"""
import importlib.util, os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
code, limit = sys.argv[1], float(sys.argv[2])
once = '--once' in sys.argv
cancel_at = float(sys.argv[sys.argv.index('--cancel-at') + 1]) if '--cancel-at' in sys.argv else None
spec = importlib.util.spec_from_file_location('worker', os.path.join(code, 'worker.py'))
w = importlib.util.module_from_spec(spec); sys.modules['worker'] = w; spec.loader.exec_module(w)
import fakeapi

T0 = float(os.environ.get('FAKECLOCK_START', '1800000000'))


class Done(BaseException):
    pass


class Clock:
    t = T0

    def time(self):
        return self.t

    def sleep(self, s):
        self.t += s
        os.environ['FAKECLOCK_NOW'] = str(round(self.t - T0))
        if cancel_at is not None and self.t - T0 >= cancel_at and not getattr(self, 'cancelled', False):
            self.cancelled = True  # the dashboard / Ken asks to cancel: edit job.json on GitHub like the Studio would
            st = fakeapi.Store(); s = st.s
            br = 'blender-queue'; head = s['branches'][br]; tree = dict(s['commits'][head]['tree'])
            for p, sh in tree.items():
                if p.endswith('/job.json'):
                    import base64, json
                    j = json.loads(base64.b64decode(s['blobs'][sh])); j['cancel_requested'] = True
                    b = json.dumps(j).encode(); nsh = fakeapi.blob_sha(b); s['blobs'][nsh] = base64.b64encode(b).decode(); tree[p] = nsh
            st.new_commit(br, tree, [head], 'dashboard: cancel'); st.save()
        if self.t - T0 > limit:
            raise Done()


clock = Clock()
w.time = clock
os.environ['FAKECLOCK_NOW'] = '0'
DUR = {'claude': int(os.environ.get('FAKE_CLAUDE_SECONDS', '300')), 'inspect': 30, 'build': 90, 'verify': 60, 'preview': 20}
RealPopen = subprocess.Popen


class SlowPopen(RealPopen):
    """The fake program finishes at once; poll() reports it running until its virtual duration has passed."""
    def __init__(self, args, *a, **k):
        super().__init__(args, *a, **k)
        script = os.path.basename(str(args[args.index('--python') + 1])) if '--python' in args else ''
        name = 'claude' if '-p' in args else next((d for d in DUR if script.startswith(d)), None)
        self._until = clock.t + DUR.get(name, 0)

    def poll(self):
        r = self.wait()  # the fake program is quick: wait for it for real, then report virtual time
        return None if clock.t < self._until else r


w.subprocess.Popen = SlowPopen
w.GitHub = fakeapi.make(w.Conflict, w.GitHub)
sys.argv = ['worker.py'] + (['--once'] if once else [])
try:
    w.main()
except Done:
    pass
