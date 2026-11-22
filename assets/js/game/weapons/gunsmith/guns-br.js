// Zusatzwaffen des Battle-Royale-Modus (22.11.2026, shared/weapons-br.data.js): frei erfundene Waffen nach realen Bauarten,
// keine Nachbauten bestimmter Modelle, ohne Herstellerzeichen. Nur vorhandene Materialien (kein eigenes Schrift-Material).
//   SM-12 Amboss    Schweres MG 12,7 mm aus der Hand: Kastengehäuse mit Zuführdeckel, schwerer Lauf im gelochten Kühlmantel,
//                   Mündungsbremse, Tragegriff, Zweibein (angeklappt), Munitionskasten links mit Gurt, Skelettschaft.
//   AS-20 Sturmflut Vollautomatische Flinte: Gehäuse mit Schiene, Gasrohr unter dem Lauf, gelochter Handschutz, Trommel (20)
//                   mit Aufziehflügel und Sichtfenster, fester Schaft mit Gummikappe.
//   MT-95 Schwarm   MP 9 mm: Rundgehäuse, gelochter Laufmantel, Doppeltrommel (zwei Trommeln links/rechts am Mittelstück),
//                   Klappschaft aus Stahlrohr, Diopter mit Ringkorn.
//   AB-3 Sehne      Armbrust mit Umlenkrollen: Schaft mit Lochschaft-Griff, Führungsschiene, Bogenarme mit Rollen, Sehne und
//                   Spannkabel, Spannbügel vorn, Kompaktvisier; geladener Bolzen (Teil 'rocket') liegt in der Schiene.
//   SV-9 Flüsterer  Präzisionsgewehr mit Integralschalldämpfer: Stahlgehäuse, Schalldämpfer über die ganze Lauflänge mit
//                   Rändelbändern, Skelettschaft mit Wangenauflage, 10-Schuss-Magazin, 3-fach-Kampfvisier auf der Schiene.
// Dazu der fliegende Bolzen ('bolzen', Projektil der Armbrust, ballistics/rockets.js P.mesh).
// Haltung/Abläufe: Einträge in HANDLING/ID_TO_MODEL (handling.js) werden hier ergänzt – nur additiv.
import { mm, slab, POLY, STEEL, pistolGrip, triggerUnit, boxMag, barrel, frontSight, rearNotch, swivel, selectorLever, boltInPort, chargeKnob, ownMuzzle } from './neu-kit.js?v=20261122020853';
import { acog } from './parts.js?v=20261122020853';
import { magRounds } from './magfill.js?v=20261122020853';
import { HANDLING, ID_TO_MODEL } from './handling.js?v=20261122020853';

const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

/* ================================================================== SM-12 Amboss (schweres MG 12,7 mm) */

