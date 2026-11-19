// NULLPUNKT — Karte „Stadtkern“: Bausteine (Strang karten-neu, 14.11.) (Owner: world).
// Mehrgeschossige Altbauten mit Läden (Schaufenster, Auslagen, Schilder), Hausflur mit Podesttreppe bis zum Dach,
// möblierten Wohnungen, Toreinfahrten in die Hinterhöfe, Balkonen und Kriegsschäden (ausgebrannter Dachstock, vernagelte
// Fenster, Ruß, Schutt); Straßenbahngleise mit Fahrleitung, ausgebrannte Straßenbahnwagen (begehbar), U-Bahn-
// Verteilerebene unter der Straße mit zwei Abgängen, Litfaßsäule, Telefonzelle, Kulissenfassaden am Kartenrand.
// Spiegelung: Bausteine bekommen s = ±1 (Team-Hälfte); Straßenseite liegt bei kleinerem |z|.
import * as THREE from 'three';
import { building, wall, railing, slab } from '../arch.js?v=20261115041504';
import { frame, hash01, sandbags, car, jersey, lampPost, awning, tree, bench, dumpster, electricBox, crateStack, barrelGroup, palletStack, tires, cone } from '../props.js?v=20261115041504';
import { stairCore, flight, KEIN, VG, hoch, mittel, rubble, soot, chip, igel, tonnen, bauzaun } from './neu-bau.js?v=20261115041504';
import { deckenlampe, kafiglampe, tisch, stuhl, essplatz, bett, schrank, regal, kommode, kueche, bild, teppich, theke, waschtisch } from './grenzland-innen.js?v=20261115041504';
import { shelf, armchair, wardrobe, dresser, picture, rug } from './altstadt-ausstattung.js?v=20261115041504';
import { schreibtisch, stuhl as bueroStuhl, aktenschrank, deckenleuchte, spinde, pinnwand } from './hafen-ausstattung.js?v=20261115041504';

const PI = Math.PI, Q = PI / 2;
export const FH = 3.4;
// Fassadenfarben: Ocker, Grau, Altweiß, Lachs, blasses Grün, Sandstein – damit die Zeile nicht einfarbig wirkt
const PUTZ = ['#d9cdb4', '#b9b6ae', '#e2dccd', '#d4b39a', '#c2c9b4', '#cfb98e', '#a9a49a', '#d8c2b0', '#c8bba0', '#bcc3c4'];

/** Seitenname der Straßen- bzw. Hofseite einer Hälfte (s = +1: Süden, Straße im Norden). */
export const streetSide = (s) => (s > 0 ? 'n' : 's');
export const backSide = (s) => (s > 0 ? 's' : 'n');

// ---------------------------------------------------------------------------
// Ladeneinrichtung
// ---------------------------------------------------------------------------
const SHOPS = {
  baecker: { name: 'BÄCKEREI KORNBLUM', bg: '#6a3a1e', fg: '#f6e6c4', goods: 'bread', awning: 2 },
  apotheke: { name: 'LINDEN-APOTHEKE', bg: '#1f6f46', fg: '#ffffff', goods: 'pharma', awning: -1 },
  eisen: { name: 'EISENWAREN HÄBERLE', bg: '#2f3f52', fg: '#f2c230', goods: 'tools', awning: 1 },
  buch: { name: 'BUCHHANDLUNG SEITENWIND', bg: '#3a2a4a', fg: '#efe6d4', goods: 'books', awning: 3 },
  mode: { name: 'MODEHAUS LINDNER', bg: '#1c1c1c', fg: '#e8d8b0', goods: 'cloth', awning: 0 },
  kiosk: { name: 'TABAK · ZEITUNGEN', bg: '#c8302a', fg: '#ffffff', goods: 'boxes', awning: 2 },
  gemuese: { name: 'OBST & GEMÜSE ADLER', bg: '#3c6a2a', fg: '#ffffff', goods: 'jars', awning: 1 },
  cafe: { name: 'CAFÉ AM LINDENPLATZ', bg: '#2a2a2a', fg: '#e8c88a', goods: 'bottles', awning: 0 },
};

/** Ladeneinrichtung im Erdgeschoss: Regale an den Wänden, Theke, Auslage hinter dem Schaufenster. R: Innenmaß. */
function ladenInnen(b, kind, R, s) {
  const S = SHOPS[kind] || SHOPS.kiosk, y = R.y;
  const zf = R.zf, zb = R.zb, dir = s;                 // zf: Innenkante Fassade (Straße), zb: Trennwand hinten
  const ryIn = s > 0 ? 0 : PI;                         // Front lokal +z zeigt in den Raum (weg von der Straße)… Regale an der Rückwand blicken zur Straße
  const toStreet = s > 0 ? PI : 0;
  const w = R.x1 - R.x0, cx = (R.x0 + R.x1) / 2;
  // Regale an der Rückwand (blicken zur Straße) – Durchgänge der Mittelwand (R.gaps) bleiben frei –, an einer Seitenwand
  const n = Math.max(1, Math.floor((w - 1.0) / 1.25));
  for (let i = 0; i < n; i++) {
    const sx = R.x0 + 0.7 + i * 1.25;
    if ((R.gaps || []).some((g) => Math.abs(g - sx) < 1.25)) continue;
    shelf(b, sx, y, zb - dir * 0.24, toStreet, { w: 1.2, goods: S.goods, h: 2.0 });
  }
  shelf(b, R.x0 + 0.22, y, (zf + zb) / 2 + dir * 0.6, Q, { w: 1.2, goods: S.goods });
  // Theke quer im Raum (Kasse)
  if (kind === 'cafe') {
    theke(b, R.x1 - 1.6, y, zb - dir * 1.2, toStreet, { len: 2.4 });
    for (let k = 0; k < 2; k++) essplatz(b, cx - 1.6 + k * 2.4, y, (zf + zb) / 2, { w: 0.8, d: 0.8, n: 2, ry: hash01(cx, k, 2) * 0.4 });
  } else {
    const tz = zb - dir * 1.5;
    b.box(R.x1 - 1.4, y, tz, 2.2, 0.95, 0.6, 'wood_planks', { tint: '#6e4e34', minimap: false });
    b.box(R.x1 - 1.4, y + 0.95, tz, 2.3, 0.05, 0.7, 'wood_dark', { tint: '#3a2a1e', ...VG });
    b.box(R.x1 - 0.8, y + 1.0, tz, 0.36, 0.22, 0.32, 'metal_painted', { tint: '#3d4247', ...VG }); // Kasse
    if (mittel(b)) for (let k = 0; k < 3; k++) b.box(R.x1 - 2.0 + k * 0.3, y + 1.0, tz + (hash01(k, cx, 1) - 0.5) * 0.3, 0.2, 0.08 + k * 0.03, 0.25, 'cardboard', { ...VG, ao: false, uv: 'fit' });
  }
  // Auslage hinter dem Schaufenster: niedriges Podest mit Waren
  b.box(cx - 1.2, y, zf + dir * 0.55, 3.0, 0.45, 0.8, 'wood_planks', { tint: '#5a4030', minimap: false });
  if (mittel(b)) for (let k = 0; k < 7; k++) {
    const c = ['#c98a4a', '#2f6f9a', '#e0a32c', '#7a2e26', '#3c6a4a', '#e8e2d6', '#5a3a5a'][Math.floor(hash01(cx + k, zf, 3) * 7)];
    b.box(cx - 2.4 + k * 0.4, y + 0.45, zf + dir * (0.4 + hash01(k, zf, 4) * 0.3), 0.26, 0.12 + hash01(cx, k, 5) * 0.3, 0.22, 'cardboard', { tint: c, ...VG, ao: false, uv: 'fit' });
  }
  deckenleuchte(b, cx, R.yC, (zf + zb) / 2, Q, 1.25, { real: hash01(cx, zf, 6) < 0.3 });
  if (hash01(cx, zb, 7) < 0.6) rubble(b, R.x0 + 1.4, (zf + zb) / 2 - dir * 0.5, 0.8, { y, mat: 'plaster_damaged' });
}

