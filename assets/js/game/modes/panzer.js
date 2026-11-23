// NULLPUNKT — Modus „Panzer“ (Panzersimulation, Nutzer 15.11.): du bist Fahrer, Richtschütze, Ladeschütze oder Kommandant
// eines Panzers; die übrigen Plätze besetzt eine KI-Besatzung (vehicles/psim/crew-ai.js). Gegner: Feindpanzer mit KI,
// Pak-Stellungen, Feldbunker (vehicles/psim/emplacement.js) und Infanterie (Lobby-Gegner). Ziel: alle Panzer und
// Stellungen ausschalten; verloren, wenn der eigene Panzer ausfällt oder du fällst. Nur Einzelspieler (online: false).
//
// Spielart (Option „stil“):
//   simulation  alles selbst: Motor anlassen (Hauptschalter, Anlasser), Wahlhebel, Feststellbremse; Waffe scharf schalten,
//               Turmantrieb/Notbetrieb, Rechner-Munitionswahl, Laser; Lader: greifen → einschieben → schließen → entsichern;
//               Kommandant: Befehle an Fahrer/Richtschütze/Lader, Luke, Übergabe. Keine Außenansicht.
//   arcade      eine Person fährt (W/A/S/D) und richtet/schießt (Maus) zugleich, Munition per Taste 1–4, Automatiklader,
//               Außenansicht erlaubt.
// Debug-URL: spielen.html?debug=1&autostart=1&mode=panzer&map=grenzland&rolle=<fahrer|richtschuetze|lader|kommandant>
//            &sim=<1|0>&tank=<mbt|wk2|wk2h|wk1|wk1l|…>&gegner=<leicht|mittel|schwer>&enemies=N (Infanterie)
// Konsole: __game.panzer → { mode, tank, crew, order(cmd), ammo(kind), fire(), state, rolle(r) (sofort), sitz(r) (mit Blende), peek() }
//
// Platzwechsel (Nutzer 20.11.): Sitzrad (Taste „Sitzrad“ halten, Standard K; Maus/Stick wählt, Loslassen wechselt), Controller
// ◀/▶ (seat_prev/seat_next), Touch „Sitz“ (nächster Platz) – kurze Blende, Platztausch mit dem Bot dieser Rolle; der Zustand der
// Handgriffe bleibt (Motor, Bremse, Waffe, Gestell …), die KI übernimmt den verlassenen Platz (schaltet scharf, lässt an,
// entsichert, wechselt Gurte). Arcade: Richtschütze ↔ Fahrer ↔ Kommandant (↔ MG-Schütze), kein Ladeschütze.
// MG-Schütze/Funker (Bug-MG der Weltkriegs-/Nachkriegspanzer): Funkerplatz mit Funkgerät (Ein/Aus, Kanal 5 = Kompanie,
// Sprechtaste) und Kugelblende; Simulation: Gurtkasten von Hand wechseln (R: Deckel auf → Gurtkasten tauschen → Deckel zu).
// Durchsehen: in der Innensicht RMT (bzw. Hotspot) = Blick durch das Sichtgerät im Blick (Winkelspiegel, Optik, Kugelblende);
// im Winkelspiegel schwenkt die Maus von Spiegel zu Spiegel, RMT/C zurück in den Innenraum.
import * as THREE from 'three';
import { BaseMode } from './base.js?v=20261123073102';
import { modeOptionValues, parseModeOptions } from '../../shared/modes.data.js?v=20261123073102';
import { VEHICLES, VEHICLE_WEAPONS, TANK_ERAS, tankTypeFor } from '../vehicles/data.js?v=20261123073102';
import { prepareVehicleModels } from '../vehicles/models.js?v=20261123073102';
import { projectToScreen } from '../vehicles/hud.js?v=20261123073102';
import { viewOf, viewsOf, viewLookDir } from '../vehicles/views.js?v=20261123073102';
import { gunSeat, loaderSeat } from '../vehicles/crew.js?v=20261123073102';
import { equipTank, registerAmmo, rackFor, KINDS, kindOf, idFor, modsOf, crewOf, eraOf, penetration, applyEffects, knockedOut } from '../vehicles/psim/ammo.js?v=20261123073102';
import { installHooks } from '../vehicles/psim/hooks.js?v=20261123073102';
import { TankCrew, EnemyTank, TARGET_LABEL, targetPoint, bearingWord, roundRange } from '../vehicles/psim/crew-ai.js?v=20261123073102';
import { spawnEmplacement, registerEmplacements } from '../vehicles/psim/emplacement.js?v=20261123073102';
import { SimControls } from '../vehicles/psim/sim.js?v=20261123073102';
import { PanzerHUD, Radio, ammoRows } from '../vehicles/psim/hud.js?v=20261123073102';
import { PanzerOptics } from '../vehicles/psim/optics.js?v=20261123073102';
import { prismIndex } from '../vehicles/periscopes.js?v=20261123073102';
import { tx } from '../../shared/i18n.js?v=20261123073102';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ROLE = { fahrer: 'Fahrer', richtschuetze: 'Richtschütze', ladeschuetze: 'Ladeschütze', kommandant: 'Kommandant', mgschuetze: 'MG-Schütze' };
const ROLE_ALIAS = { fahrer: 'fahrer', driver: 'fahrer', richtschuetze: 'richtschuetze', rs: 'richtschuetze', gunner: 'richtschuetze', schuetze: 'richtschuetze', lader: 'ladeschuetze', ladeschuetze: 'ladeschuetze', loader: 'ladeschuetze', kommandant: 'kommandant', kdt: 'kommandant', commander: 'kommandant', mg: 'mgschuetze', mgschuetze: 'mgschuetze', funker: 'mgschuetze', bugmg: 'mgschuetze' };
const ROLE_ORDER = ['kommandant', 'richtschuetze', 'ladeschuetze', 'fahrer', 'mgschuetze'];
const SEAT_ROLE = { driver: 'fahrer', gunner: 'richtschuetze', loader: 'ladeschuetze', commander: 'kommandant', funker: 'mgschuetze', mg: 'mgschuetze' };
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const AMMO_KEYS = ['slot1', 'slot2', 'streak1', 'streak2'];
const CREW_NAMES = ['Uffz. Brandt', 'Gefr. Keller', 'OGefr. Vogt', 'Fw. Lorenz', 'Gefr. Sommer', 'Uffz. Hartwig'];
const FORCES = { leicht: { tanks: 2, pak: 1, bunker: 1 }, mittel: { tanks: 3, pak: 2, bunker: 2 }, schwer: { tanks: 5, pak: 3, bunker: 2 } };

export class PanzerMode extends BaseMode {
  constructor(G, modeId, opts = {}) {
    super(G, modeId, opts);
    this.teams = true;
    this.scores = { A: 0, B: 0 };
    this.respawnDelay = 99;
    // Optionen: Lobby (settings.modeOptions.panzer) + ?mopt= + eigene URL-Parameter
    let raw = {};
    // optKey: Panzer-Kampagne (campaign/panzer/mode.js) merkt Rolle/Spielart unter einem eigenen Schlüssel
    const optKey = opts.optKey || modeId;
    try { raw = { ...((G.settings.get('modeOptions') || {})[optKey] || {}) }; } catch { raw = {}; }
    const P = G.params && typeof G.params.get === 'function' ? G.params : null;
    if (P && P.get('mopt')) raw = { ...raw, ...parseModeOptions(P.get('mopt')) };
    const o = modeOptionValues('panzer', raw);
    if (P) {
      if (P.get('sim') === '1') o.stil = 'simulation'; else if (P.get('sim') === '0' || P.get('arcade') === '1') o.stil = 'arcade';
      const r = ROLE_ALIAS[(P.get('rolle') || '').toLowerCase()]; if (r) o.rolle = r;
      const t = P.get('tank') || P.get('panzer'); if (t && VEHICLES[t] && VEHICLES[t].drive === 'tracked' && !VEHICLES[t].civil) o.panzer = t;
      const g = P.get('gegner'); if (g && FORCES[g]) o.gegner = g;
      if (P.get('stimme') === '1') o.stimme = 'an';
    }
    if (P) { const f = P.get('fuehrung'); if (f === 'tutorial' || f === 'hilfe' || f === 'aus') o.fuehrung = f; }
    this.cfg = o;
    this.guide = o.fuehrung || 'hilfe';
    this._helpOn = this.guide === 'tutorial';
    this.arcade = o.stil === 'arcade';
    this.sim = !this.arcade;
    this.role = this.arcade ? 'richtschuetze' : ROLE_ALIAS[o.rolle] || 'kommandant';
    this.tank = null; this.crew = null; this.enemies = []; this.empl = []; this.targetsTotal = 0;
    this.playerSeat = -1;
    this.state = {
      battery: !this.sim, engine: this.sim ? 'aus' : 'an', crankT: 0, cranking: false, engineWanted: false,
      parkBrake: this.sim, selector: 'N', lights: 'kampf', armed: !this.sim, hydraulics: true, safe: false, shiftQ: 0, extCharges: 2, burnT: 0, trackRepairT: 0,
      funkOn: true, kanal: 5, // Funkgerät (Funkerplatz): Kanal 5 = Kompanie (Schild „K3 = Zug, K5 = Kp.“)
    };
    this._belt = { step: 'bereit', busy: 0, pending: 0, said: false }; // Gurtwechsel am Bug-MG (Simulation)
    this._peekFrom = null; this._peekSave = null; this._pendRole = null; this._seatW = null;
    this.marker = null; this.driverOrder = null;
    this._unhook = null; this._wheel = null; this._endAt = null; this._outcome = null; this._msgT = 0;
  }

  get deployMap() { return false; }
  allowOvertime() { return false; }
  roleLabel() { return ROLE[this.role]; }
  vehicleRules() { return { thirdPerson: this.arcade, reload: this.arcade ? 'automatisch' : 'manuell' }; }
  exitAllowed() { return !!(this.tank && (!this.tank.alive || modsOf(this.tank).brand > 0)); }
  engineOff() { return this.state.engine !== 'an'; }
  hint(text) { this.radio && this.radio.say('Hinweis', text, { tone: 'warn', quiet: true }); }

  /* ------------------------------------------------------------ Lebenszyklus */

  onAttach(s) {
    const G = this.G;
    this.hud = new PanzerHUD(this);
    this.radio = new Radio(this, this.hud.el.sub);
    this.radio.voice = this.cfg.stimme === 'an';
    this.simc = new SimControls(this);
    this.optics = new PanzerOptics(this);
    document.body.classList.add('psim-on');
    if (!document.getElementById('psim-css2')) { const st = document.createElement('style'); st.id = 'psim-css2'; st.textContent = '.psim-on .vh-rack,.psim-on .vh-seats{display:none!important}'; document.head.appendChild(st); }
    G.panzer = { mode: this, get tank() { return G.mode && G.mode.tank; }, order: (c, a) => this.crew && this.crew.order(c, a), ammo: (k) => this.crew && this.crew.orderAmmo(k), fire: () => this.crew && this.crew.fire(), designate: () => this._designate(), sim: (id, d = 1) => this.simAction(id, d), rolle: (r) => this.switchRole(r), sitz: (r) => this.requestRole(r), rollen: () => this.rolesOf(), peek: () => this._peekNearest(), unpeek: () => this._unpeek(), get state() { return G.mode && G.mode.state; } };
    if (!s) return;
    s.on('vehicle:loaded', (e) => this._onLoaded(e));
    s.on('vehicle:destroyed', (e) => this._onDestroyed(e));
    s.on('vehicle:crit', (e) => this._onCrit(e));
    s.on('vehicle:hit', (e) => this._onHit(e));
    s.on('vehicle:ricochet', (e) => { if (e.vehicle === this.tank) this.radio.say('Richtschütze', 'Abpraller an uns!', { tone: 'warn' }); });
    s.on('kill', (e) => this._onKillEv(e));
    s.on('vehicle:gear', (e) => { if (e.vehicle === this.tank && e.blocked && this.role === 'fahrer') this.hint('Getriebe sperrt – erst anhalten'); });
  }

  onDetach() {
    const G = this.G;
    if (this._unhook) { this._unhook(); this._unhook = null; }
    if (this.tank && this.tank.body && this.tank.body.drivetrain && this.tank.body.drivetrain._psimRun) { this.tank.body.drivetrain.run = this.tank.body.drivetrain._psimRun; }
    this.simc?.dispose(); this.optics?.dispose(); this.radio?.clear(); this.hud?.dispose();
    this.simc = this.optics = this.radio = this.hud = null;
    if (G.input && G.input.wheel && G.input.wheel.open && this._wheel) G.input.closeWheel();
    document.body.classList.remove('psim-on');
    if (G.panzer && G.panzer.mode === this) G.panzer = null;
  }

