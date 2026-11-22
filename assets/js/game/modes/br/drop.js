// NULLPUNKT — Battle Royale: Einstieg (Transportflugzeug + Fallschirm) für Spieler und Bots.
//
// Flug ('flug'): Eine Flugroute quer über die Karte (zufällige Richtung, nahe der Mitte), das Flugzeug fliegt sie in ~30 s ab.
// Der Spieler steht auf der offenen Heckrampe (Körper folgt der Rampe, Blick frei) und springt mit der Leertaste ab, am Ende
// der Route automatisch. Freier Fall (bis 42 m/s, steuerbar), der Schirm öffnet sich mit der Leertaste oder spätestens 55 m über
// Grund; am Schirm 6,5 m/s Sinken, 9 m/s Gleiten. In der Luft ist man unverwundbar (kein Beschuss aus dem Flugzeug/Schirm,
// kein Sturzschaden), bei der Landung endet das.
// Zufällig ('zufall'): alle beginnen an zufälligen Orten 150 m über Grund im freien Fall.
// Bots: warten unsichtbar unter der Karte (Mitfahrer-Ruhe wie im geschlossenen Transporter, bot.js), springen an ihrem Punkt
// der Route ab und schweben vereinfacht (Figur + Schirm, ohne KI) zu ihrem Landeplatz; dort übernimmt wieder die KI.
// Ehrlich: Das Flugzeug ist ein schlichtes Modell (Rumpf, Schulterdecker, vier Triebwerke, T-Leitwerk) ohne Innenraum.
import * as THREE from 'three';

export const PLANE_SPEED = 32;      // m/s über Grund
export const FREE_FALL = 42;        // m/s Fallgeschwindigkeit (begrenzt)
export const CHUTE_SINK = 6.5;      // m/s am Schirm
export const CHUTE_OPEN_AGL = 55;   // m über Grund: Schirm öffnet spätestens
const FREE_GLIDE = 20, CHUTE_GLIDE = 9;
const PARK_Y = -400;                 // Wartebereich der Bots unter der Karte
const PASSENGER_SEAT = Object.freeze({ def: Object.freeze({ passenger: true }), hatchT: 0 });
export const BR_PLANE = Object.freeze({ id: 'br-flugzeug', type: 'br_plane', isBrPlane: true });

const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();

let SH = null;
function shared() {
  if (SH) return SH;
  const canopy = new THREE.SphereGeometry(3.4, 18, 6, 0, Math.PI * 2, 0, Math.PI * 0.3);
  canopy.scale(1, 0.55, 0.78);
  const lines = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    lines.push(Math.cos(a) * 3.4 * Math.sin(Math.PI * 0.3), 3.4 * Math.cos(Math.PI * 0.3) * 0.55 - 0.1, Math.sin(a) * 3.4 * Math.sin(Math.PI * 0.3) * 0.78, 0, -2.6, 0);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  SH = {
    canopy, lines: lg,
    cloth: new THREE.MeshStandardMaterial({ color: 0x5a6142, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    cord: new THREE.LineBasicMaterial({ color: 0x2b2c27 }),
    hull: new THREE.MeshStandardMaterial({ color: 0x4d5247, roughness: 0.7, metalness: 0.25, side: THREE.DoubleSide }), // innen sichtbar (Rampe)
    dark: new THREE.MeshStandardMaterial({ color: 0x23251f, roughness: 0.6, metalness: 0.3 }),
  };
  return SH;
}

/** Fallschirm (Kappe + Leinen), Ursprung = Gurtzeug; Kappe ≈ 4,6 m darüber. */
export function makeCanopy() {
  const S = shared();
  const g = new THREE.Group();
  g.name = 'br:schirm';
  const c = new THREE.Mesh(S.canopy, S.cloth);
  c.position.y = 4.4;
  const l = new THREE.LineSegments(S.lines, S.cord);
  l.position.y = 4.4;
  g.add(c, l);
  g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; });
  return g;
}

