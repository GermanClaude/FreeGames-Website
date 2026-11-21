// NULLPUNKT — Panzersimulation: KI-Besatzung des Spielerpanzers und KI der Feindpanzer.
//
// Eigene Besatzung (Bots in den Sitzen, Team A) – jede nicht gespielte Rolle arbeitet selbst:
//   Fahrer         Befehle: vor (3 Stufen) / halt / links / rechts / zurück / zur Markierung / Deckung / Front zum Ziel;
//                  frei sich Festfahren (zurücksetzen, neu anfahren); ohne Befehl unter Beschuss: Front zum Gegner
//   Richtschütze   Ziele aus der gemeinsamen Zielliste (Erkennen nach Entfernung/Tarnung/Bewegung, skill.js), richtet mit
//                  Vorhalt und Entfernung, Fehler schrumpft nach jedem Schuss (Korrektur), schießt auf „Feuer!“ oder bei
//                  „Feuer frei“ (Standard: an – Selbstverteidigung), Koax-MG gegen Infanterie, nur mit freier Schusslinie
//                  ab der Mündung; nimmt das gefährlichste Ziel zuerst (zielt es auf uns: Vorrang)
//   Ladeschütze    lädt die befohlene Art (Automatik von crew.js mit echter Ladezeit), meldet „… geladen!“
//   Kommandant     (wenn der Spieler nicht Kommandant ist) Zielansprache „Richtschütze – Panzer – halbrechts – 800 –
//                  Wucht!“, Munitionsbefehle an den Lader, Feuerbefehl sobald gerichtet und geladen, Fahrbefehle
//                  (Marsch auf das nächste Ziel, Halt zum Schuss, Deckung nach schwerem Treffer), Kommandantenübersteuerung
//                  des Turms für den Spieler-Richtschützen
//   Bug-/Zusatz-MG nahe Infanterie in Feuerstößen
// Feindpanzer (EnemyTank): ein Bot fährt und richtet (Stellvertreter-Richtschütze, vehicle._proxyGunner), virtuelle
//   Restbesatzung (ammo.js crewOf) – fällt der Fahrer/Richtschütze virtuell aus, steht bzw. schweigt der Panzer. Können nach
//   Stufe (skill.js: Erkennungszeit, Richtzeit, Fehler des ersten Schusses, Korrektur, Ladezeit).
import * as THREE from 'three';
import { VEHICLE_WEAPONS } from '../data.js?v=20261121041936';
import { gunSeat, loaderSeat } from '../crew.js?v=20261121041936';
import { KINDS, kindOf, idFor, modsOf, crewOf, eraOf } from './ammo.js?v=20261121041936';
import { OWN, FRIEND, skillAt, foeLevel, detectTime, sigmaFor, SETTLE, DISP, randn } from './skill.js?v=20261121041936';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _o = new THREE.Vector3(), _m = new THREE.Vector3();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const UP = new THREE.Vector3(0, 1, 0);

export const TARGET_LABEL = { panzer: 'Panzer', pak: 'Pak', bunker: 'Bunker', infanterie: 'Infanterie', panzerabwehr: 'Panzerabwehrtrupp', fahrzeug: 'Fahrzeug', funk: 'Funkstelle', lager: 'Nachschublager', bruecke: 'Brücke' };
const PRIO = { panzer: 6, pak: 5, panzerabwehr: 4, bunker: 3, fahrzeug: 2.5, infanterie: 2, funk: 1.5, lager: 1.2, bruecke: 1 };

/** Richtung relativ zur Wanne als Wort. yaw positiv = links. */
export function bearingWord(rel) {
  const d = Math.abs(rel) * 180 / Math.PI, s = rel > 0 ? 'links' : 'rechts';
  if (d < 12) return 'voraus';
  if (d < 55) return `halb${s}`;
  if (d < 120) return s;
  if (d < 165) return `${s} hinten`;
  return 'hinten';
}
export const roundRange = (d) => (d < 300 ? Math.round(d / 25) * 25 : d < 1000 ? Math.round(d / 50) * 50 : Math.round(d / 100) * 100);

/** Zielpunkt eines Eintrags (Welt, aktuell): Fahrzeug Wannenmitte (bzw. Turm, wenn nur er sichtbar ist), Mensch Brust. */
export function targetPoint(t, out) {
  const e = t.ent;
  if (e.isVehicle) {
    out.copy(e.body.pos);
    if (e.isEmplacement) out.y += e.kind === 'bunker' ? 0.2 : -0.1;
    else if (t.hullDown) out.y += topOffset(e) - 0.15;
    else out.y += 0.25;
    return out;
  }
  out.copy(e.position); out.y += e.crouching || e.prone ? 0.7 : 1.15; return out;
}
/** Höhe (über Wannenmitte) der Turmmitte bzw. Wannenoberkante + 0,4 m. */
const topOffset = (v) => (v.def.hullBox ? v.def.hullBox[1] + v.def.hullBox[4] - (v.def.com ? v.def.com[1] : 0) + 0.45 : 1.6);
const entVel = (e, out) => (e.isVehicle ? out.copy(e.body.vel) : e.body && e.body.velocity ? out.copy(e.body.velocity) : out.set(0, 0, 0));
const entSpeed = (e) => (e.isVehicle ? Math.abs(e.body.speed || 0) : e.body && e.body.velocity ? Math.hypot(e.body.velocity.x, e.body.velocity.z) : 0);

function classify(e) {
  if (e.isVehicle) return e.isEmplacement ? e.kind : e.def.armored ? 'panzer' : 'fahrzeug';
  return typeof e._launcherSlot === 'function' && e._launcherSlot() >= 0 ? 'panzerabwehr' : 'infanterie';
}

/** Zielt dieses Fahrzeug/diese Stellung gerade auf v? */
function threatens(ent, v) {
  if (!ent || !v) return false;
  if (ent.isEmplacement) return ent.target === v;
  const ai = ent._psimAI;
  return !!(ai && ai.target && ai.target.ent === v);
}

/** Sichtanteil eines Ziels vom Auge: 1 ganz, 0.5 nur Turm/Kopf (Rumpf in Deckung), 0 verdeckt. */
function visibility(W, eye, e) {
  if (!W || !W.lineOfSight) return 1;
  if (e.isVehicle) {
    _e.copy(e.body.pos); _e.y += 0.4;
    if (W.lineOfSight(eye, _e)) return 1;
    if (e.isEmplacement) return 0;
    _e.copy(e.body.pos); _e.y += topOffset(e);
    return W.lineOfSight(eye, _e) ? 0.5 : 0;
  }
  _e.copy(e.position); _e.y += 1.15;
  if (W.lineOfSight(eye, _e)) return 1;
  _e.copy(e.position); _e.y += 1.55;
  return W.lineOfSight(eye, _e) ? 0.5 : 0;
}

/**
 * Sichtbare/erinnerte Gegner aus Sicht eines Auges (gedrosselt). known: Map ent → { t (Erkennungsfortschritt 0..1),
 * seen (letzte Sicht, s), pos (letzte Lage), vis }. Erkennen dauert nach skill.js detectTime; ein erkannter Gegner bleibt
 * 4 s nach Sichtverlust in der Liste (an der letzten Lage, vis = false). o: { maxLos, vehicle (eigenes Fahrzeug, für
 * Bedrohung), skill, moving (Beobachter fährt) }. → [{ ent, kind, dist, pos, vis, hullDown, score }], gefährlichstes zuerst
 */
