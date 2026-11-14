// NULLPUNKT — karten-voll (14.11.): Kleinteiliges „Leben“ für alle Karten (Owner: world). Nutzer: „Die Maps sind
// generell noch viel zu leer.“ Dieses Modul liefert
//   1. eine Bibliothek kleiner Alltagsdinge aus Primitiven bzw. Poly-Haven-Fotoscans (CC0, assets/lib/models) –
//      Mülltonnen, Fahrräder, Getränkekisten, Holzstapel, Leitern, Werkzeug, Eimer, Blumenkästen, Zählerkästen,
//      Satellitenschüsseln, Antennen, Strommasten mit Leitungen, Bauzäune, Baken, Schutt, Gullys …
//   2. automatische Durchgänge, die NACH dem Aufbau einer Karte über die Gebäude-Grundrisse (b.footprints), Öffnungen
//      (b.openings) und Türen (b.doors) laufen und wandnah Kleinkram, Fensterdetails (Vorhänge, Blumenkästen,
//      Rollladenkästen, Klimageräte, Satellitenschüsseln), Hausanschlüsse (Briefkasten, Hausnummer, Leuchte) und
//      Kabel/Wäscheleinen über Gassen setzen.
// Regeln (Mehrspieler, Bots, Kampagne): alles hier ist reine Optik – keine Kollision, kein Minikarten-Eintrag, dünne
// Teile ohne Kugeltreffer. Damit hängen Navigation (aus der Kollision abgetastet), Spawns und Kampagnenwege nicht
// davon ab, und die Menge darf je Grafikstufe schwanken (low ≈ ⅓, ultra ≈ 1,3 ×). Platzierung nur über hash01 (die
// Zufallsfolge der Karte – b.rand – bleibt unberührt, alle übrigen Platzierungen bleiben gleich). Türen bleiben frei
// (≥ 1,3 m), Startpunkte und Kampagnenpunkte bekommen einen Freiraum (o.sperr), Gebäudeecken (Fallrohre) bleiben frei.
// Geometrie landet in den Material-Eimern des MapBuilders (zusammengefasst je Material/Chunk → kaum zusätzliche
// Draw Calls); Fotoscan-Modelle laufen über b.model (instanziert, LOD).
import * as THREE from 'three';
import { frame, hash01, cable, pallet } from './props.js?v=20261114060746';

const D = { collide: false, minimap: false };
const DG = { ...D, grad: false };
const DN = { ...D, grad: false, ao: false, bullet: false };

/** Grafikstufe des Builders. */
export const stufe = (b) => b.lookQuality || b.quality || 'high';
/** Mengenfaktor je Stufe. */
export const DICHTE = { low: 0.34, medium: 0.7, high: 1, ultra: 1.3 };
const fein = (b) => stufe(b) !== 'low';
const ultra = (b) => stufe(b) === 'ultra';

const geoCache = new Map();
function cached(key, fn) { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); }

/** Bibliotheksmodell ohne Kollision mit prozeduralem Ersatz. */
/** Schwere Fotoscans (≥ 4000 Dreiecke in der Nahstufe): für Massen-Kleinkram nur auf ultra, sonst Primitive. */
const SCHWER = new Set(['metal_trash_can', 'exterior_aircon_unit', 'schoolchair_01', 'metal_office_desk']);
function lib(b, id, x, y, z, o, ersatz) {
  if (b.hasModel(id) && (!SCHWER.has(id) || ultra(b) || !ersatz)) b.model(id, x, y, z, { ...o, collide: false, minimap: false, fallback: ersatz });
  else if (ersatz) ersatz(b);
}

/** Dünner Stab von (ax,ay) nach (bx,by) in der lokalen x/y-Ebene eines frame (lz = Tiefe). */
function stab(f, ax, ay, bx, by, lz, th, mat, tint) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  f.box((ax + bx) / 2, (ay + by) / 2 - th / 2, lz, L, th, th, mat, { ...DN, tint, rz: Math.atan2(dy, dx) });
}

// ---------------------------------------------------------------------------
// Einzelstücke (Unterkante-Mitte (x,y,z), ry: lokal +z = Vorderseite, meist von der Wand weg)
// ---------------------------------------------------------------------------
const TONNE = ['#6a7076', '#3f7a4f', '#3a6aa8', '#8a6040', '#5c6268', '#d4b02a']; // hell genug, dass Polymer nicht schwarz wirkt
/** 240-l-Mülltonne (Kunststoff) mit Deckel, Griff und Rädern. */
export function muelltonne(b, x, y, z, ry, o = {}) {
  const f = frame(b, x, y, z, ry), t = o.tint || TONNE[Math.floor(hash01(x, z, 41) * TONNE.length)];
  const open = hash01(x, z, 42) < 0.18;
  f.box(0, 0.05, 0, 0.56, 0.98, 0.68, 'polymer', { ...DG, tint: t });
  f.box(0, 0.02, -0.22, 0.6, 0.12, 0.2, 'polymer', { ...DG, tint: t });
  f.box(0, 1.03, 0.02, 0.6, 0.05, 0.76, 'polymer', { ...DG, tint: t, rx: open ? -0.9 : 0, ao: false });
  f.box(0, 0.93, -0.38, 0.5, 0.05, 0.05, 'polymer', { ...DN, tint: '#202224' });
  for (const sx of [-0.28, 0.28]) f.cyl(sx, 0.1, -0.3, 0.1, 0.06, 'rubber', { ...DN, axis: 'x', seg: 8 });
  if (open && fein(b)) f.box(0, 0.98, 0.05, 0.45, 0.12, 0.5, 'polymer', { ...DN, tint: '#1c1d1f' });
}

/** Runde verzinkte Mülltonne (Fotoscan metal_trash_can) bzw. Ersatz. */
export function blechtonne(b, x, y, z, ry) {
  lib(b, 'metal_trash_can', x, y, z, { ry }, (bb) => {
    bb.cyl(x, y, z, 0.26, 0.72, 'metal_galvanized', { ...DG, seg: 12, r1: 0.24 });
    bb.cyl(x, y + 0.72, z, 0.28, 0.05, 'metal_galvanized', { ...DN, seg: 12 });
  });
}

/** Fahrrad, parallel zur Wand abgestellt (lokal x = Fahrtrichtung). */
export function fahrrad(b, x, y, z, ry, o = {}) {
  const f = frame(b, x, y, z, ry), t = o.tint || ['#1f3f6a', '#7a1f1f', '#2b2d30', '#3f5f3f', '#c8c4b8', '#5a3f6a'][Math.floor(hash01(x, z, 43) * 6)];
  const R = 0.33, wb = 0.52;
  const rad = cached('radreifen', () => new THREE.TorusGeometry(R, 0.022, 4, 16).toNonIndexed());
  for (const sx of [-wb, wb]) {
    f.geom(rad, sx, R, 0, 'rubber', { ...DN, tint: '#1a1a1a' });
    f.cyl(sx, R, 0, 0.03, 0.1, 'metal_galvanized', { ...DN, axis: 'z', seg: 6 });
  }
  const th = 0.03, bb = [-0.05, 0.32], head = [0.38, 0.78], seat = [-0.18, 0.85];
  stab(f, bb[0], bb[1], head[0], head[1] - 0.06, 0, th, 'metal_painted', t);   // Unterrohr
  stab(f, seat[0], seat[1] - 0.08, head[0], head[1], 0, th, 'metal_painted', t); // Oberrohr
  stab(f, bb[0], bb[1], seat[0], seat[1], 0, th, 'metal_painted', t);          // Sattelrohr
  stab(f, bb[0], bb[1], -wb, R, 0, th * 0.8, 'metal_painted', t);              // Kettenstrebe
  stab(f, seat[0], seat[1] - 0.1, -wb, R, 0, th * 0.8, 'metal_painted', t);    // Sitzstrebe
  stab(f, head[0], head[1] + 0.12, wb, R, 0, th, 'metal_galvanized', null);   // Gabel
  f.box(head[0] - 0.02, head[1] + 0.14, 0, 0.04, 0.03, 0.56, 'metal_galvanized', DN); // Lenker
  for (const sz of [-0.27, 0.27]) f.box(head[0] - 0.06, head[1] + 0.13, sz, 0.12, 0.035, 0.035, 'rubber', { ...DN, tint: '#1a1a1a' });
  f.box(seat[0] - 0.02, seat[1] + 0.02, 0, 0.24, 0.05, 0.12, 'rubber', { ...DN, tint: '#1a1a1a' }); // Sattel
  if (hash01(x, z, 44) < 0.4) f.box(-wb + 0.05, R + 0.1, 0, 0.32, 0.02, 0.14, 'metal_galvanized', DN); // Gepäckträger
  if (hash01(x, z, 45) < 0.3) f.box(wb + 0.08, R + 0.28, 0, 0.26, 0.2, 0.3, 'wood_dark', { ...DN, tint: '#6a5232' }); // Korb
}

/** Stapel Getränkekisten (Fotoscan plastic_crate_01 bzw. Kunststoffkisten). */
export function getraenkekisten(b, x, y, z, ry, n = 3) {
  const f = frame(b, x, y, z, ry), t = ['#2f5e3e', '#7a1f1f', '#2c4f86', '#c9a227'][Math.floor(hash01(x, z, 46) * 4)];
  for (let i = 0; i < n; i++) {
    const [px, pz] = f.P((hash01(x, z, 47 + i) - 0.5) * 0.06, 0);
    lib(b, 'plastic_crate_01', px, y + i * 0.3, pz, { ry: ry + (hash01(x, z, 50 + i) - 0.5) * 0.15, sx: 1, tint: null }, (bb) => {
      const g = frame(bb, px, y + i * 0.3, pz, ry);
      g.box(0, 0, 0, 0.4, 0.29, 0.3, 'polymer', { ...DG, tint: t });
      if (i === n - 1) for (let k = 0; k < 6; k++) g.cyl(-0.14 + (k % 3) * 0.14, 0.12, (k < 3 ? -0.07 : 0.07), 0.03, 0.27, 'glass', { ...DN, seg: 6, tint: '#3b5a2c' });
    });
  }
}

/** Ein bis drei Müllsäcke (Fotoscan trashbag bzw. gestauchte Kugeln). */
export function muellsaecke(b, x, y, z, n = 2) {
  for (let i = 0; i < n; i++) {
    const a = hash01(x, z, 60 + i) * 6.28, r = i ? 0.35 : 0;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    lib(b, 'trashbag', px, y, pz, { ry: a, s: 0.85 + hash01(x, z, 63 + i) * 0.3 }, (bb) => {
      bb.cyl(px, y, pz, 0.28, 0.5, 'polymer', { ...DG, r1: 0.12, seg: 8, tint: '#1e2022' });
    });
  }
}

