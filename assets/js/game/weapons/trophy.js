// NULLPUNKT — Trophäensystem (13.11.): taktisches Abwehrgerät. Wird wie eine Granate geworfen (EQUIPMENT.trophy), bleibt
// liegen und stellt sich auf (GrenadeSystem → _boom → deploy). Der drehende Sensorkopf erfasst feindliche Granaten
// (alle Wurfmittel außer eigenen/verbündeten), Granatwerfer-Geschosse und Raketen im Umkreis trophy.radius m mit
// Sichtlinie und schießt sie ab: Lichtblitz, Leuchtspur vom Abfangrohr, Funken, kurzer Knall – das Geschoss verschwindet
// ohne Wirkung. trophy.charges Ladungen (trophy.rearm s Pause dazwischen), danach zerlegt es sich. Kugeln/Messer beschädigen
// es (Trefferbox in world.targets, Schaden über das 'impact'-Ereignis), trophy.health bis zur Zerstörung.
// Je Besitzer steht höchstens eines (ein neues ersetzt das alte).
//
// Mehrspieler: Host (bzw. offline) entscheidet Abfangen und Zerstörung → Ereignisse trophy:intercept / trophy:destroy
// (net/sync-host.js 'ti'/'td'); Clients stellen das Gerät über die Zündung der Wurf-Granate auf ('gb' → remoteBoom →
// deploy, Id = Granaten-Id des Hosts) und spielen Abfangen/Zerstörung nach (remoteIntercept/remoteDestroy).

import * as THREE from 'three';

const MAX_LIVE = 16;
const UP = new THREE.Vector3(0, 1, 0);
const HEAD_Y = 0.275;  // Höhe des Sensorkopfs über dem Boden (gear2.js trophyDeployed)
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3();

