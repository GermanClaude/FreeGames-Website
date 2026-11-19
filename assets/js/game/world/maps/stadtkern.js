// NULLPUNKT — Karte „Stadtkern“: Lindenplatz (Strang karten-neu, 14.11.) (Owner: world).
// Dichtes Stadtviertel im Krieg, spiegelgleich in z (Team A im Süden +z, Team B im Norden −z): die Lindenallee mit
// doppeltem Straßenbahngleis, Fahrleitung und zwei ausgebrannten Straßenbahnwagen (begehbar), darunter die U-Bahn-
// Verteilerebene mit Abgängen auf beide Platzhälften; je Seite vier vier-geschossige Altbauten mit Läden
// (Schaufenster, Auslagen), Treppenhäusern bis aufs Dach, möblierten Wohnungen, Balkonen und Toreinfahrten; dahinter
// Hinterhöfe, das Kaufhaus am Platz mit Dachterrasse, Hinterhäuser, eine Hinterstraße (Startbereich) und Querstraßen.
// Vertikales Spiel: Dächer (verbunden über die Brüstungen), Balkone, U-Bahn. Alle Namen frei erfunden.
import { altbau, kaufhaus, hofAusstattung, gleise, fahrleitung, strassenbahn, haltestelle, litfass, telefonzelle, wrack, kulisse, ubahn, UB, FH } from './stadtkern-bau.js?v=20261119182451';
import { sandbags, jersey, lampPost, bench, car, cone, crateStack, barrelGroup, tree, dumpster, hash01 } from '../props.js?v=20261119182451';
import { rubble, igel, bauzaun, KEIN, VG, mittel } from './neu-bau.js?v=20261119182451';

const PI = Math.PI, Q = PI / 2;
const HX = 56, HZ = 56; // Spielfläche (Kulissen dahinter)

/** Boden einer Hälfte (s = ±1); z-Werte als Beträge, Spiegelung hier. */
function boden(b, s) {
  const Z = (a, c) => [Math.min(s * a, s * c), Math.max(s * a, s * c)];
  const g = (x0, a, x1, c, mat, o = {}) => { const [z0, z1] = Z(a, c); b.groundTiled(x0, z0, x1, z1, mat, o); };
  g(-48, 6, 48, 9, 'paving', { cell: 1, tint: '#c8c0b2' });                        // Gehweg Straßenseite
  // Platz mit Treppenloch des U-Bahn-Abgangs (x −11,5 … −8,5, z 9 … 16,4)
  const sx0 = UB.stairX - UB.stairW / 2 - 0.3, sx1 = UB.stairX + UB.stairW / 2 + 0.3, sz1 = UB.stairZ + UB.run;
  g(-14, 9, sx0, 24, 'cobble', { cell: 1, tint: '#c4bcae' });
  g(sx1, 9, 14, 24, 'cobble', { cell: 1, tint: '#c4bcae' });
  g(sx0, sz1, sx1, 24, 'cobble', { cell: 1, tint: '#c4bcae' });
  g(-14, 36, 14, 38, 'concrete', { cell: 1, tint: '#a8a49a' });                    // hinter dem Kaufhaus
  g(-20, 38, 20, 48, 'concrete', { cell: 1, tint: '#a8a49a' });                    // Ladehof
  g(-48, 48, 48, HZ, 'asphalt', { cell: 1, tint: '#d2ccc0' });                     // Hinterstraße
  g(-HX, 6, -48, HZ, 'asphalt', { cell: 1, tint: '#d2ccc0' });                     // Querstraße West
  g(48, 6, HX, HZ, 'asphalt', { cell: 1, tint: '#d2ccc0' });                       // Querstraße Ost
  g(-48, 9, -46, 48, 'paving', { cell: 1, tint: '#c8c0b2' });
  g(46, 9, 48, 48, 'paving', { cell: 1, tint: '#c8c0b2' });
  // Bordsteine (Optik) entlang der Allee
  b.box(0, 0, s * 6.05, 2 * 48, 0.1, 0.2, 'stone_wall', { tint: '#b0a898', ...VG });
}

