// NULLPUNKT — Karosserie-Baukasten (Nutzer 14.11.: „Autos und Fahrzeuge sehen absolut vereinfacht aus … enorm hoher
// Detailgrad“). Reine Geometrie (nur three, kein DOM → auch im Weltbau-Worker nutzbar, z. B. für Autowracks).
//
//   • profileRing / bodyLoft: Karosserie als Querschnitts-Loft statt Quader – je Station ein halbes Profil (Boden,
//     gerundete Bodenkante, leicht bauchige Flanke mit Einzug nach oben, Schulterradius, gewölbte Oberseite), gespiegelt.
//     Geschlossen (Motorraum, Heck) oder offen als U mit Wandstärke (Kabine: innen sichtbar, von außen durch die Scheiben).
//     Radläufe: die Unterkante folgt dem Radbogen (wie bisher), die Radhausschale liegt als dunkle Halbröhre darin.
//   • greenhouse: Dachaufbau über einer Gürtellinie – gewölbte Front-/Heckscheibe, Seitenscheiben in der eingezogenen
//     Flanke, Säulen (A/B/C/D) als Profilleisten, Dach als gewölbte Platte; Fenstergummis.
//   • seam: Fugen (Türen, Haube, Heckklappe) als feine dunkle Bänder knapp über der Oberfläche.
//   • tire / alloyRim / steelRim / brakeDisc: Reifen mit Schulter, Flanke und Profil (Längsrillen, Lamellen bzw. Stollen),
//     Leichtmetallfelge mit Speichen (Fenster als Löcher einer Extrusion), Stahlfelge mit Lochkranz, Bremsscheibe.
//
// Lage wie alle Fahrzeuge: vorwärts −z, x rechts, y oben. Alle Funktionen liefern BufferGeometry (indiziert, Normalen
// gerechnet); die Aufrufer verschmelzen sie je Material (models.js Bucket bzw. MapBuilder.geom).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI, HP = PI / 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Linienzug [[u, v], …] (u aufsteigend) → v(u), stückweise glatt (Hermite mit Catmull-Rom-Tangenten), geklemmt. */
export function curve(pts) {
  const n = pts.length;
  const tan = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    return (b[1] - a[1]) / ((b[0] - a[0]) || 1);
  });
  return (u) => {
    if (u <= pts[0][0]) return pts[0][1];
    if (u >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 1;
    while (i < n - 1 && u > pts[i][0]) i++;
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], h = x1 - x0 || 1, t = (u - x0) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * tan[i - 1] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * tan[i];
  };
}

/** Radbogen in eine Unterkante einrechnen: y(z) = max(base, Bogen). arches [{ z, y, R }] */
export const withArches = (base, arches) => (z) => {
  let y = base(z);
  for (const a of arches) { const d = Math.abs(z - a.z); if (d < a.R) y = Math.max(y, a.y + Math.sqrt(a.R * a.R - d * d)); }
  return y;
};

/* ------------------------------------------------------------------ Querschnitt */

/**
 * Halbes Profil (x ≥ 0) einer Station: st = { yb, ys, yt, w, wt, rb, rs, crown, bulge }
 *   yb Unterkante, ys Schulter/Gürtel (Ende der Flanke), yt Oberseite Mitte, w größte halbe Breite, wt halbe Breite an der
 *   Schulter (Einzug), rb Bodenkantenradius, rs Schulterradius (≤ yt − ys), crown Wölbung der Oberseite.
 * open = true: nur bis zur Schulter (Kabinen-U). q = Feinheit (Punkte je Rundung). → [[x, y], …] von unten Mitte nach oben.
 */
