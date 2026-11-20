# NULLPUNKT – Kopf-Asset aus dem MakeHuman-Grundnetz hm08 (CC0, makehumancommunity/makehuman, Assets seit 09/2020 CC0)
# Erzeugt kopf.bin + kopf.json: Kopf/Hals-Ausschnitt (Vierecke), eigenes UV-Layout, Form-Ziele (Alter, Herkunft, Gewicht,
# Gesichtsdetails, weiblich) und Mimik-Ziele (prozedural), Umgebungsverdeckung je Ecke, Masken (Lippenrot, Mundraum, Augenhöhle, Ohr).
# Nutzung: MH_DIR=<ordner mit base.obj und t/> python3 -I build_head.py <ausgabeordner>
#   (Ziele wie bei ../mh/mhlib.py als t/<ordner>_<name>.target; Ausgabe für das Spiel: assets/lib/models/kopf/)
# 20.11.: ins Repo übernommen (vorher nur im Arbeitsordner) + Form-Ziel 'female' (caucasian-female-young − caucasian-male-young).
import sys, os, json, math, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from objparse import load

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get('MH_DIR') or os.path.join(HERE, '..', 'dl', 'mh')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'out')
os.makedirs(OUT, exist_ok=True)

V, VT, F, FT, G = load(os.path.join(SRC, 'base.obj'))
F = np.array(F); FT = np.array(FT); G = np.array(G)
NV = len(V)

def target(name):
    d = np.zeros_like(V)
    for line in open(os.path.join(SRC, 't', name + '.target')):
        if line[0] == '#' or not line.strip():
            continue
        p = line.split()
        d[int(p[0])] = [float(p[1]), float(p[2]), float(p[3])]
    return d

def tg(path):
    return target(path.replace('/', '_'))

# ------------------------------------------------------------------ Grundform: junger Mann (Mitteleuropa)
CMY = tg('macrodetails/caucasian-male-young')
B = V + CMY

# ------------------------------------------------------------------ Kopf-Ausschnitt
CUT = 5.86
bodyF = np.where(G == 'body')[0]
selF = [k for k in bodyF if V[F[k]][:, 1].min() > CUT]
selF = np.array(selF)
vsel = np.unique(F[selF].ravel())
eyeHelpL = np.unique(F[G == 'helper-l-eye'].ravel())  # Figur links (MH +x)
eyeHelpR = np.unique(F[G == 'helper-r-eye'].ravel())

# Augenmitten (MH) aus den Hilfskugeln
def eyeC(P):
    return np.array([(P[eyeHelpL].min(0) + P[eyeHelpL].max(0)) * 0.5, (P[eyeHelpR].min(0) + P[eyeHelpR].max(0)) * 0.5])

EYE_Y, EYE_Z = 1.692, -0.0705   # Modellraum (Kopfmitte HEAD_C = (0, 1,685, 0))
HEAD_C = np.array([0, 1.685, 0.0])
K = float(os.environ.get('KOPF_K', '1.0'))
S = 0.1 * K
ecB = eyeC(B)
EMH = (ecB[0] + ecB[1]) * 0.5

def T(P):
    """MH (dm, Blick +z, Figur-links +x) → Modellraum (m, Blick −z, Figur-rechts +x)."""
    out = np.empty_like(P)
    out[..., 0] = -(P[..., 0] - EMH[0]) * S
    out[..., 1] = (P[..., 1] - EMH[1]) * S + EYE_Y
    out[..., 2] = -(P[..., 2] - EMH[2]) * S + EYE_Z
    return out

def TD(D):
    out = np.empty_like(D)
    out[..., 0] = -D[..., 0] * S
    out[..., 1] = D[..., 1] * S
    out[..., 2] = -D[..., 2] * S
    return out

# Neue Nummerierung: Ausschnitt-Ecken + 2 Halsringe (Verlängerung in den Kragen)
vmap = -np.ones(NV, dtype=np.int64)
vmap[vsel] = np.arange(len(vsel))
quads = vmap[F[selF]]
# Wicklung: MH ist gegen den Uhrzeigersinn außen; nach der Spiegelung (x und z negiert = Drehung um y) bleibt sie
# Randschleife (Halsschnitt)
E = collections.Counter()
for q in quads:
    for i in range(4):
        a, b = q[i], q[(i + 1) % 4]
        E[(min(a, b), max(a, b))] += 1
bd = [e for e, c in E.items() if c == 1]
nxt = {}
for q in quads:
    for i in range(4):
        a, b = q[i], q[(i + 1) % 4]
        if E[(min(a, b), max(a, b))] == 1:
            nxt[a] = b
start = bd[0][0]
ring = [start]
while True:
    n = nxt[ring[-1]]
    if n == start:
        break
    ring.append(n)
assert len(ring) == len(bd), (len(ring), len(bd))

P0 = T(B[vsel])
nH = len(vsel)
ringP = P0[ring]
cxz = ringP[:, [0, 2]].mean(0)
EXT = [(-0.035, 1.05), (-0.085, 1.16)]
extP = []
for dy, sc in EXT:
    q = ringP.copy()
    q[:, 0] = cxz[0] + (q[:, 0] - cxz[0]) * sc
    q[:, 2] = cxz[1] + (q[:, 2] - cxz[1]) * sc
    q[:, 1] = ringP[:, 1].mean() + dy + (ringP[:, 1] - ringP[:, 1].mean()) * 0.5
    extP.append(q)
nR = len(ring)
pos = np.concatenate([P0] + extP)
# Schädeldach etwas flacher/kürzer (Helme und Mützen sind auf ≈ 1,795 m Scheitelhöhe gebaut)
_yc = EYE_Y + 0.03
_hi = pos[:, 1] > _yc
pos[_hi, 1] = _yc + (pos[_hi, 1] - _yc) * 0.9
_t = np.clip((pos[:, 1] - EYE_Y) / 0.1, 0, 1)
pos[:, 0] *= 1 - 0.03 * _t
pos[:, 2] = -0.0 + (pos[:, 2] - 0.0) * (1 - 0.03 * _t)
# Stirn/Schädeldach nicht vor die bisherige Kopfform (Helmrand, Mützenschild sitzen dort): vorderste Kontur begrenzen
def _front(x, y, c, r):
    q = 1 - (x / r[0]) ** 2 - ((y - c[1]) / r[1]) ** 2
    return np.where(q > 0, c[2] - r[2] * np.sqrt(np.clip(q, 0, 1)), 9.0)
