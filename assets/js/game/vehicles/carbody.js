// NULLPUNKT — Karosserien als Unterteilungsflächen (Nutzer 15.11.: Autos „immer noch absolut unrealistisch und kastig“).
//
// Statt Querschnitts-Lofts (bodykit.js) ein grober Kontrollkäfig aus Vierecken je Fahrzeugtyp, der per Catmull-Clark
// (engine/subsurf.js) zu glatten Blechflächen verfeinert wird. Topologie wie im Karosseriebau üblich:
//   • Mantel (Band): läuft einmal um das Fahrzeug – Seiten, Bug, Heck – von der Unterkante (Schweller, Radläufe als
//     offener Rand mit Bördelkante, Stoßfänger-Unterkante) bis zur Schulter-/Gürtellinie (bzw. Haubenvorderkante,
//     Heckklappenkante). Ebenen (levels) = Längslinien: Schwellerkante, Türunterteil, Charakterlinie, Schulter …
//   • Deckel (Gitter): Haube, Windschutzscheibe, A-Säule, Seitenscheiben, Dach, Heckscheibe, Kofferraum als ein Gitter
//     über die Fahrzeuglänge (Zeilen = Schnitte) und quer (Spalten: Gürtel, Scheibenunterkante, Scheibenoberkante,
//     Dachkante, Dach, Mitte). Die vier Ecken des Deckels sind die einzigen Sonderpunkte (Wertigkeit 3).
// Scheiben, Leuchten, Grill, Zierleisten sind Flächenmarken desselben Netzes → bündig in der Fläche; Materialgrenzen und
// Charakterlinien sind (halb)scharfe Kanten. Nach der Unterteilung: Siebdruckrand (Fritting) als Flächenring am Rand der
// Scheiben, Fugen (Türen, Haube, Klappe) als feine Bänder, Innenhaut (Türverkleidung/Himmel), Schmutz-/Abriebmasken je
// Ecke (Attribut aCv: x = Spritzschmutz hinter den Rädern, y = Wölbung → Kantenabrieb im Lack-Shader).
//
// carBody(kind, opts) → { parts: Map(marke → BufferGeometry), seams, inner: { trim, dark }, meta } – zwischengespeichert,
// jeder Aufruf liefert eigene Kopien (Bucket.add verwirft die übergebene Geometrie). Reines JS + three (Worker-tauglich).
// Lage: vorwärts −z, x rechts, y oben, y = 0 Boden.
import * as THREE from 'three';
import { subdivide, toGeometry, cornerNormals, faceNormals, vertexFaces, vertexNormals, borderFaces, seamGeometry, edgeKey, toLimit } from '../engine/subsurf.js?v=20261121041936';
import { curve } from './bodykit.js?v=20261121041936';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Flächenmarken. */
export const TAG = { PAINT: 1, GLASS: 2, TRIM: 3, LAMP: 4, RLAMP: 5, GRILLE: 6, PLASTIC: 7, CHROME: 8, FRIT: 9, AMBER: 10, DARK: 11 };
const SOLID = new Set([TAG.PAINT, TAG.TRIM, TAG.GRILLE, TAG.PLASTIC, TAG.CHROME, TAG.DARK]);

/* ------------------------------------------------------------------ Käfig: Mantel + Deckel */

/**
 * D = { J (gerade), K, zs [NS+1], top(s, j) → [x,y,z] (j ≤ J/2, rechte Hälfte), side(s, k), front(j, k), rear(j, k) (k < K),
 *       tagBand(info), tagTop(info), edge(info) → { c, seam } }
 * Vorne/Hinten: j in 1 … J−1 (Spiegelung für j > J/2). → { M, NS, NP, top(s, j) Index, band(p, k) Index }
 */
export function blanket(D) {
  const { J, K, zs } = D, NS = zs.length - 1, NP = 2 * NS + 2 * J, H = J / 2;
  const P = [];
  const add = (p) => { P.push(p[0], p[1], p[2]); return P.length / 3 - 1; };
  const mir = (p) => [-p[0], p[1], p[2]];
  // Deckel
  const Ti = [];
  for (let s = 0; s <= NS; s++) {
    const row = [];
    for (let j = 0; j <= J; j++) row.push(add(j <= H ? D.top(s, j) : mir(D.top(s, J - j))));
    Ti.push(row);
  }
  const topB = (p) => {
    p = ((p % NP) + NP) % NP;
    if (p <= NS) return Ti[p][0];
    if (p < NS + J) return Ti[NS][p - NS];
    if (p <= 2 * NS + J) return Ti[NS - (p - NS - J)][J];
    return Ti[0][J - (p - 2 * NS - J)];
  };
  const kindOf = (p) => {
    p = ((p % NP) + NP) % NP;
    if (p <= NS) return { kind: 'side', i: p, sx: 1 };
    if (p < NS + J) return { kind: 'rear', i: p - NS };
    if (p <= 2 * NS + J) return { kind: 'side', i: NS - (p - NS - J), sx: -1 };
    return { kind: 'front', i: J - (p - 2 * NS - J) };
  };
  const Bi = [];
  for (let p = 0; p < NP; p++) {
    const col = [];
    const { kind, i, sx } = kindOf(p);
    for (let k = 0; k < K; k++) {
      let q;
      if (kind === 'side') { q = D.side(i, k); if (sx < 0) q = mir(q); } else {
        const f = kind === 'front' ? D.front : D.rear;
        q = i <= H ? f(i, k) : mir(f(J - i, k));
      }
      col.push(add(q));
    }
    col.push(topB(p));
    Bi.push(col);
  }
  const Q = [], F = [], crease = new Map(), seam = new Map();
  const quad = (a, b, c, d, tag) => { if (!tag) return; Q.push(a, b, c, d); F.push(tag); };
  const edge = (a, b, info) => {
    const r = D.edge ? D.edge(info) : null;
    if (!r) return;
    const k = edgeKey(a, b);
    if (r.c) crease.set(k, Math.max(crease.get(k) || 0, r.c));
    if (r.seam) seam.set(k, r.seam);
  };
  const half = (j) => Math.min(j, J - 1 - j);
  // Mantel-Flächen
  for (let p = 0; p < NP; p++) {
    const A = kindOf(p), B = kindOf(p + 1);
    let info;
    if (p < NS) info = { kind: 'side', s: p, sx: 1 };
    else if (p < NS + J) info = { kind: 'rear', jj: half(p - NS), j: p - NS };
    else if (p < 2 * NS + J) info = { kind: 'side', s: B.i, sx: -1 };
    else info = { kind: 'front', jj: half(A.i - 1), j: A.i - 1 };
    for (let k = 0; k < K; k++) {
      quad(Bi[p][k], Bi[p][k + 1], Bi[(p + 1) % NP][k + 1], Bi[(p + 1) % NP][k], D.tagBand({ ...info, k }));
      edge(Bi[p][k], Bi[(p + 1) % NP][k], { zone: 'bandH', ...info, k });
    }
    const vi = A.kind === 'side' ? { kind: 'side', s: A.i, sx: A.sx } : { kind: A.kind, jv: Math.min(A.i, J - A.i) };
    for (let k = 0; k < K; k++) edge(Bi[p][k], Bi[p][k + 1], { zone: 'bandV', ...vi, k });
  }
  // Deckel-Flächen
  for (let s = 0; s < NS; s++) for (let j = 0; j < J; j++) {
    quad(Ti[s][j], Ti[s][j + 1], Ti[s + 1][j + 1], Ti[s + 1][j], D.tagTop({ s, jj: half(j), j, z0: zs[s], z1: zs[s + 1] }));
  }
  for (let s = 0; s <= NS; s++) for (let j = 0; j < J; j++) edge(Ti[s][j], Ti[s][j + 1], { zone: 'row', s, jj: half(j) });
  for (let s = 0; s < NS; s++) for (let j = 0; j <= J; j++) edge(Ti[s][j], Ti[s + 1][j], { zone: 'col', s, jv: Math.min(j, J - j), z0: zs[s], z1: zs[s + 1] });
  // Materialgrenzen scharf (Scheiben, Leuchten, Grill bündig mit klarer Kante)
  const eF = new Map();
  for (let f = 0; f < F.length; f++) for (let i = 0; i < 4; i++) {
    const k = edgeKey(Q[f * 4 + i], Q[f * 4 + ((i + 1) & 3)]);
    const l = eF.get(k);
    if (l) l.push(F[f]); else eF.set(k, [F[f]]);
  }
  for (const [k, l] of eF) if (l.length === 2 && l[0] !== l[1]) crease.set(k, Math.max(crease.get(k) || 0, D.matCrease ?? 3));
  return { M: { P, Q, F, crease, seam, corner: new Set() }, NS, NP, Ti, Bi };
}