export function halfProfile(st, open = false, q = 4) {
  const { yb, ys, w } = st;
  const wt = st.wt ?? w - 0.03, rb = Math.min(st.rb ?? 0.08, (ys - yb) * 0.45), crown = st.crown ?? 0.02;
  const out = [[0, yb], [Math.max(0.01, (w - rb) * 0.6), yb]];
  for (let i = 0; i <= q; i++) { const a = -HP + (i / q) * HP; out.push([w - rb + Math.cos(a) * rb, yb + rb + Math.sin(a) * rb]); }
  const y0 = yb + rb, ns = 4, bulge = st.bulge ?? 0.012;
  for (let i = 1; i <= ns; i++) {
    const t = i / ns;
    out.push([lerp(w, wt, t * t) + Math.sin(t * PI) * bulge, lerp(y0, ys, t)]);
  }
  if (open) return out;
  const rs = clamp(st.rs ?? 0.06, 0.01, Math.max(0.01, st.yt - ys));
  const yt = Math.max(st.yt, ys + rs);
  // Schulter: Viertelbogen (gestaucht) von (wt, ys) bis (wt − rs·1.4, yt′) – gestaucht, damit flache Hauben rund bleiben
  const rx = Math.min(rs * 1.5, wt * 0.5), ry = yt - ys;
  for (let i = 1; i <= q; i++) { const a = (i / q) * HP; out.push([wt - rx + Math.cos(a) * rx, ys + Math.sin(a) * ry]); }
  const xe = wt - rx;
  for (const t of [0.66, 0.33]) out.push([xe * t, yt + crown * (1 - t * t)]);
  out.push([0, yt + crown]);
  return out;
}

/** Ganzer Ring aus dem halben Profil: geschlossen (rechts hoch, links runter) bzw. offen (links oben → unten → rechts oben). */
function fullRing(half, open) {
  if (open) {
    const L = half.slice(1).reverse().map(([x, y]) => [-x, y]);
    return [...L, ...half];
  }
  const L = half.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
  return [...half, ...L];
}

/** 2D-Normalen eines (gegen den Uhrzeigersinn laufenden) Linienzugs, nach außen. */
function ringNormals(R, closed) {
  const n = R.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = R[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = R[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    out.push([ty / l, -tx / l]);
  }
  return out;
}

function geomFrom(pos, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Karosserie-Loft über Stationen zs (aufsteigend, vorn → hinten): at(z) → Station (s. halfProfile).
 * opts: open (Kabinen-U mit Wandstärke thick), q (Rundungsfeinheit), caps (geschlossen: Stirnflächen), capStart/capEnd.
 * → BufferGeometry (Stirnflächen mit eigenen Normalen)
 */
export function bodyLoft(zs, at, { open = false, thick = 0.04, q = 4, capStart = true, capEnd = true } = {}) {
  const rings = zs.map((z) => fullRing(halfProfile(at(z), open, q), open));
  const cnt = rings[0].length;
  const pos = [], idx = [];
  const tube = (R, flip) => {
    const base = pos.length / 3;
    rings.forEach((ring, r) => { for (const [x, y] of R ? R(ring) : ring) pos.push(x, y, zs[r]); });
    const wrap = open ? cnt - 1 : cnt;
    for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < wrap; i++) {
      const i2 = (i + 1) % cnt;
      const a = base + r * cnt + i, b = base + r * cnt + i2, c = base + (r + 1) * cnt + i, d = base + (r + 1) * cnt + i2;
      if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  };
  tube(null, false);
  const parts = [];
  if (open) {
    // Innenhaut (versetzt um thick nach innen, umgekehrter Umlauf) + Oberkante (Türbrüstung) links/rechts
    const inner = (ring) => { const N = ringNormals(ring, false); return ring.map(([x, y], i) => [x - N[i][0] * thick, y - N[i][1] * thick]); };
    tube(inner, true);
    parts.push(geomFrom(pos, idx));
    const rp = [], ri = [];
    for (const end of [0, cnt - 1]) {
      const b0 = rp.length / 3;
      rings.forEach((ring, r) => {
        const N = ringNormals(ring, false), [x, y] = ring[end];
        rp.push(x, y, zs[r], x - N[end][0] * thick, y - N[end][1] * thick, zs[r]);
      });
      for (let r = 0; r < rings.length - 1; r++) {
        const a = b0 + r * 2, b = a + 1, c = a + 2, d = a + 3;
        if (end === 0) ri.push(a, b, c, b, d, c); else ri.push(a, c, b, b, c, d);
      }
    }
    parts.push(geomFrom(rp, ri));
  } else {
    parts.push(geomFrom(pos, idx));
    // Stirnflächen (eigene Ecken → harte Kante)
    for (const [r, start] of [[0, true], [rings.length - 1, false]]) {
      if ((start && !capStart) || (!start && !capEnd)) continue;
      const ring = rings[r], cp = [], ci = [];
      let cx = 0, cy = 0;
      for (const [x, y] of ring) { cx += x; cy += y; }
      cp.push(cx / cnt, cy / cnt, zs[r]);
      for (const [x, y] of ring) cp.push(x, y, zs[r]);
      for (let i = 0; i < cnt; i++) { const a = 1 + i, b = 1 + ((i + 1) % cnt); if (start) ci.push(0, b, a); else ci.push(0, a, b); }
      parts.push(geomFrom(cp, ci));
    }
  }
  return merge(parts);
}

/** Geometrien (indiziert/nicht indiziert gemischt) zusammenführen; nur position + normal. */
export function merge(list) {
  const flat = list.filter(Boolean).map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    if (!n.attributes.normal) n.computeVertexNormals();
    return n;
  });
  if (!flat.length) return new THREE.BufferGeometry();
  if (flat.length === 1) return flat[0];
  const m = mergeGeometries(flat, false);
  for (const g of flat) g.dispose();
  return m;
}

