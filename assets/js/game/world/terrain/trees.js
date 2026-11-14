// NULLPUNKT — Prozedurale Bäume, Büsche und Farne (Owner: world, Strang „baeume“ 14.11.).
//
// Jede Art (Eiche, Buche, Birke, Linde, Pappel, Fichte, Kiefer, abgestorben) wächst aus einem festen Startwert als
// echtes Astgerüst: Stamm mit Wurzelanlauf (Brettwurzeln) und Krümmung, Hauptäste nach Phyllotaxis, Seitenäste, alle
// sich verjüngend und je Art nach oben strebend bzw. hängend (Birke). Das Laub sind viele kleine Zweigkarten
// (≈ 0,7–1,6 m, längs leicht geknickt → Volumen auch von der Seite) an den äußeren Abschnitten der Seitenäste – keine
// großen Kronenkarten mehr. Zweigtexturen: Atlas assets/lib/foliage/baeume.webp (4 × 4 Zellen, aus CC0-Blattscans von
// Poly Haven zusammengesetzt, siehe CREDITS.md und tools-Notiz im Bericht): je Laubart zwei Zweigvarianten, Fichten-
// und Kiefernzweig, Totholzzweig, Farnwedel und acht Rindenstreifen für die Mittelstufe.
//
// Stufen (LOD) je Baum, Übergänge mit Bildschirm-Dithering (komplementär, kein Aufploppen):
//   nah    volles Gerüst (Rinde als Fotoscan je Art, KTX2, Moos an der Wetterseite) + dichtes Laub
//   mittel grobes Gerüst + weniger, größere Karten, EIN Material (Rinde aus den Atlas-Streifen) → 1 Draw Call je Variante
//   fern   Mehrwinkel-Impostor (8 Ansichten je Variante, aus dem Mittelmodell beim Laden gerendert: Albedo × AO und
//          Normalen in Baum-Koordinaten) → alle fernen Bäume in EINEM Draw Call, Licht/Schatten wie im Spiel.
// Laub-Shading: kugelige Kronennormalen (von der Kronenmitte nach außen, beidseitig gleich), Selbstverschattung als
// Vertexfarbe (innen/unten dunkler), Durchscheinen im Gegenlicht (eigener RE_Direct-Wrapper: Licht von hinten durch
// das Blatt, mit Schatten), Wind: Stamm schwankt, Äste/Blätter flattern (atlas.js WIND_VERTEX, gleiche Uhr wie Gras).
// Schatten: Laub mit Alpha-Test UND Wind im Schattenpass (customDepthMaterial) → Schatten passt zur Krone.
//
// Kollision bleibt unverändert in vegetation.js (Stamm-Prismen, auf allen Stufen gleich – Mehrspieler).
import * as THREE from 'three';
import { foliageUniforms, WIND_VERTEX } from '../atlas.js?v=20261114060746';
import { addShaderPatch, copyShaderPatches } from '../shading.js?v=20261114060746';
import { rng } from './noise.js?v=20261114060746';

const TAU = Math.PI * 2;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// Arten
// ---------------------------------------------------------------------------
// H Höhe (m bei Maßstab 1), R0 Stammradius in Brusthöhe, flare Wurzelanlauf, leader Anteil der Höhe, bis zu dem der
// Stamm durchgeht, base Kronenansatz (Anteil), limbs Hauptäste, ang [oben, unten] Abstand vom Lot (Grad), limb Länge
// (Anteil der Höhe), up Aufwärtsstreben der Äste (negativ = hängend), sub Abstand der Seitenäste (m), card Kartengröße
// (m), step Kartenabstand (m), cells Atlaszellen, bark Spielmaterial (engine/textures.js), strip Rindenstreifen im
// Atlas, vScale Rinden-UV längs (Satz nicht quadratisch), tint Instanzfarben (× Atlas), mossK Moos.
export const TREE_SPECIES = {
  eiche:  { H: 12.5, R0: 0.27, flare: 0.55, leader: 0.55, base: 0.26, limbs: 7, ang: [48, 82], limb: 0.5, up: 0.22, sub: 0.75, card: 1.25, step: 0.42, cells: [0, 1], bark: 'bark_eiche', strip: 0, vScale: 0.5, tint: ['#f2f2e6', '#e2e8d6', '#fff8e4'], tile: 1, mossK: 1.0, bend: 0.2, crownR: 5.2 },
  buche:  { H: 13.5, R0: 0.25, flare: 0.35, leader: 0.82, base: 0.3, limbs: 8, ang: [32, 62], limb: 0.42, up: 0.35, sub: 0.7, card: 1.2, step: 0.4, cells: [2, 3], bark: 'bark_buche', strip: 1, vScale: 1, tint: ['#f6faea', '#e8f0dc', '#fffbe8'], tile: 1.7, mossK: 0.6, bend: 0.22, crownR: 4.6 },
  birke:  { H: 13.0, R0: 0.19, flare: 0.25, leader: 0.94, base: 0.32, limbs: 9, ang: [28, 55], limb: 0.3, up: -0.25, sub: 0.6, card: 1.0, step: 0.36, cells: [4, 5], bark: 'bark_birke', strip: 2, vScale: 1, tint: ['#fafae8', '#eef2dc', '#fff6dc'], tile: 1.7, mossK: 0.25, bend: 0.3, crownR: 3.4, droop: 0.55 },
  linde:  { H: 12.5, R0: 0.26, flare: 0.4, leader: 0.72, base: 0.24, limbs: 8, ang: [38, 70], limb: 0.44, up: 0.3, sub: 0.68, card: 1.3, step: 0.4, cells: [6, 7], bark: 'bark', strip: 3, vScale: 1, tint: ['#f0f4e4', '#e4ecd8', '#fbfae6'], tile: 1, mossK: 0.8, bend: 0.22, crownR: 4.8 },
  pappel: { H: 16.0, R0: 0.25, flare: 0.3, leader: 0.97, base: 0.18, limbs: 11, ang: [14, 32], limb: 0.22, up: 0.5, sub: 0.55, card: 1.15, step: 0.38, cells: [8, 9], bark: 'bark_pappel', strip: 4, vScale: 1, tint: ['#eef2e6', '#e0e8dc', '#f6f6ea'], tile: 1, mossK: 0.5, bend: 0.32, crownR: 2.6 },
  fichte: { conifer: true, H: 12.5, R0: 0.22, flare: 0.3, leader: 1, base: 0.07, R: 2.7, card: 1.05, step: 0.32, cells: [10, 10], bark: 'bark_fichte', strip: 5, vScale: 1, tint: ['#e8eee6', '#dce4da', '#f0f2ea'], tile: 1, mossK: 0.6, bend: 0.26, crownR: 2.8 },
  kiefer: { conifer: true, pine: true, H: 13.5, R0: 0.22, flare: 0.25, leader: 0.93, base: 0.55, limbs: 10, ang: [35, 62], limb: 0.25, up: 0.3, sub: 0.55, card: 1.5, step: 0.35, cells: [11, 11], bark: 'bark_kiefer', strip: 6, vScale: 1, tint: ['#eef2e2', '#e4e8d6', '#f6f4e4'], tile: 2, mossK: 0.3, bend: 0.24, crownR: 3.4 },
  tot:    { dead: true, H: 11.5, R0: 0.25, flare: 0.5, leader: 0.6, base: 0.3, limbs: 6, ang: [40, 78], limb: 0.42, up: 0.18, sub: 0.9, card: 1.4, step: 0.9, cells: [12, 12], bark: 'bark', barkTint: '#8c8378', strip: 7, vScale: 1, tint: ['#ffffff', '#ece6e0'], tile: 1, mossK: 1.2, bend: 0.12, crownR: 4.4 },
};
/** Spielmaterialien der Rinden (bigworld lädt ihre Bibliothekssätze vor dem Aufbau). */
export const TREE_BARKS = ['bark_eiche', 'bark_buche', 'bark_birke', 'bark_pappel', 'bark_kiefer', 'bark_fichte'];
/** Arten der Altkategorien (vegetation.js platziert 'laub'/'fichte'; welche Art es wird, entscheidet ein Hash). */
export const DEFAULT_MIX = {
  laub: [['buche', 0.3], ['eiche', 0.24], ['linde', 0.16], ['birke', 0.16], ['pappel', 0.08], ['tot', 0.06]],
  fichte: [['fichte', 0.74], ['kiefer', 0.26]],
};

