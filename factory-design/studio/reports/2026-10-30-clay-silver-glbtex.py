"""Extract / replace the base-colour picture of a GLB without touching any other byte range.
extract <glb> <out.jpg|png>       replace <glb> <newimg> <out.glb>"""
import sys,json,struct
sys.stdout.reconfigure(encoding="utf-8")
def load(p):
    d=open(p,'rb').read(); jl=struct.unpack('<I',d[12:16])[0]
    j=json.loads(d[20:20+jl]); o=20+jl; bl=struct.unpack('<I',d[o:o+4])[0]
    return j,d[o+8:o+8+bl]
def base_img(j):
    m=j['materials'][0]; t=m['pbrMetallicRoughness']['baseColorTexture']['index']
    return j['textures'][t]['source']
def ranges(j):
    # every (obj, offset-key, length-key) that points into buffer 0
    out=[]
    for bv in j['bufferViews']:
        if bv.get('buffer',0)==0: out.append(bv)
        e=bv.get('extensions',{}).get('EXT_meshopt_compression')
        if e and e.get('buffer',0)==0: out.append(e)
    return out
if __name__!='__main__': pass
elif sys.argv[1]=='extract':
    j,b=load(sys.argv[2]); i=j['images'][base_img(j)]; bv=j['bufferViews'][i['bufferView']]
    open(sys.argv[3],'wb').write(b[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]); print(i.get('mimeType'))
else:
    j,b=load(sys.argv[2]); new=open(sys.argv[3],'rb').read()
    i=j['images'][base_img(j)]; target=j['bufferViews'][i['bufferView']]
    rs=sorted(ranges(j),key=lambda r:r.get('byteOffset',0))
    out=bytearray(); 
    for r in rs:
        off=r.get('byteOffset',0); data=new if r is target else b[off:off+r['byteLength']]
        while len(out)%4: out.append(0)
        r['byteOffset']=len(out); r['byteLength']=len(data); out+=data
    while len(out)%4: out.append(0)
    j['buffers'][0]['byteLength']=len(out)
    js=json.dumps(j,separators=(',',':')).encode()
    while len(js)%4: js+=b' '
    tot=12+8+len(js)+8+len(out)
    open(sys.argv[4],'wb').write(struct.pack('<III',0x46546C67,2,tot)+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(out),0x004E4942)+out)
    print('ok',tot)