/** Kaminholz-Stapel an einer Wand (Rinde, davor Stirnholz-Scheiben), Länge L, Höhe H. */
export function holzstapel(b, x, y, z, ry, L = 1.8, H = 1.1) {
  const f = frame(b, x, y, z, ry), d = 0.36;
  f.box(0, 0, 0, L + 0.1, 0.1, d + 0.06, 'wood_weathered', { ...DG, tint: '#6a5a46' });   // Unterlage
  f.box(0, 0.1, -0.02, L, H, d - 0.04, 'bark', { ...DG, tint: '#8a7a68' });
  f.box(0, 0.1 + H, 0, L + 0.3, 0.03, d + 0.2, 'metal_corrugated_rust', { ...DG, rx: -0.12, tint: '#9a8a7a' }); // Blech drauf
  if (!fein(b)) return;
  // Stirnholz: Kreisscheiben (6 Ecken) dicht an dicht, eine gemeinsame Geometrie je Maß
  const key = `stirn${L.toFixed(1)}_${H.toFixed(1)}`;
  const g = cached(key, () => {
    const P = [], N = [], U = [], r0 = 0.055, nx = Math.floor(L / (r0 * 2)), ny = Math.floor(H / (r0 * 1.8));
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const cx = -L / 2 + r0 + i * r0 * 2 + (j % 2) * r0 * 0.9 + (rnd() - 0.5) * 0.02, cy = 0.1 + r0 + j * r0 * 1.8, r = r0 * (0.75 + rnd() * 0.35);
      if (cx + r > L / 2) continue;
      const u0 = rnd() * 0.8;
      for (let k = 0; k < 6; k++) {
        const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2;
        P.push(cx, cy, 0, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, 0, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, 0);
        N.push(0, 0, 1, 0, 0, 1, 0, 0, 1);
        U.push(u0, 0.5, u0 + 0.05, 0.5, u0 + 0.05, 0.55);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    return geo;
  });
  f.geom(g, 0, 0, d / 2 - 0.015, 'wood_planks', { ...DN, tint: '#c8a678', uv: 'keep' });
}

/** Angelehnte Leiter (Fotoscan wooden_ladder bzw. Holme + Sprossen), lehnt in lokal −z an der Wand. */
export function leiter(b, x, y, z, ry, h = 3) {
  const lean = 0.28;
  lib(b, 'wooden_ladder', x, y, z, { ry, rx: -lean, s: h / 2.9 }, (bb) => {
    const f = frame(bb, x, y, z, ry);
    for (const sx of [-0.22, 0.22]) f.box(sx, 0, 0, 0.05, h, 0.07, 'wood_planks', { ...DN, tint: '#9a7a52', rx: -lean });
    for (let yy = 0.3; yy < h - 0.1; yy += 0.3) f.box(0, yy * Math.cos(lean), -yy * Math.sin(lean), 0.44, 0.035, 0.035, 'wood_planks', { ...DN, tint: '#8a6a46' });
  });
}

/** Werkzeug an die Wand gelehnt: Spaten, Axt, Vorschlaghammer oder Besen. */
export function werkzeug(b, x, y, z, ry, art) {
  const k = art ?? Math.floor(hash01(x, z, 70) * 4);
  const ids = ['rusted_spade_01', 'wooden_axe', 'sledgehammer_01', null];
  const id = ids[k];
  const ersatz = (bb) => {
    const f = frame(bb, x, y, z, ry);
    f.box(0, 0.05, 0, 0.035, 1.2, 0.035, 'wood_planks', { ...DN, tint: '#8a6a46', rx: -0.22 });
    if (k === 3) f.box(0, 0, 0.0, 0.32, 0.12, 0.06, 'polymer', { ...DN, tint: '#c9a227' });
    else f.box(0, 0, 0, k === 0 ? 0.2 : 0.14, k === 0 ? 0.28 : 0.12, 0.03, 'metal_rust', { ...DN });
  };
  // Fotoscans stehen (Stiel nach oben) – leicht an die Wand gelehnt
  if (id) lib(b, id, x, y, z, { ry, rx: -0.22, bullet: false }, ersatz);
  else ersatz(b);
}

/** Eimer (Fotoscan wooden_bucket_01 bzw. Zinkeimer). */
export function eimer(b, x, y, z) {
  if (hash01(x, z, 72) < 0.5) lib(b, 'wooden_bucket_01', x, y, z, { ry: hash01(x, z, 73) * 6.28, bullet: false }, (bb) => bb.cyl(x, y, z, 0.13, 0.28, 'metal_galvanized', { ...DN, r1: 0.15, seg: 10 }));
  else b.cyl(x, y, z, 0.13, 0.28, 'metal_galvanized', { ...DN, r1: 0.15, seg: 10 });
}

/** Blumenkasten (unter Fenster) bzw. Pflanzkasten am Boden: Kasten + Blühpflanzen. */
export function blumenkasten(b, x, y, z, ry, w = 0.9) {
  const f = frame(b, x, y, z, ry);
  f.box(0, 0, 0, w, 0.18, 0.2, 'tiles_terracotta', { ...DN, tint: hash01(x, z, 75) < 0.5 ? '#b0623e' : '#3f5f3f' });
  f.box(0, 0.17, 0, w - 0.06, 0.02, 0.16, 'dirt', DN);
  const n = Math.max(2, Math.round(w / 0.3));
  const col = ['#c8302f', '#e0a32c', '#d85a8a', '#f0ece0', '#8a4ac8'][Math.floor(hash01(x, z, 76) * 5)];
  for (let i = 0; i < n; i++) {
    const [px, pz] = f.P(-w / 2 + (i + 0.5) * (w / n), 0);
    b.plant('bush', px, y + 0.1, pz, { s: 0.22 + hash01(px, pz, 77) * 0.1, ry: hash01(px, pz, 78) * 6.28, tint: i % 2 ? col : undefined });
  }
}

/** Zähler-/Hausanschlusskasten (graues Kunststoffgehäuse) an der Wand, Unterkante y. */
export function zaehlerkasten(b, x, y, z, ry) {
  const f = frame(b, x, y, z, ry);
  f.box(0, 0, 0, 0.42, 0.62, 0.18, 'polymer', { ...DG, tint: '#b8b8b0' });
  f.box(0, 0.05, 0.091, 0.36, 0.5, 0.005, 'polymer', { ...DN, tint: '#a8a8a0' });
  f.box(0.12, 0.28, 0.095, 0.03, 0.05, 0.01, 'black', DN);
  f.cyl(0, -0.45, -0.02, 0.025, 0.45, 'polymer', { ...DN, seg: 6, tint: '#4a4a48' }); // Leerrohr in den Boden
}

/** Briefkasten an der Wand (Unterkante y). */
export function briefkasten(b, x, y, z, ry) {
  const f = frame(b, x, y, z, ry), t = ['#c9a227', '#2b2d30', '#7a1f1f', '#3a5a3a', '#8d9399'][Math.floor(hash01(x, z, 80) * 5)];
  f.box(0, 0, 0, 0.36, 0.42, 0.12, 'metal_painted', { ...DN, tint: t });
  f.box(0, 0.32, 0.061, 0.26, 0.025, 0.01, 'black', DN);
}

/** Wandleuchte über einer Tür (Unterkante y), leuchtet nicht (Tageslicht). */
export function wandleuchte(b, x, y, z, ry) {
  if (hash01(x, z, 81) < 0.5 && b.hasModel('security_light')) { b.model('security_light', x, y, z, { ry, collide: false, minimap: false, bullet: false }); return; }
  const f = frame(b, x, y, z, ry);
  f.box(0, 0.1, 0.04, 0.08, 0.12, 0.08, 'metal_painted', { ...DN, tint: '#2b2d30' });
  f.box(0, 0, 0.12, 0.16, 0.22, 0.16, 'glass', { ...DN, tint: '#e8e2d0' });
  f.box(0, 0.22, 0.12, 0.2, 0.04, 0.2, 'metal_painted', { ...DN, tint: '#2b2d30' });
}

/** Hausnummer (Emailleschild) an der Wand. */
export function hausnummer(b, x, y, z, ry) {
  const f = frame(b, x, y, z, ry);
  f.box(0, 0, 0, 0.2, 0.16, 0.012, 'white', { ...DN, tint: hash01(x, z, 82) < 0.5 ? '#2c4f86' : '#f0ece0' });
}

/** Satellitenschüssel (Spiegel + Arm + LNB) an Wand/Brüstung; lokal +z = Blickrichtung. */
export function satschuessel(b, x, y, z, ry) {
  const f = frame(b, x, y, z, ry);
  const g = cached('schuessel', () => { const s = new THREE.SphereGeometry(0.42, 10, 4, 0, Math.PI * 2, 0, 0.55); s.rotateX(Math.PI / 2 + 0.5); return s.toNonIndexed(); });
  f.geom(g, 0, 0.35, 0.05, 'white', { ...DN, tint: '#d8d8d2' });
  f.box(0, 0.05, -0.05, 0.05, 0.3, 0.05, 'metal_galvanized', DN);
  stab(f, 0, 0.25, 0, 0.25, 0.25, 0.02, 'metal_galvanized');
  f.box(0, 0.12, 0.36, 0.025, 0.025, 0.4, 'metal_galvanized', { ...DN, rx: 0.5 });
  f.box(0, 0.3, 0.52, 0.06, 0.06, 0.1, 'polymer', { ...DN, tint: '#3a3d40' });
}

/** Dachantenne (Mast + Querträger mit Elementen). */
export function antenne(b, x, y, z, h = 2.4) {
  b.cyl(x, y, z, 0.022, h, 'metal_galvanized', { ...DN, seg: 5 });
  const ry = hash01(x, z, 83) * 3.14;
  const f = frame(b, x, y, z, ry);
  for (const [yy, L] of [[h - 0.1, 1.3], [h - 0.55, 0.9]]) {
    f.box(0, yy, 0, L, 0.02, 0.02, 'metal_galvanized', DN);
    for (let i = 0; i < 6; i++) f.box(-L / 2 + 0.1 + i * (L - 0.2) / 5, yy, 0, 0.012, 0.012, 0.42 - i * 0.04, 'metal_galvanized', DN);
  }
}

/** Absperrbake (rot-weiß) auf Fußplatte. */
export function bake(b, x, y, z, ry) {
  const f = frame(b, x, y, z, ry);
  f.box(0, 0, 0, 0.42, 0.06, 0.42, 'rubber', { ...DG, tint: '#1e1e1e' });
  for (let i = 0; i < 4; i++) f.box(0, 0.06 + i * 0.22, 0, 0.26, 0.22, 0.03, 'white', { ...DN, tint: i % 2 ? '#e8e4dc' : '#c42a22' });
  if (hash01(x, z, 84) < 0.5) f.box(0, 0.95, 0, 0.12, 0.12, 0.08, 'lamp_orange', { ...DN, cast: false });
}

/** Mobiler Bauzaun (Gitterfelder 3,5 m auf Betonfüßen) von A nach B – rein optisch (Lücken zwischen Feldern). */
export function bauzaun(b, x0, z0, x1, z1, y = 0, o = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0), n = Math.max(1, Math.round(L / 3.5));
  const ux = (x1 - x0) / L, uz = (z1 - z0) / L, w = L / n;
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * w, cx = x0 + ux * s, cz = z0 + uz * s, tilt = (hash01(cx, cz, 85) - 0.5) * 0.06;
    const f = frame(b, cx, y, cz, ry);
    for (const sx of [-w / 2 + 0.05, w / 2 - 0.05]) {
      f.box(sx, 0, 0, 0.62, 0.14, 0.22, 'concrete', { ...DG, tint: '#a8a49a' });
      f.box(sx, 0.1, 0, 0.04, 2.0, 0.04, 'metal_galvanized', { ...DN, rx: tilt });
    }
    f.box(0, 0.12, 0, w - 0.1, 1.9, 0.015, 'metal_grate', { ...DN, rx: tilt, uvScale: 0.8 });
    for (const yy of [0.12, 2.0]) f.box(0, yy, 0, w - 0.1, 0.035, 0.035, 'metal_galvanized', { ...DN, rx: tilt });
    if (o.plane && hash01(cx, cz, 86) < 0.5) f.box(0, 0.5, 0.02, w - 0.2, 1.1, 0.01, 'tarp', { ...DN, tint: o.plane, rx: tilt });
  }
}

/** Schutthaufen (Brocken aus Beton/Ziegel/Putz), Radius r. */
export function schutt(b, x, y, z, r = 1.2, o = {}) {
  const n = Math.round((fein(b) ? 9 : 4) * r);
  const mats = o.mats || ['rubble', 'concrete', 'brick', 'plaster_white'];
  b.cyl(x, y - 0.05, z, r, r * 0.38, 'rubble', { ...DG, r1: r * 0.25, seg: 9, tint: o.tint || '#a8a094', uv: 'world' });
  for (let i = 0; i < n; i++) {
    const a = hash01(x, z, 90 + i) * 6.28, rr = Math.sqrt(hash01(x, z, 120 + i)) * r * 0.95;
    const s = 0.08 + hash01(x, z, 150 + i) * 0.22, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    const yy = y + Math.max(0, (1 - rr / r) * r * 0.32) - s * 0.3;
    b.box(px, yy, pz, s * 1.6, s, s * 1.2, mats[i % mats.length], { ...DN, ry: a * 3, rx: (hash01(px, pz, 1) - 0.5) * 0.8, rz: (hash01(px, pz, 2) - 0.5) * 0.8, tint: o.tint, uv: 'local' });
  }
  if (o.balken && fein(b)) for (let i = 0; i < 2; i++) {
    const a = hash01(x, z, 180 + i) * 6.28;
    b.box(x + Math.cos(a) * r * 0.3, y + 0.1, z + Math.sin(a) * r * 0.3, 0.14, 0.12, r * 1.6, 'borke_verkohlt', { ...DN, ry: a, rx: 0.25, tint: '#2a2622' });
  }
}

/** Ziegelstapel (Palette mit Ziegeln, teils umgekippt). */
export function ziegelstapel(b, x, y, z, ry) {
  const f = frame(b, x, y, z, ry);
  f.box(0, 0, 0, 1.0, 0.12, 0.8, 'wood_planks', { ...DG, tint: '#a08060' });
  f.box(0, 0.12, 0, 0.92, 0.5 + hash01(x, z, 87) * 0.3, 0.72, 'brick', { ...DG, tint: '#b0624a' });
}

