// NULLPUNKT — Bot-Fahrten mit Truppentransportern (Nutzer 20.11.: „Fahrzeuge zum Truppentransport“, data-troop.js).
// Läuft nur offline bzw. beim Host (nicht im Abbild), nur in Team-Modi mit Militärfahrzeugen (nicht Panzer/Kampagne).
//
// Ablauf je Transporter (def.transport) ohne menschliche Insassen:
//   1. warten   – geparkt; sind ≥ 2 Bots des Teams (ohne sichtbares Ziel) in 28 m oder eben in ≤ 140 m erschienen, steigen bis zu 7 ein: erst Fahrer,
//                 dann Lafette (bewaffnete Transporter), dann Mitfahrer
//   2. fahren   – Fahrer folgt dem geplanten Weg (VehicleSystem.planPath) zu einem Absetzpunkt 55 % des Wegs zur
//                 feindlichen Basis bzw. zum nächsten Ziel (Flagge/Zone) der Karte; Schütze feuert auf sichtbare Feinde
//   3. absitzen – am Ziel, nach Beschuss, bei Feind in 45 m oder nach 80 s: alle steigen aus (Heckrampe öffnet im Stand)
//   4. Pause    – 25 s, dann darf der Transporter wieder Bots aufnehmen (wo immer er steht)
// Die vorhandene Fahrzeug-KI (autopilot.js über Vehicle.driveTo, aimAt) fährt und zielt; Mitfahrer in offenen Sitzen
// schießen mit ihrer eigenen Waffe weiter (Bot-KI läuft im Sitz), in geschlossenen Kampfräumen ruhen sie.
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const BOARD_R = 28, MAX_RIDERS = 7, DRIVE_MAX = 80, PAUSE = 25, DANGER_R = 45;

export class TransportRides {
  constructor(sys) {
    this.sys = sys;
    this.state = new Map(); // Fahrzeug → { phase, t, goal, until }
    this._t = 0;
  }

  /** Aktiv? Host/offline, Team-Modus, Militärfahrzeuge, kein Panzer-/Kampagnenmodus, Einstellung nicht aus (?ride=0). */
  active() {
    const S = this.sys, G = S.G, M = G.match;
    if (!S.attached || S.replica || S.civilOnly || !M || M.state !== 'playing' || M.ffa) return false;
    if (M.modeId === 'panzer' || M.modeId === 'kampagne' || M.modeId === 'training') return false;
    try { if (G.params && typeof G.params.get === 'function' && G.params.get('ride') === '0') return false; } catch { /* */ }
    return !!(G.bots && Array.isArray(G.bots.bots));
  }

  update(dt) {
    if (!this.active()) return;
    this._t -= dt;
    const tick = this._t <= 0;
    if (tick) this._t = 0.5;
    const now = this.sys.G.time.elapsed;
    for (const v of this.sys.list) {
      if (!v.def.transport || v.isAircraft) continue;
      let st = this.state.get(v);
      if (!st) { st = { phase: 'warten', t: now, goal: null, until: 0, hp: v.health }; this.state.set(v, st); }
      if (!v.alive || v.wreck) { if (st.phase === 'fahren') this._dismount(v, st, now); continue; }
      if (v.seats.some((s) => s.actor && (s.actor.isPlayer || s.actor.isRemoteHuman))) { if (st.phase === 'fahren') st.phase = 'pause', st.until = now + PAUSE; continue; }
      if (st.phase === 'fahren') this._drive(v, st, now, dt, tick);
      else if (tick && st.phase === 'warten') this._tryBoard(v, st, now);
      else if (st.phase === 'pause' && now > st.until) st.phase = 'warten';
    }
    if (tick) for (const v of [...this.state.keys()]) if (!this.sys.list.includes(v)) this.state.delete(v);
  }

  _team(v) { return v.spawnTeam === 'A' || v.spawnTeam === 'B' ? v.spawnTeam : null; }

  _tryBoard(v, st, now) {
    const G = this.sys.G, team = this._team(v);
    if (!team || v.isOccupied) return;
    const vp = v.position;
    const cand = [];
    for (const b of G.bots.bots) {
      if (!b.alive || b.puppet || b.vehicle || b.team !== team || b.isRemoteHuman) continue;
      // in der Nähe – oder gerade an der Basis erschienen (≤ 8 s, ≤ 140 m – TDM-Startpunkte liegen vor dem Fahrzeughof): sitzt direkt auf („am HQ aufsitzen“)
      const d2 = b.position.distanceToSquared(vp), fresh = now - (b.spawnTime ?? -1e9) < 8 && d2 < 140 * 140;
      if (d2 > BOARD_R * BOARD_R && !fresh) continue;
      if (b.target || now - (b.lastDamageTime ?? -1e9) < 4) continue; // im Gefecht nicht einsteigen
      cand.push(b);
    }
    if (cand.length < 2) return;
    cand.sort((a, b) => a.position.distanceToSquared(vp) - b.position.distanceToSquared(vp));
    const goal = this._goalFor(v, team);
    if (!goal) return;
    const S = this.sys;
    const seats = v.seats.map((s, i) => i);
    const order = [seats.find((i) => v.seats[i].def.drive), ...seats.filter((i) => v.seats[i].def.mount && !v.seats[i].def.drive), ...seats.filter((i) => !v.seats[i].def.mount && !v.seats[i].def.drive)].filter((i) => i != null);
    let n = 0;
    for (const b of cand.slice(0, MAX_RIDERS)) {
      const idx = order.find((i) => !v.seats[i].actor);
      if (idx == null) break;
      if (S.enter(b, v, idx) === idx) {
        n++;
        // Dachluke im geschlossenen Kampfraum: Mitfahrer steht auf und feuert (Sicht fireOut); offene Bänke bleiben sitzend (feuern trotzdem)
        const vi = v.seats[idx].def.views.findIndex((x) => x.fireOut);
        if (vi >= 0 && !v.seats[idx].def.views[0].exposed && typeof S.setSeatView === 'function') S.setSeatView(b, vi); // nur Dachluken
      }
    }
    const drv = v.driver;
    if (!drv || n < 2) { for (const s of v.seats) if (s.actor && !s.actor.isPlayer) S.removeFromSeat(s.actor, { teleport: true }); return; }
    st.phase = 'fahren'; st.t = now; st.goal = goal; st.hp = v.health;
    v.driveTo(drv, goal, { arriveRadius: 9, maxSpeed: v.def.drive === 'tracked' ? 9 : 12 });
    G.events.emit('vehicle:ride', { vehicle: v, phase: 'fahren', riders: n });
  }

