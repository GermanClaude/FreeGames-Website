// NULLPUNKT — modellierter Grund-Innenraum (Nutzer 20.11.: „Innenraum zu kantig, glatt und undetailliert“).
//
// Ersetzt die einfachen Kästen des Grund-Innenraums aus models.js (buildInterior/turretBasket/hullCompartment), sobald der
// Detail-Innenraum (cabin.js) angebaut ist – dieselben Maße und Lagen, aber modelliert:
//   Turmschale als gerundetes Prisma (Eckradien, Hohlkehlen an Decke/Boden, leicht gewölbte Wände) statt Polygonflächen,
//   Turmboden mit umgebördeltem Drehkranz-Rand, gegossener Rahmen der Rohrdurchführung mit Gummimanschette,
//   Haltegriffe aus gebogenem Rundstahl, Leitungen mit Schellen, Winkelspiegel-Gehäuse mit Stirnpolster,
//   Geräte als Blechschränke (Falz, Sicken, Deckel mit Schrauben, Lüftungsgitter, Typenschild, Scharniere, Griff),
//   Turmkorb (Laufring mit Zahnkranz, Riffelblechboden, Geländer, Drehdurchführung, Taschen, Bereitschaftskiste),
//   Kampfraum der Wanne (Schale, Riffelboden, Durchstieg, Munitionsstand, Motorschott, Batteriekästen),
//   Munitionsgestell-Kasten und Splitterschutzmatten (moderne Panzer: gesteppte Matten an den freien Turmwänden).
// Alle Teile gehen in die Sammel-Buckets von cabin.js (ein Netz je Material) und werden mit gebacken.
import * as THREE from 'three';
import * as SH from './cabin-shape.js?v=20261123115551';
import { LF, worn, bolt, boltRow, rivet, weld } from './cabin-detail.js?v=20261123115551';
import { driverCabin } from './data.js?v=20261123115551';
import { funkerCabin, funkerDoor } from './periscopes.js?v=20261123115551';

const PI = Math.PI, HP = PI / 2;
const Q = (x = 0, y = 0, z = 0, o = 'XYZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, o));
const cb = (w, h, d, c = 0.006) => SH.cbox(w, h, d, c);
const cy = (r1, r2, h, seg = 12, c = 0.003) => SH.ccyl(r1, r2, h, seg, c);
const tor = (R, r, rs = 6, ts = 24, arc = PI * 2) => new THREE.TorusGeometry(R, r, rs, ts, arc);
export const FOOT = [[-0.9, 1.15], [0.9, 1.15], [1.24, 0.8], [1.25, -1.45], [0.9, -1.92], [-0.9, -1.92], [-1.25, -1.45], [-1.24, 0.8]];

/* ===================================================================== Baugruppen (Rahmen F: +Z zum Betrachter) */

/**
 * Blechschrank/Gerätekasten: Korpus mit Fase, umlaufender Falz vorn, abgesetzter Deckel mit Fuge und Schrauben,
 * Sicken an den Seiten, Lüftungsschlitze, Scharniere oder Griffmulde, Typenschild. o: { mat, vent, hinge, plate, handle, beads, screws }
 * Lage: Mitte der Rückwand bei z = 0 (Kasten wächst nach +Z).
 */
export function cabinet(F, C, det, w, h, d, o = {}) {
  const mat = o.mat || C.olive;
  F.add(cb(w, h, d - 0.012, Math.min(0.008, d * 0.1)), mat, [0, 0, (d - 0.012) / 2]);
  // Falz (umgebördelter Rand) vorn
  const lip = 0.012;
  for (const sy of [-1, 1]) F.add(cb(w + 0.006, lip, 0.014, 0.004), mat, [0, sy * (h / 2 - lip / 2 + 0.002), d - 0.012]);
  for (const sx of [-1, 1]) F.add(cb(lip, h - 0.02, 0.014, 0.004), mat, [sx * (w / 2 - lip / 2 + 0.002), 0, d - 0.012]);
  // Deckel mit Fuge (dunkle Fuge = Spalt zum Korpus), etwas vorstehend
  F.add(cb(w - 2 * lip - 0.004, h - 2 * lip - 0.004, 0.006, 0.0015), C.black, [0, 0, d - 0.011]);
  F.add(cb(w - 2 * lip - 0.01, h - 2 * lip - 0.01, 0.012, 0.004), mat, [0, 0, d - 0.004]);
  if (det && o.screws !== false) for (const sx of [-1, 1]) for (const sy of [-1, 1]) bolt(F, C.steel, [sx * (w / 2 - lip - 0.016), sy * (h / 2 - lip - 0.016), d + 0.002], 0.0045, det);
  // Sicken (gedrückte Versteifungen) an den Seitenwänden
  if (det && o.beads !== false && d > 0.12) for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
    const y = (i - 0.5) * h * 0.42;
    F.add(SH.ccyl(0.007, 0.007, d * 0.6, 8, 0.003), mat, [sx * (w / 2 - 0.002), y, d * 0.48], [HP, 0, 0], [1, 1, 1]);
  }
  // Lüftungsschlitze (Kiemen) auf dem Deckel
  if (o.vent) {
    const n = Math.max(3, Math.floor((h * 0.4) / 0.018));
    for (let i = 0; i < n; i++) {
      const y = h * 0.12 - i * 0.018;
      F.add(cb(w * 0.45, 0.004, 0.006, 0.0015), C.black, [w * 0.12, y, d + 0.003]);
      F.add(cb(w * 0.45, 0.006, 0.008, 0.002), mat, [w * 0.12, y + 0.004, d + 0.006], [-0.6, 0, 0]);
    }
  }
  // Scharniere links, Riegel rechts
  if (o.hinge) for (const sy of [-1, 1]) {
    F.add(cy(0.006, 0.006, 0.05, 8, 0.0015), C.steel, [-w / 2 + 0.004, sy * h * 0.3, d + 0.002]);
    F.add(cb(0.016, 0.044, 0.004, 0.001), C.steel, [-w / 2 + 0.014, sy * h * 0.3, d + 0.003]);
  }
  if (o.handle) worn(F.B, 0.8, () => F.B.add(SH.bentTube([F.w([w / 2 - 0.03, -0.03, d]), F.w([w / 2 - 0.03, -0.03, d + 0.03]), F.w([w / 2 - 0.03, 0.03, d + 0.03]), F.w([w / 2 - 0.03, 0.03, d])], 0.005, 0.01, 6), C.steel));
  if (o.plate && o.flabel) o.flabel(F, o.plate, [-w * 0.18, -h * 0.28, d + 0.0045], Math.min(0.11, w * 0.4));
}

