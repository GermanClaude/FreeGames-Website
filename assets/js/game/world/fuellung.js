// NULLPUNKT — fuell (20.11.): Füllschicht für alle Karten (Owner: world). Nutzer: „Die Maps sehen irgendwie immer noch
// relativ leer aus … so ungefüllt.“ Nach dem Weltaufbau (wie bodenauflage.js/decals.js, nur medium+, low lädt das Modul
// nicht) streut diese Schicht per Strahltest gegen die Kugel-BVH Kleinteile, die echte Orte voll wirken lassen:
//   · Laubverwehungen in Ecken und an Wandfüßen, einzelne Blätter auf freier Fläche
//   · Kies/Splitt-Nester, Ziegel- und Putzbrocken (Kriegskarten mehr), Holzlatten/Splitter, Glasscherben
//   · Patronenhülsen-Nester an Deckungen (Kriegskarten)
//   · Gras/Unkraut in Fugen und an Wandfüßen, kleine Büsche in Außenecken (Foto-Laubatlas aus atlas.js)
// Alles reine Optik: keine Kollision, keine Kugel-BVH, keine Minikarte – Navigation, Deckung, Mehrspieler unberührt.
// Je Art EIN InstancedMesh für die ganze Karte (≈ 8–10 Draw Calls), kein Schattenwurf; Teile schrumpfen ab einer
// Entfernung im Vertex-Shader auf null (LOD ohne CPU). Eigene Materialien ohne Textur (Farbe je Instanz) → keine
// zusätzlichen Sampler in Welt-/Geländeshadern. Gesät über die Kartenkennung (jedes Laden gleich).
// Großkarten (terrain/bigworld.js): fuelleGrosskarte() setzt zusätzlich Wand-Decals und Bodenauflage, aber nur in den
// Ortschaften (opt.bereiche).
//
// placeFuellung(world, group, { quality, seed, def, bereiche }) → { cluster, teile, gruen, meshes, ms }
import * as THREE from 'three';
import { createFoliage } from './atlas.js?v=20261115041504';
import { streuRaster, bodenY, placeGroundDressing } from './bodenauflage.js?v=20261115041504';

/** Mengenfaktor je Stufe (low: Modul wird nicht geladen). */
const MENGE = { medium: 0.5, high: 1, ultra: 1.4 };
/** Höchstzahl Nester je Stufe (bei ≈ 12 000 m² Spielfläche; Großkarten nach Fläche der Bereiche). */
const NESTER = { medium: 600, high: 1300, ultra: 1900 };
/** Ausblenden (m): [Beginn, Ende] je Stufe; kleine Teile (Hülsen, Kies) früher. */
const FADE = { medium: [22, 30], high: [32, 44], ultra: [42, 58] };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const seedOf = (id) => [...String(id || 'karte')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 17);

// ---------------------------------------------------------------------------
// Arten: Geometrie (Unterkante y = 0), Farben, Rauheit/Metall, Größe, Ausblendfaktor
// ---------------------------------------------------------------------------
function blattGeo() {
  // leicht gewölbtes Blatt (0,08 × 0,06 m), 4 Dreiecke
  const g = new THREE.BufferGeometry();
  const P = [-0.04, 0.004, 0, 0, 0.012, -0.03, 0, 0.002, 0, 0, 0.012, -0.03, 0.04, 0.006, 0, 0, 0.002, 0,
    -0.04, 0.004, 0, 0, 0.002, 0, 0, 0.01, 0.03, 0, 0.002, 0, 0.04, 0.006, 0, 0, 0.01, 0.03];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}
