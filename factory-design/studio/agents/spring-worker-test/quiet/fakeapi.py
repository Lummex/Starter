"""Offline GitHub stand-in at the HTTP level: replaces only GitHub.call(), so the REAL worker code for
get_file / put_file / list_dir / commit_files / ensure_branch runs unchanged (old and new worker.py).
Simulates the contents API and the git data API (refs, commits, trees, blobs) with real commits,
compare-and-swap and fast-forward checks. State is a JSON file, so every worker start is a fresh process."""
import base64, hashlib, json, os

STATE = os.environ.get('FAKEGH_STATE')


def blob_sha(b):
    return hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()


class Store:
    def __init__(self):
        self.s = json.load(open(STATE))

    def save(self):
        json.dump(self.s, open(STATE, 'w'))

    def tree_of(self, ref):
        c = self.s['branches'].get(ref, ref)
        return self.s['commits'][c]['tree'] if c in self.s['commits'] else None

    def new_commit(self, branch_or_none, tree, parents, message, at=None):
        cid = hashlib.sha1(json.dumps([tree, parents, message, len(self.s['commits'])]).encode()).hexdigest()
        self.s['commits'][cid] = {'tree': tree, 'parents': parents, 'message': message}
        if branch_or_none:
            self.s['branches'][branch_or_none] = cid
            self.s.setdefault('log', []).append({'branch': branch_or_none, 'message': message, 'clock': os.environ.get('FAKECLOCK_NOW')})
        return cid


def make(Conflict, base):
    class FakeAPI(base):
        def call(self, method, path, body=None, raw=False, ok404=False):
            st = Store()
            s = st.s
            s['api_calls'] = s.get('api_calls', 0) + 1
            try:
                return self._call(st, s, method, path, body, raw, ok404)
            finally:
                st.save()

        def _call(self, st, s, method, path, body, raw, ok404):
            def nf():
                if ok404:
                    return None
                raise RuntimeError(f'GitHub {method} {path} -> 404')
            if path == '':
                return {'full_name': self.repo}
            if path.startswith('contents/'):
                p, _, ref = path[9:].partition('?ref=')
                if method == 'GET':
                    tree = st.tree_of(ref)
                    if tree is None:
                        return nf()
                    if p in tree:
                        b = base64.b64decode(s['blobs'][tree[p]])
                        if raw:
                            return b
                        return {'type': 'file', 'path': p, 'sha': tree[p], 'encoding': 'base64', 'content': base64.b64encode(b).decode()}
                    pre = p + '/'; seen = {}
                    for k, v in tree.items():
                        if k.startswith(pre):
                            rest = k[len(pre):]; n = rest.split('/')[0]
                            seen[n] = ('dir', None) if '/' in rest else ('file', v)
                    if not seen:
                        return nf()
                    return [{'name': n, 'type': t, 'path': f'{p}/{n}', 'sha': sh} for n, (t, sh) in seen.items()]
                if method == 'PUT':
                    br = body['branch']; head = s['branches'][br]
                    tree = dict(s['commits'][head]['tree'])
                    cur = tree.get(p)
                    if cur is not None and cur != body.get('sha'):
                        raise Conflict(f'409 {p} does not match {body.get("sha")}')
                    b = base64.b64decode(body['content']); sh = blob_sha(b)
                    s['blobs'][sh] = body['content']; tree[p] = sh
                    st.new_commit(br, tree, [head], body['message'])
                    return {'content': {'sha': sh}}
            if path.startswith('git/ref/heads/') and method == 'GET':
                b = path[len('git/ref/heads/'):]
                return {'object': {'sha': s['branches'][b]}} if b in s['branches'] else nf()
            if path.startswith('git/commits/') and method == 'GET':
                c = path[len('git/commits/'):]
                return {'sha': c, 'tree': {'sha': 'T' + c}}
            if path == 'git/blobs' and method == 'POST':
                b = base64.b64decode(body['content']); sh = blob_sha(b)
                s['blobs'][sh] = body['content']
                return {'sha': sh}
            if path == 'git/trees' and method == 'POST':
                bt = body.get('base_tree')
                tree = dict(s['commits'][bt[1:]]['tree']) if bt else {}
                for e in body['tree']:
                    if e.get('content') is not None:
                        c = e['content'].encode(); sh = blob_sha(c); s['blobs'][sh] = base64.b64encode(c).decode(); tree[e['path']] = sh
                    elif e.get('sha') is None:
                        tree.pop(e['path'], None)
                    else:
                        tree[e['path']] = e['sha']
                tid = 'tree-' + hashlib.sha1(json.dumps(tree, sort_keys=True).encode()).hexdigest()
                s.setdefault('trees', {})[tid] = tree
                return {'sha': tid}
            if path == 'git/commits' and method == 'POST':
                tree = s['trees'][body['tree']] if body['tree'] in s.get('trees', {}) else {}
                return {'sha': st.new_commit(None, tree, body['parents'], body['message'])}
            if path.startswith('git/refs/heads/') and method == 'PATCH':
                b = path[len('git/refs/heads/'):]
                c = body['sha']
                if not body.get('force') and s['commits'][c]['parents'] != [s['branches'][b]]:
                    raise Conflict('422 Update is not a fast forward')
                s['branches'][b] = c
                s.setdefault('log', []).append({'branch': b, 'message': s['commits'][c]['message'], 'clock': os.environ.get('FAKECLOCK_NOW')})
                return {'object': {'sha': c}}
            if path == 'git/refs' and method == 'POST':
                b = body['ref'].split('refs/heads/')[1]
                s['branches'][b] = body['sha']
                return {}
            raise RuntimeError(f'fake GitHub: unsupported {method} {path}')
    return FakeAPI


def init_state(path, files):
    """files: {'branch:path': bytes}"""
    s = {'branches': {}, 'commits': {}, 'blobs': {}, 'trees': {}, 'log': []}
    trees = {}
    for k, b in files.items():
        br, _, p = k.partition(':')
        sh = blob_sha(b); s['blobs'][sh] = base64.b64encode(b).decode()
        trees.setdefault(br, {})[p] = sh
    for br, t in trees.items():
        cid = hashlib.sha1(br.encode()).hexdigest()
        s['commits'][cid] = {'tree': t, 'parents': [], 'message': 'start'}
        s['branches'][br] = cid
    json.dump(s, open(path, 'w'))