  onStart() {
    const G = this.G;
    try { this._setup(); } catch (err) { console.error('[Panzer] Aufbau fehlgeschlagen', err); }
    void G;
  }

  /** Fahrzeugsystem vorbereiten: Kartenpanzer räumen, Stellungstypen anlegen. → sys | null */
  _prepSystem() {
    const G = this.G, sys = G.vehicles;
    if (!sys) return null;
    if (!sys.attached) sys.attach(G);
    if (!sys.attached) return null;
    sys.civilOnly = false;
    registerEmplacements();
    // Kartenpanzer entfernen (Stellplätze ohne Wiedererscheinen) – der Modus stellt seine eigenen Kräfte
    sys.spawns = (sys.spawns || []).filter((sp) => VEHICLES[sp.type] && VEHICLES[sp.type].civil);
    for (const v of [...sys.list]) if (!v.def.civil) { try { sys.removeVehicle(v); } catch { /* */ } }
    return sys;
  }

  /** Eigene Basis (Team A) und Feindbasis (B) der Karte → { A, B } (Mittel der Spawnpunkte). */
  _bases() {
    const W = this.G.world;
    const avg = (list) => { const p = new THREE.Vector3(); if (!list || !list.length) return null; for (const s of list) p.add(s.position); return p.multiplyScalar(1 / list.length); };
    const center = W.bounds ? W.bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    const A = avg(W.spawns && W.spawns.A) || center.clone().add(_a.set(-150, 0, 0));
    const B = avg(W.spawns && W.spawns.B) || center.clone().add(_a.set(150, 0, 0));
    this.baseA = A; this.baseB = B;
    return { A, B };
  }

  /** Feindtypen passend zur Generation des eigenen Panzers (KP-68: Kalter Krieg, nicht die modernen). */
  _foeTypes(type) {
    const D = VEHICLES[type];
    const E = TANK_ERAS[D && D.era] || TANK_ERAS[eraOf(D)] || TANK_ERAS.modern;
    return [...new Set([E.B, E.B2, E.A, E.A2])].filter((t) => t && VEHICLES[t] && VEHICLES[t].drive === 'tracked' && t !== 'spz');
  }

  _setup() {
    const G = this.G, sys = this._prepSystem();
    if (!sys) return;
    // Typen
    const era0 = this.cfg.panzer && this.cfg.panzer !== 'karte' ? null : (G.match && G.match.tankEra) || 'karte';
    const type = this.cfg.panzer && this.cfg.panzer !== 'karte' && VEHICLES[this.cfg.panzer] ? this.cfg.panzer : tankTypeFor(era0, G.match && G.match.mapId, 'A');
    const foeTypes = this._foeTypes(type);
    try { prepareVehicleModels([...new Set([type, ...foeTypes])], ['A', 'B'], sys.quality); } catch (err) { console.warn('[Panzer] Modelle', err); }
    // Aufstellung: eigene Basis (Team A) und Feindlinie zwischen den Basen
    const { A, B } = this._bases();
    const spot = sys.findSpot(A, type, { avoidSpawns: true, toward: B, maxR: 60 }) || { position: A.clone(), yaw: Math.atan2(-(B.x - A.x), -(B.z - A.z)) };
    if (!this._spawnOwn(type, spot.position, spot.yaw)) return;
    this._spawnForces(type, foeTypes, A, B);
    this._hooks();
    this._intro();
  }

  /** Eigener Panzer mit KI-Besatzung und Spieler im gewählten Platz. → Fahrzeug | null */
  _spawnOwn(type, position, yaw) {
    const G = this.G, sys = G.vehicles;
    const tank = sys.spawnVehicle(type, position, yaw, 'A');
    if (!tank) { console.warn('[Panzer] Panzer konnte nicht erscheinen'); return null; }
    this.tank = tank;
    equipTank(tank);
    // Besatzung (Bots) in alle Plätze außer dem des Spielers
    this.playerSeat = this._seatFor(tank, this.role);
    const others = tank.seats.filter((s) => s.index !== this.playerSeat);
    const bots = G.bots.spawnBots({ allies: others.length, enemies: 0, difficulty: G.match.difficulty, modeId: 'panzer' }) || [];
    others.forEach((s, i) => {
      const b = bots[i];
      if (!b) return;
      b._psim = { crew: true, role: s.def.id };
      b.name = (this.crewNames && this.crewNames[s.def.id]) || CREW_NAMES[i % CREW_NAMES.length];
      try { const pl = G.bots._plates && G.bots._plates.get(b); if (pl && pl.setName) pl.setName(b.name); } catch { /* */ }
      if (!G.actors.includes(b)) G.actors.push(b);
      G.spawnActor(b, { position: tank.position.clone().add(_a.set(3 + i, 0, 2)), yaw: 0 });
      try { sys.enter(b, tank, s.index); } catch (err) { console.warn('[Panzer] Besatzung', err); }
    });
    this.crew = new TankCrew(this, tank);
    this.crew.arcade = this.arcade;
    if (this.sim) {
      // Motor aus bis zum Anlassen; Turmantrieb/Schwenkgeschwindigkeit je Fahrzeug (eigene Datenkopie)
      const dt = tank.body.drivetrain;
      if (dt) {
        dt._psimRun = dt.run;
        const self = this;
        dt.run = function run() { if (self.state.engine === 'an') return dt._psimRun.call(dt); this.offT = 0; if (this.engineOn) { this.engineOn = false; const s = this.state; s.rpm = 0; s.rpmNorm = 0; s.throttle = 0; this.Te = 0; } };
      }
      if (this.role !== 'fahrer') { this.state.battery = true; this.state.parkBrake = false; this.state.engineWanted = true; }
      if (this.role !== 'richtschuetze') this.state.armed = true;
    }
    this._ownDef(tank);
    // Spieler einsetzen
    this._enterPlayer();
    return tank;
  }

  /** Zufällige Feindkräfte zwischen den Basen (freier Modus; die Kampagne stellt ihre Kräfte selbst). */
  _spawnForces(type, foeTypes, A, B) {
    const G = this.G, sys = G.vehicles;
    const era = eraOf(VEHICLES[type]);
    const F = { ...(FORCES[this.cfg.gegner] || FORCES.mittel) };
    if (sys.quality === 'low') { F.tanks = Math.min(F.tanks, 2); F.pak = Math.min(F.pak, 1); F.bunker = Math.min(F.bunker, 1); }
    const dir = _b.copy(B).sub(A).setY(0);
    const L = Math.max(80, dir.length()); dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const place = (t, lat, kind) => {
      const p = A.clone().addScaledVector(dir, L * t).addScaledVector(side, lat);
      const s2 = sys.findSpot(p, kind, { avoid: [...this.empl.map((e) => e.position), ...this.enemies.map((e) => e.v.position)], toward: A, maxR: 50 });
      return s2 || { position: p, yaw: Math.atan2(-(A.x - p.x), -(A.z - p.z)) };
    };
    const lat = (i, n, w) => (n <= 1 ? 0 : (i / (n - 1) - 0.5) * w) + (Math.random() - 0.5) * 20;
    const wk1 = era === 'wk1';
    const width = Math.min(260, L * 0.8);
    for (let i = 0; i < F.pak; i++) {
      const s2 = place(wk1 ? 0.62 : 0.7 + Math.random() * 0.08, lat(i, F.pak, width), 'psim_pak');
      this.spawnEmpl('pak', s2.position, s2.yaw, 'B', { ammoFrom: foeTypes[0] });
    }
    for (let i = 0; i < F.bunker; i++) {
      const s2 = place(0.78 + Math.random() * 0.08, lat(i, F.bunker, width * 0.7), 'psim_bunker');
      this.spawnEmpl('bunker', s2.position, s2.yaw, 'B');
    }
    for (let i = 0; i < F.tanks; i++) {
      const ft = foeTypes[i % foeTypes.length];
      const s2 = place(0.82 + Math.random() * 0.12, lat(i, F.tanks, width), ft);
      this.spawnTank(ft, s2.position, s2.yaw, 'B', { post: s2.position.clone() });
    }
    this.targetsTotal = this.enemies.length + this.empl.length;
    // Verteidigungsposten der Infanterie (Lobby-Gegner) an den Stellungen
    this.posts = this.empl.map((e) => e.position.clone().addScaledVector(_c.set(Math.sin(e.yaw), 0, Math.cos(e.yaw)), 6));
  }

  /**
   * KI-Panzer (Feind B oder Verbündeter A) mit einem Bot am Steuer (EnemyTank-KI: Ziele suchen, richten, Stellung).
   * o: { post, route: [Vector3…], name, hold } → EnemyTank | null (Feinde landen in this.enemies, Verbündete in this.friends)
   */
  spawnTank(type, position, yaw, team = 'B', o = {}) {
    const G = this.G, sys = G.vehicles;
    try { prepareVehicleModels([type], [team], sys.quality); } catch { /* bei Bedarf */ }
    const v = sys.spawnVehicle(type, position, yaw, team);
    if (!v) return null;
    equipTank(v);
    this._ownDef(v);
    crewOf(v);
    const [bot] = G.bots.spawnBots({ allies: team === 'A' ? 1 : 0, enemies: team === 'B' ? 1 : 0, difficulty: G.match.difficulty, modeId: 'panzer' }) || [];
    if (!bot) { sys.removeVehicle(v); return null; }
    bot._psim = { tankCrew: true };
    if (o.name) { bot.name = o.name; try { const pl = G.bots._plates && G.bots._plates.get(bot); if (pl && pl.setName) pl.setName(o.name); } catch { /* */ } }
    if (!G.actors.includes(bot)) G.actors.push(bot);
    G.spawnActor(bot, { position: v.position.clone().add(_a.set(3, 0, 0)), yaw: 0 });
    try { sys.enter(bot, v, 0); } catch (err) { console.warn('[Panzer] Panzerbesatzung', err); }
    const e = new EnemyTank(this, v, bot, { post: o.post || position.clone(), route: o.route || null, team, hold: !!o.hold, side: o.side || 1 });
    if (team === 'B') this.enemies.push(e); else (this.friends || (this.friends = [])).push(e);
    return e;
  }

  /** Feste Stellung (pak, bunker, funk, lager, bruecke) mit Bedienung (pak/bunker). → Emplacement */
  spawnEmpl(kind, position, yaw, team = 'B', { crew = true, ammoFrom = null } = {}) {
    const sys = this.G.vehicles;
    const ammoType = ammoFrom || (this.tank ? this._foeTypes(this.tank.type)[0] : 'mbt');
    const e = spawnEmplacement(sys, `psim_${kind}`, position, yaw, team, kind === 'pak' ? { ammoId: registerAmmo(ammoType)[0] } : {});
    if (crew && (kind === 'pak' || kind === 'bunker')) this._emplCrew(e);
    this.empl.push(e);
    return e;
  }

  /** Datenkopie je Fahrzeug (Schwenkgeschwindigkeit nach Turmantrieb/Schaden), Rest über den Prototyp. */
  _ownDef(v) {
    if (v._psimBase) return;
    v._psimBase = v.def;
    v.def = Object.create(v.def);
    // Gestell-Sollbestand in Modus-Munition: sonst füllt die Versorgung (resupply.js) mit den Grundsorten PG/SG auf
    if (v._psimAmmo) v.def.ammo = rackFor(v.type);
    this._wrapDamage(v);
  }

  /**
   * Panzerfäuste/Raketen (Panzerabwehrtrupps, weapons/ballistics/rockets.js) gegen Modus-Panzer: statt pauschalem
   * Granatenschaden mit Besatzungstreffer (vehicle.js _penetration: bis 190 Schaden im Umkreis → Sofort-Tod) wie eine
   * Hohlladung (~330 mm) nach Platte und Winkel – vorn am Kampfpanzer wirkungslos, Seite/Heck gefährlich (ammo.js).
   */
  _wrapDamage(v) {
    if (v._psimDmgWrapped || !v.def.armored) return;
    v._psimDmgWrapped = true;
    const orig = v.applyDamage.bind(v), sys = this.G.vehicles;
    v.applyDamage = (amount, info = {}) => {
      const w = info.weaponId && VEHICLE_WEAPONS[info.weaponId];
      if (info.kind !== 'shell' || (w && w.psim) || !info.point || !info.dir) return orig(amount, info);
      const dl = _c.copy(info.dir).applyQuaternion(_q.copy(v.body.quat).invert());
      const face = info.zone === 'turret' && dl.y < -0.7 ? 'top' : Math.abs(dl.z) >= Math.abs(dl.x) ? (dl.z > 0 ? 'front' : 'rear') : 'side';
      const ln = face === 'front' ? _d.set(0, 0, -1) : face === 'rear' ? _d.set(0, 0, 1) : face === 'top' ? _d.set(0, 1, 0) : _d.set(dl.x > 0 ? -1 : 1, 0, 0);
      const def = { id: info.weaponId || 'rakete', psim: { role: 'ce', pen0: 330, penLoss: 0, rico: 85, norm: 0, cone: 9, coneLen: 1.8, filler: 0 } };
      const hit = { zone: info.zone, face, localNormal: ln.clone(), point: info.point };
      const res = penetration(v, def, hit, info.dir, 50);
      const dealt = orig(res.penetrated ? Math.min(amount, 300) * 0.55 : amount * 0.08, { ...info, kind: 'explosive' });
      if (v.alive && res.penetrated) {
        const notes = applyEffects(sys, v, { attacker: info.attacker || null, weaponId: info.weaponId, point: info.point, dir: info.dir, def, res, hit });
        const ko = knockedOut(v);
        if (ko && v.alive) { v._psimKo = ko; v.destroy(info.attacker || null, info.weaponId); }
        if (notes.length) this.G.events.emit('vehicle:crit', { vehicle: v, attacker: info.attacker || null, notes });
      }
      return dealt;
    };
  }

