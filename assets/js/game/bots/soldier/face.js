// NULLPUNKT — Gesicht des Soldaten: anatomischer Kopf (face-mesh.js, Grundnetz MakeHuman hm08, CC0) mit gebackenen Hautkarten
// (face-skin.js), Haut-Shader und Gesichts-API für Zwischensequenzen, Funksprüche und Lippensynchronität.
//
// ============================================================================ GESICHTS-API (soldier.face)
//
//   const s = createSoldier({ team, variant, face: { cover: 'none', res: 'cine', shape, skin, hair, hairAmt, stubble, beard, age, eyes }, cinematic: true });
//   (shape: Index in SHAPE_PRESETS oder Profil { age, african, asian, weight, muscle, jaw, chin, nose, noseW, brow, cheek, lips,
//    mouthW, skull, eyes, neck, bags, laugh, fat, prog, angles, cleft, asym, seed } – Werte meist −1…1, age in Jahren;
//    look: beard 'none'|'stoppel'|'kurz'|'voll'|'schnauzer'|'kinnbart', stubble 0…1, hairAmt 0 kahl…1, recede, brows, freckles)
//   hairStyle: Frisur als Geometrie (hair.js) 'kurz'|'scheitel'|'buerste'|'kranz'|'glatze'|'dutt'|'zopf'|'offen', '' = keine;
//    ohne Angabe: Zivilistinnen nach Ausführung, Männer nach Profil – nur ohne Helm/Mütze/Abdeckung; Voll-/kurzer Bart als Geometrie
//   const f = s.face;               // SoldierFace | null (null nur bei face: false)
//
//   Lippen / Mund
//     f.setViseme(id, w = 1)        Ziel-Mundform (eine aktive Form, weich überblendet – Koartikulation macht die Feder).
//                                   ids: 'sil'/'rest' (Ruhe), 'closed', 'A'|'aa', 'E', 'I', 'O', 'U', 'FV'|'FF', 'MBP'|'PP',
//                                   'L', außerdem Oculus-Satz 'TH','DD','kk','CH','SS','nn','RR' (campaign/lipsync.js).
//     f.setVisemeWeights({ A: .6, O: .4 })   gemischte Mundform (Gewichte werden normiert, Rest = Ruhe)
//     f.setMouth({ open, wide, round, press, teeth, tuck, tongue })   Kanäle direkt (0…1; wide 0,3 = neutral)
//     f.setJaw(open)                Kiefer direkt (0…1,2), überschreibt den Kanal 'open'
//   Mimik
//     f.setExpression(id, w = 1, fade = 0.35)   'neutral' | 'angry'/'wuetend' | 'worried'/'besorgt' | 'smile'/'laecheln' |
//                                   'surprised'/'ueberrascht' | 'pain'/'schmerz' | Kampagne: 'ernst', 'angespannt', 'fragend',
//                                   'nachdenklich', 'erleichtert', 'traurig', 'entschlossen'
//     f.setExpressionWeights({ angry: .5, worried: .5 })
//   Augen
//     f.lookAt(vec3Welt | null)     Blickziel (beide Augen konvergieren; null = geradeaus mit kleinen Sakkaden)
//     f.setGaze(yaw, pitch)         Blick relativ zum Kopf (rad; + yaw = zur rechten Seite der Figur, + pitch = hoch), löscht lookAt
//     f.blink(dauer = 0.16)         einmal blinzeln; f.autoBlink = true (Standard) blinzelt alle 2–6 s
//     f.setEyesClosed(w)            Lider dauerhaft (0 offen … 1 zu), z. B. Schlaf/Bewusstlos
//   Sonstiges
//     f.setMorph(name, w)           Rohzugriff (FACE_MORPHS), überschreibt Mund/Mimik bis setMorph(name, null)
//     f.update(dt) / f.updateFace(dt)  fortschreiben – soldier.animate() ruft das selbst; wer updateFace() von außen
//                                   ruft (Kampagne), übernimmt die Fortschreibung (keine doppelte Zeit je Bild)
//     f.forceVisible = true         auch außerhalb der Nah-Detailstufe zeichnen (Zwischensequenzen setzen cinematic)
//     f.mesh                        THREE.SkinnedMesh (Kopf, am Skelett des Soldaten) – null, bis f.ready erfüllt ist
//     f.ready                       Promise<f>: Kopfnetz + Hautkarten fertig (Hintergrund-Rechner); API-Aufrufe vorher wirken danach
//     f.setCover('none'|'balaclava'|'gaiter'|'shemagh')  Abdeckung umschalten (Stoff über Mund/Nase bewegt sich mit)
//   Exporte: VISEMES, EXPRESSIONS, FACE_MORPHS (Morph-Ziele), SHAPE_PRESETS, faceStats()
//
// Morph-Ziele (je Kopfform, geteilt): jawOpen, lipsWide, lipsRound, lipsPress, lipsPart, lipTuck, tongueUp, smile, frown,
// sneer, browDown, browInnerUp, browUp, blink, squint, lidWide. Lider sind echte Geometrie (gleiten über den Augapfel);
// Iris/Pupille folgen dem Blick über Uniforms (Augapfel = Teil des Kopfnetzes); Brauen, Bart, Wimpern, Poren, Falten stecken
// in den Hautkarten und bewegen sich mit der Haut; Mimikfalten (Stirn, Zornesfalte, Krähenfüße) blendet der Shader ein.
//
// Kosten (gemessen, faceStats()): Kopf 'near'/'mid' ≈ 10 000 Dreiecke, 'cine' ≈ 38 000 (nur Zwischensequenzen); Hautkarten
// 2 × RGBA8 + Mipmaps: cine 1024×2048 (≈ 22 MB GPU), near 512×1024 (≈ 5,6 MB), mid/low 256×512 – geteilt je Aussehen
// (Bots: höchstens 6 Gesichter je Sitzung). Aufbau im Hintergrund-Rechner (face-worker.js). Zeichnen: +1 Draw Call je
// Soldat auf Detailstufe 0; der Körper zeichnet dann seinen Kopf nicht (gleiche Puffer, kürzerer drawRange).
// Telefone (quality low) bekommen im Spiel keinen Detailkopf (Detailstufe 1 schon aus der Nähe), in Zwischensequenzen den
// einfachen Shader (NP_LOW, ohne Relief) und kleine Karten.
import * as THREE from 'three';
import { FACE_MORPHS, HEAD_C, loadHeadAsset, buildHeadData, normProfile } from './face-mesh.js?v=20261122020853';
import { bakeFaceMaps, normLook } from './face-skin.js?v=20261122020853';
import { BONE } from './rig.js?v=20261122020853';
import { VARIANTS, variantDef, EAR_CUP } from './gear.js?v=20261122020853';
import { SKIN_TONES, SCHEMES } from './materials.js?v=20261122020853';
import { BODY_MESH } from './body-mesh.js?v=20261122020853';
import { hairGeometry, beardGeometry, hairMaterial, pickHairStyle, disposeHair } from './hair.js?v=20261122020853';

export { FACE_MORPHS };

/* ------------------------------------------------------------------ Mundformen / Mimik */

const CH = ['open', 'wide', 'round', 'press', 'teeth', 'tuck', 'tongue'];
const V0 = { open: 0, wide: 0.3, round: 0, press: 0.35, teeth: 0, tuck: 0, tongue: 0 };
const vs = (o) => Object.freeze({ ...V0, press: 0, ...o });
export const VISEMES = Object.freeze({
  sil: Object.freeze({ ...V0 }),
  closed: vs({ press: 0.65 }),
  PP: vs({ round: 0.12, press: 1 }),
  FF: vs({ open: 0.1, wide: 0.42, press: 0.2, teeth: 0.6, tuck: 1 }),
  TH: vs({ open: 0.2, wide: 0.42, teeth: 0.7, tongue: 0.6 }),
  DD: vs({ open: 0.24, wide: 0.45, round: 0.05, teeth: 0.45, tongue: 0.5 }),
  kk: vs({ open: 0.34, wide: 0.4, round: 0.05, teeth: 0.2 }),
  CH: vs({ open: 0.2, wide: 0.12, round: 0.8, teeth: 0.6 }),
  SS: vs({ open: 0.1, wide: 0.62, teeth: 1 }),
  nn: vs({ open: 0.18, wide: 0.42, round: 0.05, teeth: 0.3, tongue: 0.6 }),
  RR: vs({ open: 0.3, wide: 0.3, round: 0.3, teeth: 0.2 }),
  aa: vs({ open: 1, wide: 0.55, teeth: 0.15 }),
  E: vs({ open: 0.55, wide: 0.78, teeth: 0.4 }),
  I: vs({ open: 0.28, wide: 1, teeth: 0.6 }),
  O: vs({ open: 0.62, wide: 0.12, round: 0.85 }),
  U: vs({ open: 0.3, wide: 0, round: 1 }),
  L: vs({ open: 0.36, wide: 0.45, teeth: 0.35, tongue: 1 }),
});
const VISEME_ALIAS = { rest: 'sil', ruhe: 'sil', x: 'sil', '': 'sil', a: 'aa', A: 'aa', e: 'E', i: 'I', o: 'O', u: 'U', FV: 'FF', fv: 'FF', F: 'FF', V: 'FF', MBP: 'PP', mbp: 'PP', M: 'PP', B: 'PP', P: 'PP', l: 'L', zu: 'closed', geschlossen: 'closed' };
const visemeOf = (id) => VISEMES[id] || VISEMES[VISEME_ALIAS[id]] || VISEMES.sil;