/* ------------------------------------------------------------------ Nachbearbeitung */

/** Wölbung je Ecke: + konvex (Kanten), − konkav (Kehlen); Mittel 1 − cos zu den Nachbarn. */
function convexity(M, VN) {
  const P = M.P, nV = P.length / 3, out = new Float32Array(nV), cnt = new Float32Array(nV), seen = new Set();
  for (let f = 0; f < M.Q.length / 4; f++) for (let i = 0; i < 4; i++) {
    const a = M.Q[f * 4 + i], b = M.Q[f * 4 + ((i + 1) & 3)], k = edgeKey(a, b);
    if (seen.has(k)) continue;
    seen.add(k);
    for (const [v, u] of [[a, b], [b, a]]) {
      const c = 1 - (VN[v * 3] * VN[u * 3] + VN[v * 3 + 1] * VN[u * 3 + 1] + VN[v * 3 + 2] * VN[u * 3 + 2]);
      const s = VN[v * 3] * (P[u * 3] - P[v * 3]) + VN[v * 3 + 1] * (P[u * 3 + 1] - P[v * 3 + 1]) + VN[v * 3 + 2] * (P[u * 3 + 2] - P[v * 3 + 2]);
      out[v] += s < 0 ? c : -c * 0.5;
      cnt[v]++;
    }
  }
  for (let v = 0; v < nV; v++) out[v] /= cnt[v] || 1;
  return out;
}

/**
 * Masken je Ecke (aCv): x Spritzschmutz – hinter jedem Rad auf der Flanke/Schweller/Stoßfänger-Ecke, nach oben und
 * hinten auslaufend (die Körnung macht der Shader); y Kantenabrieb aus der Wölbung (enge Radien, Kanten).
 */
function masks(M, wheels, VN) {
  const P = M.P, nV = P.length / 3, out = new Float32Array(nV * 2), cv = convexity(M, VN);
  for (let v = 0; v < nV; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], ax = Math.abs(x);
    let spray = 0;
    for (const w of wheels) {
      const dz = z - w.z; // hinter dem Rad: dz > 0
      const behind = smooth(-w.r * 0.2, w.r * 0.6, dz) * (1 - smooth(w.r * 1.2, w.r * 3.2, dz));
      const high = 1 - smooth(w.y + w.r * 0.2, w.y + w.r * 1.5, y);
      // Radlauf-Kante selbst und die Innenseite vor dem Rad leicht
      const arch = (1 - smooth(w.r * 1.05, w.r * 1.45, Math.hypot(dz, y - w.y))) * 0.6;
      const side = smooth(0.25, 0.7, ax / Math.max(0.5, w.x || 0.85)) * 0.7 + 0.3;
      spray = Math.max(spray, Math.max(behind * high, arch) * side);
    }
    // Schweller und Stoßfänger-Unterkante allgemein
    spray = Math.max(spray, (1 - smooth(0.3, 0.55, y)) * 0.55);
    out[v * 2] = clamp(spray, 0, 1);
    out[v * 2 + 1] = clamp(cv[v] * 14, -1, 1);
  }
  return out;
}

const CACHE = new Map();

/**
 * Fertige Teile aus einem Käfig: levels Unterteilungen, Fritting (nur ≥ 2), Fugen, Innenhaut, Masken.
 * opts: { levels, wheels [{z, y, r, x}], cabin [z0, z1] (Innenhaut hell), frit, innerOffset, noInner }
 */
export function finishBody(B, opts) {
  const levels = opts.levels;
  const S = subdivide(B.M, levels);
  // Fritting: Ring an Scheiben-Rändern, die an Blech/Zierleiste grenzen
  if (levels >= 2 && opts.frit !== false) {
    const g = borderFaces(S, (f) => S.F[f] === TAG.GLASS, (f) => S.F[f] !== TAG.GLASS && S.F[f] !== TAG.FRIT, opts.fritRings || 1);
    for (let f = 0; f < g.length; f++) if (g[f]) S.F[f] = TAG.FRIT;
  }
  const pre = { ...faceNormals(S), VF: vertexFaces(S) };
  const CN = cornerNormals(S, opts.smoothAngle ?? 38, pre);
  const VN = vertexNormals(S);
  const attrs = { aCv: { size: 2, perVertex: masks(S, opts.wheels || [], VN) } };
  if (opts.wear) {
    // Militärlack (vehLook): Kantenabstand je Ecke aus der Wölbung (klein = abgeschabte Kante), wie vehicles/armorkit.js
    const cv = convexity(S, VN), E = new Float32Array(cv.length * 3), kk = levels >= 2 ? 0.05 : 0.1;
    for (let v = 0; v < cv.length; v++) { const d = cv[v] > 0.004 ? Math.max(0, 0.03 * (1 - cv[v] / kk)) : 9; E[v * 3] = E[v * 3 + 1] = E[v * 3 + 2] = d; }
    attrs.aVehE = { size: 3, perVertex: E };
  }
  const parts = new Map();
  for (const t of new Set(S.F)) parts.set(t, toGeometry(S, new Set([t]), { normals: CN, attrs }));
  const seams = opts.seams === false ? null : seamGeometry(S, null, levels >= 2 ? 0.0042 : 0.007, 0.0012, VN);
  // Innenhaut (eine Stufe gröber, nach innen versetzt, umgedreht): hell in der Kabine, sonst dunkel
  let inner = null;
  if (!opts.noInner) {
    // eine Stufe gröber, Ecken auf die Grenzfläche gezogen (sonst stößt die Innenhaut an Kehlen/Radlauf-Wülsten durch)
    const L = Math.max(0, levels - 1), S2 = toLimit(subdivide(B.M, L));
    const CN2 = cornerNormals(S2, 60);
    const cab = opts.cabin || [-9, 9], off = opts.innerOffset ?? 0.035;
    const zc = (f) => { let z = 0, y = 0; for (let i = 0; i < 4; i++) { z += S2.P[S2.Q[f * 4 + i] * 3 + 2]; y += S2.P[S2.Q[f * 4 + i] * 3 + 1]; } return [z / 4, y / 4]; };
    const solid = (f) => SOLID.has(S2.F[f]) || S2.F[f] === TAG.LAMP || S2.F[f] === TAG.RLAMP;
    const inCab = (f) => { const [z, y] = zc(f); return z > cab[0] && z < cab[1] && y > (opts.cabinFloor ?? 0.45); };
    // Radlauf-Wülste: dort liegt die Innenhaut zu nah an der Außenhaut (Radhausschalen decken den Blick ohnehin ab)
    const nearArch = (f) => { const [z, y] = zc(f); return (opts.wheels || []).some((w) => Math.hypot(z - w.z, y - w.y) < w.r * 1.25 + 0.3); };
    inner = {
      trim: toGeometry(S2, (f) => solid(f) && inCab(f) && !nearArch(f), { normals: CN2, offset: off, flip: true }),
      // außerhalb der Kabine nur die untere Hälfte (Blick durch Radläufe/von unten) – Haube/Deckel innen sieht man nie
      dark: toGeometry(S2, (f) => solid(f) && !inCab(f) && !nearArch(f) && zc(f)[1] < (opts.darkBelow ?? 9), { normals: CN2, offset: off, flip: true }),
    };
  }
  let tris = 0;
  for (const g of parts.values()) tris += g.attributes.position.count / 3;
  return { parts, seams, inner, tris, sub: S };
}

