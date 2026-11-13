// RG-6 Orkan (13.11., Nutzerwunsch „Minigun“): tragbare Gatling mit sechs Läufen. Überarbeitet nach Vorbild (M134-Bauart,
// 13.11. – „anhand der echten Versionen so detailliert wie möglich“): Läufe 559 mm, Gehäuse Ø ≈ 105 mm mit Endkappe und
// Schraubenkranz, Antriebsmotor rechts mit Kühlrippen und Getriebeblock, Gurtzuführer (Entgliederer) links mit Zahnrad und
// Zuführschacht, flexible Gurtrutsche (Gliederkette) vom Kasten zum Zuführer, Mittel- und Mündungsschelle mit Lappen um
// jeden Lauf (Blütenform), Laufhalter-Rotor hinten. Tragbare Ausführung: Pistolengriff mit Bügel, Tragegriff oben,
// senkrechter Vordergriff, kurze Schulterstütze. Ohne Zeichen/Schilder mit echten Namen.
// Teile wie beim HM-60: Gurtkasten 'mag' mit Deckel 'lid', Gurt 'belt', Zuführdeckel 'cover', Ladehebel 'charge';
// Laufbündel 'rotor' (Drehpunkt auf der Bündelachse) – das Viewmodel dreht es mit der Hochdrehzahl (controller.js spin).
import { mm, slab, rrect, pocket, POLY, STEEL } from './gbkit.js?v=20261113221339';
import { magRounds } from './magfill.js?v=20261113221339';

const AXIS = 0.072;          // Achse des Laufbündels
const R = 0.024;             // Teilkreis der sechs Läufe
const U0 = 0.16, U1 = 0.74;  // Läufe von … bis (Mündung)
const HR = 0.052;            // Gehäuseradius

