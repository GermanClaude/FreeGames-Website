// NULLPUNKT — Übungsgelände im Trainingsmodus (Karte „range“, world.uebung aus world/maps/range-gelaende.js).
// Nutzer 21.11.: „Schießstand größer, damit man allein auch Panzer, Fahrzeuge, Hubschrauber und Jets ausprobieren kann“.
//
//   Stellplätze   world.uebung.bays: Fahrzeuge erscheinen, wenn du dich näherst (≤ 110 m, Luftfahrzeuge 170 m), und
//                 verschwinden wieder, wenn sie leer und weit weg sind – höchstens BUDGET[Stufe] gleichzeitig (Handy 5),
//                 je Takt höchstens eines neu (Modellbau verteilt). Keine Bots; jede Klasse darf jeden Sitz (air/policy.js
//                 FREE_AIR_MODES enthält 'training').
//   Ziel-Panzer   world.uebung.targetTanks: echte Fahrzeuge ohne Besatzung/Munition auf der Panzerschießbahn; sie fallen
//                 nie aus (Schaden auf Restleben gedeckelt) und heilen nach jedem Treffer → Trefferanzeige Durchschlag
//                 (Seite, Bauteil, Entfernung) bzw. Abpraller; einsteigen kann man nicht (TrainingMode.vehicleSeatFor).
//   Trefferanzeige 'uebung:hit' (Scheiben, Pappkameraden, Schienenziele, Wracks, Bodenziele, Ballons, Drohnen) und
//                 'vehicle:hit'/'vehicle:ricochet' der Ziel-Panzer → Hinweis (injury:notice) + Statistik.
//   Bedienung     Teleport-Tafeln (Taste Interagieren in ≤ 2,4 m) und das Übungsmenü (Pause → Übungsgelände,
//                 ui/uebung-menu.js): teleportieren, Fahrzeug herbeirufen/zurücksetzen, Munition auffüllen, Ziele
//                 zurücksetzen, Zeitlupe, Unverwundbar, Panzer-Übung (startet den Modus „Panzer“ auf dieser Karte).
import * as THREE from 'three';
import { VEHICLES, VEHICLE_WEAPONS, vehicleWeapon } from '../vehicles/data.js?v=20261121041936';
import { refillAmmo } from '../mappoints.js?v=20261121041936';

const Q_ORDER = ['low', 'medium', 'high', 'ultra'];
const BUDGET = { low: 5, medium: 8, high: 12, ultra: 16 };
const NEAR = 110, NEAR_AIR = 170, FAR = 160, FAR_AIR = 240;
const BOARD_R = 2.4;
const SLOW = 0.35;
const FACE = { front: 'Front', side: 'Seite', rear: 'Heck', top: 'Dach' };
const ZONE = { hull: 'Wanne', turret: 'Turm', tracks: 'Laufwerk', engine: 'Motor', gun: 'Kanone', optics: 'Optik', wheels: 'Räder' };
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const fmtM = (m) => `${Math.round(m).toLocaleString('de-DE')} m`;

export class UebungsGelaende {
  constructor(mode) {
    this.mode = mode;
    this.G = mode.G;
    this.world = this.G.world;
    this.U = this.world.uebung;
    this.quality = (this.G.renderer && this.G.renderer.quality) || 'high';
    this.qi = Math.max(0, Q_ORDER.indexOf(this.quality));
    this.bays = this.U.bays.filter((b) => VEHICLES[b.type] && (!b.minQuality || this.qi >= Q_ORDER.indexOf(b.minQuality))).map((bay) => ({ bay, v: null, wreckT: 0 }));
    this.tanks = [];
    this.summoned = null;
    this.slow = false;
    this.god = false;
    this.stats = { hits: 0, pen: 0, rico: 0, longest: 0, last: null };
    this._t = 0;
    this._heal = new Map();
    this.near = null; // nächste Teleport-Tafel
  }

  get sys() { return this.G.vehicles && this.G.vehicles.attached ? this.G.vehicles : null; }

  /* ------------------------------------------------------------ Lebenszyklus */

  attach(scope) {
    scope.on('uebung:hit', (e) => this._onHit(e));
    scope.on('vehicle:hit', (e) => this._onVehHit(e));
    scope.on('vehicle:ricochet', (e) => this._onRico(e));
  }

  start() {
    const sys = this.sys;
    if (!sys) return;
    for (const t of this.U.targetTanks) {
      if (t.minQuality && this.qi < Q_ORDER.indexOf(t.minQuality)) continue;
      this.tanks.push({ def: t, v: null, respawnAt: 0 });
    }
    for (const t of this.tanks) this._spawnTarget(t);
  }