/** Schlichtes Transportflugzeug (Rumpf entlang −Z). */
export function makePlane() {
  const S = shared();
  const g = new THREE.Group();
  g.name = 'br:flugzeug';
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  add(new THREE.CylinderGeometry(2.2, 2.2, 26, 16, 1), S.hull, 0, 0, 0, Math.PI / 2);
  add(new THREE.SphereGeometry(2.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), S.hull, 0, 0, -13, -Math.PI / 2);
  add(new THREE.CylinderGeometry(2.2, 0.7, 9, 16, 1), S.hull, 0, 0.9, 17.4, Math.PI / 2 + 0.12);
  add(new THREE.BoxGeometry(40, 0.45, 4.2), S.hull, 0, 2.0, -2);
  for (const x of [-12, -6.5, 6.5, 12]) add(new THREE.CylinderGeometry(0.75, 0.85, 4.2, 12, 1), S.dark, x, 1.3, -3.6, Math.PI / 2);
  add(new THREE.BoxGeometry(0.4, 6.5, 4.2), S.hull, 0, 4.2, 20);
  add(new THREE.BoxGeometry(13, 0.35, 3.2), S.hull, 0, 7.3, 20.6);
  add(new THREE.BoxGeometry(3.4, 0.25, 5), S.dark, 0, -1.6, 15.5, -0.35); // offene Heckrampe
  g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  return g;
}

/** Schirm eines Bots (die Figur selbst ist sein Soldatenmodell, das während des Sprungs ohne KI mitgeführt wird). */
function makeJumper() { return makeCanopy(); }

/**
 * Route über die Karte: Richtung zufällig, Versatz ≤ 22 % der halben Ausdehnung von der Mitte. → { a, b, dir, len, alt }
 */
export function planRoute(bounds, groundY, rng) {
  const cx = (bounds.min.x + bounds.max.x) / 2, cz = (bounds.min.z + bounds.max.z) / 2;
  const hx = (bounds.max.x - bounds.min.x) / 2, hz = (bounds.max.z - bounds.min.z) / 2;
  const ang = rng() * Math.PI * 2;
  const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const off = (rng() * 2 - 1) * 0.22 * Math.min(hx, hz);
  // Länge: Schnitt mit der Kartenbox + 8 % Vorlauf
  const ext = Math.abs(dir.x) * hx + Math.abs(dir.z) * hz;
  const len = ext * 2 * 1.08;
  const mid = new THREE.Vector3(cx, 0, cz).addScaledVector(side, off);
  const alt = Math.max(groundY + 190, 200);
  const a = mid.clone().addScaledVector(dir, -len / 2); a.y = alt;
  const b = mid.clone().addScaledVector(dir, len / 2); b.y = alt;
  return { a, b, dir, len, alt, dur: len / PLANE_SPEED };
}

/** Punkt der Route zur Zeit t (s). */
export function routeAt(route, t, out = new THREE.Vector3()) {
  const f = Math.min(1, Math.max(0, t / route.dur));
  return out.lerpVectors(route.a, route.b, f);
}

export class DropSystem {
  constructor(G, { kind = 'flug', rng = Math.random, pickLanding = null } = {}) {
    this.G = G;
    this.kind = kind === 'zufall' ? 'zufall' : 'flug';
    this.rng = rng;
    this.pickLanding = pickLanding; // (rng) → Vector3 Landeplatz (Boden) oder null
    this.t = 0;
    this.started = false;
    this.route = null;
    this.plane = null;
    this.jumpers = new Map(); // Bot → { phase, t0, from, to, mesh }
    this.player = { phase: 'none', canopy: null, openAt: 0, since: 0 };
    this.group = new THREE.Group();
    this.group.name = 'br:einstieg';
    this.done = false;
  }

  _ground(x, z, from = 260) {
    const w = this.G.world;
    const y = w && typeof w.groundHeight === 'function' ? w.groundHeight(x, z, from) : null;
    return y == null ? 0 : y;
  }