  _emplCrew(e) {
    const G = this.G;
    const [bot] = G.bots.spawnBots({ allies: 0, enemies: 1, difficulty: G.match.difficulty, modeId: 'panzer' }) || [];
    if (!bot) return;
    const post = e.body.toWorld(_a.set(e.kind === 'pak' ? 0.9 : 0, 0, e.kind === 'pak' ? 2.4 : 3.2), new THREE.Vector3());
    const h = G.world && G.world.groundHeight ? G.world.groundHeight(post.x, post.z, post.y + 5) : null;
    if (h != null) post.y = h;
    bot._psim = { post, empl: e };
    if (!G.actors.includes(bot)) G.actors.push(bot);
    G.spawnActor(bot, { position: post.clone(), yaw: e.yaw });
    e.crew = bot;
  }

  /** Platz einer Rolle (ohne Zustand zu ändern). Fehlt der Platz (z. B. LK-17: zwei Mann), die nächstliegende Rolle. → { idx, role } */
  seatOfRole(v, role) {
    const S = v.seats;
    const by = (fn) => { const s = S.find(fn); return s ? s.index : -1; };
    const gs = gunSeat(v), ls = loaderSeat(v);
    let i = -1, r = role;
    if (role === 'fahrer') i = by((s) => s.def.drive);
    else if (role === 'richtschuetze') i = gs ? gs.index : -1;
    else if (role === 'ladeschuetze') i = ls ? ls.index : -1;
    else if (role === 'kommandant') i = by((s) => s.def.id === 'commander');
    else if (role === 'mgschuetze') {
      i = by((s) => s.def.id === 'funker' || s.def.id === 'mg');
      // Transporter ohne Kanone (MTW: „Kommandant (MG)“ am Waffenring): dessen MG-Platz ist der MG-Schützenplatz – vorher
      // lieferte rollen() nur den Fahrer, obwohl Besatzung und Hinweis einen zweiten Platz zeigten (Proportionen 22.11.)
      if (i < 0 && !gs) i = by((s) => !!s.def.mount && s.weapons.some((w) => w.def.kind === 'mg'));
    }
    if (i < 0) {
      // moderne Panzer: das MG bedient der Kommandant (fernbedient); sonst wie bisher
      if (role === 'mgschuetze') { i = by((s) => s.def.id === 'commander'); r = 'kommandant'; if (i < 0) { i = gs ? gs.index : -1; r = 'richtschuetze'; } }
      else if (role === 'ladeschuetze' || role === 'kommandant') { i = gs ? gs.index : by((s) => s.def.id === 'commander'); r = gs && i === gs.index ? 'richtschuetze' : 'kommandant'; }
      if (i < 0) { i = 0; r = 'fahrer'; }
    }
    return { idx: i, role: r };
  }

  _seatFor(v, role) {
    const o = this.seatOfRole(v, role);
    this.role = o.role;
    return o.idx;
  }

  /** Spielbare Plätze des eigenen Panzers (Sitzrad): [{ role, idx, label, sub, cur }]; Arcade ohne Ladeschütze. */
  rolesOf(v = this.tank) {
    if (!v) return [];
    const out = [], seen = new Set();
    for (const r of ROLE_ORDER) {
      if (this.arcade && r === 'ladeschuetze') continue;
      const o = this.seatOfRole(v, r);
      if (o.role !== r || seen.has(o.idx)) continue;
      seen.add(o.idx);
      const st = v.seats[o.idx], a = st.actor;
      out.push({ role: r, idx: o.idx, label: st.def.label || ROLE[r], sub: a === this.G.player ? 'du' : a && a.alive ? a.name || 'Besatzung' : 'unbesetzt', cur: o.idx === this.playerSeat });
    }
    return out;
  }

  _enterPlayer() {
    const G = this.G, P = G.player, v = this.tank, sys = G.vehicles;
    if (!P || !v || !P.alive) return false;
    if (P.vehicle === v) return true;
    if (P.vehicle) sys.removeFromSeat(P, { teleport: false });
    const r = sys.enter(P, v, this.playerSeat);
    if (r < 0) return false;
    const seat = v.seats[this.playerSeat];
    // Startsicht: Simulation in der Innensicht (Handgriffe), Arcade außen
    const list = viewsOf(seat.def);
    let vi = this.arcade ? list.findIndex((x) => x.tp) : list.findIndex((x) => x.interior);
    if (this.sim && this.role === 'kommandant') vi = list.findIndex((x) => x.overlay === 'peri');
    if (vi < 0) vi = list.findIndex((x) => !x.tp);
    sys.setSeatView(P, vi);
    seat.look.yaw = v.yaw; seat.look.pitch = 0; seat.look.relYaw = 0; seat.look.relPitch = this.role === 'fahrer' ? -0.25 : 0;
    this.simc.build(v, this.role);
    return true;
  }

  /** Rolle wechseln (Konsole/Tests: __game.panzer.rolle('fahrer')): Platz mit dem Bot dieser Rolle tauschen, sofort. */
  switchRole(role) {
    const G = this.G, v = this.tank, sys = G.vehicles, P = G.player;
    role = ROLE_ALIAS[role] || role;
    if (!v || !v.alive || !P || !ROLE[role]) return false;
    if (this.arcade && role === 'ladeschuetze') role = 'richtschuetze';
    const old = this.playerSeat, oldRole = this.role;
    this.role = role;
    const idx = this._seatFor(v, role);
    if (idx === old) { this.role = oldRole; return true; }
    this._unpeek(true);
    this._leaveRole(oldRole);
    const bot = v.seats[idx].actor;
    sys.removeFromSeat(P, { teleport: false });
    if (bot) { sys.removeFromSeat(bot, { teleport: false }); sys.enter(bot, v, old); if (bot._psim) bot._psim.role = v.seats[old].def.id; }
    this.playerSeat = idx;
    this.simc.dispose();
    this._enterPlayer();
    this._enterRole(this.role);
    return true;
  }

  /** Platzwechsel mit Blende (Sitzrad, ◀/▶, Touch): 0,25 s abblenden, tauschen, aufblenden. → bool */
  requestRole(role) {
    const G = this.G, v = this.tank, sys = G.vehicles;
    role = ROLE_ALIAS[role] || role;
    if (!v || !v.alive || !ROLE[role] || this._pendRole) return false;
    const o = this.seatOfRole(v, this.arcade && role === 'ladeschuetze' ? 'richtschuetze' : role);
    if (o.idx === this.playerSeat) { this.hint(`Du sitzt schon am Platz ${v.seats[o.idx].def.label}`); return false; }
    const now = G.time.elapsed, label = v.seats[o.idx].def.label;
    sys._switch = { at: now, until: now + 5, label };
    this._pendRole = { role: o.role, at: now + 0.26, label };
    return true;
  }

  /** Nächster/voriger Platz (◀/▶, Touch „Sitz“). */
  cycleRole(step = 1) {
    const L = this.rolesOf();
    if (L.length < 2) return false;
    const i = Math.max(0, L.findIndex((x) => x.cur));
    return this.requestRole(L[(i + step + L.length) % L.length].role);
  }

  /** Verlassener Platz: die KI übernimmt – Zustände so setzen, dass der Bot weiterarbeiten kann. */
  _leaveRole(old) {
    const st = this.state, v = this.tank;
    if (!this.sim) return;
    if (old === 'richtschuetze' && !st.armed) { st.armed = true; this.radio.say('Richtschütze', 'Waffe scharf!', { quiet: true }); }
    if (old === 'fahrer') st.engineWanted = true;
    if (old === 'ladeschuetze') st.safe = false;
    if (old === 'mgschuetze') {
      st.funkOn = true; st.kanal = 5; if (v) v._psimKanal = 5;
      const w = this._mgWeapon();
      if (w) { if (this._belt.pending > 0) { w.mag += this._belt.pending; this._belt.pending = 0; } if (w.mag <= 0 && w.reserve > 0 && w.reloadT <= 0) w.reloadT = w.def.reload; }
      this._belt.step = 'bereit'; this._belt.busy = 0;
    }
  }

  /** Neuer Platz: kurzer Hinweis auf die Aufgaben. */
  _enterRole(role) {
    const T = {
      fahrer: 'Fahrerplatz: Fahren, Befehle des Kommandanten oben im Bild.', richtschuetze: 'Richtschütze: Hauptzieloptik (C bzw. RMT), richten und schießen.',
      ladeschuetze: 'Ladeschütze: befohlene Munition laden und entsichern.', kommandant: 'Kommandant: Lage durch Periskop/Winkelspiegel, Ziele übergeben, Befehle.',
      mgschuetze: this.sim ? 'MG-Schütze/Funker: Kugelblende (RMT), Feuerstöße, Gurt wechseln (R), Funkgerät.' : 'MG-Schütze: Kugelblende, Feuerstöße.',
    };
    if (T[role]) this.hint(T[role]);
    const v = this.tank;
    if (v) v._psimKanal = this.state.kanal;
  }

  /* ------------------------------------------------------------ Durchsehen (Winkelspiegel, Optiken) */

  /** Durch ein Sichtgerät sehen (sim.js devicesOf): Sicht setzen, Blick auf den Spiegel bzw. die Waffenrichtung. */
  peek(dev) {
    const G = this.G, P = G.player, v = this.tank, sys = G.vehicles;
    if (!v || !dev || !P || P.vehicle !== v) return false;
    const seat = v.seats[this.playerSeat];
    const list = viewsOf(seat.def), cur = viewOf(seat), vw = list[dev.vi];
    if (!vw) return false;
    const L = seat.look;
    if (cur.interior) { this._peekFrom = seat.view; this._peekSave = { relYaw: L.relYaw, relPitch: L.relPitch }; }
    else if (this._peekFrom == null) { const ii = list.findIndex((x) => x.interior); this._peekFrom = ii >= 0 ? ii : null; }
    if (vw.prisms) {
      const pr = vw.prisms[dev.j || 0];
      if (!pr.rot) L.relYaw = pr.yaw;
      L.relPitch = 0;
    } else if (vw.look === 'mount') {
      try { v.muzzle(seat.index, _a, _b, true); } catch { G.camera.getWorldDirection(_b); }
      if (!Number.isFinite(_b.x) || _b.lengthSq() < 0.5) G.camera.getWorldDirection(_b);
      L.yaw = Math.atan2(-_b.x, -_b.z); L.pitch = Math.asin(clamp(_b.y, -1, 1));
    }
    sys.setSeatView(P, dev.vi);
    sys._viewLabel = { text: vw.prisms && vw.prisms.length > 1 ? `${vw.label} – Maus schwenkt zum nächsten` : vw.label, until: G.time.elapsed + 1.6 };
    this._click();
    return true;
  }

  /** Zurück in den Innenraum (RMT/C im Sichtgerät). quiet: ohne Sichtwechsel (Platzwechsel). → bool */
  _unpeek(quiet = false) {
    if (this._peekFrom == null) return false;
    const G = this.G, P = G.player, v = this.tank, from = this._peekFrom, save = this._peekSave;
    this._peekFrom = null; this._peekSave = null;
    if (quiet || !v || !P || P.vehicle !== v) return true;
    const seat = v.seats[this.playerSeat];
    G.vehicles.setSeatView(P, from);
    if (save) { seat.look.relYaw = save.relYaw; seat.look.relPitch = save.relPitch; }
    return true;
  }

