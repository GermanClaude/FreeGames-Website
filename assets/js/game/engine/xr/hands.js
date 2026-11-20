// NULLPUNKT — VR: Handgriffe wie in einem echten VR-Shooter (plattform, 19.11.). Ergänzt engine/xr/index.js:
//
// Nachladen per Hand (Einstellung vrReload 'hand'; 'einfach' = Taste wie bisher):
//   1. Taste „Nachladen“ (Standard: X der Nebenhand) wirft das Magazin aus – es fällt sichtbar zu Boden. Eine Patrone bleibt
//      im Patronenlager, wenn noch eine drin war; die übrigen Patronen gehen in den Vorrat zurück (wie beim normalen
//      Nachladen – online gleich fair für alle).
//   2. Nebenhand an den Bauch/Gürtel (Magazintasche), Griff-Taste halten → neues Magazin in der Hand.
//   3. Magazin von unten an den Schacht führen (≤ 9 cm) → rastet ein, Waffe gefüllt.
//   4. War das Patronenlager leer: mit der Nebenhand hinten am Verschluss/Schlitten greifen und ≥ 4 cm (Pistole 3 cm) nach
//      hinten ziehen → durchgeladen. Ersatz: Nachlade-Taste drücken.
//   Nur für Waffen mit Wechselmagazin und erkennbarem Schacht (Teil 'mag'); Gurt-MG, Röhrenmagazin (Patrone für Patrone),
//   Werfer und Messer laden weiter vereinfacht.
// Granate am Körper (vrGrenadeGrab): Nebenhand vorn an die Brust auf der Seite der Nebenhand, Griff-Taste halten → Granate
//   in der Hand; Abzug der Nebenhand zieht den Splint (Zünder läuft bei Splittergranaten), Griff loslassen wirft sie mit dem
//   Schwung der Hand. Ohne Splint loslassen = zurück an die Weste.
// Munitionszähler an der Waffe (vrGunAmmo): kleine Anzeige links am Gehäuse (Patronen im Magazin, Vorrat, „LEER“,
//   „DURCHLADEN“), nur neu gezeichnet bei Änderung.
//
// Alles läuft in Weltkoordinaten der Hände aus dem letzten Bild (wie die Waffenpose) und nur während einer VR-Sitzung.
// Zonen im Trackingraum relativ zum Kopf (Kopf-Gierwinkel): x nach rechts, y hoch, z nach hinten (wie die Holster).
// Reine Logik (Zustände, Zonen, Wurfgeschwindigkeit) ist ohne Browser prüfbar (scratchpad/plat/test-xr-hands.mjs).

import * as THREE from 'three';

export const MAG_ZONE = { dyMin: -0.95, dyMax: -0.42, backMin: -0.42, backMax: 0.12, side: 0.32 }; // Bauch/Gürtel vorn
export const NADE_ZONE = { dyMin: -0.5, dyMax: -0.18, backMin: -0.32, backMax: 0.1, sideMin: 0.04, sideMax: 0.36 }; // Brust, Seite der Nebenhand
export const INSERT_R = 0.09; // m Magazin ↔ Schacht
export const RACK_R = 0.1; // m Hand ↔ Verschluss/Schlitten zum Greifen
export const RACK_PULL = 0.045; // m Zug nach hinten (Pistole RACK_PULL_PISTOL)
const RACK_PULL_PISTOL = 0.03;
const THROW_GAIN = 1.5; // Wurf: Handgeschwindigkeit × Faktor (Arm ist länger als die Hand misst, wie in VR-Spielen üblich)
const THROW_MIN = 3;
const THROW_MAX = 24;
const DROP_LIFE = 6; // s, so lange liegen ausgeworfene Magazine
const RACK_PARTS = ['charge', 'slide', 'boltHandle', 'bolt'];
const NO_HAND_RELOAD = new Set(['melee', 'launcher', 'lmg', 'hmg']);

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _down = new THREE.Vector3(0, -1, 0);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Lage eines Punkts p relativ zum Kopf (Trackingraum, Kopf-Gierwinkel): { right, dy, back }. headQuat dreht −Z in die
 * Blickrichtung. side: +1 = rechts, −1 = links.
 */
