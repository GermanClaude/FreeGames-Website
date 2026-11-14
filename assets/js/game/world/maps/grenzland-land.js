// NULLPUNKT — Grenzland: Kulturlandschaft zwischen den Ortschaften (karten-voll, 14.11.; Owner: world). Nutzer:
// „Die Maps sind generell noch viel zu leer.“ Nach dem Gelände gebaut (def.lateSites, Höhen aus dem Höhenfeld –
// auf allen Rechnern identisch):
//   · Freileitungen (Holzmasten mit Querträger, Isolatoren, durchhängende Leiterseile, vereinzelt Masttrafo) neben
//     Landstraße, Dorfweg und Werkstraße
//   · Leitpfosten an der Landstraße (weiß mit schwarzem Band, je Seite alle 50 m), Wegweiser an Abzweigen
//   · Fahrspuren und Pfützen auf den Feldwegen (Decals, dem Gelände folgend)
//   · Rundballen auf den Stoppelfeldern (Kollision: Deckung), Holzpolter an Waldrändern (Kollision), Hochsitze an
//     Waldrändern, Weidezaun an einer Wiese
//   · Feldstellungen an Heckenreihen: Sandsackbogen mit Stacheldraht davor (Kollision am Sandsack)
// Kollision nur für Masten (dünn), Ballen, Polter und Sandsäcke – unabhängig von der Grafikstufe; Navigation tastet
// sie mit ab (Geländeraster). Frei bleiben Straßen (Breite/2 + 1,5 m), Ortschaften, Wasser, Startpunkte, Flaggen,
// Fahrzeugstellplätze und Kampagnenpunkte (m3). Optik (Spuren, Pfosten, Zaun) je Stufe gedünnt.
import { frame, hash01, sandbags } from '../props.js?v=20261114060746';
import { wireFence } from '../barbed-wire.js?v=20261114060746';
import { burntWreck } from './brandwald-bau.js?v=20261114060746';
import { freileitung, sperrpunkte, KAMPAGNE, stufe } from '../kleinkram.js?v=20261114060746';

const D = { collide: false, minimap: false, grad: false };

