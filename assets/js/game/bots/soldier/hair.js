// NULLPUNKT — Frisuren und Bärte als Geometrie (Strang „mensch3“, 20.11.): Haarschalen + Strähnenbahnen am modellierten Kopf
// (face.js, Detailstufe 0 und Zwischensequenzen) statt nur gemalter Haare.
//
// Aufbau
//   • Kopffeld: die Hautdreiecke des Kopfnetzes (Bindepose) werden in ein Kugelraster (Radius je Richtung θ/a um die Kopfmitte)
//     und ein Zylinderraster (waagrechter Radius je Höhe/Richtung, mit Ohren und Hals) gerastert → Haare sitzen genau auf
//     jeder Kopfform (Form-Ziele aus face-mesh.js), ohne Durchstechen.
//   • Kappe: Gitter vom Wirbel (bzw. Dutt/Zopf-Ansatz) zum Haaransatz, mehrere Schalen (Grundschicht deckend, äußere Schalen
//     nur Strähnen → Volumen und aufgelöste Silhouette). Der Haaransatz läuft Strähne für Strähne aus (Schwelle je Strähne),
//     darunter liegt der gemalte Ansatz von face-skin.js → kein harter Rand, kein grauer Streifen.
//   • Frauen: Dutt (Wulst mit umlaufenden Strähnen), Zopf (geflochtene Glieder), schulterlang (Strähnenvorhang in 3 Lagen
//     mit ausgefransten Spitzen). Männer: kurz, Seitenscheitel, Bürste, Haarkranz (Glatze oben); Vollbart/kurzer Bart als
//     Schale über dem Bartbereich, die den Mimik-Zielen des Kopfes folgt (gleiche Morph-Gewichte).
//   • Haar-Atlas: 256² RGBA, prozedural erzeugt (keine Bilddatei): R Helligkeit der Strähne, G Strähnen-Kennung (Schwelle
//     für Ausdünnen/Spitzen), A Strähnenprofil. Ein Sampler; dazu Kajiya-Kay-Glanz (zwei verschobene Glanzlichter entlang
//     der Haarrichtung) im Lichtpfad von three.js.
// Kosten (near): Kappe 2 Schalen ≈ 2 300 Dreiecke, Vorhang/Dutt/Zopf ≈ 1 000–1 600, Bart ≈ 1 500; ein Draw Call je Frisur bzw.
// Bart; Telefon/mittel: nur Grundschicht + eine Schale, gröberes Gitter. Gemeinsames Programm 'np-hair-1'.
import * as THREE from 'three';
import { BONE } from './rig.js?v=20261115041504';

const HC = [0, 1.7, -0.004]; // Kopfmitte (Bindepose)
const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
/** Richtung zu (θ ab Scheitel, a: 0 = vorn (−Z), + = rechte Seite der Figur (+X)). */
const dirOf = (th, a) => [Math.sin(th) * Math.sin(a), Math.cos(th), -Math.sin(th) * Math.cos(a)];
const angOf = (d) => [Math.acos(Math.max(-1, Math.min(1, d[1]))), Math.atan2(d[0], -d[2])];
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
function slerp(a, b, t) {
  const c = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const w = Math.acos(c);
  if (w < 1e-5) return a.slice();
  const s = Math.sin(w), ka = Math.sin((1 - t) * w) / s, kb = Math.sin(t * w) / s;
  return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
}
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ------------------------------------------------------------------ Frisuren */

/** Frisuren: Männer kurz/scheitel/buerste/kranz/glatze, Frauen dutt/zopf/offen. */
export const HAIR_STYLES = Object.freeze(['kurz', 'scheitel', 'buerste', 'kranz', 'glatze', 'dutt', 'zopf', 'offen']);
const MALE_PICK = ['kurz', 'scheitel', 'buerste', 'kurz', 'scheitel'];

/** Frisur zu Aussehen/Profil (ohne ausdrückliche Wahl): Geheimratsecken stark → Haarkranz, sonst nach Samen. */
export function pickHairStyle(look = {}, female = false, seed = 1) {
  if (look.style && HAIR_STYLES.includes(look.style)) return look.style;
  if (female) return ['offen', 'dutt', 'zopf'][Math.abs(seed | 0) % 3];
  if ((look.recede ?? 0.2) >= 0.75) return 'kranz';
  if ((look.hair ?? 1) < 0.2) return 'glatze';
  return MALE_PICK[Math.abs(Math.imul(seed | 0, 2654435761) >>> 7) % MALE_PICK.length];
}

/* ------------------------------------------------------------------ Kopffeld */

const NT = 60, NA = 120; // Kugelraster 3° × 3°
const CY0 = 1.4, CY1 = 1.82, CYS = 0.005, NY = Math.round((CY1 - CY0) / CYS) + 1; // Zylinderraster

