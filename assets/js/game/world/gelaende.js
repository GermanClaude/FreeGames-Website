// NULLPUNKT — gelaende (14.11., Runde 3): Relief und begehbare Deckung für die Arena-Karten (Owner: world).
// Nutzer: „Macht die Maps noch voller, wirklich spielbare Maps mit Hügeln und sowas.“ Die Arena-Karten (Hafen, Werk,
// Altstadt) stehen auf einer ebenen Bodenplatte (builder.groundTiled, y = 0). Statt das ganze Bodenraster zu verbiegen
// (Gebäude, Türen, Decals, Kleinkram und Kampagnenwege hängen an y = 0) entstehen Höhenunterschiede hier als eigene,
// begehbare Bauteile AUF der Platte:
//   huegel()   Schüttguthalden, Erdhügel, Sandhaufen, Erdwälle (elliptische Kuppe, Rand läuft auf y = 0 aus;
//              Kollision = dieselbe Dreiecksfläche → Spieler und Bots laufen hinauf, Kugeln schlagen ein)
//   podest()   Laderampen, Terrassen, Plattformen mit Stützmauer, Rampen (Keil), Treppen (arch.stairs) und Brüstung
//   rampe()    einzelne Auffahrt (Keil + Randsteine)
// Alles hat feste Kollision und ist auf jedem Rechner gleich (Geometrie hängt nicht von der Grafikstufe ab; Zufall nur
// über hash01 aus der Position). Navigation: wird aus der Kollision abgetastet (navbuild.js: Neigung ≤ 45°, Stufen
// ≤ 0,46 m) – Halden bleiben ≤ ≈ 35° steil, Rampen ≤ 1 : 2,5, Podeste haben Treppen/Rampen (Navigationspunkte setzt
// arch.stairs, Rampen setzen eigene). frei() prüft geplante Stellen gegen Start-, Flaggen-, Modus- und Kampagnenpunkte.
import * as THREE from 'three';
import { stairs, railing } from './arch.js?v=20261114060746';
import { hash01 } from './props.js?v=20261114060746';
import { MAPS } from '../../shared/maps.data.js?v=20261114060746';
import { MODUS_ZIELE } from './maps/modus-ziele.js?v=20261114060746';
import { KAMPAGNE_PUNKTE } from './kampagne-punkte.js?v=20261114060746';

const geoCache = new Map();

/**
 * Sperrprüfung: list = [[x, z, r]] (Startpunkte, Flaggen, Modus-Zonen, Kampagnenpunkte …). frei(x, z, r) → true, wenn
 * ein Objekt mit Radius r dort keinen Sperrkreis berührt. Liefert die Funktion plus Zähler (verworfene Stellen).
 */
export function freiPruefer(list) {
  const f = (x, z, r = 1) => {
    for (const [sx, sz, sr] of list) if (Math.hypot(x - sx, z - sz) < sr + r) { f.verworfen++; return false; }
    return true;
  };
  f.verworfen = 0;
  f.liste = list;
  return f;
}

/** Sperrkreise aus { spawns }, Flaggen [{x,z}], Zonen [{x,z,radius}] und Punktlisten [[x,z]] (Radius r je Gruppe). */
export function sperrKreise({ spawns, flags = [], zonen = [], punkte = [], rSpawn = 3.2, rFlag = 6, rPunkt = 2.2 } = {}) {
  const out = [];
  const walk = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      if (v.length >= 2 && typeof v[0] === 'number') { out.push([v[0], v[1], rSpawn]); return; }
      for (const e of v) walk(e);
    } else if (typeof v === 'object') {
      if (typeof v.x === 'number' && typeof v.z === 'number') { out.push([v.x, v.z, rSpawn]); return; }
      for (const e of Object.values(v)) walk(e);
    }
  };
  walk(spawns);
  for (const f of flags) out.push([f.x, f.z, rFlag]);
  for (const z of zonen) out.push([z.x, z.z, (z.radius || 5) + 1]);
  for (const p of punkte) out.push([p[0], p[1], p[2] ?? rPunkt]);
  return out;
}

/**
 * Alle Freihaltekreise einer Arena-Karte: Startpunkte (3,2 m), Team-Startbereiche samt Munitions-/Sanitätspunkten
 * (mappoints.js: ±4 m um die Mitte → 7 m), Flaggen (6 m + 3 m für die Flaggenpunkte daneben), Stellungs-Zonen
 * (modus-ziele.js, Radius + 1 m), Kampagnenpunkte (2,4 m) + extra.
 */
