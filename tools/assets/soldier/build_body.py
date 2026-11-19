# NULLPUNKT – Soldaten- und Zivilkörper (soldier-body-v2) aus dem MakeHuman-Grundnetz hm08 (CC0, siehe ../mh/mhlib.py).
#
# Erzeugt assets/js/game/bots/soldier/body-mesh.js (Format wie v1: je Detailstufe pos/nrm/uv/idx/ski/skw/reg/ao,
# Bereiche siehe REG) – ersetzt den Körper aus dem verlorenen build-body.mjs (Kastenrumpf, riesige kantige Schultern).
#   1. Grundform: junger Mann (Kopf/Hals exakt wie das Kopf-Asset kopf.bin, gleiche Abbildung wie build_head.py), Soldat
#      athletisch (+ Muskel), Zivil normal/schlanker.
#   2. Umzielen auf das Skelett aus rig.js (Bindehaltung: Arme hängen gerade, Beine senkrecht): je Knochen eine
#      Abbildung MakeHuman-Glied → Rig-Glied (Arme aus der A-Haltung gedreht, Beine/Becken auf die Rig-Gelenke), weich
#      gemischt; die Hautgewichte sind dieselben Gewichte (≤ 4 Knochen je Ecke). Finger zur lockeren Faust gekrümmt.
#   3. Kleidung als eigene, geglättete Hülle über dem Körper (Anatomie darunter verschwindet wie unter Stoff): Feldjacke
#      mit Kragen, Brust-/Oberarmtaschen, Saum über der Hose, Falten an Ellbogen/Knie/Schritt/Bündchen; Hose mit Beintaschen
#      und Kniepolstertaschen, in die Stiefel gesteckt; Stiefel mit Sohle; Handschuhe. Zivil: dünnere Stoffe ohne Taschen,
#      Halbschuhe.
#   4. Detailstufen per Kantenkollaps (Bereichsgrenzen bleiben): ≈ 12k / 3k / 0,7k Dreiecke; Feld-Umgebungsverdeckung.
#
# Nutzung: MH_DIR=<ordner mit base.obj und t/> python3 -I tools/assets/soldier/build_body.py
import os, sys, json, subprocess, math
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(HERE, '..', 'mh'))
from mhlib import MH, smoothstep, vertex_normals, tri_normals, b64  # noqa: E402
from qem import decimate  # noqa: E402

SOL = os.path.join(ROOT, 'assets', 'js', 'game', 'bots', 'soldier')
OUT = os.path.join(SOL, 'body-mesh.js')
rig = json.loads(subprocess.check_output(['node', '-e', "import('./rig.js').then(m=>console.log(JSON.stringify({BIND:m.BIND,DIM:m.DIM,BONES:m.BONES})))"], cwd=SOL))
BIND = np.array(rig['BIND'])
BN = {b[0]: i for i, b in enumerate(rig['BONES'])}
REG = {'SHIRT': 0, 'SLEEVE': 1, 'FOREARM': 2, 'GLOVE': 3, 'PANTS': 4, 'BOOT': 5, 'SOLE': 6, 'NECK': 7, 'SKULL': 8, 'EYES': 9,
       'FACE': 10, 'EARS': 11, 'POCKET': 12, 'COLLAR': 13, 'PAD': 14}
DEBUG = os.environ.get('BODY_DEBUG')

mh = MH()
QB = mh.body_faces()
VB = np.unique(QB)

# ------------------------------------------------------------------ Abbildung wie das Kopf-Asset (build_head.py)
B0 = mh.shape({'macrodetails/caucasian-male-young': 1.0})
eyeL = np.unique(np.concatenate([mh.F[i] for i in np.where(mh.G == 'helper-l-eye')[0]]))
eyeR = np.unique(np.concatenate([mh.F[i] for i in np.where(mh.G == 'helper-r-eye')[0]]))
EMH = ((B0[eyeL].min(0) + B0[eyeL].max(0)) / 2 + (B0[eyeR].min(0) + B0[eyeR].max(0)) / 2) / 2


def T(P):
    P = np.asarray(P, float)
    o = np.empty_like(P)
    o[..., 0] = -(P[..., 0] - EMH[0]) * 0.1
    o[..., 1] = (P[..., 1] - EMH[1]) * 0.1 + 1.692
    o[..., 2] = -(P[..., 2] - EMH[2]) * 0.1 - 0.0705
    return o


def rx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_axis(ax, a):
    ax = ax / np.linalg.norm(ax)
    K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
    return np.eye(3) + math.sin(a) * K + (1 - math.cos(a)) * K @ K