function scherbeGeo() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.03, 0.003, 0.02, 0.035, 0.003, 0.015, 0.0, 0.003, -0.035, 0.035, 0.003, 0.015, 0.05, 0.003, -0.02, 0.0, 0.003, -0.035], 3));
  g.computeVertexNormals();
  return g;
}
const ARTEN = {
  laub: { geo: blattGeo, cols: ['#8a5a2a', '#a8742e', '#6e4a22', '#b08a3a', '#7a6a30', '#5a4a26', '#9a5e2e'], r: 0.85, m: 0, side: THREE.DoubleSide, s: [0.8, 1.5], fade: 1 },
  kiesel: { geo: () => new THREE.OctahedronGeometry(0.022, 0).scale(1.2, 0.55, 1).translate(0, 0.01, 0), cols: ['#8a8680', '#a29c92', '#6e6a64', '#9a8e7e', '#7a746a'], r: 0.9, m: 0, s: [0.6, 1.8], fade: 0.7 },
  ziegel: { geo: () => new THREE.BoxGeometry(0.1, 0.05, 0.07).translate(0, 0.025, 0), cols: ['#9a4a32', '#a85a3c', '#8a3e2a', '#b0684a', '#7a3a28'], r: 0.92, m: 0, s: [0.5, 1.4], fade: 1 },
  putz: { geo: () => new THREE.IcosahedronGeometry(0.035, 0).scale(1.3, 0.5, 1).translate(0, 0.012, 0), cols: ['#cfc8ba', '#bdb6a6', '#d8d2c6', '#a8a294'], r: 0.95, m: 0, s: [0.5, 1.6], fade: 0.8 },
  holz: { geo: () => new THREE.BoxGeometry(0.62, 0.018, 0.085).translate(0, 0.009, 0), cols: ['#7a6248', '#5e4a36', '#8a7052', '#4a3a2a', '#6a5a46'], r: 0.9, m: 0, s: [0.5, 1.3], fade: 1.1 },
  glas: { geo: scherbeGeo, cols: ['#c8d4d0', '#b0c0bc', '#a8b8b0'], r: 0.06, m: 0, side: THREE.DoubleSide, s: [0.6, 1.4], fade: 0.7, opacity: 0.75 },
  huelse: { geo: () => new THREE.CylinderGeometry(0.0055, 0.006, 0.045, 6, 1, true).rotateZ(Math.PI / 2).translate(0, 0.006, 0), cols: ['#b8903a', '#a8822e', '#c8a048', '#8a6a2a'], r: 0.32, m: 0.95, s: [0.9, 1.1], fade: 0.5 },
  zweig: { geo: () => new THREE.CylinderGeometry(0.006, 0.01, 0.42, 4, 1, true).rotateZ(Math.PI / 2).translate(0, 0.008, 0), cols: ['#4a3a2a', '#5a4632', '#3a2e22', '#6a5640'], r: 0.95, m: 0, s: [0.6, 1.5], fade: 1 },
};
/** Nester je Kartenstil: Gewichte der Arten außen (Wandfuß/Ecke/frei) und innen, Grün (Büschel), Büsche, Krieg. */
const STIL = {
  hafen:        { laub: 0.4, kiesel: 1.3, ziegel: 0.15, putz: 0.1, holz: 0.7, glas: 0.25, huelse: 0.05, zweig: 0.2, gruen: 0.8, busch: 0.25 },
  werk:         { laub: 0.6, kiesel: 1.4, ziegel: 0.6, putz: 0.4, holz: 0.7, glas: 0.6, huelse: 0.15, zweig: 0.3, gruen: 1.1, busch: 0.45 },
  altstadt:     { laub: 1.3, kiesel: 0.6, ziegel: 0.35, putz: 0.4, holz: 0.25, glas: 0.15, huelse: 0.1, zweig: 0.3, gruen: 1.0, busch: 0.55 },
  bibliothek:   { laub: 0.05, kiesel: 0.1, ziegel: 0, putz: 0.5, holz: 0.35, glas: 0.05, huelse: 0, zweig: 0, gruen: 0, busch: 0 },
  stadtkern:    { laub: 1.0, kiesel: 0.8, ziegel: 1.5, putz: 1.1, holz: 0.8, glas: 1.2, huelse: 0.9, zweig: 0.3, gruen: 0.9, busch: 0.4 },
  range:        { laub: 0.9, kiesel: 1.0, ziegel: 0, putz: 0.05, holz: 0.3, glas: 0, huelse: 1.6, zweig: 0.5, gruen: 1.3, busch: 0.6 },
  grenzland:    { laub: 1.1, kiesel: 0.9, ziegel: 0.45, putz: 0.3, holz: 0.6, glas: 0.25, huelse: 0.45, zweig: 0.8, gruen: 1.2, busch: 0.7 },
  niemandsland: { laub: 0.2, kiesel: 1.0, ziegel: 1.3, putz: 0.6, holz: 1.3, glas: 0.2, huelse: 1.2, zweig: 0.9, gruen: 0.25, busch: 0.05 },
  brandwald:    { laub: 0.1, kiesel: 0.7, ziegel: 0.3, putz: 0.2, holz: 1.0, glas: 0.4, huelse: 0.9, zweig: 1.1, gruen: 0.2, busch: 0 },
  flugplatz:    { laub: 0.6, kiesel: 1.1, ziegel: 0.2, putz: 0.2, holz: 0.4, glas: 0.25, huelse: 0.35, zweig: 0.4, gruen: 1.1, busch: 0.45 },
  default:      { laub: 0.8, kiesel: 1, ziegel: 0.4, putz: 0.3, holz: 0.5, glas: 0.3, huelse: 0.3, zweig: 0.4, gruen: 1, busch: 0.4 },
};
/** Innenräume: nur Bauschutt, Putz, Holz, Scherben (kein Laub/Grün). */
const INNEN = ['putz', 'holz', 'glas', 'ziegel', 'kiesel'];

