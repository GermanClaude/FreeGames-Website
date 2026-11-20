// Baukasten der Waffen-Welle 3 (20.11.2026, Nutzerwunsch „mehr Waffen, alle enorm detailliert“): wiederkehrende Bauteile der
// neuen, frei erfundenen Waffen (guns-neu-a.js, guns-neu-b.js) – Pistolengriff mit Fingermulden, Abzugsbügel mit Abzug und
// Stiften, Kastenmagazin mit Sicken/Bodenplatte/Prüflöchern und sichtbaren Patronen, Laufprofile, Korn mit Schutzring, Kimme,
// Riemenbügel, Wahlhebel, Spannhebel, sichtbarer Verschluss im Auswurffenster, Holzschaft mit Fischhaut.
// Alle Körper als Distanzfeld-Bauteile (gbkit.slab: gerundete Kanten, Kanten-/Muldenfarbe) oder fein gefaste Grundkörper; die
// Bot-Stufe (b.hi = false) bekommt die einfache Profil-Extrusion bzw. lässt Kleinteile weg (builder.js).
// Koordinaten wie im Bauplan: x quer (rechts +), v hoch, u nach vorn, Meter, Ursprung = Griffpunkt der rechten Hand.
import { slab, rrect, pocket, POLY, STEEL } from './gbkit.js?v=20261115041504';
import { magRounds } from './magfill.js?v=20261115041504';
import { pinHead, slotScrew, notchSight, bladeSight } from './pistol-parts.js?v=20261115041504';
import { muzzleDevice } from './parts.js?v=20261115041504';

export { slab, rrect, pocket, POLY, STEEL, pinHead, slotScrew };

/** Millimeter → Meter für Punktlisten [[u, v], …]. */
export const mm = (pts) => pts.map(([u, v]) => [u / 1000, v / 1000]);
const lerp = (a, c, t) => a + (c - a) * t;

/**
 * Pistolengriff: Vorderkante mit drei Fingermulden, Handballen-Wölbung hinten, Bodenkappe. top = Oberkante (v), rake = Neigung
 * (rad, Griff fällt nach hinten), h = Länge, w = Tiefe (u), hw = halbe Breite. o.cap: eigene Bodenkappe (Material).
 */
export function pistolGrip(b, mat, o = {}) {
  const top = o.top ?? 0.004, h = o.h ?? 0.1, w = o.w ?? 0.05, rake = o.rake ?? 0.3, hw = o.hw ?? 0.0145;
  const u0 = o.u ?? 0.0;   // Mitte der Oberkante
  const sk = Math.tan(rake);
  const P = (fu, fv) => [u0 + fu - (top - fv) * sk, fv];   // Verschiebung nach hinten mit der Tiefe
  const pts = [];
  // Vorderkante (oben → unten) mit Fingermulden
  const n = b.hi ? 18 : 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n, v = top - t * h;
    const groove = o.grooves === false ? 0 : Math.max(0, Math.sin(t * Math.PI * 3.2 + 0.4)) * 0.0028 * (t > 0.12 && t < 0.92 ? 1 : 0);
    pts.push(P(w * 0.5 - groove - (t < 0.08 ? (0.08 - t) * 0.05 : 0), v));
  }
  // Boden (leicht ausgestellt), Rückseite mit Wölbung
  pts.push(P(w * 0.46, top - h - 0.004), P(-w * 0.52, top - h - 0.004));
  for (let i = n; i >= 0; i--) {
    const t = i / n, v = top - t * h;
    const swell = Math.sin(t * Math.PI) * (o.swell ?? 0.005);
    pts.push(P(-w * 0.5 - swell - (t < 0.1 ? (0.1 - t) * (o.tang ?? 0.12) : 0), v));
  }
  slab(b, pts, (u, v) => hw * (0.92 + 0.08 * Math.sin(Math.min(1, (top - v) / h) * Math.PI)), Math.min(0.0065, hw * 0.45), mat, { hwMax: hw, id: o.id, cav: POLY, part: o.part });
  if (b.hi && o.cap !== false) {
    const bu = u0 - (h + 0.002) * sk;
    b.box(o.cap || 'gaPolyDark', hw * 2 + 0.001, 0.005, w * 1.02, 0, top - h - 0.002, bu - 0.001, { c: 0.0018, rx: -rake * 0.3 });
  }
  if (b.hi && o.screw !== false) slotScrew(b, 'gaSteel', hw + 0.0002, top - h * 0.45, u0 - h * 0.45 * sk, 0.0028);
  return { bottomU: u0 - h * sk, bottomV: top - h };
}

