// SM-45 Keiler nach Vorbild (UMP45, 13.11.2026 – Nutzerwunsch „Waffenmodelle anhand der echten Versionen so detailliert wie
// möglich“). Maße vom Foto (linke Seite, Mündung links, weißer Grund): https://commons.wikimedia.org/wiki/File:HKUMP45.JPG
// Kalibrierung: Gesamtlänge mit ausgeklapptem Schaft 690 mm (Mündung x 15 … Schaftkappe x 1528) → 2193 px/m; Prüfmaß
// Magazin (25 Schuss .45) ≈ 180 mm (Foto 392 px = 179 mm). Vorderer Zusatzgriff des Fotos weggelassen (Schiene bleibt).
// Ohne Herstellerzeichen. Bauteile: Gehäuse (glasfaserverstärkt) mit Kornturm, Spannschieber-Kanal links, Durchbrüchen,
// Auswurffenster rechts, Picatinny oben; Griffstück mit Schacht, Abzugsbügel, Griff; Klappschaft (Rahmen mit zwei
// Fenstern, Gelenk mit Riegel); Trommeldiopter; Mündungsfeuerdämpfer (vier Schlitze), Laufmutter; Magazin mit Rippen.
import { ref, slab, rrect, pocket, POLY } from './gbkit.js?v=20261123115551';
import { redDot } from './parts.js?v=20261123115551';
import { magRounds } from './magfill.js?v=20261123115551';
import { schrift } from './schrift.js?v=20261123115551';   // Gravuren (14.11., gfx-waffen)
const MARK_KEILER = schrift('keiler').mark;

const R = ref(2193, 898, 315);
const { U, V, M, L } = R;
const AXIS = V(178);
const SIGHT_Y = 38;

// Gehäuse: Kornturm vorn, Oberkante, Schienenbasis, Kimmenturm, Endkappe, Unterkante mit vorderer Kappe (Riemenbügel)
const REC = M([[173, 205], [173, 150], [178, 62], [188, 55], [252, 55], [270, 70], [292, 85], [472, 85], [472, 80], [900, 80],
  [902, 44], [948, 44], [972, 62], [1003, 90], [1032, 95], [1062, 112], [1092, 128], [1092, 222], [1050, 222], [990, 230],
  [520, 230], [500, 228], [445, 228], [222, 228], [222, 270], [214, 282], [196, 282], [188, 262], [180, 240], [173, 228]]);
// Griffstück (schmaler): Magazinschacht vorn, Unterkante bis zum Bügel, Griffansatz hinten
const LOWER = M([[520, 212], [1000, 212], [1000, 232], [975, 248], [953, 243], [928, 262], [845, 286], [690, 286], [632, 286],
  [632, 307], [521, 307], [524, 250]]);
const GRIP = M([[828, 280], [858, 274], [946, 252], [962, 285], [1000, 420], [1002, 436], [985, 466], [960, 478], [925, 486],
  [903, 482], [895, 462], [885, 400], [850, 320]]);
const STOCK = M([[1088, 128], [1150, 140], [1250, 140], [1490, 137], [1515, 142], [1528, 160], [1528, 340], [1515, 350],
  [1500, 352], [1462, 348], [1430, 340], [1360, 315], [1200, 252], [1100, 228], [1088, 226]]);
const STOCK_HOLES = [M([[1215, 175], [1258, 175], [1263, 214], [1250, 240], [1222, 246], [1196, 232], [1210, 214]]),
  M([[1290, 172], [1460, 170], [1467, 180], [1466, 304], [1450, 316], [1438, 318], [1305, 256]])];
const MAG = M([[532, 300], [614, 300], [608, 330], [541, 700], [536, 712], [455, 702], [453, 690], [460, 668], [528, 320]]);

// Breite je Bauteil (m, halb): Gehäuse oben 21,5 mm, unten 23 mm (Absatz bei y 140), Kornturm schmal
const hwRec = (u, v) => {
  if (u > U(255) && v > V(85)) return 0.012;                       // Kornturm (Ohren)
  if (u < U(900) && v > V(80)) return 0.0135;                      // Kimmenturm über der Schiene
  return v > V(140) ? 0.0215 : 0.023;
};

