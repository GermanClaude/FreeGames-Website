// NULLPUNKT — Kopf/Gesicht des Soldaten als Signed-Distance-Feld (SDF) und Netzgenerator (ohne three.js, auch in Node prüfbar).
//
// Der Kopf ist ein Feld aus weich verschmolzenen Grundkörpern (Schädel, Mittelgesicht, Jochbeine, Kiefer mit Kinn,
// Brauenwulst, Augenhöhlen + Augäpfel mit Lidrand, Nase mit Flügeln und Nasenlöchern, Lippen, Mundhöhle mit Zähnen und
// Zunge, Hals mit Kehlkopf). Das Netz entsteht durch Strahlen von einem Punkt im Kopf nach außen (Kugelgitter, an
// Augen/Mund/Nase verdichtet): jede Ecke = äußerster Schnittpunkt ihres Strahls mit der Fläche, Normale = Feldgradient.
// Morph-Ziele kosten so fast nichts extra: dieselben Strahlen gegen das Feld mit verstellten Parametern (Kiefer
// geöffnet, Mundwinkel breit, Lippen gerundet …) – die Differenz ist das Ziel (Position, Normale, Farbmasken).
//
// Farbkanäle je Ecke (werden mitgemorpht, damit Lippen/Zähne/Mundraum beim Öffnen stimmen):
//   R = Zähne, G = Mundhöhle, B = Lippenrot, A = Zunge.
// Zusatzattribut aRest (xyz = Ruhelage relativ zum Kopfmittelpunkt HEAD_C, w = Umgebungsverdeckung + 2 × Teil
// (0 Kopf, 1 Ohr)) – der Shader leitet daraus Brauen, Haaransatz, Bartschatten, Lidspalte und Abdeckungen ab.
//
// Koordinaten: Modellraum der Bindepose (Blick −Z, rechts +X); Kopfmittelpunkt HEAD_C = (0, 1,685, 0).

export const HEAD_C = [0, 1.685, 0.0];

/** Morph-Ziele (Reihenfolge = morphTargetInfluences). */
export const FACE_MORPHS = Object.freeze([
  'jawOpen', 'lipsWide', 'lipsRound', 'lipsPress', 'lipsPart', 'lipTuck', 'tongueUp',
  'smile', 'frown', 'sneer', 'browDown', 'browInnerUp', 'browUp',
]);

/** Augen (relativ zu HEAD_C): Mittelpunkt ±x, Radius; Lidspalte (Halbbreite, Oberlid-/Unterlidhöhe) – auch im Shader. */
export const EYE = Object.freeze({ x: 0.0315, y: 0.007, z: -0.0705, r: 0.0122, hw: 0.0142, up: 0.0047, lo: -0.0049 });

/** Kopfform je Figur (0 = Mittel; typischer Bereich −1 … 1). */
export const SHAPE_DEFAULT = Object.freeze({ jaw: 0, chin: 0, nose: 0, noseW: 0, brow: 0, cheek: 0, lips: 0, skull: 0, eyes: 0, neck: 0 });

/** Vorgefertigte Kopfformen für Bots (Abwechslung ohne je Bot neu zu rechnen). */
export const SHAPE_PRESETS = Object.freeze([
  { jaw: 0.2, chin: 0.1, nose: 0, noseW: 0, brow: 0.2, cheek: 0, lips: 0, skull: 0, eyes: 0, neck: 0.2 },
  { jaw: 0.7, chin: 0.5, nose: 0.4, noseW: 0.3, brow: 0.6, cheek: 0.3, lips: -0.3, skull: 0.2, eyes: -0.2, neck: 0.7 },
  { jaw: -0.4, chin: -0.2, nose: -0.3, noseW: -0.2, brow: -0.2, cheek: -0.3, lips: 0.4, skull: -0.2, eyes: 0.2, neck: -0.2 },
  { jaw: 0.4, chin: -0.4, nose: 0.8, noseW: 0.6, brow: 0.4, cheek: 0.5, lips: 0.2, skull: 0.4, eyes: -0.1, neck: 0.4 },
]);

/** Auflösungen: Strahlen in Umfangs- (nP) und Höhenrichtung (nT). */
export const FACE_RES = Object.freeze({ cine: { nP: 116, nT: 92 }, near: { nP: 60, nT: 46 }, mid: { nP: 36, nT: 26 } });

/* ------------------------------------------------------------------ Feld-Grundbausteine */

