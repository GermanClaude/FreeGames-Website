// NULLPUNKT — gelaende (14.11., Runde 3): Kleinrelief für Großkarten (Owner: world). Ohne three-Abhängigkeit, läuft im
// Welt-Worker (generate.js ruft applyRelief nach Grundform/Details, VOR Fluss, Bauflächen, Dämmen und Straßen – so
// ebnen Bauflächen und Straßen das Relief unter sich von selbst wieder ein).
// Nutzer: „Macht die Maps noch voller, wirklich spielbare Maps mit Hügeln und sowas.“ Die Grundform der Großkarten war
// zwischen den großen Hügeln fast eben (fBm 2–4 m auf 170–210 m Wellenlänge) – über freie Wiesen gab es keine
// Sichtdeckung. Hier entstehen kleine, spielrelevante Formen:
//   knolls  [{ x, z, r, h, w?, ry? }]  Kuppen (h > 0) und Senken (h < 0), optional elliptisch (w = Halbachse quer, ry)
//   ridges  [{ pts: [[x, z], …], w, h }] Erdwälle/Feldraine/Rücken: Profil (1 − q²)², w = halbe Breite
//   sunken  [{ pts, w, d, bank }]        Hohlwege/Bachrinnen: Sohle w breit, d tief, Böschung bank m (aufgeworfener Rand)
//   scatter { seed, count, area { minX, maxX, minZ, maxZ }, r [min, max], h [min, max], hollow (Anteil Senken), gap }
//   avoid   [[x, z, r]] + avoidRects [{ minX, maxX, minZ, maxZ, m? }]: dort läuft das Relief weich auf 0 aus
//           (Flaggen, Startpunkte, Kampagnen-Stellpunkte, Ortschaften mit fester Bodenhöhe). reliefAvoid() sammelt sie.
// Steigungen bleiben ≤ ≈ 27° (h/r ≤ 0,3), damit Spieler, Fahrzeuge und Bots (Gelände-Navigation: Normale y ≥ 0,74)
// überall hinauf kommen. Alles deterministisch aus den Kartendaten (Mehrspieler: jeder Rechner baut dasselbe Gelände).
import { smoothstep } from './noise.js?v=20261114060746';

const FADE = 10; // m weicher Übergang am Rand der Sperrflächen

/** Abstand Punkt → Strecke; liefert d und t (0..1). */
function segDist(px, pz, ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1e-9;
  let t = ((px - ax) * ex + (pz - az) * ez) / L2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - ex * t, pz - az - ez * t);
}
function polyDist(px, pz, pts) {
  let d = Infinity;
  for (let k = 0; k < pts.length - 1; k++) d = Math.min(d, segDist(px, pz, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]));
  return d;
}

/**
 * Wendet spec.relief auf das Höhenraster H an (n × n, Abstand res ab minX/minZ). noise: (x, z) → −1..1 (Simplex der
 * Karte) für leicht unregelmäßige Ränder. waterY: Senken bleiben ≥ waterY + 0,6 (keine zufälligen Tümpel).
 */