export function scanTargets(G, eye, range, team, known, dt, { maxLos = 28, vehicle = null, skill = OWN, moving = false } = {}) {
  const out = [], W = G.world, now = G.time.elapsed, smoke = G.weapons && typeof G.weapons.smokeVisibility === 'function' ? G.weapons : null;
  let los = 0;
  const push = (e, kind, d, k, vis) => {
    let s = (PRIO[kind] || 1) / Math.max(80, d);
    if (vehicle && threatens(e, vehicle)) s *= 1.8;
    if (kind === 'panzerabwehr' && d < 300) s *= 1.5;
    out.push({ ent: e, kind, dist: d, pos: k.pos.clone(), vis, hullDown: k.vis < 1, score: s });
  };
  const consider = (e, kind, p) => {
    const d = p.distanceTo(eye);
    if (d > range) { known.delete(e); return; }
    let k = known.get(e);
    if (los >= maxLos) { if (k && k.t >= 1 && now - k.seen < 4) push(e, kind, d, k, false); return; }
    los++;
    let vis = visibility(W, eye, e);
    let sm = 1;
    if (vis > 0 && smoke) { try { sm = smoke.smokeVisibility(eye, _e.copy(p)); } catch { sm = 1; } if (sm < 0.15) vis = 0; }
    if (!vis) {
      if (k) { if (k.t < 1) { k.t = Math.max(0, k.t - dt * 0.3); if (k.t <= 0) known.delete(e); } else if (now - k.seen < 4) push(e, kind, d, k, false); else if (now - k.seen > 20) known.delete(e); }
      return;
    }
    if (!k) { k = { t: 0, first: now, seen: now, pos: p.clone(), vis }; known.set(e, k); }
    k.seen = now; k.pos.copy(p); k.vis = vis;
    if (k.t < 1) {
      const T = detectTime(skill, { dist: d, vis, infantry: !e.isVehicle, moving: entSpeed(e) > 2, fired: e._psimFiredAt != null ? now - e._psimFiredAt : null, smoke: sm, observerMoving: moving });
      k.t = Math.min(1, k.t + dt / Math.max(0.2, T));
    }
    if (k.t >= 1) push(e, kind, d, k, true);
  };
  const V = G.vehicles;
  for (const v of (V && V.list) || []) {
    if (!v.alive || v === vehicle || v.def.civil) continue;
    const t = v.team;
    if (t == null || t === team) continue;
    if (!v.isEmplacement && !v.isOccupied) continue;
    if (v.isEmplacement && !v.crew && (v.kind === 'pak' || v.kind === 'bunker')) { /* unbesetzt: weiter Ziel */ }
    _a.copy(v.body.pos); _a.y += 0.5;
    consider(v, classify(v), _a);
  }
  for (const a of G.actors) {
    if (!a.alive || a.vehicle || a.team == null || a.team === team) continue;
    _a.copy(a.position); _a.y += 1.2;
    consider(a, classify(a), _a);
  }
  out.sort((x, y) => y.score - x.score);
  return out;
}

/** Wirkung einer Munitionsart gegen ein Ziel: 2 gut, 1 schwach, 0 wirkungslos. */
export function ammoEffect(kind, tkind, dist = 0) {
  const role = KINDS[kind] ? KINDS[kind].role : 'ke';
  if (tkind === 'panzer') return role === 'ke' || role === 'ce' ? 2 : role === 'he' ? 1 : 0;
  if (tkind === 'pak') return role === 'can' ? (dist < 450 ? 2 : 0) : 2;
  if (tkind === 'infanterie' || tkind === 'panzerabwehr') return role === 'he' || role === 'ce' ? 2 : role === 'can' ? (dist < 450 ? 2 : 0) : 1;
  return role === 'he' || role === 'ce' ? 2 : role === 'ke' ? 1 : 0;
}

/** Passende Munitionsart für ein Ziel (Art-Kennung der Generation). */
export function ammoForTarget(v, t) {
  const has = (k) => !!idFor(v, k) && v.gun && v.gun.rack[idFor(v, k)] > 0;
  const pick = (...ks) => ks.find(has) || ks.find((k) => !!idFor(v, k)) || null;
  const kind = t ? t.kind : 'panzer';
  if (kind === 'panzer') return pick('wucht', 'tsg', 'pzgr', 'lfk', 'mz', 'hl');
  if (kind === 'pak' || kind === 'bunker' || kind === 'fahrzeug' || kind === 'funk' || kind === 'lager' || kind === 'bruecke') return pick('spreng', 'qk', 'mz', 'hl', 'pzgr');
  if (t && t.dist < (idFor(v, 'kan') ? 380 : 200)) return pick('kan', 'kart', 'spreng', 'qk', 'mz');
  return pick('spreng', 'qk', 'mz', 'pzgr');
}

/**
 * Schütze: Haltepunkt mit Fehlermodell (skill.js). st = { bias: Vector2 (rad), lead (Faktor), shots } je Ziel.
 * Ziel (Welt, ohne Fehler) in P; Ergebnis (mit Vorhalt + Fehler) in out.
 */
function newBias(st, era, skill, speed) {
  const s = sigmaFor(era, skill, speed);
  st.bias.set(randn() * s, randn() * s * (era === 'modern' ? 1.1 : 1.35));
  st.lead = randn() * skill.lead;
  st.shots = 0;
  st.sig = s; st.era = era;
  freshErr(st, skill, speed);
}
/** Frischer Fehler je Schuss: Waffenstreuung + Richtfehler (fresh × Grundfehler, eigene Fahrt eingerechnet). */
function freshErr(st, skill, speed) {
  const f = Math.hypot(DISP, (skill.fresh || 0.5) * sigmaFor(st.era || 'modern', skill, speed));
  st.disp.set(randn() * f, randn() * f);
}
function aimWithError(st, from, P, ent, speed, out) {
  const dist = Math.max(5, P.distanceTo(from));
  // Vorhalt (geschätzte Zielgeschwindigkeit, Fehler st.lead)
  entVel(ent, _m);
  out.copy(P).addScaledVector(_m, (dist / Math.max(100, speed)) * (1 + st.lead));
  // Seiten-/Höhenfehler (Entfernungsfehler wirkt als Höhenfehler)
  _d.copy(out).sub(from).setY(0);
  if (_d.lengthSq() < 1e-6) return out;
  _d.normalize();
  _e.set(-_d.z, 0, _d.x);
  out.addScaledVector(_e, (st.bias.x + st.disp.x) * dist).addScaledVector(UP, (st.bias.y + st.disp.y) * dist);
  return out;
}
function afterShot(st, skill, speed = 0) {
  st.shots++;
  st.bias.multiplyScalar(skill.corr);
  st.lead *= skill.corr;
  freshErr(st, skill, speed);
}
const aimState = () => ({ bias: new THREE.Vector2(), disp: new THREE.Vector2(randn() * DISP, randn() * DISP), lead: 0, shots: 0 });

