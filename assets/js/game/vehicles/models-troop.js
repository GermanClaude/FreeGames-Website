// NULLPUNKT — Truppentransporter auf Rädern und Halbketten (Nutzer 20.11., Daten: data-troop.js). Frei erfunden:
//
//   RS-8 Waran      (rsp)  Radschützenpanzer 8×8: V-förmige Unterwanne, Seitenwannen über den Rädern, Bug mit Wellenbrecher,
//                          Einmann-Turm mit 30-mm-Maschinenkanone, Rundblickoptik, Heckrampe, Dachluken, Kampfraum innen.
//   LKW-5 Ackergaul (lkw)  6×6-Lkw: Frontlenker-Kabine (hohl: Armaturen, Sitze, Lenkrad, Scheiben), Ladefläche mit Bordwänden,
//                          Spriegel und Plane (innen sichtbar), Längsbänke mit sitzenden Figuren, Bordwand hinten klappt.
//   GMW-6 Murmel    (gmw)  Mannschaftswagen 4×4: kurze Haube, Doppelkabine (hohl), offene Ladefläche mit Klappbänken und
//                          Überrollbügeln, Portalachsen.
//   GW-7 Steinbock  (gwmg) offener Geländewagen mit Rammschutz, Klappscheibe, Kastenaufbau, Drehring mit schwerem MG.
//   ZK-8 Packesel   (hkw)  Halbkette (2. WK): lange Haube, offene Sitzreihen, Faltverdeck, Kettenlaufwerk mit Schachtelrollen.
//   SPW-41 Hamster  (spw)  Schützenpanzerwagen (Halbkette, 2. WK): geknickte Panzerplatten, offener Kampfraum, MG mit Schild,
//                          zweiflügelige Hecktür (Gruppe 'ramp', Art 'tueren').
//
// Aufruf aus models.js template(): TROOP_BUILDERS[model](lod, S, K, team) → { hull, wheels, mg?, tur?, gun?, cmg?, inner?,
// ramp?, extra? } (wheels wie models-civil.js: [{ spin, axle, side, x, z }]; Halbketten liefern nur die Vorderräder).
import * as THREE from 'three';
import { tire, steelRim } from './bodykit.js?v=20261121041936';
import { seatedFigure, steeringWheel } from './models-civil.js?v=20261121041936';
import { sprocket, idler, smokeRack, guardedLamp, towCable, jerrycan, antenna, weld, stowBox, hullShell } from './models-tanks.js?v=20261121041936';
import { troopInner, rampGroup } from './models-heavy.js?v=20261121041936';
import { armorShell, stackRings, insetPoly } from './armorkit.js?v=20261121041936';

const PI = Math.PI, HP = PI / 2;
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _d = new THREE.Vector3(), AZ = new THREE.Vector3(0, 0, 1);

/* ===================================================================== Hilfen */

/** Quader von a nach b (Querschnitt w × h). */
function bar(K, B, mat, a, b, w, h) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _d.length();
  if (len < 1e-4) return;
  _q.setFromUnitVectors(AZ, _d.multiplyScalar(1 / len));
  _e.setFromQuaternion(_q);
  B.add(K.box(w, h, len), mat, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [_e.x, _e.y, _e.z]);
}
/** Rohr von a nach b (Radius r). */
function tubeAB(K, B, mat, a, b, r, seg = 8) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _d.length();
  if (len < 1e-4) return;
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _d.multiplyScalar(1 / len));
  _e.setFromQuaternion(_q);
  B.add(K.cyl(r, r, len, seg), mat, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [_e.x, _e.y, _e.z]);
}

/**
 * Militärräder je Achse: spec [{ z, r, w, x, kind }] – Geländereifen mit Stollen (Stufe 0 HQ: bodykit tire 'mud'),
 * Stahlscheibe im Fahrzeuglack, Nabe mit Reifendruck-Regelanlage, Radmuttern. → [{ spin, axle, side, x, z }]
 */
function milWheels(K, S, lod, spec, paint) {
  const out = [], seg = [26, 14, 8][lod];
  spec.forEach((w, axle) => {
    if (w.hidden) return;
    for (const side of [-1, 1]) {
      const spin = new THREE.Group();
      const R = new K.Bucket(), rr = w.r, ww = w.w, ri = rr * 0.58;
      if (K.HQ && lod === 0) {
        R.add(tire(rr, ww, ri, { kind: w.kind || 'truck', seg: K.DET === 2 ? 48 : 28 }), S.rubber);
        R.add(steelRim(ri, { holes: 8, seg: K.DET === 2 ? 24 : 14 }), paint, [side * ww * 0.18, 0, 0], side < 0 ? [0, PI, 0] : null);
        R.add(K.cyl(ri * 0.98, ri * 0.98, ww * 0.8, 18, true), S.dark, [0, 0, 0], [0, 0, HP]);
      } else {
        R.add(K.tireGeometry(rr, ww, seg, lod === 0), S.rubber, [0, 0, 0], [0, 0, HP]);
        R.add(K.cyl(ri, ri, ww * 0.82, seg), paint, [0, 0, 0], [0, 0, HP]);
      }
      R.add(K.cyl(rr * 0.2, rr * 0.24, 0.08, Math.max(8, seg >> 1)), S.dark, [side * ww * 0.36, 0, 0], [0, 0, HP]);
      if (lod === 0) {
        for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; R.add(K.cyl(0.014, 0.014, 0.04, 6), S.steel, [side * ww * 0.3, Math.sin(a) * rr * 0.3, Math.cos(a) * rr * 0.3], [0, 0, HP]); }
        if (w.ctis && K.DET === 2) { R.add(K.cyl(0.03, 0.03, 0.12, 6), S.steel, [side * (ww * 0.42 + 0.06), 0, 0], [0, 0, HP]); }
      }
      const x = side * w.x;
      R.build(spin, { shadow: lod < 2, off: [x, rr, w.z] });
      out.push({ spin, axle, side, x, z: w.z, dx: 0, dy: 0 });
    }
  });
  return out;
}

/**
 * Hohle Kabine (Ego-Sicht): Boden, Stirnwand unten, Türen bis zur Gürtellinie, Säulen, Dach, Rückwand mit Fenster,
 * Scheiben (GB), Armaturenbrett mit Instrumenten, Sitze. c = { x (Halbbreite), zF (vorn), zB (hinten), yF (Boden),
 * yB (Gürtel), yT (Dach), rake (Neigung Frontscheibe in m), seats: [[x, z]], door: true }.
 */
