// NULLPUNKT — Panzersimulation: KI-Besatzung des Spielerpanzers und KI der Feindpanzer.
//
// Eigene Besatzung (Bots in den Sitzen, Team A) – jede nicht gespielte Rolle arbeitet selbst:
//   Fahrer         Befehle: vor (3 Stufen) / halt / links / rechts / zurück / zur Markierung / Deckung / Front zum Ziel
//   Richtschütze   sucht Ziele (Sichtlinie, Erkennungszeit nach Entfernung), meldet sie, richtet mit Vorhalt und
//                  abklingendem Richtfehler, schießt nur auf „Feuer!“ (oder „Feuer frei“), MG gegen nahe Infanterie
//   Ladeschütze    lädt die befohlene Art (Automatik von crew.js mit echter Ladezeit), meldet „… geladen!“
//   Kommandant     (wenn der Spieler nicht Kommandant ist) Zielansprache „Richtschütze – Panzer – halbrechts – 800 –
//                  Wucht – Feuer!“, Munitionsbefehle an den Lader, Fahrbefehle (Marsch auf das nächste Ziel, Halt zum
//                  Schuss, Deckung nach schwerem Treffer), Kommandantenübersteuerung des Turms für den Spieler-Richtschützen
//   Bug-/Zusatz-MG nahe Infanterie in Feuerstößen
// Feindpanzer (EnemyTank): ein Bot fährt und richtet (Stellvertreter-Richtschütze, vehicle._proxyGunner), virtuelle
//   Restbesatzung (ammo.js crewOf) – fällt der Fahrer/Richtschütze virtuell aus, steht bzw. schweigt der Panzer.
import * as THREE from 'three';
import { VEHICLE_WEAPONS } from '../data.js?v=20261115041504';
import { Vehicle } from '../vehicle.js?v=20261115041504';
import { gunSeat, loaderSeat } from '../crew.js?v=20261115041504';
import { KINDS, kindOf, idFor, modsOf, crewOf } from './ammo.js?v=20261115041504';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;

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

/** Zielpunkt eines Eintrags (Welt, aktuell). */
export function targetPoint(t, out) {
  const e = t.ent;
  if (e.isVehicle) { out.copy(e.body.pos); out.y += e.isEmplacement ? (e.kind === 'bunker' ? 0.2 : -0.1) : 0.25; return out; }
  out.copy(e.position); out.y += 1.15; return out;
}
const entVel = (e, out) => (e.isVehicle ? out.copy(e.body.vel) : e.body && e.body.velocity ? out.copy(e.body.velocity) : out.set(0, 0, 0));

function classify(e) {
  if (e.isVehicle) return e.isEmplacement ? e.kind : e.def.armored ? 'panzer' : 'fahrzeug';
  return typeof e._launcherSlot === 'function' && e._launcherSlot() >= 0 ? 'panzerabwehr' : 'infanterie';
}

/**
 * Sichtbare Gegner aus Sicht eines Auges (gedrosselt). known: Map ent → { t: Erkennungsfortschritt } (Erkennen dauert
 * 0,3 s + Entfernung/700 m). → [{ ent, kind, dist, pos }], nach Bedrohung sortiert
 */
export function scanTargets(G, eye, range, team, known, dt, { maxLos = 28, vehicle = null } = {}) {
  const out = [], W = G.world;
  let los = 0;
  const consider = (e, kind, p) => {
    const d = p.distanceTo(eye);
    if (d > range) { known.delete(e); return; }
    if (los >= maxLos) { const k = known.get(e); if (k && k.t >= 1) out.push({ ent: e, kind, dist: d, pos: p.clone() }); return; }
    los++;
    const vis = !W || !W.lineOfSight || W.lineOfSight(eye, p);
    let k = known.get(e);
    if (!vis) { if (k) { k.t = Math.max(0, k.t - dt * 0.5); if (k.t <= 0) known.delete(e); } return; }
    if (!k) { k = { t: 0, first: G.time.elapsed }; known.set(e, k); }
    k.t = Math.min(1, k.t + dt / (0.3 + d / 700) * (e.isVehicle && e.body.speed > 2 ? 1.6 : 1));
    if (k.t >= 1) out.push({ ent: e, kind, dist: d, pos: p.clone() });
  };
  const V = G.vehicles;
  for (const v of (V && V.list) || []) {
    if (!v.alive || v === vehicle || v.def.civil) continue;
    const t = v.team;
    if (t == null || t === team) continue;
    if (!v.isEmplacement && !v.isOccupied) continue;
    _a.copy(v.body.pos); _a.y += 0.5;
    consider(v, classify(v), _a);
  }
  for (const a of G.actors) {
    if (!a.alive || a.vehicle || a.team == null || a.team === team) continue;
    _a.copy(a.position); _a.y += 1.2;
    consider(a, classify(a), _a);
  }
  out.sort((x, y) => (PRIO[y.kind] || 1) / Math.max(80, y.dist) - (PRIO[x.kind] || 1) / Math.max(80, x.dist));
  return out;
}