  dispose() {
    if (this.slow) this.G.timeScale = 1;
    this.slow = false;
    if (this.G.player) this.G.player.godMode = false;
  }

  /* ------------------------------------------------------------ Takt */

  tick(dt) {
    const G = this.G, p = G.player, sys = this.sys;
    this._t -= dt;
    // Teleport-Tafel in Reichweite (nur zu Fuß)
    this.near = null;
    if (p && p.alive && !p.vehicle) {
      let bd = BOARD_R;
      for (const b of this.U.boards) {
        const d = Math.hypot(p.position.x - b.x, p.position.z - b.z);
        if (d < bd) { bd = d; this.near = b; }
      }
    }
    // Unverwundbar: eigenes Fahrzeug gleich mit
    if (this.god && p) {
      p.godMode = true;
      const v = p.vehicle;
      if (v && v.alive && v.health < v.maxHealth) v.repair(v.maxHealth);
    }
    const now = G.time.elapsed;
    for (const [v, at] of this._heal) if (now >= at) { this._heal.delete(v); this._fullHeal(v); }
    if (!sys || this._t > 0) return;
    this._t = 0.4;
    this._tickBays(p, sys);
    for (const t of this.tanks) if ((!t.v || !t.v.alive || !sys.list.includes(t.v)) && now >= t.respawnAt) {
      if (t.v && sys.list.includes(t.v)) sys.removeVehicle(t.v);
      t.v = null;
      this._spawnTarget(t);
    }
  }

  _playerPos() {
    const p = this.G.player;
    return p.vehicle && p.vehicle.position ? p.vehicle.position : p.position;
  }

  _tickBays(p, sys) {
    if (!p) return;
    const pos = this._playerPos();
    let live = 0;
    for (const e of this.bays) {
      if (e.v && !sys.list.includes(e.v)) e.v = null; // anderweitig entfernt
      if (e.v) live++;
    }
    // Leere, weit entfernte Fahrzeuge (auch Wracks) zurücknehmen
    for (const e of this.bays) {
      const v = e.v;
      if (!v || v.isOccupied) continue;
      const air = !!v.def.air, d = Math.hypot(v.position.x - pos.x, v.position.z - pos.z);
      if (d > (air ? FAR_AIR : FAR) || (!v.alive && (e.wreckT += 0.4) > 15)) { sys.removeVehicle(v); e.v = null; e.wreckT = 0; live--; }
    }
    // Nächster leerer Stellplatz in Reichweite (einer je Takt)
    const budget = BUDGET[this.quality] || 10;
    if (live >= budget) return;
    let best = null, bd = Infinity;
    for (const e of this.bays) {
      if (e.v) continue;
      const b = e.bay, d = Math.hypot(b.x - pos.x, b.z - pos.z);
      if (d > (VEHICLES[b.type].air ? NEAR_AIR : NEAR) || d >= bd) continue;
      if (sys.list.some((v) => Math.hypot(v.position.x - b.x, v.position.z - b.z) < 6)) continue; // Platz belegt
      best = e; bd = d;
    }
    if (best) best.v = this._spawn(best.bay.type, best.bay.x, best.bay.z, best.bay.yaw, best.bay.variant || 0);
  }

  _ground(x, z) {
    const w = this.world;
    const h = typeof w.heightAt === 'function' ? w.heightAt(x, z) : 0;
    const g = typeof w.groundHeight === 'function' ? w.groundHeight(x, z, h + 8) : null;
    return Number.isFinite(g) ? g : h;
  }

  _spawn(type, x, z, yaw, variant = 0, team = null) {
    const sys = this.sys;
    if (!sys || !VEHICLES[type]) return null;
    try { return sys.spawnVehicle(type, new THREE.Vector3(x, this._ground(x, z), z), yaw, team, { variant }); } catch (err) { console.warn('[Übungsgelände] Fahrzeug', type, err); return null; }
  }

  /* ------------------------------------------------------------ Ziel-Panzer */

  _spawnTarget(t) {
    const d = t.def, v = this._spawn(d.type, d.x, d.z, d.yaw);
    if (!v) { t.respawnAt = this.G.time.elapsed + 10; return; }
    t.v = v;
    v.trainingTarget = { distance: d.d, name: `Ziel-Panzer ${v.def.name}` };
    v.name = `Ziel ${d.d} m`;
    if (v.gun && v.gun.rack) for (const k of Object.keys(v.gun.rack)) v.gun.rack[k] = 0; // kein Munitionslager → keine Zündung
    const orig = v.applyDamage.bind(v);
    v.applyDamage = (amount, info = {}) => orig(Math.min(amount, Math.max(0, v.health - 1)), info);
  }

