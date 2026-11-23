// Waffen-Welle 3, Teil A (20.11.2026, Nutzerwunsch „füge mehr Waffen hinzu, alle enorm detailliert“): frei erfundene Waffen
// nach realen Bauarten – keine Nachbauten bestimmter Modelle, keine Herstellerzeichen. Maße plausibel nach Gattung.
//   MS-9 Uhu      Maschinenpistole 9 mm mit Integralschalldämpfer: Rundgehäuse (Stahlrohr) auf Polymer-Griffstück,
//                 Masseverschluss, Dämpfermantel über die ganze Lauflänge mit Rändelbändern und Abschlusskappe, seitlich
//                 klappbarer Rohrschaft, gerades 30-Schuss-Magazin, Diopter auf der Schiene, Korn mit Schutzring.
//   BL-7 Luchs    Bullpup-Sturmgewehr 5,56 mm: Polymerschale mit Wangenauflage, Magazin hinter dem Griff, Spannhebel links
//                 vorn, durchgehende Schiene mit Rotpunkt und Klappkimme, M-LOK-Handschutz, Käfig-Feuerdämpfer.
//   KD-74 Dachs   Kurzkarabiner 7,62 × 39: Aluminium-Monolith mit Schiene, Kurzhub-Gaskolben, Spannhebel rechts, seitlich
//                 klappbarer Rohrschaft mit Wangenstück, gebogenes Stahlmagazin, Mündungskegel, Klappvisier.
//   DM-11 Elster  Halbautomatisches Präzisionsgewehr 7,62 × 51: Stahlgehäuse, Schichtholzschaft mit verstellbarer
//                 Wangenauflage und Daumenmulde, frei schwingender Aluminium-Handschutz, 20-Schuss-Magazin, 4×-Kampfvisier,
//                 Mündungsbremse, Zweibein-Aufnahme.
// Teile/Anker für Hände, Nachladen und Anschlag wie die bisherigen Waffen (mag, bolt, charge, selector; magGrab, magWell,
// chargeGrab, rightHandGrip, leftHandGrip, sight, muzzle, ejection, trigger) – Animationen (anim/reloads.js), Infanterie-
// simulation (isim/gun.js) und VR (engine/xr/hands.js) arbeiten damit ohne Sonderfall.
import { mm, slab, rrect, pocket, POLY, STEEL, pinHead, slotScrew, pistolGrip, triggerUnit, boxMag, barrel, frontSight, rearNotch, swivel, selectorLever, boltInPort, chargeKnob, ownMuzzle, serrations, rivets } from './neu-kit.js?v=20261123115551';
import { redDot, acog, ejectionPort } from './parts.js?v=20261123115551';
import { apertureSight } from './pistol-parts.js?v=20261123115551';
import { checkering } from './guns-flinten.js?v=20261123115551';
import { schrift } from './schrift.js?v=20261123115551';
const MARK_UHU = schrift('uhu').mark;
const MARK_LUCHS = schrift('luchs').mark;
const MARK_DACHS = schrift('dachs').mark;
const MARK_ELSTER = schrift('elster').mark;

/* ================================================================== MS-9 Uhu (MP mit Integralschalldämpfer) */

