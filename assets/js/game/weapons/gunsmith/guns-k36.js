// K-36 Kurzer nach Referenzbild (G36C, k36-ref.js) – Waffen-Etappe 3 (13.11.2026, Nutzer: „Waffenmodelle anhand der echten
// Versionen so detailliert wie möglich“). Bauweise des Vorbilds: Gehäuse aus glasfaserverstärktem Polymer mit eingegossenem
// Stahl, Tragegriff mit Picatinny-Schiene (Rotpunkt darauf), Ladehebel unter dem Tragegriff (läuft im Fenster), kurzer
// Handschutz mit Kühlschlitzen, vierzinkiger Mündungsfeuerdämpfer, seitlich klappbarer Skelettschaft mit Gummikappe,
// Griffstück mit Abzugsbügel und Paddel-Magazinhalter, beidseitiger Wahlhebel, durchscheinendes Magazin mit Kuppelzapfen.
// Umrisse aus dem Foto (photo-kit.js: Distanzfeld-Platten), Rundteile gedreht, Kleinteile von Hand.
import * as R from './k36-ref.js?v=20261115041504';
import { calib, slab, pocket, rib, barrel, pins, slottedHider, STEEL, POLY } from './photo-kit.js?v=20261115041504';
import { sdRoundRect } from './sdfkit.js?v=20261115041504';
import { redDot } from './parts.js?v=20261115041504';
import { magRounds } from './magfill.js?v=20261115041504';
import { schrift } from './schrift.js?v=20261115041504';

const C = calib(R.PPM, R.XG, R.YG, R.YA);
const { U, V, M, AXIS: AX } = C;
const REC_W = 0.0195;   // Gehäuse halbe Breite (≈ 39 mm)
const HG_W = 0.0205;    // Handschutz
const LOW_W = 0.0168;   // Griffstück oben
const GRIP_W = 0.0152;  // Griff
const HANDLE_W = 0.0128;
const STOCK_W = 0.0158;
const { mark } = schrift('k36');
const rectU = ([x0, y0, x1, y1]) => ({ cu: (U(x0) + U(x1)) / 2, cv: (V(y0) + V(y1)) / 2, hu: Math.abs(U(x1) - U(x0)) / 2, hv: Math.abs(V(y0) - V(y1)) / 2 });