/** Eine Hälfte (s = +1 Süd/Team A, −1 Nord/Team B). */
function haelfte(b, s, zones) {
  const Z = (z) => s * z;
  boden(b, s);
  // Vorderhäuser (Straßenfassade bei z = 9, Tiefe 12)
  const shops = s > 0 ? ['baecker', 'apotheke', 'eisen', 'mode'] : ['buch', 'kiosk', 'gemuese', 'cafe'];
  altbau(b, { x: -38, zs: Z(9), s, w: 16, d: 12, floors: 4, shop: shops[0], gate: 'w', core: 'e', roof: 'access', sideWin: 'w', nr: s > 0 ? 12 : 13, breaches: [{ side: 'e', at: Z(3), floor: 2 }] });
  altbau(b, { x: -22, zs: Z(9), s, w: 16, d: 12, floors: 4, shop: shops[1], gate: null, core: 'w', roof: s > 0 ? 'ruin' : 'flat', nr: s > 0 ? 14 : 15, breaches: [{ side: 'w', at: Z(3), floor: 2 }] });
  altbau(b, { x: 22, zs: Z(9), s, w: 16, d: 12, floors: 4, shop: shops[2], gate: null, core: 'e', roof: s > 0 ? 'flat' : 'ruin', nr: s > 0 ? 22 : 23, breaches: [{ side: 'e', at: Z(3), floor: 1 }] });
  altbau(b, { x: 38, zs: Z(9), s, w: 16, d: 12, floors: 4, shop: shops[3], gate: 'e', core: 'w', roof: 'access', sideWin: 'e', nr: s > 0 ? 24 : 25, breaches: [{ side: 'w', at: Z(3), floor: 1 }] });
  // Kaufhaus am Platz
  kaufhaus(b, 0, Z(24), s);
  // Hinterhäuser (3 Geschosse, Hof-Fassade bei z = 38, Tiefe 10; Toreinfahrt zur Hinterstraße)
  altbau(b, { x: -33, zs: Z(38), s, w: 26, d: 10, floors: 3, shop: null, gate: 'e', core: 'w', roof: 'access', nr: s > 0 ? '12a' : '13a', balcony: false, color: '#b8ad98', mat: 'plaster_patched' });
  altbau(b, { x: 33, zs: Z(38), s, w: 26, d: 10, floors: 3, shop: null, gate: 'w', core: 'e', roof: 'flat', nr: s > 0 ? '24a' : '25a', balcony: false, color: '#c2b49e' });
  // Hinterhöfe
  hofAusstattung(b, -46, Z(21), -14, Z(38), s);
  hofAusstattung(b, 14, Z(21), 46, Z(38), s);
  zones.push({ x0: -46, z0: Math.min(Z(21), Z(38)), x1: -14, z1: Math.max(Z(21), Z(38)), kind: 'yard' }, { x0: 14, z0: Math.min(Z(21), Z(38)), x1: 46, z1: Math.max(Z(21), Z(38)), kind: 'yard' });
  // Platz: Denkmal (beschädigt), Bänke, Linden, Litfaßsäule, Telefonzelle, Sandsack-Stellung, Fahrradständer
  const pz = Z(18);
  b.box(4, 0, pz, 3.2, 1.2, 3.2, 'stone_wall', { tint: '#b4ac9c', minimap: 'cover' });
  b.box(4, 1.2, pz, 2.6, 0.3, 2.6, 'stone_wall', { tint: '#a49c8c', ...VG });
  b.cyl(4, 1.5, pz, 0.5, 1.6, 'metal_painted', { tint: '#3e5a4e', minimap: false, r1: 0.4, seg: 10 });   // Bronzefigur (Rumpf, Kopf ab)
  b.box(4.6, 1.5, pz + s * 0.6, 0.5, 0.25, 0.9, 'metal_painted', { tint: '#3e5a4e', ...VG, rx: 0.5 });
  rubble(b, 6.2, pz - s * 1.6, 0.8, { mat: 'stone_wall', tint: '#a49c8c' });
  b.defineSign('denkmal', { style: 'plate', text: 'DEN GRÜNDERN DER STADT', bg: '#8a7a5a', fg: '#2a2418' });
  b.sign(4, 0.65, pz - s * 1.62, 1.8, 0.4, 'denkmal', { ry: s > 0 ? PI : 0, back: false, depth: 0.01 });
  for (const x of [-4, 10]) { tree(b, x, Z(21.5), { kind: 'tree', h: 4.4, s: 1.3 }); bench(b, x, Z(19.6), { ry: s > 0 ? PI : 0 }); }
  litfass(b, 11.5, Z(12));
  telefonzelle(b, -5.5, Z(10.2), s > 0 ? PI : 0);
  sandbags(b, -2, Z(13.5), 2.5, Z(13.5), { rows: 4, double: true });
  sandbags(b, 2.5, Z(13.5), 3.5, Z(15.5), { rows: 4, double: true });
  for (let k = 0; k < 5; k++) b.box(-3 + k * 0.6, 0, Z(22.8), 0.05, 0.75, 1.2, 'metal_galvanized', { ...KEIN });
  // Gehweg: Laternen, Haltestelle, Hydrant, Poller
  for (const x of [-42, -18, 18, 42]) lampPost(b, x, Z(8.3), { h: 6.2, ry: s > 0 ? Q : -Q, kind: 'warm', arm: 1.0 });
  haltestelle(b, 30, Z(7.8), s);
  b.model('fire_hydrant', -30, 0, Z(8.2), { ry: s > 0 ? PI : 0, collide: false });
  b.box(-30, 0, Z(8.2), 0.4, 0.8, 0.4, 'black', { visual: false, minimap: 'prop' });
  // Hinterstraße (Startbereich): Autos, Container, Absperrung
  car(b, -26, Z(52.5), { ry: Q, color: '#6a7a52' });
  car(b, 12, Z(52.5), { ry: -Q, color: '#8c2b24' });
  wrack(b, 30, Z(51.5), Q + 0.2);
  dumpster(b, -6, Z(54.6), { ry: 0 });
  dumpster(b, 40, Z(54.6), { ry: 0, color: '#5a5f66' });
  crateStack(b, -40, Z(53.6), { ry: 0.2 });
  // Ladehof: Lieferwagenwrack, Paletten, Fässer
  wrack(b, -6, Z(43), 0.15, { color: '#2e2c2a' });
  barrelGroup(b, 8, Z(45), { n: 4 });
  crateStack(b, 14, Z(40.5), { ry: -0.3 });
  // Querstraßen: Barrikaden, Autowracks, Panzersperren
  for (const sx of [-1, 1]) {
    wrack(b, sx * 52, Z(22), (sx > 0 ? 0.1 : -0.15) + (s > 0 ? 0 : PI));
    for (let k = 0; k < 3; k++) igel(b, sx * (50 + k * 2), Z(36 + (k % 2)));
    sandbags(b, sx * 49, Z(14), sx * 55, Z(14.5), { rows: 4, double: true });
    jersey(b, sx * 52, Z(44), { len: 3, ry: 0.1 });
  }
}