/** Felder aus den Haut-/Ohrdreiecken des Kopfnetzes (Positionen der Bindepose, aRest.w = AO + 2 × Teil). */
function headField(geo) {
  const P = geo.attributes.position.array, RS = geo.attributes.aRest.array, I = geo.index.array;
  const partOf = (v) => Math.floor(RS[v * 4 + 3] * 0.5 + 0.01);
  const Rs = new Float32Array(NT * NA); // Kugel: Haut (ohne Ohren)
  const Er = new Float32Array(NT * NA); // Kugel: Ohren
  const Hr = new Float32Array(NY * NA); // Zylinder: Haut + Ohren
  const tri = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  // Strahl o + t·d gegen Dreieck (Möller–Trumbore) → t oder 0
  const hit = (ox, oy, oz, dx, dy, dz) => {
    const [a, b, c] = tri;
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-14) return 0;
    const inv = 1 / det, sx = ox - a[0], sy = oy - a[1], sz = oz - a[2];
    const u = (sx * px + sy * py + sz * pz) * inv;
    if (u < -1e-4 || u > 1.0001) return 0;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < -1e-4 || u + v > 1.0001) return 0;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return t > 0 ? t : 0;
  };
  const wrapA = (a) => { while (a < -Math.PI) a += TAU; while (a >= Math.PI) a -= TAU; return a; };
  for (let t = 0; t < I.length; t += 3) {
    const v0 = I[t], v1 = I[t + 1], v2 = I[t + 2];
    const p0 = partOf(v0), p1 = partOf(v1), p2 = partOf(v2);
    const skin = p0 === 0 && p1 === 0 && p2 === 0, ear = p0 <= 1 && p1 <= 1 && p2 <= 1 && (p0 === 1 || p1 === 1 || p2 === 1);
    if (!skin && !ear) continue;
    const vs = [v0, v1, v2];
    let ymin = 9, ymax = -9;
    const th = [], aa = [];
    for (let k = 0; k < 3; k++) {
      const v = vs[k];
      tri[k][0] = P[v * 3]; tri[k][1] = P[v * 3 + 1]; tri[k][2] = P[v * 3 + 2];
      ymin = Math.min(ymin, tri[k][1]); ymax = Math.max(ymax, tri[k][1]);
      const [th_, a_] = angOf(norm3([tri[k][0] - HC[0], tri[k][1] - HC[1], tri[k][2] - HC[2]]));
      th.push(th_); aa.push(a_);
    }
    // Winkelbereich (Naht hinten bei a = ±π beachten)
    let a0 = Math.min(...aa), a1 = Math.max(...aa);
    if (a1 - a0 > Math.PI) { const sh = aa.map((x) => (x < 0 ? x + TAU : x)); a0 = Math.min(...sh); a1 = Math.max(...sh); }
    const t0 = Math.min(...th), t1 = Math.max(...th);
    const pad = 1.5;
    // Kugelraster
    const it0 = Math.max(0, Math.floor(t0 / Math.PI * NT - pad)), it1 = Math.min(NT - 1, Math.ceil(t1 / Math.PI * NT + pad));
    const ia0 = Math.floor((a0 + Math.PI) / TAU * NA - pad), ia1 = Math.ceil((a1 + Math.PI) / TAU * NA + pad);
    const near = Math.abs(t0) < 0.12; // am Scheitel: alle Richtungen
    for (let it = it0; it <= it1; it++) {
      for (let ia = near ? 0 : ia0; ia <= (near ? NA - 1 : ia1); ia++) {
        const iaw = ((ia % NA) + NA) % NA;
        const d = dirOf((it + 0.5) / NT * Math.PI, ((iaw + 0.5) / NA) * TAU - Math.PI);
        const r = hit(HC[0], HC[1], HC[2], d[0], d[1], d[2]);
        if (r > 0) { const G = skin ? Rs : Er; const k = it * NA + iaw; if (r > G[k]) G[k] = r; }
      }
    }
    // Zylinderraster (waagrecht von der senkrechten Achse durch die Kopfmitte)
    const iy0 = Math.max(0, Math.floor((ymin - CY0) / CYS - 1)), iy1 = Math.min(NY - 1, Math.ceil((ymax - CY0) / CYS + 1));
    let c0 = 9, c1 = -9;
    for (let k = 0; k < 3; k++) { const a_ = Math.atan2(tri[k][0] - HC[0], -(tri[k][2] - HC[2])); c0 = Math.min(c0, a_); c1 = Math.max(c1, a_); }
    if (c1 - c0 > Math.PI) { const sh = tri.map((q) => { const a_ = Math.atan2(q[0] - HC[0], -(q[2] - HC[2])); return a_ < 0 ? a_ + TAU : a_; }); c0 = Math.min(...sh); c1 = Math.max(...sh); }
    const ja0 = Math.floor((c0 + Math.PI) / TAU * NA - pad), ja1 = Math.ceil((c1 + Math.PI) / TAU * NA + pad);
    for (let iy = iy0; iy <= iy1; iy++) {
      const y = CY0 + iy * CYS;
      for (let ia = ja0; ia <= ja1; ia++) {
        const iaw = ((ia % NA) + NA) % NA, a = ((iaw + 0.5) / NA) * TAU - Math.PI;
        const r = hit(HC[0], y, HC[2], Math.sin(a), 0, -Math.cos(a));
        if (r > 0) { const k = iy * NA + iaw; if (r > Hr[k]) Hr[k] = r; }
      }
    }
    void wrapA;
  }
  // Lücken füllen (Mittel der Nachbarn), dann leicht nach außen glätten (Maximum 3 × 3 gemittelt mit dem Wert)
  const fill = (G, nr, nc, wrapR = false) => {
    for (let pass = 0; pass < 40; pass++) {
      let empty = 0;
      const src = G.slice();
      for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
        const k = r * nc + c;
        if (src[k] > 0) continue;
        let s = 0, n = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          let rr = r + dr; const cc = (c + dc + nc) % nc;
          if (rr < 0 || rr >= nr) { if (!wrapR) continue; rr = Math.max(0, Math.min(nr - 1, rr)); }
          const q = src[rr * nc + cc];
          if (q > 0) { s += q; n++; }
        }
        if (n) G[k] = s / n; else empty++;
      }
      if (!empty) break;
    }
  };
  fill(Rs, NT, NA, true);
  fill(Hr, NY, NA);
  const out = Rs.slice();
  for (let r = 0; r < NT; r++) for (let c = 0; c < NA; c++) {
    let m = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = Math.max(0, Math.min(NT - 1, r + dr)), cc = (c + dc + NA) % NA;
      m = Math.max(m, Rs[rr * NA + cc]);
    }
    out[r * NA + c] = (m + Rs[r * NA + c]) * 0.5;
  }
  // Ohr-Oberkante je Richtung a (kleinstes θ eines Ohrtreffers) → Haaransatz bleibt über dem Ohr
  const earTop = new Float32Array(NA).fill(9);
  for (let c = 0; c < NA; c++) for (let r = 0; r < NT; r++) if (Er[r * NA + c] > 0) { earTop[c] = (r / NT) * Math.PI; break; }
  const bil = (G, nr, nc, fr, fc) => {
    fr = Math.max(0, Math.min(nr - 1.001, fr));
    const r0 = Math.floor(fr), tr = fr - r0;
    const c = ((fc % nc) + nc) % nc, c0 = Math.floor(c), tc = c - c0, c1 = (c0 + 1) % nc;
    const r1 = Math.min(nr - 1, r0 + 1);
    return lerp(lerp(G[r0 * nc + c0], G[r0 * nc + c1], tc), lerp(G[r1 * nc + c0], G[r1 * nc + c1], tc), tr);
  };
  return {
    /** Kopfradius in Richtung (θ, a) */
    R: (th, a) => bil(out, NT, NA, th / Math.PI * NT - 0.5, (a + Math.PI) / TAU * NA - 0.5),
    /** waagrechter Abstand der Oberfläche (Haut, Ohren, Hals) in Höhe y, Richtung a */
    H: (y, a) => bil(Hr, NY, NA, (y - CY0) / CYS, (a + Math.PI) / TAU * NA - 0.5),
    /** Ohr-Oberkante (θ) in Richtung a, 9 = kein Ohr */
    ear: (a) => { const c = Math.round((a + Math.PI) / TAU * NA - 0.5); let m = 9; for (let k = -2; k <= 2; k++) m = Math.min(m, earTop[((c + k) % NA + NA) % NA]); return m; },
  };
}