export function k36(b) {
  // ---------------------------------------------------------------- Gehäuse (Polymer) mit Auswurffenster
  const P = rectU(R.PORT), D = rectU(R.DEFLECTOR);
  slab(b, 'gaPoly', M(R.REC), REC_W, {
    id: 'k36Rec', r: 0.003, cav: POLY,
    mod: (d, x, v, u) => {
      if (d > 0.003) return d;
      // Auswurffenster rechts (Tiefe bis zur Verschlussbahn), Hülsenabweiser dahinter erhaben
      if (x > 0) d = Math.max(d, -Math.max(sdRoundRect(u - P.cu, v - P.cv, P.hu, P.hv, 0.0018), 0.006 - x));
      if (x > 0) d = rib(d, x, v, u, REC_W, D.cu, D.cv, D.hu, D.hv, 0.0015, 0.0022);
      // Seitliche Versteifungsfelder (eingelassen) hinten oben und eine Längsnut über dem Fenster
      d = pocket(d, x, v, u, REC_W, (U(240) + U(300)) / 2, (V(57) + V(68)) / 2, (U(300) - U(240)) / 2, (V(57) - V(68)) / 2, 0.0015, 0.0008);
      if (Math.abs(x) > REC_W - 0.002 && Math.abs(v - V(69)) < 0.0007 && u > U(318) && u < U(395)) d = Math.max(d, -(0.0005 - (REC_W - Math.abs(x)) + 0.0005));
      return d;
    },
  });
  // Tragegriff mit Fenster (Ladehebel sichtbar), Kimmenblock hinten, Kornträger vorn
  slab(b, 'gaPoly', M(R.HANDLE), HANDLE_W, {
    id: 'k36Handle', r: 0.0025, holes: [M(R.HANDLE_WINDOW)],
    mod: (d, x, v, u) => {
      // Durchblick-Kimme im hinteren Block (Querbohrung längs) – nur sichtbarer Schlitz
      if (u < U(268) && v > V(40)) d = Math.max(d, -Math.max(Math.abs(x) - 0.0022, Math.abs(v - V(34)) - 0.0022));
      return d;
    },
  });
  if (b.hi) b.picatinny('gaAlu', 0, V(R.RAIL[2]), U(R.RAIL[0]), U(R.RAIL[1]));
  else b.rail('gaAlu', 0, V(R.RAIL[2]), U(R.RAIL[0]), U(R.RAIL[1]));
  // Schachtteil des Gehäuses
  slab(b, 'gaPoly', M(R.WELL), 0.0182, { id: 'k36Well', r: 0.0022 });
  // ---------------------------------------------------------------- Griffstück mit Abzugsbügel und Griff
  slab(b, 'gaPoly', M(R.LOWER), LOW_W, { id: 'k36Lower', r: 0.0026, holes: [M(R.GUARD_OPEN)] });
  slab(b, 'gaGrip', M(R.GRIP), GRIP_W, {
    id: 'k36Grip', r: 0.005,
    // Fingermulden vorn als flache Wellen, Daumenauflage oben
    hwFn: (u, v) => GRIP_W - Math.max(0, Math.sin((V(115) - v) * 260) * 0.0005),
  });
  // ---------------------------------------------------------------- Handschutz (Polymer) mit Kühlschlitzen
  const vents = R.HG_VENTS.map(rectU);
  slab(b, 'gaPoly', M(R.HG), HG_W, {
    id: 'k36Hg', r: 0.004,
    mod: (d, x, v, u) => {
      if (d > 0.003) return d;
      for (const s of vents) d = Math.max(d, -Math.max(sdRoundRect(u - s.cu, v - s.cv, s.hu, s.hv, 0.0018), HG_W - 0.004 - Math.abs(x)));
      // untere Längsrippen
      for (let i = 0; i < 4; i++) d = pocket(d, x, v, u, HG_W, U(410 + i * 30) + 0.009, V(92), 0.009, 0.0035, 0.0012, 0.0012);
      // Laufdurchtritt vorn
      if (u > U(526)) d = Math.max(d, -(Math.hypot(x, v - AX) - 0.0102));
      return d;
    },
  });
  // ---------------------------------------------------------------- Lauf, Mündungsfeuerdämpfer, Riemenbügel
  const mu0 = U(R.MUZZLE_U[0]), mu1 = U(R.MUZZLE_U[1]);
  if (b.hi) {
    barrel(b, 'gaBlued', [[U(520), 0.0084], [mu0 + 0.001, 0.0084]], AX);
    slottedHider(b, 'gaBlued', mu0, mu1, AX, { r: 0.0106, ri: 0.0064, n: 4, phase: Math.PI / 4 });
  } else {
    slottedHider(b, 'gaBlued', mu0, mu1, AX);
  }
  b.anchor('muzzle', 0, AX, mu1 + 0.002);
  slab(b, 'gaSteel', M(R.LOOP), 0.006, { id: 'k36Loop', r: 0.0012, cav: STEEL, holes: [M([[521.5, 112], [529.5, 112], [529.5, 121], [521.5, 121]])], noLow: true });
  // ---------------------------------------------------------------- Schaft (Skelett, klappt nach rechts) + Kappe
  slab(b, 'gaPoly', M(R.STOCK), STOCK_W, {
    id: 'k36Stock', r: 0.0035, holes: R.STOCK_HOLES.map(M),
    hwFn: (u) => STOCK_W - Math.max(0, (U(140) - u)) * 0.012,
    mod: (d, x, v, u) => {
      // Schaftgelenk: Knöchel rechts, darüber Rastknopf
      if (u > U(R.HINGE[0]) && u < U(R.HINGE[1]) && Math.abs(x) > STOCK_W - 0.0016) d = Math.max(d, -Math.max(0.0007 - Math.abs(u - (U(R.HINGE[0]) + U(R.HINGE[1])) / 2), STOCK_W - 0.0007 - Math.abs(x)));
      return d;
    },
  });
  slab(b, 'rubber', M(R.BUTT), 0.0172, { id: 'k36Butt', r: 0.004, cav: POLY });
  if (b.hi) {
    const hu = (U(R.HINGE[0]) + U(R.HINGE[1])) / 2;
    for (const [y0, y1] of [[58, 70], [76, 88], [93, 102]]) b.cyl('gaPoly', 0.0042, 0.0042, V(y0) - V(y1), STOCK_W + 0.0022, (V(y0) + V(y1)) / 2, hu, { axis: 'v', seg: b.seg(16, 6) });
    b.cyl('gaSteel', 0.0016, 0.0016, V(56) - V(104), STOCK_W + 0.0022, (V(56) + V(104)) / 2, hu, { axis: 'v', seg: 10 });
    // Riemenöse hinten (Schaft) – Stahlbügel
    b.torus('gaSteel', 0.0045, 0.0011, 0, V(110), U(92), { ry: Math.PI / 2, tseg: 16 });
  }
  // ---------------------------------------------------------------- Stifte, Wahlhebel, Abzug, Magazinhalter
  for (const [x, y, r] of R.PINS) pins(b, 'gaSteel', x > 300 && y > 100 ? LOW_W : REC_W, V(y), U(x), r / R.PPM);
  const [sx, sy] = R.SELECTOR;
  b.part('selector', 0, V(sy), U(sx));
  if (b.hi) {
    for (const s of [-1, 1]) {
      b.cyl('gaPolyDark', 0.0058, 0.0058, 0.002, s * (REC_W + 0.0011), V(sy), U(sx), { axis: 'x', part: 'selector', seg: b.seg(20, 6) });
      // Hebel nach hinten oben (Stellung Sicher), Daumenfläche geriffelt
      b.box('gaPolyDark', 0.0024, 0.0068, 0.024, s * (REC_W + 0.0013), V(sy) + 0.004, U(sx) - 0.009, { part: 'selector', rx: 0.38, c: 0.0009 });
      if (b.max) for (let i = 0; i < 4; i++) b.box('cavity', 0.0004, 0.006, 0.0006, s * (REC_W + 0.0026), V(sy) + 0.0068 - i * 0.0012, U(sx) - 0.016 - i * 0.0028, { part: 'selector', rx: 0.38, c: 0 });
      mark(b, s > 0 ? 'S  E  F' : 'S  E  F', s * (LOW_W + 0.0002), V(103.5), U(262), 0.0026);
    }
  }
  if (b.hi) {
    b.side('gaSteel', M(R.TRIGGER), 0.0058, 0, { bevel: 0.0008, bevelSeg: 2 });
    b.side('gaPolyDark', M(R.PADDLE), 0.0145, 0, { bevel: 0.0014, bevelSeg: 2 });
  }
  b.anchor('trigger', 0, V(124), U(293));
  b.anchor('boltCatch', -0.0, V(116), U(309));
  // ---------------------------------------------------------------- Verschluss im Fenster, Ladehebel
  b.part('bolt', 0, P.cv, P.cu);
  if (b.hi) {
    b.box('gaBolt', 0.006, P.hv * 2 - 0.001, P.hu * 2 - 0.002, 0.004, P.cv, P.cu, { part: 'bolt', c: 0.0008 });
    b.box('gaBolt', 0.003, 0.0035, 0.008, 0.0072, P.cv + 0.0012, P.cu + P.hu - 0.006, { part: 'bolt', c: 0.0004 });   // Auszieher
  }
  b.anchor('ejection', REC_W - 0.002, P.cv, P.cu, { rz: 0.5 });
  if (b.hi) b.anchor('boltFace', 0.004, P.cv, P.cu + P.hu - 0.002, { part: 'bolt' });
  const [cx, cy] = R.CHARGE;
  b.part('charge', 0, V(cy), U(cx));
  if (b.hi) {
    // Ladehebel: Schlitten im Fenster, Klappgriff nach links ausgeklappt (wie beim Durchladen)
    b.box('gaSteel', 0.009, 0.006, 0.026, 0, V(cy), U(cx) - 0.004, { part: 'charge', c: 0.001 });
    b.box('gaPolyDark', 0.026, 0.0055, 0.011, -0.016, V(cy) + 0.0005, U(cx) + 0.004, { part: 'charge', c: 0.0015 });
    b.cyl('gaPolyDark', 0.0034, 0.0034, 0.011, -0.029, V(cy) + 0.0005, U(cx) + 0.004, { part: 'charge', seg: 12 });
  } else b.box('gaSteel', 0.03, 0.006, 0.012, -0.012, V(cy), U(cx), { part: 'charge' });
  b.anchor('chargeGrab', -0.03, V(cy), U(cx) + 0.004, { part: 'charge', data: { travel: [0, 0, U(cx) - U(R.CHARGE_BACK)], style: 'pull' } });
  // ---------------------------------------------------------------- Optik (Rotpunkt auf dem Tragegriff)
  redDot(b, U(318), V(R.RAIL[2]) + 0.0077);
  // ---------------------------------------------------------------- Beschriftung (Fantasie)
  mark(b, 'K-36  KAL 5,56', -(REC_W + 0.0002), V(88), U(340), 0.0034);
  mark(b, 'NP 041376', REC_W + 0.0002, V(92), U(345), 0.0026);
  // ---------------------------------------------------------------- Magazin (durchscheinend, Kuppelzapfen)
  k36Mag(b);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0.34, gw: 0.0152, gd: 0.022, gu: 0.0, ho: 0.02, tu: 0.034 } });
  b.anchor('leftHandGrip', 0, V(104), U(470), { data: { style: 'under', w: HG_W, h: (V(60) - V(104)) / 2 } });
  b.meta = { sight: 'reddot', axis: AX, kind: 'rifle' };
}