  /** RMT in der Innensicht: Sichtgerät nahe der Bildmitte, sonst das Hauptgerät der Rolle. */
  _peekNearest() {
    const G = this.G, v = this.tank, devs = this.simc && this.simc.devices;
    if (!v || !devs || !devs.length) { this.hint('Kein Sichtgerät an diesem Platz'); return false; }
    const cam = G.camera;
    cam.getWorldDirection(_c);
    let best = null, ba = 0.5;
    for (const d of devs) {
      const p = this.simc.world(v, d, _d).sub(cam.position);
      const len = p.length();
      if (len > 2.2 || len < 0.03) continue;
      const ang = Math.acos(clamp(p.multiplyScalar(1 / len).dot(_c), -1, 1));
      if (ang < ba) { ba = ang; best = d; }
    }
    if (!best) {
      const seat = v.seats[this.playerSeat], yaw = seat.look.relYaw;
      const pref = { fahrer: ['prism'], richtschuetze: ['optic'], kommandant: ['peri', 'prism'], ladeschuetze: ['prism'], mgschuetze: ['kugel', 'prism'] }[this.role] || ['prism', 'optic', 'peri', 'kugel'];
      for (const k of pref) {
        const c = devs.filter((d) => d.kind === k);
        if (!c.length) continue;
        if (k === 'prism') { const vw = viewsOf(seat.def)[c[0].vi]; const j = prismIndex(vw, yaw); best = c.find((d) => (d.j || 0) === j) || c[0]; } else best = c[0];
        break;
      }
      best = best || devs[0];
    }
    return this.peek(best);
  }

  /* ------------------------------------------------------------ Bug-MG: Gurtwechsel (Simulation) */

  _mgWeapon() {
    const v = this.tank;
    if (!v) return null;
    const o = this.seatOfRole(v, 'mgschuetze');
    if (o.role !== 'mgschuetze') return null;
    const s = v.seats[o.idx];
    return s.weapons.find((w) => w.def.kind === 'mg') || null;
  }

  beltLabel() {
    const w = this._mgWeapon(), b = this._belt;
    if (!w) return 'Gurtkasten';
    if (b.busy > 0) return b.step === 'offen' ? 'Gurtkasten wird getauscht …' : 'beschäftigt …';
    const belts = Math.floor((w.reserve || 0) / w.def.mag);
    if (b.step === 'offen') return `Gurtkasten tauschen (R) – noch ${belts} Gurtkästen`;
    if (b.step === 'eingelegt') return 'Deckel schließen und durchladen (R)';
    if (b.step === 'leer') return 'Gurt leer – Deckel öffnen (R)';
    return `MG feuerbereit – ${w.mag} Schuss (R: Gurt wechseln)`;
  }

  _beltStep() {
    const w = this._mgWeapon(), b = this._belt;
    if (!w || b.busy > 0) { if (b.busy > 0) this.hint('Noch beschäftigt'); return; }
    if (b.step === 'bereit' || b.step === 'leer') {
      // Deckel auf: Restgurt heraus (Schuss zurück in den Vorrat)
      if (w.mag > 0) { w.reserve = (w.reserve || 0) + w.mag; w.mag = 0; }
      w.reloadT = 0;
      b.busy = 0.6; b.next = 'offen';
    } else if (b.step === 'offen') {
      const n = Math.min(w.def.mag, w.reserve || 0);
      if (n <= 0) { this.hint('Keine Gurtkästen mehr – Versorgungspunkt anfahren'); return; }
      w.reserve -= n; b.pending = n;
      b.busy = 2.2; b.next = 'eingelegt';
    } else if (b.step === 'eingelegt') { b.busy = 0.8; b.next = 'bereit'; }
    this._click();
  }

  _beltTick(dt) {
    const w = this._mgWeapon(), b = this._belt;
    if (!w) return;
    const mine = this.sim && this.role === 'mgschuetze';
    if (!mine) return;
    if (w.reloadT > 0) w.reloadT = 0; // keine Automatik am eigenen Platz
    if (b.busy > 0) {
      b.busy -= dt;
      if (b.busy <= 0) {
        b.busy = 0; b.step = b.next || b.step; b.next = null;
        if (b.step === 'bereit') { w.mag += b.pending; b.pending = 0; b.said = false; this.radio.say('MG-Schütze', 'MG fertig!', { quiet: true }); try { this.G.vehicles.audio.loadSound('munition', 0.8); } catch { /* */ } }
      }
      return;
    }
    if (b.step === 'bereit' && w.mag <= 0) { b.step = 'leer'; if (!b.said) { b.said = true; this.hint(`Gurt leer – Gurtkasten wechseln (${this.G.input.label('reload') || 'R'})`); } }
  }

  funkMuted() { const st = this.state; return this.sim && (!st.funkOn || st.kanal !== 5); }

  _hooks() {
    if (this._unhook) return;
    this._unhook = installHooks(this.G.vehicles, this);
  }

  _intro() {
    const R = this.radio, t = this.tank;
    if (!R || !t) return;
    const n = this.targetsTotal;
    // Aufzählung als ein Platzhalter: die Übersetzung wählt je Teil „{#} Panzer“ usw. die Pluralform (tools/i18n/64-logik.mjs,
    // shared/i18n.js plural) – vorher „1 AT guns, 1 bunkers“
    const lage = [`${this.enemies.length} Panzer`, `${this.empl.filter((e) => e.kind === 'pak').length} Pak`, `${this.empl.filter((e) => e.kind === 'bunker').length} Bunker`].join(', ');
    R.say('Funk', `Kompanie an ${t.def.name}: Feindstellung voraus – ${lage}. Angreifen und vernichten!`);
    void n;
    if (this.sim) {
      const t2 = { fahrer: 'Du bist Fahrer. Hauptschalter, Anlasser, Feststellbremse lösen, Gang einlegen.', richtschuetze: 'Du bist Richtschütze. Waffe scharf schalten, dann in die Hauptzieloptik (Sicht wechseln).', ladeschuetze: 'Du bist Ladeschütze. Befohlene Munition laden und entsichern.', kommandant: 'Du bist Kommandant. Führe deine Besatzung.', mgschuetze: 'Du bist MG-Schütze und Funker. Funkgerät auf Kanal 5, durch die Kugelblende (RMT) zielen, Feuerstöße auf Infanterie.' }[this.role];
      setTimeout(() => this.radio && this.radio.say('Hinweis', t2, { tone: 'warn', quiet: true }), 1500);
    }
  }

  /* ------------------------------------------------------------ Spawns/Bots/Ergebnis */

  canRespawn() { return false; }

  objectiveFor(bot) {
    const k = bot._psim;
    if (k && k.post) return { id: `psim:post:${bot.id}`, position: k.post, radius: 1.2, kind: 'capture' };
    if (k) return null;
    const T = this.tank;
    if (bot.team === 'A') {
      if (!T || !T.alive) return null;
      const back = _a.set(Math.sin(T.yaw), 0, Math.cos(T.yaw)).multiplyScalar(14).add(T.position);
      return { id: 'psim:folgen', position: back.clone(), radius: 10, kind: 'capture' };
    }
    // Feindinfanterie: Posten an den Stellungen, angreifen, wenn der Panzer nahe ist
    if (!this.posts || !this.posts.length) return null;
    const hid = Math.abs(hash(String(bot.id)));
    if (T && T.alive && bot.position.distanceTo(T.position) < 220 && hid % 3 === 0) return null;
    const i = hid % this.posts.length;
    return { id: `psim:def:${i}`, position: this.posts[i], radius: 9, kind: 'capture' };
  }

  decide() { return { winner: this._outcome === 'win' ? 'A' : this._outcome === 'loss' ? 'B' : (this.scores.A >= this.scores.B ? 'A' : 'B') }; }

  onKillScored(killer, victim) { if (killer && killer.team && killer.team !== victim.team) this.addTeamScore(killer.team, 1); }

  resultExtra() {
    const left = this.enemies.filter((e) => e.v.alive).length + this.empl.filter((e) => e.alive).length;
    return { panzer: { ziele: this.targetsTotal, vernichtet: this.targetsTotal - left, rolle: ROLE[this.role], stil: this.arcade ? 'Arcade' : 'Simulation' } };
  }

  _finish(outcome, text) {
    if (this._outcome) return;
    this._outcome = outcome;
    this._banner = text;
    this._endAt = this.G.time.elapsed + 4;
    this.radio && this.radio.say('Funk', outcome === 'win' ? 'Alle Ziele vernichtet – gut gemacht. Sammeln!' : 'Verbindung verloren …', { tone: outcome === 'win' ? 'funk' : 'warn' });
  }

  /* ------------------------------------------------------------ Ereignisse */

  _onLoaded(e) {
    if (!e || e.vehicle !== this.tank) return;
    const k = kindOf(e.ammo);
    const call = k ? KINDS[k].call : '';
    if (this.role === 'ladeschuetze' && this.sim) { this.state.safe = true; this.hint('Kanone geladen – Sicherung entsichern (Hotspot oder R)'); }
    else this.radio.say('Ladeschütze', `${call} geladen!`, { key: 'geladen', quiet: this.role === 'ladeschuetze' });
  }

  _onDestroyed(e) {
    const v = e && e.vehicle;
    if (!v) return;
    if (v === this.tank) { this._finish('loss', v._psimKo === 'Munition' || v._ammoRack ? 'Munition gezündet – Panzer verloren' : 'Panzer verloren'); return; }
    const isT = this.enemies.some((x) => x.v === v) || this.empl.includes(v);
    if (!isT) return;
    this.addTeamScore('A', 5);
    if (e.by && e.by !== this.G.player && e.by.vehicle === this.tank && this.G.player) this.award(this.G.player, 'vehicle', 150);
    const label = v.isEmplacement ? (v.kind === 'pak' ? 'Pak' : 'Bunker') : 'Panzer';
    this.radio.say(this.role === 'kommandant' ? 'Richtschütze' : 'Kommandant', `${label} vernichtet!${v._psimKo === 'Besatzung' ? ' Besatzung ausgeschaltet.' : v._ammoRack ? ' Munition hochgegangen!' : ''}`, { key: 'kill' });
    const left = this.enemies.filter((x) => x.v.alive).length + this.empl.filter((x) => x.alive).length;
    if (left === 0) this._finish('win', 'Auftrag erfüllt');
    else if (left <= 2) setTimeout(() => this.radio && this.radio.say('Funk', `Noch ${left} Ziel${left === 1 ? '' : 'e'}.`), 2200);
  }

  _onCrit(e) {
    if (!e || !e.notes || !e.notes.length) return;
    if (e.vehicle === this.tank) this.radio.say('Kommandant', `Wir sind getroffen! ${e.notes.join(' – ')}`, { tone: 'warn' });
    else if (e.attacker && e.attacker.vehicle === this.tank) this.radio.say('Kommandant', `Durchschlag! ${e.notes.slice(0, 2).join(' – ')}`, { key: 'crit' });
  }

  _onHit(e) {
    if (!e || e.vehicle !== this.tank) return;
    try { this.crew && this.crew.onHit(e); } catch (err) { console.warn('[Panzer] Treffer', err); }
    const now = this.G.time.elapsed;
    if (now - (this._hitSaid || -9) < 2) return;
    this._hitSaid = now;
    const who = e.attacker && e.attacker.vehicle ? 'Panzer' : 'Feind';
    void who;
  }

  _onKillEv(e) {
    const v = e && e.victim;
    if (!v) return;
    if (v === this.G.player) { this._finish('loss', 'Gefallen'); return; }
    if (v._psim && v._psim.crew) this.radio.say('Kommandant', `${ROLE[SEAT_ROLE[v._psim.role]] || 'Besatzung'} ausgefallen!`, { tone: 'warn' });
  }

  /** Granate abgefeuert (hooks.js). */
  onShot(v, def, origin, dir, shell) {
    void origin; void dir; void def;
    if (v !== this.tank || !shell) return;
    shell._psimOwn = true;
    shell._psimTarget = this.crew && this.crew.gun.target ? this.crew.gun.target : this.crew && this.crew.cmd.target;
  }

  /** Granate am Ende (hooks.js): Beobachtung des Kommandanten (Treffer/Kurz/Weit/Abpraller). */
  onShellEnd(s, hit, info) {
    if (!s._psimOwn || !this.radio) return;
    const from = this.role === 'kommandant' ? 'Richtschütze' : 'Kommandant';
    if (info && info.vehicle) {
      if (info.ricochet) this.radio.say(from, 'Abpraller!');
      else if (info.killed) { /* Meldung über vehicle:destroyed */ }
      else if (info.res && !info.res.penetrated) this.radio.say(from, info.emplacement ? 'Treffer!' : 'Treffer – kein Durchschlag!');
      else if (info.res && info.res.penetrated) this.radio.say(from, 'Treffer – Durchschlag!');
      else this.radio.say(from, 'Treffer!');
      return;
    }
    const t = s._psimTarget;
    if (!t || !t.ent || !t.ent.alive || !hit || !hit.point) return;
    const tp = targetPoint(t, _a);
    const o = s.from || this.tank.position;
    const dT = tp.distanceTo(o), dH = hit.point.distanceTo(o);
    if (hit.point.distanceTo(tp) < 6) return; // naher Einschlag – Splitter
    const lat = _b.copy(tp).sub(o).normalize().cross(_c.set(0, 1, 0));
    const side = _d.copy(hit.point).sub(tp).dot(lat);
    this.radio.say(from, dH < dT - 15 ? 'Kurz!' : dH > dT + 15 ? 'Weit!' : side > 0 ? 'Rechts vorbei!' : 'Links vorbei!');
  }

