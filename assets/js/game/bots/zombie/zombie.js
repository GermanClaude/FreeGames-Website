// NULLPUNKT — Zombie-Modus: der Untote als eigener Akteur. Baut auf Bot (bots/bot.js) auf – gleicher Körper (Kapsel,
// Schritte, Sturz), gleiche Navigation (ai/navigator.js über die Pfad-Warteschlange des Managers), gleiches Gehör
// (manager._hear: Schüsse, Schritte, Explosionen landen im Gedächtnis) und gleiche Sicht (ai/perception.js) –, ersetzt aber
// Entscheidung, Bewegung, Waffe und Animation durch eine reine Nahkampf-KI:
//   hetzen    Ziel gesehen → auf einer eigenen Flanke heran (Umzingeln: jeder Untote nähert sich unter seinem Winkel, die
//             Zwischenstation schrumpft mit dem Abstand), auf den letzten Metern direkt und schneller (Ausfall).
//   lauschen  Geräusch/Treffer ohne Sicht → zur gehörten Stelle (Fehler je Entfernung), dort weitersuchen.
//   streunen  nichts bekannt → Witterung vom Modus (G.mode.lureFor: ungefähr dorthin, wo Menschen sind).
// Schlag: Ausholen (Typ: windup) → Treffer, wenn das Ziel noch in Reichweite und frei ist → Erholung + Abklingzeit. Ein
// Treffer bremst das Opfer kurz (netUntil/netSlow wie das Wurfnetz). Schaden: combat.damage ruft actor.scaleDamage –
// Kopftreffer tödlich, Körper voll, Arme/Beine weniger, Beintreffer verlangsamen dauerhaft (zombie-waves.js).
// Kein Nachladen, keine Regeneration, kein Namensschild, keine Waffe in der Hand (Messer-Controller nur als Platzhalter).
// Nur offline/Host-lokal: Puppen (Mehrspieler) laufen über Bot.update unverändert.
import * as THREE from 'three';
import { Bot } from '../bot.js?v=20261123082814';
import { Soldier } from '../character.js?v=20261123082814';
import { sense } from '../ai/perception.js?v=20261123082814';
import { difficultyProfile } from '../difficulty.js?v=20261123082814';
import { ZOMBIE_TYPES, zombieDamage, legSlow } from '../../modes/zombie-waves.js?v=20261123082814';
import { lookFor, dressZombie, restoreLook, syncRag, faceLook } from './look.js?v=20261123082814';
import { applyZombiePose } from './pose.js?v=20261123082814';
import { tx } from '../../../shared/i18n.js?v=20261123082814';

const GRAVITY = 24;
const JUMP_V = Math.sqrt(2 * GRAVITY * 0.8);
const STEP_OPTS = { gravity: GRAVITY, stepHeight: 0.45 };
const FALL_SAFE = 15;
const RECOVER_S = 0.45; // s nach dem Schlag
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _tc = new THREE.Vector3();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

let PENDING_LOOK = null; // Aussehen für den Soldaten, den der Bot-Konstruktor (vor dem eigenen Konstruktorrumpf) baut

export class Zombie extends Bot {
  /**
   * @param manager BotManager
   * opts: { type ('schlurfer'|'hetzer'|'huene'), difficulty, seed (Aussehen) }
   */
  constructor(manager, { type = 'schlurfer', difficulty = 'regulaer', seed = 1 } = {}) {
    const T = ZOMBIE_TYPES[type] || ZOMBIE_TYPES.schlurfer;
    const look = lookFor(T.id, seed);
    const G = manager.G;
    const base = difficultyProfile(difficulty, G && G.data && G.data.DIFFICULTIES);
    const diff = {
      ...base, id: base.id, fov: (150 * Math.PI) / 180, viewDistance: T.view, senseHz: 3, thinkInterval: 0.4,
      spotRate: 2.6, hearing: T.hearing, damageScale: 1, reaction: 0.3,
    };
    PENDING_LOOK = look;
    try {
      super(manager, { team: 'B', name: tx(T.name), diff, loadout: { primary: 'knife', secondary: null, lethal: null, tactical: null }, variant: look.variant, scheme: 'B', modeId: 'zombie', lane: 1 });
    } finally { PENDING_LOOK = null; }
    this.isZombie = true;
    this.look = look;
    this.type = T;
    this.typeId = T.id;
    this.manualPlates = true;
    this.flank = 0; // Annäherungswinkel (rad), vom Modus beim Einsatz gesetzt
    this.speedMult = 1;
    this.dmgMult = 1;
    this.slow = 1; // Beintreffer
    this._legDmg = 0;
    this._target = null;
    this._mode = 'streunen';
    this._goal = new THREE.Vector3();
    this._hasGoal = false;
    this._direct = false;
    this._speed = T.roam;
    this._zGo = { tolerance: 1.2, repath: 2 };
    this._atk = { phase: 'idle', t: 0, readyAt: 0, target: null };
    this._atkK = 0;
    this._voiceAt = 0;
    this._lostAt = 0;
    this._spawnedAt = 0;
    this.maxHealth = T.hp;
    this.health = T.hp;
  }

