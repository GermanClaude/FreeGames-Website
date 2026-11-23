// NULLPUNKT — Kleinteile für die Panzer-Innenräume (Nutzer 20.11.: „Innenraum extrem detailliert“).
//
// Bausteine, die cabin.js in seine Sammel-Buckets (ein Netz je Material) legt: Sechskantschrauben, Schweißnähte,
// Riffelblech, Sitze mit Polstern/Gurten/Verstellhebel, Schalter unter Schutzbügeln (auch als bewegliche Bedienteile für
// die Simulation), Steckverbinder, Feldflaschen, Verbandkasten, Kuppellampen mit Schutzkorb, Lukenunterseiten mit
// Scharnier und Verriegelung sowie die großen Baugruppen Verschluss (Bodenstück, Keil, Rücklaufbremsen, Rücklaufschutz)
// und Munitionsgestell (Köcher je Granate, Sprengschutztür mit Rahmen, Griff und Rollen bzw. offene Halter).
// Alles frei gestaltet (keine Nachbauten realer Fahrzeuge), Maße plausibel. Nur Geometrie und vorhandene Materialien –
// keine zusätzlichen Texturen (Sampler-Grenze).
//
// B ist ein Sammel-Bucket aus cabin.js (add/rod/tube, Eigenschaft wear = Abnutzung 0…1 für die folgenden Teile).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cbox, ccyl, quilt } from './cabin-shape.js?v=20261123073102';

const PI = Math.PI, HP = PI / 2;
// Nutzer 20.11. („zu kantig“): Kästen/Zylinder mit Fase und gewichteten Normalen, low ohne (setChamfer aus cabin.js)
let CHAMF = 1;
export function setChamfer(on) { CHAMF = on ? 1 : 0; }
export const box = (w, h, d) => (CHAMF ? cbox(w, h, d, Math.max(0.0015, Math.min(0.006, Math.min(w, h, d) * 0.2))) : new THREE.BoxGeometry(w, h, d));
export const rbox = (w, h, d, r = 0.02, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
export const cyl = (r1, r2, h, seg = 12, open = false) => (CHAMF && !open && Math.max(r1, r2) > 0.006 ? ccyl(r1, r2, h, seg, Math.max(0.0008, Math.min(0.004, Math.min(Math.max(r1, r2), h) * 0.15))) : new THREE.CylinderGeometry(r1, r2, h, Math.max(3, seg | 0), 1, open));
export const tor = (R, r, rs = 6, ts = 24, arc = PI * 2) => new THREE.TorusGeometry(R, r, rs, ts, arc);
const _e = new THREE.Euler(), _a = new THREE.Vector3();
const Q = (x = 0, y = 0, z = 0, o = 'XYZ') => new THREE.Quaternion().setFromEuler(_e.set(x, y, z, o));

/** Lokaler Rahmen in einem Bucket: Lage p, Drehung q; Teile in Rahmenkoordinaten (+Z zeigt zum Betrachter). */
export class LF {
  constructor(B, p, q) { this.B = B; this.p = new THREE.Vector3().fromArray(p); this.q = q ? q.clone() : new THREE.Quaternion(); }
  w(l) { return _a.fromArray(l).applyQuaternion(this.q).add(this.p).toArray(); }
  add(geom, mat, lpos = [0, 0, 0], lrot = null, scl = null, keepUV = false) {
    const lq = !lrot ? new THREE.Quaternion() : lrot.isQuaternion ? lrot : Q(lrot[0] || 0, lrot[1] || 0, lrot[2] || 0, lrot[3] || 'XYZ');
    this.B.add(geom, mat, this.w(lpos), this.q.clone().multiply(lq), scl, keepUV);
    return this;
  }
  rod(mat, a, b, r, seg = 8) { const A = this.w(a), Bp = this.w(b); this.B.rod(mat, A, Bp, r, seg); return this; }
  tube(mat, pts, r, radial = 6, perM = 12) { this.B.tube(mat, pts.map((p) => this.w(p)), r, radial, perM); return this; }
}
/** Abnutzung für die Teile in fn setzen (Griffe, Kanten, Trittflächen). */
export function worn(B, w, fn) { const o = B.wear || 0; B.wear = w; try { fn(); } finally { B.wear = o; } }

/** Sechskantschraube mit Scheibe, Achse lokal +Z des Rahmens. */
export function bolt(F, mat, lp, r = 0.007, det = 2) {
  F.add(cyl(r, r, r * 0.8, 6), mat, [lp[0], lp[1], lp[2] + r * 0.4], [HP, 0, 0]);
  if (det > 1) F.add(cyl(r * 1.45, r * 1.45, r * 0.22, 10), mat, [lp[0], lp[1], lp[2] + 0.0005], [HP, 0, 0]);
}
/** Schraubenreihe zwischen a und b (lokal). */
export function boltRow(F, mat, a, b, n, r = 0.007, det = 2) {
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); bolt(F, mat, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], r, det); }
}
/** Niete (Halbkugel), Achse +Z. */
export function rivet(F, mat, lp, r = 0.009) { F.add(new THREE.SphereGeometry(r, 6, 3, 0, PI * 2, 0, HP), mat, lp, [HP, 0, 0]); }
/** Schweißnaht (Raupe) entlang Punkten. */
export function weld(B, mat, pts, r = 0.004) { if (pts.length >= 2) B.tube(mat, pts, r, 4, 28); }

