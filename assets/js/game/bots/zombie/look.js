// NULLPUNKT — Zombie-Modus: Aussehen der Untoten auf dem vorhandenen Soldaten-/Zivilisten-Rig (bots/soldier/*, unverändert).
// Nur additiv über die öffentliche Soldier-API und die Uniforms seines (eigenen) Materials:
//  • Kleidung: zivile Ausführungen (gear.js CIVIL_VARIANTS) bzw. Panzerbesatzung als gefallene Soldaten – je Typ eine Auswahl.
//  • Haut: fahl-graues Grün statt der Hauttöne (Gesicht + Hände/Hals über uPal[skin]), Augen milchig, Lider halb zu,
//    Mund leicht offen, kein Blinzeln (face.js API). Keine Wunden, kein Blut – bewusst maßvoll.
//  • Kleidung zerrissen: ein SkinnedMesh mit ausgefransten Stofffetzen am Skelett des Soldaten (Saum am Bauch, Ärmel,
//    Hosenbeine, Rücken), dunkel und matt; eine Geometrie für alle, ein Draw Call je Untotem, kein Sampler.
//  • Schmutz: Staub der Karte bis zur Hüfte kräftiger (uDust/uDustAmt), kein Mindestlicht und kein getöntes Randlicht –
//    sie dürfen im Schatten versinken (bedrückend statt arcadig). restoreLook() setzt die Uniforms zurück, bevor das Material
//    in den Pool der Soldaten zurückgeht.
import * as THREE from 'three';
import { BONE, BIND } from '../soldier/rig.js?v=20261123073102';

/** Kleidung je Typ (Ausführungs-Ids aus gear.js). */
const OUTFITS = {
  schlurfer: ['zivil', 'zivil-mantel', 'zivilistin-mantel', 'zivil-strick', 'zivil-hemd', 'panzerbesatzung', 'kapitaen'],
  hetzer: ['zivil-pullover', 'zivilistin-pullover', 'zivil-hemd', 'zivil'],
  huene: ['zivil-arbeit', 'panzerbesatzung-wk', 'zivil-mantel'],
};
/** Hauttöne (sRGB): fahles Grau mit einem Stich ins Grüne bzw. Gelbliche. */
const SKINS = ['#9d9f8c', '#a7a493', '#8f9384'];
const EYES = '#c9c6b6';

const hash = (n) => { let x = (n | 0) * 2654435761; x ^= x >>> 15; x = Math.imul(x, 2246822519); x ^= x >>> 13; return (x >>> 0) / 4294967296; };

/**
 * Aussehen für Typ + Samen (fest je Untotem). → { variant, face (Soldier-Option), arms (0 beide vorgestreckt,
 * 1 links hängend, 2 rechts hängend, 3 tief und breit), tilt (Kopfneigung −1…1), hunch (0…1), limp (Schlurfbein −1/1) }
 */
export function lookFor(typeId, seed = 1) {
  const list = OUTFITS[typeId] || OUTFITS.schlurfer;
  const r = (k) => hash(seed * 7 + k);
  const variant = list[Math.floor(r(1) * list.length) % list.length];
  const face = {
    cover: 'none', skin: SKINS[Math.floor(r(2) * SKINS.length) % SKINS.length], eyes: EYES,
    shape: Math.floor(r(3) * 8), stubble: 0.55, hairAmt: r(4) < 0.5 ? 0.35 : 0.7,
  };
  const arms = typeId === 'huene' ? 3 : r(5) < 0.55 ? 0 : r(6) < 0.5 ? 1 : 2;
  return { variant, face, arms, tilt: (r(7) * 2 - 1) * 0.9, hunch: typeId === 'hetzer' ? 0.55 : 0.75 + r(8) * 0.25, limp: r(9) < 0.5 ? -1 : 1 };
}

/* ------------------------------------------------------------------ Stofffetzen (zerrissene Kleidung) */

let RAG_GEO = null;
let RAG_MAT = null;

/**
 * Ausgefranster Fetzen als Dreiecksstreifen: oben am Gelenk (Modellraum der Bindehaltung), hängt nach unten.
 * [Knochen, x, y, z, Breite, Länge, Drehung um y (rad), Neigung nach außen]
 */
const FLAPS = [
  [BONE.spine, 0.06, 0.02, -0.165, 0.11, 0.17, 0, 0.12],
  [BONE.spine, -0.08, 0.0, -0.16, 0.08, 0.13, 0.2, 0.1],
  [BONE.spine, 0.12, 0.01, 0.12, 0.1, 0.15, Math.PI, 0.1],
  [BONE.chest, -0.05, -0.02, 0.15, 0.12, 0.2, Math.PI, 0.08],
  [BONE.foreArmL, -0.02, 0.02, 0.0, 0.07, 0.11, -Math.PI / 2, 0.15],
  [BONE.foreArmR, 0.02, 0.02, 0.0, 0.07, 0.1, Math.PI / 2, 0.15],
  [BONE.shinL, -0.02, -0.12, -0.07, 0.08, 0.13, 0.15, 0.1],
  [BONE.shinR, 0.03, -0.18, -0.07, 0.07, 0.1, -0.2, 0.1],
  [BONE.shinR, 0.06, -0.1, 0.05, 0.07, 0.12, Math.PI / 2, 0.1],
];