/** Wohnung (ein Geschoss, Vorder-/Hinterzimmer). R: Innenmaß mit zf/zb/zm (Mittelwand). */
function wohnungInnen(b, R, s, seed) {
  const y = R.y, dir = s, h = (k) => hash01(R.x0 + seed, R.y + k, 31 + k);
  const cx = (R.x0 + R.x1) / 2, w = R.x1 - R.x0;
  const toStreet = s > 0 ? PI : 0, fromStreet = s > 0 ? 0 : PI;
  // Vorderzimmer (Wohnzimmer): Sofa (Sessel), Tisch, Regal, Teppich, Bild, Kommode
  const fz = (R.zf + R.zm) / 2;
  teppich(b, cx - 0.5, y, fz, Math.min(3.2, w - 2.5), 2.2, 0, ['#7a3a2e', '#4a5a6a', '#6a5a3a'][Math.floor(h(1) * 3)]);
  // Sessel zwischen Fenster und Tisch (Blick in den Raum) – die Durchgänge der Mittelwand bleiben frei
  armchair(b, cx - 1.6, y, fz - dir * 1.05, fromStreet, ['#7a3a2a', '#3a4a5a', '#5a6a3a'][Math.floor(h(2) * 3)]);
  armchair(b, cx - 0.8, y, fz - dir * 1.05, fromStreet, ['#7a3a2a', '#3a4a5a', '#5a6a3a'][Math.floor(h(2) * 3)]);
  tisch(b, cx - 1.2, y, fz, { w: 1.0, d: 0.6 });
  regal(b, R.x0 + 0.2, y, fz, Q, { w: 1.4 });
  if (mittel(b)) { bild(b, R.x1 - 0.03, y + 1.5, fz, -Q, { w: 0.8, h: 0.6, tint: ['#6a7a5a', '#8a6a4a', '#4a6a8a'][Math.floor(h(3) * 3)] }); kommode(b, R.x1 - 0.3, y, fz + dir * 1.2, -Q); }
  // Hinterzimmer: Schlafzimmer oder Küche
  const bz = (R.zm + R.zb) / 2;
  if (h(4) < 0.5) {
    bett(b, cx + 0.8, y, R.zb - dir * 1.05, fromStreet === 0 ? PI : 0, { w: 1.4, blanket: ['#7a4a3a', '#3a4a6a', '#5a6a3a'][Math.floor(h(5) * 3)] });
    schrank(b, R.x0 + 0.32, y, bz, Q);
    if (mittel(b)) waschtisch(b, R.x1 - 0.25, y, bz, -Q);
  } else {
    kueche(b, cx, y, R.zb - dir * 0.32, toStreet, { len: Math.min(2.8, w - 2) });
    essplatz(b, cx, y, bz - dir * 0.3, { w: 1.2, d: 0.8, n: 4 });
  }
  deckenlampe(b, cx - 0.8, R.yC, fz, y, { real: h(6) < 0.12, shade: '#d8cfb8' });
  deckenlampe(b, cx + 0.5, R.yC, bz, y, { shade: '#c8bca4' });
  // Kriegsspuren innen: umgeworfener Stuhl, Schutt, Ruß
  if (h(7) < 0.45) rubble(b, R.x0 + 1 + h(8) * (w - 2), fz, 0.7, { y, mat: 'plaster_damaged' });
}

// ---------------------------------------------------------------------------
// Altbau
// ---------------------------------------------------------------------------
/**
 * Mehrgeschossiges Wohn- und Geschäftshaus. o: { x (Mitte), zs (Straßenfassade), s (Hälfte), w, d, floors, color, shop
 * (SHOPS-Schlüssel | null), gate: 'w'|'e'|null (Toreinfahrt), core: 'w'|'e' (Treppenhaus-Seite), roof: 'access'|'flat'|'ruin',
 * sideWin: 'w'|'e'|null (Fenster in der Giebelwand), balcony (true), seed }
 * → { x0, x1, z0, z1, roofY }
 */
