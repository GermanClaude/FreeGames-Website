// NULLPUNKT — Übungsgelände rund um den Schießstand (Karte „range“, Nutzer 21.11.: „nicht nur zum Waffentesten, sondern
// größer – Panzer, Fahrzeuge, Hubschrauber und Jets allein ausprobieren“). (Owner: world)
//
// Bereiche (x Osten, z Süden, Norden = −z; Großkarte 2,6 × 2,6 km, world/terrain/bigworld.js):
//   Schießstand   Mitte (x ±30, z −77…62, unverändert in range.js), davor Vorplatz mit Teleport-Tafeln
//   Fahrzeughof   südlich des Tors (z 104…240): Stellplätze mit allen Fahrzeugtypen (erscheinen bei Annäherung,
//                 modes/training-gelaende.js)
//   Fahrstrecke   Südosten (x 170…770, z 100…690): Slalom, Rampe, Seitenneigung, Baumstämme, Höckerlinie, Stufe,
//                 Steigungen 15/35 %, Graben, Panzergraben, Furt, Bodenwellen (Gelände: pads/dams in range.js)
//   Panzerschießbahn  Westen (x −1270…−730): Feuerlinie z 1200, Ziele nach Norden auf 200–2500 m – Scheiben,
//                 Pappkameraden (klappen), Ziel-Panzer (echte Fahrzeuge, modes/training-gelaende.js), Wracks,
//                 zwei Schienenziele, Entfernungstafeln
//   Flugfeld      Norden (Startbahn 1200 m bei z −1050, x −40…1160), Vorfeld, drei Hubschrauber-Landeplätze
//   Zielgebiet    Nordwesten (x −620…−80, z −920…−480): Bodenziele für Raketen/Bomben; darüber Ballons und Zieldrohnen
//
// Treffer: Kugeln ('impact') und Explosionen ('explosion') werden gegen die Ziele geprüft → Ereignis 'uebung:hit'
// { target, point, shooter, weaponId, kind: 'kugel'|'explosion', offset (m vom Mittelpunkt, Bodenziele) }. Bewegte
// Ziele (Schienen, Ballons, Drohnen, Pappkameraden) liegen nicht im Kugel-BVH – sie trifft der Strahl über die
// Raycast-Hülle (installTargetRaycast, auch für die Klappziele des Schießstands auf der Großkarte).
import * as THREE from 'three';
import { jersey, cone, floodMast, sandbags, crateStack, barrelGroup, container, tires, hash01 } from '../props.js?v=20261123115551';
import { startbahn, papi, windsack } from './flugplatz-bau.js?v=20261123115551';
import { burntWreck } from './brandwald-bau.js?v=20261123115551';
import { KEIN, VG } from './neu-bau.js?v=20261123115551';

const PI = Math.PI, Q = PI / 2;

// ---------------------------------------------------------------------------
// Lage der Bereiche (auch für range.js: Bauflächen, Wege, Lichtungen)
// ---------------------------------------------------------------------------
export const RUNWAY = { x0: -40, x1: 1160, z: -1050, w: 45, y: 0, heading: [1, 0], name: '09/27' };
export const FIRE_Z = 1200;                       // Feuerlinie der Panzerschießbahn
export const TANK_X = [-1125, -1075, -1025, -975, -925, -875]; // Feuerstellungen
export const TANK_DIST = [200, 300, 400, 500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500];
export const AREA = {
  stand: { name: 'Schießstand', x: 0, z: 44.4, yaw: 0 },
  hof: { name: 'Fahrzeughof', x: 0, z: 229, yaw: 0 },
  strecke: { name: 'Fahrstrecke', x: 205, z: 200, yaw: -Q },
  schiessbahn: { name: 'Panzerschießbahn', x: -1000, z: 1226, yaw: 0 },
  flugfeld: { name: 'Flugfeld', x: 760, z: -925, yaw: 0 },
  zielgebiet: { name: 'Zielgebiet (Luft-Boden)', x: -350, z: -462, yaw: 0 },
};
export const HOF = { x0: -132, x1: 132, z0: 106, z1: 238 };
export const STRECKE = { x0: 170, x1: 770, z0: 100, z1: 690 };
export const SCHIESSBAHN = { x0: -1270, x1: -730, z0: -1320, z1: 1250 };
export const FLUGFELD = { x0: -80, x1: 1200, z0: -1110, z1: -880 };
export const ZIELGEBIET = { x0: -620, x1: -80, z0: -920, z1: -480 };
const HELIPADS = [[700, -962], [760, -962], [820, -962]];

/** Stellplätze (Fahrzeughof, Feuerlinie, Flugfeld): Typ, Lage, Blickrichtung (yaw 0 = Norden), Lackvariante. */
const ROW1 = ['mbt', 'kk', 'kks', 'lp21', 'spz', 'wk2', 'wk2m', 'wk2h', 'wk2s', 'wk2l', 'wk2j', 'wk1', 'wk1l'];
const ROW2 = ['rsp', 'mtw', 'spw', 'hkw', 'lkw', 'gmw', 'gwmg', 'jeep'];
const ROW3 = [['pkw', 0], ['pkw', 1], ['pkw', 2], ['transporter', 0], ['zugmaschine', 0], ['stapler', 0]];
export const BAYS = [
  ...ROW1.map((type, i) => ({ id: 'hof1-' + i, type, x: -108 + i * 18, z: 124, yaw: PI, area: 'hof' })),
  ...ROW2.map((type, i) => ({ id: 'hof2-' + i, type, x: -63 + i * 18, z: 168, yaw: PI, area: 'hof' })),
  ...ROW3.map(([type, variant], i) => ({ id: 'hof3-' + i, type, variant, x: -45 + i * 18, z: 210, yaw: 0, area: 'hof' })),
  ...['mbt', 'kk', 'wk2h', 'wk2', 'lp21', 'spz'].map((type, i) => ({ id: 'fl-' + i, type, x: TANK_X[i], z: FIRE_Z - 4, yaw: 0, area: 'schiessbahn' })),
  // Jets auf der Bahn am Rollweg, Nase nach Westen (740 m Startstrecke bis zur Schwelle 09)
  { id: 'jet-1', type: 'jet', x: 720, z: RUNWAY.z + 10, yaw: Q, area: 'flugfeld' },
  { id: 'jet-2', type: 'jet', x: 690, z: RUNWAY.z - 10, yaw: Q, area: 'flugfeld', minQuality: 'medium' },
  ...HELIPADS.map(([x, z], i) => ({ id: 'heli-' + i, type: 'heli', x, z, yaw: 0, area: 'flugfeld', minQuality: i ? 'medium' : null })),
];
/** Ziel-Panzer der Schießbahn (echte Fahrzeuge ohne Besatzung, heilen nach jedem Treffer). */
export const TARGET_TANKS = [
  { id: 'zp-500', type: 'wk2', x: -1050, d: 500, yaw: PI },
  { id: 'zp-1000', type: 'kk', x: -950, d: 1000, yaw: Q, minQuality: 'medium' },
  { id: 'zp-1500', type: 'mbt', x: -1040, d: 1500, yaw: PI },
  { id: 'zp-2000', type: 'wk2h', x: -980, d: 2000, yaw: -Q, minQuality: 'medium' },
].map((t) => ({ ...t, z: FIRE_Z - t.d }));

