// NULLPUNKT — Kopfnetz des Soldaten aus einem anatomischen Grundnetz (ohne three.js, läuft im Hintergrund-Rechner und in Node).
//
// Quelle: MakeHuman-Grundnetz hm08 + Form-Ziele (makehumancommunity/makehuman, Assets CC0 1.0 seit 09/2020), für NULLPUNKT auf
// Kopf + Hals zugeschnitten, ins Modellraum-Maß des Soldaten gebracht, UV neu gepackt (Format 1 : 2) und um prozedurale
// Mimik-Ziele ergänzt (Werkzeug außerhalb des Repos; Ergebnis: assets/lib/models/kopf/kopf.bin + kopf.json):
//   Vierecke (≈ 4 350), Form-Ziele (Alter, Herkunft, Gewicht, Kiefer, Kinn, Nase, Brauenwulst, Wangen, Lippen, Augen,
//   Asymmetrie …) als dünn besetzte Verschiebungen, Mimik-Ziele (Kiefer, Lippen, Lächeln, Brauen, Lider …), Umgebungsverdeckung
//   und Masken (Lippenrot, Mundraum, Augenhöhle, Ohr) je Ecke, Landmarken (Augen, Mundspalt, Kiefergelenk, Lidränder).
//
// buildHeadData(A, res, profile) → Puffer für eine three.js-Geometrie (Positionen im Modellraum der Bindepose, Blick −Z,
// rechts +X): 'mid'/'near' = Grundnetz (≈ 8 700 Dreiecke + Augen/Zähne/Zunge), 'cine' = eine Catmull-Clark-Stufe (≈ 35 000).
// Augäpfel, Zahnreihen und Zunge entstehen hier (Teile im Attribut aRest.w = Verdeckung + 2 × Teil):
//   Teil 0 Haut, 1 Ohr (durchscheinend), 2 Augapfel, 3 Zähne/Zahnfleisch, 4 Zunge, 5 Mundraum.

export const HEAD_C = [0, 1.685, 0.0];
export const FACE_MORPHS = Object.freeze([
  'jawOpen', 'lipsWide', 'lipsRound', 'lipsPress', 'lipsPart', 'lipTuck', 'tongueUp', 'smile', 'frown', 'sneer',
  'browDown', 'browInnerUp', 'browUp', 'blink', 'squint', 'lidWide',
]);
const ASSET_V = '20261123073102';
export const ASSET_URL = new URL('../../../../lib/models/kopf/kopf', import.meta.url).href;

/* ------------------------------------------------------------------ Laden */

let assetP = null;
/** Asset laden (gecacht). → { json, pos, quads, uv, quadsUV, ao, mask, sparse: Map(name → { idx, d }) } */
export function loadHeadAsset(url = ASSET_URL) {
  if (!assetP) {
    assetP = Promise.all([
      fetch(url + '.json?v=' + ASSET_V).then((r) => { if (!r.ok) throw new Error('kopf.json ' + r.status); return r.json(); }),
      fetch(url + '.bin?v=' + ASSET_V).then((r) => { if (!r.ok) throw new Error('kopf.bin ' + r.status); return r.arrayBuffer(); }),
    ]).then(([json, buf]) => parseHeadAsset(json, buf));
    assetP.catch(() => { assetP = null; });
  }
  return assetP;
}

const DT = { '<f4': Float32Array, '<u2': Uint16Array, '|u1': Uint8Array, '<i2': Int16Array };
export function parseHeadAsset(json, buf) {
  const view = (name) => {
    const [off, dt, shape] = json.buf[name];
    const C = DT[dt];
    const n = shape.reduce((a, b) => a * b, 1);
    return new C(buf, off, n);
  };
  const A = { json, land: json.land, pos: view('pos'), quads: view('quads'), uv: view('uv'), quadsUV: view('quadsUV'), ao: view('ao'), mask: view('mask'), sparse: new Map() };
  for (const k of Object.keys(json.buf)) {
    if (!k.endsWith(':i')) continue;
    const name = k.slice(0, -2);
    A.sparse.set(name, { idx: view(k), d: view(name + ':d') });
  }
  return A;
}

/* ------------------------------------------------------------------ Gesichtsprofil (Form) */

const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Kleiner deterministischer Zufall (Mulberry32). */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Profil normalisieren: { age (Jahre), african, asian (0…1, Rest mitteleuropäisch), weight (−1 hager … 1 schwer), muscle (0…1),
 * jaw, chin, nose, noseW, brow, cheek, lips, mouthW, skull, eyes, neck, bags, laugh, fat, prog, angles, cleft (−1…1), asym (0…1),
 * female (0…1, Form-Ziel 'female' = MakeHuman weiblich), seed }
 */
export function normProfile(p = {}) {
  const o = { age: 30, african: 0, asian: 0, female: 0, weight: 0, muscle: 0.3, jaw: 0, chin: 0, nose: 0, noseW: 0, brow: 0, cheek: 0, lips: 0, mouthW: 0, skull: 0, eyes: 0, neck: 0, bags: 0, laugh: 0, fat: 0, prog: 0, angles: 0, cleft: 0, asym: 0.5, seed: 1 };
  for (const k of Object.keys(o)) if (p[k] !== undefined && Number.isFinite(+p[k])) o[k] = +p[k];
  return o;
}

