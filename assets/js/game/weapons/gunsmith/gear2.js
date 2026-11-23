// Welle 2 – Nahkampf & Wurfmittel: Karambit, Machete, Kampfbeil; Aufschlag-, Brand-, Blend- und Rauchgranate;
// Schutzplatte (Westen-Einschub, Requisit der Ego-Ansicht). Ursprung = Griffmitte; Klinge/Kopf nach −Z bzw. oben.
import * as THREE from 'three';
import { ellipsePts } from './parts.js?v=20261123115551';

// Gummierter Griff entlang u (Länge len, Radius r, Ringe)
function handle(b, mat, u0, len, r, rings = 5) {
  const pts = [[u0, 0], [u0, r * 0.9]];
  const n = b.hi ? rings : 1;
  for (let i = 0; i < n; i++) { const a = u0 + (i + 0.15) * len / n, c = u0 + (i + 0.85) * len / n; pts.push([a, r], [c, r], [c + len / n * 0.15, r * 0.92]); }
  pts.push([u0 + len, r * 0.9], [u0 + len, 0]);
  b.lathe(mat, pts.map(([u, rr]) => [u - u0, rr]), 0, 0, u0, { seg: b.seg(14, 6), sx: 0.8 });
}

// Paracord-/Griffband-Wicklung (13.11.): Wendel um die u-Achse von u0 über len (Radius r, Windungen turns)
function wrap(b, mat, u0, len, r, turns, o = {}) {
  if (!b.hi) return;
  const pts = [], n = Math.max(8, Math.round(turns * 10)), sx = o.sx ?? 1;
  for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * Math.PI * 2; pts.push([Math.cos(a) * r * sx, (o.v || 0) + Math.sin(a) * r, u0 + t * len]); }
  b.tube(mat, pts, o.cr ?? 0.0019, { seg: 5, tubSeg: n * 2, part: o.part });
}

export function karambit(b) {
  // Fingerring hinten, kurzer Griff mit Nieten, sichelförmige Klinge, die vorn aus dem Griff wächst und nach unten
  // krallt (Schneide innen/konkav, blank angeschliffen; Rücken mit Daumenrillen). Klinge und Angel sind ein Stück:
  // die Wurzel reicht in den Griff hinein (früher schwebte sie vor dem Griff).
  handle(b, 'rubber', -0.05, 0.1, 0.0135, 4);
  b.torus('steel', 0.017, 0.0042, 0, -0.004, -0.068, { ry: Math.PI / 2, seg: b.seg(10, 4), tseg: b.seg(24, 8) });
  b.cyl('steel', 0.0118, 0.0124, 0.007, 0, 0, -0.051, { seg: b.seg(14, 6), sx: 0.8 }); // hintere Zwinge (Ring ↔ Griff)
  b.cyl('steel', 0.0124, 0.0118, 0.008, 0, 0, 0.049, { seg: b.seg(14, 6), sx: 0.8 }); // vordere Zwinge
  b.side('steel', [[0.046, 0.012], [0.058, 0.012], [0.06, -0.006], [0.056, -0.026], [0.05, -0.03], [0.046, -0.02]], 0.0105, 0, { bevel: 0.0012 }); // Fingerschutz unten
  if (b.hi) for (const s of [-1, 1]) for (const u of [-0.028, 0.0, 0.028]) b.screw('steelBright', s * 0.0109, 0, u, 'x', 0.0022);
  b.part('blade', 0, 0, 0);
  // Bogen um C: außen (Rücken) Radius RO, innen (Schneide) RO − Breite; Wurzel bei 90° (über dem Griffende)
  const C = [0.046, -0.07], RO = 0.08, n = b.hi ? 16 : 6, a0 = Math.PI / 2, a1 = -0.3;
  const outer = [], mid = [], inner = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + (a1 - a0) * t;
    const w = 0.025 * Math.pow(1 - t, 0.85) + 0.0004;
    const e = Math.min(0.0055, w * 0.4);
    const at = (r) => [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r];
    outer.push(at(RO)); mid.push(at(RO - w + e)); inner.push(at(RO - w));
  }
  // Angel: Wurzel ein Stück in den Griff hinein verlängert
  const root = [[0.03, C[1] + RO - 0.001], [0.03, C[1] + RO - 0.023]];
  b.side('bladeCoat', [root[1], root[0], ...outer, ...mid.slice().reverse()], 0.0052, 0, { part: 'blade', bevel: 0.0013 });
  b.side('blade', [...mid, ...inner.slice().reverse()], 0.003, 0, { part: 'blade', bevel: 0.0006 });
  if (b.hi) {
    // Daumenrillen auf dem Rücken (am Bogenanfang) und Loch am Rücken
    for (let i = 0; i < 6; i++) {
      const a = a0 - 0.12 - i * 0.07;
      b.box('cavity', 0.0054, 0.0016, 0.0011, 0, C[1] + Math.sin(a) * (RO + 0.0002), C[0] + Math.cos(a) * (RO + 0.0002), { part: 'blade', rx: -(a - Math.PI / 2), c: 0 });
    }
    b.cyl('cavity', 0.0034, 0.0034, 0.0056, 0, C[1] + RO - 0.012, C[0] + 0.016, { axis: 'x', seg: 12, part: 'blade' });
  }
  if (b.hi) {
    // G10-Griffschalen mit Rautenmuster (Kerben), Fangriemen am Ring
    for (const sg of [-1, 1]) for (let i = 0; i < 5; i++) b.box('cavity', 0.0006, 0.018, 0.0012, sg * 0.0112, 0, -0.035 + i * 0.016, { rx: 0.6 * (i % 2 ? 1 : -1), c: 0 });
    b.tube('cord', [[0, -0.02, -0.07], [0, -0.035, -0.078], [0, -0.055, -0.072]], 0.0017, { seg: 6 });
  }
  const tip = outer[n];
  b.anchor('muzzle', 0, tip[1], tip[0]);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0 } });
  b.meta = { sight: 'none', kind: 'melee' };
}

