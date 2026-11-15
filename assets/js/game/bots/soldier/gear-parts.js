// NULLPUNKT — Formteile für die Soldaten-Ausrüstung (gear.js): kopfgerechte Schalen (Helm, Mütze, Kappe), Kissen/Platten
// mit gerundeten Kanten (Plattenträger, Taschen, Klappen, Schoner), Gurte/Rohre entlang von Pfaden (Kinnriemen, Kantenband,
// Bügel, Mikrofonarm) und Platzierung auf der Kopfoberfläche. Alles erzeugt THREE.BufferGeometry im Modellraum der
// Bindepose (Füße im Ursprung, Blick −Z, rechts +X) mit UV in Metern (Stoff-/Tarnmaßstab wie builder.js).
//
// Kopfhülle (HULL): größter Abstand der Kopfhaut vom Punkt HULL_C je Richtung (θ ab Scheitel 0…180° in 10°-Schritten,
// φ 0…345° in 15°-Schritten, φ = 0 → +X rechts, 90° → +Z hinten, 270° → −Z vorn), gemessen über alle Kopfformen von
// face-mesh.js (SHAPE_PRESETS + Grundform, MakeHuman-Netz) und den Körperkopf aus body-mesh.js (Stufen 1/2), ohne Ohren;
// Lücken gefüllt und so angehoben, dass die bilineare Fläche jede gemessene Ecke abdeckt; beim Laden zusätzlich als obere
// Einhüllende geglättet (HS). Werte in mm. Kopfbedeckungen liegen als
// Versatz über dieser Hülle → sie umschließen jede Kopfform, ohne dass Stirn oder Schädel durchstechen.
import * as THREE from 'three';

export const HULL_C = [0, 1.7, 0.008];
const HULL = [
  [98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98],
  [95, 96, 97, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 97, 96, 95, 96, 97, 96, 97, 96, 95, 98, 96],
  [93, 96, 97, 99, 98, 100, 100, 98, 98, 100, 98, 97, 95, 95, 95, 95, 98, 99, 96, 99, 96, 95, 95, 95],
  [92, 98, 99, 100, 99, 106, 105, 105, 102, 96, 100, 98, 92, 95, 93, 96, 95, 101, 96, 95, 95, 96, 93, 95],
  [92, 97, 93, 106, 109, 102, 101, 102, 107, 105, 100, 97, 92, 94, 93, 94, 96, 98, 95, 95, 99, 94, 93, 94],
  [88, 94, 99, 102, 105, 108, 108, 108, 105, 101, 99, 94, 88, 90, 93, 94, 99, 95, 100, 101, 95, 94, 93, 90],
  [85, 92, 91, 98, 103, 105, 106, 105, 103, 98, 91, 92, 85, 86, 90, 93, 96, 93, 100, 95, 94, 93, 90, 86],
  [82, 83, 91, 95, 101, 101, 105, 101, 101, 95, 90, 83, 80, 81, 88, 93, 100, 98, 100, 97, 100, 93, 88, 81],
  [79, 81, 84, 90, 96, 100, 102, 100, 97, 89, 84, 81, 80, 79, 86, 102, 117, 122, 115, 122, 117, 102, 86, 79],
  [79, 82, 85, 88, 94, 98, 100, 98, 94, 89, 85, 83, 81, 81, 86, 101, 117, 119, 114, 119, 117, 101, 86, 81],
  [80, 82, 85, 87, 94, 96, 99, 96, 92, 87, 85, 83, 81, 79, 89, 109, 120, 106, 126, 107, 118, 108, 89, 79],
  [81, 82, 85, 86, 92, 94, 97, 96, 91, 86, 85, 82, 81, 84, 96, 112, 116, 126, 138, 126, 119, 111, 96, 84],
  [83, 85, 90, 91, 90, 97, 96, 97, 94, 88, 85, 85, 83, 90, 101, 113, 120, 137, 139, 137, 120, 113, 101, 90],
  [94, 104, 99, 94, 108, 104, 105, 96, 107, 97, 92, 99, 112, 100, 109, 119, 132, 146, 150, 146, 132, 120, 114, 98],
  [128, 113, 133, 116, 119, 124, 127, 113, 115, 125, 120, 124, 110, 122, 130, 136, 146, 161, 168, 161, 146, 141, 128, 122],
  [126, 162, 215, 214, 209, 172, 172, 172, 209, 214, 215, 162, 126, 138, 142, 145, 152, 158, 159, 158, 152, 145, 142, 138],
  [260, 250, 274, 275, 267, 261, 259, 261, 267, 274, 276, 250, 260, 218, 162, 156, 152, 153, 154, 153, 152, 156, 162, 218],
  [262, 252, 254, 255, 255, 254, 254, 254, 254, 255, 256, 253, 262, 275, 270, 260, 254, 255, 255, 255, 254, 259, 269, 275],
  [254, 253, 253, 254, 255, 255, 254, 254, 254, 255, 255, 254, 254, 254, 253, 252, 253, 254, 254, 255, 254, 253, 252, 254],
];
const NT = HULL.length, NP = HULL[0].length;
// Geglättete obere Einhüllende: Täler zwischen Messspitzen füllen (3 × 3-Mittel, nie unter der Messung) → ruhige Schalen
const HS = (() => {
  let A = HULL.map((r) => r.slice());
  for (let it = 0; it < 8; it++) {
    A = A.map((row, t) => row.map((v, p) => {
      let s = 0, n = 0;
      for (let dt = -1; dt <= 1; dt++) for (let dp = -1; dp <= 1; dp++) {
        const tt = t + dt;
        if (tt < 0 || tt >= NT) continue;
        const w = dt === 0 ? 1 : 0.6;
        s += A[tt][(p + dp + NP) % NP] * w; n += w;
      }
      return Math.max(HULL[t][p], s / n);
    }));
  }
  return A;
})();
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** Hüllradius (m) in Richtung (θ, φ) – bilinear zwischen den Stützstellen. */
export function hullR(th, ph) {
  const t = Math.max(0, Math.min(NT - 1.0001, th / (10 * DEG)));
  let p = (ph / (15 * DEG)) % NP; if (p < 0) p += NP;
  const t0 = Math.floor(t), p0 = Math.floor(p), ft = t - t0, fp = p - p0;
  const p1 = (p0 + 1) % NP, t1 = Math.min(NT - 1, t0 + 1);
  const a = HS[t0][p0] + (HS[t0][p1] - HS[t0][p0]) * fp;
  const b = HS[t1][p0] + (HS[t1][p1] - HS[t1][p0]) * fp;
  return (a + (b - a) * ft) * 0.001;
}

