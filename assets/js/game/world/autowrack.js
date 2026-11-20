// NULLPUNKT — Ausgebrannte Autowracks als echte Karosserie (Nutzer 14.11.: „das zivile Auto im Stadtkern ist ein grober
// Quader mit Scheibenrädern“; 15.11.: Karosserien als Unterteilungsfläche; 20.11.: „sieht aus wie eine geschmolzene,
// aufgeblähte Hülle“ → glaubwürdiges ausgebranntes Wrack).
//
// Grundlage ist dasselbe Unterteilungsnetz wie bei den fahrbaren Pkw (vehicles/carbody.js: Kanten/Charakterlinien als
// (halb)scharfe Kanten, Fugen als Kantenmarken) – auf high/ultra in der Nahstufe des Pkw (2 Stufen), sonst eine Stufe.
// Was ein Fahrzeugbrand übrig lässt:
//   • Blech: Form und Kanten bleiben (keine Rauschbeulen über die ganze Hülle mehr – das wirkte „geschmolzen“), nur
//     einzelne Dellen, ein durch die Hitze eingesacktes Dach und eine aufgebogene, verzogene Motorhaube (eigene Teil-
//     fläche, vorn hochgestellt → Spalt an der Haubenfuge). Dünnes Blech: Innenhaut 1–1,5 cm hinter der Außenhaut.
//   • Kunststoff verkohlt: Stoßfänger, Grill und Leuchten als schwarze, geschmolzene Reste; dahinter Querträger,
//     Kühlerblock, Lampentöpfe. Scheiben fehlen bis auf gesplitterte Reste an der Unterkante der Seitenfenster.
//   • Reifen abgebrannt: der Wagen sitzt auf den Stahlfelgen (Felgenhorn auf dem Boden), Drahtreste der Stahlgürtel
//     um die Felge, Bremsscheiben dahinter, Federbein im Radhaus; gelegentlich fehlt ein Rad ganz – die Ecke liegt auf
//     der Bremsscheibe, die Felge liegt daneben. Die Karosserie folgt den vier Auflagehöhen (Ebene durch die Radnaben).
//   • Innenraum: Sitzgestelle mit Wellen- und Schraubenfedern, Kopfstützenbügel, Rückbank-Gestell, Lenkradskelett,
//     Querträger des Armaturenbretts, Pedale, Bodenblech mit Asche; im Motorraum Block und Getriebe.
//   • Farbe je Ecke (Vertexfarben × Tönung): Hitzeverlauf – unten/an den Enden Lackreste mit Blasenrand, darüber
//     schwarzer Ruß, dunkler und heller Rost, auf waagerechten Flächen weißliche Asche; Rußfahnen über den Fenster-
//     öffnungen und um die Radläufe.
// Alles läuft über MapBuilder.geom (Material-Eimer der Welt: nur metal_rust → keine zusätzlichen Draw Calls je
// Wrack, keine neuen Texturen/Sampler). Kollision bleibt beim Aufrufer (einfacher Quader). low → Requisit (props.js).
//
// autoWrack(b, x, y, z, ry, { seed, color, style }) – ry wie Requisiten (lokal +z = Front).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tube, steelRim, brakeDisc } from '../vehicles/bodykit.js?v=20261115041504';
import { pkwSub, pkwShape, TAG } from '../vehicles/carbody.js?v=20261115041504';
import { vertexNormals, cornerNormals, toGeometry, toLimit, seamGeometry, faceNormals } from '../engine/subsurf.js?v=20261115041504';

