// NULLPUNKT — Großkarte „Flugplatz“: Bauwerke und Ausstattung (Strang karten-neu, 14.11.) (Owner: world).
// Hangars mit Tonnendach (begehbar: Werkstatt, Galerie, zweigeschossige Büros), Flugzeugschutzbauten, Kontrollturm mit
// Treppenhaus bis zur Kanzel, Feuerwache, Tanklager mit Auffangwannen und Treppenturm, Radarstellung, Flakstellungen,
// Kaserne mit Stuben, Kantine, Fahrzeughof mit Werkstatt und Tankstelle, Wache am Haupttor, Wachtürme, Zaun,
// Startbahn-Markierung und -Befeuerung, Hubschrauberlandeplätze. Alles frei erfunden (Fliegerhorst „Hagenmoor“).
// Koordinaten: x Osten, z Süden (Norden = −z). Zufall nur über hash01 bzw. den Ortschafts-Zufall (b.rand).
import * as THREE from 'three';
import { building, wall, stairs, railing, catwalk, slab } from '../arch.js?v=20261122020853';
import { frame, hash01, container, crateStack, barrelGroup, palletStack, sandbags, fence, lampPost, floodMast, tires, workbench, lockers, rack, gasBottles, electricBox, pipe, cone, jersey, truck, van, forklift, cableReel, dress } from '../props.js?v=20261122020853';
import { flight, stairCore, vaultGeom, gableGeom, vaultProfile, KEIN, VG, hoch, mittel, rubble, igel } from './neu-bau.js?v=20261122020853';
import { deckenlampe, kafiglampe, tisch, stuhl, essplatz, bett, schrank, stockbett, waschtisch, munitionskisten, funktisch, werkzeugwand, bild, teppich } from './grenzland-innen.js?v=20261122020853';
import { schreibtisch, stuhl as bueroStuhl, aktenschrank, regal as stahlregal, besprechung, kuechenzeile, kuehlschrank, spinde, deckenleuchte, pinnwand, wasserspender } from './hafen-ausstattung.js?v=20261122020853';
import { mgNest } from './grenzland-stellungen.js?v=20261122020853';

const PI = Math.PI, Q = PI / 2;
const OLIV = '#6b7458', OLIV_D = '#4f5742', BETON = '#b4b0a6', HANGAR = '#8a9182';

/** Hängeleuchte (Bibliothek) mit prozeduralem Ersatz, Lichtkegel am Boden, echtes Licht nur auf hoch/ultra (o.real). */
function hallenlampe(b, x, yTop, z, yF, o = {}) {
  const yl = yTop - 1.36;
  b.model('hanging_industrial_lamp', x, yl, z, { s: 1.0, castShadow: false, maxDist: 110, fallback: (bb) => {
    bb.cyl(x, yl + 0.4, z, 0.01, 0.96, 'black', { ...KEIN, seg: 4, ao: false });
    bb.cyl(x, yl, z, 0.28, 0.4, 'metal_painted', { r1: 0.06, tint: '#3a4a3e', ...KEIN, seg: 12 });
  } });
  b.box(x, yl - 0.01, z, 0.36, 0.01, 0.36, 'lamp_cool', { ...VG, ao: false, cast: false });
  b.glow(x, yl - 0.05, z, { size: 1.4, color: '#e6efff', intensity: 0.5 });
  b.decal(x, yF + 0.02, z, 5.5, 5.2, 'puddle', { kind: 'light', tint: '#e2ecff', opacity: 0.22, ry: hash01(x, z, 3) * 6.28 });
  if (o.real && hoch(b)) b.light('point', x, yl - 0.4, z, { color: '#eef3ff', intensity: 14, distance: 18, priority: 2 });
}

/** Feuerlöscher an der Wand bzw. auf dem Boden. */
function loescher(b, x, y, z) {
  b.cyl(x, y, z, 0.08, 0.5, 'metal_painted', { tint: '#c8302a', ...KEIN, seg: 8 });
  b.cyl(x, y + 0.5, z, 0.03, 0.08, 'black', { ...KEIN, seg: 6, ao: false });
}

/** Bodenlinie (Farbe) von A nach B. */
function linie(b, x0, z0, x1, z1, y, tint = '#e8c22c', w = 0.18) {
  const L = Math.hypot(x1 - x0, z1 - z0);
  if (L < 0.05) return;
  // Atlaszelle „line“: Streifen entlang der Decal-Breite (u), ¼ der Tiefe → Tiefe = 4 × Strichbreite
  b.decal((x0 + x1) / 2, y, (z0 + z1) / 2, L, w * 4, 'line', { ry: Math.atan2(-(z1 - z0), x1 - x0), tint, kind: 'paint', opacity: 0.85 });
}

// ---------------------------------------------------------------------------
// Flugzeug-Attrappen (Kulisse, nicht fliegbar)
// ---------------------------------------------------------------------------
/** Propeller-Schulflugzeug (Tiefdecker) in Wartung, Nase lokal +z. o: { open (Motorhaube ab), tint } */
export function schulflugzeug(b, x, z, ry = 0, o = {}) {
  const y = o.y ?? 0, f = frame(b, x, y, z, ry), col = o.tint || '#d9d6cc', akz = o.akzent || '#c8402f';
  const g = { ...KEIN, grad: false };
  // Rumpf: Röhre, nach hinten verjüngt
  f.cyl(0, 1.55, 0.6, 0.62, 4.2, 'metal_painted', { axis: 'z', tint: col, ...g, seg: 16 });
  f.cyl(0, 1.6, -3.1, 0.62, 3.2, 'metal_painted', { axis: 'z', r1: 0.2, tint: col, ...g, seg: 16 });
  f.cyl(0, 1.55, 3.05, 0.62, 0.7, 'metal_painted', { axis: 'z', r1: 0.42, tint: o.open ? '#5a5f66' : col, ...g, seg: 16 });
  if (!o.open) f.cyl(0, 1.55, 3.55, 0.2, 0.35, 'metal_painted', { axis: 'z', r1: 0.04, tint: '#2b2d30', ...g, seg: 10 }); // Spinner
  else {
    // offener Motor: Zylinderköpfe
    for (let k = 0; k < 6; k++) { const a = (k / 6) * PI * 2; f.cyl(Math.cos(a) * 0.38, 1.55 + Math.sin(a) * 0.38, 3.05, 0.11, 0.3, 'metal_rust', { axis: 'z', ...g, seg: 8 }); }
  }
  // Propeller (2 Blätter)
  if (!o.open) f.box(0, 0.55, 3.72, 0.16, 2.0, 0.04, 'metal_painted', { tint: '#2b2d30', ...g });
  // Kanzel
  f.cyl(0, 2.0, 0.2, 0.42, 1.8, 'glass', { axis: 'z', ...g, seg: 12, r1: 0.4 });
  // Tragflächen + Leitwerk
  f.box(0, 1.08, 0.75, 10.2, 0.14, 1.7, 'metal_painted', { tint: col, ...g });
  for (const s of [-1, 1]) f.box(s * 4.85, 1.08, 0.75, 0.5, 0.15, 1.72, 'metal_painted', { tint: akz, ...g });
  f.box(0, 1.65, -4.4, 3.2, 0.1, 0.9, 'metal_painted', { tint: col, ...g });
  f.box(0, 1.7, -4.45, 0.1, 1.35, 1.0, 'metal_painted', { tint: col, ...g });
  f.box(0, 2.6, -4.55, 0.11, 0.45, 0.75, 'metal_painted', { tint: akz, ...g });
  // Fahrwerk
  for (const s of [-1, 1]) {
    f.box(s * 1.35, 0.45, 1.05, 0.08, 0.65, 0.08, 'metal_painted', { tint: '#3d4247', ...g });
    f.cyl(s * 1.35, 0.32, 1.05, 0.32, 0.16, 'rubber', { axis: 'x', ...g, seg: 12 });
  }
  f.cyl(0, 0.13, -4.3, 0.13, 0.08, 'rubber', { axis: 'x', ...g, seg: 10 });
  // Hoheitszeichen (Kreis auf den Flächen, erfunden: gelber Ring auf Oliv)
  for (const s of [-1, 1]) { const [cx, cz] = f.P(s * 3.4, 0.75); b.decal(cx, y + 1.235, cz, 1.0, 1.0, 'manhole', { kind: 'paint', tint: '#5a6a3a', opacity: 0.9, ry }); }
  // Kollision: Rumpf + Flächen als flache Quader (Deckung, Kugeln treffen)
  f.solid(0, 0.9, -0.4, 1.3, 1.35, 8.2, { minimap: 'vehicle' });
  f.solid(0, 1.05, 0.75, 10.2, 0.2, 1.7, { minimap: false });
}

/** Fahrbares Flugzeug-Schleppfahrzeug (Kulisse). */
export function schlepper(b, x, z, ry = 0, y = 0) {
  const f = frame(b, x, y, z, ry);
  f.box(0, 0.3, 0, 1.9, 0.75, 3.6, 'metal_painted', { tint: '#d9a72a', ...KEIN });
  f.box(0, 1.05, -0.9, 1.6, 0.9, 1.1, 'glass', { ...VG });
  f.box(0, 1.95, -0.9, 1.7, 0.06, 1.2, 'metal_painted', { tint: '#d9a72a', ...VG });
  for (const sx of [-0.95, 0.95]) for (const sz of [-1.1, 1.1]) f.cyl(sx, 0.38, sz, 0.38, 0.3, 'rubber', { axis: 'x', ...VG, seg: 12 });
  f.box(0, 0.4, 1.95, 0.3, 0.2, 0.5, 'metal_painted', { tint: '#2b2d30', ...VG });
  f.solid(0, 0, 0, 1.95, 1.35, 3.7, { minimap: 'vehicle' });
}

/** Bodenstromaggregat (Anhänger). */
export function bodenstrom(b, x, z, ry = 0, y = 0) {
  const f = frame(b, x, y, z, ry);
  f.box(0, 0.45, 0, 1.3, 1.1, 2.2, 'metal_painted', { tint: '#e2c23a', ...KEIN });
  f.box(0, 1.55, 0, 1.36, 0.06, 2.26, 'metal_painted', { tint: '#3a3d40', ...VG });
  for (const sx of [-0.7, 0.7]) f.cyl(sx, 0.3, 0.5, 0.3, 0.18, 'rubber', { axis: 'x', ...VG, seg: 10 });
  f.box(0, 0.25, 1.4, 0.08, 0.06, 0.9, 'metal_painted', { tint: '#2b2d30', ...VG });
  f.box(0.66, 0.8, -0.5, 0.02, 0.5, 0.7, 'metal_painted', { tint: '#2b2d30', ...VG });
  f.solid(0, 0, 0, 1.35, 1.6, 2.25, { minimap: 'cover' });
}

/** Munitionsanhänger mit Bomben/Raketen (Kulisse). */
export function munitionswagen(b, x, z, ry = 0, y = 0) {
  const f = frame(b, x, y, z, ry);
  f.box(0, 0.42, 0, 1.6, 0.12, 3.0, 'metal_painted', { tint: OLIV_D, ...KEIN });
  for (const sx of [-0.7, 0.7]) for (const sz of [-1.0, 1.0]) f.cyl(sx, 0.22, sz, 0.22, 0.14, 'rubber', { axis: 'x', ...VG, seg: 10 });
  for (const sx of [-0.4, 0.4]) {
    f.cyl(sx, 0.78, 0, 0.22, 2.2, 'metal_painted', { axis: 'z', tint: '#5a6450', ...VG, seg: 12 });
    f.cyl(sx, 0.78, 1.1, 0.22, 0.4, 'metal_painted', { axis: 'z', r1: 0.04, tint: '#5a6450', ...VG, seg: 12 });
    f.box(sx, 0.62, -1.15, 0.5, 0.32, 0.03, 'metal_painted', { tint: '#4a5040', ...VG });
    f.box(sx, 0.78, 0.4, 0.46, 0.02, 0.06, 'metal_painted', { tint: '#d9a72a', ...VG, ao: false });
  }
  f.solid(0, 0, 0, 1.6, 1.05, 3.0, { minimap: 'cover' });
}

/** Militär-Lkw mit Plane (Kulisse, nicht fahrbar), Front lokal +z. */
export function armeeLkw(b, x, z, ry = 0, o = {}) {
  const y = o.y ?? 0, f = frame(b, x, y, z, ry), c = o.tint || OLIV;
  f.box(0, 0.75, 2.6, 2.4, 1.6, 1.9, 'metal_painted', { tint: c, ...KEIN });
  f.box(0, 1.55, 3.56, 2.1, 0.7, 0.02, 'glass', { ...VG, ao: false });
  f.box(0, 0.6, 3.6, 2.42, 0.6, 0.12, 'metal_painted', { tint: '#2b2d30', ...VG });
  f.box(0, 0.85, 0.65, 1.0, 0.3, 7.5, 'metal_painted', { tint: '#26282b', ...VG });
  f.box(0, 1.15, -1.1, 2.45, 0.12, 4.6, 'wood_planks', { tint: '#6a5a42', ...VG });
  f.box(0, 1.27, -1.1, 2.45, 2.05, 4.6, 'tarp', { tint: o.plane || '#5d6345', ...KEIN });
  for (const sx of [-1.05, 1.05]) for (const sz of [2.7, -0.4, -1.9]) f.cyl(sx, 0.52, sz, 0.52, 0.42, 'rubber', { axis: 'x', ...VG, seg: 12 });
  for (const sx of [-0.85, 0.85]) f.box(sx, 1.1, 3.62, 0.25, 0.12, 0.02, 'lamp_warm', { ...VG, ao: false });
  f.solid(0, 0, 0.6, 2.5, 3.3, 7.6, { minimap: 'vehicle' });
}

