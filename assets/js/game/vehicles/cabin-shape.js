// NULLPUNKT — Formteile für die Panzer-Innenräume (Nutzer 20.11.: „Innenraum zu kantig, glatt und undetailliert, es fehlen
// die Gebrauchsspuren“).
//
// Grundkörper ohne harte CG-Kanten und die Kantenmaske für den Innenraum-Shader:
//   cbox      Kasten mit Fase und gewichteten Normalen (Flächen bleiben eben, die Fase schattiert weich von Fläche zu Fläche –
//             so wirkt eine 3–6-mm-Fase wie eine gerundete Blechkante), 44 Dreiecke
//   ccyl      Zylinder mit gefasten Stirnkanten (gewichtete Normalen), auch offen
//   prism     gerundetes Prisma (Grundriss mit Eckradien, Stirnseiten mit Hohlkehlen/Rundungen, leichte Wölbung) – Turm-
//             schale, Wannenkampfraum und Fahrerraum statt ebener Polygonflächen (Flächen nach innen gekehrt)
//   quilt     gesteppte Polstermatte (Splitterschutz, Sitzflächen): Kissen zwischen den Steppnähten, eingerollte Ränder
//   bentTube  gebogener Rundstahl mit Radien (Haltegriffe, Bügel)
//   edgeMask  Kantenmaske je Ecke (Attribut cabE): xyz = Abstand zu harten bzw. in Rundungen übergehenden konvexen
//             Kanten je Dreieckskante (linear → exakter Kantenabstand je Fragment, auch nach dem Unterteilen), w = Krümmung
//             (kleine Radien: Fasen, Griffe, Stangen). Der Shader legt dort Grundierung und blankes Metall frei.
// Alles frei gestaltet, nur Geometrie (keine Texturen).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI, HP = PI / 2;

/* ===================================================================== Grundkörper */

/** Gerundeter Kasten (glatte Rundung, Radius r). */
export const rbox = (w, h, d, r = 0.02, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

/** Dreiecksliste → BufferGeometry (Wicklung nach außen relativ zu `out(p)` korrigiert). */
function triGeom(P, N, outFn = null) {
  if (outFn) {
    for (let t = 0; t < P.length; t += 9) {
      const ux = P[t + 3] - P[t], uy = P[t + 4] - P[t + 1], uz = P[t + 5] - P[t + 2];
      const wx = P[t + 6] - P[t], wy = P[t + 7] - P[t + 1], wz = P[t + 8] - P[t + 2];
      const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
      const o = outFn((P[t] + P[t + 3] + P[t + 6]) / 3, (P[t + 1] + P[t + 4] + P[t + 7]) / 3, (P[t + 2] + P[t + 5] + P[t + 8]) / 3);
      if (fx * o[0] + fy * o[1] + fz * o[2] < 0) for (const A of [P, N]) for (let k = 0; k < 3; k++) { const x = A[t + 3 + k]; A[t + 3 + k] = A[t + 6 + k]; A[t + 6 + k] = x; }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  return g;
}

/**
 * Kasten mit Fase c (gewichtete Normalen). c wird auf ≤ 30 % der kleinsten Kante begrenzt; c ≤ 0 → einfacher Kasten.
 * Flächen als Fächer um die Mitte (56 Dreiecke).
 */
export function cbox(w, h, d, c = 0.004) {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  c = Math.min(c, w * 0.3, h * 0.3, d * 0.3);
  if (!(c > 1e-4)) return new THREE.BoxGeometry(w, h, d);
  const ax = hx - c, ay = hy - c, az = hz - c;
  const P = [], N = [];
  const v = (p, n) => { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); };
  const quad = (a, b, cc, dd, na, nb, nc, nd) => { v(a, na); v(b, nb); v(cc, nc); v(a, na); v(cc, nc); v(dd, nd); };
  const H = [hx, hy, hz], Ai = [ax, ay, az];
  // Flächen
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const j = (i + 1) % 3, k = (i + 2) % 3, n = [0, 0, 0]; n[i] = s;
    const pt = (sj, sk) => { const p = [0, 0, 0]; p[i] = s * H[i]; p[j] = sj * Ai[j]; p[k] = sk * Ai[k]; return p; };
    // Fächer um die Flächenmitte: jede Dreieckskante am Rand ist eine eigene Kante → Kantenabstand ohne Sägezahn
    const c = [0, 0, 0]; c[i] = s * H[i];
    const ring = [pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1)];
    for (let q = 0; q < 4; q++) { v(c, n); v(ring[q], n); v(ring[(q + 1) % 4], n); }
  }
  // Kantenfasen (Normalen der angrenzenden Flächen → weich)
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3, k = (i + 2) % 3; // Kante entlang k zwischen Fläche i und j
    for (const si of [-1, 1]) for (const sj of [-1, 1]) {
      const ni = [0, 0, 0]; ni[i] = si; const nj = [0, 0, 0]; nj[j] = sj;
      const pi = (sk) => { const p = [0, 0, 0]; p[i] = si * H[i]; p[j] = sj * Ai[j]; p[k] = sk * Ai[k]; return p; };
      const pj = (sk) => { const p = [0, 0, 0]; p[i] = si * Ai[i]; p[j] = sj * H[j]; p[k] = sk * Ai[k]; return p; };
      quad(pi(-1), pi(1), pj(1), pj(-1), ni, ni, nj, nj);
    }
  }
  // Ecken
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v([sx * hx, sy * ay, sz * az], [sx, 0, 0]); v([sx * ax, sy * hy, sz * az], [0, sy, 0]); v([sx * ax, sy * ay, sz * hz], [0, 0, sz]);
  }
  return triGeom(P, N, (x, y, z) => [x, y, z]);
}

