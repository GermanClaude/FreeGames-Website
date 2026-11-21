// NULLPUNKT — Nutzfahrzeug-Karosserien als Unterteilungsfläche (Nutzer 15.11.: Autos „kastig“): Kastenwagen und
// Fahrerhaus der Sattelzugmaschine. Form aus carbody.js (vanBody/cabBody), hier die Anbauteile: Spiegel an Auslegern,
// Türgriffe, Schiebetür-Schiene, Wischer, Kennzeichen, Grill-Lamellen, Scheinwerfer-Einsätze, Stoßfänger/Trittstufen,
// Radhausschalen, Unterboden. Nur medium+ in den Nahstufen (models-civil.js entscheidet), low/Fernstufe unverändert.
//
// vanBodyHQ / cabBodyHQ (K, S, B, GB, LB, lod, paint, variant)
import * as THREE from 'three';
import { tube, roundPlate } from './bodykit.js?v=20261121041936';
import { vanBody, cabBody, TAG } from './carbody.js?v=20261121041936';
import { addCarBody, surfaceProbe, plateMaterial } from './models-car.js?v=20261121041936';

const PI = Math.PI, HP = PI / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const alignZ = (n) => { const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n[0], n[1], n[2]))); return [e.x, e.y, e.z]; };

function probeOf(R, key) {
  return surfaceProbe([TAG.PAINT, TAG.GLASS, TAG.FRIT, TAG.PLASTIC, TAG.GRILLE, TAG.LAMP, TAG.TRIM, TAG.RLAMP].map((t) => R.parts.get(t)), key);
}

/** Halbröhre (Radhausschale) mit Innenseite nach außen. */
function liner(r, w, seg) {
  const g = new THREE.CylinderGeometry(r, r, w, seg, 1, true, 0, PI);
  const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  g.computeVertexNormals();
  return g;
}

/** Spiegel an Ausleger: Fuß p (Fläche), Gehäuse um d nach außen, Größe w × h. */
function armMirror(B, S, sx, p, d, w, h, fine) {
  const c = [p[0] + sx * d, p[1] + 0.02, p[2] + 0.01];
  B.add(tube([[p[0], p[1], p[2]], [lerp(p[0], c[0], 0.6), p[1] + 0.03, p[2]], [c[0] - sx * w * 0.4, c[1], c[2]]], 0.014, 6, 2), S.gloss);
  B.add(roundPlate(w, h, 0.07, Math.min(w, h) * 0.3, 0.015, fine ? 5 : 3), S.gloss, c, [0, sx * 0.08, 0]);
  B.add(roundPlate(w * 0.86, h * 0.88, 0.006, Math.min(w, h) * 0.25), S.chrome, [c[0], c[1], c[2] + 0.034], [0, sx * 0.08, 0]);
}

/* ------------------------------------------------------------------ Kastenwagen */

