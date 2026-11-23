// NULLPUNKT — gfx-welt (14.11.): Bodenauflage der Stadt-/Industriekarten (Owner: world). Nur medium+ (low lädt das
// Modul gar nicht). Große, glatte Beton-/Asphalt-/Pflasterflächen wirkten künstlich sauber: Diese Schicht legt nach
// dem Weltaufbau flache Decals aus einem Fotoscan-Atlas auf den Boden (assets/lib/foliage/boden.webp, 2048×1024,
// 4×2 Zellen aus CC0-Scans von Poly Haven, siehe CREDITS.md):
//   Laubstreu, angetrocknete Erde, Sand-/Staubverwehung, Splitt, Ölfleck, Pfütze, Schmutzrand am Wandfuß, Einzelblätter
// und setzt an Wandfüßen kleine Grasbüschel/Unkraut (Foto-Laubatlas aus atlas.js, kein Kollisionsobjekt).
//
// Platzierung per Strahltest gegen die Kollisions-BVH (world.groundHeight) und Kugel-BVH (world.raycast) auf einem
// gestreuten Raster, gesät über die Kartenkennung (jedes Laden gleich, rein optisch → Mehrspieler unberührt).
// Wandfüße: waagerechter Strahl knapp über dem Boden; Treffer an senkrechter Fläche → Schmutzrand entlang der Wand.
// Überdachte Stellen (Strahl nach oben trifft) bekommen keine Pfützen/kein Laub. Ein Material für alle Zellen
// (Rauheit je Instanz: Pfütze glänzt, Öl halbmatt, Rest matt), je Rasterzelle (36–64 m) ein InstancedMesh,
// Ausblenden ab 36–85 m im Shader. Kosten: ≤ 620 Quads in ≈ 10–25 Draw Calls, ein 2048er-Atlas (≈ 5,6 MB GPU).
//
// placeGroundDressing(world, group, { quality, seed, def }) → { count, wall, tufts, meshes, ms }
import * as THREE from 'three';
import { createFoliage } from './atlas.js?v=20261123115551';

export const GROUND_CELL = { laub: 0, erde: 1, sand: 2, splitt: 3, oel: 4, pfuetze: 5, wandfuss: 6, blaetter: 7 };
// fuell (20.11., Nutzer: „Maps sehen immer noch leer aus“): etwa doppelt so dicht; Großkarten über opt.bereiche
const CAP = { medium: 640, high: 1400, ultra: 2000 };
const TUFTS = { medium: 160, high: 480, ultra: 720 };
const GRID = { medium: 64, high: 44, ultra: 36 };
const FADE = { medium: [34, 50], high: [48, 70], ultra: [60, 88] };
/** Größe [min, max] (m) und Rauheit je Zelle. */
const SIZE = [[1.0, 2.3], [1.6, 4.2], [1.6, 3.8], [0.9, 1.9], [0.6, 1.8], [1.1, 3.0], [0, 0], [0.8, 1.7]];
const ROUGH = [0.92, 0.9, 0.95, 0.85, 0.42, 0.16, 0.92, 0.9];
/** Mischung je Kartenart (Gewichte der Zellen 0–5, 7). */
const MIX = {
  hafen: { 0: 0.4, 1: 1.0, 2: 1.3, 3: 1.2, 4: 1.6, 5: 1.4, 7: 0.6 },
  werk: { 0: 0.6, 1: 1.4, 2: 0.9, 3: 1.5, 4: 1.7, 5: 1.3, 7: 0.8 },
  altstadt: { 0: 1.2, 1: 0.8, 2: 1.6, 3: 0.7, 4: 0.2, 5: 0.35, 7: 1.6 }, // fuell: weniger Pfützen/Öl (Mittagssonne)
  default: { 0: 0.9, 1: 1.1, 2: 1.0, 3: 1.0, 4: 0.9, 5: 1.1, 7: 1.0 },
  // fuell (20.11.): Großkarten-Ortschaften – Dorf: Laub/Erde statt Ölflecken; Front: Erde, Splitt, Pfützen
  // ges2 (21.11.): Dorfplatz las sich fleckig-dunkel – weniger Erde/Öl/Pfützen, mehr Laub/Sand
  grenzland: { 0: 0.55, 1: 0.25, 2: 1.1, 3: 0.9, 4: 0.02, 5: 0.25, 7: 1.1 },
  // ges2 (21.11.): Vorfeld (vorher Standardmischung) – viele dunkle Öl-/Erdflecken; jetzt vor allem Staub/Splitt
  flugplatz: { 0: 0.5, 1: 0.45, 2: 1.4, 3: 1.3, 4: 0.3, 5: 0.45, 7: 0.6 },
  niemandsland: { 0: 0.3, 1: 1.7, 2: 0.8, 3: 1.1, 4: 0.3, 5: 1.0, 7: 0.3 },
  brandwald: { 0: 0.2, 1: 1.6, 2: 0.9, 3: 1.0, 4: 0.4, 5: 0.9, 7: 0.2 },
  stadtkern: { 0: 0.9, 1: 1.0, 2: 1.2, 3: 1.4, 4: 0.6, 5: 1.0, 7: 0.9 },
};

