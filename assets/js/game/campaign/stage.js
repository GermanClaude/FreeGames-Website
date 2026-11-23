// NULLPUNKT — Kampagne: Bühne für Zwischensequenzen – Darsteller, Kamerafahrten, Ablauf (Beats) mit Dialog und Lip-Sync.
//
// StageActor: ein Soldat aus dem vorhandenen Rig (bots/character.js createSoldier + soldier/animator.js) ohne KI.
//   Choreografie: walk(Punkte, Tempo) entlang einer Strecke (Laufanimation aus der Geschwindigkeit), face(Ziel), look(Ziel)
//   (Kopf/Hals über das Gesicht), crouch/aim (Haltung), place(); Mund/Lider/Blick über face.js (Adapter → Gesichts-API
//   oder eigene Mundbewegung). update(dt, Kameraposition) setzt Detailstufe (Nahaufnahme = Stufe 0) und Gesicht.
//
// Kamera (Shot): from/to (Fahrt), path (Catmull-Rom-Spline durch Punkte), look/lookTo (Blickpunkt, ebenfalls fahrbar),
//   close: 'id' (Nahaufnahme Gesicht), over: ['a','b'] (über die Schulter von a auf b), orbit (Kreisfahrt um Punkt/Figur),
//   fov/fovTo, ease ('linear'|'in'|'out'|'inOut'), shake. Bezüge auf Figuren werden jedes Bild neu ausgewertet.
//
// Cutscene: { id, location: [Titel, Unterzeile], cast: { id: {...} }, beats: [{ cam, say: { who, text, expr, look },
//   act: [{ who, walk|face|look|crouch|aim|place|hide, at }], dur, fadeIn, fadeOut, loc }] }. Ein Beat dauert dur bzw. bis
//   die Zeile gesprochen ist (Lesetempo) + Nachlauf. Überspringen: ganzer Ablauf (Knopf, Leertaste/Eingabe, Gamepad A).

import * as THREE from 'three';
import { createFaceRig, FaceDriver } from './face.js?v=20261123115551';
import { textToVisemes, subtitleDuration, wordAt } from './lipsync.js?v=20261123115551';
import { tx } from '../../shared/i18n.js?v=20261123115551'; // Zeilen in der gewählten Sprache

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _u = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  smooth: (t) => t * t * (3 - 2 * t),
};

export const yawTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

/** [x, z] | [x, y, z] | Vector3 → Vector3 (y aus dem Boden, wenn fehlt; top: oberste Standfläche, z. B. Dach). */
export function toVec(G, p, out = new THREE.Vector3(), lift = 0, top = false) {
  if (!p) return null;
  if (p.isVector3) return out.copy(p);
  if (p.length === 3) return out.set(p[0], p[1], p[2]);
  const y = top ? topY(G, p[0], p[1]) : floorY(G, p[0], p[1]);
  return out.set(p[0], y + lift, p[1]);
}

/*
 * Böden unter (x, z) – Boden-Fix Runde 2. Früher lief floorY mit world.groundHeight von oben nach unten und nahm die
 * unterste Fläche; die Strahltests sind beidseitig, also war die „unterste Fläche“ auf den Arena-Karten die UNTERSEITE
 * der 0,5 m dicken Bodenplatte (Altstadt, Werk, Hafen …: y = −0,5) – Darsteller, Verbündete und Checkpoints steckten
 * einen halben Meter im Boden. Jetzt: Strahl gegen die Kollisions-BVH mit Vorder-/Rückseiten-Erkennung (out.back);
 * Standflächen sind Oberseiten fester Körper, Unterseiten werden übersprungen, und eine Fläche zählt nur mit genug
 * Kopffreiheit bis zum nächsten Körper darüber (keine Böden „in“ Kisten oder unter Platten). Großkarten: Gelände (Höhenfeld)
 * ist Teil der zusammengesetzten BVH; fehlt sie, Rückfall auf world.groundHeight von weit oben (Gelände > 60 m).
 */
const TOP = 400;
const CLEAR = 1.5; // m Kopffreiheit (Hocken passt)
const _fh = {};

