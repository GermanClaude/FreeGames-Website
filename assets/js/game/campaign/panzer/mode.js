// NULLPUNKT — Panzer-Kampagne „Eisenwind“ (Nutzer 19.11.): Missions-Regie (campaign/director.js) auf dem Modus „Panzer“
// (modes/panzer.js – Rollen, Simulation/Arcade, KI-Besatzung, Bordsprech, Munition, Panzerung).
//
// Start: Lobby-Reiter „Kampagne“ → Umschalter „Eisenwind (Panzer)“ (panzer/menu.js) bzw. Debug-URL
//   spielen.html?debug=1&autostart=1&mode=kampagne&mission=p1[&cp=<Checkpoint>][&rolle=lader][&sim=0|1][&fuehrung=tutorial]
// Der Modus läuft unter der Id „kampagne“ (main.js reicht campaign = { mission, checkpoint } durch, alle Karten erlaubt,
// Tageszeit/Wetter der Mission über campaignConditions); modes/index.js wählt diese Klasse für Missions-Ids p1…p6.
// Rolle/Spielart/Führung: settings.modeOptions.pkampagne (Lobby), URL-Parameter wie im Modus „Panzer“ haben Vorrang.
//
// Ablauf: eigener Panzer am Checkpoint der Startstufe (Missionsrahmen F: Achse eigene Basis → Feindbasis der Karte),
// Director.start() → mission.prepare/stages (Ziele, Funk, Wellen, Zwischensequenzen mit Lip-Sync). Panzer verloren oder
// Spieler gefallen → Fehlschlag-Tafel („Ab Checkpoint“, „Neu starten“, „Kampagne“). Sieg → Outro → Endbildschirm.
//
// Konsole (Tests): __game.campaign → { director, skip(), win(), stage(id), killTargets(), debug() }, __game.panzer wie im Modus.
import * as THREE from 'three';
import { PanzerMode } from '../../modes/panzer.js?v=20261115041504';
import { Director } from '../director.js?v=20261115041504';
import { CampaignUI } from '../ui.js?v=20261115041504';
import { CampaignProgress } from '../progress.js?v=20261115041504';
import { VEHICLES } from '../../vehicles/data.js?v=20261115041504';
import { prepareVehicleModels } from '../../vehicles/models.js?v=20261115041504';
import { PZ_MISSIONS, PZ_ORDER, pzMission, PZ_CAMPAIGN } from './missions.js?v=20261115041504';
import { makeFrame, PZ_SPEAKERS } from './kit.js?v=20261115041504';

