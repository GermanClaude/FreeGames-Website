// NULLPUNKT — Prozedurale Fahrzeugmodelle (GROSSKAMPF_PLAN §6.7): KP-1 Mammut (Kampfpanzer), GW-4 Steppe (Geländewagen).
//
// Baukasten aus Grundkörpern, je Material zu einem Mesh verschmolzen (wenige Draw Calls), drei LOD-Stufen
// (THREE.LOD; Abstände je Qualitätsstufe). UVs weltmaßstäblich (1 m) über boxUV → passen zu den Fotoscan-Sätzen.
// Ketten: geschlossene Bandschleife um Triebrad/Leitrad mit Lauf-UV (Texturversatz = Kettenlauf).
// Vorlagen werden je Typ/Team/Stufe einmal gebaut und geklont (Geometrien/Materialien geteilt).
//
// createVehicleModel(type, { team, quality }) → {
//   root, turret, gun, cmg, mg, wheels:[{pivot, spin, steer, side, local}], trackMats:[L, R], trackLoop (m),
//   lenses:[Mesh], cones:[Mesh], setLights(on), setWreck(on), dispose(),
//   // Besatzung (panzer-mp.md §3.7/§D.2, nur KP-1; beim Geländewagen hatches = {} und interior = null):
//   hatches:{driver, commander, loader} (Drehpunkt an der Scharnierkante), setHatch(id, t 0…1),
//   interior (Turmraum, unsichtbar), setInterior(on), setBreech(t 0…1), setRack({mbt_ap, mbt_he}), setHeld(type|null)
// }
// Luken und Innenraum liegen außerhalb der LOD-Stufen (eigene Netze; der Innenraum nur für den lokalen Insassen).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxUV } from '../engine/textures.js?v=20261121041936';
import { VEHICLES, mountY, staticComp, driverCabin } from './data.js?v=20261121041936';
import { vehicleMaterials, trackMaterial, markingMaterial, applyVehicleLook } from './materials.js?v=20261121041936';
import { CIVIL_BUILDERS } from './models-civil.js?v=20261121041936';
import { jeepBodyHQ, jeepWheelHQ } from './models-jeep.js?v=20261121041936';
import { attachCabin, setCabinVisible, syncCabin, attachCockpit, syncCockpit } from './cabin.js?v=20261121041936';
import { NEW_TANK_BUILDERS, buildTroop, sprocket, idler, weld, hullShell, castTurret, towCable } from './models-tanks.js?v=20261121041936';
import { armorShell, stackRings, insetPoly } from './armorkit.js?v=20261121041936';
import { eraPaint } from './materials.js?v=20261121041936';
import { HEAVY_BUILDERS } from './models-heavy.js?v=20261121041936';
import { TROOP_BUILDERS } from './models-troop.js?v=20261121041936';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const PI = Math.PI, HP = PI / 2;
const LOD_DIST = { low: [0, 18, 50], medium: [0, 28, 75], high: [0, 40, 110], ultra: [0, 55, 140] };
/** env-look: Detailteile (Rückrollen, Zähne, Schürzensegmente, Seile, Staukästen, Profilreifen …) nur ab medium –
 * low behält exakt die bisherige Geometrie (Dreiecke ≤ vorher). Wird je Vorlage in template() gesetzt. */
let HQ = true;
/** Detailstufe der Vorlage: 0 = low (Bestand), 1 = medium, 2 = high/ultra (Budget panzer-mp.md §D.3). */
let DET = 2;
const detNow = () => DET;
/** Optisch 7 Laufrollen je Seite (ab medium) – die Federung rechnet weiter mit den 5 Federstrahlen aus data.js. */
const ROAD7 = [-2.65, -1.767, -0.883, 0, 0.883, 1.767, 2.65];

/** LOD-Stufe, die gerade gebaut wird (Kantenabnutzung nur in den Nahstufen). */
let CUR_LOD = 0;

/**
 * env-look: Kantenabstand je Ecke (Attribut aVehE) für die Kantenabnutzung im Lack-Shader. Je Dreieck und Kante:
 * Abstand der gegenüberliegenden Ecke zur Kante (linear interpoliert = Abstand zur Kante), wenn die Kante eine harte,
 * konvexe Außenkante ist (Nachbardreieck mit anderer Normale, liegt „hinter“ der eigenen Ebene); sonst groß.
 * Glatte Übergänge (Zylindermantel, Torus), innere Diagonalen und offene Ränder bleiben ohne Abnutzung.
 */
const EDGE_FAR = 9;
function edgeAttribute(g) {
  const P = g.attributes.position.array, N = g.attributes.normal ? g.attributes.normal.array : null;
  const nt = P.length / 9, out = new Float32Array(P.length).fill(EDGE_FAR);
  if (!N || CUR_LOD > 1) return out;
  const key = (v) => `${Math.round(P[v * 3] * 400)},${Math.round(P[v * 3 + 1] * 400)},${Math.round(P[v * 3 + 2] * 400)}`;
  const vk = new Array(nt * 3);
  for (let v = 0; v < nt * 3; v++) vk[v] = key(v);
  const edges = new Map();
  const ek = (a, b) => (vk[a] < vk[b] ? `${vk[a]}|${vk[b]}` : `${vk[b]}|${vk[a]}`);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const a = t * 3 + ((k + 1) % 3), b = t * 3 + ((k + 2) % 3), kk = ek(a, b);
    let list = edges.get(kk);
    if (!list) edges.set(kk, (list = []));
    list.push(t);
  }
  const cen = (t, o) => { o[0] = (P[t * 9] + P[t * 9 + 3] + P[t * 9 + 6]) / 3; o[1] = (P[t * 9 + 1] + P[t * 9 + 4] + P[t * 9 + 7]) / 3; o[2] = (P[t * 9 + 2] + P[t * 9 + 5] + P[t * 9 + 8]) / 3; return o; };
  const c1 = [0, 0, 0], c2 = [0, 0, 0];
  // Normale derselben Lage in Dreieck t (Ecke mit gleichem Schlüssel)
  const normAt = (t, k) => { for (let j = 0; j < 3; j++) if (vk[t * 3 + j] === k) return t * 3 + j; return -1; };
  for (let t = 0; t < nt; t++) {
    const i0 = t * 9;
    // Flächennormale
    const ux = P[i0 + 3] - P[i0], uy = P[i0 + 4] - P[i0 + 1], uz = P[i0 + 5] - P[i0 + 2];
    const wx = P[i0 + 6] - P[i0], wy = P[i0 + 7] - P[i0 + 1], wz = P[i0 + 8] - P[i0 + 2];
    let fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
    const area2 = Math.hypot(fx, fy, fz);
    if (area2 < 1e-9) continue;
    fx /= area2; fy /= area2; fz /= area2;
    cen(t, c1);
    for (let k = 0; k < 3; k++) {
      const a = t * 3 + ((k + 1) % 3), b = t * 3 + ((k + 2) % 3);
      const list = edges.get(ek(a, b));
      let wear = false;
      if (list) for (const t2 of list) {
        if (t2 === t) continue;
        const a2 = normAt(t2, vk[a]), b2 = normAt(t2, vk[b]);
        if (a2 < 0 || b2 < 0) continue;
        const smooth = N[a * 3] * N[a2 * 3] + N[a * 3 + 1] * N[a2 * 3 + 1] + N[a * 3 + 2] * N[a2 * 3 + 2] > 0.985
          && N[b * 3] * N[b2 * 3] + N[b * 3 + 1] * N[b2 * 3 + 1] + N[b * 3 + 2] * N[b2 * 3 + 2] > 0.985;
        if (smooth) { wear = false; break; }
        cen(t2, c2);
        if (fx * (c2[0] - c1[0]) + fy * (c2[1] - c1[1]) + fz * (c2[2] - c1[2]) < -1e-5) wear = true;
      }
      if (!wear) continue;
      const lab = Math.hypot(P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]);
      const h = lab > 1e-9 ? area2 / lab : 0; // Höhe der Ecke k über der Kante
      out[(t * 3 + k) * 3 + k] = h;
      out[a * 3 + k] = 0;
      out[b * 3 + k] = 0;
    }
  }
  return out;
}

/** Sammelt Geometrien je Material und verschmilzt sie. */
class Bucket {
  constructor() { this.map = new Map(); this.tag = new Map(); }
  add(geom, mat, pos = null, rot = null, scl = null, { keepUV = false, tag = null } = {}) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    geom.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'aVehE' && k !== 'aCv' && !(keepUV && k === 'uv')) g.deleteAttribute(k);
    g.clearGroups();
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
    _q.setFromEuler(_e);
    _m.compose(_p.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0), _q, _s.set(scl ? scl[0] : 1, scl ? scl[1] : 1, scl ? scl[2] : 1));
    g.applyMatrix4(_m);
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(g);
    if (tag) this.tag.set(mat, tag);
    return this;
  }
  build(parent, { shadow = true, off = null } = {}) {
    for (const [mat, list] of this.map) {
      // armorkit: gerundete Hüllen bringen ihre Kantenabnutzung (aVehE aus der Wölbung) mit – übrige Teile je Teil rechnen
      const vp = HQ && mat.userData && mat.userData.vehPaint;
      if (list.some((g) => g.attributes.aVehE)) for (const g of list) {
        if (!vp) { if (g.attributes.aVehE) g.deleteAttribute('aVehE'); continue; }
        if (!g.attributes.aVehE) g.setAttribute('aVehE', new THREE.BufferAttribute(edgeAttribute(g), 3));
      }
      // autos: Karosserie-Netze bringen Schmutz-/Abriebmasken (aCv) mit – übrigen Teilen 0 geben (gleiche Attribute zum Verschmelzen)
      if (list.length > 1 && list.some((g) => g.attributes.aCv)) for (const g of list) if (!g.attributes.aCv) g.setAttribute('aCv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (list.length > 1) for (const g of list) g.dispose();
      if (!merged.attributes.uv) boxUV(merged, 1);
      // env-look: Position im Fahrzeugraum (Gruppen-Versatz des Turms/Rohrs) für Schlamm/Staub/Tarnung im Lack-Shader
      if (HQ) {
        const P = merged.attributes.position, A = new Float32Array(P.count * 3);
        const ox = off ? off[0] : 0, oy = off ? off[1] : 0, oz = off ? off[2] : 0;
        for (let i = 0; i < P.count; i++) { A[i * 3] = P.getX(i) + ox; A[i * 3 + 1] = P.getY(i) + oy; A[i * 3 + 2] = P.getZ(i) + oz; }
        merged.setAttribute('aVeh', new THREE.BufferAttribute(A, 3));
        if (mat.userData && mat.userData.vehPaint && !merged.attributes.aVehE) merged.setAttribute('aVehE', new THREE.BufferAttribute(edgeAttribute(merged), 3));
      }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      const tag = this.tag.get(mat);
      if (tag) Object.assign(mesh.userData, tag);
      parent.add(mesh);
    }
    this.map.clear();
    this.tag.clear();
    return parent;
  }
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// Ladeschützen-Arm (Ärmel + Handschuh) von elbow nach hand (lokale Punkte), in einen Bucket
const _aq = new THREE.Quaternion(), _ae = new THREE.Euler(), _ad = new THREE.Vector3(), _aY = new THREE.Vector3(0, 1, 0);
function loaderArm(B, S, elbow, hand, r = 0.045) {
  _ad.set(hand[0] - elbow[0], hand[1] - elbow[1], hand[2] - elbow[2]);
  const len = _ad.length();
  _ae.setFromQuaternion(_aq.setFromUnitVectors(_aY, _ad.normalize()));
  const mid = [(hand[0] + elbow[0]) / 2, (hand[1] + elbow[1]) / 2, (hand[2] + elbow[2]) / 2];
  B.add(new THREE.CylinderGeometry(r * 0.85, r, len, 8), S.sleeve, mid, [_ae.x, _ae.y, _ae.z]);
  B.add(new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.05, 8), S.rubber, [hand[0] - _ad.x * 0.05, hand[1] - _ad.y * 0.05, hand[2] - _ad.z * 0.05], [_ae.x, _ae.y, _ae.z]); // Bündchen
  B.add(box(0.075, 0.035, 0.1), S.rubber, hand, [_ae.x, _ae.y, _ae.z]);                                // Handschuh
  B.add(box(0.07, 0.022, 0.05), S.rubber, [hand[0] + _ad.x * 0.06, hand[1] + _ad.y * 0.06 + 0.012, hand[2] + _ad.z * 0.06], [_ae.x, _ae.y, _ae.z]); // Finger
}
const cyl = (r1, r2, h, seg, open = false) => new THREE.CylinderGeometry(r1, r2, h, Math.max(3, seg | 0), 1, open);

/** Seitenprofil (u = vorwärts, y) als Extrusion entlang X (Breite w, mittig). */
function sideExtrude(pts, w, bevel = false) {
  const sh = new THREE.Shape(pts.map(([u, y]) => new THREE.Vector2(u, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: bevel, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -w / 2);
  g.rotateY(HP); // Profil-u → −Z (vorn), Extrusion → X
  return g;
}

/** Grundriss (x, v = vorwärts) als Extrusion entlang Y (Höhe h, ab y = 0). */
function topExtrude(pts, h, bevel = false) {
  const sh = new THREE.Shape(pts.map(([x, v]) => new THREE.Vector2(x, v)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: bevel, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1, curveSegments: 4 });
  g.rotateX(-HP); // Profil-v → −Z (vorn), Extrusion → +Y
  return g;
}

/**
 * Geschlossene Kettenschleife: Mittellinie pts [[z, y], …] (Seitenansicht), Bandbreite w (X), Stärke t.
 * UV: u = Lauflänge (nahtlos, ganzzahlige Wiederholungen), v = quer. Liefert { geometry, k, length }.
 */
function trackLoop(pts, w, t, repeatLen = 0.64) {
  const n = pts.length;
  let L = 0;
  const seg = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push(l); L += l;
  }
  const k = Math.max(1, Math.round(L / repeatLen));
  let cz = 0, cy = 0;
  for (const p of pts) { cz += p[0]; cy += p[1]; }
  cz /= n; cy /= n;
  const pos = [], nor = [], uv = [];
  const quad = (P, N, U) => {
    // P: 4 Punkte [x,y,z]; Wicklung an Normale anpassen
    const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy2 = e1[2] * e2[0] - e1[0] * e2[2], cz2 = e1[0] * e2[1] - e1[1] * e2[0];
    const flip = cx * N[0] + cy2 * N[1] + cz2 * N[2] < 0;
    const idx = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    for (const j of idx) { pos.push(...P[j]); nor.push(...N); uv.push(...U[j]); }
  };
  let s = 0;
  const hw = w / 2, ht = t / 2;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const l = seg[i];
    const tz = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
    let nz = ty, ny = -tz;
    const mz = (a[0] + b[0]) / 2 - cz, my = (a[1] + b[1]) / 2 - cy;
    if (nz * mz + ny * my < 0) { nz = -nz; ny = -ny; }
    const u0 = (s / L) * k, u1 = ((s + l) / L) * k;
    s += l;
    const oA = [a[0] + nz * ht, a[1] + ny * ht], oB = [b[0] + nz * ht, b[1] + ny * ht];
    const iA = [a[0] - nz * ht, a[1] - ny * ht], iB = [b[0] - nz * ht, b[1] - ny * ht];
    // außen / innen
    quad([[-hw, oA[1], oA[0]], [hw, oA[1], oA[0]], [hw, oB[1], oB[0]], [-hw, oB[1], oB[0]]], [0, ny, nz], [[u0, 0], [u0, 1], [u1, 1], [u1, 0]]);
    quad([[-hw, iA[1], iA[0]], [hw, iA[1], iA[0]], [hw, iB[1], iB[0]], [-hw, iB[1], iB[0]]], [0, -ny, -nz], [[u0, 0.1], [u0, 0.9], [u1, 0.9], [u1, 0.1]]);
    // Flanken
    for (const sx of [-1, 1]) {
      const x = sx * hw;
      quad([[x, oA[1], oA[0]], [x, oB[1], oB[0]], [x, iB[1], iB[0]], [x, iA[1], iA[0]]], [sx, 0, 0], [[u0, 0], [u1, 0], [u1, 0.08], [u0, 0.08]]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return { geometry: g, k, length: L };
}

function arc(cz, cy, r, a0, a1, steps, out) {
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    out.push([cz + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
}

/** Mittellinie der Panzerkette (Seitenansicht, z vorn negativ). */
function mbtTrackPath(lod) {
  const steps = [6, 4, 2][lod];
  const t = 0.035;
  const pts = [];
  pts.push([-2.65, t]);
  pts.push([2.65, t]);
  arc(3.05, 0.55, 0.32 + t, -PI * 0.62, HP, steps + 2, pts); // Triebrad hinten
  if (HQ) sagRun(pts, [3.05, 0.55 + 0.32 + t], [-3.12, 0.56 + 0.3 + t], [[1.95, 0.88 + t], [0, 0.88 + t], [-1.95, 0.88 + t]], 0.012, lod);
  arc(-3.12, 0.56, 0.3 + t, HP, PI * 1.38, steps + 2, pts);  // Leitrad vorn
  return pts;
}

/**
 * Obertrum mit Durchhang (Nutzer 15.11.: Kettenspannung): vom Scheitel des hinteren Rads a [z, y] über die Stützen
 * [[z, yOben], …] (absteigend z) zum Scheitel des vorderen Rads b; zwischen zwei Auflagen hängt die Kette um k·Spannweite
 * durch (Sinusbogen). Nur medium+ (low: gerade wie bisher).
 */
function sagRun(pts, a, b, supports, k, lod) {
  const n = [5, 3, 0][lod];
  if (!n) return;
  const anchors = [a, ...supports.filter((p) => p[0] < a[0] - 0.05 && p[0] > b[0] + 0.05), b];
  for (let i = 0; i < anchors.length - 1; i++) {
    const p = anchors[i], q = anchors[i + 1], span = Math.abs(p[0] - q[0]);
    if (i > 0) pts.push([p[0], p[1]]);
    for (let j = 1; j <= n; j++) {
      const t = j / (n + 1);
      pts.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t - k * span * Math.sin(PI * t)]);
    }
  }
}

/* Laufwerk zum Anfassen (Nutzer 14.11.): auf high/ultra werden die Laufrollen der Nahstufe nicht in die Wanne
 * verschmolzen, sondern je Rollentyp als InstancedMesh gesammelt (drehen mit dem Kettenlauf, federn mit den
 * Federstrahlen der Simulation), und die Kette besteht aus einzelnen Gliedern (InstancedMesh entlang der Laufbahn, die
 * unter den eingefederten Rollen mitgeht). RG ist nur während des Baus der Stufe 0 gesetzt. */
let RG = null;
/** Rolle erfassen statt verschmelzen: build(Bucket, sx) baut sie um den Ursprung. → true wenn erfasst */
function rgWheel(kind, x, y, z, r, build, fixed = false) {
  if (!RG) return false;
  const sx = Math.sign(x) || 1, key = `${kind}|${sx}|${r}`;
  let set = RG.wheels.get(key);
  if (!set) {
    const keep = RG; RG = null;
    const B = new Bucket();
    build(B, sx * 1e-4);
    RG = keep;
    set = { B, r, off: [x, y, z], centers: [], fixed };
    RG.wheels.set(key, set);
  }
  set.centers.push([x, y, z]);
  return true;
}

function addRoadWheel(B, S, x, y, z, r, seg, lod) {
  if (lod === 0 && rgWheel('rw', x, y, z, r, (BB, cx) => addRoadWheel(BB, S, cx, 0, 0, r, seg, lod))) return;
  B.add(cyl(r, r, 0.42, seg), S.rubber, [x, y, z], [0, 0, HP]);
  if (lod < 2) {
    B.add(cyl(r * 0.72, r * 0.72, 0.46, seg), S.dark, [x, y, z], [0, 0, HP]);
    B.add(cyl(r * 0.22, r * 0.22, 0.5, Math.max(6, seg / 2)), S.dark, [x, y, z], [0, 0, HP]);
  }
}

/** env-look (medium+): Laufrolle mit Gummibandage, lackierter Radscheibe, Nabe und (high) Radmuttern. */
function addRoadWheelHQ(B, S, paint, x, y, z, r, seg, lod) {
  if (lod === 0 && rgWheel('hq', x, y, z, r, (BB, cx) => addRoadWheelHQ(BB, S, paint, cx, 0, 0, r, seg, lod))) return;
  const sx = Math.sign(x) || 1;
  B.add(cyl(r, r, 0.42, seg), S.rubber, [x, y, z], [0, 0, HP]);
  B.add(cyl(r * 0.78, r * 0.78, 0.44, seg), paint, [x, y, z], [0, 0, HP]);
  B.add(cyl(r * 0.24, r * 0.26, 0.5, Math.max(6, seg >> 1)), S.dark, [x, y, z], [0, 0, HP]);
  if (lod === 0 && DET === 2) for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    B.add(box(0.03, 0.03, 0.03), S.dark, [x + sx * 0.225, y + Math.sin(a) * 0.15, z + Math.cos(a) * 0.15]);
  }
}

/** Keilförmiger Panzerblock: Grundriss (x, v = vorwärts) als Prisma ab y0, Oberseite fällt von hBack (hinten) nach
 * hFront (vorn) ab – Zusatzpanzerung am Turm. */
function wedge(pts, y0, hBack, hFront) {
  const g = topExtrude(pts, 1);
  const P = g.attributes.position;
  let zf = Infinity, zb = -Infinity;
  for (let i = 0; i < P.count; i++) { zf = Math.min(zf, P.getZ(i)); zb = Math.max(zb, P.getZ(i)); }
  for (let i = 0; i < P.count; i++) {
    const k = (P.getZ(i) - zf) / Math.max(1e-6, zb - zf); // 0 = vorn … 1 = hinten
    P.setY(i, y0 + (P.getY(i) > 0.5 ? hFront + (hBack - hFront) * k : 0));
  }
  g.computeVertexNormals();
  return g;
}

/** env-look: Laufwerk und Wanne – Rückrollen, Triebrad mit Zahnkränzen, Leitrad mit Speichen, Schürzensegmente mit
 * Gummiunterkante, Zusatzpanzerung am Glacis, Scheinwerferschutzbügel, Abschleppösen, Heckgitter, Auspuffgitter,
 * Seitenkästen, Winkelspiegel, Kanister und Schanzzeug. Nur HQ (medium+); DET 2 (high/ultra) mit Kleinteilen. */
function mbtDetail(B, S, paint, lod, seg) {
  const W = VEHICLES.mbt.wheels;
  const hi = DET === 2;
  for (const sx of [-1, 1]) {
    if (lod < 2) for (const z of [-1.95, 0, 1.95]) {
      B.add(cyl(0.1, 0.1, 0.2, Math.max(8, seg >> 1)), S.rubber, [sx * W.x, 0.78, z], [0, 0, HP]);
      B.add(cyl(0.045, 0.045, 0.34, 6), S.dark, [sx * (W.x - 0.12), 0.78, z], [0, 0, HP]);
    }
    // Triebrad/Leitrad: models-tanks.js sprocket/idler (drehen in der Nahstufe, high/ultra) – in buildMBT
    if (lod === 0) {
      // Schürze in Segmenten mit Gummiunterkante; die beiden vorderen als dicke Panzerschürze; (high) Schrauben
      for (let i = 0; i < 6; i++) {
        const z = -2.55 + i * 1.04;
        B.add(box(i < 2 ? 0.07 : 0.014, 0.46, 0.98), paint, [sx * (i < 2 ? 1.855 : 1.828), 0.73, z], [0, 0, sx * 0.035]);
        B.add(box(0.025, 0.14, 0.96), S.rubber, [sx * 1.82, 0.44, z]);
        if (hi) for (let j = 0; j < 4; j++) B.add(box(0.02, 0.026, 0.026), S.dark, [sx * (i < 2 ? 1.896 : 1.842), 0.92, z - 0.36 + j * 0.24]);
      }
      B.add(box(0.04, 0.4, 0.14), S.rubber, [sx * 1.78, 0.56, -3.2]);
      B.add(box(0.5, 0.42, 0.03), S.rubber, [sx * 1.42, 0.55, 3.66]);
    }
    if (lod < 2) {
      // Seitenkästen über den Ketten (vorn, neben dem Turm)
      B.add(box(0.3, 0.22, 1.05), paint, [sx * 1.57, 1.74, -1.45]);
      if (lod === 0 && hi) {
        B.add(box(0.31, 0.02, 1.07), S.dark, [sx * 1.57, 1.83, -1.45]);
        for (const dz of [-0.3, 0.3]) B.add(box(0.03, 0.06, 0.05), S.dark, [sx * 1.725, 1.76, -1.45 + dz]);
      }
    }
    if (lod === 0 && hi) {
      // Auspuffgitter seitlich hinten (Lamellen)
      B.add(box(0.03, 0.26, 0.62), S.dark, [sx * 1.765, 1.3, 3.0]);
      for (let j = 0; j < 4; j++) B.add(box(0.04, 0.03, 0.6), paint, [sx * 1.775, 1.2 + j * 0.065, 3.0], [0, 0, sx * 0.5]);
      // Scheinwerferschutzbügel
      const L = VEHICLES.mbt.lights[sx < 0 ? 0 : 1];
      B.add(box(0.4, 0.03, 0.03), S.dark, [L[0], L[1] + 0.17, L[2] - 0.14]);
      for (const dx of [-0.19, 0.19]) B.add(box(0.03, 0.2, 0.03), S.dark, [L[0] + dx, L[1] + 0.08, L[2] - 0.14]);
      // Abschleppösen vorn/hinten
      B.add(new THREE.TorusGeometry(0.075, 0.024, 4, 8), S.dark, [sx * 0.9, 0.86, -3.66], [0, HP, 0]);
      B.add(new THREE.TorusGeometry(0.075, 0.024, 4, 8), S.dark, [sx * 0.6, 0.95, 3.66], [0, HP, 0]);
    }
  }
  if (lod < 2) {
    // geteiltes Glacis: zwei aufgesetzte Zusatzpanzerplatten (Spalt in der Mitte)
    for (const sx of [-1, 1]) {
      B.add(box(1.2, 0.06, 0.9), paint, [sx * 0.68, 1.31, -3.05], [-0.49, 0, 0]);
      if (lod === 0 && hi) for (let j = 0; j < 4; j++) B.add(box(0.04, 0.03, 0.04), S.dark, [sx * (0.2 + j * 0.32), 1.53, -2.68], [-0.49, 0, 0]);
    }
    // Fahrer-Winkelspiegel vor der Luke
    for (let i = -1; i <= 1; i++) B.add(box(0.14, 0.08, 0.1), S.optic, [-0.55 + i * 0.2, 1.66, -2.66 + Math.abs(i) * 0.06], [0, -i * 0.35, 0]);
    // Kanister auf dem Motordeck
    for (const sx of [-1, 1]) {
      B.add(box(0.17, 0.46, 0.34), paint, [sx * 1.45, 1.86, 2.75]);
      if (lod === 0) B.add(box(0.05, 0.05, 0.12), S.dark, [sx * 1.45, 2.11, 2.68]);
    }
    // Heckplatte: Lüftergitter zwischen den Auspuffkästen
    B.add(box(1.1, 0.34, 0.03), S.dark, [0, 1.15, 3.6]);
    if (lod === 0 && hi) for (let j = 0; j < 5; j++) B.add(box(1.06, 0.03, 0.05), paint, [0, 1.03 + j * 0.06, 3.62], [0.6, 0, 0]);
  }
  if (lod < 2) {
    // Reaktivpanzerung (Nutzer 14.11.): Kacheln auf den beiden vorderen Schürzensegmenten, je Kachel zwei Schrauben;
    // Gitterschutz (Käfig aus Flachstählen) vor dem Heck gegen Hohlladungen
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
      const z = -2.55 + i * 1.04;
      if (lod === 0) for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
        const y = 0.63 + r * 0.22, zz = z - 0.36 + k * 0.24;
        B.add(box(0.075, 0.2, 0.225), paint, [sx * 1.925, y, zz], [0, 0, sx * 0.035]);
        if (DET === 2) for (const dy of [-0.06, 0.06]) B.add(cyl(0.014, 0.014, 0.02, 6), S.dark, [sx * 1.965, y + dy, zz], [0, 0, HP]);
      } else B.add(box(0.075, 0.42, 0.96), paint, [sx * 1.925, 0.74, z], [0, 0, sx * 0.035]);
    }
    const zc = 3.92;
    for (const y of [0.98, 1.56]) B.add(box(3.34, 0.045, 0.05), S.dark, [0, y, zc]);
    for (const sx of [-1, 1]) { B.add(box(0.05, 0.62, 0.05), S.dark, [sx * 1.65, 1.27, zc]); B.add(box(0.04, 0.04, 0.28), S.dark, [sx * 1.65, 1.5, zc - 0.15]); B.add(box(0.04, 0.04, 0.28), S.dark, [sx * 1.65, 1.04, zc - 0.15]); }
    if (lod === 0) for (let x = -1.54; x <= 1.55; x += DET === 2 ? 0.105 : 0.21) B.add(box(0.016, 0.56, 0.07), S.dark, [x, 1.27, zc]);
  }
  if (lod === 0) {
    // Schaufel + Brechstange neben der Fahrerluke
    B.add(cyl(0.018, 0.018, 1.1, 6), S.canvas, [0.35, 1.65, -1.75], [HP, 0, 0]);
    B.add(box(0.22, 0.02, 0.28), S.dark, [0.35, 1.65, -1.08]);
    B.add(cyl(0.014, 0.014, 1.2, 6), S.dark, [0.62, 1.65, -1.6], [HP, 0, 0]);
    if (hi) {
      // Vorschlaghammer auf dem Motordeck, Deckel-Fugen
      B.add(cyl(0.02, 0.02, 0.9, 6), S.canvas, [-0.9, 1.7, 1.5], [HP, 0, 0]);
      B.add(box(0.1, 0.08, 0.18), S.dark, [-0.9, 1.7, 1.02]);
      for (const z of [1.2, 2.8]) B.add(box(2.62, 0.012, 0.02), S.dark, [0, 1.668, z]);
    }
  }
}