  /** Wellen-Härte setzen (vor dem Einsatz): Leben, Tempo, Schaden ×. */
  setWave({ hpMult = 1, speedMult = 1, dmgMult = 1 } = {}) {
    this.maxHealth = Math.round(this.type.hp * hpMult);
    this.speedMult = speedMult;
    this.dmgMult = dmgMult;
  }

  /* ================================================================ Darstellung */

  _soldier(i) {
    if (!this.soldiers[i]) {
      const look = this.look || PENDING_LOOK;
      const s = new Soldier({ team: this.team, variant: this.variant, camo: this.scheme, quality: this.manager.tier || this.manager.quality, models: this.manager.models, name: this.name, face: look ? look.face : undefined });
      s.guns = new Map();
      s.onGunLost = () => {};
      try { s.setWeaponModel(null, null); } catch { /* Animator ohne Waffe */ }
      dressZombie(s, look);
      this.manager.scene.add(s.root);
      this.soldiers[i] = s;
    }
    return this.soldiers[i];
  }

  /** Keine Waffe in der Hand (der Messer-Controller bleibt unsichtbar). */
  _syncGun() {
    const s = this.soldier;
    if (s && (s.gun || s.def)) s.setWeaponModel(null, null);
    this._gunId = this.weapon && this.weapon.currentDef ? this.weapon.currentDef.id : null;
  }

  /* ================================================================ Treffer / Tod */

  /** combat.damage: Schaden nach Trefferzone (Kopf tödlich, Beine bremsen). */
  scaleDamage(amount, info = {}) {
    const legHit = info.zone === 'limb' && !!info.point && info.point.y - this.position.y < 0.95;
    const r = zombieDamage(this.type, amount, { zone: info.zone, explosive: !!info.explosive, legHit }, this.health);
    if (r.leg) { this._legDmg += r.amount; this.slow = legSlow(this._legDmg, this.type.hp); }
    return r.amount;
  }

  onDamaged(info) {
    const now = this.G.time.elapsed;
    const st0 = this.staggerUntil;
    super.onDamaged(info);
    // Hüne taumeln kaum; Hetzer etwas mehr
    if (this.staggerUntil > st0) this.staggerUntil = now + (this.staggerUntil - now) * this.type.stagger;
    this.limpUntil = 0; // Hinken regelt slow (dauerhaft)
    if (this.alive && info.attacker && info.attacker.alive !== false && info.attacker !== this) {
      this._target = info.attacker;
      this._thinkT = Math.min(this._thinkT, 0.1);
      if (now - (this._hurtVoice || -1e9) > 2.5) { this._hurtVoice = now; this._voiceAt = Math.min(this._voiceAt, now + 0.2); }
    }
  }

  onDeath(info = {}) {
    this._atk.phase = 'idle';
    this._atkK = 0;
    this._target = null;
    this._hasGoal = false;
    super.onDeath(info);
  }

  respawn(spawn) {
    super.respawn(spawn);
    this.slow = 1;
    this._legDmg = 0;
    this._target = null;
    this._mode = 'streunen';
    this._hasGoal = false;
    this._direct = false;
    this._atk.phase = 'idle'; this._atk.t = 0; this._atk.readyAt = 0; this._atk.target = null;
    this._atkK = 0;
    this._voiceAt = this.G.time.elapsed + rnd(1, 5);
    this._spawnedAt = this.G.time.elapsed;
    this._lostAt = this.G.time.elapsed;
    this._thinkT = rnd(0.05, 0.4);
    faceLook(this.soldier);
  }

  dispose() {
    for (const s of this.soldiers) if (s) restoreLook(s);
    super.dispose();
  }

  /* ================================================================ Entscheidung */

