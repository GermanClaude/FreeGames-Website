// NULLPUNKT — Karte „Schießstand“ / Übungsgelände Nullpunkt (Großkarte, nur Training und Panzer-Übung). (Owner: world)
// Mitte: die Trainingsanlage wie bisher – 8 Bahnen, Klappziele 10–100 m, Schießstand-Überdachung, Waffenkammer und
// Einschieß-Parcours. Seit 21.11. (Nutzer: „größer – Panzer, Fahrzeuge, Hubschrauber und Jets allein ausprobieren“) liegt
// sie in einem 2,6 × 2,6 km großen Übungsgelände (world/terrain/bigworld.js): Fahrzeughof mit allen Mustern, Fahrstrecke,
// Panzerschießbahn bis 2500 m, Flugfeld mit Startbahn und Zielgebiet mit Luftzielen (Bereiche: range-gelaende.js,
// Bedienung: modes/training-gelaende.js). Klarer Morgen. Koordinaten der Anlage unverändert (Kampagne M0).
import * as THREE from 'three';
import { getMaterial } from '../../engine/textures.js?v=20261122020853';
import { building, wall, stairs, railing } from '../arch.js?v=20261122020853';
import { crate, crateStack, barrel, sandbags, jersey, lockers, workbench, bench, floodMast, electricBox, pallet, cone, tree, rack, dress, hash01 } from '../props.js?v=20261122020853';
import { rangeFuellen } from './fuell-karten.js?v=20261122020853'; // fuell (20.11.): Bodenspuren, Wiesen außen
import { VEHICLES } from '../../vehicles/data.js?v=20261122020853';
import {
  RUNWAY, FIRE_Z as TANK_LINE, TANK_X, AREA, HOF, STRECKE, SCHIESSBAHN, FLUGFELD, ZIELGEBIET, rectClearings, boardsIn,
  hof, strecke, schiessbahn, flugfeld, zielgebiet, installTargetRaycast, createDynamicTargets, installHitTest, uebungOf,
} from './range-gelaende.js?v=20261122020853';

const LANES = 8, LANE_W = 5.5, FIRE_Z = 34; // Schießstand (Infanterie): Feuerlinie z 34, Bahnen nach Norden
const laneX = i => -((LANES - 1) / 2) * LANE_W + i * LANE_W;
const DIST = [10, 25, 50, 75, 100];
const OFFSET = { 10: -1.3, 25: 1.3, 50: -0.6, 75: 0.6, 100: 0 };
const PI = Math.PI, Q = PI / 2;
const NAMES = Object.fromEntries(Object.entries(VEHICLES).map(([k, v]) => [k, { name: v.name, cls: v.cls || '' }]));