/**
 * Zylinder (Achse Y, wie THREE.CylinderGeometry) mit gefasten Stirnkanten c (gewichtete Normalen). open: ohne Deckel.
 */
export function ccyl(r1, r2, h, seg = 12, c = 0.003, open = false) {
  seg = Math.max(3, seg | 0);
  c = Math.min(c, h * 0.3, Math.max(r1, r2) * 0.3);
  if (open || !(c > 1e-4)) return new THREE.CylinderGeometry(r1, r2, h, seg, 1, open);
  const P = [], N = [];
  const sl = (r1 - r2) / h, nl = Math.hypot(1, sl); // Mantelneigung: Normale (cos, sl, sin)/nl
  const rows = [ // [Radius, y, Normale-Art] von oben nach unten
    [0, h / 2, 'top'], [r1 - c, h / 2, 'top'], [r1, h / 2 - c, 'side'], [r2, -h / 2 + c, 'side'], [r2 - c, -h / 2, 'bot'], [0, -h / 2, 'bot'],
  ];
  const vert = (row, a) => {
    const [r, y, kind] = row, ca = Math.cos(a), sa = Math.sin(a);
    const p = [r * sa, y, r * ca];
    const n = kind === 'top' ? [0, 1, 0] : kind === 'bot' ? [0, -1, 0] : [sa / nl, sl / nl, ca / nl];
    return [p, n];
  };
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * PI * 2, a1 = ((i + 1) / seg) * PI * 2;
    for (let k = 0; k < rows.length - 1; k++) {
      const [p00, n00] = vert(rows[k], a0), [p01, n01] = vert(rows[k], a1), [p10, n10] = vert(rows[k + 1], a0), [p11, n11] = vert(rows[k + 1], a1);
      const push = (p, n) => { P.push(...p); N.push(...n); };
      if (rows[k][0] > 1e-6) { push(p00, n00); push(p10, n10); push(p01, n01); }
      if (rows[k + 1][0] > 1e-6) { push(p01, n01); push(p10, n10); push(p11, n11); }
    }
  }
  return triGeom(P, N, (x, y, z) => [x, y * 4, z]);
}