const PI = Math.PI, HP = PI / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function rng(seed) { let s = Math.abs(Math.floor(seed) * 9301 + 49297) % 233280 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function vhash(x, y, z) { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  return lerp(lerp(lerp(vhash(ix, iy, iz), vhash(ix + 1, iy, iz), u), lerp(vhash(ix, iy + 1, iz), vhash(ix + 1, iy + 1, iz), u), v),
    lerp(lerp(vhash(ix, iy, iz + 1), vhash(ix + 1, iy, iz + 1), u), lerp(vhash(ix, iy + 1, iz + 1), vhash(ix + 1, iy + 1, iz + 1), u), v), w);
}

// Brandfarben (linear, werden mit der Rost-Textur × Tönung multipliziert)
const C = {
  char: new THREE.Color(0.045, 0.04, 0.036),
  blister: new THREE.Color(0.15, 0.11, 0.08),
  rustD: new THREE.Color(0.25, 0.12, 0.055),
  rustB: new THREE.Color(0.6, 0.3, 0.12),
  ash: new THREE.Color(0.58, 0.56, 0.52),
  steel: new THREE.Color(0.3, 0.27, 0.24),
};

/** Farbe aus Hitzegrad h (0 kalt … 1 heißester Bereich), Lack paint, Aufwärts-Anteil up (Asche bleibt liegen). */
function heatColor(out, h, paint, up, n2) {
  if (h < 0.3) out.copy(paint).lerp(C.blister, smooth(0.18, 0.3, h) * 0.8);
  else if (h < 0.42) out.copy(C.blister).lerp(C.char, smooth(0.3, 0.42, h));
  else if (h < 0.58) out.copy(C.char).lerp(C.rustD, smooth(0.46, 0.58, h));
  else if (h < 0.76) out.copy(C.rustD).lerp(C.rustB, smooth(0.6, 0.76, h));
  else out.copy(C.rustB);
  // Asche: nur auf (halb)waagerechten, sehr heißen Flächen; fleckig
  const a = smooth(0.78, 0.95, h) * smooth(0.25, 0.7, up) * (0.55 + 0.45 * n2);
  if (a > 0) out.lerp(C.ash, Math.min(0.9, a));
  return out;
}

/** Vertexfarben einer (nicht indizierten) Geometrie aus einer Positionsfunktion. */
function colorize(g, fn) {
  const P = g.attributes.position, N = g.attributes.normal, n = P.count, A = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    fn(c, P.getX(i), P.getY(i), P.getZ(i), N ? N.getY(i) : 0);
    A[i * 3] = c.r; A[i * 3 + 1] = c.g; A[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(A, 3));
  return g;
}

/** Nicht indiziert, nur position/normal/color, dann zusammenführen. */
function join(list) {
  const flat = list.filter(Boolean).map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (!n.attributes.normal) n.computeVertexNormals();
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') n.deleteAttribute(k);
    return n;
  });
  if (flat.length === 1) return flat[0];
  return mergeGeometries(flat, false);
}

/** Rostiges Stahlteil: Farbe aus Rauschen (dunkler/heller Rost, Ruß, Asche oben). */
const rusty = (seed, ash = 0.3) => (c, x, y, z, ny) => {
  const r = vnoise(x * 5 + seed, y * 5, z * 5), r2 = vnoise(x * 17, y * 17 + seed, z * 17);
  c.copy(C.char).lerp(C.rustD, smooth(0.25, 0.55, r)).lerp(C.rustB, smooth(0.55, 0.85, r) * 0.8);
  if (ny > 0.3 && r2 > 1 - ash) c.lerp(C.ash, 0.7);
};

/** Zickzack-Wellenfeder von a nach b (Ausschlag amp quer in Richtung side), n Wellen. */
function zigzag(a, b, side, amp, n) {
  const pts = [];
  for (let i = 0; i <= n * 2; i++) {
    const t = i / (n * 2), s = i === 0 || i === n * 2 ? 0 : (i % 2 ? 1 : -1) * amp;
    pts.push([lerp(a[0], b[0], t) + side[0] * s, lerp(a[1], b[1], t) + side[1] * s, lerp(a[2], b[2], t) + side[2] * s]);
  }
  return tube(pts, 0.0045, 3, 1);
}

/** Schraubenfeder (Achse y) ab Fußpunkt p, Radius rr, Höhe h, Windungen n. */
function coil(p, rr, h, n, wire = 0.005) {
  const pts = [];
  for (let i = 0; i <= n * 10; i++) { const t = i / (n * 10), a = t * n * PI * 2; pts.push([p[0] + Math.cos(a) * rr, p[1] + t * h, p[2] + Math.sin(a) * rr]); }
  return tube(pts, wire, 3, 1);
}

/** Quader mit Unterteilung längs (für Farbverlauf), Mitte (x, y, z). */
const bar = (w, h, d, x, y, z, seg = 4) => new THREE.BoxGeometry(w, h, d, w > d ? seg : 1, 1, d >= w ? seg : 1).translate(x, y, z);

/** Unterteiltes Pkw-Netz je Form/Stufe zwischengespeichert; jeder Aufruf bekommt eigene Eckpunkte (wird verformt). */
const SUB = new Map();
function subOf(st, lv, limit = false) {
  const k = `${st}:${lv}:${limit}`;
  if (!SUB.has(k)) { const m = pkwSub(st, lv); SUB.set(k, limit ? toLimit(m) : m); }
  const m = SUB.get(k);
  return { ...m, P: Float64Array.from(m.P) };
}