/** Positionen der Grundform mit Profil (Float32 nV×3) + verschobene Augenmitten. */
function shapedPositions(A, P) {
  const pos = new Float32Array(A.pos);
  const q = A.json.qScale;
  const L = A.land;
  const eyeL = L.eyeL.slice(), eyeR = L.eyeR.slice();
  const apply = (name, w) => {
    if (!w) return;
    const s = A.sparse.get('s:' + name);
    if (!s) return;
    const { idx, d } = s;
    const k = w * q;
    for (let i = 0; i < idx.length; i++) { const v = idx[i] * 3; pos[v] += d[i * 3] * k; pos[v + 1] += d[i * 3 + 1] * k; pos[v + 2] += d[i * 3 + 2] * k; }
    // Augäpfel wandern mit dem Lidrand
    const e = L.eyeShift[name];
    if (e) for (let c = 0; c < 3; c++) { eyeL[c] += e[0][c] * w; eyeR[c] += e[1][c] * w; }
  };
  // Alter 25 → 0, 90 → 1 (MakeHuman-Makro); Herkunft als Gewichte
  const a = sat((P.age - 25) / 65);
  const af = sat(P.african), as = sat(P.asian) * (1 - af), cau = 1 - af - as;
  for (const [n, w] of [['old', cau * a], ['african', af * (1 - a)], ['africanOld', af * a], ['asian', as * (1 - a)], ['asianOld', as * a]]) apply(n, w);
  // weiblich (20.11.): MakeHuman caucasian-female-young − caucasian-male-young, am Skelett verankert wie die Herkunftsziele
  apply('female', sat(P.female));
  apply('muscle', sat(P.muscle) * (1 - 0.6 * sat(P.female)));
  if (P.weight > 0) apply('heavy', P.weight); else apply('lean', -P.weight);
  for (const n of ['jaw', 'chin', 'nose', 'noseW', 'brow', 'cheek', 'lips', 'mouthW', 'skull', 'eyes', 'neck', 'bags', 'laugh', 'fat', 'prog', 'angles']) {
    const w = P[n];
    // mensch4: Brauenwulst-Ziel nur noch zu 40 % (Nutzer: „wie Neandertaler mit dieser fetten Stirn“)
    const k = n === 'brow' && w > 0 ? 0.4 : 1;
    if (w > 0) apply(n + '+', Math.min(w, 1.3) * k); else if (w < 0) apply(n + '-', Math.min(-w, 1.3));
  }
  if (P.cleft > 0) apply('cleft', P.cleft);
  // Asymmetrie: echte Gesichter sind nie spiegelgleich (eine Seite voller, ein Auge tiefer, Nasenspitze leicht schief)
  const R = rng(P.seed * 7919 + 13);
  const asy = sat(P.asym);
  apply('asymL', (R() * 0.9) * asy);
  apply('asymR', (R() * 0.9) * asy);
  const blobs = [
    // [cx(±), cy relativ Auge, rx, ry, dx, dy, dz] – Werte in m
    [L.eyeL[0], 0.0, 0.016, 0.012, 0, (R() - 0.5) * 0.0016 * asy, (R() - 0.5) * 0.001 * asy],
    [L.noseTip[0], L.noseTip[1] - L.eyeL[1], 0.012, 0.02, (R() - 0.5) * 0.0024 * asy, 0, 0],
    [L.cornerX * (R() < 0.5 ? -1 : 1), L.slitY - L.eyeL[1], 0.014, 0.012, 0, (R() - 0.4) * 0.0014 * asy, 0],
    [0.05 * (R() < 0.5 ? -1 : 1), -0.075, 0.03, 0.03, (R() - 0.5) * 0.002 * asy, 0, 0],
  ];
  const ey = L.eyeL[1];
  const n = pos.length / 3;
  // mensch4: Stirn steiler und glatter, Brauenwulst flacher. Gemessen (Mittellinie): Stirn 5 cm über der Glabella lag 20–24 mm
  // hinter ihr (fliehende Stirn), Wulst 10–19 mm vor der Hornhaut. Obere Stirn nach vorn (Gaußbuckel um 5 cm über dem Auge),
  // Wulst über den Augen zurück; Frauen etwas stärker (steilere Stirn).
  {
    const bY = L.browY, fem = sat(P.female), bw = Math.max(0, P.brow);
    const fwd = 0.0055 + 0.0025 * fem, back = 0.0018 + 0.0022 * bw * 0.6 + 0.0008 * fem;
    for (let v = 0; v < n; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      if (z > 0.0) continue;
      const front = sstep(0.0, -0.06, z);
      const gF = Math.exp(-(((y - (bY + 0.042)) / 0.03) ** 2) - (x / 0.055) ** 2);
      const gB = Math.exp(-(((y - (bY + 0.002)) / 0.0085) ** 2)) * Math.exp(-(((Math.abs(x) - 0.026) / 0.03) ** 2));
      pos[v * 3 + 2] -= (fwd * gF - back * gB) * front;
    }
  }
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1] - ey;
    for (const [cx, cy, rx, ry, dx, dy, dz] of blobs) {
      const g = Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
      if (g < 1e-3) continue;
      pos[v * 3] += dx * g; pos[v * 3 + 1] += dy * g; pos[v * 3 + 2] += dz * g;
    }
  }
  return { pos, eyeL, eyeR };
}

