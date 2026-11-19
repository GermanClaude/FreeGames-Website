# NULLPUNKT – Ego-Handschuhnetz (hands-v4) aus der Hand des MakeHuman-Grundnetzes hm08 (CC0, siehe ../mh/mhlib.py).
#
# Erzeugt assets/js/game/weapons/gunsmith/glove-mesh.js (Format wie hands-v3, + Hautmaske für offene Fingerkuppen):
#   1. Hand + 7 cm Unterarm aus dem Grundnetz (Mann, jung, etwas Muskel) ausschneiden – echte Anatomie: Knöchel, Sehnen-
#      fächer auf dem Handrücken, Daumen-/Kleinfingerballen, Fingerkuppen mit Nagelbett, Gelenkfalten.
#   2. Auf das Hand-Rig (handdims.js: Fingerlängen/-radien, Bindehaltung) umzielen: je Knochen eine Abbildung
#      MakeHuman-Gliedrahmen → Rig-Gliedrahmen (Länge/Querschnitt skaliert), weich über die Gelenke gemischt
#      (Hautgewichte = dieselben Gewichte). So passen Griffposen/Kontaktlöser (Kapseln) unverändert.
#   3. Handschuh: Stoffdicke je Zone, Knöchelpolster + Fingerpolster (erhaben, mit Kante), Klettbündchen mit Wulst,
#      nach innen umgeschlagener Saum (keine offene Röhre), leichte Stauchfalten über den Fingergelenken.
#   4. Catmull-Clark (high) bzw. Kantenkollaps (low ≤ 1500 Dreiecke), Masken + Umgebungsverdeckung, quantisiert.
#
# Nutzung: MH_DIR=<ordner mit base.obj und t/> python3 -I tools/assets/hands/build_hand.py
import os, sys, json, subprocess, math
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(HERE, '..', 'mh'))
from mhlib import MH, smoothstep, vertex_normals, tri_normals, catmull_clark, b64  # noqa: E402
from qem import decimate  # noqa: E402

GS = os.path.join(ROOT, 'assets', 'js', 'game', 'weapons', 'gunsmith')
OUT = os.path.join(GS, 'glove-mesh.js')

# ------------------------------------------------------------------ Rig-Maße (handdims.js, über Node gelesen)
dims = json.loads(subprocess.check_output(['node', '-e', "import('./handdims.js').then(m=>console.log(JSON.stringify({F:m.FINGERS,T:m.THUMB,TR:m.THUMB_REST,BS:m.BIND_SPLAY,BC:m.BIND_CURL,BT:m.BIND_THUMB_FLEX,key:m.handDimsKey()})))"], cwd=GS))
FING, THUMB = dims['F'], dims['T']


def rx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def basis(F, B):
    z = -np.array(F, float); z /= np.linalg.norm(z)
    y = np.array(B, float); y -= z * (y @ z); y /= np.linalg.norm(y)
    x = np.cross(y, z)
    return np.stack([x, y, z], 1)


# Ziel-Bindeskelett: je Kette Gelenkpositionen p[0..3] und Gliedrahmen R[0..2] (Spalten = lokale Achsen)
def target_chains():
    ch = []
    for i, f in enumerate(FING):
        R = rx(-dims['BC'][i][0]) @ ry(dims['BS'][i])
        p = [np.array([f['x'], f['y'], f['z']])]
        Rs = []
        for s in range(3):
            if s > 0:
                R = R @ rx(-dims['BC'][i][s])
            Rs.append(R.copy())
            p.append(p[-1] + R @ np.array([0, 0, -f['len'][s]]))
        ch.append({'p': p, 'R': Rs, 'len': f['len'], 'r': f['r']})
    R = basis(dims['TR']['F'], dims['TR']['B'])
    p = [np.array(THUMB['base'])]
    Rs = []
    for s in range(3):
        if s > 0:
            R = R @ rx(-dims['BT'][s - 1])
        Rs.append(R.copy())
        p.append(p[-1] + R @ np.array([0, 0, -THUMB['len'][s]]))
    ch.append({'p': p, 'R': Rs, 'len': THUMB['len'], 'r': THUMB['r']})
    return ch


TG = target_chains()   # 0..3 Finger (Zeige- bis Kleinfinger), 4 Daumen
# Knochenindex: 0 Hand, 1 + 3i + s Finger, 13 + s Daumen, 16 Unterarm
BONE = lambda c, s: 13 + s if c == 4 else 1 + 3 * c + s  # noqa: E731

# ------------------------------------------------------------------ Quelle: MakeHuman-Hand
mh = MH()
P = mh.shape({'macrodetails/caucasian-male-young': 1.0, 'macrodetails/universal-male-young-maxmuscle-averageweight': 0.35})
Q = mh.body_faces()
W = mh.joint(P, 'r-hand')
EL = mh.joint(P, 'r-elbow')
mcp = [mh.joint(P, f'r-finger-{f}-1') for f in range(2, 6)]
D = np.mean(mcp, 0) - W; D /= np.linalg.norm(D)
Lx = mcp[0] - mcp[3]; Lx -= D * (Lx @ D); Lx /= np.linalg.norm(Lx)
Xr, Zr = -Lx, -D
Yr = np.cross(Zr, Xr)
RS = np.stack([Xr, Yr, Zr])          # Welt (MH) → Handraum der Quelle