/** env-look: Turm – Keil-Zusatzpanzerung vorn, Seitenmodule, Staukästen, Rauchwurfbecher (2×4), Optikkopf mit Klappen,
 * Rundblickperiskop, Winkelspiegel der Ladeluke, Lukenring mit MG-Lafette, Staukorb mit Gepäck und Ersatzkettengliedern,
 * Hebeösen, Windsensor, Antennen, Dachnähte. Nur HQ (medium+); DET 2 (high/ultra) mit Kleinteilen. */
function turretDetail(T, S, paint, lod, seg) {
  const hi = DET === 2;
  if (lod < 2) {
    for (const sx of [-1, 1]) {
      // Vorbild (amerikanischer Kampfpanzer): flache, schräge Wangen ohne Keilpanzer – Abdeckplatten der Verbundpanzerung
      // mit Schraubenreihe – und Staukästen seitlich am Turmheck
      T.add(box(0.3, 0.44, 0.92), paint, [sx * 1.505, 0.46, 1.05]);
      if (lod === 0) for (let j = 0; j < (hi ? 4 : 0); j++) { const t = 0.15 + j * 0.23; T.add(box(0.04, 0.04, 0.04), S.dark, [sx * (0.72 + t * 0.6 + 0.02), 0.62, -1.86 + t * 0.91 - 0.012]); }
      // Rauchwurfbecher: Block mit 4 Bechern je Seite
      T.add(box(0.42, 0.07, 0.22), S.dark, [sx * 1.11, 0.815, -0.7]);
      for (let i = 0; i < 4; i++) T.add(cyl(0.05, 0.05, 0.26, lod === 0 ? 8 : 6, lod > 0), S.dark, [sx * (0.98 + i * 0.087), 0.92, -0.76], [-0.75, 0, sx * 0.3]);
      if (lod === 0) {
        T.add(box(0.31, 0.02, 0.94), S.dark, [sx * 1.505, 0.69, 1.05]);
        if (hi) for (let j = 0; j < 6; j++) T.add(box(0.03, 0.035, 0.035), S.dark, [sx * 1.43, 0.22 + (j % 2) * 0.36, -0.85 + (j >> 1) * 0.45]);
      }
    }
    // Richtschützen-Optikkopf: Schutzhaube (Klappen s. u.)
    T.add(box(0.48, 0.05, 0.6), paint, [0.62, 1.165, -0.98]);
    // Unabhängige Wärmebildoptik des Kommandanten (links vorn): Sockel, Kopf mit großem Fenster
    T.add(cyl(0.13, 0.15, 0.14, Math.max(8, seg >> 1)), paint, [-0.9, 0.85, -0.3]);
    T.add(box(0.36, 0.26, 0.32), paint, [-0.9, 1.05, -0.3]);
    T.add(box(0.28, 0.15, 0.02), S.optic, [-0.9, 1.06, -0.465]);
    // Kommandantenkuppel: Öffnung unter dem Deckel
    T.add(cyl(0.34, 0.34, 0.012, seg), S.dark, [-0.62, 1.024, 0.62]);
    // Staukorb: Seitenholme, Planenrolle
    for (const sx of [-1, 1]) T.add(box(0.04, 0.04, 0.5), S.dark, [sx * 1.18, 0.5, 2.25]);
    T.add(cyl(0.12, 0.12, 1.5, Math.max(8, seg >> 1)), S.canvas, [0.1, 0.5, 2.3], [0, 0, HP]);
    // Winkelspiegel an der Ladeluke
    for (let i = 0; i < 3; i++) { const a = -0.9 + i * 0.9; T.add(box(0.12, 0.07, 0.06), S.optic, [0.6 + Math.sin(a) * 0.36, 0.83, 0.55 - Math.cos(a) * 0.36], [0, a, 0]); }
  }
  if (lod === 0) {
    for (const [x, z] of [[-1.15, -0.8], [1.15, -0.8], [-1.0, 1.7], [1.0, 1.7]]) T.add(new THREE.TorusGeometry(0.05, 0.014, 4, 8), S.dark, [x, 0.8, z], [0, x > 0 ? HP : -HP, 0]);
    T.add(cyl(0.015, 0.015, 0.42, 5), S.dark, [0.15, 0.99, 1.65]);
    T.add(box(0.08, 0.06, 0.16), S.dark, [0.15, 1.2, 1.65]);
    T.add(box(0.36, 0.02, 0.02), S.dark, [0.15, 1.25, 1.65]);                                 // Windsensor (Querträger, Fühler)
    for (const dx of [-0.18, 0.18]) T.add(cyl(0.03, 0.03, 0.06, 6), S.dark, [0.15 + dx, 1.28, 1.65]);
    T.add(cyl(0.012, 0.012, 1.9, 4), S.dark, [-0.95, 1.73, 1.55]);
    T.add(cyl(0.05, 0.06, 0.08, 8), S.dark, [-0.95, 0.82, 1.55]);
    for (const z of [-0.6, 0.6]) T.add(box(2.2, 0.012, 0.02), S.dark, [0, 0.785, z]);
    if (hi) {
      // Optikkopf: aufgeklappte Panzerklappen; Periskop: Haube + Rückfenster
      for (const sx of [-1, 1]) T.add(box(0.025, 0.24, 0.16), paint, [0.62 + sx * 0.25, 0.98, -1.3], [0, sx * 0.5, 0]);
      T.add(box(0.4, 0.03, 0.38), paint, [-0.9, 1.19, -0.3], [-0.12, 0, 0]);
      T.add(box(0.1, 0.08, 0.1), S.dark, [-0.9, 0.95, -0.08]);
      // Lukenring der Ladeschützenluke mit MG-Lafette (Zapfen, Waffe, Gurtkasten)
      T.add(new THREE.TorusGeometry(0.37, 0.022, 4, 18), S.dark, [0.6, 0.81, 0.55], [HP, 0, 0]);
      T.add(cyl(0.02, 0.02, 0.3, 6), S.dark, [0.6, 0.97, 0.17]);
      T.add(box(0.08, 0.1, 0.42), S.dark, [0.6, 1.14, 0.08]);
      T.add(cyl(0.016, 0.016, 0.5, 6), S.dark, [0.6, 1.16, -0.36], [HP, 0, 0]);
      T.add(box(0.1, 0.1, 0.14), paint, [0.67, 1.1, 0.12]);
      // Antennenfuß, Ersatzkettenglieder am Staukorb-Heck, Gepäck
      T.add(cyl(0.05, 0.06, 0.08, 8), S.dark, [0.95, 0.82, 1.55]);
      for (let i = 0; i < 3; i++) {
        const x = -0.75 + i * 0.68;
        T.add(box(0.62, 0.15, 0.035), S.dark, [x, 0.3, 2.52]);
        for (const dx of [-0.32, 0.32]) T.add(box(0.04, 0.07, 0.06), S.dark, [x + dx, 0.3, 2.53]);
      }
      for (let i = 0; i < 5; i++) T.add(box(0.025, 0.4, 0.025), S.dark, [-0.95 + i * 0.475, 0.29, 2.48]);
      T.add(box(0.36, 0.22, 0.24), S.dark, [0.75, 0.21, 2.2]);
      T.add(box(0.16, 0.34, 0.3), paint, [-1.0, 0.27, 2.25]);
    }
  }
}

/** env-look: Rohr – Mantelblende mit Stirnplatte und Kragen, Rauchabsauger mit Übergängen, Wärmeschutzhülle in
 * Segmenten (Spannbänder), Mündungsreferenz mit Spiegelgehäuse. Nur HQ. */
function gunDetail(Gb, S, paint, lod, seg) {
  if (lod > 1) return;
  Gb.add(box(0.98, 0.6, 0.1), paint, [0, 0, -0.3]);
  for (const sx of [-1, 1]) Gb.add(box(0.08, 0.6, 0.38), paint, [sx * 0.52, 0, -0.1], [0, sx * 0.35, 0]);
  Gb.add(cyl(0.17, 0.2, 0.12, seg), paint, [0, 0, -0.41], [HP, 0, 0]);
  for (const [z, a, b] of [[-2.65, 0.088, 0.145], [-3.55, 0.145, 0.088]]) Gb.add(cyl(a, b, 0.1, seg, true), paint, [0, 0, z], [HP, 0, 0]);
  if (lod === 0 && DET === 2) {
    for (const z of [-0.95, -2.2, -3.95, -4.85]) Gb.add(cyl(0.095, 0.095, 0.04, 14), S.dark, [0, 0, z], [HP, 0, 0]);
    for (let i = 0; i < 6; i++) Gb.add(box(0.035, 0.035, 0.035), S.dark, [-0.4 + i * 0.16, 0.26, -0.36]);
    Gb.add(box(0.1, 0.08, 0.1), S.dark, [0, 0.14, -5.47]);
    Gb.add(box(0.02, 0.1, 0.02), S.dark, [0, 0.12, -5.38]);
  }
}

function buildMBT(lod, S, team) {
  CUR_LOD = lod;
  const D = VEHICLES.mbt;
  const seg = [20, 12, 7][lod];
  const paint = S.paint[team] || S.paint.null;
  const mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  // Wanne unten (zwischen den Ketten) mit Bugkeil; Wanne oben inkl. Kettenabdeckungen (Glacis, Deck, Heck) – ab medium als
  // Unterteilungsfläche mit gerundeten Plattenkanten (armorkit.js), low wie bisher
  hullShell(TKIT, B, paint, [[3.3, 0.5], [3.62, 0.96], [-3.58, 0.96], [-3.4, 0.5]], 2.3, lod, { r: 0.05, rs: 0.05 });
  if (HQ && lod < 2) hullShell(TKIT, B, paint, [[3.64, 0.95], [2.42, 1.6], [-2.95, 1.63], [-3.55, 1.42], [-3.6, 0.95]], 3.52, lod, { r: 0.045, rs: 0.04, tuck: 0.04 });
  else B.add(sideExtrude([[3.64, 0.95], [2.42, 1.6], [-2.95, 1.63], [-3.55, 1.42], [-3.6, 0.95]], 3.52, lod === 0), paint);
  if (HQ) {
    // Schweißnähte: Glacis/Deck, Bugkante, Deckkanten
    weld(TKIT, B, paint, [[-1.7, 1.6, -2.42], [1.7, 1.6, -2.42]], lod);
    weld(TKIT, B, paint, [[-1.15, 0.96, -3.62], [1.15, 0.96, -3.62]], lod);
    for (const sx of [-1, 1]) weld(TKIT, B, paint, [[sx * 1.735, 1.6, -2.4], [sx * 1.735, 1.63, 2.9]], lod);
  }
  // Seitenschürzen
  for (const sx of [-1, 1]) {
    B.add(box(0.06, 0.5, 6.3), paint, [sx * 1.79, 0.72, 0.1]);
    if (lod === 0 && !HQ) for (let i = 0; i < 6; i++) B.add(box(0.07, 0.04, 0.9), S.dark, [sx * 1.8, 0.95, -2.5 + i * 1.05]);
  }
  if (HQ) mbtDetail(B, S, paint, lod, seg);
  // Heck: Motordeck-Gitter, Auspuff, Rücklichter
  if (lod < 2) {
    B.add(box(2.6, 0.04, 1.6), S.dark, [0, 1.645, 2.0]);
    if (lod === 0) for (let i = 0; i < 9; i++) B.add(box(2.5, 0.05, 0.05), paint, [0, 1.67, 1.3 + i * 0.17]);
    B.add(box(0.7, 0.28, 0.22), S.dark, [-1.0, 1.15, 3.62]);
    B.add(box(0.7, 0.28, 0.22), S.dark, [1.0, 1.15, 3.62]);
    B.add(box(0.12, 0.08, 0.04), S.rearLamp, [-1.5, 1.32, 3.62]);
    B.add(box(0.12, 0.08, 0.04), S.rearLamp, [1.5, 1.32, 3.62]);
  }
  // Bug: Fahrerluke, Scheinwerfergehäuse, Abschlepphaken, Ersatzkettenglieder
  B.add(cyl(0.34, 0.34, 0.06, seg), S.dark, [-0.55, 1.62, -2.35]);
  for (const L of D.lights) B.add(box(0.34, 0.24, 0.2), S.dark, [L[0], L[1], L[2] + 0.1]);
  if (lod === 0) {
    for (const sx of [-1, 1]) B.add(box(0.14, 0.14, 0.3), S.dark, [sx * 0.9, 0.78, -3.5]);
    if (!HQ) for (let i = 0; i < 5; i++) B.add(box(0.5, 0.05, 0.16), S.dark, [0.6, 1.28 - i * 0.05, -3.12 + i * 0.09], [-0.5, 0, 0]);
    // Werkzeug an der Flanke
    B.add(box(0.06, 0.08, 1.4), S.canvas, [1.74, 1.05, 1.2]);
    B.add(box(0.05, 0.1, 1.1), S.dark, [-1.74, 1.05, 1.3]);
  }
  // Kennung am Heck
  B.add(cyl(0.2, 0.2, 0.02, seg), mark, [0.0, 1.25, 3.615], [HP, 0, 0]);
  // Laufwerk: Laufrollen, Triebrad, Leitrad
  const W = D.wheels;
  for (const sx of [-1, 1]) {
    const x = sx * W.x;
    if (lod < 2 && HQ) { const rs = lod === 0 ? (DET === 2 ? 18 : 14) : (DET === 2 ? 10 : 8); for (const z of ROAD7) addRoadWheelHQ(B, S, paint, x, W.radius, z, W.radius, rs, lod); }
    else if (lod < 2) for (const z of W.z) addRoadWheel(B, S, x, W.radius, z, W.radius, seg, lod);
    if (HQ) { sprocket(TKIT, B, S, paint, x, 0.55, 3.05, 0.32, 0.5, 12, lod); idler(TKIT, B, S, paint, x, 0.56, -3.12, 0.3, 0.46, lod); }
    else { B.add(cyl(0.32, 0.32, 0.5, seg), S.dark, [x, 0.55, 3.05], [0, 0, HP]); B.add(cyl(0.3, 0.3, 0.46, seg), S.dark, [x, 0.56, -3.12], [0, 0, HP]); }
  }
  if (HQ && lod < 2) {
    // Abschleppseile an den Wannenflanken (durchhängend, Ösen an den Enden) – im selben Bucket (ein Draw Call)
    for (const sx of [-1, 1]) {
      const x = sx * 1.785, curve = new THREE.CatmullRomCurve3([[x, 1.42, -2.3], [x, 1.36, -1.2], [x, 1.34, 0], [x, 1.36, 1.2], [x, 1.42, 2.3]].map((p) => new THREE.Vector3(...p)));
      B.add(new THREE.TubeGeometry(curve, lod === 0 ? 40 : 16, 0.022, lod === 0 ? 6 : 4, false), S.dark);
      if (lod === 0) for (const z of [-2.36, 2.36]) B.add(new THREE.TorusGeometry(0.055, 0.018, 5, 10), S.dark, [x, 1.43, z], [0, HP, 0]);
    }
  }
  B.build(hull, { shadow: true });
  // Ketten (eigenes Material je Seite → Texturlauf)
  const path = mbtTrackPath(lod);
  if (RG) RG.tracks.push({ path, x: W.x, w: 0.62, t: 0.07 });
  else for (const [i, sx] of [[0, -1], [1, 1]]) {
    const { geometry, k, length } = trackLoop(path, 0.62, 0.07);
    geometry.translate(sx * W.x, 0, 0);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, S.paint.null);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.track = i; mesh.userData.trackK = k; mesh.userData.trackLen = length;
    hull.add(mesh);
  }
  // Scheinwerfer-Gläser
  const LB = new Bucket();
  for (const L of D.lights) LB.add(cyl(0.11, 0.11, 0.04, seg), S.lensOff, [L[0], L[1], L[2] - 0.01], [HP, 0, 0], null, { tag: { lens: true } });
  LB.build(hull, { shadow: false });

  // Turm
  const tur = new THREE.Group();
  const T = new Bucket();
  {
    const foot = [[-0.72, 1.86], [0.72, 1.86], [1.32, 0.95], [1.34, -1.5], [0.95, -2.0], [-0.95, -2.0], [-1.34, -1.5], [-1.32, 0.95]];
    if (HQ && lod < 2) {
      // Turm als Unterteilungsfläche: Wände leicht eingezogen, Kanten gerundet, Dachnaht
      T.add(armorShell(stackRings([[0, foot], [0.78, insetPoly(foot, 0.05)]], { r: 0.04, rTop: 0.045, rBot: 0.04 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0 }), paint);
      weld(TKIT, T, paint, insetPoly(foot, 0.1).concat([insetPoly(foot, 0.1)[0]]).map(([x, v]) => [x, 0.782, -v]), lod);
    } else T.add(topExtrude(foot, 0.78, lod === 0), paint);
  }
  T.add(cyl(1.02, 1.05, 0.14, seg + 4), S.dark, [0, -0.03, 0.1]);
  // Richtschützen-Optik, Kommandantenkuppel
  T.add(box(0.42, 0.36, 0.55), paint, [0.62, 0.96, -0.95]);
  T.add(box(0.34, 0.24, 0.04), S.optic, [0.62, 0.98, -1.23]);
  T.add(cyl(0.42, 0.44, 0.24, seg), paint, [-0.62, 0.9, 0.62]);
  if (lod === 0) {
    const nv = DET === 2 ? 8 : 6;
    for (let i = 0; i < nv; i++) {
      const a = (i / nv) * PI * 2;
      T.add(box(0.12, 0.08, 0.06), S.optic, [-0.62 + Math.sin(a) * 0.43, 0.98, 0.62 + Math.cos(a) * 0.43], [0, a, 0]);
    }
    // Ladeschützenluke, Antenne
    T.add(cyl(0.3, 0.3, 0.05, seg), S.dark, [0.6, 0.8, 0.55]);
    T.add(cyl(0.012, 0.012, 2.3, 4), S.dark, [0.95, 1.9, 1.55]);
    // Abblasplatten im Dach über dem Munitionsbunker (geben bei einer Munitionsexplosion nach oben nach)
    if (HQ) for (const sx of [-1, 1]) T.add(box(0.6, 0.012, 0.68), S.dark, [sx * 0.42, 0.786, 1.45]);
  }
  // Nebelwurfbecher (ab medium: 2×4 im Block, turretDetail)
  if (lod < 2 && !HQ) {
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      T.add(cyl(0.055, 0.055, 0.3, 8), S.dark, [sx * (1.1 + i * 0.06), 0.62, -0.75 - i * 0.08], [-0.6, 0, sx * 0.4]);
    }
  }
  // Staukorb hinten mit Gepäck
  if (lod < 2) {
    T.add(box(2.4, 0.04, 0.5), S.dark, [0, 0.08, 2.25]);
    for (const sx of [-1, 0, 1]) T.add(box(0.04, 0.42, 0.04), S.dark, [sx * 1.18, 0.29, 2.48]);
    T.add(box(2.4, 0.04, 0.04), S.dark, [0, 0.5, 2.48]);
    if (lod === 0) { T.add(box(0.8, 0.35, 0.4), S.canvas, [-0.6, 0.27, 2.24]); T.add(box(0.6, 0.3, 0.38), S.canvas, [0.55, 0.25, 2.24]); }
  }
  for (const sx of [-1, 1]) T.add(cyl(0.18, 0.18, 0.02, seg), mark, [sx * (HQ && lod < 2 ? 1.315 : 1.335), 0.42, 0.3], [0, 0, HP]);
  if (HQ) turretDetail(T, S, paint, lod, seg);
  const turLod = new THREE.Group();
  T.build(turLod, { off: D.turretPivot });
  if (HQ && lod < 2) {
    // taktische Kennung (Schablone) an den Turm-Staukästen
    const MK = new Bucket();
    for (const sx of [-1, 1]) MK.add(new THREE.PlaneGeometry(0.66, 0.165), markingMaterial(team), [sx * 1.662, 0.46, 1.05], [0, sx * HP, 0], null, { keepUV: true });
    MK.build(turLod, { shadow: false, off: D.turretPivot });
  }
  tur.add(turLod);

  // Rohr (Wiege + Mantelblende)
  const gun = new THREE.Group();
  const Gb = new Bucket();
  Gb.add(box(1.05, 0.7, 0.5), paint, [0, 0, 0.0]);
  Gb.add(cyl(0.11, 0.1, 0.5, seg), S.dark, [0, 0, -0.45], [HP, 0, 0]);
  Gb.add(cyl(0.085, 0.085, 5.1, seg), paint, [0, 0, -2.95], [HP, 0, 0]);
  Gb.add(cyl(0.145, 0.145, 0.8, seg), paint, [0, 0, -3.1], [HP, 0, 0]);
  Gb.add(cyl(0.105, 0.11, 0.3, seg), S.dark, [0, 0, -5.4], [HP, 0, 0]);
  if (lod === 0) {
    for (const z of [-1.6, -4.3]) Gb.add(cyl(0.1, 0.1, 0.08, seg), S.dark, [0, 0, z], [HP, 0, 0]);
    Gb.add(box(0.06, 0.06, 0.12), S.dark, [0, 0.1, -5.45]);
  }
  Gb.add(box(0.12, 0.1, 0.22), S.dark, [D.coax[0], D.coax[1], -0.28]);
  if (HQ) gunDetail(Gb, S, paint, lod, seg);
  const gunLod = new THREE.Group();
  Gb.build(gunLod, { off: [D.turretPivot[0] + D.gunPivot[0], D.turretPivot[1] + D.gunPivot[1], D.turretPivot[2] + D.gunPivot[2]] });
  gun.add(gunLod);

  // Kommandanten-MG (fernbedient)
  const cmg = new THREE.Group();
  const C = new Bucket();
  C.add(box(0.3, 0.2, 0.34), paint, [0, -0.05, 0.1]);
  C.add(box(0.14, 0.16, 0.62), S.dark, [0, 0.08, -0.15]);
  C.add(cyl(0.024, 0.024, 0.85, 8), S.dark, [0, 0.08, -0.8], [HP, 0, 0]);
  if (lod < 2) { C.add(box(0.12, 0.16, 0.24), S.dark, [0.16, 0.02, 0.02]); C.add(box(0.16, 0.12, 0.16), S.optic, [-0.17, 0.08, -0.05]); }
  const cmgLod = new THREE.Group();
  C.build(cmgLod, { shadow: lod < 2, off: [D.turretPivot[0] + D.cmgPivot[0], D.turretPivot[1] + D.cmgPivot[1], D.turretPivot[2] + D.cmgPivot[2]] });
  cmg.add(cmgLod);

  return { hull, tur, gun, cmg };
}

/* -------------------------------------------------------------- Panzergenerationen (Nutzer 11.10.) */

/** Kettenmittellinie aus Laufstrecke (z0…z1 am Boden) und Rad vorn/hinten [z, y, r] (Seitenansicht, vorn = −z). */
function trackPathFor(lod, z0, z1, front, back, supports = null, sag = 0.015) {
  const steps = [6, 4, 2][lod], t = 0.035, pts = [];
  pts.push([z0, t]);
  pts.push([z1, t]);
  arc(back[0], back[1], back[2] + t, -PI * 0.62, HP, steps + 2, pts);
  if (HQ && sag > 0) sagRun(pts, [back[0], back[1] + back[2] + t], [front[0], front[1] + front[2] + t], (supports || []).map(([z, y]) => [z, y + t]), sag, lod);
  arc(front[0], front[1], front[2] + t, HP, PI * 1.38, steps + 2, pts);
  return pts;
}