/** Steg (Dach-Prisma ohne Stirnseiten, 4 Dreiecke): Länge l entlang X, Höhe h, Breite w. */
function ridge(l, h, w) {
  const x = l / 2, z = w / 2;
  const P = [-x, 0, -z, x, 0, -z, x, h, 0, -x, 0, -z, x, h, 0, -x, h, 0, -x, h, 0, x, h, 0, x, 0, z, -x, h, 0, x, 0, z, -x, 0, z];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}
/** Riffelblech: rautenförmige Stege im Wechsel auf einer Fläche y (Kreis R um c oder Rechteck). */
export function riffle(B, mat, { c = null, R = 0, rect = null, y, det = 2, skip = null }) {
  const s = det > 1 ? 0.05 : 0.08;
  const [x0, x1, z0, z1] = rect || [c[0] - R, c[0] + R, c[2] - R, c[2] + R];
  let k = 0;
  for (let x = x0 + s / 2; x < x1; x += s) for (let z = z0 + s / 2; z < z1; z += s) {
    k++;
    if (c && (x - c[0]) ** 2 + (z - c[2]) ** 2 > (R - 0.03) ** 2) continue;
    if (skip && skip(x, z)) continue;
    const ang = ((Math.round((x - x0) / s) + Math.round((z - z0) / s)) % 2 ? 0.55 : -0.55);
    B.add(ridge(s * 0.62, 0.0035, s * 0.18), mat, [x, y, z], [0, ang, 0]);
  }
  return k;
}

/**
 * Sitz: Sockel/Säule, Sitzkissen und Lehne gepolstert (Steppung über das Polstermaterial), Seitenwangen, Rahmen,
 * Beckengurt mit Schloss, Verstellhebel mit Knauf. pos = Mitte Sitzfläche (Oberkante), yaw = Blickrichtung (−Z lokal).
 * o: { post (Säulenlänge nach unten), back (Lehne), belt, folded (an der Wand hochgeklappt), pad, w, d }
 */