def to_src(p):
    return (np.asarray(p) - W) @ RS.T * 0.1


S_FORE = 0.075     # Unterarm-Stück bis 7,5 cm hinter dem Handgelenk (Quelle)
cen = to_src(P[Q].mean(1))
fa = to_src(EL)
fa /= np.linalg.norm(fa)
sel = (cen @ fa < S_FORE) & (to_src(P[Q])[:, :, 0].max(1) < 0.2) & (P[Q][:, :, 0].max(1) < -2.5)
Qh = Q[sel]
used = np.unique(Qh)
remap = -np.ones(len(P), int); remap[used] = np.arange(len(used))
Qh = remap[Qh]
PS = to_src(P[used])                # Quellpositionen (m, Handraum)
NS = vertex_normals(PS, Qh)

# Quellketten
SRC = []
for c in range(5):
    f = c + 2 if c < 4 else 1
    J = [to_src(mh.joint(P, f'r-finger-{f}-{k}')) for k in range(1, 5)]
    SRC.append(J)


def chain_frames(J, dorsal_hint, pure=False):
    """Gliedrahmen der Quelle: z = −Gliedrichtung, y = Rücken (von der Krümmung weg, zur Hand-Rückseite), x = y × z."""
    Rs = []
    chord = J[3] - J[0]; chord /= np.linalg.norm(chord)
    mid = (J[1] + J[2]) * 0.5 - J[0]
    off = mid - chord * (mid @ chord)
    con = off / (np.linalg.norm(off) + 1e-9)          # zur Krümmungsmitte (Handfläche)
    up = dorsal_hint if pure else -con * 0.6 + dorsal_hint * 0.4
    for s in range(3):
        z = -(J[s + 1] - J[s]); z /= np.linalg.norm(z)
        y = up - z * (up @ z); y /= np.linalg.norm(y)
        Rs.append(np.stack([np.cross(y, z), y, z], 1))
    return Rs




def thumb_nail_dir():
    """Daumennagel-Richtung der Quelle: schmale Querachse des Endglieds (Nagel/Ballen), zur Handaußenseite (−x)."""
    J = SRC[4]
    ax = (J[3] - J[2]) / np.linalg.norm(J[3] - J[2])
    rel = PS - J[2]
    t = rel @ ax / np.linalg.norm(J[3] - J[2])
    rad = rel - np.outer(rel @ ax, ax)
    m = (np.linalg.norm(rad, axis=1) < 0.012) & (t > 0.3) & (t < 0.7)
    w, v = np.linalg.eigh(rad[m].T @ rad[m])
    thin = v[:, 1]
    return thin if thin[0] < 0 else -thin


SRC_R = [chain_frames(SRC[c], np.array([0, 1.0, 0])) for c in range(4)] + [chain_frames(SRC[4], thumb_nail_dir(), True)]

# ------------------------------------------------------------------ Gewichte (Quellraum)


def seg_param(p, a, b):
    ab = b - a
    t = ((p - a) @ ab) / (ab @ ab)
    q = a + np.clip(t, 0, 1)[:, None] * ab
    return t, np.linalg.norm(p - q, axis=1)


def chain_weights(p, c):
    """→ (Abstand zur Kette, Gewichte [Hand, Glied0, Glied1, Glied2], Gliedparameter des distalen Glieds)."""
    J = SRC[c]
    d = np.full(len(p), np.inf)
    for s in range(3):
        _, ds = seg_param(p, J[s], J[s + 1])
        d = np.minimum(d, ds)
    # axialer Abstand zu den Gelenken (positiv = distal)
    e = []
    for s in range(3):
        ax = J[s + 1] - J[s]; ax /= np.linalg.norm(ax)
        e.append((p - J[s]) @ ax)
    h = [0.011 if c < 4 else 0.016, 0.0055, 0.005]
    cc = [smoothstep(-h[k], h[k], e[k]) for k in range(3)]
    w = np.stack([1 - cc[0], cc[0] - cc[1], cc[1] - cc[2], cc[2]], 1)
    w = np.clip(w, 0, 1)
    return d, w, e[0]


def weights(p):
    n = len(p)
    D_, Wc, E0 = [], [], []
    for c in range(5):
        d, w, e0 = chain_weights(p, c)
        D_.append(d); Wc.append(w); E0.append(e0)
    D_ = np.stack(D_, 1)
    order = np.argsort(D_, 1)
    out = np.zeros((n, 17))
    for i in range(n):
        c1, c2 = order[i, 0], order[i, 1]
        # Ketten nur, wenn der Punkt nicht weit vor dem Grundgelenk liegt (sonst Handfläche)
        lim = -0.03 if c1 == 4 else -0.012
        if E0[c1][i] < lim:
            out[i, 0] = 1
            continue
        mix = smoothstep(0.0, 0.0035, D_[i, c2] - D_[i, c1]) * 0.5 + 0.5   # Schwimmhaut: zwei Finger mischen
        if E0[c2][i] < (-0.03 if c2 == 4 else -0.012):
            mix = 1.0
        for c, k in ((c1, mix), (c2, 1 - mix)):
            if k <= 0:
                continue
            w = Wc[c][i]
            out[i, 0] += w[0] * k
            for s in range(3):
                out[i, BONE(c, s)] += w[s + 1] * k
    return out