/** Dichte Ziel-Verschiebungen (Float32 nV×3) eines Mimik-Ziels. */
function denseMorph(A, name, nV) {
  const out = new Float32Array(nV * 3);
  const s = A.sparse.get('m:' + name);
  if (!s) return out;
  const q = A.json.qScale;
  for (let i = 0; i < s.idx.length; i++) { const v = s.idx[i] * 3; out[v] = s.d[i * 3] * q; out[v + 1] = s.d[i * 3 + 1] * q; out[v + 2] = s.d[i * 3 + 2] * q; }
  return out;
}

/* ------------------------------------------------------------------ Catmull-Clark (eine Stufe, als Gewichtsmatrix) */

/**
 * quads (Uint16/32 nQ×4) über nV Ecken → { nV1, quads1, apply(Float32Array(nV×c), c) }. Ränder: Kanten-Mittelpunkt,
 * Randecken (6P + a + b) / 8. Die Gewichte gelten linear – Formziele und Mimik-Ziele werden mit derselben Matrix verfeinert.
 */
export function catmullClark(quads, nV) {
  const nQ = quads.length / 4;
  const edgeId = new Map();
  const eV = [], eF = [];
  const key = (a, b) => (a < b ? a * 65536 + b : b * 65536 + a);
  const qE = new Int32Array(nQ * 4);
  for (let f = 0; f < nQ; f++) for (let i = 0; i < 4; i++) {
    const a = quads[f * 4 + i], b = quads[f * 4 + ((i + 1) & 3)];
    const k = key(a, b);
    let e = edgeId.get(k);
    if (e === undefined) { e = eV.length / 2; edgeId.set(k, e); eV.push(a, b); eF.push(f, -1); } else eF[e * 2 + 1] = f;
    qE[f * 4 + i] = e;
  }
  const nE = eV.length / 2;
  // Zeilen: [0, nV) Eckpunkte, [nV, nV+nE) Kantenpunkte, [nV+nE, …) Flächenpunkte
  const rows = [];
  const faceRow = (f) => { const r = new Map(); for (let i = 0; i < 4; i++) r.set(quads[f * 4 + i], 0.25); return r; };
  const addTo = (r, src, w) => { for (const [k, v] of src) r.set(k, (r.get(k) || 0) + v * w); };
  const faceRows = [];
  for (let f = 0; f < nQ; f++) faceRows.push(faceRow(f));
  const edgeRows = [];
  const vFaces = Array.from({ length: nV }, () => []), vEdges = Array.from({ length: nV }, () => []);
  for (let f = 0; f < nQ; f++) for (let i = 0; i < 4; i++) vFaces[quads[f * 4 + i]].push(f);
  for (let e = 0; e < nE; e++) {
    const a = eV[e * 2], b = eV[e * 2 + 1];
    vEdges[a].push(e); vEdges[b].push(e);
    const r = new Map();
    if (eF[e * 2 + 1] < 0) { r.set(a, 0.5); r.set(b, 0.5); } else {
      r.set(a, 0.25); r.set(b, 0.25);
      addTo(r, faceRows[eF[e * 2]], 0.25); addTo(r, faceRows[eF[e * 2 + 1]], 0.25);
    }
    edgeRows.push(r);
  }
  for (let v = 0; v < nV; v++) {
    const r = new Map();
    const es = vEdges[v];
    if (!es.length) { r.set(v, 1); rows.push(r); continue; }
    const bnd = es.filter((e) => eF[e * 2 + 1] < 0);
    if (bnd.length >= 2) {
      r.set(v, 0.75);
      for (const e of bnd.slice(0, 2)) { const o = eV[e * 2] === v ? eV[e * 2 + 1] : eV[e * 2]; r.set(o, (r.get(o) || 0) + 0.125); }
    } else {
      const n = es.length, fs = vFaces[v];
      r.set(v, (n - 3) / n);
      for (const f of fs) addTo(r, faceRows[f], 1 / (fs.length * n));
      // R = Mittel der Kanten-Mittelpunkte, Gewicht 2/n
      for (const e of es) { r.set(eV[e * 2], (r.get(eV[e * 2]) || 0) + 1 / (n * es.length)); r.set(eV[e * 2 + 1], (r.get(eV[e * 2 + 1]) || 0) + 1 / (n * es.length)); }
    }
    rows.push(r);
  }
  for (const r of edgeRows) rows.push(r);
  for (const r of faceRows) rows.push(r);
  // CSR
  const nV1 = rows.length;
  let nnz = 0;
  for (const r of rows) nnz += r.size;
  const ptr = new Int32Array(nV1 + 1), col = new Int32Array(nnz), wt = new Float32Array(nnz);
  let k = 0;
  for (let i = 0; i < nV1; i++) { ptr[i] = k; for (const [c, w] of rows[i]) { col[k] = c; wt[k] = w; k++; } }
  ptr[nV1] = k;
  const quads1 = new Uint32Array(nQ * 16);
  for (let f = 0; f < nQ; f++) {
    const fp = nV + nE + f;
    for (let i = 0; i < 4; i++) {
      const v = quads[f * 4 + i], eNext = qE[f * 4 + i], ePrev = qE[f * 4 + ((i + 3) & 3)];
      const o = f * 16 + i * 4;
      quads1[o] = v; quads1[o + 1] = nV + eNext; quads1[o + 2] = fp; quads1[o + 3] = nV + ePrev;
    }
  }
  const apply = (src, c = 3) => {
    const out = new Float32Array(nV1 * c);
    for (let i = 0; i < nV1; i++) {
      for (let j = ptr[i]; j < ptr[i + 1]; j++) {
        const s = col[j] * c, w = wt[j];
        for (let t = 0; t < c; t++) out[i * c + t] += src[s + t] * w;
      }
    }
    return out;
  };
  return { nV1, nE, quads1, apply, qE, edgeKey: key, edgeId };
}