_zf = np.minimum(_front(pos[:, 0], pos[:, 1], (0, 1.715, -0.03), (0.066, 0.045, 0.055)), _front(pos[:, 0], pos[:, 1], (0, 1.707, 0.012), (0.0745, 0.088, 0.098)))
_w = np.clip((pos[:, 1] - 1.712) / 0.012, 0, 1) * (pos[:, 2] < -0.02)
_lim = _zf + 0.003
pos[:, 2] = np.where((_w > 0) & (pos[:, 2] < _lim), pos[:, 2] + (_lim - pos[:, 2]) * _w, pos[:, 2])
# Breite oben ebenso begrenzen (|x| ≤ Schädelellipse)
nV0 = len(pos)
ringIdx = np.array(ring)
r1 = nH + np.arange(nR)
r2 = nH + nR + np.arange(nR)
extQuads = []
for i in range(nR):
    j = (i + 1) % nR
    # Rand a→b läuft wie im Netz (Fläche liegt links); neue Fläche darunter: a, b' … gleiche Orientierung wie das Netz
    a, b = ringIdx[i], ringIdx[j]
    extQuads.append([b, a, r1[i], r1[j]])
    extQuads.append([r1[j], r1[i], r2[i], r2[j]])
extQuads = np.array(extQuads)
allQuads = np.concatenate([quads, extQuads])
# Quelle je neuer Ecke (für Ziele): Randecke
srcOf = np.concatenate([vsel, vsel[ringIdx], vsel[ringIdx]])

# ------------------------------------------------------------------ UV: Inseln neu packen
uvq = FT[selF]                       # MH-UV-Indizes je Viereck-Ecke
uvU = np.unique(uvq.ravel())
umap = {u: i for i, u in enumerate(uvU)}
uvQuads = np.vectorize(umap.get)(uvq)
UV = VT[uvU].copy()
# Inseln (Flächen, die UV-Ecken teilen)
parent = list(range(len(UV)))
def fnd(a):
    while parent[a] != a:
        parent[a] = parent[parent[a]]
        a = parent[a]
    return a
for q in uvQuads:
    for i in range(1, 4):
        ra, rb = fnd(q[0]), fnd(q[i])
        if ra != rb:
            parent[ra] = rb
isl = np.array([fnd(i) for i in range(len(UV))])
ids, counts = np.unique(isl, return_counts=True)
order = ids[np.argsort(-counts)]
newUV = np.zeros_like(UV)
main = order[0]
m = isl == main
mn, mx = UV[m].min(0), UV[m].max(0)
# Texturformat 1:2 (Breite:Höhe). Haupt-Insel: Seitenverhältnis erhalten
H_MAIN = 0.875
w, h = mx - mn
sc = H_MAIN / h          # in Höhe-Einheiten
# Physikalisch: x-Einheit = W, y-Einheit = 2W → u = x * sc * 2 (Breiteneinheiten)
newUV[m, 0] = (UV[m, 0] - mn[0]) * sc * 2.0
newUV[m, 1] = 1.0 - H_MAIN + (UV[m, 1] - mn[1]) * sc
uMainMax = w * sc * 2.0
print('Haupt-Insel u-Breite', round(uMainMax, 3))
# übrige Inseln in den unteren Streifen (Höhe 1 − H_MAIN − Rand) und den rechten Streifen
rest = [i for i in order[1:]]
boxes = []
for i in rest:
    mm = isl == i
    a, b = UV[mm].min(0), UV[mm].max(0)
    boxes.append((i, a, b))
stripH = 1.0 - H_MAIN - 0.012
# gemeinsamer Maßstab: alle restlichen Inseln nebeneinander in den unteren Streifen
tot_w = sum((b[0] - a[0]) for _, a, b in boxes)
max_h = max((b[1] - a[1]) for _, a, b in boxes)
s2 = min(stripH / max_h, (0.98 - 0.01 * len(boxes)) / (tot_w * 2.0))
x = 0.005
for i, a, b in boxes:
    mm = isl == i
    newUV[mm, 0] = x + (UV[mm, 0] - a[0]) * s2 * 2.0
    newUV[mm, 1] = 0.004 + (UV[mm, 1] - a[1]) * s2
    x += (b[0] - a[0]) * s2 * 2.0 + 0.01
print('Inseln', len(order), 'Rest-Maßstab', round(s2 / sc, 3), 'x-Ende', round(x, 3))
assert newUV[:, 0].max() <= 1.0 and newUV[:, 1].max() <= 1.0
# Halsringe: UV der Randecken (aus einer angrenzenden Fläche) – Textur dehnt sich dort (unter dem Kragen)
uvOfV = {}
for q, qu in zip(allQuads[:len(quads)], uvQuads):
    for i in range(4):
        uvOfV.setdefault(q[i], qu[i])
uvList = list(newUV)
extUVq = []
ringUV = [uvOfV[a] for a in ringIdx]
for i in range(nR):
    j = (i + 1) % nR
    ua, ub = ringUV[i], ringUV[j]
    extUVq.append([ub, ua, ua, ub])
    extUVq.append([ub, ua, ua, ub])
allUVq = np.concatenate([uvQuads, np.array(extUVq)])
UVall = np.array(uvList)

# ------------------------------------------------------------------ Landmarken (Modellraum)
P = pos
ec = T(eyeC(B))          # [Figur-links (x<0), Figur-rechts (x>0)]
eyeR_ = float(np.mean([(B[eyeHelpL].max(0) - B[eyeHelpL].min(0)).max() * 0.5]) * S)
# Normalen (für Mundraum-Suche)
def _normals(Pts, Q):
    N = np.zeros_like(Pts)
    n = np.cross(Pts[Q[:, 2]] - Pts[Q[:, 0]], Pts[Q[:, 3]] - Pts[Q[:, 1]])
    for i in range(4):
        np.add.at(N, Q[:, i], n)
    l = np.linalg.norm(N, axis=1, keepdims=True); l[l == 0] = 1
    return N / l
