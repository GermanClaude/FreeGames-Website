// NULLPUNKT — Kampagne: Missions-Skriptsystem (Regie). Läuft im CampaignMode (mode.js) je Bild.
//
// Eine Mission (missions/*.js) besteht aus Abschnitten (stages) mit Checkpoint; jeder Abschnitt ist eine
// Generatorfunktion *run(m), die auf Bedingungen wartet (yield):
//   yield 2.5                     – Sekunden warten (Spielzeit)
//   yield () => bedingung         – warten, bis die Funktion wahr liefert
//   yield m.reach('ziel', …)      – Handle mit .done (Ziel erreicht, Welle besiegt, Zeile gesprochen, Sequenz zu Ende …)
//   yield [h1, h2]                – auf alle warten
// Die Regie bietet: Ziele/Wegpunkte (objective, done, progress, reach, holdZone), Trigger-Zonen (zone, inZone, onEnter),
// Ereignisse (on → kill, vehicle:destroyed, actor:spawn …), Gegnerwellen (wave, cleared, killObjective), Verbündete mit
// Namen und Befehlen (allies, order, ally), Fahrzeuge (vehicle, scriptTank), Dialoge mit Lip-Sync (say – vor Ort am
// Sprecher, sonst als Funkspruch), Zwischensequenzen (cutscene), Checkpoints (checkpoint – Wiedereinstieg und
// „Fortsetzen“ im Profil), Zeitlimit (timer), Tipps/Hinweise, Ergebnis (complete → Outro, fail).
//
// Wiedereinstieg am Checkpoint k: mission.prepare(m) (gemeinsam, z. B. Verbündete), stages[k].setup(m), dann ab k.

import * as THREE from 'three';
import { Cutscene, StageActor, toVec, groundY, buriedY, yawTo } from './stage.js?v=20261121041936';
import { ACTION_IDS } from '../../shared/bindings.data.js?v=20261121041936';
import { prepareVehicleModels } from '../vehicles/models.js?v=20261121041936';
import { textToVisemes, subtitleDuration, wordAt } from './lipsync.js?v=20261121041936';
import { tx } from '../../shared/i18n.js?v=20261121041936'; // Zeilen in der gewählten Sprache (Untertitel + Mund)
import { createFaceRig, FaceDriver } from './face.js?v=20261121041936';
import { issueCommand } from '../bots/ai/orders.js?v=20261121041936';

const _v = new THREE.Vector3();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Schwierigkeit → Gegnerzahl ×, Leben (Wiedereinstiege am Checkpoint), Bot-Schwierigkeit */
export const CAMPAIGN_DIFF = {
  rekrut: { name: 'Rekrut', enemies: 0.7, lives: Infinity, hint: 'Weniger Gegner, beliebig viele Versuche.' },
  regulaer: { name: 'Regulär', enemies: 1, lives: Infinity, hint: 'Die vorgesehene Erfahrung.' },
  veteran: { name: 'Veteran', enemies: 1.25, lives: 5, hint: 'Mehr und härtere Gegner, 5 Wiedereinstiege je Mission.' },
  elite: { name: 'Elite', enemies: 1.5, lives: 3, hint: 'Gnadenlos: 3 Wiedereinstiege je Mission.' },
};
/** Infanteriesimulation als Kampagnen-Schwierigkeit (nur Infanterie-Kampagne): Gegner wie Veteran, Spielstil „Simulation“. */
export const CAMPAIGN_SIM = { name: 'Simulation', base: 'veteran', hint: 'Alles selbst: Magazine, Durchladen, Sicherung, Verwundungen, kein HUD – Gegner wie Veteran, 5 Wiedereinstiege.' };

class Handle {
  constructor(test) { this.test = test; this._done = false; }
  get done() { if (!this._done && this.test && this.test()) this._done = true; return this._done; }
  finish() { this._done = true; }
}

export class Director {
  constructor(mode, mission, { checkpoint = null, ui, store, cps } = {}) {
    this.mode = mode;
    this.G = mode.G;
    this.mission = mission;
    this.ui = ui;
    this.store = store;
    this.cps = cps;
    this.diffId = CAMPAIGN_DIFF[this.G.match.difficulty] ? this.G.match.difficulty : 'regulaer';
    this.diff = CAMPAIGN_DIFF[this.diffId];
    this.deaths = 0;
    this.stageIndex = 0;
    const cpIdx = checkpoint ? mission.stages.findIndex((s) => s.id === checkpoint) : -1;
    this.startIndex = cpIdx > 0 ? cpIdx : 0;
    this.resumed = this.startIndex > 0;
    this.co = null;
    this._wait = null;
    this.objs = [];
    this.zones = new Map();
    this.waves = new Map();
    this.allyList = [];
    this.allyByRole = new Map();
    this.cutscene = null;
    this.lines = []; // Funk-/Vor-Ort-Zeilen (Warteschlange)
    this.line = null;
    this.faces = new Map(); // Bot → { rig, driver, soldier }
    this.timerLeft = null;
    this.timerLabel = '';
    this.onTimer = null;
    this.handlers = [];
    this.spawnPoint = null; // aktueller Checkpoint { position, yaw }
    this.finished = false;
    this.state = 'run'; // run | outro | done | failed
    this.flags = {};
    this.vehicles = [];
    this.scripted = []; // gescriptete Fahrzeugbesatzungen
    this.holdState = null;
    this.tickers = [];
    this.elapsed = 0;
    this.extras = new Map(); // Figuren ohne KI (Zivilisten, Geiseln, Verwundete)
    this.presses = new Set(); // seit clearPresses gedrückte Aktionen (Ausbildung)
    this.groundFixes = 0; // Bodenprüfung: wie oft ein Akteur auf den Boden gesetzt wurde (Tests)
    this._groundT = 0;
    this._subs = this.G.events.scope();
    for (const ev of ['kill', 'vehicle:destroyed', 'actor:spawn', 'vehicle:enter', 'vehicle:exit', 'weapon:fire', 'weapon:reload', 'weapon:switch', 'weapon:firemode', 'weapon:ads']) {
      this._subs.on(ev, (e) => this._event(ev, e));
    }
  }

  /* ------------------------------------------------------------ Lebenszyklus */

  start() {
    const st = this.mission.stages[this.startIndex];
    if (st && st.checkpoint) this._setSpawn(st.checkpoint);
    // Fahrzeuge der Karte (Stellplätze inkl. Luftfahrzeuge mit KI-Piloten) räumen: die Mission stellt ihre eigenen auf
    if (this.mission.mapVehicles === false) this.clearMapVehicles();
    // Startausrüstung der Mission (mission.loadout = { primary, secondary }) – gilt auch nach dem Wiedereinstieg
    const lo = this.mission.loadout;
    if (lo) for (const id of [lo.primary, lo.secondary]) if (id) this.giveWeapon(id, { att: lo.att && lo.att[id] ? lo.att[id] : null });
    try { if (this.mission.prepare) this.mission.prepare(this, { resumed: this.resumed }); } catch (err) { console.error('[Kampagne] prepare', err); }
    this._enterStage(this.startIndex, true);
  }

  _setSpawn(cp) {
    const pos = toVec(this.G, cp.at, new THREE.Vector3());
    this.spawnPoint = { position: pos, yaw: Number(cp.yaw) || 0 };
  }