export function relToHead(p, headPos, headQuat, out = {}) {
  _v.set(0, 0, -1).applyQuaternion(headQuat);
  let fx = _v.x, fz = _v.z;
  const fl = Math.hypot(fx, fz) || 1;
  fx /= fl; fz /= fl;
  const dx = p.x - headPos.x, dy = p.y - headPos.y, dz = p.z - headPos.z;
  out.right = dx * -fz + dz * fx;
  out.back = -(dx * fx + dz * fz);
  out.dy = dy;
  return out;
}

/** Liegt der Punkt (relToHead) in der Magazintasche? */
export function inMagZone(r) {
  const z = MAG_ZONE;
  return r.dy > z.dyMin && r.dy < z.dyMax && r.back > z.backMin && r.back < z.backMax && Math.abs(r.right) < z.side;
}

/** Liegt der Punkt in der Granatenzone? offSign: +1 Nebenhand rechts, −1 links. */
export function inNadeZone(r, offSign) {
  const z = NADE_ZONE;
  const s = r.right * offSign;
  return r.dy > z.dyMin && r.dy < z.dyMax && r.back > z.backMin && r.back < z.backMax && s > z.sideMin && s < z.sideMax;
}

/** Kann diese Waffe per Hand nachgeladen werden? def = Waffendefinition, hasMag = Modell hat ein Teil 'mag'. */
export function handReloadable(def, hasMag = true) {
  if (!def || !hasMag) return false;
  if (!(def.mag > 0) || def.perShellReload || def.breakAction || def.belt) return false;
  return !NO_HAND_RELOAD.has(def.cls);
}

/**
 * Wurfgeschwindigkeit aus dem Verlauf der Handpositionen [{ p: Vector3, t }] (älteste zuerst): Mittel über die letzten
 * ≈ 80 ms, × THROW_GAIN, Betrag begrenzt. → { vel: Vector3, speed } oder null (zu wenig Daten).
 */
export function throwVelocity(hist, out = new THREE.Vector3()) {
  if (!hist || hist.length < 2) return null;
  const last = hist[hist.length - 1];
  let first = hist[0];
  for (let i = hist.length - 2; i >= 0; i--) { first = hist[i]; if (last.t - hist[i].t >= 0.08) break; }
  const dt = last.t - first.t;
  if (dt <= 1e-4) return null;
  out.subVectors(last.p, first.p).multiplyScalar(THROW_GAIN / dt);
  let speed = out.length();
  if (speed > THROW_MAX) { out.multiplyScalar(THROW_MAX / speed); speed = THROW_MAX; }
  return { vel: out, speed };
}

/**
 * Magazin-Zustand je Waffenplatz (Felder am Platz-Objekt der Waffensteuerung): vrMagOut, vrNeedsRack. Reine Logik:
 *   eject(st, def, inf)   → bool   Magazin raus (Lager behält 1 Patrone, Rest zurück in den Vorrat)
 *   insert(st, def, inf)  → bool   neues Magazin rein (füllt bis def.mag aus dem Vorrat); Lager leer → vrNeedsRack
 *   rack(st)              → bool   durchgeladen
 */
