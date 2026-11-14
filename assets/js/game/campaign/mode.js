// NULLPUNKT — Kampagnenmodus ('kampagne', modes/index.js): Rahmen um die Missions-Regie (director.js).
//
// Start: Lobby-Reiter „Kampagne“ (campaign/menu.js) bzw. Debug-URL spielen.html?debug=1&autostart=1&mode=kampagne&mission=m1
// [&cp=<Checkpoint>][&diff=veteran]. Konfiguration: cfg.campaign = { mission, checkpoint } (main.js normalizeConfig).
// Der Modus wählt Spawns (Checkpoint, Wellen, Verbündete), lenkt die Bot-Ziele (objectiveFor), verhindert den
// Wiedereinstieg von Gegnern, schaltet für Zwischensequenzen in den Kinomodus (Eingabe aus, HUD/Touch/Viewmodel
// verborgen, Spieler unverwundbar, Überspringen per Knopf/Leertaste/Eingabe/Gamepad A) und beendet das Match mit dem
// Missionsergebnis (Sieg = Mission erfüllt; Fortschritt + EP im Profil). Fehlschlag: Tafel mit „Ab Checkpoint“,
// „Mission neu starten“, „Kampagne“.
//
// Konsole (Tests): __game.campaign → { director, skip(), win(), stage(id), teleport(zoneOderPunkt), state() }

import { BaseMode } from '../modes/base.js?v=20261114060746';
import { Director } from './director.js?v=20261114060746';
import { CampaignUI } from './ui.js?v=20261114060746';
import { CampaignProgress } from './progress.js?v=20261114060746';
import { MISSIONS, MISSION_ORDER, missionById } from './missions/index.js?v=20261114060746';

export class CampaignMode extends BaseMode {
  constructor(G, modeId, opts = {}) {
    super(G, modeId, opts);
    this.teams = true;
    this.scores = { A: 0, B: 0 };
    this.timeLimit = 0;
    this.scoreLimit = 0;
    this.timeLeft = Infinity;
    this.respawnDelay = 3.5;
    const c = opts.campaign || (G.match && G.match.campaign) || {};
    this.mission = missionById(c.mission) || MISSIONS[MISSION_ORDER[0]];
    this.checkpointId = c.checkpoint || null;
    this.store = new CampaignProgress(MISSION_ORDER);
    this.ui = null;
    this.director = null;
    this.success = null;
    this.cinema = false;
    this._pre = null; // Bots aus der Grundbesetzung (nur zum Vorwärmen) – beim ersten Bild entfernt
    this._keys = null;
    this._padA = false;
    this.lockLoadout = false;
  }

  get deployMap() { return false; }

  /* ------------------------------------------------------------ Lebenszyklus */

  onAttach(s) {
    const G = this.G;
    this.ui = new CampaignUI(G);
    // Ende/Lobby: Kampagnen-Ebene ausblenden (Endbildschirm liegt darunter)
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
  }

  onDetach() {
    const G = this.G;
    if (this.director) { this.director.dispose(); this.director = null; }
    if (this.cinema) this.enterCinema(false);
    if (this._keys) { this._keys(); this._keys = null; }
    if (this.ui) { this.ui.dispose(); this.ui = null; }
    delete document.body.dataset.cutscene;
    delete document.body.dataset.campaign;
    if (G.match && G.match.uiHold) G.holdUi && G.holdUi(false);
    if (G.campaign === this) G.campaign = null;
  }

  onStart() {
    const G = this.G;
    this._pre = G.actors.filter((a) => a.isBot);
    try { this.store.startMission(this.mission.id, G.match.difficulty); } catch { /* */ }
    this.director = new Director(this, this.mission, { checkpoint: this.checkpointId, ui: this.ui, store: this.store, cps: this.store.cps() });
    this.director.start();
    // Spieler an den Start-/Checkpoint
    const sp = this.director.spawnPoint;
    if (sp && G.player) {
      G.player.body.teleport(sp.position.clone());
      G.player.yaw = sp.yaw;
      G.player.pitch = 0;
    }
  }

  tick(dt) {
    const G = this.G;
    if (this._pre) {
      for (const b of this._pre) if (!b._kc) { try { G.bots.removeBot(b); } catch { /* */ } }
      this._pre = null;
    }
    if (this.cinema) {
      // Countdown-Ende/Fortsetzen schalten die Eingabe wieder ein – während der Sequenz bleibt sie aus
      if (G.input && G.input.enabled) G.input.setEnabled(false);
      if (G.viewmodel && G.viewmodel.scene.visible) G.viewmodel.scene.visible = false;
      // Bots (Verbündete stehen als Darsteller im Bild) und ihre Namensschilder während der Sequenz ausblenden
      const plates = G.bots && G.bots._plates;
      for (const b of (G.bots && G.bots.bots) || []) {
        if (b.soldier && b.soldier.root) b.soldier.root.visible = false;
        const pl = plates && plates.get(b);
        if (pl && pl.sprite) pl.sprite.visible = false;
      }
      this._hidBots = true;
      this._pollPad();
    }
    if (this.director) this.director.update(dt);
  }

