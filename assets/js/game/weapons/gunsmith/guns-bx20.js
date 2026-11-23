// BX-20 Stier nach Referenzfoto (Steyr AUG, bx20-ref.js) – Waffen-Etappe 3 (13.11.2026, Nutzer: „Waffenmodelle anhand der
// echten Versionen so detailliert wie möglich“). Bauweise des Vorbilds: Bullpup-Schale aus Polymer (Sand) mit großem Bügel,
// der die ganze Schusshand umschließt, Pistolengriff, Magazin hinter dem Griff, Schaftkappe mit Riegel; Aluminium-Gehäuse
// (Oliv) mit eingebautem optischen Visier im Tragebügel und Picatinny-Schiene obenauf; Laufgruppe (Stahl) mit Gaszylinder,
// Spannhebel links und klappbarem Vordergriff; Quer-Sicherung über dem Griff; Auswurffenster rechts, Abdeckung links;
// durchscheinendes Magazin mit Waffelmuster. Umrisse aus dem Foto (photo-kit.js), Rundteile gedreht, Kleinteile von Hand.
import * as R from './bx20-ref.js?v=20261123115551';
import { calib, slab, pocket, rib, barrel, pins, screwHead, slottedHider, STEEL, POLY, ALU } from './photo-kit.js?v=20261123115551';
import { sdRoundRect } from './sdfkit.js?v=20261123115551';
import { swapOptic } from './parts.js?v=20261123115551';
import { magRounds } from './magfill.js?v=20261123115551';
import { schrift } from './schrift.js?v=20261123115551';

const C = calib(R.PPM, R.XG, R.YG, R.YA);
const { U, V, M, AXIS: AX } = C;
const mm = (px) => px / R.PPM;
const SHELL_W = 0.0245, GRIP_W = 0.0158, LOOP_W = 0.0125, REC_W = 0.0185;
const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, t)); return a + (b - a) * k * k * (3 - 2 * k); };
const { mark } = schrift('bx20');

