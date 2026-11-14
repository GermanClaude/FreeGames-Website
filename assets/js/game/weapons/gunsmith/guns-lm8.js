// LM-8 Bär nach Vorbild (RPK-Bauart, 13.11.2026 – Nutzerwunsch „Waffenmodelle anhand der echten Versionen so detailliert wie
// möglich“). Maße nach Datenblatt (Länge 1040 mm, Lauf 590 mm, Visierlinie 555 mm, Trommel 75 Schuss Ø ≈ 140 mm) und Foto
// https://commons.wikimedia.org/wiki/File:Machine_Gun_RPK.jpg (nur Proportionen: Schaft „Klumpfuß“, Handschutz, Zweibein).
// Ohne Hoheitszeichen/Stempel. Bauteile: gestanztes Gehäuse mit Nieten, Verschlussdeckel mit Rippen, Kimmenfuß mit
// Tangentenvisier, Gasrohr mit Holzauflage, Holzhandschutz unten, schwerer Lauf, Gasblock, Zweibein (eingeklappt),
// Korn mit Schutz, Laufschutzkappe, Klumpfußschaft aus Schichtholz mit Kolbenkappe, Pistolengriff, Sicherungshebel,
// Spannhebel am Verschlussträger, Trommelmagazin mit Hals, Sicken und Aufziehknopf.
import { mm, slab, rrect, pocket, POLY, STEEL } from './gbkit.js?v=20261114060746';
import { magRounds } from './magfill.js?v=20261114060746';
import { schrift } from './schrift.js?v=20261114060746';   // Gravuren (14.11., gfx-waffen)
const MARK_LM8 = schrift('lm8').mark;

const AXIS = 0.062;
const SV = 0.0925;  // Visierlinie (Kimmenkerbe/Kornspitze)

const REC = mm([[-176, 74], [150, 74], [150, 8], [96, 8], [92, 2], [60, 2], [56, 8], [-30, 8], [-42, 4], [-176, 22]]);
const COVER = mm([[-182, 74], [146, 74], [146, 82], [140, 88], [-150, 88], [-176, 84], [-184, 80]]);
const RSBLOCK = mm([[150, 74], [222, 74], [228, 66], [228, 48], [150, 46]]);
const HG_LOW = mm([[232, 38], [442, 42], [452, 50], [452, 84], [232, 84]]);
const HG_UP = mm([[226, 88], [436, 90], [446, 96], [446, 108], [436, 112], [244, 112], [226, 104]]);
const STOCK = mm([[-178, 70], [-396, 58], [-404, 48], [-404, -78], [-396, -88], [-372, -88], [-354, -74], [-334, -46], [-296, -24], [-244, -6], [-200, 8], [-178, 14], [-176, 30]]);
const GRIP = mm([[12, 6], [18, -10], [4, -96], [-6, -104], [-34, -102], [-40, -92], [-26, -14], [-28, 6]]);