/** Polygon (2D, konvex, gegen den Uhrzeigersinn oder mit) mit Eckradien → { pts: [[u,v]…], nrm: [[nu,nv]…] } (Normalen nach außen). */
export function roundPoly(poly, rc, steps = 4) {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const ccw = area > 0;
  const pts = [], nrm = [], corner = [];
  for (let i = 0; i < n; i++) {
    while (corner.length < pts.length) corner.push(i - 1);
    const p0 = poly[(i + n - 1) % n], p1 = poly[i], p2 = poly[(i + 1) % n];
    const d0 = [p1[0] - p0[0], p1[1] - p0[1]], d1 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l0 = Math.hypot(d0[0], d0[1]), l1 = Math.hypot(d1[0], d1[1]);
    d0[0] /= l0; d0[1] /= l0; d1[0] /= l1; d1[1] /= l1;
    // Außennormalen der beiden Kanten
    const nA = ccw ? [d0[1], -d0[0]] : [-d0[1], d0[0]], nB = ccw ? [d1[1], -d1[0]] : [-d1[1], d1[0]];
    const ang = Math.acos(Math.max(-1, Math.min(1, d0[0] * d1[0] + d0[1] * d1[1])));
    const t = Math.tan(ang / 2);
    const r = Math.min(rc, (Math.min(l0, l1) * 0.45) / Math.max(t, 1e-3));
    if (r < 1e-4 || ang < 1e-3) { pts.push(p1.slice()); const nn = [nA[0] + nB[0], nA[1] + nB[1]], ll = Math.hypot(nn[0], nn[1]); nrm.push([nn[0] / ll, nn[1] / ll]); continue; }
    const tl = r * t; // Tangentenlänge
    const c = [p1[0] - d0[0] * tl - nA[0] * r, p1[1] - d0[1] * tl - nA[1] * r]; // Bogenmitte
    const a0 = Math.atan2(nA[1], nA[0]);
    let da = Math.atan2(nB[1], nB[0]) - a0;
    while (da > PI) da -= 2 * PI; while (da < -PI) da += 2 * PI;
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (da * k) / steps, cx = Math.cos(a), sy = Math.sin(a);
      pts.push([c[0] + cx * r, c[1] + sy * r]); nrm.push([cx, sy]);
    }
  }
  while (corner.length < pts.length) corner.push(n - 1);
  return { pts, nrm, corner };
}

/**
 * Gerundetes Prisma als Raum (Flächen nach innen): Grundriss poly [[u,v]…] (konvex) mit Eckradius rc, Ausdehnung w0…w1
 * entlang der dritten Achse; an w0/w1 Stirnseiten mit Rundung r0/r1 (Hohlkehle des Raums), cap0/cap1: Stirnseite
 * schließen; bulge: Wölbung der Seitenwände nach außen (Mitte). axes: Abbildung (u, v, w) → (x, y, z), z. B. 'xzy'
 * (Turm: u=x, v=z, w=y) oder 'zyx' (Fahrerraum).
 */
