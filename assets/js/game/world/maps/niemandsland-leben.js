// NULLPUNKT — Niemandsland: Kriegsspuren und Grabenleben (karten-voll, 14.11.; Owner: world). Nutzer: „Die Maps sind
// generell noch viel zu leer.“ Nach dem Gelände gebaut (def.lateSites, Höhen aus dem Höhenfeld):
//   · in den Gräben: Munitionskisten, Kanister, Spaten, Eimer, Stahlhelme, Sturmleitern an der Feindseite,
//     Feldtelefonkabel an der Grabenwand (Haken alle 3 m), Laternen an Pfosten, Wegweiser-Tafeln an Abzweigen
//   · im Niemandsland: Wagentrümmer (Rad, Bretter), Kisten- und Blechreste, Pfahlstümpfe mit Drahtresten, große
//     Kartuschenhülsen, zwei ausgebrannte Lastwagen (Kollision – Deckung)
//   · Ruinen (Dorf/Kapelle): Schutthaufen, verkohlte Balken, Dachziegelhaufen, Möbelreste (ruinenLeben, aus der Ortschaft)
// Alles außer den Lastwagen ohne Kollision (Gräben bleiben begehbar, Navigation unverändert); Menge je Grafikstufe.
// Deterministisch über hash01 (kein Zufall der Karte).
import * as THREE from 'three';
import { frame, hash01 } from '../props.js?v=20261123073102';
import { sampleSpline } from '../terrain/generate.js?v=20261123073102';
import { burntWreck } from './brandwald-bau.js?v=20261123073102';
import { schutt, stufe, DICHTE, eimer, ziegelstapel, sperrpunkte } from '../kleinkram.js?v=20261123073102';

const D = { collide: false, minimap: false, grad: false };
const DN = { ...D, ao: false, bullet: false };
const geo = new Map();
const cached = (k, fn) => (geo.has(k) ? geo.get(k) : (geo.set(k, fn()), geo.get(k)));