/* ------------------------------------------------------------------ Haaransatz */

// Haaransatz θ(a) [Grad] nach |a| (0 vorn … 180 Nacken), am gemalten Ansatz von face-skin.js abgegriffen (Stirn ≈ Augen + 7 cm,
// über dem Ohr ≈ Augenhöhe, Nacken ≈ Augen − 7 cm); Koteletten vor dem Ohr tiefer
const LINE_A = [0, 20, 35, 48, 58, 66, 72, 80, 92, 110, 135, 160, 180];
// mensch4: Stirnansatz tiefer (48° → 56°: die Kappe endete hoch über einem kahlen Hautband und vergrößerte die Stirn), Schläfenecke weicher
const LINE_T = [56, 57, 59, 64, 70, 81, 86, 80, 78, 90, 117, 129, 133];
function hairline(a, recede = 0, female = false) {
  const x = Math.abs(a) / D2R;
  let th = LINE_T[LINE_T.length - 1];
  for (let i = 1; i < LINE_A.length; i++) if (x <= LINE_A[i]) { const t = (x - LINE_A[i - 1]) / (LINE_A[i] - LINE_A[i - 1]); th = lerp(LINE_T[i - 1], LINE_T[i], t * t * (3 - 2 * t)); break; }
  // Geheimratsecken (Schläfen) bzw. weiblicher, runderer Ansatz ohne Koteletten
  th -= recede * 10 * Math.exp(-(((x - 42) / 14) ** 2));
  if (female) th = th - 5 * Math.exp(-(((x - 70) / 9) ** 2)) - 2 * Math.exp(-(((x - 40) / 16) ** 2));
  return th * D2R;
}

/* ------------------------------------------------------------------ Geometrie-Sammler */

class HairBuf {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.tan = []; this.lay = []; this.idx = []; }
  get n() { return this.pos.length / 3; }
  /**
   * Gitter (Zeilen j = 0…rows entlang der Strähne, Spalten i = 0…cols quer): P(i, j) → [x,y,z]; uvAt(i, j) → [u, v];
   * fade(i, j) → 0…1 (Strähnen dünnen aus), layer: [Tiefe 0 innen … 1 außen, Deckung]. closed: Spalten ringförmig.
   */
  grid(cols, rows, P, uvAt, fade, layer, { closed = false, flip = false } = {}) {
    const base = this.n, nc = cols + 1;
    const pts = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) pts.push(P(closed && i === cols ? 0 : i, j));
    const at = (i, j) => pts[Math.max(0, Math.min(rows, j)) * nc + (closed ? ((i % cols) + cols) % cols : Math.max(0, Math.min(cols, i)))];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const p = at(i, j);
      this.pos.push(p[0], p[1], p[2]);
      // Strähnenrichtung (entlang j) und Normale (Kreuzprodukt quer × längs)
      const a = at(i, j - 1), b = at(i, j + 1);
      let tg = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      if (Math.hypot(...tg) < 1e-7) { const c = at(i, j + 2); tg = [c[0] - p[0], c[1] - p[1], c[2] - p[2]]; }
      tg = norm3(tg);
      const l = at(i - 1, j), r = at(i + 1, j);
      let sd = [r[0] - l[0], r[1] - l[1], r[2] - l[2]];
      let nn = norm3([sd[1] * tg[2] - sd[2] * tg[1], sd[2] * tg[0] - sd[0] * tg[2], sd[0] * tg[1] - sd[1] * tg[0]]);
      if (flip) nn = [-nn[0], -nn[1], -nn[2]];
      if (!Number.isFinite(nn[0]) || Math.hypot(...nn) < 0.5) nn = norm3([p[0] - HC[0], p[1] - HC[1], p[2] - HC[2]]);
      this.nrm.push(nn[0], nn[1], nn[2]);
      this.tan.push(tg[0], tg[1], tg[2], sat(fade(i, j)));
      const t = uvAt(i, j);
      this.uv.push(t[0], t[1]);
      this.lay.push(j / rows, layer[1], layer[0]);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = base + j * nc + i, b = a + 1, c = a + nc, d = c + 1;
      if (flip) this.idx.push(a, b, c, b, d, c); else this.idx.push(a, c, b, b, c, d);
    }
  }
  /** Normalen nach außen (vom Kopf weg) ausrichten – Gitter mit unbekannter Laufrichtung */
  orientFrom(start, center) {
    for (let v = start; v < this.n; v++) {
      const dx = this.pos[v * 3] - center[0], dy = this.pos[v * 3 + 1] - center[1], dz = this.pos[v * 3 + 2] - center[2];
      if (dx * this.nrm[v * 3] + dy * this.nrm[v * 3 + 1] + dz * this.nrm[v * 3 + 2] < 0) for (let k = 0; k < 3; k++) this.nrm[v * 3 + k] *= -1;
    }
  }
  geometry(boneIdx) {
    const n = this.n;
    // Umlaufsinn je Dreieck an die (nach außen gerichteten) Normalen anpassen → Vorderseite = Außenseite (gl_FrontFacing)
    const P = this.pos, Nn = this.nrm, I = this.idx;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      const d = cx * (Nn[a] + Nn[b] + Nn[c]) + cy * (Nn[a + 1] + Nn[b + 1] + Nn[c + 1]) + cz * (Nn[a + 2] + Nn[b + 2] + Nn[c + 2]);
      if (d < 0) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aHair', new THREE.Float32BufferAttribute(this.tan, 4));
    g.setAttribute('aHairL', new THREE.Float32BufferAttribute(this.lay, 3));
    const si = new Uint8Array(n * 4), sw = new Uint8Array(n * 4);
    for (let v = 0; v < n; v++) { si[v * 4] = boneIdx; sw[v * 4] = 255; }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.userData.triangles = this.idx.length / 3;
    return g;
  }
}

/* ------------------------------------------------------------------ Frisur bauen */

// Auflösung je Kopfstufe: Spalten um den Kopf, Zeilen Wirbel→Ansatz, Schalen (inkl. Grundschicht)
const RES = { cine: { cols: 72, rows: 18, shells: 3, cur: [40, 12], lobe: [10, 7], beard: 3 }, near: { cols: 40, rows: 10, shells: 2, cur: [24, 7], lobe: [8, 5], beard: 1 }, mid: { cols: 28, rows: 7, shells: 2, cur: [14, 5], lobe: [6, 4], beard: 1 } };
// Dicke der Haarschicht [m]: oben (t = 0) … am Ansatz (t = 1), je Frisur
const THICK = {
  kurz: [0.012, 0.0065, 0.0018], scheitel: [0.017, 0.01, 0.002], buerste: [0.0042, 0.0034, 0.0014], kranz: [0.005, 0.004, 0.0016],
  dutt: [0.0065, 0.005, 0.0016], zopf: [0.0065, 0.005, 0.0016], offen: [0.013, 0.009, 0.0022],
};