export function altbau(b, o) {
  const s = o.s, w = o.w, d = o.d, floors = o.floors ?? 4, fh = o.fh ?? FH, t = 0.3;
  const x = o.x, zc = o.zs + s * d / 2;
  const x0 = x - w / 2, x1 = x + w / 2, zf = o.zs, zb = o.zs + s * d;
  const SS = streetSide(s), BS = backSide(s);
  const seed = o.seed ?? Math.round(x * 7 + o.zs * 3);
  const H = (k) => hash01(x + seed, o.zs, k);
  const color = o.color || PUTZ[Math.floor(H(1) * PUTZ.length)];
  // Treppenhaus
  const cw = 2.9, L = 5.4, ce = o.core === 'w' ? -1 : 1;
  const cx = x + ce * (w / 2 - t - cw / 2 - 0.05);
  const cz = zf + s * (t + 0.25 + L / 2);
  const roofAccess = o.roof === 'access';
  const levels = [];
  for (let k = 0; k < floors; k++) levels.push(k === 0 ? 0.12 : k * fh);
  if (roofAccess) levels.push(floors * fh);
  const core = stairCore(b, { cx, cz, w: cw, L, levels, dir: s > 0 ? 's' : 'n', mat: 'wood_planks', tint: '#8a6a4a', wallMat: 'plaster_white', wallTint: '#e2d8c4', interior: true, nosing: '#6a4a32', roof: roofAccess, railTint: '#3a2a1e' });
  const holes = [];
  for (let k = 1; k < levels.length; k++) holes.push(core.holes(k));
  // Toreinfahrt
  const gw = 3.4, gx = o.gate ? x + (o.gate === 'w' ? -1 : 1) * (w / 2 - t - gw / 2) : null;
  // Öffnungen
  const ops = [];
  const flurW = cw + 0.35;                              // Hausflur-Streifen (Treppenhaus)
  const shopX0 = o.gate === 'w' ? x0 + t + gw + 0.15 : x0 + t, shopX1 = ce > 0 ? x1 - t - flurW : x1 - t;
  const shopL = ce < 0 ? x0 + t + flurW : shopX0, shopR = o.gate === 'e' ? x1 - t - gw - 0.15 : shopX1;
  // Erdgeschoss Straße: Haustür (Treppenhaus), Tor, Ladentür + Schaufenster
  ops.push({ side: SS, at: cx - x, w: 1.3, h: 2.6, kind: 'door', leaf: 'open', floor: 0, leafTint: '#5a3a24' });
  if (gx != null) { ops.push({ side: SS, at: gx - x, w: gw, h: 3.4, kind: 'gap', frame: false, floor: 0 }); ops.push({ side: BS, at: gx - x, w: gw, h: 3.4, kind: 'gap', frame: false, floor: 0 }); }
  const shopW = shopR - shopL, shopC = (shopL + shopR) / 2;
  const intact = H(2) < 0.5;
  if (o.shop) {
    ops.push({ side: SS, at: shopC - x - shopW / 2 + 1.0, w: 1.2, h: 2.5, kind: 'door', leaf: 'open', floor: 0, leafTint: '#2f3f2f' });
    ops.push({ side: SS, at: shopC - x + 0.9, w: Math.min(4.2, shopW - 3.4), h: 2.3, sill: 0.45, kind: 'window', glass: false, frame: true, frameMat: 'wood_dark', frameTint: '#3a2a1e', floor: 0 });
  } else {
    for (let at = shopL + 1.6; at < shopR - 1.0; at += 2.8) ops.push({ side: SS, at: at - x, w: 1.2, h: 1.7, kind: 'window', floor: 0, closed: H(30 + at) < 0.3 ? '#5a4a3a' : undefined, glass: H(40 + at) < 0.5 ? false : undefined });
  }
  // Hof: Hintertür im Hausflur, Fenster
  ops.push({ side: BS, at: cx - x, w: 1.1, h: 2.2, kind: 'door', leaf: 'open', floor: 0, leafTint: '#5a3a24' });
  for (let at = shopL + 1.6; at < shopR - 1.0; at += 3.0) ops.push({ side: BS, at: at - x, w: 1.1, h: 1.5, kind: 'window', floor: 0, glass: false });
  // Obergeschosse: Fensterachsen (Straße, Hof); Balkone an der Straßenseite (Fenstertür)
  const nAx = Math.max(2, Math.floor((w - 1.6) / 2.6)), ax0 = -((nAx - 1) * 2.6) / 2;
  const balk = [], gard = [];
  for (let f = 1; f < floors; f++) {
    for (let k = 0; k < nAx; k++) {
      const at = ax0 + k * 2.6;
      const isBalk = o.balcony !== false && f <= floors - 2 && (k === 1 || k === nAx - 2) && Math.abs(x + at - cx) > 1.6 && H(50 + f * 7 + k) < 0.65;
      const broken = H(60 + f * 11 + k) < 0.55, boarded = !broken && H(70 + f + k * 3) < 0.25;
      if (isBalk) { ops.push({ side: SS, at, w: 1.1, h: 2.3, kind: 'gap', floor: f, frameMat: 'wood_dark', frameTint: '#4a3a2a' }); balk.push([x + at, f]); }
      else if (!boarded && !(o.roof === 'ruin' && f === floors - 1) && H(190 + f * 5 + k) < 0.7) gard.push([x + at, f, broken]);
      if (!isBalk) ops.push({ side: SS, at, w: 1.2, h: 1.85, sill: 0.85, kind: 'window', floor: f, glass: broken || o.roof === 'ruin' && f === floors - 1 ? false : undefined, closed: boarded ? '#5e4c3a' : undefined, frameMat: 'wood_dark', frameTint: '#e8e2d4' });
      ops.push({ side: BS, at, w: 1.1, h: 1.6, sill: 0.95, kind: 'window', floor: f, glass: H(80 + f + k) < 0.6 ? false : undefined, frameMat: 'wood_dark', frameTint: '#e8e2d4' });
    }
    if (o.sideWin) for (const at of [-d / 4, d / 4]) ops.push({ side: o.sideWin, at: s * at, w: 1.0, h: 1.5, sill: 0.95, kind: 'window', floor: f, glass: false });
  }
  if (o.sideWin) ops.push({ side: o.sideWin, at: s * d / 4, w: 1.0, h: 1.4, sill: 1.0, kind: 'window', floor: 0, glass: false });
  // Granattreffer in der Straßenfassade: Loch zwischen zwei Fensterachsen (Durchblick/-schuss, Mauerwerk sichtbar)
  const shell = floors >= 3 && H(140) < 0.6 ? { f: 1 + Math.floor(H(141) * (floors - 1)), k: Math.floor(H(142) * (nAx - 1)) } : null;
  if (shell) ops.push({ side: SS, at: ax0 + shell.k * 2.6 + 1.3, w: 1.25, h: 1.5, sill: 0.55, kind: 'gap', frame: false, floor: shell.f });
  // Brandwand-Durchbrüche (Schusslöcher zum Nachbarhaus) – nur wenn angegeben
  for (const hole of o.breaches || []) ops.push({ side: hole.side, at: hole.at, w: 1.0, h: 1.9, kind: 'gap', floor: hole.floor, frame: false });
  const ruin = o.roof === 'ruin';
  const B = building(b, {
    x, z: zc, w, d, floors, fh, mat: o.mat || 'plaster_white', tint: color, t, holes, openings: ops,
    roof: ruin ? false : { parapet: 1.0, mat: 'concrete', tint: '#8f8a80', capTint: '#c8bfae' },
    floorMat: 'wood_floor', upperFloorMat: 'wood_floor', floorTint: '#b8946c',
    frameMat: 'wood_dark', frameTint: '#e8e2d4', sillMat: 'stone_wall',
    plinth: { h: 0.8, mat: 'stone_wall', tint: '#a8a092', over: 0.04 }, band: { mat: 'plaster_white', tint: '#e8e0cc' },
    interiorFactor: 0.5,
  });
  // Fundamentplatte unter dem ganzen Grundriss (Oberkante 0,1): Türschwellen in der Wandstärke haben Boden (Navigation,
  // Laufen) – Arena ohne Gelände darunter
  b.box(x, -0.3, zc, w, 0.4, d, 'concrete', { tint: '#9a968c', minimap: false, grad: false });
  // Ladenboden: Fliesen
  if (o.shop) b.box(shopC, 0.12, (zf + (zf + zb) / 2) / 2 + s * 0.1, shopW - 0.1, 0.012, d / 2 - 0.6, 'tiles_pattern', { ...VG, ao: false });
  // Gesims über dem Erdgeschoss und unter der Traufe (stärker), Fensterverdachungen
  for (const zz of [zf - s * 0.06]) {
    b.box(x, fh - 0.1, zz, w + 0.2, 0.28, 0.24, 'plaster_white', { tint: '#e2d8c2', ...VG });
    b.box(x, floors * fh - 0.32, zz, w + 0.3, 0.32, 0.36, 'plaster_white', { tint: '#e2d8c2', ...VG });
    if (mittel(b)) for (let f = 1; f < floors; f++) for (let k = 0; k < nAx; k++) {
      const at = ax0 + k * 2.6, yy = f * fh + 0.85 + 1.85 + 0.05;
      b.box(x + at, yy, zz - s * 0.04, 1.5, 0.12, 0.2, 'plaster_white', { tint: '#e8dfca', ...VG });
      if (f === 1) b.box(x + at, yy + 0.12, zz - s * 0.06, 1.3, 0.22, 0.12, 'plaster_white', { tint: '#e8dfca', ...VG, rx: s * 0.6 });
    }
  }
  // Innenwände: Hausflur (alle Geschosse), Toreinfahrt (EG), Mittelwand der Wohnungen (OG), Ladenrückwand (EG)
  const fx = ce > 0 ? cx - cw / 2 - 0.15 : cx + cw / 2 + 0.15;
  const zm = (zf + zb) / 2, zIn0 = zf + s * t, zIn1 = zb - s * t;
  const wz0 = Math.min(zIn0, zIn1), wz1 = Math.max(zIn0, zIn1);
  const landZ = cz - s * (L / 2 - core.land / 2);        // Antrittspodest (Wohnungstür)
  for (let f = 0; f < floors; f++) {
    const yy = f === 0 ? 0.12 : f * fh, hh = fh - 0.25 - (f === 0 ? 0.12 : 0);
    // Hausflurwand mit Wohnungs-/Ladentür am Podest (EG: Tür zum Laden-Lager)
    wall(b, { x0: fx, z0: wz0, x1: fx, z1: wz1, y: yy, h: hh, t: 0.15, mat: 'plaster_white', tint: '#e6dcc6', openings: [{ at: landZ - wz0, w: 1.0, h: 2.1, kind: 'gap', frameMat: 'wood_dark', frameTint: '#6a4a32' }] }); // Wohnungstüren herausgerissen (Krieg) – spart bewegliche Türen
    if (f === 0 && gx != null) for (const sx of [-1, 1]) wall(b, { x0: gx + sx * (gw / 2 + 0.08), z0: wz0, x1: gx + sx * (gw / 2 + 0.08), z1: wz1, y: yy, h: hh, t: 0.16, mat: 'plaster_white', tint: shadeHex(color, 0.92) });
    // Mittelwand (Vorder-/Hinterzimmer) zwischen Flur und Außenwand bzw. Torwand
    const mx0 = ce > 0 ? (f === 0 && o.gate === 'w' ? gx + gw / 2 + 0.16 : x0 + t) : fx + 0.08;
    const mx1 = ce > 0 ? fx - 0.08 : (f === 0 && o.gate === 'e' ? gx - gw / 2 - 0.16 : x1 - t);
    const mw = mx1 - mx0;
    if (mw > 2) wall(b, { x0: mx0, z0: zm, x1: mx1, z1: zm, y: yy, h: hh, t: 0.14, mat: 'plaster_white', tint: f === 0 ? '#e0d8c8' : ['#d8cdb2', '#c9d2c4', '#d6c4b4', '#cfcab8'][Math.floor(H(90 + f) * 4)], openings: [{ at: mw * 0.3, w: 1.0, h: 2.1, kind: 'gap' }, ...(mw > 6 ? [{ at: mw * 0.78, w: 1.0, h: 2.1, kind: 'gap' }] : [])] });
    // Einrichtung
    const gaps = mw > 2 ? [mx0 + mw * 0.3, ...(mw > 6 ? [mx0 + mw * 0.78] : [])] : [];
    const Rin = { x0: mx0, x1: mx1, y: yy, yC: (f + 1) * fh - 0.25, zf: zIn0 + s * 0.02, zb: zm - s * 0.08, zm, gaps };
    if (f === 0) {
      if (o.shop) ladenInnen(b, o.shop, Rin, s);
      // Lager hinter dem Laden
      const lz = (zm + zIn1) / 2;
      crateStack(b, (mx0 + mx1) / 2 - 1, lz, { y: yy, ry: 0.2, pattern: [[0, 0, 0, 0.8], [0.85, 0, 0.05, 0.7]] });
      kafiglampe(b, (mx0 + mx1) / 2, (f + 1) * fh - 0.25, lz, yy);
    } else {
      const R2 = { x0: mx0, x1: mx1, y: yy, yC: (f + 1) * fh - 0.25, zf: zIn0, zb: zIn1, zm };
      if (!(ruin && f === floors - 1)) wohnungInnen(b, R2, s, seed + f * 13);
    }
    // Treppenhaus-Licht
    deckenlampe(b, cx, (f + 1) * fh - 0.25, landZ, yy, { drop: 0.3, r: 0.15, shade: '#e8e2d4', pool: 2.0 });
  }
  // Gardinen hinter den Straßenfenstern (bewohnt wirkende Fassade; zerschossene Fenster: zerrissen, schräg) – ab mittel
  if (mittel(b)) for (const [gx2, f, broken] of gard) {
    const zz = zf + s * 0.33, y0 = f * fh + 0.85, c = ['#e8e2d0', '#d8cfb8', '#c9b48e', '#e2d6c2', '#b8c4c0'][Math.floor(hash01(gx2, f, 21) * 5)];
    for (const side of [-1, 1]) b.box(gx2 + side * 0.45, y0 + 0.05, zz, broken ? 0.28 : 0.36, 1.8, 0.02, 'tarp', { tint: c, ...VG, ao: false, rz: broken ? side * 0.12 : 0, bullet: false });
    b.box(gx2, y0 + 1.9, zz, 1.5, 0.04, 0.04, 'metal_painted', { tint: '#5a5048', ...VG, ao: false });
  }
  // Balkone (Platte + Gitter) vor den Fenstertüren
  for (const [bx, f] of balk) {
    const by = f * fh, bz = zf - s * 0.65;
    b.box(bx, by - 0.15, bz, 1.9, 0.16, 1.1, 'concrete', { tint: '#b8b0a2', minimap: false, grad: false });
    for (const [ax, az, cx2, cz2] of [[bx - 0.92, bz - s * 0.52, bx + 0.92, bz - s * 0.52], [bx - 0.92, zf, bx - 0.92, bz - s * 0.52], [bx + 0.92, bz - s * 0.52, bx + 0.92, zf]]) railing(b, ax, az, cx2, cz2, by, { h: 1.0, tint: '#2c2f33', posts: 4 });
    b.navPoint(bx, by + 0.2, bz);
  }
  // Dach: Ausstieg (Treppenkopf), Schornsteine, Antennen; Ruine: verkohlte Balken, Schutt
  const roofY = floors * fh;
  if (roofAccess) {
    const r = core.rect, hx0 = r.x0 - 0.2, hx1 = r.x1 + 0.2, landZ2 = landZ;
    const lz0 = Math.min(r.z0, r.z1, landZ2 - core.land / 2) - 0.2, lz1 = Math.max(r.z0, r.z1, landZ2 + core.land / 2) + 0.2;
    const hh = 2.5;
    b.interior(hx0, lz0, hx1, lz1, roofY, roofY + hh, 0.6);
    const dSide = ce > 0 ? 'w' : 'e';
    for (const [sid, ax, az, ex, ez] of [['n', hx0, lz0 + 0.1, hx1, lz0 + 0.1], ['s', hx1, lz1 - 0.1, hx0, lz1 - 0.1], ['e', hx1 - 0.1, lz0, hx1 - 0.1, lz1], ['w', hx0 + 0.1, lz1, hx0 + 0.1, lz0]]) {
      const len = Math.hypot(ex - ax, ez - az);
      const door = sid === dSide ? [{ at: sid === 'e' ? landZ2 - lz0 : lz1 - landZ2, w: 1.0, h: 2.1, kind: 'gap', frameMat: 'metal_painted', frameTint: '#4a4a44' }] : [];
      wall(b, { x0: ax, z0: az, x1: ex, z1: ez, y: roofY, h: hh, t: 0.2, mat: 'plaster_white', tint: shadeHex(color, 0.9), openings: door, minimap: false });
      void len;
    }
    b.box((hx0 + hx1) / 2, roofY + hh, (lz0 + lz1) / 2, hx1 - hx0 + 0.3, 0.18, lz1 - lz0 + 0.3, 'concrete', { tint: '#8f8a80', minimap: 'roof', grad: false });
    b.noNav(hx0 - 0.3, lz0 - 0.3, hx1 + 0.3, lz1 + 0.3, roofY + hh - 0.3, roofY + 20);
    // Dach begehbar: Teerpappe, Lüfter, Schornsteine
    b.decal(x, roofY + 0.02, zc, w - 1, d - 1, 'stain', { opacity: 0.4 });
  } else if (!ruin) {
    b.noNav(x0 - 0.5, Math.min(zf, zb) - 0.5, x1 + 0.5, Math.max(zf, zb) + 0.5, roofY - 0.3, roofY + 20);
  }
  for (const k of [0, 1]) {
    const sx = x + (k ? 0.3 : -0.3) * w, sz = zc + s * (k ? 0.2 : -0.15) * d;
    if (ruin) continue;
    b.box(sx, roofY, sz, 0.9, 1.6, 0.6, 'brick_dark', { minimap: 'cover' });
    b.box(sx, roofY + 1.6, sz, 1.0, 0.1, 0.7, 'concrete', { tint: '#8f8a80', ...VG });
  }
  if (!ruin && H(5) < 0.7) { b.cyl(x - w * 0.15, roofY, zc, 0.03, 3.2, 'metal_galvanized', { ...KEIN, seg: 6 }); b.box(x - w * 0.15, roofY + 2.6, zc, 1.6, 0.04, 0.04, 'metal_galvanized', { ...VG }); }
  if (ruin) {
    // ausgebrannter Dachstock: verkohlte Balken schräg über dem obersten Geschoss, Schutt, Ruß
    const yT = (floors - 1) * fh;
    for (let k = 0; k < 5; k++) {
      const bx = x0 + 1.5 + k * (w - 3) / 4;
      b.box(bx, yT + fh - 0.4, zc + s * (hash01(k, x, 3) - 0.5) * 2, 0.22, 0.22, d - 1.2, 'wood_dark', { tint: '#1e1a16', ...VG, rx: (hash01(x, k, 4) - 0.5) * 0.6, rz: (hash01(k, k, 5) - 0.5) * 0.4 });
    }
    rubble(b, x - w * 0.2, zc, 1.6, { y: yT, mat: 'plaster_damaged', brick: true });
    rubble(b, x + w * 0.25, zc + s * 1.5, 1.2, { y: yT, mat: 'plaster_damaged', brick: true });
    for (let k = 0; k < 3; k++) soot(b, x + (k - 1) * w * 0.3, yT + 2.2, zf - s * 0.02, [0, 0, -s], 2.2);
  }
  // Ruß über einzelnen Fenstern, Einschusslöcher (Decals), Schutt vor dem Haus
  if (mittel(b)) for (let f = 1; f < floors; f++) if (H(100 + f) < 0.35) soot(b, x + ax0 + Math.floor(H(110 + f) * nAx) * 2.6, f * fh + 2.6, zf - s * 0.02, [0, 0, -s], 1.4);
  if (H(120) < 0.6) rubble(b, x + (H(121) - 0.5) * (w - 4), zf - s * 1.3, 0.9 + H(122) * 0.8, { mat: 'plaster_damaged', brick: H(123) < 0.5 });
  // Abplatzungen (Ziegel sichtbar) und Brandspuren an der Straßenfassade; Schutt unter dem Granatloch
  if (mittel(b)) {
    const nrm = [0, 0, -s];
    // wenige, kleine Abplatzungen – große Ziegelflecken wirkten wie aufgeklebt
    for (let k = 0; k < 3; k++) chip(b, x + (H(150 + k) - 0.5) * (w - 1.2), 1.2 + H(160 + k) * (floors * fh - 2.2), zf - s * 0.015, nrm, 0.35 + H(170 + k) * 0.35, H(180 + k) < 0.4 ? 'chip_brick' : H(180 + k) < 0.75 ? 'chip_stone' : 'plaster_patch');
  }
  if (shell) {
    const hx = x + ax0 + shell.k * 2.6 + 1.3, hy = shell.f * fh + 0.55 + 0.75;
    chip(b, hx, hy, zf - s * 0.016, [0, 0, -s], 1.9, 'chip_brick');
    soot(b, hx, hy + 1.1, zf - s * 0.017, [0, 0, -s], 1.8);
    rubble(b, hx, zf - s * 1.4, 1.1, { mat: 'plaster_damaged', brick: true });
  }
  // Ladenschild + Markise
  if (o.shop) {
    const S = SHOPS[o.shop], key = 'laden_' + o.shop;
    b.defineSign(key, { style: 'plate', text: S.name, bg: S.bg, fg: S.fg });
    b.sign(shopC, 2.95, zf - s * 0.18, Math.min(shopW - 0.4, 6.0), 0.55, key, { ry: s > 0 ? PI : 0 });
    if (S.awning >= 0 && H(3) < 0.75) awning(b, shopC + 0.9, 2.75, zf - s * 0.02, Math.min(4.6, shopW - 2.6), 1.3, { ry: s > 0 ? PI : 0, design: S.awning });
    // Schaufenster: intakt (Scheibe, Kugeln gehen durch) oder zerschlagen (Splitter am Boden)
    const ww = Math.min(4.2, shopW - 3.4), wx = shopC + 0.9;
    if (intact) b.box(wx, 0.5, zf + s * 0.02, ww - 0.18, 2.2, 0.03, 'glass', { minimap: false, grad: false, interior: false });
    else for (let k = 0; k < 6; k++) b.decal(wx + (hash01(k, x, 9) - 0.5) * ww, 0.02, zf - s * (0.4 + hash01(x, k, 8) * 1.2), 0.5, 0.5, 'paper', { tint: '#cfe0e4', opacity: 0.6 });
  }
  // Hausnummer
  b.defineSign('nr_' + seed, { style: 'number', text: String(o.nr ?? (Math.abs(Math.round(x / 4)) + 1)), bg: '#1f3a6a', fg: '#ffffff' });
  b.sign(cx + 0.95, 2.4, zf - s * 0.02, 0.32, 0.26, 'nr_' + seed, { ry: s > 0 ? PI : 0, back: false, depth: 0.01 });
  return { x0, x1, z0: Math.min(zf, zb), z1: Math.max(zf, zb), roofY, B };
}

