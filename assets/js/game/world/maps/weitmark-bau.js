// NULLPUNKT — Bausteine der Riesenkarte „Weitmark“ (riesen 20.11.) (Owner: world). Frei erfundene Kleinstadt-,
// Dorf- und Industriebauten: Wohnhäuser mit Satteldach (betretbar, Treppe ins Obergeschoss), Scheunen, Kirche mit
// Turm, Rathaus, Stahlbetonbrücken, Industriehallen, Ringofen-Schornstein, Holzpolter, Gleise und Güterwagen,
// Funkstation mit Gittermast, Flugleitung. Dazu ein Straßenzug-Platzierer, der Häuser beidseitig achsparalleler
// Straßen reiht (eigener Zufallsstrom je Ortschaft, Freiflächen/Flaggen/Startpunkte bleiben frei).
// Alles achsparallel (arch.js building()), Koordinaten Welt-x/z, Boden y = Bauflächenhöhe.
import { building, wall, stairs, railing, pitchedRoof } from '../arch.js?v=20261115041504';
import { sandbags, crateStack, barrelGroup, palletStack, floodMast, fence, hash01, frame } from '../props.js?v=20261115041504';

const PI = Math.PI;
const DIRV = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
export const PUTZ = ['#e4e1d8', '#dcd6c8', '#e8e2d2', '#d8cdb8', '#d6dad2', '#e2d9c6', '#cfc7b6', '#e9e5dc', '#d9c9a8', '#c9cdc4'];
export const ZIEGEL = ['#efe6de', '#e2d5cb', '#f2e9e2', '#a88576', '#d8c8bc', '#b9a296'];
const NOCOL = { collide: false, minimap: false };

/** Fenster ringsum (Achsabstand 2,8 m, ohne Glas – beschießbar) und Türen. */
function oeffnungen(w, d, floors, doors, skip = []) {
  const ops = [];
  for (const side of ['n', 's', 'e', 'w']) {
    const len = side === 'n' || side === 's' ? w : d;
    const n = Math.max(1, Math.floor((len - 1.4) / 2.8));
    for (let f = 0; f < floors; f++) for (let k = 0; k < n; k++) {
      const at = -((n - 1) * 2.8) / 2 + k * 2.8;
      if (f === 0 && doors.some((dd) => dd.side === side && Math.abs(dd.at - at) < 1.7)) continue;
      if (f === 0 && skip.includes(side)) continue;
      ops.push({ side, at, w: 1.0, h: 1.3, sill: 0.95, kind: 'window', floor: f, shutters: f === 0 && k % 2 ? '#5b4a3a' : undefined });
    }
  }
  for (const dd of doors) ops.push({ side: dd.side, at: dd.at, w: dd.w ?? 1.15, h: dd.h ?? 2.15, kind: 'door', leaf: dd.leaf || 'open', floor: 0 });
  return ops;
}

/**
 * Wohnhaus mit Satteldach. o: { x, z, w, d, floors (1|2), door: 'n'|'s'|'e'|'w', color, roofTint, y, mat }.
 * Zweigeschossig: Treppe an der Wand gegenüber der Haustür, Treppenloch mit Geländer.
 */
export function haus(b, o) {
  const { x, z, w, d } = o;
  const floors = o.floors ?? 2, fh = 3.0, y = o.y ?? 0, door = o.door || 's';
  const color = o.color || b.pick(PUTZ);
  const holes = [];
  let st = null;
  if (floors > 1) {
    // Treppe entlang der längeren Wand, Aufstieg Richtung Hausmitte, an der Rückwand (gegenüber der Tür)
    const back = { n: 's', s: 'n', e: 'w', w: 'e' }[door];
    const run = (fh - 0.12) / 0.62, sw = 1.1;
    let sx, sz, dir;
    if (back === 'n' || back === 's') { // Treppe läuft in x an der Nord-/Südwand
      const zz = back === 'n' ? z - d / 2 + 0.3 + sw / 2 + 0.05 : z + d / 2 - 0.3 - sw / 2 - 0.05;
      sx = x - w / 2 + 0.45; sz = zz; dir = 'e';
    } else {
      const xx = back === 'w' ? x - w / 2 + 0.3 + sw / 2 + 0.05 : x + w / 2 - 0.3 - sw / 2 - 0.05;
      sx = xx; sz = z - d / 2 + 0.45; dir = 's';
    }
    const [dx, dz] = DIRV[dir], rx = -dz, rz = dx;
    const P = (f, r) => [sx + dx * f + rx * r, sz + dz * f + rz * r];
    const c0 = P(0.9, -sw / 2 - 0.08), c1 = P(run + 0.05, sw / 2 + 0.08);
    holes.push({ floor: 1, x0: Math.min(c0[0], c1[0]), x1: Math.max(c0[0], c1[0]), z0: Math.min(c0[1], c1[1]), z1: Math.max(c0[1], c1[1]) });
    st = { x: sx, z: sz, dir, run, w: sw, wall: back };
  }
  const doorAt = o.doorAt ?? 0;
  const B = building(b, {
    x, z, w, d, floors, fh, y, mat: o.mat || 'plaster_white', tint: color,
    openings: oeffnungen(w, d, floors, [{ side: door, at: doorAt }]), holes,
    roof: { edge: false, mat: 'concrete', tint: '#b9ab94' },
    floorMat: 'wood_planks', upperFloorMat: 'wood_planks', floorTint: '#b39474',
    frameMat: 'wood_dark', frameTint: '#5a4636', sillMat: 'stone_wall',
    plinth: { h: 0.5, mat: 'stone_wall', tint: '#c3baa8', over: 0.03 },
    interiorFactor: 0.55, nutzung: o.nutzung || 'wohn',
  });
  pitchedRoof(b, { x, z, w: w + 0.02, d: d + 0.02, y: B.roofY - 0.02, ridge: o.ridge || (w >= d ? 'x' : 'z'), pitch: o.pitch ?? 0.72, over: 0.5, gableMat: o.mat || 'plaster_white', gableTint: o.gableTint || color, tint: o.roofTint || b.pick(ZIEGEL) });
  b.noNav(x - w / 2 - 0.6, z - d / 2 - 0.6, x + w / 2 + 0.6, z + d / 2 + 0.6, B.roofY - 0.6, y + 40);
  if (o.fachwerk && floors > 1) fachwerk(b, x, z, w, d, y, fh, floors, o.fachwerkTint);
  if (st) {
    stairs(b, { x: st.x, z: st.z, dir: st.dir, y0: y + 0.12, y1: y + fh, w: st.w, run: st.run, style: 'solid', mat: 'wood_planks', tint: '#9c7a56', rail: 'both', railFrom: 1.4, railTint: '#5a4636' });
    const hl = holes[0];
    // Geländer um das Treppenloch oben (Ankunftsseite offen)
    const yy = y + fh + 0.02;
    if (st.dir === 'e') { railing(b, hl.x0, st.wall === 'n' ? hl.z1 : hl.z0, hl.x1 - 1.2, st.wall === 'n' ? hl.z1 : hl.z0, yy, { tint: '#5a4636', mat: 'wood_dark' }); }
    else railing(b, st.wall === 'w' ? hl.x1 : hl.x0, hl.z0, st.wall === 'w' ? hl.x1 : hl.x0, hl.z1 - 1.2, yy, { tint: '#5a4636', mat: 'wood_dark' });
  }
  return B;
}

