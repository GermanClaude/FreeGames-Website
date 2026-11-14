// NULLPUNKT — Großkarte „Flugplatz“: Fliegerhorst Hagenmoor im Hügelland (Strang karten-neu, 14.11.) (Owner: world).
// Frei erfundener Militärflugplatz: Startbahn 09/27 (840 m × 45 m, Asphalt) mit Befeuerung, Parallelrollweg,
// Vorfeld mit drei begehbaren Hangars (Werkstatt, Galerie, Büroeinbau), Kontrollturm (Treppenhaus bis zur Kanzel),
// Feuerwache, Tanklager, Radarstellung auf dem Hügel, Flakstellungen, Kaserne mit Kantine, Fahrzeughof, Haupttor mit
// Wache, Zaun mit Wachtürmen; ringsum Wald und Felder. Der Jet „JK-9 Falke“ startet hier vom Boden (world.runway:
// kein Luftstart, vehicles/air/aircraft.js), Hubschrauber stehen auf Landeplätzen in den Gefechtsständen.
// Koordinaten: x Osten, z Süden (Norden = −z). Team A (West) / Team B (Ost). Geladen von world/terrain/bigworld.js.
import * as THREE from 'three';
import { hangar, tower, feuerwache, tanklager, radarstellung, kaserne, kantine, fahrzeughof, wache, wachturm, zaunLinie, startbahn, papi, windsack, anflug, hauptquartier, schulflugzeug, flak, armeeLkw, schlepper, bodenstrom, munitionswagen, tankwagen } from './flugplatz-bau.js?v=20261114060746';
import { sandbags, floodMast, jersey, cone, crateStack, barrelGroup, lampPost, frame, hash01 } from '../props.js?v=20261114060746';
import { mgNest } from './grenzland-stellungen.js?v=20261114060746';
import { burntWreck } from './brandwald-bau.js?v=20261114060746';
import { KEIN, VG } from './neu-bau.js?v=20261114060746';
import { flugplatzGelaende } from './flugplatz-gelaende.js?v=20261114060746'; // gelaende (Runde 3)
import { reliefAvoid } from '../terrain/relief.js?v=20261114060746';

const PI = Math.PI, Q = PI / 2;
const R_Y = 13;                                   // Plateau der Radarstellung
export const RUNWAY = { x0: -420, x1: 420, z: 40, w: 45, y: 0, heading: [1, 0], name: '09/27' };
const TAXI_Z = -35;
// Gefechtsstände: Mitte, Seite (s = +1 West/A: „nach innen“ = +x)
const HQ = { A: { x: -415, z: -110, s: 1 }, B: { x: 415, z: -110, s: -1 } };

/** Gefechtsstand-Anordnung (Weltkoordinaten) einer Seite. */
function hqLayout(side) {
  const { x, z, s } = HQ[side];
  return {
    schutzbau: [x - 23 * s, z - 15, 0],
    helis: [[x + 18 * s, z - 22], [x + 18 * s, z + 4]],
    tanks: [[x - 22 * s, z + 34], [x - 13 * s, z + 34]],
    jeeps: [[x - 2 * s, z + 34], [x + 6 * s, z + 34], [x + 14 * s, z + 34]],
    spawns: [[x - 22, z + 20], [x - 14, z + 20], [x - 6, z + 20], [x + 2, z + 20], [x + 10, z + 20], [x - 18, z + 25], [x - 2, z + 25], [x + 6, z + 25]].map(([px, pz]) => [px, pz, s > 0 ? -Q : Q]),
  };
}