export function machete(b) {
  // Langer Griff mit Fangriemen-Öse, gerade Klinge mit abgeschrägter Spitze, Rückenzahnung
  handle(b, 'grip', -0.06, 0.12, 0.0145, 6);
  b.box('steel', 0.014, 0.05, 0.007, 0, -0.004, 0.064, { c: 0.0015 });
  b.torus('steel', 0.006, 0.0015, 0, -0.012, -0.068, { ry: Math.PI / 2, tseg: 12 });
  b.part('blade', 0, 0, 0);
  const blade = [[0.066, 0.014], [0.36, 0.016], [0.405, 0.03], [0.43, 0.012], [0.4, -0.022], [0.3, -0.026], [0.066, -0.022]];
  b.side('bladeCoat', blade, 0.0045, 0, { part: 'blade', bevel: 0.0012 });
  b.side('blade', [[0.07, -0.014], [0.3, -0.018], [0.4, -0.015], [0.428, 0.011], [0.4, -0.022], [0.3, -0.026], [0.07, -0.022]], 0.003, 0, { part: 'blade', bevel: 0.0008 });
  if (b.hi) {
    for (let i = 0; i < 9; i++) b.box('bladeCoat', 0.0046, 0.004, 0.006, 0, 0.0165, 0.1 + i * 0.012, { part: 'blade', rx: 0.6, c: 0 });
    // Griffnieten, Hohlkehle, Fingerhaken am Griffende
    for (const s of [-1, 1]) for (const u of [-0.035, 0.0, 0.035]) b.screw('steelBright', s * 0.0118, 0, u, 'x', 0.0028);
    for (const s of [-1, 1]) b.box('cavity', 0.0008, 0.004, 0.2, s * 0.0024, 0.004, 0.2, { part: 'blade', c: 0 });
    b.side('grip', [[-0.062, -0.012], [-0.05, -0.012], [-0.05, -0.024], [-0.058, -0.026], [-0.066, -0.02]], 0.0185, 0, { bevel: 0.002 });
  }
  if (b.hi) {
    // Fangriemen durch die Öse, Schleifspuren an der Schneide, Ricasso
    b.tube('cord', [[0, -0.012, -0.068], [0, -0.03, -0.08], [0, -0.055, -0.078], [0, -0.07, -0.066]], 0.0018, { seg: 6 });
    for (let i = 0; i < 6; i++) b.box('steelBright', 0.0032, 0.0004, 0.03, 0, -0.018 + (i % 2) * 0.001, 0.12 + i * 0.045, { part: 'blade', c: 0 });
    for (const sg of [-1, 1]) b.box('steelDark', 0.0004, 0.012, 0.016, sg * 0.0024, -0.004, 0.078, { part: 'blade', c: 0 });
  }
  b.anchor('muzzle', 0, 0, 0.42);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0 } });
  b.meta = { sight: 'none', kind: 'melee' };
}