  /** Vor dem Countdown: Route planen, alle an Bord bzw. in die Luft, Bots parken. */
  setup(actors) {
    const G = this.G, w = G.world;
    const b = w && w.bounds ? w.bounds : new THREE.Box3(new THREE.Vector3(-250, -3, -250), new THREE.Vector3(250, 30, 250));
    this.bounds = b;
    const gy = Math.max(0, b.max.y || 0);
    if (G.scene) G.scene.add(this.group);
    if (this.kind === 'flug') {
      this.route = planRoute(b, gy, this.rng);
      this.plane = makePlane();
      this.group.add(this.plane);
      this._placePlane(0);
    }
    let i = 0;
    for (const a of actors) {
      if (!a || a.isStreakEntity) continue;
      a.invulnerable = true;
      if (a.isPlayer) { this.player.phase = this.kind === 'flug' ? 'plane' : 'free'; this.player.since = 0; this._placePlayerStart(); continue; }
      if (!a.isBot || a.puppet) continue;
      const to = (this.pickLanding && this.pickLanding(this.rng)) || this._randomGround();
      let jumpT = 0, from;
      if (this.kind === 'flug') {
        // Absprungpunkt: Lot vom Landeplatz auf die Route, etwas Streuung
        const r = this.route;
        _v.subVectors(to, r.a).setY(0);
        const s = Math.min(r.len, Math.max(0, _v.dot(r.dir)));
        jumpT = Math.min(r.dur - 0.5, Math.max(0.8, s / PLANE_SPEED + (this.rng() - 0.5) * 3));
        from = routeAt(r, jumpT);
      } else {
        jumpT = this.rng() * 3;
        from = to.clone(); from.y = to.y + 150;
        from.x += (this.rng() - 0.5) * 60; from.z += (this.rng() - 0.5) * 60;
      }
      const j = { phase: 'wait', jumpT, from, to, mesh: null, t0: 0, dur: 0, yaw: Math.atan2(-(to.x - from.x), -(to.z - from.z)) };
      // Dauer: freier Fall bis 55 m über Landeplatz, dann Schirm
      const freeH = Math.max(0, from.y - to.y - CHUTE_OPEN_AGL);
      j.freeDur = freeH / FREE_FALL;
      j.dur = j.freeDur + Math.min(CHUTE_OPEN_AGL, from.y - to.y) / CHUTE_SINK;
      this.jumpers.set(a, j);
      this._park(a, i++);
    }
  }

  _randomGround() {
    const b = this.bounds;
    const x = b.min.x + 20 + this.rng() * (b.max.x - b.min.x - 40), z = b.min.z + 20 + this.rng() * (b.max.z - b.min.z - 40);
    return new THREE.Vector3(x, this._ground(x, z), z);
  }

  _placePlane(t) {
    if (!this.plane) return;
    routeAt(this.route, t, this.plane.position);
    this.plane.rotation.y = Math.atan2(-this.route.dir.x, -this.route.dir.z);
  }

  /** Spieler auf der Rampe (Flug) bzw. an einem zufälligen Ort in der Luft. */
  _placePlayerStart() {
    const P = this.G.player;
    if (!P || !P.body) return;
    if (this.kind === 'flug') {
      this._rampPos(_v);
      P.body.teleport(_v);
      P.yaw = Math.atan2(this.route.dir.x, this.route.dir.z); // Blick nach hinten aus der Rampe
      P.pitch = -0.25;
    } else {
      const g = (this.pickLanding && this.pickLanding(this.rng)) || this._randomGround();
      _v.set(g.x, g.y + 150, g.z);
      P.body.teleport(_v);
      P.pitch = -0.5;
    }
  }

  _rampPos(out) {
    routeAt(this.route, this.t, out);
    out.addScaledVector(this.route.dir, -15.2);
    out.y -= 1.75;
    return out;
  }

  _park(bot, i) {
    _v.set((i % 10) * 4 - 18, PARK_Y, Math.floor(i / 10) * 4 - 18);
    bot.body.teleport(_v);
    bot.vehicle = BR_PLANE;
    bot.vehicleSeat = PASSENGER_SEAT;
    if (bot.soldier && bot.soldier.place) bot.soldier.place(_v, 0);
  }