/* ====================================================================== eigene Besatzung */

export class TankCrew {
  constructor(mode, v) {
    this.mode = mode;
    this.G = mode.G;
    this.v = v;
    const S = v.seats;
    const find = (fn) => { const s = S.find(fn); return s ? s.index : -1; };
    const gs = gunSeat(v), ls = loaderSeat(v);
    this.idx = {
      driver: find((s) => s.def.drive),
      gunner: gs ? gs.index : -1,
      loader: ls ? ls.index : -1,
      commander: find((s) => s.def.id === 'commander'),
    };
    this.extra = S.filter((s) => (s.def.mount === 'cmg' || s.def.mount === 'mg') && s.index !== this.idx.gunner).map((s) => s.index);
    this.skill = OWN;
    this.era = eraOf(v.def);
    this.known = new Map();
    this.targets = [];
    this.scanT = 0;
    // Fahrer
    this.drive = { cmd: 'halt', speed: 1, turn: 0, turnT: 0, goal: null, since: 0, blockedT: 0, said: '', unstuck: 0, unstuckSteer: 0, autoT: -1e9 };
    // Richtschütze (Feuer frei als Standard: die Besatzung verteidigt sich selbst; Kommandant kann „Feuer einstellen“)
    this.gun = { target: null, aimT: 0, fireOrder: 0, fireFree: true, lastShot: -1e9, designate: null, coax: 0, reported: new WeakSet(), aim: aimState(), ready: false };
    // Lader / Kommandant
    this.ammoOrder = null; this.ammoBy = null; this.ammoT = -1e9;
    this.cmd = { target: null, phase: 'suche', sinceFire: 0, calledFor: null, overrideT: 0, overYaw: 0, overPitch: 0, objective: null, lastDrive: '', driveSaidT: -1e9, hurtT: -1e9, fireSaidT: -1e9, sinceCall: 0, lostT: 0 };
    this.mg = new Map();
    this.stats = { shots: 0, mg: 0 };
    v._reloadMul = this.skill.reload; // Ladeschütze lädt zügig
  }

  seatActor(role) { const i = this.idx[role]; return i >= 0 ? this.v.seats[i].actor : null; }
  isPlayer(role) { const a = this.seatActor(role); return !!(a && a.isPlayer); }
  isBot(role) { const a = this.seatActor(role); return !!(a && !a.isPlayer && a.alive); }
  say(from, text, o) { this.mode.radio && this.mode.radio.say(from, text, o); }
  eye(out) { return this.v.body.toWorld(out.set(0, (this.v.def.hullBox[1] + this.v.def.hullBox[4]) + 0.9, 0), out); }
  /** KI-Kommandant aktiv (Platz mit Bot besetzt bzw. ohne Kommandantenplatz)? */
  aiCommander() { return this.idx.commander < 0 ? !this.isPlayer('gunner') : this.isBot('commander'); }

  /* ---------------------------------------------------------- Befehle (Spieler-Kommandant oder KI-Kommandant) */

  order(cmd, arg = null, { quiet = false, from = 'Kommandant' } = {}) {
    const D = this.drive, now = this.G.time.elapsed;
    const V = this.v;
    const driverBot = this.isBot('driver');
    const txt = {
      vor: D.cmd === 'vor' && cmd === 'vor' ? 'Fahrer – schneller!' : 'Fahrer – marsch!',
      halt: 'Fahrer – halt!', links: 'Fahrer – links!', rechts: 'Fahrer – rechts!', gerade: 'Fahrer – geradeaus!',
      zurueck: 'Fahrer – zurück – marsch!', markierung: 'Fahrer – auf Markierung – marsch!', deckung: 'Fahrer – Deckung – zurück!', rumpf: 'Fahrer – Front zum Ziel!',
      langsam: 'Fahrer – langsamer!',
    }[cmd];
    if (!quiet && txt) this.say(from, txt, { key: 'drive' });
    if (cmd === 'vor') { D.speed = D.cmd === 'vor' ? Math.min(3, D.speed + 1) : 1; D.cmd = 'vor'; D.turn = 0; }
    else if (cmd === 'langsam') { D.speed = Math.max(1, D.speed - 1); if (D.cmd !== 'vor') D.cmd = 'vor'; }
    else if (cmd === 'links' || cmd === 'rechts') { D.turn = cmd === 'links' ? -1 : 1; D.turnT = arg && arg.hold ? 1e9 : 1.6; if (D.cmd === 'halt') D.pivot = true; else D.pivot = false; }
    else if (cmd === 'gerade') { D.turn = 0; D.turnT = 0; }
    else if (cmd === 'markierung' || cmd === 'deckung') { D.cmd = cmd; D.goal = arg ? arg.clone() : cmd === 'deckung' ? this._coverPoint() : null; if (!D.goal) D.cmd = 'halt'; D.routed = false; }
    else if (cmd === 'rumpf') { D.cmd = 'rumpf'; D.goalYaw = arg != null ? arg : V.body.yaw() + V.mount.turretYaw; }
    else D.cmd = cmd;
    D.since = now;
    D.blockedT = 0; D.unstuck = 0;
    if (driverBot && !quiet) setTimeout(() => { if (this.isBot('driver')) this.say('Fahrer', { vor: 'Fahre!', halt: 'Halte!', zurueck: 'Fahre zurück!', markierung: 'Fahre Markierung an!', deckung: 'Gehe in Deckung!', rumpf: 'Drehe!', links: 'Links!', rechts: 'Rechts!' }[cmd] || 'Verstanden!', { key: 'drv-ack', quiet: true }); }, 500);
  }

  /** Munitionsbefehl an den Ladeschützen. kind = Art (wucht, mz, …) */
  orderAmmo(kind, { quiet = false, from = 'Kommandant', by = 'player' } = {}) {
    const id = idFor(this.v, kind);
    if (!id) return false;
    const same = this.ammoOrder === id;
    this.ammoOrder = id; this.ammoBy = by; this.ammoT = this.G.time.elapsed;
    const gs = this.v.seats[this.idx.gunner];
    if (gs) { gs._shellWish = id; const w = gs.weapons[gs.weaponIndex]; if (w && w.def.kind === 'shell') { const wi = gs.weapons.findIndex((x) => x.def.id === id); if (wi >= 0) gs.intent.weapon = wi; } }
    if (this.v.gun && !this.v.gun.held && this.v.gun.step !== 'geladen') this.v.gun.select = id;
    if (!quiet && !same) this.say(from, `${KINDS[kind].call} laden!`, { key: 'ammo' });
    return true;
  }