const hairGeoCache = new Map();

/**
 * Frisur-Geometrie (gecacht je Kopfnetz × Frisur × Stufe) am Kopfknochen. geo: Kopfnetz aus face.js (Bindepose);
 * opts: { recede, female, seed }. → BufferGeometry | null
 */
export function hairGeometry(geo, style, res = 'near', opts = {}) {
  if (!geo || !style || style === 'glatze') return null;
  const key = `${geo.userData.key || geo.uuid}|${style}|${res}|${(opts.recede ?? 0).toFixed(2)}|${opts.seed | 0}`;
  if (hairGeoCache.has(key)) return hairGeoCache.get(key);
  const F = geo.userData.hairField || (geo.userData.hairField = headField(geo));
  const Q = RES[res] || RES.near;
  const female = !!opts.female;
  const recede = female ? 0 : opts.recede ?? 0.2;
  const T = THICK[style] || THICK.kurz;
  const B = new HairBuf();
  const rnd = rng((opts.seed | 0) * 7919 + style.length * 131);
  // Haaransatz-Richtung je Spalte (über dem Ohr gekappt)
  const lineAt = (a) => {
    // leicht unregelmäßiger Ansatz (kein Topfschnitt-Rand)
    let th = hairline(a, recede, female) + (Math.sin(a * 23 + 1.3) * 0.6 + Math.sin(a * 41) * 0.4) * 1.6 * D2R;
    const e = F.ear(a);
    if (e < 8) th = Math.min(th, e - 5 * D2R);
    return th;
  };
  // Wirbel/Ansatzpunkt der Strähnen
  let pole = dirOf(0.2, Math.PI * 0.85); // Wirbel hinten oben
  if (style === 'scheitel') pole = dirOf(32 * D2R, 0.95 * (opts.seed % 2 ? 1 : -1)); // Seitenscheitel vorn-seitlich
  if (style === 'dutt') pole = dirOf(100 * D2R, Math.PI);
  if (style === 'zopf') pole = dirOf(116 * D2R, Math.PI);
  if (style === 'offen') pole = dirOf(18 * D2R, 0.5 * (opts.seed % 2 ? 1 : -1)); // Scheitel leicht seitlich
  const crownHole = style === 'kranz'; // Haarkranz: oben kahl
  const thick = (t, a) => {
    // mensch4: zum Ansatz hin flach auslaufen (vorher ≈ 3 mm dicke Kante kurz vor dem Ansatz → sichtbare Stufe, Stirn wirkte höher)
    let d = t < 0.5 ? lerp(T[0], T[1], t / 0.5) : lerp(T[1], T[2] * 0.35, sstep(0.5, 0.9, t));
    if (style === 'scheitel') d += 0.004 * Math.exp(-(a * a) / 0.25) * sstep(0.4, 0.8, t) * (1 - sstep(0.88, 1, t)); // Tolle vorn
    if (style === 'offen') d += 0.004 * sstep(0.5, 0.95, Math.abs(a) / Math.PI);
    return d;
  };
  const surf = (d, extra) => { const [th, a] = angOf(d); const r = F.R(th, a) + extra; return [HC[0] + d[0] * r, HC[1] + d[1] * r, HC[2] + d[2] * r]; };
  // Kappe: Spalte i = Richtung entlang des Haaransatzes; Zeile j = Wirbel (bzw. Kranz-Innenrand) → Ansatz
  const cols = Q.cols, rows = Q.rows;
  const edge = [], inner = [];
  for (let i = 0; i < cols; i++) {
    const a = -Math.PI + (i / cols) * TAU;
    edge.push(dirOf(lineAt(a), a));
    // Haarkranz: Band über Ohren/Hinterkopf, vorn kahl (Innenrand = Ansatz → Streifen ohne Fläche, ausgeblendet)
    inner.push(crownHole ? dirOf(lineAt(a) - 36 * D2R * sstep(50 * D2R, 105 * D2R, Math.abs(a)), a) : pole);
  }
  // Kappe über den Ansatz hinaus ein wenig verlängern (ausdünnende Strähnen auf dem gemalten Ansatz)
  const OVER = 0.12; // mensch4: weiter über den gemalten Ansatz auslaufen (vorher 0,07 → harte Kante)
  const dAt = (i, j) => slerp(inner[i], edge[i], (j / rows) * (1 + OVER));
  const lenTile = 0.045, tilesU = female || style === 'offen' ? 9 : 8;
  for (let s = 0; s < Q.shells; s++) {
    const depth = Q.shells > 1 ? s / (Q.shells - 1) : 0;
    const cover = s === 0 ? 1 : lerp(0.66, 0.4, (s - 1) / Math.max(1, Q.shells - 2));
    const off = (t, a) => lerp(0.35, 1.0, depth) * thick(t, a) + 0.0006;
    B.grid(cols, rows,
      (i, j) => { const d = dAt(i, j); const a = angOf(d)[1]; return surf(d, off(j / rows, a)); },
      (i, j) => [(i / cols) * tilesU + s * 0.37, (j / rows) * (0.16 / lenTile) + s * 0.21],
      (i, j) => {
        const t = (j / rows) * (1 + OVER);
        // Ausdünnen am Ansatz (Strähne für Strähne) und am Kranz-Innenrand
        let f = 1 - sstep(0.7, 1 + OVER * 0.95, t);
        if (crownHole) f *= sstep(0.0, 0.25, t) * sstep(55 * D2R, 85 * D2R, Math.abs(-Math.PI + (i / cols) * TAU));
        return f;
      },
      [depth, cover], { closed: true });
    B.orientFrom(B.n - (cols + 1) * (rows + 1), HC);
  }
  // Frauen: Dutt, Zopf, Vorhang
  if (style === 'dutt') addBun(B, F, pole, Q, rnd);
  else if (style === 'zopf') addBraid(B, F, pole, Q, rnd);
  else if (style === 'offen') addCurtain(B, F, lineAt, thick, Q, rnd);
  const g = B.geometry(BONE.head);
  g.name = 'frisur:' + style + ':' + res;
  hairGeoCache.set(key, g);
  return g;
}

