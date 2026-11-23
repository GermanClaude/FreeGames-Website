// Waffen-Welle 3, Teil B (20.11.2026): frei erfundene Waffen nach realen Bauarten (keine Nachbauten bestimmter Modelle).
//   RS-5 Habicht   Repetier-Scharfschützengewehr 7,62 × 51: Rundsystem mit Zylinderverschluss (zwei Warzen, Kammerstängel mit
//                  Kugel), Kunststoffschaft mit steilem Griff, verstellbarer Schaftrücken, kannelierter schwerer Lauf, Bremse,
//                  5-Schuss-Einsteckmagazin, Zielfernrohr 5–25 × 56 auf Schiene.
//   GK-33 Kranich  Repetierer der Weltkriegszeit (Kampagne): Vollschaft aus Nussbaum mit Oberhandschutz, zwei Laufringe,
//                  Nasenkappe mit Seitengewehr-Aufnahme und Putzstock, Stahlkappe, Tangentenvisier, Korn mit Tunnel,
//                  gerader Kammerstängel, bündiges 5-Schuss-Magazin.
//   MS-38 Hornisse Maschinenpistole der Weltkriegszeit (Kampagne): Rundgehäuse aus Stahlrohr, offener Verschluss mit
//                  Spannhebel rechts, Magazinschacht als Vordergriff, Bakelitgriff, Stahlrahmen mit Sicken, Klappschaft aus
//                  Stahlstreben, Auflageleiste unter der Mündung, Klappvisier.
//   UM-38 Lindwurm Universal-MG der Weltkriegszeit (Gurt, Panzer-Kampagne): Rundgehäuse, gelochter Laufmantel, Mündungs-
//                  verstärker, Zuführdeckel mit Gurtschieber, Gurttrommel links, Zweibein, Holz-Kolben, Tragegriff.
//   PF-12 Stier    Vorderschaftrepetierflinte: Aluminiumgehäuse mit Schiene, Röhrenmagazin mit Verlängerung und Schelle,
//                  gelochter Hitzeschild, Geisterring-Visier, Schrotpatronen-Halter links (sechs Patronen), Pistolengriffschaft.
import { mm, slab, rrect, pocket, POLY, STEEL, pinHead, slotScrew, pistolGrip, triggerUnit, boxMag, barrel, frontSight, rearNotch, swivel, selectorLever, boltInPort, chargeKnob, ownMuzzle, serrations, rivets } from './neu-kit.js?v=20261123073102';
import { ejectionPort } from './parts.js?v=20261123073102';
import { apertureSight } from './pistol-parts.js?v=20261123073102';
import { checkering } from './guns-flinten.js?v=20261123073102';
import { precisionScope } from './guns-praezision.js?v=20261123073102';
import { magRounds } from './magfill.js?v=20261123073102';
import { schrift } from './schrift.js?v=20261123073102';
const MARK_HABICHT = schrift('habicht').mark;
const MARK_KRANICH = schrift('kranich').mark;
const MARK_HORNISSE = schrift('hornisse').mark;
const MARK_LINDWURM = schrift('lindwurm').mark;
const MARK_STIER = schrift('stier').mark;

/** Zylinderverschluss mit Kammerstängel als Teil 'boltHandle' (dreht um die Laufachse, zieht nach hinten). */
function boltAction(b, axis, uFace, len, o = {}) {
  const r = o.r ?? 0.0098;
  b.part('boltHandle', 0, axis, uFace - len);
  b.cyl(o.mat ?? 'gaBolt', r, r, len, 0, axis, uFace - len / 2, { part: 'boltHandle', seg: b.seg(24, 6) });
  if (b.hi) {
    for (const a of [0.35, 0.35 + Math.PI]) b.box(o.mat ?? 'gaBolt', 0.0045, 0.0042, 0.016, Math.cos(a) * (r + 0.0012), axis + Math.sin(a) * (r + 0.0012), uFace - 0.01, { part: 'boltHandle', rz: a, c: 0.0006 });   // Verriegelungswarzen
    b.box('cavity', 0.0012, 0.0008, len * 0.55, 0, axis + r, uFace - len * 0.5, { part: 'boltHandle', c: 0 });                    // Führungsnut
    b.box('gaBolt', 0.0018, 0.003, 0.012, r * 0.85, axis + 0.002, uFace - 0.006, { part: 'boltHandle', c: 0.0004 });              // Auszieher
  }
  // Schlösschen hinten (Sicherungsflügel oben bei Altmodellen)
  b.lathe(o.shroud ?? 'gaBlued', [[0, 0], [0, r * 1.25], [0.02, r * 1.3], [0.03, r * 1.1], [0.036, r * 0.6], [0.036, 0]], 0, axis, uFace - len - 0.034, { part: 'boltHandle', seg: b.seg(24, 6) });
  if (o.flag && b.hi) b.side('gaBolt', [[uFace - len - 0.028, axis + r * 1.2], [uFace - len - 0.012, axis + r * 1.2], [uFace - len - 0.014, axis + r * 1.2 + 0.008], [uFace - len - 0.026, axis + r * 1.2 + 0.008]], 0.003, 0, { part: 'boltHandle', bevel: 0.0005 });
  // Stängel: Wurzel am Verschluss, gerade oder nach hinten gebogen, Kugel
  const hu = uFace - len + (o.root ?? 0.012);
  const pts = o.straight
    ? [[r * 0.8, axis, hu], [0.03, axis - 0.002, hu], [0.05, axis - 0.004, hu - 0.002]]
    : [[r * 0.8, axis - 0.002, hu], [0.026, axis - 0.012, hu - 0.006], [0.042, axis - 0.024, hu - 0.014], [0.05, axis - 0.032, hu - 0.018]];
  b.tube(o.mat ?? 'gaBolt', pts, 0.0038, { part: 'boltHandle', seg: b.seg(12, 5) });
  const kp = pts[pts.length - 1];
  b.sphere(o.knob ?? 'gaBolt', o.knobR ?? 0.009, kp[0] + 0.004, kp[1], kp[2], { part: 'boltHandle', sz: o.straight ? 1 : 1.15, seg: b.seg(18, 6), hseg: b.seg(12, 4) });
  if (b.hi && o.knurlKnob) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; b.box('cavity', 0.0006, 0.0006, 0.012, kp[0] + 0.004 + Math.cos(a) * 0.0088, kp[1] + Math.sin(a) * 0.0088, kp[2], { part: 'boltHandle', rz: a, c: 0 }); }
  b.anchor('boltGrab', kp[0] + 0.008, kp[1], kp[2], { part: 'boltHandle', data: { travel: [0, 0, o.travel ?? 0.09], rot: o.rot ?? 1.05, style: 'bolt' } });
}