const RANGE = {
  id: 'range',
  name: 'Schießstand',
  scale: 'gross',
  seed: 4711,
  bounds: { minX: -1300, maxX: 1300, minZ: -1300, maxZ: 1300, minY: -10, maxY: 600 },
  runway: RUNWAY, // Jets starten vom Boden (vehicles/air/aircraft.js)
  ambience: 'range',
  // Fotoscan-Bibliothek (assets/lib): HDRI für Umgebungslicht + Himmel, Materialzuordnung siehe world/library.js
  assets: { hdri: 'np_sky_morgen_klar', materials: { asphalt: 'asphalt_light' } }, // 16.10.: eigener Himmel statt Poly-Haven-Foto
  defaultSurface: 'grass',
  wallMargin: 30,
  wallTop: 30, // Randwand nur für Bodenfahrzeuge/Fußgänger; Luftfahrzeuge regelt der Luftraum (air/aircraft.js)
  // Sichtweite je Stufe über den Großkarten-Standard hinaus: Panzerziele bis 2500 m, Luftraum (terrain/bigworld.js)
  viewTiers: { low: { view: 800, far: 1100 }, medium: { view: 1500, far: 1700 }, high: { view: 2700, far: 2800 }, ultra: { view: 2800, far: 2900 } },
  groundDressing: false, // gepflegtes Übungsgelände: keine Ölflecken/Bodenauflage auf Hof und Feuerlinie (fuellung.js)
  navGrid: 24, // keine Bots außer Zielen: grobes Geländenetz genügt (Panzer-Übung: Infanterie im Zielgebiet)
  lighting: {
    sun: { elevation: 31, azimuth: 118, color: '#fff2dc', intensity: 3.7 },
    sky: { turbidity: 3.4, rayleigh: 1.2, mieCoefficient: 0.004, mieDirectionalG: 0.8, exposure: 0.66, clouds: { coverage: 0.24, density: 0.35, scale: 0.00018, elevation: 0.55 }, hazeHigh: 0.16, hazeAmount: 0.85, hdriIntensity: 1.6 },
    hemi: { sky: '#d3dbe2', ground: '#7a7458', intensity: 1.1, hdriIntensity: 0.9 },
    env: { intensity: 1.3, ground: '#7a7458', groundIntensity: 0.55, tint: '#f2ebe0', hdriIntensity: 1.1, hdriTint: '#f0e8dc' },
    // atmosphere-weather: Morgendunst – Gegenlicht-Einstreuung zur Morgensonne
    fog: { color: '#cfdae3', nearFactor: 0.3, density: 0.0007, falloff: 0.022, start: 30, max: 0.85, sun: 0.65, sunExp: 4 },
    shadow: { size: 60, bias: -0.0004, normalBias: 0.04, near: 40, farMaxY: 40 },
    exposure: 1.0,
    atmos: { beams: 0.02, beamG: 0.45, dust: 0.6, dustSize: 0.014 },
  },
  water: { color: '#3d5048' },

  terrain: {
    size: 2800, res: 2, seed: 4711, // 2 m Raster: 2,8 km Kante bei Speicher wie der Flugplatz
    base: { amp: 2.6, scale: 300, octaves: 4, offset: 0.8 },
    detail: { amp: 0.16, scale: 12 },
    hills: [
      { x: -450, z: -650, r: 170, h: 18 }, { x: -420, z: 650, r: 150, h: 16 }, { x: 420, z: 1000, r: 170, h: 18 },
      { x: 1150, z: 650, r: 140, h: 14 }, { x: -250, z: 1150, r: 120, h: 10 }, { x: 1180, z: -350, r: 110, h: 12 }, { x: 250, z: -300, r: 120, h: 9 },
    ],
    edge: { start: 1345, end: 1398, height: 45 },
    waterY: -3,
    pads: [
      { x: 0, z: -5, w: 150, d: 224, y: 0, blend: 30, worn: false },               // Schießstand
      { x: 0, z: 172, w: 272, d: 140, y: 0, blend: 24 },                            // Fahrzeughof
      { x: -1000, z: -40, w: 540, d: 2580, y: 0, blend: 70, worn: false },          // Panzerschießbahn (eben: freie Sicht)
      { x: 560, z: RUNWAY.z, w: 1300, d: 110, y: 0, blend: 50, worn: false },        // Startbahn
      { x: 760, z: -950, w: 300, d: 120, y: 0, blend: 24 },                         // Vorfeld, Landeplätze
      // Fahrstrecke: ebene Stationsflächen, dann Hügel/Gräben/Furt (später = gewinnt)
      { x: 300, z: 260, w: 200, d: 280, y: 0, blend: 22 },
      { x: 590, z: 300, w: 240, d: 300, y: 0, blend: 30 },
      { x: 420, z: 560, w: 170, d: 110, y: 0, blend: 22 },
      { x: 674, z: 570, w: 90, d: 110, y: 0, blend: 20 },
      { x: 520, z: 200, w: 40, d: 30, y: 10, blend: 28 },                          // Steigung 35 %
      { x: 650, z: 220, w: 40, d: 30, y: 6, blend: 40 },                           // Steigung 15 %
      { x: 520, z: 420, w: 5, d: 44, y: -2.2, blend: 4, worn: false },             // Graben
      { x: 625, z: 420, w: 8, d: 44, y: -3, blend: 5, worn: false },               // Panzergraben
      { x: 420, z: 560, w: 26, d: 60, y: -3.8, blend: 14, worn: false },           // Furt (Wasser −3 m)
    ],
    // Bodenwellen (Rüttelstrecke): niedrige Erdwälle quer zur Fahrspur
    dams: [0, 1, 2, 3, 4, 5].map((k) => ({ a: [650 + k * 9, 540], b: [650 + k * 9, 600], y: 0.8, crown: 0.8, slope: 1.8 })),
    roads: [
      { id: 'zufahrt', name: 'Zufahrt Fahrzeughof', kind: 'asphalt', width: 7, shoulder: 3, pts: [[0, 64], [0, 86], [0, 106]] },
      { id: 'rundkurs', name: 'Rundkurs', kind: 'dirt', width: 7, shoulder: 3, pts: [[134, 172], [220, 172], [262, 128], [380, 112], [470, 140], [560, 128], [700, 150], [742, 262], [720, 382], [705, 482], [730, 615], [640, 660], [520, 645], [420, 650], [300, 620], [228, 520], [215, 380], [200, 262], [176, 205], [134, 196]] },
      { id: 'westweg', name: 'Panzerstraße', kind: 'gravel', width: 7, shoulder: 3, pts: [[-134, 172], [-300, 230], [-560, 420], [-780, 760], [-930, 1060], [-1000, 1180]] },
      { id: 'nordweg', name: 'Flugfeldstraße', kind: 'gravel', width: 6, shoulder: 3, pts: [[134, 120], [260, -40], [430, -330], [620, -620], [740, -880]] },
      { id: 'rollweg', name: 'Rollweg', kind: 'asphalt', width: 18, shoulder: 3, pts: [[760, -905], [760, -990], [760, RUNWAY.z + RUNWAY.w / 2 - 0.4]] },
      { id: 'piste', name: 'Startbahn 09/27', kind: 'asphalt', width: RUNWAY.w, shoulder: 6, pts: [[RUNWAY.x0, RUNWAY.z], [560, RUNWAY.z], [RUNWAY.x1, RUNWAY.z]] },
      { id: 'zielweg', name: 'Zielgebietsweg', kind: 'dirt', width: 4, shoulder: 2, pts: [[260, -40], [0, -260], [-250, -420], [-350, -450]] },
    ],
    fields: [
      { x: -300, z: 960, w: 200, d: 120, ry: 0.1, kind: 'acker' }, { x: 900, z: 300, w: 160, d: 220, ry: -0.05, kind: 'stoppel' },
      { x: 500, z: 900, w: 220, d: 110, ry: 0.05, kind: 'acker' },
    ],
    forests: [
      { x: 900, z: 900, r: 170 }, { x: -450, z: 1050, r: 120 }, { x: -480, z: 120, r: 140 }, { x: 1050, z: 220, r: 110 }, { x: 200, z: 1100, r: 120 },
    ],
  },

  vegetation: {
    seed: 4712,
    forests: [
      { x: 900, z: 900, r: 170, density: 0.6, spruce: 0.7 }, { x: -450, z: 1050, r: 120, density: 0.55, spruce: 0.5 },
      { x: -480, z: 120, r: 140, density: 0.6, spruce: 0.75 }, { x: 1050, z: 220, r: 110, density: 0.55, spruce: 0.6 }, { x: 200, z: 1100, r: 120, density: 0.55, spruce: 0.4 },
    ],
    ring: { density: 0.3, spruce: 0.75, inset: -6, step: 10 },
    scatter: { count: 18, buesche: 24 },
    rocks: { count: 24, extra: [], clusters: [[1100, -1150, 4, 5], [-200, 450, 3, 4]] },
  },
  // Übungsflächen, Bahn und Anflugschneisen frei von Bäumen
  clearings: [
    ...rectClearings({ x0: SCHIESSBAHN.x0 - 20, x1: SCHIESSBAHN.x1 + 20, z0: SCHIESSBAHN.z0, z1: SCHIESSBAHN.z1 + 20 }, 60),
    ...rectClearings({ x0: STRECKE.x0, x1: STRECKE.x1, z0: STRECKE.z0, z1: STRECKE.z1 }, 50),
    ...rectClearings({ x0: FLUGFELD.x0 - 260, x1: FLUGFELD.x1 + 120, z0: FLUGFELD.z0 - 30, z1: FLUGFELD.z1 }, 60),
    ...rectClearings({ x0: ZIELGEBIET.x0, x1: ZIELGEBIET.x1, z0: ZIELGEBIET.z0, z1: ZIELGEBIET.z1 }, 50),
  ],

  sites: [
    { id: 'stand', name: 'Schießstand', bounds: { minX: -72, maxX: 72, minZ: -112, maxZ: 102 }, navBounds: { minX: -32, maxX: 32, minZ: -80, maxZ: 64 }, chunkSize: 34, build: (b) => stand(b), seeds: [[0, 48], [0, 0], [0, -50]], height: 14, spacing: 1.6 },
    { id: 'hof', name: 'Fahrzeughof', bounds: { minX: HOF.x0, maxX: HOF.x1, minZ: HOF.z0, maxZ: HOF.z1 }, nav: false, chunkSize: 96, build: (b) => hof(b, NAMES) },
  ],
  lateSites: [
    { id: 'strecke', name: 'Fahrstrecke', bounds: { minX: STRECKE.x0, maxX: STRECKE.x1, minZ: STRECKE.z0, maxZ: STRECKE.z1 }, chunkSize: 160, build: (b, ctx) => strecke(b, ctx) },
    { id: 'schiessbahn', name: 'Panzerschießbahn', cull: false, bounds: { minX: SCHIESSBAHN.x0, maxX: SCHIESSBAHN.x1, minZ: SCHIESSBAHN.z0, maxZ: SCHIESSBAHN.z1 }, chunkSize: 520, build: (b, ctx) => gelaendeRes(schiessbahn(b, ctx)) },
    { id: 'flugfeld', name: 'Flugfeld', cull: false, bounds: { minX: FLUGFELD.x0, maxX: FLUGFELD.x1, minZ: FLUGFELD.z0, maxZ: FLUGFELD.z1 }, chunkSize: 640, build: (b, ctx) => flugfeld(b, ctx) },
    { id: 'zielgebiet', name: 'Zielgebiet', cull: false, bounds: { minX: ZIELGEBIET.x0, maxX: ZIELGEBIET.x1, minZ: ZIELGEBIET.z0, maxZ: ZIELGEBIET.z1 }, chunkSize: 540, build: (b, ctx) => gelaendeRes(zielgebiet(b, ctx), true) },
  ],

  flags: { dom: [{ id: 'A', x: 0, z: 49, radius: 5 }, { id: 'B', x: 0, z: 2, radius: 6 }, { id: 'C', x: 0, z: -56, radius: 6 }] },
  // Startpunkte [x, z, yaw]: Team A = Feuerlinie der Panzerschießbahn, Team B = Zielraum (Panzer-Übung, modes/panzer.js
  // stellt die Feindkräfte zwischen die Basen); „Jeder gegen jeden“ hinter der Feuerlinie des Schießstands. Das Training
  // setzt den Schützen selbst an den Schießtisch (modes/training.js chooseSpawn).
  spawns: {
    A: TANK_X.map((x) => [x, TANK_LINE + 12, 0]),
    B: [[-1080, -260, PI], [-1000, -250, PI], [-920, -260, PI], [-1040, -320, PI], [-960, -320, PI], [-1000, -380, PI]],
    ffa: Array.from({ length: 14 }, (_, i) => [-19.5 + (i % 7) * 6.5 + (i === 12 ? 0.75 : 0), 44 + Math.floor(i / 7) * 9, 0]),
  },
  vehicles: [], // Stellplätze verwaltet der Trainingsmodus (Fahrzeuge erscheinen bei Annäherung, modes/training-gelaende.js)
};