/** LOD-Abstände je Stufe (m): nah bis near, mittel bis mid, Impostor bis zur Fernsichtweite; Bänder = Überblendung. */
export const TREE_LOD = {
  // low (Handy): keine Nahstufe – das Mittelmodell gilt ab 0 m (weniger Draw Calls/Dreiecke als die alten Kartenkronen)
  low: { near: 0, mid: 30, bandN: 0, bandM: 8, variants: 1, imp: [64, 128], midLod: 2 },
  medium: { near: 18, mid: 70, bandN: 5, bandM: 10, variants: 1, imp: [96, 192] },
  high: { near: 28, mid: 105, bandN: 6, bandM: 12, variants: 2, imp: [128, 256] },
  ultra: { near: 34, mid: 150, bandN: 7, bandM: 14, variants: 2, imp: [128, 256] },
};

// ---------------------------------------------------------------------------
// Atlas
// ---------------------------------------------------------------------------
const ATLAS_URL = { hi: '../../../../lib/foliage/baeume.webp', lo: '../../../../lib/foliage/baeume-1k.webp' };
let atlasTex = null, atlasKey = '', atlasP = null;
const placeholder = (() => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); t.needsUpdate = true; t.name = 'baeume-platzhalter'; return t; })();
const leafMats = new Set();

/** Baum-Atlas laden (Stufe low: 1024², sonst 2048²). Materialien bekommen ihn, sobald er da ist. → Promise<Texture|null> */
export function loadTreeAtlas(quality = 'high') {
  const key = quality === 'low' ? 'lo' : 'hi';
  if (atlasKey === key && atlasP) return atlasP;
  atlasKey = key;
  atlasP = new THREE.TextureLoader().loadAsync(new URL(ATLAS_URL[key], import.meta.url).href).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.name = 'baeume-atlas'; t.userData.keep = true;
    const old = atlasTex; atlasTex = t;
    for (const m of leafMats) { m.map = t; m.needsUpdate = true; }
    if (old && old !== t) old.dispose();
    return t;
  }).catch((err) => { console.warn('[baeume] Atlas', err?.message || err); return null; });
  return atlasP;
}
/** UV-Rechteck einer Atlaszelle (4 × 4, Zelle 0 oben links) mit kleinem Rand. */
function cellUV(cell) {
  const cx = cell % 4, cy = Math.floor(cell / 4), e = 0.004;
  return { u0: cx * 0.25 + e, u1: (cx + 1) * 0.25 - e, v0: 1 - (cy + 1) * 0.25 + e, v1: 1 - cy * 0.25 - e };
}

// ---------------------------------------------------------------------------
// Geometrie-Sammler
// ---------------------------------------------------------------------------
class Builder {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.W = []; this.S = []; this.I = []; }
  v(p, n, u, v, c, w0, w1, strip = -1) {
    this.P.push(p.x, p.y, p.z); this.N.push(n.x, n.y, n.z); this.U.push(u, v); this.C.push(c, c, c); this.W.push(w0, w1); this.S.push(strip);
    return this.P.length / 3 - 1;
  }
  tri(a, b, c) { this.I.push(a, b, c); }
  get count() { return this.P.length / 3; }
  geometry(strip = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.W, 2));
    if (strip) g.setAttribute('aStrip', new THREE.Float32BufferAttribute(this.S, 1));
    g.setIndex(this.P.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// ---------------------------------------------------------------------------
// Gerüst
// ---------------------------------------------------------------------------
/** Ast: Mittellinie (Punkte), Radien, Ebene, Länge. */
function makeBranch(pts, r0, r1, lvl, rx = null) {
  let len = 0; const acc = [0];
  for (let i = 1; i < pts.length; i++) { len += pts[i].distanceTo(pts[i - 1]); acc.push(len); }
  const R = rx || acc.map((a) => r0 + (r1 - r0) * Math.pow(a / Math.max(len, 1e-4), 0.85));
  return { pts, R, acc, len, lvl };
}
function pointAt(b, t, out = new THREE.Vector3()) {
  const d = t * b.len; let i = 1;
  while (i < b.acc.length - 1 && b.acc[i] < d) i++;
  const a = b.acc[i - 1], c = b.acc[i], f = c > a ? (d - a) / (c - a) : 0;
  return out.copy(b.pts[i - 1]).lerp(b.pts[i], Math.min(1, Math.max(0, f)));
}
function dirAt(b, t, out = new THREE.Vector3()) {
  const d = t * b.len; let i = 1;
  while (i < b.acc.length - 1 && b.acc[i] < d) i++;
  return out.subVectors(b.pts[i], b.pts[i - 1]).normalize();
}
function radiusAt(b, t) {
  const d = t * b.len; let i = 1;
  while (i < b.acc.length - 1 && b.acc[i] < d) i++;
  const a = b.acc[i - 1], c = b.acc[i], f = c > a ? (d - a) / (c - a) : 0;
  return b.R[i - 1] + (b.R[i] - b.R[i - 1]) * f;
}
/** Gebogene Linie: Start, Richtung, Länge, Schritte, Aufwärtsstreben je m, Rauschen. */
function curve(r, start, dir, len, n, up, wob, droopTip = 0) {
  const pts = [start.clone()], d = dir.clone().normalize(), p = start.clone();
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n;
    d.y += (up - droopTip * t * t) * (len / n) * 0.35;
    d.x += (r() - 0.5) * wob; d.z += (r() - 0.5) * wob; d.y += (r() - 0.5) * wob * 0.5;
    d.normalize();
    p.addScaledVector(d, len / n); pts.push(p.clone());
  }
  return pts;
}
/** Senkrechte zu d mit Winkel az (stabil). */
function perp(d, az, out) {
  const a = Math.abs(d.y) < 0.9 ? _up : _v.set(1, 0, 0);
  const x = _w.crossVectors(d, a).normalize(), y = new THREE.Vector3().crossVectors(d, x);
  return out.copy(x).multiplyScalar(Math.cos(az)).addScaledVector(y, Math.sin(az));
}