export function vanBodyHQ(K, S, B, GB, LB, lod, paint, variant) {
  const level = lod === 0 && K.DET >= 2 ? 2 : 1, fine = level >= 2;
  const R = vanBody(level), SH = R.meta, { G } = SH;
  const probe = probeOf(R, `van:${level}`);
  const hitSide = (sx, y, z) => probe([sx * 2.5, y, z], [-sx, 0, 0]);
  const hitFront = (x, y) => probe([x, y, -4], [0, 0, 1]);
  const hitRear = (x, y) => probe([x, y, 4], [0, 0, -1]);
  // Spiegel (groß, an Auslegern), Türgriffe, Schiebetür-Schiene + Griff, Seitenblinker
  for (const sx of [-1, 1]) {
    const h = hitSide(sx, 1.42, G.zA0 + 0.16);
    if (h) armMirror(B, S, sx, h.p, 0.2, 0.16, 0.3, fine);
    for (const z of [-0.62, ...(sx > 0 ? [0.32] : [])]) {
      const q = hitSide(sx, 1.2, z);
      if (q) B.add(roundPlate(0.18, 0.04, 0.03, 0.015), S.grain, [q.p[0] + q.n[0] * 0.012, q.p[1], q.p[2]], alignZ(q.n));
    }
    const am = hitSide(sx, 1.0, -2.2);
    if (am && fine) B.add(roundPlate(0.08, 0.025, 0.012, 0.01), S.amber, [am.p[0] + am.n[0] * 0.004, am.p[1], am.p[2]], alignZ(am.n));
  }
  if (fine) {
    const pts = [];
    for (let k = 0; k <= 8; k++) { const z = lerp(0.2, 2.5, k / 8), q = hitSide(1, 2.1, z); if (q) pts.push([q.p[0] + 0.012, 2.1, z]); }
    if (pts.length > 2) B.add(tube(pts, 0.012, 4, 2), S.dark);
  }
  // Front: Kennzeichen, Grill-Lamellen, Scheinwerfer-Einsätze, Wischer
  {
    const h = hitFront(0, 0.55), z = h ? h.p[2] : -2.64;
    B.add(new THREE.PlaneGeometry(0.52, 0.112), plateMaterial(variant + 3, S), [0, 0.55, z - 0.014], [0, PI, 0], null, { keepUV: true });
    B.add(roundPlate(0.55, 0.13, 0.012, 0.01), S.grain, [0, 0.55, z - 0.006]);
    const n = fine ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const y = lerp(0.79, 0.93, i / (n - 1)), pts = [];
      for (let k = 0; k <= 8; k++) { const x = lerp(-0.5, 0.5, k / 8), q = hitFront(x, y); pts.push(q ? [x, y, q.p[2] - 0.006] : [x, y, -2.64]); }
      B.add(tube(pts, 0.008, 4, 2), S.dark);
    }
    if (fine) for (const sx of [-1, 1]) {
      const q = hitFront(sx * 0.72, 0.9);
      if (!q) continue;
      B.add(new THREE.CircleGeometry(0.045, 20), S.dark, [q.p[0] + q.n[0] * 0.003, q.p[1], q.p[2] - 0.003], alignZ(q.n));
      B.add(new THREE.TorusGeometry(0.048, 0.005, 4, 22), S.chrome, [q.p[0] + q.n[0] * 0.003, q.p[1], q.p[2] - 0.003], alignZ(q.n));
    }
    if (fine) for (const [x0, x1] of [[-0.78, -0.08], [0.1, 0.8]]) {
      const pts = [];
      for (let k = 0; k <= 6; k++) { const x = lerp(x0, x1, k / 6), q = probe([x, 3, G.zA0 + 0.14], [0, -0.45, -1]); pts.push(q ? [q.p[0], q.p[1] + 0.012, q.p[2] + 0.01] : [x, 1.33, G.zA0 + 0.06]); }
      B.add(tube(pts, 0.007, 4, 1), S.dark);
    }
  }
  // Heck: Kennzeichen, Trittstufe, Hecktürgriff
  {
    const h = hitRear(0, 0.7), z = h ? h.p[2] : 2.64;
    B.add(new THREE.PlaneGeometry(0.52, 0.112), plateMaterial(variant + 3, S), [0, 0.7, z + 0.014], null, null, { keepUV: true });
    B.add(roundPlate(0.55, 0.13, 0.012, 0.01), S.grain, [0, 0.7, z + 0.006]);
    B.add(roundPlate(0.7, 0.05, 0.22, 0.02), S.grain, [0, 0.42, 2.66]);
    // Hecktür-Scheiben (bündig, mit Siebdruckrand)
    for (const sx of [-1, 1]) {
      const c = [sx * 0.44, 1.86], q = hitRear(c[0], c[1]), zz = q ? q.p[2] : 2.64;
      B.add(roundPlate(0.66, 0.56, 0.01, 0.06), S.frit, [c[0], c[1], zz + 0.002]);
      GB.add(roundPlate(0.56, 0.47, 0.008, 0.05), S.carGlass, [c[0], c[1], zz + 0.006]);
    }
    B.add(roundPlate(0.04, 0.16, 0.03, 0.012), S.grain, [0.08, 1.2, (hitRear(0.08, 1.2)?.p[2] ?? 2.64) + 0.015]);
  }
  for (const ar of SH.arches) for (const sx of [-1, 1]) B.add(liner(ar.R - 0.014, 0.26, fine ? 20 : 10), S.grain, [sx * 0.74, ar.y, ar.z], [0, 0, HP]);
  B.add(K.box(1.5, 0.12, 4.6), S.dark, [0, 0.5, 0.0]);
  addCarBody(R, S, B, GB, LB, paint);
}

/* ------------------------------------------------------------------ Fahrerhaus der Sattelzugmaschine */

