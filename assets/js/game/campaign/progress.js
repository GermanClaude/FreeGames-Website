// NULLPUNKT — Kampagne: Fortschritt im Spielerprofil (shared/profile.js getCampaign/setCampaign, localStorage).
// Je Mission: erledigt, beste Schwierigkeit, letzter Checkpoint (für „Fortsetzen“), Versuche, beste Zeit; dazu die
// zuletzt gespielte Mission, Lesetempo der Untertitel und die gewählte Schwierigkeit. Freischaltung: Mission n ist
// spielbar, wenn Mission n−1 erledigt ist (die erste immer). Ohne Speicher (privates Fenster) läuft alles im Speicher.

import { profile } from '../../shared/profile.js?v=20261114004313';
import { READING_SPEEDS } from './lipsync.js?v=20261114004313';

const DIFF_RANK = { rekrut: 0, regulaer: 1, veteran: 2, elite: 3 };

export class CampaignProgress {
  constructor(order) {
    this.order = order; // Missions-Ids in Kampagnenreihenfolge (spielbare)
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
    const i = this.order.indexOf(id);
    if (i <= 0) return i === 0;
    return !!this.mission(this.order[i - 1]).done;
  }

  doneCount() { const c = this.get(); return this.order.filter((id) => c.missions[id] && c.missions[id].done).length; }

  /** Nächste offene Mission (oder die zuletzt gespielte mit Checkpoint) für „Fortsetzen“. */
  resumeTarget() {
    const c = this.get();
    const cur = c.current && this.order.includes(c.current) ? c.current : null;
    if (cur && c.missions[cur] && c.missions[cur].checkpoint && !c.missions[cur].done) return { id: cur, checkpoint: c.missions[cur].checkpoint };
    const open = this.order.find((id) => !(c.missions[id] && c.missions[id].done));
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
      const i = this.order.indexOf(id);
      c.current = this.order[i + 1] || id;
    });
  }

  setSpeed(speed) { return this._set((c) => { c.speed = READING_SPEEDS[speed] ? speed : 'normal'; }); }
  setDiff(diff) { return this._set((c) => { c.diff = DIFF_RANK[diff] != null ? diff : 'regulaer'; }); }
  cps() { return READING_SPEEDS[this.get().speed] || READING_SPEEDS.normal; }
}