export function amboss(b) {
  const AX = 0.072, SV = AX + 0.074;
  // --- Gehäuse (Stahlkasten) mit Seitenplatten, Nieten, Zuführschale links
  b.side('gbSteel', [[-0.13, AX - 0.044], [0.2, AX - 0.044], [0.215, AX - 0.03], [0.215, AX + 0.036], [-0.12, AX + 0.036], [-0.13, AX + 0.02]], 0.072, 0, { bevel: 0.004, bevelSeg: 2 });
  if (b.hi) {
    for (const s of [-1, 1]) {
      b.box('gbBlued', 0.003, 0.05, 0.27, s * 0.0365, AX - 0.004, 0.04, { c: 0.001 });
      for (let i = 0; i < 6; i++) for (const dv of [-0.022, 0.018]) b.sphere('gbSteel', 0.0026, s * 0.038, AX + dv, -0.08 + i * 0.05, { seg: 10, hseg: 6, sx: 0.5 });
    }
    b.box('cavity', 0.074, 0.0012, 0.3, 0, AX + 0.012, 0.04, { c: 0 });                    // Fuge Deckel/Gehäuse
  }
  b.box('gbSteel', 0.024, 0.018, 0.06, -0.045, AX + 0.012, 0.12, { c: 0.002 });           // Zuführschale (Gurteinlauf)
  // --- Zuführdeckel (Teil 'cover', Scharnier vorn) mit Rippen und Riegel
  b.part('cover', 0, AX + 0.036, 0.2);
  b.side('gbSteel', rect(-0.118, AX + 0.036, 0.205, AX + 0.05), 0.07, 0, { part: 'cover', bevel: 0.003 });
  if (b.hi) {
    for (let i = 0; i < 6; i++) b.box('gbSteel', 0.066, 0.004, 0.006, 0, AX + 0.052, -0.08 + i * 0.05, { part: 'cover', c: 0.001 });
    b.cyl('gbSteel', 0.007, 0.007, 0.076, 0, AX + 0.042, 0.205, { part: 'cover', axis: 'x', seg: 14 });
    b.box('knurl', 0.03, 0.01, 0.016, 0, AX + 0.054, -0.11, { part: 'cover', c: 0.002 });
  }
  // --- Visier: Klappkimme auf dem Deckel, Korn mit Schutzohren auf dem Lauf
  rearNotch(b, 'gbBlued', -0.08, AX + 0.05, SV, { hw: 0.009, eye: 0.3, ears: true });
  // --- Lauf: Laufmutter, gelochter Kühlmantel, schwerer Lauf, Mündungsbremse
  barrel(b, 'gbBlued', AX, 0.215, [[0, 0.03], [0.04, 0.03], [0.045, 0.026], [0.36, 0.026], [0.365, 0.022]], { seg: 28 });
  if (b.hi) for (let r = 0; r < 6; r++) for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + (r % 2) * Math.PI / 8;
    b.cyl('cavity', 0.0058, 0.0058, 0.004, Math.cos(a) * 0.0255, AX + Math.sin(a) * 0.0255, 0.29 + r * 0.045, { seg: 10, rx: Math.PI / 2, rz: a + Math.PI / 2 });
  }
  barrel(b, 'gbBarrel', AX, 0.58, [[0, 0.0155], [0.38, 0.0148]], { seg: 24 });
  const end = ownMuzzle(b, 'brake', 0.96, AX, 0.0148, 'gbBlued');
  b.anchor('muzzle', 0, AX, end + 0.002);
  frontSight(b, 'gbBlued', AX, 0.9, SV, { r: 0.0148, ears: true });
  // --- Tragegriff über dem Mantel, Zweibein (angeklappt unter dem Lauf)
  b.tube('gbBlued', [[0, AX + 0.028, 0.3], [0, AX + 0.07, 0.33], [0, AX + 0.072, 0.43], [0, AX + 0.028, 0.46]], 0.0065);
  if (b.hi) b.cyl('gbGrip', 0.012, 0.012, 0.09, 0, AX + 0.073, 0.38, { seg: 16 });
  b.box('gbSteel', 0.04, 0.016, 0.03, 0, AX - 0.03, 0.62, { c: 0.002 });
  for (const s of [-1, 1]) b.tube('gbBlued', [[s * 0.012, AX - 0.036, 0.62], [s * 0.018, AX - 0.04, 0.8]], 0.0065);
  if (b.hi) for (const s of [-1, 1]) b.box('rubber', 0.014, 0.01, 0.024, s * 0.018, AX - 0.04, 0.81, { c: 0.002 });
  // --- Spannhebel rechts, Verschluss im Auswurffenster
  boltInPort(b, 0.0365, AX - 0.012, 0.04, 0.06, 0.018, { mat: 'gbSteel' });
  chargeKnob(b, 'gbSteel', 1, 0.0375, AX + 0.008, 0.15, 0.11, 'right', { stem: 0.024, r: 0.008, len: 0.036 });
  // --- Griffstück, Pistolengriff, Abzug, Skelettschaft mit Gummikappe
  b.side('gbSteel', rect(-0.06, AX - 0.06, 0.09, AX - 0.044), 0.05, 0, { bevel: 0.003 });
  pistolGrip(b, 'gaGrip', { u: -0.004, top: 0.01, h: 0.1, w: 0.05, rake: 0.3, hw: 0.0158, id: 'grip' });
  triggerUnit(b, { u0: 0.014, u1: 0.064, vTop: 0.012, depth: 0.026, hw: 0.025, mat: 'gbSteel', id: 'amboss' });
  slab(b, mm([[-125, 100], [-300, 96], [-410, 92], [-410, -30], [-396, -40], [-300, 0], [-160, 20], [-125, 26]]), 0.018, 0.006, 'gaPolyOD',
    { id: 'stock', cav: POLY, holes: [mm([[-180, 80], [-370, 78], [-370, 4], [-300, 22], [-180, 40]])] });
  b.side('rubber', [[-0.41, 0.094], [-0.428, 0.094], [-0.43, 0.08], [-0.43, -0.032], [-0.42, -0.044], [-0.41, -0.032]], 0.04, 0, { bevel: 0.004 });
  swivel(b, 'gbSteel', -0.02, 0.03, -0.38);
  // --- Munitionskasten links (Teil 'mag') mit Deckel ('lid') und Gurt ('belt')
  b.part('mag', -0.075, AX - 0.04, 0.1);
  b.box('gbOlive', 0.078, 0.11, 0.16, -0.08, AX - 0.075, 0.1, { part: 'mag', c: 0.004 });
  if (b.hi) {
    for (let i = 0; i < 3; i++) b.box('gbOlive', 0.0806, 0.004, 0.14, -0.08, AX - 0.11 + i * 0.03, 0.1, { part: 'mag', c: 0.001 });
    b.box('paintYellow', 0.0006, 0.012, 0.06, -0.1196, AX - 0.08, 0.1, { part: 'mag', c: 0 });
    b.box('gbSteel', 0.004, 0.034, 0.014, -0.1195, AX - 0.04, 0.05, { part: 'mag', c: 0.001 });
  }
  b.part('lid', -0.119, AX - 0.018, 0.1, 'mag');
  b.box('gbOlive', 0.082, 0.012, 0.164, -0.08, AX - 0.014, 0.1, { part: 'lid', c: 0.003 });
  b.part('belt', 0, 0, 0, 'mag');
  const beltAt = (t) => [-0.07 + t * 0.03, AX - 0.02 + t * 0.045 + Math.sin(t * Math.PI) * 0.012, 0.115];
  magRounds(b, { part: 'belt', cal: 'r50', fit: 0.1, link: true, stagger: false, follower: false, spread: 7, cap: 50, path: Array.from({ length: 7 }, (_, i) => beltAt(1 - i / 6)) });
  if (!b.hi) b.box('brass', 0.03, 0.05, 0.06, -0.06, AX + 0.01, 0.11, { part: 'belt', rz: -0.5 });
  b.anchor('magGrab', -0.08, AX - 0.08, 0.1, { part: 'mag', data: { w: 0.04, d: 0.08 } });
  b.anchor('magWell', -0.075, AX - 0.04, 0.1);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.3, gw: 0.0158, gd: 0.024, gu: 0.004, ho: 0.04, tu: 0.032 } });
  b.anchor('leftHandGrip', 0, AX - 0.034, 0.36, { data: { style: 'under', r: 0.03 } });
  b.meta = { sight: 'iron', axis: AX, kind: 'lmg' };
}

