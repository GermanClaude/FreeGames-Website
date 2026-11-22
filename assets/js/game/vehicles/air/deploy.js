// NULLPUNKT — Klasse Pilot: Einsatz direkt im Cockpit (Nutzer 20.11.: „Für Jets und Helikopter einen extra Platz als
// Spawn-Option“). Der Einsatz-/Ausrüstungsbildschirm (ui/deploy.js) zeigt Spielern der Klasse Pilot die Luftfahrzeuge des
// eigenen Teams (frei, besetzt, im Einsatz, zerstört mit Wartezeit); nach dem Erscheinen setzt dieses Modul den Spieler auf
// den Pilotensitz der Wahl (Standard: erstes freies – Hubschrauber vor Jet). Jets starten wie bisher: auf Karten mit
// Startbahn (world.runway, Flugplatz) von der Bahn, sonst Luftstart nach 1,4 s (air/aircraft.js).
//
// Einzelspiel/Host: VehicleSystem.enter (Regeln air/policy.js). Online-Client: Einsteige-Anfrage 'veh' mit dem optionalen
// Feld dep: 1 – der Host prüft mayDeploy (Klasse Pilot, ≤ 5 s nach dem Erscheinen, Luftfahrzeug des eigenen Teams steht
// frei am Boden) und verzichtet dann auf die Griffweite. Kein neues Nachrichtenformat.
import { VEHICLES } from '../data.js?v=20261122020853';
import { isPilot } from './policy.js?v=20261122020853';

const BOARD_WINDOW = 4; // s nach dem Erscheinen, in denen der Einsatz im Cockpit versucht wird
const TYPE_ORDER = { heli: 0, jet: 1 };

export class AirDeploy {
  constructor(air) {
    this.air = air;
    this.choice = null; // null = erstes freies, 'foot' = zu Fuß, { id, type } = bestimmtes Luftfahrzeug
    this._wasAlive = false;
    this._pending = null;
  }

  get G() { return this.air.G; }
  get sys() { return this.air.sys; }

  attach() { this._wasAlive = false; this._pending = null; }
  detach() { this._pending = null; this._wasAlive = false; }

  /** Pilot-Einsatz in diesem Match möglich (Luftfahrzeuge an, keine Kampagne)? */
  enabled() {
    const sys = this.sys;
    if (!sys || !sys.attached || sys.civilOnly || !this.air.enabled()) return false;
    return !sys.airContext().scripted;
  }