  _fullHeal(v) {
    if (!v || !v.alive) return;
    v.repair(v.maxHealth * 4);
    for (const z of Object.values(v.zones || {})) if (z.max) z.hp = z.max;
    v.health = v.maxHealth; if (v.zones && v.zones.hull) v.zones.hull.hp = v.health;
    v.disabled = false; v.trackDownUntil = 0;
  }

  /* ------------------------------------------------------------ Trefferanzeige */

  _dist(actor, point) {
    const o = actor && actor.vehicle && actor.vehicle.position ? actor.vehicle.position : actor && actor.position;
    return o && point ? Math.hypot(o.x - point.x, o.y - point.y, o.z - point.z) : 0;
  }

  _note(text, tone = 'gold') {
    this.G.events.emit('injury:notice', { text, tone });
    this.stats.last = text;
  }

  _weaponName(actor, id) {
    const v = actor && actor.vehicle;
    const wd = v ? vehicleWeapon(v.type, id) : null;
    return (wd && (wd.short || wd.name)) || (VEHICLE_WEAPONS[id] && VEHICLE_WEAPONS[id].short) || '';
  }

  _onHit(e) {
    const P = this.G.player;
    if (!e || !e.target || e.shooter !== P) return;
    const t = e.target, d = this._dist(P, e.point);
    this.stats.hits++;
    this.stats.longest = Math.max(this.stats.longest, Math.round(d));
    if (t.ground) {
      const off = e.offset != null ? e.offset : 0;
      this._note(off < 4 ? `Volltreffer · ${t.name} · ${off.toFixed(1).replace('.', ',')} m Ablage` : `${off.toFixed(1).replace('.', ',')} m neben ${t.name}`, off < 4 ? 'gold' : 'neutral');
    } else if (t.air) this._note(`${t.name} getroffen · ${fmtM(d)} · ${Math.round(e.point.y - (this.world.heightAt ? this.world.heightAt(e.point.x, e.point.z) : 0))} m Höhe`);
    else this._note(`Treffer · ${t.name}${t.distance ? ` (${t.distance} m-Reihe)` : ''} · ${fmtM(d)}${e.kind === 'explosion' ? ' · Granate' : ''}`);
  }

  _onVehHit(e) {
    const v = e && e.vehicle;
    if (!v || !v.trainingTarget) return;
    this._heal.set(v, this.G.time.elapsed + 0.4);
    const P = this.G.player;
    if (e.attacker !== P) return;
    const wd = P.vehicle ? vehicleWeapon(P.vehicle.type, e.weaponId) : VEHICLE_WEAPONS[e.weaponId];
    const shell = wd && (wd.kind === 'shell' || wd.drop || wd.look);
    if (!shell) return; // MG am Panzer: keine Wirkung, keine Meldung
    const d = this._dist(P, v.position);
    this.stats.hits++;
    this.stats.longest = Math.max(this.stats.longest, Math.round(d));
    const where = [FACE[e.face] || '', ZONE[e.zone] || ''].filter(Boolean).join(' · ');
    if (wd.penetrating || wd.guided) { this.stats.pen++; this._note(`DURCHSCHLAG · ${v.trainingTarget.name}${where ? ' · ' + where : ''} · ${fmtM(d)} · ${Math.round(e.amount)} Schaden`); }
    else this._note(`Treffer (Spreng) · ${v.trainingTarget.name}${where ? ' · ' + where : ''} · ${fmtM(d)} · ${Math.round(e.amount)} Schaden`);
  }

  _onRico(e) {
    const v = e && e.vehicle;
    if (!v || !v.trainingTarget || e.attacker !== this.G.player) return;
    this.stats.rico++;
    this._note(`ABPRALLER · ${v.trainingTarget.name} · ${fmtM(this._dist(this.G.player, e.point || v.position))} – flacher Auftreffwinkel`, 'enemy');
  }

  /* ------------------------------------------------------------ Bedienung */

  /** Hinweis für die Taste Interagieren (HUD) oder null. */
  prompt() {
    const b = this.near;
    if (!b) return null;
    return { text: `Teleport: ${this.U.areas[b.to].name}`, action: () => this.teleport(b.to) };
  }