/** Kannelierter Lauf (konisch) mit n Nuten. */
function fluted(b, mat, axis, u0, u1, r0, r1, n, f0, f1) {
  b.cyl(mat, r1, r0, u1 - u0, 0, axis, (u0 + u1) / 2, { seg: b.seg(28, 8) });
  if (!b.hi) return;
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n + Math.PI / n, rm = (r0 + r1) / 2;
    b.box('cavity', rm * 0.38, 0.0012, f1 - f0, Math.cos(a) * (rm - 0.0003), axis + Math.sin(a) * (rm - 0.0003), (f0 + f1) / 2, { rz: a + Math.PI / 2, c: 0 });
  }
}

/* ================================================================== RS-5 Habicht (Repetier-Scharfschützengewehr) */

export function habicht(b) {
  const AX = 0.068, RR = 0.0172;
  MARK_HABICHT(b, 'RS-5  HABICHT  KAL 7,62 × 51', -(RR + 0.0003), AX - 0.006, -0.06, 0.003);
  MARK_HABICHT(b, 'NP 500233', -(RR + 0.0003), AX - 0.011, -0.06, 0.0022);
  // --- Schaft (glasfaserverstärkter Kunststoff, oliv): steiler Griff, Daumenmulde, flacher Vorderschaft, Kolben mit Einbein-Nut
  const STOCK = mm([[-120, 52], [-150, 62], [-300, 66], [-450, 70], [-456, 64], [-456, -82], [-446, -90], [-330, -60], [-180, -30],
    [-96, -18], [-50, -12], [-56, -50], [-62, -98], [-54, -108], [-16, -108], [-10, -98], [-2, -60], [10, -22], [26, 0], [80, 4],
    [400, 30], [412, 36], [412, 56], [140, 56], [130, 50]]);
  slab(b, STOCK, (u, v) => (v < -0.02 && u > -0.07 ? 0.0158 : u > 0.13 ? 0.0225 : 0.0205), 0.0075, 'gaPolyOD', { hwMax: 0.0225, id: 'stock', cav: POLY, step: 0.0024, cut: (x, v, u, d) => {
    for (let i = 0; i < 4; i++) d = pocket(d, x, rrect(u, v, 0.2 + i * 0.048, 0.04, 0.018, 0.008, 0.008), 0.0205);   // Kühlmulden
    d = pocket(d, x, rrect(u, v, -0.05, -0.02, 0.014, 0.01, 0.008), 0.0145, -1);
    if (u < -0.2 && u > -0.43) d = Math.max(d, -(Math.hypot(Math.abs(x) - 0.0205, v - 0.0) - 0.001));
    return d;
  } });
  slab(b, mm([[-52, -24], [-56, -50], [-61, -94], [-54, -102], [-18, -102], [-13, -94], [-4, -60], [6, -26]]), 0.0164, 0.006, 'gaGripOD', { id: 'gripsk', cav: POLY });
  // Schaftrücken (verstellbar, zwei Säulen) + Kolbenkappe mit Distanzplatten
  slab(b, mm([[-190, 66], [-380, 70], [-380, 82], [-350, 90], [-210, 90], [-190, 80]]), 0.0195, 0.006, 'gaPolyOD', { id: 'cheek', cav: POLY });
  if (b.hi) for (const u of [-0.22, -0.35]) { b.cyl('gaBolt', 0.0035, 0.0035, 0.012, 0, 0.069, u, { axis: 'v', seg: 12 }); b.cyl('knurl', 0.0072, 0.0072, 0.005, 0.0215, 0.06, u, { axis: 'x', seg: 16 }); }
  slab(b, mm([[-456, 66], [-474, 66], [-478, 56], [-478, -78], [-470, -92], [-456, -86]]), 0.0215, 0.004, 'rubber', { id: 'butt', cav: POLY });
  if (b.hi) { for (let i = 0; i < 12; i++) b.box('cavity', 0.044, 0.0011, 0.003, 0, 0.058 - i * 0.012, -0.4775, { c: 0 }); for (const du of [0, 0.005]) b.box('gaPolyDark', 0.042, 0.148, 0.003, 0, -0.008, -0.458 - du, { c: 0.0006 }); }
  swivel(b, 'gaSteel', 0, -0.07, -0.38, { under: true }); swivel(b, 'gaSteel', 0, 0.03, 0.37, { under: true });
  // --- System: Rundgehäuse, Rückstoßstollen, Schiene, Auswurf rechts, Verschluss
  barrel(b, 'gaBlued', AX, -0.112, [[0, RR * 0.9], [0.006, RR], [0.25, RR], [0.256, RR * 0.95]], { seg: 32 });
  b.box('gaBlued', 0.026, 0.008, 0.25, 0, AX + RR - 0.002, 0.013, { c: 0.0015 });
  b.picatinny('gaBlued', 0, AX + RR + 0.002, -0.1, 0.14);
  b.box('gaSteel', 0.03, 0.012, 0.012, 0, AX - RR - 0.002, 0.13, { c: 0.002 });
  if (b.hi) { for (const u of [-0.09, 0.12]) slotScrew(b, 'gaSteel', 0, AX - RR - 0.0085, u, 0.0035, 0, { }); b.lathe('gaBlued', [[0, RR], [0.004, RR * 1.08], [0.02, RR * 1.08], [0.024, RR * 0.92]], 0, AX, 0.144, { seg: 28 }); }
  ejectionPort(b, RR - 0.0008, AX + 0.004, 0.06, 0.064, 0.016, 'gaBlued');
  boltAction(b, AX, 0.105, 0.15, { mat: 'gaBolt', shroud: 'gaBlued', knob: 'gaPolyDark', knobR: 0.0105, knurlKnob: true, travel: 0.095 });
  // Sicherung (Schieber rechts hinten), Verschlussfang links
  if (b.hi) { b.box('gaSteel', 0.004, 0.006, 0.012, RR + 0.002, AX - 0.004, -0.095, { c: 0.001 }); b.box('gaSteel', 0.003, 0.008, 0.016, -RR - 0.0015, AX + 0.004, -0.07, { c: 0.001 }); }
  // --- Abzug (Stahlbügel), Magazinhalter
  triggerUnit(b, { u0: 0.014, u1: 0.06, vTop: 0.006, depth: 0.026, hw: 0.0158, mat: 'gaSteel', id: 'habicht' });
  if (b.hi) b.box('gaSteel', 0.014, 0.004, 0.012, 0, 0.002, 0.118, { c: 0.001 });
  // --- Lauf (schwer, kanneliert), Bremse
  fluted(b, 'gaBlued', AX, 0.168, 0.66, 0.0148, 0.0118, 6, 0.2, 0.6);
  const end = ownMuzzle(b, 'brake', 0.66, AX, 0.0118);
  b.anchor('muzzle', 0, AX, end + 0.002);
  // --- Magazin (5 Schuss, Kunststoff, bündig mit Lasche)
  boxMag(b, {
    pivot: [0.044, 0.078], hw: 0.0135, mat: 'gaPolyDark', step: 0.0016, ribs: 0,
    pts: mm([[52, 44], [104, 44], [104, -10], [100, -16], [56, -16], [52, -10]]), floor: [0.054, 0.102, -0.014],
    cal: 'r308', fit: 0.048, width: 0.022, depth: 0.05, show: 2, path: [[0, 0.044, 0.078], [0, 0.0, 0.08]], grab: [-0.006, 0.078],
  });
  // --- Zielfernrohr
  precisionScope(b, -0.1, AX + RR + 0.002 + 0.0077);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.32, gw: 0.0158, gd: 0.024, gu: 0.0, ho: 0.03, tu: 0.04 } });
  b.anchor('leftHandGrip', 0, 0.006, 0.3, { data: { style: 'flat', w: 0.0225, h: 0.025 } });
  b.meta = { sight: 'sniper', axis: AX, kind: 'sniper' };
}

