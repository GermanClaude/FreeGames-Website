// NULLPUNKT — Panzersimulation: Einhängen in das Fahrzeugsystem NUR für die Dauer des Modus „Panzer“ (Instanz-Hüllen,
// keine Änderung an vehicles/index.js, projectiles.js, vehicle.js – die übrigen Modi laufen unverändert):
//   sys.fire          Kanister/Kartätsche → Schrotgarbe (Hitscan) statt Granate; Abschussort für die Entfernung merken
//   shells._impact    Granaten der Modus-Munition gegen Fahrzeuge: Durchschlag nach Winkel/Dicke (ammo.js), Abpraller,
//                     Wirkung auf Module/Besatzung; gegen Welt/Infanterie wie bisher (Bresche, Splitter)
//   sys.update        Vorlauf (Sim-Bedingungen: Motor, Gang, Bremse, Sicherung, Module) vor dem Fahrzeugtakt, Nachlauf
//                     (Kamera-Neigen, Hotspots) danach
//   sys.weaponName    Abschussmeldungen mit Munitionsart
//   sys.rules         Außenansicht/Laderegel je Stil (Simulation: keine Außenansicht, Arcade: Automatik)
//   sys.requestExit   Aussteigen gesperrt (Besatzung bleibt im Panzer), außer bei Brand/Ausbooten
//   sys.audio.update  Motor aus → Motorklang stumm
import * as THREE from 'three';
import { VEHICLE_WEAPONS } from '../data.js?v=20261123082814';
import { penetration, applyEffects, modsOf, knockedOut, KINDS } from './ammo.js?v=20261123082814';

const _d = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Vector3(), _o = new THREE.Vector3();