export function prism(poly, w0, w1, { rc = 0.1, r0 = 0.04, r1 = 0.06, cap0 = true, cap1 = true, bulge = 0, steps = 4, arcSteps = 3, axes = 'xzy', open = null } = {}) {
  const RP = roundPoly(poly, rc, steps);
  const prof = []; // [inset, w, nI, nW] (Normale des Profils: nI nach außen, nW entlang der Achse)
  const arc = (cw, sgn, r, from) => { // Viertelbogen: Hohlkehle zwischen Wand und Stirnseite
    for (let k = 0; k <= arcSteps; k++) {
      const a = (k / arcSteps) * HP, t = from ? a : HP - a;
      // t = 0: an der Wand (inset 0, w = cw ∓ r), t = 90°: auf der Stirnseite (inset r, w = cw)
      prof.push([r - r * Math.cos(t), cw - sgn * r + sgn * r * Math.sin(t), Math.cos(t), sgn * Math.sin(t)]);
    }
  };
  if (r0 > 1e-4) arc(w0, -1, r0, false); else prof.push([0, w0, 1, 0]);
  const mid = 5;
  for (let k = 1; k < mid; k++) {
    const t = k / mid, w = w0 + r0 + (w1 - r1 - w0 - r0) * t;
    prof.push([-bulge * Math.sin(PI * t), w, 1, -bulge * PI / (w1 - w0) * Math.cos(PI * t)]);
  }
  if (r1 > 1e-4) arc(w1, 1, r1, true); else prof.push([0, w1, 1, 0]);
  const map = (u, v, w) => {
    const o = { x: 0, y: 0, z: 0 };
    o[axes[0]] = u; o[axes[1]] = v; o[axes[2]] = w;
    return [o.x, o.y, o.z];
  };
  const P = [], N = [];
  const nP = RP.pts.length;
  const ringPt = (pi, k) => { const [ins, w] = prof[k]; const p = RP.pts[pi], n = RP.nrm[pi]; return map(p[0] - n[0] * ins, p[1] - n[1] * ins, w); };
  const ringN = (pi, k) => { const [, , nI, nW] = prof[k]; const n = RP.nrm[pi], l = Math.hypot(nI, nW) || 1; return map(-n[0] * nI / l, -n[1] * nI / l, -nW / l); };
  for (let k = 0; k < prof.length - 1; k++) for (let i = 0; i < nP; i++) {
    const j = (i + 1) % nP;
    // open: gerade Stücke dieser Kanten weglassen (Kante i von Ecke i zu Ecke i+1) – Wand mit Öffnung baut der Aufrufer
    if (open && RP.corner[i] !== RP.corner[j] && open.includes(RP.corner[i])) continue;
    const a = ringPt(i, k), b = ringPt(j, k), c = ringPt(j, k + 1), d = ringPt(i, k + 1);
    const na = ringN(i, k), nb = ringN(j, k), nc = ringN(j, k + 1), nd = ringN(i, k + 1);
    for (const [p, n] of [[a, na], [b, nb], [c, nc], [a, na], [c, nc], [d, nd]]) { P.push(...p); N.push(...n); }
  }
  const capTris = (k, wsgn) => {
    const ins = prof[k][0], w = prof[k][1];
    const ring = RP.pts.map((p, i) => new THREE.Vector2(p[0] - RP.nrm[i][0] * ins, p[1] - RP.nrm[i][1] * ins));
    const tris = THREE.ShapeUtils.triangulateShape(ring, []);
    const n = map(0, 0, -wsgn);
    for (const t of tris) for (const ii of t) { P.push(...map(ring[ii].x, ring[ii].y, w)); N.push(...n); }
  };
  if (cap0) capTris(0, -1);
  if (cap1) capTris(prof.length - 1, 1);
  // Wicklung: Normale (nach innen) bestimmt die Vorderseite
  for (let t = 0; t < P.length; t += 9) {
    const ux = P[t + 3] - P[t], uy = P[t + 4] - P[t + 1], uz = P[t + 5] - P[t + 2];
    const wx = P[t + 6] - P[t], wy = P[t + 7] - P[t + 1], wz = P[t + 8] - P[t + 2];
    const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
    const nx = N[t] + N[t + 3] + N[t + 6], ny = N[t + 1] + N[t + 4] + N[t + 7], nz = N[t + 2] + N[t + 5] + N[t + 8];
    if (fx * nx + fy * ny + fz * nz < 0) for (const A of [P, N]) for (let q = 0; q < 3; q++) { const x = A[t + 3 + q]; A[t + 3 + q] = A[t + 6 + q]; A[t + 6 + q] = x; }
  }
  return triGeom(P, N);
}