  /** Übergabe: Richtschütze übernimmt die Blickrichtung des Kommandanten (dir Welt) und sucht dort ein Ziel. */
  designate(dir, { from = 'Kommandant' } = {}) {
    const eye = this.eye(_c);
    let best = null, ba = 0.06;
    const cand = this.targets.length ? this.targets : [];
    for (const t of cand) {
      targetPoint(t, _a).sub(eye).normalize();
      const ang = Math.acos(clamp(_a.dot(dir), -1, 1));
      if (ang < ba) { ba = ang; best = t; }
    }
    // auch noch nicht erkannte Gegner entlang der Richtung (Kommandant zeigt sie)
    if (!best) {
      for (const v of this.G.vehicles.list) {
        if (!v.alive || v === this.v || v.team === 'A' || v.team == null || (!v.isOccupied && !v.isEmplacement)) continue;
        _a.copy(v.body.pos).sub(eye); const d = _a.length(); _a.normalize();
        const ang = Math.acos(clamp(_a.dot(dir), -1, 1));
        if (ang < ba && d < 3000) { ba = ang; best = { ent: v, kind: classify(v), dist: d, pos: v.body.pos.clone(), vis: true, score: 1 }; }
      }
    }
    const G = this.gun;
    G.designate = { dir: dir.clone(), t: this.G.time.elapsed };
    if (best) {
      const now = this.G.time.elapsed;
      this.known.set(best.ent, { t: 1, first: now, seen: now, pos: best.pos.clone(), vis: 1 });
      this._setGunTarget(best, true);
      const rel = wrap(Math.atan2(-(best.pos.x - eye.x), -(best.pos.z - eye.z)) - this.v.body.yaw());
      this.say(from, `Richtschütze – ${TARGET_LABEL[best.kind]} – ${bearingWord(rel)} – ${roundRange(best.dist)}!`, { key: 'ziel' });
      if (this.isBot('gunner')) setTimeout(() => this.say('Richtschütze', 'Erkannt!', { quiet: true }), 900);
      const k = ammoForTarget(this.v, best);
      if (k && this.idx.loader >= 0 && !this.isPlayer('gunner')) this.orderAmmo(k, { from });
    } else {
      G.target = null;
      this.say(from, 'Richtschütze – übernehmen!', { key: 'ziel' });
      if (this.isBot('gunner')) setTimeout(() => this.say('Richtschütze', 'Kein Ziel!', { quiet: true }), 900);
    }
    return best;
  }

  fire({ from = 'Kommandant', quiet = false } = {}) {
    if (!quiet) this.say(from, 'Feuer!', { key: 'feuer' });
    this.gun.fireOrder = this.G.time.elapsed + 6;
  }

  toggleFireFree({ from = 'Kommandant' } = {}) {
    this.gun.fireFree = !this.gun.fireFree;
    this.say(from, this.gun.fireFree ? 'Feuer frei!' : 'Feuer einstellen!', { key: 'feuerfrei' });
  }

  _setGunTarget(t, designated = false) {
    const Gs = this.gun;
    if (Gs.target && t && Gs.target.ent === t.ent) { Gs.target = t; return; }
    Gs.target = t; Gs.aimT = 0; Gs.ready = false; Gs.designated = designated;
    if (t) newBias(Gs.aim, this.era, this.skill, this.v.body.speed);
  }

  /** Treffer am eigenen Panzer (modes/panzer.js): Fahrer ohne Befehl dreht die Front zum Schützen. */
  onHit(e) {
    const v = this.v, now = this.G.time.elapsed, D = this.drive;
    const src = e && e.attacker && e.attacker.vehicle ? e.attacker.vehicle : null;
    const from = src ? src.body.pos : (this.targets.find((t) => t.kind === 'panzer' || t.kind === 'pak') || {}).pos;
    if (src && !this.known.has(src)) this.known.set(src, { t: 1, first: now, seen: now, pos: src.body.pos.clone(), vis: 1 });
    if (!from || !this.isBot('driver') || this.arcade) return;
    if (D.cmd !== 'halt' || now - D.autoT < 8) return;
    const yaw = Math.atan2(-(from.x - v.position.x), -(from.z - v.position.z));
    if (Math.abs(wrap(yaw - v.body.yaw())) < 0.5) return;
    D.autoT = now;
    this.order('rumpf', yaw, { quiet: true });
    this.say('Fahrer', 'Drehe Front zum Feind!', { key: 'drv-auto' });
  }

  /* ---------------------------------------------------------- Takt */

