// NULLPUNKT — fuell (20.11.): Kartenbezogene Ergänzungen gegen „leer/ungefüllt“ (Owner: world). Wird jeweils am ENDE
// eines Kartenaufbaus aufgerufen (danach verbraucht niemand mehr b.rand → alle übrigen Platzierungen bleiben gleich);
// Zufall nur über hash01 (Lage). Kollision nur für Dinge, die man als Hindernis erwartet (Baumstämme, Masten); alles
// Kleinere ist reine Optik (keine Kollision, keine Minikarte). Symmetrie der Karten bleibt erhalten (Platzierung
// gespiegelt bzw. punktsymmetrisch wie die Karte selbst).
import { frame, hash01 } from '../props.js?v=20261115041504';

const KEIN = { collide: false, minimap: false };
const VG = { ...KEIN, grad: false };
const DN = { ...VG, ao: false, bullet: false };

/** Straßenbaum (Linde) mit Baumscheibe; Stamm mit Kollision (dünn), Krone/Äste nur Optik. */
export function linde(b, x, z, o = {}) {
  const y = o.y ?? 0, h = o.h ?? (4.4 + hash01(x, z, 1) * 0.9), s = o.s ?? (1.15 + hash01(x, z, 2) * 0.25), tw = 0.19;
  const tint = '#e8dccb';
  b.cyl(x, y, z, tw, h * 0.55, 'bark', { r1: tw * 0.8, tint, seg: 8, minimap: 'prop', rz: (hash01(x, z, 3) - 0.5) * 0.12 });
  b.cyl(x + 0.1, y + h * 0.5, z, tw * 0.7, h * 0.5, 'bark', { r1: tw * 0.4, tint, seg: 7, ...VG, rz: -0.35, uvOffset: [0.3, h * 0.5] });
  b.cyl(x - 0.1, y + h * 0.5, z + 0.05, tw * 0.6, h * 0.45, 'bark', { r1: tw * 0.35, tint, seg: 7, ...VG, rz: 0.4, rx: 0.2, uvOffset: [0.6, h * 0.5] });
  b.plant('tree', x, y, z, { s, ry: hash01(x, z, 4) * Math.PI * 2 });
  if (o.scheibe !== false) {
    // Baumscheibe: Erde + Randsteine, etwas Unkraut
    b.box(x, y + 0.004, z, 1.3, 0.012, 1.3, 'dirt', { ...DN, tint: '#7a6a56' });
    for (const [dx, dz, w, d] of [[0, -0.7, 1.5, 0.1], [0, 0.7, 1.5, 0.1], [-0.7, 0, 0.1, 1.3], [0.7, 0, 0.1, 1.3]]) b.box(x + dx, y, z + dz, w, 0.06, d, 'stone_wall', { ...VG, tint: '#a8a294' });
    for (let k = 0; k < 3; k++) b.plant(k ? 'weeds' : 'grass', x + (hash01(x, k, 5) - 0.5) * 1.0, y, z + (hash01(z, k, 6) - 0.5) * 1.0, { s: 0.35 + hash01(x + k, z, 7) * 0.3, ry: hash01(x, z + k, 8) * 6.28 });
  }
}

/** Stadtkern: Linden auf beiden Gehwegen der Lindenallee (spiegelgleich in z), Baumscheiben. */
export function stadtkernFuellen(b) {
  for (const s of [-1, 1]) for (const x of [-36, -24, -13.9, 13.9, 24, 36]) linde(b, x, s * 7.35);
}

/**
 * Dehnfugen eines Betonbelags (dunkle schmale Linien im Raster step) über das Rechteck – brechen große einheitliche
 * Flächen wie in echten Hafen-/Werkshöfen. Nur ab mittel (Decals, ein Draw Call mit allen übrigen).
 */
export function fugen(b, x0, z0, x1, z1, step = 6, o = {}) {
  if ((b.lookQuality || b.quality) === 'low') return;
  const y = o.y ?? 0.008, tint = o.tint || '#2e2d2a', op = o.opacity ?? 0.42, w = o.w ?? 0.1;
  for (let x = x0 + step; x < x1 - 0.5; x += step) b.decal(x, y, (z0 + z1) / 2, z1 - z0, w, 'line', { ry: Math.PI / 2, tint, kind: 'paint', opacity: op * (0.8 + hash01(x, z0, 11) * 0.4) });
  for (let z = z0 + step; z < z1 - 0.5; z += step) b.decal((x0 + x1) / 2, y, z, x1 - x0, w, 'line', { ry: 0, tint, kind: 'paint', opacity: op * (0.8 + hash01(x0, z, 12) * 0.4) });
}

/** Fahrspuren, Ölflecken und Risse über ein Rechteck gestreut (Positions-Hash), n Stück. */
export function bodenspuren(b, x0, z0, x1, z1, n, o = {}) {
  if ((b.lookQuality || b.quality) === 'low') return;
  const mix = o.mix || ['tire', 'tire', 'oil', 'cracks', 'stain'];
  for (let i = 0; i < n; i++) {
    const x = x0 + hash01(i, x0 + z0, 21) * (x1 - x0), z = z0 + hash01(z1 - i, x1, 22) * (z1 - z0), k = mix[Math.floor(hash01(x, z, 23) * mix.length)];
    const along = hash01(x, z, 24) < 0.5 ? 0 : Math.PI / 2;
    const [w, d] = k === 'tire' ? [5 + hash01(x, z, 25) * 7, 1.4] : k === 'cracks' ? [2 + hash01(x, z, 26) * 2.5, 2 + hash01(z, x, 27) * 2] : [1.2 + hash01(x, z, 28) * 2.2, 1 + hash01(z, x, 29) * 1.8];
    b.decal(x, 0.011 + i * 1e-5, z, w, d, k, { ry: k === 'tire' ? along + (hash01(x, z, 30) - 0.5) * 0.15 : hash01(x, z, 31) * 6.28, opacity: 0.55 + hash01(x, z, 32) * 0.35 });
  }
}

/** Hafen: Dehnfugen auf Kai und Terminal (Rissbeton), Fahrspuren der Containerstapler, Ölflecken. */
export function hafenFuellen(b) {
  fugen(b, -44, -52, 50, 52, 7.5);
  bodenspuren(b, -27, -50, 48, 50, 46);
  bodenspuren(b, 50, -50, 74, 50, 12, { mix: ['tire', 'oil', 'cracks'] });
}

/** Werk: Fugen auf den Betonflächen, Fahrspuren im Lkw-Hof. */
export function werkFuellen(b, flaechen = []) {
  for (const [x0, z0, x1, z1, st] of flaechen) fugen(b, x0, z0, x1, z1, st || 6);
}
