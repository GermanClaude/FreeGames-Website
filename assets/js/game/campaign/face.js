// NULLPUNKT — Kampagne: Gesichts-Adapter (Mund, Lider, Blick, Mimik) für Soldaten in Zwischensequenzen und Funksprüchen.
//
// createFaceRig(soldier) → FaceRig mit einer einheitlichen Schnittstelle:
//   setMouth({ open, wide, round, press, teeth }), setViseme(id, weight), setExpression(id, weight),
//   lookAt(Vector3 | null), blink(), update(dt) (NACH soldier.animate aufrufen – schreibt Kopf/Hals zusätzlich), dispose()
//
// Zwei Umsetzungen hinter derselben Schnittstelle:
//   'api'      – die Gesichts-API der Soldaten (bots/soldier, Strang gfx-soldat: setViseme/setExpression/lookAt/blink am
//                Soldaten bzw. an soldier.face). Wird automatisch genommen, sobald sie existiert: nur hier umstellen.
//   'fallback' – eigene minimale Lösung: dunkle Mundöffnung (Höhe = Kiefer, Breite/Rundung je Laut, Zahnreihe bei
//                Zischlauten/F), Oberlider zum Blinzeln/Zusammenkneifen, Kopf-/Halsdrehung zum Blickziel, leichtes
//                Nicken im Sprechrhythmus. Hängt am Kopfknochen und ist nur aus der Nähe sichtbar (Detailstufe 0).
//
// FaceDriver: spielt eine Lippen-Zeitachse (lipsync.js) mit gedämpfter Feder ab, blinzelt in zufälligen Abständen
// (und zu Satzbeginn), hält Blickziel und Mimik je Satz.

import * as THREE from 'three';
import { BONE, BIND } from '../bots/soldier/rig.js?v=20261119182451';
import { variantDef } from '../bots/soldier/gear.js?v=20261119182451';
import { SKIN_TONES } from '../bots/soldier/materials.js?v=20261119182451';
import { sampleMouth, expressionFor, VISEME_SHAPES } from './lipsync.js?v=20261119182451';

// Gesichtsmaße im Modellraum (body-mesh.js face: eyeZ −0,0804, mouthZ −0,1031; Augen auf 1,692 m)
const EYE_Y = 1.692, EYE_X = 0.033, EYE_Z = -0.0804;
const MOUTH_Y = 1.626, MOUTH_Z = -0.1031;
const HEAD = BIND[BONE.head]; // Bindeposition des Kopfknochens
const NECK = BONE.neck;

/** Mimik → { lid (0 offen … 1 zu), wide (Mundwinkel ±), pitch (rad, + = nach unten), roll (rad), brow } */
const EXPR = {
  neutral: { lid: 0.12, wide: 0, pitch: 0, roll: 0 },
  ernst: { lid: 0.22, wide: -0.08, pitch: -0.02, roll: 0 },
  angespannt: { lid: 0.32, wide: 0.1, pitch: -0.04, roll: 0 },
  fragend: { lid: 0.02, wide: 0, pitch: -0.03, roll: 0.09 },
  nachdenklich: { lid: 0.38, wide: -0.1, pitch: 0.1, roll: 0.05 },
  erleichtert: { lid: 0.28, wide: 0.14, pitch: -0.03, roll: 0 },
  traurig: { lid: 0.45, wide: -0.12, pitch: 0.14, roll: 0.03 },
  entschlossen: { lid: 0.26, wide: -0.02, pitch: -0.05, roll: 0 },
};

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** Gesichts-API des Soldaten (Strang gfx-soldat), falls vorhanden – sonst null. */
export function faceApiOf(soldier) {
  if (!soldier) return null;
  const f = soldier.face && typeof soldier.face.setViseme === 'function' ? soldier.face : typeof soldier.setViseme === 'function' ? soldier : null;
  return f;
}

/** Gibt es die Gesichts-API (für Diagnose/Tests)? */
export function hasFaceApi(soldier) { return !!faceApiOf(soldier); }

export function createFaceRig(soldier, opts = {}) {
  const api = opts.forceFallback ? null : faceApiOf(soldier);
  return api ? new ApiFace(soldier, api) : new FallbackFace(soldier);
}

/* ======================================================================== API (gfx-soldat) */

