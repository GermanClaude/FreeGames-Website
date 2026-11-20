// NULLPUNKT — Riesenkarte „Weitmark“ (riesen 20.11.) (Owner: world). NUR IN DER APP (MAPS.weitmark.appOnly,
// shared/appgate.js): Desktop-App und Android-App; Browser, Handy-Browser, Web-App und VR-Browser sehen sie gesperrt.
//
// Spielfläche 1600 × 1600 m = 2,56 km² – 4,35 × der bisher größten Karte (Flugplatz 980 × 600 m = 0,59 km²), 7,1 ×
// Niemandsland (600 × 600 m), doppelte Kantenlänge der größten quadratischen Karte. Frei erfundenes Flusstal:
//   · Kleinstadt Kesselbrück beiderseits der Weitach – Marktplatz mit Rathaus und Kirche (West), Bahnhof (Ost),
//     zwei Straßenbrücken (Steinbrücke, Südbrücke), Wohnstraßen mit betretbaren Häusern
//   · Dörfer Lindhof (Südwest) und Hohenried (Nordost) mit Höfen, Scheunen, Kapelle bzw. Gasthof
//   · Sägewerk mit Güterbahnhof (Nordwest) und Ziegelei mit Ringofen-Schornstein (Südost) als Industriegebiete
//   · Hügelkette im Norden mit Funkstation auf dem Kamm, der Fluss bricht in einer Schlucht hindurch
//   · Segelflugfeld im Süden (Startbahn 680 m: Jets starten vom Boden), Hangars, Flugleitung
//   · große Wälder, Feldwege, zwei Furten, Kleinrelief als Deckung
// Eroberung (7 Flaggen A–G), Herrschaft (3), Teamkampf/Jeder gegen jeden in der Stadt, Panzermodus.
// Team A (Westen, Gefechtsstand West) gegen Team B (Osten, Gefechtsstand Ost).
// Koordinaten: x Osten, z Süden (Norden = −z). Geladen von world/terrain/bigworld.js (Riesenkarte: def.giant).
import { altbau } from './stadtkern-bau.js?v=20261115041504';
import { hangar, startbahn, windsack, hauptquartier, schulflugzeug, armeeLkw } from './flugplatz-bau.js?v=20261115041504';
import { mgNest } from './grenzland-stellungen.js?v=20261115041504';
import { burntWreck } from './brandwald-bau.js?v=20261115041504';
import { haus, scheune, kirche, rathaus, bruecke, halle, schornstein, holzpolter, gleis, gueterwagen, funkstation, flugleitung, strom, ortsstrasse, hofstelle, anbau, gartenzaun } from './weitmark-bau.js?v=20261115041504';
import { sandbags, crateStack, barrelGroup, palletStack, container, lampPost, car, jersey, bench, marketStall, cafeTable } from '../props.js?v=20261115041504';
import { strommast, leitungen, freileitung } from '../kleinkram.js?v=20261115041504';
import { belebe, sperrpunkte } from '../kleinkram.js?v=20261115041504';
import { reliefAvoid } from '../terrain/relief.js?v=20261115041504';

const PI = Math.PI, Q = PI / 2;
const BRIDGE_Y = 0.8;
const FUNK_Y = 34;                 // Plateau der Funkstation auf dem Kamm
const RUNWAY = { x0: -480, x1: 200, z: 600, w: 30, y: 0, heading: [1, 0], name: '09/27' };
const HQ = { A: { x: -700, z: -40, s: 1 }, B: { x: 700, z: 40, s: -1 } };
// Steinbrücke (Landstraße) und Südbrücke überspannen die Weitach (Wasser x ≈ −3…19, Ufer bis −13/29)
const BR = { stein: { x0: -34, x1: 50, z: -20 }, sued: { x0: -34, x1: 50, z: 130 } };

/** Gefechtsstand-Anordnung einer Seite (wie Flugplatz: Hubschrauber, Panzer, Geländewagen, Startpunkte). */
function hqLayout(side) {
  const { x, z, s } = HQ[side];
  return {
    helis: [[x + 18 * s, z - 22], [x + 18 * s, z + 4]],
    tanks: [[x - 22 * s, z + 34], [x - 13 * s, z + 34]],
    jeeps: [[x - 2 * s, z + 34], [x + 6 * s, z + 34], [x + 14 * s, z + 34]],
    spawns: [[x - 22, z + 20], [x - 14, z + 20], [x - 6, z + 20], [x + 2, z + 20], [x + 10, z + 20], [x - 18, z + 25], [x - 2, z + 25], [x + 6, z + 25]].map(([px, pz]) => [px, pz, s > 0 ? -Q : Q]),
  };
}
const LA = hqLayout('A'), LB = hqLayout('B');

// ---------------------------------------------------------------------------
// Ortschaften
// ---------------------------------------------------------------------------
/** Gemeinsames Leben (Kleinkram an Fassaden, Einrichtung leerer Räume); Flaggen/Startpunkte bleiben frei. */
function leben(b, stil, einrichten = true) {
  belebe(b, { stil, einrichten, sperr: sperrpunkte(WEITMARK, (WEITMARK.flags.cq || []).map((f) => [f.x, f.z, 5])) });
  return {};
}

/** Freiflächen um Flaggen/Startpunkte als Rechtecke (Häuserreihen halten Abstand). */
function freiUm(pts, r) { return pts.map(([x, z]) => [x - r, z - r, x + r, z + r]); }

// weit2: Straßenachsen der Stadt (gekrümmt, dem Fluss/Gelände folgend) – dieselben Punkte für Gelände-Straßen und Häuser
const STR = {
  kirch: [[-160, -160], [-150, -120], [-139, -82], [-143, -46], [-140, -20], [-145, 22], [-151, 58], [-142, 98], [-133, 130], [-140, 160]],
  ufer: [[-36, -160], [-45, -112], [-52, -64], [-50, -20], [-46, 36], [-49, 88], [-55, 130], [-62, 160]],
  garten: [[-236, 94], [-196, 86], [-151, 72], [-104, 82], [-56, 78]],
  sued: [[-236, 141], [-192, 135], [-140, 130], [-36, 130]],
  muehl: [[-139, -66], [-112, -60], [-82, -69], [-54, -64]],
  schul: [[-196, -160], [-205, -112], [-198, -64], [-201, -21]],
  linden: [[-200, -17], [-210, 26], [-199, 70], [-196, 86]],
  bahnhof: [[120, -160], [127, -112], [119, -62], [120, -20], [114, 30], [120, 80], [128, 130], [124, 160]],
  uferost: [[54, -150], [62, -102], [66, -44], [64, -20], [60, 38], [64, 90], [60, 130]],
  kirchweg: [[124, -78], [152, -86], [188, -78]],
  rosen: [[122, 84], [156, 76], [190, 86]],
  suedost: [[128, 130], [168, 137], [236, 131]],
};
const GARTENBAUM = []; // Obst-/Hausbäume aus den Gärten (Vegetation, Liste wird beim Bau der ersten Ortschaft neu gefüllt)