export function tomahawk(b) {
  // Schaft (Kompositgriff) entlang u, Kopf oben am vorderen Ende: Schneide nach oben, Dorn nach unten
  handle(b, 'grip', -0.07, 0.15, 0.0145, 6);
  b.box('polymer', 0.022, 0.026, 0.2, 0, 0.0, 0.18, { c: 0.004 });
  b.part('blade', 0, 0, 0.29);
  b.side('bladeCoat', [[0.27, 0.014], [0.31, 0.014], [0.33, 0.04], [0.36, 0.085], [0.335, 0.095], [0.29, 0.1], [0.26, 0.092], [0.28, 0.04]], 0.008, 0, { part: 'blade', bevel: 0.0018 });
  b.side('blade', [[0.338, 0.09], [0.365, 0.086], [0.35, 0.098], [0.29, 0.104], [0.258, 0.096], [0.262, 0.09], [0.292, 0.096]], 0.004, 0, { part: 'blade', bevel: 0.0008 });
  b.side('bladeCoat', [[0.272, -0.014], [0.312, -0.014], [0.298, -0.05], [0.29, -0.07], [0.286, -0.05]], 0.009, 0, { part: 'blade', bevel: 0.0016 });
  b.box('steel', 0.026, 0.03, 0.05, 0, 0.0, 0.29, { part: 'blade', c: 0.003 });
  if (b.hi) for (const s of [-1, 1]) b.screw('steel', s * 0.0132, 0.0, 0.29, 'x', 0.0035, { part: 'blade' });
  // Paracord-Wicklung über dem Griff, Fangriemen, Aussparungen im Kopf, Schneidfase, Dornspitze geschärft
  wrap(b, 'cord', -0.068, 0.15, 0.0158, 34, { sx: 0.82 });
  if (b.hi) {
    b.tube('cord', [[0, -0.012, -0.075], [0, -0.03, -0.088], [0, -0.05, -0.084]], 0.0019, { seg: 6 });
    for (const [u, v] of [[0.3, 0.04], [0.31, 0.065], [0.285, 0.068]]) b.cyl('cavity', 0.0055, 0.0055, 0.0084, 0, v, u, { axis: 'x', seg: 14, part: 'blade' });
    b.box('steelBright', 0.0005, 0.004, 0.06, 0.0041, 0.093, 0.31, { part: 'blade', rx: 0.25, c: 0 });
    b.box('steelBright', 0.0005, 0.03, 0.004, 0.0046, -0.05, 0.293, { part: 'blade', rx: 0.0, c: 0 });
  }
  b.anchor('muzzle', 0, 0.09, 0.32);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0 } });
  b.meta = { sight: 'none', kind: 'melee' };
}

export function kampfaxt(b) {
  // Hickory-Stiel mit Gummigriff, geschmiedeter Kopf mit breitem Bart (Schneide oben/vorn), Hammerrücken unten
  handle(b, 'grip', -0.07, 0.13, 0.015, 6);
  b.box('woodWarm', 0.024, 0.03, 0.24, 0, 0.0, 0.18, { c: 0.006 });
  b.part('blade', 0, 0, 0.3);
  b.side('bladeCoat', [[0.27, 0.016], [0.32, 0.016], [0.35, 0.05], [0.4, 0.11], [0.37, 0.125], [0.3, 0.13], [0.255, 0.115], [0.28, 0.05]], 0.009, 0, { part: 'blade', bevel: 0.002 });
  b.side('blade', [[0.375, 0.118], [0.405, 0.11], [0.385, 0.128], [0.3, 0.136], [0.252, 0.12], [0.258, 0.114], [0.3, 0.13]], 0.004, 0, { part: 'blade', bevel: 0.0008 });
  b.box('bladeCoat', 0.03, 0.034, 0.055, 0, 0.0, 0.3, { part: 'blade', c: 0.004 });
  b.box('steel', 0.026, 0.03, 0.03, 0, -0.03, 0.3, { part: 'blade', c: 0.004 }); // Hammerrücken
  if (b.hi) for (const s of [-1, 1]) b.screw('steel', s * 0.0152, 0.0, 0.3, 'x', 0.0035, { part: 'blade' });
  if (b.hi) {
    // Keil im Auge (oben sichtbar), Stahlkragen gegen Überschlag, Holzmaserung als Brandlinien, Schneidfase
    b.box('steelBright', 0.008, 0.004, 0.03, 0, 0.0185, 0.3, { part: 'blade', c: 0.0005 });
    b.box('steelDark', 0.028, 0.034, 0.04, 0, 0.0, 0.255, { c: 0.003 });
    for (let i = 0; i < 6; i++) b.box('woodWalnut', 0.0005, 0.0012, 0.18, 0.0122, -0.012 + i * 0.005, 0.15, { c: 0 });
    b.box('steelBright', 0.0006, 0.006, 0.08, 0.0046, 0.124, 0.33, { part: 'blade', rx: 0.35, c: 0 });
  }
  b.anchor('muzzle', 0, 0.12, 0.33);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0 } });
  b.meta = { sight: 'none', kind: 'melee' };
}