export function uhu(b) {
  const AX = 0.056, R = 0.0168;
  MARK_UHU(b, 'MS-9  UHU  KAL 9 × 19', -(R + 0.0003), AX - 0.004, -0.02, 0.0028);
  MARK_UHU(b, 'NP 090311', -(R + 0.0003), AX - 0.0085, -0.02, 0.0022);
  // --- Gehäuserohr (Stahl) mit Endkappe hinten, Prägenaht, Kühlrillen vorn
  barrel(b, 'gaBlued', AX, -0.098, [[0, R * 0.96], [0.004, R], [0.236, R], [0.24, R * 0.985]], { seg: 32 });
  b.lathe('gaSteel', [[0, 0], [0, R * 0.92], [0.012, R * 1.02], [0.016, R * 1.02], [0.018, R * 0.9], [0.018, 0]], 0, AX, -0.114, { seg: b.seg(32, 8) });
  if (b.hi) {
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; b.box('cavity', 0.0012, 0.0007, 0.011, Math.cos(a) * R * 1.02, AX + Math.sin(a) * R * 1.02, -0.105, { rz: a, c: 0 }); }   // Griffriefen Endkappe
    b.box('gaBlued', 0.0012, 0.0016, 0.23, 0, AX - R + 0.0004, 0.02, { c: 0.0003 });                                                 // Schweißnaht unten
    pinHead(b, 'gaBolt', R * 0.97, AX - 0.006, -0.088, 0.0026);                                                                        // Endkappen-Riegel
  }
  // --- Griffstück (Polymer): Schacht, Abzugsgruppe, Daumenauflage
  const LOWER = mm([[-92, 40], [134, 40], [134, 28], [118, 18], [104, 4], [56, 4], [56, -8], [34, -8], [24, 6], [-34, 6], [-60, 14], [-92, 22]]);
  slab(b, LOWER, 0.0155, 0.004, 'gaPoly', { id: 'lower', cav: POLY, cut: (x, v, u, d) => {
    d = pocket(d, x, rrect(u, v, -0.05, 0.022, 0.028, 0.006, 0.003), 0.013);                     // Griffmulde (Leichtbau)
    d = Math.max(d, -(Math.hypot(Math.abs(x) - 0.0155, v - 0.032) - 0.0008));                     // Formnaht
    return d;
  } });
  pistolGrip(b, 'gaGrip', { u: -0.004, top: 0.008, h: 0.098, w: 0.046, rake: 0.3, hw: 0.0142, id: 'grip' });
  triggerUnit(b, { u0: 0.012, u1: 0.06, vTop: 0.004, depth: 0.024, hw: 0.0155, mat: 'gaPoly', id: 'uhu' });
  selectorLever(b, 'gaSteel', 0.0155, 0.022, -0.016, { both: true });
  // Magazinschacht (Trichter) + Magazinhalter-Knopf links
  slab(b, mm([[60, 6], [100, 6], [100, -16], [96, -22], [64, -22], [60, -16]]), 0.0145, 0.0025, 'gaPoly', { id: 'well', cav: POLY });
  if (b.hi) { b.cyl('gaPolyDark', 0.0045, 0.0045, 0.003, -0.0155, -0.004, 0.096, { axis: 'x', seg: 18 }); for (let i = 0; i < 4; i++) b.box('cavity', 0.0004, 0.006, 0.0006, -0.0171, -0.004, 0.0935 + i * 0.0018, { c: 0 }); }
  // --- Integralschalldämpfer: Mantel mit Rändelbändern, Klemmmutter am Gehäuse, Kappe mit Bohrung
  const U0 = 0.142, U1 = 0.392, RD = 0.0195;
  b.lathe('gaSteel', [[0, 0], [0, R * 1.02], [0.006, R * 1.06], [0.016, R * 1.06], [0.018, RD * 0.98], [0.02, 0]], 0, AX, U0 - 0.02, { seg: b.seg(32, 8) });
  barrel(b, 'gaBlued', AX, U0, [[0, RD * 0.97], [0.003, RD], [U1 - U0 - 0.003, RD], [U1 - U0, RD * 0.95]], { seg: 36 });
  b.lathe('gaSteel', [[0, RD * 0.95], [0.004, RD * 1.02], [0.014, RD * 1.02], [0.018, RD * 0.86], [0.018, 0.006], [0.0175, 0.0048]], 0, AX, U1 - 0.002, { seg: b.seg(36, 8) });
  if (b.hi) {
    for (const uc of [U0 + 0.012, U1 - 0.02]) b.cyl('knurl', RD * 1.012, RD * 1.012, 0.012, 0, AX, uc, { seg: 36 });
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; b.cyl('cavity', 0.0013, 0.0013, 0.002, Math.cos(a) * 0.0115, AX + Math.sin(a) * 0.0115, U1 + 0.0157, { seg: 8 }); }   // Schlüssellöcher Kappe
    for (let i = 0; i < 6; i++) b.box('paintWhite', 0.0003, 0.0004, 0.0004, 0, AX + RD + 0.00015, U0 + 0.05 + i * 0.006, { c: 0 });            // Teilung (Drehmoment)
  }
  b.bore(0.0048, 0, AX, U1 + 0.0163);
  b.anchor('muzzle', 0, AX, U1 + 0.017);
  b._barrelEnd = U1 + 0.016; b._muzzleDone = true;
  // --- Schiene oben, Diopter, Korn auf der Dämpfer-Klemme
  b.picatinny('gaAlu', 0, AX + R - 0.002, -0.09, 0.12);
  const SV = AX + R - 0.002 + 0.0077 + 0.016;
  b.box('gaAlu', 0.02, 0.008, 0.024, 0, AX + R + 0.0095, -0.074, { c: 0.0015 });
  for (const s of [-1, 1]) b.side('gaAlu', [[-0.084, AX + R + 0.012], [-0.064, AX + R + 0.012], [-0.068, SV + 0.007], [-0.08, SV + 0.007]], 0.003, s * 0.009, { bevel: 0.0006 });
  apertureSight(b, 'gaSteel', { x0: -0.0075, x1: 0.0075, v0: AX + R + 0.012, v1: SV + 0.0055, cv: SV, r: 0.0019, u: -0.076, l: 0.003 });
  if (b.hi) b.cyl('knurl', 0.0045, 0.0045, 0.004, 0.012, AX + R + 0.0095, -0.074, { axis: 'x', seg: 14 });
  b.anchor('sight', 0, SV, -0.076, { data: { type: 'iron', eyeRelief: 0.24 } });
  frontSight(b, 'gaBlued', AX, U0 - 0.012, SV, { r: R * 1.06, hood: true });
  // --- Verschluss im Auswurffenster (rechts), Spannhebel rechts (läuft mit)
  boltInPort(b, R - 0.001, AX + 0.004, 0.05, 0.036, 0.012);
  chargeKnob(b, 'gaSteel', 1, R + 0.002, AX - 0.002, 0.1, 0.068, 'right', { stem: 0.014 });
  if (b.hi) b.box('cavity', 0.002, 0.0055, 0.072, R + 0.0004, AX - 0.002, 0.066, { c: 0 });                                         // Spannhebel-Schlitz
  // --- Klappschaft (Stahlrohr, rechts angeklappt möglich): Gelenkblock, Ober-/Unterholm, Gummikappe
  slab(b, mm([[-112, 66], [-100, 66], [-100, 22], [-112, 18]]), 0.016, 0.003, 'gaSteel', { id: 'hinge', cav: STEEL });
  b.tube('gaBlued', [[0, AX + 0.004, -0.112], [0, AX + 0.006, -0.24], [0, AX + 0.004, -0.345]], 0.0058);
  b.tube('gaBlued', [[0, 0.03, -0.112], [0, 0.0, -0.22], [0, -0.036, -0.345]], 0.0058);
  b.tube('gaBlued', [[0, AX + 0.004, -0.2], [0, 0.012, -0.2]], 0.004);
  slab(b, mm([[-345, 70], [-362, 72], [-368, 60], [-368, -40], [-360, -48], [-345, -46]]), 0.0165, 0.004, 'rubber', { id: 'butt', cav: POLY });
  if (b.hi) {
    for (let i = 0; i < 8; i++) b.box('cavity', 0.034, 0.0011, 0.003, 0, 0.055 - i * 0.012, -0.3675, { c: 0 });
    for (const v of [AX + 0.004, 0.03]) b.cyl('gaBolt', 0.0042, 0.0042, 0.036, 0, v, -0.106, { axis: 'x', seg: 14 });
    b.box('gaBolt', 0.008, 0.012, 0.01, -0.017, 0.04, -0.106, { c: 0.0015 });                                                       // Klappschaft-Riegel
    swivel(b, 'gaSteel', -0.0175, 0.03, -0.12);
  }
  // --- Magazin (gerade, 30 × 9 mm): Stahl mit Sicken, Bodenplatte, Prüflöcher
  boxMag(b, {
    pivot: [0.02, 0.08], hw: 0.0112, mat: 'gaMag', step: 0.0016,
    pts: mm([[64, 22], [96, 22], [97, -158], [62, -158]]),
    floor: [0.061, 0.098, -0.158], ribs: 1, ribU: () => 0.08, ribLen: 0.17,
    holes: [[0.074, -0.03], [0.074, -0.07], [0.074, -0.11]],
    cal: 'p9', width: 0.017, depth: 0.03, show: 2, path: [[0, 0.02, 0.08], [0, -0.146, 0.08]], grab: [-0.09, 0.08],
  });
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.3, gw: 0.0145, gd: 0.023, gu: 0.0, ho: 0.03, tu: 0.034 } });
  b.anchor('leftHandGrip', 0, AX - RD, 0.25, { data: { style: 'under', w: RD + 0.002, h: RD } });
  b.meta = { sight: 'iron', axis: AX, kind: 'smg', selector: { semi: 0.8, auto: 1.6 } };
}