function hollowCab(K, B, GB, S, paint, c, lod) {
  const { box } = K, { x: hx, zF, zB, yF, yB, yT } = c, rake = c.rake || 0.12;
  const L = zB - zF, zm = (zF + zB) / 2;
  B.add(box(hx * 2, 0.05, L), S.dark, [0, yF - 0.02, zm]);                                         // Boden
  B.add(box(hx * 2 - 0.04, 0.02, L - 0.06), S.rubber, [0, yF + 0.01, zm]);
  B.add(box(hx * 2, yB - yF + 0.12, 0.06), paint, [0, (yF + yB) / 2 - 0.06, zF]);                   // Stirnwand
  for (const sx of [-1, 1]) {
    B.add(box(0.05, yB - yF + 0.1, L), paint, [sx * hx, (yF + yB) / 2 - 0.05, zm]);                 // Tür/Seitenwand
    if (lod === 0) { B.add(box(0.02, 0.05, 0.22), S.dark, [sx * (hx + 0.03), yB - 0.12, zm + L * 0.25]); B.add(box(0.02, yB - yF - 0.2, L - 0.12), S.trim, [sx * (hx - 0.03), (yF + yB) / 2, zm]); }
    bar(K, B, paint, [sx * hx, yB, zF], [sx * hx, yT, zF + rake], 0.07, 0.07);                       // A-Säule
    bar(K, B, paint, [sx * hx, yB, zB], [sx * hx, yT, zB], 0.08, 0.08);                              // C-Säule
    if (c.door !== false) bar(K, B, paint, [sx * hx, yB, zm + 0.05], [sx * hx, yT, zm + 0.05], 0.05, 0.05); // Türrahmen
    GB.add(box(0.012, yT - yB - 0.08, L - rake - 0.14), S.glass, [sx * hx, (yB + yT) / 2, zm + rake / 2]);
  }
  B.add(box(hx * 2 + 0.06, 0.06, L + 0.06 - rake), paint, [0, yT + 0.03, zm + rake / 2]);            // Dach
  B.add(box(hx * 2, yT - yF, 0.05), paint, [0, (yF + yT) / 2, zB]);                                 // Rückwand
  GB.add(box(hx * 0.9, (yT - yB) * 0.42, 0.012), S.glass, [0, yB + (yT - yB) * 0.55, zB - 0.03]);
  // Frontscheibe (zweiteilig mit Mittelsteg)
  _e.set(-Math.atan2(rake, yT - yB), 0, 0);
  const hgt = Math.hypot(rake, yT - yB);
  for (const sx of [-1, 1]) GB.add(box(hx - 0.06, hgt - 0.06, 0.012), S.glass, [sx * hx / 2, (yB + yT) / 2, zF + rake / 2], [_e.x, 0, 0]);
  bar(K, B, paint, [0, yB, zF], [0, yT, zF + rake], 0.05, 0.05);
  // Armaturenbrett, Instrumente, Schalter, Funkgerät
  B.add(box(hx * 2 - 0.1, 0.18, 0.4), S.plastic, [0, yB - 0.1, zF + 0.24]);
  if (lod < 2) {
    const dx = c.seats && c.seats[0] ? c.seats[0][0] : -hx * 0.5;
    for (let i = 0; i < 3; i++) B.add(K.cyl(0.045, 0.045, 0.012, 16), S.dial, [dx - 0.12 + i * 0.12, yB - 0.02, zF + 0.43], [1.2, 0, 0]);
    if (lod === 0) {
      for (let i = 0; i < 6; i++) B.add(box(0.02, 0.03, 0.02), i % 2 ? S.amber : S.dark, [0.05 + i * 0.05, yB - 0.03, zF + 0.43]);
      B.add(box(0.3, 0.16, 0.22), S.dark, [hx * 0.5, yB - 0.32, zF + 0.3]);
      B.add(box(0.04, 0.4, 0.04), S.dark, [0.05, yF + 0.25, zF + 0.5], [0.3, 0, 0]);                 // Schalthebel
    }
  }
  for (const [sx, sz] of c.seats || []) {
    B.add(box(0.48, 0.12, 0.48), S.seat, [sx, yF + 0.42, sz]);
    B.add(box(0.48, 0.55, 0.1), S.seat, [sx, yF + 0.75, sz + 0.27], [-0.1, 0, 0]);
    B.add(box(0.36, 0.3, 0.36), S.dark, [sx, yF + 0.2, sz]);
  }
}

/** Sitzende Figuren der Kabinen-/Bankplätze (Stufe 0, unsichtbar bis besetzt): [{ idx, pos (Füße), face (rad), hands }] */
function figures(K, S, list) {
  return list.map(({ idx, pos, face = 0, hands = null, hip = 0.44 }) => {
    const g = new THREE.Group();
    const f = seatedFigure(K, S, idx, [0, hip, 0], 0, hands);
    // Gruppe übernimmt Name und Sichtbarkeit (models.js setOccupant sucht 'occ:i')
    g.name = f.name; f.name = ''; g.visible = false; f.visible = true;
    g.add(f);
    g.position.set(pos[0], pos[1], pos[2]);
    g.rotation.y = face;
    return g;
  });
}

/** Spriegel + Plane über der Ladefläche: Querschnitt (Rechteck mit gerundeten oberen Ecken) entlang z, hinten offen. */
function canvasCover(K, B, S, x0, y0, y1, z0, z1, lod, rollUp = true) {
  const sh = new THREE.Shape(), r = 0.25, t = 0.025;
  const outline = (s, k) => {
    const X = x0 - k, Y0 = y0, Y1 = y1 - k, R = r - k;
    s.moveTo(-X, Y0); s.lineTo(-X, Y1 - R); s.quadraticCurveTo(-X, Y1, -X + R, Y1); s.lineTo(X - R, Y1); s.quadraticCurveTo(X, Y1, X, Y1 - R); s.lineTo(X, Y0);
  };
  outline(sh, 0);
  sh.lineTo(x0 - t, y0);
  const X = x0 - t, Y1 = y1 - t, R = r - t;
  sh.lineTo(X, Y1 - R); sh.quadraticCurveTo(X, Y1, X - R, Y1); sh.lineTo(-X + R, Y1); sh.quadraticCurveTo(-X, Y1, -X, Y1 - R); sh.lineTo(-X, y0);
  sh.lineTo(-x0, y0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: lod === 0 ? 5 : 2, steps: lod === 0 ? 6 : 1 });
  // leichtes Durchhängen der Plane zwischen den Spriegeln (Stufe 0)
  if (lod === 0) {
    const P = g.attributes.position, nb = 5;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i), z = P.getZ(i);
      if (y < y1 - 0.3) continue;
      const u = (z / (z1 - z0)) * nb, f = Math.abs(Math.sin(u * PI));
      P.setY(i, y - f * 0.035);
    }
    g.computeVertexNormals();
  }
  g.translate(0, 0, z0);
  B.add(g, S.canvas);
  // Stirnplane vorn (geschlossen), Spriegel innen
  B.add(K.box(x0 * 2, y1 - y0 - 0.05, 0.02), S.canvas, [0, (y0 + y1) / 2 - 0.02, z0 + 0.01]);
  if (lod < 2) for (let k = 0; k <= 5; k++) {
    const z = z0 + 0.1 + (k / 5) * (z1 - z0 - 0.2);
    for (const sx of [-1, 1]) B.add(K.box(0.03, y1 - y0 - 0.28, 0.04), S.dark, [sx * (x0 - 0.04), (y0 + y1) / 2 - 0.12, z]);
    B.add(K.box(x0 * 2 - 0.4, 0.03, 0.04), S.dark, [0, y1 - 0.05, z]);
  }
  if (rollUp && lod < 2) B.add(K.cyl(0.09, 0.09, x0 * 2 - 0.1, 10), S.canvas, [0, y1 - 0.12, z1 - 0.02], [0, 0, HP]); // hochgerollte Heckplane
}

/** Ladefläche mit Bordwänden (Rungen), Boden aus Bohlen. */
function cargoBed(K, B, S, paint, x0, yF, h, z0, z1, lod) {
  const { box } = K, L = z1 - z0, zm = (z0 + z1) / 2;
  B.add(box(x0 * 2, 0.08, L), paint, [0, yF - 0.04, zm]);
  if (lod === 0) for (let i = 0; i < 7; i++) B.add(box(x0 * 2 - 0.08, 0.012, 0.03), S.dark, [0, yF + 0.006, z0 + 0.3 + i * (L - 0.6) / 6]);
  for (const sx of [-1, 1]) {
    B.add(box(0.05, h, L), paint, [sx * x0, yF + h / 2, zm]);
    if (lod < 2) for (let i = 0; i <= 4; i++) B.add(box(0.07, h + 0.04, 0.06), paint, [sx * (x0 + 0.02), yF + h / 2, z0 + 0.05 + i * (L - 0.1) / 4]);
    if (lod === 0) for (let i = 0; i < 4; i++) B.add(box(0.02, 0.04, 0.04), S.dark, [sx * (x0 + 0.06), yF + h - 0.08, z0 + 0.3 + i * (L - 0.6) / 3]);
  }
  B.add(box(x0 * 2, h, 0.05), paint, [0, yF + h / 2, z0]);
}

