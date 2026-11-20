// NULLPUNKT — Panzer-Kampagne „Eisenwind“: Ansicht im Lobby-Reiter „Kampagne“ (Umschalter in campaign/menu.js).
// Missionsliste (p1…p6, der Reihe nach freigeschaltet), Details (Einsatzart, Karte, Panzer, Sichtgeräte, Ziele),
// Rollenwahl (Kommandant als Standard), Spielart (Simulation/Arcade), Führung, Schwierigkeit, Start ab Beginn/Checkpoint.
// Einstellungen: settings.modeOptions.pkampagne = { rolle, stil, fuehrung } (liest campaign/panzer/mode.js).
import { PZ_CAMPAIGN, PZ_MISSIONS, PZ_ORDER } from './missions.js?v=20261115041504';
import { pzMissionConfig } from './mode.js?v=20261115041504';
import { CampaignProgress } from '../progress.js?v=20261115041504';
import { CAMPAIGN_DIFF } from '../director.js?v=20261115041504';
import { VEHICLES } from '../../vehicles/data.js?v=20261115041504';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ROLES = [['kommandant', 'Kommandant'], ['richtschuetze', 'Richtschütze'], ['fahrer', 'Fahrer'], ['ladeschuetze', 'Ladeschütze'], ['mgschuetze', 'MG-Schütze/Funker']];
const STYLES = [['simulation', 'Simulation'], ['arcade', 'Arcade']];
const GUIDES = [['tutorial', 'Tutorial'], ['hilfe', 'Hilfe auf Anfrage'], ['aus', 'Aus']];
const ROLE_HINT = {
  kommandant: 'Du führst: Ziele übergeben, Munition und Feuer befehlen, Fahrbefehle. Die Besatzung arbeitet selbst.',
  richtschuetze: 'Du richtest und schießt in der Hauptzieloptik; der Kommandant weist Ziele zu.',
  fahrer: 'Du fährst: Motor anlassen, Bremse, Gang – die Befehle des Kommandanten stehen oben im Bild.',
  ladeschuetze: 'Du lädst jede Granate von Hand: wählen, greifen, einschieben, schließen, entsichern.',
  mgschuetze: 'Du bedienst Bug-MG und Funkgerät: Kanal 5 = Kompanie, Feuerstöße durch die Kugelblende, Gurtkästen von Hand wechseln.',
};

export class PanzerCampaignPane {
  constructor(pane) {
    this.pane = pane; // CampaignPane (campaign/menu.js)
    this.G = pane.G;
    this.store = new CampaignProgress(PZ_ORDER, PZ_ORDER);
    this.sel = null;
  }

  opts() {
    let o = {};
    try { o = { ...((this.G.settings.get('modeOptions') || {}).pkampagne || {}) }; } catch { o = {}; }
    return { rolle: o.rolle || 'kommandant', stil: o.stil || 'simulation', fuehrung: o.fuehrung || 'hilfe' };
  }

  setOpt(k, v) {
    try {
      const S = this.G.settings, all = { ...(S.get('modeOptions') || {}) };
      all.pkampagne = { ...(all.pkampagne || {}), [k]: v };
      S.set('modeOptions', all);
    } catch { /* ohne Speicher */ }
  }

  unlocked(id) { return !!(this.G.debug || this.store.unlocked(id)); }

  /** → true, wenn der Klick verarbeitet wurde. */
  click(b) {
    const ds = b.dataset, M = this.pane.menus;
    if (ds.pkSel) { this.sel = ds.pkSel; M.sound('click'); this.pane.render(); return true; }
    if (ds.pkOpt) { this.setOpt(ds.pkOpt, ds.pkVal); M.sound('click'); this.pane.render(); return true; }
    if (ds.pkDiff) { this.store.setDiff(ds.pkDiff); M.sound('click'); this.pane.render(); return true; }
    if (ds.pkGo) { this.start(ds.pkGo === 'cp'); return true; }
    return false;
  }

  start(fromCheckpoint = false) {
    const m = PZ_MISSIONS[this.sel];
    const M = this.pane.menus;
    if (!m || !this.unlocked(m.id) || !M.onStart) { M.sound('error'); return false; }
    const st = this.store.mission(m.id);
    const base = this.pane.lobby.config();
    const maps = (this.G.data && this.G.data.MAPS) || {};
    const mm = !maps[m.map] && m.mapFallback ? { ...m, map: m.mapFallback } : m;
    const cfg = pzMissionConfig(mm, base, { checkpoint: fromCheckpoint && st.checkpoint && !st.done ? st.checkpoint : null, difficulty: this.store.get().diff });
    M.sound('confirm');
    M.onStart(cfg);
    return true;
  }

  footLabel() { const m = PZ_MISSIONS[this.sel]; return m ? `Panzer-Mission ${m.number} starten` : 'Mission starten'; }