function material(art, A, quality, f) {
  const m = new THREE.MeshStandardMaterial({ roughness: A.r, metalness: A.m, side: A.side || THREE.FrontSide, transparent: !!A.opacity, opacity: A.opacity ?? 1, depthWrite: !A.opacity });
  m.name = 'fuell-' + art; m.userData.disposable = true; m.userData.surface = 'concrete';
  const [f0, f1] = [f[0] * A.fade, f[1] * A.fade];
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      { vec3 npIp = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; transformed *= 1.0 - smoothstep(${f0.toFixed(1)}, ${f1.toFixed(1)}, distance(npIp, cameraPosition)); }
      #endif`);
  };
  m.customProgramCacheKey = () => `np-fuell-${art}-${f0.toFixed(1)}`;
  return m;
}

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _e = new THREE.Euler(), _col = new THREE.Color();

/** Waagerechter Boden unter (x, z) knapp unter yMax: { y, surface } | null. */
function bodenAt(world, x, z, yMax) {
  _o.set(x, yMax, z); _d.set(0, -1, 0);
  const h = world.raycast(_o, _d, 1.2);
  if (!h || h.normal.y < 0.94) return null;
  return { y: h.point.y, surface: h.surface };
}
/** Entfernung zur nächsten senkrechten Fläche in Richtung (dx, dz) auf Höhe y (oder Infinity). */
function wandIn(world, x, y, z, dx, dz, L) {
  _o.set(x, y, z); _d.set(dx, 0, dz);
  const h = world.raycast(_o, _d, L);
  return h && Math.abs(h.normal.y) < 0.2 ? h.distance : Infinity;
}

/**
 * Streut Nester (Kleinteile) und Grün. o.bereiche: nur dort (Großkarten); o.stil: Gewichte statt STIL[def.id].
 */
