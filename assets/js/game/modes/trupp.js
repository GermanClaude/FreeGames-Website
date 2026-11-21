// NULLPUNKT — Modus „Trupp“ (eigener, taktischer Großkampf; Nutzerwunsch 20.11.): JEDER Spieler führt seinen EIGENEN Trupp
// aus KI-Soldaten (Trupp-Typ mit 4–9 Mann, shared/trupp.data.js TRUPP_TYPES) und steuert einen davon; die anderen folgen ihm
// (Befehl „Mir folgen“, Befehlsrad wirkt nur auf den eigenen Trupp). Fällt der gesteuerte Soldat, übernimmt der Spieler nach
// 0,9 s den nächsten lebenden Kameraden (takeover; Taste „Soldat wechseln“ tauscht jederzeit mit einem lebenden). Erst wenn
// der ganze Trupp gefallen ist, wählt er auf der Einsatzkarte einen Trupp-Typ und setzt mit dem ganzen Trupp neu ein
// (_redeploySquad; Panzerbesatzung/Fahrzeugtrupp steigen in ein freies Fahrzeug am HQ). Weitere Trupps führt die KI.
// Dazu Front-Eroberung in Reihenfolge, Verstärkungstickets, Pionier-Bauaufträge, Sammelpunkte, Außenposten, Funk, ein
// optionaler Kommandant. Trupps: trupp-squads.js, Anzeige: ui/trupp-hud.js.
//
// Regeln (Kurzfassung):
//   • Frontlinie: Punkte zwischen den HQs (frontOrder, Kartendaten MAPS[id].trupp.order bzw. world.objectives.trupp, sonst die
//     Eroberungspunkte nach Lage). Team A hält zu Beginn den ersten, Team B den letzten Punkt. Einnehmbar ist für jede Seite
//     nur der nächste Punkt hinter der eigenen Kette (frontTargets); Verteidiger zählen an eigenen Punkten mit (umkämpft).
//   • Tickets: jeder eingesetzte Soldat −1 (Übernahme/Wiederbelebung kosten nichts), Punktverlust −6 % der Starttickets, wer alle Punkte hält,
//     lässt den Gegner ausbluten (1 Ticket je 2 s). 0 Tickets = verloren; Zeitende: mehr Tickets gewinnt.
//   • Bewusstlos statt sofort tot: 40 s kann ein Sanitäter (Verbandskasten) wiederbeleben – Spieler mit F, Sanitäter-Bots
//     laufen selbst hin (auch zu Bots). Wiedereinstieg frühestens nach respawnDelay (= „aufgeben“).
//   • Truppführer: Markierungen (Angriff/Verteidigen/Bewegen; „Feind gesichtet“ jeder), Bots des Trupps folgen ihnen;
//     Sammelpunkt (9 Einsätze, 60 s Abklingzeit, nicht nah an Gegnern/Feindpunkten, Gegner ≤ 12 m für 3 s → zerstört,
//     Gegner ≤ 30 m → gesperrt); Außenposten: Bunker (Bauen, K) eines Pioniers mit dem Truppführer ≤ 25 m bzw. umgekehrt.
//   • Kommandant (Lobby „Kommandant“: an): ein Mensch je Team (Truppmenü), gibt Trupps Ziele, ruft Artillerie (240 s) und
//     Luftschlag (300 s) auf das Fadenkreuz. Ohne Menschen ruft die KI selten Artillerie auf Feindansammlungen am Frontpunkt.
//   • Gepanzerte Fahrzeuge/Luftfahrzeuge: Fahrer- und Waffensitze nur für die Rolle Fahrer/Besatzung (Menschen; Bots frei).
//
// Mehrspieler: Der Host entscheidet alles. Clients schicken Anfragen { t: 'trupp', a, … } (net/sync-host.js → netRequest),
// der Zustand (Trupps, Rollen, Markierungen, Sammelpunkte, Außenposten, Kommandant, Abklingzeiten, Funk) reist im
// Modus-Zustand ('mode' s.tr, netExtra/applyNetExtra) zu allen Clients.
// Debug: spielen.html?debug=1&autostart=1&mode=trupp&map=grenzland&mopt=rolle:truppfuehrer,groesse:6 · Konsole: __game.mode
import * as THREE from 'three';
import { ConquestMode } from './conquest.js?v=20261121041936';
import { DomMode } from './dom.js?v=20261121041936';
import { TruppSquads } from './trupp-squads.js?v=20261121041936';
import { Strike, strikeResources, groundAt } from './strike.js?v=20261121041936';
import { issueCommand } from '../bots/ai/orders.js?v=20261121041936';
import { MAPS } from '../../shared/maps.data.js?v=20261121041936';
import { modeOptionValues, parseModeOptions } from '../../shared/modes.data.js?v=20261121041936';
import { WEAPONS, EQUIPMENT } from '../../shared/weapons.data.js?v=20261121041936';
import { CLASSES } from '../../shared/classes.data.js?v=20261121041936';
import {
  TRUPP_ROLES, TRUPP_DEFAULT_ROLE, TRUPP_MARKS, TRUPP_RADIO, TRUPP_SUPPORT, TRUPP_RALLY, TRUPP_OUTPOST, TRUPP_DOWN_TIME,
  TRUPP_LOSS_SHARE, TRUPP_SIZES, TRUPP_TYPES, TRUPP_TYPE_DEFAULT, TRUPP_BUILD_ORDERS, truppTickets, frontOrder, frontTargets,
} from '../../shared/trupp.data.js?v=20261121041936';

