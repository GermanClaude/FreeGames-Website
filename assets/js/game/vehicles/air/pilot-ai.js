// NULLPUNKT — KI-Pilot für den Hubschrauber (einfach): Abheben, Umkreisen eines Einsatzpunkts (Flaggen/Kartenmitte) in
// sicherer Höhe, Ziele suchen (feindliche Infanterie und besetzte Fahrzeuge mit Sichtlinie), Anflug bis Kampfentfernung,
// Nase aufs Ziel, Raketen in kurzen Salven, Kinnturm (stellvertretend, wenn kein Schütze an Bord) mit Streuung nach
// Entfernung; bei Raketenwarnung Täuschkörper + Ausweichen, unter 30 % Rumpf Rückzug zur Basis. Bodenabstand über
// Vorausschau (Gelände in Flugrichtung). Schreibt nur die Sitz-Absicht (intent) wie ein Spieler – Netz/Host unverändert.
// Nutzer 20.11. („sollen nicht die ganze Zeit zielen und jeden Treffer landen“): Im normalen Spiel fliegt keine KI mehr
// (air/policy.js); die KI bleibt für Story-Figuren der Kampagne (M15 Begleithubschrauber) und ist bewusst schwach:
// erst ≈ 3 s Zielauffassung mit Vorwarnung an den Spieler, wandernder Zielfehler (≈ 2–3,5° je nach Entfernung),
// kurze Salven mit langen Pausen, Kanone nur in Feuerstößen mit großer Streuung.
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
    this._lockT = 0;          // Zielauffassung (s) – erst danach Feuer
    this._warnAt = -1e9;      // letzte Vorwarnung an den Spieler
    this._off = new THREE.Vector3(); this._offT = 0; // wandernder Zielfehler
    this._gunT = 0; this._gunOn = 0; // Feuerstöße der Kanone
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

  /** Zielt die KI gerade auf den Spieler (zu Fuß oder sein Fahrzeug)? */
  _aimsAtPlayer() {
    const t = this.target, P = this.G.player;
    if (!t || !P) return false;
    return t.actor === P || !!(t.vehicle && t.vehicle.seats && t.vehicle.seats.some((s) => s.actor === P));
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
        // Zielfehler: alle 1,2–2 s neu gewürfelt, proportional zur Entfernung (Rakete/Kanone verfehlen öfter)
        const dd = tp.distanceTo(b.pos);
        this._offT -= dt;
        if (this._offT <= 0) {
          this._offT = 1.2 + Math.random() * 0.8;
          const k = dd * (0.035 + Math.random() * 0.025);
          this._off.set((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * 2 * k);
        }
        tp.add(this._off);
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
        // Zielauffassung mit Vorwarnung (Spieler bzw. sein Fahrzeug im Visier)
        if (dist < 700 && err < 0.2) this._lockT += dt; else this._lockT = Math.max(0, this._lockT - dt * 2);
        const locked = this._lockT > 2.8;
        if (this._lockT > 0.2 && now - this._warnAt > 9 && this._aimsAtPlayer()) {
          this._warnAt = now;
          try { G.events.emit('mode:notice', { text: 'Feindlicher Hubschrauber nimmt dich ins Visier – Deckung!', tone: 'enemy' }); } catch { /* */ }
        }
        if (this._pause > 0) this._pause -= dt;
        else if (locked && dist < 650 && err < 0.07) {
          it.weapon = 0;
          it.fire = true;
          this._burst += dt;
          if (this._burst > 0.25) { this._burst = 0; this._pause = 5 + Math.random() * 3.5; }
        }
        // Kanone: Feuerstöße 0,6–0,9 s, dann 2,5–4 s Pause
        this._gunT -= dt;
        if (this._gunT <= 0) { this._gunOn = 0.6 + Math.random() * 0.3; this._gunT = this._gunOn + 2.5 + Math.random() * 1.5; }
        const gunBurst = locked && (this._gunOn -= dt) > 0;
        if (gun) {
          const spread = dist * (0.03 + 0.03 * Math.random());
          gun.aimAt = (gun.aimAt || new THREE.Vector3()).copy(tp).add(_e.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread * 0.5, (Math.random() - 0.5) * spread));
          gun.aimDir = null;
          gun.fire = gunBurst && dist < 700;
          gun.fireWhenAligned = true;
        } else if (gunBurst && dist < 600 && err < 0.05 && this._pause <= 0) { it.weapon = 1; it.fire = true; }
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
