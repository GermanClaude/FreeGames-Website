// NULLPUNKT — Kampagne: Lobby-Reiter „Kampagne“ (ui/lobby.js bindet ihn ein).
// Inhalt: Titel und Fortschritt, „Fortsetzen“ (letzte Mission ab gespeichertem Checkpoint), Schwierigkeit, Lesetempo der
// Untertitel, Missionsliste der ganzen Kampagne (spielbar / gesperrt / in Vorbereitung) mit Details der gewählten
// Mission (Einsatzart, Karte, Ziele, Bestwert) und Start ab Beginn oder ab Checkpoint. Der Fußknopf der Lobby wird in
// diesem Reiter zu „Mission starten“ (data-act camp-start → start()).

import { CAMPAIGN, OUTLINE, ACTS, TO_BE_CONTINUED, TOTAL_MINUTES } from './outline.js?v=20261121041936';
import { MISSIONS, MISSION_ORDER, STORY_ORDER } from './missions/index.js?v=20261121041936';
import { CampaignProgress } from './progress.js?v=20261121041936';
import { CAMPAIGN_DIFF, CAMPAIGN_SIM } from './director.js?v=20261121041936';
import { missionConfig } from './mode.js?v=20261121041936';
import { ensureCampaignStyles } from './ui.js?v=20261121041936';
import { textToVisemes, sampleMouth } from './lipsync.js?v=20261121041936';
import { PanzerCampaignPane } from './panzer/menu.js?v=20261121041936'; // Panzer-Kampagne „Eisenwind“ (Umschalter oben)

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SPEEDS = [['langsam', 'Langsam'], ['normal', 'Normal'], ['schnell', 'Schnell']];

