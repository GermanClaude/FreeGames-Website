// NULLPUNKT — Leichte und schwere Panzer, Ketten-Mannschaftstransportwagen (Nutzer 20.11., Daten: data-troop.js).
// Alle Fahrzeuge frei erfunden, Bauart je Gattung und Epoche plausibel:
//
//   LP-21 Gämse    (lp21, modern)  flache geschweißte Wanne mit Schürzenmodulen, Triebwerk hinten, niedriger Keilturm mit
//                                  105-mm-Kanone (Wärmeschutzhülle, Rauchabsauger, Mündungsbremse), Waffenstation des
//                                  Kommandanten, sechs Laufrollen, Stützrollen.
//   LP-39 Frettchen (wk2l, 2. WK)  genietete Kastenwanne, vier große Laufrollen in Blattfeder-Schwingen, Triebrad vorn,
//                                  kleiner Achteckturm mit Kuppel, 37-mm-Kanone, Bug-MG im Kugelstand, Nieten (high/ultra).
//   SP-45 Walross  (wk2s, 2. WK)   rundum geneigte Platten, verzahnte Bug-/Seitenplatten (Schweißnähte), Schachtellaufwerk
//                                  mit neun Doppelrollen je Seite, breite Ketten, großer Turm mit Heckwulst und Kuppel,
//                                  lange 88-mm-Kanone mit Doppelkammer-Mündungsbremse, Topfblende, Kettenschürzen.
//   SP-58 Mastodon (kks, K. Krieg) spitzer Gussbug, lange Wanne mit Kotflügel-Staukästen, sieben Laufrollen, großer Gussturm
//                                  mit Heckwulst und Stereo-Entfernungsmesser, 120-mm-Kanone mit Rauchabsauger, MG-Kuppel.
//   MTW-13 Kröte   (mtw, K. Krieg) Aluminium-Kastenwanne, Schwallbrett, Kommandantenkuppel mit .50-MG und Schutzschild,
//                                  Dachluke, Heckrampe mit Tür (Gruppe 'ramp'), Kampfraum innen (buildTroop + Fahrerplatz).
//
// Signatur wie models-tanks.js: (lod, S, team, K) → { hull, tur, gun, cmg, inner?, ramp? }; inner/ramp nur Stufe 0.
// low (K.HQ aus) bleibt bei Extrusionen/Quadern (Handy); Nieten, Schweißnähte, Gitter nur high/ultra (K.DET 2).
import * as THREE from 'three';
import { armorShell, stackRings, insetPoly } from './armorkit.js?v=20261121041936';
import { sprocket, idler, smokeRack, guardedLamp, towCable, spareLinks, jerrycan, antenna, weld, stowBox, hullShell, castTurret, buildTroop } from './models-tanks.js?v=20261121041936';

const PI = Math.PI, HP = PI / 2;

/* ===================================================================== Hilfen */

function roadWheels(K, B, S, paint, x, y, zs, r, lod) {
  const rs = lod === 0 ? (K.DET === 2 ? 18 : 14) : (K.DET === 2 ? 10 : 8);
  for (const z of zs) {
    if (K.HQ) K.addRoadWheelHQ(B, S, paint, x, y, z, r, rs, lod);
    else K.addRoadWheel(B, S, x, y, z, r, 8, lod);
  }
}
function returnRollers(K, B, S, x, y, zs, r, lod, sx) {
  if (lod > 1) return;
  for (const z of zs) {
    B.add(K.cyl(r, r, 0.16, lod === 0 ? 12 : 8), S.rubber, [x, y, z], [0, 0, HP]);
    B.add(K.cyl(0.035, 0.035, 0.3, 6), S.dark, [x - sx * 0.12, y, z], [0, 0, HP]);
  }
}
/** Nieten (nur Nahstufe high/ultra) entlang einer Strecke a→b, n Stück, Achse ax ('x'|'y'|'z' = Normale der Platte). */
function rivetRow(K, B, mat, a, b, n, lod, ax = 'x', r = 0.016) {
  if (lod !== 0 || K.DET !== 2) return;
  const rot = ax === 'x' ? [0, 0, HP] : ax === 'z' ? [HP, 0, 0] : null;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5;
    B.add(K.cyl(r, r * 1.15, 0.018, 6), mat, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], rot);
  }
}
/** Kuppel mit Sichtblöcken (Ring, n Winkelspiegel/Sehschlitze, Deckelring) in Bucket T um c. */
function cupola(K, T, S, paint, c, r, h, n, lod, seg) {
  T.add(K.cyl(r, r * 1.04, h, seg), paint, [c[0], c[1] + h / 2, c[2]]);
  if (lod > 1) return;
  const m = lod === 0 ? n : Math.max(3, n >> 1);
  for (let i = 0; i < m; i++) {
    const a = (i / m) * PI * 2;
    T.add(K.box(0.1, 0.07, 0.05), S.optic, [c[0] + Math.sin(a) * (r + 0.005), c[1] + h * 0.58, c[2] + Math.cos(a) * (r + 0.005)], [0, a, 0]);
  }
  T.add(new THREE.TorusGeometry(r * 0.96, 0.02, 4, Math.max(10, seg)), S.dark, [c[0], c[1] + h + 0.005, c[2]], [HP, 0, 0]);
}
/** Laufwerk-Grundaufbau beider Seiten: Laufrollen, Stützrollen, Trieb-/Leitrad, Kette. */
function runningGear(K, B, S, paint, hull, lod, W, o) {
  const seg = [20, 12, 7][lod];
  for (const sx of [-1, 1]) {
    const x = sx * W.x;
    if (lod < 2) {
      if (o.stagger) o.roadZ.forEach((z, i) => roadWheels(K, B, S, paint, x + sx * (i % 2 ? -o.stagger : o.stagger), o.roadR, [z], o.roadR, lod));
      else roadWheels(K, B, S, paint, x, o.roadR, o.roadZ, o.roadR, lod);
      if (o.ret) returnRollers(K, B, S, x, o.ret.y, o.ret.z, o.ret.r, lod, sx);
    } else for (const z of [o.roadZ[0], 0, o.roadZ[o.roadZ.length - 1]]) B.add(K.cyl(o.roadR, o.roadR, 0.42, seg), S.rubber, [x, o.roadR, z], [0, 0, HP]);
    const F = o.front, R = o.back;
    (F.sprocket ? sprocket : idler)(K, B, S, paint, x, F.y, F.z, F.r, F.w || 0.46, ...(F.sprocket ? [F.teeth || 11, lod] : [lod]));
    (R.sprocket ? sprocket : idler)(K, B, S, paint, x, R.y, R.z, R.r, R.w || 0.46, ...(R.sprocket ? [R.teeth || 11, lod] : [lod]));
  }
  B.build(hull, { shadow: true });
  const sup = o.ret ? o.ret.z.map((z) => [z, o.ret.y + o.ret.r]) : o.roadZ.slice().reverse().map((z) => [z, o.roadR * 2 + 0.02]);
  K.addTracks(hull, K.trackPathFor(lod, o.roadZ[0], o.roadZ[o.roadZ.length - 1], [o.front.z, o.front.y, o.front.r], [o.back.z, o.back.y, o.back.r], sup.slice().sort((a, b) => b[0] - a[0]), o.sag ?? 0.014), W.x, o.trackW);
}
const gunOff = (D) => [D.turretPivot[0] + D.gunPivot[0], D.turretPivot[1] + D.gunPivot[1], D.turretPivot[2] + D.gunPivot[2]];
const cmgOff = (D) => (D.cmgHull ? D.cmgPivot : [D.turretPivot[0] + D.cmgPivot[0], D.turretPivot[1] + D.cmgPivot[1], D.turretPivot[2] + D.cmgPivot[2]]);
function pack(K, D, parts) {
  const out = {};
  for (const [k, B, off, sh] of parts) { const g = new THREE.Group(), L = new THREE.Group(); B.build(L, { off, shadow: sh !== false }); g.add(L); out[k] = g; }
  return out;
}