export function seat(B, C, det, pos, yaw, o = {}) {
  const F = new LF(B, pos, Q(0, yaw, 0));
  const w = o.w || 0.42, d = o.d || 0.4, pad = o.pad || C.pad;
  if (o.folded) {
    // hochgeklappt: Kissen senkrecht an der Wand (lokal +Z = Wand), Scharnierwinkel, Haltegurt
    F.add(rbox(w, d, 0.075, 0.03, det > 1 ? 2 : 1), pad, [0, 0, -0.04]);
    F.add(box(w - 0.04, d - 0.04, 0.012), C.metal, [0, 0, 0.003]);
    for (const sx of [-1, 1]) { F.add(box(0.025, 0.08, 0.05), C.steel, [sx * (w / 2 - 0.05), -d / 2 + 0.02, 0.0]); F.add(cyl(0.012, 0.012, 0.06, 8), C.steel, [sx * (w / 2 - 0.05), -d / 2, 0.01], [0, 0, HP]); }
    if (det) { F.add(box(0.035, d * 0.9, 0.006), C.canvas, [0, 0.01, -0.082]); F.add(box(0.05, 0.03, 0.012), C.steel, [0, -0.12, -0.084]); }
    return F;
  }
  // Kissen: Unterbau + gepolsterte Fläche + Wangen
  F.add(box(w - 0.04, 0.03, d - 0.04), C.metal, [0, -0.07, 0]);
  F.add(rbox(w, 0.075, d, 0.03, det > 1 ? 2 : 1), pad, [0, -0.035, 0]);
  if (det) for (const sx of [-1, 1]) F.add(rbox(0.06, 0.06, d * 0.92, 0.025), pad, [sx * (w / 2 - 0.02), -0.005, 0.01]);
  if (det > 1) F.add(box(w * 0.8, 0.004, 0.006), C.black, [0, 0.003, -d * 0.18]); // Naht
  // Gebrauchsspuren (Nutzer 20.11.): Sitzfläche durchgesessen (Mitte abgegriffen), Flicken, Riss mit Schaumstoff
  if (det) {
    worn(B, 0.75, () => F.add(quilt(w * 0.5, d * 0.45, 0.004, { nx: 1, ny: 1, res: 3 }), pad, [0, 0.0005, 0.02], [-HP, 0, 0]));
    const sd = (o.seed || 1) % 3;
    if (sd !== 2) { // Flicken (aufgenäht) mit Steppnaht
      F.add(quilt(0.11, 0.09, 0.005, { nx: 1, ny: 1, res: 2 }), C.patch || pad, [w * (sd ? -0.22 : 0.18), 0.002, -d * 0.12], [-HP, 0, sd ? 0.3 : -0.2]);
      if (det > 1) for (const sy of [-1, 1]) F.add(box(0.11, 0.0015, 0.003), C.black, [w * (sd ? -0.22 : 0.18), 0.0055, -d * 0.12 + sy * 0.046], [0, sd ? 0.3 : -0.2, 0]);
    }
    if (sd !== 1 && C.foam) { // Riss an der Vorderkante, Schaumstoff quillt heraus
      F.add(box(0.1, 0.012, 0.01), C.black, [w * 0.12, -0.002, -d / 2 + 0.006]);
      for (let i = 0; i < 4; i++) F.add(new THREE.SphereGeometry(0.009 + (i % 2) * 0.004, 6, 4), C.foam, [w * 0.12 - 0.035 + i * 0.022, -0.004 + (i % 2) * 0.003, -d / 2 + 0.008]);
    }
  }
  // Lehne
  if (o.back !== false) {
    const bh = o.backH || 0.42;
    F.add(rbox(w * 0.96, bh, 0.075, 0.03, det > 1 ? 2 : 1), pad, [0, bh / 2 + 0.03, d / 2 + 0.02], [-0.16, 0, 0]);
    F.add(box(w * 0.86, bh * 0.9, 0.02), C.metal, [0, bh / 2 + 0.03, d / 2 + 0.07], [-0.16, 0, 0]);
    if (det) for (const sx of [-1, 1]) F.rod(C.steel, [sx * w * 0.44, -0.06, d / 2 + 0.06], [sx * w * 0.44, bh + 0.02, d / 2 + 0.13], 0.011, 8);
  }
  // Säule bzw. Sockel
  const post = o.post || 0;
  if (post > 0.05) {
    F.add(cyl(0.035, 0.035, post, det ? 12 : 8), C.steel, [0, -0.085 - post / 2, 0]);
    F.add(cyl(0.05, 0.05, post * 0.45, det ? 12 : 8), C.metal, [0, -0.085 - post * 0.75, 0]);
    if (det) for (let i = 0; i < 4; i++) F.add(cyl(0.008, 0.008, 0.074, 6), C.black, [0, -0.11 - i * 0.04, 0], [0, 0, HP]); // Rasterlöcher
    F.add(cyl(0.16, 0.18, 0.025, det ? 16 : 10), C.metal, [0, -0.085 - post, 0]);
    if (det) for (let i = 0; i < 4; i++) { const a = i * HP + 0.4; bolt(new LF(B, F.w([Math.cos(a) * 0.13, -0.072 - post, Math.sin(a) * 0.13]), F.q.clone().multiply(Q(-HP, 0, 0))), C.steel, [0, 0, 0], 0.008, det); }
    // Fußstütze
    if (o.foot) { F.add(box(0.3, 0.02, 0.12), C.metal, [0, -0.085 - post * 0.55, -d / 2 - 0.12], [0.35, 0, 0]); F.rod(C.steel, [0, -0.085 - post * 0.4, 0], [0, -0.085 - post * 0.55, -d / 2 - 0.08], 0.012); }
  } else F.add(box(w * 0.8, 0.06, d * 0.7), C.metal, [0, -0.11, 0]);
  // Gurt: zwei Bänder vom Rahmen, Schloss in der Mitte
  if (o.belt !== false && det) {
    for (const sx of [-1, 1]) F.add(box(0.045, 0.004, d * 0.55), C.canvas, [sx * w * 0.24, 0.004, -0.02], [0, sx * 0.25, 0]);
    worn(B, 0.7, () => F.add(rbox(0.06, 0.012, 0.045, 0.004), C.steel, [0, 0.008, -d * 0.2]));
    for (const sx of [-1, 1]) F.add(box(0.045, 0.06, 0.004), C.canvas, [sx * (w / 2 + 0.005), -0.03, d * 0.05], [0, HP, 0]);
  }
  // Verstellhebel rechts mit rotem Knauf
  if (o.lever !== false) {
    worn(B, 0.8, () => { F.rod(C.steel, [w / 2 + 0.01, -0.07, -0.05], [w / 2 + 0.04, -0.05, -d / 2 - 0.02], 0.007, 6); F.add(cyl(0.013, 0.013, 0.045, 8), C.red, [w / 2 + 0.04, -0.05, -d / 2 - 0.04], [HP, 0, 0]); });
  }
  return F;
}

/**
 * Kippschalter-Einheit mit Schutzbügel und Leuchtmelder (bewegliches Bedienteil für die Simulation): statische Teile
 * (Grundplatte, Schrauben, Bügel, Schild) über den Rahmen F in den Bucket; zurück kommen Lage und Geometrie für Hebel
 * (dreht um lokal X) und Leuchte in Rahmenkoordinaten (+Z zum Insassen) – cabin.js hängt sie als eigene Netze an.
 */