// ---------------------------------------------------------------------------
// Ortschaften
// ---------------------------------------------------------------------------
function vorfeld(b) {
  // Vorfeld (Beton in 5-m-Feldern), Vorplatz Tower/Feuerwache
  b.groundTiled(-170, -132, 170, -45, 'concrete_panel', { cell: 2, tint: '#b4b0a6' });
  b.groundTiled(100, -142, 205, -132, 'concrete', { cell: 2, tint: '#aeaaa0' });
  b.groundTiled(170, -132, 205, -100, 'concrete', { cell: 2, tint: '#aeaaa0' });
  // Fugen (dunkle Linien alle 5 m) nur ab mittel – auf low reicht die Textur
  if (b.lookQuality && b.lookQuality !== 'low') {
    for (let x = -165; x < 170; x += 10) b.decal(x, 0.01, -88.5, 87, 0.5, 'line', { ry: -Q, tint: '#55524c', kind: 'paint', opacity: 0.35 });
    for (let z = -127; z < -45; z += 10) b.decal(0, 0.01, z, 340, 0.5, 'line', { ry: 0, tint: '#55524c', kind: 'paint', opacity: 0.35 });
  }
  // Rollführungslinien (gelb) von den Hallentoren zum Rollweg, Abstellpositionen mit Nummern
  for (const hx of [-120, -40, 40]) b.decal(hx, 0.02, -88, 86, 1.0, 'line', { ry: -Q, tint: '#e8c22c', kind: 'paint', opacity: 0.85 });
  b.decal(0, 0.02, -60, 340, 1.0, 'line', { ry: 0, tint: '#e8c22c', kind: 'paint', opacity: 0.85 });
  for (const [px, n] of [[-140, 1], [-80, 2], [80, 3], [140, 4]]) {
    b.decal(px, 0.02, -95, 14, 14, 'manhole', { kind: 'paint', tint: '#e8c22c', opacity: 0.55 });
    b.defineSign('stand' + n, { style: 'number', text: String(n), sub: 'STAND', bg: '#e8c22c', fg: '#1c1c1c' });
    b.box(px, 0, -122, 0.12, 2.2, 0.12, 'metal_painted', { tint: '#3d4247', minimap: false });
    b.sign(px, 1.6, -121.9, 1.0, 1.0, 'stand' + n, { ry: 0 });
  }
  // Abgestellte Schulflugzeuge, Geräte, Tankwagen, Sperren
  schulflugzeug(b, -140, -100, PI + 0.08, { tint: '#9aa088', akzent: '#d9a72a' });
  schulflugzeug(b, 140, -98, PI - 0.12, { tint: '#d9d6cc' });
  for (const [x, z, ry] of [[-140, -92, 0], [140, -90, 0]]) for (const s of [-1, 1]) cone(b, x + s * 5.6, z - 2.6, {});
  armeeLkw(b, -95, -70, Q + 0.1);
  armeeLkw(b, 100, -110, -Q - 0.2, { plane: '#6a6a4c' });
  for (const [x, z] of [[-60, -110], [60, -110]]) barrelGroup(b, x, z, { n: 5 });
  // Bodengeräte auf dem Vorfeld (Deckung zwischen den Hallen und dem Rollweg)
  schulflugzeug(b, -80, -98, PI + 0.3, { tint: '#8a9472', akzent: '#c8402f' });
  tankwagen(b, -58, -72, Q + 0.15);
  schlepper(b, 28, -100, 0.6);
  bodenstrom(b, -22, -106, -0.4);
  bodenstrom(b, 96, -86, 0.2);
  munitionswagen(b, 58, -80, Q - 0.1);
  munitionswagen(b, 66, -84, Q + 0.05);
  for (let k = 0; k < 6; k++) cone(b, -40 + k * 3, -64, {});
  crateStack(b, -12, -118, { ry: 0.25 });
  crateStack(b, 22, -114, { ry: -0.3 });
  // Splitterschutzwände (Betonleitwände) um zwei Stellplätze, Sandsack-Deckungen auf dem Vorfeld
  for (let k = 0; k < 4; k++) jersey(b, -30 + k * 3.1, -78, { len: 3 });
  for (let k = 0; k < 4; k++) jersey(b, 21 + k * 3.1, -78, { len: 3 });
  for (let k = 0; k < 3; k++) jersey(b, -2.5, -100 + k * 3.1, { len: 3, ry: Q });
  sandbags(b, -150, -55, -142, -55, { rows: 4 });
  sandbags(b, 142, -55, 150, -55, { rows: 4 });
  mgNest(b, -164, -52, { ry: PI * 0.85 });
  mgNest(b, 164, -52, { ry: -PI * 0.85 });
  // Vorfeldbeleuchtung
  for (const x of [-165, -85, 0, 85, 165]) floodMast(b, x, -128, { h: 16, ry: PI });
  for (const x of [-120, 0, 120]) floodMast(b, x, -47, { h: 12 });
  return {};
}

function halle(b, nr) {
  const x = [-120, -40, 40][nr - 1];
  hangar(b, { x, z: -150, nr, kind: ['flugzeug', 'triebwerk', 'lager'][nr - 1], closed: nr === 3, tint: ['#8a9182', '#858d80', '#8f9488'][nr - 1] });
  return {};
}

function turmbereich(b) {
  tower(b, 125, -150);
  feuerwache(b, 175, -150);
  windsack(b, 200, -120, 0, 0.7);
  // Glücksbringer in der Kanzel (Geheimnis): Gummiente auf dem Funkpult
  const ex = 125 + 6.05 - 1.2 + 2.6, ez = -150 + 3.2, ey = 17.0 + 0.92;
  b.cyl(ex, ey, ez, 0.07, 0.1, 'polymer', { tint: '#f2c230', ...KEIN, seg: 10 });
  b.cyl(ex + 0.04, ey + 0.1, ez, 0.045, 0.07, 'polymer', { tint: '#f2c230', ...KEIN, seg: 10 });
  b.box(ex + 0.09, ey + 0.12, ez, 0.05, 0.02, 0.03, 'polymer', { tint: '#e8762a', ...VG, ao: false });
  return {};
}

function radar(b, ctx) {
  const r = radarstellung(b, -300, -170, R_Y, ctx.THREE || THREE);
  return { antenna: r.antenna };
}

