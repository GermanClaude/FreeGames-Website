// RG-6 Orkan (13.11., Nutzerwunsch „Minigun“): tragbare Gatling mit sechs Läufen. Aufbau nach dem Muster des HM-60
// (Gurtkasten links als Teil 'mag' mit Deckel 'lid', Gurt 'belt', Zuführdeckel 'cover', Ladehebel 'charge'), dazu das
// Laufbündel als eigenes Teil 'rotor' (Drehpunkt auf der Bündelachse) – das Viewmodel dreht es mit der Hochdrehzahl
// der Waffe (controller.js spin) und lässt es nachlaufen.
import { ejectionPort, triggerGuard } from './parts.js?v=20261113221339';
import { magRounds } from './magfill.js?v=20261113221339';

export function orkan(b) {
  const axis = 0.072;          // Achse des Laufbündels
  const R = 0.024;             // Teilkreis der sechs Läufe
  const u0 = 0.16, u1 = 0.74;  // Läufe von … bis (Mündung)
  // ---- Antriebsgehäuse: Rundkörper mit Motorhaube, Seitenplatten und Kühlrippen
  b.lathe('steelDark', [[0, 0.0], [0, 0.044], [0.01, 0.052], [0.27, 0.052], [0.285, 0.046], [0.29, 0.0]], 0, axis, -0.13, { seg: b.seg(28, 10) });
  b.side('steel', [[-0.12, 0.012], [0.15, 0.012], [0.15, 0.04], [-0.12, 0.04]], 0.07, 0, { bevel: 0.003 });
  if (b.hi) {
    for (let i = 0; i < 7; i++) b.torus('steel', 0.053, 0.0028, 0, axis, -0.1 + i * 0.033, { seg: 6, tseg: 28 });
    for (let i = 0; i < 5; i++) { b.screw('steelBright', 0.0355, 0.026, -0.1 + i * 0.055, 'x', 0.0024); b.screw('steelBright', -0.0355, 0.026, -0.1 + i * 0.055, 'x', 0.0024); }
    // Warnschild + Typenschild
    b.box('paintYellow', 0.0006, 0.016, 0.05, 0.0352, 0.03, 0.02, { c: 0 });
    b.box('steelBright', 0.0006, 0.012, 0.034, 0.0352, 0.03, 0.09, { c: 0 });
  }
  // Elektromotor rechts (Zylinder quer) mit Kabelzug zum Kasten
  b.cyl('polymer', 0.026, 0.026, 0.11, 0.05, axis - 0.03, -0.04, { seg: b.seg(18, 8) });
  b.cyl('steel', 0.028, 0.028, 0.012, 0.05, axis - 0.03, 0.02, { seg: b.seg(18, 8) });
  if (b.hi) {
    for (let i = 0; i < 5; i++) b.torus('steel', 0.0265, 0.0018, 0.05, axis - 0.03, -0.085 + i * 0.018, { seg: 6, tseg: 18 });
    b.tube('rubber', [[0.05, axis - 0.03, -0.1], [0.04, axis - 0.06, -0.12], [-0.02, -0.03, -0.06], [-0.06, -0.05, 0.0]], 0.0045);
  }
  // Vordere Lagerplatte (dreht nicht), Zuführdeckel oben
  b.cyl('steel', 0.056, 0.056, 0.022, 0, axis, 0.155, { seg: b.seg(28, 10) });
  b.part('cover', 0, axis + 0.05, 0.14);
  b.side('steel', [[-0.08, axis + 0.046], [0.14, axis + 0.046], [0.14, axis + 0.058], [0.12, axis + 0.066], [-0.06, axis + 0.066], [-0.08, axis + 0.058]], 0.048, 0, { part: 'cover', bevel: 0.002 });
  if (b.hi) for (let i = 0; i < 4; i++) b.box('steel', 0.05, 0.003, 0.006, 0, axis + 0.066, -0.04 + i * 0.045, { part: 'cover', c: 0.0008 });
  // Tragegriff über dem Gehäuse
  b.tube('steel', [[0, axis + 0.055, -0.04], [0, axis + 0.085, -0.025], [0, axis + 0.092, 0.03], [0, axis + 0.085, 0.085], [0, axis + 0.055, 0.1]], 0.0055);
  b.box('rubber', 0.016, 0.014, 0.09, 0, axis + 0.092, 0.03, { c: 0.004 });
  // Kimme hinten auf dem Gehäuse, Korn auf der Lagerplatte
  const sv = axis + 0.075;
  b.box('steel', 0.03, 0.016, 0.03, 0, axis + 0.058, -0.105, { c: 0.002 });
  b.side('steel', [[-0.12, axis + 0.066], [-0.095, axis + 0.066], [-0.098, sv + 0.006], [-0.117, sv + 0.006]], 0.022, 0, { bevel: 0.001 });
  b.box('cavity', 0.004, 0.006, 0.026, 0, sv + 0.004, -0.106, { c: 0 });
  b.box('steel', 0.005, sv - axis - 0.05, 0.008, 0, (sv + axis) / 2 + 0.03, 0.16, { c: 0.001 });

  // ---- Laufbündel (Teil 'rotor', Drehpunkt auf der Achse)
  b.part('rotor', 0, axis, u0);
  const L = u1 - u0;
  b.cyl('steelDark', 0.011, 0.011, L * 0.9, 0, axis, u0 + L * 0.45, { part: 'rotor', seg: b.seg(12, 6) });   // Mittelachse
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, x = Math.cos(a) * R, v = axis + Math.sin(a) * R;
    b.cyl('barrelNitride', 0.0085, 0.0085, L, x, v, u0 + L / 2, { part: 'rotor', seg: b.seg(12, 6) });
    if (b.hi) {
      b.cyl('steelDark', 0.0098, 0.0098, 0.03, x, v, u1 - 0.015, { part: 'rotor', seg: 12 });   // Mündungsverstärkung
      b.bore(0.0042, x, v, u1 + 0.0005, { part: 'rotor', seg: 12 });
    }
  }
  // Laufschellen (vorn, Mitte) und Rotorkopf hinten
  for (const [uu, len] of [[u0 + 0.02, 0.04], [u0 + L * 0.5, 0.018], [u1 - 0.05, 0.022]]) {
    b.cyl('steel', R + 0.013, R + 0.013, len, 0, axis, uu, { part: 'rotor', seg: b.seg(24, 8) });
  }
  if (b.hi) for (let i = 0; i < 6; i++) {
    // Lochbild der Schellen (dunkle Nuten zwischen den Läufen – sieht man beim Drehen flimmern)
    const a = i * Math.PI / 3 + Math.PI / 6;
    b.box('cavity', 0.004, 0.004, 0.019, Math.cos(a) * (R + 0.012), axis + Math.sin(a) * (R + 0.012), u0 + L * 0.5, { part: 'rotor', rz: a, c: 0 });
  }

  // ---- Gurtkasten links (Teil 'mag') mit losem Deckel und Gurt zur Zuführung
  b.part('mag', -0.075, 0.0, 0.0);
  b.box('paintOlive', 0.09, 0.13, 0.17, -0.085, -0.03, 0.0, { part: 'mag', c: 0.005 });
  b.part('lid', -0.13, 0.035, 0.0, 'mag');
  b.box('paintOlive', 0.094, 0.012, 0.174, -0.085, 0.041, 0.0, { part: 'lid', c: 0.003 });
  if (b.hi) {
    b.box('steel', 0.03, 0.004, 0.014, -0.085, 0.049, 0.0, { part: 'lid', c: 0.001 });
    for (const u of [-0.06, 0.06]) b.cyl('steel', 0.003, 0.003, 0.02, -0.13, 0.036, u, { part: 'lid', seg: 8 });
    b.box('paintYellow', 0.0006, 0.02, 0.08, -0.1305, -0.02, 0.0, { part: 'mag', c: 0 });
    for (let i = 0; i < 5; i++) b.box('paintOlive', 0.002, 0.11, 0.004, -0.1315, -0.03, -0.07 + i * 0.035, { part: 'mag', c: 0 });
    b.box('steel', 0.004, 0.02, 0.05, -0.132, -0.06, 0.0, { part: 'mag', c: 0.001 });   // Tragebügel
  }
  // Gurt: Bogen vom Kasten hoch in die Zuführung links am Gehäuse
  b.part('belt', 0, 0, 0, 'mag');
  const beltAt = (t) => [-0.095 + t * 0.06 + Math.sin(t * Math.PI) * -0.012, 0.04 + t * 0.055 + Math.sin(t * Math.PI) * 0.02, 0.0];
  magRounds(b, { part: 'belt', cal: 'r308', fit: 0.066, link: true, stagger: false, follower: false, spread: 9, path: Array.from({ length: 9 }, (_, i) => beltAt(1 - i / 8)) });
  if (!b.hi) b.box('brass', 0.03, 0.06, 0.05, -0.08, 0.07, 0.0, { part: 'belt', rz: -0.5 });
  b.anchor('magGrab', -0.085, -0.03, 0.0, { part: 'mag', data: { w: 0.045, d: 0.085 } });
  b.anchor('magWell', -0.075, 0.0, 0.0);

  // ---- Pistolengriff, Abzug, kurze Schulterstütze
  b.side('grip', [
    [0.03, 0.014], [0.026, 0.0], [0.018, -0.04], [0.01, -0.07], [0.0, -0.08], [-0.028, -0.08], [-0.032, -0.068],
    [-0.022, -0.035], [-0.014, 0.0], [-0.018, 0.014],
  ], 0.032, 0, { bevel: 0.008, bevelSeg: 2 });
  triggerGuard(b, 'steel', 0.03, 0.1, 0.014, 0.034, { t: 0.005, w: 0.014, trigPos: 0.28 });
  b.side('polymer', [[-0.13, 0.1], [-0.3, 0.096], [-0.31, 0.088], [-0.31, -0.03], [-0.295, -0.036], [-0.2, -0.004], [-0.13, 0.02]], 0.036, 0, { bevel: 0.006, bevelSeg: 2 });
  b.box('rubber', 0.048, 0.14, 0.014, 0, 0.032, -0.316, { c: 0.004 });

  // ---- Vordergriff (senkrecht unter der Lagerplatte) für die Stützhand
  b.box('steel', 0.03, 0.02, 0.04, 0, axis - 0.06, 0.2, { c: 0.003 });
  b.cyl('grip', 0.017, 0.016, 0.11, 0, axis - 0.125, 0.2, { axis: 'v', seg: b.seg(14, 6) });
  if (b.hi) for (let i = 0; i < 5; i++) b.torus('rubber', 0.0172, 0.0016, 0, axis - 0.165 + i * 0.02, 0.2, { seg: 6, tseg: 14, rx: Math.PI / 2 });

  // ---- Ladehebel rechts, Auswurf rechts unten am Gehäuse
  b.part('charge', 0.04, 0.03, 0.08);
  b.box('steel', 0.01, 0.012, 0.03, 0.038, 0.03, 0.08, { part: 'charge', c: 0.002 });
  b.cyl('steel', 0.006, 0.007, 0.024, 0.052, 0.03, 0.088, { part: 'charge', axis: 'x', seg: b.seg(10, 5) });
  b.anchor('chargeGrab', 0.062, 0.03, 0.088, { part: 'charge', data: { travel: [0, 0, 0.08], style: 'right' } });
  ejectionPort(b, 0.0355, 0.03, 0.02, 0.05, 0.018);
  b.part('bolt', 0, axis, 0.0);

  b.anchor('muzzle', 0, axis, u1 + 0.004);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.32, gw: 0.016, gd: 0.02, gu: 0.006, ho: 0.039, tu: 0.03 } });
  b.anchor('sight', 0, sv + 0.004, -0.106, { data: { type: 'iron', eyeRelief: 0.3 } });
  b.anchor('leftHandGrip', 0, axis - 0.1, 0.2, { data: { style: 'under', w: 0.017, h: 0.017 } });
  b.meta = { sight: 'iron', axis, kind: 'lmg' };
}
