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
const NESTER = { medium: 800, high: 1800, ultra: 2600 };
/** Ausblenden (m): [Beginn, Ende] je Stufe; kleine Teile (Hülsen, Kies) früher. */
const FADE = { medium: [22, 30], high: [32, 44], ultra: [42, 58] };
/** Höchstzahl Fassaden-Kabelläufe je Stufe. */
const FASSADE = { medium: 40, high: 90, ultra: 130 };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function merge(list, farbe = false) {
  const P = [], N = [], C = [];
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); if (farbe) C.push(...g.attributes.color.array); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  if (farbe) g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return g;
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
  putz: { geo: () => new THREE.OctahedronGeometry(0.035, 0).scale(1.3, 0.5, 1).translate(0, 0.012, 0), cols: ['#cfc8ba', '#bdb6a6', '#d8d2c6', '#a8a294'], r: 0.95, m: 0, s: [0.5, 1.6], fade: 0.8 },
  holz: { geo: () => new THREE.BoxGeometry(0.62, 0.018, 0.085).translate(0, 0.009, 0), cols: ['#7a6248', '#5e4a36', '#8a7052', '#4a3a2a', '#6a5a46'], r: 0.9, m: 0, s: [0.5, 1.3], fade: 1.1 },
  glas: { geo: scherbeGeo, cols: ['#c8d4d0', '#b0c0bc', '#a8b8b0'], r: 0.06, m: 0, side: THREE.DoubleSide, s: [0.6, 1.4], fade: 0.7, opacity: 0.75 },
  huelse: { geo: () => new THREE.CylinderGeometry(0.0055, 0.006, 0.045, 6, 1, true).rotateZ(Math.PI / 2).translate(0, 0.006, 0), cols: ['#b8903a', '#a8822e', '#c8a048', '#8a6a2a'], r: 0.32, m: 0.95, s: [0.9, 1.1], fade: 0.5 },
  buch: { geo: () => new THREE.BoxGeometry(0.16, 0.035, 0.23).translate(0, 0.0175, 0), cols: ['#5a2a22', '#2a3a5a', '#3a4a2a', '#6a4a2a', '#4a2a3a', '#7a6a4a', '#2a2a2a'], r: 0.8, m: 0, s: [0.8, 1.4], fade: 1.1 },
  papier: { geo: () => { const g = new THREE.PlaneGeometry(0.21, 0.297, 2, 2).rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, 0.003 + Math.abs(Math.sin(i * 1.7)) * 0.01); g.computeVertexNormals(); return g; }, cols: ['#ece6d6', '#e0d8c2', '#d8ceb4', '#f0ebe0'], r: 0.92, m: 0, side: THREE.DoubleSide, s: [0.8, 1.2], fade: 1 },
  // fuell: flache, mittelgroße Teile (≤ 0,45 m hoch, an Wandfüßen – man steigt darüber, keine Kollision nötig)
  palette: { geo: () => { const g = []; for (const z of [-0.33, 0, 0.33]) g.push(new THREE.BoxGeometry(1.2, 0.1, 0.1).translate(0, 0.05, z)); for (let i = 0; i < 5; i++) g.push(new THREE.BoxGeometry(0.1, 0.022, 0.8).translate(-0.54 + i * 0.27, 0.111, 0)); return merge(g); }, cols: ['#a08866', '#8a7456', '#b09a76', '#7a6a50'], r: 0.9, m: 0, s: [0.95, 1.05], fade: 1.6 },
  reifen: { geo: () => new THREE.TorusGeometry(0.29, 0.1, 5, 12).rotateX(Math.PI / 2).translate(0, 0.1, 0), cols: ['#1c1c1c', '#232322', '#2a2826'], r: 0.85, m: 0, s: [0.85, 1.15], fade: 1.6 },
  plane: { geo: () => { const g = new THREE.PlaneGeometry(1.6, 1.1, 4, 3).rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, 0.01 + Math.abs(Math.sin(i * 2.3) * Math.cos(i * 0.7)) * 0.09); g.computeVertexNormals(); return g; }, cols: ['#3a5a7a', '#4a5a3a', '#6a6a62', '#2a4a6a', '#7a5a3a'], r: 0.75, m: 0, side: THREE.DoubleSide, s: [0.8, 1.3], fade: 1.6 },
  kanister: { geo: () => new THREE.BoxGeometry(0.34, 0.46, 0.17).translate(0, 0.23, 0), cols: ['#4a5a3a', '#8a2a22', '#2a3a2a', '#b0902a'], r: 0.55, m: 0.2, s: [0.95, 1.05], fade: 1.3 },
  // Bücherstapel (5–7 Bände, je Band eigene Helligkeit als Vertexfarbe × Instanzfarbe)
  buchstapel: { geo: () => { const L = []; let y = 0; for (let i = 0; i < 6; i++) { const h = 0.03 + (i % 3) * 0.012, w = 0.17 + ((i * 7) % 5) * 0.012, d = 0.23 + ((i * 3) % 4) * 0.015; const g = new THREE.BoxGeometry(w, h, d).rotateY((((i * 5) % 7) - 3) * 0.06).translate(((i * 3) % 5 - 2) * 0.008, y + h / 2, 0); const c = [0.55, 1.0, 0.7, 1.25, 0.8, 1.1][i]; g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(c), 3)); L.push(g); y += h; } return merge(L, true); }, cols: ['#6a3a2a', '#3a4a6a', '#4a5a3a', '#7a5a3a', '#5a3a4a', '#6a6050'], r: 0.8, m: 0, s: [0.9, 1.3], fade: 1.4, vc: true },
  zweig: { geo: () => new THREE.CylinderGeometry(0.006, 0.01, 0.42, 4, 1, true).rotateZ(Math.PI / 2).translate(0, 0.008, 0), cols: ['#4a3a2a', '#5a4632', '#3a2e22', '#6a5640'], r: 0.95, m: 0, s: [0.6, 1.5], fade: 1 },
};
/** Nester je Kartenstil: Gewichte der Arten außen (Wandfuß/Ecke/frei) und innen, Grün (Büschel), Büsche, Krieg. */
const STIL = {
  hafen:        { laub: 0.4, kiesel: 1.3, ziegel: 0.15, putz: 0.1, holz: 0.7, glas: 0.25, huelse: 0.05, zweig: 0.2, gruen: 0.8, busch: 0.25, fassade: 0.7, palette: 0.5, reifen: 0.25, plane: 0.3, kanister: 0.3, risse: 0.45 },
  werk:         { laub: 0.6, kiesel: 1.4, ziegel: 0.6, putz: 0.4, holz: 0.7, glas: 0.6, huelse: 0.15, zweig: 0.3, gruen: 1.1, busch: 0.45, fassade: 1.0, palette: 0.45, reifen: 0.35, plane: 0.25, kanister: 0.3, risse: 1.0 },
  altstadt:     { laub: 1.3, kiesel: 0.6, ziegel: 0.35, putz: 0.4, holz: 0.25, glas: 0.15, huelse: 0.1, zweig: 0.3, gruen: 1.0, busch: 0.55, fassade: 1.3, palette: 0.15, reifen: 0.05, plane: 0.1, kanister: 0.1, risse: 0.35 },
  bibliothek:   { menge: 0.55, dach: 0, laub: 0.05, kiesel: 0.1, ziegel: 0, putz: 0.5, holz: 0.35, glas: 0.05, huelse: 0, zweig: 0, gruen: 0, busch: 0, fassade: 0, palette: 0, reifen: 0, plane: 0, kanister: 0, risse: 0 },
  stadtkern:    { laub: 1.0, kiesel: 0.8, ziegel: 1.5, putz: 1.1, holz: 0.8, glas: 1.2, huelse: 0.9, zweig: 0.3, gruen: 0.9, busch: 0.4, fassade: 1.2, palette: 0.3, reifen: 0.25, plane: 0.3, kanister: 0.2, risse: 0.8 },
  range:        { laub: 0.9, kiesel: 1.0, ziegel: 0, putz: 0.05, holz: 0.3, glas: 0, huelse: 1.6, zweig: 0.5, gruen: 1.3, busch: 0.6, fassade: 0.6, palette: 0.25, reifen: 0.3, plane: 0.15, kanister: 0.3, risse: 0.7 },
  grenzland:    { laub: 1.1, kiesel: 0.9, ziegel: 0.45, putz: 0.3, holz: 0.6, glas: 0.25, huelse: 0.45, zweig: 0.8, gruen: 1.2, busch: 0.7, fassade: 1.0, palette: 0.3, reifen: 0.2, plane: 0.2, kanister: 0.2, risse: 0.5 },
  niemandsland: { laub: 0.2, kiesel: 1.0, ziegel: 1.3, putz: 0.6, holz: 1.3, glas: 0.2, huelse: 1.2, zweig: 0.9, gruen: 0.25, busch: 0.05, fassade: 0.25, palette: 0.25, reifen: 0.1, plane: 0.3, kanister: 0.35, risse: 0.15 },
  brandwald:    { laub: 0.1, kiesel: 0.7, ziegel: 0.3, putz: 0.2, holz: 1.0, glas: 0.4, huelse: 0.9, zweig: 1.1, gruen: 0.2, busch: 0, fassade: 0.2, palette: 0.15, reifen: 0.1, plane: 0.2, kanister: 0.3, risse: 0 },
  flugplatz:    { laub: 0.6, kiesel: 1.1, ziegel: 0.2, putz: 0.2, holz: 0.4, glas: 0.25, huelse: 0.35, zweig: 0.4, gruen: 1.1, busch: 0.45, fassade: 0.9, palette: 0.35, reifen: 0.3, plane: 0.25, kanister: 0.35, risse: 0.8 },
  default:      { laub: 0.8, kiesel: 1, ziegel: 0.4, putz: 0.3, holz: 0.5, glas: 0.3, huelse: 0.3, zweig: 0.4, gruen: 1, busch: 0.4, fassade: 1, palette: 0.3, reifen: 0.2, plane: 0.2, kanister: 0.2, risse: 0.5 },
};
/** Innenräume: nur Bauschutt, Putz, Holz, Scherben (kein Laub/Grün). */
const INNEN = ['putz', 'holz', 'glas', 'ziegel', 'kiesel', 'papier', 'buch'];
/** Innen-Gewichte (Papier/Bücher) je Karte; Rest wie außen. */
const INNEN_W = { bibliothek: { papier: 1.3, buch: 1.6, buchstapel: 0.4 }, stadtkern: { papier: 0.6, buch: 0.15, buchstapel: 0.03 }, default: { papier: 0.5, buch: 0.08 } };