N0 = _normals(P, allQuads)
# Normalen müssen nach außen zeigen (Scheitel: +y)
if N0[np.argmax(P[:, 1]), 1] < 0:
    allQuads = allQuads[:, ::-1].copy(); allUVq = allUVq[:, ::-1].copy(); N0 = -N0
    print('Wicklung umgedreht')
front = P[:, 2] < EYE_Z - 0.02
mid = (np.abs(P[:, 0]) < 0.0015) & front
# Mundspalt: im vorderen Mittelprofil (je 0,7-mm-Band vorderstes z) die zurückliegendste Stelle zwischen Ober- und Unterlippe
mz = P[mid & (N0[:, 2] < -0.25) & (P[:, 1] > EYE_Y - 0.095) & (P[:, 1] < EYE_Y - 0.05)]
bins = np.arange(EYE_Y - 0.095, EYE_Y - 0.05, 0.0012)
prof = []
for y0 in bins:
    s = mz[(mz[:, 1] >= y0) & (mz[:, 1] < y0 + 0.0007)]
    if len(s):
        prof.append((y0 + 0.0006, s[:, 2].min()))
prof = np.array(prof)
# Oberlippe vorn: lokales Minimum z unterhalb der Nase; Unterlippe: lokales Minimum darunter; Spalt: Maximum dazwischen
ys, zs = prof[:, 0], prof[:, 1]
# Oberlippe = vorderster Punkt unterhalb der Nase; Spalt = erstes lokales Maximum von z darunter
okU = np.where((ys < EYE_Y - 0.06) & (ys > EYE_Y - 0.09))[0]
iU = okU[np.argmin(zs[okU])]
bi_ = iU - 1
while bi_ > 0 and zs[bi_ - 1] >= zs[bi_]:
    bi_ -= 1
best = zs[bi_] - zs[iU]
slitY = float(ys[bi_]); slitZ = float(zs[bi_])
mouthFront = float(zs[iU])
print('Mundspalt y', round(slitY, 4), 'z', round(slitZ, 4), 'Lippen vorn', round(mouthFront, 4), 'Tiefe', round(best, 4))
cavC = np.array([0.0, slitY, slitZ + 0.03])
inward = ((N0 * (P - cavC)).sum(1) < 0.0) & (np.abs(P[:, 0]) < 0.04) & (np.abs(P[:, 1] - slitY) < 0.06) & (P[:, 2] > slitZ + 0.0015) & (P[:, 2] < EYE_Z + 0.09)
_adj = collections.defaultdict(set)
for q in allQuads:
    for i in range(4):
        _adj[q[i]].add(q[(i + 1) % 4]); _adj[q[(i + 1) % 4]].add(q[i])
cands = np.where(inward & (np.abs(P[:, 0]) < 0.006))[0]
seedM = cands[np.argmax(P[cands, 2])]
mouthSet = {seedM}; st = [seedM]
while st:
    v = st.pop()
    for n in _adj[v]:
        if n not in mouthSet and inward[n]:
            mouthSet.add(n); st.append(n)
mouthSet = np.array(sorted(mouthSet))
_ms = set(mouthSet.tolist())
rim = np.array([v for v in mouthSet if any(n not in _ms for n in _adj[v])])
rim = rim[(np.abs(P[rim, 1] - slitY) < 0.005) & (P[rim, 2] < slitZ + 0.018)]
cornerX = float(np.abs(P[rim, 0]).max()) + 0.001
print('Mundraum-Ecken', len(mouthSet), 'Mundwinkel x', round(cornerX, 4))
noseTip = P[front][np.argmin(P[front][:, 2])]
chinPts = P[mid & (P[:, 1] < slitY - 0.02)]
chin = chinPts[np.argmin(chinPts[:, 1] + 0.0 * chinPts[:, 2])] if len(chinPts) else None
# Kinnspitze: vorderster Punkt unter dem Mund
cz = chinPts[chinPts[:, 1] < slitY - 0.025]
chinFront = cz[np.argmin(cz[:, 2])]
# Kinn-Unterkante (Mittellinie): unterster Punkt der vorderen Mittellinie oberhalb des Halses (Knick)
TMJ = np.array([0.0, EYE_Y - 0.030, EYE_Z + 0.092])
print('Nase', noseTip.round(4), 'Kinn vorn', chinFront.round(4))

# Kopfbreite/-länge
hb = P[:nH]
lvl = hb[np.abs(hb[:, 1] - (EYE_Y + 0.045)) < 0.006]
print('Kopfbreite', round(float(lvl[:, 0].max() - lvl[:, 0].min()), 4), 'Länge', round(float(lvl[:, 2].max() - lvl[:, 2].min()), 4), 'Scheitel', round(float(hb[:, 1].max()), 4))
print('Auge-Kinn', round(float(EYE_Y - chinPts[:, 1].min()), 4))

# ------------------------------------------------------------------ Masken je Ecke
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

ax = np.abs(P[:, 0])
# Innenseite der Lippen dazunehmen (Flutfüllung endet am Lippenrand): 3 Ringe nach außen, nur hinter dem Spalt
_ms = set(mouthSet.tolist())
for _ in range(3):
    add_ = set()
    for v in _ms:
        for n in _adj[v]:
            if n not in _ms and P[n, 2] > slitZ + 0.0012 and abs(P[n, 0]) < cornerX + 0.002 and abs(P[n, 1] - slitY) < 0.016:
                add_.add(n)
    _ms |= add_
mouthSet = np.array(sorted(_ms))
mouthIn = np.zeros(nV0); mouthIn[mouthSet] = 1
adj = _adj

# Augenhöhlen-Innenseite: Ecken innerhalb der Augapfelkugel (+ 1,5 mm)
eyeIn = np.zeros(nV0)
eyeRad = []
for e in ec:
    d = np.linalg.norm(P - e, axis=1)
    eyeIn = np.maximum(eyeIn, (d < eyeR_ * 0.98).astype(float))