/**
 * Abzugsbügel (gerundet, als Ring-Bauteil) + gebogener Abzug + Abzugs-/Hammerstifte. u0/u1 = hinteres/vorderes Bügelende an
 * der Unterkante des Griffstücks (vTop), depth = lichte Tiefe. o.hw: Halbbreite Gehäuse (für Stifte), o.mat: Bügelmaterial.
 */
export function triggerUnit(b, o) {
  const { u0, u1, vTop, depth } = o, t = o.t ?? 0.0042, mat = o.mat ?? 'gaSteel';
  const vb = vTop - depth;
  const outer = [[u0 - t, vTop + 0.002], [u0 - t, vb + 0.004], [u0 + 0.006, vb - t], [u1 - 0.008, vb - t], [u1 + t, vb + 0.006], [u1 + t, vTop + 0.002]];
  const inner = [[u0, vTop + 0.002], [u0, vb + 0.006], [u0 + 0.008, vb], [u1 - 0.009, vb], [u1, vb + 0.008], [u1, vTop + 0.002]];
  if (!o.noGuard) slab(b, outer, o.gw ?? 0.0055, 0.0018, mat, { holes: [inner], id: o.id ? o.id + '-guard' : null, cav: STEEL, step: 0.0015 });
  // Abzug: gebogenes Blatt mit Rillen auf der Vorderseite
  const tu = lerp(u0, u1, o.pos ?? 0.42), tv = vTop + 0.003;
  const blade = [];
  const n = b.hi ? 8 : 3;
  for (let i = 0; i <= n; i++) { const a = i / n; blade.push([tu + 0.0035 - Math.sin(a * 1.4) * 0.006 * 0.9 + a * 0.001, tv - a * depth * 0.78]); }
  for (let i = n; i >= 0; i--) { const a = i / n; blade.push([tu - 0.0005 - Math.sin(a * 1.4) * 0.006 * 0.9 - a * 0.0025, tv - a * depth * 0.78]); }
  b.side(o.trigMat ?? 'gaBolt', blade, 0.0058, 0, { bevel: 0.0009, bevelSeg: b.hi ? 2 : 1 });
  if (b.hi) for (let i = 1; i < 5; i++) { const a = 0.2 + i * 0.13; b.box('cavity', 0.006, 0.0005, 0.0006, 0, tv - a * depth * 0.78, tu + 0.0036 - Math.sin(a * 1.4) * 0.0054 + a * 0.001 + 0.0002, { c: 0 }); }
  b.anchor('trigger', 0, tv - depth * 0.45, tu - 0.002);
  // Stifte (Abzug, Hammer) beidseitig
  if (b.hi && o.hw) for (const [du, dv, r] of o.pins ?? [[0.0, 0.012, 0.0024], [-0.032, 0.014, 0.0024]]) pinHead(b, 'gaBolt', o.hw, vTop + dv, tu + du, r);
}

/**
 * Kastenmagazin als Teil 'mag': Seitenprofil pts (Wand dick hw), Längssicken, Bodenplatte mit Halteplatte, Prüflöcher (Zahlen),
 * sichtbare Patronen (magRounds) und Anker magGrab/magWell. o: { pts, hw, mat, pivot [v, u], cal, fit, width, depth, path,
 * ribs (Anzahl Sicken), floor ([u0, u1, v]), holes ([[u, v], …] Prüflöcher links), show, id }
 */