/** Kopien aus dem Zwischenspeicher (jeder Aufrufer darf seine Geometrien verwerfen). */
function copyOf(R) {
  const parts = new Map();
  for (const [t, g] of R.parts) parts.set(t, g.clone());
  return { parts, seams: R.seams ? R.seams.clone() : null, inner: R.inner ? { trim: R.inner.trim.clone(), dark: R.inner.dark.clone() } : null, tris: R.tris, meta: R.meta, sub: R.sub };
}

/* ------------------------------------------------------------------ Pkw (Stufenheck, Kombi, Schrägheck) */

/** Arche über einer Linie: y = max(base, cy + √((R+ρ)² − dz²)). */
const archLift = (arches, rho) => (z, y) => {
  for (const a of arches) { const d = Math.abs(z - a.z), R = a.R + rho; if (d < R) y = Math.max(y, a.y + Math.sqrt(R * R - d * d)); }
  return y;
};

/** Zeilen (Schnitte): Pflicht-Lagen + Radlauf-Abtastung (Winkel gleichmäßig) + Füllung ≤ step; zu dichte zusammengelegt. */
function rowsOf(keys, arches, step, min = 0.035) {
  let z = [...keys];
  for (const a of arches) for (let i = 0; i <= 8; i++) z.push(+(a.z - a.R * Math.cos((i / 8) * Math.PI)).toFixed(4));
  z.sort((a, b) => a - b);
  // Pflichtlagen behalten, Radlauf-Punkte nahe Pflichtlagen verwerfen
  const must = new Set(keys.map((k) => +k.toFixed(4)));
  const out = [];
  for (const v of z) {
    const last = out[out.length - 1];
    if (last != null && v - last < min) { if (must.has(+v.toFixed(4)) && !must.has(+last.toFixed(4))) out[out.length - 1] = v; continue; }
    out.push(v);
  }
  const fill = [];
  for (let i = 0; i < out.length; i++) {
    fill.push(out[i]);
    if (i < out.length - 1) { const n = Math.ceil((out[i + 1] - out[i]) / step); for (let k = 1; k < n; k++) fill.push(out[i] + ((out[i + 1] - out[i]) * k) / n); }
  }
  return fill;
}

/**
 * Pkw-Form (Maße wie data.js pkw: Länge 4,72 m, Radstand 2,81 m, Breite 1,80 m, Höhe 1,45 m, Räder z −1,38 / 1,43).
 * style 0 Stufenheck, 1 Kombi, 2 Schrägheck. → Gestalt + Funktionen (auch für Wracks, Spiegel, Griffe).
 */
export function pkwShape(style = 0) {
  const arches = [{ z: -1.38, y: 0.32, R: 0.385 }, { z: 1.43, y: 0.32, R: 0.385 }];
  const zF = -2.36, zR = 2.36, zs0 = -2.17, zsN = style === 1 ? 2.2 : 2.19;
  const w = curve([[-2.36, 0.8], [-2.25, 0.86], [-2.0, 0.888], [-1.5, 0.9], [1.5, 0.9], [2.0, 0.892], [2.25, 0.87], [2.36, 0.82]]);
  const cs = curve([[0.2, 0.93], [0.3, 0.948], [0.42, 0.982], [0.58, 1.0], [0.8, 0.992], [0.9, 0.972], [1.0, 0.94]]);
  const ys = curve([[-2.36, 0.735], [-2.2, 0.77], [-1.6, 0.84], [-1.0, 0.9], [0, 0.94], [1.0, 0.965], [1.8, 0.975], [2.2, 0.965], [2.36, 0.94]]);
  const yb = curve([[-2.36, 0.33], [-2.2, 0.305], [-1.9, 0.295], [1.95, 0.295], [2.2, 0.31], [2.36, 0.33]]);
  const hood = curve([[-2.36, 0.745], [-2.25, 0.79], [-1.9, 0.84], [-1.4, 0.89], [-1.0, 0.928]]);
  const trunk = style === 1
    ? curve([[1.0, 1.0], [2.0, 1.02], [2.36, 1.0]])
    : curve([[1.0, 1.0], [1.7, 1.03], [2.1, 1.025], [2.36, 1.0]]);
  const G = {
    zA0: -0.97, zA1: -0.24, zB: 0.08, yR: 1.43,
    zC1: style === 1 ? 2.02 : style === 2 ? 0.78 : 0.98,
    zC0: style === 1 ? zsN : style === 2 ? 2.08 : 1.72,
    yRe: style === 1 ? 1.405 : 1.415,
  };
  G.top = (z) => {
    if (z <= G.zA0) return hood(z) + 0.012;
    if (z < G.zA1) { const t = (z - G.zA0) / (G.zA1 - G.zA0); return lerp(hood(G.zA0) + 0.012, G.yR, Math.sin(t * Math.PI / 2) ** 0.82); }
    if (z <= G.zC1) { const t = (z - G.zA1) / (G.zC1 - G.zA1); return lerp(G.yR, G.yRe, t) + Math.sin(t * Math.PI) * 0.014; }
    if (z <= G.zC0) {
      const t = (z - G.zC1) / (G.zC0 - G.zC1), yT = style === 1 ? 1.35 : trunk(G.zC0) + 0.01;
      return lerp(G.yRe, yT, style === 1 ? t * t : 1 - Math.cos(t * Math.PI / 2) ** (style === 2 ? 1.25 : 0.85));
    }
    return trunk(z);
  };
  // Dachkante (halbe Breite): A-Säulen-Fuß breit, Dach schmaler, C-Säulen-Fuß breiter
  G.xr = curve([[G.zA0, 0.755], [G.zA1, 0.665], [0.3, 0.66], [G.zC1, 0.645], [G.zC0, style === 1 ? 0.66 : 0.72]]);
  const wt = (z) => w(z) * cs(ys(z));
  // Ebenen-Höhen: Seite (absolut), Bug und Heck (Mitte); K = 6
  const K = 6;
  const HS = (z) => [yb(z), yb(z) + 0.04, 0.45, 0.61, 0.795, ys(z) - 0.055];
  const HF = [0.25, 0.315, 0.43, 0.535, 0.6, 0.695];
  const HR = style === 1 ? [0.31, 0.37, 0.5, 0.64, 0.775, 0.96] : [0.31, 0.37, 0.5, 0.64, 0.775, 0.885];
  const lip = archLift(arches, 0.04), fl2 = archLift(arches, 0.115), fl3 = archLift(arches, 0.17);
  const levelY = (z, k) => {
    const hs = HS(z);
    let y = hs[k];
    const tf = smooth(zs0 - 0.02, zs0 + 0.6, z), tr = 1 - smooth(zsN - 0.6, zsN + 0.02, z);
    if (k < K) y = lerp(HF[k], y, tf);
    if (k < K) y = lerp(HR[k], y, tr);
    if (k === 0) { for (const a of arches) { const d = Math.abs(z - a.z); if (d < a.R) y = Math.max(y, a.y + Math.sqrt(a.R * a.R - d * d)); } }
    if (k === 1) y = lip(z, y);
    if (k === 2) y = fl2(z, y);
    if (k === 3) y = fl3(z, y);
    return y;
  };
  const flare = (z, y) => {
    let f = 0;
    for (const a of arches) { const d = Math.abs(z - a.z); f = Math.max(f, (1 - smooth(a.R - 0.05, a.R + 0.32, d)) * smooth(0.4, 0.55, y) * (1 - smooth(0.74, 0.86, y))); }
    return f * 0.017;
  };
  const sidePt = (z, k) => {
    const y = levelY(z, k);
    let x = w(z) * cs(y) + flare(z, y);
    if (k === 1) for (const a of arches) { const d = Math.abs(z - a.z); if (d < a.R + 0.06) x += 0.006; }
    return [x, y, z];
  };
  return { style, arches, zF, zR, zs0, zsN, w, cs, ys, yb, hood, trunk, G, wt, K, HS, HF, HR, levelY, sidePt };
}