/** Alle Standflächen unter (x, z) von oben nach unten: [{ y, clear }] (clear = Abstand zum festen Körper darüber). */
export function floorsAt(G, x, z) {
  const W = G.world;
  const B = W && W.collisionBVH;
  const out = [];
  if (B && typeof B.raycast === 'function') {
    let y = TOP, inside = false, ceil = Infinity, prev = null;
    for (let i = 0; i < 24; i++) {
      let hit = false;
      try { hit = B.raycast(x, y, z, 0, -1, 0, TOP * 2, _fh); } catch { hit = false; }
      if (!hit) break;
      const hy = y - _fh.t;
      if (_fh.back) {
        // Rückseite: wir verlassen einen Körper nach unten. War kein Eintritt gesehen (zusammenfallende Flächen), liegt
        // die Oberseite dieses Körpers auf Höhe des vorigen Treffers – dort ist eine Standfläche ohne Kopffreiheit.
        if (!inside && prev != null) out.push({ y: prev, clear: 0, bottom: hy });
        else if (out.length) out[out.length - 1].bottom = hy;
        inside = false;
        ceil = hy;
      } else {
        out.push({ y: hy, clear: ceil - hy, bottom: -Infinity });
        inside = true;
      }
      prev = hy;
      y = hy - 0.01;
    }
  }
  if (!out.length) {
    const gh = (from) => { try { const v = W && W.groundHeight ? W.groundHeight(x, z, from) : null; return Number.isFinite(v) ? v : null; } catch { return null; } };
    const g = gh(TOP);
    if (g != null) out.push({ y: g, clear: Infinity, bottom: -Infinity });
  }
  return out;
}

/** Unterste begehbare Fläche (Straße statt Dach/Obergeschoss, aber nie die Unterseite einer Platte). */
export function floorY(G, x, z) {
  const f = floorsAt(G, x, z);
  if (!f.length) return 0;
  for (let i = f.length - 1; i >= 0; i--) if (f[i].clear >= CLEAR) return f[i].y;
  return f[0].y;
}

/** Oberste Standfläche (Dach, Brücke, Steg). */
export function topY(G, x, z) {
  const f = floorsAt(G, x, z);
  return f.length ? f[0].y : 0;
}

/** Standfläche nahe der Höhe hint (Treppe, Obergeschoss, Gelände): bevorzugt die höchste Fläche ≤ hint + up. */
export function snapY(G, x, z, hint, up = 0.9) {
  const f = floorsAt(G, x, z).filter((e) => e.clear >= CLEAR);
  if (!f.length) return floorY(G, x, z);
  let best = null;
  for (const e of f) if (e.y <= hint + up && (best == null || e.y > best)) best = e.y;
  if (best == null) best = f[f.length - 1].y; // alles über uns (Geländeanstieg): unterste
  return best;
}

/**
 * Steckt ein Akteur mit den Füßen bei y in einem festen Körper (Bodenplatte, Gelände)? → Oberseite dieses Körpers, sonst
 * null. Körper ohne gesehene Unterseite (Gelände) zählen bis 3 m Tiefe. Hocken unter Tischen o. Ä. bleibt unberührt.
 */
export function buriedY(G, x, z, y, tol = 0.25) {
  for (const f of floorsAt(G, x, z)) {
    const bottom = Number.isFinite(f.bottom) ? f.bottom : f.y - 3;
    if (y < f.y - tol && y > bottom - 0.05) return f.y;
  }
  return null;
}

/** Boden unter (x, z) ab Höhe from (Laufen); fehlt er (Gelände höher als from), die passende Standfläche. */
export function groundY(G, x, z, from = 30) {
  const W = G.world;
  if (W && typeof W.groundHeight === 'function') {
    try { const y = W.groundHeight(x, z, from); if (Number.isFinite(y) && from - y < 6) return y; } catch { /* */ }
  }
  return snapY(G, x, z, from - 1.2);
}

/* ======================================================================== Darsteller */