const easeOutBack = (t) => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export class TrophySystem {
  constructor(grenades) {
    this.grenades = grenades;
    this.list = [];
    this._fx = [];
    this._off = null;
    this._glow = null;
    this._beamMat = null;
    this._beamGeo = null;
  }

  get G() { return this.grenades.G; }

  /** Mehrspieler-Client: nur Darstellung, Entscheidungen kommen vom Host. */
  _replica() {
    const M = this.G.match;
    return !!(M && M.netRole === 'client');
  }

  find(id) { return this.list.find((t) => t.id === id) || null; }

  /* ------------------------------------------------------------ Aufstellen */

  /** Gerät an `p` (Wurf-Endpunkt) aufstellen. id = Granaten-Id (Host) bzw. netId (Client). */
  deploy(p, eq, owner, id) {
    const G = this.G;
    if (!G.scene) return null;
    if (id != null && this.find(id)) return this.find(id);
    const T = eq.trophy || {};
    // Boden unter dem Wurf-Endpunkt (liegt die Granate an einer Wand, rutscht das Gerät herunter)
    const pos = p.clone();
    let normal = UP.clone();
    const w = G.world;
    if (w && typeof w.raycast === 'function') {
      const hit = w.raycast(_a.set(p.x, p.y + 0.3, p.z), _d.set(0, -1, 0), 6);
      if (hit && hit.targetId == null && !hit.entity) { pos.copy(hit.point); if (hit.normal && hit.normal.y > 0.6) normal = hit.normal.clone(); }
    }
    // je Besitzer eines; Obergrenze
    if (owner) for (const t of [...this.list]) if (t.owner === owner) this._remove(t);
    while (this.list.length >= MAX_LIVE) this._remove(this.list[0]);

    const group = new THREE.Group();
    group.name = 'trophaeensystem';
    group.position.copy(pos);
    group.quaternion.setFromUnitVectors(UP, normal);
    const yaw = owner && Number.isFinite(owner.yaw) ? owner.yaw : Math.random() * Math.PI * 2;
    group.rotateY(yaw);
    const body = this._model();
    group.add(body);
    const head = body.getObjectByName('trophyHead') || null;
    const led = body.getObjectByName('led') || null;
    const muzzle = body.getObjectByName('muzzle') || null;
    // LED-Schein (Sprite) – auch auf Entfernung lesbar
    const glow = new THREE.Sprite(this._glowMat());
    glow.scale.setScalar(0.07);
    glow.position.set(0, 0.24, -0.046);
    glow.renderOrder = 5;
    group.add(glow);
    G.scene.add(group);

    const now = G.time ? G.time.elapsed : 0;
    const t = {
      id: id != null ? id : `t${now}`, owner: owner || null, team: owner ? owner.team : null, position: pos.clone(), eq,
      radius: T.radius || 9, charges: T.charges || 2, maxCharges: T.charges || 2, health: T.health || 60, rearm: T.rearm ?? 0.45,
      cool: 0.6, age: 0, alive: true, group, body, head, led, glow, muzzle, spin: 0, aimYaw: null, hitT: 0, dying: 0,
      remote: this._replica(),
    };
    body.scale.set(1, 0.05, 1);
    // Trefferbox (Kugeln): world.targets – lokaler Quader um Gehäuse und Kopf
    t.target = {
      id: `trophy:${t.id}`, surface: 'metal', hittable: () => t.alive && t.dying === 0,
      hitboxes: [{ object: group, min: new THREE.Vector3(-0.06, 0.16, -0.06), max: new THREE.Vector3(0.06, 0.31, 0.06), zone: 'body' }],
    };
    if (w && Array.isArray(w.targets)) w.targets.push(t.target);
    this.list.push(t);
    this._listen();
    if (G.audio && typeof G.audio.play === 'function') { try { G.audio.play('grenade_stick', { position: pos.clone(), volume: 0.9 }); } catch { /* Klang ist Beiwerk */ } }
    G.events.emit('trophy:deploy', { trophy: t, owner: t.owner, position: pos.clone() });
    if (owner && owner.isPlayer && G.hud && typeof G.hud._notice === 'function') { try { G.hud._notice('Trophäensystem aktiv', 'info', null, 1.4); } catch { /* */ } }
    return t;
  }

  _model() {
    const models = this.G.modules && this.G.modules.models;
    let m = null;
    try { if (models && models.createWeaponModel) m = models.createWeaponModel('trophyDeployed', { lod: 'first' }); } catch (err) { m = null; console.warn('[trophy] Modell', err); }
    if (!m) {
      // Notmodell: Dreibein aus Grundkörpern
      m = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x3f4630, roughness: 0.7, metalness: 0.2 });
      const bodyM = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.045, 0.06, 16), mat);
      bodyM.position.y = 0.24;
      m.add(bodyM);
      const head = new THREE.Group();
      head.name = 'trophyHead';
      head.position.y = HEAD_Y;
      head.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.2, metalness: 0.6 })));
      m.add(head);
    }
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return m;
  }

  _glowMat() {
    if (this._glow) return this._glow;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.2, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.25)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._glowTex = tex;
    this._glow = new THREE.SpriteMaterial({ map: tex, color: 0x40ff70, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    return this._glow;
  }

  /* ------------------------------------------------------------ Simulation */

  update(dt) {
    if (this._fx.length) this._updateFx(dt);
    if (!this.list.length) return;
    const G = this.G;
    const replica = this._replica();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.age += dt;
      // Aufklappen: Dreibein wächst mit leichtem Überschwingen
      const u = Math.min(1, t.age / 0.45);
      if (t.dying > 0) {
        t.dying += dt;
        const k = Math.max(0, 1 - t.dying * 2.2);
        t.body.scale.set(1, Math.max(0.05, k), 1);
        t.body.rotation.z = Math.min(0.9, t.dying * 2.5);
        t.glow.visible = false;
        if (t.dying > 0.6) { this._remove(t); continue; }
        continue;
      }
      t.body.scale.set(1, 0.05 + 0.95 * easeOutBack(u), 1);
      // Sensorkopf: kreist suchend, zielt beim Abfangen kurz auf das Geschoss
      if (t.head) {
        if (t.aimYaw != null) {
          const cur = t.head.rotation.y;
          const diff = Math.atan2(Math.sin(t.aimYaw - cur), Math.cos(t.aimYaw - cur));
          t.head.rotation.y = cur + diff * Math.min(1, dt * 30);
          t.aimT -= dt;
          if (t.aimT <= 0) t.aimYaw = null;
        } else t.head.rotation.y += dt * (u < 1 ? 0 : 2.4);
      }
      // LED: grün pulsierend (bereit), gelb beim Nachladen, rot bei der letzten Ladung bzw. Schaden
      t.cool = Math.max(0, t.cool - dt);
      t.hitT = Math.max(0, t.hitT - dt);
      const last = t.charges <= 1 || t.health < 25;
      const col = t.hitT > 0 ? 0xffffff : t.cool > 0 ? 0xffb020 : last ? 0xff3020 : 0x40ff70;
      const pulse = last ? (Math.sin(t.age * 14) > 0 ? 1 : 0.15) : 0.55 + 0.45 * Math.sin(t.age * 4);
      t.glow.visible = u >= 1;
      t.glow.material = this._ledVariant(col);
      t.glow.scale.setScalar(0.05 + 0.04 * pulse);
      if (replica || t.remote || u < 1 || t.cool > 0) continue;
      this._scan(t);
    }
  }

  /** LED-Farben als geteilte Sprite-Materialien (keine Materialien je Bild). */
  _ledVariant(hex) {
    if (!this._ledMats) this._ledMats = new Map();
    let m = this._ledMats.get(hex);
    if (!m) { m = this._glowMat().clone(); m.color.setHex(hex); this._ledMats.set(hex, m); }
    return m;
  }

  _hostile(t, actor) {
    if (!actor) return true;
    if (actor === t.owner) return false;
    if (t.owner && actor.isStreakEntity && actor.owner === t.owner) return false;
    const C = this.G.combat;
    if (t.owner && C && typeof C.isHostile === 'function') return C.isHostile(t.owner, actor);
    if (t.team != null && actor.team != null) return actor.team !== t.team;
    return true;
  }

  _headPos(t, out) {
    const q = t.group ? t.group.quaternion : null;
    _up.set(0, 1, 0);
    if (q) _up.applyQuaternion(q);
    return out.copy(t.position).addScaledVector(_up, HEAD_Y);
  }

  _scan(t) {
    const G = this.G;
    const head = this._headPos(t, _a);
    const r2 = t.radius * t.radius;
    const W = G.weapons;
    let best = null, bd = r2, kind = null;
    for (const g of this.grenades.list) {
      if (g.remote || !g.mesh || (g.eq && g.eq.trophy) || !this._hostile(t, g.actor)) continue;
      const d = g.position.distanceToSquared(head);
      if (d < bd) { bd = d; best = g; kind = 'grenade'; }
    }
    const rs = W && W.rocketSystem;
    if (rs) for (const r of rs.list) {
      if (r.remote || !this._hostile(t, r.actor)) continue;
      const d = r.pos.distanceToSquared(head);
      if (d < bd) { bd = d; best = r; kind = 'rocket'; }
    }
    if (!best) return;
    const at = kind === 'rocket' ? best.pos : best.position;
    if (G.world && typeof G.world.lineOfSight === 'function' && !G.world.lineOfSight(head, at)) return;
    this.intercept(t, best, kind);
  }

  /** Geschoss abfangen (Host/offline): entfernen ohne Wirkung, Effekt, Ladung verbrauchen. */
  intercept(t, proj, kind) {
    const G = this.G;
    const at = (kind === 'rocket' ? proj.pos : proj.position).clone();
    if (kind === 'rocket') { const rs = G.weapons && G.weapons.rocketSystem; if (rs) rs._remove(proj); }
    else this.grenades.removeSilently(proj);
    t.charges -= 1;
    t.cool = t.rearm;
    this._fxIntercept(t, at);
    const ownerName = t.owner && t.owner.isPlayer;
    G.events.emit('trophy:intercept', {
      trophy: t, owner: t.owner, kind, position: at.clone(), projectile: proj,
      gid: kind === 'grenade' ? proj.id : null, rid: kind === 'rocket' ? proj.id : null, attacker: proj.actor || null,
    });
    if (ownerName && G.hud && typeof G.hud._notice === 'function') { try { G.hud._notice(kind === 'rocket' ? 'Rakete abgefangen' : 'Granate abgefangen', 'info', null, 1.2); } catch { /* */ } }
    if (t.charges <= 0) this.destroy(t, 'leer', null);
  }

  /** Zerstörung (Host/offline): leer geschossen oder durch Treffer. */
  destroy(t, why = 'leer', by = null) {
    if (!t || !t.alive || t.dying > 0) return;
    const G = this.G;
    t.dying = 0.001;
    this._unregister(t);
    this._fxBreak(t, why);
    G.events.emit('trophy:destroy', { trophy: t, owner: t.owner, why, by, position: t.position.clone() });
    if (t.owner && t.owner.isPlayer && why !== 'leer' && G.hud && typeof G.hud._notice === 'function') { try { G.hud._notice('Trophäensystem zerstört', 'enemy', null, 1.4); } catch { /* */ } }
  }

  /* ------------------------------------------------------------ Mehrspieler (Client) */

  /** Abfangen vom Host nachspielen. */
  remoteIntercept(tid, kind, pid, position) {
    const G = this.G;
    if (kind === 'rocket') {
      const rs = G.weapons && G.weapons.rocketSystem;
      const r = rs && pid != null ? rs.findNet(pid) : null;
      if (r) rs._remove(r);
    } else {
      const g = pid != null ? this.grenades.findNet(pid) : null;
      if (g) this.grenades.removeSilently(g);
    }
    const t = this.find(tid);
    if (!t) return;
    t.charges = Math.max(0, t.charges - 1);
    t.cool = t.rearm;
    if (position) this._fxIntercept(t, position);
  }

  remoteDestroy(tid, why = 'leer') {
    const t = this.find(tid);
    if (!t || t.dying > 0) return;
    t.dying = 0.001;
    this._unregister(t);
    this._fxBreak(t, why);
  }

  /* ------------------------------------------------------------ Treffer */

  _listen() {
    if (this._off || !this.G.events || typeof this.G.events.on !== 'function') return;
    this._off = this.G.events.on('impact', (e) => this._onImpact(e));
  }

  _onImpact(e) {
    if (!e || !e.point || !this.list.length || this._replica()) return;
    const shooter = e.shooter || null;
    for (const t of this.list) {
      if (!t.alive || t.dying > 0 || t.remote) continue;
      // Treffpunkt im lokalen Quader (+2 cm)?
      _m.copy(t.group.matrixWorld).invert();
      _b.copy(e.point).applyMatrix4(_m);
      const hb = t.target.hitboxes[0];
      if (_b.x < hb.min.x - 0.02 || _b.x > hb.max.x + 0.02 || _b.y < hb.min.y - 0.02 || _b.y > hb.max.y + 0.02 || _b.z < hb.min.z - 0.02 || _b.z > hb.max.z + 0.02) continue;
      if (shooter && !this._hostile(t, shooter)) return;
      const W = this.G.data && this.G.data.WEAPONS;
      const def = W && e.weaponId ? W[e.weaponId] : null;
      const dmg = e.melee ? 60 : def && def.damage ? Math.max(8, def.damage.max * (def.pellets > 1 ? 0.5 : 1)) : 25;
      t.health -= dmg;
      t.hitT = 0.08;
      if (this.G.effects && typeof this.G.effects.impact === 'function') { try { this.G.effects.impact(e.point, e.normal || UP, 'metal', {}); } catch { /* */ } }
      if (t.health <= 0) this.destroy(t, 'zerschossen', shooter);
      return;
    }
  }

  /* ------------------------------------------------------------ Effekte */

  _fxIntercept(t, at) {
    const G = this.G;
    const head = this._headPos(t, new THREE.Vector3());
    // Kopf auf das Ziel drehen (lokal im Gerät)
    if (t.head) {
      _d.subVectors(at, head);
      _m.copy(t.group.matrixWorld).invert();
      _b.copy(_d).transformDirection(_m);
      t.aimYaw = Math.atan2(-_b.x, -_b.z);   // Abfangrohr zeigt im Bauplan nach −Z (u vorwärts)
      t.aimT = 0.35;
    }
    const from = head.clone().add(_d.subVectors(at, head).normalize().multiplyScalar(0.07));
    // Leuchtspur (eigener Strahl) + Spur des Effektsystems
    if (G.scene) {
      if (!this._beamGeo) {
        this._beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
        this._beamGeo.translate(0, 0.5, 0);
        this._beamMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      }
      const len = from.distanceTo(at);
      const beam = new THREE.Mesh(this._beamGeo, this._beamMat.clone());
      beam.position.copy(from);
      beam.quaternion.setFromUnitVectors(UP, _d.subVectors(at, from).normalize());
      beam.scale.set(0.006, len, 0.006);
      beam.renderOrder = 6;
      G.scene.add(beam);
      const flash = new THREE.Sprite(this._ledVariant(0xffe2b0).clone());
      flash.position.copy(at);
      flash.scale.setScalar(0.2);
      flash.renderOrder = 6;
      G.scene.add(flash);
      const muz = new THREE.Sprite(this._ledVariant(0xfff0d0).clone());
      muz.position.copy(from);
      muz.scale.setScalar(0.12);
      muz.renderOrder = 6;
      G.scene.add(muz);
      this._fx.push({ objs: [beam, flash, muz], t: 0, life: 0.22, beam, flash, muz });
    }
    const E = G.effects;
    if (E) {
      try { if (typeof E.tracer === 'function') E.tracer(from, at, {}); } catch { /* */ }
      try { if (typeof E.impact === 'function') E.impact(at, _d.subVectors(head, at).normalize(), 'metal', { big: true }); } catch { /* */ }
      try { if (typeof E.muzzleLight === 'function') E.muzzleLight(at, 18, 2, 0.09, 7); } catch { /* */ }
      try { if (typeof E.wisp === 'function') { E.wisp(at, { strength: 1 }); E.wisp(at, { strength: 1 }); } } catch { /* */ }
    }
    const A = G.audio;
    if (A && typeof A.play === 'function') {
      try { A.play('explosion', { position: at.clone(), volume: 0.22, radius: 1, concuss: false }); } catch { /* */ }
      try { A.play('impact', { position: at.clone(), surface: 'metal', volume: 1 }); } catch { /* */ }
      try { A.play('ricochet', { position: head.clone(), volume: 0.6 }); } catch { /* */ }
    }
  }

  _fxBreak(t) {
    const G = this.G;
    const head = this._headPos(t, new THREE.Vector3());
    const E = G.effects;
    if (E) {
      try { if (typeof E.impact === 'function') E.impact(head, UP, 'metal', { big: true }); } catch { /* */ }
      try { if (typeof E.wisp === 'function') for (let i = 0; i < 3; i++) E.wisp(head, { strength: 1 }); } catch { /* */ }
      try { if (typeof E.muzzleLight === 'function') E.muzzleLight(head, 8, 1, 0.06, 4); } catch { /* */ }
    }
    const A = G.audio;
    if (A && typeof A.play === 'function') {
      try { A.play('impact', { position: head.clone(), surface: 'metal', volume: 1 }); } catch { /* */ }
      try { A.play('explosion', { position: head.clone(), volume: 0.12, radius: 1, concuss: false }); } catch { /* */ }
    }
  }

  _updateFx(dt) {
    for (let i = this._fx.length - 1; i >= 0; i--) {
      const f = this._fx[i];
      f.t += dt;
      const k = Math.max(0, 1 - f.t / f.life);
      f.beam.material.opacity = k * k;
      f.beam.scale.x = f.beam.scale.z = 0.006 * (0.4 + k);
      f.flash.material.opacity = k;
      f.flash.scale.setScalar(0.2 + (1 - k) * 0.9);
      f.muz.material.opacity = k * k;
      if (f.t < f.life) continue;
      for (const o of f.objs) { o.removeFromParent(); if (o.material) o.material.dispose(); }
      this._fx.splice(i, 1);
    }
  }

  /* ------------------------------------------------------------ Aufräumen */

  _unregister(t) {
    t.alive = false;
    const w = this.G.world;
    if (t.target && w && Array.isArray(w.targets)) { const i = w.targets.indexOf(t.target); if (i >= 0) w.targets.splice(i, 1); }
  }

  _remove(t) {
    this._unregister(t);
    const i = this.list.indexOf(t);
    if (i >= 0) this.list.splice(i, 1);
    if (t.group) t.group.removeFromParent();
    t.group = null;
    if (!this.list.length && this._off) { this._off(); this._off = null; }
  }

  clear() {
    for (const t of [...this.list]) this._remove(t);
    for (const f of this._fx) for (const o of f.objs) { o.removeFromParent(); if (o.material) o.material.dispose(); }
    this._fx.length = 0;
    if (this._off) { this._off(); this._off = null; }
  }

  dispose() {
    this.clear();
    if (this._glow) { this._glow.dispose(); this._glowTex.dispose(); this._glow = null; }
    if (this._ledMats) { for (const m of this._ledMats.values()) m.dispose(); this._ledMats.clear(); }
    if (this._beamGeo) { this._beamGeo.dispose(); this._beamMat.dispose(); this._beamGeo = null; }
  }
}
