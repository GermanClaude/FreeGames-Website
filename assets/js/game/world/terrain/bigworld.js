// NULLPUNKT — Laden einer Großkarte (MAPS[id].scale === 'gross') (Owner: world). Wird von world/index.js loadWorld()
// per import() nur für Großkarten geladen; liefert ein World-Objekt mit der Vertrags-API (§6) plus Großkarten-
// Ergänzungen (GROSSKAMPF_PLAN §12.2): heightAt, normalAt, inBounds, terrain, roads, vehicleSpawns,
// objectives.cq, spawns.hq, secrets, visibility, nav.findPathAsync.
//
// Ablauf: Gelände im Welt-Worker erzeugen ‖ Ortschaften mit MapBuilder bauen (je Ortschaft ein Builder, Boden bei
// y = 0 bzw. Plateauhöhe) → Gelände-Material/-Kacheln, Kulissenring, Wasser, Straßen, Vegetation → Worker: BVHs +
// Startpunkte + Navigation ‖ Licht/HDRI → Welt-Objekt.
import * as THREE from 'three';
import { MAPS } from '../../../shared/maps.data.js?v=20261122020853';
import { configureTextures, getMaterial, beginTextureEpoch, releaseUnusedTextures, deferTextureGeneration, planLibraryMaterials, resolveLibraryMaterials, libraryInUse, libraryStats } from '../../engine/textures.js?v=20261122020853';
import { createWorldAssets } from '../library.js?v=20261122020853';
import { MapBuilder, SURFACES, civilList } from '../builder.js?v=20261122020853';
import { createLighting } from '../lighting.js?v=20261122020853';
import { applyWorldShading, applyCuts, bindShadingScene, watchScene, initShading, resetShading, setShadingMode } from '../shading.js?v=20261122020853';
import { createAtmosphere } from '../atmos.js?v=20261122020853';
import { resolveConditions, applyConditions } from '../weather.js?v=20261122020853';
import { createWater } from '../water.js?v=20261122020853';
import { TriangleBVH } from '../bvh.js?v=20261122020853';
import { breakableAccess, mergeAccess } from '../bruch.js?v=20261122020853'; // zerbrechliche Requisiten (game/breakables.js)
import { makeTests } from '../navbuild.js?v=20261122020853';
import { foliageUniforms, attachFoliageClock } from '../atlas.js?v=20261122020853';
import { Heightfield } from './heightfield.js?v=20261122020853';
import { makeCoarse } from './generate.js?v=20261122020853';
import { CompositeBVH } from './composite.js?v=20261122020853';
import { TerrainCollider } from './collide.js?v=20261122020853';
import { TerrainChunks, createFarRing } from './chunks.js?v=20261122020853';
import { createTerrainMaterial } from './splat.js?v=20261122020853';
import { Vegetation } from './vegetation.js?v=20261122020853';
import { loadTreeAtlas, TREE_BARKS } from './trees.js?v=20261122020853';
import { Deadwood } from './deadwood.js?v=20261122020853';
import { Litter } from './litter.js?v=20261122020853';
import { RoadNetwork } from './roads.js?v=20261122020853';
import { bigNavFromData } from './bignav.js?v=20261122020853';
import { createBigMinimap } from './bigminimap.js?v=20261122020853';
import { terrainJob, worldJob } from './bigjob.js?v=20261122020853';
import { appClient } from '../../../shared/appgate.js?v=20261122020853';

const BIG_MAPS = {
  grenzland: () => import('../maps/grenzland.js?v=20261122020853'),
  niemandsland: () => import('../maps/niemandsland.js?v=20261122020853'),
  brandwald: () => import('../maps/brandwald.js?v=20261122020853'),
  flugplatz: () => import('../maps/flugplatz.js?v=20261122020853'), // karten-neu: Fliegerhorst mit Startbahn
  weitmark: () => import('../maps/weitmark.js?v=20261122020853'), // riesen: Riesenkarte 1600 × 1600 m (nur App, shared/appgate.js)
  range: () => import('../maps/range.js?v=20261122020853'), // Übungsgelände um den Schießstand (nur Training/Panzer-Übung)
};
export const BIG_MAP_IDS = Object.keys(BIG_MAPS);

/**
 * riesen: Dateien App-exklusiver Karten. Der Service Worker der Web-Version nimmt sie nie auf (sw.js APP_ONLY); die
 * Android-App (lädt die Website) legt sie beim ersten Laden der Karte in den eigenen Speicher np-app – danach offline
 * spielbar. Die Desktop-App hat sie ohnehin lokal (extraResources, desktop/package.json).
 */
const APP_FILES = { weitmark: ['../maps/weitmark.js?v=20261122020853', '../maps/weitmark-bau.js?v=20261122020853'] };
function keepAppFiles(id) {
  if (appClient().kind !== 'android-app' || typeof caches === 'undefined' || !APP_FILES[id]) return;
  const urls = APP_FILES[id].map((p) => new URL(p, import.meta.url).href);
  caches.open('np-app').then(async (c) => {
    const base = urls.map((u) => u.split('?')[0]);
    for (const k of await c.keys()) if (base.includes(k.url.split('?')[0]) && !urls.includes(k.url)) await c.delete(k); // ältere Fassungen
    await c.addAll(urls.filter(Boolean));
  }).catch(() => { /* Speicher voll / offline */ });
}

/** Budgets je Qualitätsstufe (GROSSKAMPF_PLAN §3.4; Handy = low). density: Anteil der kollisionslosen Büsche/Schilf –
 * Bäume und Felsen (Kollision) stehen auf jeder Stufe vollständig (Mehrspieler, terrain/vegetation.js). */
/** desktop: Zusätze der Stufe „Extrem“ auf Ultra (mehr Speicher/GPU in der Desktop-App). */
export const BIG_EXTREME = Object.freeze({ view: 1400, dists: [120, 300, 560], treeNear: 260, treeFar: 1300, grass: 70, grassCap: 11000, grassNear: 20, far: 1600, mapPx: 2048, siteCull: 1250, shadow: 90 });
export const BIG_TIERS = {
  low: { view: 340, steps: [2, 4, 8, 16], dists: [56, 150, 260], treeNear: 55, treeFar: 330, grass: 12, grassStep: 1.7, grassCap: 220, treeShadow: false, density: 0.55, far: 700, mapPx: 512, siteCull: 210, shadow: 24 },
  medium: { view: 600, steps: [1, 2, 4, 8], dists: [48, 150, 330], treeNear: 90, treeFar: 580, grass: 25, grassStep: 1.4, grassCap: 1600, grassBlades: 10, treeShadow: false, density: 0.8, far: 900, mapPx: 1024, siteCull: 520, shadow: 40 },
  high: { view: 850, steps: [1, 2, 4, 8], dists: [70, 200, 380], treeNear: 150, treeFar: 820, grass: 40, grassStep: 1.3, grassCap: 4400, grassBlades: 12, grassNear: 12, treeShadow: true, density: 1, far: 1000, mapPx: 1024, siteCull: 760, shadow: 60 },
  ultra: { view: 850, steps: [1, 2, 4, 8], dists: [90, 240, 420], treeNear: 190, treeFar: 840, grass: 55, grassStep: 1.25, grassCap: 7400, grassBlades: 12, grassNear: 16, treeShadow: true, density: 1, far: 1000, mapPx: 1024, siteCull: 800, shadow: 70 },
};

/**
 * gross (23.11.): Sichtschutz der Startpunkte auf Großkarten (Gegenstück zu shieldSpawns in world/index.js). Prüfskript:
 * Grenzland 12, Brandwald 6 Sichtlinien zwischen den Startbereichen (180–340 m, Augenhöhe); Brandwald A6 stand an der
 * Grabenwand (Kapsel blockiert). Sieht ein Startpunkt einen gegnerischen der gleichen Liste (Teamkampf A↔B,
 * Eroberung hq.A↔hq.B) oder steckt die Kapsel in der Geometrie, rückt er auf den nächsten Navigationsknoten (über
 * Verbindungen erreichbar, ≤ 14 m, gleiche Höhe ± 1 m), der frei ist und keinen gegnerischen Startpunkt sieht; ohne
 * solchen Knoten nur aus der Geometrie heraus. Sicht und Kapsel nur gegen Höhenfeld + Kollisions-BVH: beide sind auf
 * jeder Qualitätsstufe gleich (die Kugel-BVH nicht – Kleinkram je Stufe), Knotenfolge fest → gleiches Ergebnis auf
 * allen Geräten (Mehrspieler). → { moved, freed, seen } (Anzahl)
 */