/** Punkt auf der Flanke (rechts, x > 0) einer Station bei Höhe y (zwischen Bodenkante und Schulter). */
export function sideX(st, y) {
  const h = halfProfile(st, true, 4);
  for (let i = 1; i < h.length; i++) {
    const [x0, y0] = h[i - 1], [x1, y1] = h[i];
    if (y >= y0 && y <= y1 && y1 > y0) return lerp(x0, x1, (y - y0) / (y1 - y0));
  }
  return h[h.length - 1][0];
}

/* ------------------------------------------------------------------ Flächen, Bänder, Rohre */

/**
 * Parameterfläche fn(u, v) → [x, y, z], u, v ∈ [0, 1], nu × nv Felder. flip kehrt den Umlauf um.
 * thick > 0: zweite, um thick entlang der Normalen versetzte Haut (umgekehrt) + Randstreifen (geschlossene Platte).
 */
export function surface(fn, nu, nv, { flip = false, thick = 0 } = {}) {
  const pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...fn(i / nu, j / nv));
  const W = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = geomFrom(pos, idx);
  if (!thick) return g;
  const N = g.attributes.normal.array, P2 = pos.slice();
  for (let k = 0; k < P2.length; k++) P2[k] -= N[k] * thick;
  const i2 = [];
  for (let k = 0; k < idx.length; k += 3) i2.push(idx[k], idx[k + 2], idx[k + 1]);
  const back = geomFrom(P2, i2);
  // Randstreifen
  const rp = [], ri = [];
  const edge = (list) => {
    const b0 = rp.length / 3;
    for (const v of list) rp.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], P2[v * 3], P2[v * 3 + 1], P2[v * 3 + 2]);
    for (let k = 0; k < list.length - 1; k++) { const a = b0 + k * 2; if (flip) ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  const ring = [];
  for (let i = 0; i <= nu; i++) ring.push(i);
  for (let j = 1; j <= nv; j++) ring.push(j * W + nu);
  for (let i = nu - 1; i >= 0; i--) ring.push(nv * W + i);
  for (let j = nv - 1; j >= 0; j--) ring.push(j * W);
  edge(ring);
  return merge([g, back, geomFrom(rp, ri)]);
}

/**
 * Band entlang eines Punktzugs pts (Weltlage) mit Breite w, quer zu Richtung und Normale nrm(p) (Funktion oder Vektor),
 * um lift entlang der Normalen angehoben (Fugen, Zierleisten, Fenstergummis).
 */