export const MagLogic = {
  canEject(st, def, inf) {
    if (!st || !def || st.vrMagOut) return false;
    if (st.mag >= def.mag) return false;
    return inf || st.reserve > 0;
  },
  eject(st, def, inf) {
    if (!MagLogic.canEject(st, def, inf)) return false;
    const chamber = st.mag > 0 ? 1 : 0;
    const back = st.mag - chamber;
    if (!inf) st.reserve += back;
    st.mag = chamber;
    st.vrMagOut = true;
    st.vrChamber = chamber;
    return true;
  },
  insert(st, def, inf) {
    if (!st || !def || !st.vrMagOut) return false;
    const want = Math.max(0, def.mag - st.mag);
    const add = inf ? want : Math.min(want, st.reserve);
    st.mag += add;
    if (!inf) st.reserve -= add;
    st.vrMagOut = false;
    st.vrNeedsRack = !st.vrChamber && st.mag > 0;
    return true;
  },
  rack(st) {
    if (!st || !st.vrNeedsRack || st.vrMagOut) return false;
    st.vrNeedsRack = false;
    st.vrChamber = 1;
    return true;
  },
  clear(st) { if (st) { st.vrMagOut = false; st.vrNeedsRack = false; st.vrChamber = 0; } },
};

export class VrHands {
  /** xr = XRSystem (engine/xr/index.js). */
  constructor(xr) {
    this.xr = xr;
    this.G = xr.G;
    /** null | 'mag' | 'grenade' | 'rack' – was die Nebenhand gerade tut. */
    this.holding = null;
    this._grip = false;
    this._trig = false;
    this._hist = [];
    this._nade = null; // { type, mesh, pinned, cook, fuse, cookable, eq }
    this._mag = null; // Klon des Magazins in der Hand
    this._rack = null; // { start: Vector3, part, rest: Vector3, pull }
    this._drops = [];
    this._lastSlot = null;
    this._ammo = null; // { mesh, ctx, tex, key }
    this._block = new Set();
    this._zoneHint = null;
    /** Zähler für Tests. */
    this.stats = { ejects: 0, inserts: 0, racks: 0, throws: 0, grabs: 0 };
  }

  get manual() { return this.G.settings.get('vrReload') !== 'einfach'; }
  /** Nebenhand belegt (keine Vorderschaft-Griff-Erkennung in engine/xr _solveGun). */
  get busy() { return this.holding != null; }

  /** Zusätzlich gesperrte Aktionen (Granate in der Hand: kein zweiter Wurf über die Taste). */
  get block() { return this._block.size ? this._block : null; }

  _weapon() {
    const p = this.G.player;
    return p && p.weapon ? p.weapon : null;
  }

  _vm() { return this.G.viewmodel && this.G.viewmodel.rig; }

  _part(name) {
    const vm = this._vm();
    const e = vm && vm.cur;
    return e && e.ud && e.ud.parts ? e.ud.parts[name] || null : null;
  }

  /** Waffenplatz + Definition, wenn diese Waffe per Hand nachgeladen wird. */
  _manualSlot() {
    const w = this._weapon();
    if (!w || !this.manual || w.sim) return null; // Infanteriesimulation (isim) hat eigene Handgriffe
    const st = w.current;
    const def = st && st.def;
    if (!handReloadable(def, !!this._part('mag'))) return null;
    return { w, st, def };
  }

  /** Alles fallen lassen (Tod, Sitzungsende, Fahrzeug, Menü). keepFlags: Magazin-Zustand der Waffen behalten. */
  reset(keepFlags = true) {
    this._release('reset');
    if (!keepFlags) {
      const w = this._weapon();
      if (w && w.slots) for (const s of w.slots) MagLogic.clear(s);
    }
    const w = this._weapon();
    if (w) w.manualReload = false;
    this._block.clear();
    this._hist.length = 0;
    this._grip = false;
    this._trig = false;
  }

  /** Haltegriff/Gegenstand der Nebenhand lösen. why: 'reset' | 'drop' | 'back'. */
  _release(why) {
    if (this.holding === 'grenade' && this._nade) {
      const n = this._nade;
      if (n.pinned && why !== 'back') this._throwNade(true); // gezogener Splint: fällt (zählt als geworfen)
      if (n.mesh) n.mesh.removeFromParent();
      this._nade = null;
    }
    if (this.holding === 'mag' && this._mag) {
      if (why === 'drop' || why === 'reset') this._dropMesh(this._mag);
      else this._mag.removeFromParent();
      this._mag = null;
    }
    if (this._rack && this._rack.part && this._rack.rest) this._rack.part.position.copy(this._rack.rest);
    this._rack = null;
    this.holding = null;
    this._block.delete('grenade');
    this._block.delete('tactical');
  }