/** Teleport-Tafeln: Lage, Ziel. Vorplatz des Schießstands = Drehkreuz, in jedem Bereich eine Tafel zurück. */
export const BOARDS = [
  ...['hof', 'strecke', 'schiessbahn', 'flugfeld', 'zielgebiet'].map((to, i) => ({ x: -10 + i * 5, z: 46.6, ry: PI, to })),
  { x: 6, z: 233.5, ry: PI, to: 'stand' }, { x: -6, z: 233.5, ry: PI, to: 'schiessbahn' },
  { x: 205, z: 192, ry: Q, to: 'stand' }, { x: 205, z: 208, ry: Q, to: 'hof' },
  { x: -1010, z: 1232, ry: PI, to: 'stand' }, { x: -990, z: 1232, ry: PI, to: 'hof' },
  { x: 750, z: -917, ry: PI, to: 'stand' }, { x: 770, z: -917, ry: PI, to: 'zielgebiet' },
  { x: -360, z: -455, ry: PI, to: 'stand' }, { x: -340, z: -455, ry: PI, to: 'flugfeld' },
];

/** Lichtungen (Kreise) über einem Rechteck – kein Baum/Busch auf Übungsflächen (bigworld def.clearings). */
export function rectClearings(r, rad = 45) {
  const out = [], st = rad * 1.35;
  for (let z = r.z0; z <= r.z1 + 1e-6; z += st) for (let x = r.x0; x <= r.x1 + 1e-6; x += st) out.push([x, z, rad]);
  return out;
}

const lowQ = (b) => (b.lookQuality || b.quality) === 'low';
const gy = (ctx, x, z) => (ctx && ctx.hf ? ctx.hf.heightAt(x, z) : 0);

/** Teleport-Tafel (Pfosten, Kopfschild, Bodenkreis). */
function board(b, x, z, ry, to, y = 0) {
  const key = 'tp-' + to;
  if (!b.signDefs[key]) b.defineSign(key, { style: 'plate', text: 'TELEPORT', sub: AREA[to].name, bg: '#0f5f6b', fg: '#ffffff' });
  for (const s of [-0.75, 0.75]) b.box(x + Math.cos(ry) * s, y, z - Math.sin(ry) * s, 0.12, 2.0, 0.12, 'metal_painted', { tint: '#2a2e33', ...KEIN });
  b.sign(x, y + 1.45, z, 1.9, 0.95, key, { ry, depth: 0.05 });
  b.decal(x, y + 0.02, z, 2.6, 2.6, 'manhole', { kind: 'paint', tint: '#26c3d4', opacity: 0.6 });
}
export function boardsIn(b, r, ctx = null) {
  for (const t of BOARDS) if (t.x >= r.x0 - 5 && t.x <= r.x1 + 5 && t.z >= r.z0 - 5 && t.z <= r.z1 + 5) board(b, t.x, t.z, t.ry, t.to, gy(ctx, t.x, t.z));
}

// ---------------------------------------------------------------------------
// Fahrzeughof
// ---------------------------------------------------------------------------
export function hof(b, names) {
  const { x0, x1, z0, z1 } = HOF;
  b.groundTiled(x0, z0, x1, z1, 'concrete_panel', { cell: 2, tint: '#b8b4aa' });
  b.defineSign('hof', { style: 'logo', text: 'FAHRZEUGHOF', sub: 'Übungsgelände Nullpunkt · alle Muster zum Einsteigen', bg: '#16191d', fg: '#f2f2f0', accent: '#ff5b1f' });
  b.box(-22, 0, z0 + 1.2, 10, 0.5, 0.4, 'concrete', { tint: '#d8d4ca', minimap: false });
  for (const s of [-1, 1]) b.box(-22 + s * 4.6, 0.5, z0 + 1.2, 0.2, 3.2, 0.2, 'metal_painted', { tint: '#2a2e33', ...KEIN });
  b.sign(-22, 2.6, z0 + 1.2, 9, 1.4, 'hof', { ry: PI, depth: 0.06 });
  // Stellplätze: Linien, Nummer am Boden, Namensschild am Kopfende
  for (const bay of BAYS) {
    if (bay.area !== 'hof') continue;
    const key = 'bay-' + bay.id, n = names[bay.type] || { name: bay.type, cls: '' };
    b.defineSign(key, { style: 'plate', text: n.name, sub: n.cls, bg: '#2a2e33', fg: '#f2c230' });
    for (const s of [-1, 1]) b.decal(bay.x + s * 8.4, 0.02, bay.z, 0.35, 15, 'line', { ry: 0, tint: '#f2f0ea', kind: 'paint', opacity: 0.85 });
    const back = bay.yaw === 0 ? 1 : -1; // Kopfende hinter dem Fahrzeug
    b.decal(bay.x, 0.02, bay.z + back * 7.4, 16.8, 0.3, 'line', { ry: 0, tint: '#f2f0ea', kind: 'paint', opacity: 0.85 });
    const sz = bay.z + back * 8.6;
    for (const s of [-0.9, 0.9]) b.box(bay.x + s, 0, sz, 0.1, 1.9, 0.1, 'metal_galvanized', { ...KEIN });
    b.sign(bay.x, 1.25, sz, 2.6, 0.8, key, { ry: PI, depth: 0.04 });
  }
  // Fahrgassen-Pfeile, Beleuchtung, Leitwände am Rand, Bürocontainer, Reifenstapel
  for (const z of [146, 189]) for (const x of [-90, -30, 30, 90]) b.decal(x, 0.02, z, 3, 5, 'arrow', { ry: x < 0 ? -Q : Q, tint: '#f2c230', kind: 'paint', opacity: 0.7 });
  for (const x of [-125, -62, 0, 62, 125]) floodMast(b, x, z1 - 3, { h: 12, ry: PI, kind: 'cool' });
  for (let k = 0; k < 6; k++) jersey(b, x0 + 2 + k * 3.1, z1 - 1.2, { len: 3 });
  for (let k = 0; k < 6; k++) jersey(b, x1 - 2 - k * 3.1, z1 - 1.2, { len: 3 });
  container(b, -122, 0, 216, { ry: Q, color: '#5d7488' });
  container(b, -122, 0, 196, { ry: Q, color: '#7a6a4c' });
  if (!lowQ(b)) { tires(b, 122, 214, {}); barrelGroup(b, 124, 196, { n: 5 }); crateStack(b, 120, 226, { ry: 0.3 }); }
  b.defineSign('tankst', { style: 'plate', text: 'MUNITION & BETRIEBSSTOFF', sub: 'Im Training über das Menü: Auffüllen', bg: '#4f6b3a', fg: '#ffffff' });
  b.box(122, 0, 180, 4, 2.2, 2.2, 'metal_painted', { tint: '#4f6b3a', minimap: 'cover' });
  b.sign(119.9, 1.1, 180, 3.6, 0.9, 'tankst', { ry: -Q, depth: 0.03 });
  boardsIn(b, { x0, x1, z0, z1 });
  return {};
}