function stadtWest(b) {
  const rand = strom(5101);
  GARTENBAUM.length = 0;
  b.defineSign('ortsschild_kb', { style: 'plate', text: 'KESSELBRÜCK', sub: 'Kreis Weitmark', bg: '#f2c230', fg: '#1c1c1c' });
  // Marktplatz (Pflaster), Gehwege an der Landstraße
  b.groundTiled(-128, -16, -72, 26, 'paving', { cell: 1, tint: '#c4bcae' });
  b.groundTiled(-236, -27, -38, -24, 'paving', { cell: 1, tint: '#bdb5a6', collide: false });
  b.groundTiled(-236, -16, -130, -13, 'paving', { cell: 1, tint: '#bdb5a6', collide: false });
  // Rathaus (Nordseite der Landstraße), Kirche (West), Altbauten (Südseite des Platzes)
  rathaus(b, -100, -38, { door: 's' });
  kirche(b, -176, 36, { tint: '#e3ddcf' });
  altbau(b, { x: -118, zs: 30, s: 1, w: 16, d: 12, floors: 3, shop: 'baecker', gate: 'w', core: 'e', roof: 'access', nr: 3, sideWin: 'w' });
  altbau(b, { x: -100, zs: 30, s: 1, w: 16, d: 12, floors: 3, shop: null, gate: null, core: 'w', roof: 'flat', nr: 5 });
  altbau(b, { x: -82, zs: 30, s: 1, w: 16, d: 12, floors: 3, shop: 'eisen', gate: 'e', core: 'w', roof: 'access', nr: 7, sideWin: 'e' });
  markt(b);
  b.box(-44, 0, -25.5, 0.1, 2.2, 0.1, 'metal_painted', { tint: '#5a5f66', minimap: false, collide: false });
  b.sign(-44, 1.4, -25.4, 1.8, 0.7, 'ortsschild_kb', {});
  // gewachsene Wohnstraßen (weitmark-bau.js ortsstrasse): versetzte Fluchten, Gärten, Anbauten, Garagen
  const taken = [[-130, -47, -70, 44], [-191, 14, -159, 54], [-131, -48, -69, -28]];
  const free = [[-240, -24.5, -30, -15.5], ...freiUm([[-100, 4], [-176, 36], [-140, 150]], 8)];
  const W = { rand, taken, free, baeume: GARTENBAUM };
  ortsstrasse(b, { ...W, pts: STR.kirch, road: 3.5, sides: [-1, 1], zwei: 0.65, fachwerk: 0.35 });
  ortsstrasse(b, { ...W, pts: STR.ufer, road: 3, sides: [1], zwei: 0.7, fachwerk: 0.2, garten: 0.75 });
  ortsstrasse(b, { ...W, pts: [[-236, -20], [-150, -20]], road: 3.5, sides: [-1, 1], zwei: 0.7, fachwerk: 0.3, garten: 0.4 });
  ortsstrasse(b, { ...W, pts: STR.garten, road: 2.8, sides: [-1, 1], zwei: 0.4, garten: 0.8, gap: [2.5, 9] });
  ortsstrasse(b, { ...W, pts: STR.sued, road: 3.5, sides: [-1, 1], zwei: 0.5, garage: 0.35 });
  ortsstrasse(b, { ...W, pts: STR.muehl, road: 2.4, sides: [-1, 1], zwei: 0.8, fachwerk: 0.5, garten: 0.3, vorgarten: 1, gap: [0.8, 3] });
  ortsstrasse(b, { ...W, pts: STR.schul, road: 3, sides: [-1, 1], zwei: 0.5, garage: 0.3 });
  ortsstrasse(b, { ...W, pts: STR.linden, road: 2.8, sides: [-1], zwei: 0.45, garten: 0.8 });
  // Barrikaden an der Brückenzufahrt, MG-Nest am Rathaus
  for (let k = 0; k < 3; k++) jersey(b, -40, -16 + k * 3.1, { len: 3, ry: Q });
  mgNest(b, -60, -32, { ry: Math.atan2(1, 0) });
  return leben(b, 'stadt');
}

/** Marktplatz: Brunnen mit Becken, Linden mit Rundbänken, Marktstände, Laternen, Maibaum, parkende Autos, Deckung. */
function markt(b) {
  const MX = -100, MZ = 5;
  // Brunnen: achteckiges Becken, Wasserfläche, Säule mit Kugel
  b.cyl(MX, 0, MZ, 3.2, 0.75, 'stone_wall', { tint: '#b9b1a2', seg: 8, minimap: 'cover' });
  b.cyl(MX, 0.62, MZ, 2.85, 0.06, 'glass', { tint: '#4f6f72', seg: 8, collide: false, minimap: false, cast: false });
  b.cyl(MX, 0.75, MZ, 0.42, 2.2, 'stone_wall', { tint: '#a9a192', seg: 8, minimap: false });
  b.cyl(MX, 2.95, MZ, 0.62, 0.25, 'stone_wall', { tint: '#b3ab9c', seg: 8, collide: false, minimap: false });
  b.cyl(MX, 3.2, MZ, 0.28, 0.5, 'metal_painted', { tint: '#5f6b5a', seg: 10, collide: false, minimap: false });
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.box(MX + dx * 0.45, 1.6, MZ + dz * 0.45, 0.1 + Math.abs(dx) * 0.3, 0.08, 0.1 + Math.abs(dz) * 0.3, 'metal_painted', { tint: '#4a5048', collide: false, minimap: false });
  // Rundbänke um die vier Linden (Bäume: vegetation.trees) und Bänke am Platzrand
  for (const [tx, tz] of [[-122, -7], [-78, -7], [-122, 19], [-78, 19]]) {
    for (let k = 0; k < 4; k++) { const a = k * Q + 0.4; bench(b, tx + Math.cos(a) * 1.9, tz + Math.sin(a) * 1.9, { ry: -a + Q, back: false }); }
  }
  for (const [x, z, ry] of [[-110, -11.5, 0], [-90, -11.5, 0], [-126.5, 6, -Q], [-73.5, 6, Q]]) bench(b, x, z, { ry });
  // Marktstände (Südhälfte), Kisten und Fässer als Deckung
  const stand = [[-113, 13, 0, 0], [-104, 15, 0.08, 1], [-95, 13, -0.06, 2], [-86, 15, 0.04, 0]];
  for (const [x, z, ry, design] of stand) marketStall(b, x, z, { ry: ry + PI, design, w: 3 });
  crateStack(b, -117, 18, { ry: 0.2 }); barrelGroup(b, -83, 19, { n: 3 });
  for (const [x, z] of [[-124, -12], [-76, -12], [-124, 22], [-76, 22], [-100, -12.5], [-127, 5], [-73, 5]]) lampPost(b, x, z, {});
  // Maibaum (Kranz, Zunftschilder angedeutet)
  b.cyl(-80, 0, -1, 0.2, 24, 'wood_planks', { r1: 0.12, tint: '#c9b08a', seg: 10, minimap: 'pillar' });
  b.cyl(-80, 16, -1, 1.5, 0.35, 'grass', { r1: 1.2, tint: '#4f6b3a', seg: 12, collide: false, minimap: false });
  for (let k = 0; k < 3; k++) b.box(-80 + (k - 1) * 0.02, 8 + k * 2.4, -1.24, 0.9, 0.55, 0.05, 'wood_painted', { tint: ['#3d5a8a', '#e6dfcf', '#8a3a2c'][k], collide: false, minimap: false });
  // Sandsäcke, parkende Autos am Platzrand (nicht fahrbar – reine Kulisse), Fahrrad, Kübel
  sandbags(b, -112, 9, -107, 10, { rows: 4 }); sandbags(b, -94, -6, -88, -8, { rows: 4 });
  for (const [x, z, ry] of [[-125.5, -2, -Q], [-125.5, 11, -Q + 0.06], [-74.5, -2, Q]]) car(b, x, z, { ry, drivable: false });
  car(b, -60, -27, { ry: Q, style: 'wreck' });
}