export function schlagstock(b) {
  // Teleskop-Schlagstock (ausgefahren): Schaumgriff, drei Stahlsegmente, Kugelspitze
  handle(b, 'rubber', -0.07, 0.17, 0.0135, 8);
  b.cyl('steelDark', 0.0105, 0.0105, 0.15, 0, 0, 0.175, { seg: b.seg(14, 6) });
  b.cyl('steelDark', 0.0085, 0.0085, 0.14, 0, 0, 0.32, { seg: b.seg(14, 6) });
  b.cyl('steelBright', 0.0068, 0.0068, 0.13, 0, 0, 0.455, { seg: b.seg(12, 6) });
  b.sphere('steelBright', 0.011, 0, 0, 0.525);
  if (b.hi) for (const u of [0.25, 0.39]) b.cyl('steel', 0.0112, 0.0112, 0.006, 0, 0, u, { seg: 14 });
  if (b.hi) {
    // Endkappe mit Glasbrecher-Spitze, Gürtelclip, Sicherungsringe der Segmente
    b.cyl('steelDark', 0.0148, 0.0142, 0.016, 0, 0, -0.078, { seg: 16 });
    b.cyl('steelBright', 0.003, 0.0001, 0.008, 0, 0, -0.09, { seg: 8 });
    b.box('steelDark', 0.003, 0.008, 0.07, 0.0148, 0.0, -0.035, { c: 0.001 });
    for (const u of [0.1, 0.245, 0.385]) b.torus('steelBright', 0.0108, 0.0008, 0, 0, u, { seg: 5, tseg: 18 });
  }
  b.anchor('muzzle', 0, 0, 0.53);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0 } });
  b.meta = { sight: 'none', kind: 'melee' };
}

export function spaten(b) {
  // Klappspaten: Holzstiel mit Griffband, Stahlblatt (spitz zulaufend, geschärfte Kanten) nach vorn
  b.cyl('woodWarm', 0.0145, 0.0145, 0.42, 0, 0, 0.1, { seg: b.seg(12, 6) });
  b.cyl('rubber', 0.0158, 0.0158, 0.12, 0, 0, -0.06, { seg: b.seg(12, 6) });
  b.box('steel', 0.034, 0.03, 0.05, 0, 0, 0.33, { c: 0.004 }); // Klappgelenk
  b.part('blade', 0, 0, 0.34);
  b.side('steel', [[0.355, 0.0], [0.37, 0.075], [0.5, 0.08], [0.56, 0.0], [0.5, -0.08], [0.37, -0.075]], 0.004, 0, { part: 'blade', bevel: 0.0012 });
  if (b.hi) b.side('blade', [[0.5, 0.078], [0.56, 0.0], [0.5, -0.078], [0.498, -0.07], [0.552, 0.0], [0.498, 0.07]], 0.0042, 0, { part: 'blade', bevel: 0.0005 });
  if (b.hi) {
    // Sägezahnung an einer Kante, Sicherungsmutter mit Rändel, Stielkappe, Prägung im Blatt
    for (let i = 0; i < 7; i++) b.side('steel', [[0.372 + i * 0.017, 0.077], [0.38 + i * 0.017, 0.088], [0.389 + i * 0.017, 0.078]], 0.0034, 0, { part: 'blade', bevel: 0 });
    b.cyl('knurl', 0.022, 0.022, 0.016, 0, 0, 0.3, { seg: 18 });
    b.sphere('steelDark', 0.017, 0, 0, -0.12, { sy: 0.7, seg: 14, hseg: 8 });
  }
  b.anchor('muzzle', 0, 0, 0.56);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0 } });
  b.meta = { sight: 'none', kind: 'melee' };
}

export function kampfstock(b) {
  // Rattan-Kampfstock (Escrima): gebrannte Musterung, Griffband, abgerundete Enden
  b.cyl('woodWarm', 0.0135, 0.0135, 0.66, 0, 0, 0.23, { seg: b.seg(12, 6) });
  b.sphere('woodWarm', 0.0135, 0, 0, -0.1);
  b.sphere('woodWarm', 0.0135, 0, 0, 0.56);
  b.cyl('rubber', 0.0148, 0.0148, 0.16, 0, 0, -0.005, { seg: b.seg(12, 6) });
  if (b.hi) for (let i = 0; i < 9; i++) b.cyl('woodWalnut', 0.0139, 0.0139, 0.012, 0, 0, 0.12 + i * 0.048, { seg: 12 });
  wrap(b, 'canvasOD', -0.082, 0.155, 0.015, 34, { cr: 0.0022 });
  b.anchor('muzzle', 0, 0, 0.56);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0 } });
  b.meta = { sight: 'none', kind: 'melee' };
}