function shadeHex(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

// ---------------------------------------------------------------------------
// Kaufhaus am Platz (2 Geschosse + Dachterrasse)
// ---------------------------------------------------------------------------
export function kaufhaus(b, x, zs, s, w = 28, d = 12) {
  const fh = 4.2, zc = zs + s * d / 2, SS = streetSide(s), BS = backSide(s);
  const cw = 3.0, L = 6.6, cx = x + w / 2 - 0.3 - cw / 2 - 0.1, cz = zb(zs, s, d) - s * (0.3 + L / 2 + 0.2);
  const core = stairCore(b, { cx, cz, w: cw, L, levels: [0.12, fh, 2 * fh], dir: s > 0 ? 'n' : 's', mat: 'stone_wall', tint: '#cfc6b6', wallMat: 'plaster_white', wallTint: '#e8e2d4', interior: true, nosing: true, roof: true });
  const ops = [];
  for (const at of [-11, -6, 0]) ops.push({ side: SS, at, w: 3.8, h: 3.0, sill: 0.4, kind: 'window', glass: false, frameMat: 'metal_painted', frameTint: '#2c2f33', floor: 0 });
  ops.push({ side: SS, at: 5.5, w: 3.0, h: 2.8, kind: 'gap', frameMat: 'metal_painted', frameTint: '#2c2f33', floor: 0 });
  for (const at of [-11, -6.5, -2, 2.5, 7]) ops.push({ side: SS, at, w: 3.2, h: 2.4, sill: 0.9, kind: 'window', glass: hash01(x, at, 1) < 0.5 ? false : undefined, frameMat: 'metal_painted', frameTint: '#2c2f33', floor: 1 });
  ops.push({ side: BS, at: -8, w: 2.6, h: 2.8, kind: 'gap', floor: 0 });
  ops.push({ side: BS, at: 4, w: 1.2, h: 1.4, kind: 'window', floor: 1, glass: false });
  ops.push({ side: 'w', at: 0, w: 1.2, h: 2.2, kind: 'door', leaf: 'open', floor: 0 });
  b.box(x, -0.3, zc, w, 0.4, d, 'concrete', { tint: '#9a968c', minimap: false, grad: false }); // Fundament/Schwellen
  building(b, {
    x, z: zc, w, d, floors: 2, fh, mat: 'stone_wall', tint: '#cfc6b4', holes: [core.holes(1), core.holes(2)], openings: ops,
    roof: { parapet: 1.1, mat: 'concrete', tint: '#9a958a', capTint: '#d6ccb8' }, floorMat: 'tiles_pattern', upperFloorMat: 'linoleum', floorTint: '#c8c0b0',
    frameMat: 'metal_painted', frameTint: '#2c2f33', band: { mat: 'stone_wall', tint: '#d8cfbe' }, plinth: { h: 0.4, mat: 'stone_wall', tint: '#9a9286' }, interiorFactor: 0.55,
  });
  // Schaufenster: zwei intakt (Scheibe), eins zerschlagen; Auslagen
  for (const [at, ok] of [[-11, true], [-6, false], [0, true]]) {
    if (ok) b.box(x + at, 0.45, zs + s * 0.02, 3.6, 2.9, 0.03, 'glass', { minimap: false, grad: false, interior: false });
    b.box(x + at, 0.12, zs + s * 0.7, 3.4, 0.5, 0.9, 'wood_dark', { tint: '#4a3a2a', minimap: false });
    // Schaufensterpuppen (Kleiderständer-Figuren)
    for (const k of [-1, 1]) {
      const px = x + at + k * 0.9, pz = zs + s * 0.7;
      b.cyl(px, 0.62, pz, 0.12, 0.9, 'white', { tint: '#e8e2d6', ...KEIN, seg: 8, r1: 0.16 });
      b.cyl(px, 1.52, pz, 0.16, 0.45, 'tarp', { tint: ['#7a2e26', '#2f4f6e', '#3c6a4a'][Math.floor(hash01(px, pz, 2) * 3)], ...KEIN, seg: 8, r1: 0.2 });
      b.cyl(px, 1.97, pz, 0.09, 0.2, 'white', { tint: '#e8e2d6', ...KEIN, seg: 8 });
    }
  }
  b.defineSign('kaufhaus', { style: 'logo', text: 'KAUFHAUS STERNBERG', sub: 'seit 1908', bg: '#1f2a33', fg: '#e8d8b0', accent: '#c9a227' });
  b.sign(x - 3, fh + 2.85, zs - s * 0.05, 9, 1.2, 'kaufhaus', { ry: s > 0 ? PI : 0 });
  // Verkaufsfläche EG: Regalreihen, Kassen; OG: Kleiderständer, Büro
  for (let k = 0; k < 3; k++) for (const lz of [4.5, 7.5]) shelf(b, x - 10 + k * 5, 0.12, zs + s * lz, s > 0 ? 0 : PI, { w: 2.4, goods: ['cloth', 'boxes', 'books'][k] });
  for (const at of [-8, 1]) { b.box(x + at, 0.12, zs + s * 2.6, 2.4, 1.0, 0.7, 'wood_planks', { tint: '#6e4e34', minimap: 'cover' }); b.box(x + at + 0.6, 1.12, zs + s * 2.6, 0.4, 0.25, 0.35, 'metal_painted', { tint: '#3d4247', ...VG }); }
  const y2 = fh + 0.02;
  for (let k = 0; k < 4; k++) {
    const rx = x - 11 + k * 4.2, rz = zs + s * 4;
    b.box(rx, y2 + 1.5, rz, 2.0, 0.04, 0.04, 'metal_galvanized', { ...VG });
    for (const sx of [-1, 1]) b.box(rx + sx * 1.0, y2, rz, 0.05, 1.55, 0.5, 'metal_galvanized', { ...KEIN });
    for (let j = 0; j < 7; j++) b.box(rx - 0.85 + j * 0.28, y2 + 0.6, rz, 0.05, 0.85, 0.42, 'tarp', { tint: ['#2f4f6e', '#7a2e26', '#c8b48e', '#3c6a4a', '#1c1c1c'][Math.floor(hash01(rx, j, 3) * 5)], ...VG });
    b.box(rx, y2, rz, 2.0, 1.55, 0.5, 'black', { visual: false, minimap: 'cover' });
  }
  schreibtisch(b, x - 4, y2, zb(zs, s, d) - s * 1.4, s > 0 ? PI : 0); bueroStuhl(b, x - 4, y2, zb(zs, s, d) - s * 2.2, s > 0 ? 0 : PI);
  aktenschrank(b, x - 7, y2, zb(zs, s, d) - s * 0.6, s > 0 ? PI : 0);
  for (let k = 0; k < 4; k++) { deckenleuchte(b, x - 10 + k * 6, fh - 0.25, zc, 0, 1.25, { real: k === 1 }); deckenleuchte(b, x - 10 + k * 6, 2 * fh - 0.25, zc, 0, 1.25); }
  // Dachterrasse: Ausstieg, Sandsack-Stellung an der Brüstung zum Platz, Sitzbänke
  const r = core.rect, roofY = 2 * fh;
  const landZ = cz - (s > 0 ? -1 : 1) * (L / 2 - core.land / 2);
  const hx0 = r.x0 - 0.2, hx1 = r.x1 + 0.2;
  const lz0 = Math.min(r.z0, r.z1, landZ - core.land / 2) - 0.2, lz1 = Math.max(r.z0, r.z1, landZ + core.land / 2) + 0.2;
  b.interior(hx0, lz0, hx1, lz1, roofY, roofY + 2.5, 0.6);
  for (const [sid, ax, az, ex, ez] of [['n', hx0, lz0 + 0.1, hx1, lz0 + 0.1], ['s', hx1, lz1 - 0.1, hx0, lz1 - 0.1], ['e', hx1 - 0.1, lz0, hx1 - 0.1, lz1], ['w', hx0 + 0.1, lz1, hx0 + 0.1, lz0]]) {
    const door = sid === 'w' ? [{ at: lz1 - landZ, w: 1.0, h: 2.1, kind: 'gap', frameMat: 'metal_painted', frameTint: '#4a4a44' }] : [];
    void ax;
    wall(b, { x0: ax, z0: az, x1: ex, z1: ez, y: roofY, h: 2.5, t: 0.2, mat: 'stone_wall', tint: '#c8bfae', openings: door, minimap: false });
  }
  b.box((hx0 + hx1) / 2, roofY + 2.5, (lz0 + lz1) / 2, hx1 - hx0 + 0.3, 0.18, lz1 - lz0 + 0.3, 'concrete', { tint: '#8f8a80', minimap: 'roof', grad: false });
  b.noNav(hx0 - 0.3, lz0 - 0.3, hx1 + 0.3, lz1 + 0.3, roofY + 2.2, roofY + 20);
  sandbags(b, x - 9, zs + s * 1.3, x - 4, zs + s * 1.3, { rows: 3, y: roofY });
  sandbags(b, x + 1, zs + s * 1.3, x + 5, zs + s * 1.3, { rows: 3, y: roofY });
  for (const at of [-12, 0]) b.box(x + at, roofY, zc, 1.2, 0.9, 1.2, 'metal_galvanized', { minimap: 'cover' });
  void core;
}
const zb = (zs, s, d) => zs + s * d;

// ---------------------------------------------------------------------------
// Hinterhof-Ausstattung
// ---------------------------------------------------------------------------
export function hofAusstattung(b, x0, z0, x1, z1, s) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const outer = Math.abs(x0) > Math.abs(x1) ? -1 : 1;       // Kartenrand-Seite des Hofs
  const xo = outer < 0 ? x0 : x1, xi = outer < 0 ? x1 : x0;  // äußeres / inneres Ende
  b.groundTiled(x0, Math.min(z0, z1), x1, Math.max(z0, z1), 'cobble', { cell: 1, tint: '#b8b0a2' });
  tonnen(b, cx - outer * 6, z0 + s * 1.6, s > 0 ? 0 : PI, 3);
  // Teppichstange, Fahrräder, Schuppen, Wäscheleine, Baum
  const tx = cx + outer * 4;
  for (const sx of [-1, 1]) b.cyl(tx + sx * 1.3, 0, cz - s * 2, 0.05, 1.8, 'metal_painted', { tint: '#3d4247', seg: 6, minimap: false });
  b.cyl(tx, 1.75, cz - s * 2, 0.04, 2.6, 'metal_painted', { tint: '#3d4247', ...KEIN, axis: 'x', seg: 6 });
  if (mittel(b)) b.box(tx, 0.9, cz - s * 2, 1.6, 0.85, 0.02, 'tarp', { tint: '#7a3a2e', ...VG, rx: 0.02 });
  for (let k = 0; k < 3; k++) {
    const bx = xi + outer * (3 + k * 0.7), bz = z0 + s * 2.5;
    b.cyl(bx, 0.35, bz - 0.5, 0.33, 0.04, 'rubber', { ...KEIN, axis: 'x', seg: 12 });
    b.cyl(bx, 0.35, bz + 0.5, 0.33, 0.04, 'rubber', { ...KEIN, axis: 'x', seg: 12 });
    b.box(bx, 0.35, bz, 0.04, 0.5, 1.0, 'metal_painted', { tint: ['#2f5f94', '#c8402f', '#3d4247'][k], ...VG, rx: 0.4 });
  }
  // Holzschuppen an der Hinterhaus-Fassade zwischen Haustür und Toreinfahrt (Tor zur Hofmitte)
  const sx = xo - outer * 10, sz = z1 - s * 3.5;
  b.box(sx, -0.3, sz, 4, 0.4, 5, 'concrete', { tint: '#9a968c', minimap: false, grad: false });
  building(b, { x: sx, z: sz, w: 4, d: 5, floors: 1, fh: 2.6, mat: 'wood_planks', tint: '#8a6a4a', openings: [{ side: outer < 0 ? 'e' : 'w', at: 0, w: 2.2, h: 2.1, kind: 'gap', frame: false }], roof: { edge: false, mat: 'wood_planks', tint: '#5a4a3a' }, floorMat: 'wood_planks', pipes: false });
  b.noNav(sx - 2.3, sz - 2.8, sx + 2.3, sz + 2.8, 2.3, 30);
  palletStack(b, sx + outer * 0.8, sz - 1, { n: 4, y: 0.12 });
  tires(b, sx + outer * 0.8, sz + 1.2, { n: 3, y: 0.12 });
  // Linde mit Bank
  tree(b, cx, cz + s * 1, { kind: 'tree', h: 4.2, s: 1.35 });
  bench(b, cx, cz + s * 2.6, { ry: s > 0 ? 0 : PI }); // platz (19.11.): Lehne zum Stamm, Blick in den Hof (vorher Blick 2 m vor den Stamm)
  // Schutt, Kisten (Deckung), Müllcontainer
  rubble(b, cx + outer * 9, z0 + s * 5, 1.3, { mat: 'plaster_damaged', brick: true });
  crateStack(b, cx - outer * 7, cz + s * 3, { ry: 0.3 });
  dumpster(b, xi + outer * 1.2, cz - s * 2, { ry: Q });
}