export function kartenSperre(mapId, spawns, extra = []) {
  const M = MAPS[mapId] || {};
  const list = sperrKreise({ spawns, flags: M.flags || [], zonen: MODUS_ZIELE[mapId]?.hp || [], punkte: (KAMPAGNE_PUNKTE[mapId] || []).map(([x, z]) => [x, z, 2.4]), rFlag: 7 });
  for (const t of ['A', 'B']) { const c = M.spawns?.[t]; if (c) list.push([c[0], c[1], 7]); }
  for (const f of M.flags || []) list.push([f.x + 3, f.z, 2.5]);
  for (const p of extra) list.push(p);
  return list;
}

/**
 * Platz für ein Rechteck (Mitte x/z, Halbmaße hw/hd, Drehung ry) frei? Prüft Sperrkreise (frei-Prüfer) und vorhandene
 * Grundrisse mit Kollision (Abstand gap, Standard 1,1 m = Laufweg; klein: s. u.). → true/false
 */
export function platzFrei(b, frei, x, z, hw, hd, ry = 0, gap = 1.1, klein = 0) {
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), ex = c * hw + s * hd, ez = s * hw + c * hd;
  // Sperrkreise: Abstand Kreis ↔ Rechteck (achsenparallele Hülle)
  for (const [sx, sz, sr] of frei.liste) {
    const dx = Math.max(Math.abs(sx - x) - ex, 0), dz = Math.max(Math.abs(sz - z) - ez, 0);
    if (Math.hypot(dx, dz) < sr) { frei.verworfen++; frei.grund = `Sperrkreis ${sx},${sz},${sr}`; return false; }
  }
  for (const f of b.footprints) {
    if (f.kind === 'floor' || f.kind === 'zone' || f.kind === 'water' || f.kind === 'roof' || f.y0 > 2.2 || f.y1 < 0.3) continue;
    // klein > 0: niedrige Kleinteile (Poller, Kübel …) unter dieser Höhe darf ein Podest überbauen
    if (klein && f.y1 < klein && f.hw * f.hd < 0.6 && f.kind !== 'wall' && f.kind !== 'building') continue;
    const fc = Math.abs(Math.cos(f.ry || 0)), fs = Math.abs(Math.sin(f.ry || 0)), fx = fc * f.hw + fs * f.hd, fz = fs * f.hw + fc * f.hd;
    const g = f.hw * f.hd < 0.8 && f.y1 < 2.2 ? Math.min(gap, 0.5) : gap; // Kleinteile (Poller, Paletten): nur Fuge
    if (Math.abs(f.x - x) < ex + fx + g && Math.abs(f.z - z) < ez + fz + g) { frei.verworfen++; frei.grund = `${f.kind} ${f.x.toFixed(1)},${f.z.toFixed(1)} ${f.hw.toFixed(1)}x${f.hd.toFixed(1)}`; return false; }
  }
  return true;
}

/**
 * Kuppen-Geometrie: Ellipse rx × rz, Höhe h. Profil y = h · min(1, (1 − smoothstep(q)) · flat) (flat > 1 → abgeflachte Krone,
 * z. B. Erdwall). Ringe nr, Segmente ns – feste Auflösung (Mehrspieler: gleiche Kollision auf jedem Gerät).
 * Vertexfarben: Fuß etwas dunkler/feuchter, leichte Fleckung.
 */
