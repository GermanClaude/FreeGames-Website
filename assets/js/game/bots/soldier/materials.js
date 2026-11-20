// NULLPUNKT — Soldaten-Materialien (Realismus-Plan C1/M6): Fotoscan-Stoff (CC0, assets/lib: fabric_uniform –
// Albedo-Kavität/Normalen/Rauheit) über einem prozeduralen Tarnmuster in den Farben des Teams, Schmutz und Abnutzung,
// Randlicht relativ zum Umgebungslicht. Ein MeshStandardMaterial je Soldat (Pool, gleiches Shaderprogramm für alle
// Schemata einer Qualitätsstufe; nur Uniforms und Tarnmaske unterscheiden sich).
//
// Geometrie-Attribute (soldier/builder.js): aNp = (Tarnanteil, Detail, Leuchtanteil, Glanz), aNq = (Palettenplatz,
// Materialklasse, Abnutzung, Teil-Zufall), uv in Metern, color = Farbe bzw. Helligkeitsfaktor (Palette).
// Uniforms: uPal[10] Schemafarben je Palettenplatz (+ Hautton) · uCamo[4] Tarnfarben (Grund, dunkel, hell, Fleck) · uCls[6] je
// Materialklasse (Detail-Maßstab 1/m, Normalenstärke, Kavität, Rauheit aus dem Scan) · uNpOrm (ORM des Stoffs) ·
// uNpMacro (Falten-Normalen + Rauschen, nur ab medium) · uDissolve (Auflösen der Leiche) · Randlicht/Lichtboden
// (Gegner im Schatten lesbar, F37) – beide skalieren mit dem örtlichen Umgebungslicht (Belichtungsautomatik R4 und
// Sonden-Gitter R5 lassen Gegner in dunklen Räumen sonst glühen).
// Texturen: Fotoscan-Satz (KTX2, 512 auf low, sonst 1024) wird im Hintergrund geladen (upgradeSoldierMaterials);
// bis dahin bzw. ohne Transcoder prozedurale Ersatztexturen – gleiches Programm, kein Neukompilieren beim Tausch.
import * as THREE from 'three';
import { assets, tierFor } from '../../../../lib/loader.js?v=20261115041504';

/* ------------------------------------------------------------------ Farbschemata */

// camo: [Grund, dunkel, hell, Akzentfleck]; gear/gear2: Weste/Taschen; accent: Teamfarbe (leuchtet dezent)
// hostile: aus Spielersicht Gegner (A = eigenes Team) → kräftigerer, getönter Randlicht-Saum
export const SCHEMES = {
  // Grafik-Vorlage 15.10.: kantiges grünes Splittertarn wie die Soldaten im Video; beide Teams im Video-Tarn, B etwas
  // brauner, Unterscheidung über Armbinde. 16.10. an der sonnigen Schulter nachgemessen: Flecken Oliv, Khaki,
  // Braunoliv, Dunkelgrün – dunkelster Fleck ≈ halb so hell wie der hellste (das fast Schwarz im Video ist Schatten)
  A: {
    // 21.10.: zurück zum Splittertarn der Video-Soldaten (Nutzer: „ich habe dir doch das Video geschickt“)
    id: 'A', name: 'Nordwind', camo: ['#6c6646', '#4b4c35', '#958c6a', '#3a3f2d'], pattern: 'splitter',
    gear: '#4a4d37', gear2: '#3a3d2c', strap: '#2f3226', helmet: '#4b4e37', glove: '#24261f', boot: '#2b2926',
    pants: '#55553b', accent: '#38b6ff', metal: '#3a3d40', hostile: false,
  },
  B: {
    id: 'B', name: 'Wüstenfuchs', camo: ['#73663f', '#54482f', '#a08f67', '#433827'], pattern: 'splitter',
    gear: '#57503a', gear2: '#45402e', strap: '#363226', helmet: '#59533b', glove: '#2e2a20', boot: '#33291f',
    pants: '#5c5639', accent: '#ff3b3b', metal: '#3d3a36', hostile: true,
  },
  // Wüstenfuchs für helle Karten (Mittagssonne, heller Stein): gleiche Farbfamilie, deutlich dunkler
  Bd: {
    // 21.10.: Splitter wie Team B (vorher rotbrauner Akzentfleck → Gegner wirkten rosa/hautfarben)
    id: 'Bd', name: 'Wüstenfuchs', camo: ['#655a3a', '#463d28', '#857654', '#3a3324'], pattern: 'splitter',
    gear: '#5a4a35', gear2: '#46392a', strap: '#382d21', helmet: '#6b5a40', glove: '#2f281f', boot: '#2e251c',
    pants: '#6e5a44', accent: '#ff3b3b', metal: '#34312d', hostile: true,
  },
  urban: {
    id: 'urban', name: 'Beton', camo: ['#7a7f84', '#4a4f55', '#a3a8ad', '#2f3338'], pattern: 'digital',
    gear: '#3b3f44', gear2: '#2c2f33', strap: '#24272a', helmet: '#4c5157', glove: '#1e2022', boot: '#1f2022',
    pants: '#6b7075', accent: '#ff5b1f', metal: '#34373a', hostile: true,
  },
  wald: {
    id: 'wald', name: 'Forst', camo: ['#5b6142', '#3a3d27', '#7d7b52', '#5a4430'], pattern: 'woodland',
    gear: '#4f5236', gear2: '#3d3f2a', strap: '#33352a', helmet: '#555a3c', glove: '#2e2b22', boot: '#33291f',
    pants: '#5f6446', accent: '#ffb020', metal: '#36382f', hostile: true,
  },
  nacht: {
    id: 'nacht', name: 'Nachtschicht', camo: ['#30333a', '#1d1f24', '#454952', '#2a2f3d'], pattern: 'multi',
    gear: '#25272b', gear2: '#1b1c1f', strap: '#18191b', helmet: '#2b2d31', glove: '#141516', boot: '#161618',
    pants: '#34373e', accent: '#c46bff', metal: '#2a2c2f', hostile: true,
  },
  schnee: {
    id: 'schnee', name: 'Firn', camo: ['#c9ced2', '#9aa2a8', '#e4e7e9', '#7d878f'], pattern: 'digital',
    gear: '#8e969c', gear2: '#6f777d', strap: '#5c6368', helmet: '#b9c0c5', glove: '#3a3e41', boot: '#3f4245',
    pants: '#bcc2c6', accent: '#2ee6c4', metal: '#4a4e52', hostile: true,
  },
  sand: {
    id: 'sand', name: 'Düne', camo: ['#b59a6c', '#8d7350', '#d2bb8e', '#6d5a40'], pattern: 'woodland',
    gear: '#7a6a4c', gear2: '#5e5139', strap: '#4b412f', helmet: '#a88f63', glove: '#5b4c36', boot: '#55442f',
    pants: '#b09766', accent: '#ff7a3d', metal: '#3c3933', hostile: true,
  },
};
export const FFA_SCHEMES = ['urban', 'wald', 'nacht', 'schnee', 'sand'];
// FFA auf hellen Karten: nur Schemata, die sich von hellem Stein/Sand abheben
const FFA_SCHEMES_BRIGHT = ['urban', 'wald', 'nacht', 'Bd'];

// Hauttöne (leicht entsättigt, damit das Gesicht unter warmem Licht nicht orange wirkt)
export const SKIN_TONES = ['#bf9a80', '#a37d63', '#86614a', '#694a39', '#4d3528', '#caa58f'];