  /** Interagieren gedrückt → true, wenn das Übungsgelände die Taste verbraucht hat. */
  onInteract() {
    if (!this.near) return false;
    this.teleport(this.near.to);
    return true;
  }

  /** Spieler in einen Bereich versetzen (steigt vorher aus). */
  teleport(id) {
    const A = this.U.areas[id], P = this.G.player, sys = this.sys;
    if (!A || !P || !P.alive) return false;
    if (P.vehicle && sys) sys.removeFromSeat(P, { teleport: false });
    const pos = new THREE.Vector3(A.x, this._ground(A.x, A.z) + 0.05, A.z);
    if (P.body && typeof P.body.teleport === 'function') P.body.teleport(pos);
    else if (P.body && P.body.position) P.body.position.copy(pos);
    if (P.position && P.position !== (P.body && P.body.position)) P.position.copy(pos);
    if (P.body && P.body.velocity) P.body.velocity.set(0, 0, 0);
    P.yaw = A.yaw; P.pitch = 0;
    this.near = null;
    this.G.events.emit('ui:sound', { name: 'confirm' });
    this._note(`Teleport: ${A.name}`, 'neutral');
    this._t = 0; // Stellplätze sofort prüfen
    return true;
  }

  /** Liste für das Menü: Fahrzeugtypen in Gruppen. */
  catalog() {
    const groups = [['Kampfpanzer und Panzer', []], ['Schützenpanzer und Transporter', []], ['Geländewagen und Lkw', []], ['Zivilfahrzeuge', []], ['Luftfahrzeuge', []]];
    for (const [id, d] of Object.entries(VEHICLES)) {
      if (d.id && d.id.startsWith('psim_')) continue;
      const g = d.air ? 4 : d.civil ? 3 : /Lkw|Geländewagen|Mannschaftswagen/.test(d.cls || '') ? 2 : /Schützen|Transport|Zugkraft|Mannschaftstransport/.test(d.cls || '') ? 1 : 0;
      groups[g][1].push({ id, name: d.name, cls: d.cls || '' });
    }
    return groups.filter((g) => g[1].length);
  }

  /** Fahrzeug herbeirufen und einsteigen (ersetzt das zuletzt gerufene, wenn es leer ist). → Fahrzeug | null */
  summon(type, variant = 0) {
    const sys = this.sys, P = this.G.player;
    if (!sys || !P || !P.alive || !VEHICLES[type]) return null;
    const def = VEHICLES[type];
    if (P.vehicle) sys.removeFromSeat(P, { teleport: true });
    const old = this.summoned;
    if (old && sys.list.includes(old) && !old.seats.some((s) => s.actor && s.actor !== P)) sys.removeVehicle(old);
    this.summoned = null;
    let pos = null, yaw = P.yaw || 0;
    if (type === 'jet') {
      const R = this.U.runway;
      if (Math.hypot(P.position.x - (R.x0 + R.x1) / 2, P.position.z - R.z) > 800) this.teleport('flugfeld');
      pos = new THREE.Vector3(700, this._ground(700, R.z), R.z); yaw = Math.PI / 2;
      for (const v of sys.list) if (!v.isOccupied && v.position.distanceTo(pos) < 14) sys.removeVehicle(v);
    } else {
      const fw = _a.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      const near = _b.copy(P.position).addScaledVector(fw, def.air ? 16 : 9);
      const spot = sys.findSpot(near, type, { maxR: 45, toward: null });
      if (spot) { pos = spot.position; } else pos = null;
    }
    if (!pos) { this._note('Kein freier, ebener Platz in der Nähe – geh auf freie Fläche (z. B. Fahrzeughof).', 'enemy'); return null; }
    const v = sys.spawnVehicle(type, pos, yaw, null, { variant });
    if (!v) return null;
    this.summoned = v;
    const di = v.seats.findIndex((s) => s.def.drive);
    const got = sys.enter(P, v, di >= 0 ? di : 0);
    this._note(got >= 0 ? `${def.name} bereit – du sitzt am Platz ${v.seats[got].def.label}` : `${def.name} steht bereit`, 'neutral');
    return v;
  }

