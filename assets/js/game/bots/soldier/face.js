// NULLPUNKT — Gesicht des Soldaten: modellierter Kopf (face-sdf.js) mit Haut-Shader und Gesichts-API für Zwischensequenzen,
// Funksprüche und Lippensynchronität.
//
// ============================================================================ GESICHTS-API (soldier.face)
//
//   const s = createSoldier({ team, variant, face: { cover: 'none', res: 'cine', shape, skin, hair, hairAmt, stubble, eyes }, cinematic: true });
//   (shape: Index 0–3 in SHAPE_PRESETS oder { jaw, chin, nose, noseW, brow, cheek, lips, skull, neck } je −1…1)
//   const f = s.face;               // SoldierFace | null (null nur bei face: false)
//
//   Lippen / Mund
//     f.setViseme(id, w = 1)        Ziel-Mundform (eine aktive Form, weich überblendet – Koartikulation macht die Feder).
//                                   ids: 'sil'/'rest' (Ruhe), 'closed', 'A'|'aa', 'E', 'I', 'O', 'U', 'FV'|'FF', 'MBP'|'PP',
//                                   'L', außerdem Oculus-Satz 'TH','DD','kk','CH','SS','nn','RR' (campaign/lipsync.js).
//     f.setVisemeWeights({ A: .6, O: .4 })   gemischte Mundform (Gewichte werden normiert, Rest = Ruhe)
//     f.setMouth({ open, wide, round, press, teeth, tuck, tongue })   Kanäle direkt (0…1; wide 0,3 = neutral)
//     f.setJaw(open)                Kiefer direkt (0…1), überschreibt den Kanal 'open'
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
//     f.ready                       Promise<f>: Kopfnetz fertig (Hintergrund-Rechner, ≈ 0,2–2 s); API-Aufrufe vorher wirken danach
//     f.setCover('none'|'balaclava'|'gaiter'|'shemagh')  Abdeckung umschalten (Stoff über Mund/Nase bewegt sich mit)
//   Exporte: VISEMES, EXPRESSIONS, FACE_MORPHS (Morph-Ziele), SHAPE_PRESETS, faceStats()
//
// Morph-Ziele (je Kopf-Geometrie, geteilt): jawOpen, lipsWide, lipsRound, lipsPress, lipsPart, lipTuck, tongueUp, smile,
// frown, sneer, browDown, browInnerUp, browUp. Lider, Iris/Pupille, Brauen-Haare, Wimpernlinie, Bartschatten, Kurzhaar,
// Sturmhauben-Strick: Shader (aRest = Ruhelage) – kein zusätzlicher Draw Call. Augen: Augapfel ist Teil des Kopfes,
// Iris/Pupille folgen dem Blick über Uniforms; Blinzeln schließt die Lidspalte über den Augapfel.
//
// Kosten: Kopf 'near' 7 000 Dreiecke, 'cine' 24 000 (nur Zwischensequenzen), 'mid' 2 600. Aufbau je Kopfform 0,2–2 s im
// Hintergrund-Rechner (face-worker.js, kein Ruckeln; 4 Bot-Formen je Sitzung). Zeichnen: +1 Draw Call je Soldat auf
// Detailstufe 0; der Körper zeichnet dann seinen Kopf nicht (gleiche Puffer, kürzerer drawRange).
import * as THREE from 'three';
import { buildFaceData, FACE_MORPHS, SHAPE_PRESETS, SHAPE_DEFAULT, EYE, HEAD_C } from './face-sdf.js?v=20261114004313';
import { BONE, BIND } from './rig.js?v=20261114004313';
import { VARIANTS } from './gear.js?v=20261114004313';
import { SKIN_TONES, SCHEMES } from './materials.js?v=20261114004313';

export { FACE_MORPHS, SHAPE_PRESETS };

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

// Mimik: Morph-Anteile + Shader-Anteile (squint = Unterlid hoch, lidOpen = weit offen, lidDroop = Oberlid hängt, press/jaw/wide
// addieren sich zu den Mundkanälen)
const EXPR = {
  neutral: {},
  angry: { browDown: 1, sneer: 0.35, squint: 0.4, press: 0.35, frown: 0.15 },
  worried: { browInnerUp: 1, frown: 0.4, lidOpen: 0.15 },
  smile: { smile: 1, squint: 0.35, wide: 0.35, part: 0.35 },
  surprised: { browUp: 1, lidOpen: 0.55, jaw: 0.15 },
  pain: { browDown: 0.6, browInnerUp: 0.5, squint: 0.85, sneer: 0.55, wide: 0.3, jaw: 0.08 },
  ernst: { browDown: 0.3, press: 0.25, frown: 0.12, squint: 0.1 },
  angespannt: { browDown: 0.5, squint: 0.3, press: 0.35, wide: 0.1 },
  fragend: { browUp: 0.35, browInnerUp: 0.25, lidOpen: 0.1 },
  nachdenklich: { browDown: 0.2, browInnerUp: 0.25, squint: 0.3, frown: 0.2, press: 0.2 },
  erleichtert: { smile: 0.5, browInnerUp: 0.2, squint: 0.15, wide: 0.1 },
  traurig: { browInnerUp: 0.85, frown: 0.7, lidDroop: 0.35 },
  entschlossen: { browDown: 0.4, press: 0.4, squint: 0.25 },
};
const EXPR_ALIAS = { wuetend: 'angry', 'wütend': 'angry', zornig: 'angry', besorgt: 'worried', sorge: 'worried', laecheln: 'smile', 'lächeln': 'smile', happy: 'smile', froh: 'smile', ueberrascht: 'surprised', 'überrascht': 'surprised', schmerz: 'pain', sad: 'traurig', ruhig: 'neutral' };
export const EXPRESSIONS = Object.freeze(Object.keys(EXPR));
const EXPR_KEYS = ['smile', 'frown', 'sneer', 'browDown', 'browInnerUp', 'browUp', 'squint', 'lidOpen', 'lidDroop', 'press', 'jaw', 'wide', 'part'];
const exprOf = (id) => EXPR[id] || EXPR[EXPR_ALIAS[id]] || EXPR.neutral;