const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a, b, k) { return -smin(-a, -b, k); }
/** Ellipsoid (Näherung nach Quílez). */
function ell(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = x - cx, py = y - cy, pz = z - cz;
  const k0 = Math.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
  const k1 = Math.sqrt((px / (rx * rx)) ** 2 + (py / (ry * ry)) ** 2 + (pz / (rz * rz)) ** 2);
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
/** Kapsel a→b mit Radius r1→r2. */
function cap(x, y, z, ax, ay, az, bx, by, bz, r1, r2) {
  const bax = bx - ax, bay = by - ay, baz = bz - az, pax = x - ax, pay = y - ay, paz = z - az;
  const t = sat((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz));
  return Math.hypot(pax - bax * t, pay - bay * t, paz - baz * t) - (r1 + (r2 - r1) * t);
}

/* ------------------------------------------------------------------ Kopf-Feld */

/** Arbeitsparameter: Form (S) + Morph-Stellungen (M). → Objekt, das sdf() schnell liest. */
export function makeParams(shape = SHAPE_DEFAULT, morph = null) {
  const S = { ...SHAPE_DEFAULT, ...shape };
  const M = {};
  for (const n of FACE_MORPHS) M[n] = (morph && morph[n]) || 0;
  return { S, M, jawA: M.jawOpen * 0.18 + M.lipsPart * 0.012 };
}

const HJ_Y = -0.022, HJ_Z = 0.022; // Kiefergelenk (Drehachse x)

/** Mund-/Brauen-Verformung als Verschiebungsfeld → ausgewertet wird das Feld an p − D(p). out = [dx, dy, dz]. */
function warp(x, y, z, P, out) {
  const M = P.M;
  let dx = 0, dy = 0, dz = 0;
  const front = sat((-z - 0.045) / 0.03);
  const ax = Math.abs(x), sx = x < 0 ? -1 : 1;
  // Mundbereich
  const mm = Math.exp(-((x / 0.042) ** 2 + ((y + 0.066) / 0.03) ** 2)) * front;
  if (mm > 1e-4) {
    const c = Math.min(1, (x / 0.027) ** 2); // 0 Mitte … 1 Mundwinkel
    const cl = Math.min(1, ax / 0.027);
    if (M.smile) { dy += 0.0088 * c * mm * M.smile; dz += 0.0058 * c * mm * M.smile; dx += sx * 0.0058 * cl * mm * M.smile; }
    if (M.frown) { dy -= 0.0048 * c * mm * M.frown; dz += 0.001 * c * mm * M.frown; }
    if (M.lipsWide) { dx += sx * 0.0068 * cl * mm * M.lipsWide; dz += 0.0026 * c * mm * M.lipsWide; }
    if (M.lipsRound) { dx -= x * 0.34 * mm * M.lipsRound; dz -= 0.0068 * mm * (1 - 0.5 * c) * M.lipsRound; }
  }
  // Wangen heben sich beim Lächeln
  const cm = Math.exp(-(((ax - 0.04) / 0.019) ** 2 + ((y + 0.028) / 0.02) ** 2)) * front;
  if (cm > 1e-4 && M.smile) { dy += 0.0048 * cm * M.smile; dz -= 0.0034 * cm * M.smile; }
  // Naserümpfen: Oberlippe seitlich + Nasenflügel hoch
  const sm = Math.exp(-(((ax - 0.012) / 0.013) ** 2 + ((y + 0.046) / 0.013) ** 2)) * front;
  if (sm > 1e-4 && M.sneer) { dy += 0.0042 * sm * M.sneer; dz -= 0.0012 * sm * M.sneer; }
  // Kinn hebt sich beim Mundwinkel-nach-unten (Mentalis)
  const km = Math.exp(-((x / 0.024) ** 2 + ((y + 0.094) / 0.016) ** 2)) * front;
  if (km > 1e-4 && M.frown) { dy += 0.0022 * km * M.frown; dz -= 0.0018 * km * M.frown; }
  // Brauen: innen runter/zusammen (wütend), innen hoch (besorgt), ganz hoch (überrascht)
  const bf = sat((-z - 0.05) / 0.025);
  const bi = Math.exp(-(((ax - 0.018) / 0.016) ** 2 + ((y - 0.022) / 0.015) ** 2)) * bf;
  const bo = Math.exp(-(((ax - 0.04) / 0.02) ** 2 + ((y - 0.024) / 0.016) ** 2)) * bf;
  if (M.browDown) { dy -= (0.0052 * bi + 0.0018 * bo) * M.browDown; dx -= sx * 0.0022 * bi * M.browDown; dz -= 0.0012 * bi * M.browDown; }
  if (M.browInnerUp) { dy += 0.0078 * bi * M.browInnerUp + 0.0012 * bo * M.browInnerUp; }
  if (M.browUp) { const bb = Math.max(bi, bo); dy += 0.0068 * bb * M.browUp; }
  out[0] = dx; out[1] = dy; out[2] = dz;
}

const _w = [0, 0, 0];
/** Rückgabe: Abstand; info (optional) bekommt Teilabstände für die Farbmasken. */
export function sdf(x0, y0, z0, P, info = null) {
  const S = P.S, M = P.M;
  warp(x0, y0, z0, P, _w);
  const x = x0 - _w[0], y = y0 - _w[1], z = z0 - _w[2];
  const ax = Math.abs(x);
  // Schädel + Hinterhaupt
  let d = ell(x, y, z, 0, 0.022, 0.012, 0.0745 + S.skull * 0.003, 0.088, 0.098 + S.skull * 0.003);
  d = smin(d, ell(x, y, z, 0, 0.0, 0.066, 0.06, 0.058, 0.046), 0.03);
  // Schläfen leicht abflachen
  d = smax(d, ax - 0.0735 - S.skull * 0.003, 0.02);
  // Mittelgesicht (Oberkiefer)
  const mtf = 1 + 0.45 * sat((-z - 0.05) / 0.045); // nach vorn schmaler
  d = smin(d, ell(x * mtf, y, z, 0, -0.026, -0.03, 0.058 + S.cheek * 0.002, 0.052, 0.062), 0.024);
  // Stirn (breiter, flacher als die Schädelkugel)
  d = smin(d, ell(x, y, z, 0, 0.03, -0.03, 0.066, 0.045, 0.055), 0.02);
  // Wangenpolster neben der Nase, Mundpartie (Lippen sitzen auf einem Wulst, nicht auf einer Schnauze)
  d = smin(d, ell(ax, y, z, 0.03, -0.022, -0.068, 0.022 + S.cheek * 0.002, 0.02, 0.021), 0.014);
  d = smin(d, ell(x, y, z, 0, -0.058, -0.056, 0.041 + S.jaw * 0.002, 0.03, 0.038), 0.018);
  d = smin(d, ell(ax, y, z, 0.041, -0.056, -0.04, 0.022 + S.cheek * 0.002, 0.03, 0.035), 0.016);
  // Jochbeine
  d = smin(d, ell(ax, y, z, 0.049 + S.cheek * 0.002, -0.004, -0.05, 0.021, 0.0145 + S.cheek * 0.002, 0.025), 0.016);
  // Brauenwulst (innen/außen je Seite)
  const bw = 1 + S.brow * 0.15;
  d = smin(d, ell(ax, y, z, 0.017, 0.021, -0.08 - S.brow * 0.002, 0.018, 0.0105 * bw, 0.0135), 0.014);
  d = smin(d, ell(ax, y, z, 0.041, 0.022, -0.072, 0.02, 0.0095 * bw, 0.013), 0.014);
  // Kiefer (dreht um das Gelenk): Unterkiefer, Kieferwinkel, Kinn – Punkt in Kieferlage zurückdrehen
  const a = P.jawA, ca = Math.cos(a), sa = Math.sin(a);
  // Kiefer dreht und gleitet dabei etwas nach vorn/unten (Kondylus) → Kinn fällt eher senkrecht
  const jgy = -0.003 * M.jawOpen, jgz = -0.006 * M.jawOpen;
  const ry = y - jgy - HJ_Y, rz = z - jgz - HJ_Z;
  const jy = ry * ca - rz * sa + HJ_Y, jz = ry * sa + rz * ca + HJ_Z;
  const jw = 1 + S.jaw * 0.08;
  const jtf = 1 + 0.25 * sat((-jz - 0.035) / 0.055); // Unterkiefer läuft zum Kinn hin schmal zu
  let dj = ell(x * jtf, jy, jz, 0, -0.066, -0.024, 0.05 * jw, 0.036, 0.058);
  dj = smin(dj, ell(ax, jy, jz, 0.044 * jw, -0.066, 0.002, 0.013, 0.026, 0.024), 0.02);
  dj = smin(dj, ell(x, jy, jz, 0, -0.094 - S.chin * 0.003, -0.082 - S.chin * 0.003, 0.0225 + S.chin * 0.003 + S.jaw * 0.002, 0.0185, 0.0172), 0.026);
  d = smin(d, dj, 0.022);
  // Hals mit Ansatz zum Trapez (unten breiter), Kehlkopf
  const nr = 0.054 + S.neck * 0.004 + 0.026 * sstep(-0.075, -0.17, y);
  const nd = Math.max(Math.hypot(x / 1.0, (z - 0.012) / 1.08) - nr, Math.abs(y + 0.13) - 0.1);
  d = smin(d, nd, 0.035);
  d = smin(d, ell(x, y, z, 0, -0.132, -0.05 - S.neck * 0.002, 0.0085, 0.013, 0.009), 0.012);
  if (info) { info.lip = 1; info.teeth = 1; info.tongue = 1; info.cav = 1; }
  // Gesichtsdetails nur vorn (Abstand zum Grobkörper > Einflussradius → ohne Wirkung, spart ≈ 60 % der Rechnung)
  if (z > -0.03 || y < -0.135 || y > 0.06) return d;
  // Augenhöhlen (weich ausgehöhlt)
  const ex = EYE.x, ey = EYE.y, ez = EYE.z;
  if (y > -0.025) {
  d = smax(d, -ell(ax, y, z, ex, ey - 0.0005, ez - 0.017, 0.0195, 0.0135, 0.0145), 0.007);
  // Augapfel + Lidschale (Lidschale nur außerhalb der Lidspalte → 1 mm Lidrand)
  const exr = ax - ex, eyr = y - ey, ezr = z - ez;
  const eb = Math.hypot(exr, eyr, ezr) - EYE.r;
  const u = Math.max(0, 1 - (exr / EYE.hw) ** 2), uu = Math.pow(u, 0.8);
  const upL = EYE.up * uu + 0.0007 * (exr / EYE.hw), loL = EYE.lo * uu;
  const open = Math.max(Math.max(eyr - upL, loL - eyr), Math.abs(exr) - EYE.hw);
  const lid = smax(Math.hypot(exr, eyr, ezr) - EYE.r - 0.0012, -open, 0.0012);
  d = smin(d, Math.min(eb, lid), 0.0035);
  }
  // Nase: Rücken, Spitze, Flügel, Nasenlöcher
  if (ax < 0.045 && y < 0.02 && y > -0.075 && z < -0.06) {
  const nl = 1 + S.nose * 0.08, nw = 1 + S.noseW * 0.12;
  d = smin(d, cap(x, y, z, 0, 0.006, -0.087, 0, -0.03 * nl, -0.109 - S.nose * 0.004, 0.0062 * nw, 0.0088 * nw), 0.009);
  d = smin(d, ell(x, y, z, 0, -0.033 * nl, -0.106 - S.nose * 0.004, 0.0108 * nw, 0.0095, 0.0108), 0.006);
  d = smin(d, ell(ax, y, z, 0.0125 * nw, -0.038 * nl, -0.0965, 0.0085 * nw, 0.0078, 0.0092), 0.006);
  d = smax(d, -ell(ax, y, z, 0.0068 * nw, -0.0438 * nl, -0.1035, 0.0034 * nw, 0.0021, 0.0044), 0.0016);
  }
  if (y > -0.025 || ax > 0.05) return d;
  // Nasolabialfalte (beim Lächeln tiefer)
  d = smax(d, -cap(ax, y, z, 0.019, -0.034, -0.094, 0.028, -0.068, -0.088, 0.0011, 0.0008), 0.0025 + M.smile * 0.002);
  // Lippen (Unterlippe folgt dem Kiefer zu 90 %)
  const lf = 1 + S.lips * 0.15;
  const pr = M.lipsPress, tk = M.lipTuck, pt = M.lipsPart;
  const bow = 0.0011 * Math.exp(-(((ax - 0.006) / 0.004) ** 2)) - 0.0006 * Math.exp(-((x / 0.0025) ** 2));
  const dUp = ell(x, y - bow, z, 0, -0.0577 + pt * 0.0012, -0.0935, 0.0235, (0.0058 - pr * 0.0016) * lf, (0.0078 - pr * 0.002) * lf);
  const la = a * 0.9, cl = Math.cos(la), sl = Math.sin(la);
  const ly = y - jgy * 0.9 - HJ_Y, lz = z - jgz * 0.9 - HJ_Z;
  const ly2 = ly * cl - lz * sl + HJ_Y, lz2 = ly * sl + lz * cl + HJ_Z;
  const dLo = ell(x, ly2, lz2, 0, -0.0705 + tk * 0.0045 - pt * 0.0018, -0.091 + tk * 0.0062, 0.0215, (0.0062 - pr * 0.0014) * lf, (0.008 - pr * 0.0018 - tk * 0.002) * lf);
  const dLip = Math.min(dUp, dLo);
  d = smin(d, dLip, 0.0055);
  // Philtrum (flache Rinne zwischen Nase und Amorbogen)
  if (y > -0.06 && y < -0.04 && ax < 0.01) d = smax(d, -cap(x, y, z, 0, -0.046, -0.1005, 0, -0.0525, -0.1035, 0.0018, 0.0022), 0.003);
  // Mundhöhle (Spalt zwischen den Lippen, öffnet mit Kiefer/Lippenstellung)
  const loTopY = (-0.0705 + 0.0062 - HJ_Y) * cl + (-0.091 - HJ_Z) * sl + HJ_Y + jgy * 0.9; // Oberkante Unterlippe nach Drehung
  const gap = Math.max(0, (-0.0577 - 0.0058 + pt * 0.0012) - loTopY + tk * 0.0045) * (1 - pr);
  const cy = (-0.0645 + loTopY) * 0.5 - pt * 0.0003;
  const crx = 0.0198 * (1 + M.lipsWide * 0.2 - M.lipsRound * 0.38), cry = 0.0004 + gap * 0.5;
  const dCav = ell(x, y, z, 0, cy, -0.08, crx, cry, 0.024);
  d = smax(d, -dCav, 0.0018);
  // Zähne (oben fest, unten mit dem Kiefer), Zunge (mit dem Kiefer, Spitze hebt sich bei L/D/N)
  const dTu = ell(x, y, z, 0, -0.0603, -0.0805, 0.019, 0.0048, 0.0085);
  const dTl = ell(x, jy, jz, 0, -0.0697, -0.079, 0.0178, 0.0044, 0.0082);
  const ty = -0.0705 + M.tongueUp * 0.0075, tz = -0.0715 - M.tongueUp * 0.0035;
  const dTo = smin(ell(x, jy, jz, 0, -0.0715, -0.062, 0.0155, 0.0056, 0.021), ell(x, jy + (jy - ty) * 0, jz, 0, ty, tz, 0.0085, 0.0042, 0.0075), 0.006);
  const dTeeth = Math.min(dTu, dTl);
  d = Math.min(d, dTeeth, dTo);
  if (info) { info.lip = dLip; info.teeth = dTeeth; info.tongue = dTo; info.cav = dCav; }
  return d;
}

/* ------------------------------------------------------------------ Strahlengitter */

/** Abtastpositionen aus einer Dichtefunktion (Umkehrung der Stammfunktion). */
function warpSamples(n, a, b, dens, closed) {
  const N = 2048, cum = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) cum[i + 1] = cum[i] + dens(a + (b - a) * (i + 0.5) / N);
  const out = new Float64Array(n);
  const m = closed ? n : n - 1;
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (cum[N] * k) / m;
    while (j < N - 1 && cum[j + 1] < target) j++;
    const f = (target - cum[j]) / Math.max(1e-12, cum[j + 1] - cum[j]);
    out[k] = a + (b - a) * (j + Math.min(1, Math.max(0, f))) / N;
  }
  return out;
}