// ---------------------------------------------------------------------------
// Fahrstrecke (Geländeformen kommen aus range.js terrain.pads/dams; hier Aufbauten und Schilder)
// ---------------------------------------------------------------------------
export const STATIONS = [
  { id: 'slalom', name: 'Slalom', sub: 'Pylonen und Leitwände', x: 300, z: 250 },
  { id: 'rampe', name: 'Rampe 30 %', sub: 'hoch – Plateau – runter', x: 380, z: 300 },
  { id: 'neigung', name: 'Seitenneigung', sub: 'Schräghang 17°', x: 380, z: 230 },
  { id: 'stamm', name: 'Baumstämme', sub: 'Schwellen überfahren', x: 260, z: 370 },
  { id: 'hoecker', name: 'Höckerlinie', sub: 'Engstelle 4 m', x: 340, z: 370 },
  { id: 'stufe', name: 'Stufe', sub: '0,4 m · 0,8 m', x: 260, z: 150 },
  { id: 'steil', name: 'Steigung 35 %', sub: 'Hügel 10 m', x: 520, z: 200 },
  { id: 'sanft', name: 'Steigung 15 %', sub: 'Hügel 6 m', x: 650, z: 220 },
  { id: 'graben', name: 'Graben', sub: '2,2 m tief', x: 520, z: 420 },
  { id: 'pzgraben', name: 'Panzergraben', sub: '3 m tief, 8 m breit', x: 625, z: 420 },
  { id: 'furt', name: 'Furt', sub: 'Wassertiefe ≈ 0,8 m', x: 420, z: 560 },
  { id: 'wellen', name: 'Bodenwellen', sub: 'Rüttelstrecke', x: 674, z: 570 },
];

export function strecke(b, ctx) {
  const Y = (x, z) => gy(ctx, x, z);
  const q = lowQ(b);
  // Stationsschilder
  for (const s of STATIONS) {
    const key = 'st-' + s.id, sx = s.x - 14, sz = s.z - 22, y = Y(sx, sz);
    b.defineSign(key, { style: 'plate', text: s.name.toUpperCase(), sub: s.sub, bg: '#2a2e33', fg: '#f2c230' });
    for (const o of [-1.3, 1.3]) b.box(sx + o, y - 0.1, sz, 0.12, 2.6, 0.12, 'metal_painted', { tint: '#2a2e33', ...KEIN });
    b.sign(sx, y + 1.8, sz, 3.4, 1.0, key, { ry: PI * 0.75, depth: 0.04 });
  }
  b.defineSign('strecke', { style: 'logo', text: 'FAHRSTRECKE', sub: 'Rundkurs mit 12 Stationen · Start', bg: '#16191d', fg: '#f2f2f0', accent: '#f2c230' });
  { const y = Y(215, 182); b.box(215, y - 0.1, 182, 0.2, 3.4, 0.2, 'metal_painted', { tint: '#2a2e33', ...KEIN }); b.box(215, y - 0.1, 176, 0.2, 3.4, 0.2, 'metal_painted', { tint: '#2a2e33', ...KEIN }); b.sign(215, y + 2.4, 179, 7, 1.3, 'strecke', { ry: -Q, depth: 0.05 }); }
  // 1 Slalom: Pylonentore (Fahrzeuge) und Leitwand-Slalom (Panzer)
  for (let k = 0; k < 8; k++) {
    const z = 180 + k * 20, x = 292 + (k % 2 ? 9 : -9), y = Y(x, z);
    cone(b, x - 2.2, z, { y }); cone(b, x + 2.2, z, { y });
  }
  for (let k = 0; k < 6; k++) { const z = 175 + k * 28, x = 322 + (k % 2 ? 7 : -7); jersey(b, x, z, { len: 6, ry: Q, y: Y(x, z) }); }
  // 2 Rampe 30 %: hoch (steigt nach −z), Plateau 2 m, runter
  { const x = 380, z = 300, y = Y(x, z), h = 2, run = h / 0.3;
    b.wedge(x, y, z + 3 + run / 2, 5, h, run, 'concrete', { ry: PI, tint: '#c9c5bc', minimap: 'stairs' });
    b.box(x, y, z, 5, h, 6, 'concrete', { tint: '#c9c5bc', minimap: 'cover' });
    b.wedge(x, y, z - 3 - run / 2, 5, h, run, 'concrete', { ry: 0, tint: '#c9c5bc', minimap: 'stairs' });
    for (const s of [-1, 1]) b.decal(x + s * 2.2, y + h + 0.01, z, 0.25, 5.6, 'line', { ry: 0, tint: '#f2c230', kind: 'paint' }); }
  // 3 Seitenneigung: langer Keil quer (Hang steigt nach +x), Auf-/Abfahrt längs
  { const x = 380, z = 230, y = Y(x, z);
    b.wedge(x, y, z, 26, 2.4, 8, 'concrete', { ry: -Q, tint: '#bfbab0', minimap: 'stairs', uv: 'world' }); }
  // 4 Baumstämme (Schwellen)
  for (let k = 0; k < 6; k++) { const z = 352 + k * 6, y = Y(260, z); b.cyl(260, y + 0.22, z, 0.24 + (k % 3) * 0.04, 6, 'wood_dark', { axis: 'x', tint: '#6b543c', minimap: 'cover', seg: 10 }); }
  // 5 Höckerlinie mit 4-m-Engstelle
  for (let k = -5; k <= 5; k++) {
    if (k === 0) continue;
    const x = 340 + k * 2.2 + (k > 0 ? 1.0 : -1.0), z = 370, y = Y(x, z);
    b.cyl(x, y, z, 0.6, 1.1, 'concrete', { r1: 0.18, seg: 6, tint: '#b8b2a6', minimap: 'cover' });
  }
  // 6 Stufen 0,4 m und 0,8 m
  { const y = Y(260, 150); b.box(252, y, 150, 6, 0.4, 8, 'concrete', { tint: '#c9c5bc', minimap: 'cover' }); b.box(268, y, 150, 6, 0.8, 8, 'concrete', { tint: '#c9c5bc', minimap: 'cover' }); }
  // Graben/Panzergraben/Furt: Rand-Pfosten, Warnbaken
  for (const [x, z, w] of [[520, 420, 6], [625, 420, 10]]) for (const s of [-1, 1]) for (const dz of [-24, 24]) {
    const px = x + s * (w / 2 + 3), pz = z + dz, y = Y(px, pz);
    b.box(px, y - 0.05, pz, 0.15, 1.2, 0.15, 'metal_painted', { tint: '#c8302a', ...KEIN });
    b.box(px, y + 0.85, pz, 0.17, 0.25, 0.17, 'white', { ...VG, ao: false });
  }
  for (const dz of [-34, 34]) for (const s of [-1, 1]) { const px = 420 + s * 28, pz = 560 + dz, y = Y(px, pz); b.box(px, y - 0.05, pz, 0.15, 1.4, 0.15, 'metal_painted', { tint: '#f2c230', ...KEIN }); }
  // Pegellatte in der Furt
  { const y = Y(420, 556); b.box(420, y - 0.2, 556, 0.12, 2.4, 0.06, 'white', { tint: '#f2f0ea', ...KEIN }); for (let k = 0; k < 5; k++) b.box(420, y + k * 0.4, 555.96, 0.13, 0.2, 0.02, 'metal_painted', { tint: '#c8302a', ...VG }); }
  // Pylonen an den Kurven des Rundkurses, Flutlicht am Start
  if (!q) for (const [x, z] of [[258, 128], [470, 142], [700, 152], [742, 262], [720, 382], [705, 482], [640, 656], [300, 618], [228, 520], [220, 380]]) for (let k = 0; k < 3; k++) cone(b, x + k * 1.6, z + 6, { y: Y(x + k * 1.6, z + 6) });
  floodMast(b, 226, 168, { h: 10, ry: -Q, y: Y(226, 168) });
  boardsIn(b, STRECKE, ctx);
  return {};
}