/** Pkw-Käfig (Spezifikation für blanket). */
function pkwSpec(style, density = 1) {
  const SH = pkwShape(style), { arches, zs0, zsN, w, cs, ys, hood, trunk, G, wt, K, HF, HR, sidePt } = SH;
  const keys = [zs0, -2.04, G.zA0, -0.78, -0.56, G.zA1, -0.1, G.zB - 0.045, G.zB, G.zB + 0.045, 0.4, 0.7, 1.0, zsN];
  if (style === 0) keys.push(G.zC1, 1.2, 1.45, G.zC0, 1.9, 2.06);
  if (style === 1) keys.push(1.12, 1.6, 1.98, G.zC1);
  if (style === 2) keys.push(G.zC1, 1.06, 1.3, 1.62, 1.85, G.zC0);
  const zs = rowsOf(keys, arches, 0.24 / density);
  const J = 10, H = 5;
  const XF = [1, 0.85, 0.62, 0.42, 0.21, 0];
  // Bug-/Heckrundung im Grundriss: z(x) zwischen Mitte zc und Ecke
  const nose = (zc, zCorner, x, wf) => zc + (zCorner - zc) * Math.pow(clamp(x / wf, 0, 1), 2.1);
  const ZF = [-2.3, -2.352, -2.362, -2.358, -2.348, -2.33], ZR = [2.3, 2.348, 2.36, 2.357, 2.345, style === 1 ? 2.3 : 2.32];
  const zcHood = -2.29, zcTrunk = style === 1 ? 2.26 : 2.32;
  const GH = (z) => z >= G.zA0 - 1e-4 && z <= G.zC0 + 1e-4;
  const top = (s, j) => {
    const z0 = zs[s];
    const x0 = wt(z0), y0 = ys(z0);
    if (j === 0) return [x0, y0, z0];
    if (GH(z0)) {
      const yT = G.top(z0), xr = Math.min(G.xr(z0), x0 - 0.05);
      const b1 = [x0 - 0.024, y0 + 0.024];
      const R = [xr, Math.max(yT - 0.014, b1[1] + 0.01)];
      const t2 = 0.8;
      const P2 = [lerp(b1[0], R[0], t2) + 0.012 * Math.min(1, (R[1] - b1[1]) / 0.3), lerp(b1[1], R[1], t2)];
      const crown = 0.03 * smooth(0, 0.3, yT - y0);
      const pts = [null, b1, P2, R, [xr * 0.55, yT + crown * 0.75], [0, yT + crown]];
      const p = pts[j];
      return [p[0], p[1], z0];
    }
    // Haube / Kofferraum
    const front = z0 < 0, yC = front ? hood(z0) : trunk(z0);
    const crown = front ? 0.03 : 0.022;
    const fr = [1, 0.962, 0.83, 0.66, 0.36, 0][j];
    const x = x0 * fr;
    let y = yC + crown * (1 - fr * fr);
    if (j === 1) y = y0 + (yC - y0) * 0.72;
    if (j === 2 && front) y += 0.008; // Haubenkante (Charakterlinie)
    let z = z0;
    if (s === 0) z = nose(zcHood, z0, x, x0);
    if (s === zs.length - 1) z = nose(zcTrunk, z0, x, x0);
    if (s === 1) z = lerp(z0, nose(zcHood, zs[0], x, x0), 0.18);
    return [x, y, z];
  };
  const side = (s, k) => {
    const p = sidePt(zs[s], k);
    if (s === 0 || s === zs.length - 1) p[0] -= 0.018; // Eckpunkte leicht eingezogen
    return p;
  };
  const faceAt = (zc, HH, ZZ, j, k, last) => {
    const z0 = last ? zs[zs.length - 1] : zs[0];
    const wf = w(z0) * cs(HH[k]), x = XF[j] * wf;
    const kTop = top(last ? zs.length - 1 : 0, j);
    const y = Math.min(HH[k], kTop[1] - (K - k) * 0.016);
    return [x, y, nose(ZZ[k], z0, x, wf)];
  };
  const front = (j, k) => faceAt(null, HF, ZF, j, k, false);
  const rear = (j, k) => faceAt(null, HR, ZR, j, k, true);
  const inGlassSide = (z0, z1) => {
    const zm = (z0 + z1) / 2;
    if (zm < G.zA0 || zm > G.zC0) return false;
    if (zm > G.zB - 0.045 && zm < G.zB + 0.045) return 'b';
    if (style === 0) return zm < G.zC1 ? true : 'c';
    if (style === 1) { if (zm < 1.0) return true; if (zm < 1.12) return 'c'; if (zm < 1.98) return true; return 'c'; }
    if (zm < 1.0) return true; if (zm < 1.06) return 'c'; if (zm < 1.62) return true; return 'c';
  };
  const tagTop = ({ jj, z0, z1 }) => {
    const zm = (z0 + z1) / 2;
    if (!(zm > G.zA0 && zm < G.zC0)) return TAG.PAINT;
    if (jj === 0) return TAG.TRIM;
    if (jj === 1) { const g = inGlassSide(z0, z1); return g === true ? TAG.GLASS : g === 'b' ? TAG.TRIM : TAG.PAINT; }
    if (jj === 2) return TAG.PAINT;
    if (zm < G.zA1) return TAG.GLASS;
    if (zm > G.zC1) return style === 1 ? TAG.PAINT : TAG.GLASS;
    return TAG.PAINT;
  };
  const tagBand = ({ kind, s, jj, k }) => {
    if (kind === 'side') {
      const zm = (zs[s] + zs[s + 1]) / 2;
      if (k === 4 && s === 0) return TAG.LAMP;
      if (k === 4 && s === zs.length - 2) return TAG.RLAMP;
      if (k === 0 && (zm < zs0 + 0.25 || zm > zsN - 0.25)) return TAG.PLASTIC;
      return TAG.PAINT;
    }
    if (kind === 'front') {
      if (k === 0) return TAG.PLASTIC;
      if (k === 1) return jj >= 1 ? TAG.GRILLE : TAG.TRIM;
      if (k === 4) return jj <= 1 ? TAG.LAMP : TAG.GRILLE;
      if (k === 3) return jj >= 2 ? TAG.GRILLE : TAG.PAINT;
      return TAG.PAINT;
    }
    // Heck
    if (k === 0) return TAG.PLASTIC;
    if (k === 4) return jj <= 1 ? TAG.RLAMP : (style === 1 ? TAG.PAINT : TAG.PAINT);
    if (style === 1 && k === 5) return TAG.GLASS; // Heckklappenscheibe
    return TAG.PAINT;
  };
  const doorZ = [G.zA0, G.zB, style === 1 ? 1.0 : 1.0];
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  const edge = (e) => {
    if (e.zone === 'bandH') {
      if (e.kind === 'side') {
        const zm = (zs[e.s] + zs[e.s + 1]) / 2;
        if (e.k === 4) return { c: 1 };                                                  // Charakterlinie
        if (e.k === 1) {
          const onArch = arches.some((a) => Math.abs(zm - a.z) < a.R + 0.04);
          return { c: onArch ? 2 : 1, seam: !onArch && zm > G.zA0 && zm < doorZ[2] ? 1 : 0 }; // Bördel / Türunterkante
        }
        if (e.k === 3) return { c: 0 };
      }
      if (e.kind === 'front' && (e.k === 1 || e.k === 3)) return { c: 1 };
      if (e.kind === 'rear' && (e.k === 1 || e.k === 3)) return { c: 1 };
      if (e.kind === 'rear' && e.k === 5 && style !== 1) return { c: 1, seam: e.jj >= 1 ? 2 : 0 }; // Kofferraumdeckel-Kante
      return null;
    }
    if (e.zone === 'bandV') {
      if (e.kind === 'side' && doorZ.some((z) => near(zs[e.s], z))) return { seam: 1 };
      return null;
    }
    if (e.zone === 'row') {
      if (e.s === 0) return { c: 1, seam: e.jj >= 2 ? 3 : 0 };                         // Haubenvorderkante
      if (e.s === zs.length - 1 && style !== 1) return { c: 1 };
      const z = zs[e.s];
      if (near(z, G.zA0) && e.jj >= 2) return { seam: 3 };                                // Haube hinten
      if (style === 0 && near(z, G.zC0) && e.jj >= 2) return { seam: 4 };                 // Kofferraumdeckel vorn
      return null;
    }
    if (e.zone === 'col') {
      const zm = (e.z0 + e.z1) / 2;
      if (e.jv === 1 && !(zm > G.zA0 && zm < G.zC0)) return { c: 1 };                    // Kotflügel-Schulter
      if (e.jv === 2 && zm < G.zA0) return { c: 1, seam: 3 };                             // Haubenfuge
      if (e.jv === 2 && style === 0 && zm > G.zC0) return { c: 1, seam: 4 };
      if (e.jv === 3 && zm > G.zA1 && zm < G.zC1) return { c: 1 };                         // Dachkante
      return null;
    }
    return null;
  };
  return { D: { J, K, zs, top, side, front, rear, tagTop, tagBand, edge }, SH };
}