/* ------------------------------------------------------------------ Geometrie (geteilt) */

const geoCache = new Map();
const stats = { built: 0, ms: 0, triangles: {} };

function toGeometry(D, res, key) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(D.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(D.nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(D.col, 4));
  g.setAttribute('aRest', new THREE.BufferAttribute(D.rest, 4));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(D.ski, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(D.skw, 4, true));
  g.setIndex(new THREE.BufferAttribute(D.idx, 1));
  g.morphAttributes.position = D.morphs.map((m) => new THREE.BufferAttribute(m.pos, 3));
  g.morphAttributes.normal = D.morphs.map((m) => new THREE.BufferAttribute(m.nrm, 3));
  g.morphAttributes.color = D.morphs.map((m) => new THREE.BufferAttribute(m.col, 4));
  g.morphTargetsRelative = true;
  g.computeBoundingSphere();
  g.userData.triangles = D.triangles;
  g.userData.ms = Math.round(D.ms);
  g.userData.key = key;
  g.name = 'gesicht:' + res;
  stats.built++; stats.ms += D.ms; stats.triangles[res] = D.triangles;
  return g;
}

const keyOf = (res, shape) => res + '|' + JSON.stringify(shape);

/** Kopf-Geometrie sofort (Hauptfaden, gecacht je Auflösung × Kopfform). */
export function faceGeometry(res = 'near', shape = SHAPE_DEFAULT) {
  const key = keyOf(res, shape);
  let g = geoCache.get(key);
  if (g) return g;
  g = toGeometry(buildFaceData(res, shape), res, key);
  geoCache.set(key, g);
  return g;
}

// Hintergrund-Rechner (Modul-Worker); ohne Worker-Unterstützung: Hauptfaden in der nächsten Leerlaufphase
let worker = null, workerBroken = false, jobSeq = 0;
const jobs = new Map(), pending = new Map();
function getWorker() {
  if (worker || workerBroken || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./face-worker.js?v=20261114004313', import.meta.url), { type: 'module', name: 'gesichter' });
    worker.onmessage = (e) => {
      const { id, D, error } = e.data || {};
      const j = jobs.get(id);
      if (!j) return;
      jobs.delete(id);
      if (error || !D) j.fallback(); else j.resolve(D);
    };
    worker.onerror = () => { workerBroken = true; for (const j of jobs.values()) j.fallback(); jobs.clear(); worker = null; };
  } catch { workerBroken = true; worker = null; }
  return worker;
}

/** Kopf-Geometrie im Hintergrund → Promise<BufferGeometry> (gecacht; gleichzeitige Anfragen teilen sich die Arbeit). */
export function faceGeometryAsync(res = 'near', shape = SHAPE_DEFAULT) {
  const key = keyOf(res, shape);
  const g = geoCache.get(key);
  if (g) return Promise.resolve(g);
  let p = pending.get(key);
  if (p) return p;
  p = new Promise((resolve) => {
    const done = (D) => { const geo = toGeometry(D, res, key); geoCache.set(key, geo); pending.delete(key); resolve(geo); };
    const fallback = () => setTimeout(() => { const geo = faceGeometry(res, shape); pending.delete(key); resolve(geo); }, 0);
    const w = getWorker();
    if (!w) { fallback(); return; }
    const id = ++jobSeq;
    jobs.set(id, { resolve: done, fallback });
    w.postMessage({ id, res, shape });
  });
  pending.set(key, p);
  return p;
}

/** Diagnose: { built, ms, triangles: { near, cine … }, cached } */
export function faceStats() { return { ...stats, ms: Math.round(stats.ms), cached: geoCache.size }; }

export function disposeFaceGeometries() { for (const g of geoCache.values()) g.dispose(); geoCache.clear(); }

/* ------------------------------------------------------------------ Shader */

const COVER_ID = { none: 0, balaclava: 1, gaiter: 2, shemagh: 3, gasmask: 0 };