const RO = [0, -0.018, 0.004]; // Strahlursprung (relativ zu HEAD_C)
const RMAX = 0.24;
const TMAX = 2.84; // unterster Polarwinkel (offener Halsrand im Kragen)

/** Äußerster Schnitt eines Strahls (Richtung d) mit dem Feld; Start bei r0 (außen). → Abstand vom Ursprung. */
function march(dx, dy, dz, P, r0) {
  let r = r0, prev = r0, dPrev = sdf(RO[0] + dx * r0, RO[1] + dy * r0, RO[2] + dz * r0, P);
  if (dPrev < 0) return r0;
  r -= Math.max(dPrev * 0.6, 0.00025);
  for (let i = 0; i < 160 && r > 0.001; i++) {
    const d = sdf(RO[0] + dx * r, RO[1] + dy * r, RO[2] + dz * r, P);
    if (d < 0) {
      // Regula falsi zwischen prev (außen, dPrev > 0) und r (innen, d < 0)
      let lo = r, hi = prev, dLo = d, dHi = dPrev;
      for (let k = 0; k < 4; k++) {
        const mid = hi - dHi * (hi - lo) / (dHi - dLo);
        const dm = sdf(RO[0] + dx * mid, RO[1] + dy * mid, RO[2] + dz * mid, P);
        if (Math.abs(dm) < 2e-6) return mid;
        if (dm < 0) { lo = mid; dLo = dm; } else { hi = mid; dHi = dm; }
      }
      return hi - dHi * (hi - lo) / (dHi - dLo);
    }
    prev = r; dPrev = d;
    r -= Math.max(d * 0.6, 0.00025);
  }
  return r;
}