export function switchUnit(B, C, det, F, { w = 0.1, h = 0.075, era = 'modern', lab = null, labelKey = null, guard = true } = {}) {
  const wk = era !== 'modern';
  F.add(rbox(w, h, 0.03, 0.006), wk ? C.metal : C.black, [0, 0, -0.015]);
  if (det) for (const sx of [-1, 1]) for (const sy of [-1, 1]) bolt(F, C.steel, [sx * (w / 2 - 0.009), sy * (h / 2 - 0.009), 0.0], 0.0045, det);
  // Schutzbügel (U aus Rundstahl) beidseits des Kipphebels
  if (guard) worn(B, 0.5, () => {
    for (const sx of [-1, 1]) {
      const x = -0.012 + sx * 0.016;
      F.rod(C.steel, [x, -0.022, 0.0], [x, -0.022, 0.034], 0.002, 5);
      F.rod(C.steel, [x, -0.022, 0.034], [x, 0.022, 0.034], 0.002, 5);
      F.rod(C.steel, [x, 0.022, 0.034], [x, 0.022, 0.0], 0.002, 5);
    }
  });
  F.add(cyl(0.01, 0.01, 0.006, 12), C.steel, [-0.012, 0, 0.003], [HP, 0, 0]);       // Hebelfassung
  F.add(tor(0.0095, 0.0025, 4, 12), C.steel, [w / 2 - 0.022, 0.012, 0.004]);      // Fassung des Leuchtmelders
  if (lab && labelKey) lab(labelKey, [0, -h / 2 - 0.016, 0.0], Math.min(0.14, w * 1.25));
  // Hebel steht aus der Platte heraus (lokal +Z), kippt um X
  const lever = new THREE.CylinderGeometry(0.0034, 0.005, 0.03, 8).rotateX(HP).translate(0, 0, 0.015);
  const knob = new THREE.SphereGeometry(0.006, 8, 6).translate(0, 0, 0.031);
  return { leverAt: [-0.012, 0, 0.006], lampAt: [w / 2 - 0.022, 0.012, 0.006], lever: [lever, knob], lamp: cyl(0.0075, 0.0075, 0.008, 12).rotateX(HP) };
}

/** Runder Steckverbinder mit Rändelring und Kabelauslauf (Rahmen +Z = Steckrichtung aus der Wand). */
export function connector(F, C, lp, det = 2, cableMat = null) {
  F.add(cyl(0.017, 0.017, 0.012, det > 1 ? 12 : 8), C.metal, [lp[0], lp[1], lp[2] + 0.006], [HP, 0, 0]);
  F.add(cyl(0.015, 0.015, 0.028, det > 1 ? 12 : 8), C.black, [lp[0], lp[1], lp[2] + 0.026], [HP, 0, 0]);
  if (det > 1) for (let i = 0; i < 3; i++) F.add(tor(0.0155, 0.0018, 3, 12), C.steel, [lp[0], lp[1], lp[2] + 0.018 + i * 0.007]);
  F.add(cyl(0.008, 0.011, 0.025, 8), cableMat || C.rubber, [lp[0], lp[1], lp[2] + 0.05], [HP, 0, 0]);
}

/** Feldflasche im Halter (an der Wand, Normale lokal +Z). */
export function bottle(B, C, det, F, lp) {
  F.add(cyl(0.048, 0.048, 0.19, det ? 14 : 8), C.olive, [lp[0], lp[1], lp[2] + 0.055]);
  F.add(new THREE.SphereGeometry(0.048, det ? 14 : 8, 5, 0, PI * 2, 0, HP), C.olive, [lp[0], lp[1] + 0.095, lp[2] + 0.055]);
  F.add(cyl(0.02, 0.022, 0.03, 10), C.black, [lp[0], lp[1] + 0.15, lp[2] + 0.055]);
  if (det) { F.add(cyl(0.05, 0.05, 0.03, det ? 14 : 8, true), C.canvas, [lp[0], lp[1] - 0.04, lp[2] + 0.055]); F.add(box(0.11, 0.025, 0.012), C.steel, [lp[0], lp[1] + 0.02, lp[2] + 0.006]); F.add(box(0.012, 0.16, 0.012), C.steel, [lp[0], lp[1], lp[2] + 0.006]); }
}

/** Kuppellampe: Gehäuse, Streuscheibe (eigenes Material, Farbe je Lichtmodus), Schutzkorb, Drehschalter. Rahmen: +Z nach unten in den Raum. */
export function domeLamp(B, C, det, F, lens) {
  F.add(rbox(0.16, 0.1, 0.045, 0.012), C.black, [0, 0, -0.022]);
  F.add(rbox(0.12, 0.065, 0.016, 0.01), lens, [0, 0, 0.004]);
  if (det) {
    worn(B, 0.3, () => {
      for (const sx of [-0.04, 0, 0.04]) F.rod(C.steel, [sx, -0.042, 0.0], [sx, -0.042, 0.028], 0.0025, 4).rod(C.steel, [sx, -0.042, 0.028], [sx, 0.042, 0.028], 0.0025, 4).rod(C.steel, [sx, 0.042, 0.028], [sx, 0.042, 0.0], 0.0025, 4);
    });
    F.add(cyl(0.011, 0.011, 0.018, 10), C.red, [0.07, 0.0, 0.006], [HP, 0, 0]);
    bolt(F, C.steel, [-0.07, 0.04, 0.0], 0.005, det); bolt(F, C.steel, [-0.07, -0.04, 0.0], 0.005, det);
  }
}

