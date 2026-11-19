// NULLPUNKT — Werk: Schüttgut, Halden und Erdwälle im Lkw-Hof und Außenlager (gelaende, 14.11. Runde 3). (Owner: world)
// Nutzer: „wirklich spielbare Maps mit Hügeln und sowas“. Das Werk stand komplett auf einer ebenen Platte; jetzt liegen
// im Hof Kies-, Sand- und Schlackehalden (begehbar, ≤ 35° steil, Kollision = Oberfläche → Spieler und Bots laufen
// hinauf, Kugeln schlagen ein), eingefasst von Beton-Legeblöcken (Schüttgutboxen), dazu Erdwälle als Sichtdeckung.
// Spiegelgleich in z (Team A Süden, Team B Norden); jede Stelle wird gegen Start-, Flaggen-, Stellungs- und
// Kampagnenpunkte und vorhandene Deckung geprüft (gelaende.platzFrei) – fällt eine Seite weg, entfällt das Paar.
import { freiPruefer, kartenSperre, suchePlatz, huegel, erdwall } from '../gelaende.js?v=20261115041504';
import { legebloecke } from './hafen-kai.js?v=20261115041504';

const MAT = { kies: ['gravel', '#9a9182'], sand: ['sand', '#c4a678'], schlacke: ['gravel', '#3a3633'], erde: ['dirt', '#7a6448'] };

/**
 * Schüttgutbox: Halde (art) in einer U-förmigen Einfassung aus Legeblöcken (offene Seite zur Hofmitte, lokal +z).
 * (x, z) Mitte, ry Drehung. Breite 6,4 m, Tiefe 4,8 m.
 */
function schuettbox(b, x, z, ry, art) {
  const [mat, tint] = MAT[art];
  const c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  // Rückwand (2 Lagen, 4 Blöcke) und Seitenwangen (je 2 Blöcke quer, 2 Lagen)
  const [bx, bz] = P(0, -2.0);
  legebloecke(b, bx, bz, ry, [[-2.4, 0, 0], [-0.8, 0, 0], [0.8, 0, 0], [2.4, 0, 0], [-1.6, 1, 0], [1.6, 1, 0], [0, 1, 0, 0, true]]);
  for (const sd of [-1, 1]) {
    const [wx, wz] = P(sd * 3.6, -0.4);
    legebloecke(b, wx, wz, ry + Math.PI / 2, [[-0.8, 0, 0], [0.8, 0, 0], [0, 1, 0, 0, true]]);
  }
  const [hx, hz] = P(0, -0.2);
  huegel(b, hx, hz, { rx: 3.1, rz: 2.7, h: 1.7, ry, mat, tint, kind: 'cover' });
}

/** Lkw-Hof + Außenlager ergänzen. Wunschstellen je Seite; gesucht wird der nächste freie Platz im Umkreis. */
export function hofAusbau(b, spawns) {
  const frei = freiPruefer(kartenSperre('werk', spawns));
  const BZ = { minX: -77.4, maxX: 51.4, minZ: -47.4, maxZ: 47.4 };
  let gesetzt = 0;
  const aus = [];
  // [Art, Wunsch Süd [x, z], Wunsch Nord [x, z], Suchradius, Parameter]
  const plan = [
    ['halde', [-70.5, 34.5], [-70.5, -35.0], 8, { rx: 3.6, rz: 3.0, h: 2.0, art: 'schlacke', ry: 0.3 }],
    ['halde', [-46.5, 36.5], [-46.5, -36.5], 4, { rx: 3.2, rz: 2.8, h: 1.8, art: 'kies', ry: -0.2 }],
    ['halde', [-49.0, 4.8], [-49.0, -4.8], 5, { rx: 2.6, rz: 2.2, h: 1.4, art: 'sand', ry: 0.5 }],
    ['box', [-69.0, 25.0], [-69.0, -24.0], 8, { art: 'sand' }],
    ['halde', [46.0, 38.5], [46.0, -38.5], 4, { rx: 3.4, rz: 2.6, h: 1.5, art: 'erde', ry: 0 }],
  ];
  const mass = (art, o) => (art === 'halde' ? [o.rx * 0.8 + 0.3, o.rz * 0.8 + 0.3] : art === 'box' ? [4.0, 2.7] : [3.3, o.len / 2 + 3.3]);
  for (const [art, wS, wN, r, o] of plan) {
    const [hw, hd] = mass(art, o);
    for (const [s, w] of [[1, wS], [-1, wN]]) {
      const p = suchePlatz(b, frei, w[0], w[1], hw, hd, r, 1.0, BZ);
      if (!p) { aus.push(`${art}@${w}[${frei.grund}]`); continue; }
      const [x, z] = p, ry = s > 0 ? (o.ry || 0) : Math.PI - (o.ry || 0);
      if (art === 'halde') { const [mat, tint] = MAT[o.art]; huegel(b, x, z, { rx: o.rx, rz: o.rz, h: o.h, ry, mat, tint, kind: 'cover' }); }
      else if (art === 'box') schuettbox(b, x, z, s > 0 ? Math.PI : 0, o.art);
      else erdwall(b, x, z - o.len / 2, x, z + o.len / 2, { w: 6.4, h: 1.2, tint: '#7d7060' });
      gesetzt++;
    }
  }
  if (b.debug || globalThis.location?.search?.includes('debug=1')) console.info(`[gelaende] werk: ${gesetzt} Teile gesetzt, ${frei.verworfen} verworfen ${aus.join(' ')}`);
  return { gesetzt, verworfen: frei.verworfen };
}