export function landschaft(b, ctx, def) {
  const hf = ctx.hf, wy = hf.waterY, gy = (x, z) => hf.heightAt(x, z), q = stufe(b), low = q === 'low';
  const sites = (def.sites || []).map((s) => s.bounds);
  const sperr = sperrpunkte(def, [
    ...KAMPAGNE.grenzland.map((p) => [p[0], p[1], 5]),
    ...(def.flags?.cq || []).map((f) => [f.x, f.z, 7]),
    ...(def.vehicles || []).map((v) => [v.x, v.z, 7]),
  ], 5);
  const inSite = (x, z, m = 2) => sites.some((bb) => x > bb.minX - m && x < bb.maxX + m && z > bb.minZ - m && z < bb.maxZ + m);
  const roads = (ctx.roads || []).filter((r) => r.samples && r.samples.length >= 6);
  // Straßenraster (8 m) für schnelle Abstandsprüfung
  const RG = new Map(), cs = 8;
  for (const r of roads) for (let k = 0; k < r.samples.length; k += 3) {
    const key = Math.floor(r.samples[k] / cs) * 7919 + Math.floor(r.samples[k + 2] / cs);
    if (!RG.has(key)) RG.set(key, []);
    RG.get(key).push([r.samples[k], r.samples[k + 2], r.width / 2]);
  }
  const roadDist = (x, z) => {
    let best = 1e9;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [px, pz, hw] of RG.get((Math.floor(x / cs) + i) * 7919 + Math.floor(z / cs) + j) || []) best = Math.min(best, Math.hypot(x - px, z - pz) - hw);
    return best;
  };
  const free = (x, z, r = 0) => gy(x, z) > wy + 0.5 && !inSite(x, z, 2 + r) && !sperr.some(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) < sr + r) && Math.abs(x) < 238 && Math.abs(z) < 238;
  const stats = { masten: 0, pfosten: 0, spuren: 0, ballen: 0, polter: 0, hochsitze: 0, stellungen: 0 };

  // 1) Freileitungen neben den Straßen (Masten außerhalb der Ortschaften, mit Abstand zur Fahrbahn)
  for (const r of roads) {
    if (!['hauptstrasse', 'dorfweg', 'werkstrasse'].includes(r.id)) continue;
    const pts = [];
    for (let k = 0; k < r.samples.length; k += 3 * 4) pts.push([r.samples[k], r.samples[k + 2]]);
    const side = (r.width / 2 + 3.2) * (r.id === 'dorfweg' ? -1 : 1);
    const masts = freileitung(b, pts, { step: r.id === 'hauptstrasse' ? 40 : 36, side, hy: gy, sperr, trafo: 0.07, ok: (x, z) => free(x, z, 1) && roadDist(x, z) > 1.5 });
    stats.masten += masts.length;
  }

  // 2) Leitpfosten an der Landstraße (beide Seiten, 50 m), nur Optik
  for (const r of roads) {
    if (r.id !== 'hauptstrasse') continue;
    let acc = 0;
    for (let k = 3; k < r.samples.length; k += 3) {
      const x0 = r.samples[k - 3], z0 = r.samples[k - 1], x1 = r.samples[k], z1 = r.samples[k + 2], L = Math.hypot(x1 - x0, z1 - z0);
      acc += L;
      if (acc < (low ? 100 : 50) || L < 1e-3) continue;
      acc = 0;
      const ux = (x1 - x0) / L, uz = (z1 - z0) / L;
      for (const s of [-1, 1]) {
        const px = x1 - uz * s * (r.width / 2 + 0.9), pz = z1 + ux * s * (r.width / 2 + 0.9);
        if (inSite(px, pz, 0) || gy(px, pz) < wy + 0.3 || r.bridge && isOnBridge(r, px, pz)) continue;
        const ry = Math.atan2(ux, uz), y = gy(px, pz);
        const f = frame(b, px, y, pz, ry);
        f.box(0, -0.2, 0, 0.12, 1.2, 0.12, 'polymer', { ...D, tint: '#ecebe6', ao: false });
        f.box(0, 0.75, 0, 0.125, 0.2, 0.125, 'polymer', { ...D, tint: '#1c1c1c', ao: false });
        f.box(0, 0.8, s * 0.064, 0.05, 0.1, 0.005, 'lamp_orange', { ...D, ao: false, cast: false, bullet: false });
        stats.pfosten++;
      }
    }
  }

  // 3) Fahrspuren + Pfützen auf Feld- und Schotterwegen (Decals dem Gelände nach)
  const n = { x: 0, y: 1, z: 0 };
  for (const r of roads) {
    if (r.kind !== 'dirt' && r.kind !== 'gravel') continue;
    const every = low ? 3 : 1, half = r.width * 0.28;
    for (let k = 3, i = 0; k < r.samples.length; k += 3, i++) {
      if (i % every) continue;
      const x0 = r.samples[k - 3], z0 = r.samples[k - 1], x1 = r.samples[k], z1 = r.samples[k + 2], L = Math.hypot(x1 - x0, z1 - z0);
      if (L < 0.5 || inSite(x1, z1, -4)) continue;
      const ux = (x1 - x0) / L, uz = (z1 - z0) / L, ry = Math.atan2(-uz, ux) + Math.PI / 2;
      for (const s of [-1, 1]) {
        const px = x1 - uz * s * half, pz = z1 + ux * s * half;
        if (gy(px, pz) < wy + 0.2) continue;
        hf.normalAt(px, pz, n);
        const h = hash01(px, pz, 501);
        if (h < 0.45) { b.decal(px, gy(px, pz) + 0.02, pz, 0.55, L * 1.6, 'tire', { ry, normal: [n.x, n.y, n.z], opacity: 0.55 }); stats.spuren++; }
        else if (h > 0.93 && n.y > 0.985) { b.decal(px, gy(px, pz) + 0.022, pz, 0.7 + h * 0.4, 1.6 + h, 'puddle', { ry, normal: [n.x, n.y, n.z], opacity: 0.85 }); stats.spuren++; }
      }
    }
  }

  // 4) Rundballen auf Stoppelfeldern (Deckung, Kollision) – Reihen in Feldrichtung
  for (const fd of def.terrain?.fields || []) {
    if (fd.kind !== 'stoppel') continue;
    const c = Math.cos(fd.ry || 0), s = Math.sin(fd.ry || 0);
    for (let i = 0; i < 9; i++) {
      const lx = (hash01(fd.x, fd.z, 510 + i) - 0.5) * (fd.w - 6), lz = (hash01(fd.x, fd.z, 530 + i) - 0.5) * (fd.d - 6);
      const x = fd.x + lx * c + lz * s, z = fd.z - lx * s + lz * c;
      if (!free(x, z, 1.5) || roadDist(x, z) < 3) continue;
      const y = Math.min(gy(x - 0.6, z), gy(x + 0.6, z), gy(x, z - 0.6), gy(x, z + 0.6)) - 0.05, ry = (fd.ry || 0) + hash01(x, z, 550) * 0.6;
      const wrapped = hash01(x, z, 551) < 0.35;
      b.cyl(x, y + 0.72, z, 0.72, 1.2, wrapped ? 'polymer' : 'sand', { axis: 'x', ry, tint: wrapped ? (hash01(x, z, 552) < 0.5 ? '#e8e8e2' : '#2f3a2c') : '#d6bd74', seg: 14, minimap: 'cover' });
      if (!wrapped && !low) for (const sx of [-0.61, 0.61]) { const f = frame(b, x, y + 0.72, z, ry); f.cyl(sx, 0, 0, 0.62, 0.012, 'sand', { ...D, axis: 'x', tint: '#c4a85e', seg: 14, ao: false }); }
      stats.ballen++;
    }
  }

  // 5) Waldränder: Holzpolter (Stammstapel, Kollision) und Hochsitze; je Wald ein bis zwei Stellen zur Kartenmitte hin
  for (const fo of def.terrain?.forests || []) {
    const a0 = Math.atan2(-fo.z, -fo.x);
    for (let k = 0; k < 2; k++) {
      const a = a0 + (hash01(fo.x, fo.z, 560 + k) - 0.5) * 1.6 + k * 0.9, rr = fo.r + 2.5;
      const x = fo.x + Math.cos(a) * rr, z = fo.z + Math.sin(a) * rr;
      if (!free(x, z, 3) || roadDist(x, z) < 2.5) continue;
      hf.normalAt(x, z, n);
      if (n.y < 0.93) continue;
      const ry = Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI / 2; // Stämme tangential am Waldrand
      if (k === 0) { polter(b, x, gy(x, z), z, ry, hash01(x, z, 570)); stats.polter++; }
      else { hochsitz(b, x, gy(x, z), z, Math.atan2(Math.cos(a), Math.sin(a))); stats.hochsitze++; }
    }
  }

  // 6) Feldstellungen an Hecken (Mitte der Heckenzüge, zur Gegenseite gerichtet): Sandsackbogen + Draht davor
  const hedges = def.vegetation?.hedges || [];
  for (let i = 0; i < hedges.length; i++) {
    const pts = hedges[i].pts;
    if (hash01(i, pts.length, 580) > 0.6) continue;
    const [ax, az] = pts[0], [bx, bz] = pts[pts.length - 1], mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 20) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L;
    // vor die Hecke, auf die Seite zur Kartenmitte (Fluss)
    let nx = -uz, nz = ux;
    if (nx * -mx + nz * -mz < 0) { nx = -nx; nz = -nz; }
    const x = mx + nx * 3.2 + ux * 4, z = mz + nz * 3.2 + uz * 4;
    if (!free(x, z, 4) || roadDist(x, z) < 4) continue;
    hf.normalAt(x, z, n);
    if (n.y < 0.95) continue;
    stellung(b, x, z, nx, nz, ux, uz, gy, low);
    stats.stellungen++;
  }

  // 7) Weidezaun um die Wiese zwischen Dorf und Mühle (Holzpfosten, zwei Drähte), nur Optik
  if (!low) {
    const P = [[-92, 62], [-78, 58], [-66, 61], [-60, 72], [-70, 80], [-86, 79], [-94, 70], [-92, 62]];
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, z0] = P[i], [x1, z1] = P[i + 1], L = Math.hypot(x1 - x0, z1 - z0), m = Math.max(1, Math.round(L / 3));
      let prev = null;
      for (let k = 0; k <= m; k++) {
        const x = x0 + (x1 - x0) * k / m, z = z0 + (z1 - z0) * k / m;
        if (!free(x, z) || roadDist(x, z) < 1) { prev = null; continue; }
        const y = gy(x, z);
        b.cyl(x, y - 0.1, z, 0.06, 1.35, 'wood_weathered', { ...D, seg: 6, tint: '#7a6a56', rz: (hash01(x, z, 590) - 0.5) * 0.1 });
        if (prev) for (const h of [0.55, 1.05]) b.cyl((prev[0] + x) / 2, (prev[1] + y) / 2 + h, (prev[2] + z) / 2, 0.006, Math.hypot(x - prev[0], z - prev[2]), 'metal_galvanized', { ...D, axis: 'x', ry: Math.atan2(-(z - prev[2]), x - prev[0]), rz: Math.atan2(y - prev[1], Math.hypot(x - prev[0], z - prev[2])), seg: 3, caps: false, ao: false, bullet: false, cast: false });
        prev = [x, y, z];
      }
    }
  }
  // 8) Ausgebrannte Autos am Straßenrand (Kriegsspur, Deckung mit Kollision): je Straße an zwei festen Anteilen
  stats.wracks = 0;
  for (const r of roads) {
    if (!['hauptstrasse', 'werkstrasse', 'furtweg'].includes(r.id)) continue;
    for (const t of [0.31, 0.68]) {
      const k = Math.floor(r.samples.length / 3 * t) * 3, x0 = r.samples[k], z0 = r.samples[k + 2], x1 = r.samples[k + 3], z1 = r.samples[k + 5];
      if (x1 === undefined) continue;
      const L = Math.hypot(x1 - x0, z1 - z0) || 1, ux = (x1 - x0) / L, uz = (z1 - z0) / L, s = hash01(x0, z0, 610) < 0.5 ? -1 : 1;
      const x = x0 - uz * s * (r.width / 2 + 2.6), z = z0 + ux * s * (r.width / 2 + 2.6);
      if (!free(x, z, 3) || roadDist(x, z) < 1.2) continue;
      hf.normalAt(x, z, n);
      if (n.y < 0.96) continue;
      burntWreck(b, x, gy(x, z) - 0.08, z, Math.atan2(ux, uz) + (hash01(x, z, 611) - 0.5) * 0.8, 'pkw', Math.round(x * 3 + z));
      stats.wracks++;
    }
  }
  if (ctx.debug) console.info('[grenzland] Kulturlandschaft', JSON.stringify(stats));
  b.kleinkram = stats;
  return {};
}