# Ohren: seitlich außerhalb der Schädelkontur
ear = sstep(0.064, 0.072, ax) * sstep(EYE_Y + 0.04, EYE_Y + 0.02, P[:, 1]) * sstep(EYE_Y - 0.075, EYE_Y - 0.06, P[:, 1])

# ------------------------------------------------------------------ Lidränder (je Auge): Höhenwinkel der Ränder
def eyeFrame(e):
    d = P - e
    r = np.linalg.norm(d, axis=1)
    el = np.arctan2(d[:, 1], -d[:, 2])        # Höhe (+ oben), 0 = geradeaus vorn
    az = np.arctan2(d[:, 0], -d[:, 2])        # seitlich
    return d, r, el, az

def lidScan(e, rad):
    """Lidrand topologisch: Augenhöhlen-Innenseite (Normale zeigt zur Augenmitte) per Flutfüllung, deren Rand = Lidränder."""
    d, r, el, az = eyeFrame(e)
    inw = ((N0 * d).sum(1) < 0) & (r < rad + 0.012) & (mouthIn < 0.5) & (np.abs(d[:, 0]) < 0.03)
    cands = np.where(inw & (np.abs(d[:, 0]) < 0.004) & (np.abs(d[:, 1]) < 0.004))[0]
    seed = cands[np.argmax(d[cands, 2])]
    sock = {seed}; st = [seed]
    while st:
        v = st.pop()
        for n in _adj[v]:
            if n not in sock and inw[n]:
                sock.add(n); st.append(n)
    rimE = np.array([v for v in sock if any(n not in sock for n in _adj[v])])
    rimE = rimE[d[rimE, 2] < 0]
    i0, i1 = rimE[np.argmin(az[rimE])], rimE[np.argmax(az[rimE])]
    t = (az[rimE] - az[i0]) / (az[i1] - az[i0] + 1e-9)
    line = el[i0] + (el[i1] - el[i0]) * t
    upS = rimE[el[rimE] >= line]; loS = rimE[el[rimE] < line]
    upS = upS[np.argsort(az[upS])]; loS = loS[np.argsort(az[loS])]
    azc = np.linspace(az[i0] + 0.02, az[i1] - 0.02, 24)
    # glatte Profile (Polynom 4. Grades über die Randecken; Lidwinkel treffen sich)
    cu = np.polyfit(np.concatenate([az[upS], az[[i0, i1]]]), np.concatenate([el[upS], el[[i0, i1]]]), 4, w=np.concatenate([np.ones(len(upS)), [4, 4]]))
    cl = np.polyfit(np.concatenate([az[loS], az[[i0, i1]]]), np.concatenate([el[loS], el[[i0, i1]]]), 4, w=np.concatenate([np.ones(len(loS)), [4, 4]]))
    up = np.interp(azc, az[upS], el[upS]); lo = np.interp(azc, az[loS], el[loS])
    k_ = np.array([1, 2, 3, 2, 1], float); k_ /= k_.sum()
    up = np.convolve(np.pad(up, 2, mode='edge'), k_, 'valid'); lo = np.convolve(np.pad(lo, 2, mode='edge'), k_, 'valid')
    up = np.maximum(up, lo + 0.02)
    return azc, up, lo, P[rimE], np.array(sorted(sock))

# Augapfel an den Lidrand anpassen: Kugel (r = 12,4 mm) knapp hinter dem Lidrand-Ring
EYE_RAD = 0.0124 * K
ecFit = []
for k, e in enumerate(ec):
    _, _, _, ring, _ = lidScan(e, eyeR_)
    # Mitte hinter dem Spalt-Schwerpunkt (x, y fest), Tiefe so, dass der Lidrand im Mittel knapp über der Kugel liegt
    c = ring.mean(0).copy()
    # nur der mittlere Teil des Rings (ohne Lidwinkel) bestimmt die Tiefe
    cen = ring[np.abs(ring[:, 0] - c[0]) < 0.009]
    lo_, hi_ = 0.0, 0.03
    for it in range(50):
        t = (lo_ + hi_) * 0.5
        dd = np.linalg.norm(cen - (c + np.array([0, 0, t])), axis=1).mean()
        if dd < EYE_RAD + 0.0008: lo_ = t
        else: hi_ = t
    c = c + np.array([0, 0, (lo_ + hi_) * 0.5])
    d = ring - c; res_ = np.linalg.norm(d, axis=1) - (EYE_RAD + 0.0008)
    c[0] = np.sign(e[0]) * abs(c[0])
    ecFit.append(c)
    print('Auge', k, 'Hilfskugel', e.round(4), '→ angepasst', c.round(4), 'Rest', round(float(np.abs(res_).mean()), 5))
# symmetrisch mitteln
cm = (np.abs(ecFit[0]) + np.abs(ecFit[1])) * 0.5 * np.array([1, 0, 0]) + (ecFit[0] + ecFit[1]) * 0.5 * np.array([0, 1, 1])
ec = np.array([cm * np.array([-1, 1, 1]), cm])
eyeShiftFit = ec - T(eyeC(B))
eyeR_ = EYE_RAD
# Augenhöhlen-Innenhaut hinter den Augapfel legen (sonst sieht man sie vor der Kugel), Lidrand bleibt
for k, e in enumerate(ec):
    _, _, _, _, sock = lidScan(e, eyeR_)
    sk = set(sock.tolist())
    rimSet = set(v for v in sock if any(n not in sk for n in _adj[v]))
    for v in sock:
        if v in rimSet:
            continue
        d = P[v] - e; r = np.linalg.norm(d)
        if r > 1e-6 and r > 0.7 * eyeR_:
            P[v] = e + d / r * 0.7 * eyeR_
lidInfo = []
for k, e in enumerate(ec):
    azc, up, lo, _, _ = lidScan(e, eyeR_)
    lidInfo.append((azc, up, lo))
    print('Auge', k, 'Lidspalt-Profile', len(azc), 'Mitte oben/unten', np.round(np.interp(0, azc, up), 3), np.round(np.interp(0, azc, lo), 3))