/** Astgerüst einer Art (deterministisch aus seed). → { branches, cc (Kronenmitte), crownR, H } */
function skeleton(sp, seed) {
  const r = rng(seed * 7919 + 13), H = sp.H * (0.94 + r() * 0.12), branches = [];
  // Stamm: von −0,4 m (im Boden) bis leader·H, leichte Neigung und Krümmung
  const lean = new THREE.Vector3((r() - 0.5) * 0.08, 1, (r() - 0.5) * 0.08).normalize();
  const tn = 10, trunkPts = [];
  const Ht = H * sp.leader, ph = r() * TAU;
  for (let i = 0; i <= tn; i++) {
    const t = i / tn, y = -0.4 + (Ht + 0.4) * t;
    const sway = Math.sin(t * 3.1 + ph) * 0.12 * t + Math.sin(t * 7.3 + ph * 2) * 0.03;
    trunkPts.push(new THREE.Vector3(lean.x * y + Math.cos(ph) * sway, y, lean.z * y + Math.sin(ph) * sway));
  }
  const tipR = sp.conifer && !sp.pine ? 0.025 : sp.dead ? 0.09 : 0.05;
  const trunk = makeBranch(trunkPts, 0, 0, 0, trunkPts.map((p, i) => {
    const t = i / tn; return Math.max(tipR, sp.R0 * 1.06 * Math.pow(1 - t * (1 - tipR / sp.R0), 1.15));
  }));
  branches.push(trunk);
  if (sp.conifer && !sp.pine) {
    // Fichte: Astquirle bis fast zum Boden, unten länger und hängend, oben kurz und aufwärts
    let y = H * sp.base, k = 0;
    while (y < H - 0.5) {
      const u = y / H, n = 4 + ((r() * 3) | 0);
      for (let j = 0; j < n; j++) {
        const az = (j / n) * TAU + k * 0.7 + r() * 0.4, el = (95 - 45 * u + (r() - 0.5) * 12) * Math.PI / 180;
        const L = Math.max(0.35, sp.R * Math.pow(1 - u, 0.95) * (0.82 + r() * 0.3));
        const tp = trunkPts.findIndex((p) => p.y >= y); const o = trunkPts[Math.max(0, tp)].clone(); o.y = y;
        const d = new THREE.Vector3(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
        const pts = curve(r, o, d, L, 3, 0.25 * (1 - u) + 0.1, 0.12, 0.45 * (1 - u));
        branches.push(makeBranch(pts, Math.min(0.06, 0.012 + L * 0.02), 0.008, 1));
      }
      y += 0.5 + r() * 0.2; k++;
    }
  } else {
    // Hauptäste (Phyllotaxis) ab Kronenansatz; Länge nach Kronenform (unten weit, oben kurz)
    const nL = sp.limbs, y0 = H * sp.base, y1 = Ht * (sp.leader > 0.9 ? 0.96 : 1.0);
    for (let i = 0; i < nL; i++) {
      const u = nL > 1 ? i / (nL - 1) : 0.5, y = y0 + (y1 - y0) * u + (r() - 0.5) * 0.4;
      const tt = (y + 0.4) / (Ht + 0.4), o = pointAt(trunk, Math.min(0.99, tt));
      const az = i * 2.39996 + r() * 0.6;
      const elDeg = sp.ang[1] - (sp.ang[1] - sp.ang[0]) * u + (r() - 0.5) * 10, el = elDeg * Math.PI / 180;
      const env = sp.leader > 0.9 ? (1 - 0.7 * Math.pow(u, 1.4)) : (1 - 0.55 * Math.pow(u, 1.6));
      const L = sp.limb * H * env * (0.82 + r() * 0.36) * (sp.dead && r() < 0.35 ? 0.5 : 1);
      const d = new THREE.Vector3(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
      const rStart = Math.min(radiusAt(trunk, tt) * 0.78, 0.04 + L * 0.03);
      const pts = curve(r, o, d, L, 6, sp.up, 0.22, sp.droop || 0);
      const limb = makeBranch(pts, rStart, 0.02, 1);
      branches.push(limb);
      // Seitenäste
      const nS = Math.max(2, Math.round(L / sp.sub));
      for (let j = 0; j < nS; j++) {
        const t = 0.22 + 0.74 * (j + r() * 0.5) / nS, so = pointAt(limb, t), ld = dirAt(limb, t);
        const sd = perp(ld, r() * TAU, new THREE.Vector3());
        sd.y = Math.abs(sd.y) * 0.6 + sd.y * 0.4; // eher seitlich/aufwärts
        const ang = (35 + r() * 25) * Math.PI / 180;
        const dd = ld.clone().multiplyScalar(Math.cos(ang)).addScaledVector(sd.normalize(), Math.sin(ang)).normalize();
        const SL = Math.max(0.7, (L * (1 - t) * 0.75 + 0.6) * (0.7 + r() * 0.5));
        const spts = curve(r, so, dd, SL, 4, sp.up * 0.8, 0.3, (sp.droop || 0) * 1.6);
        branches.push(makeBranch(spts, Math.min(radiusAt(limb, t) * 0.7, 0.012 + SL * 0.018), 0.008, 2));
      }
    }
    // Wipfeltrieb über dem Stammende (Laubbäume mit kurzem Leittrieb)
    if (sp.leader < 0.9 && !sp.dead) {
      for (let k = 0; k < 3; k++) {
        const az = k * 2.1 + r(), d = new THREE.Vector3(Math.cos(az) * 0.45, 1, Math.sin(az) * 0.45);
        const L = H * (1 - sp.leader) * (0.8 + r() * 0.3);
        branches.push(makeBranch(curve(r, trunkPts[tn], d, L, 4, 0.2, 0.25), tipR * 0.9, 0.01, 1));
      }
    }
  }
  // Kronenmitte/-radius aus den Astspitzen
  const cc = new THREE.Vector3(); let n = 0;
  for (const b of branches) if (b.lvl > 0) { cc.add(b.pts[b.pts.length - 1]); n++; }
  if (n) cc.divideScalar(n); else cc.set(0, H * 0.6, 0);
  cc.x *= 0.5; cc.z *= 0.5;
  let cr = 0.5; for (const b of branches) if (b.lvl > 0) cr = Math.max(cr, Math.hypot(b.pts[b.pts.length - 1].x - cc.x, b.pts[b.pts.length - 1].z - cc.z));
  return { branches, cc, crownR: cr, H, Ht, r };
}

// ---------------------------------------------------------------------------
// Holz (Röhren mit Meter-UVs, Wurzelanlauf)
// ---------------------------------------------------------------------------
function tube(B, br, segs, sp, H, opts) {
  const { strip = -1, flare = 0, rootPh = 0 } = opts;
  const n = br.pts.length, rings = [];
  const C0 = TAU * br.R[0], size = sp.tile || 1; // Rinde: UV in Metern (Bibliothekssatz kachelt je sizeM = tile)
  // Umfangskacheln: Stamm ganzzahlig (nahtlos), dünne Äste anteilig (Naht unsichtbar klein)
  const tiles = strip >= 0 ? 1 : C0 > 0.6 ? Math.max(1, Math.round(C0 / size)) : Math.max(0.25, C0 / size);
  const T = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), P = new THREE.Vector3(), N = new THREE.Vector3();
  let prevX = null;
  for (let i = 0; i < n; i++) {
    const p = br.pts[i];
    if (i < n - 1) T.subVectors(br.pts[i + 1], p); else T.subVectors(p, br.pts[i - 1]);
    T.normalize();
    // Rahmen ohne Verdrehung (Parallelverschiebung)
    if (!prevX) { X.copy(Math.abs(T.y) < 0.9 ? _up : _v.set(1, 0, 0)).cross(T).normalize(); }
    else { X.copy(prevX).addScaledVector(T, -prevX.dot(T)).normalize(); }
    prevX = X.clone(); Y.crossVectors(T, X);
    const ring = [], r = br.R[i];
    const y = p.y, f = flare > 0 ? flare * Math.exp(-Math.max(0, y + 0.1) / 0.45) : 0;
    for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      // Brettwurzeln: 5 Rippen, unten stark, ab ≈ 1,2 m verschwunden
      const rr = r * (1 + f * (0.45 + 0.55 * Math.pow(Math.max(0, Math.cos(a * 5 + rootPh)), 2))) * (1 + 0.025 * Math.sin(a * 9 + i));
      N.copy(X).multiplyScalar(ca).addScaledVector(Y, sa);
      P.copy(p).addScaledVector(N, rr);
      // Normale am Wurzelanlauf etwas nach oben gekippt
      const nn = N.clone(); if (f > 0.01) nn.y += f * 0.6; nn.normalize();
      const u = strip >= 0 ? k / segs : (k / segs) * tiles * size;
      const v = strip >= 0 ? br.acc[i] / 1.2 : br.acc[i] * (sp.vScale || 1);
      // Wind: Stamm biegt sich mit der Höhe; Äste flattern leicht an den Spitzen
      const hb = Math.max(0, P.y) / H, w0 = sp.bend * hb * hb, w1 = br.lvl === 0 ? 0 : 0.012 * br.lvl * (i / (n - 1));
      // AO: Holz im Kronendach dunkler, Stammfuß leicht
      const ao = br.lvl === 0 ? 0.92 - 0.2 * Math.exp(-Math.max(0, P.y) / 0.6) : 0.78;
      ring.push(B.v(P, nn, u, v, ao, w0, w1, strip));
    }
    rings.push(ring);
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < segs; k++) {
    const a = rings[i][k], b = rings[i][k + 1], c = rings[i + 1][k + 1], d = rings[i + 1][k];
    B.tri(a, b, c); B.tri(a, c, d);
  }
}