/** UV (flächenweise) linear mitverfeinern: gleiche Viereck-Teilung wie catmullClark. */
function subdivideUV(quadsUV, uv, nQ) {
  const out = Array.from(uv);
  const nUV = uv.length / 2;
  const mid = new Map();
  const midOf = (a, b) => {
    const k = a < b ? a * 65536 + b : b * 65536 + a;
    let m = mid.get(k);
    if (m === undefined) { m = out.length / 2; out.push((uv[a * 2] + uv[b * 2]) * 0.5, (uv[a * 2 + 1] + uv[b * 2 + 1]) * 0.5); mid.set(k, m); }
    return m;
  };
  const q1 = new Uint32Array(nQ * 16);
  for (let f = 0; f < nQ; f++) {
    const c = [quadsUV[f * 4], quadsUV[f * 4 + 1], quadsUV[f * 4 + 2], quadsUV[f * 4 + 3]];
    const fc = out.length / 2;
    out.push((uv[c[0] * 2] + uv[c[1] * 2] + uv[c[2] * 2] + uv[c[3] * 2]) * 0.25, (uv[c[0] * 2 + 1] + uv[c[1] * 2 + 1] + uv[c[2] * 2 + 1] + uv[c[3] * 2 + 1]) * 0.25);
    for (let i = 0; i < 4; i++) {
      const o = f * 16 + i * 4;
      q1[o] = c[i]; q1[o + 1] = midOf(c[i], c[(i + 1) & 3]); q1[o + 2] = fc; q1[o + 3] = midOf(c[(i + 3) & 3], c[i]);
    }
  }
  void nUV;
  return { uv: new Float32Array(out), quadsUV: q1 };
}

/* ------------------------------------------------------------------ Normalen */

function quadNormals(pos, quads, nV) {
  const N = new Float32Array(nV * 3);
  const nQ = quads.length / 4;
  for (let f = 0; f < nQ; f++) {
    const a = quads[f * 4] * 3, b = quads[f * 4 + 1] * 3, c = quads[f * 4 + 2] * 3, d = quads[f * 4 + 3] * 3;
    // Kreuzprodukt der Diagonalen (= doppelte Fläche × Normale)
    const ux = pos[c] - pos[a], uy = pos[c + 1] - pos[a + 1], uz = pos[c + 2] - pos[a + 2];
    const vx = pos[d] - pos[b], vy = pos[d + 1] - pos[b + 1], vz = pos[d + 2] - pos[b + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c, d]) { N[v] += nx; N[v + 1] += ny; N[v + 2] += nz; }
  }
  for (let v = 0; v < nV; v++) { const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1; N[v * 3] /= l; N[v * 3 + 1] /= l; N[v * 3 + 2] /= l; }
  return N;
}

/* ------------------------------------------------------------------ Zusatzteile: Augäpfel, Zähne, Zunge */

/** Kugel (Augapfel) um c mit Radius r: Pole vorn/hinten (−Z ist vorn), feine Ringe vorn (Iris). */
function eyeball(out, c, r, segU, segV) {
  const base = out.pos.length / 3;
  for (let j = 0; j <= segV; j++) {
    const t = (j / segV) ** 1.15 * Math.PI; // vorn dichter
    const st = Math.sin(t), ct = Math.cos(t);
    for (let i = 0; i < segU; i++) {
      const p = (i / segU) * Math.PI * 2;
      const nx = st * Math.cos(p), ny = st * Math.sin(p), nz = -ct;
      out.pos.push(c[0] + nx * r, c[1] + ny * r, c[2] + nz * r);
      out.nrm.push(nx, ny, nz);
      out.part.push(2); out.ao.push(1); out.jaw.push(0); out.tip.push(0);
    }
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = base + j * segU + i, b = base + j * segU + ((i + 1) % segU), c2 = a + segU, d = b + segU;
    out.idx.push(a, c2, b, b, c2, d);
  }
}

