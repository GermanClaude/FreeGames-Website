// Oberflächen-Baukasten der Waffen ohne eigenen Foto-Atlas (14.11.2026, Nutzer: „Grafik ist das Allerwichtigste, auch bei
// Waffen“ – alle Waffen sollen auf Nahdistanz so echt wirken wie KV-47, Adler, M-17). Die Foto-Waffen haben je Bauteil einen
// Atlas mit Gravuren, Kratzern und Kantenabrieb; die übrigen Waffen (Gruppen A/B/C, Werfer, Nahkampf, Granaten) liegen mit
// Kachel-UVs (builder.js boxUV: 1 UV = 0,2 m, Seitenflächen U = Waffenlänge) auf geteilten Materialien. Hier entsteht je
// Oberflächen-Familie ein kachelnder Detail-Satz in echtem Maßstab (Kantenlänge L in mm):
//   orm    R = Tönung bzw. blanke Stelle (≤ 0,7: Helligkeit, 0,35 = neutral; > 0,7: bis aufs Grundmetall durchgerieben/zerkratzt –
//          materials.js wearPatch mischt dort die Abriebfarbe ein), G = Rauheit (relativ, 0,7 = Materialwert), B = Metall (relativ)
//   normal Feinstruktur aus einem Höhenfeld in mm (Erodierstruktur, Phosphatkristalle, Stippling, Fischhaut, Schleifriefen, Poren)
//   map    nur Holz: Farbe (Maserung, Poren, Markstrahlen)
// Familien: poly (glasfaserverstärkter Spritzguss), stipple (Griff-Stippling), checker (Fischhaut), knurl (Rändel), park
// (parkerisiert/phosphatiert), blued (brüniert), anod (hart eloxiert), cera (Keramikbeschichtung/Lack), bolt (geschliffener,
// geölter Verschluss), blade (satinierter Klingenstahl), rubber (Gummi), woodWalnut/woodWarm (Holz unter Lack).
// Speicher: Kantenlänge nach Detailstufe (setKitTier: max 1024², std 512², Handy 256²; Familien mit kleiner Kachel die Hälfte, s. sizeOf) –
// je Familie ≈ 2,8 MB (PC hoch/ultra) bzw. 0,7 MB (mittel), zwei Karten (Holz drei),
// nur Familien, die eine gebaute Waffe benutzt. Die Bot-Stufe (lodMetal/lodMatte) bekommt keine Karten.
// Gezeichnet wird zeitgeteilt im Hintergrund (textures.js scheduleAtlas): erst ein neutraler Platzhalter, dann die volle Karte.
import * as THREE from 'three';
import { canvas, toTexture, scheduleAtlas, rng, fbm } from './textures.js?v=20261119182451';

const PC = !(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
export const KIT_SIZE = { max: 1024, std: 512, lite: 256 };
/** Nennwert der Rauheitskarte (G): Material-Rauheit = gewünschte Rauheit / KIT_R. */
export const KIT_R = 0.7;
let tier = PC ? 'max' : 'lite';
const kits = new Map();

// Kantenlänge L (mm), Zufallssaat, Stärke der Normalen (Gradient mm/mm → Neigung)
const SPEC = {
  poly: { L: 48, seed: 11, n: 1.0 },
  stipple: { L: 32, seed: 12, n: 1.5 },
  checker: { L: 25.6, seed: 13, n: 0.75 },
  knurl: { L: 12.8, seed: 14, n: 0.8 },
  park: { L: 40, seed: 15, n: 1.0 },
  blued: { L: 64, seed: 16, n: 1.0 },
  anod: { L: 40, seed: 17, n: 1.0 },
  cera: { L: 64, seed: 18, n: 1.0 },
  bolt: { L: 48, seed: 19, n: 1.0 },
  blade: { L: 48, seed: 20, n: 1.0 },
  rubber: { L: 24, seed: 21, n: 1.0 },
  woodWalnut: { L: 160, seed: 22, n: 1.0, wood: [[0.31, 0.19, 0.11], [0.17, 0.09, 0.05], [0.4, 0.26, 0.15]] },
  woodWarm: { L: 160, seed: 23, n: 1.0, wood: [[0.45, 0.21, 0.1], [0.29, 0.12, 0.06], [0.55, 0.3, 0.16]] },
};

// ---------------------------------------------------------------- Feld-Helfer (kachelnd, Index i = y · S + x)
const wrap = (v, S) => ((v % S) + S) % S;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Weißes Rauschen, mit Radius rad (px) weichgezeichnet → 0…1 um 0,5. */
function grain(S, r, rad = 1) {
  let a = new Float32Array(S * S);
  for (let i = 0; i < a.length; i++) a[i] = r();
  if (rad > 0) a = boxBlur(a, S, rad);
  let lo = 1, hi = 0;
  for (let i = 0; i < a.length; i++) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); }
  const k = 1 / Math.max(1e-6, hi - lo);
  for (let i = 0; i < a.length; i++) a[i] = (a[i] - lo) * k;
  return a;
}