// ---------------------------------------------------------------------------
// Laub (Zweigkarten)
// ---------------------------------------------------------------------------
function card(B, p, axis, face, len, wid, cell, sk, sp, fold, aoK = 1) {
  const uv = cellUV(cell), side = new THREE.Vector3().crossVectors(axis, face).normalize();
  const cc = sk.cc, H = sk.H, cr = Math.max(1, sk.crownR);
  const base = p.clone().addScaledVector(axis, -0.06 * len);
  const pts = [
    base.clone().addScaledVector(side, -wid / 2), base.clone().addScaledVector(face, fold * wid), base.clone().addScaledVector(side, wid / 2),
  ];
  const top = pts.map((q) => q.clone().addScaledVector(axis, len));
  // Spitze hängt etwas (Blattgewicht) → leichte Wölbung längs
  for (const q of top) q.y -= len * 0.08;
  const us = [uv.u0, (uv.u0 + uv.u1) / 2, uv.u1];
  const idx = [];
  const ho = (q) => { // Normale: Kugel um die Kronenmitte (abgeflacht) + etwas Kartennormale
    const n = new THREE.Vector3(q.x - cc.x, (q.y - cc.y) * 1.25, q.z - cc.z);
    if (n.lengthSq() < 1e-4) n.set(0, 1, 0);
    n.normalize().multiplyScalar(0.72).addScaledVector(face, face.y < 0 ? -0.28 : 0.28);
    return n.normalize();
  };
  const ao = (q, tip) => {
    const d = Math.hypot((q.x - cc.x) / cr, (q.y - cc.y) / (cr * 1.1), (q.z - cc.z) / cr);
    const a = (0.38 + 0.62 * Math.min(1, Math.max(0, (d - 0.15) / 0.85))) * (0.78 + 0.22 * Math.min(1, Math.max(0, q.y / H)));
    return Math.min(1.08, a * aoK * (tip ? 1.06 : 0.95));
  };
  const wind = (q, tip) => { const hb = Math.max(0, q.y) / H; return [sp.bend * hb * hb, tip ? 0.07 : 0.035]; };
  for (let row = 0; row < 2; row++) {
    const L = row ? top : pts;
    for (let k = 0; k < 3; k++) {
      const q = L[k], w = wind(q, row === 1);
      idx.push(B.v(q, ho(q), us[k], row ? uv.v1 : uv.v0, ao(q, row === 1), w[0], w[1]));
    }
  }
  if (fold > 0) { B.tri(idx[0], idx[1], idx[4]); B.tri(idx[0], idx[4], idx[3]); B.tri(idx[1], idx[2], idx[5]); B.tri(idx[1], idx[5], idx[4]); }
  else { B.tri(idx[0], idx[2], idx[5]); B.tri(idx[0], idx[5], idx[3]); } // flach (Mittelstufe): 2 statt 4 Dreiecke
}

function leafCards(B, sk, sp, lod, r) {
  const big = lod === 2 ? 2.1 : lod ? 1.65 : 1, stepK = lod === 2 ? 3.9 : lod ? 2.6 : 1, cc = sk.cc;
  const P = new THREE.Vector3(), D = new THREE.Vector3(), F = new THREE.Vector3(), A = new THREE.Vector3();
  const pick = () => sp.cells[(r() * sp.cells.length) | 0];
  for (const b of sk.branches) {
    if (b.lvl === 0) continue;
    const conLimb = sp.conifer && !sp.pine;
    // Laub an Seitenästen ab 25 %, an Hauptästen nur außen (Krone hohl genug für Äste, dicht an der Hülle)
    const t0 = conLimb ? 0.12 : b.lvl === 2 ? 0.18 : sp.pine ? 0.75 : 0.45;
    const step = sp.step * stepK * (sp.pine ? 1.0 : conLimb ? 1 : 0.8);
    const n = Math.max(1, Math.floor((b.len * (1 - t0)) / step));
    for (let i = 0; i <= n; i++) {
      const t = Math.min(1, t0 + (1 - t0) * (i + (i < n ? r() * 0.5 : 0)) / Math.max(1, n));
      pointAt(b, t, P); dirAt(b, t, D);
      const out = A.subVectors(P, cc); out.y *= 0.6; out.normalize();
      const reps = sp.dead ? (r() < 0.5 ? 1 : 0) : conLimb ? (lod || b.len < 1.3 ? 1 : 2) : lod ? 1 : (t > 0.85 ? 2 : 1 + (r() < 0.35 ? 1 : 0));
      for (let k = 0; k < reps; k++) {
        const axis = D.clone().multiplyScalar(conLimb ? 0.85 : 0.45).addScaledVector(out, conLimb ? 0.15 : 0.45);
        axis.y += conLimb ? -0.08 : sp.droop ? -sp.droop * 0.9 : 0.15;
        axis.x += (r() - 0.5) * 0.7; axis.y += (r() - 0.5) * 0.5; axis.z += (r() - 0.5) * 0.7; axis.normalize();
        // Kartenfläche: um die Achse gedreht, eher zum Himmel bzw. nach außen; Nadelzweige als flache Fächer (+ eine
        // gekippte zweite Lage für Volumen)
        const az = conLimb ? (k ? 1.1 : 0) + (r() - 0.5) * 0.5 : (r() - 0.5) * 2.4;
        F.copy(_up).addScaledVector(axis, -axis.y).normalize();
        if (F.lengthSq() < 0.1) F.set(1, 0, 0);
        const S = new THREE.Vector3().crossVectors(axis, F);
        F.multiplyScalar(Math.cos(az)).addScaledVector(S, Math.sin(az)).normalize();
        const sz = sp.card * big * (0.78 + r() * 0.42) * (conLimb ? Math.min(1, 0.55 + b.len * 0.35) : 1);
        card(B, P, axis, F, sz, sz * (sp.conifer ? 0.95 : 0.9), pick(), sk, sp, lod ? 0 : 0.17);
      }
    }
  }
  // Wipfel der Fichte: senkrechte Kreuzkarten
  if (sp.conifer && !sp.pine) {
    const top = new THREE.Vector3(0, sk.H - 1.6, 0);
    for (let k = 0; k < 2; k++) card(B, top, new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(k * 1.57), 0, Math.sin(k * 1.57)), 1.9, 0.9, sp.cells[0], sk, sp, 0.1, 1.05);
  }
}