// ---------------------------------------------------------------------------
// Panzerschießbahn
// ---------------------------------------------------------------------------
/** Statische Ziele (Kugel-BVH): Box (Mitte, halbe Ausdehnung, ry), Kennung, Entfernung. */
function regStatic(list, o) { list.push({ id: 'u' + list.length + '-' + o.kind, static: true, ...o }); }

export function schiessbahn(b, ctx) {
  const Y = (x, z) => gy(ctx, x, z);
  const q = lowQ(b), statics = [];
  // Feuerlinie: Betonband, Feuerstellungen mit Erdwall (Hinterhangstellung), Nummern, Leitstand
  b.defineSign('pzbahn', { style: 'logo', text: 'PANZERSCHIESSBAHN', sub: 'Ziele 200 bis 2500 m · Feuer nur nach Norden', bg: '#16191d', fg: '#f2f2f0', accent: '#ff5b1f' });
  const y0 = Y(-1000, FIRE_Z);
  b.boxMM(-1160, y0 - 0.3, FIRE_Z - 8, -840, y0 + 0.04, FIRE_Z + 16, 'concrete', { tint: '#b4b0a6', minimap: 'floor', grad: false });
  TANK_X.forEach((x, i) => {
    b.defineSign('fs' + (i + 1), { style: 'number', text: String(i + 1), sub: 'STELLUNG', bg: '#16191d', fg: '#f2f2f0' });
    b.wedge(x, y0, FIRE_Z - 13, 10, 1.1, 4, 'dirt', { ry: 0, minimap: 'cover', uv: 'world' });
    b.box(x + 5.8, y0, FIRE_Z - 6, 0.12, 1.8, 0.12, 'metal_painted', { tint: '#2a2e33', ...KEIN });
    b.sign(x + 5.8, y0 + 1.6, FIRE_Z - 6, 1.0, 1.0, 'fs' + (i + 1), { ry: PI });
    b.decal(x, y0 + 0.06, FIRE_Z - 2, 7, 0.4, 'line', { ry: 0, tint: '#f2c230', kind: 'paint' });
  });
  // Leitstand (Holzhütte mit Fensterband), Fahne, Lautsprechermast
  { const x = -1180, z = FIRE_Z + 8, y = Y(x, z);
    b.box(x, y, z, 8, 3, 5, 'wood_planks', { tint: '#8d7a63', minimap: 'building' });
    b.box(x, y + 3, z, 8.6, 0.25, 5.6, 'metal_painted', { tint: '#3a3f45', ...KEIN });
    b.box(x, y + 1.5, z - 2.52, 6.6, 0.9, 0.05, 'glass', { ...KEIN });
    b.sign(x, y + 2.25, z - 2.56, 6, 0.6, 'pzbahn', { ry: PI, depth: 0 });
    b.cyl(x + 7, y, z, 0.07, 9, 'metal_galvanized', { seg: 6, minimap: 'prop' });
    b.box(x + 7.6, y + 7.6, z, 1.2, 0.8, 0.04, 'polymer', { tint: '#c8302a', ...KEIN }); }
  { const x = -1000, z = FIRE_Z + 20, y = Y(x, z); b.box(x - 6, y, z, 0.25, 4.2, 0.25, 'metal_painted', { tint: '#2a2e33', ...KEIN }); b.box(x + 6, y, z, 0.25, 4.2, 0.25, 'metal_painted', { tint: '#2a2e33', ...KEIN }); b.sign(x, y + 3.2, z, 13, 1.6, 'pzbahn', { ry: PI, depth: 0.05 }); }
  for (const x of [-1150, -850]) floodMast(b, x, FIRE_Z + 14, { h: 12, ry: PI, y: Y(x, FIRE_Z + 14) });
  // Entfernungstafeln beidseits (groß, aus der Optik lesbar) und Markierungspfosten auf der Bahnmitte
  for (const d of TANK_DIST) {
    const z = FIRE_Z - d, key = 'pd' + d;
    b.defineSign(key, { style: 'number', text: d + ' m', bg: '#f2f0ea', fg: '#16191d' });
    const sc = 1 + d / 900;
    for (const x of [-1250, -750]) {
      const y = Y(x, z);
      b.box(x, y, z, 0.3 * sc, 2.2 * sc, 0.3 * sc, 'metal_painted', { tint: '#2a2e33', minimap: false });
      b.sign(x, y + 2.2 * sc, z + 0.2 * sc, 3.2 * sc, 1.6 * sc, key, { ry: 0, depth: 0.05 });
    }
  }
  // Ziele je Entfernung
  TANK_DIST.forEach((d, row) => {
    const z = FIRE_Z - d;
    // Zielscheiben (Panzer-Umriss) – zwei je Reihe, versetzt
    for (const k of [0, 1]) {
      const x = -1180 + ((row * 97 + k * 190) % 360), y = Y(x, z), W = d >= 1000 ? 6 : 4.5, H = d >= 1000 ? 3.2 : 2.6;
      b.box(x, y, z + 0.3, 0.2, H + 0.4, 0.2, 'wood_dark', { tint: '#6b543c', ...KEIN });
      b.box(x, y + 0.4, z, W, H, 0.12, 'wood_planks', { tint: '#e9e4d6', minimap: 'cover' });
      b.box(x, y + 0.6, z - 0.08, W * 0.82, H * 0.42, 0.04, 'polymer', { tint: '#4a5a36', ...VG }); // Wanne
      b.box(x - W * 0.05, y + 0.6 + H * 0.42, z - 0.08, W * 0.4, H * 0.26, 0.04, 'polymer', { tint: '#3e4c2e', ...VG }); // Turm
      b.box(x + W * 0.3, y + 0.6 + H * 0.52, z - 0.08, W * 0.42, H * 0.06, 0.04, 'polymer', { tint: '#3e4c2e', ...VG }); // Rohr
      b.box(x, y + 0.4 + H * 0.45, z - 0.1, 0.35, 0.35, 0.03, 'polymer', { tint: '#c8302a', ...VG }); // Spiegel
      regStatic(statics, { kind: 'scheibe', name: 'Zielscheibe', distance: d, x, y: y + 0.4 + H / 2, z, hx: W / 2, hy: H / 2, hz: 0.35, ry: 0 });
    }
    // Wracks (statisch) auf 750/1250/2250 m
    if (d === 750 || d === 1250 || d === 2250) {
      const x = d === 1250 ? -1130 : -860, y = Y(x, z);
      burntWreck(b, x, y, z, 0.3 + row, d === 2250 ? 'lkw' : 'pkw', 11 + row, (px, pz) => Y(px, pz));
      regStatic(statics, { kind: 'wrack', name: 'Fahrzeugwrack', distance: d, x, y: y + 1.2, z, hx: 3.2, hy: 1.3, hz: 3.2, ry: 0 });
    }
    // Erdwall vor jeder zweiten Reihe (Ziele halb in Deckung)
    if (row % 3 === 2 && !q) { const x = -1000, y = Y(x, z + 14); b.wedge(x - 120, y, z + 14, 30, 1.2, 5, 'dirt', { ry: PI, uv: 'world', minimap: false }); b.wedge(x + 130, y, z + 14, 30, 1.2, 5, 'dirt', { ry: PI, uv: 'world', minimap: false }); }
  });
  // Schienen für die beweglichen Ziele (600 m und 1200 m)
  for (const d of [600, 1200]) {
    const z = FIRE_Z - d, y = Y(-1000, z);
    for (const s of [-0.75, 0.75]) b.box(-1000, y + 0.05, z + s, 460, 0.14, 0.12, 'metal_rust', { ...KEIN });
    for (let x = -1225; x <= -775; x += 3) b.box(x, y, z, 0.25, 0.1, 2.2, 'wood_dark', { tint: '#5a4632', ...VG });
    b.wedge(-1000, y, z + 6, 470, 0.9, 3.5, 'dirt', { ry: PI, uv: 'world', minimap: false, collide: false });
  }
  // Kugelfang im Norden (hinter 2500 m)
  { const z = FIRE_Z - 2500 - 30, y = Y(-1000, z); b.wedge(-1000, y - 0.5, z, 520, 12, 24, 'dirt', { ry: PI, uv: 'world', minimap: 'wall' }); }
  boardsIn(b, SCHIESSBAHN, ctx);
  return { statics };
}