function boxBlur(a, S, rad) {
  const R = Math.max(1, Math.round(rad)), n = 2 * R + 1, t = new Float32Array(S * S), o = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    let s = 0; const row = y * S;
    for (let k = -R; k <= R; k++) s += a[row + wrap(k, S)];
    for (let x = 0; x < S; x++) { t[row + x] = s / n; s += a[row + wrap(x + R + 1, S)] - a[row + wrap(x - R, S)]; }
  }
  for (let x = 0; x < S; x++) {
    let s = 0;
    for (let k = -R; k <= R; k++) s += t[wrap(k, S) * S + x];
    for (let y = 0; y < S; y++) { o[y * S + x] = s / n; s += t[wrap(y + R + 1, S) * S + x] - t[wrap(y - R, S) * S + x]; }
  }
  return o;
}

/** Kachelndes Wolkenrauschen mit Strukturgröße f (mm) längs, fy quer (Standard gleich). */
const cloud = (S, L, f, seed, oct = 3, fy = f) => fbm(S, S, { seed, octaves: oct, period: Math.max(1, Math.round(L / f)), periodY: Math.max(1, Math.round(L / fy)), gain: 0.5 });

// Linie (Kratzer, Riefe) mit Kantenglättung, Ende ausgeblendet; je Pixel höchstens einmal (Maximum der Deckung) → fn(i, w, t)
const touched = new Map();
function stroke(S, x, y, ang, len, wid, bend, fn) {
  touched.clear();
  const hw = wid / 2, reach = Math.ceil(hw + 1);
  let a = ang;
  const n = Math.max(1, Math.round(len));
  for (let s = 0; s < n; s++) {
    const t = (s + 0.5) / n, fade = Math.sqrt(Math.max(0, Math.sin(Math.PI * t)));
    const nx = -Math.sin(a), ny = Math.cos(a);
    for (let o = -reach; o <= reach; o++) {
      const cov = clamp01(hw + 0.5 - Math.abs(o)) * fade;
      if (cov <= 0.01) continue;
      const i = wrap(Math.round(y + ny * o), S) * S + wrap(Math.round(x + nx * o), S);
      const prev = touched.get(i);
      if (!prev || prev[0] < cov) touched.set(i, [cov, t]);
    }
    x += Math.cos(a); y += Math.sin(a); a += bend;
  }
  for (const [i, [w, t]] of touched) fn(i, w, t);
}

/** Scheibe (Grube, Delle) um (cx, cy) mit Radius rad (px) → fn(i, d) mit d = Abstand/Radius (0…1). */
function disc(S, cx, cy, rad, fn) {
  const R = Math.ceil(rad + 1), ix = Math.floor(cx), iy = Math.floor(cy);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(ix + dx + 0.5 - cx, iy + dy + 0.5 - cy) / Math.max(rad, 0.5);
    if (d < 1) fn(wrap(iy + dy, S) * S + wrap(ix + dx, S), d);
  }
}

// Kratzer-Gruppen: n Kratzer, Länge (mm), Breite (mm), Richtung (Winkel, Streuung), Wirkung fn(i, w)
function scratches(F, n, { len = [2, 20], wid = [0.03, 0.08], ang = 0, spread = Math.PI, bend = 0.004 }, fn) {
  const { S, ppm, r } = F;
  for (let k = 0; k < n; k++) {
    const l = (len[0] + (len[1] - len[0]) * r() * r()) * ppm, w = Math.max(0.35, (wid[0] + (wid[1] - wid[0]) * r()) * ppm);
    const a = ang + (r() - 0.5) * 2 * spread + (r() < 0.5 ? 0 : spread > 1 ? 0 : Math.PI);
    stroke(S, r() * S, r() * S, a, l, w, (r() - 0.5) * bend, fn);
  }
}