  _enterStage(i, first = false) {
    const st = this.mission.stages[i];
    this.stageIndex = i;
    if (!st) { this.complete(); return; }
    if (!first && st.checkpoint) this.checkpoint(st.id, st.checkpoint, { silent: !!st.silentCheckpoint });
    else if (first && this.resumed && st.checkpoint) this.checkpoint(st.id, st.checkpoint, { silent: true, save: false });
    if (first && this.resumed && st.setup) { try { st.setup(this); } catch (err) { console.error('[Kampagne] setup', err); } }
    try { this.co = st.run(this); } catch (err) { console.error('[Kampagne] Abschnitt', st.id, err); this.co = null; }
    this._wait = null;
    this._step();
  }

  dispose() {
    this._subs.dispose();
    for (const x of this.extras.values()) x.remove();
    this.extras.clear();
    if (this.cutscene) { this.cutscene.finish(true); this.cutscene = null; }
    for (const f of this.faces.values()) { try { f.rig.dispose(); } catch { /* */ } }
    this.faces.clear();
    this.handlers = [];
  }

  /* ------------------------------------------------------------ Takt */

  update(dt) {
    if (this.finished) return;
    this.elapsed += dt;
    const ui = this.ui;
    // Eingaben merken (Ausbildung: jeder Schritt wartet auf die echte Aktion)
    const I = this.G.input;
    if (I && typeof I.pressed === 'function' && !this.cutscene) for (const a of ACTION_IDS) if (I.pressed(a)) this.presses.add(a);
    // Figuren ohne KI
    if (this.extras.size) { const cam = this.G.camera ? this.G.camera.position : null; for (const x of this.extras.values()) x.update(dt, cam); }
    // Bodenprüfung der Kampagnen-Akteure (nach dem Laden und laufend, 2×/s)
    if ((this._groundT -= dt) <= 0) {
      this._groundT = 0.5;
      this._groundCheck();
      // Kartenfahrzeuge, die das Fahrzeugsystem erst nach dem Missionsstart aufstellt, ebenfalls räumen
      if (this.mission.mapVehicles === false && this.elapsed < 20) this.clearMapVehicles();
    }
    // Zwischensequenz
    if (this.cutscene) {
      if (this.cutscene.update(dt)) this._endCutscene();
    }
    // Timer
    if (this.timerLeft != null && !this.cutscene && this.G.match.state === 'playing') {
      this.timerLeft -= dt;
      if (this.timerLeft <= 0) {
        this.timerLeft = null;
        const fn = this.onTimer;
        this.onTimer = null;
        if (fn) fn();
      }
    }
    // Dialog
    this._updateLines(dt);
    for (const [bot, f] of this.faces) {
      if (!bot.alive || bot.soldier !== f.soldier) { try { f.rig.dispose(); } catch { /* */ } this.faces.delete(bot); continue; }
      f.driver.update(dt);
    }
    if (this._watched) this._watched = this._watched.filter((h) => !h.done);
    // Laufende Prüfungen der Mission (every): true als Rückgabe beendet sie
    if (this.tickers.length && !this.cutscene && this.state === 'run') {
      // während des Durchlaufs neu angelegte Prüfungen (z. B. aus einem Alarm heraus) bleiben erhalten
      const list = this.tickers;
      this.tickers = [];
      const keep = list.filter((fn) => { try { return !fn(dt); } catch (err) { console.error('[Kampagne] every', err); return false; } });
      this.tickers = keep.concat(this.tickers);
    }
    // Gescriptete Fahrzeuge
    for (const s of this.scripted) this._tickScripted(s, dt);
    // Regie-Schritt
    if (this.state === 'run' || this.state === 'outro') this._step();
    // Anzeige
    if (ui) {
      ui.objectives(this.objs.filter((o) => !o.hidden).map((o) => ({ text: o.text, done: o.done, optional: o.optional, count: o.count, total: o.total, progress: o.progress })), this.mission.short || 'Auftrag');
      ui.timer(this.timerLeft, this.timerLabel);
      const wp = !this.cutscene ? this.objs.find((o) => !o.done && !o.hidden && o.pos) : null;
      const P = this.G.player;
      ui.waypoint(wp ? this._objPos(wp) : null, wp ? wp.label || '' : '', this.G.camera, P && P.alive ? P.position : null);
      ui.update(dt);
    }
  }

  _objPos(o) {
    if (typeof o.pos === 'function') return o.pos();
    return o.pos;
  }

  _ready(w) {
    if (w == null) return true;
    if (typeof w === 'number') return this.elapsed >= w;
    if (typeof w === 'function') { try { return !!w(); } catch (err) { console.error('[Kampagne] Bedingung', err); return true; } }
    if (Array.isArray(w)) return w.every((x) => this._ready(x));
    if (typeof w === 'object' && 'done' in w) return !!w.done;
    return true;
  }

  _step() {
    let guard = 0;
    while (this.co && guard++ < 50) {
      if (!this._ready(this._wait)) return;
      let r;
      const co = this.co;
      try { r = co.next(); } catch (err) { console.error('[Kampagne] Skriptfehler', err); r = { done: true }; }
      if (this.finished || this.state === 'failed') return;
      if (this.co !== co) continue; // während des Schritts ersetzt (complete → Outro)
      if (r.done) {
        this.co = null;
        this._wait = null;
        if (this.state === 'run') this._enterStage(this.stageIndex + 1);
        return;
      }
      const v = r.value;
      this._wait = typeof v === 'number' ? this.elapsed + v : Array.isArray(v) ? v.map((x) => (typeof x === 'number' ? this.elapsed + x : x)) : v;
    }
  }

  _event(name, e) {
    if (name === 'kill' && e && e.victim) this._onKill(e);
    if (name === 'weapon:fire' && e && (this.extras.size || (this._kbProps && this._kbProps.some((a) => a.protect)))) this._shotAtExtras(e);
    // Befehle enden mit dem Tod eines Bots: wiederkehrende Verbündete bekommen den letzten Befehl erneut
    if (name === 'actor:spawn' && e && e.actor && e.actor._kc && e.actor._kc.ally && this.lastOrder) {
      const b = e.actor, o = this.lastOrder;
      try { issueCommand(this.G, [b], this.G.player, o.kind, { point: o.point, target: null, formation: null }, this.G.time.elapsed); } catch { /* */ }
    }
    for (const h of this.handlers) {
      if (h.name !== name) continue;
      try { h.fn(e); } catch (err) { console.error('[Kampagne] Ereignis', name, err); }
    }
  }

  /** Ereignis abonnieren (kill, vehicle:destroyed, actor:spawn, vehicle:enter, vehicle:exit). */
  on(name, fn) {
    // weitere Spielereignisse (target:hit, grenade:throw, vehicle:seat …) bei Bedarf abonnieren
    if (!this._evNames) this._evNames = new Set(['kill', 'vehicle:destroyed', 'actor:spawn', 'vehicle:enter', 'vehicle:exit', 'weapon:fire', 'weapon:reload', 'weapon:switch', 'weapon:firemode', 'weapon:ads']);
    if (!this._evNames.has(name) && !name.startsWith('extra:')) { this._evNames.add(name); this._subs.on(name, (e) => this._event(name, e)); }
    this.handlers.push({ name, fn });
  }

