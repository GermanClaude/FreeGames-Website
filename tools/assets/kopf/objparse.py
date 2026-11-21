import numpy as np, collections
def load(path):
    V=[];VT=[];F=[];FT=[];G=[];g=None
    for line in open(path):
        if line.startswith('v '): V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '): VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '): g=line.split()[1]
        elif line.startswith('f '):
            parts=line.split()[1:]
            F.append([int(p.split('/')[0])-1 for p in parts])
            FT.append([int(p.split('/')[1])-1 if '/' in p and p.split('/')[1] else -1 for p in parts])
            G.append(g)
    return np.array(V),np.array(VT),F,FT,G