/* ================================================================== AS-20 Sturmflut (Automatikflinte, Trommel) */

export function sturmflut(b) {
  const AX = 0.06, R = 0.0128;
  // --- Gehäuse (Polymer) mit Schiene, Auswurffenster rechts
  slab(b, mm([[-80, 86], [236, 86], [244, 76], [244, 30], [118, 26], [60, 24], [40, 12], [-30, 12], [-60, 22], [-80, 34]]), 0.0225, 0.005, 'gaPoly', { id: 'rec', cav: POLY });
  b.picatinny('gaAlu', 0, 0.086, -0.06, 0.22);
  boltInPort(b, 0.0225, AX + 0.006, 0.07, 0.05, 0.016);
  chargeKnob(b, 'gaSteel', 1, 0.0235, AX + 0.014, 0.17, 0.07, 'right', { stem: 0.016 });
  selectorLever(b, 'gaSteel', 0.0225, 0.03, -0.02, { both: true });
  // --- Lauf, Gasrohr, gelochter Handschutz, Mündung
  barrel(b, 'gaBlued', AX, 0.244, [[0, R], [0.3, R]], { seg: 28 });
  b.cyl('gaSteel', 0.0075, 0.0075, 0.2, 0, AX - 0.024, 0.34, { seg: 14 });
  slab(b, mm([[230, 82], [430, 82], [438, 74], [438, 26], [230, 26]]), 0.024, 0.004, 'gaPolyDark', { id: 'hg', cav: POLY, cut: (x, v, u, d) => {
    for (let i = 0; i < 5; i++) d = Math.max(d, -(Math.max(Math.abs(u - (0.26 + i * 0.035)) - 0.008, Math.abs(v - 0.054) - 0.012)));
    return d;
  } });
  const end = ownMuzzle(b, 'cone', 0.544, AX, R, 'gaBlued');
  b.anchor('muzzle', 0, AX, end + 0.002);
  frontSight(b, 'gaBlued', AX, 0.5, AX + 0.046, { r: R, hood: true });
  rearNotch(b, 'gaBlued', -0.04, 0.093, AX + 0.046, { hw: 0.008, eye: 0.28 });
  // --- Griff, Abzug, fester Schaft mit Gummikappe
  pistolGrip(b, 'gaGrip', { u: -0.004, top: 0.012, h: 0.1, w: 0.048, rake: 0.3, hw: 0.015, id: 'grip' });
  triggerUnit(b, { u0: 0.014, u1: 0.062, vTop: 0.012, depth: 0.026, hw: 0.0185, mat: 'gaPoly', id: 'sturmflut' });
  slab(b, mm([[-80, 84], [-330, 80], [-352, 76], [-352, -46], [-340, -54], [-200, -12], [-80, 18]]), 0.0185, 0.006, 'gaPoly', { id: 'stock', cav: POLY });
  b.side('rubber', [[-0.352, 0.078], [-0.368, 0.078], [-0.37, 0.066], [-0.37, -0.046], [-0.36, -0.056], [-0.352, -0.048]], 0.04, 0, { bevel: 0.004 });
  swivel(b, 'gaSteel', -0.019, 0.02, -0.3);
  // --- Trommel (Teil 'mag'): Zuführhals, Körper, Aufziehflügel, Sichtfenster
  b.part('mag', 0, 0.026, 0.13);
  b.box('gaPolyDark', 0.034, 0.05, 0.05, 0, 0.004, 0.13, { part: 'mag', c: 0.004 });
  b.cyl('gaPolyDark', 0.072, 0.072, 0.056, 0, -0.07, 0.12, { part: 'mag', axis: 'x', seg: b.seg(40, 12) });
  if (b.hi) {
    for (const s of [-1, 1]) {
      b.torus('gaPoly', 0.064, 0.004, s * 0.028, -0.07, 0.12, { ry: Math.PI / 2, seg: 8, tseg: 40 });
      b.cyl('gaSteel', 0.016, 0.016, 0.006, s * 0.031, -0.07, 0.12, { part: 'mag', axis: 'x', seg: 20 });
    }
    b.box('gaSteel', 0.006, 0.05, 0.012, -0.037, -0.07, 0.12, { part: 'mag', c: 0.002 });           // Aufziehflügel
    b.box('smokeDark', 0.0008, 0.012, 0.06, 0.0286, -0.03, 0.12, { part: 'mag', rx: 0.4, c: 0 });  // Sichtfenster
  }
  b.anchor('magGrab', 0, -0.07, 0.12, { part: 'mag', data: { w: 0.03, d: 0.08 } });
  b.anchor('magWell', 0, 0.026, 0.13);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.3, gw: 0.015, gd: 0.024, gu: 0.0, ho: 0.03, tu: 0.034 } });
  b.anchor('leftHandGrip', 0, 0.03, 0.33, { data: { style: 'under', w: 0.026, h: 0.024 } });
  b.meta = { sight: 'iron', axis: AX, kind: 'shotgun' };
}