/**
 * Baumvariante bauen. lod 0: { wood (Rinde), leaves }, lod 1: { mid } (Holz aus Atlas-Streifen + Laub, ein Material),
 * lod 2: Mittelstufe für „niedrig“ (noch weniger, größere Karten, nur dicke Äste).
 * → { wood?, leaves?, mid?, H, crownR, box }
 */
export function buildTreeVariant(kind, seed, lod = 0) {
  const sp = TREE_SPECIES[kind];
  const sk = skeleton(sp, seed);
  const r = rng(seed * 31 + 7), rootPh = r() * TAU;
  if (lod === 0) {
    const W = new Builder(), L = new Builder();
    for (const b of sk.branches) {
      const segs = b.lvl === 0 ? 14 : sp.conifer && !sp.pine ? 3 : b.lvl === 1 ? (b.R[0] > 0.07 ? 8 : 5) : 4;
      if (b.lvl === 2 && b.R[0] < 0.008) continue;
      tube(W, b, segs, sp, sk.H, { flare: b.lvl === 0 ? sp.flare : 0, rootPh });
    }
    leafCards(L, sk, sp, 0, r);
    return { wood: W.geometry(), leaves: L.count ? L.geometry() : null, H: sk.H, crownR: sk.crownR };
  }
  const M = new Builder();
  for (const b of sk.branches) {
    if (b.lvl === 2 && !sp.dead) continue; // Seitenäste verschwinden in der Mittelstufe im Laub
    if (b.lvl > 0 && (b.R[0] < 0.035 || (sp.conifer && !sp.pine && b.R[0] < 0.05)) && !sp.dead) continue;
    if (lod === 2 && b.lvl > 0 && b.R[0] < 0.06 && !sp.dead) continue;
    tube(M, b, b.lvl === 0 ? (lod === 2 ? 5 : 7) : 3, sp, sk.H, { strip: sp.strip, flare: b.lvl === 0 ? sp.flare * 0.8 : 0, rootPh });
  }
  leafCards(M, sk, sp, 1, r);
  const g = M.geometry(true);
  return { mid: g, H: sk.H, crownR: sk.crownR, box: g.boundingBox.clone() };
}

/** Busch (kollisionslos): mehrere Triebe aus dem Boden, Karten der Laubarten, Kuppelform (≈ 1,8 m hoch, 2,6 m breit). */
export function buildBush(seed = 3, lod = 0) {
  const r = rng(seed), B = new Builder();
  const sp = { bend: 0.06, H: 1.8 };
  const sk = { cc: new THREE.Vector3(0, 0.7, 0), crownR: 1.2, H: 1.8, branches: [] };
  const n = 7;
  for (let i = 0; i < n; i++) {
    const az = (i / n) * TAU + r() * 0.6, el = (18 + r() * 38) * Math.PI / 180;
    const d = new THREE.Vector3(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
    sk.branches.push(makeBranch(curve(r, new THREE.Vector3((r() - 0.5) * 0.3, -0.1, (r() - 0.5) * 0.3), d, 1.3 + r() * 0.8, 4, -0.35, 0.3), 0.025, 0.006, 2));
  }
  const cells = [2, 3, 6, 7, 0];
  const P = new THREE.Vector3(), D = new THREE.Vector3(), F = new THREE.Vector3();
  for (const b of sk.branches) {
    const m = lod ? 4 : 10;
    for (let i = 0; i < m; i++) {
      const t = 0.3 + 0.7 * (i + r() * 0.6) / m;
      pointAt(b, t, P); dirAt(b, t, D);
      const out = new THREE.Vector3(P.x, (P.y - 0.5) * 0.8, P.z).normalize();
      const axis = D.clone().multiplyScalar(0.4).addScaledVector(out, 0.6); axis.x += (r() - 0.5) * 0.8; axis.y += (r() - 0.5) * 0.6 + 0.1; axis.z += (r() - 0.5) * 0.8; axis.normalize();
      F.copy(_up).addScaledVector(axis, -axis.y).normalize();
      const S = new THREE.Vector3().crossVectors(axis, F), az = (r() - 0.5) * 2.2;
      F.multiplyScalar(Math.cos(az)).addScaledVector(S, Math.sin(az)).normalize();
      const sz = (lod ? 1.1 : 0.85) * (0.8 + r() * 0.4);
      card(B, P, axis, F, sz, sz * 0.9, cells[(r() * cells.length) | 0], sk, sp, 0.15, 1.05);
    }
  }
  return B.geometry();
}

/**
 * Krone ohne Stamm für die Arenakarten (atlas.js createFoliage 'olive'/'tree'; den Stamm baut props.js): Äste vom
 * Kronenansatz nach außen, Zweigkarten wie bei den Großkarten-Bäumen. olive: schmale Blätter (Birkenzellen), lichter.
 */
export function buildCrown(kind = 'tree', seed = 11) {
  const r = rng(seed), B = new Builder();
  const olive = kind === 'olive';
  const yS = olive ? 1.5 : 2.0, yC = olive ? 3.5 : 4.6, R = olive ? 2.3 : 2.9;
  const sp = { cells: olive ? [4, 5] : [2, 3, 6, 7], card: olive ? 1.3 : 1.5, step: olive ? 0.24 : 0.28, bend: 0.12, conifer: false };
  const sk = { cc: new THREE.Vector3(0, yC, 0), crownR: R, H: yC + R, branches: [] };
  const n = olive ? 14 : 16;
  for (let i = 0; i < n; i++) {
    const az = i * 2.39996 + r() * 0.5, u = i / (n - 1);
    const tgt = new THREE.Vector3(Math.cos(az) * R * (0.75 + r() * 0.3) * (1 - u * 0.45), yC - R * 0.35 + u * R * 1.25, Math.sin(az) * R * (0.75 + r() * 0.3) * (1 - u * 0.45));
    const o = new THREE.Vector3(0, yS + u * (yC - yS) * 0.8, 0), d = tgt.clone().sub(o);
    const L = d.length();
    const limb = makeBranch(curve(r, o, d, L, 5, 0.1, 0.25), 0.06, 0.012, 1);
    sk.branches.push(limb);
    for (let j = 0; j < 5; j++) {
      const t = 0.3 + j * 0.15, so = pointAt(limb, t), ld = dirAt(limb, t), sd = perp(ld, r() * TAU, new THREE.Vector3());
      const dd = ld.clone().multiplyScalar(0.6).addScaledVector(sd, 0.8).normalize();
      sk.branches.push(makeBranch(curve(r, so, dd, L * 0.45 * (0.8 + r() * 0.4), 3, 0.1, 0.3), 0.02, 0.008, 2));
    }
  }
  leafCards(B, sk, sp, 0, r);
  return B.geometry();
}

/** Farn: Rosette aus gebogenen Wedeln (Atlas-Zelle 13), ≈ 0,8 m hoch. */
export function buildFern(seed = 5) {
  const r = rng(seed), B = new Builder(), uv = cellUV(13);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const az = (i / n) * TAU + r() * 0.5, L = 0.85 + r() * 0.45, W = L * 0.55;
    const dx = Math.cos(az), dz = Math.sin(az), sx = -dz, sz = dx;
    const seg = [[0, 0.02], [0.32, 0.55], [0.72, 0.62], [1.0, 0.38]].map(([f, h]) => [f * L * 0.85, h * L * (0.8 + r() * 0.3)]);
    let prev = null;
    seg.forEach(([d, h], j) => {
      const v = uv.v0 + (uv.v1 - uv.v0) * (j / (seg.length - 1));
      const c = new THREE.Vector3(dx * d, h, dz * d), n0 = new THREE.Vector3(-dx * 0.3, 1, -dz * 0.3).normalize();
      const ao = 0.55 + 0.45 * (j / (seg.length - 1)), w = W * (j === 0 ? 0.35 : 1) / 2;
      const a = B.v(c.clone().add(new THREE.Vector3(sx * w, 0, sz * w)), n0, uv.u0, v, ao, 0, 0.05 * j / 3);
      const b = B.v(c.clone().add(new THREE.Vector3(-sx * w, 0, -sz * w)), n0, uv.u1, v, ao, 0, 0.05 * j / 3);
      if (prev) { B.tri(prev[0], prev[1], b); B.tri(prev[0], b, a); }
      prev = [a, b];
    });
  }
  return B.geometry();
}