/** Verbandkasten (Rahmen +Z von der Wand weg). */
export function firstAid(B, C, det, F, lab) {
  F.add(rbox(0.24, 0.16, 0.09, 0.012), C.olive, [0, 0, 0.045]);
  F.add(box(0.245, 0.006, 0.092), C.black, [0, 0.035, 0.045]);
  worn(B, 0.6, () => { F.rod(C.steel, [-0.05, 0.08, 0.06], [-0.05, 0.095, 0.06], 0.004, 4).rod(C.steel, [0.05, 0.08, 0.06], [0.05, 0.095, 0.06], 0.004, 4).rod(C.steel, [-0.05, 0.095, 0.06], [0.05, 0.095, 0.06], 0.004, 4); });
  if (det) for (const sx of [-1, 1]) F.add(box(0.02, 0.03, 0.01), C.steel, [sx * 0.08, -0.03, 0.093]);
  if (lab) lab('erstehilfe', [0, -0.005, 0.0912], 0.17);
}

/** Lukenunterseite: Dichtring, Scharnierblöcke mit Bolzen, Verriegelungshebel mit Griff, Ausgleichsfeder (Rohr). */
export function hatchInner(B, C, det, c, r, y, hingeAxis = 'x', hingeSide = 1) {
  const [hx, , hz] = c;
  B.add(tor(r + 0.004, 0.012, 5, det ? 32 : 16), C.rubber, [hx, y - 0.01, hz], [HP, 0, 0]);
  // Scharniere auf der Scharnierseite
  const along = hingeAxis === 'x';
  for (const s of [-1, 1]) {
    const p = along ? [hx + s * r * 0.45, y - 0.035, hz + hingeSide * (r + 0.02)] : [hx + hingeSide * (r + 0.02), y - 0.035, hz + s * r * 0.45];
    B.add(rbox(along ? 0.09 : 0.06, 0.06, along ? 0.06 : 0.09, 0.01), C.metal, p);
    B.add(cyl(0.016, 0.016, 0.11, 10), C.steel, p, along ? [0, 0, HP] : [HP, 0, 0]);
  }
  // Ausgleichsfeder (Rohr mit Kappen) parallel zur Scharnierachse
  const sp = along ? [hx, y - 0.06, hz + hingeSide * (r - 0.02)] : [hx + hingeSide * (r - 0.02), y - 0.06, hz];
  B.add(cyl(0.028, 0.028, r * 1.3, 12), C.metal, sp, along ? [0, 0, HP] : [HP, 0, 0]);
  if (det) for (const s of [-1, 1]) B.add(cyl(0.032, 0.032, 0.02, 12), C.steel, along ? [sp[0] + s * r * 0.65, sp[1], sp[2]] : [sp[0], sp[1], sp[2] + s * r * 0.65], along ? [0, 0, HP] : [HP, 0, 0]);
  // Verriegelung: Drehhebel in der Mitte mit zwei Riegeln, Griff gummiert (abgegriffen)
  worn(B, 0.75, () => {
    B.add(cyl(0.035, 0.035, 0.03, 12), C.steel, [hx, y - 0.03, hz]);
    const lx = along ? 0 : 1, lz = along ? 1 : 0;
    B.rod(C.steel, [hx - lx * r * 0.7, y - 0.035, hz - lz * r * 0.7], [hx + lx * r * 0.7, y - 0.035, hz + lz * r * 0.7], 0.011, 8);
    B.rod(C.steel, [hx, y - 0.045, hz], [hx - lz * 0.16, y - 0.09, hz + lx * 0.16], 0.012, 8);
    B.add(cyl(0.017, 0.017, 0.09, 10), C.rubber, [hx - lz * 0.2, y - 0.1, hz + lx * 0.2], along ? [0, 0, HP] : [HP, 0, 0]);
  });
}

/**
 * Verschluss im Verschlussraum (models.js 'breech': Bodenstück 0,5 × 0,48 × 0,42 bei 0, Wiege dahinter, Keil fällt nach
 * unten). body: Bodenstück mit Führungsleisten und Ladeöffnung, Handhebel, Rücklaufbremsen und Vorholer mit Leitungen,
 * Wiege mit Schildzapfen und Schraubenreihen, Abfeuerungsmagnet mit Kabel, Rücklaufschutz (gestreifter Rohrrahmen mit
 * Seitenblechen) und Hülsenabweiser. keil: Keilblock mit Schlagbolzengehäuse, Nuten, Auswerferkrallen und Griff.
 */
