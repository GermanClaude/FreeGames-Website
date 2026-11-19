// NULLPUNKT — Altstadt: Brunnenterrassen (gelaende, 14.11. Runde 3). (Owner: world)
// Nutzer: „wirklich spielbare Maps mit Hügeln und sowas“ – die Altstadt war bis auf Dächer und Treppenhäuser topfeben.
// Eine echte Hangstadt hätte jedes Haus, jede Tür und alle Kampagnenwege verschoben; stattdessen liegen zwischen dem
// Brunnenplatz (Flagge B) und den Plätzen vor den Flaggen A/C zwei erhöhte Terrassen (1,2 m) mit Bruchsteinstützmauer,
// Pflasterbelag, Brüstungsmauer (Deckung) und Treppe zur Gasse (die Brüstung ist überkletterbar): eine zweite Ebene mit Blick über den
// Platz, darunter Deckung an der Stützmauer. Spiegelgleich in z; geprüft gegen Start-, Flaggen-, Stellungs- und
// Kampagnenpunkte (gelaende.platzFrei). Feste Kollision, auf jedem Gerät gleich.
import { freiPruefer, kartenSperre, platzFrei, podest } from '../gelaende.js?v=20261119182451';

export function terrassen(b, spawns) {
  const frei = freiPruefer(kartenSperre('altstadt', spawns));
  let gesetzt = 0;
  const aus = [];
  // [x0, z0, x1, z1, h, Optionen] für die Südseite (z > 0), Nordseite gespiegelt
  const plan = [
    [-4.75, 13.0, 1.05, 17.0, 1.2, { treppen: [{ seite: 'e', at: 0, w: 1.8 }], bruestung: ['n', 's'] }],
  ];
  for (const [x0, z0, x1, z1, h, o] of plan) {
    // Prüfrechtecke: Podest (+ 0,2 m) und jede Treppe (Breite × Lauflänge h / 0,62) einzeln, beide Seiten (z → −z)
    const run = h / 0.62 + 0.3, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const rects = [[mx, mz, (x1 - x0) / 2 + 0.2, (z1 - z0) / 2 + 0.2]];
    for (const t of o.treppen) {
      const at = t.at || 0, hw2 = (t.w ?? 1.6) / 2 + 0.2;
      if (t.seite === 'e') rects.push([x1 + run / 2, mz + at, run / 2, hw2]);
      else if (t.seite === 'w') rects.push([x0 - run / 2, mz + at, run / 2, hw2]);
      else if (t.seite === 'n') rects.push([mx + at, z0 - run / 2, hw2, run / 2]);
      else rects.push([mx + at, z1 + run / 2, hw2, run / 2]);
    }
    const ok = rects.every(([cx, cz, hw, hd]) => platzFrei(b, frei, cx, cz, hw, hd, 0, 0.9, h) && platzFrei(b, frei, cx, -cz, hw, hd, 0, 0.9, h));
    if (!ok) { aus.push(`terrasse@${mx},${mz}[${frei.grund}]`); continue; }
    for (const s of [1, -1]) {
      const flip = (side) => (s > 0 ? side : side === 'n' ? 's' : side === 's' ? 'n' : side);
      podest(b, x0, Math.min(s * z0, s * z1), x1, Math.max(s * z0, s * z1), h, {
        mat: 'stone_wall', tint: '#c9bfae', top: 'cobble', topTint: '#d8d3ca', bruestungArt: 'mauer', mauerMat: 'stone_wall', mauerTint: '#c2b8a6',
        treppen: o.treppen.map((t) => ({ ...t, seite: flip(t.seite), at: (t.seite === 'w' || t.seite === 'e' ? s : 1) * (t.at || 0), mat: 'stone_wall' })), bruestung: o.bruestung.map(flip), kind: 'cover',
      });
      gesetzt++;
    }
  }
  if (b.debug || globalThis.location?.search?.includes('debug=1')) console.info(`[gelaende] altstadt: ${gesetzt} Terrassen, ${frei.verworfen} Prüfungen verworfen ${aus.join(' ')}`);
  return { gesetzt, verworfen: frei.verworfen };
}