function stadtOst(b) {
  const rand = strom(5202);
  b.defineSign('bahnhof_kb', { style: 'plate', text: 'KESSELBRÜCK', sub: 'Bahnhof', bg: '#1f3a6a', fg: '#ffffff' });
  // Bahnhof: Empfangsgebäude, Bahnsteig, zwei Gleise, abgestellte Güterwagen
  haus(b, { x: 182, z: 40, w: 22, d: 10, floors: 2, door: 'w', color: '#d8c2a6', roofTint: '#9a7e70', nutzung: 'buero' });
  b.sign(170.9, 4.2, 40, 4.8, 0.9, 'bahnhof_kb', { ry: -Q });
  b.groundTiled(196, -60, 202, 140, 'concrete_panel', { cell: 2, tint: '#a8a49a' });
  b.box(199, 0, 40, 6, 0.75, 200, 'concrete', { tint: '#b0aca2', minimap: false });
  for (let k = 0; k < 4; k++) bench(b, 199, 10 + k * 20, { y: 0.75, ry: -Q });
  for (const gx of [207, 213]) {
    b.box(gx, 0, 0, 3.2, 0.2, 300, 'gravel', { tint: '#8e877c', collide: false, minimap: false, grad: false });
    for (const s of [-1, 1]) b.box(gx + s * 0.72, 0.2, 0, 0.08, 0.14, 300, 'metal_painted', { tint: '#6a6560', collide: false, minimap: false, grad: false, ao: false });
  }
  for (const [gz, col] of [[-20, '#6b3a2c'], [-6, '#5a4a3a'], [90, '#6b3a2c']]) gueterwagenZ(b, 213, gz, col);
  // Lagerhalle am Bahnhof
  halle(b, { x: 160, z: -110, w: 30, d: 18, h: 7, doors: [{ side: 'e', at: 0, w: 5 }, { side: 'w', at: 2, w: 3 }], tint: '#8f8a80' });
  // Bahnhofsvorplatz
  b.groundTiled(140, 28, 168, 52, 'paving', { cell: 1, tint: '#bfb7a8' });
  for (const [x, z] of [[144, 30], [144, 50], [164, 30], [164, 50]]) lampPost(b, x, z, {});
  for (const [x, z, ry] of [[160, 33, Q], [160, 47, Q]]) car(b, x, z, { ry, drivable: false });
  const taken = [[168, 30, 230, 50], [140, -124, 180, -96], [194, -160, 240, 160], [138, 26, 170, 54]];
  const free = [[50, -24.5, 240, -15.5], [50, 125.5, 240, 134.5], ...freiUm([[150, 40], [100, 150]], 9)];
  const W = { rand, taken, free, baeume: GARTENBAUM };
  ortsstrasse(b, { ...W, pts: STR.bahnhof, road: 3.5, sides: [-1, 1], zwei: 0.7, fachwerk: 0.15, garage: 0.3 });
  ortsstrasse(b, { ...W, pts: STR.uferost, road: 2.5, sides: [-1], zwei: 0.4, garten: 0.75 });
  ortsstrasse(b, { ...W, pts: [[56, -20], [112, -20]], road: 3.5, sides: [-1, 1], zwei: 0.7 });
  ortsstrasse(b, { ...W, pts: [[56, 130], [112, 130]], road: 3.5, sides: [-1, 1], zwei: 0.5 });
  ortsstrasse(b, { ...W, pts: STR.kirchweg, road: 2.6, sides: [-1, 1], zwei: 0.6, fachwerk: 0.3 });
  ortsstrasse(b, { ...W, pts: STR.rosen, road: 2.6, sides: [-1, 1], zwei: 0.4, garten: 0.8 });
  ortsstrasse(b, { ...W, pts: STR.suedost, road: 3.2, sides: [-1, 1], zwei: 0.4, garage: 0.35 });
  for (let k = 0; k < 3; k++) jersey(b, 54, -24 + k * 3.1, { len: 3, ry: Q });
  barrelGroup(b, 150, 16, { n: 5 }); crateStack(b, 188, 64, { ry: 0.3 });
  car(b, 132, 70, { ry: 0.05 }); car(b, 108, -60, { ry: PI, style: 'wreck' });
  return leben(b, 'stadt');
}

/** Güterwagen entlang z (Gleise der Ostseite). */
function gueterwagenZ(b, x, z, color) {
  const L = 13, y = 0.34;
  b.box(x, y + 0.6, z, 2.8, 2.6, L, 'metal_painted', { tint: color, minimap: 'container' });
  b.box(x, y + 3.2, z, 2.9, 0.25, L, 'metal_painted', { tint: '#4a4440', collide: false, minimap: false });
  b.box(x, y + 0.2, z, 2.2, 0.4, L - 1, 'metal_painted', { tint: '#2b2a28', collide: false, minimap: false });
}

function steinbruecke(b) { bruecke(b, { ...BR.stein, y: BRIDGE_Y, w: 10, headY: 0.4 }); mgNest(b, BR.stein.x1 + 9, -30, { y: 0.1, ry: Q }); return {}; }
function suedbruecke(b) { bruecke(b, { ...BR.sued, y: BRIDGE_Y, w: 8.5, headY: 0.4 }); return {}; }

function saegewerk(b) {
  const X = -420, Z = -300;
  b.defineSign('saege', { style: 'plate', text: 'SÄGEWERK WEITACH', sub: 'Holz · Bretter · Güteranschluss', bg: '#3c4a2a', fg: '#efe6d4' });
  b.groundTiled(X - 70, Z - 45, X + 70, Z + 45, 'gravel', { cell: 2, tint: '#9b9182' });
  halle(b, { x: X - 30, z: Z - 18, w: 40, d: 22, h: 9, doors: [{ side: 's', at: -8, w: 6 }, { side: 's', at: 10, w: 6 }, { side: 'e', at: 0, w: 4 }], tint: '#7d8288' });
  halle(b, { x: X + 34, z: Z - 22, w: 26, d: 16, h: 7, doors: [{ side: 'w', at: 0, w: 5 }, { side: 's', at: 4, w: 4 }], tint: '#8c7a62', mat: 'wood_planks' });
  haus(b, { x: X + 42, z: Z + 28, w: 10, d: 8, floors: 2, door: 'n', color: '#d8cdb8', nutzung: 'buero' });
  b.sign(X + 42, 3.4, Z + 23.9, 4.6, 0.9, 'saege', { ry: PI });
  // Holzpolter (Stammlager) als Deckungsgassen, Bretterstapel, Gleis mit Rungenwagen
  for (let k = 0; k < 5; k++) holzpolter(b, X - 52 + k * 13, Z + 14, 0.05 * (k % 2 ? 1 : -1), { L: 9, rows: 3 });
  for (let k = 0; k < 4; k++) holzpolter(b, X - 46 + k * 15, Z + 32, Q, { L: 7, rows: 2 });
  for (let k = 0; k < 4; k++) palletStack(b, X + 10 + k * 4, Z + 10, { n: 4, load: 'boxes', ry: 0.1 * k });
  gleis(b, X - 70, X + 70, Z - 40);
  gueterwagen(b, X - 30, Z - 40, { color: '#6b3a2c' }); gueterwagen(b, X - 10, Z - 40, { color: '#4f4a40' }); gueterwagen(b, X + 30, Z - 40, { color: '#6b3a2c' });
  armeeLkw(b, X + 8, Z + 24, Q + 0.1);
  barrelGroup(b, X + 56, Z - 4, { n: 6 });
  return leben(b, 'industrie', false);
}

