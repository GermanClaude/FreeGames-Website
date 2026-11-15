// NULLPUNKT — Panzer-Baukasten für gerundete Außenhüllen (Nutzer 15.11.: „außen wirken Turm und Wanne wie Kästen“).
//
//   • armorShell(rings, opts): Hülle aus Querschnitten (Ringe gleicher, gerader Punktzahl, geschlossen) als
//     Unterteilungsfläche (gemeinsames engine/subdiv.js, Catmull-Clark mit Kantenschärfe – auch von den Autos genutzt). Gewalzte Platten: plateRing() setzt je Ecke zwei Stützpunkte (Kantenradius r),
//     capInset/endRings ziehen Stützringe an den Enden ein → ebene Platten mit gerundeten Kanten. Guss: wenige,
//     weiche Ringe ohne Stützpunkte, dazu Gussnarben (Versatz längs der Normalen) und das Gussflag für den Lack-Shader.
//     Liefert eine BufferGeometry mit position, normal und aVehE (Kantenabnutzung aus der Wölbung; Gussflag in .z).
//   • weldSeam(points, r): Schweißraupe (geriffelte Wulst) entlang eines Linienzugs.
//   • ringXY/ringZY/… : Hilfen für Querschnitte (Grundriss je Höhe, Seitenprofil je Breite).
// Lage wie alle Fahrzeuge: vorwärts −z, x rechts, y oben.
import * as THREE from 'three';
import { subdivide, cornerNormals, vertexNormals, toGeometry, edgeKey } from '../engine/subdiv.js?v=20261115041504';

const PI = Math.PI;

/**
 * Querschnitt-Ringe (gerade Punktzahl) → Viereck-Käfig { P, Q, F } für engine/subdiv.js: Vierecke zwischen den Ringen,
 * Deckel als Fächer aus Vierecken um eine Mittelecke (je drei Randecken + Mitte, ohne T-Stöße). Wicklung nach außen.
 */
export function loftCage(rings, { capStart = true, capEnd = true } = {}) {
  const m = rings[0].length, n = rings.length, P = [], Q = [];
  for (const r of rings) for (const p of r) P.push(p[0], p[1], p[2]);
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < m; j++) Q.push(i * m + j, i * m + ((j + 1) % m), (i + 1) * m + ((j + 1) % m), (i + 1) * m + j);
  const cap = (ri, rev) => {
    let cx = 0, cy = 0, cz = 0;
    for (const p of rings[ri]) { cx += p[0]; cy += p[1]; cz += p[2]; }
    const c = P.length / 3;
    P.push(cx / m, cy / m, cz / m);
    for (let j = 0; j < m; j += 2) {
      const a = ri * m + j, b = ri * m + ((j + 1) % m), d = ri * m + ((j + 2) % m);
      if (rev) Q.push(c, d, b, a); else Q.push(c, a, b, d);
    }
  };
  if (capStart) cap(0, true);
  if (capEnd) cap(n - 1, false);
  let vol = 0;
  for (let f = 0; f < Q.length / 4; f++) for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
    const a = Q[f * 4 + i] * 3, b = Q[f * 4 + j] * 3, c = Q[f * 4 + k] * 3;
    vol += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  if (vol < 0) for (let f = 0; f < Q.length / 4; f++) { const t = Q[f * 4 + 1]; Q[f * 4 + 1] = Q[f * 4 + 3]; Q[f * 4 + 3] = t; }
  return { P, Q, F: new Array(Q.length / 4).fill(0), crease: new Map(), corner: new Set() };
}

/** Wölbung je Ecke: Abstand vor der Ebene der Nachbarn / mittlere Kantenlänge (> 0 Außenkante, < 0 Kehle). */
function convexity(M, VN) {
  const { P, Q } = M, nV = P.length / 3;
  const sx = new Float64Array(nV), sy = new Float64Array(nV), sz = new Float64Array(nV), sl = new Float64Array(nV), cnt = new Float64Array(nV);
  for (let f = 0; f < Q.length / 4; f++) for (let i = 0; i < 4; i++) {
    const a = Q[f * 4 + i], b = Q[f * 4 + ((i + 1) & 3)];
    for (const [u, w] of [[a, b], [b, a]]) {
      sx[u] += P[w * 3]; sy[u] += P[w * 3 + 1]; sz[u] += P[w * 3 + 2];
      sl[u] += Math.hypot(P[w * 3] - P[u * 3], P[w * 3 + 1] - P[u * 3 + 1], P[w * 3 + 2] - P[u * 3 + 2]); cnt[u]++;
    }
  }
  const out = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    if (!cnt[v]) continue;
    const k = 1 / cnt[v];
    out[v] = ((P[v * 3] - sx[v] * k) * VN[v * 3] + (P[v * 3 + 1] - sy[v] * k) * VN[v * 3 + 1] + (P[v * 3 + 2] - sz[v] * k) * VN[v * 3 + 2]) / Math.max(1e-6, sl[v] * k);
  }
  return out;
}