/** Längsbank (Holzsitz auf Stahlgestell, Klapplehne) entlang z. */
function bench(K, B, S, x, yF, z0, z1, lod, back = true) {
  const { box } = K, L = z1 - z0, zm = (z0 + z1) / 2, sx = Math.sign(x) || 1;
  B.add(box(0.36, 0.05, L), S.wood, [x, yF + 0.42, zm]);
  if (back) B.add(box(0.04, 0.32, L), S.wood, [x + sx * 0.17, yF + 0.72, zm], [0, 0, sx * 0.08]);
  if (lod < 2) for (let i = 0; i <= 3; i++) B.add(box(0.04, 0.4, 0.04), S.dark, [x, yF + 0.2, z0 + 0.1 + i * (L - 0.2) / 3]);
}

/** Halbketten-Laufwerk einer Seite: Triebrad vorn, Leitrad hinten, Schachtel-Laufrollen, Kette (beide Seiten). */
function halfTrack(K, B, S, paint, hull, T, lod) {
  for (const sx of [-1, 1]) {
    const x = sx * T.x;
    if (lod < 2) {
      T.road.forEach((z, i) => {
        const xx = x + sx * (i % 2 ? -0.07 : 0.07);
        if (K.HQ) K.addRoadWheelHQ(B, S, paint, xx, T.r, z, T.r, lod === 0 ? 16 : 10, lod);
        else K.addRoadWheel(B, S, xx, T.r, z, T.r, 8, lod);
      });
      // Schwingarme und Federträger
      B.add(K.box(0.12, 0.22, T.z1 - T.z0 - 0.4), S.dark, [sx * (T.x - 0.32), T.r + 0.12, (T.z0 + T.z1) / 2]);
    } else for (const z of [T.road[0], T.road[T.road.length - 1]]) B.add(K.cyl(T.r, T.r, 0.36, 8), S.rubber, [x, T.r, z], [0, 0, HP]);
    sprocket(K, B, S, paint, x, T.sprocket[1], T.sprocket[0], T.sprocket[2], T.w + 0.04, 10, lod);
    idler(K, B, S, paint, x, T.idler[1], T.idler[0], T.idler[2], T.w + 0.02, lod, 6);
  }
  return () => K.addTracks(hull, K.trackPathFor(lod, T.road[0], T.road[T.road.length - 1], [T.sprocket[0], T.sprocket[1], T.sprocket[2]], [T.idler[0], T.idler[1], T.idler[2]], T.road.slice().reverse().map((z) => [z, T.r * 2 + 0.02]), 0.03), T.x, T.w);
}
const gunOff = (D) => [D.turretPivot[0] + D.gunPivot[0], D.turretPivot[1] + D.gunPivot[1], D.turretPivot[2] + D.gunPivot[2]];

/* ===================================================================== RS-8 Waran (8×8) */