function k36Mag(b) {
  const [mx, my] = R.MAG_TOP;
  b.part('mag', 0, V(my), U(mx));
  slab(b, 'smokeGrey', M(R.MAG), 0.0134, { r: 0.003, part: 'mag', step: 0.0026,
    mod: (d, x, v, u) => {
      // Längsrippen (Verstärkung) auf beiden Seiten
      for (const k of [0.25, 0.75]) {
        const cu = U(330) + (U(378) - U(330)) * k + (V(140) - v) * 0.2;
        d = rib(d, x, v, u, 0.0134, cu, (V(145) + V(205)) / 2, 0.0011, (V(145) - V(205)) / 2, 0.0008, 0.0007);
      }
      return d;
    },
  });
  if (b.hi) {
    // Kuppelzapfen (links/rechts oben), Bodenplatte
    for (const s of [-1, 1]) b.box('smokeDark', 0.003, 0.006, 0.008, s * 0.0148, V(150), U(345), { part: 'mag', c: 0.001 });
    b.box('gaPolyDark', 0.029, 0.005, 0.068, 0, V(215), U(367), { part: 'mag', rx: 0.29, c: 0.0016 });
  }
  magRounds(b, { cal: 'r556', width: 0.021, depth: 0.05, show: 'all', path: [[0, V(124), U(352)], [0, V(165), U(358)], [0, V(208), U(366)]] });
  b.anchor('magGrab', 0, V(180), U(360), { part: 'mag', data: { w: 0.0134, d: 0.03 } });
  b.anchor('magWell', 0, V(my), U(mx));
}