  /* ------------------------------------------------------------ Bequemlichkeit */

  get player() { return this.G.player; }
  vec(p, lift = 0) { return toVec(this.G, p, new THREE.Vector3(), lift); }
  wait(seconds) { return seconds; }
  until(fn) { return new Handle(fn); }
  set(key, v) { this.flags[key] = v; }
  get(key) { return this.flags[key]; }
  scaled(n) { return Math.max(1, Math.round(n * this.diff.enemies)); }

  tip(text, seconds = 4) { if (this.ui) this.ui.toast(text, 'tip', seconds); }
  toast(text, kind = 'ok', seconds = 2.6) { if (this.ui) this.ui.toast(text, kind, seconds); }

  /* ------------------------------------------------------------ Karte, Eingaben, Showcase (Runde 2) */

  /** Geladene Karte (bei Rückfall die Ersatzkarte). */
  get mapId() { return (this.G.match && this.G.match.mapId) || this.mission.map; }
  /** Wert je Karte: m.pick({ flugplatz: A, grenzland: B }) → Eintrag der geladenen Karte (sonst der erste). */
  pick(byMap) { if (!byMap) return null; return byMap[this.mapId] !== undefined ? byMap[this.mapId] : Object.values(byMap)[0]; }

  /** Wurde die Aktion seit clearPresses() gedrückt? (Belegung egal: Tastatur, Gamepad, Touch) */
  didPress(...actions) { return actions.some((a) => this.presses.has(a)); }
  clearPresses() { this.presses.clear(); }

  /** Eingabegerät für Hinweise: 'touch' | 'pad' | 'kb'. */
  get device() {
    const I = this.G.input;
    if (!I) return 'kb';
    return I.mode === 'touch' ? 'touch' : I.lastDevice === 'gamepad' ? 'pad' : 'kb';
  }

  /**
   * Taste einer Aktion für Hinweise, passend zum Gerät: Tastatur „[C]“, Gamepad „(B)“, Touch „Knopf »Ducken«“ (touch = Name
   * des Touch-Knopfs). Leer belegt → „(nicht belegt – Einstellungen › Steuerung)“.
   */
  key(action, touch = null) {
    const dev = this.device;
    if (dev === 'touch') return touch ? `Knopf „${touch}“` : '';
    let l = '';
    try { l = this.G.input.label(action, dev); } catch { l = ''; }
    if (!l) return '(nicht belegt – Einstellungen › Steuerung)';
    return dev === 'pad' ? `(${l})` : `[${l}]`;
  }

  /** Einblendung „Neu im Einsatz“ (Showcase einer Karte, Waffe, eines Fahrzeugs). kind: 'karte'|'waffe'|'fahrzeug'. */
  introduce(kind, id, text = '') {
    const G = this.G;
    const KIND = { karte: 'Neue Karte', waffe: 'Neue Waffe', fahrzeug: 'Neues Fahrzeug' };
    const VEH = { heli: 'Hubschrauber', jet: 'Kampfjet', mbt: 'Kampfpanzer', jeep: 'Geländewagen' };
    let name = id;
    if (kind === 'waffe' && G.data.WEAPONS[id]) name = G.data.WEAPONS[id].name;
    else if (kind === 'karte' && G.data.MAPS && G.data.MAPS[id]) name = G.data.MAPS[id].name;
    else if (kind === 'fahrzeug') name = VEH[id] || id;
    if (this.ui && typeof this.ui.showcase === 'function') this.ui.showcase(KIND[kind] || 'Neu im Einsatz', name, text);
    G.events.emit('campaign:showcase', { kind, id });
  }

  /** Waffe geben (Primär- oder Sekundärplatz nach Waffenart) und gleich in die Hand nehmen. */
  giveWeapon(id, { att = null } = {}) {
    const G = this.G, P = G.player;
    const def = G.data.WEAPONS && G.data.WEAPONS[id];
    const w = P && P.weapon;
    if (!def || !w) return false;
    const lo = { ...(P.loadout || {}) };
    if (def.slot === 'secondary') lo.secondary = id; else lo.primary = id;
    // Aufsätze der Mission (z. B. { muendung: 'daempfer' }) wie eine aufgehobene Waffe – bleiben auch nach dem Wiedereinstieg
    if (att) { lo.pickup = { id, att }; lo.keepPickups = true; }
    P.loadout = lo;
    try { w.setLoadout(lo); } catch (err) { console.warn('[Kampagne] Waffe', err); return false; }
    return true;
  }

  /** Hubschrauber (G.vehicles.air): at [x,z] bzw. [x,y,z]; airborne: in der Luft (alt über dem Boden). */
  heli(at, { yaw = 0, team = 'A', airborne = false, alt = 40 } = {}) {
    const air = this.G.vehicles && this.G.vehicles.air;
    if (!air || typeof air.spawn !== 'function') return null;
    const p = this.vec(at, airborne && !(Array.isArray(at) && at.length === 3) ? alt : 0);
    if (!airborne) p.y += 0.2;
    let v = null;
    try { v = air.spawn('heli', p, { yaw, team, airborne }); } catch (err) { console.warn('[Kampagne] Hubschrauber', err); }
    if (v) this.vehicles.push(v);
    return v;
  }

  /** Spieler/Bot in ein Luftfahrzeug setzen (Sitz 0 Pilot, 1 Schütze, 2… Truppenraum) → Sitz | −1. */
  boardAir(v, seat = 1, actor = this.G.player) {
    const air = this.G.vehicles && this.G.vehicles.air;
    if (!air || !v) return -1;
    try { return air.board(actor, v, seat); } catch (err) { console.warn('[Kampagne] Einsteigen', err); return -1; }
  }

  /* ------------------------------------------------------------ Schleichen (Entdeckung, Alarm) */

  /**
   * Entdeckungsanzeige für Wachen (Wellen waveIds): nutzt die Wahrnehmung der Bots (Entdeckungsgrad spot 0–1 je Ziel,
   * bots/ai/perception.js – Abstand, Blickkegel, Haltung, Bewegung, Licht/Rauch). Alarm, wenn eine Wache den Spieler voll
   * erkennt, eine Wache getroffen wird und überlebt oder ein ungedämpfter Schuss in Hörweite (40 m) fällt.
   * onAlarm(reason) einmal. → { alarmed, level, stop() }
   */
  stealth(waveIds, { onAlarm = null, label = 'Unentdeckt' } = {}) {
    const ids = [].concat(waveIds);
    const st = { alarmed: false, level: 0, stopped: false, reason: null };
    const guards = () => ids.flatMap((w) => (this.waves.get(w) ? this.waves.get(w).bots : []));
    const raise = (reason) => {
      if (st.alarmed || st.stopped) return;
      st.alarmed = true;
      st.reason = reason;
      for (const w of ids) { const wv = this.waves.get(w); if (wv) { wv.alarmed = true; wv.hold = false; wv.attack = 'player'; } }
      if (this.ui) this.ui.meter('Alarm', 1, 'alarm');
      setTimeout(() => { if (this.ui && st.alarmed) this.ui.meter(null); }, 2500);
      if (onAlarm) { try { onAlarm(reason); } catch (err) { console.error(err); } }
    };
    st.raise = raise;
    st.stop = () => { st.stopped = true; if (this.ui && !st.alarmed) this.ui.meter(null); };
    const hp = new Map();
    this.on('weapon:fire', (e) => {
      if (st.alarmed || st.stopped || this.noDetect || !e || e.actor !== this.G.player || e.suppressed) return;
      if (guards().some((b) => b.alive && b.position.distanceTo(this.G.player.position) < 40)) raise('schuss');
    });
    this.every(() => {
      if (st.stopped || st.alarmed) return true;
      if (this.noDetect) return false; // Tests: Abkürzungen per Teleport lösen keinen Alarm aus
      const P = this.G.player;
      let lvl = 0;
      for (const b of guards()) {
        if (!b.alive) continue;
        const r = b.memory && b.memory.get ? b.memory.get(P) : null;
        if (r && r.spot > lvl) lvl = r.spot;
        const h0 = hp.get(b);
        if (h0 == null) hp.set(b, b.health);
        else if (b.health < h0 - 1) { raise('getroffen'); return true; }
      }
      st.level = Math.max(lvl, st.level - 0.02);
      if (this.ui) this.ui.meter(st.level > 0.6 ? 'Verdacht!' : st.level > 0.05 ? 'Beobachtet' : label, st.level, st.level > 0.6 ? 'warn' : '');
      if (lvl >= 0.999) { raise('gesehen'); return true; }
      return false;
    });
    return st;
  }

