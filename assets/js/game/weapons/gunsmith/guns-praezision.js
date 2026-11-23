// Präzisionswaffen nach echten Vorbildern (13.11.2026, Nutzerwunsch „Waffenmodelle anhand der echten Versionen so detailliert wie
// möglich“). Eigene Namen und Gravuren, keine Herstellerzeichen.
//   Brecher .338 – Vorbild Accuracy International AWM (.338 Lapua Magnum): Aluminium-Chassis mit zwei Polymer-Schalen
//     (Daumenloch-Schaft, Klappschaft-Gelenk hinter dem Griff), Rundsystem mit 3-Warzen-Verschluss und langem, nach hinten
//     gebogenem Kammerstängel, 5-Schuss-Kastenmagazin mit Halteklinke vor dem Bügel, kannelierter 27-Zoll-Lauf (686 mm) mit
//     zylindrischer Mündungsbremse (je Seite 2 × 3 Fenster), Zweibein am Vorderschaft, Einbein und verstellbare Wangenauflage
//     und Schaftkappe. Gesamtlänge Vorbild 1230 mm (hier 1,30 m mit Bremse, Spielmaß wie bisher – Hände/Haltung bleiben).
//   Titan .50 – Vorbild Barrett M82A1 (.50 BMG): Rückstoßlader mit langem Oberteil aus Stahlblech (Verstärkungssicken,
//     Kühllöcher vorn), Unterteil mit Griff, Bügel und 10-Schuss-Magazin, Schaft mit dickem Rückstoßpolster, hinterer Griff
//     und Einbein, Pfeilspitzen-Mündungsbremse (Doppelkammer, V-Form von oben), kannelierter 29-Zoll-Lauf (737 mm),
//     Tragegriff oben, Zweibein vorn am Oberteil (nach vorn geklappt), großer Spannhebel rechts. Gesamtlänge Vorbild 1448 mm.
//   Zielfernrohr (beide): taktisches 5–25 × 56 mit 34-mm-Mittelrohr – Okular mit Dioptrienring, Vergrößerungsring mit
//     Wurfhebel, Turmsattel mit Höhen-/Seitenturm (Strichteilung), links Parallaxe + Leuchtabsehen, Objektivglocke 56 mm mit
//     mehrlagiger, vergüteter Linse (dunkle Tiefe + spiegelnde Deckschicht + Fassungsring) und Sonnenblende.
// Anker, Teile und Maße der Haltung (rightHandGrip, leftHandGrip, magWell, Visier) wie bei den Vorgängern – Hände, Nachladen
// und Zielen bleiben unverändert.
import { swapOptic, ejectionPort, roundRect, engrave, qdCup, triggerGuard, arGrip, muzzleDevice } from './parts.js?v=20261123082814';
import { magRounds } from './magfill.js?v=20261123082814';
import { schrift } from './schrift.js?v=20261123082814';   // Gravuren (14.11., gfx-waffen)
const MARK_BRECHER = schrift('brecher').mark;
const MARK_TITAN = schrift('titan').mark;

/* ------------------------------------------------------------------ Zielfernrohr 5–25 × 56 */

/** Vergütete Linse: dunkle Tiefe, spiegelnde Deckschicht und Fassung. dir = +1 Objektiv (vorn), −1 Okular. */
function coatedLens(b, r, axis, u, dir) {
  // visier (14.11.): Objektiv (dir +1) zeigt nach vorn, Okular nach hinten – einseitige Linsen statt DoubleSide
  const ry = dir > 0 ? Math.PI : 0;
  b.circle('lens', r, 0, axis, u - dir * 0.006, { seg: b.seg(32, 10), ry });
  if (!b.hi) return;
  b.circle('lensClear', r * 0.995, 0, axis, u - dir * 0.0015, { seg: 32, ry });
  // Innenwand zwischen Deckglas und Linse (schwarz eloxiert) + Fassungsring mit feiner Fase
  b.cyl('cavity', r, r, 0.006, 0, axis, u - dir * 0.0035, { seg: 32, open: true });
  b.lathe('crown', [[0, r * 0.99], [dir * 0.0006, r * 1.04]], 0, axis, u, { seg: 32 });
}

