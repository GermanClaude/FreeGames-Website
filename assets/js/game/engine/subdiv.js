// NULLPUNKT — Catmull-Clark für allgemeine Käfige (Vielecke) – Schnittstelle von vehicles/armorkit.js (Panzerhüllen).
//
// Hinweis (Strang „autos“, 15.11.): Diese Datei wurde versehentlich überschrieben und mit derselben Schnittstelle neu
// geschrieben (subdivide / triangulate / convexity). Die Karosserien der Autos nutzen engine/subsurf.js.
//
//   cage = { pos: number[] (x,y,z je Ecke), faces: number[][] (Vielecke, Umlauf nach außen), crease: Map('a|b' → s) }
//   subdivide(cage, levels) → { pos, faces (nur Vierecke), crease } – Kantenschärfe s: s Stufen scharf (Infinity dauerhaft),
//     Ränder (Kante mit nur einer Fläche) nach der B-Spline-Randregel.
//   triangulate(sub, { smoothAngle (rad), disp(x,y,z) → Versatz längs der Normalen }) → { position, normal } (nicht
//     indiziert, je Fläche nacheinander: Viereck 2 Dreiecke, Vieleck als Fächer).
//   convexity(sub) → Float32Array je Ecke: Wölbung (Mittel 1 − cos des Normalenwinkels zu den Nachbarn, + konvex / − konkav).
const kOf = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function step(M) {
  const P = M.pos, FS = M.faces, crease = M.crease || new Map();
  const nV = P.length / 3, nF = FS.length;
  const eId = new Map(), eA = [], eB = [], eF0 = [], eF1 = [];
  const fE = FS.map((f) => f.map((a, i) => {
    const b = f[(i + 1) % f.length], k = kOf(a, b);
    let e = eId.get(k);
    if (e === undefined) { e = eA.length; eId.set(k, e); eA.push(a); eB.push(b); eF0.push(-1); eF1.push(-1); }
    return e;
  }));
  FS.forEach((f, fi) => { for (const e of fE[fi]) { if (eF0[e] < 0) eF0[e] = fi; else eF1[e] = fi; } });
  const nE = eA.length;
  const sharp = new Float64Array(nE);
  for (let e = 0; e < nE; e++) { const s = crease.get(kOf(eA[e], eB[e])); sharp[e] = eF1[e] < 0 ? Infinity : s > 0 ? s : 0; }
  const out = new Float64Array((nV + nE + nF) * 3), fo = (nV + nE) * 3, eo = nV * 3;
  FS.forEach((f, fi) => { for (const v of f) for (let t = 0; t < 3; t++) out[fo + fi * 3 + t] += P[v * 3 + t] / f.length; });
  for (let e = 0; e < nE; e++) {
    const a = eA[e] * 3, b = eB[e] * 3;
    for (let t = 0; t < 3; t++) {
      const mid = (P[a + t] + P[b + t]) * 0.5;
      if (sharp[e] >= 1 || eF1[e] < 0) out[eo + e * 3 + t] = mid;
      else {
        const sm = (P[a + t] + P[b + t] + out[fo + eF0[e] * 3 + t] + out[fo + eF1[e] * 3 + t]) * 0.25;
        out[eo + e * 3 + t] = sm * (1 - sharp[e]) + mid * sharp[e];
      }
    }
  }
  const vE = Array.from({ length: nV }, () => []), vF = Array.from({ length: nV }, () => []);
  for (let e = 0; e < nE; e++) { vE[eA[e]].push(e); vE[eB[e]].push(e); }
  FS.forEach((f, fi) => { for (const v of f) vF[v].push(fi); });
  for (let v = 0; v < nV; v++) {
    const o = v * 3, es = vE[v];
    if (!es.length) { for (let t = 0; t < 3; t++) out[o + t] = P[o + t]; continue; }
    const other = (e) => (eA[e] === v ? eB[e] : eA[e]);
    const n = es.length, fs = vF[v], sm = [P[o], P[o + 1], P[o + 2]];
    if (fs.length === n) for (let t = 0; t < 3; t++) {
      let Fq = 0, R = 0;
      for (const f of fs) Fq += out[fo + f * 3 + t];
      for (const e of es) R += (P[o + t] + P[other(e) * 3 + t]) * 0.5;
      sm[t] = (Fq / fs.length + (2 * R) / n + (n - 3) * P[o + t]) / n;
    }
    const cr = es.filter((e) => sharp[e] > 0);
    if (cr.length < 2) { for (let t = 0; t < 3; t++) out[o + t] = sm[t]; continue; }
    let sh;
    if (cr.length === 2) { const a = other(cr[0]) * 3, b = other(cr[1]) * 3; sh = [0, 1, 2].map((t) => (P[a + t] + P[b + t] + 6 * P[o + t]) / 8); } else sh = [P[o], P[o + 1], P[o + 2]];
    let vs = 0;
    for (const e of cr) vs += Math.min(sharp[e], 1e6);
    vs /= cr.length;
    const w = vs >= 1 || fs.length !== n ? 1 : vs;
    for (let t = 0; t < 3; t++) out[o + t] = sm[t] * (1 - w) + sh[t] * w;
  }
  const faces = [];
  FS.forEach((f, fi) => {
    const L = f.length;
    for (let i = 0; i < L; i++) faces.push([f[i], nV + fE[fi][i], nV + nE + fi, nV + fE[fi][(i + L - 1) % L]]);
  });
  const c1 = new Map();
  for (let e = 0; e < nE; e++) {
    if (!(sharp[e] > 0) || eF1[e] < 0) continue;
    const s1 = sharp[e] === Infinity ? Infinity : sharp[e] - 1;
    if (s1 > 0) { c1.set(kOf(eA[e], nV + e), s1); c1.set(kOf(nV + e, eB[e]), s1); }
  }
  return { pos: out, faces, crease: c1 };
}