export function bx20(b) {
  // ---------------------------------------------------------------- Schale (Polymer, Sand): Schaft, Griff, Bügel
  const vLow = V(160), uGrip = U(328);
  slab(b, 'gaPolyTan', M(R.STOCK), SHELL_W, {
    id: 'bx20Shell', r: 0.0065, holes: (R.STOCK_HOLES || []).map(M), hwMax: SHELL_W,
    hwFn: (u, v) => smooth(SHELL_W, smooth(GRIP_W, LOOP_W, (u - uGrip) / 0.012), (vLow - v) / 0.014),
    mod: (d, x, v, u) => {
      if (d > 0.003) return d;
      // Auswurffenster rechts (dahinter der Verschluss), Abdeckung links eingelassen
      const P = R.PORT;
      if (x > 0) d = Math.max(d, -Math.max(sdRoundRect(u - (U(P[0]) + U(P[2])) / 2, v - (V(P[1]) + V(P[3])) / 2, mm(P[2] - P[0]) / 2, mm(P[3] - P[1]) / 2, 0.002), 0.012 - x));
      // Trennfuge Schaftkappe (senkrecht) und Längsfalz der Schalenhälften
      if (Math.abs(u - U(60)) < 0.0006 && v > V(235) && v < V(104)) d = Math.max(d, -(0.0004 - (SHELL_W - Math.abs(x))));
      // Mulde der Riemenöse hinten
      const [sx, sy, sr] = R.SLING;
      d = pocket(d, x, v, u, SHELL_W, U(sx), V(sy), mm(sr), mm(sr), mm(sr), 0.003);
      return d;
    },
  });
  if (b.hi) {
    const [sx, sy] = R.SLING;
    for (const s of [-1, 1]) {
      b.cyl('gaSteel', 0.0022, 0.0022, 0.004, s * (SHELL_W - 0.0012), V(sy), U(sx), { axis: 'x', seg: 12 });
      for (const [x, y] of R.STOCK_SCREWS) b.cyl('gaPolyDark', 0.0028, 0.0028, 0.0012, s * (SHELL_W + 0.0002), V(y), U(x), { axis: 'x', seg: 14 });
    }
    // Schaftkappen-Riegel und Quer-Sicherung (Knopf schaut beidseitig heraus)
    const [bx, by, br] = R.BUTTON;
    for (const s of [-1, 1]) b.box('gaPolyDark', 0.003, mm(br * 2.4), mm(br * 1.2), s * (SHELL_W + 0.0006), V(by), U(bx), { c: 0.0008 });
    const [qx, qy] = R.SAFETY;
    b.cyl('gaPolyDark', 0.0042, 0.0042, GRIP_W * 2 + 0.008, 0, V(qy), U(qx), { axis: 'x', seg: b.seg(16, 6) });
    b.box('paintSignal', 0.0005, 0.004, 0.004, -(GRIP_W + 0.0041), V(qy), U(qx), { c: 0 });
    // Abzug (lang, im Bügel), Magazinhalter
    b.side('gaPolyDark', M([[322, 150], [330, 150], [333, 160], [331, 176], [326, 182], [323, 178], [325, 165]]), 0.0065, 0, { bevel: 0.0009 });
    b.side('gaPolyDark', M(R.MAG_REL), 0.016, 0, { bevel: 0.001 });
    b.box('gaPolyDark', 0.003, mm(20), mm(16), -(SHELL_W + 0.0005), V((R.PORT_COVER[1] + R.PORT_COVER[3]) / 2), U((R.PORT_COVER[0] + R.PORT_COVER[2]) / 2), { c: 0.0008 });
  }
  b.anchor('trigger', 0, V(165), U(327));
  // ---------------------------------------------------------------- Gehäuse (Alu, Oliv) mit Bügel und Visier
  slab(b, 'gaPolyOD', M(R.REC), REC_W, {
    id: 'bx20Rec', r: 0.003, cav: ALU, holes: (R.REC_HOLES || []).map(M),
    mod: (d, x, v, u) => {
      if (d > 0.003) return d;
      // Spannhebel-Nut links, Längsschlitze im Gehäuse rechts
      if (x < 0 && Math.abs(v - V(R.CHARGE_Y + 15)) < 0.0018 && u > U(R.CHARGE_BACK) && u < U(R.CHARGE_X + 8)) d = Math.max(d, -(0.003 - (REC_W - Math.abs(x))));
      for (const [x0, x1, y] of [[345, 430, 115], [380, 430, 121]]) if (x > 0) d = Math.max(d, -Math.max(sdRoundRect(u - (U(x0) + U(x1)) / 2, v - V(y), mm(x1 - x0) / 2, 0.0013, 0.0012), REC_W - 0.003 - x));
      return d;
    },
  });
  const [s0, s1, sy] = R.SCOPE;
  const SV = V(sy);
  const railTop = V(R.RAIL[2]) + 0.0077;
  // visier (14.11.): Visierrohr samt Schiene obenauf als Teil 'optic' (im vollen Anschlag ausgeblendet, siehe unten) – nur mit der
  // Werksoptik; trägt die Schiene eine andere Optik (Aufsatz), bleibt sie stehen
  const ownScope = !(b.att && b.att.optik && b.att.optik !== 'acog');
  if (ownScope) { b.part('optic', 0, SV, U(s0)); b.defPart = 'optic'; }
  if (b.hi) b.picatinny('gaAlu', 0, V(R.RAIL[2]), U(R.RAIL[0]), U(R.RAIL[1]));
  else b.rail('gaAlu', 0, V(R.RAIL[2]), U(R.RAIL[0]), U(R.RAIL[1]));
  b.defPart = null;
  const swapped = swapOptic(b, 'acog', U(262), railTop);
  // Visierrohr (gedreht), Augenmuschel, Objektivkappe, Linsen, Absehen
  const prof = R.SCOPE_PROFILE.map(([x, r]) => [U(x), mm(r)]);
  // visier (14.11.): in den Ego-Stufen ein offenes Rohr (Innenlippe bis r 11,5/13,5 mm) – barrel() schloss beide Enden mit vollen
  // Scheiben, im Anschlag blickte man auf den Deckel des Okulars statt durch das Visier. Bot-Stufe bleibt geschlossen.
  // Visierrohr als Teil 'optic': im vollen Anschlag blendet das Viewmodel es aus (Okularrand vom HUD, Absehen bleibt), siehe parts.js acog
  if (ownScope) b.defPart = 'optic';
  if (b.hi) {
    const u0 = prof[0][0];
    b.lathe('gaPolyOD', [[0, mm(11.5)], ...prof.map(([u, r]) => [u - u0, r]), [prof[prof.length - 1][0] - u0, mm(13.5)]], 0, SV, u0, { seg: b.seg(28, 6) });
  } else barrel(b, 'gaPolyOD', prof, SV, { seg: 28 });
  if (b.hi) {
    b.lathe('rubber', [[0, mm(15.5)], [-0.004, mm(16.5)], [-0.009, mm(16.5)], [-0.009, mm(13)]], 0, SV, U(s0), { seg: b.seg(24, 8) });
    b.lathe('cavity', [[U(s1) - U(s0) - 0.002, mm(13.5)], [0.004, mm(11.5)]], 0, SV, U(s0), { seg: 20 });
    // visier (14.11.): Objektiv nach vorn (Reflexe außen), Okular zum Auge nur leicht getönt
    b.circle('lensClear', mm(14.5), 0, SV, U(s1) - 0.002, { renderOrder: 1, ry: Math.PI });
    b.circle('lensEye', mm(12), 0, SV, U(s0) + 0.002, { renderOrder: 1 });
    b.plane('reticleChevron', 0.011, 0.011, 0, SV, U(s0) + 0.004, { renderOrder: 3, part: 'static' });
    // Einstelltürme seitlich/oben am Bügel
    b.cyl('gaPolyOD', 0.0062, 0.0062, 0.006, REC_W + 0.003, SV, U(320), { axis: 'x', seg: 16 });
  }
  b.defPart = null;
  if (swapped === null || swapped === undefined) b.anchor('sight', 0, SV, U(s0) - 0.012, { data: { type: 'acog', eyeRelief: 0.085 } });
  // ---------------------------------------------------------------- Laufgruppe (Stahl), Spannhebel, Lauf, Mündung
  slab(b, 'gaSteel', M(R.BGROUP), 0.0165, {
    id: 'bx20Bg', r: 0.0022, cav: STEEL,
    mod: (d, x, v, u) => {
      // Gaszylinder als Rundkörper oben herausgearbeitet (Rille), Querbohrungen
      if (Math.abs(v - V(108)) < 0.0008 && Math.abs(x) > 0.0145) d = Math.max(d, -(0.0006 - (0.0165 - Math.abs(x))));
      return d;
    },
  });
  if (b.hi) b.cyl('gaSteel', 0.0085, 0.0085, U(518) - U(440), 0, V(106), (U(440) + U(518)) / 2, { seg: b.seg(20, 6) });   // Gaszylinder
  barrel(b, 'gaBlued', R.BARREL.map(([x, r]) => [U(x), mm(r)]), AX);
  const [h0, h1, hr] = R.HIDER;
  slottedHider(b, 'gaBlued', U(h0), U(h1), AX, { r: mm(hr), ri: 0.0064, n: 4, sw: 0.0016, slot0: 0.012, closed: true, phase: Math.PI / 4 });
  b.anchor('muzzle', 0, AX, U(h1) + 0.002);
  // Spannhebel links (klappbar, in Ruhe vorn)
  const cu = U(R.CHARGE_X), cv = V(R.CHARGE_Y);
  b.part('charge', -REC_W, cv, cu);
  if (b.hi) {
    b.box('gaSteel', 0.006, 0.007, 0.014, -REC_W - 0.002, cv, cu, { part: 'charge', c: 0.001 });
    b.box('gaPolyDark', 0.018, 0.007, 0.01, -REC_W - 0.011, cv + 0.002, cu + 0.004, { part: 'charge', rz: -0.25, c: 0.0015 });
    b.cyl('gaPolyDark', 0.004, 0.004, 0.012, -REC_W - 0.021, cv + 0.0045, cu + 0.004, { part: 'charge', seg: 12 });
  } else b.box('gaSteel', 0.02, 0.008, 0.012, -REC_W - 0.01, cv, cu, { part: 'charge' });
  b.anchor('chargeGrab', -REC_W - 0.022, cv + 0.0045, cu + 0.004, { part: 'charge', data: { travel: [0, 0, U(R.CHARGE_X) - U(R.CHARGE_BACK)], style: 'pull' } });
  // Klapp-Vordergriff: Kopf (Gummiband) + Griffstück mit Fingermulden
  slab(b, 'gaPolyDark', M(R.FGTOP), 0.017, { id: 'bx20FgTop', r: 0.004 });
  slab(b, 'gaGripTan', M(R.FG), 0.0145, {
    id: 'bx20Fg', r: 0.0055,
    hwFn: (u, v) => 0.0145 - Math.max(0, Math.sin((V(180) - v) * 230) * 0.0008),
    hwMax: 0.0145,
  });
  // ---------------------------------------------------------------- Verschluss im Fenster
  const P = R.PORT, pcu = (U(P[0]) + U(P[2])) / 2, pcv = (V(P[1]) + V(P[3])) / 2;
  b.part('bolt', 0, pcv, pcu);
  if (b.hi) b.box('gaBolt', 0.006, mm(P[3] - P[1]) - 0.002, mm(P[2] - P[0]) - 0.003, 0.0095, pcv, pcu, { part: 'bolt', c: 0.0008 });
  b.anchor('ejection', SHELL_W - 0.003, pcv, pcu, { rz: 0.5 });
  b.anchor('boltCatch', -SHELL_W, V(172), U(178));
  // ---------------------------------------------------------------- Beschriftung (Fantasie), Magazin
  mark(b, 'BX-20  STIER', -(SHELL_W + 0.0002), V(122), U(105), 0.0045);
  mark(b, 'KAL 5,56', -(SHELL_W + 0.0002), V(132), U(105), 0.0032);
  bx20Mag(b);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.2, gw: 0.0155, gd: 0.023, gu: 0.0, ho: 0.02, tu: 0.034 } });
  b.anchor('leftHandGrip', 0, V(186), U(489), { data: { style: 'post', rake: 0.06, gw: 0.0145, gd: 0.02, gu: 0, ho: 0.012 } });
  b.meta = { sight: 'acog', axis: AX, kind: 'rifle' };
}