/** Zahnreihe als gebogenes Band (Hufeisen): Schneidekante unten (oben) – Zahnzwischenräume im Shader. */
function teethArch(out, L, upper, segA, jawW) {
  const base = out.pos.length / 3;
  const front = L.mouthFront + 0.0125 + (upper ? 0 : 0.0016); // hinter den Lippen, unten mit Überbiss
  const yEdge = L.slitY + (upper ? -0.0015 : -0.0022);
  const h = upper ? 0.0105 : 0.0095; // sichtbare Kronenhöhe + Zahnfleisch
  const halfW = 0.0235, depth = 0.034;
  const rows = 4; // Schneidekante gerundet, Fläche, Zahnfleisch, Rücksprung
  for (let i = 0; i <= segA; i++) {
    const s = (i / segA) * 2 - 1; // −1 … 1
    const ang = s * 1.45;
    const x = Math.sin(ang) * halfW * (1 + 0.15 * Math.abs(s));
    const zz = front + (1 - Math.cos(ang)) * depth * 0.62;
    const nx = Math.sin(ang), nz = -Math.cos(ang);
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const dy = (upper ? 1 : -1) * h * t;
      const inset = r === 0 ? 0.0012 : r === rows ? 0.003 : 0;
      out.pos.push(x - nx * inset, yEdge + dy, zz - nz * inset);
      const ny = r === 0 ? (upper ? -0.7 : 0.7) : 0;
      const l = Math.hypot(nx, ny, nz);
      out.nrm.push(nx / l, ny / l, nz / l);
      out.part.push(3); out.ao.push(0.55 + 0.45 * (1 - Math.abs(s) ** 2)); out.jaw.push(jawW); out.tip.push(0);
      out.toothU.push(s, t);
    }
  }
  const W = rows + 1;
  for (let i = 0; i < segA; i++) for (let r = 0; r < rows; r++) {
    const a = base + i * W + r, b = a + W, c = a + 1, d = b + 1;
    if (upper) out.idx.push(a, b, c, c, b, d); else out.idx.push(a, c, b, c, d, b);
  }
}

/** Zunge: abgeflachtes Ellipsoid im Unterkiefer, Spitze (tip-Gewicht) hebt sich bei L/D/N. */
function tongue(out, L, segU, segV) {
  const base = out.pos.length / 3;
  const cy = L.slitY - 0.0085, cz = L.mouthFront + 0.032;
  const rx = 0.021, ry = 0.0065, rz = 0.03;
  for (let j = 0; j <= segV; j++) {
    const t = (j / segV) * Math.PI;
    for (let i = 0; i < segU; i++) {
      const p = (i / segU) * Math.PI * 2;
      let nx = Math.sin(t) * Math.cos(p), ny = Math.sin(t) * Math.sin(p), nz = -Math.cos(t);
      const x = nx * rx, y = ny * ry * (ny > 0 ? 1 : 0.6), z = nz * rz;
      out.pos.push(x, cy + y, cz + z);
      const l = Math.hypot(nx / rx, ny / ry, nz / rz);
      out.nrm.push(nx / rx / l, ny / ry / l, nz / rz / l);
      out.part.push(4); out.ao.push(0.5); out.jaw.push(1);
      out.tip.push(sstep(0.0, -0.025, z));
    }
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = base + j * segU + i, b = base + j * segU + ((i + 1) % segU), c = a + segU, d = b + segU;
    out.idx.push(a, b, c, b, d, c);
  }
}

/* ------------------------------------------------------------------ Hauptfunktion */

/**
 * mensch4 (Nutzer: Mund, Nase, Lippen viel zu deutlich durch die Maske): Hülle für Stoff über dem Gesicht (Sturmhaube,
 * Halstuch, Shemagh). Stoff liegt nicht 1:1 auf, er spannt sich über die vorstehenden Stellen: wiederholtes Glätten
 * (Umbrella-Operator über die Viereck-Nachbarn) mit Zeltbedingung – eine Ecke darf höchstens `allow` hinter die Haut
 * (Nasenspitze, Kinn, Wangen halten den Stoff; Lippen bis 4,5 mm, damit Lippenwulst und Mundspalt verschwinden),
 * Vertiefungen (Mundspalt, Nasenflügelfurche, Lippen-Kinn-Furche, Philtrum) füllen sich. Nur unterhalb der Augen
 * (Augenschlitz/Stirn bleiben), Ohren und Mundraum ausgenommen. → Positionen der Hülle (Float32 nV×3).
 */