// Zylindrischer Granatkörper mit Zünderkopf, Löffel und Splint (gemeinsam für Blend/Rauch/Aufschlag)
function canister(b, body, band, r, h, o = {}) {
  const s = b.seg(24, 8);
  b.cyl(body, r, r, h, 0, 0, 0, { axis: 'v', seg: s });
  if (band) b.cyl(band, r + 0.0004, r + 0.0004, 0.01, 0, h * 0.18, 0, { axis: 'v', seg: s });
  if (b.hi) {
    // gebördelte Deckel oben und unten, Bodenprägung
    for (const sv of [-1, 1]) b.torus(o.rim || 'steel', r - 0.0004, 0.0013, 0, sv * (h / 2 - 0.0006), 0, { rx: Math.PI / 2, seg: 6, tseg: 28 });
    b.circle('steelDark', r * 0.55, 0, -h / 2 - 0.0002, 0, { rx: Math.PI / 2, seg: 20 });
  }
  b.cyl('steel', 0.0095, 0.011, 0.012, 0, h / 2 + 0.006, 0, { axis: 'v', seg: b.seg(14, 6) });
  if (b.hi) b.cyl('steelDark', 0.0068, 0.0068, 0.005, 0, h / 2 + 0.0145, 0, { axis: 'v', seg: 12 });
  b.part('spoon', 0.01, h / 2 + 0.01, 0);
  b.box('steel', 0.012, 0.004, 0.014, 0.008, h / 2 + 0.013, 0, { part: 'spoon', c: 0.001 });
  b.box('steel', 0.004, h * 0.8, 0.013, r + 0.002, 0.0, 0, { part: 'spoon', c: 0.001 });
  if (b.hi) b.box('steel', 0.006, 0.0025, 0.01, r + 0.0005, -h * 0.4 - 0.001, 0, { part: 'spoon', rz: 0.6, c: 0.0005 });
  b.part('pin', -0.012, h / 2 + 0.008, 0);
  b.torus('steelBright', 0.0105, 0.0014, -0.026, h / 2 + 0.008, 0, { part: 'pin', ry: Math.PI / 2, seg: b.seg(6, 3), tseg: b.seg(18, 8) });
  b.cyl('steelBright', 0.0011, 0.0011, 0.026, -0.008, h / 2 + 0.008, 0, { part: 'pin', axis: 'x', seg: 6 });
  b.anchor('pinGrab', -0.034, h / 2 + 0.008, 0, { part: 'pin' });
  b.anchor('rightHandGrip', 0, 0, 0);
  b.meta = { sight: 'none', kind: 'grenade' };
}

/** Blendgranate (13.11., nach dem Vorbild M84): Stahlrohr mit großen Langlöchern in vier Reihen, Deckel, Zünder oben. */
export function flash(b) {
  const r = 0.0225, h = 0.11;
  canister(b, 'steelDark', null, r, h, { rim: 'steelDark' });
  if (b.hi) {
    for (let row = 0; row < 4; row++) for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + (row % 2) * Math.PI / 6, v = -0.034 + row * 0.022;
      b.box('cavity', 0.0012, 0.014, 0.008, Math.cos(a) * (r + 0.0002), v, Math.sin(a) * (r + 0.0002), { ry: -a, c: 0 });
    }
    b.cyl('paintWhite', r + 0.0003, r + 0.0003, 0.004, 0, 0.049, 0, { axis: 'v', seg: 24 });     // Kennring
    for (let i = 0; i < 3; i++) b.box('paintWhite', 0.0004, 0.002, 0.016, r + 0.0003, 0.042 - i * 0.003, 0.0, { ry: Math.PI / 2, c: 0 }); // Aufdruck
  }
}

/** Rauchgranate (13.11., nach dem Vorbild M18): Blechdose 64 × 115 mm, olivgrün, farbiger Deckel (Rauchfarbe),
 * vier Austrittslöcher oben (abgeklebt), Beschriftung, Zünder. */
export function smoke(b) {
  const r = 0.031, h = 0.115;
  canister(b, 'paintOlive', 'paintWhite', r, h);
  b.cyl('paintWhite', r + 0.0003, r + 0.0003, 0.012, 0, h / 2 - 0.007, 0, { axis: 'v', seg: b.seg(24, 8) });   // Farbdeckel
  if (b.hi) {
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; b.circle('cavity', 0.0042, Math.cos(a) * 0.019, h / 2 + 0.0004, Math.sin(a) * 0.019, { rx: -Math.PI / 2, seg: 10 }); }
    b.circle('putty', 0.024, 0, h / 2 + 0.0002, 0, { rx: -Math.PI / 2, seg: 24 });               // Klebeband über den Löchern
    for (let i = 0; i < 4; i++) b.box('paintWhite', 0.0004, 0.0022, 0.03 - i * 0.006, r + 0.0004, 0.01 - i * 0.006, 0.0, { ry: Math.PI / 2, c: 0 });
  }
}

