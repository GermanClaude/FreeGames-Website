// NULLPUNKT — Flugmodelle der Luftfahrzeuge (air/data.js def.flight). AirBody hat dieselbe Schnittstelle wie
// VehicleBody (sim.js: pos/quat/vel/angVel/com, render*, toWorld/toLocal, applyImpulse, controls/mods/drive, wake …),
// damit Sitze, Treffer, Netz (vehicles/net.js), Kamera und HUD unverändert darauf zugreifen können.
//
// Fester 60-Hz-Schritt mit Interpolation (wie sim.js). Eingaben schreibt Aircraft (aircraft.js) je Bild in body.input:
//   { power (Triebwerk an), col (−1…1: Hubschrauber Steig-/Sinkwunsch, Jet Schubhebel-Änderung), yaw (−1…1, + = rechts),
//     pitch (−1…1, + = Nase hoch), roll (−1…1, + = rechts), level (Schwebe-Assistent), boost (Nachbrenner), brake }
//
// Hubschrauber (vereinfacht, spielbar): Zyklisch = Neigungsrate mit Lagehaltung (Steuer los → Lage bleibt; Leertaste
//   „Schweben“ richtet auf und bremst ab), Kollektiv = Steig-/Sinkrate (Steuer los → hält die Höhe), Heckrotor = Gierrate,
//   koordinierte Kurve aus der Querneigung. Schub = Rotorebene × Drehzahl² (Hochlauf spool s), Bodeneffekt unter ~1,2 R,
//   Auftriebsgewinn im Vorwärtsflug, Widerstand linear + quadratisch. Heckrotor kaputt → Drehen um die Hochachse,
//   Triebwerk kaputt → weniger Schub. Rotorschlag: Strahlen in der Rotorebene gegen die Welt.
// Jet (arcade-nah): Schub (Spule) + Nachbrenner, Auftrieb aus Anstellwinkel (CL = cla·α bis α_krit, darüber Abriss mit
//   Auftriebsverlust und Nase-runter), induzierter + Grundwiderstand, Seitenkraft gegen Schieben, Lastvielfaches-Grenze,
//   Ratensteuerung (Rollen/Nicken/Gieren) mit Wirksamkeit nach Staudruck, Lagehaltung bei losgelassenem Steuer.
// Boden: Fahrwerkspunkte (def.gear) gegen Gelände/Kollision, Reibung, harte Landung → impact (Schaden in aircraft.js).
import * as THREE from 'three';
import { collisionRay } from '../../engine/physics.js?v=20261123082814';
import { groundRay } from '../sim.js?v=20261123082814';

export const STEP = 1 / 60;
export const G_AIR = 9.81;
const MAX_STEPS = 5;
const RHO = 1.225;
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3();
const _u = new THREE.Vector3(), _r = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _hit = { distance: 0, nx: 0, ny: 1, nz: 0 };
const _q = new THREE.Quaternion(), _iq = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Höhe des Bodens unter (x, z) bis maxDown unter y (Gelände + Kollisionsgeometrie). → y | null */
export function groundBelow(world, x, y, z, maxDown = 400) {
  if (!world) return null;
  const hit = groundRay(world, _a.set(x, y, z), DOWN, maxDown, _hit);
  return hit ? y - hit.distance : null;
}