  /** Brandfläche (nur Bild: Flammen, Glut, Rauch, Licht) bei at [x,z] für duration s. */
  fire(at, radius = 3, duration = 30) {
    const E = this.G.effects;
    if (!E || typeof E.fireArea !== 'function') return null;
    try { return E.fireArea(this.vec(at), radius, duration); } catch { return null; }
  }

  /** Rauchwolke (Sichtschutz wie eine Rauchgranate). */
  smoke(at, { radius = 6, duration = 30, color = null } = {}) {
    const E = this.G.effects;
    if (!E || typeof E.smokeCloud !== 'function') return null;
    try { return E.smokeCloud(this.vec(at), { radius, duration, ...(color ? { color } : {}) }); } catch { return null; }
  }

  /** Gegner im Blick des Spielers markieren (Minikarte, Namensschild) – für Aufklärung. */
  markActor(a, seconds = 600) {
    if (!a) return;
    const P = this.G.player;
    a.spottedUntil = Math.max(a.spottedUntil || 0, this.G.time.elapsed + seconds);
    a.spottedBy = P ? P.team : 'A';
  }

  /* ------------------------------------------------------------ Figuren ohne KI (Zivilisten, Geiseln) */

  /**
   * Figur ohne KI: { pos, yaw, variant, team, weapon (null), crouch, protect, name, color }. protect: Treffer durch den
   * Spieler oder Verbündete → Fehlschlag. → Extra (follow, walk, place, crouch, remove, position)
   */
  extra(id, def = {}) {
    if (this.extras.has(id)) this.extras.get(id).remove();
    const x = new Extra(this, id, def);
    this.extras.set(id, x);
    return x;
  }

  extraNear(id, r = 2.5, actor = this.G.player) {
    const x = this.extras.get(id);
    if (!x || !actor) return false;
    const p = actor.vehicle ? actor.vehicle.position : actor.position;
    return x.a.pos.distanceToSquared(p) <= r * r;
  }

  _shotAtExtras(e) {
    const shooter = e.actor;
    if (!shooter || shooter.team !== 'A' || !e.origin || !e.dir) return;
    const W = this.G.world;
    let wall = Infinity;
    try { const h = W && W.raycast ? W.raycast(e.origin, e.dir, 200) : null; if (h) wall = h.distance; } catch { /* */ }
    // Geschützte Figuren: Extras (protect) und Figuren aus hilfen-b prop({ protect: true }) (Einwohner, Kessar …)
    const targets = [];
    for (const x of this.extras.values()) if (x.protect && !x.removed && !x.a.hidden) targets.push({ a: x.a, hit: (s) => x.hit(s) });
    for (const a of this._kbProps || []) if (a.protect && !a.hidden && typeof a.hit === 'function') targets.push({ a, hit: (s) => a.hit(s) });
    for (const x of targets) {
      // Strahl gegen eine senkrechte Kapsel (Füße bis Kopf, r 0,32 m; geduckt niedriger)
      const p = x.a.pos, top = x.a.crouch ? 1.15 : 1.75;
      const ox = e.origin.x - p.x, oz = e.origin.z - p.z, dx = e.dir.x, dz = e.dir.z;
      const a = dx * dx + dz * dz;
      if (a < 1e-6) continue;
      const t = Math.max(0, -(ox * dx + oz * dz) / a);
      const cx = ox + dx * t, cz = oz + dz * t;
      if (cx * cx + cz * cz > 0.32 * 0.32) continue;
      const len = t * Math.sqrt(a + e.dir.y * e.dir.y);
      if (len > wall || len > 200) continue;
      const y = e.origin.y + e.dir.y * t - p.y;
      if (y < 0 || y > top) continue;
      x.hit(shooter);
    }
  }

  /* ------------------------------------------------------------ Bodenprüfung */

  /**
   * Boden-Fix: Kampagnen-Bots (Verbündete, Wellen), Figuren und Darsteller nie im Boden. Bots ohne Fahrzeug, die mehr als
   * 0,25 m unter der Standfläche stecken (alte Stellpunkte, Spawn in der Bodenplatte, Gelände höher als der Suchstrahl),
   * werden auf die Fläche gesetzt; Schweben über 2 m (Spawn auf Dachkante) ebenso.
   */
  _groundCheck() {
    const G = this.G;
    for (const b of G.actors) {
      if (!b || !b.alive || !b._kc || b.vehicle || !b.body || b === G.player) continue;
      const p = b.position;
      const fy = buriedY(G, p.x, p.z, p.y);
      if (fy != null) {
        this._fixLog(b.name || 'Bot', p, fy);
        try { b.body.teleport(_v.set(p.x, fy + 0.02, p.z)); if (b.body.velocity) b.body.velocity.set(0, 0, 0); this.groundFixes++; } catch { /* */ }
      }
    }
    const P = G.player;
    if (P && P.alive && !P.vehicle && P.body) {
      const p = P.position, fy = buriedY(G, p.x, p.z, p.y, 0.35);
      if (fy != null) { this._fixLog('Spieler', p, fy); try { P.body.teleport(_v.set(p.x, fy + 0.02, p.z)); this.groundFixes++; } catch { /* */ } }
    }
    for (const x of this.extras.values()) {
      if (x.removed) continue;
      const p = x.a.pos, fy = buriedY(G, p.x, p.z, p.y);
      if (fy != null) { this._fixLog(x.id, p, fy); p.y = fy; this.groundFixes++; }
    }
  }

  /** Letzte Korrekturen (Tests: __game.campaign.director.groundLog). */
  _fixLog(who, p, fy) {
    const L = this.groundLog || (this.groundLog = []);
    L.push(`${who} (${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}) → ${fy.toFixed(2)}`);
    if (L.length > 12) L.shift();
  }

  /* ------------------------------------------------------------ Ziele */