/** Punkt über der Hülle: Richtung (θ, φ), Versatz off (m, Zahl oder Funktion (θ, φ)). */
export function hullP(th, ph, off = 0, out = [0, 0, 0]) {
  if (th < 0) { th = -th; ph += Math.PI; } // negatives θ = über den Scheitel auf die Gegenseite (Bügel)
  const o = typeof off === 'function' ? off(th, ph) : off;
  const r = hullR(th, ph) + o, s = Math.sin(th);
  out[0] = HULL_C[0] + s * Math.cos(ph) * r;
  out[1] = HULL_C[1] + Math.cos(th) * r;
  out[2] = HULL_C[2] + s * Math.sin(ph) * r;
  return out;
}

/** Flächennormale der versetzten Hülle bei (θ, φ) (numerisch, nach außen). */
export function hullN(th, ph, off = 0) {
  if (th < 0) { th = -th; ph += Math.PI; }
  const e = 0.01;
  const tA = Math.max(0, th - e), tB = th + e;
  const a = hullP(tA, ph, off), b = hullP(tB, ph, off);
  const sp = Math.max(Math.sin(th), 0.05);
  const c = hullP(th, ph - e / sp, off), d = hullP(th, ph + e / sp, off);
  const dt = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], dp = [d[0] - c[0], d[1] - c[1], d[2] - c[2]];
  let n = [dp[1] * dt[2] - dp[2] * dt[1], dp[2] * dt[0] - dp[0] * dt[2], dp[0] * dt[1] - dp[1] * dt[0]];
  const p = hullP(th, ph, off);
  const rad = [p[0] - HULL_C[0], p[1] - HULL_C[1], p[2] - HULL_C[2]];
  if (n[0] * rad[0] + n[1] * rad[1] + n[2] * rad[2] < 0) n = n.map((v) => -v);
  const l = Math.hypot(n[0], n[1], n[2]);
  if (!(l > 1e-9) || th < 0.02) return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
  return n.map((v) => v / l);
}