export class AirBody {
  constructor(def) {
    this.def = def;
    this.F = def.flight;
    this.kind = this.F.kind;
    this.mass = def.mass;
    const hb = def.hullBox;
    const sx = hb[3] * 2, sy = hb[4] * 2, sz = hb[5] * 2, m = def.mass;
    this.inertia = new THREE.Vector3(m / 12 * (sy * sy + sz * sz), m / 12 * (sx * sx + sz * sz), m / 12 * (sx * sx + sy * sy)).multiplyScalar(1.6);
    this.com = new THREE.Vector3().fromArray(def.com);
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.vel = new THREE.Vector3();
    this.angVel = new THREE.Vector3();
    this.rate = new THREE.Vector3(); // Körperraten (Nicken x, Gieren y, Rollen z) – Jet
    this.prevPos = new THREE.Vector3();
    this.prevQuat = new THREE.Quaternion();
    this.renderPos = new THREE.Vector3();
    this.renderQuat = new THREE.Quaternion();
    // Verträglichkeit mit VehicleBody (Fahrer-Absicht, Netzblock, HUD, Klang)
    this.controls = { throttle: 0, steer: 0, brake: 0, handbrake: false, gearbox: 'auto' };
    this.mods = { torque: 1, maxGear: 1, immobile: false, turnMult: 1, cutRpm: null };
    this.drive = { gear: 0, targetGear: 0, rpm: 0, rpmNorm: 0, throttle: 0, shifting: false, lugging: false, gearbox: 'auto' };
    this.drivetrain = null;
    this.wheels = [];
    this.tracked = false;
    this.trackSpeed = [0, 0];
    this.slip = 0;
    this.surface = 'default';
    this.onWall = null; this.hullRay = null; this.groundFilter = null;
    this.acc = 0;
    this.sleeping = false;
    this._still = 0;
    this.speed = 0;
    this.grounded = 0;
    this.impact = 0;
    this.impactNormal = new THREE.Vector3();
    this.upsideDown = 0;
    // Flugzustand
    this.input = { power: false, col: 0, yaw: 0, pitch: 0, roll: 0, level: false, boost: false, brake: false, dead: false };
    this.rpm = 0;          // Rotor-/Triebwerksdrehzahl 0…1 (Hochlauf)
    this.thr = 0;          // Jet: Schubhebel 0…1
    this.ab = 0;           // Jet: Nachbrenner 0…1
    this.agl = 0;          // Höhe über Grund (m, Rumpfursprung)
    this.vs = 0;           // Steigrate (m/s)
    this.aoa = 0;          // Jet: Anstellwinkel (rad)
    this.gload = 1;        // Lastvielfaches
    this.stall = 0;        // Strömungsabriss 0…1
    this.onGround = true;
    this.rotorStrike = false;
    this.mult = { thrust: 1, yawSpin: 0, control: 1 }; // Schäden (aircraft.js)
    this._rotorK = 0;
    this._ge = 0;
    this.groundY = 0;
  }