/**
 * Gesteppte Matte (Vorderseite +Z, liegt bei z = 0 auf): Breite w (X), Höhe h (Y), Stärke t. Kissen zwischen Steppnähten
 * (nx × ny Felder, rauten = diagonal), Ränder eingerollt. res: Rasterpunkte je Feld.
 */
export function quilt(w, h, t, { nx = 3, ny = 2, rauten = false, res = 4, edge = null, sag = 0 } = {}) {
  const e = edge || Math.min(t * 1.6, w * 0.2, h * 0.2);
  const cols = Math.max(2, nx * res), rows = Math.max(2, ny * res);
  const g = new THREE.PlaneGeometry(w, h, cols, rows);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i);
    const dx = Math.min(x + w / 2, w / 2 - x), dy = Math.min(y + h / 2, h / 2 - y);
    const de = Math.max(0, Math.min(dx, dy));
    const roll = Math.sqrt(Math.min(1, de / e)); // eingerollter Rand
    let u = (x / w + 0.5) * nx, v = (y / h + 0.5) * ny;
    if (rauten) { const a = u + v, b = u - v; u = a * 0.5; v = b * 0.5; }
    const q = Math.pow(Math.abs(Math.sin(PI * u)) * Math.abs(Math.sin(PI * v)), 0.3);
    const z = t * roll * (0.62 + 0.38 * q) - sag * (1 - Math.abs(2 * y / h)) * (1 - Math.abs(2 * x / w));
    P.setZ(i, Math.max(0.0005, z));
  }
  g.computeVertexNormals();
  return g;
}

/** Gebogener Rundstahl entlang Eckpunkten (Ecken mit Radius rb gerundet), Radius r. */
export function bentTube(pts, r, rb = 0.03, radial = 8) {
  const V = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const path = new THREE.CurvePath();
  let prev = V[0].clone();
  for (let i = 1; i < V.length - 1; i++) {
    const a = V[i - 1], b = V[i], c = V[i + 1];
    const d0 = b.clone().sub(a), d1 = c.clone().sub(b);
    const l0 = d0.length(), l1 = d1.length();
    const rr = Math.min(rb, l0 * 0.45, l1 * 0.45);
    const p0 = b.clone().addScaledVector(d0.normalize(), -rr), p1 = b.clone().addScaledVector(d1.normalize(), rr);
    if (prev.distanceTo(p0) > 1e-4) path.add(new THREE.LineCurve3(prev.clone(), p0));
    path.add(new THREE.QuadraticBezierCurve3(p0, b.clone(), p1));
    prev = p1;
  }
  path.add(new THREE.LineCurve3(prev, V[V.length - 1].clone()));
  const len = path.getLength();
  return new THREE.TubeGeometry(path, Math.max(6, Math.round(len * 60)), r, radial, false);
}

/* ===================================================================== Kantenmaske */

const FAR = 9;
/**
 * Kantenmaske (nicht indizierte Geometrie, Normalen vorhanden) → Float32Array (vec4 je Ecke).
 * Harte konvexe Kanten (Normalen springen, Nachbar hinter der eigenen Ebene) und Übergänge eben → stark gekrümmt
 * (Fase, Rundung r < ~2 cm) zählen als Kante; Krümmung je Dreieck (Winkel der Eckennormalen / Kantenlänge) → w.
 */