/** Ketten beider Seiten (eigenes Material je Seite → Texturlauf) an hull hängen. */
function addTracks(hull, path, x, w) {
  if (RG) { RG.tracks.push({ path, x, w, t: 0.06 }); return; }
  for (const [i, sx] of [[0, -1], [1, 1]]) {
    const { geometry, k, length } = trackLoop(path, w, 0.06);
    geometry.translate(sx * x, 0, 0);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, vehicleMaterials().paint.null);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.track = i; mesh.userData.trackK = k; mesh.userData.trackLen = length;
    hull.add(mesh);
  }
}

function addLenses(hull, D, seg, r = 0.09) {
  const LB = new Bucket();
  for (const L of D.lights) LB.add(cyl(r, r, 0.04, seg), vehicleMaterials().lensOff, [L[0], L[1], L[2] - 0.01], [HP, 0, 0], null, { tag: { lens: true } });
  LB.build(hull, { shadow: false });
}

const sph = (r, seg) => new THREE.SphereGeometry(r, Math.max(6, seg | 0), Math.max(4, (seg / 2) | 0));

/**
 * 2. Weltkrieg, Team A – „MP-4 Bison“ (frei erfunden, Vorbild: amerikanischer mittlerer Panzer 1944): hohe Wanne mit
 * schräger Bugplatte, gegossenes, dreiteiliges Getriebegehäuse an der Nase, Bug-MG rechts in der Bugplatte, Laufwerk mit
 * drei Federböcken je Seite (je zwei Laufrollen, Stützrolle oben), Triebrad vorn, runder Gussturm mit Kommandantenkuppel und
 * schwerem MG auf dem Dach, kurze 75-mm-Kanone ohne Mündungsbremse.
 */
function buildWK2(lod, S, team) {
  CUR_LOD = lod;
  const D = VEHICLES.wk2, W = D.wheels;
  const seg = [18, 10, 6][lod];
  const paint = S.paint[team] || S.paint.null;
  const mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  // Wanne unten (zwischen den Ketten), Aufbau über den Ketten: schräge Bugplatte (~56°), flaches Deck, leicht schräges Heck
  hullShell(TKIT, B, paint, [[2.6, 0.42], [2.75, 0.62], [2.75, 0.95], [-2.8, 0.95], [-2.68, 0.42]], 1.82, lod, { r: 0.04, rs: 0.04 });
  if (HQ && lod < 2) hullShell(TKIT, B, paint, [[2.95, 0.95], [2.15, 1.5], [-2.5, 1.5], [-2.62, 1.42], [-2.92, 1.1], [-2.92, 0.95]], 2.72, lod, { r: 0.05, rs: 0.05, tuck: 0.03 });
  else B.add(sideExtrude([[2.95, 0.95], [2.15, 1.5], [-2.5, 1.5], [-2.62, 1.42], [-2.92, 1.1], [-2.92, 0.95]], 2.72, lod === 0), paint);
  if (HQ) {
    weld(TKIT, B, paint, [[-1.3, 1.5, -2.15], [1.3, 1.5, -2.15]], lod, 0.013);
    for (const sx of [-1, 1]) weld(TKIT, B, paint, [[sx * 1.335, 1.5, -2.1], [sx * 1.335, 1.5, 2.45]], lod, 0.013);
  }
  // Getriebegehäuse an der Nase (gegossen, gerundet) mit Flanschen der drei Teile
  B.add(cyl(0.36, 0.36, 1.84, seg), paint, [0, 0.8, -2.68], [0, 0, HP]);
  if (lod === 0) for (const x of [-0.6, 0.6]) B.add(cyl(0.375, 0.375, 0.04, seg), S.dark, [x, 0.8, -2.68], [0, 0, HP]);
  // Kugelblende des Bug-MG, Winkelspiegel vor den Luken, Luke des Funkers (die des Fahrers ist beweglich)
  B.add(sph(0.17, seg), paint, [D.cmgPivot[0], D.cmgPivot[1], D.cmgPivot[2] + 0.02]);
  if (lod < 2) for (const x of [-0.5, 0.55]) B.add(box(0.18, 0.08, 0.12), S.dark, [x, 1.54, -2.12]);
  if (lod < 2) B.add(cyl(0.27, 0.27, 0.05, seg), S.dark, [0.55, 1.52, -2.0]);
  B.add(cyl(0.28, 0.28, 0.05, seg), S.dark, [-0.5, 1.525, -2.0]);
  // Kotflügel vorn mit Scheinwerfern im Schutzbügel
  for (const sx of [-1, 1]) B.add(box(0.5, 0.035, 0.38), paint, [sx * 1.12, 1.0, -2.88]);
  for (const L of D.lights) {
    B.add(cyl(0.09, 0.1, 0.14, lod < 2 ? Math.max(8, seg) : seg), S.dark, [L[0], L[1], L[2] + 0.08], [HP, 0, 0]);
    if (lod < 2) B.add(box(0.26, 0.025, 0.025), S.dark, [L[0], L[1] + 0.13, L[2] - 0.02]);
  }
  if (lod < 2) {
    // Motordeck: Gitter und Klappen, Auspuffumlenkblech am Heck, Rücklichter, Werkzeug, Hebeösen
    for (const sx of [-1, 1]) B.add(box(0.95, 0.05, 1.1), S.dark, [sx * 0.6, 1.525, 1.7]);
    if (lod === 0) for (let i = 0; i < 5; i++) B.add(box(2.0, 0.035, 0.05), paint, [0, 1.55, 1.25 + i * 0.2]);
    B.add(box(1.7, 0.36, 0.05), S.dark, [0, 1.0, 2.96], [-0.35, 0, 0]);
    for (const sx of [-1, 1]) B.add(box(0.1, 0.07, 0.04), S.rearLamp, [sx * 1.15, 1.04, 2.93]);
    B.add(box(0.06, 0.06, 1.3), S.canvas, [1.25, 1.53, 0.9]);
    B.add(box(0.05, 0.08, 1.1), S.dark, [-1.25, 1.53, 0.8]);
    B.add(box(0.05, 0.05, 1.4), S.dark, [-1.05, 1.53, 1.0]);
    // Zusatzpanzer an den Seiten über den Munitionskammern (zwei rechts, eine links), Ersatzkettenglieder auf der Bugplatte
    for (const [sx, z] of [[1, -0.95], [1, 0.05], [-1, -0.6]]) B.add(box(0.04, 0.42, 0.62), paint, [sx * 1.38, 1.22, z]);
    if (HQ) towCable(TKIT, B, S, [[-1.37, 1.42, 0.2], [-1.38, 1.36, 1.0], [-1.37, 1.42, 1.9]], lod, 0.022);
    if (lod === 0) {
      for (let i = 0; i < 5; i++) B.add(box(0.15, 0.04, 0.32), S.dark, [-0.36 + i * 0.18, 1.32, -2.45], [-0.6, 0, 0]);
      for (const sx of [-1, 1]) B.add(new THREE.TorusGeometry(0.07, 0.022, 4, 8), S.dark, [sx * 0.7, 0.55, -2.98], [0, HP, 0]);
      for (const [x, z] of [[-1.2, -2.3], [1.2, -2.3], [-1.2, 2.6], [1.2, 2.6]]) B.add(new THREE.TorusGeometry(0.05, 0.016, 4, 8), S.dark, [x, 1.56, z]);
    }
  }
  for (const sx of [-1, 1]) B.add(cyl(0.22, 0.22, 0.02, seg), mark, [sx * 1.37, 1.2, 0.75], [0, 0, HP]);
  B.add(cyl(0.16, 0.16, 0.02, seg), mark, [0, 1.26, 2.79], [0.82, 0, 0]);
  if (lod === 0 && DET > 0) {
    // Lüfterhaube zwischen den Bugluken, Sirene, Schutzbügel um die Scheinwerfer, Anhängerkupplung, Tankdeckel
    B.add(sph(0.13, 10), paint, [0.02, 1.5, -1.95], null, [1, 0.45, 1]);
    B.add(cyl(0.06, 0.06, 0.14, 8), S.dark, [-1.25, 1.1, -2.95], [HP, 0, 0]);
    for (const L of D.lights) for (const dx of [-0.13, 0.13]) B.add(box(0.025, 0.2, 0.025), S.dark, [L[0] + dx, L[1] + 0.04, L[2] - 0.02]);
    B.add(box(0.14, 0.14, 0.14), S.dark, [0, 0.75, 2.86]);
    for (const x of [-0.3, 0.3]) B.add(cyl(0.06, 0.06, 0.03, 8), S.dark, [x, 1.53, 0.95]);
    if (DET === 2) {
      // Werkzeug auf dem Heckdeck: Axt, Spaten, Vorschlaghammer (Stiel + Kopf), Kettenwerkzeug
      for (const [x, z, k] of [[-0.9, 2.35, 0.22], [0.9, 2.35, 0.18], [0.0, 2.55, 0.14]]) { B.add(box(0.04, 0.035, 0.85), S.wood, [x, 1.54, z]); B.add(box(k, 0.05, 0.08), S.dark, [x, 1.545, z - 0.42]); }
    }
  }
  // Laufwerk: drei Federböcke je Seite mit je zwei Laufrollen, Stützrolle oben; Triebrad vorn, Leitrad hinten
  for (const sx of [-1, 1]) {
    const x = sx * W.x;
    for (const zb of [-1.5, 0.02, 1.54]) {
      if (lod < 2) for (const dz of [-0.36, 0.36]) {
        if (HQ) addRoadWheelHQ(B, S, paint, x, 0.29, zb + dz, 0.255, lod === 0 ? 12 : 8, lod);
        else addRoadWheel(B, S, x, 0.29, zb + dz, 0.255, lod === 0 ? 12 : 6, lod);
      }
      if (lod < 2) {
        // Federbock: Gehäuse mit Spiralfedern (oben schmaler), Stützrolle hinten oben auf eigenem Ausleger
        B.add(sideExtrude([[0.3, 0.4], [0.17, 0.7], [-0.2, 0.7], [-0.3, 0.4]], 0.24), paint, [x - sx * 0.04, 0, zb]);
        B.add(cyl(0.08, 0.08, 0.2, 8), S.rubber, [x, 0.8, zb + 0.26], [0, 0, HP]);
        if (lod === 0) {
          B.add(box(0.28, 0.05, 0.46), paint, [x - sx * 0.04, 0.72, zb]);                       // Kopfplatte am Wannenboden
          B.add(box(0.1, 0.05, 0.24), S.dark, [x - sx * 0.04, 0.76, zb + 0.17]);                // Ausleger der Stützrolle
          B.add(box(0.05, 0.1, 0.12), S.dark, [x + sx * 0.1, 0.62, zb - 0.06]);                 // Gleitschuh (Kettenführung)
        }
      }
    }
    if (HQ) { sprocket(TKIT, B, S, paint, x, 0.6, -2.62, 0.29, 0.44, 13, lod); idler(TKIT, B, S, paint, x, 0.55, 2.62, 0.25, 0.4, lod, 8); }
    else {
      B.add(cyl(0.29, 0.29, 0.44, seg), S.dark, [x, 0.6, -2.62], [0, 0, HP]);
      B.add(cyl(0.25, 0.25, 0.4, seg), S.dark, [x, 0.55, 2.62], [0, 0, HP]);
    }
  }
  B.build(hull, { shadow: true });
  addTracks(hull, trackPathFor(lod, -2.2, 2.2, [-2.62, 0.6, 0.29], [2.62, 0.55, 0.25], [[1.8, 0.88], [0.28, 0.88], [-1.24, 0.88]], 0.018), W.x, 0.42);
  addLenses(hull, D, seg, 0.075);

  // Turm: runder Guss (Drehkörper, nach hinten zum Heckwulst gestreckt)
  const tur = new THREE.Group();
  const T = new Bucket();
  if (HQ && lod < 2) {
    // Gussturm als Unterteilungsfläche mit Gussnarben (statt Drehkörper): Heckwulst, Blendenseite leicht abgeflacht
    castTurret(TKIT, T, paint, [[0, 0.96, 1.01, 1.25], [0.18, 0.99, 1.05, 1.3], [0.42, 0.96, 1.0, 1.26], [0.62, 0.86, 0.88, 1.1], [0.78, 0.6, 0.6, 0.78]], lod, { bustle: 0.12, rTop: 0.1, flatFront: 0.08 });
  } else {
    const prof = [[0.96, 0], [0.99, 0.18], [0.96, 0.42], [0.86, 0.62], [0.6, 0.76], [0.001, 0.8]].map(([r, y]) => new THREE.Vector2(r, y));
    const shell = new THREE.LatheGeometry(prof, seg + 4);
    shell.scale(1, 1, 1.18); shell.translate(0, 0, 0.12);
    T.add(shell, paint);
  }
  T.add(cyl(0.92, 0.94, 0.1, lod < 2 ? seg + 4 : seg), S.dark, [0, -0.03, 0]);
  // Kommandantenkuppel mit Sichtblöcken, Ladeschützenluke, schweres MG auf dem Dach, Lüfterhaube, Winkelspiegel
  T.add(cyl(0.34, 0.36, 0.2, seg), paint, [-0.45, 0.88, 0.45]);
  if (lod === 0) {
    const nv = DET === 2 ? 6 : 4;
    for (let i = 0; i < nv; i++) { const a = (i / nv) * PI * 2; T.add(box(0.12, 0.07, 0.05), S.optic, [-0.45 + Math.sin(a) * 0.35, 0.92, 0.45 + Math.cos(a) * 0.35], [0, a, 0]); }
    T.add(sph(0.09, 8), paint, [0.3, 0.8, -0.15]);
    for (const [x, z] of [[0.42, -0.55], [0.75, 0.15]]) T.add(box(0.14, 0.09, 0.1), S.dark, [x, 0.8, z]);
    T.add(cyl(0.01, 0.01, 1.9, 4), S.dark, [0.6, 1.6, 1.05]);
    for (const sx of [-1, 1]) T.add(new THREE.TorusGeometry(0.05, 0.016, 4, 8), S.dark, [sx * 0.8, 0.66, 0.25], [0, HP, 0]);
  }
  T.add(cyl(0.28, 0.28, 0.04, seg), S.dark, [0.5, 0.81, 0.45]);
  if (lod < 2) {
    // schweres MG auf Lafette hinter der Kuppel (nur Ausstattung), Plane am Heckwulst
    T.add(cyl(0.025, 0.03, 0.3, 6), S.dark, [-0.05, 0.9, 0.85]);
    T.add(box(0.11, 0.12, 0.38), S.dark, [-0.05, 1.08, 0.78]);
    T.add(cyl(0.022, 0.022, 1.05, 6), S.dark, [-0.05, 1.1, 0.08], [HP, 0, 0]);
    T.add(cyl(0.13, 0.13, 1.2, Math.max(8, seg)), S.canvas, [0, 0.42, 1.3], [0, 0, HP]);
    if (lod === 0) {
      T.add(box(0.1, 0.12, 0.16), S.dark, [0.06, 1.06, 0.8]);                               // Gurtkasten am schweren MG
      T.add(cyl(0.08, 0.09, 0.05, 10), paint, [-0.94, 0.36, 0.55], [0, 0, HP]);             // Pistolenluke links
    }
  }
  const turLod = new THREE.Group();
  T.build(turLod, { off: D.turretPivot });
  tur.add(turLod);

  // Kanone: breite Blende mit Rotorschild, kurzes Rohr mit Gegengewicht an der Mündung, Koaxial-MG
  const gun = new THREE.Group();
  const Gb = new Bucket();
  Gb.add(box(0.95, 0.5, 0.2), paint, [0, 0, -0.08]);
  if (lod < 2) Gb.add(cyl(0.22, 0.24, 0.2, seg), paint, [0, 0, -0.26], [HP, 0, 0]);
  if (lod === 0) Gb.add(box(0.06, 0.06, 0.04), S.optic, [-0.3, 0.12, -0.19]);
  if (lod < 2) Gb.add(cyl(0.1, 0.1, 0.34, seg), paint, [0, 0, -0.36], [HP, 0, 0]);          // Rohrschutzhülse der Blende
  if (lod === 0) {
    for (const sx of [-1, 1]) Gb.add(box(0.12, 0.42, 0.1), paint, [sx * 0.52, 0, -0.04]); // seitliche Blendenwangen
    Gb.add(box(0.07, 0.05, 0.04), S.dark, [0.3, 0.02, -0.19]);                            // Öffnung Koaxial-MG
  }
  Gb.add(cyl(0.056, 0.05, 3.05, seg), paint, [0, 0, -1.86], [HP, 0, 0]);
  Gb.add(cyl(0.066, 0.066, 0.1, seg), S.dark, [0, 0, -3.33], [HP, 0, 0]);
  Gb.add(cyl(0.022, 0.022, 0.25, 6), S.dark, [D.coax[0], D.coax[1], -0.25], [HP, 0, 0]);
  const gunLod = new THREE.Group();
  Gb.build(gunLod, { off: [D.turretPivot[0] + D.gunPivot[0], D.turretPivot[1] + D.gunPivot[1], D.turretPivot[2] + D.gunPivot[2]] });
  gun.add(gunLod);

  // Bug-MG in der Kugelblende (Wannenraum): Kugel dreht mit
  const cmg = new THREE.Group();
  const C = new Bucket();
  C.add(sph(0.12, seg), paint, [0, 0, -0.06]);
  C.add(cyl(0.032, 0.032, 0.3, 8), S.dark, [0, 0, -0.28], [HP, 0, 0]);
  if (lod < 2) C.add(cyl(0.015, 0.015, 0.55, 6), S.dark, [0, 0, -0.4], [HP, 0, 0]);
  const cmgLod = new THREE.Group();
  C.build(cmgLod, { shadow: lod < 2, off: D.cmgPivot });
  cmg.add(cmgLod);
  return { hull, tur, gun, cmg };
}

/**
 * 1. Weltkrieg, Team B – „SK-18 Koloss“ (frei erfunden, Vorbild: deutscher Sturmpanzerwagen 1918): genieteter Kastenaufbau, der tief über dem Laufwerk hängt, schräge
 * Bug- und Heckplatten, Beobachtungsstand mit Sehschlitzen auf dem Dach, Bugkanone in einer drehbaren Schildlafette
 * (eigene Gruppe „Turm“, ±40°), MG im Kugelstand vorn links, Seitenpforten, Auspuff und Grabenbalken am Heck.
 */
function buildWK1(lod, S, team) {
  CUR_LOD = lod;
  const D = VEHICLES.wk1, W = D.wheels;
  const seg = [16, 10, 6][lod];
  const paint = S.paint[team] || S.paint.null;
  const mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  // Kastenaufbau (Seitenprofil, vorn/hinten überhängend und abgeschrägt)
  if (HQ && lod < 2) hullShell(TKIT, B, paint, [[3.15, 0.36], [3.62, 1.2], [3.62, 1.96], [3.28, 2.45], [-3.28, 2.45], [-3.6, 1.96], [-3.6, 1.1], [-3.15, 0.36]], 3.1, lod, { r: 0.025, rs: 0.025 });
  else B.add(sideExtrude([[3.15, 0.36], [3.62, 1.2], [3.62, 1.96], [3.28, 2.45], [-3.28, 2.45], [-3.6, 1.96], [-3.6, 1.1], [-3.15, 0.36]], 3.1, lod === 0), paint);
  // Beobachtungsstand auf dem Dach mit Sehschlitzen rundum
  B.add(topExtrude([[-0.72, 1.75], [0.72, 1.75], [0.85, 1.55], [0.85, -0.05], [0.72, -0.18], [-0.72, -0.18], [-0.85, -0.05], [-0.85, 1.55]], 0.62, lod === 0), paint, [0, 2.44, 0]);
  B.add(box(1.5, 0.05, 1.8), S.dark, [0, 3.08, -0.79]);
  if (lod < 2) {
    for (const x of [-0.45, 0, 0.45]) B.add(box(0.26, 0.04, 0.03), S.optic, [x, 2.82, -1.76]);
    for (const sx of [-1, 1]) for (const z of [-1.3, -0.5]) B.add(box(0.03, 0.04, 0.24), S.optic, [sx * 0.86, 2.82, z]);
    B.add(box(0.3, 0.04, 0.03), S.optic, [0, 2.82, 0.19]);
  }
  // Kugelstand vorn links (MG), Schildlafette der Kanone sitzt in der Bugplatte
  B.add(cyl(0.2, 0.22, 0.14, seg), paint, [D.cmgPivot[0], D.cmgPivot[1], -3.62], [HP, 0, 0]);
  B.add(box(1.0, 0.85, 0.06), S.dark, [0, D.turretPivot[1], -3.6]);
  for (const L of D.lights) B.add(box(0.18, 0.16, 0.14), S.dark, [L[0], L[1], L[2] + 0.07]);
  if (lod < 2) {
    // Seitenpforten (geschlossene MG-Klappen), Tür hinten, Auspuff, Grabenbalken, Rücklichter
    for (const sx of [-1, 1]) for (const z of [-1.9, -0.4, 1.1]) {
      B.add(box(0.05, 0.36, 0.4), paint, [sx * 1.57, 1.62, z]);
      if (lod === 0) B.add(box(0.06, 0.05, 0.16), S.dark, [sx * 1.585, 1.62, z]);
    }
    B.add(box(0.7, 1.0, 0.05), paint, [0.4, 1.45, 3.62]);
    for (const sx of [-1, 1]) B.add(cyl(0.07, 0.07, 1.2, 8), S.dark, [sx * 1.1, 2.6, 2.3], [HP, 0, 0]);
    B.add(cyl(0.14, 0.14, 2.6, 8), S.canvas, [0, 2.58, 3.05], [0, 0, HP]);
    for (const sx of [-1, 1]) B.add(box(0.1, 0.06, 0.04), S.rearLamp, [sx * 1.2, 1.9, 3.62]);
    // Werkzeug, Seil auf dem Dach
    B.add(box(0.06, 0.06, 1.4), S.canvas, [1.2, 2.48, 1.4]);
    B.add(box(0.05, 0.08, 1.2), S.dark, [-1.2, 2.48, 1.6]);
    // Wassergekühlte Maschinengewehre: je zwei in den Seitenpforten, zwei am Heck (Mantel + Mündung)
    for (const sx of [-1, 1]) for (const z of [-0.4, 1.1]) {
      B.add(cyl(0.05, 0.05, 0.34, 8), S.dark, [sx * 1.76, 1.62, z], [0, 0, HP]);
      if (lod === 0) B.add(cyl(0.016, 0.016, 0.14, 6), S.dark, [sx * 1.99, 1.62, z], [0, 0, HP]);
    }
    for (const x of [-0.75, 1.15]) {
      B.add(box(0.36, 0.3, 0.05), paint, [x, 1.65, 3.62]);
      B.add(cyl(0.05, 0.05, 0.34, 8), S.dark, [x, 1.65, 3.8], [HP, 0, 0]);
    }
    if (lod === 0 && DET > 0) {
      // Plattenstöße mit Laschen an den Seiten, Griffstangen am Dach, Dachluke des Beobachtungsstands
      for (const sx of [-1, 1]) for (const z of [-2.65, -1.15, 0.75, 2.3]) B.add(box(0.03, 1.75, 0.07), S.dark, [sx * 1.565, 1.42, z]);
      for (const sx of [-1, 1]) { B.add(cyl(0.02, 0.02, 4.4, 6), S.dark, [sx * 1.42, 2.56, 0.3], [HP, 0, 0]); for (const z of [-1.7, 0.3, 2.3]) B.add(box(0.03, 0.11, 0.03), S.dark, [sx * 1.42, 2.5, z]); }
      B.add(box(0.6, 0.04, 0.6), paint, [0.2, 3.12, -0.3]);
      if (DET === 2) for (const sx of [-1, 1]) for (const z of [-2.65, -1.15, 0.75, 2.3]) for (let i = 0; i < 5; i++) B.add(box(0.03, 0.03, 0.03), S.steel, [sx * 1.585, 0.75 + i * 0.36, z]);
    }
  }
  if (lod === 0 && DET === 2) {
    // Nietreihen an den Kanten der Seitenplatten
    for (const sx of [-1, 1]) for (const y of [0.55, 2.38]) for (let i = 0; i < 14; i++) B.add(box(0.03, 0.03, 0.03), S.dark, [sx * 1.565, y, -3.0 + i * 0.46]);
    for (let i = 0; i < 8; i++) B.add(box(0.03, 0.03, 0.03), S.dark, [-1.4 + i * 0.4, 2.0, -3.63]);
  }
  for (const sx of [-1, 1]) B.add(cyl(0.22, 0.22, 0.02, seg), mark, [sx * 1.565, 2.0, 0.4], [0, 0, HP]);
  // Laufwerk (tief unter dem Aufbau): viele kleine Laufrollen, Leiträder vorn/hinten
  for (const sx of [-1, 1]) {
    const x = sx * W.x;
    if (lod < 2) {
      const zs = lod === 0 ? [-2.6, -1.95, -1.3, -0.65, 0, 0.65, 1.3, 1.95, 2.6] : W.z;
      for (const z of zs) addRoadWheel(B, S, x, W.radius, z, W.radius, lod === 0 ? 10 : 8, lod);
    }
    if (HQ) { idler(TKIT, B, S, paint, x, 0.42, -3.12, 0.27, 0.48, lod, 0); sprocket(TKIT, B, S, paint, x, 0.42, 3.12, 0.27, 0.48, 10, lod); }
    else for (const z of [-3.12, 3.12]) B.add(cyl(0.27, 0.27, 0.48, seg), S.dark, [x, 0.42, z], [0, 0, HP]);
  }
  B.build(hull, { shadow: true });
  addTracks(hull, trackPathFor(lod, -2.75, 2.75, [-3.12, 0.42, 0.27], [3.12, 0.42, 0.27]), W.x, 0.5);
  addLenses(hull, D, seg, 0.065);

  // „Turm“ = drehbare Schildlafette der Bugkanone (Drehpunkt in der Bugplatte)
  const tur = new THREE.Group();
  const T = new Bucket();
  // nur die vordere Hälfte (der Ladeschütze sieht von innen sonst die Rückseite des Schilds)
  T.add(new THREE.CylinderGeometry(0.42, 0.42, 0.72, seg, 1, false, HP, PI), paint, [0, 0, 0]);
  T.add(new THREE.CylinderGeometry(0.44, 0.44, 0.05, seg, 1, false, HP, PI), S.dark, [0, 0.37, 0]);
  T.add(new THREE.CylinderGeometry(0.44, 0.44, 0.05, seg, 1, false, HP, PI), S.dark, [0, -0.37, 0]);
  if (lod === 0) for (let i = 0; i < 8; i++) { const a = -0.9 + (i / 7) * 1.8; T.add(box(0.03, 0.03, 0.03), S.dark, [Math.sin(a) * 0.425, 0.3, -Math.cos(a) * 0.425]); }
  const turLod = new THREE.Group();
  T.build(turLod, { off: D.turretPivot });
  tur.add(turLod);

  // Kanone: Schutzschild, kurzes Rohr, Rohrvorholer darüber
  const gun = new THREE.Group();
  const Gb = new Bucket();
  Gb.add(box(0.62, 0.5, 0.06), paint, [0, 0, -0.42]);
  Gb.add(cyl(0.06, 0.07, 0.5, seg), S.dark, [0, 0, -0.3], [HP, 0, 0]);
  Gb.add(cyl(0.045, 0.05, 1.12, seg), paint, [0, 0, -1.0], [HP, 0, 0]);
  Gb.add(cyl(0.058, 0.058, 0.08, seg), S.dark, [0, 0, -1.52], [HP, 0, 0]);
  if (lod < 2) Gb.add(cyl(0.04, 0.04, 0.55, 8), S.dark, [0, 0.11, -0.62], [HP, 0, 0]);
  const gunLod = new THREE.Group();
  Gb.build(gunLod, { off: [D.turretPivot[0] + D.gunPivot[0], D.turretPivot[1] + D.gunPivot[1], D.turretPivot[2] + D.gunPivot[2]] });
  gun.add(gunLod);

  // Wassergekühltes MG im Kugelstand (Wannenraum)
  const cmg = new THREE.Group();
  const C = new Bucket();
  C.add(sph(0.15, seg), paint, [0, 0, -0.06]);
  C.add(cyl(0.055, 0.055, 0.5, 10), S.dark, [0, 0, -0.38], [HP, 0, 0]);
  C.add(cyl(0.02, 0.02, 0.2, 6), S.dark, [0, 0, -0.72], [HP, 0, 0]);
  const cmgLod = new THREE.Group();
  C.build(cmgLod, { shadow: lod < 2, off: D.cmgPivot });
  cmg.add(cmgLod);
  return { hull, tur, gun, cmg };
}