  /** Luftfahrzeuge (bzw. Stellplätze) des Teams für den Einsatzbildschirm. → [{ id, type, label, sub, available, wait }] */
  options(actor = this.G.player) {
    if (!actor || !this.enabled()) return [];
    const G = this.G, sys = this.sys, team = actor.team ?? null, now = G.time.elapsed, w = sys.world;
    const out = [];
    for (const v of sys.list) {
      if (!v.isAircraft || (v.spawnTeam ?? null) !== team) continue;
      if (!sys.replica && !v.spawn) continue; // Skript-Luftfahrzeuge ohne Stellplatz
      const pi = v.seats.findIndex((s) => s.def.drive);
      if (pi < 0) continue;
      const o = { id: v.id, type: v.type, label: v.name || v.def.name, cls: v.def.cls || '', available: false, sub: '', wait: null, vehicle: v };
      if (!v.alive || v.wreck) {
        const sp = v.spawn;
        o.wait = sp ? Math.max(0, (v.wreckLeft || 0) + Math.max(3, sp.respawn - v.def.wreckTime)) : null;
        o.sub = o.wait != null ? `Zerstört · neu in ${Math.ceil(o.wait)} s` : 'Zerstört';
      } else if (v.seats[pi].actor) o.sub = v.seats[pi].actor === actor ? 'Du fliegst' : 'Besetzt';
      else if (!this._parked(v)) o.sub = 'Im Einsatz';
      else {
        o.available = true;
        o.sub = v.air === 'jet' ? (w && w.runway ? 'Cockpit · Start von der Bahn' : 'Cockpit · Luftstart') : 'Cockpit · Rotor läuft an';
      }
      out.push(o);
    }
    if (!sys.replica) {
      sys.spawns.forEach((sp, i) => {
        const def = VEHICLES[sp.type];
        if (!def || !def.air || (sp.team ?? null) !== team || sp.vehicle || sp.capped) return;
        const wait = sp.respawnAt != null ? Math.max(0, sp.respawnAt - now) : null;
        out.push({ id: `sp${i}`, type: sp.type, label: def.name, cls: def.cls || '', available: false, sub: wait != null ? `Bereit in ${Math.ceil(wait)} s` : 'Nicht verfügbar', wait, vehicle: null });
      });
    }
    out.sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) || String(a.id).localeCompare(String(b.id)));
    return out;
  }

  _parked(v) {
    const b = v.body;
    if (!b || v.disabled) return false;
    if (this.sys.replica) { // Abbild: Lage aus dem Netz (kein onGround) – Höhe über dem Gelände; der Host prüft endgültig
      const w = this.sys.world, p = b.pos || v.position;
      const g = w && typeof w.heightAt === 'function' ? w.heightAt(p.x, p.z) : NaN;
      return !Number.isFinite(g) || p.y - g < 3;
    }
    return !!(b.onGround && Math.abs(b.speed || 0) < 3);
  }

  /** Auswahl im Einsatzbildschirm: 'foot' | null (erstes freies) | Option-Id. */
  setChoice(id) {
    if (id === 'foot' || id == null) { this.choice = id === 'foot' ? 'foot' : null; return; }
    const o = this.options().find((x) => String(x.id) === String(id));
    this.choice = o ? { id: o.id, type: o.type } : null;
  }

  /** Id der aktuellen Auswahl für die Anzeige ('foot' | Option-Id | null = automatisch). */
  choiceKey() {
    if (this.choice === 'foot') return 'foot';
    return this.choice ? String(this.choice.id) : null;
  }

  /** Luftfahrzeug für den nächsten Einsatz (null = zu Fuß bzw. keines frei). */
  pick(actor = this.G.player) {
    if (this.choice === 'foot') return null;
    const opts = this.options(actor).filter((o) => o.available && o.vehicle);
    if (!opts.length) return null;
    const c = this.choice;
    if (c) return (opts.find((o) => String(o.id) === String(c.id)) || opts.find((o) => o.type === c.type) || null)?.vehicle || null;
    return opts[0].vehicle;
  }

  /** Host: darf ein (entfernter) Spieler ohne Griffweite ins Cockpit dieses Luftfahrzeugs? */
  mayDeploy(actor, v) {
    if (!actor || !actor.alive || actor.vehicle || !v || !v.isAircraft || !isPilot(actor) || !this.enabled()) return false;
    if (this.G.time.elapsed - (actor.spawnTime ?? -1e9) > BOARD_WINDOW + 1.5) return false;
    if ((v.spawnTeam ?? null) !== (actor.team ?? null) || !v.alive || v.wreck || !this._parked(v)) return false;
    const pi = v.seats.findIndex((s) => s.def.drive);
    return pi >= 0 && !v.seats[pi].actor;
  }

  update() {
    const G = this.G, P = G.player;
    if (!P || !this.sys.attached) return;
    const alive = !!P.alive;
    if (alive && !this._wasAlive) this._onSpawn(P);
    this._wasAlive = alive;
    if (this._pending) this._tryBoard(P);
  }

  _onSpawn(P) {
    this._pending = null;
    if (!isPilot(P) || !this.enabled() || P.vehicle || this.choice === 'foot') return;
    const st = this.G.match && this.G.match.state;
    if (st === 'lobby' || st === 'loading' || st === 'ended') return;
    this._pending = { until: this.G.time.elapsed + BOARD_WINDOW, next: 0, tried: false };
  }

  _tryBoard(P) {
    const G = this.G, sys = this.sys, now = G.time.elapsed, pd = this._pending;
    if (!P.alive || P.vehicle) {
      if (P.vehicle && P.vehicle.isAircraft) this._notice(`Einsatz im Cockpit: ${P.vehicle.name || P.vehicle.def.name}`, 'ally');
      this._pending = null;
      return;
    }
    if (now > pd.until) {
      this._pending = null;
      if (pd.tried || this.choice) this._notice('Kein freies Luftfahrzeug – Einsatz zu Fuß', 'dim');
      return;
    }
    if (now < pd.next) return;
    const v = this.pick(P);
    if (!v) { pd.next = now + 0.5; return; } // Stellplätze erscheinen evtl. erst (Match-Start)
    const pi = v.seats.findIndex((s) => s.def.drive);
    pd.tried = true;
    if (sys.remote) {
      sys.remote.enter(v, pi, { deploy: true });
      pd.next = now + 0.9;
      return;
    }
    const idx = sys.enter(P, v, pi);
    pd.next = now + 0.5;
    if (idx >= 0) { this._notice(`Einsatz im Cockpit: ${v.name || v.def.name}`, 'ally'); this._pending = null; }
  }

  _notice(text, tone) {
    try { this.G.events.emit('mode:notice', { text, tone }); } catch { /* */ }
  }
}