const CSS = `
.kc-pane { display: grid; grid-template-columns: minmax(240px, 1fr) minmax(280px, 1.25fr); gap: 18px; padding: 4px 2px 18px; }
.kc-pane .kc-hero { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 24px; padding: 16px 18px; border: 1px solid var(--np-line, rgba(233,230,223,.12));
  background: linear-gradient(110deg, rgba(255,91,31,.14), rgba(10,11,13,.4) 55%); }
.kc-pane .kc-hero small { display: block; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--np-signal, #ff5b1f); }
.kc-pane .kc-hero h2 { margin: 4px 0 4px; font-size: clamp(24px, 3.2vw, 38px); letter-spacing: .06em; text-transform: uppercase; }
.kc-pane .kc-hero p { margin: 0; max-width: 640px; color: var(--np-ink-2, #b9b5ac); font-size: 14px; line-height: 1.45; }
.kc-pane .kc-hero .kc-prog { margin-left: auto; text-align: right; min-width: 170px; }
.kc-pane .kc-hero .kc-prog b { display: block; font-size: 22px; }
.kc-pane .kc-hero .kc-prog i { display: block; height: 4px; margin-top: 6px; background: rgba(255,255,255,.12); }
.kc-pane .kc-hero .kc-prog i u { display: block; height: 100%; background: var(--np-signal, #ff5b1f); transform-origin: left; }
.kc-pane .kc-resume { width: 100%; margin-top: 10px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.kc-pane .kc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.kc-pane .kc-item { display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 9px 12px; min-height: 52px;
  border: 1px solid var(--np-line, rgba(233,230,223,.12)); background: rgba(17,19,22,.7); color: inherit; cursor: pointer; font: inherit; }
.kc-pane .kc-item:hover:not([disabled]) { border-color: var(--np-line-strong, rgba(233,230,223,.28)); }
.kc-pane .kc-item[aria-pressed="true"] { border-color: var(--np-signal, #ff5b1f); background: rgba(255,91,31,.1); }
.kc-pane .kc-item[disabled] { cursor: default; opacity: .5; }
.kc-pane .kc-item .kc-n { font-size: 20px; font-weight: 700; color: var(--np-dim, #77746d); text-align: center; }
.kc-pane .kc-item b { display: block; font-size: 15px; }
.kc-pane .kc-item small { display: block; font-size: 12px; color: var(--np-ink-2, #b9b5ac); }
.kc-pane .kc-item .kc-st { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--np-dim, #77746d); white-space: nowrap; }
.kc-pane .kc-item .kc-st.ok { color: var(--np-ok, #5fe08a); } .kc-pane .kc-item .kc-st.cp { color: var(--np-gold, #ffc23d); }
.kc-pane .kc-detail { border: 1px solid var(--np-line, rgba(233,230,223,.12)); background: rgba(17,19,22,.7); padding: 16px 18px; align-self: start; }
.kc-pane .kc-detail small.k { font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--np-signal, #ff5b1f); }
.kc-pane .kc-detail h3 { margin: 4px 0 6px; font-size: clamp(20px, 2.4vw, 28px); letter-spacing: .05em; text-transform: uppercase; }
.kc-pane .kc-detail .kc-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--np-ink-2, #b9b5ac); margin-bottom: 10px; }
.kc-pane .kc-detail p { font-size: 14px; line-height: 1.5; margin: 0 0 10px; color: #dcd8cf; }
.kc-pane .kc-detail ul { margin: 0 0 12px; padding-left: 18px; font-size: 13.5px; line-height: 1.5; color: #cfcac0; }
.kc-pane .kc-opts { display: flex; flex-direction: column; gap: 10px; margin: 12px 0; }
.kc-pane .kc-opts label { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--np-dim, #77746d); display: block; margin-bottom: 4px; }
.kc-pane .kc-seg { display: flex; flex-wrap: wrap; gap: 4px; }
.kc-pane .kc-seg button { min-height: 40px; padding: 0 12px; border: 1px solid var(--np-line, rgba(233,230,223,.12)); background: rgba(10,11,13,.6); color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
.kc-pane .kc-seg button[aria-pressed="true"] { border-color: var(--np-signal, #ff5b1f); background: rgba(255,91,31,.16); }
.kc-pane .kc-hint { font-size: 12px; color: var(--np-ink-2, #b9b5ac); margin-top: 4px; }
.kc-pane .kc-btns { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.kc-pane .kc-btns .m-btn { min-height: 44px; }
.kc-pane .kc-mouth { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--np-ink-2, #b9b5ac); }
.kc-pane .kc-mouth svg { width: 46px; height: 26px; }
.kc-pane .kc-act { list-style: none; margin: 10px 0 2px; padding: 0 2px; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--np-signal, #ff5b1f); }
.kc-pane .kc-act:first-child { margin-top: 0; }
.kc-pane .kc-act small { display: block; letter-spacing: .02em; text-transform: none; color: var(--np-ink-2, #b9b5ac); font-size: 12px; margin-top: 2px; }
.kc-pane .kc-new { display: inline-block; margin-left: 6px; padding: 1px 6px 2px; font-size: 10px; font-weight: 700; letter-spacing: .12em; vertical-align: 2px; color: #111; background: var(--np-gold, #ffc23d); border-radius: 2px; }
.kc-pane .kc-item.tbc { cursor: default; border-style: dashed; opacity: .75; }
.kc-pane .kc-item.tbc .kc-n { font-size: 16px; }
.kc-pane .kc-show { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
.kc-pane .kc-show span { font-size: 12px; padding: 3px 8px; border: 1px solid var(--np-line, rgba(233,230,223,.12)); background: rgba(10,11,13,.5); color: #dcd8cf; }
.kc-pane .kc-show span b { color: var(--np-gold, #ffc23d); font-weight: 600; margin-right: 4px; }
.kc-pane .kc-hero .kc-train { margin-left: 4px; }
.kc-which { display: flex; gap: 6px; margin: 0 2px 10px; flex-wrap: wrap; }
.kc-which button { min-height: 42px; padding: 0 16px; border: 1px solid var(--np-line, rgba(233,230,223,.12)); background: rgba(10,11,13,.6); color: inherit; font: inherit; font-size: 14px; letter-spacing: .04em; cursor: pointer; }
.kc-which button[aria-pressed="true"] { border-color: var(--np-signal, #ff5b1f); background: rgba(255,91,31,.16); }
@media (max-width: 760px), (max-height: 520px) {
  .kc-pane { grid-template-columns: 1fr; gap: 12px; }
  .kc-pane .kc-hero .kc-prog { margin-left: 0; text-align: left; }
}
@media (max-height: 520px) { .kc-pane .kc-hero p { display: none; } .kc-pane .kc-hero { padding: 10px 14px; } .kc-pane .kc-hero h2 { font-size: 22px; } }
`;