/** ges2 (21.11.): Dichte je Karte (Grenzland-Dorfplatz wirkte fleckig: ≈ 40 % weniger Flächenauflage). */
const DICHTE = { grenzland: 0.6 };

let atlasTex = null, atlasP = null;
/** Atlas (einmal je Sitzung); bis er da ist, zeigt das Material einen leeren (durchsichtigen) Platzhalter. */
function loadAtlas() {
  if (!atlasP) {
    atlasP = new THREE.TextureLoader().loadAsync(new URL('../../../lib/foliage/boden.webp', import.meta.url).href).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.name = 'np:bodenauflage'; atlasTex = t; return t;
    }).catch((err) => { console.warn('[world] Bodenauflage-Atlas', err?.message || err); return null; });
  }
  return atlasP;
}
/**
 * fuell (20.11.): Streupunkte im Raster – ganze Karte (world.bounds) oder nur in Bereichen (Großkarten: Ortschaften,
 * [{minX,maxX,minZ,maxZ}]). Liefert gemischte Liste [[x, z], …] und den Flächenfaktor (für die Kappung).
 */
export function streuRaster(world, bereiche, step, r) {
  const B = world.bounds, list = bereiche && bereiche.length ? bereiche : [{ minX: B.min.x, maxX: B.max.x, minZ: B.min.z, maxZ: B.max.z }];
  const cells = [];
  let area = 0;
  for (const q of list) {
    area += (q.maxX - q.minX) * (q.maxZ - q.minZ);
    for (let z = q.minZ + step / 2; z < q.maxZ; z += step) for (let x = q.minX + step / 2; x < q.maxX; x += step) cells.push([x + (r() - 0.5) * step, z + (r() - 0.5) * step]);
  }
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  // Flächenfaktor (Bezug ≈ 12 000 m² – Hafen/Werk/Altstadt/Stadtkern): kleine Karten (Bibliothek) entsprechend weniger
  return { cells, flaeche: Math.min(bereiche && bereiche.length ? 2.5 : 1.5, Math.max(0.3, area / 12000)) };
}
/** Bodenhöhe der Ebene unter (x, z): kleine Karten y ≈ 0, Großkarten Gelände (world.heightAt) – oder null. */
export function bodenY(world, x, z) {
  const base = world.heightAt ? world.heightAt(x, z) : 0;
  if (!Number.isFinite(base)) return null;
  const g = world.groundHeight ? world.groundHeight(x, z, base + 3.2) : base;
  return g == null || g - base > 3 ? null : g;
}
const EMPTY = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
EMPTY.needsUpdate = true;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function dressingMaterial(quality) {
  const [f0, f1] = FADE[quality] || FADE.high;
  const m = new THREE.MeshStandardMaterial({ map: atlasTex || EMPTY, transparent: true, depthWrite: false, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  m.name = 'bodenauflage';
  m.userData.disposable = true; m.userData.surface = 'concrete';
  if (!atlasTex) loadAtlas().then((t) => { if (t) { m.map = t; m.needsUpdate = true; } });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aCell;\nattribute float aRough;\nvarying float vNpRough;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = aCell.xy + uv * aCell.zw;\n#endif\nvNpRough = aRough;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vNpRough;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.a *= 1.0 - smoothstep(${f0.toFixed(1)}, ${f1.toFixed(1)}, length(vViewPosition));`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vNpRough;')
      // Glanzflächen (Pfütze/Öl): Himmelsspiegelung dämpfen – die Umgebungskarte ist nur der Himmel; eine echte Pfütze
      // spiegelt meist Wände/Kisten (vgl. atlas.js decalMats.wet), sonst wirkt sie flach gesehen wie ein weißes Blatt
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n\treflectedLight.indirectSpecular *= mix(0.28, 1.0, smoothstep(0.3, 0.8, vNpRough));');
  };
  m.customProgramCacheKey = () => `np-bodenauflage-v2-${f0}`;
  return m;
}

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _col = new THREE.Color();

/** Boden unter (x, z) unterhalb von yMax: { y, surface, name, covered } | null (nur nahezu waagerecht). */
function groundAt(world, x, z, yMax) {
  _o.set(x, yMax, z); _d.set(0, -1, 0);
  const h = world.raycast(_o, _d, yMax + 6);
  if (!h || Math.abs(h.normal.y) < 0.96) return null;
  return { y: h.point.y, surface: h.surface, name: (h.object?.material?.name || h.object?.name || '') };
}
function covered(world, x, y, z) {
  _o.set(x, y + 0.3, z); _d.set(0, 1, 0);
  return !!world.raycast(_o, _d, 40);
}
/** Ist die Fläche w × d (gedreht um a) um (x, z) eben und gleich hoch wie y? */
function flat(world, x, y, z, a, w, d, tol) {
  const c = Math.cos(a), s = Math.sin(a);
  for (const [u, v] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    const px = x + c * u * w - s * v * d, pz = z + s * u * w + c * v * d;
    const g = groundAt(world, px, pz, y + 0.6);
    if (!g || Math.abs(g.y - y) > tol || g.surface === 'water') return false;
  }
  return true;
}

export function placeGroundDressing(world, group, { quality = 'high', seed = 1, def = {} } = {}) {
  const t0 = performance.now();
  let cap = CAP[quality] || 0;
  if (!cap || !world?.raycast || !world.bounds || def.groundDressing === false) return { count: 0, wall: 0, tufts: 0, meshes: 0, ms: 0 };
  loadAtlas();
  const opt = def.groundDressing || {};
  const mix = MIX[def.id] || MIX[opt.mix] || MIX.default;
  const mixKeys = Object.keys(mix).map(Number), mixSum = mixKeys.reduce((a, k) => a + mix[k], 0);
  const pickCell = (r, coveredHere) => {
    for (let tries = 0; tries < 4; tries++) {
      let k = r() * mixSum, cell = mixKeys[0];
      for (const c of mixKeys) { k -= mix[c]; if (k <= 0) { cell = c; break; } }
      if (coveredHere && (cell === GROUND_CELL.pfuetze || cell === GROUND_CELL.laub || cell === GROUND_CELL.blaetter)) continue;
      return cell;
    }
    return GROUND_CELL.sand;
  };
  const r = rng(seed ^ 0x5bd1e995);
  const step = (opt.step ?? 1.9) / Math.sqrt(opt.density ?? 1);
  const items = [], tufts = [];
  const taken = new Set();
  const key = (x, z, s) => `${Math.round(x / s)}|${Math.round(z / s)}`;
  const { cells, flaeche } = streuRaster(world, opt.bereiche, step, r);
  cap = Math.round(cap * flaeche * (opt.cap ?? DICHTE[def.id] ?? 1));
  let wall = 0;
  const tuftCap = Math.round((TUFTS[quality] || 0) * flaeche * (opt.cap ?? 1));
  for (const [x, z] of cells) {
    if (items.length >= cap) break;
    const gy0 = bodenY(world, x, z);
    if (gy0 == null) continue;
    const g = groundAt(world, x, z, gy0 + 0.4);
    if (!g || Math.abs(g.y - gy0) > 0.08) continue;
    if (g.surface === 'water' || g.surface === 'grass' || g.surface === 'wood' || g.surface === 'metal' || g.surface === 'fabric' || /grass|roof|water/.test(g.name)) continue;
    const gy = g.y;
    // Wandfuß? (45 % der Versuche): waagerechte Strahlen 0,18 m über dem Boden in zwei Richtungen
    if (r() < 0.6) { // fuell: vorher 45 %, Strahl 4,5 m
      const a = r() * Math.PI * 2;
      _o.set(x, gy + 0.18, z); _d.set(Math.cos(a), 0, Math.sin(a));
      let h = world.raycast(_o, _d, 6.5);
      if (!h || Math.abs(h.normal.y) >= 0.15) { _d.set(-Math.sin(a), 0, Math.cos(a)); h = world.raycast(_o, _d, 6.5); }
      if (h && Math.abs(h.normal.y) < 0.15 && h.distance > 0.3) {
        _n.copy(h.normal).setY(0).normalize();
        if (_n.dot(_d) > 0) _n.negate();
        const L = 1.8 + r() * 2.6, D = 0.45 + r() * 0.45;
        const cx = h.point.x + _n.x * (D / 2 - 0.01), cz = h.point.z + _n.z * (D / 2 - 0.01);
        const k = key(cx, cz, 1.6);
        if (!taken.has(k)) {
          // Boden muss bis an die Wand reichen (keine Stufe/Kante) – Prüfpunkte entlang der Wand
          let ok = true;
          _t.set(-_n.z, 0, _n.x);
          for (const u of [-0.42, 0, 0.42]) {
            const gx = h.point.x + _n.x * 0.12 + _t.x * u * L, gz = h.point.z + _n.z * 0.12 + _t.z * u * L;
            const gg = groundAt(world, gx, gz, gy + 0.5);
            if (!gg || Math.abs(gg.y - gy) > 0.05) { ok = false; break; }
            // Wand muss auf der ganzen Länge da sein
            _o.set(gx, gy + 0.18, gz); _d.copy(_n).negate();
            const w2 = world.raycast(_o, _d, 0.35);
            if (!w2) { ok = false; break; }
          }
          if (ok) {
            taken.add(k);
            const cov = covered(world, cx, gy, cz);
            items.push({ x: cx, y: gy + 0.006, z: cz, nx: _n.x, nz: _n.z, w: L, d: D, cell: GROUND_CELL.wandfuss, wall: true, tint: 0.8 + r() * 0.3 });
            wall++;
            // Gras/Unkraut in der Fuge (nicht überdacht)
            // ges2: Grün nur an echten Mauern/Hauswänden (1,8 m hoch), nicht an Schutt/Sperren auf der Fahrbahn
            _o.set(h.point.x + _n.x * 0.3, gy + 1.8, h.point.z + _n.z * 0.3); _d.copy(_n).negate();
            const hoch = !!world.raycast(_o, _d, 0.7);
            if (!cov && hoch && tufts.length < tuftCap && r() < 0.55) {
              const n = 1 + Math.floor(r() * 3);
              for (let i = 0; i < n; i++) {
                const u = (r() - 0.5) * L * 0.8, off = 0.06 + r() * 0.12;
                tufts.push({ kind: r() < 0.6 ? 'weeds' : 'grass', x: h.point.x + _t.x * u + _n.x * off, y: gy - 0.02, z: h.point.z + _t.z * u + _n.z * off, s: 0.35 + r() * 0.45, ry: r() * Math.PI * 2, tint: r() < 0.5 ? '#b9b98a' : '#a3ab7a' });
              }
            }
            continue;
          }
        }
      }
    }
    // Flächen-Decal
    const cov = covered(world, x, gy, z);
    const cell = pickCell(r, cov);
    const [s0, s1] = SIZE[cell];
    const w = s0 + r() * (s1 - s0), d = w * (0.65 + r() * 0.35), a = r() * Math.PI * 2;
    const k = key(x, z, Math.max(1.2, w * 0.7));
    if (taken.has(k)) continue;
    if (!flat(world, x, gy, z, a, w, d, cell === GROUND_CELL.pfuetze ? 0.025 : 0.05)) continue;
    taken.add(k);
    items.push({ x, y: gy + 0.005 + (cell === GROUND_CELL.pfuetze ? 0.002 : 0), z, a, w, d, cell, tint: cell === GROUND_CELL.pfuetze || cell === GROUND_CELL.oel ? 1 : cell === GROUND_CELL.erde ? 0.68 + r() * 0.4 : 0.82 + r() * 0.3 });
  }
  if (!items.length) return { count: 0, wall: 0, tufts: 0, meshes: 0, ms: Math.round(performance.now() - t0) };
  const byCell = new Map(), cs = GRID[quality] || 44;
  for (const it of items) { const ck = `${Math.floor(it.x / cs)}|${Math.floor(it.z / cs)}`; if (!byCell.has(ck)) byCell.set(ck, []); byCell.get(ck).push(it); }
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = dressingMaterial(quality);
  let meshes = 0;
  for (const list of byCell.values()) {
    const gg = geo.clone();
    const cellAttr = new Float32Array(list.length * 4), rough = new Float32Array(list.length);
    const mesh = new THREE.InstancedMesh(gg, mat, list.length);
    list.forEach((it, i) => {
      if (it.wall) {
        // Ebene flach, lokales +Y (obere Zellkante = Wandseite) zur Wand, Normale nach oben
        _by.set(-it.nx, 0, -it.nz); _bx.crossVectors(_by, _up);
      } else {
        _bx.set(Math.cos(it.a), 0, Math.sin(it.a)); _by.set(Math.sin(it.a), 0, -Math.cos(it.a));
      }
      _m.makeBasis(_bx, _by, _up); _q.setFromRotationMatrix(_m);
      _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.w, it.d, 1));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _col.setScalar(it.tint));
      cellAttr.set([(it.cell % 4) * 0.25, (1 - Math.floor(it.cell / 4)) * 0.5, 0.25, 0.5], i * 4);
      rough[i] = ROUGH[it.cell];
    });
    gg.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellAttr, 4));
    gg.setAttribute('aRough', new THREE.InstancedBufferAttribute(rough, 1));
    mesh.computeBoundingSphere();
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = 1;
    mesh.name = 'bodenauflage';
    group.add(mesh);
    meshes++;
  }
  geo.dispose();
  if (tufts.length) {
    const f = createFoliage(tufts, quality);
    for (const m of f.meshes) { m.name = 'bodenauflage-gras'; m.castShadow = false; group.add(m); meshes++; }
  }
  // karten-voll (14.11.): Kleinmüll in 3D (Dosen, Flaschen, Papier, Karton, Tüten, Schachteln, Brocken)
  let litter = { count: 0, meshes: 0 };
  try { litter = placeLitter3D(world, group, { quality, seed, def }); } catch (err) { console.warn('[world] Kleinmüll', err); }
  return { count: items.length, wall, tufts: tufts.length, meshes: meshes + litter.meshes, litter: litter.count, ms: Math.round(performance.now() - t0) };
}