  /** Liegt der Akteur noch in der Luft / an Bord? */
  airborne(a) {
    if (!a) return false;
    if (a.isPlayer) return this.player.phase === 'plane' || this.player.phase === 'free' || this.player.phase === 'chute';
    const j = this.jumpers.get(a);
    return !!j && j.phase !== 'landed';
  }

  /** Noch nicht gelandete Bots (für „Übrig“ und das Flugzeug). */
  get pending() { let n = 0; for (const j of this.jumpers.values()) if (j.phase !== 'landed') n++; return n; }

  /** Vor dem Spieler (mode.preUpdate): Eingaben am Schirm/im Fall. */
  preUpdate(dt, playing) {
    const G = this.G, P = G.player, ph = this.player;
    if (!P || !P.alive || !P.body) return;
    const inp = G.input;
    if (ph.phase === 'plane') {
      this._rampPos(_v);
      P.body.teleport(_v);
      const jump = playing && inp && typeof inp.pressed === 'function' && inp.pressed('jump');
      if (jump && inp.consume) inp.consume('jump');
      if (playing && (jump || this.t >= this.route.dur - 0.2)) this._playerJump();
      return;
    }
    if (ph.phase !== 'free' && ph.phase !== 'chute') return;
    ph.since += dt;
    const v = P.body.velocity;
    const mx = inp && inp.move ? inp.move.x : 0, my = inp && inp.move ? inp.move.y : 0;
    _f.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    _r.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
    const glide = ph.phase === 'free' ? FREE_GLIDE : CHUTE_GLIDE;
    const wx = (_f.x * Math.max(0, my) + _f.x * Math.min(0, my) * 0.4 + _r.x * mx * 0.7) * glide;
    const wz = (_f.z * Math.max(0, my) + _f.z * Math.min(0, my) * 0.4 + _r.z * mx * 0.7) * glide;
    const k = 1 - Math.exp(-(ph.phase === 'free' ? 1.4 : 2.2) * dt);
    v.x += (wx - v.x) * k;
    v.z += (wz - v.z) * k;
    // Karte nicht verlassen
    const b = this.bounds, p = P.body.position;
    if (p.x < b.min.x + 8 && v.x < 0) v.x = 0; if (p.x > b.max.x - 8 && v.x > 0) v.x = 0;
    if (p.z < b.min.z + 8 && v.z < 0) v.z = 0; if (p.z > b.max.z - 8 && v.z > 0) v.z = 0;
    if (ph.phase === 'free') {
      if (v.y < -FREE_FALL) v.y = -FREE_FALL;
      const agl = p.y - this._ground(p.x, p.z, p.y + 1);
      const want = inp && typeof inp.pressed === 'function' && inp.pressed('jump') && ph.since > 1.2;
      if (want && inp.consume) inp.consume('jump');
      if (agl < CHUTE_OPEN_AGL || want) this._openChute();
    } else if (v.y < -CHUTE_SINK) v.y += (-CHUTE_SINK - v.y) * Math.min(1, dt * 3.5);
  }

  _playerJump() {
    const P = this.G.player, ph = this.player;
    ph.phase = 'free';
    ph.since = 0;
    this._rampPos(_v);
    P.body.teleport(_v);
    P.body.velocity.copy(this.route.dir).multiplyScalar(PLANE_SPEED * 0.5);
    this.G.events.emit('br:jump', { actor: P });
  }

  _openChute() {
    const ph = this.player;
    if (ph.phase === 'chute') return;
    ph.phase = 'chute';
    ph.since = 0;
    ph.canopy = makeCanopy();
    this.group.add(ph.canopy);
    this.G.events.emit('br:chute', { actor: this.G.player });
  }