export function breechParts(MB, C, det, era, { guard = true } = {}) {
  const modern = era === 'modern', wk1 = era === 'wk1';
  const W = C.wall[era];
  const B = new MB();
  const F = new LF(B, [0, 0, 0]);
  // Bodenstück
  // innen2: geschmiedetes Bodenstück mit Maschinenfasen, plangefräster Stirnfläche, Ringnuten, Seitennuten,
  // Schmiernippeln und Ringschraube; dunkel brünierter, öliger Stahl (C.breech)
  const BS = C.breech || C.steel;
  worn(B, 0.2, () => {
    B.add(det ? cbox(0.5, 0.48, 0.42, 0.028) : rbox(0.5, 0.48, 0.42, 0.03, 1), BS, [0, 0, 0]);
    for (const sx of [-1, 1]) B.add(box(0.035, 0.5, 0.03), BS, [sx * 0.232, 0, 0.212]);
    B.add(box(0.5, 0.05, 0.03), BS, [0, 0.218, 0.212]);
  });
  if (det) {
    B.add(cbox(0.39, 0.37, 0.008, 0.004), BS, [0, -0.01, 0.213]);
    for (const [r, t] of [[0.105, 0.0035], [0.13, 0.0025]]) B.add(tor(r, t, 4, det > 1 ? 32 : 16), C.black, [0, 0, 0.2175]);
    for (const sx of [-1, 1]) for (const gy of [-0.11, 0.0, 0.11]) B.add(box(0.004, 0.01, 0.34), C.black, [sx * 0.2505, gy, -0.01]);
    for (const sx of [-1, 1]) { B.add(cyl(0.006, 0.006, 0.012, 8), C.brass, [sx * 0.256, -0.17, 0.12], [0, 0, HP]); B.add(new THREE.SphereGeometry(0.005, 8, 6), C.brass, [sx * 0.263, -0.17, 0.12]); }
    B.add(tor(0.025, 0.007, 6, 14), C.steel, [0.12, 0.27, -0.05], [0, HP, 0]);
    B.add(cyl(0.016, 0.016, 0.03, 10), C.steel, [0.12, 0.248, -0.05]);
  }
  // Ladeöffnung: Patronenlager-Ring, dunkle Tiefe
  B.add(tor(0.086, 0.012, 6, det ? 24 : 12), wk1 || era === 'wk2' ? C.brass : C.steel, [0, 0, 0.212]);
  B.add(cyl(0.078, 0.078, 0.3, det ? 20 : 10, true), C.black, [0, 0, 0.07], [HP, 0, 0]);
  B.add(cyl(0.079, 0.079, 0.004, det ? 20 : 12), C.black, [0, 0, 0.2125], [HP, 0, 0]);
  // Keilschacht unten (dunkel), Schraubenreihen oben
  B.add(box(0.44, 0.04, 0.08), C.black, [0, -0.245, 0.2]);
  if (det) {
    const T = new LF(B, [0, 0.241, 0], Q(-HP, 0, 0));
    boltRow(T, C.steel, [-0.19, -0.15, 0], [0.19, -0.15, 0], 5, 0.009, det);
    boltRow(T, C.steel, [-0.19, 0.15, 0], [0.19, 0.15, 0], 5, 0.009, det);
  }
  // Handhebel rechts (Keil öffnen von Hand)
  worn(B, 0.85, () => {
    B.add(cyl(0.045, 0.045, 0.05, 14), C.metal, [0.275, 0.06, 0.08], [0, 0, HP]);
    B.add(cyl(0.02, 0.02, 0.07, 10), C.steel, [0.3, 0.06, 0.08], [0, 0, HP]);
    B.rod(C.steel, [0.31, 0.06, 0.08], [0.33, -0.17, 0.2], 0.016, 8);
    B.add(cyl(0.022, 0.022, 0.11, 10), C.rubber, [0.33, -0.2, 0.22], [0.5, 0, HP]);
  });
  // Wiege mit Schildzapfen
  B.add(rbox(0.6, 0.5, 0.38, 0.025, det ? 2 : 1), W, [0, 0.02, -0.42]);
  for (const sx of [-1, 1]) {
    B.add(cyl(0.1, 0.1, 0.07, det ? 20 : 10), C.metal, [sx * 0.33, 0.02, -0.42], [0, 0, HP]);
    B.add(cyl(0.05, 0.05, 0.09, 12), C.steel, [sx * 0.34, 0.02, -0.42], [0, 0, HP]);
    if (det) { const S = new LF(B, [sx * 0.368, 0.02, -0.42], Q(0, sx * HP, 0)); for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; bolt(S, C.steel, [Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0], 0.007, det); } }
  }
  if (det) for (const sy of [-1, 1]) { const S = new LF(B, [0, 0.02 + sy * 0.25, -0.42], Q(sy * -HP, 0, 0)); boltRow(S, C.steel, [-0.26, 0, 0], [0.26, 0, 0], 7, 0.007, det); }
  if (det) weld(B, C.steel, [[-0.3, 0.27, -0.24], [0.3, 0.27, -0.24]], 0.005);
  // Rücklaufbremsen (zwei) und Vorholer oben, Leitungen
  for (const sx of [-1, 1]) {
    B.add(cyl(0.05, 0.05, 0.72, det ? 16 : 10), C.metal, [sx * 0.17, 0.3, -0.33], [HP, 0, 0]);
    B.add(cyl(0.058, 0.058, 0.04, det ? 16 : 10), C.steel, [sx * 0.17, 0.3, 0.03], [HP, 0, 0]);
    if (det) { B.add(cyl(0.012, 0.012, 0.03, 6), C.brass, [sx * 0.17, 0.355, 0.0]); B.tube(C.rubber, [[sx * 0.17, 0.37, 0.0], [sx * 0.2, 0.42, -0.15], [sx * 0.2, 0.4, -0.5]], 0.009, 6, 10); }
  }
  B.add(cyl(0.065, 0.065, 0.66, det ? 18 : 10), C.metal, [0, 0.33, -0.36], [HP, 0, 0]);
  if (det) for (const z of [-0.6, -0.1]) B.add(tor(0.067, 0.008, 4, 18), C.steel, [0, 0.33, z]);
  // Abfeuerungsmagnet links mit Kabel und Stecker
  B.add(rbox(0.07, 0.09, 0.11, 0.01), C.black, [-0.285, 0.08, 0.02]);
  if (det) {
    B.tube(C.cableRed, [[-0.32, 0.1, -0.02], [-0.36, 0.2, -0.15], [-0.33, 0.28, -0.45]], 0.007, 5, 10);
    connector(new LF(B, [-0.32, 0.1, 0.0], Q(0, -HP, 0)), C, [0, 0, 0], det);
  }
  // Rücklaufschutz: Rohrrahmen (gelb/schwarz gestreift), Seitenbleche mit Erleichterungslöchern, Hülsenabweiser
  const yR = -0.12, z0 = 0.15, z1 = 0.9;
  // modern gelb/schwarz gestreift, Weltkriegs-/Kalter-Krieg-Panzer schlichter Stahlrahmen
  const GA = modern ? C.yellow : C.metal, GB2 = modern ? C.black : C.steel;
  // Kasematte (Jagdpanzer ohne Drehturm, Nutzer 21.11.): kein Rohrrahmen um den Rücklaufbereich – der Ladeschütze steht
  // seitlich am Verschluss, der Rahmen wirkte wie ein Turmkorb-Geländer; nur der Hülsenabweiser bleibt
  if (!guard) { B.add(box(0.62, 0.28, 0.012), W, [0, -0.29, z1 - 0.02], [0.15, 0, 0]); return { B }; }
  for (const sx of [-1, 1]) {
    const n = det > 1 ? 9 : 3;
    for (let i = 0; i < n; i++) {
      const a = z0 + (z1 - z0) * i / n, b = z0 + (z1 - z0) * (i + 1) / n;
      B.rod(i % 2 ? GB2 : GA, [sx * 0.33, yR, a], [sx * 0.33, yR, b], 0.019, 10);
    }
    B.rod(GA, [sx * 0.33, yR, z1], [sx * 0.33, -0.44, z1], 0.019, 10);
    B.add(box(0.012, 0.24, 0.62), W, [sx * 0.335, yR - 0.14, (z0 + z1) / 2 + 0.03]);
    if (det) for (let i = 0; i < 3; i++) B.add(cyl(0.04, 0.04, 0.014, 14), C.black, [sx * 0.335, yR - 0.14, z0 + 0.17 + i * 0.2], [0, 0, HP]);
    B.add(box(0.05, 0.06, 0.06), C.metal, [sx * 0.3, yR, z0 - 0.02]);
  }
  B.rod(GA, [-0.33, yR, z1], [0.33, yR, z1], 0.019, 10);
  B.rod(GB2, [-0.33, -0.44, z1], [0.33, -0.44, z1], 0.017, 8);
  B.add(box(0.62, 0.28, 0.012), W, [0, -0.29, z1 - 0.02], [0.15, 0, 0]); // Hülsenabweiser
  return { B };
}