/**
 * Elektronikgehäuse (Druckguss): Korpus mit großen Radien, Kühlrippen oben, Frontplatte mit Schrauben, runde Stecker unten,
 * Tragegriffe vorn, Leuchtmelder; optional Anzeige (screen = Material) mit Blendschutz. Lage wie cabinet.
 */
export function elecBox(F, C, det, w, h, d, o = {}) {
  const mat = o.mat || C.black;
  F.add(SH.rbox(w, h, d, Math.min(0.018, w * 0.2, h * 0.2, d * 0.2), det ? 2 : 1), mat, [0, 0, d / 2]);
  F.add(cb(w - 0.01, h - 0.01, 0.01, 0.003), C.metal, [0, 0, d + 0.003]);
  if (det) {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) bolt(F, C.steel, [sx * (w / 2 - 0.014), sy * (h / 2 - 0.014), d + 0.008], 0.004, det);
    const nf = Math.max(3, Math.floor(w / 0.025));
    for (let i = 0; i < nf; i++) F.add(cb(0.006, 0.012, d * 0.8, 0.002), mat, [-w / 2 + 0.02 + i * ((w - 0.04) / (nf - 1)), h / 2 + 0.005, d * 0.5]);
  }
  if (o.screen) {
    const sw = w * 0.62, sh = h * 0.5;
    F.add(cb(sw + 0.016, sh + 0.016, 0.008, 0.003), C.black, [-w * 0.1, h * 0.08, d + 0.009]);
    F.add(new THREE.PlaneGeometry(sw, sh), o.screen, [-w * 0.1, h * 0.08, d + 0.0135], null, null, true);
    F.add(cb(sw + 0.02, 0.006, 0.03, 0.002), C.black, [-w * 0.1, h * 0.08 + sh / 2 + 0.01, d + 0.022]); // Blendschutz
  }
  // Tasten / Drehknöpfe rechts
  for (let i = 0; i < 3; i++) F.add(cy(0.008, 0.008, 0.012, 10, 0.002), C.rubber, [w / 2 - 0.03, h * 0.25 - i * 0.03, d + 0.014], [HP, 0, 0]);
  if (o.led) F.add(cy(0.004, 0.004, 0.005, 8, 0.001), o.led, [w / 2 - 0.03, -h * 0.32, d + 0.01], [HP, 0, 0]);
  // Tragegriffe
  if (det && o.grips !== false) worn(F.B, 0.85, () => {
    for (const sx of [-1, 1]) F.B.add(SH.bentTube([F.w([sx * (w / 2 - 0.006), -h * 0.3, d + 0.006]), F.w([sx * (w / 2 + 0.012), -h * 0.3, d + 0.03]), F.w([sx * (w / 2 + 0.012), h * 0.3, d + 0.03]), F.w([sx * (w / 2 - 0.006), h * 0.3, d + 0.006])], 0.0055, 0.012, 6), C.steel);
  });
  // Rundstecker unten
  if (det) for (let i = 0; i < 2; i++) {
    const x = -w * 0.2 + i * w * 0.3;
    F.add(cy(0.014, 0.014, 0.02, 12, 0.002), C.metal, [x, -h / 2 - 0.008, d * 0.6]);
    F.add(SH.ccyl(0.011, 0.011, 0.03, 10, 0.002), C.black, [x, -h / 2 - 0.03, d * 0.6]);
  }
}

/** Winkelspiegel-Gehäuse (Decke): Gussgehäuse mit Fase, Prismenglas, Gummilippe, Stirnpolster, Klemmschrauben. F: +Z zum Auge. */
export function periscope(F, C, det, w = 0.16, h = 0.12, d = 0.1) {
  F.add(cb(w, h, d, 0.012), C.metal, [0, 0, 0]);
  F.add(cb(w + 0.016, 0.02, d + 0.016, 0.006), C.metal, [0, h / 2 - 0.004, 0]); // Flansch an der Decke
  F.add(cb(w * 0.86, h * 0.48, 0.006, 0.002), C.black, [0, -0.008, d / 2 + 0.001]);
  F.add(new THREE.PlaneGeometry(w * 0.8, h * 0.4), C.prism, [0, -0.008, d / 2 + 0.0045], null, null, true);
  F.add(SH.ccyl(0.007, 0.007, w * 0.84, 8, 0.002), C.rubber, [0, h * 0.2, d / 2 + 0.006], [0, 0, HP]);
  F.add(SH.quilt(w * 0.95, 0.05, 0.022, { nx: 3, ny: 1, res: 3 }), C.pad, [0, h * 0.42, d / 2 + 0.004], [-0.25, 0, 0]);
  if (det) for (const sx of [-1, 1]) bolt(new LF(F.B, F.w([sx * (w / 2 + 0.001), -0.02, 0]), F.q.clone().multiply(Q(0, sx * HP, 0))), C.steel, [0, 0, 0], 0.006, det);
}

/** Haltegriff aus Rundstahl mit zwei Befestigungsfüßen (an der Decke: F +Z nach unten). */
export function grip(F, C, det, len = 0.26) {
  worn(F.B, 0.9, () => F.B.add(SH.bentTube([F.w([-len / 2, 0, 0]), F.w([-len / 2, 0, 0.055]), F.w([len / 2, 0, 0.055]), F.w([len / 2, 0, 0])], 0.011, 0.025, det ? 10 : 6), C.steel));
  for (const sx of [-1, 1]) {
    F.add(cb(0.04, 0.04, 0.012, 0.004), C.metal, [sx * len / 2, 0, 0.004]);
    if (det) for (const sy of [-1, 1]) bolt(F, C.steel, [sx * len / 2, sy * 0.013, 0.01], 0.0035, det);
  }
}

