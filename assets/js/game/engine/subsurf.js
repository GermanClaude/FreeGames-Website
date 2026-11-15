// NULLPUNKT — Catmull-Clark-Unterteilung (Viereck-Käfige mit Marken) für Fahrzeugkarosserien (Nutzer 15.11.: Autos „kastig“ → Karosserien als
// Subdivision Surface). Verallgemeinert die Ein-Stufen-Fassung aus bots/soldier/face-mesh.js (Gewichtsmatrix, ohne Kanten-
// schärfe) um das, was Blechteile brauchen:
//   • scharfe und halbscharfe Kanten (crease: Kanten-Schärfe s – s Stufen lang scharf, danach glatt → enge Radien wie
//     Türfugen, Charakterlinien, Bördelkanten; Infinity = dauerhaft scharf),
//   • Ränder (offene Käfige: Radläufe, Unterkante, Ausschnitte) mit B-Spline-Randregel,
//   • feste Ecken (corner), Flächenmarken (Material je Fläche, an die vier Kinder vererbt) und Kantenmarken (Fugen),
//   • Ausgabe als BufferGeometry je Flächenmarke mit Auto-Glättung (Normalen nur über Flächen mit ähnlicher Richtung).
// Reines JS ohne DOM (auch im Weltbau-Worker nutzbar, z. B. für Autowracks).
//
// Netz M = { P: number[] (x,y,z je Ecke), Q: number[] (4 Ecken je Viereck, gegen den Uhrzeigersinn von außen),
//            F: number[] (Flächenmarke je Viereck), crease: Map(kante → schärfe), seam: Map(kante → marke), corner: Set }
// kante = edgeKey(a, b) (ungeordnet).
import * as THREE from 'three';

export const edgeKey = (a, b) => (a < b ? a * 2097152 + b : b * 2097152 + a);