WS = weights(PS)

# Natürliche Haltung der Quelle im Pose-Format des Rigs (→ Bindehaltung in handdims.js: dann bildet die Umzielung die
# Glieder nur noch ab, ohne sie zu drehen – keine Falten an Knöcheln/Daumenballen). Ausgabe zum Abgleich.
def natural_pose():
    res = {'splay': [], 'curl': []}
    for c in range(4):
        J = SRC[c]
        d0 = (J[1] - J[0]) / np.linalg.norm(J[1] - J[0])
        s = math.asin(-d0[0]); c0 = math.atan2(-d0[1], -d0[2])
        R = rx(-c0) @ ry(s)
        cur = [c0]
        for k in (1, 2):
            dk = (J[k + 1] - J[k]) / np.linalg.norm(J[k + 1] - J[k])
            dl = R.T @ dk
            ck = math.atan2(-dl[1], -dl[2])
            cur.append(ck)
            R = R @ rx(-ck)
        res['splay'].append(round(s, 3)); res['curl'].append([round(x, 3) for x in cur])
    J = SRC[4]
    F = (J[1] - J[0]) / np.linalg.norm(J[1] - J[0])
    Bv = SRC_R[4][0][:, 1]
    R = basis(F, Bv)
    fl = []
    for k in (1, 2):
        dk = (J[k + 1] - J[k]) / np.linalg.norm(J[k + 1] - J[k])
        dl = R.T @ dk
        ck = math.atan2(-dl[1], -dl[2]); fl.append(round(ck, 3))
        R = R @ rx(-ck)
    res['thumbF'] = [round(x, 3) for x in F]; res['thumbB'] = [round(x, 3) for x in Bv]; res['thumbFlex'] = fl
    return res


NAT = natural_pose()
print('Natürliche Haltung (für handdims.js):', json.dumps(NAT))
# Quellrahmen in derselben Konvention wie das Rig (Euler-Kette bzw. Daumenbasis + Beugungen) → Abbildung = reine Skalierung
for c in range(4):
    R = rx(-NAT['curl'][c][0]) @ ry(NAT['splay'][c])
    fr = []
    for k in range(3):
        if k:
            R = R @ rx(-NAT['curl'][c][k])
        fr.append(R.copy())
    SRC_R[c] = fr
R = basis(NAT['thumbF'], NAT['thumbB'])
fr = [R.copy()]
for k in range(2):
    R = R @ rx(-NAT['thumbFlex'][k]); fr.append(R.copy())
SRC_R[4] = fr
if os.environ.get('HAND_NAT_ONLY'):
    sys.exit(0)


# ------------------------------------------------------------------ Abbildungen Quelle → Ziel
Z_WRIST = 0.022   # Handgelenk der Quelle (Gelenkmitte) liegt 1,4 cm hinter dem Rig-Ursprung (Handwurzel)
src_land = np.array([[0, 0, 0]] + [SRC[c][0] for c in range(4)] + [SRC[4][0]])
tgt_land = np.array([[0, -0.001, Z_WRIST]] + [TG[c]['p'][0] for c in range(4)] + [TG[4]['p'][0]])
A = np.zeros((4, 4)); A[3, 3] = 1
sc = []
for k in (0, 2):
    M = np.stack([src_land[:, k], np.ones(len(src_land))], 1)
    s_, t_ = np.linalg.lstsq(M, tgt_land[:, k], rcond=None)[0]
    A[k, k] = s_; A[k, 3] = t_; sc.append(s_)
A[1, 1] = (sc[0] + sc[1]) * 0.5 * 1.04
A[1, 3] = np.mean(tgt_land[:, 1] - A[1, 1] * src_land[:, 1])
PALM = A
RES = tgt_land - (src_land @ A[:3, :3].T + A[:3, 3])
print('Restfehler Handflächen-Abbildung (mm):', np.round(np.linalg.norm(RES, axis=1) * 1000, 1))
print('Handfläche: Maßstab x %.3f y %.3f z %.3f' % (A[0, 0], A[1, 1], A[2, 2]))


def frame_map(Rs, ps, Rt, pt, sz, sr, sz0, sr0, h=0.004):
    """Quelle (Rahmen Rs, Ursprung ps) → Ziel (Rt, pt). Längs: Steigung sz0 vor dem Gelenk (wie das Elternglied), sz
    dahinter, weich übergeblendet (h) – sonst falten sich die Mischzonen, wo Glieder unterschiedlich gestreckt werden.
    Quer ebenso sr0 → sr."""
    def f(p):
        l = (p - ps) @ Rs                      # lokale Koordinaten (Spalten von Rs = Achsen)
        a = -l[:, 2]
        sp = h * np.logaddexp(0, a / h)        # weiches max(a, 0)
        sg = 1 / (1 + np.exp(-a / h))
        a2 = sz0 * a + (sz - sz0) * sp
        rs = sr0 + (sr - sr0) * sg
        q = np.stack([l[:, 0] * rs, l[:, 1] * rs, -a2], 1)
        return pt + q @ Rt.T
    return f