export function precisionScope(b, u0, railTop) {
  const sw = swapOptic(b, 'zielfernrohr', u0, railTop); if (sw !== null) return sw;
  const axis = railTop + 0.046;
  const L = 0.36;
  const seg = b.seg(32, 8);
  // Rohrkörper (u von hinten nach vorn): Okular mit Dioptrienring → Vergrößerungsring → 34-mm-Rohr → Objektivglocke
  b.lathe('alu', [
    [0, 0], [0, 0.0215], [0.002, 0.0226], [0.05, 0.0226], [0.056, 0.021], [0.062, 0.019], [0.088, 0.0185], [0.094, 0.017],
    [0.25, 0.017], [0.262, 0.018], [0.292, 0.0296], [0.3, 0.0312], [0.338, 0.0312], [0.341, 0.0298], [L, 0.0298], [L, 0.026],
  ], 0, axis, u0, { seg });
  if (b.hi) {
    // Dioptrienring (Rändel) und Gummi-Augenmuschel
    b.cyl('knurl', 0.0232, 0.0232, 0.016, 0, axis, u0 + 0.03, { seg: 32 });
    b.lathe('rubber', [[0, 0.0205], [0, 0.0236], [-0.012, 0.0238], [-0.014, 0.0222], [-0.014, 0.0196]], 0, axis, u0, { seg: 32 });
    // Vergrößerungsring: Rippen + Wurfhebel + Skala (weiße Striche)
    b.cyl('rubber', 0.0198, 0.0198, 0.022, 0, axis, u0 + 0.075, { seg: 32 });
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; b.box('rubber', 0.002, 0.0016, 0.02, Math.cos(a) * 0.0205, axis + Math.sin(a) * 0.0205, u0 + 0.075, { rz: a + Math.PI / 2, c: 0 }); }
    b.box('alu', 0.0045, 0.014, 0.008, 0.021, axis + 0.009, u0 + 0.075, { rz: -0.6, c: 0.001 });
    for (let i = 0; i < 6; i++) b.box('paintWhite', 0.0004, 0.0008, 0.003, 0, axis + 0.0187, u0 + 0.062 + i * 0.0045, { c: 0 });
  }
  // Turmsattel mit Höhenturm (oben), Seitenturm (rechts), Parallaxe/Leuchtabsehen (links)
  const tu = u0 + 0.16;
  b.box('alu', 0.042, 0.042, 0.062, 0, axis, tu, { r: b.hi ? 0.01 : 0 });
  const turret = (x, v, ax, h, r) => {
    const o = ax === 'v' ? [0, v + h / 2, tu] : [x + Math.sign(x) * h / 2, axis, tu];
    b.cyl('alu', r * 0.82, r * 0.82, h * 0.4, o[0] - (ax === 'x' ? Math.sign(x) * h * 0.3 : 0), o[1] - (ax === 'v' ? h * 0.3 : 0), o[2], { axis: ax, seg: b.seg(24, 8) });
    b.cyl('knurl', r, r, h * 0.6, o[0] + (ax === 'x' ? Math.sign(x) * h * 0.2 : 0), o[1] + (ax === 'v' ? h * 0.2 : 0), o[2], { axis: ax, seg: b.seg(28, 8) });
    if (!b.hi) return;
    // Strichteilung um den Turm (jede 5. lang), Nullmarke rot
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n, long = i % 5 === 0, len = long ? h * 0.32 : h * 0.18;
      const ca = Math.cos(a) * (r + 0.0002), sa = Math.sin(a) * (r + 0.0002);
      if (ax === 'v') b.box(i === 0 ? 'paintSignal' : 'paintWhite', 0.0006, len, 0.0006, ca, v + h - len / 2 - 0.001, tu + sa, { c: 0 });
      else b.box(i === 0 ? 'paintSignal' : 'paintWhite', len, 0.0006, 0.0006, x + Math.sign(x) * (h - len / 2 - 0.001), axis + ca, tu + sa, { c: 0 });
    }
    // Deckel mit Riffelrand
    if (ax === 'v') b.cyl('alu', r * 0.9, r * 0.9, 0.0025, 0, v + h + 0.0012, tu, { axis: 'v', seg: 28 });
    else b.cyl('alu', r * 0.9, r * 0.9, 0.0025, x + Math.sign(x) * (h + 0.0012), axis, tu, { axis: 'x', seg: 28 });
  };
  turret(0, axis + 0.02, 'v', 0.028, 0.0155);
  turret(0.02, axis, 'x', 0.024, 0.0145);
  turret(-0.02, axis, 'x', 0.022, 0.0165);
  if (b.hi) {
    b.cyl('paintSignal', 0.006, 0.006, 0.002, -0.045, axis, tu, { axis: 'x', seg: 16 });                      // Leuchtabsehen
    engrave(b, 0.0215, axis - 0.012, tu + 0.05, ['5-25X56'], { dir: 1, mat: 'paintWhite', h: 0.0022, cw: 0.0013 });
  }
  // Objektivglocke: Sonnenblende vorn, Linsen hinten und vorn
  b.lathe('alu', [[0, 0.0298], [0, 0.0312], [0.05, 0.031], [0.05, 0.0292]], 0, axis, u0 + L - 0.0005, { seg });
  coatedLens(b, 0.0278, axis, u0 + L + 0.0495, 1);
  coatedLens(b, 0.0196, axis, u0 - 0.013, -1);
  // 34-mm-Ringe (je 4 Schrauben, Klemmbasis mit Querbolzen) + Montagebasis
  for (const du of [0.115, 0.215]) {
    const u = u0 + du;
    b.cyl('alu', 0.0212, 0.0212, 0.018, 0, axis, u, { seg: b.seg(24, 6) });
    b.box('alu', 0.03, axis - railTop - 0.016, 0.018, 0, railTop + (axis - railTop - 0.016) / 2 + 0.002, u, { c: 0.002 });
    b.box('alu', 0.036, 0.008, 0.018, 0, railTop + 0.006, u, { c: 0.0015 });
    if (b.hi) {
      for (const s of [-1, 1]) for (const dv of [-0.006, 0.006]) b.screw('steel', s * 0.0215, axis + dv, u, 'x', 0.0016);
      b.cyl('steel', 0.0028, 0.0028, 0.044, 0, railTop + 0.006, u, { axis: 'x', seg: 10 });
      b.cyl('steel', 0.0048, 0.0048, 0.004, 0.021, railTop + 0.006, u, { axis: 'x', seg: 6 });            // Mutter
    }
  }
  b.anchor('sight', 0, axis, u0 - 0.02, { data: { type: 'sniper', eyeRelief: 0.09 } });
  return axis;
}