/** Tasche/Beutel (Segeltuch): bauchiger Körper, Deckelklappe, Riemen mit Schnalle. Lage = Mitte unten, F +Z nach vorn. */
export function pouch(F, C, det, w, h, d) {
  F.add(SH.rbox(w, h, d, Math.min(w, h, d) * 0.3, det ? 3 : 1), C.canvas, [0, h / 2, 0]);
  F.add(SH.quilt(w * 0.96, h * 0.4, 0.012, { nx: 1, ny: 1, res: 4 }), C.canvas, [0, h * 0.78, d / 2 - 0.004], [0.08, 0, 0]);
  for (const sx of [-1, 1]) F.add(cb(0.022, h * 0.7, 0.004, 0.001), C.canvas, [sx * w * 0.25, h * 0.5, d / 2 + 0.006]);
  if (det) for (const sx of [-1, 1]) worn(F.B, 0.5, () => F.add(cb(0.026, 0.016, 0.006, 0.0015), C.steel, [sx * w * 0.25, h * 0.36, d / 2 + 0.009]));
}

/** Holzkiste mit Brettern, Eisenbeschlägen und Seilgriffen (1. WK). Lage = Mitte unten. */
export function crate(F, C, det, w, h, d) {
  const nb = Math.max(2, Math.round(h / 0.07));
  for (let i = 0; i < nb; i++) F.add(cb(w, h / nb - 0.004, d, 0.004), C.wood, [0, (i + 0.5) * (h / nb), 0]);
  F.add(cb(w + 0.006, 0.02, d + 0.006, 0.004), C.wood, [0, h + 0.008, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.add(cb(0.03, h + 0.02, 0.03, 0.003), C.metal, [sx * (w / 2 - 0.01), h / 2 + 0.005, sz * (d / 2 - 0.01)]);
  if (det) for (const sx of [-1, 1]) F.add(tor(0.03, 0.006, 5, 12, PI), C.canvas, [sx * (w / 2 + 0.006), h * 0.7, 0], [0, HP, PI]);
  if (det) for (const sx of [-1, 1]) for (const sz of [-1, 1]) rivet(new LF(F.B, F.w([sx * (w / 2 + 0.005), h * 0.85, sz * (d / 2 - 0.01)]), F.q.clone().multiply(Q(0, sx * HP, 0))), C.steel, [0, 0, 0], 0.005);
}

/** Kleines Handrad (Sehklappen u. ä.), Achse lokal +Z. */
export function smallWheel(F, C, det, r = 0.05) {
  F.add(tor(r, r * 0.13, 6, det ? 20 : 12), C.metal, [0, 0, 0.02]);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; F.rod(C.metal, [0, 0, 0.012], [Math.cos(a) * r, Math.sin(a) * r, 0.02], r * 0.08, 6); }
  F.add(cy(r * 0.25, r * 0.25, 0.03, 10, 0.002), C.metal, [0, 0, 0.012], [HP, 0, 0]);
  worn(F.B, 0.85, () => F.add(cy(r * 0.12, r * 0.1, r * 0.6, 8, 0.002), C.wood, [r, 0, 0.04], [HP, 0, 0]));
}

/** Rohr/Leitung entlang Punkten mit Schellen (Bandstahl + Schraube) alle ~0,3 m. */
export function pipe(B, C, det, pts, r, mat, clampMat = null) {
  B.tube(mat, pts, r, det ? 8 : 5, det ? 10 : 4);
  if (!det) return;
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  const n = Math.max(1, Math.round(curve.getLength() / 0.3));
  for (let i = 1; i < n; i++) {
    const p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), t);
    B.add(tor(r + 0.003, 0.0035, 4, 12), clampMat || C.steel, p.toArray(), q);
    const F = new LF(B, p.toArray(), q);
    F.add(cb(0.012, 0.01, 0.008, 0.002), clampMat || C.steel, [0, r + 0.006, 0]);
  }
}

/**
 * Kabelkanal (U-Profil aus Blech mit aufgeschraubtem Deckel, umgebördelten Kanten und Kabelaustritt) von a nach b
 * (gerade, waagrecht oder senkrecht), Rücken an der Wand mit Normale n (Einheitsvektor). w Breite, h Tiefe.
 */
export function duct(B, C, det, a, b, n, w = 0.07, h = 0.045, mat = null) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), N = new THREE.Vector3(...n).normalize();
  const len = A.distanceTo(Bv), dir = Bv.clone().sub(A).normalize();
  const side = new THREE.Vector3().crossVectors(N, dir).normalize();
  const m = new THREE.Matrix4().makeBasis(dir, side, N); // lokal x = Länge, y = quer, z = von der Wand weg
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  const F = new LF(B, A.clone().add(Bv).multiplyScalar(0.5).toArray(), q);
  const M = mat || C.metal;
  for (const sy of [-1, 1]) F.add(cb(len, 0.003, h, 0.0012), M, [0, sy * w / 2, h / 2]);
  F.add(cb(len, w, 0.003, 0.0012), M, [0, 0, 0.0015]);
  F.add(cb(len - 0.004, w + 0.008, 0.004, 0.0015), M, [0, 0, h + 0.002]);       // Deckel
  for (const sy of [-1, 1]) F.add(SH.ccyl(0.0028, 0.0028, len - 0.006, 6, 0.001), M, [0, sy * (w / 2 + 0.003), h + 0.0005], [0, 0, HP]); // gebördelte Kante
  if (det) { const k = Math.max(2, Math.round(len / 0.25)); for (let i = 0; i <= k; i++) bolt(F, C.steel, [-len / 2 + 0.02 + (len - 0.04) * i / k, 0, h + 0.004], 0.0035, det); }
  // Kabel treten am Ende aus
  if (det) for (let i = 0; i < 3; i++) B.tube(i ? (i === 1 ? C.cableRed : C.black) : C.black, [F.w([len / 2 - 0.01, (i - 1) * 0.016, h * 0.5]), F.w([len / 2 + 0.06, (i - 1) * 0.02, h * 0.5 + 0.01]), F.w([len / 2 + 0.11, (i - 1) * 0.03 - 0.03, h * 0.3])], 0.0055, 5, 30);
}