# ------------------------------------------------------------------ Mimik-Ziele (Verschiebungsfelder, Modellraum)
sx = np.sign(P[:, 0]); sx[sx == 0] = 1
frontW = sstep(EYE_Z + 0.0, EYE_Z - 0.03, P[:, 2])
def gauss(cx, cy, rx, ry, xabs=True):
    xx = ax if xabs else P[:, 0]
    return np.exp(-(((xx - cx) / rx) ** 2 + ((P[:, 1] - cy) / ry) ** 2))

# Ober-/Unterlippe trennen: Spaltlinie y_line(|x|) – innen scharf, seitlich weich, zum Kiefergelenk steigend
def lineY(xa):
    t = np.clip((xa - cornerX) / (0.062 - cornerX), 0, 1)
    return slitY + (TMJ[1] - 0.012 - slitY) * sstep(0, 1, t) * 1.0 + 0.0 * xa
band = 0.0012 + 0.012 * sstep(cornerX * 0.6, cornerX * 1.15, ax) + 0.01 * sstep(cornerX * 1.2, 0.06, ax)
yl = lineY(ax)
lower = sstep(band, -band, P[:, 1] - yl)
# hinter dem aufsteigenden Ast: nichts
lower *= sstep(TMJ[2] + 0.012, TMJ[2] - 0.004, P[:, 2])
# Hals unter dem Unterkiefer: Haut folgt teilweise (Abstand unter der Kieferlinie)
jawLineY = np.interp(P[:, 2], [chinFront[2] - 0.01, chinFront[2] + 0.02, TMJ[2] - 0.02, TMJ[2] + 0.01], [chinFront[1] - 0.022, chinFront[1] - 0.03, TMJ[1] - 0.065, TMJ[1] - 0.05])
below = jawLineY - P[:, 1]
lower *= 1 - 0.75 * sstep(0.0, 0.05, below)
lower[mouthIn > 0.5] = (P[mouthIn > 0.5, 1] < slitY - 0.001 - 0.25 * (P[mouthIn > 0.5, 2] - mouthFront)).astype(float) * 0.0 + sstep(0.003, -0.003, P[mouthIn > 0.5, 1] - (slitY - 0.12 * np.clip(P[mouthIn > 0.5, 2] - mouthFront, 0, 1)))
lower[nH:] = 0

def rotX(Pts, piv, a):
    c, s = math.cos(a), math.sin(a)
    d = Pts - piv
    out = Pts.copy()
    out[:, 1] = piv[1] + d[:, 1] * c + d[:, 2] * s
    out[:, 2] = piv[2] - d[:, 1] * s + d[:, 2] * c
    return out

JAW_A = 0.30
JAW_GLIDE = np.array([0.0, -0.002, -0.0045])
def jawDelta(Pts, w):
    R = rotX(Pts, TMJ, JAW_A) + JAW_GLIDE
    return (R - Pts) * w[:, None]

morph = {}
morph['jawOpen'] = jawDelta(P, lower)
upperLip = (1 - lower) * gauss(0, slitY + 0.006, cornerX * 1.1, 0.011) * frontW * (1 - mouthIn * 0.5)
lowerLip = lower * gauss(0, slitY - 0.007, cornerX * 1.1, 0.012) * frontW * (1 - mouthIn * 0.5)
lipsAll = gauss(0, slitY, cornerX * 1.25, 0.018) * frontW
cornerW = sstep(0.0, cornerX, ax) * lipsAll
cornerG = np.exp(-(((ax - cornerX) / 0.012) ** 2 + ((P[:, 1] - slitY) / 0.012) ** 2)) * frontW
D = np.zeros_like(P)
D[:, 0] = sx * 0.0065 * cornerW
D[:, 2] = 0.0035 * cornerW
D[:, 1] = 0.0012 * upperLip - 0.0012 * lowerLip
morph['lipsWide'] = D
D = np.zeros_like(P)
D[:, 0] = -P[:, 0] * 0.4 * lipsAll
D[:, 2] = -0.011 * lipsAll * (1 - 0.4 * sstep(0, cornerX, ax)) * (1 - mouthIn)
morph['lipsRound'] = D
D = np.zeros_like(P)
D[:, 1] = -0.0016 * upperLip + 0.0018 * lowerLip
D[:, 2] = 0.0016 * (upperLip + lowerLip)
morph['lipsPress'] = D
D = np.zeros_like(P)
D[:, 1] = 0.0026 * upperLip * gauss(0, slitY, cornerX * 0.8, 1.0) - 0.0032 * lowerLip * gauss(0, slitY, cornerX * 0.8, 1.0)
D[:, 2] = -0.0008 * (upperLip + lowerLip)
morph['lipsPart'] = D
D = np.zeros_like(P)
D[:, 1] = 0.0045 * lowerLip
D[:, 2] = 0.0062 * lowerLip
morph['lipTuck'] = D
morph['tongueUp'] = np.zeros_like(P)
# Lächeln: Mundwinkel hoch/zurück/außen, Wangen hoch und vor, Unterlid geschoben, Nasolabialfalte tiefer
cheek = np.exp(-(((ax - 0.036) / 0.02) ** 2 + ((P[:, 1] - (EYE_Y - 0.03)) / 0.02) ** 2)) * frontW
underEye = np.exp(-(((ax - abs(ec[1][0])) / 0.014) ** 2 + ((P[:, 1] - (EYE_Y - 0.013)) / 0.006) ** 2)) * frontW
D = np.zeros_like(P)
D[:, 0] = sx * 0.0068 * cornerG + sx * 0.002 * cornerW
D[:, 1] = 0.0095 * cornerG + 0.0022 * cornerW * (1 - lower * 0.5) + 0.0018 * lowerLip + 0.0042 * cheek + 0.0018 * underEye
D[:, 2] = 0.004 * cornerG - 0.0028 * cheek - 0.0008 * underEye
morph['smile'] = D
D = np.zeros_like(P)
chinM = np.exp(-((P[:, 0] / 0.016) ** 2 + ((P[:, 1] - (chinFront[1] + 0.006)) / 0.012) ** 2)) * frontW
D[:, 1] = -0.0055 * cornerG + 0.0025 * chinM
D[:, 2] = 0.0012 * cornerG - 0.002 * chinM
morph['frown'] = D
D = np.zeros_like(P)
sneerW = np.exp(-(((ax - 0.012) / 0.012) ** 2 + ((P[:, 1] - (slitY + 0.016)) / 0.012) ** 2)) * frontW * (1 - lower)
wing = np.exp(-(((ax - 0.016) / 0.008) ** 2 + ((P[:, 1] - (noseTip[1] - 0.004)) / 0.008) ** 2)) * frontW
D[:, 1] = 0.0045 * sneerW + 0.003 * wing
D[:, 2] = -0.0012 * sneerW - 0.001 * wing
morph['sneer'] = D
browY = EYE_Y + 0.021
bi = np.exp(-(((ax - 0.016) / 0.014) ** 2 + ((P[:, 1] - browY) / 0.014) ** 2)) * frontW
bo = np.exp(-(((ax - 0.042) / 0.018) ** 2 + ((P[:, 1] - (browY + 0.002)) / 0.014) ** 2)) * frontW
glab = np.exp(-(((ax - 0.0) / 0.012) ** 2 + ((P[:, 1] - (browY - 0.002)) / 0.012) ** 2)) * frontW
D = np.zeros_like(P)
D[:, 0] = -sx * 0.0026 * bi
D[:, 1] = -0.0058 * bi - 0.0022 * bo - 0.002 * glab
D[:, 2] = -0.0016 * bi - 0.0006 * glab
morph['browDown'] = D
D = np.zeros_like(P)
fore = sstep(browY - 0.01, browY + 0.01, P[:, 1]) * sstep(browY + 0.075, browY + 0.03, P[:, 1]) * frontW
D[:, 1] = 0.0075 * bi + 0.0012 * bo + 0.0015 * fore * sstep(0.04, 0.0, ax)
morph['browInnerUp'] = D
D = np.zeros_like(P)
D[:, 1] = 0.0068 * np.maximum(bi, bo) + 0.0025 * fore
morph['browUp'] = D