/** Dreiecke so ausrichten, dass sie zur mitgegebenen Normale zeigen (robust bei Polen/Nähten). */
function orient(pos, nrm, idx) {
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx = nrm[a * 3] + nrm[b * 3] + nrm[c * 3], ny = nrm[a * 3 + 1] + nrm[b * 3 + 1] + nrm[c * 3 + 1], nz = nrm[a * 3 + 2] + nrm[b * 3 + 2] + nrm[c * 3 + 2];
    if (fx * nx + fy * ny + fz * nz < 0) { idx[i + 1] = c; idx[i + 2] = b; }
  }
}

function geoOf(pos, nrm, uv, idx, flip = false) {
  if (flip) for (let i = 0; i < nrm.length; i++) nrm[i] = -nrm[i];
  orient(pos, nrm, idx);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData.npUv = [1, 1];
  return g;
}

/**
 * Schale über der Kopfhülle: θ von th0(φ) bis th1(φ), Versatz off(θ, φ). nph Spalten rundum (bzw. über phLen), nth Reihen.
 * flip: Innenseite (Normalen nach innen, z. B. Helmfutter). UV ≈ Meter (u entlang φ, v entlang θ).
 */
export function hullShell({ th0 = () => 0, th1, off = 0, nph = 24, nth = 8, phStart = 0, phLen = TAU, flip = false }) {
  const pos = [], nrm = [], uv = [], idx = [];
  const f0 = typeof th0 === 'function' ? th0 : () => th0, f1 = typeof th1 === 'function' ? th1 : () => th1;
  for (let i = 0; i <= nph; i++) {
    const ph = phStart + (phLen * i) / nph;
    const a = f0(ph), b = f1(ph);
    for (let j = 0; j <= nth; j++) {
      // Reihen zum Rand hin dichter (Rand trägt die Silhouette)
      const s = j / nth, t = a + (b - a) * (s * 0.35 + (1 - (1 - s) * (1 - s)) * 0.65);
      const p = hullP(t, ph, off), n = hullN(t, ph, off);
      pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]);
      uv.push(ph * 0.1, t * 0.1);
    }
  }
  const R = nth + 1;
  for (let i = 0; i < nph; i++) for (let j = 0; j < nth; j++) {
    const k = i * R + j;
    idx.push(k, k + R, k + 1, k + 1, k + R, k + R + 1);
  }
  return geoOf(pos, nrm, uv, idx, flip);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * Profil entlang eines Pfads ziehen (Gurt, Kantenband, Rohr, Bügel). pts: [[x,y,z]…], ups: Bezugsrichtung je Punkt (oder
 * eine für alle) – Profil-y zeigt dorthin; profile: geschlossenes 2D-Profil [[a, b]…] (a quer, b entlang ups).
 * opts: { closed (Ring), caps (Endkappen), smooth (weiche Profilnormalen; sonst je Kante), scale(i) → Profilfaktor }
 */