/** Gitterrost eines Straßeneinlaufs (Gully) bündig im Boden. */
export function gully(b, x, y, z, ry) {
  const f = frame(b, x, y, z, ry);
  f.box(0, -0.02, 0, 0.62, 0.035, 0.42, 'metal_rust', { ...DN, tint: '#3a3632' });
  for (let i = 0; i < 7; i++) f.box(-0.24 + i * 0.08, -0.004, 0, 0.03, 0.02, 0.34, 'metal_galvanized', { ...DN, tint: '#4a4640' });
  b.decal(x, y + 0.006, z, 1.0, 0.8, 'stain', { ry: ry + 0.3, opacity: 0.55 });
}

/** Kanaldeckel (Fotoscan water_manhole_cover bzw. Decal). */
export function kanaldeckel(b, x, y, z) {
  if (b.hasModel('water_manhole_cover')) b.model('water_manhole_cover', x, y - 0.01, z, { ry: hash01(x, z, 88) * 6.28, collide: false, minimap: false, bullet: false, s: 1 });
  else b.decal(x, y + 0.012, z, 1.1, 1.1, 'manhole', { opacity: 1, ry: 0 });
}

/** Aufgeschossenes Tauwerk (Festmacher) neben einem Poller. */
export function tauwerk(b, x, y, z, o = {}) {
  const g = cached('tau', () => new THREE.TorusGeometry(0.34, 0.035, 5, 18).rotateX(Math.PI / 2).toNonIndexed());
  const n = 3 + Math.floor(hash01(x, z, 470) * 3), t = o.tint || (hash01(x, z, 471) < 0.5 ? '#c8b07a' : '#3a5a8a');
  for (let i = 0; i < n; i++) b.geom(g, x + (hash01(x, i, 472) - 0.5) * 0.06, y + 0.035 + i * 0.065, z + (hash01(z, i, 473) - 0.5) * 0.06, 'tarp', { ...DN, tint: t, sx: 1 - i * 0.04, sz: 1 - i * 0.04 });
}

/** Werkzeugkiste, Kanister, Fass … Gruppe Industrie-/Hafenkram an der Wand. */
function industrieKram(b, x, y, z, ry, k) {
  const f = frame(b, x, y, z, ry);
  if (k < 0.25) { // Kanisterreihe
    for (let i = 0; i < 3; i++) { const [px, pz] = f.P(-0.4 + i * 0.4, 0); lib(b, i % 2 ? 'metal_jerrycan' : 'metal_jerrycan_green', px, y, pz, { ry: ry + (hash01(px, pz, 1) - 0.5) * 0.3 }, (bb) => bb.box(px, y, pz, 0.17, 0.46, 0.34, 'metal_painted', { ...DG, ry, tint: '#4a5a3a' })); }
  } else if (k < 0.45) { // Fass
    lib(b, hash01(x, z, 3) < 0.5 ? 'barrel_02' : 'barrel_03', x, y, z, { ry: hash01(x, z, 4) * 6.28 }, (bb) => bb.cyl(x, y, z, 0.29, 0.88, 'metal_painted', { ...DG, seg: 12, tint: '#5a6a7a' }));
  } else if (k < 0.62) { // Palette, evtl. mit Kartons
    pallet(b, x, y, z, { ry, collide: false, load: hash01(x, z, 5) < 0.5 ? 'boxes' : null });
  } else if (k < 0.75) { // an die Wand gelehnte Palette
    f.box(0, 0, -0.05, 1.2, 0.14, 0.8, 'wood_planks', { ...DN, tint: '#b09670', rx: -1.35 });
  } else if (k < 0.88) { // Gasflasche
    lib(b, 'propane_tank', x, y, z, { ry }, (bb) => bb.cyl(x, y, z, 0.15, 0.9, 'metal_painted', { ...DG, seg: 10, tint: '#c8402f' }));
  } else { // Werkzeugkiste / Karton
    lib(b, 'cardboard_box_01', x, y, z, { ry: ry + 0.2 }, (bb) => bb.box(x, y, z, 0.5, 0.35, 0.4, 'cardboard', { ...DG, ry }));
  }
}

// ---------------------------------------------------------------------------
// Strom: Holzmast mit Querträger und Isolatoren, Leitungen mit Durchhang
// ---------------------------------------------------------------------------
/**
 * Holz-Strommast (Niederspannung). (x, y, z) Fuß, ry: Querträger quer zur Leitung (lokal x). Liefert die Aufhängepunkte
 * [[x,y,z] × 3] der Leiterseile. Kollision nur als dünner Stamm (Mast ist spielrelevant: man stößt sich daran).
 */
export function strommast(b, x, y, z, ry, o = {}) {
  const h = o.h ?? 8.5, f = frame(b, x, y, z, ry);
  b.cyl(x, y - 0.3, z, 0.13, h + 0.3, 'wood_weathered', { seg: 8, r1: 0.1, tint: '#6a5a48', collide: o.collide !== false, minimap: false, grad: false });
  f.box(0, h - 0.55, 0.13, 1.7, 0.1, 0.1, 'wood_weathered', { ...DG, tint: '#5a4a3a' });
  stab(f, -0.55, h - 0.5, 0, h - 1.2, 0.13, 0.05, 'metal_galvanized');
  stab(f, 0.55, h - 0.5, 0, h - 1.2, 0.13, 0.05, 'metal_galvanized');
  const pts = [];
  for (const sx of [-0.75, 0, 0.75]) {
    const lx = sx, ly = h - 0.45 + (sx === 0 ? 0.25 : 0);
    if (sx === 0) f.box(0, h - 0.45, 0.13, 0.06, 0.25, 0.06, 'wood_weathered', { ...DN, tint: '#5a4a3a' });
    f.cyl(lx, ly, 0.13, 0.035, 0.12, 'white', { ...DN, seg: 6, tint: '#cfd4cf' });
    const [px, pz] = f.P(lx, 0.13);
    pts.push([px, y + ly + 0.12, pz]);
  }
  if (o.trafo) { // Masttrafo / Verteilerkasten
    f.box(0, 2.6, -0.3, 0.6, 0.8, 0.4, 'metal_painted', { ...DG, tint: '#7a8478' });
    { const [sx, sz] = f.P(0, -0.51); b.sign(sx, y + 3.1, sz, 0.2, 0.18, 'warn_volt', { ry: ry + Math.PI, back: false, depth: 0 }); }
  }
  if (o.lampe) { // Straßenleuchte am Mast
    f.box(0.6, h - 2.2, 0.15, 1.2, 0.05, 0.05, 'metal_galvanized', DN);
    f.box(1.2, h - 2.32, 0.15, 0.45, 0.12, 0.22, 'metal_painted', { ...DN, tint: '#3a3e43' });
    f.box(1.2, h - 2.34, 0.15, 0.38, 0.02, 0.18, 'white', { ...DN, tint: '#e4e2dc', cast: false });
  }
  return pts;
}

/** Leitungen zwischen zwei Masten (je Aufhängepunkt ein Seil). Durchhang ≈ 1,5 % der Spannweite + 0,3 m. */
export function leitungen(b, A, B, o = {}) {
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const L = Math.hypot(B[i][0] - A[i][0], B[i][2] - A[i][2]);
    cable(b, A[i], B[i], { sag: o.sag ?? (0.3 + L * 0.015), r: o.r ?? 0.011, segments: o.seg ?? (L > 30 ? 10 : 7) });
  }
}

/**
 * Freileitung entlang einer Punktfolge (Gelände: o.hy(x,z) liefert die Bodenhöhe). Masten alle o.step m, seitlich um
 * o.side versetzt (Straßenrand). Liefert die Mastpositionen.
 */
export function freileitung(b, pts, o = {}) {
  const step = o.step ?? 38, side = o.side ?? 6, hy = o.hy || (() => 0), sperr = o.sperr || [];
  // Polylinie gleichmäßig abtasten
  const out = [];
  let acc = step / 2, prev = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-3) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L;
    while (acc <= L) {
      const px = ax + ux * acc - uz * side, pz = az + uz * acc + ux * side;
      acc += step;
      if (o.ok && !o.ok(px, pz)) { prev = null; continue; }
      if (sperr.some(([sx, sz, r]) => Math.hypot(px - sx, pz - sz) < (r ?? 4))) { prev = null; continue; }
      const ry = Math.atan2(-uz, ux) + Math.PI / 2;
      const top = strommast(b, px, hy(px, pz), pz, ry, { h: o.h ?? 8.5, trafo: hash01(px, pz, 91) < (o.trafo ?? 0.08), lampe: hash01(px, pz, 92) < (o.lampe ?? 0) });
      if (prev) leitungen(b, prev, top);
      prev = top;
      out.push([px, pz, top]);
    }
    acc -= L;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Automatische Durchgänge
// ---------------------------------------------------------------------------
/** Sperrpunkte [x, z, r] aus Startpunkten einer Kartendefinition (beliebig verschachtelt) + Zusatzliste. */
export function sperrpunkte(def, extra = [], r = 2.6) {
  const out = [];
  const walk = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      if (v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number') { out.push([v[0], v[1], r]); return; }
      for (const e of v) walk(e);
    } else if (typeof v === 'object') {
      if (typeof v.x === 'number' && typeof v.z === 'number') { out.push([v.x, v.z, v.radius ? Math.min(v.radius, 6) : r]); return; }
      for (const e of Object.values(v)) walk(e);
    }
  };
  walk(def?.spawns);
  for (const p of extra) out.push([p[0], p[1], p[2] ?? 2.2]);
  return out;
}

/**
 * Kampagnenpunkte (Wege, Wellen, Ziele, Checkpoints aus game/campaign/missions/*, statisch übernommen) – hier wird
 * nichts mit Kollision gesetzt, die Punkte halten nur Kleinkram aus Laufwegen/Zwischensequenzen heraus.
 */
export const KAMPAGNE = {
  altstadt: [[-35, -7], [-33, 12], [-32, 30], [-31, 16], [-30, -24], [-30, 2], [-27, 44], [-26, 43], [-25, 44], [-22, 2], [-20, -30], [-19, 43], [-19, 44], [-18, 4], [-17, 44], [-16, 42], [-16, 46], [-15, 44], [-14, -36], [-14, 46], [-13, 42], [-13, 46], [-10, -26], [-2, 2], [3, 0], [8, -20], [10, 14], [12, -6], [13, -5], [14, -8], [14, -6], [14, -4], [22, 9], [26, -16], [36, -24], [40, -12], [42, 6]],
  werk: [[-70, 0], [-64, -6], [-60, 8], [-58, 22], [-56, -18], [-17, -39], [-9, -44], [-3, 42], [-1, 37], [-1, 42], [0, -42], [0, 31], [0, 32], [0, 33], [0, 38], [1, 36], [2, 39], [2, 42], [2, 44], [3, 37], [4, 38], [4, 43], [5, 37], [5, 40], [7, 39], [9, -44], [17, -39]],
  // kampagne-a Runde 2 (M4 Hafennacht, M6 Feuerlinie): Stell-/Zielpunkte frei halten
  hafen: [[10.5, 46], [6, 26.6], [-12.3, 12.5], [-22.3, -14], [-31.5, -21.6], [-31.5, -19.2], [-40.6, 45.4], [-38.5, 40], [-36, 6], [10.5, 30], [10.5, 8], [0.4, 14], [0.4, 4], [-1.5, 36], [-1.5, 26], [-7.5, 18], [-7.5, 8], [-20.6, 18], [-20.6, 24], [-11.5, -2], [-20.8, 2], [-20.8, -20], [-28, -8], [-28, 6], [-30, -16], [-34, -16], [-36, -24], [-36, -34], [-27.5, -27], [-27.5, -33], [-36, 40], [-34, 41.5], [-38, 41.5], [6.5, 28.5], [-12, 16.5], [-21.5, -8], [-30.5, -17.5]],
  brandwald: [[24, 141], [19, 146], [96, -3], [100, -27], [112, -17], [113, -16], [118, -30], [98, -14], [98, -32], [114, -12], [96, -12], [120, -28], [108, -36], [90, -24], [124, -18], [104, -8], [76, 96], [62, 116], [64.4, 112.6], [66.2, 113.8]],
  grenzland: [[-30, 94], [-26, 58], [-14, 82], [-8, 41], [-6, 74], [3, 126], [4, 92], [4, 128], [5, 124], [6, 70], [6, 126], [8, 66], [8, 124], [8, 126], [9, 118], [9, 127], [10, 125], [11, 122], [14, 121], [18, 63], [22, 58], [24, -78], [24, 95], [26, 4], [31, -9], [32, -42], [33, -8], [34, -50], [34, -12], [35, -7], [35, 41], [35, 46], [38, -19], [40, -52], [40, -30], [40, -28], [44, -44], [50, -48], [52, -40], [62, -78]],
};