/** Panzerschießbahn/Zielgebiet: statische Ziele an world.uebung melden, bewegte Ziele (nur einmal) anlegen. */
function gelaendeRes(r, dynamic = false) {
  return {
    attach(world, G) {
      const U = uebungOf(world);
      U.statics.push(...(r.statics || []));
      installTargetRaycast(world);
      if (dynamic && !U.dynamic) {
        U.dynamic = createDynamicTargets(world, G.renderer?.quality || 'high');
        world.group.add(U.dynamic.group);
        world.uebungDyn.push(...U.dynamic.dyn);
        U.mark = (p, c) => U.dynamic.mark(p, c);
      }
      installHitTest(world, G, U);
      this._world = world;
    },
    update(dt, camera) { if (dynamic) this._world?.uebung?.dynamic?.update(dt, camera); },
    dispose() { const U = this._world?.uebung; if (!U) return; if (U._hitOff) { U._hitOff(); U._hitOff = null; } if (U.dynamic) { U.dynamic.dispose(); U.dynamic = null; } },
  };
}

export default RANGE;

// ---------------------------------------------------------------------------
// Schießstand (Infanterie): Anlage wie bisher (Koordinaten unverändert)
// ---------------------------------------------------------------------------
function stand(b) {
  const zones = [];
  // --- Boden -------------------------------------------------------------
  b.groundTiled(-30, 30, 30, 62, 'concrete', { cell: 1 });                // Vorplatz + Stand
  b.groundTiled(-30, -77, 30, 30, 'sand', { cell: 1.2 });                 // Bahnen (verdichteter Sand)
  for (let k = 0; k < LANES; k++) b.ground(laneX(k) - 1.2, 22, laneX(k) + 1.2, 30, 'gravel', { cell: 1.2, y: 0.005, collide: false });
  zones.push({ x0: -30, z0: 30, x1: 30, z1: 62, kind: 'plaza' }, { x0: -22, z0: -77, x1: 22, z1: 30, kind: 'lane' });
  // Vorplatz vor dem Tor (Übergang zur Zufahrt des Übungsgeländes)
  b.groundTiled(-14, 62, 14, 70, 'asphalt', { cell: 2, collide: false, groundAO: false });
  // Schilder
  b.defineSign('title', { style: 'logo', text: 'NULLPUNKT', sub: 'Trainingsanlage · Schießbahnen 1–8', bg: '#16191d', fg: '#f2f2f0', accent: '#ff5b1f' });
  b.defineSign('ear', { style: 'plate', text: 'GEHÖRSCHUTZ TRAGEN', sub: 'Schießbetrieb – nur mit Freigabe', bg: '#1f5f9a', fg: '#ffffff' });
  b.defineSign('danger', { style: 'warning', text: 'SCHIESSBETRIEB', sub: 'Bahnen nicht betreten' });
  b.defineSign('armory', { style: 'plate', text: 'WAFFENKAMMER', bg: '#2a2e33', fg: '#ff5b1f' });
  b.defineSign('parcours', { style: 'plate', text: 'PARCOURS', sub: 'Bewegung & Zielwechsel', bg: '#2a2e33', fg: '#f2c230' });
  b.defineSign('stand', { style: 'stencil', text: 'SCHIESSSTAND', fg: '#e9ecee' });
  for (let i = 0; i < LANES; i++) b.defineSign('lane' + (i + 1), { style: 'number', text: String(i + 1), sub: 'BAHN', bg: '#16191d', fg: '#f2f2f0' });
  for (const d of DIST) b.defineSign('d' + d, { style: 'number', text: d + ' m', bg: '#f2f0ea', fg: '#16191d' });
  for (const d of DIST) b.defineSign('dp' + d, { style: 'plate', text: String(d), bg: '#ff5b1f', fg: '#16191d', border: false });

  // --- Außenmauern -------------------------------------------------------
  for (const s of [-1, 1]) {
    wall(b, { x0: s * 30.25, z0: -77, x1: s * 30.25, z1: 62, h: 4.2, t: 0.5, mat: 'concrete_panel', cap: { mat: 'concrete', tint: '#cfcac0', h: 0.15, over: 0.08 }, minimap: 'wall' });
  }
  wall(b, { x0: -30.5, z0: 62.25, x1: 30.5, z1: 62.25, h: 4.2, t: 0.5, mat: 'concrete_panel', cap: { mat: 'concrete', tint: '#cfcac0', h: 0.15, over: 0.08 }, openings: [{ at: 30.5, w: 6, h: 3.6, kind: 'gap', frame: false }] });
  // Tor (offen, 21.11.): Durchgang zur Zufahrt des Übungsgeländes, Torflügel aufgeschwenkt an der Mauer
  for (const s of [-1, 1]) b.box(s * 4.6, 0, 63.9, 0.12, 3.2, 3, 'metal_grate', { minimap: 'wall', uvScale: 0.6, bullet: false, ry: s * 0.12 });
  b.sign(0, 4.25, 61.95, 7.5, 1.6, 'title', { ry: Math.PI, depth: 0.06 });
  // Kugelfang (Erdwall) im Norden
  b.wedge(0, 0, -81, 66, 9, 10, 'sand', { ry: Math.PI, minimap: 'wall', uv: 'world' });
  b.box(0, 0, -77.4, 60, 2.4, 0.6, 'wood_dark', { minimap: 'wall', tint: '#8d7a63' });     // Holzbohlen vor dem Wall
  b.box(0, 0, -78.5, 62, 12, 1, 'black', { visual: false, minimap: false });
  for (let i = 0; i < 22; i++) {
    const z = -100 + i * 9 + b.rnd(-2, 2);
    tree(b, -40 - b.rnd(0, 18), z, { kind: 'tree', h: b.rnd(3.5, 5) });
    tree(b, 40 + b.rnd(0, 18), z + 4, { kind: 'tree', h: b.rnd(3.5, 5) });
  }

  // --- Überdachter Schießstand -------------------------------------------
  const z0 = FIRE_Z - 0.3, z1 = 42.6, roofY = 3.7;
  b.boxMM(-26, 0, z0, 26, 0.15, z1, 'epoxy_blue', { grad: false, minimap: 'floor' });
  // Stützen
  for (let k = 0; k <= LANES; k++) {
    const x = -22 + k * LANE_W;
    b.box(x, 0.15, z0 + 0.2, 0.3, roofY - 0.15, 0.3, 'metal_painted', { tint: '#2a2e33', minimap: 'pillar', aoFloor: 0.15 });
    // karten (22.11.): die mittlere Rückstütze stand mitten im 4-m-Durchgang (x 0) – dort zwei Stützen an den Laibungen
    for (const px of x === 0 ? [-2.15, 2.15] : [x]) b.box(px, 0.15, z1 - 0.3, 0.3, roofY - 0.15, 0.3, 'metal_painted', { tint: '#2a2e33', minimap: 'pillar', aoFloor: 0.15 });
  }
  for (const x of [-25.6, 25.6]) for (const z of [z0 + 0.2, z1 - 0.3]) b.box(x, 0.15, z, 0.3, roofY - 0.15, 0.3, 'metal_painted', { tint: '#2a2e33', minimap: 'pillar', aoFloor: 0.15 });
  // Dach mit Träger und Lichtbändern
  b.boxMM(-26.4, roofY, z0 - 0.4, 26.4, roofY + 0.32, z1 + 0.2, 'concrete', { grad: false, minimap: 'roof', tint: '#e8e4dc' });
  b.boxMM(-26.4, roofY - 0.45, z0 - 0.1, 26.4, roofY, z0 + 0.35, 'metal_painted', { grad: false, minimap: false, tint: '#ff5b1f', collide: false });
  b.sign(0, roofY - 0.42, z0 - 0.12, 10, 0.4, 'stand', { ry: 0, back: false, depth: 0 });
  for (let k = 0; k < LANES; k++) {
    const x = laneX(k);
    b.box(x, roofY - 0.05, 37.5, 3.6, 0.05, 0.25, 'lamp_cool', { collide: false, minimap: false, ao: false, cast: false });
    b.box(x, roofY - 0.05, 40.5, 3.6, 0.05, 0.25, 'lamp_cool', { collide: false, minimap: false, ao: false, cast: false });
    // Bahn-Nummer
    b.cyl(x - 0.5, roofY - 0.7, z0 + 0.45, 0.012, 0.7, 'metal_galvanized', { collide: false, seg: 4, ao: false });
    b.cyl(x + 0.5, roofY - 0.7, z0 + 0.45, 0.012, 0.7, 'metal_galvanized', { collide: false, seg: 4, ao: false });
    b.sign(x, roofY - 1.55, z0 + 0.45, 1.3, 0.9, 'lane' + (k + 1), { ry: 0, depth: 0.025 });
    // Ablage (Schießtisch)
    b.box(x, 0.15, z0 + 0.55, 3.0, 0.85, 0.65, 'wood_planks', { tint: '#9b8166', minimap: 'cover', aoFloor: 0.15 });
    b.box(x, 1.0, z0 + 0.55, 3.1, 0.05, 0.75, 'polymer', { tint: '#30353a', collide: false, minimap: false, grad: false });
    b.box(x + 1.1, 1.05, z0 + 0.6, 0.45, 0.22, 0.3, 'metal_painted', { tint: '#4f6b3a', collide: false, minimap: false, grad: false });   // Munitionskiste
    b.box(x - 0.9, 1.05, z0 + 0.5, 0.3, 0.06, 0.2, 'polymer', { collide: false, minimap: false, grad: false });
    // Gehörschutz-Ständer hinten
    b.box(x, 0.15, z1 - 0.9, 1.2, 1.2, 0.3, 'metal_painted', { tint: '#3a3f45', minimap: 'cover', aoFloor: 0.15 });
    // Bodenmarkierung Schützenposition
    b.decal(x, 0.16, z0 + 1.6, 2.4, 0.18, 'line', { ry: 0, tint: '#f2c230', kind: 'paint', opacity: 0.9 });
  }
  // Trennwände zwischen den Bahnen (Akustikpaneele)
  for (let k = 0; k <= LANES; k++) {
    const x = -22 + k * LANE_W;
    b.box(x, 0.15, z0 + 1.4, 0.14, 2.3, 2.6, 'panel_wall', { minimap: 'wall', aoFloor: 0.15, tint: '#dfe5e8' });
  }
  // Rückwand mit Durchgängen
  wall(b, { x0: -26, z0: z1 + 0.05, x1: 26, z1: z1 + 0.05, y: 0.15, h: roofY - 0.15, t: 0.25, mat: 'panel_wall', tint: '#cfd6da', openings: [
    // karten (22.11.): seitliche Durchgänge genau zwischen Eckstütze (x ±22) und Gehörschutz-Ständer – vorher ragte die Stütze hinein
    { at: 5.15, w: 2.0, h: 2.8, kind: 'gap', frame: false }, { at: 26, w: 4, h: 2.9, kind: 'gap', frame: false }, { at: 46.85, w: 2.0, h: 2.8, kind: 'gap', frame: false }] });
  b.sign(-6, 2.2, z1 + 0.2, 4.2, 0.9, 'ear', { ry: 0, depth: 0.03 });
  b.sign(6, 2.2, z1 + 0.2, 3.6, 0.9, 'danger', { ry: 0, depth: 0.03 });
  b.interior(-26, z0 - 0.4, 26, z1 + 0.1, 0, roofY - 0.05, 0.78);

  // --- Bahnen: Markierungspfosten, Entfernungstafeln, Ziele ----------------
  for (let k = 0; k <= LANES; k++) {
    const x = -22 + k * LANE_W;
    for (let z = FIRE_Z - 2; z > -72; z -= 10) {
      b.box(x, 0, z, 0.12, 0.7, 0.12, 'white', { tint: '#f2f0ea', minimap: false, collide: false });
      b.box(x, 0.45, z, 0.13, 0.18, 0.13, 'white', { tint: '#ff5b1f', minimap: false, collide: false, ao: false, grad: false });
    }
    b.decal(x, 0.01, FIRE_Z - 2, 0.14, 4, 'line', { ry: 0, tint: '#f2f0ea', kind: 'paint' });
  }
  const targets = [];
  let tid = 0;
  for (const d of DIST) {
    const z = FIRE_Z - d;
    for (const s of [-1, 1]) {
      b.cyl(s * 27.6, 0, z, 0.08, 2.2, 'metal_galvanized', { seg: 6, minimap: false });
      b.sign(s * 27.6, 2.2, z + 0.05, 1.8, 0.9, 'd' + d, { ry: 0, depth: 0.04 });
    }
    for (let k = 0; k < LANES; k++) {
      const x = laneX(k) + OFFSET[d];
      b.box(x, 0, z, 1.8, 0.12, 1.2, 'concrete', { tint: '#d8d4ca', minimap: false, grad: false });
      // Schutzschild (Stahl, schräg)
      b.wedge(x, 0, z + 0.65, 1.7, 0.62, 0.55, 'metal_painted', { ry: Math.PI, tint: '#4b5560', minimap: 'cover', uv: 'world' });
      b.sign(x, 0.12, z + 0.95, 0.42, 0.24, 'dp' + d, { ry: 0, back: false, depth: 0.0 });
      targets.push({ id: tid++, lane: k + 1, distance: d, x, z: z - 0.15 });
    }
  }
  // Deckung entlang der Bahnen (für Bewegungstraining)
  jersey(b, -10, -6, { len: 3, ry: 0.1 });
  jersey(b, 12, -30, { len: 3, ry: -0.08 });
  jersey(b, -15, -52, { len: 3, ry: 0.05 });
  crateStack(b, 4, -18, { ry: 0.4 });
  sandbags(b, 15, -8, 19, -8.5, { rows: 5 });
  sandbags(b, -20, -36, -16, -35, { rows: 5 });
  // maps-expand: zusätzliche Deckung für Bewegungstraining (Hock- und Brusthöhe, versetzt zwischen den Bahnen)
  crateStack(b, -4, -40, { ry: -0.3, pattern: [[0, 0, 0, 1.1], [1.15, 0, 0.05, 1.0]] });
  sandbags(b, 6, -60, 10, -60.5, { rows: 5 });
  jersey(b, 20, -44, { len: 3, ry: 0.12 });
  crateStack(b, -22, -14, { ry: 0.2 });
  b.box(2, 0, -27, 2.4, 1.05, 0.6, 'concrete', { tint: '#b8b2a6', minimap: 'cover' });
  barrel(b, -2, 0, -42, { color: '#2d5f94' }); barrel(b, -1.4, 0, -42.3, { color: '#b8392c' });
  // Flutlichtmasten
  for (const s of [-1, 1]) for (const z of [20, -20, -60]) floodMast(b, s * 28.5, z, { h: 10, ry: s > 0 ? Math.PI / 2 : -Math.PI / 2, kind: 'cool' });

  // --- Vorplatz / Spawn ---------------------------------------------------
  for (const [x, z] of [[-4, 50], [4, 50], [-4, 55], [4, 55]]) bench(b, x, z, { ry: 0 });
  lockers(b, -9, 60.9, { n: 6, ry: Math.PI });
  lockers(b, 9, 60.9, { n: 6, ry: Math.PI });
  b.decal(0, 0.01, 52, 12, 10, 'hatch', { ry: 0, tint: '#ff5b1f', kind: 'paint', opacity: 0.5 });
  for (const x of [-12, 12]) for (const z of [47, 57]) b.plant('bush', x, 0, z, { s: 0.9 });
  electricBox(b, 4.0, 0, 43.2, { ry: 0, w: 1.2, h: 1.6 }); // karten (22.11.): neben statt in den mittleren Durchgang (x 0)

  // --- Waffenkammer (Ost) --------------------------------------------------
  const ar = building(b, {
    x: 20, z: 52, w: 15, d: 13, floors: 1, fh: 3.8, mat: 'concrete_panel', tint: '#d9d6cf', floorMat: 'epoxy', frameMat: 'metal_painted', frameTint: '#2a2e33',
    openings: [
      { side: 'w', at: 4, w: 1.8, h: 2.4, kind: 'door' },
      { side: 'n', at: -3, w: 2.2, h: 1.3, kind: 'window', sill: 1.1, glass: false },
      { side: 'n', at: 3, w: 2.2, h: 1.3, kind: 'window', sill: 1.1, glass: false },
      { side: 's', at: 4, w: 1.6, h: 1.2, kind: 'window', sill: 1.2, glass: true },
      { side: 'e', at: 2, w: 1.8, h: 2.4, kind: 'door' },
    ],
    roof: { parapet: 1.0, mat: 'concrete', tint: '#c9c5bc', gaps: { w: [{ at: 5.6, w: 1.3, h: 1.2, kind: 'gap', frame: false }] } },
    plinth: { h: 0.4, mat: 'concrete_dark' },
  });
  b.sign(ar.x0 - 0.02, 2.75, 56, 3.4, 0.7, 'armory', { ry: -Math.PI / 2, depth: 0.03 });
  rack(b, 20, 57.5, { bays: 3, levels: 2, levelH: 1.3, ry: 0 });
  workbench(b, 17, 48.5, { ry: 0 });
  workbench(b, 23, 48.5, { ry: 0 });
  crateStack(b, 25.5, 54, { ry: Math.PI / 2, pattern: [[0, 0, 0, 0.9], [0.95, 0, 0, 0.9], [0.45, 1, 0, 0.8]] });
  lockers(b, 14.5, 55, { n: 4, ry: Math.PI / 2 });
  // Außentreppe aufs Dach (Westseite, steigt nach Süden) + Podest vor der Brüstungslücke
  const st = stairs(b, { x: ar.x0 - 0.75, z: 45.9, y0: 0, y1: ar.roofY, w: 1.2, dir: 's', style: 'steel', rail: 'right' });
  const lz = 45.9 + st.run;
  b.boxMM(ar.x0 - 1.45, ar.roofY - 0.1, lz - 0.05, ar.x0, ar.roofY, lz + 1.4, 'metal_tread', { minimap: 'stairs', grad: false });
  railing(b, ar.x0 - 1.45, lz + 1.4, ar.x0 - 1.45, lz - 0.05, ar.roofY, { posts: 2 });
  railing(b, ar.x0, lz + 1.4, ar.x0 - 1.45, lz + 1.4, ar.roofY, { posts: 2 });
  for (const [sx, sz] of [[-1.4, lz + 1.35], [-0.05, lz + 1.35]]) b.box(ar.x0 + sx, 0, sz, 0.1, ar.roofY - 0.1, 0.1, 'metal_painted', { tint: '#3d4247', minimap: false });
  b.noNav(-27, 33, 27, 43.5, 3.4, 6);
  // Dachdetails
  for (const [x, z] of [[16, 49], [24, 55]]) b.box(x, ar.roofY, z, 1.6, 1.0, 1.2, 'metal_galvanized', { minimap: 'cover', aoFloor: ar.roofY });

  // --- Parcours (West) ----------------------------------------------------
  b.sign(-19, 3.2, 43.15, 3.6, 0.9, 'parcours', { ry: 0, depth: 0.03 });
  const ply = { mat: 'wood_planks', tint: '#c9b28a', h: 2.5, t: 0.15 };
  wall(b, { ...ply, x0: -27, z0: 45, x1: -12, z1: 45, openings: [{ at: 4, w: 1.6, h: 2.1, kind: 'gap', frame: false }, { at: 11, w: 1.4, h: 1.0, kind: 'window', sill: 1.0, frame: false }] });
  wall(b, { ...ply, x0: -27, z0: 51, x1: -16, z1: 51, openings: [{ at: 3, w: 1.6, h: 2.1, kind: 'gap', frame: false }, { at: 8.5, w: 1.6, h: 2.1, kind: 'gap', frame: false }] });
  wall(b, { ...ply, x0: -21.5, z0: 45, x1: -21.5, z1: 51, openings: [{ at: 3, w: 1.6, h: 2.1, kind: 'gap', frame: false }] });
  wall(b, { ...ply, x0: -12, z0: 45, x1: -12, z1: 56, openings: [{ at: 4.5, w: 1.6, h: 2.1, kind: 'gap', frame: false }, { at: 8.6, w: 1.4, h: 1.0, kind: 'window', sill: 1.0, frame: false }] });
  wall(b, { ...ply, x0: -27, z0: 56, x1: -18, z1: 56, openings: [{ at: 6.5, w: 1.6, h: 2.1, kind: 'gap', frame: false }] });
  // Turm mit Plattform
  const tx = -24, tz = 59, ty = 2.6;
  b.boxMM(tx - 2, ty - 0.2, tz - 1.6, tx + 2, ty, tz + 1.6, 'wood_planks', { tint: '#b89b74', minimap: 'catwalk', grad: false });
  for (const sx of [-1.9, 1.9]) for (const sz of [-1.5, 1.5]) b.box(tx + sx, 0, tz + sz, 0.16, ty - 0.2, 0.16, 'wood_dark', { minimap: 'pillar' });
  railing(b, tx - 2, tz + 1.55, tx + 2, tz + 1.55, ty, { tint: '#c9a227' });
  railing(b, tx - 1.95, tz - 1.6, tx - 1.95, tz + 1.55, ty, { tint: '#c9a227' });
  stairs(b, { x: tx + 3.0, z: tz - 1.6 + 0.6 + ty / 0.62, y0: 0, y1: ty, w: 1.1, dir: 'n', style: 'steel', rail: 'right' });
  b.boxMM(tx + 2, ty - 0.08, tz - 1.6, tx + 3.6, ty, tz - 0.8, 'metal_tread', { minimap: 'stairs', grad: false });
  sandbags(b, -18, 53.5, -15, 53.5, { rows: 4 });
  crate(b, -25, 0, 48, 1.0, { ry: 0.3 }); crate(b, -24.1, 0, 48.3, 0.8, { ry: -0.2 });
  barrel(b, -14, 0, 59.5); barrel(b, -13.4, 0, 59.8);
  pallet(b, -18.8, 0, 59.6, { load: 'boxes', ry: 0.1 }); // karten (22.11.): vorher x −20 – stand im Geländer der Turmtreppe
  for (const [x, z] of [[-26.5, 53], [-17, 47.5]]) cone(b, x, z);

  dressing(b);
  boardsIn(b, { x0: -30, x1: 30, z0: 30, z1: 62 }); // Teleport-Tafeln auf dem Vorplatz (Drehkreuz)

  rangeFuellen(b);
  // --- Ziele (instanziert, animiert) --------------------------------------
  const T = createTargets(targets);
  b.object(T.group);
  return {
    zones,
    targets: T.targets,
    /** Treffer auf Klappziele: über das impact-Ereignis erkennen, Ziel klappt weg und nach 2,5 s wieder hoch. */
    attach(world, G) {
      // Großkarte: Klappziele in world.targets (Trainingsmodus, Kampagne M0) und in den Kugel-Strahl (Raycast-Hülle)
      if (Array.isArray(world.targets)) { for (const t of T.targets) if (!world.targets.includes(t)) world.targets.push(t); } else world.targets = [...T.targets];
      installTargetRaycast(world);
      uebungOf(world);
      world.targetsAuto = true;   // ohne Trainingsmodus: Ziel klappt bei Treffer weg (abschaltbar)
      const v = new THREE.Vector3(), inv = new THREE.Matrix4();
      const timers = new Map();
      const onImpact = e => {
        // Im Modus „training“ verwaltet der Modus Trefferpunkte/Klappen selbst (modes/training.js)
        if (!e || !e.point || world.targetsAuto === false || G.mode?.id === 'training') return;
        for (const t of T.targets) {
          if (!t.hittable()) continue;
          for (const hb of t.hitboxes) {
            inv.copy(hb.object.matrixWorld).invert();
            v.copy(e.point).applyMatrix4(inv);
            if (v.x < hb.min.x - 0.06 || v.x > hb.max.x + 0.06 || v.y < hb.min.y - 0.06 || v.y > hb.max.y + 0.06 || v.z < hb.min.z - 0.12 || v.z > hb.max.z + 0.12) continue;
            t.hit();
            G.events?.emit?.('target:hit', { target: t, targetId: t.id, lane: t.lane, distance: t.distance, zone: hb.zone, point: e.point.clone ? e.point.clone() : e.point, shooter: e.shooter });
            if (world.targetsAuto !== false) { t.drop(); timers.set(t, 2.5); }
            return;
          }
        }
      };
      const off = G.events?.on?.('impact', onImpact);
      this._tick = dt => { for (const [t, left] of timers) { const l = left - dt; if (l <= 0) { timers.delete(t); if (world.targetsAuto !== false) t.raise(); } else timers.set(t, l); } };
      this._off = typeof off === 'function' ? off : () => G.events?.off?.('impact', onImpact);
    },
    update(dt) { this._tick?.(dt); T.update(dt); },
    dispose() { this._off?.(); T.dispose(); },
  };
}

