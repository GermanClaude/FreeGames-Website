// NULLPUNKT — Hauttexturen der Soldatenköpfe, prozedural im Hintergrund-Rechner „gebacken“ (ohne three.js, keine Bilddateien).
//
// Jede Texel-Fläche des UV-Layouts (face-mesh.js / kopf.bin) wird auf das Kopfnetz zurückgerechnet: aus der 3D-Lage
// (Modellraum, Grundform) und den Landmarken entstehen
//   Karte A (RGBA8): Hautfarbe als Faktor zur Hautton-Uniform (RGB · 2 = Faktor), A = Haardeckung (Brauen, Bartstoppeln/Bart,
//                    Kurzhaar, Wimpernlinie) – der Shader mischt dort die Haarfarbe ein.
//   Karte B (RGBA8): R = Relief (0,5 = 0; ±0,2 mm: Poren, Fältchen, Lippenrillen, Altersfalten, Stoppeln),
//                    G = Verdeckung (Ecken-AO × Poren/Falten), B = Rauheit (T-Zone/Nase/Lippen glänzender, Bart matter),
//                    A = Mimikfalten (Stirnquerfalten, Zornesfalte, Krähenfüße, Nasenrücken – der Shader blendet sie je
//                        Bereich mit den Brauen-/Lächel-Gewichten ein).
// look: { age (Jahre), stubble (0…1), beard ('none'|'stoppel'|'kurz'|'voll'|'schnauzer'|'kinnbart'), hair (0 kahl … 1),
//         recede (0…1 Geheimratsecken), brows (0,5…1,5 Dichte), freckles (0…1), moles (0…1), dark (0…1 dunkle Haut), seed }
// Kosten: 512×1024 ≈ 0,2 s, 1024×2048 ≈ 1 s (Hintergrund-Rechner); GPU 2 × RGBA8 mit Mipmaps (≈ 2,8 / 11 MB).

const HEAD_C = [0, 1.685, 0.0];
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ Rauschen */

let SEED = 0;
function h3(x, y, z) {
  let h = Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f) ^ SEED;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = mix(h3(ix, iy, iz), h3(ix + 1, iy, iz), fx), b = mix(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), fx);
  const c = mix(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), fx), d = mix(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), fx);
  return mix(mix(a, b, fy), mix(c, d, fy), fz);
}
function fbm(x, y, z, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
// Zellrauschen: Abstand zum nächsten Zellpunkt (F1) + Zellkennung
const W = { d: 0, id: 0, dx: 0, dy: 0, dz: 0 };
function worley(x, y, z, jitter = 0.6) {
  // 2 × 2 × 2 nächste Zellen (Zellpunkte ± jitter/2 um die Zellmitte) – genau genug für Poren/Follikel, ≈ 3,4 × schneller als 3³
  const bx = Math.floor(x - 0.5), by = Math.floor(y - 0.5), bz = Math.floor(z - 0.5);
  let best = 9, bid = 0, rx = 0, ry = 0, rz = 0;
  for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const cx = bx + i, cy = by + j, cz = bz + k;
    const hh = h3(cx, cy, cz);
    const px = cx + 0.5 + (hh - 0.5) * jitter, py = cy + 0.5 + (((hh * 7.31) % 1) - 0.5) * jitter, pz = cz + 0.5 + (((hh * 13.17) % 1) - 0.5) * jitter;
    const dx = px - x, dy = py - y, dz = pz - z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < best) { best = d; bid = (hh * 29.71) % 1; rx = dx; ry = dy; rz = dz; }
  }
  W.d = Math.sqrt(best); W.id = bid; W.dx = rx; W.dy = ry; W.dz = rz;
  return W;
}

/* ------------------------------------------------------------------ Aussehen */

export function normLook(l = {}) {
  const o = { age: 30, stubble: 0.5, beard: 'stoppel', hair: 1, recede: 0.2, brows: 1, freckles: 0.2, moles: 0.5, dark: 0, seed: 1 };
  for (const k of Object.keys(o)) if (l[k] !== undefined && l[k] !== null) o[k] = typeof o[k] === 'number' ? +l[k] : l[k];
  return o;
}

