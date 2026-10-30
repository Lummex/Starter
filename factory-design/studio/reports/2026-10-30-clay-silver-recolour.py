"""Gold/brass/bronze metal -> silver with a light-blue sheen (base-colour picture only).
Mask = warm yellow-orange hue in Lab (skin is pinker, so it stays) + enough saturation (dull brown leather stays)."""
import sys; sys.path.insert(0, r'C:/Users/kentu/AppData/Local/Temp/claude/C--Users-kentu-Documents-Oreheart/feb7d2ad-92f7-4893-9610-06193628650c/scratchpad/pylib'); sys.path.insert(0, r'C:/Users/kentu/AppData/Local/Temp/claude/C--Users-kentu-Documents-Oreheart/feb7d2ad-92f7-4893-9610-06193628650c/scratchpad')
import numpy as np
from PIL import Image
from lab import lab
def ss(a,b,x): t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
def mask(a, hlo=(50,56), hhi=(82,90), cmin=(28,36), blo=(40,46)):
    L,A,B=lab(a); H=np.degrees(np.arctan2(B,A)); C=np.hypot(A,B)
    gold=ss(*hlo,H)*(1-ss(*hhi,H))*ss(*cmin,C)*ss(12,20,L)
    # dark bronze sits nearer skin hue; skin is light (L>55), so only take the dark ones
    bronze=ss(*blo,H)*(1-ss(*hlo,H))*ss(22,30,C)*(1-ss(46,54,L))*ss(10,16,L)
    # light peach skin highlights (light AND not very yellow) stay
    skin=ss(62,68,L)*(1-ss(60,66,H))
    return np.maximum(gold,bronze)*(1-skin)
def recolor(im, head=None, hl=(36,44), hc=(34,42), **kw):
    a=np.asarray(im.convert('RGB')).astype(np.float32)/255
    w=mask(a,**kw)
    if head is not None:   # head/neck texels: beards and brows are brown too, so only take bright, strong brass there
        L,A,B=lab(a); C=np.hypot(A,B)
        w=w*(1-head)+w*head*ss(*hl,L)*ss(*hc,C)
    Y=a@np.array([0.2126,0.7152,0.0722])
    Y2=np.clip((Y-0.45)*1.3+0.52,0,1)
    sil=np.clip(Y2[...,None]*np.array([0.90,0.97,1.07]),0,1)
    out=a*(1-w[...,None])+sil*w[...,None]
    return Image.fromarray((out*255+0.5).astype(np.uint8)), w
PARAMS={'the-great-steam-golem':dict(hlo=(30,36),blo=(24,30)),'gyrocopter-ace_gyro-wings':dict(hlo=(30,36),blo=(24,30),cmin=(16,24)),'gnome-tinker_wrench':dict(cmin=(12,20),hhi=(92,100))}   # copper-orange metal, no skin to protect
if __name__=='__main__':
    src,dst,q=sys.argv[1],sys.argv[2],int(sys.argv[3])
    key=__import__('os').path.basename(src).rsplit('.',1)[0]
    hp=r'C:/Users/kentu/AppData/Local/Temp/claude/C--Users-kentu-Documents-Oreheart/feb7d2ad-92f7-4893-9610-06193628650c/scratchpad/up/'+key+'-head.png'
    head=None
    if __import__('os').path.exists(hp):
        im0=Image.open(src); head=np.asarray(Image.open(hp).convert('RGB').resize(im0.size,Image.BILINEAR))[...,0].astype(np.float32)/255
    o,w=recolor(Image.open(src),head=head,**PARAMS.get(key,{}))
    o.save(dst,quality=q,subsampling=2) if dst.endswith('.jpg') else o.save(dst)
    if len(sys.argv)>4:
        a=np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
        ov=a*0.35+np.array([255,0,0])*w[...,None]*0.65+a*0.65*(1-w[...,None])
        Image.fromarray(ov.clip(0,255).astype(np.uint8)).save(sys.argv[4])
    print(key,'changed %.1f%%'%(100*(w>0.5).mean()))