/** Palettenplätze in der Reihenfolge von builder.PALETTE (0 = keine Palette). */
// 20.11.: + 'skin' (Hautton je Soldat, setzt character.js/face.js – Hände/Hals passen zum Gesicht)
const PAL_KEYS = ['', 'gear', 'gear2', 'strap', 'helmet', 'glove', 'boot', 'metal', 'accent', 'skin'];

/**
 * Materialklassen (Reihenfolge wie builder.CLASSES): [Detail-Maßstab 1/m, Normalenstärke, Kavität, Rauheit aus Scan].
 * Stoff 10 cm je Kachel (fabric_uniform sizeM 0,1), Cordura gröber, Haut/Hartteile nur ein Hauch Struktur.
 */
export const CLASS_PARAMS = [
  [10, 0.95, 0.85, 0.9], // cloth (Uniform)
  [6.5, 1.1, 1.0, 0.85], // gear (Cordura: Weste, Taschen, Gurte)
  [3.5, 0.12, 0.2, 0.15], // skin
  [2.6, 0.16, 0.35, 0.2], // hard (Helm, Kunststoff, Metall)
  [4.5, 0.4, 0.55, 0.2], // leather (Stiefel, Handschuhe, Maske) – 20.11.: Rauheit kaum aus dem Stoffscan (Leder matt)
  [0, 0, 0, 0], // glass
];

/** Helle Karte? (Nebelfarbe als Maß der Umgebungshelligkeit: Mittagssonne/heller Stein) */
export function isBrightWorld(world) {
  const fog = world && world.lighting && world.lighting.fogColor;
  if (!fog) return false;
  const c = fog.isColor ? fog : new THREE.Color(fog);
  // c ist linear (three.js-Farbverwaltung) → relative Leuchtdichte
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.55;
}

/** Farbschema eines Teams auf dieser Karte ('A' | 'B' | 'Bd'); FFA → null (siehe ffaSchemes). */
export function schemeForTeam(team, world) {
  if (team === 'A') return 'A';
  if (team === 'B') return isBrightWorld(world) ? 'Bd' : 'B';
  return null;
}

/** FFA-Schemata für diese Karte. */
export function ffaSchemes(world) {
  return isBrightWorld(world) ? FFA_SCHEMES_BRIGHT : FFA_SCHEMES;
}

/* ------------------------------------------------------------------ Rauschen */

function makeNoise(period, seed) {
  // periodisches Wertrauschen (kachelbar)
  const g = new Float32Array(period * period);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < g.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; g[i] = s / 4294967296; }
  const fn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const a = g[y0 * period + x0], b = g[y0 * period + x1], c = g[y1 * period + x0], d = g[y1 * period + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  fn.period = period;
  return fn;
}

/** Kachelbares fBm im Bereich [0,1) × [0,1): jede Oktave wird über genau ihre Periode abgetastet. */
/** Periodisches Wertrauschen mit getrennten Perioden in x und y (gestreckte, kachelbare Strukturen wie Zweige). */
function makeNoiseXY(px, py, seed) {
  const g = new Float32Array(px * py);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < g.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; g[i] = s / 4294967296; }
  return (u, v) => {
    const x = u * px, y = v * py, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = g[y0 * px + x0], b = g[y0 * px + x1], c = g[y1 * px + x0], d = g[y1 * px + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}

function fbm(noises, u, v) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < noises.length; o++) {
    const n = noises[o];
    sum += n(u * n.period, v * n.period) * amp;
    norm += amp;
    amp *= 0.55;
  }
  return sum / norm;
}

function srgbBytes(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function canvas2d(size, h = size) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try { const c = new OffscreenCanvas(size, h); const ctx = c.getContext('2d'); if (ctx) return { c, ctx }; } catch { /* Rückfall */ }
  }
  const c = document.createElement('canvas');
  c.width = size; c.height = h;
  return { c, ctx: c.getContext('2d') };
}

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------------ Texturen */

const texCache = new Map();

/**
 * Tarnmaske eines Musterstils (256², linear, kachelbar): R = dunkle Flecken, G = helle Flecken, B = Akzent (Zweige/
 * Pixel). Weiche Kanten (Mip-Stufen bleiben ruhig); Farben setzt der Shader aus dem Schema (uCamo). Ein Muster für
 * alle Schemata desselben Stils → wenig Speicher auch im FFA.
 */
/** Splittertarn: Farbklasse (0 Grund, 1 dunkel, 2 hell, 3 Akzent) der Voronoi-Zelle bei (u, v) im Einheitsquadrat. */
function splitCell(u, v, seed) {
  const G = 7;
  const gx = Math.floor(u * G), gy = Math.floor(v * G);
  let best = 1e9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = gx + ox, cy = gy + oy;
    const wx = ((cx % G) + G) % G, wy = ((cy % G) + G) % G;
    const h = hash2(wx, wy, seed);
    const px = (cx + 0.15 + 0.7 * h[0]) / G, py = (cy + 0.15 + 0.7 * h[1]) / G;
    // leicht gestreckte Zellen (Splitter laufen schräg): Abstand in gedrehter, gestauchter Metrik
    const dx = u - px, dy = v - py;
    const a = dx * 0.87 + dy * 0.5, b = -dx * 0.5 + dy * 0.87;
    const dd = a * a * 0.55 + b * b;
    if (dd < best) { best = dd; id = h[2]; }
  }
  return id < 0.34 ? 0 : id < 0.64 ? 1 : id < 0.9 ? 2 : 3;
}
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  const out = [];
  for (let k = 0; k < 3; k++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    out.push(((h >>> 0) % 100000) / 100000);
  }
  return out;
}

/**
 * Splittertarn als gedruckter Stoff (sol 15.11.; vorher 256² mit 7 × 7 groben Zellen → las sich wie Polygonflächen der
 * Geometrie): 512² je 45-cm-Kachel, 11 × 11 Voronoi-Splitter mit leicht unruhigen Druckkanten (feines Verzerrungsrauschen),
 * kleine Splitter-Inseln und die typischen senkrechten „Regenstriche“ (kurze dunkle Striche, Kanal B) über allen Farben.
 * Kanten 1 px weich (3 × 3-Filter der Farbklassen) → ruhige Mip-Stufen. Kosten einmalig ≈ 40–80 ms.
 */
