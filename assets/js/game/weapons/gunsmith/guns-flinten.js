// Flinten nach echten Vorbildern (13.11.2026, Nutzerwunsch „Waffenmodelle anhand der echten Versionen so detailliert wie
// möglich“). Eigene Namen/Gravuren, keine Herstellerzeichen.
//   Bulldog 12 – Vorbild Remington 870 (Vorderschaftrepetierer, 18,5-Zoll-Lauf): gefrästes Stahlgehäuse mit gerundeter,
//     zum Schaft abfallender Oberseite, Auswurffenster rechts, Ladeöffnung unten, Abzugsgruppe (Alu-Bügelplatte) mit zwei
//     Haltestiften, Quer-Sicherung hinter dem Abzug, Verschlussfanghebel links vor dem Bügel, zwei Vorderschaft-Stangen,
//     Röhrenmagazin mit Kappe, Laufschelle, Perlkorn auf Laufrippe; Walnuss-Schaft und gerippter Vorderschaft mit
//     Fischhaut-Feldern, Gummikappe, Riemenösen. Hier wie bisher mit Geisterring-Visier (Polizeiausführung).
//   HF-12 Hagel – Vorbild Saiga-12 (Selbstlader nach AK-Bauart, Kastenmagazin): gestanztes Gehäuse mit Nietbild, gerippter
//     Gehäusedeckel, großer Sicherungshebel rechts, Kammerstängel am Verschlussträger, Visierfuß mit Kurvenvisier auf dem
//     vorderen Gehäuseteil, Gasblock mit 3-Stellungs-Regler, Gasrohr mit Handschutz oben, Polymer-Handschutz unten,
//     Kornfuß mit Schutzbügel, Polymer-Griff und -Schaft mit Schaftkappe, gebogenes 8-Schuss-Kastenmagazin mit Rastnase.
// Anker und Teile wie bei den Vorgängern (Pump, Ladehebel, Magazin, Patrone) – Hände/Animationen bleiben.
import { ejectionPort, engrave, triggerGuard, roundRect, qdCup } from './parts.js?v=20261113221339';
import { magRounds } from './magfill.js?v=20261113221339';

/**
 * Fischhaut: zwei Scharen diagonaler Rillen (±45°), auf das Feld u0..u1 × v0..v1 zugeschnitten, auf der Seitenfläche x.
 * Teilung p (≈ 16 Linien je Zoll beim Vorbild).
 */
export function checkering(b, x, u0, u1, v0, v1, o = {}) {
  if (!b.hi) return;
  const p = o.p ?? 0.0022, mat = o.mat ?? 'cavity';
  for (const sgn of [1, -1]) {
    // Linien v = v0 + sgn·(u − c) für c von u0 − (v1 − v0) bis u1
    for (let c = u0 - (v1 - v0); c <= u1 + (v1 - v0); c += p) {
      const pts = [];
      for (const [u, v] of [[u0, v0 + sgn * (u0 - c)], [u1, v0 + sgn * (u1 - c)]]) if (v >= v0 && v <= v1) pts.push([u, v]);
      for (const v of [v0, v1]) { const u = c + sgn * (v - v0); if (u >= u0 && u <= u1) pts.push([u, v]); }
      if (pts.length < 2) continue;
      pts.sort((a, b2) => a[0] - b2[0]);
      const [a, e] = [pts[0], pts[pts.length - 1]];
      const len = Math.hypot(e[0] - a[0], e[1] - a[1]);
      if (len < 0.002) continue;
      b.box(mat, 0.0005, 0.0006, len, x, (a[1] + e[1]) / 2, (a[0] + e[0]) / 2, { part: o.part, rx: sgn * Math.PI / 4, c: 0 });
    }
  }
}

/* ------------------------------------------------------------------ Bulldog 12 (Vorbild Remington 870) */

