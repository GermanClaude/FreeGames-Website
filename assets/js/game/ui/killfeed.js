// NULLPUNKT — Abschussmeldungen: Schütze · Waffen-Silhouette (aus den Daten) · Kopfschuss/Explosion · Opfer.
// Farben: du (gold), Verbündete (blau), Gegner (rot). Einträge blenden nach 5 s aus.

import { esc, weaponName } from './dom.js?v=20261114060746';
import { ICON } from './icons.js?v=20261114060746';

const LIFE = 5.2;

export class Killfeed {
  constructor(G, host, { max = 6 } = {}) {
    this.G = G;
    this.host = host;
    this.max = max;
    this.rows = [];
  }

  side(a) {
    const p = this.G.player;
    if (!a) return 'neutral';
    if (a === p || (a.isStreakEntity && a.owner === p)) return 'me';
    const team = a.isStreakEntity ? a.team : a.team;
    if (p && p.team != null && team === p.team && this.G.mode && this.G.mode.teams) return 'ally';
    return 'enemy';
  }

  weaponIcon(id) {
    const D = this.G.data || {};
    const W = D.WEAPONS || {};
    const EQ = D.EQUIPMENT || {};
    const S = D.STREAKS || {};
    if (W[id] && W[id].icon) return `<span class="kf-gun">${W[id].icon}</span>`;
    if (EQ[id] && EQ[id].icon) return `<span class="kf-ico">${EQ[id].icon}</span>`;
    if (S[id] && S[id].icon) return `<span class="kf-ico">${S[id].icon}</span>`;
    if (id === 'fall') return `<span class="kf-ico">${ICON.fall}</span>`;
    const vi = this.G.vehicles && this.G.vehicles.weaponIcon ? this.G.vehicles.weaponIcon(id) : null; // vehicles
    if (vi) return `<span class="kf-ico">${vi}</span>`;
    return `<span class="kf-ico">${ICON.skull}</span>`;
  }

  /** Abschuss eintragen (Payload des 'kill'-Ereignisses). */
  pushKill({ victim, killer, weaponId, headshot, explosive, suicide }, { weapons = true } = {}) {
    if (!victim) return;
    if (!weapons) { weaponId = 'world'; headshot = false; explosive = false; } // Realistisch: Killfeed ohne Waffe
    const label = weaponName(this.G, weaponId);
    let html;
    const flags = `${headshot ? `<span class="kf-flag kf-hs" title="Kopftreffer">${ICON.head}</span>` : ''}${explosive && weaponId !== 'strike' ? `<span class="kf-flag">${ICON.explosion}</span>` : ''}`;
    if (killer && !suicide && killer !== victim) {
      const kname = killer.isStreakEntity ? (killer.owner ? killer.owner.name : killer.name) : killer.name;
      html = `<span class="kf-name kf-${this.side(killer)}">${esc(kname)}</span><span class="kf-w" title="${esc(label)}">${this.weaponIcon(weaponId)}${flags}</span><span class="kf-name kf-${this.side(victim)}">${esc(victim.name)}</span>`;
    } else {
      html = `<span class="kf-w" title="${esc(label)}">${this.weaponIcon(weaponId)}</span><span class="kf-name kf-${this.side(victim)}">${esc(victim.name)}</span>`;
    }
    const mine = killer === this.G.player || victim === this.G.player || (killer && killer.isStreakEntity && killer.owner === this.G.player);
    // masse: große Schlachten – fremde Abschüsse höchstens alle 0,7 s einzeln, dazwischen als Sammelzeile „+N weitere“
    if (!mine && this.G.actors && this.G.actors.length > 64) {
      const now = this.G.time ? this.G.time.real : 0;
      if (now - (this._otherAt ?? -1e9) < 0.7) { this._more(); return; }
      this._otherAt = now;
    }
    this._push(html, mine ? 'is-mine' : '');
  }

  /** masse: Sammelzeile für unterdrückte fremde Abschüsse (eine, wird hochgezählt und lebt dabei neu auf). */
  _more() {
    const r = this._moreRow;
    if (r && this.rows.includes(r) && !r.out) {
      r.n++;
      r.t = LIFE;
      r.row.lastChild.textContent = `+${r.n} weitere Abschüsse`;
      return;
    }
    this._push('<span class="kf-name kf-neutral"></span>', 'kf-text kf-more');
    const row = this.rows[0];
    row.n = 1;
    row.row.lastChild.textContent = '+1 weiterer Abschuss';
    this._moreRow = row;
  }

  /** Freier Eintrag (z. B. Geschütz zerstört, Flagge erobert). */
  pushText(html, cls = '') {
    this._push(html, `kf-text ${cls}`);
  }

  _push(html, cls) {
    const row = document.createElement('div');
    row.className = `kf-row ${cls}`;
    row.innerHTML = html;
    this.host.prepend(row);
    this.rows.unshift({ row, t: LIFE });
    while (this.rows.length > this.max) this.rows.pop().row.remove();
  }

  update(dt) {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      const r = this.rows[i];
      r.t -= dt;
      if (r.t < 0.6 && !r.out) { r.out = true; r.row.classList.add('is-out'); }
      if (r.t <= 0) { r.row.remove(); this.rows.splice(i, 1); }
    }
  }

  clear() {
    for (const r of this.rows) r.row.remove();
    this.rows = [];
    this._moreRow = null;
    this._otherAt = -1e9;
  }
}