// ---------------------------------------------------------------------------
// Flugfeld
// ---------------------------------------------------------------------------
export function flugfeld(b, ctx) {
  const Y = (x, z) => gy(ctx, x, z);
  const py = Y(560, RUNWAY.z) + 0.04;
  startbahn(b, RUNWAY, py);
  papi(b, RUNWAY.x0 + 250, RUNWAY.z - RUNWAY.w / 2 - 14, Y(RUNWAY.x0 + 250, RUNWAY.z - 36));
  windsack(b, 600, RUNWAY.z + 40, Y(600, RUNWAY.z + 40), 0.9);
  // Vorfeld + Rollweg + Hubschrauber-Landeplätze
  const ay = Y(760, -950);
  b.groundTiled(640, -1000, 880, -905, 'concrete_panel', { cell: 2, tint: '#b4b0a6', y: ay });
  for (const [x, z] of HELIPADS) {
    const y = Y(x, z);
    b.cyl(x, y - 0.05, z, 11, 0.12, 'concrete', { seg: 28, tint: '#a9a59b', minimap: 'floor' });
    b.decal(x, y + 0.09, z, 18, 18, 'manhole', { kind: 'paint', tint: '#f2f0ea', opacity: 0.8 });
    for (const s of [-1, 1]) b.box(x + s * 2.2, y + 0.07, z, 0.7, 0.02, 6, 'white', { ...VG, ao: false });
    b.box(x, y + 0.07, z, 3.7, 0.02, 0.7, 'white', { ...VG, ao: false });
  }
  b.defineSign('flugfeld', { style: 'logo', text: 'FLUGFELD', sub: 'Startbahn 09/27 · 1200 m · Hubschrauber-Landeplätze H1–H3', bg: '#16191d', fg: '#f2f2f0', accent: '#26c3d4' });
  { const x = 760, z = -903, y = Y(x, z); for (const s of [-1, 1]) b.box(x + s * 5, y, z, 0.25, 4, 0.25, 'metal_painted', { tint: '#2a2e33', ...KEIN }); b.sign(x, y + 3, z, 11, 1.5, 'flugfeld', { ry: PI, depth: 0.05 }); }
  b.defineSign('luftraum', { style: 'warning', text: 'LUFTRAUM', sub: 'Übungsraum 2,6 × 2,6 km – am Rand übernimmt der Rückkehr-Autopilot' });
  { const x = 700, z = -903, y = Y(x, z); b.box(x, y, z, 0.15, 2.4, 0.15, 'metal_painted', { tint: '#2a2e33', ...KEIN }); b.sign(x, y + 1.6, z, 3.6, 1.2, 'luftraum', { ry: PI }); }
  container(b, 880, Y(880, -925), -925, { ry: 0, color: '#d9d6cc' });
  container(b, 880, Y(880, -940), -940, { ry: 0, color: '#5d7488' });
  for (const x of [660, 760, 860]) floodMast(b, x, -905, { h: 12, ry: PI, y: Y(x, -905) });
  if (!lowQ(b)) for (let k = 0; k < 5; k++) cone(b, 655 + k * 2, -998, { y: Y(655 + k * 2, -998) });
  boardsIn(b, FLUGFELD, ctx);
  return {};
}

// ---------------------------------------------------------------------------
// Zielgebiet (Luft-Boden)
// ---------------------------------------------------------------------------
export const GROUND_TARGETS = [
  { id: 'zg-1', name: 'Zielkreis 1 (Kolonne)', x: -500, z: -800, kind: 'kolonne' },
  { id: 'zg-2', name: 'Zielkreis 2 (Bunker)', x: -320, z: -760, kind: 'bunker' },
  { id: 'zg-3', name: 'Zielkreis 3 (Containerlager)', x: -180, z: -840, kind: 'lager' },
  { id: 'zg-4', name: 'Zielkreis 4 (Stellung)', x: -420, z: -620, kind: 'stellung' },
  { id: 'zg-5', name: 'Zielkreis 5 (Wrack)', x: -200, z: -620, kind: 'wrack' },
];