  _pollPad() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let a = false;
    for (const p of pads || []) if (p && p.buttons && p.buttons[0] && p.buttons[0].pressed) a = true;
    if (a && !this._padA) this.skip();
    this._padA = a;
  }

  /* ------------------------------------------------------------ Kinomodus */

  enterCinema(on) {
    const G = this.G;
    on = !!on;
    if (on === this.cinema) return;
    this.cinema = on;
    const P = G.player;
    if (on) {
      document.body.dataset.cutscene = '1';
      if (G.input) { G.input.setEnabled(false); try { G.input.cancelAds(); } catch { /* */ } }
      if (G.viewmodel) G.viewmodel.scene.visible = false;
      if (P && !P.vehicle) { P.invulnerable = true; this._inv = true; }
      if (this.ui) this.ui.setMode('cine');
    } else {
      delete document.body.dataset.cutscene;
      const st = G.match.state;
      if (G.input && (st === 'playing' || st === 'countdown')) G.input.setEnabled(true);
      if (G.viewmodel && !(P && P.vehicle)) G.viewmodel.scene.visible = true;
      if (P && this._inv) { P.invulnerable = false; this._inv = false; }
      if (this._hidBots) {
        this._hidBots = false;
        for (const b of (G.bots && G.bots.bots) || []) if (b.soldier && b.soldier.root && b.soldier.state !== 'hidden' && !b._vehHidden) b.soldier.root.visible = true;
      }
      if (this.ui) this.ui.setMode('play');
    }
  }

  skip() {
    if (this.director && this.director.cutscene) this.director.skipCutscene();
  }

  /* ------------------------------------------------------------ Spawns/Bots */

  chooseSpawn(actor) {
    const s = this.director ? this.director.spawnFor(actor) : null;
    return s || super.chooseSpawn(actor);
  }

  canRespawn(actor) {
    if (this.isOver || this.respawnHolds.has(actor)) return false;
    return this.director ? this.director.canRespawn(actor) : actor === this.G.player;
  }

  objectiveFor(bot) { return this.director ? this.director.objectiveFor(bot) : null; }

  /* ------------------------------------------------------------ Ergebnis */

  decide() { return { winner: this.success ? 'A' : 'B' }; }

  allowOvertime() { return false; }

  missionEnd(success) {
    if (this.isOver) return;
    const G = this.G;
    this.success = !!success;
    const secs = this.elapsed;
    let next = null;
    if (success) {
      try { this.store.completeMission(this.mission.id, G.match.difficulty, secs); } catch { /* */ }
      const i = MISSION_ORDER.indexOf(this.mission.id);
      next = MISSION_ORDER[i + 1] || null;
    }
    // Revanche nach dem Ende = ganze Mission von vorn
    if (G.lastConfig && G.lastConfig.campaign) G.lastConfig.campaign = { ...G.lastConfig.campaign, checkpoint: null };
    this.end(success ? 'mission' : 'failed');
    if (this.result) {
      this.result.campaign = { mission: this.mission.id, title: this.mission.title, number: this.mission.number, success: !!success, next, seconds: Math.round(secs), deaths: this.director ? this.director.deaths : 0, difficulty: G.match.difficulty };
      this.result.modeName = `Kampagne · Mission ${this.mission.number}: ${this.mission.title}`;
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
    else {
      this.missionEnd(false);
    }
  }

  /** Match neu starten ab Checkpoint (null = Missionsbeginn). Welt bleibt erhalten (gleiche Karte). */
  restartAt(checkpoint) {
    const G = this.G;
    const cfg = G.lastConfig ? { ...G.lastConfig, loadout: { ...G.lastConfig.loadout } } : { modeId: 'kampagne' };
    const first = this.mission.stages[0] && this.mission.stages[0].id;
    cfg.campaign = { mission: this.mission.id, checkpoint: checkpoint && checkpoint !== first ? checkpoint : null };
    if (G.debugApi && typeof G.debugApi.start === 'function') G.debugApi.start(cfg);
  }

  /** Endbildschirm ergänzen (ui/menus.js showEnd → G.campaign.decorateEnd bzw. Modul-Funktion). */
  decorateEnd(screen, result) { decorateCampaignEnd(this.G, screen, result); }

  /* ------------------------------------------------------------ Tests/Konsole */

  debug() {
    const d = this.director;
    return {
      mission: this.mission.id, stage: d ? d.mission.stages[d.stageIndex] && d.mission.stages[d.stageIndex].id : null, state: d ? d.state : null,
      cinema: this.cinema, objectives: d ? d.objs.map((o) => ({ id: o.id, text: o.text, done: o.done, count: o.count, total: o.total })) : [],
      waves: d ? [...d.waves.values()].map((w) => ({ id: w.id, alive: w.bots.filter((b) => b.alive).length, total: w.total })) : [],
      checkpoint: d ? d.checkpointId : null, deaths: d ? d.deaths : 0, faceMode: d && d.cutscene ? Object.values(d.cutscene.cast).map((a) => a.faceMode) : null,
      line: d && d.line ? d.line.text : null, timer: d ? d.timerLeft : null,
    };
  }

  /** Spieler zu einer Zone bzw. einem Punkt [x, z] teleportieren (Tests). */
  teleport(target) {
    const d = this.director, G = this.G;
    if (!d) return false;
    let p = null;
    if (typeof target === 'string') { const z = d.zones.get(target); if (z && z.c) p = z.c.clone(); }
    else if (Array.isArray(target)) p = d.vec(target);
    if (!p) return false;
    p.y += 0.2;
    G.player.body.teleport(p);
    G.match.unranked = true;
    return true;
  }

  /** Alle Gegner der Mission ausschalten (Tests). */
  killWaves() {
    const G = this.G;
    let n = 0;
    for (const b of [...G.actors]) if (b.alive && b.team === 'B' && G.combat) { G.combat.damage(b, { amount: 9999, attacker: G.player, zone: 'body' }); n++; }
    G.match.unranked = true;
    return n;
  }
}

