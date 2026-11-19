// NULLPUNKT — Kampagne: Fortschritt im Spielerprofil (shared/profile.js getCampaign/setCampaign, localStorage).
// Je Mission: erledigt, beste Schwierigkeit, letzter Checkpoint (für „Fortsetzen“), Versuche, beste Zeit; dazu die
// zuletzt gespielte Mission, Lesetempo der Untertitel und die gewählte Schwierigkeit. Freischaltung: die Ausbildung
// (tutorial) ist immer offen; eine Geschichtsmission ist spielbar, wenn die vorige Geschichtsmission erledigt ist (die
// erste immer). Ohne Speicher (privates Fenster) läuft alles im Speicher.
//
// Neu im Update: ack = Kapitel, die der Spieler schon kennt; fresh = neue, noch nicht gestartete Kapitel (Abzeichen
// „NEU“ im Menü). syncNew() gleicht mit den spielbaren Kapiteln ab: Wer die Kampagne schon kannte (Missionen gespielt),
// bekommt Kapitel mit since > Ausgangsstand als „neu“ gemeldet (Lobby-Hinweis, einmal); neue Spieler kennen alles.

import { profile } from '../../shared/profile.js?v=20261119182451';
import { READING_SPEEDS } from './lipsync.js?v=20261119182451';
import { OUTLINE, CAMPAIGN_BASE_BUILD } from './outline.js?v=20261119182451';

const DIFF_RANK = { rekrut: 0, regulaer: 1, veteran: 2, elite: 3 };
const stamp = (s) => String(s || '').replace(/\D/g, '').padEnd(14, '0').slice(0, 14);

export class CampaignProgress {
  /** order: spielbare Missions-Ids (Kampagnenreihenfolge); story: davon die Geschichtsmissionen (ohne Ausbildung). */
  constructor(order, story = order) {
    this.order = order;
    this.story = story;
  }

  get() {
    try { return profile.getCampaign(); } catch { return { missions: {}, current: null, speed: 'normal', diff: 'regulaer' }; }
  }

  _set(fn) {
    const c = this.get();
    fn(c);
    try { return profile.setCampaign(c); } catch { return c; }
  }

  mission(id) { return this.get().missions[id] || { done: false, best: null, diff: null, checkpoint: null, time: 0, plays: 0, at: 0 }; }

  unlocked(id) {
    if (!this.order.includes(id)) return false;
    const i = this.story.indexOf(id);
    if (i < 0) return true; // Ausbildung
    if (i === 0) return true;
    return !!this.mission(this.story[i - 1]).done;
  }

  doneCount() { const c = this.get(); return this.order.filter((id) => c.missions[id] && c.missions[id].done).length; }

  /** Nächste offene Mission (oder die zuletzt gespielte mit Checkpoint) für „Fortsetzen“. */
  resumeTarget() {
    const c = this.get();
    const cur = c.current && this.order.includes(c.current) ? c.current : null;
    if (cur && c.missions[cur] && c.missions[cur].checkpoint && !c.missions[cur].done) return { id: cur, checkpoint: c.missions[cur].checkpoint };
    const open = this.story.find((id) => !(c.missions[id] && c.missions[id].done) && this.unlocked(id));
    if (open) return { id: open, checkpoint: (c.missions[open] && c.missions[open].checkpoint) || null };
    return null;
  }

  startMission(id, diff) {
    return this._set((c) => {
      const m = c.missions[id] || (c.missions[id] = { done: false, best: null, diff: null, checkpoint: null, time: 0, plays: 0, at: 0 });
      m.plays = (m.plays | 0) + 1;
      m.diff = diff;
      m.at = Date.now();
      c.current = id;
      c.diff = diff;
      if (Array.isArray(c.fresh)) c.fresh = c.fresh.filter((x) => x !== id);
    });
  }

  saveCheckpoint(id, cp, diff) {
    return this._set((c) => {
      const m = c.missions[id] || (c.missions[id] = { done: false, best: null, diff, checkpoint: null, time: 0, plays: 1, at: Date.now() });
      m.checkpoint = cp;
      m.diff = diff;
      c.current = id;
    });
  }

  completeMission(id, diff, seconds) {
    return this._set((c) => {
      const m = c.missions[id] || (c.missions[id] = { done: false, best: null, diff, checkpoint: null, time: 0, plays: 1, at: Date.now() });
      m.done = true;
      m.checkpoint = null;
      if (!m.best || DIFF_RANK[diff] > DIFF_RANK[m.best]) m.best = diff;
      if (seconds > 0 && (!m.time || seconds < m.time)) m.time = Math.round(seconds);
      const i = this.story.indexOf(id);
      c.current = i >= 0 ? this.story[i + 1] || id : c.current;
    });
  }

  setSpeed(speed) { return this._set((c) => { c.speed = READING_SPEEDS[speed] ? speed : 'normal'; }); }
  setDiff(diff) { return this._set((c) => { c.diff = DIFF_RANK[diff] != null ? diff : 'regulaer'; }); }
  cps() { return READING_SPEEDS[this.get().speed] || READING_SPEEDS.normal; }

  /* ------------------------------------------------------------ Neu im Update */

  /** Ids der Kapitel mit Abzeichen „NEU“ (neu und noch nicht gestartet). */
  fresh() { const c = this.get(); return Array.isArray(c.fresh) ? c.fresh.filter((id) => this.order.includes(id)) : []; }
  isFresh(id) { return this.fresh().includes(id); }

  /**
   * Abgleich mit den spielbaren Kapiteln → Liste der eben erst bemerkten neuen Kapitel (für den Lobby-Hinweis; beim
   * nächsten Aufruf leer). Ohne Profilspeicher bleibt alles still.
   */
  syncNew() {
    const c = this.get();
    const ids = this.order;
    const known = Array.isArray(c.ack) ? c.ack : null;
    const played = Object.values(c.missions || {}).some((m) => m && m.plays > 0);
    let add = [];
    let ack;
    if (!known) {
      // Erster Abgleich: Wer schon gespielt hat, kannte die Kapitel bis zum Ausgangsstand; neue Spieler kennen alles
      const base = stamp(CAMPAIGN_BASE_BUILD);
      const sinceOf = (id) => stamp((OUTLINE.find((o) => o.id === id) || {}).since || CAMPAIGN_BASE_BUILD);
      ack = played ? ids.filter((id) => sinceOf(id) <= base) : ids.slice();
      add = played ? ids.filter((id) => sinceOf(id) > base) : [];
    } else {
      add = ids.filter((id) => !known.includes(id));
      ack = known;
    }
    if (!add.length && known) return [];
    this._set((cc) => {
      cc.ack = [...new Set([...ack, ...add])];
      cc.fresh = [...new Set([...(Array.isArray(cc.fresh) ? cc.fresh : []), ...add])];
    });
    return add;
  }
}
