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
  pitchedRoof(b, { x, z, w: w + 0.02, d: d + 0.02, y: B.roofY - 0.02, ridge: w >= d ? 'x' : 'z', pitch: o.pitch ?? 0.72, over: 0.5, gableMat: o.mat || 'plaster_white', gableTint: color, tint: o.roofTint || b.pick(ZIEGEL) });
  b.noNav(x - w / 2 - 0.6, z - d / 2 - 0.6, x + w / 2 + 0.6, z + d / 2 + 0.6, B.roofY - 0.6, y + 40);
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
    roof: { parapet: 0.9, mat: 'concrete', tint: '#a49c8c' }, floorMat: 'tiles', upperFloorMat: 'wood_planks', floorTint: '#a8977e',
    frameMat: 'wood_dark', frameTint: '#4a3a2c', sillMat: 'stone_wall', band: { mat: 'stone_wall', tint: '#c2b69c' },
    plinth: { h: 0.8, mat: 'stone_wall', tint: '#b8ad98', over: 0.05 }, interiorFactor: 0.55, nutzung: 'buero',
  });
  for (let f = 0; f < 2; f++) {
    stairs(b, { x: x - w / 2 + 0.7, z: z - d / 2 + 1.05, dir: 'e', y0: y + f * fh + (f ? 0.02 : 0.12), y1: y + (f + 1) * fh, w: 1.2, run, style: 'solid', mat: 'concrete', tint: '#b8b0a2', rail: 'right', railTint: '#3d4247' });
  }
  b.defineSign('rathaus', { style: 'plate', text: 'RATHAUS', sub: 'Stadt Kesselbrück', bg: '#2f3f52', fg: '#efe6d4' });
  const sz = door === 's' ? z + d / 2 + 0.06 : z - d / 2 - 0.06;
  b.sign(x, y + fh + 0.4, sz, 4.2, 0.9, 'rathaus', { ry: door === 's' ? 0 : PI });
  b.cyl(x, y + 3 * fh + 1.2, sz, 0.8, 0.06, 'plaster_white', { axis: 'z', tint: '#f2efe6', ...NOCOL, seg: 18 });
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