  /* ------------------------------------------------------------ Simulation: Handgriffe */

  gearText() {
    const v = this.tank;
    if (!v) return 'N';
    if (eraOf(v.def) === 'modern') return { R: 'R (rückwärts)', N: 'N (neutral)', D: 'D (fahren)' }[this.state.selector];
    const g = v.body.drive ? v.body.drive.targetGear | 0 : 0;
    return g === 0 ? 'Leerlauf' : g > 0 ? `${g}. Gang` : `${-g}. Rückwärtsgang`;
  }

  loaderSel() { const g = this.tank && this.tank.gun; const k = g && kindOf(g.select); return k ? KINDS[k].label : '–'; }

  selectedAmmoLabel() {
    const v = this.tank, gs = v && gunSeat(v);
    const w = gs && gs.weapons[gs.weaponIndex];
    const id = w && w.def.kind === 'shell' ? w.def.id : gs && gs._shellWish;
    const k = kindOf(id);
    return k ? KINDS[k].label : '–';
  }

  loaderLabel(which) {
    const g = this.tank && this.tank.gun;
    if (!g) return '';
    const sel = KINDS[kindOf(g.select)] ? KINDS[kindOf(g.select)].label : '';
    if (which === 'gestell') {
      if (g.busy > 0) return 'beschäftigt …';
      if (g.step === 'leer' && this.tank.def.interior && this.tank.def.interior.blastDoor) return `Munitionsbunker – Tür öffnen (${sel})`;
      if (g.step === 'leer' || g.step === 'offen') return `Gestell – ${sel} greifen (Mausrad/1–4: Art)`;
      return 'Gestell';
    }
    if (g.step === 'gegriffen') return 'Verschluss – Granate einschieben';
    if (g.step === 'eingeschoben') return 'Verschluss – schließen';
    if (g.step === 'geladen') return this.state.safe ? 'Verschluss zu – Sicherung entsichern' : 'Kanone geladen – bereit';
    return 'Verschluss offen';
  }

  simAction(id, d = 1) {
    const G = this.G, st = this.state, v = this.tank, sys = G.vehicles, P = G.player;
    if (!v || !v.alive) return;
    switch (id) {
      case 'batterie':
        st.battery = d > 0 ? !st.battery : false;
        if (!st.battery && st.engine !== 'aus') { st.engine = 'aus'; this.hint('Motor aus'); }
        this._click();
        break;
      case 'anlasser':
        if (d < 0) { if (st.engine !== 'aus') { st.engine = 'aus'; this.hint('Motor abgestellt'); } break; }
        if (!st.battery) { this.hint('Kein Strom – erst den Hauptschalter einschalten'); break; }
        this.crankEngine(null);
        break;
      case 'licht': st.lights = d > 0 ? { kampf: 'arbeit', arbeit: 'aus', aus: 'kampf' }[st.lights] : { kampf: 'aus', aus: 'arbeit', arbeit: 'kampf' }[st.lights]; this._click(); break;
      case 'bremse': st.parkBrake = !st.parkBrake; this._click(); if (!st.parkBrake) this.hint('Feststellbremse gelöst'); break;
      case 'gang':
        if (eraOf(v.def) === 'modern') {
          const L = ['R', 'N', 'D'];
          const i = clamp(L.indexOf(st.selector) + (d > 0 ? 1 : -1), 0, 2);
          if (Math.abs(v.body.speed) > 1.5 && ((L[i] === 'R' && v.body.speed > 0) || (L[i] === 'D' && v.body.speed < 0))) { this.hint('Erst anhalten'); break; }
          st.selector = L[i];
        } else st.shiftQ += d > 0 ? 1 : -1;
        this._click();
        break;
      case 'waffe': st.armed = d > 0 ? !st.armed : false; this._click(); this.hint(st.armed ? 'Waffe scharf' : 'Waffe gesichert'); break;
      case 'antrieb': st.hydraulics = !st.hydraulics; this._click(); this.hint(st.hydraulics ? 'Turmantrieb elektrisch' : 'Notbetrieb – Handräder'); break;
      case 'rechner': {
        const gs = gunSeat(v);
        const shells = gs.weapons.map((w, i) => (w.def.kind === 'shell' ? i : -1)).filter((i) => i >= 0);
        const cur = Math.max(0, shells.indexOf(gs.weaponIndex));
        gs.intent.weapon = shells[(cur + (d > 0 ? 1 : shells.length - 1)) % shells.length];
        this._click();
        break;
      }
      case 'laser': {
        const gs = gunSeat(v);
        v.muzzle(gs.index, _a, _b, true);
        sys._ignore = v;
        const h = G.world.raycast(_a, _b, 4000);
        sys._ignore = null;
        sys._range = { text: h ? `E ${Math.round(h.distance)} m` : 'E ––– m', until: G.time.elapsed + 4 };
        v._laserRange = h ? h.distance : NaN;
        this.hint(h ? `Laser: ${Math.round(h.distance)} m` : 'Laser: kein Echo');
        break;
      }
      case 'wahl': {
        const ids = v._psimAmmo || [];
        const i = ids.indexOf(v.gun.select);
        const id = ids[(i + (d > 0 ? 1 : ids.length - 1) + ids.length) % ids.length];
        if (id) this._load(P, 'munition', id);
        this._click();
        break;
      }
      case 'gestell': this._load(P, 'greifen'); break;
      case 'verschluss': { const g = v.gun; this._load(P, g.step === 'eingeschoben' ? 'schliessen' : 'einschieben'); break; }
      case 'sicherung': if (v.gun.step === 'geladen' && st.safe) { st.safe = false; this.radio.say('Ladeschütze', `${KINDS[kindOf(v.gun.loaded)].call} geladen!`, { quiet: true }); this._click(); } else this.hint(st.safe ? 'Erst laden' : 'Bereits entsichert'); break;
      case 'luke': {
        const seat = v.seats[this.playerSeat];
        const list = viewsOf(seat.def);
        const cur = viewOf(seat);
        const idx = cur.hatch ? list.findIndex((x) => x.overlay === 'peri' || (x.interior && !x.hatch)) : list.findIndex((x) => x.hatch);
        if (idx >= 0) sys.setSeatView(P, idx);
        break;
      }
      case 'funkgeraet': st.funkOn = d > 0 ? !st.funkOn : false; this._click(); this.hint(st.funkOn ? (st.kanal === 5 ? 'Funkgerät ein – Kompaniefunk' : `Funkgerät ein – Kanal ${st.kanal}: nur Rauschen`) : 'Funkgerät aus – keine Meldungen der Kompanie'); break;
      case 'kanal': st.kanal = ((st.kanal - 1 + (d > 0 ? 1 : 7)) % 8) + 1; v._psimKanal = st.kanal; this._click(); if (st.funkOn) this.hint(st.kanal === 5 ? 'Kanal 5 – Kompanie' : st.kanal === 3 ? 'Kanal 3 – Zug (still)' : `Kanal ${st.kanal} – Rauschen`); break;
      case 'gurt': this._beltStep(); break;
      case 'funk': {
        if (!st.funkOn) { this.hint('Funkgerät ist aus'); break; }
        if (st.kanal !== 5) { this.hint('Falscher Kanal – die Kompanie hört auf Kanal 5'); break; }
        const left = this.enemies.filter((x) => x.v.alive).length + this.empl.filter((x) => x.alive).length;
        this.radio.say('Kommandant', `${v.def.name} an Kompanie: Kämpfe – ${left} Ziel${left === 1 ? '' : 'e'} erkannt.`, { quiet: true });
        setTimeout(() => this.radio && this.radio.say('Funk', left ? 'Verstanden. Weiter vorgehen.' : 'Verstanden. Sammeln.'), 1400);
        break;
      }
      default: break;
    }
  }

  _load(P, action, ammo = null) {
    const sys = this.G.vehicles, v = this.tank;
    const r = sys.requestLoad(P, v, action, ammo);
    if (r && r.ok === false && r.why) this.hint({ schritt: 'Falscher Schritt', blick: 'Erst hinsehen (Gestell/Verschluss)', leer: 'Keine Granate dieser Sorte', busy: 'Noch beschäftigt', sitz: 'Nur als Ladeschütze' }[r.why] || r.why);
  }

  crankEngine(who) {
    const st = this.state;
    if (st.engine !== 'aus' || st.cranking) return;
    if (modsOf(this.tank).motor <= 0) { this.hint('Motor springt nicht an – zerstört'); return; }
    st.engine = 'start'; st.cranking = true; st.crankT = 2.0 + Math.random() * 0.8; st.battery = true;
    this._starterSound();
    if (who) this.radio.say(who, 'Motor wird angelassen!', { quiet: true });
  }

  _starterSound() {
    const A = this.G.vehicles && this.G.vehicles.audio;
    const ctx = A && A._ctx, dest = A && A._dest && A._dest();
    if (!ctx || !dest) return;
    try {
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 38;
      lfo.frequency.value = 7; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.15); g.gain.setValueAtTime(0.22, t + 1.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(f); f.connect(g); g.connect(dest);
      o.start(t); lfo.start(t); o.stop(t + 2.5); lfo.stop(t + 2.5);
    } catch { /* */ }
  }

  _click() { try { this.G.vehicles.audio.loadSound('munition', 0.6); } catch { /* */ } }

  gunBlocked() {
    const v = this.tank;
    if (!v) return true;
    const m = modsOf(v);
    return !this.state.armed || this.state.safe || m.rohr <= 0;
  }

  setMarker(p) { this.marker = p ? p.clone() : null; }

  nextObjective() {
    const T = this.tank;
    if (!T) return null;
    let best = null, bd = Infinity;
    for (const e of [...this.enemies.map((x) => x.v), ...this.empl]) {
      if (!e.alive) continue;
      const d = e.position.distanceTo(T.position);
      if (d < bd) { bd = d; best = e.position; }
    }
    return best;
  }

  /* ------------------------------------------------------------ Eingaben (vor dem Spieler-Takt) */

