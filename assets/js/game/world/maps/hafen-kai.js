// NULLPUNKT — Hafen: Kaikante und Fahrspur mit Schwergut (gelaende, 14.11. Runde 3). (Owner: world)
// Nutzer: „Macht die Maps noch voller, wirklich spielbare Maps …“ – die Kaikante (x −44…−27) war zwischen Kranbeinen,
// Staplern und den beiden Doppelstapeln eine leere Betonfläche mit 90 m Sichtlinie. Hier liegt jetzt, was an einem
// Containerkai auf den Abtransport wartet: Stahlcoils auf Holzböcken, gestapelte Lukendeckel, ein Rohrbündel, eine
// Wand aus Beton-Legeblöcken – mit fester Kollision (Deckung, Kugeln schlagen ein, überkletterbar ab ≈ 1,3 m) und
// stimmig an Kaikante/Fahrspur ausgerichtet. Spiegelgleich in z (Team A Süden, Team B Norden). Jede Stelle wird vorab
// gegen Start-, Flaggen-, Stellungs- und Kampagnenpunkte sowie vorhandene Deckung geprüft (gelaende.platzFrei); fällt
// eine Seite weg, entfällt auch die gespiegelte (Fairness). Zufall nur über hash01 (Kartenzufall bleibt unberührt).
import { frame, hash01, pallet } from '../props.js?v=20261121041936';
import { freiPruefer, kartenSperre, platzFrei } from '../gelaende.js?v=20261121041936';

const P = { collide: false, minimap: false };
const PG = { ...P, grad: false };

/** Stahlcoils (n) auf zwei Holzböcken; Achse quer (lokal x), Reihe entlang lokal z. Kollision: ein Quader. */
export function coilBock(b, x, z, ry = 0, n = 3) {
  const f = frame(b, x, 0, z, ry), R = 0.86, W = 1.42, step = 1.95, L = n * step;
  for (const sx of [-0.45, 0.45]) f.box(sx, 0, 0, 0.22, 0.24, L + 0.3, 'wood_planks', { ...PG, tint: '#8a7356', uv: 'local' });
  for (let i = 0; i < n; i++) {
    const lz = -L / 2 + step * (i + 0.5);
    const t = ['#9a9fa6', '#8d9299', '#a7a9ab'][Math.floor(hash01(x + i, z, 501) * 3)];
    f.cyl(0, 0.24 + R, lz, R, W, 'metal_galvanized', { ...P, axis: 'x', tint: t, seg: 20 });
    // Kern (Loch) dunkel, Umreifungsbänder
    for (const sx of [-1, 1]) f.cyl(sx * (W / 2 + 0.004), 0.24 + R, lz, 0.3, 0.01, 'black', { ...PG, axis: 'x', seg: 12, caps: true, bullet: false });
    for (const sx of [-0.35, 0.35]) f.cyl(sx, 0.24 + R, lz, R + 0.012, 0.035, 'metal_painted', { ...PG, axis: 'x', tint: '#2a5a8a', seg: 20, bullet: false });
    // Keile unter dem Coil
    for (const sz of [-1, 1]) f.box(0, 0.24, lz + sz * 0.62, 1.2, 0.16, 0.18, 'wood_crate', { ...PG, tint: '#b39a72' });
  }
  f.solid(0, 0, 0, W + 0.1, 0.24 + 2 * R, L, { minimap: 'cover' });
  return { hw: (W + 0.1) / 2, hd: L / 2 };
}

/** Gestapelte Lukendeckel (n Lagen à 5,6 × 2,5 × 0,46 m), lokal x = Länge. */
export function lukendeckel(b, x, z, ry = 0, n = 3, L = 5.6) {
  const f = frame(b, x, 0, z, ry), D = 2.5, H = 0.46;
  const tints = ['#4f6a52', '#6a4f42', '#56626c'];
  for (let i = 0; i < n; i++) {
    const ox = (hash01(x, z + i, 511) - 0.5) * 0.3, oz = (hash01(x + i, z, 512) - 0.5) * 0.16, y0 = 0.16 + i * (H + 0.12), t = tints[(i + Math.floor(hash01(x, z, 513) * 3)) % 3];
    f.box(ox, y0, oz, L, H, D, 'metal_painted', { ...P, tint: t, uv: 'local' });
    // Randträger und Rost an den Kanten
    for (const sz of [-1, 1]) f.box(ox, y0 - 0.02, oz + sz * (D / 2 - 0.08), L + 0.04, H + 0.04, 0.16, 'metal_rust', { ...PG, uv: 'local' });
    // Kanthölzer zwischen den Lagen
    for (const sx of [-L * 0.32, 0, L * 0.32]) f.box(sx, y0 - 0.12 - (i ? 0 : 0.04), 0, 0.16, i ? 0.12 : 0.16, D + 0.1, 'wood_planks', { ...PG, tint: '#8a7356' });
  }
  const top = 0.16 + n * (H + 0.12) - 0.12;
  f.solid(0, 0, 0, L + 0.3, top, D + 0.1, { minimap: 'cover' });
  return { hw: (L + 0.3) / 2, hd: (D + 0.1) / 2 };
}