function unterkuenfte(b) {
  b.groundTiled(-150, 138, -110, 162, 'asphalt', { cell: 2, tint: '#cfc9be' });
  kaserne(b, -160, 128, 1);
  kaserne(b, -100, 128, 2);
  kaserne(b, -160, 175, 3);
  kantine(b, -98, 176);
  // Appellplatz: Fahnenmast, Bänke, Laternen
  b.cyl(-146, 0, 160, 0.09, 11, 'metal_galvanized', { seg: 8, minimap: 'prop' });
  b.cyl(-146, 0, 160, 0.6, 0.4, 'concrete', { seg: 12, minimap: false });
  for (const [x, z] of [[-150, 112], [-110, 112], [-130, 188], [-75, 150]]) lampPost(b, x, z, { h: 5.5, ry: 0, kind: 'warm' });
  sandbags(b, -126, 142, -120, 142, { rows: 4 });
  sandbags(b, -140, 158, -134, 158, { rows: 4 });
  // Fahrradständer, Mülltonnen, Holzbänke
  for (let k = 0; k < 4; k++) b.box(-178 + k * 0.6, 0, 140, 0.05, 0.7, 1.4, 'metal_galvanized', { ...KEIN });
  for (const [x, z] of [[-120, 166], [-140, 166]]) {
    b.box(x, 0.42, z, 2.0, 0.06, 0.45, 'wood_planks', { tint: '#8a6a4a', minimap: false });
    for (const s of [-1, 1]) b.box(x + s * 0.85, 0, z, 0.08, 0.42, 0.4, 'metal_painted', { tint: '#3d4247', ...KEIN });
  }
  return {};
}

function torbereich(b) {
  wache(b, 0, 238);
  return {};
}

function gefechtsstand(b, side) {
  const L = hqLayout(side), { x, z } = HQ[side];
  hauptquartier(b, x, z, side, {
    pads: [...L.tanks.map(([px, pz]) => [px, pz, 'tank']), ...L.jeeps.map(([px, pz]) => [px, pz, 'jeep'])],
    helis: L.helis, schutzbau: L.schutzbau,
  });
  return {};
}

// Späte Ortschaften (Geländehöhen nötig)
function piste(b, ctx) {
  const hf = ctx.hf;
  // Farbe liegt auf dem Asphaltband (Gelände + 3,5 cm, roads.js)
  const py = hf.heightAt(0, RUNWAY.z) + 0.04, ty = hf.heightAt(0, TAXI_Z) + 0.04;
  startbahn(b, RUNWAY, py);
  // Rollweg-Mittellinie (gelb) und blaue Randfeuer
  b.decal(0, ty, TAXI_Z, 800, 1.2, 'line', { ry: 0, tint: '#e8c22c', kind: 'paint', opacity: 0.85 });
  for (const x of [-400, -150, 150, 400]) b.decal(x, ty, (TAXI_Z + 17.5) / 2 - 4, 42, 1.2, 'line', { ry: Q, tint: '#e8c22c', kind: 'paint', opacity: 0.85 });
  for (let x = -400; x <= 400; x += 40) for (const s of [-1, 1]) {
    const z = TAXI_Z + s * 11.2, y = hf.heightAt(x, z);
    b.cyl(x, y - 0.03, z, 0.06, 0.32, 'metal_painted', { tint: '#e8c22c', ...KEIN, seg: 6 });
    b.cyl(x, y + 0.29, z, 0.08, 0.1, 'lamp_lens', { tint: '#3a6fd8', ...KEIN, seg: 6, ao: false });
  }
  // Rollhalt-Markierung vor der Bahn (doppelt durchgezogen + gestrichelt) an den Verbindungen
  for (const x of [-400, -150, 150, 400]) for (const dz of [0, 1.2]) b.decal(x, ty, 10 - dz, 18, 1.2, 'line', { ry: 0, tint: '#e8c22c', kind: 'paint', opacity: 0.9 });
  b.defineSign('rollhalt', { style: 'plate', text: 'A1 ▸ 09-27', bg: '#c8302a', fg: '#ffffff' });
  for (const x of [-400, -150, 150, 400]) { const y = hf.heightAt(x - 11, 8); b.box(x - 11, y, 8, 2.2, 1.0, 0.3, 'concrete', { tint: '#e8e4dc', minimap: false }); b.sign(x - 11, y + 1.0, 8, 2.0, 0.6, 'rollhalt', { ry: 0 }); }
  papi(b, RUNWAY.x0 + 300, RUNWAY.z - RUNWAY.w / 2 - 14, hf.heightAt(RUNWAY.x0 + 300, RUNWAY.z - 30));
  papi(b, RUNWAY.x1 - 300, RUNWAY.z + RUNWAY.w / 2 + 14 - 27, hf.heightAt(RUNWAY.x1 - 300, RUNWAY.z + 30));
  windsack(b, -10, 72, hf.heightAt(-10, 72), 0.9);
  // Restlängentafeln (schwarz, weiße Ziffer = verbleibende Bahnlänge in 100 m) beidseits alle 100 m
  for (let k = 1; k <= 7; k++) for (const [x, side, key] of [[RUNWAY.x0 + k * 100, -1, 'rest' + (8 - k)], [RUNWAY.x1 - k * 100, 1, 'rest' + (8 - k)]]) {
    b.defineSign(key, { style: 'number', text: String(8 - k), bg: '#141414', fg: '#f2f0ea' });
    const z = RUNWAY.z + side * (RUNWAY.w / 2 + 12), y = hf.heightAt(x, z);
    b.box(x, y, z, 0.25, 1.4, 1.6, 'metal_painted', { tint: '#141414', minimap: false });
    b.sign(x + side * 0.13, y + 0.75, z, 1.2, 1.2, key, { ry: side > 0 ? Q : -Q, back: false });
  }
  anflug(b, hf, RUNWAY.x0 - 15, RUNWAY.z, -1, 3);
  anflug(b, hf, RUNWAY.x1 + 15, RUNWAY.z, 1, 3);
  return {};
}