const _i = {};
/** Punkt, Normale und Farbmasken an der Stelle (x, y, z) relativ zu HEAD_C. */
function sampleAt(x, y, z, P, out, o) {
  const e = 0.00035;
  const nx = sdf(x + e, y, z, P) - sdf(x - e, y, z, P);
  const ny = sdf(x, y + e, z, P) - sdf(x, y - e, z, P);
  const nz = sdf(x, y, z + e, P) - sdf(x, y, z - e, P);
  const l = Math.hypot(nx, ny, nz) || 1;
  out.nrm[o * 3] = nx / l; out.nrm[o * 3 + 1] = ny / l; out.nrm[o * 3 + 2] = nz / l;
  out.pos[o * 3] = x; out.pos[o * 3 + 1] = y; out.pos[o * 3 + 2] = z;
  sdf(x, y, z, P, _i);
  const teeth = 1 - sstep(0.0004, 0.0016, _i.teeth);
  const tongue = (1 - sstep(0.0004, 0.0018, _i.tongue)) * (1 - teeth);
  // Mundhöhle: innerhalb der ausgeschnittenen Höhle (Wand der Höhle) und nicht Zahn/Zunge
  const cav = (1 - sstep(0.0003, 0.0015, _i.cav)) * (1 - teeth) * (1 - tongue) * (z > -0.11 && y < -0.045 && y > -0.1 ? 1 : 0);
  const lip = (1 - sstep(0.0004, 0.0032, _i.lip)) * (1 - cav) * (1 - teeth) * (z < -0.082 ? 1 : 0);
  out.col[o * 4] = teeth; out.col[o * 4 + 1] = Math.max(cav, 0); out.col[o * 4 + 2] = lip; out.col[o * 4 + 3] = tongue;
}