export function zielgebiet(b, ctx) {
  const Y = (x, z) => gy(ctx, x, z);
  const statics = [];
  b.defineSign('zielgebiet', { style: 'warning', text: 'ZIELGEBIET', sub: 'Raketen & Bomben – nur Übungsmunition' });
  for (const t of GROUND_TARGETS) {
    const y = Y(t.x, t.z);
    // Zielkreise: Ringe (Decal) 30 m und 12 m, Kreuz aus weißen Platten
    b.decal(t.x, y + 0.05, t.z, 60, 60, 'manhole', { kind: 'paint', tint: '#f2f0ea', opacity: 0.75 });
    b.decal(t.x, y + 0.06, t.z, 24, 24, 'manhole', { kind: 'paint', tint: '#ff5b1f', opacity: 0.8 });
    for (const ry of [0, Q]) b.box(t.x, y - 0.02, t.z, 20, 0.08, 1.2, 'white', { ry, tint: '#e9e6de', ...VG, ao: false });
    if (t.kind === 'kolonne') for (let k = 0; k < 3; k++) burntWreck(b, t.x - 10 + k * 10, Y(t.x - 10 + k * 10, t.z), t.z + (k - 1) * 3, 0.2 + k * 0.4, k === 1 ? 'lkw' : 'pkw', 40 + k, (px, pz) => Y(px, pz));
    else if (t.kind === 'bunker') { b.box(t.x, y - 0.2, t.z, 7, 2.4, 6, 'concrete_dark', { tint: '#8f8b82', minimap: 'bunker' }); sandbags(b, t.x - 5, t.z - 4.5, t.x + 5, t.z - 4.5, { rows: 4, y }); }
    else if (t.kind === 'lager') { container(b, t.x - 3, y, t.z, { ry: 0.2, color: '#7a6a4c' }); container(b, t.x + 3, y, t.z + 4, { ry: -0.3, color: '#5d7488' }); container(b, t.x, y + 2.59, t.z + 1, { ry: 0.1, color: '#8a3a2a' }); }
    else if (t.kind === 'stellung') { for (const a of [0, 1, 2, 3]) sandbags(b, t.x + Math.cos(a * Q) * 5, t.z + Math.sin(a * Q) * 5, t.x + Math.cos(a * Q + Q) * 5, t.z + Math.sin(a * Q + Q) * 5, { rows: 4, y, double: true }); }
    else burntWreck(b, t.x, y, t.z, 1.1, 'lkw', 61, (px, pz) => Y(px, pz));
    regStatic(statics, { kind: 'boden', name: t.name, ground: true, radius: 15, x: t.x, y: y + 1.2, z: t.z, hx: 6, hy: 2.5, hz: 6, ry: 0 });
  }
  // Beobachtungsbunker am Südrand, Warnschilder
  { const x = -392, z = -474, y = Y(x, z);
    b.box(x, y - 0.2, z, 12, 2.6, 6, 'concrete_dark', { tint: '#8f8b82', minimap: 'bunker' });
    b.box(x, y + 1.4, z - 3.02, 9, 0.5, 0.06, 'black', { ...KEIN });
    b.sign(x, y + 2.7, z - 3.1, 6, 1.6, 'zielgebiet', { ry: PI, depth: 0.04 }); }
  for (const [x, z] of [[-610, -700], [-90, -700], [-350, -910]]) { const y = Y(x, z); b.box(x, y, z, 0.15, 2.2, 0.15, 'metal_painted', { tint: '#2a2e33', ...KEIN }); b.sign(x, y + 1.6, z, 3.4, 1.1, 'zielgebiet', { ry: x < -500 ? -Q : x > -100 ? Q : 0 }); }
  boardsIn(b, ZIELGEBIET, ctx);
  return { statics };
}

// ---------------------------------------------------------------------------
// Laufzeit: bewegte Ziele, Trefferprüfung, Raycast-Hülle
// ---------------------------------------------------------------------------
const _m = new THREE.Matrix4(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _ray = new THREE.Ray(), _box = new THREE.Box3(), _hp = new THREE.Vector3(), _v = new THREE.Vector3();

/** Strahl gegen Trefferboxen ({ hittable(), hitboxes: [{ object, min, max, zone }] }) → bester Treffer oder best. */
function rayTargets(list, origin, dir, maxDist, best) {
  for (const t of list) {
    if (!t || (t.hittable && !t.hittable()) || !t.hitboxes) continue;
    for (const hb of t.hitboxes) {
      _m.copy(hb.object.matrixWorld).invert();
      _o.copy(origin).applyMatrix4(_m);
      _d.copy(dir).transformDirection(_m);
      _ray.set(_o, _d);
      _box.set(hb.min, hb.max);
      if (!_ray.intersectBox(_box, _hp)) continue;
      _hp.applyMatrix4(hb.object.matrixWorld);
      const dist = _hp.distanceTo(origin);
      if (dist > maxDist || (best && dist >= best.distance)) continue;
      best = { distance: dist, point: _hp.clone(), normal: dir.clone().negate(), surface: t.surface || 'metal', object: hb.object, targetId: t.id, zone: hb.zone };
    }
  }
  return best;
}

/**
 * Großkarte: world.raycast um Trefferboxen erweitern – world.targets (Klappziele, Trophy-System) und world.uebungDyn
 * (bewegte Ziele des Übungsgeländes). Einmal je Welt.
 */
export function installTargetRaycast(world) {
  if (world._targetRay) return;
  const orig = world.raycast;
  world.uebungDyn = world.uebungDyn || [];
  world._targetRay = true;
  world.raycast = function raycastUebung(origin, dir, maxDist = 1000) {
    let best = orig.call(world, origin, dir, maxDist);
    if (world.targets && world.targets.length) best = rayTargets(world.targets, origin, dir, best ? best.distance : maxDist, best) || best;
    if (world.uebungDyn.length) best = rayTargets(world.uebungDyn, origin, dir, best ? best.distance : maxDist, best) || best;
    return best;
  };
}

/** Punkt in Box (Mitte x/y/z, halbe Ausdehnung hx/hy/hz, Drehung ry) mit Zugabe pad? */
function inBox(t, p, pad) {
  const dx = p.x - t.x, dz = p.z - t.z, c = Math.cos(t.ry || 0), s = Math.sin(t.ry || 0);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) <= t.hx + pad && Math.abs(p.y - t.y) <= t.hy + pad && Math.abs(lz) <= t.hz + pad;
}

/** Werkstoffe der bewegten Ziele (ohne Texturen: kein zusätzlicher Sampler). */
function mats() {
  const mk = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...o }); m.userData.disposable = true; return m; };
  return {
    board: mk('#e9e4d6'), olive: mk('#4a5a36'), red: mk('#c8302a', { roughness: 0.5 }), orange: mk('#ff6a1a', { roughness: 0.45 }),
    dark: mk('#2a2e33', { metalness: 0.5, roughness: 0.5 }), card: mk('#b89b6a', { roughness: 0.9 }),
    mark: (() => { const m = new THREE.MeshBasicMaterial({ color: '#ffd24a', fog: false, transparent: true, opacity: 0.95, depthWrite: false }); m.userData.disposable = true; return m; })(),
  };
}

/** Pappkamerad-Umriss (Pivot = Fuß), lokal ±0,28 m breit. */
function cardGeom() {
  const s = new THREE.Shape();
  s.moveTo(-0.05, 0); s.lineTo(0.05, 0); s.lineTo(0.05, 0.5); s.lineTo(0.27, 0.56); s.lineTo(0.27, 1.2); s.lineTo(0.09, 1.28);
  s.absarc(0, 1.42, 0.13, -PI / 2 + 0.5, PI * 1.5 - 0.5, false);
  s.lineTo(-0.27, 1.2); s.lineTo(-0.27, 0.56); s.lineTo(-0.05, 0.5); s.lineTo(-0.05, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -0.01);
  return g;
}

/**
 * Bewegte Ziele der Panzerschießbahn (Schienenziele, Pappkameraden) und des Luftraums (Ballons, Zieldrohnen) anlegen.
 * → { group, dyn: [...], update(dt), reset(), dispose() }
 */