  /** Eigenes (oder nächstes) Fahrzeug aufrichten, reparieren, anhalten. */
  resetVehicle() {
    const sys = this.sys, P = this.G.player;
    if (!sys || !P) return false;
    let v = P.vehicle;
    if (!v) { let bd = 25; for (const x of sys.list) { const d = x.position.distanceTo(P.position); if (d < bd && !x.trainingTarget) { bd = d; v = x; } } }
    if (!v) { this._note('Kein Fahrzeug in der Nähe.', 'enemy'); return false; }
    if (!v.alive) { const t = v.type; const pos = v.position.clone(); sys.removeVehicle(v); const nv = this._spawn(t, pos.x, pos.z, 0); if (nv && this.summoned === v) this.summoned = nv; this._note(`${VEHICLES[t].name} ersetzt.`, 'neutral'); return !!nv; }
    const b = v.body, f = b.forward(_a);
    const yaw = Math.atan2(-f.x, -f.z), o = v.position.clone();
    const airborne = !!(v.isAircraft && !b.onGround && o.y - this._ground(o.x, o.z) > 6);
    if (airborne) b.setPose(o, yaw, { airborne: true, speed: Math.max(40, b.vel ? b.vel.length() : 60) });
    else { o.y = this._ground(o.x, o.z) + 0.2; b.setPose(o, yaw); }
    this._fullHeal(v);
    v.sync?.(0);
    this._note(`${v.def.name} zurückgesetzt.`, 'neutral');
    return true;
  }

  /** Munition auffüllen: Infanteriewaffen, eigenes Fahrzeug (Granatengestell, Gurte, Raketen/Bomben). */
  refill() {
    const P = this.G.player;
    if (!P) return 0;
    let n = 0;
    try { n += refillAmmo(P) || 0; } catch { /* keine Waffe */ }
    const v = P.vehicle;
    if (v) {
      if (v.gun && v.gun.rack && v.def.ammo) for (const [t, c] of Object.entries(v.def.ammo)) { if ((v.gun.rack[t] || 0) < c) { v.gun.rack[t] = c; n++; } }
      for (const s of v.seats) for (const w of s.weapons || []) {
        if (!w.def) continue;
        if (w.mag < w.def.mag) { w.mag = w.def.mag; n++; }
        if (w.reserve != null && w.def.belts) w.reserve = Math.max(w.reserve, w.def.mag * w.def.belts);
        w.reloadT = 0;
      }
    }
    this.G.events.emit('ui:sound', { name: 'confirm' });
    this._note(n ? 'Munition aufgefüllt.' : 'Munition ist voll.', 'neutral');
    return n;
  }

  resetTargets() {
    try { this.U.resetTargets(); } catch { /* */ }
    for (const t of this.mode.targets || []) { const st = this.mode.tstate.get(t); if (st) st.hp = 100; t.raise?.(); }
    for (const t of this.tanks) if (t.v) this._fullHeal(t.v);
    this.stats.hits = this.stats.pen = this.stats.rico = 0; this.stats.longest = 0; this.stats.last = null;
    this._note('Ziele zurückgesetzt.', 'neutral');
  }

  setSlow(on) { this.slow = !!on; this.G.timeScale = this.slow ? SLOW : 1; return this.slow; }
  setGod(on) { this.god = !!on; if (this.G.player) this.G.player.godMode = this.god; return this.god; }

  /**
   * Panzer-Übung mit Simulation/Arcade und Rollenwahl: der Modus „Panzer“ (modes/panzer.js) lässt sich nicht im
   * Training einbetten – daher Neustart als Modus „Panzer“ auf dieser Karte mit leichten Feindkräften (Feuerlinie der
   * Schießbahn = eigene Basis, Zielraum = Feindlinie). opts: { stil, rolle, panzer }
   */
  startPanzer(opts = {}) {
    const G = this.G;
    try {
      const all = { ...(G.settings.get('modeOptions') || {}) };
      all.panzer = { ...(all.panzer || {}), stil: opts.stil || 'simulation', rolle: opts.rolle || 'kommandant', panzer: opts.panzer || 'karte', gegner: 'leicht', fuehrung: opts.stil === 'arcade' ? (all.panzer && all.panzer.fuehrung) || 'hilfe' : 'tutorial' };
      G.settings.set('modeOptions', all);
    } catch { /* Einstellungen gesperrt */ }
    const cfg = { ...(G.lastConfig || {}), modeId: 'panzer', mapId: 'range', enemies: 0, allies: 0 };
    if (G.menus && typeof G.menus.onStart === 'function') { G.menus.onStart(cfg); return true; }
    return false;
  }

  vehName(id) { return (VEHICLES[id] && VEHICLES[id].name) || id; }

  /** Stellplätze/Zustand für das Menü. */
  info() {
    const sys = this.sys;
    return { slow: this.slow, god: this.god, stats: { ...this.stats }, vehicles: sys ? sys.list.length : 0, budget: BUDGET[this.quality] || 10 };
  }
}