  html() {
    if (!this.sel) { const r = this.store.resumeTarget(); this.sel = r ? r.id : PZ_ORDER[0]; }
    const c = this.store.get();
    const diff = CAMPAIGN_DIFF[c.diff] ? c.diff : 'regulaer';
    const o = this.opts();
    const done = PZ_ORDER.filter((id) => this.store.mission(id).done).length;
    const sel = PZ_MISSIONS[this.sel] || PZ_MISSIONS[PZ_ORDER[0]];
    const st = this.store.mission(sel.id);
    const unlocked = this.unlocked(sel.id);
    const D = VEHICLES[sel.tank] || {};
    const optic = D.noThermal ? 'nur Optik und Winkelspiegel' : 'Wärmebild und Restlicht';
    const maps = (this.G.data && this.G.data.MAPS) || {};
    const mapName = (m) => (maps[m.map] ? maps[m.map].name : m.mapFallback && maps[m.mapFallback] ? maps[m.mapFallback].name : m.map);
    const items = PZ_ORDER.map((id) => {
      const m = PZ_MISSIONS[id], ms = this.store.mission(id), un = this.unlocked(id);
      const status = ms.done ? `<span class="kc-st ok">✓ ${esc(CAMPAIGN_DIFF[ms.best] ? CAMPAIGN_DIFF[ms.best].name : 'Erledigt')}</span>` : ms.checkpoint ? '<span class="kc-st cp">Checkpoint</span>' : un ? '<span class="kc-st">Offen</span>' : '<span class="kc-st">Gesperrt</span>';
      return `<li><button type="button" class="kc-item" data-pk-sel="${id}" aria-pressed="${id === sel.id}"><span class="kc-n">${m.number}</span><span><b>${esc(m.title)}</b><small>${esc(m.type)} · ${esc(mapName(m))} · ca. ${m.minutes} min</small></span>${status}</button></li>`;
    }).join('');
    const seg = (k, list, cur) => `<div class="kc-seg">${list.map(([id, n]) => `<button type="button" data-pk-opt="${k}" data-pk-val="${id}" aria-pressed="${id === cur}">${esc(n)}</button>`).join('')}</div>`;
    const hasCp = !!(st.checkpoint && !st.done && st.checkpoint !== 'start');
    return `<div class="kc-pane">
      <section class="kc-hero">
        <div><small>Panzer-Kampagne</small><h2>${esc(PZ_CAMPAIGN.title)}</h2><p>${esc(PZ_CAMPAIGN.summary)}</p></div>
        <div class="kc-prog"><small>Fortschritt</small><b>${done} von ${PZ_ORDER.length} Missionen</b><i><u style="transform:scaleX(${(done / PZ_ORDER.length).toFixed(3)})"></u></i></div>
      </section>
      <section><ul class="kc-list" role="list"><li class="kc-act">Eisenwind<small>${esc(PZ_CAMPAIGN.tagline)}</small></li>${items}</ul></section>
      <section class="kc-detail">
        <small class="k">Mission ${sel.number} · ${esc(sel.type)}</small>
        <h3>${esc(sel.title)}</h3>
        <div class="kc-meta"><span>Karte: ${esc(mapName(sel))}</span><span>Panzer: ${esc(D.name || sel.tank)}</span><span>Sicht: ${optic}</span><span>${sel.minutes ? `ca. ${sel.minutes} min` : ''}</span>${st.time ? `<span>Bestzeit ${Math.floor(st.time / 60)}:${String(st.time % 60).padStart(2, '0')}</span>` : ''}</div>
        <p>${esc(sel.summary)}</p>
        <ul>${(sel.goals || []).map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
        <div class="kc-opts">
          <div><label>Deine Rolle</label>${seg('rolle', ROLES, o.rolle)}<div class="kc-hint">${esc(o.stil === 'arcade' ? 'Arcade: Du fährst und schießt allein (Rolle gilt nur in der Simulation).' : ROLE_HINT[o.rolle] || '')} Im Einsatz wechselst du den Platz mit dem Sitzrad (K halten).</div></div>
          <div><label>Spielart</label>${seg('stil', STYLES, o.stil)}<div class="kc-hint">${o.stil === 'arcade' ? 'Fahren und schießen zugleich, Automatiklader, Außenansicht.' : 'Jeder Handgriff selbst, keine Außenansicht, KI-Besatzung auf den anderen Plätzen.'}</div></div>
          ${o.stil === 'simulation' ? `<div><label>Führung</label>${seg('fuehrung', GUIDES, o.fuehrung)}</div>` : ''}
          <div><label>Schwierigkeit</label><div class="kc-seg">${Object.entries(CAMPAIGN_DIFF).map(([id, d]) => `<button type="button" data-pk-diff="${id}" aria-pressed="${id === diff}">${esc(d.name)}</button>`).join('')}</div></div>
        </div>
        <div class="kc-btns">
          <button type="button" class="m-btn m-primary" data-pk-go="new"${unlocked ? '' : ' disabled'}>${unlocked ? 'Mission starten' : 'Gesperrt – vorige Mission abschließen'}</button>
          ${hasCp && unlocked ? `<button type="button" class="m-btn" data-pk-go="cp">Ab Checkpoint</button>` : ''}
        </div>
      </section>
    </div>`;
  }
}