/** Pkw-Karosserie (Stufe: 2 = high/ultra nah, 1 = medium bzw. Mittelstufe, 0 = Käfig). */
export function pkwBody(style, level) {
  const key = `pkw:${style}:${level}`;
  if (!CACHE.has(key)) {
    const { D, SH } = pkwSpec(style, level >= 2 ? 1 : 0.8);
    const B = blanket(D);
    const R = finishBody(B, { levels: level, wheels: SH.arches.map((a) => ({ z: a.z, y: a.y, r: 0.32, x: 0.85 })), cabin: [SH.G.zA0 - 0.05, style === 1 ? 2.3 : SH.G.zC0], cabinFloor: 0.5, darkBelow: 0.8 });
    R.meta = SH;
    CACHE.set(key, R);
  }
  return copyOf(CACHE.get(key));
}

/* ------------------------------------------------------------------ Kastenwagen */

/**
 * Kastenwagen 3,5 t (data.js transporter: Länge 5,28 m, Räder z −1,75 / 1,55, r 0,36, Breite 2,0 m, Dach 2,42 m):
 * kurze, abfallende Haube, steile Frontscheibe, Hochdach, senkrechtes Heck mit zwei Flügeltüren (Scheiben), Schiebetür.
 */
export function vanShape() {
  const arches = [{ z: -1.75, y: 0.36, R: 0.44 }, { z: 1.55, y: 0.36, R: 0.44 }];
  const zs0 = -2.47, zsN = 2.6;
  const w = curve([[-2.64, 0.86], [-2.5, 0.94], [-2.2, 0.985], [-1.6, 1.0], [2.4, 1.0], [2.62, 0.99]]);
  const cs = curve([[0.3, 0.95], [0.45, 0.985], [0.7, 1.0], [1.2, 0.997], [1.4, 0.99], [2.2, 0.975]]);
  const ys = curve([[-2.64, 1.0], [-2.3, 1.12], [-1.95, 1.27], [-1.7, 1.33], [0, 1.36], [2.64, 1.38]]);
  const yb = curve([[-2.64, 0.46], [-2.4, 0.45], [2.4, 0.45], [2.64, 0.47]]);
  const hood = curve([[-2.64, 1.02], [-2.4, 1.16], [-2.1, 1.25], [-1.95, 1.29]]);
  const G = { zA0: -1.92, zA1: -1.22, zB: 0.0, zC1: 2.6, zC0: 2.6, yR: 2.42 };
  G.top = (z) => {
    if (z <= G.zA0) return hood(z) + 0.01;
    if (z < G.zA1) { const t = (z - G.zA0) / (G.zA1 - G.zA0); return lerp(hood(G.zA0) + 0.01, G.yR - 0.03, Math.sin(t * Math.PI / 2) ** 0.9); }
    if (z < -0.9) return lerp(G.yR - 0.03, G.yR, smooth(G.zA1, -0.9, z));
    return G.yR - 0.03 * smooth(2.3, 2.6, z);
  };
  G.xr = curve([[G.zA0, 0.86], [G.zA1, 0.9], [-0.9, 0.93], [2.6, 0.93]]);
  const wt = (z) => w(z) * cs(ys(z));
  const K = 6;
  const HS = (z) => [yb(z), yb(z) + 0.045, 0.58, 0.78, 1.02, ys(z) - 0.06];
  const HF = [0.36, 0.44, 0.6, 0.76, 0.86, 0.97];
  const HR = [0.38, 0.46, 0.62, 0.8, 1.05, 1.3];
  const lip = archLift(arches, 0.045), fl2 = archLift(arches, 0.12), fl3 = archLift(arches, 0.2);
  const levelY = (z, k) => {
    let y = HS(z)[k];
    const tf = smooth(zs0 - 0.02, zs0 + 0.55, z), tr = 1 - smooth(zsN - 0.25, zsN + 0.02, z);
    y = lerp(HF[k], y, tf); y = lerp(HR[k], y, tr);
    if (k === 0) for (const a of arches) { const d = Math.abs(z - a.z); if (d < a.R) y = Math.max(y, a.y + Math.sqrt(a.R * a.R - d * d)); }
    if (k === 1) y = lip(z, y);
    if (k === 2) y = fl2(z, y);
    if (k === 3) y = fl3(z, y);
    return y;
  };
  const sidePt = (z, k) => {
    const y = levelY(z, k);
    let x = w(z) * cs(y);
    if (k === 1) for (const a of arches) if (Math.abs(z - a.z) < a.R + 0.06) x += 0.006;
    return [x, y, z];
  };
  return { arches, zs0, zsN, w, cs, ys, yb, hood, G, wt, K, HF, HR, levelY, sidePt };
}