let styled = false;
function ensureStyles() {
  ensureCampaignStyles();
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.id = 'np-campaign-menu-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

export class CampaignPane {
  constructor(lobby) {
    this.lobby = lobby;
    this.menus = lobby.menus;
    this.G = lobby.G;
    this.store = new CampaignProgress(MISSION_ORDER, STORY_ORDER);
    this.sel = null;
    this.el = null;
    this._off = null;
    this._demo = 0;
    this.which = 'infanterie'; // 'infanterie' | 'panzer'
    this.pz = new PanzerCampaignPane(this);
  }

  _unlocked(id) { return !!(this.G.debug || this.store.unlocked(id)); }

  mount(el) {
    ensureStyles();
    this.el = el;
    if (!this.sel) {
      // Neue Spieler beginnen mit der Ausbildung, sonst „Fortsetzen“-Ziel
      const c = this.store.get();
      const played = Object.values(c.missions || {}).some((m) => m && m.plays > 0);
      const r = this.store.resumeTarget();
      const tut = MISSION_ORDER.find((id) => MISSIONS[id].tutorial);
      this.sel = !played && tut ? tut : r ? r.id : MISSION_ORDER[0];
    }
    if (!el._kcBound) {
      el._kcBound = true;
      el.addEventListener('click', (e) => this._click(e));
    }
    this.render();
  }

  unmount() {
    if (this._demo) cancelAnimationFrame(this._demo);
    this._demo = 0;
    this.el = null;
  }

  _click(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled || !this.el) return;
    const ds = b.dataset;
    if (ds.kcWhich) { this.which = ds.kcWhich; this.menus.sound('click'); this.render(); return; }
    if (this.which === 'panzer' && this.pz.click(b)) return;
    if (ds.kcSel) { this.sel = ds.kcSel; this.menus.sound('click'); this.render(); return; }
    if (ds.kcDiff) { this.store.setDiff(ds.kcDiff); this.menus.sound('click'); this.render(); return; }
    if (ds.kcSpeed) { this.store.setSpeed(ds.kcSpeed); this.menus.sound('click'); this.render(); this._previewMouth(); return; }
    if (ds.kcGo) { this.start(ds.kcGo === 'cp'); return; }
    if (ds.kcTrain) { this.sel = ds.kcTrain; this.start(false); return; }
    if (ds.kcResume != null) { const r = this.store.resumeTarget(); if (r) { this.sel = r.id; this.start(!!r.checkpoint); } }
  }

  /** Startet die gewählte Mission (fromCheckpoint: ab gespeichertem Checkpoint). */
  start(fromCheckpoint = false) {
    if (this.which === 'panzer') return this.pz.start(fromCheckpoint);
    const m = MISSIONS[this.sel];
    if (!m || !this._unlocked(m.id) || !this.menus.onStart) { this.menus.sound('error'); return false; }
    const st = this.store.mission(m.id);
    const base = this.lobby.config();
    const cfg = missionConfig(m, base, { checkpoint: fromCheckpoint && st.checkpoint && !st.done ? st.checkpoint : null, difficulty: this.store.get().diff });
    this.menus.sound('confirm');
    try { this.lobby.saveClassLoadout(); } catch { /* */ }
    this.menus.onStart(cfg);
    return true;
  }

  /** Fußknopf-Beschriftung (lobby._renderStart). */
  footLabel() {
    if (this.which === 'panzer') return this.pz.footLabel();
    const m = MISSIONS[this.sel];
    if (!m) return 'Mission starten';
    return m.tutorial ? 'Ausbildung starten' : `Mission ${m.number} starten`;
  }

  /**
   * Lobby (ui/lobby.js mount): neue Kampagnenkapitel nach einem Update dezent melden (einmal) und den Reiter markieren.
   */
  announce(screen) {
    ensureStyles();
    if (typeof document !== 'undefined' && !document.getElementById('np-campaign-news-css')) {
      const st = document.createElement('style');
      st.id = 'np-campaign-news-css';
      st.textContent = NEWS_CSS;
      document.head.appendChild(st);
    }
    const added = this.store.syncNew();
    const tab = screen && screen.querySelector('.m-tab[data-tab="kampagne"]');
    if (tab) tab.classList.toggle('kc-dot', this.store.fresh().length > 0);
    if (!added.length || !screen) return;
    const ms = added.map((id) => MISSIONS[id]).filter(Boolean);
    if (!ms.length) return;
    const first = ms[0];
    const names = ms.slice(0, 3).map((m) => `${m.tutorial ? '' : `M${m.number} `}„${esc(m.title)}“`).join(', ') + (ms.length > 3 ? ` und ${ms.length - 3} weitere` : '');
    const box = document.createElement('div');
    box.className = 'kc-news';
    box.setAttribute('role', 'status');
    box.innerHTML = `<div><small>${ms.length > 1 ? 'Neue Kampagnenkapitel' : 'Neues Kampagnenkapitel'}</small><b>${names}</b></div>
      <button type="button" class="m-btn m-primary" data-tab="kampagne" data-kc-news="${first.id}">Ansehen</button><button type="button" class="kc-x" aria-label="Hinweis schließen" data-kc-x>×</button>`;
    const host = screen.querySelector('.lb') || screen;
    host.appendChild(box);
    const close = () => { box.remove(); };
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.kcNews) this.sel = b.dataset.kcNews;
      close();
    });
    setTimeout(close, 14000);
  }

  render() {
    const el = this.el;
    if (!el) return;
    // gesamt 20.11.: Fußzeile (Zusammenfassung) folgt dem Umschalter Stille Grenze / Eisenwind
    if (this.lobby && this.lobby.tab === 'kampagne' && typeof this.lobby._renderSummary === 'function') { try { this.lobby._renderSummary(); } catch { /* */ } }
    const which = `<div class="kc-which" role="tablist"><button type="button" data-kc-which="infanterie" aria-pressed="${this.which !== 'panzer'}">Stille Grenze · Infanterie</button><button type="button" data-kc-which="panzer" aria-pressed="${this.which === 'panzer'}">Eisenwind · Panzer</button></div>`;
    if (this.which === 'panzer') {
      el.innerHTML = which + this.pz.html();
      if (this.lobby && typeof this.lobby._renderStart === 'function') this.lobby._renderStart();
      return;
    }
    const c = this.store.get();
    const done = this.store.doneCount();
    const resume = this.store.resumeTarget();
    const rm = resume ? MISSIONS[resume.id] : null;
    const DIFFS = { ...CAMPAIGN_DIFF, simulation: CAMPAIGN_SIM }; // + Infanteriesimulation
    const diff = DIFFS[c.diff] ? c.diff : 'regulaer';
    const sel = MISSIONS[this.sel] || null;
    const outSel = OUTLINE.find((o) => o.id === this.sel) || OUTLINE[0];
    const st = sel ? this.store.mission(sel.id) : null;
    const fresh = this.store.fresh();
    const item = (o) => {
      const m = MISSIONS[o.id];
      const playable = !!m;
      const unlocked = playable && this._unlocked(o.id);
      const ms = playable ? this.store.mission(o.id) : null;
      const status = !playable ? '<span class="kc-st">In Vorbereitung</span>'
        : ms.done ? `<span class="kc-st ok">✓ ${esc(DIFFS[ms.best] ? DIFFS[ms.best].name : 'Erledigt')}</span>`
          : ms.checkpoint ? '<span class="kc-st cp">Checkpoint</span>'
            : unlocked ? '<span class="kc-st">Offen</span>' : '<span class="kc-st">Gesperrt</span>';
      const isNew = playable && fresh.includes(o.id) ? '<i class="kc-new">NEU</i>' : '';
      const n = o.tutorial ? 'A' : o.n;
      return `<li><button type="button" class="kc-item" data-kc-sel="${o.id}" aria-pressed="${o.id === this.sel}"${playable ? '' : ' disabled'}>
        <span class="kc-n">${n}</span><span><b>${esc(o.title)}${isNew}</b><small>${esc(o.type)} · ${esc(this._mapName(o.map, o.mapFallback))}${o.minutes ? ` · ca. ${o.minutes} min` : ''}</small></span>${status}</button></li>`;
    };
    const acts = ACTS.map((a) => {
      const list = OUTLINE.filter((o) => (o.act || 1) === a.n);
      if (!list.length) return '';
      return `<li class="kc-act">${esc(a.title)}<small>${esc(a.summary)}</small></li>${list.map(item).join('')}`;
    }).join('');
    const tbc = `<li><div class="kc-item tbc"><span class="kc-n">…</span><span><b>${esc(TO_BE_CONTINUED.title)}</b><small>${esc(TO_BE_CONTINUED.text)}</small></span><span class="kc-st">Mit Updates</span></div></li>`;
    const unlocked = sel && this._unlocked(sel.id);
    const hasCp = !!(st && st.checkpoint && !st.done && sel.stages.some((s) => s.id === st.checkpoint) && st.checkpoint !== sel.stages[0].id);
    const cpName = hasCp ? this._cpName(sel, st.checkpoint) : '';
    const storyTotal = OUTLINE.filter((o) => !o.tutorial).length;
    const storyDone = STORY_ORDER.filter((id) => this.store.mission(id).done).length;
    const hours = (TOTAL_MINUTES / 60).toFixed(1).replace('.', ',');
    const show = this._showcase(outSel);
    const tut = MISSION_ORDER.find((id) => MISSIONS[id].tutorial);
    el.innerHTML = `${which}<div class="kc-pane">
      <section class="kc-hero">
        <div><small>Kampagne</small><h2>${esc(CAMPAIGN.title)}</h2><p>${esc(CAMPAIGN.summary)}</p></div>
        <div class="kc-prog"><small>Fortschritt</small><b>${storyDone} von ${storyTotal} Missionen</b><span class="kc-hint">${MISSION_ORDER.length} Kapitel spielbar · ca. ${hours} h Spielzeit</span><i><u style="transform:scaleX(${(storyDone / Math.max(1, storyTotal)).toFixed(3)})"></u></i></div>
        <div class="kc-resume">${rm ? `<button type="button" class="m-btn m-primary" data-kc-resume>Fortsetzen: Mission ${rm.number} „${esc(rm.title)}“${resume.checkpoint ? ` · ab ${esc(this._cpName(rm, resume.checkpoint))}` : ''}</button>` : '<span class="kc-hint">Alle verfügbaren Missionen erledigt – weitere folgen mit kommenden Updates.</span>'}
          ${tut ? `<button type="button" class="m-btn kc-train" data-kc-train="${tut}">Ausbildung${this.store.mission(tut).done ? ' ✓' : ''}</button>` : ''}</div>
      </section>
      <section><ul class="kc-list" role="list">${acts}${tbc}</ul></section>
      <section class="kc-detail">
        <small class="k">${outSel.tutorial ? esc(outSel.type) : `Mission ${outSel.n} · ${esc(outSel.type)}`}</small>
        <h3>${esc(outSel.title)}${sel && fresh.includes(sel.id) ? '<i class="kc-new">NEU</i>' : ''}</h3>
        <div class="kc-meta"><span>Karte: ${esc(this._mapName(outSel.map, outSel.mapFallback))}</span>${outSel.minutes ? `<span>ca. ${outSel.minutes} min</span>` : ''}${sel ? `<span>${sel.stages.length} Abschnitte mit Checkpoint</span>` : ''}${st && st.time ? `<span>Bestzeit ${Math.floor(st.time / 60)}:${String(st.time % 60).padStart(2, '0')}</span>` : ''}</div>
        <p>${esc(sel ? sel.summary : outSel.story)}</p>
        ${show ? `<div class="kc-show">${show}</div>` : ''}
        <ul>${(outSel.goals || []).map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
        <div class="kc-opts">
          <div><label>Schwierigkeit</label><div class="kc-seg">${Object.entries(DIFFS).map(([id, d]) => `<button type="button" data-kc-diff="${id}" aria-pressed="${id === diff}">${esc(d.name)}</button>`).join('')}</div><div class="kc-hint">${esc(DIFFS[diff].hint)}</div></div>
          <div><label>Untertitel-Tempo</label><div class="kc-seg">${SPEEDS.map(([id, n]) => `<button type="button" data-kc-speed="${id}" aria-pressed="${id === c.speed}">${n}</button>`).join('')}</div>
            <div class="kc-hint kc-mouth"><svg viewBox="0 0 46 26" aria-hidden="true"><ellipse cx="23" cy="13" rx="15" ry="2" fill="#160807" stroke="#ff9a6b" stroke-width="1.4"/></svg><span>Keine Sprachausgabe: Dialoge als Untertitel, die Figuren bewegen dazu den Mund.</span></div></div>
        </div>
        <div class="kc-btns">
          ${sel ? `<button type="button" class="m-btn m-primary" data-kc-go="new"${unlocked ? '' : ' disabled'}>${unlocked ? (sel.tutorial ? 'Ausbildung starten' : 'Mission starten') : 'Gesperrt – vorige Mission abschließen'}</button>` : '<span class="kc-hint">Diese Mission ist in Vorbereitung.</span>'}
          ${hasCp && unlocked ? `<button type="button" class="m-btn" data-kc-go="cp">Ab Checkpoint „${esc(cpName)}“</button>` : ''}
        </div>
      </section>
    </div>`;
    const tab = this.lobby && this.lobby.el && this.lobby.el.screen && this.lobby.el.screen.querySelector('.m-tab[data-tab="kampagne"]');
    if (tab) tab.classList.toggle('kc-dot', fresh.length > 0);
    if (this.lobby && typeof this.lobby._renderStart === 'function') this.lobby._renderStart();
  }

  /** „Stellt vor“-Chips (outline showcase: karten, waffen, fahrzeuge). */
  _showcase(o) {
    const s = o && o.showcase;
    if (!s) return '';
    const W = (this.G.data && this.G.data.WEAPONS) || {};
    const VEH = { heli: 'Hubschrauber', jet: 'Kampfjet', mbt: 'Kampfpanzer', jeep: 'Geländewagen', transporter: 'Transporter', pkw: 'Pkw' };
    const out = [];
    for (const k of s.karten || []) out.push(`<span><b>Karte</b>${esc(this._mapName(k))}</span>`);
    for (const k of s.waffen || []) out.push(`<span><b>Waffe</b>${esc(W[k] ? W[k].name : k)}</span>`);
    for (const k of s.fahrzeuge || []) out.push(`<span><b>Fahrzeug</b>${esc(VEH[k] || k)}</span>`);
    return out.length ? `<span style="border:0;background:none;padding-left:0;color:var(--np-dim,#77746d)">Stellt vor:</span>${out.join('')}` : '';
  }

  _mapName(id, fallback = null) {
    const M = (this.G.data && this.G.data.MAPS) || {};
    const NAMES = { flugplatz: 'Flugplatz', stadtkern: 'Stadtkern' };
    if (M[id] && M[id].name) return M[id].name;
    if (fallback && M[fallback]) return `${NAMES[id] || id} (vorläufig: ${M[fallback].name})`;
    return NAMES[id] || id;
  }

  _cpName(m, id) {
    const st = m && m.stages ? m.stages.find((s) => s.id === id) : null;
    if (st && st.name) return st.name;
    const names = { start: 'Beginn', markt: 'Marktgasse', torhaus: 'Torhaus', turm: 'Brunnenplatz', welle1: 'Erste Welle', welle2: 'Zweite Welle', welle3: 'Letzte Welle', dorf: 'Dorf', bruecke: 'Brücke' };
    return names[id] || id;
  }
  /** Lesetempo: kleine Mund-Vorschau im Menü (Ellipse folgt einem Beispielsatz). */
  _previewMouth() {
    const svg = this.el && this.el.querySelector('.kc-mouth ellipse');
    if (!svg) return;
    if (this._demo) cancelAnimationFrame(this._demo);
    const track = textToVisemes('Funkstille seit drei Stunden. Wir gehen rein.', { cps: this.store.cps() });
    const t0 = performance.now();
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      const m = sampleMouth(track, t);
      svg.setAttribute('ry', String(1.5 + 9 * m.open));
      svg.setAttribute('rx', String(9 + 9 * m.wide - 4 * m.round));
      if (t < track.duration && this.el) this._demo = requestAnimationFrame(step); else this._demo = 0;
    };
    step();
  }
}