  update(dt) {
    const v = this.v;
    if (!v.alive) return;
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.45;
      const range = this.era === 'modern' ? 3000 : 1600;
      this.targets = scanTargets(this.G, this.eye(_c), range, v.team || 'A', this.known, 0.45, { vehicle: v, skill: this.skill, moving: Math.abs(v.body.speed) > 4 });
    }
    if (this.isBot('driver')) this._driver(dt);
    if (this.isBot('gunner')) this._gunner(dt);
    if (!this.isPlayer('commander')) this._commander(dt);
    for (const i of this.extra) this._mgSeat(i, dt);
  }

  /* ---------------------------------------------------------- Fahrer (Bot) */

  _driver(dt) {
    const v = this.v, D = this.drive, bot = this.seatActor('driver');
    const it = v.intentFor(bot);
    if (!it) return;
    const mode = this.mode, now = this.G.time.elapsed;
    // Motor: Bot-Fahrer lässt an, sobald es befohlen ist (Simulation: Motor aus beim Start)
    if (mode.engineOff()) {
      if ((mode.state.engineWanted || D.cmd !== 'halt') && !mode.state.cranking) mode.crankEngine('Fahrer');
      it.throttle = 0; it.steer = 0; it.brake = 1; it.path = it.moveTo = null;
      return;
    }
    mode.state.parkBrake = false;
    it.gearbox = 'auto'; it.handbrake = false;
    if (D.turnT > 0) { D.turnT -= dt; if (D.turnT <= 0) D.turn = 0; }
    const sp = v.body.speed;
    // Freifahren: zurücksetzen mit Lenkeinschlag, danach neu anfahren
    if (D.unstuck > 0) {
      D.unstuck -= dt;
      it.path = it.moveTo = null;
      const back = D.cmd !== 'zurueck';
      it.throttle = back ? -0.6 : 0.6; it.brake = 0; it.steer = D.unstuckSteer;
      if (D.unstuck <= 0) { D.routed = false; D.blockedT = 0; D.since = now; }
      return;
    }
    const lvl = [0, 0.42, 0.7, 1][D.speed] || 0.42;
    switch (D.cmd) {
      case 'vor':
        it.path = it.moveTo = null;
        it.throttle = lvl; it.brake = 0; it.steer = D.turn * 0.75 + this._avoid(1) * (D.turn ? 0.3 : 0.8);
        break;
      case 'zurueck':
        it.path = it.moveTo = null;
        it.throttle = -0.55; it.brake = 0; it.steer = -D.turn * 0.6;
        break;
      case 'markierung':
      case 'deckung':
        if (D.goal && !D.routed) { v.driveTo(bot, D.goal, { arriveRadius: 5, maxSpeed: D.cmd === 'deckung' ? 6 : 4 + D.speed * 2.5, reverseAllowed: true }); D.routed = true; }
        if (it.arrived || (D.goal && v.position.distanceTo(D.goal) < 6)) {
          v.stop(bot);
          this.say('Fahrer', D.cmd === 'deckung' ? 'In Deckung!' : 'Markierung erreicht!', { key: 'drv-arr' });
          D.cmd = 'halt';
        } else if (D.routed && !it.path && !it.moveTo) {
          // Wegsuche ohne Ergebnis: direkt anfahren
          it.moveTo = D.goal.clone();
        }
        break;
      case 'rumpf': {
        it.path = it.moveTo = null;
        const want = D.goalYaw ?? v.body.yaw();
        const e = wrap(want - v.body.yaw());
        it.throttle = 0; it.brake = 0;
        it.steer = clamp(-e * 2.2, -1, 1);
        if (Math.abs(e) < 0.05 || now - D.since > 12) { it.steer = 0; D.cmd = 'halt'; this.say('Fahrer', 'Front steht!', { key: 'drv-arr' }); }
        break;
      }
      case 'halt':
      default:
        it.path = it.moveTo = null;
        it.throttle = 0;
        it.brake = D.turn && D.pivot ? 0 : 1;
        it.steer = D.turn && D.pivot ? D.turn * 0.8 : 0;
    }
    // Festgefahren: melden, zurücksetzen, neu anfahren
    const moving = D.cmd === 'vor' || D.cmd === 'zurueck' || D.cmd === 'markierung' || D.cmd === 'deckung';
    if (moving && Math.abs(sp) < 0.4 && now - D.since > 3) {
      D.blockedT += dt;
      if (D.blockedT > 2.5) {
        D.blockedT = 0; D.stuckN = (D.stuckN || 0) + 1;
        if (D.stuckN % 3 === 1) this.say('Fahrer', 'Hänge fest – setze zurück!', { key: 'drv-blk' });
        D.unstuck = 2.2; D.unstuckSteer = (this._avoid(1) || (Math.random() < 0.5 ? -1 : 1)) * 0.9;
      }
    } else if (D.blockedT > 0 && Math.abs(sp) > 1) { D.blockedT = 0; D.stuckN = 0; }
  }

  /** Hindernis voraus (Welt-Strahl in 2 Höhen): Lenkrichtung weg vom Hindernis (−1 links … 1 rechts), 0 = frei. */
  _avoid(dirSign = 1) {
    const v = this.v, W = this.G.world;
    if (!W || !W.raycast || (this._avT = (this._avT || 0) - 1) > 0) return this._avS || 0;
    this._avT = 6;
    const y = v.body.yaw(), hb = v.def.hullBox;
    const look = 9 + Math.abs(v.body.speed) * 1.2;
    let best = 0;
    const probe = (ang) => {
      _d.set(-Math.sin(y + ang) * dirSign, 0, -Math.cos(y + ang) * dirSign);
      _o.copy(v.body.pos); _o.y += 0.9; _o.addScaledVector(_d, hb[5] * 0.9);
      const h = W.raycast(_o, _d, look);
      return h ? h.distance : look;
    };
    const c = probe(0);
    if (c >= look - 0.5) { this._avS = 0; return 0; }
    const l = probe(0.45), r = probe(-0.45);
    best = l > r ? -1 : 1; // Gier positiv = links → Lenkung −1 (A) nach links
    this._avS = best;
    return best;
  }

  /** Deckungspunkt: 15–35 m weg vom Bedrohungsrichtungs-Mittel, Sicht vom Gegner blockiert. */
  _coverPoint() {
    const v = this.v, G = this.G, W = G.world;
    const thr = this.targets.find((t) => t.kind === 'panzer' || t.kind === 'pak') || this.targets[0];
    const from = thr ? thr.pos : _a.copy(v.position).addScaledVector(_b.set(-Math.sin(v.body.yaw()), 0, -Math.cos(v.body.yaw())), 200);
    const away = _b.copy(v.position).sub(from).setY(0).normalize();
    let best = null;
    for (let i = 0; i < 14; i++) {
      const ang = (i % 7 - 3) * 0.4, dist = 15 + Math.floor(i / 7) * 18;
      const c = Math.cos(ang), s = Math.sin(ang);
      const dir = _c.set(away.x * c - away.z * s, 0, away.x * s + away.z * c);
      const p = v.position.clone().addScaledVector(dir, dist);
      const h = W && W.groundHeight ? W.groundHeight(p.x, p.z, p.y + 20) : null;
      if (h != null) p.y = h;
      if (W && W.lineOfSight && thr && !W.lineOfSight(_d.copy(from).setY(from.y + 1), p.clone().setY(p.y + 1.6))) { best = p; break; }
      if (!best && i === 6) best = p;
    }
    return best || v.position.clone().addScaledVector(away, 20);
  }

  /* ---------------------------------------------------------- Richtschütze (Bot) */

  _gunner(dt) {
    const v = this.v, Gs = this.gun, bot = this.seatActor('gunner'), G = this.G;
    const seat = v.seats[this.idx.gunner];
    const it = seat.intent;
    it.fire = false;
    const now = G.time.elapsed;
    const mods = modsOf(v);
    const aiCmd = this.aiCommander();
    // Ziel wählen: übergebenes/angesprochenes; mit KI-Kommandant dessen Ziel; sonst bei „Feuer frei“ das gefährlichste
    let t = Gs.target;
    if (t && (!t.ent.alive || (t.ent.isVehicle && t.ent.wreck))) { t = null; this._setGunTarget(null); }
    const fresh = t ? this.targets.find((x) => x.ent === t.ent) : null;
    if (t && !fresh && !Gs.designated) { t = null; this._setGunTarget(null); }
    if (fresh) { t.dist = fresh.dist; t.pos.copy(fresh.pos); t.vis = fresh.vis; t.hullDown = fresh.hullDown; }
    if (aiCmd && this.cmd.target && (!t || this.cmd.target.ent !== t.ent)) { t = this.cmd.target; this._setGunTarget(t); }
    else if (!t && Gs.fireFree && this.targets.length) {
      t = this.targets.find((x) => x.vis) || null;
      if (t) {
        this._setGunTarget(t);
        if (!aiCmd && !Gs.reported.has(t.ent)) { Gs.reported.add(t.ent); this._report(t); }
      }
    } else if (t && Gs.fireFree && !Gs.designated && !aiCmd) {
      // gefährlicheres Ziel aufgetaucht (zielt auf uns, näher): umschwenken
      const best = this.targets.find((x) => x.vis);
      if (best && best.ent !== t.ent && best.score > (fresh ? fresh.score : 0) * 1.7) { t = best; this._setGunTarget(t); if (!Gs.reported.has(t.ent)) { Gs.reported.add(t.ent); this._report(t); } }
    }
    if (!t) {
      // Blickrichtung der Übergabe halten
      if (Gs.designate && now - Gs.designate.t < 8) { it.aimDir = (it.aimDir || new THREE.Vector3()).copy(Gs.designate.dir); it.aimAt = null; }
      this._coaxIdle(seat);
      return;
    }
    // Eigene Munitionswahl, wenn niemand befohlen hat (Spieler-Kommandant ohne Befehl): passende Sorte nachladen lassen
    if (!aiCmd && this.idx.loader >= 0 && this.ammoBy !== 'player') {
      const k = ammoForTarget(v, t);
      const id = k && idFor(v, k);
      if (id && this.ammoOrder !== id && now - this.ammoT > 3) this.orderAmmo(k, { from: 'Richtschütze', by: 'gunner', quiet: !this.isPlayer('loader') });
    }
    // Waffe: Koax gegen Infanterie (Kanone bleibt geladen), sonst Kanone
    const coaxIdx = seat.weapons.findIndex((w) => w.def.kind === 'mg');
    const lk = kindOf(v.gun.loaded);
    const canInf = lk && (KINDS[lk].role === 'can') && t.dist < 420;
    const useMg = coaxIdx >= 0 && (t.kind === 'infanterie' || (t.kind === 'panzerabwehr' && !canInf)) && t.dist < 650;
    if (useMg && seat.weaponIndex !== coaxIdx) it.weapon = coaxIdx;
    else if (!useMg && seat.weapons[seat.weaponIndex].def.kind === 'mg') {
      const si = seat.weapons.findIndex((w) => w.def.id === (v.gun.loaded || this.ammoOrder || seat._shellWish));
      it.weapon = si >= 0 ? si : seat.weapons.findIndex((w) => w.def.kind === 'shell');
    }
    const def = useMg ? seat.weapons[coaxIdx].def : VEHICLE_WEAPONS[v.gun.loaded] || VEHICLE_WEAPONS[this.ammoOrder] || seat.weapons[0].def;
    const P = targetPoint(t, _a);
    v.muzzle(seat.index, _o, _b);
    const speed = useMg ? 850 : def.speed || 1000;
    const optic = mods.optik <= 0 ? 3 : mods.optik < 1 ? 1.6 : 1;
    if (useMg) { _c.copy(P).addScaledVector(entVel(t.ent, _m), P.distanceTo(_o) / speed); }
    else {
      aimWithError(Gs.aim, _o, P, t.ent, speed, _c);
      if (optic > 1) _c.addScaledVector(_d.set(Gs.aim.bias.x, Gs.aim.bias.y, -Gs.aim.bias.x).normalize(), (optic - 1) * 0.0015 * P.distanceTo(_o));
    }
    v.aimAt(bot, _c, false);
    it.fireWhenAligned = true;
    Gs.aimT += dt;
    const settle = (SETTLE[this.era] || 2.5) * this.skill.settle * (Gs.aim.shots > 0 ? 0.5 : 1);
    Gs.ready = t.vis !== false && Gs.aimT >= settle && seat.aimError < 0.0015;
    // Feuern: „Feuer frei“, Feuerbefehl (Spieler oder KI-Kommandant)
    const ordered = now < Gs.fireOrder || Gs.fireFree;
    if (!ordered || this.mode.gunBlocked() || t.vis === false) { if (useMg) Gs.coax = 0; return; }
    const W = G.world;
    if (useMg) {
      if (seat.aimError < 0.02 && (!W || !W.lineOfSight || W.lineOfSight(_o, P))) { Gs.coax -= dt; if (Gs.coax <= -1.0) Gs.coax = 0.8 + Math.random() * 0.6; it.fire = Gs.coax > 0; if (it.fire) this.stats.mg++; }
      return;
    }
    const g = v.gun;
    const wk = this.era !== 'modern';
    if (g.step !== 'geladen' || seat.aimError > 0.0007 || Gs.aimT < settle || (wk && Math.abs(v.body.speed) > 1.2 && t.dist > 200)) return;
    if (now - Gs.lastShot < 1.0) return;
    if (W && W.lineOfSight && !W.lineOfSight(_o, P)) return; // Schusslinie ab der Mündung (Hang, Haus, Baum)
    it.firePressed = true; it.fire = true;
    Gs.lastShot = now;
    afterShot(Gs.aim, this.skill, v.body.speed);
    Gs.aimT = 0;
    this.stats.shots++;
    if (!Gs.fireFree) Gs.fireOrder = 0;
    this.say('Richtschütze', 'Schuss!', { key: 'schuss', quiet: true });
  }

  _coaxIdle(seat) {
    const w = seat.weapons[seat.weaponIndex];
    if (w && w.def.kind === 'mg') { const si = seat.weapons.findIndex((x) => x.def.kind === 'shell'); if (si >= 0) seat.intent.weapon = si; }
  }

  _report(t) {
    const eye = this.eye(_c);
    const rel = wrap(Math.atan2(-(t.pos.x - eye.x), -(t.pos.z - eye.z)) - this.v.body.yaw());
    this.say('Richtschütze', `${TARGET_LABEL[t.kind]} – ${bearingWord(rel)} – ${roundRange(t.dist)}!`, { key: 'meldung' });
  }

  /* ---------------------------------------------------------- Kommandant (KI) */

  _commander(dt) {
    const v = this.v, C = this.cmd, G = this.G, now = G.time.elapsed, mode = this.mode;
    if (this.idx.commander >= 0 && !this.isBot('commander')) return; // Kommandant ausgefallen (oder Spieler)
    // Motor anlassen (Simulation)
    if (mode.engineOff() && !mode.state.engineWanted) {
      mode.state.engineWanted = true;
      this.say('Kommandant', 'Fahrer – Motor anlassen!', { key: 'motor' });
    }
    // Ziel: gefährlichstes sichtbares; das alte bleibt, bis es vernichtet, 4 s verschwunden oder deutlich weniger gefährlich ist
    const ts = this.targets;
    let t = C.target;
    const cur = t ? ts.find((x) => x.ent === t.ent) : null;
    if (t && (!t.ent.alive || (t.ent.isVehicle && t.ent.wreck))) {
      this.say('Kommandant', t.kind === 'infanterie' ? 'Ziel bekämpft!' : 'Ziel vernichtet!', { key: 'erfolg' });
      t = C.target = null; C.phase = 'suche';
    } else if (t && !cur) { t = C.target = null; C.phase = 'suche'; }
    const best = ts.find((x) => x.vis) || null;
    if (best && (!t || (best.ent !== t.ent && best.score > (cur ? cur.score : 0) * 1.7) || (cur && !cur.vis && now - C.sinceCall > 3))) {
      t = C.target = best;
      C.phase = 'ansprache'; C.calledFor = null;
    }
    if (t) {
      if (cur) { t.dist = cur.dist; t.pos.copy(cur.pos); t.vis = cur.vis; t.hullDown = cur.hullDown; }
      const kind = ammoForTarget(v, t);
      const coax = t.kind === 'infanterie' && t.dist < 650 && v.seats[this.idx.gunner] && v.seats[this.idx.gunner].weapons.some((w) => w.def.kind === 'mg');
      if (C.calledFor !== t.ent) {
        C.calledFor = t.ent;
        const eye = this.eye(_c);
        const rel = wrap(Math.atan2(-(t.pos.x - eye.x), -(t.pos.z - eye.z)) - v.body.yaw());
        this.say('Kommandant', `Richtschütze – ${TARGET_LABEL[t.kind]} – ${bearingWord(rel)} – ${roundRange(t.dist)}${coax ? ' – MG' : kind ? ` – ${KINDS[kind].call}` : ''}!`, { key: 'ziel' });
        // Munition für den nächsten Schuss (Infanterie mit dem MG: Panzermunition bleibt, solange Panzer/Pak bekannt sind)
        const armor = ts.some((x) => x.kind === 'panzer' || x.kind === 'pak');
        if (kind && !coax) this.orderAmmo(kind, { quiet: false, by: 'commander' });
        else if (coax && !armor && this.ammoOrder && KINDS[kindOf(this.ammoOrder)].role === 'ke') { const k2 = ammoForTarget(v, { kind: 'bunker' }); if (k2) this.orderAmmo(k2, { by: 'commander' }); }
        if (this.isPlayer('gunner') && !this.arcade) { C.overrideT = 1.4; this._overrideTo(t); }
        else if (this.isBot('gunner')) setTimeout(() => this.say('Richtschütze', 'Erkannt!', { quiet: true }), 800);
        C.phase = 'richten'; C.sinceCall = now;
        // Fahrer: zum Schuss anhalten (Weltkrieg immer, modern auf große Entfernung)
        const wk = this.era !== 'modern';
        if (!this.arcade && (wk || t.dist > 1200) && Math.abs(v.body.speed) > 1 && t.kind !== 'infanterie' && (this.drive.cmd === 'vor' || this.drive.cmd === 'markierung' || this.isPlayer('driver'))) this._driveOrder('halt');
      }
      // Feuerbefehl, sobald geladen und gerichtet (falsche Sorte im Rohr: trotzdem schießen – der nächste Schuss passt)
      const g = v.gun;
      const loaded = coax || (g && g.step === 'geladen');
      if (C.phase === 'richten' && loaded && !mode.gunBlocked() && t.vis !== false) {
        let aimed = false;
        if (this.isPlayer('gunner')) {
          const seat = v.seats[this.idx.gunner];
          const dir = _d.set(-Math.sin(seat.look.yaw) * Math.cos(seat.look.pitch), Math.sin(seat.look.pitch), -Math.cos(seat.look.yaw) * Math.cos(seat.look.pitch));
          const eye = this.eye(_c);
          aimed = Math.acos(clamp(targetPoint(t, _a).sub(eye).normalize().dot(dir), -1, 1)) < 0.012;
        } else aimed = this.gun.ready || coax;
        if (aimed && now - C.fireSaidT > (this.isPlayer('gunner') ? 5 : 1.5) && now > this.gun.fireOrder - 5.5) {
          C.fireSaidT = now;
          this.fire({ quiet: coax && now - C.sinceCall > 2 });
        }
      }
    } else if (C.phase !== 'suche') C.phase = 'suche';
    // Fahrbefehle: solange kein schweres Ziel (Panzer, Pak, Bunker, Panzerabwehr) bekämpft wird, auf das nächste
    // Angriffsziel vorrücken (Infanterie nimmt das MG während der Fahrt) – in Sprüngen bis ~150 m vor das Ziel
    const heavy = t && t.kind !== 'infanterie' && t.vis !== false;
    if (!heavy && !this.arcade && now - C.driveSaidT > 6 && !mode.engineOff()) {
      const obj = mode.nextObjective();
      if (obj) {
        const d = obj.distanceTo(v.position);
        const stand = 150;
        if (d > stand + 30 && (this.drive.cmd === 'halt' || (this.isPlayer('driver') && Math.abs(v.body.speed) < 0.5))) {
          C.objective = obj;
          const p = obj.clone().sub(v.position).setY(0);
          const L = p.length();
          const goal = v.position.clone().addScaledVector(p.normalize(), Math.max(30, Math.min(L - stand, this.era === 'modern' ? 260 : 180)));
          const W = G.world; if (W && W.groundHeight) { const h = W.groundHeight(goal.x, goal.z, goal.y + 30); if (h != null) goal.y = h; }
          mode.setMarker(goal);
          this._driveOrder('markierung', goal);
        }
      }
    }
    // Schwer getroffen: Deckung
    if (!this.arcade && v.health < v.maxHealth * 0.45 && now - C.hurtT > 25 && (this.drive.cmd !== 'deckung')) { C.hurtT = now; this._driveOrder('deckung'); }
    // Kommandantenübersteuerung (Spieler-Richtschütze): Turm weich auf das Ziel
    if (C.overrideT > 0 && this.isPlayer('gunner')) {
      C.overrideT -= dt;
      const seat = v.seats[this.idx.gunner];
      const k = 1 - Math.exp(-dt * 4);
      seat.look.yaw = wrap(seat.look.yaw + wrap(C.overYaw - seat.look.yaw) * k);
      seat.look.pitch += (C.overPitch - seat.look.pitch) * k;
    }
  }

  _overrideTo(t) {
    const eye = this.eye(_c), p = targetPoint(t, _a);
    _d.copy(p).sub(eye);
    this.cmd.overYaw = Math.atan2(-_d.x, -_d.z);
    this.cmd.overPitch = Math.atan2(_d.y, Math.hypot(_d.x, _d.z));
  }

  /** Fahrbefehl der KI (Spieler-Fahrer sieht ihn im HUD; Bot-Fahrer führt aus). */
  _driveOrder(cmd, arg) {
    const now = this.G.time.elapsed;
    if (this.cmd.lastDrive === cmd && now - this.cmd.driveSaidT < 4) return;
    this.cmd.lastDrive = cmd; this.cmd.driveSaidT = now;
    this.order(cmd, arg);
    this.mode.driverOrder = { cmd, at: now, goal: arg ? arg.clone() : this.drive.goal };
  }

  /* ---------------------------------------------------------- Bug-/Zusatz-MG */

  _mgSeat(i, dt) {
    const v = this.v, s = v.seats[i], bot = s.actor;
    if (!bot || bot.isPlayer || !bot.alive) return;
    const st = this.mg.get(i) || { t: 0, burst: 0 };
    this.mg.set(i, st);
    const it = s.intent;
    if (!s.weapons.length) return;
    const t = this.targets.find((x) => x.vis && (x.kind === 'infanterie' || x.kind === 'panzerabwehr') && x.dist < 420);
    if (!t || !this.gun.fireFree && !(this.G.time.elapsed < this.gun.fireOrder)) { it.fire = false; v.aimAt(bot, null, false); return; }
    const P = targetPoint(t, _a);
    v.aimAt(bot, P, false);
    st.t -= dt;
    if (st.t <= 0) { st.burst = 0.7 + Math.random() * 0.6; st.t = 2 + Math.random() * 1.5; }
    v.muzzle(i, _o, _b);
    const W = this.G.world;
    const clear = !W || !W.lineOfSight || W.lineOfSight(_o, P);
    if (st.burst > 0) { st.burst -= dt; it.fire = s.aimError < 0.05 && clear; if (it.fire) this.stats.mg++; } else it.fire = false;
  }
}