export function createDynamicTargets(world, quality) {
  const M = mats(), group = new THREE.Group();
  group.name = 'uebung-ziele';
  const H = (x, z) => (typeof world.heightAt === 'function' ? world.heightAt(x, z) : 0);
  const dyn = [], geos = [];
  const low = quality === 'low';
  const addGeo = (g) => { geos.push(g); return g; };
  const boxG = addGeo(new THREE.BoxGeometry(1, 1, 1));
  // Schienenziele: Schlitten mit Panzer-Umriss (6 × 3 m), fährt hin und her
  for (const [d, speed, x0] of [[600, 6, -1100], [1200, 9, -900]]) {
    const z = FIRE_Z - d, root = new THREE.Object3D();
    root.position.set(x0, H(x0, z) + 0.2, z);
    const sled = new THREE.Mesh(boxG, M.dark); sled.scale.set(3, 0.4, 2); sled.position.y = 0.2; root.add(sled);
    const pl = new THREE.Mesh(boxG, M.board); pl.scale.set(6, 3, 0.12); pl.position.y = 2.0; root.add(pl);
    const hull = new THREE.Mesh(boxG, M.olive); hull.scale.set(5, 1.2, 0.04); hull.position.set(0, 1.4, -0.08); root.add(hull);
    const tur = new THREE.Mesh(boxG, M.olive); tur.scale.set(2.4, 0.8, 0.04); tur.position.set(-0.3, 2.4, -0.08); root.add(tur);
    const gun = new THREE.Mesh(boxG, M.olive); gun.scale.set(2.6, 0.18, 0.04); gun.position.set(1.9, 2.55, -0.08); root.add(gun);
    for (const c of root.children) { c.castShadow = !low; c.receiveShadow = true; }
    group.add(root);
    const st = { dir: 1, flash: 0 };
    const t = {
      id: 'ud-rail' + d, kind: 'schiene', name: 'Bewegliches Ziel', distance: d, surface: 'wood', object: root, moving: true,
      hittable: () => true,
      hitboxes: [{ object: root, min: new THREE.Vector3(-3, 0.4, -0.2), max: new THREE.Vector3(3, 3.5, 0.2), zone: 'body' }],
      center: (out) => out.copy(root.position).setY(root.position.y + 2),
      onHit() { st.flash = 0.25; },
      update(dt) {
        root.position.x += st.dir * speed * dt;
        if (root.position.x > -800) { root.position.x = -800; st.dir = -1; }
        if (root.position.x < -1200) { root.position.x = -1200; st.dir = 1; }
        if (st.flash > 0) { st.flash -= dt; pl.material = st.flash > 0 ? M.orange : M.board; }
        root.updateMatrixWorld(true);
      },
      reset() { st.flash = 0; pl.material = M.board; },
    };
    root.updateMatrixWorld(true);
    dyn.push(t);
  }
  // Pappkameraden (Gruppen auf 200–800 m): klappen nach Treffer um, stehen nach 4 s wieder
  const cg = addGeo(cardGeom());
  const groups = low ? [[200, -1110], [400, -900], [750, -1040]] : [[200, -1110], [300, -880], [400, -1000], [500, -1180], [750, -1040], [1000, -820]];
  for (const [d, cx] of groups) {
    const z = FIRE_Z - d, n = d >= 750 ? 5 : 3;
    for (let k = 0; k < n; k++) {
      const x = cx + (k - (n - 1) / 2) * 2.4, pivot = new THREE.Object3D();
      pivot.position.set(x, H(x, z), z);
      const mesh = new THREE.Mesh(cg, M.card); mesh.scale.setScalar(d >= 750 ? 1.15 : 1); mesh.castShadow = !low; pivot.add(mesh);
      group.add(pivot);
      const st = { angle: 0, goal: 0, back: 0 };
      const t = {
        id: `ud-pk${d}-${k}`, kind: 'pappe', name: 'Pappkamerad', distance: d, surface: 'wood', object: pivot,
        hittable: () => st.angle > -0.6,
        hitboxes: [{ object: pivot, min: new THREE.Vector3(-0.3, 0.45, -0.06), max: new THREE.Vector3(0.3, 1.6, 0.06), zone: 'body' }],
        center: (out) => out.copy(pivot.position).setY(pivot.position.y + 1),
        onHit() { st.goal = -Q; st.back = 4; },
        update(dt) {
          if (st.back > 0 && (st.back -= dt) <= 0) st.goal = 0;
          const sp = 6 * dt, prev = st.angle;
          st.angle += Math.max(-sp, Math.min(sp, st.goal - st.angle));
          if (prev !== st.angle) { pivot.rotation.x = st.angle; pivot.updateMatrixWorld(true); }
        },
        reset() { st.goal = 0; st.back = 0; },
      };
      pivot.updateMatrixWorld(true);
      dyn.push(t);
    }
  }
  // Ballons (gefesselt, 60–220 m über Grund) und Zieldrohnen (Kreisbahnen) über dem Zielgebiet/Flugfeld
  const sph = addGeo(new THREE.SphereGeometry(1, low ? 10 : 16, low ? 8 : 12));
  const lineMat = new THREE.LineBasicMaterial({ color: '#30343a', transparent: true, opacity: 0.6 }); lineMat.userData.disposable = true;
  const balloons = low ? [[-450, -700, 80], [0, -700, 140], [350, -800, 200], [-200, -900, 110]] : [[-450, -700, 80], [-150, -650, 120], [0, -700, 140], [200, -600, 90], [350, -800, 200], [-200, -900, 110], [550, -700, 170], [-600, -880, 220]];
  balloons.forEach(([x, z, alt], i) => {
    const g0 = H(x, z), root = new THREE.Object3D();
    root.position.set(x, g0 + alt, z);
    const ball = new THREE.Mesh(sph, i % 2 ? M.red : M.orange); ball.scale.setScalar(2.6); root.add(ball);
    group.add(root);
    const lg = addGeo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, g0, z), new THREE.Vector3(x, g0 + alt - 2.6, z)]));
    const line = new THREE.Line(lg, lineMat); line.frustumCulled = false; group.add(line);
    const st = { down: 0, t: i * 1.3 };
    dyn.push({
      id: 'ud-ballon' + i, kind: 'ballon', name: 'Ballon', air: true, alt, surface: 'cloth', object: root,
      hittable: () => st.down <= 0,
      hitboxes: [{ object: root, min: new THREE.Vector3(-2.2, -2.2, -2.2), max: new THREE.Vector3(2.2, 2.2, 2.2), zone: 'body' }],
      center: (out) => out.copy(root.position),
      radius: 3.2,
      onHit() { st.down = 20; root.visible = false; line.visible = false; },
      update(dt) {
        st.t += dt;
        if (st.down > 0 && (st.down -= dt) <= 0) { root.visible = true; line.visible = true; }
        root.position.x = x + Math.sin(st.t * 0.21) * 1.5; root.position.z = z + Math.cos(st.t * 0.17) * 1.5;
        root.updateMatrixWorld(true);
      },
      reset() { st.down = 0; root.visible = true; line.visible = true; },
    });
  });
  const drones = low ? [[0, -650, 260, 160, 38]] : [[0, -650, 260, 160, 38], [-350, -750, 180, 240, 30], [400, -500, 320, 300, 46]];
  drones.forEach(([cx, cz, R, alt, v], i) => {
    const root = new THREE.Object3D();
    const body = new THREE.Mesh(boxG, M.orange); body.scale.set(0.5, 0.45, 3.2); root.add(body);
    const wing = new THREE.Mesh(boxG, M.orange); wing.scale.set(4.2, 0.08, 0.7); wing.position.z = -0.2; root.add(wing);
    const tail = new THREE.Mesh(boxG, M.dark); tail.scale.set(1.4, 0.06, 0.4); tail.position.z = 1.4; root.add(tail);
    const fin = new THREE.Mesh(boxG, M.dark); fin.scale.set(0.06, 0.6, 0.4); fin.position.set(0, 0.3, 1.4); root.add(fin);
    group.add(root);
    const st = { a: i * 2.1, down: 0, fall: 0, vy: 0 };
    const place = () => {
      const x = cx + Math.cos(st.a) * R, z = cz + Math.sin(st.a) * R;
      root.position.set(x, H(x, z) + alt, z);
      root.rotation.set(0, -st.a, 0); // Nase in Flugrichtung (Tangente)
    };
    place();
    dyn.push({
      id: 'ud-drohne' + i, kind: 'drohne', name: 'Zieldrohne', air: true, alt, surface: 'metal', object: root,
      hittable: () => st.down <= 0,
      hitboxes: [{ object: root, min: new THREE.Vector3(-2.2, -0.35, -1.8), max: new THREE.Vector3(2.2, 0.45, 1.8), zone: 'body' }],
      center: (out) => out.copy(root.position),
      radius: 6,
      onHit() { st.down = 25; st.fall = 1; st.vy = 0; },
      update(dt) {
        if (st.down > 0) {
          st.down -= dt;
          if (st.fall) { st.vy -= 9.81 * dt; root.position.y += st.vy * dt; root.rotation.z += dt * 3; const g = H(root.position.x, root.position.z); if (root.position.y < g + 0.3) { st.fall = 0; root.visible = false; } }
          if (st.down <= 0) { root.visible = true; root.rotation.z = 0; place(); }
        } else { st.a += (v / R) * dt; place(); }
        root.updateMatrixWorld(true);
      },
      reset() { st.down = 0; st.fall = 0; root.visible = true; root.rotation.z = 0; place(); },
    });
  });
  for (const o of group.children) o.traverse?.((c) => { if (c.isMesh) c.receiveShadow = !low; });
  // Trefferbild: leuchtende Marken an den letzten Einschlägen (bleiben 8 s, wachsen mit dem Abstand zur Kamera)
  const marks = [];
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(sph, M.mark); m.visible = false; m.renderOrder = 8; m.frustumCulled = false; group.add(m); marks.push({ m, t: 0 }); }
  let mi = 0;
  return {
    group, dyn,
    mark(p, color = '#ffd24a') { const k = marks[mi++ % marks.length]; k.m.position.copy(p); k.m.visible = true; k.t = 8; k.m.material.color.set(color); },
    update(dt, camera) {
      for (const t of dyn) t.update(dt);
      for (const k of marks) {
        if (!k.m.visible) continue;
        if ((k.t -= dt) <= 0) { k.m.visible = false; continue; }
        const dist = camera ? _v.copy(k.m.position).distanceTo(camera.position) : 50;
        k.m.scale.setScalar(Math.max(0.12, dist * 0.0011) * Math.min(1, k.t / 1.5 + 0.3));
      }
    },
    reset() { for (const t of dyn) t.reset(); for (const k of marks) k.m.visible = false; },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); for (const m of Object.values(M)) m.dispose?.(); lineMat.dispose(); },
  };
}

