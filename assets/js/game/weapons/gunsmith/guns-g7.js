// G-7 Wächter nach Referenzfoto (G3A3, g7-ref.js) – Waffen-Etappe 3 (13.11.2026, Nutzer: „Waffenmodelle anhand der echten
// Versionen so detailliert wie möglich“). Bauweise des Vorbilds: geprägtes Stahlblechgehäuse mit aufgesetztem Spannhebelrohr
// (Querschnitt aus dem HK-Baukasten), Längssicken, Auswurffenster mit Rollenverschluss dahinter, Trommeldiopter, Kornträger
// mit runder Haube, Spannhebel links vorn („HK-Schlag“), geschlitzter Mündungsfeuerdämpfer, breiter Polymer-Handschutz,
// fester Schaft mit Fächern und Kappen, Griffstück mit Wahlhebel (S-E-F) und Haltebolzen, gerades Stahlmagazin.
// Umrisse aus dem Foto (photo-kit.js), Gehäuse und Kleinteile wie beim VP-9 (hk-parts.js).
import * as R from './g7-ref.js?v=20261115041504';
import { calib, slab, rib, groove, barrel, pins, slottedHider, STEEL } from './photo-kit.js?v=20261115041504';
import { field2, box2, sdfMesh, sdRoundRect, roundMax } from './sdfkit.js?v=20261115041504';
import { hkSection, hkDrum, hkHood, hkCockingHandle, hkSelector } from './hk-parts.js?v=20261115041504';
import { magRounds } from './magfill.js?v=20261115041504';
import { schrift } from './schrift.js?v=20261115041504';

const C = calib(R.PPM, R.XG, R.YG, R.YA);
const { U, V, M, AXIS: AX } = C;
const mm = (px) => px / R.PPM;
const TUBE_R = 0.0112;
const SEC = { hw: 0.0205, vB: V(99), vS: V(50), rS: 0.008, rB: 0.002, tubeV: V(R.TUBE[2]) - TUBE_R, tubeR: TUBE_R, k: 0.003 };
const HG_W = 0.0245, LOW_W = 0.0175, GRIP_W = 0.0158, STOCK_W = 0.0215;
const ANG = 2.8;                                   // Spannhebel links oben (Winkel um die Rohrachse)
const SIGHT_V = V(R.SIGHT_Y);
const G2 = (b, s) => (b.max ? s : b.lite ? s * 3 : s * 2.2);
const { mark } = schrift('g7');