/* ======================================================================== Lobby-Hinweis „Neues Kampagnenkapitel“ */

const NEWS_CSS = `
.kc-news { position: absolute; right: 18px; top: 64px; z-index: 30; max-width: min(380px, calc(100vw - 32px)); display: flex; gap: 10px; align-items: center; padding: 10px 12px 10px 14px;
  background: rgba(14,15,18,.94); border: 1px solid var(--np-line, rgba(233,230,223,.16)); border-left: 3px solid var(--np-gold, #ffc23d); box-shadow: 0 6px 22px rgba(0,0,0,.4);
  font-size: 13px; line-height: 1.35; color: #e6e2d9; animation: kc-news-in .45s ease-out; }
.kc-news small { display: block; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--np-gold, #ffc23d); }
.kc-news b { font-weight: 600; }
.kc-news .m-btn { min-height: 38px; padding: 0 12px; font-size: 13px; white-space: nowrap; }
.kc-news .kc-x { min-width: 38px; min-height: 38px; border: 0; background: none; color: #b9b5ac; font-size: 18px; cursor: pointer; }
@keyframes kc-news-in { from { opacity: 0; transform: translateY(-6px); } }
.m-tab[data-tab="kampagne"].kc-dot { position: relative; }
.m-tab[data-tab="kampagne"].kc-dot::after { content: ''; position: absolute; top: 6px; right: 6px; width: 7px; height: 7px; border-radius: 50%; background: var(--np-gold, #ffc23d); }
@media (max-width: 760px), (max-height: 520px) { .kc-news { top: auto; bottom: 74px; right: 12px; } }
`;