/** Hohes Leitrad des leichten Panzers (1. WK): Stahlring, Holzscheibe, Speichen – dreht (Nahstufe, high/ultra). */
function ftIdler(B, S, x, y, z, seg, lod) {
  if (lod === 0 && rgWheel('ft', x, y, z, 0.42, (BB, cx) => ftIdler(BB, S, cx, 0, 0, seg, lod), true)) return;
  B.add(cyl(0.42, 0.42, 0.32, seg + 2), S.dark, [x, y, z], [0, 0, HP]);
  B.add(cyl(0.36, 0.36, 0.34, seg + 2), S.wood, [x, y, z], [0, 0, HP]);
  if (lod === 0) for (let i = 0; i < 6; i++) { const a = (i / 6) * PI; B.add(box(0.36, 0.05, 0.66), S.dark, [x, y, z], [a, 0, 0]); }
}

/** Kleine Stahlrolle (1. WK, leichter Panzer). */
function addSmallRoller(B, S, x, y, z, r, seg, lod) {
  if (lod === 0 && rgWheel('sr', x, y, z, r, (BB, cx) => addSmallRoller(BB, S, cx, 0, 0, r, seg, lod))) return;
  B.add(cyl(r, r, 0.3, seg), S.dark, [x, y, z], [0, 0, HP]);
  if (lod === 0 && HQ) B.add(cyl(r * 0.35, r * 0.35, 0.34, 6), S.steel, [x, y, z], [0, 0, HP]);
}

/** Schachtellaufwerk-Rolle: schmale Gummibandage, gewölbte Scheibe, Nabe (Achse quer). */
function addDiscWheel(B, S, paint, x, y, z, r, w, seg, lod) {
  if (lod === 0 && rgWheel(`disc${w}`, x, y, z, r, (BB, cx) => addDiscWheel(BB, S, paint, cx, 0, 0, r, w, seg, lod))) return;
  B.add(cyl(r, r, w, seg), S.rubber, [x, y, z], [0, 0, HP]);
  if (lod < 2) {
    B.add(cyl(r * 0.8, r * 0.8, w + 0.02, seg), paint, [x, y, z], [0, 0, HP]);
    if (lod === 0) B.add(cyl(r * 0.22, r * 0.26, w + 0.08, Math.max(6, seg >> 1)), S.dark, [x, y, z], [0, 0, HP]);
  }
}

/**
 * 2. Weltkrieg, Team B – „SP-6 Moloch“ (frei erfunden, Vorbild: deutscher schwerer Panzer 1942): kastenförmige Wanne mit
 * senkrechter, dicker Bugplatte (Fahrersehklappe, Kugelblende rechts, Scheinwerfer oben auf den Ecken), Aufbau über den
 * breiten Ketten, Schachtellaufwerk mit acht großen, verschachtelten Laufrollen je Seite, Motordeck mit Lüftern, zwei
 * Auspufftöpfe mit Blechschutz und Luftfilter am Heck; hufeisenförmiger Turm mit Kommandantenkuppel, Staukasten,
 * Nebelwurfbechern und Ersatzkettengliedern, lange 88-mm-Kanone mit Doppelkammer-Mündungsbremse.
 */
function buildWK2H(lod, S, team) {
  CUR_LOD = lod;
  const D = VEHICLES.wk2h, W = D.wheels;
  const seg = [18, 10, 6][lod];
  const paint = S.paint[team] || S.paint.null;
  const mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  // Wanne unten (zwischen den Ketten, schräge Bugnase), Aufbau über den Ketten (Kasten mit senkrechter Bug- und Heckplatte)
  hullShell(TKIT, B, paint, [[2.55, 0.48], [3.2, 1.04], [-3.05, 1.04], [-2.9, 0.48]], 1.86, lod, { r: 0.04, rs: 0.04 });
  if (HQ && lod < 2) hullShell(TKIT, B, paint, [[3.15, 1.02], [3.15, 1.86], [-3.02, 1.86], [-3.02, 1.02]], 3.4, lod, { r: 0.03, rs: 0.03 });
  else B.add(sideExtrude([[3.15, 1.02], [3.15, 1.86], [-3.02, 1.86], [-3.02, 1.02]], 3.4, lod === 0), paint);
  if (HQ) {
    weld(TKIT, B, paint, [[-1.6, 1.86, -3.14], [1.6, 1.86, -3.14]], lod, 0.012);
    for (const sx of [-1, 1]) { weld(TKIT, B, paint, [[sx * 1.69, 1.86, -3.1], [sx * 1.69, 1.86, 3.0]], lod, 0.012); weld(TKIT, B, paint, [[sx * 1.69, 1.05, -3.14], [sx * 1.69, 1.84, -3.14]], lod, 0.012); }
  }
  // Bug: Fahrersehklappe, Kugelblende (Bug-MG), Scheinwerfer, Abschleppösen; Luke des Funkers, Lüfter dazwischen
  B.add(box(0.46, 0.2, 0.12), paint, [-0.55, 1.62, -3.2]);
  if (lod < 2) B.add(box(0.26, 0.035, 0.03), S.optic, [-0.55, 1.62, -3.265]);
  B.add(cyl(0.2, 0.22, 0.1, seg), paint, [D.cmgPivot[0], D.cmgPivot[1], -3.17], [HP, 0, 0]);
  for (const L of D.lights) B.add(cyl(0.09, 0.1, 0.18, lod < 2 ? Math.max(8, seg) : seg), S.dark, [L[0], L[1], L[2] + 0.1], [HP, 0, 0]);
  if (lod < 2) for (const x of [-0.55, 0.6]) B.add(cyl(0.27, 0.27, 0.05, seg), S.dark, [x, 1.885, -2.35]);
  if (lod < 2) {
    B.add(cyl(0.1, 0.12, 0.08, 8), S.dark, [0.02, 1.9, -2.4]);
    for (const sx of [-1, 1]) {
      B.add(box(0.14, 0.26, 0.16), S.dark, [sx * 0.75, 0.78, -3.0], [0.75, 0, 0]);
      B.add(box(0.72, 0.03, 0.55), paint, [sx * 1.33, 1.03, -3.15]);            // Kotflügel vorn
    }
    // Motordeck: zwei Lüfterabdeckungen, Gitter, Mittelklappe; Heck: Auspuffe mit Schutzblech, Luftfilter, Wagenheber
    for (const sx of [-1, 1]) {
      B.add(cyl(0.34, 0.34, 0.05, seg), S.dark, [sx * 0.95, 1.885, 1.95]);
      B.add(box(0.5, 0.04, 0.8), S.dark, [sx * 0.95, 1.88, 1.05]);
      B.add(cyl(0.08, 0.08, 0.55, 8), S.dark, [sx * 0.42, 1.78, 3.08]);
      B.add(box(0.26, 0.42, 0.06), S.dark, [sx * 0.42, 1.68, 3.14]);
      B.add(cyl(0.15, 0.15, 0.42, Math.max(8, seg)), S.dark, [sx * 1.2, 1.35, 3.14], [0, 0, HP]);
      B.add(box(0.1, 0.07, 0.04), S.rearLamp, [sx * 0.9, 1.75, 3.04]);
    }
    B.add(box(1.0, 0.04, 1.0), S.dark, [0, 1.88, 1.6]);
    B.add(cyl(0.08, 0.08, 0.5, 8), S.dark, [0, 1.25, 3.1], [0, 0, HP]);
    // Seiten: Abschleppseile, Werkzeug, Kettenspanner; Antenne hinten rechts
    for (const sx of [-1, 1]) {
      if (HQ) for (const y of [1.62, 1.5]) towCable(TKIT, B, S, [[sx * 1.715, y, -2.0], [sx * 1.725, y - 0.05, -0.6], [sx * 1.725, y - 0.05, 0.8], [sx * 1.715, y, 2.2]], lod, 0.024);
      else {
        B.add(cyl(0.025, 0.025, 4.2, 6), S.dark, [sx * 1.72, 1.62, 0.1], [HP, 0, 0]);
        B.add(cyl(0.025, 0.025, 4.2, 6), S.dark, [sx * 1.72, 1.52, 0.1], [HP, 0, 0]);
      }
    }
    B.add(box(0.06, 0.06, 1.4), S.canvas, [1.45, 1.89, 0.4]);
    B.add(box(0.05, 0.1, 1.2), S.dark, [-1.45, 1.89, 0.6]);
    B.add(cyl(0.012, 0.012, 2.0, 4), S.dark, [1.4, 2.86, 2.7]);
    if (lod === 0) {
      // Ersatzkettenglieder an der Bugplatte, Hebeösen, Nieten der Lukenringe
      for (let i = 0; i < 6; i++) B.add(box(0.16, 0.3, 0.04), S.dark, [-1.45 + i * 0.18 + (i > 2 ? 1.88 : 0), 1.3, -3.18]);
      for (const [x, z] of [[-1.55, -2.9], [1.55, -2.9], [-1.55, 2.8], [1.55, 2.8]]) B.add(new THREE.TorusGeometry(0.06, 0.02, 4, 8), S.dark, [x, 1.9, z]);
    }
  }
  for (const sx of [-1, 1]) B.add(cyl(0.22, 0.22, 0.02, seg), mark, [sx * 1.71, 1.26, -1.5], [0, 0, HP]);
  B.add(cyl(0.18, 0.18, 0.02, seg), mark, [0, 1.62, 3.03], [HP, 0, 0]);
  if (lod === 0 && DET > 0) {
    // Luftfilter-Rohre zum Motordeck, Lüfterabdeckungen mit Gitterkreuz, Löcher der Fahrer-Doppelsehrohre über der Sehklappe
    for (const sx of [-1, 1]) {
      B.add(cyl(0.05, 0.05, 0.6, 8), S.dark, [sx * 1.12, 1.66, 3.07], [0.3, 0, 0]);
      for (const r of [0, HP]) B.add(box(0.66, 0.025, 0.04), S.dark, [sx * 0.95, 1.915, 1.95], [0, r, 0]);
    }
    for (const x of [-0.66, -0.44]) B.add(cyl(0.035, 0.035, 0.03, 8), S.dark, [x, 1.79, -3.16], [HP, 0, 0]);
    if (DET === 2) {
      // verzahnte Plattenstöße an den Bugecken, Lamellen der Ansauggitter, Werkzeug (Axt, Spaten) vorn rechts
      for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) B.add(box(0.07, 0.09, 0.05), paint, [sx * (1.68 - (i % 2) * 0.05), 1.12 + i * 0.17, -3.17]);
      for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) B.add(box(0.5, 0.03, 0.035), paint, [sx * 0.95, 1.905, 0.73 + i * 0.16]);
      B.add(box(0.05, 0.035, 0.9), S.wood, [1.25, 1.88, -2.0]); B.add(box(0.22, 0.04, 0.08), S.dark, [1.25, 1.885, -2.45]);
      B.add(box(0.05, 0.035, 0.9), S.wood, [1.05, 1.88, -2.0]); B.add(box(0.16, 0.04, 0.2), S.dark, [1.05, 1.885, -2.5]);
    }
  }
  // Schachtellaufwerk: acht Achsen, Rollen abwechselnd außen/innen (überlappend), Triebrad vorn hoch, Leitrad hinten
  for (const sx of [-1, 1]) {
    const x = sx * W.x;
    if (lod < 2) for (let i = 0; i < 8; i++) {
      const z = -2.38 + i * 0.68, outer = i % 2 === 0;
      addDiscWheel(B, S, paint, x + sx * (outer ? 0.2 : 0.02), 0.44, z, 0.4, 0.12, lod === 0 ? 14 : 6, lod === 1 && !outer ? 2 : lod);
      if (lod === 0 && !outer && DET > 0) addDiscWheel(B, S, paint, x - sx * 0.2, 0.44, z, 0.4, 0.12, 10, 2); // innerste Reihe (kaum sichtbar)
    } else for (const z of [-1.7, 0, 1.7]) B.add(cyl(0.4, 0.4, 0.7, seg), S.rubber, [x, 0.44, z], [0, 0, HP]);
    if (HQ) { sprocket(TKIT, B, S, paint, x, 0.52, -2.95, 0.34, 0.6, 18, lod); idler(TKIT, B, S, paint, x, 0.48, 2.95, 0.32, 0.56, lod, 8); }
    else {
      B.add(cyl(0.34, 0.34, 0.6, seg), S.dark, [x, 0.52, -2.95], [0, 0, HP]);
      B.add(cyl(0.32, 0.32, 0.56, seg), S.dark, [x, 0.48, 2.95], [0, 0, HP]);
    }
  }
  B.build(hull, { shadow: true });
  addTracks(hull, trackPathFor(lod, -2.45, 2.45, [-2.95, 0.52, 0.34], [2.95, 0.48, 0.32], [2.38, 1.7, 1.02, 0.34, -0.34, -1.02, -1.7, -2.38].map((z) => [z, 0.84]), 0.012), W.x, 0.72);
  addLenses(hull, D, seg, 0.08);

  // Turm: Hufeisen (senkrechte Wände, flaches Dach), Stirnplatte vorn – Drehpunkt D.turretPivot
  const tur = new THREE.Group();
  const T = new Bucket();
  {
    const foot = [[-0.98, 1.2], [0.98, 1.2], [1.1, 0.8], [1.12, 0.0], [1.08, -0.6], [0.95, -1.0], [0.7, -1.25], [0.35, -1.38], [0, -1.42], [-0.35, -1.38], [-0.7, -1.25], [-0.95, -1.0], [-1.08, -0.6], [-1.12, 0.0], [-1.1, 0.8]];
    // gebogene Seitenplatte (Hufeisen) als Unterteilungsfläche: weiche Rundung hinten, gerundete Dach- und Stirnkanten
    if (HQ && lod < 2) T.add(armorShell(stackRings([[0, foot], [0.82, foot]], { r: 0.03, rTop: 0.035, rBot: 0.03, soft: [4, 5, 6, 7, 8, 9, 10, 11, 12] }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0 }), paint);
    else T.add(topExtrude(foot, 0.82, lod === 0), paint);
  }
  T.add(cyl(1.05, 1.08, 0.1, lod < 2 ? seg + 4 : seg), S.dark, [0, -0.03, 0]);
  // Kommandantenkuppel (Trommel mit Sehschlitzen), Ladeschützenluke, Lüfter, Fluchtluke rechts, Staukasten, Nebelwurfbecher
  T.add(cyl(0.36, 0.37, 0.2, seg), paint, [-0.5, 0.91, 0.7]);
  T.add(cyl(0.26, 0.26, 0.04, seg), S.dark, [0.5, 0.84, 0.3]);
  if (lod < 2) {
    // Staukasten am Turmheck: folgt der Rundung des Turms
    T.add(topExtrude([[-0.8, -1.2], [0.8, -1.2], [0.78, -1.55], [0.55, -1.8], [0, -1.88], [-0.55, -1.8], [-0.78, -1.55]], 0.46, lod === 0 && DET > 0), paint, [0, 0.2, 0]);
    if (lod === 0) T.add(box(0.08, 0.07, 0.04), S.dark, [0, 0.55, 1.9]);
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) T.add(cyl(0.045, 0.045, 0.24, 8), S.dark, [sx * (1.16 + i * 0.01), 0.7, -0.75 + i * 0.12], [-0.7, 0, sx * 0.5]);
    T.add(cyl(0.2, 0.2, 0.02, seg), paint, [1.11, 0.42, 0.45], [0, 0, HP]);
  }
  if (lod === 0) {
    const nv = DET === 2 ? 6 : 4;
    for (let i = 0; i < nv; i++) { const a = (i / nv) * PI * 2; T.add(box(0.12, 0.05, 0.04), S.optic, [-0.5 + Math.sin(a) * 0.365, 0.94, 0.7 + Math.cos(a) * 0.365], [0, a, 0]); }
    T.add(cyl(0.11, 0.12, 0.06, 8), S.dark, [0.45, 0.84, -0.55]);
    for (let i = 0; i < 4; i++) T.add(box(0.04, 0.32, 0.2), S.dark, [-1.13, 0.42, 0.05 + i * 0.22]);
    for (const sx of [-1, 1]) T.add(new THREE.TorusGeometry(0.06, 0.018, 4, 8), S.dark, [sx * 0.9, 0.86, -0.85]);
    T.add(cyl(0.39, 0.39, 0.025, seg), S.dark, [-0.5, 1.0, 0.7]);                          // Regenrinne der Kuppel
    if (DET === 2) for (const [x, z] of [[-0.85, -0.7], [0.85, -0.7], [0.95, 0.25], [-0.95, 0.15], [0, 1.25]]) T.add(cyl(0.05, 0.055, 0.14, 8), S.dark, [x, 0.89, z]); // Minenwerfer
  }
  for (const sx of [-1, 1]) T.add(cyl(0.16, 0.16, 0.02, seg), mark, [sx * 1.125, 0.45, -0.35], [0, 0, HP]);
  const turLod = new THREE.Group();
  T.build(turLod, { off: D.turretPivot });
  tur.add(turLod);

  // Kanone: breite Walzenblende mit Optik- und MG-Öffnung, Rohrwiege, langes Rohr, Doppelkammer-Mündungsbremse
  const gun = new THREE.Group();
  const Gb = new Bucket();
  // Walzenblende: gewölbte Stirnplatte (Zylinderausschnitt quer zum Rohr)
  Gb.add(new THREE.CylinderGeometry(0.55, 0.55, 1.3, lod === 0 ? 10 : 6, 1, false, PI - 0.7, 1.4), paint, [0, 0, 0.35], [0, 0, HP]);
  if (lod < 2) Gb.add(cyl(0.16, 0.18, 0.5, seg), paint, [0, 0, -0.45], [HP, 0, 0]);
  if (lod === 0) for (const x of [-0.3, -0.18]) Gb.add(box(0.06, 0.06, 0.04), S.optic, [x, 0.1, -0.215]);
  // Rohr mit Absatz (dickes hinteres, schlankeres vorderes Stück)
  Gb.add(cyl(0.095, 0.088, 1.5, seg), paint, [0, 0, -1.4], [HP, 0, 0]);
  Gb.add(cyl(0.078, 0.072, 2.15, seg), paint, [0, 0, -3.2], [HP, 0, 0]);
  if (lod < 2 && DET > 0) Gb.add(cyl(0.093, 0.093, 0.06, seg), paint, [0, 0, -2.15], [HP, 0, 0]);
  Gb.add(cyl(0.115, 0.115, 0.28, seg), S.dark, [0, 0, -4.15], [HP, 0, 0]);
  if (lod === 0) for (const z of [-4.07, -4.23]) Gb.add(box(0.26, 0.26, 0.035), S.dark, [0, 0, z]);
  if (lod < 2) Gb.add(cyl(0.022, 0.022, 0.2, 6), S.dark, [D.coax[0], D.coax[1], -0.25], [HP, 0, 0]);
  const gunLod = new THREE.Group();
  Gb.build(gunLod, { off: [D.turretPivot[0] + D.gunPivot[0], D.turretPivot[1] + D.gunPivot[1], D.turretPivot[2] + D.gunPivot[2]] });
  gun.add(gunLod);

  // Bug-MG in der Kugelblende (Wannenraum)
  const cmg = new THREE.Group();
  const C = new Bucket();
  C.add(sph(0.13, seg), paint, [0, 0, -0.06]);
  C.add(cyl(0.032, 0.032, 0.36, 8), S.dark, [0, 0, -0.3], [HP, 0, 0]);
  if (lod < 2) C.add(cyl(0.015, 0.015, 0.6, 6), S.dark, [0, 0, -0.42], [HP, 0, 0]);
  const cmgLod = new THREE.Group();
  C.build(cmgLod, { shadow: lod < 2, off: D.cmgPivot });
  cmg.add(cmgLod);
  return { hull, tur, gun, cmg };
}

/**
 * 1. Weltkrieg, Team A – „LK-17 Libelle“ (frei erfunden, Vorbild: französischer leichter Panzer 1917): schmale Wanne mit
 * Fahrerklappen vorn, hohes Leitrad vorn (Grabenüberschreitung), Laufwerk hinter Seitenträgern, Grabenschwanz am Heck,
 * Motordeck mit Lüftungsschlitzen, Schalldämpfer rechts; genieteter Achteckturm mit Sehschlitzen, Pilz-Lüfterhaube und
 * Hecktür, kurze 37-mm-Kanone in Kugelblende.
 */