export function g7(b) {
  // ---------------------------------------------------------------- Gehäuse (Stahlblech) mit Sicken und Auswurffenster
  if (b.hi) b.shared('g7Rec', () => g7Receiver(b));
  else b.side('gaSteel', M(R.REC), SEC.hw * 2, 0, {});
  // Spannhebelrohr bis in den Kornträger, Nut links mit Rastkerbe
  const t0 = U(R.TUBE[0]), t1 = U(R.TUBE[1]);
  b.cyl('gaSteel', TUBE_R, TUBE_R, t1 - t0, 0, SEC.tubeV, (t0 + t1) / 2, { seg: b.seg(28, 6) });
  if (b.hi) {
    const ca = Math.cos(ANG) * (TUBE_R + 0.0001), sa = Math.sin(ANG) * (TUBE_R + 0.0001);
    b.box('cavity', 0.0006, 0.0036, U(R.CHARGE_X + 18) - U(R.NOTCH_X - 6), ca, SEC.tubeV + sa, (U(R.CHARGE_X + 18) + U(R.NOTCH_X - 6)) / 2, { rz: ANG - Math.PI / 2, c: 0 });
    b.box('cavity', 0.0006, 0.0062, 0.004, ca, SEC.tubeV + sa, U(R.NOTCH_X), { rz: ANG - Math.PI / 2, c: 0 });
  }
  // Trommeldiopter auf seinem Fuß
  const [dx, dy, dr] = R.DRUM;
  const DB = R.DRUM_BASE;
  slab(b, 'gaSteel', M([[DB[0], DB[3]], [DB[0] + 4, DB[1]], [DB[2] - 4, DB[1]], [DB[2], DB[3]]]), 0.0125, { r: 0.0015, cav: STEEL, id: 'g7DrumBase' });
  if (b.hi) {
    for (const s of [-1, 1]) b.side('gaSteel', M([[366, 32], [372, 14], [378, 12], [380, 30]]), 0.0026, s * 0.0118, { bevel: 0.0006 });   // Schutzohren
    hkDrum(b, { u: U(dx), v: SIGHT_V, r: mm(dr), len: 0.019, apR: 0.0022, flat: mm(dr) * 0.88, mat: 'gaSteel', id: 'g7Drum' });
  } else b.box('gaSteel', 0.019, mm(dr) * 2, mm(dr) * 2, 0, SIGHT_V, U(dx), {});
  b.anchor('sight', 0, SIGHT_V, U(dx), { data: { type: 'iron', eyeRelief: 0.22 } });
  // ---------------------------------------------------------------- Kornträger mit Haube, Lauf, Mündungsfeuerdämpfer
  const [hx, hy, hr] = R.HOOD;
  slab(b, 'gaSteel', M(R.FSB.map(([x, y]) => [x, Math.max(y, 36)])), 0.0125, { id: 'g7Fsb', r: 0.002, cav: STEEL });
  if (b.hi) hkHood(b, { u: U(hx), v: SIGHT_V, r: mm(hr), ri: mm(hr) - 0.0022, rw: mm(hr) * 0.6, vNeck: V(40), mat: 'gaSteel', id: 'g7Hood' });
  else b.box('gaSteel', 0.008, mm(hr) * 2, 0.012, 0, SIGHT_V, U(hx), {});
  barrel(b, 'gaBlued', R.BARREL.map(([x, r]) => [U(x), r / 1000]), AX);
  const [h0, h1, hrr] = R.HIDER;
  slottedHider(b, 'gaBlued', U(h0), U(h1), AX, { r: hrr / 1000, ri: 0.0068, n: 6, sw: 0.0011, slot0: 0.012, collar: 0.006, closed: true });
  b.anchor('muzzle', 0, AX, U(h1) + 0.002);
  // ---------------------------------------------------------------- Handschutz (breit, Polymer) mit Rillen
  slab(b, 'gaPolyOD', M(R.HG), HG_W, {
    id: 'g7Hg', r: 0.008,
    mod: (d, x, v, u) => {
      if (d > 0.003) return d;
      // Längsrillen (sieben je Seite) und Laufdurchtritt
      for (let i = 0; i < 6; i++) d = groove(d, x, v, u, HG_W, U(672), U(1036), V(68 + i * 8.5), 0.0024, 0.0011);
      d = Math.max(d, -(Math.hypot(x, v - SEC.tubeV) - TUBE_R - 0.0004));
      return d;
    },
  });
  // ---------------------------------------------------------------- Griffstück, Griff, Schacht, Magazin
  slab(b, 'gaPolyOD', M(R.LOWER), LOW_W, { id: 'g7Lower', r: 0.003, holes: (R.LOWER_HOLES || []).map(M) });
  slab(b, 'gaGripOD', M(R.GRIP), GRIP_W, { id: 'g7Grip', r: 0.006 });
  slab(b, 'gaSteel', M(R.WELL), 0.0182, {
    id: 'g7Well', r: 0.0015, cav: STEEL,
    // Prägefeld (Verstärkung) schräg auf der Seite wie am Original
    mod: (d, x, v, u) => rib(d, x, v, u, 0.0182, U(612), V(118), mm(36), mm(14), 0.003, 0.0006),
  });
  if (b.hi) b.side('gaSteel', M(R.PADDLE), 0.012, 0, { bevel: 0.0012 });
  g7Mag(b);
  // ---------------------------------------------------------------- Schaft (fest, Fächer) und Schaftkappe
  slab(b, 'gaPolyOD', M(R.STOCK), STOCK_W, {
    id: 'g7Stock', r: 0.007,
    hwFn: (u) => STOCK_W - Math.min(0.003, Math.max(0, u - U(160)) * 0.025),
    mod: (d, x, v, u) => {
      for (const [cx, cy, cr] of R.STOCK_CUPS) if (Math.abs(x) > STOCK_W - 0.004) d = Math.max(d, -Math.max(Math.hypot(u - U(cx), v - V(cy)) - mm(cr), STOCK_W - 0.0016 - Math.abs(x)));
      return d;
    },
  });
  slab(b, 'gaPolyDark', M(R.BUTT), 0.0232, { id: 'g7Butt', r: 0.004 });
  if (b.hi) for (const [cx, cy, cr] of R.STOCK_CUPS) for (const s of [-1, 1]) {
    b.cyl('gaPolyDark', mm(cr) * 0.8, mm(cr) * 0.8, 0.0018, s * (STOCK_W - 0.0009), V(cy), U(cx), { axis: 'x', seg: b.seg(18, 6) });
    if (b.max) b.box('cavity', 0.0003, mm(cr) * 1.2, 0.0012, s * (STOCK_W + 0.0001), V(cy), U(cx), { c: 0 });
  }
  if (b.hi) b.torus('gaSteel', 0.007, 0.0014, 0, V(209), U(60), { ry: Math.PI / 2, tseg: 16 });   // Riemenbügel unten am Schaft
  // ---------------------------------------------------------------- Haltebolzen, Wahlhebel, Abzug
  for (const [x, y, r] of R.PINS) pins(b, 'gaSteel', y > 100 ? LOW_W : SEC.hw, V(y), U(x), mm(r));
  const [sx, sy] = R.SELECTOR;
  b.part('selector', 0, V(sy), U(sx));
  if (b.hi) {
    hkSelector(b, { v: V(sy), u: U(sx), x: LOW_W - 0.0002, mat: 'gaSteel', ptr: Math.PI * 0.62, hubR: 0.0072, tipR: 0.0058, reach: 0.021 });
    for (const [t, a, col] of [['S', 0.5, 'paintWhite'], ['E', 0.75, 'paintSignal'], ['F', 1.0, 'paintSignal']]) {
      const rr = 0.0128;
      b.box(col, 0.0003, 0.0034, 0.0034, -(LOW_W + 0.0002), V(sy) + Math.sin(Math.PI * a) * rr, U(sx) + Math.cos(Math.PI * a) * rr, { c: 0 });
    }
    b.side('gaSteel', M(R.TRIGGER), 0.0062, 0, { bevel: 0.0009, bevelSeg: 2 });
  }
  b.anchor('trigger', 0, V(175), U(496));
  // ---------------------------------------------------------------- Verschluss im Fenster, Spannhebel
  const P = { cu: (U(R.PORT[0]) + U(R.PORT[2])) / 2, cv: (V(R.PORT[1]) + V(R.PORT[3])) / 2, hu: (U(R.PORT[2]) - U(R.PORT[0])) / 2, hv: (V(R.PORT[1]) - V(R.PORT[3])) / 2 };
  b.part('bolt', 0, P.cv, P.cu);
  if (b.hi) {
    b.box('gaBolt', 0.008, P.hv * 2 - 0.002, P.hu * 2 - 0.003, 0.012, P.cv, P.cu, { part: 'bolt', c: 0.001 });
    b.cyl('gaBolt', 0.0026, 0.0026, 0.006, 0.016, P.cv - 0.002, P.cu + P.hu - 0.008, { part: 'bolt', axis: 'x', seg: 12 });   // Rolle
  }
  b.anchor('ejection', SEC.hw - 0.002, P.cv, P.cu, { rz: 0.5 });
  const cu = U(R.CHARGE_X);
  b.part('charge', 0, SEC.tubeV, cu);
  if (b.hi) hkCockingHandle(b, { u: cu, v: SEC.tubeV, tubeR: TUBE_R, ang: ANG, reach: 0.026, knobR: 0.0082, knobT: 0.009, mat: 'gaSteel', knobMat: 'knurl' });
  else b.box('gaSteel', 0.022, 0.012, 0.012, Math.cos(ANG) * 0.02, SEC.tubeV + Math.sin(ANG) * 0.02, cu, { part: 'charge' });
  b.anchor('chargeGrab', Math.cos(ANG) * 0.031, SEC.tubeV + Math.sin(ANG) * 0.031, cu, { part: 'charge', data: { travel: [0, 0, U(R.CHARGE_X) - U(R.NOTCH_X)], style: 'hkslap' } });
  // ---------------------------------------------------------------- Beschriftung (Fantasie)
  mark(b, 'G-7   7,62 × 51', -(SEC.hw + 0.0002), V(88), U(520), 0.0042);
  mark(b, 'NP  73 0419', -(SEC.hw + 0.0002), V(68), U(330), 0.0032);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.38, gw: 0.0165, gd: 0.023, gu: 0.004, ho: 0.03, tu: 0.03 } });
  b.anchor('leftHandGrip', 0, V(124), U(830), { data: { style: 'under', w: HG_W, h: (V(52) - V(124)) / 2 } });
  b.meta = { sight: 'iron', axis: AX, kind: 'rifle', selector: { semi: Math.PI * 0.25, auto: Math.PI * 0.5 } };
}