/** Morph-Ziele, die als Differenz zu einem anderen Zustand gerechnet werden (sonst unsichtbar, z. B. Zunge hinter Lippen). */
const MORPH_BASE = { tongueUp: { jawOpen: 0.6 } };

/** Bereiche, in denen ein Morph-Ziel wirkt (Kopf-Koordinaten): [yMin, yMax, zMax] – außerhalb Differenz 0. */
const MORPH_BOX = {
  jawOpen: [-0.2, -0.02, 0.06], lipsWide: [-0.11, -0.03, -0.04], lipsRound: [-0.11, -0.03, -0.04], lipsPress: [-0.1, -0.04, -0.06],
  lipsPart: [-0.12, -0.03, -0.04], lipTuck: [-0.1, -0.04, -0.06], tongueUp: [-0.1, -0.04, -0.03], smile: [-0.11, 0.0, -0.03],
  frown: [-0.12, -0.04, -0.04], sneer: [-0.08, -0.02, -0.06], browDown: [-0.005, 0.05, -0.04], browInnerUp: [-0.005, 0.055, -0.04],
  browUp: [-0.005, 0.06, -0.04],
};

/**
 * Kopfnetz erzeugen. res: 'cine' | 'near' | 'mid' oder { nP, nT }; shape: Kopfform. →
 * { n, pos Float32 (Modellraum), nrm, col (4), rest (4), ski/skw (Uint8×4), idx (Uint32/16), morphs: [{ name, pos, nrm, col }] (Differenzen), ms }
 */