# Lider: Drehung um die Augen-Querachse (Haut gleitet über den Augapfel)
def lidMorph(kind):
    D = np.zeros_like(P)
    for k, e in enumerate(ec):
        azc, up, lo = lidInfo[k]
        d, r, el, az = eyeFrame(e)
        u = np.interp(az, azc, up); l = np.interp(az, azc, lo)
        gapA = np.maximum(u - l, 0.0)
        near = (r < eyeR_ + 0.011) & (d[:, 2] < -eyeR_ * 0.15) & (np.abs(az) < azc.max() + 0.12) & (mouthIn < 0.5)
        # seitlich über die Lidwinkel hinaus ausblenden
        near = near * sstep(azc.max() + 0.12, azc.max() - 0.05, np.abs(az - 0.0)) * sstep(azc.min() - 0.12, azc.min() + 0.05, az)
        mid_ = (u + l) * 0.5
        isUp = el > mid_
        closeAt = l + 0.2 * gapA
        if kind == 'blink':
            g = np.where(isUp, sstep(0.55, 0.08, el - u), sstep(0.35, 0.04, l - el))
            a = np.where(isUp, -(u - closeAt) * g, (closeAt - l) * g)
        elif kind == 'squint':
            g = np.where(isUp, sstep(0.4, 0.06, el - u), sstep(0.45, 0.04, l - el))
            a = np.where(isUp, -0.1 * gapA * g, 0.38 * gapA * g)
        else:  # lidWide: Oberlid hoch
            g = np.where(isUp, sstep(0.5, 0.08, el - u), sstep(0.3, 0.04, l - el) * 0.4)
            a = np.where(isUp, 0.14 * g, -0.05 * g)
        a = a * near * sstep(eyeR_ + 0.011, eyeR_ + 0.006, r)
        rho = np.hypot(d[:, 1], d[:, 2])
        ny = rho * np.sin(el + a)
        nz = -rho * np.cos(el + a)
        sel = np.abs(a) > 1e-7
        D[sel, 1] += ny[sel] - d[sel, 1]
        D[sel, 2] += nz[sel] - d[sel, 2]
    return D
morph['blink'] = lidMorph('blink')
morph['squint'] = lidMorph('squint') + np.stack([np.zeros(nV0), 0.0022 * cheek, -0.001 * cheek], 1)
morph['lidWide'] = lidMorph('lidWide')
MORPHS = ['jawOpen', 'lipsWide', 'lipsRound', 'lipsPress', 'lipsPart', 'lipTuck', 'tongueUp', 'smile', 'frown', 'sneer',
          'browDown', 'browInnerUp', 'browUp', 'blink', 'squint', 'lidWide']
for k in MORPHS:
    morph[k][nH:] = 0

# ------------------------------------------------------------------ Lippenrot (je Ecke): zwischen Spalt und Lippenrand
# Rand über das Profil an der Mittellinie (Knick der Oberlippe / Unterlippe) – Näherung über Abstand zum Spalt und Vorwölbung
lipRed = np.zeros(nV0)
upH = 0.0085 + 0.0016 * np.exp(-(((ax - 0.0065) / 0.004) ** 2)) - 0.0012 * np.exp(-((P[:, 0] / 0.003) ** 2))
upH *= 1 - sstep(cornerX * 0.45, cornerX * 1.02, ax) * 0.9
loH = 0.0105 * (1 - sstep(cornerX * 0.55, cornerX * 1.02, ax) * 0.85)
dyS = P[:, 1] - slitY
inLip = (ax < cornerX * 1.04) & frontW.astype(bool)
lipRed = np.where(dyS > 0, sstep(upH + 0.0014, upH - 0.0012, dyS), sstep(-loH - 0.0018, -loH + 0.0012, dyS)) * inLip * (P[:, 2] < mouthFront + 0.012)
lipRed = np.maximum(lipRed, mouthIn * sstep(mouthFront + 0.014, mouthFront + 0.006, P[:, 2]))
lipRed[nH:] = 0