  preUpdate(dt) {
    super.preUpdate(dt);
    const G = this.G, I = G.input, P = G.player, v = this.tank;
    // Platzwechsel mit Blende: nach dem Abblenden tauschen, dann aufblenden
    if (this._pendRole && G.time.elapsed >= this._pendRole.at) {
      const pr = this._pendRole; this._pendRole = null;
      const ok = v && v.alive && this.switchRole(pr.role);
      const now = G.time.elapsed;
      if (G.vehicles) G.vehicles._switch = ok ? { at: now - 0.25, until: now + 0.4, label: pr.label } : null;
    }
    if (!I || !v || !P || P.vehicle !== v || G.match.state !== 'playing') { this._closeWheel(); this._closeSeatWheel(); return; }
    const sys = G.vehicles, seat = v.seats[this.playerSeat];
    const crew = this.crew;
    const take = (a) => { const p = I.pressed(a); if (p) I.consume(a); return p; };
    const cv = sys.camera && sys.camera.view;
    const inside = !!(cv && cv.interior);
    if (this._peekFrom != null && viewOf(seat).interior) { this._peekFrom = null; this._peekSave = null; }
    // Sitzrad (halten) bzw. ◀/▶ / Touch „Sitz“: Platz wechseln (Pad: ◀/▶ teilen sich die Tasten mit Serie 2/3)
    if (take('sitzrad')) this._openSeatWheel();
    if (this._seatW) { this._updSeatWheel(I); return; }
    if (I.pressed('seat_next') || I.pressed('seat_prev') || I.pressed('v_seat')) {
      const step = I.pressed('seat_prev') ? -1 : 1;
      for (const a of ['seat_next', 'seat_prev', 'v_seat', 'streak2', 'streak3']) I.consume(a);
      this.cycleRole(step);
    }
    // Sitzwechsel-Tasten gehören hier der Munition
    const ammoKey = AMMO_KEYS.findIndex((a) => I.pressed(a));
    for (const a of AMMO_KEYS) I.consume(a);
    // Befehlsrad (Kommandant; Arcade: alle)
    if (I.pressed('befehl')) { I.consume('befehl'); if (this.role === 'kommandant' || this.arcade) this._openWheel(); }
    if (this._wheel) { this._updWheel(I); return; }
    // Hotspot im Blick (Simulation, Innensicht): LMT/F bedienen, RMT zurück, Mausrad = Wahlhebel/Rechner
    const hot = this.sim && this.simc ? this.simc.hot : null;
    this._hotUsed = false;
    if (hot) {
      if (I.pressed('fire') || I.pressed('interact')) { I.consume('fire'); I.consume('interact'); hot.use(1); this._hotUsed = true; }
      else if (I.pressed('ads')) { I.consume('ads'); hot.use(-1); this._hotUsed = true; }
      else if ((hot.id === 'gang' || hot.id === 'rechner') && I.pressed('swap')) { I.consume('swap'); hot.use(1); this._hotUsed = true; }
    } else if (I.pressed('interact')) I.consume('interact'); // kein Aussteigen
    // Durchsehen: RMT in der Innensicht → Sichtgerät; im Gerät RMT (ohne Zoomstufen) bzw. C → zurück in den Innenraum
    if (!this._hotUsed) {
      const cur = viewOf(seat);
      if (inside && I.pressed('ads')) { I.consume('ads'); this._peekNearest(); }
      else if (this._peekFrom != null && !cur.interior) {
        if (I.pressed('crouch')) { I.consume('crouch'); this._unpeek(); }
        else if ((cur.zoom || [1]).length <= 1 && I.pressed('ads')) { I.consume('ads'); this._unpeek(); }
      }
    }
    if (this.sim && take('inspect')) { this._helpOn = !this._helpOn; if (this.guide === 'aus') this.guide = 'hilfe'; }
    // Sichtgeräte: N = Polarität / Restlicht (moderne Panzer)
    if (take('verband')) { const t = this.optics.cycle(v, viewOf(seat)); sys._viewLabel = { text: t, until: G.time.elapsed + 1.6 }; }
    const role = this.role;
    if (role === 'kommandant' && !this.arcade) {
      const D = crew.drive;
      if (take('move_forward')) crew.order('vor');
      if (take('move_back')) crew.order(D.cmd === 'halt' && Math.abs(v.body.speed) < 0.6 ? 'zurueck' : 'halt');
      for (const [a, c] of [['move_left', 'links'], ['move_right', 'rechts']]) {
        if (I.pressed(a)) { I.consume(a); crew.order(c, { hold: true }); this._turnKey = a; }
        else if (this._turnKey === a && !I.down(a)) { this._turnKey = null; crew.order('gerade', null, { quiet: D.cmd === 'halt' }); }
      }
      if (take('tactical')) crew.order('rumpf', v.body.yaw() + v.mount.turretYaw);
      if (!inside && take('prone')) crew.order('deckung'); // in der Innensicht: Z = vorbeugen (sim.js)
      if (take('gadget')) this._markAndGo();
      if (take('squad_order')) this._designate();
      if (take('jump')) crew.fire();
      if (take('melee')) crew.toggleFireFree();
      if (ammoKey >= 0) { const id = v._psimAmmo[ammoKey]; if (id) crew.orderAmmo(kindOf(id)); }
    } else if (role === 'richtschuetze' || this.arcade) {
      if (ammoKey >= 0) {
        const id = v._psimAmmo[ammoKey];
        if (id) { const wi = gunSeat(v).weapons.findIndex((w) => w.def.id === id); if (wi >= 0) seat.intent.weapon = wi; crew.ammoOrder = id; this.radio.say(ROLE[role], `${KINDS[kindOf(id)].call}!`, { quiet: true }); }
      }
      if (this.arcade && take('squad_order')) this._designate();
      for (const a of ['gadget', 'tactical', 'melee', 'squad_order']) I.consume(a);
    } else if (role === 'ladeschuetze') {
      if (ammoKey >= 0) { const id = v._psimAmmo[ammoKey]; if (id) this._load(P, 'munition', id); }
      // R bei geladener, gesicherter Kanone = entsichern
      if (this.sim && v.gun && v.gun.step === 'geladen' && this.state.safe && I.pressed('reload')) { I.consume('reload'); this.simAction('sicherung', 1); }
      for (const a of ['gadget', 'tactical', 'melee', 'squad_order', 'jump']) I.consume(a);
    } else if (role === 'mgschuetze') {
      if (this.sim && take('reload')) this.simAction('gurt', 1);
      for (const a of ['gadget', 'tactical', 'melee', 'squad_order', 'jump']) I.consume(a);
    } else if (role === 'fahrer') {
      if (this.sim) {
        if (I.pressed('swap')) { I.consume('swap'); this.simAction('gang', 1); }
        if (take('gadget')) this.simAction('bremse', 1);
        if (take('tactical')) this.simAction(this.state.engine === 'aus' ? 'anlasser' : 'anlasser', this.state.engine === 'aus' ? 1 : -1);
      }
      for (const a of ['melee', 'squad_order']) I.consume(a);
    }
  }

  _markAndGo() {
    const G = this.G, v = this.tank, seat = v.seats[this.playerSeat];
    const dir = viewLookDir(v, seat, viewOf(seat), _d);
    G.vehicles._ignore = v;
    const h = G.world.raycast(G.camera.position, dir, 1500);
    G.vehicles._ignore = null;
    if (!h || !h.point) { this.hint('Kein Punkt markiert – auf den Boden zielen'); return; }
    this.setMarker(h.point);
    this.crew.order('markierung', h.point);
  }

  _designate() {
    const G = this.G, v = this.tank, seat = v.seats[this.playerSeat];
    const dir = viewLookDir(v, seat, viewOf(seat), _d).clone();
    const t = this.crew.designate(dir);
    if (t) this._designated = { t, until: G.time.elapsed + 6 };
  }

  _openWheel() {
    const I = this.G.input;
    if (!I || typeof I.openWheel !== 'function') return;
    I.openWheel();
    this._wheel = { sel: -1, t: this.G.time.elapsed };
  }

  _closeWheel() {
    if (!this._wheel) return;
    this._wheel = null;
    const I = this.G.input;
    if (I && I.wheel && I.wheel.open) I.closeWheel();
    this.hud && this.hud.setWheel(false);
  }

  _updWheel(I) {
    const W = I.wheel || { x: 0, y: 0 };
    const n = this.hud.wheelItems.length;
    const m = Math.hypot(W.x || 0, W.y || 0);
    let sel = -1;
    if (m > 0.34) { let a = Math.atan2(W.x, -W.y); if (a < 0) a += Math.PI * 2; sel = Math.round(a / (Math.PI * 2 / n)) % n; }
    this._wheel.sel = sel;
    this.hud.setWheel(true, sel);
    const done = !I.down('befehl') || I.pressed('fire');
    if (!done) return;
    if (I.pressed('fire')) I.consume('fire');
    this._closeWheel();
    if (sel < 0) return;
    const id = this.hud.wheelItems[sel].id, c = this.crew, v = this.tank;
    if (id === 'feuer') c.fire();
    else if (id === 'feuerfrei') c.toggleFireFree();
    else if (id === 'uebergabe') this._designate();
    else if (id === 'markierung') this._markAndGo();
    else if (id === 'ammo') { const ids = v._psimAmmo; const cur = ids.indexOf(c.ammoOrder || v.gun.select); c.orderAmmo(kindOf(ids[(cur + 1) % ids.length])); }
    else if (id === 'rumpf') c.order('rumpf', v.body.yaw() + v.mount.turretYaw);
    else c.order(id);
  }

  _openSeatWheel() {
    const I = this.G.input;
    if (!I || typeof I.openWheel !== 'function' || this._pendRole) return;
    this._closeWheel();
    I.openWheel();
    this._seatW = { sel: -1, items: this.rolesOf() };
  }

  _closeSeatWheel() {
    if (!this._seatW) return;
    this._seatW = null;
    const I = this.G.input;
    if (I && I.wheel && I.wheel.open) I.closeWheel();
    this.hud && this.hud.setSeatWheel(false);
  }

  _updSeatWheel(I) {
    const W = I.wheel || { x: 0, y: 0 }, items = this._seatW.items, n = items.length;
    const m = Math.hypot(W.x || 0, W.y || 0);
    let sel = -1;
    if (m > 0.34 && n) { let a = Math.atan2(W.x, -W.y); if (a < 0) a += Math.PI * 2; sel = Math.round(a / (Math.PI * 2 / n)) % n; }
    this._seatW.sel = sel;
    this.hud.setSeatWheel(true, items, sel);
    const done = !I.down('sitzrad') || I.pressed('fire');
    if (!done) return;
    if (I.pressed('fire')) I.consume('fire');
    this._closeSeatWheel();
    if (sel >= 0 && !items[sel].cur) this.requestRole(items[sel].role);
  }

  /* ------------------------------------------------------------ Vorlauf (nach den Spielereingaben, vor dem Fahrzeugtakt) */