// ---------------------------------------------------------------------------
// Materialien
// ---------------------------------------------------------------------------
const IGN = 'float npIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }';
/** Instanzabstand (xz) zur Kamera im Vertex-Shader; uLod = (Einblenden von, bis, Ausblenden von, bis). */
const LOD_VERT = `
  #ifdef USE_INSTANCING
    vec3 npIP = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  #else
    vec3 npIP = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  vNpDist = length(npIP.xz - cameraPosition.xz);`;
const LOD_FRAG = `
  {
    float npD = npIGN(gl_FragCoord.xy);
    float npIn = uLod.y > uLod.x ? smoothstep(uLod.x, uLod.y, vNpDist) : 1.0;
    float npOut = uLod.w > uLod.z ? smoothstep(uLod.z, uLod.w, vNpDist) : 0.0;
    if (npD >= npIn || npD < npOut) discard;
  }`;
// Durchscheinen: Licht, das von hinten durch das Blatt fällt (mit Schatten, da directLight.color ihn enthält)
const TRANSLUCENT = `
uniform float uTrans;
void npRE_Direct( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  float npBack = pow( saturate( dot( -geometryViewDir, directLight.direction ) ), 4.0 );
  float npThru = saturate( -dot( geometryNormal, directLight.direction ) ) * 0.35 + npBack * 0.9;
  reflectedLight.directDiffuse += directLight.color * material.diffuseColor * npThru * uTrans;
}
#undef RE_Direct
#define RE_Direct npRE_Direct
`;

function windUniforms(sh) {
  sh.uniforms.uTime = foliageUniforms.uTime;
  sh.uniforms.uWind = foliageUniforms.uWind;
}

/**
 * Laubmaterial (Atlas): beidseitig gleiche Kronennormale, AO als Vertexfarbe, Durchscheinen, Wind, LOD-Dithering.
 * strip: Mittelstufe (Rinde aus den Atlas-Streifen über aStrip). lod: [Einblenden von, bis, Ausblenden von, bis].
 */
export function createLeafMaterial({ lod = [0, 0, 1e5, 1e5], strip = false, name = 'baum-laub', trans = 0.55 } = {}) {
  const m = new THREE.MeshStandardMaterial({ map: atlasTex || placeholder, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.78, metalness: 0 });
  m.name = name; m.userData.surface = 'grass'; m.userData.disposable = true;
  const uLod = { value: new THREE.Vector4(...lod) }, uTrans = { value: trans };
  m.userData.lod = uLod.value;
  m.onBeforeCompile = (sh) => {
    windUniforms(sh); sh.uniforms.uLod = uLod; sh.uniforms.uTrans = uTrans;
    sh.vertexShader = `uniform float uTime;\nuniform vec4 uWind;\nattribute vec2 aWind;\nvarying float vNpDist;\n${strip ? 'attribute float aStrip;\nvarying float vNpStrip;\n' : ''}` + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      ${WIND_VERTEX}
      ${LOD_VERT}
      ${strip ? 'vNpStrip = aStrip;' : ''}`);
    let fs = `uniform vec4 uLod;\nvarying float vNpDist;\n${strip ? 'varying float vNpStrip;\n' : ''}${IGN}\n` + sh.fragmentShader;
    fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${LOD_FRAG}`);
    if (strip) {
      // Rinde der Mittelstufe: Kachel-UVs (fract) in den Rindenstreifen der Atlaszellen 14/15, Ableitungen der
      // ungebrochenen UVs (keine Mip-Naht an der Kachelgrenze)
      fs = fs.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 sampledDiffuseColor;
        if ( vNpStrip > -0.5 ) {
          vec2 npS = vec2( 0.5 + floor( vNpStrip / 4.0 ) * 0.25 + mod( vNpStrip, 4.0 ) * 0.0625, 0.0 );
          vec2 npK = vec2( 0.0625, 0.25 );
          vec2 npU = npS + vec2( 0.004, 0.004 ) + fract( vMapUv ) * ( npK - 0.008 );
          sampledDiffuseColor = textureGrad( map, npU, dFdx( vMapUv ) * npK, dFdy( vMapUv ) * npK );
          sampledDiffuseColor.a = 1.0;
        } else sampledDiffuseColor = texture2D( map, vMapUv );
        diffuseColor *= sampledDiffuseColor;
      #endif`);
    }
    fs = fs.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      ${strip ? 'if ( vNpStrip < -0.5 )' : ''} normal = normalize( vNormal ); // Kronennormale beidseitig gleich`)
      .replace('#include <alphatest_fragment>', `#ifdef USE_MAP
        { vec2 npDx = dFdx(vMapUv) * 2048.0, npDy = dFdy(vMapUv) * 2048.0;
          float npLod = max(0.0, 0.5 * log2(max(dot(npDx, npDx), dot(npDy, npDy))));
          diffuseColor.a *= 1.0 + 0.14 * min(npLod, 5.0); }
      #endif
      #include <alphatest_fragment>`)
      .replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>\n${TRANSLUCENT}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
      reflectedLight.indirectSpecular *= 0.35; reflectedLight.directSpecular *= 0.5;`);
    sh.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => `np-baum-laub-v1-${strip ? 1 : 0}`;
  m.customDepthMaterial = depthMaterial(m);
  leafMats.add(m);
  return m;
}

/** Schattenpass: Alpha-Test des Atlas + Wind (Schatten bewegt sich mit der Krone). */
function depthMaterial(src) {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: src.map, alphaTest: 0.5, side: THREE.DoubleSide });
  d.name = 'baum-schatten';
  d.onBeforeCompile = (sh) => {
    windUniforms(sh);
    sh.vertexShader = 'uniform float uTime;\nuniform vec4 uWind;\nattribute vec2 aWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${WIND_VERTEX}`);
  };
  d.customProgramCacheKey = () => 'np-baum-tiefe-v1';
  // Atlas folgt dem Laubmaterial
  Object.defineProperty(d, 'map', { get: () => src.map, set: () => {} });
  return d;
}