def affine_map(M):
    # + weiche Korrektur an den Stützpunkten (Grundgelenke, Daumenwurzel, Handgelenk liegen exakt auf dem Rig)
    def f(p):
        q = p @ M[:3, :3].T + M[:3, 3]
        for L, r in zip(src_land, RES):
            q += np.exp(-np.sum((p - L) ** 2, 1) / (2 * 0.014 ** 2))[:, None] * r
        return q
    return f


MAPS = [None] * 17
MAPS[0] = affine_map(PALM)
MAPS[16] = MAPS[0]
GLOVE_T = {'finger': 0.0009}
# nächste Kette je Ecke (Querschnittsmessung ohne Nachbarfinger/Schwimmhaut)
NEAR = np.argmin(np.stack([chain_weights(PS, c)[0] for c in range(5)], 1), 1)
RIG_R = []   # sichtbare Radien der Glieder nach der Umzielung (→ Kapselradien r = sichtbar / 1,04 in handdims.js)
for c in range(5):
    J, Rs = SRC[c], SRC_R[c]
    T = TG[c]
    # Querschnitt je Glied: Median-Abstand der Ecken in der Gliedmitte (30–70 %) von der Achse
    rr = []
    for s in range(3):
        Ls = np.linalg.norm(J[s + 1] - J[s]); ax = (J[s + 1] - J[s]) / Ls
        rel = PS - J[s]; tt = rel @ ax / Ls
        rad = np.linalg.norm(rel - np.outer(rel @ ax, ax), axis=1)
        lo_, hi_ = ((0.62, 0.78), (0.4, 0.6), (0.3, 0.5))[s]
        m = (tt > lo_) & (tt < hi_) & (rad < 0.016) & (NEAR == c)
        rr.append(float(np.mean(rad[m])) if m.sum() > 3 else float('nan'))
    # ein Querschnitts-Maßstab je Finger (natürliche Verjüngung der Quelle bleibt), Grundglied = Rig-Kapsel
    # Verjüngung der Quelle (gemittelt über die Finger: Mittel-/Endglied ≈ 0,82/0,59 des Grundglieds) leicht
    # zurücknehmen (Handschuh polstert die Kuppen auf) → Maßstab je Glied [1, 1,06, 1,2] × Grundglied-Maßstab
    want0 = T['r'][0] * 1.04 - GLOVE_T['finger']
    if c < 4:
        r0 = rr[0]
        model = [r0, r0 * 0.82, r0 * 0.59]
        srl = [want0 / r0 * k for k in (1.0, 1.06, 1.2)]
    else:
        r0 = rr[1]
        model = [r0 * 1.25, r0, r0 * 0.8]
        srl = [PALM[0, 0] * 0.97, (T['r'][1] * 1.04 - GLOVE_T['finger']) / r0, (T['r'][1] * 1.04 - GLOVE_T['finger']) / r0 * 1.08]
    RIG_R.append([round((srl[k] * model[k] + GLOVE_T['finger']) / 1.04, 4) for k in range(3)])
    for s in range(3):
        b = BONE(c, s)
        Ls = np.linalg.norm(J[s + 1] - J[s])
        Lt = T['len'][s] + (0.55 * T['r'][2] if s == 2 else 0)
        srs = srl[s]
        if s == 0:
            sz0, sr0 = PALM[2, 2], PALM[0, 0]
        else:
            Lp = np.linalg.norm(J[s] - J[s - 1])
            sz0, sr0 = T['len'][s - 1] / Lp, srl[s - 1]
        MAPS[b] = frame_map(Rs[s], J[s], T['R'][s], T['p'][s], Lt / Ls, srs, sz0, sr0, 0.006 if s == 0 else 0.003)
        print('Kette %d Glied %d: Länge %.3f (×%.2f), Radius %.4f → %.4f (×%.2f)' % (c, s, Lt, Lt / Ls, model[s], model[s] * srs, srs))
print('Kapselradien passend zum Netz (handdims.js r):', json.dumps(RIG_R))

# Gemischte Abbildung je Ecke (lineare Mischung der Matrizen, wie Hautverformung)


def apply_maps(p, w):
    out = np.zeros_like(p)
    for b in range(17):
        m = w[:, b] > 0
        if m.any():
            out[m] += w[m, b:b + 1] * MAPS[b](p[m])
    return out


PT = apply_maps(PS, WS)
WT = WS.copy()

# Unterarm im Ärmel: Querschnitt hinter dem Handgelenk auf die Ärmelöffnung begrenzen (Ellipse 2,55 × 1,95 cm Halbachsen
# + Handschuh), sonst sticht der kräftige MakeHuman-Unterarm (Beugermuskeln) innen durch den Ärmelsaum
cy_ = -0.0015
e_ = np.hypot(PT[:, 0] / 0.0255, (PT[:, 1] - cy_) / 0.0195)
k_ = smoothstep(0.012, 0.03, PT[:, 2])
f_ = np.where(e_ > 1, 1 / e_, 1.0) * k_ + (1 - k_)
PT[:, 0] *= f_
PT[:, 1] = cy_ + (PT[:, 1] - cy_) * f_