/**
 * Vieleck (Ecken [u, v]) → Ring mit Stützpunkten: je Ecke zwei Punkte im Abstand r (höchstens 30 % der Kante) auf den
 * angrenzenden Kanten – nach der Unterteilung eine gerundete Kante mit Radius ≈ r, die Flächen bleiben eben.
 * soft: Liste der Ecken ohne Stützpunkte (laufen weich aus).
 */
export function plateRing(poly, r, soft = null) {
  const n = poly.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i], a = poly[(i + n - 1) % n], b = poly[(i + 1) % n];
    if (soft && soft.includes(i)) { out.push(p.slice()); continue; }
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, la * 0.3), rb = Math.min(r, lb * 0.3);
    out.push([p[0] + (a[0] - p[0]) / la * ra, p[1] + (a[1] - p[1]) / la * ra]);
    out.push([p[0] + (b[0] - p[0]) / lb * rb, p[1] + (b[1] - p[1]) / lb * rb]);
  }
  return out;
}

/** Vieleck um d nach innen versetzen (konvex, Ecken-Gehrung, Mindestmaß 0,2·d). */
export function insetPoly(poly, d) {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1;
  return poly.map((p, i) => {
    const a = poly[(i + n - 1) % n], b = poly[(i + 1) % n];
    const e1 = [p[0] - a[0], p[1] - a[1]], e2 = [b[0] - p[0], b[1] - p[1]];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    const n1 = [-e1[1] / l1 * s, e1[0] / l1 * s], n2 = [-e2[1] / l2 * s, e2[0] / l2 * s];
    let bx = n1[0] + n2[0], by = n1[1] + n2[1];
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl; by /= bl;
    const cos = Math.max(0.35, bx * n1[0] + by * n1[1]);
    return [p[0] + bx * d / cos, p[1] + by * d / cos];
  });
}

/** Grundriss-Ring (x, v = vorwärts) in Höhe y → 3D (z = −v). */
export const ringXY = (poly2, y) => poly2.map(([x, v]) => [x, y, -v]);
/** Seitenprofil-Ring (u = vorwärts, y) bei Breite x → 3D. */
export const ringZY = (poly2, x) => poly2.map(([u, y]) => [x, y, -u]);

/**
 * Seitenprofil-Wanne mit gerundeten Kanten (ersetzt sideExtrude): Profil prof [[u, y], …] (u = vorwärts), Breite w;
 * Kantenradius r im Profil, rs an den Seitenkanten; top: optional schmaleres Profil-Oben (Seitenplatten oben
 * eingezogen um tuck m). → Ringe für armorShell
 */
export function sideHullRings(prof, w, { r = 0.04, rs = 0.04, tuck = 0, soft = null } = {}) {
  const ring = plateRing(prof, r, soft);
  const hw = w / 2;
  const tk = (x, p) => {
    if (!tuck) return x;
    // obere Hälfte des Profils einziehen (geneigte Seitenplatten)
    let y0 = Infinity, y1 = -Infinity;
    for (const q of prof) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const k = Math.max(0, (p[1] - (y0 + y1) / 2) / ((y1 - y0) / 2));
    return Math.sign(x) * (Math.abs(x) - tuck * k);
  };
  const mk = (x, inset) => (inset ? plateRing(insetPoly(prof, inset), r, soft) : ring).map((p) => [tk(x, p), p[1], -p[0]]);
  return [mk(-hw, rs), mk(-hw + rs, 0), mk(hw - rs, 0), mk(hw, rs)];
}

/**
 * Turmhülle aus Grundrissen je Höhe: levels [[y, poly2, r?], …] von unten nach oben; der Deckel oben wird mit einem
 * Stützring (Einzug rTop) gerundet. cast: weiche Ringe (keine Stützpunkte, Radius aus der Unterteilung).
 */
export function stackRings(levels, { r = 0.04, rTop = 0.05, rBot = 0, cast = false, soft = null } = {}) {
  const ring = (poly, rr, y) => ringXY(cast ? poly : plateRing(poly, rr ?? r, soft), y);
  const out = levels.map(([y, poly, rr]) => ring(poly, rr, y));
  if (rTop > 0) {
    const [yT, pT, rT] = levels[levels.length - 1];
    out[out.length - 1] = ring(pT, rT, yT - rTop);
    out.push(ring(insetPoly(pT, rTop), (rT ?? r) * 0.8, yT));
  }
  if (rBot > 0) {
    const [y0, p0, r0] = levels[0];
    out[0] = ring(p0, r0, y0 + rBot);
    out.unshift(ring(insetPoly(p0, rBot), (r0 ?? r) * 0.8, y0));
  }
  return out;
}