export function ribbon(pts, w, nrm, lift = 0.0015) {
  const pos = [], idx = [], n = new THREE.Vector3(), t = new THREE.Vector3(), s = new THREE.Vector3();
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    t.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const nv = typeof nrm === 'function' ? nrm(p) : nrm;
    n.set(nv[0], nv[1], nv[2]).normalize();
    s.crossVectors(t, n).normalize().multiplyScalar(w / 2);
    pos.push(p[0] + s.x + n.x * lift, p[1] + s.y + n.y * lift, p[2] + s.z + n.z * lift, p[0] - s.x + n.x * lift, p[1] - s.y + n.y * lift, p[2] - s.z + n.z * lift);
  });
  for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  return geomFrom(pos, idx);
}

/** Rohr/Profilleiste durch Punkte (Catmull-Rom), Radius r, radial Segmente. */
export function tube(pts, r, radial = 6, perPt = 3) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  return new THREE.TubeGeometry(c, Math.max(2, pts.length * perPt), r, radial, false);
}

/** Abgerundetes Rechteck als Form (Mitte 0, Breite w, Höhe h, Radius r). */
export function roundRect(w, h, r, shape = new THREE.Shape()) {
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/** Flache, abgerundete Platte (Kennzeichen, Leuchtengläser, Türgriffe): Breite w (x), Höhe h (y), Tiefe d (z, mittig). */
export function roundPlate(w, h, d, r, bevel = 0.004, seg = 3) {
  const b = Math.min(bevel, d / 3);
  const g = new THREE.ExtrudeGeometry(roundRect(w - b * 2, h - b * 2, Math.max(0.001, r - b)), { depth: Math.max(0.001, d - b * 2), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: seg });
  g.translate(0, 0, -d / 2 + b);
  return g;
}

/* ------------------------------------------------------------------ Räder */

/**
 * Reifen (Achse x, Mitte 0): Radius r, Breite w, Felgenhorn rr. kind 'road' (Längsrillen + Lamellen) | 'mud' (Stollen) |
 * 'truck' (Längsrillen, Querrillen) | 'plain'. seg = Umfangssegmente. → Geometrie
 */
export function tire(r, w, rr, { kind = 'road', seg = 40 } = {}) {
  const hw = w / 2;
  // Profil (radial, axial) von innen-links über die Lauffläche nach innen-rechts
  const P = [
    [rr * 0.98, -hw * 0.86], [rr + (r - rr) * 0.18, -hw * 0.98], [rr + (r - rr) * 0.55, -hw * 1.0], [r - (r - rr) * 0.16, -hw * 0.96],
    [r - 0.012, -hw * 0.86], [r, -hw * 0.72],
  ];
  const tread = [];
  const ng = kind === 'plain' ? 0 : kind === 'mud' ? 1 : 3;
  const nt = kind === 'mud' ? 8 : 10;
  for (let i = 0; i <= nt; i++) tread.push(-hw * 0.72 + (i / nt) * hw * 1.44);
  for (const x of tread.slice(1, -1)) P.push([r, x]);
  P.push([r, hw * 0.72], [r - 0.012, hw * 0.86], [r - (r - rr) * 0.16, hw * 0.96], [rr + (r - rr) * 0.55, hw * 1.0], [rr + (r - rr) * 0.18, hw * 0.98], [rr * 0.98, hw * 0.86]);
  // Rillen in der Lauffläche (Längsrillen)
  const grooveAt = (x) => {
    if (!ng) return 0;
    let d = 0;
    for (let k = 1; k <= ng; k++) { const gx = -hw * 0.72 + (k / (ng + 1)) * hw * 1.44; if (Math.abs(x - gx) < hw * 0.09) d = 1; }
    return d;
  };
  const g = new THREE.LatheGeometry(P.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  const pos = g.attributes.position;
  const depth = kind === 'mud' ? r * 0.06 : r * 0.025;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), rad = Math.hypot(x, z);
    if (rad < r - 0.0005) continue;
    const ang = Math.atan2(z, x);
    let cut = grooveAt(y);
    if (kind === 'road') { const s = Math.sin(ang * seg * 0.5 + Math.sign(y) * 0.8); if (Math.abs(y) > hw * 0.45 && s > 0.55) cut = Math.max(cut, 0.6); }
    else if (kind === 'truck') { const s = Math.sin(ang * seg * 0.5); if (s > 0.6 && Math.abs(y) < hw * 0.6) cut = Math.max(cut, 0.5); }
    else if (kind === 'mud') {
      // versetzte Stollen: Feld (Winkel × Seite) entweder Block (voll) oder Lücke
      const k = Math.floor((ang / (2 * PI)) * 16 + (y > 0 ? 0.5 : 0) + 16);
      cut = (k % 2 === 0 || Math.abs(y) < hw * 0.08) ? 1 : 0;
    }
    if (cut) { const f = (rad - depth * cut) / rad; pos.setXYZ(i, x * f, y, z * f); }
  }
  g.rotateZ(HP); // Lathe-Achse y → x
  g.computeVertexNormals();
  return g;
}