# Unterarm-Knochen: hinter dem Handgelenk folgt das Bündchen dem Ärmel
fore = smoothstep(-0.004, 0.026, PT[:, 2])
WT[:, 16] = WT[:, 0] * fore
WT[:, 0] *= 1 - fore

# Ausschnitt-Rand (offenes Ende am Unterarm) finden
from collections import Counter  # noqa: E402
ec = Counter()
for q in Qh:
    for i in range(4):
        a, b = q[i], q[(i + 1) % 4]
        ec[(min(a, b), max(a, b))] += 1
bedges = [e for e, n in ec.items() if n == 1]
print('Randkanten', len(bedges))
# Rand zu einer Schleife ordnen (Richtung aus den Flächen)
dir_e = {}
for q in Qh:
    for i in range(4):
        a, b = q[i], q[(i + 1) % 4]
        if ec[(min(a, b), max(a, b))] == 1:
            dir_e[a] = b
start = next(iter(dir_e))
loop = [start]
while True:
    nx = dir_e[loop[-1]]
    if nx == start:
        break
    loop.append(nx)
    if len(loop) > 1000:
        raise SystemExit('Randschleife nicht geschlossen')
print('Randschleife', len(loop), 'Ecken, z %.3f..%.3f' % (PT[loop, 2].min(), PT[loop, 2].max()))

# ------------------------------------------------------------------ Glätten der Umzielung (Spannungen an den Gelenken)
NT = vertex_normals(PT, Qh)
nb = [set() for _ in range(len(PT))]
for q in Qh:
    for i in range(4):
        nb[q[i]].add(q[(i + 1) % 4]); nb[q[i]].add(q[(i + 3) % 4])
nb = [np.array(sorted(s)) for s in nb]
isb = np.zeros(len(PT), bool); isb[loop] = True


def laplace(X, lam, it, mask=None):
    for _ in range(it):
        avg = np.array([X[n].mean(0) for n in nb])
        d = avg - X
        if mask is not None:
            d *= mask[:, None]
        X = X + lam * d
    return X


# Verformungsfeld glätten (nicht die Form): Δ = Ziel − Handflächen-Abbildung der Quelle. Wo die Glied-Abbildungen
# (Fingerglieder gestreckt/schlanker, Daumen gedreht) in die Handfläche übergehen, entstehen sonst Falten an Knöcheln,
# Schwimmhäuten und Daumenballen; das geglättete Feld verteilt den Übergang, Details (Knöchel, Sehnen) bleiben aus PS.
PP = (np.concatenate([PS, np.ones((len(PS), 1))], 1) @ PALM.T)[:, :3]
DL = PT - PP
wp = WS[:, 0]
zone = np.clip(4 * wp * (1 - wp) * 1.4, 0, 1)                      # Übergang Handfläche ↔ Grundglieder/Daumen
zone = np.maximum(zone, 0.6 * np.exp(-np.sum(((PT - TG[4]['p'][0]) / np.array([0.02, 0.02, 0.025])) ** 2, 1)))
zone *= (~isb)
for _ in range(20):
    avg = np.array([DL[nn].mean(0) for nn in nb])
    DL += 0.6 * (avg - DL) * zone[:, None]
PT = PP + DL
# ------------------------------------------------------------------ Glied-Lokalkoordinaten im Ziel (für Masken/Polster)
main = np.argmax(WT[:, :16], 1)
NT = vertex_normals(PT, Qh)


def bone_local(b):
    if b == 0 or b == 16:
        return np.eye(3), np.zeros(3), None
    c = 4 if b >= 13 else (b - 1) // 3
    s = b - 13 if b >= 13 else (b - 1) % 3
    return TG[c]['R'][s], TG[c]['p'][s], (c, s)


LOC = np.zeros_like(PT)      # Position im Gliedrahmen
LN = np.zeros_like(PT)       # Normale im Gliedrahmen
TT = np.zeros(len(PT))       # Gliedparameter 0..1 (+ über Kuppe)
CH = -np.ones(len(PT), int)  # Kette
SG = -np.ones(len(PT), int)  # Glied
for i in range(len(PT)):
    R, o, cs = bone_local(main[i])
    LOC[i] = R.T @ (PT[i] - o)
    LN[i] = R.T @ NT[i]
    if cs:
        CH[i], SG[i] = cs
        TT[i] = -LOC[i, 2] / TG[cs[0]]['len'][cs[1]]