# ------------------------------------------------------------------ Umgebungsverdeckung (Scheiben-Näherung, Bunnell)
def normals(Pts, Q):
    N = np.zeros_like(Pts)
    a, b, c, d = Pts[Q[:, 0]], Pts[Q[:, 1]], Pts[Q[:, 2]], Pts[Q[:, 3]]
    n = np.cross(c - a, d - b)
    for i in range(4):
        np.add.at(N, Q[:, i], n)
    l = np.linalg.norm(N, axis=1, keepdims=True); l[l == 0] = 1
    return N / l, np.linalg.norm(n, axis=1) * 0.5
Nrm, qa = normals(P, allQuads)
area = np.zeros(nV0)
for i in range(4):
    np.add.at(area, allQuads[:, i], qa / 4)
ao = np.zeros(nV0)
CH = 512
for s0 in range(0, nV0, CH):
    p = P[s0:s0 + CH][:, None, :]
    n = Nrm[s0:s0 + CH][:, None, :]
    v = P[None, :, :] - p
    d2 = (v ** 2).sum(-1) + 1e-9
    dd = np.sqrt(d2)
    vn = v / dd[..., None]
    cosE = np.clip((vn * Nrm[None]).sum(-1) * -1, 0, 1)   # Emitter zeigt zum Empfänger
    cosR = np.clip((vn * n).sum(-1), 0, 1)
    occ = area[None] * cosE * cosR / (np.pi * d2 + area[None])
    occ[dd < 1e-6] = 0
    ao[s0:s0 + CH] = occ.sum(-1)
ao = np.clip(1 - ao * 0.9, 0, 1)
# zweiter Durchgang (Bunnell: Überverdeckung mildern)
ao = np.clip(ao, 0.08, 1) ** 0.85
ao[mouthIn > 0.5] = np.minimum(ao[mouthIn > 0.5], 0.35 + 0.65 * sstep(mouthFront + 0.02, mouthFront + 0.004, P[mouthIn > 0.5, 2]))
print('AO min/mittel', round(float(ao.min()), 3), round(float(ao.mean()), 3))

# ------------------------------------------------------------------ Form-Ziele (Kopf-Ausschnitt, Modellraum)
def sub(d):
    return TD(d[srcOf])

SHAPE = {}
def add(name, files, w=None):
    d = np.zeros_like(V)
    for i, f in enumerate(files):
        d += tg(f) * (w[i] if w else 1.0)
    SHAPE[name] = sub(d)

add('old', ['macrodetails/caucasian-male-old']); SHAPE['old'] -= sub(CMY)
add('african', ['macrodetails/african-male-young']); SHAPE['african'] -= sub(CMY)
add('africanOld', ['macrodetails/african-male-old']); SHAPE['africanOld'] -= sub(CMY)
add('asian', ['macrodetails/asian-male-young']); SHAPE['asian'] -= sub(CMY)
add('asianOld', ['macrodetails/asian-male-old']); SHAPE['asianOld'] -= sub(CMY)
add('muscle', ['macrodetails/universal-male-young-maxmuscle-averageweight'])
add('heavy', ['macrodetails/universal-male-young-averagemuscle-maxweight'])
add('lean', ['macrodetails/universal-male-young-averagemuscle-minweight'])
def pair(name, pos, neg, wp=None, wn=None):
    add(name + '+', pos, wp); add(name + '-', neg, wn)
pair('jaw', ['chin/chin-bones-incr', 'chin/chin-width-incr', 'head/head-square'], ['chin/chin-bones-decr', 'chin/chin-width-decr', 'head/head-oval'], [1, 0.6, 0.5], [1, 0.6, 0.5])
pair('chin', ['chin/chin-prominent-incr', 'chin/chin-height-incr'], ['chin/chin-prominent-decr', 'chin/chin-height-decr'], [1, 0.5], [1, 0.5])
pair('nose', ['nose/nose-scale-vert-incr', 'nose/nose-hump-incr', 'nose/nose-trans-forward'], ['nose/nose-scale-vert-decr', 'nose/nose-hump-decr', 'nose/nose-curve-concave'], [0.7, 0.8, 0.4], [0.6, 0.6, 0.3])
pair('noseW', ['nose/nose-scale-horiz-incr', 'nose/nose-flaring-incr', 'nose/nose-point-width-incr'], ['nose/nose-scale-horiz-decr', 'nose/nose-flaring-decr', 'nose/nose-point-width-decr'], [0.7, 0.6, 0.6], [0.7, 0.6, 0.6])
pair('brow', ['eyebrows/eyebrows-trans-forward', 'forehead/forehead-trans-backward'], ['eyebrows/eyebrows-trans-backward', 'forehead/forehead-trans-forward'], [1, 0.4], [1, 0.4])
pair('cheek', ['cheek/l-cheek-bones-incr', 'cheek/r-cheek-bones-incr', 'cheek/l-cheek-inner-decr', 'cheek/r-cheek-inner-decr'], ['cheek/l-cheek-bones-decr', 'cheek/r-cheek-bones-decr', 'cheek/l-cheek-volume-incr', 'cheek/r-cheek-volume-incr'], [1, 1, 0.5, 0.5], [1, 1, 0.5, 0.5])
pair('lips', ['mouth/mouth-upperlip-volume-incr', 'mouth/mouth-lowerlip-volume-incr'], ['mouth/mouth-upperlip-volume-decr', 'mouth/mouth-lowerlip-volume-decr'], [1, 1], [1, 1])
pair('mouthW', ['mouth/mouth-scale-horiz-incr'], ['mouth/mouth-scale-horiz-decr'])
pair('skull', ['head/head-scale-horiz-incr', 'head/head-rectangular'], ['head/head-scale-horiz-decr', 'head/head-oval'], [0.6, 0.5], [0.6, 0.3])
pair('eyes', ['eyes/l-eye-scale-incr', 'eyes/r-eye-scale-incr'], ['eyes/l-eye-scale-decr', 'eyes/r-eye-scale-decr'])
pair('neck', ['neck/neck-scale-horiz-incr'], ['neck/neck-scale-horiz-decr'])
pair('bags', ['eyes/l-eye-bag-incr', 'eyes/r-eye-bag-incr'], ['eyes/l-eye-bag-decr', 'eyes/r-eye-bag-decr'])
pair('laugh', ['mouth/mouth-laugh-lines-out'], ['mouth/mouth-laugh-lines-in'])
pair('fat', ['head/head-fat-incr'], ['head/head-fat-decr'])
pair('prog', ['chin/chin-prognathism-incr'], ['chin/chin-prognathism-decr'])
pair('angles', ['mouth/mouth-angles-up'], ['mouth/mouth-angles-down'])
add('cleft', ['chin/chin-cleft-incr'])
# Asymmetrie: nur eine Seite (Figur-links) – Wange, Auge, Mundwinkel
add('asymL', ['cheek/l-cheek-bones-incr', 'eyes/l-eye-bag-incr', 'mouth/mouth-angles-up'], [0.5, 0.4, 0.0])
add('asymR', ['cheek/r-cheek-volume-incr', 'eyes/r-eye-scale-decr'], [0.4, 0.4])
# weiblich (zuletzt angehängt → Puffer der älteren Ziele behalten ihre Lage)
add('female', ['macrodetails/caucasian-female-young']); SHAPE['female'] -= sub(CMY)
# Verankern: Makro-Ziele verschieben den ganzen Kopf (Körpergröße ändert sich) – Kopf bleibt am Skelett: Verschiebung
# der Augenpartie (Kopf) bzw. des Halsrings (unten) abziehen, weich über die Halshöhe überblendet
ringSet = np.concatenate([ringIdx, nH + np.arange(nR), nH + nR + np.arange(nR)])
lidIdx = []
for k, e in enumerate(ec):
    d = P - e; r = np.linalg.norm(d, axis=1)
    lidIdx.append(np.where((r < eyeR_ + 0.004) & (r > eyeR_ - 0.001) & (d[:, 2] < -eyeR_ * 0.4) & (mouthIn < 0.5))[0])