/** Ausgebranntes Auto; (x, y, z) Boden unter der Mitte, ry wie Requisiten (+z = Front). */
export function autoWrack(b, x, y, z, ry, { seed = 1, color = '#3a3430', style = null, ground = null } = {}) {
  const r = rng(Math.abs(seed) * 1000 + 7);
  const st = style ?? Math.floor(r() * 3);
  const look = b.lookQuality || b.quality || 'high';
  const LV = look === 'high' || look === 'ultra' ? 2 : 1;
  const SH = pkwShape(st), { G } = SH;
  const yaw = ry + PI; // Fahrzeugraum: vorn −z, rechts +x
  const paint = new THREE.Color(color).multiplyScalar(0.62);
  const sd = seed * 3.7 + 1, o = sd * 1.37;
  const fireFront = r() < 0.5; // Brandherd Motorraum (vorn heißer) oder Innenraum

  // ---- Auflage: Felgen (r 0,2 m) bzw. eine Bremsscheibe (r 0,145 m) auf dem Boden; Federn ausgeglüht → 2–4 cm tiefer
  const RIM = 0.2, WX = 0.8, WZ = [-1.38, 1.43];
  const missing = r() < 0.4 ? Math.floor(r() * 4) : -1;
  const wheels = [];
  // ground(wx, wz): Geländehöhe (Welt) – unebener Boden: jede Felge liegt auf, die Karosserie folgt der Ebene durch die
  // vier Auflagen (vorher schwebte ein Wrack auf einer Kuppe mit einer Achse in der Luft)
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const gAt = (lx, lz) => (ground ? ground(x + lx * cy + lz * sy, z - lx * sy + lz * cy) - y : 0);
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1, wz = WZ[i >> 1], g = gAt(sx * WX, wz), hub = g + (i === missing ? 0.145 : RIM);
    wheels.push({ sx, wz, hub, g, gone: i === missing, dy: hub - 0.32 - (0.02 + r() * 0.025) });
  }
  const avg = (f) => wheels.filter(f).reduce((s, w) => s + w.dy, 0) / 2;
  const gx = (avg((w) => w.sx > 0) - avg((w) => w.sx < 0)) / (2 * WX);
  const gz = (avg((w) => w.wz > 0) - avg((w) => w.wz < 0)) / (WZ[1] - WZ[0]);
  const d0 = wheels.reduce((s, w) => s + w.dy, 0) / 4 - gz * (WZ[0] + WZ[1]) / 2;
  const lift = (px, pz) => d0 + gx * px + gz * pz; // Absenkung der Karosserie an (px, pz)
  /** Karosserieteil: der Auflage-Ebene folgen (Scherung – Winkel < 3°), dann in die Welt. */
  const place = (geom, mat = 'metal_rust', tint = '#ffffff', follow = true) => {
    if (follow) {
      const P = geom.attributes.position;
      for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) + lift(P.getX(i), P.getZ(i)));
    }
    b.geom(geom, x, y, z, mat, { ry: yaw, tint, collide: false, minimap: false });
  };

  // ---- Karosserie: Netz verformen (Dellen, Dach, Hitzewellen) – Form und Kanten bleiben
  const M = subOf(st, LV), P = M.P, VN = vertexNormals(M), nV = P.length / 3;
  const dents = [];
  for (let k = 0, n = 3 + Math.floor(r() * 4); k < n; k++) {
    const side = r() < 0.5 ? -1 : 1, zz = lerp(-2.2, 2.2, r());
    const yy = Math.abs(zz) > 2.05 ? lerp(0.45, 0.75, r()) : lerp(0.4, 0.85, r());
    dents.push({ p: [side * 0.9, yy, zz], R: 0.28 + r() * 0.3, d: 0.01 + r() * 0.025 }); // flach und weit: kleine tiefe Dellen wirkten mit den harten Normalen wie Schlitze
  }
  const sag = 0.035 + r() * 0.07;
  for (let i = 0; i < nV; i++) {
    const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
    let d = (vnoise(px * 6 + o, py * 6, pz * 6) - 0.5) * 0.007; // Hitzeverzug der Bleche (wenige mm)
    for (const D of dents) {
      const q = Math.hypot((Math.abs(px) - Math.abs(D.p[0])) * 1.5, py - D.p[1], pz - D.p[2]) / D.R;
      if (q < 1 && Math.sign(px) === Math.sign(D.p[0])) d -= D.d * (1 - q * q) ** 2;
    }
    let yy = py + VN[i * 3 + 1] * d;
    if (py > 1.18) yy -= sag * (1 - Math.min(1, (px / 0.7) ** 2)) * Math.sin(clamp((pz - G.zA1 + 0.15) / (G.zC1 - G.zA1 + 0.3), 0, 1) * PI);
    P[i * 3] = px + VN[i * 3] * d; P[i * 3 + 1] = yy; P[i * 3 + 2] = pz + VN[i * 3 + 2] * d;
  }
  const { N: FN } = faceNormals(M), nQ = M.Q.length / 4;
  const cen = (f) => { let cx = 0, cy = 0, cz = 0; for (let i = 0; i < 4; i++) { const v = M.Q[f * 4 + i]; cx += P[v * 3]; cy += P[v * 3 + 1]; cz += P[v * 3 + 2]; } return [cx / 4, cy / 4, cz / 4]; };
  // Scheiben fehlen; Stoßfänger-, Grill- und Leuchtenflächen bleiben als verkohlte, geschmolzene Reste (schwarz) –
  // als Löcher wirkten sie wie Modellfehler (große helle Öffnungen an Heck/Bug)
  const shell = new Set([TAG.PAINT, TAG.TRIM, TAG.PLASTIC, TAG.GRILLE, TAG.LAMP, TAG.RLAMP]);
  const melt = new Set([TAG.PLASTIC, TAG.GRILLE, TAG.LAMP, TAG.RLAMP]);
  const isHood = new Uint8Array(nQ), isShard = new Uint8Array(nQ);
  for (let f = 0; f < nQ; f++) {
    const [cx, cy, cz] = cen(f), t = M.F[f];
    if (shell.has(t) && cz < G.zA0 - 0.015 && cy > 0.66 && FN[f * 3 + 1] > 0.3 && Math.abs(cx) < 0.8 * SH.wt(cz)) isHood[f] = 1;
    // Glasreste: gesplitterter Streifen an der Unterkante der Scheiben
    if (t === TAG.GLASS && Math.abs(cx) > 0.55 && cy < SH.ys(clamp(cz, -2.3, 2.3)) + 0.05 && vhash(cx * 31 + o, cy * 17, cz * 23) < 0.35) isShard[f] = 1;
  }
  // Ruß: Ecken an Scheibenöffnungen (Flammen schlagen aus den Fenstern) und an den Radläufen (Reifenbrand)
  const soot = new Float32Array(nV);
  for (let f = 0; f < nQ; f++) if (M.F[f] === TAG.GLASS && !isShard[f]) for (let i = 0; i < 4; i++) soot[M.Q[f * 4 + i]] = 1;
  for (let ring = 0; ring < 3; ring++) {
    const next = soot.slice();
    for (let f = 0; f < nQ; f++) {
      let m = 0;
      for (let i = 0; i < 4; i++) m = Math.max(m, soot[M.Q[f * 4 + i]]);
      if (m > 0) for (let i = 0; i < 4; i++) { const v = M.Q[f * 4 + i]; next[v] = Math.max(next[v], m * 0.7); }
    }
    soot.set(next);
  }
  const molten = new Uint8Array(nV);
  for (let f = 0; f < nQ; f++) if (melt.has(M.F[f])) for (let i = 0; i < 4; i++) molten[M.Q[f * 4 + i]] = 1;
  const col = new Float32Array(nV * 3), c = new THREE.Color();
  for (let v = 0; v < nV; v++) {
    const px = P[v * 3], py = P[v * 3 + 1], pz = P[v * 3 + 2], up = VN[v * 3 + 1];
    const cab = pz > G.zA0 - 0.1 && pz < G.zC0 + 0.05 ? 1 : 0;
    let h = 0.42 + 0.34 * smooth(0.5, 1.25, py) + 0.1 * cab + (fireFront ? 0.16 : -0.06) * (pz < G.zA0 ? 1 : 0) + (fireFront ? -0.08 : 0.04) * (pz > G.zC0 ? 1 : 0);
    h -= 0.3 * smooth(1.85, 2.35, Math.abs(pz)) * (1 - smooth(0.85, 1.05, py)); // Enden kühler
    h -= 0.16 * (1 - smooth(0.3, 0.6, py)) * (0.4 + vnoise(px * 2.2, o, pz * 2.2));   // Schweller/Unterkante kühler (fleckig)
    h += (vnoise(px * 1.7 + o, py * 1.7, pz * 1.7) - 0.5) * 0.5 + (vnoise(px * 6 + o, py * 6, pz * 6) - 0.5) * 0.16;
    heatColor(c, h, paint, up, vnoise(px * 9, py * 9 + o, pz * 9));
    // Rußfahnen über den Öffnungen (nur oberhalb der Gürtellinie) und um die Radläufe
    let s = soot[v] * smooth(SH.ys(clamp(pz, -2.3, 2.3)) - 0.05, SH.ys(clamp(pz, -2.3, 2.3)) + 0.05, py) * 0.85;
    for (const a of SH.arches) { const dd = Math.hypot(pz - a.z, py - a.y) - a.R; if (dd < 0.2) s = Math.max(s, (1 - Math.max(0, dd) / 0.2) * 0.75); }
    if (s > 0) c.lerp(C.char, s * (0.7 + 0.3 * vnoise(px * 11, py * 11, pz * 11 + o)));
    if (molten[v]) c.copy(C.char).lerp(C.blister, vnoise(px * 14, py * 14, pz * 14 + o) * 0.5);
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  const CN = cornerNormals(M, 38);
  const attrs = { color: { size: 3, perVertex: col } };
  const outer = toGeometry(M, (f) => shell.has(M.F[f]) && !isHood[f], { normals: CN, attrs });
  const hoodO = toGeometry(M, (f) => shell.has(M.F[f]) && isHood[f], { normals: CN, attrs });
  // Innenhaut (dünnes Blech): verkohlt/rostig; auf Stufe 2 aus der gröberen Stufe (auf die Grenzfläche gezogen)
  const Mi = LV >= 2 ? subOf(st, 1, true) : M;
  const inCol = new Float32Array((Mi.P.length / 3) * 3);
  for (let v = 0; v < Mi.P.length / 3; v++) {
    const n1 = vnoise(Mi.P[v * 3] * 4 + o, Mi.P[v * 3 + 1] * 4, Mi.P[v * 3 + 2] * 4);
    c.copy(C.char).lerp(C.rustD, smooth(0.35, 0.8, n1) * 0.8);
    inCol[v * 3] = c.r; inCol[v * 3 + 1] = c.g; inCol[v * 3 + 2] = c.b;
  }
  if (Mi !== M) for (let i = 0; i < Mi.P.length / 3; i++) { // dieselbe Verformung grob nachziehen (Dach)
    const px = Mi.P[i * 3], py = Mi.P[i * 3 + 1], pz = Mi.P[i * 3 + 2];
    if (py > 1.18) Mi.P[i * 3 + 1] = py - sag * (1 - Math.min(1, (px / 0.7) ** 2)) * Math.sin(clamp((pz - G.zA1 + 0.15) / (G.zC1 - G.zA1 + 0.3), 0, 1) * PI);
  }
  const CNi = Mi === M ? CN : cornerNormals(Mi, 60);
  const cenI = (f) => { let cz = 0, cy = 0, cx = 0; for (let i = 0; i < 4; i++) { const v = Mi.Q[f * 4 + i]; cx += Mi.P[v * 3]; cy += Mi.P[v * 3 + 1]; cz += Mi.P[v * 3 + 2]; } return [cx / 4, cy / 4, cz / 4]; };
  const FNi = Mi === M ? FN : faceNormals(Mi).N;
  const hoodI = (f) => { const [cx, cy, cz] = cenI(f); return cz < G.zA0 - 0.015 && cy > 0.66 && FNi[f * 3 + 1] > 0.3 && Math.abs(cx) < 0.8 * SH.wt(cz); };
  const off = LV >= 2 ? 0.016 : 0.012;
  // an den Radlauf-Wülsten liegt die gröbere Innenhaut zu nah an der Außenhaut und stieß als dunkle Schlitze durch
  // (wie carbody.finishBody: dort keine Innenhaut)
  const nearArch = (f) => { const [, cy2, cz2] = cenI(f); return SH.arches.some((a) => Math.hypot(cz2 - a.z, cy2 - a.y) < 0.72); };
  const inner = toGeometry(Mi, (f) => shell.has(Mi.F[f]) && !hoodI(f) && !nearArch(f), { normals: CNi, attrs: { color: { size: 3, perVertex: inCol } }, offset: off, flip: true });
  const hoodIn = toGeometry(Mi, (f) => shell.has(Mi.F[f]) && hoodI(f), { normals: CNi, attrs: { color: { size: 3, perVertex: inCol } }, offset: off, flip: true });
  // Fugen (Türen, Haube, Klappe) als dunkle Spalte
  const seams = seamGeometry(M, null, LV >= 2 ? 0.006 : 0.009, 0.0016, VN);
  if (seams) colorize(seams, (cc) => cc.copy(C.char).multiplyScalar(0.5));
  // Motorhaube: Schloss aufgeplatzt → vorn hochgestellt (Drehung um die Scharnierlinie), in der Mitte aufgewölbt
  const hy = G.top(G.zA0) - 0.01, ha = 0.035 + r() * 0.06, hb = 0.012 + r() * 0.03, hTw = (r() - 0.5) * 0.05;
  const hoodG = join([hoodO, hoodIn]), HPo = hoodG.attributes.position;
  for (let i = 0; i < HPo.count; i++) {
    const px = HPo.getX(i), py = HPo.getY(i), pz = HPo.getZ(i), dy = py - hy, dz = pz - G.zA0;
    const a = ha + hTw * px; // leicht verwunden
    const t = clamp(-dz / 1.4, 0, 1);
    HPo.setXYZ(i, px, hy + dy * Math.cos(a) - dz * Math.sin(a) + hb * Math.sin(t * PI) * (1 - (px / 0.8) ** 2), G.zA0 + dy * Math.sin(a) + dz * Math.cos(a));
  }
  hoodG.computeVertexNormals();
  place(join([outer, inner, hoodG, seams]));
  // Glasreste (Sicherheitsglas gesplittert, verrußt)
  if (isShard.some((v) => v)) {
    const sh = toGeometry(M, (f) => isShard[f] === 1, { normals: CN });
    // als verrußtes Glas auf dem Rost-Material (das Welt-Glas spiegelte den Himmel → leuchtend blaue Streifen)
    colorize(sh, (cc, px, py, pz) => cc.setRGB(0.025, 0.03, 0.028).lerp(C.ash, vnoise(px * 20, py * 20, pz * 20) * 0.15));
    place(sh);
  }

  // ---- Innenraum, Motorraum, Unterboden (Stahl, rostig/aschig)
  const parts = [];
  const zSeat = -0.28, zBench = st === 1 ? 0.72 : 0.64;
  const seat = (sx, z0, w, back = true, bench = false) => {
    const hw = w / 2, y0 = 0.5, z1 = z0 + (bench ? 0.5 : 0.5);
    parts.push(tube([[sx - hw, y0, z0], [sx + hw, y0, z0], [sx + hw, y0, z1], [sx - hw, y0, z1], [sx - hw, y0, z0]], 0.011, 4, 1));
    // Wellenfedern längs, Querdrähte vorn/hinten
    const n = bench ? 7 : 4;
    for (let k = 0; k < n; k++) { const xx = sx - hw + 0.06 + (k / (n - 1)) * (w - 0.12); parts.push(zigzag([xx, y0 - 0.005, z0 + 0.02], [xx, y0 - 0.035, z1 - 0.02], [1, 0, 0], 0.022, 5)); }
    if (!bench) for (const cx of [-0.1, 0.1]) for (const cz of [0.15, 0.36]) parts.push(coil([sx + cx, y0 - 0.12, z0 + cz], 0.032, 0.12, 4));
    // Sitzschienen + Füße
    for (const s of [-1, 1]) { parts.push(bar(0.03, 0.025, 0.62, sx + s * (hw - 0.05), 0.385, z0 + 0.22)); parts.push(bar(0.03, 0.11, 0.03, sx + s * (hw - 0.05), 0.44, z0 + 0.05)); parts.push(bar(0.03, 0.11, 0.03, sx + s * (hw - 0.05), 0.44, z0 + 0.42)); }
    if (!back) return;
    // Lehne (leicht nach hinten, eine evtl. umgeklappt/verzogen)
    const lean = bench ? 0.2 : 0.18 + (r() - 0.3) * 0.25, H = bench ? 0.55 : 0.62;
    const top = [z1 + Math.sin(lean) * H, y0 + Math.cos(lean) * H];
    parts.push(tube([[sx - hw + 0.02, y0, z1], [sx - hw + 0.02, top[1], top[0]], [sx + hw - 0.02, top[1], top[0]], [sx + hw - 0.02, y0, z1]], 0.011, 4, 1));
    const nb = bench ? 6 : 3;
    for (let k = 0; k < nb; k++) { const xx = sx - hw + 0.08 + (k / (nb - 1)) * (w - 0.16); parts.push(zigzag([xx, y0 + 0.06, z1 + Math.sin(lean) * 0.06], [xx, top[1] - 0.05, top[0] - Math.sin(lean) * 0.05], [1, 0, 0], 0.025, 5)); }
    if (!bench) {
      // Kopfstützenbügel
      for (const s of [-0.07, 0.07]) parts.push(tube([[sx + s, top[1] - 0.02, top[0]], [sx + s, top[1] + 0.16, top[0] + 0.02]], 0.006, 3, 1));
      parts.push(tube([[sx - 0.12, top[1] + 0.14, top[0] + 0.02], [sx - 0.12, top[1] + 0.27, top[0] + 0.04], [sx + 0.12, top[1] + 0.27, top[0] + 0.04], [sx + 0.12, top[1] + 0.14, top[0] + 0.02]], 0.007, 3, 2));
    }
  };
  seat(-0.38, zSeat, 0.5); seat(0.38, zSeat, 0.5);
  seat(0, zBench, 1.3, true, true);
  // Armaturenbrett-Querträger, Lenksäule, Lenkradskelett (Kranz + 3 Speichen), Heizungskasten-Rest, Pedale
  parts.push(tube([[-0.72, 0.84, -0.78], [0.72, 0.84, -0.78]], 0.028, 6, 1));
  parts.push(tube([[-0.4, 0.84, -0.78], [-0.4, 0.55, -0.66]], 0.016, 4, 1), tube([[0.25, 0.84, -0.78], [0.25, 0.55, -0.7]], 0.014, 4, 1));
  const sw = new THREE.Vector3(-0.38, 0.98, -0.5), tilt = -0.42;
  parts.push(new THREE.TorusGeometry(0.18, 0.011, 4, 18).rotateX(tilt).translate(sw.x, sw.y, sw.z));
  for (let k = 0; k < 3; k++) { const a = PI / 2 + (k * 2 * PI) / 3; parts.push(tube([[sw.x, sw.y, sw.z], [sw.x + Math.cos(a) * 0.17, sw.y + Math.sin(a) * 0.17 * Math.cos(tilt), sw.z + Math.sin(a) * 0.17 * Math.sin(tilt)]], 0.007, 3, 1)); }
  parts.push(tube([[-0.38, 0.98, -0.5], [-0.38, 0.85, -0.76], [-0.38, 0.72, -0.95]], 0.022, 5, 1));
  parts.push(bar(0.4, 0.2, 0.22, 0.05, 0.66, -0.86, 2));
  for (const [px, h] of [[-0.5, 0.62], [-0.38, 0.6], [-0.26, 0.6]]) parts.push(tube([[px, 0.8, -0.98], [px, h - 0.1, -0.9], [px, h - 0.14, -0.86]], 0.007, 3, 1), bar(0.07, 0.015, 0.05, px, h - 0.15, -0.86, 1));
  // Motorraum: Block, Getriebe, Kühlerblock (hinter dem verbrannten Grill), Federbeindome
  parts.push(bar(0.56, 0.42, 0.52, 0.04, 0.6, -1.62, 3), bar(0.36, 0.26, 0.32, -0.1, 0.5, -1.12, 2), bar(0.5, 0.06, 0.42, 0.04, 0.81, -1.62, 2));
  parts.push(bar(1.2, 0.42, 0.06, 0, 0.56, -2.12, 6));
  for (const s of [-1, 1]) parts.push(bar(0.2, 0.32, 0.22, s * 0.6, 0.72, WZ[0], 2), bar(0.18, 0.26, 0.2, s * 0.6, 0.7, WZ[1], 2));
  // Querträger statt Stoßfänger: vorn einseitig abgerissen (hängt schräg), hinten verbogen
  const hang = r() < 0.6 ? 1 : 0;
  parts.push(bar(1.08, 0.11, 0.08, 0, 0, 0, 8).rotateZ(hang ? 0.1 * (r() < 0.5 ? -1 : 1) : 0).translate(0, 0.45, -2.18));
  parts.push(bar(1.08, 0.1, 0.08, 0, 0.47, 2.18, 8));
  for (const s of [-1, 1]) parts.push(bar(0.07, 0.07, 0.2, s * 0.45, 0.47, 2.06, 1), bar(0.07, 0.07, 0.2, s * 0.45, 0.45, -2.06, 1));
  // Lampentöpfe (Reflektorschalen ohne Glas)
  for (const s of [-1, 1]) parts.push(new THREE.CylinderGeometry(0.075, 0.06, 0.08, 10, 1, true).rotateX(HP).translate(s * 0.56, 0.65, -2.16));
  // Unterboden: Bodenblech mit Ascheschicht (Innenraum), Längsträger, Abgasstrang mit Topf, Tank
  const floor = new THREE.PlaneGeometry(1.5, 4.1, 6, 16).rotateX(-HP).translate(0, 0.37, 0.12);
  colorize(floor, (cc, px, py, pz) => { const n1 = vnoise(px * 3 + o, 0, pz * 3), n2 = vnoise(px * 12, o, pz * 12); cc.copy(C.char).lerp(C.ash, smooth(0.35, 0.8, n1) * 0.85).lerp(C.rustD, smooth(0.7, 0.95, n2) * 0.6); });
  const under = [bar(1.5, 0.03, 4.1, 0, 0.335, 0.12, 6)];
  for (const s of [-1, 1]) under.push(bar(0.09, 0.12, 4.0, s * 0.62, 0.28, 0.1, 8));
  under.push(tube([[0.2, 0.42, -1.4], [0.22, 0.24, -1.0], [0.25, 0.24, 1.6], [0.3, 0.26, 2.3]], 0.026, 6, 2));
  under.push(bar(0.3, 0.14, 0.5, 0.28, 0.25, 1.85, 2), bar(0.7, 0.2, 0.5, -0.1, 0.3, 1.45, 3));
  parts.push(...under);
  const steelG = join(parts);
  colorize(steelG, rusty(o, 0.35));
  place(join([steelG, floor]));

  // ---- Räder: Stahlfelge (Horn auf dem Boden), Felgenbett, Wulstdraht + Drahtreste des Gürtels, Bremsscheibe, Federbein
  const wheelParts = [];
  const lost = [];
  for (const w of wheels) {
    const xo = w.sx * WX, hub = w.hub;
    const rot = (g) => { if (w.sx < 0) g.rotateY(PI); return g; };
    // Bremsscheibe + Sattel (Scheibe r 0,145: liegt bei fehlendem Rad auf)
    const disc = new THREE.CylinderGeometry(0.145, 0.145, 0.024, 18).rotateZ(HP).translate(xo - w.sx * 0.06, hub, w.wz);
    wheelParts.push(disc, bar(0.05, 0.1, 0.09, xo - w.sx * 0.08, hub + 0.1, w.wz + 0.07, 1));
    wheelParts.push(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8).rotateZ(HP).translate(xo - w.sx * 0.02, hub, w.wz));
    // Federbein bis in den Dom (Ende folgt der Karosserie)
    const topY = 0.78 + lift(w.sx * 0.6, w.wz);
    wheelParts.push(tube([[xo - w.sx * 0.12, hub + 0.06, w.wz], [w.sx * 0.62, topY, w.wz + 0.02]], 0.022, 6, 1));
    wheelParts.push(coil([w.sx * 0.65, lerp(hub + 0.06, topY, 0.45), w.wz + 0.01], 0.065, (topY - hub) * 0.4, 4, 0.008));
    // Querlenker
    wheelParts.push(tube([[xo - w.sx * 0.1, hub - 0.05, w.wz], [w.sx * 0.35, 0.24 + lift(w.sx * 0.35, w.wz), w.wz - 0.15]], 0.016, 4, 1));
    if (w.gone) {
      // Felge abgefallen: liegt flach neben dem Wagen
      const lr = rot(steelRim(RIM, { holes: 6, seg: 16 })).rotateZ(HP * w.sx).translate(w.sx * 1.32, 0.02 + gAt(w.sx * 1.32, w.wz + 0.35), w.wz + 0.35);
      lost.push(lr, new THREE.CylinderGeometry(RIM * 0.98, RIM * 0.98, 0.15, 18, 1, true).translate(w.sx * 1.32, 0.09 + gAt(w.sx * 1.32, w.wz + 0.35), w.wz + 0.35));
      continue;
    }
    wheelParts.push(rot(steelRim(RIM, { holes: 6, seg: 18 })).translate(xo + w.sx * 0.02, hub, w.wz));
    wheelParts.push(new THREE.CylinderGeometry(RIM * 0.97, RIM * 0.97, 0.15, 20, 1, true).rotateZ(HP).translate(xo - w.sx * 0.05, hub, w.wz));
    for (const s of [-0.07, 0.07]) wheelParts.push(new THREE.TorusGeometry(RIM, 0.009, 4, 22).rotateY(HP).translate(xo - w.sx * 0.05 + s, hub, w.wz));
    // Gürteldrähte: verzogene Ringe um die Felge (unten aufliegend)
    for (let k = 0; k < 2; k++) {
      const R0 = 0.27 + r() * 0.03, t = new THREE.TorusGeometry(R0, 0.004, 3, 26).rotateY(HP);
      const tp = t.attributes.position;
      for (let i = 0; i < tp.count; i++) { const yy = tp.getY(i), zz = tp.getZ(i); tp.setXYZ(i, tp.getX(i) + (vnoise(zz * 8, yy * 8, k + o) - 0.5) * 0.05, yy < 0 ? yy * ((hub - w.g) / R0) : yy * (0.85 + 0.15 * vnoise(zz * 5, k, o)), zz); }
      wheelParts.push(t.translate(xo - w.sx * (0.02 + k * 0.08), hub, w.wz));
    }
  }
  const wg = join([...wheelParts, ...lost]);
  colorize(wg, rusty(o + 3, 0.15));
  place(wg, 'metal_rust', '#ffffff', false);
}