function buildWK1L(lod, S, team) {
  CUR_LOD = lod;
  const D = VEHICLES.wk1l, W = D.wheels;
  const seg = [16, 10, 6][lod];
  const paint = S.paint[team] || S.paint.null;
  const mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  // Wanne (Seitenprofil): Bug mit Fahrerklappen, flaches Dach unter dem Turm, schräges Motordeck nach hinten
  if (HQ && lod < 2) hullShell(TKIT, B, paint, [[1.55, 0.4], [1.98, 0.9], [1.98, 1.18], [1.62, 1.55], [-0.05, 1.55], [-1.75, 1.2], [-1.95, 0.75], [-1.7, 0.4]], 0.98, lod, { r: 0.025, rs: 0.025 });
  else B.add(sideExtrude([[1.55, 0.4], [1.98, 0.9], [1.98, 1.18], [1.62, 1.55], [-0.05, 1.55], [-1.75, 1.2], [-1.95, 0.75], [-1.7, 0.4]], 0.98, lod === 0), paint);
  // Seitenträger des Laufwerks (verdecken die kleinen Rollen; Kette läuft oben darüber)
  for (const sx of [-1, 1]) B.add(sideExtrude([[1.45, 0.26], [1.72, 0.55], [1.5, 0.86], [-1.45, 0.86], [-1.7, 0.55], [-1.45, 0.26]], 0.05), paint, [sx * (W.x + 0.2), 0, 0]);
  // Fahrerklappen (zweiteilig) mit Sehschlitzen, Scheinwerfer
  B.add(box(0.7, 0.3, 0.04), S.dark, [0, 1.05, -1.99]);
  B.add(box(0.7, 0.04, 0.42), paint, [0, 1.38, -1.82], [0.72, 0, 0]);
  if (lod < 2) for (const x of [-0.18, 0.18]) B.add(box(0.16, 0.025, 0.03), S.optic, [x, 1.1, -2.02]);
  for (const L of D.lights) B.add(cyl(0.06, 0.07, 0.1, Math.max(8, seg)), S.dark, [L[0], L[1], L[2] + 0.06], [HP, 0, 0]);
  if (lod < 2) {
    // Motordeck: Lüftungsschlitze, Klappen; Schalldämpfer rechts, Rücklicht
    for (let i = 0; i < 5; i++) B.add(box(0.8, 0.03, 0.06), S.dark, [0, 1.47 - i * 0.065, 0.35 + i * 0.32], [-0.2, 0, 0]);
    B.add(cyl(0.09, 0.09, 1.0, 8), S.dark, [0.56, 1.25, 0.9], [HP, 0, 0]);
    B.add(box(0.08, 0.06, 0.04), S.rearLamp, [-0.3, 0.9, 1.94]);
    // Grabenschwanz: zwei Holme mit Querrohr und Kufe
    for (const sx of [-1, 1]) B.add(box(0.06, 0.08, 0.95), S.dark, [sx * 0.34, 0.75, 2.3], [-0.45, 0, 0]);
    B.add(cyl(0.035, 0.035, 0.74, 6), S.dark, [0, 0.55, 2.7], [0, 0, HP]);
    B.add(box(0.75, 0.04, 0.2), S.dark, [0, 0.52, 2.74], [0.3, 0, 0]);
    // Werkzeug, Nieten an den Seitenträgern
    B.add(box(0.05, 0.06, 0.9), S.canvas, [-0.5, 1.4, 0.5]);
    if (lod === 0) for (const sx of [-1, 1]) for (const y of DET === 2 ? [0.8, 0.34] : [0.8]) for (let i = 0; i < 8; i++) B.add(box(0.03, 0.03, 0.03), S.dark, [sx * (W.x + 0.23), y, -1.3 + i * 0.37]);
    // Spannfeder der Kette zwischen Leitrad und Träger, Lüftungsschlitze am Motorraum, Fahrerklappen (Fuge, Scharniere, Sehschlitze)
    for (const sx of [-1, 1]) B.add(cyl(0.05, 0.05, 0.42, 8), S.dark, [sx * W.x, 0.98, -1.42], [HP, 0, 0]);
    if (lod === 0) {
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) B.add(box(0.02, 0.025, 0.5), S.dark, [sx * 0.495, 1.0 + i * 0.06, 1.05]);
      B.add(box(0.02, 0.3, 0.02), S.dark, [0, 1.05, -2.0]);
      for (const sx of [-1, 1]) B.add(cyl(0.02, 0.02, 0.28, 6), S.dark, [sx * 0.36, 1.05, -2.0]);
      for (const x of [-0.15, 0, 0.15]) B.add(box(0.08, 0.02, 0.03), S.optic, [x, 1.4, -1.84], [0.72, 0, 0]);
      if (DET === 2) for (const sx of [-1, 1]) for (let i = 0; i < 8; i++) B.add(box(0.025, 0.025, 0.025), S.dark, [sx * 0.495, 1.5, -1.5 + i * 0.2]); // Nieten der Dachkante
    }
  }
  for (const sx of [-1, 1]) B.add(cyl(0.16, 0.16, 0.02, seg), mark, [sx * 0.5, 1.25, 0.55], [0, 0, HP]);
  // Laufwerk: viele kleine Rollen (hinter den Trägern), großes Leitrad vorn (Speichen aus Holz), Triebrad hinten
  for (const sx of [-1, 1]) {
    const x = sx * W.x;
    if (lod < 2) for (let i = 0; i < 9; i++) addSmallRoller(B, S, x, 0.165, -1.25 + i * 0.32, 0.13, lod === 0 ? 10 : 6, lod);
    ftIdler(B, S, x, 0.78, -1.85, seg, lod);
    if (HQ) sprocket(TKIT, B, S, paint, x, 0.48, 1.75, 0.3, 0.32, 9, lod);
    else B.add(cyl(0.3, 0.3, 0.32, seg), S.dark, [x, 0.48, 1.75], [0, 0, HP]);
  }
  B.build(hull, { shadow: true });
  addTracks(hull, trackPathFor(lod, -1.3, 1.45, [-1.85, 0.78, 0.42], [1.75, 0.48, 0.3], [[1.2, 0.86], [-1.2, 0.86]], 0.01), W.x, 0.32);
  addLenses(hull, D, seg, 0.05);

  // Turm: genietetes Achteck, Pilz-Lüfterhaube oben, Sehschlitze, Hecktür
  const tur = new THREE.Group();
  const T = new Bucket();
  const oct = [];
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * PI * 2; oct.push([Math.sin(a) * 0.56, Math.cos(a) * 0.56]); }
  // genietetes Achteck mit gerundeten Kanten (Unterteilungsfläche, Stützpunkte je Ecke) ab medium
  if (HQ && lod < 2) T.add(armorShell(stackRings([[0, oct], [0.62, insetPoly(oct, 0.025)]], { r: 0.035, rTop: 0.03, rBot: 0.03 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0 }), paint);
  else T.add(topExtrude(oct, 0.62, lod === 0), paint);
  T.add(cyl(0.52, 0.54, 0.06, seg), S.dark, [0, -0.02, 0]);
  T.add(cyl(0.2, 0.24, 0.08, seg), paint, [0, 0.66, 0.05]);
  T.add(new THREE.SphereGeometry(0.25, Math.max(8, seg), 4, 0, PI * 2, 0, HP * 0.7), paint, [0, 0.62, 0.05]);
  if (lod < 2) {
    for (const k of [0, 1, 7, 2, 6]) { const a = k * PI / 4; T.add(box(0.14, 0.025, 0.03), S.optic, [Math.sin(a) * 0.525, 0.46, -Math.cos(a) * 0.525], [0, -a, 0]); }
    T.add(box(0.36, 0.42, 0.03), S.dark, [0, 0.3, 0.53]);
  }
  if (lod === 0 && DET > 0) for (let i = 0; i < 8; i++) for (const y of [0.08, 0.56]) { const a = i / 8 * PI * 2; T.add(box(0.025, 0.025, 0.025), S.dark, [Math.sin(a) * 0.52, y, Math.cos(a) * 0.52]); }
  const turLod = new THREE.Group();
  T.build(turLod, { off: D.turretPivot });
  tur.add(turLod);

  // Kanone: Kugelblende, kurzes 37-mm-Rohr mit Mündungsring, Rohrbremse darunter, Zielfernrohr rechts
  const gun = new THREE.Group();
  const Gb = new Bucket();
  Gb.add(sph(0.16, seg), paint, [0, 0, -0.02]);
  Gb.add(cyl(0.038, 0.032, 0.66, seg), S.dark, [0, 0, -0.44], [HP, 0, 0]);
  Gb.add(cyl(0.045, 0.045, 0.05, seg), S.dark, [0, 0, -0.75], [HP, 0, 0]);
  if (lod < 2) {
    Gb.add(cyl(0.03, 0.03, 0.32, 8), S.dark, [0, -0.07, -0.26], [HP, 0, 0]);
    Gb.add(cyl(0.022, 0.022, 0.22, 6), S.dark, [0.13, 0.06, -0.2], [HP, 0, 0]);
  }
  const gunLod = new THREE.Group();
  Gb.build(gunLod, { off: [D.turretPivot[0] + D.gunPivot[0], D.turretPivot[1] + D.gunPivot[1], D.turretPivot[2] + D.gunPivot[2]] });
  gun.add(gunLod);
  // kein zweites MG (Kanonenausführung) – leere Gruppe hält den Aufbau gleich
  return { hull, tur, gun, cmg: new THREE.Group() };
}

const TANK_BUILDERS = { mbt: buildMBT, wk2: buildWK2, wk1: buildWK1, wk2h: buildWK2H, wk1l: buildWK1L };

/** Baukasten für models-tanks.js (weitere Panzer + gemeinsame Anbauteile, Nutzer 15.11.). */
const TKIT = {
  Bucket, box, cyl, sph, sideExtrude, topExtrude, inward, addTracks, trackPathFor, addLenses, addRoadWheel, addRoadWheelHQ, addDiscWheel, rgWheel, markingMaterial, VEHICLES,
  get HQ() { return HQ; }, get DET() { return DET; },
  setLod(l) { CUR_LOD = l; },
};
/** Baukasten der Truppentransporter (models-troop.js): Panzer-Baukasten + Reifen. */
const TRKIT = Object.create(TKIT, { tireGeometry: { value: (...a) => tireGeometry(...a) } });
function tankBuilder(model) {
  if (TANK_BUILDERS[model]) return (l, S, team) => TANK_BUILDERS[model](l, S, team);
  if (NEW_TANK_BUILDERS[model]) return (l, S, team) => NEW_TANK_BUILDERS[model](l, S, team, TKIT);
  if (HEAVY_BUILDERS[model]) return (l, S, team) => HEAVY_BUILDERS[model](l, S, team, TKIT); // leichte/schwere Panzer, MTW (20.11.)
  return (l, S, team) => buildMBT(l, S, team);
}

function tireGeometry(r, w, seg, tread = false) {
  if (tread) return treadTire(r, w);
  const pts = [[r * 0.62, -w / 2], [r * 0.86, -w * 0.52], [r * 0.97, -w * 0.4], [r, 0], [r * 0.97, w * 0.4], [r * 0.86, w * 0.52], [r * 0.62, w / 2]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, seg);
  return g;
}

/** env-look: Geländereifen mit Stollenprofil (versetzte Blöcke, Schulterstollen) – Lathe mit 48 Segmenten, die
 * Laufflächen-Ringe nach Winkel ausgelenkt. */
function treadTire(r, w) {
  const prof = [[0.62, -0.5], [0.86, -0.52], [0.95, -0.44], [0.985, -0.3], [1, -0.12], [1, 0.12], [0.985, 0.3], [0.95, 0.44], [0.86, 0.52], [0.62, 0.5]];
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(r * x, w * y)), 48);
  const P = g.attributes.position;
  const lugs = 16;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), rad = Math.hypot(x, z);
    if (rad < r * 0.94) continue;
    const a = Math.atan2(z, x), side = y < 0 ? 0 : 0.5;
    const on = Math.sin((a * lugs) / 1 + side * PI * 2 + (Math.abs(y) > w * 0.25 ? 0.6 : 0)) > 0 ? 1 : 0;
    const k = (rad + on * r * 0.045) / rad;
    P.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** env-look: Geländewagen – Seilwinde, Abschleppösen, Blinker, Scheinwerferringe, Wischer, Außenspiegel, Antenne,
 * Trittbretter, Kotflügelverbreiterungen, Rammschutz, Planenrolle, Schmutzfänger; high: Munitionskisten, Spaten,
 * Anhängerkupplung, Scheinwerfergitter. Nur HQ (medium+). */
function jeepDetail(B, S, paint, lod, seg, hqb = false) {
  const D = VEHICLES.jeep;
  if (lod < 2 && !hqb) {
    for (const sx of [-1, 1]) {
      B.add(box(0.06, 0.06, 1.6), paint, [sx * 0.96, 0.66, 0.35]);                  // Trittbrett
      B.add(box(0.08, 0.06, 1.1), S.rubber, [sx * 1.0, 1.0, -1.47]);               // Kotflügelverbreiterung
      B.add(box(0.07, 0.05, 0.04), S.lensOff, [sx * 0.88, 0.86, -2.4]);             // Blinker
    }
  }
  if (lod < 2) B.add(cyl(0.09, 0.09, 0.62, Math.max(8, seg >> 1)), S.dark, [0, 0.56, -2.62], [0, 0, HP]); // Seilwinde
  if (lod === 0) {
    for (const sx of [-1, 1]) B.add(new THREE.TorusGeometry(0.06, 0.016, 4, 10), S.dark, [sx * 0.62, 0.48, -2.6], [0, HP, 0]); // Ösen
    if (!hqb) for (const L of D.lights) B.add(new THREE.TorusGeometry(0.125, 0.015, 4, 16), S.dark, [L[0], L[1], L[2] - 0.03]);
    for (const sx of [-1, 1]) {
      B.add(box(0.5, 0.012, 0.02), S.dark, [sx * 0.42, 1.31, -0.96], [0, 0, sx * 0.25]); // Wischer
      if (hqb) continue;
      B.add(cyl(0.01, 0.01, 0.3, 4), S.dark, [sx * 0.98, 1.62, -0.92], [0, 0, sx * 1.1]); // Spiegelarm
      B.add(box(0.03, 0.16, 0.12), S.dark, [sx * 1.1, 1.7, -0.92]);
      B.add(box(0.005, 0.13, 0.1), S.glass, [sx * 1.118, 1.7, -0.92]);
    }
    B.add(cyl(0.008, 0.008, 1.8, 4), S.dark, [-0.86, 2.0, 2.1]);                     // Antenne
    B.add(cyl(0.03, 0.035, 0.08, 6), S.dark, [-0.86, 1.1, 2.1]);
  }
  // Rammschutz vor dem Grill, Planenrolle auf der Heckwand, Schmutzfänger hinten
  if (lod < 2) {
    const rs = lod === 0 ? 8 : 5;
    for (const sx of [-1, 1]) B.add(cyl(0.025, 0.025, 0.62, rs), S.dark, [sx * 0.42, 0.9, -2.6]);
    for (const y of [0.74, 1.18]) B.add(cyl(0.025, 0.025, 0.9, rs), S.dark, [0, y, -2.6], [0, 0, HP]);
    B.add(cyl(0.085, 0.085, 1.5, lod === 0 ? 10 : 6), S.canvas, [0, 1.43, 2.1], [0, 0, HP]);
    for (const sx of [-1, 1]) B.add(box(0.32, 0.34, 0.02), S.rubber, [sx * 0.86, 0.56, 1.92]);
  }
  if (lod === 0 && DET === 2) {
    // Gurte der Planenrolle, Munitionskisten neben dem MG-Sockel, Spaten am Seitenblech, Anhängerkupplung,
    // Schutzgitter der Scheinwerfer, Haubenverschlüsse
    for (const x of [-0.5, 0.5]) B.add(box(0.04, 0.19, 0.19), S.dark, [x, 1.43, 2.1]);
    for (const sx of [-1, 1]) { B.add(box(0.3, 0.2, 0.18), S.dark, [sx * 0.42, 1.02, 0.95]); B.add(box(0.06, 0.03, 0.12), S.dark, [sx * 0.42, 1.135, 0.95]); }
    B.add(cyl(0.016, 0.016, 0.9, 6), S.canvas, [0.97, 1.16, 0.75], [HP, 0, 0]);
    B.add(box(0.02, 0.2, 0.16), S.dark, [0.97, 1.16, 1.26]);
    B.add(box(0.14, 0.08, 0.16), S.dark, [0, 0.56, 2.4]);
    B.add(new THREE.TorusGeometry(0.045, 0.014, 4, 8), S.dark, [0, 0.56, 2.5], [HP, 0, 0]);
    for (const L of D.lights) for (const dx of [-0.07, 0, 0.07]) B.add(box(0.012, 0.24, 0.012), S.dark, [L[0] + dx, L[1], L[2] - (hqb ? 0.2 : 0.1)]);
    if (!hqb) for (const sx of [-1, 1]) B.add(box(0.05, 0.06, 0.08), S.dark, [sx * 0.82, 1.12, -1.7]);
  }
}

function buildJeep(lod, S, team) {
  CUR_LOD = lod;
  const D = VEHICLES.jeep;
  const seg = [18, 11, 6][lod];
  const paint = S.paint[team] || S.paint.null;
  const mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  // Nutzer 14.11.: Detailkarosserie ab medium in den Nahstufen (models-jeep.js); low und Fernstufe wie bisher
  const hqb = HQ && lod < 2;
  if (hqb) jeepBodyHQ({ B, box, cyl, sideExtrude }, S, paint, DET === 2 ? lod : 1);
  else {
  // Rahmen
  for (const sx of [-1, 1]) B.add(box(0.12, 0.16, 4.3), S.dark, [sx * 0.5, 0.52, 0]);
  // Motorhaube + Front
  B.add(sideExtrude([[0.9, 0.66], [0.9, 1.2], [2.2, 1.13], [2.36, 1.05], [2.36, 0.64]], 1.72, lod === 0), paint);
  // Wanne: Boden, Seiten, Heck, Spritzwand, Armaturenbrett
  B.add(box(1.86, 0.08, 3.06), paint, [0, 0.88, 0.63]);
  for (const sx of [-1, 1]) {
    B.add(box(0.06, 0.48, 3.06), paint, [sx * 0.93, 1.1, 0.63]);
    B.add(box(0.36, 0.05, 1.15), paint, [sx * 0.88, 0.99, -1.47]);            // Kotflügel vorn
    B.add(box(0.36, 0.05, 0.5), paint, [sx * 0.88, 0.9, -2.15], [-0.45, 0, 0]);
    B.add(box(0.32, 0.26, 0.95), paint, [sx * 0.76, 1.03, 1.38]);              // Radkasten hinten
  }
  B.add(box(1.86, 0.48, 0.06), paint, [0, 1.1, 2.15]);
  B.add(box(1.86, 0.5, 0.08), paint, [0, 1.05, -0.88]);
  B.add(box(1.8, 0.06, 0.32), S.interior, [0, 1.28, -0.75]);
  // Grill, Stoßstangen, Rücklichter
  B.add(box(1.3, 0.4, 0.05), S.dark, [0, 0.86, -2.38]);
  if (lod === 0) for (let i = 0; i < 7; i++) B.add(box(0.05, 0.36, 0.04), paint, [-0.45 + i * 0.15, 0.86, -2.41]);
  B.add(box(2.0, 0.16, 0.18), S.dark, [0, 0.56, -2.48]);
  B.add(box(1.9, 0.14, 0.14), S.dark, [0, 0.62, 2.28]);
  for (const sx of [-1, 1]) B.add(box(0.1, 0.12, 0.03), S.rearLamp, [sx * 0.78, 1.1, 2.19]);
  for (const L of D.lights) B.add(cyl(0.12, 0.12, 0.12, seg), S.dark, [L[0], L[1], L[2] + 0.04], [HP, 0, 0]);
  // Windschutzscheibe (Rahmen + Glas), Überrollbügel
  for (const sx of [-1, 1]) B.add(box(0.05, 0.55, 0.05), S.dark, [sx * 0.86, 1.52, -0.92]);
  B.add(box(1.77, 0.05, 0.05), S.dark, [0, 1.8, -0.92]);
  B.add(box(1.77, 0.05, 0.05), S.dark, [0, 1.26, -0.92]);
  for (const sx of [-1, 1]) {
    B.add(cyl(0.035, 0.035, 1.0, 8), S.dark, [sx * 0.86, 1.6, 0.3]);
    B.add(cyl(0.03, 0.03, 1.9, 8), S.dark, [sx * 0.86, 1.62, 1.15], [1.08, 0, 0]);
  }
  B.add(cyl(0.035, 0.035, 1.72, 8), S.dark, [0, 2.1, 0.3], [0, 0, HP]);
  }
  // Sitze, Lenkrad (env-look LOD0: gepolsterte Kissen mit gerundeten Kanten)
  const seat = (w, h, d, pos, rot) => {
    if (HQ && lod === 0) { const g = topExtrude([[-w / 2 + 0.04, d / 2 - 0.04], [w / 2 - 0.04, d / 2 - 0.04], [w / 2 - 0.04, -d / 2 + 0.04], [-w / 2 + 0.04, -d / 2 + 0.04]], h - 0.08, true); g.translate(0, -h / 2 + 0.04, 0); B.add(g, S.canvas, pos, rot); }
    else B.add(box(w, h, d), S.canvas, pos, rot);
  };
  for (const sx of [-1, 1]) {
    seat(0.5, 0.14, 0.5, [sx * 0.46, 1.0, -0.1]);
    seat(0.5, 0.56, 0.1, [sx * 0.46, 1.3, 0.18], [-0.12, 0, 0]);
  }
  seat(1.5, 0.14, 0.5, [0, 1.0, 1.6]);
  seat(1.5, 0.5, 0.1, [0, 1.28, 1.9], [-0.1, 0, 0]);
  let extra = null;
  if (lod === 1) B.add(new THREE.TorusGeometry(0.18, 0.022, 6, seg), S.dark, [-0.46, 1.48, -0.6], [-0.95, 0, 0]);
  if (lod < 2) B.add(cyl(0.022, 0.022, 0.5, 6), S.dark, [-0.46, 1.32, -0.75], [-0.95 + HP, 0, 0]);
  if (lod === 0) {
    // Lenkrad dreht mit dem Einschlag (vehicle.js sync, wie bei den Zivilfahrzeugen): Kranz, drei Speichen, Hupenknopf
    const outer = new THREE.Group();
    outer.name = 'lenkrad';
    outer.position.set(-0.46, 1.48, -0.6);
    outer.rotation.x = -0.95;
    const inner = new THREE.Group();
    inner.name = 'lenkrad:dreh';
    const LB = new Bucket();
    LB.add(new THREE.TorusGeometry(0.18, 0.02, 8, seg + 4), S.rubber);
    LB.add(cyl(0.045, 0.05, 0.05, 12), S.dark, [0, 0, 0.01], [HP, 0, 0]);
    LB.add(cyl(0.028, 0.028, 0.012, 10), S.steel, [0, 0, 0.04], [HP, 0, 0]);
    for (const a of [0, PI, -HP]) LB.add(box(0.13, 0.026, 0.012), S.dark, [Math.cos(a) * 0.105, Math.sin(a) * 0.105, 0], [0, 0, a]);
    LB.build(inner, { shadow: true });
    outer.add(inner);
    extra = [outer];
  }
  // MG-Sockel
  B.add(cyl(0.06, 0.08, 0.9, 10), S.dark, [D.mgPivot[0], 1.42, D.mgPivot[2]]);
  // Ersatzrad, Kanister
  if (lod < 2) {
    B.add(tireGeometry(0.4, 0.28, seg, HQ && lod === 0), S.rubber, [0.45, 1.25, 2.33], [HP, 0, 0]);
    B.add(cyl(0.24, 0.24, 0.29, seg), S.dark, [0.45, 1.25, 2.33], [HP, 0, 0]);
  }
  if (lod === 0) for (const sx of [-1, 1]) B.add(box(0.16, 0.44, 0.32), sx < 0 ? paint : S.dark, [sx * -0.55 - 0.1, 1.2, 2.3]);
  // Kennung
  B.add(cyl(0.24, 0.24, 0.015, seg), mark, [0, hqb ? 1.214 : 1.165, -1.62], [0.05, 0, 0]);
  B.add(cyl(0.15, 0.15, 0.015, seg), mark, [-0.5, 1.12, hqb ? 2.224 : 2.186], [HP, 0, 0]);
  if (HQ) jeepDetail(B, S, paint, lod, seg, hqb);
  B.build(hull, { shadow: true });
  if (HQ && lod < 2) {
    const MK = new Bucket();
    for (const sx of [-1, 1]) MK.add(new THREE.PlaneGeometry(0.5, 0.125), markingMaterial(team), [sx * 0.946, 0.95, -1.62], [0, sx * HP, 0], null, { keepUV: true });
    MK.build(hull, { shadow: false });
  }
  // Glas
  const GB = new Bucket();
  GB.add(box(1.66, 0.5, 0.015), S.glass, [0, 1.53, -0.92], [-0.08, 0, 0]);
  GB.build(hull, { shadow: false });
  const LB = new Bucket();
  for (const L of D.lights) LB.add(cyl(0.1, 0.1, 0.03, seg), S.lensOff, [L[0], L[1], L[2] - (hqb ? 0.165 : 0.03)], [HP, 0, 0], null, { tag: { lens: true } });
  LB.build(hull, { shadow: false });

  // MG (eigene Lafette)
  const mg = new THREE.Group();
  const M = new Bucket();
  M.add(box(0.16, 0.2, 0.78), S.dark, [0, 0.08, -0.12]);
  M.add(cyl(0.028, 0.028, 1.0, 8), S.dark, [0, 0.1, -0.85], [HP, 0, 0]);
  M.add(cyl(0.048, 0.048, 0.5, 10), S.dark, [0, 0.1, -0.68], [HP, 0, 0]);
  M.add(box(0.14, 0.2, 0.3), paint, [-0.17, 0.06, -0.08]);
  M.add(box(0.72, 0.46, 0.03), paint, [0, 0.12, -0.42]);
  M.add(box(0.05, 0.12, 0.05), S.dark, [-0.08, 0.06, 0.3]);
  M.add(box(0.05, 0.12, 0.05), S.dark, [0.08, 0.06, 0.3]);
  M.add(box(0.12, 0.1, 0.14), S.dark, [0, -0.06, 0.05]);
  const mgLod = new THREE.Group();
  M.build(mgLod, { shadow: lod < 2, off: D.mgPivot });
  mg.add(mgLod);

  // Räder (eigene Drehpunkte)
  const wheels = [];
  const W = D.wheels;
  W.z.forEach((z, axle) => {
    for (const sx of [-1, 1]) {
      const spin = new THREE.Group();
      const R = new Bucket();
      if (hqb && lod === 0) {
        jeepWheelHQ(R, { box, cyl }, S, paint, W.radius, sx, DET === 2 ? lod : 1);
        R.build(spin, { shadow: true, off: [sx * W.x, W.radius, z] });
        wheels.push({ spin, axle, side: sx, x: sx * W.x, z });
        continue;
      }
      R.add(tireGeometry(W.radius, 0.32, seg, HQ && lod === 0), S.rubber, null, [0, 0, HP]);
      R.add(cyl(0.25, 0.25, 0.3, seg), S.dark, null, [0, 0, HP]);
      if (lod === 0) R.add(cyl(0.08, 0.08, 0.34, 8), paint, null, [0, 0, HP]);
      if (HQ && lod === 0) {
        // Felgenring + Radmuttern (außen)
        R.add(new THREE.TorusGeometry(0.22, 0.02, 4, 18), S.dark, [sx * 0.155, 0, 0], [0, HP, 0]);
        for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; R.add(box(0.03, 0.03, 0.03), S.dark, [sx * 0.175, Math.sin(a) * 0.12, Math.cos(a) * 0.12]); }
      }
      R.build(spin, { shadow: true, off: [sx * W.x, W.radius, z] });
      wheels.push({ spin, axle, side: sx, x: sx * W.x, z });
    }
  });
  return { hull, mg, wheels, extra };
}

/* -------------------------------------------------------------- Besatzung: Luken, Turm-Innenraum */

// Rückfall, falls data.js (noch) keine Lage liefert (panzer-mp.md §B.1)
const HATCH_DEF = {
  driver: { space: 'hull', pos: [-0.55, 1.65, -2.35], r: 0.34 },
  commander: { space: 'turret', pos: [-0.62, 1.03, 0.62], r: 0.38 },
  loader: { space: 'turret', pos: [0.6, 0.83, 0.55], r: 0.3 },
};
const INTERIOR_DEF = { breech: [0, 0.42, -0.55], rack: [0, 0.45, 1.55], loaderEye: [0.55, 0.62, 0.35] };
/** Scharnier je Luke: Achse und Drehsinn (offen = +HATCH_OPEN um die Achse). Fahrer und Kommandant hinten
 * (Deckel stellt sich hinter dem Kopf auf), Ladeschütze außen rechts. */
const HATCH_HINGE = { driver: { axis: 'x', sign: 1, side: [0, 0, 1] }, commander: { axis: 'x', sign: 1, side: [0, 0, 1] }, loader: { axis: 'z', sign: -1, side: [1, 0, 0] } };
const HATCH_OPEN = 1.8; // ≈ 103°
const HATCH_LIFT = 0.01; // Deckel liegt 1 cm über dem festen Deckel bzw. Lukenring (kein Z-Fighting)