  /* ================================================================ je Bild (preUpdate, vor der Simulation) */

  update(dt) {
    const xr = this.xr;
    const G = this.G;
    const p = G.player;
    const input = G.input;
    const w = this._weapon();
    if (!xr.presenting || !xr.ready || !p || !input) return;
    const blocked = !p.alive || p.vehicle || (xr.menu && xr.menu.open);
    // Nachladen per Hand an der Waffensteuerung melden (kein automatisches Nachladen, Durchladen sperrt den Abzug)
    const ms = blocked ? null : this._manualSlot();
    if (w) w.manualReload = !!ms;
    if (!this.manual && w && w.slots) for (const s of w.slots) if (s.vrMagOut || s.vrNeedsRack) MagLogic.clear(s);
    if (blocked) { if (this.holding) this._release(p.alive ? 'back' : 'drop'); return; }
    const O = xr.hands.off;
    const gp = O.gamepad;
    const b = gp && gp.buttons ? gp.buttons : [];
    const gv = b[1] ? b[1].value || (b[1].pressed ? 1 : 0) : 0;
    const tv = b[0] ? b[0].value || (b[0].pressed ? 1 : 0) : 0;
    const was = this._grip;
    this._grip = gv > 0.6 ? true : gv < 0.3 ? false : was;
    const gripEdge = this._grip && !was;
    const gripUp = !this._grip && was;
    const tWas = this._trig;
    this._trig = tv > 0.6 ? true : tv < 0.3 ? false : tWas;
    const trigEdge = this._trig && !tWas;
    // Handverlauf (Welt) für den Wurf
    const now = G.time.real || 0;
    if (O.gripW.ok) {
      const h = this._hist;
      const e = h.length >= 8 ? h.shift() : { p: new THREE.Vector3(), t: 0 };
      e.p.copy(O.gripW.pos); e.t = now;
      h.push(e);
    }
    // Waffenwechsel: Magazin in der Hand zurückstecken
    const slot = w ? w.current : null;
    if (slot !== this._lastSlot) { if (this.holding === 'mag' || this.holding === 'rack') this._release('back'); this._lastSlot = slot; }

    // 1) Magazin auswerfen bzw. (eingesetzt, Lager leer) per Taste durchladen
    if (ms && input.pressed('reload') && !w.isReloading) {
      if (ms.st.vrNeedsRack && !ms.st.vrMagOut) this._doRack(ms);
      else if (MagLogic.eject(ms.st, ms.def, w.infiniteAmmo)) this._onEject(ms);
    }

    // 2) Greifen mit der Nebenhand
    const offSign = xr.offSide === 'right' ? 1 : -1;
    let zone = null;
    if (O.grip.ok && xr.head.ok) {
      const r = relToHead(O.grip.pos, xr.head.pos, xr.head.quat, this._r || (this._r = {}));
      if (ms && ms.st.vrMagOut && inMagZone(r)) zone = 'mag';
      else if (this.G.settings.get('vrGrenadeGrab') !== false && inNadeZone(r, offSign) && this._lethal()) zone = 'grenade';
    }
    if (zone !== this._zoneHint) { this._zoneHint = zone; if (zone) xr._pulse(O, 0.12, 10); }
    if (gripEdge && !this.holding && !xr.gun.two) {
      if (ms && ms.st.vrNeedsRack && !ms.st.vrMagOut && this._nearRack(O)) this._startRack(ms, O);
      else if (zone === 'mag') this._grabMag(ms);
      else if (zone === 'grenade') this._grabNade();
    }

    // 3) Gehaltenes
    if (this.holding === 'mag') {
      if (!ms || !ms.st.vrMagOut) this._release('back');
      else if (this._nearMagwell(O)) this._insert(ms);
      else if (gripUp) this._release('drop');
    } else if (this.holding === 'rack') {
      if (!ms || !ms.st.vrNeedsRack) this._release('back');
      else {
        const r = this._rack;
        const back = _v2.set(0, 0, 1).applyQuaternion(xr.gun.quat);
        r.pull = Math.max(0, _v.subVectors(O.gripW.pos, r.start).dot(back));
        if (r.pull >= r.need) { this._doRack(ms); this._release('back'); }
        else if (gripUp) this._release('back');
      }
    } else if (this.holding === 'grenade') {
      const n = this._nade;
      if (trigEdge && !n.pinned) {
        n.pinned = true;
        G.events.emit('grenade:pin', { actor: p, type: n.type });
        xr._pulse(O, 0.4, 25);
      }
      if (n.pinned && n.cookable) {
        n.cook += dt;
        if (n.cook >= n.fuse) { this._explodeInHand(); return; }
      }
      if (gripUp) {
        if (n.pinned) this._throwNade(false);
        this._release('back');
      }
    }
    if (this.holding === 'grenade') { this._block.add('grenade'); this._block.add('tactical'); }
  }