/** Tankwagen (Flugfeld-Betankung), Kulisse. */
export function tankwagen(b, x, z, ry = 0, y = 0) {
  const f = frame(b, x, y, z, ry);
  f.box(0, 0.75, 3.0, 2.4, 1.7, 1.8, 'metal_painted', { tint: '#c8402f', ...KEIN });
  f.box(0, 1.6, 3.91, 2.1, 0.7, 0.02, 'glass', { ...VG, ao: false });
  f.box(0, 0.85, 0, 1.0, 0.3, 7.6, 'metal_painted', { tint: '#26282b', ...VG });
  f.cyl(0, 2.0, -0.6, 1.15, 5.6, 'metal_painted', { axis: 'z', tint: '#c9ccc8', ...KEIN, seg: 16 }); // (verzinkt las sich auf Zylindern wie Holz)
  f.box(0, 3.15, -0.6, 0.7, 0.08, 4.8, 'metal_grate', { ...VG });
  f.box(0, 1.1, -3.5, 2.2, 0.8, 0.5, 'metal_painted', { tint: '#c8402f', ...VG });
  for (const sx of [-1.05, 1.05]) for (const sz of [3.0, -1.8, -2.9]) f.cyl(sx, 0.52, sz, 0.52, 0.4, 'rubber', { axis: 'x', ...VG, seg: 12 });
  f.solid(0, 0, 0, 2.5, 3.2, 8.0, { minimap: 'vehicle' });
}

/** Zweirohr-Flak auf Sockellafette (Kulisse), Rohre zeigen lokal +z und nach oben. */
export function flak(b, x, y, z, ry = 0, elev = 0.5) {
  const f = frame(b, x, y, z, ry), g = { ...KEIN, grad: false };
  f.cyl(0, 0, 0, 1.2, 0.25, 'metal_painted', { tint: OLIV_D, ...KEIN, seg: 16 });
  for (let k = 0; k < 4; k++) { const a = (k / 4) * PI * 2 + 0.785; f.box(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4, 0.3, 0.18, 1.6, 'metal_painted', { tint: OLIV_D, ...g, ry: -a }); }
  f.cyl(0, 0.25, 0, 0.55, 0.9, 'metal_painted', { tint: OLIV, ...g, seg: 12 });
  f.box(0, 1.1, 0, 1.6, 0.9, 1.4, 'metal_painted', { tint: OLIV, ...g });
  f.box(-1.0, 1.0, -0.3, 0.5, 0.6, 0.6, 'metal_painted', { tint: OLIV_D, ...g });
  f.box(0.9, 1.15, -0.5, 0.06, 0.6, 0.06, 'metal_painted', { tint: '#2b2d30', ...g });
  f.box(0.9, 1.55, -0.6, 0.4, 0.04, 0.4, 'metal_painted', { tint: '#2b2d30', ...g });
  for (const s of [-0.35, 0.35]) {
    const [px, pz] = f.P(s, 0.3);
    const dirY = Math.sin(elev), dirH = Math.cos(elev), L = 3.2;
    b.cyl(px + Math.sin(ry) * dirH * L / 2, y + 1.6 + dirY * L / 2, pz + Math.cos(ry) * dirH * L / 2, 0.07, L, 'gunmetal', { axis: 'z', ry, rx: -elev, ...g, seg: 8 });
    b.cyl(px + Math.sin(ry) * dirH * (L + 0.1), y + 1.6 + dirY * (L + 0.1), pz + Math.cos(ry) * dirH * (L + 0.1), 0.1, 0.35, 'gunmetal', { axis: 'z', ry, rx: -elev, ...g, seg: 8 });
  }
  f.solid(0, 0, 0, 2.0, 2.1, 2.0, { minimap: 'prop' });
}

/** Kreisförmige Sandsack-Stellung (Radius r, offen nach lokal −z über ±gap). */
function ringStellung(b, x, y, z, r, ry = 0, gap = 0.5, rows = 5) {
  const n = Math.max(6, Math.round((2 * PI * r) / 2.4));
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * PI * 2, a1 = ((k + 1) / n) * PI * 2, am = (a0 + a1) / 2;
    const rel = Math.atan2(Math.sin(am), Math.cos(am)); // 0 = lokal +z
    if (Math.abs(Math.abs(rel) - PI) < gap) continue;
    const p = (a) => [x + Math.sin(a + ry) * r, z + Math.cos(a + ry) * r];
    const [ax, az] = p(a0 - 0.04), [bx, bz] = p(a1 + 0.04);
    sandbags(b, ax, az, bx, bz, { rows, y, double: true });
  }
}

/** Tarnnetz-Dach über einer Stellung (vier Stangen, schräge Plane). */
function tarnnetz(b, x, y, z, w, d, h = 2.6, ry = 0) {
  const f = frame(b, x, y, z, ry);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.cyl(sx * w / 2, 0, sz * d / 2, 0.05, h - (sz > 0 ? 0.4 : 0), 'wood_dark', { ...KEIN, seg: 6 });
  f.box(0, h - 0.25, 0, w + 0.6, 0.05, d + 0.6, 'fabric_camo_a', { ...VG, rx: 0.08, tint: '#7c8462', cast: true, bullet: false });
}

// ---------------------------------------------------------------------------
// Hangar
// ---------------------------------------------------------------------------
/**
 * Hangar mit Tonnendach, Tor nach Süden (+z). o: { x, z, w (44), d (36), H (Wandhöhe 7), rise (Stich 7), nr, kind:
 * 'flugzeug'|'triebwerk'|'lager', closed (0..1 Torflügel halb zu) }.
 * Innen: zweigeschossiger Büroeinbau an der Rückwand (Fenster zur Halle) mit Stahltreppe und Galerie, Werkstatt.
 * → { x0, x1, z0, z1 }
 */
export function hangar(b, o) {
  const { x, z } = o, w = o.w ?? 44, d = o.d ?? 36, H = o.H ?? 7, rise = o.rise ?? 7, t = 0.35;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const doorW = w - 8, doorH = H + 2.2;
  b.interior(x0 + 0.1, z0 + 0.1, x1 - 0.1, z1 - 0.3, -0.2, H + rise, 0.6);
  // Hallenboden (Epoxid, gelbe Linien)
  b.box(x, 0, z, w - 2 * t, 0.08, d - t, 'epoxy', { grad: false, minimap: false, tint: '#bdbab0' });
  const yF = 0.08;
  linie(b, x0 + 3, z1 - 1, x0 + 3, z0 + 7, yF + 0.01); linie(b, x1 - 3, z1 - 1, x1 - 3, z0 + 7, yF + 0.01);
  linie(b, x, z1 - 1, x, z - 2, yF + 0.01, '#e8c22c', 0.25);
  b.decal(x, yF + 0.012, z1 - 4, 2.2, 3.4, 'arrow', { ry: PI, tint: '#e8c22c', kind: 'paint', opacity: 0.8 });
  for (let k = 0; k < 5; k++) b.decal(x + (hash01(x, k, 1) - 0.5) * (w - 10), yF + 0.01, z + (hash01(k, z, 2) - 0.5) * (d - 10), 2 + hash01(k, x, 3) * 2, 2 + hash01(z, k, 4) * 2, 'oil', { opacity: 0.55 });
  // Längswände (Ost/West): Betonsockel, Blech, Oberlichtband, Personaltür
  const sideOps = (sid) => {
    const ops = [];
    for (let at = -d / 2 + 4; at <= d / 2 - 4 + 0.01; at += 5.5) ops.push({ at: at + d / 2, w: 3.6, h: 1.5, sill: H - 2.2, kind: 'window', glass: false, grid: [4, 2], frameMat: 'metal_painted', frameTint: '#4a5048' });
    ops.push({ at: sid === 'w' ? d - 5 : 5, w: 1.1, h: 2.15, kind: 'door', leaf: 'open', frameMat: 'metal_painted', frameTint: '#4a5048', leafTint: '#5a6450' });
    return ops;
  };
  wall(b, { x0: x0 + t / 2, z0: z1, x1: x0 + t / 2, z1: z0, y: 0, h: H, t, mat: 'metal_corrugated', tint: o.tint || HANGAR, openings: sideOps('w'), plinth: { h: 1.2, mat: 'concrete_dark', tint: '#9a978e', over: 0.04 }, outside: 'left' });
  wall(b, { x0: x1 - t / 2, z0: z0, x1: x1 - t / 2, z1: z1, y: 0, h: H, t, mat: 'metal_corrugated', tint: o.tint || HANGAR, openings: sideOps('e').map((op) => ({ ...op, at: d - op.at })), plinth: { h: 1.2, mat: 'concrete_dark', tint: '#9a978e', over: 0.04 }, outside: 'left' });
  // Giebelwände: Rückwand geschlossen, Front mit Toröffnung
  const back = gableGeom(w, H, rise, t);
  b.geom(back, x, 0, z0 + t / 2, 'metal_corrugated', { tint: o.tint || HANGAR, collide: 'mesh', uv: 'world' });
  const front = gableGeom(w, H, rise, t + 0.2, { w: doorW, h: doorH });
  b.geom(front, x, 0, z1 - t / 2, 'metal_corrugated', { tint: o.tint || HANGAR, collide: 'mesh', uv: 'world' });
  // Torsturz (Stahlträger) und Laufschiene über die Hallenbreite hinaus
  b.box(x, doorH, z1 + 0.1, doorW + 0.6, 0.6, 0.5, 'metal_painted', { tint: '#4a5048', grad: false, minimap: false });
  b.box(x, doorH + 0.6, z1 + 0.35, w + 20, 0.25, 0.25, 'metal_painted', { tint: '#3d4247', collide: false, minimap: false, grad: false });
  for (const s of [-1, 1]) b.box(x + s * (w / 2 + 9.6), 0, z1 + 0.35, 0.3, doorH + 0.85, 0.3, 'metal_painted', { tint: '#3d4247', minimap: 'pillar', grad: false });
  // Torflügel (4 × ≈ 9 m), aufgeschoben über die Hallenseiten hinaus; o.closed schiebt einen Flügel halb zu
  const leafW = doorW / 4 + 0.3;
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) {
    let cx = x + s * (doorW / 2 + leafW / 2 - 0.2 + k * 0.05) + s * (k ? 3.8 : 0);
    if (o.closed && s > 0 && k === 0) cx = x + doorW / 2 - leafW / 2 - 6;
    b.box(cx, 0.05, z1 + 0.65 + k * 0.32, leafW, doorH - 0.05, 0.18, 'metal_corrugated', { tint: shadeHex(o.tint || HANGAR, 0.9 + k * 0.06), minimap: 'wall', grad: true, aoFloor: 0 });
    b.box(cx, doorH - 0.6, z1 + 0.65 + k * 0.32, leafW, 0.12, 0.24, 'metal_painted', { tint: '#3d4247', ...VG });
  }
  // Tonnendach (Außen-/Innenhaut), Firstoberlicht
  b.geom(vaultGeom(w + 0.2, rise, d + 0.6, 22, 0.14), x, H, z, 'metal_corrugated', { tint: shadeHex(o.tint || HANGAR, 0.92), collide: 'mesh', uv: 'keep', minimap: false });
  b.footprints.push({ x, z, hw: w / 2, hd: d / 2, ry: 0, y0: 0, y1: H + rise, kind: 'building' });
  b.noNav(x0 - 1, z0 - 1, x1 + 1, z1 + 1, H - 0.5, H + rise + 30);
  // Binder (Stahlbögen) innen, Zugbänder, Oberlicht
  const prof = vaultProfile(w - 0.8, rise - 0.3, 14);
  for (let zz = z0 + 4; zz < z1 - 2; zz += 6) {
    for (let i = 0; i < prof.length - 1; i++) {
      const [ax, ay] = prof[i], [cx2, cy] = prof[i + 1], L = Math.hypot(cx2 - ax, cy - ay);
      b.box(x + (ax + cx2) / 2, H + (ay + cy) / 2 - 0.3, zz, L + 0.05, 0.36, 0.22, 'metal_painted', { rz: Math.atan2(cy - ay, cx2 - ax), tint: '#5a6058', ...VG, uv: 'local', cast: false });
    }
    b.box(x, H - 0.25, zz, w - 2 * t, 0.12, 0.12, 'metal_painted', { tint: '#5a6058', ...VG, cast: false });
    for (const s of [-1, 1]) b.box(x + s * (w / 2 - t - 0.2), 0.08, zz, 0.35, H - 0.1, 0.35, 'metal_painted', { tint: '#5a6058', minimap: 'pillar', grad: false });
  }
  // Hallenlampen (2 Reihen)
  let li = 0;
  for (let zz = z0 + 7; zz < z1 - 3; zz += 9) for (const s of [-1, 1]) hallenlampe(b, x + s * w / 4, H + rise * 0.7, zz, yF, { real: li++ % 3 === 0 });
  // Schild über dem Tor
  b.defineSign('hangar' + o.nr, { style: 'stencil', text: 'HALLE ' + o.nr, fg: '#e8e4dc' });
  b.sign(x, doorH + 1.0, z1 + 0.2, 6.5, 1.4, 'hangar' + o.nr, { ry: 0, back: false, depth: 0 });
  b.defineSign('hangar_warn', { style: 'warning', text: 'FOD-KONTROLLE', sub: 'Vor dem Rollen Boden prüfen' });
  b.sign(x0 - 0.05, 1.6, z1 - 2, 1.4, 0.9, 'hangar_warn', { ry: -Q, back: false });
  // Büroeinbau an der Rückwand (2 Geschosse), Stahltreppe + Galerie
  bueroEinbau(b, x, z0 + t, o);
  // Ausstattung
  if (o.kind === 'flugzeug') {
    schulflugzeug(b, x - 4, z + 3, PI - 0.15, { y: yF, open: true });
    schulflugzeug(b, x + 11, z + 6, PI + 0.2, { y: yF, tint: '#8a9472', akzent: '#d9a72a' });
    wartungsbuehne(b, x - 4 + 2.6, z + 5.6, Q, yF);
    schlepper(b, x - 12, z + 12, 0.4, yF);
    bodenstrom(b, x + 4, z + 10, 0.2, yF);
  } else if (o.kind === 'triebwerk') {
    for (const [lx, lz, ry] of [[-10, 2, 0.1], [-2, 4, -0.2], [7, 1, 0.05]]) triebwerk(b, x + lx, z + lz, ry, yF);
    wartungsbuehne(b, x + 12, z + 8, 0, yF);
    munitionswagen(b, x - 14, z + 10, 0.3, yF);
    munitionswagen(b, x + 2, z + 11, -0.2, yF);
    // Laufkran-Träger quer über die Halle
    for (const s of [-1, 1]) b.box(x + s * (w / 2 - t - 0.5), H - 1.2, z, 0.4, 0.5, d - 6, 'metal_painted', { tint: '#d9a72a', ...VG });
    b.box(x + 3, H - 0.9, z + 1, w - 2, 0.7, 0.6, 'metal_painted', { tint: '#d9a72a', ...VG });
    b.box(x + 3, H - 1.4, z + 1, 0.8, 0.5, 1.0, 'metal_painted', { tint: '#3d4247', ...VG });
    b.cyl(x + 3, 2.5, z + 1, 0.02, H - 3.9, 'black', { ...KEIN, seg: 4, ao: false });
    b.box(x + 3, 2.3, z + 1, 0.3, 0.25, 0.15, 'metal_painted', { tint: '#c8402f', ...VG });
  } else {
    for (const [lx, lz, ry] of [[-15, 4, Q], [-15, -3, Q]]) container(b, x + lx, yF, z + lz, { ry, color: ['#56603f', '#4a5338'][Math.round(hash01(lx, lz, 1))] });
    rack(b, x + 8, z - 4, { ry: 0, bays: 3, levels: 2, y: yF });
    rack(b, x + 8, z + 3, { ry: 0, bays: 3, levels: 2, y: yF });
    crateStack(b, x - 6, z + 8, { y: yF, ry: 0.3 });
    crateStack(b, x + 1, z + 12, { y: yF, ry: -0.2 });
    palletStack(b, x - 2, z + 2, { n: 4, y: yF });
    forklift(b, x + 2, z + 6, { ry: -0.6, y: yF });
    munitionskisten(b, x - 8, yF, z + 3, 0.4, 4);
    munitionskisten(b, x + 15, yF, z + 10, -0.3, 3);
  }
  // Werkbänke, Spinde, Werkzeug an den Wänden (beide Seiten)
  for (const s of [-1, 1]) {
    const wx = s < 0 ? x0 + t + 0.45 : x1 - t - 0.45, ry = s < 0 ? Q : -Q;
    workbench(b, wx, z - 2, { ry, y: yF, w: 2.2 });
    workbench(b, wx, z + 4, { ry, y: yF, w: 2.2 });
    // karten (22.11.): Spinde nicht vor die Personaltür der Ostwand (z1 − 5; bei 30 m Hallentiefe genau z + 10)
    const lz = s > 0 && Math.abs(d / 2 - 5 - 10) < 1.8 ? 12.6 : 10;
    lockers(b, wx - s * 0.05, z + lz, { ry, y: yF, n: 5, tint: '#5a6a5a' });
    gasBottles(b, wx - s * 0.2, z + 14.5, { n: 4, y: yF });
    b.model('tool_cart', wx - s * 1.6, yF, z + 1, { ry: ry + 0.2, collide: false, fallback: (bb) => bb.box(wx - s * 1.6, yF, z + 1, 1.27, 0.96, 0.75, 'metal_painted', { ry, tint: '#c8402f', ...KEIN }) });
    b.box(wx - s * 1.6, yF, z + 1, 1.27, 0.96, 0.75, 'black', { ry, visual: false, minimap: 'cover' });
    loescher(b, wx - s * 0.1, yF, z + 7.5);
    b.model('metal_tool_chest', wx - s * 0.1, yF, z - 6, { ry, collide: false });
    b.model('barrel_01', wx - s * 0.4, yF, z - 9, { ry: hash01(wx, z, 2) * 6, collide: false, fallback: (bb) => bb.cyl(wx - s * 0.4, yF, z - 9, 0.28, 0.88, 'metal_painted', { tint: '#2d5f94', ...KEIN }) });
    b.cyl(wx - s * 0.4, yF, z - 9, 0.28, 0.88, 'black', { visual: false, minimap: 'prop' });
  }
  return { x0, x1, z0, z1 };
}