// ---------------------------------------------------------------------------
// Ausstattung aus der Asset-Bibliothek (Fotoscan-Kleinteile; ohne Bibliothek entfällt sie)
// ---------------------------------------------------------------------------
function dressing(b) {
  const list = [];
  const z0 = FIRE_Z - 0.3;
  // Munitionsdosen auf den Schießtischen
  for (let k = 0; k < LANES; k++) list.push(['ammo_box', laneX(k) + 0.35, 1.05, z0 + 0.62, hash01(k, 3) * 0.6 - 0.3]);
  // Waffenkammer: Munition auf den Werkbänken, Kisten, Kanister
  list.push(['ammo_box', 16.6, 0.92, 48.4, 0.1], ['ammo_box', 17.15, 0.92, 48.6, 0.5], ['ammo_box', 23.2, 0.92, 48.5, -0.2]);
  // Kisten als Deckung: fester Quader in Manifest-Maßen (props.js dress, solid) – auch ohne Bibliothek gleich
  list.push(['wooden_military_crate', 25.6, 0.12, 50.4, Math.PI / 2 + 0.06, { solid: [1.242, 0.464, 0.52] }]);
  list.push(['old_military_crate', 14.0, 0.12, 49.6, Math.PI / 2, { solid: [1.808, 0.299, 0.968] }]);
  list.push(['metal_jerrycan_green', 26.6, 0.12, 47.2, 0.3], ['metal_jerrycan_green', 26.95, 0.12, 47.55, 1.2]);
  // Steine und ein Totholzstamm im Randstreifen neben den Bahnen
  for (const [x, z, sc] of [[-24.6, -60, 3.2], [25.2, -46, 2.6], [-26.0, -28, 3.6], [24.4, -8, 2.8], [-23.8, 12, 2.4], [26.6, 20, 3.0], [-27.2, -66, 3.8], [27.0, -18, 3.4]]) {
    list.push(['rock_07', x, 0, z, hash01(x, z) * 6.28, { s: sc, castShadow: true }]);
  }
  list.push(['dead_tree_trunk_02', -26.6, 0, -40, 1.45, { s: 1.0 }]);
  dress(b, list);
}