export function orkan(b) {
  // ---- Gehäuse: Rundkörper mit gewölbter Endkappe, Schraubenkränzen, Führungsbahn-Deckel oben (Teil 'cover')
  b.lathe('gbAlu', [[0, 0], [0, 0.03], [0.006, 0.042], [0.016, 0.049], [0.024, HR], [0.27, HR], [0.278, HR - 0.004], [0.29, HR - 0.004], [0.29, 0]], 0, AXIS, -0.13, { seg: b.seg(40, 10) });
  if (b.hi) {
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + 0.13; b.cyl('gbSteel', 0.0032, 0.0032, 0.004, Math.cos(a) * (HR - 0.009), AXIS + Math.sin(a) * (HR - 0.009), -0.131, { seg: 10 }); }
    for (let i = 0; i < 4; i++) b.torus('gbAlu', HR + 0.0004, 0.0022, 0, AXIS, -0.08 + i * 0.06, { seg: 6, tseg: 40 });
    // Längsnaht + Seitenschrauben, Warnfeld (gelb, ohne Text)
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) b.cyl('gbSteel', 0.0024, 0.0024, 0.0016, s * HR, AXIS - 0.012, -0.09 + i * 0.07, { axis: 'x', seg: 10 });
    b.box('paintYellow', 0.0006, 0.012, 0.04, HR - 0.0004, AXIS + 0.02, 0.05, { c: 0, ry: 0, rz: -0.38 });
  }
  // Untergestell (Abzugsgehäuse) unter dem Rundkörper
  slab(b, mm([[-120, 40], [150, 40], [150, 12], [120, 6], [-60, 6], [-120, 20]]), 0.032, 0.004, 'gbSteel', { id: 'base', cav: STEEL, cut: (x, v, u, d) => pocket(d, x, rrect(u, v, 0.02, 0.024, 0.07, 0.008, 0.003), 0.029) });
  b.part('cover', 0, AXIS + 0.05, 0.14);
  slab(b, mm([[-80, AXIS * 1000 + 44], [140, AXIS * 1000 + 44], [140, AXIS * 1000 + 56], [122, AXIS * 1000 + 64], [-62, AXIS * 1000 + 64], [-80, AXIS * 1000 + 56]]), 0.024, 0.003, 'gbAlu', { part: 'cover', cav: STEEL, cut: (x, v, u, d) => {
    for (let i = 0; i < 4; i++) d = Math.max(d, -(Math.hypot(u + 0.04 - i * 0.045, v - (AXIS + 0.064)) - 0.0016));
    return d;
  } });

  // ---- Antriebsmotor rechts (Rippenzylinder, Endkappe, Kabelstutzen) mit Getriebeblock zum Rotor
  slab(b, mm([[60, AXIS * 1000 + 20], [150, AXIS * 1000 + 20], [150, AXIS * 1000 - 30], [60, AXIS * 1000 - 30]]), 0.016, 0.004, 'gbAlu', { x: 0.052, id: 'gear', cav: STEEL });
  b.cyl('gbPoly', 0.026, 0.026, 0.13, 0.062, AXIS + 0.004, 0.0, { seg: b.seg(24, 8) });
  if (b.hi) {
    for (let i = 0; i < 9; i++) b.torus('gbAlu', 0.0262, 0.0022, 0.062, AXIS + 0.004, -0.055 + i * 0.013, { seg: 6, tseg: 24 });
    b.cyl('gbAlu', 0.028, 0.024, 0.012, 0.062, AXIS + 0.004, -0.07, { seg: 24 });
    b.cyl('gbSteel', 0.007, 0.007, 0.018, 0.062, AXIS + 0.004, -0.083, { seg: 12 });
    b.tube('rubber', [[0.062, AXIS + 0.004, -0.09], [0.07, AXIS - 0.03, -0.11], [0.04, -0.03, -0.08], [-0.02, -0.06, -0.03], [-0.07, -0.07, 0.0]], 0.0045);
  }

  // ---- Gurtzuführer links (Entgliederer): Gehäuse mit Schacht, Zahnrad sichtbar, Hülsenauswurf unten
  slab(b, mm([[10, AXIS * 1000 + 30], [120, AXIS * 1000 + 30], [128, AXIS * 1000 + 10], [120, AXIS * 1000 - 34], [10, AXIS * 1000 - 34]]), 0.017, 0.004, 'gbSteel', { x: -0.055, id: 'feeder', cav: STEEL,
    cut: (x, v, u, d) => pocket(d, x, rrect(u, v, 0.065, AXIS - 0.002, 0.045, 0.014, 0.004), 0.008, -1) });
  if (b.hi) {
    b.cyl('gbBolt', 0.019, 0.019, 0.016, -0.06, AXIS - 0.002, 0.065, { axis: 'x', seg: 18 });
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; b.box('gbBolt', 0.014, 0.008, 0.006, -0.06, AXIS - 0.002 + Math.sin(a) * 0.021, 0.065 + Math.cos(a) * 0.021, { rx: -a, c: 0.0008 }); }
    b.box('cavity', 0.02, 0.012, 0.05, -0.04, AXIS - 0.044, 0.07, { c: 0 });          // Auswurf unten
  }

  // ---- Vordere Lagerplatte (steht), Korn darauf; Kimme hinten auf dem Deckel
  slab(b, mm([[150, AXIS * 1000 - 56], [172, AXIS * 1000 - 56], [172, AXIS * 1000 + 56], [150, AXIS * 1000 + 56]]), 0.056, 0.006, 'gbSteel', { id: 'plate', cav: STEEL,
    cut: (x, v, u, d) => Math.max(d, Math.hypot(x, v - AXIS) - 0.058) });
  const sv = AXIS + 0.075;
  b.box('gbSteel', 0.03, 0.016, 0.03, 0, AXIS + 0.064, -0.105, { c: 0.002 });
  b.side('gbSteel', [[-0.12, AXIS + 0.07], [-0.095, AXIS + 0.07], [-0.098, sv + 0.006], [-0.117, sv + 0.006]], 0.022, 0, { bevel: 0.001 });
  b.box('cavity', 0.004, 0.006, 0.026, 0, sv + 0.004, -0.106, { c: 0 });
  b.box('gbSteel', 0.005, sv - AXIS - 0.05, 0.008, 0, (sv + AXIS) / 2 + 0.03, 0.163, { c: 0.001 });
  b.box('gbSteel', 0.016, 0.012, 0.016, 0, AXIS + 0.058, 0.163, { c: 0.002 });

  // ---- Tragegriff über dem Gehäuse
  for (const u of [-0.04, 0.1]) b.box('gbSteel', 0.012, 0.03, 0.016, 0, AXIS + 0.07, u, { c: 0.002 });
  b.tube('gbSteel', [[0, AXIS + 0.08, -0.045], [0, AXIS + 0.094, -0.025], [0, AXIS + 0.1, 0.03], [0, AXIS + 0.094, 0.085], [0, AXIS + 0.08, 0.105]], 0.0062);
  b.lathe('gbGrip', [[0, 0], [0, 0.0105], [0.004, 0.0115], [0.08, 0.0115], [0.084, 0.0105], [0.084, 0]], 0, AXIS + 0.1, -0.012, { seg: b.seg(16, 6) });

  // ---- Laufbündel (Teil 'rotor'): Mittelachse, sechs Läufe, Rotorkopf, Mittel- und Mündungsschelle (Blütenform)
  b.part('rotor', 0, AXIS, U0);
  const L = U1 - U0;
  b.cyl('gbBlued', 0.011, 0.011, L * 0.92, 0, AXIS, U0 + L * 0.46, { part: 'rotor', seg: b.seg(14, 6) });
  b.cyl('gbSteel', R + 0.016, R + 0.016, 0.03, 0, AXIS, U0 + 0.028, { part: 'rotor', seg: b.seg(30, 8) });   // Rotorkopf
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, x = Math.cos(a) * R, v = AXIS + Math.sin(a) * R;
    b.cyl('gbBarrel', 0.0082, 0.0086, L, x, v, U0 + L / 2, { part: 'rotor', seg: b.seg(14, 6) });
    if (b.hi) {
      b.cyl('gbBlued', 0.0094, 0.0094, 0.012, x, v, U1 - 0.006, { part: 'rotor', seg: 14 });
      b.bore(0.0039, x, v, U1 + 0.0005, { part: 'rotor', seg: 12 });
    }
  }
  for (const [uu, len] of [[U0 + L * 0.52, 0.02], [U1 - 0.045, 0.024]]) {
    b.cyl('gbSteel', R + 0.004, R + 0.004, len, 0, AXIS, uu, { part: 'rotor', seg: b.seg(30, 8) });
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      b.cyl('gbSteel', 0.0125, 0.0125, len, Math.cos(a) * R, AXIS + Math.sin(a) * R, uu, { part: 'rotor', seg: b.seg(16, 6) });
      if (b.hi) b.cyl('gbSteel', 0.0022, 0.0022, len + 0.001, Math.cos(a + Math.PI / 6) * (R + 0.006), AXIS + Math.sin(a + Math.PI / 6) * (R + 0.006), uu, { part: 'rotor', seg: 8 });   // Klemmschraube
    }
  }

  // ---- Gurtkasten links (Teil 'mag') mit Deckel und Rutsche; Gurt zur Zuführung
  b.part('mag', -0.075, 0.0, 0.0);
  slab(b, mm([[-85, 35], [85, 35], [85, -95], [-85, -95]]), 0.045, 0.005, 'gbOlive', { x: -0.085, part: 'mag', cav: STEEL, cut: (x, v, u, d) => {
    for (let i = 0; i < 4; i++) d = Math.min(d, Math.max(Math.abs(x) - 0.0465, Math.abs(v + 0.075 - i * 0.03) - 0.0025, Math.abs(u) - 0.075));
    return d;
  } });
  b.part('lid', -0.13, 0.035, 0.0, 'mag');
  b.box('gbOlive', 0.094, 0.012, 0.174, -0.085, 0.041, 0.0, { part: 'lid', c: 0.003 });
  if (b.hi) {
    b.box('gbSteel', 0.03, 0.004, 0.014, -0.085, 0.049, 0.0, { part: 'lid', c: 0.001 });
    for (const u of [-0.06, 0.06]) b.cyl('gbSteel', 0.003, 0.003, 0.02, -0.13, 0.036, u, { part: 'lid', seg: 8 });
    b.box('paintYellow', 0.0006, 0.014, 0.08, -0.1306, -0.02, 0.0, { part: 'mag', c: 0 });
    b.box('gbSteel', 0.004, 0.02, 0.05, -0.132, -0.06, 0.0, { part: 'mag', c: 0.001 });   // Tragebügel
    // Gurtrutsche: Kette aus Gliedern vom Kasten hoch zum Zuführer (bewegt sich mit dem Kasten)
    const chute = Array.from({ length: 6 }, (_, i) => { const t = i / 5; return [-0.118 + t * 0.05, 0.045 + t * 0.05 + Math.sin(t * Math.PI) * 0.022, -0.05 + t * 0.09]; });
    b.tube('gbPoly', chute, 0.0115, { part: 'mag', seg: 10 });
    for (let i = 1; i < 10; i++) { const t = i / 10, k = t * 5, j = Math.min(4, Math.floor(k)), f = k - j, p = chute[j].map((c, n) => c + (chute[j + 1][n] - c) * f);
      b.torus('gbSteel', 0.0118, 0.0018, p[0], p[1], p[2], { part: 'mag', seg: 6, tseg: 14, ry: 0.5, rx: -0.4 }); }
  }
  b.part('belt', 0, 0, 0, 'mag');
  const beltAt = (t) => [-0.095 + t * 0.06 + Math.sin(t * Math.PI) * -0.012, 0.04 + t * 0.055 + Math.sin(t * Math.PI) * 0.02, 0.0];
  magRounds(b, { part: 'belt', cal: 'r308', fit: 0.066, link: true, stagger: false, follower: false, spread: 9, path: Array.from({ length: 9 }, (_, i) => beltAt(1 - i / 8)) });
  if (!b.hi) b.box('brass', 0.03, 0.06, 0.05, -0.08, 0.07, 0.0, { part: 'belt', rz: -0.5 });
  b.anchor('magGrab', -0.085, -0.03, 0.0, { part: 'mag', data: { w: 0.045, d: 0.085 } });
  b.anchor('magWell', -0.075, 0.0, 0.0);

  // ---- Pistolengriff mit Bügel, Abzug, kurze Schulterstütze
  slab(b, mm([[30, 8], [26, -4], [18, -44], [8, -74], [-2, -84], [-30, -84], [-36, -74], [-22, -36], [-14, 0], [-18, 8]]), 0.0155, 0.007, 'gbGrip', { id: 'grip', cav: POLY });
  slab(b, mm([[24, 8], [22, -6], [30, -34], [98, -34], [104, -26], [104, 8], [94, 8], [92, -24], [36, -26], [34, -6], [36, 8]]), 0.0075, 0.0025, 'gbSteel', { id: 'guard', cav: STEEL });
  b.side('gbSteel', mm([[56, 6], [58, -6], [62, -18], [60, -24], [56, -22], [54, -10], [52, 6]]), 0.007, 0, { bevel: 0.001 });
  slab(b, mm([[-120, 96], [-290, 92], [-306, 86], [-306, -26], [-292, -34], [-200, -6], [-130, 16], [-120, 20]]), 0.018, 0.006, 'gbPoly', { id: 'stock', cav: POLY,
    holes: [mm([[-190, 66], [-270, 64], [-270, 10], [-200, 24]])] });
  b.box('rubber', 0.04, 0.124, 0.012, 0, 0.03, -0.312, { c: 0.004 });

  // ---- Vordergriff (senkrecht unter der Lagerplatte) für die Stützhand
  b.box('gbSteel', 0.03, 0.022, 0.04, 0, AXIS - 0.06, 0.2, { c: 0.003 });
  b.lathe('gbGrip', [[0, 0], [0, 0.016], [0.004, 0.0172], [0.1, 0.0165], [0.106, 0.015], [0.11, 0]], 0, AXIS - 0.071, 0.2, { axis: 'v', seg: b.seg(18, 6), rx: Math.PI });
  if (b.hi) for (let i = 0; i < 5; i++) b.torus('rubber', 0.0172, 0.0016, 0, AXIS - 0.09 - i * 0.02, 0.2, { seg: 6, tseg: 16, rx: Math.PI / 2 });

  // ---- Ladehebel rechts (Durchdrehen von Hand), Verschlussbahn
  b.part('charge', 0.04, 0.03, 0.08);
  b.box('gbSteel', 0.01, 0.012, 0.03, 0.038, 0.03, 0.08, { part: 'charge', c: 0.002 });
  b.cyl('gbSteel', 0.006, 0.007, 0.024, 0.052, 0.03, 0.088, { part: 'charge', axis: 'x', seg: b.seg(10, 5) });
  b.anchor('chargeGrab', 0.062, 0.03, 0.088, { part: 'charge', data: { travel: [0, 0, 0.08], style: 'right' } });
  b.part('bolt', 0, AXIS, 0.0);

  b.anchor('muzzle', 0, AXIS, U1 + 0.004);
  b.anchor('ejection', 0.04, 0.03, 0.02);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.32, gw: 0.016, gd: 0.02, gu: 0.006, ho: 0.039, tu: 0.03 } });
  b.anchor('sight', 0, sv + 0.004, -0.106, { data: { type: 'iron', eyeRelief: 0.3 } });
  b.anchor('leftHandGrip', 0, AXIS - 0.1, 0.2, { data: { style: 'under', w: 0.017, h: 0.017 } });
  b.meta = { sight: 'iron', axis: AXIS, kind: 'lmg' };
}