/** Aufschlaggranate: eiförmiger Körper mit Kennring, Aufschlagzünder mit Signalkappe. */
export function impact(b) {
  b.sphere('paintOlive', 0.03, 0, 0, 0, { sy: 1.15, seg: b.seg(20, 7), hseg: b.seg(14, 5) });
  b.cyl('paintYellow', 0.031, 0.031, 0.008, 0, 0.0, 0, { axis: 'v', seg: b.seg(20, 7) });
  b.cyl('steel', 0.012, 0.016, 0.014, 0, 0.038, 0, { axis: 'v', seg: b.seg(14, 6) });
  b.sphere('paintSignal', 0.01, 0, 0.048, 0, { seg: b.seg(12, 5), hseg: b.seg(8, 4) });
  if (b.hi) {
    for (let i = 0; i < 6; i++) b.box('steelDark', 0.003, 0.004, 0.002, Math.cos(i * Math.PI / 3) * 0.0155, 0.04, Math.sin(i * Math.PI / 3) * 0.0155, { ry: -i * Math.PI / 3, c: 0 });
    b.torus('paintOlive', 0.0258, 0.0008, 0, -0.018, 0, { rx: Math.PI / 2, seg: 6, tseg: 30 });
  }
  b.part('pin', -0.012, 0.038, 0);
  b.torus('steelBright', 0.0105, 0.0014, -0.026, 0.038, 0, { part: 'pin', ry: Math.PI / 2, seg: b.seg(6, 3), tseg: b.seg(18, 8) });
  b.anchor('pinGrab', -0.034, 0.038, 0, { part: 'pin' });
  b.anchor('rightHandGrip', 0, 0, 0);
  b.meta = { sight: 'none', kind: 'grenade' };
}

/** Brandsatz (13.11.): braungrüne Glasflasche (Boden mit Einstich, Schulter, Hals mit Lippe), Benzingemisch zu drei
 * Vierteln gefüllt, Stofflappen im Hals (Teil 'pin': ausgefranst, angesengte Spitze), Etikettrest, Klebeband. */
export function molotov(b) {
  const s = b.seg(22, 8);
  b.lathe('bottleGlass', [[-0.055, 0], [-0.055, 0.027], [-0.053, 0.0305], [-0.048, 0.031], [0.018, 0.031], [0.03, 0.026], [0.042, 0.017],
    [0.052, 0.0125], [0.07, 0.0112], [0.072, 0.0128], [0.077, 0.0128], [0.078, 0.0105]], 0, 0, 0, { axis: 'v', seg: s });
  b.lathe('fuel', [[-0.052, 0], [-0.052, 0.0288], [0.008, 0.0288], [0.008, 0]], 0, 0, 0, { axis: 'v', seg: b.seg(18, 6) });
  if (b.hi) {
    b.circle('fuel', 0.0285, 0, 0.0082, 0, { rx: -Math.PI / 2, seg: 20 });                    // Flüssigkeitsspiegel
    b.lathe('bottleGlass', [[-0.055, 0.0], [-0.047, 0.006], [-0.05, 0.014], [-0.055, 0.02]], 0, 0, 0, { axis: 'v', seg: 18 }); // Bodeneinstich
    b.cyl('paintWhite', 0.0313, 0.0313, 0.03, 0, -0.018, 0, { axis: 'v', seg: 22, t0: 0.4, tl: 2.2 });  // Etikettrest
    b.cyl('canvasOD', 0.0316, 0.0316, 0.012, 0, 0.002, 0, { axis: 'v', seg: 22, t0: 3.4, tl: 2.4 });   // Klebeband
  }
  // Lappen: steckt im Hals, hängt außen herab
  b.cyl('rag', 0.0098, 0.009, 0.03, 0, 0.078, 0, { axis: 'v', seg: b.seg(10, 5) });
  b.part('pin', 0.004, 0.09, 0);
  b.tube('rag', [[0.004, 0.092, 0.0], [0.011, 0.096, 0.001], [0.0165, 0.088, 0.002], [0.0185, 0.075, 0.003], [0.02, 0.06, 0.003]], 0.005, { part: 'pin', seg: 6 });
  if (b.hi) {
    b.sphere('ragSoot', 0.006, 0.02, 0.058, 0.003, { part: 'pin', sy: 1.3, seg: 10, hseg: 6 });
    for (let i = 0; i < 4; i++) b.box('rag', 0.0012, 0.012, 0.002, 0.018 + i * 0.002, 0.05 - (i % 2) * 0.003, 0.003 - i * 0.002, { part: 'pin', rz: 0.2 * (i - 1.5), c: 0 });
  }
  b.anchor('pinGrab', 0.022, 0.1, 0, { part: 'pin' });
  b.anchor('rightHandGrip', 0, 0, 0);
  b.meta = { sight: 'none', kind: 'grenade' };
}