/** Keil (Gruppenraum des Keils, Mitte 0, Ladefläche +Z). */
export function keilParts(MB, C, det) {
  const B = new MB();
  worn(B, 0.3, () => B.add(det ? cbox(0.42, 0.44, 0.06, 0.01) : rbox(0.42, 0.44, 0.06, 0.012, 1), C.breech || C.steel, [0, 0, 0]));
  B.add(cyl(0.032, 0.036, 0.022, det ? 16 : 10), C.metal, [0, 0, 0.038], [HP, 0, 0]);
  B.add(cyl(0.01, 0.01, 0.01, 8), C.brass, [0, 0, 0.052], [HP, 0, 0]);
  for (const y of [0.15, -0.15]) B.add(box(0.36, 0.012, 0.008), C.black, [0, y, 0.031]);
  if (det) for (const sx of [-1, 1]) { B.add(box(0.04, 0.03, 0.03), C.steel, [sx * 0.1, 0.205, 0.035]); B.add(box(0.012, 0.3, 0.006), C.black, [sx * 0.19, -0.02, 0.031]); }
  worn(B, 0.9, () => {
    for (const y of [0.09, 0.15]) B.rod(C.steel, [0.13, y, 0.03], [0.13, y, 0.075], 0.008, 6);
    B.add(cyl(0.016, 0.016, 0.09, 10), C.rubber, [0.13, 0.12, 0.08], [0, 0, 0]);
  });
  return B;
}

/**
 * Munitionsgestell (models.js rackGrp-Raum; Granatenspitzen zeigen nach −Z zur Tür/zum Ladeschützen).
 * slots: [[x, y, z]…] (Plattenmitte), rw/rh Maße, blast: Bunker mit Sprengschutztür.
 * → { frame: MB, door: MB|null, doorPos }
 */