export function placeFuellung(world, group, { quality = 'high', seed, def = {}, bereiche = null, stil = null } = {}) {
  const t0 = performance.now();
  const k = MENGE[quality] || 0;
  if (!k || !world?.raycast || !world.bounds || def.fuellung === false) return { cluster: 0, teile: 0, gruen: 0, meshes: 0, ms: 0 };
  const opt = def.fuellung || {};
  const W = { ...(STIL[def.id] || STIL.default), ...(stil || {}), ...(opt.stil || {}) };
  const r = rng((seed ?? seedOf(def.id)) ^ 0x7f4a7c15);
  const { cells, flaeche } = streuRaster(world, bereiche || opt.bereiche, opt.step ?? 2.0, r);
  const cap = Math.round((NESTER[quality] || 0) * flaeche * (opt.menge ?? 1));
  const per = Object.fromEntries(Object.keys(ARTEN).map((a) => [a, []]));
  const plants = [];
  const frei = [...['A', 'B', 'ffa'].flatMap((t) => (world.spawns?.[t] || []).map((s) => s.position)), ...(world.objectives?.dom || []).map((o) => o.position)];
  const nahStart = (x, z, rr) => frei.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < rr * rr);
  const wahl = (keys) => {
    let sum = 0; for (const a of keys) sum += W[a] || 0;
    if (sum <= 0) return null;
    let q = r() * sum; for (const a of keys) { q -= W[a] || 0; if (q <= 0) return a; }
    return keys[keys.length - 1];
  };
  const AUSSEN = ['laub', 'kiesel', 'ziegel', 'putz', 'holz', 'glas', 'huelse', 'zweig'];
  let cluster = 0, teile = 0;
  /** Nest um (x, gy, z): n Teile der Art im Radius rad, je Teil Bodenprobe (kein Schweben auf Kanten/Kisten). */
  const nest = (art, x, gy, z, n, rad, wx = 0, wz = 0) => {
    const A = ARTEN[art];
    let m = 0;
    for (let i = 0; i < n; i++) {
      // an der Wand (wx, wz = Richtung zur Wand) dichter: Verteilung zur Wand hin gestaucht
      let u = (r() - 0.5) * 2 * rad, v = (r() - 0.5) * 2 * rad;
      if (wx || wz) { const t = r() * r() * rad; u = (r() - 0.5) * 2.4 * rad; const px = x + wx * (rad * 0.5 - t) - wz * u, pz = z + wz * (rad * 0.5 - t) + wx * u; u = px - x; v = pz - z; }
      const px = x + u, pz = z + v;
      const g = bodenAt(world, px, pz, gy + 0.25);
      if (!g || Math.abs(g.y - gy) > 0.035 || g.surface === 'water') continue;
      const s = A.s[0] + r() * (A.s[1] - A.s[0]);
      per[art].push({ x: px, y: g.y, z: pz, a: r() * Math.PI * 2, s, tilt: (r() - 0.5) * (art === 'laub' || art === 'glas' ? 0.5 : 0.2), c: A.cols[Math.floor(r() * A.cols.length)] });
      m++;
    }
    return m;
  };
  for (const [x0, z0] of cells) {
    if (cluster >= cap) break;
    const gy0 = bodenY(world, x0, z0);
    if (gy0 == null) continue;
    let g = bodenAt(world, x0, z0, gy0 + 0.3);
    if (!g || Math.abs(g.y - gy0) > 0.05 || g.surface === 'water') continue;
    let x = x0, z = z0;
    const gy = g.y;
    _o.set(x, gy + 0.3, z); _d.set(0, 1, 0);
    const innen = !!world.raycast(_o, _d, 30);
    // 60 %: zum nächsten Wandfuß rücken
    let wand = null, ecke = false;
    if (r() < 0.6) {
      const a = r() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      const d = wandIn(world, x, gy + 0.15, z, dx, dz, 5);
      if (d < Infinity && d > 0.3) {
        const nx = x + dx * (d - 0.35), nz = z + dz * (d - 0.35);
        const g2 = bodenAt(world, nx, nz, gy + 0.3);
        if (g2 && Math.abs(g2.y - gy) < 0.035) {
          x = nx; z = nz; wand = [dx, dz];
          // Ecke? senkrecht zur Wand in beiden Richtungen
          const l = wandIn(world, x, gy + 0.15, z, -dz, dx, 1.0), rr = wandIn(world, x, gy + 0.15, z, dz, -dx, 1.0);
          ecke = l < Infinity || rr < Infinity;
        }
      }
    }
    if (!wand && r() < 0.55) continue; // freie Fläche: seltener
    cluster++;
    if (innen) {
      const art = wahl(INNEN);
      if (art) teile += nest(art, x, gy, z, 4 + Math.floor(r() * 10), wand ? 0.5 : 0.7, ...(wand || [0, 0]));
      continue;
    }
    // außen: Grün an Wandfuß/Ecke (Fugen), sonst Nester
    if (wand && W.gruen && r() < 0.32 * W.gruen) {
      // Busch in Ecken (nicht an Startpunkten/Flaggen; ganze Ecke Wand bis 1,6 m Höhe – keine Türlaibung)
      if (ecke && W.busch && r() < W.busch * 0.55 && !nahStart(x, z, 5)) {
        const ok = wandIn(world, x, gy + 1.6, z, wand[0], wand[1], 0.8) < Infinity
          && wandIn(world, x - wand[1] * 0.9, gy + 0.9, z + wand[0] * 0.9, wand[0], wand[1], 0.8) < Infinity
          && wandIn(world, x + wand[1] * 0.9, gy + 0.9, z - wand[0] * 0.9, wand[0], wand[1], 0.8) < Infinity;
        if (ok) { plants.push({ kind: 'bush', x: x + wand[0] * 0.1, y: gy - 0.03, z: z + wand[1] * 0.1, s: 0.42 + r() * 0.3, ry: r() * 6.283 }); continue; }
      }
      const n = 2 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const u = (r() - 0.5) * 2.2, off = r() * 0.25;
        const px = x + wand[0] * (0.25 - off) - wand[1] * u, pz = z + wand[1] * (0.25 - off) + wand[0] * u;
        const g2 = bodenAt(world, px, pz, gy + 0.3);
        if (!g2 || Math.abs(g2.y - gy) > 0.04) continue;
        plants.push({ kind: r() < 0.55 ? 'weeds' : 'grass', x: px, y: g2.y - 0.02, z: pz, s: 0.3 + r() * 0.42, ry: r() * 6.283, tint: ['#b9b98a', '#a3ab7a', '#9aa070', '#c0b888'][Math.floor(r() * 4)] });
      }
      continue;
    }
    const art = wahl(AUSSEN);
    if (!art) continue;
    const viel = art === 'laub' ? (ecke ? 26 : wand ? 14 : 5) : art === 'kiesel' ? 10 : art === 'huelse' ? 4 + Math.floor(r() * 12) : art === 'holz' ? 1 + Math.floor(r() * 3) : 3 + Math.floor(r() * 6);
    teile += nest(art, x, gy, z, Math.round(viel * (0.6 + r() * 0.8)), art === 'laub' && ecke ? 0.55 : wand ? 0.45 : 0.6, ...(wand || [0, 0]));
  }
  // Meshes: je Art eines für die ganze Karte
  const f = FADE[quality] || FADE.high;
  let meshes = 0;
  for (const [art, list] of Object.entries(per)) {
    if (!list.length) continue;
    const A = ARTEN[art];
    const mesh = new THREE.InstancedMesh(A.geo(), material(art, A, quality, f), list.length);
    list.forEach((it, i) => {
      _q.setFromEuler(_e.set(it.tilt, it.a, it.tilt * 0.6, 'YXZ'));
      _m.compose(_p.set(it.x, it.y + 0.001, it.z), _q, _s.setScalar(it.s));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _col.set(it.c));
    });
    mesh.computeBoundingSphere();
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    mesh.name = 'fuellung';
    group.add(mesh);
    meshes++;
  }
  if (plants.length) {
    const fl = createFoliage(plants, quality);
    for (const m of fl.meshes) { m.name = 'fuellung-gruen'; m.castShadow = m.castShadow && quality === 'ultra'; group.add(m); meshes++; }
  }
  return { cluster, teile, gruen: plants.length, meshes, ms: Math.round(performance.now() - t0) };
}