export function keiler(b) {
  // Gravuren: Typ/Kaliber/Nummer (Fantasie), eingeschnitten (schrift.js)
  MARK_KEILER(b, 'SM-45  KEILER  KAL .45', -(0.0215 + 0.0002), V(121), U(720), 0.0034);
  MARK_KEILER(b, 'NP 450918', -(0.0215 + 0.0002), V(131), U(735), 0.0026);
  // --- Gehäuse mit Kanälen, Durchbrüchen, Auswurffenster (rechts)
  const slotsL = [[225, 318, 152, 5], [358, 452, 151, 7], [465, 525, 176, 8]].map(([x0, x1, y, h]) => [(U(x0) + U(x1)) / 2, V(y), (U(x0) - U(x1)) / 2, L(h)]);
  const cutRec = (x, v, u, d) => {
    // Spannschieber-Kanal links (Schieber läuft darin nach hinten)
    d = pocket(d, x, rrect(u, v, (U(292) + U(462)) / 2, V(108), (U(292) - U(462)) / 2, L(10), 0.003), 0.0165, -1);
    for (const [cu, cv, hu, hv] of slotsL) d = pocket(d, x, rrect(u, v, cu, cv, hu, hv, Math.min(hu, hv)), 0.018);
    // Auswurffenster rechts (Verschluss sichtbar)
    d = pocket(d, x, rrect(u, v, (U(470) + U(610)) / 2, V(132), (U(470) - U(610)) / 2, L(22), 0.003), 0.008, 1);
    // Längsnut am Absatz (Formteilnaht)
    d = Math.max(d, -(Math.hypot(Math.abs(x) - 0.023, v - V(140)) - 0.0009));
    return d;
  };
  slab(b, REC, hwRec, 0.0035, 'gbPoly', { hwMax: 0.023, cut: cutRec, step: 0.0024, id: 'rec' });
  slab(b, LOWER, 0.0195, 0.003, 'gbPoly', { id: 'lower', cut: (x, v, u, d) => pocket(d, x, rrect(u, v, U(576), V(258), L(40), L(30), 0.004), 0.0175) });
  slab(b, GRIP, (u, v) => 0.0135 + 0.002 * Math.min(1, Math.max(0, (V(300) - v) / 0.06)), 0.007, 'gbGrip', { hwMax: 0.0155, id: 'grip' });
  slab(b, STOCK, (u, v) => (u > U(1465) ? 0.0105 : 0.0165), 0.004, 'gbPoly', { hwMax: 0.0165, holes: STOCK_HOLES, id: 'stock' });
  if (b.hi) {
    // Schaftkappe mit Gummirillen, Gelenk + Riegel (Wippe), Riemenöse
    b.box('rubber', 0.031, L(196), 0.006, 0, V(246), U(1525), { c: 0.002 });
    for (let i = 0; i < 7; i++) b.box('cavity', 0.032, 0.0012, 0.0062, 0, V(165) + 0.002 - i * L(26), U(1525), { c: 0 });
    for (const y of [127, 224]) b.cyl('gbSteel', 0.0075, 0.0075, 0.003, 0, V(y), U(1094), { axis: 'v', seg: 14 });
    b.box('gbGrip', 0.006, L(70), L(28), -0.023, V(182), U(1068), { rx: -0.25, c: 0.002 });
    b.cyl('gbSteel', 0.0035, 0.0035, 0.034, 0, V(325), U(1452), { axis: 'x', seg: 10 });
  }

  // --- Picatinny oben, kurze Schiene unten vorn
  b.picatinny('gbAlu', 0, V(80), U(900), U(474));
  b.picatinny('gbAlu', 0, V(228), U(445), U(225), { rz: Math.PI });

  // --- Kornturm (Ringkorn) und Trommeldiopter
  if (b.hi) {
    b.torus('gbPoly', L(17), 0.0032, 0, V(34), U(220), { ry: Math.PI / 2, seg: 8, tseg: 22 });
    b.box('gbSteel', 0.0024, L(26), 0.003, 0, V(SIGHT_Y) - L(10), U(220), { c: 0 });
    b.cyl('gbSteel', L(19), L(19), 0.024, 0, V(52), U(917), { axis: 'x', seg: 20 });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; b.cyl('cavity', 0.0018, 0.0018, 0.026, 0, V(52) + Math.sin(a) * L(12), U(917) + Math.cos(a) * L(12), { axis: 'x', seg: 8 }); }
    b.box('gbSteel', 0.003, 0.003, 0.004, 0, V(SIGHT_Y) + 0.0015, U(917), { c: 0 });
  } else {
    b.box('gbPoly', 0.012, L(30), L(40), 0, V(40), U(220));
    b.box('gbPoly', 0.024, L(36), L(40), 0, V(52), U(917));
  }

  // --- Lauf, Laufmutter, Mündungsfeuerdämpfer mit vier Schlitzen
  b.cyl('gbBlued', L(19), L(19), L(45), 0, AXIS, (U(132) + U(176)) / 2, { seg: b.seg(18, 6) });
  b.cyl('gbBlued', L(34), L(34), L(26), 0, AXIS, (U(145) + U(171)) / 2, { seg: b.seg(24, 8) });
  if (b.hi) for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; b.box('gbBlued', 0.002, 0.003, L(24), Math.cos(a) * L(34), AXIS + Math.sin(a) * L(34), (U(145) + U(171)) / 2, { rz: a, c: 0 }); }
  b.lathe('gbBlued', [[0, 0], [0, L(21)], [0.003, L(22)], [L(118), L(22)], [L(120), L(20)], [L(120), 0]], 0, AXIS, U(135), { seg: b.seg(20, 6) });
  if (b.hi) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; b.box('cavity', 0.0028, 0.003, L(62), Math.cos(a) * L(21.5), AXIS + Math.sin(a) * L(21.5), U(15) - L(40), { rz: a, c: 0 }); }
  b.bore(0.0058, 0, AXIS, U(15) + 0.0005);
  b.anchor('muzzle', 0, AXIS, U(15) + 0.002);

  // --- Bedienteile links: Wahlhebel, Magazinhalter (Wippe hinter dem Schacht), Stifte
  if (b.hi) {
    b.box('gbGrip', 0.004, L(14), L(58), -0.0205, V(232), U(842), { rx: 0.35, c: 0.0015 });
    b.cyl('gbSteel', L(14), L(14), 0.004, -0.0205, V(232), U(818), { axis: 'x', seg: 14 });
    b.box('gbGrip', 0.03, L(62), L(14), 0, V(320), U(639), { c: 0.002 });
    for (const [x, y] of [[190, 178], [430, 175], [650, 200], [985, 210], [525, 230], [1175, 188], [1200, 180]]) for (const s of [-1, 1]) {
      const hw = x < 1092 ? (y > 140 ? 0.023 : 0.0215) : 0.0165;
      b.cyl('gbSteel', L(x === 650 ? 13 : 9), L(x === 650 ? 13 : 9), 0.0016, s * (hw + 0.0003), V(y), U(x), { axis: 'x', seg: 14 });
    }
  }

  // --- Abzugsbügel (Teil des Griffstücks) und Abzug
  slab(b, M([[688, 280], [704, 356], [802, 358], [826, 332], [846, 280]]), 0.0065, 0.0022, 'gbPoly',
    { holes: [M([[703, 288], [715, 345], [796, 347], [813, 328], [829, 288]])], id: 'guard' });
  b.side('gbSteel', M([[786, 288], [790, 300], [796, 318], [795, 338], [790, 346], [786, 344], [788, 330], [786, 312], [781, 298], [780, 288]]), 0.006, 0, { bevel: 0.001 });

  // --- Spannschieber links vorn (läuft im Kanal zurück)
  b.part('charge', -0.02, V(108), U(265));
  b.box('gbPoly', 0.012, L(24), L(48), -0.026, V(110), U(265), { part: 'charge', c: 0.003 });
  if (b.hi) b.box('gbGrip', 0.004, L(20), L(40), -0.0325, V(110), U(265), { part: 'charge', c: 0.0012 });
  b.anchor('chargeGrab', -0.034, V(110), U(268), { part: 'charge', data: { travel: [0, 0, L(168)], style: 'pull' } });

  // --- Verschluss im Auswurffenster (rechts)
  b.part('bolt', 0, V(132), U(540));
  b.box('gbBolt', 0.004, L(40), L(130), 0.0145, V(132), U(540), { part: 'bolt', c: 0.001 });
  if (b.hi) b.box('cavity', 0.012, L(46), L(136), 0.008, V(132), U(540), { c: 0 });

  // --- Magazin (25 × .45): Polymer, Längsrippen, Sichtfenster, Bodenplatte
  b.part('mag', 0, V(307), U(574));
  const magAxis = Math.atan2(U(498) - U(574), V(697) - V(307));   // Neigung (nach vorn unten)
  slab(b, MAG, 0.0138, 0.0025, 'gbPolyGrey', { part: 'mag', cav: POLY, step: 0.0024 });
  if (b.hi) {
    const t = (y) => [U(574) + (U(498) - U(574)) * (y - 307) / 390, V(y)];
    for (const s of [-1, 1]) {
      const [u0, v0] = t(500);
      b.box('smokeDark', 0.0008, L(300), L(14), s * 0.0141, v0, u0 + 0.006, { part: 'mag', rx: -magAxis, c: 0 });
      for (const y of [360, 640]) { const [u1, v1] = t(y); b.box('gbPolyGrey', 0.0016, L(22), L(66), s * 0.0141, v1, u1, { part: 'mag', rx: -magAxis, c: 0.0006 }); }
    }
    const [ub, vb] = t(704);
    b.box('gbPolyGrey', 0.031, L(16), L(92), 0, vb, ub, { part: 'mag', rx: -magAxis, c: 0.002 });
  }
  magRounds(b, { cal: 'p45', width: 0.025, depth: 0.04, show: 3, path: [[0, V(304), U(575)], [0, V(690), U(500)]] });
  b.anchor('magGrab', 0, V(520), U(535), { part: 'mag', data: { w: 0.014, d: 0.022 } });
  b.anchor('magWell', 0, V(307), U(574));

  // --- Rotpunkt (wie bisher) auf der Schiene
  redDot(b, U(640), V(80) + 0.0077, { style: 'ring' });

  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.32, gw: 0.016, gd: 0.023, gu: 0.0, ho: 0.02, tu: 0.034 } });
  b.anchor('leftHandGrip', 0, V(240), U(360), { data: { style: 'under', w: 0.022, h: 0.024 } });
  b.meta = { sight: 'reddot', axis: AXIS, kind: 'smg' };
}