/**
 * Rinde (nah): Fotoscan-Material der Art (Klon des Spielmaterials) + Wind, LOD-Dithering, Moos an der Wetterseite
 * (Westen/Windseite, Stammfuß und Astoberseiten, fleckig).
 */
export function createBarkMaterial(base, { lod = [0, 0, 1e5, 1e5], moss = 1, tint = null } = {}) {
  const m = base.clone();
  copyShaderPatches(base, m, '|baum');
  m.name = (base.name || 'bark') + '-baum'; m.userData = { ...base.userData, disposable: true };
  if (tint) m.color.multiply(new THREE.Color(tint));
  const uLod = { value: new THREE.Vector4(...lod) }, uMoss = { value: moss };
  m.userData.lod = uLod.value;
  addShaderPatch(m, 'np-baum-rinde', (sh) => {
    windUniforms(sh); sh.uniforms.uLod = uLod; sh.uniforms.uMoss = uMoss;
    sh.vertexShader = 'uniform float uTime;\nuniform vec4 uWind;\nattribute vec2 aWind;\nvarying float vNpDist;\nvarying vec3 vNpMossP;\nvarying vec3 vNpMossN;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      ${WIND_VERTEX}
      ${LOD_VERT}
      vNpMossP = position;
      #ifdef USE_INSTANCING
        vNpMossN = normalize(mat3(instanceMatrix) * objectNormal);
      #else
        vNpMossN = normalize(mat3(modelMatrix) * objectNormal);
      #endif`);
    sh.fragmentShader = `uniform vec4 uLod;\nuniform float uMoss;\nvarying float vNpDist;\nvarying vec3 vNpMossP;\nvarying vec3 vNpMossN;\n${IGN}
      float npH3(vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float npVN(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(npH3(i), npH3(i + vec3(1,0,0)), f.x), mix(npH3(i + vec3(0,1,0)), npH3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(npH3(i + vec3(0,0,1)), npH3(i + vec3(1,0,1)), f.x), mix(npH3(i + vec3(0,1,1)), npH3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      ` + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${LOD_FRAG}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        // Moos: Wetterseite (−x, Westwind), Stammfuß, Oberseiten; fleckig über Rauschen und die Rindenhelligkeit
        vec3 npN = normalize(vNpMossN);
        float npSide = smoothstep(-0.1, 0.8, dot(npN, normalize(vec3(-0.85, 0.0, 0.5))));
        float npFoot = 1.0 - smoothstep(0.2, 2.6, vNpMossP.y);
        float npTop = smoothstep(0.35, 0.9, npN.y);
        float npNoise = npVN(vNpMossP * 3.1) * 0.65 + npVN(vNpMossP * 9.3) * 0.35;
        float npL = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        float npM = clamp((npSide * (0.45 + 0.55 * npFoot) + npTop * 0.6) * uMoss, 0.0, 1.0);
        npM = smoothstep(0.35, 0.75, npM * (0.55 + 0.9 * npNoise) + (0.12 - npL) * 0.6);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.10, 0.03) * (0.7 + 0.8 * npNoise), npM * 0.85);
      }`);
  });
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.customDepthMaterial.onBeforeCompile = (sh) => {
    windUniforms(sh);
    sh.vertexShader = 'uniform float uTime;\nuniform vec4 uWind;\nattribute vec2 aWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${WIND_VERTEX}`);
  };
  m.customDepthMaterial.customProgramCacheKey = () => 'np-baum-tiefe-holz-v1';
  return m;
}