# ------------------------------------------------------------------ Masken (stetige Felder, Naht = Isolinie 0,5)
n = len(PT)
hx, hy, hz = PT[:, 0], PT[:, 1], PT[:, 2]
palmside = np.where(CH >= 0, -LN[:, 1], -NT[:, 1])
leather = np.clip(0.5 + (palmside - 0.18) * 2.2, 0, 1)
# Kuppenkappen (Leder rundum) an den Endgliedern ab 55 %
cap = np.where(SG == 2, smoothstep(0.42, 0.62, TT), 0)
leather = np.maximum(leather, np.clip(0.5 + (cap - 0.5) * 1.6, 0, 1))
# Daumen innen ganz Leder (Griffzone)
leather = np.where(CH == 4, np.maximum(leather, np.clip(0.5 + (-LN[:, 0] * 1.0 - LN[:, 1] - 0.1) * 2, 0, 1)), leather)
# Handfläche: Leder bis zum Bündchen
leather = np.where(hz > -0.002, leather * (1 - smoothstep(-0.002, 0.004, hz)), leather)


def rrect(x, z, cx, cz, hw, hl, r):
    qx = np.abs(x - cx) - hw + r
    qz = np.abs(z - cz) - hl + r
    return np.hypot(np.maximum(qx, 0), np.maximum(qz, 0)) + np.minimum(np.maximum(qx, qz), 0) - r


# Knöchelpolster: gewölbter Riegel über den Grundgelenken (Handrücken), segmentiert je Finger
dorsal = NT[:, 1]
kx = np.array([TG[c]['p'][0][0] for c in range(4)])
kz = np.array([TG[c]['p'][0][2] for c in range(4)])
padd = np.full(n, 1.0)
for c in range(4):
    d = rrect(hx, hz, kx[c] + (0.002 if c == 3 else 0), kz[c] + 0.004, 0.0088 if c < 3 else 0.0078, 0.0115, 0.004)
    padd = np.minimum(padd, d)
padd = np.where((dorsal > 0.15) & (main == 0) | ((SG == 0) & (LN[:, 1] > 0.15) & (TT < 0.25)), padd, 1.0)
# Fingerpolster auf den Grundgliedern (Rücken)
fpd = np.where((SG == 0) & (CH < 4) & (LN[:, 1] > 0.2), rrect(LOC[:, 0], -LOC[:, 2], 0.0, 0.0, 0.0064, 0.0, 0.0) * 0 + np.maximum(np.abs(LOC[:, 0]) - 0.0062, np.abs(TT - 0.55) * 0.047 - 0.0105), 1.0)
fpd2 = np.where((SG == 1) & (CH < 4) & (LN[:, 1] > 0.25), np.maximum(np.abs(LOC[:, 0]) - 0.0056, np.abs(TT - 0.5) * 0.03 - 0.0075), 1.0)
pdist = np.minimum(np.minimum(padd, fpd), fpd2)
pad = np.clip(0.5 - pdist / 0.0016, 0, 1)
cuff = np.clip(0.5 + (hz - 0.0035) / 0.003, 0, 1)
pad *= 1 - cuff

# ------------------------------------------------------------------ Handschuhdicke + Polster + Bündchen
t = np.full(n, GLOVE_T['finger'])
t += 0.0007 * np.clip(NT[:, 1], 0, 1) * (main == 0)                 # Handrücken: Stretchstoff über Polsterschaum
t += 0.0005 * (1 - np.abs(np.where(CH >= 0, LN[:, 1], 0)))          # Seitenzwickel
# Polster: erhaben (Plateau mit gerundeter Kante)
pin = np.clip(-pdist / 0.0022, 0, 1)
t += 0.0022 * (pin * pin * (3 - 2 * pin)) * (pdist < 0.0012)
t += np.where(pdist < 0, 0.0004, 0) * (1 - cuff)
# Bündchen: dicker Neopren, Klettlasche mit Wulst am Saum
zc = hz
band = smoothstep(0.004, 0.012, zc)
t += 0.0016 * band + 0.0012 * np.exp(-((zc - 0.050) / 0.004) ** 2) + 0.0009 * np.exp(-((zc - 0.012) / 0.0025) ** 2)
# Stauchfalten über den Fingergelenken (Rücken): flache Querwülste
wr = np.zeros(n)
for s, tc in ((0, 0.95), (1, 0.0), (1, 0.95), (2, 0.0)):
    m = (SG == s) & (CH < 4)
    ph = (TT - tc) * TG[0]['len'][s] / 0.0026
    wr += np.where(m, 0.00028 * np.exp(-((TT - tc) * TG[0]['len'][s] / 0.004) ** 2) * (0.5 + 0.5 * np.cos(ph * math.pi)) * np.clip(LN[:, 1] * 1.4, 0, 1), 0)
t += wr
# Handflächen-Querfalten (Leder): leichte Rillen
t -= 0.00025 * np.exp(-((hz + 0.06) / 0.0018) ** 2) * (NT[:, 1] < -0.4) * (main == 0)
PG = PT + NT * t[:, None]

# ------------------------------------------------------------------ Saum: nach innen umgeschlagen (kein offenes Rohr)
ring0 = PG[loop]
ax_c = ring0.mean(0)
inward = []
newP = [PG]
base = len(PG)
rings = []
for k, (dr, dz) in enumerate(((0.0018, 0.0012), (0.0042, 0.0), (0.0048, -0.016))):
    R = ring0.copy()
    v = R - ax_c; v[:, 2] = 0
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    R = R - v * dr
    R[:, 2] += dz
    rings.append(R)