export function trophy(b) {
  // Trophäensystem (13.11.), zusammengeklappt (Hand/Wurf): Gehäuse-Puck mit Gummifuß, gelbem Kennring, Sensorkuppel,
  // drei angelegten Stativbeinen, Kühlschlitzen, Status-LED und Sicherungssplint. Aufgestellt: weapons/trophy.js.
  const s = b.seg(22, 8);
  b.cyl('polymerOD', 0.042, 0.045, 0.05, 0, 0, 0, { axis: 'v', seg: s });
  b.cyl('rubber', 0.046, 0.046, 0.008, 0, -0.028, 0, { axis: 'v', seg: s });
  b.cyl('paintYellow', 0.0429, 0.0434, 0.005, 0, 0.012, 0, { axis: 'v', seg: s });
  b.cyl('steelDark', 0.03, 0.035, 0.012, 0, 0.031, 0, { axis: 'v', seg: s });
  b.sphere('lens', 0.022, 0, 0.037, 0, { sy: 0.7, seg: b.seg(18, 7), hseg: b.seg(10, 4) });
  if (b.hi) b.torus('steel', 0.0225, 0.0016, 0, 0.037, 0, { rx: Math.PI / 2, seg: 8, tseg: 24 });
  for (let i = 0; i < 3; i++) {
    const a = i * 2 * Math.PI / 3 + 0.5;
    b.box('aluOD', 0.008, 0.054, 0.006, Math.cos(a) * 0.0465, -0.002, Math.sin(a) * 0.0465, { ry: a, c: 0.0012 });
    b.sphere('rubber', 0.005, Math.cos(a) * 0.0468, -0.03, Math.sin(a) * 0.0468, { seg: 8, hseg: 6 });
  }
  if (b.hi) for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6;
    for (const dv of [-0.006, -0.016]) b.box('cavity', 0.0016, 0.004, 0.014, Math.cos(a) * 0.0437, dv, Math.sin(a) * 0.0437, { ry: a, c: 0 });
  }
  b.part('led', 0, 0.02, 0);
  b.sphere('glowGreen', 0.0032, 0.0, 0.02, 0.044, { part: 'led', seg: 8, hseg: 6 });
  b.part('pin', -0.045, 0.031, 0);
  b.torus('steelBright', 0.0105, 0.0014, -0.058, 0.031, 0, { part: 'pin', ry: Math.PI / 2, seg: b.seg(6, 3), tseg: b.seg(18, 8) });
  b.cyl('steelBright', 0.0011, 0.0011, 0.024, -0.046, 0.031, 0, { part: 'pin', axis: 'x', seg: 6 });
  b.anchor('pinGrab', -0.066, 0.031, 0, { part: 'pin' });
  b.anchor('rightHandGrip', 0, 0, 0);
  b.meta = { sight: 'none', kind: 'grenade' };
}

/**
 * Trophäensystem aufgestellt (13.11.): Dreibein (Ursprung = Boden), Gelenkring, Gehäuse mit Kennring und Kühlschlitzen,
 * drehender Sensorkopf (Teil 'trophyHead': vier Sensorfenster, Kuppel, Abfangrohr nach vorn, Anker 'muzzle'), Antenne,
 * Status-LED (Teil 'led'). Drehen/Blinken: weapons/trophy.js.
 */