function shadeHex(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

/** Zweigeschossiger Büroeinbau an der Hallenrückwand (Nordseite bei zb), Front nach Süden, Treppe + Galerie. */
function bueroEinbau(b, x, zb, o) {
  const w = 22, dd = 5.2, fh = 3.2, zc = zb + dd / 2;
  const B = building(b, {
    x, z: zc, w, d: dd, floors: 2, fh, mat: 'plaster_white', tint: '#d8d4c8', t: 0.25, skipWalls: ['n'],
    openings: [
      { side: 's', at: -9.5, w: 1.0, h: 2.1, kind: 'door', leaf: 'open', floor: 0 }, // karten (22.11.): vorher at −7 – direkt hinter der Stahltreppe (deren Rampe darunter massiv ist), unter die Galerie gerückt
      { side: 's', at: 6.5, w: 1.0, h: 2.1, kind: 'door', leaf: 'open', floor: 0 },
      { side: 's', at: -3, w: 2.6, h: 1.3, sill: 0.95, kind: 'window', floor: 0 },
      { side: 's', at: 2, w: 2.6, h: 1.3, sill: 0.95, kind: 'window', floor: 0 },
      { side: 's', at: -9.3, w: 1.0, h: 2.1, kind: 'door', leaf: 'open', floor: 1 },
      { side: 's', at: -5, w: 2.6, h: 1.3, sill: 0.95, kind: 'window', floor: 1 },
      { side: 's', at: 0.5, w: 2.6, h: 1.3, sill: 0.95, kind: 'window', floor: 1 },
      { side: 's', at: 6, w: 2.6, h: 1.3, sill: 0.95, kind: 'window', floor: 1 },
    ],
    roof: { edge: false, mat: 'concrete', tint: '#a8a49a' }, floorMat: 'linoleum', upperFloorMat: 'linoleum', floorTint: '#8a9a8a', pipes: false,
    interiorFactor: 0.55,
  });
  b.noNav(x - w / 2 - 0.5, zb - 0.5, x + w / 2 + 0.5, zb + dd + 0.5, 2 * fh - 0.5, 2 * fh + 6);
  // Trennwand zwischen den Büros (je Geschoss) mit Tür
  for (let f = 0; f < 2; f++) wall(b, { x0: x + 0.5, z0: zb + 0.2, x1: x + 0.5, z1: zb + dd - 0.25, y: f * fh + (f ? 0 : 0.12), h: fh - 0.25 - (f ? 0 : 0.12), t: 0.12, mat: 'plaster_white', tint: '#e2ded4', openings: [{ at: 3.6, w: 0.9, h: 2.05, kind: 'gap' }] });
  // Stahltreppe vor der Front (Ost → West ansteigend) zur Galerie
  const gz = zb + dd + 0.8;
  stairs(b, { x: x - 3.0, z: gz + 0.15, dir: 'w', y0: 0.08, y1: fh, w: 1.1, run: 5.0, style: 'steel', rail: 'left', railTint: '#d9a72a' });
  catwalk(b, x - 11, gz, x - 8.0, gz, fh, { w: 1.6, rails: ['l'], railTint: '#d9a72a', supports: true }); // karten (22.11.): endet am Treppenaustritt (x − 8), vorher 0,4 m über dem obersten Lauf (Kopf stieß an)
  // Galerie-Geländer zur Treppenseite (West-Ende offen zur Tür)
  railing(b, x - 11, gz - 0.75, x - 11, gz + 0.75, fh, { tint: '#d9a72a' });
  // Einrichtung: unten Werkstattbüro + Lager, oben Flugbereitschaft
  const yF = 0.12, yC = fh - 0.25, yF2 = fh + 0.02, yC2 = 2 * fh - 0.25;
  schreibtisch(b, x - 6, yF, zb + 1.3, 0);
  bueroStuhl(b, x - 6, yF, zb + 2.2, PI);
  aktenschrank(b, x - 10.2, yF, zb + 0.6, 0);
  aktenschrank(b, x - 9.6, yF, zb + 0.6, 0, '#8a7a62');
  pinnwand(b, x - 3.5, yF + 1.2, zb + 0.06, 0);
  stahlregal(b, x + 3, yF, zb + 0.5, 0);
  stahlregal(b, x + 5, yF, zb + 0.5, 0);
  stahlregal(b, x + 7, yF, zb + 0.5, 0);
  munitionskisten(b, x + 9, yF, zb + 1.6, 0.2, 3);
  deckenleuchte(b, x - 5, yC, zb + 2.6, 0, 1.25, { real: true });
  deckenleuchte(b, x + 5, yC, zb + 2.6, 0, 1.25);
  besprechung(b, x - 5, yF2, zb + 1.7, 0, 2.0, 0.9, 2);
  // Wegketten durch beide Büros (über die Tür in der Trennwand): das 1,6-m-Raster trifft die 5 m tiefen Räume schlecht
  for (const yy of [yF, yF2]) b.navLine(x - 10.4, yy + 0.2, zb + 3.8, x + 10.4, yy + 0.2, zb + 3.8, 1.1);
  pinnwand(b, x - 8, yF2 + 1.1, zb + 0.06, 0, 1.6, 1.0);
  schreibtisch(b, x + 4, yF2, zb + 1.3, 0);
  bueroStuhl(b, x + 4, yF2, zb + 2.2, PI);
  schreibtisch(b, x + 8, yF2, zb + 1.3, 0);
  spinde(b, x + 2.0, yF2, zb + 0.35, 0, 3);
  kuechenzeile(b, x + 9.6, yF2, zb + 3.6, -Q, 1.8);
  deckenleuchte(b, x - 5, yC2, zb + 2.6, 0, 1.25);
  deckenleuchte(b, x + 5, yC2, zb + 2.6, 0, 1.25);
  return B;
}

/** Fahrbare Wartungsbühne (Gerüst mit Plattform 2,6 m und Stahltreppe). */
function wartungsbuehne(b, x, z, ry, y = 0) {
  const f = frame(b, x, y, z, ry), H = 2.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.box(sx * 1.1, 0, sz * 0.9, 0.08, H, 0.08, 'metal_painted', { tint: '#d9a72a', ...KEIN });
  f.box(0, H - 0.06, 0, 2.3, 0.06, 1.9, 'metal_grate', { minimap: 'catwalk', grad: false, ao: false });
  for (const sz of [-1, 1]) f.box(0, H + 1.0, sz * 0.92, 2.3, 0.05, 0.05, 'metal_painted', { tint: '#d9a72a', ...VG });
  f.box(1.12, H + 1.0, 0, 0.05, 0.05, 1.85, 'metal_painted', { tint: '#d9a72a', ...VG });
  // Treppe an lokal −x, Aufstieg Richtung lokal +x (Welt: (cos ry, −sin ry))
  const c = Math.cos(ry), sn = Math.sin(ry);
  const dir = Math.abs(c) > 0.5 ? (c > 0 ? 'e' : 'w') : (sn > 0 ? 'n' : 's');
  const [tx, tz] = f.P(-1.15 - 4.2, 0);
  stairs(b, { x: tx, z: tz, dir, y0: y, y1: y + H, w: 0.8, run: 4.2, style: 'steel', rail: true, railTint: '#d9a72a' });
}

/** Triebwerk auf Montagebock. */
function triebwerk(b, x, z, ry = 0, y = 0) {
  const f = frame(b, x, y, z, ry);
  f.box(0, 0, 0, 1.4, 0.7, 3.6, 'metal_painted', { tint: '#c8402f', ...KEIN });
  f.cyl(0, 1.35, 0.4, 0.65, 3.4, 'metal_painted', { axis: 'z', tint: '#8d9297', ...KEIN, seg: 16, r1: 0.55 });
  for (const k of [-0.9, 0.2, 1.3]) f.cyl(0, 1.35, k, 0.68, 0.06, 'metal_galvanized', { axis: 'z', ...VG, seg: 16 });
  f.cyl(0, 1.35, 2.15, 0.72, 0.25, 'metal_painted', { axis: 'z', tint: '#5a5f66', ...VG, seg: 16 });
  f.cyl(0, 1.35, -1.45, 0.48, 0.6, 'metal_rust', { axis: 'z', ...VG, seg: 14, r1: 0.4 });
  for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2; f.box(Math.cos(a) * 0.5, 1.35 + Math.sin(a) * 0.5, 2.3, 0.05, 0.3, 0.05, 'metal_galvanized', { ...VG, ao: false, rz: a }); }
  f.solid(0, 0, 0.3, 1.5, 2.0, 4.0, { minimap: 'cover' });
}