const GLSL_COMMON = /* glsl */`
uniform float uCover;
uniform vec4 uEye; // x, y, z, r
uniform vec4 uLid; // hw, up, lo, –
float npCoverMask( vec3 q ) {
	if ( uCover < 0.5 ) return 0.0;
	float ax = abs( q.x );
	float front = smoothstep( -0.02, -0.07, q.z );
	if ( uCover < 1.5 ) {
		// Sturmhaube: alles außer dem Augenschlitz
		float bx = smoothstep( 0.056, 0.05, ax ), by = smoothstep( 0.0185, 0.0145, abs( q.y - 0.0075 ) );
		return 1.0 - bx * by * smoothstep( -0.04, -0.06, q.z );
	}
	// Halstuch / Shemagh: Unterkante unter den Augen vorn, seitlich/hinten tiefer
	float edge = mix( -0.06, -0.013, front ) + 0.004 * sin( q.x * 160.0 ) * front;
	float c = smoothstep( 0.003, -0.003, q.y - edge );
	if ( uCover > 2.5 ) c = max( c, smoothstep( -0.01, 0.02, q.z + 0.03 * ( 1.0 - front ) ) * smoothstep( -0.03, 0.0, q.y ) ); // Shemagh: Hinterkopf
	return c;
}
`;

const VERT_HEAD = /* glsl */`
attribute vec4 aRest;
varying vec4 vRest;
varying vec3 vMp;
uniform float uCoverEars;
${GLSL_COMMON}
`;

const FRAG_HEAD = /* glsl */`
#define NP_FACE
varying vec4 vRest;
varying vec3 vMp;
float npMouthOcc = 1.0;
float npSss = 0.0;
float npThin = 0.0;
float npRough = 0.5;
float npH = 0.0;
float npOpen = 0.0;
const vec3 npSssCol = vec3( 1.0, 0.42, 0.32 );
uniform vec3 uSkin;
uniform vec3 uHairCol;
uniform float uHairAmt;
uniform float uStubble;
uniform vec3 uIris;
uniform vec3 uGazeL;
uniform vec3 uGazeR;
uniform vec4 uLids; // Blinzeln, Unterlid hoch, Oberlid weit, Blick-Neigung
uniform vec4 uBrow; // innen dy, außen dy, Stirnfalten, Zornesfalte
uniform float uSmileLines;
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
`;