/* ================================================================== MT-95 Schwarm (MP mit Doppeltrommel) */

export function schwarm(b) {
  const AX = 0.055, R = 0.019;
  // --- Rundgehäuse mit Endkappe, gelochter Laufmantel, Lauf, Ringkorn
  barrel(b, 'gaSteel', AX, -0.1, [[0, R * 0.95], [0.004, R], [0.25, R], [0.255, R * 0.96]], { seg: 32 });
  b.lathe('gaBlued', [[0, 0], [0, R * 0.92], [0.014, R * 1.02], [0.018, R * 0.9], [0.018, 0]], 0, AX, -0.116, { seg: b.seg(28, 8) });
  barrel(b, 'gaBlued', AX, 0.155, [[0, 0.0165], [0.12, 0.0165], [0.125, 0.012]], { seg: 28 });
  if (b.hi) for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + (r % 2) * Math.PI / 6;
    b.cyl('cavity', 0.0042, 0.0042, 0.003, Math.cos(a) * 0.0162, AX + Math.sin(a) * 0.0162, 0.175 + r * 0.025, { seg: 10, rx: Math.PI / 2, rz: a + Math.PI / 2 });
  }
  barrel(b, 'gaBlued', AX, 0.28, [[0, 0.0078], [0.03, 0.0078]], { seg: 18 });
  b.bore(0.0045, 0, AX, 0.3105);
  b.anchor('muzzle', 0, AX, 0.312);
  frontSight(b, 'gaBlued', AX, 0.262, AX + 0.042, { r: 0.0165, hood: true });
  b.box('gaSteel', 0.02, 0.014, 0.03, 0, AX + R + 0.004, -0.07, { c: 0.002 });
  rearNotch(b, 'gaBlued', -0.07, AX + R + 0.011, AX + 0.042, { hw: 0.008, eye: 0.26, ears: true });
  boltInPort(b, R - 0.001, AX + 0.004, 0.05, 0.04, 0.012);
  chargeKnob(b, 'gaSteel', -1, -R - 0.002, AX, 0.11, 0.07, 'right', { stem: 0.014 });
  // --- Griffstück mit Schacht, Griff, Abzug
  slab(b, mm([[-90, 40], [140, 40], [140, 26], [100, 12], [100, -6], [52, -6], [30, 6], [-36, 6], [-62, 14], [-90, 22]]), 0.0165, 0.004, 'gaPoly', { id: 'lower', cav: POLY });
  pistolGrip(b, 'gaGrip', { u: -0.004, top: 0.008, h: 0.098, w: 0.046, rake: 0.3, hw: 0.0145, id: 'grip' });
  triggerUnit(b, { u0: 0.012, u1: 0.058, vTop: 0.006, depth: 0.024, hw: 0.0165, mat: 'gaPoly', id: 'schwarm' });
  selectorLever(b, 'gaSteel', 0.0165, 0.022, -0.016, { both: true });
  // --- Klappschaft aus Stahlrohr mit Kappe
  b.tube('gaBlued', [[0, AX + 0.004, -0.112], [0, AX + 0.006, -0.24], [0, AX + 0.002, -0.34]], 0.006);
  b.tube('gaBlued', [[0, 0.028, -0.112], [0, -0.002, -0.22], [0, -0.034, -0.34]], 0.006);
  b.side('rubber', [[-0.34, 0.068], [-0.356, 0.068], [-0.36, 0.058], [-0.36, -0.036], [-0.352, -0.046], [-0.34, -0.042]], 0.034, 0, { bevel: 0.004 });
  swivel(b, 'gaSteel', -0.017, 0.03, -0.12);
  // --- Doppeltrommel (Teil 'mag'): Mittelstück im Schacht, zwei Trommeln links/rechts
  b.part('mag', 0, -0.006, 0.076);
  b.box('gaMag', 0.024, 0.07, 0.036, 0, -0.04, 0.076, { part: 'mag', c: 0.003 });
  for (const s of [-1, 1]) {
    b.cyl('drumBody', 0.05, 0.05, 0.034, s * 0.03, -0.09, 0.07, { part: 'mag', axis: 'x', seg: b.seg(36, 12) });
    if (b.hi) {
      b.cyl('gaMag', 0.014, 0.014, 0.004, s * 0.048, -0.09, 0.07, { part: 'mag', axis: 'x', seg: 18 });
      b.torus('gaMag', 0.046, 0.0028, s * 0.047, -0.09, 0.07, { part: 'mag', ry: Math.PI / 2, seg: 6, tseg: 36 });
      b.box('smokeDark', 0.0008, 0.034, 0.008, s * 0.0475, -0.07, 0.07, { part: 'mag', c: 0 });
    }
  }
  b.anchor('magGrab', 0, -0.09, 0.07, { part: 'mag', data: { w: 0.05, d: 0.06 } });
  b.anchor('magWell', 0, -0.006, 0.076);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.3, gw: 0.0145, gd: 0.023, gu: 0.0, ho: 0.03, tu: 0.034 } });
  b.anchor('leftHandGrip', 0, AX - 0.02, 0.2, { data: { style: 'under', w: 0.018, h: 0.018 } });
  b.meta = { sight: 'iron', axis: AX, kind: 'smg' };
}