/* ======================================================================== Endbildschirm */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function decorateCampaignEnd(G, screen, result) {
  const c = result && result.campaign;
  if (!c || !screen) return;
  const next = c.next ? MISSIONS[c.next] : null;
  const box = document.createElement('section');
  box.className = 'kc-end';
  box.innerHTML = `
    <style>
      .kc-end { margin: 10px auto 14px; max-width: 760px; padding: 14px 18px; border-left: 3px solid ${c.success ? 'var(--np-ok,#5fe08a)' : 'var(--np-enemy,#ff3b3b)'}; background: rgba(10,11,13,.72); }
      .kc-end small { letter-spacing: .2em; text-transform: uppercase; color: var(--np-signal,#ff5b1f); font-size: 11px; }
      .kc-end h3 { margin: 4px 0 6px; font-size: clamp(20px, 3vw, 30px); letter-spacing: .06em; text-transform: uppercase; }
      .kc-end p { margin: 0 0 10px; color: #cfcac0; font-size: 14px; }
      .kc-end .kc-end-btns { display: flex; flex-wrap: wrap; gap: 8px; }
      .kc-end button { min-height: 44px; padding: 0 16px; }
    </style>
    <small>Kampagne · Mission ${c.number}</small>
    <h3>${c.success ? 'Mission erfüllt' : 'Mission gescheitert'} – ${esc(c.title)}</h3>
    <p>Dauer ${Math.floor(c.seconds / 60)}:${String(c.seconds % 60).padStart(2, '0')} · Ausfälle ${c.deaths} · ${esc(({ rekrut: 'Rekrut', regulaer: 'Regulär', veteran: 'Veteran', elite: 'Elite' })[c.difficulty] || '')}${next ? ` · Als Nächstes: Mission ${next.number} „${esc(next.title)}“` : c.success && !next ? ' · Weitere Missionen folgen.' : ''}</p>
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
    if (act === 'next' && next) {
      const m = missionConfig(next, base);
      if (G.debugApi) G.debugApi.start(m);
    } else if (act === 'retry') {
      if (G.debugApi) G.debugApi.start({ ...base, campaign: { mission: c.mission, checkpoint: null } });
    } else if (act === 'menu') {
      if (G.menus && G.menus.lobby) G.menus.lobby.tab = 'kampagne';
      if (G.debugApi) G.debugApi.toLobby();
    }
  });
}

/** Startkonfiguration einer Mission (Lobby/Endbildschirm). */
export function missionConfig(mission, base = {}, { checkpoint = null, difficulty = null } = {}) {
  return {
    ...base,
    modeId: 'kampagne', mapId: mission.map, allies: 1, enemies: 1, mass: false,
    difficulty: difficulty || base.difficulty || 'regulaer',
    timeOfDay: mission.time || null, weather: mission.weather || null,
    timeLimit: null, scoreLimit: null, style: base.style || 'arcade',
    campaign: { mission: mission.id, checkpoint },
  };
}