export function installHooks(sys, mode) {
  const undo = [];
  const wrap = (obj, key, make) => {
    const own = Object.prototype.hasOwnProperty.call(obj, key);
    const orig = obj[key];
    obj[key] = make(orig);
    undo.push(() => { if (own) obj[key] = orig; else delete obj[key]; });
  };
  const G = sys.G;

  // ---- Feuern: Schrotgarbe, Abschussort
  wrap(sys, 'fire', (orig) => function fire(v, seat, w, origin, dir) {
    const def = w && w.def;
    if (v) v._psimFiredAt = G.time.elapsed; // Mündungsfeuer verrät den Schützen (crew-ai.js scanTargets)
    const P = def && def.psim;
    if (P && P.pellets) {
      const actor = seat.actor;
      const pid = def.id.replace(/_[a-z]+$/, '_kugel');
      const pd = VEHICLE_WEAPONS[pid];
      sys._ignore = v;
      const side = _n.set(1, 0, 0).cross(dir); if (side.lengthSq() < 1e-6) side.set(0, 0, 1).cross(dir); side.normalize();
      const up = _c.crossVectors(dir, side);
      const n = G.renderer && G.renderer.quality === 'low' ? Math.ceil(P.pellets * 0.5) : P.pellets;
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt(Math.random()) * P.spreadRad, a = Math.random() * Math.PI * 2;
        _d.copy(dir).addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
        try {
          const res = G.combat.fireHitscan({ shooter: actor, origin, dir: _d, range: P.pelletRange, weapon: pd, pelletIndex: i, damageScale: G.renderer && G.renderer.quality === 'low' ? 2 : 1 });
          if (i % 6 === 0 && res && res.point) G.events.emit('tracer', { from: origin.clone(), to: res.point.clone ? res.point.clone() : res.point, actor, weaponId: pid });
        } catch { /* */ }
      }
      sys._ignore = null;
      G.effects?.muzzleFlash?.(origin, dir, { cls: 'sniper', scale: 3.6 });
      G.effects?.muzzleLight?.(origin, 34, 3, 0.09, 20);
      G.effects?.smoke?.(_o.copy(origin).addScaledVector(dir, 1.5), { count: 9, size: 2.8, life: 2.2, rise: 0.3, alpha: 0.45 });
      const isP = !!(actor && actor.isPlayer);
      sys.audio.cannon(v, origin, !!(v && G.player && G.player.vehicle === v)); // Kanone: außen/innen (audio 20.11.)
      if (isP) { actor.shake?.(def.shake || 0.5); G.input?.rumble?.(0.9, 0.6, 200); }
      G.events.emit('vehicle:fire', { vehicle: v, seat: seat.index, actor, weaponId: def.id, origin, dir });
      mode.onShot?.(v, def, origin, dir, null);
      return;
    }
    const n0 = sys.shells.list.length;
    orig.call(sys, v, seat, w, origin, dir);
    if (P && sys.shells.list.length > n0) {
      const s = sys.shells.list[sys.shells.list.length - 1];
      s.from = origin.clone();
      mode.onShot?.(v, def, origin, dir, s);
    }
  });

  // ---- Einschlag: Durchschlagsrechnung gegen Fahrzeuge
  const pool = sys.shells;
  wrap(pool, '_impact', (orig) => function impact(s, hit, dir) {
    const def = s.def, P = def && def.psim;
    if (!P || !hit.vehicle) {
      const r = orig.call(pool, s, hit, dir);
      if (P && r) mode.onShellEnd?.(s, hit, null);
      return r;
    }
    const v = hit.vehicle, attacker = s.shooter || null, p = hit.point;
    if (!v.alive) { const r = orig.call(pool, s, hit, dir); mode.onShellEnd?.(s, hit, null); return r; }
    const dist = s.from ? s.from.distanceTo(p) : s.age * def.speed;
    // Stellungen (Pak/Bunker): eigenes Schadensbild
    if (v.isEmplacement) {
      const dealt = v.shellHit(def, hit, dir, attacker);
      splash(sys, s, hit, dir, v);
      mode.onShellEnd?.(s, hit, { vehicle: v, penetrated: dealt > 0, kind: P.kind, dist, emplacement: true });
      return true;
    }
    const res = penetration(v, def, hit, dir, dist);
    if (res.rico && s.ricochets < 1 && v.def.armored) {
      s.ricochets++;
      s.vel.reflect(hit.normal).multiplyScalar(P.role === 'ke' ? 0.55 : 0.35);
      s.pos.copy(p).addScaledVector(hit.normal, 0.05);
      G.effects?.impact?.(p, hit.normal, 'metal', { big: true });
      sys.audio.play('ricochet', { position: p, volume: 1, pitch: 0.55 });
      G.events.emit('vehicle:ricochet', { vehicle: v, attacker, weaponId: def.id, point: p.clone() });
      mode.onShellEnd?.(s, hit, { vehicle: v, ricochet: true, res, kind: P.kind, dist });
      if (P.role === 'ce' || P.role === 'he') { splash(sys, s, hit, dir, v); return true; } // Zünder spricht an
      return false;
    }
    if (s.display) return orig.call(pool, s, hit, dir);
    let dmg;
    // Durchschlag kostet Struktur, ausgeschaltet wird ein Panzer aber vor allem über Besatzung, Munition, Brand und Module
    // (applyEffects/knockedOut) – nicht nach zwei Treffern über den Lebensbalken (Nutzer 21.11.: „stirbt extrem schnell“)
    if (res.penetrated) dmg = P.dmgPen * 0.5 * (1 + 0.35 * Math.min(1, (res.penMm - res.eff) / Math.max(20, res.eff)));
    else dmg = P.dmgNo * (P.role === 'he' ? 1 : 0.6);
    if (!v.def.armored) dmg = Math.max(dmg, P.dmgPen * 0.9);
    const zone = hit.zone;
    const dealt = v.applyDamage(dmg, { attacker, weaponId: def.id, zone, kind: 'psim', point: p, dir });
    try { v.model.addScar?.(p, { hole: res.penetrated, size: res.penetrated ? 0.55 + P.cal / 400 : 0.45 }); } catch { /* */ }
    G.effects?.impact?.(p, hit.normal, 'metal', { big: true, hole: res.penetrated });
    if (!res.penetrated) sys.audio.play('impact_metal', { position: p, volume: 1, pitch: 0.5 });
    let notes = [];
    if (v.alive) notes = applyEffects(sys, v, { attacker, weaponId: def.id, point: p, dir, def, res, hit });
    if (dealt > 0) G.events.emit('vehicle:hit', { vehicle: v, attacker, amount: dealt, weaponId: def.id, face: hit.face, zone });
    // Ausgefallen (Munition/Besatzung) → Wrack
    const ko = v.alive ? knockedOut(v) : null;
    if (ko && v.alive) { v._psimKo = ko; v.destroy(attacker, def.id); }
    mode.onShellEnd?.(s, hit, { vehicle: v, res, notes, kind: P.kind, dist, killed: !v.alive, ko });
    if (notes.length) G.events.emit('vehicle:crit', { vehicle: v, attacker, notes });
    if (P.role === 'he' || P.role === 'ce' || (P.filler && !res.penetrated)) splash(sys, s, hit, dir, v);
    return true;
  });

  // ---- Takt: Vor-/Nachlauf
  wrap(sys, 'update', (orig) => function update(dt) {
    try { mode.preVehicles?.(dt); } catch (err) { console.warn('[Panzer] Vorlauf', err); }
    orig.call(sys, dt);
    try { mode.postVehicles?.(dt); } catch (err) { console.warn('[Panzer] Nachlauf', err); }
  });

  wrap(sys, 'weaponName', (orig) => function weaponName(id) {
    const w = VEHICLE_WEAPONS[id];
    if (w && w.psim) return KINDS[w.psim.kind] ? KINDS[w.psim.kind].label : w.name;
    if (id === 'psim_pak') return 'Pak';
    return orig.call(sys, id);
  });

  // Regeln (Getter der Klasse) für diese Instanz überdecken
  Object.defineProperty(sys, 'rules', { configurable: true, get: () => mode.vehicleRules() });
  undo.push(() => { delete sys.rules; });

  wrap(sys, 'requestExit', (orig) => function requestExit(actor) {
    if (actor && actor.isPlayer && !mode.exitAllowed(actor)) { sys._flash('Die Besatzung bleibt im Panzer'); return false; }
    return orig.call(sys, actor);
  });

  if (sys.audio) {
    wrap(sys.audio, 'update', (orig) => function aupdate(dt, list, mine) {
      orig.call(sys.audio, dt, list, mine);
      const v = mode.tank;
      if (v && mode.engineOff && mode.engineOff()) {
        const voice = sys.audio.voices && sys.audio.voices.get(v);
        if (voice && voice.out && voice.out.gain) { try { voice.out.gain.cancelScheduledValues(0); voice.out.gain.value = 0; } catch { /* */ } }
      }
    });
  }

  return () => { for (let i = undo.length - 1; i >= 0; i--) { try { undo[i](); } catch { /* */ } } undo.length = 0; };
}