/** Rohrbündel (Pyramide 4-3-2) auf Kanthölzern, lokal x = Rohrachse. */
export function rohrbuendel(b, x, z, ry = 0, L = 5) {
  const f = frame(b, x, 0, z, ry), r = 0.27, rows = [4, 3, 2];
  for (const sx of [-L / 2 + 0.6, 0, L / 2 - 0.6]) f.box(sx, 0, 0, 0.18, 0.16, 2.4, 'wood_planks', { ...PG, tint: '#7d6a50' });
  const t = hash01(x, z, 521) < 0.5 ? '#3d5a7a' : '#7a4a3a';
  rows.forEach((k, row) => {
    for (let i = 0; i < k; i++) {
      const lz = (i - (k - 1) / 2) * (2 * r + 0.02), ly = 0.16 + r + row * r * 1.75;
      f.cyl(0, ly, lz, r, L, 'metal_painted', { ...P, axis: 'x', tint: t, seg: 14 });
      for (const sx of [-1, 1]) f.cyl(sx * (L / 2 + 0.003), ly, lz, r * 0.82, 0.01, 'black', { ...PG, axis: 'x', seg: 10, bullet: false });
    }
  });
  // Keile an den Enden der untersten Lage (statt Spannrahmen)
  for (const sx of [-L / 2 + 0.6, L / 2 - 0.6]) for (const sz of [-1, 1]) f.box(sx, 0.16, sz * 1.22, 0.2, 0.22, 0.16, 'wood_crate', { ...PG, tint: '#b39a72' });
  const H = 0.16 + 2 * r + 2 * r * 1.75 + 0.02;
  f.solid(0, 0, 0, L, H, 4 * (2 * r + 0.02), { minimap: 'cover' });
  return { hw: L / 2, hd: 2.3 / 2 };
}

/**
 * Beton-Legeblöcke (1,6 × 0,8 × 0,8 m, Noppen oben) als Mauer: Muster [[lx, Lage, lz, quer?], …] relativ zur Mitte.
 * Jeder Block hat eigene Kollision. Standard: 2 lang × 2 hoch + 1 obenauf (1,6–2,4 m Deckung).
 */
export function legebloecke(b, x, z, ry = 0, muster = null) {
  const f = frame(b, x, 0, z, ry);
  const M = muster || [[-0.8, 0, 0], [0.8, 0, 0], [0, 1, 0], [-1.6, 1, 0, 0, true]];
  let ex = 0, ez = 0;
  for (const [lx, lage, lz, , halb] of M) {
    const w = halb ? 0.8 : 1.6, t = ['#bdb6aa', '#b2ab9e', '#c6c0b4'][Math.floor(hash01(x + lx, z + lage, 531) * 3)];
    f.box(lx, lage * 0.8, lz, w - 0.02, 0.78, 0.78, 'concrete', { tint: t, minimap: 'cover', uv: 'local' });
    for (let k = 0; k < (halb ? 1 : 2); k++) f.cyl(lx + (halb ? 0 : (k - 0.5) * 0.8), lage * 0.8 + 0.78, lz, 0.17, 0.05, 'concrete', { ...PG, tint: t, seg: 10 });
    ex = Math.max(ex, Math.abs(lx) + w / 2); ez = Math.max(ez, Math.abs(lz) + 0.4);
  }
  return { hw: ex, hd: ez };
}

/**
 * Kaikante + Fahrspur füllen. spawns: Startpunkte der Karte (Freihaltung). → { gesetzt, verworfen }
 */
export function kaiAusbau(b, spawns) {
  const frei = freiPruefer(kartenSperre('hafen', spawns));
  let gesetzt = 0;
  const aus = [];
  // [Bauteil, x, z, ry, Maße (hw, hd) für die Prüfung, Parameter]
  const plan = [
    [coilBock, -31.0, 33.5, 0, [0.8, 2.95], [3]],
    [lukendeckel, -40.4, 33.0, 0, [1.95, 1.3], [3, 3.6], [-40.4, -29.5]],
    [rohrbuendel, -39.2, 12.6, Math.PI / 2, [1.8, 0.85], [3.6], [-39.2, -13.1]],
    [legebloecke, -23.6, 31.0, Math.PI / 2, [2.0, 0.4]],
  ];
  const dims = (ry, [hw, hd]) => (Math.abs(Math.sin(ry)) > 0.5 ? [hd, hw] : [hw, hd]);
  for (const [fn, x0, z0, ry, mass, par, nord] of plan) {
    const [hw, hd] = dims(ry, mass);
    // Süd- und Nordseite (Spiegelung z → −z) gemeinsam: erste Stelle im Umkreis 2 m, an der beide frei sind
    let pos = null;
    for (let r = 0; r <= 2 && !pos; r += 0.5) {
      for (const [dx, dz] of r ? [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]] : [[0, 0]]) {
        const x = x0 + dx, z = z0 + dz;
        // nord: eigene Stelle der Nordseite (Kampagnenpunkte/Startpunkte liegen dort anders) – gleiches Teil, gleiche Deckung
        const xn = nord ? nord[0] + dx : x, zn = nord ? nord[1] - dz : -z;
        if (platzFrei(b, frei, x, z, hw, hd, 0) && platzFrei(b, frei, xn, zn, hw, hd, 0)) { pos = [x, z, xn, zn]; break; }
      }
    }
    if (!pos) { aus.push(`${fn.name}@${x0},${z0}[${frei.grund}]`); continue; }
    const [x, z, xn, zn] = pos;
    fn(b, x, z, ry, ...(par || []));
    fn(b, xn, zn, Math.PI - ry, ...(par || []));
    gesetzt += 2;
  }
  // Paletten mit Sackware/Kisten an den Coils (Kleinteil-Deckung, eigene Kollision der Ladung über pallet())
  for (const s of [1, -1]) {
    const x = -33.4, z = s * 29.6;
    if (platzFrei(b, frei, x, z, 0.7, 0.6, 0, 0.8)) { pallet(b, x, 0, z, { ry: 0.2 * s, load: 'sacks' }); gesetzt++; }
  }
  if (b.debug || globalThis.location?.search?.includes('debug=1')) console.info(`[gelaende] hafen: ${gesetzt} Teile gesetzt, ${frei.verworfen} Prüfungen verworfen ${aus.join(' ')}`);
  return { gesetzt, verworfen: frei.verworfen };
}