export function applyRelief(H, { n, res, minX, minZ, waterY = -Infinity }, rel, noise) {
  if (!rel) return 0;
  const N = n * n;
  // Sperrgewicht 0..1 je Stützpunkt
  const W = new Float32Array(N).fill(1);
  const forBox = (x0, z0, x1, z1, fn) => {
    const i0 = Math.max(0, Math.floor((x0 - minX) / res)), i1 = Math.min(n - 1, Math.ceil((x1 - minX) / res));
    const j0 = Math.max(0, Math.floor((z0 - minZ) / res)), j1 = Math.min(n - 1, Math.ceil((z1 - minZ) / res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * n + i, minX + i * res, minZ + j * res);
  };
  for (const [ax, az, r] of rel.avoid || []) {
    forBox(ax - r - FADE, az - r - FADE, ax + r + FADE, az + r + FADE, (o, x, z) => {
      const w = smoothstep(r, r + FADE, Math.hypot(x - ax, z - az));
      if (w < W[o]) W[o] = w;
    });
  }
  for (const q of rel.avoidRects || []) {
    const m = q.m ?? 0;
    forBox(q.minX - m - FADE, q.minZ - m - FADE, q.maxX + m + FADE, q.maxZ + m + FADE, (o, x, z) => {
      const dx = Math.max(q.minX - m - x, 0, x - q.maxX - m), dz = Math.max(q.minZ - m - z, 0, z - q.maxZ - m);
      const w = smoothstep(0, FADE, Math.hypot(dx, dz));
      if (w < W[o]) W[o] = w;
    });
  }
  const D = new Float32Array(N); // Summe der Höhenänderungen (erst am Ende gewichtet aufgetragen)
  let count = 0;

  // Kuppen/Senken
  const knolls = [...(rel.knolls || [])];
  const sc = rel.scatter;
  if (sc?.count) {
    let sd = (sc.seed || 7) >>> 0;
    const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    const A = sc.area, R = sc.r || [8, 18], Hh = sc.h || [1, 2.6], gap = sc.gap ?? 4;
    const placed = knolls.map((k) => [k.x, k.z, k.r]);
    for (let k = 0, tries = 0; k < sc.count && tries < sc.count * 6; tries++) {
      const x = A.minX + rnd() * (A.maxX - A.minX), z = A.minZ + rnd() * (A.maxZ - A.minZ);
      const r = R[0] + rnd() * (R[1] - R[0]);
      const hollow = rnd() < (sc.hollow ?? 0.3);
      const h = (Hh[0] + rnd() * (Hh[1] - Hh[0])) * (hollow ? -0.7 : 1);
      const w = r * (0.55 + rnd() * 0.45), ry = rnd() * Math.PI;
      if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + r + gap)) continue;
      // schon in einer Sperrfläche (Mittelpunkt)? → verwerfen statt flach machen
      const i = Math.round((x - minX) / res), j = Math.round((z - minZ) / res);
      if (i < 0 || j < 0 || i >= n || j >= n || W[j * n + i] < 0.9) continue;
      placed.push([x, z, r]);
      knolls.push({ x, z, r, h, w, ry });
      k++;
    }
  }
  for (const k0 of knolls) {
    // Flanken ≤ ≈ 18° (Profil (1 − q²)²: größte Neigung 1,54 · h / Halbachse)
    const k = { ...k0, h: Math.sign(k0.h) * Math.min(Math.abs(k0.h), 0.21 * Math.min(k0.r, k0.w ?? k0.r)) };
    const r = k.r, w = k.w ?? r, c = Math.cos(k.ry || 0), s = Math.sin(k.ry || 0), ext = Math.max(r, w) * 1.15;
    forBox(k.x - ext, k.z - ext, k.x + ext, k.z + ext, (o, x, z) => {
      const px = x - k.x, pz = z - k.z, lx = px * c + pz * s, lz = -px * s + pz * c;
      const q2 = (lx / r) ** 2 + (lz / w) ** 2 + (noise ? noise(x / 7.3, z / 7.3) * 0.12 : 0);
      if (q2 >= 1) return;
      const f = 1 - q2;
      D[o] += k.h * f * f * (k.h > 0 ? 1 + 0.08 * (noise ? noise(x / 3.1, z / 3.1) : 0) : 1);
    });
    count++;
  }
  // Erdwälle/Feldraine
  for (const rg of rel.ridges || []) {
    const w = rg.w ?? 3, ext = w + 1;
    const xs = rg.pts.map((p) => p[0]), zs = rg.pts.map((p) => p[1]);
    forBox(Math.min(...xs) - ext, Math.min(...zs) - ext, Math.max(...xs) + ext, Math.max(...zs) + ext, (o, x, z) => {
      const d = polyDist(x, z, rg.pts) + (noise ? noise(x / 5.1, z / 5.1) * 0.35 : 0);
      if (d >= w) return;
      const q = d / w, f = 1 - q * q;
      D[o] += rg.h * f * f;
    });
    count++;
  }
  // Hohlwege: Sohle abgesenkt, Rand leicht aufgeworfen
  for (const sk of rel.sunken || []) {
    const hw = (sk.w ?? 3.5) / 2, dep = sk.d ?? 1.6, bank = Math.max(sk.bank ?? 4.5, dep * 3.2), lip = sk.lip ?? 0.35, ext = hw + bank + 3;
    const xs = sk.pts.map((p) => p[0]), zs = sk.pts.map((p) => p[1]);
    forBox(Math.min(...xs) - ext, Math.min(...zs) - ext, Math.max(...xs) + ext, Math.max(...zs) + ext, (o, x, z) => {
      const d = polyDist(x, z, sk.pts) + (noise ? noise(x / 4.3, z / 4.3) * 0.4 : 0);
      if (d >= hw + bank + 3) return;
      // Sohle → Böschung (weich), dahinter ein flacher aufgeworfener Rand (Aushub/Raine)
      let dh = -dep * (1 - smoothstep(hw, hw + bank, d));
      const t = (d - hw - bank) / 3;
      if (t > 0 && t < 1) dh += lip * Math.sin(t * Math.PI);
      D[o] += dh;
    });
    count++;
  }
  const floor = waterY + 0.6;
  for (let o = 0; o < N; o++) {
    const d = D[o];
    if (d === 0) continue;
    const h = H[o] + d * W[o];
    // Senken nicht unter den Wasserspiegel (außer das Gelände lag schon tiefer)
    H[o] = d < 0 ? Math.max(h, Math.min(H[o], floor)) : h;
  }
  return count;
}

/**
 * Sperrflächen aus einer Großkarten-Definition: Flaggen (cq/dom, Radius + 6 m), Startpunkte (8 m), Fahrzeug-Stellplätze,
 * Ortschaften mit fester Bodenhöhe (sites; Gelände-Bauwerke wie Grenzanlage/Landschaft/Trümmer haben riesige Bereiche
 * und sind ausgenommen) + extra [[x, z, r]] (Kampagnenpunkte, Gräben, Wracks …).
 */
export function reliefAvoid(def, extra = []) {
  const pts = [], rects = [];
  const fl = def.flags || {};
  for (const f of [...(fl.cq || []), ...(fl.dom || [])]) pts.push([f.x, f.z, (f.radius || 8) + 6]);
  const walk = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      if (v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number') { pts.push([v[0], v[1], 8]); return; }
      for (const e of v) walk(e);
    } else if (typeof v === 'object') {
      if (typeof v.x === 'number' && typeof v.z === 'number') { pts.push([v.x, v.z, 8]); return; }
      for (const e of Object.values(v)) walk(e);
    }
  };
  walk(def.spawns);
  for (const v of def.vehicles || []) pts.push([v.x, v.z, 9]);
  for (const s of def.sites || []) {
    const b = s.bounds;
    if (!b || b.maxX - b.minX > 260) continue;
    rects.push({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, m: 4 });
  }
  for (const p of extra) pts.push([p[0], p[1], p[2] ?? 6]);
  return { avoid: pts, avoidRects: rects };
}

/** Sperrpunkte entlang von Linien (Gräben, Wege): alle step m ein Kreis [x, z, r]. lines: [[[x, z], …], …] */
export function linienPunkte(lines, step = 5, r = 6) {
  const out = [];
  for (const pts of lines) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step));
      for (let i = 0; i < n; i++) out.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, r]);
    }
    const e = pts[pts.length - 1];
    out.push([e[0], e[1], r]);
  }
  return out;
}