/** Dutt: Wulst (Torus) um die Achse vom Kopf weg, Strähnen laufen um den Wulst; Mitte gefüllt. */
function addBun(B, F, pole, Q, rnd) {
  void rnd;
  const [th0, a0] = angOf(pole);
  const r0 = F.R(th0, a0) + 0.004;
  const ax = pole, c = [HC[0] + ax[0] * (r0 + 0.019), HC[1] + ax[1] * (r0 + 0.019), HC[2] + ax[2] * (r0 + 0.019)];
  // Basis senkrecht zur Achse
  let e1 = norm3([ax[1] * 0 - ax[2] * 1, ax[2] * 0 - ax[0] * 0, ax[0] * 1 - ax[1] * 0]); // ax × (0,1,0)… ersatzweise
  if (!Number.isFinite(e1[0]) || Math.hypot(...e1) < 0.5) e1 = [1, 0, 0];
  const e2 = norm3([ax[1] * e1[2] - ax[2] * e1[1], ax[2] * e1[0] - ax[0] * e1[2], ax[0] * e1[1] - ax[1] * e1[0]]);
  const Rm = 0.017, rt = 0.0175, cols = Q.lobe[0] * 2, rows = Q.lobe[1] * 2;
  for (const [sh, cover, depth] of [[0, 1, 0], [0.0025, 0.6, 1]]) {
    // Strähnen laufen entlang des großen Kreises (j), quer dazu (i) um das Rohr
    B.grid(cols, rows * 2, (i, j) => {
      const u = (i / cols) * TAU, v = (j / (rows * 2)) * TAU;
      const rr = Rm + (rt + sh) * Math.cos(u) * (1 + 0.06 * Math.sin(v * 3 + u));
      const h = (rt + sh) * Math.sin(u) * 0.95;
      return [c[0] + (e1[0] * Math.cos(v) + e2[0] * Math.sin(v)) * rr + ax[0] * h, c[1] + (e1[1] * Math.cos(v) + e2[1] * Math.sin(v)) * rr + ax[1] * h, c[2] + (e1[2] * Math.cos(v) + e2[2] * Math.sin(v)) * rr + ax[2] * h];
    }, (i, j) => [i / cols * 2.2, j / (rows * 2) * 3.4], () => 1, [depth, cover], { closed: true });
    B.orientFrom(B.n - (cols + 1) * (rows * 2 + 1), c);
  }
  // Mitte (Deckel) als flache Kuppel
  const cols2 = Q.lobe[0] * 2, rows2 = 3;
  B.grid(cols2, rows2, (i, j) => {
    const v = (i / cols2) * TAU, t = j / rows2, rr = Rm * (1 - t) + 0.0001;
    const h = rt * 0.8 + 0.008 * Math.sqrt(Math.max(0, 1 - t * t));
    return [c[0] + (e1[0] * Math.cos(v) + e2[0] * Math.sin(v)) * rr + ax[0] * h, c[1] + (e1[1] * Math.cos(v) + e2[1] * Math.sin(v)) * rr + ax[1] * h, c[2] + (e1[2] * Math.cos(v) + e2[2] * Math.sin(v)) * rr + ax[2] * h];
  }, (i, j) => [i / cols2 * 3, j / rows2 * 0.6], () => 1, [0, 1], { closed: true });
  B.orientFrom(B.n - (cols2 + 1) * (rows2 + 1), HC);
}

/** Zopf: geflochtene Glieder (zwei gegeneinander geneigte Ellipsoide je Glied) vom Nacken über den oberen Rücken. */
function addBraid(B, F, pole, Q, rnd) {
  const [th0, a0] = angOf(pole);
  const r0 = F.R(th0, a0) + 0.006;
  const p0 = [HC[0] + pole[0] * r0, HC[1] + pole[1] * r0, HC[2] + pole[2] * r0];
  // Pfad: am Hinterkopf hinab, dann über Nacken/Kragen (Rücken der Zivilistin z ≈ 0,09 in Höhe 1,44–1,48 m + Mantel)
  const path = [];
  const N = 9;
  for (let k = 0; k <= N; k++) {
    const t = k / N, y = p0[1] - 0.006 - t * (p0[1] - 1.425);
    let z = Math.max(p0[2] + 0.004 * t, F.H(Math.max(CY0, y), Math.PI) + HC[2] + 0.016 - 0.003 * t);
    if (y < 1.53) z = Math.max(z, 0.117 + (1.53 - y) * 0.12);
    path.push([0.002 * Math.sin(k * 1.3), y, z]);
  }
  const cols = Q.lobe[0], rows = Q.lobe[1];
  const lobe = (c, axis, side, rad, len, depth, cover) => {
    // Ellipsoid entlang axis, quer side; Strähnen längs
    const nrmA = norm3([axis[1] * side[2] - axis[2] * side[1], axis[2] * side[0] - axis[0] * side[2], axis[0] * side[1] - axis[1] * side[0]]);
    B.grid(cols, rows, (i, j) => {
      const u = (i / cols) * TAU, v = -1 + (2 * j) / rows, w = Math.sqrt(Math.max(0, 1 - v * v)) + 0.0001;
      const x = Math.cos(u) * rad * w, z = Math.sin(u) * rad * 0.8 * w, l = v * len;
      return [c[0] + side[0] * x + nrmA[0] * z + axis[0] * l, c[1] + side[1] * x + nrmA[1] * z + axis[1] * l, c[2] + side[2] * x + nrmA[2] * z + axis[2] * l];
    }, (i, j) => [i / cols * 1.4 + rnd(), j / rows * 0.9], (i, j) => 1 - 0.5 * Math.abs(-1 + 2 * j / rows) ** 6, [depth, cover], { closed: true });
    B.orientFrom(B.n - (cols + 1) * (rows + 1), c);
  };
  for (let k = 0; k < N; k++) {
    const a = path[k], b = path[k + 1];
    const ax = norm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const side0 = norm3([1, 0, 0]);
    const taper = 1 - 0.38 * (k / N);
    for (const s of [-1, 1]) {
      const tilt = 0.55 * s * (k % 2 ? 1 : -1);
      const ca = Math.cos(tilt), sa = Math.sin(tilt);
      const axis = norm3([ax[0] * ca + side0[0] * sa, ax[1] * ca + side0[1] * sa, ax[2] * ca + side0[2] * sa]);
      const side = norm3([side0[0] * ca - ax[0] * sa, side0[1] * ca - ax[1] * sa, side0[2] * ca - ax[2] * sa]);
      const c = [(a[0] + b[0]) / 2 + s * 0.0065 * taper, (a[1] + b[1]) / 2 + (k % 2 ? 0.003 : -0.003) * s, (a[2] + b[2]) / 2];
      lobe(c, axis, side, 0.0135 * taper, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 0.72, 0.5, 1);
    }
  }
  // Ansatz am Hinterkopf (gebündelt) und Haargummi + Spitze
  lobe([p0[0], p0[1] - 0.006, p0[2] + 0.004], norm3([0, -1, 0.25]), [1, 0, 0], 0.017, 0.016, 0.3, 1);
  const e = path[N];
  const tip = [e[0], e[1] - 0.026, e[2] + 0.004];
  const cols2 = Q.lobe[0] * 2, rows2 = Q.lobe[1];
  B.grid(cols2, rows2, (i, j) => {
    const u = (i / cols2) * TAU, t = j / rows2, rad = 0.0075 * (1 - t) + 0.0045 * Math.sin(t * Math.PI) + 0.0006;
    return [e[0] + Math.cos(u) * rad, e[1] - 0.004 - t * 0.032, e[2] + Math.sin(u) * rad * 0.8 + 0.003 * t];
  }, (i, j) => [i / cols2 * 2, j / rows2 * 0.8], (i, j) => 1 - sstep(0.45, 1, j / rows2), [1, 1], { closed: true });
  B.orientFrom(B.n - (cols2 + 1) * (rows2 + 1), [e[0], e[1] - 0.02, e[2]]);
  void tip;
}