// Mimik: Morph-Anteile (squint = Unterlid hoch + Wange, lidOpen = Oberlid weit, lidDroop = Oberlid hängt; press/jaw/wide/part
// addieren sich zu den Mundkanälen)
const EXPR = {
  neutral: {},
  angry: { browDown: 1, sneer: 0.45, squint: 0.55, press: 0.45, frown: 0.25 },
  worried: { browInnerUp: 1, frown: 0.5, lidOpen: 0.25, wide: 0.1 },
  smile: { smile: 1, squint: 0.55, wide: 0.35, part: 0.3, browUp: 0.08 },
  surprised: { browUp: 1, lidOpen: 0.85, jaw: 0.22 },
  pain: { browDown: 0.7, browInnerUp: 0.6, squint: 1, sneer: 0.7, wide: 0.45, jaw: 0.1, part: 0.4 },
  ernst: { browDown: 0.35, press: 0.3, frown: 0.15, squint: 0.15 },
  angespannt: { browDown: 0.55, squint: 0.35, press: 0.4, wide: 0.1 },
  fragend: { browUp: 0.4, browInnerUp: 0.3, lidOpen: 0.2 },
  nachdenklich: { browDown: 0.25, browInnerUp: 0.3, squint: 0.35, frown: 0.25, press: 0.2 },
  erleichtert: { smile: 0.55, browInnerUp: 0.25, squint: 0.2, wide: 0.1, part: 0.2 },
  traurig: { browInnerUp: 0.9, frown: 0.8, lidDroop: 0.4 },
  entschlossen: { browDown: 0.45, press: 0.45, squint: 0.3 },
};
const EXPR_ALIAS = { wuetend: 'angry', 'wütend': 'angry', zornig: 'angry', besorgt: 'worried', sorge: 'worried', laecheln: 'smile', 'lächeln': 'smile', happy: 'smile', froh: 'smile', ueberrascht: 'surprised', 'überrascht': 'surprised', schmerz: 'pain', sad: 'traurig', ruhig: 'neutral' };
export const EXPRESSIONS = Object.freeze(Object.keys(EXPR));
const EXPR_KEYS = ['smile', 'frown', 'sneer', 'browDown', 'browInnerUp', 'browUp', 'squint', 'lidOpen', 'lidDroop', 'press', 'jaw', 'wide', 'part'];
const exprOf = (id) => EXPR[id] || EXPR[EXPR_ALIAS[id]] || EXPR.neutral;

/* ------------------------------------------------------------------ Kopfformen (Profile) */

/**
 * Vorgefertigte Gesichter (Bots: Auswahl je Soldat; Kampagne: je Name). Jeweils Form (face-mesh.js normProfile) und
 * Aussehen der Haut (face-skin.js normLook). Alter 21–56, verschiedene Herkunft, Statur, Bart.
 */
// mensch4: Kieferbreite der Ausreißer zurückgenommen (Kiefer/Jochbein 0,92–0,96 → ≈ 0,88)
export const SHAPE_PRESETS = Object.freeze([
  { age: 24, jaw: 0.3, chin: 0.2, brow: 0.2, cheek: 0.2, lips: -0.2, nose: 0.1, muscle: 0.5, weight: -0.2, laugh: -0.2, seed: 11, look: { beard: 'stoppel', stubble: 0.45, freckles: 0.4, moles: 0.4, recede: 0.05 } },
  { age: 41, african: 0.9, jaw: 0.3, chin: 0.1, nose: 0.2, noseW: 0.4, brow: 0.5, cheek: 0.3, lips: 0.2, skull: 0.2, muscle: 0.6, bags: 0.4, seed: 23, look: { beard: 'kurz', stubble: 0.8, freckles: 0, moles: 0.3, recede: 0.3 } },
  { age: 33, asian: 0.85, jaw: -0.2, chin: -0.1, nose: -0.3, noseW: 0.1, brow: -0.3, cheek: 0.5, lips: -0.1, skull: 0.3, weight: -0.1, seed: 37, look: { beard: 'stoppel', stubble: 0.3, freckles: 0.05, moles: 0.6, recede: 0.1, brows: 0.85 } },
  { age: 52, jaw: 0.3, chin: 0.4, nose: 0.7, noseW: 0.3, brow: 0.6, cheek: -0.2, lips: -0.4, skull: 0.4, weight: 0.4, fat: 0.3, bags: 0.7, laugh: 0.6, prog: 0.2, seed: 41, look: { beard: 'stoppel', stubble: 0.9, freckles: 0.3, moles: 0.8, recede: 0.8, brows: 1.2 } },
  { age: 29, african: 0.35, asian: 0.1, jaw: 0.1, chin: 0.5, nose: 0.4, noseW: -0.2, brow: 0.3, cheek: 0.4, lips: 0.1, weight: -0.4, muscle: 0.3, cleft: 0.6, seed: 53, look: { beard: 'schnauzer', stubble: 0.6, freckles: 0.1, moles: 0.4, recede: 0.2 } },
  { age: 46, jaw: 0.4, chin: 0.5, nose: -0.2, noseW: 0.5, brow: 0.8, cheek: 0.6, lips: -0.3, skull: 0.5, weight: 0.2, muscle: 0.9, bags: 0.3, laugh: 0.4, angles: -0.4, seed: 67, look: { beard: 'voll', stubble: 1, freckles: 0.15, moles: 0.5, recede: 0.5, brows: 1.15 } },
  { age: 21, asian: 0.3, jaw: -0.4, chin: -0.3, nose: -0.1, noseW: -0.3, brow: -0.2, cheek: 0.1, lips: 0.2, weight: -0.5, eyes: 0.2, seed: 79, look: { beard: 'none', stubble: 0.25, freckles: 0.5, moles: 0.3, recede: 0 } },
  { age: 37, african: 0.6, jaw: 0.1, chin: -0.3, nose: 0.3, noseW: 0.7, brow: 0.4, cheek: 0.2, lips: 0.5, weight: 0.3, fat: 0.2, prog: 0.3, seed: 97, look: { beard: 'kinnbart', stubble: 0.7, freckles: 0, moles: 0.4, recede: 0.4 } },
  // 20.11.: mehr Alter/Bart/Herkunft (Zivilisten der Kampagne werden über den Namen zugeordnet)
  { age: 63, jaw: 0.2, chin: 0.3, nose: 0.6, noseW: 0.2, brow: 0.5, cheek: -0.4, lips: -0.5, skull: 0.2, weight: 0.1, bags: 0.9, laugh: 0.9, seed: 173, look: { beard: 'voll', stubble: 1, freckles: 0.4, moles: 0.9, recede: 0.95, brows: 1.3 } },
  { age: 27, african: 0.95, jaw: 0.2, chin: 0.3, nose: 0.1, noseW: 0.6, brow: 0.3, cheek: 0.4, lips: 0.4, weight: -0.2, muscle: 0.5, seed: 181, look: { beard: 'schnauzer', stubble: 0.5, freckles: 0, moles: 0.2, recede: 0.05 } },
  { age: 49, asian: 0.9, jaw: 0.1, chin: 0.2, nose: -0.2, noseW: 0.2, brow: -0.1, cheek: 0.6, lips: -0.2, weight: 0.3, fat: 0.2, bags: 0.5, seed: 191, look: { beard: 'kinnbart', stubble: 0.6, freckles: 0.05, moles: 0.5, recede: 0.5 } },
  { age: 34, jaw: -0.1, chin: -0.2, nose: 0.3, noseW: -0.1, brow: 0.2, cheek: 0.1, lips: 0.1, weight: -0.3, seed: 199, look: { beard: 'kurz', stubble: 0.85, freckles: 0.6, moles: 0.3, recede: 0.15, brows: 0.9 } },
]);

/**
 * Gesichter der Zivilistinnen (20.11., Ausführungen mit `female` in gear.js CIVIL_VARIANTS): Form-Ziel 'female' des Kopf-Assets,
 * kein Bart, feinere Brauen; Alter 23–61, verschiedene Herkunft. Frisur als Geometrie (gear.js), Haaransatz gemalt.
 */
export const FEMALE_PRESETS = Object.freeze([
  { female: 1, age: 44, jaw: -0.1, chin: 0.2, nose: 0.2, noseW: -0.2, brow: -0.2, cheek: 0.4, lips: 0.1, weight: -0.2, bags: 0.3, laugh: 0.3, seed: 113, look: { beard: 'none', stubble: 0, freckles: 0.2, moles: 0.5, recede: 0, brows: 0.75 } },
  { female: 1, age: 29, african: 0.85, jaw: -0.2, nose: 0.1, noseW: 0.5, cheek: 0.5, lips: 0.6, weight: -0.1, seed: 127, look: { beard: 'none', stubble: 0, freckles: 0, moles: 0.3, recede: 0, brows: 0.8 } },
  { female: 1, age: 36, asian: 0.8, jaw: -0.3, chin: -0.2, nose: -0.3, cheek: 0.6, lips: 0.1, eyes: 0.1, weight: -0.3, seed: 131, look: { beard: 'none', stubble: 0, freckles: 0.05, moles: 0.4, recede: 0, brows: 0.7 } },
  { female: 1, age: 58, jaw: 0.1, chin: 0.1, nose: 0.4, brow: 0.1, cheek: -0.2, lips: -0.3, weight: 0.3, fat: 0.3, bags: 0.8, laugh: 0.7, seed: 137, look: { beard: 'none', stubble: 0, freckles: 0.35, moles: 0.8, recede: 0, brows: 0.7 } },
  { female: 1, age: 24, jaw: -0.3, chin: 0.3, nose: -0.1, noseW: -0.3, cheek: 0.2, lips: 0.3, weight: -0.4, eyes: 0.15, seed: 149, look: { beard: 'none', stubble: 0, freckles: 0.6, moles: 0.3, recede: 0, brows: 0.8 } },
  { female: 1, age: 41, african: 0.4, asian: 0.1, jaw: 0.0, chin: 0.1, nose: 0.2, noseW: 0.3, cheek: 0.3, lips: 0.3, weight: 0.1, laugh: 0.2, seed: 157, look: { beard: 'none', stubble: 0, freckles: 0.1, moles: 0.4, recede: 0, brows: 0.8 } },
]);