function isOnBridge(r, x, z) {
  const br = r.bridge;
  // Gelände-Straßen tragen die Brücke je nach Erzeuger als { a, b } oder anders – nur die bekannte Form auswerten
  if (!br || !Array.isArray(br.a) || !Array.isArray(br.b)) return false;
  const [ax, az] = br.a, [bx, bz] = br.b, L = Math.hypot(bx - ax, bz - az), t = ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (L * L);
  return t > -0.1 && t < 1.1;
}

/** Holzpolter: 3–4 Lagen Stämme (6 m) auf zwei Querhölzern, Stirnseiten hell. Kollision als Quader. */
function polter(b, x, y, z, ry, h) {
  const f = frame(b, x, y, z, ry), L = 5.5 + h * 1.5, layers = 3 + (h < 0.5 ? 1 : 0), r = 0.2;
  for (const sx of [-L * 0.3, L * 0.3]) f.box(sx, -0.1, 0, 0.18, 0.2, 2.6, 'bark', { ...D, tint: '#6a5a48' });
  for (let j = 0; j < layers; j++) {
    const n = 6 - j, w = n * r * 2;
    for (let i = 0; i < n; i++) {
      const lz = -w / 2 + r + i * r * 2, ly = 0.1 + r + j * r * 1.75, dl = (hash01(x + i, z + j, 600) - 0.5) * 0.4;
      f.cyl(dl, ly, lz, r * (0.85 + hash01(x + i, z + j, 601) * 0.25), L, 'bark', { ...D, axis: 'x', seg: 8, tint: '#7a6a58' });
      f.cyl(dl + L / 2 + 0.005, ly, lz, r * 0.8, 0.01, 'wood_planks', { ...D, axis: 'x', seg: 8, tint: '#d8b888', ao: false });
    }
  }
  f.solid(0, 0, 0, L, 0.1 + layers * r * 1.75 + r * 0.4, 6 * r * 2, { minimap: 'cover' });
}