// Gehäuse: Seitenumriss × HK-Querschnitt (Rumpf + Rohr), zwei Längssicken je Seite, Auswurffenster rechts mit gerundeten
// Enden, Prägekante unten, Stirnplatte vorn (Handschutzaufnahme)
function g7Receiver(b) {
  const F = field2(M(R.REC), [], G2(b, 0.0004));
  const [u0, u1, v0, v1] = box2(M(R.REC), 0.003);
  const port = { cu: (U(R.PORT[0]) + U(R.PORT[2])) / 2, cv: (V(R.PORT[1]) + V(R.PORT[3])) / 2, hu: (U(R.PORT[2]) - U(R.PORT[0])) / 2, hv: (V(R.PORT[1]) - V(R.PORT[3])) / 2 };
  const grooves = R.GROOVES.map(([x0, x1, y]) => [U(x0), U(x1), V(y)]);
  const f = (x, v, u) => {
    const d2 = F(u, v);
    if (d2 > 0.006) return d2;
    let d = roundMax(d2, hkSection(x, v, SEC), 0.0012);
    const ax = Math.abs(x);
    for (const [g0, g1, gv] of grooves) d = groove(d, x, v, u, SEC.hw, g0 + 0.006, g1 - 0.006, gv, 0.0035, 0.0014);
    if (x > 0) d = Math.max(d, -Math.max(sdRoundRect(u - port.cu, v - port.cv, port.hu, port.hv, port.hv * 0.95), 0.008 - x));
    return d;
  };
  sdfMesh(b, f, [-SEC.hw - 0.003, v0, u0], [SEC.hw + 0.003, v1, u1], 0.0028, 'gaSteel', { cav: STEEL, fine: 0.6, lite: 1.4 });
}

function g7Mag(b) {
  const [mx, my] = R.MAG_TOP;
  b.part('mag', 0, V(my), U(mx));
  slab(b, 'gaMag', M(R.MAG), 0.0128, {
    r: 0.0015, part: 'mag', cav: STEEL,
    // Sicken längs (drei je Seite) und Bodenblech-Falz
    mod: (d, x, v, u) => {
      for (const k of [0.3, 0.5, 0.7]) d = rib(d, x, v, u, 0.0128, U(566) + (U(652) - U(566)) * k, V(222), 0.0012, mm(52), 0.001, 0.0006);
      return d;
    },
  });
  if (b.hi) b.box('gaMag', 0.028, 0.004, U(658) - U(566), 0, V(284), (U(566) + U(658)) / 2, { part: 'mag', c: 0.0012 });
  magRounds(b, { cal: 'r308', fit: 0.046, width: 0.023, depth: 0.05, path: [[0, V(150), U(606)], [0, V(220), U(608)], [0, V(280), U(611)]] });
  b.anchor('magGrab', 0, V(225), U(610), { part: 'mag', data: { w: 0.0128, d: 0.034 } });
  b.anchor('magWell', 0, V(my), U(mx));
}