function buildRSP(lod, S, K, team) {
  K.setLod(lod);
  const D = K.VEHICLES.rsp, W = D.wheels, DET = K.DET, HQ = K.HQ;
  const { box, cyl, Bucket } = K;
  const seg = [20, 12, 7][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  // V-Unterwanne (schmal), Oberwanne mit geneigtem Bug und eingezogenen Seiten über den Rädern
  hullShell(K, B, paint, [[3.55, 0.82], [3.82, 1.28], [-3.82, 1.3], [-3.6, 0.82]], 1.62, lod, { r: 0.05, rs: 0.05 });
  if (lod < 2) B.add(K.sideExtrude([[3.5, 0.82], [-3.55, 0.82], [-3.45, 0.62], [3.4, 0.62]], 1.2), paint);   // V-Kiel
  hullShell(K, B, paint, [[3.86, 1.24], [3.55, 1.5], [2.6, 2.2], [-3.78, 2.26], [-3.88, 1.6], [-3.86, 1.24]], 2.9, lod, { r: 0.05, rs: 0.05, tuck: 0.16 });
  // Kotflügel/Radläufe, Zusatzpanzer-Module an den Seiten
  for (const sx of [-1, 1]) {
    if (lod < 2) for (let i = 0; i < 4; i++) {
      const z = -2.85 + i * 1.62;
      B.add(box(0.06, 0.55, 1.5), paint, [sx * 1.46, 1.62, z], [0, 0, sx * 0.07]);
      if (lod === 0 && DET === 2) for (let j = 0; j < 4; j++) for (const dy of [-0.18, 0.18]) B.add(cyl(0.016, 0.016, 0.02, 6), S.dark, [sx * 1.5, 1.62 + dy, z - 0.55 + j * 0.37], [0, 0, HP]);
    }
    for (const z of W.z) B.add(box(0.5, 0.04, 1.35), S.dark, [sx * 1.15, 1.3, z]);
  }
  if (lod < 2) {
    // Bug: Wellenbrecher, Scheinwerfer, Winkelspiegel des Fahrers, Motorgitter rechts, Auspuff rechts
    B.add(box(2.2, 0.32, 0.04), paint, [0, 1.62, -3.6], [-0.9, 0, 0]);
    for (let i = -1; i <= 1; i++) B.add(box(0.13, 0.08, 0.1), S.optic, [-0.62 + i * 0.19, 2.21, -2.95 + Math.abs(i) * 0.04], [0, -i * 0.35, 0]);
    B.add(box(1.0, 0.04, 1.3), S.dark, [0.65, 2.2, -2.4]);
    if (lod === 0) for (let i = 0; i < 9; i++) B.add(box(0.95, 0.03, 0.05), paint, [0.65, 2.22, -2.95 + i * 0.14]);
    B.add(box(0.06, 0.32, 0.6), S.dark, [1.37, 2.0, -1.2]);
    for (const sx of [-1, 1]) B.add(new THREE.TorusGeometry(0.07, 0.022, 4, 8), S.dark, [sx * 0.75, 1.0, -3.7], [0, HP, 0]);
    // Dach: Dachluken (Deckel = Luke 'loader'), Winkelspiegel der Schützen, Antennen, Staukästen am Heck
    B.add(box(1.2, 0.03, 1.0), S.dark, [0, 2.265, 2.7]);
    for (const sx of [-1, 1]) {
      for (const z of [0.8, 2.0]) B.add(box(0.1, 0.08, 0.14), S.optic, [sx * 1.1, 2.29, z], [0, sx * HP, 0]);
      antenna(K, B, S, [sx * 1.05, 2.26, 3.3], lod === 0 ? 2.3 : 1.5, lod);
      B.add(box(0.12, 0.08, 0.04), S.rearLamp, [sx * 1.2, 1.95, 3.86]);
      stowBox(K, B, paint, S, [sx * 1.15, 1.6, 3.6], [0.45, 0.5, 0.45], lod);
    }
    jerrycan(K, B, paint, S, [-1.25, 2.45, 1.6], 0, lod);
  }
  for (const L of D.lights) guardedLamp(K, B, S, L, 0.08, lod);
  if (HQ && lod < 2) {
    for (const sx of [-1, 1]) { weld(K, B, paint, [[sx * 1.3, 2.24, -2.55], [sx * 1.3, 2.26, 3.7]], lod); towCable(K, B, S, [[sx * 1.38, 2.0, -2.2], [sx * 1.42, 1.95, -0.6], [sx * 1.38, 2.0, 0.9]], lod); }
    weld(K, B, paint, [[-1.3, 2.2, -2.6], [1.3, 2.2, -2.6]], lod);
  }
  for (const sx of [-1, 1]) B.add(cyl(0.2, 0.2, 0.02, seg), mark, [sx * 1.49, 1.62, 1.4], [0, 0, HP]);
  // Achsen/Querlenker sichtbar unter der Wanne
  if (lod < 2) for (const z of W.z) { B.add(box(1.9, 0.14, 0.18), S.dark, [0, 0.66, z]); for (const sx of [-1, 1]) B.add(cyl(0.06, 0.06, 0.5, 8), S.steel, [sx * 0.75, 0.88, z + 0.2], [0, 0, sx * 0.8]); }
  B.build(hull, { shadow: true });
  K.addLenses(hull, D, seg, 0.07);
  const wheels = milWheels(K, S, lod, W.z.map((z) => ({ z, r: W.radius, w: 0.44, x: W.x, ctis: true })), paint);

  // Einmann-Turm: Keilfront, Wangen, Nebelwurfbecher, Optik des Richtschützen, Staukorb
  const T = new Bucket();
  const foot = [[-0.45, 1.05], [0.45, 1.05], [0.92, 0.5], [0.95, -0.7], [0.72, -0.98], [-0.72, -0.98], [-0.95, -0.7], [-0.92, 0.5]];
  if (HQ && lod < 2) T.add(armorShell(stackRings([[0, foot], [0.52, insetPoly(foot, 0.1)]], { r: 0.03, rTop: 0.035, rBot: 0.03 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0 }), paint);
  else T.add(K.topExtrude(foot, 0.52), paint);
  T.add(cyl(0.8, 0.82, 0.1, seg + 4), S.dark, [0, -0.03, 0]);
  if (lod < 2) {
    for (const sx of [-1, 1]) smokeRack(K, T, S, paint, sx * 0.82, 0.56, -0.55, 4, sx, lod);
    T.add(box(0.32, 0.24, 0.36), paint, [0.5, 0.64, -0.55]);
    T.add(box(0.26, 0.13, 0.02), S.optic, [0.5, 0.66, -0.74]);
    T.add(box(1.5, 0.04, 0.35), S.dark, [0, 0.12, 1.12]);
    for (const sx of [-1, 0, 1]) T.add(box(0.03, 0.3, 0.03), S.dark, [sx * 0.74, 0.27, 1.3]);
    T.add(box(1.5, 0.03, 0.03), S.dark, [0, 0.42, 1.3]);
    if (lod === 0) T.add(box(0.6, 0.24, 0.28), S.canvas, [0.3, 0.26, 1.12]);
    antenna(K, T, S, [-0.65, 0.52, 0.8], lod === 0 ? 1.8 : 1.2, lod);
  }
  for (const sx of [-1, 1]) T.add(cyl(0.12, 0.12, 0.02, seg), mark, [sx * 0.95, 0.26, 0.15], [0, 0, HP]);
  // 30-mm-Maschinenkanone (Wiege, Rohr, Mündungsfeuerdämpfer, Doppelgurt-Zuführung), Koax
  const G = new Bucket();
  G.add(box(0.4, 0.32, 0.34), paint, [0, 0, 0.05]);
  G.add(box(0.26, 0.22, 0.3), paint, [0, 0, -0.25]);
  G.add(cyl(0.042, 0.042, 2.25, seg), S.dark, [0, 0, -1.45], [HP, 0, 0]);
  G.add(cyl(0.06, 0.06, 0.5, seg), paint, [0, 0, -0.6], [HP, 0, 0]);
  G.add(cyl(0.058, 0.052, 0.22, seg), S.dark, [0, 0, -2.66], [HP, 0, 0]);
  if (lod === 0) { for (let i = 0; i < 4; i++) G.add(box(0.12, 0.012, 0.02), S.dark, [0, 0, -2.6 - i * 0.045]); G.add(box(0.07, 0.07, 0.1), S.dark, [0, 0.08, -0.92]); }
  G.add(cyl(0.015, 0.015, 0.32, 6), S.dark, [D.coax[0], D.coax[1], -0.4], [HP, 0, 0]);
  // Rundblickoptik des Kommandanten
  const C = new Bucket();
  C.add(cyl(0.13, 0.13, 0.2, seg), paint, [0, 0, 0]);
  C.add(box(0.18, 0.11, 0.04), S.optic, [0, 0.01, -0.12]);
  if (lod < 2) C.add(box(0.24, 0.03, 0.2), paint, [0, 0.11, -0.02]);
  const tur = new THREE.Group(), gun = new THREE.Group(), cmg = new THREE.Group();
  T.build(tur, { off: D.turretPivot });
  G.build(gun, { off: gunOff(D) });
  C.build(cmg, { shadow: lod < 2, off: [D.turretPivot[0] + D.cmgPivot[0], D.turretPivot[1] + D.cmgPivot[1], D.turretPivot[2] + D.cmgPivot[2]] });
  const out = { hull, wheels, tur, gun, cmg };
  if (lod === 0) { out.inner = troopInner(K, S, D, { driver: [-0.62, 0.95, -2.85], engineX: 0.62 }); out.ramp = rampGroup(K, S, paint, D, lod); }
  return out;
}

/* ===================================================================== LKW-5 Ackergaul (6×6, Plane) */

function buildLKW(lod, S, K, team) {
  K.setLod(lod);
  const D = K.VEHICLES.lkw, W = D.wheels, DET = K.DET;
  const { box, cyl, Bucket } = K;
  const seg = [20, 12, 7][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket(), GB = new Bucket(), LB = new Bucket();
  // Fahrgestell: Längsträger, Querträger, Tanks, Batteriekasten, Druckluftkessel, Reserverad hinter der Kabine
  B.add(box(0.95, 0.26, 7.6), S.dark, [0, 1.02, 0.5]);
  if (lod < 2) {
    for (const z of [-2.0, -0.6, 0.8, 2.2, 3.6]) B.add(box(1.0, 0.12, 0.1), S.dark, [0, 1.02, z]);
    B.add(cyl(0.28, 0.28, 0.9, seg), paint, [-0.85, 0.98, -0.95], [HP, 0, 0]);
    B.add(box(0.5, 0.42, 0.55), S.dark, [0.85, 0.98, -1.0]);
    B.add(cyl(0.12, 0.12, 0.7, 10), S.steel, [0.78, 0.9, 0.3], [HP, 0, 0]);
    for (const sx of [-1, 1]) B.add(box(0.5, 0.08, 0.4), S.dark, [sx * 1.05, 0.75, -2.0]);            // Trittstufen
  }
  // Kabine (Frontlenker): Unterbau über der Vorderachse, hohle Kabine oben, Kühlergrill, Stoßfänger
  B.add(box(2.4, 0.62, 1.6), paint, [0, 1.48, -2.8]);
  hollowCab(K, B, GB, S, paint, { x: 1.18, zF: -3.62, zB: -2.15, yF: 1.6, yB: 2.0, yT: 2.92, rake: 0.1, seats: [[-0.55, -2.9], [0.55, -2.9]] }, lod);
  B.add(box(1.6, 0.48, 0.04), S.dark, [0, 1.52, -3.62]);
  if (lod === 0) for (let i = 0; i < 7; i++) B.add(box(1.55, 0.03, 0.03), paint, [0, 1.32 + i * 0.065, -3.645]);
  B.add(box(2.5, 0.24, 0.26), S.dark, [0, 0.98, -3.7]);
  for (const sx of [-1, 1]) {
    LB.add(cyl(0.11, 0.11, 0.05, seg), S.lensOff, [sx * 0.95, 1.28, -3.6], [HP, 0, 0], null, { tag: { lens: true } });
    B.add(cyl(0.14, 0.14, 0.1, seg), S.dark, [sx * 0.95, 1.28, -3.56], [HP, 0, 0]);
    B.add(box(0.1, 0.1, 0.03), S.amber, [sx * 1.12, 1.55, -3.63]);
    B.add(box(0.06, 0.38, 0.22), S.dark, [sx * 1.3, 2.4, -3.35]);                                   // Außenspiegel
    B.add(box(0.04, 0.04, 0.3), S.dark, [sx * 1.24, 2.45, -3.45]);
    B.add(new THREE.TorusGeometry(0.06, 0.02, 4, 8), S.dark, [sx * 0.7, 0.98, -3.84], [0, HP, 0]);
  }
  // Kotflügel vorn, Auspuff stehend hinter der Kabine, Luftfilter
  for (const sx of [-1, 1]) B.add(box(0.5, 0.04, 1.3), S.dark, [sx * 1.0, 1.2, W.z[0]]);
  B.add(cyl(0.06, 0.06, 1.2, 10), S.dark, [1.15, 2.45, -2.1]);
  B.add(cyl(0.16, 0.16, 0.5, 12), S.dark, [-1.1, 2.3, -2.05]);
  if (lod < 2) { B.add(cyl(0.5, 0.5, 0.3, seg), S.rubber, [0, 1.75, -1.85], [0, 0, HP]); B.add(cyl(0.28, 0.28, 0.32, seg), paint, [0, 1.75, -1.85], [0, 0, HP]); }
  // Ladefläche, Bordwände, Plane, Längsbänke
  cargoBed(K, B, S, paint, 1.2, 1.38, 0.62, -1.68, 4.42, lod);
  B.add(box(1.5, 0.22, 6.0), S.dark, [0, 1.23, 1.37]);                                               // Hilfsrahmen unter der Pritsche
  if (lod < 2) for (let i = 0; i < 9; i++) B.add(box(2.36, 0.1, 0.1), S.dark, [0, 1.29, -1.5 + i * 0.73]);   // Querträger
  canvasCover(K, B, S, 1.23, 1.98, 3.25, -1.7, 4.42, lod);
  for (const sx of [-1, 1]) bench(K, B, S, sx * 0.95, 1.38, -1.5, 2.25, lod);
  if (lod < 2) {
    for (const sx of [-1, 1]) { B.add(box(0.5, 0.04, 2.2), S.dark, [sx * 1.0, 1.25, 1.85]); B.add(box(0.12, 0.08, 0.04), S.rearLamp, [sx * 1.05, 1.1, 4.45]); B.add(box(0.5, 0.35, 0.02), S.rubber, [sx * 1.0, 0.95, 3.2]); }
    for (let i = 0; i < 3; i++) B.add(box(0.5, 0.04, 0.08), S.dark, [0, 0.72 + i * 0.22, 4.48]);                        // Aufstiegsleiter
    B.add(box(0.2, 0.2, 0.2), S.dark, [0, 0.9, 4.42]);
  }
  for (const sx of [-1, 1]) B.add(box(0.03, 0.4, 0.6), mark, [sx * 1.245, 2.6, 1.2]);
  B.build(hull, { shadow: true });
  GB.build(hull, { shadow: false });
  LB.build(hull, { shadow: false });
  const wheels = milWheels(K, S, lod, W.z.map((z) => ({ z, r: W.radius, w: 0.4, x: W.x, ctis: true })), paint);
  const out = { hull, wheels };
  if (lod === 0) {
    out.ramp = tailgate(K, S, paint, D);
    out.extra = [steeringWheel(K, S, [-0.55, 2.2, -3.3], -0.95, 0.22)];
    out.extra.push(...figures(K, S, [
      { idx: 0, pos: [-0.55, 1.6, -2.95], hands: { c: [0, 0.6, -0.35], r: 0.22, tilt: -0.95 } },
      { idx: 1, pos: [0.55, 1.6, -2.95] },
      ...[-1.15, -0.15, 0.85, 1.85].flatMap((z, k) => [-1, 1].map((sx, j) => ({ idx: 2 + k * 2 + j, pos: [sx * 0.86, 1.38, z], face: sx < 0 ? -HP : HP, hip: 0.47 }))),
    ]));
  }
  return out;
}

/** Heckbordwand (Gruppe 'ramp', klappt nach unten), Rückstrahler. */
function tailgate(K, S, paint, D) {
  const R = D.ramp, g = new THREE.Group(), B = new K.Bucket();
  g.name = 'ramp'; g.position.set(0, R.y0, R.z);
  g.userData = { kind: 'bordwand', open: 2.9 };
  const h = R.y1 - R.y0;
  B.add(K.box(R.w, h, 0.05), paint, [0, h / 2, 0]);
  for (let i = 0; i < 4; i++) B.add(K.box(0.06, h, 0.06), paint, [-R.w / 2 + 0.1 + i * (R.w - 0.2) / 3, h / 2, 0.02]);
  for (const sx of [-1, 1]) B.add(K.box(0.1, 0.06, 0.02), S.rearLamp, [sx * (R.w / 2 - 0.15), h - 0.12, 0.04]);
  B.build(g, { shadow: true });
  return g;
}

/* ===================================================================== GMW-6 Murmel (4×4 Mannschaftswagen) */

function buildGMW(lod, S, K, team) {
  K.setLod(lod);
  const D = K.VEHICLES.gmw, W = D.wheels;
  const { box, cyl, Bucket } = K;
  const seg = [20, 12, 7][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket(), GB = new Bucket(), LB = new Bucket();
  // Leiterrahmen, Portalachsen (Vorgelege an den Rädern), Haube (kurz, abgerundet), Kotflügel
  B.add(box(0.8, 0.2, 4.6), S.dark, [0, 0.82, 0.05]);
  if (lod < 2) for (const z of W.z) { B.add(box(1.5, 0.16, 0.18), S.dark, [0, 0.58, z]); for (const sx of [-1, 1]) B.add(box(0.18, 0.36, 0.26), S.dark, [sx * 0.66, 0.5, z]); }
  hullShell(K, B, paint, [[2.72, 0.95], [2.76, 1.3], [2.45, 1.5], [1.75, 1.55], [1.75, 0.95]], 1.9, lod, { r: 0.06, rs: 0.08 });
  for (const sx of [-1, 1]) {
    B.add(K.sideExtrude([[2.65, 1.25], [2.3, 1.38], [1.0, 1.38], [1.0, 1.1], [2.0, 1.05], [2.65, 1.0]], 0.28), paint, [sx * 0.88, 0, 0]);
    B.add(box(0.24, 0.05, 1.1), S.dark, [sx * 0.95, 0.88, -0.55]);                                           // Trittbrett
  }
  B.add(box(1.5, 0.36, 0.04), S.dark, [0, 1.15, -2.77]);
  if (lod === 0) for (let i = 0; i < 5; i++) B.add(box(0.04, 0.32, 0.03), paint, [-0.6 + i * 0.3, 1.15, -2.79]);
  B.add(box(2.0, 0.2, 0.22), S.dark, [0, 0.82, -2.8]);
  for (const sx of [-1, 1]) {
    LB.add(cyl(0.085, 0.085, 0.04, seg), S.lensOff, [sx * 0.72, 1.12, -2.78], [HP, 0, 0], null, { tag: { lens: true } });
    B.add(cyl(0.11, 0.11, 0.08, seg), S.dark, [sx * 0.72, 1.12, -2.74], [HP, 0, 0]);
    B.add(new THREE.TorusGeometry(0.05, 0.018, 4, 8), S.dark, [sx * 0.55, 0.8, -2.93], [0, HP, 0]);
    B.add(box(0.05, 0.3, 0.18), S.dark, [sx * 1.08, 1.85, -1.55]);
  }
  // Doppelkabine (hohl) – 2 vorn, dahinter Ladefläche
  hollowCab(K, B, GB, S, paint, { x: 0.98, zF: -1.75, zB: -0.42, yF: 1.0, yB: 1.55, yT: 2.25, rake: 0.18, seats: [[-0.45, -1.1], [0.45, -1.1]] }, lod);
  // Ladefläche mit Klappbänken, Überrollbügel, Heckklappe, Ersatzrad, Kanister
  cargoBed(K, B, S, paint, 0.98, 1.08, 0.42, -0.38, 2.75, lod);
  for (const sx of [-1, 1]) bench(K, B, S, sx * 0.76, 1.08, -0.2, 2.55, lod, false);
  if (lod < 2) {
    for (const z of [0.1, 2.5]) { for (const sx of [-1, 1]) tubeAB(K, B, S.dark, [sx * 0.95, 1.5, z], [sx * 0.85, 2.2, z], 0.03); tubeAB(K, B, S.dark, [-0.85, 2.2, z], [0.85, 2.2, z], 0.03); }
    for (const sx of [-1, 1]) tubeAB(K, B, S.dark, [sx * 0.85, 2.2, 0.1], [sx * 0.85, 2.2, 2.5], 0.025);
    B.add(box(1.96, 0.42, 0.05), paint, [0, 1.29, 2.77]);
    for (const sx of [-1, 1]) B.add(box(0.1, 0.08, 0.04), S.rearLamp, [sx * 0.85, 1.05, 2.8]);
    jerrycan(K, B, paint, S, [0.75, 1.32, 2.95], HP, lod);
    B.add(cyl(0.43, 0.43, 0.26, seg), S.rubber, [-0.4, 1.3, 2.95], [HP, 0, 0]);
    antenna(K, B, S, [-0.9, 2.25, -0.6], lod === 0 ? 1.9 : 1.2, lod);
  }
  for (const sx of [-1, 1]) B.add(box(0.02, 0.3, 0.5), mark, [sx * 0.995, 1.82, -1.05]);
  B.build(hull, { shadow: true });
  GB.build(hull, { shadow: false });
  LB.build(hull, { shadow: false });
  const wheels = milWheels(K, S, lod, W.z.map((z) => ({ z, r: W.radius, w: 0.34, x: W.x })), paint);
  const out = { hull, wheels };
  if (lod === 0) {
    out.extra = [steeringWheel(K, S, [-0.45, 1.6, -1.42], -1.05, 0.2)];
    out.extra.push(...figures(K, S, [{ idx: 0, pos: [-0.45, 1.0, -1.12], hands: { c: [-0.45, 0.6, -0.3], r: 0.2, tilt: -1.05 } }, { idx: 1, pos: [0.45, 1.0, -1.12] }]));
  }
  return out;
}

/* ===================================================================== GW-7 Steinbock (Geländewagen mit MG-Ring) */

function buildGWMG(lod, S, K, team) {
  K.setLod(lod);
  const D = K.VEHICLES.gwmg, W = D.wheels;
  const { box, cyl, Bucket } = K;
  const seg = [20, 12, 7][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket(), GB = new Bucket(), LB = new Bucket();
  // offene Wanne: Unterbau, Haube, Seitenwände niedrig (keine Türen), Kastenaufbau hinten
  B.add(box(0.85, 0.22, 4.4), S.dark, [0, 0.62, 0.0]);
  hullShell(K, B, paint, [[2.48, 0.62], [2.5, 1.02], [2.2, 1.18], [0.95, 1.22], [0.95, 0.62]], 1.86, lod, { r: 0.05, rs: 0.07 });
  for (const sx of [-1, 1]) {
    B.add(K.sideExtrude([[0.95, 1.18], [-2.45, 1.2], [-2.45, 0.66], [-1.95, 0.66], [-1.75, 0.95], [-1.15, 0.95], [-0.95, 0.66], [0.95, 0.66]], 0.05), paint, [sx * 0.97, 0, 0]);
    B.add(K.sideExtrude([[2.45, 1.0], [2.0, 1.08], [1.05, 1.08], [1.05, 0.95], [1.7, 0.92], [2.45, 0.92]], 0.24), paint, [sx * 0.9, 0, 0]);
  }
  B.add(box(1.94, 0.05, 3.3), S.dark, [0, 0.7, -0.7 + 1.55]);
  B.add(box(1.94, 0.55, 0.05), paint, [0, 0.93, 2.45]);
  B.add(box(1.94, 0.5, 0.05), paint, [0, 0.92, 0.95 - 1.9]);                                                 // Stirnwand Fahrerraum
  // Klappscheibe (Rahmen + Glas), Armaturen, Sitze vorn, Bänke hinten
  for (const sx of [-1, 1]) bar(K, B, S.dark, [sx * 0.9, 1.2, -0.95], [sx * 0.88, 1.72, -0.82], 0.04, 0.04);
  B.add(box(1.8, 0.04, 0.04), S.dark, [0, 1.72, -0.82]);
  GB.add(box(1.74, 0.46, 0.012), S.glass, [0, 1.46, -0.89], [-0.25, 0, 0]);
  B.add(box(1.7, 0.16, 0.3), S.plastic, [0, 1.12, -0.78]);
  for (let i = 0; i < 2; i++) B.add(cyl(0.04, 0.04, 0.012, 14), S.dial, [-0.55 + i * 0.12, 1.2, -0.63], [1.2, 0, 0]);
  for (const sx of [-1, 1]) {
    B.add(box(0.46, 0.12, 0.46), S.seat, [sx * 0.46, 1.08, -0.2]);
    B.add(box(0.46, 0.5, 0.1), S.seat, [sx * 0.46, 1.38, 0.05], [-0.15, 0, 0]);
    B.add(box(0.36, 0.05, 1.0), S.wood, [sx * 0.62, 1.28, 1.75]);
  }
  // Drehring mit Stützen über dem Aufbau, Kanisterhalter, Ersatzrad, Rammschutz, Seilwinde, Antenne
  if (lod < 2) {
    for (const [x, z] of [[-0.7, 0.2], [0.7, 0.2], [-0.7, 0.95], [0.7, 0.95]]) tubeAB(K, B, S.dark, [x, 1.2, z], [x * 0.75, 1.92, (z + 0.55) / 2 + 0.28], 0.03);
    B.add(new THREE.TorusGeometry(0.58, 0.035, 6, lod === 0 ? 28 : 14), S.dark, [0, 1.94, 0.55], [HP, 0, 0]);
    B.add(box(2.1, 0.12, 0.12), S.dark, [0, 0.8, -2.55]);
    for (const sx of [-1, 1]) { tubeAB(K, B, S.dark, [sx * 0.6, 0.8, -2.55], [sx * 0.5, 1.15, -2.5], 0.03); B.add(box(0.12, 0.08, 0.04), S.rearLamp, [sx * 0.85, 0.92, 2.48]); }
    B.add(box(0.5, 0.2, 0.2), S.dark, [0, 0.75, -2.45]);
    jerrycan(K, B, paint, S, [-0.7, 1.0, 2.62], HP, lod);
    jerrycan(K, B, paint, S, [-0.35, 1.0, 2.62], HP, lod);
    B.add(cyl(0.42, 0.42, 0.25, seg), S.rubber, [0.5, 1.0, 2.62], [HP, 0, 0]);
    antenna(K, B, S, [0.9, 1.2, 2.2], lod === 0 ? 2.2 : 1.4, lod);
    for (const sx of [-1, 1]) {
      LB.add(cyl(0.08, 0.08, 0.04, seg), S.lensOff, [sx * 0.7, 1.08, -2.47], [HP, 0, 0], null, { tag: { lens: true } });
      B.add(cyl(0.1, 0.1, 0.08, seg), S.dark, [sx * 0.7, 1.08, -2.43], [HP, 0, 0]);
    }
    B.add(box(1.2, 0.3, 0.03), S.dark, [0, 0.9, -2.5]);
    if (lod === 0) for (let i = 0; i < 6; i++) B.add(box(0.03, 0.26, 0.02), paint, [-0.5 + i * 0.2, 0.9, -2.52]);
  }
  for (const sx of [-1, 1]) B.add(box(0.02, 0.28, 0.45), mark, [sx * 0.995, 0.95, 1.6]);
  B.build(hull, { shadow: true });
  GB.build(hull, { shadow: false });
  LB.build(hull, { shadow: false });
  const wheels = milWheels(K, S, lod, W.z.map((z) => ({ z, r: W.radius, w: 0.32, x: W.x })), paint);
  // MG auf dem Drehring: Schwenkarm, Wiege, schweres MG mit Munitionskasten, kleiner Schutzschild
  const M = new Bucket();
  M.add(box(0.12, 0.12, 0.58), S.dark, [0, 0.05, 0.25]);
  M.add(cyl(0.024, 0.024, 1.05, 8), S.dark, [0, 0.07, -0.55], [HP, 0, 0]);
  M.add(cyl(0.035, 0.035, 0.22, 8), S.dark, [0, 0.07, -0.18], [HP, 0, 0]);
  M.add(box(0.14, 0.15, 0.25), S.dark, [0.15, 0.02, 0.2]);
  M.add(cyl(0.03, 0.03, 0.3, 6), S.dark, [0, -0.15, 0.3]);
  if (lod < 2) M.add(box(0.55, 0.32, 0.02), paint, [0, 0.12, -0.12]);
  const mg = new THREE.Group();
  M.build(mg, { shadow: lod < 2, off: D.mgPivot });
  const out = { hull, wheels, mg };
  if (lod === 0) {
    out.extra = [steeringWheel(K, S, [-0.46, 1.38, -0.55], -1.1, 0.19)];
    out.extra.push(...figures(K, S, [{ idx: 0, pos: [-0.46, 0.66, -0.2], hands: { c: [-0.46, 0.72, -0.35], r: 0.19, tilt: -1.1 }, hip: 0.48 }, { idx: 2, pos: [0.46, 0.66, -0.2], hip: 0.48 }]));
  }
  return out;
}

/* ===================================================================== ZK-8 Packesel (Halbkette, ungepanzert) */

function buildHKW(lod, S, K, team) {
  K.setLod(lod);
  const D = K.VEHICLES.hkw, W = D.wheels, TR = D.track;
  const { box, cyl, sph, Bucket } = K;
  const seg = [20, 12, 7][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket(), GB = new Bucket();
  // Rahmen, lange Motorhaube mit Lüftungsschlitzen, Kühler, geschwungene Kotflügel vorn, Trittbretter
  B.add(box(0.85, 0.22, 6.4), S.dark, [0, 0.78, 0.2]);
  hullShell(K, B, paint, [[3.45, 0.95], [3.48, 1.48], [3.3, 1.6], [1.05, 1.62], [1.05, 0.95]], 1.15, lod, { r: 0.05, rs: 0.1 });
  B.add(box(1.0, 0.55, 0.06), S.dark, [0, 1.2, -3.48]);
  if (lod === 0) for (let i = 0; i < 9; i++) B.add(box(0.03, 0.5, 0.03), paint, [-0.4 + i * 0.1, 1.2, -3.5]);
  if (lod < 2) for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) B.add(box(0.02, 0.04, 0.32), S.dark, [sx * 0.585, 1.35, -2.9 + i * 0.25], [0, 0, sx * 0.1]);
  for (const sx of [-1, 1]) {
    const fender = [[3.5, 1.1], [3.15, 1.32], [2.0, 1.32], [1.7, 1.08], [1.0, 0.95], [1.0, 0.88], [1.7, 1.0], [2.0, 1.25], [3.1, 1.25], [3.45, 1.03]];
    B.add(K.sideExtrude(fender, 0.48), paint, [sx * 0.88, 0, 0]);
    B.add(box(0.36, 0.04, 1.6), S.dark, [sx * 1.05, 0.95, 0.4]);                                   // Trittbrett
    B.add(cyl(0.11, 0.12, 0.12, seg), S.dark, [sx * 0.55, 1.42, -3.42], [HP, 0, 0]);
    LB_lens(K, B, S, [sx * 0.55, 1.42, -3.49], seg);
  }
  // offener Aufbau: Seitenwände (Holz/Blech), Windschutzscheibe, drei Sitzreihen + Heckbank, Faltverdeck hinten
  for (const sx of [-1, 1]) {
    B.add(K.sideExtrude([[1.05, 1.62], [-3.25, 1.62], [-3.25, 1.05], [1.05, 1.05]], 0.05), paint, [sx * 1.18, 0, 0]);
    if (lod < 2) B.add(box(0.06, 0.06, 4.3), S.wood, [sx * 1.2, 1.64, 1.1]);
  }
  B.add(box(2.36, 0.05, 4.3), S.wood, [0, 1.02, 1.1]);
  B.add(box(2.36, 0.62, 0.05), paint, [0, 1.33, 3.25]);
  for (const sx of [-1, 1]) bar(K, B, S.dark, [sx * 1.1, 1.62, -1.05], [sx * 1.08, 2.18, -0.95], 0.04, 0.04);
  B.add(box(2.2, 0.04, 0.04), S.dark, [0, 2.18, -0.95]);
  GB.add(box(2.1, 0.5, 0.012), S.glass, [0, 1.9, -1.0], [-0.18, 0, 0]);
  B.add(box(2.2, 0.2, 0.35), S.plastic, [0, 1.5, -0.88]);
  for (let i = 0; i < 3; i++) B.add(cyl(0.04, 0.04, 0.012, 14), S.dial, [-0.65 + i * 0.12, 1.57, -0.72], [1.2, 0, 0]);
  for (const z of [-0.62, 0.35, 1.3]) {
    B.add(box(2.1, 0.1, 0.48), S.seat, [0, 1.47, z]);
    B.add(box(2.1, 0.5, 0.1), S.seat, [0, 1.78, z + 0.28], [-0.12, 0, 0]);
    B.add(box(2.0, 0.42, 0.4), S.dark, [0, 1.22, z]);
  }
  B.add(box(1.2, 0.1, 0.42), S.seat, [-0.45, 1.47, 2.6]);
  B.add(box(0.9, 0.5, 0.42), S.dark, [0.6, 1.3, 2.6]);                                                // Munitions-/Gerätekasten
  if (lod < 2) {
    for (let k = 0; k < 4; k++) tubeAB(K, B, S.dark, [-1.15, 1.62, 2.95 + k * 0.05], [1.15, 1.62, 2.95 + k * 0.05], 0.018); // Verdeckbügel zusammengelegt
    B.add(box(2.2, 0.18, 0.3), S.canvas, [0, 1.72, 3.0]);
    jerrycan(K, B, paint, S, [1.0, 1.32, 3.42], HP, lod);
    for (const sx of [-1, 1]) B.add(box(0.1, 0.08, 0.04), S.rearLamp, [sx * 0.9, 1.15, 3.28]);
    B.add(box(0.5, 0.25, 0.2), S.dark, [0, 0.85, 3.3]);                                               // Anhängekupplung
    B.add(box(0.08, 0.08, 1.2), S.wood, [-1.22, 1.3, -1.8]);
  }
  for (const sx of [-1, 1]) B.add(box(0.02, 0.3, 0.45), mark, [sx * 1.21, 1.32, 2.3]);
  const tracks = halfTrack(K, B, S, paint, hull, TR, lod);
  B.build(hull, { shadow: true });
  GB.build(hull, { shadow: false });
  tracks();
  K.addLenses(hull, D, seg, 0.08);
  void sph;
  const wheels = milWheels(K, S, lod, [{ z: W.z[0], r: W.radius, w: 0.26, x: W.x, kind: 'truck' }, { hidden: true }, { hidden: true }, { hidden: true }], paint);
  const out = { hull, wheels };
  if (lod === 0) {
    out.extra = [steeringWheel(K, S, [-0.5, 1.82, -0.95], -0.8, 0.24)];
    out.extra.push(...figures(K, S, [{ idx: 0, pos: [-0.5, 1.02, -0.62], hands: { c: [0, 0.8, -0.33], r: 0.24, tilt: -0.8 } }, { idx: 1, pos: [0.5, 1.02, -0.62] }]));
  }
  return out;
}
/** Scheinwerferglas (Linse, Kennung lens) in den Hauptbucket (eigene Bucket-Gruppe der Linsen über addLenses). */
function LB_lens(K, B, S, p, seg) { B.add(K.cyl(0.09, 0.09, 0.02, seg), S.dark, p, [HP, 0, 0]); }

/* ===================================================================== SPW-41 Hamster (Schützenpanzerwagen) */

function buildSPW(lod, S, K, team) {
  K.setLod(lod);
  const D = K.VEHICLES.spw, W = D.wheels, TR = D.track, DET = K.DET;
  const { box, cyl, Bucket } = K;
  const seg = [20, 12, 7][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  // Wanne aus geknickten Platten: Bug keilförmig (Motor), Unterteil eingezogen, Oberteil nach innen geneigt, offen oben
  hullShell(K, B, paint, [[2.95, 0.72], [3.08, 1.22], [-3.15, 1.25], [-3.18, 0.72]], 1.75, lod, { r: 0.02, rs: 0.02 });
  const upper = (x) => {
    // Seitenplatte oben (geneigt), als dünnes Profil je Seite
    B.add(K.sideExtrude([[1.2, 1.25], [-3.16, 1.25], [-3.16, 1.95], [1.0, 1.95], [1.6, 1.78], [1.6, 1.25]], 0.04), paint, [x + Math.sign(x) * 0.27, 0.03, 0], [0, 0, Math.sign(x) * 0.22]); // nach innen geneigt, Unterkante bei |x| = 1
  };
  for (const sx of [-1, 1]) upper(sx * 1.0);
  // Motorhaube (keilförmig, Lüftungsklappen), Fahrerhaus-Front mit Sehklappen
  hullShell(K, B, paint, [[3.1, 1.2], [2.9, 1.55], [1.5, 1.85], [1.5, 1.2]], 1.6, lod, { r: 0.02, rs: 0.02, tuck: 0.25 });
  B.add(box(1.8, 0.5, 0.04), paint, [0, 2.0, -1.42], [-0.35, 0, 0]);
  for (const sx of [-1, 1]) {
    B.add(box(0.3, 0.06, 0.03), S.dark, [sx * 0.42, 1.98, -1.48], [-0.35, 0, 0]);
    B.add(box(0.22, 0.02, 0.02), S.optic, [sx * 0.42, 1.99, -1.5], [-0.35, 0, 0]);
    if (lod < 2) { B.add(box(0.3, 0.12, 0.03), paint, [sx * 0.95, 1.6, -1.2], [0, 0, -sx * 0.22]); B.add(box(0.32, 0.03, 0.58), S.dark, [sx * 0.42, 1.55 + 0.02, -2.2], [-0.2, 0, 0]); }
  }
  B.add(box(1.9, 0.04, 4.3), S.dark, [0, 1.0, 1.0]);                                                          // Boden Kampfraum
  // Bänke längs, Gewehrhalter, Munitionskästen, Funkgerät
  for (const sx of [-1, 1]) {
    bench(K, B, S, sx * 0.72, 0.98, 0.0, 2.75, lod, false);
    if (lod < 2) for (let i = 0; i < 4; i++) B.add(box(0.04, 0.5, 0.04), S.wood, [sx * 0.88, 1.6, 0.3 + i * 0.65]);
  }
  if (lod < 2) {
    B.add(box(0.5, 0.35, 0.3), S.dark, [0.6, 1.25, -0.75]);
    B.add(box(0.36, 0.3, 0.25), S.dark, [-0.5, 1.6, -0.85]);
    for (let i = 0; i < 4; i++) B.add(box(0.02, 0.015, 0.012), i % 2 ? S.lensOn : S.rubber, [-0.58 + i * 0.05, 1.68, -0.72]);
    antenna(K, B, S, [-0.95, 1.95, -0.6], lod === 0 ? 2.0 : 1.3, lod);
    // Kotflügel vorn, Staukästen auf den Kettenabdeckungen, Werkzeug, Notek-Lampe, Rücklichter
    for (const sx of [-1, 1]) {
      B.add(K.sideExtrude([[3.15, 1.0], [2.9, 1.2], [1.7, 1.2], [1.55, 1.0], [1.55, 0.95], [1.7, 1.13], [2.9, 1.13], [3.12, 0.95]], 0.42), paint, [sx * 0.85, 0, 0]);
      stowBox(K, B, paint, S, [sx * 1.08, 1.35, 1.2], [0.24, 0.3, 1.2], lod);
      B.add(box(0.1, 0.08, 0.04), S.rearLamp, [sx * 0.75, 1.5, 3.18]);
    }
    B.add(box(0.05, 0.06, 1.3), S.wood, [1.18, 1.55, 0.3], [0, 0, -0.22]);
  }
  for (const L of D.lights) guardedLamp(K, B, S, L, 0.08, lod, { guard: false });
  if (lod === 0 && DET === 2) {
    for (const sx of [-1, 1]) for (const y of [1.3, 1.9]) for (let i = 0; i < 8; i++) B.add(cyl(0.013, 0.015, 0.016, 6), paint, [sx * (y > 1.5 ? 0.915 : 1.03), y, -0.6 + i * 0.47], [0, 0, HP]);
  }
  for (const sx of [-1, 1]) B.add(cyl(0.17, 0.17, 0.02, seg), mark, [sx * 0.95, 1.55, 1.6], [0, 0, sx * 1.35]);
  const tracks = halfTrack(K, B, S, paint, hull, TR, lod);
  B.build(hull, { shadow: true });
  tracks();
  K.addLenses(hull, D, seg, 0.07);
  const wheels = milWheels(K, S, lod, [{ z: W.z[0], r: W.radius, w: 0.24, x: W.x, kind: 'truck' }, { hidden: true }, { hidden: true }, { hidden: true }], paint);
  // MG mit Schutzschild (Lafette auf dem Fahrerhaus): Schild, Wiege, MG mit Gurtkasten
  const M = new Bucket();
  M.add(box(0.62, 0.42, 0.02), paint, [0, 0.12, -0.32]);
  M.add(box(0.12, 0.12, 0.02), S.dark, [0.14, 0.18, -0.33]);
  for (const sx of [-1, 1]) M.add(box(0.02, 0.38, 0.18), paint, [sx * 0.31, 0.1, -0.24], [0, sx * 0.35, 0]);
  M.add(box(0.08, 0.1, 0.6), S.dark, [0, 0.04, 0.1]);
  M.add(cyl(0.02, 0.02, 0.6, 8), S.dark, [0, 0.04, -0.55], [HP, 0, 0]);
  M.add(cyl(0.03, 0.03, 0.24, 8), S.dark, [0, 0.04, -0.4], [HP, 0, 0]);
  M.add(box(0.1, 0.1, 0.12), S.dark, [-0.1, 0.0, 0.05]);
  M.add(cyl(0.025, 0.03, 0.3, 6), S.dark, [0, -0.15, 0.05]);
  const mg = new THREE.Group();
  M.build(mg, { shadow: lod < 2, off: D.mgPivot });
  const out = { hull, wheels, mg };
  if (lod === 0) out.ramp = rearDoors(K, S, paint, D);
  return out;
}

/** Zweiflügelige Hecktür (Gruppe 'ramp', Art 'tueren'): Flügel drehen um ihre äußere Kante. */
function rearDoors(K, S, paint, D) {
  const R = D.ramp, g = new THREE.Group();
  g.name = 'ramp'; g.position.set(0, R.y0, R.z);
  g.userData = { kind: 'tueren' };
  const h = R.y1 - R.y0, hw = R.w / 2;
  for (const sx of [-1, 1]) {
    const d = new THREE.Group();
    d.position.set(sx * hw, 0, 0);
    d.userData.door = sx; // +: rechter Flügel dreht nach hinten rechts (rotation.y positiv → −z…), Vorzeichen je Seite
    const B = new K.Bucket();
    B.add(K.box(hw, h, 0.05), paint, [-sx * hw / 2, h / 2, 0], [0, 0, 0]);
    B.add(K.box(0.04, 0.12, 0.05), S.dark, [-sx * (hw - 0.08), h * 0.5, 0.04]);
    B.add(K.box(hw - 0.08, h - 0.08, 0.012), S.cabin, [-sx * hw / 2, h / 2, -0.032]);
    for (const y of [0.15, h - 0.15]) B.add(K.cyl(0.025, 0.025, 0.12, 6), S.dark, [0, y, 0]);
    B.build(d, { shadow: true });
    g.add(d);
  }
  return g;
}

/** Bauer je Modell-Schlüssel (models.js template, Radfahrzeuge). */
export const TROOP_BUILDERS = { rsp: buildRSP, lkw: buildLKW, gmw: buildGMW, gwmg: buildGWMG, hkw: buildHKW, spw: buildSPW };