  setPose(origin, yaw = 0, { airborne = false, speed = 0 } = {}) {
    this.quat.setFromAxisAngle(UP, yaw);
    this.pos.copy(this.com).applyQuaternion(this.quat).add(origin);
    this.vel.set(0, 0, 0);
    if (speed) this.forward(this.vel).multiplyScalar(speed);
    this.angVel.set(0, 0, 0);
    this.rate.set(0, 0, 0);
    this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat);
    this.renderPos.copy(this.pos); this.renderQuat.copy(this.quat);
    this.acc = 0;
    this.onGround = !airborne;
    if (airborne) { this.rpm = 1; this.thr = 0.75; }
    this.wake();
  }

  wake() { this.sleeping = false; this._still = 0; }

  toWorld(local, out) { return out.copy(local).sub(this.com).applyQuaternion(this.quat).add(this.pos); }
  toWorldRender(local, out) { return out.copy(local).sub(this.com).applyQuaternion(this.renderQuat).add(this.renderPos); }
  toLocal(world, out) { _iq.copy(this.quat).invert(); return out.copy(world).sub(this.pos).applyQuaternion(_iq).add(this.com); }
  origin(out) { return out.copy(this.com).negate().applyQuaternion(this.quat).add(this.pos); }
  forward(out) { return out.set(0, 0, -1).applyQuaternion(this.quat); }
  up(out) { return out.set(0, 1, 0).applyQuaternion(this.quat); }
  right(out) { return out.set(1, 0, 0).applyQuaternion(this.quat); }
  yaw() { const f = this.forward(_f); return Math.atan2(-f.x, -f.z); }
  pointVelocity(p, out) { _r.copy(p).sub(this.pos); return out.crossVectors(this.angVel, _r).add(this.vel); }

  applyImpulse(p, J) {
    this.vel.addScaledVector(J, 1 / this.mass);
    _r.copy(p).sub(this.pos).cross(J);
    _iq.copy(this.quat).invert();
    _r.applyQuaternion(_iq);
    // Drehstoß in Körperraten (gedämpft – Luftfahrzeuge taumeln sonst endlos)
    this.rate.x += clamp(_r.x / this.inertia.x, -1, 1) * 0.5;
    this.rate.y += clamp(_r.y / this.inertia.y, -1, 1) * 0.5;
    this.rate.z += clamp(_r.z / this.inertia.z, -1, 1) * 0.5;
    this.wake();
  }

  takeImpact() { const v = this.impact; this.impact = 0; return v; }
  rightUp() { /* Luftfahrzeuge richten sich nicht von selbst auf */ }

  /** Euler-Lage (YXZ): yaw, pitch (+ Nase hoch), roll (+ linke Fläche unten). */
  attitude(out = { yaw: 0, pitch: 0, roll: 0 }) {
    _e.setFromQuaternion(this.quat, 'YXZ');
    out.yaw = _e.y; out.pitch = _e.x; out.roll = _e.z;
    return out;
  }

  update(dt, world) {
    if (this.sleeping) {
      if (this.input.power || this.rpm > 0.01) this.wake();
      else { this.renderPos.copy(this.pos); this.renderQuat.copy(this.quat); return 0; }
    }
    this.acc = Math.min(this.acc + dt, STEP * MAX_STEPS);
    let n = 0;
    while (this.acc >= STEP) {
      this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat);
      this.step(STEP, world, n);
      this.acc -= STEP;
      n++;
    }
    const a = this.acc / STEP;
    this.renderPos.lerpVectors(this.prevPos, this.pos, a);
    this.renderQuat.slerpQuaternions(this.prevQuat, this.quat, a);
    const still = this.onGround && !this.input.power && this.rpm < 0.01 && this.vel.lengthSq() < 0.01;
    this._still = still ? this._still + dt : 0;
    if (this._still > 1.5) { this.sleeping = true; this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0); this.rate.set(0, 0, 0); this.renderPos.copy(this.pos); this.renderQuat.copy(this.quat); }
    return n;
  }

  step(h, world, sub = 0) {
    const I = this.input;
    // Drehzahl (Hochlauf/Auslaufen)
    const spool = this.F.spool || 4;
    const want = I.power && !I.dead ? 1 : 0;
    this.rpm += clamp(want - this.rpm, -h / (spool * 1.6), h / spool);
    if (this.kind === 'heli') this._stepHeli(h, world, sub); else this._stepJet(h, world);
    this._ground(h, world);
    this._collide(world, sub);
    // Zustand
    this.forward(_f);
    this.speed = this.vel.dot(_f);
    this.vs = this.vel.y;
    this.drive.rpmNorm = this.rpm;
    this.drive.rpm = this.rpm * 100;
    this.drive.throttle = this.kind === 'jet' ? this.thr : clamp(0.5 + I.col * 0.5, 0, 1);
    this.upsideDown = this.up(_u).y < 0.2 && this.onGround ? this.upsideDown + h : 0;
  }

  /* ------------------------------------------------------------------ Hubschrauber */

  _stepHeli(h, world, sub) {
    const F = this.F, I = this.input, m = this.mass;
    const att = this.attitude(this._att || (this._att = {}));
    const V = this.vel.length();
    const ctrl = this.mult.control;
    // Zyklisch: Neigungsrate mit Lagehaltung, Schwebe-Assistent richtet auf und bremst; Grenzen weich
    let pr = clamp(I.pitch, -1, 1) * F.tiltRate * 0.55 * ctrl;
    let rr = -clamp(I.roll, -1, 1) * F.tiltRate * ctrl;
    if (I.level || I.dead === false && this.onGround && this.rpm < 0.9) {
      // Bremsen: Nase gegen die Fahrt, Querneigung gegen das Schieben
      this.forward(_f); this.right(_r);
      const vf = this.vel.x * _f.x + this.vel.z * _f.z, vr = this.vel.x * _r.x + this.vel.z * _r.z;
      const pT = I.level ? clamp(vf * 0.02, -0.3, 0.3) : 0, rT = I.level ? clamp(vr * 0.02, -0.3, 0.3) : 0;
      if (Math.abs(I.pitch) < 0.05) pr = (pT - att.pitch) * 2.2;
      if (Math.abs(I.roll) < 0.05) rr = (rT - att.roll) * 2.2;
    }
    if (I.dead) { pr = -0.3 + Math.sin(this._deadT = (this._deadT || 0) + h) * 0.4; rr = 0.5; }
    let pitch = att.pitch + pr * h, roll = att.roll + rr * h;
    const pl = F.maxTilt, rl = F.maxBank;
    if (!I.dead) {
      if (pitch > pl) pitch += (pl - pitch) * Math.min(1, h * 6); else if (pitch < -pl) pitch += (-pl - pitch) * Math.min(1, h * 6);
      if (roll > rl) roll += (rl - roll) * Math.min(1, h * 6); else if (roll < -rl) roll += (-rl - roll) * Math.min(1, h * 6);
    }
    // Gieren: Heckrotor + koordinierte Kurve (Querneigung) + Drehmoment ohne Heckrotor
    const auth = this.onGround && this.rpm < 0.7 ? 0 : this.rpm;
    let yr = -clamp(I.yaw, -1, 1) * F.yawRate * auth * (this.mult.yawSpin ? 0.35 : 1);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 8 && !this.onGround) yr += (G_AIR * Math.tan(clamp(roll, -1, 1)) / Math.max(hs, 15)) * smooth(8, 25, hs) * 0.9;
    if (this.mult.yawSpin) yr += this.mult.yawSpin * this.rpm;
    if (I.dead) yr = 2.4 * Math.max(0.3, this.rpm);
    this._yawRate = (this._yawRate || 0) + (yr - (this._yawRate || 0)) * Math.min(1, h * 5);
    const yaw = att.yaw + this._yawRate * h;
    if (!this.onGround || this.rpm > 0.5 || I.dead) {
      _e.set(pitch, yaw, roll, 'YXZ');
      this.quat.setFromEuler(_e);
    }
    this.angVel.set(0, this._yawRate, 0);
    // Schub
    this.up(_u);
    const agl = this.agl;
    const R = F.rotorR;
    this._ge = agl < R * 1.25 ? F.groundEffect * (1 - agl / (R * 1.25)) : 0;
    const etl = 1 + 0.14 * smooth(7, 24, hs) - 0.06 * smooth(60, 85, hs);
    const tmax = F.maxThrust * m * G_AIR * this.rpm * this.rpm * (1 + this._ge) * etl * this.mult.thrust;
    let T = 0;
    if (!I.dead) {
      const col = clamp(I.col, -1, 1);
      const vyT = col >= 0 ? col * F.climb : col * F.descend;
      const ceil = F.ceiling && agl > F.ceiling ? (agl - F.ceiling) * 0.4 : 0;
      const need = m * (G_AIR + F.vertK * (vyT - ceil - this.vel.y));
      T = clamp(need / Math.max(0.35, _u.y), 0, tmax);
      if (this.onGround && col < 0.15 && this.rpm < 0.98) T = Math.min(T, m * G_AIR * 0.9); // am Boden: erst ab Nenndrehzahl abheben
    }
    this._thrust = T;
    _a.copy(_u).multiplyScalar(T / m);
    _a.y -= G_AIR;
    // Widerstand
    _a.addScaledVector(this.vel, -F.dragLin - V * F.dragQuad);
    this.vel.addScaledVector(_a, h);
    this.pos.addScaledVector(this.vel, h);
    // Rotorschlag (Rotorebene gegen Welt; reihum 2 Strahlen je Schritt)
    if (this.rpm > 0.35 && world && !this.onGround) {
      this._rotorK = (this._rotorK + 1) % 8;
      for (let k = 0; k < 2; k++) {
        const ang = ((this._rotorK * 2 + k) / 16) * Math.PI * 2;
        this.toWorld(_b.fromArray(F.hub), _b);
        _d.set(Math.cos(ang), 0, Math.sin(ang)).applyQuaternion(this.quat);
        const hit = collisionRay(world, _b, _d, R * 0.95, _hit);
        if (hit && hit.distance > 1.2) { this.rotorStrike = true; break; }
      }
    }
    void sub;
  }

  /* ------------------------------------------------------------------ Jet */

  _stepJet(h, world) {
    const F = this.F, I = this.input, m = this.mass;
    // Schubhebel (bleibt stehen) + Nachbrenner
    if (!I.dead) this.thr = clamp(this.thr + clamp(I.col, -1, 1) * 0.55 * h, 0, 1);
    else this.thr = Math.max(0, this.thr - h);
    const abWant = I.boost && this.thr > 0.85 && !I.dead && this.mult.thrust > 0.7 ? 1 : 0;
    this.ab += clamp(abWant - this.ab, -h * 2, h * 1.4);
    const T = (this.thr * F.thrust + this.ab * (F.afterburner - F.thrust)) * this.rpm * this.mult.thrust * (F.ceiling && this.agl > F.ceiling ? 0.4 : 1);
    this.forward(_f); this.up(_u); this.right(_r);
    const V = this.vel.length();
    _iq.copy(this.quat).invert();
    _v.copy(this.vel).applyQuaternion(_iq); // Körperraum
    const alpha = V > 2 ? Math.atan2(-_v.y, -_v.z) : 0;
    const beta = V > 2 ? Math.atan2(_v.x, -_v.z) : 0;
    this.aoa = alpha;
    const qd = 0.5 * RHO * V * V;
    const aS = F.alphaStall, aa = Math.abs(alpha);
    let CL;
    // Wölbung/Einstellwinkel (cl0): bei Marschfahrt trägt der Flügel mit waagerechter Nase fast das Gewicht
    if (aa <= aS) CL = (F.cl0 || 0) + F.cla * alpha;
    else CL = Math.sign(alpha) * F.clMax * Math.max(0.3, 1 - (aa - aS) * 2.6);
    // Strömungsabriss: Anstellwinkel über α_krit oder zu wenig Fahrt (unter stallSpeed)
    this.stall = this.onGround ? 0 : Math.max(clamp((aa - aS * 0.92) / 0.08, 0, 1) * (V > 3 ? 1 : 0), clamp((F.stallSpeed - V) / 22, 0, 1));
    let L = qd * F.wingArea * CL;
    const Lmax = F.gLimit * m * G_AIR;
    if (Math.abs(L) > Lmax) L = Math.sign(L) * Lmax;
    this.gload = L / (m * G_AIR);
    _a.set(0, 0, 0);
    if (V > 1) {
      const vh = _d.copy(this.vel).multiplyScalar(1 / V);
      _w.copy(_u).addScaledVector(vh, -_u.dot(vh));
      if (_w.lengthSq() > 1e-6) _a.addScaledVector(_w.normalize(), L / m);
      const D = qd * F.wingArea * (F.cd0 + F.kInd * CL * CL + (this.onGround ? 0.02 : 0)) + (I.brake && !I.dead ? qd * 2.2 : 0);
      _a.addScaledVector(vh, -D / m);
      _a.addScaledVector(_r, -(qd * F.wingArea * 0.55 * beta) / m);
    }
    _a.addScaledVector(_f, T / m);
    _a.y -= G_AIR;
    // Boden: Rollreibung, Bremse
    if (this.onGround) {
      const vf = this.vel.dot(_f);
      const roll = (I.brake || this.thr < 0.05 ? 0.9 : 0.04) * G_AIR;
      _a.addScaledVector(_f, -Math.sign(vf) * Math.min(Math.abs(vf) / h, roll));
      const vr = this.vel.dot(_r);
      _a.addScaledVector(_r, -vr * 6);
    }
    this.vel.addScaledVector(_a, h);
    this.pos.addScaledVector(this.vel, h);
    // Drehraten (Körper): Ratensteuerung, Wirksamkeit nach Staudruck, Lagehaltung, Strömungsabriss
    const auth = clamp(V / 85, 0.15, 1) * this.mult.control;
    const R = F.rates;
    let wp = clamp(I.pitch, -1, 1) * R.pitch * auth;
    let wr = -clamp(I.roll, -1, 1) * R.roll * auth;
    let wy = -clamp(I.yaw, -1, 1) * R.yaw * auth;
    // G-Grenze: weiteres Ziehen bringt nichts; Anstellwinkel-Begrenzer (Abriss erst bei zu wenig Fahrt)
    if (Math.abs(this.gload) >= F.gLimit * 0.98 && Math.sign(wp) === Math.sign(alpha)) wp *= 0.2;
    if (wp > 0 && alpha > aS * 0.75) wp *= clamp((aS * 0.95 - alpha) / (aS * 0.2), 0, 1);
    else if (wp < 0 && alpha < -aS * 0.6) wp *= clamp((alpha + aS * 0.8) / (aS * 0.2), 0, 1);
    // Stabilität: Nase folgt dem Flugweg (Gieren stark, Nicken schwach), Abriss: Nase fällt
    wy += -beta * 1.6 * clamp(V / 60, 0, 1);
    wp += -alpha * 0.18 * auth;
    if (this.stall > 0) {
      // Nase fällt Richtung Boden (Weltbezug, auch im Rückenflug), leichtes Schütteln
      _w.crossVectors(_f, DOWN).applyQuaternion(_iq);
      const k = this.stall * 1.3;
      wp += _w.x * k; wy += _w.y * k * 0.5; wr += _w.z * k * 0.3 + (Math.random() - 0.5) * this.stall * 0.6;
    }
    if (this.onGround) {
      wr = 0; if (V < 40) wp = Math.min(wp, 0.15);
      // Bugradlenkung (F.steer, rad/s bei voller Auslenkung): Rollen auf Rollweg/Bahn (Flugplatz) – wirkt bis ≈ 25 m/s
      // voll, darüber übernimmt das Seitenruder (Ratensteuerung oben)
      if (F.steer) {
        const vf = Math.abs(this.vel.dot(_f));
        const k = clamp(vf / 4, 0, 1) * (1 - smooth(25, 55, vf));
        wy = wy * (1 - k) + (-clamp(I.yaw, -1, 1) * F.steer) * k;
      }
    }
    if (I.dead) { wp = -0.25; wr = 1.6; wy = 0.2; }
    if (this.mult.yawSpin) { wy += this.mult.yawSpin * 0.15; wr += this.mult.yawSpin * 0.25; }
    const k = Math.min(1, h * 7);
    this.rate.x += (wp - this.rate.x) * k;
    this.rate.y += (wy - this.rate.y) * k;
    this.rate.z += (wr - this.rate.z) * k;
    _q.setFromEuler(_e.set(this.rate.x * h, this.rate.y * h, this.rate.z * h, 'YXZ'));
    this.quat.multiply(_q).normalize();
    this.angVel.copy(this.rate).applyQuaternion(this.quat);
    void world;
  }

  /* ------------------------------------------------------------------ Boden / Welt */

  _ground(h, world) {
    const gear = this.def.gear;
    let maxPen = 0, contacts = 0, gy = -Infinity;
    for (const g of gear) {
      this.toWorld(_b.fromArray(g), _b);
      const y = groundBelow(world, _b.x, _b.y + 2.5, _b.z, 6);
      if (y == null) continue;
      gy = Math.max(gy, y);
      const pen = y - _b.y;
      if (pen > -0.05) contacts++;
      if (pen > maxPen) maxPen = pen;
    }
    // Höhe über Grund (Rumpfursprung), seltener genau
    this.origin(_c);
    if (contacts) this.groundY = gy;
    else {
      const y = groundBelow(world, _c.x, _c.y + 1, _c.z, 1500);
      this.groundY = y == null ? (world && world.bounds ? world.bounds.min.y : 0) : y;
    }
    this.agl = Math.max(0, _c.y - this.groundY);
    this.onGround = contacts > 0;
    this.grounded = contacts / gear.length;
    if (maxPen > 0) {
      this.pos.y += maxPen;
      if (this.vel.y < 0) {
        const vn = -this.vel.y;
        // Aufsetzen mit Schräglage/Rotorebene: Aufprall zählt stärker
        const tilt = 1 - this.up(_u).y;
        const imp = vn + tilt * 18 + (this.kind === 'jet' ? Math.max(0, Math.abs(this.vel.dot(this.right(_r))) - 4) : 0);
        if (imp > this.impact) { this.impact = imp; this.impactNormal.set(0, 1, 0); }
        this.vel.y = 0;
      }
      // Auf dem Boden: Lage langsam an die Oberfläche (Hubschrauber ohne Hub), Rutschen bremsen
      if (this.kind === 'heli') {
        const lift = this._thrust ? this._thrust / (this.mass * G_AIR) : 0;
        const fr = lift > 0.85 ? 0.6 : 5;
        this.vel.x *= Math.exp(-h * fr); this.vel.z *= Math.exp(-h * fr);
        if (lift < 0.9) {
          const att = this.attitude(this._att2 || (this._att2 = {}));
          _e.set(att.pitch * (1 - Math.min(1, h * 3)), att.yaw, att.roll * (1 - Math.min(1, h * 3)), 'YXZ');
          this.quat.setFromEuler(_e);
          this._yawRate = (this._yawRate || 0) * Math.exp(-h * 6);
        }
      } else {
        // Jet: Nase/Flächen auf das Fahrwerk legen
        const att = this.attitude(this._att2 || (this._att2 = {}));
        if (att.pitch < 0 || Math.abs(this.speed) < 45) {
          _e.set(att.pitch * (1 - Math.min(1, h * 2.5)), att.yaw, att.roll * (1 - Math.min(1, h * 4)), 'YXZ');
          this.quat.setFromEuler(_e);
          this.rate.x *= 0.8; this.rate.z *= 0.5;
        }
      }
    }
  }

  _collide(world, sub) {
    const S = this.def.samples;
    if (!S || !world) return;
    this.origin(_c);
    const center = _w.copy(this.pos);
    for (let i = 0; i < S.length; i++) {
      this.toWorld(_b.fromArray(S[i]), _b);
      // Gelände (Höhenfeld) direkt
      if (typeof world.heightAt === 'function') {
        const hy = world.heightAt(_b.x, _b.z);
        if (Number.isFinite(hy) && _b.y < hy - 0.05) {
          const pen = hy - _b.y;
          this.pos.y += Math.min(pen, 0.6);
          const vn = -this.vel.y;
          if (vn > 0) { if (vn + 2 > this.impact) { this.impact = vn + 2; this.impactNormal.set(0, 1, 0); } this.vel.y *= -0.1; this.vel.multiplyScalar(0.85); }
          continue;
        }
      }
      // Gebäude/Bäume: Strahl Mitte → Probepunkt (reihum, damit es billig bleibt)
      if ((i + sub) % 2 !== 0) continue;
      _d.copy(_b).sub(center);
      const len = _d.length();
      if (len < 1e-3) continue;
      _d.multiplyScalar(1 / len);
      const hit = collisionRay(world, center, _d, len, _hit);
      if (!hit) continue;
      _a.set(hit.nx, hit.ny, hit.nz);
      if (_a.dot(_d) > 0) _a.negate();
      const depth = len - hit.distance;
      this.pos.addScaledVector(_a, Math.min(depth, 0.5) * 0.8);
      const vn = -this.vel.dot(_a);
      if (vn > 0) {
        if (vn > this.impact) { this.impact = vn; this.impactNormal.copy(_a); }
        this.vel.addScaledVector(_a, vn * 1.2);
        this.vel.multiplyScalar(0.8);
      }
    }
    void wrap;
  }
}
