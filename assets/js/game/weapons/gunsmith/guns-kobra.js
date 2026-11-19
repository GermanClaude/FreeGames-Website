// R-6 Kobra nach echtem Vorbild (13.11.2026, Nutzerwunsch „Waffenmodelle anhand der echten Versionen so detailliert wie möglich“):
// Colt Python .357 Magnum mit 5-Zoll-Lauf (Spielmaß wie bisher), eigene Gravur ohne Herstellerzeichen.
// Merkmale: voller Unterlauf-Schutz für die Ausstoßerstange, belüftete Laufschiene (Rippe mit Fenstern), Rampenkorn mit rotem
// Einsatz, verstellbare Kimme (Seiten-/Höhenschraube) auf der Brücke, Rahmen mit Seitenplatte (3 Schrauben links), Trommelriegel
// (Daumenstück links hinter der Trommel), Trommel mit 6 Kammern und Rastkerben, Hahn mit gerieftem Sporn, glatter Abzug,
// Holzgriffschalen (Walnuss) mit Fingermulden, Fischhaut und Medaillon. Edelstahl hochglanz (wie die „Stainless“-Ausführung).
// Teile/Anker wie das Vormodell (crane, cylinder, ejector, loader, hammer, Griffpunkte) – Nachladen und Haltung bleiben.
import { triggerGuard } from './parts.js?v=20261119182451';
import { notchSight } from './pistol-parts.js?v=20261119182451';   // Kimme mit echter Kerbe (visier, 14.11.)
import { magRounds } from './magfill.js?v=20261119182451';
import { checkering } from './guns-flinten.js?v=20261119182451';
import { schrift } from './schrift.js?v=20261119182451';   // Gravuren (14.11., gfx-waffen)
const MARK_KOBRA = schrift('kobra').mark;