/** Kabelbinder um ein Bündel (Punkt p, Richtung t, Radius r). */
export function tie(B, C, p, t, r) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(t[0], t[1], t[2]).normalize());
  B.add(tor(r + 0.0015, 0.0012, 3, 10), C.black, p, q);
  new LF(B, p, q).add(cb(0.005, 0.004, 0.004, 0.001), C.black, [0, r + 0.003, 0]);
}

/** Schweißspritzer: kleine Perlen zufällig entlang einer Naht (seed: Zahl). */
export function spatter(B, C, a, b, n = 10, seed = 1, spread = 0.025, nrm = null) {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) {
    const t = rnd();
    const p = [a[0] + (b[0] - a[0]) * t + (rnd() - 0.5) * spread, a[1] + (b[1] - a[1]) * t + (rnd() - 0.5) * spread, a[2] + (b[2] - a[2]) * t + (rnd() - 0.5) * spread];
    if (nrm) for (let k = 0; k < 3; k++) if (nrm[k]) p[k] = a[k];
    B.add(new THREE.SphereGeometry(0.0015 + rnd() * 0.0018, 4, 3), C.steel, p);
  }
}

/** Splitterschutzmatte (gesteppt) mit Einfassband und Halteknöpfen. F: +Z in den Raum, Mitte. */
export function linerPad(F, C, det, w, h, t = 0.024) {
  F.add(SH.quilt(w, h, t, { nx: Math.max(2, Math.round(w / 0.12)), ny: Math.max(2, Math.round(h / 0.12)), rauten: true, res: det > 1 ? 4 : 2 }), C.liner, [0, 0, 0]);
  if (!det) return;
  // Einfassband (Rand) und Druckknöpfe
  for (const sy of [-1, 1]) F.add(cb(w - 0.01, 0.018, 0.008, 0.003), C.linerBand, [0, sy * (h / 2 - 0.009), 0.005]);
  for (const sx of [-1, 1]) F.add(cb(0.018, h - 0.03, 0.008, 0.003), C.linerBand, [sx * (w / 2 - 0.009), 0, 0.005]);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) F.add(cy(0.008, 0.008, 0.006, 10, 0.0015), C.steel, [sx * (w / 2 - 0.009), sy * (h / 2 - 0.009), 0.011], [HP, 0, 0]);
}

/* ===================================================================== Turm (Gruppenraum des Innenraums) */

/**
 * Grund-Innenraum des Turms modelliert (Maße wie models.js buildInterior). K: Helfer aus cabin.js { label, stencil, harness }.
 * have: was cabin.js ohnehin baut ({ cmdSeat, loadSeat, gunSeat }).
 */