function coverShell(pos, nrm, quads, nV, mask, L) {
  // Tiefenkarte z(x, y) der Gesichtsvorderseite (Raster 2 mm, ohne Mundraum/Ohren), dann wiederholt weichgezeichnet mit
  // Zeltbedingung „höchstens allow hinter der Haut“ (z wächst nach hinten). Vorderseiten-Ecken gehen auf diese Fläche (nur z):
  // kein seitliches Gleiten, der Mundspalt schließt sich wie eine gespannte Stoffbahn.
  const eyeY = (L.eyeL[1] + L.eyeR[1]) / 2;
  const x0 = -0.085, y0 = L.chin[1] - 0.04, y1 = eyeY + 0.004, c = 0.002;
  const NX = Math.ceil((0.085 - x0) / c) + 1, NY = Math.ceil((y1 - y0) / c) + 1;
  const D = new Float32Array(NX * NY).fill(Infinity), AL = new Float32Array(NX * NY), AN = new Float32Array(NX * NY);
  const front = (v) => nrm[v * 3 + 2] < -0.25 && pos[v * 3 + 2] < -0.02;
  for (let v = 0; v < nV; v++) {
    if (mask[v * 4 + 1] > 0.5 || mask[v * 4 + 3] > 0.5 || !front(v)) continue;
    const i = Math.round((pos[v * 3] - x0) / c), j = Math.round((pos[v * 3 + 1] - y0) / c);
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= NX || jj >= NY) continue;
      const k = jj * NX + ii;
      const z = pos[v * 3 + 2] + 0.0004 * (di * di + dj * dj); // grob gerastert: nahe Ecken zählen mehr
      if (z < D[k]) D[k] = z;
      AL[k] += sat(mask[v * 4] * 1.4); AN[k] += 1;
    }
  }
  // Lücken (Mundspalt, Nasenlöcher) aus den Nachbarn füllen
  for (let it = 0; it < 12; it++) for (let k = 0; k < D.length; k++) if (!Number.isFinite(D[k])) {
    const i = k % NX, j = (k / NX) | 0; let s_ = 0, n_ = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= NX || jj >= NY) continue; const q = D[jj * NX + ii]; if (Number.isFinite(q)) { s_ += q; n_++; } }
    if (n_) D[k] = s_ / n_ - 1e-6;
  }
  const allow = new Float32Array(D.length);
  for (let k = 0; k < D.length; k++) allow[k] = 0.0012 + 0.0034 * (AN[k] ? AL[k] / AN[k] : 0);
  // Lippenmaske weich (keine Stufe am Lippenrand)
  const blur = (A, n) => { let B = A; for (let it = 0; it < n; it++) { const C = new Float32Array(B.length); for (let k = 0; k < B.length; k++) { const i = k % NX, j = (k / NX) | 0; let s_ = B[k] * 2, w_ = 2; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= NX || jj >= NY || !Number.isFinite(B[jj * NX + ii])) continue; s_ += B[jj * NX + ii]; w_++; } C[k] = s_ / w_; } B = C; } return B; };
  const AW = blur(allow, 6);
  let Z = Float32Array.from(D, (z) => (Number.isFinite(z) ? z : 0));
  const ok = Uint8Array.from(D, (z) => (Number.isFinite(z) ? 1 : 0));
  for (let it = 0; it < 70; it++) {
    const B = blur(Z, 1);
    for (let k = 0; k < Z.length; k++) Z[k] = ok[k] ? Math.min(B[k], D[k] + AW[k]) : B[k];
  }
  const zAt = (x, y) => {
    const fx = (x - x0) / c, fy = (y - y0) / c, i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i + 1 >= NX || j + 1 >= NY) return NaN;
    const tx = fx - i, ty = fy - j, k = j * NX + i;
    return (Z[k] * (1 - tx) + Z[k + 1] * tx) * (1 - ty) + (Z[k + NX] * (1 - tx) + Z[k + NX + 1] * tx) * ty;
  };
  // Verschiebung (nur z) je Ecke, über die Nachbarn geglättet (keine Falten zwischen verschobenen und festen Ecken)
  const dz = new Float32Array(nV), wv = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    if (mask[v * 4 + 3] > 0.5) continue;
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const inner = mask[v * 4 + 1] > 0.5;
    if (!inner && !(nrm[v * 3 + 2] < -0.05 && z < -0.02)) continue;
    const zs = zAt(x, y);
    if (!Number.isFinite(zs)) continue;
    const wy = (1 - sstep(eyeY - 0.024, eyeY - 0.008, y)) * sstep(y0 + 0.004, y0 + 0.02, y);
    const wx = 1 - sstep(0.055, 0.078, Math.abs(x));
    wv[v] = wy * wx * (inner ? 1 : sstep(-0.05, -0.4, nrm[v * 3 + 2]));
    // Mundraum knapp hinter die Stoffbahn (sonst flimmert er mit den Lippen)
    dz[v] = inner ? Math.min(0, zs + 0.0025 - z) : zs - z;
  }
  const nb = Array.from({ length: nV }, () => []);
  for (let f = 0; f < quads.length; f += 4) for (let i = 0; i < 4; i++) { const a = quads[f + i], b = quads[f + ((i + 1) & 3)]; nb[a].push(b); nb[b].push(a); }
  let W = Float32Array.from(wv, (w_, v) => w_ * dz[v]);
  let Wn = Float32Array.from(wv);
  for (let it = 0; it < 3; it++) {
    const A = new Float32Array(nV), B = new Float32Array(nV);
    for (let v = 0; v < nV; v++) { let a_ = W[v] * 2, b_ = Wn[v] * 2, n_ = 2; for (const u of nb[v]) { a_ += W[u]; b_ += Wn[u]; n_++; } A[v] = a_ / n_; B[v] = b_ / n_; }
    W = A; Wn = B;
  }
  const S = new Float32Array(pos);
  for (let v = 0; v < nV; v++) if (wv[v] > 0 || Wn[v] > 0) S[v * 3 + 2] = pos[v * 3 + 2] + (mask[v * 4 + 1] > 0.5 ? dz[v] * wv[v] : W[v]);
  return S;
}

export const FACE_RES = Object.freeze({ cine: { sub: 1, eye: [32, 20], arch: 40, tongue: [16, 10] }, near: { sub: 0, eye: [20, 12], arch: 22, tongue: [10, 6] }, mid: { sub: 0, eye: [12, 8], arch: 12, tongue: [8, 5] } });

/**
 * Kopfnetz bauen. → { n, pos, nrm, uv, rest(4), ski/skw (Uint8×4), idx, morphs: [{ name, pos, nrm }], eye: { L, R, r }, triangles, ms }
 */