// ---------------------------------------------------------------------------
// Klappziele
// ---------------------------------------------------------------------------
function targetTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 448;
  const g = c.getContext('2d');
  g.fillStyle = '#f2efe6'; g.fillRect(0, 0, 256, 448);
  // Zonen (IPSC-ähnlich, abstrahiert)
  g.strokeStyle = '#1b1d20'; g.lineWidth = 3;
  g.fillStyle = '#ff5b1f'; g.beginPath(); g.ellipse(128, 250, 62, 92, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#f2efe6'; g.beginPath(); g.ellipse(128, 250, 30, 46, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#ff5b1f'; g.beginPath(); g.arc(128, 66, 30, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#1b1d20'; g.font = '700 26px "JetBrains Mono NP", monospace'; g.textAlign = 'center'; g.fillText('NP', 128, 420);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function silhouetteGeom() {
  // Umriss in Metern (Pivot = Fuß des Pfostens)
  const s = new THREE.Shape();
  const P = [[-0.05, 0.0], [0.05, 0.0], [0.05, 0.52], [0.24, 0.55], [0.27, 0.7], [0.27, 1.12], [0.2, 1.22], [0.08, 1.25], [0.06, 1.28]];
  s.moveTo(P[0][0], P[0][1]);
  for (const [x, y] of P.slice(1)) s.lineTo(x, y);
  s.absarc(0, 1.4, 0.135, -Math.PI / 2 + 0.45, Math.PI * 1.5 - 0.45, false);
  for (const [x, y] of P.slice().reverse()) s.lineTo(-x, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -0.01);
  // UV: Vorderseite auf Textur (x −0.28..0.28, y 0.5..1.56)
  const uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + 0.28) / 0.56, (p.getY(i) - 0.5) / 1.06);
  return g;
}