// Haut, Augen, Mund, Haare, Abdeckung → diffuseColor, npRough, npSss, npH (Höhe für die Relief-Normale)
const FACE_ALBEDO = /* glsl */`
	vec3 q = vRest.xyz;
	float part = floor( vRest.w * 0.5 + 0.01 );
	float fAo = clamp( vRest.w - part * 2.0, 0.0, 1.0 );
	vec4 fc = clamp( vColor, 0.0, 1.0 );
	float fTeeth = fc.r, fCav = fc.g, fLip = fc.b, fTongue = fc.a;
	float ax = abs( q.x );
	float sgn = q.x < 0.0 ? -1.0 : 1.0;
	float front = smoothstep( -0.03, -0.07, q.z );
	float isHead = 1.0 - part;
	// Pixelgröße in Metern (Detail ausblenden, sobald es flimmern würde)
	float pix = length( fwidth( q ) );
	float fineFade = 1.0 - smoothstep( 0.00025, 0.0009, pix );
	vec3 alb = uSkin;
	npRough = 0.5;
	npSss = uSssAmt;
	// Hautfarbe: Wangen/Nase/Ohren röter, Stirn etwas heller/gelber, unter den Augen kühler
	float cheek = exp( -( pow( ( ax - 0.043 ) / 0.019, 2.0 ) + pow( ( q.y + 0.02 ) / 0.021, 2.0 ) ) ) * front;
	float noseR = exp( -( pow( ax / 0.013, 2.0 ) + pow( ( q.y + 0.03 ) / 0.017, 2.0 ) ) ) * front;
	float red = clamp( cheek * 0.8 + noseR * 0.7 + part * 0.75, 0.0, 1.0 );
	alb *= mix( vec3( 1.0 ), vec3( 1.1, 0.88, 0.86 ), red );
	float fore = smoothstep( 0.03, 0.05, q.y ) * front;
	alb *= mix( vec3( 1.0 ), vec3( 1.04, 1.01, 0.95 ), fore );
	float under = exp( -( pow( ( ax - 0.031 ) / 0.014, 2.0 ) + pow( ( q.y + 0.009 ) / 0.0065, 2.0 ) ) ) * front;
	alb *= mix( vec3( 1.0 ), vec3( 0.88, 0.86, 0.92 ), under * 0.45 );
	// T-Zone glänzt (Stirn, Nase)
	npRough -= ( fore * 0.1 + noseR * 0.14 );
	// Poren + feine Hautstruktur (Relief)
	#ifndef NP_LOW
	float pores = npNoise( q * 1700.0 ) * 0.6 + npNoise( q * 640.0 ) * 0.4;
	npH += ( pores - 0.5 ) * 0.00006 * fineFade;
	alb *= 1.0 - ( pores - 0.5 ) * 0.07 * fineFade;
	#endif
	// Bartschatten (Rasur): Wangen unten, Oberlippe, Kinn, Kiefer, oberer Hals
	float yb = mix( -0.047, -0.024, smoothstep( 0.02, 0.064, ax ) ) + 0.022 * smoothstep( 0.058, 0.07, ax );
	float beard = smoothstep( 0.003, -0.004, q.y - yb ) * smoothstep( -0.165, -0.125, q.y ) * smoothstep( 0.035, 0.0, q.z ) * isHead;
	beard *= ( 1.0 - fLip ) * ( 1.0 - fCav ) * ( 1.0 - fTeeth ) * ( 1.0 - fTongue );
	float foll = smoothstep( 0.5, 0.85, npNoise( q * 2600.0 ) );
	float bAmt = beard * uStubble;
	alb = mix( alb, alb * vec3( 0.66, 0.65, 0.7 ) * mix( 1.0, 0.72, foll * fineFade ), bAmt );
	npRough += bAmt * 0.12;
	npH += bAmt * foll * 0.00003 * fineFade;
	// Lippen
	alb = mix( alb, alb * vec3( 0.9, 0.7, 0.68 ) + vec3( 0.012, 0.0, 0.0 ), fLip );
	npRough = mix( npRough, 0.36, fLip );
	#ifndef NP_LOW
	npH += fLip * sin( q.x * 5200.0 + npNoise( q * 900.0 ) * 3.0 ) * 0.000025 * fineFade;
	#endif
	// Augenbrauen (folgen den Brauen-Morphs über uBrow)
	float by = 0.0213 + 0.0036 * sin( clamp( ( ax - 0.011 ) / 0.047, 0.0, 1.0 ) * 3.14159 ) - 0.0022 * smoothstep( 0.042, 0.062, ax );
	by += uBrow.x * ( 1.0 - smoothstep( 0.014, 0.036, ax ) ) + uBrow.y * smoothstep( 0.022, 0.05, ax );
	float bth = mix( 0.0043, 0.0021, smoothstep( 0.014, 0.06, ax ) );
	float brow = smoothstep( bth, bth * 0.4, abs( q.y - by ) ) * smoothstep( 0.0085, 0.0135, ax ) * smoothstep( 0.064, 0.054, ax ) * smoothstep( -0.05, -0.066, q.z ) * isHead;
	float strand = npNoise( vec3( ax * 700.0 + q.y * 1500.0, q.y * 4200.0 - ax * 600.0, 0.5 ) );
	alb = mix( alb, uHairCol * 0.75, brow * ( 0.5 + 0.45 * strand ) );
	npRough += brow * 0.2;
	npH += brow * strand * 0.00006;
	// Kopfhaar (Kurzhaarschnitt): Haaransatz als geneigte Ebene, Geheimratsecken
	float yh = 0.052 - ( q.z + 0.085 ) * 0.7 + 0.013 * exp( -pow( ( ax - 0.047 ) / 0.017, 2.0 ) ) * front;
	float hair = smoothstep( -0.002, 0.005, q.y - yh ) * isHead * uHairAmt;
	float hd = npNoise( q * 2200.0 ) * 0.6 + npNoise( q * 300.0 ) * 0.4;
	alb = mix( alb, mix( uSkin * 0.8, uHairCol, 0.75 + 0.25 * hd ), hair * ( 0.72 + 0.28 * hd ) );
	npRough = mix( npRough, 0.78, hair );
	npSss *= 1.0 - hair * 0.7;
	npH += hair * hd * 0.00008 * fineFade;
	// Falten nach Mimik: Stirn (besorgt/überrascht), Zornesfalte (wütend), Lachfältchen
	#ifndef NP_LOW
	float foreW = smoothstep( 0.03, 0.04, q.y ) * smoothstep( 0.068, 0.05, q.y ) * smoothstep( 0.055, 0.03, ax ) * front;
	npH += foreW * uBrow.z * sin( q.y * 900.0 + sin( q.x * 60.0 ) * 1.5 ) * 0.00018;
	float glab = exp( -pow( ( ax - 0.0055 ) / 0.002, 2.0 ) ) * smoothstep( 0.008, 0.016, q.y ) * smoothstep( 0.04, 0.026, q.y ) * front;
	npH -= glab * uBrow.w * 0.0004;
	float crow = exp( -pow( ( ax - 0.052 ) / 0.006, 2.0 ) - pow( ( q.y - 0.004 ) / 0.01, 2.0 ) ) * front;
	npH += crow * uSmileLines * sin( atan( q.y - 0.004, ax - 0.046 ) * 22.0 ) * 0.00012;
	#endif
	// Augen: Lidspalte (Blinzeln/Zusammenkneifen), Augapfel mit Iris/Pupille nach Blickrichtung, Wimpernlinie
	vec3 el = q - vec3( sgn * uEye.x, uEye.y, uEye.z );
	float er = length( el );
	if ( er < uEye.w + 0.004 && isHead > 0.5 ) {
		float xo = el.x * sgn;
		float u = max( 0.0, 1.0 - pow( xo / uLid.x, 2.0 ) );
		float uu = pow( u, 0.8 );
		float upOpen = uLid.y * uu + 0.0007 * xo / uLid.x + uLids.z * 0.0018 * uu - uLids.w * 0.0028 * uu;
		float loLid = uLid.z * uu + uLids.y * 0.0024 * uu - uLids.w * 0.0009 * uu;
		float upLid = mix( upOpen, loLid + 0.0002, uLids.x );
		float fw = fwidth( el.y ) * 1.2 + 0.00012;
		npOpen = smoothstep( -fw, fw, upLid - el.y ) * smoothstep( -fw, fw, el.y - loLid ) * smoothstep( uLid.x, uLid.x * 0.9, abs( xo ) ) * step( el.z, 0.002 );
		vec3 g = normalize( q.x < 0.0 ? uGazeL : uGazeR );
		vec3 d = normalize( el );
		float c = dot( d, g );
		float iris = smoothstep( 0.884, 0.894, c );
		float pupil = smoothstep( 0.9835, 0.9865, c );
		float limbal = smoothstep( 0.874, 0.892, c ) * ( 1.0 - smoothstep( 0.895, 0.93, c ) );
		vec3 tg = normalize( cross( g, vec3( 0.0, 1.0, 0.0 ) ) );
		float ang = atan( dot( d, cross( g, tg ) ), dot( d, tg ) );
		float fib = npNoise( vec3( ang * 9.0, c * 160.0, 1.7 ) ) * 0.6 + npNoise( vec3( ang * 26.0, c * 40.0, 5.1 ) ) * 0.4;
		float corner = smoothstep( 0.55, 1.0, abs( xo ) / uLid.x );
		vec3 sclera = mix( vec3( 0.76, 0.72, 0.68 ), vec3( 0.8, 0.56, 0.52 ), corner * 0.6 );
		sclera *= 1.0 - smoothstep( 0.5, 0.95, abs( xo ) / uLid.x ) * 0.25;
		vec3 irisC = uIris * ( 0.55 + 0.75 * fib ) * mix( 1.0, 1.35, smoothstep( 0.93, 0.975, c ) );
		vec3 eyeC = mix( sclera, irisC, iris );
		eyeC *= 1.0 - 0.6 * limbal;
		eyeC = mix( eyeC, vec3( 0.012 ), pupil );
		// Schatten des Oberlids, Wimpernlinie innen
		eyeC *= 1.0 - 0.6 * smoothstep( upLid - 0.0038, upLid, el.y );
		eyeC *= 1.0 - 0.25 * smoothstep( loLid + 0.0018, loLid, el.y );
		eyeC = mix( eyeC, vec3( 0.03, 0.02, 0.02 ), smoothstep( 0.0009, 0.0, upLid - el.y ) );
		// Lid-Haut außerhalb: Lidfalte, Wimpern am Lidrand, Tränenkarunkel innen
		float crease = exp( -pow( ( el.y - upOpen - 0.0046 ) / 0.0009, 2.0 ) ) * uu * ( 1.0 - uLids.x );
		vec3 lidC = alb * mix( vec3( 1.0 ), vec3( 0.97, 0.86, 0.85 ), 0.6 ) * ( 1.0 - 0.32 * crease );
		float lashU = smoothstep( 0.0014, 0.0002, el.y - upLid ) * step( upLid, el.y ) * smoothstep( uLid.x * 1.05, uLid.x * 0.5, abs( xo ) );
		float lashL = smoothstep( 0.0008, 0.0, loLid - el.y ) * step( el.y, loLid ) * smoothstep( uLid.x, uLid.x * 0.4, abs( xo ) ) * 0.5;
		lidC = mix( lidC, vec3( 0.025, 0.02, 0.018 ), max( lashU * 0.9, lashL ) );
		float car = exp( -pow( ( xo + uLid.x * 0.92 ) / 0.0016, 2.0 ) - pow( el.y / 0.0018, 2.0 ) );
		eyeC = mix( eyeC, vec3( 0.62, 0.3, 0.28 ), car * 0.8 );
		alb = mix( lidC, eyeC, npOpen );
		npRough = mix( npRough, 0.035, npOpen );
		npSss *= 1.0 - npOpen;
		npH = mix( npH, 0.0005 * smoothstep( 0.86, 1.0, c ), npOpen );
	}
	// Mundraum, Zähne, Zunge (Tiefe hinter der Lippenebene aus der gemorphten Lage → Innenraum verschattet)
	float mouthIn = max( fCav, max( fTeeth, fTongue ) );
	float dark = smoothstep( 0.003, 0.02, vMp.z + 0.101 );
	alb = mix( alb, vec3( 0.13, 0.035, 0.03 ), fCav );
	alb = mix( alb, vec3( 0.66, 0.62, 0.54 ), fTeeth );
	alb = mix( alb, vec3( 0.46, 0.17, 0.17 ), fTongue );
	alb *= mix( 1.0, mix( 0.85, 0.12, dark ), mouthIn );
	npMouthOcc = mix( 1.0, mix( 0.7, 0.05, dark ), mouthIn );
	npRough = mix( npRough, 0.26, max( fTeeth, fTongue ) );
	npRough = mix( npRough, 0.55, fCav );
	npSss *= 1.0 - max( fTeeth, fCav ) * 0.8;
	// Ohren: durchscheinend
	npThin = part * 0.35 + exp( -( pow( ( ax - 0.0125 ) / 0.008, 2.0 ) + pow( ( q.y + 0.038 ) / 0.008, 2.0 ) ) ) * front * 0.15;
	alb *= mix( 0.6, 1.0, fAo );
	// Abdeckung (Sturmhaube/Halstuch/Shemagh): Strickstoff
	float cov = npCoverMask( q ) * ( 1.0 - npOpen );
	if ( cov > 0.001 ) {
		float az = atan( q.x, -q.z ) * 0.075;
		float rib = 0.5 + 0.5 * sin( az * 2600.0 + npNoise( q * 400.0 ) * 1.5 );
		float fuzz = npNoise( q * 1800.0 );
		float mott = smoothstep( 0.35, 0.65, npNoise( q * 45.0 ) );
		vec3 fab = mix( uCoverCol, uCoverCol2, mott ) * ( 0.82 + 0.18 * rib ) * ( 0.9 + 0.2 * fuzz );
		fab *= mix( 0.65, 1.0, fAo );
		alb = mix( alb, fab, cov );
		npRough = mix( npRough, 0.96, cov );
		npSss *= 1.0 - cov;
		npThin *= 1.0 - cov;
		npH = mix( npH, rib * 0.00022 + fuzz * 0.00006, cov * fineFade );
	}
	diffuseColor.rgb *= alb;
`;