/**
 * Leichtmetallfelge (Achse x, Außenseite +x): Felgenradius rr, Schüsseltiefe dw. spokes Anzahl (Doppelspeichen bei twin).
 * → { face, barrel } (face = Stern mit Speichenfenstern, barrel = Felgenbett innen)
 */
export function alloyRim(rr, dw, { spokes = 5, twin = true, seg = 32 } = {}) {
  const sh = new THREE.Shape();
  sh.absarc(0, 0, rr, 0, PI * 2, false);
  const hub = rr * 0.3, rim = rr * 0.86;
  const nWin = twin ? spokes * 2 : spokes;
  const span = (2 * PI) / nWin;
  for (let k = 0; k < nWin; k++) {
    // Doppelspeichen: schmales Fenster zwischen den beiden Speichen eines Paars, breites zwischen den Paaren
    const aw = span * (twin ? (k % 2 ? 0.28 : 0.72) : 0.62);
    const c = k * span + span / 2, h = new THREE.Path();
    const r0 = hub + rr * 0.06, steps = 6;
    h.moveTo(Math.cos(c - aw * 0.3) * r0, Math.sin(c - aw * 0.3) * r0);
    for (let i = 0; i <= steps; i++) { const a = c - aw / 2 + (i / steps) * aw; h.lineTo(Math.cos(a) * rim, Math.sin(a) * rim); }
    h.lineTo(Math.cos(c + aw * 0.3) * r0, Math.sin(c + aw * 0.3) * r0);
    h.closePath();
    sh.holes.push(h);
  }
  const face = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 1, curveSegments: Math.max(6, seg >> 2) });
  face.rotateY(HP); // Form-Ebene → yz, Extrusion → +x
  const barrel = new THREE.CylinderGeometry(rr * 0.98, rr * 0.98, dw, seg, 1, true);
  barrel.rotateZ(HP);
  // Innenseite der Röhre sichtbar machen (Normalen nach innen)
  const ix = barrel.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  barrel.computeVertexNormals();
  return { face, barrel };
}

/** Stahlfelge (Lkw/Transporter/Geländewagen): Scheibe mit Lochkranz, Achse x, Außenseite +x. */
export function steelRim(rr, { holes = 8, seg = 28 } = {}) {
  const sh = new THREE.Shape();
  sh.absarc(0, 0, rr * 0.9, 0, PI * 2, false);
  const hc = rr * 0.62, hr = rr * 0.11;
  for (let k = 0; k < holes; k++) { const a = (k / holes) * PI * 2, h = new THREE.Path(); h.absarc(Math.cos(a) * hc, Math.sin(a) * hc, hr, 0, PI * 2, true); sh.holes.push(h); }
  const hb = new THREE.Path(); hb.absarc(0, 0, rr * 0.16, 0, PI * 2, true); sh.holes.push(hb);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 1, curveSegments: Math.max(6, seg >> 2) });
  g.rotateY(HP);
  return g;
}

/** Bremsscheibe (hinter der Felge): Ring rr·0.78 … 0.42, Achse x. */
export function brakeDisc(rr, seg = 24) {
  const g = new THREE.RingGeometry(rr * 0.34, rr * 0.8, seg, 1);
  g.rotateY(HP);
  return g;
}