/* ===================================================================== LP-21 Gämse */

export function buildLP21(lod, S, team, K) {
  K.setLod(lod);
  const D = K.VEHICLES.lp21, W = D.wheels, DET = K.DET, HQ = K.HQ;
  const { box, cyl, Bucket } = K;
  const seg = [20, 12, 7][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  hullShell(K, B, paint, [[3.0, 0.45], [3.2, 0.9], [-3.15, 0.9], [-3.02, 0.45]], 1.92, lod, { r: 0.05, rs: 0.05 });
  hullShell(K, B, paint, [[3.22, 0.88], [3.05, 1.02], [2.15, 1.45], [-3.0, 1.47], [-3.18, 1.3], [-3.2, 0.88]], 2.98, lod, { r: 0.04, rs: 0.05, tuck: 0.05 });
  // Schürzen mit Zusatzmodulen (geschraubt), Gummiunterkante
  for (const sx of [-1, 1]) {
    if (lod < 2) for (let i = 0; i < 5; i++) {
      const z = -2.55 + i * 1.27;
      B.add(box(0.06, 0.4, 1.2), paint, [sx * 1.52, 0.72, z], [0, 0, sx * 0.025]);
      if (lod === 0) { B.add(box(0.025, 0.1, 1.18), S.rubber, [sx * 1.51, 0.47, z]); if (DET === 2) for (let j = 0; j < 4; j++) for (const dy of [-0.13, 0.13]) B.add(cyl(0.015, 0.015, 0.02, 6), S.dark, [sx * 1.56, 0.74 + dy, z - 0.45 + j * 0.3], [0, 0, HP]); }
    } else B.add(box(0.05, 0.4, 6.3), paint, [sx * 1.52, 0.72, 0]);
  }
  if (lod < 2) {
    // Bug: Fahrer-Winkelspiegel, Abschleppösen, Spritzblech; Heck: Lüftergitter, Auspuffgitter, Staukästen, Rücklichter
    for (let i = -1; i <= 1; i++) B.add(box(0.13, 0.08, 0.1), S.optic, [i * 0.2, 1.5, -2.5 + Math.abs(i) * 0.05], [0, -i * 0.35, 0]);
    B.add(box(0.7, 0.05, 0.05), paint, [0, 1.49, -2.58]);
    for (const sx of [-1, 1]) B.add(new THREE.TorusGeometry(0.07, 0.022, 4, 8), S.dark, [sx * 0.8, 0.72, -3.2], [0, HP, 0]);
    B.add(box(2.1, 0.05, 1.5), S.dark, [0, 1.48, 2.15]);
    if (lod === 0) for (let i = 0; i < 9; i++) B.add(box(2.0, 0.035, 0.05), paint, [0, 1.505, 1.5 + i * 0.165], [0.4, 0, 0]);
    B.add(box(1.5, 0.3, 0.05), S.dark, [0, 1.12, 3.2]);
    if (lod === 0) for (let i = 0; i < 5; i++) B.add(box(1.45, 0.025, 0.05), paint, [0, 1.0 + i * 0.06, 3.22]);
    for (const sx of [-1, 1]) { B.add(box(0.12, 0.08, 0.04), S.rearLamp, [sx * 1.2, 1.32, 3.21]); stowBox(K, B, paint, S, [sx * 1.15, 1.62, 2.75], [0.5, 0.3, 0.45], lod); }
    B.add(box(0.2, 0.2, 0.18), S.dark, [0, 0.78, 3.15]);
    jerrycan(K, B, paint, S, [1.25, 1.7, -1.6], 0, lod);
  }
  for (const L of D.lights) guardedLamp(K, B, S, L, 0.08, lod);
  if (HQ && lod < 2) {
    for (const sx of [-1, 1]) towCable(K, B, S, [[sx * 1.38, 1.4, -1.9], [sx * 1.4, 1.36, -0.5], [sx * 1.39, 1.4, 0.9]], lod);
    weld(K, B, paint, [[-1.4, 1.45, -2.15], [1.4, 1.45, -2.15]], lod);
    weld(K, B, paint, [[-1.4, 1.02, -3.05], [1.4, 1.02, -3.05]], lod);
    for (const sx of [-1, 1]) weld(K, B, paint, [[sx * 1.46, 1.46, -2.1], [sx * 1.46, 1.47, 2.95]], lod);
  }
  if (lod === 0) { B.add(box(0.05, 0.08, 1.2), S.wood, [-1.05, 1.5, -0.6]); B.add(box(0.22, 0.02, 0.28), S.dark, [-1.05, 1.5, 0.05]); }
  runningGear(K, B, S, paint, hull, lod, W, {
    roadZ: D.roadZ, roadR: W.radius, ret: { y: 0.8, r: 0.075, z: [-1.4, 0, 1.4] }, trackW: 0.46,
    front: { z: -2.9, y: 0.52, r: 0.26 }, back: { z: 2.92, y: 0.58, r: 0.28, sprocket: true, teeth: 11 },
  });
  K.addLenses(hull, D, seg, 0.07);

  // Keilturm (geschweißt) mit Zusatzpanzer-Wangen, Heckkorb, Nebelwurfbecher, Optiken
  const T = new Bucket();
  const foot = [[-0.55, 1.3], [0.55, 1.3], [1.05, 0.55], [1.08, -0.9], [0.9, -1.45], [-0.9, -1.45], [-1.08, -0.9], [-1.05, 0.55]];
  if (HQ && lod < 2) T.add(armorShell(stackRings([[0, foot], [0.6, insetPoly(foot, 0.1)]], { r: 0.035, rTop: 0.04, rBot: 0.035 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0 }), paint);
  else T.add(K.topExtrude(foot, 0.6), paint);
  T.add(cyl(0.86, 0.88, 0.1, seg + 4), S.dark, [0, -0.03, 0]);
  if (lod < 2) {
    for (const sx of [-1, 1]) {
      T.add(box(0.1, 0.4, 0.8), paint, [sx * 1.08, 0.3, -0.25], [0, sx * 0.1, 0]);
      if (lod === 0 && DET === 2) for (let j = 0; j < 3; j++) T.add(cyl(0.016, 0.016, 0.02, 6), S.dark, [sx * 1.14, 0.44, -0.55 + j * 0.3], [0, 0, HP]);
      smokeRack(K, T, S, paint, sx * 0.88, 0.66, -0.7, 4, sx, lod);
    }
    T.add(box(0.34, 0.26, 0.38), paint, [0.55, 0.72, -0.62]);                       // Richtschützen-Optik (Wärmebild)
    T.add(box(0.28, 0.15, 0.02), S.optic, [0.55, 0.74, -0.82]);
    T.add(box(1.7, 0.04, 0.4), S.dark, [0, 0.14, 1.65]);                            // Heckkorb
    for (const sx of [-1, 0, 1]) T.add(box(0.035, 0.32, 0.035), S.dark, [sx * 0.84, 0.3, 1.85]);
    T.add(box(1.7, 0.035, 0.035), S.dark, [0, 0.46, 1.85]);
    if (lod === 0) { T.add(box(0.7, 0.26, 0.32), S.canvas, [-0.35, 0.29, 1.65]); T.add(cyl(0.1, 0.1, 0.7, 10), S.canvas, [0.45, 0.26, 1.65], [0, 0, HP]); }
    antenna(K, T, S, [0.7, 0.6, 1.1], lod === 0 ? 1.9 : 1.2, lod);
    antenna(K, T, S, [-0.75, 0.6, 1.15], lod === 0 ? 1.5 : 1.0, lod);
    if (lod === 0) for (const [x, z] of [[-0.85, -0.75], [0.85, -0.75], [-0.75, 1.0], [0.75, 1.0]]) T.add(new THREE.TorusGeometry(0.045, 0.013, 4, 8), S.dark, [x, 0.61, z], [0, HP, 0]);
    if (HQ) weld(K, T, paint, [[-0.5, 0.59, -1.33], [0.5, 0.59, -1.33], [0.98, 0.59, -0.6], [1.0, 0.59, 0.85]], lod);
  }
  for (const sx of [-1, 1]) T.add(cyl(0.13, 0.13, 0.02, seg), mark, [sx * 1.08, 0.3, 0.45], [0, 0, HP]);

  // 105-mm-Kanone: Blende, Wärmeschutzhülle in Abschnitten, Rauchabsauger, Mündungsbremse, Koax
  const G = new Bucket();
  G.add(box(0.62, 0.46, 0.42), paint, [0, 0, 0.02]);
  G.add(cyl(0.13, 0.16, 0.3, seg), paint, [0, 0, -0.32], [HP, 0, 0]);
  G.add(cyl(0.075, 0.075, 3.75, seg), paint, [0, 0, -2.3], [HP, 0, 0]);
  G.add(cyl(0.105, 0.105, 0.5, seg), paint, [0, 0, -1.7], [HP, 0, 0]);
  for (const z of lod < 2 ? [-0.8, -1.25, -2.6, -3.3] : []) G.add(cyl(0.085, 0.085, 0.04, 12), S.dark, [0, 0, z], [HP, 0, 0]);
  G.add(box(0.26, 0.18, 0.36), S.dark, [0, 0, -4.27]);
  if (lod === 0) for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) G.add(box(0.012, 0.13, 0.05), S.rubber, [sx * 0.131, 0, -4.15 - i * 0.11]);
  G.add(box(0.09, 0.08, 0.2), S.dark, [D.coax[0], D.coax[1], -0.34]);
  G.add(cyl(0.012, 0.012, 0.25, 6), S.dark, [D.coax[0], D.coax[1], -0.55], [HP, 0, 0]);

  // Waffenstation des Kommandanten (dreht mit seinem Blick): Wiege, MG, Sensorkopf
  const C = new Bucket();
  C.add(cyl(0.16, 0.18, 0.12, seg), S.dark, [0, -0.04, 0]);
  C.add(box(0.26, 0.2, 0.5), paint, [0, 0.08, -0.05]);
  C.add(box(0.16, 0.14, 0.18), paint, [-0.2, 0.12, -0.05]);
  C.add(box(0.12, 0.09, 0.02), S.optic, [-0.2, 0.12, -0.15]);
  C.add(cyl(0.02, 0.02, 0.75, 8), S.dark, [0.04, 0.08, -0.62], [HP, 0, 0]);
  if (lod === 0) C.add(box(0.14, 0.12, 0.2), S.dark, [0.17, 0.06, 0.05]);
  return { hull, ...pack(K, D, [['tur', T, D.turretPivot], ['gun', G, gunOff(D)], ['cmg', C, cmgOff(D), lod < 2]]) };
}

/* ===================================================================== LP-39 Frettchen */

export function buildWK2L(lod, S, team, K) {
  K.setLod(lod);
  const D = K.VEHICLES.wk2l, W = D.wheels, DET = K.DET;
  const { box, cyl, sph, Bucket } = K;
  const seg = [18, 10, 6][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  // genietete Kastenwanne: Unterwanne, Aufbau mit senkrechten Seiten, schräge Bugplatte, Kettenabdeckungen
  hullShell(K, B, paint, [[2.18, 0.48], [2.35, 0.82], [-2.3, 0.85], [-2.25, 0.48]], 1.5, lod, { r: 0.025, rs: 0.025 });
  hullShell(K, B, paint, [[2.37, 0.8], [2.0, 1.1], [1.55, 1.48], [-1.9, 1.5], [-2.32, 1.22], [-2.34, 0.8]], 2.0, lod, { r: 0.02, rs: 0.02 });
  for (const sx of [-1, 1]) {
    B.add(box(0.42, 0.03, 4.6), paint, [sx * 1.0, 1.0, 0.0]);                          // Kettenabdeckung
    if (lod < 2) {
      B.add(box(0.03, 0.18, 4.6), paint, [sx * 1.2, 0.92, 0]);
      for (const z of [-1.6, 0.4]) stowBox(K, B, paint, S, [sx * 1.0, 1.15, z], [0.36, 0.26, 0.8], lod);
    }
  }
  if (lod < 2) {
    // Fahrersehklappe, Kugelblende (Bug-MG) mit Rahmen, Funkantenne, Werkzeug, Auspufftopf am Heck, Nieten
    B.add(box(0.36, 0.14, 0.06), paint, [-0.42, 1.34, -1.86], [-0.85, 0, 0]);
    B.add(box(0.2, 0.03, 0.03), S.optic, [-0.42, 1.36, -1.9], [-0.85, 0, 0]);
    B.add(sph(0.15, seg), paint, [D.cmgPivot[0], D.cmgPivot[1], D.cmgPivot[2] + 0.06]);
    B.add(cyl(0.2, 0.2, 0.04, seg), paint, [D.cmgPivot[0], D.cmgPivot[1], D.cmgPivot[2] + 0.13], [-0.85, 0, 0]);
    B.add(cyl(0.11, 0.11, 0.5, 10), S.dark, [0, 0.98, 2.3], [0, 0, HP]);
    B.add(cyl(0.035, 0.035, 0.3, 6), S.dark, [0.35, 0.98, 2.38], [HP, 0, 0]);
    antenna(K, B, S, [0.85, 1.5, 0.9], lod === 0 ? 1.8 : 1.1, lod);
    for (const sx of [-1, 1]) B.add(new THREE.TorusGeometry(0.06, 0.02, 4, 8), S.dark, [sx * 0.6, 0.66, -2.34], [0, HP, 0]);
    B.add(box(0.06, 0.06, 1.1), S.wood, [0.6, 1.53, 0.4]);
    B.add(cyl(0.02, 0.02, 1.2, 6), S.dark, [-0.6, 1.53, 0.4], [HP, 0, 0]);
    // Lüftergitter auf dem Motordeck
    B.add(box(1.2, 0.03, 0.8), S.dark, [0, 1.505, 1.35]);
    if (lod === 0) for (let i = 0; i < 6; i++) B.add(box(1.15, 0.03, 0.04), paint, [0, 1.52, 1.02 + i * 0.13]);
    // Nieten: Bugplatte, Seiten, Aufbaukanten
    for (const y of [1.47, 1.08]) rivetRow(K, B, paint, [-0.85, y, y > 1.3 ? -1.56 : -2.0], [0.85, y, y > 1.3 ? -1.56 : -2.0], 9, lod, 'z');
    for (const sx of [-1, 1]) { rivetRow(K, B, paint, [sx * 1.005, 0.88, -1.85], [sx * 1.005, 0.88, 1.85], 14, lod, 'x'); rivetRow(K, B, paint, [sx * 1.005, 1.42, -1.3], [sx * 1.005, 1.42, 1.75], 11, lod, 'x'); }
  }
  for (const L of D.lights) guardedLamp(K, B, S, L, 0.08, lod, { guard: false });
  for (const sx of [-1, 1]) B.add(cyl(0.15, 0.15, 0.02, seg), mark, [sx * 1.005, 1.22, 0.6], [0, 0, HP]);
  // Laufwerk: vier große Laufrollen in zwei Blattfeder-Schwingen, Triebrad vorn, Leitrad hinten, zwei Stützrollen
  if (lod < 2) for (const sx of [-1, 1]) for (const zc of [-1.0, 1.0]) {
    B.add(box(0.1, 0.12, 1.15), S.dark, [sx * (W.x - 0.25), 0.38, zc]);
    B.add(box(0.08, 0.05, 0.95), S.steel, [sx * (W.x - 0.25), 0.52, zc]);
    if (lod === 0) for (let k = 1; k < 4; k++) B.add(box(0.075, 0.018, 0.95 - k * 0.18), S.steel, [sx * (W.x - 0.25), 0.52 - k * 0.022, zc]);
  }
  runningGear(K, B, S, paint, hull, lod, W, {
    roadZ: D.roadZ, roadR: W.radius, ret: { y: 0.78, r: 0.07, z: [-0.8, 0.8] }, trackW: 0.36, sag: 0.02,
    front: { z: -2.12, y: 0.62, r: 0.25, sprocket: true, teeth: 9, w: 0.38 }, back: { z: 2.15, y: 0.5, r: 0.24, w: 0.38 },
  });
  K.addLenses(hull, D, seg, 0.07);

  // Achteckturm (genietet), Kommandantenkuppel, Sehklappen, Signalklappe
  const T = new Bucket();
  const foot = [[-0.42, 0.72], [0.42, 0.72], [0.72, 0.42], [0.72, -0.48], [0.45, -0.8], [-0.45, -0.8], [-0.72, -0.48], [-0.72, 0.42]];
  if (K.HQ && lod < 2) T.add(armorShell(stackRings([[0, foot], [0.56, insetPoly(foot, 0.06)]], { r: 0.02, rTop: 0.025, rBot: 0.02 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0 }), paint);
  else T.add(K.topExtrude(foot, 0.56), paint);
  T.add(cyl(0.6, 0.62, 0.08, seg + 4), S.dark, [0, -0.03, 0]);
  cupola(K, T, S, paint, [-0.25, 0.56, 0.22], 0.27, 0.2, 6, lod, seg);
  if (lod < 2) {
    for (const sx of [-1, 1]) { T.add(box(0.04, 0.14, 0.24), paint, [sx * 0.73, 0.32, 0.0]); T.add(box(0.02, 0.025, 0.14), S.optic, [sx * 0.75, 0.34, 0.0]); }
    T.add(box(0.2, 0.04, 0.2), paint, [0.3, 0.58, -0.25]);                          // Signalklappe
    rivetRow(K, T, paint, [-0.4, 0.52, -0.735], [0.4, 0.52, -0.735], 6, lod, 'z');
    for (const sx of [-1, 1]) rivetRow(K, T, paint, [sx * 0.725, 0.5, -0.4], [sx * 0.725, 0.5, 0.35], 5, lod, 'x');
  }
  for (const sx of [-1, 1]) T.add(cyl(0.1, 0.1, 0.02, seg), mark, [sx * 0.725, 0.28, 0.32], [0, 0, HP]);

  // 37-mm-Kanone: Innenblende, schlankes Rohr, Koax-MG daneben
  const G = new Bucket();
  G.add(box(0.5, 0.32, 0.16), paint, [0, 0, 0.05]);
  G.add(cyl(0.07, 0.08, 0.3, seg), paint, [0, 0, -0.2], [HP, 0, 0]);
  G.add(cyl(0.032, 0.03, 1.75, seg), paint, [0, 0, -1.4], [HP, 0, 0]);
  G.add(cyl(0.038, 0.038, 0.06, seg), S.dark, [0, 0, -2.26], [HP, 0, 0]);
  G.add(cyl(0.035, 0.035, 0.18, 8), S.dark, [D.coax[0], D.coax[1], -0.18], [HP, 0, 0]);
  G.add(cyl(0.012, 0.012, 0.22, 6), S.dark, [D.coax[0], D.coax[1], -0.36], [HP, 0, 0]);

  // Bug-MG in der Kugelblende
  const C = new Bucket();
  C.add(sph(0.11, seg), paint, [0, 0, -0.04]);
  C.add(cyl(0.028, 0.028, 0.28, 8), S.dark, [0, 0, -0.25], [HP, 0, 0]);
  if (lod < 2) C.add(cyl(0.012, 0.012, 0.42, 6), S.dark, [0, 0, -0.38], [HP, 0, 0]);
  return { hull, ...pack(K, D, [['tur', T, D.turretPivot], ['gun', G, gunOff(D)], ['cmg', C, cmgOff(D), lod < 2]]) };
}

/* ===================================================================== SP-45 Walross */

export function buildWK2S(lod, S, team, K) {
  K.setLod(lod);
  const D = K.VEHICLES.wk2s, W = D.wheels, DET = K.DET, HQ = K.HQ;
  const { box, cyl, sph, Bucket } = K;
  const seg = [20, 12, 7][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  // Unterwanne (schmal zwischen den Ketten), Oberwanne mit langem 50°-Bug, geneigten Seiten (eingezogen) und Heck
  hullShell(K, B, paint, [[3.35, 0.5], [3.62, 0.98], [-3.5, 0.98], [-3.35, 0.5]], 2.05, lod, { r: 0.05, rs: 0.05 });
  hullShell(K, B, paint, [[3.65, 0.95], [2.05, 1.9], [-3.05, 1.93], [-3.55, 1.25], [-3.58, 0.95]], 3.7, lod, { r: 0.04, rs: 0.05, tuck: 0.42 });
  if (lod < 2) {
    // Fahrersehklappe + Kugelblende im Bug, verzahnte Plattenstöße (Schweißnähte), Abschleppklauen
    B.add(box(0.42, 0.16, 0.08), paint, [-0.62, 1.62, -2.6], [-0.88, 0, 0]);
    B.add(box(0.26, 0.03, 0.03), S.optic, [-0.62, 1.64, -2.64], [-0.88, 0, 0]);
    B.add(sph(0.2, seg), paint, [D.cmgPivot[0], D.cmgPivot[1], D.cmgPivot[2] + 0.08]);
    B.add(cyl(0.26, 0.28, 0.05, seg), paint, [D.cmgPivot[0], D.cmgPivot[1], D.cmgPivot[2] + 0.16], [-0.88, 0, 0]);
    for (const sx of [-1, 1]) {
      B.add(box(0.14, 0.42, 0.42), paint, [sx * 0.95, 0.9, -3.55]);
      B.add(cyl(0.06, 0.06, 0.34, 10), S.dark, [sx * 0.95, 0.84, -3.58], [0, 0, HP]);
    }
    // Motordeck: Lüftergitter, Lufteinlässe, Auspuffrohre mit Schutzblech am Heck, Kettenwerkzeug, Ersatzglieder
    B.add(box(1.6, 0.05, 1.4), S.dark, [0, 1.94, 2.2]);
    if (lod === 0) for (let i = 0; i < 8; i++) B.add(box(1.5, 0.035, 0.05), paint, [0, 1.965, 1.6 + i * 0.17]);
    for (const sx of [-1, 1]) {
      B.add(box(0.55, 0.06, 0.55), S.dark, [sx * 1.15, 1.95, 2.3]);
      B.add(cyl(0.09, 0.1, 0.62, 10), S.dark, [sx * 0.5, 1.6, 3.55]);
      B.add(box(0.26, 0.5, 0.03), paint, [sx * 0.5, 1.6, 3.66]);
    }
    spareLinks(K, B, S, [-0.95, 1.18, -3.18], 5, 0.66, 0.16, [-0.94, 0, 0], lod, [0.47, 0, 0]);
    for (const sx of [-1, 1]) B.add(box(0.06, 0.06, 1.6), S.wood, [sx * 1.4, 1.7, -0.5], [0, 0, -sx * 0.43]);
    jerrycan(K, B, paint, S, [1.35, 1.65, 1.3], 0, lod);
  }
  // Kettenschürzen (dünne Bleche, eine fehlt bei Team B – Gefechtsspuren)
  if (lod < 2) for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
    if (team === 'B' && sx > 0 && i === 3) continue;
    B.add(box(0.025, 0.55, 1.3), paint, [sx * 1.9, 1.15, -2.6 + i * 1.32], [0, 0, sx * 0.06]);
  }
  for (const L of D.lights) guardedLamp(K, B, S, L, 0.09, lod, { guard: false });
  if (HQ && lod < 2) {
    for (const sx of [-1, 1]) towCable(K, B, S, [[sx * 1.55, 1.55, -1.6], [sx * 1.6, 1.42, 0.0], [sx * 1.55, 1.55, 1.4]], lod, 0.028);
    weld(K, B, paint, [[-1.5, 1.88, -2.05], [1.5, 1.88, -2.05]], lod, 0.016);
    weld(K, B, paint, [[-1.6, 0.98, -3.62], [1.6, 0.98, -3.62]], lod, 0.016);
    for (const sx of [-1, 1]) { weld(K, B, paint, [[sx * 1.45, 1.92, -2.0], [sx * 1.45, 1.93, 2.95]], lod, 0.016); weld(K, B, paint, [[sx * 1.83, 0.98, -3.5], [sx * 1.45, 1.9, -2.05]], lod, 0.016); }
  }
  for (const sx of [-1, 1]) B.add(cyl(0.22, 0.22, 0.02, seg), mark, [sx * 1.68, 1.45, 1.0], [0, 0, -sx * 1.15]);
  // Schachtellaufwerk: neun Doppelrollen je Seite, abwechselnd innen/außen, Triebrad vorn, Leitrad hinten
  runningGear(K, B, S, paint, hull, lod, W, {
    roadZ: D.roadZ, roadR: W.radius, stagger: 0.12, trackW: 0.72, sag: 0.018,
    // ges2 (21.11.): Triebrad tiefer/kleiner (vorher y 0,72, r 0,38) – die Kette stieg vorn über die Rollenlinie und ragte
    // als Buckel durch den flachen Bug vor die Wanne
    front: { z: -3.25, y: 0.62, r: 0.34, sprocket: true, teeth: 17, w: 0.72 }, back: { z: 3.25, y: 0.62, r: 0.35, w: 0.7 },
  });
  K.addLenses(hull, D, seg, 0.075);

  // Turm: geschweißt, Seiten geneigt, Front schmal mit Topfblende, langer Heckwulst, Kuppel links hinten, Ladeschützenluke
  const T = new Bucket();
  const foot = [[-0.85, 1.48], [0.85, 1.48], [1.25, 0.9], [1.3, -1.6], [1.0, -2.25], [-1.0, -2.25], [-1.3, -1.6], [-1.25, 0.9]];
  if (HQ && lod < 2) T.add(armorShell(stackRings([[0, foot], [0.55, insetPoly(foot, 0.12)], [0.86, insetPoly(foot, 0.26)]], { r: 0.035, rTop: 0.05, rBot: 0.035 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0 }), paint);
  else T.add(K.topExtrude(foot, 0.86), paint);
  T.add(cyl(1.0, 1.02, 0.1, seg + 4), S.dark, [0, -0.03, 0]);
  cupola(K, T, S, paint, [-0.58, 0.82, 0.95], 0.34, 0.26, 7, lod, seg);
  if (lod < 2) {
    T.add(cyl(0.29, 0.29, 0.04, seg), S.dark, [0.55, 0.88, 0.62]);                // Ladeschützenluke (Ring)
    T.add(box(0.14, 0.12, 0.14), S.dark, [-0.35, 0.86, -0.85]);                    // Winkelspiegel des Richtschützen
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) T.add(box(0.04, 0.05, 0.05), S.dark, [sx * 1.19, 0.6, 0.4 + k * 0.55]); // Haltebügel
    T.add(box(0.5, 0.1, 0.3), paint, [0, 0.9, 1.7]);                              // Lüfter
    antenna(K, T, S, [0.9, 0.82, 1.6], lod === 0 ? 2.0 : 1.3, lod);
    if (HQ) { weld(K, T, paint, [[-0.82, 0.85, -1.36], [0.82, 0.85, -1.36]], lod, 0.014); for (const sx of [-1, 1]) weld(K, T, paint, [[sx * 1.1, 0.84, -0.8], [sx * 1.12, 0.84, 1.6]], lod, 0.014); }
    if (lod === 0) for (const [x, z] of [[-1.0, -0.5], [1.0, -0.5], [-0.9, 1.9], [0.9, 1.9]]) T.add(new THREE.TorusGeometry(0.055, 0.016, 4, 8), S.dark, [x, 0.87, z], [0, HP, 0]);
  }
  for (const sx of [-1, 1]) T.add(cyl(0.2, 0.2, 0.02, seg), mark, [sx * 1.2, 0.42, 0.8], [0, 0, -sx * 1.36]);

  // Topfblende (gegossen), lange 88-mm-Kanone mit Doppelkammer-Mündungsbremse, Koax-MG
  const G = new Bucket();
  if (HQ && lod < 2) G.add(armorShell(stackRings([[-0.3, castRound(0.36, 0.34, 10)], [0.12, castRound(0.32, 0.3, 10)], [0.3, castRound(0.22, 0.2, 10)]], { cast: true, rTop: 0.06, rBot: 0.05 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0, cast: true, castAmp: 0.012 }), paint, [0, 0, -0.2], [-HP, 0, 0]);
  else G.add(cyl(0.34, 0.34, 0.6, seg), paint, [0, 0, -0.2], [HP, 0, 0]);
  G.add(box(1.0, 0.62, 0.12), paint, [0, 0, 0.18]);
  G.add(cyl(0.1, 0.082, 5.3, seg), paint, [0, 0, -3.2], [HP, 0, 0]);
  if (lod < 2) G.add(cyl(0.11, 0.11, 0.08, seg), S.dark, [0, 0, -2.2], [HP, 0, 0]);
  G.add(cyl(0.12, 0.12, 0.2, seg), S.dark, [0, 0, -5.95], [HP, 0, 0]);
  G.add(cyl(0.12, 0.12, 0.16, seg), S.dark, [0, 0, -6.25], [HP, 0, 0]);
  G.add(cyl(0.09, 0.09, 0.14, seg), S.dark, [0, 0, -6.1], [HP, 0, 0]);
  G.add(cyl(0.022, 0.022, 0.2, 6), S.dark, [D.coax[0], D.coax[1], -0.2], [HP, 0, 0]);

  const C = new Bucket();
  C.add(sph(0.13, seg), paint, [0, 0, -0.05]);
  C.add(cyl(0.03, 0.03, 0.3, 8), S.dark, [0, 0, -0.26], [HP, 0, 0]);
  if (lod < 2) C.add(cyl(0.014, 0.014, 0.46, 6), S.dark, [0, 0, -0.4], [HP, 0, 0]);
  return { hull, ...pack(K, D, [['tur', T, D.turretPivot], ['gun', G, gunOff(D)], ['cmg', C, cmgOff(D), lod < 2]]) };
}
/** gerundetes Vieleck (Gussblende): Halbachsen a × b, n Punkte. */
function castRound(a, b, n) { const out = []; for (let i = 0; i < n; i++) { const t = (i / n) * PI * 2; out.push([Math.sin(t) * a, Math.cos(t) * b]); } return out; }

/* ===================================================================== SP-58 Mastodon */

export function buildKKS(lod, S, team, K) {
  K.setLod(lod);
  const D = K.VEHICLES.kks, W = D.wheels, DET = K.DET, HQ = K.HQ;
  const { box, cyl, sph, Bucket } = K;
  const seg = [20, 12, 7][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  // Gussbug (spitz zulaufend: zwei geneigte Flächen), lange geschweißte Wanne
  hullShell(K, B, paint, [[3.5, 0.5], [3.82, 0.95], [-3.72, 0.98], [-3.55, 0.5]], 2.3, lod, { r: 0.06, rs: 0.06 });
  hullShell(K, B, paint, [[3.84, 0.93], [3.2, 1.25], [2.3, 1.55], [-3.2, 1.6], [-3.72, 1.38], [-3.75, 0.93]], 2.55, lod, { r: 0.06, rs: 0.06, tuck: 0.08 });
  if (HQ && lod < 2) B.add(armorShell(stackRings([[0, [[-1.2, 0.0], [1.2, 0.0], [1.0, -0.6], [-1.0, -0.6]]], [0.45, [[-1.05, -0.12], [1.05, -0.12], [0.7, -0.75], [-0.7, -0.75]]]], { cast: true, rTop: 0.08, rBot: 0.04 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0, cast: true, castAmp: 0.01 }), paint, [0, 0.95, -3.05]);
  for (const sx of [-1, 1]) {
    B.add(box(0.55, 0.035, 7.2), paint, [sx * 1.55, 1.2, 0.05]);                    // Kotflügel
    if (lod < 2) {
      for (const z of [-1.9, -0.6, 0.8, 2.1]) stowBox(K, B, paint, S, [sx * 1.55, 1.42, z], [0.5, 0.38, 1.05], lod);
      B.add(box(0.55, 0.32, 0.03), S.rubber, [sx * 1.55, 1.05, -3.6]);
      if (lod === 0) for (const z of [-3.2, 3.2]) B.add(box(0.04, 0.2, 0.04), S.dark, [sx * 1.81, 1.12, z]);
    }
  }
  if (lod < 2) {
    for (let i = -1; i <= 1; i++) B.add(box(0.13, 0.08, 0.1), S.optic, [i * 0.19, 1.6, -3.08], [0, -i * 0.3, 0]);
    for (const sx of [-1, 1]) B.add(new THREE.TorusGeometry(0.08, 0.026, 4, 8), S.dark, [sx * 0.9, 0.82, -3.78], [0, HP, 0]);
    B.add(box(2.2, 0.05, 1.7), S.dark, [0, 1.6, 2.4]);
    if (lod === 0) for (let i = 0; i < 9; i++) B.add(box(2.1, 0.04, 0.05), paint, [0, 1.625, 1.7 + i * 0.18]);
    B.add(box(1.8, 0.4, 0.04), S.dark, [0, 1.15, 3.74]);
    for (const sx of [-1, 1]) { B.add(box(0.12, 0.08, 0.04), S.rearLamp, [sx * 1.3, 1.3, 3.74]); B.add(cyl(0.1, 0.1, 0.25, 10), S.dark, [sx * 0.7, 1.05, 3.78], [HP, 0, 0]); }
    B.add(box(0.06, 0.08, 1.4), S.wood, [0.7, 1.62, -1.8]);
    spareLinks(K, B, S, [-0.55, 1.33, -3.45], 6, 0.52, 0.18, [-0.5, 0, 0], lod, [0.2, 0, 0]);
  }
  for (const L of D.lights) guardedLamp(K, B, S, L, 0.1, lod);
  if (HQ && lod < 2) {
    for (const sx of [-1, 1]) towCable(K, B, S, [[sx * 1.3, 1.62, -2.2], [sx * 1.32, 1.6, -0.6], [sx * 1.31, 1.62, 1.0]], lod);
    for (const sx of [-1, 1]) weld(K, B, paint, [[sx * 1.24, 1.57, -2.3], [sx * 1.24, 1.6, 3.1]], lod);
    weld(K, B, paint, [[-1.2, 0.97, -3.7], [1.2, 0.97, -3.7]], lod);
  }
  for (const sx of [-1, 1]) B.add(cyl(0.21, 0.21, 0.02, seg), mark, [sx * 1.81, 1.42, 0.8], [0, 0, HP]);
  runningGear(K, B, S, paint, hull, lod, W, {
    roadZ: D.roadZ, roadR: W.radius, ret: { y: 0.86, r: 0.085, z: [-2.1, -0.7, 0.7, 2.1] }, trackW: 0.6,
    front: { z: -3.32, y: 0.56, r: 0.3 }, back: { z: 3.3, y: 0.6, r: 0.32, sprocket: true, teeth: 12, w: 0.5 },
  });
  K.addLenses(hull, D, seg, 0.085);

  // Großer Gussturm mit Heckwulst, Stereo-Entfernungsmesser (Köpfe beidseitig), Kuppel-Grundring, Staukorb
  const T = new Bucket();
  castTurret(K, T, paint, [[0, 1.25, 1.55, 1.95], [0.36, 1.3, 1.5, 2.05], [0.68, 1.12, 1.2, 1.85], [0.92, 0.78, 0.8, 1.45]], lod, { bustle: 0.35, rTop: 0.15, castAmp: 0.012 });
  T.add(cyl(1.08, 1.1, 0.1, seg + 4), S.dark, [0, -0.03, 0]);
  if (lod < 2) {
    T.add(cyl(0.07, 0.07, 2.9, seg), paint, [0, 0.6, -0.15], [0, 0, HP]);           // Entfernungsmesser-Rohr quer
    for (const sx of [-1, 1]) { T.add(sph(0.17, seg), paint, [sx * 1.36, 0.6, -0.15], null, [1, 0.8, 1]); T.add(cyl(0.07, 0.07, 0.02, 10), S.optic, [sx * 1.36, 0.62, -0.32], [HP, 0, 0]); }
    T.add(box(0.36, 0.22, 0.42), paint, [0.62, 0.94, -0.85]);
    T.add(box(0.28, 0.12, 0.02), S.optic, [0.62, 0.95, -1.07]);
    T.add(cyl(0.31, 0.31, 0.04, seg), S.dark, [0.55, 0.92, 0.5]);
    T.add(box(2.1, 0.04, 0.5), S.dark, [0, 0.25, 2.18]);
    for (const sx of [-1, 0, 1]) T.add(box(0.035, 0.38, 0.035), S.dark, [sx * 1.05, 0.44, 2.42]);
    T.add(box(2.1, 0.035, 0.035), S.dark, [0, 0.63, 2.42]);
    if (lod === 0) { T.add(box(0.9, 0.32, 0.42), S.canvas, [-0.5, 0.42, 2.18]); T.add(cyl(0.12, 0.12, 0.85, 10), S.canvas, [0.55, 0.38, 2.18], [0, 0, HP]); }
    for (const sx of [-1, 1]) smokeRack(K, T, S, paint, sx * 1.12, 0.62, 0.6, 3, sx, lod, { up: 0.6 });
    antenna(K, T, S, [-0.7, 0.82, 1.6], lod === 0 ? 2.3 : 1.5, lod);
    antenna(K, T, S, [0.75, 0.8, 1.65], lod === 0 ? 2.0 : 1.3, lod);
    if (lod === 0) for (const [x, z] of [[-1.05, -0.7], [1.05, -0.7], [-0.95, 1.4], [0.95, 1.4]]) T.add(new THREE.TorusGeometry(0.055, 0.016, 4, 8), S.dark, [x, 0.78, z], [0, HP, 0]);
  }
  T.add(cyl(0.44, 0.46, 0.08, seg), paint, [D.cmgPivot[0], 0.98, D.cmgPivot[2]]);
  for (const sx of [-1, 1]) T.add(cyl(0.19, 0.19, 0.02, seg), mark, [sx * 1.28, 0.32, 0.9], [0, 0, HP]);

  // gegossene Blende, 120-mm-Rohr mit Rauchabsauger und Laufbuchse, Koax-MG
  const G = new Bucket();
  if (HQ && lod < 2) G.add(armorShell(stackRings([[-0.36, [[-0.58, 0.3], [0.58, 0.3], [0.6, -0.26], [-0.6, -0.26]]], [0.34, [[-0.5, 0.24], [0.5, 0.24], [0.52, -0.24], [-0.52, -0.24]]]], { r: 0.08, rTop: 0.09, rBot: 0.09 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0, cast: true, castAmp: 0.009 }), paint, [0, 0, -0.02], [-HP, 0, 0]);
  else G.add(box(1.16, 0.7, 0.5), paint, [0, 0, -0.02]);
  G.add(cyl(0.19, 0.22, 0.26, seg), paint, [0, 0, -0.36], [HP, 0, 0]);
  G.add(cyl(0.1, 0.095, 6.0, seg), paint, [0, 0, -3.5], [HP, 0, 0]);
  G.add(cyl(0.155, 0.155, 0.8, seg), paint, [0, 0, -3.3], [HP, 0, 0]);
  if (lod < 2) for (const z of [-2.9, -3.7]) G.add(cyl(0.162, 0.162, 0.04, seg), S.dark, [0, 0, z], [HP, 0, 0]);
  G.add(cyl(0.11, 0.115, 0.2, seg), S.dark, [0, 0, -6.52], [HP, 0, 0]);
  G.add(box(0.1, 0.08, 0.22), S.dark, [D.coax[0], D.coax[1], -0.4]);

  // Kommandantenkuppel mit Sichtblöcken und schwerem MG (dreht mit dem Kommandanten)
  const C = new Bucket();
  C.add(cyl(0.4, 0.42, 0.24, seg), paint, [0, -0.02, 0]);
  if (lod < 2) for (let i = 0; i < (lod === 0 ? 8 : 5); i++) { const a = (i / (lod === 0 ? 8 : 5)) * PI * 2; C.add(box(0.11, 0.07, 0.05), S.optic, [Math.sin(a) * 0.405, 0.0, Math.cos(a) * 0.405], [0, a, 0]); }
  C.add(sph(0.38, lod === 0 ? 14 : 8), paint, [0, 0.09, 0], null, [1, 0.32, 1]);
  C.add(box(0.12, 0.13, 0.5), S.dark, [0.12, 0.22, -0.2]);
  C.add(cyl(0.022, 0.022, 0.8, 8), S.dark, [0.12, 0.22, -0.8], [HP, 0, 0]);
  if (lod === 0) C.add(box(0.12, 0.14, 0.2), S.dark, [0.26, 0.18, -0.1]);
  return { hull, ...pack(K, D, [['tur', T, D.turretPivot], ['gun', G, gunOff(D)], ['cmg', C, cmgOff(D), lod < 2]]) };
}

/* ===================================================================== MTW-13 Kröte */

export function buildMTW(lod, S, team, K) {
  K.setLod(lod);
  const D = K.VEHICLES.mtw, W = D.wheels, DET = K.DET, HQ = K.HQ;
  const { box, cyl, Bucket } = K;
  const seg = [18, 10, 6][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  // Kastenwanne: schmale Unterwanne, Aufbau über die Ketten, Bug unten senkrecht, oben stark geneigt; Heck senkrecht
  hullShell(K, B, paint, [[2.5, 0.42], [2.66, 0.9], [-2.6, 0.9], [-2.62, 0.42]], 1.72, lod, { r: 0.03, rs: 0.03 });
  hullShell(K, B, paint, [[2.72, 0.88], [2.76, 1.1], [2.18, 1.84], [-2.6, 1.85], [-2.62, 0.88]], 2.62, lod, { r: 0.035, rs: 0.04 });
  if (lod < 2) {
    // Schwallbrett auf dem Bug (geklappt), Scheinwerfergehäuse, Abschleppösen
    B.add(box(2.3, 0.62, 0.04), paint, [0, 1.38, -2.62], [-0.65, 0, 0]);
    if (lod === 0) for (const sx of [-1, 0, 1]) B.add(box(0.05, 0.05, 0.62), S.dark, [sx * 0.9, 1.38, -2.6], [-0.65, 0, 0]);
    for (const sx of [-1, 1]) B.add(new THREE.TorusGeometry(0.065, 0.02, 4, 8), S.dark, [sx * 0.75, 0.62, -2.68], [0, HP, 0]);
    // Fahrer-Winkelspiegel (Kranz um die Luke), Motorgitter rechts vorn, Auspuff mit Schutzblech rechts
    for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.6; B.add(box(0.12, 0.07, 0.09), S.optic, [-0.5 + Math.sin(a) * 0.33, 1.88, -1.78 - Math.cos(a) * 0.33], [0, a, 0]); }
    B.add(box(0.95, 0.04, 0.85), S.dark, [0.6, 1.86, -1.55]);
    if (lod === 0) for (let i = 0; i < 6; i++) B.add(box(0.9, 0.03, 0.04), paint, [0.6, 1.88, -1.9 + i * 0.14]);
    B.add(cyl(0.07, 0.07, 0.6, 8), S.dark, [1.33, 1.6, -1.45], [0, 0, 0]);
    B.add(box(0.04, 0.5, 0.5), paint, [1.37, 1.6, -1.45]);
    // Dach: große Dachluke (Deckel = Luke 'loader'), Antennenfüße, Kanister; Seiten: Haltegriffe, Werkzeug
    B.add(box(1.0, 0.03, 1.0), S.dark, [0, 1.86, 1.55]);
    antenna(K, B, S, [-1.05, 1.85, 0.4], lod === 0 ? 2.4 : 1.6, lod);
    antenna(K, B, S, [1.05, 1.85, 0.4], lod === 0 ? 2.0 : 1.3, lod);
    for (const sx of [-1, 1]) {
      jerrycan(K, B, paint, S, [sx * 1.0, 1.4, 2.72], 0, lod);
      if (lod === 0) for (const z of [-0.6, 0.6, 1.8]) B.add(box(0.03, 0.05, 0.3), S.dark, [sx * 1.32, 1.65, z]);
    }
    B.add(box(0.05, 0.08, 1.2), S.wood, [-1.33, 1.6, -0.75]);
    for (const sx of [-1, 1]) B.add(box(0.12, 0.08, 0.04), S.rearLamp, [sx * 1.15, 1.6, 2.63]);
  }
  for (const L of D.lights) guardedLamp(K, B, S, L, 0.075, lod);
  if (HQ && lod < 2) {
    for (const sx of [-1, 1]) weld(K, B, paint, [[sx * 1.28, 1.84, -2.15], [sx * 1.28, 1.85, 2.55]], lod);
    weld(K, B, paint, [[-1.26, 1.1, -2.76], [1.26, 1.1, -2.76]], lod);
  }
  for (const sx of [-1, 1]) B.add(cyl(0.18, 0.18, 0.02, seg), mark, [sx * 1.315, 1.35, 0.9], [0, 0, HP]);
  runningGear(K, B, S, paint, hull, lod, W, {
    roadZ: D.roadZ, roadR: W.radius, trackW: 0.38, sag: 0.03,
    front: { z: -2.36, y: 0.62, r: 0.26, sprocket: true, teeth: 10, w: 0.4 }, back: { z: 2.42, y: 0.48, r: 0.25, w: 0.4 },
  });
  K.addLenses(hull, D, seg, 0.065);

  // Kuppel (dreht als 'Turm'): Ring, dreiteiliger Schutzschild; Waffe = schweres MG mit Munitionskasten
  const T = new Bucket();
  T.add(cyl(0.42, 0.44, 0.2, seg), paint, [0, 0.1, 0]);
  if (lod < 2) {
    for (let i = 0; i < (lod === 0 ? 5 : 3); i++) { const a = PI + (i - 2) * 0.62; T.add(box(0.1, 0.06, 0.05), S.optic, [Math.sin(a) * 0.43, 0.14, Math.cos(a) * 0.43], [0, a, 0]); }
    T.add(box(0.8, 0.42, 0.025), paint, [0, 0.42, -0.42]);
    for (const sx of [-1, 1]) T.add(box(0.025, 0.36, 0.42), paint, [sx * 0.46, 0.39, -0.24], [0, sx * 0.45, 0]);
    T.add(box(0.06, 0.18, 0.04), S.dark, [0, 0.36, -0.4]);
  }
  const G = new Bucket();
  G.add(box(0.14, 0.15, 0.62), S.dark, [0, 0, 0.12]);
  G.add(cyl(0.024, 0.024, 1.05, 8), S.dark, [0, 0.02, -0.7], [HP, 0, 0]);
  G.add(cyl(0.036, 0.036, 0.22, 8), S.dark, [0, 0.02, -0.33], [HP, 0, 0]);
  G.add(box(0.12, 0.16, 0.24), S.dark, [0.16, -0.02, 0.15]);
  if (lod === 0) { G.add(box(0.04, 0.12, 0.04), S.dark, [0, -0.12, 0.4]); for (const sx of [-1, 1]) G.add(box(0.03, 0.03, 0.12), S.dark, [sx * 0.05, 0.0, 0.46]); }
  const C = new Bucket();
  C.add(box(0.001, 0.001, 0.001), S.dark);
  const out = { hull, ...pack(K, D, [['tur', T, D.turretPivot], ['gun', G, gunOff(D)], ['cmg', C, cmgOff(D), false]]) };
  if (lod === 0) { out.inner = troopInner(K, S, D, { driver: [-0.5, 0.62, -1.78], engineX: 0.6 }); out.ramp = rampGroup(K, S, paint, D, lod); }
  return out;
}

/**
 * Kampfraum + Fahrerplatz (innen, nur der eigene Insasse sieht ihn): Kampfraum der Schützen aus models-tanks buildTroop,
 * davor Fahrerkammer mit Sitz, Lenkhebeln, Instrumententafel, Winkelspiegeln, Motorschott rechts.
 */
export function troopInner(K, S, D, { driver, engineX = 0.6 } = {}) {
  const grp = new THREE.Group();
  const T = D.troop, { box, cyl, Bucket } = K;
  grp.add(buildTroop(K, S, D));
  const B = new Bucket(), CAB = S.cabin, yF = T.floor, yR = T.roof;
  const z0 = D.hullBox[2] - D.hullBox[5] + 0.35, z1 = T.z0;
  const xl = -T.halfW, xr = T.halfW;
  B.add(K.inward(K.topExtrude([[xl, -z0], [xr, -z0], [xr, -z1], [xl, -z1]], yR - yF)), CAB, [0, yF, 0]);
  B.add(box(xr - xl - 0.1, 0.02, z1 - z0 - 0.1), S.dark, [0, yF + 0.01, (z0 + z1) / 2]);
  if (driver) {
    const [dx, , dz] = driver;
    B.add(box(0.46, 0.08, 0.42), S.canvas, [dx, yF + 0.36, dz + 0.1]);
    B.add(box(0.46, 0.5, 0.08), S.canvas, [dx, yF + 0.65, dz + 0.36], [-0.15, 0, 0]);
    for (const sx of [-1, 1]) { B.add(cyl(0.02, 0.02, 0.55, 6), S.steel, [dx + sx * 0.18, yF + 0.45, dz - 0.32], [0.5, 0, 0]); B.add(cyl(0.035, 0.035, 0.1, 8), S.rubber, [dx + sx * 0.18, yF + 0.68, dz - 0.45]); }
    B.add(box(0.55, 0.22, 0.2), S.dark, [dx, yR - 0.68, z0 + 0.14], [0.55, 0, 0]);
    for (let i = 0; i < 4; i++) B.add(cyl(0.032, 0.032, 0.012, 14), S.dial, [dx - 0.18 + i * 0.12, yR - 0.6, z0 + 0.2], [1.0, 0, 0]);
    for (let i = 0; i < 5; i++) B.add(box(0.018, 0.03, 0.018), i % 2 ? S.amber : S.lensOn, [dx - 0.12 + i * 0.06, yR - 0.67, z0 + 0.26]);
    B.add(box(0.3, 0.2, 0.18), S.dark, [dx + 0.42, yF + 0.5, z0 + 0.2]);                       // Funkgerät
    for (let i = -1; i <= 1; i++) B.add(box(0.14, 0.1, 0.08), S.optic, [dx + i * 0.2, yR - 0.06, z0 + 0.08]);
    B.add(box(0.14, 0.04, 0.04), S.lensOn, [dx, yR - 0.03, dz + 0.4]);
  }
  // Motorschott (rechts vorn), Leitungen, Feuerlöscher
  B.add(box(0.04, yR - yF - 0.05, z1 - z0), S.steel, [engineX - 0.6 + 0.02, (yF + yR) / 2, (z0 + z1) / 2]);
  B.add(box(xr - engineX + 0.55, yR - yF - 0.05, 0.04), S.steel, [(engineX - 0.6 + xr) / 2, (yF + yR) / 2, z1 - 0.02]);
  B.add(cyl(0.06, 0.06, 0.4, 10), S.red, [engineX - 0.5, yF + 0.22, z1 - 0.2]);
  B.add(cyl(0.02, 0.02, z1 - z0, 6), S.rubber, [xl + 0.05, yR - 0.1, (z0 + z1) / 2], [HP, 0, 0]);
  B.build(grp, { shadow: false });
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return grp;
}

/**
 * Heckrampe (Gruppe 'ramp', Drehpunkt Unterkante): Platte mit Tür, Scharniere, Gummikante, Winkelspiegel; innen hell.
 * Öffnet um +x (Oberkante nach hinten unten) bis etwa auf den Boden.
 */
export function rampGroup(K, S, paint, D, lod) {
  const R = D.ramp, { box, cyl, Bucket } = K;
  const g = new THREE.Group();
  g.name = 'ramp';
  g.position.set(0, R.y0, R.z);
  const h = R.y1 - R.y0;
  g.userData = { kind: R.kind || 'rampe', open: Math.PI - Math.acos(Math.min(0.99, R.y0 / h)) + 0.02 };
  const B = new Bucket();
  B.add(box(R.w, h, 0.07), paint, [0, h / 2, 0.0]);
  B.add(box(R.w - 0.1, h - 0.1, 0.02), S.cabin, [0, h / 2, -0.045]);
  B.add(box(0.62, h * 0.62, 0.02), S.dark, [R.w * 0.22, h * 0.5, 0.045]);
  B.add(box(0.1, 0.06, 0.05), S.optic, [R.w * 0.22, h * 0.72, 0.05]);
  B.add(box(0.12, 0.04, 0.06), S.dark, [R.w * 0.22 + 0.22, h * 0.45, 0.06]);
  for (const sx of [-1, 1]) B.add(cyl(0.035, 0.035, 0.3, 8), S.dark, [sx * R.w * 0.36, 0.02, 0.03], [0, 0, HP]);
  B.add(box(R.w, 0.03, 0.05), S.rubber, [0, h, 0]);
  if (lod === 0) for (const sx of [-1, 1]) B.add(box(0.06, 0.6, 0.03), S.steel, [sx * R.w * 0.3, h * 0.45, -0.065]);
  B.build(g, { shadow: true });
  return g;
}

/** Bauer je Modell-Schlüssel (models.js tankBuilder). */
export const HEAVY_BUILDERS = { lp21: buildLP21, wk2l: buildWK2L, wk2s: buildWK2S, kks: buildKKS, mtw: buildMTW };