export function cabBodyHQ(K, S, B, GB, LB, lod, paint, variant, paint2) {
  const level = lod === 0 && K.DET >= 2 ? 2 : 1, fine = level >= 2;
  const R = cabBody(level), { G } = R.meta;
  const probe = probeOf(R, `cab:${level}`);
  const hitSide = (sx, y, z) => probe([sx * 2.5, y, z], [-sx, 0, 0]);
  const hitFront = (x, y) => probe([x, y, -5], [0, 0, 1]);
  // Unterseite der Kabine, Stoßfänger (Kunststoff) mit Scheinwerfern und Blinkern, Kennzeichen, Trittstufen
  B.add(K.box(1.5, 0.32, 2.0), S.dark, [0, 1.1, -1.95]);
  for (const sx of [-1, 1]) B.add(K.box(0.42, 0.18, 1.3), S.dark, [sx * 0.98, 1.2, -2.2]);
  B.add(roundPlate(2.46, 0.5, 0.26, 0.08, 0.03, fine ? 4 : 2), S.grain, [0, 0.7, -3.22]);
  B.add(new THREE.PlaneGeometry(0.52, 0.112), plateMaterial(variant + 5, S), [0, 0.58, -3.357], [0, PI, 0], null, { keepUV: true });
  for (const sx of [-1, 1]) {
    B.add(roundPlate(0.42, 0.2, 0.03, 0.04), S.gloss, [sx * 0.86, 0.8, -3.345]);
    LB.add(roundPlate(0.38, 0.16, 0.02, 0.035), S.lensOff, [sx * 0.86, 0.8, -3.36], null, null, { tag: { lens: true } });
    if (fine) for (const dx of [-0.09, 0.09]) B.add(new THREE.TorusGeometry(0.045, 0.006, 4, 20), S.chrome, [sx * 0.86 + dx, 0.8, -3.372]);
    B.add(roundPlate(0.1, 0.16, 0.03, 0.02), S.amber, [sx * 1.13, 0.8, -3.345]);
    // Trittstufen im Radhaus-Einstieg
    for (const yy of [0.42, 0.72]) B.add(roundPlate(0.26, 0.04, 0.5, 0.01), S.grain, [sx * 1.1, yy, -1.75], [HP, 0, 0]);
    // Spiegel (Haupt + Weitwinkel) an Rohrbügeln
    const h = hitSide(sx, 2.35, -2.95);
    if (h) {
      const c = [h.p[0] + sx * 0.25, 2.2, -2.97];
      B.add(tube([[h.p[0], 2.42, -2.95], [c[0], 2.45, -2.97], [c[0], 1.82, -2.97], [h.p[0], 1.78, -2.95]], 0.016, 6, 3), S.gloss);
      B.add(roundPlate(0.24, 0.44, 0.08, 0.04), S.gloss, [c[0] + sx * 0.04, 2.18, -2.95]);
      B.add(roundPlate(0.2, 0.38, 0.006, 0.03), S.chrome, [c[0] + sx * 0.04, 2.18, -2.995], [0, PI, 0]);
      B.add(roundPlate(0.2, 0.18, 0.07, 0.04), S.gloss, [c[0] + sx * 0.04, 1.86, -2.95]);
    }
    const dh = hitSide(sx, 1.55, -2.6);
    if (dh) B.add(roundPlate(0.22, 0.05, 0.035, 0.02), S.grain, [dh.p[0] + dh.n[0] * 0.015, 1.55, -2.6], alignZ(dh.n));
  }
  // Grill-Lamellen (Wagenfarbe dunkler), Fanfare, Sonnenblende über der Scheibe
  const n = fine ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const y = lerp(1.12, 1.46, i / (n - 1)), pts = [];
    for (let k = 0; k <= 8; k++) { const x = lerp(-0.85, 0.85, k / 8), q = hitFront(x, y); pts.push(q ? [x, y, q.p[2] - 0.008] : [x, y, -3.25]); }
    B.add(tube(pts, 0.014, 4, 2), paint2 || S.dark);
  }
  {
    const q = probe([0, 2.7, -5], [0, 0, 1]);
    const z = q ? q.p[2] : -3.0;
    B.add(roundPlate(2.2, 0.05, 0.3, 0.02), S.gloss, [0, 2.66, z - 0.12], [0.22, 0, 0]);
  }
  if (fine) {
    for (const [x0, x1] of [[-1.0, -0.1], [0.1, 1.0]]) B.add(tube([[x0, 1.8, -3.215], [x1, 1.78, -3.215]], 0.008, 4, 1), S.dark);
    B.add(K.cyl(0.05, 0.05, 0.12, 6), S.chrome, [0.5, 3.36, -2.4]);
  }
  for (const sx of [-1, 1]) B.add(liner(0.58, 0.32, fine ? 20 : 10), S.grain, [sx * 0.95, 0.52, -2.2], [0, 0, HP]);
  void G;
  addCarBody(R, S, B, GB, LB, paint);
}