export class StageActor {
  /** def: { id, name, color, team, variant, weapon, pos: [x,z]|[x,y,z], yaw, crouch, aim } */
  constructor(G, def = {}) {
    this.G = G;
    this.id = def.id;
    this.def = def;
    this.name = def.name || def.id;
    this.color = def.color || '#ffc23d';
    const S = G.modules.soldiers;
    // Darsteller immer mit Nah-Detailstufe und modelliertem Gesicht (Gesichts-API, bots/soldier/face.js): ohne Abdeckung, damit
    // der Mund sichtbar spricht; feine Kopfgeometrie ('cine') nur auf hoch/ultra
    const q = G.renderer ? G.renderer.quality : 'high';
    const quality = 'high';
    const face = def.face === false ? false : { cover: def.cover || 'none', res: q === 'high' || q === 'ultra' ? 'cine' : 'near', low: q === 'low', ...(def.faceOpts || {}) };
    let sol = null;
    try { sol = S.createSoldier({ team: def.team || 'A', variant: def.variant ?? 0, camo: def.camo || null, quality, models: G.modules.models, name: this.name, face, cinematic: true }); } catch (err) {
      console.warn('[Kampagne] Gesicht nicht verfügbar, Ersatz:', err);
      sol = S.createSoldier({ team: def.team || 'A', variant: def.variant ?? 0, camo: def.camo || null, quality, models: G.modules.models, name: this.name });
    }
    this.soldier = sol;
    this.soldier.tier = q === 'low' ? 'medium' : q;
    G.scene.add(this.soldier.root);
    if (def.weapon && G.data.WEAPONS[def.weapon] && G.bots && typeof G.bots.makeGun === 'function') {
      try { const gun = G.bots.makeGun(G.data.WEAPONS[def.weapon], null); if (gun) this.soldier.setWeaponModel(gun, G.data.WEAPONS[def.weapon]); } catch (err) { console.warn('[Kampagne] Waffe der Figur:', err); }
    }
    this.pos = toVec(G, def.pos || [0, 0], new THREE.Vector3(), 0, !!def.top);
    this.yaw = Number(def.yaw) || 0;
    this.aimYaw = this.yaw;
    this.pitch = Number.isFinite(def.aim) ? def.aim : -0.35; // Waffe leicht gesenkt
    this.crouch = !!def.crouch;
    this.path = null;
    this.speed = 1.4;
    this.vel = new THREE.Vector3();
    this.faceTarget = null; // Vector3 | StageActor
    this.lookTarget = null;
    this.soldier.reset(this.pos, this.yaw);
    this.rig = createFaceRig(this.soldier, { forceFallback: !!def.forceFallback });
    this.face = new FaceDriver(this.rig);
    this.hidden = false;
    this._head = new THREE.Vector3();
  }

  get faceMode() { return this.rig.mode; }

  headPosition(out = new THREE.Vector3()) {
    try { return this.soldier.getHeadPosition(out); } catch { return out.copy(this.pos).setY(this.pos.y + 1.65); }
  }

  place(p, yaw = this.yaw) {
    toVec(this.G, p, this.pos, 0, !!this.def.top);
    this.yaw = this.aimYaw = yaw;
    this.path = null;
    this.vel.set(0, 0, 0);
    this.soldier.reset(this.pos, yaw);
  }

  /** Strecke laufen: Punkte [[x,z],…], speed m/s (≈ 1,4 gehen, 3,5 laufen). */
  walk(points, speed = 1.4) {
    this.path = (points || []).map((p) => toVec(this.G, p, new THREE.Vector3()));
    this.speed = speed;
  }

  /** Zum Ziel drehen (Darsteller/Vector3). Hinweis: this.face ist der Gesichts-Treiber (FaceDriver), daher faceTo. */
  faceTo(target) { this.faceTarget = target; }
  look(target) { this.lookTarget = target; }
  setHidden(on) { this.hidden = !!on; this.soldier.root.visible = !on; }

  say(text, expr = null, cps) {
    const track = textToVisemes(text, { cps });
    this.face.say(track, expr);
    return track;
  }

  _targetPos(t, out) {
    if (!t) return null;
    if (t instanceof StageActor) return t.headPosition(out);
    if (t.isVector3) return out.copy(t);
    if (t.position && t.position.isVector3) return out.copy(t.position).setY(t.position.y + 1.6);
    return null;
  }

