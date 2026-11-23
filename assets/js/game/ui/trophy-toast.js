// NULLPUNKT — Trophäen im Spiel (13.11.): prüft nach eigenen Abschüssen und Medaillen das Profil plus den laufenden
// Match-Stand (Abschüsse, Kopftreffer, Serie, Weitschuss, Medaillen, Waffen-Abschüsse) und blendet neu erreichte
// Trophäen oben rechts ein. Gespeichert werden sie erst am Match-Ende (profile.recordMatch) – ungewertete Matches
// (Gottmodus, Testlimits) und der Schießstand zeigen deshalb keinen Hinweis.

import { trophyView, TROPHY_TIERS } from '../../shared/trophies.data.js?v=20261123082814';
import { ICON } from './icons.js?v=20261123082814';
import { esc } from './dom.js?v=20261123082814';

const TOAST_LIFE = 4600; // ms (CSS-Animation tr-toast)

export class TrophyToasts {
  constructor(G) {
    this.G = G;
    this.seen = new Set();
    this.queue = [];
    this.el = null;
    this._timer = 0;
    this._check = 0;
    const ev = G.events;
    ev.on('match:start', () => this.reset());
    ev.on('kill', (e) => { if (e && e.killer && e.killer === G.player && e.victim !== G.player) this.schedule(); });
    ev.on('medal', (e) => { if (e && e.actor === G.player) this.schedule(); });
  }

  reset() {
    this.seen.clear();
    this.queue.length = 0;
    try { for (const t of trophyView(this._snapshot(false))) if (t.done) this.seen.add(t.id); } catch { /* */ }
  }

  schedule() {
    if (this._check) return;
    this._check = setTimeout(() => { this._check = 0; this.evaluate(); }, 120);
  }

  /** Profil + laufendes Match des Spielers (nur Werte, die sich im Match ändern). */
  _snapshot(live = true) {
    const G = this.G;
    let p;
    try { p = G.profile.get(); } catch { return {}; }
    const a = live && G.player;
    if (!a) return p;
    const st = a.stats || {};
    p.kills = (p.kills | 0) + (st.kills | 0);
    p.headshots = (p.headshots | 0) + (st.headshots | 0);
    p.bestStreak = Math.max(p.bestStreak | 0, st.bestStreak | 0);
    p.longestKill = Math.max(Number(p.longestKill) || 0, Number(st.longestKill) || 0);
    p.trophies = p.trophies || { done: {}, maps: {}, best: {} };
    p.trophies.best = { ...(p.trophies.best || {}), matchKills: Math.max((p.trophies.best || {}).matchKills | 0, st.kills | 0) };
    const medals = (G.mode && G.mode.medals && typeof G.mode.medals.medalsOf === 'function') ? G.mode.medals.medalsOf(a) || {} : {};
    p.medals = { ...(p.medals || {}) };
    for (const [id, n] of Object.entries(medals)) p.medals[id] = (p.medals[id] | 0) + (n | 0);
    p.weaponStats = { ...(p.weaponStats || {}) };
    for (const [id, w] of Object.entries(a.weaponStats || {})) {
      const old = p.weaponStats[id] || {};
      p.weaponStats[id] = { ...old, kills: (old.kills | 0) + ((w && w.kills) | 0) };
    }
    return p;
  }

  evaluate() {
    const G = this.G;
    const m = G.match || {};
    if (m.unranked || m.modeId === 'training' || m.state !== 'playing') return;
    let rows;
    try { rows = trophyView(this._snapshot(true)); } catch (err) { console.error('[NULLPUNKT] Trophäen-Prüfung:', err); return; }
    for (const t of rows) {
      if (!t.done || this.seen.has(t.id)) continue;
      this.seen.add(t.id);
      this.queue.push(t);
    }
    if (!this._timer) this._next();
  }

  _next() {
    const t = this.queue.shift();
    if (!t) { this._timer = 0; if (this.el) { this.el.remove(); this.el = null; } return; }
    if (this.el) this.el.remove();
    const el = document.createElement('div');
    el.className = `tr-toast tier-${t.tier}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="tr-ico">${ICON[t.icon || 'trophy'] || ICON.trophy}</span><span><small>Trophäe · ${esc(TROPHY_TIERS[t.tier].name)}</small><b>${esc(t.name)}</b><span class="t">${esc(t.text)}</span></span>`;
    // In die HUD-Ebene (liegt über der Spielfläche, wird mit dem HUD ausgeblendet); ohne HUD an den Body
    const host = (this.G.hud && this.G.hud.root) || document.body;
    if (host !== document.body) el.classList.add('in-hud');
    host.appendChild(el);
    this.el = el;
    try { this.G.events.emit('ui:sound', { name: 'medal' }); } catch { /* */ }
    this._timer = setTimeout(() => this._next(), TOAST_LIFE);
  }
}