function zaun(b, ctx) {
  const hf = ctx.hf, X = 460, Z = 255;
  // Haupttor Süd (x = 0), Nordtor (x = 0), Durchbrüche (Bombentreffer, aufgeschnitten)
  zaunLinie(b, hf, -X, Z, X, Z, [[X - 6, X + 6], [X - 240, X - 233], [X + 175, X + 181]]);
  zaunLinie(b, hf, X, -Z, -X, -Z, [[X - 6, X + 6], [X - 330, X - 322], [X + 290, X + 297]]);
  zaunLinie(b, hf, -X, -Z, -X, Z, [[180, 190], [330, 338]]);
  zaunLinie(b, hf, X, Z, X, -Z, [[150, 158], [300, 312]]);
  for (const [x, z, ry] of [[-X + 4, -Z + 4, PI * 0.75], [X - 4, -Z + 4, -PI * 0.75], [X - 4, Z - 4, -PI * 0.25], [-X + 4, Z - 4, PI * 0.25], [-230, Z - 4, 0], [230, Z - 4, 0], [-200, -Z + 4, PI], [200, -Z + 4, PI]]) wachturm(b, x, hf.heightAt(x, z), z, ry);
  return { clearLines: [{ pts: [[-X, -Z], [X, -Z], [X, Z], [-X, Z], [-X, -Z]], r: 4 }] };
}

function flakstellungen(b, ctx) {
  const hf = ctx.hf;
  for (const [x, z, ry] of [[-215, -192, PI * 0.8], [215, -200, -PI * 0.8], [-260, 195, PI * 0.2], [262, 198, -PI * 0.2], [-60, 84, 0.3], [60, 84, -0.3]]) {
    const y = hf.heightAt(x, z) - 0.05;
    // Sandsackring mit Zugang nach hinten, Flak, Munitionskisten, Tarnnetz
    const R = 4.2, n = 12;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * PI * 2, a1 = ((k + 1) / n) * PI * 2, am = (a0 + a1) / 2;
      if (Math.abs(Math.atan2(Math.sin(am), Math.cos(am)) - PI) < 0.45 || Math.abs(Math.atan2(Math.sin(am), Math.cos(am)) + PI) < 0.45) continue;
      const p = (a) => [x + Math.sin(a + ry) * R, z + Math.cos(a + ry) * R];
      const [ax, az] = p(a0 - 0.05), [bx, bz] = p(a1 + 0.05);
      sandbags(b, ax, az, bx, bz, { rows: 5, y, double: true });
    }
    flak(b, x, y, z, ry, 0.45 + hash01(x, z, 1) * 0.4);
    const f = frame(b, x, y, z, ry);
    for (const [lx, lz] of [[-2.4, -2.0], [2.3, -2.2]]) { const [px, pz] = f.P(lx, lz); b.box(px, y, pz, 0.6, 0.35, 0.4, 'metal_painted', { ry, tint: '#4b5a3a', ...KEIN }); b.box(px, y + 0.35, pz, 0.6, 0.35, 0.4, 'metal_painted', { ry: ry + 0.2, tint: '#56653f', ...KEIN }); }
  }
  // Kriegsspuren: abgestürztes Schulflugzeug neben der Bahn, ausgebrannte Lkw am Rollweg
  { const x = 215, z = 76, y = hf.heightAt(x, z); schulflugzeug(b, x, z, 2.2, { y: y - 0.35, tint: '#2e2a26', akzent: '#3a3430', open: true }); b.decal(x, y + 0.03, z, 16, 14, 'soot', { opacity: 0.85 }); b.decal(x - 3, y + 0.04, z + 2, 10, 8, 'cracks', { opacity: 0.6 }); }
  for (const [x, z, ry, k] of [[-262, -8, 0.4, 'lkw'], [258, -60, 2.6, 'lkw'], [-120, 70, 1.2, 'pkw']]) burntWreck(b, x, hf.heightAt(x, z), z, ry, k, 7);
  return {};
}

// ---------------------------------------------------------------------------
// Kartenbeschreibung
// ---------------------------------------------------------------------------
const LA = hqLayout('A'), LB = hqLayout('B');
const veh = (side, L) => {
  const yawIn = side === 'A' ? -Q : Q, t = side;
  return [
    // Jet: auf der Bahn an der eigenen Schwelle, Nase zur Bahnmitte (A rollt nach Osten auf der Nordhälfte, B nach Westen
    // auf der Südhälfte – Gegenstarts kreuzen sich mit 20 m Seitenabstand)
    { id: t + '-jet', team: t, kind: 'jet', x: side === 'A' ? RUNWAY.x0 + 25 : RUNWAY.x1 - 25, z: side === 'A' ? RUNWAY.z - 10 : RUNWAY.z + 10, yaw: yawIn },
    { id: t + '-heli-1', team: t, kind: 'heli', x: L.helis[0][0], z: L.helis[0][1], yaw: yawIn },
    { id: t + '-panzer-1', team: t, kind: 'tank', x: L.tanks[0][0], z: L.tanks[0][1], yaw: PI },
    { id: t + '-jeep-1', team: t, kind: 'jeep', x: L.jeeps[0][0], z: L.jeeps[0][1], yaw: PI },
    { id: t + '-heli-2', team: t, kind: 'heli', x: L.helis[1][0], z: L.helis[1][1], yaw: yawIn },
    { id: t + '-panzer-2', team: t, kind: 'tank', x: L.tanks[1][0], z: L.tanks[1][1], yaw: PI },
    { id: t + '-jeep-2', team: t, kind: 'jeep', x: L.jeeps[1][0], z: L.jeeps[1][1], yaw: PI },
    { id: t + '-jeep-3', team: t, kind: 'jeep', x: L.jeeps[2][0], z: L.jeeps[2][1], yaw: PI },
  ];
};