  _lethal() {
    const w = this._weapon();
    const eq = w && w.equipment && w.equipment.lethal;
    if (!eq || !eq.id || !(eq.count > 0)) return null;
    if (w._throw) return null; // Wurf über die Taste läuft gerade
    return eq;
  }

  /** Weltlage eines Teils (Pivot) → out; false ohne Teil. */
  _partWorld(name, out) {
    const part = this._part(name);
    if (!part) return false;
    part.updateWorldMatrix(true, false);
    out.setFromMatrixPosition(part.matrixWorld);
    return true;
  }

  _nearMagwell(O) {
    if (!O.gripW.ok || !this._partWorld('mag', _v)) return false;
    return O.gripW.pos.distanceTo(_v) < INSERT_R;
  }

  _rackPart() {
    for (const n of RACK_PARTS) { const p = this._part(n); if (p) return { name: n, part: p }; }
    return null;
  }

  _nearRack(O) {
    const rp = this._rackPart();
    if (!O.gripW.ok) return false;
    if (rp) { rp.part.updateWorldMatrix(true, false); _v.setFromMatrixPosition(rp.part.matrixWorld); }
    else _v.set(0, 0.04, 0.03).applyQuaternion(this.xr.gun.quat).add(this.xr.gun.pos); // ohne Teil: hinten oben am Gehäuse
    return O.gripW.pos.distanceTo(_v) < RACK_R;
  }

  _sound(name, vol = 0.9) {
    const a = this.G.audio;
    if (a && typeof a.play === 'function') { try { a.play(name, { player: true, volume: vol }); } catch { /* */ } }
  }

  _onEject(ms) {
    this.stats.ejects++;
    this._sound('reload_mag_out');
    this.xr._pulse(this.xr.hands.main, 0.35, 30);
    // fallendes Magazin (Klon des Teils, im Ego-Bild – gleiche Lichter wie die Waffe)
    const part = this._part('mag');
    if (part) {
      const c = this._cloneMag(part);
      if (c) this._dropMesh(c, true);
    }
    this.G.events.emit('xr:mag', { phase: 'out', weaponId: ms.def.id });
  }

  _grabMag(ms) {
    const part = this._part('mag');
    const c = part ? this._cloneMag(part) : null;
    this._mag = c;
    this.holding = 'mag';
    this.stats.grabs++;
    this.xr._pulse(this.xr.hands.off, 0.3, 20);
    this.G.events.emit('xr:mag', { phase: 'grab', weaponId: ms.def.id });
  }