function vanSpec(density = 1) {
  const SH = vanShape(), { arches, zs0, zsN, w, cs, ys, hood, G, wt, K, HF, HR, sidePt } = SH;
  const keys = [zs0, -2.3, -2.1, G.zA0, -1.68, -1.45, G.zA1, -0.95, -0.5, -0.06, G.zB, 0.15, 0.6, 1.0, 1.25, 2.1, 2.42, zsN];
  const zs = rowsOf(keys, arches, 0.3 / density);
  const J = 10;
  const XF = [1, 0.86, 0.64, 0.44, 0.22, 0];
  const nose = (zc, zCorner, x, wf) => zc + (zCorner - zc) * Math.pow(clamp(x / wf, 0, 1), 2.2);
  const ZF = [-2.58, -2.635, -2.645, -2.64, -2.625, -2.6], ZR = [2.63, 2.64, 2.64, 2.64, 2.64, 2.64];
  const GH = (z) => z >= G.zA0 - 1e-4;
  const top = (s, j) => {
    const z0 = zs[s], x0 = wt(z0), y0 = ys(z0);
    if (j === 0) return [x0, y0, z0];
    if (GH(z0)) {
      const yT = G.top(z0), xr = Math.min(G.xr(z0), x0 - 0.04);
      const b1 = [x0 - 0.018, y0 + 0.02];
      const R = [xr, Math.max(yT - 0.05, b1[1] + 0.01)];
      const P2 = [lerp(b1[0], R[0], 0.86) + 0.01, lerp(b1[1], R[1], 0.86)];
      const crown = 0.035 * smooth(0, 0.3, yT - y0);
      const pts = [null, b1, P2, R, [xr * 0.6, yT + crown * 0.8], [0, yT + crown]];
      let z = z0;
      if (s === zs.length - 1) z = z0 + 0.0;
      return [pts[j][0], pts[j][1], z];
    }
    const yC = hood(z0), fr = [1, 0.955, 0.82, 0.64, 0.34, 0][j], x = x0 * fr;
    let y = yC + 0.035 * (1 - fr * fr);
    if (j === 1) y = y0 + (yC - y0) * 0.7;
    let z = z0;
    if (s === 0) z = nose(-2.58, z0, x, x0);
    return [x, y, z];
  };
  const side = (s, k) => { const p = sidePt(zs[s], k); if (s === 0) p[0] -= 0.02; if (s === zs.length - 1) p[0] -= 0.012; return p; };
  const faceAt = (HH, ZZ, j, k, last) => {
    const z0 = last ? zs[zs.length - 1] : zs[0];
    const kTop = top(last ? zs.length - 1 : 0, j);
    const y = Math.min(HH[k], kTop[1] - (K - k) * 0.02);
    const wf = w(z0) * cs(y), x = last ? Math.min(XF[j] * wf, kTop[0] + (wf - kTop[0]) * (1 - (k / K) ** 3)) : XF[j] * wf;
    return [x, y, last ? lerp(ZZ[k], z0, Math.pow(clamp(x / wf, 0, 1), 6)) : nose(ZZ[k], z0, x, wf)];
  };
  const front = (j, k) => faceAt(HF, ZF, j, k, false);
  const rear = (j, k) => faceAt(HR, ZR, j, k, true);
  const tagTop = ({ jj, z0, z1 }) => {
    const zm = (z0 + z1) / 2;
    if (zm < G.zA0) return TAG.PAINT;
    if (jj === 0) return zm < G.zB ? TAG.TRIM : TAG.PAINT;
    if (jj === 1) return zm < G.zB - 0.06 ? TAG.GLASS : TAG.PAINT;
    if (jj >= 3 && zm < G.zA1) return TAG.GLASS;
    return TAG.PAINT;
  };
  const tagBand = ({ kind, s, jj, k }) => {
    if (kind === 'side') {
      if (k === 4 && s === 0) return TAG.LAMP;
      if (k <= 1 && s > 0 && s < zs.length - 2) return k === 1 ? TAG.PLASTIC : TAG.PLASTIC; // Schutzleiste/Schweller
      if (k === 0) return TAG.PLASTIC;
      return TAG.PAINT;
    }
    if (kind === 'front') {
      if (k <= 1) return TAG.PLASTIC;
      if (k === 2) return jj >= 1 ? TAG.GRILLE : TAG.PLASTIC;
      if (k === 3) return jj >= 2 ? TAG.GRILLE : TAG.LAMP;
      if (k === 4) return jj <= 1 ? TAG.LAMP : TAG.GRILLE;
      return TAG.PAINT;
    }
    if (k <= 1) return TAG.PLASTIC;
    if (k === 3 && jj === 0) return TAG.RLAMP;
    if (k === 4 && jj === 0) return TAG.RLAMP;
    return TAG.PAINT;
  };
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  const edge = (e) => {
    if (e.zone === 'bandH') {
      if (e.kind === 'side' && e.k === 1) return { c: 2 };
      if (e.kind === 'side' && e.k === 3) return { c: 1 };
      if (e.kind !== 'side' && (e.k === 2 || e.k === 4)) return { c: 1 };
      return null;
    }
    if (e.zone === 'bandV') {
      if (e.kind === 'side' && [G.zA0, G.zB, 0.15, 1.25].some((z) => near(zs[e.s], z))) return { seam: 1 };
      if (e.kind === 'rear' && e.jv === 5) return { seam: 2 };
      return null;
    }
    if (e.zone === 'row') {
      if (e.s === 0) return { c: 1, seam: e.jj >= 2 ? 3 : 0 };
      if (e.s === zs.length - 1) return { c: 2 };
      if (near(zs[e.s], G.zA0) && e.jj >= 2) return { seam: 3 };
      return null;
    }
    if (e.zone === 'col') {
      const zm = (e.z0 + e.z1) / 2;
      if (e.jv === 1 && zm < G.zA0) return { c: 1 };
      if (e.jv === 2 && zm < G.zA0) return { c: 1, seam: 3 };
      if (e.jv === 3 && zm > G.zA1) return { c: 2 };
      if (e.jv === 2 && zm > G.zB) return { c: 1 };
      return null;
    }
    return null;
  };
  return { D: { J, K, zs, top, side, front, rear, tagTop, tagBand, edge }, SH };
}

export function vanBody(level) {
  const key = `van:${level}`;
  if (!CACHE.has(key)) {
    const { D, SH } = vanSpec(level >= 2 ? 1 : 0.8);
    const B = blanket(D);
    const R = finishBody(B, { levels: level, wheels: SH.arches.map((a) => ({ z: a.z, y: a.y, r: 0.36, x: 0.85 })), cabin: [-2.0, 0.09], cabinFloor: 0.75 });
    R.meta = SH;
    CACHE.set(key, R);
  }
  return copyOf(CACHE.get(key));
}

/* ------------------------------------------------------------------ Lkw-Fahrerhaus (Frontlenker) */

/**
 * Fahrerhaus der Sattelzugmaschine (data.js: Vorderachse z −2,2, r 0,52; Kabine z −3,22 … −1,12, Boden ~1,4, Dach ~3,36):
 * große, leicht gewölbte Front mit Grill und Trittstufen, gerundete Kanten, stark geneigte Frontscheibe oben, Türen mit
 * Fenstern, Dach mit Rundung nach hinten. Das Fahrgestell bleibt in models-civil.js.
 */
export function cabShape() {
  const zs0 = -3.16, zsN = -0.99;
  const w = curve([[-3.26, 1.12], [-3.1, 1.19], [-2.9, 1.21], [-0.99, 1.21]]);
  const cs = curve([[0.9, 0.965], [1.1, 0.99], [1.4, 1.0], [1.72, 0.995]]);
  const ys = () => 1.72;
  const yb = curve([[-3.26, 0.98], [-3.0, 0.95], [-0.99, 0.95]]);
  const arches = [{ z: -2.2, y: 0.52, R: 0.62 }];
  const G = { zA0: -3.16, zA1: -3.0, zB: -1.97, zC1: -0.99, zC0: -0.99, yR: 3.32, win: 2.56 };
  G.top = (z) => {
    if (z <= G.zA1) return lerp(1.78, 2.62, smooth(zs0, G.zA1, z) * 0.35 + clamp((z - zs0) / (G.zA1 - zs0), 0, 1) * 0.65);
    if (z < -2.85) return lerp(2.62, 2.95, (z - G.zA1) / 0.15);
    if (z < -2.4) return lerp(2.95, 3.3, Math.sin(((z + 2.85) / 0.45) * Math.PI / 2));
    return 3.32 - 0.05 * smooth(-1.3, -0.99, z);
  };
  G.xr = curve([[-3.16, 1.06], [-3.0, 1.1], [-2.6, 1.12], [-0.99, 1.12]]);
  const wt = (z) => w(z) * cs(1.72);
  const K = 5;
  const HS = (z) => [yb(z), yb(z) + 0.05, 1.3, 1.5, 1.67];
  const HF = [0.98, 1.08, 1.3, 1.5, 1.68];
  const HR = [0.98, 1.08, 1.3, 1.5, 1.68];
  const lip = archLift(arches, 0.06);
  const levelY = (z, k) => {
    let y = HS(z)[k];
    if (k === 0) for (const a of arches) { const d = Math.abs(z - a.z); if (d < a.R) y = Math.max(y, a.y + Math.sqrt(a.R * a.R - d * d)); }
    if (k === 1) y = lip(z, y);
    return y;
  };
  const sidePt = (z, k) => { const y = levelY(z, k); return [w(z) * cs(y), y, z]; };
  return { arches, zs0, zsN, w, cs, ys, yb, G, wt, K, HF, HR, levelY, sidePt };
}

