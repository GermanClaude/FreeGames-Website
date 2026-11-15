# NULLPUNKT – Netzvereinfachung per Kantenkollaps mit Fehlerquadriken (Garland/Heckbert), für die ferneren
# Detailstufen der aus MakeHuman erzeugten Netze. Eckattribute (Masken, Hautgewichte …) werden entlang der Kante
# interpoliert; Randkanten erhalten eine Zusatzquadrik (Rand bleibt an Ort), umklappende Dreiecke werden verhindert.
import heapq
import numpy as np


def _plane_q(p0, p1, p2):
    n = np.cross(p1 - p0, p2 - p0)
    a = np.linalg.norm(n)
    if a < 1e-14:
        return np.zeros((4, 4))
    n /= a
    d = -n @ p0
    v = np.append(n, d)
    return np.outer(v, v) * a


def decimate(P, T, A=None, target=1000, keep=None, border_w=50.0, regions=None):
    """P (n×3), T (m×3) → (P', T', A'). keep: Ecken, die nicht verschoben/entfernt werden. regions: je Ecke eine
    Kennung; Kanten zwischen verschiedenen Kennungen werden wie Ränder behandelt (Materialgrenzen bleiben)."""
    P = P.astype(float).copy()
    n = len(P)
    A = None if A is None else A.astype(float).copy()
    tris = [list(t) for t in T]
    alive_t = [True] * len(tris)
    vt = [set() for _ in range(n)]
    for k, t in enumerate(tris):
        for v in t:
            vt[v].add(k)
    Qv = np.zeros((n, 4, 4))
    for t in tris:
        q = _plane_q(P[t[0]], P[t[1]], P[t[2]])
        for v in t:
            Qv[v] += q
    # Randkanten
    ec = {}
    for t in tris:
        for i in range(3):
            a, b = t[i], t[(i + 1) % 3]
            e = (min(a, b), max(a, b))
            ec[e] = ec.get(e, 0) + 1
    fixed = np.zeros(n, bool)
    if keep is not None:
        fixed[np.asarray(keep)] = True

    def border_q(a, b, t):
        c = [v for v in tris[t] if v != a and v != b][0]
        e = P[b] - P[a]
        fn = np.cross(P[b] - P[a], P[c] - P[a])
        nn = np.cross(e, fn)
        l = np.linalg.norm(nn)
        if l < 1e-14:
            return np.zeros((4, 4))
        nn /= l
        v = np.append(nn, -nn @ P[a])
        return np.outer(v, v) * border_w * (e @ e)

    for t_i, t in enumerate(tris):
        for i in range(3):
            a, b = t[i], t[(i + 1) % 3]
            e = (min(a, b), max(a, b))
            hard = ec[e] == 1 or (regions is not None and regions[a] != regions[b])
            if hard:
                q = border_q(a, b, t_i)
                Qv[a] += q; Qv[b] += q
    alive_v = np.ones(n, bool)
    ver = np.zeros(n, int)

    def cost(a, b):
        Q = Qv[a] + Qv[b]
        if fixed[a] and fixed[b]:
            return None
        if fixed[a]:
            cands = [(P[a], 0.0)]
        elif fixed[b]:
            cands = [(P[b], 1.0)]
        else:
            cands = [(P[a], 0.0), (P[b], 1.0), ((P[a] + P[b]) * 0.5, 0.5)]
        best = None
        for p, t in cands:
            h = np.append(p, 1.0)
            c = h @ Q @ h
            if best is None or c < best[0]:
                best = (c, p, t)
        return best

    heap = []

    def push(a, b):
        r = cost(a, b)
        if r is None:
            return
        heapq.heappush(heap, (r[0], a, b, ver[a], ver[b], r[2]))

    for e in ec:
        push(*e)
    live = len(tris)

    def flips(v, newp, skip):
        for k in vt[v]:
            if not alive_t[k] or k in skip:
                continue
            t = tris[k]
            p = [P[x] for x in t]
            n0 = np.cross(p[1] - p[0], p[2] - p[0])
            p2 = [newp if x == v else P[x] for x in t]
            n1 = np.cross(p2[1] - p2[0], p2[2] - p2[0])
            if n0 @ n1 <= 1e-16 * (np.linalg.norm(n0) + 1e-20) or np.linalg.norm(n1) < 1e-14:
                return True
            if n0 @ n1 < 0.2 * np.linalg.norm(n0) * np.linalg.norm(n1):
                return True
        return False

    def neighbors(v):
        s = set()
        for k in vt[v]:
            if alive_t[k]:
                s.update(tris[k])
        s.discard(v)
        return s

    while live > target and heap:
        c, a, b, va, vb, t = heapq.heappop(heap)
        if not (alive_v[a] and alive_v[b]) or ver[a] != va or ver[b] != vb:
            continue
        shared = [k for k in vt[a] if alive_t[k] and b in tris[k]]
        if not shared:
            continue
        # Verknüpfungsbedingung (keine Nicht-Mannigfaltigkeit)
        na, nb_ = neighbors(a), neighbors(b)
        common = na & nb_
        if len(common) != len(shared):
            continue
        newp = P[a] * (1 - t) + P[b] * t
        if flips(a, newp, set(shared)) or flips(b, newp, set(shared)):
            continue
        # Kollaps b → a
        P[a] = newp
        if A is not None:
            A[a] = A[a] * (1 - t) + A[b] * t
        Qv[a] += Qv[b]
        fixed[a] = fixed[a] or fixed[b]
        for k in shared:
            alive_t[k] = False
            live -= 1
        for k in list(vt[b]):
            if alive_t[k]:
                tris[k] = [a if x == b else x for x in tris[k]]
                vt[a].add(k)
        alive_v[b] = False
        ver[a] += 1
        for x in neighbors(a):
            ver[x] += 1
        for x in neighbors(a):
            push(min(a, x), max(a, x))
            for y in neighbors(x):
                if y != a:
                    push(min(x, y), max(x, y))
    idx = -np.ones(n, int)
    keepv = np.where(alive_v)[0]
    idx[keepv] = np.arange(len(keepv))
    Tn = np.array([[idx[v] for v in tris[k]] for k in range(len(tris)) if alive_t[k]])
    return P[keepv], Tn, (A[keepv] if A is not None else None)