/** Splitter/Druck an der Einschlagstelle (Infanterie, leichte Ziele) – wie projectiles.js, eigener Explosionsrahmen. */
function splash(sys, s, hit, dir, skip) {
  const G = sys.G, def = s.def, sp = def.splash;
  if (!sp || !(sp.maxDamage > 0)) return;
  const at = hit.point.clone();
  if (hit.normal) at.addScaledVector(hit.normal, 0.3); else at.addScaledVector(dir, -0.3);
  sys.ownExplosion(() => G.combat.explode({ position: at, radius: sp.radius, maxDamage: sp.maxDamage, attacker: s.shooter || null, weaponId: def.id, type: def.penetrating ? 'shell_ap' : 'shell_he', innerRadius: sp.innerRadius, minDamage: sp.minDamage }));
  for (const v of sys.list) {
    if (!v.alive || v === skip) continue;
    const d = Math.max(0, v.body.pos.distanceTo(at) - v.def.hullBox[3]);
    if (d > sp.radius) continue;
    const dmg = sp.maxDamage * Math.pow(1 - d / sp.radius, 1.2) * v.def.explosiveMult;
    v.applyDamage(dmg, { attacker: s.shooter || null, weaponId: def.id, kind: 'explosive', zone: 'hull', point: at });
    if (d < 2.5 && v.def.drive === 'tracked' && Math.random() < 0.3) { const m = modsOf(v); m.ketten = Math.min(m.ketten, 0.5); }
  }
}