/** Bewegliche Luke: Gruppe am Scharnier (Drehpunkt), ein Netz (Lack). ≤ 100 Dreiecke. */
function buildHatch(id, def, S, paint, base = null) {
  const H = HATCH_HINGE[id], r = def.r, h = 0.05, seg = DET === 2 ? 16 : 12;
  const pivot = new THREE.Group();
  pivot.name = `hatch:${id}`;
  // Scharnierkante: Lukenmitte + r in Richtung side, auf der Unterkante des Deckels
  pivot.position.set(def.pos[0] + H.side[0] * r, def.pos[1] + HATCH_LIFT, def.pos[2] + H.side[2] * r);
  const c = [-H.side[0] * r, h / 2, -H.side[2] * r]; // Deckelmitte relativ zum Scharnier
  const B = new Bucket();
  const along = H.axis === 'x';
  if (DET === 0) {
    // low: wie bisher (Dreiecke ≤ vorher)
    B.add(cyl(r, r * 0.96, h, seg), paint, c);
    B.add(box(along ? r * 0.7 : 0.08, 0.06, along ? 0.08 : r * 0.7), paint, [H.side[0] * 0.02, 0.03, H.side[2] * 0.02]);
    B.add(box(along ? 0.16 : 0.03, 0.03, along ? 0.03 : 0.16), paint, [c[0] * 1.55, h + 0.015, c[2] * 1.55]);
    B.build(pivot, { shadow: true, off: [pivot.position.x + (base ? base[0] : 0), pivot.position.y + (base ? base[1] : 0), pivot.position.z + (base ? base[2] : 0)] });
    pivot.userData.hatch = { id, axis: H.axis, sign: H.sign };
    return pivot;
  }
  {
    // gewölbter Deckel (Drehkörper) mit Randwulst, Unterseite dunkel
    const prof = [[0.001, h * 1.6], [r * 0.55, h * 1.45], [r * 0.88, h * 1.05], [r, h * 0.55], [r, 0.004], [0.001, 0.004]].map(([x, y]) => new THREE.Vector2(x, y));
    B.add(new THREE.LatheGeometry(prof, seg), paint, c);
    B.add(new THREE.TorusGeometry(r * 0.985, 0.012, 4, seg), paint, [c[0], h * 0.5, c[2]], [HP, 0, 0]);
  }
  // Scharnier: drei Augen auf einer Achse längs der Scharnierkante, Haltebleche zum Deckel; Griff; Verriegelung
  for (const k of [-0.55, 0, 0.55]) {
    const o = k * r;
    B.add(cyl(0.025, 0.025, k === 0 ? r * 0.36 : r * 0.24, 8), k === 0 ? S.dark : paint, [along ? o : H.side[0] * 0.01, 0.025, along ? H.side[2] * 0.01 : o], along ? [0, 0, HP] : [HP, 0, 0]);
    if (k !== 0) B.add(box(along ? 0.06 : 0.12, 0.02, along ? 0.12 : 0.06), paint, [(along ? o : 0) - H.side[0] * 0.06, 0.045, (along ? 0 : o) - H.side[2] * 0.06]);
  }
  // Griffbügel (Rundstahl) und Verriegelungsknauf
  const gx = c[0] * 1.55, gz = c[2] * 1.55;
  B.add(box(along ? 0.16 : 0.025, 0.025, along ? 0.025 : 0.16), S.dark, [gx, h + 0.05, gz]);
  for (const sgn of [-1, 1]) B.add(box(0.02, 0.05, 0.02), S.dark, [gx + (along ? sgn * 0.075 : 0), h + 0.028, gz + (along ? 0 : sgn * 0.075)]);
  if (DET === 2) {
    B.add(cyl(0.03, 0.035, 0.035, 8), S.dark, [c[0], h * 1.6 + 0.012, c[2]]);
    B.add(box(along ? 0.05 : r * 1.4, 0.02, along ? r * 1.4 : 0.05), paint, [c[0], h * 1.25, c[2]]);
  }
  B.build(pivot, { shadow: true, off: [pivot.position.x + (base ? base[0] : 0), pivot.position.y + (base ? base[1] : 0), pivot.position.z + (base ? base[2] : 0)] });
  pivot.userData.hatch = { id, axis: H.axis, sign: H.sign };
  return pivot;
}

/** Dreiecke einer Deckfläche (alle Ecken auf Höhe y) entfernen – offene Unterseite der Turmhülle (Drehkranz). */
function dropCap(geom, y = 0, eps = 1e-3) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  if (g !== geom) geom.dispose();
  const P = g.attributes.position, keep = [];
  for (let t = 0; t < P.count; t += 3) if (!(Math.abs(P.getY(t) - y) < eps && Math.abs(P.getY(t + 1) - y) < eps && Math.abs(P.getY(t + 2) - y) < eps)) keep.push(t);
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const A = g.attributes[name], n = A.itemSize, a = new Float32Array(keep.length * 3 * n);
    keep.forEach((t, i) => a.set(A.array.subarray(t * n, (t + 3) * n), i * 3 * n));
    out.setAttribute(name, new THREE.BufferAttribute(a, n));
  }
  g.dispose();
  return out;
}

/** Geschlossene Körper nach innen kehren (Wicklung + Normalen) – Innenraum-Hülle mit Vorderseiten-Material. */
function inward(geom) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  if (g !== geom) geom.dispose();
  for (const name of Object.keys(g.attributes)) {
    const A = g.attributes[name], n = A.itemSize, a = A.array;
    for (let t = 0; t < A.count; t += 3) for (let k = 0; k < n; k++) {
      const i1 = (t + 1) * n + k, i2 = (t + 2) * n + k, tmp = a[i1];
      a[i1] = a[i2]; a[i2] = tmp;
    }
  }
  const N = g.attributes.normal;
  if (N) for (let i = 0; i < N.array.length; i++) N.array[i] = -N.array[i];
  return g;
}

/** Granate (Spitze zeigt nach −Z, Boden bei z = 0) mit Vertex-Farben. full: ganze Patrone (in der Hand),
 * sonst nur der sichtbare Vorderteil im Gestell. Farben: PG schwarz/gold, SG oliv/gelb. */
const SHELL_COL = {
  mbt_ap: { body: 0x17181a, band: 0xc19a3a, nose: 0x1d1e20, tip: 0x6a5524, len: 0.2 },
  mbt_he: { body: 0x4b5233, band: 0xd9b52a, nose: 0x4b5233, tip: 0x6f6a58, len: 0.15 },
};
const _col = new THREE.Color();
function shellGeometry(type, n, { full = false, band = true, body = true } = {}) {
  const C = SHELL_COL[type] || SHELL_COL.mbt_ap, R = 0.06, parts = [];
  const part = (g, hexA, hexB = hexA, z0 = 0) => {
    // Zylinder liegt entlang Y → nach −Z drehen; Farbe unten (Boden) hexA, oben (Spitze) hexB
    g.rotateX(-HP);
    g.translate(0, 0, z0);
    const P = g.attributes.position, col = new Float32Array(P.count * 3);
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < P.count; i++) { zmin = Math.min(zmin, P.getZ(i)); zmax = Math.max(zmax, P.getZ(i)); }
    const a = new THREE.Color().setHex(hexA), b = new THREE.Color().setHex(hexB);
    for (let i = 0; i < P.count; i++) {
      const k = zmax > zmin ? (zmax - P.getZ(i)) / (zmax - zmin) : 0;
      _col.copy(a).lerp(b, k);
      col[i * 3] = _col.r; col[i * 3 + 1] = _col.g; col[i * 3 + 2] = _col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  let z = 0;
  if (full) {
    if (DET > 0) part(new THREE.CylinderGeometry(R + 0.006, R + 0.006, 0.03, n), 0xa98a45, 0xa98a45, -0.015); // Bodenstück (Messing)
    part(new THREE.CylinderGeometry(R + 0.002, R + 0.002, 0.55, n), 0x8b7c57, 0x8b7c57, -0.305); // Treibladung (Hülse)
    z = -0.58;
  }
  // Geschossrumpf, Ring, Haube (offen – der Boden steckt im Gestell bzw. in der Hülse)
  if (body) part(new THREE.CylinderGeometry(R, R, 0.06, n, 1, true), C.body, C.body, z - 0.03);
  if (band) part(new THREE.CylinderGeometry(R + 0.002, R + 0.002, 0.025, n, 1, true), C.band, C.band, z - 0.0725);
  const zb = z - (band ? 0.085 : body ? 0.06 : 0);
  // ohne Ring: Haube von Grundfarbe (Boden) zur Ringfarbe (Spitze) – PG schwarz→gold, SG oliv→gelb
  part(new THREE.CylinderGeometry(0, R, C.len, n, 1, true), C.nose, band ? C.tip : C.band, zb - C.len / 2);
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return g;
}

/**
 * Turm-Innenraum (Ladeschützen-Sicht, panzer-mp.md §D.2): Hülle nach innen gekehrt, Bodenplatte, Munitionsgestell im
 * Turmheck (je Sorte ein Netz, Sichtbarkeit über drawRange), Granate in der Hand, Lampe, Haltegriffe; Verschluss mit
 * Keil als eigene Gruppe am Rohr. Alles unsichtbar, keine Schatten.
 */
function buildInterior(S, D) {
  const DET = Math.max(detNow(), 1); // Innenraum sieht nur der Ladeschütze aus der Nähe: mindestens mittlere Stufe
  const I = Object.assign({}, INTERIOR_DEF, D.interior || {});
  const ammo = Object.assign({ mbt_ap: 22, mbt_he: 18 }, D.ammo || {});
  const n = DET === 2 ? 8 : DET === 1 ? 6 : 5;
  const grp = new THREE.Group();
  grp.name = 'interior';
  grp.visible = false;
  // Panzergenerationen: Aufbau des KP-1, im Turmraum um interior.shift verschoben (Verschluss hinter dem eigenen Rohr)
  const sh = I.shift || [0, 0, 0], sc = I.scale || 1; // sc: kleiner Kampfraum (leichter Panzer)
  grp.position.fromArray(sh);
  grp.scale.setScalar(sc);
  const rackRight = I.rack && I.rack[0] > 0.5; // Gestell in der rechten Seitenkammer: Sitz und Löscher wandern nach links
  // Hülle: Grundriss des Turms nach innen versetzt (Stirn dick gepanzert), Boden 6 cm über dem Turmring
  const B = new Bucket();
  // Generation (Nutzer 11.10.): modern grün mit Anzeigen, 2. WK elfenbeinfarben mit Röhrenfunkgerät, 1. WK roher Stahl, Nieten,
  // Holzkisten und Öllampe
  const era = D.era === 'kk' ? 'wk2' : D.era || 'modern', CAB = era === 'wk2' ? S.cabinWk2 : era === 'wk1' ? S.cabinWk1 : S.cabin; // Kalter Krieg: Ausstattung wie 2. WK
  const LIT = era === 'modern' ? S.lensOn : S.lamp;
  const foot = [[-0.9, 1.15], [0.9, 1.15], [1.24, 0.8], [1.25, -1.45], [0.9, -1.92], [-0.9, -1.92], [-1.25, -1.45], [-1.24, 0.8]];
  // Nutzer 16.10. („man steckt im Drehkranz, da ist keine Öffnung“): Drehturm-Panzer haben unter dem Turm einen offenen
  // Drehkranz mit Turmkorb, der in den Kampfraum der Wanne hinabreicht – dort stehen Lade- und Richtschütze
  const basket = !D.turretLimits && I.basket !== false;
  const ringR = (D.ringR || D.turretBox[3] * 0.8) / sc;                            // Drehkranz-Radius (Gruppenraum)
  const rc = [-sh[0] / sc, 0.06, -sh[2] / sc];                                      // Drehkranz-Mitte (Turmdrehpunkt)
  if (basket) {
    B.add(inward(dropCap(topExtrude(foot, 0.69), 0)), CAB, [0, 0.06, 0]);
    // Turmboden außerhalb des Drehkranzes (Überhang), mittig die Öffnung
    const shp = new THREE.Shape(foot.map(([x, v]) => new THREE.Vector2(x, v)));
    const hole = new THREE.Path();
    hole.absarc(rc[0], -rc[2], ringR + 0.05, 0, Math.PI * 2, true);
    shp.holes.push(hole);
    const shelf = new THREE.ShapeGeometry(shp, DET === 2 ? 24 : 14);
    shelf.rotateX(-HP);
    B.add(shelf, CAB, [0, 0.061, 0]);
  } else {
    B.add(inward(topExtrude(foot, 0.69)), CAB, [0, 0.06, 0]);
    B.add(box(1.5, 0.02, 1.3), S.dark, [0.15, 0.07, 0.3]);                        // Bodenplatte
  }
  B.add(box(0.74, 0.62, 0.03), S.dark, [0, 0.42, -1.135]);                         // Rahmen der Rohrdurchführung
  // Kommandantensitz (Richtschützenplatz, Funkgeräte und Optiken baut cabin.js im Detail, sobald jemand innen sitzt)
  if (DET > 0) {
    B.add(box(0.4, 0.06, 0.38), S.canvas, [-0.62, 0.3, 0.55]);
    B.add(box(0.4, 0.24, 0.05), S.canvas, [-0.62, 0.45, 0.76], [-0.12, 0, 0]);
  }
  // Munitionsgestell: eigene Gruppe (Lage I.rack, Drehung I.rackRot [x, y]) – je Panzer an anderer Stelle (Nutzer 11.10.):
  // modern im Turmheck-Bunker hinter einer Schiebetür, 2. WK im Wannenboden (Nasslagerung), 1. WK an der linken Wand
  // rackGrid [Spalten, Reihen]: kleinerer Behälter (Seitenkammer des schweren Panzers), sonst 10×4 (low 8×3)
  const grid = I.rackGrid || null;
  const rk = I.rack, rw = grid ? grid[0] * 0.155 + 0.07 : 1.62, rh = grid ? grid[1] * 0.135 + 0.06 : 0.6, rz0 = -0.36, rr = I.rackRot || [0, 0];
  const rackGrp = new THREE.Group();
  rackGrp.name = 'rackGrp';
  rackGrp.position.fromArray(rk);
  rackGrp.rotation.set(rr[0], rr[1], 0, 'YXZ');
  grp.add(rackGrp);
  const RB = new Bucket();
  RB.add(box(rw, 0.035, 0.76), S.dark, [0, -rh / 2 + 0.01, 0]);
  RB.add(box(rw, 0.035, 0.76), S.dark, [0, rh / 2 - 0.01, 0]);
  for (const sx of [-1, 1]) RB.add(box(0.035, rh, 0.76), S.dark, [sx * rw / 2, 0, 0]);
  RB.add(box(rw, rh - 0.04, 0.02), S.dark, [0, 0, rz0 + 0.02]);                     // Lochplatte (Granaten stecken darin)
  if (I.blastDoor) {
    // Bunker: Trennwand mit Führungsschienen oben/unten – die Schiebetür (eigene Gruppe) fährt seitlich weg
    for (const sy of [-1, 1]) RB.add(box(rw + 0.12, 0.03, 0.06), S.steel, [0, sy * 0.33, rz0 - 0.3]);
    RB.add(box(0.06, 0.7, 0.06), S.steel, [-rw / 2 - 0.06, 0, rz0 - 0.3]);
  }
  RB.build(rackGrp, { shadow: false });
  // Lampe (leuchtet, kein echtes Licht) + Haltegriffe am Dach
  B.add(box(0.16, 0.04, 0.08), S.dark, [0.15, 0.735, 0.1]);
  B.add(box(0.12, 0.02, 0.05), LIT, [0.15, 0.71, 0.1]);
  for (const [x, z] of DET === 2 ? [[0.55, -0.15], [0.95, 0.4], [-0.25, 0.95]] : DET === 1 ? [[0.55, -0.15], [0.95, 0.4]] : [[0.95, 0.4]]) {
    B.add(box(0.03, 0.03, 0.26), S.dark, [x, 0.67, z]);
    if (DET === 2) for (const dz of [-0.12, 0.12]) B.add(box(0.025, 0.07, 0.025), S.dark, [x, 0.715, z + dz]);
  }
  // mehr Ausstattung (Nutzer 11.10.): Leitungen, Kabelkanäle, Feuerlöscher, Ladeschützensitz, Winkelspiegel, Kästen
  for (const [x, y, z, l, ry] of [[-1.15, 0.62, -0.2, 1.9, 0], [1.16, 0.6, -0.3, 1.7, 0], [0, 0.7, -0.95, 1.6, Math.PI / 2], [0.4, 0.69, 0.9, 1.2, Math.PI / 2]]) {
    B.add(cyl(0.018, 0.018, l, 6), S.steel, [x, y, z], [Math.PI / 2, ry, 0]);
    B.add(cyl(0.012, 0.012, l, 5), S.rubber, [x, y - 0.04, z], [Math.PI / 2, ry, 0]);
  }
  const fx = rackRight ? -1.1 : 1.1, fz = rackRight ? 0.3 : 0.95;
  B.add(cyl(0.065, 0.065, 0.42, 12), S.red, [fx, 0.33, fz]);                          // Feuerlöscher
  B.add(cyl(0.03, 0.04, 0.08, 8), S.dark, [fx, 0.58, fz]);
  // Ladeschützensitz an der rechten Wand (hochgeklappt – versperrt den Weg zum Gestell nicht); Gestell rechts: Sitz an der Rückwand
  if (rackRight) { B.add(box(0.36, 0.05, 0.32), S.canvas, [0.6, 0.3, 1.35]); B.add(box(0.04, 0.24, 0.04), S.steel, [0.6, 0.16, 1.35]); }
  else {
    B.add(box(0.05, 0.32, 0.36), era === 'wk1' ? S.wood : S.canvas, [1.12, 0.36, 0.25]); B.add(box(0.04, 0.04, 0.3), S.steel, [1.16, 0.2, 0.25]);
    B.add(box(0.04, 0.3, 0.34), era === 'wk1' ? S.wood : S.canvas, [1.2, 0.46, 0.25]);
  }
  for (const [x, z, ry] of [[0.65, 0.2, 0.3], [0.85, 0.75, -0.6], [-0.65, -0.5, 0.2]]) B.add(box(0.16, 0.12, 0.1), S.dark, [x, 0.66, z], [0, ry, 0]); // Winkelspiegel
  if (era === 'modern') {
    for (const [x, z, w, d] of [[-1.05, 0.1, 0.22, 0.4], [-0.95, -0.6, 0.3, 0.25], [1.05, -0.6, 0.25, 0.3]]) { B.add(box(w, 0.2, d), S.dark, [x, 0.28, z]); B.add(box(w * 0.6, 0.03, 0.02), S.lensOn, [x, 0.36, z + d / 2 + 0.005]); } // Kästen mit Anzeige
    for (let i = 0; i < 6; i++) B.add(box(0.02, 0.012, 0.012), i % 2 ? S.lensOn : S.rubber, [-1.13, 0.5 + (i % 3) * 0.035, 0.85 + Math.floor(i / 3) * 0.05]); // Funkgerät-Lämpchen
  } else if (era === 'wk2') {
    // Röhrenfunkgerät mit Skalen, Bordsprechkästen, Kartenbrett, Patronensäcke fürs MG, Sehklappen-Handräder
    B.add(box(0.24, 0.3, 0.44), S.dark, [-1.08, 0.36, 0.85]);
    for (let i = 0; i < 3; i++) B.add(cyl(0.035, 0.035, 0.02, 6), S.lamp, [-0.955, 0.42, 0.7 + i * 0.13], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 3; i++) B.add(cyl(0.018, 0.018, 0.03, 6), S.brass, [-0.955, 0.3, 0.68 + i * 0.1], [0, 0, Math.PI / 2]);
    for (const [x, z] of rackRight ? [[-1.0, -0.6]] : [[-1.0, -0.6], [1.0, -0.65]]) B.add(box(0.12, 0.16, 0.1), S.dark, [x, 0.5, z]);
    B.add(box(0.3, 0.02, 0.24), S.wood, [-0.85, 0.42, -0.1], [0, 0, 0.2]);
    for (let i = 0; i < 2; i++) B.add(box(0.12, 0.16, 0.08), S.canvas, [-1.08, 0.18, -0.3 + i * 0.1]);
    for (const [x, z] of [[0.62, -1.05], [-0.62, -1.05]]) B.add(cyl(0.05, 0.05, 0.02, 8), S.dark, [x, 0.52, z], [Math.PI / 2, 0, 0]);
  } else {
    // 1. WK: Nieten an den Wänden, Holzkisten mit Granaten, Werkzeugkiste, Öllampe am Haken, Sprachrohr zum Fahrer
    for (const [x, z] of [[-1.2, -1.2], [-1.2, 0.5], [1.2, -1.2], [1.2, 0.6]]) for (let i = 0; i < 2; i++) B.add(box(0.025, 0.025, 0.025), S.steel, [x, 0.2 + i * 0.3, z]);
    for (let i = 0; i < 4; i++) B.add(box(0.025, 0.025, 0.025), S.steel, [-0.66 + i * 0.44, 0.12, -1.9]);
    for (const [x, z, ry] of [[0.95, -0.7, 0]]) { B.add(box(0.36, 0.22, 0.42), S.wood, [x, 0.17, z], [0, ry, 0]); B.add(box(0.37, 0.03, 0.43), S.steel, [x, 0.27, z], [0, ry, 0]); }
    B.add(box(0.3, 0.14, 0.18), S.dark, [-0.95, 0.07, -0.55]);
    B.add(cyl(0.05, 0.06, 0.12, 10), S.brass, [0.2, 0.58, 0.95]); B.add(cyl(0.035, 0.035, 0.07, 8), S.lamp, [0.2, 0.5, 0.95]);
    B.add(cyl(0.025, 0.025, 1.1, 8), S.brass, [-0.7, 0.62, -0.5], [Math.PI / 2, 0.3, 0]);
  }
  if (basket) turretBasket(B, S, D, I, CAB, DET, { ringR, rc, sh, sc });
  B.build(grp, { shadow: false });
  // Granaten im Gestell: Spalten von links (PG) nach rechts (SG), je Spalte von unten nach oben
  const rows = grid ? grid[1] : DET === 0 ? 3 : 4, cols = grid ? grid[0] : DET === 0 ? 8 : 10;
  const dx = DET === 0 && !grid ? 0.19 : 0.155, dy = DET === 0 && !grid ? 0.17 : 0.135;
  const slots = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) slots.push([(c - (cols - 1) / 2) * dx, (r - (rows - 1) / 2) * dy, rz0]);
  const nAp = Math.min(ammo.mbt_ap, Math.round(slots.length * ammo.mbt_ap / (ammo.mbt_ap + ammo.mbt_he)));
  const sets = { mbt_ap: slots.slice(0, nAp), mbt_he: slots.slice(nAp) };
  for (const type of ['mbt_ap', 'mbt_he']) {
    const list = sets[type];
    if (!list.length) continue;
    const proto = shellGeometry(type, n, { band: DET === 2, body: DET > 0 });
    const per = proto.attributes.position.count;
    const geoms = list.map((p) => proto.clone().translate(p[0], p[1], p[2]));
    proto.dispose();
    const g = mergeGeometries(geoms, false);
    for (const x of geoms) x.dispose();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, S.shell);
    mesh.name = `rack:${type}`;
    mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.userData.rack = type; mesh.userData.per = per; mesh.userData.slots = list.length; mesh.userData.shown = list.length;
    rackGrp.add(mesh);
  }
  if (I.blastDoor) {
    const door = new THREE.Group();
    door.name = 'rackDoor';
    door.position.set(0, 0, rz0 - 0.3);
    const DB = new Bucket();
    DB.add(box(rw + 0.04, 0.64, 0.035), S.steel, [0, 0, 0]);
    DB.add(box(0.05, 0.14, 0.05), S.dark, [rw / 2 - 0.12, 0, -0.035]);           // Griff
    for (let i = 0; i < 4; i++) DB.add(box(rw * 0.9, 0.02, 0.012), S.dark, [0, -0.24 + i * 0.16, -0.022]); // Versteifungen
    DB.add(box(0.3, 0.06, 0.012), S.red, [0, 0.27, -0.022]);                     // Warnstreifen
    DB.build(door, { shadow: false });
    rackGrp.add(door);
  }
  // Granate in den Händen: vor der Ladeschützen-Kamera, leicht unten, Spitze Richtung Verschluss
  const held = new THREE.Group();
  held.name = 'held';
  held.visible = false;
  const eye = I.loaderEye;
  // Tragehaltung: schräg vor der Brust, ganz im unteren Bildteil (Spitze vorn links, Boden rechts hinten)
  held.position.set(eye[0] + 0.02, eye[1] - 0.27, eye[2] - 0.62);
  held.rotation.set(-0.12, 0.62, 0);
  for (const type of ['mbt_ap', 'mbt_he']) {
    const g = shellGeometry(type, n, { full: true, band: DET > 0 });
    g.computeBoundingBox();
    g.translate(0, 0, -(g.boundingBox.min.z + g.boundingBox.max.z) / 2); // Ursprung = Granatenmitte
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, S.shell);
    m.name = `held:${type}`;
    m.castShadow = false; m.receiveShadow = false;
    held.add(m);
  }
  // Arme halten die Granate (sichtbar mit ihr; Nutzer 11.10.: „die Granate wirklich in die Hand nehmen“)
  const arms = new THREE.Group();
  arms.name = 'arms';
  const AB = new Bucket();
  loaderArm(AB, S, [-0.3, -0.14, 0.15], [-0.05, -0.06, -0.2]);   // linke Hand vorn unter der Granate
  loaderArm(AB, S, [0.3, -0.12, 0.55], [0.05, -0.05, 0.28]);      // rechte Hand am Boden
  AB.build(arms, { shadow: false });
  held.add(arms);
  held.userData.home = { rx: held.rotation.x, ry: held.rotation.y, eye: eye.slice(), off: [0.02, -0.27, -0.62] }; // nur Zahlen: userData wird beim Klonen als JSON kopiert
  grp.add(held);
  // Freie rechte Hand zum Schließen des Keils
  const push = new THREE.Group();
  push.name = 'pushArm';
  push.visible = false;
  const PB = new Bucket();
  loaderArm(PB, S, [0.16, -0.18, 0.36], [0, 0, 0]);
  PB.build(push, { shadow: false });
  grp.add(push);
  // Gestell-Mitte je Sorte (Start der Greif-Bewegung) und Anfahrrichtung, im Innenraum-Raum (nur Zahlen: Klon per JSON)
  rackGrp.updateMatrix();
  grp.userData.rackPos = {};
  for (const type of ['mbt_ap', 'mbt_he']) {
    const list = sets[type];
    if (!list.length) continue;
    const c = list.reduce((a, q) => [a[0] + q[0], a[1] + q[1], a[2] + q[2]], [0, 0, 0]).map((v) => v / list.length);
    grp.userData.rackPos[type] = new THREE.Vector3(c[0], c[1], c[2]).applyMatrix4(rackGrp.matrix).toArray();
  }
  grp.userData.rackOff = new THREE.Vector3(0, 0, -0.55).applyEuler(rackGrp.rotation).toArray();
  grp.userData.rackRot = [rr[0], rr[1]];
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // Verschluss (Kind des Rohrs, folgt der Rohrerhöhung): Bodenstück, Keil (fährt nach unten), Rücklaufschutz
  const br = new THREE.Group();
  br.name = 'breech';
  br.visible = false;
  br.position.set(I.breech[0] * sc + sh[0] - D.gunPivot[0], I.breech[1] * sc + sh[1] - D.gunPivot[1], I.breech[2] * sc + sh[2] - D.gunPivot[2]);
  br.scale.setScalar(sc * (I.breechScale || 1)); // 37 mm: Verschluss kleiner
  const V = new Bucket();
  V.add(box(0.5, 0.48, 0.42), S.steel, [0, 0, 0]);                                 // Bodenstück
  V.add(box(0.58, 0.5, 0.36), S.cabin, [0, 0.02, -0.42]);                           // Wiege
  if (DET === 2) V.add(cyl(0.2, 0.22, 0.2, 12, true), S.steel, [0, 0, -0.3], [HP, 0, 0]); // Verschlussring
  V.add(cyl(0.085, 0.085, 0.03, DET === 2 ? 12 : 8, true), S.rubber, [0, 0, 0.205], [HP, 0, 0]); // Ladeöffnung (dunkel)
  V.add(box(0.15, 0.15, 0.01), S.rubber, [0, 0, 0.214]);
  if (DET > 0) {
    for (const sx of [-1, 1]) {
      V.add(box(0.035, 0.035, 0.75), S.cabin, [sx * 0.33, -0.12, 0.5]);            // Rücklaufschutz
      if (DET === 2) V.add(cyl(0.045, 0.045, 0.6, 8, true), S.dark, [sx * 0.2, 0.3, -0.3], [HP, 0, 0]); // Rohrbremsen
    }
    V.add(box(0.7, 0.035, 0.035), S.cabin, [0, -0.12, 0.86]);
    V.add(box(0.66, 0.3, 0.02), S.cabin, [0, -0.29, 0.86]);                         // Hülsenfangblech
  }
  V.build(br, { shadow: false });
  const keil = new THREE.Group();
  keil.name = 'breech:keil';
  keil.position.set(0, 0, 0.235);
  const K = new Bucket();
  K.add(box(0.42, 0.44, 0.06), S.steel, [0, 0, 0]);
  K.add(box(0.06, 0.04, 0.1), S.rubber, [0.16, 0.12, 0.06]);                        // Griff
  K.build(keil, { shadow: false });
  br.add(keil);
  br.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { interior: grp, breech: br, hull: basket ? hullCompartment(S, D, I, CAB, DET, ringR * sc) : null };
}