/* ------------------------------------------------------------------ Hilfen */

/** Kannelierter Lauf: konische Grundform + n Längsnuten. */
function flutedBarrel(b, mat, r0, r1, u0, u1, axis, n, f0, f1) {
  const l = u1 - u0;
  b.cyl(mat, r1, r0, l, 0, axis, (u0 + u1) / 2, { seg: b.seg(24, 8) });
  if (!b.hi) return;
  const rm = (r0 + r1) / 2;
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n + Math.PI / n;
    b.box('cavity', rm * 0.42, 0.0014, (f1 - f0), Math.cos(a) * (rm - 0.0004), axis + Math.sin(a) * (rm - 0.0004), (f0 + f1) / 2, { rz: a + Math.PI / 2, c: 0 });
  }
}

/* ------------------------------------------------------------------ Brecher .338 (Vorbild AWM) */

export function brecher(b) {
  // Gravuren: Typ/Kaliber/Nummer (Fantasie), eingeschnitten (schrift.js)
  MARK_BRECHER(b, 'BRECHER  .338', -(0.0178 + 0.0003), 0.074, 0.0, 0.0032);
  const axis = 0.074;
  // Chassis-Schalen (oliv, Polymer) – Daumenloch, Bügelöffnung, Gelenk hinter dem Griff (Trennfuge)
  const outer = [
    [0.40, 0.056], [0.40, 0.016], [0.388, -0.004], [0.14, -0.01], [0.134, -0.024], [0.072, -0.024], [0.068, -0.05],
    [0.056, -0.06], [0.032, -0.058], [0.024, -0.066], [0.014, -0.088], [0.0, -0.1], [-0.044, -0.1], [-0.1, -0.084],
    [-0.33, -0.066], [-0.43, -0.08], [-0.462, -0.086], [-0.47, -0.072], [-0.47, 0.084], [-0.455, 0.098], [-0.3, 0.104],
    [-0.13, 0.098], [-0.098, 0.078], [-0.07, 0.054],
  ];
  const thumb = [[-0.034, 0.03], [-0.07, 0.036], [-0.105, 0.024], [-0.118, -0.016], [-0.104, -0.058], [-0.054, -0.066], [-0.034, -0.048], [-0.026, -0.004]];
  const guard = [[0.062, -0.012], [0.062, -0.046], [0.05, -0.052], [0.034, -0.05], [0.03, -0.024], [0.036, -0.012]];
  b.side('polymerOD', outer, 0.054, 0, { holes: [thumb, guard], bevel: 0.008, bevelSeg: b.hi ? 3 : 1 });
  // Aluminium-Mittelteil (Chassis) zwischen den Schalen: sichtbar als Streifen oben und am Vorderschaft
  b.box('aluOD', 0.044, 0.012, 0.52, 0, 0.05, 0.13, { c: 0.002 });
  if (b.hi) {
    // Klappschaft-Gelenk (Scharnier rechts, Rastknopf), Trennfuge
    b.box('cavity', 0.0545, 0.12, 0.0012, 0, 0.0, -0.13, { c: 0 });
    b.cyl('steelDark', 0.006, 0.006, 0.07, 0.029, 0.02, -0.13, { axis: 'v', seg: 12 });
    for (const v of [0.05, 0.0, -0.04]) b.cyl('steel', 0.0072, 0.0072, 0.012, 0.029, v, -0.13, { axis: 'v', seg: 12 });
    b.cyl('steelBright', 0.006, 0.006, 0.006, -0.029, 0.03, -0.14, { axis: 'x', seg: 14 });
    // Gestippelte Griffflächen, Vorderschaft-Kühlschlitze, Handstopp
    b.side('grip', [[0.024, -0.03], [0.02, -0.066], [0.006, -0.092], [-0.03, -0.092], [-0.032, -0.06], [-0.022, -0.03]], 0.0555, 0, { bevel: 0.004 });
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) b.box('cavity', 0.0015, 0.018, 0.034, s * 0.0272, 0.026, 0.17 + i * 0.045, { c: 0 });
    b.box('polymer', 0.05, 0.012, 0.016, 0, -0.012, 0.11, { c: 0.003 });
    // Schrauben der Schalen
    for (const s of [-1, 1]) for (const [v, u] of [[0.03, 0.08], [0.03, 0.33], [0.02, -0.25], [0.06, -0.38]]) b.screw('steelDark', s * 0.0272, v, u, 'x', 0.0026);
  }
  b.box('rubber', 0.058, 0.172, 0.02, 0, 0.006, -0.48, { c: 0.006 });
  if (b.hi) {
    // Distanzplatten der Schaftkappe, QD-Aufnahmen, Rillen im Polster
    b.box('polymerGrey', 0.056, 0.168, 0.004, 0, 0.006, -0.4685, { c: 0.001 });
    b.box('polymerGrey', 0.056, 0.168, 0.004, 0, 0.006, -0.4745, { c: 0.001 });
    for (let i = 0; i < 7; i++) b.box('cavity', 0.059, 0.002, 0.012, 0, -0.06 + i * 0.022, -0.486, { c: 0 });
    for (const s of [-1, 1]) { qdCup(b, s * 0.027, -0.035, -0.4); qdCup(b, s * 0.027, 0.028, 0.355); }
  }
  // Wangenauflage (verstellbar, zwei Säulen mit Rändelmuttern)
  b.box('polymerOD', 0.048, 0.018, 0.16, 0, 0.118, -0.3, { r: b.hi ? 0.006 : 0 });
  if (b.hi) for (const du of [-0.25, -0.35]) { b.cyl('steel', 0.0032, 0.0032, 0.03, 0, 0.1, du, { axis: 'v', seg: 10 }); b.cyl('knurl', 0.0085, 0.0085, 0.006, 0.029, 0.06, du, { axis: 'x', seg: 14 }); }
  // Einbein (Spindel mit Rändelrad) unter dem Schaft
  if (b.hi) {
    b.box('aluOD', 0.02, 0.014, 0.03, 0, -0.072, -0.4, { c: 0.002 });
    b.cyl('steel', 0.0055, 0.0055, 0.07, 0, -0.105, -0.4, { axis: 'v', seg: 12 });
    b.cyl('knurl', 0.012, 0.012, 0.006, 0, -0.09, -0.4, { axis: 'v', seg: 18 });
    b.cyl('rubber', 0.011, 0.012, 0.012, 0, -0.142, -0.4, { axis: 'v', seg: 14 });
  }
  // System: Rundgehäuse mit Rückenschiene, Schrauben, Auswurffenster
  b.cyl('steelDark', 0.0178, 0.0178, 0.28, 0, axis, 0.065, { seg: b.seg(24, 8) });
  b.box('steelDark', 0.026, 0.012, 0.26, 0, axis + 0.015, 0.065, { c: 0.002 });
  b.picatinny('steelDark', 0, axis + 0.021, -0.07, 0.2);
  ejectionPort(b, 0.0175, axis + 0.004, 0.06, 0.072, 0.016, 'steelDark');
  if (b.hi) {
    for (const u of [-0.04, 0.17]) b.screw('steel', 0.0179, axis - 0.006, u, 'x', 0.0022);
    b.lathe('steelDark', [[0, 0.0178], [0.006, 0.0192], [0.03, 0.0192], [0.036, 0.0172]], 0, axis, 0.2, { seg: 24 });     // Laufmutter
  }
  // Verschluss mit Kammerstängel (animiert): Zylinder mit 3 Warzen, Schlösschen, gebogener Stängel mit großem Kugelknopf
  b.part('boltHandle', 0, axis, -0.05);
  b.cyl('steelBright', 0.0102, 0.0102, 0.135, 0, axis, -0.02, { part: 'boltHandle', seg: b.seg(20, 6) });
  if (b.hi) for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 0.3; b.box('steelBright', 0.004, 0.004, 0.02, Math.cos(a) * 0.0108, axis + Math.sin(a) * 0.0108, 0.035, { part: 'boltHandle', rz: a, c: 0.0006 }); }
  if (b.hi) for (let i = 0; i < 4; i++) b.box('cavity', 0.0022, 0.0012, 0.08, Math.cos(i * 1.57) * 0.0101, axis + Math.sin(i * 1.57) * 0.0101, -0.01, { part: 'boltHandle', rz: i * 1.57, c: 0 });   // Spiralnuten (vereinfacht)
  b.lathe('steelDark', [[0, 0], [0, 0.0128], [0.022, 0.0132], [0.032, 0.0115], [0.04, 0.006], [0.04, 0]], 0, axis, -0.125, { part: 'boltHandle', seg: b.seg(20, 6) });
  b.tube('steelBright', [[0.012, axis - 0.004, -0.045], [0.03, axis - 0.012, -0.05], [0.046, axis - 0.022, -0.058], [0.054, axis - 0.03, -0.062]], 0.0042, { part: 'boltHandle', seg: b.seg(10, 5) });
  b.sphere('polymer', 0.0118, 0.058, axis - 0.034, -0.063, { part: 'boltHandle', sx: 1, sy: 1, sz: 1.15 });
  b.anchor('boltGrab', 0.062, axis - 0.034, -0.063, { part: 'boltHandle', data: { travel: [0, 0, 0.1], rot: 1.05, style: 'bolt' } });
  if (b.hi) b.box('paintSignal', 0.005, 0.004, 0.003, 0, axis + 0.005, -0.126, { part: 'boltHandle', c: 0.0005 });
  // Sicherungsflügel (3-Stellungen) rechts hinten am System
  if (b.hi) b.side('steelDark', [[-0.1, axis + 0.004], [-0.084, axis + 0.004], [-0.086, axis + 0.016], [-0.098, axis + 0.018]], 0.004, 0.019, { bevel: 0.0006 });
  engrave(b, -0.0179, axis + 0.004, 0.17, ['BRECHER .338 L.M.', 'NP 50217'], { dir: -1 });
  // Magazin (5 Schuss, Stahlblech mit Kunststoffboden) + Halteklinke vor dem Bügel
  b.part('mag', 0, 0.0, 0.1);
  b.box('steelDark', 0.033, 0.072, 0.074, 0, 0.0, 0.1, { part: 'mag', c: 0.002 });
  b.box('polymer', 0.037, 0.012, 0.078, 0, -0.036, 0.1, { part: 'mag', c: 0.003 });
  if (b.hi) {
    for (const s of [-1, 1]) b.box('steelDark', 0.0012, 0.05, 0.008, s * 0.0166, 0.002, 0.08, { part: 'mag', c: 0 });     // Sicke
    b.box('steel', 0.018, 0.012, 0.005, 0, 0.012, 0.141, { c: 0.001 });
    b.box('steel', 0.014, 0.004, 0.012, 0, 0.003, 0.147, { c: 0.001 });
  }
  magRounds(b, { cal: 'r338', fit: 0.062, width: 0.029, depth: 0.068, pitch: 0.0085, path: [[0, 0.0405, 0.1], [0, -0.018, 0.1]] });
  b.anchor('magGrab', 0, -0.0, 0.1, { part: 'mag', data: { w: 0.016, d: 0.035 } });
  // Abzug (zweistufig, Stahl) im Aluminiumbügel
  b.side('steel', [[0.05, -0.006], [0.052, -0.02], [0.046, -0.042], [0.041, -0.04], [0.045, -0.02], [0.044, -0.006]], 0.0065, 0, { bevel: 0.0008 });
  // Lauf (kanneliert, 6 Nuten) + AWM-Mündungsbremse
  flutedBarrel(b, 'steelDark', 0.0142, 0.0118, 0.23, 0.81, axis, 6, 0.27, 0.66);
  const end = awmBrake(b, 0.808, axis);
  b.anchor('muzzle', 0, axis, end + 0.002);
  // Zweibein (eingeklappt) am Vorderschaft: Klemmblock, Teleskopbeine mit Rastnuten, Gummifüße
  b.box('aluOD', 0.034, 0.014, 0.034, 0, -0.017, 0.35, { c: 0.003 });
  if (b.hi) b.cyl('knurl', 0.008, 0.008, 0.04, 0, -0.022, 0.35, { axis: 'x', seg: 14 });
  for (const s of [-1, 1]) {
    b.cyl('aluOD', 0.0055, 0.0055, 0.12, s * 0.012, -0.026, 0.28, { seg: b.seg(10, 4) });
    b.cyl('steel', 0.004, 0.004, 0.08, s * 0.012, -0.026, 0.185, { seg: b.seg(10, 4) });
    if (b.hi) for (let i = 0; i < 6; i++) b.cyl('cavity', 0.0041, 0.0041, 0.0012, s * 0.012, -0.026, 0.16 + i * 0.008, { seg: 10 });
    if (b.hi) b.sphere('rubber', 0.008, s * 0.012, -0.026, 0.143, { sz: 1.3 });
  }
  precisionScope(b, -0.08, axis + 0.0274);
  b.anchor('rightHandGrip', 0, -0.035, 0.0, { data: { rake: 0.36, gw: 0.026, gd: 0.027, gu: 0.0, ho: 0.041, tu: 0.06 } });
  b.anchor('trigger', 0, -0.028, 0.045);
  b.anchor('magWell', 0, 0.0, 0.1);
  b.anchor('leftHandGrip', 0, -0.009, 0.27, { data: { style: 'flat', w: 0.026, h: 0.0335 } });
  b.meta = { sight: 'sniper', axis, kind: 'sniper' };
}

