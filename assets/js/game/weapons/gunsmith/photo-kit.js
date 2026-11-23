// Foto-Baukasten (13.11.2026, Waffen-Etappe 3 „nach echten Vorbildern“): gemeinsame Helfer für Waffen, deren Umrisse aus
// einem kalibrierten Seitenfoto stammen (K-36, BX-20, G-7, SK-14, UR-1). Die Bauteil-Umrisse liegen in Fotopixeln im
// jeweiligen <waffe>-ref.js (Silhouette aus dem freigestellten Foto, je Bauteil mit einem Bereich beschnitten, Douglas-
// Peucker ≈ 1 px); hier werden sie auf Meter umgerechnet und als Distanzfeld-Platten mit gerundeten Kanten vernetzt
// (PC hoch/ultra fein mit Kanten-/Muldenfarbe, PC niedrig/mittel gröber, Handy noch gröber, Bots als flache Extrusion).
// Koordinaten wie im Bauplan: x quer (rechts +), v hoch, u nach vorn; Ursprung = Griffmitte oben (rechte Hand).
import { extrudeRound, simplifyRing } from './sdf.js?v=20261123115551';
import { field2, box2, sdfMesh, sdRoundRect, roundMax, STEEL, POLY, ALU } from './sdfkit.js?v=20261123115551';

export { STEEL, POLY, ALU };

/**
 * Kalibrierung eines Fotos: ppm = Pixel je Meter, (xg, yg) = Griffmitte oben in Fotopixeln, ya = Laufachse (Fotozeile).
 * flip: Foto zeigt die Mündung links (wird gespiegelt, x wächst nach vorn). Liefert U/V/M und die Achshöhe AXIS.
 */
export function calib(ppm, xg, yg, ya, flip = false) {
  const U = flip ? (x) => (xg - x) / ppm : (x) => (x - xg) / ppm;
  const V = (y) => (yg - y) / ppm;
  const M = (pts) => pts.map(([x, y]) => [U(x), V(y)]);
  const ring = (pts) => { const r = M(pts); return flip ? r.reverse() : r; };
  return { U, V, M: ring, AXIS: V(ya), ppm };
}

/** Aufeinanderfolgende doppelte Punkte entfernen (Kante der Länge 0 ergäbe NaN im Polygonabstand). */
export function dedupe(pts) {
  const out = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p); }
  while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-6) out.pop();
  return out;
}

/** Raster der Umrissfelder je Detailstufe (PC hoch fein, sonst gröber – bilinear abgefragt). */
const G2 = (b, s) => (b.max ? s : b.lite ? s * 3 : s * 2.2);

/**
 * Platte aus einem Fotoumriss: Umriss pts (Meter, [u, v]) mit Löchern holes, quer auf ±hw extrudiert, Kanten mit Radius r
 * gerundet. o.hw(u, v) statt fester Breite (z. B. verjüngter Schaft), o.mod(d, x, v, u, d2) für eingelassene Felder,
 * Bohrungen, Nuten (d2 = Abstand im Umriss), o.step Vernetzungsraster, o.cav Gebrauchsspuren (STEEL/POLY/ALU),
 * o.part bewegliches Teil, o.id geteilter Block. Bots (b.hi = false): flache Extrusion des vereinfachten Umrisses.
 */
export function slab(b, mat, pts, hw, o = {}) {
  pts = dedupe(pts);
  const { holes: holes0 = [], r = Math.min(0.0025, hw * 0.45), step = 0.0032, cav = POLY, part, id, mod, hwFn, x0 = 0, lowTol = 0.0025 } = o;
  const holes = holes0.map(dedupe);
  if (!b.hi) {
    if (o.noLow) return;
    // Durchbrüche (Bügel, Skelettschaft) auch in der Bot-Stufe offen – nur große Löcher (> 2 cm), vereinfacht
    const big = holes.filter((h) => { const [a0, a1, c0, c1] = box2(h, 0); return a1 - a0 > 0.02 && c1 - c0 > 0.012; }).map((h) => simplifyRing(h, lowTol));
    b.side(mat, simplifyRing(pts, lowTol), hw * 2, x0, { part, holes: big, keepHoles: big.length > 0 });
    return;
  }
  const make = () => {
    const F = field2(pts, holes, G2(b, 0.00032));
    const [u0, u1, v0, v1] = box2(pts, 0.003);
    const W = hwFn ? Math.max(hw, o.hwMax || hw) : hw;
    const f = (x, v, u) => {
      const d2 = F(u, v);
      if (d2 > 0.004) return d2;
      const h = hwFn ? hwFn(u, v) : hw;
      let d = extrudeRound(d2, x - x0, h, r);
      if (mod) d = mod(d, x - x0, v, u, d2);
      return d;
    };
    sdfMesh(b, f, [x0 - W - 0.002, v0, u0], [x0 + W + 0.002, v1, u1], step, mat, { cav, part });
  };
  if (id) b.shared(id, make); else make();
}