  _think(now) {
    const G = this.G;
    const mem = this.memory;
    mem.forget(now, 22);
    const p = this.position;
    let best = null, bd = Infinity;
    const list = mem.list;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r.actor.alive || r.actor.isZombie) continue;
      if (r.visible && r.spot >= 0.3) { const d = r.actor.position.distanceTo(p); if (d < bd) { bd = d; best = r; } }
    }
    // gerade getroffen: Angreifer bleibt Ziel, auch ohne Sicht (er steht ungefähr dort)
    if (!best && this._target && this._target.alive && now - this.lastDamageTime < 2.5) best = mem.get(this._target);
    const T = this.type;
    let speed = T.roam;
    this._direct = false;
    if (best) {
      const tg = best.actor;
      this._target = tg;
      this._mode = 'hetzen';
      this._lostAt = now;
      const tp = best.visible ? tg.position : best.pos;
      const d = tp.distanceTo(p);
      this._encircle(tp, this._goal);
      this._hasGoal = true;
      speed = d < 7 ? T.lunge : T.chase;
      this._direct = best.visible && d < 4.5 && Math.abs(tp.y - p.y) < 1.2;
      this._zGo.repath = clamp(d * 0.12, 1, 7);
      this._zGo.tolerance = 0.8;
    } else {
      const fresh = mem.freshestUnseen(now, 16);
      if (fresh && !fresh.actor.isZombie) {
        this._target = fresh.actor;
        this._mode = now - fresh.seenAt < 4 ? 'hetzen' : 'lauschen';
        this._goal.copy(fresh.pos);
        this._hasGoal = true;
        speed = this._mode === 'hetzen' ? T.chase : (T.roam + T.chase) * 0.5;
        this._zGo.repath = 3;
        this._zGo.tolerance = 2;
        if (this.nav.arrived || this.nav.failed) mem.remove(fresh.actor); // dort ist niemand mehr
      } else {
        this._target = null;
        this._mode = 'streunen';
        const lure = G.mode && typeof G.mode.lureFor === 'function' ? G.mode.lureFor(this) : null;
        if (lure) { this._goal.copy(lure); this._hasGoal = true; } else this._hasGoal = false;
        this._zGo.repath = 6;
        this._zGo.tolerance = 3;
      }
    }
    this._speed = speed * this.speedMult;
  }

  /** Umzingeln: Zwischenstation auf der eigenen Flanke um das Ziel, nah am Ziel direkt darauf. */
  _encircle(tp, out) {
    const p = this.position;
    const dx = p.x - tp.x, dz = p.z - tp.z;
    const d = Math.hypot(dx, dz);
    if (d < 6 || !this.flank) { out.copy(tp); return out; }
    const a = this.flank * clamp((d - 6) / 18, 0, 1);
    const c = Math.cos(a), s = Math.sin(a);
    const ux = dx / d, uz = dz / d;
    const rx = ux * c - uz * s, rz = ux * s + uz * c;
    const r = Math.min(d * 0.55, 10);
    out.set(tp.x + rx * r, tp.y, tp.z + rz * r);
    const nav = this.G.world && this.G.world.nav;
    if (nav && typeof nav.nearest === 'function') {
      const n = nav.nearest(out);
      if (n && n.position.distanceTo(out) < 4) out.copy(n.position); else out.copy(tp);
    }
    return out;
  }

  /* ================================================================ Schlag */

  _updateAttack(dt, now, frozen) {
    const A = this._atk;
    const T = this.type;
    if (A.phase === 'idle') {
      this._atkK = 0;
      const tg = this._target;
      if (frozen || !tg || !tg.alive || now < A.readyAt || now < this.staggerUntil) return;
      const p = this.position, q = tg.position;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d > T.reach + 0.25 || Math.abs(q.y - p.y) > 1.3) return;
      // grob zugewandt
      const want = Math.atan2(-(q.x - p.x), -(q.z - p.z));
      if (Math.abs(wrap(want - this.yaw)) > 0.9) return;
      A.phase = 'windup'; A.t = 0; A.target = tg;
      this._sound('melee_swing', 0.45, 0.8);
      if (Math.random() < 0.6) this._voiceAt = now; // Knurren zum Schlag
      return;
    }
    A.t += dt;
    if (A.phase === 'windup') {
      this._atkK = 0.55 * clamp(A.t / T.windup, 0, 1);
      if (A.t >= T.windup) { A.phase = 'recover'; this._strike(A.target, now); }
    } else {
      this._atkK = 0.55 + 0.45 * clamp((A.t - T.windup) / RECOVER_S, 0, 1);
      if (A.t >= T.windup + RECOVER_S) { A.phase = 'idle'; A.target = null; A.readyAt = now + Math.max(0.2, T.cooldown * rnd(0.85, 1.15) - RECOVER_S); this._atkK = 0; }
    }
  }

  _strike(tg, now) {
    const G = this.G;
    const T = this.type;
    if (!tg || !tg.alive || !this.alive) return;
    const p = this.position, q = tg.position;
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d > T.reach + 0.55 || Math.abs(q.y - p.y) > 1.4) return;
    this.getEyePosition(_eye);
    _tc.set(q.x, q.y + (tg.body ? tg.body.height * 0.62 : 1.1), q.z);
    if (G.world && typeof G.world.lineOfSight === 'function' && !G.world.lineOfSight(_eye, _tc)) return;
    const dir = new THREE.Vector3(q.x - p.x, 0, q.z - p.z);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    if (!G.combat) return;
    G.combat.damage(tg, { amount: T.dmg * this.dmgMult, attacker: this, weaponId: 'zombie', zone: 'body', dir, point: _tc.clone(), distance: d });
    if (tg.alive) {
      // gepackt: kurz gebremst und ein Stück weggestoßen
      tg.netUntil = Math.max(tg.netUntil || 0, now + (T.id === 'huene' ? 0.7 : 0.4));
      tg.netSlow = T.id === 'huene' ? 0.35 : 0.55;
      if (tg.body && tg.body.velocity) tg.body.velocity.addScaledVector(dir, T.id === 'huene' ? 3 : 1.2);
    }
    this._sound('melee_hit', 0.7, 0.85, _tc);
  }

  /* ================================================================ Klang */

  _sound(name, volume = 0.6, pitch = 1, pos = null) {
    const A = this.G.audio;
    if (!A || typeof A.play !== 'function' || this.camDist > 60) return;
    try { A.play(name, { position: pos || this.getEyePosition(_eye), actor: this, volume, pitch: pitch * rnd(0.94, 1.06) }); } catch { /* Klang optional */ }
  }

  /** Stöhnen/Röcheln: tief gestimmte Schmerzlaute und Ausatmen der vorhandenen Klangbank (keine neuen Aufnahmen). */
  _voice(now) {
    if (now < this._voiceAt) return;
    const hunting = this._mode === 'hetzen';
    this._voiceAt = now + rnd(4, 10) * (hunting ? 0.55 : 1);
    if (this.camDist > 45) return;
    const r = Math.random();
    if (r < 0.62) this._sound('pain', hunting ? 0.62 : 0.45, this.type.pitch);
    else this._sound('breath_out', 0.5, this.type.pitch * 0.9);
  }

  /* ================================================================ Bild */

  update(dt) {
    if (this.puppet) { super.update(dt); return; }
    if (!this.alive) { this._updateCorpses(dt); return; }
    const G = this.G;
    const now = G.time.elapsed;
    const frozen = G.match.state !== 'playing' && !G.match.netLive;
    const body = this.body;
    const world = G.world;
    const T = this.type;

    // --- Wahrnehmen + Entscheiden (gestaffelt)
    this._senseDt += dt;
    this._senseT -= dt;
    if (this._senseT <= 0) {
      this._senseT += (1 / (this.diff.senseHz * (this.lodSense || 1))) * rnd(0.85, 1.15);
      sense(this, now, this._senseDt);
      this._senseDt = 0;
    }
    if (!frozen) {
      this._thinkT -= dt;
      if (this._thinkT <= 0) { this._thinkT = 0.35 * (this.lodThink || 1) * rnd(0.8, 1.25); this._think(now); }
    }

    // --- Bewegung
    let mx = 0, mz = 0, wantJump = false;
    const tg = this._target;
    if (!frozen && this._hasGoal) {
      if (this._direct && tg && tg.alive) {
        mx = tg.position.x - this.position.x; mz = tg.position.z - this.position.z;
        const l = Math.hypot(mx, mz);
        if (l > T.reach * 0.7) { mx /= l; mz /= l; } else { mx = 0; mz = 0; }
        this.nav.update(dt, now, false);
      } else {
        this.nav.goTo(this._goal, this._zGo);
        const d = this.nav.update(dt, now, !this.nav.arrived);
        if (!this.nav.arrived) { mx = d.x; mz = d.z; }
        if (this.nav.jump) wantJump = true;
      }
      const sep = this._separation(_w);
      mx += sep.x * 0.7; mz += sep.z * 0.7;
      const l = Math.hypot(mx, mz);
      if (l > 1) { mx /= l; mz /= l; }
    }
    this._updateAttack(dt, now, frozen);
    const attacking = this._atk.phase !== 'idle';
    if (attacking) { mx *= 0.15; mz *= 0.15; }
    if (now < this.staggerUntil) { mx *= 0.2; mz *= 0.2; wantJump = false; }
    const netted = now < (this.netUntil || 0);
    const speed = this._speed * this.slow * (netted ? this.netSlow ?? 0.15 : 1);
    const tx = mx * speed, tz = mz * speed;
    const v = body.velocity;
    if (body.onGround) {
      const k = (tx * v.x + tz * v.z) >= 0 && (tx || tz) ? (T.id === 'hetzer' ? 10 : 6) : 8;
      const a = 1 - Math.exp(-k * dt);
      v.x += (tx - v.x) * a;
      v.z += (tz - v.z) * a;
    } else {
      const a = 1 - Math.exp(-1.6 * dt);
      v.x += (tx - v.x) * a * 0.5;
      v.z += (tz - v.z) * a * 0.5;
    }
    if (!frozen && wantJump && body.onGround) { v.y = JUMP_V; body.onGround = false; }
    const wasGround = body.onGround;
    const vyBefore = v.y;
    body.step(dt, world, STEP_OPTS);
    if (!wasGround && body.onGround && -vyBefore > FALL_SAFE && G.combat && !frozen) {
      G.combat.damage(this, { amount: (-vyBefore - FALL_SAFE) * 9, attacker: null, weaponId: 'fall', zone: 'body', dir: new THREE.Vector3(0, -1, 0) });
      if (!this.alive) return;
    }
    if (body.outOfWorld && G.combat) { G.combat.damage(this, { amount: 9999, attacker: null, weaponId: 'world' }); return; }
    if (world && world.bounds) this._clamp(world.bounds);

    // --- Blick: nahes Ziel ansehen, sonst in Laufrichtung (träge drehen)
    let want = null;
    if (tg && tg.alive && (this._direct || attacking)) want = Math.atan2(-(tg.position.x - this.position.x), -(tg.position.z - this.position.z));
    else if (Math.hypot(v.x, v.z) > 0.25) want = Math.atan2(-v.x, -v.z);
    if (want != null) {
      const rate = (T.id === 'hetzer' ? 7 : T.id === 'huene' ? 2.6 : 3.4) * dt;
      this.yaw = wrap(this.yaw + clamp(wrap(want - this.yaw), -rate, rate));
    }
    this.pitch = -0.08;
    const hs = Math.hypot(v.x, v.z);
    this.sprinting = hs > 4.2;
    this.crouching = false;

    if (!frozen) this._voice(now);
    this._animateZombie(dt, hs, now);
  }

  _animateZombie(dt, hs, now) {
    const s = this.soldier;
    if (!s) return;
    syncRag(s);
    this._animAcc += dt;
    this._animFrame++;
    const every = this.animEvery;
    if (every === 0 || (every > 1 && this._animFrame % every !== 0)) { s.place(this.body.position, s.anim.bodyYaw); return; }
    const adt = Math.min(this._animAcc, 0.25);
    this._animAcc = 0;
    const p = this._ap || (this._ap = { velocity: new THREE.Vector3() });
    p.velocity.copy(this.body.velocity);
    p.aimYaw = this.yaw;
    p.aimPitch = -0.12;
    p.crouch = false;
    p.sprint = this.sprinting;
    p.ads = 0;
    p.onGround = this.body.onGround;
    p.firing = false;
    p.reloading = false;
    p.throwing = false;
    p.cooking = false;
    p.meleeing = false;
    p.idleLook = false;
    p.lean = 0;
    p.prone = false;
    p.obstruct = 0;
    p.position = this.body.position;
    s.animate(adt, p);
    applyZombiePose(s, { look: this.look, attack: this._atkK, speed: hs, time: now, slow: this.slow });
    if (s.anim.events && s.anim.events.footstep >= 0) this.manager.footstep(this);
  }
}

/** Gemeinsame Warteschlange: neuen Untoten anlegen (Liste des Managers + Akteure, ohne Namensschild). */
export function createZombie(manager, opts) {
  const G = manager.G;
  const z = new Zombie(manager, opts);
  manager.bots.push(z);
  if (!G.actors.includes(z)) G.actors.push(z);
  void _v;
  return z;
}