function kuppeGeom(rx, rz, h, flat, seed, nr = 7, ns = 22) {
  const key = `k${rx},${rz},${h},${flat},${seed},${nr},${ns}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const pos = [], col = [], idx = [];
  const prof = (q) => h * Math.min(1, (1 - q * q * (3 - 2 * q)) * flat);
  pos.push(0, prof(0), 0); col.push(1, 1, 1);
  for (let r = 1; r <= nr; r++) {
    const q = r / nr;
    for (let s = 0; s < ns; s++) {
      const a = (s / ns) * Math.PI * 2;
      // unregelmäßiger Umriss (± 7 %) und leicht unebene Flanken, Rand exakt auf y = 0
      const wob = 1 + (hash01(Math.cos(a) * 3.1 + seed, Math.sin(a) * 2.7, 71) - 0.5) * 0.14;
      const x = Math.cos(a) * rx * q * wob, z = Math.sin(a) * rz * q * wob;
      const bump = r < nr ? (hash01(x + seed, z, 72) - 0.5) * Math.min(0.18, h * 0.12) : 0;
      pos.push(x, r === nr ? 0 : Math.max(0.02, prof(q) + bump), z);
      const k = 0.78 + 0.22 * Math.min(1, (1 - q) * 2.2) + (hash01(x * 1.7, z * 1.3 + seed, 73) - 0.5) * 0.08;
      col.push(k, k * 0.99, k * 0.97);
    }
  }
  for (let s = 0; s < ns; s++) idx.push(0, 1 + ((s + 1) % ns), 1 + s);
  for (let r = 1; r < nr; r++) {
    const a0 = 1 + (r - 1) * ns, b0 = 1 + r * ns;
    for (let s = 0; s < ns; s++) {
      const s1 = (s + 1) % ns;
      idx.push(a0 + s, a0 + s1, b0 + s1, a0 + s, b0 + s1, b0 + s);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const ng = g.toNonIndexed();
  geoCache.set(key, ng);
  return ng;
}

/**
 * Halde / Erdhügel / Erdwall. (x, z) Mitte am Boden (y), o: { rx, rz, h, ry, flat (1), mat ('gravel'), tint, kind
 * (Minikarte, 'cover'), nav (true: Navigationspunkte auf Krone und Flanken) }. Steilheit wird auf ≈ 38° begrenzt.
 * → Kronenhöhe.
 */
export function huegel(b, x, z, o = {}) {
  const rx = o.rx ?? 4, rz = o.rz ?? rx, y = o.y ?? 0, flat = o.flat ?? 1;
  // maximale Flankenneigung des Profils: 1,5·h·flat / r ≤ 0,78 (≈ 38°; Navigation bis 45°)
  const h = Math.min(o.h ?? 1.5, (0.78 * Math.min(rx, rz)) / (1.5 * flat));
  const seed = Math.round(hash01(x, z, 70) * 97);
  const g = kuppeGeom(rx, rz, Math.round(h * 100) / 100, flat, seed);
  b.geom(g, x, y, z, o.mat || 'gravel', { ry: o.ry || 0, tint: o.tint, collide: 'mesh', uv: 'world', grad: false, aoFloor: y, matOpts: o.matOpts });
  b._footprint(x, z, rx * 1.6, rz * 1.6, o.ry || 0, y, y + h, o.kind ?? (h > 1.2 ? 'cover' : 'floor'));
  if (o.nav !== false) {
    b.navPoint(x, y + h + 0.1, z);
    const c = Math.cos(o.ry || 0), s = Math.sin(o.ry || 0);
    for (const [lx, lz] of [[rx * 0.55, 0], [-rx * 0.55, 0], [0, rz * 0.55], [0, -rz * 0.55]]) {
      const q = Math.sqrt((lx / rx) ** 2 + (lz / rz) ** 2), yy = h * Math.min(1, (1 - q * q * (3 - 2 * q)) * flat);
      b.navPoint(x + lx * c + lz * s, y + yy + 0.1, z - lx * s + lz * c);
    }
  }
  return y + h;
}

/** Erdwall von A nach B (Krone abgeflacht), Breite w (Fuß), Höhe h. */
export function erdwall(b, x0, z0, x1, z1, o = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0), w = o.w ?? 7;
  return huegel(b, (x0 + x1) / 2, (z0 + z1) / 2, { ...o, rx: L / 2 + w / 2, rz: w / 2, ry: -Math.atan2(z1 - z0, x1 - x0), flat: o.flat ?? 1.25, h: o.h ?? 1.3, mat: o.mat || 'dirt' });
}

/** Rampe (Keil) mit Fußpunkt (x, z) unten, Richtung dir 'n'|'s'|'e'|'w' aufwärts, Breite w, Höhe h, Länge len. */
export function rampe(b, x, z, dir, w, h, len, o = {}) {
  const D = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[dir];
  const y = o.y ?? 0, ry = Math.atan2(D[0], D[1]);
  const cx = x + D[0] * len / 2, cz = z + D[1] * len / 2;
  b.wedge(cx, y, cz, w, h, len, o.mat || 'concrete', { ry, tint: o.tint, minimap: 'stairs' });
  // Randsteine/Leitplanken an den Seiten (optisch, niedrig)
  if (o.curb !== false) {
    const px = -D[1], pz = D[0], ang = Math.atan2(h, len), Lr = Math.hypot(h, len);
    for (const sd of [-1, 1]) {
      const bx = cx + px * sd * (w / 2 - 0.1), bz = cz + pz * sd * (w / 2 - 0.1);
      b.box(bx, y + h / 2 - 0.02, bz, 0.2, 0.14, Lr, o.curbMat || 'concrete_dark', { ry, rx: -ang, collide: false, minimap: false, grad: false, uv: 'local' });
    }
  }
  b.navLine(x - D[0] * 0.6, y + 0.15, z - D[1] * 0.6, x + D[0] * (len + 0.6), y + h + 0.15, z + D[1] * (len + 0.6), 1.2);
  return { top: [x + D[0] * len, z + D[1] * len] };
}

/**
 * Podest (Laderampe, Terrasse, Plattform): Rechteck x0..x1 × z0..z1, Oberkante y + h. Stützmauer/Front in mat,
 * Belag top (Material der Oberfläche). o: {
 *   mat ('concrete'), top ('concrete'), tint, topTint,
 *   rampen: [{ seite 'n'|'s'|'e'|'w', at (Mitte entlang der Seite, relativ), w, len }] – Rampe von außen hinauf,
 *   treppen: [{ seite, at, w }] – Treppe von außen hinauf (arch.stairs),
 *   bruestung: Seiten mit Brüstung ['n', …] ('mauer' = 0,95 m Mauer als Deckung, sonst Geländer), bruestungArt,
 *   kante: true → gelb-schwarze Kantenmarkierung + Gummipuffer (Laderampe),
 *   offen: Bereiche einer Seite ohne Brüstung [{ seite, at, w }] (Durchgänge)
 * }
 */
export function podest(b, x0, z0, x1, z1, h, o = {}) {
  const y = o.y ?? 0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
  const mat = o.mat || 'concrete', top = o.top || mat;
  // Körper (Kollision) + Belag
  b.box(cx, y, cz, W, h - 0.04, D, mat, { tint: o.tint, minimap: o.kind ?? 'cover', aoFloor: y });
  b.box(cx, y + h - 0.04, cz, W, 0.04, D, top, { tint: o.topTint, collide: true, minimap: false, grad: false, uv: 'world' });
  const side = (s) => ({
    n: { ax: 'x', c: z0, a0: x0, a1: x1, out: [0, -1] }, s: { ax: 'x', c: z1, a0: x0, a1: x1, out: [0, 1] },
    w: { ax: 'z', c: x0, a0: z0, a1: z1, out: [-1, 0] }, e: { ax: 'z', c: x1, a0: z0, a1: z1, out: [1, 0] },
  })[s];
  const gaps = { n: [], s: [], e: [], w: [] };
  for (const r of o.rampen || []) {
    const S = side(r.seite), len = r.len ?? h * 2.8, w = r.w ?? 3.2, at = (S.a0 + S.a1) / 2 + (r.at || 0);
    const fx = S.ax === 'x' ? at : S.c + S.out[0] * len, fz = S.ax === 'x' ? S.c + S.out[1] * len : at;
    const dir = S.out[1] < 0 ? 's' : S.out[1] > 0 ? 'n' : S.out[0] < 0 ? 'e' : 'w';
    rampe(b, fx, fz, dir, w, h, len, { y, mat: r.mat || mat, tint: o.tint, curb: r.curb });
    gaps[r.seite].push([at - w / 2, at + w / 2]);
  }
  for (const t of o.treppen || []) {
    const S = side(t.seite), w = t.w ?? 1.6, at = (S.a0 + S.a1) / 2 + (t.at || 0), run = Math.max(1.2, h / 0.62);
    const fx = S.ax === 'x' ? at : S.c + S.out[0] * run, fz = S.ax === 'x' ? S.c + S.out[1] * run : at;
    const dir = S.out[1] < 0 ? 's' : S.out[1] > 0 ? 'n' : S.out[0] < 0 ? 'e' : 'w';
    stairs(b, { x: fx, z: fz, y0: y, y1: y + h, w, dir, mat: t.mat || mat, tint: o.tint, rail: t.rail ?? false });
    gaps[t.seite].push([at - w / 2, at + w / 2]);
  }
  for (const g of o.offen || []) { const S = side(g.seite), at = (S.a0 + S.a1) / 2 + (g.at || 0); gaps[g.seite].push([at - g.w / 2, at + g.w / 2]); }
  // Brüstung je Seite in Stücken zwischen den Lücken
  for (const s of o.bruestung || []) {
    const S = side(s), segs = [];
    let cur = S.a0;
    for (const [g0, g1] of gaps[s].slice().sort((p, q) => p[0] - q[0])) { if (g0 > cur + 0.3) segs.push([cur, g0]); cur = Math.max(cur, g1); }
    if (S.a1 > cur + 0.3) segs.push([cur, S.a1]);
    for (const [a, c] of segs) {
      const inset = 0.15;
      const ax = S.ax === 'x' ? a : S.c - S.out[0] * inset, az = S.ax === 'x' ? S.c - S.out[1] * inset : a;
      const bx = S.ax === 'x' ? c : S.c - S.out[0] * inset, bz = S.ax === 'x' ? S.c - S.out[1] * inset : c;
      if (o.bruestungArt === 'mauer') {
        const L = Math.hypot(bx - ax, bz - az);
        b.box((ax + bx) / 2, y + h, (az + bz) / 2, S.ax === 'x' ? L : 0.3, 0.95, S.ax === 'x' ? 0.3 : L, o.mauerMat || mat, { tint: o.mauerTint || o.tint, minimap: 'cover', aoFloor: y + h });
        b.box((ax + bx) / 2, y + h + 0.95, (az + bz) / 2, S.ax === 'x' ? L + 0.06 : 0.38, 0.07, S.ax === 'x' ? 0.38 : L + 0.06, 'concrete', { tint: '#c9c3b6', collide: false, minimap: false, grad: false });
      } else railing(b, ax, az, bx, bz, y + h, { tint: o.railTint || '#c9a227' });
    }
  }
  // Laderampe: Kantenschutz (gelb-schwarz) + Gummipuffer an der Frontseite o.front
  if (o.kante) {
    for (const s of o.kante === true ? ['n', 's', 'e', 'w'] : o.kante) {
      const S = side(s), L = S.a1 - S.a0, mx = S.ax === 'x' ? (S.a0 + S.a1) / 2 : S.c + S.out[0] * 0.03, mz = S.ax === 'x' ? S.c + S.out[1] * 0.03 : (S.a0 + S.a1) / 2;
      b.box(mx, y + h - 0.12, mz, S.ax === 'x' ? L : 0.06, 0.1, S.ax === 'x' ? 0.06 : L, 'hazard', { collide: false, minimap: false, grad: false, uv: 'local' });
      if (o.puffer && o.puffer.includes(s)) {
        for (let a = S.a0 + 1.5; a < S.a1 - 1; a += 3.2) {
          const px = S.ax === 'x' ? a : S.c + S.out[0] * 0.12, pz = S.ax === 'x' ? S.c + S.out[1] * 0.12 : a;
          b.box(px, y + h - 0.62, pz, S.ax === 'x' ? 0.5 : 0.22, 0.42, S.ax === 'x' ? 0.22 : 0.5, 'rubber', { tint: '#1e1f20', collide: false, minimap: false, grad: false });
        }
      }
    }
  }
  // Navigationspunkte auf der Fläche (Abtastung findet sie ohnehin; Saat für schmale Podeste)
  b.navPoint(cx, y + h + 0.1, cz);
  return y + h;
}

/**
 * Nächster freier Platz (platzFrei) zu einer Wunschstelle (px, pz) im Umkreis r (Raster 0,5 m, spiralförmig nach
 * Abstand) – deterministisch. Grenzen bz { minX, maxX, minZ, maxZ } (Spielfläche) optional. → [x, z] oder null.
 */
export function suchePlatz(b, frei, px, pz, hw, hd, r = 6, gap = 1.1, bz = null) {
  const cand = [];
  for (let dx = -r; dx <= r + 1e-6; dx += 0.5) for (let dz = -r; dz <= r + 1e-6; dz += 0.5) {
    const d = Math.hypot(dx, dz);
    if (d <= r) cand.push([d, px + dx, pz + dz]);
  }
  cand.sort((a, c) => a[0] - c[0] || a[1] - c[1] || a[2] - c[2]);
  const n0 = frei.verworfen;
  for (const [, x, z] of cand) {
    if (bz && (x - hw < bz.minX || x + hw > bz.maxX || z - hd < bz.minZ || z + hd > bz.maxZ)) continue;
    if (platzFrei(b, frei, x, z, hw, hd, 0, gap)) { frei.verworfen = n0; return [x, z]; }
  }
  frei.verworfen = n0 + 1;
  return null;
}