  preVehicles(dt) {
    const G = this.G, v = this.tank;
    if (!v || !v.alive || !this.started) return;
    const st = this.state, mods = modsOf(v), now = G.time.elapsed, I = G.input;
    this._beltTick(dt);
    // Anlasser
    if (st.engine === 'start') { st.crankT -= dt; if (st.crankT <= 0) { st.engine = 'an'; st.cranking = false; this.radio.say(this.role === 'fahrer' ? 'Hinweis' : 'Fahrer', 'Motor läuft!', { quiet: true, tone: this.role === 'fahrer' ? 'warn' : null }); } }
    if (mods.motor <= 0 && st.engine !== 'aus') { st.engine = 'aus'; st.cranking = false; }
    // Module → Fahrzeugwerte
    const base = v._psimBase || v.def;
    const turm = (this.sim && !st.hydraulics) || mods.turm <= 0 ? 0.15 : mods.turm < 1 ? 0.5 : 1;
    if (v.def !== base) { v.def.traverse = Math.min(base.traverse, turm < 1 ? Math.max(base.traverse * turm, 0.105) : base.traverse); v.def.elevate = base.elevate * (turm < 0.2 ? 0.25 : 1); }
    if (mods.ketten <= 0) v.trackDownUntil = now + 0.5;
    if (v.zones.engine && mods.motor < 1 && v.zones.engine.hp > 0 && mods.motor <= 0.5) v.zones.engine.hp = 0;
    // Fahrersitz
    const ds = v.seats.find((s) => s.def.drive);
    const P = G.player;
    if (ds) {
      const it = ds.intent;
      const human = ds.actor === P;
      if (this.arcade && this.crew && ds.actor && !human) {
        // Arcade: der Spieler fährt über den Bot-Fahrer
        const live = G.match.state === 'playing';
        it.gearbox = 'auto'; it.path = it.moveTo = null;
        it.throttle = live ? clamp(I.move.y || 0, -1, 1) : 0;
        it.steer = live ? clamp(I.move.x || 0, -1, 1) : 0;
        it.brake = live && I.down('jump') ? 1 : 0;
        it.handbrake = false;
      } else if (human && this.sim) {
        const modern = eraOf(v.def) === 'modern';
        if (st.engine !== 'an') { it.throttle = 0; it.brake = 1; it.shiftUp = it.shiftDown = 0; }
        else if (modern) {
          it.gearbox = 'auto';
          const pedal = clamp(I.move.y || 0, 0, 1);
          const br = (I.move.y || 0) < -0.2 || I.down('jump');
          it.throttle = st.selector === 'D' ? pedal : st.selector === 'R' ? -pedal : 0;
          it.brake = br ? 1 : 0;
          it.shiftUp = it.shiftDown = 0;
        } else {
          it.gearbox = 'hold';
          it.shiftUp = st.shiftQ > 0 ? st.shiftQ : 0; it.shiftDown = st.shiftQ < 0 ? -st.shiftQ : 0; st.shiftQ = 0;
          it.throttle = (I.move.y || 0) > 0.3 ? 1 : 0;
          it.brake = (I.move.y || 0) < -0.3 || I.down('jump') ? 1 : 0;
        }
        if (st.parkBrake) { it.brake = 1; it.handbrake = true; }
      } else if (this.sim && st.engine !== 'an') { it.throttle = 0; it.brake = 1; }
    }
    // Waffe: Sperren (nicht scharf, gesichert, Rohr zerstört) und Hotspot-Klick
    const gs = gunSeat(v);
    if (gs) {
      const it = gs.intent;
      const w = gs.weapons[gs.weaponIndex];
      if (w && w.def.kind === 'shell' && it.firePressed && v.gun && v.gun.step !== 'geladen' && gs.actor === P && now - this._msgT > 1.2) {
        this._msgT = now; this._warnLamp = now + 1.5;
        this.hint(v.gun.step === 'eingeschoben' ? 'Abzug: nichts – Verschluss offen (Warnleuchte)' : 'Abzug: nichts – Kanone nicht geladen (Warnleuchte)');
      }
      if (w && w.def.kind === 'shell' && this.gunBlocked() && (it.firePressed)) {
        it.firePressed = false; it.fire = false;
        if (gs.actor === P && now - this._msgT > 1.2) { this._msgT = now; this.hint(mods.rohr <= 0 ? 'Rohr zerstört – Kanone fällt aus' : !st.armed ? 'Waffe nicht scharf – Hauptschalter Waffe' : 'Kanone gesichert – Ladeschütze muss entsichern'); }
      }
      if (this._hotUsed && gs.actor === P) { it.fire = false; it.firePressed = false; }
    }
    // Brand: Löschanlage, sonst ausbooten
    if (mods.brand > 0) {
      st.burnT += dt;
      if (st.burnT > 3 && st.extCharges > 0 && !st._extTried) {
        st._extTried = true; st.extCharges--;
        if (Math.random() < (v._psimAmmoFire ? 0.35 : 0.72)) { mods.brand = 0; v._psimAmmoFire = false; st.burnT = 0; st._extTried = false; this.radio.say('Fahrer', 'Feuerlöschanlage ausgelöst – Brand gelöscht!', { tone: 'warn' }); }
        else this.radio.say('Fahrer', 'Löschanlage versagt – es brennt weiter!', { tone: 'warn' });
      }
      if (st.burnT > 3 && st._extTried && st.extCharges > 0 && st.burnT > 9) { st._extTried = false; }
      if (st.burnT > (v._psimAmmoFire ? 12 : 22)) { this.radio.say('Kommandant', 'Ausbooten! Ausbooten!', { tone: 'warn' }); v._psimKo = v._psimAmmoFire ? 'Munition' : 'Brand'; v.destroy(v.lastAttacker, v.lastWeaponId); }
      else if (v._psimAmmoFire && st.burnT > 5 && !st._bootSaid) { st._bootSaid = true; this.radio.say('Kommandant', 'Munitionsbrand – fertigmachen zum Ausbooten!', { tone: 'warn' }); }
      if (G.effects && (this._fireFx = (this._fireFx || 0) - dt) <= 0) { this._fireFx = 0.25; G.effects.smoke?.(_a.copy(v.body.pos).setY(v.body.pos.y + 1.6), { count: 1, color: 0x221d18, size: 1.4, life: 2.6, rise: 2, alpha: 0.5 }); }
    } else { st.burnT = 0; st._bootSaid = false; }
    // Kette: Besatzung repariert im Stand (~25 s)
    if (mods.ketten <= 0) {
      if (Math.abs(v.body.speed) < 0.3) st.trackRepairT += dt; else st.trackRepairT = 0;
      if (st.trackRepairT > 25) { mods.ketten = 0.5; st.trackRepairT = 0; v.zones.tracks && (v.zones.tracks.hp = v.zones.tracks.max * 0.4); this.radio.say('Fahrer', 'Kette notdürftig geflickt – fahrbereit!'); }
      else if (st.trackRepairT > 0 && !st._trackSaid) { st._trackSaid = true; this.radio.say('Fahrer', 'Kette gerissen – wir flicken!', { tone: 'warn' }); }
    } else st._trackSaid = false;
    // Feindpanzer: Module
    for (const e of this.enemies) {
      if (e.v.alive && !(e.bot && e.bot.alive && e.bot.vehicle === e.v) && e.v._psimCrew) { e.v._psimKo = 'Besatzung'; e.v.destroy(e.v.lastAttacker, e.v.lastWeaponId); continue; } // Bot an Bord gefallen → Panzer steht/schweigt
      const m = e.v._psimMods;
      if (!m || !e.v.alive) continue;
      const b = e.v._psimBase || e.v.def;
      if (e.v.def !== b) e.v.def.traverse = b.traverse * (m.turm <= 0 ? 0.15 : m.turm < 1 ? 0.5 : 1);
      if (m.ketten <= 0) e.v.trackDownUntil = now + 0.5;
      if (m.brand > 0) { e.v._burnT = (e.v._burnT || 0) + dt; if (e.v._burnT > 14) e.v.destroy(e.v.lastAttacker, e.v.lastWeaponId); }
    }
  }

  /* ------------------------------------------------------------ Takt (nach dem Fahrzeugtakt) */

  postVehicles(dt) {
    const G = this.G, v = this.tank, P = G.player;
    if (!v) return;
    const seat = v.seats[this.playerSeat];
    const mine = P && P.vehicle === v && seat && seat.actor === P;
    const cv = G.vehicles.camera && G.vehicles.camera.view;
    const inside = !!(mine && cv && cv.interior && v.alive);
    // Innenlicht (Schalter, Batterie)
    const cab = v.model && v.model.cabin;
    if (cab && cab.lamps) {
      const st = this.state;
      const f = !st.battery ? 0.03 : st.lights === 'aus' ? 0.05 : st.lights === 'arbeit' ? 1.8 : 1;
      for (const L of cab.lamps) {
        if (!L._base) L._base = L.col.clone();
        const day = L._base.b > L._base.r && L._base.g < 0.3; // Tageslicht durch die Spiegel bleibt
        if (st.lights === 'arbeit' && st.battery && !day) L.col.setRGB(1, 0.92, 0.78).multiplyScalar(Math.max(0.35, (L._base.r + L._base.g + L._base.b) / 3) * f);
        else L.col.copy(L._base).multiplyScalar(day ? 1 : f);
      }
    }
    const hot = this.sim && mine ? this.simc.frame(dt, v, inside) : null;
    const label = mine ? this.optics.update(dt, v, cv, inside) : '';
    this.radio.update();
    // HUD
    const proj = (p) => projectToScreen(G, p, { x: 0, y: 0, on: false });
    const S = { visible: !!mine && G.match.state !== 'ended', vehicle: v };
    if (mine) {
      S.crew = this._crewRows();
      const keyOf = this.role === 'fahrer' ? null : (i) => G.input.label(AMMO_KEYS[i]) || String(i + 1);
      S.ammo = v.gun ? ammoRows(v, keyOf, this.crew ? this.crew.ammoOrder || v.gun.select : null) : null; // Transporter ohne Kanone (tank=mtw …)
      S.loadText = this._loadText();
      S.hot = hot ? this.simc.screen(v, proj) : null;
      S.hotLabel = hot ? `${hot.label()} <kbd>${G.input.label('fire') || 'LMT'}</kbd>` : '';
      S.dot = inside && this.sim;
      S.crack = cv && cv.overlay === 'optic' && !cv.aux && modsOf(v).optik <= 0;
      S.vision = label;
      if (this.marker) S.mark = proj(this.marker);
      const ds = this._designated;
      const tt = ds && G.time.elapsed < ds.until ? ds.t : this.crew && this.role !== 'kommandant' && this.crew.cmd.target ? this.crew.cmd.target : null;
      if (tt && tt.ent && tt.ent.alive && !(cv && cv.interior)) { S.target = proj(targetPoint(tt, _a)); S.targetLabel = `${TARGET_LABEL[tt.kind]} ${roundRange(tt.pos.distanceTo(v.position))} m`; }
      S.order = this._orderText();
      const steps = this.sim && this.guide !== 'aus' ? this._steps() : null;
      // Führung: Tutorial = Liste + nächster Schritt am Bedienelement markiert + Erklärung; Hilfe = nur auf Anfrage (I)
      if (steps && (this.guide === 'tutorial' || this._helpOn)) {
        S.steps = steps;
        const next = steps.find((x) => !x.done);
        S.stepWhy = this.guide === 'tutorial' && next ? next.why : null;
        if (next && next.hot && !hot && inside) {
          const h = this.simc.list.find((x) => x.id === next.hot);
          if (h) { S.next = proj(this.simc.world(v, h, _c)); S.nextLabel = `Nächster Schritt: ${next.html}`; }
        }
      } else if (steps && this.guide === 'hilfe') S.stepHint = `<kbd>${G.input.label('inspect') || 'I'}</kbd> Hilfe zu den Handgriffen`;
      S.help = S.steps ? null : this._helpText();
    }
    if (this._banner) S.banner = this._banner;
    if (this.hudReserve) S.reserveTop = this.hudReserve();
    this.hud.update(dt, S);
    // Namensschilder der eigenen Besatzung (sitzt im Panzer) nicht über die Optik legen
    const plates = G.bots && G.bots._plates;
    if (plates) for (const st of v.seats) { const a = st.actor; const pl = a && !a.isPlayer ? plates.get(a) : null; if (pl && pl.sprite) pl.sprite.visible = false; }
  }

  _crewRows() {
    const v = this.tank, rows = [];
    const P = this.G.player;
    const map = { driver: 'Fahrer', gunner: 'Richtschütze', loader: 'Ladeschütze', commander: 'Kommandant', funker: 'Funker / MG', mg: 'MG-Schütze', mechaniker: 'Mechaniker' };
    for (const s of v.seats) {
      const a = s.actor;
      const me = a === P;
      let state = a ? (a.alive ? (a.health < (a.maxHealth || 100) * 0.6 ? 'verwundet' : 'bereit') : 'ausgefallen') : 'ausgefallen';
      let cls = !a || !a.alive ? 'ps-dead' : state === 'verwundet' ? 'ps-hurt' : 'ps-ok';
      if (a && a.alive && !me) {
        if (s.def.loader && v.gun && v.gun.auto) state = `lädt ${(v.gun.autoT || 0).toFixed(1).replace('.', ',')} s`;
        if (s.def.drive && this.crew) state = { vor: 'fährt', halt: 'hält', zurueck: 'zurück', markierung: 'fährt an', deckung: 'Deckung', rumpf: 'dreht' }[this.crew.drive.cmd] || state;
        if (s.def.mount === 'gun' && this.crew && this.crew.gun.target) state = 'richtet';
        if ((s.def.id === 'funker' || s.def.id === 'mg') && s.intent && s.intent.fire) state = 'schießt';
      }
      if (me) state = 'du';
      rows.push({ role: map[s.def.id] || s.def.label, state: tx(state, 'pz'), cls, me }); // Anzeige in der gewählten Sprache (Kontext: „hält“ = steht)
    }
    return rows;
  }

  _loadText() {
    const g = this.tank.gun;
    if (!g) return '';
    if (g.step === 'geladen') return `Im Rohr: ${KINDS[kindOf(g.loaded)] ? KINDS[kindOf(g.loaded)].label : '–'}${this.state.safe ? ' (gesichert)' : ''}`;
    if (g.auto) return `Lade ${KINDS[kindOf(g.select)] ? KINDS[kindOf(g.select)].label : ''} …`;
    return 'Kanone leer';
  }

  _orderText() {
    const o = this.driverOrder, now = this.G.time.elapsed;
    if (this.role !== 'fahrer' || !o || now - o.at > 6) return null;
    const t = { vor: '▲ Marsch', halt: '■ Halt', links: '◀ Links', rechts: 'Rechts ▶', zurueck: '▼ Zurück', markierung: '◆ Markierung anfahren', deckung: '▼ Deckung – zurück', rumpf: '⟲ Front zum Ziel' }[o.cmd];
    return t ? `${t}<small>Befehl des Kommandanten</small>` : null;
  }