// ---------------------------------------------------------------------------
// Flugzeugschutzbau (Beton-Tonne), Tor nach lokal +z
// ---------------------------------------------------------------------------
export function schutzbau(b, x, z, ry = 0, o = {}) {
  const span = 22, rise = 6.8, len = 30, H = 1.6, y = o.y ?? 0;
  const g = vaultGeom(span + 1.6, rise + 0.8, len, 20, 0.9);
  b.geom(g, x, y + H, z, 'concrete', { ry, tint: '#a8a59c', collide: 'mesh', uv: 'keep', minimap: false });
  const f = frame(b, x, y, z, ry);
  // Kämpferwände
  for (const s of [-1, 1]) f.box(s * (span / 2 + 0.45), 0, 0, 0.9, H + 0.3, len, 'concrete', { tint: '#a8a59c', minimap: 'wall' });
  // Rückwand mit Abgasöffnung
  const backG = gableGeom(span + 1.6, H, rise + 0.8, 1.0, { w: 3.2, h: 3.0, x: 0 });
  const [bx, bz] = f.P(0, -len / 2 + 0.5);
  b.geom(backG, bx, y, bz, 'concrete', { ry, tint: '#9f9c93', collide: 'mesh', uv: 'world' });
  // Torrahmen + aufgeschobene Torhälften
  const [px, pz] = f.P(0, len / 2 - 0.4);
  b.geom(gableGeom(span + 1.6, H, rise + 0.8, 0.8, { w: span - 1, h: H + rise * 0.82 }), px, y, pz, 'concrete', { ry, tint: '#9c998f', collide: 'mesh', uv: 'world' });
  for (const s of [-1, 1]) f.box(s * (span / 2 + 4.5), 0, len / 2 + 0.8, 7.5, H + rise * 0.82, 0.9, 'concrete_panel', { tint: '#8f8c84', minimap: 'wall' });
  f.box(0, 0, len / 2 + 0.8, span + 17, 0.15, 0.4, 'metal_painted', { tint: '#3d4247', ...VG });
  // Boden + Ausstattung
  f.box(0, 0, 0, span, 0.06, len - 1.2, 'concrete', { tint: '#b8b4aa', grad: false, minimap: false });
  b.interior(...aabb(f, span, len), y - 0.1, y + H + rise, 0.6);
  for (const lz of [-8, 2]) { const [lx, lzz] = f.P(0, lz); hallenlampe(b, lx, y + H + rise - 0.3, lzz, y + 0.06); }
  const [cx, cz] = f.P(-8, -10); munitionswagen(b, cx, cz, ry + 0.2, y + 0.06);
  const [ex, ez] = f.P(8.5, -11); workbench(b, ex, ez, { ry: ry - Q, y: y + 0.06 });
  const [gx, gz] = f.P(8, 6); bodenstrom(b, gx, gz, ry + 0.3, y + 0.06);
  b.footprints.push({ x, z, hw: (span + 2) / 2, hd: len / 2, ry, y0: y, y1: y + H + rise + 1, kind: 'building' });
  b.noNav(x - 18, z - 18, x + 18, z + 18, y + H + 0.6, y + 40);
  const [ox, oz] = f.P(0, len / 2 + 4);
  b.decal(ox, y + 0.03, oz, 5, 4, 'oil', { opacity: 0.5 });
}
function aabb(f, w, d) {
  const pts = [f.P(-w / 2, -d / 2), f.P(w / 2, -d / 2), f.P(w / 2, d / 2), f.P(-w / 2, d / 2)];
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}

// ---------------------------------------------------------------------------
// Kontrollturm
// ---------------------------------------------------------------------------
/**
 * Kontrollturm: zweigeschossiger Sockelbau (Flugleitung, Wetterberatung, Funkraum), Treppenschacht bis zur verglasten
 * Kanzel (Fußboden 17 m), Dachterrasse auf dem Sockel. (x, z) Mitte des Sockelbaus; Schacht am Ostende.
 */
export function tower(b, x, z) {
  const fh = 3.4, L = 5.6, cw = 3.0;
  const W = 16, D = 10.4;
  const cx = x + W / 2 - 0.3 - cw / 2 - 0.15, cz = z;           // Schachtmitte (im Sockel an der Ostwand)
  const levels = [0.12, fh, 2 * fh, 3 * fh, 4 * fh, 5 * fh];     // 0,12 · 3,4 · 6,8 · 10,2 · 13,6 · 17,0
  const core = stairCore(b, { cx, cz, w: cw, L, levels, dir: 'n', mat: 'concrete', tint: '#c8c4ba', wallTint: '#dcd8ce', interior: true, nosing: true, roof: true });
  const holes = [1, 2].map((k) => core.holes(k));
  const B = building(b, {
    x, z, w: W, d: D, floors: 2, fh, mat: 'plaster_white', tint: '#e8e4da', holes,
    openings: [
      { side: 's', at: -3, w: 1.6, h: 2.3, kind: 'door', leaf: 'open', floor: 0 },
      { side: 's', at: -6.4, w: 1.4, h: 1.4, kind: 'window', floor: 0 },
      { side: 's', at: 0.8, w: 1.4, h: 1.4, kind: 'window', floor: 0 },
      { side: 'n', at: -4.5, w: 3.2, h: 1.6, kind: 'window', floor: 0 },
      { side: 'n', at: 1.5, w: 1.4, h: 1.4, kind: 'window', floor: 0 },
      { side: 'w', at: 0, w: 1.0, h: 2.15, kind: 'door', leaf: 'open', floor: 0 },
      { side: 's', at: -5, w: 1.4, h: 1.4, kind: 'window', floor: 1 },
      { side: 's', at: -1.5, w: 1.4, h: 1.4, kind: 'window', floor: 1 },
      { side: 's', at: 2, w: 1.4, h: 1.4, kind: 'window', floor: 1 },
      { side: 'n', at: -5, w: 3.4, h: 1.6, kind: 'window', floor: 1 },
      { side: 'n', at: 0, w: 3.4, h: 1.6, kind: 'window', floor: 1 },
      { side: 'w', at: -2, w: 1.4, h: 1.4, kind: 'window', floor: 1 },
      { side: 'w', at: 2, w: 1.4, h: 1.4, kind: 'window', floor: 1 },
      { side: 'e', at: 0, w: 1.0, h: 1.0, kind: 'window', floor: 1 },
    ],
    roof: { parapet: 1.0, mat: 'concrete', tint: '#a9a59b' }, floorMat: 'linoleum', upperFloorMat: 'linoleum', floorTint: '#7d8f86',
    band: { mat: 'concrete', tint: '#c9c4b8' }, plinth: { h: 0.5, mat: 'concrete_dark', tint: '#9a978e' }, interiorFactor: 0.55,
  });
  // Innenwand: Schacht vom Büro getrennt (Westseite des Schachts, Tür am Antrittspodest)
  const sx0 = cx - cw / 2 - 0.15;
  for (let f = 0; f < 2; f++) wall(b, { x0: sx0, z0: z - D / 2 + 0.3, x1: sx0, z1: z + D / 2 - 0.3, y: levels[f], h: fh - 0.25 - (f ? 0 : 0.12), t: 0.15, mat: 'plaster_white', tint: '#e2ded4', openings: [{ at: D / 2 - 0.3 + core.land / 2 + L / 2 - 0.65 - (D / 2 - 0.3) + 0.0, w: 1.0, h: 2.1, kind: 'door', leaf: 'open' }].map((op) => ({ ...op, at: (z + L / 2 - core.land / 2) - (z - D / 2 + 0.3) })) });
  // Schacht über dem Sockel (6,8 … 17): Wände, Schlitzfenster, Podeste an den Zwischenebenen
  const st = 0.3, shw = cw + 2 * st + 0.3, shx0 = cx - shw / 2, shx1 = cx + shw / 2, shz0 = cz - L / 2 - st, shz1 = cz + L / 2 + st;
  const yS0 = 2 * fh, yS1 = 5 * fh;
  b.interior(shx0, shz0, shx1, shz1, yS0, yS1, 0.55);
  const slit = (n) => Array.from({ length: n }, (_, i) => ({ at: 0.9 + i * 1.6, w: 0.35, h: 1.1, sill: 1.3, kind: 'window', glass: false, frame: false }));
  for (let k = 0; k < 3; k++) {
    const y0 = yS0 + k * fh;
    wall(b, { x0: shx0 + st / 2, z0: shz1, x1: shx0 + st / 2, z1: shz0, y: y0, h: fh, t: st, mat: 'plaster_white', tint: '#e2ded2', openings: k === 0 ? [{ at: shz1 - (cz + L / 2 - core.land / 2), w: 1.0, h: 2.1, kind: 'door', leaf: 'open' }] : slit(3), outside: 'left' });
    wall(b, { x0: shx1 - st / 2, z0: shz0, x1: shx1 - st / 2, z1: shz1, y: y0, h: fh, t: st, mat: 'plaster_white', tint: '#e2ded2', openings: slit(3), outside: 'left' });
    wall(b, { x0: shx0, z0: shz0 + st / 2, x1: shx1, z1: shz0 + st / 2, y: y0, h: fh, t: st, mat: 'plaster_white', tint: '#e2ded2', outside: 'left' });
    wall(b, { x0: shx1, z0: shz1 - st / 2, x1: shx0, z1: shz1 - st / 2, y: y0, h: fh, t: st, mat: 'plaster_white', tint: '#e2ded2', outside: 'left' });
    if (k > 0) {
      // Antrittspodest (Süd) der Zwischenebene
      b.box(cx, y0 - 0.25, cz + L / 2 - core.land / 2, cw + 0.3, 0.25, core.land, 'concrete', { tint: '#c8c4ba', grad: false, minimap: false });
    }
  }
  b.footprints.push({ x: cx, z: cz, hw: shw / 2, hd: (shz1 - shz0) / 2, ry: 0, y0: yS0, y1: yS1, kind: 'building' });
  // Kanzel: Boden mit Treppenloch, Fensterband ringsum, Dach mit Antennen
  const kw = 9, kd = 9, ky = yS1, kh = 3.0, kx = cx - 1.2;
  b.interior(kx - kw / 2, cz - kd / 2, kx + kw / 2, cz + kd / 2, ky - 0.3, ky + kh, 0.85);
  slab(b, kx - kw / 2, cz - kd / 2, kx + kw / 2, cz + kd / 2, ky - 0.3, 0.3, 'concrete', [core.rect], { tint: '#b4b0a6' });
  slab(b, kx - kw / 2 + 0.3, cz - kd / 2 + 0.3, kx + kw / 2 - 0.3, cz + kd / 2 - 0.3, ky, 0.02, 'linoleum', [core.rect], { tint: '#5a6a64' });
  // Absturzsicherung um das Treppenloch (West-, Nordseite; Süd = Antritt bzw. Austritt)
  railing(b, core.rect.x0, core.rect.z0, core.rect.x0, core.rect.z1, ky, { h: 1.0, tint: '#2c2f33' });
  railing(b, core.rect.x0, core.rect.z0, core.rect.x1, core.rect.z0, ky, { h: 1.0, tint: '#2c2f33' });
  const kOps = (len) => { const n = Math.floor(len / 2.2); return Array.from({ length: n }, (_, i) => ({ at: (len - n * 2.2) / 2 + 1.1 + i * 2.2, w: 2.05, h: 1.75, sill: 0.95, kind: 'window', glass: true, frameMat: 'metal_painted', frameTint: '#2c2f33' })); };
  const kt = 0.22;
  wall(b, { x0: kx - kw / 2, z0: cz - kd / 2 + kt / 2, x1: kx + kw / 2, z1: cz - kd / 2 + kt / 2, y: ky, h: kh, t: kt, mat: 'plaster_white', tint: '#d8d4ca', openings: kOps(kw), outside: 'left' });
  wall(b, { x0: kx + kw / 2, z0: cz + kd / 2 - kt / 2, x1: kx - kw / 2, z1: cz + kd / 2 - kt / 2, y: ky, h: kh, t: kt, mat: 'plaster_white', tint: '#d8d4ca', openings: kOps(kw), outside: 'left' });
  wall(b, { x0: kx + kw / 2 - kt / 2, z0: cz - kd / 2 + kt, x1: kx + kw / 2 - kt / 2, z1: cz + kd / 2 - kt, y: ky, h: kh, t: kt, mat: 'plaster_white', tint: '#d8d4ca', openings: kOps(kd - 2 * kt), outside: 'left' });
  wall(b, { x0: kx - kw / 2 + kt / 2, z0: cz + kd / 2 - kt, x1: kx - kw / 2 + kt / 2, z1: cz - kd / 2 + kt, y: ky, h: kh, t: kt, mat: 'plaster_white', tint: '#d8d4ca', openings: kOps(kd - 2 * kt), outside: 'left' });
  b.box(kx, ky + kh, cz, kw + 1.4, 0.35, kd + 1.4, 'concrete', { tint: '#b8b4aa', minimap: 'roof', grad: false });
  b.box(kx, ky + kh + 0.35, cz, kw + 1.5, 0.12, kd + 1.5, 'metal_painted', { tint: '#3d4247', ...VG });
  b.noNav(kx - kw, cz - kd, kx + kw, cz + kd, ky + kh - 0.2, ky + kh + 20);
  b.footprints.push({ x: kx, z: cz, hw: kw / 2 + 0.7, hd: kd / 2 + 0.7, ry: 0, y0: ky, y1: ky + kh + 0.5, kind: 'roof' });
  // Antennen, Windmesser, Rundumleuchte
  b.cyl(kx + 3, ky + kh + 0.35, cz - 3, 0.06, 6, 'metal_galvanized', { ...KEIN, seg: 6 });
  b.cyl(kx + 3, ky + kh + 6.35, cz - 3, 0.12, 0.15, 'lamp_redlens', { ...KEIN, seg: 8, ao: false });
  b.glow(kx + 3, ky + kh + 6.45, cz - 3, { size: 1.4, color: '#ff3a20', intensity: 1 });
  b.cyl(kx - 3, ky + kh + 0.35, cz + 3, 0.04, 3.2, 'metal_galvanized', { ...KEIN, seg: 6 });
  for (let k = 0; k < 3; k++) { const a = (k / 3) * PI * 2; b.cyl(kx - 3 + Math.cos(a) * 0.35, ky + kh + 3.5, cz + 3 + Math.sin(a) * 0.35, 0.07, 0.12, 'metal_painted', { tint: '#e8e4dc', ...KEIN, seg: 6, axis: 'z' }); }
  b.box(kx + 1.5, ky + kh + 0.35, cz + 2, 1.6, 1.0, 1.2, 'metal_painted', { tint: '#9aa39a', ...KEIN });
  // Kanzel-Einrichtung: Lotsenpulte ringsum, Stühle, Ferngläser, Funk
  for (const [lx, lz, ry] of [[-3.0, -3.75, 0], [0.4, -3.75, 0], [-3.75, 0.5, Q], [-3.75, 3.1, Q]]) {
    const f = frame(b, kx + lx, ky, cz + lz, ry);
    f.box(0, 0, 0, 2.6, 0.9, 0.8, 'metal_painted', { tint: '#4a5058', ...KEIN });
    f.box(0, 0.9, -0.1, 2.6, 0.18, 0.6, 'metal_painted', { tint: '#2b2d30', ...VG, rx: -0.4 });
    for (const sx of [-0.8, 0, 0.8]) f.box(sx, 1.0, 0.05, 0.55, 0.36, 0.04, 'glass', { tint: hash01(lx + sx, lz, 9) < 0.5 ? '#2a4a38' : '#203848', ...VG, ao: false });
    f.solid(0, 0, 0, 2.6, 1.0, 0.8, { minimap: false });
    const [sx, sz] = f.P(0, 0.72); bueroStuhl(b, sx, ky, sz, ry + PI);
  }
  funktisch(b, kx + 2.6, ky, cz + 3.2, PI);
  // Sockel-Einrichtung
  const yF = 0.12, yC = fh - 0.25, yF2 = fh + 0.02, yC2 = 2 * fh - 0.25;
  schreibtisch(b, x - 5.5, yF, z - 3.6, 0); bueroStuhl(b, x - 5.5, yF, z - 2.7, PI);
  schreibtisch(b, x - 1.5, yF, z - 3.6, 0); bueroStuhl(b, x - 1.5, yF, z - 2.7, PI);
  aktenschrank(b, x - 7.4, yF, z + 2, Q);
  aktenschrank(b, x - 7.4, yF, z + 2.6, Q, '#8a7a62');
  pinnwand(b, x - 3, yF + 1.2, z + D / 2 - 0.32, PI, 1.6, 1.0);
  wasserspender(b, x + 1.5, yF, z + 4.4, PI);
  deckenleuchte(b, x - 4, yC, z, 0, 1.25, { real: true });
  deckenleuchte(b, x + 0.5, yC, z, 0, 1.25);
  besprechung(b, x - 3.5, yF2, z + 1, 0, 2.6, 1.1, 3);
  funktisch(b, x - 6.8, yF2, z - 4.2, 0);
  schreibtisch(b, x + 0.5, yF2, z - 3.6, 0); bueroStuhl(b, x + 0.5, yF2, z - 2.7, PI);
  pinnwand(b, x - 3.5, yF2 + 1.1, z - D / 2 + 0.32, 0, 2.4, 1.2);
  deckenleuchte(b, x - 4, yC2, z, 0, 1.25);
  deckenleuchte(b, x + 0.5, yC2, z, 0, 1.25);
  b.defineSign('tower', { style: 'plate', text: 'FLUGLEITUNG', sub: 'Fliegerhorst Hagenmoor', bg: '#2d3e4a', fg: '#f1ede2' });
  b.sign(x - 3, 2.6, z + D / 2 + 0.02, 3.6, 0.6, 'tower', { ry: 0 });
  return { B, kanzel: { x: kx, y: ky, z: cz } };
}

