// HM-60 Hammer nach Vorbild (M60-Bauart, 7,62 mm, gurtgespeist – 13.11.2026, Nutzerwunsch „Waffenmodelle anhand der echten
// Versionen so detailliert wie möglich“). Maße nach Datenblatt (Länge 1105 mm, Lauf 560 mm, Gehäusebreite ≈ 50 mm);
// Fotos konnten wegen Zugriffsgrenzen nicht geladen werden – Umrisse nach bekannten Proportionen. Ohne Zeichen/Stempel.
// Bauteile: Gehäuse mit Prägeleisten und Nietreihen, Zuführdeckel (Scharnier vorn, Riegel hinten) mit Rippen und
// Gurtzuführung links, Leitervisier hinten, Abzugsgruppe mit langem Bügel, Griff, Schaft mit Schulterstütze, gerippter
// Vorderschaft um den Gaszylinder, Lauf mit Tragegriff, Gaszylinder mit Zweibein (eingeklappt), Korn, Feuerdämpfer;
// Munitionskasten links mit Deckel (hüpft beim Rückstoß, viewmodel.js _animLid) und Gurt (magfill.js, Glied je Patrone).
import { mm, slab, rrect, pocket, POLY, STEEL } from './gbkit.js?v=20261119182451';
import { magRounds } from './magfill.js?v=20261119182451';
import { apertureSight } from './pistol-parts.js?v=20261119182451';   // Lochkimme mit Durchblick (visier, 14.11.)
import { schrift } from './schrift.js?v=20261119182451';   // Gravuren (14.11., gfx-waffen)
const MARK_HM60 = schrift('hm60').mark;

const AXIS = 0.082;
const SV = 0.1405;

const REC = mm([[-136, 36], [216, 36], [216, 104], [210, 108], [-60, 108], [-90, 112], [-130, 112], [-136, 106]]);
const TRIG = mm([[-66, 36], [124, 36], [124, 24], [112, 18], [40, 18], [30, 12], [-40, 12], [-66, 22]]);
const GUARD = mm([[-2, 14], [-4, -2], [2, -30], [12, -38], [104, -38], [114, -30], [116, 18]]);
const GUARD_HOLE = mm([[10, 14], [10, -2], [14, -26], [20, -30], [98, -30], [104, -24], [104, 18]]);
const GRIP = mm([[30, 18], [26, -4], [16, -46], [8, -74], [-2, -84], [-30, -84], [-36, -74], [-22, -36], [-14, 0], [-16, 18]]);
const STOCK = mm([[-128, 104], [-300, 98], [-462, 94], [-472, 88], [-472, -50], [-458, -58], [-300, -20], [-160, 22], [-128, 34]]);
const COVER = mm([[-52, 108], [200, 108], [206, 114], [194, 132], [-34, 132], [-50, 124]]);

