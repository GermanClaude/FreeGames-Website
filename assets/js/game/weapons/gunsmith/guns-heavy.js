// Welle 2 – schwere Waffen: RW-90 Donnerkeil (Panzerabwehr-Rohr, vorn geladene Raketengranate), die fliegende Rakete und
// die Granatwerfer GW-40 Hammer / GW-6 Trommel. Titan, Hagel und Kobra sind seit 13.11. nach Vorbild neu gebaut
// (guns-praezision.js, guns-flinten.js, guns-kobra.js).
import { triggerGuard, arGrip, roundRect } from './parts.js?v=20261114060746';

// Rakete (Panzerabwehr-Granate): Spitze vorn (+u), Leitwerk hinten. Für Ladeteil und fliegende Rakete.
function rocketBody(b, u0, axis, o = {}) {
  const part = o.part, s = b.seg(24, 8);
  // PG-7-artiger Gefechtskopf (13.11., nach Vorbild): Heckkegel → zylindrischer Mantel (85 mm) → lange Ogive →
  // Piezo-Zünderspitze mit Messingkappe; Bördelringe, Lackband, Schweißnaht. u0 = Hinterkante des Mantels.
  b.lathe('paintOlive', [[-0.055, 0.0], [-0.055, 0.0205], [-0.03, 0.026], [-0.008, 0.034], [0.0, 0.0395], [0.012, 0.0425],
    [0.07, 0.0425], [0.078, 0.042], [0.1, 0.039], [0.125, 0.032], [0.15, 0.022], [0.17, 0.0125], [0.18, 0.0085], [0.18, 0.0]], 0, axis, u0, { seg: s, part });
  b.lathe('steel', [[0.18, 0.0085], [0.192, 0.0072], [0.198, 0.0062], [0.198, 0.0]], 0, axis, u0, { seg: b.seg(14, 6), part });
  b.lathe('brass', [[0.198, 0.0062], [0.203, 0.0052], [0.207, 0.003], [0.208, 0.0]], 0, axis, u0, { seg: b.seg(12, 6), part });
  if (b.hi) {
    b.cyl('paintYellow', 0.0429, 0.0429, 0.01, 0, axis, u0 + 0.045, { seg: s, part });     // Kennband
    b.cyl('paintWhite', 0.043, 0.043, 0.003, 0, axis, u0 + 0.032, { seg: s, part });       // Beschriftungslinie
    b.torus('steel', 0.0426, 0.0012, 0, axis, u0 + 0.012, { seg: 6, tseg: 32, part });     // Bördelnaht vorn
    b.torus('steel', 0.0398, 0.0011, 0, axis, u0 + 0.001, { seg: 6, tseg: 30, part });     // Bördelnaht hinten
    b.torus('steel', 0.0255, 0.0014, 0, axis, u0 - 0.03, { seg: 6, tseg: 24, part });      // Übergang Treibladung
    for (let i = 0; i < 4; i++) b.box('steelDark', 0.004, 0.0015, 0.012, Math.cos(i * Math.PI / 2) * 0.0208, axis + Math.sin(i * Math.PI / 2) * 0.0208, u0 - 0.048, { rz: i * Math.PI / 2, part, c: 0 });
  }
  // Treibladungsrohr (Pappe/Stahl) mit Wicklung, Düsenring, Leitwerk
  b.cyl('steel', 0.0195, 0.02, 0.22, 0, axis, u0 - 0.165, { seg: b.seg(18, 6), part });
  if (b.hi) {
    b.cyl('canvasOD', 0.0201, 0.0201, 0.11, 0, axis, u0 - 0.14, { seg: 18, part });         // Pulverbeutel-Hülle
    for (const du of [-0.088, -0.19]) b.cyl('steelDark', 0.0207, 0.0207, 0.006, 0, axis, u0 + du, { seg: 18, part });
    b.lathe('steelDark', [[0, 0.02], [-0.02, 0.019], [-0.03, 0.016], [-0.03, 0.0]], 0, axis, u0 - 0.275, { seg: 18, part });
  }
  if (o.fins !== false) for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    b.box('steel', 0.0016, 0.034, 0.06, Math.cos(a) * 0.035, axis + Math.sin(a) * 0.035, u0 - 0.27, { rz: a - Math.PI / 2, c: 0, part });
    if (b.hi) b.box('steelDark', 0.0018, 0.008, 0.012, Math.cos(a) * 0.022, axis + Math.sin(a) * 0.022, u0 - 0.245, { rz: a - Math.PI / 2, c: 0, part });
  }
}