export function kobra(b) {
  // Gravuren: Typ/Kaliber/Nummer (Fantasie), eingeschnitten (schrift.js)
  MARK_KOBRA(b, 'KOBRA  .357 MAGNUM', -(0.0118 + 0.0003), 0.074, 0.165, 0.003);
  const axis = 0.074;
  const cu = 0.062, cr = 0.0205, cl = 0.058;           // Trommel: Mitte (u), Radius, Länge
  // Rahmen: Brücke über der Trommel (oben gerundet), Rahmenfenster, Bügelansatz, Griffrahmen
  b.side('stainless', [
    [-0.032, 0.094], [-0.02, 0.099], [0.096, 0.099], [0.1, 0.094], [0.1, 0.05], [0.094, 0.044], [0.03, 0.044], [0.03, 0.05], [0.025, 0.05], [0.02, 0.02],
    [-0.02, 0.016], [-0.04, 0.04], [-0.046, 0.074],
  ], 0.027, 0, { bevel: 0.0026, bevelSeg: 2, holes: [[[0.03, 0.05], [0.093, 0.05], [0.093, 0.0935], [0.03, 0.0935]]] });
  if (b.hi) {
    // Seitenplatte links (Trennfuge + 3 Schrauben), Trommelriegel (Daumenstück, gerieft)
    b.box('cavity', 0.0006, 0.032, 0.0008, -0.0136, 0.052, -0.012, { c: 0 });
    b.box('cavity', 0.0006, 0.0008, 0.045, -0.0136, 0.068, 0.006, { c: 0 });
    for (const [v, u] of [[0.06, -0.022], [0.04, 0.012], [0.085, 0.018]]) b.screw('stainless', -0.0137, v, u, 'x', 0.0022);
    b.side('stainless', [[0.016, 0.07], [0.03, 0.07], [0.03, 0.082], [0.018, 0.084]], 0.005, -0.0158, { bevel: 0.0008 });
    for (let i = 0; i < 4; i++) b.box('cavity', 0.0008, 0.011, 0.0008, -0.0185, 0.077, 0.019 + i * 0.003, { c: 0 });
    // Rücken der Brücke: Mattstreifen (Blendschutz)
    b.box('steelDark', 0.008, 0.0006, 0.11, 0, 0.0993, 0.04, { c: 0 });
  }
  // Lauf: Rohr mit vollem Unterlauf-Schutz (Front-Extrusion), belüftete Rippe oben (Stege + Fenster)
  b.cyl('stainless', 0.0118, 0.0118, 0.13, 0, axis, 0.165, { seg: b.seg(32, 8) });
  b.lathe('stainless', [[0, 0.0135], [0.008, 0.0128], [0.012, 0.0118]], 0, axis, 0.1, { seg: b.seg(32, 8) });   // Laufschulter am Rahmen
  // voller Unterlauf-Schutz: flache Seiten, unten gerundet
  b.front('stainless', [[-0.0085, axis - 0.004], [0.0085, axis - 0.004], [0.0085, 0.047], [0.0055, 0.0415], [0, 0.0405], [-0.0055, 0.0415], [-0.0085, 0.047]], 0.13, 0.1, { bevel: 0.0012 });
  // belüftete Rippe: Steg auf dem Lauf, Fenster, flache geriefte Oberseite
  b.front('stainless', [[-0.0042, axis + 0.01], [0.0042, axis + 0.01], [0.0042, 0.1015], [0.0052, 0.1035], [-0.0052, 0.1035], [-0.0042, 0.1015]], 0.124, 0.102, { bevel: 0.0006 });
  if (b.hi) {
    for (let i = 0; i < 7; i++) b.box('cavity', 0.0088, 0.009, 0.0115, 0, axis + 0.0168, 0.111 + i * 0.0168, { c: 0 });
    b.box('steelDark', 0.006, 0.0005, 0.12, 0, 0.1038, 0.162, { c: 0 });                                  // geriefte Oberseite
    // Unterlauf: Ausstoßerstangen-Mündung vorn, Querstift für den Riegel
    b.circle('cavity', 0.0042, 0, axis - 0.0225, 0.2302, { seg: 12 });
    // Gravur links am Lauf
    for (let i = 0; i < 9; i++) b.box('steelBright', 0.0003, 0.0018, 0.0012, -0.0136, 0.074, 0.13 + i * 0.0026, { c: 0 });
  }
  b.bore(0.0058, 0, axis, 0.2305);
  if (b.hi) b.lathe('stainless', [[0, 0.0066], [0.0012, 0.0084], [0.0012, 0.0102]], 0, axis, 0.2288, { seg: 24 });  // Mündungskrone
  b.anchor('muzzle', 0, axis, 0.232);
  // Rampenkorn mit rotem Einsatz (vorn auf der Rippe), verstellbare Kimme (Blatt mit Kerbe, Schrauben) auf der Brücke
  b.side('stainless', [[0.204, 0.1035], [0.226, 0.1035], [0.226, 0.1115], [0.221, 0.112]], 0.004, 0, { bevel: 0.0005 });
  if (b.hi) b.box('paintSignal', 0.0042, 0.0048, 0.0022, 0, 0.1098, 0.2225, { rx: 0.4, c: 0 });
  b.box('steelDark', 0.018, 0.008, 0.026, 0, 0.103, -0.016, { c: 0.002 });
  // Kimmenblatt mit ausgeschnittener Kerbe 3 × 3,5 mm (visier, 14.11.: vorher Vollblatt mit schwarzem Kästchen – Korn unsichtbar)
  notchSight(b, 'steelDark', [[-0.0285, 0.103], [-0.0235, 0.103], [-0.0235, 0.112], [-0.0285, 0.112]], 0.01, { nw: 0.003, vN: 0.1085, bevel: 0.0005 });
  if (b.hi) {
    b.screw('steel', 0.0102, 0.106, -0.022, 'x', 0.0016);
    b.screw('steel', 0, 0.1075, -0.004, 'v', 0.0016);
  }
  // Kran mit Trommel und Ausstoßerstange (im Unterlauf-Schutz)
  b.part('crane', -0.012, axis - 0.022, cu + cl / 2 + 0.004);
  b.box('stainless', 0.006, 0.012, 0.012, -0.011, axis - 0.02, cu + cl / 2 + 0.006, { part: 'crane', c: 0.0015 });
  b.cyl('stainless', 0.0045, 0.0045, 0.12, 0, axis - 0.0225, cu + cl / 2 + 0.06, { part: 'crane', seg: b.seg(12, 5) });
  b.cyl('knurl', 0.0048, 0.0048, 0.008, 0, axis - 0.0225, cu + cl / 2 + 0.116, { part: 'crane', seg: b.seg(12, 5) });
  b.part('cylinder', 0, axis - 0.003, cu, 'crane');
  b.lathe('stainless', [[-cl / 2, 0], [-cl / 2, cr - 0.0012], [-cl / 2 + 0.0012, cr], [cl / 2 - 0.0016, cr], [cl / 2, cr - 0.0018], [cl / 2, 0]], 0, axis - 0.003, cu, { part: 'cylinder', seg: b.seg(36, 8) });
  if (b.hi) {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6, k = a + Math.PI / 6;
      // Längsnuten (Flutes), Rastkerben hinten (Riegel), Kammern vorn mit Fase
      b.box('cavity', 0.0045, 0.0038, cl * 0.6, Math.cos(a) * cr * 0.97, axis - 0.003 + Math.sin(a) * cr * 0.97, cu + 0.005, { part: 'cylinder', rz: a, c: 0 });
      b.box('cavity', 0.0024, 0.002, 0.005, Math.cos(k) * cr * 0.99, axis - 0.003 + Math.sin(k) * cr * 0.99, cu - cl / 2 + 0.006, { part: 'cylinder', rz: k, c: 0 });
      b.circle('cavity', 0.0048, Math.cos(k) * 0.0122, axis - 0.003 + Math.sin(k) * 0.0122, cu + cl / 2 + 0.0006, { part: 'cylinder', seg: 14 });
      b.lathe('crown', [[0, 0.0048], [0.0008, 0.0056]], Math.cos(k) * 0.0122, axis - 0.003 + Math.sin(k) * 0.0122, cu + cl / 2 + 0.0002, { part: 'cylinder', seg: 14 });
    }
  }
  // Ausstoßerstern hinten an der Trommel
  b.part('ejector', 0, axis - 0.003, cu - cl / 2, 'cylinder');
  b.cyl('steelBright', 0.0138, 0.0138, 0.003, 0, axis - 0.003, cu - cl / 2 - 0.0012, { part: 'ejector', seg: b.seg(18, 6) });
  if (b.hi) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 3; b.cyl('brass', 0.0052, 0.0052, 0.004, Math.cos(a) * 0.0122, axis - 0.003 + Math.sin(a) * 0.0122, cu - cl / 2 - 0.004, { part: 'ejector', seg: 14 }); }
  // Hahn mit gerieftem Sporn, Schlagbolzennase
  b.part('hammer', 0, 0.072, -0.036);
  b.side('steelDark', [[-0.034, 0.058], [-0.024, 0.07], [-0.026, 0.09], [-0.03, 0.097], [-0.044, 0.106], [-0.054, 0.104], [-0.054, 0.098], [-0.044, 0.09], [-0.042, 0.064]], 0.007, 0, { part: 'hammer', bevel: 0.001 });
  if (b.hi) for (let i = 0; i < 6; i++) b.box('cavity', 0.0072, 0.0007, 0.0016, 0, 0.1 + i * 0.0012, -0.042 - i * 0.0018, { part: 'hammer', rx: 0.6, c: 0 });
  // Bügel + Abzug (glatt, breit)
  triggerGuard(b, 'stainless', 0.012, 0.05, 0.044, 0.03, { t: 0.0045, w: 0.01, trigPos: 0.4 });
  // Holzgriff (Walnuss) mit Fingermulden, Fischhaut-Feldern und Medaillon, Griffschraube
  b.side('woodWalnut', [[0.0, 0.046], [-0.003, 0.03], [0.002, 0.016], [-0.004, 0.0], [0.002, -0.016], [-0.004, -0.032], [0.002, -0.05], [0.002, -0.062], [-0.012, -0.078],
    [-0.046, -0.076], [-0.052, -0.062], [-0.05, -0.02], [-0.047, 0.03], [-0.04, 0.046]], 0.037, 0, { bevel: 0.0095, bevelSeg: 3 });
  if (b.hi) {
    for (const s of [-1, 1]) {
      b.cyl('goldTrim', 0.0055, 0.0055, 0.0015, s * 0.0186, 0.03, -0.024, { axis: 'x', seg: 18 });
      b.screw('stainless', s * 0.0186, -0.02, -0.028, 'x', 0.0021);
      checkering(b, s * 0.0187, -0.044, -0.008, -0.064, -0.004, { p: 0.0034 });
    }
  }
  // Schnelllader (beim Nachladen sichtbar; schwenkt mit der Trommel)
  b.part('loader', 0, axis - 0.003, cu - cl / 2 - 0.032, 'cylinder');
  b.cyl('polymer', 0.0175, 0.0175, 0.016, 0, axis - 0.003, cu - cl / 2 - 0.04, { part: 'loader', seg: b.seg(20, 6) });
  b.cyl('knurl', 0.008, 0.008, 0.012, 0, axis - 0.003, cu - cl / 2 - 0.054, { part: 'loader', seg: b.seg(14, 5) });
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 3;
    b.cyl('brass', 0.0048, 0.0048, 0.03, Math.cos(a) * 0.0122, axis - 0.003 + Math.sin(a) * 0.0122, cu - cl / 2 - 0.018, { part: 'loader', seg: b.seg(12, 5) });
    if (b.hi) b.cyl('copper', 0.002, 0.0046, 0.008, Math.cos(a) * 0.0122, axis - 0.003 + Math.sin(a) * 0.0122, cu - cl / 2 + 0.0, { part: 'loader', seg: 10 });
  }
  magRounds(b, { part: 'cylinder', cal: 'nose357', follower: false, cyl: { c: [0, axis - 0.003], u: cu + cl / 2 - 0.001, R: 0.0122, n: 6, F: Math.PI * 2 / 3 } });
  b.anchor('loaderGrab', 0, axis - 0.003, cu - cl / 2 - 0.056, { part: 'loader' });
  b.anchor('cylGrab', -0.022, axis - 0.006, cu, { part: 'cylinder' });
  b.anchor('ejectorGrab', 0, axis - 0.0225, cu + cl / 2 + 0.118, { part: 'crane' });
  b.anchor('ejection', -0.03, axis, cu - cl / 2);
  const grip = { rake: 0.25, gw: 0.0175, gd: 0.024, gu: 0.022, ho: 0.008, tu: 0.07 };
  b.anchor('rightHandGrip', 0, -0.016, -0.022, { data: grip });
  b.anchor('magWell', 0, axis, cu);
  b.anchor('sight', 0, 0.112, -0.03, { data: { type: 'iron', eyeRelief: 0.36 } });
  b.anchor('leftHandGrip', 0, -0.016, -0.022, { data: { style: 'pistol', ...grip } });
  b.meta = { sight: 'iron', axis, kind: 'pistol', hidden: ['loader'] };
}