  /**
   * Handgriffe je Station als Zustandsmaschine: jeder Eintrag beschreibt einen Zustand (done = aus dem Fahrzeugzustand
   * abgelesen, nicht abgehakt) – die Reihenfolge ist nur die Empfehlung der Führung. Ohne Führung darf man in jeder physikalisch
   * möglichen Reihenfolge arbeiten; unmögliche Griffe lehnt crew.js/simAction ab (z. B. einschieben ohne Granate in der Hand).
   * hot = Bedienelement (sim.js), why = Erklärung (Tutorial).
   */
  _steps() {
    const st = this.state, v = this.tank, g = v.gun;
    const k = (a, fb) => `<kbd>${this.G.input.label(a) || fb}</kbd>`;
    switch (this.role) {
      case 'fahrer': {
        const modern = eraOf(v.def) === 'modern';
        return [
          { html: 'Hauptschalter EIN', hot: 'batterie', done: st.battery, why: 'Schaltet das Bordnetz zu – ohne Strom kein Anlasser, keine Instrumente, kein Innenlicht.' },
          { html: `Anlasser drücken ${k('tactical', 'X')}`, hot: 'anlasser', done: st.engine === 'an', why: 'Der Anlasser orgelt den Diesel etwa zwei Sekunden, dann läuft der Motor im Leerlauf.' },
          { html: `Feststellbremse lösen ${k('gadget', 'B')}`, hot: 'bremse', done: !st.parkBrake, why: 'Mit angezogener Feststellbremse blockieren beide Ketten.' },
          { html: `${modern ? 'Wahlhebel auf D' : 'Gang einlegen'} ${k('swap', 'Mausrad')}`, hot: 'gang', done: modern ? st.selector === 'D' || st.selector === 'R' : !!(v.body.drive && v.body.drive.targetGear), why: modern ? 'Automatikgetriebe: R rückwärts, N neutral, D fahren. Nur im Stand die Richtung wechseln.' : 'Schaltgetriebe: Gang für Gang hoch; beim Anfahren den 1. Gang.' },
          { html: `Fahren ${k('move_forward', 'W')} · Bremse ${k('move_back', 'S')}`, hot: 'hebel', done: Math.abs(v.body.speed) > 2, why: 'W = Fahrpedal, A/D ziehen den Lenkhebel (bremst die Kette dieser Seite), S/Leertaste bremsen.' },
        ];
      }
      case 'richtschuetze':
        return [
          { html: 'Hauptschalter Waffe: SCHARF', hot: 'waffe', done: st.armed, why: 'Erst mit scharf geschalteter Waffe gibt der Abzug die Kanone frei.' },
          { html: 'Munition am Rechner wählen', hot: 'rechner', done: !!(this.crew && this.crew.ammoOrder), why: 'Der Rechner muss die geladene Munition kennen, sonst stimmen Haltepunkt und Entfernungsmarken nicht. Verschossen wird immer die tatsächlich geladene Granate.' },
          ...(eraOf(v.def) === 'modern' ? [{ html: `Entfernung lasern ${k('light', 'T')}`, hot: 'laser', done: Number.isFinite(v._laserRange), why: 'Der Laser misst die Zielentfernung; Strichplatte und Rechner setzen den Haltepunkt.' }] : []),
          { html: `Hauptzieloptik ${k('crouch', 'C')}`, done: viewOf(v.seats[this.playerSeat]).overlay === 'optic', why: 'In der Optik richten, ab Freigabe „Feuer!“ des Kommandanten abziehen.' },
          { html: `Feuer ${k('fire', 'LMT')}`, done: false, why: 'Feuer nur mit geladener, entsicherter Kanone – sonst bleibt der Abzug wirkungslos (Warnung).' },
        ];
      case 'ladeschuetze': {
        const s = g ? g.step : 'leer';
        const bunker = !!(v.def.interior && v.def.interior.blastDoor);
        const wish = this.crew && this.crew.ammoOrder;
        return [
          { html: `Munition wählen ${k('swap', 'Mausrad')}`, hot: 'wahl', done: s !== 'leer' && s !== 'offen' ? true : !wish || g.select === wish, why: 'Die Sorte ruft der Kommandant aus (Untertitel). Wähle sie, bevor du greifst – eine falsche Granate im Rohr muss erst verschossen werden.' },
          ...(bunker ? [{ html: `Bunkertür öffnen ${k('reload', 'R')}`, hot: 'gestell', done: s !== 'leer' || g.busyKind === 'tuer', why: 'Der Munitionsbunker im Turmheck ist durch eine Schiebetür vom Kampfraum getrennt (Sprengklappen nach außen).' }] : []),
          { html: `Granate greifen ${k('reload', 'R')}`, hot: 'gestell', done: s === 'gegriffen' || s === 'eingeschoben' || s === 'geladen', why: 'Zum Gestell drehen und die Granate herausziehen – bei starken Stößen fällt sie aus der Hand.' },
          { html: `Ansetzen/einschieben ${k('fire', 'LMT')}`, hot: 'verschluss', done: s === 'eingeschoben' || s === 'geladen', why: 'Zum Verschluss drehen und die Granate ins Rohr schieben.' },
          { html: `Verschluss schließen ${k('reload', 'R')}`, hot: 'verschluss', done: s === 'geladen', why: 'Der Keil schließt – erst jetzt ist die Kanone feuerbereit.' },
          { html: `Entsichern ${k('reload', 'R')}`, hot: 'sicherung', done: s === 'geladen' && !st.safe, why: 'Sicherung lösen und „Geladen!“ melden – der Richtschütze darf feuern.' },
        ];
      }
      case 'mgschuetze': {
        const seat = v.seats[this.playerSeat], w = this._mgWeapon();
        if (!w) return null;
        const funk = !!(this.simc && this.simc.list.some((h) => h.id === 'funkgeraet'));
        return [
          ...(funk ? [{ html: 'Funkgerät EIN', hot: 'funkgeraet', done: st.funkOn, why: 'Ohne Funkgerät hört die Besatzung die Kompanie nicht.' },
            { html: 'Kanal 5 (Kompanie)', hot: 'kanal', done: st.kanal === 5, why: 'Laut Schild am Gerät: Kanal 3 = Zug, Kanal 5 = Kompanie.' }] : []),
          { html: `Kugelblende ${k('ads', 'RMT')}`, done: viewOf(seat).id === 'kugel', why: 'Durch das Zielfernrohr der Kugelblende zielen – das MG schwenkt nur begrenzt.' },
          { html: `Feuerstöße ${k('fire', 'LMT')}`, done: false, why: 'Kurze Feuerstöße auf Infanterie und Panzerabwehrtrupps; gegen Panzer wirkungslos.' },
          { html: `Gurtkasten wechseln ${k('reload', 'R')}`, hot: 'gurt', done: this._belt.step === 'bereit' && w.mag > 0, why: 'Deckel auf, Gurtkasten tauschen, Gurt einlegen, Deckel zu – rund 4 Sekunden.' },
        ];
      }
      case 'kommandant': {
        const seat = v.seats[this.playerSeat];
        return [
          { html: 'Lage: Periskop / Luke', hot: 'luke', done: viewOf(seat).overlay === 'peri' || !!seat.hatchOpen, why: 'Durch das Rundblickperiskop (oder mit offener Luke – verwundbar!) nach Zielen suchen.' },
          { html: `Ziel übergeben ${k('squad_order', 'H')}`, done: !!(this.crew && this.crew.gun.target), why: 'Ziel ins Fadenkreuz nehmen und übergeben: der Richtschütze dreht den Turm darauf und meldet „Erkannt!“.' },
          { html: 'Munition befehlen 1–4', done: !!(this.crew && this.crew.ammoOrder), why: 'Wucht/Panzergranate gegen Panzer, Spreng gegen Pak, Bunker und Infanterie, Kanister auf kurze Entfernung.' },
          { html: `Feuer! ${k('jump', 'Leertaste')}`, done: false, why: 'Wenn „Geladen!“ gemeldet ist und der Richtschütze aufgefasst hat: Feuerbefehl.' },
        ];
      }
      default: return null;
    }
  }

  _helpText() {
    if (this.G.time.elapsed - (this._startT || (this._startT = this.G.time.elapsed)) > 40 && !this.G.input.down('scoreboard')) return null;
    const k = (a, fb) => `<kbd>${this.G.input.label(a) || fb}</kbd>`;
    const sv = `${k('crouch', 'C')} Sicht · `;
    const pad = this.G.input.lastDevice === 'gamepad'; // plattform: Controller-Hinweise statt Maus/Zifferntasten
    const aim = pad ? '<kbd>R-Stick</kbd> richten' : 'Maus richten', n14 = pad ? '' : '/1–4';
    const seatK = pad ? `${k('seat_prev', '◀')}/${k('seat_next', '▶')}` : `${k('sitzrad', 'K')} halten`;
    if (this.arcade) return `<h4>Arcade – ${ROLE[this.role]}</h4>${this._seatHelp(seatK)}<p>${k('move_forward', 'W')}${k('move_left', 'A')}${k('move_back', 'S')}${k('move_right', 'D')} fahren · ${aim} · ${k('fire', 'LMT')} Feuer · ${k('ads', 'RMT')} Zoom</p><p>${pad ? `${k('swap', 'Y')} Munition` : '1–4 Munition'} · ${sv}${k('grenade', 'G')} Wärmebild · ${k('befehl', 'Y')} Befehlsrad</p>`;
    const seatLine = `<p>${seatK}: Platz wechseln · ${k('ads', 'RMT')} in der Innensicht: durchsehen (Winkelspiegel/Optik)</p>`;
    const h = this._helpRole(k, sv, aim, n14);
    return h ? h + seatLine : null;
  }

  /** Arcade-Hinweis zum Platzwechsel: nur die Plätze, die rollen() wirklich anbietet (MTW: Fahrer und MG, ohne Kanone). */
  _seatHelp(seatK) {
    const L = this.rolesOf(), has = (r) => L.some((x) => x.role === r);
    if (L.length < 2) return '';
    if (has('richtschuetze') && has('fahrer') && has('kommandant')) return `<p>${seatK}: Platz wechseln (Richtschütze, Fahrer, Kommandant${has('mgschuetze') ? ', MG' : ''})</p>`;
    // andere Zusammenstellung: Platznamen einzeln (jeder Name ist für sich übersetzt)
    return `<p>${seatK}: Platz wechseln<span> – </span>${L.map((x) => `<span>${ROLE[x.role]}</span>`).join('<span> · </span>')}</p>`;
  }

  _helpRole(k, sv, aim, n14) {
    switch (this.role) {
      case 'mgschuetze': return `<h4>MG-Schütze / Funker</h4><p>${aim} · ${k('fire', 'LMT')} Feuerstoß · ${k('ads', 'RMT')} Kugelblende · ${k('reload', 'R')} ${this.sim ? 'Gurtkasten wechseln' : 'Nachladen'}</p><p>Funkgerät: Ein/Aus, Kanal 5 = Kompanie, Sprechtaste · ${sv}Q/E/Z Kopf</p>`;
      case 'kommandant': return `<h4>Kommandant – Befehle</h4><p>${k('move_forward', 'W')} Marsch/schneller · ${k('move_back', 'S')} Halt (2×: zurück) · ${k('move_left', 'A')}/${k('move_right', 'D')} links/rechts</p><p>${k('gadget', 'B')} zur Markierung · ${k('prone', 'Z')} Deckung · ${k('tactical', 'X')} Front zum Ziel</p><p>${k('squad_order', 'H')} Ziel übergeben · ${k('jump', 'Leertaste')} Feuer! · ${k('melee', 'V')} Feuer frei · 1–4 Munition</p><p>${k('befehl', 'Y')} Befehlsrad · ${sv}${k('verband', 'N')} Restlicht · Q/E/Z Kopf</p>`;
      case 'richtschuetze': return `<h4>Richtschütze</h4><p>${aim} · ${k('fire', 'LMT')} Feuer · ${k('ads', 'RMT')} Zoom · ${k('swap', 'Mausrad')}${n14} Munition</p><p>${k('light', 'T')} Laser · ${k('grenade', 'G')} Wärmebild · ${k('verband', 'N')} Polarität/Restlicht · ${sv}</p><p>Der Kommandant weist Ziele zu und befiehlt „Feuer!“.</p>`;
      case 'ladeschuetze': return `<h4>Ladeschütze</h4><p>Zum Gestell drehen · ${k('reload', 'R')} greifen · zum Verschluss · ${k('fire', 'LMT')} einschieben · ${k('reload', 'R')} schließen${this.sim ? ` · ${k('reload', 'R')} entsichern` : ''}</p><p>${k('swap', 'Mausrad')}${n14} Munitionsart · ${sv}Q/E/Z Kopf neigen</p>`;
      case 'fahrer': return `<h4>Fahrer</h4><p>${k('move_forward', 'W')} Gas · ${k('move_back', 'S')}/${k('jump', 'Leertaste')} Bremse · ${k('move_left', 'A')}/${k('move_right', 'D')} Lenkhebel</p><p>${k('swap', 'Mausrad')} Wahlhebel · ${k('gadget', 'B')} Feststellbremse · ${k('tactical', 'X')} Anlasser · ${k('light', 'T')} Licht</p><p>${sv}Befehle des Kommandanten oben im Bild.</p>`;
      default: return null;
    }
  }

  /* ------------------------------------------------------------ Modus-Takt */

  tick(dt) {
    const G = this.G;
    if (!this.tank) return;
    if (G.player && G.player.alive && this.tank.alive && G.player.vehicle !== this.tank) this._enterPlayer();
    if (G.match.state === 'playing') {
      try { this.crew && this.crew.update(dt); } catch (err) { console.warn('[Panzer] Besatzung', err); }
      for (const e of this.enemies) { try { e.update(dt); } catch (err) { console.warn('[Panzer] Feindpanzer', err); } }
    }
    if (this._endAt != null && G.time.elapsed >= this._endAt && !this.isOver) this.end(this._outcome === 'win' ? 'mission' : 'failed');
  }
}

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }
void VEHICLE_WEAPONS; void idFor; void bearingWord;
