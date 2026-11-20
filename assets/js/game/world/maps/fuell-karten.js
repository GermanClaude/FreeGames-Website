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