/** Zylindrische Bremse (AWM-Art): Gewindeansatz, Kontermutter, je Seite 2 Reihen × 3 Fenster. → Mündungsende u */
function awmBrake(b, u0, axis) {
  if (b.att && b.att.muendung) return muzzleDevice(b, b.att.muendung, u0, axis, 0.0118);
  const r = 0.0175, len = 0.088;
  b.lathe('steelDark', [[-0.012, 0.0122], [-0.012, 0.0145], [0, 0.0145], [0, r * 0.94], [0.003, r], [len - 0.004, r], [len, r * 0.88], [len, r * 0.4]], 0, axis, u0, { seg: b.seg(24, 8) });
  if (b.hi) {
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) for (const dv of [-0.0055, 0.0055]) {
      b.box('cavity', 0.004, 0.0075, 0.0145, s * (r - 0.0014), axis + dv, u0 + 0.017 + i * 0.024, { c: 0 });
    }
    for (let i = 0; i < 8; i++) b.box('cavity', 0.0012, 0.0016, 0.006, Math.cos(i * Math.PI / 4) * 0.0145, axis + Math.sin(i * Math.PI / 4) * 0.0145, u0 - 0.006, { rz: i * Math.PI / 4, c: 0 });
    b.bore(r * 0.42, 0, axis, u0 + len + 0.0005);
  }
  return u0 + len;
}