  _insert(ms) {
    const w = ms.w;
    if (!MagLogic.insert(ms.st, ms.def, w.infiniteAmmo)) return;
    this.stats.inserts++;
    if (this._mag) { this._mag.removeFromParent(); this._mag = null; }
    this.holding = null;
    this._sound('reload_mag_in');
    this.xr._pulse(this.xr.hands.off, 0.55, 35);
    this.xr._pulse(this.xr.hands.main, 0.3, 25);
    this.G.events.emit('xr:mag', { phase: 'in', weaponId: ms.def.id, needsRack: !!ms.st.vrNeedsRack });
  }

  _startRack(ms, O) {
    const rp = this._rackPart();
    this._rack = { start: O.gripW.pos.clone(), pull: 0, need: ms.def.cls === 'pistol' ? RACK_PULL_PISTOL : RACK_PULL, part: rp ? rp.part : null, rest: rp ? rp.part.position.clone() : null };
    this.holding = 'rack';
    this.xr._pulse(O, 0.25, 15);
  }

  _doRack(ms) {
    if (!MagLogic.rack(ms.st)) return;
    this.stats.racks++;
    const pistol = ms.def.cls === 'pistol';
    this._sound(pistol ? 'slide_release' : ms.def.cls === 'sniper' ? 'bolt' : 'reload_bolt');
    this.xr._pulse(this.xr.hands.off, 0.5, 30);
    this.xr._pulse(this.xr.hands.main, 0.4, 30);
    this.G.events.emit('xr:mag', { phase: 'rack', weaponId: ms.def.id });
  }

  _grabNade() {
    const eq = this._lethal();
    if (!eq) return;
    const EQ = (this.G.data && this.G.data.EQUIPMENT) || {};
    const d = EQ[eq.id] || {};
    let mesh = null;
    try { const gs = this.G.weapons && this.G.weapons.grenadeSystem; if (gs && typeof gs._model === 'function') mesh = gs._model(eq.id); } catch { mesh = null; }
    if (mesh) this.xr.group.add(mesh);
    this._nade = { type: eq.id, mesh, pinned: false, cook: 0, fuse: d.fuse || 2.8, cookable: !!d.cookable };
    this.holding = 'grenade';
    this.stats.grabs++;
    this.xr._pulse(this.xr.hands.off, 0.3, 20);
  }

  _throwNade(drop) {
    const n = this._nade;
    const w = this._weapon();
    const p = this.G.player;
    if (!n || !w || !p || n.thrown) return;
    n.thrown = true;
    const eq = w.equipment && w.equipment.lethal;
    if (eq) eq.count = Math.max(0, eq.count - 1);
    const O = this.xr.hands.off;
    const pos = (O.gripW.ok ? O.gripW.pos : this.xr.eye).clone();
    const tv = throwVelocity(this._hist, new THREE.Vector3());
    let vel = tv && tv.speed >= THROW_MIN && !drop ? tv.vel.clone() : new THREE.Vector3(0, 0.5, 0);
    if (p.body && p.body.velocity) vel.add(_v.copy(p.body.velocity).multiplyScalar(0.6));
    const dir = vel.lengthSq() > 1e-6 ? vel.clone().normalize() : new THREE.Vector3(0, -1, 0);
    try {
      if (this.G.weapons && typeof this.G.weapons.throwGrenade === 'function') {
        this.G.weapons.throwGrenade(p, n.type, { pos, vel, origin: pos, dir, speed: vel.length(), cook: n.cookable ? n.cook : 0, drop: !!drop });
      }
    } catch (err) { console.warn('[NULLPUNKT] VR-Wurf:', err); }
    this.stats.throws++;
    this.xr._pulse(O, 0.6, 40);
    this.G.events.emit('xr:throw', { type: n.type, speed: vel.length(), drop: !!drop });
  }

