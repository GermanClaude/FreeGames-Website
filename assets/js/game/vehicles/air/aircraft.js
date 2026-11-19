// NULLPUNKT — Luftfahrzeug-Entität (Hubschrauber/Jet): erbt Sitze, Absichten, Schaden mit Zonen, Reparatur und Wrack von
// Vehicle (vehicle.js), ersetzt Körper (air/flight.js AirBody), Modell (air/models.js), Takt (Flugsteuerung, Waffen,
// Täuschkörper, Luftstart, Aufprall/Absturz, Rauch, Rotorabwind) und Darstellung (Rotor, Ruder, Fahrwerk, Nachbrenner).
//
// Pilot-Absicht (seat.intent, zusätzlich zu newIntent): throttle (Kollektiv bzw. Schubhebel ±), steer (Heckrotor/Seitenruder),
//   pitch (+ Nase hoch), roll (+ rechts), level (Schwebe-Assistent / Lage halten), boost (Nachbrenner), flare (Täuschkörper),
//   brake (Luftbremse/Radbremse). Spieler: air/controls.js; Bots: air/pilot-ai.js; Netz: vehicles/net.js (VEH_INPUT).
import * as THREE from 'three';
import { Vehicle } from '../vehicle.js?v=20261119182451';
import { AirBody, groundBelow } from './flight.js?v=20261119182451';
import { createAirModel } from './models.js?v=20261119182451';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3();
const _q = new THREE.Quaternion(), _iq = new THREE.Quaternion(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const DUST = [0.47, 0.42, 0.33];
const FLARES = { heli: 8, jet: 8 };
const FLARE_GAP = 1.1, FLARE_REGEN = 9;

export class Aircraft extends Vehicle {
  constructor(sys, type, opts = {}) {
    super(sys, type, opts);
    this.isAircraft = true;
    this.air = this.def.air;
    const n = FLARES[this.air] || 6;
    this.flares = { left: n, max: n, readyAt: 0, regenT: 0 };
    this.flareUntil = -1e9;
    this.threat = 0;          // anfliegende Lenkrakete (Warnung im HUD), von air/index.js gesetzt
    this.launched = !!opts.airborne;
    this.launchAt = null;
    this.zoneWarn = 0;        // s außerhalb des Luftraums
    this.zoneReturn = false;  // Rückkehr-Autopilot aktiv
    this._rotor = 0; this._tail = 0;
    this._dustT = 0; this._smokeT = 0;
    this._crashed = false;
    this._gear = 1;
    if (opts.airborne) this.body.setPose(opts.position, opts.yaw || 0, { airborne: true, speed: opts.speed || 0 });
  }

  _makeBody(def) { return new AirBody(def); }
  _makeModel(type, opts) { return createAirModel(type, opts); }

  get pilot() { return this.seats[0] ? this.seats[0].actor : null; }
  get airborne() { return !this.body.onGround; }

  /* --------------------------------------------------------------- Lafetten */

  _mountLocal(seat, wIndex, outPos, outDir) {
    if (seat.def.mount !== 'fixed') return super._mountLocal(seat, wIndex, outPos, outDir);
    const w = seat.weapons[wIndex];
    const hp = (w && w.def.hp) || [[0, 1.5, -6]];
    outPos.fromArray(hp[(w ? w.shots : 0) % hp.length]);
    if (w && w.def.kind === 'bomb') outDir.set(0, -1, 0);
    else outDir.set(0, 0, -1);
  }

  _aimSeat(seat, dt) {
    if (seat.def.mount === 'fixed') {
      seat.aimError = 0;
      this.body.forward(seat.aimWant);
      return;
    }
    super._aimSeat(seat, dt);
    const L = this.def.mgYawLimit;
    if (seat.def.mount === 'mg' && L) {
      const m = this.mount;
      if (Math.abs(m.mgYaw) > L) {
        m.mgYaw = clamp(m.mgYaw, -L, L);
        this.muzzle(seat.index, _ro, _rd);
        if (this._aimDir.lengthSq() > 0.5) seat.aimError = Math.acos(clamp(_rd.dot(this._aimDir), -1, 1));
      }
    }
  }

  /* --------------------------------------------------------------- Treffer */

  zoneAt(local) {
    for (const bx of this.def.boxes || []) {
      if (Math.abs(local.x - bx[0]) <= bx[3] + 0.02 && Math.abs(local.y - bx[1]) <= bx[4] + 0.02 && Math.abs(local.z - bx[2]) <= bx[5] + 0.02 && bx[6] !== 'hull') return bx[6];
    }
    return 'hull';
  }

  /** Strahl gegen alle Trefferquader (Rumpf, Ausleger, Flügel, Leitwerk). */
  raycast(origin, dir, maxDist = 1000) {
    if (!this.model.root.parent) return null;
    const def = this.def, b = this.body;
    const r = Math.hypot(def.hullBox[5] + 4, 6);
    _a.copy(b.pos).sub(origin);
    const tca = _a.dot(dir);
    if (tca < -r || _a.lengthSq() - tca * tca > r * r || tca - r > maxDist) return null;
    _iq.copy(b.quat).invert();
    b.toLocal(origin, _ro);
    _rd.copy(dir).applyQuaternion(_iq);
    let best = null, zone = 'hull';
    for (const bx of def.boxes || [def.hullBox]) {
      const h = rayBox(_ro, _rd, bx[0], bx[1], bx[2], bx[3], bx[4], bx[5], best ? best.t : maxDist);
      if (h) { best = h; zone = bx[6] || 'hull'; }
    }
    if (!best) return null;
    const ln = _n.set(best.nx, best.ny, best.nz);
    const face = ln.y > 0.7 ? 'top' : ln.z < -0.7 ? 'front' : ln.z > 0.7 ? 'rear' : 'side';
    const point = new THREE.Vector3().copy(origin).addScaledVector(dir, best.t);
    const normal = ln.clone().applyQuaternion(b.quat);
    return { distance: best.t, point, normal, surface: 'metal', object: this.model.root, vehicle: this, zone, face, localNormal: ln.clone() };
  }

  /* --------------------------------------------------------------- Zerstörung */

  destroy(by = null, weaponId = null) {
    if (!this.alive) return;
    const G = this.G;
    this.alive = false;
    this.health = 0;
    this.disabled = true;
    this.wreck = true;
    this.wreckLeft = this.def.wreckTime;
    const center = this.body.pos.clone();
    for (const s of this.seats) {
      const a = s.actor;
      if (!a) continue;
      this.sys.removeFromSeat(a, { teleport: false });
      if (!a.alive) continue;
      let dealt = 0;
      if (by && G.combat.isHostile(by, a)) dealt = G.combat.damage(a, { amount: 999, attacker: by, weaponId: weaponId || 'vehicle_explosion', explosive: true, point: center, zone: 'body' });
      if (a.alive && !dealt) G.combat.damage(a, { amount: 999, attacker: null, weaponId: 'vehicle_explosion', explosive: true, point: center, zone: 'body' });
    }
    this.sys.ownExplosion(() => G.combat.explode({ position: center, radius: 7, maxDamage: 90, attacker: by, weaponId: 'vehicle_explosion', type: 'frag' }));
    G.effects?.explosion?.(center, 7, { big: true });
    this.model.setWreck(true);
    this.body.input.dead = true;
    this.body.input.power = false;
    this._crashed = this.body.onGround && this.body.vel.length() < 4;
    for (const s of this.seats) s.intent.fire = false;
    G.events.emit('vehicle:destroyed', { vehicle: this, by, weaponId: weaponId || null });
  }

  /* --------------------------------------------------------------- Takt */

  update(dt, world) {
    const G = this.G, def = this.def, b = this.body, now = G.time.elapsed, F = def.flight;
    const ds = this.seats[0];
    const I = b.input;
    const live = this.sys.live;
    const pilot = ds && ds.actor;
    I.dead = !this.alive;
    I.power = this.alive && !!pilot;
    if (this.alive && pilot && live && !(ds.readyAt > now)) {
      const it = ds.intent;
      I.col = clamp(+it.throttle || 0, -1, 1);
      I.yaw = clamp(+it.steer || 0, -1, 1);
      I.pitch = clamp(+it.pitch || 0, -1, 1);
      I.roll = clamp(+it.roll || 0, -1, 1);
      I.level = !!it.level;
      I.boost = !!it.boost;
      I.brake = it.brake > 0;
      if (it.flare) this.deployFlares();
    } else {
      I.col = 0; I.yaw = 0; I.pitch = 0; I.roll = 0; I.boost = false; I.brake = true;
      I.level = this.alive && !!pilot; // Startsperre/Wechsel: Lage halten
      if (!pilot && this.air === 'jet' && !b.onGround) b.thr = Math.max(0, b.thr - dt * 0.2);
    }
    // Skript-Autopilot (air.fly): überschreibt die Pilotensteuerung
    const ap = this.autopilot;
    if (ap && this.alive && pilot && live) {
      if (ap.hover) { I.col = clamp(((ap.alt ?? 40) - b.agl) * 0.08, -1, 1); I.pitch = 0; I.roll = 0; I.yaw = 0; I.level = true; }
      else this.steerToward(I, ap.to.x, ap.to.z, ap.alt ?? (this.air === 'jet' ? 200 : 60), ap.speed ?? null);
    }
    this._airspace(dt, world);
    // Jet: Luftstart nach dem Einsteigen (Karten ohne Startbahn; world.runway → Start vom Boden, Flugplatz)
    if (this.air === 'jet' && this.alive && pilot && b.onGround && live && F.airStart && !(world && world.runway)) {
      if (this.launchAt == null) { this.launchAt = now + 1.4; G.events.emit('vehicle:airstart', { vehicle: this, phase: 'bereit', at: this.launchAt }); }
      else if (now >= this.launchAt) this.airStart(world);
    } else if (!pilot || !b.onGround) this.launchAt = null;
    // Startbahn-Karte: einmaliger Hinweis für den Spieler am Steuer (Start vom Boden)
    if (this.air === 'jet' && pilot && pilot === G.player && b.onGround && world && world.runway && !this._rwHint) {
      this._rwHint = true;
      this.sys._flash?.('Start von der Bahn: Schub W, Nachbrenner Umschalt, ab ≈ 250 km/h Nase hoch');
    }
    // Schäden → Flugleistung
    const Z = this.zones;
    const eng = Z.engine && Z.engine.hp <= 0, tail = Z.tracks && Z.tracks.hp <= 0;
    b.mult.thrust = eng ? 0.62 : this.disabled ? 0.85 : 1;
    b.mult.yawSpin = tail ? (this.air === 'heli' ? 1.6 : 0.6) : 0;
    b.mult.control = this.air === 'jet' && tail ? 0.6 : 1;
    // Waffen
    if (this.alive) {
      this._proxyGunner();
      for (const s of this.seats) {
        if (!s.actor && !s.proxy) { s.intent.fire = false; continue; }
        if (now < (s.readyAt || 0)) { s.intent.fire = s.intent.firePressed = false; s.intent.reload = false; continue; }
        this._aimSeat(s, dt);
        this._updateWeapons(s, dt);
      }
      // Kinnturm ohne Schützen: Grundstellung
      const gs = this.seats.find((s) => s.def.mount === 'mg');
      if (gs && !gs.actor && !gs.proxy) {
        this.mount.mgYaw += (0 - this.mount.mgYaw) * Math.min(1, dt * 2);
        this.mount.mgPitch += (-0.04 - this.mount.mgPitch) * Math.min(1, dt * 2);
      }
      // Täuschkörper nachladen
      const fl = this.flares;
      if (fl.left < fl.max) { fl.regenT += dt; if (fl.regenT >= FLARE_REGEN) { fl.regenT = 0; fl.left++; } } else fl.regenT = 0;
    }
    // Flug
    b.update(dt, world);
    const imp = b.takeImpact();
    if (this.alive) {
      const lim = this.air === 'heli' ? 5.5 : 5;
      if (imp > lim) {
        const dmg = imp > 17 ? 9999 : (imp - lim) * (this.air === 'heli' ? 52 : 68);
        this.applyDamage(dmg, { kind: 'collision', zone: 'hull', weaponId: 'vehicle_crash' });
        G.events.emit('vehicle:collide', { vehicle: this, speed: imp, position: b.pos.clone() });
      }
      if (b.rotorStrike) this.applyDamage(9999, { kind: 'collision', zone: 'hull', weaponId: 'vehicle_crash' });
      // auf dem Kopf am Boden → Absturz
      if (b.upsideDown > 1.5) this.applyDamage(9999, { kind: 'collision', zone: 'hull', weaponId: 'vehicle_crash' });
    } else if (!this._crashed && (b.onGround || imp > 2)) {
      // Wrack schlägt auf: zweite Explosion (ohne Kill-Zuschreibung an Unbeteiligte)
      this._crashed = true;
      const p = b.pos.clone();
      G.effects?.explosion?.(p, 6, { big: true });
      this.sys.audio.play('explosion', { position: p, volume: 1, pitch: 0.85, priority: 3 });
      this.sys.ownExplosion(() => G.combat.explode({ position: p, radius: 6, maxDamage: 70, attacker: this.lastAttacker || null, weaponId: 'vehicle_crash', type: 'frag' }));
      b.vel.multiplyScalar(0.25);
    }
    b.rotorStrike = false;
    const bounds = world && world.bounds;
    if (bounds && this.alive && b.pos.y < bounds.min.y - 15) this.destroy(this.lastAttacker, this.lastWeaponId);
    // Brand (Rumpf < 20 %) – wie Bodenfahrzeuge
    if (this.alive && this.disabled) {
      this._burnAcc += dt * 4;
      if (this._burnAcc >= 1) { const k = Math.floor(this._burnAcc); this._burnAcc -= k; this.applyDamage(k, { kind: 'fire', attacker: this.lastAttacker, weaponId: this.lastWeaponId || 'vehicle_explosion' }); }
    }
    this._effects(dt);
    if (this.wreck) this.wreckLeft -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 3.2);
  }

  /** Bot-Pilot bedient den freien Kinnturm stellvertretend (pilot-ai.js schreibt dann gs.intent). */
  _proxyGunner() {
    const gs = this.seats.find((s) => s.def.mount === 'mg');
    if (!gs) return;
    const p = this.pilot;
    const bot = p && !p.isPlayer && !p.isRemoteHuman ? p : null;
    const want = !gs.actor && bot ? bot : null;
    if (gs.proxy !== want) { gs.proxy = want; if (want) gs.intent.fireWhenAligned = true; }
  }

  /** Täuschkörper-Salve (Rate, Vorrat). → true, wenn ausgelöst */
  deployFlares({ net = false } = {}) {
    const fl = this.flares, now = this.G.time.elapsed;
    if (!this.alive || (!net && (fl.left <= 0 || now < fl.readyAt))) return false;
    if (!net) { fl.left--; fl.readyAt = now + FLARE_GAP; }
    this.flareUntil = now + 2.6;
    this.G.events.emit('vehicle:flare', { vehicle: this, net });
    return true;
  }

  /** Luftstart: in Höhe über dem Kartenrand hinter der eigenen Seite, Nase zur Kartenmitte. */
  airStart(world = this.sys.world) {
    const F = this.def.flight, S = F.airStart || { alt: 220, speed: 120, edge: 120 };
    const b = this.body;
    const c = world && world.bounds ? world.bounds.getCenter(_a) : _a.set(0, 0, 0);
    const o = b.origin(_b);
    _d.set(c.x - o.x, 0, c.z - o.z);
    if (_d.lengthSq() < 1) _d.set(0, 0, -1);
    _d.normalize();
    const start = _c.copy(o).addScaledVector(_d, -(S.edge || 0));
    const g = groundBelow(world, start.x, 600, start.z, 1200);
    start.y = Math.max(g == null ? 0 : g, o.y) + S.alt;
    const yaw = Math.atan2(-_d.x, -_d.z);
    b.setPose(start, yaw, { airborne: true, speed: S.speed });
    b.thr = 0.8;
    this.launched = true;
    this.launchAt = null;
    this.G.events.emit('vehicle:airstart', { vehicle: this, phase: 'start' });
  }

  /** Luftraum: Rand der Karte + Rand (Jet 650 m, Hubschrauber 120 m) → Warnung, danach Rückkehr-Autopilot. */
  _airspace(dt, world) {
    const bounds = world && world.bounds;
    if (!bounds || !this.alive) { this.zoneWarn = 0; this.zoneReturn = false; return; }
    const M = this.air === 'jet' ? (this.def.flight.zoneMargin || 650) : 120;
    const p = this.body.pos;
    const out = Math.max(bounds.min.x - p.x, p.x - bounds.max.x, bounds.min.z - p.z, p.z - bounds.max.z);
    if (out > M) this.zoneWarn += dt; else this.zoneWarn = Math.max(0, this.zoneWarn - dt * 2);
    if (out > M + 120 || this.zoneWarn > 5) this.zoneReturn = true;
    else if (out < M * 0.6) this.zoneReturn = false;
    if (!this.zoneReturn || !this.pilot) return;
    const c = bounds.getCenter(_a);
    this.steerToward(this.body.input, c.x, c.z, this.air === 'jet' ? null : 40);
  }

  /** Einfacher Autopilot (Luftraum-Rückkehr, KI): Kurs auf (x, z), Höhe über Grund alt (null = halten). Schreibt body.input. */
  steerToward(I, x, z, alt = null, speed = null) {
    const b = this.body;
    const att = b.attitude(this._att || (this._att = {}));
    const want = Math.atan2(-(x - b.pos.x), -(z - b.pos.z));
    const dy = wrap(want - att.yaw);
    if (this.air === 'jet') {
      const bank = clamp(dy * 1.4, -1.05, 1.05);
      I.roll = clamp((att.roll - bank) * 1.6, -1, 1); // Querlage + = links; roll-Eingabe + = rechts
      const climb = alt == null ? -b.vel.y * 0.04 : clamp((alt - b.agl) * 0.01, -0.3, 0.35) - b.vel.y * 0.02;
      I.pitch = clamp((climb - att.pitch) * 2 + Math.abs(att.roll) * 0.35, -1, 1);
      I.yaw = 0;
      I.col = speed == null ? (b.speed < 110 ? 1 : b.speed > 150 ? -0.5 : 0) : clamp((speed - b.speed) * 0.05, -1, 1);
      I.level = false;
    } else {
      I.yaw = clamp(-dy * 1.6, -1, 1);
      const sp = speed == null ? 40 : speed;
      this.body.forward(_d);
      const vf = b.vel.x * _d.x + b.vel.z * _d.z;
      const pT = Math.abs(dy) > 0.6 ? 0 : clamp(-(sp - vf) * 0.012, -0.5, 0.25);
      I.pitch = clamp((pT - att.pitch) * 2.5, -1, 1);
      I.roll = clamp(att.roll * 2, -1, 1);
      I.col = alt == null ? 0 : clamp((alt - b.agl) * 0.08, -1, 1);
      I.level = false;
    }
  }

  _effects(dt) {
    const G = this.G, E = G.effects, b = this.body;
    if (!E) return;
    const q = this.sys.quality || 'high';
    // Rauch bei schwerem Schaden / Wrack
    this._smokeT -= dt;
    if ((this.disabled || this.wreck) && this._smokeT <= 0) {
      this._smokeT = this.wreck ? 0.14 : 0.1;
      const src = this.air === 'heli' ? [0, 3.1, 0.6] : [0, 2.0, 6.4];
      b.toWorldRender(_a.fromArray(src), _a);
      const fresh = this.wreck && this.wreckLeft > this.def.wreckTime - 10;
      E.smoke?.(_a, { count: fresh ? 3 : 2, color: 0x1c1a18, size: fresh ? 2.6 : 1.8, life: 4, rise: 2.2, alpha: 0.55 });
      if (fresh || !this.wreck) E.smoke?.(_a, { count: 1, color: 0xff7a2a, size: 1.0, life: 0.6, rise: 2.5, alpha: 0.45 });
    }
    // Rotorabwind: Staubring am Boden unter dem Hubschrauber
    if (this.air === 'heli' && b.rpm > 0.45 && b.agl < 22 && typeof E._puff === 'function') {
      this._dustT -= dt;
      if (this._dustT <= 0) {
        this._dustT = q === 'low' ? 0.12 : q === 'medium' ? 0.07 : 0.045;
        const k = (1 - b.agl / 22) * b.rpm;
        const n = q === 'low' ? 2 : 4;
        b.origin(_b);
        const gy = b.groundY + 0.25;
        for (let i = 0; i < n; i++) {
          const ang = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 7;
          const cx = Math.cos(ang), cz = Math.sin(ang);
          const sp = (6 + Math.random() * 8) * k;
          try {
            E._puff(_b.x + cx * r, gy, _b.z + cz * r, cx * sp, 0.4 + Math.random() * 0.8, cz * sp, 1.2 + Math.random() * 1.2, 0.8, 2.6 + Math.random() * 2.2 * k, DUST, 0.32 * k + 0.08, 1.1, 0.25);
          } catch { /* Effekte nicht bereit */ }
        }
      }
    }
  }

  /* --------------------------------------------------------------- Darstellung */

  sync(dt) {
    const b = this.body, M = this.model, m = this.mount;
    _a.copy(b.com).negate().applyQuaternion(b.renderQuat).add(b.renderPos);
    M.root.position.copy(_a);
    M.root.quaternion.copy(b.renderQuat);
    const rep = this.sys.replica;
    const rpm = rep ? (b.drive.rpmNorm || 0) : b.rpm;
    if (this.air === 'heli') {
      this._rotor = (this._rotor + rpm * 27 * dt) % (Math.PI * 2);
      this._tail = (this._tail + rpm * 110 * dt) % (Math.PI * 2);
      M.setRotor?.(this._rotor, this._tail, rpm, this.alive);
    } else {
      const I = b.input, na = this._netAir;
      const thr = rep ? (na ? na.thr : 0.7) : b.thr, ab = rep ? (na ? na.ab : 0) : b.ab;
      // Fahrwerk: ein bei Fahrt > 75 m/s und Höhe > 20 m, aus darunter
      const want = b.onGround || (b.agl < 20 && b.speed < 90) ? 1 : 0;
      this._gear += clamp(want - this._gear, -dt * 0.6, dt * 0.6);
      M.setJet?.({ thr: thr * rpm, ab, gear: this._gear, pitch: rep ? 0 : I.pitch, roll: rep ? 0 : I.roll, yaw: rep ? 0 : I.yaw, brake: !rep && I.brake && !b.onGround });
    }
    if (M.mg) M.mg.rotation.set(m.mgPitch, m.mgYaw, 0, 'YXZ');
    if (M.occ.length) this._syncOccupants();
    if (M.lightsOn !== this.lights) M.setLights(this.lights);
    this._syncCrew(dt);
  }
}

/** Strahl gegen achsparallelen Quader (lokal). → { t, nx, ny, nz } | null (wie vehicle.js) */
function rayBox(o, d, cx, cy, cz, hx, hy, hz, maxT) {
  let tmin = 0, tmax = maxT, nx = 0, ny = 0, nz = 0;
  const ax = [[o.x, d.x, cx, hx, 0], [o.y, d.y, cy, hy, 1], [o.z, d.z, cz, hz, 2]];
  for (const [oo, dd, c, h, k] of ax) {
    const lo = c - h, hi = c + h;
    if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return null; continue; }
    let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd, s = -1;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
    if (t1 > tmin) { tmin = t1; nx = ny = nz = 0; if (k === 0) nx = s; else if (k === 1) ny = s; else nz = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmin <= 0) return null;
  return { t: tmin, nx, ny, nz };
}
void _q;