/* ------------------------------------------------------------------ Titan .50 (Vorbild M82A1) */

/** Pfeilspitzen-Bremse: von oben V-förmig, zwei Kammern mit großen Seitenfenstern. → Mündungsende u */
function arrowBrake(b, u0, axis) {
  if (b.att && b.att.muendung) return muzzleDevice(b, b.att.muendung, u0, axis, 0.0165);
  const len = 0.108, hw = 0.034, h = 0.044;
  // Ansatz (Rundteil auf dem Lauf) + V-Körper (Oberansicht) mit Fenstern
  b.cyl('steelDark', 0.0215, 0.0215, 0.022, 0, axis, u0 + 0.011, { seg: b.seg(20, 6) });
  const outline = [[-0.022, 0.018], [-hw, 0.03], [-hw, 0.078], [0, len], [hw, 0.078], [hw, 0.03], [0.022, 0.018]];
  b.top('steelDark', outline.map(([x, u]) => [x, u0 + u]), h, axis, { bevel: 0.002, holes: [] });
  if (b.hi) {
    // Seitenfenster (2 Kammern) beidseitig – dunkel, mit Innenwand
    for (const s of [-1, 1]) for (const [a, c] of [[0.034, 0.05], [0.058, 0.074]]) {
      b.box('cavity', 0.004, h * 0.62, c - a, s * (hw - 0.0013), axis, u0 + (a + c) / 2, { c: 0 });
    }
    // Schräge Ablenkflächen vorn (V-Flanken) und Klemmschrauben
    for (const s of [-1, 1]) b.box('cavity', 0.0012, h * 0.5, 0.03, s * 0.018, axis, u0 + 0.093, { ry: s * 0.83, c: 0 });
    for (const s of [-1, 1]) b.screw('steel', s * 0.0217, axis - 0.008, u0 + 0.01, 'x', 0.0024);
    b.bore(0.0085, 0, axis, u0 + len - 0.0005);
  }
  return u0 + len;
}