const BIG_EYE = 1.6, BIG_SHIELD_R = 14;
function shieldBigSpawns(groups, nav, comp) {
  const hit = { t: 0, tri: 0, nx: 0, ny: 0, nz: 0, data: 0, back: false };
  const sees = (a, c) => {
    const dx = c.x - a.x, dy = c.y - a.y, dz = c.z - a.z, l = Math.hypot(dx, dy, dz);
    return l > 1e-3 && l < 400 && !comp.occluded(a.x, a.y + BIG_EYE, a.z, dx / l, dy / l, dz / l, l - 0.05);
  };
  const capsFree = (p) => {
    if (comp.raycast(p.x, p.y + 0.15, p.z, 0, 1, 0, 1.75, hit)) return false;
    for (const hy of [0.6, 1.4]) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; if (comp.raycast(p.x, p.y + hy, p.z, Math.cos(a), 0, Math.sin(a), 0.42, hit)) return false; }
    return true;
  };
  const st = { moved: 0, freed: 0, seen: 0 };
  if (!nav?.nodes?.length) return st;
  for (const [LA, LB] of groups) for (const [mine, foe] of [[LA, LB], [LB, LA]]) {
    for (const s of mine) {
      const p = s.position, seen = foe.some((f) => sees(p, f.position)), free = capsFree(p);
      if (!seen && free) continue;
      // Kandidaten: Breitensuche über Verbindungen ab dem nächsten Knoten, sortiert nach Abstand (stabil: Knoten-ID)
      const start = nav.nearest(p);
      if (!start) continue;
      const seenIds = new Set([start.id]), queue = [start], cand = [];
      while (queue.length) {
        const n = queue.shift();
        cand.push(n);
        for (const l of n.links) {
          const m = nav.nodes[l];
          if (!m || seenIds.has(m.id)) continue;
          seenIds.add(m.id);
          if (Math.hypot(m.position.x - p.x, m.position.z - p.z) <= BIG_SHIELD_R && Math.abs(m.position.y - p.y) < 1.0) queue.push(m);
        }
      }
      cand.sort((a, b) => (a.position.distanceToSquared(p) - b.position.distanceToSquared(p)) || a.id - b.id);
      const others = mine.filter((o) => o !== s).map((o) => o.position);
      let best = null, fallback = null;
      for (const n of cand) {
        const q = n.position;
        if (others.some((o) => o.distanceToSquared(q) < 1.5 * 1.5) || !capsFree(q)) continue;
        if (!fallback) fallback = n;
        if (!seen || !foe.some((f) => sees(q, f.position))) { best = n; break; }
      }
      const to = best || (!free ? fallback : null);
      if (seen) st.seen++;
      if (!to) continue;
      p.copy(to.position);
      if (best && seen) st.moved++; else st.freed++;
    }
  }
  return st;
}

/** Gelände-/Welt-Aufträge im Worker (Rückfall: Hauptthread). */
function createRunner() {
  let worker = null, seq = 0;
  const pending = new Map();
  let broken = false;
  try {
    if (typeof Worker === 'undefined') throw new Error('keine Worker');
    worker = new Worker(new URL('./bigjob.worker.js?v=20261122020853', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const d = e.data || {}, p = pending.get(d.id);
      if (!p) return;
      if (d.stage) { try { p.onStage?.(d.stage); } catch { /* UI */ } return; }
      pending.delete(d.id);
      if (d.error) p.reject(new Error(d.error)); else p.resolve(d.result);
    };
    worker.onerror = (e) => { e.preventDefault?.(); broken = true; for (const p of pending.values()) p.reject(Object.assign(new Error('Worker'), { fallback: true })); pending.clear(); };
  } catch { worker = null; }
  let localHf = null;
  const local = async (type, payload, onStage, hfMain) => {
    await new Promise(r => setTimeout(r, 0));
    if (type === 'terrain') { const r = await terrainJob(payload.spec, onStage); localHf = r.hf; return { data: r.data, roads: r.roads, river: r.river }; }
    return worldJob(payload.job, localHf || hfMain, onStage);
  };
  return {
    get usesWorker() { return !!worker && !broken; },
    async run(type, payload, onStage, hfMain) {
      if (worker && !broken) {
        try {
          return await new Promise((resolve, reject) => {
            const id = ++seq;
            pending.set(id, { resolve, reject, onStage });
            worker.postMessage({ id, type, ...payload });
          });
        } catch (err) { if (!err?.fallback) throw err; }
      }
      return local(type, payload, onStage, hfMain);
    },
    dispose() { worker?.terminate(); worker = null; },
  };
}

async function uploadTextures(renderer, root) {
  if (!renderer || typeof renderer.initTexture !== 'function') return 0;
  const t0 = performance.now(), seen = new Set();
  root.traverse(o => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap']) if (m[k]?.isTexture) seen.add(m[k]);
    }
  });
  let slice = performance.now();
  for (const tex of seen) {
    try { renderer.initTexture(tex); } catch { /* beim ersten Bild */ }
    if (performance.now() - slice > 10) { await new Promise(r => setTimeout(r, 0)); slice = performance.now(); }
  }
  return Math.round(performance.now() - t0);
}

/** Dreiecks-Puffer zusammenfügen. */
function concatF32(list) {
  let n = 0; for (const a of list) n += a.length;
  const out = new Float32Array(n);
  let o = 0; for (const a of list) { out.set(a, o); o += a.length; }
  return out;
}

/**
 * riesen: Fernkulisse einer Ortschaft – Gebäude-Grundrisse (MapBuilder.footprints, kind 'building') als Quader mit
 * Dachkeil-Ersatz (oben 1,5 m höher, dunkler), Vertexfarben, ohne Texturen (kein zusätzlicher Sampler, keine Kollision).
 */