export function donner(b) {
  const axis = 0.09, s = b.seg(24, 8);
  // Rohr: hinterer Teil, Mittelstück (unter dem Holz), vorderer Teil mit Mündungsring
  b.cyl('steel', 0.02, 0.02, 0.9, 0, axis, 0.06, { seg: s });
  b.lathe('steel', [[0, 0.0], [0, 0.0235], [0.004, 0.025], [0.028, 0.025], [0.032, 0.0228], [0.032, 0.0]], 0, axis, 0.484, { seg: s });
  b.bore(0.0198, 0, axis, 0.5165, { seg: s });
  b.anchor('muzzle', 0, axis, 0.52);
  // Hitzeschutz: zwei Holzhalbschalen (leicht gewölbt, längs gemasert), Stahlschellen mit Spannschraube
  b.lathe('woodWarm', [[0, 0.0], [0, 0.027], [0.008, 0.0292], [0.12, 0.0296], [0.232, 0.0292], [0.24, 0.027], [0.24, 0.0]], 0, axis, -0.105, { seg: s });
  if (b.hi) {
    for (const s2 of [-1, 1]) b.box('cavity', 0.0012, 0.0016, 0.232, s2 * 0.0296 * Math.cos(0.15), axis + 0.0045, 0.015, { c: 0 }); // Fuge der Halbschalen
    for (const du of [-0.102, 0.012, 0.131]) {
      b.cyl('steelDark', 0.0305, 0.0305, 0.011, 0, axis, du, { seg: s });
      b.box('steelDark', 0.008, 0.012, 0.011, 0.0, axis + 0.033, du, { c: 0.0015 });
      b.screw('steelBright', 0.0046, axis + 0.036, du, 'x', 0.0022);
    }
  } else b.cyl('steelDark', 0.0305, 0.0305, 0.011, 0, axis, 0.012, { seg: 8 });
  // Düse: Kragen → Trichter → Prallring (innen dunkel), Schweißnaht und Verstärkungsrippen
  b.lathe('steel', [[-0.162, 0.044], [-0.166, 0.046], [-0.164, 0.05], [-0.158, 0.05], [-0.152, 0.0475], [-0.13, 0.042], [-0.075, 0.03],
    [-0.03, 0.023], [-0.02, 0.0245], [0, 0.0235], [0, 0.0]], 0, axis, -0.375, { seg: b.seg(28, 10) });
  b.lathe('cavity', [[-0.163, 0.044], [-0.13, 0.039], [-0.075, 0.027], [-0.03, 0.02], [0.0, 0.0]], 0, axis, -0.375, { seg: b.seg(20, 8) });
  if (b.hi) {
    b.torus('steelDark', 0.0242, 0.0016, 0, axis, -0.395, { seg: 6, tseg: 28 });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      b.box('steel', 0.003, 0.006, 0.07, Math.cos(a) * 0.033, axis + Math.sin(a) * 0.033, -0.475, { rz: a, rx: 0, c: 0.0008 });
    }
    // Zündhebel-Gehäuse hinten oben (Schlagbolzenführung) und Sicherungsknopf
    b.box('steelDark', 0.018, 0.012, 0.03, 0, axis + 0.024, -0.33, { c: 0.002 });
  }
  // Abzugsgruppe: Stahlgehäuse unter dem Rohr, Hahn/Abzugsstange, Holzgriffschalen, Bügel
  b.box('steelDark', 0.024, 0.026, 0.135, 0, axis - 0.032, 0.03, { c: 0.003 });
  b.box('steelDark', 0.03, 0.01, 0.08, 0, axis - 0.022, 0.02, { c: 0.002 });
  arGrip(b, 'woodWarm', { top: 0.044, w: 0.031 });
  if (b.hi) {
    b.box('steelDark', 0.0045, 0.08, 0.024, 0, 0.0, -0.008, { c: 0.001 });           // Griffrücken (Stahlrahmen zwischen den Schalen)
    for (const s2 of [-1, 1]) b.screw('steelBright', s2 * 0.0158, -0.018, -0.006, 'x', 0.0028);
    for (let i = 0; i < 5; i++) for (const s2 of [-1, 1]) b.box('woodWalnut', 0.0012, 0.003, 0.03, s2 * 0.0155, -0.03 - i * 0.008, -0.008, { c: 0 }); // Griffrillen
    b.part('hammer', 0, axis - 0.02, -0.04);
    b.box('steelBright', 0.008, 0.016, 0.01, 0, axis - 0.01, -0.045, { part: 'hammer', c: 0.0015 });
    b.cyl('steelDark', 0.004, 0.004, 0.034, 0, axis - 0.03, 0.065, { axis: 'x', seg: 10 });  // Sicherungsbolzen quer
    b.cyl('paintSignal', 0.0042, 0.0042, 0.002, 0.0175, axis - 0.03, 0.065, { axis: 'x', seg: 10 });
  }
  triggerGuard(b, 'steel', 0.02, 0.072, 0.04, 0.03, { t: 0.005, w: 0.013, trigPos: 0.32 });
  // Vordergriff (Holz) mit Stahlbügel am Rohr
  b.side('woodWarm', [[0.198, 0.058], [0.238, 0.058], [0.236, 0.02], [0.232, -0.02], [0.226, -0.046], [0.214, -0.05], [0.202, -0.046], [0.198, -0.02], [0.2, 0.02]], 0.032, 0, { bevel: 0.007, bevelSeg: 2 });
  b.box('steelDark', 0.026, 0.018, 0.058, 0, axis - 0.028, 0.218, { c: 0.002 });
  if (b.hi) {
    for (let i = 0; i < 4; i++) b.box('woodWalnut', 0.0322, 0.0024, 0.034, 0, 0.02 - i * 0.014, 0.217, { c: 0 });  // Griffrillen
    b.screw('steelBright', 0.0136, axis - 0.028, 0.218, 'x', 0.0025);
  }
  // Visierung: Klappkimme mit Stufenblatt hinten, Korn mit Schutzohren vorn
  const sv = 0.142;
  b.box('steelDark', 0.03, 0.014, 0.034, 0, axis + 0.026, -0.022, { c: 0.002 });
  b.front('steel', [[-0.013, axis + 0.033], [0.013, axis + 0.033], [0.013, sv + 0.01], [-0.013, sv + 0.01]], 0.004, -0.024, {
    holes: [[[-0.0025, sv - 0.006], [0.0025, sv - 0.006], [0.0025, sv + 0.006], [-0.0025, sv + 0.006]]], bevel: 0.0008,
  });
  if (b.hi) {
    for (let i = 0; i < 4; i++) b.box('paintWhite', 0.004, 0.0008, 0.0006, 0.008, axis + 0.044 + i * 0.0055, -0.0262, { c: 0 }); // Stufenmarken (visier: alle auf dem Blatt)
    b.cyl('steelBright', 0.0022, 0.0022, 0.032, 0, axis + 0.033, -0.022, { axis: 'x', seg: 10 });   // Klappachse
  }
  b.box('steelDark', 0.018, 0.016, 0.03, 0, axis + 0.027, 0.36, { c: 0.002 });
  b.box('steel', 0.006, sv - axis - 0.024, 0.008, 0, (sv + axis) / 2 + 0.008, 0.36, { c: 0.0012 });
  b.box('steel', 0.003, 0.012, 0.003, 0, sv - 0.006, 0.36, { c: 0 });
  if (b.hi) for (const s2 of [-1, 1]) b.box('steel', 0.003, 0.022, 0.014, s2 * 0.0085, sv - 0.008, 0.36, { c: 0.0006 });
  // Optik links: Schwalbenschwanz-Schiene, Halter, Zielhilfe (Tubus mit Okular-Gummi, Objektiv, Verstelltürme)
  b.box('steelDark', 0.006, 0.05, 0.12, -0.028, axis, 0.03, { c: 0.002 });
  if (b.hi) {
    const ox = -0.062, ov = axis + 0.052;
    b.box('steelDark', 0.03, 0.012, 0.06, -0.044, axis + 0.026, 0.03, { c: 0.002 });
    b.box('steelDark', 0.012, 0.03, 0.05, -0.05, axis + 0.04, 0.03, { c: 0.002 });
    b.lathe('polymerOD', [[-0.075, 0.0], [-0.075, 0.017], [-0.06, 0.0185], [0.04, 0.0185], [0.055, 0.021], [0.09, 0.021], [0.09, 0.0]], ox, ov, 0.0, { seg: 20 });
    b.lathe('rubber', [[0, 0.0], [0, 0.019], [-0.03, 0.022], [-0.035, 0.02], [-0.035, 0.012]], ox, ov, -0.075, { seg: 20 });
    b.circle('lens', 0.0175, ox, ov, 0.091, { seg: 20, ry: Math.PI });
    b.circle('lens', 0.0105, ox, ov, -0.109, { seg: 16 });
    b.cyl('polymerOD', 0.0095, 0.0095, 0.016, ox, ov + 0.024, 0.0, { axis: 'v', seg: 16 });
    b.cyl('polymerOD', 0.0095, 0.0095, 0.016, ox - 0.024, ov, 0.0, { axis: 'x', seg: 16 });
    b.cyl('glowAmber', 0.003, 0.003, 0.004, ox + 0.019, ov, -0.03, { axis: 'x', seg: 8 });   // Absehenbeleuchtung
    b.box('steelDark', 0.016, 0.008, 0.02, ox + 0.012, ov - 0.022, -0.04, { c: 0.001 });      // Batteriefach
  }
  // Riemenbügel
  if (b.hi) {
    b.torus('steel', 0.009, 0.0016, 0.026, axis - 0.012, 0.2, { ry: Math.PI / 2, tseg: 14 });
    b.torus('steel', 0.009, 0.0016, 0.026, axis - 0.012, -0.24, { ry: Math.PI / 2, tseg: 14 });
    b.box('paintSignal', 0.0005, 0.004, 0.004, 0.0302, axis + 0.016, 0.1, { c: 0 });
  }
  // Geladene Rakete (Teil 'rocket': unsichtbar, solange leer)
  b.part('rocket', 0, axis, 0.52);
  rocketBody(b, 0.62, axis, { part: 'rocket', fins: false });
  b.anchor('rocketGrab', -0.02, axis - 0.03, 0.66, { part: 'rocket', data: { w: 0.04, d: 0.042 } });
  b.anchor('magGrab', -0.02, axis - 0.03, 0.66, { part: 'rocket', data: { w: 0.04, d: 0.042 } });
  b.anchor('magWell', 0, axis, 0.52);
  b.anchor('ejection', 0, axis, -0.4);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.28, gw: 0.016, gd: 0.022, gu: 0.0, ho: 0.03, tu: 0.034 } });
  b.anchor('sight', 0, sv, -0.024, { data: { type: 'iron', eyeRelief: 0.24 } });
  b.anchor('leftHandGrip', 0, 0.01, 0.218, { data: { style: 'post', rake: 0.08, gw: 0.016, gd: 0.02, gu: 0, ho: 0.03 } });
  b.meta = { sight: 'iron', axis, kind: 'launcher' };
}