function ragGeometry() {
  if (RAG_GEO) return RAG_GEO;
  const pos = [], nrm = [], si = [], sw = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const [bone, x, y, z, w, len, yaw, out] of FLAPS) {
    const b = BIND[bone];
    // Spalten über die Breite, unterer Rand ausgefranst (zwei Höhen je Spalte)
    const cols = 5;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const ring = [];
    for (let i = 0; i <= cols; i++) {
      const u = (i / cols - 0.5) * w;
      const fray = len * (0.55 + 0.45 * rnd());
      const top = [u, 0, 0], bot = [u, -fray, -out * fray];
      ring.push([top, bot]);
    }
    const P = (p) => { v.set(p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c); return [b[0] + x + v.x, b[1] + y + v.y, b[2] + z + v.z]; };
    n.set(s, 0, c).normalize().negate();
    for (let i = 0; i < cols; i++) {
      const a0 = P(ring[i][0]), a1 = P(ring[i][1]), b0 = P(ring[i + 1][0]), b1 = P(ring[i + 1][1]);
      for (const p of [a0, a1, b0, b0, a1, b1]) { pos.push(...p); nrm.push(n.x, n.y, n.z); si.push(bone, 0, 0, 0); sw.push(1, 0, 0, 0); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.computeBoundingSphere();
  RAG_GEO = g;
  return g;
}

function ragMaterial() {
  if (RAG_MAT) return RAG_MAT;
  // ohne Textur (kein Sampler): dunkler, verschmutzter Stoff, beidseitig
  RAG_MAT = new THREE.MeshStandardMaterial({ color: 0x2f2b25, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  RAG_MAT.name = 'zombie:fetzen';
  return RAG_MAT;
}

/** Fetzen-Netz für die Aufwärmgruppe des Modus (gleiches Programm wie im Match). */
export function warmRagMesh() {
  const m = new THREE.Mesh(ragGeometry(), ragMaterial());
  m.name = 'aufwaermen:zombie-fetzen';
  return m;
}

/* ------------------------------------------------------------------ Anziehen / Zurücksetzen */

/**
 * Untoten-Aussehen auf einen frisch gebauten Soldaten legen (nach new Soldier). Merkt sich die alten Uniform-Werte in
 * soldier.userZombie (für restoreLook).
 */
export function dressZombie(soldier, look) {
  if (!soldier || soldier.userZombie) return;
  const U = soldier.material && soldier.material.userData && soldier.material.userData.npU;
  const keep = {};
  if (U) {
    for (const k of ['uDustAmt', 'uLightFloor', 'uRim', 'uRimTint']) if (U[k]) keep[k] = U[k].value;
    if (U.uDust) keep.uDust = U.uDust.value.clone();
    if (U.uDustAmt) U.uDustAmt.value = Math.max(1.4, (keep.uDustAmt || 0) * 2.2);
    if (U.uDust) U.uDust.value.lerp(new THREE.Color(0.075, 0.062, 0.048), 0.6);
    if (U.uLightFloor) U.uLightFloor.value = 0.04;
    if (U.uRim) U.uRim.value = 0.25;
    if (U.uRimTint) U.uRimTint.value = 0;
  }
  let rag = null;
  try {
    rag = new THREE.SkinnedMesh(ragGeometry(), ragMaterial());
    rag.name = 'zombie:fetzen';
    rag.frustumCulled = false;
    rag.castShadow = false;
    rag.bind(soldier.skeleton, new THREE.Matrix4());
    soldier.root.add(rag);
  } catch (err) { rag = null; if (typeof console !== 'undefined') console.warn('[zombie] Fetzen nicht verfügbar', err); }
  soldier.userZombie = { keep, rag, look };
  faceLook(soldier);
}

/** Gesicht: halb geschlossene Lider, leicht offener Mund, kein Blinzeln, leerer Blick. */
export function faceLook(soldier) {
  const f = soldier && soldier.face;
  if (!f) return;
  try {
    f.autoBlink = false;
    if (typeof f.setEyesClosed === 'function') f.setEyesClosed(0.32);
    if (typeof f.setExpression === 'function') f.setExpression('pain', 0.45, 0);
    if (typeof f.setJaw === 'function') f.setJaw(0.28);
    if (typeof f.setGaze === 'function') f.setGaze(0, -0.12);
  } catch { /* Gesicht optional */ }
}

/** Fetzen nur auf den nahen Stufen und solange der Körper lebt bzw. als Leiche sichtbar ist. */
export function syncRag(soldier) {
  const z = soldier && soldier.userZombie;
  if (!z || !z.rag) return;
  const on = soldier.lod < 2;
  if (z.rag.visible !== on) z.rag.visible = on;
}

/** Uniforms zurücksetzen und Fetzen lösen (vor soldier.dispose → Material geht zurück in den Pool). */
export function restoreLook(soldier) {
  const z = soldier && soldier.userZombie;
  if (!z) return;
  const U = soldier.material && soldier.material.userData && soldier.material.userData.npU;
  if (U) {
    for (const [k, v] of Object.entries(z.keep)) {
      if (!U[k]) continue;
      if (v && v.isColor) U[k].value.copy(v); else U[k].value = v;
    }
  }
  if (z.rag) z.rag.removeFromParent();
  soldier.userZombie = null;
}