// ---------------------------------------------------------------------------
// Straße: Gleise, Fahrleitung, Straßenbahn, Haltestelle, Litfaßsäule, Telefonzelle
// ---------------------------------------------------------------------------
export function gleise(b, x0, x1, zs) {
  for (const z of zs) for (const r of [-0.7175, 0.7175]) {
    b.box((x0 + x1) / 2, 0, z + r, x1 - x0, 0.035, 0.07, 'metal_galvanized', { tint: '#8d8f90', ...VG, ao: false });
    b.decal((x0 + x1) / 2, 0.012, z + r - 0.05, x1 - x0, 0.2, 'line', { ry: 0, tint: '#2a2a28', kind: 'paint', opacity: 0.5 });
  }
}

export function fahrleitung(b, x0, x1, zs, zPole) {
  for (let x = x0; x <= x1 + 0.1; x += 24) {
    for (const s of [-1, 1]) {
      b.cyl(x, 0, s * zPole, 0.12, 7.2, 'metal_painted', { tint: '#3e4a44', seg: 8, minimap: 'pillar', r1: 0.09 });
      b.cyl(x, 0, s * zPole, 0.2, 0.5, 'concrete', { tint: '#a8a49a', seg: 8, ...KEIN });
    }
    b.cyl(x, 6.6, 0, 0.015, zPole * 2, 'metal_galvanized', { ...KEIN, axis: 'z', seg: 4, bullet: false, cast: false });
  }
  for (const z of zs) b.cyl((x0 + x1) / 2, 5.9, z, 0.012, x1 - x0, 'metal_galvanized', { ...KEIN, axis: 'x', seg: 4, bullet: false, cast: false });
}