export function turretBase(B, C, det, era, D, A, K, have = {}) {
  const I = A.I, wk1 = era === 'wk1', modern = era === 'modern';
  const W = C.wall[era];
  const basket = A.basket, ringR = A.ringR, rc = A.rc;
  const rackRight = I.rack && I.rack[0] > 0.5;
  const footZ = FOOT.map(([x, v]) => [x, -v]);
  // ---- Schale: gerundetes Prisma, Decke mit Hohlkehle, Wände leicht gewölbt
  B.add(SH.prism(footZ, 0.06, 0.75, { rc: 0.14, r0: 0.035, r1: 0.075, cap0: !basket, cap1: true, bulge: 0.01, steps: det ? 5 : 2, arcSteps: det ? 3 : 1, axes: 'xzy' }), W);
  if (basket) {
    const shp = new THREE.Shape(FOOT.map(([x, v]) => new THREE.Vector2(x, v)));
    const hole = new THREE.Path();
    hole.absarc(rc[0], -rc[2], ringR + 0.05, 0, PI * 2, true);
    shp.holes.push(hole);
    const shelf = new THREE.ShapeGeometry(shp, det ? 28 : 14);
    shelf.rotateX(-HP);
    B.add(shelf, W, [0, 0.061, 0]);
    // umgebördelter Rand der Drehkranz-Öffnung (Wulst) und Schutzkante
    B.add(tor(ringR + 0.05, 0.012, 6, det ? 48 : 20), W, [rc[0], 0.06, rc[2]], [HP, 0, 0]);
    B.add(SH.ccyl(ringR + 0.062, ringR + 0.062, 0.05, det ? 48 : 20, 0.004, true), W, [rc[0], 0.035, rc[2]]);
  } else {
    B.add(cb(1.5, 0.02, 1.3, 0.006), C.floor, [0.15, 0.07, 0.3]);
    if (det) { const F = new LF(B, [0.15, 0.081, 0.3], Q(-HP, 0, 0)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bolt(F, C.steel, [sx * 0.7, -sz * 0.6, 0], 0.008, det); }
  }
  // ---- Rohrdurchführung: gegossener Rahmen mit Radien, Gummimanschette, Schraubenkranz
  {
    const F = new LF(B, [0, 0.42, -1.12], null);
    for (const sy of [-1, 1]) F.add(cb(0.78, 0.09, 0.07, 0.02), C.metal, [0, sy * 0.275, 0]);
    for (const sx of [-1, 1]) F.add(cb(0.09, 0.62, 0.07, 0.02), C.metal, [sx * 0.345, 0, 0]);
    F.add(SH.quilt(0.6, 0.46, 0.03, { nx: 1, ny: 4, res: 3, sag: 0.01 }), C.rubber, [0, 0, -0.026]);
    if (det) for (const sy of [-1, 1]) boltRow(F, C.steel, [-0.32, sy * 0.275, 0.036], [0.32, sy * 0.275, 0.036], 6, 0.008, det);
  }
  // ---- Haltegriffe an der Decke
  for (const [x, z] of det === 2 ? [[0.55, -0.15], [0.95, 0.4], [-0.25, 0.95]] : det === 1 ? [[0.55, -0.15], [0.95, 0.4]] : [[0.95, 0.4]]) grip(new LF(B, [x, 0.748, z], Q(HP, 0, HP)), C, det, 0.26);
  // ---- Leitungen und Kabel an Wänden/Decke (mit Schellen)
  for (const [x, y, z, l, ry] of [[-1.15, 0.62, -0.2, 1.9, 0], [1.16, 0.6, -0.3, 1.7, 0], [0, 0.7, -0.95, 1.6, HP], [0.4, 0.69, 0.9, 1.2, HP]]) {
    const dx = ry ? l / 2 : 0, dz = ry ? 0 : l / 2;
    pipe(B, C, det, [[x - dx, y, z - dz], [x, y, z], [x + dx, y, z + dz]], 0.016, C.steel);
    B.tube(C.rubber, [[x - dx, y - 0.04, z - dz], [x + dx * 0.02, y - 0.042, z + dz * 0.02], [x + dx, y - 0.04, z + dz]], 0.011, det ? 7 : 4, det ? 6 : 2);
  }
  // ---- Kabelkanäle: Turmrückwand oben, rechte Wand unten
  if (det) {
    duct(B, C, det, [-0.7, 0.63, 1.89], [0.7, 0.63, 1.89], [0, 0, -1]);
    duct(B, C, det, [-1.235, 0.1, -0.5], [-1.24, 0.1, 1.2], [1, 0, 0], 0.06, 0.04);
  }
  // ---- Winkelspiegel (Turmdecke)
  for (const [x, z, ry] of [[0.65, 0.2, 0.3], [0.85, 0.75, -0.6], [-0.65, -0.5, 0.2]]) periscope(new LF(B, [x, 0.68, z], Q(0, ry, 0)), C, det);
  // ---- Ladeschützensitz (1. WK: Holzklappsitz), Kommandantensitz (1. WK)
  if (wk1) {
    const F = new LF(B, [1.17, 0.36, 0.25], Q(0, -HP, 0));
    F.add(cb(0.36, 0.3, 0.04, 0.008), C.wood, [0, 0.03, 0.02]);
    for (let i = 0; i < 3; i++) F.add(cb(0.36, 0.004, 0.006, 0.001), C.black, [0, -0.08 + i * 0.1, 0.042]);
    F.add(SH.ccyl(0.014, 0.014, 0.32, 8, 0.002), C.steel, [0, -0.13, 0.03], [0, 0, HP]);
    for (const sx of [-1, 1]) F.add(cb(0.03, 0.06, 0.05, 0.004), C.metal, [sx * 0.14, -0.13, 0.0]);
  }
  // ---- Geräte je Generation
  if (modern) {
    // Elektronikkästen mit Anzeige (Feuerleit-/Stabilisierungsrechner, Turmsteuerung)
    for (const [x, z, w, d] of [[-1.05, 0.1, 0.22, 0.4], [-0.95, -0.6, 0.3, 0.25], [1.05, -0.6, 0.25, 0.3]]) {
      const F = new LF(B, [x, 0.28, z + d / 2], null);
      const G = new LF(B, [x, 0.28, z - d / 2], null);
      elecBox(G, C, det, w, 0.2, d, { mat: C.black, led: C.lampGreen, grips: false });
      F.add(cb(w * 0.6, 0.03, 0.006, 0.002), C.disp, [0, 0.07, 0.01]);
      if (K.label && det) K.label('w_24v', [x - w * 0.15, 0.2, z + d / 2 + 0.0135], null, 0.06);
    }
  } else if (era === 'wk2') {
    // Röhrenfunkgerät: Gehäuse mit Falz, Skalenfenster (glimmen), Bakelitknöpfe, Tragegriffe
    const F = new LF(B, [-0.96, 0.36, 0.85], Q(0, HP, 0));
    cabinet(new LF(B, [-1.2, 0.36, 0.85], Q(0, HP, 0)), C, det, 0.44, 0.3, 0.24, { mat: C.metal, hinge: false, handle: true, beads: true });
    for (let i = 0; i < 3; i++) {
      const p = [-0.15 + i * 0.13, 0.06, 0.008];
      F.add(cy(0.036, 0.036, 0.012, det ? 18 : 10, 0.002), C.black, p, [HP, 0, 0]);
      F.add(new THREE.CircleGeometry(0.028, det ? 18 : 10), C.lampWarm, [p[0], p[1], p[2] + 0.0065], null, null, true);
      F.add(tor(0.032, 0.004, 4, det ? 18 : 10), C.brass, [p[0], p[1], p[2] + 0.006]);
    }
    for (let i = 0; i < 3; i++) F.add(cy(0.018, 0.016, 0.026, 12, 0.003), C.black, [-0.17 + i * 0.1, -0.06, 0.02], [HP, 0, 0]);
    if (K.flabel && det) K.flabel(F, era === 'wk2' && D.era === 'kk' ? 'n_kanal' : 'n_wk', [0.06, -0.115, 0.009], 0.12);
    // Bordsprechkästen
    for (const [x, z] of rackRight ? [[-1.0, -0.6]] : [[-1.0, -0.6], [1.0, -0.65]]) cabinet(new LF(B, [x + (x < 0 ? -0.06 : 0.06), 0.5, z], Q(0, x < 0 ? HP : -HP, 0)), C, det, 0.1, 0.16, 0.12, { mat: C.metal });
    // Kartenbrett (Holz) mit Klemmleiste
    { const F2 = new LF(B, [-0.85, 0.42, -0.1], Q(-HP, 0, 0.2)); F2.add(cb(0.3, 0.24, 0.018, 0.004), C.wood, [0, 0, 0]); F2.add(cb(0.31, 0.02, 0.012, 0.003), C.steel, [0, 0.11, 0.012]); if (K.flabel) K.flabel(F2, 'w_stau', [0, -0.02, 0.0095], 0.2); }
    // Patronensäcke fürs MG
    for (let i = 0; i < 2; i++) pouch(new LF(B, [-1.1, 0.1, -0.3 + i * 0.12], Q(0, HP, 0)), C, det, 0.09, 0.15, 0.1);
    // Sehklappen-Handräder
    for (const [x, z] of [[0.62, -1.05], [-0.62, -1.05]]) smallWheel(new LF(B, [x, 0.52, z], null), C, det, 0.05);
  } else {
    // 1. WK: Nietreihen an den Wänden, Holzkisten, Werkzeugkiste, Öllampe, Sprachrohr
    for (const [x, z] of [[-1.2, -1.2], [-1.2, 0.5], [1.2, -1.2], [1.2, 0.6]]) for (let i = 0; i < 2; i++) rivet(new LF(B, [x + (x < 0 ? -0.04 : 0.04), 0.2 + i * 0.3, z], Q(0, x < 0 ? HP : -HP, 0)), C.metal, [0, 0, 0], 0.012);
    crate(new LF(B, [0.95, 0.06, -0.7], null), C, det, 0.36, 0.22, 0.42);
    { const F = new LF(B, [-0.95, 0.0, -0.55], null); F.add(cb(0.3, 0.12, 0.18, 0.006), C.metal, [0, 0.06, 0]); F.add(cb(0.31, 0.02, 0.19, 0.006), C.metal, [0, 0.13, 0]); worn(B, 0.8, () => B.add(SH.bentTube([F.w([-0.07, 0.14, 0]), F.w([-0.07, 0.18, 0]), F.w([0.07, 0.18, 0]), F.w([0.07, 0.14, 0])], 0.006, 0.015, 6), C.steel)); }
    // Öllampe: Messingkörper, Glaszylinder, Bügel
    { const F = new LF(B, [0.2, 0.5, 0.95], null); F.add(cy(0.05, 0.06, 0.05, 14, 0.004), C.brass, [0, 0.0, 0]); F.add(cy(0.03, 0.035, 0.09, 12, 0.003), C.lampWarm, [0, 0.07, 0]); F.add(cy(0.04, 0.03, 0.02, 12, 0.003), C.brass, [0, 0.125, 0]); F.add(tor(0.05, 0.004, 4, 14, PI), C.metal, [0, 0.13, 0]); }
    // Sprachrohr zum Fahrer mit Trichter
    { B.tube(C.brass, [[-0.4, 0.62, -0.05], [-0.7, 0.63, -0.5], [-0.9, 0.62, -0.95]], 0.025, det ? 10 : 6, det ? 8 : 3); B.add(SH.ccyl(0.05, 0.025, 0.08, 14, 0.002, true), C.brass, [-0.37, 0.62, 0.0], [HP * 0.8, 0.3, 0]); }
  }
  // ---- Turmkorb
  if (basket) basketParts(B, C, det, era, D, A, have);
}

/** Turmkorb (Maße wie models.js turretBasket). */
function basketParts(B, C, det, era, D, A, have) {
  const ringR = A.ringR, rc = A.rc, yb = A.yb;
  const rB = ringR - 0.07, seg = det ? 40 : 20;
  const [cx, , cz] = rc;
  // Laufring (Profil) + Zahnkranz mit Zähnen
  B.add(tor(ringR, 0.05, 8, seg), C.steel, [cx, 0.03, cz], [HP, 0, 0]);
  B.add(tor(ringR - 0.07, 0.022, 6, seg), C.metal, [cx, -0.02, cz], [HP, 0, 0]);
  if (det > 1) for (let i = 0; i < 48; i++) { const a = (i / 48) * PI * 2; B.add(cb(0.018, 0.022, 0.016, 0.003), C.metal, [cx + Math.cos(a) * (ringR - 0.1), -0.02, cz + Math.sin(a) * (ringR - 0.1)], [0, -a, 0]); }
  // Korbboden (Riffelblech) mit gefastem Rand, umlaufender Wulst
  B.add(SH.ccyl(rB, rB, 0.04, seg, 0.008), C.floor, [cx, yb - 0.02, cz]);
  B.add(tor(rB, 0.018, 6, seg), C.steel, [cx, yb + 0.004, cz], [HP, 0, 0]);
  // Trittschutz (Wand des Korbs, gelochtes Blech als Fläche nach innen)
  B.add(SH.prism(roundN(rB, det ? 32 : 16), yb, yb + 0.22, { rc: 0, r0: 0.02, r1: 0, cap0: false, cap1: false, steps: 0, arcSteps: det ? 2 : 1, axes: 'xzy' }), C.wall[era], [cx, 0, cz]);
  B.add(tor(rB, 0.01, 5, seg), C.steel, [cx, yb + 0.22, cz], [HP, 0, 0]);
  // Geländer: Pfosten (vorn offen) mit Fußplatten, zwei Ringe
  const top = 0.0, h = top - yb;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * PI * 2;
    if (Math.abs(Math.cos(a)) < 0.3 && Math.sin(a) < 0) continue;
    const px = cx + Math.cos(a) * rB, pz = cz + Math.sin(a) * rB;
    B.add(SH.ccyl(0.016, 0.016, h, det ? 10 : 6, 0.003), C.steel, [px, yb + h / 2, pz]);
    if (det) B.add(cb(0.05, 0.008, 0.05, 0.002), C.metal, [px, yb + 0.004, pz], [0, -a, 0]);
  }
  for (const y of [yb + h * 0.45, yb + h * 0.82]) worn(B, 0.4, () => B.add(tor(rB, 0.013, 6, seg), C.steel, [cx, y, cz], [HP, 0, 0]));
  // Drehdurchführung (Mitte): Gussgehäuse mit Rippen, Schleifring, Leitungen nach oben
  B.add(SH.ccyl(0.12, 0.16, 0.26, det ? 20 : 12, 0.012), C.metal, [cx, yb + 0.13, cz]);
  if (det) for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; B.add(cb(0.012, 0.22, 0.05, 0.003), C.metal, [cx + Math.cos(a) * 0.14, yb + 0.12, cz + Math.sin(a) * 0.14], [0, -a, 0.12]); }
  B.add(SH.ccyl(0.06, 0.06, 0.12, 16, 0.006), C.steel, [cx, yb + 0.32, cz]);
  const hh = Math.max(0.2, h - 0.35);
  B.tube(C.rubber, [[cx + 0.05, yb + 0.36, cz - 0.03], [cx + 0.1, yb + 0.36 + hh * 0.5, cz - 0.06], [cx + 0.14, -0.02, cz - 0.08]], 0.022, det ? 8 : 5, det ? 8 : 3);
  if (det) B.tube(C.cableYel, [[cx - 0.05, yb + 0.36, cz], [cx - 0.1, yb + 0.36 + hh * 0.5, cz + 0.04], [cx - 0.14, -0.02, cz + 0.07]], 0.009, 6, 8);
  // Fußstütze Richtschütze, Hülsensack, Bereitschaftskiste, Werkzeugtasche
  const gx = cx + rB * 0.45, gz = cz - rB * 0.45;
  if (!have.gunSeat) {
    B.add(SH.ccyl(0.04, 0.05, h * 0.55, 12, 0.004), C.steel, [gx, yb + h * 0.275, gz]);
    B.add(SH.rbox(0.36, 0.07, 0.34, 0.03, det ? 2 : 1), C.pad, [gx, yb + h * 0.56, gz]);
  }
  pouch(new LF(B, [cx - rB * 0.55, yb, cz + rB * 0.5], Q(0, 0.4 + PI, 0)), C, det, 0.32, 0.34, 0.22);
  { const F = new LF(B, [cx + rB * 0.55, yb, cz + rB * 0.45], Q(0, -0.3 + PI, 0)); cabinet(new LF(B, F.w([0, 0.1, -0.15]), F.q), C, det, 0.42, 0.2, 0.3, { mat: era === 'modern' ? C.olive : C.metal, handle: true, hinge: true }); }
  if (det > 1) pouch(new LF(B, [cx - rB * 0.8, yb + h * 0.48, cz - rB * 0.3], Q(0, 1.2 + PI, 0)), C, det, 0.26, 0.14, 0.1);
}

