// NULLPUNKT — KI-Pilot für den Hubschrauber (einfach): Abheben, Umkreisen eines Einsatzpunkts (Flaggen/Kartenmitte) in
// sicherer Höhe, Ziele suchen (feindliche Infanterie und besetzte Fahrzeuge mit Sichtlinie), Anflug bis Kampfentfernung,
// Nase aufs Ziel, Raketen in kurzen Salven, Kinnturm (stellvertretend, wenn kein Schütze an Bord) mit Streuung nach
// Entfernung; bei Raketenwarnung Täuschkörper + Ausweichen, unter 30 % Rumpf Rückzug zur Basis. Bodenabstand über
// Vorausschau (Gelände in Flugrichtung). Schreibt nur die Sitz-Absicht (intent) wie ein Spieler – Netz/Host unverändert.
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _e = new THREE.Vector3();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export class HeliPilotAI {
  constructor(air, v, bot) {
    this.air = air;
    this.G = air.G;
    this.v = v;
    this.bot = bot;
    this.state = 'start';
    this.target = null;
    this.home = v.body.origin(new THREE.Vector3());
    this.orbit = null;
    this.orbitA = Math.random() * Math.PI * 2;
    this._scanT = 0;
    this._burst = 0;
    this._pause = 0;
    this._I = { col: 0, yaw: 0, pitch: 0, roll: 0, level: false };
    this.done = false;
  }

  /** Einsatzpunkt: nächste nicht eigene Flagge (Modi mit Zielen), sonst Kartenmitte. */
  _pickOrbit() {
    const G = this.G, w = G.world;
    const objs = (G.mode && typeof G.mode.objectives === 'function' && G.mode.objectives()) || (w && w.objectives) || null;
    let best = null;
    if (Array.isArray(objs) && objs.length) {
      const team = this.bot.team;
      const list = objs.filter((o) => o && o.position && o.owner !== team);
      const pool = list.length ? list : objs.filter((o) => o && o.position);
      if (pool.length) best = pool[Math.floor(Math.random() * pool.length)].position;
    }
    if (!best && w && w.bounds) best = w.bounds.getCenter(new THREE.Vector3());
    return best ? best.clone() : new THREE.Vector3();
  }

  _scan(now) {
    const G = this.G, v = this.v, bot = this.bot, W = G.world;
    this._scanT = now + 0.6;
    const p = v.body.pos;
    let best = null, bd = 520;
    const los = (pt) => !W || !W.lineOfSight || W.lineOfSight(_e.copy(p).add(_b.set(0, -1.6, 0)), pt);
    for (const a of G.actors) {
      if (!a || !a.alive || a.vehicle || !G.combat || !G.combat.isHostile(bot, a)) continue;
      const d = a.position.distanceTo(p);
      if (d >= bd) continue;
      if (!los(_a.copy(a.position).setY(a.position.y + 1.2))) continue;
      bd = d; best = { actor: a, vehicle: null };
    }
    for (const o of this.air.sys.list) {
      if (o === v || !o.alive || o.wreck || !o.isOccupied || !o.hostileTo(bot)) continue;
      const d = o.body.pos.distanceTo(p) * (o.isAircraft ? 0.8 : 0.9); // Fahrzeuge bevorzugt
      if (d >= bd) continue;
      if (!los(o.body.pos)) continue;
      bd = d; best = { actor: null, vehicle: o };
    }
    this.target = best;
  }

  _targetPos(out) {
    const t = this.target;
    if (!t) return null;
    if (t.vehicle) { if (!t.vehicle.alive) { this.target = null; return null; } return out.copy(t.vehicle.body.pos); }
    if (!t.actor.alive || t.actor.vehicle) { this.target = null; return null; }
    return out.copy(t.actor.position).setY(t.actor.position.y + 1.1);
  }

  update(dt) {
    const G = this.G, v = this.v, bot = this.bot, b = v.body, now = G.time.elapsed;
    if (!v.alive || !bot.alive || bot.vehicle !== v || v.seatOf(bot) !== 0) { this.done = true; return; }
    const seat = v.seats[0], it = seat.intent, I = this._I;
    const gs = v.seats.find((s) => s.def.mount === 'mg');
    const gun = gs && gs.proxy === bot ? gs.intent : null;
    it.fire = false; it.flare = false;
    if (gun) gun.fire = false;
    if (G.match && G.match.state !== 'playing') { it.throttle = 0; it.level = true; return; }
    // Zustand
    if (v.threat > now) { it.flare = true; this.evadeUntil = now + 2.5; }
    if (v.health < v.maxHealth * 0.3) this.state = 'rueckzug';
    else if (this.state === 'start' && b.agl > 30) this.state = 'patrouille';
    if (now >= this._scanT && this.state !== 'start') this._scan(now);
    const tp = this._targetPos(_a);
    if (tp && this.state === 'patrouille') this.state = 'angriff';
    if (!tp && this.state === 'angriff') this.state = 'patrouille';
    // Sollhöhe mit Geländevorausschau
    let alt = this.state === 'angriff' ? 45 : 70;
    const ahead = _b.copy(b.pos).addScaledVector(b.vel, 3);
    const W = G.world;
    if (W && typeof W.heightAt === 'function') {
      const ga = W.heightAt(ahead.x, ahead.z), g0 = b.groundY;
      if (Number.isFinite(ga) && ga > g0) alt += ga - g0;
    }
    if (this.evadeUntil > now) alt += 25;
    switch (this.state) {
      case 'start':
        I.col = 0.8; I.yaw = 0; I.pitch = 0; I.roll = 0; I.level = true;
        break;
      case 'patrouille': {
        if (!this.orbit || (this._orbitT || 0) < now) { this.orbit = this._pickOrbit(); this._orbitT = now + 45; }
        this.orbitA += dt * 0.12;
        const R = 140;
        v.steerToward(I, this.orbit.x + Math.cos(this.orbitA) * R, this.orbit.z + Math.sin(this.orbitA) * R, alt, 34);
        break;
      }
      case 'angriff': {
        const d = Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z);
        const sp = d > 380 ? 32 : d < 160 ? -6 : 6;
        v.steerToward(I, tp.x, tp.z, alt, sp);
        // seitlich versetzen (kein stehendes Ziel)
        if (d < 380) I.roll = clamp(I.roll + Math.sin(now * 0.7) * 0.35, -1, 1);
        // Feuer: Raketen bei ausgerichteter Nase, Kanone über den Turm
        b.forward(_e);
        const to = _b.copy(tp).sub(b.pos);
        const dist = to.length();
        to.multiplyScalar(1 / Math.max(1e-3, dist));
        const err = Math.acos(clamp(_e.dot(to), -1, 1));
        if (this._pause > 0) this._pause -= dt;
        else if (dist < 650 && err < 0.07) {
          it.weapon = 0;
          it.fire = true;
          this._burst += dt;
          if (this._burst > 0.45) { this._burst = 0; this._pause = 2.5 + Math.random() * 2; }
        }
        if (gun) {
          const spread = dist * (0.012 + 0.01 * Math.random());
          gun.aimAt = (gun.aimAt || new THREE.Vector3()).copy(tp).add(_e.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread * 0.5, (Math.random() - 0.5) * spread));
          gun.aimDir = null;
          gun.fire = dist < 750;
          gun.fireWhenAligned = true;
        } else if (dist < 600 && err < 0.05 && this._pause <= 0) { it.weapon = 1; it.fire = true; }
        break;
      }
      case 'rueckzug':
      default:
        v.steerToward(I, this.home.x, this.home.z, alt, 40);
    }
    if (this.evadeUntil > now) { I.roll = clamp(I.roll + 0.8 * Math.sign(Math.sin(now * 1.3)), -1, 1); I.col = Math.max(I.col, 0.6); }
    // in Absicht schreiben (wie ein Spieler)
    it.throttle = clamp(I.col, -1, 1);
    it.steer = clamp(I.yaw, -1, 1);
    it.pitch = clamp(I.pitch, -1, 1);
    it.roll = clamp(I.roll, -1, 1);
    it.level = !!I.level;
    void wrap;
  }
}