/** Fliegende Rakete (3.-Person-Modell der Projektile): Spitze nach −Z (vorn). */
export function rocket(b) {
  rocketBody(b, 0.08, 0, {});
  b.anchor('rightHandGrip', 0, 0, 0);
  b.anchor('muzzle', 0, 0, -0.12);
  b.meta = { sight: 'none', kind: 'gear' };
}

/**
 * GW-40 „Hammer“ (13.11., nach dem Vorbild M79): einschüssiger 40-mm-Kipplaufwerfer. Kurzer dicker Lauf (Stahl,
 * brüniert) mit Kornfuß vorn und angeklapptem Leitervisier-Rahmen, Gehäuse mit Verschlusshebel oben und Gelenkbolzen
 * unten, Holzvorderschaft unter dem Lauf, Holzschaft mit Kolbenhals (Handgelenk = Griffpunkt), Gummikappe,
 * Riemenbügel. Geladene Granate (Teil 'rocket') sitzt sichtbar in der Mündung.
 */
export function hammer(b) {
  const axis = 0.075, s = b.seg(26, 9);
  // Lauf 356 mm, außen 46 mm, leicht abgesetzt; Mündung mit Krone, Züge im Inneren angedeutet
  b.lathe('zwBarrel', [[0, 0.0], [0, 0.026], [0.006, 0.0272], [0.3, 0.0265], [0.31, 0.0275], [0.322, 0.0275], [0.325, 0.026], [0.325, 0.0]], 0, axis, 0.088, { seg: s });
  b.bore(0.0205, 0, axis, 0.4135, { seg: s });
  b.anchor('muzzle', 0, axis, 0.415);
  if (b.hi) for (let i = 0; i < 8; i++) b.box('cavity', 0.0016, 0.0016, 0.05, Math.cos(i * Math.PI / 4) * 0.0198, axis + Math.sin(i * Math.PI / 4) * 0.0198, 0.388, { rz: i * Math.PI / 4, c: 0 });
  // Gehäuse (Stahl) mit Verschlusshebel und Gelenk
  b.side('zwBlued', [[-0.03, axis + 0.03], [0.09, axis + 0.03], [0.096, axis + 0.024], [0.096, axis - 0.028], [0.088, axis - 0.042], [0.03, axis - 0.046], [-0.012, axis - 0.046], [-0.03, axis - 0.03]], 0.05, 0, { bevel: 0.004, bevelSeg: 2 });
  b.cyl('zwPolish', 0.0085, 0.0085, 0.054, 0, axis - 0.03, 0.088, { axis: 'x', seg: b.seg(14, 6) });
  b.part('cover', 0, axis + 0.03, 0.0);
  b.side('zwPolish', [[-0.04, axis + 0.034], [-0.01, axis + 0.036], [0.03, axis + 0.034], [0.034, axis + 0.03], [-0.008, axis + 0.029], [-0.042, axis + 0.03]], 0.012, 0, { part: 'cover', bevel: 0.0015 });
  if (b.hi) {
    b.box('knurl', 0.014, 0.006, 0.016, 0, axis + 0.038, -0.034, { part: 'cover', c: 0.001 });  // geriffelter Daumenhebel
    for (const s2 of [-1, 1]) { b.screw('steelBright', s2 * 0.0252, axis - 0.01, 0.02, 'x', 0.0028); b.screw('steelBright', s2 * 0.0252, axis - 0.03, -0.015, 'x', 0.0026); }
    b.box('zwPolish', 0.006, 0.012, 0.012, 0.024, axis + 0.01, 0.07, { c: 0.001 });            // Sicherungsschieber
    b.box('cavity', 0.0012, 0.03, 0.002, 0.0252, axis + 0.0, 0.092, { c: 0 });                  // Spaltlinie Gehäuse/Lauf
  }
  // Holzschaft mit Kolbenhals (Griffstelle am Ursprung) und Gummikappe
  b.side('woodWarm', [[-0.026, axis + 0.022], [-0.07, axis + 0.014], [-0.2, axis + 0.004], [-0.33, axis - 0.002], [-0.352, axis - 0.004],
    [-0.356, 0.0], [-0.352, -0.042], [-0.33, -0.046], [-0.2, -0.032], [-0.1, -0.024], [-0.04, -0.034], [-0.014, -0.04], [0.008, -0.038],
    [0.018, -0.026], [0.022, -0.004], [0.016, axis - 0.046], [-0.026, axis - 0.046]], 0.038, 0, { bevel: 0.008, bevelSeg: 3 });
  b.side('rubber', [[-0.352, axis - 0.002], [-0.37, axis], [-0.374, 0.0], [-0.37, -0.048], [-0.352, -0.046]], 0.041, 0, { bevel: 0.004, bevelSeg: 2 });
  if (b.hi) {
    for (let i = 0; i < 7; i++) b.box('cavity', 0.042, 0.0012, 0.0016, 0, axis - 0.008 - i * 0.017, -0.372, { c: 0 });   // Rillen der Kappe
    b.box('steelDark', 0.03, 0.004, 0.02, 0, -0.039, -0.25, { c: 0.001 });                                                 // Riemenbügel-Platte
    b.torus('steel', 0.009, 0.0017, 0, -0.049, -0.25, { ry: Math.PI / 2, tseg: 14 });
    for (const s2 of [-1, 1]) b.screw('steelBright', s2 * 0.0205, axis - 0.02, -0.06, 'x', 0.003);                        // Schaftschraube
  }
  triggerGuard(b, 'zwBlued', 0.012, 0.07, axis - 0.046, 0.034, { t: 0.005, w: 0.013, trigPos: 0.3 });
  // Vorderschaft (Holz) unter dem Lauf, Riemenbügel, Kornfuß + Korn mit Schutzohren
  b.side('woodWarm', [[0.1, axis - 0.026], [0.3, axis - 0.026], [0.31, axis - 0.032], [0.304, axis - 0.052], [0.29, axis - 0.058], [0.11, axis - 0.058], [0.1, axis - 0.048]], 0.046, 0, { bevel: 0.007, bevelSeg: 2 });
  if (b.hi) {
    b.box('steelDark', 0.03, 0.006, 0.014, 0, axis - 0.06, 0.28, { c: 0.001 });
    b.torus('steel', 0.008, 0.0016, 0, axis - 0.068, 0.28, { ry: Math.PI / 2, tseg: 14 });
    for (const s2 of [-1, 1]) b.screw('steelBright', s2 * 0.0232, axis - 0.042, 0.2, 'x', 0.0026);
  }
  const sv = axis + 0.05;
  b.box('zwBlued', 0.016, 0.012, 0.02, 0, axis + 0.031, 0.385, { c: 0.002 });
  b.box('zwBlued', 0.004, sv - axis - 0.022, 0.006, 0, (sv + axis) / 2 + 0.012, 0.385, { c: 0.001 });
  if (b.hi) for (const s2 of [-1, 1]) b.box('zwBlued', 0.003, 0.02, 0.016, s2 * 0.0075, sv - 0.008, 0.385, { c: 0.0006 });
  // Leitervisier: Fuß auf dem Lauf vor dem Gehäuse, Rahmen angeklappt nach vorn (Stufenteilung), Kimme hinten aufgestellt
  if (b.hi) {
    b.box('zwBlued', 0.03, 0.008, 0.036, 0, axis + 0.028, 0.13, { c: 0.0015 });
    b.front('zwBlued', [[-0.014, -0.0015], [0.014, -0.0015], [0.014, 0.0015], [-0.014, 0.0015]], 0.12, 0.148, { v: axis + 0.034, holes: [] });
    for (const s2 of [-1, 1]) b.box('zwBlued', 0.003, 0.003, 0.12, s2 * 0.0125, axis + 0.034, 0.208, { c: 0 });
    for (let i = 0; i < 7; i++) b.box('paintWhite', 0.008, 0.0005, 0.0008, 0.0, axis + 0.0358, 0.165 + i * 0.012, { c: 0 });
    b.cyl('zwPolish', 0.0024, 0.0024, 0.034, 0, axis + 0.032, 0.148, { axis: 'x', seg: 10 });
  }
  b.box('zwBlued', 0.026, 0.012, 0.024, 0, axis + 0.034, -0.05, { c: 0.002 });
  b.front('zwBlued', [[-0.012, axis + 0.038], [0.012, axis + 0.038], [0.012, sv + 0.008], [-0.012, sv + 0.008]], 0.003, -0.048, {
    holes: [[[-0.003, sv - 0.006], [0.003, sv - 0.006], [0.003, sv + 0.003], [-0.003, sv + 0.003]]], bevel: 0.0006,
  });
  // Geladene Granate (Messinghülse + Geschoss sichtbar an der Mündung)
  b.part('rocket', 0, axis, 0.41);
  b.cyl('brass', 0.0205, 0.0205, 0.03, 0, axis, 0.405, { part: 'rocket', seg: b.seg(18, 6) });
  b.lathe('paintOlive', [[0, 0.0], [0, 0.0198], [0.012, 0.0198], [0.024, 0.016], [0.032, 0.009], [0.035, 0.0]], 0, axis, 0.42, { part: 'rocket', seg: b.seg(18, 6) });
  if (b.hi) {
    b.cyl('paintYellow', 0.02, 0.02, 0.004, 0, axis, 0.428, { part: 'rocket', seg: 18 });
    b.cyl('copper', 0.0206, 0.0206, 0.003, 0, axis, 0.421, { part: 'rocket', seg: 18 });   // Führungsband
  }
  b.anchor('rocketGrab', -0.02, axis - 0.03, 0.46, { part: 'rocket', data: { w: 0.03, d: 0.034 } });
  b.anchor('magGrab', -0.02, axis - 0.03, 0.46, { part: 'rocket', data: { w: 0.03, d: 0.034 } });
  b.anchor('magWell', 0, axis, 0.41);
  b.anchor('ejection', 0, axis, 0.09);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.3, gw: 0.016, gd: 0.022, gu: 0.002, ho: 0.03, tu: 0.034 } });
  b.anchor('sight', 0, sv, -0.048, { data: { type: 'iron', eyeRelief: 0.24 } });
  b.anchor('leftHandGrip', 0, axis - 0.046, 0.22, { data: { style: 'under', w: 0.023, h: 0.013 } });
  b.meta = { sight: 'iron', axis, kind: 'launcher' };
}