/** Holzscheune mit großem Tor (Satteldach). o: { x, z, w, d, door, y, h }. */
export function scheune(b, o) {
  const { x, z, w, d } = o, y = o.y ?? 0, h = o.h ?? 5.2, door = o.door || 's';
  const B = building(b, {
    x, z, w, d, floors: 1, fh: h, y, mat: 'wood_planks', tint: o.tint || '#8a6a4c', t: 0.2,
    openings: [{ side: door, at: 0, w: 4.2, h: 4.0, kind: 'door', leaf: 'open', floor: 0 }, ...['e', 'w', 'n', 's'].filter((s) => s !== door).map((side) => ({ side, at: 0, w: 1.2, h: 0.9, sill: 2.6, kind: 'window', floor: 0 }))],
    roof: { edge: false, mat: 'concrete', tint: '#9a8c74' }, floorMat: 'dirt', floorTint: '#8a7a62', pipes: false, interiorFactor: 0.5, nutzung: 'stall',
  });
  pitchedRoof(b, { x, z, w: w + 0.02, d: d + 0.02, y: B.roofY - 0.02, ridge: w >= d ? 'x' : 'z', pitch: 0.8, over: 0.6, gableMat: 'wood_planks', gableTint: o.tint || '#8a6a4c', tint: o.roofTint || '#b08a7c' });
  b.noNav(x - w / 2 - 0.6, z - d / 2 - 0.6, x + w / 2 + 0.6, z + d / 2 + 0.6, B.roofY - 0.4, y + 40);
  // Strohballen und Kisten innen (Deckung)
  for (let k = 0; k < 3; k++) b.box(x - w / 2 + 1.4 + k * 1.3, y + 0.05, z - d / 2 + 1.2, 1.2, 0.8, 0.9, 'sand', { tint: '#d6bd70', minimap: 'cover' });
  b.cyl(x + w / 2 - 1.6, y + 0.8, z + d / 2 - 1.6, 0.75, 1.2, 'sand', { axis: 'x', tint: '#d9c27a', seg: 12, minimap: 'cover' });
  return B;
}