function material(art, A, quality, f) {
  const m = new THREE.MeshStandardMaterial({ roughness: A.r, metalness: A.m, side: A.side || THREE.FrontSide, transparent: !!A.opacity, opacity: A.opacity ?? 1, depthWrite: !A.opacity, vertexColors: !!A.vc });
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
  const W = { ...(STIL[def.id] || STIL.default), ...(INNEN_W[def.id] || INNEN_W.default), ...(stil || {}), ...(opt.stil || {}) };
  const r = rng((seed ?? seedOf(def.id)) ^ 0x7f4a7c15);
  const { cells, flaeche } = streuRaster(world, bereiche || opt.bereiche, opt.step ?? 2.0, r);
  // kleine Karten: nach Spielfläche (Bezug 12 000 m²), Großkarten: nach Fläche der Bereiche (streuRaster)
  const cap = Math.round((NESTER[quality] || 0) * flaeche * (W.menge ?? 1) * (opt.menge ?? 1));
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
  const AUSSEN = ['laub', 'kiesel', 'ziegel', 'putz', 'holz', 'glas', 'huelse', 'zweig'], AN_WAND = ['palette', 'reifen', 'plane', 'kanister'];
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
  // Flachdächer (begehbare Dachflächen > 2,5 m über dem Boden, waagerecht, offen): jede dritte Zelle prüft zuerst das Dach
  const dachY = (x, z) => {
    if (W.dach === 0) return null;
    const base = world.heightAt ? world.heightAt(x, z) : 0;
    _o.set(x, base + 40, z); _d.set(0, -1, 0);
    const h = world.raycast(_o, _d, 45);
    if (!h || h.normal.y < 0.97 || h.point.y - base < 2.5 || h.surface === 'water' || h.surface === 'glass' || h.surface === 'metal' || h.surface === 'wood') return null;
    return h.point.y;
  };
  let zelle = 0;
  for (const [x0, z0] of cells) {
    if (cluster >= cap) break;
    const gy0 = (zelle++ % 3 === 0 ? dachY(x0, z0) : null) ?? bodenY(world, x0, z0);
    if (gy0 == null) continue;
    let g = bodenAt(world, x0, z0, gy0 + 0.3);
    if (!g || Math.abs(g.y - gy0) > 0.05 || g.surface === 'water') continue;
    let x = x0, z = z0;
    const gy = g.y;
    _o.set(x, gy + 0.3, z); _d.set(0, 1, 0);
    const innen = !!world.raycast(_o, _d, 30);
    // 60 %: zum nächsten Wandfuß rücken
    let wand = null, ecke = false;
    if (r() < 0.75) {
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
    if (innen && !wand && r() < 0.5) continue; // Raummitte (Laufwege) noch seltener
    cluster++;
    if (innen) {
      // Bibliothek u. ä.: Bücherstapel an Regalen/Wänden
      if (wand && W.buchstapel && r() < W.buchstapel) {
        const n2 = 1 + Math.floor(r() * 3), ry = Math.atan2(wand[0], wand[1]);
        for (let i = 0; i < n2; i++) {
          const u = (i - (n2 - 1) / 2) * 0.32, px = x + wand[0] * 0.12 - wand[1] * u, pz = z + wand[1] * 0.12 + wand[0] * u, g3 = bodenAt(world, px, pz, gy + 0.3);
          if (!g3 || Math.abs(g3.y - gy) > 0.03) continue;
          per.buchstapel.push({ x: px, y: g3.y, z: pz, a: ry + (r() - 0.5) * 0.6, s: 0.9 + r() * 0.4, tilt: 0, c: ARTEN.buchstapel.cols[Math.floor(r() * 6)] }); teile++;
        }
        continue;
      }
      const art = wahl(INNEN);
      if (art) teile += nest(art, x, gy, z, art === 'buch' ? 1 + Math.floor(r() * 4) : art === 'papier' ? 2 + Math.floor(r() * 5) : 4 + Math.floor(r() * 10), wand ? 0.5 : 0.7, ...(wand || [0, 0]));
      continue;
    }
    // außen: Grün an Wandfuß/Ecke (Fugen), sonst Nester
    if (wand && W.gruen && r() < 0.5 * W.gruen) {
      // Busch in Ecken (nicht an Startpunkten/Flaggen; ganze Ecke Wand bis 1,6 m Höhe – keine Türlaibung)
      if (ecke && W.busch && r() < W.busch * 0.55 && !nahStart(x, z, 5)) {
        const ok = wandIn(world, x, gy + 1.6, z, wand[0], wand[1], 0.8) < Infinity
          && wandIn(world, x - wand[1] * 0.9, gy + 0.9, z + wand[0] * 0.9, wand[0], wand[1], 0.8) < Infinity
          && wandIn(world, x + wand[1] * 0.9, gy + 0.9, z - wand[0] * 0.9, wand[0], wand[1], 0.8) < Infinity;
        if (ok) { plants.push({ kind: 'bush', x: x + wand[0] * 0.1, y: gy - 0.03, z: z + wand[1] * 0.1, s: 0.42 + r() * 0.3, ry: r() * 6.283 }); continue; }
      }
      const n = 4 + Math.floor(r() * 7);
      for (let i = 0; i < n; i++) {
        const u = (r() - 0.5) * 3.6, off = r() * 0.3;
        const px = x + wand[0] * (0.25 - off) - wand[1] * u, pz = z + wand[1] * (0.25 - off) + wand[0] * u;
        const g2 = bodenAt(world, px, pz, gy + 0.3);
        if (!g2 || Math.abs(g2.y - gy) > 0.04) continue;
        plants.push({ kind: r() < 0.55 ? 'weeds' : 'grass', x: px, y: g2.y - 0.02, z: pz, s: (0.3 + r() * 0.5) * (1 - off), ry: r() * 6.283, tint: ['#b9b98a', '#a3ab7a', '#9aa070', '#c0b888', '#8f9a62'][Math.floor(r() * 5)] });
      }
      continue;
    }
    // Unkraut in Belagsrissen auf freier Fläche (verlassene Höfe/Straßen), klein – verdeckt nichts
    if (!wand && W.risse && r() < 0.35 * W.risse) {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const px = x + (r() - 0.5) * 0.7, pz = z + (r() - 0.5) * 0.7, g2 = bodenAt(world, px, pz, gy + 0.3);
        if (g2 && Math.abs(g2.y - gy) < 0.03) plants.push({ kind: r() < 0.7 ? 'weeds' : 'grass', x: px, y: g2.y - 0.02, z: pz, s: 0.18 + r() * 0.2, ry: r() * 6.283, tint: ['#a8b07c', '#9aa070', '#b4b088'][Math.floor(r() * 3)] });
      }
      continue;
    }
    // mittelgroße flache Teile nur direkt an der Wand (nicht in Laufwegen, nicht an Startpunkten)
    if (wand && r() < 0.3 && !nahStart(x, z, 4)) {
      const art2 = wahl(AN_WAND);
      if (art2) {
        const A = ARTEN[art2], ry = Math.atan2(wand[0], wand[1]) + (r() - 0.5) * 0.5, off = art2 === 'palette' ? 0.1 : 0;
        const px = x + wand[0] * off, pz = z + wand[1] * off;
        // Platz: Boden eben unter dem ganzen Teil (4 Ecken)
        let ok = true;
        for (const [u, v] of [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]]) { const g3 = bodenAt(world, px + u * Math.cos(ry) + v * Math.sin(ry), pz - u * Math.sin(ry) + v * Math.cos(ry), gy + 0.3); if (!g3 || Math.abs(g3.y - gy) > 0.03) { ok = false; break; } }
        if (ok) {
          const n2 = art2 === 'reifen' ? 1 + Math.floor(r() * 3) : art2 === 'kanister' ? 1 + Math.floor(r() * 3) : 1;
          const stapel = art2 === 'reifen';
          for (let i = 0; i < n2; i++) per[art2].push({ x: px - (stapel ? 0 : wand[1] * i * 0.45) + (stapel ? (r() - 0.5) * 0.08 : 0), y: gy + (stapel ? i * 0.2 : 0), z: pz + (stapel ? (r() - 0.5) * 0.08 : wand[0] * i * 0.45), a: ry + (stapel ? r() * 6.28 : 0), s: A.s[0] + r() * (A.s[1] - A.s[0]), tilt: art2 === 'plane' ? 0 : (r() - 0.5) * 0.04, c: A.cols[Math.floor(r() * A.cols.length)] });
          teile += n2;
          continue;
        }
      }
    }
    const art = wahl(AUSSEN);
    if (!art) continue;
    const viel = art === 'laub' ? (ecke ? 26 : wand ? 14 : 5) : art === 'kiesel' ? 10 : art === 'huelse' ? 4 + Math.floor(r() * 12) : art === 'holz' ? 1 + Math.floor(r() * 3) : 3 + Math.floor(r() * 6);
    teile += nest(art, x, gy, z, Math.round(viel * (0.6 + r() * 0.8)), art === 'laub' && ecke ? 0.55 : wand ? 0.45 : 0.6, ...(wand || [0, 0]));
  }
  // Fassaden: Aufputzkabel mit Schellen, Abzweig nach unten in einen Verteilerkasten, Wandleuchten-Konsolen
  const fass = W.fassade ?? 1;
  const fassCap = Math.round((FASSADE[quality] || 0) * flaeche * fass * (opt.menge ?? 1));
  const teileF = [];
  let laeufe = 0;
  if (fassCap > 0) {
    const seen = new Set();
    const rF = rng((seed ?? seedOf(def.id)) ^ 0x1b873593);
    const { cells: fc } = streuRaster(world, bereiche || opt.bereiche, 3.2, rF);
    for (const [x, z] of fc) {
      if (laeufe >= fassCap) break;
      const gy = bodenY(world, x, z);
      if (gy == null) continue;
      _o.set(x, gy + 0.3, z); _d.set(0, 1, 0);
      if (world.raycast(_o, _d, 30)) continue; // nur außen
      const a = rF() * Math.PI * 2;
      _o.set(x, gy + 1.2, z); _d.set(Math.cos(a), 0, Math.sin(a));
      const h = world.raycast(_o, _d, 7);
      if (!h || Math.abs(h.normal.y) > 0.1 || h.distance < 0.8 || h.surface === 'glass' || h.surface === 'metal' || h.surface === 'wood') continue;
      const name = (h.object?.material?.name || h.object?.name || '');
      if (/container|corr|fence|tarp|glass|sandbag|crate|vehicle|car|wreck|bark|rock/i.test(name)) continue;
      const nx0 = h.normal.x, nz0 = h.normal.z, nl = Math.hypot(nx0, nz0);
      let nx = nx0 / nl, nz = nz0 / nl;
      if (nx * _d.x + nz * _d.z > 0) { nx = -nx; nz = -nz; }
      const tx = -nz, tz = nx;
      const key = `${Math.round(h.point.x / 6)}|${Math.round(h.point.z / 6)}`;
      if (seen.has(key)) continue;
      const hc = gy + 2.6 + rF() * 1.5;
      const wandDa = (s, y) => { _o.set(h.point.x + nx * 0.3 + tx * s, y, h.point.z + nz * 0.3 + tz * s); _d.set(-nx, 0, -nz); const c = world.raycast(_o, _d, 0.5); return !!c && Math.abs(c.distance - 0.3) < 0.06 && Math.abs(c.normal.x * nx + c.normal.z * nz) > 0.95 && c.surface !== 'glass'; };
      if (!wandDa(0, hc)) continue;
      let s0 = 0, s1 = 0;
      while (s1 < 7 && wandDa(s1 + 0.5, hc)) s1 += 0.5;
      while (s0 > -7 && wandDa(s0 - 0.5, hc)) s0 -= 0.5;
      const L = s1 - s0;
      if (L < 2.5) continue;
      seen.add(key);
      laeufe++;
      const px = h.point.x + nx * 0.025, pz = h.point.z + nz * 0.025;
      const at = (s, y, w, hh, dd, c, off = 0) => teileF.push({ x: px + tx * s + nx * off, y, z: pz + tz * s + nz * off, ry: Math.atan2(-tz, tx), w, h: hh, d: dd, c });
      const kab = ['#2a2a2a', '#3a3834', '#d8d4ca', '#4a4a48'][Math.floor(rF() * 4)];
      at((s0 + s1) / 2, hc, L - 0.2, 0.022, 0.022, kab);
      for (let s = s0 + 0.3; s < s1 - 0.2; s += 0.75) at(s, hc - 0.012, 0.03, 0.046, 0.034, '#5a5a58');
      if (rF() < 0.35) at((s0 + s1) / 2, hc - 0.12, L - 0.6, 0.016, 0.016, kab);
      // Abzweig nach unten in einen Kasten (Wand muss dort sein, keine Öffnung)
      if (rF() < 0.45) {
        const sd = s0 + 0.4 + rF() * (L - 0.8), yb = gy + 1.35 + rF() * 0.4;
        if (wandDa(sd, yb) && wandDa(sd, yb + 0.45) && wandDa(sd, (yb + hc) / 2)) {
          at(sd, yb + 0.42, 0.024, hc - yb - 0.42, 0.024, kab);
          at(sd, yb, 0.32 + rF() * 0.12, 0.42, 0.12, ['#b8b6ae', '#8a8e88', '#c8c2b0', '#6a7066'][Math.floor(rF() * 4)], 0.05);
        }
      }
      // Wandleuchte (Konsole + Schirm) über Kopfhöhe
      if (rF() < 0.3) {
        const sl = s0 + 0.5 + rF() * (L - 1), yl = hc + 0.35;
        if (wandDa(sl, yl)) { at(sl, yl, 0.05, 0.05, 0.42, '#2e2e2c', 0.2); at(sl, yl - 0.1, 0.24, 0.1, 0.24, '#3a3a36', 0.42); }
      }
    }
  }
  // Meshes: je Art eines für die ganze Karte
  const f = FADE[quality] || FADE.high;
  let meshes = 0;
  if (teileF.length) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), material('fassade', { r: 0.7, m: 0.1, fade: 2.6 }, quality, f), teileF.length);
    teileF.forEach((it, i) => {
      _q.setFromAxisAngle(_s.set(0, 1, 0), it.ry);
      _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.w, it.h, it.d));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _col.set(it.c));
    });
    mesh.computeBoundingSphere();
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    mesh.name = 'fuellung-fassade';
    group.add(mesh);
    meshes++;
  }
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