const FACE_NORMAL = /* glsl */`
	#ifndef NP_LOW
	{
		vec3 dpx = dFdx( -vViewPosition ), dpy = dFdy( -vViewPosition );
		float dhx = dFdx( npH ), dhy = dFdy( npH );
		vec3 r1 = cross( dpy, normal ), r2 = cross( normal, dpx );
		float det = dot( dpx, r1 );
		vec3 grad = sign( det ) * ( dhx * r1 + dhy * r2 );
		vec3 nn = normalize( abs( det ) * normal - grad );
		if ( !any( isnan( nn ) ) ) normal = nn;
	}
	#endif
`;

// Haut-Streuung (Näherung): umschlingendes Licht über die Schattengrenze, rötlich; Gegenlicht durch dünne Stellen
const SSS_PATCH = /* glsl */`vec3 irradiance = dotNL * directLight.color;
	#ifdef NP_FACE
	{
		float npWrap = saturate( ( dot( geometryNormal, directLight.direction ) + 0.55 ) / 1.55 );
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

/**
 * Material des Kopfes (eigenes Exemplar je Soldat: Blick, Lider, Brauen, Farben sind Uniforms; Programm geteilt).
 * shared: Uniform-Objekte des Körpermaterials (Auflösen, Randlicht) – gleiche Werte ohne Abgleich.
 */
export function faceMaterial({ low = false, shared = null } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, envMapIntensity: 0.85 });
  m.name = 'soldat:gesicht';
  const S = shared || {};
  const U = (m.userData.faceU = {
    uCover: { value: 0 }, uCoverEars: { value: 0 },
    uEye: { value: new THREE.Vector4(EYE.x, EYE.y, EYE.z, EYE.r) },
    uLid: { value: new THREE.Vector4(EYE.hw, EYE.up, EYE.lo, 0) },
    uSkin: { value: lin('#b08c74') }, uHairCol: { value: lin('#2a2119') }, uHairAmt: { value: 1 }, uStubble: { value: 0.6 },
    uIris: { value: lin('#5a3c22') },
    uGazeL: { value: new THREE.Vector3(0, 0, -1) }, uGazeR: { value: new THREE.Vector3(0, 0, -1) },
    uLids: { value: new THREE.Vector4(0, 0, 0, 0) }, uBrow: { value: new THREE.Vector4(0, 0, 0, 0) }, uSmileLines: { value: 0 },
    uCoverCol: { value: lin('#2b2a27') }, uCoverCol2: { value: lin('#2b2a27') }, uSssAmt: { value: 0.45 },
    uDissolve: S.uDissolve || { value: 0 },
    uRim: S.uRim || { value: 0 }, uRimPow: S.uRimPow || { value: 3 }, uRimTint: S.uRimTint || { value: 0 },
    uRimColor: S.uRimColor || { value: new THREE.Color(1, 1, 1) }, uLightFloor: S.uLightFloor || { value: 0 }, uAmbRef: S.uAmbRef || { value: 2.4 },
  });
  if (low) m.defines = { NP_LOW: '' };
  m.onBeforeCompile = (shader) => {
    for (const k of Object.keys(U)) shader.uniforms[k] = U[k];
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <morphtarget_vertex>', `#include <morphtarget_vertex>
	vRest = aRest;
	{
		// Stoff über dem Gesicht: etwas aufgetragen, Mundbewegung gedämpft; Ohren unter der Haube angelegt
		float npCov = npCoverMask( aRest.xyz );
		transformed = position + ( transformed - position ) * ( 1.0 - npCov * 0.45 ) + normal * npCov * 0.0026;
		if ( aRest.w > 1.5 && uCoverEars > 0.5 ) transformed.x = mix( transformed.x, sign( transformed.x ) * 0.071, 0.6 );
		vMp = transformed - vec3( ${HEAD_C[0].toFixed(3)}, ${HEAD_C[1].toFixed(3)}, ${HEAD_C[2].toFixed(3)} );
	}`);
    let fs = FRAG_HEAD + shader.fragmentShader;
    fs = fs.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace('vec3 irradiance = dotNL * directLight.color;', SSS_PATCH));
    fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
	float sdDis = 0.0;
	if ( uDissolve > 0.0 ) {
		vec3 dq = floor( ( vRest.xyz + vec3( ${HEAD_C[0].toFixed(3)}, ${HEAD_C[1].toFixed(3)}, ${HEAD_C[2].toFixed(3)} ) ) * 34.0 );
		sdDis = fract( sin( dot( dq, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ) * 0.85 + fract( ( vRest.y + ${HEAD_C[1].toFixed(3)} ) * 1.7 ) * 0.15;
		if ( sdDis < uDissolve ) discard;
	}`);
    fs = fs.replace('#include <color_fragment>', FACE_ALBEDO);
    fs = fs.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp( npRough, 0.03, 1.0 );');
    fs = fs.replace('#include <normal_fragment_maps>', FACE_NORMAL);
    fs = fs.replace('#include <aomap_fragment>', `#include <aomap_fragment>
	float npAo = clamp( vRest.w - floor( vRest.w * 0.5 + 0.01 ) * 2.0, 0.0, 1.0 );
	reflectedLight.indirectDiffuse *= npAo * npMouthOcc;
	reflectedLight.indirectSpecular *= mix( 1.0, npAo, 0.8 ) * npMouthOcc;
	reflectedLight.directDiffuse *= mix( 1.0, npMouthOcc, 0.8 );
	reflectedLight.directSpecular *= npMouthOcc;`);
    fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	if ( uDissolve > 0.0 && sdDis < uDissolve + 0.035 ) totalEmissiveRadiance += vec3( 1.0, 0.36, 0.08 ) * 0.6;`);
    fs = fs.replace('#include <opaque_fragment>', `${RIM}
	#include <opaque_fragment>`);
    shader.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'np-face-4' + (low ? 'l' : 'h');
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