/** Mitte (z = 0): Lindenallee, Gleise, Fahrleitung, Straßenbahnen, U-Bahn, Krater, Barrikaden. */
function allee(b, zones) {
  b.groundTiled(-HX, -6, HX, 6, 'asphalt', { cell: 1, tint: '#d8d2c6' });
  zones.push({ x0: -HX, z0: -6, x1: HX, z1: 6, kind: 'road' });
  gleise(b, -HX, HX, [-1.6, 1.6]);
  fahrleitung(b, -48, 48, [-1.6, 1.6], 8.6);
  // Straßenmarkierung (Fahrstreifen außen)
  for (let x = -54; x < 54; x += 6) for (const z of [-4.2, 4.2]) b.decal(x, 0.01, z, 3, 0.6, 'line', { ry: 0, tint: '#e8e4dc', kind: 'paint', opacity: 0.55 });
  // ausgebrannte Straßenbahnen (punktsymmetrisch) und Trümmer
  strassenbahn(b, -13, -1.6, { ry: 0.05 });
  strassenbahn(b, 13, 1.6, { ry: PI + 0.05 });
  // Krater in der Fahrbahn (Optik + Schutthügel), Asphaltrisse
  for (const [x, z, r] of [[-30, 3.2, 1.3], [30, -3.2, 1.3], [0, 4.6, 0.9], [0, -4.6, 0.9], [-44, -3.5, 1.0], [44, 3.5, 1.0]]) {
    b.decal(x, 0.012, z, r * 3.4, r * 3.4, 'cracks', { opacity: 0.9 });
    b.decal(x, 0.014, z, r * 2.2, r * 2.2, 'soot', { opacity: 0.7 });
    rubble(b, x + r * 0.9, z, r * 0.7, { mat: 'asphalt', tint: '#5a5854' });
  }
  // Barrikaden auf der Allee (versetzt, beidseits gleich)
  for (const s of [-1, 1]) {
    sandbags(b, s * 34, s * 1.0, s * 34, s * 5.5, { rows: 5, double: true });
    for (let k = 0; k < 2; k++) jersey(b, s * 24, s * (-3.6 + k * 3.2), { len: 3, ry: Q });
    igel(b, s * 46, -s * 2.8);
    wrack(b, s * 40, -s * 3.6, s > 0 ? 0.2 : PI + 0.2);
  }
  // Kartenränder: Barrikaden an den Straßenenden
  for (const sx of [-1, 1]) {
    bauzaun(b, sx * HX, -8, sx * HX, 8);
    for (let k = 0; k < 4; k++) igel(b, sx * (HX - 2), -6 + k * 4);
  }
  // Kreuzungen Allee/Querstraße: Ampeln (aus), Straßenschilder; Kanaldeckel und Abläufe
  b.defineSign('str_allee', { style: 'plate', text: 'LINDENALLEE', bg: '#f2f0ea', fg: '#1c1c1c' });
  b.defineSign('str_quer', { style: 'plate', text: 'SPEICHERSTRASSE', bg: '#f2f0ea', fg: '#1c1c1c' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = sx * 47.2, pz = sz * 7.4;
    b.cyl(px, 0, pz, 0.07, 3.6, 'metal_painted', { tint: '#3d4247', seg: 8, minimap: 'prop' });
    b.box(px, 2.4, pz - sz * 0.15, 0.32, 0.95, 0.28, 'metal_painted', { tint: '#1c1c1c', ...KEIN });
    for (let k = 0; k < 3; k++) b.cyl(px, 3.13 - k * 0.3, pz - sz * 0.3, 0.09, 0.03, k === 0 ? 'lamp_redlens' : k === 1 ? 'lamp_orange' : 'lamp_green', { axis: 'z', ...KEIN, seg: 10, ao: false });
    b.sign(px, 3.65, pz, 1.6, 0.32, 'str_allee', { ry: 0 });
    b.sign(px, 3.3, pz, 1.8, 0.32, 'str_quer', { ry: Q });
  }
  for (let x = -50; x <= 50; x += 12.5) { b.decal(x, 0.012, 3.6 * (x % 25 ? 1 : -1), 0.8, 0.8, 'manhole', { opacity: 0.85 }); b.decal(x + 3, 0.012, -5.6, 0.5, 0.9, 'drain', { opacity: 0.8, ry: 0 }); b.decal(x - 3, 0.012, 5.6, 0.5, 0.9, 'drain', { opacity: 0.8, ry: 0 }); }
  ubahn(b);
  b.footprints.push({ x: (UB.x0 + UB.x1) / 2, z: 0, hw: (UB.x1 - UB.x0) / 2, hd: 9, ry: 0, y0: UB.y, y1: UB.y + 3.6, kind: 'floor' });
}

/** Kulissen hinter den Kartenrändern (massiv) + Bodenfläche außen. */
function rand(b) {
  for (const s of [-1, 1]) {
    // hinter der Hinterstraße
    kulisse(b, -64, s > 0 ? HZ : -HZ - 8, -18, s > 0 ? HZ + 8 : -HZ, 14, s > 0 ? 'n' : 's', '#b9b4aa');
    kulisse(b, -18, s > 0 ? HZ : -HZ - 8, 24, s > 0 ? HZ + 8 : -HZ, 11, s > 0 ? 'n' : 's', '#b8ae9a');
    kulisse(b, 24, s > 0 ? HZ : -HZ - 8, 64, s > 0 ? HZ + 8 : -HZ, 15, s > 0 ? 'n' : 's', '#c9a98e');
    // jenseits der Querstraßen (die Allee ist mit Bauzaun gesperrt)
    kulisse(b, s > 0 ? HX : -HX - 8, 8, s > 0 ? HX + 8 : -HX, HZ, 14, s > 0 ? 'w' : 'e', '#c6bba6');
    kulisse(b, s > 0 ? HX : -HX - 8, -HZ, s > 0 ? HX + 8 : -HX, -8, 13, s > 0 ? 'w' : 'e', '#aeb3ae');
  }
  // Allee jenseits der Sperre (Optik), Boden außen
  b.groundTiled(HX, -8, 130, 8, 'asphalt', { cell: 4, collide: false, groundAO: false, chunk: 900, tint: '#cfc9bd' });
  b.groundTiled(-130, -8, -HX, 8, 'asphalt', { cell: 4, collide: false, groundAO: false, chunk: 901, tint: '#cfc9bd' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kulisse(b, sx > 0 ? 64 : -110, sz > 0 ? 8 : -60, sx > 0 ? 110 : -64, sz > 0 ? 60 : -8, 18, sz > 0 ? 'n' : 's', '#b4aa96');
  // unsichtbare Grenze (Sicherheitsnetz)
  b.collider(-HX - 0.4, -8, 0, 0.8, 40, 2 * HZ + 2);
  b.collider(HX + 0.4, -8, 0, 0.8, 40, 2 * HZ + 2);
  b.collider(0, -8, -HZ - 0.4, 2 * HX + 2, 40, 0.8);
  b.collider(0, -8, HZ + 0.4, 2 * HX + 2, 40, 0.8);
}

export default {
  id: 'stadtkern',
  seed: 4417,
  bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ, minY: -6, maxY: 24 },
  visualBounds: { minX: -130, maxX: 130, minZ: -130, maxZ: 130 },
  chunkSize: 32,
  ambience: 'industrial',
  // texturen 14.11.: neue Fotoscan-Sätze – dunkler Straßenasphalt, Gehwegplatten; Beton/Putz/Ziegel aus der Standardzuordnung
  assets: { hdri: 'np_sky_nachmittag_dunst', materials: { asphalt: 'asphalt_dark', paving: 'paving_slabs' } },
  defaultSurface: 'concrete',
  navSpacing: 1.5,
  groundNoise: 0.18,
  interiorTint: [1, 0.96, 0.9],
  lighting: {
    sun: { elevation: 32, azimuth: 228, color: '#ffe2c0', intensity: 3.1 },
    sky: { turbidity: 8, rayleigh: 0.9, mieCoefficient: 0.007, mieDirectionalG: 0.8, exposure: 0.66, clouds: { coverage: 0.6, density: 0.5, scale: 0.00018, elevation: 0.5, speed: 0.00002 }, hazeHigh: 0.3, hazeAmount: 1.1, hdriIntensity: 1.9 },
    hemi: { sky: '#d0ccc4', ground: '#6f6a62', intensity: 1.5, hdriIntensity: 1.25 },
    env: { intensity: 1.7, ground: '#6f6b64', groundIntensity: 0.6, tint: '#f0ece6', hdriIntensity: 1.5, hdriTint: '#ece2d4' },
    fog: { color: '#bdb6aa', near: 50, far: 300, density: 0.006, falloff: 0.05, start: 14, sun: 0.4, sunExp: 6 },
    shadow: { size: 46, bias: -0.0005, radius: 2.6 },
    probes: { bounce: 2.2, skyMin: 0.045 },
    // Rauch/Staub in der Luft (Kriegsschauplatz), Strahlen durch Fenster in die Wohnungen
    atmos: { beams: 0.022, beamG: 0.5, beamTint: '#ffd8a8', dust: 1.3, outdoor: 0.45 },
  },

  build(b) {
    const zones = [];
    allee(b, zones);
    haelfte(b, 1, zones);
    haelfte(b, -1, zones);
    rand(b);
    // Startpunkte: Hinterstraßen (A Süd, B Nord); FFA verteilt (Höfe, Läden, Platz, U-Bahn, Dächer nicht)
    const spawns = { A: [], B: [], ffa: [] };
    for (const x of [-44, -36, -20, -12, -2, 6, 18, 24, 36, 44, -52, 52]) { spawns.A.push({ x, z: x === -52 || x === 52 ? 46 : 51.5, yaw: 0 }); spawns.B.push({ x, z: x === -52 || x === 52 ? -46 : -51.5, yaw: PI }); }
    for (const [x, z, y] of [[-26, 27], [26, -27], [-26, -27], [26, 27], [0, 16], [0, -16], [-8, 3, -4.0], [-14, -5, -4.0], [-52, 0], [52, 0], [-38, 7.6], [38, -7.6], [22, 7.6], [-22, -7.6], [0, 42], [0, -42], [-40, 44], [40, -44]]) spawns.ffa.push(y != null ? { x, z, y } : { x, z });
    return {
      spawns,
      objectives: { dom: [{ id: 'A', x: -38, z: 0, radius: 5.5 }, { id: 'B', x: -8, z: 0, y: -4.0, radius: 5 }, { id: 'C', x: 38, z: 0, radius: 5.5 }] },
      zones,
    };
  },
};