const inRect = (f, x, z, m = 0) => {
  const c = Math.cos(f.ry || 0), s = Math.sin(f.ry || 0), px = x - f.x, pz = z - f.z;
  const lx = px * c - pz * s, lz = px * s + pz * c;
  return Math.abs(lx) <= f.hw + m && Math.abs(lz) <= f.hd + m;
};

/** Nachbarschafts-Raster der Grundrisse (schnelle Überlappungsprüfung). */
function footGrid(b) {
  const G = new Map(), cs = 8;
  const list = b.footprints.filter((f) => f.kind !== 'zone' && f.kind !== 'water');
  for (const f of list) {
    const r = Math.hypot(f.hw, f.hd) + 1;
    for (let gx = Math.floor((f.x - r) / cs); gx <= Math.floor((f.x + r) / cs); gx++) for (let gz = Math.floor((f.z - r) / cs); gz <= Math.floor((f.z + r) / cs); gz++) {
      const k = gx * 73856093 ^ gz * 19349663;
      if (!G.has(k)) G.set(k, []);
      G.get(k).push(f);
    }
  }
  return (x, z) => G.get(Math.floor(x / cs) * 73856093 ^ Math.floor(z / cs) * 19349663) || [];
}

/**
 * Wandnaher Kleinkram rund um alle Gebäude im Bereich. o: { stil: 'stadt'|'dorf'|'hof'|'hafen'|'industrie'|'militaer'|
 * 'ruine', sperr: [[x,z,r]], bereich: {minX,maxX,minZ,maxZ}, dichte (1), yMax (nur Gebäude, deren Fuß darunter liegt),
 * nurBoden (true) }. Liefert die Anzahl gesetzter Stücke.
 */