/* ================================================================== AB-3 Sehne (Armbrust mit Umlenkrollen) */

/** Bolzen entlang u ab u0 (Länge L): Schaft, Nocke hinten, Federn, Spitze vorn. */
function boltBody(b, u0, L, axis, part) {
  const o = part ? { part } : {};
  b.cyl('gaAlu', 0.0044, 0.0044, L, 0, axis, u0 + L / 2, { ...o, seg: b.seg(12, 5) });
  b.cyl('gaPolyTan', 0.0048, 0.0042, 0.012, 0, axis, u0 + 0.006, { ...o, seg: b.seg(10, 5) });
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + Math.PI / 2;
    b.box('paintOlive', 0.0008, 0.011, 0.05, Math.cos(a) * 0.009, axis + Math.sin(a) * 0.009, u0 + 0.04, { ...o, rz: a - Math.PI / 2, c: 0 });
  }
  b.cyl('gaSteel', 0.0062, 0.0046, 0.016, 0, axis, u0 + L + 0.006, { ...o, seg: b.seg(12, 5) });
  b.cyl('blade', 0.0005, 0.0062, 0.024, 0, axis, u0 + L + 0.026, { ...o, seg: b.seg(4, 4) });
}

export function sehne(b) {
  const AX = 0.074;
  // --- Schaft (Polymer, oliv) mit Lochschaft-Griff, Wangenauflage, Kolbenkappe
  slab(b, mm([[60, 60], [-60, 62], [-200, 70], [-330, 72], [-344, 66], [-344, -60], [-330, -68], [-230, -36], [-120, -20], [-60, -14],
    [-66, -50], [-72, -98], [-64, -108], [-22, -108], [-14, -96], [-4, -56], [10, -18], [24, 0], [60, 4]]), 0.0185, 0.006, 'gaPolyOD',
    { id: 'stock', cav: POLY, holes: [mm([[-60, 46], [-150, 50], [-180, 30], [-150, -4], [-80, 0], [-56, 10]])] });
  b.side('rubber', [[-0.344, 0.07], [-0.36, 0.07], [-0.362, 0.058], [-0.362, -0.058], [-0.354, -0.068], [-0.344, -0.062]], 0.04, 0, { bevel: 0.004 });
  triggerUnit(b, { u0: 0.016, u1: 0.064, vTop: 0.008, depth: 0.026, hw: 0.0185, mat: 'gaSteel', id: 'sehne' });
  // --- Führungsschiene (Aluminium) mit Bolzenrille, Sehnenfang hinten, Schiene oben für das Visier
  b.side('gaAlu', rect(0.04, AX - 0.03, 0.44, AX - 0.006), 0.034, 0, { bevel: 0.002 });
  b.box('cavity', 0.004, 0.003, 0.4, 0, AX - 0.005, 0.24, { c: 0 });
  b.side('gaSteel', rect(-0.02, AX - 0.028, 0.06, AX + 0.012), 0.04, 0, { bevel: 0.003 });
  b.picatinny('gaAlu', 0, AX + 0.012, -0.08, 0.04);
  if (b.hi) b.box('gaSteel', 0.01, 0.006, 0.014, 0.022, AX - 0.004, 0.02, { c: 0.001 });   // Sicherung
  // --- Bogenmittelstück, Bogenarme, Rollen, Sehne und Spannkabel, Spannbügel
  b.side('gaSteel', rect(0.42, AX - 0.06, 0.47, AX + 0.01), 0.06, 0, { bevel: 0.004 });
  const tip = 0.24, tu = 0.36;
  for (const s of [-1, 1]) {
    b.tube('gaPolyDark', [[s * 0.03, AX - 0.02, 0.45], [s * 0.13, AX - 0.016, 0.43], [s * tip, AX - 0.01, tu]], 0.011);
    b.cyl('gaSteel', 0.022, 0.022, 0.012, s * tip, AX - 0.01, tu, { axis: 'v', seg: b.seg(24, 8) });
    if (b.hi) b.torus('cord', 0.022, 0.0016, s * tip, AX - 0.01, tu, { rx: Math.PI / 2, seg: 6, tseg: 24 });
    b.tube('cord', [[s * tip, AX - 0.005, tu - 0.02], [s * 0.05, AX - 0.003, 0.05], [0, AX - 0.003, 0.035]], 0.0016);
    if (b.hi) b.tube('cord', [[s * tip, AX - 0.016, tu + 0.015], [-s * 0.06, AX - 0.02, 0.43], [-s * tip, AX - 0.018, tu + 0.02]], 0.0012);
  }
  b.tube('gaSteel', [[-0.03, AX - 0.06, 0.46], [-0.04, AX - 0.07, 0.53], [0.04, AX - 0.07, 0.53], [0.03, AX - 0.06, 0.46]], 0.005);
  // --- Kompaktvisier (2-fach) auf der Schiene
  acog(b, -0.075, AX + 0.012 + 0.0077);
  // --- Geladener Bolzen (Teil 'rocket': unsichtbar, solange leer)
  b.part('rocket', 0, AX, 0.04);
  boltBody(b, 0.04, 0.4, AX, 'rocket');
  b.anchor('rocketGrab', -0.02, AX, 0.24, { part: 'rocket', data: { w: 0.02, d: 0.03 } });
  b.anchor('magGrab', -0.02, AX, 0.24, { part: 'rocket', data: { w: 0.02, d: 0.03 } });
  b.anchor('magWell', 0, AX, 0.04);
  b.anchor('muzzle', 0, AX, 0.48);
  b.anchor('ejection', 0, AX, -0.2);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.32, gw: 0.0158, gd: 0.024, gu: 0.0, ho: 0.03, tu: 0.04 } });
  b.anchor('leftHandGrip', 0, AX - 0.034, 0.3, { data: { style: 'flat', w: 0.024, h: 0.022 } });
  b.meta = { sight: 'acog', axis: AX, kind: 'launcher' };
}