const _v = new THREE.Vector3();
const REQ_GAP = 0.2; // s zwischen zwei Anfragen eines Akteurs
const SAY_GAP = 1.4; // s zwischen zwei Funksprüchen
const RADIO_KEEP = 10; // Einträge im Modus-Zustand
const MEDIC_R = 50; // m: Sanitäter-Bots laufen so weit zu Bewusstlosen
const isHuman = (a) => !!(a && (a.isPlayer || a.isRemoteHuman));
const r2 = (v) => Math.round(v * 100) / 100;
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class TruppMode extends ConquestMode {
  constructor(G, modeId, opts = {}) {
    super(G, modeId, opts);
    this.options = modeOptionValues(modeId, this._rawOptions(G, opts));
    const size = TRUPP_SIZES.includes(Number(this.options.groesse)) ? Number(this.options.groesse) : 6;
    this.squads = new TruppSquads(G, this, size);
    this.trupp = true; // HUD/Eingabe (Touch-Knöpfe 'trupp')
    this.reviveWindow = TRUPP_DOWN_TIME; // injuries.js
    this.orderRadius = 800; // Befehlsrad: alle Bots des eigenen Trupps (bots/manager.js orderFilter)
    this.commandersOn = this.options.kommandant !== 'aus';
    this.marks = []; // { n, sq, team, kind, pos, target, until, by }
    this.rallies = new Map(); // Trupp-Id → { sq, team, pos, uses, enemyT, blocked, by, mesh }
    this._rallyReady = new Map(); // Trupp-Id → Zeitpunkt
    this.outposts = []; // { id, team, pos, enemyT, blocked, by, build }
    this.commander = { A: null, B: null };
    this.supportAt = { A: {}, B: {} }; // Team → { artillerie: bereit ab, luftschlag: … }
    this.barrages = []; // laufende Artillerie/Luftschläge (Host)
    this.supportMarks = []; // { team, kind, pos, until } – Anzeige der Einschlagzone
    this.radio = []; // { n, team, sq, from, msg, txt, pt, at }
    this._radioN = 0;
    this._markN = 0;
    this._reqAt = new Map();
    this._sayAt = new Map();
    this._netDeploy = new Map();
    this._medics = new Map(); // Sanitäter → Bewusstloser
    this._forced = undefined;
    this._aiCmdAt = 0;
    this._targets = { A: -1, B: -1 };
    this._strikeMgr = { G, resources: () => strikeResources(), _strikeImpact: () => {} };
    this._rallyMat = null;
    this.hud = null;
    this.lossTickets = 0;
    this._downAt = new Map(); // Mensch → Zeitpunkt des Falls (Übernahme eines Kameraden)
    this._jobs = new Map(); // Pionier-Bot → { k, pos, until, by }
    this._pendingType = new Map(); // Mensch → Trupp-Typ für den nächsten Einsatz
    this._swapAt = new Map();
    this._followAt = 0;
  }

  /** Trupp-Typ eines Menschen (gewählt bzw. für den nächsten Einsatz vorgemerkt). */
  typeOf(h) {
    const sq = h && this.squads.ownSquad ? this.squads.ownSquad(h) : null;
    return this._pendingType.get(h) || (sq && sq.type) || (this.squads.prefs.get(h) || {}).type || TRUPP_TYPE_DEFAULT;
  }

  /** Lobby (settings.modeOptions.trupp), online cfg.net.modeOpts, Prüfwerkzeuge ?mopt=. */
  _rawOptions(G, opts) {
    if (opts && opts.modeOpts) return opts.modeOpts;
    let raw = {};
    try { raw = { ...((G.settings.get('modeOptions') || {})[this.id] || {}) }; } catch { raw = {}; }
    const net = G.match && G.match.net;
    if (net && net.modeOpts) raw = { ...raw, ...net.modeOpts, rolle: raw.rolle, trupp: raw.trupp }; // Rolle/Trupp: eigene Wahl
    const url = G.params && typeof G.params.get === 'function' ? G.params.get('mopt') : null;
    return url ? { ...raw, ...parseModeOptions(url) } : raw;
  }

  /* ------------------------------------------------------------ Lebenszyklus */

  onAttach(s) {
    super.onAttach(s);
    const G = this.G;
    G.trupp = this;
    if (!this.replica) {
      s.on('build:done', (e) => this._onBuilt(e));
      s.on('kill', (e) => { if (e && e.victim) this._medics.forEach((v, m) => { if (m === e.victim || v === e.victim) this._medics.delete(m); }); });
    }
    if (G.player) this.squads.setPref(G.player, { type: TRUPP_TYPES[this.options.trupp] ? this.options.trupp : TRUPP_TYPE_DEFAULT });
    if (!this.replica) s.on('kill', (e) => { const v = e && e.victim; if (v && isHuman(v)) this._downAt.set(v, G.time.elapsed); });
    if (typeof document !== 'undefined' && G.hud) {
      import('../ui/trupp-hud.js?v=20261121041936').then(({ TruppHud }) => {
        if (G.mode !== this || this.hud) return;
        try { this.hud = new TruppHud(G, this); } catch (err) { console.error('[NULLPUNKT] Trupp-HUD:', err); }
      }).catch((err) => console.error('[NULLPUNKT] Trupp-HUD laden:', err));
    }
  }

  onDetach() {
    super.onDetach();
    const G = this.G;
    if (G.trupp === this) G.trupp = null;
    if (this.hud) { try { this.hud.dispose(); } catch { /* */ } this.hud = null; }
    for (const r of this.rallies.values()) this._dropMesh(r);
    this.rallies.clear();
    for (const b of this.barrages) if (b.strike) b.strike.dispose();
    this.barrages = [];
    this.marks = [];
    this._medics.clear();
  }

  onStart() {
    super.onStart();
    const G = this.G;
    const w = G.world;
    // Eigene Front-Punkte der Kartendatei (world.objectives.trupp) ersetzen die Eroberungspunkte
    const own = w && w.objectives && Array.isArray(w.objectives.trupp) && w.objectives.trupp.length >= 2 ? w.objectives.trupp : null;
    if (own) {
      this.objectives = own.map((f, i) => ({
        id: f.id || String.fromCharCode(65 + i), name: f.name || '', position: vec(f.position), radius: f.radius || 14,
        band: Array.isArray(f.heightBand) ? [f.heightBand[0], f.heightBand[1]] : [-3, 6],
        spawns: (f.spawns || []).map((p) => ({ position: vec(p.position), yaw: p.yaw || 0 })),
        owner: null, capturingTeam: null, progress: 0, control: 0, contested: false, counts: { A: 0, B: 0 }, present: [], lastOwner: null,
      }));
    }
    const def = MAPS[G.match && G.match.mapId];
    const order = def && def.trupp && Array.isArray(def.trupp.order) ? def.trupp.order : null;
    const hq = { A: this.hq.A && this.hq.A.position, B: this.hq.B && this.hq.B.position };
    this.objectives = frontOrder(this.objectives, hq, order);
    const n = this.objectives.length;
    if (n >= 2) {
      const a = this.objectives[0], b = this.objectives[n - 1];
      a.owner = 'A'; a.control = 1; a.progress = 1;
      b.owner = 'B'; b.control = -1; b.progress = 1;
    }
    // Tickets (Verstärkung)
    const side = Math.max(this._teamSize.A || 1, this._teamSize.B || 1);
    const mult = (this.def.matchLengths && this.def.matchLengths[this.matchLength]) || 1;
    const t = truppTickets(side, mult);
    this.scores = { A: t, B: t };
    this.ticketsMax = { A: t, B: t };
    this.scoreMax = t;
    this.lossTickets = Math.max(3, Math.round(t * TRUPP_LOSS_SHARE));
    G.events.emit('ticket', { team: 'A', value: t, reason: 'start' });
    G.events.emit('ticket', { team: 'B', value: t, reason: 'start' });
    const now = G.time.elapsed;
    for (const team of ['A', 'B']) for (const k of Object.keys(TRUPP_SUPPORT)) this.supportAt[team][k] = now + TRUPP_SUPPORT[k].first;
    this._targets = this._front();
    this._aiCmdAt = now + 60;
    // Spieler-Trupps: Bots tragen die Ausrüstung ihrer Rolle und folgen ihrem Menschen
    for (const sq of this.squads.list) if (sq.owner) for (const b of this.squads.members(sq)) if (!isHuman(b)) this._equipBot(b);
    this._followAt = 0;
    this._emit(true);
    this._say(null, null, { team: 'A', txt: `Front eröffnet: ${this._ptName(this._targets.A)} ist das nächste Ziel.` });
    this._say(null, null, { team: 'B', txt: `Front eröffnet: ${this._ptName(this._targets.B)} ist das nächste Ziel.` });
  }

  onMatchStart() {
    super.onMatchStart();
    // Client: Wunsch-Trupp/-Rolle beim Host anmelden
    if (this.replica) setTimeout(() => {
      if (this.G.mode !== this) return;
      const o = this.options;
      if (TRUPP_TYPES[o.trupp] && o.trupp !== TRUPP_TYPE_DEFAULT) this.request({ a: 'type', ty: o.trupp });
    }, 1500);
  }

  /* ------------------------------------------------------------ Front */

  _front() {
    return frontTargets(this.objectives.map((f) => f.owner));
  }

  /** Darf `team` an Punkt f einnehmen bzw. mitzählen? */
  touchable(team, f) {
    if (team !== 'A' && team !== 'B' || !f) return false;
    if (f.owner === team) return true;
    return this.objectives.indexOf(f) === this._targets[team];
  }

  _inZone(a, f) {
    if (this.objectives.length >= 2 && !this.touchable(a.team, f)) return false;
    return super._inZone(a, f);
  }

  _ptName(i) {
    const f = this.objectives[i];
    return f ? `${f.id}${f.name ? ` – ${f.name}` : ''}` : 'die Front';
  }

  /** Öffentliche Frontsicht fürs HUD: [{ id, name, owner, open: {A, B}, capturingTeam, progress, contested }]. */
  frontInfo() {
    const t = this._targets;
    return this.objectives.map((f, i) => ({ id: f.id, name: f.name || '', owner: f.owner, open: { A: t.A === i, B: t.B === i }, capturingTeam: f.capturingTeam, progress: f.progress, contested: f.contested, position: f.position }));
  }

  _neutralize(f, team) {
    const prev = f.owner;
    super._neutralize(f, team);
    if (prev && !this.isOver) {
      this.spendTicket(prev, this.lossTickets, 'front');
      this._say(null, null, { team: prev, txt: `${f.id}${f.name ? ` (${f.name})` : ''} verloren – Verstärkung −${this.lossTickets}.` });
    }
  }

  _capture(f, team) {
    super._capture(f, team);
    this._targets = this._front();
    this._say(null, null, { team, txt: `${f.id}${f.name ? ` (${f.name})` : ''} eingenommen. Nächstes Ziel: ${this._ptName(this._targets[team])}.` });
  }

  tick(dt, playing) {
    this._targets = this._front();
    DomMode.prototype.tick.call(this, dt, playing);
    if (!playing || this.isOver) return;
    const G = this.G;
    const now = G.time.elapsed;
    this._targets = this._front();
    // Ausbluten: alle Punkte in einer Hand
    const n = this.objectives.length;
    for (const team of ['A', 'B']) {
      const other = team === 'A' ? 'B' : 'A';
      const all = n >= 2 && this.objectives.every((f) => f.owner === other);
      if (!all) { this._bleed[team] = 0; continue; }
      this._bleed[team] += dt;
      while (this._bleed[team] >= 2 && !this.isOver) { this._bleed[team] -= 2; this.spendTicket(team, 1, 'bleed'); }
    }
    if (this.isOver) return;
    this._zones(dt);
    this._orders(now);
    if (now >= this._aiAt) { this._aiAt = now + 4; this._commander(now); }
    this._tickMarks(now);
    this._tickRallies(dt, now);
    this._tickOutposts(dt, now);
    this._tickMedics(now);
    this._tickSupport(dt, now);
    this._tickOwned(now);
    this._tickJobs(now);
  }

  /* ------------------------------------------------------------ Eigener Trupp: Übernahme, Folgen, Neueinsatz */

  /** Spieler-Trupps: gefallene Bots warten auf den Neueinsatz, Folgen-Befehl, Übernahme nach dem Fall des Menschen. */
  _tickOwned(now) {
    const G = this.G;
    if (now < (this._ownAt || 0)) return; // 5 Hz reicht (Massenschlacht: members() je Trupp)
    this._ownAt = now + 0.2;
    const follow = now >= this._followAt;
    if (follow) this._followAt = now + 3;
    for (const sq of this.squads.list) {
      const h = sq.owner;
      if (!h || !G.actors.includes(h)) continue;
      const mem = this.squads.members(sq);
      for (const b of mem) if (b !== h && !b.alive && b.respawnAt != null && !(G.injuries && G.injuries.down && G.injuries.down.has(b) && this._medicFor(b))) b.respawnAt = null;
      if (h.alive && follow) {
        const idle = mem.filter((b) => b !== h && b.alive && b.isBot && !b.puppet && !b.vehicle && !(b.command && b.command.by === h && now < b.command.until) && !this._jobs.has(b) && !this._medics.has(b));
        if (idle.length) { try { issueCommand(G, idle, h, 'follow', {}, now); } catch { /* Bot ohne Befehlsschicht */ } }
      }
      if (!h.alive) {
        const at = this._downAt.get(h);
        if (at == null || now - at < 0.9) continue;
        const alive = mem.filter((b) => b !== h && b.alive && !b._absorbed);
        if (!alive.length) { this._downAt.delete(h); continue; }
        const from = h.position;
        alive.sort((x, y) => x.position.distanceToSquared(from) - y.position.distanceToSquared(from));
        this._downAt.delete(h);
        this.takeover(h, alive[0], false);
      }
    }
  }

  _medicFor(v) {
    for (const [m, x] of this._medics) if (x === v && m.alive) return m;
    return null;
  }

  /**
   * Mensch übernimmt Soldat `b` seines Trupps. swap = beide leben (Taste „Soldat wechseln“): Plätze, Rollen, Ausrüstung
   * und Leben werden getauscht; sonst (Mensch gefallen) geht der Bot im Menschen auf. → Fehlertext | null
   */
  takeover(h, b, swap = false) {
    const G = this.G;
    if (!h || !b || b === h || !b.alive || b.squad !== h.squad) return 'Kein lebender Kamerad.';
    if (swap && (h.vehicle || h.piloting || h.mounted)) return 'Erst aussteigen.';
    const V = G.vehicles;
    const veh = b.vehicle || null;
    const seat = veh && typeof veh.seatOf === 'function' ? veh.seatOf(b) : -1;
    if (veh && swap) return 'Kamerad sitzt im Fahrzeug.';
    if (veh && V) { try { V.removeFromSeat(b, { teleport: false }); } catch { /* */ } }
    const pos = b.position.clone();
    const yaw = b.yaw || 0;
    const hp = b.health;
    const role = b.truppRole;
    const old = h.alive ? { pos: h.position.clone(), yaw: h.yaw || 0, hp: h.health, role: h.truppRole } : null;
    h.truppRole = role;
    if (swap && old) {
      b.truppRole = old.role;
      this._equipBot(b);
      if (b.body && typeof b.body.teleport === 'function') b.body.teleport(old.pos);
      b.yaw = old.yaw;
      b.health = Math.max(1, Math.min(b.maxHealth || 100, old.hp));
      if (b.command) b.command = null;
    } else {
      b._absorbed = true;
      b.alive = false;
      b.health = 0;
      b.respawnAt = null;
      if (b.soldier && typeof b.soldier.hide === 'function') b.soldier.hide();
      if (G.injuries && G.injuries.down) G.injuries.down.delete(b);
    }
    h._reviving = true;
    try { if (typeof G.spawnActor === 'function') G.spawnActor(h, { position: pos, yaw }); } finally { h._reviving = false; }
    if (h.alive) h.health = Math.max(25, Math.min(h.maxHealth || 100, hp));
    if (veh && veh.alive && V && seat >= 0) { try { V.enter(h, veh, seat); } catch { /* */ } }
    G.events.emit('trupp:switch', { actor: h, from: b, swap });
    if (h.isPlayer) this._notice(h, `Du führst jetzt ${b.name || 'deinen Kameraden'} (${(TRUPP_ROLES[role] || {}).name || 'Soldat'}).`);
    return null;
  }

  /** Bot eines Spieler-Trupps: Ausrüstung seiner Rolle. */
  _equipBot(b) {
    if (!b || isHuman(b) || !b.truppRole) return;
    const lo = roleLoadout(b.truppRole, b.loadout || {});
    const cur = b.loadout || {};
    b.loadout = { ...cur, ...lo };
    if (CLASSES[lo.cls]) { b.cls = lo.cls; b.classDef = CLASSES[lo.cls]; }
    if ((cur.primary !== lo.primary || cur.secondary !== lo.secondary) && b.weapon && typeof b.weapon.setLoadout === 'function') {
      try { b.weapon.setLoadout(b.loadout); if (typeof b._syncGun === 'function') b._syncGun(true); } catch (err) { console.error('[NULLPUNKT] Trupp-Bot setLoadout:', err); }
    }
  }

  /** Neueinsatz des ganzen Trupps beim Menschen (nach dessen regulärem Einsatz): gefallene Soldaten kommen mit. */
  _redeploySquad(h) {
    const G = this.G;
    let sq = this.squads.ownSquad(h);
    if (!sq) return;
    const want = this._pendingType.get(h);
    if (want && want !== sq.type) this.squads.retype(sq, want);
    this._pendingType.delete(h);
    if (TRUPP_TYPES[sq.type] && h.truppRole !== TRUPP_TYPES[sq.type].roles[0]) this.squads._typeRoles(sq);
    // Rolle kann sich gerade erst geändert haben (Typwechsel): Ausrüstung des Menschen sofort nachziehen
    const hlo = roleLoadout(h.truppRole, h.loadout || {});
    if (!h.loadout || hlo.primary !== h.loadout.primary || hlo.secondary !== h.loadout.secondary || hlo.cls !== h.loadout.cls) {
      if (h.isRemoteHuman && typeof h.setNetLoadout === 'function') h.setNetLoadout(hlo);
      else {
        h.loadout = hlo; h.cls = hlo.cls; h.classDef = CLASSES[hlo.cls] || h.classDef;
        if (h.weapon && typeof h.weapon.setLoadout === 'function') { try { h.weapon.setLoadout(h.loadout); } catch (err) { console.error('[NULLPUNKT] Trupp setLoadout:', err); } }
        if (typeof h.applyClass === 'function') { try { h.applyClass(); } catch { /* */ } }
      }
    }
    const type = TRUPP_TYPES[sq.type] || TRUPP_TYPES[TRUPP_TYPE_DEFAULT];
    const bots = this.squads.members(sq).filter((b) => b !== h && !b.alive);
    let veh = type.vehicle ? this._squadVehicle(h, type.vehicle, bots.length + 1) : null;
    if (type.vehicle && !veh) this._notice(h, `Kein freies ${type.vehicle === 'panzer' ? 'Kampffahrzeug' : 'Fahrzeug'} am HQ – der Trupp setzt zu Fuß ein.`);
    const yaw = h.yaw || 0;
    bots.forEach((b, i) => {
      if (this.isOver) return;
      b._absorbed = false;
      this._equipBot(b);
      const a = yaw + Math.PI + (i - (bots.length - 1) / 2) * 0.55;
      const r = 1.6 + (i % 3) * 0.9;
      const p = h.position.clone().add(new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r));
      if (G.world && typeof G.world.groundHeight === 'function') { const gy = G.world.groundHeight(p.x, p.z, h.position.y + 1.5); if (gy != null && Math.abs(gy - h.position.y) < 1.2) p.y = gy; else p.copy(h.position); }
      b._reviving = true;
      try { G.spawnActor(b, { position: p, yaw }); } finally { b._reviving = false; }
      this.spendTicket(h.team, 1, 'respawn');
    });
    if (veh && G.vehicles) {
      const V = G.vehicles;
      const seats = this._seatPlan(veh);
      const crew = [h, ...bots.filter((b) => b.alive)];
      crew.forEach((a, i) => { const idx = seats[i]; if (idx != null && !veh.seats[idx].actor) { try { V.enter(a, veh, idx); } catch { /* */ } } });
    }
    this._followAt = 0;
  }

  /** Freies Fahrzeug des Teams am HQ: 'panzer' = gepanzert mit Kanone, 'transport' = die meisten Sitze (kein Luftfahrzeug). */
  _squadVehicle(h, kind, n) {
    const V = this.G.vehicles;
    const hq = this.hq[h.team] && this.hq[h.team].position;
    if (!V || !Array.isArray(V.list)) return null;
    const cand = V.list.filter((v) => v.alive && !v.wreck && (v.team || v.spawnTeam) === h.team && !(v.seats || []).some((s) => s.actor) && !(v.def && (v.def.air || v.isAircraft))
      && (!hq || flat(v.position, hq) < 160));
    const gun = (v) => (v.seats || []).some((s) => s.def && Array.isArray(s.def.weapons) && s.def.weapons.some((w) => /_ap$|_he$|kanone|gun/.test(w)));
    if (kind === 'panzer') return cand.filter((v) => v.def && v.def.armored && gun(v)).sort((x, y) => flat(x.position, h.position) - flat(y.position, h.position))[0] || null;
    return cand.filter((v) => (v.seats || []).length >= Math.min(4, n)).sort((x, y) => (y.seats.length - x.seats.length) || (flat(x.position, h.position) - flat(y.position, h.position)))[0] || null;
  }

  /** Sitzreihenfolge: Mensch an die Hauptwaffe (sonst Fahrer), dann Fahrer, weitere Waffen, Mitfahrer. */
  _seatPlan(v) {
    const seats = (v.seats || []).map((s, i) => ({ i, d: s.def || {} }));
    const gunS = seats.filter((s) => Array.isArray(s.d.weapons) && s.d.weapons.length);
    const drive = seats.filter((s) => s.d.drive);
    const rest = seats.filter((s) => !gunS.includes(s) && !drive.includes(s));
    const first = gunS[0] || drive[0] || seats[0];
    const order = [first, ...drive, ...gunS, ...rest].filter((s, k, arr) => s && arr.indexOf(s) === k);
    return order.map((s) => s.i);
  }

  /* ------------------------------------------------------------ Bauaufträge an den Pionier */

  _orderBuild(h, k, pos) {
    const G = this.G;
    const sq = this.squads.ownSquad(h);
    if (!sq) return 'Kein eigener Trupp.';
    if (!pos || pos.distanceTo(h.position) > 60) return 'Zu weit weg (höchstens 60 m).';
    const pio = this.squads.members(sq, { alive: true }).filter((b) => b.isBot && !b.puppet && b.truppRole === 'pionier' && !b.vehicle)
      .sort((x, y) => x.position.distanceToSquared(pos) - y.position.distanceToSquared(pos))[0];
    if (!pio) return 'Kein Pionier im Trupp.';
    if (k !== 'sammelpunkt' && !(G.building && this.buildAllowed(pio, k))) return 'Das kann der Pionier nicht bauen.';
    const now = G.time.elapsed;
    this._jobs.set(pio, { k, pos: pos.clone(), until: now + 60, by: h, at: now });
    try { issueCommand(G, [pio], h, 'defend', { point: pos.clone() }, now); } catch { /* */ }
    const nm = (TRUPP_BUILD_ORDERS.find((x) => x.id === k) || { name: 'Schützenloch' }).name;
    this._pushRadio({ team: h.team, sq: sq.id, from: pio, msg: '', txt: `${pio.name || 'Pionier'}: Verstanden – ${nm}.` });
    return null;
  }

  _tickJobs(now) {
    const G = this.G;
    for (const [b, j] of this._jobs) {
      if (!b.alive || now > j.until || !b.squad) { if (j.by && now > j.until) this._notice(j.by, 'Bauauftrag abgebrochen – Pionier kam nicht hin.'); this._jobs.delete(b); continue; }
      // Am Ziel: „Verteidigen“ stellt den Bot nur ungefähr an den Punkt (Ring um ihn) – bis 6 m reicht,
      // nach 15 s auch 14 m (verstellter Weg); immer erst nach einem kurzen Halt (Werkzeug ziehen)
      const d = flat(b.position, j.pos);
      if (!(d <= 6 || (now - j.at > 15 && d <= 14))) continue;
      if (now - j.at < 1.5) continue;
      this._jobs.delete(b);
      if (j.k === 'sammelpunkt') { const err = this._placeRally(b, j.pos, true); if (err) this._notice(j.by, err); continue; }
      const B = G.building;
      if (!B || typeof B.spawn !== 'function') continue;
      const y = groundAt(G.world, j.pos.x, j.pos.z, j.pos.y + 2);
      const ry = Math.atan2(j.pos.x - j.by.position.x, j.pos.z - j.by.position.z);
      const p = new THREE.Vector3(j.pos.x, y, j.pos.z);
      const probe = { position: new THREE.Vector3(p.x, p.y, p.z), cls: b.cls, loadout: b.loadout, truppRole: b.truppRole, team: b.team };
      if (typeof B._valid === 'function' && !B._valid(j.k, p, probe)) { this._notice(j.by, 'Kein Platz zum Bauen – anderen Punkt wählen.'); continue; }
      try { B.spawn({ k: j.k, x: p.x, y: p.y, z: p.z, ry, owner: b }); } catch (err) { console.error('[NULLPUNKT] Trupp-Bauauftrag:', err); }
      if (b.command) b.command = null;
    }
  }

  replicaTick(dt) {
    super.replicaTick(dt);
    const now = this.G.time.elapsed;
    this.marks = this.marks.filter((m) => m.until > now);
    this.supportMarks = this.supportMarks.filter((m) => m.until > now);
    this._targets = this._front();
  }

  /* ------------------------------------------------------------ KI-Teamhirn (Front) */

  _commander(now) {
    for (const team of ['A', 'B']) {
      const ti = this._targets[team];
      const atk = this.objectives[ti] || null;
      const ownIdx = team === 'A' ? ti - 1 : ti + 1;
      const own = ti < 0 ? (team === 'A' ? this.objectives[this.objectives.length - 1] : this.objectives[0]) : this.objectives[ownIdx] || null;
      const ownFront = own && own.owner === team ? own : null;
      const threatened = ownFront && (ownFront.contested || (ownFront.capturingTeam && ownFront.capturingTeam !== team));
      const squads = this.squads.teamList(team);
      let k = 0;
      for (const sq of squads) {
        if (sq.owner) continue; // Spieler-Trupp: Bots folgen ihrem Menschen
        k++;
        if (sq.order && sq.order.cmd && now - sq.order.at < 150) continue; // Ziel des Kommandanten
        if (sq.order && now - sq.order.at < 25 && !this._orderStale(sq)) continue;
        let target = atk;
        let kind = 'attack';
        const defendShare = threatened ? 0.5 : 0.22;
        if (ownFront && (!atk || (k / Math.max(1, squads.length)) <= defendShare)) { target = ownFront; kind = 'defend'; }
        if (!target) continue;
        if (sq.order && sq.order.objectiveId === target.id && sq.order.kind === kind) continue;
        sq._done = false;
        this.squads.order(sq, { kind, objectiveId: target.id }, sq.leader);
        // Truppführer-Bot meldet das neue Ziel auf dem Truppfunk
        if (sq.leader && !isHuman(sq.leader) && this.squads.members(sq).some(isHuman)) {
          this._say(sq.leader, null, { team, sq: sq.id, txt: kind === 'defend' ? `Wir halten ${target.id}${target.name ? ` (${target.name})` : ''}.` : `Wir greifen ${target.id}${target.name ? ` (${target.name})` : ''} an.` });
        }
      }
    }
  }

  _orderStale(sq) {
    const f = this.objectives.find((x) => x.id === sq.order.objectiveId);
    if (!f) return true;
    if (sq.order.kind === 'attack') return f.owner === sq.team && !f.contested || !this.touchable(sq.team, f);
    return f.owner !== sq.team;
  }

  /** Spieler/Truppführer: Trupp-Befehl auf einen Punkt (Taste „Trupp-Befehl“, Einsatzkarte) – setzt auch die Markierung. */
  squadOrder(objectiveId, by = this.G.player) {
    const sq = by && by.squad;
    const f = this.objectives.find((x) => x.id === objectiveId);
    if (!sq || !f) return null;
    if (sq.leader !== by && this.commander[by.team] !== by) { this._notice(by, 'Nur der Truppführer gibt Trupp-Befehle.'); return null; }
    if (this.replica) { this.request({ a: 'obj', sq: sq.id, f: f.id }); return { kind: f.owner === sq.team ? 'defend' : 'attack', objectiveId: f.id }; }
    return this._setObjective(by, sq, f);
  }

  _setObjective(by, sq, f) {
    const kind = f.owner === sq.team ? 'defend' : 'attack';
    sq._done = false;
    this.squads.order(sq, { kind, objectiveId: f.id, label: `${kind === 'defend' ? 'Verteidigt' : 'Angriff auf'} ${f.id}${f.name ? ` – ${f.name}` : ''}` }, by);
    if (this.commander[sq.team] === by && sq.leader !== by) sq.order.cmd = true;
    if (sq.leader === by) this._mark(by, kind === 'defend' ? 'verteidigen' : 'angriff', f.position.clone(), null);
    if (this.commander[sq.team] === by && sq.leader !== by) this._say(by, null, { team: sq.team, sq: sq.id, txt: `Kommandant an ${sq.name}: ${kind === 'defend' ? 'Verteidigt' : 'Angriff auf'} ${f.id}.` });
    return sq.order;
  }

  objectiveFor(bot) {
    if (!bot || (bot.team !== 'A' && bot.team !== 'B') || !this.objectives.length) return null;
    const sq = this.squads.of(bot);
    let f = null;
    let kind = 'capture';
    const o = sq && sq.order;
    if (o) {
      const g = this.objectives.find((x) => x.id === o.objectiveId);
      if (g && (g.owner === bot.team || this.touchable(bot.team, g))) { f = g; kind = o.kind === 'defend' || g.owner === bot.team ? 'defend' : 'capture'; }
    }
    if (!f) {
      f = this.objectives[this._targets[bot.team]] || null;
      if (!f) return null;
    }
    const now = this.G.time.elapsed;
    const cur = this._assign.get(bot);
    if (cur && cur.id === f.id && now < cur.until) return { id: f.id, position: cur.point, radius: f.radius, kind };
    const ang = Math.random() * Math.PI * 2;
    const r = Math.random() * f.radius * 0.6;
    const point = f.position.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
    this._assign.set(bot, { id: f.id, point, kind, until: now + 8 + Math.random() * 6 });
    return { id: f.id, position: point, radius: f.radius, kind };
  }

  /** Befehlsrad (bots/manager.js): nur der Truppführer befiehlt – und nur die Bots seines Trupps. */
  orderFilter(leader) {
    const sq = leader && leader.squad;
    if (!sq) return () => false;
    if (sq.leader !== leader) return () => false;
    return (b) => b.squad === sq;
  }

  /* ------------------------------------------------------------ Rollen und Ausrüstung */

  /** main.js spawnActor (vor equipActor): Ausrüstung der Rolle für Menschen. */
  beforeSpawn(actor) {
    if (!actor || (actor.team !== 'A' && actor.team !== 'B')) return;
    if (!isHuman(actor)) { if (!this.replica && actor.squad && actor.squad.owner) this._equipBot(actor); return; }
    if (this.replica && !actor.isPlayer) return;
    if (!this.replica) this.squads.of(actor);
    // Neueinsatz des ganzen Trupps: vorgemerkten Trupp-Typ schon vor dem Spawn anwenden (Rolle → Ausrüstung)
    if (!this.replica && !actor._reviving && this.started) {
      const own = this.squads.ownSquad(actor);
      const want = this._pendingType.get(actor);
      if (own && want && !this.squads.members(own, { alive: true }).length) { this.squads.retype(own, want); this._pendingType.delete(actor); }
    }
    const role = actor.truppRole || (this.squads.prefs.get(actor) || {}).role || TRUPP_DEFAULT_ROLE;
    const lo = roleLoadout(role, actor.loadout || {});
    if (actor.isRemoteHuman && typeof actor.setNetLoadout === 'function') { actor.setNetLoadout(lo); return; }
    actor.loadout = lo;
    actor.cls = lo.cls;
    if (actor.weapon && typeof actor.weapon.setLoadout === 'function') {
      try { actor.weapon.setLoadout(actor.loadout); } catch (err) { console.error('[NULLPUNKT] Trupp setLoadout:', err); }
    }
  }

  /** Anti-Cheat des Hosts: Waffen der Rolle eines Clients. */
  netWeaponsOf(actor) {
    const lo = actor && actor.loadout;
    return lo ? [lo.primary, lo.secondary].filter(Boolean) : [];
  }

  /** building.js: Bauwerke je Rolle. */
  buildAllowed(actor, k) {
    if (!actor || (actor.team !== 'A' && actor.team !== 'B')) return null;
    const role = actor.truppRole || TRUPP_DEFAULT_ROLE;
    const r = TRUPP_ROLES[role];
    if (!r || !r.build.includes(k)) return false;
    if (k === 'bunker' && role === 'truppfuehrer') return !!this._pionierNear(actor);
    return true;
  }

  _pionierNear(leader) {
    const sq = leader.squad;
    if (!sq) return null;
    return this.squads.members(sq, { alive: true }).find((m) => m !== leader && m.truppRole === 'pionier' && flat(m.position, leader.position) <= TRUPP_OUTPOST.leaderR) || null;
  }

  /** vehicles/index.js: Sitz für einen Akteur (−1 = nicht erlaubt). Gepanzert/Luft: Fahrer- und Waffensitze nur Besatzung. */
  vehicleSeatFor(actor, v, want, idx) {
    if (!actor || !v || !isHuman(actor)) return idx;
    const def = v.def || {};
    if (!(def.armored || def.air || v.isAircraft)) return idx;
    if (actor.truppRole === 'besatzung') return idx;
    const crewSeat = (s) => !!(s && s.def && (s.def.drive || (Array.isArray(s.def.weapons) && s.def.weapons.length)));
    if (want != null && want >= 0) {
      if (crewSeat(v.seats[want])) { this._notice(actor, 'Nur die Rolle Fahrer/Besatzung bedient dieses Fahrzeug.'); return -1; }
      return idx;
    }
    if (!crewSeat(v.seats[idx])) return idx;
    const free = v.seats.findIndex((s) => !s.actor && !crewSeat(s));
    if (free < 0) this._notice(actor, 'Nur die Rolle Fahrer/Besatzung bedient dieses Fahrzeug – kein Mitfahrerplatz frei.');
    return free;
  }

  /* ------------------------------------------------------------ Anfragen (lokal bzw. vom Client über den Host) */

  /** HUD/Eingabe: Aktion des eigenen Spielers (Client: an den Host). */
  request(m) {
    const G = this.G;
    if (!m || typeof m.a !== 'string') return null;
    if (this.replica) {
      if (G.net && typeof G.net.send === 'function') G.net.send(1, { t: 'trupp', ...m });
      return null;
    }
    return this.netRequest(G.player, m, true);
  }

  /** Host: Anfrage eines Akteurs prüfen und ausführen. → Fehlertext | null */
  netRequest(actor, m, local = false) {
    const G = this.G;
    if (!actor || !m || typeof m.a !== 'string' || this.isOver || this.replica) return 'Nicht möglich.';
    if (actor.team !== 'A' && actor.team !== 'B') return 'Kein Team.';
    const t = typeof performance !== 'undefined' ? performance.now() / 1000 : G.time.elapsed;
    if (!local && t - (this._reqAt.get(actor) || -1e9) < REQ_GAP) return 'Zu schnell.';
    this._reqAt.set(actor, t);
    const S = this.squads;
    const vecOf = (p) => (Array.isArray(p) && p.length === 3 && p.every(Number.isFinite) ? new THREE.Vector3(p[0], p[1], p[2]) : null);
    let err = null;
    switch (m.a) {
      case 'join': {
        if (!this.started) { S.setPref(actor, { squad: String(m.sq || 'auto').slice(0, 24) }); return null; }
        if (m.sq === 'neu') { S.create(actor); break; }
        const sq = S.byId(String(m.sq)) || S.teamList(actor.team).find((s) => s.name === m.sq);
        err = sq ? S.join(actor, sq) : 'Trupp nicht gefunden.';
        break;
      }
      case 'leave': S.leave(actor); break;
      case 'role': {
        const r = String(m.r || '');
        if (!TRUPP_ROLES[r]) { err = 'Unbekannte Rolle.'; break; }
        S.setPref(actor, { role: r });
        if (!this.started) return null;
        err = S.setRole(actor, r);
        if (!err && actor.alive) this._notice(actor, `Rolle ${TRUPP_ROLES[r].name} – Ausrüstung ab dem nächsten Einsatz.`);
        break;
      }
      case 'type': {
        const ty = String(m.ty || '');
        if (!TRUPP_TYPES[ty]) { err = 'Unbekannter Trupp-Typ.'; break; }
        S.setPref(actor, { type: ty });
        if (!this.started) return null;
        this._pendingType.set(actor, ty);
        const own = S.ownSquad(actor);
        const anyAlive = own && S.members(own, { alive: true }).length > 0;
        if (own && !anyAlive) { S.retype(own, ty); this._pendingType.delete(actor); }
        if (actor.isPlayer) this._notice(actor, `${TRUPP_TYPES[ty].name}${anyAlive ? ' – gilt beim nächsten Einsatz des Trupps.' : ' gewählt.'}`);
        return null;
      }
      case 'swap': {
        const own = S.ownSquad(actor);
        if (!own || !actor.alive) { err = 'Nicht möglich.'; break; }
        const tnow = G.time.elapsed;
        if (tnow - (this._swapAt.get(actor) || -1e9) < 1.5) return null;
        this._swapAt.set(actor, tnow);
        const alive = S.members(own, { alive: true }).filter((b) => b !== actor && !b.vehicle);
        let tg = Number.isInteger(m.id) || (m.id && typeof m.id === 'object') ? this._actorByNet(m.id) : null;
        if (!tg || !alive.includes(tg)) {
          const mem = S.members(own);
          const i = mem.indexOf(actor);
          tg = null;
          for (let k = 1; k <= mem.length && !tg; k++) { const c = mem[(i + k) % mem.length]; if (alive.includes(c)) tg = c; }
        }
        err = tg ? this.takeover(actor, tg, true) : 'Kein Kamerad zum Wechseln.';
        break;
      }
      case 'bau': {
        const k = String(m.k || '');
        if (!['sandsack', 'mulde', 'mgnest', 'bunker', 'sammelpunkt'].includes(k)) { err = 'Unbekanntes Bauwerk.'; break; }
        err = this._orderBuild(actor, k, vecOf(m.p));
        break;
      }
      case 'waffe': {
        const own = S.ownSquad(actor);
        const a = this._actorByNet(m.id);
        const w = String(m.w || '');
        const r = a && TRUPP_ROLES[a.truppRole];
        if (!own || !a || a.squad !== own || !r || !WEAPONS[w] || WEAPONS[w].og || WEAPONS[w].slot !== 'primary' || !r.weapons.includes(WEAPONS[w].cls)) { err = 'Diese Waffe passt nicht zur Rolle.'; break; }
        a.loadout = { ...(a.loadout || {}), primary: w };
        if (!isHuman(a) && a.alive) this._equipBot(a);
        if (actor.isPlayer) this._notice(actor, `${a.name || 'Soldat'}: ${WEAPONS[w].name || w}${a === actor ? ' – ab dem nächsten Einsatz' : ''}.`);
        return null;
      }
      case 'lead': err = S.takeLead(actor); break;
      case 'promote': err = S.promote(actor, this._actorByNet(m.id)); break;
      case 'lock': err = S.lock(actor); break;
      case 'mark': {
        const kind = String(m.k || '');
        const pos = vecOf(m.p);
        if (!TRUPP_MARKS[kind] || !pos) { err = 'Ungültige Markierung.'; break; }
        if (pos.distanceTo(actor.position) > 600) { err = 'Zu weit.'; break; }
        err = this._mark(actor, kind, pos, this._actorByNet(Number.isInteger(m.tg) ? m.tg : m.tgA));
        break;
      }
      case 'clr': err = this._clearMarks(actor); break;
      case 'rally': err = this._placeRally(actor); break;
      case 'say': err = this._say(actor, String(m.m || '')); break;
      case 'cmd': err = this._claimCommander(actor); break;
      case 'obj': {
        const sq = S.byId(String(m.sq));
        const f = this.objectives.find((x) => x.id === m.f);
        if (!sq || !f || sq.team !== actor.team) { err = 'Ungültig.'; break; }
        if (sq.leader !== actor && this.commander[actor.team] !== actor) { err = 'Nur Truppführer oder Kommandant.'; break; }
        this._setObjective(actor, sq, f);
        break;
      }
      case 'sup': err = this._support(actor, String(m.k || ''), vecOf(m.p)); break;
      case 'dp': this._netDeploy.set(actor, m.k ? { kind: String(m.k).slice(0, 12), id: String(m.id ?? '').slice(0, 24) } : null); return null;
      default: err = 'Unbekannte Aktion.';
    }
    if (err) this._notice(actor, err);
    return err;
  }

  _actorByNet(id) {
    const G = this.G;
    if (id && typeof id === 'object') return G.actors.includes(id) ? id : null; // lokal: Akteur direkt
    if (!Number.isInteger(id)) return null;
    if (G.net && typeof G.net.actorById === 'function') { const a = G.net.actorById(id); if (a) return a; }
    return G.actors.find((a) => a.netId === id) || null;
  }

  /** Hinweis an einen Akteur (lokal: HUD; Client-Puppe: über den Funk als privater Eintrag). */
  _notice(actor, text) {
    if (!actor || !text) return;
    if (actor.isPlayer) this.G.events.emit('trupp:notice', { text });
    else if (actor.isRemoteHuman && !this.replica) this._pushRadio({ team: actor.team, sq: null, from: null, msg: '', txt: text, to: actor });
  }

  /* ------------------------------------------------------------ Markierungen */

  _mark(actor, kind, pos, target) {
    const def = TRUPP_MARKS[kind];
    const sq = actor.squad;
    if (!def || !sq) return 'Kein Trupp.';
    if (def.leader && sq.leader !== actor) return 'Nur der Truppführer setzt diese Markierung.';
    const now = this.G.time.elapsed;
    const mine = this.marks.filter((m) => m.sq === sq && m.kind === kind);
    while (mine.length >= def.max) { const old = mine.shift(); this.marks.splice(this.marks.indexOf(old), 1); }
    if (target && (!target.alive || !this.G.combat || !this.G.combat.isHostile(actor, target))) target = null;
    const m = { n: ++this._markN, sq, team: sq.team, kind, pos: pos.clone(), target, until: now + def.life, by: actor };
    this.marks.push(m);
    // Bots des Trupps folgen den Markierungen des Truppführers
    if (def.order && sq.leader === actor) {
      const bots = this.squads.members(sq, { alive: true }).filter((b) => b.isBot && !b.puppet && !b.isRemoteHuman && !b.vehicle);
      if (bots.length) { try { issueCommand(this.G, bots, actor, def.order, { point: pos.clone(), target }, now); } catch (err) { console.error('[NULLPUNKT] Trupp-Befehl:', err); } }
    }
    if (kind === 'feind') this._say(actor, null, { team: sq.team, sq: sq.id, txt: target ? `Feind gesichtet${target.vehicle ? ' (Fahrzeug)' : ''}!` : 'Feind gesichtet!' });
    else this._say(actor, null, { team: sq.team, sq: sq.id, txt: `Markierung: ${def.name}.` });
    return null;
  }

  _clearMarks(actor) {
    const sq = actor.squad;
    if (!sq || sq.leader !== actor) return 'Nur der Truppführer.';
    this.marks = this.marks.filter((m) => m.sq !== sq);
    const bots = this.squads.members(sq, { alive: true }).filter((b) => b.isBot && !b.puppet && b.command && b.command.by === actor);
    if (bots.length) { try { issueCommand(this.G, bots, actor, 'free', {}, this.G.time.elapsed); } catch { /* */ } }
    return null;
  }

  _tickMarks(now) {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      if (m.target) { if (m.target.alive) m.pos.copy(m.target.position); else m.until = Math.min(m.until, now + 2); }
      if (now >= m.until || !this.squads.list.includes(m.sq)) this.marks.splice(i, 1);
    }
  }

  /* ------------------------------------------------------------ Sammelpunkt */

  _placeRally(actor, at = null, byOrder = false) {
    const G = this.G;
    const sq = actor.squad;
    const now = G.time.elapsed;
    if (!sq || (sq.leader !== actor && !byOrder)) return 'Nur der Truppführer bzw. sein Pionier setzt den Sammelpunkt.';
    if (!actor.alive || actor.vehicle) return 'Nicht im Fahrzeug.';
    const ready = this._rallyReady.get(sq.id) || 0;
    if (now < ready) return `Sammelpunkt erst in ${Math.ceil(ready - now)} s wieder möglich.`;
    for (const a of G.actors) if (a.alive && G.combat && G.combat.isHostile(actor, a) && a.position.distanceTo(actor.position) < TRUPP_RALLY.blockR) return 'Gegner zu nah.';
    for (const f of this.objectives) if (f.owner && f.owner !== actor.team && flat(f.position, actor.position) < TRUPP_RALLY.minFromEnemyPoint) return 'Zu nah an einem feindlichen Punkt.';
    const old = this.rallies.get(sq.id);
    if (old) this._dropMesh(old);
    const pos = (at || actor.position).clone();
    const r = { sq, team: sq.team, pos, uses: TRUPP_RALLY.uses, enemyT: 0, blocked: false, by: actor, mesh: null, at: now };
    this.rallies.set(sq.id, r);
    this._rallyReady.set(sq.id, now + TRUPP_RALLY.cooldown);
    this._addMesh(r);
    this._say(actor, null, { team: sq.team, sq: sq.id, txt: 'Sammelpunkt gesetzt.' });
    return null;
  }

  _tickRallies(dt, now) {
    const G = this.G;
    for (const [id, r] of this.rallies) {
      let enemyNear = 0;
      let blocked = false;
      for (const a of G.actors) {
        if (!a.alive || (a.team !== 'A' && a.team !== 'B') || a.team === r.team || a.isStreakEntity) continue;
        const d = a.position.distanceTo(r.pos);
        if (d < TRUPP_RALLY.overrunR) enemyNear++;
        if (d < TRUPP_RALLY.blockR) blocked = true;
      }
      r.blocked = blocked;
      r.enemyT = enemyNear ? r.enemyT + dt : 0;
      const gone = !this.squads.list.includes(r.sq);
      if (r.enemyT >= TRUPP_RALLY.overrunT || r.uses <= 0 || gone) {
        this._dropMesh(r);
        this.rallies.delete(id);
        if (!gone) this._say(null, null, { team: r.team, sq: id, txt: r.uses <= 0 ? 'Sammelpunkt aufgebraucht.' : 'Sammelpunkt überrannt!' });
        this._rallyReady.set(id, Math.max(this._rallyReady.get(id) || 0, now + TRUPP_RALLY.cooldown * 0.5));
      }
    }
  }

  _rallyMeshParts() {
    if (this._rallyParts) return this._rallyParts;
    const box = new THREE.BoxGeometry(0.55, 0.34, 0.38).translate(0, 0.17, 0);
    const pole = new THREE.CylinderGeometry(0.012, 0.012, 1.6, 5).translate(0.2, 0.95, 0.1);
    const flag = new THREE.PlaneGeometry(0.36, 0.22).translate(0.38, 1.6, 0.1);
    const crate = new THREE.MeshStandardMaterial({ color: 0x4b5138, roughness: 0.85, metalness: 0.05 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x2c2d2a, roughness: 0.5, metalness: 0.6 });
    this._rallyParts = { box, pole, flag, crate, metal };
    return this._rallyParts;
  }

  _addMesh(r) {
    const G = this.G;
    if (!G.scene || typeof document === 'undefined') return;
    const P = this._rallyMeshParts();
    const g = new THREE.Group();
    g.name = 'trupp-sammelpunkt';
    const flagMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(r.sq && r.sq.color ? r.sq.color : '#57d68d'), roughness: 0.8, side: THREE.DoubleSide });
    g.add(new THREE.Mesh(P.box, P.crate), new THREE.Mesh(P.pole, P.metal), new THREE.Mesh(P.flag, flagMat));
    g.position.copy(r.pos);
    g.userData.flagMat = flagMat;
    G.scene.add(g);
    r.mesh = g;
  }

  _dropMesh(r) {
    if (!r || !r.mesh) return;
    r.mesh.removeFromParent();
    if (r.mesh.userData.flagMat) r.mesh.userData.flagMat.dispose();
    r.mesh = null;
  }

  /* ------------------------------------------------------------ Außenposten */

  _onBuilt(e) {
    if (!e || e.kind !== 'bunker' || !e.actor) return;
    const a = e.actor;
    const sq = a.squad;
    if (!sq || (a.team !== 'A' && a.team !== 'B')) return;
    const role = a.truppRole;
    const ok = (role === 'pionier' && sq.owner)
      || (role === 'pionier' && sq.leader && sq.leader.alive && sq.leader !== a && flat(sq.leader.position, a.position) <= TRUPP_OUTPOST.leaderR)
      || (role === 'truppfuehrer' && this._pionierNear(a));
    const B = this.G.building;
    const s = B && B.list.find((x) => x.id === e.id);
    if (!ok || !s) { if (a.isPlayer && role === 'pionier') this._notice(a, 'Bunker gebaut – Außenposten nur mit dem Truppführer in der Nähe.'); return; }
    const mine = this.outposts.filter((o) => o.team === a.team);
    while (mine.length >= TRUPP_OUTPOST.max) { const old = mine.shift(); this.outposts.splice(this.outposts.indexOf(old), 1); }
    this.outposts.push({ id: e.id, team: a.team, pos: new THREE.Vector3(s.x, s.y, s.z), enemyT: 0, blocked: false, by: a, sq: sq.id });
    this._say(a, null, { team: a.team, txt: `Außenposten von ${sq.name} errichtet.` });
    if (a.stats) this.award(a, 'outpost', 100);
  }

  _tickOutposts(dt) {
    const G = this.G;
    const B = G.building;
    for (let i = this.outposts.length - 1; i >= 0; i--) {
      const o = this.outposts[i];
      const s = B && B.list.find((x) => x.id === o.id);
      let enemy = 0;
      let friend = 0;
      for (const a of G.actors) {
        if (!a.alive || (a.team !== 'A' && a.team !== 'B') || a.isStreakEntity) continue;
        const d = a.position.distanceTo(o.pos);
        if (d > TRUPP_OUTPOST.overrunR * 2) continue;
        if (a.team === o.team) friend++; else if (d < TRUPP_OUTPOST.overrunR) enemy++;
      }
      o.blocked = enemy > 0;
      o.enemyT = enemy && !friend ? o.enemyT + dt : 0;
      if (!s || o.enemyT >= TRUPP_OUTPOST.overrunT) {
        this.outposts.splice(i, 1);
        this._say(null, null, { team: o.team, txt: s ? 'Außenposten überrannt!' : 'Außenposten zerstört!' });
      }
    }
  }

  /* ------------------------------------------------------------ Einsatz */

  deployPoints(actor = this.G.player) {
    const team = actor && actor.team;
    if (team !== 'A' && team !== 'B') return [];
    const sq = actor.squad;
    // Truppspawn nur beim Truppführer (dicht und schnell bleibt der Sammelpunkt)
    const out = super.deployPoints(actor).filter((p) => p.kind !== 'squad' || (sq && sq.leader && String(sq.leader.id) === String(p.id)));
    for (const p of out) if (p.kind === 'squad') p.sub = 'Truppführer';
    const r = sq && this.rallies.get(sq.id);
    if (r) out.push({ kind: 'rally', id: sq.id, label: 'Sammelpunkt', sub: r.blocked ? 'Feind in der Nähe' : `${r.uses} Einsätze`, position: r.pos, available: !r.blocked && r.uses > 0, reason: r.blocked ? 'Feind in der Nähe' : '', icon: 'rally' });
    for (const o of this.outposts) {
      if (o.team !== team) continue;
      out.push({ kind: 'outpost', id: String(o.id), label: 'Außenposten', sub: o.blocked ? 'Feind in der Nähe' : 'Bunker', position: o.pos, available: !o.blocked, reason: o.blocked ? 'Feind in der Nähe' : '', icon: 'outpost' });
    }
    return out;
  }

  setDeploy(choice) {
    super.setDeploy(choice);
    if (this.replica) this.request({ a: 'dp', k: choice && choice.kind ? choice.kind : '', id: choice && choice.id != null ? String(choice.id) : '' });
  }

  chooseSpawn(actor) {
    if (this.objectives.length && (actor.team === 'A' || actor.team === 'B')) {
      const ch = actor.isPlayer ? this.deployChoice : this._botChoice(actor);
      if (ch && (ch.kind === 'rally' || ch.kind === 'outpost')) { const s = this._spawnAt(actor, ch); if (s) return s; }
      this._forced = ch && ch.kind !== 'rally' && ch.kind !== 'outpost' ? ch : { kind: 'hq', id: 'hq' };
    }
    try { return super.chooseSpawn(actor); } finally { this._forced = undefined; }
  }

  _spawnAt(actor, ch) {
    if (ch.kind === 'rally') {
      const sq = actor.squad;
      const r = sq && this.rallies.get(sq.id);
      if (!r || r.blocked || r.uses <= 0 || String(ch.id) !== sq.id) return null;
      r.uses--;
      if (r.by && r.by !== actor && r.by.stats) this.award(r.by, 'rally', 10);
      return { position: this._spread(actor, r.pos), yaw: actor.yaw || 0, source: 'rally' };
    }
    const o = this.outposts.find((x) => String(x.id) === String(ch.id) && x.team === actor.team);
    if (!o || o.blocked) return null;
    return { position: this._spread(actor, o.pos), yaw: 0, source: 'outpost' };
  }

  _botChoice(bot) {
    if (this._forced !== undefined) return this._forced;
    if (bot.isRemoteHuman) return this._netDeploy.get(bot) || { kind: 'hq', id: 'hq' };
    const sq = bot.squad;
    const r = sq && this.rallies.get(sq.id);
    if (r && !r.blocked && r.uses > 0 && Math.random() < 0.55) return { kind: 'rally', id: sq.id };
    const ops = this.outposts.filter((o) => o.team === bot.team && !o.blocked);
    if (ops.length && Math.random() < 0.35) return { kind: 'outpost', id: String(ops[(Math.random() * ops.length) | 0].id) };
    return super._botChoice(bot);
  }

  onSpawn(actor) {
    if (actor && actor._reviving) { this.squads.of(actor); return; } // Wiederbelebung/Übernahme: kein Ticket
    super.onSpawn(actor);
    if (this.started && !this.isOver && isHuman(actor) && actor.alive && !this.replica) this._redeploySquad(actor);
  }

  /* ------------------------------------------------------------ Sanitäter-Bots */

  _tickMedics(now) {
    const G = this.G;
    const I = G.injuries;
    if (!I || !I.down) return;
    if ((this._medAt || 0) > now) return;
    this._medAt = now + 0.5;
    const busy = new Set(this._medics.values());
    for (const [medic, v] of this._medics) {
      const d = I.down.get(v);
      if (!d || v.alive || !medic.alive || medic.vehicle) { this._medics.delete(medic); continue; }
      if (v.respawnAt != null && v.isBot) v.respawnAt = Math.max(v.respawnAt, now + 2);
      const dist = medic.position.distanceTo(d.pos);
      if (dist < 2.6 || (dist < 6 && now - d.at > 14)) {
        this._medics.delete(medic);
        if (typeof I._revive === 'function') I._revive(v, medic);
      }
    }
    for (const [v, d] of I.down) {
      if (v.alive || !v.isBot || v.isRemoteHuman || busy.has(v) || (v.team !== 'A' && v.team !== 'B') || now > d.until) continue;
      if ([...this._medics.values()].includes(v)) continue;
      let best = null;
      let bd = MEDIC_R;
      for (const a of G.actors) {
        if (!a.isBot || a.puppet || a.isRemoteHuman || !a.alive || a.team !== v.team || !a.gadget || a.gadget.id !== 'medkit' || this._medics.has(a) || a.vehicle) continue;
        const dd = a.position.distanceTo(d.pos) * (a.squad && a.squad === v.squad ? 0.6 : 1);
        if (dd < bd) { bd = dd; best = a; }
      }
      if (!best) continue;
      this._medics.set(best, v);
      if (v.respawnAt != null) v.respawnAt = Math.max(v.respawnAt, now + 4);
      try { issueCommand(G, [best], best, 'attack', { point: d.pos.clone() }, now); } catch { /* */ }
    }
  }

  /* ------------------------------------------------------------ Funk */

  /** Funkspruch: msg = TRUPP_RADIO-Id (Mensch) oder extra.txt (Host-Meldung). → Fehlertext | null */
  _say(actor, msg, extra = null) {
    const G = this.G;
    if (this.replica) return null;
    const now = G.time.elapsed;
    if (msg) {
      const def = TRUPP_RADIO[msg];
      if (!def || !actor || !actor.team) return 'Unbekannter Funkspruch.';
      if (now - (this._sayAt.get(actor) || -1e9) < SAY_GAP) return null;
      this._sayAt.set(actor, now);
      const sq = actor.squad;
      if (def.ch === 's' && !sq) return 'Kein Trupp.';
      const ti = this._targets[actor.team];
      const pt = this.objectives[ti] ? this.objectives[ti].id : '';
      this._pushRadio({ team: actor.team, sq: def.ch === 's' ? sq.id : null, from: actor, msg, txt: '', pt });
      // Sanitäter-Ruf: nächster Sanitäter-Bot des Trupps kommt
      if (msg === 'sani' && sq && actor.alive) {
        const med = this.squads.members(sq, { alive: true }).find((m) => m !== actor && m.isBot && !m.puppet && m.gadget && m.gadget.id === 'medkit');
        if (med) { try { issueCommand(G, [med], actor, 'regroup', {}, now); } catch { /* */ } this._pushRadio({ team: actor.team, sq: sq.id, from: med, msg: '', txt: 'Sanitäter kommt!' }); }
      }
      return null;
    }
    if (extra && extra.txt) this._pushRadio({ team: extra.team || (actor && actor.team), sq: extra.sq || null, from: actor || null, msg: '', txt: String(extra.txt).slice(0, 120) });
    return null;
  }

  _pushRadio(e) {
    const entry = { n: ++this._radioN, at: this.G.time.elapsed, team: e.team, sq: e.sq || null, from: e.from || null, msg: e.msg || '', txt: e.txt || '', pt: e.pt || '', to: e.to || null };
    this.radio.push(entry);
    if (this.radio.length > 40) this.radio.splice(0, this.radio.length - 40);
    this.G.events.emit('trupp:radio', { entry });
  }

  /** Text eines Funkeintrags. */
  radioText(e) {
    if (!e) return '';
    if (e.txt) return e.txt;
    const def = TRUPP_RADIO[e.msg];
    if (!def) return '';
    const f = this.objectives.find((x) => x.id === e.pt);
    return def.text.replace('{p}', f ? `${f.id}${f.name ? ` (${f.name})` : ''}` : 'der Front');
  }

  /* ------------------------------------------------------------ Kommandant */

  _claimCommander(actor) {
    if (!this.commandersOn) return 'Kommandant ist in diesem Spiel aus.';
    const t = actor.team;
    const cur = this.commander[t];
    if (cur === actor) { this.commander[t] = null; this._say(actor, null, { team: t, txt: `${actor.name || 'Kommandant'} gibt das Kommando ab.` }); return null; }
    if (cur && cur.alive !== undefined && this.G.actors.includes(cur) && isHuman(cur)) return `${cur.name || 'Ein Mitspieler'} ist bereits Kommandant.`;
    this.commander[t] = actor;
    this._say(actor, null, { team: t, txt: `${actor.name || 'Spieler'} übernimmt das Kommando.` });
    return null;
  }

  supportLeft(team, kind) {
    const at = this.supportAt[team] && this.supportAt[team][kind];
    return Number.isFinite(at) ? Math.max(0, at - this.G.time.elapsed) : 0;
  }

  _support(actor, kind, pos, ai = false) {
    const G = this.G;
    const def = TRUPP_SUPPORT[kind];
    const t = actor ? actor.team : null;
    if (!def || !pos || (t !== 'A' && t !== 'B')) return 'Ungültig.';
    if (!ai && this.commander[t] !== actor) return 'Nur der Kommandant fordert Unterstützung an.';
    const left = this.supportLeft(t, kind);
    if (left > 0) return `${def.name} erst in ${Math.ceil(left)} s bereit.`;
    const w = G.world;
    if (w && typeof w.inBounds === 'function' && w.inBounds(pos) === 'out') return 'Außerhalb des Kampfgebiets.';
    const hqOwn = this.hq[t] && this.hq[t].position;
    if (hqOwn && flat(hqOwn, pos) < 60) return 'Zu nah am eigenen HQ.';
    const now = G.time.elapsed;
    this.supportAt[t][kind] = now + def.cooldown;
    const p = new THREE.Vector3(pos.x, groundAt(w, pos.x, pos.z, (pos.y || 0) + 30), pos.z);
    if (kind === 'luftschlag') {
      let strike = null;
      try { strike = new Strike(this._strikeMgr, actor, p, { impacts: def.impacts, spacing: def.spacing, radius: def.radius, maxDamage: def.maxDamage, delay: 3.2 }); } catch (err) { console.error('[NULLPUNKT] Luftschlag:', err); }
      if (strike) this.barrages.push({ strike, team: t });
      this.supportMarks.push({ team: t, kind, pos: p.clone(), radius: def.radius + def.spacing * 2, until: now + 7 });
    } else {
      const shells = [];
      for (let i = 0; i < def.shells; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * def.spread;
        shells.push({ at: now + def.delay + (i / def.shells) * def.dur + Math.random() * 0.4, x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r });
      }
      this.barrages.push({ shells, owner: actor, team: t, def });
      this.supportMarks.push({ team: t, kind, pos: p.clone(), radius: def.radius, until: now + def.delay + def.dur + 1 });
    }
    this._say(actor, null, { team: t, txt: `${def.name} angefordert – Einschlag in ${kind === 'luftschlag' ? 3 : def.delay} s. Abstand halten!` });
    G.events.emit('ui:sound', { name: 'airstrike_call' });
    return null;
  }

  _tickSupport(dt, now) {
    const G = this.G;
    for (let i = this.barrages.length - 1; i >= 0; i--) {
      const b = this.barrages[i];
      if (b.strike) { if (!b.strike.update(dt)) this.barrages.splice(i, 1); continue; }
      for (const s of b.shells) {
        if (s.done || now < s.at) continue;
        s.done = true;
        const y = groundAt(G.world, s.x, s.z, 60);
        if (G.combat) {
          try {
            G.combat.explode({ position: new THREE.Vector3(s.x, y + 0.3, s.z), radius: b.def.blast, maxDamage: b.def.maxDamage, minDamage: 25, innerRadius: 2.2, attacker: b.owner, weaponId: 'strike', type: 'airstrike' });
          } catch (err) { console.error('[NULLPUNKT] Artillerie:', err); }
        }
      }
      if (b.shells.every((s) => s.done)) this.barrages.splice(i, 1);
    }
    this.supportMarks = this.supportMarks.filter((m) => m.until > now);
    // KI-Kommandant: ohne menschlichen Kommandanten selten Artillerie auf eine Feindansammlung am eigenen Frontziel
    if (!this.commandersOn || now < this._aiCmdAt) return;
    this._aiCmdAt = now + 20;
    for (const team of ['A', 'B']) {
      if (this.commander[team] && G.actors.includes(this.commander[team])) continue;
      if (this.supportLeft(team, 'artillerie') > 0 || Math.random() < 0.5) continue;
      const f = this.objectives[this._targets[team]];
      if (!f) continue;
      const foes = G.actors.filter((a) => a.alive && (a.team === 'A' || a.team === 'B') && a.team !== team && flat(a.position, f.position) < 30);
      const mates = G.actors.filter((a) => a.alive && a.team === team && flat(a.position, f.position) < 35);
      if (foes.length < 3 || mates.length) continue;
      const c = avgPos(foes);
      const caller = G.actors.find((a) => a.alive && a.team === team && !isHuman(a)) || null;
      if (caller) this._support(caller, 'artillerie', c, true);
    }
  }

  /* ------------------------------------------------------------ Mehrspieler */

  netExtra(s) {
    super.netExtra(s);
    const id = (a) => (a && Number.isInteger(a.netId) ? a.netId : 0);
    const now = this.G.time.elapsed;
    const rd = (v) => [r2(v.x), r2(v.y), r2(v.z)];
    s.tr = {
      sq: this.squads.netList(),
      fr: this.objectives.map((f) => f.id),
      mk: this.marks.map((m) => [m.n, m.sq.id, m.kind, ...rd(m.pos), Math.round(m.until - now), id(m.target)]),
      rp: [...this.rallies.values()].map((r) => [r.sq.id, ...rd(r.pos), r.uses, r.blocked ? 1 : 0]),
      op: this.outposts.map((o) => [o.id, o.team, ...rd(o.pos), o.blocked ? 1 : 0]),
      cm: { A: id(this.commander.A), B: id(this.commander.B) },
      cd: { A: [Math.round(this.supportLeft('A', 'artillerie')), Math.round(this.supportLeft('A', 'luftschlag'))], B: [Math.round(this.supportLeft('B', 'artillerie')), Math.round(this.supportLeft('B', 'luftschlag'))] },
      sm: this.supportMarks.map((m) => [m.team, m.kind, ...rd(m.pos), Math.round(m.radius), Math.round((m.until - now) * 10) / 10]),
      ra: this.radio.slice(-RADIO_KEEP).map((e) => [e.n, e.team || '', e.sq || '', id(e.from), e.msg, e.txt, e.pt, id(e.to)]),
      on: this.commandersOn ? 1 : 0,
      lt: this.lossTickets,
    };
  }

  applyNetExtra(s, find) {
    super.applyNetExtra(s, find);
    const T = s && s.tr;
    if (!T || typeof T !== 'object') return;
    const G = this.G;
    const now = G.time.elapsed;
    const self = (nid) => { if (!nid) return null; const a = find(nid); if (a) return a; return G.player && G.player.netId === nid ? G.player : null; };
    if (Array.isArray(T.fr) && T.fr.length === this.objectives.length) {
      const by = new Map(this.objectives.map((f) => [f.id, f]));
      const next = T.fr.map((x) => by.get(x)).filter(Boolean);
      if (next.length === this.objectives.length) this.objectives = next;
    }
    this.squads.applyNet(T.sq, self);
    this.commandersOn = !!T.on;
    this.lossTickets = T.lt | 0;
    const sqById = (x) => this.squads.byId(x);
    if (Array.isArray(T.mk)) {
      const keep = new Map(this.marks.map((m) => [m.n, m]));
      this.marks = [];
      for (const [n, sid, kind, x, y, z, left, tg] of T.mk) {
        const sq = sqById(sid);
        if (!sq || !TRUPP_MARKS[kind]) continue;
        const m = keep.get(n) || { n, sq, team: sq.team, kind, pos: new THREE.Vector3() };
        m.sq = sq; m.team = sq.team; m.kind = kind; m.pos.set(x, y, z); m.until = now + (Number(left) || 0); m.target = tg ? self(tg) : null;
        this.marks.push(m);
      }
    }
    if (Array.isArray(T.rp)) {
      const seen = new Set();
      for (const [sid, x, y, z, uses, bl] of T.rp) {
        const sq = sqById(sid);
        if (!sq) continue;
        seen.add(sid);
        let r = this.rallies.get(sid);
        if (r && r.pos.distanceTo(_v.set(x, y, z)) > 0.5) { this._dropMesh(r); r = null; }
        if (!r) { r = { sq, team: sq.team, pos: new THREE.Vector3(x, y, z), uses: 0, blocked: false, mesh: null }; this.rallies.set(sid, r); this._addMesh(r); }
        r.sq = sq; r.uses = uses | 0; r.blocked = !!bl;
      }
      for (const [sid, r] of this.rallies) if (!seen.has(sid)) { this._dropMesh(r); this.rallies.delete(sid); }
    }
    if (Array.isArray(T.op)) this.outposts = T.op.map(([id, team, x, y, z, bl]) => ({ id, team, pos: new THREE.Vector3(x, y, z), blocked: !!bl }));
    if (T.cm) { this.commander.A = self(T.cm.A); this.commander.B = self(T.cm.B); }
    if (T.cd) for (const team of ['A', 'B']) { const c = T.cd[team]; if (Array.isArray(c)) { this.supportAt[team].artillerie = now + (c[0] || 0); this.supportAt[team].luftschlag = now + (c[1] || 0); } }
    if (Array.isArray(T.sm)) this.supportMarks = T.sm.map(([team, kind, x, y, z, radius, left]) => ({ team, kind, pos: new THREE.Vector3(x, y, z), radius, until: now + (Number(left) || 0) }));
    if (Array.isArray(T.ra)) {
      const last = this.radio.length ? this.radio[this.radio.length - 1].n : 0;
      for (const [n, team, sid, from, msg, txt, pt, to] of T.ra) {
        if (!(n > last)) continue;
        if (to && (!G.player || G.player.netId !== to)) continue;
        const e = { n, at: now, team, sq: sid || null, from: self(from), msg: String(msg || ''), txt: String(txt || '').slice(0, 120), pt: String(pt || ''), to: to ? G.player : null };
        this.radio.push(e);
        G.events.emit('trupp:radio', { entry: e });
      }
      if (this.radio.length > 40) this.radio.splice(0, this.radio.length - 40);
    }
    this._targets = this._front();
  }

  /* ------------------------------------------------------------ Ergebnis */

  resultExtra() {
    return { ...super.resultExtra(), front: this.objectives.map((f) => f.id) };
  }
}