/** Höhe des Turmkorb-Bodens im Turmraum: auf dem Wannenboden, höchstens so tief, dass der Ladeschütze aufrecht steht. */
function basketFloor(D, I) {
  const sh = I.shift || [0, 0, 0], sc = I.scale || 1, hb = D.hullBox;
  const hullFloor = hb[1] - hb[4] + 0.12 - D.turretPivot[1];
  const eye = sh[1] + sc * (I.loaderEye || INTERIOR_DEF.loaderEye)[1];
  return Math.max(hullFloor, eye - 1.68);
}

/**
 * Turmkorb (dreht mit dem Turm, Gruppenraum des Innenraums): Drehkranz mit Zahnkranz, Korbboden mit Riffelblech,
 * Geländer aus Pfosten und Ringen, Trittschutz unten, Drehdurchführung in der Mitte (Hydraulik/Strom), Richtschützensitz
 * auf Säule, Hülsensack und Bereitschaftskiste, Kabelzug zum Turm.
 */
function turretBasket(B, S, D, I, CAB, DET, { ringR, rc, sh, sc }) {
  const yb = (basketFloor(D, I) - sh[1]) / sc;                // Korbboden (Gruppenraum)
  const rB = ringR - 0.07, seg = DET === 2 ? 32 : 20;
  const [cx, , cz] = rc;
  // Drehkranz: Laufring + Zahnkranz (innen), etwas unter dem Turmboden
  B.add(new THREE.TorusGeometry(ringR, 0.05, 6, seg), S.steel, [cx, 0.03, cz], [HP, 0, 0]);
  B.add(new THREE.TorusGeometry(ringR - 0.07, 0.022, 4, seg), S.dark, [cx, -0.02, cz], [HP, 0, 0]);
  if (DET === 2) for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; B.add(box(0.018, 0.022, 0.016), S.dark, [cx + Math.cos(a) * (ringR - 0.1), -0.02, cz + Math.sin(a) * (ringR - 0.1)], [0, -a, 0]); }
  // Korbboden (Riffelblech, umlaufender Rand) + Trittschutz
  B.add(cyl(rB, rB, 0.04, seg), S.dark, [cx, yb - 0.02, cz]);
  B.add(new THREE.TorusGeometry(rB, 0.02, 4, seg), S.steel, [cx, yb + 0.01, cz], [HP, 0, 0]);
  if (DET === 2) for (let i = -3; i <= 3; i++) B.add(box(rB * 1.6, 0.006, 0.02), S.steel, [cx, yb + 0.003, cz + i * rB * 0.25], [0, 0.6, 0]);
  B.add(inward(cyl(rB, rB, 0.22, seg, true)), CAB, [cx, yb + 0.11, cz]);
  // Geländer: Pfosten (Lücke vorn für den Durchstieg zum Fahrer) und zwei Ringe
  const top = 0.0, h = top - yb;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    if (Math.abs(Math.cos(a)) < 0.3 && Math.sin(a) < 0) continue; // vorn (−z) offen
    B.add(cyl(0.016, 0.016, h, 6), S.steel, [cx + Math.cos(a) * rB, yb + h / 2, cz + Math.sin(a) * rB]);
  }
  for (const y of [yb + h * 0.45, yb + h * 0.82]) B.add(new THREE.TorusGeometry(rB, 0.013, 4, seg), S.steel, [cx, y, cz], [HP, 0, 0]);
  // Drehdurchführung (Mitte) mit Kabelstrang zum Turm
  B.add(cyl(0.12, 0.16, 0.26, 12), S.dark, [cx, yb + 0.13, cz]);
  B.add(cyl(0.06, 0.06, 0.12, 10), S.steel, [cx, yb + 0.32, cz]);
  B.add(cyl(0.022, 0.022, Math.max(0.2, h - 0.35), 6), S.rubber, [cx + 0.08, yb + 0.35 + Math.max(0.2, h - 0.35) / 2, cz - 0.05], [0, 0, 0.22]);
  // Richtschützensitz auf Säule (vorn rechts), Fußstütze; Hülsensack, Bereitschaftskiste, Werkzeugtasche
  const gx = cx + rB * 0.45, gz = cz - rB * 0.45;
  B.add(cyl(0.04, 0.05, h * 0.55, 8), S.steel, [gx, yb + h * 0.275, gz]);
  B.add(box(0.36, 0.07, 0.34), S.canvas, [gx, yb + h * 0.56, gz]);
  B.add(box(0.34, 0.26, 0.06), S.canvas, [gx, yb + h * 0.56 + 0.15, gz + 0.17], [-0.15, 0, 0]);
  B.add(box(0.3, 0.03, 0.14), S.steel, [gx - 0.05, yb + 0.22, gz - 0.32]);
  B.add(box(0.32, 0.36, 0.24), S.canvas, [cx - rB * 0.55, yb + 0.18, cz + rB * 0.5], [0, 0.4, 0]);
  B.add(box(0.42, 0.2, 0.3), S.dark, [cx + rB * 0.55, yb + 0.1, cz + rB * 0.45], [0, -0.3, 0]);
  if (DET === 2) B.add(box(0.26, 0.14, 0.1), S.canvas, [cx - rB * 0.8, yb + h * 0.6, cz - rB * 0.3], [0, 1.2, 0]);
}

/**
 * Kampfraum der Wanne (fest, Wannenraum): nach innen gekehrter Raum unter dem Turmkorb – Boden mit Riffelblech,
 * Seitenwände bis zu den Kettenkästen, vorn der Durchstieg zum Fahrerplatz (Sitzlehne sichtbar), hinten das Motorschott
 * mit Klappen, Munitionsstand in der Wanne (Hülsenböden) neben dem Fahrer, Batterie- und Funkkästen, Leitungen.
 */
function hullCompartment(S, D, I, CAB, DET, ring) {
  const grp = new THREE.Group();
  grp.name = 'hullInterior';
  grp.visible = false;
  const B = new Bucket(), hb = D.hullBox, tp = D.turretPivot;
  const yF = hb[1] - hb[4] + 0.1, yR = tp[1] - 0.02;
  const wx = Math.max(ring + 0.12, Math.min(hb[3] - 0.5, ring + 0.3));
  const DC = driverCabin(D);
  const zF = Math.max(hb[2] - hb[5] + 0.35, tp[2] - ring - 0.75, DC ? DC.zB + 0.05 : -Infinity), zB = Math.min(hb[2] + hb[5] - 0.3, tp[2] + ring + 0.55);
  B.add(inward(topExtrude([[-wx, -zF], [wx, -zF], [wx, -zB], [-wx, -zB]], yR - yF)), CAB, [0, yF, 0]);
  B.add(box(wx * 2 - 0.1, 0.02, zB - zF - 0.1), S.dark, [0, yF + 0.01, (zF + zB) / 2]);           // Riffelblech
  if (DET === 2) for (let z = zF + 0.3; z < zB - 0.2; z += 0.35) B.add(box(wx * 2 - 0.2, 0.006, 0.02), S.steel, [0, yF + 0.023, z]);
  // vorn: Durchstieg zum Fahrer (dunkle Öffnung, Rahmen, Sitzlehne, Lenkhebel dahinter)
  const dr = D.seats.find((s) => s.drive), dx = dr ? Math.max(-wx + 0.45, Math.min(wx - 0.45, dr.pos[0])) : -0.5;
  const oh = Math.min(0.95, yR - yF - 0.15);
  B.add(box(0.72, oh, 0.02), S.rubber, [dx, yF + oh / 2 + 0.05, zF + 0.012]);
  for (const sx of [-1, 1]) B.add(box(0.05, oh, 0.05), S.steel, [dx + sx * 0.38, yF + oh / 2 + 0.05, zF + 0.03]);
  B.add(box(0.8, 0.05, 0.05), S.steel, [dx, yF + oh + 0.07, zF + 0.03]);
  if (!DC) B.add(box(0.46, 0.5, 0.08), S.canvas, [dx, yF + 0.45, zF + 0.06], [0.12, 0, 0]);       // Fahrersitz-Lehne (ohne Fahrerkammer)
  // Munitionsstand in der Wanne neben dem Fahrer (Hülsenböden zum Kampfraum)
  const mx = dx > 0 ? -wx + 0.35 : wx - 0.35;
  B.add(box(0.62, 0.7, 0.04), S.dark, [mx, yF + 0.45, zF + 0.04]);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) B.add(cyl(0.055, 0.055, 0.025, DET === 2 ? 12 : 8), S.brass, [mx - 0.18 + c * 0.18, yF + 0.2 + r * 0.16, zF + 0.07], [HP, 0, 0]);
  // hinten: Motorschott mit Klappen und Bolzen, Feuerlöschanlage
  for (const sx of [-1, 1]) B.add(box(wx * 0.8, (yR - yF) * 0.55, 0.03), S.steel, [sx * wx * 0.45, yF + (yR - yF) * 0.4, zB - 0.02]);
  if (DET === 2) for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) B.add(box(0.025, 0.025, 0.02), S.dark, [sx * wx * 0.45 + (k - 1.5) * wx * 0.2, yF + (yR - yF) * 0.66, zB - 0.04]);
  B.add(cyl(0.09, 0.09, 0.5, 12), S.red, [wx - 0.2, yF + 0.3, zB - 0.2]);
  // Seiten: Batterie-/Funkkästen auf den Kettenkästen, Leitungen
  for (const sx of [-1, 1]) {
    B.add(box(0.3, 0.32, 0.6), S.dark, [sx * (wx - 0.17), yF + 0.16, (zF + zB) / 2 + 0.3]);
    B.add(cyl(0.02, 0.02, zB - zF - 0.3, 6), S.rubber, [sx * (wx - 0.04), yR - 0.12, (zF + zB) / 2], [HP, 0, 0]);
  }
  B.add(box(0.12, 0.06, 0.06), S.lensOn, [0, yR - 0.04, (zF + zB) / 2 + ring * 0.9]);              // Deckenleuchte
  B.build(grp, { shadow: false });
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return grp;
}


/* -------------------------------------------------------------- Laufwerk: Rollen und Kettenglieder (high/ultra, Stufe 0) */

const LINK_GEO = new Map();
/** Kettenglied (lokal: X quer, Y nach außen, Z längs): Platte, Greifsteg, Endverbinder mit Bolzen, Führungszahn innen. */
function linkGeometry(w, t, pitch) {
  const key = `${w}|${t}|${pitch}`;
  if (LINK_GEO.has(key)) return LINK_GEO.get(key);
  const parts = [];
  const add = (g, pos, rot = null) => {
    const gg = g.index ? g.toNonIndexed() : g;
    if (gg !== g) g.dispose();
    gg.deleteAttribute('uv');
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
    gg.applyMatrix4(_m.compose(_p.set(pos[0], pos[1], pos[2]), _q.setFromEuler(_e), _s.set(1, 1, 1)));
    parts.push(gg);
  };
  add(box(w, t * 0.55, pitch * 0.84), [0, 0, 0]);
  add(box(w * 0.94, t * 0.42, pitch * 0.2), [0, t * 0.46, -pitch * 0.16]);                 // Greifsteg
  for (const sx of [-1, 1]) add(box(0.05, t * 0.8, pitch * 0.34), [sx * (w / 2 + 0.012), 0, pitch * 0.42]); // Endverbinder
  add(cyl(t * 0.2, t * 0.2, w + 0.05, 6), [0, 0, pitch * 0.42], [0, 0, HP]);             // Bolzen
  add(box(0.06, 0.06 + t * 0.4, pitch * 0.42), [0, -(t * 0.3 + 0.03), -pitch * 0.05]);    // Führungszahn
  if (w > 0.5) for (const sx of [-1, 1]) add(box(w * 0.3, t * 0.16, pitch * 0.62), [sx * w * 0.26, -t * 0.34, 0]); // Gummipolster innen
  const g = mergeGeometries(parts, false);
  for (const x of parts) x.dispose();
  boxUV(g, 0.5);
  g.computeBoundingSphere();
  LINK_GEO.set(key, g);
  return g;
}

let LINK_MAT = null;
function linkMaterial() {
  if (!LINK_MAT) LINK_MAT = new THREE.MeshStandardMaterial({ name: 'veh:kettenglied', color: 0xffffff, roughness: 0.8, metalness: 0.55, envMapIntensity: 0.6 });
  const D = vehicleMaterials().dark; // Fotoscan (gunmetal_worn), sobald geladen
  if (D.map && LINK_MAT.map !== D.map) { LINK_MAT.map = D.map; LINK_MAT.normalMap = D.normalMap || null; LINK_MAT.roughnessMap = D.roughnessMap || null; LINK_MAT.metalnessMap = D.metalnessMap || null; LINK_MAT.needsUpdate = true; }
  return LINK_MAT;
}

/** Laufbahn (z, y) für die Glieder: Untertrum über die (eingefederten) Rollen, Bögen um Trieb-/Leitrad, Obertrum. */
function linkPath(U, dyAt, side, out) {
  const base = U.path;
  out.length = 0;
  const z0 = base[0][0], z1 = base[1][0], t = base[0][1];
  out.push([z0, t + dyAt(side, z0)]);
  for (const z of U.wz) if (z > z0 + 0.05 && z < z1 - 0.05) out.push([z, t + dyAt(side, z)]);
  out.push([z1, t + dyAt(side, z1)]);
  for (let i = 2; i < base.length; i++) out.push(base[i]);
  return out;
}
const _lp = [], _lc = [];
const _lm = new THREE.Matrix4();
/** Glieder entlang der Bahn setzen (Versatz s0 = Kettenlauf in m). */
function placeLinks(mesh, dyAt, s0) {
  const U = mesh.userData.links;
  const P = linkPath(U, dyAt, U.side, _lp), n = P.length;
  _lc.length = n + 1; _lc[0] = 0;
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; _lc[i + 1] = _lc[i] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const L = _lc[n], N = U.N, step = L / N;
  let s = ((s0 % L) + L) % L, j = 0;
  // erstes Segment suchen, danach fortlaufend (s wächst, ein Umlauf)
  while (j < n - 1 && _lc[j + 1] <= s) j++;
  for (let i = 0; i < N; i++) {
    let guard = 0;
    while (_lc[j + 1] <= s && guard++ < n + 1) { j++; if (j >= n) { j = 0; s -= L; } }
    const a = P[j], b = P[(j + 1) % n], sl = Math.max(1e-6, _lc[j + 1] - _lc[j]), f = (s - _lc[j]) / sl;
    const tz = (b[0] - a[0]) / sl, ty = (b[1] - a[1]) / sl;
    const nz = U.ccw ? ty : -ty, ny = U.ccw ? -tz : tz; // Außennormale (z, y)
    const pz = a[0] + (b[0] - a[0]) * f, py = a[1] + (b[1] - a[1]) * f;
    _lm.set(1, 0, 0, U.x, 0, ny, -nz, py, 0, nz, ny, pz, 0, 0, 0, 1);
    mesh.setMatrixAt(i, _lm);
    s += step;
  }
  mesh.instanceMatrix.needsUpdate = true;
}

const ZERO_DY = () => 0;
/** Erfasste Rollen (je Typ ein InstancedMesh je Material) und Glieder-Ketten an die Wanne der Stufe 0 hängen. */
function attachRunningGear(hull, R) {
  const wz = [[], []];
  for (const set of R.wheels.values()) {
    const tmp = new THREE.Group();
    set.B.build(tmp, { shadow: true, off: set.off });
    for (const m of [...tmp.children]) {
      const im = new THREE.InstancedMesh(m.geometry, m.material, set.centers.length);
      set.centers.forEach((c, k) => im.setMatrixAt(k, _m.compose(_p.set(c[0], c[1], c[2]), _q.identity(), _s.set(1, 1, 1))));
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      im.name = 'laufrollen';
      im.userData.rw = { r: set.r, centers: set.centers, fixed: !!set.fixed };
      hull.add(im);
    }
    if (!set.fixed) for (const c of set.centers) wz[c[0] < 0 ? 0 : 1].push(Math.round(c[2] * 100) / 100);
  }
  for (const k of [0, 1]) wz[k] = [...new Set(wz[k])].sort((a, b) => a - b);
  for (const T of R.tracks) {
    const pitch = Math.min(0.2, Math.max(0.13, T.w * 0.26));
    const geo = linkGeometry(T.w, T.t, Math.round(pitch * 1000) / 1000);
    let area = 0;
    for (let i = 0; i < T.path.length; i++) { const a = T.path[i], b = T.path[(i + 1) % T.path.length]; area += a[0] * b[1] - b[0] * a[1]; }
    for (const [side, sx] of [[0, -1], [1, 1]]) {
      const U = { side, x: sx * T.x, path: T.path.map((p) => p.slice()), wz: wz[side].length ? wz[side] : wz[1 - side], ccw: area > 0, N: 0 };
      linkPath(U, ZERO_DY, side, _lp);
      let L = 0;
      for (let i = 0; i < _lp.length; i++) { const a = _lp[i], b = _lp[(i + 1) % _lp.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); }
      U.N = Math.max(8, Math.round(L / pitch));
      const im = new THREE.InstancedMesh(geo, linkMaterial(), U.N);
      im.name = `kette:${side}`;
      im.userData.links = U;
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      const col = new THREE.Color();
      for (let i = 0; i < U.N; i++) { const k = Math.random(); im.setColorAt(i, col.setRGB(0.42 + k * 0.12, 0.4 + k * 0.1, 0.36 + k * 0.08)); }
      placeLinks(im, ZERO_DY, 0);
      hull.add(im);
    }
  }
}


/* -------------------------------------------------------------- Treffer- und Brandspuren (Nutzer 14.11.) */

let SCAR_MAT = null;
const SCAR_GEO = [];
/** Ruß-/Einschussflecken: 2 Varianten im Atlas (links Durchschuss mit blankem Rand, rechts nur Ruß/Brand). */
function scarMaterial() {
  if (SCAR_MAT) return SCAR_MAT;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 128);
  for (const [ox, hole] of [[64, true], [192, false]]) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.3, r = Math.random() * 40;
      const gr = g.createRadialGradient(ox + Math.cos(a) * r * 0.5, 64 + Math.sin(a) * r * 0.5, 2, ox + Math.cos(a) * r * 0.5, 64 + Math.sin(a) * r * 0.5, 18 + Math.random() * 26);
      gr.addColorStop(0, `rgba(12,10,8,${0.35 + Math.random() * 0.3})`); gr.addColorStop(1, 'rgba(12,10,8,0)');
      g.fillStyle = gr; g.fillRect(ox - 64, 0, 128, 128);
    }
    // Anlauffarben (Hitze) und Spritzer
    const ht = g.createRadialGradient(ox, 64, 6, ox, 64, 30);
    ht.addColorStop(0, 'rgba(70,52,40,0.0)'); ht.addColorStop(0.5, 'rgba(92,60,38,0.45)'); ht.addColorStop(0.8, 'rgba(48,52,70,0.35)'); ht.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ht; g.fillRect(ox - 64, 0, 128, 128);
    for (let i = 0; i < 40; i++) { const a = Math.random() * 6.3, r = 16 + Math.random() * 44; g.fillStyle = `rgba(20,16,12,${Math.random() * 0.6})`; g.fillRect(ox + Math.cos(a) * r, 64 + Math.sin(a) * r, 1 + Math.random() * 3, 1 + Math.random() * 3); }
    if (hole) {
      g.fillStyle = 'rgba(165,160,150,0.95)'; g.beginPath(); g.arc(ox, 64, 11, 0, 7); g.fill();
      g.fillStyle = 'rgba(6,5,4,1)'; g.beginPath(); g.arc(ox, 64, 7.5, 0, 7); g.fill();
      g.strokeStyle = 'rgba(140,130,118,0.8)'; g.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) { const a = Math.random() * 6.3; g.beginPath(); g.moveTo(ox + Math.cos(a) * 11, 64 + Math.sin(a) * 11); g.lineTo(ox + Math.cos(a) * (16 + Math.random() * 10), 64 + Math.sin(a) * (16 + Math.random() * 10)); g.stroke(); }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  SCAR_MAT = new THREE.MeshStandardMaterial({ name: 'veh:brandspur', map: t, transparent: true, depthWrite: false, roughness: 0.95, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  for (const u0 of [0, 0.5]) {
    const pg = new THREE.PlaneGeometry(1, 1), uv = pg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * 0.5);
    SCAR_GEO.push(pg);
  }
  return SCAR_MAT;
}
const _sr = new THREE.Raycaster(), _sn = new THREE.Vector3(), _sc = new THREE.Vector3(), _so = new THREE.Vector3(), _snm = new THREE.Matrix3(), _sz = new THREE.Vector3(0, 0, 1);

/* -------------------------------------------------------------- Vorlagen */

const TEMPLATES = new Map();
/** Baukasten für models-civil.js (Zivilfahrzeuge): Helfer + aktuelle Detailstufe der Vorlage. */
const KIT = {
  Bucket, box, cyl, sph, sideExtrude, topExtrude, tireGeometry,
  get HQ() { return HQ; }, get DET() { return DET; },
  setLod(l) { CUR_LOD = l; },
};

function lodOf(levels, dists) {
  const L = new THREE.LOD();
  levels.forEach((o, i) => L.addLevel(o, dists[i], i ? 2 : 0));
  return L;
}

/** Bewegliche Luken (außerhalb der LOD-Stufen) nach D.hatches bzw. HATCH_DEF; Turmluken an den Turm. */
function addHatches(D, S, team, root, tur) {
  const paint = S.paint[team] || S.paint.null;
  for (const id of Object.keys(D.hatches || (D.drive === 'tracked' ? HATCH_DEF : {}))) {
    if (!HATCH_DEF[id]) continue;
    const d = (D.hatches && D.hatches[id]) || {};
    const def = { space: d.space || HATCH_DEF[id].space, pos: d.pos || HATCH_DEF[id].pos, r: d.r || HATCH_DEF[id].r };
    const inTur = def.space === 'turret' && tur;
    (inTur ? tur : root).add(buildHatch(id, def, S, paint, inTur ? D.turretPivot : null));
  }
}