function helm(b, x, y, z, ry, tilt = 0) {
  b.geom(cached('helm', () => new THREE.SphereGeometry(0.15, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed()), x, y, z, 'metal_painted', { ...DN, ry, rz: tilt, tint: '#3e4236' });
  b.cyl(x, y, z, 0.17, 0.012, 'metal_painted', { ...DN, ry, rz: tilt, tint: '#373a30', seg: 10 });
}
function kiste(b, x, y, z, ry, k) {
  const ids = ['wooden_military_crate', 'old_military_crate', 'ammo_box'];
  const id = ids[Math.floor(k * 3)];
  if (b.hasModel(id)) b.model(id, x, y, z, { ry, s: id === 'ammo_box' ? 1.7 : 1, collide: false, minimap: false });
  else b.box(x, y, z, 0.9, 0.45, 0.5, 'wood_crate', { ...D, ry });
}
function kanister(b, x, y, z, ry) {
  if (b.hasModel('metal_jerrycan_green')) b.model('metal_jerrycan_green', x, y, z, { ry, collide: false, minimap: false });
  else b.box(x, y, z, 0.17, 0.46, 0.34, 'metal_painted', { ...D, ry, tint: '#3d4433' });
}
function spaten(b, x, y, z, ry) {
  if (b.hasModel('rusted_spade_01')) b.model('rusted_spade_01', x, y, z, { ry, rx: -0.3, collide: false, minimap: false, bullet: false });
  else { const f = frame(b, x, y, z, ry); f.box(0, 0.25, 0, 0.035, 1.0, 0.035, 'wood_dark', { ...DN, tint: '#5a4835', rx: -0.3 }); f.box(0, 0, 0, 0.2, 0.28, 0.02, 'metal_rust', { ...DN, rx: -0.3 }); }
}
/** Sturmleiter (lehnt an der Grabenwand, lokal −z = Wand). */
function sturmleiter(b, x, y, z, ry, h) {
  const f = frame(b, x, y, z, ry), lean = 0.32;
  for (const sx of [-0.22, 0.22]) f.box(sx, 0, 0, 0.06, h, 0.06, 'wood_weathered', { ...DN, tint: '#6a5a46', rx: -lean });
  for (let yy = 0.3; yy < h - 0.15; yy += 0.32) f.box(0, yy * Math.cos(lean), -yy * Math.sin(lean), 0.46, 0.04, 0.04, 'wood_planks', { ...DN, tint: '#7a6a54' });
}
function laterne(b, x, y, z) {
  b.cyl(x, y, z, 0.05, 1.7, 'wood_dark', { ...D, seg: 5, tint: '#4a3e30' });
  b.box(x, y + 1.55, z + 0.1, 0.14, 0.2, 0.14, 'glass', { ...DN, tint: '#c8b888' });
  b.box(x, y + 1.75, z + 0.1, 0.16, 0.03, 0.16, 'metal_rust', DN);
}

/** Grabenleben entlang aller Gräben. trenches: [{ pts, width, depth }], s: Seite je Graben (Feind in −s·z). */
export function grabenLeben(b, ctx, trenches, o = {}) {
  const hf = ctx.hf, H = (x, z) => hf.heightAt(x, z), q = DICHTE[stufe(b)] ?? 1, low = stufe(b) === 'low';
  let n = 0;
  for (const tr of trenches) {
    const hw = tr.width / 2, P = sampleSpline(tr.pts, 1.5);
    const enemy = Math.sign(-(tr.pts[0][1] || 1)); // Feind liegt zur Kartenmitte (z → 0)
    let acc = 0, last = null, hook = null;
    for (let k = 1; k < P.length; k++) {
      const [ax, az] = P[k - 1], [bx, bz] = P[k], L = Math.hypot(bx - ax, bz - az);
      if (L < 0.2) continue;
      acc += L;
      const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
      const fl = H(bx, bz), edge = Math.min(H(bx + nx * (hw + 0.7), bz + nz * (hw + 0.7)), H(bx - nx * (hw + 0.7), bz - nz * (hw + 0.7)));
      if (edge - fl < 1.2) { hook = null; continue; }
      // Feldtelefonkabel an der Rückwand (Haken alle ~3 m), hängt zwischen den Haken durch
      const back = Math.sign(nz) === enemy ? -1 : 1;
      if (!low && acc % 3 < L) {
        const hx = bx + nx * back * (hw - 0.07), hz = bz + nz * back * (hw - 0.07), hy = fl + 1.45;
        b.box(hx, hy - 0.04, hz, 0.03, 0.06, 0.03, 'metal_rust', DN);
        // nur auf geraden Stücken verbinden (an Knicken der Zickzacklinie liefe das Kabel sonst durch die Grabenwand)
        const hd = hook ? Math.hypot(hx - hook[0], hz - hook[2]) : 0;
        if (hook && hd < 4.5 && hd > 0.5 && Math.abs(((hx - hook[0]) * ux + (hz - hook[2]) * uz) / hd) > 0.985) {
          const dx = hx - hook[0], dz = hz - hook[2], LL = Math.hypot(dx, dz), m = 4;
          for (let i = 0; i < m; i++) {
            const t0 = i / m, t1 = (i + 1) / m, s0 = Math.sin(Math.PI * t0) * 0.18, s1 = Math.sin(Math.PI * t1) * 0.18;
            const y0 = hook[1] + (hy - hook[1]) * t0 - s0, y1 = hook[1] + (hy - hook[1]) * t1 - s1;
            b.cyl(hook[0] + dx * (t0 + t1) / 2, (y0 + y1) / 2, hook[2] + dz * (t0 + t1) / 2, 0.008, LL / m, 'rubber', { ...DN, axis: 'x', ry: Math.atan2(-dz, dx), rz: Math.atan2(y1 - y0, LL / m), seg: 3, caps: false, cast: false });
          }
        }
        hook = [hx, hy, hz];
      }
      // Gegenstände alle ~4,5 m (gedünnt je Stufe)
      if (last && Math.hypot(bx - last[0], bz - last[1]) < 4.5 / q) continue;
      last = [bx, bz];
      const h = hash01(bx, bz, 700);
      if (h > 0.75) continue;
      const side = hash01(bx, bz, 701) < 0.5 ? -1 : 1;
      // platz2 (20.11.): Höhe nicht am Wandfuß abtasten – dort steigt das Höhenfeld schon an, das grobere Geländenetz
      // nicht (Kisten/Kanister schwebten 0,2–0,65 m über der Grabensohle); tiefster Wert aus Fußpunkt und Grabenmitte
      const px = bx + nx * side * (hw - 0.4), pz = bz + nz * side * (hw - 0.4), py = Math.min(H(px, pz), fl, H((px + bx) / 2, (pz + bz) / 2)) + 0.03;
      const ry = Math.atan2(nx * side, nz * side) + Math.PI; // lokal +z zur Grabenmitte
      const kind = Math.floor(hash01(bx, bz, 702) * 9);
      if (kind === 0 && Math.sign(nz * side) === enemy) sturmleiter(b, px - nx * side * 0.1, py, pz - nz * side * 0.1, ry, 2.6);
      else if (kind <= 2) { kiste(b, px, py, pz, ry + Math.PI / 2, hash01(px, pz, 1)); if (hash01(px, pz, 2) < 0.4) helm(b, px, py + 0.47, pz, ry, 0.1); }
      else if (kind === 3) { kanister(b, px, py, pz, ry); kanister(b, px + ux * 0.25, py, pz + uz * 0.25, ry + 0.3); }
      else if (kind === 4) spaten(b, px, py, pz, ry);
      else if (kind === 5) { eimer(b, px, py, pz); helm(b, px + ux * 0.4, py, pz + uz * 0.4, ry, 2.6); }
      else if (kind === 6 && !low) laterne(b, px, py - 0.05, pz);
      else if (kind === 7) { const f = frame(b, px, py, pz, ry); for (let i = 0; i < 3; i++) f.box(-0.5 + i * 0.5, 0, 0, 0.5, 0.16, 0.32, 'sandbag', { ...D, tint: '#8a7a5c', ry: (hash01(px, i, 3) - 0.5) * 0.3 }); }
      else { kiste(b, px, py, pz, ry + Math.PI / 2, 0.9); kiste(b, px + ux * 0.4, py, pz + uz * 0.4, ry + 1.2, 0.95); }
      n++;
    }
  }
  return n;
}

/** Trümmer im Niemandsland (Streuung über die Fläche, Gräben/Wasser frei). */
export function truemmerfeld(b, ctx, o) {
  const hf = ctx.hf, H = (x, z) => hf.heightAt(x, z), q = DICHTE[stufe(b)] ?? 1, wy = hf.waterY;
  const { area, trenches, sperr } = o;
  const near = (x, z) => trenches.some((t) => t.pts.some(([px, pz], i) => {
    if (i === 0) return false;
    const [ax, az] = t.pts[i - 1], dx = px - ax, dz = pz - az, L2 = dx * dx + dz * dz || 1;
    const tt = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    return Math.hypot(x - ax - dx * tt, z - az - dz * tt) < t.width / 2 + 3.5;
  }));
  const N = Math.round((o.count ?? 220) * q);
  let n = 0;
  for (let i = 0; i < N * 2 && n < N; i++) {
    const x = area.minX + hash01(i, 11, 710) * (area.maxX - area.minX), z = area.minZ + hash01(i, 13, 711) * (area.maxZ - area.minZ);
    const y = H(x, z);
    if (y < wy + 0.3 || near(x, z) || sperr.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r)) continue;
    const k = hash01(x, z, 712), ry = hash01(x, z, 713) * 6.28;
    if (k < 0.16) { // Wagenrad + Bretter
      b.cyl(x, y + 0.05, z, 0.55, 0.08, 'wood_weathered', { ...D, rx: 0.08, tint: '#5a4a3a', seg: 14 });
      for (let s = 0; s < 6; s++) { const f = frame(b, x, y + 0.08, z, ry + s * 0.52); f.box(0, 0, 0.25, 0.05, 0.04, 0.5, 'wood_weathered', { ...DN, tint: '#4a3e30' }); }
      for (let s = 0; s < 3; s++) b.box(x + Math.cos(ry + s) * 1.2, y + 0.02, z + Math.sin(ry + s) * 1.2, 0.18, 0.03, 1.6 + s * 0.3, 'wood_weathered', { ...DN, ry: ry + s * 0.9, tint: '#5a4a3a', rx: (s - 1) * 0.08 });
    } else if (k < 0.3) { // Wellblechstück
      b.box(x, y + 0.03, z, 1.4, 0.03, 2.0, 'metal_corrugated_rust', { ...D, ry, rx: (hash01(x, z, 1) - 0.5) * 0.3, rz: (hash01(x, z, 2) - 0.5) * 0.3 });
    } else if (k < 0.44) { // Pfahlstümpfe mit Drahtresten
      for (let s = 0; s < 3; s++) { const px = x + Math.cos(ry) * s * 2.6, pz = z + Math.sin(ry) * s * 2.6; b.cyl(px, H(px, pz) - 0.2, pz, 0.04, 0.6 + hash01(px, pz, 3) * 0.6, 'wood_dark', { ...D, seg: 5, tint: '#3d3328', rz: (hash01(px, pz, 4) - 0.5) * 0.5 }); }
    } else if (k < 0.58) { // Kartuschenhülsen (Messing) im Haufen
      for (let s = 0; s < 4; s++) { const a = ry + s * 1.7, r = 0.25 + s * 0.12; b.cyl(x + Math.cos(a) * r, y + 0.07, z + Math.sin(a) * r, 0.06, 0.42, 'metal_galvanized', { ...DN, axis: 'x', ry: a * 2, tint: '#b08a3a', seg: 8 }); }
    } else if (k < 0.7) { // zerbrochene Kiste + Helm
      kiste(b, x, y - 0.12, z, ry, 0.5); helm(b, x + 0.7, y + 0.02, z + 0.3, ry, 2.8);
    } else if (k < 0.8) { // Schutt/Erdbrocken mit Brettern
      schutt(b, x, y - 0.1, z, 0.7 + hash01(x, z, 5) * 0.5, { mats: ['dirt', 'rubble', 'wood_weathered'], tint: '#7a6e60' });
    } else if (k < 0.9) { // Stacheldrahtrolle-Rest (Ring aus Draht) und Pfahl
      const f = frame(b, x, y, z, ry);
      for (let s = 0; s < 5; s++) f.geom(cached('drahtring', () => new THREE.TorusGeometry(0.4, 0.008, 3, 12).toNonIndexed()), s * 0.3 - 0.6, 0.35, 0, 'metal_rust', { ...DN, ry: Math.PI / 2 + s * 0.3, tint: '#3a2e26' });
    } else { // umgekippter Munitionswagen-Kasten
      b.box(x, y, z, 1.2, 0.7, 0.8, 'wood_weathered', { ...D, ry, rz: 0.4, tint: '#5a4e3c' });
    }
    n++;
  }
  // zwei ausgebrannte Lastwagen (Deckung, Kollision): feste Plätze, nur wo frei
  for (const [x, z, ry, kind] of o.wracks || []) {
    if (sperr.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r + 3) || near(x, z)) continue;
    burntWreck(b, x, H(x, z) - 0.1, z, ry, kind, Math.round(x * 7 + z), H);
  }
  return n;
}