/** Kreis als Polygon (n Ecken) um 0 – für prism ohne Eckradien. */
function roundN(r, n) { const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; }

/** Kasten des Munitionsgestells (rackGrp-Raum; Maße wie models.js), gefaste Bleche, Lochplatte, Bunker-Führungsschienen. */
export function rackBox(B, C, det, { rw, rh, rz0, blast }) {
  for (const sy of [-1, 1]) B.add(cb(rw, 0.035, 0.76, 0.008), C.metal, [0, sy * (rh / 2 - 0.01), 0]);
  for (const sx of [-1, 1]) B.add(cb(0.035, rh, 0.76, 0.008), C.metal, [sx * rw / 2, 0, 0]);
  B.add(cb(rw, rh - 0.04, 0.02, 0.004), C.metal, [0, 0, rz0 + 0.02]);
  if (blast) {
    for (const sy of [-1, 1]) B.add(cb(rw + 0.12, 0.03, 0.06, 0.006), C.steel, [0, sy * 0.33, rz0 - 0.3]);
    B.add(cb(0.06, 0.7, 0.06, 0.008), C.steel, [-rw / 2 - 0.06, 0, rz0 - 0.3]);
  }
  if (det) for (const sx of [-1, 1]) weld(B, C.metal, [[sx * (rw / 2 - 0.02), rh / 2 - 0.03, -0.37], [sx * (rw / 2 - 0.02), rh / 2 - 0.03, 0.37]], 0.004);
}