/** einfacher 3D-Wertrauschen-Hash (Gussnarben, deterministisch). */
function hn(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hn(ix, iy, iz), hn(ix + 1, iy, iz), u), L(hn(ix, iy + 1, iz), hn(ix + 1, iy + 1, iz), u), v),
    L(L(hn(ix, iy, iz + 1), hn(ix + 1, iy, iz + 1), u), L(hn(ix, iy + 1, iz + 1), hn(ix + 1, iy + 1, iz + 1), u), v), w);
}

/**
 * Ringe → BufferGeometry (Unterteilungsfläche). opts: levels (Stufen), cast (Gussnarben + Gussflag), castAmp (m), caps,
 * smoothAngle (Grad), wear (Kantenabnutzung aus der Wölbung), crease: [[ringA, idxA, ringB, idxB, s]] – scharfe
 * Käfigkanten (z. B. Stoßkante am Turmdach).
 */
export function armorShell(rings, { levels = 2, cast = false, castAmp = 0.006, caps = [true, true], smoothAngle = 40, wear = true, crease = null } = {}) {
  const cage = loftCage(rings, { capStart: caps[0], capEnd: caps[1] });
  const m = rings[0].length;
  if (crease) for (const [ra, ia, rb, ib, s] of crease) cage.crease.set(edgeKey(ra * m + ((ia + m) % m), rb * m + ((ib + m) % m)), s);
  const M = subdivide(cage, levels);
  const VN = vertexNormals(M);
  if (cast && levels > 0) {
    const P = M.P;
    for (let v = 0; v < P.length / 3; v++) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      const d = (vnoise(x * 9, y * 9, z * 9) - 0.5) * castAmp + (vnoise(x * 23 + 5, y * 23, z * 23) - 0.5) * castAmp * 0.45;
      P[v * 3] += VN[v * 3] * d; P[v * 3 + 1] += VN[v * 3 + 1] * d; P[v * 3 + 2] += VN[v * 3 + 2] * d;
    }
  }
  let attrs = null;
  if (wear) {
    // Wölbung → „Abstand zur Kante“ für den Lack-Shader (klein = abgeschabt); Gussflag als +100 in z
    const cv = convexity(M, VN), nV = M.P.length / 3, E = new Float32Array(nV * 3), kk = levels >= 2 ? 0.07 : 0.14;
    for (let v = 0; v < nV; v++) {
      const c = cv[v], d = c > 0.006 ? Math.max(0, 0.03 * (1 - c / kk)) : 9;
      E[v * 3] = d; E[v * 3 + 1] = d; E[v * 3 + 2] = d + (cast ? 100 : 0);
    }
    attrs = { aVehE: { size: 3, perVertex: E } };
  }
  return toGeometry(M, () => true, { normals: cornerNormals(M, smoothAngle), attrs });
}

/** Schweißraupe: geriffelte Wulst entlang points ([x,y,z]…), Radius r, Riefen alle pitch m. */
export function weldSeam(points, r = 0.012, { pitch = 0.035, radial = 5, flat = 0.55 } = {}) {
  const P = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  let L = 0;
  const cum = [0];
  for (let i = 1; i < P.length; i++) { L += P[i].distanceTo(P[i - 1]); cum.push(L); }
  const n = Math.max(2, Math.round(L / pitch * 2));
  const pos = [], idx = [];
  const T = new THREE.Vector3(), N = new THREE.Vector3(), Bn = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  for (let k = 0; k <= n; k++) {
    const s = (k / n) * L;
    let i = 1;
    while (i < P.length - 1 && cum[i] < s) i++;
    const f = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    const c = P[i - 1].clone().lerp(P[i], f);
    T.subVectors(P[i], P[i - 1]).normalize();
    N.copy(Math.abs(T.dot(up)) > 0.9 ? X : up).addScaledVector(T, -T.dot(Math.abs(T.dot(up)) > 0.9 ? X : up)).normalize();
    Bn.crossVectors(T, N);
    const rip = 1 + 0.22 * Math.cos((s / pitch) * PI * 2) * (k === 0 || k === n ? 0 : 1);
    const rr = (k === 0 || k === n) ? r * 0.3 : r * rip;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * PI * 2;
      const q = c.clone().addScaledVector(N, Math.cos(a) * rr * flat).addScaledVector(Bn, Math.sin(a) * rr);
      pos.push(q.x, q.y, q.z);
    }
  }
  for (let k = 0; k < n; k++) for (let j = 0; j < radial; j++) {
    const a = k * radial + j, b = k * radial + ((j + 1) % radial), c = (k + 1) * radial + ((j + 1) % radial), d = (k + 1) * radial + j;
    idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Linienzug auf einer Ebene: Punkte von a nach b (gerade) – Hilfe für Nähte. */
export const seg = (a, b) => [a, b];