/* ------------------------------------------------------------------ Kopfnetz + Karten (Hintergrund-Rechner, geteilt) */

const geoCache = new Map(), texCache = new Map();
const stats = { built: 0, ms: 0, texMs: 0, triangles: {}, tex: {}, texBytes: 0 };

function toGeometry(D, res, key) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(D.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(D.nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(D.uv, 2));
  g.setAttribute('aRest', new THREE.BufferAttribute(D.rest, 4));
  // mensch4: Stoffhülle unter Sturmhaube/Halstuch (face-mesh.js coverShell): Versatz zur Hülle + deren Normale
  if (D.cov) { g.setAttribute('aCov', new THREE.BufferAttribute(D.cov, 3)); g.setAttribute('aCovN', new THREE.BufferAttribute(D.covN, 3)); }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(D.ski, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(D.skw, 4, true));
  g.setIndex(new THREE.BufferAttribute(D.idx, 1));
  g.morphAttributes.position = D.morphs.map((m) => new THREE.BufferAttribute(m.pos, 3));
  g.morphAttributes.normal = D.morphs.map((m) => new THREE.BufferAttribute(m.nrm, 3));
  g.morphTargetsRelative = true;
  g.computeBoundingSphere();
  g.userData.triangles = D.triangles;
  g.userData.ms = Math.round(D.ms);
  g.userData.key = key;
  g.userData.eye = D.eye;
  g.name = 'gesicht:' + res;
  stats.built++; stats.ms += D.ms; stats.triangles[res] = D.triangles;
  return g;
}

function toTextures(T, key) {
  const mk = (data, name) => {
    const t = new THREE.DataTexture(data, T.w, T.h, THREE.RGBAFormat, THREE.UnsignedByteType);
    // Karte A trägt Hautfaktor × 0,5 (face-skin.js) – linear speichern: sRGB-Dekodierung machte jedes Gesicht ~2,3× dunkler
    // als Hals/Hände desselben Hauttons (gesamt 20.11.)
    t.colorSpace = THREE.NoColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 4;
    t.flipY = false;
    t.needsUpdate = true;
    t.name = 'gesicht-' + name + ':' + key;
    return t;
  };
  stats.texMs += T.ms; stats.tex[T.w + 'x' + T.h] = (stats.tex[T.w + 'x' + T.h] || 0) + 1;
  stats.texBytes += Math.round(T.w * T.h * 4 * 2 * 4 / 3);
  return { a: mk(T.a, 'a'), b: mk(T.b, 'b'), w: T.w, h: T.h };
}

// Hintergrund-Rechner (Modul-Worker); ohne Worker-Unterstützung: Hauptfaden (nach dem Laden des Assets)
let worker = null, workerBroken = false, jobSeq = 0;
const jobs = new Map(), pending = new Map();
function getWorker() {
  if (worker || workerBroken || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./face-worker.js?v=20261122020853', import.meta.url), { type: 'module', name: 'gesichter' });
    worker.onmessage = (e) => {
      const { id, D, T, error } = e.data || {};
      const j = jobs.get(id);
      if (!j) return;
      jobs.delete(id);
      if (error || !(D || T)) j.fallback(error); else j.resolve(D || T);
    };
    worker.onerror = () => { workerBroken = true; for (const j of jobs.values()) j.fallback(); jobs.clear(); worker = null; };
  } catch { workerBroken = true; worker = null; }
  return worker;
}

function runJob(msg, local) {
  return new Promise((resolve, reject) => {
    const fallback = () => { setTimeout(() => { local().then(resolve, reject); }, 0); };
    const w = getWorker();
    if (!w) { fallback(); return; }
    const id = ++jobSeq;
    jobs.set(id, { resolve, fallback });
    w.postMessage({ id, ...msg });
  });
}

const keyOf = (res, p) => res + '|' + JSON.stringify(p);