/**
 * Karten backen. A = Kopf-Asset (face-mesh.js parseHeadAsset), w × h Texel (Format 1 : 2). → { a, b, w, h, ms }
 */
export function bakeFaceMaps(A, look = {}, w = 512, h = 1024) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const L = normLook(look);
  SEED = Math.imul((L.seed | 0) + 101, 0x9e3779b1);
  const age = sat((L.age - 18) / 50); // 18 J. → 0, 68 J. → 1
  const ageS = age * age;
  const land = A.land;
  // Landmarken relativ zur Kopfmitte
  const eL = land.eyeL.map((v, i) => v - HEAD_C[i]);
  const ey = eL[1], ex = Math.abs(eL[0]), ez = eL[2], er = land.eyeRadius;
  const slitY = land.slitY - HEAD_C[1], cornerX = land.cornerX, mFront = land.mouthFront - HEAD_C[2];
  const nose = land.noseTip.map((v, i) => v - HEAD_C[i]);
  const chin = land.chin.map((v, i) => v - HEAD_C[i]);
  const tmjZ = land.tmj[2] - HEAD_C[2];
  const browY = land.browY - HEAD_C[1];
  const lids = land.lids || null; // [[az[], up[], lo[]], …] je Auge
  const interp = (xs, ys, x) => { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x <= xs[i]) { const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + (ys[i] - ys[i - 1]) * t; } return ys[ys.length - 1]; };
  // Zufall je Aussehen
  let rs = (L.seed * 2654435761) >>> 0;
  const rnd = () => { rs = (rs + 0x6d2b79f5) >>> 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const moles = [];
  const nMoles = Math.round(L.moles * (2 + rnd() * 5));
  for (let i = 0; i < nMoles; i++) moles.push([(rnd() - 0.5) * 0.13, ey + (rnd() - 0.6) * 0.14, (0.6 + rnd() * 1.1) * 0.001, 0.4 + rnd() * 0.5]);
  const beard = L.beard;
  const beardLen = beard === 'voll' ? 1 : beard === 'kurz' ? 0.6 : beard === 'none' ? 0 : 0.25; // 0,25 = Stoppeln
  const stub = beard === 'none' ? L.stubble * 0.35 : Math.max(L.stubble, beardLen);
  const red = 1 - L.dark * 0.75;

  const a = new Uint8Array(w * h * 4), b = new Uint8Array(w * h * 4);
  const cov = new Uint8Array(w * h);
  const pos = A.pos, uv = A.uv, quads = A.quads, quadsUV = A.quadsUV, ao = A.ao, mask = A.mask;
  const nQ = quads.length / 4;
  const texel = 0.15 / (w * 0.72); // ≈ Meter je Texel im Gesicht (Gesichtsbreite ~ 72 % der Kartenbreite)
  const HS = 0.00025; // Reliefmaßstab: ±0,25 mm → 0…255

  // Texel schattieren
  const shade = (o, x, y, z, aoV, lip, mIn, eIn, ear) => {
    const ax = Math.abs(x), side = x < 0 ? -1 : 1;
    const front = sstep(-0.035, -0.075, z);
    const yr = y - ey; // relativ zur Augenhöhe
    let r = 1, g = 1, bl = 1, hgt = 0, rough = 0.46, occ = aoV, hairC = 0, dyn = 0;
    // --- Grundfarbe: Fleckigkeit, Durchblutung, Zonen
    const m1 = fbm(x * 55, y * 55, z * 55, 3) - 0.5;
    const m2 = vnoise(x * 260, y * 260, z * 260) - 0.5;
    r *= 1 + m1 * 0.1 + m2 * 0.03; g *= 1 + m1 * 0.08 + m2 * 0.03; bl *= 1 + m1 * 0.06 + m2 * 0.03;
    const F = front > 0.001;
    const cheek = F ? Math.exp(-(((ax - 0.04) / 0.02) ** 2 + ((yr + 0.03) / 0.022) ** 2)) * front : 0;
    const noseR = F ? Math.exp(-(((ax) / 0.012) ** 2 + ((y - nose[1] - 0.002) / 0.014) ** 2)) * front : 0;
    const redAmt = sat((cheek * (0.55 + 0.25 * age) + noseR * (0.6 + 0.3 * age) + ear * 0.7 + lip * 0.2) * red);
    r *= 1 + 0.07 * redAmt; g *= 1 - 0.1 * redAmt; bl *= 1 - 0.1 * redAmt;
    // feine Äderchen (Wangen/Nase, mit dem Alter)
    if (cheek + noseR > 0.15) {
      const v = Math.abs(fbm(x * 700, y * 700, z * 700, 2) - 0.5);
      const cap = sstep(0.025, 0.0, v) * (cheek + noseR) * (0.15 + 0.5 * ageS) * red;
      r *= 1 + 0.1 * cap; g *= 1 - 0.12 * cap; bl *= 1 - 0.08 * cap;
    }
    const fore = sstep(browY + 0.005, browY + 0.03, y) * front;
    r *= 1 + 0.03 * fore; g *= 1 + 0.02 * fore; bl *= 1 - 0.01 * fore;
    const underE = !F ? 0 : Math.exp(-(((ax - ex) / 0.014) ** 2 + ((yr + 0.0125) / 0.006) ** 2)) * front;
    const ue = underE * (0.5 + 0.6 * age);
    r *= 1 - 0.1 * ue; g *= 1 - 0.12 * ue; bl *= 1 - 0.05 * ue;
    // Augenlider: etwas dunkler, rötlich
    const lidZ = !F ? 0 : Math.exp(-(((ax - ex) / 0.016) ** 2 + ((yr - 0.006) / 0.006) ** 2)) * front;
    r *= 1 - 0.05 * lidZ; g *= 1 - 0.1 * lidZ; bl *= 1 - 0.08 * lidZ;
    // Sommersprossen / Altersflecken (helle Haut)
    if (L.freckles > 0.01 && front > 0.05) {
      const f = worley(x * 900, y * 900, z * 900, 0.95);
      const fr = sstep(0.32, 0.18, f.d) * sstep(0.55, 0.85, f.id) * L.freckles * (1 - L.dark) * (front * 0.8 + 0.2);
      r *= 1 - 0.1 * fr; g *= 1 - 0.16 * fr; bl *= 1 - 0.2 * fr;
      if (age > 0.4) {
        const sp = sstep(0.62, 0.7, fbm(x * 90 + 3, y * 90, z * 90, 2)) * (age - 0.4) * 0.6 * fore;
        r *= 1 - 0.08 * sp; g *= 1 - 0.12 * sp; bl *= 1 - 0.16 * sp;
      }
    }
    // Leberflecke
    for (const [mx, my, mr, mk] of moles) {
      const d = Math.hypot(x - mx, (y - my) * 1.0) - mr;
      if (d < 0.0005 && z < 0.02) { const mm = sstep(0.0003, -0.0002, d) * mk; r *= 1 - 0.45 * mm; g *= 1 - 0.55 * mm; bl *= 1 - 0.55 * mm; hgt += 0.00006 * mm; }
    }
    // --- Poren und Hautrelief
    const poreScale = 1 / mix(0.00042, 0.0006, sat(noseR * 1.5 + cheek * 0.6));
    const pw = worley(x * poreScale, y * poreScale, z * poreScale);
    const pr = mix(0.2, 0.32, sat(noseR + cheek * 0.5)) * (0.7 + 0.6 * pw.id);
    const pAmt = (1 - lip) * (1 - lidZ * 0.7) * (0.55 + 0.45 * front);
    const pore = sstep(pr, pr * 0.25, pw.d) * pAmt;
    hgt -= pore * 0.00009;
    occ *= 1 - pore * 0.22;
    r *= 1 - pore * 0.05; g *= 1 - pore * 0.06; bl *= 1 - pore * 0.05;
    // Hautfelderung (feine Netzfurchen) + weiche Unebenheit
    hgt += (vnoise(x * 1500, y * 1500, z * 1500) - 0.5) * 0.000025 * (1 - lip);
    hgt += (fbm(x * 380, y * 380, z * 380, 2) - 0.5) * 0.00007;
    // --- Altersfalten (Relief + Verdeckung) und Mimikfalten (Kanal dyn)
    let wr = 0;
    if (F) {
    // Stirnquerfalten
    if (y > browY && front > 0.1) {
      const hairY = ey + 0.066;
      const band = sstep(browY + 0.006, browY + 0.014, y) * sstep(hairY - 0.004, hairY - 0.016, y) * sstep(0.052, 0.025, ax) * front;
      if (band > 0) {
        const wob = (vnoise(x * 90, y * 20, 1.3) - 0.5) * 2.2 + ax * ax * 260;
        const ph = (y - browY) / 0.0095 * Math.PI + wob;
        const line = Math.pow(Math.abs(Math.cos(ph)), 10) * sstep(0.3, 0.6, vnoise(x * 60, y * 30, 7.1) + 0.25);
        wr += line * band * (0.15 + 0.85 * age);
        dyn = Math.max(dyn, line * band);
      }
    }
    // Zornesfalte (zwischen den Brauen, senkrecht)
    {
      const gl = Math.exp(-(((ax - 0.0055) / 0.0013) ** 2)) * sstep(browY - 0.012, browY - 0.004, y) * sstep(browY + 0.016, browY + 0.006, y) * front;
      wr += gl * 0.7 * ageS;
      dyn = Math.max(dyn, gl);
    }
    // Krähenfüße (fächerförmig vom äußeren Lidwinkel)
    {
      const cx = ex + 0.017, cy = -0.001;
      const dx = ax - cx, dy = yr - cy;
      const rr = Math.hypot(dx, dy);
      if (dx > -0.003 && rr < 0.024) {
        const an = Math.atan2(dy, dx);
        const fan = sstep(1.1, 0.6, Math.abs(an));
        const ln = Math.pow(Math.abs(Math.cos(an * 9 + vnoise(rr * 200, an * 3, 2.2) * 2)), 8) * fan * sstep(0.003, 0.007, rr) * sstep(0.024, 0.013, rr);
        wr += ln * (0.1 + 0.9 * age);
        dyn = Math.max(dyn, ln);
      }
    }
    // Unterlid-Furche, Tränenrinne
    {
      const yy = -0.0155 - 0.012 * ((ax - ex) / 0.03) ** 2;
      const tt = Math.exp(-(((yr - yy) / 0.0014) ** 2)) * sstep(0.03, 0.012, Math.abs(ax - ex)) * front;
      wr += tt * (0.15 + 0.85 * age);
      const fl = Math.pow(Math.abs(Math.sin((yr + 0.01) / 0.0016 * Math.PI + vnoise(x * 300, y * 80, 4) * 2)), 12) * Math.exp(-(((ax - ex) / 0.012) ** 2 + ((yr + 0.011) / 0.004) ** 2));
      wr += fl * 0.6 * age;
    }
    // Nasolabialfalte: Kurve vom Nasenflügel über den Mundwinkel hinaus
    {
      const y0 = nose[1] - 0.004, y1 = slitY - 0.016;
      if (y < y0 + 0.004 && y > y1 - 0.006) {
        const t = sat((y0 - y) / (y0 - y1));
        const cxl = mix(0.0175, cornerX + 0.0095, Math.sqrt(t));
        const nl = Math.exp(-(((ax - cxl) / (0.0012 + 0.0016 * t)) ** 2)) * sstep(y1 - 0.006, y1 + 0.004, y) * sstep(y0 + 0.004, y0 - 0.002, y) * front;
        wr += nl * (0.35 + 0.8 * age);
        occ *= 1 - nl * (0.15 + 0.2 * age);
        dyn = Math.max(dyn, nl * 0.6);
      }
    }
    // Marionettenfalten
    {
      const t = sat((slitY - 0.002 - y) / 0.03);
      const cxl = mix(cornerX + 0.002, cornerX - 0.002, t);
      const mf = Math.exp(-(((ax - cxl) / 0.0016) ** 2)) * sstep(slitY - 0.001, slitY - 0.006, y) * sstep(slitY - 0.034, slitY - 0.022, y) * front;
      wr += mf * ageS * 0.8;
    }
    }
    // Halsringe
    if (y < chin[1] - 0.02) {
      const nk = Math.pow(Math.abs(Math.sin((y / 0.011) * Math.PI + vnoise(x * 60, 0, 3) * 1.5)), 14) * sstep(0.06, 0.02, ax) * sstep(chin[1] - 0.02, chin[1] - 0.035, y);
      wr += nk * (0.2 + 0.6 * age);
    }
    // Nasenrücken-Querfältchen (Naserümpfen)
    {
      const br = Math.exp(-(((ax) / 0.01) ** 2 + ((yr + 0.004) / 0.006) ** 2)) * front;
      const ln = Math.pow(Math.abs(Math.sin(yr / 0.0022 * Math.PI)), 8) * br;
      dyn = Math.max(dyn, ln * 0.8);
    }
    hgt -= wr * 0.00011;
    occ *= 1 - Math.min(0.35, wr * 0.25);
    // --- Lippen: Lippenrot, Rillen, glatter
    if (lip > 0.01) {
      r *= 1 - lip * 0.05; g *= 1 - lip * 0.24 * red - lip * 0.08; bl *= 1 - lip * 0.2 * red - lip * 0.06;
      const rill = Math.pow(Math.abs(Math.sin((x / 0.0011) * Math.PI + vnoise(x * 300, y * 900, 5) * 2.5)), 3) * sstep(0.2, 0.7, lip);
      hgt -= rill * 0.00004;
      occ *= 1 - rill * 0.08;
      // Lippenrand dunkler
      const edge = sstep(0.15, 0.5, lip) * sstep(0.9, 0.5, lip);
      r *= 1 - edge * 0.06; g *= 1 - edge * 0.06; bl *= 1 - edge * 0.05;
      rough = mix(rough, 0.3, lip);
    }
    // Mundwinkel verschattet
    const mc = Math.exp(-(((ax - cornerX) / 0.0035) ** 2 + ((y - slitY) / 0.003) ** 2));
    occ *= 1 - 0.35 * mc;
    // --- Rauheit nach Zonen (T-Zone, Nase glänzt; Wangen matter)
    rough -= fore * 0.08 + noseR * 0.13;
    rough += cheek * 0.03 + age * 0.04;
    // --- Bart / Stoppeln
    let bm = 0;
    if (stub > 0.01 && z < tmjZ + 0.02) {
      const nB = (vnoise(x * 180, y * 180, z * 180) - 0.5) * 0.004;
      const cl = mix(slitY + 0.017, ey - 0.012, sstep(0.026, 0.068, ax)) + nB; // Wangenlinie
      const must = ax < cornerX + 0.006 ? nose[1] - 0.011 + 0.004 * sstep(0.008, 0.02, ax) : -9; // Oberlippe bis Nasensteg
      const top = Math.max(cl, Math.min(must, nose[1] - 0.008));
      const bot = slitY - 0.088 + 0.025 * sstep(0.02, 0.06, ax) + nB;
      bm = sstep(0.002, -0.002, y - top) * sstep(-0.004, 0.004, y - bot) * (1 - sat(lip * 1.6)) * (1 - mIn) * (1 - ear);
      // Koteletten (vor dem Ohr bis Augenhöhe)
      const sb = sstep(0.058, 0.066, ax) * sstep(tmjZ + 0.016, tmjZ + 0.004, z) * sstep(tmjZ - 0.02, tmjZ - 0.008, z) * sstep(ey + 0.008, ey - 0.002, y) * sstep(slitY - 0.02, slitY, y);
      bm = Math.max(bm, sb * (1 - ear));
      // Kinnbart / Schnauzer: Teilbereiche
      if (beard === 'schnauzer') bm *= sstep(slitY - 0.002, slitY + 0.002, y) * sstep(cornerX + 0.012, cornerX, ax) + (1 - sstep(slitY - 0.002, slitY + 0.002, y) * sstep(cornerX + 0.012, cornerX, ax)) * 0.35;
      if (beard === 'kinnbart') bm *= Math.max(sstep(cornerX + 0.01, cornerX - 0.002, ax), 0.35);
      if (bm > 0.001) {
        // Follikel: ≈ 50 je cm² (1,4 mm), Stoppel als dunkler Punkt + kurzer Strich nach unten
        const fs = 1 / 0.0013;
        const f = worley(x * fs, y * fs, z * fs);
        const dens = sstep(0.15, 0.35, f.id + 0.25) * (0.6 + 0.4 * sstep(0.3, 0.7, vnoise(x * 70, y * 70, z * 70)));
        const len = 0.18 + beardLen * 1.6; // Strichlänge in Zelleinheiten
        // Wuchsrichtung: nach unten, an der Oberlippe schräg nach außen
        const gx = ax < cornerX + 0.006 && y > slitY ? side * 0.7 : side * 0.2, gy = -1;
        const gl = Math.hypot(gx, gy);
        const ux = gx / gl, uy = gy / gl;
        const along = -(f.dx * ux + f.dy * uy), across = Math.abs(-f.dx * uy + f.dy * ux) + Math.abs(f.dz) * 0.4;
        const strand = sstep(0.11 + beardLen * 0.04, 0.03, across) * sstep(-0.08, 0.0, along) * sstep(len, len * 0.6, along);
        const dot = sstep(0.16, 0.05, f.d);
        let hc = Math.max(strand, dot * 0.8) * dens;
        if (beardLen > 0.5) hc = Math.max(hc, sstep(0.35, 0.65, fbm(x * 900 * ux + y * 120, y * 900 * uy - x * 120, z * 300, 2)) * 0.85);
        hairC = Math.max(hairC, hc * bm * sat(stub * 1.3));
        hgt += hc * bm * 0.00004 * (0.5 + beardLen);
        // Bartschatten (Haare unter der Haut): blaugrau
        const sh = bm * stub * (beardLen > 0.5 ? 0.7 : 0.45);
        r *= 1 - 0.2 * sh; g *= 1 - 0.18 * sh; bl *= 1 - 0.1 * sh;
        rough += bm * stub * 0.1;
      }
    }
    // --- Kopfhaar (Kurzhaar unter Helm/Mütze sichtbar an Schläfen und Nacken)
    if (L.hair > 0.01 && ear < 0.5) {
      const nB = (vnoise(x * 150, y * 150, z * 150) - 0.5) * 0.005 + (vnoise(x * 900, y * 900, z * 900) - 0.5) * 0.0012;
      const frontY = ey + 0.07 - 0.012 * sstep(0.012, 0.045, ax) * L.recede - 0.004 * sstep(0.03, 0.05, ax);
      const sideY = ey + 0.012; // über dem Ohr
      const backY = ey - 0.072;
      let hy = mix(frontY, sideY, sstep(-0.078, -0.03, z));
      hy = mix(hy, backY, sstep(0.0, 0.07, z));
      // Schläfe: Haaransatz vor dem Ohr senkt sich zu den Koteletten
      hy = Math.min(hy, mix(9, ey - 0.0, sstep(0.062, 0.07, ax) * sstep(tmjZ - 0.026, tmjZ - 0.012, z) * sstep(tmjZ + 0.02, tmjZ + 0.006, z)) + 0);
      const hm = sstep(-0.0015, 0.003, y - hy + nB) * L.hair;
      if (hm > 0.001) {
        const fs = 1 / 0.0006;
        const f = worley(x * fs, y * fs, z * fs, 0.95);
        const hdot = sstep(0.42, 0.12, f.d) * (0.6 + 0.4 * f.id);
        const hc = (0.55 + 0.45 * hdot) * hm;
        hairC = Math.max(hairC, hc * 0.92);
        hgt += hdot * hm * 0.00005;
        rough = mix(rough, 0.6, hm);
        r *= 1 - 0.25 * hm; g *= 1 - 0.25 * hm; bl *= 1 - 0.22 * hm; // Kopfhaut darunter dunkler
      }
    }
    // --- Augenbrauen
    if (front > 0.2 && Math.abs(y - browY) < 0.016 && ax > 0.004 && ax < 0.068) {
      const s = sat((ax - 0.009) / 0.052);
      const cy = browY - 0.0018 + 0.0042 * Math.sin(s * Math.PI * 0.82) - 0.0035 * sstep(0.72, 1.0, s);
      const th = mix(0.0045, 0.0018, s) * L.brows * (1 - 0.15 * age);
      const dyb = y - cy;
      const prof = sstep(th + 0.0012, th * 0.45, Math.abs(dyb + (dyb > 0 ? 0 : -0.0006))) * sstep(0.0, 0.07, s + 0.03) * sstep(1.05, 0.9, s);
      if (prof > 0.001) {
        // Wuchsrichtung: innen steil nach oben, Mitte schräg, außen flach nach außen
        const an = mix(1.25, 0.18, sstep(0.0, 0.45, s)) - 0.25 * sstep(0.7, 1, s);
        const ux = Math.cos(an) * side, uy = Math.sin(an);
        const u = x * ux + y * uy, v = -x * uy + y * ux;
        const st = vnoise(u * 330, v * 2600, side * 3.3 + 1.7);
        const st2 = vnoise(u * 160, v * 1700, 9.1);
        const hc = prof * (0.35 + 0.65 * sstep(0.42, 0.66, st * 0.7 + st2 * 0.3));
        hairC = Math.max(hairC, Math.min(1, hc * 1.05));
        hgt += hc * 0.00007;
        rough = mix(rough, 0.55, prof);
      }
    }
    // --- Lidränder: Wimpernlinie (oben), feuchter Rand (unten)
    if (lids && front > 0.3) {
      const e = side < 0 ? land.eyeL : land.eyeR;
      const dx = x - (e[0] - HEAD_C[0]), dy = y - (e[1] - HEAD_C[1]), dz = z - (e[2] - HEAD_C[2]);
      const rr = Math.hypot(dx, dy, dz);
      if (rr < er + 0.006 && dz < 0) {
        const el = Math.atan2(dy, -dz), az = Math.atan2(dx, -dz);
        const Ld = lids[side < 0 ? 0 : 1];
        const u = interp(Ld[0], Ld[1], az), l = interp(Ld[0], Ld[2], az);
        const inX = sstep(0.75, 0.55, Math.abs(az - (Ld[0][0] + Ld[0][Ld[0].length - 1]) * 0.5));
        const lash = sstep(0.11, 0.0, el - u) * sstep(-0.02, 0.02, el - u) * inX;
        hairC = Math.max(hairC, lash * 0.95);
        const wet = sstep(0.07, 0.0, l - el) * sstep(-0.03, 0.01, l - el) * inX;
        rough = mix(rough, 0.12, wet);
        r *= 1 + 0.06 * wet; g *= 1 - 0.06 * wet; bl *= 1 - 0.04 * wet;
        const lashLo = sstep(0.05, 0.0, l - el) * sstep(-0.01, 0.01, l - el) * inX * 0.4;
        hairC = Math.max(hairC, lashLo);
      }
    }
    // Ohren: etwas röter, Muschel dunkler
    if (ear > 0.01) occ *= 1 - 0.1 * ear;
    // --- schreiben
    a[o] = Math.round(sat(r * 0.5) * 255); a[o + 1] = Math.round(sat(g * 0.5) * 255); a[o + 2] = Math.round(sat(bl * 0.5) * 255);
    a[o + 3] = Math.round(sat(hairC) * 255);
    b[o] = Math.round(sat(0.5 + hgt / HS * 0.5) * 255);
    b[o + 1] = Math.round(sat(occ) * 255);
    b[o + 2] = Math.round(sat(rough) * 255);
    b[o + 3] = Math.round(sat(dyn) * 255);
  };

  // Rasterung je Viereck (2 Dreiecke) in UV
  const P = new Float32Array(9), U = new Float32Array(6), S = new Float32Array(15);
  const tri = (i0, i1, i2, f) => {
    const corners = [i0, i1, i2];
    for (let c = 0; c < 3; c++) {
      const k = f * 4 + corners[c];
      const p = quads[k], t = quadsUV[k];
      P[c * 3] = pos[p * 3] - HEAD_C[0]; P[c * 3 + 1] = pos[p * 3 + 1] - HEAD_C[1]; P[c * 3 + 2] = pos[p * 3 + 2] - HEAD_C[2];
      U[c * 2] = uv[t * 2] * w - 0.5; U[c * 2 + 1] = uv[t * 2 + 1] * h - 0.5;
      S[c * 5] = ao[p] / 255; for (let m = 0; m < 4; m++) S[c * 5 + 1 + m] = mask[p * 4 + m] / 255;
    }
    const x0 = U[0], y0 = U[1], x1 = U[2], y1 = U[3], x2 = U[4], y2 = U[5];
    const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (Math.abs(den) < 1e-12) return;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2) - 1)), maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2) + 1));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2) - 1)), maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2) + 1));
    const eps = -0.6 / Math.max(1, Math.sqrt(Math.abs(den))); // leicht über die Kante (keine Lücken an Nähten)
    for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
      const l0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / den;
      const l1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / den;
      const l2 = 1 - l0 - l1;
      if (l0 < eps || l1 < eps || l2 < eps) continue;
      const id = py * w + px;
      if (cov[id] === 2) continue;
      const inside = l0 >= 0 && l1 >= 0 && l2 >= 0;
      if (!inside && cov[id]) continue;
      const c0 = Math.max(0, l0), c1 = Math.max(0, l1), c2 = Math.max(0, l2), cs = c0 + c1 + c2;
      const q0 = c0 / cs, q1 = c1 / cs, q2 = c2 / cs;
      const x = P[0] * q0 + P[3] * q1 + P[6] * q2, y = P[1] * q0 + P[4] * q1 + P[7] * q2, z = P[2] * q0 + P[5] * q1 + P[8] * q2;
      shade(id * 4, x, y, z, S[0] * q0 + S[5] * q1 + S[10] * q2, S[1] * q0 + S[6] * q1 + S[11] * q2, S[2] * q0 + S[7] * q1 + S[12] * q2,
        S[3] * q0 + S[8] * q1 + S[13] * q2, S[4] * q0 + S[9] * q1 + S[14] * q2);
      cov[id] = inside ? 2 : 1;
    }
  };
  for (let f = 0; f < nQ; f++) { tri(0, 1, 2, f); tri(0, 2, 3, f); }
  // Ränder auffüllen (Mipmaps ohne Nahtlinien)
  dilate(a, cov, w, h, 6);
  const cov2 = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) cov2[i] = cov[i] ? 1 : 0;
  void texel;
  dilate(b, cov2, w, h, 6);
  return { a, b, w, h, ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 };
}

function dilate(img, cov, w, h, passes) {
  const c = new Uint8Array(cov);
  for (let p = 0; p < passes; p++) {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (c[i]) continue;
      let n = 0, s0 = 0, s1 = 0, s2 = 0, s3 = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (!c[j]) continue;
        n++; s0 += img[j * 4]; s1 += img[j * 4 + 1]; s2 += img[j * 4 + 2]; s3 += img[j * 4 + 3];
      }
      if (n) add.push(i, Math.round(s0 / n), Math.round(s1 / n), Math.round(s2 / n), Math.round(s3 / n));
    }
    for (let k = 0; k < add.length; k += 5) { const i = add[k]; img[i * 4] = add[k + 1]; img[i * 4 + 1] = add[k + 2]; img[i * 4 + 2] = add[k + 3]; img[i * 4 + 3] = add[k + 4]; c[i] = 1; }
  }
}
