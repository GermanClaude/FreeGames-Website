// KM-7 Wespe nach Vorbild (Vector-Bauart, 9 mm, 13.11.2026 – Nutzerwunsch „Waffenmodelle anhand der echten Versionen so
// detailliert wie möglich“). Maße nach Datenblatt/Fotos des Vorbilds (Lauf 140 mm, Länge mit ausgezogenem Schaft ≈ 740 mm,
// Gehäusebreite ≈ 55 mm, 33-Schuss-Magazin ≈ 210 mm); Fotos des Vorbilds konnten wegen Zugriffsgrenzen nicht geladen
// werden – Umrisse nach bekannten Proportionen in Millimetern. Ohne Herstellerzeichen.
// Kennzeichen der Bauart: hohes, schmales Oberteil mit durchgehender Schiene; Unterteil mit schräger „Nase“ unter dem Lauf
// (Schlitten-Umlenksystem), Magazinschacht VOR dem Abzugsbügel, Laufmantel facettiert, Klappschaft-Adapter mit Schaftrohr
// und Teleskopschaft, Klappvisiere, Spannhebel links vorn (klappbarer Knauf).
import { mm, slab, rrect, pocket, POLY } from './gbkit.js?v=20261114060746';
import { magRounds } from './magfill.js?v=20261114060746';
import { apertureSight } from './pistol-parts.js?v=20261114060746';   // Lochkimme mit Durchblick (visier, 14.11.)
import { schrift } from './schrift.js?v=20261114060746';   // Gravuren (14.11., gfx-waffen)
const MARK_WESPE = schrift('wespe').mark;

const AXIS = 0.046;
const RAIL = 0.074;                    // Schienenunterkante (Oberteil-Oberkante)
const SIGHT = RAIL + 0.0077 + 0.024;   // Visierlinie über den Klappvisieren

// Oberteil (Aluminium) – Profil [u, v] mm
const UPPER = mm([[-128, 74], [200, 74], [208, 70], [208, 24], [-128, 24]]);
// Unterteil (Polymer): hinten am Schaftadapter, Griffansatz, Abzugsbügel-Ansatz, Schacht, schräge Nase bis unter den Laufmantel
const LOWER = mm([[-128, 34], [-128, 2], [-112, -2], [-40, -2], [-30, -8], [14, -8], [22, -4], [40, -4], [52, -12],
  [56, -78], [118, -78], [124, -72], [158, -32], [164, -28], [218, -28], [222, -24], [222, 30], [200, 34]]);
const GUARD = mm([[10, -6], [8, -48], [16, -56], [50, -56], [56, -50], [56, -8]]);
const GUARD_HOLE = mm([[16, -8], [16, -44], [22, -49], [46, -49], [50, -44], [50, -8]]);
const GRIP = mm([[14, 0], [20, -22], [4, -98], [-4, -110], [-34, -112], [-42, -104], [-30, -30], [-32, 0]]);
// Laufmantel (facettiert, vorn schräg)
const SHROUD = mm([[205, 70], [244, 66], [262, 56], [268, 40], [262, 26], [205, 24]]);
// Teleskopschaft (Polymer) am Schaftrohr, mit Kammstück und Kolbenkappe
const STOCK = mm([[-206, 66], [-352, 70], [-372, 70], [-380, 62], [-380, -30], [-368, -40], [-340, -36], [-290, -4], [-232, 22], [-206, 28]]);
const MAG = mm([[66, -60], [110, -60], [106, -206], [104, -214], [70, -214], [68, -206]]);