/** Vertieftes Feld (Tasche) in den Seitenflächen einer Platte: Rechteck (Mitte cu, cv, Halbmaße hu, hv, Ecke rr), Tiefe t. */
export function pocket(d, x, v, u, hw, cu, cv, hu, hv, rr, t) {
  if (Math.abs(x) < hw - t - 0.001) return d;
  return Math.max(d, -Math.max(sdRoundRect(u - cu, v - cv, hu, hv, rr), hw - t - Math.abs(x)));
}

/** Erhabene Leiste/Kante (Rippe) auf der Seitenfläche: Rechteck, Höhe t über hw (gibt min(d, rib)). */
export function rib(d, x, v, u, hw, cu, cv, hu, hv, rr, t) {
  const e = roundMax(sdRoundRect(u - cu, v - cv, hu, hv, rr), Math.abs(x) - hw - t, 0.0004);
  return Math.min(d, e);
}

/** Durchgehende Querbohrung (Achse x) mit Radius rr an (cv, cu). */
export function crossHole(d, v, u, cv, cu, rr) { return Math.max(d, -(Math.hypot(v - cv, u - cu) - rr)); }

/**
 * Drehkörper entlang der Laufachse aus einem Profil [[u, r], …] (absolute u), am PC fein, sonst grob.
 */
export function barrel(b, mat, prof, axis, o = {}) {
  const u0 = prof[0][0];
  const pts = [[0, 0], ...prof.map(([u, r]) => [u - u0, r]), [prof[prof.length - 1][0] - u0, 0]];
  b.lathe(mat, pts, o.x || 0, axis, u0, { seg: b.seg(o.seg || 28, o.segLow || 6), part: o.part });
}

/** Querstift/Bolzenkopf auf beiden Seiten (Außenfläche ±x), Radius r. */
export function pins(b, mat, x, v, u, r, o = {}) {
  if (!b.hi) return;
  for (const s of o.sides || [-1, 1]) {
    b.cyl(mat, r, r, 0.0016, s * (x + 0.0006), v, u, { axis: 'x', seg: b.seg(16, 6), part: o.part });
    if (b.max && o.dot !== false) b.cyl('cavity', r * 0.32, r * 0.32, 0.0004, s * (x + 0.0015), v, u, { axis: 'x', seg: 10, part: o.part });
  }
}

/** Schlitzschraube/Torx auf einer Seite (x Außenfläche, s Seite). */
export function screwHead(b, mat, x, v, u, r, s = 1) {
  if (!b.hi) return;
  b.lathe(mat, [[0, 0], [0, r], [0.0006, r * 0.95], [0.0011, r * 0.6], [0.0011, 0]], s * x, v, u, { axis: 'x', ry: s > 0 ? 0 : Math.PI, seg: b.seg(16, 6) });
  if (b.max) b.box('cavity', 0.0003, r * 1.5, r * 0.3, s * (x + 0.0011), v, u, { c: 0 });
}

/**
 * Mündungsfeuerdämpfer als Rohr mit n Längsschlitzen von vorn (Zinken), Bund hinten: u0…u1 entlang der Achse, Außenradius r,
 * Bohrung ri, Schlitzbreite sw, Schlitze ab u0 + slot0. Bots: einfacher Zylinder.
 */
export function slottedHider(b, mat, u0, u1, axis, o = {}) {
  const { r = 0.0106, ri = 0.0064, n = 4, sw = 0.0013, slot0 = 0.006, collar = 0.004, phase = 0, closed = false } = o;
  if (!b.hi) { b.cyl(mat, r, r, u1 - u0, 0, axis, (u0 + u1) / 2, { seg: 6 }); return; }
  const seg = (Math.PI * 2) / n;
  sdfMesh(b, (x, v, u) => {
    const rr = Math.hypot(x, v - axis);
    let d = Math.max(rr - (u < u0 + collar ? r + 0.0008 : r), Math.max(u0 - u, u - u1));
    d = Math.max(d, -(rr - ri));
    if (u > u0 + slot0 && (!closed || u < u1 - 0.004)) {
      const a = Math.atan2(v - axis, x) + phase, k = ((a / seg) % 1 + 1) % 1 - 0.5;   // −0,5…0,5 um die Schlitzmitte
      d = Math.max(d, -(sw - Math.abs(k) * seg * rr));
    }
    return d;
  }, [-r - 0.002, axis - r - 0.002, u0 - 0.002], [r + 0.002, axis + r + 0.002, u1 + 0.002], 0.0011, mat, { cav: STEEL, fine: 0.6 });
  b.bore(ri * 0.72, 0, axis, u1 - (closed ? 0.0006 : 0.004));
}

/**
 * Längsrille (Sicke/Nut) in den Seitenflächen einer Platte: Rundkanal mit Radius rr entlang u0…u1 auf Höhe gv, so tief,
 * dass er depth in die Fläche (halbe Breite hw) einschneidet; Enden gerundet. Liefert das neue Feld.
 */
export function groove(d, x, v, u, hw, u0, u1, gv, rr, depth) {
  const ax = Math.abs(x);
  if (ax < hw - depth - 0.001) return d;
  const uc = Math.min(u1, Math.max(u0, u));
  const e = Math.hypot(u - uc, v - gv, ax - (hw + rr - depth)) - rr;
  return Math.max(d, -e);
}