/** Fliegender Bolzen (Projektil): Spitze nach −Z (vorn), Mitte im Ursprung. */
export function bolzen(b) {
  boltBody(b, -0.2, 0.4, 0, null);
  b.anchor('rightHandGrip', 0, 0, 0);
  b.anchor('muzzle', 0, 0, 0.24);
  b.meta = { sight: 'none', kind: 'gear' };
}

/* ================================================================== SV-9 Flüsterer (Präzisionsgewehr, Integraldämpfer) */

export function fluester(b) {
  const AX = 0.062, RD = 0.0215;
  // --- Gehäuse (Stahl) mit Schiene, Auswurffenster, Spannhebel, Wahlhebel
  b.side('gaSteel', [[-0.085, AX - 0.03], [0.17, AX - 0.03], [0.182, AX - 0.02], [0.182, AX + 0.018], [-0.08, AX + 0.018], [-0.085, AX + 0.006]], 0.034, 0, { bevel: 0.003 });
  b.picatinny('gaAlu', 0, AX + 0.018, -0.08, 0.16);
  boltInPort(b, 0.017, AX + 0.002, 0.05, 0.05, 0.014);
  chargeKnob(b, 'gaSteel', 1, 0.018, AX + 0.008, 0.13, 0.08, 'right', { stem: 0.016, len: 0.026 });
  selectorLever(b, 'gaSteel', 0.017, 0.04, -0.028, { both: false });
  // --- Integralschalldämpfer über die ganze Lauflänge: Klemmmutter, Mantel mit Rändelbändern, Kappe
  b.lathe('gaSteel', [[0, 0], [0, 0.016], [0.006, 0.019], [0.018, 0.019], [0.02, 0.0]], 0, AX, 0.16, { seg: b.seg(32, 8) });
  barrel(b, 'gaBlued', AX, 0.18, [[0, RD * 0.97], [0.003, RD], [0.33, RD], [0.336, RD * 0.95]], { seg: 36 });
  if (b.hi) for (const uc of [0.2, 0.31, 0.49]) b.cyl('knurl', RD * 1.012, RD * 1.012, 0.012, 0, AX, uc, { seg: 36 });
  b.lathe('gaSteel', [[0, RD * 0.95], [0.004, RD * 1.02], [0.014, RD * 1.02], [0.018, RD * 0.86], [0.018, 0.006], [0.0175, 0.005]], 0, AX, 0.514, { seg: b.seg(36, 8) });
  b.bore(0.005, 0, AX, 0.5318);
  b.anchor('muzzle', 0, AX, 0.533);
  // --- Griff, Abzug, Skelettschaft mit Wangenauflage und Kappe
  b.side('gaPoly', rect(-0.06, AX - 0.046, 0.1, AX - 0.03), 0.03, 0, { bevel: 0.003 });
  pistolGrip(b, 'gaGrip', { u: -0.004, top: 0.01, h: 0.098, w: 0.046, rake: 0.3, hw: 0.0145, id: 'grip' });
  triggerUnit(b, { u0: 0.012, u1: 0.058, vTop: 0.012, depth: 0.025, hw: 0.015, mat: 'gaSteel', id: 'fluester' });
  slab(b, mm([[-85, 76], [-200, 82], [-320, 82], [-332, 76], [-332, -52], [-320, -60], [-200, -14], [-85, 14]]), 0.0165, 0.006, 'gaPolyDark',
    { id: 'stock', cav: POLY, holes: [mm([[-120, 60], [-300, 64], [-300, -20], [-220, 4], [-120, 26]])] });
  b.side('gaPolyDark', rect(-0.31, 0.082, -0.14, 0.096), 0.03, 0, { bevel: 0.004 });
  b.side('rubber', [[-0.332, 0.08], [-0.346, 0.08], [-0.348, 0.07], [-0.348, -0.05], [-0.34, -0.06], [-0.332, -0.054]], 0.036, 0, { bevel: 0.004 });
  swivel(b, 'gaSteel', -0.0165, 0.03, -0.3);
  // --- Magazin (10 Schuss, Stahl, Bodenplatte)
  boxMag(b, {
    pivot: [AX - 0.046, 0.08], hw: 0.0125, mat: 'gaMag', step: 0.0016,
    pts: mm([[58, 16], [104, 16], [108, -80], [62, -80]]),
    floor: [0.06, 0.106, -0.08], ribs: 1, ribU: () => 0.083, ribLen: 0.09,
    cal: 'r762k', fit: 0.04, width: 0.02, depth: 0.04, show: 2, path: [[0, 0.014, 0.082], [0, -0.07, 0.085]], grab: [-0.05, 0.084],
  });
  // --- Kampfvisier 3-fach
  acog(b, -0.06, AX + 0.018 + 0.0077);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.3, gw: 0.0145, gd: 0.023, gu: 0.0, ho: 0.03, tu: 0.034 } });
  b.anchor('leftHandGrip', 0, AX - RD, 0.28, { data: { style: 'under', w: RD + 0.002, h: RD } });
  b.meta = { sight: 'acog', axis: AX, kind: 'marksman' };
}