export function wandkram(b, o = {}) {
  const stil = o.stil || 'stadt', k = (o.dichte ?? 1) * (DICHTE[stufe(b)] ?? 1), sperr = o.sperr || [];
  const bz = o.bereich || b.bounds, near = footGrid(b);
  const doors = [...(b.openings || []).filter((p) => p.kind === 'door' || p.kind === 'gap').map((p) => [p.x, p.z, p.w / 2 + 1.3, p.y]),
    ...(b.doors || []).map((d) => [d.hx, d.hz, (d.w || 1) + 1.0, d.y + 1])];
  const T = TABELLE[stil] || TABELLE.stadt;
  let n = 0;
  // Gebäude/Container und freistehende Mauern (≥ 1,8 m hoch, ≥ 3 m lang; bei dünnen Mauern nur die Längsseiten)
  const kinds = o.huellen || ['building'];
  const buildings = b.footprints.filter((f) => (kinds.includes(f.kind) ? f.y1 - f.y0 > 2.2 && f.hw > 1.1 && f.hd > 1.1 : o.mauern !== false && f.kind === 'wall' && f.y1 - f.y0 > 1.8 && Math.max(f.hw, f.hd) > 1.5) && f.y0 < 0.5 + (o.y ?? 0) && (o.yMax == null || f.y0 < o.yMax));
  const haeuser = b.footprints.filter((f) => f.kind === 'building');
  for (const f of buildings) {
    // Mauern, die zu einem Gebäude gehören (Außen-/Innenwände), überspringen – sonst stünde Kleinkram in Räumen
    if (f.kind === 'wall' && haeuser.some((h) => inRect(h, f.x, f.z, 0.4))) continue;
    if (f.x < bz.minX || f.x > bz.maxX || f.z < bz.minZ || f.z > bz.maxZ) continue;
    const c = Math.cos(f.ry || 0), s = Math.sin(f.ry || 0);
    const W = (lx, lz) => [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
    for (const [side, len, nx, nz] of [['n', f.hw * 2, 0, -1], ['s', f.hw * 2, 0, 1], ['e', f.hd * 2, 1, 0], ['w', f.hd * 2, -1, 0]]) {
      if (len < 2.4) continue; // Stirnseiten dünner Mauern
      const step = 2.2 / k;
      for (let t = 1.0 + hash01(f.x, f.z, side.charCodeAt(0)) * step; t < len - 1.0; t += step * (0.7 + hash01(f.x + t, f.z, 7) * 0.6)) {
        const u = t - len / 2;
        // lokale Lage an der Wand: Seiten n/s laufen entlang x, e/w entlang z
        const lx = nx ? nx * f.hw : u, lz = nz ? nz * f.hd : u;
        const h = hash01(lx + f.x, lz + f.z, 300);
        if (h > T.p) continue;
        const pick = T.items[Math.floor(hash01(lx + f.x, lz + f.z, 301) * T.items.length)];
        const off = pick.off ?? 0.32;
        const [px, pz] = W(lx + nx * off, lz + nz * off);
        const [qx, qz] = W(lx + nx * (off + 1.0), lz + nz * (off + 1.0));
        if (px < bz.minX || px > bz.maxX || pz < bz.minZ || pz > bz.maxZ) continue;
        if (sperr.some(([sx, sz2, r]) => Math.hypot(px - sx, pz - sz2) < r)) continue;
        if (doors.some(([dx, dz, r, dy]) => Math.abs(dy - f.y0 - 1) < 2 && Math.hypot(px - dx, pz - dz) < r)) continue;
        let blocked = false;
        for (const g of near(px, pz)) {
          if (g === f || g.kind === 'roof' || g.y0 > f.y0 + 1.6 || g.y1 < f.y0 + 0.05) continue;
          if (g.kind === 'floor' && g.y1 - f.y0 < 0.25) continue;
          if (inRect(g, px, pz, 0.25) || inRect(g, qx, qz, 0)) { blocked = true; break; }
        }
        if (blocked) continue;
        const ry = Math.atan2(nx * c + nz * s, -nx * s + nz * c); // lokal +z = Außennormale
        pick.fn(b, px, f.y0, pz, ry, hash01(px, pz, 302));
        n++;
      }
    }
  }
  return n;
}

const along = (ry) => ry + Math.PI / 2;
/** Kleinkram-Tabellen je Stil: p = Anteil der Wandabschnitte mit Gegenstand, items = gleich gewichtete Auswahl. */
const TABELLE = {
  stadt: {
    p: 0.72, items: [
      { fn: (b, x, y, z, ry) => muelltonne(b, x, y, z, ry), off: 0.42 },
      { fn: (b, x, y, z, ry) => { muelltonne(b, x, y, z, ry); const f = frame(b, x, y, z, ry); const [px, pz] = f.P(0.66, 0); muelltonne(b, px, y, pz, ry); }, off: 0.42 },
      { fn: (b, x, y, z, ry) => fahrrad(b, x, y, z, along(ry)), off: 0.25 },
      { fn: (b, x, y, z, ry) => blechtonne(b, x, y, z, ry), off: 0.35 },
      { fn: (b, x, y, z, ry) => getraenkekisten(b, x, y, z, ry, 2 + Math.floor(hash01(x, z, 5) * 3)), off: 0.25 },
      { fn: (b, x, y, z) => muellsaecke(b, x, y, z, 1 + Math.floor(hash01(x, z, 6) * 3)), off: 0.4 },
      { fn: (b, x, y, z, ry) => zaehlerkasten(b, x, y + 0.6, z, ry), off: 0.09 },
      { fn: (b, x, y, z, ry) => blumenkasten(b, x, y, z, ry, 0.8 + hash01(x, z, 8) * 0.6), off: 0.12 },
      { fn: (b, x, y, z, ry) => { werkzeug(b, x, y, z, ry, 3); const [ex, ez] = frame(b, x, y, z, ry).P(0.4, 0.05); eimer(b, ex, y, ez); }, off: 0.12 },
    ],
  },
  dorf: {
    p: 0.6, items: [
      { fn: (b, x, y, z, ry, h) => holzstapel(b, x, y, z, ry, 1.4 + h * 1.4, 0.9 + h * 0.6), off: 0.2 },
      { fn: (b, x, y, z, ry) => muelltonne(b, x, y, z, ry), off: 0.42 },
      { fn: (b, x, y, z, ry) => fahrrad(b, x, y, z, along(ry)), off: 0.25 },
      { fn: (b, x, y, z, ry) => werkzeug(b, x, y, z, ry), off: 0.12 },
      { fn: (b, x, y, z, ry) => { eimer(b, x, y, z); const [wx, wz] = frame(b, x, y, z, ry).P(0.5, -0.1); werkzeug(b, wx, y, wz, ry); }, off: 0.2 },
      { fn: (b, x, y, z, ry) => leiter(b, x, y, z, ry, 2.6 + hash01(x, z, 9)), off: 0.62 },
      { fn: (b, x, y, z, ry) => blumenkasten(b, x, y, z, ry, 0.8 + hash01(x, z, 8) * 0.6), off: 0.12 },
      { fn: (b, x, y, z, ry) => zaehlerkasten(b, x, y + 0.6, z, ry), off: 0.09 },
      { fn: (b, x, y, z, ry) => getraenkekisten(b, x, y, z, ry, 2), off: 0.25 },
    ],
  },
  hof: {
    p: 0.7, items: [
      { fn: (b, x, y, z, ry, h) => holzstapel(b, x, y, z, ry, 1.8 + h * 1.6, 1.0 + h * 0.6), off: 0.2 },
      { fn: (b, x, y, z, ry) => leiter(b, x, y, z, ry, 3 + hash01(x, z, 9)), off: 0.7 },
      { fn: (b, x, y, z, ry) => werkzeug(b, x, y, z, ry), off: 0.12 },
      { fn: (b, x, y, z, ry) => { eimer(b, x, y, z); const [ex, ez] = frame(b, x, y, z, ry).P(0.35, 0.1); eimer(b, ex, y, ez); }, off: 0.2 },
      { fn: (b, x, y, z, ry, h) => industrieKram(b, x, y, z, ry, 0.5 + h * 0.25), off: 0.45 },
      { fn: (b, x, y, z, ry) => muelltonne(b, x, y, z, ry), off: 0.42 },
    ],
  },
  hafen: {
    p: 0.6, items: [
      { fn: (b, x, y, z, ry, h) => industrieKram(b, x, y, z, ry, h), off: 0.5 },
      { fn: (b, x, y, z, ry, h) => industrieKram(b, x, y, z, ry, h * 0.6), off: 0.5 },
      { fn: (b, x, y, z, ry) => muelltonne(b, x, y, z, ry), off: 0.42 },
      { fn: (b, x, y, z, ry) => zaehlerkasten(b, x, y + 0.7, z, ry), off: 0.09 },
      { fn: (b, x, y, z) => muellsaecke(b, x, y, z, 2), off: 0.4 },
      { fn: (b, x, y, z, ry) => bake(b, x, y, z, ry), off: 0.3 },
    ],
  },
  industrie: {
    p: 0.62, items: [
      { fn: (b, x, y, z, ry, h) => industrieKram(b, x, y, z, ry, h), off: 0.5 },
      { fn: (b, x, y, z, ry, h) => industrieKram(b, x, y, z, ry, 0.2 + h * 0.6), off: 0.5 },
      { fn: (b, x, y, z, ry) => leiter(b, x, y, z, ry, 3.2), off: 0.75 },
      { fn: (b, x, y, z, ry) => zaehlerkasten(b, x, y + 0.7, z, ry), off: 0.09 },
      { fn: (b, x, y, z, ry) => { werkzeug(b, x, y, z, ry, 3); const [ex, ez] = frame(b, x, y, z, ry).P(0.4, 0.05); eimer(b, ex, y, ez); }, off: 0.15 },
      { fn: (b, x, y, z, ry) => muelltonne(b, x, y, z, ry), off: 0.42 },
    ],
  },
  militaer: {
    p: 0.55, items: [
      { fn: (b, x, y, z, ry) => { const f = frame(b, x, y, z, ry); for (let i = 0; i < 3; i++) { const [px, pz] = f.P(-0.5 + i * 0.5, 0); lib(b, 'ammo_box', px, y, pz, { ry: along(ry), s: 1.6 }, (bb) => bb.box(px, y, pz, 0.3, 0.2, 0.42, 'metal_painted', { ...DG, ry, tint: '#4a5236' })); } }, off: 0.3 },
      { fn: (b, x, y, z, ry, h) => industrieKram(b, x, y, z, ry, h * 0.24), off: 0.3 },
      { fn: (b, x, y, z, ry) => lib(b, 'wooden_military_crate', x, y, z, { ry: along(ry) }, (bb) => bb.box(x, y, z, 1.0, 0.5, 0.5, 'wood_crate', { ...DG, ry })), off: 0.4 },
      { fn: (b, x, y, z, ry) => werkzeug(b, x, y, z, ry, 0), off: 0.12 },
      { fn: (b, x, y, z, ry) => { const f = frame(b, x, y, z, ry); for (let i = 0; i < 4; i++) f.box(-0.75 + i * 0.5, 0, 0, 0.52, 0.16, 0.32, 'sandbag', { ...DG, ry: (hash01(x, z, i) - 0.5) * 0.2 }); }, off: 0.25 },
    ],
  },
  ruine: {
    p: 0.7, items: [
      { fn: (b, x, y, z, ry, h) => schutt(b, x, y, z, 0.8 + h * 0.9, { balken: h < 0.4 }), off: 0.7 },
      { fn: (b, x, y, z, ry, h) => schutt(b, x, y, z, 0.5 + h * 0.5), off: 0.5 },
      { fn: (b, x, y, z, ry) => ziegelstapel(b, x, y, z, ry), off: 0.5 },
      { fn: (b, x, y, z, ry, h) => industrieKram(b, x, y, z, ry, h * 0.3), off: 0.35 },
    ],
  },
};

/**
 * Hausanschlüsse an Außentüren im Erdgeschoss: Briefkasten, Hausnummer, Wandleuchte, Fußabtreter/Stufe.
 * o: { bereich, stil, sperr } – nur Türen in Gebäudewänden (eine Seite im Gebäude, die andere frei).
 */
export function tuerdetails(b, o = {}) {
  const bz = o.bereich || b.bounds, near = footGrid(b), q = DICHTE[stufe(b)] ?? 1;
  let n = 0;
  for (const p of b.openings || []) {
    if (p.kind !== 'door' || p.h < 1.8 || p.w > 2.6) continue;
    if (p.x < bz.minX || p.x > bz.maxX || p.z < bz.minZ || p.z > bz.maxZ) continue;
    if (hash01(p.x, p.z, 400) > 0.85 * Math.min(1, q + 0.2)) continue;
    // Außenseite: welche Seite liegt in einem Gebäude-Grundriss?
    const nx = -p.uz, nz = p.ux, dd = p.t / 2 + 0.5;
    const inA = near(p.x + nx * dd, p.z + nz * dd).some((f) => f.kind === 'building' && inRect(f, p.x + nx * dd, p.z + nz * dd));
    const inB = near(p.x - nx * dd, p.z - nz * dd).some((f) => f.kind === 'building' && inRect(f, p.x - nx * dd, p.z - nz * dd));
    if (inA === inB) continue;
    const sg = inA ? -1 : 1, ox = nx * sg, oz = nz * sg, ry = Math.atan2(ox, oz);
    const y0 = p.y - p.h / 2, wall = p.t / 2 + 0.005;
    const side = hash01(p.x, p.z, 401) < 0.5 ? -1 : 1, sx = p.ux * side, sz = p.uz * side;
    const off = p.w / 2 + 0.38;
    if (o.stil !== 'industrie' && o.stil !== 'militaer') {
      briefkasten(b, p.x + sx * off + ox * (wall + 0.06), y0 + 1.05, p.z + sz * off + oz * (wall + 0.06), ry);
      hausnummer(b, p.x - sx * (off - 0.08) + ox * (wall + 0.006), y0 + 1.75, p.z - sz * (off - 0.08) + oz * (wall + 0.006), ry);
    }
    wandleuchte(b, p.x - sx * (p.w / 2 + 0.25) + ox * wall, y0 + p.h + 0.15, p.z - sz * (p.w / 2 + 0.25) + oz * wall, ry);
    // Fußabtreter vor der Tür
    if (fein(b)) b.box(p.x + ox * (wall + 0.32), y0 + 0.002, p.z + oz * (wall + 0.32), Math.min(0.9, p.w - 0.2), 0.015, 0.5, 'rubber_floor', { ...DN, ry: Math.atan2(-p.uz, p.ux), tint: '#4a4440' });
    n++;
  }
  return n;
}

/**
 * Fensterleben: Vorhänge innen (seitlich an der Laibung, Stange darüber – verdecken die Öffnung nicht), außen je
 * nach Stil Blumenkästen, Rollladenkästen, Klimageräte unter dem Fenster, Satellitenschüsseln. o: { bereich, stil,
 * vorhang (Anteil), kasten, klima, sat, rollladen }.
 */
export function fensterleben(b, o = {}) {
  const bz = o.bereich || b.bounds, near = footGrid(b), q = DICHTE[stufe(b)] ?? 1;
  const P = { vorhang: 0.7, kasten: 0.3, klima: 0.1, sat: 0.06, rollladen: 0.3, ...o };
  const VORHANG = ['#d8cfb8', '#8a3a32', '#e8e4dc', '#4a5a7a', '#b8a888', '#6a7a5a', '#c8b89a'];
  let n = 0;
  for (const p of b.openings || []) {
    if (p.kind !== 'window' || p.w < 0.5 || p.w > 2.6 || p.h < 0.6) continue;
    if (p.x < bz.minX || p.x > bz.maxX || p.z < bz.minZ || p.z > bz.maxZ) continue;
    const nx = -p.uz, nz = p.ux, dd = p.t / 2 + 0.6;
    const inA = near(p.x + nx * dd, p.z + nz * dd).some((f) => f.kind === 'building' && inRect(f, p.x + nx * dd, p.z + nz * dd));
    const inB = near(p.x - nx * dd, p.z - nz * dd).some((f) => f.kind === 'building' && inRect(f, p.x - nx * dd, p.z - nz * dd));
    if (inA === inB) continue;
    const sg = inA ? -1 : 1, ox = nx * sg, oz = nz * sg, ry = Math.atan2(ox, oz), rw = Math.atan2(-p.uz, p.ux);
    const top = p.y + p.h / 2, bot = p.y - p.h / 2, h1 = hash01(p.x, p.z + p.y, 410), h2 = hash01(p.x, p.z + p.y, 411);
    // Vorhänge (innen) – Fenster mit Glas oder Wohnhaus-Stil
    if (fein(b) && (p.glass || o.stil === 'stadt' || o.stil === 'dorf') && h1 < P.vorhang * Math.min(1, q + 0.3) && !p.bars) { // Telefon: keine Vorhänge
      const t = VORHANG[Math.floor(h2 * VORHANG.length)], ix = -ox * (p.t / 2 + 0.07), iz = -oz * (p.t / 2 + 0.07);
      const ch = p.h + 0.25, cw = 0.26 + h2 * 0.12;
      for (const s of [-1, 1]) {
        const cx = p.x + p.ux * s * (p.w / 2 + cw / 2 - 0.02) + ix, cz = p.z + p.uz * s * (p.w / 2 + cw / 2 - 0.02) + iz;
        b.box(cx, top + 0.18 - ch, cz, cw, ch, 0.03, 'tarp', { ...DN, ry: rw, tint: t });
      }
      b.box(p.x + ix, top + 0.17, p.z + iz, p.w + cw * 2 + 0.1, 0.025, 0.025, 'metal_galvanized', { ...DN, ry: rw });
      n++;
    }
    const ex = ox * (p.t / 2), ez = oz * (p.t / 2);
    // Rollladenkasten (außen, über dem Fenster) – nicht bei Industriefenstern
    if (fein(b) && (o.stil === 'stadt' || o.stil === 'dorf') && h2 < P.rollladen) {
      b.box(p.x + ex + ox * 0.07, top + 0.02, p.z + ez + oz * 0.07, p.w + 0.12, 0.2, 0.14, 'plaster_white', { ...DN, ry: rw, tint: '#d8d4ca' });
      if (h1 > 0.6) b.box(p.x + ex + ox * 0.03, top - 0.35, p.z + ez + oz * 0.03, p.w - 0.04, 0.36, 0.03, 'metal_shutter', { ...DN, ry: rw, tint: '#c8c4b8' });
    }
    const h3 = hash01(p.x + 3, p.z, 412);
    if (bot > 2 && (o.stil === 'stadt' || o.stil === 'dorf') && h3 < P.kasten) { blumenkasten(b, p.x + ex + ox * 0.12, bot - 0.04, p.z + ez + oz * 0.12, ry, Math.min(1.2, p.w)); n++; }
    else if (o.stil === 'stadt' && bot > 1.5 && h3 < P.kasten + P.klima) { (b._acs || (b._acs = [])).push([p.x + ex + ox * 0.25, bot - 0.75, p.z + ez + oz * 0.25, ry]); n++; }
    else if (o.stil === 'stadt' && bot > 3 && h3 < P.kasten + P.klima + P.sat) { satschuessel(b, p.x + p.ux * (p.w / 2 + 0.5) + ex + ox * 0.05, bot + 0.2, p.z + p.uz * (p.w / 2 + 0.5) + ez + oz * 0.05, ry); n++; }
  }
  // Klimageräte gesammelt (Fotoscan exterior_aircon_unit, sonst Primitive)
  for (const [x, y, z, ry] of b._acs || []) {
    if (b.hasModel('exterior_aircon_unit') && ultra(b)) b.model('exterior_aircon_unit', x, y - 0.1, z, { part: hash01(x, z, 7) < 0.55 ? 'exterior_aircon_unit_rusted' : 'exterior_aircon_unit', ry, s: 0.8, collide: false, minimap: false });
    else { const f = frame(b, x, y, z, ry); f.box(0, 0, 0, 0.8, 0.55, 0.3, 'metal_painted', { ...DN, tint: '#d8d9d4' }); f.cyl(0.15, 0.28, 0.16, 0.18, 0.02, 'black', { ...DN, axis: 'z', seg: 12 }); }
  }
  b._acs = null;
  return n;
}

/**
 * Kabel und Wäscheleinen über Gassen: gegenüberliegende Fassaden (parallel, 3–11 m Abstand, ≥ 3 m Überdeckung)
 * bekommen 1–2 durchhängende Kabel unter der niedrigeren Traufe, im Stil „stadt“ manchmal eine Wäscheleine.
 */
export function gassenkabel(b, o = {}) {
  const bz = o.bereich || b.bounds, q = DICHTE[stufe(b)] ?? 1;
  const L = b.footprints.filter((f) => f.kind === 'building' && !(f.ry) && f.y1 - f.y0 > 4 && f.x > bz.minX && f.x < bz.maxX && f.z > bz.minZ && f.z < bz.maxZ);
  let n = 0;
  const cap = Math.round((o.max ?? 40) * q);
  for (let i = 0; i < L.length && n < cap; i++) for (let j = i + 1; j < L.length && n < cap; j++) {
    const A = L[i], B = L[j];
    for (const ax of ['x', 'z']) {
      const oth = ax === 'x' ? 'z' : 'x', hA = ax === 'x' ? A.hd : A.hw, hB = ax === 'x' ? B.hd : B.hw;
      const wA = ax === 'x' ? A.hw : A.hd, wB = ax === 'x' ? B.hw : B.hd;
      // Abstand quer (entlang oth)
      const gap = Math.abs(A[oth] - B[oth]) - hA - hB;
      if (gap < 3 || gap > 11) continue;
      const lo = Math.max(A[ax] - wA, B[ax] - wB) + 0.8, hi = Math.min(A[ax] + wA, B[ax] + wB) - 0.8;
      if (hi - lo < 3) continue;
      const yTop = Math.min(A.y1, B.y1) - 0.6, y0 = Math.max(A.y0, B.y0);
      if (yTop - y0 < 4.2) continue;
      const sA = Math.sign(B[oth] - A[oth]);
      const eA = A[oth] + sA * hA, eB = B[oth] - sA * hB;
      const k = Math.min(2, 1 + Math.floor(hash01(A.x + B.x, A.z + B.z, 420) * 2));
      for (let c = 0; c < k; c++) {
        const t = lo + (hi - lo) * hash01(A.x + c, B.z + c, 421 + c);
        const ya = yTop - 0.4 - hash01(A.x, B.x + c, 423) * 1.5, yb = ya - 0.3 + hash01(B.x, A.x + c, 424) * 0.6;
        const P1 = ax === 'x' ? [t, ya, eA + sA * 0.02] : [eA + sA * 0.02, ya, t];
        const P2 = ax === 'x' ? [t + (hash01(t, c, 1) - 0.5) * 2, yb, eB - sA * 0.02] : [eB - sA * 0.02, yb, t + (hash01(t, c, 1) - 0.5) * 2];
        if (o.stil === 'stadt' && c === 0 && hash01(A.x, B.z, 425) < 0.35) {
          const P1b = [...P1], P2b = [...P2]; P1b[1] = P2b[1] = y0 + 3.6 + hash01(B.x, B.z, 426) * 2.5;
          if (P1b[1] < yTop - 0.3) laundryLine(b, P1b, P2b);
        }
        cable(b, P1, P2, { sag: 0.35 + gap * 0.04, r: 0.012, segments: 6 });
        n++;
      }
    }
  }
  return n;
}

function laundryLine(b, a, c) {
  cable(b, a, c, { sag: 0.25, r: 0.006, segments: 6 });
  const n = 3 + Math.floor(hash01(a[0], a[2], 430) * 4), ry = Math.atan2(-(c[2] - a[2]), c[0] - a[0]);
  const cols = ['#e8e4dc', '#2f6f9a', '#c8402f', '#e0a32c', '#7aa0c8', '#f2f0ea', '#5c8a5a'];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.7) / (n + 0.4);
    const w = 0.35 + hash01(a[0], i, 431) * 0.4, hh = 0.4 + hash01(a[2], i, 432) * 0.45;
    const x = a[0] + (c[0] - a[0]) * t, z = a[2] + (c[2] - a[2]) * t, y = a[1] + (c[1] - a[1]) * t - Math.sin(Math.PI * t) * 0.25;
    b.box(x, y - hh, z, w, hh, 0.012, 'tarp', { ...DN, ry, tint: cols[Math.floor(hash01(x, z, 433) * cols.length)] });
  }
}