class ApiFace {
  constructor(soldier, api) {
    this.mode = 'api';
    this.soldier = soldier;
    this.api = api;
    this.head = new HeadTurn(soldier);
  }
  // Kanäle der Lippen-Zeitachse direkt (gleiche Kanäle wie VISEMES der Gesichts-API) – die Feder liegt im FaceDriver
  setMouth(m) { try { this.api.setMouth(m); } catch { /* */ } }
  setViseme(id, w = 1) { try { this.api.setViseme(id, w); } catch { /* */ } }
  setExpression(id, w = 1) { if (typeof this.api.setExpression === 'function') { try { this.api.setExpression(id, w); } catch { /* */ } } this.head.setExpression(id, w); }
  lookAt(p) { if (typeof this.api.lookAt === 'function') { try { this.api.lookAt(p || null); } catch { /* */ } } this.head.lookAt(p); }
  blink() { if (typeof this.api.blink === 'function') { try { this.api.blink(); } catch { /* */ } } }
  set headComp(v) { this.head.headComp = v; }
  update(dt) {
    this.head.update(dt, 0);
    // updateFace übernimmt die Fortschreibung (keine doppelte Zeit, soldier.animate ruft dann nicht mehr)
    // in Teilschritten ≤ 1/60 s: die Mundfeder der API (ω 30/s, explizit) schwingt bei großen Bildzeiten (≥ 0,04 s) auf
    if (typeof this.api.updateFace === 'function') {
      const n = Math.min(8, Math.max(1, Math.ceil(dt * 60)));
      try { for (let i = 0; i < n; i++) this.api.updateFace(dt / n); } catch { /* */ }
    }
  }
  setVisible() {}
  dispose() { try { this.api.setViseme('sil'); this.api.manual = false; } catch { /* */ } }
}

/** Kopf/Hals zum Blickziel und Kopfhaltung je Mimik (nach soldier.animate – zusätzliche Drehung). */
class HeadTurn {
  constructor(soldier) {
    this.soldier = soldier;
    this.look = null;
    this.gaze = { yaw: 0, pitch: 0 };
    this.expr = EXPR.ernst;
    this.exprW = 1;
    this.nod = 0;
  }
  lookAt(p) { this.look = p ? (this.look || new THREE.Vector3()).copy(p) : null; }
  setExpression(id, w = 1) { this.expr = EXPR[id] || EXPR.neutral; this.exprW = clamp(w, 0, 1); }
  update(dt, open = 0) {
    const S = this.soldier;
    let ty = 0, tp = 0;
    if (this.look && S.root) {
      S.root.updateMatrixWorld();
      _v.copy(this.look);
      S.root.worldToLocal(_v);
      const dx = _v.x, dy = _v.y - 1.62, dz = _v.z;
      ty = clamp(Math.atan2(-dx, -dz), -1.05, 1.05);
      tp = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.45);
    }
    this.gaze.yaw = damp(this.gaze.yaw, ty, 5, dt);
    this.gaze.pitch = damp(this.gaze.pitch, tp, 5, dt);
    this.nod = damp(this.nod, open * 0.05, 14, dt);
    const e = this.expr, k = this.exprW;
    const pitch = this.gaze.pitch - e.pitch * k - this.nod + (this.headComp || 0);
    const yaw = this.gaze.yaw, roll = e.roll * k;
    const neck = S.bones[NECK], head = S.bones[BONE.head];
    _q.setFromEuler(_e.set(pitch * 0.35, yaw * 0.4, 0, 'YXZ'));
    neck.quaternion.multiply(_q);
    _q.setFromEuler(_e.set(pitch * 0.65, yaw * 0.6, roll, 'YXZ'));
    head.quaternion.multiply(_q);
  }
}

/* ======================================================================== Ersatz (eigene Mundbewegung) */

let sharedGeo = null;
const mats = new Map();
function geo() {
  if (!sharedGeo) sharedGeo = new THREE.SphereGeometry(1, 14, 8);
  return sharedGeo;
}
function mat(color) {
  let m = mats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
    m.name = `gesicht:${color}`;
    mats.set(color, m);
  }
  return m;
}