function ziegelei(b) {
  const X = 430, Z = 300;
  b.defineSign('ziegel', { style: 'plate', text: 'ZIEGELEI AM WEHR', sub: 'gegr. 1898', bg: '#7a2e22', fg: '#f2e6d4' });
  b.groundTiled(X - 70, Z - 45, X + 70, Z + 45, 'gravel', { cell: 2, tint: '#a08a76' });
  // Ringofen (lange Halle aus Ziegel), Trockenschuppen (offen), Schornstein
  halle(b, { x: X - 10, z: Z - 14, w: 48, d: 18, h: 6.5, doors: [{ side: 's', at: -14, w: 3.2 }, { side: 's', at: 0, w: 3.2 }, { side: 's', at: 14, w: 3.2 }, { side: 'n', at: 0, w: 3.2 }, { side: 'e', at: 0, w: 4 }, { side: 'w', at: 0, w: 4 }], tint: '#a5614a', mat: 'brick' });
  schornstein(b, X + 22, Z - 32, 40);
  for (let k = 0; k < 3; k++) {
    const sx = X - 40 + k * 22, sz = Z + 24;
    for (const [ax, az] of [[-8, -4], [8, -4], [-8, 4], [8, 4]]) b.box(sx + ax, 0, sz + az, 0.3, 3.4, 0.3, 'wood_dark', { tint: '#5a4636', minimap: 'pillar' });
    b.box(sx, 3.4, sz, 18, 0.2, 10, 'metal_corrugated', { tint: '#7a7470', minimap: 'roof' });
    for (let r = 0; r < 4; r++) b.box(sx - 6 + r * 4, 0, sz + (r % 2 ? 1 : -1), 2.4, 1.4 + (r % 2) * 0.4, 1.2, 'brick', { tint: '#b4644a', minimap: 'cover' });
  }
  haus(b, { x: X + 50, z: Z + 30, w: 10, d: 8, floors: 2, door: 'w', color: '#e2d9c6', nutzung: 'buero' });
  b.sign(X + 44.9, 3.4, Z + 30, 4.6, 0.9, 'ziegel', { ry: -Q });
  for (let k = 0; k < 6; k++) palletStack(b, X + 26 + (k % 3) * 4, Z + 12 + Math.floor(k / 3) * 5, { n: 3, load: 'bricks', ry: 0 });
  container(b, X - 58, 0, Z - 30, { ry: Q, color: '#56603f' });
  armeeLkw(b, X + 8, Z - 38, 0.2);
  return leben(b, 'industrie', false);
}

/** Dorf: Hofstellen (Wohnhaus + Scheune im Winkel) unregelmäßig um den Dorfplatz, gewachsene Dorfstraße mit Gärten. */
function dorf(b, X, Z, seed, name, strasse, extra) {
  const rand = strom(seed);
  b.defineSign('ort_' + seed, { style: 'plate', text: name.toUpperCase(), sub: 'Gemeinde Weitmark', bg: '#f2c230', fg: '#1c1c1c' });
  b.groundTiled(X - 16, Z - 11, X + 18, Z + 12, 'cobble', { cell: 1, tint: '#b7ae9e' });
  const taken = [[X - 18, Z - 13, X + 20, Z + 14]];
  const free = freiUm([[X, Z]], 14);
  const xr = extra?.(b, X, Z);
  if (xr) taken.push(xr);
  // Hofstellen in den vier Quadranten, unregelmäßig versetzt
  for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const hx = X + qx * (38 + rand() * 12), hz = Z + qz * (34 + rand() * 8);
    taken.push(hofstelle(b, { x: hx, z: hz, qx, qz, rand, baeume: GARTENBAUM }));
  }
  ortsstrasse(b, { pts: strasse, road: 3, sides: [-1, 1], rand, taken, free, baeume: GARTENBAUM, zwei: 0.5, fachwerk: 0.35, garten: 0.85, anbau: 0.4, garage: 0.15, gap: [4, 12], vorgarten: 5 });
  // Dorflinde mit Bank, Brunnentrog, Ortsschild
  bench(b, X + 6, Z + 7, { ry: PI });
  b.box(X - 8, 0, Z + 6, 2.4, 0.7, 0.9, 'stone_wall', { tint: '#a8a092', minimap: 'cover' });
  b.box(X - 22, 0, Z - 4.5, 1.4, 2.2, 0.1, 'metal_painted', { tint: '#5a5f66', minimap: false, collide: false });
  b.sign(X - 22, 1.4, Z - 4.4, 1.8, 0.7, 'ort_' + seed, {});
  sandbags(b, X - 6, Z + 9, X + 2, Z + 11, { rows: 4 });
  car(b, X + 12, Z - 8, { ry: 0.2 });
  return leben(b, 'dorf');
}

// Dorfstraßen (gekrümmt, = Gelände-Straßen lindweg/riedweg im Ortsbereich)
const DORFSTR = {
  lindhof: [[-396, 372], [-438, 386], [-480, 380], [-522, 369], [-564, 381]],
  hohenried: [[388, -368], [430, -352], [470, -360], [512, -371], [554, -358]],
};
function lindhof(b) {
  return dorf(b, -480, 380, 6301, 'Lindhof', DORFSTR.lindhof, (b2, X, Z) => {
    // Kapelle am Dorfplatz
    b2.defineSign('kapelle', { style: 'plate', text: 'ST. WENDELIN', bg: '#3a3a3a', fg: '#efe6d4' });
    kirche(b2, X + 2, Z - 28, { w: 9, d: 14, tint: '#ebe5d6', towerH: 15 });
    return [X - 6, Z - 47, X + 10, Z - 19];
  });
}
function hohenried(b) {
  return dorf(b, 470, -360, 6402, 'Hohenried', DORFSTR.hohenried, (b2, X, Z) => {
    b2.defineSign('gasthof', { style: 'plate', text: 'GASTHOF ZUR LINDE', bg: '#2d4a3a', fg: '#f1e6c8' });
    haus(b2, { x: X, z: Z + 26, w: 16, d: 11, floors: 2, door: 'n', color: '#e8e2d2', nutzung: 'wohn', fachwerk: true, roofTint: '#8f5a48' });
    b2.sign(X, 3.3, Z + 20.4, 5.6, 0.9, 'gasthof', { ry: PI });
    for (let k = 0; k < 3; k++) { cafeTable(b2, X - 5 + k * 5, Z + 17); }
    return [X - 10, Z + 15, X + 10, Z + 34];
  });
}