export function buildHeadData(A, res = 'near', profile = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const R = FACE_RES[res] || FACE_RES.near;
  const P = normProfile(profile);
  const L = A.land;
  const nV0 = A.json.nV;
  const { pos: pos0, eyeL, eyeR } = shapedPositions(A, P);
  const morph0 = FACE_MORPHS.map((n) => denseMorph(A, n, nV0));
  const ao0 = new Float32Array(nV0), mask0 = new Float32Array(nV0 * 4);
  for (let v = 0; v < nV0; v++) { ao0[v] = A.ao[v] / 255; for (let c = 0; c < 4; c++) mask0[v * 4 + c] = A.mask[v * 4 + c] / 255; }
  let pos = pos0, morph = morph0, ao = ao0, mask = mask0, quads = A.quads, quadsUV = A.quadsUV, uv = A.uv, nV = nV0;
  if (R.sub) {
    const cc = catmullClark(A.quads, nV0);
    pos = cc.apply(pos0, 3);
    morph = morph0.map((m) => cc.apply(m, 3));
    ao = cc.apply(ao0, 1);
    mask = cc.apply(mask0, 4);
    const su = subdivideUV(A.quadsUV, A.uv, A.quads.length / 4);
    quads = cc.quads1; quadsUV = su.quadsUV; uv = su.uv; nV = cc.nV1;
  }
  const nrm = quadNormals(pos, quads, nV);
  const shell = coverShell(pos, nrm, quads, nV, mask, L);
  const shellN = quadNormals(shell, quads, nV);
  // Mimik-Normalen: Normalen der verformten Fläche − Ruhe-Normalen
  const tmp = new Float32Array(pos.length);
  const morphN = morph.map((m) => {
    let any = false;
    for (let i = 0; i < m.length; i++) { tmp[i] = pos[i] + m[i]; if (m[i] !== 0) any = true; }
    if (!any) return new Float32Array(m.length);
    const n2 = quadNormals(tmp, quads, nV);
    for (let i = 0; i < n2.length; i++) n2[i] -= nrm[i];
    return n2;
  });
  // Render-Ecken: (Position, UV)-Paare
  const nQ = quads.length / 4;
  const pairId = new Map();
  const rv = []; // [posIdx, uvIdx]
  const corner = new Uint32Array(nQ * 4);
  for (let f = 0; f < nQ; f++) for (let i = 0; i < 4; i++) {
    const p = quads[f * 4 + i], t = quadsUV[f * 4 + i];
    const k = p * 65536 * 2 + t;
    let id = pairId.get(k);
    if (id === undefined) { id = rv.length / 2; pairId.set(k, id); rv.push(p, t); }
    corner[f * 4 + i] = id;
  }
  const nSkin = rv.length / 2;
  // Zusatzteile sammeln
  const X = { pos: [], nrm: [], part: [], ao: [], jaw: [], tip: [], idx: [], toothU: [] };
  const er = L.eyeRadius + 0.0002;
  eyeball(X, eyeL, er, R.eye[0], R.eye[1]);
  eyeball(X, eyeR, er, R.eye[0], R.eye[1]);
  const nEye = X.pos.length / 3;
  teethArch(X, L, true, R.arch, 0);
  const nUp = X.pos.length / 3;
  teethArch(X, L, false, R.arch, 1);
  const nTeeth = X.pos.length / 3;
  tongue(X, L, R.tongue[0], R.tongue[1]);
  const nX = X.pos.length / 3;
  const n = nSkin + nX;
  const D = { n, pos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), uv: new Float32Array(n * 2), rest: new Float32Array(n * 4), cov: new Float32Array(n * 3), covN: new Float32Array(n * 3) };
  const parts = new Uint8Array(n);
  for (let i = 0; i < nSkin; i++) {
    const p = rv[i * 2], t = rv[i * 2 + 1];
    for (let c = 0; c < 3; c++) { D.pos[i * 3 + c] = pos[p * 3 + c]; D.nrm[i * 3 + c] = nrm[p * 3 + c]; D.cov[i * 3 + c] = shell[p * 3 + c] - pos[p * 3 + c]; D.covN[i * 3 + c] = shellN[p * 3 + c]; }
    D.uv[i * 2] = uv[t * 2]; D.uv[i * 2 + 1] = uv[t * 2 + 1];
    const mIn = mask[p * 4 + 1], ear = mask[p * 4 + 3];
    parts[i] = mIn > 0.5 ? 5 : ear > 0.5 ? 1 : 0;
    D.rest[i * 4 + 3] = Math.min(1, Math.max(0, ao[p])) + 2 * parts[i];
  }
  for (let j = 0; j < nX; j++) {
    const i = nSkin + j;
    for (let c = 0; c < 3; c++) { D.pos[i * 3 + c] = X.pos[j * 3 + c]; D.nrm[i * 3 + c] = X.nrm[j * 3 + c]; D.covN[i * 3 + c] = X.nrm[j * 3 + c]; }
    parts[i] = X.part[j];
    // Zähne: UV = (Bogen −1…1, Höhe 0…1) für Zahnzwischenräume/Zahnfleisch im Shader
    if (j >= nEye && j < nTeeth) { const k = (j - nEye) * 2; D.uv[i * 2] = X.toothU[k]; D.uv[i * 2 + 1] = X.toothU[k + 1] + (j >= nUp ? 2 : 0); }
    D.rest[i * 4 + 3] = X.ao[j] + 2 * parts[i];
  }
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) D.rest[i * 4 + c] = D.pos[i * 3 + c] - HEAD_C[c];
  // Dreiecke (kürzere Diagonale)
  const idx = [];
  for (let f = 0; f < nQ; f++) {
    const a = corner[f * 4], b = corner[f * 4 + 1], c = corner[f * 4 + 2], d = corner[f * 4 + 3];
    const pa = rv[a * 2] * 3, pb = rv[b * 2] * 3, pc = rv[c * 2] * 3, pd = rv[d * 2] * 3;
    const d1 = (pos[pa] - pos[pc]) ** 2 + (pos[pa + 1] - pos[pc + 1]) ** 2 + (pos[pa + 2] - pos[pc + 2]) ** 2;
    const d2 = (pos[pb] - pos[pd]) ** 2 + (pos[pb + 1] - pos[pd + 1]) ** 2 + (pos[pb + 2] - pos[pd + 2]) ** 2;
    if (d1 <= d2) idx.push(a, b, c, a, c, d); else idx.push(a, b, d, b, c, d);
  }
  // Zusatzteile: Wicklung je Dreieck an den Normalen ausrichten (außen = sichtbar)
  for (let t = 0; t < X.idx.length; t += 3) {
    const a = X.idx[t], b = X.idx[t + 1], c = X.idx[t + 2], Q = X.pos, Nn = X.nrm;
    const ux = Q[b * 3] - Q[a * 3], uy = Q[b * 3 + 1] - Q[a * 3 + 1], uz = Q[b * 3 + 2] - Q[a * 3 + 2];
    const vx = Q[c * 3] - Q[a * 3], vy = Q[c * 3 + 1] - Q[a * 3 + 1], vz = Q[c * 3 + 2] - Q[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const dn = fx * (Nn[a * 3] + Nn[b * 3] + Nn[c * 3]) + fy * (Nn[a * 3 + 1] + Nn[b * 3 + 1] + Nn[c * 3 + 1]) + fz * (Nn[a * 3 + 2] + Nn[b * 3 + 2] + Nn[c * 3 + 2]);
    if (dn >= 0) idx.push(a + nSkin, b + nSkin, c + nSkin); else idx.push(a + nSkin, c + nSkin, b + nSkin);
  }
  D.idx = n > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
  // Hautgewichte: Kopf (4) oben, Hals (3) unten; Zusatzteile Kopf
  D.ski = new Uint8Array(n * 4); D.skw = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const y = D.rest[i * 4 + 1];
    const wHead = i >= nSkin ? 1 : sstep(-0.125, -0.055, y);
    D.ski[i * 4] = 4; D.ski[i * 4 + 1] = 3;
    const a8 = Math.round(wHead * 255);
    D.skw[i * 4] = a8; D.skw[i * 4 + 1] = 255 - a8;
  }
  // Mimik-Ziele auf die Render-Ecken; Zusatzteile: Unterkiefer (Zähne unten, Zunge) dreht mit, Zungenspitze hebt sich
  const jawA = L.jawAngle, piv = L.tmj, glide = L.jawGlide;
  const ca = Math.cos(jawA), sa = Math.sin(jawA);
  D.morphs = FACE_MORPHS.map((name, k) => {
    const mp = new Float32Array(n * 3), mn = new Float32Array(n * 3);
    const M = morph[k], MN = morphN[k];
    for (let i = 0; i < nSkin; i++) { const p = rv[i * 2] * 3; for (let c = 0; c < 3; c++) { mp[i * 3 + c] = M[p + c]; mn[i * 3 + c] = MN[p + c]; } }
    for (let j = 0; j < nX; j++) {
      const i = nSkin + j;
      if (name === 'jawOpen' && X.jaw[j] > 0) {
        const y = X.pos[j * 3 + 1] - piv[1], z = X.pos[j * 3 + 2] - piv[2];
        mp[i * 3 + 1] = (y * ca + z * sa - y + glide[1]) * X.jaw[j];
        mp[i * 3 + 2] = (-y * sa + z * ca - z + glide[2]) * X.jaw[j];
        const ny = X.nrm[j * 3 + 1], nz = X.nrm[j * 3 + 2];
        mn[i * 3 + 1] = (ny * ca + nz * sa - ny) * X.jaw[j];
        mn[i * 3 + 2] = (-ny * sa + nz * ca - nz) * X.jaw[j];
      } else if (name === 'tongueUp' && X.tip[j] > 0) {
        mp[i * 3 + 1] = 0.0085 * X.tip[j];
        mp[i * 3 + 2] = -0.004 * X.tip[j];
      } else if (name === 'lipTuck' && X.jaw[j] > 0 && X.part[j] === 3) {
        // F/V: Unterkiefer leicht vor, damit die Unterlippe unter die oberen Schneidezähne kommt
        mp[i * 3 + 2] = -0.0008;
      }
    }
    return { name, pos: mp, nrm: mn };
  });
  D.eye = { L: eyeL, R: eyeR, r: er };
  D.triangles = D.idx.length / 3;
  D.nSkin = nSkin;
  D.ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return D;
}

/** Übertragbare Puffer (postMessage) eines buildHeadData-Ergebnisses. */
export function transferList(D) {
  const tr = [D.pos.buffer, D.nrm.buffer, D.uv.buffer, D.rest.buffer, D.idx.buffer, D.ski.buffer, D.skw.buffer];
  if (D.cov) tr.push(D.cov.buffer, D.covN.buffer);
  for (const m of D.morphs) tr.push(m.pos.buffer, m.nrm.buffer);
  return tr;
}