export function rackParts(MB, C, det, era, { slots, rw, rh, rz0, blast, wet }) {
  const wk1 = era === 'wk1';
  const B = new MB();
  // Köcher/Halter je Platz
  for (const s of slots) {
    if (blast) {
      B.add(cyl(0.07, 0.07, 0.05, det > 1 ? 16 : 10, true), C.metal, [s[0], s[1], rz0 - 0.03], [HP, 0, 0]);
      if (det) B.add(tor(0.07, 0.006, 4, det > 1 ? 16 : 10), C.rubber, [s[0], s[1], rz0 - 0.055]);
      if (det > 1) B.add(box(0.014, 0.02, 0.03), C.red, [s[0], s[1] + 0.073, rz0 - 0.05]); // Schnellverschluss-Lasche
    } else {
      // offene Halter: Klemmring aus Bandstahl bzw. Holzbrett mit Ausschnitt (1. WK), Spannhebel
      B.add(tor(0.066, wk1 ? 0.01 : 0.006, 4, det > 1 ? 14 : 8), wk1 ? C.brass : C.steel, [s[0], s[1], rz0 - 0.06]);
      if (det) B.add(box(0.012, 0.03, 0.016), C.steel, [s[0] + 0.07, s[1], rz0 - 0.06]);
    }
  }
  if (!blast) {
    // Querbretter/-bänder je Reihe
    const ys = [...new Set(slots.map((s) => +s[1].toFixed(3)))];
    for (const y of ys) B.add(box(rw - 0.02, 0.02, 0.012), wk1 ? C.wood : C.metal, [0, y - 0.075, rz0 - 0.06]);
    if (det) for (const y of ys) B.add(box(rw - 0.04, 0.025, 0.004), C.canvas, [0, y + 0.0, rz0 - 0.13]); // Haltegurt quer
    if (wet && det) for (const sx of [-1, 1]) B.add(cyl(0.02, 0.02, rh, 8), C.steel, [sx * (rw / 2 - 0.02), 0, rz0 - 0.2]);
  }
  // Rahmen: Winkelprofile an den Kanten, Schrauben
  const fz = blast ? rz0 - 0.255 : rz0 - 0.14;
  for (const sy of [-1, 1]) B.add(box(rw + 0.06, 0.03, 0.04), C.metal, [0, sy * (rh / 2 + 0.01), fz]);
  for (const sx of [-1, 1]) B.add(box(0.03, rh + 0.06, 0.04), C.metal, [sx * (rw / 2 + 0.015), 0, fz]);
  if (det) { const F = new LF(B, [0, 0, fz - 0.021], Q(0, PI, 0)); for (const sy of [-1, 1]) boltRow(F, C.steel, [-rw / 2, sy * (rh / 2 + 0.01), 0], [rw / 2, sy * (rh / 2 + 0.01), 0], Math.max(3, Math.round(rw / 0.18)), 0.006, det); }
  let D = null;
  if (blast) {
    // Bunkerinneres: Leuchtband, Lochplatte mit Rand, Trennbleche
    B.add(box(rw - 0.1, 0.012, 0.02), C.lampGreen, [0, rh / 2 - 0.03, rz0 - 0.2]);
    for (let i = 1; i < 4; i++) B.add(box(0.01, rh - 0.06, 0.18), C.metal, [-rw / 2 + rw * i / 4, 0, rz0 - 0.12]);
    // Tür: Platte mit Rahmen, Versteifungen (Hutprofil), Griffbügel, Laufrollen oben, Dichtung
    D = new MB();
    D.add(box(rw + 0.04, 0.64, 0.03), C.metal, [0, 0, 0]);
    for (const sy of [-1, 1]) D.add(box(rw + 0.04, 0.035, 0.02), C.metal, [0, sy * 0.3, -0.024]);
    for (const sx of [-1, 1]) D.add(box(0.035, 0.6, 0.02), C.metal, [sx * (rw / 2 + 0.002), 0, -0.024]);
    for (let i = 0; i < 3; i++) { const y = -0.16 + i * 0.16; D.add(box(rw * 0.88, 0.04, 0.016), C.metal, [0, y, -0.023]); D.add(box(rw * 0.88, 0.014, 0.012), C.steel, [0, y, -0.034]); }
    worn(D, 0.85, () => {
      const gx = rw / 2 - 0.12;
      for (const y of [-0.1, 0.1]) D.rod(C.steel, [gx, y, -0.016], [gx, y, -0.07], 0.01, 8);
      D.rod(C.steel, [gx, -0.12, -0.07], [gx, 0.12, -0.07], 0.014, 10);
      D.add(cyl(0.019, 0.019, 0.14, 10), C.rubber, [gx, 0, -0.07]);
    });
    for (const sx of [-0.3, 0.3]) { D.add(cyl(0.025, 0.025, 0.03, 12), C.steel, [sx * rw, 0.33, 0], [HP, 0, 0]); D.add(box(0.02, 0.05, 0.02), C.steel, [sx * rw, 0.31, 0]); }
    D.add(box(rw + 0.04, 0.012, 0.012), C.rubber, [0, -0.325, 0]);
    if (det) { const F = new LF(D, [0, 0, -0.036], Q(0, PI, 0)); for (const sy of [-1, 1]) boltRow(F, C.steel, [-rw / 2 + 0.03, sy * 0.3, 0], [rw / 2 - 0.03, sy * 0.3, 0], Math.max(4, Math.round(rw / 0.16)), 0.005, det); }
  }
  return { frame: B, door: D };
}