  update(dt, camPos = null) {
    if (this.hidden) return;
    const G = this.G;
    // Bewegung entlang der Strecke
    this.vel.set(0, 0, 0);
    if (this.path && this.path.length) {
      const goal = this.path[0];
      _v.subVectors(goal, this.pos).setY(0);
      const d = _v.length();
      const step = this.speed * dt;
      if (d <= Math.max(0.05, step)) {
        this.pos.x = goal.x; this.pos.z = goal.z;
        this.path.shift();
        if (!this.path.length) this.path = null;
      } else {
        _v.multiplyScalar(1 / d);
        this.pos.addScaledVector(_v, step);
        this.vel.copy(_v).multiplyScalar(this.speed);
        this.aimYaw = Math.atan2(-_v.x, -_v.z);
      }
      this.pos.y = groundY(G, this.pos.x, this.pos.z, this.pos.y + 1.2);
    } else if (this.faceTarget) {
      const tp = this._targetPos(this.faceTarget, _w);
      if (tp) this.aimYaw = yawTo(this.pos, tp);
    }
    const yaw = this.soldier.animate(dt, {
      velocity: this.vel, aimYaw: this.aimYaw, aimPitch: this.pitch, crouch: this.crouch,
      sprint: this.speed > 3 && this.vel.lengthSq() > 4, position: this.pos, onGround: true, idleLook: !this.lookTarget,
    });
    this.yaw = yaw;
    // Detailstufe: Nahaufnahme → volle Stufe (Gesicht)
    const dist = camPos ? camPos.distanceTo(this.pos) : 10;
    try { this.soldier.updateLod(dist, this.soldier.tier); } catch { /* */ }
    this.rig.setVisible?.(dist < 9);
    const lp = this._targetPos(this.lookTarget, _u);
    this.rig.lookAt(lp);
    // Waffe gesenkt (aimPitch < 0) neigt im Animator den Kopf mit – für Dialoge den Kopf wieder aufrichten
    this.rig.headComp = Math.max(0, -this.pitch) * 0.8;
    this.face.update(dt);
  }

  dispose() {
    try { this.rig.dispose(); } catch { /* */ }
    try { this.soldier.dispose(); } catch { /* */ }
  }
}

/* ======================================================================== Kamera */

export class ShotCamera {
  constructor(G, cast, groundRel = false) {
    this.G = G;
    this.cast = cast;
    this.groundRel = groundRel; // y der Kamerapunkte = Höhe über dem Boden (Gelände mit Hügeln)
    this.shot = null;
    this.t = 0;
    this.dur = 1;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.fov = 45;
    this._curve = null;
    this._lookCurve = null;
  }

  _p(p, out) {
    if (typeof p === 'string') {
      const a = this.cast[p];
      return a ? a.headPosition(out) : out.set(0, 1.6, 0);
    }
    if (this.groundRel && Array.isArray(p) && p.length === 3) return out.set(p[0], floorY(this.G, p[0], p[2]) + p[1], p[2]);
    return toVec(this.G, p, out) || out.set(0, 0, 0);
  }

  start(shot, dur) {
    this.shot = shot || {};
    this.t = 0;
    this.dur = Math.max(0.1, shot && shot.dur ? shot.dur : dur);
    const s = this.shot;
    this._curve = s.path && s.path.length >= 2 ? new THREE.CatmullRomCurve3(s.path.map((p) => this._p(p, new THREE.Vector3())), false, 'centripetal') : null;
    this._lookCurve = Array.isArray(s.lookPath) && s.lookPath.length >= 2 ? new THREE.CatmullRomCurve3(s.lookPath.map((p) => this._p(p, new THREE.Vector3())), false, 'centripetal') : null;
    this.update(0);
  }