export function wespe(b) {
  // Gravuren: Typ/Kaliber/Nummer (Fantasie), eingeschnitten (schrift.js)
  MARK_WESPE(b, 'KM-7  WESPE  KAL .45', -(0.0215 + 0.0002), 0.05, 0.06, 0.0034);
  MARK_WESPE(b, 'NP 071345', 0.0215 + 0.0002, 0.052, -0.09, 0.0026);
  // --- Oberteil mit Auswurffenster (rechts) und Längsnut für den Spannhebel (links)
  slab(b, UPPER, 0.0215, 0.003, 'gbAlu', { id: 'upper', cav: POLY, cut: (x, v, u, d) => {
    d = pocket(d, x, rrect(u, v, 0.03, 0.05, 0.026, 0.009, 0.002), 0.012, 1);           // Auswurf
    d = pocket(d, x, rrect(u, v, 0.105, 0.05, 0.095, 0.0028, 0.0025), 0.018, -1);        // Spannhebel-Bahn
    d = Math.max(d, -(Math.hypot(Math.abs(x) - 0.0215, v - 0.062) - 0.0008));            // Zierfuge
    return d;
  } });
  // --- Unterteil (Polymer): seitliche Mulden, Schachtrand, Nase mit Querrillen
  slab(b, LOWER, (u, v) => (u > 0.06 && v < -0.004 ? 0.0205 : 0.0265), 0.0045, 'gbPoly', { hwMax: 0.0265, id: 'lower', cut: (x, v, u, d) => {
    d = pocket(d, x, rrect(u, v, -0.07, 0.014, 0.05, 0.008, 0.004), 0.0235);              // Mulde hinten
    d = pocket(d, x, rrect(u, v, 0.185, -0.004, 0.026, 0.014, 0.005), 0.0235);           // Mulde in der Nase
    // Querrillen auf der Schräge (Greiffläche vor dem Schacht)
    for (let i = 0; i < 4; i++) { const cu = 0.128 + i * 0.008, cv = -0.068 + i * 0.0092; d = Math.max(d, -(Math.hypot(u - cu, v - cv) - 0.0016)); }
    return d;
  } });
  slab(b, GUARD, 0.0085, 0.003, 'gbPoly', { holes: [GUARD_HOLE], id: 'guard' });
  slab(b, GRIP, (u, v) => 0.0135 + 0.0015 * Math.min(1, Math.max(0, -v / 0.05)), 0.0075, 'gbGrip', { hwMax: 0.015, id: 'grip' });
  slab(b, SHROUD, (u, v) => 0.018 - Math.max(0, u - 0.24) * 0.25, 0.004, 'gbPoly', { hwMax: 0.018, id: 'shroud' });
  // Abzug, Wahlhebel (links), Magazinhalter, Stifte
  b.side('gbSteel', mm([[30, -8], [32, -20], [36, -34], [34, -40], [30, -38], [28, -26], [26, -10]]), 0.006, 0, { bevel: 0.001 });
  if (b.hi) {
    b.cyl('gbSteel', 0.0065, 0.0065, 0.004, -0.0285, 0.016, -0.012, { axis: 'x', seg: 16 });
    b.box('gbGrip', 0.004, 0.006, 0.022, -0.0305, 0.016, -0.004, { rx: -0.5, c: 0.0012 });
    b.box('gbGrip', 0.03, 0.012, 0.01, 0, -0.07, 0.054, { c: 0.002 });
    for (const [u, v] of [[-0.11, 0.012], [-0.06, 0.03], [0.15, 0.012], [0.09, -0.02], [-0.02, 0.006]]) for (const s of [-1, 1]) b.cyl('gbSteel', 0.0032, 0.0032, 0.0016, s * 0.0268, v, u, { axis: 'x', seg: 12 });
  }

  // --- Schienen: oben durchgehend, unten an der Nase (schräg) für den Vordergriff
  b.picatinny('gbAlu', 0, RAIL, -0.124, 0.198);
  b.picatinny('gbAlu', 0, -0.028, 0.166, 0.216, { rz: Math.PI });
  // Klappvisiere (aufgeklappt): Korn vorn mit Schutzohren, Diopter hinten
  // visier (14.11.): mit montierter Optik (Aufsatz) liegen beide Klappvisiere umgelegt auf der Schiene
  const folded = !!(b.att && b.att.optik);
  sight(b, 0.178, true, folded);
  sight(b, -0.104, false, folded);

  // --- Lauf, Mündungsgewinde, Feuerdämpfer
  b.cyl('gbBlued', 0.0076, 0.0076, 0.04, 0, AXIS, 0.286, { seg: b.seg(18, 6) });
  b.lathe('gbBlued', [[0, 0], [0, 0.0098], [0.002, 0.0102], [0.034, 0.0102], [0.036, 0.0094], [0.036, 0]], 0, AXIS, 0.302, { seg: b.seg(20, 6) });
  if (b.hi) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; b.box('cavity', 0.0022, 0.0024, 0.016, Math.cos(a) * 0.0101, AXIS + Math.sin(a) * 0.0101, 0.326, { rz: a, c: 0 }); }
  b.bore(0.0046, 0, AXIS, 0.3385);
  b.anchor('muzzle', 0, AXIS, 0.34);

  // --- Schaftadapter (Klappgelenk), Schaftrohr, Teleskopschaft
  slab(b, mm([[-128, 70], [-160, 70], [-166, 62], [-166, 0], [-150, -4], [-128, -4]]), 0.019, 0.004, 'gbPoly', { id: 'adapter' });
  b.cyl('gbAlu', 0.0146, 0.0146, 0.2, 0, 0.044, -0.262, { seg: b.seg(22, 8) });
  if (b.hi) for (let i = 0; i < 6; i++) b.box('cavity', 0.004, 0.0035, 0.008, 0, 0.044 - 0.0145, -0.2 - i * 0.02, { c: 0 });   // Rastlöcher unten
  slab(b, STOCK, 0.0195, 0.006, 'gbPoly', { id: 'stock', cut: (x, v, u, d) => pocket(d, x, rrect(u, v, -0.31, 0.0, 0.045, 0.014, 0.008), 0.0165) });
  b.box('rubber', 0.038, 0.105, 0.008, 0, 0.016, -0.384, { c: 0.003 });
  if (b.hi) { b.box('gbGrip', 0.012, 0.008, 0.026, 0, 0.026, -0.226, { c: 0.002 }); b.cyl('gbSteel', 0.007, 0.007, 0.042, 0, 0.04, -0.147, { axis: 'v', seg: 14 }); }

  // --- Spannhebel links (Knauf klappbar) und Verschluss
  b.part('charge', -0.022, 0.05, 0.13);
  b.box('gbSteel', 0.008, 0.005, 0.022, -0.0225, 0.05, 0.13, { part: 'charge', c: 0.001 });
  b.box('gbGrip', 0.014, 0.012, 0.016, -0.031, 0.05, 0.134, { part: 'charge', c: 0.003 });
  b.anchor('chargeGrab', -0.038, 0.05, 0.134, { part: 'charge', data: { travel: [0, 0, 0.07], style: 'pull' } });
  b.part('bolt', 0, 0.05, 0.03);
  b.box('gbBolt', 0.004, 0.015, 0.048, 0.0125, 0.05, 0.03, { part: 'bolt', c: 0.001 });

  // --- Vordergriff (senkrecht) an der Nasenschiene
  b.lathe('gbGrip', [[0, 0], [0, 0.0135], [0.004, 0.0145], [0.062, 0.0135], [0.068, 0.0125], [0.072, 0]], 0, -0.042, 0.19, { axis: 'v', seg: b.seg(18, 6), rx: Math.PI });
  b.box('gbPoly', 0.024, 0.01, 0.03, 0, -0.04, 0.19, { c: 0.002 });

  // --- Magazin (33 × 9 mm, Polymer mit Stahleinlage): Bodenplatte, Rippen, Zähllöcher hinten
  b.part('mag', 0, -0.078, 0.088);
  slab(b, MAG, 0.0118, 0.003, 'gbPoly', { part: 'mag', cav: POLY, step: 0.002 });
  if (b.hi) {
    b.box('gbPoly', 0.026, 0.012, 0.048, 0, -0.208, 0.087, { part: 'mag', c: 0.003 });
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) b.cyl('cavity', 0.0013, 0.0013, 0.0012, s * 0.0118, -0.09 - i * 0.018, 0.07, { part: 'mag', axis: 'x', seg: 8 });
  }
  magRounds(b, { cal: 'p9', fit: 0.03, width: 0.019, depth: 0.03, path: [[0, 0.012, 0.088], [0, -0.198, 0.087]] });
  b.anchor('magGrab', 0, -0.17, 0.088, { part: 'mag', data: { w: 0.012, d: 0.02 } });
  b.anchor('magWell', 0, -0.078, 0.088);

  b.anchor('rightHandGrip', 0, -0.012, 0, { data: { rake: 0.2, gw: 0.0145, gd: 0.022, gu: 0.0, ho: 0.03, tu: 0.04 } });
  b.anchor('sight', 0, SIGHT, -0.104, { data: { type: 'iron', eyeRelief: 0.24 } });
  b.anchor('leftHandGrip', 0, -0.075, 0.19, { data: { style: 'post', rake: 0.0, gw: 0.013, gd: 0.014, gu: 0, ho: 0.01 } });
  b.meta = { sight: 'iron', axis: AXIS, kind: 'smg' };
}