export function subdivide(cage, levels = 1) {
  let m = { pos: Float64Array.from(cage.pos), faces: cage.faces.map((f) => f.slice()), crease: cage.crease || new Map() };
  for (let i = 0; i < levels; i++) m = step(m);
  return m;
}

function faceNormal(P, f) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < f.length; i++) {
    const a = f[i] * 3, b = f[(i + 1) % f.length] * 3;
    x += (P[a + 1] - P[b + 1]) * (P[a + 2] + P[b + 2]);
    y += (P[a + 2] - P[b + 2]) * (P[a] + P[b]);
    z += (P[a] - P[b]) * (P[a + 1] + P[b + 1]);
  }
  const l = Math.hypot(x, y, z);
  return [x / (l || 1), y / (l || 1), z / (l || 1), l * 0.5];
}

function vertexNormals(sub) {
  const P = sub.pos, nV = P.length / 3, N = new Float64Array(nV * 3);
  for (const f of sub.faces) { const n = faceNormal(P, f); for (const v of f) for (let t = 0; t < 3; t++) N[v * 3 + t] += n[t] * (n[3] + 1e-9); }
  for (let v = 0; v < nV; v++) { const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1; N[v * 3] /= l; N[v * 3 + 1] /= l; N[v * 3 + 2] /= l; }
  return N;
}

export function triangulate(sub, { smoothAngle = 0.75, disp = null } = {}) {
  const P0 = sub.pos, nV = P0.length / 3;
  let P = P0;
  if (disp) {
    const VN = vertexNormals(sub);
    P = Float64Array.from(P0);
    for (let v = 0; v < nV; v++) { const d = disp(P0[v * 3], P0[v * 3 + 1], P0[v * 3 + 2]); for (let t = 0; t < 3; t++) P[v * 3 + t] += VN[v * 3 + t] * d; }
  }
  const FN = sub.faces.map((f) => faceNormal(P, f));
  const vF = Array.from({ length: nV }, () => []);
  sub.faces.forEach((f, fi) => { for (const v of f) vF[v].push(fi); });
  const cosT = Math.cos(smoothAngle);
  let nt = 0;
  for (const f of sub.faces) nt += f.length - 2;
  const position = new Float32Array(nt * 9), normal = new Float32Array(nt * 9);
  let o = 0;
  const put = (fi, v) => {
    const n0 = FN[fi];
    let x = 0, y = 0, z = 0;
    for (const g of vF[v]) { const n = FN[g]; if (n[0] * n0[0] + n[1] * n0[1] + n[2] * n0[2] < cosT) continue; x += n[0] * (n[3] + 1e-9); y += n[1] * (n[3] + 1e-9); z += n[2] * (n[3] + 1e-9); }
    const l = Math.hypot(x, y, z) || 1;
    position[o] = P[v * 3]; position[o + 1] = P[v * 3 + 1]; position[o + 2] = P[v * 3 + 2];
    normal[o] = x / l; normal[o + 1] = y / l; normal[o + 2] = z / l;
    o += 3;
  };
  sub.faces.forEach((f, fi) => {
    if (f.length === 4) {
      const d02 = (P[f[0] * 3] - P[f[2] * 3]) ** 2 + (P[f[0] * 3 + 1] - P[f[2] * 3 + 1]) ** 2 + (P[f[0] * 3 + 2] - P[f[2] * 3 + 2]) ** 2;
      const d13 = (P[f[1] * 3] - P[f[3] * 3]) ** 2 + (P[f[1] * 3 + 1] - P[f[3] * 3 + 1]) ** 2 + (P[f[1] * 3 + 2] - P[f[3] * 3 + 2]) ** 2;
      const T = d02 <= d13 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
      for (const t of T) for (const k of t) put(fi, f[k]);
    } else for (let k = 1; k < f.length - 1; k++) { put(fi, f[0]); put(fi, f[k]); put(fi, f[k + 1]); }
  });
  return { position, normal };
}

export function convexity(sub) {
  const P = sub.pos, nV = P.length / 3, N = vertexNormals(sub), out = new Float32Array(nV), cnt = new Float32Array(nV);
  const seen = new Set();
  for (const f of sub.faces) for (let i = 0; i < f.length; i++) {
    const a = f[i], b = f[(i + 1) % f.length], k = kOf(a, b);
    if (seen.has(k)) continue;
    seen.add(k);
    for (const [v, u] of [[a, b], [b, a]]) {
      const c = 1 - (N[v * 3] * N[u * 3] + N[v * 3 + 1] * N[u * 3 + 1] + N[v * 3 + 2] * N[u * 3 + 2]);
      const s = N[v * 3] * (P[u * 3] - P[v * 3]) + N[v * 3 + 1] * (P[u * 3 + 1] - P[v * 3 + 1]) + N[v * 3 + 2] * (P[u * 3 + 2] - P[v * 3 + 2]);
      out[v] += s < 0 ? c : -c;
      cnt[v]++;
    }
  }
  for (let v = 0; v < nV; v++) out[v] /= cnt[v] || 1;
  return out;
}