/** Offener Hochsitz (Leiter, Sitzbrett, Brüstung, Dach), Blick lokal +z. Kollision nur an den Beinen. */
function hochsitz(b, x, y, z, ry) {
  const f = frame(b, x, y, z, ry), H = 3.6;
  for (const [sx, sz] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]]) f.box(sx, -0.2, sz, 0.12, H + 1.6, 0.12, 'wood_weathered', { tint: '#7a6a56', collide: true, minimap: false, grad: false });
  f.box(0, H, 0, 1.6, 0.06, 1.4, 'wood_planks', { ...D, tint: '#8a7660' });
  for (const sz of [-0.7, 0.7]) f.box(0, H + 0.06, sz, 1.6, 0.9, 0.04, 'wood_planks', { ...D, tint: '#8a7660' });
  f.box(0.78, H + 0.06, 0, 0.04, 0.9, 1.4, 'wood_planks', { ...D, tint: '#8a7660' });
  f.box(0, H + 1.85, 0, 1.9, 0.05, 1.8, 'wood_weathered', { ...D, tint: '#5a5048', rx: 0.1 });
  // Leiter an der Rückseite (lokal −z)
  for (const sx of [-0.25, 0.25]) f.box(sx, -0.1, -1.4, 0.07, H + 0.4, 0.07, 'wood_weathered', { ...D, tint: '#7a6a56', rx: 0.22 });
  for (let yy = 0.3; yy < H; yy += 0.35) f.box(0, yy, -1.4 + yy * Math.tan(0.22), 0.5, 0.05, 0.05, 'wood_planks', { ...D, tint: '#8a7660' });
}