const FLUGPLATZ = {
  id: 'flugplatz',
  name: 'Flugplatz',
  scale: 'gross',
  seed: 9090,
  bounds: { minX: -490, maxX: 490, minZ: -300, maxZ: 300, minY: -10, maxY: 120 },
  runway: RUNWAY,
  ambience: 'range',
  assets: { hdri: 'np_sky_vormittag_klar', materials: { asphalt: 'asphalt_light' } }, // texturen 14.11.: heller Pistenasphalt
  defaultSurface: 'grass',
  wallMargin: 40,
  wallTop: 12, // Randwand nur in Bodennähe: Start/Landung geradeaus über die Bahnenden hinaus (Luftraum regelt air/aircraft.js)
  navGrid: 5,
  lighting: {
    sun: { elevation: 34, azimuth: 140, color: '#fff0da', intensity: 3.7 },
    sky: { turbidity: 6.5, rayleigh: 1.0, mieCoefficient: 0.005, mieDirectionalG: 0.8, exposure: 0.7, clouds: { coverage: 0.45, density: 0.45, scale: 0.00015, elevation: 0.55 }, hazeHigh: 0.22, hazeAmount: 0.9, hdriIntensity: 2.0 },
    hemi: { sky: '#d6dade', ground: '#6a6b55', intensity: 1.3, hdriIntensity: 1.0 },
    env: { intensity: 1.6, ground: '#6a6c52', groundIntensity: 0.55, tint: '#f2f1ee', hdriIntensity: 1.3, hdriTint: '#ece6dc' },
    fog: { color: '#c6ccd0', nearFactor: 0.2, density: 0.0024, falloff: 0.02, start: 30, max: 0.88, sun: 0.65, sunExp: 4 },
    shadow: { size: 60, bias: -0.0004, normalBias: 0.04, near: 40, farMaxY: 40 },
    exposure: 1.0,
    atmos: { beams: 0.02, beamG: 0.45, dust: 0.6, dustSize: 0.014 },
  },
  water: { color: '#2b4a40' },

  terrain: {
    size: 1100, res: 1, seed: 9090,
    base: { amp: 3.2, scale: 210, octaves: 5, offset: 1.2 },
    detail: { amp: 0.28, scale: 10 },
    hills: [
      { x: -300, z: -170, r: 78, h: 14 }, { x: -60, z: -350, r: 120, h: 16 }, { x: 260, z: -350, r: 100, h: 13 },
      { x: -300, z: 340, r: 110, h: 12 }, { x: 320, z: 330, r: 95, h: 11 }, { x: 40, z: 360, r: 80, h: 8 },
    ],
    // Randhöhen flach gehalten: An- und Abflug über die Bahnenden (Test 14.11.: Steigflug nach Osten traf bei 38 m Randhöhe den Kamm)
    edge: { start: 515, end: 548, height: 16 },
    waterY: -8,
    pads: [
      { x: 0, z: 40, w: 920, d: 84, y: 0, blend: 40, worn: false },        // Startbahn mit Schulter
      { x: 0, z: -90, w: 860, d: 180, y: 0, blend: 30, worn: false },      // Rollweg, Vorfeld, Hallen, Tower
      { x: HQ.A.x, z: HQ.A.z + 4, w: 84, d: 92, y: 0, blend: 20 },          // Gefechtsstand West
      { x: HQ.B.x, z: HQ.B.z + 4, w: 84, d: 92, y: 0, blend: 20 },          // Gefechtsstand Ost
      { x: -130, z: 152, w: 140, d: 96, y: 0, blend: 20 },                  // Unterkünfte
      { x: 150, z: 150, w: 104, d: 78, y: 0, blend: 20 },                   // Fahrzeughof
      { x: 0, z: 242, w: 54, d: 30, y: 0, blend: 14 },                      // Haupttor
      { x: 302, z: -165, w: 92, d: 70, y: 0, blend: 20 },                   // Tanklager
      { x: -300, z: -170, w: 50, d: 50, y: R_Y, blend: 22 },                // Radarstellung
      { x: -525, z: 40, w: 50, d: 150, y: 0, blend: 40, worn: false },      // Anflugschneise West
      { x: 525, z: 40, w: 50, d: 150, y: 0, blend: 40, worn: false },       // Anflugschneise Ost
    ],
    roads: [
      { id: 'piste', name: 'Startbahn 09/27', kind: 'asphalt', width: RUNWAY.w, shoulder: 6, pts: [[RUNWAY.x0, RUNWAY.z], [0, RUNWAY.z], [RUNWAY.x1, RUNWAY.z]] },
      { id: 'rollweg', name: 'Rollweg A', kind: 'asphalt', width: 20, shoulder: 4, pts: [[-400, TAXI_Z], [0, TAXI_Z], [400, TAXI_Z]] },
      ...[-400, -150, 150, 400].map((x, i) => ({ id: 'abrollweg' + i, name: 'Rollweg A' + (i + 1), kind: 'asphalt', width: 18, shoulder: 3, pts: [[x, TAXI_Z + 10.4], [x, RUNWAY.z - RUNWAY.w / 2 - 0.4]] })),
      { id: 'zufahrt', name: 'Zufahrt', kind: 'asphalt', width: 7, pts: [[0, 330], [0, 270], [0, 230], [0, 160], [0, 104]] },
      { id: 'lagerstrasse', name: 'Lagerstraße', kind: 'asphalt', width: 7, pts: [[-250, 100], [-130, 100], [-4, 100], [150, 100], [250, 100]] },
      { id: 'nordstrasse', name: 'Nordstraße', kind: 'gravel', width: 5, pts: [[-385, -150], [-340, -212], [-200, -216], [0, -216], [200, -216], [330, -212], [385, -150]] },
      { id: 'hallenweg', name: 'Hallenweg', kind: 'gravel', width: 5, pts: [[0, -213], [0, -175], [0, -136]] },
      { id: 'radarweg', name: 'Radarweg', kind: 'gravel', width: 4, pts: [[-250, -214], [-272, -205], [-290, -196]] },
      { id: 'feldweg', name: 'Feldweg', kind: 'dirt', width: 3.6, pts: [[-250, 100], [-330, 130], [-420, 200], [-470, 280]] },
    ],
    fields: [
      { x: -200, z: 292, w: 130, d: 60, ry: 0.04, kind: 'acker' }, { x: -50, z: 300, w: 90, d: 50, ry: -0.05, kind: 'acker' },
      { x: 150, z: 296, w: 120, d: 60, ry: 0.03, kind: 'stoppel' }, { x: 380, z: 220, w: 70, d: 50, ry: 0.4, kind: 'acker' },
      { x: -390, z: 200, w: 60, d: 70, ry: -0.3, kind: 'stoppel' },
    ],
    forests: [
      { x: -220, z: -340, r: 80 }, { x: 110, z: -335, r: 70 }, { x: 390, z: -310, r: 60 }, { x: -430, z: -300, r: 55 },
      { x: -520, z: 160, r: 60 }, { x: 520, z: 170, r: 60 }, { x: 220, z: 345, r: 60 }, { x: -360, z: 340, r: 55 },
    ],
    // Splitterschutzwälle (Erdwälle 2,6 m hoch) als Deckung auf den freien Grasflächen
    dams: [
      { a: [-330, -72], b: [-282, -78], y: 2.6, crown: 1.6, slope: 1.4 }, { a: [282, -78], b: [330, -72], y: 2.6, crown: 1.6, slope: 1.4 },
      { a: [-205, 78], b: [-160, 84], y: 2.4, crown: 1.6, slope: 1.4 }, { a: [160, 84], b: [205, 78], y: 2.4, crown: 1.6, slope: 1.4 },
      { a: [-90, -200], b: [-40, -204], y: 2.4, crown: 1.6, slope: 1.4 }, { a: [40, -204], b: [90, -200], y: 2.4, crown: 1.6, slope: 1.4 },
      { a: [-345, 200], b: [-300, 215], y: 2.6, crown: 1.6, slope: 1.4 }, { a: [300, 215], b: [345, 200], y: 2.6, crown: 1.6, slope: 1.4 },
    ],
    // Bombentrichter neben Bahn und Rollweg (Kriegsspuren; keiner auf Asphalt)
    craters: {
      list: [[-330, 2, 6, 1.8], [-250, -80, 5, 1.5], [-90, -8, 4.5, 1.4], [60, -6, 5, 1.6], [230, -82, 6, 1.8], [310, -60, 5, 1.5], [-180, 74, 5, 1.5],
        [100, 80, 4, 1.2], [270, 78, 5, 1.6], [-360, 92, 6, 1.8], [380, 140, 5, 1.6], [-40, 200, 5, 1.4], [62, 182, 4, 1.2], [-240, 240, 5, 1.5]],
    },
  },

  vegetation: {
    seed: 909,
    forests: [
      { x: -220, z: -340, r: 80, density: 0.7, spruce: 0.8 }, { x: 110, z: -335, r: 70, density: 0.65, spruce: 0.6 },
      { x: 390, z: -310, r: 60, density: 0.65, spruce: 0.7 }, { x: -430, z: -300, r: 55, density: 0.6, spruce: 0.85 },
      { x: -520, z: 160, r: 60, density: 0.6, spruce: 0.7 }, { x: 520, z: 170, r: 60, density: 0.6, spruce: 0.7 },
      { x: 220, z: 345, r: 60, density: 0.55, spruce: 0.4 }, { x: -360, z: 340, r: 55, density: 0.6, spruce: 0.5 },
    ],
    ring: { density: 0.32, spruce: 0.75, inset: -6, step: 9 },
    scatter: { count: 22 },
    hedges: [
      { pts: [[-280, 262], [-120, 266]], trees: 0.25 }, { pts: [[-10, 268], [100, 266]], trees: 0.2 }, { pts: [[300, 262], [420, 250]], trees: 0.3 },
    ],
    // Linden an der Lagerstraße und zwischen den Kasernenblöcken
    trees: [
      [-230, 108, 1.0, 0.4], [-200, 92, 1.05, 1.2], [-75, 108, 0.95, 2.1], [-40, 92, 1.0, 3.0], [40, 108, 1.1, 4.2], [80, 92, 1.0, 5.1],
      [205, 108, 1.0, 0.9], [-190, 152, 1.1, 2.4], [-72, 200, 1.0, 3.6], [-185, 196, 0.95, 4.8], [100, 190, 1.0, 5.6], [205, 190, 1.05, 0.2],
    ],
    rocks: { count: 30, extra: [], clusters: [[-360, -230, 4, 5], [360, -240, 4, 5], [-420, 250, 3, 4], [440, 260, 3, 4]] },
  },
  // Flugbetriebsfläche frei von Bäumen (Hindernisfreiheit), Anflugschneisen über den Kartenrand hinaus
  clearings: [
    ...Array.from({ length: 13 }, (_, i) => [-480 + i * 80, 10, 62]),
    ...Array.from({ length: 9 }, (_, i) => [-400 + i * 100, -130, 70]),
    [-560, 40, 70], [560, 40, 70], [-500, 40, 60], [500, 40, 60], [-300, -170, 40], [0, 240, 40],
  ],

  sites: [
    { id: 'vorfeld', name: 'Vorfeld', bounds: { minX: -172, maxX: 207, minZ: -144, maxZ: -43 }, nav: false, build: (b) => vorfeld(b), chunkSize: 200 },
    ...[1, 2, 3].map((nr) => {
      const x = [-120, -40, 40][nr - 1];
      return { id: 'halle' + nr, name: 'Halle ' + nr, bounds: { minX: x - 33, maxX: x + 33, minZ: -170, maxZ: -126 }, navBounds: { minX: x - 24, maxX: x + 24, minZ: -170, maxZ: -127 }, chunkSize: 128, build: (b) => halle(b, nr), seeds: [[x, -140], [x, -158]], height: 16, spacing: 1.6 };
    }),
    { id: 'tower', name: 'Kontrollturm', bounds: { minX: 112, maxX: 192, minZ: -160, maxZ: -136 }, chunkSize: 128, build: (b) => turmbereich(b), seeds: [[118, -140], [175, -140]], height: 24, spacing: 1.5 },
    { id: 'tanklager', name: 'Tanklager', bounds: { minX: 270, maxX: 336, minZ: -190, maxZ: -140 }, chunkSize: 128, build: (b) => tanklager(b, 300, -165), seeds: [[296, -166], [322, -160]], height: 13, spacing: 1.6 },
    { id: 'radar', name: 'Radarstellung', y: R_Y, bounds: { minX: -322, maxX: -278, minZ: -192, maxZ: -148 }, chunkSize: 128, build: (b, ctx) => radar(b, ctx), seeds: [[-300, -165, R_Y]], height: 14, spacing: 1.6 },
    { id: 'kaserne', name: 'Unterkünfte', bounds: { minX: -190, maxX: -70, minZ: 112, maxZ: 196 }, chunkSize: 128, build: (b) => unterkuenfte(b), seeds: [[-130, 150], [-160, 118], [-100, 118]], height: 10, spacing: 1.6 },
    { id: 'fahrzeughof', name: 'Fahrzeughof', bounds: { minX: 104, maxX: 196, minZ: 118, maxZ: 182 }, chunkSize: 128, build: (b) => fahrzeughof(b, 150, 150), seeds: [[150, 150]], height: 9, spacing: 1.7 },
    { id: 'tor', name: 'Haupttor', bounds: { minX: -26, maxX: 16, minZ: 228, maxZ: 252 }, chunkSize: 128, build: (b) => torbereich(b), seeds: [[4, 240]], height: 6, spacing: 1.6 },
    { id: 'hq_a', name: 'Gefechtsstand West', bounds: { minX: HQ.A.x - 40, maxX: HQ.A.x + 40, minZ: HQ.A.z - 38, maxZ: HQ.A.z + 46 }, chunkSize: 128, build: (b) => gefechtsstand(b, 'A'), seeds: [[HQ.A.x, HQ.A.z + 20]], height: 14, spacing: 2.2 },
    { id: 'hq_b', name: 'Gefechtsstand Ost', bounds: { minX: HQ.B.x - 40, maxX: HQ.B.x + 40, minZ: HQ.B.z - 38, maxZ: HQ.B.z + 46 }, chunkSize: 128, build: (b) => gefechtsstand(b, 'B'), seeds: [[HQ.B.x, HQ.B.z + 20]], height: 14, spacing: 2.2 },
  ],
  lateSites: [
    { id: 'piste', name: 'Startbahn', bounds: { minX: -520, maxX: 520, minZ: -60, maxZ: 90 }, chunkSize: 360, build: (b, ctx) => piste(b, ctx) },
    { id: 'zaun', name: 'Zaun', bounds: { minX: -470, maxX: 470, minZ: -265, maxZ: 265 }, chunkSize: 480, build: (b, ctx) => zaun(b, ctx) },
    { id: 'flak', name: 'Flakstellungen', bounds: { minX: -280, maxX: 280, minZ: -215, maxZ: 215 }, chunkSize: 600, build: (b, ctx) => flakstellungen(b, ctx) },
    // gelaende (Runde 3): Erdwälle, Splitterschutz, Materiallager, Fahrzeugstellungen (flugplatz-gelaende.js)
    { id: 'gelaende', name: 'Deckung', bounds: { minX: -360, maxX: 360, minZ: -130, maxZ: 135 }, chunkSize: 360, build: (b, ctx) => { b.gelaende = flugplatzGelaende(b, ctx, FLUGPLATZ); return {}; } },
  ],

  flags: {
    cq: [
      { id: 'A', name: 'Radarstellung', x: -300, z: -166, y: R_Y, radius: 20, heightBand: [-4, 9] },
      { id: 'B', name: 'Unterkünfte', x: -130, z: 150, radius: 28, heightBand: [-3, 9] },
      { id: 'C', name: 'Hangars', x: -40, z: -146, radius: 26, heightBand: [-3, 10] },
      { id: 'D', name: 'Fahrzeughof', x: 150, z: 152, radius: 26, heightBand: [-3, 9] },
      { id: 'E', name: 'Tanklager', x: 300, z: -165, radius: 26, heightBand: [-3, 12] },
    ],
    dom: [
      { id: 'A', name: 'Unterkünfte', x: -130, z: 150, radius: 10 },
      { id: 'B', name: 'Vorfeld', x: 0, z: -88, radius: 10 },
      { id: 'C', name: 'Tower', x: 125, z: -136, radius: 9 },
    ],
  },
  // Startpunkte [x, z, yaw?]: Teamkampf im Mittelteil (West ↔ Ost), Eroberung in den Gefechtsständen
  spawns: {
    A: [[-235, -120], [-250, -80], [-225, -52], [-245, -8], [-235, 82], [-250, 120], [-220, 136], [-258, 162]].map(([x, z]) => [x, z, -Q]),
    B: [[235, -120], [250, -80], [225, -52], [245, -8], [235, 82], [250, 120], [220, 136], [258, 162]].map(([x, z]) => [x, z, Q]),
    ffa: [[-130, 150], [150, 152], [-40, -100], [60, -90], [125, -120], [300, -130], [-300, -130], [0, 120], [-60, 70], [80, 0], [-200, -170], [220, -170], [0, 200], [-330, 60], [330, 60]],
    hq: { A: LA.spawns, B: LB.spawns },
  },
  // Fahrzeuge: je Gefechtsstand Jet (auf der Bahn), 2 Hubschrauber, 2 Panzer, 3 Geländewagen; dazu 2 neutrale
  // Geländewagen im Fahrzeughof (wer zuerst kommt)
  vehicles: [...veh('A', LA), ...veh('B', LB),
    { id: 'hof-jeep-1', team: null, kind: 'jeep', x: 159.25, z: 166, yaw: 0 }, { id: 'hof-jeep-2', team: null, kind: 'jeep', x: 164.75, z: 166, yaw: 0 }],
  secrets: [
    { id: 'flugplatz-ente', name: 'Die Tower-Ente', hint: 'Wer ganz oben sitzt, hat einen Glücksbringer.', x: 125 + 6.05 - 1.2 + 2.6, y: 17.1, z: -150 + 3.2, trigger: { type: 'proximity', radius: 1.6 } },
  ],
};