export function edgeMask(g, { curvLo = 22, curvHi = 90 } = {}) {
  const P = g.attributes.position.array, N = g.attributes.normal.array;
  const nv = P.length / 3, nt = (nv / 3) | 0;
  const out = new Float32Array(nv * 4);
  for (let i = 0; i < nv; i++) { out[i * 4] = FAR; out[i * 4 + 1] = FAR; out[i * 4 + 2] = FAR; }
  if (!nt) return out;
  // Krümmung je Dreieck
  const curv = new Float32Array(nt);
  const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, N[a * 3] * N[b * 3] + N[a * 3 + 1] * N[b * 3 + 1] + N[a * 3 + 2] * N[b * 3 + 2])));
  const dist = (a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
  for (let t = 0; t < nt; t++) {
    const a = t * 3, b = a + 1, c = a + 2;
    let k = 0;
    for (const [x, y] of [[a, b], [b, c], [c, a]]) { const l = dist(x, y); if (l > 1e-6) k = Math.max(k, ang(x, y) / l); }
    const m = k <= curvLo ? 0 : k >= curvHi ? 1 : (k - curvLo) / (curvHi - curvLo);
    curv[t] = m;
    if (m > 0) for (let j = 0; j < 3; j++) out[(a + j) * 4 + 3] = Math.max(out[(a + j) * 4 + 3], m);
  }
  // Kanten über Lageschlüssel
  const key = (v) => {
    const x = Math.round(P[v * 3] * 2000), y = Math.round(P[v * 3 + 1] * 2000), z = Math.round(P[v * 3 + 2] * 2000);
    return (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  };
  const vk = new Int32Array(nv);
  for (let v = 0; v < nv; v++) vk[v] = key(v);
  const ek = (a, b) => { const p = vk[a] & 0x3ffffff, q = vk[b] & 0x3ffffff; return p < q ? p * 67108864 + q : q * 67108864 + p; };
  const edges = new Map();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const a = t * 3 + ((k + 1) % 3), b = t * 3 + ((k + 2) % 3), kk = ek(a, b);
    const l = edges.get(kk);
    if (l) l.push(t); else edges.set(kk, [t]);
  }
  const fn = new Float32Array(nt * 3), cen = new Float32Array(nt * 3), area2 = new Float32Array(nt);
  for (let t = 0; t < nt; t++) {
    const i0 = t * 9;
    const ux = P[i0 + 3] - P[i0], uy = P[i0 + 4] - P[i0 + 1], uz = P[i0 + 5] - P[i0 + 2];
    const wx = P[i0 + 6] - P[i0], wy = P[i0 + 7] - P[i0 + 1], wz = P[i0 + 8] - P[i0 + 2];
    let fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
    const l = Math.hypot(fx, fy, fz);
    area2[t] = l;
    if (l > 1e-12) { fx /= l; fy /= l; fz /= l; }
    fn[t * 3] = fx; fn[t * 3 + 1] = fy; fn[t * 3 + 2] = fz;
    cen[t * 3] = (P[i0] + P[i0 + 3] + P[i0 + 6]) / 3; cen[t * 3 + 1] = (P[i0 + 1] + P[i0 + 4] + P[i0 + 7]) / 3; cen[t * 3 + 2] = (P[i0 + 2] + P[i0 + 5] + P[i0 + 8]) / 3;
  }
  const cornerOf = (t2, kv) => { for (let j = 0; j < 3; j++) if (vk[t2 * 3 + j] === kv) return t2 * 3 + j; return -1; };
  for (let t = 0; t < nt; t++) {
    if (area2[t] < 1e-10 || curv[t] > 0.35) continue;
    for (let k = 0; k < 3; k++) {
      const a = t * 3 + ((k + 1) % 3), b = t * 3 + ((k + 2) % 3);
      const list = edges.get(ek(a, b));
      let feat = false;
      if (list) for (const t2 of list) {
        if (t2 === t) continue;
        const a2 = cornerOf(t2, vk[a]), b2 = cornerOf(t2, vk[b]);
        if (a2 < 0 || b2 < 0) continue;
        // hinter der eigenen Ebene → konvex
        const behind = fn[t * 3] * (cen[t2 * 3] - cen[t * 3]) + fn[t * 3 + 1] * (cen[t2 * 3 + 1] - cen[t * 3 + 1]) + fn[t * 3 + 2] * (cen[t2 * 3 + 2] - cen[t * 3 + 2]) < -1e-6;
        const nDot = fn[t * 3] * fn[t2 * 3] + fn[t * 3 + 1] * fn[t2 * 3 + 1] + fn[t * 3 + 2] * fn[t2 * 3 + 2];
        if (curv[t2] > 0.35) { if (behind || nDot < 0.9999) { feat = true; break; } continue; }
        const hard = N[a * 3] * N[a2 * 3] + N[a * 3 + 1] * N[a2 * 3 + 1] + N[a * 3 + 2] * N[a2 * 3 + 2] < 0.985
          || N[b * 3] * N[b2 * 3] + N[b * 3 + 1] * N[b2 * 3 + 1] + N[b * 3 + 2] * N[b2 * 3 + 2] < 0.985;
        if (hard && behind) { feat = true; break; }
      }
      if (!feat) continue;
      const lab = dist(a, b);
      const hgt = lab > 1e-9 ? area2[t] / lab : 0;
      out[(t * 3 + k) * 4 + k] = hgt;
      out[a * 4 + k] = 0;
      out[b * 4 + k] = 0;
    }
  }
  return out;
}