/* ------------------------------------------------------------ Ausrüstung je Rolle */

/** Ausrüstung einer Rolle; eigene Waffen bleiben, wenn die Rolle ihre Waffenklasse erlaubt (Aufsätze/Tarnung bleiben). */
export function roleLoadout(roleId, base = {}) {
  const r = TRUPP_ROLES[roleId] || TRUPP_ROLES[TRUPP_DEFAULT_ROLE];
  const W = WEAPONS;
  const usable = (id) => !!(id && W[id] && !W[id].og);
  const okP = (id) => usable(id) && W[id].slot === 'primary' && r.weapons.includes(W[id].cls);
  const primary = okP(base.primary) ? base.primary : r.prefer.find(okP) || Object.keys(W).find(okP) || 'ar_m17';
  let secondary;
  if (r.secondary[0] === 'launcher') secondary = ['at_donner', 'gl_hammer'].find((id) => usable(id)) || 'pi_p9';
  else {
    const okS = (id) => usable(id) && W[id].slot === 'secondary' && W[id].cls === 'pistol';
    secondary = okS(base.secondary) ? base.secondary : r.secondary.find(okS) || 'pi_p9';
  }
  const c = CLASSES[r.cls] || CLASSES.sturm;
  const lo = { ...base, cls: c.id, primary, secondary, lethal: EQUIPMENT[r.lethal] ? r.lethal : 'frag', armor: c.armor, helmet: c.helmet };
  if (r.tactical && EQUIPMENT[r.tactical]) lo.tactical = r.tactical; else delete lo.tactical;
  delete lo.launcher;
  return lo;
}

function vec(p) {
  if (!p) return new THREE.Vector3();
  return p.isVector3 ? p.clone() : new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0);
}

function avgPos(list) {
  const v = new THREE.Vector3();
  for (const a of list) v.add(a.position);
  return v.multiplyScalar(1 / Math.max(1, list.length));
}
