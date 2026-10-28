"""Start the REAL worker.py once (fresh process = like a restart), with GitHub, Blender and Claude Code faked."""
import os, sys, importlib.util
code = sys.argv[1]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('worker', os.path.join(code, 'worker.py'))
w = importlib.util.module_from_spec(spec); sys.modules['worker'] = w; spec.loader.exec_module(w)
import fakegh
w.GitHub = lambda repo, token: fakegh.FakeGH(repo, token, w.Conflict)
sys.argv = ['worker.py', '--once']
w.main()
