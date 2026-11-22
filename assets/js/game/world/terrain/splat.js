// NULLPUNKT — Gelände-Material: Splat aus 5 Schichten (Gras, Erde, Kies, Fels, Acker/Schlamm) über eine
// RGBA-Kontrollkarte, Fotoscan-Sätze aus assets/lib (KTX2) mit prozeduralem Rückfall (engine/textures.js),
// Gegen-Kachelung (zwei Abtastungen mit Helligkeits-Überblendung + Makro-Rauschen + UV-Verzerrung), Wiesenfarbe
// (saftig ↔ trocken/strohig, feucht am Ufer), unregelmäßige Wegränder, Geröll an Hängen, Nässe am Ufer,
// Detailnormalen (low: nur nah) (Owner: world).
//
// gl-ground: Rauschen kommt aus EINER kleinen Textur (tNoise: RG = Detailnormale, BA = zwei kachelbare,
// histogrammentzerrte fBm-Felder) statt aus sin-Hash-Rauschen im Shader – gleiche Samplerzahl wie vorher (ersetzt
// die Detailkarte), weniger Rechenarbeit, weichere Formen. Dieselben Felder liest die CPU (terrainNoise /
// meadowTintAt) für die Grashalme (vegetation.js): Halme tragen die Wiesenfarbe des Bodens an ihrer Stelle, ferne
// Halme gehen nahtlos in den Boden über.
import * as THREE from 'three';
import { LIB_MATERIALS } from '../library.js?v=20261122020853';
import { getDetailNormalTexture } from '../../engine/textures.js?v=20261122020853';

/** Schichten: Bibliotheks-ID, prozeduraler Ersatz, Kachelgröße (m), Rauheit, Normalen-Rang (−1 = keine; 3 nur mit
 * Hex-Kachelung, high/ultra), cal: Kalibrierung der Fotoscan-Albedo (linear, je Kanal; Ø-Helligkeit wie die früheren
 * Sätze, Farbton halb angeglichen), nStr: Relief-Stärke.
 * texturen3 (14.11.): neue Poly-Haven-Scans (CC0) – Wiesenboden mit Streu (forrest_ground_01), Waldweg-Erde mit
 * Steinchen (forest_ground_04), Kiesboden mit Feldsteinen (rocks_ground_01), Felswand (rock_face_03); die Albedo trägt
 * die Höhe im Alpha (Höhen-Überblendung). Schlamm bleibt brown_mud_02. */
export const TERRAIN_LAYERS = [
  { key: 'grass', lib: 'ground_meadow', proc: 'grass', size: 3.2, rough: 0.96, normal: 0, cal: [0.53, 0.67, 0.43], nStr: 0.75 },
  { key: 'dirt', lib: 'ground_forest', proc: 'dirt', size: 3.5, rough: 0.93, normal: 1, cal: [0.99, 0.98, 0.95], nStr: 1.0 },
  { key: 'gravel', lib: 'ground_stones', proc: 'gravel', size: 2.6, rough: 0.88, normal: 3, cal: [0.8, 0.82, 0.85], nStr: 1.05 },
  { key: 'rock', lib: 'rock_face', proc: 'concrete_dark', size: 4.5, rough: 0.86, normal: 2, cal: [1.25, 1.35, 1.5], nStr: 1.2 },
  { key: 'mud', lib: 'mud', proc: 'dirt', size: 3.2, rough: 0.8, normal: -1, nStr: 0.8 },
];

// ---------------------------------------------------------------------------
// Rauschtextur (geteilt, einmal je Sitzung erzeugt; ≈ 256 KB GPU)
// ---------------------------------------------------------------------------
const NS = 256;
let noiseData = null, noiseTex = null;

/** Kachelbare Wertrauschen-fBm (4 Oktaven: 4…32 Perioden je Kachel), anschließend histogrammentzerrt → 0..1 gleichverteilt. */
function fbmField(seed) {
  const S = NS;
  const hash = (i, j, s) => { let n = Math.imul(i & (S - 1), 374761393) + Math.imul(j & (S - 1), 668265263) + Math.imul(s, 2246822519); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const vnoise = (x, y, f, s) => {
    const fx = x * f / S, fy = y * f / S, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const g = (a, b) => hash(((a % f) + f) % f * (S / f), ((b % f) + f) % f * (S / f), s);
    return (g(i, j) * (1 - sx) + g(i + 1, j) * sx) * (1 - sy) + (g(i, j + 1) * (1 - sx) + g(i + 1, j + 1) * sx) * sy;
  };
  const v = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    v[y * S + x] = vnoise(x, y, 4, seed) * 0.5 + vnoise(x, y, 8, seed + 1) * 0.26 + vnoise(x, y, 16, seed + 2) * 0.15 + vnoise(x, y, 32, seed + 3) * 0.09;
  }
  // Rang → 0..1 (Schwellen im Shader werden so zu Flächenanteilen: smoothstep(0.7, …) ≈ 30 % der Fläche)
  const idx = new Uint32Array(S * S);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  idx.sort((a, b) => v[a] - v[b]);
  const out = new Float32Array(S * S), inv = 1 / (idx.length - 1);
  for (let r = 0; r < idx.length; r++) out[idx[r]] = r * inv;
  return out;
}

