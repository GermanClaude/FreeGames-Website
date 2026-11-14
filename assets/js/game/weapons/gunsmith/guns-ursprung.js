// UR-1 Ursprung nach Vorbild (13.11.2026, Waffen-Etappe 3, Nutzer: „Waffenmodelle anhand der echten Versionen so detailliert
// wie möglich“): gleiches Vorbild wie bisher – AR-Karabiner der ersten Stunde, schwarz mit polierten Goldakzenten und dem
// Nullpunkt-Zeichen. Statt des alten Baukastens (arLower) baut er jetzt auf dem fotogenauen M4-Modell der M-17 auf
// (guns-m17.js: Gehäuse, Schienen-Handschutz, Schaft, Griff, Korn, Magazin nach Referenzfoto) und setzt die Goldteile darauf:
// Ring an der Laufmutter-Hülse, Laufring, Mündungsring, Abzug, Zeichen beidseitig am Magazinschacht.
// Werksoptik: Rotpunkt (wie bisher).
import * as R from './m17-ref.js?v=20261114004313';
import { m17 } from './guns-m17.js?v=20261114004313';
import { redDot } from './parts.js?v=20261114004313';

const { U, V } = R;
const AX = R.AXIS;

/** Nullpunkt-Zeichen seitlich (x = Außenfläche, beide Seiten): Goldscheibe mit dunklem Ring. */
function emblem(b, x, v, u, r = 0.009, part) {
  if (!b.hi) return;
  for (const s of [-1, 1]) {
    b.cyl('goldTrim', r, r, 0.0012, s * (x + 0.0006), v, u, { axis: 'x', seg: 24, part });
    b.torus('polymer', r * 0.56, r * 0.13, s * (x + 0.0013), v, u, { ry: Math.PI / 2, tseg: 24, part });
  }
}

export function ursprung(b) {
  m17(b, { optic: (bb, u, rt) => redDot(bb, u, rt), sight: 'reddot' });
  if (!b.hi) return;
  // Goldringe um den Schienen-Handschutz (vorn, Mitte, hinten) und am Laufende vor dem Mündungsfeuerdämpfer
  // (Goldring um die runde Laufmutter-Hülse hinter dem Handschutz und um den Lauf davor)
  const [d0, d1] = R.DELTA;
  b.torus('goldTrim', R.DELTA_R + 0.0006, 0.0018, 0, AX, (U(d0) + U(d1)) / 2, { tseg: 40, seg: 10 });
  b.torus('goldTrim', 0.0098, 0.0014, 0, AX, U(R.RAS[1]) + 0.012, { tseg: 28 });
  b.torus('goldTrim', R.FH_R + 0.0012, 0.0015, 0, AX, U(R.FH[0]) - 0.002, { tseg: 28 });
  // Goldener Abzug (dünne Schicht über dem Stahlabzug)
  b.side('goldTrim', R.M(R.TRIGGER), 0.0066, 0, { bevel: 0.0008, bevelSeg: 2 });
  // Zeichen am Magazinschacht (beidseitig)
  emblem(b, 0.0129, V(1245), U(1700), 0.0082);
}
