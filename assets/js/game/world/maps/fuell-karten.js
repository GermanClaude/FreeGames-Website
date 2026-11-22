// NULLPUNKT — fuell (20.11.): Kartenbezogene Ergänzungen gegen „leer/ungefüllt“ (Owner: world). Wird jeweils am ENDE
// eines Kartenaufbaus aufgerufen (danach verbraucht niemand mehr b.rand → alle übrigen Platzierungen bleiben gleich);
// Zufall nur über hash01 (Lage). Kollision nur für Dinge, die man als Hindernis erwartet (Baumstämme, Masten); alles
// Kleinere ist reine Optik (keine Kollision, keine Minikarte). Symmetrie der Karten bleibt erhalten (Platzierung
// gespiegelt bzw. punktsymmetrisch wie die Karte selbst).
import { frame, hash01 } from '../props.js?v=20261122020853';

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
  // Allee, Hinterstraßen, Ladehöfe: Risse, Ruß, Laub, Papier, Pfützen (Kriegsschauplatz)
  bodenspuren(b, -54, -5.5, 54, 5.5, 40, { mix: ['cracks', 'cracks', 'soot', 'stain', 'leaves', 'paper', 'puddle', 'tire'] });
  for (const s of [-1, 1]) {
    bodenspuren(b, -50, s > 0 ? 48.5 : -55.5, 50, s > 0 ? 55.5 : -48.5, 22, { mix: ['cracks', 'stain', 'leaves', 'paper', 'puddle', 'oil'] });
    bodenspuren(b, -20, s > 0 ? 38 : -48, 20, s > 0 ? 48 : -38, 12, { mix: ['oil', 'stain', 'cracks', 'leaves'] });
  }
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

/** Abschnitte [xa, xe] einer Linie z = const, die nicht in Gebäuden/Containern liegen (Grundrisse). */
function freiLaeufe(b, x0, x1, z) {
  const fp = b.footprints.filter((f) => (f.kind === 'building' || f.kind === 'container' || f.kind === 'floor') && f.y0 < 0.5);
  const drin = (x) => fp.some((f) => { const c = Math.cos(f.ry || 0), s = Math.sin(f.ry || 0), px = x - f.x, pz = z - f.z; return Math.abs(px * c - pz * s) <= f.hw + 0.3 && Math.abs(px * s + pz * c) <= f.hd + 0.3; });
  const out = [];
  let a = null;
  for (let x = x0; x <= x1; x += 0.5) { const d = drin(x); if (!d && a == null) a = x; if ((d || x + 0.5 > x1) && a != null) { out.push([a, x]); a = null; } }
  return out;
}

/** Hafen: Dehnfugen auf Kai und Terminal (Rissbeton), Fahrspuren der Containerstapler, Ölflecken. */
export function hafenFuellen(b) {
  fugen(b, -44, -52, 50, 52, 7.5);
  bodenspuren(b, -27, -50, 48, 50, 90, { mix: ['tire', 'tire', 'oil', 'oil', 'cracks', 'stain', 'puddle', 'drip'] });
  bodenspuren(b, -43, -50, -28, 50, 24, { mix: ['tire', 'oil', 'cracks', 'stain', 'drip'] });
  bodenspuren(b, 50, -50, 74, 50, 18, { mix: ['tire', 'oil', 'cracks', 'puddle'] });
  // Entwässerungsrinnen quer über das Terminal (Gitterabdeckung bündig im Belag) und Stahlplatten über Leitungsgräben
  if ((b.lookQuality || b.quality) !== 'low') {
    for (const z of [-34, -12, 12, 34]) for (const [xa, xe] of freiLaeufe(b, -26, 48, z)) {
      if (xe - xa < 3) continue;
      b.box((xa + xe) / 2, 0.0005, z, xe - xa, 0.004, 0.34, 'metal_painted', { ...DN, tint: '#1e1e1c' });
      b.box((xa + xe) / 2, 0.004, z, xe - xa, 0.006, 0.3, 'metal_grate', { ...DN, tint: '#6a6a64' });
    }
    for (let i = 0; i < 16; i++) {
      const x = -25 + hash01(i, 7, 41) * 72, z = -48 + hash01(7, i, 42) * 96, ry = hash01(x, z, 43) < 0.5 ? 0 : Math.PI / 2;
      const fl = freiLaeufe(b, x - 1.5, x + 1.5, z); if (fl.length !== 1 || fl[0][1] - fl[0][0] < 2.5) continue;
      b.box(x, 0, z, 2.4, 0.018, 1.5, 'metal_rust', { ...DN, ry: ry + (hash01(x, z, 44) - 0.5) * 0.1, tint: '#9a8a7a' });
    }
  }
}

/** Werk: Fugen auf den Betonflächen, Fahrspuren im Lkw-Hof. */
export function werkFuellen(b, flaechen = []) {
  for (const [x0, z0, x1, z1, st] of flaechen) fugen(b, x0, z0, x1, z1, st || 6);
}

/** Altstadt: Laub, Sandverwehungen, Moos, Flecken auf dem Pflaster der Plätze und Gassen. */
export function altstadtFuellen(b) {
  bodenspuren(b, -46, -52, 69, 52, 80, { mix: ['leaves', 'leaves', 'sanddrift', 'sanddrift', 'moss', 'paper', 'cracks'] });
}

/** Schießstand: Sandverwehungen/Fahrspuren auf den Bahnen, Gras und Büsche auf den Wiesen außerhalb der Mauern. */
export function rangeFuellen(b) {
  bodenspuren(b, -28, -75, 28, 28, 36, { mix: ['sanddrift', 'sanddrift', 'stain', 'tire', 'leaves'] });
  const q = b.lookQuality || b.quality, n = q === 'low' ? 120 : q === 'medium' ? 260 : q === 'ultra' ? 560 : 420;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, x = side * (39 + hash01(i, 3, 51) * 30), z = -108 + hash01(3, i, 52) * 206;
    const k = hash01(x, z, 53);
    b.plant(k < 0.08 ? 'bush' : k < 0.55 ? 'grass' : 'weeds', x, -0.02, z, { s: k < 0.08 ? 0.6 + hash01(z, x, 54) * 0.5 : 0.45 + hash01(z, x, 55) * 0.5, ry: hash01(x, z, 56) * 6.28 });
  }
}

/** Flugplatz-Vorfeld: Reifenspuren, Ölflecken, Tropfspuren und Risse auf den Betonfeldern. */
export function vorfeldFuellen(b) {
  // ges2 (21.11.): weniger dunkle Flecken (vorher 90 Stück, ein Drittel Öl/Fleck) – Reifenspuren und Risse überwiegen
  bodenspuren(b, -168, -130, 168, -47, 55, { mix: ['tire', 'tire', 'tire', 'oil', 'drip', 'cracks', 'cracks'] });
  bodenspuren(b, 100, -142, 205, -100, 12, { mix: ['tire', 'tire', 'oil', 'cracks'] });
}