/** Schulterlanges Haar: Vorhang aus 3 Lagen (seitlich ab der Schläfe, hinten bis zum Nacken), Spitzen ausgefranst. */
function addCurtain(B, F, lineAt, thick, Q, rnd) {
  const [cols, rows] = Q.cur;
  const aFrom = 64 * D2R, aTo = TAU - 64 * D2R; // rechts vorn → hinten → links vorn
  const yEnd = 1.495;
  for (const [L, cover, depth] of [[0, 1, 0], [1, 0.7, 0.55], [2, 0.42, 1]]) {
    const lift = L * 0.0028;
    B.grid(cols, rows, (i, j) => {
      const a = aFrom + (aTo - aFrom) * (i / cols), aw = a > Math.PI ? a - TAU : a;
      // oberste Zeile auf der Kappe (über dem Ansatz), dann senkrecht hinab
      const thTop = lineAt(aw) - 16 * D2R;
      const d = dirOf(thTop, aw);
      const r0 = F.R(thTop, aw) + thick(0.7, aw) + 0.0012 + lift;
      const top = [HC[0] + d[0] * r0, HC[1] + d[1] * r0, HC[2] + d[2] * r0];
      const hTop = Math.hypot(top[0] - HC[0], top[2] - HC[2]);
      const front = sstep(110 * D2R, 66 * D2R, Math.abs(aw)); // vordere Strähnen etwas kürzer, liegen an
      const yb = yEnd + 0.03 * front + (rnd() - 0.5) * 0.004;
      const t = j / rows, y = lerp(top[1], yb, t);
      let h = hTop;
      // nicht in Kopf/Ohren/Hals (Abstand zur Oberfläche ≥ Dicke) – Strähnen fallen außen herab
      const surfH = F.H(Math.min(CY1, Math.max(CY0, y)), aw);
      h = Math.max(h * (1 - 0.15 * t), surfH + 0.007 + lift);
      h += 0.012 * t * t * (1 - 0.6 * front) + 0.003 * Math.sin(i * 1.7 + L) * t;
      return [HC[0] + Math.sin(aw) * h, y, HC[2] - Math.cos(aw) * h];
    }, (i, j) => [(i / cols) * 7 + L * 0.31, (j / rows) * (0.26 / 0.045) + L * 0.17], (i, j) => 1 - sstep(0.62, 1.0, j / rows) * (0.75 + 0.25 * Math.sin(i * 2.3)), [depth, cover]);
    B.orientFrom(B.n - (cols + 1) * (rows + 1), [HC[0], 1.6, HC[2]]);
  }
}

/* ------------------------------------------------------------------ Bart */

/**
 * Bart als Schale über dem Bartbereich des Kopfnetzes (Teilmenge der Ecken mit ihren Mimik-Zielen → bewegt sich mit Kiefer und
 * Lippen). beard: 'voll' (≈ 7 mm) | 'kurz' (≈ 3,5 mm). land: Landmarken (Mundspalt, Mundwinkel, Nasenspitze). → Geometrie | null
 */