Qx = list(Qh)
prev = list(loop)
Wx = [WT]
for k, R in enumerate(rings):
    idx = list(range(base, base + len(R)))
    base += len(R)
    newP.append(R)
    Wx.append(np.tile(np.eye(17)[16], (len(R), 1)))
    for i in range(len(loop)):
        a, b = prev[i], prev[(i + 1) % len(loop)]
        c, d = idx[(i + 1) % len(loop)], idx[i]
        # Randschleife läuft mit den Flächen; die neue Reihe liegt außerhalb → Wicklung a, d, c, b
        Qx.append([a, d, c, b])
    prev = idx
PG = np.concatenate(newP)
WX = np.concatenate(Wx)
QX = np.array(Qx)
nP = len(PG)


def ext(a, fill):
    return np.concatenate([a, np.full((nP - len(a),) + a.shape[1:], fill, dtype=a.dtype)])


leather, pad, cuff = ext(leather, 0.0), ext(pad, 0.0), ext(cuff, 1.0)
CHx, SGx, TTx = ext(CH, -1), ext(SG, -1), ext(TT, 0.0)
LOCx, LNx = ext(LOC, 0.0), ext(LN, 0.0)
lip = np.zeros(nP); lip[len(PT) + len(loop):] = 1.0       # Innenseite des Saums (dunkel)
lip[len(PT):len(PT) + len(loop)] = 0.4

# Abrieb: Kuppen, Handballen, Polsterkanten, Daumen innen
wear = np.zeros(nP)
wear = np.maximum(wear, np.where(SGx == 2, smoothstep(0.5, 0.95, TTx), 0))
wear = np.maximum(wear, np.where((CHx == -1) & (PG[:, 2] > -0.045) & (PG[:, 2] < -0.005), smoothstep(0.3, 0.9, -ext(NT, 0.0)[:, 1]) * 0.7, 0))
wear = np.maximum(wear, pad * 0.45)
wear = np.maximum(wear, np.where(CHx == 4, smoothstep(0.3, 0.9, -LNx[:, 1]) * 0.6, 0))
# Hautmaske (offene Kuppen): Endglied ab 12 % → Haut; Nagelbett auf dem Rücken des Endglieds
skin = np.where(SGx == 2, smoothstep(0.06, 0.16, TTx), 0.0)
rr_ = np.array([TG[c]['r'][2] if c >= 0 else 1 for c in CHx])
nail = np.where((SGx == 2) & (LNx[:, 1] > 0.2), 1.0, 0.0)
nd = np.maximum(np.abs(LOCx[:, 0]) / (0.56 * rr_), np.abs(TTx - 0.76) / 0.36)
nail *= np.clip((1.0 - nd) / 0.12, 0, 1)
lunula = nail * np.clip((0.55 - TTx) / 0.08 + 0.5, 0, 1)
tipfree = nail * np.clip((TTx - 1.05) / 0.06, 0, 1)

ATTR = np.stack([leather, pad, cuff, wear, skin, nail, lunula + 0.0 * tipfree, lip], 1)

# ------------------------------------------------------------------ Unterteilen (high) / Vereinfachen (low)


def subdivide(P0, Q0, W0, A0):
    keep = None
    P1, Q1, par = catmull_clark(P0, Q0)
    W1 = np.zeros((len(P1), W0.shape[1])); A1 = np.zeros((len(P1), A0.shape[1]))
    for i, pr in enumerate(par):
        for j, w in pr:
            W1[i] += W0[j] * w; A1[i] += A0[j] * w
    return P1, Q1, W1, A1


def tris_of(Qa):
    # Diagonale entlang der kürzeren Seite
    a, b, c, d = Qa[:, 0], Qa[:, 1], Qa[:, 2], Qa[:, 3]
    return a, b, c, d


def quads_to_tris(P0, Q0):
    T = []
    for q in Q0:
        a, b, c, d = q
        if np.linalg.norm(P0[a] - P0[c]) <= np.linalg.norm(P0[b] - P0[d]):
            T += [[a, b, c], [a, c, d]]
        else:
            T += [[a, b, d], [b, c, d]]
    return np.array(T)


def limit4(W0):
    W1 = W0.copy()
    for i in range(len(W1)):
        o = np.argsort(-W1[i])
        W1[i, o[4:]] = 0
    W1 /= W1.sum(1, keepdims=True)
    return W1