eyeZone = np.where((np.abs(P[:, 1] - EYE_Y) < 0.03) & (P[:, 2] < EYE_Z) & (ax < 0.06))[0]
wy = sstep(P[ringIdx, 1].mean() + 0.005, EYE_Y - 0.06, P[:, 1])
EYED = {}
for name in list(SHAPE.keys()):
    D = SHAPE[name]
    te = D[eyeZone].mean(0)
    tr = D[ring].mean(0) if False else D[ringIdx].mean(0)
    if name in ('old', 'african', 'africanOld', 'asian', 'asianOld', 'muscle', 'heavy', 'lean', 'female'):
        D = D - (te[None, :] * wy[:, None] + tr[None, :] * (1 - wy[:, None]))
    SHAPE[name] = D
    EYED[name] = np.array([D[lidIdx[0]].mean(0), D[lidIdx[1]].mean(0)])
    EYED[name][:, 0] = 0.0 if name not in ('asymL', 'asymR') else EYED[name][:, 0]
    mx = np.abs(D[:nH]).max()
    if mx > 0.004 or np.abs(te).max() > 0.002:
        print('Ziel', name, 'Kopf-Verschiebung', (te * 1000).round(1), 'mm; Rest max', round(float(mx) * 1000, 1), 'mm; Augen', (EYED[name] * 1000).round(1).tolist())

# ------------------------------------------------------------------ Schreiben
blobs = []
offset = 0
meta = {}
def put(name, arr):
    global offset
    b = arr.tobytes()
    pad = (-len(b)) % 4
    blobs.append(b + b'\0' * pad)
    meta[name] = [offset, arr.dtype.str, list(arr.shape)]
    offset += len(b) + pad

put('pos', pos.astype(np.float32))
put('quads', allQuads.astype(np.uint16))
put('uv', UVall.astype(np.float32))
put('quadsUV', allUVq.astype(np.uint16))
put('ao', np.round(ao * 255).astype(np.uint8))
mask = np.stack([lipRed, mouthIn, eyeIn, ear], 1)
put('mask', np.round(np.clip(mask, 0, 1) * 255).astype(np.uint8))
QS = 1e-5
def putSparse(prefix, name, D):
    nz = np.where(np.abs(D).max(1) > 2e-6)[0]
    put(prefix + name + ':i', nz.astype(np.uint16))
    put(prefix + name + ':d', np.clip(np.round(D[nz] / QS), -32767, 32767).astype(np.int16))
    return len(nz)
counts = {}
for k in MORPHS:
    counts['m:' + k] = putSparse('m:', k, morph[k])
for k in SHAPE:
    counts['s:' + k] = putSparse('s:', k, SHAPE[k])

land = {
    'eyeL': ec[0].round(5).tolist(), 'eyeR': ec[1].round(5).tolist(), 'eyeRadius': round(eyeR_, 5),
    'slitY': round(slitY, 5), 'mouthFront': round(mouthFront, 5), 'cornerX': round(cornerX, 5),
    'noseTip': noseTip.round(5).tolist(), 'chin': chinFront.round(5).tolist(), 'tmj': TMJ.round(5).tolist(),
    'jawAngle': JAW_A, 'jawGlide': JAW_GLIDE.tolist(), 'browY': browY,
    'eyeShift': {k: v.round(5).tolist() for k, v in EYED.items()},
    'lids': [[np.round(a_, 4).tolist(), np.round(u_, 4).tolist(), np.round(l_, 4).tolist()] for a_, u_, l_ in lidInfo],
}
info = {
    'quelle': 'MakeHuman hm08 base.obj + targets (makehumancommunity/makehuman, Assets CC0 1.0 seit 09/2020)',
    'lizenz': 'CC0 1.0', 'nHead': int(nH), 'nV': int(nV0), 'nQ': int(len(allQuads)), 'nUV': int(len(UVall)),
    'ring': int(nR), 'qScale': QS, 'morphs': MORPHS, 'shapes': list(SHAPE.keys()), 'buf': meta, 'counts': counts,
    'land': land, 'texAspect': 2, 'bytes': offset,
}
with open(os.path.join(OUT, 'kopf.bin'), 'wb') as f:
    for b in blobs:
        f.write(b)
with open(os.path.join(OUT, 'kopf.json'), 'w') as f:
    json.dump(info, f, separators=(',', ':'))
print('geschrieben', offset, 'Bytes;', 'Ecken', nV0, 'Vierecke', len(allQuads), 'UV', len(UVall))
print({k: v for k, v in counts.items()})