export function boxMag(b, o) {
  const [pv, pu] = o.pivot, mat = o.mat ?? 'gaMag';
  b.part('mag', 0, pv, pu);
  const hw = o.hw ?? 0.0115;
  const ribs = o.ribs ?? 2;
  const cutMag = ribs ? (x, v, u, d) => {
    // Längssicken (eingeprägt, 0,6 mm tief) – folgen der Rückenlinie über einen Versatz
    for (let i = 0; i < ribs; i++) {
      const cu = o.ribU ? o.ribU(v, i) : pu - 0.008 + i * 0.012;
      if (v < pv - 0.012 && v > pv - (o.ribLen ?? 0.12)) {
        const groove = Math.max(hw - 0.0007 - Math.abs(x), Math.abs(u - cu) - 0.0035);   // < 0 im Rillenraum (außen, im Streifen)
        d = Math.max(d, -groove);
      }
    }
    return d;
  } : null;
  slab(b, o.pts, hw, Math.min(0.0028, hw * 0.3), mat, { part: 'mag', cav: STEEL, cut: cutMag, step: o.step ?? 0.0016 });
  if (o.floor) {
    const [f0, f1, fv] = o.floor;
    b.box(o.floorMat ?? mat, hw * 2 + 0.003, 0.006, f1 - f0 + 0.004, 0, fv - 0.003, (f0 + f1) / 2, { part: 'mag', c: 0.0016 });
    if (b.hi) {
      b.box('cavity', hw * 2 + 0.0034, 0.0007, f1 - f0 - 0.004, 0, fv - 0.0055, (f0 + f1) / 2, { part: 'mag', c: 0 });                  // Fuge Bodenplatte
      b.cyl('gaBolt', 0.0022, 0.0022, 0.0012, 0, fv - 0.0062, f0 + 0.01, { part: 'mag', axis: 'v', seg: 12 });                            // Arretierknopf
    }
  }
  if (b.hi && o.holes) for (const [hu, hv] of o.holes) {
    b.circle('cavity', 0.0018, -hw - 0.0002, hv, hu, { part: 'mag', ry: -Math.PI / 2, seg: 10 });
    b.circle('brass', 0.0016, -hw + 0.0012, hv, hu, { part: 'mag', ry: -Math.PI / 2, seg: 10 });
  }
  if (o.cal) magRounds(b, { cal: o.cal, fit: o.fit, width: o.width ?? hw * 1.6, depth: o.depth ?? 0.05, path: o.path, show: o.show, pitch: o.pitch, follower: o.follower, stagger: o.stagger });
  b.anchor('magGrab', 0, o.grab?.[0] ?? pv - 0.05, o.grab?.[1] ?? pu, { part: 'mag', data: { w: hw + 0.002, d: o.grabD ?? 0.032 } });
  b.anchor('magWell', 0, pv, pu);
}

/** Lauf als Drehteil mit Stufen: prof = [[du, r], …] ab u0 entlang der Achse. */
export function barrel(b, mat, axis, u0, prof, o = {}) {
  b.lathe(mat, [[0, 0], ...prof, [prof[prof.length - 1][0], 0]], 0, axis, u0, { seg: b.seg(o.seg ?? 24, 8), ...o });
}

/**
 * Korn: Sockel (Ring um den Lauf, Klemmschraube), Kornfuß, Kornsäule bis vTop, optional Schutzring (hood) oder Schutzohren.
 * Liefert nichts; die Visierhöhe ist vTop.
 */