/* ====================================================================== Feindpanzer */

export class EnemyTank {
  constructor(mode, v, bot, { post = null, route = null, team = 'B', hold = false, side = 1 } = {}) {
    this.mode = mode; this.G = mode.G; this.v = v; this.bot = bot;
    // team 'A': verbündeter KI-Panzer (Panzer-Kampagne) – gleiche KI, folgt der Route bzw. dem Spielerpanzer
    this.team = team; this.hold = hold; this.side = side;
    this.post = post; this.route = route || [];
    this.leg = 0;
    this.known = new Map(); this.targets = [];
    this.scanT = Math.random(); this.aimT = 0; this.shots = 0; this.target = null;
    this.state = 'halten'; this.moveT = 0; this.cool = 1 + Math.random() * 2;
    this.era = eraOf(v.def);
    this.skill = team === 'B' ? skillAt(foeLevel(this.G, mode)) : FRIEND;
    this.aim = aimState();
    v._psimAI = this;
    v._reloadMul = this.skill.reload;
    // virtuelle Ladeschützen (nur ein Bot an Bord): lädt in Ladeschützenzeit, solange er „lebt“
    v._virtualLoader = () => { const c = crewOf(v).find((x) => x.role === 'loader'); return !!c && c.state !== 'tot'; };
  }