export function bulldog(b) {
  const axis = 0.06;
  // Gehäuse: Seitenprofil mit gerundeter Front, langer Oberseite und zum Schaft abfallendem Heck
  b.side('steelDark', [
    [-0.072, 0.016], [0.154, 0.016], [0.156, 0.07], [0.15, 0.081], [0.136, 0.086], [-0.02, 0.087], [-0.05, 0.084], [-0.066, 0.076], [-0.072, 0.066],
  ], 0.037, 0, { bevel: 0.0045, bevelSeg: 3 });
  b.box('steelDark', 0.012, 0.004, 0.17, 0, 0.0875, 0.05, { c: 0.001 });                                     // Mattierte Rille oben (Visierlinie)
  ejectionPort(b, 0.0185, 0.058, 0.085, 0.072, 0.025, 'steelDark');
  if (b.hi) {
    b.box('cavity', 0.023, 0.002, 0.065, 0, 0.0155, 0.09, { c: 0 });                                         // Ladeöffnung
    b.box('steelBright', 0.012, 0.002, 0.04, 0, 0.0158, 0.085, { c: 0 });                                     // Patronenheber
    // Haltestifte der Abzugsgruppe (beidseitig), Verschlussfanghebel links, Gravur rechts
    for (const s of [-1, 1]) for (const u of [-0.046, 0.032]) b.cyl('steelBright', 0.0032, 0.0032, 0.0385, 0, 0.026, u, { axis: 'x', seg: 14 });
    b.side('steelDark', [[0.064, 0.012], [0.084, 0.014], [0.086, 0.02], [0.07, 0.021]], 0.003, -0.0198, { bevel: 0.0005 });
    engrave(b, 0.0187, 0.05, -0.04, ['BULLDOG 12', '12 GA 3" MAG'], { dir: 1, mat: 'steelBright' });
  }
  b.anchor('shellPort', 0, 0.012, 0.09);
  // Abzugsgruppe: Alu-Bügelplatte + Bügel + Abzug + Quersicherung
  b.side('alu', [[-0.054, 0.018], [0.064, 0.018], [0.068, 0.006], [-0.034, 0.006]], 0.031, 0, { bevel: 0.002 });
  b.side('alu', [[0.0, 0.008], [0.0, -0.014], [0.012, -0.025], [0.055, -0.025], [0.067, -0.01], [0.067, 0.008], [0.061, 0.008], [0.059, -0.008], [0.05, -0.019], [0.014, -0.019], [0.006, -0.01], [0.006, 0.008]], 0.0125, 0, { bevel: 0.0014 });
  b.side('steel', [[0.024, 0.008], [0.027, -0.004], [0.022, -0.018], [0.018, -0.016], [0.021, -0.004], [0.02, 0.008]], 0.0065, 0, { bevel: 0.0008 });
  if (b.hi) {
    b.cyl('steel', 0.0035, 0.0035, 0.034, 0, 0.0115, 0.002, { axis: 'x', seg: 14 });
    b.cyl('paintSignal', 0.0036, 0.0036, 0.002, -0.016, 0.0115, 0.002, { axis: 'x', seg: 14 });               // roter Ring = entsichert
  }
  // Walnuss-Schaft mit halbem Pistolengriff, Fischhaut am Griff, Riemenöse, Gummikappe mit Distanzplatte
  b.side('woodWalnut', [
    [-0.068, 0.078], [-0.12, 0.068], [-0.26, 0.062], [-0.4, 0.059], [-0.404, 0.053], [-0.404, -0.08], [-0.39, -0.085],
    [-0.3, -0.062], [-0.18, -0.032], [-0.1, -0.016], [-0.066, -0.032], [-0.046, -0.048], [-0.024, -0.05], [-0.008, -0.027],
    [0.0, 0.0], [-0.008, 0.016], [-0.068, 0.018],
  ], 0.041, 0, { bevel: 0.01, bevelSeg: 3 });
  for (const s of [-1, 1]) checkering(b, s * 0.0207, -0.052, -0.012, -0.036, 0.008);
  b.side('polymer', [[-0.404, 0.06], [-0.408, 0.06], [-0.408, -0.086], [-0.404, -0.086]], 0.044, 0, { bevel: 0.001 });
  b.side('rubber', [[-0.408, 0.06], [-0.426, 0.06], [-0.43, 0.046], [-0.43, -0.084], [-0.422, -0.096], [-0.408, -0.092]], 0.045, 0, { bevel: 0.005, bevelSeg: 2 });
  if (b.hi) {
    b.box('polymer', 0.03, 0.006, 0.022, 0, -0.062, -0.036, { rx: 0.5, c: 0.002 });
    b.cyl('steel', 0.0052, 0.0052, 0.004, 0, -0.068, -0.33, { axis: 'v', seg: 12 });
    b.torus('steel', 0.009, 0.0016, 0, -0.078, -0.33, { ry: Math.PI / 2, seg: 6, tseg: 16 });
    for (const s of [-1, 1]) b.screw('steel', s * 0.0228, 0.0, -0.418, 'x', 0.0024);
  }
  // Lauf mit Laufrippe + Perlkorn, Würgebohrung
  b.cyl('steelDark', 0.0118, 0.0118, 0.47, 0, axis, 0.387, { seg: b.seg(24, 6) });
  b.box('steelDark', 0.008, 0.003, 0.46, 0, axis + 0.026, 0.385, { c: 0.0008 });
  for (let i = 0; i < (b.hi ? 14 : 2); i++) b.box('steelDark', 0.004, 0.014, 0.005, 0, axis + 0.018, 0.17 + i * (b.hi ? 0.032 : 0.42), { c: 0 });
  if (b.hi) b.lathe('steelDark', [[0, 0.0118], [0.002, 0.0124], [0.014, 0.0124], [0.016, 0.0118]], 0, axis, 0.6, { seg: 24 });
  // Geisterring-Visier (Polizeiausführung): Schutzohren, Ring, Korn mit Leuchtpunkt
  const sl = 0.106;
  b.box('steelDark', 0.03, 0.008, 0.034, 0, 0.09, -0.012, { c: 0.002 });
  for (const s of [-1, 1]) b.side('steelDark', [[-0.026, 0.094], [0.002, 0.094], [0.0, 0.117], [-0.018, 0.117]], 0.004, s * 0.0118, { bevel: 0.0008 });
  b.box('steelDark', 0.006, 0.012, 0.006, 0, 0.0975, -0.012, { c: 0.001 });
  b.torus('steelDark', 0.0062, 0.0021, 0, sl, -0.012, { seg: b.seg(8, 4), tseg: b.seg(18, 8) });
  if (b.hi) for (const s of [-1, 1]) b.screw('steel', s * 0.0152, 0.09, -0.012, 'x', 0.0014);
  b.box('steelDark', 0.016, 0.026, 0.02, 0, axis + 0.024, 0.58, { c: 0.002 });
  for (const s of [-1, 1]) b.side('steelDark', [[0.572, axis + 0.034], [0.59, axis + 0.034], [0.588, sl + 0.006], [0.576, sl + 0.006]], 0.0028, s * 0.0075, { bevel: 0.0006 });
  b.box('steelDark', 0.0032, sl - axis - 0.036, 0.004, 0, (sl + axis + 0.036) / 2, 0.582, { c: 0.0006 });
  b.sphere('glowAmber', 0.0012, 0, sl - 0.0005, 0.5795, { seg: 8, hseg: 6 });
  b.bore(0.0095, 0, axis, 0.6225);
  b.anchor('muzzle', 0, axis, 0.623);
  // Röhrenmagazin mit Kappe (Rastkerben, Riemenöse), Laufschelle
  b.cyl('steel', 0.0112, 0.0112, 0.4, 0, axis - 0.025, 0.352, { seg: b.seg(20, 6) });
  b.lathe('steelDark', [[0, 0.0122], [0.003, 0.0128], [0.024, 0.0128], [0.028, 0.0112], [0.03, 0.006], [0.03, 0]], 0, axis - 0.025, 0.552, { seg: b.seg(20, 6) });
  if (b.hi) {
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; b.box('cavity', 0.0012, 0.0016, 0.018, Math.cos(a) * 0.0128, axis - 0.025 + Math.sin(a) * 0.0128, 0.565, { rz: a, c: 0 }); }
    b.torus('steel', 0.006, 0.0014, 0, axis - 0.025, 0.586, { seg: 6, tseg: 14 });
  }
  b.box('steel', 0.016, 0.04, 0.014, 0, axis - 0.012, 0.535, { c: 0.003 });
  if (b.hi) b.screw('steel', 0.0082, axis - 0.012, 0.535, 'x', 0.002);
  // Vorderschaft (Walnuss, gerippt) – animiert, mit Vorderschaftstangen
  b.part('pump', 0, axis - 0.022, 0.3);
  const ribs = [[0, 0.0135], [0.005, 0.021]];
  const nR = b.hi ? 13 : 2, L = 0.19;
  for (let i = 0; i < nR; i++) { const u = 0.014 + i * (L / nR); ribs.push([u, 0.024], [u + L / nR * 0.55, 0.024], [u + L / nR * 0.78, 0.0222]); }
  ribs.push([L + 0.012, 0.022], [L + 0.018, 0.0135]);
  b.lathe('woodWalnut', ribs, 0, axis - 0.022, 0.205, { part: 'pump', seg: b.seg(24, 6), sx: 0.92, sy: 1.08 });
  for (const s of [-1, 1]) {
    b.box('steel', 0.0028, 0.006, 0.17, s * 0.0127, axis - 0.03, 0.15, { part: 'pump', c: 0.0008 });
    if (b.hi) b.box('steelBright', 0.0006, 0.002, 0.16, s * 0.0141, axis - 0.03, 0.15, { part: 'pump', c: 0 });
  }
  if (b.hi) b.cyl('steel', 0.0095, 0.0095, 0.008, 0, axis - 0.022, 0.402, { part: 'pump', seg: 16 });       // Vorderschaftmutter
  b.anchor('pumpGrab', 0, axis - 0.048, 0.3, { part: 'pump', data: { travel: [0, 0, 0.085] } });
  // Einzelne Patrone für die Ladeanimation (standardmäßig verborgen)
  b.part('shell', 0, 0.012, 0.09);
  b.cyl('shellRed', 0.0105, 0.0105, 0.055, 0, 0.012, 0.09, { part: 'shell', seg: b.seg(14, 5) });
  b.cyl('brass', 0.0109, 0.0109, 0.013, 0, 0.012, 0.059, { part: 'shell', seg: b.seg(14, 5) });
  b.anchor('rightHandGrip', 0, -0.014, -0.03, { data: { rake: 0.5, gw: 0.02, gd: 0.022, gu: 0.0, ho: 0.03, tu: 0.04 } });
  b.anchor('trigger', 0, -0.008, 0.02);
  b.anchor('sight', 0, sl, -0.012, { data: { type: 'iron', eyeRelief: 0.26 } });
  b.anchor('leftHandGrip', 0, axis - 0.048, 0.3, { part: 'pump', data: { style: 'pump', w: 0.0216, h: 0.0254 } });
  b.meta = { sight: 'iron', axis, kind: 'shotgun', hidden: ['shell'] };
}