  /** Absetzpunkt: 55 % des Wegs zur feindlichen Basis bzw. nächste Flagge/Zone auf dem Weg dorthin. */
  _goalFor(v, team) {
    const w = this.sys.world, sp = w && w.spawns, foe = team === 'A' ? 'B' : 'A';
    const list = (sp && sp[foe]) || [];
    if (!list.length) return null;
    const c = _a.set(0, 0, 0);
    for (const s of list) c.add(s.position);
    c.multiplyScalar(1 / list.length);
    const from = v.position;
    let goal = _b.copy(from).lerp(c, 0.55);
    const ob = w.objectives && ((w.objectives.cq && w.objectives.cq.length && w.objectives.cq) || (w.objectives.dom && w.objectives.dom.length && w.objectives.dom));
    if (ob) {
      // Ziel zwischen Fahrzeug und Feind, das am nächsten am Fahrzeug liegt (nicht hinter uns)
      let best = null, bd = Infinity;
      const dir = _a.copy(c).sub(from).setY(0).normalize();
      for (const o of ob) {
        const d = o.position.distanceTo(from), ahead = (o.position.x - from.x) * dir.x + (o.position.z - from.z) * dir.z;
        if (ahead > 25 && d < bd) { bd = d; best = o; }
      }
      if (best) goal = _b.copy(best.position).lerp(from, Math.min(0.5, 35 / Math.max(1, bd)));
    }
    return goal.clone();
  }

  _drive(v, st, now, dt, tick) {
    const drv = v.driver;
    if (!drv || !drv.alive || drv.isPlayer) { this._dismount(v, st, now); return; }
    const it = v.intentFor(drv);
    // Lafette: nächster sichtbarer Feind in Reichweite
    if (tick) this._gunner(v);
    const hit = v.health < st.hp - 1;
    st.hp = v.health;
    let danger = false;
    if (tick) {
      const G = this.sys.G, vp = v.position, team = this._team(v);
      for (const a of G.actors) {
        if (!a.alive || a.team === team || a.team == null) continue;
        if (a.position.distanceToSquared(vp) < DANGER_R * DANGER_R) { danger = true; break; }
      }
    }
    if ((it && it.arrived) || hit || danger || now - st.t > DRIVE_MAX || (it && it.stuck && now - st.t > 12)) {
      v.stop(drv);
      if (Math.abs(v.body.speed || 0) < 1.2 || now - st.t > DRIVE_MAX + 4) this._dismount(v, st, now);
    }
    void dt;
  }

  _gunner(v) {
    const S = this.sys, G = S.G;
    for (const s of v.seats) {
      if (!s.def.mount || s.def.drive || !s.actor || s.actor.isPlayer || !s.weapons.length) continue;
      const w = s.weapons[s.weaponIndex], range = w.def.kind === 'shell' ? 500 : w.def.range || 300;
      let best = null, bd = range * range;
      v.muzzle(s.index, _a, _b);
      for (const a of G.actors) {
        if (!a.alive || a.team === s.actor.team || a.team == null || a.vehicle === v) continue;
        const d = a.position.distanceToSquared(_a);
        if (d >= bd) continue;
        const p = a.vehicle ? a.vehicle.position : a.position;
        _b.set(p.x, p.y + 1.2, p.z);
        if (G.world && G.world.lineOfSight && !G.world.lineOfSight(_a, _b)) continue;
        bd = d; best = a;
      }
      if (best) { const p = best.vehicle ? best.vehicle.position : best.position; v.aimAt(s.actor, _b.set(p.x, p.y + 1.1, p.z), true); }
      else { const it = s.intent; it.fire = false; it.aimAt = null; }
    }
  }

  _dismount(v, st, now) {
    const S = this.sys;
    for (const s of v.seats) {
      const a = s.actor;
      if (!a || a.isPlayer || a.isRemoteHuman) continue;
      S.removeFromSeat(a, { teleport: true });
    }
    st.phase = 'pause'; st.until = now + PAUSE; st.goal = null;
    S.G.events.emit('vehicle:ride', { vehicle: v, phase: 'abgesessen' });
  }
}