export function sweep(pts, ups, profile, { closed = false, caps = true, smooth = null, scale = null } = {}) {
  const n = pts.length, m = profile.length;
  const sm = smooth == null ? m > 4 : smooth;
  // Profilnormalen (2D, nach außen – Profil gegen den Uhrzeigersinn)
  const pn = [];
  for (let k = 0; k < m; k++) {
    const p = profile[(k - 1 + m) % m], q = profile[k], r = profile[(k + 1) % m];
    const e1 = [q[1] - p[1], -(q[0] - p[0])], e2 = [r[1] - q[1], -(r[0] - q[0])];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    pn.push({ prev: [e1[0] / l1, e1[1] / l1], next: [e2[0] / l2, e2[1] / l2] });
  }
  const pos = [], nrm = [], uv = [], idx = [];
  const frames = [];
  let arc = 0;
  for (let i = 0; i < n; i++) {
    const P = pts[i];
    const A = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)], B = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    const T = norm(sub(B, A));
    const up = Array.isArray(ups[0]) ? ups[i] : ups;
    let N = sub(up, T.map((v) => v * dot(up, T)));
    N = norm(N);
    const Bn = cross(T, N);
    if (i > 0) arc += Math.hypot(...sub(P, pts[i - 1]));
    frames.push({ P, N, B: Bn, arc, s: scale ? scale(i) : 1 });
  }
  // Ecken: weich (eine Ecke je Profilpunkt) oder hart (zwei je Profilpunkt)
  const per = sm ? m : m * 2;
  for (const f of frames) {
    let v = 0;
    for (let k = 0; k < m; k++) {
      const q = profile[k];
      const x = q[0] * f.s, y = q[1] * f.s;
      const P = [f.P[0] + f.B[0] * x + f.N[0] * y, f.P[1] + f.B[1] * x + f.N[1] * y, f.P[2] + f.B[2] * x + f.N[2] * y];
      const ns = sm ? [[(pn[k].prev[0] + pn[k].next[0]), (pn[k].prev[1] + pn[k].next[1])]] : [pn[k].prev, pn[k].next];
      if (k > 0) v += Math.hypot(q[0] - profile[k - 1][0], q[1] - profile[k - 1][1]) * f.s;
      for (const d of ns) {
        const N3 = norm([f.B[0] * d[0] + f.N[0] * d[1], f.B[1] * d[0] + f.N[1] * d[1], f.B[2] * d[0] + f.N[2] * d[1]]);
        pos.push(...P); nrm.push(...N3); uv.push(f.arc, v);
      }
    }
  }
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = i * per, b = ((i + 1) % n) * per;
    for (let k = 0; k < m; k++) {
      const k1 = (k + 1) % m;
      // weich: Ecke k → k1; hart: „next“-Ecke von k → „prev“-Ecke von k1
      const c0 = sm ? k : k * 2 + 1, c1 = sm ? k1 : k1 * 2;
      idx.push(a + c0, b + c0, a + c1, a + c1, b + c0, b + c1);
    }
  }
  if (caps && !closed) {
    for (const [i, sgn] of [[0, -1], [n - 1, 1]]) {
      const f = frames[i];
      const T = norm(cross(f.N, f.B)).map((v) => v * sgn);
      const base = pos.length / 3;
      for (let k = 0; k < m; k++) {
        const q = profile[k];
        pos.push(f.P[0] + f.B[0] * q[0] * f.s + f.N[0] * q[1] * f.s, f.P[1] + f.B[1] * q[0] * f.s + f.N[1] * q[1] * f.s, f.P[2] + f.B[2] * q[0] * f.s + f.N[2] * q[1] * f.s);
        nrm.push(...T); uv.push(q[0], q[1]);
      }
      for (let k = 1; k + 1 < m; k++) idx.push(base, base + k, base + k + 1);
    }
  }
  return geoOf(pos, nrm, uv, idx);
}

/** Rechteckprofil (Breite w quer, Dicke t entlang ups; ups zeigt zur Außenseite). */
export const rectProfile = (w, t) => [[-w / 2, -t / 2], [w / 2, -t / 2], [w / 2, t / 2], [-w / 2, t / 2]];
/** Kreis-/Ellipsenprofil. */
export const roundProfile = (r, seg = 6, ry = r) => Array.from({ length: seg }, (_, i) => [Math.cos((i / seg) * TAU) * r, Math.sin((i / seg) * TAU) * ry]);

/** Pfad auf der Hülle: Stützpunkte [[θ°, φ°]…] (Grad), fein unterteilt; → { pts, ups } mit Versatz off. */
export function hullPath(nodes, off, sub = 3) {
  const pts = [], ups = [];
  for (let i = 0; i < nodes.length; i++) {
    const [t0, p0] = nodes[i];
    const steps = i + 1 < nodes.length ? sub : 1;
    for (let s = 0; s < steps; s++) {
      const f = s / sub;
      const [t1, p1] = i + 1 < nodes.length ? nodes[i + 1] : nodes[i];
      const th = (t0 + (t1 - t0) * f) * DEG, ph = (p0 + (p1 - p0) * f) * DEG;
      pts.push(hullP(th, ph, off)); ups.push(hullN(th, ph, off));
    }
  }
  return { pts, ups };
}

/**
 * Teil auf die Hülle setzen: geo ist mit Außenseite −Z und oben +Y um den Ursprung gebaut; es wird an (θ, φ) (rad) mit
 * Versatz off auf die Fläche gelegt (−Z → Flächennormale, +Y → Richtung Scheitel), spin dreht um die Normale.
 */