// ---------------------------------------------------------------------------
// Feuerwache
// ---------------------------------------------------------------------------
export function feuerwache(b, x, z) {
  const W = 22, D = 12;
  building(b, {
    x, z, w: W, d: D, floors: 1, fh: 5.0, mat: 'brick', tint: '#b98a72',
    openings: [
      ...[-6.5, 0, 6.5].map((at) => ({ side: 's', at, w: 4.2, h: 4.2, kind: 'gap', frame: false })),
      { side: 'n', at: 6, w: 1.0, h: 2.15, kind: 'door', leaf: 'open' },
      { side: 'n', at: -4, w: 2.4, h: 1.2, sill: 1.6, kind: 'window' },
      { side: 'w', at: 0, w: 1.4, h: 1.2, sill: 1.4, kind: 'window' },
    ],
    roof: { parapet: 0.6, mat: 'concrete', tint: '#a8a49a' }, floorMat: 'concrete', interiorFactor: 0.6,
  });
  b.noNav(x - W / 2 - 0.5, z - D / 2 - 0.5, x + W / 2 + 0.5, z + D / 2 + 0.5, 4.6, 30);
  for (const [lx, c] of [[-6.5, '#b8282a'], [0, '#b8282a']]) {
    const f = frame(b, x + lx, 0.12, z + 0.2, 0);
    f.box(0, 0.6, 1.6, 2.4, 2.1, 2.0, 'metal_painted', { tint: c, ...KEIN });
    f.box(0, 1.85, 2.61, 2.1, 0.7, 0.02, 'glass', { ...VG, ao: false });
    f.box(0, 0.6, -1.6, 2.45, 2.4, 5.4, 'metal_painted', { tint: c, ...KEIN });
    f.box(0, 3.0, -1.6, 1.0, 0.25, 4.8, 'metal_galvanized', { ...VG });
    for (let k = 0; k < 4; k++) f.box(1.24, 1.0 + (k % 2) * 0.9, -3.4 + Math.floor(k / 2) * 2.2, 0.02, 0.8, 2.0, 'metal_shutter', { tint: '#d8d4ca', ...VG });
    f.box(0, 2.72, 2.3, 1.4, 0.15, 0.3, 'lamp_lens', { tint: '#3a6fd8', ...VG, ao: false });
    for (const sx of [-1.05, 1.05]) for (const sz of [1.7, -2.6, -3.7]) f.cyl(sx, 0.5, sz, 0.5, 0.4, 'rubber', { axis: 'x', ...VG, seg: 12 });
    f.solid(0, 0, 0, 2.5, 3.1, 7.4, { minimap: 'vehicle' });
  }
  lockers(b, x + 9.6, z - 3, { ry: -Q, n: 6, tint: '#7a2e26', y: 0.12 });
  rack(b, x + 2.5, z - 4.6, { ry: 0, bays: 1, levels: 2, y: 0.12 }); // karten (22.11.): vorher x + 6,5 – genau vor der Nordtür (x + 6)
  for (let k = 0; k < 4; k++) b.cyl(x + 8.5, 1.4 + k * 0.4, z - 5.6, 0.09, 0.32, 'metal_painted', { tint: '#c8402f', ...KEIN, seg: 8, axis: 'x' });
  deckenleuchte(b, x - 3, 4.75, z, 0, 1.25, { real: true });
  deckenleuchte(b, x + 3, 4.75, z, 0, 1.25);
  b.defineSign('feuerwache', { style: 'plate', text: 'FLUGPLATZFEUERWEHR', bg: '#b8282a', fg: '#ffffff' });
  b.sign(x, 4.35, z + D / 2 + 0.02, 7, 0.55, 'feuerwache', { ry: 0 });
  // Schlauchturm
  building(b, { x: x + W / 2 + 2, z: z - 3, w: 3.6, d: 3.6, floors: 1, fh: 12, mat: 'brick', tint: '#b07e68', openings: [{ side: 'e', at: 0, w: 1.0, h: 2.1, kind: 'door', leaf: 'open' }, { side: 's', at: 0, w: 0.6, h: 1.2, sill: 8.5, kind: 'window', glass: false }], roof: { edge: true }, floorMat: 'concrete', pipes: false });
  b.noNav(x + W / 2 + 0.2, z - 4.8, x + W / 2 + 3.8, z - 1.2, 2.5, 40);
}

// ---------------------------------------------------------------------------
// Tanklager
// ---------------------------------------------------------------------------
/** Tanklager um (x, z): vier stehende Tanks in zwei Auffangwannen, Pumpenhaus, Rohrbrücke, Treppenturm mit Steg. */
export function tanklager(b, x, z) {
  const tanks = [[-14, -12], [6, -12], [-14, 10], [6, 10]], r = 6.5, h = 9;
  for (const [s, wz] of [[-1, -12], [1, 10]]) {
    // Auffangwanne: Betonmauer 1,3 m um zwei Tanks, Treppe drüber (Stufen innen/außen als Keile)
    const x0 = x - 24, x1 = x + 16, z0 = z + wz - 9.5, z1 = z + wz + 9.5;
    for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]) {
      wall(b, { x0: ax, z0: az, x1: bx, z1: bz, y: 0, h: 1.3, t: 0.35, mat: 'concrete', tint: '#b4b0a6', cap: { h: 0.06, over: 0.03 }, minimap: 'wall' });
    }
    for (const sx of [x - 4]) {
      const zz = s < 0 ? z0 : z1, out = s < 0 ? -1 : 1;
      b.wedge(sx, 0, zz + out * 0.9, 1.4, 1.3, 1.5, 'concrete', { ry: out < 0 ? 0 : PI, tint: '#a8a49a' });
      b.wedge(sx, 0, zz - out * 0.9, 1.4, 1.3, 1.5, 'concrete', { ry: out < 0 ? PI : 0, tint: '#a8a49a' });
    }
    b.decal(x - 4, 0.02, z + wz, 30, 15, 'stain', { opacity: 0.45 });
  }
  const cols = ['#d8d6cf', '#cfcdc4', '#d8d6cf', '#c9c6bc'];
  tanks.forEach(([lx, lz], i) => {
    const tx = x + lx, tz = z + lz;
    b.cyl(tx, 0, tz, r, h, 'metal_painted', { tint: cols[i], seg: 28, minimap: 'building' });
    // flach gewölbtes Dach (begehbar)
    b.cyl(tx, h, tz, r + 0.05, 0.45, 'metal_painted', { r1: r - 1.2, tint: cols[i], seg: 28, minimap: false });
    b.cyl(tx, h + 0.45, tz, r - 1.2, 0.05, 'metal_painted', { tint: cols[i], seg: 28, ...KEIN });
    for (let k = 1; k < 4; k++) b.cyl(tx, (h * k) / 4, tz, r + 0.04, 0.1, 'metal_painted', { tint: '#9aa0a4', seg: 28, ...KEIN, ao: false });
    b.box(tx, 0, tz + (lz < 0 ? r - 0.2 : -r + 0.2), 1.2, 1.4, 0.8, 'metal_painted', { tint: '#5a6058', minimap: false });
    b.decal(tx, 0.03, tz, r * 2.6, r * 2.6, 'stain', { opacity: 0.35 });
    b.defineSign('tank' + i, { style: 'stencil', text: ['F-34', 'F-34', 'F-54', 'JP-8'][i] + '  ·  T' + (i + 1), fg: '#2a2b2c' });
    b.sign(tx, h * 0.6, tz + (lz < 0 ? r + 0.02 : -r - 0.02), 4.2, 0.9, 'tank' + i, { ry: lz < 0 ? 0 : PI, back: false, depth: 0 });
    // Dachgeländer (Pfosten, Handlauf als Ring aus Segmenten)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * PI * 2, a1 = ((k + 1) / 16) * PI * 2, rr = r - 0.15;
      b.cyl(tx + Math.cos(a) * rr, h + 0.1, tz + Math.sin(a) * rr, 0.025, 1.0, 'metal_painted', { tint: '#d9a72a', ...KEIN, seg: 5, ao: false });
      const mx = tx + (Math.cos(a) + Math.cos(a1)) / 2 * rr, mz = tz + (Math.sin(a) + Math.sin(a1)) / 2 * rr, L = 2 * rr * Math.sin(PI / 16);
      b.box(mx, h + 1.05, mz, L, 0.05, 0.05, 'metal_painted', { ry: -(a + a1) / 2 + Q, tint: '#d9a72a', ...VG, ao: false });
    }
    b.navPoint(tx, h + 0.75, tz);
  });
  // Rohrleitungen von den Tanks zum Pumpenhaus (Sammelleitung über Kopf zwischen den Wannen)
  for (const [lx, lz] of tanks) pipe(b, [[x + lx, 0.6, z + lz + (lz < 0 ? r : -r)], [x + lx, 0.6, z + (lz < 0 ? -2.0 : 0.0)], [x + lx, 2.6, z - 1], [x + 22, 2.6, z - 1]], { r: 0.16, tint: '#d9a72a' });
  for (const lx of [-20, -4, 12]) for (const s of [-1, 1]) b.box(x + lx, 0, z - 1 + s * 0.6, 0.15, 2.45, 0.15, 'metal_painted', { tint: '#4a5048', ...KEIN });
  // Pumpenhaus
  building(b, { x: x + 27, z: z, w: 8, d: 7, floors: 1, fh: 3.4, mat: 'brick', tint: '#a8806a', openings: [{ side: 'w', at: 1.5, w: 1.1, h: 2.15, kind: 'door', leaf: 'open' }, { side: 's', at: 0, w: 1.6, h: 1.0, sill: 1.4, kind: 'window' }, { side: 'e', at: 0, w: 1.0, h: 2.15, kind: 'door', leaf: 'open' }], roof: { edge: true }, floorMat: 'concrete', interiorFactor: 0.6 });
  b.noNav(x + 22.5, z - 4, x + 31.5, z + 4, 3.0, 30);
  for (const lz of [-1.6, 1.6]) {
    b.cyl(x + 27.8, 0.12, z + lz, 0.45, 0.9, 'metal_painted', { tint: '#3a6fb0', minimap: false });
    b.cyl(x + 26.4, 0.55, z + lz, 0.25, 1.5, 'metal_painted', { axis: 'x', tint: '#5a6058', ...KEIN });
  }
  electricBox(b, x + 30.6, 0.12, z - 2.4, { ry: -Q, w: 1.2, h: 1.8 });
  kafiglampe(b, x + 27, 3.15, z, 0.12);
  // Treppenturm (Stahl) östlich der Nordwanne; Steg vom Austritt (Süd) zum Tank T2, Steg T2 ↔ T1
  const land = 1.1, L = 5.0, sx = x + 19.5, sz = z - 12 - (L / 2 - land / 2);
  for (const [ax, az] of [[-1.45, -2.6], [1.45, -2.6], [-1.45, 2.6], [1.45, 2.6]]) b.box(sx + ax, 0, sz + az, 0.18, h + 1.2, 0.18, 'metal_painted', { tint: '#3d4247', minimap: ax < 0 && az < 0 ? 'pillar' : false });
  const lv = [0.05, 3.0, 6.0, h];
  stairCore(b, { cx: sx, cz: sz, w: 2.6, L, levels: lv, dir: 'n', mat: 'metal_tread', steel: true, wall: false, land, railTint: '#d9a72a' });
  for (let k = 1; k < lv.length; k++) b.box(sx, lv[k] - 0.1, sz + L / 2 - land / 2, 2.6, 0.1, land, 'metal_grate', { grad: false, minimap: false });
  // oben: Geländer an Ost- und Nordseite des Schachts
  railing(b, sx + 1.3, sz - L / 2, sx + 1.3, sz + L / 2, h, { tint: '#d9a72a' });
  railing(b, sx - 1.3, sz - L / 2, sx + 1.3, sz - L / 2, h, { tint: '#d9a72a' });
  railing(b, sx - 1.3, sz - L / 2, sx - 1.3, sz + L / 2 - land, h, { tint: '#d9a72a' });
  catwalk(b, x + 6 + r - 0.4, z - 12, sx - 1.3, z - 12, h, { w: 1.2, supports: true, railTint: '#d9a72a' });
  catwalk(b, x - 14 + r - 0.4, z - 12, x + 6 - r + 0.4, z - 12, h, { w: 1.2, supports: true, railTint: '#d9a72a' });
  // Tankwagen an der Füllstelle, Zapfsäulen
  tankwagen(b, x + 21, z + 14, -Q - 0.05);
  tankwagen(b, x + 31, z + 14, -Q + 0.08);
  for (const [cx, cz] of [[x + 19, z + 9], [x + 19, z + 19]]) {
    b.box(cx, 0, cz, 1.2, 1.6, 0.8, 'metal_painted', { tint: '#c8402f', minimap: 'cover' });
    b.cyl(cx + 0.7, 1.4, cz, 0.05, 1.6, 'rubber', { ...KEIN, seg: 6, axis: 'z' });
  }
  b.defineSign('tank_warn', { style: 'warning', text: 'FEUER UND OFFENES LICHT VERBOTEN', sub: 'Tanklager · Zutritt nur mit Erlaubnis' });
  b.sign(x - 24.2, 1.2, z + 1, 2.6, 1.4, 'tank_warn', { ry: -Q });
}