function template(type, team, quality, variant = 0) {
  const key = `${type}:${team}:${quality}:${variant | 0}`;
  if (TEMPLATES.has(key)) return TEMPLATES.get(key);
  const S = vehicleMaterials();
  HQ = quality !== 'low';
  DET = quality === 'low' ? 0 : quality === 'medium' ? 1 : 2;
  applyVehicleLook(quality); // Tarnung/Schlamm/Staub (nur medium+; low entfernt den Haken)
  const dists = LOD_DIST[quality] || LOD_DIST.high;
  const root = new THREE.Group();
  root.name = `vehicle:${type}`;
  const DT = VEHICLES[type];
  if (DT && DT.drive === 'tracked') {
    // Kettenfahrzeuge (KP-1 und Panzergenerationen 1./2. WK): Wanne, Turm (bzw. Schildlafette), Rohr, zweites MG
    const D = DT;
    const lv = [0, 1, 2].map((l) => {
      RG = l === 0 && DET === 2 ? { wheels: new Map(), tracks: [] } : null; // Laufwerk zum Anfassen nur high/ultra
      const r = tankBuilder(D.model)(l, S, team);
      if (RG) { CUR_LOD = 0; attachRunningGear(r.hull, RG); }
      RG = null;
      return r;
    });
    root.add(lodOf(lv.map((x) => x.hull), dists));
    const tur = new THREE.Group(); tur.name = 'turret';
    tur.position.fromArray(D.turretPivot);
    tur.add(lodOf(lv.map((x) => x.tur), dists));
    const gun = new THREE.Group(); gun.name = 'gun';
    gun.position.fromArray(D.gunPivot);
    gun.add(lodOf(lv.map((x) => x.gun), dists));
    tur.add(gun);
    const cmg = new THREE.Group(); cmg.name = 'cmg';
    cmg.position.fromArray(D.cmgPivot);
    cmg.add(lodOf(lv.map((x) => x.cmg), dists));
    (D.cmgHull ? root : tur).add(cmg); // Bug-MG im Kugelstand hängt an der Wanne
    root.add(tur);
    // Besatzung: bewegliche Luken (außerhalb der LOD-Stufen, Nahstufen-Details), Innenraum + Verschluss (unsichtbar)
    CUR_LOD = 0;
    addHatches(D, S, team, root, tur);
    if (D.noTurretInterior) {
      // Transporter ohne Panzerturm (MTW): leerer Turm-Innenraum (setInterior), Kampfraum/Fahrerplatz aus dem Bauer
      const it = new THREE.Group(); it.name = 'interior'; it.visible = false; tur.add(it);
      if (lv[0].inner) { lv[0].inner.name = 'hullInterior'; lv[0].inner.visible = false; root.add(lv[0].inner); }
    } else {
      const crew = buildInterior(S, D);
      tur.add(crew.interior);
      gun.add(crew.breech);
      if (crew.hull) root.add(crew.hull); // Kampfraum der Wanne unter dem Turmkorb (fest)
      if (crew.hull && D.troop) crew.hull.add(buildTroop(TKIT, S, D)); // Schützenpanzer: Kampfraum der Schützen dahinter
    }
    if (lv[0].ramp) root.add(lv[0].ramp); // Heckrampe (setRamp)
    // Tarnlack je Epoche (materials.js eraPaint: eigene Uniforms – Tarnschema, Rost, Kartenstimmung) für die Außenhülle
    // und Gummi der Außenteile mit Kartenschmutz (medium+; Innenraum behält seine Materialien für cabin.js)
    const ep = eraPaint(team, D.era || 'modern'), base = S.paint[team] || S.paint.null;
    const walk = (o) => {
      if (o.name === 'interior' || o.name === 'hullInterior' || o.name === 'breech') return;
      if (o.isMesh) { if (o.material === base && ep) o.material = ep; else if (HQ && o.material === S.rubber) o.material = S.rubberOut; }
      for (const c of o.children) walk(c);
    };
    walk(root);
  } else {
    // Radfahrzeuge: Geländewagen (MG-Lafette) bzw. Zivilfahrzeuge (models-civil.js: Kabine, Lenkrad, Insassen),
    // Truppentransporter (models-troop.js: Lkw, Mannschaftswagen, Halbketten mit Laufwerk, Radschützenpanzer mit Turm)
    const D = DT || VEHICLES.jeep;
    const civ = CIVIL_BUILDERS[D.model], trb = TROOP_BUILDERS[D.model];
    const lv = [0, 1, 2].map((l) => {
      if (!trb) return civ ? civ(l, S, KIT, variant | 0) : buildJeep(l, S, team);
      RG = D.halftrack && l === 0 && DET === 2 ? { wheels: new Map(), tracks: [] } : null; // Halbkette: Laufwerk zum Anfassen
      const r = trb(l, S, TRKIT, team);
      if (RG) { CUR_LOD = 0; attachRunningGear(r.hull, RG); }
      RG = null;
      return r;
    });
    root.add(lodOf(lv.map((x) => x.hull), dists));
    if (lv[0].tur) {
      // Radschützenpanzer: Turm/Waffe/Rundblickoptik wie bei den Kettenfahrzeugen
      const tur = new THREE.Group(); tur.name = 'turret';
      tur.position.fromArray(D.turretPivot);
      tur.add(lodOf(lv.map((x) => x.tur), dists));
      const gun = new THREE.Group(); gun.name = 'gun';
      gun.position.fromArray(D.gunPivot);
      gun.add(lodOf(lv.map((x) => x.gun), dists));
      tur.add(gun);
      const cmg = new THREE.Group(); cmg.name = 'cmg';
      cmg.position.fromArray(D.cmgPivot);
      cmg.add(lodOf(lv.map((x) => x.cmg || new THREE.Group()), dists));
      tur.add(cmg);
      root.add(tur);
      CUR_LOD = 0;
      if (D.interior) { const crew = buildInterior(S, D); tur.add(crew.interior); gun.add(crew.breech); }
      else { const it = new THREE.Group(); it.name = 'interior'; it.visible = false; tur.add(it); }
    }
    if (trb) {
      CUR_LOD = 0;
      addHatches(D, S, team, root, root.getObjectByName('turret'));
      if (lv[0].inner) { lv[0].inner.name = 'hullInterior'; lv[0].inner.visible = false; root.add(lv[0].inner); }
      if (lv[0].ramp) root.add(lv[0].ramp);
      // Tarnlack je Epoche wie bei den Panzern
      const ep = eraPaint(team, D.era || 'modern'), base = S.paint[team] || S.paint.null;
      const walk = (o) => {
        if (o.name === 'interior' || o.name === 'hullInterior' || o.name === 'breech' || (o.name && o.name.startsWith('occ:'))) return;
        if (o.isMesh) { if (o.material === base && ep) o.material = ep; else if (HQ && o.material === S.rubber) o.material = S.rubberOut; }
        for (const c of o.children) walk(c);
      };
      walk(root);
    }
    if (lv[0].mg) {
      const mg = new THREE.Group(); mg.name = 'mg';
      mg.position.fromArray(D.mgPivot);
      mg.add(lodOf(lv.map((x) => x.mg), dists));
      root.add(mg);
    }
    const my = mountY(D);
    lv[0].wheels.forEach((w0, i) => {
      const pivot = new THREE.Group();
      pivot.name = `wheel${i}`;
      pivot.position.set(w0.x, my - (D.wheels.rest - staticComp(D)), w0.z);
      const spin = new THREE.Group(); spin.name = 'spin';
      spin.position.set(w0.dx || 0, w0.dy || 0, 0); // Darstellungsversatz (Stapler: kleinere Lenkräder)
      spin.add(lodOf(lv.map((x) => x.wheels[i].spin), dists));
      pivot.add(spin);
      pivot.userData = { axle: w0.axle, side: w0.side };
      root.add(pivot);
    });
    // Lenkrad + Insassenfiguren außerhalb der LOD-Stufen (klein; Figuren nur sichtbar, wenn der Sitz besetzt ist)
    for (const o of lv[0].extra || []) root.add(o);
  }
  // Lichtkegel (unbeleuchtet, additiv – nur sichtbar, wenn die Scheinwerfer an sind)
  for (const L of VEHICLES[type].lights) {
    const g = new THREE.ConeGeometry(1.5, 9, 14, 1, true);
    g.translate(0, -4.5, 0);
    g.rotateX(-HP);
    const cone = new THREE.Mesh(g, S.cone);
    cone.position.fromArray(L);
    cone.position.z -= 0.05;
    cone.rotation.x = -0.06;
    cone.visible = false;
    cone.userData.cone = true;
    cone.renderOrder = 5;
    root.add(cone);
  }
  TEMPLATES.set(key, root);
  return root;
}

/** Fahrzeugmodell erzeugen (Klon der Vorlage). quality: low|medium|high|ultra. */
export function createVehicleModel(type, { team = null, quality = 'high', variant = 0 } = {}) {
  const S = vehicleMaterials();
  const tpl = template(type, team, quality, variant);
  const root = tpl.clone(true);
  const model = {
    root, type,
    turret: root.getObjectByName('turret') || null,
    gun: root.getObjectByName('gun') || null,
    cmg: root.getObjectByName('cmg') || null,
    mg: root.getObjectByName('mg') || null,
    wheels: [], trackMats: [], trackK: [1, 1], trackLen: [1, 1],
    lenses: [], cones: [], meshes: [], occ: [], rwMeshes: [], linkMeshes: [],
    lightsOn: false, wrecked: false,
  };
  const hq = quality !== 'low';
  const tm = [trackMaterial(hq), trackMaterial(hq)];
  root.traverse((o) => {
    if (o.isMesh) {
      model.meshes.push(o);
      if (o.userData.lens) model.lenses.push(o);
      if (o.userData.cone) model.cones.push(o);
      if (o.userData.track != null) {
        o.material = tm[o.userData.track];
        model.trackK[o.userData.track] = o.userData.trackK;
        model.trackLen[o.userData.track] = o.userData.trackLen;
      }
      o.userData.baseMat = o.material;
    }
    if (o.userData.rw) model.rwMeshes.push(o);
    if (o.userData.links) model.linkMeshes.push(o);
    if (o.name && o.name.startsWith('wheel')) model.wheels.push({ pivot: o, spin: o.getObjectByName('spin'), axle: o.userData.axle, side: o.userData.side });
    if (o.name && o.name.startsWith('occ:')) model.occ[+o.name.slice(4)] = o;
  });
  // Zivilfahrzeuge: Lenkrad (dreht mit dem Einschlag, vehicle.js sync) und Insassenfiguren je Sitz
  model.steerWheel = root.getObjectByName('lenkrad:dreh') || null;
  model.setOccupant = (i, on) => { const o = model.occ[i]; if (o) o.visible = !!on && !model.wrecked; };
  if (VEHICLES[type] && (VEHICLES[type].drive === 'tracked' || VEHICLES[type].halftrack)) model.trackMats = tm;
  else for (const m of tm) { m.map.dispose(); m.normalMap?.dispose(); m.dispose(); }

  model.setLights = (on) => {
    model.lightsOn = !!on && !model.wrecked;
    for (const l of model.lenses) l.material = model.lightsOn ? S.lensOn : S.lensOff;
    for (const c of model.cones) c.visible = model.lightsOn;
  };
  model.setWreck = (on) => {
    model.wrecked = !!on;
    for (const o of model.meshes) {
      if (o.userData.cone) continue;
      const base = o.userData.baseMat;
      if (on) {
        if (base === S.glass || base === S.optic || o.userData.lens) { o.visible = false; continue; }
        o.material = S.wreck;
      } else { o.visible = true; o.material = base; }
    }
    if (on) {
      if (VEHICLES[type] && VEHICLES[type].armored && model.addScar) {
        root.updateMatrixWorld(true);
        const D = VEHICLES[type], hb = D.hullBox;
        for (let i = 0; i < 6; i++) {
          const p = new THREE.Vector3(hb[0] + (Math.random() - 0.5) * hb[3] * 2, hb[1] + Math.random() * hb[4] * 1.6, hb[2] + (Math.random() - 0.5) * hb[5] * 2);
          root.localToWorld(p);
          model.addScar(p, { hole: i < 2, size: 1.1 + Math.random() * 0.8 });
        }
      }
      for (const o of model.occ) if (o) o.visible = false;
      model.setLights(false);
      for (const id of Object.keys(model.hatches)) model.setHatch(id, 0);
      model.setInterior(false);
      model.setHeld(null);
    } else applyRack();
  };
  // Laufwerk zum Anfassen (high/ultra, Nahstufe): Rollen drehen und federn, Glieder laufen um und folgen den Rollen
  const hullLod = root.children.find((c) => c.isLOD) || null;
  const run = { d: [0, 0], first: true, sig: 0, dy: new Float32Array(16), matT: 0 };
  const _rq = new THREE.Quaternion(), _rp = new THREE.Vector3(), _rs = new THREE.Vector3(1, 1, 1), _rm = new THREE.Matrix4(), _rx = new THREE.Vector3(1, 0, 0);
  model.syncRunning = (veh, dt) => {
    if (!model.linkMeshes.length && !model.rwMeshes.length) return;
    if (!root.visible || model.wrecked || !hullLod || hullLod.getCurrentLevel() !== 0) return;
    const b = veh.body, ts = b.trackSpeed || [0, 0], D = veh.def, W = D.wheels, nAx = W.z.length, cs = staticComp(D);
    run.d[0] += (ts[0] || 0) * dt; run.d[1] += (ts[1] || 0) * dt;
    let sig = 0;
    const bws = b.wheels || [];
    for (let i = 0; i < bws.length && i < 16; i++) { const bw = bws[i]; const dy = bw.contact ? Math.max(-0.1, Math.min(0.12, bw.comp - cs)) : 0; run.dy[i] = dy; sig += dy * (i + 1); }
    if (!run.first && Math.abs(ts[0] || 0) < 1e-3 && Math.abs(ts[1] || 0) < 1e-3 && Math.abs(sig - run.sig) < 1e-3) return;
    run.first = false; run.sig = sig;
    if ((run.matT -= dt) <= 0) { run.matT = 5; linkMaterial(); } // Fotoscan nachziehen
    const dyAt = (side, z) => {
      if (!bws.length) return 0;
      const Z = W.z, o = side * nAx;
      if (z <= Z[0]) return run.dy[o];
      for (let k = 1; k < nAx; k++) if (z <= Z[k]) { const f = (z - Z[k - 1]) / (Z[k] - Z[k - 1]); return run.dy[o + k - 1] * (1 - f) + run.dy[o + k] * f; }
      return run.dy[o + nAx - 1];
    };
    for (const im of model.rwMeshes) {
      const U = im.userData.rw;
      for (let k = 0; k < U.centers.length; k++) {
        const c = U.centers[k], side = c[0] < 0 ? 0 : 1;
        _rq.setFromAxisAngle(_rx, -run.d[side] / U.r);
        im.setMatrixAt(k, _rm.compose(_rp.set(c[0], c[1] + (U.fixed ? 0 : dyAt(side, c[2])), c[2]), _rq, _rs));
      }
      im.instanceMatrix.needsUpdate = true;
    }
    for (const im of model.linkMeshes) placeLinks(im, dyAt, run.d[im.userData.links.side]);
  };
  /**
   * Treffer-/Brandspur an einem Weltpunkt (vehicle.js applyDamage bei Granaten/Explosionen, Wrack): Strahl von außen auf
   * die Nahstufe der Wanne bzw. des Turms → Fleck liegt auf der echten Fläche (Normale), höchstens 12 je Fahrzeug.
   */
  model.scars = [];
  const turLod = model.turret ? model.turret.children.find((c) => c.isLOD) : null;
  model.addScar = (point, { hole = true, size = 0.9 } = {}) => {
    const targets = [hullLod && hullLod.levels[0] && hullLod.levels[0].object, turLod && turLod.levels[0] && turLod.levels[0].object].filter(Boolean);
    if (!targets.length || !point) return false;
    root.updateMatrixWorld(true);
    root.getWorldPosition(_sc); _sc.y += 1.2;
    _sn.subVectors(point, _sc);
    if (_sn.lengthSq() < 1e-6) _sn.set(0, 1, 0);
    _sn.normalize();
    _so.copy(point).addScaledVector(_sn, 2.5);
    _sr.set(_so, _sn.clone().negate());
    _sr.far = 5;
    const hit = _sr.intersectObjects(targets, true).find((h) => h.object.isMesh && !h.object.isInstancedMesh && h.face && h.object.material !== S.optic && h.object.material !== S.glass);
    if (!hit) return false;
    const mat = scarMaterial();
    const m = new THREE.Mesh(SCAR_GEO[hole ? 0 : 1], mat);
    m.name = 'brandspur';
    m.renderOrder = 3;
    _snm.getNormalMatrix(hit.object.matrixWorld);
    const n = hit.face.normal.clone().applyMatrix3(_snm).normalize();
    const parent = hit.object.parent;
    parent.updateMatrixWorld(true);
    m.position.copy(hit.point).addScaledVector(n, 0.012);
    parent.worldToLocal(m.position);
    const ql = new THREE.Quaternion().setFromUnitVectors(_sz, n);
    parent.getWorldQuaternion(_rq).invert();
    m.quaternion.copy(_rq).multiply(ql);
    m.rotateZ(Math.random() * Math.PI * 2);
    m.scale.setScalar(size * (0.8 + Math.random() * 0.4));
    m.castShadow = false; m.receiveShadow = true;
    parent.add(m);
    model.scars.push(m);
    if (model.scars.length > 12) model.scars.shift().removeFromParent();
    return true;
  };
  /** Kettenlauf: Geschwindigkeit links/rechts (m/s) über dt. */
  model.scrollTracks = (vl, vr, dt) => {
    for (let i = 0; i < model.trackMats.length; i++) {
      const v = i === 0 ? vl : vr;
      const t = model.trackMats[i].map;
      t.offset.x = (t.offset.x - (v * dt * model.trackK[i]) / model.trackLen[i]) % 1;
      if (model.trackMats[i].normalMap) model.trackMats[i].normalMap.offset.x = t.offset.x;
    }
  };
  // Besatzung (panzer-mp.md §3.7): Luken, Innenraum, Verschluss, Gestell, Granate in der Hand – Kettenfahrzeuge
  model.hatches = {};
  for (const id of ['driver', 'commander', 'loader']) { const h = root.getObjectByName(`hatch:${id}`); if (h) model.hatches[id] = h; }
  model.interior = (model.turret && model.turret.getObjectByName('interior')) || null;
  model.breech = (model.gun && model.gun.getObjectByName('breech')) || null;
  const keil = model.breech ? model.breech.getObjectByName('breech:keil') : null;
  const held = model.interior ? model.interior.getObjectByName('held') : null;
  const racks = [];
  if (model.interior) model.interior.traverse((o) => { if (o.isMesh && o.userData.rack) racks.push({ mesh: o, type: o.userData.rack, per: o.userData.per, slots: o.userData.slots, own: false }); });
  const want = { mbt_ap: Infinity, mbt_he: Infinity };
  const clamp01 = (t) => Math.max(0, Math.min(1, Number(t) || 0));
  /** Sichtbare Granaten anwenden – eigene Geometriekopie erst, wenn weniger als alle gezeigt werden und der
   * Innenraum sichtbar ist (fremde Panzer teilen weiter die Vorlage). */
  const applyRack = () => {
    for (const R of racks) {
      const n = Math.max(0, Math.min(R.slots, Math.floor(want[R.type] ?? R.slots)));
      R.mesh.userData.shown = n;
      R.mesh.visible = n > 0;
      if (n < R.slots && !R.own) {
        if (!model.interior.visible) continue;
        R.mesh.geometry = R.mesh.geometry.clone();
        R.own = true;
      }
      if (R.own) R.mesh.geometry.setDrawRange(0, n * R.per);
    }
  };
  model.setHatch = (id, t) => {
    const h = model.hatches[id];
    if (!h) return;
    const H = h.userData.hatch, a = (model.wrecked ? 0 : clamp01(t)) * HATCH_OPEN * H.sign;
    h.rotation.set(H.axis === 'x' ? a : 0, 0, H.axis === 'z' ? a : 0);
  };
  // Turm-Außenhülle (LOD): innen ausgeblendet – beim kleineren Turm (2. WK) ragten Kennung/Seitenluken in den Innenraum
  const turShell = model.turret ? model.turret.children.find((c) => c.isLOD) : null;
  // Wannen-Außenhülle: mit Turmkorb durch die Drehkranz-Öffnung sichtbar – im Innenraum ausgeblendet (der Kampfraum
  // der Wanne umschließt den Blick), sonst deckte das Wannendach den Korb ab
  model.hullInterior = root.getObjectByName('hullInterior') || null;
  const hullShell = model.hullInterior || driverCabin(VEHICLES[type]) ? root.children.find((c) => c.isLOD) : null; // auch ohne Turmkorb (1. WK): Fahrerkammer umschließt den Blick
  model.cabin = null;
  let cabinTried = false;
  model.setInterior = (on) => {
    if (!model.interior) return;
    const v = !!on && !model.wrecked;
    // Detail-Innenraum (cabin.js): erst beim ersten Öffnen gebaut/angehängt – fremde Panzer tragen ihn nie
    if (v && !cabinTried && !VEHICLES[type].noCabin) {
      cabinTried = true;
      try { model.cabin = attachCabin(model, VEHICLES[type], S, quality); } catch (err) { console.warn('[vehicles] Innenraum-Ausbau fehlgeschlagen:', err); model.cabin = null; }
    }
    if (model.cabin) setCabinVisible(model.cabin, v);
    model.interior.visible = v;
    if (turShell) turShell.visible = !v;
    if (model.hullInterior) model.hullInterior.visible = v;
    if (hullShell) hullShell.visible = !v;
    if (model.breech) model.breech.visible = v;
    if (v) applyRack();
  };
  const rackDoor = model.interior ? model.interior.getObjectByName('rackDoor') : null;
  /** Schiebetür des Munitionsbunkers: t 0 zu … 1 offen (fährt nach links weg). */
  model.setRackDoor = (t) => { if (rackDoor) rackDoor.position.x = -1.7 * clamp01(t); };
  // Geländewagen: ausgestatteter Fahrerplatz (Armaturen, Pedale, Funkgerät …) – lazy, nur lokaler Insasse in der Ego-Sicht
  model.cockpit = null;
  let cockTried = false;
  model.setCockpit = (on) => {
    const v = !!on && !model.wrecked;
    if (v && !cockTried) { cockTried = true; try { model.cockpit = attachCockpit(model, VEHICLES[type], S, quality); } catch (err) { console.warn('[vehicles] Fahrerplatz fehlgeschlagen:', err); } }
    if (model.cockpit) model.cockpit.grp.visible = v;
  };
  model.syncCockpit = (veh, dt) => { if (model.cockpit && model.cockpit.grp.visible) syncCockpit(model.cockpit, veh, dt); };
  /** Takt des Detail-Innenraums (vehicle.js _syncCrew, nur für den lokalen Insassen). */
  model.syncCabin = (veh, dt, ctx) => { if (model.cabin && model.interior && model.interior.visible) syncCabin(model.cabin, veh, dt, ctx); };
  model.setBreech = (t) => { if (keil) keil.position.y = -0.3 * clamp01(t); };
  model.setRack = (counts) => {
    if (!racks.length || !counts) return;
    for (const k of ['mbt_ap', 'mbt_he']) if (counts[k] != null) want[k] = Number(counts[k]) || 0;
    applyRack();
  };
  model.setHeld = (type) => {
    if (!held) return;
    held.visible = !!type;
    for (const c of held.children) c.visible = c.name === 'arms' || c.name === `held:${type}`;
  };
  // Lade-Ablauf (vehicle._syncCrew): kind 'greifen' | 'einschieben' | 'schliessen' | null, t 0…1, type Sorte
  const pushArm = model.interior ? model.interior.getObjectByName('pushArm') : null;
  const _lv = new THREE.Vector3(), _lh = new THREE.Vector3();
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const _home = new THREE.Vector3();
  model.setLoadAnim = (kind, t, type, shift = 0, yaw = 0) => {
    if (!held || !held.userData.home || !model.interior) return;
    const H = held.userData.home, I = model.interior;
    // Tragehaltung vor der Kamera: Auge (mit Schritt im Turm, views.js viewAnchor) + Versatz in Blickrichtung (Gier im Turm)
    const ex = H.eye[0] - 0.12 * Math.abs(shift), ey = H.eye[1] - 0.04 * Math.abs(shift), ez = H.eye[2] + 0.42 * shift;
    const c = Math.cos(yaw), sn = Math.sin(yaw), o = H.off;
    _home.set(ex + o[0] * c + o[2] * sn, ey + o[1], ez - o[0] * sn + o[2] * c);
    const homeRotY = yaw + H.ry;
    if (pushArm) pushArm.visible = false;
    held.position.copy(_home); held.rotation.set(H.rx, homeRotY, 0);
    if (!kind) return;
    if (kind === 'greifen') {
      const rp = I.userData.rackPos && I.userData.rackPos[type];
      held.visible = true;
      for (const c of held.children) c.visible = c.name === 'arms' || c.name === `held:${type}`;
      if (rp) {
        const e = ease(t);
        const ro = I.userData.rackOff || [0, 0, -0.55], rrot = I.userData.rackRot || [0, 0];
        _lv.set(rp[0] + ro[0], rp[1] + ro[1], rp[2] + ro[2]);
        held.position.lerpVectors(_lv, _home, e);
        const y0 = Math.PI + rrot[1];
        held.rotation.y = y0 + (homeRotY - y0) * ease((t - 0.25) / 0.75); // Spitze zeigt im Gestell zum Ladeschützen
        held.rotation.x = rrot[0] + (H.rx - rrot[0]) * e;
      }
    } else if (kind === 'einschieben' && model.breech) {
      model.breech.getWorldPosition(_lv); I.worldToLocal(_lv);
      _lv.z += 0.72;                                       // Granatenmitte vor der Ladeöffnung (Spitze an der Öffnung)
      if (t < 0.55) held.position.lerpVectors(_home, _lv, ease(t / 0.55));
      else { held.position.copy(_lv); held.position.z -= 0.95 * ease((t - 0.55) / 0.45); } // ins Rohr schieben
      held.rotation.set(H.rx * (1 - ease(t / 0.55)), homeRotY * (1 - ease(t / 0.55)), 0);
    } else if (kind === 'schliessen' && model.breech && pushArm) {
      model.breech.getWorldPosition(_lh); I.worldToLocal(_lh);
      _lh.x += 0.16; _lh.y += 0.12; _lh.z += 0.3;          // Griff am Keil
      _lv.set(_home.x + 0.15, _home.y + 0.05, _home.z + 0.2);
      pushArm.visible = true;
      const e = ease(Math.min(1, t * 2));
      pushArm.position.lerpVectors(_lv, _lh, e);
      if (t > 0.5) pushArm.position.y += 0.18 * ease((t - 0.5) * 2);  // Keil hochdrücken
    }
  };
  // Heckrampe / Hecktüren / Bordwand (data-troop.js ramp; Bauer liefert Gruppe 'ramp'): t 0 zu … 1 offen
  model.ramp = root.getObjectByName('ramp') || null;
  model.setRamp = (t) => {
    const R = model.ramp;
    if (!R) return;
    const k = model.wrecked ? 0 : clamp01(t), U = R.userData;
    if (U.kind === 'tueren') { for (const c of R.children) if (c.userData.door) c.rotation.y = c.userData.door * k * 1.7; }
    else R.rotation.x = (U.open || 1.4) * k;
  };
  model.dispose = () => {
    root.removeFromParent();
    for (const R of racks) if (R.own) { R.mesh.geometry.dispose(); R.own = false; }
    for (const m of model.trackMats) { m.map.dispose(); m.normalMap?.dispose(); m.dispose(); }
    model.trackMats = [];
  };
  return model;
}

/** Vorlagen vorbauen (Ladebildschirm) – optional. */
export function prepareVehicleModels(types, teams = ['A', 'B'], quality = 'high', variants = [0]) {
  for (const t of types) for (const team of teams) for (const v of variants) template(t, team, quality, v);
}

/** Dreiecke je LOD-Stufe (Prüfung/Budget). */
export function vehicleTriangles(type, quality = 'high') {
  const tpl = template(type, 'A', quality);
  const out = [0, 0, 0];
  tpl.traverse((o) => {
    if (!o.isLOD) return;
    o.levels.forEach((lv, i) => lv.object.traverse((m) => {
      if (m.isMesh) out[i] += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
    }));
  });
  return out.map(Math.round);
}

/** Dreiecke der Besatzungsteile außerhalb der LOD-Stufen (Prüfung/Budget §D.3): Luken, Innenraum inkl. Verschluss. */
export function vehicleExtraTriangles(type, quality = 'high') {
  const tpl = template(type, 'A', quality);
  const out = { hatches: 0, interior: 0 };
  const count = (o) => { let n = 0; o.traverse((m) => { if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }); return n; };
  tpl.traverse((o) => {
    if (o.name.startsWith('hatch:')) out.hatches += count(o);
    else if (o.name === 'interior' || o.name === 'breech' || o.name === 'hullInterior') out.interior += count(o);
  });
  out.hatches = Math.round(out.hatches); out.interior = Math.round(out.interior);
  return out;
}