export function lm8(b) {
  // Gravuren: Typ/Kaliber/Nummer (Fantasie), eingeschnitten (schrift.js)
  MARK_LM8(b, 'LM-8   1981', -(0.0185 + 0.0002), 0.052, -0.125, 0.0036);
  MARK_LM8(b, 'NP 470213', -(0.0185 + 0.0002), 0.044, -0.125, 0.0028);
  // --- Gehäuse (gestanzt, phosphatiert): Magazinschacht, Nieten, Auswurf rechts unter dem Deckel
  slab(b, REC, 0.0185, 0.0018, 'gbBlued', { id: 'rec', cav: STEEL, cut: (x, v, u, d) => {
    d = pocket(d, x, rrect(u, v, 0.03, 0.062, 0.05, 0.008, 0.002), 0.012, 1);                 // Auswurf/Verschlussbahn
    d = pocket(d, x, rrect(u, v, 0.085, 0.05, 0.011, 0.0045, 0.002), 0.0172);                 // Prägung über dem Schacht
    return d;
  } });
  // Verschlussdeckel (rund, Rippen hinten) – Deckel sitzt auf dem Gehäuse
  slab(b, COVER, 0.0192, 0.002, 'gbSteel', { id: 'cover', cav: STEEL, cut: (x, v, u, d) => {
    d = Math.max(d, Math.hypot(x, (v - 0.058) * 0.85) - 0.0296);
    for (let i = 0; i < 4; i++) d = Math.max(d, -(Math.hypot(u + 0.14 + i * 0.008, v - 0.088) - 0.0012));
    return d;
  } });
  if (b.hi) {
    for (const [u, v] of [[-0.165, 0.065], [-0.165, 0.03], [0.1, 0.066], [0.12, 0.066], [0.14, 0.066], [0.11, 0.016], [0.13, 0.016], [-0.035, 0.016], [-0.12, 0.066], [0.04, 0.016]])
      for (const s of [-1, 1]) b.sphere('gbSteel', 0.0028, s * 0.0186, v, u, { seg: 10, hseg: 6, sx: 0.5 });
    b.box('gbSteel', 0.012, 0.012, 0.022, 0, 0.078, -0.192, { c: 0.002 });   // Deckelriegel
  }
  // Kimmenfuß mit Tangentenvisier
  slab(b, RSBLOCK, 0.0165, 0.003, 'gbBlued', { id: 'rs', cav: STEEL });
  if (b.hi) {
    b.side('gbSteel', mm([[156, 74], [222, 82], [222, 90], [156, 86]]), 0.016, 0, { bevel: 0.0008 });
    b.box('gbSteel', 0.02, 0.01, 0.012, 0, 0.087, 0.186, { c: 0.0015 });
    b.box('cavity', 0.0024, 0.004, 0.009, 0, SV - 0.0005, 0.156, { c: 0 });
    b.side('gbSteel', mm([[152, 84], [160, 84], [160, 93], [152, 93]]), 0.014, 0, { bevel: 0.0006 });
  } else b.box('gbBlued', 0.016, 0.014, 0.07, 0, 0.082, 0.19);

  // --- Gasrohr mit Holzauflage, Holzhandschutz unten, Lauf, Gasblock
  slab(b, HG_LOW, 0.0235, 0.012, 'gbWood', { id: 'hgl', cav: POLY, cut: (x, v, u, d) => pocket(d, x, rrect(u, v, 0.33, 0.055, 0.07, 0.003, 0.003), 0.021) });
  slab(b, HG_UP, 0.0195, 0.011, 'gbWood', { id: 'hgu', cav: POLY });
  b.cyl('gbBlued', 0.0105, 0.0105, 0.04, 0, 0.099, 0.462, { seg: b.seg(16, 6) });
  b.cyl('gbSteel', 0.026, 0.026, 0.016, 0, AXIS, 0.454, { seg: b.seg(20, 8) });   // Handschutzring vorn
  slab(b, mm([[462, 50], [500, 50], [504, 64], [500, 110], [462, 110]]), 0.0145, 0.003, 'gbBlued', { id: 'gas', cav: STEEL });
  b.cyl('gbBarrel', 0.0122, 0.0122, 0.19, 0, AXIS, 0.555, { seg: b.seg(20, 6) });
  b.cyl('gbBarrel', 0.0118, 0.0118, 0.025, 0, AXIS, 0.66, { seg: b.seg(20, 6) });
  // Korn mit Ringschutz (Kornfuß), Laufschutzkappe (Gewinde)
  slab(b, mm([[612, 50], [636, 50], [640, 74], [634, 82], [618, 82], [612, 74]]), 0.0125, 0.003, 'gbBlued', { id: 'fsb', cav: STEEL });
  if (b.hi) {
    for (const s of [-1, 1]) b.side('gbBlued', mm([[616, 80], [632, 80], [630, 100], [618, 100]]), 0.003, s * 0.0085, { bevel: 0.0008 });
    b.cyl('gbSteel', 0.0018, 0.0018, 0.012, 0, SV - 0.006, 0.624, { axis: 'v', seg: 8 });
  } else b.box('gbBlued', 0.016, 0.04, 0.016, 0, 0.1, 0.624);
  b.lathe('gbBlued', [[0, 0], [0, 0.0125], [0.002, 0.0132], [0.024, 0.0132], [0.026, 0.0118], [0.026, 0]], 0, AXIS, 0.672, { seg: b.seg(20, 6) });
  b.bore(0.0045, 0, AXIS, 0.6985);
  b.anchor('muzzle', 0, AXIS, 0.7);

  // --- Zweibein (eingeklappt, Füße nach hinten unter den Handschutz)
  b.cyl('gbSteel', 0.0142, 0.0142, 0.03, 0, AXIS, 0.59, { seg: b.seg(16, 6) });
  for (const s of [-1, 1]) {
    b.cyl('gbSteel', 0.0045, 0.0045, 0.24, s * 0.0125, AXIS - 0.022, 0.47, { seg: b.seg(10, 4), rx: 0.05 });
    b.box('gbSteel', 0.012, 0.004, 0.026, s * 0.0135, AXIS - 0.03, 0.352, { c: 0.001 });
    if (b.hi) b.cyl('gbSteel', 0.003, 0.003, 0.012, s * 0.0125, AXIS - 0.01, 0.588, { axis: 'x', seg: 8 });
  }

  // --- Schaft (Klumpfuß, Schichtholz) mit Kolbenkappe; Griff (Bakelit); Abzugsbügel, Abzug
  slab(b, STOCK, (u, v) => 0.0175 + Math.min(0.005, Math.max(0, -u - 0.2) * 0.03), 0.009, 'gbWood', { hwMax: 0.0225, id: 'stock', cav: POLY });
  b.side('gbSteel', mm([[-398, 58], [-410, 50], [-410, -80], [-398, -92], [-394, -88], [-402, -78], [-402, 48], [-394, 56]]), 0.044, 0, { bevel: 0.0015 });
  if (b.hi) { b.cyl('gbSteel', 0.0062, 0.0062, 0.003, 0, 0.004, -0.405, { seg: 14 }); b.box('gbSteel', 0.01, 0.003, 0.03, 0, -0.06, -0.33, { rx: 0.4 }); }
  slab(b, GRIP, 0.0145, 0.007, 'gbBakelite', { id: 'grip', cav: POLY });
  b.side('gbSteel', mm([[14, 6], [12, -24], [18, -34], [56, -34], [58, -28], [58, 4], [54, 4], [54, -28], [20, -30], [16, -22], [18, 6]]), 0.009, 0, { bevel: 0.0008 });
  b.side('gbSteel', mm([[30, 6], [32, -6], [36, -18], [34, -24], [30, -22], [29, -10], [26, 6]]), 0.006, 0, { bevel: 0.0008 });
  // Magazinhalter (Wippe) vor dem Bügel, Sicherungshebel rechts (lang, über dem Griff)
  b.box('gbSteel', 0.012, 0.022, 0.008, 0, -0.012, 0.062, { c: 0.0012 });
  if (b.hi) {
    b.side('gbSteel', mm([[-60, 54], [72, 54], [78, 48], [72, 44], [-30, 46], [-56, 30], [-62, 34], [-62, 50]]), 0.0024, 0.0198, { bevel: 0.0006 });
    b.cyl('gbSteel', 0.006, 0.006, 0.004, 0.02, 0.05, -0.056, { axis: 'x', seg: 14 });
  }

  // --- Spannhebel am Verschlussträger (rechts) und Verschlussträger im Auswurf
  b.part('charge', 0.02, 0.065, 0.135);
  b.box('gbBolt', 0.012, 0.008, 0.02, 0.026, 0.065, 0.135, { part: 'charge', c: 0.0015 });
  b.cyl('gbBolt', 0.0065, 0.0065, 0.018, 0.036, 0.065, 0.14, { part: 'charge', axis: 'x', seg: b.seg(14, 5) });
  b.anchor('chargeGrab', 0.046, 0.065, 0.14, { part: 'charge', data: { travel: [0, 0, 0.09], style: 'right' } });
  b.part('bolt', 0, 0.062, 0.03);
  b.box('gbBolt', 0.004, 0.014, 0.096, 0.0125, 0.062, 0.03, { part: 'bolt', c: 0.001 });

  // --- Trommelmagazin (75 Schuss): Hals im Schacht, Trommel mit Sicken, Fenster links, Aufziehknopf rechts
  b.part('mag', 0, 0.006, 0.078);
  const C = [0, -0.104, 0.118], R = 0.07, T = 0.074;
  slab(b, mm([[60, 10], [96, 10], [102, -44], [96, -58], [64, -56], [58, -36]]), 0.0135, 0.003, 'gbSteel', { part: 'mag', cav: STEEL });
  b.cyl('gbSteel', R, R, T, 0, C[1], C[2], { part: 'mag', axis: 'x', seg: b.seg(40, 10), open: b.hi });
  if (b.hi) {
    b.lathe('gbSteel', [[T / 2, R - 0.0012], [-T / 2, R - 0.0012]], 0, C[1], C[2], { part: 'mag', axis: 'x', seg: 40 });
    for (const s of [-1, 1]) {
      b.lathe('gbSteel', [[0, 0], [0, R + 0.0015], [0.003, R + 0.002], [0.006, R + 0.0015], [0.006, R - 0.004]], s * T / 2 - (s > 0 ? 0.006 : 0), C[1], C[2], { part: 'mag', axis: 'x', seg: 40, rz: s > 0 ? 0 : Math.PI });
      b.torus('gbSteel', R * 0.62, 0.0022, s * (T / 2 + 0.0004), C[1], C[2], { part: 'mag', ry: Math.PI / 2, seg: 8, tseg: 36 });
      b.torus('gbSteel', R * 0.36, 0.0018, s * (T / 2 + 0.0004), C[1], C[2], { part: 'mag', ry: Math.PI / 2, seg: 8, tseg: 28 });
    }
    b.circle('gbSteel', R - 0.0012, T / 2 - 0.0005, C[1], C[2], { part: 'mag', ry: Math.PI / 2, seg: 40 });
    b.circle('smokeDark', R - 0.002, -T / 2 - 0.0006, C[1], C[2], { part: 'mag', ry: -Math.PI / 2, seg: 40, renderOrder: 1 });
    for (let i = 0; i < 3; i++) b.torus('gbSteel', R + 0.0008, 0.0016, -T / 2 + 0.018 + i * 0.019, C[1], C[2], { part: 'mag', ry: Math.PI / 2, seg: 6, tseg: 40 });
    b.cyl('gbSteel', 0.022, 0.022, 0.006, T / 2 + 0.003, C[1], C[2], { part: 'mag', axis: 'x', seg: 24 });
    b.cyl('knurl', 0.011, 0.011, 0.014, T / 2 + 0.012, C[1], C[2], { part: 'mag', axis: 'x', seg: 16 });
    b.box('gbSteel', 0.006, 0.006, 0.05, T / 2 + 0.019, C[1], C[2], { part: 'mag', c: 0.0012 });
  } else b.circle('gbSteel', R, T / 2, C[1], C[2], { part: 'mag', ry: Math.PI / 2 });
  magRounds(b, {
    cal: 'r556', width: 0.026, follower: false, neck: 2, path: [[0, 0.03, 0.078], [0, 0.0, 0.08], [0, -0.03, 0.09]],
    drum: { c: C, r0: 0.0605, dr: 0.0105, rmin: 0.03, a0: 1.73 },
  });
  b.anchor('magGrab', -0.03, C[1], C[2], { part: 'mag', data: { w: 0.037, d: 0.07 } });
  b.anchor('magWell', 0, 0.006, 0.078);

  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.32, gw: 0.0155, gd: 0.022, gu: 0.004, ho: 0.03, tu: 0.034 } });
  b.anchor('sight', 0, SV, 0.156, { data: { type: 'iron', eyeRelief: 0.3 } });
  b.anchor('leftHandGrip', 0, 0.034, 0.33, { data: { style: 'under', w: 0.026, h: 0.022 } });
  b.meta = { sight: 'iron', axis: AXIS, kind: 'lmg' };
}