/**
 * Trefferprüfung des Übungsgeländes (einmal je Welt): Kugeln und Explosionen gegen statische und bewegte Ziele →
 * 'uebung:hit'. Bodenziele melden zusätzlich die Ablage vom Mittelpunkt (Bomben/Raketen).
 */
export function installHitTest(world, G, U) {
  if (U._hitOff) return;
  const center = new THREE.Vector3();
  const emit = (target, point, shooter, weaponId, kind, extra = {}) => {
    try { G.events.emit('uebung:hit', { target, point: point.clone ? point.clone() : new THREE.Vector3(point.x, point.y, point.z), shooter, weaponId, kind, ...extra }); } catch { /* UI */ }
  };
  const onImpact = (e) => {
    if (!e || !e.point || e.cosmetic || e.exit || !e.shooter) return;
    const p = e.point;
    for (const t of world.uebungDyn) {
      if (!t.hittable()) continue;
      for (const hb of t.hitboxes) {
        _m.copy(hb.object.matrixWorld).invert();
        _v.copy(p).applyMatrix4(_m);
        if (_v.x < hb.min.x - 0.15 || _v.x > hb.max.x + 0.15 || _v.y < hb.min.y - 0.15 || _v.y > hb.max.y + 0.15 || _v.z < hb.min.z - 0.2 || _v.z > hb.max.z + 0.2) continue;
        t.onHit(p); emit(t, p, e.shooter, e.weaponId, 'kugel'); U.mark?.(p);
        return;
      }
    }
    for (const t of U.statics) if (!t.ground && inBox(t, p, 0.15)) { emit(t, p, e.shooter, e.weaponId, 'kugel'); U.mark?.(p); return; }
  };
  const onExplosion = (e) => {
    if (!e || !e.position || !e.attacker) return;
    const p = e.position, r = e.radius || 4;
    let hit = null, best = Infinity;
    for (const t of world.uebungDyn) {
      if (!t.hittable()) continue;
      t.center(center);
      const d = center.distanceTo(p), lim = t.air ? Math.max(t.radius || 3, r * 0.6) : 1.6;
      if (d < lim && d < best) { best = d; hit = t; }
    }
    if (hit) { hit.onHit(p); emit(hit, p, e.attacker, e.weaponId, 'explosion', { offset: best }); U.mark?.(p, '#ff7a2a'); return; }
    for (const t of U.statics) {
      if (t.ground) {
        const d = Math.hypot(p.x - t.x, p.z - t.z);
        if (d <= t.radius + r && Math.abs(p.y - t.y) < 12) { emit(t, p, e.attacker, e.weaponId, 'explosion', { offset: d }); U.mark?.(p, '#ff7a2a'); return; }
      } else if (inBox(t, p, 1.2)) { emit(t, p, e.attacker, e.weaponId, 'explosion'); U.mark?.(p, '#ff7a2a'); return; }
    }
  };
  const a = G.events.on('impact', onImpact), b = G.events.on('explosion', onExplosion);
  U._hitOff = () => { (typeof a === 'function' ? a : () => G.events.off?.('impact', onImpact))(); (typeof b === 'function' ? b : () => G.events.off?.('explosion', onExplosion))(); };
}

/** Gemeinsamer Zustand des Übungsgeländes an der Welt (world.uebung): Bereiche, Tafeln, Stellplätze, Ziele. */
export function uebungOf(world) {
  if (!world.uebung) {
    world.uebung = {
      areas: AREA, boards: BOARDS, bays: BAYS, targetTanks: TARGET_TANKS, stations: STATIONS, groundTargets: GROUND_TARGETS,
      firingLine: { z: FIRE_Z, x0: -1160, x1: -840 }, runway: RUNWAY,
      statics: [], dynamic: null, mark: null,
      resetTargets() { this.dynamic?.reset(); },
    };
  }
  return world.uebung;
}

export { hash01 };
