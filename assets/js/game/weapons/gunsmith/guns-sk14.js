// SK-14 nach Referenzfoto (Mk 14 EBR, sk14-ref.js) – Waffen-Etappe 3 (13.11.2026, Nutzer: „Waffenmodelle anhand der echten
// Versionen so detailliert wie möglich“). Bauweise des Vorbilds: klassisches M14-Gehäuse (Stahl, parkerisiert) mit
// Kimmentrommel und Spannschieber rechts, eingebettet in ein Aluminium-Chassis (Sand beschichtet): langer Schienen-
// Handschutz mit Langlöchern, dunkle Seitenabdeckungen, Mittelteil mit Bohrungsreihe, Pistolengriff, M14-Abzugsbügel;
// Schiebeschaft auf zwei Stangen mit Wangenauflage und durchbrochener Kappe; Lauf mit Gaszylinder darunter, Korn mit
// Schutzohren, langer geschlitzter Mündungsfeuerdämpfer; gerades 20er-Stahlmagazin; Kompaktzielfernrohr auf der Schiene.
import * as R from './sk14-ref.js?v=20261122020853';
import { calib, slab, pocket, rib, barrel, pins, slottedHider, STEEL, POLY, ALU } from './photo-kit.js?v=20261122020853';
import { sdRoundRect } from './sdfkit.js?v=20261122020853';
import { acog } from './parts.js?v=20261122020853';
import { magRounds } from './magfill.js?v=20261122020853';
import { schrift } from './schrift.js?v=20261122020853';

const C = calib(R.PPM, R.XG, R.YG, R.YA);
const { U, V, M, AXIS: AX } = C;
const mm = (px) => px / R.PPM;
const CH_W = 0.0235, REC_W = 0.0175, GRIP_W = 0.0155, BUTT_W = 0.019;
const { mark } = schrift('sk14');
const rect = ([x0, y0, x1, y1]) => ({ cu: (U(x0) + U(x1)) / 2, cv: (V(y0) + V(y1)) / 2, hu: mm(x1 - x0) / 2, hv: mm(y1 - y0) / 2 });