// ---------------------------------------------------------------------------
// Radarstellung (auf dem Hügel, Boden Y)
// ---------------------------------------------------------------------------
/** Radarstellung um (x, z) auf Höhe Y; liefert ein Objekt mit drehender Antenne. */
export function radarstellung(b, x, z, Y, THREEref = THREE) {
  b.groundTiled(x - 20, z - 20, x + 20, z + 20, 'concrete', { cell: 2, y: Y, tint: '#a8a59c' });
  // Kuppelturm: Betonsockel (begehbar: Technikraum), Kugel-Radom
  const B = building(b, { x: x - 6, z: z - 6, w: 7, d: 7, floors: 1, fh: 4.2, y: Y, mat: 'concrete', tint: '#b4b0a6', openings: [{ side: 's', at: 0, w: 1.1, h: 2.15, kind: 'door', leaf: 'open' }, { side: 'e', at: 0, w: 1.2, h: 0.5, sill: 2.4, kind: 'window', glass: false }], roof: { parapet: 0.9, mat: 'concrete', tint: '#9c988e' }, floorMat: 'concrete', interiorFactor: 0.5 });
  void B;
  const dome = new THREEref.SphereGeometry(3.6, 24, 14, 0, PI * 2, 0, PI * 0.62).toNonIndexed();
  b.geom(dome, x - 6, Y + 4.2 + 1.3, z - 6, 'white', { tint: '#e8e6e0', collide: true, minimap: false, uv: 'world' });
  b.noNav(x - 10, z - 10, x - 2, z - 2, Y + 3.8, Y + 30);
  funktisch(b, x - 7.5, Y + 0.12, z - 8.3, 0);
  electricBox(b, x - 3.0, Y + 0.12, z - 6, { ry: -Q, w: 1.0, h: 1.9 });
  kafiglampe(b, x - 6, Y + 3.95, z - 6, Y + 0.12);
  // Drehantenne auf Gittermast
  const mx = x + 8, mz = z - 7, mh = 9;
  for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.cyl(mx + ax * 1.0, Y, mz + az * 1.0, 0.08, mh, 'metal_galvanized', { r1: 0.06, seg: 6, minimap: ax < 0 && az < 0 ? 'pillar' : false, rx: -az * 0.04, rz: ax * 0.04 });
  for (let k = 1; k * 2.2 < mh; k++) for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
    const rr = 1.0 - (k * 2.2) / mh * 0.35, L = Math.hypot(bx - ax, bz - az) * rr;
    b.box(mx + (ax + bx) / 2 * rr, Y + k * 2.2, mz + (az + bz) / 2 * rr, L, 0.06, 0.06, 'metal_galvanized', { ry: Math.atan2(-(bz - az), bx - ax), ...VG });
  }
  b.box(mx, Y + mh, mz, 1.6, 0.3, 1.6, 'metal_painted', { tint: '#5a6058', ...KEIN });
  const ant = new THREEref.Group();
  const am = new THREEref.MeshStandardMaterial({ color: 0xc9cbc4, roughness: 0.55, metalness: 0.5 });
  am.userData.disposable = true;
  const dish = new THREEref.Mesh(new THREEref.BoxGeometry(7.5, 1.4, 0.12), am);
  dish.position.set(0, 1.4, 0.6); dish.rotation.x = -0.25;
  const arm = new THREEref.Mesh(new THREEref.BoxGeometry(0.3, 1.2, 0.8), am);
  arm.position.set(0, 0.6, 0.2);
  ant.add(dish, arm);
  for (const c of [dish, arm]) { c.castShadow = true; c.receiveShadow = true; }
  ant.position.set(mx, Y + mh + 0.3, mz);
  b.object(ant, { update: (dt) => { ant.rotation.y += dt * 1.1; } });
  // Bunker (Mannschaftsraum), Sandsack-Stellungen, MG-Nest, Flak
  const bk = building(b, { x: x + 7, z: z + 9, w: 8, d: 5.5, floors: 1, fh: 2.6, y: Y, mat: 'concrete', tint: '#a8a49a', openings: [{ side: 'w', at: -1.2, w: 1.0, h: 2.05, kind: 'door', leaf: 'open' }, { side: 'n', at: 0, w: 2.2, h: 0.4, sill: 1.35, kind: 'window', glass: false }, { side: 's', at: 1.5, w: 2.2, h: 0.4, sill: 1.35, kind: 'window', glass: false }], roof: { parapet: 0.9, mat: 'concrete', tint: '#9c988e' }, floorMat: 'concrete', interiorFactor: 0.45 });
  void bk;
  b.noNav(x + 2.5, z + 6, x + 11.5, z + 12, Y + 2.2, Y + 20);
  stockbett(b, x + 9.8, Y + 0.12, z + 10.4, Q);
  stockbett(b, x + 9.8, Y + 0.12, z + 8.0, Q);
  munitionskisten(b, x + 5.3, Y + 0.12, z + 10.6, 0, 3);
  tisch(b, x + 6.5, Y + 0.12, z + 8.2, { w: 1.2, d: 0.7 });
  kafiglampe(b, x + 7, Y + 2.35, z + 9, Y + 0.12);
  mgNest(b, x - 15, z + 12, { y: Y, ry: PI * 0.75 });
  mgNest(b, x + 15, z - 15, { y: Y, ry: -PI * 0.25 });
  ringStellung(b, x - 10, Y, z + 9, 3.6, PI, 0.55, 5);
  flak(b, x - 10, Y, z + 9, PI * 0.9, 0.6);
  tarnnetz(b, x - 10, Y, z + 9, 6, 6, 3.4, 0.2);
  sandbags(b, x + 2, z - 17, x + 12, z - 17, { rows: 4, y: Y });
  sandbags(b, x - 18, z - 4, x - 18, z + 4, { rows: 4, y: Y });
  crateStack(b, x + 15, z + 3, { y: Y, ry: 0.4 });
  barrelGroup(b, x - 2, z + 14, { n: 4, y: Y });
  b.defineSign('radar', { style: 'stencil', text: 'RADARSTELLUNG 2', fg: '#e8e4dc' });
  b.sign(x - 6, Y + 2.8, z - 2.45, 3.6, 0.6, 'radar', { ry: 0 });
  return { antenna: ant };
}

// ---------------------------------------------------------------------------
// Kaserne
// ---------------------------------------------------------------------------
/** Mannschaftsgebäude (2 Geschosse, Treppenhaus mittig, Stuben links/rechts), Front nach Norden (−z). */
export function kaserne(b, x, z, nr = 1) {
  const W = 34, D = 12, fh = 3.3;
  const cw = 3.0, L = 5.4, cx = x, cz = z + 0.2;
  const core = stairCore(b, { cx, cz, w: cw, L, levels: [0.12, fh], dir: 's', mat: 'concrete', tint: '#c4beb2', wallTint: '#e0dcd2', interior: true, nosing: true, roof: false });
  // dir 's': Antritt am Nordende (Haustür), Läufe nach Süden
  building(b, {
    x, z, w: W, d: D, floors: 2, fh, mat: 'plaster_white', tint: nr % 2 ? '#e4dccb' : '#dcd8cc', holes: [core.holes(1)],
    openings: [
      { side: 'n', at: 0, w: 1.6, h: 2.4, kind: 'door', leaf: 'open', floor: 0 },
      ...[-14, -10, -6, 6, 10, 14].flatMap((at) => [0, 1].map((floor) => ({ side: 'n', at, w: 1.4, h: 1.45, kind: 'window', floor }))),
      ...[-14, -10, -6, 6, 10, 14].flatMap((at) => [0, 1].map((floor) => ({ side: 's', at, w: 1.4, h: 1.45, kind: 'window', floor }))),
      { side: 'n', at: 0, w: 1.0, h: 1.2, floor: 1, kind: 'window' },
      { side: 'e', at: 0, w: 1.0, h: 2.15, kind: 'door', leaf: 'open', floor: 0 },
      { side: 'w', at: 0, w: 1.0, h: 2.15, kind: 'door', leaf: 'open', floor: 0 },
      { side: 'e', at: 2, w: 1.2, h: 1.4, kind: 'window', floor: 1 },
      { side: 'w', at: -2, w: 1.2, h: 1.4, kind: 'window', floor: 1 },
    ],
    roof: { edge: false, mat: 'concrete', tint: '#a8a49a' }, floorMat: 'linoleum', upperFloorMat: 'linoleum', floorTint: '#9a8a72',
    plinth: { h: 0.55, mat: 'concrete_dark', tint: '#9a978e' }, band: { mat: 'concrete', tint: '#cfc8b8' }, interiorFactor: 0.55,
  });
  // Satteldach-ähnlich flach geneigtes Blechdach weggelassen: Flachdach mit Attika, Lüftungshauben
  b.noNav(x - W / 2 - 0.5, z - D / 2 - 0.5, x + W / 2 + 0.5, z + D / 2 + 0.5, 2 * fh - 0.5, 40);
  for (const lx of [-10, 10]) b.box(x + lx, 2 * fh, z, 1.2, 0.8, 1.2, 'metal_galvanized', { ...KEIN });
  // Flurwände um das Treppenhaus (Durchgänge zu den Stuben)
  for (let f = 0; f < 2; f++) {
    const y = f ? fh : 0.12, h = fh - 0.25 - (f ? 0 : 0.12);
    for (const s of [-1, 1]) wall(b, { x0: cx + s * (cw / 2 + 0.1), z0: z - D / 2 + 0.3, x1: cx + s * (cw / 2 + 0.1), z1: z + D / 2 - 0.3, y, h, t: 0.14, mat: 'plaster_white', tint: '#e8e4da', openings: [{ at: 1.6, w: 1.0, h: 2.1, kind: 'door', leaf: 'open' }] });
  }
  // Stuben: Stockbetten, Spinde, Tisch
  const yF = [0.12, fh + 0.02], yC = [fh - 0.25, 2 * fh - 0.25];
  for (let f = 0; f < 2; f++) for (const s of [-1, 1]) {
    const y = yF[f];
    for (let k = 0; k < 3; k++) stockbett(b, x + s * (5.2 + k * 3.6), y, z + D / 2 - 1.5, PI);
    for (let k = 0; k < 2; k++) spinde(b, x + s * (6.8 + k * 3.6), y, z - D / 2 + 0.6, 0, 3, '#5a6a5a');
    essplatz(b, x + s * 12.0, y, z - 0.5, { w: 1.6, d: 0.8, n: 6, ry: Q });
    tisch(b, x + s * 7, y, z - 1.4, { w: 1.2, d: 0.7 });
    stuhl(b, x + s * 7, y, z - 0.7, PI);
    deckenlampe(b, x + s * 7, yC[f], z, y, { shade: '#d8d4ca', real: f === 0 && s < 0 });
    deckenlampe(b, x + s * 13, yC[f], z, y, { shade: '#d8d4ca' });
    if (hash01(x + s, z + f, 5) < 0.6) teppich(b, x + s * 10, y, z + 1, 2.2, 1.4, 0, '#4a5a3e');
  }
  b.defineSign('kaserne' + nr, { style: 'plate', text: 'BLOCK ' + nr, sub: 'Fliegerstaffel ' + (nr + 2), bg: '#2f3f2f', fg: '#e8e4d0' });
  b.sign(x + 1.6, 2.6, z - D / 2 - 0.02, 1.6, 0.55, 'kaserne' + nr, { ry: PI });
}