/** Ausgebrannter Straßenbahnwagen (begehbar über die Türen), Achse x, Mitte (x, z), Front +x. */
export function strassenbahn(b, x, z, o = {}) {
  const L = 14, W = 2.4, H = 3.2, y0 = 0.38, ry = o.ry || 0, f = frame(b, x, 0, z, ry), burnt = o.burnt !== false;
  const body = burnt ? '#4a4038' : '#d8b23a', roofT = burnt ? '#2e2a26' : '#e8e2d4';
  // Fahrgestell + Boden
  f.box(0, 0.12, 0, L - 1, 0.26, W - 0.3, 'metal_painted', { tint: '#1e1e1e', ...KEIN });
  f.box(0, y0 - 0.05, 0, L, 0.1, W, 'metal_painted', { tint: '#3a3632', minimap: false, grad: false });
  for (const sx of [-1, 1]) for (const sz of [-0.55, 0.55]) f.cyl(sx * (L / 2 - 2.2), 0.38, sz, 0.36, 0.1, 'metal_rust', { axis: 'x', ...VG, seg: 10, ry: Q });
  // Seitenwände mit Fensterband (ohne Glas) und Türen (2 je Seite, offen)
  const doors = [-3.5, 3.5];
  for (const side of [-1, 1]) {
    const zz = side * (W / 2 - 0.04);
    const parts = []; let a = -L / 2;
    for (const dx of doors) { parts.push([a, dx - 0.7]); a = dx + 0.7; }
    parts.push([a, L / 2]);
    for (const [p0, p1] of parts) {
      const len = p1 - p0, mx = (p0 + p1) / 2;
      f.box(mx, y0, zz, len, 1.0, 0.08, 'metal_painted', { tint: body, minimap: false });
      f.box(mx, y0 + 2.1, zz, len, H - 2.1 - y0, 0.08, 'metal_painted', { tint: body, minimap: false, grad: false });
      for (let k = 0; k <= Math.floor(len / 1.4); k++) f.box(p0 + Math.min(len - 0.05, k * 1.4) + 0.03, y0 + 1.0, zz, 0.08, 1.1, 0.08, 'metal_painted', { tint: body, minimap: false, grad: false });
    }
    for (const dx of doors) f.box(dx, H - 0.3, zz, 1.4, 0.3, 0.08, 'metal_painted', { tint: body, ...VG });
  }
  // Stirnseiten
  for (const e of [-1, 1]) {
    f.box(e * (L / 2 - 0.04), y0, 0, 0.08, 1.0, W, 'metal_painted', { tint: body, minimap: false });
    f.box(e * (L / 2 - 0.04), y0 + 2.1, 0, 0.08, H - 2.1 - y0, W, 'metal_painted', { tint: body, minimap: false, grad: false });
    for (const sz of [-1, 1]) f.box(e * (L / 2 - 0.04), y0 + 1.0, sz * (W / 2 - 0.15), 0.08, 1.1, 0.3, 'metal_painted', { tint: body, minimap: false, grad: false });
  }
  // Dach, Stromabnehmer, Sitze (verbrannt)
  f.box(0, H, 0, L + 0.1, 0.12, W + 0.1, 'metal_painted', { tint: roofT, minimap: 'vehicle', grad: false });
  f.box(1.5, H + 0.12, 0, 1.2, 0.25, 0.8, 'metal_painted', { tint: '#1e1e1e', ...VG });
  f.box(1.5, H + 0.4, 0, 0.06, 0.06, 1.6, 'metal_galvanized', { ...VG, rz: 0.6 });
  for (let k = 0; k < 6; k++) for (const sz of [-1, 1]) {
    const sx = -L / 2 + 1.5 + k * 2.1;
    if (doors.some((d) => Math.abs(d - sx) < 1.0)) continue;
    f.box(sx, y0, sz * 0.75, 0.5, 0.45, 0.8, 'metal_painted', { tint: burnt ? '#2a2622' : '#7a2e26', ...KEIN });
    f.box(sx - 0.22, y0 + 0.45, sz * 0.75, 0.08, 0.5, 0.8, 'metal_painted', { tint: burnt ? '#2a2622' : '#7a2e26', ...VG });
  }
  // Nutzer 14.11.: Detail ab medium – gerundete Dachkanten, Drehgestelle mit Rahmen, Federn und Radsatzlagern,
  // Scherenstromabnehmer, Dachaufbauten mit Gittern, Fensterdichtungen, Stirnfront mit Scheinwerfern, Kupplung, Puffer
  if (b.quality && b.quality !== 'low') {
    const dk = burnt ? '#24211e' : '#2a2c2e', st = burnt ? '#3d342c' : '#5a5e62';
    for (const sz of [-1, 1]) {
      f.cyl(0, H - 0.04, sz * (W / 2 - 0.1), 0.15, L - 0.1, 'metal_painted', { ...KEIN, axis: 'x', tint: roofT, seg: 12 });
      f.box(0, y0 + 0.98, sz * (W / 2 + 0.005), L - 0.1, 0.04, 0.03, 'rubber', { ...VG });             // Dichtung unten
      f.box(0, y0 + 2.08, sz * (W / 2 + 0.005), L - 0.1, 0.04, 0.03, 'rubber', { ...VG });             // Dichtung oben
      f.box(0, y0 + 0.5, sz * (W / 2 + 0.01), L - 0.4, 0.06, 0.02, 'metal_galvanized', { ...VG, tint: burnt ? '#4a4038' : '#c8ccd0' }); // Zierleiste
    }
    for (const bx of [-1, 1]) {
      const cx = bx * (L / 2 - 2.2);
      for (const sz of [-1, 1]) {
        f.box(cx, 0.24, sz * 0.7, 2.2, 0.22, 0.12, 'metal_painted', { ...KEIN, tint: dk });            // Drehgestellrahmen
        for (const dx of [-0.55, 0.55]) {
          f.box(cx + dx, 0.24, sz * 0.72, 0.26, 0.22, 0.18, 'metal_painted', { ...KEIN, tint: st });  // Radsatzlager
          f.cyl(cx + dx, 0.46, sz * 0.7, 0.07, 0.16, 'metal_galvanized', { ...KEIN, tint: st, seg: 8 }); // Feder
        }
      }
      f.cyl(cx, 0.38, 0, 0.06, 1.3, 'metal_painted', { ...KEIN, axis: 'z', tint: dk, seg: 8 });
    }
    for (const e of [-1, 1]) {
      const ex = e * (L / 2 + 0.02);
      for (const sz of [-1, 1]) {
        f.cyl(ex, y0 + 0.62, sz * 0.78, 0.11, 0.08, 'metal_painted', { ...KEIN, axis: 'x', tint: dk, seg: 12 });
        f.cyl(ex + e * 0.03, y0 + 0.62, sz * 0.78, 0.085, 0.02, 'glass', { ...VG, axis: 'x', seg: 12 });
        f.box(ex, y0 + 0.86, sz * 0.82, 0.04, 0.06, 0.18, 'polymer', { ...VG, tint: burnt ? '#2a2420' : '#d8861a' });
      }
      f.box(ex + e * 0.06, y0 + 0.08, 0, 0.14, 0.24, W - 0.3, 'metal_painted', { ...KEIN, tint: dk });     // Schürze/Puffer
      f.box(ex + e * 0.25, y0 + 0.12, 0, 0.4, 0.12, 0.16, 'metal_painted', { ...KEIN, tint: st });         // Kupplung
      f.box(ex, y0 + 1.0, 0, 0.05, 0.05, W - 0.1, 'rubber', { ...VG });                                       // Frontscheiben-Dichtung
      f.box(ex, y0 + 2.08, 0, 0.05, 0.05, W - 0.1, 'rubber', { ...VG });
      f.box(ex, y0 + 1.55, 0, 0.05, 1.05, 0.06, 'metal_painted', { ...VG, tint: body });                     // Mittelsteg
    }
    // Dachaufbauten (Widerstände/Klima mit Gittern) + Scherenstromabnehmer
    for (const [dx, w] of [[-3.2, 1.6], [4.4, 1.2]]) {
      f.box(dx, H + 0.12, 0, w, 0.32, 1.2, 'metal_painted', { ...VG, tint: burnt ? '#2e2a26' : '#b8bcc0' });
      for (let k = 0; k < 6; k++) f.box(dx - w / 2 + 0.12 + k * (w - 0.24) / 5, H + 0.45, 0, 0.03, 0.02, 1.1, 'metal_painted', { ...VG, tint: '#1e1e1e' });
    }
    for (const e of [-1, 1]) {
      f.box(1.5 + e * 0.32, H + 0.62, 0, 0.7, 0.04, 0.04, 'metal_galvanized', { ...VG, rz: e * 0.85 });
      f.box(1.5 + e * 0.3, H + 1.12, 0, 0.7, 0.04, 0.04, 'metal_galvanized', { ...VG, rz: -e * 0.85 });
      for (const sz of [-0.3, 0.3]) f.box(1.5 + e * 0.38, H + 0.18, sz, 0.08, 0.12, 0.08, 'polymer', { ...VG, tint: '#7a5a3a' }); // Isolatoren
    }
    f.box(1.5, H + 1.4, 0, 0.08, 0.05, 1.7, 'metal_galvanized', { ...VG });
  }
  // Zielschild
  b.defineSign('tram', { style: 'plate', text: '7  LINDENPLATZ', bg: '#1c1c1c', fg: '#f2c230' });
  const [sx, sz] = f.P(L / 2 + 0.01, 0);
  b.sign(sx, y0 + 2.2, sz, 1.8, 0.35, 'tram', { ry: ry + Q, back: false, depth: 0 });
  if (burnt) { soot(b, sx, 2.0, sz, [Math.cos(ry), 0, -Math.sin(ry)], 2.0); b.decal(x, 0.02, z, L + 3, W + 3, 'soot', { ry, opacity: 0.6 }); }
}