export function sk14(b) {
  // ---------------------------------------------------------------- Chassis (Alu, Sand) mit Langlöchern und Bohrungen
  const slotsR = R.HG_SLOTS.map(rect);
  slab(b, 'gaTan', M(R.CHASSIS), CH_W, {
    id: 'sk14Chassis', r: 0.0028, cav: ALU,
    mod: (d, x, v, u, d2) => {
      if (d > 0.003) return d;
      for (const s of slotsR) d = Math.max(d, -Math.max(sdRoundRect(u - s.cu, v - s.cv, s.hu, s.hv, s.hv * 0.95), CH_W - 0.005 - Math.abs(x)));
      for (const [hx, hy, hr] of R.CHASSIS_HOLES) d = Math.max(d, -Math.max(Math.hypot(u - U(hx), v - V(hy)) - mm(hr), CH_W - 0.004 - Math.abs(x)));
      // Fräskanten: Stufe zwischen Handschutz (breit) und Gehäusebett
      if (u < U(500) && Math.abs(x) > REC_W + 0.003 && v > V(150)) d = Math.max(d, Math.abs(x) - (REC_W + 0.003));
      return d;
    },
  });
  // Dunkle Seitenabdeckung am Mittelteil, Picatinny-Schiene oben
  const HP = rect(R.HG_PANEL);
  if (b.hi) for (const s of [-1, 1]) b.box('gaPolyDark', 0.003, HP.hv * 2, HP.hu * 2, s * (CH_W + 0.0012), HP.cv, HP.cu, { c: 0.0012 });
  // Brückenmontage über dem Gehäuse: zwei Füße mit Klemmschrauben tragen die Schiene bis zum Handschutz
  for (const [x0, x1] of [[332, 368], [468, 522]]) {
    slab(b, 'gaTan', M([[x0, R.RAIL[2]], [x1, R.RAIL[2]], [x1, 104], [x1 - 6, 112], [x0 + 6, 112], [x0, 104]]), 0.0125, { r: 0.002, cav: ALU, id: 'sk14Mount' + x0 });
    if (b.hi) for (const s of [-1, 1]) b.cyl('gaSteel', 0.0024, 0.0024, 0.002, s * 0.0135, V(98), U((x0 + x1) / 2), { axis: 'x', seg: 12 });
  }
  if (b.hi) b.picatinny('gaTan', 0, V(R.RAIL[2]), U(R.RAIL[0]), U(R.RAIL[1]));
  else b.rail('gaTan', 0, V(R.RAIL[2]), U(R.RAIL[0]), U(R.RAIL[1]));
  // ---------------------------------------------------------------- M14-Gehäuse (Stahl) mit Kimme
  slab(b, 'gaSteel', M(R.REC), REC_W, {
    id: 'sk14Rec', r: 0.0022, cav: STEEL,
    mod: (d, x, v, u) => {
      // Auswurföffnung oben (offenes Gehäuse, Verschluss sichtbar), Ladestreifenführung
      if (u > U(420) && u < U(498) && v > V(108)) d = Math.max(d, -Math.max(Math.abs(x) - 0.0105, U(420) - u, u - U(498)));
      return d;
    },
  });
  const [rx, ry, rr] = R.RSIGHT;
  if (b.hi) {
    for (const s of [-1, 1]) b.cyl('gaSteel', mm(rr), mm(rr), 0.006, s * (REC_W + 0.003), V(ry), U(rx), { axis: 'x', seg: b.seg(20, 6) });
    if (b.max) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; b.box('cavity', 0.0062, 0.0006, 0.0006, -(REC_W + 0.003), V(ry) + Math.sin(a) * mm(rr), U(rx) + Math.cos(a) * mm(rr), { c: 0 }); }
    b.box('gaSteel', 0.012, 0.012, 0.012, 0, V(103), U(rx), { c: 0.001 });   // Kimmenblatt
    b.box('cavity', 0.0024, 0.0024, 0.013, 0, V(101), U(rx), { c: 0 });       // Lochkimme
  }
  // ---------------------------------------------------------------- Lauf, Gaszylinder, Korn, Mündungsfeuerdämpfer
  barrel(b, 'gaBlued', R.BARREL.map(([x, r]) => [U(x), mm(r)]), AX);
  const [g0, g1, gy, gr] = R.GAS;
  b.cyl('gaSteel', mm(gr), mm(gr), U(g1) - U(g0), 0, V(gy), (U(g0) + U(g1)) / 2, { seg: b.seg(18, 6) });
  const [l0, l1, ly, lr] = R.GAS_LOCK;
  b.cyl('gaSteel', mm(lr), mm(lr), U(l1) - U(l0), 0, V(ly), (U(l0) + U(l1)) / 2, { seg: b.seg(18, 6) });
  if (b.hi) {
    b.box('gaSteel', 0.012, V(104) - V(117), U(l1) - U(l0) - 0.006, 0, (V(104) + V(117)) / 2, (U(l0) + U(l1)) / 2, { c: 0.002 });
    b.side('gaSteel', M(R.FSIGHT), 0.006, 0, { bevel: 0.0008 });
    for (const s of [-1, 1]) b.box('gaSteel', 0.002, 0.016, 0.01, s * 0.006, V(86), U(890), { c: 0.0005 });   // Schutzohren
  }
  const [h0, h1, hr] = R.HIDER;
  slottedHider(b, 'gaBlued', U(h0), U(h1), AX, { r: mm(hr), ri: 0.0058, n: 5, sw: 0.0012, slot0: 0.022, collar: 0.01, closed: true });
  b.anchor('muzzle', 0, AX, U(h1) + 0.002);
  // ---------------------------------------------------------------- Griff, Abzugsbügel, Abzug
  slab(b, 'gaGrip', M(R.GRIP), GRIP_W, { id: 'sk14Grip', r: 0.0055,
    hwFn: (u, v) => GRIP_W - Math.max(0, Math.sin((V(180) - v) * 240) * 0.0007) });
  slab(b, 'gaSteel', M(R.GUARD), 0.0085, { id: 'sk14Guard', r: 0.0018, cav: STEEL, holes: [M(R.GUARD_OPEN)] });
  if (b.hi) b.side('gaSteel', M(R.TRIGGER), 0.0055, 0, { bevel: 0.0008 });
  b.anchor('trigger', 0, V(186), U(338));
  // ---------------------------------------------------------------- Schaft: Stangen, Aufnahme, Wangenauflage, Kappe
  for (const [x0, x1, y, r] of R.RODS) b.cyl('gaAlu', mm(r), mm(r), U(x1) - U(x0), 0, V(y), (U(x0) + U(x1)) / 2, { seg: b.seg(16, 6) });
  slab(b, 'gaTan', M(R.STOCK_BLOCK), 0.019, { id: 'sk14StockBlock', r: 0.003, cav: ALU });
  slab(b, 'gaPoly', M(R.CHEEK), 0.016, { id: 'sk14Cheek', r: 0.005 });
  if (b.hi) for (const s of [-1, 1]) b.box('gaAlu', 0.006, mm(14), 0.01, s * 0.008, V(150), U(150), { c: 0.001 });   // Wangenauflage-Stützen
  slab(b, 'gaPoly', M(R.BUTT), BUTT_W, {
    id: 'sk14Butt', r: 0.004,
    mod: (d, x, v, u) => {
      for (const [hx, hy, hr] of R.BUTT_HOLES) d = Math.max(d, -(Math.hypot(u - U(hx), v - V(hy)) - mm(hr)));
      return d;
    },
  });
  if (b.hi) b.box('rubber', BUTT_W * 2 + 0.002, mm(110), 0.01, 0, V(198), U(28), { rx: 0.06, c: 0.003 });
  // ---------------------------------------------------------------- Spannschieber rechts (Ruhe vorn), Verschluss
  b.part('charge', 0, V(133), U(455));
  slab(b, 'gaSteel', M(R.OPROD), 0.0035, { part: 'charge', x0: REC_W + 0.003, r: 0.0012, cav: STEEL, step: 0.0015 });
  const [kx, ky, kr] = R.OPROD_KNOB;
  if (b.hi) b.cyl('gaSteel', mm(kr), mm(kr), 0.008, REC_W + 0.009, V(ky), U(kx), { axis: 'x', part: 'charge', seg: 14 });
  b.anchor('chargeGrab', REC_W + 0.013, V(ky), U(kx), { part: 'charge', data: { travel: [0, 0, U(kx) - U(R.CHARGE_BACK)], style: 'pull' } });
  b.part('bolt', 0, V(110), U(460));
  if (b.hi) {
    b.box('gaBolt', 0.019, 0.012, 0.06, 0, V(110), U(460), { part: 'bolt', c: 0.002 });
    b.cyl('gaBolt', 0.0035, 0.0035, 0.006, 0.0105, V(108), U(445), { axis: 'x', part: 'bolt', seg: 12 });   // Rolle
  }
  b.anchor('ejection', 0.006, V(104), U(470), { rz: 0.9 });
  b.anchor('boltCatch', -REC_W, V(124), U(410));
  // ---------------------------------------------------------------- Optik, Beschriftung, Magazin
  acog(b, U(338), V(R.RAIL[2]) + 0.0077);
  mark(b, 'SK-14   7,62 × 51', -(CH_W + 0.0002), V(152), U(600), 0.0042);
  mark(b, 'NP 140213', -(REC_W + 0.0002), V(126), U(330), 0.0028);
  sk14Mag(b);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.3, gw: 0.0155, gd: 0.023, gu: 0.0, ho: 0.022, tu: 0.034 } });
  b.anchor('leftHandGrip', 0, V(152), U(650), { data: { style: 'under', w: CH_W, h: (V(90) - V(152)) / 2 } });
  b.meta = { sight: 'acog', axis: AX, kind: 'rifle' };
}