/* ================================================================== GK-33 Kranich (Repetierer, Weltkriegszeit) */

export function kranich(b) {
  const AX = 0.052, RR = 0.0165;
  MARK_KRANICH(b, 'GK-33  KRANICH', -(RR + 0.0003), AX - 0.004, -0.03, 0.0028);
  MARK_KRANICH(b, 'NP 33 0418  1938', -(RR + 0.0003), AX - 0.0085, -0.03, 0.0021);
  // --- Vollschaft (Nussbaum): Kolben mit Kolbenhals (halber Pistolengriff), Mittelschaft, Vorderschaft bis zur Nasenkappe
  const STOCK = mm([[-112, 40], [-160, 48], [-300, 54], [-420, 60], [-428, 56], [-428, -84], [-418, -92], [-290, -60], [-170, -38],
    [-80, -30], [-40, -40], [-16, -34], [0, -14], [20, 0], [120, 10], [140, 16], [560, 24], [600, 30], [602, 46], [140, 46], [120, 40]]);
  slab(b, STOCK, (u, v) => (u > 0.13 ? 0.0165 - Math.max(0, u - 0.4) * 0.012 : u > -0.06 && v < 0.02 ? 0.0168 : 0.0205), 0.007, 'woodWalnut', { hwMax: 0.0205, id: 'stock', cav: POLY, step: 0.0024, cut: (x, v, u, d) => {
    if (u > 0.16 && u < 0.54) d = Math.max(d, -(Math.hypot(Math.abs(x) - (0.0165 - Math.max(0, u - 0.4) * 0.012), v - 0.034) - 0.0018));   // Griffrille
    return d;
  } });
  // Oberhandschutz (Holz) über dem Lauf
  slab(b, mm([[150, 46], [470, 50], [480, 58], [478, 66], [160, 66], [146, 58]]), 0.0135, 0.006, 'woodWarm', { id: 'hgtop', cav: POLY });
  // Stahlkappe am Kolben, Kolbenteller-Schrauben, Riemenbügel seitlich, Laufringe, Nasenkappe
  slab(b, mm([[-428, 60], [-436, 60], [-438, 52], [-438, -86], [-432, -96], [-424, -92]]), 0.0212, 0.002, 'gaBlued', { id: 'butt', cav: STEEL });
  if (b.hi) { for (const v of [0.04, -0.07]) slotScrew(b, 'gaSteel', 0, v, -0.4385, 0.0028); b.cyl('gaBolt', 0.006, 0.006, 0.002, 0.0206, -0.02, -0.33, { axis: 'x', seg: 14 }); }
  swivel(b, 'gaSteel', -0.021, -0.03, -0.3);
  for (const [u, w] of [[0.33, 0.012], [0.47, 0.01]]) {
    b.lathe('gaBlued', [[0, 0.0], [0, 0.026], [0.002, 0.028], [w - 0.002, 0.028], [w, 0.026], [w, 0]], 0, AX - 0.006, u, { seg: b.seg(28, 8), sx: 0.66, sy: 1.25 });
    if (b.hi) pinHead(b, 'gaBolt', 0.0185, AX - 0.02, u + w / 2, 0.0022, 1);
  }
  swivel(b, 'gaSteel', -0.017, AX - 0.02, 0.476);
  slab(b, mm([[560, 22], [606, 24], [610, 30], [610, 68], [600, 70], [560, 66]]), 0.0145, 0.003, 'gaBlued', { id: 'nose', cav: STEEL });
  b.box('gaBlued', 0.008, 0.012, 0.06, 0, AX - 0.03, 0.62, { c: 0.002 });                                                             // Seitengewehr-Aufnahme
  if (b.hi) b.cyl('gaBolt', 0.003, 0.003, 0.5, 0, AX - 0.024, 0.39, { seg: 10 });                                                     // Putzstock
  b.lathe('gaBolt', [[0, 0], [0, 0.0042], [0.004, 0.0048], [0.012, 0.0048], [0.014, 0]], 0, AX - 0.024, 0.635, { seg: b.seg(14, 6) });
  // --- System: Rundgehäuse, Ladebrücke, Auswurf, Verschluss mit geradem Stängel
  barrel(b, 'gaBlued', AX, -0.116, [[0, RR * 0.92], [0.006, RR], [0.24, RR], [0.246, RR * 1.05], [0.262, RR * 1.05], [0.268, 0.0132]], { seg: 32 });
  b.box('gaBlued', 0.022, 0.006, 0.03, 0, AX + RR - 0.001, -0.07, { c: 0.002 });
  ejectionPort(b, RR - 0.0008, AX + 0.004, 0.04, 0.07, 0.016, 'gaBlued');
  if (b.hi) { b.box('cavity', 0.0105, 0.002, 0.02, 0, AX + RR + 0.0001, 0.035, { c: 0 }); for (const s of [-1, 1]) b.box('gaBlued', 0.003, 0.004, 0.022, s * 0.007, AX + RR + 0.0015, 0.035, { c: 0.0005 }); }   // Ladebrücke (Ladestreifen-Nut)
  boltAction(b, AX, 0.095, 0.15, { mat: 'gaBolt', shroud: 'gaBlued', straight: true, knob: 'gaBolt', knobR: 0.0085, flag: true, root: 0.016, travel: 0.1 });
  // --- Lauf, Tangentenvisier, Korn mit Tunnel
  barrel(b, 'gaBlued', AX, 0.152, [[0, 0.0132], [0.03, 0.0128], [0.032, 0.0118], [0.47, 0.0098], [0.476, 0.0098]]);
  b.bore(0.0045, 0, AX, 0.629);
  b.anchor('muzzle', 0, AX, 0.63);
  b._barrelEnd = 0.628;
  const SV = AX + 0.029;
  b.box('gaBlued', 0.022, 0.012, 0.06, 0, AX + 0.016, 0.19, { c: 0.002 });
  b.side('gaBlued', [[0.165, AX + 0.022], [0.222, AX + 0.022], [0.224, SV - 0.003], [0.168, SV + 0.002]], 0.016, 0, { bevel: 0.0008 });   // Visierblatt (flach)
  rearNotch(b, 'gaBlued', 0.168, SV - 0.006, SV, { hw: 0.008, eye: 0.36, nw: 0.0022 });
  if (b.hi) { for (let i = 0; i < 6; i++) b.box('paintWhite', 0.0008, 0.0003, 0.0006, -0.0081, SV - 0.004 - i * 0.0012, 0.2 + i * 0.003, { c: 0 }); b.box('gaBolt', 0.018, 0.005, 0.006, 0, SV - 0.002, 0.204, { c: 0.001 }); }
  frontSight(b, 'gaBlued', AX, 0.605, SV, { r: 0.0098, hood: true });
  // --- Abzugsbügel (Stahl), Bodenblech mit Magazin (bündig)
  triggerUnit(b, { u0: 0.016, u1: 0.064, vTop: 0.008, depth: 0.024, hw: 0.0168, mat: 'gaBlued', id: 'kranich', pos: 0.38 });
  boxMag(b, {
    pivot: [0.036, 0.1], hw: 0.0128, mat: 'gaBlued', step: 0.0016, ribs: 0,
    pts: mm([[76, 36], [124, 36], [124, 2], [76, 2]]), floor: [0.074, 0.126, 0.004], floorMat: 'gaBlued',
    cal: 'r308', fit: 0.044, width: 0.02, depth: 0.045, show: 2, path: [[0, 0.036, 0.1], [0, 0.008, 0.1]], grab: [0.0, 0.1],
  });
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.55, gw: 0.0168, gd: 0.026, gu: 0.0, ho: 0.03, tu: 0.045 } });
  b.anchor('leftHandGrip', 0, 0.012, 0.28, { data: { style: 'under', w: 0.0165, h: 0.02 } });
  b.meta = { sight: 'iron', axis: AX, kind: 'rifle' };
}