/** Kopf-Geometrie im Hintergrund → Promise<BufferGeometry> (gecacht je Auflösung × Profil). */
export function faceGeometryAsync(res = 'near', profile = {}) {
  const P = normProfile(profile);
  const key = keyOf(res, P);
  const g = geoCache.get(key);
  if (g) return Promise.resolve(g);
  let p = pending.get(key);
  if (p) return p;
  p = runJob({ kind: 'mesh', res, profile: P }, () => loadHeadAsset().then((A) => buildHeadData(A, res, P)))
    .then((D) => { const geo = toGeometry(D, res, key); geoCache.set(key, geo); pending.delete(key); return geo; });
  p.catch(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

/** Hautkarten im Hintergrund → Promise<{ a, b }> (gecacht je Größe × Aussehen). */
export function faceTexturesAsync(w, h, look = {}) {
  const Lk = normLook(look);
  const key = w + 'x' + h + '|' + JSON.stringify(Lk);
  const t = texCache.get(key);
  if (t) return Promise.resolve(t);
  let p = pending.get(key);
  if (p) return p;
  p = runJob({ kind: 'tex', look: Lk, w, h }, () => loadHeadAsset().then((A) => bakeFaceMaps(A, Lk, w, h)))
    .then((T) => { const tx = toTextures(T, key); texCache.set(key, tx); pending.delete(key); return tx; });
  p.catch(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

/** Diagnose: { built, ms, texMs, triangles: { near, cine … }, tex: { '512x1024': n }, texMB, cached } */
export function faceStats() { return { built: stats.built, ms: Math.round(stats.ms), texMs: Math.round(stats.texMs), triangles: { ...stats.triangles }, tex: { ...stats.tex }, texMB: +(stats.texBytes / 1048576).toFixed(1), cached: geoCache.size, cachedTex: texCache.size }; }

export function disposeFaceGeometries() {
  for (const g of geoCache.values()) g.dispose();
  for (const t of texCache.values()) { t.a.dispose(); t.b.dispose(); }
  geoCache.clear(); texCache.clear(); stats.texBytes = 0;
  disposeHair();
}

/* ------------------------------------------------------------------ Shader */

const COVER_ID = { none: 0, balaclava: 1, gaiter: 2, shemagh: 3, gasmask: 0 };

const GLSL_COMMON = /* glsl */`
uniform float uCover;
float npCoverMask( vec3 q ) {
	if ( uCover < 0.5 ) return 0.0;
	float ax = abs( q.x );
	float front = smoothstep( -0.02, -0.07, q.z );
	if ( uCover < 1.5 ) {
		// Sturmhaube: alles außer dem Augenschlitz
		float bx = smoothstep( 0.056, 0.05, ax ), by = smoothstep( 0.0185, 0.0145, abs( q.y - 0.0045 ) );
		return 1.0 - bx * by * smoothstep( -0.04, -0.06, q.z );
	}
	// Halstuch / Shemagh: Unterkante unter den Augen vorn, seitlich/hinten tiefer
	float edge = mix( -0.06, -0.015, front ) + 0.004 * sin( q.x * 160.0 ) * front;
	float c = smoothstep( 0.003, -0.003, q.y - edge );
	if ( uCover > 2.5 ) c = max( c, smoothstep( -0.01, 0.02, q.z + 0.03 * ( 1.0 - front ) ) * smoothstep( -0.03, 0.0, q.y ) ); // Shemagh: Hinterkopf
	return c;
}
`;

const VERT_HEAD = /* glsl */`
attribute vec4 aRest;
attribute vec3 aCov;
attribute vec3 aCovN;
varying vec4 vRest;
flat varying float vPart;
varying vec3 vMp;
varying vec2 vFUv;
uniform float uCoverEars;
uniform vec4 uEarCup; // mensch4: Gehörschutz – x Polster-Innenseite, y/z Ringmitte (relativ Kopfmitte), w an
uniform float uEarFill; // Kopfseite bis ans Polster andrücken (m, je Kopfform)
uniform vec4 uNeckLine; // mensch4: Halsausschnitt der Kleidung (y vorn, seitlich, hinten; z Mitte) relativ Kopfmitte
${GLSL_COMMON}
`;

const FRAG_HEAD = /* glsl */`
#define NP_FACE
varying vec4 vRest;
flat varying float vPart;
varying vec3 vMp;
varying vec2 vFUv;
float npMouthOcc = 1.0;
float npSss = 0.0;
float npThin = 0.0;
float npRough = 0.5;
float npH = 0.0;
float npAoT = 1.0;
const vec3 npSssCol = vec3( 1.0, 0.38, 0.27 );
uniform sampler2D uMapA;
uniform sampler2D uMapB;
uniform vec3 uSkin;
uniform vec3 uHairCol;
uniform vec3 uIris;
uniform vec3 uGazeL;
uniform vec3 uGazeR;
uniform vec4 uEyeL; // Mitte (relativ Kopfmitte), Radius
uniform vec4 uEyeR;
uniform vec4 uWrk; // Mimikfalten: Stirn, Zornesfalte, Krähenfüße/Lachfalten, Nasenrücken
uniform float uBrowY;
uniform float uMouthZ;
uniform float uBump;
uniform vec3 uCoverCol;
uniform vec3 uCoverCol2;
uniform float uSssAmt;
uniform float uDissolve;
uniform float uRim;
uniform float uRimPow;
uniform float uRimTint;
uniform vec3 uRimColor;
uniform float uLightFloor;
uniform float uAmbRef;
${GLSL_COMMON}
float npHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float npNoise( vec3 x ) {
	vec3 i = floor( x ), f = fract( x );
	f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( mix( npHash( i ), npHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( npHash( i + vec3( 0, 1, 0 ) ), npHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
		mix( mix( npHash( i + vec3( 0, 0, 1 ) ), npHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( npHash( i + vec3( 0, 1, 1 ) ), npHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
// Relief aus Karte B (+ Mimikfalten je Bereich), Meter
float npHeight( vec2 uv, vec3 q ) {
	vec4 t = texture2D( uMapB, uv );
	float ax = abs( q.x );
	float yb = q.y - uBrowY;
	float wFore = smoothstep( 0.004, 0.012, yb ) * uWrk.x;
	float wGlab = smoothstep( 0.014, 0.008, ax ) * smoothstep( -0.016, -0.006, yb ) * smoothstep( 0.02, 0.008, yb ) * uWrk.y;
	float wCrow = smoothstep( 0.04, 0.05, ax ) * uWrk.z + smoothstep( -0.02, -0.035, q.y - 0.007 ) * uWrk.z * 0.8;
	float wNose = smoothstep( 0.012, 0.004, ax ) * smoothstep( 0.0, -0.01, yb ) * uWrk.w;
	return ( t.r - 0.5 ) * 0.0005 - t.a * 0.00028 * clamp( wFore + wGlab + wCrow + wNose, 0.0, 1.2 );
}
`;

// Haut, Augen, Mund, Haare, Abdeckung → diffuseColor, npRough, npSss, npAoT
const FACE_ALBEDO = /* glsl */`
	vec3 q = vRest.xyz;
	float part = vPart;
	float fAo = clamp( vRest.w - floor( vRest.w * 0.5 + 0.01 ) * 2.0, 0.0, 1.0 );
	float ax = abs( q.x );
	vec3 alb = uSkin;
	npRough = 0.5;
	npSss = uSssAmt;
	if ( part < 1.5 || part > 4.5 ) {
		// Haut (Teil 0), Ohr (1), Mundraum (5): Hautkarten
		vec4 tA = texture2D( uMapA, vFUv );
		vec4 tB = texture2D( uMapB, vFUv );
		vec3 skin = uSkin * tA.rgb * 2.0;
		float hc = tA.a;
		vec3 hair = uHairCol * mix( 1.15, 0.8, hc );
		alb = mix( skin, hair, hc );
		npRough = mix( tB.b, 0.62, hc * 0.6 );
		npAoT = tB.g;
		npSss *= 1.0 - hc * 0.6;
		if ( part > 4.5 ) {
			// Mundraum: dunkelrot, nach hinten dunkler (aus der gemorphten Lage)
			float depth = smoothstep( 0.004, 0.03, vMp.z - uMouthZ );
			alb = mix( vec3( 0.36, 0.1, 0.09 ), vec3( 0.12, 0.025, 0.02 ), depth );
			npMouthOcc = mix( 0.55, 0.04, depth );
			npRough = 0.3;
			npSss = 0.2;
		}
		npThin = part > 0.5 && part < 1.5 ? 0.45 : 0.0;
	} else if ( part < 2.5 ) {
		// Augapfel: Lederhaut, Iris (Fasern, Krause, Limbusring), Pupille, Hornhautglanz – Iris folgt dem Blick
		vec4 E = q.x < 0.0 ? uEyeL : uEyeR;
		vec3 d = normalize( q - E.xyz );
		vec3 g = normalize( q.x < 0.0 ? uGazeL : uGazeR );
		float c = dot( d, g );
		float iris = smoothstep( 0.862, 0.874, c );
		float pupil = smoothstep( 0.972, 0.977, c );
		float limbal = smoothstep( 0.85, 0.872, c ) * ( 1.0 - smoothstep( 0.876, 0.92, c ) );
		vec3 tg = normalize( cross( g, vec3( 0.0, 1.0, 0.0 ) ) );
		float ang = atan( dot( d, cross( g, tg ) ), dot( d, tg ) );
		float rr = clamp( ( 1.0 - c ) / ( 1.0 - 0.868 ), 0.0, 1.0 ); // 0 Mitte … 1 Irisrand
		float fib = npNoise( vec3( ang * 14.0, rr * 9.0, 1.7 ) ) * 0.55 + npNoise( vec3( ang * 38.0, rr * 4.0, 5.1 ) ) * 0.45;
		float collar = smoothstep( 0.18, 0.0, abs( rr - 0.38 ) );
		vec3 irisC = uIris * ( 0.45 + 0.85 * fib );
		irisC = mix( irisC, uIris * vec3( 1.35, 1.2, 0.9 ) + vec3( 0.04, 0.025, 0.0 ), collar * 0.55 );
		irisC *= mix( 1.0, 0.55, smoothstep( 0.65, 1.0, rr ) );
		float vein = smoothstep( 0.62, 0.7, npNoise( vec3( ang * 6.0, c * 30.0, 3.3 ) ) ) * smoothstep( 0.85, 0.3, c );
		vec3 sclera = mix( vec3( 0.80, 0.77, 0.73 ), vec3( 0.78, 0.55, 0.5 ), vein * 0.5 );
		sclera *= mix( 0.86, 1.0, smoothstep( 0.2, 0.8, c ) );
		vec3 eyeC = mix( sclera, irisC, iris );
		eyeC *= 1.0 - 0.55 * limbal;
		eyeC = mix( eyeC, vec3( 0.01 ), pupil );
		alb = eyeC;
		npRough = mix( 0.12, 0.03, iris );
		npSss = 0.15;
		// mensch3: Oberlid und Wimpern verschatten den oberen Augapfel (sonst „starrer“ Blick), Augenwinkel dunkler/feucht
		float lidSh = smoothstep( -0.15, 0.8, ( q.y - E.y ) / E.w );
		float cornerSh = smoothstep( 0.55, 0.95, abs( d.x ) );
		alb *= ( 1.0 - 0.4 * lidSh ) * ( 1.0 - 0.3 * cornerSh );
		npAoT = fAo * ( 1.0 - 0.5 * lidSh );
	} else if ( part < 3.5 ) {
		// Zähne (uv.x = Bogen −1…1, uv.y = Höhe 0…1, unten +2) und Zahnfleisch
		float s = vFUv.x, t = vFUv.y - ( vFUv.y > 1.5 ? 2.0 : 0.0 );
		float k = abs( s ) * 7.2 + 0.5 * ( 1.0 - step( 0.0, s ) ) * 0.0;
		float gap = smoothstep( 0.06, 0.0, abs( fract( k + 0.5 ) - 0.5 ) - 0.42 );
		float gum = smoothstep( 0.6, 0.72, t + 0.04 * cos( k * 6.2832 ) );
		vec3 enamel = mix( vec3( 0.80, 0.77, 0.68 ), vec3( 0.66, 0.66, 0.64 ), smoothstep( 0.12, 0.0, t ) );
		alb = mix( enamel * ( 1.0 - 0.55 * gap ), vec3( 0.62, 0.3, 0.3 ), gum );
		alb *= mix( 1.0, 0.45, smoothstep( 0.35, 1.0, abs( s ) ) );
		npRough = mix( 0.22, 0.35, gum );
		npSss = 0.25;
		npAoT = fAo;
	} else {
		// Zunge
		float pap = npNoise( q * 2600.0 );
		alb = vec3( 0.55, 0.22, 0.22 ) * ( 0.85 + 0.25 * pap );
		npRough = 0.35;
		npSss = 0.4;
		npAoT = fAo;
	}
	// Zähne/Zunge im Mundraum: nach hinten dunkler
	if ( part > 2.5 && part < 4.5 ) {
		float depth = smoothstep( 0.006, 0.035, vMp.z - uMouthZ );
		npMouthOcc = mix( 0.95, 0.12, depth );
	}
	// Abdeckung (Sturmhaube/Halstuch/Shemagh): Strickstoff
	float cov = npCoverMask( q ) * ( part > 1.5 && part < 2.5 ? 0.0 : 1.0 );
	if ( cov > 0.001 ) {
		float az = atan( q.x, -q.z ) * 0.075;
		float rib = 0.5 + 0.5 * sin( az * 2600.0 + npNoise( q * 400.0 ) * 1.5 );
		float fuzz = npNoise( q * 1800.0 );
		float mott = smoothstep( 0.35, 0.65, npNoise( q * 45.0 ) );
		vec3 fab = mix( uCoverCol, uCoverCol2, mott ) * ( 0.82 + 0.18 * rib ) * ( 0.9 + 0.2 * fuzz );
		alb = mix( alb, fab, cov );
		npRough = mix( npRough, 0.96, cov );
		npSss *= 1.0 - cov;
		npThin *= 1.0 - cov;
		npAoT = mix( npAoT, fAo * 0.15 + 0.8, cov ); // mensch4: Mund-/Nasenfalten-Verdeckung zeichnet sich nicht durch den Stoff
		npMouthOcc = mix( npMouthOcc, 1.0, cov );
	}
	diffuseColor.rgb *= alb;
`;

const FACE_NORMAL = /* glsl */`
	#ifndef NP_LOW
	{
		float part = vPart;
		float cov = npCoverMask( vRest.xyz );
		if ( ( part < 1.5 || part > 4.5 ) && cov < 0.99 ) {
			vec3 dpx = dFdx( -vViewPosition ), dpy = dFdy( -vViewPosition );
			vec2 dtx = dFdx( vFUv ), dty = dFdy( vFUv );
			float h0 = npHeight( vFUv, vRest.xyz );
			float dhx = ( npHeight( vFUv + dtx, vRest.xyz ) - h0 ) * uBump * ( 1.0 - cov );
			float dhy = ( npHeight( vFUv + dty, vRest.xyz ) - h0 ) * uBump * ( 1.0 - cov );
			vec3 r1 = cross( dpy, normal ), r2 = cross( normal, dpx );
			float det = dot( dpx, r1 );
			vec3 grad = sign( det ) * ( dhx * r1 + dhy * r2 );
			vec3 nn = normalize( abs( det ) * normal - grad );
			if ( !any( isnan( nn ) ) && abs( det ) > 1e-14 ) normal = nn;
		}
	}
	#endif
`;

// Haut-Streuung (Näherung): umschlingendes Licht über die Schattengrenze, rötlich; Gegenlicht durch dünne Stellen (Ohren)
const SSS_PATCH = /* glsl */`vec3 irradiance = dotNL * directLight.color;
	#ifdef NP_FACE
	{
		float npWrap = saturate( ( dot( geometryNormal, directLight.direction ) + 0.5 ) / 1.5 );
		vec3 npS = max( npWrap * npWrap - dotNL, 0.0 ) * directLight.color * npSssCol * npSss;
		npS += pow( saturate( dot( geometryViewDir, -directLight.direction ) ), 3.0 ) * directLight.color * npSssCol * npThin;
		reflectedLight.directDiffuse += npS * BRDF_Lambert( material.diffuseColor );
	}
	#endif`;

const RIM = /* glsl */`
	float sdLum = max( dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.02 );
	float sdAmb = clamp( dot( reflectedLight.indirectDiffuse, vec3( 0.2126, 0.7152, 0.0722 ) ) / sdLum * uAmbRef, 0.06, 1.25 );
	float sdRim = 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
	vec3 sdRimCol = mix( diffuseColor.rgb * 0.6 + vec3( 0.05, 0.055, 0.06 ), uRimColor * 0.5, uRimTint );
	outgoingLight += sdRimCol * pow( sdRim, uRimPow ) * uRim * sdAmb;
	outgoingLight = max( outgoingLight, diffuseColor.rgb * uLightFloor * min( sdAmb, 1.0 ) );
`;

function lin(hex) { return new THREE.Color(hex); }

let neutralTex = null;
function neutralMaps() {
  if (!neutralTex) {
    const mk = (r, g, b, a, srgb) => { const t = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t; };
    neutralTex = { a: mk(128, 128, 128, 0, false), b: mk(128, 220, 118, 0, false) };
  }
  return neutralTex;
}

/**
 * Material des Kopfes (eigenes Exemplar je Soldat: Blick, Farben, Mimikfalten sind Uniforms; Programm geteilt).
 * shared: Uniform-Objekte des Körpermaterials (Auflösen, Randlicht) – gleiche Werte ohne Abgleich.
 */
export function faceMaterial({ low = false, shared = null } = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, envMapIntensity: 0.8 });
  m.name = 'soldat:gesicht';
  const S = shared || {};
  const N = neutralMaps();
  const L = HEAD_C;
  const U = (m.userData.faceU = {
    uCover: { value: 0 }, uCoverEars: { value: 0 },
    uEarCup: { value: new THREE.Vector4(EAR_CUP.x, EAR_CUP.y - L[1], EAR_CUP.z - L[2], 0) }, uEarFill: { value: 0 }, uNeckLine: { value: new THREE.Vector4(-9, -9, -9, 0) },
    uMapA: { value: N.a }, uMapB: { value: N.b },
    uSkin: { value: lin('#b08c74') }, uHairCol: { value: lin('#2a2119') },
    uIris: { value: lin('#5a3c22') },
    uGazeL: { value: new THREE.Vector3(0, 0, -1) }, uGazeR: { value: new THREE.Vector3(0, 0, -1) },
    uEyeL: { value: new THREE.Vector4(-0.029, 1.69 - L[1], -0.076, 0.0124) }, uEyeR: { value: new THREE.Vector4(0.029, 1.69 - L[1], -0.076, 0.0124) },
    uWrk: { value: new THREE.Vector4(0, 0, 0, 0) },
    uBrowY: { value: 1.713 - L[1] }, uMouthZ: { value: -0.109 }, uBump: { value: 1 },
    uCoverCol: { value: lin('#2b2a27') }, uCoverCol2: { value: lin('#2b2a27') }, uSssAmt: { value: 0.55 },
    uDissolve: S.uDissolve || { value: 0 },
    uRim: S.uRim || { value: 0 }, uRimPow: S.uRimPow || { value: 3 }, uRimTint: S.uRimTint || { value: 0 },
    uRimColor: S.uRimColor || { value: new THREE.Color(1, 1, 1) }, uLightFloor: S.uLightFloor || { value: 0 }, uAmbRef: S.uAmbRef || { value: 2.4 },
  });
  if (low) m.defines = { NP_LOW: '' };
  m.onBeforeCompile = (shader) => {
    for (const k of Object.keys(U)) shader.uniforms[k] = U[k];
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <morphnormal_vertex>', `#include <morphnormal_vertex>
	{ float npCovN = npCoverMask( aRest.xyz ) * ( aRest.w > 3.9 && aRest.w < 6.0 ? 0.0 : 1.0 ); objectNormal = normalize( mix( objectNormal, aCovN, npCovN ) ); }`).replace('#include <morphtarget_vertex>', `#include <morphtarget_vertex>
	vRest = aRest;
	vPart = floor( aRest.w * 0.5 + 0.01 );
	vFUv = uv;
	{
		// Stoff über dem Gesicht: etwas aufgetragen, Mundbewegung gedämpft; Ohren unter der Haube angelegt
		// mensch4: Stoff spannt sich über die geglättete Hülle (aCov) statt 1:1 über Lippen/Nase; Mimik/Lippen darunter nur als
		// leichte Stoffbewegung (18 %)
		float npCov = npCoverMask( aRest.xyz ) * ( aRest.w > 3.9 && aRest.w < 6.0 ? 0.0 : 1.0 );
		transformed = position + aCov * npCov + ( transformed - position ) * ( 1.0 - npCov * 0.82 ) + normalize( mix( normal, aCovN, npCov ) ) * npCov * 0.0026;
		float npPart = floor( aRest.w * 0.5 + 0.01 );
		if ( npPart > 0.5 && npPart < 1.5 && uCoverEars > 0.5 ) transformed.x = mix( transformed.x, sign( transformed.x ) * 0.071, 0.6 );
		if ( uEarCup.w > 0.5 && npPart < 1.5 ) {
			// mensch4: Kapsel-Gehörschutz – Kopfseite unter dem Polsterring an dessen Innenseite, Ohr in der Kapsel angelegt
			float npAx = abs( aRest.x );
			float npR = length( vec2( ( aRest.y - uEarCup.y ) / ${EAR_CUP.sy.toFixed(3)}, ( aRest.z - uEarCup.z ) / ${EAR_CUP.sz.toFixed(3)} ) );
			float npFoot = ( 1.0 - smoothstep( ${(EAR_CUP.r + 0.006).toFixed(4)}, ${(EAR_CUP.r + 0.026).toFixed(4)}, npR ) ) * smoothstep( 0.035, 0.058, npAx );
			transformed.x += sign( aRest.x ) * uEarFill * npFoot;
			if ( npPart > 0.5 ) {
				vec3 npEc = vec3( sign( aRest.x ) * ( uEarCup.x + 0.004 ), uEarCup.y + ${L[1].toFixed(3)}, uEarCup.z + ${L[2].toFixed(3)} ); // Modellraum (uEarCup relativ zur Kopfmitte)
				transformed = npEc + ( transformed - npEc ) * vec3( 0.75, 0.8, 0.8 );
			}
		}
		{
			// mensch4 (Nutzer: Hautring zwischen Kragen und Hals): Halsansatz des Kopfnetzes unterhalb des Ausschnitts unter den Stoff
			// ziehen – sonst lag er gleichauf mit Hemd/Jacke und schimmerte rund um den Kragen durch
			vec2 npH = normalize( vec2( aRest.x, aRest.z - uNeckLine.w ) + 1e-5 );
			float npF = max( 0.0, -npH.y ), npB = max( 0.0, npH.y );
			npF *= npF; npB *= npB;
			float npYl = uNeckLine.x * npF + uNeckLine.z * npB + uNeckLine.y * max( 0.0, 1.0 - npF - npB );
			float npSink = ( 1.0 - smoothstep( npYl - 0.014, npYl + 0.008, aRest.y ) ) * ( npPart < 0.5 ? 1.0 : 0.0 );
			transformed -= normal * npSink * 0.009;
		}
		vMp = transformed - vec3( ${L[0].toFixed(3)}, ${L[1].toFixed(3)}, ${L[2].toFixed(3)} );
	}`);
    let fs = FRAG_HEAD + shader.fragmentShader;
    fs = fs.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace('vec3 irradiance = dotNL * directLight.color;', SSS_PATCH));
    fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
	float sdDis = 0.0;
	if ( uDissolve > 0.0 ) {
		vec3 dq = floor( ( vRest.xyz + vec3( ${L[0].toFixed(3)}, ${L[1].toFixed(3)}, ${L[2].toFixed(3)} ) ) * 34.0 );
		sdDis = fract( sin( dot( dq, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ) * 0.85 + fract( ( vRest.y + ${L[1].toFixed(3)} ) * 1.7 ) * 0.15;
		if ( sdDis < uDissolve ) discard;
	}`);
    fs = fs.replace('#include <color_fragment>', FACE_ALBEDO);
    fs = fs.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp( npRough, 0.03, 1.0 );');
    fs = fs.replace('#include <normal_fragment_maps>', FACE_NORMAL);
    fs = fs.replace('#include <aomap_fragment>', `#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= npAoT * npMouthOcc;
	reflectedLight.indirectSpecular *= mix( 1.0, npAoT, 0.85 ) * npMouthOcc;
	reflectedLight.directDiffuse *= mix( 1.0, npMouthOcc, 0.85 ) * mix( 1.0, npAoT, 0.35 );
	reflectedLight.directSpecular *= npMouthOcc * mix( 1.0, npAoT, 0.6 );`);
    fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	if ( uDissolve > 0.0 && sdDis < uDissolve + 0.035 ) totalEmissiveRadiance += vec3( 1.0, 0.36, 0.08 ) * 0.6;`);
    fs = fs.replace('#include <opaque_fragment>', `${RIM}
	#include <opaque_fragment>`);
    shader.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'np-face-8' + (low ? 'l' : 'h');
  return m;
}

/* ------------------------------------------------------------------ Gesicht am Soldaten */

// Shaderprogramm des Kopfes einmal je Stufe vorab übersetzen (sonst ruckelt das erste Erscheinen eines nahen Soldaten):
// läuft über den Spiel-Renderer (window.__game), parallel, wenn KHR_parallel_shader_compile vorhanden ist
const warmed = new Set();
let liveFaces = 0; // ohne lebende Köpfe gibt three.js das Programm frei → beim nächsten Match neu vorwärmen
function warmProgram(mesh, low) {
  const key = low ? 'l' : 'h';
  if (warmed.has(key)) return;
  const G = globalThis.__game;
  const r = G && G.renderer && G.renderer.renderer;
  if (!r || !G.camera || !G.scene) return;
  warmed.add(key);
  const vis = mesh.visible;
  try {
    mesh.visible = true;
    const par = typeof r.compileAsync === 'function' && r.extensions && r.extensions.has('KHR_parallel_shader_compile');
    if (par) r.compileAsync(mesh, G.camera, G.scene).catch(() => {}); else r.compile(mesh, G.camera, G.scene);
  } catch { /* nur Vorarbeit */ } finally { mesh.visible = vis; }
}

const IRIS = ['#3d2816', '#5a3c22', '#6b5330', '#55603f', '#4d5f6a', '#3f5f80', '#2e2218', '#6a7480'];
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hashN = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const hashS = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
// Kartengröße je Kopfauflösung (Breite; Höhe = 2 × Breite)
const TEX_W = { cine: 1024, near: 512, mid: 256 };

/** Profil + Aussehen eines Soldaten aus den Optionen (Bots: Auswahl aus SHAPE_PRESETS je Soldat). */
function profileFor(soldier, V, opts) {
  const nameSeed = soldier.name ? hashS(String(soldier.name)) : 0;
  const pick = nameSeed ? nameSeed : Math.floor(hashN(soldier.id * 31 + VARIANTS.indexOf(V) * 7 + 3) * 4294967296);
  let pre;
  const PRE = V.female ? FEMALE_PRESETS : SHAPE_PRESETS;
  if (typeof opts.shape === 'object' && opts.shape) pre = opts.shape;
  else pre = PRE[((typeof opts.shape === 'number' ? opts.shape : pick % PRE.length) + PRE.length) % PRE.length];
  const prof = { ...pre };
  delete prof.look;
  if (V.female) { prof.female = 1; }
  if (opts.age !== undefined) prof.age = +opts.age;
  const look = { ...(pre.look || {}), age: prof.age ?? 30, seed: pre.seed ?? 1 };
  if (opts.stubble !== undefined) look.stubble = +opts.stubble;
  if (opts.beard !== undefined) look.beard = opts.beard;
  if (opts.hairAmt !== undefined) look.hair = +opts.hairAmt;
  for (const k of ['recede', 'brows', 'freckles', 'moles']) if (opts[k] !== undefined) look[k] = +opts[k];
  if (V.female) { look.beard = 'none'; look.stubble = 0; look.recede = 0; look.brows = Math.min(look.brows ?? 0.8, 0.85); }
  // mensch4: Brauen schmaler (Brauen 1,15–1,3 wirkten mit dem Wulst zu schwer/tief)
  else if (opts.brows === undefined) look.brows = Math.min(0.95, (look.brows ?? 1) * 0.85);
  return { prof, look };
}

/** Frisur (hair.js) zu Ausführung/Optionen: ausdrücklich (opts.hairStyle, '' = keine), sonst nur ohne Kopfbedeckung/Abdeckung. */
function hairStyleFor(V, opts, look, prof, cover) {
  if (opts.hairStyle !== undefined) return opts.hairStyle || null;
  if (V.head || (cover && cover !== 'none')) return null;
  if (V.female) return V.hairStyle || pickHairStyle(look, true, prof.seed || 1);
  return pickHairStyle(look, false, prof.seed || 1);
}

/** Hautton zu Profil/Optionen (Gesicht und Körper – Hände, Hals, Kopf der fernen Stufen – bekommen denselben). */
function skinFor(prof, opts) {
  if (typeof opts.skin === 'string') return opts.skin;
  if (typeof opts.skin === 'number') return SKIN_TONES[opts.skin % SKIN_TONES.length];
  const af = prof.african || 0, as = prof.asian || 0;
  const r = hashN((prof.seed || 1) * 9 + 5);
  // gesamt 20.11.: ohne Herkunftsangabe vor allem helle Töne (0/5), selten mittel (1) – vorher fiel Ton 0 nie und Ton 1
  // traf auch hellhäutige Profile; je Profil fest (Samen), über die Profile gleichmäßig gemischt
  return af > 0.7 ? SKIN_TONES[r < 0.5 ? 4 : 3] : af > 0.3 ? SKIN_TONES[r < 0.5 ? 2 : 3] : as > 0.5 ? SKIN_TONES[r < 0.5 ? 5 : 1] : SKIN_TONES[[0, 5, 0, 1, 5, 0][Math.floor(r * 6)]];
}

/**
 * Hautton eines Soldaten wie ihn sein Gesicht bekäme (auch ohne Gesicht, z. B. Telefon/ferne Stufen): character.js setzt
 * damit die Hautfarbe des Körpers (Palettenplatz 'skin'), damit Hände/Hals zum Gesicht passen.
 */
export function soldierSkin(soldier, opts = {}) {
  const V = variantDef(soldier.variant);
  return skinFor(profileFor(soldier, V, opts).prof, opts);
}

export class SoldierFace {
  /**
   * opts: { res ('near'|'cine'|'mid'), shape (Profil oder Index in SHAPE_PRESETS), cover ('auto'|'none'|'balaclava'|
   * 'gaiter'|'shemagh'), skin (Hex oder Index), hair (Hex), hairAmt (0 kahl … 1), stubble (0…1), beard, age, eyes (Iris-Hex), low }
   */
  constructor(soldier, opts = {}) {
    this.soldier = soldier;
    const V = variantDef(soldier.variant);
    this.variant = V;
    this.res = opts.res || 'near';
    const shared = soldier.material && soldier.material.userData.npU;
    const low = !!opts.low;
    const mat = (this.material = faceMaterial({ low, shared }));
    liveFaces++;
    const U = (this.u = mat.userData.faceU);
    const { prof, look } = profileFor(soldier, V, opts);
    // Hautton: Option, sonst passend zur Herkunft des Profils (sonst Variante)
    const skin = skinFor(prof, opts);
    U.uSkin.value.set(skin);
    // Körper (Hände, Hals, Kopf der fernen Stufen) im selben Ton
    if (shared && shared.uPal && shared.uPal.value[9]) shared.uPal.value[9].set(skin);
    const lum = U.uSkin.value.r * 0.3 + U.uSkin.value.g * 0.59 + U.uSkin.value.b * 0.11;
    look.dark = clamp((0.35 - lum) / 0.3, 0, 1);
    const hair = opts.hair || (prof.african > 0.5 || prof.asian > 0.5 ? '#16110d' : V.hair || '#2a2119');
    U.uHairCol.value.set(hair);
    // graue Haare mit dem Alter
    const grey = clamp(((prof.age ?? 30) - 38) / 30, 0, 0.7);
    U.uHairCol.value.lerp(new THREE.Color('#8a8580'), grey);
    U.uIris.value.set(opts.eyes || (prof.african > 0.5 || prof.asian > 0.5 ? IRIS[Math.floor(hashN(soldier.id * 17 + 5) * 2)] : IRIS[Math.floor(hashN((prof.seed || 1) * 17 + soldier.id) * IRIS.length)]));
    this.profile = prof;
    this.look = look;
    this.setCover(opts.cover || 'auto');
    // mensch3: Frisur als Geometrie (hair.js) nur bei unbedecktem Kopf (Zivil, Kampagne ohne Helm); unter Helm/Mütze/Haube
    // bleibt das gemalte Kurzhaar. Haarkranz/Glatze passen die gemalten Haare an (Oberkopf kahl).
    this.hairStyle = hairStyleFor(V, opts, look, prof, this.cover);
    if (this.hairStyle === 'kranz') { look.crown = 1; look.recede = Math.max(look.recede ?? 0, 0.6); }
    if (this.hairStyle === 'glatze') look.hair = Math.min(look.hair ?? 1, 0.18);
    // Bart als Geometrie (Vollbart/kurzer Bart) nur ohne Abdeckung über dem Mund
    this.beardKind = (this.cover === 'none' || !this.cover) && !V.female && (look.beard === 'voll' || look.beard === 'kurz') ? look.beard : null;
    this.hairMesh = null; this.beardMesh = null;
    this.hairMat = this.hairStyle || this.beardKind ? hairMaterial({ low, shared, color: '#' + U.uHairCol.value.getHexString() }) : null;
    if (this.hairMat) this.hairMat.userData.hairU.uHairCol.value.copy(U.uHairCol.value);
    // Netz + Karten kommen aus dem Hintergrund-Rechner (face-worker.js); bis dahin zeichnet der Soldat seinen einfachen Körperkopf.
    this.mesh = null;
    this.castShadow = false;
    this.disposed = false;
    const tw = low ? 256 : TEX_W[this.res] || 512;
    this.ready = Promise.all([faceGeometryAsync(this.res, prof), faceTexturesAsync(tw, tw * 2, look)]).then(([geo, tex]) => {
      if (this.disposed) return null;
      U.uMapA.value = tex.a; U.uMapB.value = tex.b;
      const e = geo.userData.eye;
      if (e) {
        U.uEyeL.value.set(e.L[0] - HEAD_C[0], e.L[1] - HEAD_C[1], e.L[2] - HEAD_C[2], e.r);
        U.uEyeR.value.set(e.R[0] - HEAD_C[0], e.R[1] - HEAD_C[1], e.R[2] - HEAD_C[2], e.r);
        this.eyeL = new THREE.Vector3(e.L[0], e.L[1], e.L[2]);
        this.eyeR = new THREE.Vector3(e.R[0], e.R[1], e.R[2]);
      }
      this._skullX = earSkullX(geo);
      this._earFill();
      const mesh = (this.mesh = new THREE.SkinnedMesh(geo, mat));
      mesh.name = 'soldat-gesicht';
      mesh.frustumCulled = false;
      mesh.castShadow = this.castShadow;
      mesh.receiveShadow = true;
      mesh.bind(soldier.skeleton, new THREE.Matrix4());
      mesh.visible = false;
      soldier.root.add(mesh);
      // mensch3: Frisur/Bart am selben Skelett (Bart folgt den Mimik-Gewichten des Kopfes – geteiltes Gewichtsfeld)
      const hres = this.res === 'cine' ? 'cine' : low || this.res === 'mid' ? 'mid' : 'near';
      try {
        const hg = this.hairStyle ? hairGeometry(geo, this.hairStyle, hres, { recede: look.recede, female: !!V.female, seed: prof.seed || 1 }) : null;
        if (hg) {
          const hm = (this.hairMesh = new THREE.SkinnedMesh(hg, this.hairMat));
          hm.name = 'soldat-frisur'; hm.frustumCulled = false; hm.castShadow = false; hm.receiveShadow = true;
          hm.bind(soldier.skeleton, new THREE.Matrix4()); hm.visible = false; soldier.root.add(hm);
        }
        const bg = this.beardKind ? beardGeometry(geo, this.beardKind, hres) : null;
        if (bg) {
          const bm = (this.beardMesh = new THREE.SkinnedMesh(bg, this.hairMat));
          bm.name = 'soldat-bart'; bm.frustumCulled = false; bm.castShadow = false; bm.receiveShadow = true;
          bm.morphTargetInfluences = mesh.morphTargetInfluences;
          bm.bind(soldier.skeleton, new THREE.Matrix4()); bm.visible = false; soldier.root.add(bm);
        }
      } catch (err) { if (typeof console !== 'undefined') console.warn('[Gesicht] Frisur nicht verfügbar.', err); }
      warmProgram(mesh, low);
      this._step(0);
      if (typeof soldier._faceReady === 'function') soldier._faceReady(this);
      this.syncVisible(soldier.lod);
      return this;
    }).catch((err) => {
      if (typeof console !== 'undefined') console.warn('[Gesicht] Kopf nicht verfügbar – Körperkopf bleibt.', err);
      return null;
    });
    this.morphIndex = Object.fromEntries(FACE_MORPHS.map((n, i) => [n, i]));
    // Zustand
    this.ch = { ...V0 }; this.chT = { ...V0 }; this.chV = Object.fromEntries(CH.map((k) => [k, 0]));
    this.jawOverride = null;
    this.ex = Object.fromEntries(EXPR_KEYS.map((k) => [k, 0]));
    this.exT = { ...this.ex };
    this.exRate = 1 / 0.35;
    this.raw = {};
    this.lookTarget = null;
    this.gazeLocal = null; // [yaw, pitch]
    this.gaze = [0, 0, 0, 0]; this.gazeT = [0, 0, 0, 0];
    this.sacc = [0, 0]; this.saccT = 0.5;
    this.autoBlink = true;
    this.blinkT = 9; this.blinkDur = 0.16; this.nextBlink = 1 + hashN(soldier.id * 3) * 3;
    this.closed = 0;
    this.dead = false;
    this.forceVisible = false;
    this.manual = false;
    this.time = 0;
    // Augenmitten (Modellraum) bis das Netz da ist
    this.eyeL = new THREE.Vector3(-0.029, 1.69, -0.076);
    this.eyeR = new THREE.Vector3(0.029, 1.69, -0.076);
  }

  /* ---------------------------------------------------------------- Abdeckung */

  setCover(c = 'auto') {
    const V = this.variant;
    const id = c === 'auto' ? V.face || 'none' : c;
    const U = this.u;
    U.uCover.value = COVER_ID[id] || 0;
    U.uCoverEars.value = id === 'balaclava' ? 1 : 0;
    const sc = SCHEMES[this.soldier.scheme] || SCHEMES.A;
    if (id === 'balaclava') {
      const f = Math.pow(0.72, 2.2);
      U.uCoverCol.value.set(sc.gear2).multiplyScalar(f);
      U.uCoverCol2.value.copy(U.uCoverCol.value).multiplyScalar(0.85);
    } else if (id === 'gaiter') {
      U.uCoverCol.value.set(sc.camo[0]); U.uCoverCol2.value.set(sc.camo[1]);
    } else if (id === 'shemagh') {
      U.uCoverCol.value.set('#4b4c3c'); U.uCoverCol2.value.set('#3e3f31');
    }
    this.cover = id;
    U.uEarCup.value.w = V.ears ? 1 : 0;
    // Halsausschnitt der Kleidung (body-mesh.js) für das Versenken des Halsansatzes
    const NL = BODY_MESH.boots && BODY_MESH.boots.neck && BODY_MESH.boots.neck[V.civil ? (V.female ? 'female' : 'civil') : 'soldier'];
    if (NL && NL.length > 4) {
      const cz = NL.reduce((a, p) => a + p[2], 0) / NL.length;
      const f = NL.reduce((a, p) => (p[2] < a[2] ? p : a)), b = NL.reduce((a, p) => (p[2] > a[2] ? p : a)), sd = NL.reduce((a, p) => (Math.abs(p[0]) > Math.abs(a[0]) ? p : a));
      U.uNeckLine.value.set(f[1] - HEAD_C[1], sd[1] - HEAD_C[1], b[1] - HEAD_C[1], cz - HEAD_C[2]);
    }
    this._earFill();
  }

  /** mensch4: Kopfseite bis an die Polster des Gehörschutzes (gear.js EAR_CUP) – Sturmhaube trägt 2,6 mm auf. */
  _earFill() {
    if (this._skullX === undefined) return;
    this.u.uEarFill.value = clamp(EAR_CUP.x + 0.0005 - (this._skullX + (this.cover === 'balaclava' ? 0.0026 : 0)), 0, 0.012);
  }

  /* ---------------------------------------------------------------- Mund */

  setViseme(id, w = 1) {
    const s = visemeOf(id), r = VISEMES.sil;
    w = clamp(+w || 0, 0, 1);
    for (const k of CH) this.chT[k] = r[k] + (s[k] - r[k]) * w;
    return this;
  }

  setVisemeWeights(map = {}) {
    let sum = 0;
    for (const k of Object.keys(map)) sum += Math.max(0, map[k] || 0);
    const r = VISEMES.sil;
    for (const c of CH) this.chT[c] = r[c] * Math.max(0, 1 - sum);
    const norm = sum > 1 ? 1 / sum : 1;
    for (const k of Object.keys(map)) { const s = visemeOf(k), w = Math.max(0, map[k] || 0) * norm; for (const c of CH) this.chT[c] += s[c] * w; }
    return this;
  }

  setMouth(m = {}) { for (const k of CH) if (m[k] !== undefined && Number.isFinite(+m[k])) this.chT[k] = +m[k]; return this; }

  setJaw(open) { this.jawOverride = open == null ? null : clamp(+open || 0, 0, 1.2); return this; }

  /* ---------------------------------------------------------------- Mimik */

  setExpression(id = 'neutral', w = 1, fade = 0.35) {
    return this.setExpressionWeights({ [id]: w }, fade);
  }

  setExpressionWeights(map = {}, fade = 0.35) {
    for (const k of EXPR_KEYS) this.exT[k] = 0;
    for (const id of Object.keys(map)) {
      const E = exprOf(id), w = clamp(+map[id] || 0, 0, 1);
      for (const k of Object.keys(E)) this.exT[k] = Math.min(1.2, this.exT[k] + E[k] * w);
    }
    this.exRate = 1 / Math.max(0.03, fade);
    return this;
  }

  setMorph(name, w) { if (name in this.morphIndex) { if (w == null) delete this.raw[name]; else this.raw[name] = +w || 0; } return this; }

  /* ---------------------------------------------------------------- Augen */

  lookAt(target) {
    if (!target) { this.lookTarget = null; return this; }
    this.lookTarget = (this.lookTarget || new THREE.Vector3()).copy(target);
    this.gazeLocal = null;
    return this;
  }

  /** Blick relativ zum Kopf: yaw (+ = zur rechten Seite der Figur), pitch (+ = hoch). */
  setGaze(yaw = 0, pitch = 0) { this.gazeLocal = [yaw, pitch]; this.lookTarget = null; return this; }

  blink(dur = 0.16) { if (this.blinkT > this.blinkDur * 0.6) { this.blinkT = 0; this.blinkDur = Math.max(0.08, dur); } return this; }

  setEyesClosed(w = 1) { this.closed = clamp(+w || 0, 0, 1); return this; }

  /** Leiche: Lider halb, Kiefer locker, Blick starr. */
  setDead(on = true) {
    this.dead = !!on;
    if (on) { this.setExpression('neutral', 1, 0.6); this.setViseme('sil'); }
    return this;
  }

  /* ---------------------------------------------------------------- Fortschreiben */

  updateFace(dt) { this.manual = true; this._step(dt); }

  /** Vom Soldaten je Bild (nur sichtbar). */
  update(dt) { if (!this.manual) this._step(dt); }

  /** Wird der Kopf gerade gezeichnet? */
  get visible() { return !!this.mesh && this.mesh.visible; }

  _step(dt) {
    if (!this.mesh) return;
    const dtS = Math.min(1, Math.max(0, dt || 0));
    dt = Math.min(0.1, dtS);
    this.time += dt;
    // Mundkanäle: exakte Lösung der kritisch gedämpften Feder (ω = 30/s) – stabil für jede Bildzeit (kein Aufschaukeln
    // und kein Nachhinken bei niedriger Bildrate: volle Bildzeit, nicht auf 0,1 s gekappt), Verschlusslaute schließen dennoch
    const w = 30, ex = Math.exp(-w * dtS);
    for (const k of CH) {
      const y = this.ch[k] - this.chT[k], v = this.chV[k], t = (v + w * y) * dtS;
      this.ch[k] = this.chT[k] + (y + t) * ex;
      this.chV[k] = (v - w * t) * ex;
    }
    const kx = 1 - Math.exp(-this.exRate * 3 * dt);
    for (const k of EXPR_KEYS) this.ex[k] += (this.exT[k] - this.ex[k]) * kx;
    const c = this.ch, e = this.ex;
    const dead = this.dead ? 1 : 0;
    // Morph-Gewichte
    const W = this.mesh.morphTargetInfluences;
    const I = this.morphIndex;
    const open = this.jawOverride != null ? this.jawOverride : c.open * 0.8 + e.jaw + dead * 0.2;
    W[I.jawOpen] = clamp(open, 0, 1.2);
    W[I.lipsWide] = clamp((c.wide - 0.3) / 0.7 + e.wide, 0, 1);
    W[I.lipsRound] = clamp(c.round + Math.max(0, 0.3 - c.wide) * 0.25, 0, 1);
    W[I.lipsPress] = clamp(Math.max(c.press, e.press) * (1 - clamp(open * 3, 0, 1)) * (1 - dead), 0, 1);
    W[I.lipsPart] = clamp(c.teeth * (1 - c.tuck) * 0.8 + e.part + dead * 0.3, 0, 1);
    W[I.lipTuck] = clamp(c.tuck, 0, 1);
    W[I.tongueUp] = clamp(c.tongue, 0, 1);
    W[I.smile] = clamp(e.smile, 0, 1.2);
    W[I.frown] = clamp(e.frown, 0, 1.2);
    W[I.sneer] = clamp(e.sneer, 0, 1.2);
    W[I.browDown] = clamp(e.browDown, 0, 1.2);
    W[I.browInnerUp] = clamp(e.browInnerUp, 0, 1.2);
    W[I.browUp] = clamp(e.browUp, 0, 1.2);
    // Blinzeln (schnell zu, langsamer auf)
    if (this.autoBlink && !this.dead) {
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) { this.blink(0.14 + Math.random() * 0.08); this.nextBlink = 2 + Math.random() * 4.2; if (Math.random() < 0.12) this.nextBlink = 0.3; }
    }
    this.blinkT += dt;
    const bt = this.blinkT / this.blinkDur;
    const bl = bt >= 1 ? 0 : bt < 0.4 ? bt / 0.4 : 1 - (bt - 0.4) / 0.6;
    // Blick: Ziel → Kopfknochen-Raum → je Auge Richtung (Konvergenz auf nahe Ziele), begrenzt wie echte Augen (±35°/±24°)
    const head = this.soldier.bones[BONE.head];
    const tg = this.gazeT;
    this.saccT -= dt;
    if (this.saccT <= 0) { this.sacc[0] = (Math.random() - 0.5) * 0.08; this.sacc[1] = (Math.random() - 0.5) * 0.045; this.saccT = 0.4 + Math.random() * 1.8; }
    const sy = this.dead ? 0 : this.sacc[0], sp = this.dead ? 0 : this.sacc[1];
    if (this.lookTarget && !this.dead) {
      head.updateWorldMatrix(true, false);
      _m.copy(head.matrixWorld).invert();
      const t = _v.copy(this.lookTarget).applyMatrix4(_m);
      // Augen im Kopfknochen-Raum: Bindepose des Kopfknochens hat keine Drehung → Modellraum minus Knochenposition
      const hb = head.userData.bindPos || (head.userData.bindPos = bindPosOf(this.soldier, BONE.head));
      let k = 0;
      for (const eye of [this.eyeL, this.eyeR]) {
        const dx = t.x - (eye.x - hb.x), dy = t.y - (eye.y - hb.y), dz = t.z - (eye.z - hb.z);
        tg[k] = Math.atan2(dx, -dz) + sy * 0.3; tg[k + 1] = Math.atan2(dy, Math.hypot(dx, dz)) + sp * 0.3;
        k += 2;
      }
    } else {
      const y = this.gazeLocal ? this.gazeLocal[0] : 0, p = this.gazeLocal ? this.gazeLocal[1] : this.dead ? -0.12 : 0;
      tg[0] = tg[2] = y + sy; tg[1] = tg[3] = p + sp;
    }
    const kg = 1 - Math.exp(-28 * dt);
    const g = this.gaze;
    for (let i = 0; i < 4; i++) {
      const lim = i & 1 ? [-0.42, 0.38] : [-0.6, 0.6];
      g[i] += (clamp(tg[i], lim[0], lim[1]) - g[i]) * kg;
    }
    const dir = (out, yy, pp) => out.set(Math.sin(yy) * Math.cos(pp), Math.sin(pp), -Math.cos(yy) * Math.cos(pp));
    const U = this.u;
    dir(U.uGazeL.value, g[0], g[1]);
    dir(U.uGazeR.value, g[2], g[3]);
    // Lider: Blinzeln/geschlossen/Leiche, Blick nach unten senkt das Oberlid mit, nach oben hebt es
    const gp = (g[1] + g[3]) * 0.5;
    const lid = Math.max(bl, this.closed, e.lidDroop * 0.45, dead * 0.6, clamp(-gp / 0.4, 0, 1) * 0.35);
    W[I.blink] = clamp(lid, 0, 1);
    W[I.squint] = clamp(e.squint * (1 - lid * 0.7), 0, 1);
    W[I.lidWide] = clamp(e.lidOpen + Math.max(0, gp / 0.4) * 0.35, 0, 1) * (1 - lid);
    for (const n of Object.keys(this.raw)) W[I[n]] = this.raw[n];
    // Mimikfalten: Stirn (Brauen hoch), Zornesfalte (Brauen runter), Krähenfüße/Lachfalten (Lächeln, Zusammenkneifen), Nase
    U.uWrk.value.set(
      clamp(W[I.browUp] + W[I.browInnerUp] * 0.8, 0, 1.2),
      clamp(W[I.browDown] * 1.1 + W[I.browInnerUp] * 0.4, 0, 1.2),
      clamp(W[I.smile] * 0.9 + W[I.squint] * 0.6, 0, 1.2),
      clamp(W[I.sneer], 0, 1.2),
    );
  }

  /** Sichtbarkeit nach Detailstufe des Soldaten. */
  syncVisible(lod) {
    if (!this.mesh) return;
    const v = (this.mesh.visible = this.forceVisible || lod === 0);
    if (this.hairMesh) this.hairMesh.visible = v;
    if (this.beardMesh) this.beardMesh.visible = v;
  }

  setShadows(on) { this.castShadow = !!on; if (this.mesh) this.mesh.castShadow = this.castShadow; }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (--liveFaces <= 0) { liveFaces = 0; warmed.clear(); }
    if (this.mesh) this.mesh.removeFromParent();
    if (this.hairMesh) this.hairMesh.removeFromParent();
    if (this.beardMesh) this.beardMesh.removeFromParent();
    if (this.hairMat) this.hairMat.dispose();
    this.material.dispose();
    // Geometrie und Karten bleiben im Cache (geteilt)
  }
}