export function hm60(b) {
  // Gravuren: Typ/Kaliber/Nummer (Fantasie), eingeschnitten (schrift.js)
  MARK_HM60(b, 'HM-60  KAL 7,62 × 51', -(0.0245 + 0.0002), 0.07, 0.06, 0.0042);
  MARK_HM60(b, 'NP 600417', -(0.0245 + 0.0002), 0.061, 0.06, 0.003);
  // --- Gehäuse (Stahlblech): Längsleisten (Prägung), Nietreihen, Auswurf rechts
  slab(b, REC, 0.0245, 0.0022, 'gbBlued', { id: 'rec', cav: STEEL, cut: (x, v, u, d) => {
    d = pocket(d, x, rrect(u, v, 0.04, 0.072, 0.03, 0.009, 0.002), 0.014, 1);
    // Prägeleiste: erhabenes Band in Achshöhe (Wand 1 mm dicker)
    if (Math.abs(v - 0.078) < 0.012 && u > -0.12 && u < 0.2) d = Math.min(d, Math.max(Math.abs(x) - 0.0255, Math.abs(v - 0.078) - 0.006, Math.abs(u - 0.04) - 0.16));
    return d;
  }, hwMax: 0.026 });
  slab(b, TRIG, 0.0185, 0.002, 'gbBlued', { id: 'trig', cav: STEEL });
  slab(b, GUARD, 0.008, 0.0025, 'gbBlued', { holes: [GUARD_HOLE], id: 'guard', cav: STEEL });
  b.side('gbSteel', mm([[46, 14], [48, 2], [52, -12], [50, -20], [46, -18], [44, -6], [42, 14]]), 0.007, 0, { bevel: 0.001 });
  slab(b, GRIP, 0.0155, 0.007, 'gbGrip', { id: 'grip', cav: POLY });
  if (b.hi) {
    for (const v of [0.046, 0.1]) for (let i = 0; i < 9; i++) for (const s of [-1, 1]) b.sphere('gbSteel', 0.0024, s * 0.0244, v, -0.12 + i * 0.04, { seg: 10, hseg: 6, sx: 0.5 });
    b.cyl('gbSteel', 0.006, 0.006, 0.054, 0, 0.026, -0.05, { axis: 'x', seg: 14 });          // Abzugsgruppen-Stift
    b.cyl('gbSteel', 0.0045, 0.0045, 0.042, 0, 0.026, 0.105, { axis: 'x', seg: 12 });
    b.box('gbSteel', 0.004, 0.012, 0.03, -0.0195, 0.03, 0.02, { c: 0.001 });                 // Sicherung links
  }

  // --- Zuführdeckel (klappbar, Scharnier vorn) mit Rippen, Riegel hinten; Zuführschale links
  b.part('cover', 0, 0.108, 0.2);
  slab(b, COVER, 0.026, 0.003, 'gbSteel', { part: 'cover', cav: STEEL, cut: (x, v, u, d) => {
    for (let i = 0; i < 5; i++) d = Math.max(d, -(Math.hypot(u - (0.01 + i * 0.035), v - 0.132) - 0.0016));
    return d;
  } });
  b.box('gbSteel', 0.034, 0.012, 0.018, 0, 0.128, -0.04, { part: 'cover', c: 0.002 });
  if (b.hi) {
    b.cyl('gbSteel', 0.0065, 0.0065, 0.058, 0, 0.112, 0.2, { part: 'cover', axis: 'x', seg: 14 });
    for (const s of [-1, 1]) b.box('gbSteel', 0.006, 0.008, 0.02, s * 0.022, 0.12, -0.044, { part: 'cover', c: 0.001 });
  }
  b.box('gbSteel', 0.022, 0.016, 0.052, -0.035, 0.094, 0.12, { c: 0.002 });                  // Zuführschale links (Gurteinlauf)

  // --- Leitervisier hinten (Fuß, Klappleiter, Seitentrieb)
  b.box('gbBlued', 0.03, 0.014, 0.034, 0, 0.115, -0.08, { c: 0.002 });
  // Leiter (visier, 14.11.): zwei Holme + Blatt mit runder Lochblende Ø 5,6 mm auf der Visierlinie – vorher eine 20 mm breite Vollplatte
  // (das Loch ging quer statt längs), im Anschlag ein Balken vor dem Ziel
  for (const s of [-1, 1]) b.side('gbSteel', mm([[-88, 122], [-72, 122], [-74, 146], [-86, 146]]), 0.004, s * 0.008, { bevel: 0.0008 });
  apertureSight(b, 'gbSteel', { x0: -0.01, x1: 0.01, v0: 0.13, v1: SV + 0.0065, cv: SV, r: 0.0028, u: -0.083, l: 0.005 });
  if (b.hi) for (const s of [-1, 1]) b.cyl('knurl', 0.006, 0.006, 0.006, s * 0.019, 0.116, -0.08, { axis: 'x', seg: 14 });

  // --- Schaft (Polymer) mit Kolbenkappe, Schulterstütze (geklappt), Riemenbügel
  slab(b, STOCK, (u) => 0.0195 + Math.min(0.0035, Math.max(0, -u - 0.2) * 0.013), 0.007, 'gbPoly', { hwMax: 0.023, id: 'stock', cav: POLY });
  b.side('gbSteel', mm([[-470, 96], [-484, 90], [-484, -54], [-470, -62]]), 0.046, 0, { bevel: 0.0015 });
  b.side('gbSteel', mm([[-470, -56], [-470, -14], [-446, -24], [-450, -64]]), 0.034, 0, { bevel: 0.0015 });
  if (b.hi) b.torus('gbSteel', 0.01, 0.002, 0, -0.032, -0.4, { ry: Math.PI / 2, seg: 6, tseg: 16 });

  // --- Spannhebel rechts, Verschluss im Auswurf
  b.part('charge', 0.03, 0.06, 0.13);
  b.box('gbSteel', 0.008, 0.012, 0.03, 0.028, 0.06, 0.13, { part: 'charge', c: 0.002 });
  b.cyl('gbSteel', 0.006, 0.007, 0.024, 0.042, 0.06, 0.138, { part: 'charge', axis: 'x', seg: b.seg(12, 5) });
  b.anchor('chargeGrab', 0.052, 0.06, 0.138, { part: 'charge', data: { travel: [0, 0, 0.1], style: 'right' } });
  b.part('bolt', 0, AXIS, 0.03);
  b.box('gbBolt', 0.004, 0.014, 0.05, 0.016, 0.072, 0.04, { part: 'bolt', c: 0.001 });

  // --- Vorderschaft (gerippt) um Lauf und Gaszylinder
  b.lathe('gbPoly', [[0, 0], [0, 0.026], [0.006, 0.0315], [0.2, 0.0315], [0.215, 0.026], [0.215, 0]], 0, AXIS - 0.006, 0.216, { seg: b.seg(24, 6), sy: 1.12 });
  if (b.hi) for (let i = 0; i < 9; i++) b.torus('gbPoly', 0.0315, 0.0026, 0, AXIS - 0.006, 0.236 + i * 0.02, { seg: 8, tseg: 24, sy: 1.12 });
  if (b.hi) for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.box('cavity', 0.002, 0.007, 0.012, s * 0.0312, AXIS - 0.03, 0.26 + i * 0.04, { c: 0 });

  // --- Lauf, Gaszylinder, Tragegriff, Zweibein, Korn, Feuerdämpfer
  b.cyl('gbBarrel', 0.0125, 0.0138, 0.46, 0, AXIS, 0.66, { seg: b.seg(20, 6) });
  b.cyl('gbSteel', 0.0115, 0.0115, 0.19, 0, AXIS - 0.03, 0.525, { seg: b.seg(16, 5) });
  slab(b, mm([[430, 50], [454, 50], [458, 70], [454, 96], [430, 96]]), 0.016, 0.003, 'gbSteel', { id: 'barrelnut', cav: STEEL });
  slab(b, mm([[584, 34], [620, 34], [624, 46], [620, 96], [584, 96]]), 0.0155, 0.003, 'gbSteel', { id: 'gasblock', cav: STEEL });
  // Tragegriff: Klemme am Lauf, Bügel, Griffstück
  b.cyl('gbSteel', 0.017, 0.017, 0.02, 0, AXIS, 0.42, { seg: b.seg(18, 6) });
  // visier (14.11.): Bügel links seitlich abgeklappt (wie beim Vorbild in Schussposition) – stand senkrecht genau auf der Visierlinie
  // und verdeckte im Anschlag das Korn
  b.tube('gbSteel', [[-0.014, AXIS - 0.004, 0.41], [-0.05, AXIS - 0.01, 0.42], [-0.06, AXIS - 0.012, 0.46], [-0.052, AXIS - 0.01, 0.51], [-0.014, AXIS - 0.004, 0.52]], 0.0055);
  b.lathe('gbGrip', [[0, 0], [0, 0.0085], [0.004, 0.0095], [0.062, 0.0095], [0.066, 0.0085], [0.066, 0]], -0.06, AXIS - 0.012, 0.432, { seg: b.seg(14, 5) });
  // Zweibein: Bügel am Gaszylinder, Beine (Teleskop) nach vorn geklappt, Füße
  b.box('gbSteel', 0.036, 0.018, 0.024, 0, AXIS - 0.038, 0.6, { c: 0.002 });
  for (const s of [-1, 1]) {
    b.cyl('gbSteel', 0.0055, 0.0055, 0.13, s * 0.013, AXIS - 0.044, 0.68, { ry: s * -0.03, seg: b.seg(10, 4) });
    b.cyl('gbSteel', 0.0042, 0.0042, 0.1, s * 0.0155, AXIS - 0.044, 0.79, { ry: s * -0.03, seg: b.seg(10, 4) });
    b.box('rubber', 0.014, 0.012, 0.03, s * 0.017, AXIS - 0.046, 0.848, { c: 0.003 });
  }
  slab(b, mm([[818, 70], [842, 70], [842, 96], [834, 100], [826, 100], [818, 96]]), 0.0115, 0.003, 'gbSteel', { id: 'fsb', cav: STEEL });
  b.side('gbSteel', mm([[826, 98], [834, 98], [832, SV * 1000], [828, SV * 1000]]), 0.0036, 0, { bevel: 0.0006 });
  b.lathe('gbBlued', [[0, 0], [0, 0.0135], [0.008, 0.0145], [0.065, 0.019], [0.065, 0.014]], 0, AXIS, 0.88, { seg: b.seg(20, 6) });
  if (b.hi) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; b.box('cavity', 0.003, 0.003, 0.045, Math.cos(a) * 0.0168, AXIS + Math.sin(a) * 0.0168, 0.915, { rz: a, c: 0 }); }
  b.bore(0.012, 0, AXIS, 0.9455);
  b.anchor('muzzle', 0, AXIS, 0.946);

  // --- Munitionskasten links (Teil 'mag') mit Deckel ('lid', Scharnier außen) und Gurt ('belt')
  b.part('mag', -0.06, 0.0, 0.1);
  slab(b, mm([[36, 38], [164, 38], [164, -60], [36, -60]]), 0.037, 0.004, 'gbOlive', { x: -0.065, part: 'mag', cav: STEEL, cut: (x, v, u, d) => {
    for (let i = 0; i < 3; i++) d = Math.min(d, Math.max(Math.abs(x) - 0.0385, Math.abs(v + 0.03 - i * 0.025) - 0.002, Math.abs(u - 0.1) - 0.062));   // Sicken
    return d;
  } });
  b.part('lid', -0.1045, 0.026, 0.1, 'mag');
  b.box('gbOlive', 0.079, 0.012, 0.134, -0.065, 0.032, 0.1, { part: 'lid', c: 0.003 });
  if (b.hi) {
    b.box('gbSteel', 0.03, 0.004, 0.012, -0.065, 0.04, 0.1, { part: 'lid', c: 0.001 });
    for (const u of [0.045, 0.155]) b.cyl('gbSteel', 0.003, 0.003, 0.02, -0.1045, 0.027, u, { part: 'lid', seg: 8 });
    b.box('paintYellow', 0.0006, 0.012, 0.06, -0.1032, -0.015, 0.1, { part: 'mag', c: 0 });
    b.box('gbSteel', 0.014, 0.004, 0.03, -0.065, -0.062, 0.1, { part: 'mag', c: 0.001 });
    b.box('gbSteel', 0.004, 0.03, 0.012, -0.1035, 0.01, 0.06, { part: 'mag', c: 0.001 });   // Klemmverschluss
  }
  b.part('belt', 0, 0, 0, 'mag');
  const beltAt = (t) => [-0.075 + t * 0.05 + Math.sin(t * Math.PI) * -0.012, 0.035 + t * 0.06 + Math.sin(t * Math.PI) * 0.018, 0.098];
  magRounds(b, { part: 'belt', cal: 'r308', fit: 0.066, link: true, stagger: false, follower: false, spread: 9, path: Array.from({ length: 9 }, (_, i) => beltAt(1 - i / 8)) });
  if (!b.hi) b.box('brass', 0.03, 0.06, 0.05, -0.06, 0.06, 0.095, { part: 'belt', rz: -0.5 });
  b.anchor('magGrab', -0.065, -0.01, 0.1, { part: 'mag', data: { w: 0.0375, d: 0.065 } });

  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.32, gw: 0.016, gd: 0.02, gu: 0.006, ho: 0.039, tu: 0.03 } });
  b.anchor('magWell', -0.06, 0.0, 0.1);
  b.anchor('sight', 0, SV, -0.08, { data: { type: 'iron', eyeRelief: 0.28 } });
  b.anchor('leftHandGrip', 0, AXIS - 0.04, 0.32, { data: { style: 'under', r: 0.033 } });
  b.meta = { sight: 'iron', axis: AXIS, kind: 'lmg' };
}