export function buildFaceData(res = 'near', shape = SHAPE_DEFAULT, { morphs = true } = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const R = typeof res === 'string' ? FACE_RES[res] || FACE_RES.near : res;
  const nP = R.nP, nT = R.nT;
  // Gitter: Umfang (φ = 0 vorn = −Z) vorn dichter, Höhe an Augen/Nase/Mund dichter
  const phis = warpSamples(nP, -Math.PI, Math.PI, (p) => 1 + 3.2 * Math.exp(-((p / 0.75) ** 2)), true);
  const thetas = warpSamples(nT, 0.06, TMAX, (t) => 1 + 2.2 * Math.exp(-(((t - 1.47) / 0.12) ** 2)) + 2.6 * Math.exp(-(((t - 2.05) / 0.16) ** 2)) + 1.2 * Math.exp(-(((t - 1.75) / 0.2) ** 2)) - 0.4 * sstep(2.3, 2.6, t), false);
  const nHead = 1 + nP * nT;
  const ear = buildEars(nP >= 80 ? 2 : nP >= 50 ? 1 : 0);
  const n = nHead + ear.n;
  const D = { n, pos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), col: new Float32Array(n * 4), rest: new Float32Array(n * 4) };
  const P0 = makeParams(shape);
  const dirs = new Float32Array(nHead * 3);
  dirs[0] = 0; dirs[1] = 1; dirs[2] = 0;
  for (let j = 0; j < nT; j++) for (let i = 0; i < nP; i++) {
    const k = 1 + j * nP + i, th = thetas[j], ph = phis[i];
    dirs[k * 3] = Math.sin(th) * Math.sin(ph); dirs[k * 3 + 1] = Math.cos(th); dirs[k * 3 + 2] = -Math.sin(th) * Math.cos(ph);
  }
  const rr = new Float32Array(nHead);
  for (let k = 0; k < nHead; k++) {
    const dx = dirs[k * 3], dy = dirs[k * 3 + 1], dz = dirs[k * 3 + 2];
    const r = march(dx, dy, dz, P0, dy > -0.45 ? 0.16 : RMAX);
    rr[k] = r;
    sampleAt(RO[0] + dx * r, RO[1] + dy * r, RO[2] + dz * r, P0, D, k);
  }
  // Ohren anhängen (feste Form, keine Morphs)
  D.pos.set(ear.pos, nHead * 3); D.nrm.set(ear.nrm, nHead * 3);
  // Umgebungsverdeckung (Feld-AO entlang der Normale) + Ruhelage
  for (let k = 0; k < n; k++) {
    const x = D.pos[k * 3], y = D.pos[k * 3 + 1], z = D.pos[k * 3 + 2];
    const ux = D.nrm[k * 3], uy = D.nrm[k * 3 + 1], uz = D.nrm[k * 3 + 2];
    let occ = 0, w = 1;
    for (let s = 1; s <= 5; s++) {
      const h = 0.0035 * s;
      occ += w * Math.max(0, h - sdf(x + ux * h, y + uy * h, z + uz * h, P0));
      w *= 0.6;
    }
    let ao = sat(1 - occ * 70);
    if (k >= nHead) ao = ear.ao[k - nHead];
    const part = k >= nHead ? 1 : 0;
    D.rest[k * 4] = x; D.rest[k * 4 + 1] = y; D.rest[k * 4 + 2] = z; D.rest[k * 4 + 3] = ao + part * 2;
  }
  // Dreiecke
  const tri = [];
  for (let i = 0; i < nP; i++) tri.push(0, 1 + i, 1 + ((i + 1) % nP)); // Scheitel (Fächer)
  for (let j = 0; j + 1 < nT; j++) for (let i = 0; i < nP; i++) {
    const a = 1 + j * nP + i, b = 1 + j * nP + ((i + 1) % nP), c = a + nP, e = b + nP;
    // kürzere Diagonale (glattere Fläche an Nase/Lippen)
    const d1 = dist2(D.pos, a, e), d2 = dist2(D.pos, b, c);
    if (d1 < d2) tri.push(a, c, e, a, e, b); else tri.push(a, c, b, b, c, e);
  }
  for (let t = 0; t < ear.idx.length; t++) tri.push(ear.idx[t] + nHead);
  // Wicklung prüfen (Normale außen): erstes Kopfdreieck gegen Feldnormale
  D.idx = n > 65535 ? new Uint32Array(tri) : new Uint16Array(tri);
  D._earIdx = ear.idx.length;
  fixWinding(D, nHead * 0 + 1 + Math.floor(nT / 2) * nP);
  // Hautgewichte: Kopf (4) oben, Hals (3) unten
  D.ski = new Uint8Array(n * 4); D.skw = new Uint8Array(n * 4);
  for (let k = 0; k < n; k++) {
    const y = D.pos[k * 3 + 1];
    const wHead = k >= nHead ? 1 : sstep(-0.125, -0.055, y);
    D.ski[k * 4] = 4; D.ski[k * 4 + 1] = 3;
    const a8 = Math.round(wHead * 255);
    D.skw[k * 4] = a8; D.skw[k * 4 + 1] = 255 - a8;
  }
  // Morph-Ziele (Differenzen; Ohren 0)
  D.morphs = [];
  if (morphs) {
    const tmp = { pos: new Float32Array(3), nrm: new Float32Array(3), col: new Float32Array(4) };
    const tmpB = { pos: new Float32Array(3), nrm: new Float32Array(3), col: new Float32Array(4) };
    for (const name of FACE_MORPHS) {
      const P = makeParams(shape, { [name]: 1, ...(MORPH_BASE[name] || {}) });
      const PB = MORPH_BASE[name] ? makeParams(shape, MORPH_BASE[name]) : null;
      const box = MORPH_BOX[name];
      const mp = new Float32Array(n * 3), mn = new Float32Array(n * 3), mc = new Float32Array(n * 4);
      let touched = 0;
      for (let k = 0; k < nHead; k++) {
        const y = D.pos[k * 3 + 1], z = D.pos[k * 3 + 2];
        if (y < box[0] - 0.02 || y > box[1] + 0.02 || z > box[2]) continue;
        const dx = dirs[k * 3], dy = dirs[k * 3 + 1], dz = dirs[k * 3 + 2];
        if (PB) {
          // Ziel relativ zu einem anderen Grundzustand (Zunge nur bei offenem Mund sichtbar)
          const r0 = Math.min(RMAX, rr[k] + 0.04);
          const rb = march(dx, dy, dz, PB, r0), rt = march(dx, dy, dz, P, r0);
          if (Math.abs(rb - rt) < 1e-6) continue;
          sampleAt(RO[0] + dx * rb, RO[1] + dy * rb, RO[2] + dz * rb, PB, tmpB, 0);
          sampleAt(RO[0] + dx * rt, RO[1] + dy * rt, RO[2] + dz * rt, P, tmp, 0);
          for (let c = 0; c < 3; c++) { mp[k * 3 + c] = tmp.pos[c] - tmpB.pos[c]; mn[k * 3 + c] = tmp.nrm[c] - tmpB.nrm[c]; }
          for (let c = 0; c < 4; c++) mc[k * 4 + c] = tmp.col[c] - tmpB.col[c];
          touched++;
          continue;
        }
        // unverändert? (Fläche am alten Punkt und Feld weiter außen gleich) → Differenz 0
        const rOut = Math.min(RMAX, rr[k] + (name === 'jawOpen' ? 0.04 : 0.016));
        const x0 = RO[0] + dx * rr[k], y0 = RO[1] + dy * rr[k], z0 = RO[2] + dz * rr[k];
        if (Math.abs(sdf(x0, y0, z0, P) - sdf(x0, y0, z0, P0)) < 1e-6) {
          const x1 = RO[0] + dx * rOut, y1 = RO[1] + dy * rOut, z1 = RO[2] + dz * rOut;
          const xm = (x0 + x1) * 0.5, ym = (y0 + y1) * 0.5, zm = (z0 + z1) * 0.5;
          if (Math.abs(sdf(x1, y1, z1, P) - sdf(x1, y1, z1, P0)) < 1e-6 && Math.abs(sdf(xm, ym, zm, P) - sdf(xm, ym, zm, P0)) < 1e-6) continue;
        }
        const r = march(dx, dy, dz, P, rOut);
        sampleAt(RO[0] + dx * r, RO[1] + dy * r, RO[2] + dz * r, P, tmp, 0);
        for (let c = 0; c < 3; c++) { mp[k * 3 + c] = tmp.pos[c] - D.pos[k * 3 + c]; mn[k * 3 + c] = tmp.nrm[c] - D.nrm[k * 3 + c]; }
        for (let c = 0; c < 4; c++) mc[k * 4 + c] = tmp.col[c] - D.col[k * 4 + c];
        touched++;
      }
      D.morphs.push({ name, pos: mp, nrm: mn, col: mc, touched });
    }
  }
  // in den Modellraum
  for (let k = 0; k < n; k++) { D.pos[k * 3] += HEAD_C[0]; D.pos[k * 3 + 1] += HEAD_C[1]; D.pos[k * 3 + 2] += HEAD_C[2]; }
  D.ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  D.triangles = D.idx.length / 3;
  D.nHead = nHead;
  return D;
}