function siteImpostor(footprints, y0 = 0) {
  const list = (footprints || []).filter((f) => f.kind === 'building' && f.hw > 1.5 && f.hd > 1.5);
  if (!list.length) return null;
  const P = [], C = [], wall = new THREE.Color('#c9c1b2').convertSRGBToLinear(), roof = new THREE.Color('#8e6f62').convertSRGBToLinear();
  const quad = (a, b, c, d, col) => { for (const v of [a, b, c, a, c, d]) { P.push(v[0], v[1], v[2]); C.push(col.r, col.g, col.b); } };
  // weit2: Satteldach entlang der langen Seite (Giebel als Wandfarbe), Wand-/Dachtöne je Gebäude aus der Lage gehasht
  const wv = ['#d9d2c2', '#cfc6b2', '#e2dccd', '#c9b99c', '#d4cbb8', '#bfb8a8'].map((h) => new THREE.Color(h).convertSRGBToLinear());
  const rv = ['#8e6352', '#9c6a56', '#7a5a4e', '#6a625c', '#a3725c', '#5c5a58'].map((h) => new THREE.Color(h).convertSRGBToLinear());
  const tri = (a, b, c, col) => { for (const v of [a, b, c]) { P.push(v[0], v[1], v[2]); C.push(col.r, col.g, col.b); } };
  for (const f of list) {
    const x0 = f.x - f.hw, x1 = f.x + f.hw, z0 = f.z - f.hd, z1 = f.z + f.hd;
    const hsh = Math.abs(Math.sin(f.x * 12.9898 + f.z * 78.233) * 43758.5453) % 1;
    const wcol = wv[Math.floor(hsh * wv.length)] || wall, rcol = rv[Math.floor(((hsh * 7.31) % 1) * rv.length)] || roof;
    const ya = Math.min(f.y0 ?? y0, y0) - 0.5, yb = Math.max(f.y1 ?? y0 + 6, ya + 2), yr = yb + Math.min(4, Math.min(f.hw, f.hd) * 0.8);
    quad([x0, ya, z1], [x1, ya, z1], [x1, yb, z1], [x0, yb, z1], wcol);
    quad([x1, ya, z0], [x0, ya, z0], [x0, yb, z0], [x1, yb, z0], wcol);
    quad([x1, ya, z1], [x1, ya, z0], [x1, yb, z0], [x1, yb, z1], wcol);
    quad([x0, ya, z0], [x0, ya, z1], [x0, yb, z1], [x0, yb, z0], wcol);
    if (f.hw >= f.hd) { // First entlang x
      const zm = (z0 + z1) / 2;
      quad([x0, yb, z1], [x1, yb, z1], [x1, yr, zm], [x0, yr, zm], rcol);
      quad([x1, yb, z0], [x0, yb, z0], [x0, yr, zm], [x1, yr, zm], rcol);
      tri([x1, yb, z1], [x1, yb, z0], [x1, yr, zm], wcol); tri([x0, yb, z0], [x0, yb, z1], [x0, yr, zm], wcol);
    } else {
      const xm = (x0 + x1) / 2;
      quad([x1, yb, z1], [x1, yb, z0], [xm, yr, z0], [xm, yr, z1], rcol);
      quad([x0, yb, z0], [x0, yb, z1], [xm, yr, z1], [xm, yr, z0], rcol);
      tri([x0, yb, z1], [x1, yb, z1], [xm, yr, z1], wcol); tri([x1, yb, z0], [x0, yb, z0], [xm, yr, z0], wcol);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  m.name = 'fernkulisse';
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = false; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false;
  return mesh;
}

/**
 * weit2: Ortschafts-Geometrie der Riesenkarte schlanker halten (JS-Speicher; GPU-Inhalt gleich): Vertexfarben als
 * Uint8 (normiert) statt Float32, Normalen als Int8 (normiert) – 44 → 27 Byte je Eckpunkt. Nur statische Meshes ohne
 * Sonderrolle (zerstörbare Paneele, geteilte Geometrie, Farben > 1 bleiben unverändert); Positionen bleiben Float32
 * (bruch.js/deform.js verändern sie zur Laufzeit).
 */
function packSiteGeometry(meshes) {
  let saved = 0;
  for (const o of meshes || []) {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.shared || o.userData.destructible != null) continue;
    const g = o.geometry, c = g?.attributes?.color, n = g?.attributes?.normal;
    if (c && c.array instanceof Float32Array && c.itemSize === 3 && !c.isInterleavedBufferAttribute) {
      const a = c.array;
      let max = 0; for (let i = 0; i < a.length; i++) if (a[i] > max) max = a[i];
      if (max <= 1.001) {
        const u = new Uint8Array(a.length);
        for (let i = 0; i < a.length; i++) u[i] = Math.max(0, Math.min(255, Math.round(a[i] * 255)));
        g.setAttribute('color', new THREE.BufferAttribute(u, 3, true));
        saved += a.byteLength - u.byteLength;
      }
    }
    if (n && n.array instanceof Float32Array && n.itemSize === 3 && !n.isInterleavedBufferAttribute) {
      const a = n.array, u = new Int8Array(a.length);
      for (let i = 0; i < a.length; i++) u[i] = Math.max(-127, Math.min(127, Math.round(a[i] * 127)));
      g.setAttribute('normal', new THREE.BufferAttribute(u, 3, true));
      saved += a.byteLength - u.byteLength;
    }
  }
  return saved;
}

/** Unsichtbare Randwände (Kollision) um ein Rechteck. */
function boundaryWalls(r, yMin, yMax) {
  const out = [];
  const quad = (ax, az, bx, bz) => out.push(ax, yMin, az, bx, yMin, bz, bx, yMax, bz, ax, yMin, az, bx, yMax, bz, ax, yMax, az);
  quad(r.minX, r.minZ, r.maxX, r.minZ); quad(r.maxX, r.minZ, r.maxX, r.maxZ); quad(r.maxX, r.maxZ, r.minX, r.maxZ); quad(r.minX, r.maxZ, r.minX, r.minZ);
  return new Float32Array(out);
}

/**
 * @param {object} G Spielkontext
 * @param {string} mapId Großkarten-ID (BIG_MAP_IDS)
 * @param {{ onProgress?: (p:number, label:string)=>void }} [opts]
 */
export async function loadBigWorld(G, mapId, { onProgress, weather = null, time = null } = {}) {
  const t0 = performance.now();
  const id = BIG_MAPS[mapId] ? mapId : BIG_MAP_IDS[0];
  const meta = MAPS[id] || { name: id };
  // riesen: App-exklusive Riesenkarte außerhalb der App nicht laden (Plattform-Vorgabe, shared/appgate.js; kein Kopierschutz)
  if (meta.appOnly && !appClient().kind) throw new Error(`Karte „${meta.name || id}“ gibt es nur in der App (PC-App oder Android-App).`);
  const progress = (p, label) => { try { onProgress?.(Math.min(1, Math.max(0, p)), label || ''); } catch { /* UI */ } };
  progress(0, 'Karte wird vorbereitet');
  const renderer = G.renderer?.renderer || G.renderer;
  attachFoliageClock(G); // Wind (Gras/Laub) an der gemeinsamen Uhr (online Host-Zeit)
  const quality = ['low', 'medium', 'high', 'ultra'].includes(G.renderer?.quality) ? G.renderer.quality : (['low', 'medium', 'high', 'ultra'].includes(G.settings?.get?.('quality')) ? G.settings.get('quality') : 'high');
  // desktop „Extrem“ (nur Desktop-App, renderer.js EXTREME_PRESET): Ultra mit weiterer Sicht, Bäumen/Gras weiter draußen
  const extreme = !!(G.renderer?.preset?.extreme && quality === 'ultra');
  let tier = extreme ? { ...BIG_TIERS.ultra, ...BIG_EXTREME } : BIG_TIERS[quality];
  const debug = !!(G.debug || G.params?.get?.('debug') === '1');
  const lowTex = quality === 'low';
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() || 4;
  configureTextures({ size: lowTex ? 256 : 512, quality, renderer }); // textures-2: Anisotropie je Stufe (low 4, medium 8, high/ultra 16)
  beginTextureEpoch();

  const { default: def0 } = await BIG_MAPS[id]();
  if (meta.appOnly) keepAppFiles(id);
  // atmosphere-weather: Wetter/Tageszeit → abgeleitete Definition (Standard = def0)
  const conditions = resolveConditions(meta, { weather, time });
  const def = applyConditions(def0, conditions, id);
  // riesen (20.11.): Riesenkarte (def.giant) – Sichtweite/Fernkulisse/Budgets je Stufe aus der Kartenbeschreibung; in der
  // Android-App (Handy, Tablet, Quest als 2D-App) zusätzlich gedeckelt (Speicher-Budget je Plattform)
  if (def.giant) {
    const gt = def.giant.tiers?.[quality] || {};
    tier = { ...tier, ...gt };
    if (extreme) for (const k of ['view', 'far', 'treeFar', 'siteCull', 'mapPx']) tier[k] = Math.max(tier[k] ?? 0, BIG_EXTREME[k] ?? 0, gt[k] ?? 0);
    if (appClient().kind === 'android-app' && def.giant.android) for (const [k, v] of Object.entries(def.giant.android)) tier[k] = Math.min(tier[k] ?? v, v);
  }
  // Übungsgelände (range, 21.11.): eigene Sichtweite je Stufe (Panzerschießbahn bis 2500 m) – def.viewTiers[q] { view, far }
  if (def.viewTiers && def.viewTiers[quality]) tier = { ...tier, ...def.viewTiers[quality] };
  const runner = createRunner();
  const ms = {};
  // 1) Gelände im Worker (parallel zu den Ortschaften)
  let tT = performance.now();
  const terrainP = runner.run('terrain', { spec: def.terrain }, (s) => progress(0.04, s)).then((r) => { ms.terrain = Math.round(performance.now() - tT); return r; });
  terrainP.catch(() => { /* unten behandelt */ });

  // 2) Bibliothek + Ortschaften
  const lib = createWorldAssets(G, def, quality);
  const libOk = await lib.check();
  const hdriPromise = lib.loadHdri(def.lighting?.sun);
  const libPlan = libOk ? lib.planMaterials() : null;
  planLibraryMaterials(libPlan);
  const tB = performance.now();
  const sites = [];
  const ctx = { THREE, quality, debug, getMaterial, lib: libOk, tier };
  deferTextureGeneration(true);
  try {
    for (let k = 0; k < def.sites.length; k++) {
      const s = def.sites[k];
      const vb = { minX: s.bounds.minX - 12, maxX: s.bounds.maxX + 12, minZ: s.bounds.minZ - 12, maxZ: s.bounds.maxZ + 12 };
      const b = new MapBuilder({ bounds: vb, seed: (def.seed || 1) + k * 101, chunkSize: s.chunkSize || (quality === 'low' ? 64 : 48), groundNoise: s.groundNoise ?? 0.12, interiorTint: s.interiorTint, ...(s.splitTris || def.giant?.splitTris ? { splitTris: s.splitTris || def.giant.splitTris } : {}) }); // weit2: Riesenkarte – Materialien erst ab mehr Dreiecken je Chunk teilen (weniger Draw Calls)
      b.lookQuality = quality; // env-look: Detailformen ab medium
      b.timeOfDay = conditions.time || meta.timeDefault || null; // props.js lampsOn (Laternen nur abends)
      if (libOk) {
        b.lib = lib.modelIds();
        b.library = async (req, onProg) => { const r = await lib.load({ ...req, plan: libPlan }, onProg); resolveLibraryMaterials(r.sets); return r; };
      }
      const res = s.build(b, ctx) || {};
      const p0 = 0.06 + (k / def.sites.length) * 0.44, p1 = 0.06 + ((k + 1) / def.sites.length) * 0.44;
      const built = await b.build({ quality, anisotropy: Math.min(G.renderer?.preset?.anisotropy || 4, maxAniso), onProgress: (p, l) => progress(p0 + (p1 - p0) * p, `${s.name}: ${l}`) });
      if (def.giant) packSiteGeometry(built.meshes);
      sites.push({ def: s, b, res, built });
    }
  } finally {
    if (!libOk) resolveLibraryMaterials(new Map());
    deferTextureGeneration(false);
  }
  ms.sites = Math.round(performance.now() - tB);

  // 3) Gelände übernehmen
  progress(0.52, 'Gelände');
  const terr = await terrainP;
  const hf = Heightfield.fromData(terr.data);
  hf.riverLine = terr.river;
  // 3b) Ortschaften, die Geländehöhen brauchen (z. B. Grenzanlage entlang der Kartengrenze): def.lateSites – wie
  // def.sites, build(b, ctx) bekommt zusätzlich ctx.hf (Höhenfeld) und ctx.roads (Gelände-Straßen mit samples);
  // Rückgabe { clearLines: [{ pts, r }] } hält Bäume/Gras aus Streifen fern. Ohne Navigation (nav: false).
  for (let k = 0; k < (def.lateSites || []).length; k++) {
    const s = def.lateSites[k];
    progress(0.52, s.name);
    const vb = { minX: s.bounds.minX - 12, maxX: s.bounds.maxX + 12, minZ: s.bounds.minZ - 12, maxZ: s.bounds.maxZ + 12 };
    const b = new MapBuilder({ bounds: vb, seed: (def.seed || 1) + 7919 + k * 101, chunkSize: s.chunkSize || 64, groundNoise: 0, interiorTint: s.interiorTint, ...(s.splitTris || def.giant?.splitTris ? { splitTris: s.splitTris || def.giant.splitTris } : {}) });
    b.lookQuality = quality;
    b.timeOfDay = conditions.time || meta.timeDefault || null;
    if (libOk) {
      b.lib = lib.modelIds();
      b.library = async (req, onProg) => { const r = await lib.load({ ...req, plan: libPlan }, onProg); resolveLibraryMaterials(r.sets); return r; };
    }
    const res = s.build(b, { ...ctx, hf, roads: terr.roads }) || {};
    const built = await b.build({ quality, anisotropy: Math.min(G.renderer?.preset?.anisotropy || 4, maxAniso), onProgress: (p, l) => progress(0.52, `${s.name}: ${l}`) });
    if (def.giant) packSiteGeometry(built.meshes);
    sites.push({ def: { ...s, nav: false }, b, res, built });
  }
  const pb = def.bounds;
  const group = new THREE.Group();
  group.name = 'world:' + id;
  const tM = performance.now();
  const tLib = performance.now();
  const tmat = await createTerrainMaterial({ hf, quality, lib, libOk, getMaterial, maxTex: renderer?.capabilities?.maxTextures, tier: lib.stats?.tier?.texture, look: def.terrainLook || null });
  ms.terrainLib = Math.round(performance.now() - tLib);
  // riesen: auf Riesenkarten feine Kachel-Stufen in der Ferne wieder freigeben (Speicher bleibt beim Flug über die Karte begrenzt)
  const chunks = new TerrainChunks(hf, tmat.material, { steps: tier.steps, dists: tier.dists, chunk: 128, evict: !!def.giant });
  await chunks.build((p) => progress(0.55 + p * 0.05, 'Gelände-Kacheln'));
  const firstSpawn = def.spawns?.A?.[0] || [0, 0];
  chunks.prewarm(firstSpawn[0], firstSpawn[1], 200);
  group.add(chunks.group);
  const farRing = createFarRing(hf, makeCoarse(def.terrain), tmat.material, { radius: tier.far, step: quality === 'low' ? 32 : def.giant ? 24 : 20 });
  group.add(farRing);
  // 26.10. (K0): Wasser nur in 4-m-Zellen, in denen das Gelände unter den Wasserspiegel reicht (water.js)
  const wetCell = (x0, z0, x1, z1) => {
    if (hf.rangeY(x0 - 1, z0 - 1, x1 + 1, z1 + 1)[0] > hf.waterY + 0.05) return false;
    for (let z = z0 - 1; z <= z1 + 1; z += hf.res) for (let x = x0 - 1; x <= x1 + 1; x += hf.res) if (hf.heightAt(x, z) < hf.waterY + 0.05) return true;
    return false;
  };
  const water = createWater({ x0: hf.minX, z0: hf.minZ, x1: hf.maxX, z1: hf.maxZ, y: hf.waterY, color: def.water?.color || '#2c4a3e', scale: 12, roughness: 0.09, keep: wetCell });
  water.mesh.name = 'fluss';
  group.add(water.mesh);
  ms.terrainMesh = Math.round(performance.now() - tM);

  // 4) Straßen, Vegetation
  progress(0.62, 'Straßen und Vegetation');
  const tV = performance.now();
  const footprints = sites.flatMap(s => s.b.footprints);
  const blockers = footprints.filter(f => f.kind === 'building').map(f => ({ minX: f.x - f.hw, maxX: f.x + f.hw, minZ: f.z - f.hd, maxZ: f.z + f.hd }));
  const roads = new RoadNetwork(terr.roads, hf, { blockers });
  group.add(roads.buildMeshes(getMaterial));
  // Sperrraster (2 m): Ortschaften, Straßen, Flaggen, Startpunkte → keine Bäume/Gras
  const BR = 2, bn = Math.ceil(hf.size / BR) + 1;
  const block = new Uint8Array(bn * bn);
  const mark = (x, z, r) => {
    const i0 = Math.max(0, Math.floor((x - r - hf.minX) / BR)), i1 = Math.min(bn - 1, Math.ceil((x + r - hf.minX) / BR));
    const j0 = Math.max(0, Math.floor((z - r - hf.minZ) / BR)), j1 = Math.min(bn - 1, Math.ceil((z + r - hf.minZ) / BR));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (Math.hypot(hf.minX + i * BR - x, hf.minZ + j * BR - z) <= r) block[j * bn + i] = 1;
  };
  for (const s of def.sites) {
    const r = s.clear || s.bounds;
    for (let z = r.minZ; z <= r.maxZ; z += BR) for (let x = r.minX; x <= r.maxX; x += BR) mark(x, z, 1.5);
  }
  for (const r of roads.roads) for (let k = 0; k < r.points.length; k++) mark(r.points[k].x, r.points[k].z, r.width / 2 + 2.2);
  for (const f of [...(def.flags?.cq || []), ...(def.flags?.dom || [])]) mark(f.x, f.z, 5);
  // gross (23.11.): 11 m statt 7 m – Brandwald: zwei Stämme 9 m vor dem Schützenpanzer (43/160, 45/157) ließen nur 3,2 m
  // Durchfahrt am Basisausgang; Fahrzeuge brauchen Wenderaum
  for (const v of def.vehicles || []) mark(v.x, v.z, 11);
  for (const c of def.clearings || []) mark(c[0], c[1], c[2]);
  // Startpunkte (kein Baum auf dem Spawn) und Streifen späterer Ortschaften (Kontrollstreifen der Grenzanlage)
  for (const t of ['A', 'B', 'ffa']) for (const p of def.spawns?.[t] || []) mark(p[0], p[1], 3);
  for (const t of ['A', 'B']) for (const p of def.spawns?.hq?.[t] || []) mark(p[0], p[1], 3);
  for (const s of sites) for (const L of s.res?.clearLines || []) {
    for (let k = 0; k + 1 < L.pts.length; k++) {
      const [ax, az] = L.pts[k], [bx, bz] = L.pts[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / BR));
      for (let i = 0; i <= n; i++) mark(ax + (bx - ax) * i / n, az + (bz - az) * i / n, L.r);
    }
  }
  const blocked = (x, z) => {
    const i = Math.round((x - hf.minX) / BR), j = Math.round((z - hf.minZ) / BR);
    return i < 0 || j < 0 || i >= bn || j >= bn ? false : block[j * bn + i] === 1;
  };
  // gfx-welt: Rinde und Felsen der Vegetation als Fotoscans – ihre Sätze laufen nicht über die Ortschaften (lib.load je
  // Ortschaft lädt nur deren Materialien), daher hier nachladen, bevor veg.build() die Materialien anlegt
  if (libOk && libPlan) {
    try { const vn = ['bark', 'fels', ...TREE_BARKS].filter((n) => libPlan.has(n)); if (vn.length) resolveLibraryMaterials((await lib.load({ names: vn, plan: libPlan })).sets); } catch (err) { console.warn('[world] Vegetation-Sätze', err); }
  }
  const veg = new Vegetation({ hf, spec: def.vegetation, quality, tier, blocked, bounds: pb, fields: def.terrain?.fields || [] });
  const vegCol = veg.colliders();
  await loadTreeAtlas(quality); // baeume: Zweig-Atlas vor dem Aufbau (Impostor-Aufnahme braucht ihn)
  group.add(veg.build(getMaterial, renderer?.isWebGLRenderer ? renderer : null));
  // Brandwald (21.10.): verkohltes Totholz – Kollision wie Bäume auf jeder Stufe gleich, Optik nah/fern je Stufe
  const dead = def.deadwood ? new Deadwood({ hf, spec: def.deadwood, quality, tier, blocked, bounds: pb }) : null;
  const deadCol = dead ? dead.colliders() : null;
  if (dead) group.add(dead.build(getMaterial));
  // Schwelende Glutnester (def.embers { count, seed }): aus einzelnen Stümpfen/liegenden Stämmen steigen dünne
  // Rauchfäden auf (Effekt-Partikel, nur in Kameranähe; nur Optik)
  const embers = [];
  const EMBER_SMOKE = { size: 1.2, life: 7, alpha: 0.62, color: [0.24, 0.235, 0.228] }; // linear ≈ #868480
  if (def.embers && dead) {
    let es = (def.embers.seed || 5) >>> 0;
    const er = () => ((es = (es * 1664525 + 1013904223) >>> 0) / 4294967296);
    const pool = [...dead.items.filter((it) => dead.protos[it.p].kind === 'stumpf' || dead.protos[it.p].kind === 'gebrochen'), ...dead.logs];
    for (let k = 0; k < (def.embers.count || 20) && pool.length; k++) {
      const it = pool.splice(Math.floor(er() * pool.length), 1)[0];
      if (it.x < pb.minX - 20 || it.x > pb.maxX + 20 || it.z < pb.minZ - 20 || it.z > pb.maxZ + 20) { k--; continue; }
      // kurze Stümpfe schwelen oben, hohe Stämme am Fuß (Wurzelstock), liegende Stämme auf der Oberseite
      const h = dead.items.includes(it) ? dead.protos[it.p].o.H * it.s : -1;
      const top = h < 0 ? 0.4 : h < 3.2 ? h : 0.15;
      embers.push({ v: new THREE.Vector3(it.x, it.y + top, it.z), t: er() * 2 });
    }
  }
  // Bodenstreu (Zweige, Äste, Rinde, Kohle, Steine) als Ring um die Kamera – nur Optik
  const litter = def.litter ? new Litter({ hf, spec: def.litter, quality }) : null; // auch in Gräben (Sohle)
  if (litter) group.add(litter.build(getMaterial));
  ms.vegetation = Math.round(performance.now() - tV);

  // 5) Kollision/Kugeln/Navigation im Worker
  const objects = [chunks.group];
  const colList = [], bulList = [], datList = [], albList = [];
  // Albedo je Kugel-Dreieck (Einschusskrater in Wandfarbe, world.albedoAt); Bewuchs/Totholz pauschal
  const albFill = (n, r, g, b) => { const a = new Uint8Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = g; a[i * 3 + 2] = b; } return a; };
  for (const s of sites) {
    const off = objects.length;
    for (const o of s.built.objects) objects.push(o);
    // Ursprungsindizes der Ortsdreiecke in den gemeinsamen BVHs (Kisten/Zaunfelder zerbrechen: world.breakables)
    s.colStart = colList.reduce((n, a) => n + a.length / 9, 0);
    s.bulStart = bulList.reduce((n, a) => n + a.length / 9, 0);
    colList.push(s.built.colTris);
    bulList.push(s.built.bulletTris);
    albList.push(s.built.bulletAlbedo || albFill(s.built.bulletTris.length / 9, 90, 90, 90));
    const d = new Uint32Array(s.built.bulletData.length);
    for (let i = 0; i < d.length; i++) { const v = s.built.bulletData[i]; d[i] = (v & 255) | (((v >>> 8) + off) << 8); }
    datList.push(d);
  }
  const vegObj = objects.push(veg.group) - 1;
  colList.push(vegCol.col);
  bulList.push(vegCol.bullet);
  const vd = new Uint32Array(vegCol.bullet.length / 9).fill(2 | (vegObj << 8)); // Holz/Fels: 'wood'
  datList.push(vd);
  albList.push(albFill(vd.length, 46, 36, 26));
  if (dead) {
    const deadObj = objects.push(dead.group) - 1;
    // Ursprungsindex des ersten Totholz-Dreiecks je BVH (Bäume fällen: treefall.js schaltet Stämme ab)
    dead.colStart = colList.reduce((n, a) => n + a.length / 9, 0);
    dead.bulStart = bulList.reduce((n, a) => n + a.length / 9, 0);
    colList.push(deadCol.col); bulList.push(deadCol.bullet);
    datList.push(new Uint32Array(deadCol.bullet.length / 9).fill(2 | (deadObj << 8)));
    albList.push(albFill(deadCol.bullet.length / 9, 16, 15, 14)); // verkohlt
  }
  const wallRect = { minX: pb.minX - (def.wallMargin ?? 45), maxX: pb.maxX + (def.wallMargin ?? 45), minZ: pb.minZ - (def.wallMargin ?? 45), maxZ: pb.maxZ + (def.wallMargin ?? 45) };
  // def.wallTop: Höhe der unsichtbaren Randwand (Flugplatz 12 m – Jets/Hubschrauber fliegen über den Kartenrand an und ab)
  colList.push(boundaryWalls(wallRect, -20, def.wallTop ?? 140));
  const colTris = concatF32(colList), bulletTris = concatF32(bulList);
  const bulletData = new Uint32Array(bulletTris.length / 9);
  { let o = 0; for (const d of datList) { bulletData.set(d, o); o += d.length; } }
  const bulletAlbedo = new Uint8Array(bulletData.length * 3);
  { let o = 0; for (const a of albList) { bulletAlbedo.set(a.subarray(0, Math.min(a.length, bulletAlbedo.length - o)), o); o += a.length; } }
  // weit2: Teil-Puffer der Ortschaften sind jetzt zusammengefügt – nicht über `sites` (dispose-Closure) festhalten
  for (const s of sites) s.built.colTris = s.built.bulletTris = s.built.bulletData = s.built.bulletAlbedo = null;
  colList.length = bulList.length = datList.length = albList.length = 0;

  // Punkte (Startpunkte, Flaggen, Fahrzeuge, Geheimnisse) auf den Boden setzen
  const pts = [];
  const addPt = (x, z, y) => { pts.push({ x, z, y: y ?? hf.heightAt(x, z) + 0.1 }); return pts.length - 1; };
  const sp = def.spawns || {};
  const spawnSrc = [];
  for (const team of ['A', 'B', 'ffa']) for (const s of sp[team] || []) spawnSrc.push({ team, s, i: addPt(s[0], s[1], s[3]) });
  const hqSrc = [];
  for (const team of ['A', 'B']) for (const s of sp.hq?.[team] || []) hqSrc.push({ team, s, i: addPt(s[0], s[1], s[3]) });
  const cqSrc = (def.flags?.cq || []).map(f => ({ f, i: addPt(f.x, f.z, f.y), sp: (f.spawns || []).map(s => addPt(s[0], s[1], s[3])) }));
  const domSrc = (def.flags?.dom || []).map(f => ({ f, i: addPt(f.x, f.z, f.y) }));
  // weit2: eigene Front-Punkte für den Trupp-Modus (def.flags.trupp → world.objectives.trupp, modes/trupp.js)
  const trSrc = (def.flags?.trupp || []).map(f => ({ f, i: addPt(f.x, f.z, f.y) }));
  const vehSrc = (def.vehicles || []).map(v => ({ v, i: addPt(v.x, v.z, v.y) }));
  const secSrc = (def.secrets || []).map(s => ({ s, i: addPt(s.x, s.z, s.y) }));
  const navSites = sites.filter(s => s.def.nav !== false).map(s => {
    const nb = s.def.navBounds || s.def.bounds, m = 4;
    return {
      id: s.def.id,
      bounds: { minX: nb.minX - m, maxX: nb.maxX + m, minZ: nb.minZ - m, maxZ: nb.maxZ + m, minY: (s.def.y ?? 0) - 4, maxY: (s.def.y ?? 0) + (s.def.height ?? 16) },
      points: s.b.navPoints.map(p => ({ x: p.x, y: p.y, z: p.z })),
      exclude: [...s.b.navExclude, { minX: -1e5, maxX: 1e5, minZ: -1e5, maxZ: 1e5, minY: -1e5, maxY: hf.waterY - 0.7 }],
      seeds: (s.def.seeds || [[(nb.minX + nb.maxX) / 2, (nb.minZ + nb.maxZ) / 2]]).map(q => ({ x: q[0], y: q[2] ?? (s.def.y ?? 0), z: q[1] })),
      spacing: s.def.spacing || 1.5,
    };
  });
  const seeds = [...spawnSrc, ...hqSrc].map(e => ({ x: e.s[0], z: e.s[1] })).concat(cqSrc.map(e => ({ x: e.f.x, z: e.f.z })));
  progress(0.7, 'Kollision');
  const tJ = performance.now();
  const jobP = runner.run('world', {
    job: {
      colTris, bulletTris, bulletData, terrainObject: 0, points: pts, sites: navSites, seeds, lines: def.navLines || [],
      grid: { bounds: { minX: pb.minX - 8, maxX: pb.maxX + 8, minZ: pb.minZ - 8, maxZ: pb.maxZ + 8 }, spacing: def.navGrid || 4, headroom: def.navHeadroom, exclude: navSites.map(s => ({ minX: s.bounds.minX + 3, maxX: s.bounds.maxX - 3, minZ: s.bounds.minZ + 3, maxZ: s.bounds.maxZ - 3 })) },
    },
  }, (stage) => progress({ Kollision: 0.74, 'Kugel-BVH': 0.77, Navigation: 0.8 }[stage] ?? 0.75, stage), hf);

  // Licht & Himmel parallel; Nebel nach Sichtweite der Stufe
  const tL = performance.now();
  const hdri = await hdriPromise;
  const fogFar = Math.min(tier.view, def.lighting.fog?.farCap ?? Infinity);
  const lightDef = { ...def.lighting, fog: { ...def.lighting.fog, near: fogFar * (def.lighting.fog?.nearFactor ?? 0.16), far: fogFar, baseY: def.lighting.fog?.baseY ?? hf.waterY }, shadow: { ...(def.lighting.shadow || {}), size: tier.shadow } };
  // atmosphere-weather: Höhennebel (Welt-Shading) + eine zwischengespeicherte Fernkaskade über die ganze Karte
  // (≈ 0,3 m/Texel; Häuser/Brücke/Felsen, ohne kamerabezogene Vegetation; low: keine Karte)
  // Prüfparameter ?lightfx=0 (wie Arenakarten): ohne Höhennebel/Fernkaskade/Staub – bisheriger Look für A/B
  const fxOn = G.params?.get?.('lightfx') !== '0';
  initShading(renderer);
  const light = createLighting(G, lightDef, group, {
    hdri, heightFog: fxOn && def.lighting.fog?.density != null,
    far: !fxOn || def.lighting.shadow?.far === false ? null : {
      bounds: { minX: pb.minX - 10, maxX: pb.maxX + 10, minZ: pb.minZ - 10, maxZ: pb.maxZ + 10, minY: Math.min(hf.waterY - 4, pb.minY ?? -8), maxY: def.lighting.shadow?.farMaxY ?? 60 },
      exclude: () => [veg.group, dead?.group, litter?.group, water.mesh || water].filter(Boolean),
      prepare: () => { for (const s of sites) s.built.props?.showAll(); },
    },
  });
  ms.light = Math.round(performance.now() - tL);
  for (const s of sites) group.add(s.built.group);
  G.scene.add(group);
  const postKeys = { exposure: def.lighting.exposure, bloomThreshold: def.lighting.bloom?.threshold, bloomStrength: def.lighting.bloom?.strength };
  const postSet = Object.fromEntries(Object.entries(postKeys).filter(([, v]) => Number.isFinite(v)));
  const prevPost = G.renderer?.post || {};
  const postRestore = Object.fromEntries(Object.keys(postSet).map(k => [k, prevPost[k]]).filter(([, v]) => Number.isFinite(v)));
  if (typeof G.renderer?.setPost === 'function') G.renderer.setPost(postSet);

  const job = await jobP;
  ms.job = Math.round(performance.now() - tJ);
  const usesWorker = runner.usesWorker;
  runner.dispose();
  const colBVH = TriangleBVH.fromData(job.col), bulBVH = TriangleBVH.fromData(job.bullet);
  const compCol = new CompositeBVH(hf, colBVH, { terrainObject: 0 });
  const compBul = new CompositeBVH(hf, bulBVH, { terrainObject: 0 });
  const collider = new TerrainCollider(hf, colBVH, compCol);
  progress(0.9, 'Navigation');
  const nav = bigNavFromData(job.nav, makeTests(compCol), { hf, col: colBVH });
  job.nav = null; job.col = job.bullet = null; // weit2: `job` hängt am Closure-Kontext der Welt (V) – Rohdaten nicht festhalten

  const V = (i, yOff = 0) => new THREE.Vector3(pts[i].x, job.snapped[i] + yOff, pts[i].z);
  const cx = (pb.minX + pb.maxX) / 2, cz = (pb.minZ + pb.maxZ) / 2;
  const yawTo = (x, z, tx = cx, tz = cz) => Math.atan2(-(tx - x), -(tz - z));
  // Startpunkte auf begehbare Fläche: liegt kein Nav-Knoten in 2,5 m, auf den nächsten Knoten setzen
  const onNav = (v) => {
    const n = nav.nearest(v);
    if (n && n.position.distanceTo(v) > 2.5) v.copy(n.position);
    return v;
  };
  /** count Startpunkte um pos (rMin…rMax) aus Nav-Knoten, möglichst weit verteilt, Blick zur Mitte. */
  const pickSpawns = (pos, count, rMin, rMax) => {
    const cand = nav.nodesInRadius(pos, rMax).filter(n => n.position.distanceTo(pos) >= rMin && Math.abs(n.position.y - pos.y) < 5 && n.links.length >= 3);
    const out = [];
    if (!cand.length) return out;
    out.push(cand[(cand.length * 0.5) | 0]);
    while (out.length < count && out.length < cand.length) {
      let best = null, bd = -1;
      for (const c of cand) { let d = Infinity; for (const o of out) d = Math.min(d, c.position.distanceToSquared(o.position)); if (d > bd) { bd = d; best = c; } }
      out.push(best);
    }
    return out.map(n => ({ position: n.position.clone(), yaw: yawTo(n.position.x, n.position.z, pos.x, pos.z) }));
  };
  const spawns = { A: [], B: [], ffa: [], hq: { A: [], B: [] } };
  for (const e of spawnSrc) spawns[e.team].push({ position: onNav(V(e.i)), yaw: e.s[2] ?? yawTo(e.s[0], e.s[1]) });
  for (const e of hqSrc) spawns.hq[e.team].push({ position: onNav(V(e.i)), yaw: e.s[2] ?? yawTo(e.s[0], e.s[1]) });
  const tSh = performance.now();
  const shield = shieldBigSpawns([[spawns.A, spawns.B], [spawns.hq.A, spawns.hq.B]], nav, compCol);
  ms.spawnShield = Math.round(performance.now() - tSh);
  const objectives = {
    dom: domSrc.map(e => ({ id: e.f.id, name: e.f.name, position: V(e.i), radius: e.f.radius ?? 9 })),
    cq: cqSrc.map(e => ({
      id: e.f.id, name: e.f.name, position: V(e.i), radius: e.f.radius ?? 22, heightBand: e.f.heightBand || [-3, 14],
      spawns: e.sp.length ? e.sp.map((i, k) => ({ position: onNav(V(i)), yaw: e.f.spawns[k][2] ?? yawTo(pts[i].x, pts[i].z) })) : pickSpawns(V(e.i), 8, 12, e.f.radius ? e.f.radius + 14 : 34),
    })),
  };
  if (trSrc.length) objectives.trupp = trSrc.map(e => ({ id: e.f.id, name: e.f.name, position: V(e.i), radius: e.f.radius ?? 18, heightBand: e.f.heightBand || [-3, 8], spawns: pickSpawns(V(e.i), 8, 10, (e.f.radius ?? 18) + 14) }));
  // Fahrzeug-Stellplätze: `type` = VEHICLES-Schlüssel des Fahrzeug-Agenten (tank → mbt); geheime Plätze (Traktor
  // „Gertrud“) nur in vehicleSpots, damit kein unbekannter Typ automatisch erscheint
  const VTYPE = { tank: 'mbt', jeep: 'jeep' };
  const vehicleSpots = vehSrc.map(e => ({ id: e.v.id, team: e.v.team ?? null, kind: e.v.kind, type: e.v.type || VTYPE[e.v.kind] || e.v.kind, name: e.v.name || null, position: V(e.i), yaw: e.v.yaw ?? 0, secret: !!e.v.secret }));
  const vehicleSpawns = vehicleSpots.filter(v => !v.secret);
  const secrets = secSrc.map(e => ({ id: e.s.id, name: e.s.name, hint: e.s.hint || '', position: V(e.i), trigger: e.s.trigger || { type: 'proximity', radius: 2 } }));

  progress(0.93, 'Minikarte');
  const tMM = performance.now();
  const minimap = createBigMinimap({ hf, bounds: pb, size: tier.mapPx, roads: roads.roads, footprints });
  ms.minimap = Math.round(performance.now() - tMM);
  const bounds = new THREE.Box3(new THREE.Vector3(pb.minX, pb.minY ?? -8, pb.minZ), new THREE.Vector3(pb.maxX, pb.maxY ?? 90, pb.maxZ));
  const hit = { t: 0, tri: 0, nx: 0, ny: 0, nz: 0, data: 0, back: false };
  const sitesVis = sites.map(s => {
    const r = s.def.bounds;
    return { group: s.built.group, x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2, rad: Math.hypot(r.maxX - r.minX, r.maxZ - r.minZ) / 2 + 20, props: s.built.props, objects: s.b.objects, res: s.res, imp: null, always: s.def.cull === false };
  });
  // riesen: Fernkulisse – je Ortschaft ein Klötzchen-Modell der Gebäude (ein Draw Call), sichtbar, sobald die volle
  // Ortschaft jenseits siteCull ausgeblendet ist (statt Leere am Horizont der Riesenkarte)
  if (def.giant) {
    for (let k = 0; k < sites.length; k++) {
      if (sites[k].def.cull === false) continue;
      const imp = siteImpostor(sites[k].b.footprints, sites[k].def.y ?? 0);
      if (!imp) continue;
      imp.name = 'fernkulisse:' + sites[k].def.id;
      imp.visible = false;
      group.add(imp);
      sitesVis[k].imp = imp;
    }
  }
  const found = new Set();
  const nOut = { x: 0, y: 1, z: 0 };
  const prevFar = G.camera?.far;

  const world = {
    embers, // Glutnester (Prüfseiten: Position der Rauchfäden)
    id, name: meta.name || def.name, meta, scale: 'gross',
    group, collider, collisionBVH: compCol, bounds, spawns, objectives, nav, minimap,
    lighting: light.lighting,
    /** Farbstimmung für core-render (`setMood(world.grade || mapId)`) + Wetter/Tageszeit (world/weather.js) */
    grade: def.grade ? { mood: id, ...def.grade } : undefined,
    weather: conditions,
    ambience: def.ambience || meta.ambience || 'range',
    climbMax: def.climbMax || 1.3, // Grabenkarten: Ausstieg per Klettern (27.10.)
    targets: [],
    terrain: { heightfield: hf, chunks, size: hf.size, waterY: hf.waterY, material: tmat.material, source: tmat.source },
    roads, vehicleSpawns, vehicleSpots, secrets, secretsAuto: true,
    runway: def.runway || null, // Startbahn (Flugplatz): Jets starten vom Boden statt per Luftstart (vehicles/air/aircraft.js)
    vegetation: veg, // Baumstandorte (vehicles/air: Stellplätze der Luftfahrzeuge frei von Kronen)
    civilVehicles: civilList(sites.flatMap((st) => st.b.civilSpots || [])), // fahrbare Zivilautos der Ortschaften
    emplacements: sites.flatMap((st) => st.b.emplacements || []), // benutzbare MG-Stellungen (game/mappoints.js)
    doors: sites.flatMap((st) => st.b.doors || []), gates: sites.flatMap((st) => st.b.gates || []), windows: sites.flatMap((st) => st.b.windows || []), // game/doors.js
    destructibles: sites.flatMap((st) => (st.b.destructibles || []).filter((d) => d.mesh)), // game/destruction.js
    breakables: mergeAccess(sites.map((st) => breakableAccess(st.b.breakables, { cbvh: colBVH, bvh: bulBVH, colOff: st.colStart || 0, bulOff: st.bulStart || 0 }))), // game/breakables.js
    viewDistance: tier.view,
    mapImage: minimap.canvas,
    stats: {
      totalMs: 0, ms, worker: job.ms, usesWorker, quality, spawnShield: shield,
      nav: nav.stats, roads: roads.stats, vegetation: veg.stats, deadwood: dead?.stats || null, litter: litter?.stats || null, terrain: chunks.stats, terrainSource: tmat.source,
      colliderTris: colTris.length / 9, bulletTris: bulletTris.length / 9,
      meshes: sites.reduce((n, s) => n + s.built.stats.meshes, 0), triangles: sites.reduce((n, s) => n + s.built.stats.triangles, 0),
      sites: sites.map(s => ({ id: s.def.id, meshes: s.built.stats.meshes, triangles: s.built.stats.triangles })),
      assets: lib.stats,
      giant: def.giant ? { view: tier.view, far: tier.far, siteCull: tier.siteCull, treeFar: tier.treeFar, platform: appClient().kind || 'web' } : null,
    },
    debugData: { colliderBVH: colBVH, bulletBVH: bulBVH, compositeCollider: compCol, compositeBullet: compBul, heightfield: hf, footprints, navPoints: sites.flatMap(s => s.b.navPoints), zones: [] },

    heightAt: (x, z) => hf.heightAt(x, z),
    normalAt: (x, z, out = new THREE.Vector3()) => { hf.normalAt(x, z, nOut); return out.set(nOut.x, nOut.y, nOut.z); },
    /** 'in' | 'warn' (bis 25 m außerhalb) | 'out' */
    inBounds(pos) {
      const d = Math.max(pb.minX - pos.x, pos.x - pb.maxX, pb.minZ - pos.z, pos.z - pb.maxZ);
      return d <= 0 ? 'in' : d <= 25 ? 'warn' : 'out';
    },

    raycast(origin, dir, maxDist = 1000) {
      let best = null;
      if (compBul.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxDist, hit)) {
        best = {
          distance: hit.t,
          point: new THREE.Vector3(origin.x + dir.x * hit.t, origin.y + dir.y * hit.t, origin.z + dir.z * hit.t),
          normal: new THREE.Vector3(hit.nx, hit.ny, hit.nz),
          surface: SURFACES[hit.data & 255] || 'grass',
          object: objects[hit.data >>> 8] || null,
          tri: hit.tri, back: !!hit.back,
        };
      }
      // Wasseroberfläche (Fluss): Kugeln enden mit Spritzer
      if (dir.y < -1e-4 && origin.y > hf.waterY) {
        const t = (hf.waterY - origin.y) / dir.y;
        if (t < (best ? best.distance : maxDist)) {
          const x = origin.x + dir.x * t, z = origin.z + dir.z * t;
          if (hf.contains(x, z) && hf.heightAt(x, z) < hf.waterY - 0.02) {
            best = { distance: t, point: new THREE.Vector3(x, hf.waterY, z), normal: new THREE.Vector3(0, 1, 0), surface: 'water', object: water.mesh };
          }
        }
      }
      return best;
    },
    /** Totholz (Brandwald) für treefall.js: { dw (Deadwood), disable(item) } oder null. */
    deadwood: dead ? {
      dw: dead,
      disable(it) {
        if (it.tri == null) return;
        colBVH.disableOrig(dead.colStart + it.tri, it.triN);
        bulBVH.disableOrig(dead.bulStart + it.tri, it.triN);
      },
    } : null,

    /** Albedo (linear 0..1) des Kugel-Dreiecks eines raycast-Treffers (hit.tri; Gelände −1 → null). */
    albedoAt(tri, out = [0, 0, 0]) {
      if (tri == null || tri < 0 || tri >= bulBVH.count) return null;
      const a = bulBVH.orig[tri] * 3;
      out[0] = bulletAlbedo[a] / 255; out[1] = bulletAlbedo[a + 1] / 255; out[2] = bulletAlbedo[a + 2] / 255;
      return out;
    },
    lineOfSight(a, b2) {
      const dx = b2.x - a.x, dy = b2.y - a.y, dz = b2.z - a.z, l = Math.hypot(dx, dy, dz);
      if (l < 1e-4) return true;
      return !compBul.occluded(a.x, a.y, a.z, dx / l, dy / l, dz / l, l - 0.02);
    },
    /**
     * Sicht für die Bot-Wahrnehmung (0..1): 0 bei fester Verdeckung, sonst gedämpft durch Wald zwischen a und b
     * (Laub hält keine Kugeln auf, verdeckt aber Sicht; je ~35 m Waldstrecke → 0).
     */
    visibility(a, b2) {
      if (!world.lineOfSight(a, b2)) return 0;
      let through = 0;
      for (const f of def.vegetation?.forests || []) {
        const ex = b2.x - a.x, ez = b2.z - a.z, L2 = ex * ex + ez * ez;
        if (L2 < 1e-6) break;
        const fx = a.x - f.x, fz = a.z - f.z, R = f.r * 0.85;
        const B = fx * ex + fz * ez, C = fx * fx + fz * fz - R * R, disc = B * B - L2 * C;
        if (disc <= 0) continue;
        const s = Math.sqrt(disc), t0 = Math.max(0, (-B - s) / L2), t1 = Math.min(1, (-B + s) / L2);
        if (t1 > t0) through += (t1 - t0) * Math.sqrt(L2) * (f.density ?? 0.7);
      }
      return Math.max(0, 1 - through / 35);
    },
    surfaceAt(p) {
      if (compBul.raycast(p.x, p.y + 0.3, p.z, 0, -1, 0, 2.5, hit)) return SURFACES[hit.data & 255] || 'grass';
      return SURFACES[hf.surfaceIndexAt(p.x, p.z)] || 'grass';
    },
    collisionRaycast(origin, dir, maxDist = 100) {
      if (!compCol.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxDist, hit)) return null;
      return { distance: hit.t, normal: new THREE.Vector3(hit.nx, hit.ny, hit.nz) };
    },
    groundHeight(x, z, yFrom = 30) {
      if (compCol.raycast(x, yFrom, z, 0, -1, 0, yFrom + 60, hit)) return yFrom - hit.t;
      const h = hf.contains(x, z) ? hf.heightAt(x, z) : null;
      return h !== null && h <= yFrom ? h : null;
    },

    update(dt, camera) {
      light.update(dt, camera);
      atmos?.update(dt, camera);
      foliageUniforms.uTime.value += dt; // nur Rückfall ohne Spielzeit (Dev-Seiten); im Spiel gilt die gemeinsame Uhr
      water.update(dt);
      if (!camera) return;
      if (camera.isPerspectiveCamera && camera.far < tier.view + 60) { camera.far = tier.view + 60; camera.updateProjectionMatrix(); }
      chunks.update(camera);
      veg.update(camera);
      dead?.update(camera);
      litter?.update(camera);
      if (embers.length && G.effects?.wisp) {
        for (const e of embers) {
          if ((e.t -= dt) > 0) continue;
          e.t = 0.28 + Math.random() * 0.3;
          if (e.v.distanceToSquared(camera.position) > 8100) continue;
          G.effects.smolder(e.v, EMBER_SMOKE);
        }
      }
      for (const s of sitesVis) {
        const vis = s.always || Math.hypot(camera.position.x - s.x, camera.position.z - s.z) - s.rad < tier.siteCull; // weit2: cull:false (Brücken) immer sichtbar
        if (s.group.visible !== vis) { s.group.visible = vis; if (s.imp) s.imp.visible = !vis; }
        if (!vis) continue;
        s.props?.update(camera);
        for (const ob of s.objects) ob.update?.(dt, camera);
        s.res.update?.(dt, camera);
      }
      // Geheimnisse (Nähe) – solange kein Modus sie selbst prüft (secretsAuto)
      const pl = G.player;
      if (world.secretsAuto && pl?.alive !== false && pl?.position) {
        for (const s of secrets) {
          if (found.has(s.id) || s.trigger.type !== 'proximity') continue;
          if (pl.position.distanceTo(s.position) <= (s.trigger.radius ?? 2)) { found.add(s.id); G.events?.emit?.('secret:found', { id: s.id, name: s.name, actor: pl, map: id }); }
        }
      }
    },
    setQuality(preset = {}) { light.setShadowQuality({ preset: { ...preset, shadowExtent: Math.min(preset.shadowExtent || Infinity, tier.shadow) } }); },
    dispose() {
      G.scene.remove(group);
      if (G.camera && Number.isFinite(prevFar) && G.camera.far !== prevFar) { G.camera.far = prevFar; G.camera.updateProjectionMatrix(); }
      for (const s of sites) {
        s.built.props?.dispose();
        s.built.group.traverse(o => {
          if (o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine) {
            if (o.userData.shared) return;
            o.geometry?.dispose();
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) if (m && m.userData?.disposable) m.dispose();
          }
        });
        const sm = s.built.signMesh?.material; if (sm) { sm.map?.dispose(); sm.dispose(); }
        s.built.group.traverse(o => { if (o.isMesh && o.name === 'signs-lit') o.material.dispose(); });
        for (const L of s.built.lights) L.dispose?.();
        s.res.dispose?.();
      }
      chunks.dispose(); farRing.geometry.dispose(); tmat.dispose();
      for (const s of sitesVis) if (s.imp) { s.imp.geometry.dispose(); s.imp.material.dispose(); }
      veg.dispose(); dead?.dispose(); litter?.dispose(); water.dispose();
      group.traverse(o => { if (o.name === 'roads-asphalt') { o.geometry.dispose(); o.material.dispose(); } });
      atmos?.dispose();
      world._sceneWatch?.stop(); world._unbindShading?.(); resetShading();
      light.dispose(); hdri?.dispose();
      offQuality?.();
      if (typeof G.renderer?.setPost === 'function') G.renderer.setPost(postRestore);
      collider.clear();
    },
  };
  const offQuality = typeof G.renderer?.onQualityChange === 'function' ? G.renderer.onQualityChange((q, preset) => world.setQuality(preset)) : null;
  for (const s of sites) s.res.attach?.(world, G);
  world.stats.texturesReleased = releaseUnusedTextures();
  world.stats.assets.released = await lib.releaseOthers(new Set([...libraryInUse(), ...tmat.libIds]), new Set(sites.flatMap(s => s.b.modelIdsUsed || [])));
  world.stats.assets.libMaterials = libraryStats.materials;
  world.stats.assets.fallbackMaterials = libraryStats.fallback;
  for (const s of sites) s.built.props?.showAll();
  // fuell (20.11.): Wand-Decals, Bodenauflage und Kleinmüll auch in den Ortschaften der Großkarten (medium+, nur Optik)
  if (quality !== 'low' && !def.giant && id !== 'weitmark') {
    try { const { fuelleGrosskarte } = await import('../fuellung.js?v=20261122020853'); world.stats.fuell = await fuelleGrosskarte(world, group, { quality, def: { ...def, id }, sites: (def.sites || []).map((s) => s.bounds) }); } catch (err) { console.warn('[world] Füllung', err); }
  }
  // erste Kamera-Stellung: Gelände-LOD + Vegetation am ersten Startpunkt vorbereiten
  const cam0 = new THREE.PerspectiveCamera(70, 1.7, 0.1, 900);
  const s0 = spawns.A[0] || spawns.ffa[0];
  if (s0) { cam0.position.copy(s0.position).add(new THREE.Vector3(0, 1.7, 0)); chunks.update(cam0, 64); veg.update(cam0, true); dead?.update(cam0, true); litter?.update(cam0, true); }
  // atmosphere-weather: Welt-Shading (Höhennebel, Fernschatten, spekulares AA; ohne Sonden-Gitter) + Staub/Strahlen
  applyCuts(group, quality); // Wanddurchbrüche (bullet-holes.js); Obergrenze je Stufe
  let atmos = null;
  if (fxOn) try {
    world.stats.lighting = { materials: applyWorldShading(group), far: null, atmos: null };
    world._unbindShading = bindShadingScene(G.scene);
    world._sceneWatch = watchScene(G.scene);
    setShadingMode({ probe: 0, specAA: def.lighting.specAA ?? 1 });
    light.setProbeSun(false);
    const farOk = light.bakeFar();
    if (light.farShadow) world.stats.lighting.far = { active: farOk, ...light.farShadow.stats };
    if (def.lighting.atmos) {
      atmos = createAtmosphere(G, { quality, def: def.lighting, sunDir: light.lighting.sunDirection, openings: sites.flatMap(s => s.b.openings || []), bvh: compBul, probes: null, sun: light.lighting.sun });
      group.add(atmos.group);
      world.stats.lighting.atmos = atmos.stats;
    }
  } catch (err) { console.warn('[world] Großkarte: Atmosphäre/Welt-Shading', err); }
  for (const s of sites) s.b.openings = [];
  progress(0.97, 'Texturen hochladen');
  world.stats.uploadMs = await uploadTextures(renderer, group);
  world.stats.totalMs = Math.round(performance.now() - t0);
  if (debug) console.info(`[world] ${id}: Großkarte in ${world.stats.totalMs} ms (Gelände ${ms.terrain} ms, Ortschaften ${ms.sites} ms, Worker ${ms.job} ms), Nav ${nav.stats.nodes} Knoten (${nav.stats.fine} fein/${nav.stats.coarse} Gelände), ${veg.stats.trees} Bäume, Kollision ${world.stats.colliderTris} Dreiecke`);
  progress(1, 'Bereit');
  return world;
}