/** Ruinen-Inneres und -Umfeld: Schutthaufen, verkohlte Balken, Ziegelhaufen, Möbelreste. list: [[x, z, w, d], …], y. */
export function ruinenLeben(b, list, y = 0) {
  const q = DICHTE[stufe(b)] ?? 1;
  for (const [x, z, w, d] of list) {
    const m = Math.max(1, Math.round(3 * q));
    for (let i = 0; i < m; i++) {
      const px = x + (hash01(x, z, 720 + i) - 0.5) * (w - 2.2), pz = z + (hash01(x, z, 730 + i) - 0.5) * (d - 2.2);
      schutt(b, px, y, pz, 0.6 + hash01(px, pz, 6) * 0.9, { balken: i === 0, mats: ['rubble', 'stone_wall', 'plaster_white', 'roof_tiles'], tint: '#9a9286' });
    }
    // Dachziegelhaufen außen an einer Wand, verkohlter Dachbalken quer
    const s = hash01(x, z, 740) < 0.5 ? -1 : 1;
    ziegelstapel(b, x + s * (w / 2 + 1.0), y, z + (hash01(x, z, 741) - 0.5) * d * 0.5, hash01(x, z, 742) * 3);
    b.box(x, y + 0.2, z, 0.22, 0.2, Math.min(w, d) * 0.9, 'borke_verkohlt', { ...D, ry: hash01(x, z, 743) * 3, rx: 0.3, tint: '#2a2622' });
    // Möbelreste: umgestürzter Tisch / Bettgestell
    const fx = x - s * (w / 4), fz = z + (hash01(x, z, 744) - 0.5) * d * 0.4;
    if (hash01(x, z, 745) < 0.5 && b.hasModel('old_bed_frame')) b.model('old_bed_frame', fx, y, fz, { ry: hash01(fx, fz, 1) * 6, rz: 0.15, collide: false, minimap: false });
    else if (b.hasModel('painted_wooden_table')) b.model('painted_wooden_table', fx, y + 0.45, fz, { ry: hash01(fx, fz, 2) * 6, rz: 1.45, pivot: 'center', collide: false, minimap: false });
  }
}

/** Kriegsspuren-Ortschaft für Niemandsland (lateSite). */
export function kriegsspuren(b, ctx, def, trenches) {
  const sperr = sperrpunkte(def, [...(def.flags?.cq || []).map((f) => [f.x, f.z, 8]), ...(def.vehicles || []).map((v) => [v.x, v.z, 7])], 4);
  const g = grabenLeben(b, ctx, trenches);
  const t = truemmerfeld(b, ctx, { area: { minX: -280, maxX: 280, minZ: -135, maxZ: 135 }, trenches, sperr, count: 240, wracks: [[-62, 46, 0.7, 'lkw'], [88, -58, 2.4, 'lkw'], [-188, -30, 1.2, 'pkw'], [196, 34, 4.0, 'pkw']] });
  b.kleinkram = { graben: g, truemmer: t };
  return {};
}