class FallbackFace {
  constructor(soldier) {
    this.mode = 'fallback';
    this.soldier = soldier;
    const V = variantDef(soldier.variant);
    const covered = V.face === 'balaclava';
    // Lidfarbe: Sturmhaube = dunkler Stoff, sonst Hautton der Ausführung
    const lidColor = covered ? '#2c2b28' : SKIN_TONES[V.skin % SKIN_TONES.length];
    this.covered = covered;
    const g = (this.group = new THREE.Group());
    g.name = 'gesicht';
    const head = soldier.bones[BONE.head];
    head.add(g);
    // Kopfknochen-lokal: Modellraum minus Bindeposition (Bindepose ohne Rotation)
    const L = (x, y, z) => new THREE.Vector3(x - HEAD[0], y - HEAD[1], z - HEAD[2]);
    const mk = (color, name) => {
      const m = new THREE.Mesh(geo(), color instanceof THREE.Material ? color : mat(color));
      m.name = name;
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
      g.add(m);
      return m;
    };
    // Mundöffnung (Innenraum) + Zahnreihe + Lippenrand (etwas heller als die Öffnung, gibt Kontur)
    this.mouthPos = L(0, MOUTH_Y, MOUTH_Z + 0.0035);
    this.lip = mk(covered ? '#3a3834' : '#7a4a42', 'mund-rand');
    this.inner = mk('#160807', 'mund');
    this.teeth = mk('#d9d3c6', 'zaehne');
    this.lowerLip = mk(covered ? '#34322e' : '#8a554b', 'unterlippe');
    // Oberlider
    this.lids = [-1, 1].map((s) => {
      const m = mk(lidColor, s < 0 ? 'lid-l' : 'lid-r');
      m.userData.base = L(EYE_X * s, EYE_Y, EYE_Z + 0.0002);
      return m;
    });
    this.m = { open: 0, wide: 0.3, round: 0, press: 0.3, teeth: 0 };
    this.lid = 0.12; // aktuelle Lidstellung 0…1 (ohne Blinzeln)
    this.blinkT = 1; // ≥ 1 = kein Blinzeln
    this.expr = EXPR.ernst;
    this.exprW = 1;
    this.look = null;
    this.gaze = { yaw: 0, pitch: 0 };
    this.nod = 0;
    this._apply();
  }

  setMouth(m) {
    const t = this.m;
    t.open = m.open ?? t.open; t.wide = m.wide ?? t.wide; t.round = m.round ?? t.round; t.press = m.press ?? t.press; t.teeth = m.teeth ?? t.teeth;
  }

  setViseme(id, w = 1) {
    const s = VISEME_SHAPES[id] || VISEME_SHAPES.sil;
    this.setMouth({ open: s.open * w, wide: s.wide, round: s.round * w, press: s.press * w, teeth: s.teeth * w });
  }

  setExpression(id, w = 1) { this.expr = EXPR[id] || EXPR.neutral; this.exprW = clamp(w, 0, 1); }
  lookAt(p) { this.look = p ? (this.look || new THREE.Vector3()).copy(p) : null; }
  blink() { if (this.blinkT >= 1) this.blinkT = 0; }
  setVisible(on) { this.group.visible = !!on; }

  update(dt) {
    // Blinzeln: 0,16 s zu und wieder auf
    if (this.blinkT < 1) this.blinkT = Math.min(1, this.blinkT + dt / 0.17);
    const e = this.expr, k = this.exprW;
    this.lid = damp(this.lid, e.lid * k, 6, dt);
    // Kopf/Hals zum Blickziel (nach der Animation des Soldaten: zusätzliche Drehung)
    const S = this.soldier;
    let ty = 0, tp = 0;
    if (this.look && S.root) {
      S.root.updateMatrixWorld();
      _v.copy(this.look);
      S.root.worldToLocal(_v);
      const dx = _v.x, dy = _v.y - 1.62, dz = _v.z;
      // Körper-Blickrichtung des Animators abziehen (Gierung im Modellraum: Rumpf zeigt nach −Z)
      ty = clamp(Math.atan2(-dx, -dz), -1.05, 1.05);
      tp = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.45);
    }
    this.gaze.yaw = damp(this.gaze.yaw, ty, 5, dt);
    this.gaze.pitch = damp(this.gaze.pitch, tp, 5, dt);
    this.nod = damp(this.nod, this.m.open * 0.05, 14, dt);
    const pitch = this.gaze.pitch - (e.pitch * k) - this.nod + (this.headComp || 0); // + = nach oben (Rotation um +X hebt das Kinn bei Blick −Z)
    const yaw = this.gaze.yaw, roll = e.roll * k;
    const neck = S.bones[NECK], head = S.bones[BONE.head];
    _q.setFromEuler(_e.set(pitch * 0.35, yaw * 0.4, 0, 'YXZ'));
    neck.quaternion.multiply(_q);
    _q.setFromEuler(_e.set(pitch * 0.65, yaw * 0.6, roll, 'YXZ'));
    head.quaternion.multiply(_q);
    this._apply();
  }

  _apply() {
    const m = this.m;
    const open = clamp(m.open * (1 - m.press), 0, 1.2);
    const width = 0.0165 + 0.009 * clamp(m.wide + this.expr.wide * this.exprW, -0.3, 1.2) - 0.006 * m.round;
    const h = 0.0012 + 0.0175 * open + 0.003 * m.round * (open > 0.05 ? 1 : 0);
    const p = this.mouthPos;
    // Unterkiefer: Mitte der Öffnung sinkt mit (Oberlippe bleibt fast stehen)
    const cy = p.y - h * 0.55;
    this.inner.position.set(p.x, cy, p.z - 0.0004);
    this.inner.scale.set(width, h, 0.0045);
    this.lip.position.set(p.x, cy, p.z + 0.0006);
    this.lip.scale.set(width + 0.0028, h + 0.0026, 0.0042);
    // Unterlippe: unter der Öffnung, wölbt bei F (Zähne auf Unterlippe) leicht nach innen
    this.lowerLip.position.set(p.x, cy - h - 0.0018, p.z - 0.0006 + 0.0015 * m.teeth);
    this.lowerLip.scale.set(width * 0.82, 0.0032, 0.0042);
    // Zähne: obere Reihe, sichtbar bei leicht offenem Mund und Zahnlauten
    const tv = clamp(m.teeth * (open > 0.04 ? 1 : 0.4), 0, 1);
    this.teeth.visible = tv > 0.05;
    this.teeth.position.set(p.x, p.y - 0.0008 - Math.min(h, 0.006) * 0.25, p.z - 0.0012);
    this.teeth.scale.set(width * 0.72, 0.0018 + 0.0016 * tv, 0.003);
    // Lider: Grundstellung (Mimik) + Blinzeln
    const b = this.blinkT < 1 ? Math.sin(this.blinkT * Math.PI) : 0;
    const closed = clamp(this.lid + (1 - this.lid) * b, 0, 1);
    for (const l of this.lids) {
      const base = l.userData.base;
      l.position.set(base.x, base.y + 0.0062 - 0.0062 * closed * 0.98 + 0.0011, base.z);
      l.scale.set(0.0142, 0.0016 + 0.0064 * closed, 0.0052);
    }
  }

  dispose() {
    this.group.removeFromParent();
  }
}