/** Passende Munitionsart für ein Ziel (Art-Kennung der Generation). */
export function ammoForTarget(v, t) {
  const has = (k) => !!idFor(v, k) && v.gun && v.gun.rack[idFor(v, k)] > 0;
  const pick = (...ks) => ks.find(has) || ks.find((k) => !!idFor(v, k)) || null;
  const kind = t ? t.kind : 'panzer';
  if (kind === 'panzer') return pick('lfk', 'wucht', 'tsg', 'pzgr', 'mz', 'hl');
  if (kind === 'pak' || kind === 'bunker' || kind === 'fahrzeug' || kind === 'funk' || kind === 'lager' || kind === 'bruecke') return pick('spreng', 'qk', 'mz', 'hl', 'pzgr');
  if (t && t.dist < (idFor(v, 'kan') ? 420 : 200)) return pick('kan', 'kart', 'spreng', 'qk', 'mz');
  return pick('spreng', 'qk', 'mz', 'pzgr');
}

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
    this.extra = S.filter((s) => s.def.mount === 'cmg' && s.def.id !== 'commander' && s.index !== this.idx.gunner).map((s) => s.index);
    this.known = new Map();
    this.targets = [];
    this.scanT = 0;
    // Fahrer
    this.drive = { cmd: 'halt', speed: 1, turn: 0, turnT: 0, goal: null, since: 0, blockedT: 0, said: '' };
    // Richtschütze
    this.gun = { target: null, aimT: 0, noise: new THREE.Vector2(), fireOrder: 0, fireFree: false, lastShot: -1e9, designate: null, coax: 0, reported: new WeakSet() };
    // Lader / Kommandant
    this.ammoOrder = null;
    this.cmd = { target: null, phase: 'suche', sinceFire: 0, calledFor: null, overrideT: 0, overYaw: 0, overPitch: 0, objective: null, lastDrive: '', driveSaidT: -1e9, hurtT: -1e9, fireSaidT: -1e9 };
    this.mg = new Map();
  }

  seatActor(role) { const i = this.idx[role]; return i >= 0 ? this.v.seats[i].actor : null; }
  isPlayer(role) { const a = this.seatActor(role); return !!(a && a.isPlayer); }
  isBot(role) { const a = this.seatActor(role); return !!(a && !a.isPlayer && a.alive); }
  say(from, text, o) { this.mode.radio.say(from, text, o); }
  eye(out) { return this.v.body.toWorld(out.set(0, (this.v.def.hullBox[1] + this.v.def.hullBox[4]) + 0.9, 0), out); }

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
    D.blockedT = 0;
    if (driverBot && !quiet) setTimeout(() => { if (this.isBot('driver')) this.say('Fahrer', { vor: 'Fahre!', halt: 'Halte!', zurueck: 'Fahre zurück!', markierung: 'Fahre Markierung an!', deckung: 'Gehe in Deckung!', rumpf: 'Drehe!', links: 'Links!', rechts: 'Rechts!' }[cmd] || 'Verstanden!', { key: 'drv-ack', quiet: true }); }, 500);
  }

  /** Munitionsbefehl an den Ladeschützen. kind = Art (wucht, mz, …) */
  orderAmmo(kind, { quiet = false, from = 'Kommandant' } = {}) {
    const id = idFor(this.v, kind);
    if (!id) return false;
    this.ammoOrder = id;
    const gs = this.v.seats[this.idx.gunner];
    if (gs) { const wi = gs.weapons.findIndex((w) => w.def.id === id); if (wi >= 0) gs.intent.weapon = wi; gs._shellWish = id; }
    if (this.v.gun && !this.v.gun.held && this.v.gun.step !== 'geladen') this.v.gun.select = id;
    if (!quiet) this.say(from, `${KINDS[kind].call} laden!`, { key: 'ammo' });
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
        if (ang < ba && d < 3000) { ba = ang; best = { ent: v, kind: classify(v), dist: d, pos: v.body.pos.clone() }; }
      }
    }
    const G = this.gun;
    G.designate = { dir: dir.clone(), t: this.G.time.elapsed };
    if (best) {
      this.known.set(best.ent, { t: 1, first: this.G.time.elapsed });
      G.target = best; G.aimT = 0;
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

  fire({ from = 'Kommandant' } = {}) {
    this.say(from, 'Feuer!', { key: 'feuer' });
    this.gun.fireOrder = this.G.time.elapsed + 6;
  }

  toggleFireFree({ from = 'Kommandant' } = {}) {
    this.gun.fireFree = !this.gun.fireFree;
    this.say(from, this.gun.fireFree ? 'Feuer frei!' : 'Feuer einstellen!', { key: 'feuerfrei' });
  }

  /* ---------------------------------------------------------- Takt */

  update(dt) {
    const v = this.v;
    if (!v.alive) return;
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.45;
      const range = (v.def.era || 'modern') === 'modern' ? 3000 : 1600;
      this.targets = scanTargets(this.G, this.eye(_c), range, 'A', this.known, 0.45, { vehicle: v });
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
    const mode = this.mode;
    // Motor: Bot-Fahrer lässt an, sobald es befohlen ist (Simulation: Motor aus beim Start)
    if (mode.engineOff()) {
      if ((mode.state.engineWanted || D.cmd !== 'halt') && !mode.state.cranking) mode.crankEngine('Fahrer');
      it.throttle = 0; it.steer = 0; it.brake = 1; it.path = it.moveTo = null;
      return;
    }
    mode.state.parkBrake = false;
    it.gearbox = 'auto';
    if (D.turnT > 0) { D.turnT -= dt; if (D.turnT <= 0) D.turn = 0; }
    const sp = v.body.speed;
    const lvl = [0, 0.42, 0.7, 1][D.speed] || 0.42;
    switch (D.cmd) {
      case 'vor':
        it.path = it.moveTo = null;
        it.throttle = lvl; it.brake = 0; it.steer = D.turn * 0.75;
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
        }
        break;
      case 'rumpf': {
        it.path = it.moveTo = null;
        const want = D.goalYaw ?? v.body.yaw();
        const e = wrap(want - v.body.yaw());
        it.throttle = 0; it.brake = 0;
        it.steer = clamp(-e * 2.2, -1, 1);
        if (Math.abs(e) < 0.05) { it.steer = 0; D.cmd = 'halt'; this.say('Fahrer', 'Front steht!', { key: 'drv-arr' }); }
        break;
      }
      case 'halt':
      default:
        it.path = it.moveTo = null;
        it.throttle = 0;
        it.brake = D.turn && D.pivot ? 0 : 1;
        it.steer = D.turn && D.pivot ? D.turn * 0.8 : 0;
    }
    // Festgefahren melden
    if ((D.cmd === 'vor' || D.cmd === 'zurueck') && Math.abs(sp) < 0.4 && this.G.time.elapsed - D.since > 3) {
      D.blockedT += dt;
      if (D.blockedT > 2.5) { D.blockedT = -6; this.say('Fahrer', 'Komme nicht weiter!', { key: 'drv-blk' }); }
    } else if (D.blockedT > 0) D.blockedT = 0;
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
    // Ziel wählen: übergebenes/angesprochenes, sonst bei „Feuer frei“ oder KI-Kommandant das bedrohlichste
    let t = Gs.target;
    if (t && (!t.ent.alive || (t.ent.isVehicle && t.ent.wreck))) { t = Gs.target = null; }
    if (!t && (Gs.fireFree || !this.isPlayer('commander'))) {
      t = this.targets[0] || null;
      if (t && !this.isPlayer('commander')) t = this.cmd.target || null; // KI-Kommandant weist zu
      if (t && Gs.fireFree && !Gs.reported.has(t.ent)) { Gs.reported.add(t.ent); this._report(t); }
      Gs.target = t; Gs.aimT = 0;
    }
    if (!t) {
      // Blickrichtung der Übergabe halten
      if (Gs.designate && now - Gs.designate.t < 8) { it.aimDir = (it.aimDir || new THREE.Vector3()).copy(Gs.designate.dir); it.aimAt = null; }
      return;
    }
    // Richten mit Vorhalt und abklingendem Fehler
    const shellIdx = seat.weapons.findIndex((w) => w.def.id === (this.ammoOrder || v.gun.loaded || seat._shellWish));
    const coaxIdx = seat.weapons.findIndex((w) => w.def.kind === 'mg');
    const useMg = coaxIdx >= 0 && (t.kind === 'infanterie') && t.dist < 420 && (Gs.fireFree || now < Gs.fireOrder) && !(this.ammoOrder && kindOf(this.ammoOrder) === 'kan');
    if (useMg && seat.weaponIndex !== coaxIdx) it.weapon = coaxIdx;
    else if (!useMg && shellIdx >= 0 && seat.weaponIndex !== shellIdx && seat.weapons[seat.weaponIndex].def.kind === 'mg') it.weapon = shellIdx;
    const def = useMg ? seat.weapons[coaxIdx].def : VEHICLE_WEAPONS[v.gun.loaded] || seat.weapons[0].def;
    const P = targetPoint(t, _a);
    const eye = this.eye(_c);
    const dist = P.distanceTo(eye);
    const tof = useMg ? dist / 820 : dist / (def.speed || 1000);
    P.addScaledVector(entVel(t.ent, _b), tof);
    Gs.aimT += dt;
    const skill = { rekrut: 1.6, regulaer: 1, veteran: 0.75, elite: 0.55 }[G.match && G.match.difficulty] || 1;
    const optic = mods.optik <= 0 ? 3 : mods.optik < 1 ? 1.6 : 1;
    const sig = (0.0028 * Math.exp(-Gs.aimT / 1.6) + 0.00035) * (1 + Math.abs(v.body.speed) * ((v.def.era || 'modern') === 'modern' ? 0.03 : 0.25)) * optic;
    if (Math.random() < dt * 2) Gs.noise.set(gauss() * sig, gauss() * sig);
    _d.copy(P).sub(eye);
    const yaw = Math.atan2(-_d.x, -_d.z) + Gs.noise.x, pitch = Math.atan2(_d.y, Math.hypot(_d.x, _d.z)) + Gs.noise.y * 0.6;
    const r = _d.length();
    _b.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(r).add(eye);
    v.aimAt(bot, _b, false);
    it.fireWhenAligned = true;
    // Feuern
    const ordered = now < Gs.fireOrder || Gs.fireFree;
    if (!ordered || this.mode.gunBlocked()) return;
    if (useMg) {
      if (seat.aimError < 0.02) { Gs.coax -= dt; if (Gs.coax <= -1.2) Gs.coax = 0.9; it.fire = Gs.coax > 0; }
      return;
    }
    const g = v.gun;
    const wk = (v.def.era || 'modern') !== 'modern';
    if (g.step !== 'geladen' || seat.aimError > 0.004 || Gs.aimT < (wk ? 1.6 : 1.0) || (wk && Math.abs(v.body.speed) > 1.5)) return;
    if (now - Gs.lastShot < 1.5) return;
    const W = G.world;
    if (W && W.lineOfSight && !W.lineOfSight(eye, targetPoint(t, _d))) return;
    it.firePressed = true; it.fire = true;
    Gs.lastShot = now;
    if (!Gs.fireFree) Gs.fireOrder = 0;
    this.say('Richtschütze', 'Schuss!', { key: 'schuss', quiet: true });
  }

  _report(t) {
    const eye = this.eye(_c);
    const rel = wrap(Math.atan2(-(t.pos.x - eye.x), -(t.pos.z - eye.z)) - this.v.body.yaw());
    this.say('Richtschütze', `${TARGET_LABEL[t.kind]} – ${bearingWord(rel)} – ${roundRange(t.dist)}!`, { key: 'meldung' });
  }

  /* ---------------------------------------------------------- Kommandant (KI) */

  _commander(dt) {
    const v = this.v, C = this.cmd, G = this.G, now = G.time.elapsed, mode = this.mode;
    if (this.idx.commander >= 0 && !this.isBot('commander') && !this.isPlayer('commander')) return; // Kommandant ausgefallen
    // Motor anlassen (Simulation)
    if (mode.engineOff() && !mode.state.engineWanted) {
      mode.state.engineWanted = true;
      this.say('Kommandant', 'Fahrer – Motor anlassen!', { key: 'motor' });
    }
    // Ziel
    const ts = this.targets;
    let t = C.target;
    if (t && (!t.ent.alive || (t.ent.isVehicle && t.ent.wreck) || !ts.some((x) => x.ent === t.ent))) {
      if (t && (!t.ent.alive || t.ent.wreck)) this.say('Kommandant', t.kind === 'infanterie' ? 'Ziel bekämpft!' : 'Ziel vernichtet!', { key: 'erfolg' });
      t = C.target = null; C.phase = 'suche';
    }
    if (!t && ts.length) {
      t = C.target = ts[0];
      C.phase = 'ansprache'; C.calledFor = null;
      this.gun.target = t; this.gun.aimT = 0;
    }
    if (t) {
      const fresh = ts.find((x) => x.ent === t.ent); if (fresh) { t.dist = fresh.dist; t.pos.copy(fresh.pos); }
      const kind = ammoForTarget(v, t);
      if (C.calledFor !== t.ent) {
        C.calledFor = t.ent;
        const eye = this.eye(_c);
        const rel = wrap(Math.atan2(-(t.pos.x - eye.x), -(t.pos.z - eye.z)) - v.body.yaw());
        this.say('Kommandant', `Richtschütze – ${TARGET_LABEL[t.kind]} – ${bearingWord(rel)} – ${roundRange(t.dist)}${kind ? ` – ${KINDS[kind].call}` : ''}!`, { key: 'ziel' });
        if (kind) this.orderAmmo(kind, { quiet: true });
        if (this.isPlayer('gunner') && !this.arcade) { C.overrideT = 1.4; this._overrideTo(t); }
        else if (this.isBot('gunner')) setTimeout(() => this.say('Richtschütze', 'Erkannt!', { quiet: true }), 800);
        C.phase = 'richten'; C.sinceCall = now;
        // Fahrer: zum Schuss anhalten (Weltkrieg immer, modern auf große Entfernung)
        const wk = (v.def.era || 'modern') !== 'modern';
        if (!this.arcade && (wk || t.dist > 1200) && Math.abs(v.body.speed) > 1 && (this.drive.cmd === 'vor' || this.drive.cmd === 'markierung' || this.isPlayer('driver'))) this._driveOrder('halt');
      }
      // Feuerbefehl, sobald geladen und gerichtet
      const g = v.gun;
      const loaded = g && g.step === 'geladen' && (!this.ammoOrder || g.loaded === this.ammoOrder || now - C.sinceCall > 9);
      if (C.phase === 'richten' && loaded && !mode.gunBlocked()) {
        let aimed = false;
        if (this.isPlayer('gunner')) {
          const seat = v.seats[this.idx.gunner];
          const dir = _d.set(-Math.sin(seat.look.yaw) * Math.cos(seat.look.pitch), Math.sin(seat.look.pitch), -Math.cos(seat.look.yaw) * Math.cos(seat.look.pitch));
          const eye = this.eye(_c);
          aimed = Math.acos(clamp(targetPoint(t, _a).sub(eye).normalize().dot(dir), -1, 1)) < 0.012;
        } else aimed = this.gun.aimT > 0.8 && v.seats[this.idx.gunner] && v.seats[this.idx.gunner].aimError < 0.01;
        if (aimed && now - C.fireSaidT > 5) { C.fireSaidT = now; this.fire(); }
      }
    } else if (C.phase !== 'suche') C.phase = 'suche';
    // Fahrbefehle: ohne Ziel auf das nächste Angriffsziel vorrücken
    if (!t && !this.arcade && now - C.driveSaidT > 6 && !mode.engineOff()) {
      const obj = mode.nextObjective();
      if (obj) {
        const d = obj.distanceTo(v.position);
        if (d > 120 && (this.drive.cmd === 'halt' || (this.isPlayer('driver') && Math.abs(v.body.speed) < 0.5))) {
          C.objective = obj;
          // Vorrücken bis ~350 m (Weltkrieg) bzw. ~900 m (modern) vor das Ziel
          const stand = (v.def.era || 'modern') === 'modern' ? 900 : 380;
          const p = obj.clone().sub(v.position).setY(0);
          const L = p.length();
          const goal = v.position.clone().addScaledVector(p.normalize(), Math.max(30, Math.min(L - stand, 260)));
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
    const t = this.targets.find((x) => (x.kind === 'infanterie' || x.kind === 'panzerabwehr') && x.dist < 380);
    if (!t) { it.fire = false; v.aimAt(bot, null, false); return; }
    v.aimAt(bot, targetPoint(t, _a), false);
    st.t -= dt;
    if (st.t <= 0) { st.burst = 0.7 + Math.random() * 0.6; st.t = 2 + Math.random() * 1.5; }
    if (st.burst > 0) { st.burst -= dt; it.fire = s.aimError < 0.05; } else it.fire = false;
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
    this.state = 'halten'; this.moveT = 0; this.cool = 2 + Math.random() * 2;
    this.noise = new THREE.Vector2();
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
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.7;
      const range = (v.def.era || 'modern') === 'modern' ? 2600 : 1200;
      _c.copy(v.body.pos); _c.y += 1.6;
      this.targets = scanTargets(G, _c, range, this.team, this.known, 0.7, { maxLos: 10, vehicle: v });
      const tank = this.targets.find((t) => t.kind === 'panzer' || t.kind === 'fahrzeug');
      const nt = tank || this.targets.find((t) => t.dist < 500) || null;
      if (nt && (!this.target || nt.ent !== this.target.ent)) { this.target = nt; this.aimT = 0; }
      if (!nt) this.target = null;
    }
    const t = this.target;
    const wk = (v.def.era || 'modern') !== 'modern';
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
    if (!t || !gunOk) { if (!t) v.aimAt(bot, null, false); return; }
    const seat = v.seats.find((s) => s.def.mount === 'gun');
    if (!seat) return;
    // Munition: Panzer → Wucht/PzGr, sonst Spreng
    const kind = ammoForTarget(v, t);
    const id = idFor(v, kind);
    if (id) { const wi = seat.weapons.findIndex((w) => w.def.id === id); if (wi >= 0 && wi !== seat.weaponIndex) it.weapon = wi; }
    const def = VEHICLE_WEAPONS[v.gun.loaded] || seat.weapons[0].def;
    _c.copy(v.body.pos); _c.y += 1.8;
    const P = targetPoint(t, _a);
    const dist = P.distanceTo(_c);
    P.addScaledVector(entVel(t.ent, _b), dist / (def.speed || 900));
    this.aimT += dt;
    const diff = { rekrut: 1.8, regulaer: 1.2, veteran: 0.9, elite: 0.65 }[G.match && G.match.difficulty] || 1.2;
    const sig = (0.004 * Math.exp(-this.aimT / 3) + 0.0007 + 0.0009 / (1 + this.shots)) * diff * (mods.optik < 1 ? 2 : 1);
    if (Math.random() < dt * 1.5) this.noise.set(gauss() * sig, gauss() * sig);
    _d.copy(P).sub(_c);
    const yaw = Math.atan2(-_d.x, -_d.z) + this.noise.x, pitch = Math.atan2(_d.y, Math.hypot(_d.x, _d.z)) + this.noise.y * 0.6;
    _b.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(_d.length()).add(_c);
    v.aimAt(bot, _b, false);
    it.fire = false;
    this.cool -= dt;
    const W = G.world;
    if (this.cool <= 0 && v.gun.step === 'geladen' && this.aimT > (wk ? 2.6 : 1.8) && seat.aimError < 0.006 && (!wk || Math.abs(v.body.speed) < 1.2)) {
      if (!W || !W.lineOfSight || W.lineOfSight(_c, targetPoint(t, _d))) {
        it.fire = true; it.firePressed = true;
        this.shots++; this.cool = 1.5;
      }
    }
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