/* ================================================================== MS-38 Hornisse (MP, Weltkriegszeit) */

export function hornisse(b) {
  const AX = 0.05, RR = 0.0168;
  MARK_HORNISSE(b, 'MS-38  HORNISSE', -(RR + 0.0003), AX - 0.004, -0.04, 0.0028);
  MARK_HORNISSE(b, 'NP 38 1127', -(RR + 0.0003), AX - 0.0085, -0.04, 0.0021);
  // --- Gehäuserohr mit Endkappe, Spannhebel-Schlitz rechts (mit Sicherungsrast), Rippen am Laufmantel-Ansatz
  barrel(b, 'gaBlued', AX, -0.136, [[0, RR * 0.95], [0.004, RR], [0.25, RR], [0.254, RR * 1.08], [0.27, RR * 1.08], [0.274, 0.0125]], { seg: 32 });
  b.lathe('gaBlued', [[0, 0], [0, RR * 0.9], [0.01, RR * 1.04], [0.016, RR * 1.04], [0.018, RR * 0.9], [0.018, 0]], 0, AX, -0.152, { seg: b.seg(32, 8) });
  if (b.hi) {
    for (let i = 0; i < 18; i++) { const a = i * Math.PI / 9; b.box('cavity', 0.0012, 0.0007, 0.008, Math.cos(a) * RR * 1.04, AX + Math.sin(a) * RR * 1.04, -0.142, { rz: a, c: 0 }); }
    for (let i = 0; i < 5; i++) b.torus('gaBlued', RR * 1.0, 0.0012, 0, AX, 0.08 + i * 0.008, { seg: 6, tseg: 28 });                // Kühlrippen
  }
  b.box('cavity', 0.002, 0.006, 0.13, RR + 0.0002, AX, 0.0, { c: 0 });
  if (b.hi) b.box('cavity', 0.002, 0.012, 0.006, RR + 0.0002, AX + 0.006, -0.062, { c: 0 });                                      // Sicherungsrast
  // --- Rahmen (Stahlblech) mit Sicken, Magazinschacht als Vordergriff, Bakelitgriff
  const FRAME = mm([[-140, 36], [130, 36], [130, 28], [110, 20], [62, 20], [52, 8], [30, 2], [-24, 2], [-40, 12], [-100, 18], [-140, 22]]);
  slab(b, FRAME, 0.0145, 0.0022, 'gaSteel', { id: 'frame', cav: STEEL, cut: (x, v, u, d) => {
    if (u > -0.12 && u < -0.04) d = Math.min(d, Math.max(Math.abs(x) - 0.0155, Math.abs(v - 0.026) - 0.004, Math.abs(u + 0.08) - 0.036));   // Sicke
    return d;
  } });
  rivets(b, 'gaSteel', 0.0146, [[0.03, -0.13], [0.03, -0.02], [0.03, 0.11], [0.014, -0.06]]);
  slab(b, mm([[60, 26], [116, 26], [116, -30], [110, -36], [66, -36], [60, -30]]), 0.0172, 0.003, 'gaBlued', { id: 'well', cav: STEEL, cut: (x, v, u, d) => {
    if (u > 0.066 && u < 0.11) for (let i = 0; i < 6; i++) d = Math.max(d, -(Math.hypot(Math.abs(x) - 0.0172, v - (0.012 - i * 0.008)) - 0.0012));   // Griffrillen
    return d;
  } });
  if (b.hi) b.cyl('gaBolt', 0.004, 0.004, 0.003, -0.0175, 0.012, 0.064, { axis: 'x', seg: 16 });
  pistolGrip(b, 'gbBakelite', { u: -0.004, top: 0.004, h: 0.094, w: 0.044, rake: 0.3, hw: 0.0145, id: 'grip', cap: 'gaBlued', grooves: false });
  if (b.hi) for (const s of [-1, 1]) for (let i = 0; i < 9; i++) b.box('cavity', 0.0006, 0.0011, 0.03, s * 0.0148, -0.01 - i * 0.008, -0.008 - i * 0.0026, { rx: 0, c: 0 });   // Rillen der Griffschalen
  triggerUnit(b, { u0: 0.012, u1: 0.052, vTop: 0.002, depth: 0.024, hw: 0.0145, mat: 'gaSteel', id: 'hornisse' });
  // --- Verschluss (offen, mit Spannhebel rechts) als Teil 'bolt'
  b.part('bolt', 0, AX, -0.06);
  b.box('gaBolt', 0.004, 0.009, 0.05, RR - 0.003, AX, -0.06, { part: 'bolt', c: 0.0008 });
  b.cyl('gaSteel', 0.0052, 0.0058, 0.018, RR + 0.009, AX, -0.06, { part: 'bolt', axis: 'x', seg: b.seg(16, 6) });
  b.sphere('gaSteel', 0.0068, RR + 0.019, AX, -0.06, { part: 'bolt', sx: 0.7, seg: b.seg(16, 6), hseg: b.seg(10, 4) });
  b.anchor('chargeGrab', RR + 0.02, AX, -0.06, { part: 'bolt', data: { style: 'right', travel: [0, 0, 0.06] } });
  b.box('cavity', 0.002, 0.012, 0.034, RR - 0.0004, AX + 0.004, 0.044, { c: 0 });
  b.anchor('ejection', RR + 0.003, AX + 0.004, 0.044, { rz: 0.5 });
  // --- Lauf mit Auflageleiste, Korn mit Tunnel, Klappkimme
  barrel(b, 'gaBlued', AX, 0.138, [[0, 0.0125], [0.06, 0.0118], [0.064, 0.0102], [0.12, 0.0102]]);
  slab(b, mm([[214, 24], [256, 24], [256, 34], [214, 40]]), 0.006, 0.0015, 'gaBlued', { id: 'rest', cav: STEEL });
  b.bore(0.0045, 0, AX, 0.2585);
  b.anchor('muzzle', 0, AX, 0.259);
  b._barrelEnd = 0.258;
  const SV = AX + 0.026;
  frontSight(b, 'gaBlued', AX, 0.24, SV, { r: 0.0102, hood: true });
  b.box('gaBlued', 0.02, 0.008, 0.026, 0, AX + RR + 0.003, -0.11, { c: 0.0015 });
  for (const s of [-1, 1]) b.side('gaBlued', [[-0.12, AX + RR + 0.006], [-0.1, AX + RR + 0.006], [-0.104, SV + 0.006], [-0.116, SV + 0.006]], 0.0026, s * 0.0085, { bevel: 0.0005 });
  rearNotch(b, 'gaBlued', -0.11, SV - 0.008, SV, { hw: 0.0065, eye: 0.27 });
  // --- Klappschaft (Stahlstreben, ausgeklappt) mit Kolbenbügel
  b.box('gaSteel', 0.03, 0.02, 0.016, 0, 0.022, -0.146, { c: 0.003 });
  for (const s of [-1, 1]) b.tube('gaBlued', [[s * 0.012, 0.03, -0.15], [s * 0.012, 0.018, -0.26], [s * 0.012, 0.004, -0.38]], 0.0045);
  b.tube('gaBlued', [[-0.012, -0.03, -0.378], [-0.012, 0.03, -0.378]], 0.005);
  b.tube('gaBlued', [[0.012, -0.03, -0.378], [0.012, 0.03, -0.378]], 0.005);
  slab(b, mm([[-374, 40], [-386, 40], [-388, 30], [-388, -34], [-380, -42], [-374, -38]]), 0.0175, 0.003, 'gaBlued', { id: 'butt', cav: STEEL });
  if (b.hi) { for (const s of [-1, 1]) pinHead(b, 'gaBolt', 0.016, 0.022, -0.146, 0.003, s); b.box('gaBlued', 0.032, 0.006, 0.01, 0, -0.04, -0.378, { c: 0.0015 }); swivel(b, 'gaSteel', -0.0185, 0.03, -0.1); }
  // --- Gerades Stangenmagazin (32 × 9 mm), Stahl mit Prüflöchern
  boxMag(b, {
    pivot: [0.024, 0.088], hw: 0.0112, mat: 'gaBlued', step: 0.0016, ribs: 1, ribU: () => 0.088, ribLen: 0.2,
    pts: mm([[72, 26], [104, 26], [104, -196], [72, -196]]), floor: [0.07, 0.106, -0.196], floorMat: 'gaBlued',
    holes: [[0.08, -0.05], [0.08, -0.1], [0.08, -0.15]],
    cal: 'p9', width: 0.017, depth: 0.03, show: 2, path: [[0, 0.024, 0.088], [0, -0.18, 0.088]], grab: [-0.07, 0.088],
  });
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.3, gw: 0.0145, gd: 0.023, gu: 0.0, ho: 0.03, tu: 0.034 } });
  b.anchor('leftHandGrip', 0, -0.03, 0.088, { data: { style: 'under', w: 0.0172, h: 0.03 } });
  b.meta = { sight: 'iron', axis: AX, kind: 'smg', selector: null };
}