/**
 * Dachleben auf Flachdächern (Grundriss „building“ mit Brüstung/Attika): Antennen, Satellitenschüssel, Lüfterrohre,
 * Klimagerät in einer Ecke, Kabel. Nur Optik; nur Dächer im Bereich. o: { bereich, nurFlach (Liste) }
 */
export function dachleben(b, o = {}) {
  const bz = o.bereich || b.bounds, q = DICHTE[stufe(b)] ?? 1;
  let n = 0;
  for (const r of b._flachdaecher || []) {
    if (r.x < bz.minX || r.x > bz.maxX || r.z < bz.minZ || r.z > bz.maxZ) continue;
    const hh = hash01(r.x, r.z, 440);
    if (hh > 0.8 * Math.min(1, q + 0.2)) continue;
    const m = r.inset + 0.45, cx = [r.x0 + m, r.x1 - m], cz = [r.z0 + m, r.z1 - m];
    const k = Math.floor(hash01(r.x, r.z, 441) * 4);
    // Antenne an einer Ecke
    antenne(b, cx[k & 1], r.y, cz[k >> 1], 1.8 + hash01(r.x, r.z, 442) * 1.2);
    // Lüftungsrohre
    for (let i = 0; i < 2; i++) {
      const px = r.x0 + m + (r.x1 - r.x0 - 2 * m) * hash01(r.x, i, 443), pz = r.z0 + m + (r.z1 - r.z0 - 2 * m) * hash01(r.z, i, 444);
      b.cyl(px, r.y, pz, 0.07, 0.6, 'metal_galvanized', { ...DN, seg: 8 });
      b.cyl(px, r.y + 0.6, pz, 0.12, 0.08, 'metal_galvanized', { ...DN, seg: 8 });
    }
    if ((r.x1 - r.x0) * (r.z1 - r.z0) > 30 && fein(b)) {
      const j = (k + 2) % 4, ax = cx[j & 1], az = cz[j >> 1];
      const ry = Math.atan2(r.x - ax, r.z - az);
      if (b.hasModel('exterior_aircon_unit') && ultra(b)) b.model('exterior_aircon_unit', ax, r.y, az, { ry, s: 0.9, collide: false, minimap: false });
      else { const f = frame(b, ax, r.y, az, ry); f.box(0, 0, 0, 0.9, 0.62, 0.36, 'metal_painted', { ...DG, tint: '#d8d9d4' }); }
      if (hash01(r.x, r.z, 445) < 0.5) satschuessel(b, cx[(j + 1) & 1], r.y, cz[((j + 1) & 3) >> 1], Math.atan2(r.x - cx[(j + 1) & 1], r.z - cz[((j + 1) & 3) >> 1]) + Math.PI);
    }
    n++;
  }
  return n;
}

/**
 * Bodenmarken auf freien, ebenen Flächen (o.y, Standard 0): Kanaldeckel, Straßeneinläufe (Gullys) nahe an
 * Gebäudekanten, Flickstellen und Risse im Belag. Nur flach (keine Hindernisse, nur Optik). o: { bereich, sperr,
 * asphalt (Flickstellen), raster (9 m) }
 */
export function bodenmarken(b, o = {}) {
  const bz = o.bereich || b.bounds, near = footGrid(b), y = o.y ?? 0, step = o.raster ?? 9, q = DICHTE[stufe(b)] ?? 1;
  let n = 0;
  for (let z = bz.minZ + step / 2; z < bz.maxZ; z += step) for (let x = bz.minX + step / 2; x < bz.maxX; x += step) {
    const px = x + (hash01(x, z, 460) - 0.5) * step * 0.8, pz = z + (hash01(x, z, 461) - 0.5) * step * 0.8;
    const h = hash01(px, pz, 462);
    if (h > 0.5) continue;
    const fs = near(px, pz);
    if (fs.some((f) => f.y1 > y + 0.04 && f.y0 < y + 2 && inRect(f, px, pz, 0.9))) continue;
    // Nähe zu einer Gebäudekante (Gully an der Rinne)?
    const edge = fs.find((f) => f.kind === 'building' && inRect(f, px, pz, 2.2));
    const sperrt = (o.sperr || []).some(([sx, sz, r]) => Math.hypot(px - sx, pz - sz) < r * 0.6);
    if (edge && h < 0.3) {
      // an die Kante rücken: 0,9 m vor die Wand
      const c = Math.cos(edge.ry || 0), s = Math.sin(edge.ry || 0), dx = px - edge.x, dz = pz - edge.z;
      let lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) / edge.hw > Math.abs(lz) / edge.hd) lx = Math.sign(lx) * (edge.hw + 0.9); else lz = Math.sign(lz) * (edge.hd + 0.9);
      const gx = edge.x + lx * c + lz * s, gz = edge.z - lx * s + lz * c;
      if (!fs.some((f) => f !== edge && f.y1 > y + 0.04 && inRect(f, gx, gz, 0.5))) { gully(b, gx, y, gz, (edge.ry || 0) + (Math.abs(lx) > edge.hw ? Math.PI / 2 : 0)); n++; }
    } else if (h < 0.14 && !sperrt) { kanaldeckel(b, px, y, pz); n++; }
    else if (o.asphalt && h < 0.24) {
      // Fahrbahnfarbe: Pfeil, Sperrfläche oder Haltelinie (vom Verkehr abgefahren)
      const k2 = hash01(px, pz, 466), ry = Math.round(hash01(px, pz, 467) * 4) * Math.PI / 2;
      if (k2 < 0.4) b.decal(px, y + 0.011, pz, 1.1, 3.2, 'arrow', { ry, tint: k2 < 0.2 ? '#f0eee6' : '#e8c22c', opacity: 0.75, kind: 'paint' });
      else if (k2 < 0.7) b.decal(px, y + 0.011, pz, 3.0, 2.2, 'hatch', { ry, tint: '#e8c22c', opacity: 0.7, kind: 'paint' });
      else b.decal(px, y + 0.011, pz, 4.0, 0.25, 'line', { ry, tint: '#f0eee6', opacity: 0.75, kind: 'paint' });
      n++;
    } else if (o.asphalt && h < 0.38 && fein(b)) {
      const w = 1.2 + hash01(px, pz, 463) * 2.5, d = 0.8 + hash01(px, pz, 464) * 1.8;
      b.decal(px, y + 0.011, pz, w, d, 'stain', { ry: Math.round(hash01(px, pz, 465) * 4) * Math.PI / 2 + 0.02, tint: '#2a2a28', opacity: 0.38, kind: 'grime' });
      n++;
    } else if (h < 0.5 * Math.min(1, q + 0.2)) { b.decal(px, y + 0.012, pz, 1.5 + h * 3, 1.5 + h * 2, 'cracks', { ry: h * 20, opacity: 0.7 }); n++; }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Einrichtung leerer Räume
// ---------------------------------------------------------------------------
/** Möbel: L = Breite an der Wand, D = Tiefe, H = Höhe (Kollision ab H > 0.6), fn baut das Stück (Unterkante-Mitte,
 *  lokal +z in den Raum). */