export function onHull(geo, th, ph, off = 0, spin = 0) {
  const P = hullP(th, ph, off), n = hullN(th, ph, off);
  const z = n.map((v) => -v);
  // „oben“: Richtung abnehmendes θ (zum Scheitel), an der Normale ausgerichtet
  const q = hullP(Math.max(0, th - 0.05), ph, off);
  let up = sub(q, P);
  if (th < 0.06) up = [-Math.sin(ph) * 0, 0, -1];
  up = norm(sub(up, z.map((v) => v * dot(up, z))));
  let x = norm(cross(up, z));
  if (spin) {
    const c = Math.cos(spin), s = Math.sin(spin);
    const x2 = x.map((v, i) => v * c + up[i] * s), u2 = up.map((v, i) => v * c - x[i] * s);
    x = x2; up = u2;
  }
  const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...up), new THREE.Vector3(...z));
  M.setPosition(P[0], P[1], P[2]);
  geo.applyMatrix4(M);
  return geo;
}

/* ------------------------------------------------------------------ Kissen / Platten */

/** Umriss: konvexes Polygon (gegen den Uhrzeigersinn, x rechts, y oben) mit Eckenradius rc, um ins nach innen versetzt. */
function coreOutline(poly, inset, rc, k) {
  const n = poly.length;
  // Kanten-Innennormalen
  const inN = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    inN.push([-dy / l, dx / l]);
  }
  const pts = [];
  const rho = Math.max(0, rc - inset);
  for (let i = 0; i < n; i++) {
    const V = poly[i], n1 = inN[(i - 1 + n) % n], n2 = inN[i];
    const cdot = n1[0] * n2[0] + n1[1] * n2[1];
    // Eckpunkt des um inset versetzten Polygons
    const f = inset / (1 + cdot);
    const W = [V[0] + (n1[0] + n2[0]) * f, V[1] + (n1[1] + n2[1]) * f];
    const g = rho / (1 + cdot);
    const C = [W[0] + (n1[0] + n2[0]) * g, W[1] + (n1[1] + n2[1]) * g];
    const a0 = Math.atan2(-n1[1], -n1[0]);
    let a1 = Math.atan2(-n2[1], -n2[0]);
    while (a1 < a0) a1 += TAU;
    for (let s = 0; s <= k; s++) {
      const a = a0 + ((a1 - a0) * s) / Math.max(1, k);
      const m = [Math.cos(a), Math.sin(a)];
      pts.push({ p: [C[0] + m[0] * rho, C[1] + m[1] * rho], m });
    }
  }
  return pts;
}

/** Rechteck als Polygon (Mitte 0), optional Schulterausschnitt oben (cut) bzw. schräg abgesetzte untere Ecken (cutB). */
export function rectPoly(w, h, cut = 0, cutB = 0) {
  const x = w / 2, y = h / 2;
  const P = [];
  if (cutB) P.push([-x + cutB, -y], [x - cutB, -y], [x, -y + cutB]); else P.push([-x, -y], [x, -y]);
  if (cut) P.push([x, y - cut], [x - cut, y], [-x + cut, y], [-x, y - cut]); else P.push([x, y], [-x, y]);
  if (cutB) P.push([-x, -y + cutB]);
  return P;
}

/**
 * Kissen/Platte: Umriss poly (bzw. Rechteck w × h), Dicke d, Kantenrundung rb, Eckenradius rc, Wölbung puff (Front bauscht
 * vor), Biegung bend [bx, by] (z += bx·x² + by·y² – legt die Platte um Brust/Knie), k Bogenpunkte je Ecke, fr Frontringe,
 * bv Kantenschritte. Front zeigt nach −Z, Mitte im Ursprung.
 */