/* ===================================================================== Kampfraum der Wanne */

/** Maße des Kampfraums (wie models.js hullCompartment). */
export function hullDims(D, A) {
  const hb = D.hullBox, tp = D.turretPivot, ring = A.ringR * A.sc;
  const yF = hb[1] - hb[4] + 0.1, yR = tp[1] - 0.02;
  const wx = Math.max(ring + 0.12, Math.min(hb[3] - 0.5, ring + 0.3));
  const DC = driverCabin(D);
  const zF = Math.max(hb[2] - hb[5] + 0.35, tp[2] - ring - 0.75, DC ? DC.zB + 0.05 : -Infinity), zB = Math.min(hb[2] + hb[5] - 0.3, tp[2] + ring + 0.55);
  return { yF, yR, wx, zF, zB, DC, ring };
}

export function hullBase(B, C, det, era, D, A, K) {
  const { yF, yR, wx, zF, zB, DC, ring } = hullDims(D, A);
  const W = C.wall[era];
  // Funkerplatz (2. WK): Durchgang in der Stirnwand (Nutzer 21.11.) – Prisma vorn offen, Stirnwand mit Öffnung
  const FK = det ? funkerCabin(D, driverCabin) : null, fdoor = FK ? funkerDoor(FK) : null;
  const fd = fdoor && fdoor[0] > -wx + 0.08 && fdoor[1] < wx - 0.08 ? fdoor : null;
  B.add(SH.prism([[-wx, zF], [wx, zF], [wx, zB], [-wx, zB]], yF, yR, { rc: 0.1, r0: 0.04, r1: 0.06, cap0: true, cap1: true, bulge: 0.008, steps: det ? 4 : 2, arcSteps: det ? 3 : 1, axes: 'xzy', open: fd ? [0] : null }), W);
  if (fd) {
    B.add(SH.holeWall(-wx, wx, yF, yR, [[fd[0], fd[1], fd[2], fd[3]]]), W, [0, 0, zF + 0.002]);
    for (const y of [yF + 0.006, yR - 0.006]) B.add(cb(wx * 2, 0.012, 0.08, 0.003), W, [0, y, zF + 0.04]); // Hohlkehlen fehlen → Streifen
    for (const x of [-wx + 0.006, wx - 0.006]) B.add(cb(0.012, yR - yF, 0.08, 0.003), W, [x, (yF + yR) / 2, zF + 0.04]);
    const F = new LF(B, [(fd[0] + fd[1]) / 2, (fd[2] + fd[3]) / 2, zF + 0.016], null), dw = fd[1] - fd[0], dh = fd[3] - fd[2];
    for (const sx of [-1, 1]) F.add(cb(0.045, dh + 0.06, 0.03, 0.006), C.metal, [sx * (dw / 2 + 0.02), 0, 0]);
    for (const sy of [-1, 1]) F.add(cb(dw + 0.08, 0.045, 0.03, 0.006), C.metal, [0, sy * (dh / 2 + 0.02), 0]);
  }
  B.add(cb(wx * 2 - 0.1, 0.02, zB - zF - 0.1, 0.006), C.floor, [0, yF + 0.01, (zF + zB) / 2]);
  // Durchstieg zum Fahrer
  const dr = D.seats.find((s) => s.drive), dx = dr ? Math.max(-wx + 0.45, Math.min(wx - 0.45, dr.pos[0])) : -0.5;
  const oh = Math.min(0.95, yR - yF - 0.15);
  B.add(new THREE.PlaneGeometry(0.72, oh), C.black, [dx, yF + oh / 2 + 0.05, zF + 0.012], null, null, false);
  { const F = new LF(B, [dx, yF + oh / 2 + 0.05, zF + 0.03], null);
    for (const sx of [-1, 1]) F.add(cb(0.06, oh + 0.06, 0.05, 0.012), C.metal, [sx * 0.39, 0, 0]);
    for (const sy of [-1, 1]) F.add(cb(0.84, 0.06, 0.05, 0.012), C.metal, [0, sy * (oh / 2 + 0.03), 0]);
    F.add(SH.ccyl(0.012, 0.012, 0.72, 8, 0.002), C.rubber, [0, -oh / 2 - 0.0, 0.03], [0, 0, HP]); // Kantenschutz unten
    if (det) for (const sx of [-1, 1]) boltRow(F, C.steel, [sx * 0.39, -oh / 2 + 0.05, 0.026], [sx * 0.39, oh / 2 - 0.05, 0.026], 4, 0.006, det); }
  if (!DC) B.add(SH.rbox(0.46, 0.5, 0.08, 0.03, det ? 2 : 1), C.pad, [dx, yF + 0.45, zF + 0.06], [0.12, 0, 0]);
  // Munitionsstand neben dem Fahrer (Hülsenböden mit Rand und Zündhütchen, Haltegurte)
  const mx = dx > 0 ? -wx + 0.35 : wx - 0.35;
  // vor dem Funker-Durchgang: an die Seitenwand neben der Stirnwand
  const mxDoor = fd && mx + 0.33 > fd[0] && mx - 0.33 < fd[1];
  { const F = mxDoor ? new LF(B, [Math.sign(mx) * (wx - 0.04), yF + 0.45, zF + 0.55], Q(0, -Math.sign(mx) * HP, 0)) : new LF(B, [mx, yF + 0.45, zF + 0.04], null);
    F.add(cb(0.66, 0.74, 0.04, 0.01), C.metal, [0, 0, 0]);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      const p = [-0.18 + c * 0.18, -0.25 + r * 0.16, 0.03];
      F.add(SH.ccyl(0.055, 0.055, 0.025, det ? 18 : 10, 0.003), C.brass, p, [HP, 0, 0]);
      F.add(SH.ccyl(0.06, 0.06, 0.006, det ? 18 : 10, 0.0015), C.brass, [p[0], p[1], 0.018], [HP, 0, 0]);
      if (det) F.add(SH.ccyl(0.009, 0.009, 0.004, 10, 0.001), C.steel, [p[0], p[1], 0.044], [HP, 0, 0]);
    }
    if (det) for (let r = 0; r < 2; r++) F.add(cb(0.62, 0.035, 0.006, 0.0015), C.canvas, [0, -0.17 + r * 0.32, 0.048]); }
  // Motorschott: zwei Wartungsdeckel mit Rand, Sicken, Schrauben, Griff
  for (const sx of [-1, 1]) {
    const F = new LF(B, [sx * wx * 0.45, yF + (yR - yF) * 0.4, zB - 0.02], Q(0, PI, 0));
    F.add(cb(wx * 0.8, (yR - yF) * 0.55, 0.03, 0.008), C.wall[era], [0, 0, 0]);
    if (det) {
      for (let k = 0; k < 3; k++) F.add(SH.ccyl(0.008, 0.008, wx * 0.55, 8, 0.002), C.wall[era], [0, ((k - 1) * (yR - yF)) * 0.13, 0.016], [0, 0, HP]);
      boltRow(F, C.steel, [-wx * 0.36, (yR - yF) * 0.25, 0.017], [wx * 0.36, (yR - yF) * 0.25, 0.017], 5, 0.007, det);
      worn(B, 0.85, () => B.add(SH.bentTube([F.w([-0.06, -(yR - yF) * 0.2, 0.016]), F.w([-0.06, -(yR - yF) * 0.2, 0.05]), F.w([0.06, -(yR - yF) * 0.2, 0.05]), F.w([0.06, -(yR - yF) * 0.2, 0.016])], 0.007, 0.015, 6), C.steel));
    }
  }
  if (K.extinguisher) K.extinguisher([wx - 0.2, yF + 0.3, zB - 0.2], 1);
  // Kabelkanäle an den Seitenwänden
  if (det) for (const sx of [-1, 1]) duct(B, C, det, [sx * (wx - 0.004), yF + 0.62, zF + 0.2], [sx * (wx - 0.004), yF + 0.62, zB - 0.25], [-sx, 0, 0], 0.08, 0.05);
  // Batterie-/Funkkästen auf den Kettenkästen
  for (const sx of [-1, 1]) {
    cabinet(new LF(B, [sx * (wx - 0.02), yF + 0.16, (zF + zB) / 2 + 0.3], Q(0, sx > 0 ? -HP : HP, 0)), C, det, 0.6, 0.32, 0.3, { mat: era === 'modern' ? C.olive : C.metal, hinge: true, handle: true, vent: sx > 0, flabel: K.flabel, plate: 'w_24v' });
    pipe(B, C, det, [[sx * (wx - 0.04), yR - 0.12, zF + 0.15], [sx * (wx - 0.045), yR - 0.12, (zF + zB) / 2], [sx * (wx - 0.04), yR - 0.12, zB - 0.15]], 0.02, C.rubber, C.metal);
  }
  return { yF, yR, wx, zF, zB, ring };
}