/* ================================================================== UM-38 Lindwurm (Universal-MG, Weltkriegszeit) */

export function lindwurm(b) {
  const AX = 0.074, RR = 0.0215, SV = AX + 0.052;
  MARK_LINDWURM(b, 'UM-38  LINDWURM', -(0.024 + 0.0003), 0.07, -0.02, 0.0034);
  MARK_LINDWURM(b, 'NP 38 0571', -(0.024 + 0.0003), 0.063, -0.02, 0.0024);
  // --- Gehäuse (rund, Stahl) mit Deckelscharnier hinten, Auswurf unten rechts
  slab(b, mm([[-120, 52], [176, 52], [176, 100], [-120, 100], [-132, 94], [-132, 58]]), 0.024, 0.008, 'gaBlued', { id: 'rec', cav: STEEL, step: 0.0018, cut: (x, v, u, d) => {
    d = Math.max(d, -(Math.hypot(Math.abs(x) - 0.024, v - 0.064) - 0.0009));
    d = pocket(d, x, rrect(u, v, 0.04, 0.062, 0.036, 0.008, 0.003), 0.017, 1);                      // Auswurf (Klappe offen)
    return d;
  } });
  rivets(b, 'gaBlued', 0.0242, [[0.06, -0.1], [0.06, 0.15], [0.09, 0.15], [0.09, -0.1]]);
  // --- Zuführdeckel (Teil 'cover', Scharnier hinten oben → klappt nach oben), Gurtschieber-Rippen, Riegel vorn
  b.part('cover', 0, 0.1, -0.06);
  slab(b, mm([[-64, 98], [150, 98], [154, 104], [140, 122], [-50, 124], [-64, 112]]), 0.0235, 0.004, 'gaBlued', { part: 'cover', cav: STEEL, cut: (x, v, u, d) => {
    for (let i = 0; i < 4; i++) d = Math.max(d, -(Math.hypot(u - (0.0 + i * 0.03), v - 0.124) - 0.0016));
    return d;
  } });
  b.box('gaBolt', 0.03, 0.006, 0.012, 0, 0.118, 0.15, { part: 'cover', c: 0.0015 });
  if (b.hi) b.cyl('gaBolt', 0.0055, 0.0055, 0.052, 0, 0.103, -0.06, { part: 'cover', axis: 'x', seg: 14 });
  // Kimme (Klappleiter) auf dem Deckel
  b.box('gaBlued', 0.026, 0.01, 0.03, 0, 0.128, 0.05, { part: 'cover', c: 0.002 });
  for (const s of [-1, 1]) b.side('gaBlued', [[0.036, 0.13], [0.062, 0.13], [0.058, SV + 0.006], [0.04, SV + 0.006]], 0.003, s * 0.0095, { part: 'cover', bevel: 0.0006 });
  b.box('gaBlued', 0.016, SV - 0.133, 0.004, 0, (SV + 0.133) / 2 - 0.002, 0.05, { part: 'cover', c: 0.0005 });
  b.anchor('sight', 0, SV, 0.05, { data: { type: 'iron', eyeRelief: 0.35 } });
  // --- Gelochter Laufmantel (zwei Lochreihen je Seite, Ober-/Unterseite), Mündungsverstärker, Korn auf Klappfuß
  const J0 = 0.176, J1 = 0.53, RJ = 0.0205;
  barrel(b, 'gaBlued', AX, J0, [[0, RJ * 1.06], [0.012, RJ * 1.06], [0.014, RJ], [J1 - J0 - 0.012, RJ], [J1 - J0 - 0.01, RJ * 1.08], [J1 - J0, RJ * 1.08]], { seg: 36 });
  if (b.hi) for (let k = 0; k < 10; k++) for (let j = 0; j < 8; j++) {
    const a = j * Math.PI / 4 + (k % 2) * Math.PI / 8, u = J0 + 0.03 + k * 0.03;
    b.circle('cavity', 0.0048, Math.cos(a) * (RJ + 0.0002), AX + Math.sin(a) * (RJ + 0.0002), u, { seg: 14, ...rotToSurface(a) });
  }
  barrel(b, 'gaBlued', AX, J1, [[0, 0.0105], [0.018, 0.0105], [0.02, 0.016], [0.055, 0.019], [0.058, 0.0175], [0.06, 0.012]]);
  b.bore(0.0062, 0, AX, J1 + 0.0605);
  b.anchor('muzzle', 0, AX, J1 + 0.061);
  b._barrelEnd = J1 + 0.06; b._muzzleDone = true;
  b.box('gaBlued', 0.012, 0.014, 0.018, 0, AX + RJ + 0.006, J1 - 0.012, { c: 0.0015 });
  b.side('gaBlued', [[J1 - 0.016, AX + RJ + 0.01], [J1 - 0.006, AX + RJ + 0.01], [J1 - 0.008, SV], [J1 - 0.013, SV]], 0.0024, 0, { bevel: 0.0004 });
  for (const s of [-1, 1]) b.side('gaBlued', [[J1 - 0.02, AX + RJ + 0.01], [J1 - 0.002, AX + RJ + 0.01], [J1 - 0.006, SV + 0.004], [J1 - 0.016, SV + 0.004]], 0.0022, s * 0.007, { bevel: 0.0004 });
  // --- Zweibein (vorn am Mantel, eingeklappt), Tragegriff
  b.lathe('gaBlued', [[0, 0], [0, RJ * 1.15], [0.016, RJ * 1.15], [0.016, 0]], 0, AX, 0.47, { seg: b.seg(28, 8) });
  for (const s of [-1, 1]) {
    b.cyl('gaSteel', 0.0055, 0.0055, 0.26, s * 0.016, AX - 0.03, 0.34, { seg: b.seg(10, 4) });
    b.box('gaSteel', 0.01, 0.006, 0.03, s * 0.016, AX - 0.034, 0.22, { c: 0.002 });
  }
  b.tube('gaBlued', [[0, AX + RJ, 0.24], [0.034, AX + 0.03, 0.25], [0.04, AX + 0.034, 0.3], [0.034, AX + 0.03, 0.35], [0, AX + RJ, 0.36]], 0.005);
  // --- Kolben (Bakelit) mit Schulterstück, Griff, Abzug (Wippe für Einzel/Dauer)
  slab(b, mm([[-130, 96], [-300, 86], [-430, 84], [-440, 76], [-440, -40], [-430, -46], [-300, -16], [-170, 30], [-130, 50]]), (u) => (u < -0.3 ? 0.021 : 0.0185), 0.008, 'gbBakelite', { hwMax: 0.021, id: 'stock', cav: POLY, step: 0.0024 });
  slab(b, mm([[-440, 80], [-452, 80], [-454, 70], [-454, -38], [-446, -48], [-440, -44]]), 0.0215, 0.003, 'gaBlued', { id: 'butt', cav: STEEL });
  slab(b, mm([[-118, 52], [130, 52], [130, 30], [60, 18], [40, 6], [-24, 6], [-60, 20], [-118, 30]]), 0.019, 0.003, 'gaBlued', { id: 'trig', cav: STEEL });
  pistolGrip(b, 'gbBakelite', { u: -0.006, top: 0.008, h: 0.096, w: 0.046, rake: 0.36, hw: 0.0155, id: 'grip', cap: 'gaBlued', grooves: false });
  if (b.hi) for (const s of [-1, 1]) for (let i = 0; i < 10; i++) b.box('cavity', 0.0006, 0.0011, 0.032, s * 0.0157, -0.008 - i * 0.008, -0.01 - i * 0.003, { c: 0 });
  triggerUnit(b, { u0: 0.012, u1: 0.06, vTop: 0.006, depth: 0.026, hw: 0.019, mat: 'gaBlued', id: 'lindwurm' });
  if (b.hi) b.cyl('gaBolt', 0.0042, 0.0042, 0.042, 0, 0.02, -0.03, { axis: 'x', seg: 14 });                                         // Sicherung (Querbolzen)
  // --- Spannhebel rechts, Verschluss
  chargeKnob(b, 'gaSteel', 1, 0.024, 0.07, 0.11, 0.11, 'right', { stem: 0.022, len: 0.034, r: 0.0065 });
  if (b.hi) b.box('cavity', 0.002, 0.007, 0.12, 0.0244, 0.07, 0.07, { c: 0 });
  b.part('bolt', 0, AX, 0.02);
  b.box('gaBolt', 0.004, 0.012, 0.06, 0.0165, 0.062, 0.04, { part: 'bolt', c: 0.0008 });
  b.anchor('ejection', 0.026, 0.062, 0.04, { rz: 0.3 });
  // --- Gurttrommel links (Teil 'mag', 50 Schuss) mit Deckel, Tragebügel; Gurt ('belt') läuft in die Zuführung
  b.part('mag', -0.06, 0.03, 0.06);
  b.cyl('gaBlued', 0.052, 0.052, 0.07, -0.062, 0.02, 0.06, { part: 'mag', axis: 'x', seg: b.seg(40, 10) });
  if (b.hi) {
    for (const s of [-1, 1]) b.torus('gaBlued', 0.052, 0.0022, -0.062 + s * 0.035, 0.02, 0.06, { part: 'mag', ry: Math.PI / 2, seg: 8, tseg: 40 });
    for (let i = 0; i < 3; i++) b.torus('gaSteel', 0.036 - i * 0.01, 0.0014, -0.098, 0.02, 0.06, { part: 'mag', ry: Math.PI / 2, seg: 6, tseg: 32 });   // Prägeringe Deckel
    b.box('gaSteel', 0.006, 0.014, 0.03, -0.1, 0.02, 0.06, { part: 'mag', c: 0.002 });                                              // Deckelriegel
    b.tube('gaSteel', [[-0.04, 0.072, 0.03], [-0.062, 0.088, 0.04], [-0.084, 0.072, 0.03]], 0.0025, { part: 'mag' });                  // Bügel
  }
  b.box('gaBlued', 0.022, 0.03, 0.05, -0.03, 0.06, 0.06, { part: 'mag', c: 0.002 });                                                 // Hals zur Zuführung
  b.part('belt', 0, 0, 0, 'mag');
  const beltAt = (t) => [-0.032 + t * 0.03, 0.074 + t * 0.022, 0.058];
  magRounds(b, { part: 'belt', cal: 'r308', fit: 0.066, link: true, stagger: false, follower: false, spread: 5, path: Array.from({ length: 5 }, (_, i) => beltAt(1 - i / 4)) });
  b.anchor('magGrab', -0.062, -0.01, 0.06, { part: 'mag', data: { w: 0.038, d: 0.06 } });
  b.anchor('magWell', -0.06, 0.03, 0.06);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.36, gw: 0.0155, gd: 0.021, gu: 0.006, ho: 0.039, tu: 0.03 } });
  b.anchor('leftHandGrip', 0, AX - RJ - 0.002, 0.3, { data: { style: 'under', r: RJ + 0.004 } });
  b.meta = { sight: 'iron', axis: AX, kind: 'lmg' };
}