  /** Nach Spieler und Bots (mode.update): Flugzeug, Bot-Sprünge, Landungen. → Liste frisch gelandeter Akteure */
  update(dt, playing) {
    const landed = [];
    if (playing) this.t += dt;
    const G = this.G, P = G.player, ph = this.player;
    if (this.plane) {
      this._placePlane(this.t);
      if (this.t > this.route.dur + 6) { this.plane.removeFromParent(); this.plane = null; }
    }
    // Spieler
    if (P && ph.phase === 'plane') { this._rampPos(_v); P.body.teleport(_v); }
    if (P && (ph.phase === 'free' || ph.phase === 'chute')) {
      if (!P.alive) ph.phase = 'landed';
      else if (P.body.onGround) {
        ph.phase = 'landed';
        landed.push(P);
        if (ph.canopy) { this._collapse(ph.canopy); ph.canopy = null; }
      } else if (ph.canopy) { ph.canopy.position.copy(P.body.position); ph.canopy.position.y += 0.2; ph.canopy.rotation.y = -P.yaw; }
    }
    // Bots
    if (playing) for (const [bot, j] of this.jumpers) {
      if (j.phase === 'landed') continue;
      if (!bot.alive) { j.phase = 'landed'; if (j.mesh) { j.mesh.removeFromParent(); j.mesh = null; } continue; }
      if (j.phase === 'wait') {
        if (this.t < j.jumpT) continue;
        j.phase = 'air'; j.t0 = this.t;
        j.mesh = makeJumper();
        j.mesh.children[0].visible = false; j.mesh.children[1].visible = false; // Schirm erst nach dem freien Fall
        this.group.add(j.mesh);
      }
      const u = (this.t - j.t0);
      if (u >= j.dur) { this._landBot(bot, j); landed.push(bot); continue; }
      // waagerecht: gleichmäßig zum Landeplatz; senkrecht: Fall, dann Schirm
      const f = Math.min(1, u / j.dur);
      const e = f * f * (3 - 2 * f);
      _v.lerpVectors(j.from, j.to, e);
      if (u < j.freeDur) _v.y = j.from.y - u * FREE_FALL;
      else _v.y = j.to.y + Math.max(0, CHUTE_OPEN_AGL - (u - j.freeDur) * CHUTE_SINK);
      _v.y = Math.min(_v.y, j.from.y);
      bot.body.teleport(_v);
      if (bot.soldier && bot.soldier.place) bot.soldier.place(_v, j.yaw);
      if (j.mesh) {
        j.mesh.position.copy(_v);
        j.mesh.rotation.y = j.yaw;
        const open = u >= j.freeDur;
        j.mesh.children[0].visible = open; j.mesh.children[1].visible = open;
      }
    }
    // Abgelegte Schirme sinken in sich zusammen
    for (let i = this.group.children.length - 1; i >= 0; i--) {
      const c = this.group.children[i];
      if (!c.userData.fold) continue;
      c.userData.fold += dt;
      const k = Math.max(0, 1 - c.userData.fold / 2.2);
      c.scale.set(1 + (1 - k) * 0.4, k, 1 + (1 - k) * 0.4);
      if (k <= 0) c.removeFromParent();
    }
    if (!this.done && ph.phase !== 'plane' && ph.phase !== 'free' && ph.phase !== 'chute' && !this.pending) this.done = true;
    return landed;
  }

  _collapse(g) { g.userData.fold = 0.001; }

  _landBot(bot, j) {
    j.phase = 'landed';
    if (j.mesh) { this._collapse(j.mesh); j.mesh = null; }
    bot.vehicle = null;
    bot.vehicleSeat = null;
    _v.copy(j.to); _v.y += 0.05;
    bot.body.teleport(_v);
    bot.yaw = j.yaw;
    if (bot.nav && typeof bot.nav.reset === 'function') bot.nav.reset();
    if (bot.soldier && bot.soldier.reset) bot.soldier.reset(_v, bot.yaw);
    bot._objAt = 0;
  }

  /** Bot sofort landen (z. B. Matchende, Aufräumen). */
  release(bot) {
    const j = this.jumpers.get(bot);
    if (j && j.phase !== 'landed') this._landBot(bot, j);
  }

  /** Spieler-Phase für das HUD: 'plane' | 'free' | 'chute' | 'landed' | 'none'. */
  get playerPhase() { return this.player.phase; }

  dispose() {
    for (const [bot, j] of this.jumpers) { if (j.phase !== 'landed' && bot.vehicle === BR_PLANE) { bot.vehicle = null; bot.vehicleSeat = null; } }
    this.jumpers.clear();
    this.group.removeFromParent();
  }
}