// Klappvisier (aufgeklappt) auf der Schiene: Fuß mit Klemme, Flügel, Korn (Säule mit Ohren) bzw. Diopter (Lochblende)
function sight(b, u, front, folded = false) {
  const base = RAIL + 0.0077;
  b.box('gbAlu', 0.024, 0.008, 0.026, 0, base + 0.004, u, { c: 0.002 });
  if (folded) {   // umgelegt: Flügel flach nach vorn (Korn) bzw. hinten (Diopter) auf dem Fuß
    b.box('gbAlu', 0.016, 0.004, 0.026, 0, base + 0.01, u + (front ? 0.006 : -0.006), { c: b.hi ? 0.001 : 0 });
    return;
  }
  if (!b.hi) { b.box('gbAlu', 0.016, 0.02, 0.008, 0, base + 0.014, u); return; }
  b.box('gbAlu', 0.004, 0.004, 0.02, 0.014, base + 0.002, u, { c: 0.001 });
  if (front) {
    for (const s of [-1, 1]) b.box('gbAlu', 0.004, 0.026, 0.008, s * 0.009, base + 0.016, u, { c: 0.001 });
    b.box('gbSteel', 0.0024, 0.02, 0.0024, 0, base + 0.014, u, { c: 0 });
    b.box('gbAlu', 0.02, 0.004, 0.008, 0, base + 0.006, u, { c: 0.001 });
  } else {
    // Diopterflügel mit rundem Durchblick Ø 6,4 mm (visier, 14.11.: vorher Vollplatte 22 × 30 mm mit schwarzem Punkt – das Loch lief
    // quer statt längs, im Anschlag ein Balken vor dem Ziel); Fuß des Flügels breit, oben schmaler Ring um die Blende
    b.side('gbAlu', [[-0.004, 0], [0.004, 0], [0.003, 0.012], [-0.003, 0.012]].map(([du, dv]) => [u + du, base + dv]), 0.016, 0, { bevel: 0.001 });
    apertureSight(b, 'gbAlu', { x0: -0.0075, x1: 0.0075, v0: base + 0.011, v1: SIGHT + 0.0068, cv: SIGHT, r: 0.0032, u: u - 0.002, l: 0.004 });
    for (const s of [-1, 1]) b.box('gbAlu', 0.004, 0.02, 0.01, s * 0.0115, base + 0.012, u, { c: 0.001 });
  }
}