/* ================================================================== BL-7 Luchs (Bullpup 5,56) */

export function luchs(b) {
  const AX = 0.064;
  MARK_LUCHS(b, 'BL-7  LUCHS  KAL 5,56', -(0.026 + 0.0003), 0.05, -0.2, 0.0034);
  MARK_LUCHS(b, 'NP 070522', -(0.026 + 0.0003), 0.043, -0.2, 0.0025);
  // --- Schale (Polymer): Schaftteil mit Magazinschacht hinter dem Griff, Wangenauflage, Kolbenkappe
  const SHELL = mm([[-372, 86], [-200, 92], [-60, 92], [80, 92], [138, 88], [142, 50], [128, 38], [60, 32], [42, 18], [30, 8],
    [-30, 8], [-62, 14], [-100, 10], [-100, -30], [-160, -30], [-160, 10], [-300, 6], [-360, -4], [-372, 6]]);
  const cutShell = (x, v, u, d) => {
    d = pocket(d, x, rrect(u, v, -0.3, 0.05, 0.05, 0.024, 0.008), 0.022);                          // Leichtbau-Mulden am Schaft
    d = pocket(d, x, rrect(u, v, 0.09, 0.062, 0.036, 0.012, 0.004), 0.022, 1);                     // Mulde vorn rechts
    d = Math.max(d, -(Math.hypot(Math.abs(x) - 0.026, v - 0.074) - 0.0009));                       // Formnaht
    // Auswurffenster rechts über dem Magazin (wird von boltInPort mit Verschluss gefüllt)
    d = pocket(d, x, rrect(u, v, -0.12, AX + 0.002, 0.024, 0.008, 0.002), 0.012, 1);
    return d;
  };
  slab(b, SHELL, (u, v) => (u < -0.2 && v > 0.06 ? 0.024 : 0.026), 0.008, 'gaPoly', { hwMax: 0.026, cut: cutShell, id: 'shell', cav: POLY, step: 0.0024 });
  // Wangenauflage (abnehmbar) mit Schrauben
  slab(b, mm([[-330, 88], [-160, 92], [-160, 100], [-200, 104], [-320, 100], [-336, 94]]), 0.022, 0.006, 'gaPolyDark', { id: 'cheek', cav: POLY });
  if (b.hi) for (const u of [-0.31, -0.18]) slotScrew(b, 'gaSteel', 0.0222, 0.095, u, 0.0022);
  slab(b, mm([[-372, 90], [-386, 90], [-390, 80], [-390, -2], [-382, -10], [-372, 4]]), 0.025, 0.005, 'rubber', { id: 'butt', cav: POLY });
  if (b.hi) for (let i = 0; i < 9; i++) b.box('cavity', 0.05, 0.0012, 0.0035, 0, 0.082 - i * 0.01, -0.389, { c: 0 });
  // --- Griff + Bügel (Vollhandschutz, Teil der Schale)
  pistolGrip(b, 'gaGrip', { u: 0.0, top: 0.01, h: 0.1, w: 0.048, rake: 0.22, hw: 0.0148, id: 'grip', cap: 'gaPolyDark' });
  triggerUnit(b, { u0: 0.018, u1: 0.064, vTop: 0.01, depth: 0.03, hw: 0.026, mat: 'gaPoly', gw: 0.0065, id: 'luchs' });
  // Querschiebe-Sicherung über dem Griff (beidseitig)
  if (b.hi) for (const s of [-1, 1]) { b.cyl('gaPolyDark', 0.0045, 0.0045, 0.004, s * 0.0275, 0.024, 0.008, { axis: 'x', seg: 18 }); b.circle(s > 0 ? 'paintSignal' : 'paintWhite', 0.0022, s * 0.0296, 0.024, 0.008, { ry: s * Math.PI / 2, seg: 12 }); }
  // --- Gehäuse oben (Aluminium) mit durchgehender Schiene
  slab(b, mm([[-260, 90], [140, 90], [146, 96], [146, 104], [-260, 104]]), 0.017, 0.0025, 'gaAlu', { id: 'upper', cav: STEEL });
  b.picatinny('gaAlu', 0, 0.104, -0.25, 0.14);
  if (b.hi) for (const u of [-0.24, -0.06, 0.12]) pinHead(b, 'gaSteel', 0.0172, 0.096, u, 0.0024);
  // Klappkimme hinten (umgeklappt sichtbar) + Rotpunkt vorn auf der Schiene
  const RT = 0.104 + 0.0077;
  b.box('gaAlu', 0.024, 0.008, 0.03, 0, RT + 0.004, -0.2, { c: 0.0015 });
  b.side('gaAlu', [[-0.212, RT + 0.008], [-0.182, RT + 0.008], [-0.186, RT + 0.014], [-0.208, RT + 0.014]], 0.02, 0, { bevel: 0.0008 });
  redDot(b, -0.12, RT);
  // --- Lauf, Handschutz (M-LOK), Gasblock, Feuerdämpfer
  slab(b, mm([[138, 96], [300, 96], [306, 90], [306, 38], [300, 32], [138, 32]]), 0.0205, 0.004, 'gaPolyOD', { id: 'hg', cav: POLY, cut: (x, v, u, d) => {
    for (let i = 0; i < 4; i++) for (const cv of [0.05, 0.078]) d = pocket(d, x, rrect(u, v, 0.165 + i * 0.034, cv, 0.013, 0.0035, 0.0035), 0.017);
    for (let i = 0; i < 4; i++) d = Math.max(d, -Math.max(rrect(u, x, 0.165 + i * 0.034, 0, 0.013, 0.0035, 0.0035), v - 0.036));
    return d;
  } });
  b.picatinny('gaAlu', 0, 0.032, 0.17, 0.27, { rz: Math.PI });
  barrel(b, 'gaBlued', AX, 0.3, [[0, 0.0105], [0.104, 0.0098], [0.11, 0.0098]]);
  const end = ownMuzzle(b, 'cage', 0.41, AX, 0.0102);
  b.anchor('muzzle', 0, AX, end + 0.002);
  // --- Spannhebel links vorn (läuft nicht mit), Verschluss im Fenster rechts, Hülsenabweiser
  b.part('charge', -0.02, 0.08, 0.1);
  b.box('gaSteel', 0.006, 0.01, 0.022, -0.0205, 0.08, 0.1, { part: 'charge', c: 0.0015 });
  b.side('gaPolyDark', [[0.09, 0.075], [0.112, 0.075], [0.116, 0.088], [0.094, 0.09]], 0.01, -0.031, { part: 'charge', bevel: 0.0015 });
  b.anchor('chargeGrab', -0.036, 0.083, 0.104, { part: 'charge', data: { travel: [0, 0, 0.09], style: 'pull' } });
  if (b.hi) b.box('cavity', 0.002, 0.006, 0.11, -0.0205, 0.08, 0.06, { c: 0 });
  boltInPort(b, 0.0262, AX + 0.002, -0.12, 0.044, 0.014, { mat: 'gaPolyDark' });
  if (b.hi) b.side('gaPolyDark', [[-0.15, AX + 0.012], [-0.09, AX + 0.012], [-0.096, AX + 0.02], [-0.144, AX + 0.02]], 0.004, 0.028, { bevel: 0.001 });
  // Riemenpunkte
  swivel(b, 'gaSteel', 0.026, 0.07, -0.34); swivel(b, 'gaSteel', -0.021, 0.08, 0.27);
  // --- Magazin (hinter dem Griff, gebogen, 30 × 5,56) – Polymer, rauchgrau mit Rippen
  const top = 0.012;
  boxMag(b, {
    pivot: [top, -0.13], hw: 0.0115, mat: 'gaPolyDark', step: 0.0017, ribs: 2, ribU: (v, i) => -0.13 - 0.012 + i * 0.014 + (top - v) * 0.18, ribLen: 0.16,
    pts: mm([[-110, 12], [-150, 12], [-150, -40], [-157, -90], [-168, -150], [-176, -168], [-132, -176], [-122, -150], [-114, -90], [-110, -40]]),
    floor: null, cal: 'r556', width: 0.018, depth: 0.04, show: 2,
    path: [[0, top, -0.13], [0, -0.06, -0.14], [0, -0.15, -0.155]], grab: [-0.07, -0.142],
  });
  if (b.hi) b.box('gaPolyDark', 0.026, 0.008, 0.05, 0, -0.17, -0.155, { part: 'mag', rx: -0.2, c: 0.002 });
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.22, gw: 0.0155, gd: 0.023, gu: 0.0, ho: 0.022, tu: 0.034 } });
  b.anchor('leftHandGrip', 0, 0.032, 0.22, { data: { style: 'under', w: 0.0205, h: 0.03 } });
  b.anchor('boltCatch', -0.026, 0.02, -0.095);
  b.meta = { sight: 'reddot', axis: AX, kind: 'rifle', selector: null };
}