/** Haltestelle (Wartehäuschen mit Bank, Fahrplan). (x, z) Mitte, Rückwand Richtung s (weg von der Straße). */
export function haltestelle(b, x, z, s) {
  const f = frame(b, x, 0, z, s > 0 ? PI : 0);
  f.box(0, 0, -0.9, 3.6, 2.4, 0.05, 'glass', { minimap: 'wall', grad: false });
  for (const sx of [-1.8, 1.8]) f.box(sx, 0, -0.45, 0.06, 2.4, 0.95, 'glass', { minimap: false, grad: false });
  for (const sx of [-1.8, 1.8]) for (const sz of [-0.9, 0]) f.box(sx, 0, sz, 0.08, 2.5, 0.08, 'metal_painted', { tint: '#2c2f33', ...KEIN });
  f.box(0, 2.5, -0.4, 3.8, 0.1, 1.3, 'metal_painted', { tint: '#2c2f33', minimap: false, grad: false });
  f.box(0, 0.45, -0.7, 2.6, 0.05, 0.4, 'wood_planks', { tint: '#8a6a4a', ...KEIN });
  b.defineSign('halt_h', { style: 'number', text: 'H', sub: 'LINDENPLATZ', bg: '#f2c230', fg: '#1f6f46' });
  const [px, pz] = f.P(2.4, 0);
  b.cyl(px, 0, pz, 0.05, 2.8, 'metal_galvanized', { seg: 6, minimap: false });
  b.sign(px, 2.5, pz, 0.6, 0.6, 'halt_h', { ry: s > 0 ? PI : 0 });
}

export function litfass(b, x, z) {
  b.cyl(x, 0, z, 0.6, 2.8, 'concrete', { tint: '#d8d0bc', seg: 16, minimap: 'pillar' });
  b.cyl(x, 2.8, z, 0.7, 0.18, 'metal_painted', { tint: '#2f4a3a', seg: 16, ...KEIN });
  b.cyl(x, 2.98, z, 0.25, 0.3, 'metal_painted', { tint: '#2f4a3a', seg: 10, ...KEIN, r1: 0.05 });
  const posters = ['plakat_1', 'plakat_2', 'plakat_3'];
  b.defineSign('plakat_1', { style: 'plate', text: 'KONZERT', sub: 'Stadthalle · Sonntag 19 Uhr', bg: '#c8402f', fg: '#ffffff' });
  b.defineSign('plakat_2', { style: 'plate', text: 'VERDUNKELUNG!', sub: 'Feind hört mit', bg: '#1c1c1c', fg: '#f2c230' });
  b.defineSign('plakat_3', { style: 'plate', text: 'LINDENFEST', sub: 'abgesagt', bg: '#2f5f94', fg: '#ffffff' });
  posters.forEach((k, i) => { const a = (i / 3) * PI * 2 + 0.3; b.sign(x + Math.sin(a) * 0.62, 1.6, z + Math.cos(a) * 0.62, 0.8, 1.1, k, { ry: a, back: false, depth: 0 }); });
}

export function telefonzelle(b, x, z, ry = 0) {
  const f = frame(b, x, 0, z, ry);
  f.box(0, 0, 0, 1.0, 0.1, 1.0, 'concrete', { tint: '#b8b0a2', minimap: false });
  for (const [sx, sz, w, d] of [[-0.47, 0, 0.06, 1.0], [0.47, 0, 0.06, 1.0], [0, -0.47, 1.0, 0.06]]) f.box(sx, 0.1, sz, w, 2.2, d, 'metal_painted', { tint: '#e8c22c', minimap: 'cover' });
  f.box(0, 2.3, 0, 1.05, 0.2, 1.05, 'metal_painted', { tint: '#e8c22c', ...KEIN });
  f.box(0, 1.1, -0.42, 0.3, 0.45, 0.1, 'metal_painted', { tint: '#2b2d30', ...VG });
}

/** Ausgebranntes Autowrack (nicht fahrbar). */
export function wrack(b, x, z, ry = 0, o = {}) {
  car(b, x, z, { ry, style: 'wreck', color: o.color || ['#3a3430', '#4a3a30', '#2e2c2a'][Math.floor(hash01(x, z, 1) * 3)], drivable: false });
  b.decal(x, 0.02, z, 3.4, 5.4, 'soot', { ry, opacity: 0.7 });
}

