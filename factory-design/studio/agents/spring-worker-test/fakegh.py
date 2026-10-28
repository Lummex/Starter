"""In-memory GitHub stand-in for testing the worker offline. State persists in a JSON file so every
worker start is a fresh process (like a restart on Ken's PC)."""
import base64, hashlib, json, os
STATE = os.environ['FAKEGH_STATE']

class FakeGH:
    def __init__(self, repo, token, Conflict):
        self.Conflict = Conflict
        self.s = json.load(open(STATE))
        self.calls = []
    def _save(self):
        json.dump(self.s, open(STATE, 'w'), indent=1)
    def _sha(self, b):
        return hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()
    def get_file(self, path, ref):
        self.calls.append(('get', path, ref))
        v = self.s['files'].get(f'{ref}:{path}')
        if v is None:
            return None, None
        b = base64.b64decode(v)
        return b, self._sha(b)
    def put_file(self, path, content_bytes, message, branch, sha=None):
        k = f'{branch}:{path}'
        cur = self.s['files'].get(k)
        if cur is not None and self._sha(base64.b64decode(cur)) != sha:
            raise self.Conflict('sha mismatch')
        self.s['files'][k] = base64.b64encode(content_bytes).decode(); self._save()
        self.s.setdefault('commits', []).append(message); self._save()
        return self._sha(content_bytes)
    def list_dir(self, path, ref):
        pre = f'{ref}:{path}/'; seen = {}
        for k in self.s['files']:
            if k.startswith(pre):
                rest = k[len(pre):]; name = rest.split('/')[0]
                seen[name] = 'dir' if '/' in rest else 'file'
        return [{'name': n, 'type': t, 'path': f'{path}/{n}'} for n, t in seen.items()] if path.startswith('blender-jobs') else []
    def call(self, method, path, body=None, raw=False, ok404=False):
        if method == 'GET' and path.startswith('contents/'):
            p, _, ref = path[9:].partition('?ref=')
            b, sha = self.get_file(p, ref)
            return {'sha': sha} if b is not None else None
        return {}
    def ensure_branch(self, branch, base):
        return