  /** Ziel anlegen/ändern. o: { pos: [x,z] | Vector3 | () => Vector3, label, total, optional, hidden } */
  objective(id, text, o = {}) {
    let ob = this.objs.find((x) => x.id === id);
    if (!ob) { ob = { id, text, done: false, count: 0 }; this.objs.push(ob); }
    ob.text = text;
    ob.done = false;
    ob.pos = typeof o.pos === 'function' ? o.pos : o.pos ? this.vec(o.pos) : null;
    ob.label = o.label || '';
    ob.total = o.total ?? null;
    ob.optional = !!o.optional;
    ob.hidden = !!o.hidden;
    ob.progress = o.progress ?? null;
    if (!o.quiet && this.ui && !ob.optional) this.ui.toast(`Neues Ziel: ${text}`, 'tip', 2.4);
    return ob;
  }

  done(id, { quiet = false } = {}) {
    const ob = this.objs.find((x) => x.id === id);
    if (!ob || ob.done) return;
    ob.done = true;
    ob.progress = null;
    if (!quiet && this.ui) this.ui.toast(`Ziel erfüllt: ${ob.text}`, 'ok', 2.2);
    this.G.events.emit('campaign:objective', { id, done: true });
  }

  progress(id, count, total = null) {
    const ob = this.objs.find((x) => x.id === id);
    if (!ob) return;
    ob.count = count;
    if (total != null) ob.total = total;
  }

  bar(id, p) { const ob = this.objs.find((x) => x.id === id); if (ob) ob.progress = p == null ? null : clamp(p, 0, 1); }

  /** Erledigte Ziele aus der Liste nehmen (neuer Abschnitt). */
  clearObjectives({ keepOpen = false } = {}) { this.objs = keepOpen ? this.objs.filter((o) => !o.done) : []; }

  /* ------------------------------------------------------------ Zonen */

  /** Trigger-Zone: Kreis { at: [x,z], r, h (Höhentoleranz) } oder Rechteck { box: [minX, minZ, maxX, maxZ] }. */
  zone(id, z) {
    const zone = { id, ...z, c: z.at ? this.vec(z.at) : null };
    this.zones.set(id, zone);
    return zone;
  }

  inZone(id, actor = this.G.player) {
    const z = typeof id === 'string' ? this.zones.get(id) : id;
    if (!z || !actor || actor.alive === false) return false;
    const p = actor.vehicle ? actor.vehicle.position : actor.position;
    if (z.box) return p.x >= z.box[0] && p.z >= z.box[1] && p.x <= z.box[2] && p.z <= z.box[3];
    const dx = p.x - z.c.x, dz = p.z - z.c.z;
    return dx * dx + dz * dz <= z.r * z.r && (!z.h || Math.abs(p.y - z.c.y) <= z.h);
  }

  /** Akteure in der Zone zählen (team: 'A' | 'B' | null = alle; lebend). */
  countIn(id, team = null) {
    let n = 0;
    for (const a of this.G.actors) if (a.alive && (!team || a.team === team) && this.inZone(id, a)) n++;
    return n;
  }

  /** Jede Spielsekunde-Bruchteil fn(dt) aufrufen (nicht während Sequenzen); fn liefert true → beendet. */
  every(fn) { this.tickers.push(fn); }

  /** Einmal-Auslöser beim Betreten. */
  onEnter(id, fn, actor = null) {
    let fired = false;
    const h = new Handle(() => {
      if (fired) return true;
      if (this.inZone(id, actor || this.G.player)) { fired = true; try { fn && fn(); } catch (err) { console.error(err); } return true; }
      return false;
    });
    this._watch(h);
    return h;
  }

  _watch(h) { (this._watched || (this._watched = [])).push(h); }

  /** Ziel „erreiche …“ mit Wegpunkt; fertig, wenn der Spieler in der Zone ist. */
  reach(id, text, { at, r = 4, label = '', h = 0 } = {}) {
    this.zone(id, { at, r, h });
    this.objective(id, text, { pos: at, label });
    return new Handle(() => { if (this.inZone(id)) { this.done(id); return true; } return false; });
  }

  /** In der Zone ausharren (secs Sekunden, Fortschrittsbalken; Verlassen hält an). */
  holdZone(id, text, { at, r = 3.5, secs = 4, label = '', action = 'Sichern' } = {}) {
    this.zone(id, { at, r });
    const ob = this.objective(id, text, { pos: at, label, progress: 0 });
    let t = 0, last = this.elapsed;
    return new Handle(() => {
      const now = this.elapsed;
      const dt = Math.min(0.25, now - last);
      last = now;
      const inside = this.inZone(id) && this.G.player.alive;
      if (inside) t += this.rush ? dt * Math.max(1, secs / 1.5) : dt; // Tests (__game.campaign.director.rush): Halten im Zeitraffer
      ob.progress = t / secs;
      if (this.ui) this.ui.hold(inside && t < secs ? `${tx(action)} … ${Math.ceil(secs - t)} s` : null, t / secs);
      if (t >= secs) { if (this.ui) this.ui.hold(null); this.done(id); return true; }
      return false;
    });
  }

  /* ------------------------------------------------------------ Akteure, Wellen, Verbündete */

  _spawnBots(team, n, { difficulty = null } = {}) {
    const G = this.G;
    const bots = G.bots.spawnBots({ allies: team === 'A' ? n : 0, enemies: team === 'B' ? n : 0, ffa: false, difficulty: difficulty || G.match.difficulty, modeId: 'kampagne' }) || [];
    return bots;
  }

  _place(bot, spawn) {
    bot._kcSpawn = spawn;
    if (!this.G.actors.includes(bot)) this.G.actors.push(bot);
    this.G.spawnActor(bot);
  }