export function frontSight(b, mat, axis, u, vTop, o = {}) {
  const r = o.r ?? 0.0115, base = o.base ?? axis + r * 0.7;
  b.lathe(mat, [[-0.009, 0], [-0.009, r + 0.003], [-0.007, r + 0.0045], [0.007, r + 0.0045], [0.009, r + 0.003], [0.009, 0]], 0, axis, u, { seg: b.seg(24, 8) });
  b.side(mat, [[u - 0.008, axis + r], [u + 0.008, axis + r], [u + 0.006, base + 0.012], [u - 0.004, base + 0.012]], 0.009, 0, { bevel: 0.001 });
  const postTop = vTop;
  bladeSight(b, mat, [[u - 0.0012, base + 0.01], [u + 0.0022, base + 0.01], [u + 0.0012, postTop], [u - 0.0012, postTop]], 0.0011, { dot: o.dot ? { u: u - 0.0012, v: postTop - 0.001 } : null });
  if (o.hood) {
    b.torus(mat, 0.0105, 0.0016, 0, postTop - 0.002, u + 0.001, { arc: Math.PI * 1.05, rz: -0.025, seg: b.seg(8, 3), tseg: b.seg(20, 6) });
    for (const s of [-1, 1]) b.box(mat, 0.003, postTop - base - 0.012, 0.007, s * 0.0105, (postTop + base + 0.012) / 2 - 0.002, u + 0.001, { c: 0.0006 });
  } else if (o.ears) {
    for (const s of [-1, 1]) b.side(mat, [[u - 0.006, base + 0.01], [u + 0.006, base + 0.01], [u + 0.004, postTop + 0.002], [u - 0.004, postTop + 0.002]], 0.0026, s * 0.0085, { bevel: 0.0005 });
  }
  if (b.hi) b.screw('gaBolt', 0, axis - r - 0.0045, u, 'v', 0.002);
}

/**
 * Kimme (Rechteckkimme) auf einem Sockel: vBase Unterkante, vSight Visierlinie (Kimmengrund), u = Lage, optional Schutzohren
 * und Seitenschraube. Setzt den Anker 'sight' (eyeRelief).
 */
export function rearNotch(b, mat, u, vBase, vSight, o = {}) {
  const hw = o.hw ?? 0.008;
  b.box(mat, hw * 2 + 0.006, vSight - vBase - 0.004, 0.016, 0, (vSight + vBase) / 2 - 0.002, u, { c: 0.0012 });
  notchSight(b, mat, [[u - 0.003, vSight - 0.004], [u + 0.002, vSight - 0.004], [u + 0.0015, vSight + 0.0035], [u - 0.0025, vSight + 0.0035]], hw, { nw: o.nw ?? 0.0026, vN: vSight, bevel: 0.0003 });
  if (o.ears) for (const s of [-1, 1]) b.side(mat, [[u - 0.007, vSight - 0.004], [u + 0.006, vSight - 0.004], [u + 0.004, vSight + 0.006], [u - 0.006, vSight + 0.006]], 0.0024, s * (hw + 0.004), { bevel: 0.0005 });
  if (b.hi) slotScrew(b, 'gaSteel', hw + 0.003, (vSight + vBase) / 2 - 0.002, u, 0.002, 1);
  b.anchor('sight', 0, vSight, u, { data: { type: 'iron', eyeRelief: o.eye ?? 0.26 } });
}

/** Riemenbügel (Öse) quer an einer Seite oder unten. */
export function swivel(b, mat, x, v, u, o = {}) {
  if (!b.hi) return;
  if (o.under) {
    b.box(mat, 0.008, 0.006, 0.014, x, v - 0.003, u, { c: 0.001 });
    b.torus(mat, 0.009, 0.0016, x, v - 0.012, u, { ry: Math.PI / 2, seg: 6, tseg: 16 });
  } else {
    b.cyl(mat, 0.004, 0.004, 0.006, x, v, u, { axis: 'x', seg: 10 });
    b.torus(mat, 0.009, 0.0016, x + Math.sign(x || 1) * 0.004, v - 0.008, u, { rx: Math.PI / 2, seg: 6, tseg: 16 });
  }
}