function funkstationSite(b) { funkstation(b, 150, -560, FUNK_Y); return leben(b, 'militaer', false); }

function flugfeld(b) {
  b.defineSign('segel', { style: 'plate', text: 'SEGELFLUGFELD WEITMARK', sub: 'Flugleitung · Halle 1–2', bg: '#2f3f52', fg: '#efe6d4' });
  b.groundTiled(-230, 516, 10, 576, 'concrete_panel', { cell: 2, tint: '#aeaaa0' });
  hangar(b, { x: -170, z: 538, w: 40, d: 30, H: 6.5, rise: 6, nr: 1, kind: 'flugzeug', closed: 0.3 });
  hangar(b, { x: -110, z: 538, w: 40, d: 30, H: 6.5, rise: 6, nr: 2, kind: 'lager', closed: 0.5 });
  flugleitung(b, -45, 540);
  b.sign(-45, 7.4, 543.6, 5.8, 0.9, 'segel', {});
  schulflugzeug(b, -150, 566, PI + 0.1, { tint: '#d9d6cc', akzent: '#c8402f' });
  schulflugzeug(b, -20, 568, PI - 0.25, { tint: '#9aa088', akzent: '#d9a72a' });
  barrelGroup(b, -76, 528, { n: 5 }); crateStack(b, -80, 560, { ry: 0.3 });
  for (let k = 0; k < 4; k++) jersey(b, -10 + k * 3.1, 528, { len: 3 });
  sandbags(b, -205, 570, -196, 572, { rows: 4 });
  return leben(b, 'militaer', false);
}

function piste(b, ctx) {
  startbahn(b, RUNWAY, 0.05);
  windsack(b, -70, 625, ctx.hf.heightAt(-70, 625), 0.4);
  // Wracks am Pistenrand (Kriegsspuren) und Abstellflächen der Jets
  for (const [x, z, ry, k] of [[-300, 630, 0.6, 'lkw'], [120, 572, 2.2, 'pkw']]) burntWreck(b, x, ctx.hf.heightAt(x, z), z, ry, k, 11, (px, pz) => ctx.hf.heightAt(px, pz));
  return {};
}

function gefechtsstand(b, side) {
  const L = side === 'A' ? LA : LB, { x, z } = HQ[side];
  hauptquartier(b, x, z, side, { pads: [...L.tanks.map((p) => [p[0], p[1], 'tank']), ...L.jeeps.map((p) => [p[0], p[1], 'jeep'])], helis: L.helis });
  return leben(b, 'militaer', false);
}

// ---------------------------------------------------------------------------
// Kartenbeschreibung
// ---------------------------------------------------------------------------
const veh = (side, L) => {
  const t = side, yawIn = side === 'A' ? -Q : Q;
  return [
    { id: t + '-jet', team: t, kind: 'jet', x: side === 'A' ? RUNWAY.x0 + 25 : RUNWAY.x1 - 25, z: side === 'A' ? RUNWAY.z - 7 : RUNWAY.z + 7, yaw: yawIn },
    { id: t + '-heli-1', team: t, kind: 'heli', x: L.helis[0][0], z: L.helis[0][1], yaw: yawIn },
    { id: t + '-panzer-1', team: t, kind: 'tank', x: L.tanks[0][0], z: L.tanks[0][1], yaw: PI },
    { id: t + '-jeep-1', team: t, kind: 'jeep', x: L.jeeps[0][0], z: L.jeeps[0][1], yaw: PI },
    { id: t + '-heli-2', team: t, kind: 'heli', x: L.helis[1][0], z: L.helis[1][1], yaw: yawIn },
    { id: t + '-panzer-2', team: t, kind: 'tank', x: L.tanks[1][0], z: L.tanks[1][1], yaw: PI },
    { id: t + '-jeep-2', team: t, kind: 'jeep', x: L.jeeps[1][0], z: L.jeeps[1][1], yaw: PI },
    { id: t + '-jeep-3', team: t, kind: 'jeep', x: L.jeeps[2][0], z: L.jeeps[2][1], yaw: PI },
  ];
};