def bake_ao(P0, N0, T0, cell=0.0016, dirs=12, steps=(0.003, 0.006, 0.011, 0.018, 0.028), strength=0.85):
    lo = P0.min(0) - 0.04
    hi = P0.max(0) + 0.04
    G = np.ceil((hi - lo) / cell).astype(int) + 1
    grid = np.zeros(G, bool)
    for t in T0:
        a, b, c = P0[t[0]], P0[t[1]], P0[t[2]]
        L = max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
        k = int(min(40, max(1, math.ceil(L / cell * 2))))
        u, v = np.meshgrid(np.arange(k + 1), np.arange(k + 1))
        m = u + v <= k
        u = u[m] / k; v = v[m] / k
        pts = a + np.outer(u, b - a) + np.outer(v, c - a)
        ij = ((pts - lo) / cell).astype(int)
        grid[ij[:, 0], ij[:, 1], ij[:, 2]] = True
    D = []
    for i in range(dirs):
        r = math.sqrt((i + 0.5) / dirs); ph = i * 2.399963
        D.append((r * math.cos(ph), r * math.sin(ph), math.sqrt(max(0, 1 - r * r))))
    D = np.array(D)
    out = np.zeros(len(P0))
    for v in range(len(P0)):
        nrm = N0[v]
        tx = np.array([1.0, 0, 0]) if abs(nrm[0]) < 0.9 else np.array([0, 1.0, 0])
        u = np.cross(tx, nrm); u /= np.linalg.norm(u)
        w = np.cross(nrm, u)
        dd = D[:, :1] * u + D[:, 1:2] * w + D[:, 2:3] * nrm
        o = P0[v] + nrm * cell * 1.2
        blocked = 0.0
        hitd = np.zeros(dirs, bool)
        for si, s in enumerate(steps):
            q = ((o + dd * s - lo) / cell).astype(int)
            h = grid[q[:, 0], q[:, 1], q[:, 2]] & ~hitd
            blocked += h.sum() * (1 - si / len(steps) * 0.6)
            hitd |= h
        out[v] = 1 - strength * blocked / dirs
    return np.clip(out, 0, 1)


def pack(P0, T0, W0, A0, name):
    N0 = tri_normals(P0, T0)
    ao = bake_ao(P0, N0, T0)
    # Saum-Innenseite dunkel
    ao = ao * (1 - 0.75 * A0[:, 7])
    W4 = limit4(W0)
    ski = np.zeros((len(P0), 4), np.uint8); skw = np.zeros((len(P0), 4), np.uint8)
    for i in range(len(P0)):
        o = np.argsort(-W4[i])[:4]
        ski[i] = o
        q = np.round(W4[i, o] * 255).astype(int)
        q[0] += 255 - q.sum()
        skw[i] = q
    lo = P0.min(0); sc = (P0.max(0) - lo) / 65535
    pos = np.round((P0 - lo) / sc).astype(np.uint16)
    nrm = np.clip(np.round(N0 * 127), -127, 127).astype(np.int8)
    msk = np.clip(np.round(A0[:, :4] * 255), 0, 255).astype(np.uint8)
    skn = np.clip(np.round(A0[:, 4:8] * 255), 0, 255).astype(np.uint8)
    idx = T0.astype(np.uint16)
    print('%s: %d Ecken, %d Dreiecke' % (name, len(P0), len(T0)))
    return {'n': int(len(P0)), 'tris': int(len(T0)), 'lo': [round(float(x), 7) for x in lo], 'sc': [float('%.9g' % x) for x in sc],
            'pos': b64(pos), 'nrm': b64(nrm), 'idx': b64(idx), 'ski': b64(ski), 'skw': b64(skw), 'msk': b64(msk), 'skn': b64(skn),
            'ao': b64(np.round(ao * 255).astype(np.uint8))}


ATTRW = np.concatenate([ATTR, WX], 1)
# high: eine Catmull-Clark-Stufe
PH, QH, WH, AH = subdivide(PG, QX, WX, ATTR)
TH = quads_to_tris(PH, QH)
high = pack(PH, TH, WH, AH, 'high')
# low: Kantenkollaps auf ≤ 1500 Dreiecke (Attribute + Gewichte mitgeführt)
TL0 = quads_to_tris(PG, QX)
PL, TL, XL = decimate(PG, TL0, ATTRW, target=1480, keep=np.arange(len(PT), nP))
low = pack(PL, TL, XL[:, ATTR.shape[1]:], XL[:, :ATTR.shape[1]], 'low')

meta = {'key': dims['key'], 'bones': 17, 'v': 4, 'high': high, 'low': low}
with open(OUT, 'w') as fh:
    fh.write('// ERZEUGT von tools/assets/hands/build_hand.py (hands-v4, MakeHuman-Hand hm08, CC0) – nicht von Hand ändern.\n')
    fh.write('// Handschuhnetz (rechte Hand, Bindehaltung aus handdims.js), quantisiert: pos Uint16 (lo + q·sc), nrm Int8, idx Uint16,\n')
    fh.write('// Hautindizes/-gewichte Uint8×4 (Knochen 0 Hand, 1–12 Finger, 13–15 Daumen, 16 Unterarm), msk Uint8×4\n')
    fh.write('// (Leder, Polster, Bündchen, Abrieb), skn Uint8×4 (Haut offener Kuppen, Nagel, Nagelmond, Saum innen), ao Uint8.\n')
    fh.write('export const GLOVE_MESH = ' + json.dumps(meta, separators=(',', ':')) + ';\n')
if os.environ.get('HAND_DEBUG'):
    np.savez(os.environ['HAND_DEBUG'], PH=PH, TH=TH, AH=AH, WH=WH, PL=PL, TL=TL, PT=PT, PS=PS, QX=QX)
print('geschrieben:', OUT, os.path.getsize(OUT) // 1024, 'KB')