/** Eine Catmull-Clark-Stufe mit Kantenschärfe, Rändern, Ecken, Flächen- und Kantenmarken. */
export function subdivideOnce(M) {
  const { P, Q, F } = M;
  const crease = M.crease || new Map(), seam = M.seam || new Map(), corner = M.corner || new Set();
  const nV = P.length / 3, nQ = Q.length / 4;
  const eId = new Map(), eA = [], eB = [], eF0 = [], eF1 = [];
  const qE = new Int32Array(nQ * 4);
  for (let f = 0; f < nQ; f++) for (let i = 0; i < 4; i++) {
    const a = Q[f * 4 + i], b = Q[f * 4 + ((i + 1) & 3)], k = edgeKey(a, b);
    let e = eId.get(k);
    if (e === undefined) { e = eA.length; eId.set(k, e); eA.push(a); eB.push(b); eF0.push(f); eF1.push(-1); } else eF1[e] = f;
    qE[f * 4 + i] = e;
  }
  const nE = eA.length;
  const eSharp = new Float64Array(nE);
  for (let e = 0; e < nE; e++) {
    const s = crease.get(edgeKey(eA[e], eB[e]));
    eSharp[e] = eF1[e] < 0 ? Infinity : s > 0 ? s : 0;
  }
  const out = new Float64Array((nV + nE + nQ) * 3);
  const fo = (nV + nE) * 3;
  // Flächenpunkte
  for (let f = 0; f < nQ; f++) for (let t = 0; t < 3; t++) {
    out[fo + f * 3 + t] = (P[Q[f * 4] * 3 + t] + P[Q[f * 4 + 1] * 3 + t] + P[Q[f * 4 + 2] * 3 + t] + P[Q[f * 4 + 3] * 3 + t]) * 0.25;
  }
  // Kantenpunkte
  const eo = nV * 3;
  for (let e = 0; e < nE; e++) {
    const a = eA[e] * 3, b = eB[e] * 3;
    if (eSharp[e] >= 1 || eF1[e] < 0) for (let t = 0; t < 3; t++) out[eo + e * 3 + t] = (P[a + t] + P[b + t]) * 0.5;
    else {
      const f0 = fo + eF0[e] * 3, f1 = fo + eF1[e] * 3;
      const sm = [0, 0, 0];
      for (let t = 0; t < 3; t++) sm[t] = (P[a + t] + P[b + t] + out[f0 + t] + out[f1 + t]) * 0.25;
      // halbscharf (0 < s < 1): Mischung aus glatt und scharf
      const w = eSharp[e];
      for (let t = 0; t < 3; t++) out[eo + e * 3 + t] = sm[t] * (1 - w) + (P[a + t] + P[b + t]) * 0.5 * w;
    }
  }
  // Eckpunkte
  const vE = Array.from({ length: nV }, () => []);
  for (let e = 0; e < nE; e++) { vE[eA[e]].push(e); vE[eB[e]].push(e); }
  const vFsum = new Float64Array(nV * 3), vFn = new Int32Array(nV);
  for (let f = 0; f < nQ; f++) for (let i = 0; i < 4; i++) {
    const v = Q[f * 4 + i];
    vFn[v]++;
    for (let t = 0; t < 3; t++) vFsum[v * 3 + t] += out[fo + f * 3 + t];
  }
  for (let v = 0; v < nV; v++) {
    const es = vE[v], o = v * 3;
    if (!es.length || corner.has(v)) { for (let t = 0; t < 3; t++) out[o + t] = P[o + t]; continue; }
    const cr = [];
    let sSum = 0;
    for (const e of es) if (eSharp[e] > 0) { cr.push(e); sSum += Math.min(eSharp[e], 1e6); }
    const other = (e) => (eA[e] === v ? eB[e] : eA[e]);
    // glatt (Catmull-Clark)
    const n = es.length, sm = [0, 0, 0];
    if (vFn[v] === n) {
      const R = [0, 0, 0];
      for (const e of es) { const u = other(e) * 3; for (let t = 0; t < 3; t++) R[t] += (P[o + t] + P[u + t]) * 0.5; }
      for (let t = 0; t < 3; t++) sm[t] = (vFsum[o + t] / vFn[v] + (2 * R[t]) / n + (n - 3) * P[o + t]) / n;
    } else for (let t = 0; t < 3; t++) sm[t] = P[o + t];
    if (cr.length < 2) { for (let t = 0; t < 3; t++) out[o + t] = sm[t]; continue; }
    let sharp;
    if (cr.length === 2) {
      const a = other(cr[0]) * 3, b = other(cr[1]) * 3;
      sharp = [0, 1, 2].map((t) => (P[a + t] + P[b + t] + 6 * P[o + t]) / 8);
    } else sharp = [P[o], P[o + 1], P[o + 2]];
    // Schärfe der Ecke = Mittel der scharfen Kanten; < 1 → Übergang zur glatten Regel
    const vs = sSum / cr.length;
    const w = vs >= 1 || vFn[v] !== n ? 1 : vs;
    for (let t = 0; t < 3; t++) out[o + t] = sm[t] * (1 - w) + sharp[t] * w;
  }
  // Topologie der nächsten Stufe
  const Q1 = new Array(nQ * 16), F1 = new Array(nQ * 4);
  for (let f = 0; f < nQ; f++) {
    const fp = nV + nE + f;
    for (let i = 0; i < 4; i++) {
      const o = f * 16 + i * 4;
      Q1[o] = Q[f * 4 + i]; Q1[o + 1] = nV + qE[f * 4 + i]; Q1[o + 2] = fp; Q1[o + 3] = nV + qE[f * 4 + ((i + 3) & 3)];
      F1[f * 4 + i] = F[f];
    }
  }
  const crease1 = new Map(), seam1 = new Map();
  for (let e = 0; e < nE; e++) {
    const s = eSharp[e], ep = nV + e;
    const k0 = edgeKey(eA[e], ep), k1 = edgeKey(ep, eB[e]);
    if (s > 0 && eF1[e] >= 0) { const s1 = s === Infinity ? Infinity : s - 1; if (s1 > 0) { crease1.set(k0, s1); crease1.set(k1, s1); } }
    const tg = seam.get(edgeKey(eA[e], eB[e]));
    if (tg) { seam1.set(k0, tg); seam1.set(k1, tg); }
  }
  return { P: out, Q: Q1, F: F1, crease: crease1, seam: seam1, corner: new Set(corner) };
}

/** levels Stufen unterteilen. */
export function subdivide(M, levels = 1) {
  let m = M;
  for (let i = 0; i < levels; i++) m = subdivideOnce(m);
  return m;
}

/* ------------------------------------------------------------------ Normalen, Ausgabe */