export function beardGeometry(geo, beard, res = 'near', land = {}) {
  if (!geo || (beard !== 'voll' && beard !== 'kurz')) return null;
  const key = `${geo.userData.key || geo.uuid}|bart:${beard}|${res}`;
  if (hairGeoCache.has(key)) return hairGeoCache.get(key);
  const len = beard === 'voll' ? 0.0045 : 0.0026;
  const P = geo.attributes.position.array, Nn = geo.attributes.normal.array, RS = geo.attributes.aRest.array, I = geo.index.array;
  const nV = P.length / 3;
  const slitY = land.slitY ?? 1.6216, cornerX = land.cornerX ?? 0.0243, noseY = (land.noseTip && land.noseTip[1]) ?? 1.6504, ey = (land.eyeL && land.eyeL[1]) ?? 1.689, tmjZ = (land.tmj && land.tmj[2]) ?? 0.0215;
  // Bartmaske je Ecke (wie face-skin.js, ohne Rauschen): Wangenlinie bis Hals, Oberlippe; Lippen/Mundraum frei
  const mask = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const part = Math.floor(RS[v * 4 + 3] * 0.5 + 0.01);
    if (part !== 0) continue;
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], ax = Math.abs(x);
    if (z > tmjZ + 0.012) continue;
    const cl = lerp(slitY + 0.019, ey - 0.027, sstep(0.026, 0.068, ax));
    const must = ax < cornerX + 0.006 ? noseY - 0.011 + 0.004 * sstep(0.008, 0.02, ax) : -9;
    const top = Math.max(cl, Math.min(must, noseY - 0.008));
    const bot = slitY - 0.062 + 0.022 * sstep(0.02, 0.06, ax);
    let m = sstep(0.006, -0.012, y - top) * sstep(-0.016, 0.004, y - bot);
    // Lippen frei (Ellipse um den Mund)
    const lip = Math.exp(-(((x) / (cornerX + 0.002)) ** 6 + ((y - slitY) / 0.0085) ** 2)) * sstep(-0.07, -0.09, z);
    m *= 1 - sat(lip * 3);
    // Hals: Bart endet unter dem Kinn
    m *= sstep(-0.035, -0.06, z) + sstep(slitY - 0.05, slitY - 0.035, y) * (1 - sstep(-0.035, -0.06, z));
    mask[v] = m;
  }
  const sel = new Int32Array(nV).fill(-1), list = [];
  const keepTri = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (Math.max(mask[a], mask[b], mask[c]) < 0.05) continue;
    keepTri.push(a, b, c);
    for (const v of [a, b, c]) if (sel[v] < 0) { sel[v] = list.length; list.push(v); }
  }
  if (!keepTri.length) return null;
  const shells = (RES[res] || RES.near).beard;
  const n = list.length;
  const pos = new Float32Array(n * 3 * shells), nrm = new Float32Array(n * 3 * shells), uv = new Float32Array(n * 2 * shells);
  const tan = new Float32Array(n * 4 * shells), lay = new Float32Array(n * 3 * shells);
  const idx = [];
  const M = geo.morphAttributes.position || [], MN = geo.morphAttributes.normal || [];
  const mpos = M.map(() => new Float32Array(n * 3 * shells)), mnrm = MN.map(() => new Float32Array(n * 3 * shells));
  for (let s = 0; s < shells; s++) {
    const depth = shells > 1 ? s / (shells - 1) : 0.65;
    // Bart: keine deckende Grundschicht – nur Strähnen (darunter der gemalte Bart/Bartschatten von face-skin.js)
    const cover = lerp(0.78, 0.45, shells > 1 ? s / (shells - 1) : 0);
    for (let k = 0; k < n; k++) {
      const v = list[k], o = s * n + k;
      const m = mask[v];
      const off = 0.0005 + len * lerp(0.3, 1.0, depth) * sstep(0.0, 0.6, m) * (0.7 + 0.3 * sstep(slitY - 0.02, slitY - 0.05, P[v * 3 + 1]));
      for (let q = 0; q < 3; q++) { pos[o * 3 + q] = P[v * 3 + q] + Nn[v * 3 + q] * off; nrm[o * 3 + q] = Nn[v * 3 + q]; }
      // Wuchsrichtung: abwärts, an den Wangen schräg nach hinten-unten; auf die Fläche projiziert
      const nx = Nn[v * 3], ny = Nn[v * 3 + 1], nz = Nn[v * 3 + 2];
      let g = [P[v * 3] * 0.6, -1, 0.15];
      const dn = g[0] * nx + g[1] * ny + g[2] * nz;
      g = norm3([g[0] - nx * dn, g[1] - ny * dn, g[2] - nz * dn]);
      tan[o * 4] = g[0]; tan[o * 4 + 1] = g[1]; tan[o * 4 + 2] = g[2]; tan[o * 4 + 3] = sstep(0.02, 0.95, m) * (0.75 + 0.25 * sat(m));
      // UV: Zylinderabwicklung (Strähnen senkrecht im Atlas)
      uv[o * 2] = Math.atan2(P[v * 3], -P[v * 3 + 2]) * 0.08 / 0.012 + s * 0.37;
      uv[o * 2 + 1] = P[v * 3 + 1] / 0.009 + s * 0.23;
      lay[o * 3] = 0.6; lay[o * 3 + 1] = cover; lay[o * 3 + 2] = depth;
      for (let mi = 0; mi < M.length; mi++) for (let q = 0; q < 3; q++) mpos[mi][o * 3 + q] = M[mi].array[v * 3 + q];
      for (let mi = 0; mi < MN.length; mi++) for (let q = 0; q < 3; q++) mnrm[mi][o * 3 + q] = MN[mi].array[v * 3 + q];
    }
    for (let t = 0; t < keepTri.length; t++) idx.push(s * n + sel[keepTri[t]]); // Umlauf wie der Kopf (außen = vorn)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aHair', new THREE.BufferAttribute(tan, 4));
  g.setAttribute('aHairL', new THREE.BufferAttribute(lay, 3));
  // Häutung wie der Kopf (Kopf/Hals)
  const SI = geo.attributes.skinIndex.array, SW = geo.attributes.skinWeight.array;
  const si = new Uint8Array(n * 4 * shells), sw = new Uint8Array(n * 4 * shells);
  for (let s = 0; s < shells; s++) for (let k = 0; k < n; k++) for (let q = 0; q < 4; q++) { si[(s * n + k) * 4 + q] = SI[list[k] * 4 + q]; sw[(s * n + k) * 4 + q] = SW[list[k] * 4 + q]; }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
  g.setIndex(n * shells > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.morphAttributes.position = mpos.map((a) => new THREE.BufferAttribute(a, 3));
  g.morphAttributes.normal = mnrm.map((a) => new THREE.BufferAttribute(a, 3));
  g.morphTargetsRelative = true;
  g.computeBoundingSphere();
  g.userData.triangles = idx.length / 3;
  g.name = 'bart:' + beard + ':' + res;
  hairGeoCache.set(key, g);
  return g;
}

/* ------------------------------------------------------------------ Haar-Atlas */

let atlas = null;
/** Strähnen-Atlas 256² (kachelbar): R Helligkeit, G Strähnen-Kennung, A Strähnenprofil. Prozedural, linear. */
export function hairAtlas() {
  if (atlas) return atlas;
  const N = 256, R = new Float32Array(N * N).fill(0.42), G = new Float32Array(N * N), A = new Float32Array(N * N);
  const own = new Float32Array(N * N);
  const r = rng(4711);
  for (let i = 0; i < N * N; i++) G[i] = 0.5 + 0.5 * r();
  const nS = 230;
  for (let s = 0; s < nS; s++) {
    const x0 = r() * N, w = 0.9 + r() * 1.5, br = 0.55 + r() * 0.6, id = r() * 0.999;
    const amp = r() * 2.2, k = 1 + Math.floor(r() * 2), ph = r() * TAU, k2 = 3 + Math.floor(r() * 3), ph2 = r() * TAU;
    // Strähne läuft über die ganze Kachelhöhe (kachelbar), leicht gewellt; Helligkeit schwankt entlang
    for (let y = 0; y < N; y++) {
      const v = y / N;
      const xc = x0 + amp * Math.sin(TAU * k * v + ph) + 0.6 * Math.sin(TAU * k2 * v + ph2);
      const shade = br * (0.86 + 0.14 * Math.sin(TAU * k2 * v + ph));
      for (let x = Math.floor(xc - w - 1); x <= Math.ceil(xc + w + 1); x++) {
        const d = Math.abs(x + 0.5 - xc), p = sat(1 - d / w);
        if (p <= 0) continue;
        const xi = ((x % N) + N) % N, o = y * N + xi;
        const pp = p * p * (3 - 2 * p);
        if (pp > own[o]) { own[o] = pp; G[o] = id; R[o] = lerp(R[o], shade, 0.35 + 0.65 * pp); }
        A[o] = Math.max(A[o], pp);
      }
    }
  }
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    data[i * 4] = Math.round(sat(R[i] / 1.2) * 255);
    data[i * 4 + 1] = Math.round(sat(G[i]) * 255);
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = Math.round(sat(A[i]) * 255);
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  t.name = 'haar-atlas';
  atlas = t;
  return t;
}

/* ------------------------------------------------------------------ Material */

const HAIR_SPEC = /* glsl */`vec3 irradiance = dotNL * directLight.color;
	#ifdef NP_HAIR
	{
		// Kajiya-Kay: Glanz entlang der Haarrichtung, Hauptlicht zur Wurzel verschoben (weißlich), Nebenlicht zur Spitze (getönt)
		vec3 npHv = normalize( directLight.direction + geometryViewDir );
		vec3 npT1 = normalize( npHairT - geometryNormal * 0.12 );
		vec3 npT2 = normalize( npHairT + geometryNormal * 0.18 );
		float npC1 = dot( npT1, npHv ), npC2 = dot( npT2, npHv );
		float npS1 = pow( max( 1.0 - npC1 * npC1, 0.0 ), 90.0 );
		float npS2 = pow( max( 1.0 - npC2 * npC2, 0.0 ), 24.0 );
		float npW = saturate( dot( geometryNormal, directLight.direction ) * 0.6 + 0.4 );
		reflectedLight.directSpecular += directLight.color * npW * npHairSpec * ( npS1 * 0.05 + npS2 * 0.07 * ( material.diffuseColor / max( max( material.diffuseColor.r, material.diffuseColor.g ), 1e-3 ) ) );
		// Haare streuen Licht durch (weiche Schattengrenze)
		reflectedLight.directDiffuse += directLight.color * saturate( dot( geometryNormal, directLight.direction ) * 0.5 + 0.5 ) * 0.18 * BRDF_Lambert( material.diffuseColor ) * npHairSpec;
	}
	#endif`;

/**
 * Haarmaterial (je Soldat ein Exemplar: Farbe, Auflösen über die Körper-Uniforms). shared: npU des Körpermaterials.
 */
export function hairMaterial({ low = false, shared = null, color = '#2a2119' } = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, envMapIntensity: 0.35, side: THREE.DoubleSide });
  m.name = 'soldat:haar';
  const S = shared || {};
  const U = (m.userData.hairU = {
    uHairTex: { value: hairAtlas() },
    uHairCol: { value: new THREE.Color(color) },
    uHairSpecAmt: { value: 1 },
    uDissolve: S.uDissolve || { value: 0 },
  });
  m.defines = { NP_HAIR: '' };
  if (low) m.defines.NP_LOW = '';
  m.onBeforeCompile = (shader) => {
    for (const k of Object.keys(U)) shader.uniforms[k] = U[k];
    shader.vertexShader = `attribute vec4 aHair;
attribute vec3 aHairL;
varying vec3 vHairT;
varying float vHairF;
varying vec3 vHairL;
varying vec2 vHairUv;
varying vec3 vHairP;
` + shader.vertexShader.replace('#include <skinning_vertex>', `#include <skinning_vertex>
	{
		vec3 npT = aHair.xyz;
		#ifdef USE_SKINNING
			npT = ( skinMatrix * vec4( npT, 0.0 ) ).xyz;
		#endif
		vHairT = normalize( ( modelViewMatrix * vec4( npT, 0.0 ) ).xyz );
		vHairF = aHair.w;
		vHairL = aHairL;
		vHairUv = uv;
		vHairP = position;
	}`);
    let fs = `varying vec3 vHairT;
varying float vHairF;
varying vec3 vHairL;
varying vec2 vHairUv;
varying vec3 vHairP;
uniform sampler2D uHairTex;
uniform vec3 uHairCol;
uniform float uHairSpecAmt;
uniform float uDissolve;
vec3 npHairT = vec3( 0.0, 1.0, 0.0 );
float npHairSpec = 1.0;
` + shader.fragmentShader;
    fs = fs.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace('vec3 irradiance = dotNL * directLight.color;', HAIR_SPEC));
    fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
	vec4 npHx = texture2D( uHairTex, vHairUv );
	{
		// Grundschicht deckend (außer am Ansatz/an den Spitzen: Strähne für Strähne), äußere Schalen nur Strähnen
		float npKeep = vHairL.y > 0.99 ? step( npHx.g, vHairF * 1.02 - 0.01 ) : step( 0.45, npHx.a ) * step( npHx.g, vHairL.y * vHairF );
		if ( npKeep < 0.5 ) discard;
		if ( uDissolve > 0.0 ) {
			vec3 dq = floor( ( vHairP ) * 34.0 );
			float sdDis = fract( sin( dot( dq, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ) * 0.85 + fract( vHairP.y * 1.7 ) * 0.15;
			if ( sdDis < uDissolve ) discard;
		}
	}`);
    fs = fs.replace('#include <color_fragment>', `
	{
		// Strähnenhelligkeit, innen (Tiefe) und zur Wurzel dunkler (Selbstverschattung), Spitzen etwas heller
		float npB = 0.45 + 1.0 * npHx.r;
		float npAo = mix( 0.5, 1.0, vHairL.z ) * mix( 0.88, 1.04, vHairL.x );
		diffuseColor.rgb *= uHairCol * npB * npAo * ( gl_FrontFacing ? 1.0 : 0.4 ); // Innenseite der Kappe/Strähnen verschattet
		npHairSpec = uHairSpecAmt * mix( 0.45, 1.0, vHairL.z ) * ( 0.6 + 0.6 * npHx.r );
	}`);
    fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
	npHairT = normalize( vHairT - normal * dot( vHairT, normal ) );`);
    fs = fs.replace('#include <aomap_fragment>', `#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= mix( 0.55, 1.0, vHairL.z );
	reflectedLight.indirectSpecular *= 0.5 * mix( 0.4, 1.0, vHairL.z );`);
    shader.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'np-hair-1' + (low ? 'l' : 'h');
  return m;
}

/** Caches leeren (Verlassen des Spiels). */
export function disposeHair() {
  for (const g of hairGeoCache.values()) g.dispose();
  hairGeoCache.clear();
  if (atlas) { atlas.dispose(); atlas = null; }
}