function cabSpec(density = 1) {
  const SH = cabShape(), { zs0, zsN, w, cs, ys, G, wt, K, HF, HR, sidePt } = SH;
  const zs = rowsOf([zs0, -3.1, -3.04, G.zA1, -2.92, -2.85, -2.7, -2.55, -2.4, -2.2, -1.97, -1.7, -1.4, -1.15, zsN], [], 0.3 / density);
  const J = 10;
  const XF = [1, 0.9, 0.7, 0.46, 0.23, 0];
  const top = (s, j) => {
    const z0 = zs[s], x0 = wt(z0), y0 = ys(z0);
    if (j === 0) return [x0, y0, z0];
    const yT = G.top(z0), xr = Math.min(G.xr(z0), x0 - 0.03);
    const b1 = [x0 - 0.02, y0 + 0.03];
    const R = [xr, Math.max(yT - 0.07, b1[1] + 0.02)];
    // Seitenfenster-Oberkante fest (Hochdach darüber als Blech)
    const t2 = clamp((G.win - b1[1]) / Math.max(0.01, R[1] - b1[1]), 0.5, 0.9);
    const P2 = [lerp(b1[0], R[0], t2), lerp(b1[1], R[1], t2)];
    const crown = 0.05 * smooth(0, 0.4, yT - y0);
    const pts = [null, b1, P2, R, [xr * 0.58, yT + crown * 0.8], [0, yT + crown]];
    let z = z0;
    if (s === 0) z = z0 - 0.05 * (1 - (pts[j][0] / x0) ** 2);
    return [pts[j][0], pts[j][1], z];
  };
  const side = (s, k) => { const p = sidePt(zs[s], k); if (s === 0 || s === zs.length - 1) p[0] -= 0.035; return p; };
  const faceAt = (HH, j, k, last) => {
    const z0 = last ? zs[zs.length - 1] : zs[0];
    const kTop = top(last ? zs.length - 1 : 0, j), y = Math.min(HH[k], kTop[1] - (K - k) * 0.03);
    const wf = w(z0) * cs(y), x = XF[j] * wf;
    return [x, y, z0 + (last ? 0.015 : -0.06) * (1 - (x / wf) ** 2)];
  };
  const front = (j, k) => faceAt(HF, j, k, false);
  const rear = (j, k) => faceAt(HR, j, k, true);
  const tagTop = ({ jj, z0, z1 }) => {
    const zm = (z0 + z1) / 2;
    if (jj === 0) return zm < G.zB ? TAG.TRIM : TAG.PAINT;
    if (jj === 1) return zm > G.zA1 + 0.02 && zm < G.zB - 0.02 ? TAG.GLASS : TAG.PAINT;
    if (jj >= 3 && zm < G.zA1) return TAG.GLASS;
    return TAG.PAINT;
  };
  const tagBand = ({ kind, s, jj, k }) => {
    if (kind === 'front') {
      if (k === 0) return TAG.PLASTIC;
      if ((k === 1 || k === 2) && jj >= 1) return TAG.GRILLE;
      return TAG.PAINT;
    }
    if (kind === 'side' && k === 0 && s === 0) return TAG.PLASTIC;
    return TAG.PAINT;
  };
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  const edge = (e) => {
    if (e.zone === 'bandH') { if (e.k === 1) return { c: 2 }; if (e.kind === 'front' && (e.k === 1 || e.k === 3)) return { c: 1 }; return null; }
    if (e.zone === 'bandV') { if (e.kind === 'side' && [-3.04, G.zB].some((z) => near(zs[e.s], z))) return { seam: 1 }; return null; }
    if (e.zone === 'row') { if (e.s === 0) return { c: 2 }; if (e.s === zs.length - 1) return { c: 2 }; return null; }
    if (e.zone === 'col') { if (e.jv === 3) return { c: 2 }; if (e.jv === 0) return { c: 1 }; return null; }
    return null;
  };
  return { D: { J, K, zs, top, side, front, rear, tagTop, tagBand, edge }, SH };
}

export function cabBody(level) {
  const key = `cab:${level}`;
  if (!CACHE.has(key)) {
    const { D, SH } = cabSpec(level >= 2 ? 1 : 0.8);
    const B = blanket(D);
    const R = finishBody(B, { levels: level, wheels: [{ z: -2.2, y: 0.52, r: 0.52, x: 1.0 }], cabin: [-3.3, -0.9], cabinFloor: 1.3, innerOffset: 0.05 });
    R.meta = SH;
    CACHE.set(key, R);
  }
  return copyOf(CACHE.get(key));
}

/* ------------------------------------------------------------------ Geländewagen GW-4 (offen) */

/**
 * GW-4 Steppe (data.js jeep: Räder z −1,45 / 1,38, r 0,42, Spur 1,72; Armaturenbrett-Auflage [0, 1,31, −0,75], Boden 0,92 –
 * cabin.js hängt daran): kantiger Militärstil aus gekantetem Blech mit echten Radien – flache Haube mit Sicke, senkrechte
 * Flanken, offene Wanne (Ausschnitt mit Bördelrand), Kotflügel vorn als ausgestellte Kanten, Heck senkrecht.
 * Der Mantel reicht bis zur Wannenkante; der Deckel ist Haube + Windlauf + (offene) Wanne + Heckabdeckung.
 */
export function jeepShape() {
  const arches = [{ z: -1.45, y: 0.42, R: 0.55 }, { z: 1.38, y: 0.42, R: 0.55 }];
  const zs0 = -2.3, zsN = 2.16;
  const w = curve([[-2.4, 0.86], [-2.2, 0.9], [-1.0, 0.92], [2.2, 0.94]]);
  const ys = curve([[-2.4, 1.1], [-2.2, 1.14], [-1.0, 1.2], [-0.9, 1.33], [2.2, 1.36]]);
  const yb = curve([[-2.4, 0.66], [-2.2, 0.62], [-0.9, 0.64], [2.2, 0.68]]);
  const hood = curve([[-2.4, 1.15], [-2.2, 1.18], [-1.0, 1.24]]);
  const G = { zA0: -0.92, cowl: 1.3 };
  const K = 4;
  return { arches, zs0, zsN, w, ys, yb, hood, G, K };
}