/* ================================================================== Haltung (handling.js, additiv) */

Object.assign(ID_TO_MODEL, { hmg_amboss: 'amboss', sg_sturmflut: 'sturmflut', smg_schwarm: 'schwarm', xb_sehne: 'sehne', mr_fluester: 'fluester' });
// Amboss: wie das HM-60 (Gurtwechsel, Deckel), schwerer und mit härterem Stoß
HANDLING.amboss = { ...HANDLING.hm60, hip: [0.14, -0.17, -0.42], kick: { back: 0.04, up: 0.06, side: 0.016, roll: 0.06, kickRot: 0.03 }, weight: 2.0, flash: 1.6, flashLen: 1.5,
  reloadTime: 7.0, emptyTime: 8.0, equipTime: 1.2, inspectStyle: 'belt', shell: 'big' };
// Sturmflut: Selbstladeflinte im Dauerfeuer, Trommelwechsel wie ein Magazin
HANDLING.sturmflut = { ...HANDLING.hagel, hip: [0.13, -0.14, -0.4], action: 'auto', weight: 1.35, reloadTime: 3.6, emptyTime: 4.3, equipTime: 0.75, inspectStyle: 'magcheck' };
// Schwarm: MP-Haltung, kopflastig durch die Doppeltrommel
HANDLING.schwarm = { ...HANDLING.keiler, hip: [0.125, -0.13, -0.36], weight: 1.05, reloadTime: 3.8, emptyTime: 4.5, equipTime: 0.6, inspectStyle: 'magcheck' };
// Sehne: Einzellader wie der Granatwerfer (Bolzen vorn in die Schiene legen), kein Mündungsfeuer, keine Hülse
HANDLING.sehne = { ...HANDLING.hammer, hip: [0.12, -0.14, -0.38], leftGrip: 'flat', flash: 0, flashLen: 0, shell: 'none', weight: 1.0,
  kick: { back: 0.02, up: 0.03, side: 0.006, roll: 0.02, kickRot: 0.015 }, reloadTime: 2.8, emptyTime: 2.8, equipTime: 0.7, inspectStyle: 'launcher' };
// Flüsterer: Präzisionsgewehr, Dämpfer schluckt das Mündungsfeuer
HANDLING.fluester = { ...HANDLING.sk14, hip: [0.125, -0.15, -0.4], flash: 0.12, flashLen: 0.3, weight: 1.0, reloadTime: 2.2, emptyTime: 2.8, equipTime: 0.6, inspectStyle: 'magcheck' };

void STEEL;