/** Kirche: Schiff (w × d, Längsachse z) mit Turm an der Südseite, Pyramidendach, Rundbogenfenster als Öffnungen. */
export function kirche(b, x, z, o = {}) {
  const y = o.y ?? 0, w = o.w ?? 12, d = o.d ?? 22, h = 7.5;
  const tint = o.tint || '#e6e0d2';
  const nave = building(b, {
    x, z, w, d, floors: 1, fh: h, y, mat: 'plaster_white', tint,
    openings: [
      { side: 's', at: 0, w: 1.8, h: 2.9, kind: 'door', leaf: 'open', floor: 0 },
      ...[-0.34, -0.11, 0.11, 0.34].map((f) => Math.round(f * d * 10) / 10).flatMap((at) => [{ side: 'e', at, w: 1.2, h: 3.2, sill: 2.6, kind: 'window', floor: 0 }, { side: 'w', at, w: 1.2, h: 3.2, sill: 2.6, kind: 'window', floor: 0 }]),
      { side: 'e', at: Math.round(d * 0.44 * 10) / 10 - 0.4, w: 1.1, h: 2.1, kind: 'door', leaf: 'open', floor: 0 },
    ],
    roof: { edge: false, mat: 'concrete', tint: '#b9ab94' }, floorMat: 'tiles', floorTint: '#b7ab98', interiorFactor: 0.5, nutzung: 'kapelle',
    plinth: { h: 0.7, mat: 'stone_wall', tint: '#bdb3a0', over: 0.04 },
  });
  pitchedRoof(b, { x, z, w: w + 0.02, d: d + 0.02, y: nave.roofY - 0.02, ridge: 'z', pitch: 1.0, over: 0.5, gableMat: 'plaster_white', gableTint: tint, tint: '#8f7466' });
  b.noNav(x - w / 2 - 0.6, z - d / 2 - 0.6, x + w / 2 + 0.6, z + d / 2 + 0.6, nave.roofY - 0.5, y + 60);
  // Bänke (Deckung), Altar
  for (let r = 0, nr = Math.min(6, Math.floor((d - 8) / 1.9)); r < nr; r++) for (const s of [-1, 1]) b.box(x + s * (w / 2 - 0.4 - Math.min(3.6, w / 2 - 1.4) / 2), y + 0.12, z - d / 2 + 5 + r * 1.9, Math.min(3.6, w / 2 - 1.4), 0.85, 0.45, 'wood_planks', { tint: '#6e5240', minimap: 'cover' });
  b.box(x, y + 0.12, z - d / 2 + 2, Math.min(2.6, w - 3), 1.0, 1.0, 'stone_wall', { tint: '#cfc6b4', minimap: 'cover' });
  // Turm (Schaft 5 × 5, Spitzhelm) an der Nordseite – Portal im Süden bleibt frei
  const tz = z - d / 2 - 2.5, tw = 5, th = o.towerH ?? 22;
  b.box(x, y, tz, tw, th, tw, 'plaster_white', { tint: o.towerTint || '#ddd6c6', minimap: 'building' });
  for (const [sx, sz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) b.box(x + sx * (tw / 2 + 0.02), y + th - 4.2, tz + sz * (tw / 2 + 0.02), sz ? 1.1 : 0.06, 2.2, sx ? 1.1 : 0.06, 'black', { ...NOCOL, grad: false });
  b.cyl(x, y + th, tz, tw * 0.72, 9, 'roof_tiles', { r1: 0.05, seg: 4, ry: PI / 4, tint: '#5f6f66', minimap: false });
  b.cyl(x, y + th + 9, tz, 0.05, 1.6, 'metal_galvanized', { ...NOCOL, seg: 6 });
  // Uhr
  for (const s of [-1, 1]) b.cyl(x, y + th - 7, tz + s * (tw / 2 + 0.03), 0.9, 0.06, 'plaster_white', { axis: 'z', tint: '#f2efe6', ...NOCOL, seg: 18 });
  return { nave, tower: { x, z: tz, h: th } };
}

/** Rathaus: dreigeschossig, Walmdach-Ersatz (flaches Dach mit Brüstung), Freitreppe, Uhr und Schild. */
export function rathaus(b, x, z, o = {}) {
  const y = o.y ?? 0, w = o.w ?? 22, d = o.d ?? 13, floors = 3, fh = 3.4, door = o.door || 's';
  const ops = oeffnungen(w, d, floors, [{ side: door, at: 0, w: 2.2, h: 2.6 }]);
  const run = (fh - 0.12) / 0.62;
  const holes = [1, 2].map((f) => ({ floor: f, x0: x - w / 2 + 0.6, x1: x - w / 2 + 0.6 + run + 0.4, z0: z - d / 2 + 0.35, z1: z - d / 2 + 0.35 + 1.4 }));
  const B = building(b, {
    x, z, w, d, floors, fh, y, mat: 'plaster_white', tint: o.tint || '#d9c9a8', openings: ops, holes,
    roof: { edge: false, mat: 'concrete', tint: '#a49c8c' }, floorMat: 'tiles', upperFloorMat: 'wood_planks', floorTint: '#a8977e',
    frameMat: 'wood_dark', frameTint: '#4a3a2c', sillMat: 'stone_wall', band: { mat: 'stone_wall', tint: '#c2b69c' },
    plinth: { h: 0.8, mat: 'stone_wall', tint: '#b8ad98', over: 0.05 }, interiorFactor: 0.55, nutzung: 'buero',
  });
  for (let f = 0; f < 2; f++) {
    stairs(b, { x: x - w / 2 + 0.7, z: z - d / 2 + 1.05, dir: 'e', y0: y + f * fh + (f ? 0.02 : 0.12), y1: y + (f + 1) * fh, w: 1.2, run, style: 'solid', mat: 'concrete', tint: '#b8b0a2', rail: 'right', railTint: '#3d4247' });
  }
  // weit2: steiles Satteldach mit Dachreiter (Glocke, Uhr), Eckquaderung, Balkon über dem Portal, Podest, Fahnen
  pitchedRoof(b, { x, z, w: w + 0.02, d: d + 0.02, y: B.roofY - 0.02, ridge: 'x', pitch: 1.05, over: 0.6, gableMat: 'plaster_white', gableTint: o.tint || '#d9c9a8', tint: '#7d5a4c' });
  b.noNav(x - w / 2 - 0.7, z - d / 2 - 0.7, x + w / 2 + 0.7, z + d / 2 + 0.7, B.roofY - 0.5, y + 60);
  const ridgeY = B.roofY + (d / 2) * 1.05;
  b.box(x, ridgeY - 1.2, z, 2.2, 3.4, 2.2, 'wood_painted', { tint: '#e8e2d4', collide: false, minimap: false });
  for (const [sx, sz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) b.box(x + sx * 1.11, ridgeY + 0.9, z + sz * 1.11, sz ? 0.9 : 0.04, 1.0, sx ? 0.9 : 0.04, 'black', { ...NOCOL, grad: false });
  b.cyl(x, ridgeY + 2.2, z, 1.65, 3.2, 'roof_tiles', { r1: 0.05, seg: 8, tint: '#5f6f66', ...NOCOL });
  b.cyl(x, ridgeY + 5.4, z, 0.04, 1.4, 'metal_galvanized', { ...NOCOL, seg: 6 });
  for (const s2 of [-1, 1]) b.cyl(x, ridgeY + 0.2, z + s2 * 1.13, 0.55, 0.05, 'plaster_white', { axis: 'z', tint: '#f2efe6', ...NOCOL, seg: 16 });
  for (const ex of [-1, 1]) for (const ez of [-1, 1]) for (let k = 0; k < Math.floor(floors * fh / 0.7); k++) {
    const lw = k % 2 ? 0.5 : 0.85;
    b.box(x + ex * (w / 2 + 0.03) - ex * (lw / 2 - 0.25) * 0, y + 0.8 + k * 0.7, z + ez * (d / 2 + 0.03), ex ? 0.36 : lw, 0.62, ez ? lw : 0.36, 'stone_wall', { tint: '#c8bca4', ...NOCOL, grad: false });
  }
  const dz = door === 's' ? 1 : -1, fz = z + dz * (d / 2);
  // Balkon (Platte + Geländer) über dem Portal, Freitreppe (3 Stufen) davor
  b.box(x, y + fh + 0.02, fz + dz * 0.75, 4.6, 0.18, 1.5, 'stone_wall', { tint: '#c2b69c', minimap: false });
  for (const s3 of [-1, 1]) b.box(x + s3 * 2.2, y + fh + 0.2, fz + dz * 0.75, 0.08, 0.9, 1.4, 'metal_painted', { tint: '#2e3236', ...NOCOL });
  b.box(x, y + fh + 0.2, fz + dz * 1.46, 4.5, 0.9, 0.06, 'metal_painted', { tint: '#2e3236', ...NOCOL, grad: false });
  b.box(x, y, fz + dz * 1.1, 5.2, 0.06, 2.2, 'stone_wall', { tint: '#b8ad98', minimap: false, collide: false, grad: false }); // Podest (bodengleich)
  for (const s3 of [-1, 1]) {
    b.cyl(x + s3 * 4.2, y, fz + dz * 2.2, 0.05, 7.5, 'metal_galvanized', { seg: 6, minimap: false });
    b.box(x + s3 * 4.2 + 0.03, y + 6.1, fz + dz * 2.2 - 0.6, 0.02, 1.0, 1.2, 'awning', { tint: s3 < 0 ? '#f2c230' : '#2f5f9a', ...NOCOL, grad: false });
  }
  b.defineSign('rathaus', { style: 'plate', text: 'RATHAUS', sub: 'Stadt Kesselbrück', bg: '#2f3f52', fg: '#efe6d4' });
  const sz = door === 's' ? z + d / 2 + 0.06 : z - d / 2 - 0.06;
  b.sign(x, y + fh + 0.4, sz, 4.2, 0.9, 'rathaus', { ry: door === 's' ? 0 : PI });

  return B;
}

/**
 * Straßenbrücke (Stahlbeton) entlang x über den Fluss: Deck von x0 bis x1 auf Höhe y, Breite w, Pfeiler im Fluss,
 * Brüstungen, Laternen, Sandsack-Sperren an den Köpfen.
 */
export function bruecke(b, o) {
  const { x0, x1, z } = o, y = o.y ?? 0.8, w = o.w ?? 9, L = x1 - x0, cx = (x0 + x1) / 2;
  b.box(cx, y - 0.7, z, L, 0.7, w, 'concrete', { tint: o.tint || '#b8b2a6', minimap: 'building' });
  b.box(cx, y, z, L - 0.2, 0.02, w - 2.4, 'asphalt', { ...NOCOL, grad: false });
  for (const s of [-1, 1]) {
    b.box(cx, y, z + s * (w / 2 - 0.6), L, 0.18, 1.2, 'concrete', { tint: '#c4bdb0', minimap: false }); // Gehweg
    b.box(cx, y + 0.18, z + s * (w / 2 - 0.12), L, 0.85, 0.24, 'concrete', { tint: '#c8c2b6', minimap: 'wall' }); // Brüstung
  }
  // Pfeiler und Widerlager
  const nP = Math.max(1, Math.round(L / 28));
  for (let k = 1; k <= nP; k++) b.box(x0 + (L * k) / (nP + 1), -6, z, 2.0, 6 + y - 0.7, w - 1.2, 'concrete', { tint: '#a8a296', minimap: false });
  for (const xe of [x0, x1]) b.box(xe, -4, z, 3, 4 + y - 0.7, w + 1, 'concrete', { tint: '#a8a296', minimap: false });
  // Laternen
  for (let xx = x0 + 6; xx < x1 - 3; xx += 18) for (const s of [-1, 1]) {
    b.cyl(xx, y + 1.0, z + s * (w / 2 - 0.12), 0.07, 4.2, 'metal_painted', { tint: '#3d4247', seg: 8, minimap: false, collide: false });
    b.box(xx, y + 5.1, z + s * (w / 2 - 0.6), 0.3, 0.16, 0.9, 'metal_painted', { tint: '#3d4247', ...NOCOL });
  }
  if (o.barricade !== false) {
    sandbags(b, x0 - 6, z - w / 2 + 1, x0 - 6, z - 0.8, { rows: 4, y: (o.headY ?? y) });
    sandbags(b, x1 + 6, z + 0.8, x1 + 6, z + w / 2 - 1, { rows: 4, y: (o.headY ?? y) });
  }
  b.noNav(-1e4, -1e4, 1e4, 1e4, -30, -1.7);
}

/** Industriehalle (Wellblech, hohe Tore, Flachdach mit Attika). o: { x, z, w, d, h, doors: [{ side, at, w }], tint }. */
export function halle(b, o) {
  const { x, z, w, d } = o, y = o.y ?? 0, h = o.h ?? 8;
  const doors = (o.doors || [{ side: 's', at: 0, w: 5 }]).map((dd) => ({ side: dd.side, at: dd.at, w: dd.w ?? 5, h: dd.h ?? 5, kind: 'door', leaf: 'open', floor: 0 }));
  const wins = [];
  for (const side of ['n', 's', 'e', 'w']) {
    const len = side === 'n' || side === 's' ? w : d;
    for (let at = -len / 2 + 3; at <= len / 2 - 3; at += 4.5) if (!doors.some((dd) => dd.side === side && Math.abs(dd.at - at) < dd.w / 2 + 1.2)) wins.push({ side, at, w: 2.4, h: 1.4, sill: h - 2.4, kind: 'window', floor: 0, glass: false });
  }
  const B = building(b, {
    x, z, w, d, floors: 1, fh: h, y, mat: o.mat || 'metal_corrugated', tint: o.tint || '#8d949a', t: 0.3,
    openings: [...doors, ...wins], roof: { edge: true, mat: 'concrete', tint: '#8f8a80', edgeTint: '#4b5157' },
    floorMat: 'concrete', floorTint: '#9e9a92', interiorFactor: 0.6, nutzung: 'lager', pipes: false,
    plinth: { h: 0.9, mat: 'concrete', tint: '#a09b92', over: 0.02 },
  });
  b.noNav(x - w / 2 - 0.5, z - d / 2 - 0.5, x + w / 2 + 0.5, z + d / 2 + 0.5, B.roofY - 0.5, y + 60);
  // Innen: Kistenstapel, Fässer, Paletten (Deckung)
  const H = (k) => hash01(x, z, k);
  for (let k = 0; k < Math.max(2, Math.round((w * d) / 160)); k++) {
    const px = x - w / 2 + 3 + H(k * 3 + 1) * (w - 6), pz = z - d / 2 + 3 + H(k * 3 + 2) * (d - 6);
    if (doors.some((dd) => Math.hypot(px - (x + (dd.side === 'e' ? w / 2 : dd.side === 'w' ? -w / 2 : dd.at)), pz - (z + (dd.side === 's' ? d / 2 : dd.side === 'n' ? -d / 2 : dd.at))) < 6)) continue;
    const t = H(k * 3 + 3);
    if (t < 0.4) crateStack(b, px, pz, { y: y + 0.12, ry: t * 3 }); else if (t < 0.7) barrelGroup(b, px, pz, { y: y + 0.12, n: 4 }); else palletStack(b, px, pz, { y: y + 0.12, n: 3, load: 'boxes', ry: t * 2 });
  }
  return B;
}

/** Fabrikschornstein (Ziegel, verjüngt). */
export function schornstein(b, x, z, h = 38, y = 0) {
  b.box(x, y, z, 4.2, 2.4, 4.2, 'brick', { tint: '#9a5a44', minimap: 'pillar' });
  b.cyl(x, y + 2.4, z, 1.7, h - 2.4, 'brick', { r1: 1.05, seg: 14, tint: '#a5614a', minimap: false });
  b.cyl(x, y + h, z, 1.18, 0.6, 'brick', { seg: 14, tint: '#6b3f30', ...NOCOL });
}

/** Holzpolter (gestapelte Stämme, Länge L entlang ry). */
export function holzpolter(b, x, z, ry = 0, o = {}) {
  const y = o.y ?? 0, L = o.L ?? 8, rows = o.rows ?? 3, r = 0.28;
  const f = frame(b, x, y, z, ry);
  for (let row = 0; row < rows; row++) {
    const n = 6 - row;
    for (let k = 0; k < n; k++) f.cyl((k - (n - 1) / 2) * r * 2.05, r + row * r * 1.75, 0, r * (0.9 + hash01(x + k, z + row, 3) * 0.2), L, 'wood_planks', { axis: 'z', tint: '#8a6848', seg: 10, minimap: row === 0 && k === 0 ? 'cover' : false, collide: false });
  }
  f.box(0, 0, 0, 12 * r, rows * r * 1.75 + r, L, 'black', { visual: false, minimap: false });
}

/** Gleis (zwei Schienen + Schotterbett) von (x0,z) nach (x1,z), entlang x. */
export function gleis(b, x0, x1, z, y = 0) {
  const L = x1 - x0, cx = (x0 + x1) / 2;
  b.box(cx, y, z, L, 0.2, 3.2, 'gravel', { tint: '#8e877c', ...NOCOL, grad: false });
  for (const s of [-1, 1]) b.box(cx, y + 0.2, z + s * 0.72, L, 0.14, 0.08, 'metal_painted', { tint: '#6a6560', ...NOCOL, grad: false, ao: false });
  for (let xx = x0 + 0.4; xx < x1; xx += 2.4) b.box(xx, y + 0.12, z, 0.24, 0.1, 2.5, 'wood_dark', { tint: '#5a4a3a', ...NOCOL, grad: false, ao: false });
}

/** Gedeckter Güterwagen (Deckung, nicht befahrbar). */
export function gueterwagen(b, x, z, o = {}) {
  const y = (o.y ?? 0) + 0.34, L = o.L ?? 13, col = o.color || '#6b3a2c';
  b.box(x, y + 0.6, z, L, 2.6, 2.8, 'metal_painted', { tint: col, minimap: 'container' });
  b.box(x, y + 3.2, z, L, 0.25, 2.9, 'metal_painted', { tint: '#4a4440', ...NOCOL });
  b.box(x, y + 0.2, z, L - 1, 0.4, 2.2, 'metal_painted', { tint: '#2b2a28', ...NOCOL });
  for (const s of [-1, 1]) for (const e of [-1, 1]) b.cyl(x + e * (L / 2 - 2.2), y + 0.12, z + s * 0.72, 0.46, 0.14, 'metal_painted', { axis: 'z', seg: 14, tint: '#3a3836', ...NOCOL });
  b.box(x, y + 1.0, z + 1.42, 2.4, 2.0, 0.06, 'metal_painted', { tint: '#5a3024', ...NOCOL, grad: false });
}

/** Funkstation auf dem Kamm: Betonbunker mit Eingang, Gittermast, Zaun, Sandsack-Stellungen. */
export function funkstation(b, x, z, y) {
  const bw = 9, bd = 7;
  const B = building(b, {
    x, z, w: bw, d: bd, floors: 1, fh: 2.9, y, mat: 'concrete', tint: '#9e9a8f', t: 0.45,
    openings: [{ side: 's', at: -2, w: 1.1, h: 2.1, kind: 'door', leaf: 'open', floor: 0 }, { side: 'n', at: 0, w: 1.6, h: 0.5, sill: 1.5, kind: 'window', floor: 0 }, { side: 'e', at: 0, w: 1.4, h: 0.5, sill: 1.5, kind: 'window', floor: 0 }],
    roof: { edge: true, mat: 'concrete', tint: '#8e8a80' }, floorMat: 'concrete', interiorFactor: 0.5, nutzung: 'lager', pipes: false,
  });
  b.noNav(x - bw / 2 - 0.4, z - bd / 2 - 0.4, x + bw / 2 + 0.4, z + bd / 2 + 0.4, B.roofY - 0.4, y + 60);
  // Gittermast (Beine mit Kollision)
  const mx = x + 9, mz = z - 4, h = 34, r = 1.3;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.cyl(mx + sx * r, y, mz + sz * r, 0.1, h, 'metal_galvanized', { r1: 0.07, seg: 6, minimap: sx < 0 && sz < 0 ? 'pillar' : false, rx: -sz * 0.03, rz: sx * 0.03 });
  for (let k = 1; k * 3 < h; k++) {
    const yy = y + k * 3, rr = r * (1 - (k * 3) / h * 0.6);
    for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
      const L = Math.hypot(bx - ax, bz - az) * rr;
      b.box(mx + (ax + bx) / 2 * rr, yy, mz + (az + bz) / 2 * rr, L, 0.06, 0.06, 'metal_galvanized', { ry: Math.atan2(-(bz - az), bx - ax), ...NOCOL, grad: false });
    }
  }
  b.cyl(mx, y + h, mz, 0.05, 5, 'metal_painted', { tint: '#c23a2e', seg: 6, ...NOCOL });
  b.light('point', mx, y + h + 4.6, mz, { color: '#ff3020', intensity: 0.6, distance: 6 });
  b.glow(mx, y + h + 4.9, mz, { size: 1.6, color: '#ff3a20', intensity: 1.2 });
  for (const [ax, az, bx, bz] of [[x - 16, z - 14, x + 18, z - 14], [x + 18, z - 14, x + 18, z + 12], [x - 16, z + 12, x - 4, z + 12], [x + 4, z + 12, x + 18, z + 12], [x - 16, z - 14, x - 16, z + 12]]) fence(b, ax, az, bx, bz, { h: 2.2, y, style: 'chain', barbed: true, minimap: 'wall' });
  sandbags(b, x - 6, z + 7, x - 1, z + 8, { rows: 4, y });
  sandbags(b, x + 3, z + 8, x + 8, z + 7, { rows: 4, y });
  sandbags(b, x - 12, z - 6, x - 12, z + 2, { rows: 4, y });
  return B;
}

/** Flugleitung (kleiner Turm mit verglaster Kanzel) des Segelflugfelds. */
export function flugleitung(b, x, z, y = 0) {
  const B = building(b, {
    x, z, w: 10, d: 7, floors: 2, fh: 3.2, y, mat: 'plaster_white', tint: '#e6e2d8',
    openings: [...oeffnungen(10, 7, 2, [{ side: 'n', at: -2 }])],
    holes: [{ floor: 1, x0: x - 0.3, x1: x + 3.8, z0: z - 3.2, z1: z - 1.9 }],
    roof: { parapet: 1.0, mat: 'concrete', tint: '#a49c8c' }, floorMat: 'linoleum', upperFloorMat: 'linoleum', interiorFactor: 0.55, nutzung: 'buero',
  });
  stairs(b, { x: x - 1.2, z: z - 2.55, dir: 'e', y0: y + 0.12, y1: y + 3.2, w: 1.1, run: 4.9, style: 'metal_painted', rail: 'right', railTint: '#3d4247' });
  // Kanzel auf dem Dach (Glas umlaufend, beschießbar)
  const ky = B.roofY;
  b.box(x - 1.5, ky, z, 4.6, 0.9, 4.2, 'concrete', { tint: '#d8d2c4', minimap: false });
  for (const [sx, sz, ww, dd] of [[0, -2.1, 4.6, 0.06], [0, 2.1, 4.6, 0.06], [-2.3, 0, 0.06, 4.2], [2.3, 0, 0.06, 4.2]]) b.box(x - 1.5 + sx, ky + 0.9, z + sz, ww, 1.6, dd, 'glass', { tint: '#9fb4bc', minimap: false, collide: false });
  b.box(x - 1.5, ky + 2.5, z, 5.0, 0.2, 4.6, 'metal_painted', { tint: '#4b5157', minimap: false });
  return B;
}

/**
 * Häuser beidseitig einer achsparallelen Straße reihen. o: { axis: 'x'|'z', at (z- bzw. x-Wert der Straßenachse),
 * from, to, road (halbe Fahrbahn + Gehweg), sides [-1, 1], free (Rechtecke [x0,z0,x1,z1], die frei bleiben),
 * taken (Liste belegter Rechtecke, wird ergänzt), rand (Zufallsfunktion), floors [1,2], y, gap, depth }
 * → Anzahl gesetzter Häuser.
 */
export function strassenzug(b, o) {
  const rand = o.rand || (() => b.rand());
  const taken = o.taken, free = o.free || [];
  const hit = (r, list) => list.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
  let n = 0;
  for (const s of o.sides || [-1, 1]) {
    let t = o.from + 2 + rand() * 4;
    while (t < o.to - 6) {
      const w = 8 + Math.round(rand() * 4), d = 7 + Math.round(rand() * 3);
      const along = o.axis === 'x' ? w : d, across = o.axis === 'x' ? d : w;
      const off = o.road + 2.5 + rand() * 2.5 + across / 2;
      const cA = t + along / 2;
      if (cA + along / 2 > o.to) break;
      const x = o.axis === 'x' ? cA : o.at + s * off, z = o.axis === 'x' ? o.at + s * off : cA;
      const r = [x - w / 2 - 1.2, z - d / 2 - 1.2, x + w / 2 + 1.2, z + d / 2 + 1.2];
      if (!hit(r, taken) && !hit(r, free)) {
        const door = o.axis === 'x' ? (s > 0 ? 'n' : 's') : (s > 0 ? 'w' : 'e');
        const fl = rand() < (o.twoFloor ?? 0.6) ? 2 : 1;
        haus(b, { x, z, w, d, floors: fl, door, y: o.y ?? 0 });
        taken.push(r);
        n++;
        // Vorgarten-Zaun oder Mäuerchen zur Straße (Deckung kniehoch)
        if (rand() < 0.35) {
          const fz = o.axis === 'x' ? z - s * (d / 2 + 1.6) : null, fx = o.axis === 'z' ? x - s * (w / 2 + 1.6) : null;
          if (o.axis === 'x') wall(b, { x0: x - w / 2, z0: fz, x1: x - 1, z1: fz, y: o.y ?? 0, h: 0.8, t: 0.35, mat: 'stone_wall', tint: '#c9c0ae', minimap: 'wall' });
          else wall(b, { x0: fx, z0: z - d / 2, x1: fx, z1: z - 1, y: o.y ?? 0, h: 0.8, t: 0.35, mat: 'stone_wall', tint: '#c9c0ae', minimap: 'wall' });
        }
      }
      t += along + (o.gap ?? 3) + rand() * 5;
    }
  }
  return n;
}

/** Schneller Zufallsstrom (eigene Folge je Ortschaft, unabhängig vom Builder-Zufall). */
export function strom(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------------------------------------------------------------------------
// weit2 (20.11.): gewachsene Ortsbilder – Häuser entlang gekrümmter Straßen (Gelände/Fluss folgend), unregelmäßige
// Parzellen, Hausvielfalt (Größe, Firstrichtung, Dachneigung/-farbe, Fachwerk, Anbauten, Garagen), Gärten mit Zaun,
// Schuppen und Obstbäumen, Hofstellen. Weiterhin achsparallel (building()); Straßenkrümmung → versetzte Fluchten.
// ---------------------------------------------------------------------------
export const DACH = ['#a8705c', '#9a5e4c', '#b47a62', '#8f6a5e', '#5f5c5a', '#6e4c40', '#b9856c', '#7a5446', '#a0624e', '#4f5354'];
export const PUTZ2 = [...PUTZ, '#e6d3b0', '#dcc6a2', '#cfd6cc', '#e8d8c8', '#d8c0ac', '#c9b9a0', '#e1dccf'];
const HOLZ = '#4a3528';

/** Fachwerk (Ständer, Riegel, Streben) auf den Fassaden der Obergeschosse – reine Optik, Fenster bleiben frei. */
export function fachwerk(b, x, z, w, d, y0, fh, floors, tint = HOLZ) {
  const T = 0.06, S = 0.15, O = { ...NOCOL, tint, grad: false };
  for (let f = 1; f < floors; f++) {
    const yb = y0 + f * fh;
    for (const side of ['n', 's', 'e', 'w']) {
      const ns = side === 'n' || side === 's', L = ns ? w : d;
      const off = (ns ? d : w) / 2 + T / 2 + 0.005, sg = side === 's' || side === 'e' ? 1 : -1;
      const bx = (a, yy, len, h) => (ns ? b.box(x + a, yy, z + sg * off, len, h, T, 'wood_dark', O) : b.box(x + sg * off, yy, z + a, T, h, len, 'wood_dark', O));
      for (const hy of [0.0, 0.8, fh - 0.18]) bx(0, yb + hy, L, S);
      const n = Math.max(1, Math.floor((L - 1.4) / 2.8));
      const posts = [-L / 2 + S / 2, L / 2 - S / 2];
      for (let k = 0; k < n; k++) { const at = -((n - 1) * 2.8) / 2 + k * 2.8; posts.push(at - 0.62, at + 0.62); }
      for (const a of posts) bx(a, yb, S, fh);
      // Streben in den Eckfeldern (Mann-Figur angedeutet)
      const first = -((n - 1) * 2.8) / 2 - 0.62, span = first - (-L / 2 + S);
      if (span > 0.9) for (const m of [-1, 1]) {
        const cx = m * (-L / 2 + S + span / 2), len = Math.hypot(span, fh * 0.75), ang = Math.atan2(fh * 0.75, span) * m;
        if (ns) b.box(x + cx, yb + fh / 2 - S / 2, z + sg * off, len, S, T, 'wood_dark', { ...O, rz: ang });
        else b.box(x + sg * off, yb + fh / 2 - S / 2, z + cx, T, S, len, 'wood_dark', { ...O, rx: -ang });
      }
    }
  }
}

/** Einfacher Anbau/Schuppen/Garage: geschlossener Quader (Kollision) mit Pult- bzw. Satteldach. */
export function anbau(b, o) {
  const { x, z, w, d } = o, y = o.y ?? 0, h = o.h ?? 2.7;
  b.box(x, y, z, w, h, d, o.mat || 'plaster_white', { tint: o.tint || '#ddd5c4', minimap: 'building' });
  b.box(x, y, z, w + 0.06, 0.4, d + 0.06, 'stone_wall', { tint: '#b8ae9c', ...NOCOL, grad: false });
  if (o.roof === 'flat') b.box(x, y + h, z, w + 0.3, 0.16, d + 0.3, 'concrete', { tint: '#8d877c', minimap: 'roof' });
  else pitchedRoof(b, { x, z, w: w + 0.02, d: d + 0.02, y: y + h - 0.02, ridge: w >= d ? 'x' : 'z', pitch: o.pitch ?? 0.6, over: 0.3, gableMat: o.mat || 'plaster_white', gableTint: o.tint || '#ddd5c4', tint: o.roofTint || '#8f6a5e', details: false });
  b.noNav(x - w / 2 - 0.4, z - d / 2 - 0.4, x + w / 2 + 0.4, z + d / 2 + 0.4, y + h - 0.3, y + 30);
  // Tor/Tür als Fassadenbild (nicht begehbar)
  if (o.tor) {
    const [sx, sz] = DIRV[o.tor], tw = o.torW ?? Math.min(2.6, (sx ? d : w) - 0.6), th = o.torH ?? 2.1;
    const px = x + sx * (w / 2 + 0.03), pz = z + sz * (d / 2 + 0.03);
    b.box(px, y + 0.05, pz, sx ? 0.05 : tw, th, sx ? tw : 0.05, o.torMat || 'metal_painted', { ...NOCOL, tint: o.torTint || '#7a7d80', grad: false });
  }
}

/** Gartenzaun (Latten, ≈ 1 m) zwischen zwei Punkten; Kollision als dünne unsichtbare Wand. */
export function gartenzaun(b, x0, z0, x1, z1, o = {}) {
  const y = o.y ?? 0, L = Math.hypot(x1 - x0, z1 - z0);
  if (L < 0.5) return;
  const ry = Math.atan2(-(z1 - z0), x1 - x0), ux = (x1 - x0) / L, uz = (z1 - z0) / L, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  const tint = o.tint || '#8a6a4a', h = o.h ?? 1.0;
  if (o.art === 'hecke') {
    b.box(mx, y, mz, L, h + 0.3, 0.7, 'grass', { ry, tint: '#55703a', minimap: 'wall' });
    return;
  }
  for (let s = 0; s <= L + 0.01; s += 2.2) b.box(x0 + ux * s, y, z0 + uz * s, 0.09, h + 0.1, 0.09, 'wood_dark', { ry, tint: '#5a4636', ...NOCOL });
  for (const hy of [0.25, h - 0.2]) b.box(mx, y + hy, mz, L, 0.06, 0.03, 'wood_planks', { ry, tint, ...NOCOL, grad: false });
  // Latten als eine Brettwand (Holztextur zeigt die Fugen) statt Einzellatten – ein Bruchteil der Dreiecke
  if (o.art !== 'draht') b.box(mx, y + 0.05, mz, L, h - 0.08, 0.02, 'wood_planks', { ry, tint, ...NOCOL, grad: false, ao: false, uvScale: 0.6 });
  b.box(mx, y, mz, L, h, 0.1, 'black', { ry, visual: false, minimap: false, bullet: false });
}

/** Gartenausstattung innerhalb [x0,z0,x1,z1]: Schuppen, Beet, Holzstapel; Obstbäume → baeume ([x, z, s, ry]). */
function garteninhalt(b, r, rand, o) {
  const [x0, z0, x1, z1] = r, w = x1 - x0, d = z1 - z0, y = o.y ?? 0;
  if (rand() < 0.45 && w > 4 && d > 4) {
    const sx = rand() < 0.5 ? x0 + 1.4 : x1 - 1.4, sz = rand() < 0.5 ? z0 + 1.2 : z1 - 1.2;
    anbau(b, { x: sx, z: sz, w: 2.2, d: 1.8, h: 2.1, y, mat: 'wood_planks', tint: b.pick(['#7a5a40', '#6b5038', '#8a6a4c', '#5d6b52']), roofTint: '#5f5c5a', pitch: 0.45, tor: rand() < 0.5 ? 'e' : 'w', torMat: 'wood_dark', torW: 0.9, torH: 1.8, torTint: '#4a3a2c' });
  }
  if (rand() < 0.55 && w > 3 && d > 3) {
    const bx = x0 + w * (0.3 + rand() * 0.4), bz = z0 + d * (0.3 + rand() * 0.4);
    b.box(bx, y, bz, Math.min(3.5, w * 0.4), 0.12, Math.min(2.2, d * 0.35), 'dirt', { tint: '#6a5442', ...NOCOL, grad: false });
  }
  const nb = w * d > 60 ? 1 + (rand() < 0.5 ? 1 : 0) : rand() < 0.5 ? 1 : 0;
  for (let k = 0; k < nb; k++) o.baeume?.push([x0 + 1.8 + rand() * Math.max(0.1, w - 3.6), z0 + 1.8 + rand() * Math.max(0.1, d - 3.6), 0.6 + rand() * 0.25, rand() * 6.28]);
}

/**
 * Häuser entlang einer gekrümmten Straße (Polylinie o.pts). o: { pts, road (Abstand Achse → Fluchtlinie), sides [-1, 1],
 * rand, taken, free, y, zwei (Anteil zweigeschossig), fachwerk, garten, anbau, garage, gap [min, max], baeume (Liste),
 * from/to (Bogenlänge), hof (Anteil Hofstellen mit Scheune) } → Anzahl Häuser.
 */
export function ortsstrasse(b, o) {
  const rand = o.rand, taken = o.taken, free = o.free || [], y = o.y ?? 0, pts = o.pts;
  const hit = (r, list) => list.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
  const ok = (r) => !hit(r, taken) && !hit(r, free);
  const segs = [];
  let L = 0;
  for (let k = 0; k + 1 < pts.length; k++) { const [ax, az] = pts[k], [bx, bz] = pts[k + 1], l = Math.hypot(bx - ax, bz - az); segs.push({ ax, az, bx, bz, l, L0: L }); L += l; }
  const at = (t) => { let sg = segs[segs.length - 1]; for (const q of segs) if (t <= q.L0 + q.l) { sg = q; break; } const u = Math.max(0, Math.min(1, (t - sg.L0) / sg.l)); return { x: sg.ax + (sg.bx - sg.ax) * u, z: sg.az + (sg.bz - sg.az) * u, tx: (sg.bx - sg.ax) / sg.l, tz: (sg.bz - sg.az) / sg.l }; };
  const rect = (cx, cz, w, d, m) => [cx - w / 2 - m, cz - d / 2 - m, cx + w / 2 + m, cz + d / 2 + m];
  const [g0, g1] = o.gap || [1.6, 6];
  let n = 0;
  for (const s of o.sides || [-1, 1]) {
    let t = (o.from ?? 0) + 3 + rand() * 5;
    const tEnd = Math.min(L, o.to ?? L) - 4;
    while (t < tEnd) {
      const k = rand();
      let la, dp, fl;
      if (k < 0.2) { la = 6.5 + Math.round(rand() * 2); dp = 8 + Math.round(rand() * 2); fl = rand() < 0.45 ? 2 : 1; }
      else if (k < 0.82) { la = 8 + Math.round(rand() * 4); dp = 7 + Math.round(rand() * 3); fl = rand() < (o.zwei ?? 0.6) ? 2 : 1; }
      else { la = 11 + Math.round(rand() * 3); dp = 9 + Math.round(rand() * 2); fl = 2; }
      const p = at(t + la / 2);
      const nx = -p.tz * s, nz = p.tx * s;
      const alongX = Math.abs(p.tx) >= Math.abs(p.tz);
      const w = alongX ? la : dp, d = alongX ? dp : la;
      const setback = o.road + 1.2 + rand() * (o.vorgarten ?? 3.5);
      let cx = p.x + nx * (setback + dp / 2), cz = p.z + nz * (setback + dp / 2);
      cx = Math.round(cx * 2) / 2; cz = Math.round(cz * 2) / 2;
      const door = alongX ? (nz > 0 ? 'n' : 's') : (nx > 0 ? 'w' : 'e');
      const r = rect(cx, cz, w, d, 0.9);
      if (!ok(r)) { t += 2 + rand() * 2; continue; }
      const fw = fl > 1 && rand() < (o.fachwerk ?? 0.25);
      const color = fw ? b.pick(['#eee8da', '#f0e9d8', '#e9e2cf']) : b.pick(PUTZ2);
      haus(b, { x: cx, z: cz, w, d, floors: fl, door, y, color, roofTint: b.pick(DACH), pitch: 0.55 + rand() * 0.45, ridge: rand() < 0.3 ? (w >= d ? 'z' : 'x') : undefined, fachwerk: fw });
      n++;
      // Hinterland (Richtung weg von der Straße): Anbau, Garten
      const bxv = Math.sign(nx) * (Math.abs(nx) > Math.abs(nz) ? 1 : 0), bzv = Math.sign(nz) * (Math.abs(nz) >= Math.abs(nx) ? 1 : 0);
      let back = (bxv ? w : d) / 2;
      if (rand() < (o.anbau ?? 0.3)) {
        const aw = bxv ? 3 : Math.max(3, la * 0.55), ad = bxv ? Math.max(3, la * 0.55) : 3;
        const off = (rand() - 0.5) * (la - (bxv ? ad : aw)) * 0.8;
        const ax = cx + bxv * (back + 1.5) + (bxv ? 0 : off), az = cz + bzv * (back + 1.5) + (bxv ? off : 0);
        const ra = rect(ax, az, aw, ad, 0.3);
        if (ok(ra)) { anbau(b, { x: ax, z: az, w: aw, d: ad, y, h: 2.6, tint: color, roofTint: b.pick(DACH), pitch: 0.4 }); taken.push(ra); back += 3.3; }
      }
      if (rand() < (o.garage ?? 0.22)) {
        // Garage neben dem Haus, Tor zur Straße
        const side = rand() < 0.5 ? -1 : 1, gl = 3.3, gd = 6;
        const gx = alongX ? cx + side * (w / 2 + 0.6 + gl / 2) : p.x + nx * (setback + gd / 2);
        const gz = alongX ? p.z + nz * (setback + gd / 2) : cz + side * (d / 2 + 0.6 + gl / 2);
        const gw = alongX ? gl : gd, gdd = alongX ? gd : gl;
        const rg = rect(gx, gz, gw, gdd, 0.3);
        if (ok(rg)) { anbau(b, { x: gx, z: gz, w: gw, d: gdd, y, h: 2.5, roof: 'flat', mat: 'plaster_white', tint: b.pick(['#d6d0c4', '#cfc9bc', '#bfb8aa']), tor: door, torW: 2.4, torTint: b.pick(['#7a7d80', '#6a4a36', '#8e8a7c', '#3e5a6e']) }); taken.push(rg); }
      }
      taken.push(r);
      if (rand() < (o.garten ?? 0.6)) {
        const gd2 = 7 + rand() * 7, gwid = la + 1 + rand() * 2;
        const g0x = cx + bxv * (back + 1.05), g0z = cz + bzv * (back + 1.05);
        const gr = bxv ? [Math.min(g0x, g0x + bxv * gd2), cz - gwid / 2, Math.max(g0x, g0x + bxv * gd2), cz + gwid / 2] : [cx - gwid / 2, Math.min(g0z, g0z + bzv * gd2), cx + gwid / 2, Math.max(g0z, g0z + bzv * gd2)];
        const rr = [gr[0] - 0.12, gr[1] - 0.12, gr[2] + 0.12, gr[3] + 0.12];
        if (ok(rr)) {
          const art = rand() < 0.25 ? 'hecke' : 'latten';
          const [x0, z0, x1, z1] = gr;
          // drei Seiten (die Hausseite bleibt offen), Pforte in einer Seitenlinie
          const edges = bxv ? [[x0, z0, x1, z0], [x0, z1, x1, z1], bxv > 0 ? [x1, z0, x1, z1] : [x0, z0, x0, z1]] : [[x0, z0, x0, z1], [x1, z0, x1, z1], bzv > 0 ? [x0, z1, x1, z1] : [x0, z0, x1, z0]];
          edges.forEach(([ax, az, ex, ez], i) => {
            if (i === 0) { const mx = ax + (ex - ax) * 0.5, mz = az + (ez - az) * 0.5, ll = Math.hypot(ex - ax, ez - az) || 1, ux = (ex - ax) / ll, uz = (ez - az) / ll; gartenzaun(b, ax, az, mx - ux * 0.6, mz - uz * 0.6, { y, art }); gartenzaun(b, mx + ux * 0.6, mz + uz * 0.6, ex, ez, { y, art }); }
            else gartenzaun(b, ax, az, ex, ez, { y, art });
          });
          garteninhalt(b, gr, rand, o);
          taken.push(rr);
        }
      }
      t += la + g0 + rand() * (g1 - g0);
    }
  }
  return n;
}

/** Hofstelle: Wohnhaus und Scheune im Winkel um einen Hofplatz, Misthaufen, Holzstapel, Hofbaum. */
export function hofstelle(b, o) {
  const { x, z, rand } = o, y = o.y ?? 0, qx = o.qx ?? 1, qz = o.qz ?? 1;
  const hw = 10 + Math.round(rand() * 3), hd = 8 + Math.round(rand() * 2);
  const hx = x, hz = z - qz * 7;
  haus(b, { x: hx, z: hz, w: hw, d: hd, floors: 2, door: qz < 0 ? 's' : 'n', y, color: b.pick(PUTZ2), roofTint: b.pick(DACH), pitch: 0.75 + rand() * 0.2, fachwerk: rand() < 0.4 });
  const sw = 10 + Math.round(rand() * 3), sd = 15 + Math.round(rand() * 4);
  const sx = x + qx * (hw / 2 + 2 + sw / 2), sz = z + qz * 3;
  scheune(b, { x: sx, z: sz, w: sw, d: sd, door: qx < 0 ? 'e' : 'w', y, tint: b.pick(['#8a6a4c', '#7a5a40', '#6b4f3a', '#94704e']), roofTint: b.pick(['#b08a7c', '#9a6a5a', '#7a6a62']) });
  b.groundTiled(Math.min(hx, sx) - 3, Math.min(hz, sz) - 1, Math.max(hx, sx) + 3, Math.max(hz, sz) + 1, 'gravel', { cell: 2, tint: '#a39886', collide: false });
  // Misthaufen, Holzstapel, Strohballen
  b.box(x - qx * 4, y, z + qz * 6, 3.2, 0.9, 2.4, 'dirt', { tint: '#4f3d2c', minimap: 'cover' });
  for (let k = 0; k < 3; k++) b.cyl(x + qx * (2 + k * 1.7), y + 0.75, z + qz * 9, 0.75, 1.2, 'sand', { axis: 'x', tint: '#d9c27a', seg: 12, minimap: k === 0 ? 'cover' : false });
  o.baeume?.push([x - qx * 8, z + qz * 2, 1.05, rand() * 6]);
  return [Math.min(hx - hw / 2, sx - sw / 2) - 2, Math.min(hz - hd / 2, sz - sd / 2) - 2, Math.max(hx + hw / 2, sx + sw / 2) + 2, Math.max(hz + hd / 2, sz + sd / 2) + 2];
}