const WEITMARK = {
  id: 'weitmark',
  name: 'Weitmark',
  scale: 'gross',
  seed: 2611,
  bounds: { minX: -800, maxX: 800, minZ: -800, maxZ: 800, minY: -12, maxY: 160 },
  runway: RUNWAY,
  ambience: 'range',
  assets: { hdri: 'np_sky_vormittag_dunst' },
  defaultSurface: 'grass',
  wallMargin: 45,
  navGrid: 7,
  // Riesenkarte (terrain/bigworld.js): Sichtweite, Fernkulisse, Budgets je Stufe und Plattform
  giant: {
    farRadius: 2300,
    tiers: {
      low: { view: 430, far: 1300, treeFar: 400, siteCull: 260, mapPx: 768 },
      medium: { view: 720, far: 1700, treeFar: 700, siteCull: 560, mapPx: 1024 },
      high: { view: 1100, far: 2300, treeFar: 1000, siteCull: 760, mapPx: 1536 },
      ultra: { view: 1300, far: 2300, treeFar: 1150, siteCull: 900, mapPx: 2048 },
    },
    // Android-App (Handy/Tablet, Quest als 2D-App): engere Budgets, Speicher < 1,2 GB
    android: { view: 520, far: 1300, treeNear: 60, treeFar: 420, grassCap: 900, siteCull: 300, mapPx: 768 },
  },
  lighting: {
    sun: { elevation: 38, azimuth: 148, color: '#fff1dc', intensity: 3.6 },
    sky: { turbidity: 6.8, rayleigh: 0.95, mieCoefficient: 0.0055, mieDirectionalG: 0.8, exposure: 0.7, clouds: { coverage: 0.5, density: 0.48, scale: 0.00014, elevation: 0.52 }, hazeHigh: 0.24, hazeAmount: 0.95, hdriIntensity: 2.0 },
    hemi: { sky: '#d6d8d2', ground: '#6a6b55', intensity: 1.3, hdriIntensity: 1.0 },
    env: { intensity: 1.6, ground: '#6a6c52', groundIntensity: 0.55, tint: '#f2f1ee', hdriIntensity: 1.3, hdriTint: '#ece4d8' },
    // dünnerer Höhennebel als auf Grenzland: Fernsicht über das Tal bis zur Hügelkette
    fog: { color: '#c4cad0', nearFactor: 0.22, density: 0.0016, falloff: 0.016, start: 40, max: 0.9, sun: 0.7, sunExp: 4 },
    shadow: { size: 60, bias: -0.0004, normalBias: 0.04, near: 40, farMaxY: 70 },
    exposure: 1.0,
    atmos: { beams: 0.02, beamG: 0.45, dust: 0.7, dustSize: 0.014 },
  },
  water: { color: '#2b4a40' },

  terrain: {
    size: 1800, res: 1, seed: 2611,
    base: { amp: 4.2, scale: 300, octaves: 4, offset: 1.3 }, // weit2: flacheres Talbecken → Ortschaften ohne Plateaukanten
    detail: { amp: 0.3, scale: 10 },
    hills: [
      // Hügelkette im Norden (Fluss bricht bei x ≈ 0 hindurch)
      { x: -660, z: -660, r: 170, h: 40 }, { x: -410, z: -630, r: 160, h: 46 }, { x: -170, z: -650, r: 140, h: 38 },
      { x: 150, z: -575, r: 115, h: 34 }, { x: 400, z: -650, r: 170, h: 48 }, { x: 680, z: -630, r: 150, h: 40 },
      // sanfte Höhen im Süden und an den Seiten
      { x: -630, z: 640, r: 150, h: 18 }, { x: 560, z: 650, r: 160, h: 22 }, { x: 640, z: -190, r: 130, h: 14 },
      { x: -650, z: 190, r: 120, h: 12 }, { x: -300, z: -150, r: 100, h: 9 }, { x: 300, z: 150, r: 80, h: 7 },
    ],
    edge: { start: 805, end: 900, height: 52, soft: true, scale: 380, rock: 0.22, grow: 1500 }, // weit2: runde, bewaldete Randhöhen
    waterY: -1.4,
    river: {
      pts: [[70, -1000], [50, -800], [-5, -640], [20, -470], [40, -330], [12, -200], [6, -80], [8, 40], [12, 160], [55, 270], [150, 380], [260, 470], [330, 600], [360, 760], [380, 1000]],
      width: 22, depth: 2.6, bank: 10,
      fords: [{ x: 40, z: -330, r: 10, depth: 0.35 }, { x: 260, z: 470, r: 10, depth: 0.4 }],
    },
    pads: [
      { x: -136, z: 0, w: 200, d: 320, y: 0, blend: 34 },          // Kesselbrück West
      { x: 146, z: 0, w: 188, d: 320, y: 0, blend: 34 },           // Kesselbrück Ost
      { x: -420, z: -300, w: 160, d: 110, y: 0, blend: 40 },       // Sägewerk
      { x: 430, z: 300, w: 160, d: 110, y: 0, blend: 40 },         // Ziegelei
      { x: -480, z: 380, w: 190, d: 150, y: 0, blend: 40 },        // Lindhof
      { x: 470, z: -360, w: 190, d: 150, y: 0, blend: 40 },        // Hohenried
      { x: -140, z: 586, w: 720, d: 120, y: 0, blend: 36, worn: false }, // Segelflugfeld
      { x: 150, z: -560, w: 52, d: 46, y: FUNK_Y, blend: 26 },     // Funkstation
      { x: HQ.A.x, z: HQ.A.z + 4, w: 84, d: 92, y: 0, blend: 36 }, // Gefechtsstand West
      { x: HQ.B.x, z: HQ.B.z + 4, w: 84, d: 92, y: 0, blend: 36 }, // Gefechtsstand Ost
    ],
    roads: [
      { id: 'landstrasse', name: 'Landstraße', kind: 'asphalt', width: 7, pts: [[-900, -40], [-700, -40], [-560, -30], [-400, -40], [-280, -26], [-236, -20], [-150, -20], [-36, -20], [52, -20], [150, -20], [240, -20], [400, 10], [560, 30], [700, 40], [900, 40]], bridge: { a: [BR.stein.x0, -20], b: [BR.stein.x1, -20], y: BRIDGE_Y } },
      { id: 'piste', name: 'Startbahn 09/27', kind: 'asphalt', width: RUNWAY.w, shoulder: 5, pts: [[RUNWAY.x0, RUNWAY.z], [(RUNWAY.x0 + RUNWAY.x1) / 2, RUNWAY.z], [RUNWAY.x1, RUNWAY.z]] },
      { id: 'suedstrasse', name: 'Südstraße', kind: 'asphalt', width: 6, pts: [...STR.sued, [52, 130], [128, 130], ...STR.suedost.slice(1)], bridge: { a: [BR.sued.x0, 130], b: [BR.sued.x1, 130], y: BRIDGE_Y } },
      { id: 'kirchgasse', name: 'Kirchgasse', kind: 'asphalt', width: 6, pts: STR.kirch },
      { id: 'muehlgasse', name: 'Mühlgasse', kind: 'gravel', width: 4, pts: STR.muehl },
      { id: 'schulweg', name: 'Schulweg', kind: 'asphalt', width: 5, pts: STR.schul },
      { id: 'lindenweg', name: 'Lindenweg', kind: 'gravel', width: 4.5, pts: STR.linden },
      { id: 'uferstrasse', name: 'Uferstraße', kind: 'gravel', width: 5, pts: STR.ufer },
      { id: 'gartenweg', name: 'Gartenweg', kind: 'gravel', width: 5, pts: STR.garten },
      { id: 'bahnhofstrasse', name: 'Bahnhofstraße', kind: 'asphalt', width: 6, pts: STR.bahnhof },
      { id: 'kirchweg', name: 'Kirchweg', kind: 'gravel', width: 4.5, pts: STR.kirchweg },
      { id: 'rosenweg', name: 'Rosenweg', kind: 'gravel', width: 4.5, pts: STR.rosen },
      { id: 'uferweg_ost', name: 'Uferweg', kind: 'gravel', width: 4, pts: STR.uferost },
      { id: 'saegeweg', name: 'Sägewerkstraße', kind: 'asphalt', width: 6, pts: [[-160, -160], [-200, -230], [-300, -290], [-340, -298], [-420, -298], [-500, -298], [-600, -380]] },
      { id: 'lindweg', name: 'Lindhofer Straße', kind: 'gravel', width: 5, pts: [[-140, 160], [-220, 240], [-340, 352], ...DORFSTR.lindhof, [-620, 300], [-680, 120], [-700, 10]] },
      { id: 'riedweg', name: 'Hohenrieder Straße', kind: 'gravel', width: 5, pts: [[120, -160], [200, -240], [330, -340], ...DORFSTR.hohenried, [620, -290], [690, -120], [700, 0]] },
      { id: 'ziegelweg', name: 'Ziegeleistraße', kind: 'asphalt', width: 6, pts: [[120, 160], [250, 230], [340, 290], [370, 303], [430, 303], [490, 303], [560, 250], [690, 110]] },
      { id: 'flugweg', name: 'Flugfeldweg', kind: 'gravel', width: 5, pts: [[-140, 160], [-150, 330], [-130, 470], [-110, 520]] },
      { id: 'furtweg_sued', name: 'Furtweg Süd', kind: 'dirt', width: 3.6, pts: [[370, 303], [330, 420], [260, 470], [180, 520], [40, 548]] },
      { id: 'kammweg', name: 'Kammweg', kind: 'gravel', width: 4, pts: [[120, -160], [150, -300], [130, -430], [150, -530]] },
      { id: 'riedkamm', name: 'Höhenweg', kind: 'dirt', width: 3.6, pts: [[470, -360], [330, -470], [220, -540], [172, -556]] },
      { id: 'furtweg_nord', name: 'Furtweg Nord', kind: 'dirt', width: 3.6, pts: [[-340, -298], [-260, -360], [-200, -380], [40, -330], [130, -420]] },
    ],
    fields: [
      { x: -330, z: 110, w: 120, d: 70, ry: 0.1, kind: 'acker' }, { x: -340, z: 210, w: 90, d: 60, ry: -0.2, kind: 'stoppel' },
      { x: -580, z: 520, w: 110, d: 70, ry: 0.3, kind: 'acker' }, { x: -360, z: 470, w: 100, d: 60, ry: -0.1, kind: 'acker' },
      { x: 330, z: -170, w: 120, d: 70, ry: -0.15, kind: 'acker' }, { x: 340, z: -60, w: 90, d: 60, ry: 0.2, kind: 'stoppel' },
      { x: 590, z: -470, w: 110, d: 70, ry: -0.3, kind: 'acker' }, { x: 300, z: -430, w: 90, d: 60, ry: 0.1, kind: 'stoppel' },
      { x: 560, z: 420, w: 100, d: 70, ry: 0.25, kind: 'acker' }, { x: -560, z: -170, w: 110, d: 70, ry: -0.1, kind: 'stoppel' },
      { x: 250, z: 640, w: 120, d: 60, ry: 0.05, kind: 'acker' }, { x: -380, z: 700, w: 140, d: 60, ry: -0.05, kind: 'stoppel' },
    ],
    forests: [
      { x: -600, z: -560, r: 170 }, { x: -300, z: -660, r: 140 }, { x: 360, z: -580, r: 150 }, { x: 660, z: -660, r: 120 },
      { x: -620, z: 200, r: 120 }, { x: -260, z: 320, r: 100 }, { x: 640, z: -150, r: 120 }, { x: 300, z: 520, r: 70 },
      { x: 650, z: 560, r: 130 }, { x: -110, z: -360, r: 80 }, { x: -640, z: 660, r: 120 }, { x: 230, z: -290, r: 60 },
    ],
  },

  vegetation: {
    seed: 2612,
    forests: [
      { x: -600, z: -560, r: 170, density: 0.62, spruce: 0.85 }, { x: -300, z: -660, r: 140, density: 0.6, spruce: 0.8 },
      { x: 360, z: -580, r: 150, density: 0.62, spruce: 0.85 }, { x: 660, z: -660, r: 120, density: 0.6, spruce: 0.8 },
      { x: -620, z: 200, r: 120, density: 0.58, spruce: 0.45 }, { x: -260, z: 320, r: 100, density: 0.55, spruce: 0.35 },
      { x: 640, z: -150, r: 120, density: 0.58, spruce: 0.5 }, { x: 300, z: 520, r: 70, density: 0.5, spruce: 0.3 },
      { x: 650, z: 560, r: 130, density: 0.58, spruce: 0.55 }, { x: -110, z: -360, r: 80, density: 0.55, spruce: 0.4 },
      { x: -640, z: 660, r: 120, density: 0.55, spruce: 0.5 }, { x: 230, z: -290, r: 60, density: 0.5, spruce: 0.3 },
    ],
    ring: { density: 0.34, spruce: 0.75, inset: -6, step: 8.5 },
    scatter: { count: 160 },
    hedges: [
      { pts: [[-400, 80], [-260, 70]], trees: 0.25 }, { pts: [[-420, 250], [-300, 270]], trees: 0.2 }, { pts: [[260, -100], [400, -110]], trees: 0.25 },
      { pts: [[280, -230], [400, -250]], trees: 0.2 }, { pts: [[-560, -100], [-420, -120]], trees: 0.3 }, { pts: [[520, 180], [640, 160]], trees: 0.25 },
      { pts: [[-300, 560], [-200, 520]], trees: 0.2 }, { pts: [[100, 330], [220, 300]], trees: 0.3 }, { pts: [[-240, -440], [-120, -470]], trees: 0.2 },
      { pts: [[-260, 400], [-160, 420], [-120, 380]], trees: 0.25 }, { pts: [[300, 380], [380, 420]], trees: 0.2 }, { pts: [[540, -10], [600, 120]], trees: 0.25 },
    ],
    // Linden in der Stadt und an den Dorfplätzen [x, z, Maßstab, Drehung]
    trees: [
      [-130, -6, 1.05, 0.4], [-70, -6, 1.0, 1.4], [-130, 18, 1.1, 2.2], [-70, 18, 0.95, 3.1], [-160, 10, 1.0, 4.0], [-62, 100, 1.0, 5.0],
      [90, 100, 1.05, 0.7], [150, 100, 1.0, 1.8], [100, -80, 1.0, 2.6], [-492, 362, 1.1, 1.1], [-468, 400, 1.0, 2.3], [458, -378, 1.1, 0.5], [484, -340, 1.0, 3.3],
    ],
    reeds: { offset: 11 },
    rocks: {
      count: 220, extra: [],
      walls: [
        [[-330, 40], [-280, 30]], [[-260, -120], [-230, -90]], [[280, 50], [330, 70]], [[250, -100], [290, -130]],
        [[-560, 60], [-520, 40]], [[540, -40], [580, -60]], [[-300, 430], [-260, 450]], [[330, -500], [380, -480]],
        [[-60, 300], [-20, 330]], [[60, -300], [100, -270]], [[-430, -160], [-390, -190]], [[420, 170], [460, 140]],
      ],
      clusters: [[-250, -50, 4, 5], [260, 60, 4, 5], [-380, 150, 4, 5], [380, -150, 4, 5], [-60, 260, 4, 4], [80, -260, 4, 4],
        [-560, -40, 3, 4], [560, 40, 3, 4], [-200, 450, 4, 5], [200, -450, 4, 5], [-480, -470, 4, 5], [480, 470, 4, 5]],
    },
  },
  clearings: [
    [-100, 4, 30], [8, -20, 20], [180, 40, 20], [150, -560, 30], [-110, 540, 50],
    ...Array.from({ length: 10 }, (_, i) => [RUNWAY.x0 - 40 + i * 80, RUNWAY.z, 46]),
  ],

  sites: [
    { id: 'stadt_west', name: 'Kesselbrück West', bounds: { minX: -236, maxX: -38, minZ: -160, maxZ: 160 }, chunkSize: 64, build: (b) => stadtWest(b), seeds: [[-100, 4], [-140, -100], [-140, 100], [-200, -20], [-60, 60]], height: 20, spacing: 1.7 },
    { id: 'stadt_ost', name: 'Kesselbrück Ost', bounds: { minX: 52, maxX: 240, minZ: -160, maxZ: 160 }, chunkSize: 64, build: (b) => stadtOst(b), seeds: [[120, 0], [120, -100], [120, 100], [180, 55], [90, -20]], height: 14, spacing: 1.7 },
    { id: 'steinbruecke', name: 'Steinbrücke', bounds: { minX: -42, maxX: 62, minZ: -34, maxZ: -6 }, clear: { minX: -38, maxX: 56, minZ: -28, maxZ: -12 }, build: (b) => steinbruecke(b), seeds: [[8, -20, BRIDGE_Y]], height: 10, spacing: 1.8 },
    { id: 'suedbruecke', name: 'Südbrücke', bounds: { minX: -42, maxX: 56, minZ: 122, maxZ: 138 }, clear: { minX: -38, maxX: 52, minZ: 124, maxZ: 136 }, build: (b) => suedbruecke(b), seeds: [[8, 130, BRIDGE_Y]], height: 10, spacing: 1.8 },
    { id: 'saegewerk', name: 'Sägewerk', bounds: { minX: -492, maxX: -348, minZ: -350, maxZ: -250 }, build: (b) => saegewerk(b), seeds: [[-420, -300], [-430, -270]], height: 14, spacing: 1.7 },
    { id: 'ziegelei', name: 'Ziegelei', bounds: { minX: 358, maxX: 502, minZ: 250, maxZ: 350 }, build: (b) => ziegelei(b), seeds: [[430, 300], [420, 330]], height: 14, spacing: 1.7 },
    { id: 'lindhof', name: 'Lindhof', bounds: { minX: -566, maxX: -394, minZ: 312, maxZ: 448 }, build: (b) => lindhof(b), seeds: [[-480, 380], [-520, 380], [-440, 380]], height: 14, spacing: 1.7 },
    { id: 'hohenried', name: 'Hohenried', bounds: { minX: 384, maxX: 556, minZ: -428, maxZ: -292 }, build: (b) => hohenried(b), seeds: [[470, -360], [430, -360], [510, -360]], height: 14, spacing: 1.7 },
    { id: 'funkstation', name: 'Funkstation', y: FUNK_Y, bounds: { minX: -26 + 150, maxX: 26 + 150, minZ: -584, maxZ: -536 }, build: (b) => funkstationSite(b), seeds: [[150, -552, FUNK_Y]], height: 12, spacing: 1.7 },
    { id: 'flugfeld', name: 'Segelflugfeld', bounds: { minX: -232, maxX: 12, minZ: 514, maxZ: 578 }, build: (b) => flugfeld(b), seeds: [[-140, 560], [-110, 540], [-45, 548]], height: 14, spacing: 1.8 },
    { id: 'hq_a', name: 'Gefechtsstand West', bounds: { minX: HQ.A.x - 40, maxX: HQ.A.x + 40, minZ: HQ.A.z - 38, maxZ: HQ.A.z + 46 }, chunkSize: 128, build: (b) => gefechtsstand(b, 'A'), seeds: [[HQ.A.x, HQ.A.z + 20]], height: 14, spacing: 2.2 },
    { id: 'hq_b', name: 'Gefechtsstand Ost', bounds: { minX: HQ.B.x - 40, maxX: HQ.B.x + 40, minZ: HQ.B.z - 38, maxZ: HQ.B.z + 46 }, chunkSize: 128, build: (b) => gefechtsstand(b, 'B'), seeds: [[HQ.B.x, HQ.B.z + 20]], height: 14, spacing: 2.2 },
  ],
  lateSites: [
    { id: 'piste', name: 'Startbahn', bounds: { minX: RUNWAY.x0 - 20, maxX: RUNWAY.x1 + 20, minZ: 570, maxZ: 640 }, chunkSize: 400, build: (b, ctx) => piste(b, ctx) },
  ],

  // Eroberung: 7 Flaggen (A Sägewerk · B Lindhof · C Marktplatz · D Funkstation · E Flugfeld · F Hohenried · G Ziegelei)
  flags: {
    cq: [
      { id: 'A', name: 'Sägewerk', x: -420, z: -298, radius: 28, heightBand: [-3, 10] },
      { id: 'B', name: 'Lindhof', x: -480, z: 380, radius: 26, heightBand: [-3, 9] },
      { id: 'C', name: 'Marktplatz', x: -100, z: 4, radius: 26, heightBand: [-3, 11] },
      { id: 'D', name: 'Funkstation', x: 150, z: -552, y: FUNK_Y, radius: 22, heightBand: [-4, 8] },
      { id: 'E', name: 'Flugfeld', x: -110, z: 560, radius: 30, heightBand: [-3, 10] },
      { id: 'F', name: 'Hohenried', x: 470, z: -360, radius: 26, heightBand: [-3, 9] },
      { id: 'G', name: 'Ziegelei', x: 430, z: 303, radius: 28, heightBand: [-3, 10] },
    ],
    dom: [
      { id: 'A', name: 'Marktplatz', x: -100, z: 4, radius: 10 },
      { id: 'B', name: 'Steinbrücke', x: 8, z: -20, y: BRIDGE_Y, radius: 9 },
      { id: 'C', name: 'Bahnhof', x: 150, z: 40, radius: 10 },
    ],
  },
  // Startpunkte [x, z, yaw?]: Teamkampf um die Stadt (West ↔ Ost), Eroberung in den Gefechtsständen
  spawns: {
    A: [[-262, -60], [-262, -36], [-258, -4], [-262, 24], [-258, 50], [-266, 76], [-270, 104], [-262, -86]].map(([x, z]) => [x, z, -Q]),
    B: [[262, -60], [262, -36], [258, -4], [262, 24], [258, 50], [266, 76], [270, 104], [262, -86]].map(([x, z]) => [x, z, Q]),
    ffa: [[-100, 4], [-140, -90], [-140, 90], [-200, -10], [-60, 60], [-50, -120], [120, 0], [120, -100], [120, 100], [180, 70], [80, -60], [90, 140], [-180, 130], [200, -130]],
    hq: { A: LA.spawns, B: LB.spawns },
  },
  // Fahrzeuge: je Gefechtsstand Jet (Startbahn), 2 Hubschrauber, 2 Panzer, 3 Geländewagen; neutrale Geländewagen
  // in den Dörfern und am Sägewerk/an der Ziegelei
  vehicles: [...veh('A', LA), ...veh('B', LB),
    { id: 'lind-jeep', team: null, kind: 'jeep', x: -452, z: 392, yaw: 0 }, { id: 'ried-jeep', team: null, kind: 'jeep', x: 442, z: -348, yaw: PI },
    { id: 'saege-jeep', team: null, kind: 'jeep', x: -372, z: -276, yaw: -Q }, { id: 'ziegel-jeep', team: null, kind: 'jeep', x: 380, z: 330, yaw: Q }],
  secrets: [],
};