  update(dt) {
    const s = this.shot;
    if (!s) return;
    this.t += dt;
    const k = (EASE[s.ease] || EASE.inOut)(clamp(this.t / this.dur, 0, 1));
    const fov0 = s.fov || 45;
    this.fov = s.fovTo ? fov0 + (s.fovTo - fov0) * k : fov0;
    if (s.close) {
      // Nahaufnahme: vor dem Gesicht, leicht seitlich, Blick auf Mund/Augen
      const a = this.cast[s.close];
      if (a) {
        const head = a.headPosition(_v);
        const yaw = a.yaw + (s.side ?? 0.35) + (s.drift ?? 0.08) * k;
        const dist = (s.dist ?? 0.85) - (s.push ?? 0.1) * k;
        this.pos.set(head.x - Math.sin(yaw) * dist, head.y + (s.height ?? 0.0), head.z - Math.cos(yaw) * dist);
        this.look.copy(head).add(_w.set(0, -0.035, 0));
      }
    } else if (s.over) {
      // Über die Schulter: hinter a (rechte Schulter), Blick auf b
      const a = this.cast[s.over[0]], b = this.cast[s.over[1]];
      if (a && b) {
        const ha = a.headPosition(_v), hb = b.headPosition(_w);
        const yaw = yawTo(ha, hb);
        const back = s.dist ?? 1.15, side = s.side ?? 0.42;
        this.pos.set(ha.x + Math.sin(yaw) * back + Math.cos(yaw) * side, ha.y + (s.height ?? 0.12), ha.z + Math.cos(yaw) * back - Math.sin(yaw) * side);
        this.look.copy(hb).add(_u.set(0, -0.08, 0));
      }
    } else if (s.orbit) {
      const c = this._p(s.orbit, _v);
      const ang = (s.from ?? 0) + ((s.to ?? s.from ?? 0) - (s.from ?? 0)) * k;
      const r = s.radius ?? 4;
      this.pos.set(c.x + Math.sin(ang) * r, c.y + (s.height ?? 0.5), c.z + Math.cos(ang) * r);
      this.look.copy(c);
    } else if (this._curve) {
      this._curve.getPoint(k, this.pos);
    } else if (s.from) {
      const a = this._p(s.from, _v);
      const b = s.to ? this._p(s.to, _w) : a;
      this.pos.lerpVectors(a, b, k);
    }
    if (!s.close && !s.over && !s.orbit) {
      if (this._lookCurve) this._lookCurve.getPoint(k, this.look);
      else if (s.look) {
        const a = this._p(s.look, _v);
        if (s.lookTo) { const b = this._p(s.lookTo, _w); this.look.lerpVectors(a, b, k); } else this.look.copy(a);
      }
    }
    if (s.shake) {
      const e = this.t * 23;
      this.pos.x += Math.sin(e) * s.shake * 0.02;
      this.pos.y += Math.sin(e * 1.3 + 1) * s.shake * 0.02;
    }
  }

  apply(cam) {
    cam.position.copy(this.pos);
    cam.up.copy(UP);
    cam.lookAt(this.look);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  }
}

/* ======================================================================== Ablauf */

/**
 * Zwischensequenz abspielen. hooks: { ui (CampaignUI), speakers (id → { name, color }), cps (Lesetempo), actors (Map mit
 * vorhandenen Darstellern, werden nicht entsorgt), onEvent(name) }
 */
export class Cutscene {
  constructor(G, def, hooks = {}) {
    this.G = G;
    this.def = def;
    this.hooks = hooks;
    this.ui = hooks.ui;
    this.cast = {};
    this.own = [];
    this.i = -1;
    this.t = 0;
    this.beatDur = 0;
    this.done = false;
    this.cam = null;
    this.speaker = null;
    this.track = null;
    this._acts = [];
  }

  start() {
    const G = this.G;
    const d = this.def;
    for (const [id, c] of Object.entries(d.cast || {})) {
      const spk = (this.hooks.speakers && this.hooks.speakers[c.role || id]) || {};
      try {
        const a = new StageActor(G, { id, ...spk, ...c });
        this.cast[id] = a;
        this.own.push(a);
      } catch (err) { console.error('[Kampagne] Darsteller', id, err); }
    }
    this.cam = new ShotCamera(G, this.cast, !!d.groundRel);
    this._fov0 = G.camera ? G.camera.fov : 60;
    if (this.ui) {
      this.ui.setMode('cine');
      if (d.location) this.ui.location(d.location[0], d.location[1], true);
    }
    this._next();
  }

  _speaker(id) {
    const s = (this.hooks.speakers && this.hooks.speakers[id]) || {};
    const a = this.cast[id];
    return { name: s.name || (a && a.name) || id, color: s.color || (a && a.color) || '#ffc23d', actor: a || null, radio: !a || !!s.radioOnly };
  }