function ensureNoise() {
  if (noiseData) return noiseData;
  const S = NS, data = new Uint8Array(S * S * 4);
  const b = fbmField(31), a = fbmField(57);
  const det = getDetailNormalTexture(), dd = det?.image?.data, dw = det?.image?.width || 0, dh = det?.image?.height || 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const o = (y * S + x) * 4;
    if (dd && dw && dh) { const s = ((y * dh / S | 0) * dw + (x * dw / S | 0)) * 4; data[o] = dd[s]; data[o + 1] = dd[s + 1]; }
    else { data[o] = 128; data[o + 1] = 128; }
    data[o + 2] = Math.round(b[y * S + x] * 255); data[o + 3] = Math.round(a[y * S + x] * 255);
  }
  noiseData = data;
  return data;
}

/** aniso: anisotrope Filterung (low 1 – jede Zusatzabtastung kostet auf schwachen GPUs/Software-Renderern). */
function noiseTexture(aniso = 4) {
  if (noiseTex) {
    if (noiseTex.anisotropy !== aniso) { noiseTex.anisotropy = aniso; noiseTex.needsUpdate = true; }
    return noiseTex;
  }
  const t = new THREE.DataTexture(ensureNoise(), NS, NS, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = aniso;
  t.name = 'terrain:noise';
  t.needsUpdate = true;
  noiseTex = t;
  return t;
}

/** Bilineare Abtastung eines Kanals (2 = B, 3 = A) wie texture() mit Wiederholung (u, v in Kacheln). */
function sampleNoise(ch, u, v) {
  const d = noiseData || ensureNoise(), S = NS;
  const fx = u * S - 0.5, fy = v * S - 0.5, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
  const i0 = ((i % S) + S) % S, j0 = ((j % S) + S) % S, i1 = (i0 + 1) % S, j1 = (j0 + 1) % S;
  const g = (a, b2) => d[(b2 * S + a) * 4 + ch];
  return ((g(i0, j0) * (1 - tx) + g(i1, j0) * tx) * (1 - ty) + (g(i0, j1) * (1 - tx) + g(i1, j1) * tx) * ty) / 255;
}

// Drei Maßstäbe, gegeneinander gedreht/versetzt (GLSL terrN1–3 rechnet exakt dasselbe):
//   1: Makro (Kachel 173 m → Formen 43…5 m), 2: Mitte (37 m → 9…1 m), 3: Flecken (6,1 m → 1,5…0,2 m)
/**
 * Gelände-Rauschen an (x, z) für Maßstab k (1–3) → [B, A] (je 0..1, gleichverteilt). out wird zurückgegeben.
 * @param {number} x @param {number} z @param {1|2|3} k @param {number[]} [out]
 */
export function terrainNoise(x, z, k, out = [0, 0]) {
  let u, v;
  if (k === 1) { u = (0.8 * x - 0.6 * z) / 173; v = (0.6 * x + 0.8 * z) / 173; }
  else if (k === 2) { u = (0.28 * x + 0.96 * z) / 37 + 0.37; v = (-0.96 * x + 0.28 * z) / 37 + 0.11; }
  else { u = x / 6.1 + 0.71; v = z / 6.1 + 0.53; }
  out[0] = sampleNoise(2, u, v); out[1] = sampleNoise(3, u, v);
  return out;
}

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _n1 = [0, 0], _n2 = [0, 0];

/**
 * Wiesenfarbe (Faktor auf die Gras-Albedo) wie im Gelände-Shader (terrMeadowTint + Uferfeuchte): großräumig saftig ↔
 * trocken/strohig, feucht-dunkelgrün und dunkler am Ufer, Helligkeit großräumig. y = Bodenhöhe, dryBias: zusätzliche Trockenheit
 * (Hangneigung), n2: schon abgetastetes terrainNoise(x, z, 2) (spart zwei Abfragen). → out [r, g, b]
 */
export function meadowTintAt(x, z, y, dryBias = 0, out = [1, 1, 1], n2 = null) {
  terrainNoise(x, z, 1, _n1);
  if (n2) { _n2[0] = n2[0]; _n2[1] = n2[1]; } else terrainNoise(x, z, 2, _n2);
  const hw = y - terrainLook.waterY;
  const moist = 1 - sstep(0.5, 3.4, hw + (_n2[0] - 0.5) * 1.8);
  const dry = sstep(0.5, 0.82, _n1[0] * 0.6 + _n2[0] * 0.4 + dryBias) * (1 - moist);
  // Helligkeit großräumig × feuchter Uferstreifen (Gelände-Shader: alb *= mix(1, 0.84, damp) nach der Wiesenfarbe)
  const damp = 1 - sstep(0.5, 2.6, hw + (_n2[1] - 0.5) * 0.8);
  const br = (0.86 + 0.28 * _n1[1]) * (1 - 0.16 * damp);
  for (let c = 0; c < 3; c++) {
    let t = MEADOW_LUSH[c] + (MEADOW_DRY[c] - MEADOW_LUSH[c]) * dry;
    t += (MEADOW_WET[c] - t) * moist * 0.75;
    out[c] = t * br;
  }
  return out;
}
const MEADOW_LUSH = [0.93, 1.0, 0.86], MEADOW_DRY = [1.2, 1.06, 0.66], MEADOW_WET = [0.8, 0.93, 0.74];
const v3 = (a) => `vec3(${a.map(n => n.toFixed(3)).join(', ')})`;

/** GLSL: Rauschabtastung + Wiesenfarbe (braucht uniform sampler2D tNoise). Gleiche Formeln wie terrainNoise/meadowTintAt. */
export const TERRAIN_NOISE_GLSL = `
  vec2 terrN1(vec2 p) { return texture2D(tNoise, vec2(0.8 * p.x - 0.6 * p.y, 0.6 * p.x + 0.8 * p.y) * (1.0 / 173.0)).ba; }
  vec2 terrN2(vec2 p) { return texture2D(tNoise, vec2(0.28 * p.x + 0.96 * p.y, -0.96 * p.x + 0.28 * p.y) * (1.0 / 37.0) + vec2(0.37, 0.11)).ba; }
  vec2 terrN3(vec2 p) { return texture2D(tNoise, p * (1.0 / 6.1) + vec2(0.71, 0.53)).ba; }
  vec3 terrMeadowTint(vec2 n1, vec2 n2, float hw, float dryBias) {
    float moist = 1.0 - smoothstep(0.5, 3.4, hw + (n2.x - 0.5) * 1.8);
    float dry = smoothstep(0.5, 0.82, n1.x * 0.6 + n2.x * 0.4 + dryBias) * (1.0 - moist);
    vec3 t = mix(${v3(MEADOW_LUSH)}, ${v3(MEADOW_DRY)}, dry);
    t = mix(t, ${v3(MEADOW_WET)}, moist * 0.75);
    return t * (0.86 + 0.28 * n1.y);
  }
`;

/**
 * Geteilter Zustand für die Grashalme (vegetation.js): Gras-Albedo (Uniform-Objekt, Mittelwert per textureLod),
 * Kalibrierung, Wasserhöhe. ready = false ohne Gelände-Material (dann feste Grundfarbe).
 */
export const terrainLook = { ready: false, waterY: 0, grassMap: { value: null }, grassCal: { value: 1 } };

function ctrlTexture(hf) {
  const t = new THREE.DataTexture(hf.splat, hf.n, hf.n, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.flipY = false;
  t.needsUpdate = true;
  t.name = 'terrain:ctrl';
  return t;
}

/**
 * @param {{ hf, quality: string, lib?: { load: Function }|null, libOk: boolean, getMaterial: Function, tier?: number }} o
 * @returns {Promise<{ material: THREE.MeshStandardMaterial, uniforms: object, libIds: string[], source: string, dispose(): void }>}
 */
export async function createTerrainMaterial(o) {
  const { hf, quality } = o;
  const low = quality === 'low';
  const useNormals = !low;
  // Kartenlook (def.terrainLook, Brandwald 21.10.): Schichten je Karte durch eigene prozedurale Sätze ersetzen
  // ({ layers: { grass: 'brandboden', … }, sizes: { grass: 3.4 }, meadow: false, rockTint: [r, g, b] }) – ersetzte
  // Schichten nehmen keinen Fotoscan aus der Bibliothek; ohne Wiesenfarbe (meadow: false) bleibt die Grundschicht neutral
  const look = o.look || null;
  // tex4 (15.11.): hat der Ersatzsatz eine Bibliothekszuordnung (LIB_MATERIALS, z. B. brandboden → Fotoscan), lädt die
  // Schicht diesen Scan (Kalibrierung aus der Zuordnung), sonst wie bisher prozedural
  const LAYERS = TERRAIN_LAYERS.map(l => {
    const name = look?.layers?.[l.key];
    if (!name) return l;
    const lm = LIB_MATERIALS[name];
    return { ...l, lib: lm?.id || null, cal: lm?.color, proc: name, size: look.sizes?.[l.key] ?? l.size };
  });
  const meadow = look?.meadow !== false;
  const rockTint = look?.rockTint || [0.62, 0.6, 0.56];
  // Texturen: Bibliothek (KTX2) oder prozedural
  const maps = new Array(TERRAIN_LAYERS.length).fill(null), normals = new Array(TERRAIN_LAYERS.length).fill(null);
  const sizes = LAYERS.map(l => l.size);
  // env-look: Kalibrierung der Fotoscan-Albedos wie bei den Karten-Materialien (LIB_MATERIALS.color; Kies war ×1 → weiß)
  const cal = TERRAIN_LAYERS.map(() => [1, 1, 1]);
  // texturen3: Normalen-Kodierung je Schicht (0 = RGB wie three, 1 = RGB ungespiegelt → Y negiert, 2 = XY in RGB+Alpha)
  // und Höhe im Albedo-Alpha (1 = ja; sonst gilt 0,5)
  const nMode = TERRAIN_LAYERS.map(() => 0), hasH = TERRAIN_LAYERS.map(() => 0);
  let grassAvg = null;
  let source = 'prozedural';
  const libIds = [];
  // texturen3: Hex-Kachelung (drei gedrehte Abtastungen, Höhen-Überblendung) ab high – ersetzt dort UV-Verzerrung und
  // Zweifach-Abtastung („verwirbeltes“ Gras in der Nähe)
  // Hotfix 19.11.: Hex braucht eine 4. Normalen-Karte → das Boden-Programm kam auf 17 Texturen; viele echte Grafikkarten
  // erlauben nur 16 je Shader (Programm wird verworfen → Boden unsichtbar). Hex nur, wenn die Karte mehr als 16 kann.
  const maxTex = Number.isFinite(o.maxTex) ? o.maxTex : 16;
  const hex = (quality === 'high' || quality === 'ultra') && maxTex > 16;
  if (o.libOk && o.lib) {
    const plan = new Map(LAYERS.filter(l => l.lib).map(l => ['gelaende:' + l.key, { id: l.lib, tier: o.tier || 1024 }]));
    try {
      const r = plan.size ? await o.lib.load({ names: [...plan.keys()], plan, models: [] }) : { sets: new Map() };
      LAYERS.forEach((l, k) => {
        const set = r.sets.get('gelaende:' + l.key);
        if (!set) return;
        maps[k] = set.map; normals[k] = set.normalMap;
        const c = l.cal ?? LIB_MATERIALS[l.key]?.color ?? LIB_MATERIALS[l.lib]?.color;
        if (typeof c === 'number') cal[k] = [c, c, c]; else if (Array.isArray(c)) cal[k] = c.slice(0, 3);
        nMode[k] = set.normalXY ? 2 : set.unflipped ? 1 : 0;
        hasH[k] = set.meta?.heightAlpha && set.tier >= 1024 ? 1 : 0; // 512 ohne Alpha (low: kein Mehrgewicht)
        if (k === 0 && set.meta?.stats?.avgColor) grassAvg = new THREE.Color(set.meta.stats.avgColor);
        // sizeM ist [Breite, Höhe] in m; Gelände etwas gröber kacheln (weniger Wiederholung aus Augenhöhe) – mit
        // Hex-Kachelung näher am echten Maßstab (Steinchen/Halme in natürlicher Größe)
        const sm = Array.isArray(set.sizeM) ? set.sizeM[0] : set.sizeM;
        if (Number.isFinite(sm) && sm > 0) sizes[k] = Math.max(2.2, Math.min(6, sm * (hex ? 1.3 : 1.6)));
        libIds.push(`${set.id}@${set.tier}`);
      });
      if (libIds.length) source = libIds.length === TERRAIN_LAYERS.length ? 'bibliothek' : 'gemischt';
    } catch { /* prozedural */ }
  }
  // Kartenlook: Helligkeit je Schicht (z. B. Brandwald: Aushub/Lehm dunkler, passend zu den Grabenwänden)
  if (look?.cal) LAYERS.forEach((l, k) => { if (Number.isFinite(look.cal[l.key])) cal[k] = cal[k].map(v => v * look.cal[l.key]); });
  LAYERS.forEach((l, k) => {
    if (maps[k]) return;
    const m = o.getMaterial(l.proc);
    maps[k] = m.map || null; normals[k] = m.normalMap || null;
  });
  for (const t of [...maps, ...normals]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }

  const ctrl = ctrlTexture(hf);
  const uniforms = {
    tCtrl: { value: ctrl },
    tOrigin: { value: new THREE.Vector2(hf.minX - hf.res * 0.5, hf.minZ - hf.res * 0.5) },
    tSize: { value: hf.size + hf.res },
    tWaterY: { value: hf.waterY },
    tScale: { value: sizes.map(s => 1 / s) },
    tRough: { value: LAYERS.map(l => l.rough) },
    tRockTint: { value: new THREE.Vector3(...rockTint) },
    tCal: { value: cal.map(c => new THREE.Vector3(c[0], c[1], c[2])) },
    tNM: { value: TERRAIN_LAYERS.map((l, k) => nMode[k]) }, // je Schicht (Normalen-Kodierung)
    tHgt: { value: hasH },
    tNStr: { value: TERRAIN_LAYERS.map(l => l.nStr ?? 1) },
    // RG: feine Detailnormalen nah an der Kamera (Kopie der geteilten Karte aus engine/textures.js), BA: Gelände-Rauschen
    tNoise: { value: noiseTexture(low ? 1 : 4) },
  };
  TERRAIN_LAYERS.forEach((l, k) => { uniforms['tMap' + k] = { value: maps[k] }; });
  // Rang 3 (Kies) nur mit Hex-Kachelung (Samplerzahl: medium bleibt bei drei Normalen-Karten)
  const nList = TERRAIN_LAYERS.filter(l => l.normal >= 0 && (hex || l.normal < 3));
  nList.forEach((l) => { const k = TERRAIN_LAYERS.indexOf(l); uniforms['tNor' + l.normal] = { value: normals[k] }; });
  const haveNormals = useNormals && nList.every(l => normals[TERRAIN_LAYERS.indexOf(l)]);
  // Gras (vegetation.js): Wiesenfarbe und Gras-Albedo des Bodens
  terrainLook.ready = !!maps[0];
  terrainLook.waterY = Number.isFinite(hf.waterY) ? hf.waterY : -1e3;
  terrainLook.grassMap = uniforms.tMap0;
  terrainLook.grassCal = { value: (cal[0][0] + cal[0][1] + cal[0][2]) / 3 };
  if (grassAvg) {
    // Halme (vegetation.js: textureLod(tGrassMap, …, 12) × tGrassCal): Mittelfarbe des Bodens × Kalibrierung je Kanal als 1×1-Textur
    const px = new Uint8Array([0, 1, 2].map(i => Math.round(Math.min(1, grassAvg.toArray()[i] * cal[0][i] * 2) * 255)).concat(255));
    const t1 = new THREE.DataTexture(px, 1, 1, THREE.RGBAFormat); t1.colorSpace = THREE.NoColorSpace; t1.needsUpdate = true; t1.name = 'terrain:grassAvg';
    terrainLook.grassMap = { value: t1 }; terrainLook.grassCal = { value: 0.5 };
  }

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  mat.name = 'terrain';
  mat.userData.surface = 'grass';
  mat.polygonOffset = true; mat.polygonOffsetFactor = 1; mat.polygonOffsetUnits = 2; // Straßen/Plätze liegen knapp darüber
  mat.defines = { TERR_NORMALS: haveNormals ? 1 : 0, TERR_ANTITILE: low ? 0 : 1, TERR_DETAIL: 1, TERR_MEADOW: meadow ? 1 : 0, TERR_HEX: hex && haveNormals ? 1 : 0 };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'varying vec3 vTW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vTW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    const decl = `
      varying vec3 vTW;
      uniform sampler2D tCtrl, tMap0, tMap1, tMap2, tMap3, tMap4;
      #if TERR_NORMALS
      uniform sampler2D tNor0, tNor1, tNor2;
      #if TERR_HEX
      uniform sampler2D tNor3;
      #endif
      #endif
      uniform vec2 tOrigin; uniform float tSize; uniform float tWaterY; uniform float tScale[5]; uniform float tRough[5]; uniform vec3 tCal[5]; uniform vec3 tRockTint;
      uniform float tNM[5]; uniform float tHgt[5]; uniform float tNStr[5];
      // texturen3: Normale dekodieren (0 = RGB, 1 = RGB ungespiegelt → Y negiert, 2 = XY in R + Alpha, Y negiert)
      vec3 tDecN(vec4 t, float m) {
        if (m > 1.5) { vec2 xy = vec2(t.r, 1.0 - t.a) * 2.0 - 1.0; return vec3(xy, sqrt(clamp(1.0 - dot(xy, xy), 0.0, 1.0))); }
        vec3 n = t.xyz * 2.0 - 1.0; if (m > 0.5) n.y = -n.y; return n;
      }
      #if TERR_HEX
      // Hex-Kachelung je Schicht (Mikkelsen 2022, wie engine/surface.js): Dreiecksgitter, je Ecke zufällig gedrehte und
      // versetzte Abtastung, Gewichte = Baryzentrik^7 × Höhe (Alpha) – die höheren Steine/Halme setzen sich durch,
      // keine erkennbare Wiederholung, keine Verzerrung. Ableitungen kommen von außen (Aufruf in Verzweigungen).
      vec2 tHxH(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
      mat2 tHxR(vec2 h) { float a = h.y * 6.2831853; float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
      void tLayer(sampler2D tA, sampler2D tN, float nm, bool wantN, vec2 uv, vec2 dx, vec2 dy, out vec4 A, out vec3 N) {
        vec2 st = uv * 1.25 * 3.46410162;
        vec2 sk = vec2(st.x, -0.57735027 * st.x + 1.15470054 * st.y);
        vec2 b = floor(sk); vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
        vec3 w; vec2 v0, v1, v2;
        if (t.z > 0.0) { w = vec3(t.z, t.y, t.x); v0 = b; v1 = b + vec2(0.0, 1.0); v2 = b + vec2(1.0, 0.0); }
        else { w = vec3(-t.z, 1.0 - t.y, 1.0 - t.x); v0 = b + vec2(1.0); v1 = b + vec2(1.0, 0.0); v2 = b + vec2(0.0, 1.0); }
        vec2 h0 = tHxH(v0), h1 = tHxH(v1), h2 = tHxH(v2);
        mat2 r0 = tHxR(h0), r1 = tHxR(h1), r2 = tHxR(h2);
        vec2 u0 = r0 * uv + h0, u1 = r1 * uv + h1, u2 = r2 * uv + h2; // Versatz nur aus dem Eckpunkt (sonst Kanten)
        vec4 a0 = textureGrad(tA, u0, r0 * dx, r0 * dy), a1 = textureGrad(tA, u1, r1 * dx, r1 * dy), a2 = textureGrad(tA, u2, r2 * dx, r2 * dy);
        vec3 W = (vec3(a0.a, a1.a, a2.a) * 0.7 + 0.3) * pow(w, vec3(7.0));
        W /= max(W.x + W.y + W.z, 1e-5);
        A = a0 * W.x + a1 * W.y + a2 * W.z;
        N = vec3(0.0, 0.0, 1.0);
        if (wantN) {
          vec3 n0 = tDecN(textureGrad(tN, u0, r0 * dx, r0 * dy), nm), n1 = tDecN(textureGrad(tN, u1, r1 * dx, r1 * dy), nm), n2 = tDecN(textureGrad(tN, u2, r2 * dx, r2 * dy), nm);
          n0.xy = n0.xy * r0; n1.xy = n1.xy * r1; n2.xy = n2.xy * r2; // Drehung zurück (R^T)
          N = normalize(n0 * W.x + n1 * W.y + n2 * W.z);
        }
      }
      #endif
      uniform sampler2D tNoise;
      vec3 gTerrN; float gTerrRough;
      ${TERRAIN_NOISE_GLSL}
      // Gegen-Kachelung: zweite, gedrehte und gröbere Abtastung; Überblendung nach Helligkeit (Höhen-Überblendung:
      // der hellere/„höhere“ Texel setzt sich durch) statt linear – kein Kontrastverlust in der Mischzone
      // far (> 135 m, räumlich zusammenhängend → kein Divergenz-Problem): nur die gröbere Abtastung (k ist dort 1)
      vec3 tSample(sampler2D t, vec2 uv, float k, bool far) {
        #if TERR_ANTITILE
        vec2 uvB = vec2(0.8 * uv.x - 0.6 * uv.y, 0.6 * uv.x + 0.8 * uv.y) * 0.53 + vec2(0.31, 0.17);
        if (far) return texture2D(t, uvB).rgb;
        vec3 a = texture2D(t, uv).rgb, b = texture2D(t, uvB).rgb;
        float s = clamp((k - 0.5) * 3.0 + (dot(b, vec3(0.3, 0.59, 0.11)) - dot(a, vec3(0.3, 0.59, 0.11))) * 2.5 + 0.5, 0.0, 1.0);
        return mix(a, b, s);
        #else
        return texture2D(t, uv).rgb;
        #endif
      }
    `;
    sh.fragmentShader = decl + sh.fragmentShader
      .replace('#include <map_fragment>', `
        vec2 cuv = (vTW.xz - tOrigin) / tSize;
        vec4 c = texture2D(tCtrl, cuv);
        // glatte Weltnormale (interpoliert, nicht dreieckig wie dFdx/dFdy) für Hangneigung
        vec3 wN = normalize((vec4(vNormal, 0.0) * viewMatrix).xyz);
        float steepS = clamp(1.0 - wN.y, 0.0, 1.0);
        // außerhalb des Höhenfelds (Kulissenring): Fels nach Steilheit, sonst Gras
        float inside = step(0.0, cuv.x) * step(cuv.x, 1.0) * step(0.0, cuv.y) * step(cuv.y, 1.0);
        c = mix(vec4(0.12, 0.0, smoothstep(0.14, 0.32, steepS), 0.0), c, inside);
        float camD = length(vTW - cameraPosition);
        float hw = vTW.y - tWaterY;
        vec2 n1 = terrN1(vTW.xz);
        // Mitte (1–9 m): ab 150 m ausgeblendet, ab 220 m (Nebel) gar nicht mehr abgefragt; Flecken (0,2–1,5 m): ab 45 m
        // ausgeblendet (dort mittelt die Mipmap ohnehin auf 0,5), ab 70 m nicht mehr abgefragt – Entfernung ist räumlich
        // zusammenhängend, die Verzweigung kostet nichts und spart in der Ferne Abfragen
        float n2f = 1.0 - smoothstep(150.0, 220.0, camD);
        vec2 n2 = vec2(0.5);
        if (n2f > 0.0) n2 = mix(vec2(0.5), terrN2(vTW.xz), n2f);
        #if TERR_ANTITILE
        float n3f = 1.0 - smoothstep(45.0, 70.0, camD);
        vec2 n3 = vec2(0.5);
        if (n3f > 0.0) n3 = mix(vec2(0.5), terrN3(vTW.xz), n3f);
        float eN = n3.y - 0.5;
        #else
        vec2 n3 = vec2(0.5);
        float eN = n2.y - 0.5;
        #endif
        // grafik (22.11.): Steilflächen (Grabenwände, Brustwehr, Trichterränder, Uferabbrüche) seitlich statt von oben
        // projizieren – die Draufsicht zog die Textur dort zu senkrechten Streifen. Umschalten je Pixel (unregelmäßige Kante
        // über das Rauschen), Ableitungen aus denselben Achsen (keine Mip-Naht); ohne zusätzliche Texturen/Abfragen.
        vec3 tPd3x = dFdx(vTW), tPd3y = dFdy(vTW);
        bool tSide = steepS + (n2.x - 0.5) * 0.14 > 0.5 && inside > 0.5;
        bool tSideX = abs(wN.x) > abs(wN.z);
        vec2 tP = tSide ? (tSideX ? vTW.zy : vTW.xy) : vTW.xz;
        vec2 tPdx = tSide ? (tSideX ? tPd3x.zy : tPd3x.xy) : tPd3x.xz;
        vec2 tPdy = tSide ? (tSideX ? tPd3y.zy : tPd3y.xy) : tPd3y.xz;
        // Übergänge (Wegränder, Erdflecken, Geröll): schärfer und unregelmäßig statt bilinear verwaschen (1-m-Karte)
        vec4 tr = c * (1.0 - c) * 4.0;
        vec4 wv = clamp((c - 0.5) * 1.6 + 0.5 + eN * tr * 0.75, 0.0, 1.0);
        // Geröll/Kies in Flecken an steileren Hängen (feiner als die Kontrollkarte)
        float scree = smoothstep(0.1, 0.24, steepS + (n2.x - 0.5) * 0.08) * smoothstep(0.35, 0.7, n2.y) * (1.0 - wv.z) * 0.6 * inside;
        wv.y = max(wv.y, scree);
        // grafik (22.11.): auf Steilflächen wächst kein Rasen – die Kontrollkarte (1 m) trifft die schmalen Grabenwände nicht
        // und ließ dort leuchtend grüne Wiese stehen; ab ≈ 55° Neigung offener Boden (Erde-Schicht bzw. Kartenlook-Aushub)
        float bare = smoothstep(0.38, 0.56, steepS + (n2.x - 0.5) * 0.12) * inside;
        wv.x = max(wv.x, bare * clamp(1.0 - wv.y - wv.z - wv.w, 0.0, 1.0));
        float wG = clamp(1.0 - wv.x - wv.y - wv.z - wv.w, 0.0, 1.0);
        #if TERR_HEX
        // texturen3: je Schicht Hex-Kachelung (Albedo + Höhe im Alpha, Normalen), nur wo die Schicht Gewicht hat –
        // die Kontrollkarte ist räumlich zusammenhängend, meist sind 1–2 Schichten aktiv
        float fade = 1.0 - smoothstep(40.0, 140.0, camD);
        bool wantN = fade > 0.0;
        vec2 dWx = tPdx, dWy = tPdy;
        vec4 hA0 = vec4(0.0, 0.0, 0.0, 0.5), hA1 = hA0, hA2 = hA0, hA3 = hA0, hA4 = hA0;
        vec3 hN0 = vec3(0.0, 0.0, 1.0), hN1 = hN0, hN2 = hN0, hN3 = hN0, hN4 = hN0;
        if (wG > 0.002) tLayer(tMap0, tNor0, tNM[0], wantN, tP * tScale[0], dWx * tScale[0], dWy * tScale[0], hA0, hN0);
        if (wv.x > 0.002) tLayer(tMap1, tNor1, tNM[1], wantN, tP * tScale[1], dWx * tScale[1], dWy * tScale[1], hA1, hN1);
        if (wv.y > 0.002) tLayer(tMap2, tNor3, tNM[2], wantN, tP * tScale[2], dWx * tScale[2], dWy * tScale[2], hA2, hN2);
        if (wv.z > 0.002) tLayer(tMap3, tNor2, tNM[3], wantN, tP * tScale[3], dWx * tScale[3], dWy * tScale[3], hA3, hN3);
        if (wv.w > 0.002) tLayer(tMap4, tNor1, tNM[1], wantN, tP * tScale[4], dWx * tScale[4], dWy * tScale[4], hA4, hN4);
        vec3 aG = hA0.rgb * tCal[0];
        #else
        // Gegen-Kachelung: Flecken ≈ 1–9 m; fern ganz die gröbere Abtastung (Wiederholung fällt aus der Distanz auf)
        float kA = max(smoothstep(0.42, 0.58, n2.y), smoothstep(45.0, 130.0, camD));
        bool tFar = camD > 135.0;
        vec2 tW = (n2 - 0.5) * 0.35; // weiche UV-Verzerrung (texturen3: 0,9 → 0,35, sonst „verwirbelt“ in der Nähe)
        vec3 aG = tSample(tMap0, tP * tScale[0] + tW, kA, tFar) * tCal[0];
        #endif
        #if TERR_MEADOW
        // Wiesenfarbe: saftig ↔ trocken (großräumig, trockener an Hängen), feucht am Ufer
        aG *= terrMeadowTint(n1, n2, hw, steepS * 1.4);
        #if TERR_ANTITILE
        // Horste/Flecken (0,2–1,5 m): dunklere Büschel, einzelne helle trockene Stellen
        aG *= mix(0.82, 1.07, n3.x) * mix(vec3(1.0), vec3(1.1, 1.03, 0.8), smoothstep(0.86, 0.97, n3.y));
        #endif
        // zertretenes Gras an Wegrändern und um Erdflecken: heller, bräunlich
        float worn = smoothstep(0.03, 0.2, c.r) * (1.0 - smoothstep(0.3, 0.7, c.r));
        aG = mix(aG, aG * vec3(1.08, 0.97, 0.74), worn * 0.8);
        #else
        // neutrale Grundschicht (Brandboden): großräumige Helligkeit + Flecken statt Wiesenfarbe
        aG *= (0.86 + 0.28 * n1.y) * mix(0.88, 1.08, n3.x);
        #endif
        #if TERR_HEX
        vec3 aD = hA1.rgb * tCal[1] * mix(vec3(0.9, 0.9, 0.94), vec3(1.08, 1.03, 0.92), n1.y);
        vec3 aK = hA2.rgb * tCal[2];
        vec3 aF = hA3.rgb * tRockTint * tCal[3];
        vec3 aM = hA4.rgb * tCal[4];
        // Höhen-Überblendung: an Übergängen setzen sich die höheren Texel durch (Steine ragen aus der Erde, Erde in den
        // Fugen des Kieses) statt linearer Überblendung; Schichten ohne Höhe (alte Sätze/prozedural) gelten als 0,5
        float h0 = mix(0.5, hA0.a, tHgt[0]);
        vec4 hV = mix(vec4(0.5), vec4(hA1.a, hA2.a, hA3.a, hA4.a), vec4(tHgt[1], tHgt[2], tHgt[3], tHgt[4]));
        float sG = wG + h0 * 0.5 * smoothstep(0.0, 0.3, wG);
        vec4 sV = wv + hV * 0.5 * smoothstep(vec4(0.0), vec4(0.3), wv);
        float hMa = max(sG, max(max(sV.x, sV.y), max(sV.z, sV.w))) - 0.2;
        float bG = max(sG - hMa, 0.0); vec4 bV = max(sV - hMa, vec4(0.0));
        float sum = bG + bV.x + bV.y + bV.z + bV.w + 1e-4;
        vec3 alb = (aG * bG + aD * bV.x + aK * bV.y + aF * bV.z + aM * bV.w) / sum;
        gTerrRough = (tRough[0] * bG + tRough[1] * bV.x + tRough[2] * bV.y + tRough[3] * bV.z + tRough[4] * bV.w) / sum;
        // Höhe als leichte Mikro-Verschattung (Senken zwischen Steinen/Horsten dunkler, rauer)
        float hB = (h0 * bG + dot(hV, bV)) / sum;
        alb *= mix(0.84, 1.05, hB);
        gTerrRough = clamp(gTerrRough + (0.5 - hB) * 0.08, 0.3, 1.0);
        #else
        vec3 aD = tSample(tMap1, tP * tScale[1] + tW, kA, tFar) * tCal[1] * mix(vec3(0.9, 0.9, 0.94), vec3(1.08, 1.03, 0.92), n1.y);
        vec3 aK = tSample(tMap2, tP * tScale[2] + tW, kA, tFar) * tCal[2];
        vec3 aF = tSample(tMap3, tP * tScale[3] + tW, kA, tFar) * tRockTint * tCal[3]; // Fels/Geröll dunkler (kein Schnee-Eindruck; Kartenlook rockTint)
        vec3 aM = texture2D(tMap4, tP * tScale[4] + tW).rgb * tCal[4];
        float sum = wG + wv.x + wv.y + wv.z + wv.w + 1e-4;
        vec3 alb = (aG * wG + aD * wv.x + aK * wv.y + aF * wv.z + aM * wv.w) / sum;
        gTerrRough = (tRough[0] * wG + tRough[1] * wv.x + tRough[2] * wv.y + tRough[3] * wv.z + tRough[4] * wv.w) / sum;
        #endif
        // Feuchte: nasser Saum an der Wasserlinie (dunkel, glatt), darüber feuchter, dunklerer Uferstreifen
        float wet = 1.0 - smoothstep(0.05, 0.7 + n2.x * 0.6, hw);
        float damp = 1.0 - smoothstep(0.5, 2.6, hw + (n2.y - 0.5) * 0.8);
        alb *= mix(1.0, 0.84, damp) * mix(1.0, 0.6, wet);
        gTerrRough = mix(gTerrRough, 0.35, wet);
        diffuseColor.rgb *= alb;
        #if TERR_NORMALS
        #if TERR_HEX
        gTerrN = vec3(0.0, 0.0, 1.0);
        if (wantN) {
          vec3 nB = vec3(hN0.xy * tNStr[0], hN0.z) * bG + vec3(hN1.xy * tNStr[1], hN1.z) * bV.x + vec3(hN2.xy * tNStr[2], hN2.z) * bV.y
            + vec3(hN3.xy * tNStr[3], hN3.z) * bV.z + vec3(hN4.xy * tNStr[4], hN4.z) * bV.w;
          gTerrN = normalize(mix(vec3(0.0, 0.0, 1.0), normalize(nB + vec3(0.0, 0.0, 1e-3)), 0.95 * fade * (1.0 - wet * 0.6)));
        }
        // Mikro-Relief direkt vor den Füßen: die Erde-Normalen 4,3× feiner (Bodenkorn), bis ≈ 8 m
        float mF = 1.0 - smoothstep(2.5, 8.0, camD);
        if (mF > 0.01) {
          vec3 nMi = tDecN(texture2D(tNor1, tP * tScale[1] * 4.3 + vec2(0.37, 0.61)), tNM[1]);
          gTerrN = normalize(gTerrN + vec3(nMi.xy * 0.3 * mF, 0.0));
        }
        #else
        float fade = 1.0 - smoothstep(40.0, 140.0, camD);
        gTerrN = vec3(0.0, 0.0, 1.0);
        // ab 140 m flach (wie vorher) – dort die drei Normalen-Abfragen ganz sparen (Entfernung: räumlich zusammenhängend)
        if (fade > 0.0) {
          vec2 uG = tP * tScale[0] + tW, uD = tP * tScale[1] + tW, uF = tP * tScale[3] + tW;
          vec3 nG = tDecN(texture2D(tNor0, uG), tNM[0]), nD = tDecN(texture2D(tNor1, uD), tNM[1]), nF = tDecN(texture2D(tNor2, uF), tNM[3]);
          // Stärke je Schicht: Gras flach (Fotoscan-Relief wirkt sonst wie Plastik), Erde mittel, Fels kräftig
          nG.xy *= 0.6; nF.xy *= 1.15;
          vec3 nB = normalize(nG * wG + nD * (wv.x + wv.y + wv.w) + nF * wv.z + vec3(0.0, 0.0, 0.05));
          gTerrN = normalize(mix(vec3(0.0, 0.0, 1.0), nB, 0.9 * fade * (1.0 - wet * 0.6)));
        }
        #endif
        float dFade = 1.0 - smoothstep(4.0, 26.0, camD);
        if (dFade > 0.01) {
          vec2 dn = texture2D(tNoise, tP * 1.15).xy * 2.0 - 1.0;
          gTerrN = normalize(gTerrN + vec3(dn * 0.45 * dFade, 0.0));
        }
        // textures-2: zweite, feinere Detailstufe direkt vor den Füßen (≈ 30 cm Periode, bis 9 m)
        float dFade2 = 1.0 - smoothstep(2.0, 9.0, camD);
        if (dFade2 > 0.01) {
          vec2 dn2 = texture2D(tNoise, tP * 3.4 + 0.5).xy * 2.0 - 1.0;
          gTerrN = normalize(gTerrN + vec3(dn2 * 0.3 * dFade2, 0.0));
        }
        #else
        gTerrN = vec3(0.0, 0.0, 1.0);
        #if TERR_DETAIL
        // textures-2 (low): nur die Detailnormalen nah an der Kamera – Bodenrelief statt glatter Fläche
        {
          float dFl = 1.0 - smoothstep(3.0, 16.0, camD);
          if (dFl > 0.01) {
            vec2 dnl = texture2D(tNoise, tP * 1.15).xy * 2.0 - 1.0;
            gTerrN = normalize(vec3(dnl * 0.5 * dFl, 1.0));
          }
        }
        #endif
        #endif
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gTerrRough;')
      .replace('#include <normal_fragment_maps>', `
        #if TERR_NORMALS || TERR_DETAIL
        // Tangente: Welt-X, auf nach ±X zeigenden Steilflächen Welt-Z (passend zur Seitenprojektion, sonst entartet)
        vec3 tXv = (viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz;
        vec3 tT = abs(dot(normal, tXv)) > 0.7 ? (viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz : tXv;
        tT = normalize(tT - normal * dot(normal, tT));
        vec3 tB = cross(tT, normal);
        normal = normalize(mat3(tT, tB, normal) * gTerrN);
        #endif
      `);
  };
  mat.customProgramCacheKey = () => `terrain-v9-${haveNormals ? 1 : 0}-${low ? 0 : 1}-${meadow ? 1 : 0}-${hex && haveNormals ? 1 : 0}`;
  return {
    material: mat, uniforms, libIds, source,
    dispose() { ctrl.dispose(); mat.dispose(); noiseTex?.dispose(); },
  };
}