  /**
   * Gegnerwelle: { count, at: [[x,z], …] (Spawnpunkte reihum), attack: [x,z] | 'player' | Zonen-Id, radius,
   *   hold: true (Posten halten statt vorrücken), scale: false (Anzahl nicht nach Schwierigkeit), cls }
   */
  wave(id, w) {
    const n = w.scale === false ? w.count : this.scaled(w.count);
    const bots = this._spawnBots('B', n, { difficulty: w.difficulty || null }); // w.difficulty: z. B. 'rekrut' für Wachen beim Schleichen
    const pts = (w.at || []).map((p) => this.vec(p));
    const wave = { id, bots, total: bots.length, killed: 0, attack: w.attack || 'player', radius: w.radius || 6, hold: !!w.hold };
    bots.forEach((b, i) => {
      const p = pts.length ? pts[i % pts.length].clone() : this.G.player.position.clone();
      if (pts.length && i >= pts.length) p.add(_v.set((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
      p.y = groundY(this.G, p.x, p.z, p.y + 2);
      const target = this._attackPos(wave, b) || this.G.player.position;
      b._kc = { wave: id, enemy: true, post: p.clone() };
      // Streife: Route [[x,z], …] (eine für alle oder je Bot w.patrol[i]) – Wache geht sie ab, solange kein Alarm ist
      const route = w.patrol ? (Array.isArray(w.patrol[0]) && Array.isArray(w.patrol[0][0]) ? w.patrol[i % w.patrol.length] : w.patrol) : null;
      if (route && route.length) { b._kc.patrol = route.map((q) => this.vec(q)); b._kc.pi = i % route.length; }
      if (w.cls && typeof b.setClass === 'function') { try { b.setClass(w.cls); } catch { /* */ } }
      this._place(b, { position: p, yaw: yawTo(p, target) });
    });
    this.waves.set(id, wave);
    return wave;
  }

  _attackPos(wave, bot) {
    const a = wave.attack;
    if (wave.hold && bot && bot._kc) return bot._kc.post;
    if (a === 'player') { const P = this.G.player; return P.vehicle ? P.vehicle.position : P.position; }
    if (typeof a === 'string') { const z = this.zones.get(a); return z && z.c ? z.c : null; }
    if (Array.isArray(a)) return wave._a || (wave._a = this.vec(a));
    return null;
  }

  /** Ziel eines Bots für die KI (CampaignMode.objectiveFor). */
  objectiveFor(bot) {
    const k = bot._kc;
    if (!k) return null;
    if (k.enemy) {
      const wave = this.waves.get(k.wave);
      if (!wave) return null;
      if (k.patrol && !wave.alarmed) {
        let q = k.patrol[k.pi % k.patrol.length];
        const dx = bot.position.x - q.x, dz = bot.position.z - q.z;
        if (dx * dx + dz * dz < 4) { k.pi = (k.pi + 1) % k.patrol.length; q = k.patrol[k.pi]; }
        return { id: `kc:${wave.id}:p${k.pi}`, position: q, radius: 1.2, kind: 'capture' };
      }
      const pos = this._attackPos(wave, bot);
      return pos ? { id: `kc:${wave.id}`, position: pos, radius: wave.hold ? 3 : wave.radius, kind: wave.hold ? 'capture' : 'capture' } : null;
    }
    return null;
  }

  alive(waveId) { const w = this.waves.get(waveId); return w ? w.bots.filter((b) => b.alive).length : 0; }
  cleared(waveId) { const w = this.waves.get(waveId); return !!w && w.bots.every((b) => !b.alive); }

  /** Alle Wellen ids besiegen – Ziel mit Zähler. */
  killObjective(id, text, waveIds, { pos = null, label = '' } = {}) {
    const ids = [].concat(waveIds);
    const total = () => ids.reduce((n, w) => n + (this.waves.get(w) ? this.waves.get(w).total : 0), 0);
    const dead = () => ids.reduce((n, w) => n + (this.waves.get(w) ? this.waves.get(w).bots.filter((b) => !b.alive).length : 0), 0);
    // Wegpunkt: nächster lebender Gegner der Wellen (nur wenn kein fester Punkt)
    const near = () => {
      const P = this.G.player;
      let best = null, bd = Infinity;
      for (const w of ids) { const wv = this.waves.get(w); if (!wv) continue; for (const b of wv.bots) if (b.alive) { const d = b.position.distanceToSquared(P.position); if (d < bd) { bd = d; best = b; } } }
      return best ? best.position : null;
    };
    this.objective(id, text, { pos: pos || (() => near()), label: label || 'Feind', total: total() });
    return new Handle(() => {
      this.progress(id, dead(), total());
      if (dead() >= total()) { this.done(id); return true; }
      return false;
    });
  }

  _onKill(e) {
    const v = e.victim;
    if (v === this.G.player) {
      this.deaths += 1;
      const left = this.diff.lives - this.deaths;
      if (left < 0) { this.fail('Zu viele Verluste – der Trupp muss sich zurückziehen.'); return; }
      if (this.ui) this.ui.toast(Number.isFinite(left) ? `Gefallen – Wiedereinstieg am Checkpoint (noch ${left})` : 'Gefallen – Wiedereinstieg am Checkpoint', 'warn', 3);
    }
    if (v && v._kc && v._kc.ally && v._kc.role) {
      // benannte Verbündete kommen nach einer Weile zurück (am Spieler)
      v._kcSpawn = null;
    }
  }

  /**
   * Verbündete: [{ role, name, at: [x,z], weapon? }] → Bots im Team des Spielers, mit Namen (Sprecher-Id = role).
   */
  allies(list) {
    const G = this.G;
    const bots = this._spawnBots('A', list.length);
    bots.forEach((b, i) => {
      const d = list[i];
      if (d.name) { b.name = d.name; const pl = G.bots._plates && G.bots._plates.get(b); if (pl && pl.setName) pl.setName(d.name); }
      b._kc = { ally: true, role: d.role || null };
      const p = d.at ? this.vec(d.at) : this.spawnPoint ? this.spawnPoint.position.clone().add(_v.set(1.5 * (i + 1), 0, 1)) : this.G.player.position.clone();
      this._place(b, { position: p, yaw: this.spawnPoint ? this.spawnPoint.yaw : 0 });
      this.allyList.push(b);
      if (d.role) this.allyByRole.set(d.role, b);
    });
    return bots;
  }

  ally(role) { return this.allyByRole.get(role) || null; }

  /** Befehl an alle Verbündeten (follow | hold | regroup | attack | defend | spread | free); point: [x,z]. */
  order(kind, point = null) {
    const G = this.G;
    const bots = this.allyList.filter((b) => b.alive && G.actors.includes(b));
    if (!bots.length) return 0;
    const p = point ? this.vec(point) : null;
    this.lastOrder = kind === 'free' ? null : { kind, point: p };
    try { return issueCommand(G, bots, G.player, kind, { point: p, target: null, formation: null }, G.time.elapsed); } catch (err) { console.error('[Kampagne] Befehl', err); return 0; }
  }

  /** Wiedereinstiegspunkt eines Akteurs (CampaignMode.chooseSpawn). */
  spawnFor(actor) {
    if (actor._kcSpawn) { const s = actor._kcSpawn; actor._kcSpawn = null; return { position: s.position.clone(), yaw: s.yaw }; }
    if (actor === this.G.player) return this.spawnPoint ? { position: this.spawnPoint.position.clone(), yaw: this.spawnPoint.yaw } : null;
    if (actor._kc && actor._kc.ally) {
      const P = this.G.player;
      const base = P && P.alive ? P.position : this.spawnPoint ? this.spawnPoint.position : null;
      if (!base) return null;
      const a = Math.random() * Math.PI * 2;
      const pos = base.clone().add(_v.set(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5));
      pos.y = groundY(this.G, pos.x, pos.z, base.y + 1.5);
      return { position: pos, yaw: this.spawnPoint ? this.spawnPoint.yaw : 0 };
    }
    return null;
  }

  canRespawn(actor) {
    if (this.state === 'failed') return false;
    if (actor === this.G.player) return true;
    return !!(actor._kc && actor._kc.ally);
  }

  /** Alle übrigen Gegner leise entfernen (vor dem Outro). */
  removeEnemies() {
    const G = this.G;
    for (const b of [...G.bots.bots]) if (b.team === 'B' || (b._kc && b._kc.enemy)) { try { G.bots.removeBot(b); } catch { /* */ } }
  }

  /* ------------------------------------------------------------ Fahrzeuge */

  vehicle(type, at, yaw = 0, team = 'A') {
    const V = this.G.vehicles;
    if (!V || !V.attached) return null;
    if (type === 'tank') type = typeof V.tankTypeFor === 'function' ? V.tankTypeFor(team) || 'mbt' : 'mbt';
    // Kleine Karten erlauben sonst nur Zivilfahrzeuge – ein Fahrzeug der Mission (Ausbildung am Schießstand) darf trotzdem
    const lift = V.civilOnly && !V.replica;
    if (lift) { try { prepareVehicleModels([type], [team], V.quality || 'high'); } catch { /* bei Bedarf */ } V.civilOnly = false; }
    let v = null;
    try { v = V.spawnVehicle(type, this.vec(at), yaw, team); } finally { if (lift) V.civilOnly = true; }
    if (v) this.vehicles.push(v);
    return v;
  }

  /** Alle Fahrzeuge der Kartenstellplätze entfernen (kein Neuerscheinen); eigene (m.vehicle/m.heli) bleiben. */
  clearMapVehicles() {
    const V = this.G.vehicles;
    if (!V || !V.attached) return 0;
    let n = 0;
    try { if (Array.isArray(V.spawns)) V.spawns.length = 0; } catch { /* */ }
    for (const v of [...(V.list || [])]) {
      if (this.vehicles.includes(v)) continue;
      try { V.removeVehicle(v); n++; } catch { /* */ }
    }
    return n;
  }

  /**
   * Feindliches Fahrzeug mit Bot-Besatzung, die auf das Ziel zufährt und auf den Spieler (bzw. dessen Fahrzeug) schießt.
   * o: { type, at, yaw, route: [[x,z], …], range, fireEvery }
   */
  scriptTank(id, o) {
    const v = this.vehicle(o.type || 'tank', o.at, o.yaw || 0, 'B');
    if (!v) return null;
    const [bot] = this._spawnBots('B', 1);
    if (bot) {
      bot._kc = { enemy: true, wave: `veh:${id}`, crew: true };
      this._place(bot, { position: v.position.clone(), yaw: o.yaw || 0 });
      try { this.G.vehicles.enter(bot, v, 0); } catch (err) { console.warn('[Kampagne] Besatzung', err); }
    }
    const s = { id, v, bot, route: (o.route || []).map((p) => this.vec(p)), range: o.range || 120, fireEvery: o.fireEvery || 6, next: 0, t: 0, leg: 0, started: false, active: o.active !== false };
    this.scripted.push(s);
    this.waves.set(`veh:${id}`, { id: `veh:${id}`, bots: bot ? [bot] : [], total: bot ? 1 : 0, attack: 'player', radius: 8 });
    return s;
  }

  _tickScripted(s, dt) {
    const v = s.v, bot = s.bot;
    if (!v || !v.alive || v.wreck || !bot || !bot.alive || bot.vehicle !== v || !s.active) return;
    if (this.cutscene || this.G.match.state !== 'playing') { v.stop(bot); return; }
    s.t -= dt;
    if (!s.started || (s.route.length && v.intentFor(bot) && v.intentFor(bot).arrived && s.leg < s.route.length - 1)) {
      if (s.started) s.leg += 1;
      s.started = true;
      const goal = s.route[s.leg];
      if (goal) v.driveTo(bot, goal, { arriveRadius: 6, maxSpeed: 6 });
    }
    const P = this.G.player;
    const tgt = P.vehicle ? P.vehicle.position : P.position;
    const d = tgt.distanceTo(v.position);
    if (d < s.range && P.alive) {
      _v.copy(tgt); _v.y += 1.2;
      const W = this.G.world;
      const los = !W || !W.lineOfSight || W.lineOfSight(_v.clone().setY(v.position.y + 2.6), _v);
      v.aimAt(bot, _v, false);
      if (los && s.t <= 0) {
        s.t = s.fireEvery * (0.8 + Math.random() * 0.4);
        const it = v.intentFor(bot);
        if (it) { it.fire = true; it.firePressed = true; setTimeout(() => { if (it) { it.fire = false; } }, 400); }
      }
    }
  }

  /* ------------------------------------------------------------ Dialog */

  /**
   * Zeile sprechen: who = Sprecher-Id (mission.speakers). Lebt ein Verbündeter mit dieser Rolle in der Nähe (≤ 25 m),
   * spricht er vor Ort (Mund bewegt sich), sonst kommt die Zeile über Funk. → Handle (fertig, wenn gesprochen)
   */
  say(who, text, { expr = null, radio = null, minor = false } = {}) {
    const h = new Handle(null);
    this.lines.push({ who, text, expr, radio, h, minor, at: this.elapsed });
    // Warteschlange (kamp3, 15.11.): früher fielen ab drei wartenden Zeilen die ältesten weg – auch Story-Zeilen. Jetzt
    // entfallen zuerst Nebenzeilen (minor: true, z. B. Zurufe im Gefecht); Story-Zeilen bleiben, solange höchstens sechs
    // warten (lange Warteschlangen werden schneller abgespielt, siehe _updateLines).
    while (this.lines.length > 3) {
      // zuerst Nebenzeilen, dann Zeilen, die schon über 25 s warten (das Geschehen ist weiter)
      let i = this.lines.findIndex((l) => l.minor);
      if (i < 0) i = this.lines.findIndex((l) => this.elapsed - l.at > 25);
      if (i >= 0) { this.lines.splice(i, 1)[0].h.finish(); continue; }
      if (this.lines.length > 6) { this.lines.shift().h.finish(); continue; }
      break;
    }
    return h;
  }

  /** Mehrere Zeilen: [[who, text, expr?], …] → Handle der letzten. */
  talk(list) {
    let h = null;
    for (const l of list) h = this.say(l[0], l[1], { expr: l[2] || null });
    return h;
  }

  get talking() { return !!this.line || this.lines.length > 0; }

  _speaker(id) {
    const s = (this.mission.speakers || {})[id] || {};
    return { name: s.name || id, color: s.color || '#ffc23d', radioOnly: !!s.radioOnly };
  }

  _updateLines(dt) {
    if (this.cutscene) return;
    const ui = this.ui;
    if (!this.line && this.lines.length) {
      const l = this.lines.shift();
      const sp = this._speaker(l.who);
      const bot = this.allyByRole.get(l.who);
      const P = this.G.player;
      const near = bot && bot.alive && P && bot.position.distanceTo(P.position) < 25 && l.radio !== true;
      const text = tx(l.text); // Untertitel und Lippen in der gewählten Sprache (Quelltext bleibt deutsch)
      const track = textToVisemes(text, { cps: this.cps });
      l.track = track;
      l.t = 0;
      l.dur = subtitleDuration(track, this.lines.length >= 2 ? 0.25 : 0.7); // Rückstau: kürzerer Nachlauf
      if (near) {
        let f = this.faces.get(bot);
        if (!f || f.soldier !== bot.soldier) {
          const rig = createFaceRig(bot.soldier);
          f = { rig, driver: new FaceDriver(rig), soldier: bot.soldier };
          this.faces.set(bot, f);
        }
        f.driver.say(track, l.expr);
      }
      if (ui) ui.subtitle({ name: near || sp.radioOnly ? sp.name : `${sp.name} · Funk`, color: sp.color }, text, { track, radio: true });
      this.line = l;
    }
    const l = this.line;
    if (!l) return;
    l.t += dt;
    if (ui) ui.subtitleProgress(l.t > l.track.duration ? -2 : wordAt(l.track, l.t));
    if (l.t >= l.dur) {
      l.h.finish();
      this.line = null;
      if (ui && !this.lines.length) ui.subtitle(null, '');
    }
  }

  /* ------------------------------------------------------------ Zwischensequenzen */

  /** Zwischensequenz aus mission.cutscenes[id] abspielen → Handle (fertig nach Ende/Überspringen). */
  cutsceneAt(id) {
    const def = (this.mission.cutscenes || {})[id];
    const h = new Handle(null);
    if (!def) { h.finish(); return h; }
    this.lines = [];
    if (this.line) { this.line.h.finish(); this.line = null; }
    this.mode.enterCinema(true);
    this.cutscene = new Cutscene(this.G, typeof def === 'function' ? def(this) : def, {
      ui: this.ui, speakers: this.mission.speakers || {}, cps: this.cps,
      onEvent: (name, data) => this._cineEvent(name, data),
    });
    this.cutscene._handle = h;
    try { this.cutscene.start(); } catch (err) { console.error('[Kampagne] Zwischensequenz', id, err); this._endCutscene(); }
    return h;
  }

  _cineEvent(name, data) {
    const G = this.G;
    if (name === 'explosion' && data && data.at && G.effects && typeof G.effects.explosion === 'function') {
      try { G.effects.explosion(this.vec(data.at)); } catch { /* */ }
    }
    if (this.mission.onCineEvent) { try { this.mission.onCineEvent(this, name, data); } catch (err) { console.error(err); } }
  }

  skipCutscene() { if (this.cutscene) this.cutscene.skip(); }

  _endCutscene() {
    const c = this.cutscene;
    this.cutscene = null;
    if (!c) return;
    if (!c.done) c.finish(true);
    if (this.ui) this.ui.fade(0, 0.4);
    this.mode.enterCinema(false);
    if (c._handle) c._handle.finish();
  }

  /* ------------------------------------------------------------ Checkpoints, Timer, Ergebnis */

  checkpoint(id, cp, { silent = false, save = true } = {}) {
    if (cp) this._setSpawn(cp);
    this.checkpointId = id;
    if (save && this.store) { try { this.store.saveCheckpoint(this.mission.id, id, this.G.match.sim ? 'simulation' : this.diffId); } catch (err) { console.error(err); } }
    if (!silent && this.ui) this.ui.toast('Checkpoint erreicht', 'ok', 2.2);
    this.G.events.emit('campaign:checkpoint', { mission: this.mission.id, id });
  }

  timer(seconds, label = '', onEnd = null) {
    this.timerLeft = this.rush ? Math.min(seconds, 2) : seconds;
    this.timerLabel = label;
    this.onTimer = onEnd;
    return new Handle(() => this.timerLeft == null);
  }

  stopTimer() { this.timerLeft = null; this.onTimer = null; }

  /** Mission erfüllt: Outro (falls vorhanden) und Ende mit Sieg. */
  complete() {
    if (this.state === 'outro' || this.state === 'done' || this.state === 'failed') return;
    this.state = 'outro';
    this.stopTimer();
    this.co = null;
    const outro = (this.mission.cutscenes || {}).outro;
    const finish = () => { this.state = 'done'; this.finished = true; this.mode.missionEnd(true); };
    if (!outro) { finish(); return; }
    this.removeEnemies();
    const h = this.cutsceneAt('outro');
    this.co = (function* () { yield h; finish(); })();
    this._wait = null;
  }

  fail(reason = 'Mission gescheitert.') {
    if (this.state === 'failed' || this.state === 'done') return;
    this.state = 'failed';
    this.co = null;
    this.stopTimer();
    this.failReason = reason;
    this.lines = [];
    if (this.line) { this.line.h.finish(); this.line = null; }
    if (this.ui) this.ui.subtitle(null, '');
    this.mode.missionFail(reason);
  }
}

/* ======================================================================== Figur ohne KI */

/**
 * Zivilist/Geisel/Verwundeter: Darsteller (stage.js StageActor) mitten im Spiel. follow(actor) läuft der Spur des
 * Spielers nach (Brotkrumen alle 0,8 m – so geht die Figur dieselben Wege, nie durch Wände). Höhe immer vom Boden.
 */
class Extra {
  constructor(m, id, def) {
    this.m = m;
    this.id = id;
    this.protect = !!def.protect;
    this.failText = def.failText || null; // eigener Fehlschlag-Text (z. B. Geisel, Zeuge)
    this.removed = false;
    this.target = null;
    this.trail = [];
    this.hits = 0;
    this.a = new StageActor(m.G, { id, name: def.name || id, team: def.team || 'A', variant: def.variant ?? 'sanitaeter', weapon: def.weapon ?? null, pos: def.pos || [0, 0], yaw: def.yaw || 0, crouch: !!def.crouch, aim: def.aim ?? -0.9, top: !!def.top, face: def.face ?? false, camo: def.camo || null });
    this.a.update(0, null);
  }

  get position() { return this.a.pos; }
  get crouch() { return this.a.crouch; }
  set crouch(v) { this.a.crouch = !!v; }

  place(p, yaw) { this.a.place(p, yaw ?? this.a.yaw); this.trail = []; }
  walk(points, speed = 1.6) { this.target = null; this.a.walk(points, speed); }
  face(t) { this.a.faceTo(t); }
  /** Dem Akteur folgen (null = stehen bleiben). */
  follow(actor, { crouch = false } = {}) { this.target = actor || null; this.trail = []; this.followCrouch = !!crouch; if (actor) this.a.crouch = !!crouch; }

  hit(by) {
    this.hits += 1;
    this.m.G.events.emit('campaign:extraHit', { id: this.id, by });
    for (const h of this.m.handlers) if (h.name === 'extra:hit') { try { h.fn({ id: this.id, by, extra: this }); } catch (err) { console.error(err); } }
    if (this.protect && by === this.m.G.player) this.m.fail(this.failText || 'Ein Zivilist wurde getroffen. Wir schießen nur, wenn wir sicher sind.');
  }

  update(dt, cam) {
    if (this.removed) return;
    const t = this.target;
    if (t && t.alive !== false) {
      const tp = t.vehicle ? t.vehicle.position : t.position;
      const last = this.trail[this.trail.length - 1];
      if (!last || last.distanceToSquared(tp) > 0.64) this.trail.push(tp.clone());
      if (this.trail.length > 400) this.trail.shift();
      const d = this.a.pos.distanceTo(tp);
      if (d > 2.6 && this.trail.length) {
        // nächster Krumen, der noch vor uns liegt (Abkürzungen nur bei freier Sicht)
        while (this.trail.length > 1 && this.trail[0].distanceToSquared(this.a.pos) < 0.5) this.trail.shift();
        if (d > 30) { this.a.place([tp.x, tp.y, tp.z], this.a.yaw); this.trail = []; } // abgehängt (Teleport/Wiedereinstieg)
        else this.a.walk([[this.trail[0].x, this.trail[0].z]], this.followCrouch ? (d > 8 ? 2.6 : 1.3) : d > 8 ? 3.6 : d > 4 ? 2.4 : 1.5);
      } else if (this.a.path) { this.a.path = null; this.a.faceTo(t); }
    }
    this.a.update(dt, cam);
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    try { this.m.G.scene.remove(this.a.soldier.root); } catch { /* */ }
    this.a.dispose();
  }
}