function createTargets(list) {
  const group = new THREE.Group(); group.name = 'targets';
  const geo = silhouetteGeom();
  const tex = targetTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.2 });
  mat.userData.surface = 'metal'; mat.userData.disposable = true;
  const inst = new THREE.InstancedMesh(geo, mat, list.length);
  inst.castShadow = true; inst.receiveShadow = true; inst.name = 'target-plates';
  inst.frustumCulled = false;
  group.add(inst);
  const hinge = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8).rotateZ(Math.PI / 2), getMaterial('metal_painted'), list.length);
  hinge.name = 'target-hinges'; hinge.castShadow = true;
  group.add(hinge);
  const white = new THREE.Color(1, 1, 1), flash = new THREE.Color(1.6, 0.5, 0.35);
  const m = new THREE.Matrix4();
  const targets = list.map((t, i) => {
    const pivot = new THREE.Object3D();
    pivot.position.set(t.x, 0.12, t.z);
    pivot.userData.targetId = t.id;
    pivot.name = 'target-' + t.id;
    group.add(pivot);
    m.makeTranslation(t.x, 0.17, t.z); hinge.setMatrixAt(i, m);
    inst.setColorAt(i, white);
    const st = { angle: 0, goal: 0, hitT: 0, wobble: 0 };
    const target = {
      id: t.id, lane: t.lane, distance: t.distance, position: pivot.position.clone(), object: pivot, surface: 'metal',
      get isUp() { return st.goal === 0 && st.angle > -0.05; },
      raise() { st.goal = 0; },
      drop() { st.goal = -Math.PI / 2; },
      /** Treffer-Reaktion (kurzes Aufblitzen + Wackeln). */
      hit() { st.hitT = 0.18; st.wobble = 0.22; },
      hittable() { return st.angle > -1.0; },
      hitboxes: [
        { object: pivot, min: new THREE.Vector3(-0.28, 0.5, -0.04), max: new THREE.Vector3(0.28, 1.25, 0.04), zone: 'body' },
        { object: pivot, min: new THREE.Vector3(-0.14, 1.25, -0.04), max: new THREE.Vector3(0.14, 1.55, 0.04), zone: 'head' },
      ],
      update(dt) {
        const prev = st.angle;
        const sp = 7.5 * dt;
        st.angle += Math.max(-sp, Math.min(sp, st.goal - st.angle));
        st.wobble = Math.max(0, st.wobble - dt * 1.4);
        const wob = Math.sin(performance.now() * 0.03) * st.wobble * 0.5;
        pivot.rotation.x = st.angle + wob;
        if (prev !== st.angle || st.wobble > 0 || st.hitT > 0) {
          pivot.updateMatrix(); pivot.updateMatrixWorld();
          inst.setMatrixAt(i, pivot.matrixWorld); inst.instanceMatrix.needsUpdate = true;
        }
        if (st.hitT > 0) { st.hitT -= dt; inst.setColorAt(i, st.hitT > 0 ? flash : white); inst.instanceColor.needsUpdate = true; }
      },
    };
    pivot.rotation.x = st.angle; pivot.updateMatrix(); pivot.updateMatrixWorld();
    inst.setMatrixAt(i, pivot.matrixWorld);
    return target;
  });
  inst.instanceMatrix.needsUpdate = true; hinge.instanceMatrix.needsUpdate = true;
  return {
    group, targets,
    update(dt) { for (const t of targets) t.update(dt); },
    dispose() { geo.dispose(); tex.dispose(); mat.dispose(); hinge.geometry.dispose(); },
  };
}
