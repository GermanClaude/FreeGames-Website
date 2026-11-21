// Baukasten Gruppe B (13.11.2026, Waffen nach Vorbild: KM-7 Wespe, SM-45 Keiler, LM-8 Bär, HM-60 Hammer, RG-6 Orkan).
// Umrisse liegen als Fotopixel (Seitenansicht, Mündung links) oder Millimeter vor; ref() rechnet in Bauplan-Koordinaten
// (u vorwärts, v hoch, Meter, Ursprung = Griffpunkt der rechten Hand) um. slab() baut daraus ein Distanzfeld-Bauteil mit
// eigener Breite und gerundeten Kanten (am PC fein vernetzt, mit Kanten-/Muldenfarbe); die Bot-Stufe bekommt eine
// einfache Profil-Extrusion (wenige Dutzend Dreiecke statt eines Volumennetzes).
import { extrudeRound, simplifyRing } from './sdf.js?v=20261121041936';
import { field2, sdfMesh, box2, POLY, STEEL } from './sdfkit.js?v=20261121041936';

export { POLY, STEEL };

/**
 * Bezugssystem eines Fotos: ppm Pixel je Meter, (xg, yg) Griffpunkt im Foto. Mündung links (u wächst nach links).
 * flip: Mündung rechts im Foto.
 */
export function ref(ppm, xg, yg, flip = false) {
  const U = flip ? (x) => (x - xg) / ppm : (x) => (xg - x) / ppm;
  const V = (y) => (yg - y) / ppm;
  return { ppm, U, V, M: (pts) => pts.map(([x, y]) => [U(x), V(y)]), L: (px) => px / ppm };
}

/** Millimeter-Bezug: Punkte [u, v] in mm relativ zum Griffpunkt. */
export const mm = (pts) => pts.map(([u, v]) => [u / 1000, v / 1000]);

/**
 * Platte/Körper aus einem Seitenprofil pts ([u, v] in m): halbe Breite hw (Zahl oder fn(u, v)), Kantenradius rr.
 * o.x Mittellage quer, o.holes Löcher (Profil), o.cut(x, v, u, d) → d (Fenster, Nuten, Rippen abziehen/anfügen),
 * o.step Raster (Standard 2 mm, PC × 0,6), o.cav Gebrauchsspuren (POLY/STEEL), o.part, o.id (Bauteil-Cache), o.hwMax.
 */
export function slab(b, pts, hw, rr, mat, o = {}) {
  const x0 = o.x || 0;
  const hwMax = typeof hw === 'function' ? (o.hwMax ?? 0.04) : hw;
  if (!b.hi) {
    if (o.bot === false) return;
    const ring = simplifyRing(pts, o.botTol ?? 0.004);
    b.side(mat, ring, hwMax * 2 * (o.botScale ?? 0.92), x0, { part: o.part, bevel: 0 });
    return;
  }
  const make = () => {
    const f2 = field2(pts, o.holes || [], b.max ? 0.0004 : 0.0008);
    const [u0, u1, v0, v1] = box2(pts, 0.004);
    const f = (x, v, u) => {
      const d2 = f2(u, v);
      if (d2 > 0.006) return d2;
      const h = typeof hw === 'function' ? hw(u, v) : hw;
      let d = extrudeRound(d2, x - x0, h, Math.min(rr, h * 0.95));
      if (o.cut) d = o.cut(x - x0, v, u, d);
      return d;
    };
    sdfMesh(b, f, [x0 - hwMax - 0.004, v0, u0], [x0 + hwMax + 0.004, v1, u1], o.step ?? 0.002, mat, { cav: o.cav ?? POLY, fine: o.fine ?? 0.6, part: o.part, lite: o.lite });
  };
  if (o.id && !o.part) b.shared(o.id, make); else make();
}

/** Abgerundetes Rechteck um (cu, cv) mit Halbmaßen hu, hv, Radius r als 2D-Feld (für Fenster/Nuten in cut()). */
export const rrect = (u, v, cu, cv, hu, hv, r) => {
  const qx = Math.abs(u - cu) - hu + r, qy = Math.abs(v - cv) - hv + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

/** Vertiefung in einer Seitenwand: Gebiet e2 < 0 (2D) auf der Seite s (±1) depth tief (nur Wand außerhalb |x| > wall). */
export const pocket = (d, x, e2, wall, s = 0) => {
  if (s && Math.sign(x) !== s) return d;
  return Math.max(d, -Math.max(e2, wall - Math.abs(x)));
};

/** Rippe/Aufsatz anfügen: Feld e (3D) weich mit d vereinigen. */
export const addTo = (d, e) => Math.min(d, e);

/** Patronengurt-Glieder (M13-Art) entlang Punkten – nur Optik, Messing kommt aus magRounds. */
export function links(b, pts, mat, o = {}) {
  if (!b.hi) return;
  for (const [x, v, u, rz = 0] of pts) {
    b.box(mat, 0.009, 0.0035, 0.024, x, v, u, { ...o, rz, c: 0.0006 });
    b.cyl(mat, 0.0062, 0.0062, 0.012, x, v + 0.0005, u + 0.004, { ...o, rz, seg: 10, open: true });
  }
}