const IRIS = ['#3d2816', '#5a3c22', '#6b5330', '#55603f', '#4d5f6a', '#3f5f80'];
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const HEAD_BIND = BIND[BONE.head];
// Augenmitten im Kopfknochen-Raum (Bindepose ohne Rotation → Modellraum minus Kopfknochen)
const EYE_L = new THREE.Vector3(-EYE.x + HEAD_C[0] - HEAD_BIND[0], EYE.y + HEAD_C[1] - HEAD_BIND[1], EYE.z + HEAD_C[2] - HEAD_BIND[2]);
const EYE_R = new THREE.Vector3(EYE.x + HEAD_C[0] - HEAD_BIND[0], EYE.y + HEAD_C[1] - HEAD_BIND[1], EYE.z + HEAD_C[2] - HEAD_BIND[2]);
const hashN = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

export class SoldierFace {
  /**
   * opts: { res ('near'|'cine'|'mid'), shape (Kopfform oder Index in SHAPE_PRESETS), cover ('auto'|'none'|'balaclava'|
   * 'gaiter'|'shemagh'), skin (Hex oder Index), hair (Hex), hairAmt (0 kahl … 1), stubble (0…1), eyes (Iris-Hex), low }
   */
  constructor(soldier, opts = {}) {
    this.soldier = soldier;
    const V = VARIANTS.find((v) => v.id === soldier.variant) || VARIANTS[0];
    this.variant = V;
    const seed = hashN(soldier.id * 31 + VARIANTS.indexOf(V) * 7 + 3);
    const shape = typeof opts.shape === 'object' && opts.shape ? opts.shape : SHAPE_PRESETS[(typeof opts.shape === 'number' ? opts.shape : Math.floor(seed * SHAPE_PRESETS.length)) % SHAPE_PRESETS.length];
    this.res = opts.res || 'near';
    const shared = soldier.material && soldier.material.userData.npU;
    const mat = (this.material = faceMaterial({ low: !!opts.low, shared }));
    liveFaces++;
    const U = (this.u = mat.userData.faceU);
    const skin = typeof opts.skin === 'string' ? opts.skin : SKIN_TONES[(typeof opts.skin === 'number' ? opts.skin : V.skin) % SKIN_TONES.length];
    U.uSkin.value.set(skin);
    U.uHairCol.value.set(opts.hair || V.hair || '#2a2119');
    U.uHairAmt.value = opts.hairAmt ?? 1;
    U.uStubble.value = opts.stubble ?? 0.35 + hashN(soldier.id * 13 + 1) * 0.6;
    U.uIris.value.set(opts.eyes || IRIS[Math.floor(hashN(soldier.id * 17 + 5) * IRIS.length)]);
    this.setCover(opts.cover || 'auto');
    // Netz kommt aus dem Hintergrund-Rechner (face-worker.js); bis dahin zeichnet der Soldat seinen einfachen Körperkopf.
    // opts.sync: sofort im Hauptfaden bauen (Prüfstand).
    this.mesh = null;
    this.castShadow = false;
    this.disposed = false;
    this.ready = (opts.sync ? Promise.resolve(faceGeometry(this.res, shape)) : faceGeometryAsync(this.res, shape)).then((geo) => {
      if (this.disposed) return null;
      const mesh = (this.mesh = new THREE.SkinnedMesh(geo, mat));
      mesh.name = 'soldat-gesicht';
      mesh.frustumCulled = false;
      mesh.castShadow = this.castShadow;
      mesh.receiveShadow = true;
      mesh.bind(soldier.skeleton, new THREE.Matrix4());
      mesh.visible = false;
      soldier.root.add(mesh);
      warmProgram(mesh, !!opts.low);
      this._step(0);
      if (typeof soldier._faceReady === 'function') soldier._faceReady(this);
      this.syncVisible(soldier.lod);
      return this;
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
    // Haare unter Helm/Haube sind egal; Kahlrasur unter Sturmhaube spart nichts – Haarfarbe bleibt
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
    dt = Math.min(0.1, Math.max(0, dt || 0));
    this.time += dt;
    // Mundkanäle: kritisch gedämpfte Feder (ω ≈ 30/s) → weich, Verschlusslaute schließen dennoch
    // exakte Lösung der kritisch gedämpften Feder (stabil für jedes dt, auch 1/10 s bei fernen Bots)
    const w = 30, ex = Math.exp(-w * dt);
    for (const k of CH) {
      const y = this.ch[k] - this.chT[k], v = this.chV[k], t = (v + w * y) * dt;
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
    const open = this.jawOverride != null ? this.jawOverride : c.open * 0.72 + e.jaw + dead * 0.22;
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
    for (const n of Object.keys(this.raw)) W[I[n]] = this.raw[n];
    const U = this.u;
    // Brauen im Shader passend zu den Brauen-Morphs (gleiche Verschiebung wie in face-sdf.js warp())
    U.uBrow.value.set(
      -0.0052 * W[I.browDown] + 0.0078 * W[I.browInnerUp] + 0.0068 * W[I.browUp],
      -0.0018 * W[I.browDown] + 0.0012 * W[I.browInnerUp] + 0.0068 * W[I.browUp],
      clamp(W[I.browInnerUp] * 0.8 + W[I.browUp], 0, 1.4),
      clamp(W[I.browDown], 0, 1.2),
    );
    U.uSmileLines.value = clamp(W[I.smile] + e.squint * 0.5, 0, 1.4);
    // Blinzeln (schnell zu, langsamer auf)
    if (this.autoBlink && !this.dead) {
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) { this.blink(0.14 + Math.random() * 0.08); this.nextBlink = 2 + Math.random() * 4.2; if (Math.random() < 0.12) this.nextBlink = 0.3; }
    }
    this.blinkT += dt;
    const bt = this.blinkT / this.blinkDur;
    const bl = bt >= 1 ? 0 : bt < 0.4 ? bt / 0.4 : 1 - (bt - 0.4) / 0.6;
    const lid = Math.max(bl, this.closed, e.lidDroop * 0.4, dead * 0.62);
    // Blick: Ziel → Kopfknochen-Raum → je Auge Richtung (Konvergenz auf nahe Ziele), begrenzt wie echte Augen (±35°/±24°)
    const head = this.soldier.bones[BONE.head];
    const tg = this.gazeT;
    this.saccT -= dt;
    if (this.saccT <= 0) { this.sacc[0] = (Math.random() - 0.5) * 0.09; this.sacc[1] = (Math.random() - 0.5) * 0.05; this.saccT = 0.4 + Math.random() * 1.8; }
    const sy = this.dead ? 0 : this.sacc[0], sp = this.dead ? 0 : this.sacc[1];
    if (this.lookTarget && !this.dead) {
      head.updateWorldMatrix(true, false);
      _m.copy(head.matrixWorld).invert();
      const t = _v.copy(this.lookTarget).applyMatrix4(_m);
      let k = 0;
      for (const eye of [EYE_L, EYE_R]) {
        const dx = t.x - eye.x, dy = t.y - eye.y, dz = t.z - eye.z;
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
    dir(U.uGazeL.value, g[0], g[1]);
    dir(U.uGazeR.value, g[2], g[3]);
    const gp = (g[1] + g[3]) * 0.5;
    U.uLids.value.set(lid, clamp(e.squint, 0, 1), clamp(e.lidOpen, 0, 1), clamp(gp / 0.4, -1, 1));
  }

  /** Sichtbarkeit nach Detailstufe des Soldaten. */
  syncVisible(lod) { if (this.mesh) this.mesh.visible = this.forceVisible || lod === 0; }

  setShadows(on) { this.castShadow = !!on; if (this.mesh) this.mesh.castShadow = this.castShadow; }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (--liveFaces <= 0) { liveFaces = 0; warmed.clear(); }
    if (this.mesh) this.mesh.removeFromParent();
    this.material.dispose();
    // Geometrie bleibt im Cache (geteilt)
  }
}