const MOEBEL = {
  schrank: { L: 1.0, D: 0.6, H: 2.0, fn: (b, x, y, z, ry) => {
    const f = frame(b, x, y, z, ry), t = ['#7a5a3a', '#8a6a4a', '#d8d0c0', '#5a4636'][Math.floor(hash01(x, z, 800) * 4)];
    f.box(0, 0, 0, 1.0, 2.0, 0.6, 'wood_painted', { ...DG, tint: t });
    f.box(0, 0.05, 0.302, 0.01, 1.9, 0.01, 'black', DN);
    for (const sx of [-0.06, 0.06]) f.box(sx, 1.0, 0.31, 0.02, 0.14, 0.02, 'metal_galvanized', DN);
    f.box(0, 2.0, 0, 1.04, 0.04, 0.62, 'wood_painted', { ...DN, tint: t });
  } },
  kommode: { L: 1.2, D: 0.62, H: 1.18, fn: (b, x, y, z, ry) => lib(b, 'painted_wooden_cabinet', x, y, z, { ry }, (bb) => { const f = frame(bb, x, y, z, ry); f.box(0, 0, 0, 1.2, 0.9, 0.55, 'wood_painted', { ...DG, tint: '#8a6a4a' }); for (let k = 0; k < 3; k++) f.box(0, 0.1 + k * 0.27, 0.276, 1.1, 0.23, 0.01, 'wood_dark', DN); }) },
  regal: { L: 0.55, D: 0.37, H: 1.12, fn: (b, x, y, z, ry) => lib(b, 'painted_wooden_shelves', x, y, z, { ry }, (bb) => { const f = frame(bb, x, y, z, ry); for (const sx of [-0.25, 0.25]) f.box(sx, 0, 0, 0.03, 1.1, 0.36, 'wood_planks', DG); for (let k = 0; k < 4; k++) f.box(0, 0.05 + k * 0.33, 0, 0.5, 0.025, 0.36, 'wood_planks', DN); }) },
  buecherregal: { L: 1.0, D: 0.35, H: 1.9, fn: (b, x, y, z, ry) => {
    const f = frame(b, x, y, z, ry), t = '#6a5038';
    for (const sx of [-0.49, 0.49]) f.box(sx, 0, 0, 0.03, 1.9, 0.35, 'wood_dark', { ...DG, tint: t });
    f.box(0, 0, -0.16, 1.0, 1.9, 0.02, 'wood_dark', { ...DN, tint: t });
    for (let k = 0; k < 5; k++) {
      f.box(0, 0.04 + k * 0.38, 0, 0.96, 0.025, 0.34, 'wood_dark', { ...DN, tint: t });
      if (k < 4 && fein(b)) for (let i = 0; i < 8; i++) { const hh = 0.2 + hash01(x + i, z + k, 801) * 0.1; if (hash01(x + k, z + i, 802) < 0.2) continue; f.box(-0.4 + i * 0.11, 0.065 + k * 0.38, 0.02, 0.07 + hash01(i, k, 803) * 0.04, hh, 0.24, 'tarp', { ...DN, tint: ['#7a2a20', '#2a4a6a', '#3a5a3a', '#c8b890', '#5a3a5a', '#2a2a2a'][Math.floor(hash01(x + i, k, 804) * 6)] }); }
    }
  } },
  bett: { L: 0.95, D: 2.02, H: 0.62, fn: (b, x, y, z, ry) => {
    const f = frame(b, x, y, z, ry);
    const [bx, bz] = f.P(0, 1.0);
    lib(b, 'old_bed_frame', bx, y, bz, { ry }, (bb) => { const g = frame(bb, x, y, z, ry); g.box(0, 0, 1.0, 0.92, 0.35, 2.0, 'wood_dark', DG); g.box(0, 0, 0.03, 0.92, 1.0, 0.06, 'wood_dark', DG); });
    f.box(0, 0.35, 1.0, 0.86, 0.18, 1.92, 'tarp', { ...DN, tint: '#e8e2d4' });
    f.box(0, 0.5, 1.15, 0.88, 0.06, 1.4, 'tarp', { ...DN, tint: ['#6a7a9a', '#9a5a4a', '#7a8a6a', '#c8b898'][Math.floor(hash01(x, z, 805) * 4)] });
    f.box(0, 0.52, 0.28, 0.6, 0.12, 0.38, 'tarp', { ...DN, tint: '#f0ece2' });
  } },
  herd: { L: 0.52, D: 0.65, H: 0.86, kueche: true, fn: (b, x, y, z, ry) => lib(b, 'electric_stove', x, y, z, { ry }, (bb) => { const f = frame(bb, x, y, z, ry); f.box(0, 0, 0, 0.5, 0.85, 0.6, 'white', { ...DG, tint: '#e8e6e0' }); f.box(0, 0.86, 0, 0.5, 0.01, 0.6, 'black', DN); }) },
  kueche: { L: 1.8, D: 0.62, H: 0.92, kueche: true, fn: (b, x, y, z, ry) => {
    const f = frame(b, x, y, z, ry), t = ['#e8e4da', '#9aa88a', '#c8b898'][Math.floor(hash01(x, z, 806) * 3)];
    f.box(0, 0, 0, 1.8, 0.86, 0.6, 'wood_painted', { ...DG, tint: t });
    f.box(0, 0.86, 0.01, 1.82, 0.04, 0.62, 'concrete', { ...DN, tint: '#8a8680' });
    for (let k = 0; k < 3; k++) f.box(-0.6 + k * 0.6, 0.1, 0.301, 0.56, 0.7, 0.01, 'wood_painted', { ...DN, tint: t });
    f.box(0.4, 0.88, 0.05, 0.5, 0.05, 0.36, 'metal_galvanized', DN); // Spüle
    f.box(0, 1.45, -0.12, 1.8, 0.7, 0.35, 'wood_painted', { ...DN, tint: t }); // Hängeschrank
    if (fein(b)) { f.cyl(-0.5, 0.9, 0.05, 0.1, 0.12, 'metal_galvanized', { ...DN, seg: 10 }); f.cyl(-0.2, 0.9, 0.1, 0.05, 0.1, 'white', { ...DN, seg: 8, tint: '#d8d0c0' }); }
  } },
  tisch: { L: 1.6, D: 1.15, H: 0.78, stuehle: true, fn: (b, x, y, z, ry) => {
    const f = frame(b, x, y, z, ry);
    const [tx, tz] = f.P(0, 0.58);
    lib(b, 'painted_wooden_table', tx, y, tz, { ry, sx: 0.66, sy: 0.8, sz: 0.85 }, (bb) => { const g = frame(bb, x, y, z, ry); g.box(0, 0.72, 0.58, 1.55, 0.05, 0.9, 'wood_planks', { ...DN, tint: '#a8845e' }); for (const sx of [-0.7, 0.7]) for (const sz of [0.2, 0.96]) g.box(sx, 0, sz, 0.06, 0.72, 0.06, 'wood_dark', DN); });
    for (const sx of [-0.45, 0.45]) { const [cx, cz] = f.P(sx, 1.35); lib(b, 'painted_wooden_chair_01', cx, y, cz, { ry: ry + Math.PI + (hash01(cx, cz, 807) - 0.5) * 0.4 }, (bb) => { const g = frame(bb, cx, y, cz, ry + Math.PI); g.box(0, 0.44, 0, 0.42, 0.04, 0.42, 'wood_planks', DN); g.box(0, 0.48, -0.19, 0.42, 0.45, 0.03, 'wood_planks', DN); for (const a of [-0.18, 0.18]) for (const c of [-0.18, 0.18]) g.box(a, 0, c, 0.03, 0.44, 0.03, 'wood_dark', DN); }); }
  } },
  schreibtisch: { L: 2.0, D: 0.95, H: 0.79, buero: true, fn: (b, x, y, z, ry) => {
    const f = frame(b, x, y, z, ry), [cx, cz] = f.P(0, 0.47);
    lib(b, 'metal_office_desk', cx, y, cz, { ry }, (bb) => { const g = frame(bb, x, y, z, ry); g.box(0, 0.74, 0.47, 2.0, 0.045, 0.94, 'wood_planks', { ...DN, tint: '#8a7a62' }); g.box(-0.72, 0, 0.47, 0.5, 0.74, 0.9, 'metal_painted', { ...DG, tint: '#6f7a80' }); });
    f.box(0.2, 0.79, 0.25, 0.5, 0.32, 0.04, 'polymer', { ...DN, tint: '#1e2023' });
    f.box(-0.5, 0.79, 0.5, 0.24, 0.06, 0.32, 'white', { ...DN, tint: '#ece8dc' });
    const [sx, sz] = f.P(0.1, 1.3);
    lib(b, 'schoolchair_01', sx, y, sz, { ry: ry + Math.PI }, null);
  } },
  stahlregal: { L: 1.1, D: 0.5, H: 2.14, lager: true, fn: (b, x, y, z, ry) => lib(b, 'steel_frame_shelves_01', x, y, z, { ry }, (bb) => { const f = frame(bb, x, y, z, ry); for (const sx of [-0.52, 0.52]) f.box(sx, 0, 0, 0.04, 2.1, 0.5, 'metal_galvanized', DG); for (let k = 0; k < 5; k++) f.box(0, 0.1 + k * 0.48, 0, 1.06, 0.03, 0.48, 'metal_galvanized', DN); }) },
};
const RAUM = {
  wohn: ['schrank', 'kommode', 'regal', 'bett', 'buecherregal', 'tisch', 'kommode', 'regal'],
  erdgeschoss: ['kueche', 'herd', 'tisch', 'kommode', 'regal', 'buecherregal', 'schrank'],
  buero: ['schreibtisch', 'stahlregal', 'regal', 'schreibtisch', 'kommode'],
  lager: ['stahlregal', 'stahlregal', 'regal', 'kommode'],
};

/**
 * Laufweg-Raster eines Raums (0,2 m): frei = Kapselmitte passt (Abstand ≥ 0,38 m zu Wänden/Einbauten wie die Navigation, neue Möbel mit
 * 0,55 m Sicherheitsrand).
 * Anker = Türlaibungen (innen) und Treppen-/Deckenlöcher; erreichbar = Flutfüllung ab den Ankern.
 * passt(cx, cz, hx, hz): würde ein Möbel (achsenparalleles Rechteck) keinen bisher erreichbaren Bereich abschneiden und
 * keinen Anker belegen? setze(): Möbel eintragen. null, wenn der Raum keinen Anker hat.
 */
function laufRaster(ix0, iz0, ix1, iz1, fy, doors, holes, blocks, tris = null) {
  const C = 0.2, R = 0.38, RF = 0.55, nx = Math.max(1, Math.round((ix1 - ix0) / C)), nz = Math.max(1, Math.round((iz1 - iz0) / C)), N = nx * nz;
  const X = (i) => ix0 + (i + 0.5) * C, Z = (j) => iz0 + (j + 0.5) * C;
  const blk = new Uint8Array(N), anchor = new Uint8Array(N);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = X(i), z = Z(j), o = j * nx + i;
    if (x - ix0 < R || ix1 - x < R || z - iz0 < R || iz1 - z < R) blk[o] = 1;
    for (const f of blocks) {
      const c = Math.cos(f.ry || 0), sn = Math.sin(f.ry || 0), px = x - f.x, pz = z - f.z;
      const lx = px * c - pz * sn, lz = px * sn + pz * c;
      if (Math.abs(lx) < f.hw + R && Math.abs(lz) < f.hd + R) { blk[o] = 1; break; }
    }
  }
  // Kollisionsdreiecke im Raum zwischen Knie- und Kopfhöhe (Geländer, unsichtbare Kollisionsquader ohne Grundriss)
  if (tris) {
    const T = tris.a, nT = tris.n;
    for (let k = 0; k < nT; k += 9) {
      const y0 = Math.min(T[k + 1], T[k + 4], T[k + 7]), y1 = Math.max(T[k + 1], T[k + 4], T[k + 7]);
      if (y1 < fy + 0.3 || y0 > fy + 1.7) continue;
      const a0 = Math.min(T[k], T[k + 3], T[k + 6]) - R, a1 = Math.max(T[k], T[k + 3], T[k + 6]) + R;
      const c0 = Math.min(T[k + 2], T[k + 5], T[k + 8]) - R, c1 = Math.max(T[k + 2], T[k + 5], T[k + 8]) + R;
      if (a1 < ix0 || a0 > ix1 || c1 < iz0 || c0 > iz1) continue;
      // große schräge Flächen (Treppenrampen) nur grob: Hülle; sonst wäre der Raum ohnehin dicht
      const i0 = Math.max(0, Math.ceil((a0 - ix0) / C - 0.5)), i1 = Math.min(nx - 1, Math.floor((a1 - ix0) / C - 0.5));
      const j0 = Math.max(0, Math.ceil((c0 - iz0) / C - 0.5)), j1 = Math.min(nz - 1, Math.floor((c1 - iz0) / C - 0.5));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blk[j * nx + i] = 1;
    }
  }
  // Türen: Laibung ins Rauminnere als Anker (immer frei); Löcher (Treppenaustritt) ebenso
  for (const d of doors) {
    const half = d.w / 2 - 0.05;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = X(i), z = Z(j), o = j * nx + i;
      const inn = d.ax ? Math.abs(z - d.z) : Math.abs(x - d.x), along = d.ax ? Math.abs(x - d.x) : Math.abs(z - d.z);
      if (along < half && inn < R + 0.45) { anchor[o] = 1; blk[o] = 0; }
    }
  }
  for (const h of holes) {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = X(i), z = Z(j);
      const o = j * nx + i;
      // Loch im Boden dieses Geschosses: nicht begehbar (Kapselrand R); Rand rundum = Treppenaustritt (Anker)
      if (x > h.x0 - R && x < h.x1 + R && z > h.z0 - R && z < h.z1 + R) { blk[o] = 1; anchor[o] = 0; }
      else if (x > h.x0 - R - 0.7 && x < h.x1 + R + 0.7 && z > h.z0 - R - 0.7 && z < h.z1 + R + 0.7 && !blk[o]) anchor[o] = 1;
    }
  }
  // Treppenfuß (Treppen-Grundriss im Raum): Zellen direkt daneben sind Anker
  for (const f of blocks) {
    if (f.kind !== 'stairs' || f.y0 > fy + 0.3) continue;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = X(i), z = Z(j), o = j * nx + i;
      if (blk[o]) continue;
      const c = Math.cos(f.ry || 0), sn = Math.sin(f.ry || 0), px = x - f.x, pz = z - f.z;
      const lx = px * c - pz * sn, lz = px * sn + pz * c;
      // Lauflänge entlang lokal z (arch.stairs: ry = Aufstiegsrichtung): Antritt und Austritt je 1,4 m frei
      if (Math.abs(lx) < f.hw + R + 0.35 && Math.abs(lz) < f.hd + R + 1.4) anchor[o] = 1;
    }
  }
  if (!anchor.some((a) => a)) return null;
  const reach = new Uint8Array(N), stack = new Int32Array(N);
  // Flutfüllung je Zusammenhangskomponente ab den Ankern: Anzahl der Komponenten (getrennte Laufbereiche) + Zellen
  const flood = (extra) => {
    reach.fill(0);
    let n = 0, comps = 0;
    for (let s0 = 0; s0 < N; s0++) {
      if (!anchor[s0] || reach[s0] || blk[s0] || (extra && extra[s0])) continue;
      comps++;
      let sp = 0; reach[s0] = 1; stack[sp++] = s0; n++;
      while (sp) {
        const o = stack[--sp], i = o % nx, j = (o / nx) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
          const q = jj * nx + ii;
          if (reach[q] || blk[q] || (extra && extra[q])) continue;
          reach[q] = 1; stack[sp++] = q; n++;
        }
      }
    }
    flood.comps = comps;
    return n;
  };
  let base = flood(null), baseComps = flood.comps, baseReach = reach.slice();
  // Umfeld der Anker (1 m): Navigationsknoten liegen im 1,5-m-Raster – Möbel direkt an Tür-/Treppenaustritten
  // schneiden dort Verbindungen ab, auch wenn das feine Raster noch einen Spalt sieht
  const nahe = new Uint8Array(N), D = 5;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (!anchor[j * nx + i]) continue;
    for (let jj = Math.max(0, j - D); jj <= Math.min(nz - 1, j + D); jj++) for (let ii = Math.max(0, i - D); ii <= Math.min(nx - 1, i + D); ii++) nahe[jj * nx + ii] = 1;
  }
  const cellsOf = (cx, cz, hx, hz) => {
    const m = new Uint8Array(N);
    let any = false;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = X(i), z = Z(j);
      if (Math.abs(x - cx) < hx + RF && Math.abs(z - cz) < hz + RF) { m[j * nx + i] = 1; any = true; }
    }
    return any ? m : null;
  };
  return {
    passt(cx, cz, hx, hz) {
      const m = cellsOf(cx, cz, hx, hz);
      if (!m) return true;
      let covered = 0;
      for (let o = 0; o < N; o++) if (m[o]) { if (anchor[o] || nahe[o]) return false; if (baseReach[o]) covered++; }
      // alles bisher Erreichbare außer der Möbelfläche selbst muss erreichbar bleiben, ohne neue getrennte Bereiche
      const n = flood(m);
      return n >= base - covered && flood.comps <= baseComps;
    },
    setze(cx, cz, hx, hz) {
      const m = cellsOf(cx, cz, hx, hz);
      if (!m) return;
      for (let o = 0; o < N; o++) if (m[o]) blk[o] = 1;
      base = flood(null); baseComps = flood.comps; baseReach = reach.slice();
    },
  };
}