/** Kantine (1 Geschoss): Tische, Ausgabetheke, Küche. Front nach Osten. */
export function kantine(b, x, z) {
  const W = 20, D = 14;
  building(b, {
    x, z, w: W, d: D, floors: 1, fh: 4.0, mat: 'plaster_white', tint: '#e2dccc',
    openings: [
      { side: 'e', at: -3, w: 1.8, h: 2.4, kind: 'door', leaf: 'open' }, { side: 'w', at: 4, w: 1.0, h: 2.15, kind: 'door', leaf: 'open' },
      ...[-7, -3, 1, 5].map((at) => ({ side: 'n', at, w: 2.2, h: 1.6, kind: 'window' })),
      ...[-7, -3, 1, 5].map((at) => ({ side: 's', at, w: 2.2, h: 1.6, kind: 'window' })),
      { side: 'e', at: 3, w: 2.2, h: 1.6, kind: 'window' },
    ],
    roof: { parapet: 0.5, mat: 'concrete', tint: '#a8a49a' }, floorMat: 'tiles', floorTint: '#c8c2b4', interiorFactor: 0.6,
  });
  b.noNav(x - W / 2 - 0.5, z - D / 2 - 0.5, x + W / 2 + 0.5, z + D / 2 + 0.5, 3.6, 30);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) essplatz(b, x - 1 + i * 3.6, 0.12, z - 3 + j * 6, { w: 2.2, d: 0.9, n: 6, ry: Q });
  // Ausgabe + Küche (West)
  b.box(x - 6, 0.12, z, 0.7, 1.0, 9, 'metal_galvanized', { minimap: 'cover' });
  b.box(x - 6, 1.12, z, 0.8, 0.05, 9.1, 'metal_galvanized', { ...VG });
  for (let k = 0; k < 3; k++) b.box(x - 9.2, 0.12, z - 4.6 + k * 3.0, 0.9, 0.9, 1.6, 'metal_galvanized', { minimap: 'cover' }); // karten (22.11.): Herdblöcke von der Westtür (z + 4) weg (vorher z + 3,5 direkt davor)
  kuehlschrank(b, x - 9.3, 0.12, z + 5.4, Q);
  for (let k = 0; k < 4; k++) b.cyl(x - 6 + (k % 2) * 0.1, 1.17, z - 3 + k * 2, 0.18, 0.3, 'metal_galvanized', { ...KEIN, seg: 10 });
  for (const lz of [-3.5, 3.5]) for (const lx of [-3, 3]) deckenleuchte(b, x + lx, 3.75, z + lz, Q, 1.25, { real: lx < 0 && lz < 0 });
  b.defineSign('kantine', { style: 'plate', text: 'TRUPPENKÜCHE', bg: '#f2f0ea', fg: '#2a2b2c' });
  b.sign(x + W / 2 + 0.02, 3.0, z - 3, 3.2, 0.55, 'kantine', { ry: Q });
}

// ---------------------------------------------------------------------------
// Fahrzeughof
// ---------------------------------------------------------------------------
export function fahrzeughof(b, x, z) {
  b.groundTiled(x - 46, z - 32, x + 46, z + 32, 'concrete', { cell: 2, tint: '#aaa69d' });
  // Werkstatthalle (Tore nach Süden), Grube, Hebebühne
  const hx = x - 26, hz = z - 16;
  building(b, {
    x: hx, z: hz, w: 24, d: 14, floors: 1, fh: 6.0, mat: 'metal_corrugated', tint: '#8f9888',
    openings: [{ side: 's', at: -6, w: 5, h: 4.8, kind: 'gap', frame: false }, { side: 's', at: 4, w: 5, h: 4.8, kind: 'gap', frame: false }, { side: 'e', at: 2, w: 1.0, h: 2.15, kind: 'door', leaf: 'open' },
      ...[-8, -2, 4, 9].map((at) => ({ side: 'n', at, w: 3, h: 1.2, sill: 3.8, kind: 'window', glass: false, grid: [3, 1], frameMat: 'metal_painted', frameTint: '#4a5048' }))],
    roof: { edge: true, mat: 'metal_corrugated', tint: '#7d8478' }, floorMat: 'concrete', floorTint: '#a8a49a', plinth: { h: 1.0, mat: 'concrete_dark', tint: '#9a978e' }, interiorFactor: 0.6, pipes: false,
  });
  b.noNav(hx - 12.5, hz - 7.5, hx + 12.5, hz + 7.5, 5.6, 30);
  armeeLkw(b, hx - 6, hz + 1, PI + 0.05, { y: 0.12 });
  // Hebebühne mit Geländewagen-Rahmen
  for (const s of [-1, 1]) b.box(hx + 4 + s * 1.3, 0.12, hz, 0.4, 1.4, 4.4, 'metal_painted', { tint: '#c8402f', minimap: 'cover' });
  b.box(hx + 4, 1.52, hz, 2.0, 0.6, 4.2, 'metal_painted', { tint: OLIV, ...KEIN });
  workbench(b, hx - 11.3, hz - 3, { ry: Q, y: 0.12 });
  werkzeugwand(b, hx - 11.6, 0.12, hz + 2, Q);
  tires(b, hx + 10, hz - 5, { n: 5, y: 0.12 });
  tires(b, hx + 10.6, hz - 3.6, { n: 3, y: 0.12 });
  lockers(b, hx + 11.4, hz + 3, { ry: -Q, n: 4, y: 0.12 });
  for (const lx of [-6, 4]) hallenlampe(b, hx + lx, 5.8, hz, 0.12, { real: lx < 0 });
  // Carports (Stahlstützen, Blechdach) mit Fahrzeugen
  const cx0 = x + 2, cz0 = z - 20;
  for (let k = 0; k < 4; k++) {
    const px = cx0 + k * 5.6;
    for (const pz of [cz0 - 4, cz0 + 4]) b.box(px - 2.8, 0, pz, 0.2, 4.2, 0.2, 'metal_painted', { tint: '#4a5048', minimap: 'pillar' });
  }
  b.box(cx0 - 2.8 + 11.2, 4.2, cz0, 23, 0.2, 9.0, 'metal_corrugated', { tint: '#7d8478', minimap: 'roof', grad: false });
  b.noNav(cx0 - 4, cz0 - 5, cx0 + 21, cz0 + 5, 3.6, 30);
  armeeLkw(b, cx0, cz0, PI);
  armeeLkw(b, cx0 + 5.6, cz0 + 0.3, PI + 0.04);
  van(b, cx0 + 11.2, cz0, { ry: PI, color: '#5d6a4e' });
  van(b, cx0 + 16.8, cz0, { ry: PI, color: '#7a7f74' });
  // Tankstelle (Insel mit Dach)
  const tx = x + 30, tz = z + 6;
  for (const s of [-1, 1]) b.cyl(tx, 0, tz + s * 3.5, 0.18, 5.2, 'metal_painted', { tint: '#d8d4ca', minimap: 'pillar', seg: 10 });
  b.box(tx, 5.2, tz, 8, 0.5, 11, 'metal_painted', { tint: '#e2ded4', minimap: 'roof', grad: false });
  b.box(tx, 5.15, tz, 7.6, 0.05, 10.6, 'lamp_cool', { ...VG, cast: false });
  b.box(tx, 0, tz, 1.2, 0.2, 9, 'concrete', { tint: '#b8b4aa', grad: false, minimap: false });
  for (const s of [-1, 1]) {
    b.box(tx, 0.2, tz + s * 1.6, 0.7, 1.7, 0.5, 'metal_painted', { tint: '#c8402f', minimap: 'cover' });
    b.box(tx + 0.36, 1.2, tz + s * 1.6, 0.02, 0.3, 0.3, 'glass', { ...VG, tint: '#203848' });
  }
  van(b, tx + 3.2, tz - 1, { ry: PI, color: '#5d6a4e' });
  b.noNav(tx - 4.5, tz - 6, tx + 4.5, tz + 6, 4.8, 30);
  // Stellplätze mit Markierung, Abstellfläche
  for (let k = 0; k < 6; k++) linie(b, x - 10 + k * 5.5, z + 10, x - 10 + k * 5.5, z + 22, 0.04, '#e8e4dc', 0.14);
  armeeLkw(b, x - 7.25, z + 16, 0.02);
  armeeLkw(b, x + 3.75, z + 16, -0.03, { plane: '#6a6a4c' });
  barrelGroup(b, x + 40, z - 24, { n: 6 });
  crateStack(b, x + 40, z - 16, { ry: 0.2 });
  palletStack(b, x + 36, z - 26, { n: 5 });
  cableReel(b, x - 44, z + 24, { ry: 0.3 });
  b.defineSign('kfz', { style: 'plate', text: 'KFZ-INSTANDSETZUNG', bg: '#2f3f2f', fg: '#e8e4d0' });
  b.sign(hx, 5.2, hz + 7.02, 6, 0.7, 'kfz', { ry: 0 });
  floodMast(b, x - 44, z - 30, { h: 10 }); floodMast(b, x + 44, z + 30, { h: 10, ry: PI });
}

// ---------------------------------------------------------------------------
// Wache am Haupttor, Wachturm, Zaun
// ---------------------------------------------------------------------------
export function wache(b, x, z) {
  // Wachgebäude westlich der Einfahrt, Schranken, Schilder, Sandsäcke
  building(b, {
    x: x - 9, z, w: 7, d: 5, floors: 1, fh: 3.0, mat: 'plaster_white', tint: '#dcd6c6',
    openings: [{ side: 'e', at: 0, w: 1.0, h: 2.15, kind: 'door', leaf: 'open' }, { side: 's', at: 0, w: 3.6, h: 1.3, kind: 'window' }, { side: 'n', at: 0, w: 3.6, h: 1.3, kind: 'window' }, { side: 'w', at: 0, w: 1.4, h: 1.2, kind: 'window' }],
    roof: { edge: true }, floorMat: 'linoleum', floorTint: '#8a9a8a', interiorFactor: 0.6,
  });
  b.noNav(x - 13, z - 3, x - 5, z + 3, 2.6, 30);
  schreibtisch(b, x - 9.5, 0.12, z + 1.4, PI); bueroStuhl(b, x - 9.5, 0.12, z + 0.5, 0);
  funktisch(b, x - 11.6, 0.12, z - 1.5, Q);
  spinde(b, x - 7.0, 0.12, z - 2.0, 0, 2);
  deckenleuchte(b, x - 9, 2.75, z, 0, 1.25, { real: true });
  // Schranken (zwei Fahrspuren) + Mittelinsel
  b.box(x, 0, z, 1.2, 0.2, 6, 'concrete', { tint: '#c8c4ba', minimap: false });
  for (const s of [-1, 1]) {
    b.box(x + s * 0.3, 0, z + s * 2.5, 0.3, 1.1, 0.3, 'metal_painted', { tint: '#e8e4dc', minimap: 'prop' });
    const arm = 4.2;
    for (let k = 0; k < 6; k++) b.box(x + s * (0.3 + 0.35 + k * 0.7), 1.0, z + s * 2.5, 0.7, 0.1, 0.08, 'metal_painted', { tint: k % 2 ? '#c8302a' : '#f2f0ea', ...VG });
    void arm;
  }
  sandbags(b, x - 4.5, z - 6, x - 4.5, z - 2.5, { rows: 4 });
  sandbags(b, x + 4.5, z + 2.5, x + 4.5, z + 6, { rows: 4 });
  b.defineSign('tor', { style: 'plate', text: 'FLIEGERHORST HAGENMOOR', sub: 'Militärischer Sicherheitsbereich · Unbefugtes Betreten verboten', bg: '#24402e', fg: '#f1ede2' });
  b.box(x + 9, 0, z + 6, 0.12, 2.2, 0.12, 'metal_painted', { tint: '#3d4247', minimap: false });
  b.box(x + 13, 0, z + 6, 0.12, 2.2, 0.12, 'metal_painted', { tint: '#3d4247', minimap: false });
  b.sign(x + 11, 2.3, z + 6, 4.6, 1.4, 'tor', { ry: 0 });
  b.defineSign('halt', { style: 'warning', text: 'HALT! AUSWEISKONTROLLE', sub: 'Schusswaffengebrauch möglich' });
  b.sign(x + 2, 1.6, z + 5, 2.2, 1.2, 'halt', { ry: 0 });
  mgNest(b, x + 7, z - 4, { ry: 0 });
  lampPost(b, x - 4, z + 3.5, { h: 6, ry: PI / 2, kind: 'cool' });
  for (let k = 0; k < 4; k++) igel(b, x - 22 + k * 3.2, z + 9 + (k % 2) * 1.2);
}