// ---------------------------------------------------------------------------
// karten-voll (14.11.): Kleinmüll in 3D. Nutzer: „Die Maps sind generell noch viel zu leer.“ Liegt bevorzugt an
// Wandfüßen und in Ecken (wie echter Müll, den der Wind zusammentreibt), sonst vereinzelt auf freier Fläche; je Art
// ein InstancedMesh (≈ 8 Draw Calls, keine Schatten), Farbe je Instanz. Nur Optik (keine Kollision/Kugeln), gesät
// über die Kartenkennung. medium 420 · high 900 · ultra 1300 Stück; low lädt das Modul nicht.
// ---------------------------------------------------------------------------
const LITTER_CAP = { medium: 700, high: 1700, ultra: 2400 }; // fuell (20.11.): vorher 420/900/1300
/** Arten: Geometrie-Bauer, Farben, Rauheit/Metall, Gewicht je Kartenstil. */
const LITTER = [
  { id: 'dose', geo: () => new THREE.CylinderGeometry(0.033, 0.033, 0.12, 8).rotateZ(Math.PI / 2).translate(0, 0.033, 0), cols: ['#b8261e', '#c8c8c4', '#2c4f9a', '#2f7a3a', '#d8b02a', '#1c1c1c'], r: 0.35, m: 0.6 },
  { id: 'flasche', geo: () => mergeGeos([new THREE.CylinderGeometry(0.035, 0.035, 0.19, 8).translate(0, 0.095, 0), new THREE.CylinderGeometry(0.012, 0.03, 0.08, 6).translate(0, 0.23, 0)]).rotateZ(Math.PI / 2).translate(0, 0.035, 0), cols: ['#2f5a2a', '#5a3a1a', '#cfd8d2', '#3a4a2a'], r: 0.12, m: 0 },
  { id: 'knuell', geo: () => new THREE.IcosahedronGeometry(0.05, 0).scale(1, 0.65, 1).translate(0, 0.03, 0), cols: ['#e8e4da', '#d8d2c4', '#c8c0ae', '#f0ece2'], r: 0.9, m: 0 },
  { id: 'blatt', geo: () => { const g = new THREE.PlaneGeometry(0.21, 0.29, 2, 2).rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, 0.004 + Math.abs(Math.sin(i * 2.1)) * 0.012); g.computeVertexNormals(); return g; }, cols: ['#ece8de', '#e2dccc', '#d8d0bc', '#f2eee6'], r: 0.92, m: 0, side: THREE.DoubleSide },
  { id: 'karton', geo: () => new THREE.BoxGeometry(0.46, 0.012, 0.34).translate(0, 0.006, 0), cols: ['#a88a62', '#9a7c56', '#b89870'], r: 0.95, m: 0 },
  { id: 'tuete', geo: () => new THREE.SphereGeometry(0.12, 7, 4).scale(1, 0.28, 0.8).translate(0, 0.025, 0), cols: ['#e8e8e4', '#2c4f9a', '#1c1c1c', '#c8302a'], r: 0.45, m: 0 },
  { id: 'schachtel', geo: () => new THREE.BoxGeometry(0.09, 0.022, 0.056).translate(0, 0.011, 0), cols: ['#c82a22', '#f0ece2', '#2c3a6a', '#d8b02a'], r: 0.7, m: 0 },
  { id: 'brocken', geo: () => new THREE.DodecahedronGeometry(0.07, 0).scale(1.3, 0.7, 1).translate(0, 0.03, 0), cols: ['#9a8a7a', '#8a6a5a', '#a8a49a', '#b06a4a'], r: 0.95, m: 0 },
];
const LITTER_MIX = {
  hafen: [1.2, 0.8, 0.9, 0.6, 1.4, 1.0, 0.6, 0.8], werk: [1.0, 0.7, 0.8, 0.5, 1.2, 0.6, 0.5, 1.6],
  altstadt: [1.0, 1.2, 1.2, 1.2, 0.7, 0.9, 1.0, 0.8], default: [1, 1, 1, 1, 1, 1, 1, 1],
  bibliothek: [0, 0.05, 1.4, 2.4, 0.15, 0, 0.05, 0.3], // fuell: Kloster-Bibliothek – Papier statt Dosen/Tüten
  // fuell: Front-/Brandkarten – Brocken, wenig Zivilmüll, keine weißen Blätter auf verbranntem Boden
  brandwald: [0.4, 0.3, 0.05, 0, 0.2, 0, 0.1, 2.6], niemandsland: [0.5, 0.35, 0.05, 0, 0.25, 0, 0.15, 2.4],
};
function mergeGeos(list) {
  const P = [], N = [];
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  return g;
}