// gelaende (14.11., Runde 3): Kleinrelief außerhalb der Bauflächen (terrain/relief.js) – Kuppen und Senken in den
// Wiesen/Feldern um den Fliegerhorst. Bahn, Rollwege, Vorfeld, Schneisen und Ortschaften sind Bauflächen (pads) und
// werden danach wieder eingeebnet; Flaggen, Startpunkte, Fahrzeuge und Ortschaften sind zusätzlich ausgeblendet.
FLUGPLATZ.terrain.relief = {
  ...reliefAvoid(FLUGPLATZ),
  knolls: [
    { x: -60, z: 190, r: 20, h: 3.4, w: 15, ry: 0.3 }, { x: 60, z: 190, r: 20, h: 3.4, w: 15, ry: -0.3 },
    { x: -220, z: -250, r: 22, h: 3.6, w: 16, ry: 0.2 }, { x: 220, z: -250, r: 22, h: 3.6, w: 16, ry: -0.2 },
    { x: -330, z: 160, r: 18, h: -2.2, w: 13 }, { x: 330, z: 160, r: 18, h: -2.2, w: 13 },
  ],
  ridges: [{ pts: [[-300, 120], [-270, 135], [-250, 150]], w: 4, h: 1.5 }, { pts: [[300, 120], [270, 135], [250, 150]], w: 4, h: 1.5 }],
  sunken: [{ pts: [[-120, -230], [-60, -250], [0, -262]], w: 4, d: 1.6, bank: 5.5 }, { pts: [[120, -230], [60, -250], [0, -262]], w: 4, d: 1.6, bank: 5.5 }],
  scatter: { seed: 9091, count: 60, area: { minX: -480, maxX: 480, minZ: -290, maxZ: 290 }, r: [10, 22], h: [1.4, 3.4], hollow: 0.3, gap: 8 },
};

export default FLUGPLATZ;