/** Kantenmaske ohne Wirkung (Schilder, Bildschirme, Leinwandflächen). */
export function edgeNone(n) { const a = new Float32Array(n * 4); for (let i = 0; i < n; i++) { a[i * 4] = FAR; a[i * 4 + 1] = FAR; a[i * 4 + 2] = FAR; } return a; }

/**
 * Wand (Ebene z = 0, Vorderseite +Z) über [x0,x1]×[y0,y1] mit rechteckigen Öffnungen holes [[ax, bx, ay, by] …]
 * (Nutzer 21.11.: Durchgang Funkerplatz ↔ Kampfraum). Öffnungsecken leicht gerundet.
 */
export function holeWall(x0, x1, y0, y1, holes = [], r = 0.03) {
  const shp = new THREE.Shape();
  shp.moveTo(x0, y0); shp.lineTo(x1, y0); shp.lineTo(x1, y1); shp.lineTo(x0, y1); shp.lineTo(x0, y0);
  for (const [ax, bx, ay, by] of holes) {
    const h = new THREE.Path(), rr = Math.min(r, (bx - ax) / 3, (by - ay) / 3);
    h.moveTo(ax + rr, ay);
    h.lineTo(bx - rr, ay); h.quadraticCurveTo(bx, ay, bx, ay + rr);
    h.lineTo(bx, by - rr); h.quadraticCurveTo(bx, by, bx - rr, by);
    h.lineTo(ax + rr, by); h.quadraticCurveTo(ax, by, ax, by - rr);
    h.lineTo(ax, ay + rr); h.quadraticCurveTo(ax, ay, ax + rr, ay);
    shp.holes.push(h);
  }
  const g = new THREE.ShapeGeometry(shp, 3);
  return g;
}

/** Laibung/Gang: vier Innenflächen eines Quaders [x0,x1]×[y0,y1]×[z0,z1] (Stirnseiten offen), Flächen nach innen. */
export function tunnel(x0, x1, y0, y1, z0, z1) {
  const P = [], N = [];
  const quad = (a, b, c, d, n) => { for (const p of [a, b, c, a, c, d]) { P.push(...p); N.push(...n); } };
  quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, 1, 0]);   // Boden
  quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, -1, 0]);  // Decke
  quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [1, 0, 0]);   // links
  quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [-1, 0, 0]);  // rechts
  // Wicklung nach der Normale ausrichten
  for (let t = 0; t < P.length; t += 9) {
    const ux = P[t + 3] - P[t], uy = P[t + 4] - P[t + 1], uz = P[t + 5] - P[t + 2], wx = P[t + 6] - P[t], wy = P[t + 7] - P[t + 1], wz = P[t + 8] - P[t + 2];
    const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
    if (fx * N[t] + fy * N[t + 1] + fz * N[t + 2] < 0) for (const A of [P, N]) for (let q = 0; q < 3; q++) { const x = A[t + 3 + q]; A[t + 3 + q] = A[t + 6 + q]; A[t + 6 + q] = x; }
  }
  return triGeom(P, N);
}