/**
 * Großkarten: Wand-Decals + Bodenauflage/Kleinmüll + Füllschicht in den Ortschaften (sites: [{minX,maxX,minZ,maxZ}]).
 */
export async function fuelleGrosskarte(world, group, { quality = 'high', def = {}, sites = [] } = {}) {
  const t0 = performance.now();
  const seed = seedOf(def.id);
  const bereiche = sites.filter(Boolean).map((q) => ({ minX: q.minX, maxX: q.maxX, minZ: q.minZ, maxZ: q.maxZ }));
  if (!bereiche.length) return null;
  const out = {};
  if (def.lookDecals !== false) {
    try { out.decals = (await import('./decals.js?v=20261115041504')).placeLookDecals(world, group, { quality, seed, def: { ...def, lookDecals: { ...(def.lookDecals || {}), bereiche } } }).count; } catch (err) { console.warn('[world] Decals (Großkarte)', err); }
  }
  if (def.groundDressing !== false) {
    try { const g = placeGroundDressing(world, group, { quality, seed, def: { ...def, groundDressing: { ...(def.groundDressing || {}), bereiche } } }); out.boden = g.count; out.muell = g.litter; } catch (err) { console.warn('[world] Bodenauflage (Großkarte)', err); }
  }
  try { out.fuell = placeFuellung(world, group, { quality, seed, def, bereiche }); } catch (err) { console.warn('[world] Füllung (Großkarte)', err); }
  out.ms = Math.round(performance.now() - t0);
  return out;
}