function dist2(P, a, b) { return (P[a * 3] - P[b * 3]) ** 2 + (P[a * 3 + 1] - P[b * 3 + 1]) ** 2 + (P[a * 3 + 2] - P[b * 3 + 2]) ** 2; }

/** Dreieckswicklung so drehen, dass die Flächennormale zur Feldnormale zeigt (Stichprobe am Dreieck mit Ecke k). */
function fixWinding(D, k) {
  const I = D.idx;
  for (let t = 0; t < I.length; t += 3) {
    if (I[t] !== k && I[t + 1] !== k && I[t + 2] !== k) continue;
    const a = I[t], b = I[t + 1], c = I[t + 2], P = D.pos;
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const dot = fx * D.nrm[a * 3] + fy * D.nrm[a * 3 + 1] + fz * D.nrm[a * 3 + 2];
    if (dot < 0) {
      // alles Kopfgitter umdrehen (die Ohren haben eigene, richtige Wicklung → nur bis nHead-Indizes)
      const nHeadIdx = I.length - D._earIdx;
      for (let s = 0; s < nHeadIdx; s += 3) { const tmp = I[s + 1]; I[s + 1] = I[s + 2]; I[s + 2] = tmp; }
    }
    return;
  }
}

/* ------------------------------------------------------------------ Ohren */

/**
 * Ohrmuschel (beide Seiten): Kissen aus Vorder- und Rückseite über einer Ellipse; vorn Krempe (Helix) erhaben,
 * Muschel (Concha) vertieft, Ohrläppchen unten weich. Lage: seitlich am Schädel, leicht abstehend, nach hinten gekippt.
 * q: 0 grob … 2 fein. → { n, pos, nrm, idx, ao } relativ zu HEAD_C
 */