/** Wachturm (Stahlbeine, Plattform 6 m mit Brüstung, Dach, Suchscheinwerfer), Leiter-Treppe. */
export function wachturm(b, x, y, z, ry = 0) {
  // karten (22.11.): stairs() kennt nur die vier Himmelsrichtungen – schräg gestellte Ecktürme (±45°/±135°) bekamen eine
  // achsparallele Treppe neben den Turm (oben ins Leere, unten teils außerhalb des Zauns). Drehung auf die nächste
  // Vierteldrehung, deren Treppe zur Kartenmitte zeigt.
  const QR = PI / 2;
  if (Math.abs(ry / QR - Math.round(ry / QR)) > 1e-6) {
    const foot = (r) => { const fx = x - Math.sin(r) * 6.75, fz = z - Math.cos(r) * 6.75; return Math.hypot(fx, fz); };
    const lo = Math.floor(ry / QR) * QR, hi = lo + QR;
    ry = foot(lo) <= foot(hi) ? lo : hi;
  }
  const f = frame(b, x, y, z, ry), H = 6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.box(sx * 1.4, 0, sz * 1.4, 0.2, H + 2.6, 0.2, 'metal_painted', { tint: OLIV_D, minimap: sx < 0 && sz < 0 ? 'pillar' : false });
  for (const yy of [1.8, 3.9]) for (const s of [-1, 1]) { f.box(0, yy, s * 1.4, 2.8, 0.08, 0.08, 'metal_painted', { tint: OLIV_D, ...VG }); f.box(s * 1.4, yy, 0, 0.08, 0.08, 2.8, 'metal_painted', { tint: OLIV_D, ...VG }); }
  f.box(0, H - 0.15, 0, 3.4, 0.15, 3.4, 'wood_planks', { tint: '#7a6a52', minimap: false, grad: false });
  // Brüstung; hinten (lokal −z) Durchstieg über der Treppe (lokal x 0,4 ± 0,5)
  f.box(0, H, 1.65, 3.4, 1.05, 0.1, 'wood_planks', { tint: '#6a5a44', minimap: false });
  for (const s of [-1, 1]) f.box(s * 1.65, H, 0, 0.1, 1.05, 3.4, 'wood_planks', { tint: '#6a5a44', minimap: false });
  // karten (22.11.): Durchstieg wirklich über der Treppe (x −0,1 … 0,9) – vorher deckte das linke Brett die halbe Treppe ab
  f.box(-0.9, H, -1.65, 1.6, 1.05, 0.1, 'wood_planks', { tint: '#6a5a44', minimap: false });
  f.box(1.3, H, -1.65, 0.8, 1.05, 0.1, 'wood_planks', { tint: '#6a5a44', minimap: false });
  f.box(0, H + 2.6, 0, 3.9, 0.12, 3.9, 'metal_corrugated', { tint: '#5a6450', minimap: 'roof', grad: false });
  f.box(1.2, H + 1.1, 1.2, 0.35, 0.3, 0.45, 'metal_painted', { tint: '#2b2d30', ...VG });
  f.box(1.2, H + 1.15, 1.43, 0.3, 0.22, 0.02, 'lamp_lens', { ...VG, ao: false });
  // Treppe (steil) an der Rückseite (lokal −z)
  const [tx, tz] = f.P(0.4, -1.75 - 5.0);
  const d = Math.abs(Math.cos(ry)) > 0.5 ? (Math.cos(ry) > 0 ? 's' : 'n') : (Math.sin(ry) > 0 ? 'e' : 'w');
  stairs(b, { x: tx, z: tz, dir: d, y0: y, y1: y + H - 0.15, w: 0.8, run: 5.0, style: 'steel', rail: true, railTint: '#3d4247' });
  const [nx, nz] = f.P(0, 0);
  b.navPoint(nx, y + H + 0.2, nz);
}

/** Zaun entlang einer Linie mit Pfosten aus dem Gelände (hf) und Lücken; Stacheldraht oben. gaps: [[t0, t1]] (m). */
export function zaunLinie(b, hf, x0, z0, x1, z1, gaps = []) {
  const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L, seg = 7.5;
  const n = Math.ceil(L / seg);
  for (let i = 0; i < n; i++) {
    const t0 = (i * L) / n, t1 = ((i + 1) * L) / n;
    if (gaps.some(([a, c]) => t1 > a && t0 < c)) continue;
    const ax = x0 + ux * t0, az = z0 + uz * t0, bx = x0 + ux * t1, bz = z0 + uz * t1;
    const y = Math.min(hf.heightAt(ax, az), hf.heightAt(bx, bz)) - 0.05;
    fence(b, ax, az, bx, bz, { h: 2.4, y, barbed: true, style: 'chain', minimap: 'wall' });
  }
}

/** Startbahn-Markierungen und -Befeuerung. rw: { x0, x1, z, w }; y Belagoberkante. */
export function startbahn(b, rw, y = 0.05) {
  const { x0, x1, z, w } = rw, L = x1 - x0, W = '#ecebe5';
  // Streifen entlang x: Länge lx, Breite wz (Atlaszelle „line“ = Streifen über ¼ der Tiefe)
  const paint = (cx, cz, lx, wz, op = 0.9) => b.decal(cx, y, cz, lx, wz * 4, 'line', { ry: 0, tint: W, kind: 'paint', opacity: op });
  // Seitenlinien (durchgehend, in 40-m-Stücken), Mittellinie (30 m Strich, 20 m Lücke)
  for (let xx = x0 + 2; xx < x1 - 2; xx += 40) for (const s of [-1, 1]) paint(Math.min(xx + 20, x1 - 2), z + s * (w / 2 - 1.2), 40, 0.9, 0.85);
  for (let xx = x0 + 60; xx < x1 - 60; xx += 50) paint(xx + 15, z, 30, 0.9);
  // Schwellen (Klaviertasten), Aufsetzzonen, Zielpunktmarkierung
  for (const end of [-1, 1]) {
    const xe = end < 0 ? x0 + 6 : x1 - 6, inward = -end;
    for (let k = 0; k < 8; k++) for (const s of [-1, 1]) paint(xe + inward * 15, z + s * (2.6 + k * 2.4), 30, 1.6);
    for (const d of [150, 300]) for (const s of [-1, 1]) paint(xe + inward * (d + 11), z + s * 6, 22, 1.8);
    for (const s of [-1, 1]) paint(xe + inward * 222, z + s * 7.5, 45, 4.5);
    // Schwellenbefeuerung grün / Ende rot
    for (let k = -8; k <= 8; k++) {
      const lx = end < 0 ? x0 - 0.5 : x1 + 0.5;
      b.cyl(lx, y - 0.04, z + k * (w / 17), 0.14, 0.18, 'metal_painted', { tint: '#3d4247', ...KEIN, seg: 8 });
      b.cyl(lx, y + 0.14, z + k * (w / 17), 0.1, 0.06, k % 2 ? 'lamp_green' : 'lamp_redlens', { ...KEIN, seg: 8, ao: false });
    }
  }
  // Randbefeuerung (alle 60 m)
  for (let xx = x0; xx <= x1 + 0.1; xx += 60) for (const s of [-1, 1]) {
    b.cyl(xx, y - 0.04, z + s * (w / 2 + 1.5), 0.08, 0.42, 'metal_painted', { tint: '#e8c22c', ...KEIN, seg: 8 });
    b.cyl(xx, y + 0.38, z + s * (w / 2 + 1.5), 0.11, 0.12, 'lamp_lens', { ...KEIN, seg: 8, ao: false });
  }
  // Pistenkennung als Schilder neben den Schwellen
  b.defineSign('rw09', { style: 'number', text: '09', sub: 'PISTE', bg: '#c8302a', fg: '#ffffff' });
  b.defineSign('rw27', { style: 'number', text: '27', sub: 'PISTE', bg: '#c8302a', fg: '#ffffff' });
  for (const [xx, key, ry] of [[x0 + 30, 'rw09', -Q], [x1 - 30, 'rw27', Q]]) {
    const sz = z - w / 2 - 8;
    b.box(xx, y, sz, 1.6, 0.9, 0.3, 'concrete', { tint: '#e8e4dc', minimap: false });
    b.sign(xx, y + 0.9, sz, 1.4, 1.2, key, { ry: ry + Q });
  }
}

/** Gleitwinkelbefeuerung (vier Kästen) links der Bahn an x, Bahnachse z. */
export function papi(b, x, z, y = 0) {
  for (let k = 0; k < 4; k++) {
    b.box(x, y, z + k * 9, 1.2, 0.7, 0.9, 'metal_painted', { tint: '#e8e4dc', minimap: false });
    b.box(x + 0.61, y + 0.3, z + k * 9, 0.02, 0.25, 0.6, k < 2 ? 'lamp_redlens' : 'lamp_lens', { ...VG, ao: false });
  }
}

/** Windsack auf Mast. */
export function windsack(b, x, z, y = 0, ry = 0.6) {
  b.cyl(x, y, z, 0.1, 6, 'metal_painted', { tint: '#e8e4dc', seg: 8, minimap: 'prop' });
  const f = frame(b, x, y + 5.6, z, ry);
  for (let k = 0; k < 5; k++) f.cyl(0, 0, 0.2 + k * 0.7, 0.42 - k * 0.06, 0.68, 'tarp', { axis: 'z', r1: 0.36 - k * 0.06, tint: k % 2 ? '#f2f0ea' : '#ff6a1a', ...KEIN, seg: 10, rx: 0.12 });
}

/** Anflugbefeuerung: Masten in Bahnachse ab xs Richtung dir (±1), Querbalken. */
export function anflug(b, hf, xs, z, dir, n = 6) {
  for (let k = 0; k < n; k++) {
    const x = xs + dir * k * 30, y = hf.heightAt(x, z), h = 1.2 + k * 0.5;
    b.cyl(x, y, z, 0.12, h, 'metal_painted', { tint: '#c8302a', seg: 8, minimap: 'prop' });
    b.box(x, y + h, z, 0.25, 0.12, k === 3 ? 12 : 4, 'metal_painted', { tint: '#3d4247', ...KEIN });
    for (let j = -2; j <= 2; j++) b.cyl(x, y + h + 0.1, z + j * (k === 3 ? 2.6 : 0.8), 0.09, 0.1, 'lamp_lens', { ...KEIN, seg: 6, ao: false });
  }
}

/** Hubschrauberlandeplatz (Betonplatte 22 × 22, Kreis + „H“). */
export function heliPad(b, x, z, y = 0) {
  b.box(x, y - 0.25, z, 22, 0.32, 22, 'concrete_panel', { tint: '#aaa79e', grad: false, minimap: false });
  const W = '#ecebe5';
  for (let k = 0; k < 24; k++) { const a = (k / 24) * PI * 2; b.decal(x + Math.cos(a) * 8.5, y + 0.08, z + Math.sin(a) * 8.5, 2.0, 2.0, 'line', { ry: Math.atan2(-Math.cos(a), -Math.sin(a)), tint: '#e8c22c', kind: 'paint', opacity: 0.9 }); }
  b.decal(x - 2.4, y + 0.085, z, 7, 4.8, 'line', { ry: Q, tint: W, kind: 'paint', opacity: 0.95 });
  b.decal(x + 2.4, y + 0.085, z, 7, 4.8, 'line', { ry: Q, tint: W, kind: 'paint', opacity: 0.95 });
  b.decal(x, y + 0.086, z, 4.8, 4.0, 'line', { ry: 0, tint: W, kind: 'paint', opacity: 0.95 });
  for (const [ax, az] of [[-10.5, -10.5], [10.5, -10.5], [10.5, 10.5], [-10.5, 10.5]]) b.cyl(x + ax, y + 0.07, z + az, 0.1, 0.12, 'lamp_lens', { tint: '#ffd27a', ...KEIN, seg: 8, ao: false });
}

/** Hauptquartier einer Seite (Feldlager am Vorfeld): Zelte, Container, Flaggenmast, Stellflächen, Schutzbau. */
export function hauptquartier(b, x, z, side, o = {}) {
  const s = side === 'A' ? 1 : -1, col = side === 'A' ? '#2f6db5' : '#c0392b';
  b.groundTiled(x - 36, z - 34, x + 36, z + 34, 'concrete', { cell: 2, tint: '#a9a59c' });
  b.defineSign('hq_' + side, { style: 'stencil', text: side === 'A' ? 'GEFECHTSSTAND WEST' : 'GEFECHTSSTAND OST', sub: 'Fahrzeugpark · Luftbereitschaft', bg: '#3a3f33', fg: '#e8e2cf' });
  for (const p of o.pads || []) {
    const tank = p[2] === 'tank';
    b.box(p[0], 0, p[1], tank ? 5.2 : 3.6, 0.06, tank ? 9.5 : 6.5, 'concrete_panel', { ry: p[3] || 0, tint: '#a9a59c', collide: false, grad: false, minimap: false });
    b.decal(p[0], 0.07, p[1], tank ? 4.6 : 3.2, 0.5, 'line', { ry: (p[3] || 0) + Q, tint: '#e8c22c', kind: 'paint', opacity: 0.8 });
  }
  for (const h of o.helis || []) heliPad(b, h[0], h[1], 0.06);
  // Zelte (Stabszelt, Sanität), Container, Funk
  const tent = (tx, tz, tint = '#5b6142') => { b.box(tx, 0, tz, 5.2, 1.8, 7.2, 'tarp', { tint, minimap: 'cover' }); b.wedge(tx, 1.8, tz, 5.2, 1.4, 7.2, 'tarp', { tint, minimap: false }); };
  tent(x - s * 24, z - 22); tent(x - s * 16, z - 22, '#6a6a4c'); tent(x - s * 24, z - 12, '#5a5f48');
  container(b, x + s * 28, 0, z - 26, { ry: Q, color: '#56603f' });
  container(b, x + s * 28, 0, z - 19, { ry: Q, color: '#4a5338' });
  crateStack(b, x - s * 30, z - 4, { ry: 0.2 });
  barrelGroup(b, x - s * 30, z + 2, { n: 5 });
  munitionskisten(b, x - s * 20, 0, z - 5, 0.3, 4);
  b.cyl(x, 0, z - 28, 0.08, 10, 'metal_galvanized', { seg: 8, minimap: 'prop' });
  b.box(x + 0.9, 8.6, z - 28, 1.8, 1.1, 0.04, 'fabric_camo_a', { tint: col, ...VG });
  floodMast(b, x + 32, z + 30, { h: 10 }); floodMast(b, x - 32, z + 30, { h: 10 });
  sandbags(b, x - 12, z - 33, x + 12, z - 33, { rows: 3 });
  b.sign(x + s * 28 - s * 1.25, 1.35, z - 19, 3.2, 0.8, 'hq_' + side, { ry: s * Q });
  if (o.schutzbau) schutzbau(b, o.schutzbau[0], o.schutzbau[1], o.schutzbau[2] || 0);
}