export function titan(b) {
  // Gravuren: Typ/Kaliber/Nummer (Fantasie), eingeschnitten (schrift.js)
  MARK_TITAN(b, 'TITAN  KAL .50', -(0.027 + 0.0002), 0.078, 0.02, 0.005);
  MARK_TITAN(b, 'NP 820614', -(0.027 + 0.0002), 0.078, 0.16, 0.0035);
  const axis = 0.072;
  // Oberteil (Stahlblech, gekantet): langes Rechteckprofil mit gerundeten Oberkanten
  const upper = roundRect(-0.027, 0.05, 0.027, 0.106, 0.007, b.hi ? 3 : 1);
  b.front('steel', upper, 0.64, -0.24, { bevel: 0.0015 });
  b.picatinny('steel', 0, 0.106, -0.22, 0.33);
  if (b.hi) {
    for (const s of [-1, 1]) {
      // Verstärkungssicken (längs) und Kühllöcher im vorderen Teil (2 Reihen)
      b.box('steel', 0.0012, 0.004, 0.42, s * 0.0272, 0.094, 0.05, { c: 0 });
      b.box('steel', 0.0012, 0.004, 0.42, s * 0.0272, 0.062, 0.05, { c: 0 });
      for (let i = 0; i < 7; i++) for (const v of [0.07, 0.088]) b.cyl('cavity', 0.0052, 0.0052, 0.0012, s * 0.0273, v, 0.25 + i * 0.022, { axis: 'x', seg: 14 });
      for (const u of [-0.2, -0.08, 0.12, 0.2, 0.37]) b.screw('steelBright', s * 0.0272, 0.058, u, 'x', 0.003);
      // Bolzen (Querstifte) zwischen Ober- und Unterteil
      for (const u of [-0.17, 0.19]) b.cyl('steelBright', 0.0042, 0.0042, 0.059, 0, 0.054, u, { axis: 'x', seg: 14 });
    }
    // Gehäuseende vorn (Abschlussplatte), Laufbuchse
    b.box('steelDark', 0.056, 0.058, 0.006, 0, 0.078, 0.403, { c: 0.002 });
    b.cyl('steelDark', 0.022, 0.022, 0.02, 0, axis, 0.414, { seg: 24 });
  }
  // Unterteil mit Magazinschacht, Griff, Bügel
  b.front('steel', roundRect(-0.025, 0.006, 0.025, 0.052, 0.004, b.hi ? 2 : 1), 0.44, -0.22, { bevel: 0.0015 });
  b.box('steel', 0.048, 0.022, 0.09, 0, -0.004, 0.132, { c: 0.003 });                                   // Schachtkragen
  arGrip(b, 'grip', { top: 0.012, w: 0.034 });
  triggerGuard(b, 'steel', 0.022, 0.078, 0.008, 0.032, { t: 0.0065, w: 0.017, trigPos: 0.3 });
  if (b.hi) {
    b.side('steelDark', [[-0.02, 0.03], [-0.006, 0.03], [-0.008, 0.042], [-0.018, 0.044]], 0.004, 0.027, { bevel: 0.0006 });   // Sicherung
    b.cyl('steelBright', 0.0045, 0.0045, 0.004, -0.026, 0.03, 0.09, { axis: 'x', seg: 14 });                                     // Magazinknopf
  }
  // Lauf (kanneliert) mit Pfeilspitzenbremse
  flutedBarrel(b, 'steelDark', 0.0178, 0.0165, 0.4, 0.86, axis, 8, 0.43, 0.82);
  const end = arrowBrake(b, 0.86, axis);
  b.anchor('muzzle', 0, axis, end + 0.002);
  // Zweibein am vorderen Gehäuseende (Schelle), Beine nach vorn geklappt unter dem Lauf
  b.box('steel', 0.05, 0.024, 0.036, 0, 0.04, 0.38, { c: 0.003 });
  for (const s of [-1, 1]) {
    b.box('steel', 0.01, 0.01, 0.31, s * 0.019, 0.04, 0.54, { c: 0.002 });
    if (b.hi) b.box('steelDark', 0.006, 0.006, 0.08, s * 0.019, 0.04, 0.66, { c: 0.001 });
    b.box('rubber', 0.026, 0.014, 0.03, s * 0.019, 0.04, 0.705, { c: 0.004 });
  }
  if (b.hi) b.cyl('knurl', 0.008, 0.008, 0.06, 0, 0.034, 0.38, { axis: 'x', seg: 14 });
  // Tragegriff (geklappt, Bügel aus Rundstahl) hinter dem Zielfernrohr auf der Schiene
  if (b.hi) {
    b.tube('steelDark', [[-0.016, 0.115, 0.26], [-0.016, 0.125, 0.27], [-0.016, 0.127, 0.33], [-0.016, 0.115, 0.34]], 0.0035, { seg: 8 });
    b.tube('steelDark', [[0.016, 0.115, 0.26], [0.016, 0.125, 0.27], [0.016, 0.127, 0.33], [0.016, 0.115, 0.34]], 0.0035, { seg: 8 });
    b.cyl('rubber', 0.007, 0.007, 0.034, 0, 0.127, 0.3, { axis: 'x', seg: 14 });
    for (const u of [0.26, 0.34]) b.box('steel', 0.04, 0.008, 0.01, 0, 0.114, u, { c: 0.001 });
  }
  // Spannhebel rechts
  b.part('charge', 0.03, 0.08, 0.14);
  b.box('steel', 0.014, 0.016, 0.05, 0.03, 0.08, 0.14, { part: 'charge', c: 0.003 });
  b.cyl('polymer', 0.0095, 0.0095, 0.032, 0.049, 0.08, 0.15, { part: 'charge', axis: 'x', seg: b.seg(14, 5) });
  b.anchor('chargeGrab', 0.06, 0.08, 0.15, { part: 'charge', data: { travel: [0, 0, 0.11], style: 'right' } });
  if (b.hi) b.box('cavity', 0.002, 0.008, 0.16, 0.0273, 0.08, 0.13, { c: 0 });                               // Führungsschlitz
  ejectionPort(b, 0.0272, 0.078, 0.02, 0.075, 0.026);
  b.part('bolt', 0, 0.078, 0.02);
  b.box('steelBright', 0.005, 0.02, 0.07, 0.023, 0.078, 0.02, { part: 'bolt', c: 0.001 });
  // Schaft: hinterer Gehäuseteil abwärts, Puffergehäuse, dickes Rückstoßpolster, hinterer Griff + Einbein, Wangenauflage
  b.side('steel', [[-0.22, 0.106], [-0.4, 0.104], [-0.42, 0.098], [-0.42, -0.02], [-0.4, -0.03], [-0.34, -0.02], [-0.3, 0.0], [-0.22, 0.006]], 0.05, 0, { bevel: 0.004, bevelSeg: 2 });
  b.side('rubber', [[-0.42, 0.112], [-0.468, 0.112], [-0.476, 0.1], [-0.476, -0.034], [-0.468, -0.044], [-0.42, -0.036]], 0.056, 0, { bevel: 0.008, bevelSeg: 2 });
  if (b.hi) for (let i = 0; i < 6; i++) b.box('cavity', 0.057, 0.0025, 0.03, 0, -0.024 + i * 0.024, -0.452, { c: 0 });   // Faltenbalg-Rillen
  b.box('polymer', 0.038, 0.03, 0.17, 0, 0.122, -0.33, { r: b.hi ? 0.008 : 0 });                         // Wangenauflage
  b.side('grip', [[-0.31, -0.02], [-0.33, -0.08], [-0.35, -0.085], [-0.36, -0.02]], 0.03, 0, { bevel: 0.006, bevelSeg: 2 });   // hinterer Griff
  b.box('steel', 0.016, 0.06, 0.016, 0, -0.06, -0.395, { c: 0.002 });                                  // Einbein
  if (b.hi) { b.cyl('knurl', 0.011, 0.011, 0.008, 0, -0.06, -0.395, { axis: 'v', seg: 16 }); b.cyl('rubber', 0.012, 0.014, 0.012, 0, -0.096, -0.395, { axis: 'v', seg: 16 }); }
  // Magazin (10 Schuss) vor dem Abzug
  b.part('mag', 0, 0.012, 0.13);
  b.box('steel', 0.04, 0.12, 0.084, 0, -0.045, 0.132, { part: 'mag', c: 0.004 });
  b.box('steel', 0.044, 0.01, 0.09, 0, -0.108, 0.132, { part: 'mag', c: 0.003 });
  if (b.hi) {
    for (const s of [-1, 1]) {
      b.box('steel', 0.002, 0.08, 0.006, s * 0.0205, -0.045, 0.11, { part: 'mag', c: 0 });
      for (let i = 0; i < 4; i++) b.cyl('cavity', 0.0028, 0.0028, 0.0012, s * 0.0206, -0.02 - i * 0.02, 0.155, { part: 'mag', axis: 'x', seg: 10 });   // Zählöcher
    }
  }
  magRounds(b, { cal: 'r50', fit: 0.079, width: 0.036, depth: 0.08, pitch: 0.011, path: [[0, 0.0175, 0.133], [0, -0.08, 0.133]] });
  b.anchor('magGrab', 0, -0.06, 0.135, { part: 'mag', data: { w: 0.02, d: 0.042 } });
  b.anchor('magWell', 0, 0.012, 0.13);
  engrave(b, -0.0273, 0.1, 0.1, ['TITAN CAL .50', 'NP-82 0471'], { dir: -1 });
  precisionScope(b, -0.13, 0.1137);
  b.anchor('rightHandGrip', 0, -0.02, 0, { data: { rake: 0.32, gw: 0.017, gd: 0.023, gu: 0.0, ho: 0.03, tu: 0.04 } });
  b.anchor('leftHandGrip', 0, 0.012, 0.25, { data: { style: 'flat', w: 0.024, h: 0.03 } });
  b.meta = { sight: 'sniper', axis, kind: 'sniper' };
}