def seg_dist(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


# ================================================================== Körper einer Ausführung
def build(kind):
    civil = kind == 'civil'
    extra = {'macrodetails/universal-male-young-averagemuscle-minweight': 0.25} if civil else \
        {'macrodetails/universal-male-young-maxmuscle-averageweight': 0.45}
    P0 = B0.copy()
    Ty = T(B0)[:, 1]
    keep_head = smoothstep(1.46, 1.53, Ty)            # Kopf/Hals bleiben exakt wie kopf.bin
    for k, w in extra.items():
        P0 += mh.target(k) * w * (1 - keep_head)[:, None]
    J = lambda n: T(mh.joint(P0, n))  # noqa: E731
    PS = T(P0[VB])
    remap = -np.ones(len(P0), int); remap[VB] = np.arange(len(VB))
    Q = remap[QB]
    n = len(PS)

    # -------------------------------------------------------------- Finger zur lockeren Faust (Quellraum)
    PS = curl_hands(PS, P0, J)

    # -------------------------------------------------------------- Quellgelenke
    src = {}
    for s_, side in (('r', 'R'), ('l', 'L')):
        src['sh' + side] = J(s_ + '-shoulder'); src['el' + side] = J(s_ + '-elbow'); src['wr' + side] = J(s_ + '-hand')
        src['hd' + side] = J(s_ + '-finger-3-1')
        src['hp' + side] = J(s_ + '-upper-leg'); src['kn' + side] = J(s_ + '-knee'); src['an' + side] = J(s_ + '-ankle')
    sole_y = PS[:, 1].min()

    # -------------------------------------------------------------- Gewichte (Quellraum)
    W = np.zeros((n, 17))
    y = PS[:, 1]
    # Rumpf nach Höhe: Becken | Lende | Brust | Hals | Kopf
    hipsY = (src['hpR'][1] + src['hpL'][1]) / 2
    c1 = smoothstep(hipsY + 0.02, hipsY + 0.12, y)        # Becken → Lende
    c2 = smoothstep(1.2, 1.3, y)                         # Lende → Brust
    c3 = smoothstep(1.47, 1.53, y)                       # Brust → Hals
    c4 = smoothstep(1.575, 1.61, y)                      # Hals → Kopf
    torso = np.stack([1 - c1, c1 - c2, c2 - c3, c3 - c4, c4], 1)
    torso = np.clip(torso, 0, 1)
    limbw = np.zeros(n)
    for side, sg in (('R', 1), ('L', -1)):
        bu, bf, bh = BN['upperArm' + side], BN['foreArm' + side], BN['hand' + side]
        S_, E_, W_, H_ = src['sh' + side], src['el' + side], src['wr' + side], src['hd' + side]
        ua = (E_ - S_) / np.linalg.norm(E_ - S_)
        fa = (W_ - E_) / np.linalg.norm(W_ - E_)
        ha = (H_ - W_) / np.linalg.norm(H_ - W_)
        e0 = (PS - S_) @ ua
        e1 = (PS - E_) @ fa
        e2 = (PS - W_) @ ha
        d = np.minimum(np.minimum(seg_dist(PS, S_, E_), seg_dist(PS, E_, W_)), seg_dist(PS, W_, W_ + ha * 0.2))
        # Arm: nah an der Armlinie und seitlich der Schulter (Achsel gehört zum Rumpf)
        on = (PS[:, 0] * sg > 0.05) & (e0 > -0.06) & (d < np.where(e0 < 0.06, 0.085, np.where(e1 > 0, 0.12, 0.075)))
        on |= (PS[:, 0] * sg > 0.2) & (np.linalg.norm(PS - H_, axis=1) < 0.15)
        a0 = smoothstep(-0.045, 0.045, e0) * on
        a1 = smoothstep(-0.035, 0.035, e1)
        a2 = smoothstep(-0.03, 0.02, e2)
        W[:, bu] = a0 * (1 - a1); W[:, bf] = a0 * (a1 - a2); W[:, bh] = a0 * a2
        limbw = np.maximum(limbw, a0)
        # Bein
        bt, bs, bfo = BN['thigh' + side], BN['shin' + side], BN['foot' + side]
        Hp, K_, A_ = src['hp' + side], src['kn' + side], src['an' + side]
        la = (K_ - Hp) / np.linalg.norm(K_ - Hp)
        sa = (A_ - K_) / np.linalg.norm(A_ - K_)
        g0 = (PS - Hp) @ la
        g1 = (PS - K_) @ sa
        g2 = A_[1] - PS[:, 1]
        onl = (PS[:, 0] * sg > -0.005) & (PS[:, 1] < Hp[1] + 0.06)
        b0 = smoothstep(-0.02, 0.1, g0) * onl
        # Gesäß: hinten tiefer in den Rumpf
        b0 *= np.where(PS[:, 2] > Hp[2] + 0.03, smoothstep(-0.0, 0.14, g0), 1.0)
        b1 = smoothstep(-0.04, 0.04, g1)
        b2 = smoothstep(-0.03, 0.02, g2)
        W[:, bt] = b0 * (1 - b1); W[:, bs] = b0 * (b1 - b2); W[:, bfo] = b0 * b2
        limbw = np.maximum(limbw, b0)
    rest = 1 - limbw
    for k, b in enumerate(('hips', 'spine', 'chest', 'neck', 'head')):
        W[:, BN[b]] += torso[:, k] * rest
    W /= W.sum(1, keepdims=True)

    # -------------------------------------------------------------- Abbildungen Quelle → Rig
    MAPS = {}
    shM = (src['shR'] + src['shL']) / 2
    chest_t = np.array([0, BIND[BN['upperArmR']][1], 0]) - np.array([0, shM[1], shM[2]])
    hipM = (src['hpR'] + src['hpL']) / 2
    hips_t = np.array([0, BIND[BN['thighR']][1], 0]) - np.array([0, hipM[1], hipM[2]])
    chest_sx = 1.0 if civil else 1.05

    def trans(t, sx=1.0, cx=0.0):
        def f(p):
            q = p + t
            q[:, 0] = cx + (q[:, 0] - cx) * sx
            return q
        return f

    MAPS[BN['head']] = trans(np.zeros(3))
    MAPS[BN['neck']] = trans(np.zeros(3))
    MAPS[BN['chest']] = trans(chest_t, chest_sx)
    MAPS[BN['spine']] = trans((chest_t + hips_t) / 2, (chest_sx + 1) / 2)
    MAPS[BN['hips']] = trans(hips_t)
    print(kind, 'Brust verschoben', np.round(chest_t, 3), 'Becken', np.round(hips_t, 3))

    FWD = np.array([0, 0, -1.0])

    def frame(a, b):
        u = (b - a) / np.linalg.norm(b - a)
        f = FWD - u * (FWD @ u); f /= np.linalg.norm(f)
        return np.stack([np.cross(u, f), f, u], 1)

    def limb_map(sa, sb, ta, tb, prev_sz, h=0.03, tw=None):
        Rs, Rt = frame(sa, sb), frame(ta, tb)
        if tw is not None:
            Rs = Rs @ tw
        sz = np.linalg.norm(tb - ta) / np.linalg.norm(sb - sa)

        def f(p):
            l = (p - sa) @ Rs
            a = l[:, 2]
            sp = h * np.logaddexp(0, a / h)
            a2 = prev_sz * a + (sz - prev_sz) * sp
            q = np.stack([l[:, 0], l[:, 1], a2], 1)
            return ta + q @ Rt.T
        return f, sz

    for side in ('R', 'L'):
        S_, E_, W_, H_ = src['sh' + side], src['el' + side], src['wr' + side], src['hd' + side]
        tS, tE, tW = BIND[BN['upperArm' + side]], BIND[BN['foreArm' + side]], BIND[BN['hand' + side]]
        tH = tW + np.array([0, -rig['DIM']['hand'], 0])
        MAPS[BN['upperArm' + side]], s1 = limb_map(S_, E_, tS, tE, 1.0, 0.04)
        MAPS[BN['foreArm' + side]], s2 = limb_map(E_, W_, tE, tW, s1, 0.03)
        MAPS[BN['hand' + side]], _ = limb_map(W_, H_, tW, tH, s2, 0.02)
        Hp, K_, A_ = src['hp' + side], src['kn' + side], src['an' + side]
        tHp, tK, tA = BIND[BN['thigh' + side]], BIND[BN['shin' + side]], BIND[BN['foot' + side]]
        MAPS[BN['thigh' + side]], s3 = limb_map(Hp, K_, tHp, tK, 1.0, 0.05)
        MAPS[BN['shin' + side]], s4 = limb_map(K_, A_, tK, tA, s3, 0.04)
        # Fuß: Knöchel auf den Rig-Knöchel, Sohle auf y = 0
        fy = tA[1] / (A_[1] - sole_y)

        def foot(p, A_=A_, tA=tA, fy=fy):
            q = p - A_
            q[:, 1] *= fy
            return q + tA
        MAPS[BN['foot' + side]] = foot

    PT = np.zeros_like(PS)
    for b in range(17):
        m = W[:, b] > 0
        if m.any():
            PT[m] += W[m, b:b + 1] * MAPS[b](PS[m])

    # Verformungsfeld in den Mischzonen (Schulter, Achsel, Hüfte, Gesäß) glätten
    nb = neighbors(Q, n)
    base = MAPS[BN['chest']](PS.copy()) * 0  # nur Form
    DL = PT - PS
    mixz = 1 - W.max(1)
    zone = np.clip(mixz * 2.5, 0, 1) * (PS[:, 1] < 1.5)
    for _ in range(25):
        avg = np.array([DL[k].mean(0) for k in nb])
        DL += 0.5 * (avg - DL) * zone[:, None]
    PT = PS + DL
    del base

    # -------------------------------------------------------------- Bereiche + Kleidung
    N0 = vertex_normals(PT, Q)
    reg, off, extra_attr = clothe(PT, N0, W, Q, nb, civil)
    # Stoffhülle: Anatomie unter dem Stoff glätten (Mulden füllen), dann versetzen
    cloth = np.isin(reg, [REG['SHIRT'], REG['SLEEVE'], REG['FOREARM'], REG['PANTS'], REG['POCKET'], REG['COLLAR'], REG['PAD'], REG['BOOT']])
    smooth_w = np.where(cloth, 1.0, 0.0)
    smooth_w = np.where(reg == REG['BOOT'], 1.0, smooth_w)
    PC = PT.copy()
    for it in range(14 if civil else 14):
        avg = np.array([PC[k].mean(0) for k in nb])
        d = (avg - PC)
        # nur nach außen auffüllen (Stoff spannt über Mulden), nicht schrumpfen
        outward = np.maximum((d * N0).sum(1), 0)[:, None] * N0
        PC += (0.6 * outward + 0.25 * (d - (d * N0).sum(1)[:, None] * N0)) * smooth_w[:, None]
    # Hosenbeine fallen gerade (Stoffrohr statt Wadenform): Querschnitt je Höhe mindestens auf ein Hosenprofil aufweiten
    legm = np.isin(reg, [REG['PANTS'], REG['POCKET'], REG['PAD']]) & (PC[:, 1] < 0.86) & (np.abs(PC[:, 0]) > 0.0)
    for side in (1, -1):
        mi = np.where(legm & (PC[:, 0] * side > 0))[0]
        yb = np.round(PC[mi, 1] / 0.02).astype(int)
        ub = np.unique(yb)
        czb = np.array([0.5 * (PC[mi[yb == bb], 2].min() + PC[mi[yb == bb], 2].max()) for bb in ub])
        cxb = np.array([0.5 * (PC[mi[yb == bb], 0].min() + PC[mi[yb == bb], 0].max()) for bb in ub])
        ker = np.ones(5) / 5
        czb = np.convolve(np.pad(czb, 2, mode='edge'), ker, 'valid'); cxb = np.convolve(np.pad(cxb, 2, mode='edge'), ker, 'valid')
        yy = PC[mi, 1]
        cz = np.interp(yy, ub * 0.02, czb); cx = np.interp(yy, ub * 0.02, cxb)
        rd = np.interp(yy, [0.1, 0.3, 0.5, 0.7, 0.86], [0.055, 0.06, 0.065, 0.076, 0.084] if not civil else [0.058, 0.06, 0.063, 0.074, 0.084])
        dx, dz = PC[mi, 0] - cx, PC[mi, 2] - cz
        r = np.hypot(dx, dz / 1.06)
        f = np.maximum(1.0, rd / np.maximum(r, 1e-6))
        inner = smoothstep(0.0, -0.03, dx * side)          # zum anderen Bein hin weniger aufweiten
        f = 1 + (f - 1) * (1 - 0.65 * inner)
        f = 1 + (f - 1) * smoothstep(0.86, 0.78, yy)          # oben in die Hüfte auslaufen
        if not civil:
            f = 1 + (f - 1) * smoothstep(0.2, 0.26, yy)      # im Stiefel nicht
        PC[mi, 0] = cx + dx * f; PC[mi, 2] = cz + dz * f
    # Schritt: Stoff spannt zwischen den Beinen (keine Leggings-Form)
    cr = (np.isin(reg, [REG['PANTS'], REG['POCKET'], REG['SHIRT']]) & (PC[:, 1] > 0.68) & (PC[:, 1] < 1.0) & (np.abs(PC[:, 0]) < 0.11)).astype(float)
    cr *= smoothstep(0.68, 0.8, PC[:, 1]) * (1 - smoothstep(0.93, 1.0, PC[:, 1]))
    for it in range(25):
        avg = np.array([PC[k].mean(0) for k in nb])
        PC += 0.5 * (avg - PC) * cr[:, None]
    bootm = np.isin(reg, [REG['BOOT'], REG['SOLE']]).astype(float)
    for it in range(30):
        avg = np.array([PC[k].mean(0) for k in nb])
        d = avg - PC
        PC += 0.5 * d * bootm[:, None]
    # Stiefel-/Schuhleisten: Fußteil auf ein Superellipsoid (eckig-rund, Zehen verschwinden), Schaft als ovaler Zylinder
    bi = np.where(bootm > 0)[0]
    for side in (1, -1):
        m = bi[PC[bi, 0] * side > 0]
        cx = side * 0.105
        if civil:
            c, hs, pw = np.array([cx, 0.04, -0.068]), np.array([0.045, 0.04, 0.132]), 2.8
        else:
            c, hs, pw = np.array([cx, 0.05, -0.072]), np.array([0.046, 0.05, 0.142]), 3.2
        d = PC[m] - c
        f = (np.abs(d[:, 0] / hs[0]) ** pw + np.abs(d[:, 1] / hs[1]) ** pw + np.abs(d[:, 2] / hs[2]) ** pw) ** (1 / pw)
        foot = c + d / np.maximum(f, 1e-6)[:, None]
        # Schaft
        sc = np.array([cx, 0, 0.012])
        dd = PC[m] - sc; dd[:, 1] = 0
        rr = np.hypot(dd[:, 0] / 0.052, dd[:, 2] / 0.06)
        shaft = sc + dd / np.maximum(rr, 1e-6)[:, None]; shaft[:, 1] = PC[m, 1]
        k = smoothstep(0.085, 0.13, PC[m, 1])[:, None] if not civil else np.zeros((len(m), 1))
        PC[m] = foot * (1 - k) + shaft * k
        # Zehenkappe flacher als die Ferse (Leisten fällt nach vorn ab)
        PC[m, 1] *= 1 - 0.3 * smoothstep(-0.07, -0.19, PC[m, 2]) * (1 - k[:, 0])
        # Sohle: unten flach (Profilsohle ≈ 2,5 cm hoch, leicht überstehend)
        lowp = PC[m, 1] < (0.026 if not civil else 0.018)
        mm = m[lowp]
        PC[mm, 1] = np.minimum(PC[mm, 1], 0.026) * np.clip(PC[mm, 1] / 0.026, 0, 1) ** 0.4
        reg[mm] = REG['SOLE']
    N1 = vertex_normals(PC, Q)
    PF = PC + N1 * off[:, None]
    # Sohle flach
    sole = reg == REG['SOLE']
    PF[sole, 1] = np.maximum(PF[sole, 1] * 0.3, 0.0)
    PF[:, 1] = np.maximum(PF[:, 1], 0.0)

    # Feld-Umgebungsverdeckung
    TQ = quads_to_tris(PF, Q)
    return {'P': PF, 'Q': Q, 'T': TQ, 'W': W, 'reg': reg, 'kind': kind, 'nb': nb}


def neighbors(Q, n):
    nb = [set() for _ in range(n)]
    for q in Q:
        for i in range(4):
            nb[q[i]].add(q[(i + 1) % 4]); nb[q[i]].add(q[(i + 3) % 4])
    return [np.array(sorted(s)) for s in nb]


def quads_to_tris(P0, Q0):
    a, b, c, d = Q0[:, 0], Q0[:, 1], Q0[:, 2], Q0[:, 3]
    ac = np.linalg.norm(P0[a] - P0[c], axis=1) <= np.linalg.norm(P0[b] - P0[d], axis=1)
    T1 = np.where(ac[:, None], np.stack([a, b, c], 1), np.stack([a, b, d], 1))
    T2 = np.where(ac[:, None], np.stack([a, c, d], 1), np.stack([b, c, d], 1))
    return np.concatenate([T1, T2])


# ------------------------------------------------------------------ Finger krümmen (Quellraum, beide Hände)
def curl_hands(PS, P0, J):
    """Lockere Faust: je Finger Vorwärtskinematik als Hautverformung (Grund-, Mittel-, Endgelenk), Daumen leicht angelegt."""
    out = PS.copy()
    for s_ in ('r', 'l'):
        Wr = J(s_ + '-hand')
        mcp = [J(f'{s_}-finger-{f}-1') for f in range(2, 6)]
        D = np.mean(mcp, 0) - Wr; D /= np.linalg.norm(D)
        Lx = mcp[0] - mcp[3]; Lx -= D * (Lx @ D); Lx /= np.linalg.norm(Lx)
        jm = [J(f'{s_}-finger-3-{k}') for k in range(1, 5)]
        off = jm[3] - jm[0]; off -= D * (off @ D)
        pn = np.cross(D, Lx)
        if pn @ off < 0:
            pn = -pn                                   # zur Handfläche
        near = np.linalg.norm(PS - Wr, axis=1) < 0.25
        chains = {f: [J(f'{s_}-finger-{f}-{k}') for k in range(1, 5)] for f in range(1, 6)}
        dist = np.stack([np.minimum.reduce([seg_dist(PS, chains[f][k], chains[f][k + 1]) for k in range(3)]) for f in range(1, 6)], 1)
        owner = np.argmin(dist, 1) + 1
        for f, amt in ((2, (1.0, 1.2, 0.7)), (3, (1.1, 1.25, 0.7)), (4, (1.15, 1.25, 0.7)), (5, (1.2, 1.2, 0.65)), (1, (0.3, 0.45, 0.35))):
            Jf = chains[f]
            e = [(PS - Jf[k]) @ ((Jf[k + 1] - Jf[k]) / np.linalg.norm(Jf[k + 1] - Jf[k])) for k in range(3)]
            h = (0.012 if f > 1 else 0.018, 0.006, 0.005)
            cc = [smoothstep(-h[k], h[k], e[k]) for k in range(3)]
            mine = near & (owner == f) & (dist[:, f - 1] < 0.02) & (cc[0] > 0)
            Ms = []
            for k in range(3):
                dirk = (Jf[k + 1] - Jf[k]) / np.linalg.norm(Jf[k + 1] - Jf[k])
                ax = np.cross(dirk, pn if f > 1 else (pn * 0.6 + Lx * 0.4))
                R = rot_axis(ax, amt[k])
                if (R @ dirk) @ pn < 0:
                    R = rot_axis(ax, -amt[k])
                M = np.eye(4); M[:3, :3] = R; M[:3, 3] = Jf[k] - R @ Jf[k]
                Ms.append(M)
            C = [Ms[0], Ms[0] @ Ms[1], Ms[0] @ Ms[1] @ Ms[2]]
            w = [cc[0] - cc[1], cc[1] - cc[2], cc[2]]
            p = PS[mine]
            ph = np.concatenate([p, np.ones((len(p), 1))], 1)
            q = p * (1 - cc[0][mine])[:, None]
            for k in range(3):
                q += w[k][mine][:, None] * (ph @ C[k].T)[:, :3]
            out[mine] = q
    return out


# ------------------------------------------------------------------ Bereiche + Kleidungsdicke
def clothe(P, N, W, Q, nb, civil):
    n = len(P)
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    main = np.argmax(W, 1)
    reg = np.full(n, REG['SHIRT'])
    off = np.zeros(n)
    arm_u = np.isin(main, [BN['upperArmL'], BN['upperArmR']])
    arm_f = np.isin(main, [BN['foreArmL'], BN['foreArmR']])
    hand = np.isin(main, [BN['handL'], BN['handR']])
    leg = np.isin(main, [BN['thighL'], BN['thighR'], BN['shinL'], BN['shinR'], BN['footL'], BN['footR']])
    head = W[:, BN['head']] > 0.5
    neck = (W[:, BN['neck']] + W[:, BN['head']] > 0.5) & ~head
    ax = np.abs(x)
    waist = 0.965
    hem = y < waist
    reg[hem & ~arm_u & ~arm_f & ~hand] = REG['PANTS']
    reg[leg] = REG['PANTS']
    reg[arm_u] = REG['SLEEVE']
    reg[arm_f] = REG['FOREARM']
    reg[hand] = REG['GLOVE']
    # Unterarm ↔ Hand: Grenze am Handgelenk (y ≈ Rig-Handgelenk)
    wristY = BIND[BN['handR']][1]
    reg[(arm_f | hand) & (y < wristY + 0.005)] = REG['GLOVE']
    reg[arm_f & (y >= wristY + 0.005)] = REG['FOREARM']
    boot_top = 0.075 if civil else 0.21
    reg[leg & (y < boot_top)] = REG['BOOT']
    reg[(reg == REG['BOOT']) & (y < 0.016) & (N[:, 1] < -0.3)] = REG['SOLE']
    reg[(reg == REG['BOOT']) & (y < 0.03) & (N[:, 1] < -0.6)] = REG['SOLE']
    reg[neck] = REG['NECK']
    # Kopf
    hy = y
    eyeC = [np.array([s * 0.0325, 1.692, -0.0705]) for s in (-1, 1)]
    face = head & (z < -0.035) & (hy < 1.725) & (hy > 1.565) & (ax < 0.066)
    skull = head & ~face
    reg[skull] = REG['SKULL']
    reg[face] = REG['FACE']
    eyes = head & (np.minimum(np.linalg.norm(P - eyeC[0], axis=1), np.linalg.norm(P - eyeC[1], axis=1)) < 0.021) & (z < -0.06)
    reg[eyes] = REG['EYES']
    ears = head & (ax > 0.062) & (hy > 1.63) & (hy < 1.725) & (z > -0.04) & (z < 0.035)
    reg[ears] = REG['EARS']
    # Kragen: Jackenrand um den Halsansatz
    neckbase = (reg == REG['SHIRT']) & (y > 1.43) & (ax < 0.09) & (z < 0.08)
    collar = (reg == REG['SHIRT']) & (y > 1.415) & (np.hypot(x / 0.085, (z - 0.01) / 0.075) < 1.25) & (y > 1.40 + 0.6 * np.maximum(0, np.hypot(x, z) - 0.04))
    reg[collar] = REG['COLLAR']
    # ---------------- Kleidungsdicke
    t = np.zeros(n)
    k = 1.0 if not civil else 0.75
    t[reg == REG['SHIRT']] = 0.019 * k
    t[reg == REG['COLLAR']] = 0.02 * k
    t[reg == REG['SLEEVE']] = 0.016 * k
    t[reg == REG['FOREARM']] = 0.013 * k
    t[reg == REG['PANTS']] = 0.017 * k if not civil else 0.016
    t[reg == REG['BOOT']] = 0.009 if not civil else 0.005
    t[reg == REG['SOLE']] = 0.006 if not civil else 0.004
    t[reg == REG['GLOVE']] = 0.0025 if not civil else 0.0
    # Jacke: Saum steht über der Hose (Stufe), Hose am Gürtel enger
    shirt = reg == REG['SHIRT']
    t += np.where(shirt, 0.006 * smoothstep(waist + 0.07, waist + 0.005, y), 0)
    pants = reg == REG['PANTS']
    t -= np.where(pants & ~leg, 0.004 * np.exp(-((y - (waist - 0.03)) / 0.02) ** 2), 0)
    # Bündchen (Ärmel am Handgelenk) und Hose über dem Stiefel gebauscht
    t += np.where(reg == REG['FOREARM'], 0.006 * np.exp(-((y - (wristY + 0.03)) / 0.018) ** 2) * (0.6 + 0.4 * np.sin(np.arctan2(z, x) * 5)), 0)
    if not civil:
        t += np.where(pants & leg, 0.007 * np.exp(-((y - (boot_top + 0.03)) / 0.03) ** 2) * (0.7 + 0.3 * np.sin(np.arctan2(z, x - np.sign(x) * 0.1) * 6)), 0)
    # Falten: Ellbogen innen/außen, Kniekehle, Schritt, Achsel – Ringwülste mit Phasenrauschen
    def rings(mask, cy, width, amp, freq, phase_mul=3.0):
        ph = (y - cy) * freq + np.sin(np.arctan2(z, x) * phase_mul) * 1.3
        return np.where(mask, amp * np.exp(-((y - cy) / width) ** 2) * (0.5 + 0.5 * np.sin(ph)), 0)
    elbowY = BIND[BN['foreArmR']][1]
    kneeY = BIND[BN['shinR']][1]
    t += rings(np.isin(reg, [REG['SLEEVE'], REG['FOREARM']]), elbowY, 0.05, 0.005 * k, 140)
    t += rings(pants & leg, kneeY, 0.06, 0.006 * k, 120)
    t += rings(pants & leg & (z > 0), kneeY + 0.01, 0.04, 0.004 * k, 160)
    crotch = pants & (y > 0.72) & (y < 0.93) & (ax < 0.12)
    t += np.where(crotch, 0.004 * k * (0.5 + 0.5 * np.sin(np.arctan2(y - 0.9, x) * 9)) * smoothstep(0.72, 0.85, y), 0)
    t += rings(shirt & (ax > 0.12) & (y > 1.25), 1.33, 0.05, 0.004 * k, 110)
    # Taschen / Polster (nur Uniform)
    if not civil:
        # Brusttaschen
        for s in (-1, 1):
            m = shirt & (z < -0.02) & (np.abs(x - s * 0.085) < 0.052) & (np.abs(y - 1.32) < 0.065)
            reg[m] = REG['POCKET']
            t += np.where(m, 0.006 * smoothstep(0.0, 0.012, np.minimum(0.052 - np.abs(x - s * 0.085), 0.065 - np.abs(y - 1.32))), 0)
        # Oberarmtaschen (außen)
        for s in (-1, 1):
            sx = s * BIND[BN['upperArmR']][0]
            m = (reg == REG['SLEEVE']) & (x * s > np.abs(sx) + 0.02) & (np.abs(y - 1.3) < 0.05) & (np.abs(z) < 0.04)
            reg[m] = REG['POCKET']
            t += np.where(m, 0.005, 0)
        # Beintaschen (seitlich am Oberschenkel) + Gesäßtaschen
        for s in (-1, 1):
            hx = s * 0.1
            m = pants & leg & (x * s > 0.1 + 0.035) & (np.abs(y - 0.66) < 0.085) & (np.abs(z - 0.0) < 0.07)
            reg[m] = REG['POCKET']
            t += np.where(m, 0.01 * smoothstep(0.0, 0.015, np.minimum(0.085 - np.abs(y - 0.66), 0.07 - np.abs(z))), 0)
            m = pants & (z > 0.06) & (np.abs(x - s * 0.075) < 0.05) & (np.abs(y - 0.89) < 0.045)
            reg[m] = REG['POCKET']
            t += np.where(m, 0.004, 0)
            # Kniepolstertaschen (vorn) und Ellbogenpolster (hinten)
            m = pants & leg & (z < -0.0) & (np.abs(y - (kneeY + 0.01)) < 0.065) & (np.abs(x - hx) < 0.075)
            reg[m] = REG['PAD']
            t += np.where(m, 0.006, 0)
            m = np.isin(reg, [REG['SLEEVE'], REG['FOREARM']]) & (z > 0.0) & (np.abs(y - elbowY) < 0.055) & (x * s > 0)
            reg[m] = REG['PAD']
            t += np.where(m, 0.005, 0)
    # Übergänge der Dicke glätten (keine Stufen an Bereichsgrenzen außer Taschen/Saum)
    for _ in range(4):
        t = 0.5 * t + 0.5 * np.array([t[k_].mean() for k_ in nb])
    return reg, t, None


# ================================================================== Detailstufen + Ausgabe
def bake_ao(P0, N0, T0, cell=0.012, dirs=10, steps=(0.025, 0.05, 0.09, 0.15), strength=0.8):
    lo = P0.min(0) - 0.2
    G = np.ceil((P0.max(0) + 0.2 - lo) / cell).astype(int) + 1
    grid = np.zeros(G, bool)
    for t in T0:
        a, b, c = P0[t[0]], P0[t[1]], P0[t[2]]
        L = max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
        k = int(min(30, max(1, math.ceil(L / cell * 2))))
        u, v = np.meshgrid(np.arange(k + 1), np.arange(k + 1))
        m = u + v <= k
        pts = a + np.outer(u[m] / k, b - a) + np.outer(v[m] / k, c - a)
        ij = ((pts - lo) / cell).astype(int)
        grid[ij[:, 0], ij[:, 1], ij[:, 2]] = True
    D = []
    for i in range(dirs):
        r = math.sqrt((i + 0.5) / dirs); ph = i * 2.399963
        D.append((r * math.cos(ph), r * math.sin(ph), math.sqrt(max(0, 1 - r * r))))
    D = np.array(D)
    out = np.zeros(len(P0))
    for v in range(len(P0)):
        nr = N0[v]
        tx = np.array([1.0, 0, 0]) if abs(nr[0]) < 0.9 else np.array([0, 1.0, 0])
        u = np.cross(tx, nr); u /= np.linalg.norm(u)
        w = np.cross(nr, u)
        dd = D[:, :1] * u + D[:, 1:2] * w + D[:, 2:3] * nr
        o = P0[v] + nr * cell * 1.3
        blocked = 0.0
        hit = np.zeros(dirs, bool)
        for si, s in enumerate(steps):
            q = ((o + dd * s - lo) / cell).astype(int)
            h = grid[q[:, 0], q[:, 1], q[:, 2]] & ~hit
            blocked += h.sum() * (1 - si / len(steps) * 0.6)
            hit |= h
        out[v] = 1 - strength * blocked / dirs
    return np.clip(out, 0, 1)


def uvs(P, reg, W):
    """UV in Metern: Rumpf/Glieder zylindrisch um ihre Achse (u = Umfang, v = Höhe), Kopf kugelig."""
    n = len(P)
    U = np.zeros((n, 2))
    main = np.argmax(W, 1)
    cx = np.zeros(n); cz = np.zeros(n); R = np.full(n, 0.15)
    for b in range(17):
        m = main == b
        if not m.any():
            continue
        bx, by, bz = BIND[b]
        if b in (BN['hips'], BN['spine'], BN['chest'], BN['neck'], BN['head']):
            cx[m] = 0; cz[m] = 0.0 if b != BN['head'] else -0.01
            R[m] = 0.15 if b != BN['head'] else 0.09
        else:
            cx[m] = bx; cz[m] = 0.0; R[m] = 0.05
    ang = np.arctan2(P[:, 0] - cx, P[:, 2] - cz)     # Naht hinten innen
    U[:, 0] = ang * R
    U[:, 1] = P[:, 1]
    return U


def pack(P, T0, W, reg, name):
    N = tri_normals(P, T0)
    ao = bake_ao(P, N, T0)
    U = uvs(P, reg, W)
    W4 = W.copy()
    for i in range(len(W4)):
        o = np.argsort(-W4[i]); W4[i, o[4:]] = 0
    W4 /= W4.sum(1, keepdims=True)
    ski = np.zeros((len(P), 4), np.uint8); skw = np.zeros((len(P), 4), np.uint8)
    for i in range(len(P)):
        o = np.argsort(-W4[i])[:4]
        ski[i] = o
        q = np.round(W4[i, o] * 255).astype(int); q[0] += 255 - q.sum()
        skw[i] = q
    lo = P.min(0); sc = (P.max(0) - lo) / 65535
    print('  %s: %d Ecken, %d Dreiecke' % (name, len(P), len(T0)))
    return {'n': int(len(P)), 'tris': int(len(T0)), 'lo': [round(float(v), 6) for v in lo], 'sc': [float('%.10g' % v) for v in sc],
            'pos': b64(np.round((P - lo) / sc).astype(np.uint16)), 'nrm': b64(np.clip(np.round(N * 127), -127, 127).astype(np.int8)),
            'uv': b64(np.clip(np.round(U * 16000), -32767, 32767).astype(np.int16)), 'idx': b64(T0.astype(np.uint16)),
            'ski': b64(ski), 'skw': b64(skw), 'reg': b64(reg.astype(np.uint8)), 'ao': b64(np.round(ao * 255).astype(np.uint8))}


def lods(R, targets):
    P, T0, W, reg = R['P'], R['T'], R['W'], R['reg']
    out = []
    A = np.concatenate([W, reg[:, None].astype(float)], 1)
    cur = (P, T0, A)
    for k, tgt in enumerate(targets):
        if len(cur[1]) > tgt:
            Pk, Tk, Ak = decimate(cur[0], cur[1], cur[2], target=tgt, regions=np.round(cur[2][:, -1]).astype(int))
        else:
            Pk, Tk, Ak = cur
        regk = np.round(Ak[:, -1]).astype(int)
        Wk = np.clip(Ak[:, :-1], 0, None)
        Wk /= Wk.sum(1, keepdims=True)
        out.append(pack(Pk, Tk, Wk, regk, '%s Stufe %d' % (R['kind'], k)))
        cur = (Pk, Tk, Ak)
        if DEBUG:
            np.savez(DEBUG + '-%s-%d.npz' % (R['kind'], k), P=Pk, T=Tk, reg=regk, W=Wk)
    return out


def face_info(R):
    P, reg = R['P'], R['reg']
    def front(mask, y0, y1):
        m = mask & (P[:, 1] > y0) & (P[:, 1] < y1) & (np.abs(P[:, 0]) < 0.02)
        return float(P[m, 2].min()) if m.any() else 0.0
    head = np.isin(reg, [REG['FACE'], REG['EYES'], REG['SKULL'], REG['EARS']])
    return {'eyeZ': round(front(head & (np.abs(P[:, 0]) < 0.05), 1.685, 1.70), 4) if False else -0.0804,
            'browZ': round(front(head, 1.70, 1.72), 4), 'noseZ': round(front(head, 1.64, 1.66), 4),
            'mouthZ': round(front(head, 1.6, 1.615), 4), 'skullTop': round(float(P[head, 1].max()), 4)}


if __name__ == '__main__':
    res = {}
    for kind in ('soldier', 'civil'):
        R = build(kind)
        if DEBUG:
            np.savez(DEBUG + '-%s.npz' % kind, P=R['P'], Q=R['Q'], reg=R['reg'], W=R['W'])
        res[kind] = R
    if os.environ.get('BODY_NO_WRITE'):
        sys.exit(0)
    sol = lods(res['soldier'], [12000, 3000, 698])
    civ = lods(res['civil'], [12000, 3000, 698])
    fi = face_info(res['soldier'])
    meta = {'v': 2, 'rig': {'shoulderX': rig['DIM']['shoulderX'], 'hipX': rig['DIM']['hipWidth']}, 'face': fi, 'regions': REG, 'lods': sol, 'civil': civ}
    with open(OUT, 'w') as fh:
        fh.write('// ERZEUGT von tools/assets/soldier/build_body.py (soldier-body-v2, MakeHuman hm08, CC0) – nicht von Hand ändern.\n')
        fh.write('// Körper je Ausführung (lods = Uniform, civil = zivile Kleidung) und Detailstufe (Bindehaltung aus rig.js): pos Uint16\n')
        fh.write('// (lo + q·sc), nrm Int8, uv Int16 (Meter × 16000), idx Uint16, Hautindizes/-gewichte Uint8×4, reg Uint8 (Bereich,\n')
        fh.write('// siehe regions), ao Uint8 (Feld-Umgebungsverdeckung).\n')
        fh.write('export const BODY_MESH = ' + json.dumps(meta, separators=(',', ':')) + ';\n')
    print('geschrieben:', OUT, os.path.getsize(OUT) // 1024, 'KB', json.dumps(fi))