// Phosphat-/Strahlkorn-Zellen (Worley): je Pixel Zelle (id), Abstand zum Kern (f1) und zur Nachbarzelle (f2 − f1), in Zellgrößen
function* cells(S, cpx, r) {
  const G = Math.max(2, Math.round(S / cpx)), c = S / G;
  const px = new Float32Array(G * G), py = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) { px[i] = r(); py[i] = r(); }
  const id = new Int32Array(S * S), f1 = new Float32Array(S * S), edge = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const gx = Math.floor(x / c), gy = Math.floor(y / c);
    let d1 = 1e9, d2 = 1e9, best = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox, cy = gy + oy, k = wrap(cy, G) * G + wrap(cx, G);
      const d = Math.hypot((cx + px[k]) * c - x - 0.5, (cy + py[k]) * c - y - 0.5) / c;
      if (d < d1) { d2 = d1; d1 = d; best = k; } else if (d < d2) d2 = d;
    }
    const i = y * S + x; id[i] = best; f1[i] = d1; edge[i] = d2 - d1;
    if (x === S - 1 && (y & 127) === 127) yield;
  }
  return { id, f1, edge, n: G * G };
}

// ---------------------------------------------------------------- Familien
// F = { S, L, ppm (px je mm), r (Zufall), h (Höhe mm), tone (−0,5…0,5), bare (0…1), rough (relativ, 1 = Materialwert), metal (relativ) }
const KINDS = {
  // Glasfaserverstärkter Spritzguss: Erodierstruktur (feine Grübchen), Fließlinien, Glasfaser-Sprenkel, helle Schrammen, Griffglanz
  *poly(F) {
    const { S, L, ppm, r, h, tone, rough } = F;
    const g = grain(S, r, Math.max(0, 0.08 * ppm)), g2 = grain(S, r, Math.max(0, 0.25 * ppm));
    for (let i = 0; i < g.length; i++) { h[i] += (g[i] - 0.5) * 0.008 + (g2[i] - 0.5) * 0.02; rough[i] += (g[i] - 0.5) * 0.1; }
    yield;
    const pits = Math.round(L * L * 2.5);
    for (let k = 0; k < pits; k++) {
      const rad = (0.06 + r() * 0.1) * ppm, dep = 0.002 + r() * 0.003;
      disc(S, r() * S, r() * S, rad, (i, d) => { h[i] -= dep * (1 - d * d); });
    }
    yield;
    const flow = cloud(S, L, 24, F.seed + 1, 3, 3), patch = cloud(S, L, 14, F.seed + 2, 4), hand = cloud(S, L, 20, F.seed + 3, 3);
    for (let i = 0; i < S * S; i++) {
      tone[i] += (flow[i] - 0.5) * 0.09 + (patch[i] - 0.5) * 0.07;
      rough[i] += (flow[i] - 0.5) * 0.08;
      const gl = clamp01((hand[i] - 0.58) * 4);   // abgegriffen: glatter, minimal dunkler
      rough[i] -= gl * 0.22; tone[i] -= gl * 0.03;
    }
    yield;
    // Glasfasern an der Oberfläche: kurze, helle Härchen in allen Richtungen
    for (let k = 0; k < L * L * 0.9; k++) stroke(S, r() * S, r() * S, r() * Math.PI * 2, (0.15 + r() * 0.3) * ppm, Math.max(0.35, 0.02 * ppm), 0, (i, w) => { tone[i] += w * 0.05; });
    // Schrammen-Büschel (Kunststoff wird weißlich und rau) und einzelne lange Kratzer
    for (let c = 0; c < 18; c++) {
      const x0 = r() * S, y0 = r() * S, a = r() * Math.PI, n = 4 + (r() * 10 | 0), sp = (0.6 + r() * 2.5) * ppm;
      for (let k = 0; k < n; k++) stroke(S, x0 + (r() - 0.5) * sp, y0 + (r() - 0.5) * sp, a + (r() - 0.5) * 0.12, (1 + r() * 7) * ppm, Math.max(0.35, (0.03 + r() * 0.06) * ppm), 0, (i, w) => { tone[i] += w * 0.16; rough[i] += w * 0.14; h[i] -= w * 0.004; });
    }
    scratches(F, 12, { len: [8, 40], wid: [0.05, 0.11], ang: 0, spread: 0.35 }, (i, w) => { tone[i] += w * 0.2; rough[i] += w * 0.1; h[i] -= w * 0.008; });
  },
  // Griff-Stippling (Lötkolben-Krater, dicht überlappend): Staub in den Kratern, Grate von Händen geglättet
  *stipple(F) {
    const { S, L, ppm, r, h, tone, rough } = F;
    const dep = new Float32Array(S * S);
    const n = Math.round(L * L * 4.2);
    for (let k = 0; k < n; k++) {
      const rad = (0.32 + r() * 0.3) * ppm, d0 = 0.07 + r() * 0.06;
      disc(S, r() * S, r() * S, rad, (i, d) => { const v = d0 * (1 - d * d) ** 0.7; if (v > dep[i]) dep[i] = v; });
    }
    yield;
    const g = grain(S, r, Math.max(0, 0.03 * ppm));
    for (let i = 0; i < S * S; i++) {
      const d = dep[i] / 0.13;
      h[i] = -dep[i] + (g[i] - 0.5) * 0.01;
      tone[i] += -0.16 * d + 0.06 * (1 - d) + (g[i] - 0.5) * 0.05;
      rough[i] += 0.08 * d - 0.16 * clamp01(1 - d * 3);
    }
  },
  // Fischhaut (Schnitt 20 Linien je Zoll, Rauten 37°): Pyramiden mit leicht abgegriffenen Spitzen, Schmutz in den Rillen
  *checker(F) {
    const { S, r, h, tone, rough } = F;
    const g = grain(S, r, 1);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p1 = ((x * 16 + y * 12) / S) % 1, p2 = ((x * 16 - y * 12) / S % 1 + 1) % 1;
      const t1 = 1 - Math.abs(2 * p1 - 1), t2 = 1 - Math.abs(2 * p2 - 1), t = Math.min(t1, t2);
      const i = y * S + x, top = clamp01((t - 0.72) * 5);
      h[i] = Math.min(t, 0.8 + (g[i] - 0.5) * 0.15) * 0.42;
      tone[i] += -0.2 * (1 - clamp01(t * 3)) + 0.07 * top;
      rough[i] += 0.1 * (1 - clamp01(t * 3)) - 0.18 * top;
    }
  },
  // Rändel (Kreuzrändel 45°): Spitzen blank, Rillen geölt dunkel
  *knurl(F) {
    const { S, h, tone, rough, bare } = F;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p1 = ((x + y) * 8 / S) % 1, p2 = (((x - y) * 8 / S) % 1 + 1) % 1;
      const t = Math.min(1 - Math.abs(2 * p1 - 1), 1 - Math.abs(2 * p2 - 1)), i = y * S + x;
      h[i] = Math.min(t, 0.85) * 0.35;
      tone[i] -= 0.25 * (1 - clamp01(t * 3));
      bare[i] = clamp01((t - 0.8) * 6) * 0.7;
      rough[i] += -0.25 * clamp01((t - 0.75) * 5) + 0.1 * (1 - clamp01(t * 3));
    }
  },
  // Parkerisiert (Mangan-/Zinkphosphat): Kristallkorn mit funkelnden Facetten, fleckige Tönung, Ölfilm, hellgraue Kratzer
  *park(F) {
    const { S, L, ppm, r, h, tone, rough, bare } = F;
    const C = yield* cells(S, 0.17 * ppm, r), ct = new Float32Array(C.n), cr = new Float32Array(C.n);
    for (let k = 0; k < C.n; k++) { ct[k] = r() - 0.5; cr[k] = r() < 0.06 ? -0.35 : (r() - 0.5) * 0.25; }
    for (let i = 0; i < S * S; i++) {
      const e = clamp01(C.edge[i] * 3);
      h[i] += (1 - C.f1[i] * C.f1[i]) * 0.006 - (1 - e) * 0.004;
      tone[i] += ct[C.id[i]] * 0.1 - (1 - e) * 0.04;
      rough[i] += cr[C.id[i]];
    }
    yield;
    const mot = cloud(S, L, 9, F.seed + 1, 4), mot2 = cloud(S, L, 2.5, F.seed + 2, 2), oil = cloud(S, L, 16, F.seed + 3, 3);
    for (let i = 0; i < S * S; i++) {
      tone[i] += (mot[i] - 0.5) * 0.07 + (mot2[i] - 0.5) * 0.04;
      const o = clamp01((oil[i] - 0.6) * 3);
      rough[i] -= o * 0.16; tone[i] -= o * 0.03;
    }
    yield;
    scratches(F, Math.round(L * L / 140), { len: [1.5, 12], wid: [0.03, 0.08], ang: 0, spread: 0.5 }, (i, w) => { bare[i] = Math.max(bare[i], w * 0.5); rough[i] -= w * 0.25; h[i] -= w * 0.005; });
    scratches(F, Math.round(L * L / 30), { len: [0.4, 3], wid: [0.02, 0.04], spread: Math.PI }, (i, w) => { tone[i] += w * 0.16; rough[i] -= w * 0.12; });
  },
  // Brüniert (poliert, dann geschwärzt): feine Polierriefen längs, Bläuung ungleich dick (Wolken), wenige blanke Kratzer, Rostnarben
  *blued(F) {
    const { S, L, ppm, r, h, tone, rough, bare } = F;
    const rows = new Float32Array(S); for (let y = 0; y < S; y++) rows[y] = r();
    const rowS = boxBlur(Float32Array.from({ length: S * S }, (_, i) => rows[(i / S) | 0]), S, 0.6);
    const along = cloud(S, L, 30, F.seed + 1, 3, 1.2);
    for (let i = 0; i < S * S; i++) {
      const v = rowS[i] * 0.7 + along[i] * 0.3;
      h[i] += (v - 0.5) * 0.004;
      rough[i] += (v - 0.5) * 0.12;
    }
    yield;
    const blu = cloud(S, L, 12, F.seed + 2, 4), streak = cloud(S, L, 50, F.seed + 3, 3, 4);
    for (let i = 0; i < S * S; i++) {
      tone[i] += (blu[i] - 0.5) * 0.16 + (streak[i] - 0.5) * 0.1;
      rough[i] += (streak[i] - 0.5) * 0.1;
    }
    yield;
    scratches(F, Math.round(L * L / 160), { len: [3, 26], wid: [0.03, 0.07], ang: 0, spread: 0.3 }, (i, w) => { bare[i] = Math.max(bare[i], w * 0.7); rough[i] -= w * 0.2; h[i] -= w * 0.003; });
    scratches(F, Math.round(L * L / 40), { len: [0.4, 3], wid: [0.02, 0.04], spread: Math.PI }, (i, w) => { tone[i] += w * 0.3; });
    for (let k = 0; k < L * L / 60; k++) disc(S, r() * S, r() * S, (0.03 + r() * 0.06) * ppm, (i, d) => { tone[i] -= 0.3 * (1 - d); rough[i] += 0.25 * (1 - d); h[i] -= 0.01 * (1 - d * d); });
  },
  // Hart eloxiertes Aluminium: Strahlkorn, viele feine Mikrokratzer bis aufs silberne Alu, kleine Dellen mit blankem Grund
  *anod(F) {
    const { S, L, ppm, r, h, tone, rough, bare } = F;
    const g = grain(S, r, Math.max(0, 0.03 * ppm)), g2 = grain(S, r, Math.max(0, 0.08 * ppm));
    const mot = cloud(S, L, 10, F.seed + 1, 4);
    for (let i = 0; i < S * S; i++) {
      h[i] += (g[i] - 0.5) * 0.005 + (g2[i] - 0.5) * 0.004;
      rough[i] += (g[i] - 0.5) * 0.1;
      tone[i] += (mot[i] - 0.5) * 0.08 + (g2[i] - 0.5) * 0.03;
    }
    yield;
    scratches(F, Math.round(L * L / 40), { len: [0.6, 7], wid: [0.015, 0.045], spread: Math.PI }, (i, w) => { bare[i] = Math.max(bare[i], w * 0.5); rough[i] -= w * 0.3; h[i] -= w * 0.002; });
    for (let k = 0; k < 2; k++) {
      const rad = (0.4 + r() * 0.5) * ppm;
      disc(S, r() * S, r() * S, rad, (i, d) => { h[i] -= 0.02 * (1 - d * d); bare[i] = Math.max(bare[i], 0.35 * clamp01((0.7 - d) * 3)); rough[i] -= 0.15 * (1 - d); });
    }
  },
  // Keramikbeschichtung / Einbrennlack: Orangenhaut, feine Sprenkel, polierte Scheuerstellen, ein paar Lackabplatzer bis aufs Metall
  *cera(F) {
    const { S, L, ppm, r, h, tone, rough, bare } = F;
    const peel = cloud(S, L, 1.6, F.seed + 1, 2), g = grain(S, r, Math.max(0, 0.04 * ppm)), mot = cloud(S, L, 12, F.seed + 2, 4), scuff = cloud(S, L, 18, F.seed + 3, 3);
    for (let i = 0; i < S * S; i++) {
      h[i] += (peel[i] - 0.5) * 0.012 + (g[i] - 0.5) * 0.004;
      tone[i] += (mot[i] - 0.5) * 0.07 + (g[i] - 0.5) * 0.06;
      const s = clamp01((scuff[i] - 0.6) * 4);
      rough[i] += (g[i] - 0.5) * 0.06 - s * 0.25; tone[i] += s * 0.05;
    }
    yield;
    scratches(F, Math.round(L * L / 60), { len: [1, 10], wid: [0.03, 0.08], spread: Math.PI }, (i, w) => { tone[i] += w * 0.18; rough[i] -= w * 0.15; h[i] -= w * 0.004; });
    for (let k = 0; k < 5; k++) {
      const cx = r() * S, cy = r() * S, rad = (0.2 + r() * 0.7) * ppm;
      for (let j = 0; j < 4; j++) disc(S, cx + (r() - 0.5) * rad * 1.6, cy + (r() - 0.5) * rad, rad * (0.4 + r() * 0.6), (i, d) => { if (d < 0.85) { bare[i] = 1; h[i] -= 0.02; } else tone[i] -= 0.1; });
    }
  },
  // Verschluss/Lauf blank: Schleifriefen längs, Ölfilm, Schmauchschleier (dunkle Wolken), feine Kratzer
  *bolt(F) {
    const { S, L, r, h, tone, rough } = F;
    const rows = Float32Array.from({ length: S * S }, ((rv) => (_, i) => rv[(i / S) | 0])(Float32Array.from({ length: S }, () => r())));
    const rowS = boxBlur(rows, S, 0.6), along = cloud(S, L, 20, F.seed + 1, 3, 0.8);
    const soot = cloud(S, L, 14, F.seed + 2, 4, 6), oil = cloud(S, L, 16, F.seed + 3, 3);
    for (let i = 0; i < S * S; i++) {
      const v = rowS[i] * 0.6 + along[i] * 0.4;
      h[i] += (v - 0.5) * 0.006;
      rough[i] += (v - 0.5) * 0.25;
      const s = clamp01((soot[i] - 0.5) * 2.5);
      tone[i] -= s * 0.3; rough[i] += s * 0.15;
      const o = clamp01((oil[i] - 0.55) * 3);
      rough[i] -= o * 0.3;
    }
    yield;
    scratches(F, Math.round(L * L / 30), { len: [1, 12], wid: [0.02, 0.06], ang: 0, spread: 0.25 }, (i, w) => { tone[i] += w * 0.2; rough[i] -= w * 0.2; h[i] -= w * 0.003; });
  },
  // Satinierter Klingenstahl: gleichmäßige Schliffbahnen längs, leicht wellig, Handhabungskratzer quer
  *blade(F) {
    const { S, L, r, h, tone, rough } = F;
    const rows = Float32Array.from({ length: S * S }, ((rv) => (_, i) => rv[(i / S) | 0])(Float32Array.from({ length: S }, () => r())));
    const rowS = boxBlur(rows, S, 0.5), wav = cloud(S, L, 40, F.seed + 1, 2, 2), mot = cloud(S, L, 10, F.seed + 2, 3);
    for (let i = 0; i < S * S; i++) {
      const v = rowS[(wrap(((i / S) | 0) + Math.round((wav[i] - 0.5) * 6), S)) * S + (i % S)];
      h[i] += (v - 0.5) * 0.004;
      rough[i] += (v - 0.5) * 0.3;
      tone[i] += (mot[i] - 0.5) * 0.06;
    }
    yield;
    scratches(F, Math.round(L * L / 25), { len: [1, 10], wid: [0.02, 0.05], spread: Math.PI }, (i, w) => { rough[i] -= w * 0.25; tone[i] += w * 0.1; h[i] -= w * 0.002; });
  },
  // Gummi (Schaftkappe, Griffüberzug): matte Formhaut, feine Poren, glattgeriebene Stellen
  *rubber(F) {
    const { S, L, ppm, r, h, tone, rough } = F;
    const g = grain(S, r, Math.max(0, 0.06 * ppm)), c = cloud(S, L, 1.2, F.seed + 1, 2), w = cloud(S, L, 10, F.seed + 2, 3);
    for (let i = 0; i < S * S; i++) {
      h[i] += (g[i] - 0.5) * 0.02 + (c[i] - 0.5) * 0.012;
      const s = clamp01((w[i] - 0.6) * 4);
      tone[i] += (c[i] - 0.5) * 0.06 + s * 0.04;
      rough[i] += (g[i] - 0.5) * 0.06 - s * 0.2;
    }
    for (let k = 0; k < L * L * 0.6; k++) disc(S, r() * S, r() * S, (0.03 + r() * 0.05) * ppm, (i, d) => { h[i] -= 0.012 * (1 - d * d); tone[i] -= 0.08 * (1 - d); });
  },
};