/* ================================================================== KD-74 Dachs (Kurzkarabiner 7,62 × 39) */

export function dachs(b) {
  const AX = 0.058;
  MARK_DACHS(b, 'KD-74  DACHS  KAL 7,62 × 39', -(0.0172 + 0.0003), 0.045, -0.03, 0.003);
  MARK_DACHS(b, 'NP 740106', -(0.0172 + 0.0003), 0.039, -0.03, 0.0023);
  // --- Oberteil: Aluminium-Monolith (Gehäuse + Handschutz) mit Schiene, M-LOK-Fenstern, Kühlbohrungen
  const UPPER = mm([[-96, 46], [228, 46], [232, 52], [232, 86], [226, 90], [-96, 90]]);
  slab(b, UPPER, (u) => (u > 0.12 ? 0.0185 : 0.0172), 0.003, 'gaAlu', { hwMax: 0.0185, id: 'upper', cav: STEEL, step: 0.0018, cut: (x, v, u, d) => {
    for (let i = 0; i < 3; i++) d = pocket(d, x, rrect(u, v, 0.142 + i * 0.03, 0.068, 0.011, 0.0035, 0.0035), 0.015);
    for (let i = 0; i < 6; i++) d = Math.max(d, -Math.max(Math.hypot(u - (0.13 + i * 0.018), v - 0.08) - 0.0022, 0.012 - Math.abs(x)));
    d = pocket(d, x, rrect(u, v, 0.04, 0.062, 0.02, 0.0065, 0.002), 0.011, 1);                    // Auswurffenster (Rahmen)
    return d;
  } });
  b.picatinny('gaAlu', 0, 0.09, -0.09, 0.225);
  // --- Unterteil (Aluminium, Schacht mit Trichter) + Griff + Bügel
  const LOWER = mm([[-96, 46], [92, 46], [92, 10], [80, 0], [52, -6], [40, 4], [-40, 4], [-70, 18], [-96, 26]]);
  slab(b, LOWER, 0.0168, 0.0025, 'gaAlu', { id: 'lower', cav: STEEL, cut: (x, v, u, d) => {
    d = Math.max(d, -(Math.hypot(Math.abs(x) - 0.0168, v - 0.046) - 0.0007));                      // Trennfuge Ober-/Unterteil
    d = pocket(d, x, rrect(u, v, 0.064, 0.02, 0.022, 0.016, 0.004), 0.0155);                       // Schachtwand-Mulde
    return d;
  } });
  pistolGrip(b, 'gaGrip', { u: -0.004, top: 0.006, h: 0.1, w: 0.046, rake: 0.32, hw: 0.0145, id: 'grip' });
  triggerUnit(b, { u0: 0.012, u1: 0.052, vTop: 0.004, depth: 0.026, hw: 0.0168, mat: 'gaAlu', id: 'dachs' });
  selectorLever(b, 'gaSteel', 0.0168, 0.03, -0.012, { both: true });
  if (b.hi) { for (const [v, u] of [[0.036, -0.086], [0.036, 0.08]]) pinHead(b, 'gaBolt', 0.0168, v, u, 0.0028); b.cyl('gaPolyDark', 0.0045, 0.0045, 0.003, 0.0168, 0.012, 0.064, { axis: 'x', seg: 18 }); }
  // --- Verschluss (Fenster rechts), Spannhebel rechts am Kolbenträger
  boltInPort(b, 0.0175, 0.062, 0.04, 0.036, 0.011);
  chargeKnob(b, 'gaSteel', 1, 0.0185, 0.074, 0.12, 0.082, 'right', { stem: 0.016, len: 0.03 });
  if (b.hi) b.box('cavity', 0.002, 0.0055, 0.09, 0.0189, 0.074, 0.08, { c: 0 });
  // --- Lauf mit Gasblock (unter dem Handschutz sichtbar am Ende), Mündungskegel
  barrel(b, 'gaBlued', AX, 0.228, [[0, 0.0118], [0.012, 0.0118], [0.014, 0.0104], [0.086, 0.0104]]);
  const end = ownMuzzle(b, 'cone', 0.314, AX, 0.0104);
  b.anchor('muzzle', 0, AX, end + 0.002);
  // --- Klappvisier: Diopter hinten, Korn vorn (beide auf der Schiene, aufgeklappt)
  const RT = 0.09 + 0.0077, SV = RT + 0.024;
  b.box('gaSteel', 0.022, 0.008, 0.028, 0, RT + 0.004, -0.075, { c: 0.0015 });
  for (const s of [-1, 1]) b.side('gaSteel', [[-0.084, RT + 0.008], [-0.066, RT + 0.008], [-0.07, SV + 0.007], [-0.081, SV + 0.007]], 0.0028, s * 0.0085, { bevel: 0.0006 });
  apertureSight(b, 'gaSteel', { x0: -0.007, x1: 0.007, v0: RT + 0.008, v1: SV + 0.0055, cv: SV, r: 0.0019, u: -0.078, l: 0.003 });
  b.anchor('sight', 0, SV, -0.078, { data: { type: 'iron', eyeRelief: 0.24 } });
  b.box('gaSteel', 0.02, 0.008, 0.024, 0, RT + 0.004, 0.21, { c: 0.0015 });
  for (const s of [-1, 1]) b.side('gaSteel', [[0.2, RT + 0.008], [0.218, RT + 0.008], [0.214, SV + 0.004], [0.204, SV + 0.004]], 0.0026, s * 0.0085, { bevel: 0.0005 });
  b.side('gaSteel', [[0.208, RT + 0.008], [0.211, RT + 0.008], [0.2105, SV], [0.2085, SV]], 0.0022, 0, { bevel: 0.0003 });
  // --- Klappschaft (rechts klappend): Gelenk, Rohr, Wangenstück, Kappe
  slab(b, mm([[-110, 88], [-96, 88], [-96, 26], [-110, 30]]), 0.0175, 0.003, 'gaSteel', { id: 'hinge', cav: STEEL });
  b.tube('gaBlued', [[0, 0.074, -0.11], [0, 0.072, -0.33]], 0.0085);
  slab(b, mm([[-180, 84], [-320, 84], [-320, 92], [-300, 98], [-196, 98], [-180, 92]]), 0.016, 0.005, 'gaPolyDark', { id: 'cheek', cav: POLY });
  b.tube('gaBlued', [[0, 0.04, -0.11], [0, -0.01, -0.32]], 0.006);
  slab(b, mm([[-318, 96], [-340, 98], [-346, 86], [-346, -30], [-338, -38], [-318, -24]]), 0.0165, 0.004, 'rubber', { id: 'butt', cav: POLY });
  if (b.hi) {
    for (let i = 0; i < 9; i++) b.box('cavity', 0.034, 0.0011, 0.003, 0, 0.085 - i * 0.012, -0.3455, { c: 0 });
    for (const v of [0.074, 0.04]) b.cyl('gaBolt', 0.0042, 0.0042, 0.036, 0, v, -0.103, { axis: 'x', seg: 14 });
    swivel(b, 'gaSteel', -0.0175, 0.05, -0.115); swivel(b, 'gaSteel', -0.0186, 0.07, 0.2);
  }
  // --- Gebogenes Stahlmagazin (30 × 7,62 × 39) mit Verstärkungsrippen
  const mc = (t) => [0.072 + Math.sin(t * 0.9) * 0.05 + t * 0.03, 0.04 - t * 0.17];   // Rückenlinie (Mittelpunkt) t 0..1
  const outline = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10, [u, v] = mc(t), w = 0.027 + t * 0.003 - Math.sin(t * Math.PI) * 0.002; outline.push([u + w, v]); }
  for (let i = 10; i >= 0; i--) { const t = i / 10, [u, v] = mc(t), w = 0.027 + t * 0.003 + Math.sin(t * Math.PI) * 0.002; outline.push([u - w, v]); }
  boxMag(b, {
    pivot: [0.04, 0.072], hw: 0.0118, mat: 'gbBakelite', pts: outline, step: 0.0016, ribs: 2, ribLen: 0.17,
    ribU: (v, i) => { const t = (0.04 - v) / 0.17; return mc(t)[0] + (i ? 0.016 : -0.016); },
    cal: 'r762k', width: 0.019, depth: 0.04, show: 2, path: [mc(0), mc(0.4), mc(0.85)].map(([u, v]) => [0, v, u]), grab: [-0.04, 0.09],
  });
  if (b.hi) { const [fu, fv] = mc(1); b.box('gaSteel', 0.026, 0.006, 0.064, 0, fv - 0.002, fu, { part: 'mag', rx: -0.45, c: 0.0015 }); }
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.32, gw: 0.0145, gd: 0.023, gu: 0.0, ho: 0.03, tu: 0.034 } });
  b.anchor('leftHandGrip', 0, 0.046, 0.17, { data: { style: 'under', w: 0.0185, h: 0.022 } });
  b.meta = { sight: 'iron', axis: AX, kind: 'rifle', selector: { semi: 0.8, auto: 1.6 } };
}