// Kleinrelief (terrain/relief.js): Kuppen/Senken als Deckung auf den weiten Wiesen zwischen den Orten
WEITMARK.terrain.relief = {
  ...reliefAvoid(WEITMARK, []),
  knolls: [
    { x: -300, z: 0, r: 22, h: 3.4, w: 15, ry: 0.4 }, { x: 300, z: 0, r: 22, h: 3.4, w: 15, ry: -0.4 },
    { x: -260, z: -200, r: 18, h: 3.0 }, { x: 260, z: 200, r: 18, h: 3.0 }, { x: -60, z: 360, r: 20, h: 2.6, w: 14 },
    { x: 60, z: -400, r: 20, h: 2.6, w: 14 }, { x: 470, z: 300 - 70, r: 16, h: -2.4, w: 12 },
  ],
  ridges: [{ pts: [[-340, -60], [-320, 40], [-330, 120]], w: 4, h: 1.5 }, { pts: [[340, 60], [320, -40], [330, -120]], w: 4, h: 1.5 }],
  sunken: [{ pts: [[-200, 200], [-260, 260], [-330, 300]], w: 4, d: 1.6, bank: 5.5 }, { pts: [[200, -200], [260, -260], [330, -300]], w: 4, d: 1.6, bank: 5.5 }],
  scatter: { seed: 2613, count: 240, area: { minX: -780, maxX: 780, minZ: -780, maxZ: 780 }, r: [10, 24], h: [1.3, 3.4], hollow: 0.3, gap: 10 },
};

export default WEITMARK;