/** Kreisscheibe tangential auf einen Zylinder um die u-Achse legen (Winkel a um die Achse): Drehung so, dass die Normale radial zeigt. */
function rotToSurface(a) {
  // CircleGeometry liegt in der x-y-Ebene (Normale +z); erst auf +x legen (ry = π/2), dann um die Laufachse (z) drehen
  return { ry: Math.PI / 2, rz: a, order: 'ZYX' };
}

/* ================================================================== PF-12 Stier (Vorderschaftrepetierflinte) */

export function stier(b) {
  const AX = 0.064;
  MARK_STIER(b, 'PF-12  STIER  KAL 12/76', -(0.0186 + 0.0003), 0.056, 0.03, 0.0034);
  MARK_STIER(b, 'NP 120944', -(0.0186 + 0.0003), 0.049, 0.03, 0.0025);
  // --- Gehäuse (Aluminium) mit Schiene, Ladeöffnung unten, Auswurf rechts, Verschlussfang
  slab(b, mm([[-74, 18], [158, 18], [160, 70], [152, 88], [-30, 90], [-62, 84], [-74, 70]]), 0.0186, 0.004, 'gaAlu', { id: 'rec', cav: STEEL, step: 0.0018, cut: (x, v, u, d) => {
    d = Math.max(d, -Math.max(rrect(u, x, 0.09, 0, 0.034, 0.011, 0.004), v - 0.024));            // Ladeöffnung
    d = Math.max(d, -(Math.hypot(Math.abs(x) - 0.0186, v - 0.03) - 0.0008));
    return d;
  } });
  b.picatinny('gaAlu', 0, 0.089, -0.04, 0.15);
  ejectionPort(b, 0.0186, 0.06, 0.09, 0.072, 0.026, 'gaAlu');
  if (b.hi) {
    b.box('gaBolt', 0.012, 0.002, 0.04, 0, 0.0195, 0.085, { c: 0 });                                                                 // Zubringer
    for (const u of [-0.046, 0.034]) pinHead(b, 'gaBolt', 0.0186, 0.026, u, 0.003);
    b.side('gaSteel', [[0.064, 0.012], [0.084, 0.014], [0.086, 0.02], [0.07, 0.021]], 0.003, -0.0198, { bevel: 0.0005 });           // Fanghebel
  }
  b.anchor('shellPort', 0, 0.012, 0.09);
  // Patronenhalter links (sechs Patronen, Messingböden nach hinten)
  b.box('gaPolyDark', 0.006, 0.03, 0.12, -0.0215, 0.05, 0.06, { c: 0.002 });
  for (let i = 0; i < 6; i++) {
    const u = 0.012 + i * 0.019;
    b.cyl('shellRed', 0.0105, 0.0105, 0.05, -0.034, 0.068 - 0.025, u, { axis: 'v', seg: b.seg(16, 5) });
    b.cyl('brass', 0.011, 0.011, 0.012, -0.034, 0.068 - 0.025 + 0.031, u, { axis: 'v', seg: b.seg(16, 5) });
    if (b.hi) b.cyl('gaBolt', 0.0026, 0.0026, 0.0008, -0.034, 0.068 - 0.025 + 0.0372, u, { axis: 'v', seg: 10 });                    // Zündhütchen
  }
  // --- Abzugsgruppe + Sicherung (Querbolzen hinter dem Abzug)
  triggerUnit(b, { u0: 0.006, u1: 0.054, vTop: 0.016, depth: 0.026, hw: 0.0186, mat: 'gaPoly', id: 'stier' });
  if (b.hi) { b.cyl('gaSteel', 0.0035, 0.0035, 0.04, 0, 0.012, -0.002, { axis: 'x', seg: 14 }); b.cyl('paintSignal', 0.0036, 0.0036, 0.002, -0.0196, 0.012, -0.002, { axis: 'x', seg: 14 }); }
  // --- Schaft (Polymer) mit Pistolengriff, Rückstoßpolster
  slab(b, mm([[-72, 84], [-130, 74], [-260, 64], [-380, 60], [-386, 52], [-386, -74], [-376, -82], [-260, -52], [-150, -26], [-80, -16],
    [-56, -20], [-60, -60], [-66, -96], [-58, -104], [-20, -104], [-16, -96], [-6, -60], [6, -10], [8, 18], [-72, 18]]), (u, v) => (v < -0.018 && u > -0.07 ? 0.0152 : 0.0195), 0.0075, 'gaPoly', { hwMax: 0.0195, id: 'stock', cav: POLY, step: 0.0024 });
  slab(b, mm([[-54, -26], [-58, -60], [-64, -94], [-56, -100], [-22, -100], [-18, -94], [-8, -60], [2, -28]]), 0.0158, 0.006, 'gaGrip', { id: 'gripsk', cav: POLY });
  slab(b, mm([[-386, 62], [-406, 62], [-410, 50], [-410, -74], [-400, -86], [-386, -80]]), 0.021, 0.005, 'rubber', { id: 'butt', cav: POLY });
  if (b.hi) { for (let i = 0; i < 10; i++) b.box('cavity', 0.043, 0.0011, 0.003, 0, 0.05 - i * 0.012, -0.4095, { c: 0 }); swivel(b, 'gaSteel', 0, -0.06, -0.33, { under: true }); }
  // --- Lauf mit gelochtem Hitzeschild, Würgebohrung (Rändelring)
  barrel(b, 'gaBlued', AX, 0.158, [[0, 0.0124], [0.47, 0.0118], [0.472, 0.0118]]);
  slab(b, mm([[200, 66], [560, 66], [568, 72], [568, 90], [560, 92], [200, 92], [194, 86], [194, 72]]), 0.0145, 0.0035, 'gaSteel', { id: 'shield', cav: STEEL, step: 0.0016, cut: (x, v, u, d) => {
    for (let i = 0; i < 9; i++) for (const s of [-1, 1]) d = Math.max(d, -Math.max(rrect(u, v, 0.22 + i * 0.038, 0.08, 0.012, 0.006, 0.006), s * x - 0.006));
    return d;
  } });
  if (b.hi) b.cyl('knurl', 0.0132, 0.0132, 0.016, 0, AX, 0.622, { seg: 28 });
  b.bore(0.0092, 0, AX, 0.6305);
  b.anchor('muzzle', 0, AX, 0.631);
  b._barrelEnd = 0.63;
  // --- Röhrenmagazin mit Verlängerung, Schelle (Laufring), Kappe
  b.cyl('gaBlued', 0.0118, 0.0118, 0.43, 0, AX - 0.026, 0.38, { seg: b.seg(24, 6) });
  b.lathe('gaBlued', [[0, 0.0128], [0.004, 0.0135], [0.026, 0.0135], [0.03, 0.0118], [0.032, 0.006], [0.032, 0]], 0, AX - 0.026, 0.592, { seg: b.seg(24, 6) });
  slab(b, mm([[520, 30], [540, 30], [540, 82], [520, 82]]), 0.0145, 0.003, 'gaSteel', { id: 'clamp', cav: STEEL });
  if (b.hi) { slotScrew(b, 'gaSteel', 0.0146, AX - 0.012, 0.53, 0.0026, 1); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; b.box('cavity', 0.0012, 0.0016, 0.016, Math.cos(a) * 0.0135, AX - 0.026 + Math.sin(a) * 0.0135, 0.606, { rz: a, c: 0 }); } }
  // --- Vorderschaft (Teil 'pump', Polymer mit Griffrillen) + Schienen zum Verschluss
  b.part('pump', 0, AX - 0.022, 0.3);
  const L = 0.2, ribs = [[0, 0.0135], [0.006, 0.0225]];
  const nR = b.hi ? 14 : 2;
  for (let i = 0; i < nR; i++) { const u = 0.016 + i * ((L - 0.03) / nR); ribs.push([u, 0.0255], [u + (L - 0.03) / nR * 0.55, 0.0255], [u + (L - 0.03) / nR * 0.8, 0.0238]); }
  ribs.push([L - 0.008, 0.0238], [L, 0.0135]);
  b.lathe('gaPoly', ribs, 0, AX - 0.022, 0.2, { part: 'pump', seg: b.seg(28, 6), sx: 0.92, sy: 1.12 });
  for (const s of [-1, 1]) b.box('gaSteel', 0.0028, 0.006, 0.18, s * 0.0128, AX - 0.03, 0.14, { part: 'pump', c: 0.0008 });
  b.anchor('pumpGrab', 0, AX - 0.05, 0.3, { part: 'pump', data: { travel: [0, 0, 0.088] } });
  b.part('shell', 0, 0.012, 0.09);
  b.cyl('shellRed', 0.0105, 0.0105, 0.055, 0, 0.012, 0.09, { part: 'shell', seg: b.seg(14, 5) });
  b.cyl('brass', 0.0109, 0.0109, 0.013, 0, 0.012, 0.059, { part: 'shell', seg: b.seg(14, 5) });
  // --- Geisterring hinten (auf der Schiene), Korn mit Leuchtröhrchen vorn auf dem Hitzeschild
  const RT = 0.089 + 0.0077, SV = RT + 0.02;
  b.box('gaSteel', 0.026, 0.008, 0.03, 0, RT + 0.004, -0.02, { c: 0.0015 });
  for (const s of [-1, 1]) b.side('gaSteel', [[-0.032, RT + 0.008], [-0.008, RT + 0.008], [-0.012, SV + 0.009], [-0.028, SV + 0.009]], 0.003, s * 0.0115, { bevel: 0.0006 });
  b.torus('gaSteel', 0.0056, 0.0019, 0, SV, -0.02, { seg: b.seg(10, 4), tseg: b.seg(22, 8) });
  b.box('gaSteel', 0.004, SV - RT - 0.014, 0.004, 0, (SV + RT + 0.008) / 2 - 0.003, -0.02, { c: 0.0005 });
  b.anchor('sight', 0, SV, -0.02, { data: { type: 'iron', eyeRelief: 0.27 } });
  b.box('gaSteel', 0.012, 0.012, 0.02, 0, 0.098, 0.548, { c: 0.002 });
  b.side('gaSteel', [[0.54, 0.104], [0.556, 0.104], [0.553, SV], [0.543, SV]], 0.0034, 0, { bevel: 0.0005 });
  b.cyl('glowGreen', 0.0011, 0.0011, 0.008, 0, SV - 0.0016, 0.547, { seg: 8 });
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.32, gw: 0.0152, gd: 0.023, gu: 0.0, ho: 0.03, tu: 0.04 } });
  b.anchor('trigger', 0, -0.002, 0.024);
  b.anchor('leftHandGrip', 0, AX - 0.05, 0.3, { part: 'pump', data: { style: 'pump', w: 0.022, h: 0.026 } });
  b.meta = { sight: 'iron', axis: AX, kind: 'shotgun', hidden: ['shell'] };
}