function bx20Mag(b) {
  const [mx, my] = R.MAG_TOP;
  b.part('mag', 0, V(my), U(mx));
  slab(b, 'smokeTan', M(R.MAG), 0.0135, {
    r: 0.0028, part: 'mag', step: 0.0028,
    // Waffelmuster (Griffmulden) auf beiden Seiten
    mod: (d, x, v, u) => {
      if (Math.abs(x) < 0.0105) return d;
      const tilt = (V(185) - v) * 0.12;
      for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) {
        const cu = U(176 + c * 21) + tilt + (V(185) - V(196 + r * 13)) * 0.12, cv = V(196 + r * 13);
        d = pocket(d, x, v, u, 0.0135, cu, cv, 0.0095, 0.0058, 0.0025, 0.0009);
      }
      return d;
    },
  });
  if (b.hi) b.box('gaPolyDark', 0.029, 0.005, 0.07, 0, V(275), U(214), { part: 'mag', rx: 0.27, c: 0.0016 });
  magRounds(b, { cal: 'r556', width: 0.019, depth: 0.044, show: 'all', path: [[0, V(180), U(204)], [0, V(225), U(210)], [0, V(266), U(216)]] });
  b.anchor('magGrab', 0, V(225), U(210), { part: 'mag', data: { w: 0.0135, d: 0.03 } });
  b.anchor('magWell', 0, V(my), U(mx));
}