export function placeLitter3D(world, group, { quality = 'high', seed = 1, def = {} } = {}) {
  let cap = LITTER_CAP[quality] || 0;
  if (!cap || !world?.raycast || !world.bounds || def.litter3d === false) return { count: 0, meshes: 0 };
  const r = rng(seed ^ 0x2c1b3c6d), b = world.bounds;
  // fuell: Großkarten nur in Bereichen (Ortschaften), Menge nach Fläche
  const opt = def.groundDressing || {}, ber = opt.bereiche && opt.bereiche.length ? opt.bereiche : null;
  const berW = ber ? ber.map((q) => (q.maxX - q.minX) * (q.maxZ - q.minZ)) : null, berSum = ber ? berW.reduce((a, c) => a + c, 0) : 0;
  const flaeche = ber ? berSum : (b.max.x - b.min.x) * (b.max.z - b.min.z);
  cap = Math.round(cap * Math.min(ber ? 2.5 : 1.5, Math.max(0.3, flaeche / 12000)) * (opt.cap ?? 1));
  const mix = LITTER_MIX[def.id] || LITTER_MIX.default, mixSum = mix.reduce((a, c) => a + c, 0);
  const pick = () => { let k = r() * mixSum; for (let i = 0; i < mix.length; i++) { k -= mix[i]; if (k <= 0) return i; } return 0; };
  const per = LITTER.map(() => []);
  let n = 0, tries = 0;
  while (n < cap && tries++ < cap * 6) {
    let x, z;
    if (ber) { let k = r() * berSum, i = 0; while (i < ber.length - 1 && (k -= berW[i]) > 0) i++; const q = ber[i]; x = q.minX + r() * (q.maxX - q.minX); z = q.minZ + r() * (q.maxZ - q.minZ); }
    else { x = b.min.x + r() * (b.max.x - b.min.x); z = b.min.z + r() * (b.max.z - b.min.z); }
    const gy0 = bodenY(world, x, z);
    if (gy0 == null) continue;
    let g = groundAt(world, x, z, gy0 + 0.4);
    if (!g || g.surface === 'water' || /water/.test(g.name)) continue;
    // 65 %: an den nächsten Wandfuß rücken (waagerechter Strahl knapp über dem Boden)
    if (r() < 0.65) {
      const a = r() * Math.PI * 2;
      _o.set(x, g.y + 0.12, z); _d.set(Math.cos(a), 0, Math.sin(a));
      const h = world.raycast(_o, _d, 6);
      if (h && Math.abs(h.normal.y) < 0.2 && h.distance > 0.25) {
        const off = 0.08 + r() * 0.35;
        x = h.point.x - _d.x * off; z = h.point.z - _d.z * off;
        g = groundAt(world, x, z, g.y + 0.4);
        if (!g || g.surface === 'water') continue;
      }
    }
    // kleines Nest aus 1–4 Teilen
    const k = 1 + Math.floor(r() * r() * 4);
    for (let i = 0; i < k && n < cap; i++) {
      const px = x + (r() - 0.5) * 0.8 * (i ? 1 : 0), pz = z + (r() - 0.5) * 0.8 * (i ? 1 : 0);
      const gg = i ? groundAt(world, px, pz, g.y + 0.3) : g;
      if (!gg || Math.abs(gg.y - g.y) > 0.04) continue;
      const t = pick(), L = LITTER[t];
      per[t].push({ x: px, y: gg.y, z: pz, a: r() * Math.PI * 2, s: 0.8 + r() * 0.45, c: L.cols[Math.floor(r() * L.cols.length)], tilt: (r() - 0.5) * 0.25 });
      n++;
    }
  }
  let meshes = 0;
  const _e = new THREE.Euler();
  LITTER.forEach((L, t) => {
    const list = per[t];
    if (!list.length) return;
    const mat = new THREE.MeshStandardMaterial({ roughness: L.r, metalness: L.m, side: L.side || THREE.FrontSide });
    mat.name = 'kleinmuell-' + L.id; mat.userData.disposable = true;
    const mesh = new THREE.InstancedMesh(L.geo(), mat, list.length);
    list.forEach((it, i) => {
      _q.setFromEuler(_e.set(it.tilt, it.a, it.tilt * 0.5, 'YXZ'));
      _m.compose(_p.set(it.x, it.y, it.z), _q, _s.setScalar(it.s));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _col.set(it.c));
    });
    mesh.computeBoundingSphere();
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    mesh.name = 'kleinmuell';
    group.add(mesh);
    meshes++;
  });
  return { count: n, meshes };
}