// ---------------------------------------------------------------------------
// Impostor (Mehrwinkel, aus dem Mittelmodell gerendert)
// ---------------------------------------------------------------------------
const FRAMES = 8;
const CAPTURE_VS = `
attribute float aStrip;
varying vec2 vUv; varying vec3 vN; varying float vAo; varying float vStrip;
void main() { vUv = uv; vN = normal; vAo = color.r; vStrip = aStrip; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CAPTURE_FS = `
uniform sampler2D map; uniform float mode; uniform vec3 tint;
varying vec2 vUv; varying vec3 vN; varying float vAo; varying float vStrip;
void main() {
  vec4 c;
  if (vStrip > -0.5) {
    vec2 s = vec2(0.5 + floor(vStrip / 4.0) * 0.25 + mod(vStrip, 4.0) * 0.0625, 0.0);
    c = texture2D(map, s + vec2(0.004) + fract(vUv) * (vec2(0.0625, 0.25) - 0.008)); c.a = 1.0;
  } else c = texture2D(map, vUv);
  if (c.a < 0.5) discard;
  if (mode < 0.5) {
    vec3 lin = c.rgb * vAo * (vStrip > -0.5 ? vec3(1.0) : tint); // sRGB-Atlas liefert schon lineare Werte (GPU-Dekodierung)
    gl_FragColor = vec4(pow(lin, vec3(1.0 / 2.2)), 1.0);
  } else gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, 1.0);
}`;

/**
 * Impostor-Atlas aus Mittelmodellen rendern. variants: [{ geo (mid), box }], cell [w, h] je Ansicht.
 * → { albedo: DataTexture (sRGB), normal: DataTexture, grid: [cols, rows, vpr], dims: [{ hw, y0, y1 }] }
 */
export function renderImpostors(renderer, variants, cell, tints) {
  const [cw, ch] = cell, vpr = variants.length > 4 ? 2 : 1;
  const rows = Math.ceil(variants.length / vpr), W = vpr * FRAMES * cw, H = rows * ch;
  const albedo = new Uint8Array(W * H * 4), normal = new Uint8Array(W * H * 4);
  const rt = new THREE.WebGLRenderTarget(cw, ch, { depthBuffer: true, type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
  const mat = new THREE.ShaderMaterial({ vertexShader: CAPTURE_VS, fragmentShader: CAPTURE_FS, uniforms: { map: { value: atlasTex || placeholder }, mode: { value: 0 }, tint: { value: new THREE.Vector3(1, 1, 1) } }, side: THREE.DoubleSide, vertexColors: true });
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const buf = new Uint8Array(cw * ch * 4), dims = [];
  const prevRT = renderer.getRenderTarget(), prevClear = new THREE.Color(), prevA = renderer.getClearAlpha(), prevSM = renderer.shadowMap.autoUpdate;
  renderer.getClearColor(prevClear);
  renderer.shadowMap.autoUpdate = false;
  const prevXR = renderer.xr?.enabled; if (renderer.xr) renderer.xr.enabled = false;
  try {
    renderer.setClearColor(0x000000, 0);
    variants.forEach((v, vi) => {
      const b = v.box, hw = Math.max(Math.abs(b.min.x), Math.abs(b.max.x), Math.abs(b.min.z), Math.abs(b.max.z)) * 1.02;
      const y0 = b.min.y, y1 = b.max.y * 1.01;
      dims.push({ hw, y0, y1 });
      const mesh = new THREE.Mesh(v.geo, mat); scene.add(mesh);
      const t = tints[vi]; mat.uniforms.tint.value.set(t.r, t.g, t.b);
      cam.left = -hw; cam.right = hw; cam.bottom = y0; cam.top = y1; cam.updateProjectionMatrix();
      const rowC = Math.floor(vi / vpr), colB = (vi % vpr) * FRAMES;
      for (let f = 0; f < FRAMES; f++) {
        const th = (f / FRAMES) * TAU;
        cam.position.set(Math.sin(th) * 60, 0, Math.cos(th) * 60); cam.lookAt(0, 0, 0);
        // Ortho-Kamera blickt waagerecht: bottom/top sind relativ zur Kamerahöhe 0 → Baum-Koordinaten passen
        for (let pass = 0; pass < 2; pass++) {
          mat.uniforms.mode.value = pass;
          renderer.setRenderTarget(rt); renderer.clear(true, true, false); renderer.render(scene, cam);
          renderer.readRenderTargetPixels(rt, 0, 0, cw, ch, buf);
          const dst = pass ? normal : albedo;
          for (let y = 0; y < ch; y++) dst.set(buf.subarray(y * cw * 4, (y + 1) * cw * 4), ((rowC * ch + y) * W + (colB + f) * cw) * 4);
        }
      }
      scene.remove(mesh);
    });
  } finally {
    renderer.setRenderTarget(prevRT); renderer.setClearColor(prevClear, prevA); renderer.shadowMap.autoUpdate = prevSM;
    if (renderer.xr) renderer.xr.enabled = prevXR;
    rt.dispose(); mat.dispose();
  }
  bleed(albedo, W, H); bleed(normal, W, H);
  const mk = (data, srgb, name) => {
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 1; t.name = name; t.needsUpdate = true;
    return t;
  };
  return { albedo: mk(albedo, true, 'baum-impostor'), normal: mk(normal, false, 'baum-impostor-normal'), grid: [vpr * FRAMES, rows, vpr], size: [W, H], dims };
}
/** Farbe in transparente Pixel ausbluten (keine dunklen Säume in den Mipmaps); Alpha bleibt. */
function bleed(d, W, H) {
  const N = W * H, tmp = new Uint8Array(N);
  for (let i = 0; i < N; i++) tmp[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  for (let it = 0; it < 6; it++) {
    const next = tmp.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (tmp[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (!tmp[j]) continue; r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++;
      }
      if (n) { d[i * 4] = r / n; d[i * 4 + 1] = g / n; d[i * 4 + 2] = b / n; next[i] = 1; }
    }
    tmp.set(next);
  }
}

/** Billboard-Quad (x −0,5…0,5, y 0…1). */
export function impostorGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return g;
}

/**
 * Impostor-Material: zylindrisches Billboard je Instanz (aImp = Variante, halbe Breite, y0, y1), Ansicht nach
 * Blickwinkel im Baum-System (8 Ansichten, gedithert überblendet), Normalen aus dem Normalen-Atlas → Licht, Schatten,
 * Nebel wie die echten Bäume; Durchscheinen im Gegenlicht wie das Laub.
 */
export function createImpostorMaterial(imp, lod) {
  const m = new THREE.MeshStandardMaterial({ map: imp.albedo, alphaTest: 0.5, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  m.name = 'baum-impostor'; m.userData.surface = 'grass'; m.userData.disposable = true;
  const uLod = { value: new THREE.Vector4(...lod) }, uTrans = { value: 0.45 };
  const uGrid = { value: new THREE.Vector4(imp.grid[0], imp.grid[1], imp.grid[2], FRAMES) };
  const uNor = { value: imp.normal };
  m.userData.lod = uLod.value;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLod = uLod; sh.uniforms.uTrans = uTrans; sh.uniforms.uImpGrid = uGrid; sh.uniforms.tImpNor = uNor;
    sh.vertexShader = `attribute vec4 aImp;\nvarying float vNpDist;\nvarying vec3 vNpImp;\nvarying vec3 vNpR0;\nvarying vec3 vNpR2;\n` + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        mat3 npM = mat3(instanceMatrix);
        float npS = length(npM[0]);
        vec3 npT = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
        vec3 npC = cameraPosition - npT;
        vec2 npH = normalize(npC.xz + vec2(1e-4));
        vec3 npRight = vec3(npH.y, 0.0, -npH.x);
        vec3 npOff = npRight * (position.x * 2.0 * aImp.y * npS) + vec3(0.0, mix(aImp.z, aImp.w, position.y) * npS, 0.0);
        transformed = transpose(npM) * npOff / (npS * npS);
        vec3 npL = transpose(npM) * vec3(npC.x, 0.0, npC.z);
        float npTh = atan(npL.x, npL.z);
        vNpImp = vec3(position.x + 0.5, position.y, mod(npTh / 6.2831853 * ${FRAMES.toFixed(1)} + ${FRAMES.toFixed(1)}, ${FRAMES.toFixed(1)}));
        vNpR0 = npM[0] / npS; vNpR2 = npM[2] / npS;
        vNpDist = length(npT.xz - cameraPosition.xz);
      }
      float npVar = aImp.x;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      { vec3 npC2 = cameraPosition - (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz; objectNormal = transpose(mat3(instanceMatrix)) * normalize(vec3(npC2.x, 0.0, npC2.z)); }`)
      .replace('void main() {', 'varying float vNpVar;\nvoid main() {')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n vNpVar = aImp.x;');
    sh.fragmentShader = `uniform vec4 uLod;\nuniform vec4 uImpGrid;\nuniform sampler2D tImpNor;\nvarying float vNpDist;\nvarying vec3 vNpImp;\nvarying vec3 vNpR0;\nvarying vec3 vNpR2;\nvarying float vNpVar;\n${IGN}\n` + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${LOD_FRAG}
      float npD2 = npIGN(gl_FragCoord.xy + vec2(17.0, 31.0));
      float npF0 = floor(vNpImp.z), npFt = vNpImp.z - npF0;
      float npF = mod(npD2 < npFt ? npF0 + 1.0 : npF0, uImpGrid.w);
      float npRow = floor(vNpVar / uImpGrid.z), npCol = mod(vNpVar, uImpGrid.z) * uImpGrid.w + npF;
      vec2 npUv = (vec2(npCol, npRow) + clamp(vNpImp.xy, vec2(0.004), vec2(0.996))) / uImpGrid.xy;
      // Ableitungen aus den stetigen Billboard-Koordinaten: die gedithert gewählte Ansicht springt von Pixel zu Pixel
      // um eine ganze Zelle – dFdx(npUv) wäre dort riesig (grobe Mip-Stufe → Klötzchen)
      vec2 npGx = dFdx(vNpImp.xy) / uImpGrid.xy, npGy = dFdy(vNpImp.xy) / uImpGrid.xy;`)
      .replace('#include <map_fragment>', `{ vec4 npC = textureGrad(map, npUv, npGx, npGy); diffuseColor *= npC; }`)
      .replace('#include <alphatest_fragment>', `{ vec2 npDx = npGx * vec2(${imp.size[0]}.0, ${imp.size[1]}.0), npDy = npGy * vec2(${imp.size[0]}.0, ${imp.size[1]}.0);
        float npLod = max(0.0, 0.5 * log2(max(dot(npDx, npDx), dot(npDy, npDy))));
        diffuseColor.a *= 1.0 + 0.16 * min(npLod, 5.0); }
      #include <alphatest_fragment>`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      { vec3 npLn = textureGrad(tImpNor, npUv, npGx, npGy).xyz * 2.0 - 1.0;
        vec3 npWn = vNpR0 * npLn.x + vec3(0.0, npLn.y, 0.0) + vNpR2 * npLn.z;
        normal = normalize((viewMatrix * vec4(npWn, 0.0)).xyz); }`)
      .replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>\n${TRANSLUCENT}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
      reflectedLight.indirectSpecular *= 0.3; reflectedLight.directSpecular *= 0.4;`);
  };
  m.customProgramCacheKey = () => 'np-baum-impostor-v1';
  return m;
}
