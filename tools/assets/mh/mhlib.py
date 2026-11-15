# NULLPUNKT – gemeinsame Helfer für die Werkzeuge, die aus dem MakeHuman-Grundnetz hm08 Assets erzeugen
# (tools/assets/hands/build_hand.py → Ego-Handschuhe, tools/assets/soldier/build_body.py → Soldaten-/Zivilkörper).
#
# Quelle (CC0 1.0, seit 09/2020): makehumancommunity/makehuman, Ordner makehuman/data/3dobjs/base.obj und
# makehuman/data/targets/** (Form-Ziele). Die Dateien liegen NICHT im Repo (≈ 4 MB); Pfad per Umgebungsvariable
# MH_DIR (Ordner mit base.obj und Unterordner t/ mit den Zielen als <ordner>_<name>.target, wie sie
# scratchpad/gesicht beim Kopf-Asset abgelegt hat). Ohne MH_DIR wird ../../../../mh relativ zu diesem Ordner gesucht.
#
# Koordinaten MakeHuman: Dezimeter, Blick +z, Figur-links +x, Füße bei y ≈ −8,2.
import os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))


def mh_dir():
    d = os.environ.get('MH_DIR') or os.path.join(HERE, '..', '..', '..', '..', 'mh')
    if not os.path.exists(os.path.join(d, 'base.obj')):
        raise SystemExit('MakeHuman-Grundnetz nicht gefunden – MH_DIR auf den Ordner mit base.obj setzen (siehe mhlib.py)')
    return d


def load_obj(path):
    """→ V (n×3), F (Liste von Index-Listen), G (Gruppenname je Fläche als np.array)."""
    V, F, G = [], [], []
    g = None
    with open(path) as fh:
        for line in fh:
            if line.startswith('v '):
                p = line.split()
                V.append((float(p[1]), float(p[2]), float(p[3])))
            elif line.startswith('g '):
                g = line.split()[1]
            elif line.startswith('f '):
                F.append([int(p.split('/')[0]) - 1 for p in line.split()[1:]])
                G.append(g)
    return np.array(V), F, np.array(G)


class MH:
    def __init__(self):
        self.dir = mh_dir()
        self.V, self.F, self.G = load_obj(os.path.join(self.dir, 'base.obj'))
        self._tcache = {}

    def target(self, name):
        if name in self._tcache:
            return self._tcache[name]
        d = np.zeros_like(self.V)
        fn = os.path.join(self.dir, 't', name.replace('/', '_') + '.target')
        with open(fn) as fh:
            for line in fh:
                if line[0] == '#' or not line.strip():
                    continue
                p = line.split()
                d[int(p[0])] = (float(p[1]), float(p[2]), float(p[3]))
        self._tcache[name] = d
        return d

    def shape(self, weights):
        """Grundnetz + Σ w·Ziel. weights: {zielname: gewicht}"""
        P = self.V.copy()
        for k, w in weights.items():
            if w:
                P += self.target(k) * w
        return P

    def joint(self, P, name):
        """Gelenkmitte = Mittel der Ecken der Hilfswürfel-Gruppe joint-<name>."""
        idx = np.where(self.G == 'joint-' + name)[0]
        vs = np.unique(np.concatenate([self.F[i] for i in idx]))
        return P[vs].mean(0)

    def body_faces(self):
        return np.array([self.F[i] for i in np.where(self.G == 'body')[0]])


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def vertex_normals(P, quads):
    """Flächengewichtete Eckennormalen für Vierecke (als zwei Dreiecke)."""
    N = np.zeros_like(P)
    for a, b, c in ((0, 1, 2), (0, 2, 3)):
        n = np.cross(P[quads[:, b]] - P[quads[:, a]], P[quads[:, c]] - P[quads[:, a]])
        for k in (a, b, c):
            np.add.at(N, quads[:, k], n)
    l = np.linalg.norm(N, axis=1, keepdims=True)
    return N / np.maximum(l, 1e-12)


def tri_normals(P, tris):
    N = np.zeros_like(P)
    n = np.cross(P[tris[:, 1]] - P[tris[:, 0]], P[tris[:, 2]] - P[tris[:, 0]])
    for k in range(3):
        np.add.at(N, tris[:, k], n)
    l = np.linalg.norm(N, axis=1, keepdims=True)
    return N / np.maximum(l, 1e-12)


def catmull_clark(P, quads, keep=None):
    """Eine Catmull-Clark-Unterteilung (nur Vierecke, Ränder als Kurven). → P2, quads2, parent (Eltern-Info je neuer
    Ecke: ('v', i) | ('e', a, b) | ('f', k)) als Gewichtsmatrix-Zeilen zum Übertragen von Attributen (Liste von
    (indizes, gewichte))."""
    nv = len(P)
    nf = len(quads)
    fp = P[quads].mean(1)
    edges = {}
    efaces = {}
    for k, q in enumerate(quads):
        for i in range(4):
            a, b = int(q[i]), int(q[(i + 1) % 4])
            e = (min(a, b), max(a, b))
            if e not in edges:
                edges[e] = len(edges)
                efaces[e] = []
            efaces[e].append(k)
    ne = len(edges)
    ep = np.zeros((ne, 3))
    boundary_e = np.zeros(ne, bool)
    for e, i in edges.items():
        fs = efaces[e]
        if len(fs) == 2:
            ep[i] = (P[e[0]] + P[e[1]] + fp[fs[0]] + fp[fs[1]]) / 4
        else:
            ep[i] = (P[e[0]] + P[e[1]]) / 2
            boundary_e[i] = True
    # neue Ecken-Positionen
    vf = [[] for _ in range(nv)]
    for k, q in enumerate(quads):
        for v in q:
            vf[int(v)].append(k)
    ve = [[] for _ in range(nv)]
    for e, i in edges.items():
        ve[e[0]].append(e)
        ve[e[1]].append(e)
    NP = P.copy()
    for v in range(nv):
        es = ve[v]
        if not es:
            continue
        be = [e for e in es if boundary_e[edges[e]]]
        if be:
            if len(be) == 2:
                o = [e[0] if e[1] == v else e[1] for e in be]
                NP[v] = P[v] * 0.75 + (P[o[0]] + P[o[1]]) * 0.125
            continue
        n = len(es)
        Fm = fp[vf[v]].mean(0)
        R = np.mean([(P[e[0]] + P[e[1]]) / 2 for e in es], 0)
        NP[v] = (Fm + 2 * R + (n - 3) * P[v]) / n
    if keep is not None:
        NP[keep] = P[keep]
    P2 = np.concatenate([NP, ep, fp])
    Q2 = []
    for k, q in enumerate(quads):
        c = nv + ne + k
        for i in range(4):
            a = int(q[i])
            b = int(q[(i + 1) % 4])
            d = int(q[(i + 3) % 4])
            e1 = nv + edges[(min(a, b), max(a, b))]
            e0 = nv + edges[(min(a, d), max(a, d))]
            Q2.append([a, e1, c, e0])
    # Elternbezug (für Attribute): Ecke → [(i, w)]
    par = [[(v, 1.0)] for v in range(nv)]
    for e, i in sorted(edges.items(), key=lambda x: x[1]):
        par.append([(e[0], 0.5), (e[1], 0.5)])
    for k, q in enumerate(quads):
        par.append([(int(v), 0.25) for v in q])
    return P2, np.array(Q2), par


def b64(arr):
    import base64
    return base64.b64encode(np.ascontiguousarray(arr).tobytes()).decode('ascii')