  _next() {
    const beats = this.def.beats || [];
    this.i += 1;
    if (this.i >= beats.length) { this.finish(); return; }
    const b = beats[this.i];
    this.t = 0;
    this.speaker = null;
    this.track = null;
    const ui = this.ui;
    // Handlungen zu Beginn bzw. nach b.at Sekunden
    this._acts = (b.act || []).map((a) => ({ ...a, _done: false }));
    this._runActs(0);
    // Dialog
    let sayDur = 0;
    if (b.say) {
      const sp = this._speaker(b.say.who);
      this.speaker = sp;
      const cps = this.hooks.cps;
      const sayText = tx(b.say.text); // Untertitel und Lippen in der gewählten Sprache
      if (sp.actor) {
        this.track = sp.actor.say(sayText, b.say.expr, cps);
        // Zuhörer schauen den Sprecher an (außer ausdrücklich anders)
        for (const a of Object.values(this.cast)) if (a !== sp.actor && !b.keepLooks) a.look(sp.actor);
        // Sprecher: zum angegebenen Gegenüber bzw. geradeaus (Nahaufnahmen zeigen das Gesicht)
        if (!b.keepLooks) sp.actor.look(b.say.look ? this.cast[b.say.look] || null : null);
      } else {
        this.track = textToVisemes(sayText, { cps });
      }
      sayDur = subtitleDuration(this.track, b.say.linger ?? 0.85);
      if (ui) ui.subtitle({ name: sp.radio && !((this.hooks.speakers || {})[b.say.who] || {}).radioOnly ? `${sp.name} · Funk` : sp.name, color: sp.color }, sayText, { track: this.track, radio: false });
    } else if (ui) ui.subtitle(null, '');
    this.beatDur = Math.max(b.dur || 0, sayDur, b.say ? 0 : (b.cam && b.cam.dur) || 2.5);
    if (b.cam) this.cam.start(b.cam, this.beatDur);
    if (ui) {
      if (b.fadeIn != null) { ui.fade(1, 0); requestAnimationFrame(() => ui.fade(0, b.fadeIn)); }
      if (b.loc === false) ui.location('', '', false);
      if (b.card) ui.card(b.card[0], b.card[1], b.card[2] || '', true); else ui.card('', '', '', false);
    }
    if (b.event && this.hooks.onEvent) this.hooks.onEvent(b.event, b);
  }

  _runActs(t) {
    for (const a of this._acts) {
      if (a._done || (a.at || 0) > t) continue;
      a._done = true;
      const who = a.who ? this.cast[a.who] : null;
      try {
        if (a.fx && this.hooks.onEvent) this.hooks.onEvent(a.fx, a);
        if (!who) continue;
        if (a.place) who.place(a.place, a.place[2] ?? who.yaw);
        if (a.walk) who.walk(a.walk, a.speed || 1.4);
        if (a.face !== undefined) who.faceTo(typeof a.face === 'string' ? this.cast[a.face] || null : a.face ? toVec(this.G, a.face) : null);
        if (a.look !== undefined) who.look(typeof a.look === 'string' ? this.cast[a.look] || null : a.look ? toVec(this.G, a.look, new THREE.Vector3(), 1.5) : null);
        if (a.crouch !== undefined) who.crouch = !!a.crouch;
        if (a.aim !== undefined) who.pitch = a.aim;
        if (a.hide !== undefined) who.setHidden(a.hide);
      } catch (err) { console.error('[Kampagne] Handlung', a, err); }
    }
  }

  update(dt) {
    if (this.done) return true;
    this.t += dt;
    this._runActs(this.t);
    const G = this.G;
    this.cam.update(dt);
    if (G.camera) this.cam.apply(G.camera);
    const camPos = G.camera ? G.camera.position : null;
    for (const a of Object.values(this.cast)) a.update(dt, camPos);
    if (this.ui && this.track) this.ui.subtitleProgress(this.t > this.track.duration ? -2 : wordAt(this.track, this.t));
    const b = (this.def.beats || [])[this.i];
    if (b && b.fadeOut && this.ui && !this._fading && this.t >= this.beatDur - b.fadeOut) { this._fading = true; this.ui.fade(1, b.fadeOut); }
    if (this.t >= this.beatDur) { this._fading = false; this._next(); }
    return this.done;
  }

  skip() {
    if (this.done) return;
    this.finish(true);
  }

  finish(skipped = false) {
    if (this.done) return;
    this.done = true;
    this.skipped = skipped;
    const G = this.G;
    for (const a of this.own) a.dispose();
    this.own = [];
    this.cast = {};
    if (G.camera && Number.isFinite(this._fov0)) { G.camera.fov = this._fov0; G.camera.updateProjectionMatrix(); }
    if (this.ui) {
      this.ui.subtitle(null, '');
      this.ui.location('', '', false);
      this.ui.card('', '', '', false);
    }
  }
}