/** Kulissenfassade (Block w × d, Höhe h) mit Fensterraster an der Seite face; massiv, nicht begehbar. */
export function kulisse(b, x0, z0, x1, z1, h, face, color) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  b.box(cx, 0, cz, w, h, d, 'plaster_white', { tint: color, minimap: 'building', aoFloor: 0 });
  b.box(cx, 0, cz, w + 0.08, 0.8, d + 0.08, 'stone_wall', { tint: '#a8a092', ...VG });
  b.box(cx, h - 0.4, cz, w + 0.3, 0.4, d + 0.3, 'plaster_white', { tint: '#e2d8c2', ...VG });
  const along = face === 'n' || face === 's' ? w : d, n = Math.floor((along - 1) / 2.6), fl = Math.floor(h / FH);
  for (let f = 0; f < fl; f++) for (let k = 0; k < n; k++) {
    const t = -((n - 1) * 2.6) / 2 + k * 2.6, yy = f * FH + (f ? 0.85 : 0.6), hh = f ? 1.8 : 2.2;
    const dark = hash01(x0 + k, f + z0, 5) < 0.5 ? '#1c2024' : '#2a2e30';
    if (face === 'n' || face === 's') { const zz = face === 'n' ? z0 - 0.02 : z1 + 0.02; b.box(cx + t, yy, zz, 1.2, hh, 0.04, 'glass', { tint: dark, ...VG, ao: false }); b.box(cx + t, yy - 0.06, zz, 1.4, 0.08, 0.14, 'stone_wall', { tint: '#c8bfae', ...VG }); }
    else { const xx = face === 'w' ? x0 - 0.02 : x1 + 0.02; b.box(xx, yy, cz + t, 0.04, hh, 1.2, 'glass', { tint: dark, ...VG, ao: false }); b.box(xx, yy - 0.06, cz + t, 0.14, 0.08, 1.4, 'stone_wall', { tint: '#c8bfae', ...VG }); }
  }
}

// ---------------------------------------------------------------------------
// U-Bahn
// ---------------------------------------------------------------------------
export const UB = { x0: -18, x1: 4, z0: -9, z1: 9, y: -4.4, stairX: -10, stairW: 3.0, stairZ: 9, run: 7.4 };
/**
 * Verteilerebene unter der Lindenallee (Fliesen, Stützen, Kiosk, Fahrkartenautomaten, Bänke, Gitter zum Bahnsteig) und
 * zwei Abgänge (Nord/Süd) auf den Platz. Den Boden darüber (Straße, Platz mit Treppenlöchern) baut die Karte.
 */
export function ubahn(b) {
  const { x0, x1, z0, z1, y } = UB, t = 0.4;
  b.interior(x0, z0, x1, z1, y - 0.2, -0.45, 0.5);
  b.box((x0 + x1) / 2, y - 0.3, 0, x1 - x0, 0.3, z1 - z0, 'tiles', { tint: '#b8b4aa', minimap: false, grad: false });
  b.box((x0 + x1) / 2, -0.62, 0, x1 - x0, 0.1, z1 - z0, 'concrete', { tint: '#c8c4ba', ...VG, interior: true });
  const hh = -0.55 - y;
  // Wände (Fliesen hell), Öffnungen für die Abgänge in den Längswänden z0/z1
  for (const s of [-1, 1]) {
    const zz = s * (z1 - t / 2);
    wall(b, { x0, z0: zz, x1, z1: zz, y, h: hh, t, mat: 'tiles_white', tint: '#e2e4dc', openings: [{ at: UB.stairX - x0, w: UB.stairW, h: hh - 0.05, kind: 'gap', frame: false }], minimap: 'wall' });
  }
  wall(b, { x0: x0 + t / 2, z0, x1: x0 + t / 2, z1, y, h: hh, t, mat: 'tiles_white', tint: '#e2e4dc', openings: [{ at: 9, w: 4, h: 2.6, kind: 'gap', frame: false }] });
  wall(b, { x0: x1 - t / 2, z0, x1: x1 - t / 2, z1, y, h: hh, t, mat: 'tiles_white', tint: '#e2e4dc' });
  // Gitter zum (gesperrten) Bahnsteigabgang im Westen, dahinter dunkle Treppe
  for (let k = 0; k < 18; k++) b.cyl(x0 + 0.1, y, -2 + k * 0.23, 0.02, 2.6, 'metal_painted', { tint: '#2c2f33', ...KEIN, seg: 5 });
  b.box(x0 + 0.1, y, 0, 0.08, 2.6, 4, 'black', { visual: false, minimap: 'wall' });
  b.box(x0 - 1.6, y - 2, 0, 3, 2, 4, 'black', { ...VG, tint: '#050505' });
  b.defineSign('ubahn_gleis', { style: 'plate', text: 'ZU DEN BAHNSTEIGEN', sub: 'Gesperrt', bg: '#2a52be', fg: '#ffffff' });
  b.sign(x0 + 0.25, y + 2.75, 0, 2.6, 0.45, 'ubahn_gleis', { ry: Q });
  // Fliesen-Sockelband, Stützen, Kiosk, Automaten, Bänke, Leuchten
  for (const s of [-1, 1]) b.box((x0 + x1) / 2, y, s * (z1 - t - 0.02), x1 - x0 - 1, 1.1, 0.03, 'tiles_white', { tint: '#5a7a8a', ...VG });
  for (const px of [-13, -6, 1]) for (const s of [-1, 1]) b.box(px, y, s * 3.2, 0.6, hh, 0.6, 'tiles_white', { tint: '#d8dcd4', minimap: 'pillar' });
  // Kiosk
  b.box(-2.2, y, -6.6, 3.2, 2.6, 2.0, 'wood_painted', { tint: '#2f4a3a', minimap: 'cover' });
  b.box(-2.2, y + 1.0, -5.58, 2.4, 1.0, 0.04, 'glass', { ...VG });
  b.defineSign('kiosk_u', { style: 'plate', text: 'ZEITUNGEN', bg: '#c8302a', fg: '#ffffff' });
  b.sign(-2.2, y + 2.25, -5.56, 2.0, 0.35, 'kiosk_u', { ry: 0, back: false });
  for (const px of [-15, -14.2]) { b.box(px, y, 7.7, 0.7, 1.7, 0.45, 'metal_painted', { tint: '#c8402f', minimap: 'cover' }); b.box(px, y + 1.0, 7.46, 0.5, 0.4, 0.02, 'glass', { tint: '#203848', ...VG }); }
  for (const px of [-8.5, 0.5]) for (const s of [-1, 1]) { b.box(px, y + 0.42, s * 7.9, 1.8, 0.06, 0.45, 'wood_planks', { tint: '#8a6a4a', minimap: false }); for (const sx of [-0.8, 0.8]) b.box(px + sx, y, s * 7.9, 0.06, 0.42, 0.4, 'metal_painted', { tint: '#2c2f33', ...KEIN }); }
  for (const px of [-15, -9, -3, 2]) for (const pz of [-5, 0, 5]) deckenleuchte(b, px, -0.67, pz, Q, 1.25, { real: px === -9 && pz === 0, intensity: 6 });
  // Plakate, Netzplan, Schutt, umgestürzter Mülleimer
  b.defineSign('netzplan', { style: 'plate', text: 'NETZPLAN', sub: 'U1 · U3 · Straßenbahn 7', bg: '#f2f0ea', fg: '#2a52be' });
  b.sign(-12, y + 1.9, -(z1 - t - 0.03), 2.4, 1.2, 'netzplan', { ry: 0, back: false });
  b.sign(-4, y + 1.9, z1 - t - 0.03, 1.4, 1.0, 'plakat_2', { ry: PI, back: false });
  rubble(b, 2.0, 4.5, 1.1, { y, mat: 'concrete_dirty' });
  tonnen(b, -16.5, -7.6, 0, 2, { y });
  // Abgänge (Nord/Süd): Lauf von der Ebene bis zum Platz, Seitenwände mit Brüstung, Sturz an der Straßenseite
  for (const s of [-1, 1]) {
    const zb0 = s * UB.stairZ;
    flight(b, { x: UB.stairX, z: zb0 - s * 0.2, dir: s > 0 ? 's' : 'n', y0: y, y1: 0, w: UB.stairW - 0.1, run: UB.run, mat: 'stone_wall', tint: '#b8b0a2', nosing: true });
    const zTop = s * (UB.stairZ + UB.run);
    for (const sx of [-1, 1]) {
      const wx = UB.stairX + sx * (UB.stairW / 2 + 0.15);
      b.boxMM(wx - 0.15, y, Math.min(zb0, zTop), wx + 0.15, 1.0, Math.max(zb0, zTop), 'concrete', { tint: '#b4aea2', minimap: 'wall' });
      b.box(wx, 1.0, (zb0 + zTop) / 2, 0.36, 0.06, Math.abs(zTop - zb0), 'metal_galvanized', { ...VG });
    }
    // Sturz über dem Tunnelmund (Straßenseite) + Brüstung
    b.boxMM(UB.stairX - UB.stairW / 2, -0.55, zb0 - 0.15, UB.stairX + UB.stairW / 2, 1.0, zb0 + 0.15, 'concrete', { tint: '#b4aea2', minimap: 'wall' });
    // Eingangsschild „U“
    b.defineSign('ubahn', { style: 'number', text: 'U', sub: 'LINDENPLATZ', bg: '#2a52be', fg: '#ffffff' });
    const px = UB.stairX + UB.stairW / 2 + 0.9, pz = zTop - s * 0.5;
    b.cyl(px, 0, pz, 0.07, 3.2, 'metal_painted', { tint: '#2c2f33', seg: 8, minimap: 'prop' });
    b.sign(px, 3.2, pz, 0.8, 0.8, 'ubahn', { ry: s > 0 ? 0 : PI });
  }
}