/* ======================================================================== Treiber */

/**
 * Spielt Zeitachsen ab und belebt das Gesicht. say(track, expr) startet eine Zeile; idle: Blinzeln, Mimik, Blick.
 */
export class FaceDriver {
  constructor(rig) {
    this.rig = rig;
    this.track = null;
    this.t = 0;
    this.speaking = false;
    this.cur = { open: 0, wide: 0.3, round: 0, press: 0.3, teeth: 0 };
    this.vel = { open: 0, wide: 0, round: 0, press: 0, teeth: 0 };
    this._s = {};
    this.nextBlink = 1 + Math.random() * 3;
    this.lastViseme = 'sil';
  }

  /** Zeile sprechen (track aus textToVisemes). */
  say(track, expr = null) {
    this.track = track;
    this.t = 0;
    this.speaking = !!track;
    if (track) {
      this.rig.setExpression(expressionFor(track.text, expr), 1);
      if (Math.random() < 0.6) this.rig.blink();
    }
  }

  stop() { this.track = null; this.speaking = false; }
  get done() { return !this.track || this.t >= this.track.duration; }

  update(dt) {
    const rig = this.rig;
    if (this.track) {
      this.t += dt;
      if (this.t >= this.track.duration) { this.track = null; this.speaking = false; }
    }
    const s = this.track ? sampleMouth(this.track, this.t, this._s) : sampleMouth(null, 0, this._s);
    // Gedämpfte Feder je Kanal (kritisch gedämpft, ω ≈ 34/s): weich, schließt Verschlusslaute dennoch fast ganz
    const w = 34;
    // exakte Lösung der kritisch gedämpften Feder: stabil bei jeder Bildzeit (auch < 5 FPS, keine Explosion/NaN)
    const t = Math.min(Math.max(dt, 0), 1), e = Math.exp(-w * t);
    for (const k of ['open', 'wide', 'round', 'press', 'teeth']) {
      const g = s[k] ?? 0, c1 = this.cur[k] - g, c2 = this.vel[k] + w * c1;
      this.cur[k] = g + (c1 + c2 * t) * e;
      this.vel[k] = (c2 - w * (c1 + c2 * t)) * e;
    }
    // Gesichts-API: Rohkanäle (sie federt selbst); Ersatz: eigene Feder
    rig.setMouth(rig.mode === 'api' ? s : this.cur);
    this.lastViseme = s.viseme;
    // Blinzeln alle 2–5 s
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { rig.blink(); this.nextBlink = 2 + Math.random() * 3.2; }
    rig.update(dt);
  }
}