export function pad({ w = 0.1, h = 0.1, poly = null, d = 0.03, rb = 0.008, rc = 0.012, puff = 0, bend = [0, 0], k = 3, fr = 2, bv = 4, back = true } = {}) {
  const P0 = poly || rectPoly(w, h);
  // Rundungen an die Maße anpassen (sonst fällt der Kern-Umriss zusammen → entartete Normalen)
  const half = Math.min(Math.max(...P0.map((v) => Math.abs(v[0]))), Math.max(...P0.map((v) => Math.abs(v[1]))));
  rb = Math.max(0.0005, Math.min(rb, d / 2, half - 0.004));
  rc = Math.min(Math.max(rc, rb + 0.0015), half - 0.0015);
  const O = coreOutline(P0, rb, rc, k);
  const N = O.length;
  const rows = []; // je Reihe: Funktion (Umrisspunkt) → { p:[x,y,z], arc }
  const hz = d / 2;
  // Front: Mitte → Kern-Umriss (Wölbung)
  for (let r = 0; r <= fr; r++) {
    const t = r / (fr + 1);
    rows.push((o) => ({ x: o.p[0] * t, y: o.p[1] * t, z: -hz - puff * (1 - t * t), arc: 0, t }));
  }
  // Kante: Winkel 0 (Front) … π (Rücken)
  const bEnd = back ? bv : Math.ceil(bv / 2);
  for (let s = 0; s <= bEnd; s++) {
    const a = (Math.PI * s) / bv;
    rows.push((o) => ({ x: o.p[0] + o.m[0] * rb * Math.sin(a), y: o.p[1] + o.m[1] * rb * Math.sin(a), z: -Math.cos(a) * hz, arc: rb * a, t: 1 }));
  }
  if (back) for (let r = fr; r >= 0; r--) {
    const t = r / (fr + 1);
    rows.push((o) => ({ x: o.p[0] * t, y: o.p[1] * t, z: hz, arc: rb * Math.PI, t, back: true }));
  }
  const R = rows.length;
  const pos = new Float32Array(R * (N + 1) * 3), uv = new Float32Array(R * (N + 1) * 2);
  for (let r = 0; r < R; r++) for (let c = 0; c <= N; c++) {
    const o = O[c % N], q = rows[r](o);
    let z = q.z + bend[0] * q.x * q.x + bend[1] * q.y * q.y;
    const k3 = (r * (N + 1) + c) * 3;
    pos[k3] = q.x; pos[k3 + 1] = q.y; pos[k3 + 2] = z;
    const k2 = (r * (N + 1) + c) * 2;
    // UV: Front planar, Kante „aufgeklappt“ nach außen, Rücken gespiegelt
    const ext = q.arc;
    uv[k2] = q.back ? -q.x : q.x + o.m[0] * ext; uv[k2 + 1] = q.y + o.m[1] * ext;
  }
  const idx = [];
  for (let r = 0; r + 1 < R; r++) for (let c = 0; c < N; c++) {
    const a = r * (N + 1) + c, b = a + N + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nr = g.attributes.normal.array;
  // Naht (Spalte 0 = Spalte N) und Mittelpunkte (Pole) mitteln
  for (let r = 0; r < R; r++) {
    const a = r * (N + 1) * 3, b = (r * (N + 1) + N) * 3;
    for (let c = 0; c < 3; c++) { const v = (nr[a + c] + nr[b + c]) / 2; nr[a + c] = nr[b + c] = v; }
  }
  for (const r of [0, R - 1]) {
    if (r === R - 1 && !back) continue;
    const s = [0, 0, 0];
    for (let c = 0; c <= N; c++) for (let j = 0; j < 3; j++) s[j] += nr[(r * (N + 1) + c) * 3 + j];
    const l = Math.hypot(...s) || 1;
    for (let c = 0; c <= N; c++) for (let j = 0; j < 3; j++) nr[(r * (N + 1) + c) * 3 + j] = s[j] / l;
  }
  // Ausrichtung prüfen (Front muss nach −Z zeigen)
  orient(pos, nr, g.index.array);
  g.attributes.normal.needsUpdate = true;
  g.userData.npUv = [1, 1];
  return g;
}

/** Geometrie mit Matrix aus { p, r (Euler XYZ), s } transformieren (wie builder.xf, ohne UV-Maßstab). */
export function place(geo, { p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'XYZ')), typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s));
  geo.applyMatrix4(m);
  return geo;
}

/** Glatte Kurve (Catmull-Rom) durch Stützpunkte, n Punkte gesamt. */
export function curve(nodes, n = 12) {
  const c = new THREE.CatmullRomCurve3(nodes.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  return c.getPoints(n - 1).map((v) => [v.x, v.y, v.z]);
}