/** Wahlhebel als Teil 'selector' (dreht um die Querachse): Nabe + Flügel nach hinten oben, beidseitig oder nur links. */
export function selectorLever(b, mat, xs, v, u, o = {}) {
  b.part('selector', 0, v, u);
  for (const s of o.both ? [-1, 1] : [-1]) {
    b.cyl(mat, 0.0042, 0.0042, 0.0022, s * (xs + 0.0011), v, u, { part: 'selector', axis: 'x', seg: b.seg(16, 6) });
    b.side(mat, [[u - 0.002, v + 0.0028], [u - 0.019, v + 0.004], [u - 0.021, v + 0.0005], [u - 0.019, v - 0.002], [u - 0.002, v - 0.0028]], 0.0018, s * (xs + 0.0024), { part: 'selector', bevel: 0.0005 });
    if (b.hi) for (let i = 0; i < 3; i++) b.box('cavity', 0.0004, 0.004, 0.0005, s * (xs + 0.0034), v + 0.0011, u - 0.012 - i * 0.0025, { part: 'selector', c: 0 });
  }
  // Stellungsmarken (S/E/F) als Punkte auf der linken Seite
  if (b.hi && o.marks !== false) for (const [i, a] of [[0, 0], [1, 0.8], [2, 1.6]].map(([i, a]) => [i, a + 0.9])) {
    b.circle(i === 2 ? 'paintSignal' : 'paintWhite', 0.0009, -xs - 0.0002, v + Math.sin(a) * 0.009, u - Math.cos(a) * 0.009, { ry: -Math.PI / 2, seg: 10 });
  }
}

/** Sichtbarer Verschluss im Auswurffenster als Teil 'bolt' (blanker Verschlussträger mit Auszieherkralle und Riefen). */
export function boltInPort(b, x, v, u, l, h, o = {}) {
  // Fenster: dunkle Rückwand 6 mm innen, davor der blanke Verschluss 1,5 mm unter der Gehäusefläche
  b.part('bolt', 0, v, u);
  b.box('gaBolt', 0.004, h * 0.86, l * 0.92, x - 0.0035, v, u, { part: 'bolt', c: 0.0007 });
  if (b.hi) {
    b.box('gaBolt', 0.0012, h * 0.28, 0.009, x - 0.0012, v + h * 0.2, u + l * 0.3, { part: 'bolt', c: 0.0003 });   // Auszieher
    for (let i = 0; i < 5; i++) b.box('cavity', 0.0004, h * 0.62, 0.0007, x - 0.0014, v - h * 0.05, u - l * 0.36 + i * 0.0028, { part: 'bolt', c: 0 });   // Riefen
    b.cyl('gaBolt', 0.0016, 0.0016, 0.0012, x - 0.0012, v - h * 0.22, u + l * 0.12, { part: 'bolt', axis: 'x', seg: 10 });          // Schlagbolzen-Haltestift
  }
  b.box('cavity', 0.002, h, l, x - 0.0065, v, u, { c: 0 });
  if (b.hi) {
    b.box(o.mat ?? 'gaSteel', 0.0026, 0.0016, l + 0.004, x, v + h / 2 + 0.0008, u, { c: 0.0005 });
    b.box(o.mat ?? 'gaSteel', 0.0026, 0.0016, l + 0.004, x, v - h / 2 - 0.0008, u, { c: 0.0005 });
  }
  b.anchor('ejection', x + 0.004, v, u, { rz: o.rz ?? 0.4 });
}

/** Spannhebel als Teil 'charge' (rechts oder links): Schaft + Griffknopf (gerändelt), Anker chargeGrab. */
export function chargeKnob(b, mat, side, x, v, u, travel, style = 'right', o = {}) {
  b.part('charge', x, v, u);
  const s = side;
  b.box(mat, 0.006, 0.008, o.len ?? 0.022, x + s * 0.002, v, u, { part: 'charge', c: 0.0012 });
  b.cyl(mat, o.r ?? 0.0058, (o.r ?? 0.0058) * 1.1, o.stem ?? 0.018, x + s * (0.003 + (o.stem ?? 0.018) / 2), v, u + (o.knobU ?? 0.006), { part: 'charge', axis: 'x', seg: b.seg(16, 6) });
  if (b.hi) b.cyl('knurl', (o.r ?? 0.0058) * 1.12, (o.r ?? 0.0058) * 1.12, 0.006, x + s * (0.003 + (o.stem ?? 0.018) - 0.003), v, u + (o.knobU ?? 0.006), { part: 'charge', axis: 'x', seg: 18 });
  b.anchor('chargeGrab', x + s * (0.003 + (o.stem ?? 0.018)), v, u + (o.knobU ?? 0.006), { part: 'charge', data: { travel: [0, 0, travel], style } });
}