function splitterMask(key) {
  const N = 512, G = 11;
  const seed = 9137;
  const { c, ctx } = canvas2d(N);
  const img = ctx.createImageData(N, N);
  const d = img.data;
  const wn = [makeNoise(16, seed + 1), makeNoise(32, seed + 2)];
  const cls = new Uint8Array(N * N);
  // Zellpunkte (kachelbar) einmal vorberechnen
  const cp = new Float32Array(G * G * 3);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const h = hash2(x, y, seed), i = (y * G + x) * 3;
    cp[i] = (x + 0.12 + 0.76 * h[0]) / G; cp[i + 1] = (y + 0.12 + 0.76 * h[1]) / G;
    cp[i + 2] = h[2] < 0.33 ? 0 : h[2] < 0.62 ? 1 : h[2] < 0.88 ? 2 : 3;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let u = x / N, v = y / N;
    // Druckkanten: kleine Verzerrung (≈ 2–3 mm) – Kanten bleiben gerade, aber nicht maschinell glatt
    u += (wn[0](u * 16, v * 16) - 0.5) * 0.008 + (wn[1](u * 32, v * 32) - 0.5) * 0.004;
    v += (wn[1](u * 32 + 7, v * 32 + 3) - 0.5) * 0.008;
    const gx = Math.floor(u * G), gy = Math.floor(v * G);
    let best = 1e9, id = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox, cy = gy + oy;
      const wx = ((cx % G) + G) % G, wy = ((cy % G) + G) % G, i = (wy * G + wx) * 3;
      const px = cp[i] + (cx - wx) / G, py = cp[i + 1] + (cy - wy) / G;
      const dx = u - px, dy = v - py;
      const a = dx * 0.87 + dy * 0.5, b = -dx * 0.5 + dy * 0.87;
      const dd = a * a * 0.5 + b * b;
      if (dd < best) { best = dd; id = cp[i + 2]; }
    }
    cls[y * N + x] = id;
  }
  // Regenstriche: senkrechte Strichreihen (Abstand ≈ 6 mm, Strich ≈ 0,9 mm × 6–12 mm), je Spalte versetzt, lückig, halbe Deckung
  const rain = new Uint8Array(N * N);
  const colStep = 6.4;
  for (let k = 0; k * colStep < N; k++) {
    const x0 = Math.round(k * colStep + hash2(k, 3, seed)[0] * 2);
    for (let y = 0; y < N;) {
      const h = hash2(k, y, seed + 5);
      const len = 7 + Math.floor(h[0] * 7), gap = 8 + Math.floor(h[1] * 18);
      if (h[2] < 0.55) for (let j = 0; j < len; j++) { const yy = (y + j) % N; rain[yy * N + (x0 % N)] = 255; }
      y += len + gap;
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let r = 0, g = 0, bl = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const w = ox === 0 && oy === 0 ? 4 : ox === 0 || oy === 0 ? 2 : 1;
      const k = cls[((y + oy + N) % N) * N + ((x + ox + N) % N)];
      if (k === 1) r += w; else if (k === 2) g += w; else if (k === 3) bl += w;
    }
    const i = (y * N + x) * 4;
    const rn = rain[y * N + x] / 255;
    d[i] = (r / 16) * 255; d[i + 1] = (g / 16) * (1 - rn * 0.5) * 255; d[i + 2] = Math.max(bl / 16, rn * 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.name = 'soldat:tarnmaske:splitter';
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

export function camoMaskTexture(pattern = 'multi') {
  const key = 'mask:' + pattern;
  if (texCache.has(key)) return texCache.get(key);
  if (pattern === 'splitter') return splitterMask(key);
  const N = 256;
  const { c, ctx } = canvas2d(N);
  const img = ctx.createImageData(N, N);
  const d = img.data;
  const seed = [...pattern].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7);
  const L1 = [makeNoise(4, seed + 1), makeNoise(8, seed + 2), makeNoise(16, seed + 3), makeNoise(32, seed + 4)];
  const L2 = [makeNoise(5, seed + 11), makeNoise(10, seed + 12), makeNoise(20, seed + 13), makeNoise(40, seed + 14)];
  const L3 = [makeNoise(8, seed + 21), makeNoise(16, seed + 22), makeNoise(32, seed + 23)];
  const W = [makeNoise(4, seed + 31), makeNoise(8, seed + 32)];
  const W2 = [makeNoise(4, seed + 41), makeNoise(8, seed + 42)];
  const twig = makeNoise(64, seed + 51), twig2 = makeNoise(8, seed + 52);
  const twigXY = makeNoiseXY(40, 9, seed + 53); // senkrecht gestreckt (Zweige)
  const soft = pattern === 'digital' ? 0.002 : pattern === 'woodland' ? 0.012 : 0.02;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let u = x / N, v = y / N;
      if (pattern === 'splitter') {
        // Splittertarn (Video): kantige Vieleck-Flecken = Voronoi-Zellen eines verwackelten 7×7-Gitters (kachelbar),
        // jede Zelle eine Farbklasse; 2×2-Überabtastung gegen Treppen an den geraden Kanten
        let r = 0, g = 0, bl = 0;
        for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
          const cls = splitCell((x + 0.25 + sx * 0.5) / N, (y + 0.25 + sy * 0.5) / N, seed);
          r += cls === 1 ? 0.25 : 0; g += cls === 2 ? 0.25 : 0; bl += cls === 3 ? 0.25 : 0;
        }
        const i = (y * N + x) * 4;
        d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = bl * 255; d[i + 3] = 255;
        continue;
      }
      if (pattern === 'mc') {
        // 21.10. Mehrschicht-Tarn (Nutzer: „bessere Tarnung“): verzerrte Grundwolken, große dunkle Flächen mit
        // ausgefransten Rändern, helle Inseln dazwischen, feine senkrechte Zweige/Äste als Akzent – gedruckte, scharfe
        // Kanten (leicht geglättet), mehrere Größenordnungen (liest sich nah und auf 30 m)
        const wu = fbm(W, u, v) - 0.5, wv = fbm(W2, u, v) - 0.5;
        const uu = (u + wu * 0.11 + 1) % 1, vv = (v + wv * 0.11 + 1) % 1;
        const a = fbm(L1, uu, vv) + (fbm(L3, (uu + 0.31) % 1, (vv + 0.77) % 1) - 0.5) * 0.18;
        const b = fbm(L2, (uu + 0.375) % 1, (vv + 0.125) % 1) + (fbm(L3, (uu + 0.6) % 1, (vv + 0.2) % 1) - 0.5) * 0.2;
        const e = fbm(L3, (u + 0.75) % 1, (v + 0.5) % 1);
        const r = sstep(0.545, 0.565, a);
        const g = sstep(0.585, 0.605, b) * (1 - r);
        // Zweige: gestreckte Rauschlinien (Grat), nur in Teilen der Fläche
        const n1 = twigXY(u, v), n2 = twig2(u * 8 + 3, v * 8 + 1);
        const ridge = 1 - Math.abs(n1 * 2 - 1);
        const bl = sstep(0.86, 0.9, ridge) * sstep(0.5, 0.62, n2) * sstep(0.42, 0.55, e);
        const i = (y * N + x) * 4;
        d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = bl * 255; d[i + 3] = 255;
        continue;
      }
      if (pattern === 'digital') {
        // Pixelmuster: quantisierte Koordinaten
        const q = 1 / 48;
        u = (Math.floor(u / q) + 0.5) * q; v = (Math.floor(v / q) + 0.5) * q;
      } else {
        // organische Ränder: Domänenverzerrung
        const wu = fbm(W, u, v) - 0.5, wv = fbm(W2, u, v) - 0.5;
        const k = pattern === 'woodland' ? 0.09 : 0.06;
        u = (u + wu * k + 1) % 1; v = (v + wv * k + 1) % 1;
      }
      const a = fbm(L1, u, v);
      const b = fbm(L2, (u + 0.375) % 1, (v + 0.125) % 1);
      const e = fbm(L3, (u + 0.75) % 1, (v + 0.5) % 1);
      let r = 0, g = 0, bl = 0;
      if (pattern === 'woodland') {
        r = sstep(0.54 - soft, 0.54 + soft, a);
        g = sstep(0.6 - soft, 0.6 + soft, b);
        bl = sstep(0.64 - soft, 0.64 + soft, e);
      } else if (pattern === 'digital') {
        r = a > 0.54 ? 1 : 0;
        g = b > 0.58 ? 1 : 0;
        bl = e > 0.65 ? 1 : 0;
      } else {
        // multi: große weiche Flächen, kleinere helle Flecken, feine senkrechte „Zweige“ als Akzent
        r = sstep(0.53 - soft, 0.53 + soft, a);
        g = sstep(0.6 - soft, 0.6 + soft, b) * (1 - r * 0.6);
        const tw = twig(u * 64, v * 16) * 0.6 + twig2(u * 8, v * 8) * 0.4;
        bl = sstep(0.62, 0.66, tw) * sstep(0.45, 0.55, e);
      }
      const i = (y * N + x) * 4;
      d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = bl * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.name = 'soldat:tarnmaske:' + pattern;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

/** Tarnmuster-Textur eines Schemas (sRGB, für Vorschauen; das Spiel nutzt Maske + Uniforms). */
export function camoTexture(schemeId) {
  const key = 'camo:' + schemeId;
  if (texCache.has(key)) return texCache.get(key);
  const sc = SCHEMES[schemeId] || SCHEMES.A;
  const mask = camoMaskTexture(sc.pattern).image;
  const N = mask.width;
  const { c, ctx } = canvas2d(N);
  ctx.drawImage(mask, 0, 0);
  const img = ctx.getImageData(0, 0, N, N);
  const d = img.data;
  const cols = sc.camo.map(srgbBytes);
  for (let i = 0; i < d.length; i += 4) {
    const m = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255];
    let col = cols[0];
    for (let k = 0; k < 3; k++) col = col.map((v, j) => v + (cols[k + 1][j] - v) * m[k]);
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

/** Gewebe-Höhenfeld (Ripstop-Gitter, Köper, Knitter) 128², 0..1 – Grundlage der Ersatz-Normalen/-ORM. */
function weaveHeight() {
  const key = 'weaveH';
  if (texCache.has(key)) return texCache.get(key);
  const N = 128;
  const n1 = makeNoise(16, 91), n2 = makeNoise(64, 92);
  const h = new Float32Array(N * N);
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const grid = (x % 16 === 0 || y % 16 === 0) ? 0.22 : 0;
    const twill = ((x + y) % 4 < 2) ? 0.18 : 0;
    const v = grid + twill + n1(x / N * 16, y / N * 16) * 0.9 + n2(x / N * 64, y / N * 64) * 0.25;
    h[y * N + x] = v; lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  for (let i = 0; i < h.length; i++) h[i] = (h[i] - lo) / (hi - lo || 1);
  const out = { N, h };
  texCache.set(key, out);
  return out;
}

/** Ersatz-Normalmap des Gewebes (bis der Fotoscan geladen ist bzw. ohne KTX2). */
export function weaveNormal() {
  const key = 'weave';
  if (texCache.has(key)) return texCache.get(key);
  const { N, h } = weaveHeight();
  const { c, ctx } = canvas2d(N);
  const img = ctx.createImageData(N, N);
  const d = img.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const l = h[y * N + ((x - 1 + N) % N)], r = h[y * N + ((x + 1) % N)];
    const t = h[((y - 1 + N) % N) * N + x], b = h[((y + 1) % N) * N + x];
    let nx = (l - r) * 1.6, ny = (t - b) * 1.6, nz = 1;
    const len = Math.hypot(nx, ny, nz);
    nx /= len; ny /= len; nz /= len;
    const i = (y * N + x) * 4;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.name = 'soldat:gewebe-normal';
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

/** Ersatz-ORM des Gewebes: R = Kavität aus dem Höhenfeld, G = Rauheit (≈ 0,8 mit Streuung), B = 0. */
function weaveOrm() {
  const key = 'weaveOrm';
  if (texCache.has(key)) return texCache.get(key);
  const { N, h } = weaveHeight();
  const { c, ctx } = canvas2d(N);
  const img = ctx.createImageData(N, N);
  const d = img.data;
  let sum = 0;
  for (let i = 0; i < N * N; i++) {
    const ao = 0.62 + 0.38 * h[i];
    sum += ao;
    d[i * 4] = ao * 255; d[i * 4 + 1] = (0.74 + 0.16 * (1 - h[i])) * 255; d[i * 4 + 2] = 0; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.name = 'soldat:gewebe-orm';
  tex.userData.aoMean = sum / (N * N);
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

/**
 * Faltenkarte (128², kachelbar): RG = Normalen-Neigung grober Stofffalten (überwiegend quer zum Glied, wie
 * Stauchfalten an Knie/Ellbogen/Bauch), B = weiches Rauschen für Schmutz/Abnutzung.
 */
function wrinkleTexture() {
  const key = 'wrinkle';
  if (texCache.has(key)) return texCache.get(key);
  const N = 128;
  const warp = makeNoise(4, 301), fold = makeNoise(8, 302), amp = makeNoise(4, 303);
  const dirt = [makeNoise(4, 311), makeNoise(8, 312), makeNoise(16, 313), makeNoise(32, 314)];
  const H = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    // Falten: Sinus entlang v (quer zum Glied), Phase durch Rauschen verbogen, Stärke fleckig
    const ph = v * 6 * Math.PI * 2 + warp(u * 4, v * 4) * 9 + fold(u * 8, v * 8) * 3;
    const a = Math.pow(amp(u * 4, v * 4), 1.6);
    H[y * N + x] = Math.sin(ph) * a;
  }
  const { c, ctx } = canvas2d(N);
  const img = ctx.createImageData(N, N);
  const d = img.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const l = H[y * N + ((x - 1 + N) % N)], r = H[y * N + ((x + 1) % N)];
    const t = H[((y - 1 + N) % N) * N + x], b = H[((y + 1) % N) * N + x];
    const nx = Math.max(-1, Math.min(1, (l - r) * 2.2)), ny = Math.max(-1, Math.min(1, (t - b) * 2.2));
    const i = (y * N + x) * 4;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255;
    d[i + 2] = fbm(dirt, x / N, y / N) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.name = 'soldat:falten';
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

/* ------------------------------------------------------------------ Detail-Satz (Fotoscan oder Ersatz) */

/** Aktueller Stoff-Detailsatz für alle Soldatenmaterialien. kind: 'prozedural' | 'fotoscan'. */
const DETAIL = { normal: null, orm: null, aoMean: 0.8, kind: 'prozedural', tier: 0, id: null };
function detail() {
  if (!DETAIL.normal) {
    DETAIL.normal = weaveNormal();
    DETAIL.orm = weaveOrm();
    DETAIL.aoMean = DETAIL.orm.userData.aoMean || 0.8;
  }
  return DETAIL;
}

/** Zustand des Stoff-Detailsatzes (Prüfseiten/Diagnose). */
export function soldierDetailInfo() {
  const D = detail();
  return { kind: D.kind, tier: D.tier, id: D.id, aoMean: +D.aoMean.toFixed(3), loading: !!upgrading && D.kind !== 'fotoscan' };
}

/* ------------------------------------------------------------------ Material */

const VERT_HEAD = /* glsl */`
attribute vec4 aNp;
attribute vec4 aNq;
attribute float aNo;
varying vec4 vNp;
flat varying vec4 vNq;
varying vec3 vNpPos;
varying vec2 vNpUv;
flat varying vec2 vNpUvF;
varying float vNpAo;
varying vec3 vNpAlbA;
varying vec3 vNpAlbB;
varying vec3 vNpN;
uniform vec3 uPal[ 10 ];
`;
const FRAG_HEAD = /* glsl */`
varying vec3 vNpAlbA;
varying vec3 vNpAlbB;
varying vec4 vNp;
flat varying vec4 vNq;
varying vec3 vNpPos;
varying vec2 vNpUv;
flat varying vec2 vNpUvF;
varying float vNpAo;
uniform float uCamoFacet;
uniform vec2 uFacet;
uniform vec3 uPal[ 10 ];
uniform vec3 uCamo[ 4 ];
uniform vec4 uCls[ 6 ];
uniform float uCamoScale;
uniform sampler2D uNpOrm;
uniform vec3 uNpDetail;
#ifndef NP_LOW
uniform sampler2D uNpMacro;
uniform float uNpMacroStr;
uniform vec3 uDust;
uniform float uDustAmt;
#endif
uniform float uDissolve;
uniform float uRim;
uniform float uRimPow;
uniform float uRimTint;
uniform vec3 uRimColor;
uniform float uLightFloor;
uniform float uAmbRef;
varying vec3 vNpN;
// mensch3: Dreiseiten-Projektion (Bindepose, Meter) – Tarnmuster/Gewebe ohne Verzerrung an Schulterkuppen und Stiefeln
vec3 npTriW( vec3 n ) { vec3 w = pow( abs( n ), vec3( 6.0 ) ); return w / ( w.x + w.y + w.z + 1e-5 ); }
vec4 npTri( sampler2D t, vec3 p, vec3 w, float sc ) {
	return texture2D( t, p.zy * sc ) * w.x + texture2D( t, p.xz * sc ) * w.y + texture2D( t, p.xy * sc ) * w.z;
}
// Bildschirm-Ableitungs-Relief (Höhe in Metern) → Normale (wie three.js bumpmap, ohne Textur)
vec3 npBump( vec3 n, float h, vec3 vp ) {
	vec3 dpx = dFdx( vp ), dpy = dFdy( vp );
	float dhx = dFdx( h ), dhy = dFdy( h );
	vec3 r1 = cross( dpy, n ), r2 = cross( n, dpx );
	float det = dot( dpx, r1 );
	vec3 g = sign( det ) * ( dhx * r1 + dhy * r2 );
	vec3 nn = normalize( abs( det ) * n - g );
	return ( any( isnan( nn ) ) || abs( det ) < 1e-14 ) ? n : nn;
}
#ifndef NP_LOW
// Nähte (Bindepose): Hosen-Seitennaht und Schrittnaht, Schulter-, Armloch-, Ärmel- und Passennaht. → x Abstand zur Nahtlinie (m),
// y Lauf entlang der Naht (m), z Gewicht (0 = keine Naht in der Nähe)
vec3 npSeamAt( vec3 p, vec3 n ) {
	float ax = abs( p.x );
	vec3 r = vec3( 1.0, 0.0, 0.0 );
	if ( p.y < 0.965 && p.y > 0.12 ) {
		// Bein: Außen- und Innennaht in der Seitenebene (z ≈ −0,006), Schrittnaht mittig
		float ins = step( ax, 0.1 );
		r = vec3( p.z + 0.006, p.y, 1.0 - ins * smoothstep( 0.8, 0.88, p.y ) );
		if ( p.y > 0.84 && ax < 0.05 ) r = vec3( p.x, p.y + p.z, smoothstep( 0.84, 0.88, p.y ) );
	} else if ( p.y > 1.37 && ax < 0.205 && ax > 0.065 && n.y > 0.25 ) {
		r = vec3( p.z - 0.004, ax, 1.0 ); // Schulternaht oben
	} else if ( p.y > 1.3 && ax > 0.17 ) {
		r = vec3( ax - 0.19, p.y + p.z, smoothstep( 1.3, 1.36, p.y ) ); // Armloch (Ärmelansatz)
	} else if ( p.y > 0.98 && p.y < 1.3 && ax > 0.17 && ax < 0.235 ) {
		r = vec3( p.z - 0.03, p.y, 0.8 ); // Ärmelnaht innen-hinten
	} else if ( p.y > 1.36 && p.y < 1.5 && ax < 0.17 && n.z > 0.35 ) {
		r = vec3( p.y - 1.43, p.x, 1.0 ); // Rückenpasse
	}
	return r;
}
#endif
`;

// Albedo: Palette/Vertexfarbe × Tarnmuster × Stoff-Kavität × Teil-Streuung, dann Staub (untere Beine) + Abnutzung
const ALBEDO = /* glsl */`
	int sdCls = int( vNq.y + 0.5 );
	vec4 sdC = uCls[ sdCls ];
	vec2 sdUvD = vNpUv * sdC.x;
	// 21.10.: Farbe je Ecke aufgeteilt in einfarbigen (A) und Tarnmuster-Anteil (B) → Übergänge zwischen Stoffbereichen
	// (Hemd ↔ Tarnärmel, Sturmhaube ↔ Kragen) linear und ohne Aufhellung, ohne Zacken an Dreieckskanten
	vec3 sdAlb = vNpAlbA + vNpAlbB;
	if ( vNp.x > 0.004 ) {
		// Video-Look: Tarnfarbe je Fläche (flache UV der Dreiecksecke) gemischt mit dem durchlaufenden Muster
		// mensch3: Stoff am Körper in Dreiseiten-Projektion (Schulterkuppen/Gesäß verzerrten die Zylinderabwicklung); Ausrüstung
		// (Kastenflächen) behält ihre UV
		vec3 sdM = sdCls == 0 ? npTri( map, vNpPos, npTriW( vNpN ), uCamoScale ).rgb : texture2D( map, vNpUv * uCamoScale ).rgb;
		vec3 sdCam = mix( uCamo[ 0 ], uCamo[ 1 ], sdM.r );
		sdCam = mix( sdCam, uCamo[ 2 ], sdM.g );
		sdCam = mix( sdCam, uCamo[ 3 ], sdM.b );
		sdAlb = vNpAlbA + vNpAlbB * sdCam;
	}
	// Gewebe-Kavität: Stoff/Leder ebenfalls dreiseitig (keine Streifen auf Stiefelkappe und Schultern)
	vec3 sdTw = npTriW( vNpN );
	vec3 sdOrm = ( sdCls == 0 || sdCls == 4 ) ? npTri( uNpOrm, vNpPos, sdTw, sdC.x ).rgb : texture2D( uNpOrm, sdUvD ).rgb;
	// Verzerrung der UV gegenüber der Fläche (Pole/Streckung) → dort keine UV-Detailnormale
	float sdUvOk = 1.0;
	{
		vec2 ux = dFdx( vNpUv ), uy = dFdy( vNpUv );
		vec3 qx = dFdx( vNpPos ), qy = dFdy( vNpPos );
		float rx = length( ux ) / max( length( qx ), 1e-7 ), ry = length( uy ) / max( length( qy ), 1e-7 );
		sdUvOk = smoothstep( 0.3, 0.65, min( rx, ry ) / max( max( rx, ry ), 1e-6 ) ) * smoothstep( 0.25, 0.5, min( rx, ry ) );
	}
	float sdSeamH = 0.0;
	#ifndef NP_LOW
	// Nähte: Rille, aufgeworfener Stoff daneben, Doppelsteppnaht (Strichel) – nur Stoff
	if ( sdCls == 0 && vNp.y > 0.3 ) {
		vec3 sm = npSeamAt( vNpPos, vNpN );
		if ( sm.z > 0.0 && abs( sm.x ) < 0.012 ) {
			float d = abs( sm.x ), fw = max( fwidth( sm.x ), 1e-5 );
			float groove = exp( -( d * d ) / ( 0.0011 * 0.0011 ) );
			float puff = exp( -pow( ( d - 0.0032 ) / 0.0022, 2.0 ) );
			float dash = smoothstep( 0.15, 0.3, fract( sm.y / 0.0036 ) ) * smoothstep( 0.85, 0.7, fract( sm.y / 0.0036 ) );
			float line = 1.0 - smoothstep( 0.00045, 0.00045 + fw * 1.5, abs( d - 0.0052 ) );
			float vis = sm.z * ( 1.0 - smoothstep( 0.0006, 0.0025, fw ) ); // aus der Ferne nur die Rille
			sdSeamH = sm.z * ( -0.0007 * groove + 0.00035 * puff ) + line * dash * vis * 0.00022;
			sdAlb *= 1.0 - 0.28 * groove * sm.z;
			float lumS = dot( sdAlb, vec3( 0.3, 0.59, 0.11 ) );
			sdAlb = mix( sdAlb, sdAlb * 1.25 + vec3( 0.025 ) + lumS * 0.2, line * dash * vis * 0.7 );
		}
	}
	#endif
	float sdDet = sdC.z * vNp.y;
	sdAlb *= mix( 1.0, clamp( sdOrm.r * uNpDetail.x, 0.5, 1.3 ), sdDet );
	sdAlb *= 0.95 + vNq.w * ( 0.1 / 255.0 );
	sdAlb *= mix( 1.0, vNpAo, 0.3 ); // Kontaktschatten auch im direkten Licht (Schattenkarten lösen Falten/Taschen nicht auf)
	float sdDust = 0.0;
	#ifndef NP_LOW
		// mensch3: Leder (Stiefel) mit stetiger Raumabbildung – die Kasten-UV der Stiefel sprang je Dreieck (Staub als Zacken-Streifen)
		vec3 sdMac = texture2D( uNpMacro, sdCls == 4 ? vec2( vNpPos.x * 1.7 + vNpPos.z * 1.3, vNpPos.y * 2.3 + vNpPos.z * 0.9 ) : vNpUv * vec2( 1.7, 2.3 ) ).rgb;
		float sdN = sdMac.b;
		sdDust = ( 1.0 - smoothstep( 0.03, 0.6, vNpPos.y ) ) * uDustAmt * ( 0.4 + 1.2 * sdN );
		sdDust += vNq.z * ( 1.0 / 255.0 ) * smoothstep( 0.35, 0.75, sdN ) * 0.45;
		// mensch3: Knie (vorn) und Ellbogen/Unterarme tragen Schmutz der Karte (Knien, Abstützen)
		sdDust += uDustAmt * ( 0.2 + 0.8 * sdN ) * ( exp( -pow( ( vNpPos.y - 0.5 ) / 0.06, 2.0 ) ) * smoothstep( 0.0, -0.6, vNpN.z ) * step( vNpPos.y, 0.9 ) * 0.8
			+ exp( -pow( ( vNpPos.y - 1.2 ) / 0.09, 2.0 ) ) * step( 0.17, abs( vNpPos.x ) ) * 0.35 );
		sdDust = clamp( sdDust, 0.0, 0.65 ) * step( 0.5, sdC.y + sdC.z );
		// 20.11.: Leder/Gummi (Stiefel, Handschuhe) nimmt Staub nur als Hauch in Rillen/Kanten an – vorher wurden dunkle Stiefel
		// mit dem halben Staubton überzogen und wirkten grau-beige; Stoff behält den vollen Staub an Knien/Hosenbeinen
		sdDust *= sdCls == 4 ? 0.18 : 1.0; // mensch3: 0,3 → 0,18 (Stiefel wirkten grau)
		sdAlb = mix( sdAlb, sdAlb * 0.6 + uDust * 0.4, sdDust );
		// gfx-soldat: Kantenabrieb + Einfassnaht an Ausrüstung/Leder/Hartteilen aus der Flächenkrümmung (abgerundete Kanten
		// der Taschen, Platten, Stiefel): Kante heller/entsättigt, knapp innen eine dunkle Naht-/Einfasslinie
		if ( sdCls == 1 || sdCls == 3 || sdCls == 4 ) {
			float sdCurv = length( fwidth( normalize( vNormal ) ) ) / max( length( fwidth( vViewPosition ) ), 1e-5 );
			float sdEdge = smoothstep( 35.0, 140.0, sdCurv ) * ( 0.35 + 0.65 * sdN ) * ( 0.45 + vNq.z * ( 0.55 / 255.0 ) );
			float sdSeam = smoothstep( 10.0, 22.0, sdCurv ) * ( 1.0 - smoothstep( 28.0, 55.0, sdCurv ) );
			float sdLumA = dot( sdAlb, vec3( 0.3, 0.59, 0.11 ) );
			sdAlb = mix( sdAlb, mix( vec3( sdLumA ), sdAlb, 0.6 ) * 1.35 + 0.015, sdEdge * ( sdCls == 3 ? 0.25 : sdCls == 4 ? 0.1 : 0.42 ) ); // 20.11.: Leder kaum (Stiefel-Facetten lasen sich als helle Streifen)
			sdAlb *= 1.0 - sdSeam * ( sdCls == 1 ? 0.22 : 0.1 );
		}
	#endif
	diffuseColor.rgb *= sdAlb;
`;

const ROUGH = /* glsl */`
	float sdShine = vNp.w;
	float roughnessFactor = mix( mix( roughness, 0.32, sdShine ), sdOrm.g * uNpDetail.z, sdC.w * vNp.y );
	roughnessFactor = min( 1.0, roughnessFactor + sdDust * 0.2 );
	if ( sdCls == 4 ) roughnessFactor = max( roughnessFactor, 0.86 ); // 20.11.: Leder/Rauleder matt
`;

// Weiche Normalen (Stoff fällt rund), harte Ausrüstung behält einen Hauch Kante (uFacet.y), Stoff fast keine (uFacet.x)
const NORMAL = /* glsl */`
#ifdef USE_NORMALMAP_TANGENTSPACE
	vec3 mapN = texture2D( normalMap, sdUvD ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale * ( sdC.y * vNp.y * uNpDetail.y ) * ( sdCls == 4 ? 0.0 : sdCls == 0 ? sdUvOk : 1.0 ); // Leder: Kasten-UV der Stiefel springt je Dreieck → Relief nur aus der Raumabbildung
	#ifndef NP_LOW
		// grobe Stofffalten nur auf Stoff (Uniform und Zivilkleidung); mensch3: an Knie, Ellbogen, Schritt und Kniekehle kräftiger
		float sdJ = exp( -pow( ( vNpPos.y - 0.5 ) / 0.075, 2.0 ) ) * step( vNpPos.y, 0.9 )
			+ exp( -pow( ( vNpPos.y - 1.24 ) / 0.07, 2.0 ) ) * step( 0.16, abs( vNpPos.x ) )
			+ exp( -pow( ( vNpPos.y - 0.9 ) / 0.05, 2.0 ) ) * step( abs( vNpPos.x ), 0.13 ) * 0.7;
		vec2 sdW = ( sdMac.rg * 2.0 - 1.0 ) * uNpMacroStr * step( float( sdCls ), 0.5 ) * ( max( vNp.x, 0.2 * vNp.y ) + ( vNp.x + 0.6 * vNp.y ) * 1.1 * sdJ );
		mapN.xy += sdW;
	#endif
	vec3 sdFn = normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) );
	vec3 sdBase = normalize( mix( sdCls == 4 ? normalize( vNormal ) : tbn[ 2 ], sdFn, ( sdCls == 0 || sdCls == 4 ) ? uFacet.x : uFacet.y ) ); // mensch3: Leder (Stiefel) ohne Kantenanteil
	normal = normalize( sdBase * mapN.z + tbn * vec3( mapN.xy, 0.0 ) );
	// Schutz: entartete UV-Ableitungen (Kuppen, Nähte) → unendlicher Tangentenrahmen → Ersatz ohne Detailnormale
	if ( any( isnan( normal ) ) || any( isinf( normal ) ) ) normal = normalize( mix( vNormal, sdFn, 0.0 ) );
	// mensch3: Nähte + Gewebe-Kavität als Relief, wo die UV-Detailnormale wegfällt (Pole, Stiefelkappe)
	{
		float sdH = sdSeamH;
		if ( sdCls == 0 || sdCls == 4 ) sdH += ( sdOrm.r - 0.7 ) * 0.00035 * ( sdCls == 4 ? 1.0 : 1.0 - sdUvOk ) * vNp.y;
		if ( sdH != 0.0 ) normal = npBump( normal, sdH, -vViewPosition );
	}
#endif
`;

// Randlicht + Lichtboden relativ zum örtlichen Umgebungslicht (Innenräume/Belichtungsautomatik)
const RIM = /* glsl */`
	float sdLum = max( dot( diffuseColor.rgb * ( 1.0 - metalnessFactor ), vec3( 0.2126, 0.7152, 0.0722 ) ), 0.02 );
	float sdAmb = clamp( dot( reflectedLight.indirectDiffuse, vec3( 0.2126, 0.7152, 0.0722 ) ) / sdLum * uAmbRef, 0.06, 1.25 );
	float sdRim = 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
	vec3 sdRimCol = mix( diffuseColor.rgb * 0.6 + vec3( 0.05, 0.055, 0.06 ), uRimColor * 0.5, uRimTint );
	outgoingLight += sdRimCol * pow( sdRim, uRimPow ) * uRim * sdAmb;
	outgoingLight = max( outgoingLight, diffuseColor.rgb * uLightFloor * min( sdAmb, 1.0 ) );
`;

/**
 * Staub/Schmutz an Stiefeln, Hosenbeinen und Knien je Karte (sol 15.11.): Farbe (linear) und Menge passend zum Boden –
 * Schlamm im Niemandsland, Asche im Brandwald, heller Kalkstaub in der Altstadt, Betonstaub im Hafen/Werk/Flugplatz.
 */
const DUST = {
  standard: [[0.36, 0.32, 0.26], 0.45],
  hafen: [[0.3, 0.29, 0.27], 0.4], werk: [[0.27, 0.26, 0.24], 0.45], flugplatz: [[0.34, 0.33, 0.3], 0.38],
  altstadt: [[0.5, 0.44, 0.34], 0.5], stadtkern: [[0.33, 0.32, 0.3], 0.4], bibliothek: [[0.36, 0.33, 0.28], 0.3],
  grenzland: [[0.26, 0.21, 0.14], 0.55], niemandsland: [[0.2, 0.15, 0.1], 0.7], brandwald: [[0.13, 0.12, 0.11], 0.6],
};
let dustCur = DUST.standard;
/** Karte setzen (BotManager beim Erzeugen): Staubfarbe/-menge aller Soldatenmaterialien. */
export function setSoldierWorld(world) {
  const id = world && (world.id || (world.def && world.def.id));
  dustCur = DUST[id] || DUST.standard;
  const apply = (m) => { const U = m.userData.npU; if (!U) return; U.uDust.value.setRGB(...dustCur[0]); U.uDustAmt.value = dustCur[1]; };
  for (const m of live) apply(m);
  for (const pool of pools.values()) for (const m of pool) apply(m);
}

/** Soldatenmaterialien je Schema × Qualität: freie Exemplare (Pool) + alle lebenden (für den Texturtausch). */
const pools = new Map();
const live = new Set();
const POOL_MAX = 48;

function linColor(hex) { return new THREE.Color(hex); } // three.Color.set(hex) wandelt sRGB → linear

function schemeUniforms(sc) {
  const pal = PAL_KEYS.map((k) => (k === 'skin' ? linColor(SKIN_TONES[0]) : k ? linColor(sc[k]) : new THREE.Color(1, 1, 1)));
  const camo = sc.camo.map(linColor);
  return { pal, camo };
}

function newMaterial(schemeId, low) {
  const sc = SCHEMES[schemeId] || SCHEMES.A;
  const D = detail();
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: camoMaskTexture(sc.pattern),
    normalMap: D.normal,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.75,
    // 21.10.: weiche Normalen statt flacher Dreiecke (wirkte kantig/„Skelett“); Kantenanteil steuert uFacet
    flatShading: false,
  });
  m.name = 'soldier:' + schemeId;
  const { pal, camo } = schemeUniforms(sc);
  const U = (m.userData.npU = {
    uPal: { value: pal },
    uCamo: { value: camo },
    uCls: { value: CLASS_PARAMS.map((p) => new THREE.Vector4(p[0], p[1], p[2], p[3])) },
    uCamoScale: { value: 2.2 }, // Tarnmuster-Kachel ≈ 45 cm (Splitter wie im Video)
    uCamoFacet: { value: 0 }, // 21.10.: Muster nicht mehr je Dreieck einfrieren (las sich als kantige Dreiecke)
    uFacet: { value: new THREE.Vector2(0.0, 0.08) }, // Kantenanteil der Schattierung: Stoff, Ausrüstung (sol: Ausrüstung jetzt gerundet → kaum Kante)
    uNpOrm: { value: D.orm },
    uNpDetail: { value: new THREE.Vector3(1 / D.aoMean, 1, D.kind === 'fotoscan' ? 1.0 : 1.0) },
    uNpMacro: { value: wrinkleTexture() },
    uNpMacroStr: { value: 0.55 },
    uDust: { value: new THREE.Color(...dustCur[0]) },
    uDustAmt: { value: dustCur[1] },
    uDissolve: { value: 0 },
    uDissolveColor: { value: new THREE.Color(0x0b0b0b) },
    // Randlicht: Verbündete dezent, Gegner kräftiger und zur Teamfarbe getönt (Silhouette auch im Schatten)
    // 21.10.: schmaler und kaum getönt – der breite rote Saum färbte die ganze Uniform rosa (las sich wie nackte Haut)
    uRim: { value: sc.hostile ? 0.7 : 0.45 },
    uRimPow: { value: sc.hostile ? 3 : 3 },
    uRimTint: { value: sc.hostile ? 0.12 : 0 },
    uRimColor: { value: linColor(sc.accent) },
    // Mindesthelligkeit (Anteil der Albedo): Gegner „versinken“ nicht im tiefen Schatten; im Licht ohne Wirkung
    uLightFloor: { value: sc.hostile ? 0.4 : 0 },
    // Bezug des Umgebungslichts: Umgebungsleuchtdichte/Albedo ≈ 1/uAmbRef gilt als „volles“ Außenlicht
    uAmbRef: { value: 2.4 },
  });
  // Rückwärtskompatibel (Prüfstand/Altcode): userData.uDissolve etc.
  m.userData.uDissolve = U.uDissolve;
  m.userData.uRim = U.uRim;
  m.userData.uLightFloor = U.uLightFloor;
  m.userData.soldier = true;
  m.userData.scheme = schemeId;
  m.userData.low = low;
  if (low) m.defines = { NP_LOW: '' };
  m.onBeforeCompile = (shader) => {
    for (const k of Object.keys(U)) shader.uniforms[k] = U[k];
    shader.vertexShader = VERT_HEAD + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvNp = aNp;\n\tvNq = aNq;\n\tvNpPos = position;\n\tvNpUv = uv;\n\tvNpUvF = uv;\n\tvNpN = normal;\n\tvNpAo = aNo;\n\tint sdPalV = int( aNq.x + 0.5 );\n\tvec3 sdAlbV = sdPalV > 0 ? uPal[ sdPalV ] * color.rgb * 2.0 : color.rgb;\n\tvNpAlbA = sdAlbV * ( 1.0 - aNp.x );\n\tvNpAlbB = sdAlbV * aNp.x;');
    let fs = FRAG_HEAD + shader.fragmentShader;
    fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
	float sdDis = 0.0;
	if ( uDissolve > 0.0 ) {
		vec3 q = floor( vNpPos * 34.0 );
		sdDis = fract( sin( dot( q, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ) * 0.85 + fract( vNpPos.y * 1.7 ) * 0.15;
		if ( sdDis < uDissolve ) discard;
	}`);
    fs = fs.replace('#include <map_fragment>', ALBEDO);
    fs = fs.replace('#include <color_fragment>', '');
    fs = fs.replace('#include <roughnessmap_fragment>', ROUGH);
    fs = fs.replace('#include <metalnessmap_fragment>', `
	float metalnessFactor = metalness + smoothstep( 0.72, 1.0, sdShine ) * 0.75;`);
    fs = fs.replace('#include <normal_fragment_maps>', NORMAL);
    fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	totalEmissiveRadiance += diffuseColor.rgb * vNp.z * 2.2;
	if ( uDissolve > 0.0 && sdDis < uDissolve + 0.035 ) totalEmissiveRadiance += vec3( 1.0, 0.36, 0.08 ) * 0.6;`);
    // gebackene Umgebungsverdeckung (Vertex) auf Umgebungslicht und -spiegelung
    fs = fs.replace('#include <aomap_fragment>', `#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= vNpAo;
	reflectedLight.indirectSpecular *= mix( 1.0, vNpAo, 0.75 ) * ( sdCls == 4 ? 0.45 : 1.0 ); // Leder: kaum Himmelsspiegelung
	// 20.11.: Haut (Hände, Hals, Kopf der fernen Stufen): Streulicht-Näherung wie face.js – Licht dringt rötlich ein, Schatten-
	// kanten weicher/wärmer (ohne Textur, ohne zusätzlichen Sampler)
	if ( sdCls == 2 ) {
		reflectedLight.directDiffuse *= vec3( 1.1, 0.97, 0.93 );
		reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3( 0.16, 0.05, 0.03 ) * ( 0.4 + 0.6 * vNpAo );
	}`);
    fs = fs.replace('#include <opaque_fragment>', `${RIM}
	#include <opaque_fragment>`);
    shader.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'np-soldier-14' + (low ? 'l' : 'h');
  return m;
}

/**
 * Soldatenmaterial (eigenes Exemplar je Soldat, aus dem Pool): gleiche Shaderprogramme für alle, je Exemplar eigene
 * Uniforms (Auflösen der Leiche ohne Materialwechsel). Freigeben mit releaseSoldierMaterial().
 * opts.quality: 'low' → Telefonvariante (ohne Falten/Staub-Textur), sonst volle Variante.
 * opts.dissolve: veraltet (Auflösen läuft über material.userData.uDissolve desselben Materials).
 */
export function soldierMaterial(schemeId, { quality = 'high' } = {}) {
  const low = quality === 'low';
  const key = (SCHEMES[schemeId] ? schemeId : 'A') + ':' + (low ? 'l' : 'h');
  const pool = pools.get(key);
  let m = pool && pool.length ? pool.pop() : null;
  if (!m) { m = newMaterial(SCHEMES[schemeId] ? schemeId : 'A', low); m.userData.poolKey = key; }
  m.userData.npU.uDissolve.value = 0;
  syncDetail(m);
  live.add(m);
  return m;
}

/** Material zurück in den Pool (GPU-Programm bleibt gebunden → eine Revanche kompiliert nichts neu). */
export function releaseSoldierMaterial(m) {
  if (!m || !m.userData || !m.userData.poolKey) return;
  live.delete(m);
  m.userData.npU.uDissolve.value = 0;
  let pool = pools.get(m.userData.poolKey);
  if (!pool) { pool = []; pools.set(m.userData.poolKey, pool); }
  if (pool.length < POOL_MAX && !pool.includes(m)) pool.push(m);
  else m.dispose();
}

/** Material auf den aktuellen Detailsatz bringen (Normalmap/ORM des Stoffs). */
function syncDetail(m) {
  const D = detail();
  const U = m.userData.npU;
  if (U.uNpOrm.value !== D.orm) U.uNpOrm.value = D.orm;
  U.uNpDetail.value.x = 1 / D.aoMean;
  if (m.normalMap !== D.normal) { m.normalMap = D.normal; m.needsUpdate = true; }
}

let upgrading = null;
let upgradingTier = 0;

/**
 * Fotoscan-Aufwertung (Hintergrund; Fehler still → prozedurale Ersatztexturen bleiben): lädt `fabric_uniform`
 * (Normalen + ORM; 512 auf low, sonst 1024) aus der CC0-Bibliothek und tauscht die Texturen aller Soldatenmaterialien.
 * Kosten: low ≈ 0,09 MB Download / 0,35 MB GPU, sonst ≈ 0,33 MB / 1,4 MB. → Promise<bool>
 */
export function upgradeSoldierMaterials(renderer, quality = 'high') {
  const tier = Math.min(1024, tierFor(quality, 'texture'));
  // einmal je Stufe; eine höhere Stufe (z. B. low → high im Einstellungsmenü) lädt nach, eine niedrigere nicht
  if (upgrading && upgradingTier >= tier) return upgrading;
  upgradingTier = tier;
  upgrading = (async () => {
    try {
      if (!assets.renderer && renderer) assets.setRenderer(renderer);
      if (!assets.renderer) return false;
      await assets.ready();
      if (!(await assets.transcoderReady())) return false;
      const set = await assets.loadTextureSet('fabric_uniform', tier);
      // eigene Klone (teilen die GPU-Daten), Wiederholung 1 – der Shader skaliert selbst je Materialklasse
      const normal = set.normalMap.clone();
      const orm = set.ormMap.clone();
      for (const t of [normal, orm]) { t.repeat.set(1, 1); t.offset.set(0, 0); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; }
      DETAIL.normal = normal;
      DETAIL.orm = orm;
      DETAIL.aoMean = (set.meta && set.meta.stats && set.meta.stats.avgAO) || 0.7;
      DETAIL.kind = 'fotoscan';
      DETAIL.tier = set.tier;
      DETAIL.id = 'fabric_uniform';
      for (const m of live) syncDetail(m);
      for (const pool of pools.values()) for (const m of pool) syncDetail(m);
      return true;
    } catch (err) {
      if (typeof console !== 'undefined') console.info('[bots] Fotoscan-Stoff nicht verfügbar – prozedural.', err && err.message);
      return false;
    }
  })();
  return upgrading;
}

/** Alles freigeben (Verlassen des Spiels). */
export function disposeSoldierMaterials() {
  for (const pool of pools.values()) for (const m of pool) m.dispose();
  pools.clear();
  for (const m of live) m.dispose();
  live.clear();
  for (const t of texCache.values()) if (t && t.isTexture) t.dispose();
  texCache.clear();
  DETAIL.normal = DETAIL.orm = null;
  DETAIL.kind = 'prozedural';
  upgrading = null;
  upgradingTier = 0;
}
