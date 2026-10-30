import sys; sys.path.insert(0, r'C:/Users/kentu/AppData/Local/Temp/claude/C--Users-kentu-Documents-Oreheart/feb7d2ad-92f7-4893-9610-06193628650c/scratchpad/pylib')
import numpy as np
def lab(a):
    c=np.where(a<=0.04045,a/12.92,((a+0.055)/1.055)**2.4)
    M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]])
    xyz=c@M.T/np.array([0.95047,1,1.08883])
    f=np.where(xyz>0.008856,np.cbrt(xyz),7.787*xyz+16/116)
    L=116*f[...,1]-16; A=500*(f[...,0]-f[...,1]); B=200*(f[...,1]-f[...,2])
    return L,A,B