const _v = new THREE.Vector3();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
/* Panzer-Kampagne: Missionsfunk oben (unten liegt der Bordsprech), Zielliste unter der Minikarte */
body.pk-on #np-campaign .kc-sub.radio { bottom: auto; top: 9px; width: min(46vw, 640px); }
body.pk-on #np-campaign .kc-obj { top: 200px; width: min(270px, 26vw); }
body.pk-on #np-campaign .kc-obj li { font-size: 13px; }
body.pk-on #np-campaign .kc-obj li.done { display: none; } /* Platz für die Panzer-Spalte; erfüllte Ziele meldet die Einblendung */
@media (max-height: 520px) { body.pk-on #np-campaign .kc-sub.radio { top: 6px; width: min(44vw, 520px); } }
body.pk-on #np-campaign .kc-toast { white-space: normal; max-width: min(640px, 52vw); text-align: center; top: 21%; line-height: 1.35; }
body.pk-on[data-input-mode="touch"] #np-campaign .kc-toast { max-width: 50vw; top: 30%; font-size: 13px; }
body.pk-on[data-input-mode="touch"] #np-campaign .kc-obj { left: 118px; top: 6px; width: min(190px, 22vw); }
body.pk-on[data-input-mode="touch"] #np-campaign .kc-sub.radio { top: 6px; left: 50%; width: min(36vw, 460px); }
`;

export class PanzerCampaignMode extends PanzerMode {
  constructor(G, modeId, opts = {}) {
    super(G, modeId, { ...opts, optKey: 'pkampagne' });
    const c = opts.campaign || (G.match && G.match.campaign) || {};
    this.def = pzMission(c.mission) || PZ_MISSIONS[PZ_ORDER[0]];
    this.checkpointId = c.checkpoint || null;
    this.cfg.panzer = this.def.tank;
    this.timeLimit = 0; this.scoreLimit = 0; this.timeLeft = Infinity;
    this.store = new CampaignProgress(PZ_ORDER, PZ_ORDER);
    this.ui = null; this.director = null; this.mission = null; this.success = null; this.cinema = false;
    this.campaignMode = true;
    // Besatzung von „Falke 2“ (frei erfunden); der Platz des Spielers bleibt ohne Namen
    this.crewNames = { commander: 'Fw. Roeder', gunner: 'Uffz. Martell', driver: 'Gefr. Ollmann', loader: 'Gefr. Brucks', funker: 'Gefr. Wiese', mg: 'Gefr. Wiese', mechaniker: 'Gefr. Arndt' };
    this._pre = null; this._keys = null; this._padA = false;
  }

  /* ------------------------------------------------------------ Lebenszyklus */

  onAttach(s) {
    super.onAttach(s);
    const G = this.G;
    if (!document.getElementById('pk-css')) { const st = document.createElement('style'); st.id = 'pk-css'; st.textContent = CSS; document.head.appendChild(st); }
    this.ui = new CampaignUI(G);
    if (s) s.on('match:state', ({ state }) => { if (this.ui) this.ui.root.hidden = state === 'ended' || state === 'lobby' || state === 'loading'; });
    this.ui.onSkip = () => this.skip();
    this.ui.onFail = (act) => this._failAction(act);
    const onKey = (e) => {
      if (!this.cinema || e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); this.skip(); }
    };
    window.addEventListener('keydown', onKey, true);
    this._keys = () => window.removeEventListener('keydown', onKey, true);
    G.campaign = this;
    document.body.dataset.campaign = '1';
    document.body.classList.add('pk-on');
    if (G.panzer) G.panzer.campaign = this;
  }

  onDetach() {
    const G = this.G;
    if (this.director) { this.director.dispose(); this.director = null; }
    if (this.cinema) this.enterCinema(false);
    if (this._keys) { this._keys(); this._keys = null; }
    if (this.ui) { this.ui.dispose(); this.ui = null; }
    if (this._night) { this._night(); this._night = null; }
    delete document.body.dataset.cutscene;
    delete document.body.dataset.campaign;
    document.body.classList.remove('pk-on');
    if (G.match && G.match.uiHold) G.holdUi && G.holdUi(false);
    super.onDetach();
    if (G.campaign === this) G.campaign = null;
  }

  onStart() {
    const G = this.G;
    this._pre = G.actors.filter((a) => a.isBot);
    try { this.store.startMission(this.def.id, G.match.difficulty); } catch { /* */ }
    try { this._setupCampaign(); } catch (err) { console.error('[Panzer-Kampagne] Aufbau fehlgeschlagen', err); }
  }

  _setupCampaign() {
    const G = this.G, sys = this._prepSystem();
    if (!sys) return;
    const { A, B } = this._bases();
    this.F = makeFrame(G, A, B);
    const type = VEHICLES[this.def.tank] ? this.def.tank : 'mbt';
    try { prepareVehicleModels([...new Set([type, ...(this.def.models || [])])], ['A', 'B'], sys.quality); } catch (err) { console.warn('[Panzer-Kampagne] Modelle', err); }
    // Missionsinstanz im Kartenrahmen (Positionen relativ zu den Basen der Karte)
    this.mission = { ...this.def, ...this.def.build(this.F, this) };
    this.mission.speakers = PZ_SPEAKERS;
    this.director = new Director(this, this.mission, { checkpoint: this.checkpointId, ui: this.ui, store: this.store, cps: this.store.cps() });
    const D = this.director;
    const st = this.mission.stages[D.startIndex] || this.mission.stages[0];
    const cp = (st && st.checkpoint) || { at: this.F.at(0.05, 0), yaw: this.F.yaw };
    const p = D.vec(cp.at);
    const spot = sys.findSpot(p, type, { maxR: 40, toward: this.F.toB }) || { position: p, yaw: cp.yaw };
    if (!this._spawnOwn(type, spot.position, this._freeYaw(spot.position, cp.yaw ?? spot.yaw))) return;
    this._hooks();
    this.director.start();
    if (this.mission.night) this._applyNight(this.mission.night);
  }

  /** Blickrichtung mit freier Bahn (Stadt: nicht vor eine Hauswand stellen) – Probe ±30°…180° um die Wunschrichtung. */
  _freeYaw(pos, yaw) {
    const G = this.G, W = G.world, sys = G.vehicles;
    if (!W || !W.raycast) return yaw;
    const o = pos.clone(); o.y += 1.6;
    for (const dy of [0, 0.5, -0.5, 1.05, -1.05, 1.57, -1.57, 2.3, -2.3, Math.PI]) {
      const y = yaw + dy, d = _v.set(-Math.sin(y), 0, -Math.cos(y));
      const was = sys ? sys._noVeh : false;
      if (sys) sys._noVeh = true;
      let h = null;
      try { h = W.raycast(o, d, 28); } finally { if (sys) sys._noVeh = was; }
      if (!h || h.distance > 26) return y;
    }
    return yaw;
  }

  tick(dt) {
    const G = this.G;
    if (this._pre) {
      for (const b of this._pre) if (!b._kc && !b._psim) { try { G.bots.removeBot(b); } catch { /* */ } }
      this._pre = null;
    }
    // Luftfahrzeuge der Karte (Stellplätze) gehören nicht in die Panzer-Kampagne
    if ((this._airT = (this._airT || 0) - dt) <= 0 && G.vehicles && G.vehicles.list) {
      this._airT = 2;
      try { G.vehicles.spawns = (G.vehicles.spawns || []).filter((sp) => !(VEHICLES[sp.type] && VEHICLES[sp.type].air)); } catch { /* */ }
      for (const v of [...G.vehicles.list]) if (v.def && v.def.air && !(this.director && this.director.vehicles.includes(v))) { try { G.vehicles.removeVehicle(v); } catch { /* */ } }
    }
    if (this.cinema) {
      if (G.input && G.input.enabled) G.input.setEnabled(false);
      // Namensschilder ausblenden (Darsteller stehen im Bild)
      const plates = G.bots && G.bots._plates;
      for (const b of (G.bots && G.bots.bots) || []) {
        if (b.soldier && b.soldier.root) b.soldier.root.visible = false;
        const pl = plates && plates.get(b);
        if (pl && pl.sprite) pl.sprite.visible = false;
      }
      this._hidBots = true;
      this._pollPad();
      // Panzer stehen während der Sequenz
      const v = this.tank;
      if (v && v.alive) for (const s of v.seats) if (s.intent && s.def.drive) { s.intent.throttle = 0; s.intent.brake = 1; }
    } else super.tick(dt);
    if (this.director) this.director.update(dt);
  }

  _pollPad() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let a = false;
    for (const p of pads || []) if (p && p.buttons && p.buttons[0] && p.buttons[0].pressed) a = true;
    if (a && !this._padA) this.skip();
    this._padA = a;
  }

  /** Nacht (P4): Bild abdunkeln (Filter, mit den Sichtgeräten abgestimmt), Bots sehen schlechter. */
  _applyNight({ dark = 0.42, vis = 0.4 } = {}) {
    const G = this.G;
    this.baseFilter = `brightness(${dark.toFixed(2)}) saturate(0.45) hue-rotate(-12deg)`;
    if (G.world) G.world.nightVis = vis;
    this._night = () => { this.baseFilter = ''; if (G.world) G.world.nightVis = 1; const c = this.optics && this.optics.canvas; if (c) c.style.filter = ''; };
  }

  /** Unterkante der Zielliste (px) – die linke HUD-Spalte des Panzers bleibt darunter (psim/hud.js). */
  hudReserve() {
    const el = this.ui && this.ui.root ? this.ui.root.querySelector('.kc-obj') : null;
    if (!el || !el.classList.contains('on')) return 0;
    return el.getBoundingClientRect().bottom + 8;
  }

  /* ------------------------------------------------------------ Kinomodus */

  enterCinema(on) {
    const G = this.G;
    on = !!on;
    if (on === this.cinema) return;
    this.cinema = on;
    if (on) {
      document.body.dataset.cutscene = '1';
      if (G.input) { G.input.setEnabled(false); try { G.input.cancelAds(); } catch { /* */ } }
      if (this.ui) this.ui.setMode('cine');
      if (this.radio) this.radio.clear();
    } else {
      delete document.body.dataset.cutscene;
      const st = G.match.state;
      if (G.input && (st === 'playing' || st === 'countdown')) G.input.setEnabled(true);
      if (this.ui) this.ui.setMode('play');
      if (this._hidBots) {
        this._hidBots = false;
        for (const b of (G.bots && G.bots.bots) || []) if (b.soldier && b.soldier.root && b.soldier.state !== 'hidden' && !b._vehHidden && !b.vehicle) b.soldier.root.visible = true;
      }
      // Spieler zurück in seine Sicht (Sequenzkamera lag darüber)
      if (G.player && this.tank && G.player.vehicle !== this.tank && this.tank.alive) this._enterPlayer();
    }
  }

  skip() { if (this.director && this.director.cutscene) this.director.skipCutscene(); }

  /* ------------------------------------------------------------ Regeln/Ergebnis */

  _intro() { /* Missionsfunk statt Standard-Lage */ }

  objectiveFor(bot) {
    if (bot._kc && this.director) return this.director.objectiveFor(bot);
    return super.objectiveFor(bot);
  }

  /** KI-Kommandant rückt auf das offene Missionsziel vor (sonst nächster Gegner). */
  nextObjective() {
    const D = this.director;
    if (D && D.objs) {
      const o = D.objs.find((x) => !x.done && !x.hidden && x.pos && !x.noDrive);
      if (o) { const p = typeof o.pos === 'function' ? o.pos() : o.pos; if (p) return p; }
    }
    return super.nextObjective();
  }

  _finish(outcome, text) {
    if (outcome === 'loss') { if (this.director) this.director.fail(text === 'Gefallen' ? 'Du bist gefallen – der Panzer ist ohne dich nicht einsatzfähig.' : `${text}.`); return; }
  }

  _onDestroyed(e) {
    const v = e && e.vehicle;
    if (!v) return;
    if (v === this.tank) { this._finish('loss', v._psimKo === 'Munition' || v._ammoRack ? 'Munition gezündet – Panzer verloren' : 'Panzer verloren'); return; }
    if (v.team !== 'B') return;
    this.addTeamScore('A', 5);
    if (e.by && e.by.vehicle === this.tank && this.G.player) this.award(this.G.player, 'vehicle', 150);
    const label = v.isEmplacement ? { pak: 'Pak', bunker: 'Bunker', funk: 'Funkstelle', lager: 'Lager', bruecke: 'Brücke' }[v.kind] || 'Ziel' : 'Panzer';
    if (this.radio && !this.cinema) this.radio.say(this.role === 'kommandant' ? 'Richtschütze' : 'Kommandant', `${label} vernichtet!${v._psimKo === 'Besatzung' ? ' Besatzung ausgeschaltet.' : v._ammoRack ? ' Munition hochgegangen!' : ''}`, { key: 'kill' });
  }

  decide() { return { winner: this.success ? 'A' : 'B' }; }

  missionEnd(success) {
    if (this.isOver) return;
    const G = this.G;
    this.success = !!success;
    let next = null;
    if (success) {
      try { this.store.completeMission(this.def.id, G.match.difficulty, this.director ? this.director.elapsed : 0); } catch { /* */ }
      next = PZ_ORDER[PZ_ORDER.indexOf(this.def.id) + 1] || null;
    }
    if (G.lastConfig && G.lastConfig.campaign) G.lastConfig.campaign = { ...G.lastConfig.campaign, checkpoint: null };
    this.end(success ? 'mission' : 'failed');
    if (this.result) {
      this.result.campaign = { panzer: true, mission: this.def.id, title: this.def.title, number: this.def.number, success: !!success, next, seconds: Math.round(this.director ? this.director.elapsed : 0), deaths: 0, difficulty: G.match.difficulty };
      this.result.modeName = `${PZ_CAMPAIGN.title} · Mission ${this.def.number}: ${this.def.title}`;
    }
  }

  missionFail(reason) {
    const G = this.G;
    if (this.ui) this.ui.fail(reason);
    if (G.input) G.input.setEnabled(false);
    if (G.holdUi) G.holdUi(true);
    if (G.input) G.input.exitLock();
    if (G.player) G.player.invulnerable = true;
  }

  _failAction(act) {
    const G = this.G;
    if (this.ui) this.ui.fail(null);
    if (G.holdUi) G.holdUi(false);
    const dir = this.director;
    if (act === 'retry') this.restartAt(dir ? dir.checkpointId : null);
    else if (act === 'restart') this.restartAt(null);
    else this.missionEnd(false);
  }

  restartAt(checkpoint) {
    const G = this.G;
    const cfg = G.lastConfig ? { ...G.lastConfig, loadout: { ...G.lastConfig.loadout } } : { modeId: 'kampagne' };
    const first = this.mission && this.mission.stages[0] && this.mission.stages[0].id;
    cfg.campaign = { mission: this.def.id, checkpoint: checkpoint && checkpoint !== first ? checkpoint : null };
    if (G.debugApi && typeof G.debugApi.start === 'function') G.debugApi.start(cfg);
  }

  decorateEnd(screen, result) {
    const G = this.G, c = result && result.campaign;
    if (!c || !screen) return;
    const next = c.next ? PZ_MISSIONS[c.next] : null;
    const box = document.createElement('section');
    box.className = 'kc-end';
    box.innerHTML = `<style>.kc-end{margin:10px auto 14px;max-width:760px;padding:14px 18px;border-left:3px solid ${c.success ? 'var(--np-ok,#5fe08a)' : 'var(--np-enemy,#ff3b3b)'};background:rgba(10,11,13,.72)}
      .kc-end small{letter-spacing:.2em;text-transform:uppercase;color:var(--np-signal,#ff5b1f);font-size:11px}.kc-end h3{margin:4px 0 6px;font-size:clamp(20px,3vw,30px);letter-spacing:.06em;text-transform:uppercase}
      .kc-end p{margin:0 0 10px;color:#cfcac0;font-size:14px}.kc-end .kc-end-btns{display:flex;flex-wrap:wrap;gap:8px}.kc-end button{min-height:44px;padding:0 16px}</style>
      <small>${esc(PZ_CAMPAIGN.title)} · Mission ${c.number}</small>
      <h3>${c.success ? 'Mission erfüllt' : 'Mission gescheitert'} – ${esc(c.title)}</h3>
      <p>Dauer ${Math.floor(c.seconds / 60)}:${String(c.seconds % 60).padStart(2, '0')} · Rolle ${esc(this.roleLabel())} · ${this.arcade ? 'Arcade' : 'Simulation'}${next ? ` · Als Nächstes: Mission ${next.number} „${esc(next.title)}“` : c.success ? ' · Kampagne abgeschlossen.' : ''}</p>
      <div class="kc-end-btns">
        ${next && c.success ? '<button type="button" class="m-btn m-primary" data-kc-end="next">Nächste Mission</button>' : ''}
        ${!c.success ? '<button type="button" class="m-btn m-primary" data-kc-end="retry">Erneut versuchen</button>' : ''}
        <button type="button" class="m-btn" data-kc-end="menu">Kampagnenmenü</button>
      </div>`;
    const head = screen.querySelector('.end-head, header, h1');
    const anchor = head ? head.closest('header') || head : null;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling); else screen.prepend(box);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-kc-end]');
      if (!b) return;
      const act = b.dataset.kcEnd;
      const base = G.lastConfig ? { ...G.lastConfig, loadout: { ...G.lastConfig.loadout } } : { modeId: 'kampagne' };
      if (act === 'next' && next) { if (G.debugApi) G.debugApi.start(pzMissionConfig(next, base)); }
      else if (act === 'retry') { if (G.debugApi) G.debugApi.start({ ...base, campaign: { mission: c.mission, checkpoint: null } }); }
      else if (act === 'menu') { if (G.menus && G.menus.lobby) { G.menus.lobby.tab = 'kampagne'; if (G.menus.lobby.campaign) G.menus.lobby.campaign.which = 'panzer'; } if (G.debugApi) G.debugApi.toLobby(); }
    });
  }

  /* ------------------------------------------------------------ Tests/Konsole */

  win() { if (this.director) { this.G.match.unranked = true; this.director.complete(); } }
  stage(id) { this.G.match.unranked = true; this.restartAt(id || null); }

  /** Alle feindlichen Ziele (Panzer, Stellungen) und Infanterie ausschalten (Tests). */
  killTargets() {
    const G = this.G;
    G.match.unranked = true;
    let n = 0;
    for (const v of [...G.vehicles.list]) if (v.alive && v.team === 'B') { try { v.destroy(G.player, 'debug'); n++; } catch { /* */ } }
    for (const b of [...G.actors]) if (b.alive && b.team === 'B' && !b.vehicle && G.combat) { G.combat.damage(b, { amount: 9999, attacker: G.player, zone: 'body' }); n++; }
    return n;
  }

  debug() {
    const d = this.director;
    return {
      mission: this.def.id, stage: d && d.mission.stages[d.stageIndex] ? d.mission.stages[d.stageIndex].id : null, state: d ? d.state : null, cinema: this.cinema,
      role: this.role, sim: this.sim, tank: this.tank && this.tank.type, alive: !!(this.tank && this.tank.alive),
      objectives: d ? d.objs.map((o) => ({ id: o.id, text: o.text, done: o.done, count: o.count, total: o.total })) : [],
      foes: this.enemies.filter((e) => e.v.alive).length, empl: this.empl.filter((e) => e.alive).length, friends: (this.friends || []).filter((e) => e.v.alive).length,
      checkpoint: d ? d.checkpointId : null, line: d && d.line ? d.line.text : null, timer: d ? d.timerLeft : null,
    };
  }
}

/** Startkonfiguration einer Panzer-Mission (Lobby/Endbildschirm). */
export function pzMissionConfig(mission, base = {}, { checkpoint = null, difficulty = null } = {}) {
  return {
    ...base,
    modeId: 'kampagne', mapId: mission.map, allies: 1, enemies: 1, mass: false,
    difficulty: difficulty || base.difficulty || 'regulaer',
    timeOfDay: mission.time || null, weather: mission.weather || null,
    timeLimit: null, scoreLimit: null, style: base.style || 'arcade',
    campaign: { mission: mission.id, checkpoint },
  };
}

void _v;