function jeepSpec(density = 1) {
  const SH = jeepShape(), { arches, zs0, zsN, w, ys, yb, hood, K } = SH;
  const zs = rowsOf([zs0, -2.18, -1.95, -1.0, -0.92, -0.84, -0.7, 0.4, 1.9, 2.05, zsN], arches, 0.32 / density);
  const J = 10;
  const XF = [1, 0.93, 0.7, 0.45, 0.22, 0];
  // Wannenausschnitt: ab der Spritzwand bis kurz vor das Heck; die Wannenkante (Spalte 1) hat eine Bördelkante
  const tubZ0 = -0.84, tubZ1 = 2.05;
  const inTub = (z) => z > tubZ0 - 1e-4 && z < tubZ1 + 1e-4;
  const lipX = (z) => w(z) - 0.06;
  const levelY = (z, k) => {
    const yS = ys(z), yB = yb(z);
    let y = [yB, yB + 0.05, lerp(yB, yS, 0.55), yS - 0.05][k];
    for (const a of arches) {
      const d = Math.abs(z - a.z), R = a.R + [0, 0.05, 0.12, 0.18][k];
      if (d < R) y = Math.max(y, a.y + Math.sqrt(R * R - d * d));
    }
    return Math.min(y, yS - (K - k) * 0.03);
  };
  const top = (s, j) => {
    const z0 = zs[s], x0 = w(z0) - 0.01, y0 = ys(z0);
    if (j === 0) return [x0, y0, z0];
    if (inTub(z0) && z0 < tubZ1 - 1e-3 && z0 > tubZ0 + 1e-3) {
      // Wannenrand: oben gebördelt, innen senkrecht hinunter (Innenwand), Boden
      const pts = [null, [x0 - 0.035, y0 + 0.012], [x0 - 0.075, y0 - 0.02], [x0 - 0.08, 0.98], [x0 * 0.5, 0.94], [0, 0.94]];
      return [pts[j][0], pts[j][1], z0];
    }
    const front = z0 < 0;
    const yC = front ? hood(z0) + 0.02 : 1.36, fr = [1, 0.965, 0.86, 0.6, 0.3, 0][j];
    let y = yC + (front ? 0.02 : 0.006) * (1 - fr * fr);
    if (j === 1) y = y0 + (yC - y0) * 0.6;
    if (front && j === 3) y += 0.012; // Haubensicke
    let z = z0;
    if (s === 0) z = z0 - 0.06 * (1 - fr * fr) ** 0.5;
    if (z0 > -0.95 && z0 < -0.8 && j >= 2) y = Math.max(y, 1.28); // Windlauf
    return [x0 * fr, y, z];
  };
  const side = (s, k) => {
    const z = zs[s];
    let x = w(z) - 0.01 * (k === 0 ? 1 : 0);
    // Kotflügel vorn ausgestellt (über dem Rad breiter, Kante nach außen), hinten Kastenflanke
    if (z < -0.9) x += 0.03 * smooth(0.3, 0.9, levelY(z, k) - 0.4) * (1 - smooth(-1.0, -0.9, z));
    if (k === 2) x += 0.008; // Sicke längs der Flanke
    if (s === 0 || s === zs.length - 1) x -= 0.03;
    return [x, levelY(z, k), z];
  };
  const faceAt = (j, k, last) => {
    const z0 = last ? zs[zs.length - 1] : zs[0], kTop = top(last ? zs.length - 1 : 0, j);
    const H = last ? [0.7, 0.78, 1.02, 1.26] : [0.66, 0.72, 0.9, 1.06];
    const y = Math.min(H[k], kTop[1] - (K - k) * 0.03), wf = w(z0), x = XF[j] * (wf - 0.02);
    return [x, y, z0 + (last ? 0.04 : -0.08) * (1 - (XF[j]) ** 4)];
  };
  const front = (j, k) => faceAt(j, k, false);
  const rear = (j, k) => faceAt(j, k, true);
  const tagTop = ({ jj, z0, z1 }) => {
    const zm = (z0 + z1) / 2;
    if (inTub(zm) && zm > tubZ0 && zm < tubZ1) return jj <= 2 ? TAG.PAINT : jj >= 3 ? TAG.PAINT : 0;
    return TAG.PAINT;
  };
  const tagBand = ({ kind, jj, k }) => {
    if (kind === 'front' && k >= 1 && k <= 2 && jj >= 1) return TAG.GRILLE;
    return TAG.PAINT;
  };
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  const edge = (e) => {
    if (e.zone === 'bandH') return { c: e.k === 1 ? 2 : e.k === 3 ? 2 : e.k === 2 && e.kind === 'side' ? 1 : 0 };
    if (e.zone === 'bandV') return e.kind === 'side' && (e.s === 0 || e.s === zs.length - 1) ? { c: 2 } : null;
    if (e.zone === 'row') {
      if (e.s === 0 || e.s === zs.length - 1) return { c: 2 };
      if ((near(zs[e.s], tubZ0) || near(zs[e.s], tubZ1)) && e.jj >= 0) return { c: 2 };
      if (near(zs[e.s], -0.92)) return { seam: 3 };
      return null;
    }
    if (e.zone === 'col') {
      const zm = (e.z0 + e.z1) / 2;
      if (e.jv === 0) return { c: 2 };
      if (e.jv === 1 && inTub(zm)) return { c: 2 };
      if (e.jv === 2 && inTub(zm)) return { c: 2 };
      if (e.jv === 3 && inTub(zm)) return { c: 2 };
      if (e.jv === 2 && zm < -0.92) return { c: 1, seam: 3 };
      if (e.jv === 1) return { c: 2 };
      return null;
    }
    return null;
  };
  void lipX; void yb;
  return { D: { J, K, zs, top, side, front, rear, tagTop, tagBand, edge, matCrease: 2 }, SH };
}

export function jeepBody(level) {
  const key = `jeep:${level}`;
  if (!CACHE.has(key)) {
    const { D, SH } = jeepSpec(level >= 2 ? 1 : 0.8);
    const B = blanket(D);
    const R = finishBody(B, { levels: level, frit: false, wear: true, wheels: SH.arches.map((a) => ({ z: a.z, y: a.y, r: 0.42, x: 0.86 })), cabin: [-0.9, 2.1], cabinFloor: 0.9, innerOffset: 0.03 });
    R.meta = SH;
    CACHE.set(key, R);
  }
  return copyOf(CACHE.get(key));
}

/** Rohnetz (unterteilt, ohne Ausgabe) eines Pkw – für Wracks (Verformung je Ecke). */
export function pkwSub(style, level) {
  const { D } = pkwSpec(style, level >= 2 ? 1 : 0.8);
  return subdivide(blanket(D).M, level);
}

/* ------------------------------------------------------------------ Polster/Innenraum */

const SOFT = new Map();
/**
 * Weicher Quader (Polster, Armaturenbrett): Würfel-Käfig w × h × d, alle Kanten mit Schärfe `crease` (0 = Kissen,
 * 1 = gepolsterte Kante, 2 = enger Radius), levels Unterteilungen. → BufferGeometry (eigene Kopie).
 */
export function softBox(w, h, d, { levels = 2, crease = 1, bulge = 0 } = {}) {
  const key = `${levels}:${crease}`;
  if (!SOFT.has(key)) {
    const P = [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1].map((v) => v * 0.5);
    const Q = [0, 3, 2, 1, 4, 5, 6, 7, 0, 1, 5, 4, 2, 3, 7, 6, 1, 2, 6, 5, 0, 4, 7, 3];
    const crs = new Map();
    if (crease) for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) crs.set(edgeKey(Q[f * 4 + i], Q[f * 4 + ((i + 1) & 3)]), crease);
    const S = subdivide({ P, Q, F: [1, 1, 1, 1, 1, 1], crease: crs, seam: new Map(), corner: new Set() }, levels);
    SOFT.set(key, toGeometry(S, new Set([1]), { normals: cornerNormals(S, 70) }));
  }
  const g = SOFT.get(key).clone();
  // auf Maß bringen: Käfig-Einheitswürfel schrumpft beim Unterteilen → Grenzen messen und strecken
  g.computeBoundingBox();
  const bb = g.boundingBox, P = g.attributes.position;
  const sx = w / (bb.max.x - bb.min.x), sy = h / (bb.max.y - bb.min.y), sz = d / (bb.max.z - bb.min.z);
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i) * sx, y = P.getY(i) * sy, z = P.getZ(i) * sz;
    if (bulge) { const u = 1 - (2 * x / w) ** 2, v = 1 - (2 * z / d) ** 2; if (y > 0) y += bulge * Math.max(0, u) * Math.max(0, v); }
    P.setXYZ(i, x, y, z);
  }
  const N = g.attributes.normal;
  for (let i = 0; i < N.count; i++) { const nx = N.getX(i) / sx, ny = N.getY(i) / sy, nz = N.getZ(i) / sz, l = Math.hypot(nx, ny, nz) || 1; N.setXYZ(i, nx / l, ny / l, nz / l); }
  return g;
}