  _explodeInHand() {
    const n = this._nade;
    const w = this._weapon();
    const p = this.G.player;
    if (!n || !w) return;
    n.thrown = true;
    const eq = w.equipment && w.equipment.lethal;
    if (eq) eq.count = Math.max(0, eq.count - 1);
    if (n.mesh) n.mesh.removeFromParent();
    this._nade = null;
    this.holding = null;
    this._block.delete('grenade'); this._block.delete('tactical');
    try { if (this.G.weapons && typeof this.G.weapons.explodeInHand === 'function') this.G.weapons.explodeInHand(p, n.type); } catch { /* */ }
  }

  /* ================================================================ Darstellung (endFrame, nach der Simulation) */

  frame(dt) {
    const xr = this.xr;
    if (!xr.presenting || !xr.ready) { this._hideAmmo(); return; }
    const O = xr.hands.off;
    // Gehaltenes an die Nebenhand (Griffpunkt, leicht vor der Handfläche)
    const held = this.holding === 'grenade' && this._nade ? this._nade.mesh : this.holding === 'mag' ? this._mag : null;
    if (held && O.gripW.ok) {
      held.visible = true;
      _v.set(0, -0.02, -0.035).applyQuaternion(O.gripW.quat);
      held.position.copy(O.gripW.pos).add(_v);
      held.quaternion.copy(O.gripW.quat);
      if (this.holding === 'mag') held.quaternion.multiply(_q.setFromAxisAngle(_v2.set(1, 0, 0), -0.35));
      held.updateMatrixWorld(true);
    } else if (held) held.visible = false;
    // Magazin-Teil der Waffe aus-/einblenden, Verschluss beim Durchladen mitziehen
    const ms = this._manualSlot();
    const magPart = this._part('mag');
    if (magPart && ms && ms.st.vrMagOut) magPart.visible = false;
    const r = this._rack;
    if (r && r.part && r.rest && this.holding === 'rack') { r.part.position.copy(r.rest); r.part.position.z += clamp(r.pull, 0, r.need * 1.6); }
    // Fallende Magazine
    this._updateDrops(dt);
    // Munition an der Waffe
    this._updateAmmo(ms);
  }