/** Feldstellung: Sandsackbogen (U, Öffnung nach hinten) + Stacheldraht 9 m davor. */
function stellung(b, x, z, nx, nz, ux, uz, gy, low) {
  const y = Math.min(gy(x, z), gy(x + ux * 2, z + uz * 2), gy(x - ux * 2, z - uz * 2), gy(x + nx * 1.5, z + nz * 1.5)) - 0.05;
  const P = (a, c) => [x + ux * a + nx * c, z + uz * a + nz * c];
  const [f0x, f0z] = P(-2.2, 1.0), [f1x, f1z] = P(2.2, 1.0), [l1x, l1z] = P(-2.4, -1.2), [r1x, r1z] = P(2.4, -1.2);
  sandbags(b, f0x, f0z, f1x, f1z, { rows: 4, y, double: true });
  sandbags(b, f0x - ux * 0.3, f0z - uz * 0.3, l1x, l1z, { rows: 3, y });
  sandbags(b, f1x + ux * 0.3, f1z + uz * 0.3, r1x, r1z, { rows: 3, y });
  // Munitionskiste, Kanister und Spaten in der Stellung
  const [cx, cz] = P(-1.1, -0.2);
  if (b.hasModel('ammo_box')) b.model('ammo_box', cx, gy(cx, cz), cz, { ry: Math.atan2(ux, uz), s: 1.6, collide: false, minimap: false });
  const [sx, sz] = P(1.4, 0.5);
  if (b.hasModel('rusted_spade_01')) b.model('rusted_spade_01', sx, gy(sx, sz), sz, { ry: Math.atan2(nx, nz), rx: 0.35, collide: false, minimap: false, bullet: false });
  if (low) return;
  const posts = [];
  for (let k = -3; k <= 3; k++) { const [px, pz] = P(k * 2.4, 9 + (k % 2) * 0.4); posts.push([px, gy(px, pz), pz]); }
  wireFence(b, posts, { post: 'iron', heights: [0.25, 0.6, 0.95] });
}