/**
 * GW-6 „Trommel“ (13.11., nach dem Vorbild M32): sechsschüssiger Revolver-Granatwerfer. Trommel mit sechs Kammern und
 * Kehlungen unter der Laufachse (Teil 'mag'), Rahmen mit Oberband und Schiene, Lauf mit Vierfach-Schienen-Handschutz,
 * Senkrechtgriff, Reflexvisier mit Kuppel, Teleskop-Schaft mit Gummikappe, Trommelsperre rechts (Teil 'charge').
 */
export function trommel(b) {
  const axis = 0.072, s = b.seg(24, 8);
  const cv = axis - 0.046, cR = 0.068;            // Trommelachse und -radius
  // Rahmen: Hinterteil (Abzugsgehäuse), Oberband über der Trommel, Unterband mit Achse, Vorderteil (Laufaufnahme)
  b.front('steel', roundRect(-0.026, -0.012, 0.026, 0.1, 0.008, b.hi ? 3 : 1), 0.18, -0.09, { bevel: 0.002 });
  b.front('steel', roundRect(-0.02, 0.098, 0.02, 0.112, 0.004, b.hi ? 2 : 1), 0.42, -0.02, { bevel: 0.0015 });
  b.picatinny('alu', 0, 0.112, -0.02, 0.38);
  b.front('steel', roundRect(-0.014, cv - cR - 0.012, 0.014, cv - cR + 0.002, 0.004, b.hi ? 2 : 1), 0.33, 0.07, { bevel: 0.0015 });
  b.front('steel', roundRect(-0.03, cv - cR - 0.012, 0.03, 0.112, 0.01, b.hi ? 3 : 1), 0.045, 0.365, { bevel: 0.002 });
  if (b.hi) {
    for (const s2 of [-1, 1]) for (const u of [-0.07, 0.0, 0.38]) b.screw('steelBright', s2 * 0.0262, 0.06, u, 'x', 0.003);
    b.cyl('steelBright', 0.006, 0.006, 0.34, 0, cv, 0.215, { seg: 12 });          // Trommelachse
    b.box('paintSignal', 0.0006, 0.006, 0.006, 0.0265, 0.07, -0.05, { c: 0 });    // Sicherungsmarke
  }
  // Trommel (Teil 'mag'): Kehlungen zwischen den Kammern, sechs Kammern vorn/hinten mit Granatböden
  b.part('mag', 0, cv, 0.215);
  b.cyl('polymer', cR, cR, 0.27, 0, cv, 0.225, { part: 'mag', seg: b.seg(36, 12) });
  if (b.hi) {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6, ch = a - Math.PI / 6 + Math.PI / 2;
      b.box('cavity', 0.012, 0.004, 0.22, Math.cos(a) * (cR - 0.0005), cv + Math.sin(a) * (cR - 0.0005), 0.225, { part: 'mag', rz: a - Math.PI / 2, c: 0 });
      const cx = Math.cos(ch) * 0.045, cy = cv + Math.sin(ch) * 0.045;
      b.circle('cavity', 0.0205, cx, cy, 0.3605, { part: 'mag', seg: 20, ry: Math.PI });
      b.lathe('crown', [[-0.0009, 0.0203], [-0.0002, 0.0225]], cx, cy, 0.3608, { part: 'mag', seg: 20 });
      b.circle('brass', 0.02, cx, cy, 0.0895, { part: 'mag', seg: 20 });
      b.circle('steelBright', 0.004, cx, cy, 0.0893, { part: 'mag', seg: 12 });
    }
    b.cyl('steel', cR + 0.0015, cR + 0.0015, 0.012, 0, cv, 0.1, { part: 'mag', seg: 36 });     // Sperrkranz
    for (let i = 0; i < 6; i++) b.box('steelDark', 0.008, 0.004, 0.012, Math.cos(i * Math.PI / 3) * (cR + 0.002), cv + Math.sin(i * Math.PI / 3) * (cR + 0.002), 0.1, { part: 'mag', rz: i * Math.PI / 3 - Math.PI / 2, c: 0 });
  }
  b.anchor('magGrab', 0, cv - cR, 0.23, { part: 'mag', data: { w: 0.03, d: 0.06 } });
  b.anchor('magWell', 0, cv, 0.215);
  // Lauf mit Vierfach-Schienen-Handschutz, Mündung
  b.cyl('steelDark', 0.026, 0.026, 0.34, 0, axis, 0.58, { seg: s });
  b.lathe('steel', [[0, 0.0], [0, 0.0285], [0.02, 0.0285], [0.022, 0.027], [0.022, 0.0]], 0, axis, 0.72, { seg: s });
  b.bore(0.0205, 0, axis, 0.7425, { seg: s });
  b.anchor('muzzle', 0, axis, 0.744);
  b.front('alu', roundRect(-0.031, axis - 0.031, 0.031, axis + 0.031, 0.008, b.hi ? 3 : 1), 0.24, 0.41, { bevel: 0.002 });
  b.picatinny('alu', 0, axis + 0.031, 0.415, 0.645);
  if (b.hi) {
    for (const s2 of [-1, 1]) b.picatinny('alu', s2 * 0.031, axis, 0.425, 0.635, { rz: -s2 * Math.PI / 2 });
    for (let i = 0; i < 5; i++) for (const s2 of [-1, 1]) b.box('cavity', 0.0012, 0.012, 0.02, s2 * 0.0315, axis + 0.016, 0.44 + i * 0.045, { c: 0 });
  }
  // Reflexvisier mit Kuppel auf der Oberschiene
  const sv = 0.142;
  b.box('alu', 0.03, 0.012, 0.05, 0, 0.12, -0.0, { c: 0.002 });
  b.front('polymer', [[-0.018, 0.124], [0.018, 0.124], [0.02, 0.15], [0.012, 0.166], [-0.012, 0.166], [-0.02, 0.15]], 0.006, -0.03, { bevel: 0.001,
    holes: [[[-0.012, 0.13], [0.012, 0.13], [0.013, 0.152], [0.007, 0.16], [-0.007, 0.16], [-0.013, 0.152]]] });
  b.front('polymer', [[-0.018, 0.124], [0.018, 0.124], [0.02, 0.15], [0.012, 0.166], [-0.012, 0.166], [-0.02, 0.15]], 0.006, 0.024, { bevel: 0.001,
    holes: [[[-0.012, 0.13], [0.012, 0.13], [0.013, 0.152], [0.007, 0.16], [-0.007, 0.16], [-0.013, 0.152]]] });
  if (b.hi) {
    for (const s2 of [-1, 1]) b.box('polymer', 0.004, 0.026, 0.054, s2 * 0.019, 0.142, -0.003, { c: 0.001 });
    b.box('polymer', 0.026, 0.004, 0.054, 0, 0.165, -0.003, { c: 0.001 });
    b.plane('lensClear', 0.022, 0.026, 0, 0.144, 0.0182, { renderOrder: 2, ry: Math.PI });   // visier: außen spiegelnd, nach vorn
    b.plane('lensEye', 0.022, 0.026, 0, 0.144, 0.018, { renderOrder: 2 });
    b.cyl('polymer', 0.006, 0.006, 0.012, 0.024, 0.142, 0.0, { axis: 'x', seg: 12 });
  }
  b.torus('steel', 0.0095, 0.0022, 0, sv, -0.04, { seg: b.seg(8, 4), tseg: b.seg(20, 8) });
  b.box('steel', 0.012, sv - axis - 0.028, 0.012, 0, (sv + axis) / 2 + 0.012, 0.68, { c: 0.0015 });
  // Trommelsperre rechts (Teil 'charge')
  b.part('charge', 0.03, 0.06, 0.14);
  b.box('steelDark', 0.01, 0.012, 0.036, 0.03, 0.06, -0.06, { part: 'charge', c: 0.002 });
  if (b.hi) b.box('knurl', 0.004, 0.01, 0.026, 0.0362, 0.06, -0.06, { part: 'charge', c: 0 });
  b.anchor('chargeGrab', 0.042, 0.06, -0.052, { part: 'charge', data: { travel: [0, 0, 0.09], style: 'right' } });
  b.anchor('ejection', 0.03, axis, -0.01);
  // Griff, Bügel, Senkrechtgriff vorn
  arGrip(b, 'grip', { top: 0.0, w: 0.034 });
  triggerGuard(b, 'steel', 0.02, 0.072, 0.0, 0.028, { t: 0.005, w: 0.013, trigPos: 0.3 });
  b.side('polymer', [[0.52, axis - 0.031], [0.56, axis - 0.031], [0.557, -0.02], [0.552, -0.07], [0.542, -0.078], [0.528, -0.076], [0.52, -0.06], [0.522, -0.02]], 0.03, 0, { bevel: 0.006, bevelSeg: 2 });
  if (b.hi) for (let i = 0; i < 5; i++) b.box('rubber', 0.031, 0.006, 0.036, 0, 0.02 - i * 0.017, 0.54, { c: 0.001 });
  // Teleskop-Schaft: Puffer-Rohr, Schaftkörper mit Verriegelungshebel, Gummikappe
  b.cyl('alu', 0.015, 0.015, 0.22, 0, 0.06, -0.2, { seg: b.seg(18, 6) });
  b.side('polymer', [[-0.21, 0.09], [-0.36, 0.088], [-0.372, 0.08], [-0.372, -0.03], [-0.36, -0.042], [-0.3, -0.03], [-0.24, 0.02], [-0.21, 0.035]], 0.044, 0, { bevel: 0.006, bevelSeg: 2 });
  b.box('rubber', 0.048, 0.135, 0.016, 0, 0.026, -0.38, { c: 0.004 });
  if (b.hi) {
    b.box('polymer', 0.014, 0.008, 0.05, 0, 0.032, -0.24, { c: 0.002 });         // Verriegelungshebel
    for (let i = 0; i < 6; i++) b.box('cavity', 0.016, 0.003, 0.004, 0, 0.044, -0.13 - i * 0.012, { c: 0 }); // Raststufen
    for (let i = 0; i < 8; i++) b.box('cavity', 0.049, 0.0012, 0.0016, 0, 0.08 - i * 0.015, -0.3885, { c: 0 });
  }
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.32, gw: 0.016, gd: 0.022, gu: 0.004, ho: 0.03, tu: 0.034 } });
  b.anchor('sight', 0, sv, -0.04, { data: { type: 'iron', eyeRelief: 0.26 } });
  b.anchor('leftHandGrip', 0, -0.025, 0.54, { data: { style: 'post', rake: 0.08, gw: 0.016, gd: 0.02, gu: 0, ho: 0.03 } });
  b.meta = { sight: 'iron', axis, kind: 'shotgun' };
}