  update(dt) {
    const v = this.v, bot = this.bot, G = this.G;
    if (!v.alive || !bot || !bot.alive || bot.vehicle !== v) return;
    if (G.match.state !== 'playing') { v.stop(bot); return; }
    const crew = crewOf(v), mods = modsOf(v);
    const role = (r) => crew.find((c) => c.role === r);
    const drvOk = !role('driver') || role('driver').state !== 'tot';
    const gunOk = (!role('gunner') || role('gunner').state !== 'tot') && mods.rohr > 0;
    const it = v.intentFor(bot);
    if (!it) return;
    const now = G.time.elapsed;
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.6;
      const range = this.era === 'modern' ? 2600 : 1300;
      _c.copy(v.body.pos); _c.y += 1.6;
      const sk = mods.optik <= 0 ? { ...this.skill, detect: this.skill.detect * 2 } : this.skill;
      this.targets = scanTargets(G, _c, range, this.team, this.known, 0.6, { maxLos: 10, vehicle: v, skill: sk, moving: Math.abs(v.body.speed) > 4 });
      // gefährlichstes sichtbares Ziel; Panzer vor Infanterie (Infanterie nur bis 500 m)
      const cand = this.targets.filter((t) => t.vis && (t.ent.isVehicle || t.dist < 500));
      const nt = cand[0] || null;
      const cur = this.target ? this.targets.find((t) => t.ent === this.target.ent) : null;
      if (cur) { this.target.dist = cur.dist; this.target.pos.copy(cur.pos); this.target.vis = cur.vis; this.target.hullDown = cur.hullDown; }
      if (!cur) this.target = null;
      if (nt && (!this.target || (nt.ent !== this.target.ent && (nt.score > cur.score * 1.7 || !cur.vis)))) {
        this.target = nt; this.aimT = 0; newBias(this.aim, this.era, this.skill, v.body.speed);
      }
    }
    const t = this.target;
    if (t && (!t.ent.alive || t.ent.wreck)) { this.target = null; return; }
    const wk = this.era !== 'modern';
    // Bewegung
    if (!drvOk || mods.ketten <= 0 || mods.motor <= 0) { v.stop(bot); }
    else if (t) {
      if (this.state !== 'kampf') { this.state = 'kampf'; v.stop(bot); this.moveT = 8 + Math.random() * 10; }
      // nach ein paar Schüssen Stellungswechsel (modern), sonst stehen
      this.moveT -= dt;
      if (!wk && this.moveT <= 0 && this.shots >= 2) {
        this.moveT = 14 + Math.random() * 8; this.shots = 0;
        const side = _a.set(Math.cos(v.body.yaw()), 0, -Math.sin(v.body.yaw())).multiplyScalar((Math.random() < 0.5 ? -1 : 1) * 18);
        v.driveTo(bot, v.position.clone().add(side), { arriveRadius: 4, maxSpeed: 5 });
      } else if (it.arrived || !it.path) v.stop(bot);
    } else if (this.hold && !this.route.length) {
      if (this.state !== 'halten') { this.state = 'halten'; v.stop(bot); }
    } else {
      if (this.state !== 'fahrt') { this.state = 'fahrt'; this._next(); }
      if (it.arrived) { this.leg++; this._next(); }
      // Verbündete ohne Route: dem Spielerpanzer folgen (neues Ziel alle paar Sekunden)
      else if (this.team !== 'B' && this.leg >= this.route.length && (this._followT = (this._followT || 0) - dt) <= 0) { this._followT = 4; this._next(); }
    }
    // Waffe
    it.fire = false;
    if (!t || !gunOk) { if (!t) v.aimAt(bot, null, false); return; }
    const seat = v.seats.find((s) => s.def.mount === 'gun');
    if (!seat) return;
    // Munition: Panzer → Wucht/PzGr, sonst Spreng (nächste Ladung)
    const kind = ammoForTarget(v, t);
    const id = idFor(v, kind);
    if (id) { seat._shellWish = id; const wi = seat.weapons.findIndex((w) => w.def.id === id); if (wi >= 0 && wi !== seat.weaponIndex) it.weapon = wi; }
    const def = VEHICLE_WEAPONS[v.gun.loaded] || seat.weapons[0].def;
    const P = targetPoint(t, _a);
    v.muzzle(seat.index, _o, _b);
    aimWithError(this.aim, _o, P, t.ent, def.speed || 900, _c);
    if (mods.optik < 1) _c.addScaledVector(UP, (mods.optik <= 0 ? 0.004 : 0.0015) * P.distanceTo(_o) * (this.aim.bias.y >= 0 ? 1 : -1));
    v.aimAt(bot, _c, false);
    if (t.vis === false) return; // nur erinnert: Turm bleibt drauf, kein Schuss
    this.aimT += dt;
    this.cool -= dt;
    const settle = (SETTLE[this.era] || 2.5) * this.skill.settle * (this.aim.shots > 0 ? 0.55 : 1);
    if (this.cool > 0 || v.gun.step !== 'geladen' || this.aimT < settle || seat.aimError > 0.0008) return;
    if (wk && Math.abs(v.body.speed) > 1.2) return;
    const W = G.world;
    if (W && W.lineOfSight && !W.lineOfSight(_o, P)) return; // Schusslinie ab der Mündung
    it.fire = true; it.firePressed = true;
    this.shots++; this.cool = 1.5;
    afterShot(this.aim, this.skill, v.body.speed);
    this.aimT = 0;
  }

  _next() {
    const v = this.v, bot = this.bot;
    let goal = this.route[this.leg] || null;
    if (!goal && this.team !== 'B') {
      // Verbündeter: seitlich hinter dem Spielerpanzer (Abstand ~30 m), steht still, wenn er schon dort ist
      const P = this.mode.tank;
      if (!P || !P.alive) { v.stop(bot); return; }
      const y = P.body.yaw(), side = this.side;
      goal = P.position.clone().add(_a.set(Math.sin(y) * 22 + Math.cos(y) * 14 * side, 0, Math.cos(y) * 22 - Math.sin(y) * 14 * side));
      if (goal.distanceTo(v.position) < 12) { v.stop(bot); return; }
      v.driveTo(bot, goal, { arriveRadius: 8, maxSpeed: 6 });
      return;
    }
    if (!goal) {
      const P = this.mode.tank;
      if (P && P.alive && Math.random() < 0.6) goal = P.position.clone().lerp(this.post || v.position, 0.55);
      else goal = this.post;
    }
    if (goal) v.driveTo(bot, goal, { arriveRadius: 8, maxSpeed: 5 });
  }
}