/** Mündungsgerät der Werkswaffe oder Aufsatz aus b.att (muzzleDevice). kind: 'cage' | 'brake' | 'cone'. → vorderes Ende u */
export function ownMuzzle(b, kind, u0, axis, r, mat = 'gaBlued') {
  if (b.att && b.att.muendung) return muzzleDevice(b, b.att.muendung, u0, axis, r);
  if (kind === 'brake') {
    const R = r * 1.45, L = 0.058;
    b.lathe(mat, [[0, 0], [0, R * 0.9], [0.004, R], [L - 0.004, R], [L, R * 0.88], [L, R * 0.5]], 0, axis, u0, { seg: b.seg(24, 8) });
    if (b.hi) {
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.box('cavity', 0.004, R * 1.1, 0.0075, s * (R - 0.0012), axis, u0 + 0.013 + i * 0.014, { c: 0 });
      for (let i = 0; i < 3; i++) b.cyl('cavity', 0.0018, 0.0018, 0.004, (i - 1) * 0.0055, axis + R - 0.0012, u0 + 0.045, { axis: 'v', seg: 8 });
    }
    b.bore(R * 0.42, 0, axis, u0 + L + 0.0005);
    return u0 + L;
  }
  if (kind === 'cone') {
    const L = 0.05;
    b.lathe(mat, [[0, 0], [0, r], [0.006, r * 1.05], [L, r * 1.45], [L, r * 1.2]], 0, axis, u0, { seg: b.seg(24, 8) });
    if (b.hi) b.lathe('cavity', [[L - 0.0006, r * 1.18], [L - 0.03, r * 0.55]], 0, axis, u0, { seg: 24 });
    b.bore(r * 0.5, 0, axis, u0 + L - 0.028);
    return u0 + L;
  }
  // Käfig: Hülse mit fünf Schlitzen, Boden unten geschlossen
  const R = r * 1.08, L = 0.05;
  b.lathe(mat, [[0, 0], [0, R * 0.9], [0.004, R], [L - 0.002, R], [L, R * 0.85], [L, R * 0.6]], 0, axis, u0, { seg: b.seg(24, 8) });
  if (b.hi) for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i - 2.5) * (Math.PI / 3);
    if (Math.sin(a) < -0.6) continue;
    b.box('cavity', 0.0032, 0.0032, 0.026, Math.cos(a) * R * 0.97, axis + Math.sin(a) * R * 0.97, u0 + L - 0.017, { rz: a, c: 0 });
  }
  b.bore(R * 0.62, 0, axis, u0 + L + 0.0005);
  return u0 + L;
}

/** Waagrechte Rillen (Riffelung) auf einer Fläche: n Stege in v-Richtung bei x (beidseitig, wenn both). */
export function serrations(b, mat, x, v0, v1, u, n, o = {}) {
  if (!b.hi) return;
  for (const s of o.both === false ? [Math.sign(x) || 1] : [-1, 1]) for (let i = 0; i < n; i++) {
    b.box(mat, 0.0008, v1 - v0, 0.0011, s * Math.abs(x), (v0 + v1) / 2, u - i * (o.pitch ?? 0.0024), { c: 0.0002, part: o.part });
  }
}

/** Nietreihe (Halbkugelköpfe) beidseitig bei ±xs. */
export function rivets(b, mat, xs, list, r = 0.0021, o = {}) {
  if (!b.hi) return;
  for (const [v, u] of list) for (const s of [-1, 1]) b.sphere(mat, r, s * xs, v, u, { seg: 10, hseg: 6, sx: 0.45, part: o.part });
}