export function buildEars(q = 1) {
  const nu = [8, 12, 16][q], nv = [10, 14, 20][q];
  const pos = [], nrm = [], idx = [], ao = [];
  const H = 0.031, W = 0.0185; // Halbhöhe, Halbbreite
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    // lokale Ohrkoordinaten: a (nach hinten), b (hoch), Höhe h (nach außen)
    const pts = [];
    for (let face = 0; face < 2; face++) for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const s = (i / nu) * 2 - 1, t = (j / nv) * 2 - 1;
      // Ellipse, oben breiter (Birnenform), Läppchen unten schmaler
      const wb = W * (0.78 + 0.22 * Math.max(0, t) + 0.12 * (1 - Math.abs(t))) * (t < -0.6 ? 0.8 + 0.2 * ((t + 1) / 0.4) : 1);
      const rr = Math.hypot(s, t);
      const sc = rr > 1 ? 1 / rr : 1;
      const A = s * sc * wb, B = t * sc * H;
      const rho = Math.min(1, rr);
      let h;
      if (face === 0) {
        // Vorderseite: Krempe am Rand (rho ≈ 0,8–0,95), Muschel innen (vertieft), Läppchen glatt
        const helix = Math.exp(-(((rho - 0.86) / 0.09) ** 2)) * (t > -0.55 ? 1 : 0.4);
        const anti = Math.exp(-(((rho - 0.55) / 0.1) ** 2)) * (t > -0.3 ? 0.6 : 0.2);
        const concha = Math.exp(-((((A + 0.002) / (W * 0.45)) ** 2) + (((B + 0.004) / (H * 0.38)) ** 2)));
        h = 0.0038 + 0.0042 * helix + 0.0016 * anti - 0.0052 * concha;
        h *= 1 - sstep(0.94, 1.0, rho) * 0.85;
      } else {
        h = -0.0025 * (1 - rho * rho) - 0.0004;
      }
      pts.push([A, B, h, face, i, j]);
    }
    // in Kopfkoordinaten: Ohr an der Schädelseite (x = ±0,071), Mitte y −0,012, z +0,006; abstehend 18°, gekippt 12°
    const yaw = 0.32, tilt = 0.2;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    const map = (A, B, h) => {
      // Kippen (um die Ohr-Normale): A/B drehen
      const a2 = A * ct + B * st, b2 = -A * st + B * ct;
      // Ohr-Ebene: Normale = ±x, nach hinten abstehend: Drehung um y
      const lx = h, lz = a2; // lokale Normale (außen) + nach hinten
      const x = side * (0.0705 + lx * cy + lz * sy * 0.6 + Math.max(0, a2) * 0.25);
      const z = 0.008 + lz * cy - lx * sy * 0.3;
      return [x, -0.012 + b2, z];
    };
    for (const [A, B, h] of pts) pos.push(...map(A, B, h));
    const stride = (nu + 1) * (nv + 1);
    const T = [];
    for (let f = 0; f < 2; f++) for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = f * stride + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      T.push([a, b, c, f ? -1 : 1], [b, d, c, f ? -1 : 1]);
    }
    // Rand nähen (Vorderseite ↔ Rückseite)
    const ring = [];
    for (let i = 0; i <= nu; i++) ring.push(i);
    for (let j = 1; j <= nv; j++) ring.push(j * (nu + 1) + nu);
    for (let i = nu - 1; i >= 0; i--) ring.push(nv * (nu + 1) + i);
    for (let j = nv - 1; j >= 1; j--) ring.push(j * (nu + 1));
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      T.push([a, b, a + stride, 0], [b, b + stride, a + stride, 0]);
    }
    // Wicklung in Ohrkoordinaten festlegen (Vorderseite +h, Rückseite −h, Rand radial nach außen), Spiegelung links
    for (const [a, b, c, want] of T) {
      const A = pts[a], Bp = pts[b], Cp = pts[c];
      const ux = Bp[0] - A[0], uy = Bp[1] - A[1], uz = Bp[2] - A[2], vx = Cp[0] - A[0], vy = Cp[1] - A[1], vz = Cp[2] - A[2];
      const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      const s2 = want !== 0 ? fz * want : fx * (A[0] + Bp[0] + Cp[0]) + fy * (A[1] + Bp[1] + Cp[1]);
      let ok = s2 >= 0;
      if (side < 0) ok = !ok;
      if (ok) idx.push(base + a, base + b, base + c); else idx.push(base + a, base + c, base + b);
    }
    for (const p of pts) ao.push(p[3] === 0 ? 0.75 + 0.25 * Math.min(1, Math.hypot(p[0] / W, p[1] / H)) : 0.55);
  }
  // Normalen aus den Dreiecken
  const n = pos.length / 3, N = new Float32Array(n * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { N[v * 3] += fx; N[v * 3 + 1] += fy; N[v * 3 + 2] += fz; }
  }
  for (let v = 0; v < n; v++) { const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1; N[v * 3] /= l; N[v * 3 + 1] /= l; N[v * 3 + 2] /= l; }
  return { n, pos: new Float32Array(pos), nrm: N, idx, ao: new Float32Array(ao) };
}