/* ------------------------------------------------------------------ HF-12 Hagel (Vorbild Saiga-12) */

export function hagel(b) {
  const axis = 0.07;
  // Gestanztes Gehäuse (AK-Bauart): Seitenwand mit Magazinschacht-Ausbuchtung, Nietbild, Versteifungsmulde
  b.front('steel', roundRect(-0.0215, 0.028, 0.0215, 0.084, 0.004, b.hi ? 2 : 1), 0.31, -0.095, { bevel: 0.0015 });
  // Gehäusedeckel: oben gerundet, Querrippen hinten
  b.front('steel', roundRect(-0.0205, 0.078, 0.0205, 0.095, 0.009, b.hi ? 4 : 1), 0.26, -0.09, { bevel: 0.001 });
  if (b.hi) {
    for (let i = 0; i < 4; i++) b.box('steel', 0.042, 0.0016, 0.004, 0, 0.0952, -0.07 + i * 0.008, { c: 0 });
    b.box('steelDark', 0.012, 0.006, 0.012, 0, 0.09, -0.098, { c: 0.001 });                                // Deckelknopf
    for (const s of [-1, 1]) {
      // Nieten (Abzugsgruppe, Magazinschacht, Laufbuchse), Versteifungsmulde über dem Schacht
      for (const [v, u] of [[0.038, -0.07], [0.038, -0.05], [0.038, 0.17], [0.05, 0.17], [0.062, 0.17], [0.038, 0.19], [0.05, 0.19], [0.036, 0.09], [0.036, 0.15]]) b.sphere('steel', 0.0022, s * 0.0215, v, u, { sx: 0.4, seg: 8, hseg: 6 });
      b.box('cavity', 0.0008, 0.006, 0.07, s * 0.0217, 0.072, 0.12, { c: 0 });
      // Abzugs- und Hahnachse
      for (const u of [-0.005, 0.03]) b.cyl('steelBright', 0.0024, 0.0024, 0.0435, 0, 0.044, u, { axis: 'x', seg: 12 });
    }
    engrave(b, -0.0217, 0.064, 0.0, ['HF-12  CAL 12/76', 'NP 1983 0042'], { dir: 1, mat: 'steelBright' });
  }
  // Sicherungshebel rechts (großer Blechhebel mit Fingerauflage)
  b.side('steel', [[-0.085, 0.07], [0.12, 0.074], [0.12, 0.082], [-0.06, 0.082], [-0.08, 0.09], [-0.09, 0.084]], 0.002, 0.0225, { bevel: 0.0004 });
  if (b.hi) b.side('steel', [[-0.08, 0.05], [-0.07, 0.05], [-0.072, 0.074], [-0.082, 0.074]], 0.002, 0.0228, { bevel: 0.0004 });
  // Visierfuß + Kurvenvisier (Blatt mit Schieber) auf dem vorderen Gehäuseteil – Visierlinie sv
  const sv = 0.115, su = 0.235;
  b.side('steel', [[0.2, 0.084], [0.28, 0.084], [0.28, 0.096], [0.25, 0.1], [0.2, 0.098]], 0.03, 0, { bevel: 0.002 });
  b.side('steel', [[0.205, 0.098], [0.275, 0.101], [0.275, 0.106], [0.205, 0.106]], 0.022, 0, { bevel: 0.001 });
  b.box('steel', 0.022, 0.008, 0.012, 0, sv - 0.004, su, { c: 0.001 });
  if (b.hi) {
    b.box('cavity', 0.0024, 0.003, 0.013, 0, sv - 0.0003, su, { c: 0 });                                  // Kimme
    b.box('steel', 0.026, 0.006, 0.008, 0, 0.108, 0.25, { c: 0.001 });                                     // Schieber
    for (let i = 0; i < 6; i++) b.box('paintWhite', 0.0004, 0.0008, 0.002, 0.0112, 0.104, 0.215 + i * 0.008, { c: 0 });
  }
  // Lauf, Gasblock mit Regler, Gasrohr, Handschutz oben/unten (Polymer), Kornfuß mit Schutz, Würgehülse
  b.cyl('steelDark', 0.0122, 0.0122, 0.42, 0, axis, 0.5, { seg: b.seg(24, 6) });
  b.side('steelDark', [[0.43, axis - 0.014], [0.47, axis - 0.014], [0.47, axis + 0.04], [0.455, axis + 0.044], [0.43, axis + 0.042]], 0.026, 0, { bevel: 0.002 });
  if (b.hi) { b.cyl('steel', 0.0072, 0.0072, 0.006, 0.014, axis + 0.026, 0.45, { axis: 'x', seg: 12 }); for (let i = 0; i < 3; i++) b.box('paintWhite', 0.0005, 0.0006, 0.002, 0.0172, axis + 0.033, 0.443 + i * 0.006, { c: 0 }); }
  b.cyl('steel', 0.0095, 0.0095, 0.16, 0, axis + 0.026, 0.355, { seg: b.seg(18, 6) });
  b.side('polymer', [[0.275, axis + 0.016], [0.43, axis + 0.016], [0.43, axis + 0.038], [0.42, axis + 0.044], [0.285, axis + 0.044], [0.275, axis + 0.038]], 0.034, 0, { bevel: 0.006, bevelSeg: 2 });
  b.side('polymer', [[0.215, 0.094 - 0.064], [0.43, 0.034], [0.432, 0.06], [0.425, 0.068], [0.22, 0.068], [0.212, 0.06]], 0.05, 0, { bevel: 0.008, bevelSeg: 2 });
  if (b.hi) {
    for (let i = 0; i < 7; i++) for (const s of [-1, 1]) b.box('cavity', 0.0012, 0.012, 0.016, s * 0.0248, 0.05, 0.24 + i * 0.026, { c: 0 });
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.box('cavity', 0.0012, 0.006, 0.02, s * 0.0168, axis + 0.03, 0.3 + i * 0.03, { c: 0 });
    // Handschutzhalter (Blech) vorn und hinten mit Hebel
    b.box('steel', 0.052, 0.04, 0.008, 0, 0.05, 0.212, { c: 0.001 });
    b.box('steel', 0.034, 0.028, 0.008, 0, axis - 0.004, 0.432, { c: 0.001 });
    b.side('steel', [[0.2, 0.054], [0.212, 0.054], [0.21, 0.07], [0.2, 0.068]], 0.002, 0.0262, { bevel: 0.0004 });
  }
  b.box('steel', 0.014, 0.024, 0.024, 0, axis + 0.006, 0.66, { c: 0.002 });
  b.box('steel', 0.012, sv - axis - 0.018, 0.012, 0, (sv + axis + 0.018) / 2 - 0.002, 0.67, { c: 0.0015 });
  b.box('steel', 0.0028, 0.01, 0.003, 0, sv - 0.005, 0.672, { c: 0 });
  b.box('glowAmber', 0.003, 0.003, 0.003, 0, sv - 0.0015, 0.672, { c: 0 });
  if (b.hi) for (const s of [-1, 1]) b.side('steel', [[0.664, axis + 0.018], [0.68, axis + 0.018], [0.68, sv + 0.002], [0.672, sv + 0.006], [0.664, sv + 0.002]], 0.0022, s * 0.0085, { bevel: 0.0004 });
  b.cyl('steelDark', 0.0148, 0.0148, 0.05, 0, axis, 0.7, { seg: b.seg(24, 6) });
  if (b.hi) for (let i = 0; i < 6; i++) for (const s of [-1, 1]) b.box('cavity', 0.004, 0.005, 0.009, s * 0.0138, axis, 0.684 + i * 0.006, { c: 0 });
  b.bore(0.0095, 0, axis, 0.7255);
  b.anchor('muzzle', 0, axis, 0.727);
  // Kammerstängel am Verschlussträger (rechts, im Schlitz des Gehäuses)
  b.part('charge', 0.024, 0.06, 0.14);
  b.box('steel', 0.01, 0.01, 0.034, 0.024, 0.06, 0.14, { part: 'charge', c: 0.002 });
  b.lathe('steel', [[0, 0], [0, 0.0055], [0.012, 0.0062], [0.018, 0.0045], [0.018, 0]], 0.03, 0.06, 0.148, { part: 'charge', axis: 'x', seg: b.seg(14, 5) });
  b.anchor('chargeGrab', 0.042, 0.06, 0.148, { part: 'charge', data: { travel: [0, 0, 0.085], style: 'right' } });
  ejectionPort(b, 0.0215, 0.066, 0.06, 0.07, 0.024);
  b.part('bolt', 0, 0.066, 0.06);
  b.box('steelBright', 0.004, 0.018, 0.06, 0.018, 0.066, 0.06, { part: 'bolt', c: 0.001 });
  // AK-Griff (Polymer, gerippt), Bügel mit Abzug, Polymer-Schaft mit Schaftkappe und Riemenöse
  b.side('polymer', [[0.012, 0.03], [0.002, -0.02], [-0.008, -0.07], [-0.012, -0.092], [-0.034, -0.095], [-0.042, -0.086], [-0.036, -0.04], [-0.026, 0.0], [-0.02, 0.03]], 0.03, 0, { bevel: 0.006, bevelSeg: 2 });
  if (b.hi) for (let i = 0; i < 8; i++) for (const s of [-1, 1]) b.box('cavity', 0.0008, 0.002, 0.026, s * 0.0152, -0.08 + i * 0.012, -0.014, { rx: 0.2, c: 0 });
  triggerGuard(b, 'steel', 0.02, 0.078, 0.03, 0.03, { t: 0.0035, w: 0.012, trigPos: 0.3 });
  b.side('polymer', [
    [-0.09, 0.088], [-0.35, 0.084], [-0.36, 0.08], [-0.36, -0.03], [-0.35, -0.038], [-0.28, -0.026], [-0.18, 0.004], [-0.11, 0.028], [-0.09, 0.032],
  ], 0.038, 0, { bevel: 0.006, bevelSeg: 2 });
  b.side('rubber', [[-0.36, 0.086], [-0.374, 0.086], [-0.378, 0.078], [-0.378, -0.032], [-0.372, -0.042], [-0.36, -0.04]], 0.042, 0, { bevel: 0.004 });
  if (b.hi) {
    b.box('steel', 0.0398, 0.008, 0.012, 0, 0.088, -0.095, { c: 0.001 });                                // Schaftbefestigung (Blech)
    for (const s of [-1, 1]) b.screw('steel', s * 0.0195, 0.05, -0.33, 'x', 0.0024);
    qdCup(b, -0.0195, 0.06, -0.3);
    for (let i = 0; i < 5; i++) b.box('cavity', 0.043, 0.002, 0.004, 0, -0.025 + i * 0.022, -0.379, { c: 0 });
  }
  // Kastenmagazin (8 Patronen Kaliber 12, leicht gebogen) mit Rastnase vorn und Bodenplatte
  b.part('mag', 0, 0.02, 0.12);
  b.side('polymer', [[0.09, 0.038], [0.092, -0.04], [0.1, -0.13], [0.17, -0.142], [0.164, -0.04], [0.156, 0.038]], 0.036, 0, { part: 'mag', bevel: 0.0025 });
  b.box('polymer', 0.04, 0.01, 0.074, 0, -0.14, 0.136, { part: 'mag', rx: -0.17, c: 0.003 });
  if (b.hi) {
    for (const s of [-1, 1]) {
      b.box('polymer', 0.002, 0.11, 0.004, s * 0.0182, -0.05, 0.126, { part: 'mag', rx: -0.1, c: 0 });
      for (let i = 0; i < 3; i++) b.box('polymer', 0.0018, 0.004, 0.05, s * 0.0185, -0.09 + i * 0.03, 0.13, { part: 'mag', rx: -0.12, c: 0 });
    }
    b.box('polymer', 0.014, 0.008, 0.008, 0, 0.032, 0.16, { part: 'mag', c: 0.001 });                    // Rastnase vorn
  }
  magRounds(b, { cal: 'g12', width: 0.033, depth: 0.066, path: [[0, 0.033, 0.123], [0, -0.04, 0.128], [0, -0.11, 0.132]] });
  b.anchor('magGrab', 0, -0.07, 0.13, { part: 'mag', data: { w: 0.019, d: 0.032 } });
  b.anchor('magWell', 0, 0.02, 0.12);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.32, gw: 0.016, gd: 0.022, gu: 0.004, ho: 0.03, tu: 0.034 } });
  // Visier: Kimme am Kurvenvisier, Augenabstand so, dass die Waffe im Anschlag an derselben Stelle liegt wie bisher
  b.anchor('sight', 0, sv, su, { data: { type: 'iron', eyeRelief: 0.27 + su + 0.04 } });
  b.anchor('leftHandGrip', 0, 0.03, 0.33, { data: { style: 'under', w: 0.025, h: 0.022 } });
  b.meta = { sight: 'iron', axis, kind: 'shotgun' };
}