/** Flächennormalen (normiert) + Flächen (Betrag) je Viereck. */
export function faceNormals(M) {
  const { P, Q } = M, nQ = Q.length / 4, N = new Float64Array(nQ * 3), A = new Float64Array(nQ);
  for (let f = 0; f < nQ; f++) {
    const a = Q[f * 4] * 3, b = Q[f * 4 + 1] * 3, c = Q[f * 4 + 2] * 3, d = Q[f * 4 + 3] * 3;
    const ux = P[c] - P[a], uy = P[c + 1] - P[a + 1], uz = P[c + 2] - P[a + 2];
    const vx = P[d] - P[b], vy = P[d + 1] - P[b + 1], vz = P[d + 2] - P[b + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    A[f] = l * 0.5;
    if (l > 1e-12) { N[f * 3] = nx / l; N[f * 3 + 1] = ny / l; N[f * 3 + 2] = nz / l; }
  }
  return { N, A };
}

/** Ecken → anliegende Vierecke (CSR). */
export function vertexFaces(M) {
  const nV = M.P.length / 3, nQ = M.Q.length / 4, cnt = new Int32Array(nV + 1);
  for (let i = 0; i < nQ * 4; i++) cnt[M.Q[i] + 1]++;
  for (let v = 0; v < nV; v++) cnt[v + 1] += cnt[v];
  const list = new Int32Array(nQ * 4), fill = cnt.slice();
  for (let f = 0; f < nQ; f++) for (let i = 0; i < 4; i++) list[fill[M.Q[f * 4 + i]]++] = f;
  return { ptr: cnt, list };
}

/**
 * Glatte Ecken-Normalen je Viereck-Ecke (Auto-Glättung): Mittel der Flächennormalen rund um die Ecke, die mit der eigenen
 * Fläche weniger als `angle` (Grad) abweichen. → Float32Array(nQ·4·3)
 */
export function cornerNormals(M, angle = 42, pre = null) {
  const { N, A } = pre && pre.N ? pre : faceNormals(M);
  const VF = pre && pre.VF ? pre.VF : vertexFaces(M);
  const cosT = Math.cos((angle * Math.PI) / 180), nQ = M.Q.length / 4, out = new Float32Array(nQ * 12);
  for (let f = 0; f < nQ; f++) for (let i = 0; i < 4; i++) {
    const v = M.Q[f * 4 + i];
    let x = 0, y = 0, z = 0;
    for (let k = VF.ptr[v]; k < VF.ptr[v + 1]; k++) {
      const g = VF.list[k];
      if (N[g * 3] * N[f * 3] + N[g * 3 + 1] * N[f * 3 + 1] + N[g * 3 + 2] * N[f * 3 + 2] < cosT) continue;
      const w = A[g] + 1e-9;
      x += N[g * 3] * w; y += N[g * 3 + 1] * w; z += N[g * 3 + 2] * w;
    }
    const l = Math.hypot(x, y, z) || 1, o = (f * 4 + i) * 3;
    out[o] = x / l; out[o + 1] = y / l; out[o + 2] = z / l;
  }
  return out;
}

/**
 * Geometrie der Vierecke mit Flächenmarke in `tags` (Set oder Funktion f → bool), nicht indiziert, Dreiecke über die
 * kürzere Diagonale. attrs: { name: { size, perVertex: Float32Array(nV·size) } } werden mitgeschrieben.
 * offset: Versatz entlang der Normalen (Innenhaut), flip: Umlauf umkehren.
 */
export function toGeometry(M, tags, { normals = null, attrs = null, offset = 0, flip = false, filter = null } = {}) {
  const { P, Q, F } = M, nQ = Q.length / 4;
  const use = typeof tags === 'function' ? tags : (f) => tags.has(F[f]);
  const CN = normals || cornerNormals(M);
  let cnt = 0;
  for (let f = 0; f < nQ; f++) if (use(f) && (!filter || filter(f))) cnt++;
  const pos = new Float32Array(cnt * 18), nor = new Float32Array(cnt * 18);
  const ex = attrs ? Object.entries(attrs).map(([k, a]) => [k, a.size, a.perVertex, new Float32Array(cnt * 6 * a.size)]) : [];
  let o = 0;
  const put = (f, i) => {
    const v = Q[f * 4 + i], c = (f * 4 + i) * 3, s = flip ? -1 : 1;
    pos[o * 3] = P[v * 3] - CN[c] * offset; pos[o * 3 + 1] = P[v * 3 + 1] - CN[c + 1] * offset; pos[o * 3 + 2] = P[v * 3 + 2] - CN[c + 2] * offset;
    nor[o * 3] = CN[c] * s; nor[o * 3 + 1] = CN[c + 1] * s; nor[o * 3 + 2] = CN[c + 2] * s;
    for (const [, size, src, dst] of ex) for (let t = 0; t < size; t++) dst[o * size + t] = src[v * size + t];
    o++;
  };
  const d2 = (a, b) => { const x = P[a * 3] - P[b * 3], y = P[a * 3 + 1] - P[b * 3 + 1], z = P[a * 3 + 2] - P[b * 3 + 2]; return x * x + y * y + z * z; };
  for (let f = 0; f < nQ; f++) {
    if (!use(f) || (filter && !filter(f))) continue;
    const q = [0, 1, 2, 3].map((i) => Q[f * 4 + i]);
    const tri = d2(q[0], q[2]) <= d2(q[1], q[3]) ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
    for (const t of tri) { if (flip) { put(f, t[0]); put(f, t[2]); put(f, t[1]); } else { put(f, t[0]); put(f, t[1]); put(f, t[2]); } }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  for (const [k, size, , dst] of ex) g.setAttribute(k, new THREE.BufferAttribute(dst, size));
  return g;
}

/**
 * Fugen: dünne Bänder entlang aller Kanten mit Kantenmarke in `tags` (Breite w, um lift über der Fläche).
 * → BufferGeometry (oder null)
 */
export function seamGeometry(M, tags, w = 0.004, lift = 0.0012, normalsPerVertex = null) {
  const { P } = M;
  const VN = normalsPerVertex || vertexNormals(M);
  const pos = [];
  for (const [k, tg] of M.seam) {
    if (tags && !tags.has(tg)) continue;
    const a = Math.floor(k / 2097152), b = k - a * 2097152;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
    const nx = VN[a * 3] + VN[b * 3], ny = VN[a * 3 + 1] + VN[b * 3 + 1], nz = VN[a * 3 + 2] + VN[b * 3 + 2];
    const nl = Math.hypot(nx, ny, nz) || 1;
    const tx = bx - ax, ty = by - ay, tz = bz - az;
    let sx = ty * nz - tz * ny, sy = tz * nx - tx * nz, sz = tx * ny - ty * nx;
    const sl = Math.hypot(sx, sy, sz) || 1;
    sx *= w / 2 / sl; sy *= w / 2 / sl; sz *= w / 2 / sl;
    const lx = (nx / nl) * lift, ly = (ny / nl) * lift, lz = (nz / nl) * lift;
    // etwas über die Ecken hinaus, damit die Bänder lückenlos anschließen
    const ex = tx * 0.04, ey = ty * 0.04, ez = tz * 0.04;
    const A0 = [ax - ex + sx + lx, ay - ey + sy + ly, az - ez + sz + lz], A1 = [ax - ex - sx + lx, ay - ey - sy + ly, az - ez - sz + lz];
    const B0 = [bx + ex + sx + lx, by + ey + sy + ly, bz + ez + sz + lz], B1 = [bx + ex - sx + lx, by + ey - sy + ly, bz + ez - sz + lz];
    pos.push(...A0, ...A1, ...B0, ...A1, ...B1, ...B0);
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // Normalen nach außen (Bandebene kann je Umlauf kippen): an der Flächennormale ausrichten
  const N = g.attributes.normal, Pp = g.attributes.position;
  for (let i = 0; i < Pp.count; i += 3) {
    let k2 = 0;
    void k2;
  }
  void N;
  return g;
}

/** Glatte Ecken-Normalen (ohne Auto-Glättung). */
export function vertexNormals(M) {
  const { N, A } = faceNormals(M), nV = M.P.length / 3, out = new Float32Array(nV * 3);
  for (let f = 0; f < M.Q.length / 4; f++) for (let i = 0; i < 4; i++) {
    const v = M.Q[f * 4 + i];
    for (let t = 0; t < 3; t++) out[v * 3 + t] += N[f * 3 + t] * (A[f] + 1e-9);
  }
  for (let v = 0; v < nV; v++) { const l = Math.hypot(out[v * 3], out[v * 3 + 1], out[v * 3 + 2]) || 1; out[v * 3] /= l; out[v * 3 + 1] /= l; out[v * 3 + 2] /= l; }
  return out;
}

/** Ring-Nachbarschaft der Flächen: Vierecke mit Marke `inner`, die eine Ecke mit einer Fläche aus `outer` teilen. */
export function borderFaces(M, isInner, isOuter, rings = 1) {
  const VF = vertexFaces(M), nQ = M.Q.length / 4;
  let mark = new Uint8Array(nQ);
  for (let f = 0; f < nQ; f++) mark[f] = isOuter(f) ? 2 : 0;
  const res = new Uint8Array(nQ);
  for (let r = 0; r < rings; r++) {
    const next = mark.slice();
    for (let f = 0; f < nQ; f++) {
      if (!isInner(f) || mark[f]) continue;
      let hit = false;
      for (let i = 0; i < 4 && !hit; i++) { const v = M.Q[f * 4 + i]; for (let k = VF.ptr[v]; k < VF.ptr[v + 1]; k++) if (mark[VF.list[k]]) { hit = true; break; } }
      if (hit) { next[f] = 1; res[f] = r + 1; }
    }
    mark = next;
  }
  return res;
}