/**
 * Leere, begehbare Räume einrichten (Gebäude aus arch.building(), b._gebaeude): Möbel an den Wänden – Türbereiche
 * (1,1 m), Treppenlöcher/Treppen (1,2 m), vorhandene Möbel/Deckung und Kampagnen-/Startpunkte bleiben frei; hohe
 * Möbel nicht vor Fenstern. Räume mit schon ≥ 2 Möbeln oder Bibliotheksmodellen bleiben, wie sie sind. Große Möbel
 * mit Kollision (unabhängig von der Grafikstufe → Mehrspieler gleich; Navigation tastet sie mit ab), Kleinkram ohne.
 * o: { stil: 'wohn'|'buero'|'lager', bereich, sperr, minFlaeche (12 m²) }
 */
export function einrichten(b, o = {}) {
  const bz = o.bereich || b.bounds, sperr = o.sperr || [], near = footGrid(b);
  let raeume = 0, stuecke = 0;
  const grund = {};
  const nein = (k) => { grund[k] = (grund[k] || 0) + 1; };
  for (const g of b._gebaeude || []) {
    if (!g.interior || g.w < 3.8 || g.d < 3.8 || g.w * g.d < (o.minFlaeche ?? 12) || g.w * g.d > (o.maxFlaeche ?? 140)) { nein('groesse'); continue; }
    if (g.x < bz.minX || g.x > bz.maxX || g.z < bz.minZ || g.z > bz.maxZ) { nein('bereich'); continue; }
    if (/wood/.test(g.mat) && o.holz !== true) { nein('holz'); continue; } // Schuppen/Scheunen
    const ix0 = g.x - g.w / 2 + g.t, ix1 = g.x + g.w / 2 - g.t, iz0 = g.z - g.d / 2 + g.t, iz1 = g.z + g.d / 2 - g.t;
    for (let li = 0; li < g.levels.length; li++) {
      const fy = g.levels[li], ceil = li + 1 < g.levels.length ? g.levels[li + 1] - 0.3 : g.roofY - 0.3;
      if (ceil - fy < 2.3) { nein('decke'); continue; }
      // nicht begehbar (noNav über dem Boden)?
      if (b.navExclude.some((e) => e.minX <= g.x && e.maxX >= g.x && e.minZ <= g.z && e.maxZ >= g.z && e.minY <= fy + 0.6 && e.maxY >= fy + 1.6)) { nein('noNav'); continue; }
      // schon eingerichtet?
      const inside = (x, z) => x > ix0 && x < ix1 && z > iz0 && z < iz1;
      const vorh = b.footprints.filter((f) => (f.kind === 'cover' || f.kind === 'prop') && inside(f.x, f.z) && f.y0 > fy - 0.3 && f.y0 < fy + 1.2).length
        // Bibliotheksmodelle nur, wenn sie unabhängig von der Bibliothek stehen (mit Ersatzform) – sonst hinge die
        // Einrichtung (und ihre Kollision) davon ab, ob das Gerät die Bibliothek lädt (Mehrspieler!)
        + b.models.filter((m) => m.o && m.o.fallback && inside(m.x, m.z) && m.y > fy - 0.3 && m.y < fy + 1.2).length;
      if (vorh >= (o.voll ?? 5)) { nein('moebliert'); continue; }
      // Sperrflächen: Türen (innen 1,1 m), Löcher/Treppen, vorhandene Einbauten
      const doors = [], wins = [];
      for (const op of g.openings) {
        if ((op.floor ?? 0) !== li) continue;
        const ax = op.side === 'n' || op.side === 's', px = ax ? g.x + op.at : (op.side === 'e' ? ix1 : ix0), pz = ax ? (op.side === 'n' ? iz0 : iz1) : g.z + op.at;
        const kind = op.kind || 'door';
        (kind === 'window' ? wins : doors).push({ x: px, z: pz, w: op.w, ax });
      }
      const holes = g.holes.filter((h) => (h.floor ?? 1) === li || (h.floor ?? 1) === li + 1);
      const blocks = b.footprints.filter((f) => f.kind !== 'building' && f.kind !== 'roof' && f.kind !== 'floor' && f.y1 > fy + 0.1 && f.y0 < fy + 2 && Math.abs(f.x - g.x) < g.w / 2 + 2 && Math.abs(f.z - g.z) < g.d / 2 + 2);
      // gelaende (Runde 3): Laufweg-Raster des Raums – Möbel dürfen keinen Durchgang schließen und keine Nische
      // abschneiden (früher standen sie in Innen-Durchgängen und erzeugten unerreichbare Nav-Inseln)
      const lauf = laufRaster(ix0, iz0, ix1, iz1, fy, doors, g.holes.filter((h) => (h.floor ?? 1) === li), blocks, b.colTris);
      if (!lauf) { nein('keinZugang'); continue; } // kein erkennbarer Zugang (Tür/Treppe) → Raum nicht anfassen
      const sorte = RAUM[o.stil === 'buero' ? 'buero' : o.stil === 'lager' ? 'lager' : li === 0 ? 'erdgeschoss' : 'wohn'];
      let placed = 0, kueche = false;
      const mine = [];
      const walls = [['n', ix0, ix1, iz0, 0, 1], ['s', ix0, ix1, iz1, 0, -1], ['w', iz0, iz1, ix0, 1, 0], ['e', iz0, iz1, ix1, -1, 0]];
      for (const [side, a0, a1, c, nx, nz] of walls) {
        let cur = a0 + 0.2, k = Math.floor(hash01(g.x + side.charCodeAt(0), g.z + li, 810) * sorte.length);
        let guard = 0;
        while (cur < a1 - 0.5 && guard++ < 20 && placed < 6) {
          const id = sorte[k++ % sorte.length], M = MOEBEL[id];
          if ((M.kueche && kueche) || (M.stuehle && placed === 0 && hash01(g.x, g.z, 811) < 0.3)) { continue; }
          const L = M.L, Dp = M.D;
          if (cur + L > a1 - 0.2) { cur += 0.5; continue; }
          const u = cur + L / 2;
          // Rechteck (achsenparallel) in Welt
          const along = nx === 0; // Wand n/s läuft entlang x
          const cx = along ? u : c + nx * (Dp / 2 + 0.02), cz = along ? c + nz * (Dp / 2 + 0.02) : u;
          const hx = along ? L / 2 : Dp / 2, hz = along ? Dp / 2 : L / 2;
          const hit = (x, z, m) => Math.abs(x - cx) < hx + m && Math.abs(z - cz) < hz + m;
          let ok = !doors.some((d) => { const dx = d.ax ? d.x : d.x + (d.x === ix0 ? 1 : -1) * 0.6, dz = d.ax ? d.z + (d.z === iz0 ? 1 : -1) * 0.6 : d.z; return Math.abs(dx - cx) < hx + (d.ax ? d.w / 2 + 0.6 : 0.9) && Math.abs(dz - cz) < hz + (d.ax ? 0.9 : d.w / 2 + 0.6); });
          if (ok && M.H > 0.95) ok = !wins.some((w) => hit(w.x, w.z, w.w / 2 + 0.05));
          if (ok) ok = !holes.some((h) => cx + hx > h.x0 - 1.2 && cx - hx < h.x1 + 1.2 && cz + hz > h.z0 - 1.2 && cz - hz < h.z1 + 1.2);
          if (ok) ok = !blocks.some((f) => {
            // gedrehter Grundriss → achsenparalleler Hüllquader; Wände ohne Rand (Außenwände enden an der Innenkante)
            const c = Math.abs(Math.cos(f.ry || 0)), sn = Math.abs(Math.sin(f.ry || 0)), ex = c * f.hw + sn * f.hd, ez = sn * f.hw + c * f.hd, m = f.kind === 'wall' ? 0 : 0.3;
            return Math.abs(f.x - cx) < hx + ex + m && Math.abs(f.z - cz) < hz + ez + m;
          });
          if (ok) ok = !mine.some((r) => Math.abs(r[0] - cx) < hx + r[2] + 0.2 && Math.abs(r[1] - cz) < hz + r[3] + 0.2);
          if (ok) ok = !sperr.some(([sx, sz, r]) => Math.abs(sx - cx) < hx + Math.min(r, 1.6) && Math.abs(sz - cz) < hz + Math.min(r, 1.6));
          // Gegenwand muss weit genug weg sein (Durchgang ≥ 1,6 m)
          if (ok) ok = (along ? (iz1 - iz0) : (ix1 - ix0)) - Dp >= 1.6;
          if (ok && M.H > 0.6) ok = lauf.passt(cx, cz, hx, hz);
          if (!ok) { cur += 0.45; continue; }
          if (M.H > 0.6) lauf.setze(cx, cz, hx, hz);
          const ry = Math.atan2(nx, nz);
          const [wx, wz] = along ? [u, c] : [c, u];
          M.fn(b, wx, fy, wz, ry);
          if (M.H > 0.6) {
            b.box(cx, fy, cz, hx * 2 - 0.04, Math.min(M.H, 1.9), hz * 2 - 0.04, 'black', { visual: false, minimap: false });
            // keine Navigationsknoten auf Möbeloberseiten (Tische, Kommoden: sonst unerreichbare Inseln)
            b.noNav(cx - hx - 0.15, cz - hz - 0.15, cx + hx + 0.15, cz + hz + 0.15, fy + 0.3, fy + 2.3);
          }
          if (M.kueche) kueche = true;
          mine.push([cx, cz, hx, hz]);
          if (o.protokoll) o.protokoll.push([id, +cx.toFixed(2), +fy.toFixed(2), +cz.toFixed(2), +hx.toFixed(2), +hz.toFixed(2)]);
          placed++; stuecke++;
          cur += L + 0.25 + hash01(cx, cz, 812) * 0.6;
        }
      }
      if (placed) raeume++;
    }
  }
  return { raeume, stuecke, grund };
}

/**
 * Alles zusammen am Ende eines Kartenaufbaus: wandkram, tuerdetails, fensterleben, gassenkabel (Stil stadt/dorf),
 * dachleben. o wie die Einzelfunktionen. Liefert die Zählung (für das Debug-Log).
 */
export function belebe(b, o = {}) {
  const t0 = performance.now();
  // Einrichtung zuerst: sie zählt vorhandene Möbel – Kleinkram dieses Moduls (je Stufe verschieden) darf das nicht beeinflussen
  // Einrichtung leerer Räume nur auf Wunsch (o.einrichten: true) – auf dem Hafen erzeugte sie unerreichbare Nav-Inseln
  const res = { innen: o.einrichten === true ? einrichten(b, { ...o, stil: o.raum || (o.stil === 'industrie' || o.stil === 'hafen' ? 'buero' : o.stil === 'militaer' ? 'lager' : 'wohn') }) : null };
  if (res.innen && globalThis.location?.search?.includes('debug=1')) console.info(`[gelaende] Einrichtung (${o.stil}): ${res.innen.raeume} Räume, ${res.innen.stuecke} Möbel ${JSON.stringify(res.innen.grund)}`);
  Object.assign(res, { wand: wandkram(b, o), tuer: tuerdetails(b, o), fenster: fensterleben(b, o) });
  if (o.kabel !== false && (o.stil === 'stadt' || o.stil === 'dorf' || o.kabel)) res.kabel = gassenkabel(b, o);
  if (o.dach !== false) res.dach = dachleben(b, o);
  if (o.boden) res.boden = bodenmarken(b, { ...o, ...(typeof o.boden === 'object' ? o.boden : {}) });
  res.ms = Math.round(performance.now() - t0);
  b.kleinkram = res;
  return res;
}