/* ================================================================== DM-11 Elster (halbautomatisches Präzisionsgewehr) */

export function elster(b) {
  const AX = 0.072;
  MARK_ELSTER(b, 'DM-11  ELSTER  KAL 7,62 × 51', -(0.019 + 0.0003), 0.07, -0.04, 0.003);
  MARK_ELSTER(b, 'NP 110784', -(0.019 + 0.0003), 0.064, -0.04, 0.0023);
  // --- Stahlgehäuse mit Rückenschiene, Auswurf rechts, Gaskolben-Führung
  slab(b, mm([[-110, 48], [150, 48], [156, 56], [156, 92], [150, 96], [-110, 96], [-116, 88], [-116, 56]]), 0.019, 0.003, 'gaBlued', { id: 'rec', cav: STEEL, step: 0.0018, cut: (x, v, u, d) => {
    d = Math.max(d, -(Math.hypot(Math.abs(x) - 0.019, v - 0.058) - 0.0008));
    d = pocket(d, x, rrect(u, v, 0.11, 0.07, 0.03, 0.01, 0.003), 0.0165, -1);                      // Erleichterung links
    return d;
  } });
  b.picatinny('gaBlued', 0, 0.096, -0.105, 0.15);
  if (b.hi) for (const [v, u] of [[0.054, -0.1], [0.054, 0.14], [0.086, 0.15]]) pinHead(b, 'gaBolt', 0.019, v, u, 0.0026);
  boltInPort(b, 0.0192, AX + 0.003, 0.05, 0.05, 0.014);
  chargeKnob(b, 'gaSteel', 1, 0.0195, 0.064, 0.13, 0.1, 'right', { stem: 0.018, len: 0.028 });
  if (b.hi) b.box('cavity', 0.002, 0.006, 0.11, 0.0195, 0.064, 0.086, { c: 0 });
  // --- Schichtholzschaft: Pistolengriff mit Daumenmulde, Fischhaut, Schaftrücken, Kolbenkappe
  const STOCK = mm([[-112, 50], [-140, 60], [-250, 64], [-430, 68], [-436, 64], [-436, -80], [-428, -86], [-300, -58], [-170, -30],
    [-100, -16], [-56, -18], [-58, -50], [-66, -96], [-58, -105], [-22, -105], [-16, -96], [-6, -58], [8, -22], [20, -4], [28, 4],
    [70, 6], [150, 22], [160, 48]]);
  slab(b, STOCK, (u, v) => (v < -0.02 && u > -0.075 ? 0.0158 : u < -0.14 ? 0.0205 : 0.019), 0.0075, 'woodWalnut', { hwMax: 0.0205, id: 'stock', cav: POLY, step: 0.0024, cut: (x, v, u, d) => {
    if (u < -0.18 && u > -0.42) d = Math.max(d, -(Math.hypot(Math.abs(x) - 0.0205, v + 0.012) - 0.0008));   // Zierlinie
    // Daumenauflage links am Griffrücken (flache Mulde)
    d = pocket(d, x, rrect(u, v, -0.05, -0.018, 0.016, 0.009, 0.008), 0.0145, -1);
    return d;
  } });
  // Verstellbare Wangenauflage (zwei Säulen, Klemmhebel)
  slab(b, mm([[-180, 66], [-360, 70], [-360, 82], [-330, 88], [-200, 88], [-180, 80]]), 0.019, 0.006, 'woodWalnut', { id: 'cheek', cav: POLY });
  if (b.hi) for (const u of [-0.21, -0.33]) { b.cyl('gaBolt', 0.0035, 0.0035, 0.012, 0, 0.07, u, { axis: 'v', seg: 12 }); b.cyl('knurl', 0.0075, 0.0075, 0.005, 0.0215, 0.066, u, { axis: 'x', seg: 16 }); }
  slab(b, mm([[-436, 74], [-452, 74], [-456, 64], [-456, -74], [-448, -86], [-436, -80]]), 0.021, 0.004, 'rubber', { id: 'butt', cav: POLY });
  if (b.hi) { for (let i = 0; i < 11; i++) b.box('cavity', 0.043, 0.0011, 0.003, 0, 0.065 - i * 0.013, -0.4555, { c: 0 }); b.box('gaPolyDark', 0.042, 0.15, 0.004, 0, -0.004, -0.438, { c: 0.0008 }); }
  swivel(b, 'gaSteel', 0, -0.06, -0.36, { under: true });
  // --- Abzugsgruppe (Stahl, Bügel) + Wahlhebel
  triggerUnit(b, { u0: 0.012, u1: 0.058, vTop: 0.008, depth: 0.026, hw: 0.0182, mat: 'gaSteel', id: 'elster' });
  selectorLever(b, 'gaSteel', 0.019, 0.04, -0.028, { both: false, marks: true });
  // --- Handschutz (Aluminium, frei schwingend) mit M-LOK, Zweibeinaufnahme, Lauf, Bremse
  const HG = mm([[156, 44], [440, 44], [446, 50], [446, 96], [440, 100], [156, 100]]);
  slab(b, HG, 0.0215, 0.004, 'gaAlu', { id: 'hg', cav: STEEL, step: 0.002, cut: (x, v, u, d) => {
    for (let i = 0; i < 6; i++) for (const cv of [0.06, 0.084]) d = pocket(d, x, rrect(u, v, 0.19 + i * 0.042, cv, 0.016, 0.0036, 0.0036), 0.018);
    for (let i = 0; i < 6; i++) d = Math.max(d, -Math.max(rrect(u, x, 0.19 + i * 0.042, 0, 0.016, 0.0036, 0.0036), v - 0.048));
    return d;
  } });
  b.picatinny('gaAlu', 0, 0.1, 0.17, 0.43);
  if (b.hi) { b.box('gaSteel', 0.014, 0.008, 0.02, 0, 0.04, 0.41, { c: 0.002 }); b.cyl('gaBolt', 0.003, 0.003, 0.016, 0, 0.034, 0.41, { axis: 'v', seg: 10 }); }
  barrel(b, 'gaBlued', AX, 0.446, [[0, 0.0128], [0.12, 0.0118], [0.124, 0.0112], [0.15, 0.0112]]);
  const end = ownMuzzle(b, 'brake', 0.596, AX, 0.0112);
  b.anchor('muzzle', 0, AX, end + 0.002);
  // --- 4×-Kampfvisier auf der Schiene
  acog(b, -0.08, 0.096 + 0.0077);
  // --- Magazin (20 × 7,62 × 51, Stahl, leicht gebogen)
  boxMag(b, {
    pivot: [0.048, 0.1], hw: 0.0125, mat: 'gaMag', step: 0.0016, ribs: 2, ribLen: 0.11,
    pts: mm([[76, 50], [126, 50], [128, -10], [132, -70], [134, -88], [84, -96], [80, -70], [76, -10]]),
    floor: [0.083, 0.133, -0.092], holes: [[0.09, 0.0], [0.092, -0.04]],
    cal: 'r308', fit: 0.05, width: 0.02, depth: 0.05, show: 2, path: [[0, 0.048, 0.1], [0, -0.02, 0.104], [0, -0.084, 0.108]], grab: [-0.02, 0.104],
  });
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.38, gw: 0.016, gd: 0.023, gu: 0.0, ho: 0.03, tu: 0.034 } });
  b.anchor('leftHandGrip', 0, 0.044, 0.3, { data: { style: 'under', w: 0.0215, h: 0.028 } });
  b.meta = { sight: 'acog', axis: AX, kind: 'rifle', selector: null };
}