function sk14Mag(b) {
  const [mx, my] = R.MAG_TOP;
  b.part('mag', 0, V(my), U(mx));
  slab(b, 'gaMag', M(R.MAG), 0.0125, {
    r: 0.0015, part: 'mag', cav: STEEL,
    mod: (d, x, v, u) => {
      // Sicke längs + Kontrollbohrungen hinten
      d = rib(d, x, v, u, 0.0125, U(452), V(222), 0.009, mm(30), 0.002, 0.0007);
      for (let i = 0; i < 3; i++) d = Math.max(d, -Math.max(Math.hypot(u - U(428), v - V(200 + i * 18)) - 0.002, 0.0105 - Math.abs(x)));
      return d;
    },
  });
  if (b.hi) b.box('gaMag', 0.027, 0.004, mm(80), 0, V(261), U(460), { part: 'mag', c: 0.0012 });
  magRounds(b, { cal: 'r308', fit: 0.057, width: 0.021, depth: 0.06, pitch: 0.0066, path: [[0, V(176), U(459)], [0, V(220), U(459)], [0, V(258), U(460)]] });
  b.anchor('magGrab', 0, V(222), U(460), { part: 'mag', data: { w: 0.0125, d: 0.04 } });
  b.anchor('magWell', 0, V(my), U(mx));
}