  _cloneMag(part) {
    const vm = this._vm();
    if (!vm || !vm.scene) return null;
    let c;
    try { c = part.clone(true); } catch { return null; }
    c.visible = true;
    c.traverse((o) => { o.visible = true; if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    part.updateWorldMatrix(true, false);
    part.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    c.matrixAutoUpdate = true;
    vm.scene.add(c);
    return c;
  }

  _dropMesh(mesh, fromGun = false) {
    if (!mesh) return;
    const vel = new THREE.Vector3(0, fromGun ? -0.6 : -0.2, 0);
    if (fromGun) vel.add(_v.set(0, 0, 0.25).applyQuaternion(this.xr.gun.quat));
    const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6);
    this._drops.push({ mesh, vel, spin, t: 0, rest: false });
    while (this._drops.length > 6) { const d = this._drops.shift(); d.mesh.removeFromParent(); }
  }

  _updateDrops(dt) {
    const world = this.G.world;
    for (let i = this._drops.length - 1; i >= 0; i--) {
      const d = this._drops[i];
      d.t += dt;
      if (d.t > DROP_LIFE || !d.mesh.parent) { d.mesh.removeFromParent(); this._drops.splice(i, 1); continue; }
      if (d.rest) continue;
      d.vel.y -= 9.81 * dt;
      const m = d.mesh;
      const step = d.vel.length() * dt;
      if (step > 1e-5 && world && typeof world.raycast === 'function') {
        _v.copy(d.vel).normalize();
        let hit = null;
        try { hit = world.raycast(m.position, _v, step + 0.03); } catch { hit = null; }
        if (hit && hit.distance <= step + 0.03) {
          m.position.addScaledVector(_v, Math.max(0, hit.distance - 0.02));
          d.rest = true;
          continue;
        }
      }
      m.position.addScaledVector(d.vel, dt);
      _q.setFromAxisAngle(_v2.copy(d.spin).normalize(), d.spin.length() * dt);
      m.quaternion.premultiply(_q);
      // Sicherheitsnetz: nicht ewig fallen
      if (d.t > 3 && world && typeof world.raycast === 'function') {
        let h = null;
        try { h = world.raycast(m.position, _down, 50); } catch { h = null; }
        if (!h) { m.removeFromParent(); this._drops.splice(i, 1); }
      }
    }
  }

  /* ---------------------------------------------------------------- Munitionszähler an der Waffe */

  _ensureAmmo() {
    if (this._ammo) return this._ammo;
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.022), mat);
    mesh.name = 'xr-munition-waffe';
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    this._ammo = { mesh, ctx, tex, key: '' };
    return this._ammo;
  }

  _hideAmmo() { if (this._ammo) this._ammo.mesh.visible = false; }

  _updateAmmo(ms) {
    const xr = this.xr;
    const vm = this._vm();
    const w = this._weapon();
    const st = w ? w.current : null;
    const def = st && st.def;
    const show = this.G.settings.get('vrGunAmmo') !== false && xr.armed && vm && vm.root && def && def.mag > 0 && def.cls !== 'melee' &&
      this.G.player && this.G.player.alive && !this.G.player.vehicle && !!(vm.scene && vm.scene.visible !== false);
    if (!show) { this._hideAmmo(); return; }
    const a = this._ensureAmmo();
    if (!a) return;
    if (a.mesh.parent !== vm.root) vm.root.add(a.mesh);
    a.mesh.visible = true;
    // links am Gehäuse (Haupthand rechts; sonst rechts), etwas vor dem Griff, schräg zum Gesicht gedreht
    const sx = xr.offSide === 'left' ? -1 : 1;
    a.mesh.position.set(-0.034 * sx, 0.032, -0.06);
    a.mesh.rotation.set(-0.5, -1.1 * sx, 0, 'YXZ');
    const inf = !!w.infiniteAmmo;
    const state = st.vrMagOut ? 'out' : st.vrNeedsRack ? 'rack' : st.mag === 0 ? 'leer' : '';
    const key = `${st.mag}|${inf ? '∞' : st.reserve}|${state}|${def.mag}`;
    if (key === a.key) return;
    a.key = key;
    const c = a.ctx;
    c.clearRect(0, 0, 128, 64);
    c.fillStyle = 'rgba(8,10,12,0.72)';
    c.fillRect(0, 0, 128, 64);
    const low = st.mag <= Math.max(1, Math.floor(def.mag * 0.25));
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = state ? '#ffc23d' : low ? '#ff6b4f' : '#e9e6df';
    c.font = '700 34px system-ui, sans-serif';
    c.fillText(String(st.mag), 8, 26);
    c.fillStyle = 'rgba(233,230,223,0.7)';
    c.font = '600 18px system-ui, sans-serif';
    c.textAlign = 'right';
    c.fillText(inf ? '∞' : String(st.reserve), 120, 26);
    c.textAlign = 'left';
    c.font = '700 13px system-ui, sans-serif';
    c.fillStyle = state ? '#ffc23d' : 'rgba(233,230,223,0.55)';
    c.fillText(state === 'out' ? 'MAGAZIN FEHLT' : state === 'rack' ? 'DURCHLADEN' : state === 'leer' ? 'LEER' : def.name ? String(def.name).toUpperCase().slice(0, 14) : '', 8, 52);
    a.tex.needsUpdate = true;
    this.lastAmmo = key;
  }

  dispose() {
    this._release('reset');
    for (const d of this._drops) d.mesh.removeFromParent();
    this._drops.length = 0;
    if (this._ammo) {
      this._ammo.mesh.removeFromParent();
      this._ammo.mesh.geometry.dispose();
      this._ammo.mesh.material.dispose();
      this._ammo.tex.dispose();
      this._ammo = null;
    }
  }
}