/** mensch4: größte Kopfbreite (x) unter dem Polsterring des Gehörschutzes (Haut ohne Ohr, rechte Seite) – gecacht je Geometrie. */
function earSkullX(geo) {
  if (geo.userData.earSkullX !== undefined) return geo.userData.earSkullX;
  const P = geo.attributes.position.array, R = geo.attributes.aRest.array, n = geo.attributes.position.count;
  let mx = 0;
  for (let i = 0; i < n; i++) {
    const x = P[i * 3];
    if (x < 0.03 || Math.floor(R[i * 4 + 3] * 0.5 + 0.01) !== 0) continue;
    const r = Math.hypot((P[i * 3 + 1] - EAR_CUP.y) / EAR_CUP.sy, (P[i * 3 + 2] - EAR_CUP.z) / EAR_CUP.sz);
    if (Math.abs(r - EAR_CUP.r) < 0.006 && x > mx) mx = x;
  }
  geo.userData.earSkullX = mx || EAR_CUP.x;
  return geo.userData.earSkullX;
}

function bindPosOf(soldier, bone) {
  // Bindeposition (Modellraum) aus der inversen Bindematrix des Skeletts
  const inv = soldier.skeleton.boneInverses[bone];
  return new THREE.Vector3().setFromMatrixPosition(_m.copy(inv).invert());
}