// Holz unter Lack: Jahresringe gewellt, Faserrichtung längs (U), Poren als kurze dunkle Striche, Markstrahlen, Farbe als eigene Karte
function* woodKind(F, pal) {
  const { S, L, ppm, r, h, tone, rough } = F;
  const col = (F.col = new Float32Array(S * S * 3));
  const warp = cloud(S, L, 80, F.seed + 1, 3, 40), fib = cloud(S, L, 40, F.seed + 2, 3, 0.5), fib2 = cloud(S, L, 160, F.seed + 4, 2, 2.5), blot = cloud(S, L, 50, F.seed + 3, 3, 20);
  const rings = 15 + (r() * 4 | 0);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const g = Math.sin((y / S * rings + warp[i] * 1.3) * Math.PI * 2) * 0.5 + 0.5;
    const late = Math.pow(g, 4);   // Spätholz: dunklere, dichtere Bänder – flach geschnitten, daher schmal und gestreckt
    const t = clamp01(late * 0.32 + (fib[i] - 0.5) * 0.8 + (fib2[i] - 0.5) * 0.6 + 0.3);
    const b = blot[i];
    for (let k = 0; k < 3; k++) {
      let v = pal[0][k] * (1 - t) + pal[1][k] * t;
      v *= 0.86 + b * 0.28;
      if (b > 0.64) v += (pal[2][k] - v) * (b - 0.64) * 1.2;
      col[i * 3 + k] = v;
    }
    h[i] += (fib[i] - 0.5) * 0.006 - late * 0.004;
    rough[i] += late * 0.06;
  }
  yield;
  // Poren: kurze Striche längs der Faser, dunkel, rau (Lack sinkt ein)
  const n = Math.round(L * L * 0.9);
  for (let k = 0; k < n; k++) {
    const l = (0.3 + r() * 1.4) * ppm, w = Math.max(0.35, (0.05 + r() * 0.05) * ppm), dk = 0.55 + r() * 0.3;
    stroke(S, r() * S, r() * S, (r() - 0.5) * 0.06, l, w, 0, (i, c) => {
      const f = 1 - c * (1 - dk);
      col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f;
      h[i] -= c * 0.012; rough[i] += c * 0.15;
    });
  }
  // Markstrahlen: kurze, hellere Spiegel quer
  for (let k = 0; k < L * 1.5; k++) stroke(S, r() * S, r() * S, Math.PI / 2 + (r() - 0.5) * 0.3, (0.4 + r()) * ppm, Math.max(0.35, 0.08 * ppm), 0, (i, c) => { for (let q = 0; q < 3; q++) col[i * 3 + q] = col[i * 3 + q] * (1 - c * 0.25) + pal[2][q] * c * 0.25; });
  void tone;
}