export function trophyDeployed(b) {
  const s = b.seg(24, 8), H = 0.2;
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion();
  for (let i = 0; i < 3; i++) {
    const a = i * 2 * Math.PI / 3 + Math.PI / 6;
    const fx = Math.cos(a) * 0.19, fu = Math.sin(a) * 0.19, hx = Math.cos(a) * 0.03, hu = Math.sin(a) * 0.03;
    dir.set(fx - hx, 0.012 - H, -(fu - hu));
    const len = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    const pre = new THREE.Matrix4().makeRotationFromQuaternion(q);
    b.cyl('aluOD', 0.0058, 0.0068, len, (fx + hx) / 2, (0.012 + H) / 2, (fu + hu) / 2, { axis: 'v', pre, seg: b.seg(10, 6) });
    // Strebe vom Bein zur Mittelsäule, Gelenk, Gummifuß
    const mx = hx + (fx - hx) * 0.45, mv = H + (0.012 - H) * 0.45, mu = hu + (fu - hu) * 0.45;
    dir.set(-mx, H - 0.075 - mv, mu);
    const sl = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    b.cyl('steelDark', 0.0028, 0.0028, sl, mx / 2, (mv + H - 0.075) / 2, mu / 2, { axis: 'v', pre: new THREE.Matrix4().makeRotationFromQuaternion(q), seg: b.seg(8, 5) });
    b.sphere('steelDark', 0.0095, hx, H - 0.004, hu, { seg: b.seg(10, 6), hseg: b.seg(8, 4) });
    b.cyl('rubber', 0.015, 0.016, 0.009, fx, 0.0045, fu, { axis: 'v', seg: b.seg(12, 6) });
  }
  b.cyl('steelDark', 0.008, 0.008, 0.08, 0, H - 0.04, 0, { axis: 'v', seg: b.seg(10, 6) });
  b.cyl('steelDark', 0.037, 0.037, 0.02, 0, H, 0, { axis: 'v', seg: s });
  b.cyl('rubber', 0.046, 0.046, 0.008, 0, H + 0.014, 0, { axis: 'v', seg: s });
  b.cyl('polymerOD', 0.042, 0.045, 0.05, 0, H + 0.043, 0, { axis: 'v', seg: s });
  b.cyl('paintYellow', 0.0429, 0.0434, 0.005, 0, H + 0.055, 0, { axis: 'v', seg: s });
  if (b.hi) for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6;
    for (const dv of [0.026, 0.036]) b.box('cavity', 0.0016, 0.004, 0.014, Math.cos(a) * 0.0437, H + dv, Math.sin(a) * 0.0437, { ry: a, c: 0 });
  }
  // Antenne (am Gehäuse, dreht nicht mit)
  b.cyl('steelDark', 0.0016, 0.0022, 0.13, -0.034, H + 0.12, -0.014, { axis: 'v', seg: 6 });
  b.sphere('rubber', 0.0042, -0.034, H + 0.186, -0.014, { seg: 8, hseg: 6 });
  // Status-LED
  b.part('led', 0, H + 0.04, 0);
  b.sphere('glowGreen', 0.0036, 0, H + 0.04, 0.0448, { part: 'led', seg: 8, hseg: 6 });
  // Sensorkopf
  const hv = H + 0.075;
  b.part('trophyHead', 0, hv, 0);
  b.cyl('steelDark', 0.031, 0.035, 0.016, 0, hv, 0, { part: 'trophyHead', axis: 'v', seg: s });
  b.sphere('lens', 0.023, 0, hv + 0.008, 0, { part: 'trophyHead', sy: 0.72, seg: b.seg(20, 8), hseg: b.seg(12, 5) });
  if (b.hi) b.torus('steel', 0.0235, 0.0017, 0, hv + 0.008, 0, { part: 'trophyHead', rx: Math.PI / 2, seg: 8, tseg: 28 });
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    b.box('polymer', 0.007, 0.013, 0.018, Math.cos(a) * 0.034, hv, Math.sin(a) * 0.034, { part: 'trophyHead', ry: a, c: 0.0012 });
    b.box('lens', 0.002, 0.008, 0.012, Math.cos(a) * 0.0378, hv, Math.sin(a) * 0.0378, { part: 'trophyHead', ry: a, c: 0 });
  }
  // Abfangrohr (zeigt nach vorn, u) mit Halter
  b.box('steelDark', 0.016, 0.012, 0.03, 0, hv + 0.02, 0.01, { part: 'trophyHead', c: 0.002 });
  b.cyl('steel', 0.0085, 0.0095, 0.062, 0, hv + 0.03, 0.024, { part: 'trophyHead', seg: b.seg(14, 6) });
  b.cyl('cavity', 0.006, 0.006, 0.002, 0, hv + 0.03, 0.0555, { part: 'trophyHead', seg: b.seg(12, 6) });
  b.anchor('muzzle', 0, hv + 0.03, 0.057, { part: 'trophyHead' });
  b.anchor('rightHandGrip', 0, 0, 0);
  b.meta = { sight: 'none', kind: 'gear' };
}

export function plate(b) {
  // Keramikplatte in Stoffhülle (leicht gewölbt), Griffband oben
  const w = 0.25, h = 0.3, t = 0.022;
  b.box('canvasOD', w, h, t, 0, 0, 0, { r: 0.012, rs: 2 });
  b.box('polymer', w * 0.6, 0.026, t + 0.003, 0, h / 2 - 0.03, 0, { c: 0.003 });
  if (b.hi) {
    b.box('paintWhite', 0.07, 0.03, 0.0008, -0.05, -0.06, -(t / 2 + 0.0004), { c: 0 });
    for (const s of [-1, 1]) b.box('polymer', 0.004, h * 0.8, t + 0.002, s * (w / 2 - 0.02), 0, 0, { c: 0.001 });
  }
  b.anchor('rightHandGrip', 0, 0, 0);
  b.meta = { sight: 'none', kind: 'gear' };
}

export { ellipsePts };
