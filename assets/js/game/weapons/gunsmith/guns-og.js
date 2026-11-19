// Waffen der ersten Stunde (Nutzer 13.10.2026: „eine eigene Waffe, die es nur für sie gibt – einzigartig, nicht
// überstark“): P-0 Funke (Pistole), Erstlicht (Dolch); UR-1 Ursprung (Karabiner) seit 13.11. in guns-ursprung.js. Schwarz mit polierten Goldakzenten
// und dem Nullpunkt-Zeichen (Goldscheibe mit dunklem Ring). Griffpunkte/Teile wie bei den bewährten Bauarten, damit
// Hände, Nachladen und Animationen passen.
import { p9, P9 } from './guns-pistol.js?v=20261115041504';

/** Nullpunkt-Zeichen seitlich (x = Außenfläche, beide Seiten): Goldscheibe mit dunklem Ring. */
function emblem(b, x, v, u, r = 0.009, part) {
  if (!b.hi) return;
  for (const s of [-1, 1]) {
    b.cyl('goldTrim', r, r, 0.0012, s * (x + 0.0006), v, u, { axis: 'x', seg: 20, part });
    b.torus('polymer', r * 0.56, r * 0.13, s * (x + 0.0013), v, u, { ry: Math.PI / 2, tseg: 20, part });
  }
}

export function funke(b) {
  p9(b);
  const { axis, top, bottom, front: uF, hw } = P9;
  const mid = (top + bottom) / 2;
  // Goldener Kompensator vor dem Schlitten (fest am Rahmen), Mündung nach vorn verlegt
  b.box('goldTrim', hw * 2 + 0.0007, top - bottom + 0.0042, 0.026, 0, mid + 0.0004, uF + 0.0148, { c: 0.003 });
  if (b.hi) for (const u of [uF + 0.007, uF + 0.017]) b.box('cavity', 0.012, 0.001, 0.005, 0, top + 0.0025, u, { c: 0 });
  b.bore(0.0048, 0, axis, uF + 0.0281);
  b.anchor('muzzle', 0, axis, uF + 0.0298);
  // Goldlinie längs am Schlitten, goldenes Korn, Fenster oben im Schlitten
  if (b.hi) {
    for (const s of [-1, 1]) b.box('goldTrim', 0.0008, 0.0022, 0.1, s * (hw + 0.0003), top - 0.0045, 0.06, { part: 'slide', c: 0 });
    b.box('goldTrim', 0.0034, 0.0042, 0.0062, 0, top + 0.0021, uF - 0.0128, { part: 'slide', c: 0.0008 });
    for (let i = 0; i < 3; i++) b.box('cavity', 0.009, 0.001, 0.008, 0, top + 0.0003, 0.074 + i * 0.013, { part: 'slide', c: 0 });
  }
  emblem(b, hw + 0.0001, mid, 0.014, 0.0062, 'slide');
}

export function erstlicht(b) {
  // Dolch: zweischneidig mit Mittelgrat, goldene Parierstange, Goldringe am Griff, goldener Knauf. Klinge nach vorn (+u).
  const ring = [];
  const nr = b.hi ? 6 : 1;
  ring.push([-0.056, 0.0], [-0.056, 0.0122]);
  for (let i = 0; i < nr; i++) { const u = -0.052 + i * (0.1 / nr); ring.push([u + 0.003, 0.0138], [u + 0.1 / nr - 0.004, 0.0138], [u + 0.1 / nr - 0.001, 0.0125]); }
  ring.push([0.05, 0.0128], [0.052, 0.0]);
  b.lathe('rubber', ring, 0, 0, 0, { seg: b.seg(14, 6), sx: 0.8 });
  if (b.hi) for (const u of [-0.03, 0.03]) b.torus('goldTrim', 0.0124, 0.0014, 0, 0, u, { tseg: 18, sx: 0.8 });
  b.lathe('goldTrim', [[0, 0], [0, 0.0135], [0.004, 0.0146], [0.011, 0.0128], [0.014, 0.0]], 0, 0, -0.07, { seg: b.seg(12, 6), sx: 0.8 });
  b.box('goldTrim', 0.014, 0.074, 0.009, 0, 0, 0.058, { c: 0.0025 });
  // Klinge
  b.part('blade', 0, 0, 0);
  b.side('blade', [[0.062, 0.0145], [0.2, 0.0115], [0.262, 0.0], [0.2, -0.0115], [0.062, -0.0145]], 0.0042, 0, { part: 'blade', bevel: 0.0016 });
  b.side('bladeCoat', [[0.066, 0.0062], [0.19, 0.0046], [0.236, 0.0], [0.19, -0.0046], [0.066, -0.0062]], 0.0052, 0, { part: 'blade', bevel: 0.0012 });
  if (b.hi) for (const s of [-1, 1]) b.box('goldTrim', 0.0006, 0.0016, 0.1, s * 0.0027, 0, 0.13, { part: 'blade', c: 0 });
  b.anchor('muzzle', 0, 0, 0.255);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0 } });
  b.meta = { sight: 'none', kind: 'melee' };
}