// ---------------------------------------------------------------- Ausgabe
function* normalCanvas(h, S, mmpp, k) {
  const c = canvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  const s = k / (2 * mmpp);
  for (let y = 0; y < S; y++) {
    const ym = wrap(y - 1, S) * S, yp = wrap(y + 1, S) * S, row = y * S;
    for (let x = 0; x < S; x++) {
      const xm = wrap(x - 1, S), xp = wrap(x + 1, S);
      const nx = -(h[row + xp] - h[row + xm]) * s, ny = (h[yp + x] - h[ym + x]) * s;
      const l = 1 / Math.hypot(nx, ny, 1), i = (row + x) * 4;
      d[i] = (nx * l * 0.5 + 0.5) * 255; d[i + 1] = (ny * l * 0.5 + 0.5) * 255; d[i + 2] = (l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    if ((y & 255) === 255) yield;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function ormCanvas(F) {
  const { S, tone, bare, rough, metal } = F;
  const c = canvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  for (let i = 0; i < S * S; i++) {
    const R = bare[i] > 0.02 ? 0.7 + 0.3 * clamp01(bare[i]) : Math.min(0.69, Math.max(0, 0.35 + tone[i] * 0.7));
    d[i * 4] = R * 255;
    d[i * 4 + 1] = clamp01(rough[i] * KIT_R) * 255;
    d[i * 4 + 2] = clamp01(metal[i]) * 255;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function colCanvas(F) {
  const { S, col } = F, c = canvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  for (let i = 0; i < S * S; i++) { d[i * 4] = clamp01(col[i * 3]) * 255; d[i * 4 + 1] = clamp01(col[i * 3 + 1]) * 255; d[i * 4 + 2] = clamp01(col[i * 3 + 2]) * 255; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return c;
}

function* generate(kit, S) {
  const sp = SPEC[kit.kind], N = S * S;
  const F = { S, L: sp.L, ppm: S / sp.L, seed: sp.seed * 101, r: rng(sp.seed * 7919),
    h: new Float32Array(N), tone: new Float32Array(N), bare: new Float32Array(N), rough: new Float32Array(N).fill(1), metal: new Float32Array(N).fill(1), col: null };
  yield;
  if (sp.wood) yield* woodKind(F, sp.wood); else yield* KINDS[kit.kind](F);
  yield;
  if (kit.size !== S || kit.dead) return;   // inzwischen andere Stufe bzw. freigegeben
  const nC = yield* normalCanvas(F.h, S, sp.L / S, sp.n);
  yield;
  const oC = ormCanvas(F), cC = F.col ? colCanvas(F) : null;
  swap(kit, 'normal', nC); swap(kit, 'orm', oC); if (cC && kit.map) swap(kit, 'map', cC);
  kit.ready = S;
}

function swap(kit, name, c) {
  const list = kit.tex[name];
  for (const t of list) { if (t.image && t.image.width !== c.width) t.dispose(); t.image = c; t.needsUpdate = true; }
}

function placeholder(r, g, b) { const c = canvas(4, 4), x = c.getContext('2d'); x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, 4, 4); return c; }

// Kantenlänge je Familie: kleine Kacheln (≤ 64 mm) mit halber Größe – 512² auf 48 mm sind ≈ 0,1 mm je Texel, feiner als ein
// Bildpunkt der Ego-Ansicht (≈ 0,25 mm bei 1440p); nur Holz (160 mm) mit voller Größe
const sizeOf = (kind) => KIT_SIZE[tier] >> (SPEC[kind].L >= 100 ? 0 : 1);
function start(kit) {
  const S = sizeOf(kit.kind);
  if (kit.size === S) return;
  kit.size = S;
  if (kit.job) kit.job.cancel();
  kit.job = scheduleAtlas(generate(kit, S));
}

function getKit(kind) {
  let k = kits.get(kind);
  if (k) return k;
  const sp = SPEC[kind];
  if (!sp) throw new Error('Unbekannte Oberflächen-Familie: ' + kind);
  const rep = 200 / sp.L, aniso = PC ? 8 : 2;
  const mk = (c, srgb) => { const t = toTexture(c, { srgb, aniso }); t.repeat.set(rep, rep); return t; };
  k = { kind, size: 0, ready: 0, job: null, dead: false,
    tex: { orm: [mk(placeholder(89, 179, 255), false)], normal: [mk(placeholder(128, 128, 255), false)], map: sp.wood ? [mk(placeholder(...sp.wood[0].map((v) => v * 255 | 0)), true)] : null } };
  k.map = !!sp.wood;
  kits.set(kind, k);
  start(k);
  return k;
}

/**
 * Detail-Karten einer Familie: { orm, normal, map? } – geteilte Texturen; scale ≠ 1 liefert eigene Wiederholung
 * (feiner > 1, gröber < 1) als Klon desselben Bilds.
 */
export function kitMaps(kind, scale = 1) {
  const k = getKit(kind), rep = (200 / SPEC[kind].L) * scale;
  const pick = (name) => {
    const list = k.tex[name];
    if (!list) return null;
    let t = list.find((x) => Math.abs(x.repeat.x - rep) < 1e-6);
    if (!t) { t = list[0].clone(); t.repeat.set(rep, rep); t.needsUpdate = true; list.push(t); }
    return t;
  };
  return { orm: pick('orm'), normal: pick('normal'), map: pick('map') };
}

/** Detailstufe der Karten ('max' | 'std' | 'lite'): vorhandene Familien werden im Hintergrund in neuer Größe gezeichnet. */
export function setKitTier(t) {
  if (!KIT_SIZE[t] || t === tier) return;
  tier = t;
  for (const k of kits.values()) start(k);
}

/** Alle Karten freigeben (disposeWeaponModels). */
export function disposeKits() {
  for (const k of kits.values()) { k.dead = true; if (k.job) k.job.cancel(); for (const l of Object.values(k.tex)) if (l) l.forEach((t) => t.dispose()); }
  kits.clear();
}

/** Prüfwerkzeuge: Familien mit Größe/Fertigstand. */
export function kitStats() { return [...kits.values()].map((k) => ({ kind: k.kind, size: k.size, ready: k.ready, textures: Object.values(k.tex).reduce((n, l) => n + (l ? l.length : 0), 0) })); }
