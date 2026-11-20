// NULLPUNKT — Trupps des Modus „Trupp“ (game/modes/trupp.js): Trupps zu 4–9 Plätzen mit Truppführer, Rollen mit Höchstzahl je
// Trupp (shared/trupp.data.js), Beitreten/Verlassen/Erstellen/Sperren, Führung übernehmen/abgeben. Menschen (Spieler,
// Mitspieler online) bekommen ihren Wunsch-Trupp und ihre Wunschrolle, Bots füllen die Trupps auf und erhalten die Rolle
// aus ihrer Klasse/Waffe (bots/ai/squad.js). Bots tauschen ihre Ausrüstung nicht – überzählige Rollen heißen „Schütze“.
// Gleiche API wie SquadSystem (Eroberung): list, of(actor), members(sq, {alive}), leaderOf(actor), order(sq, order, by),
// clearOrder(sq), dispose(); dazu join/leave/create/setRole/lock/promote. Entscheidet offline bzw. der Host; das Abbild
// (Client) baut die Trupps aus dem Modus-Zustand nach (applyNet).
import { SquadSystem } from './squads.js?v=20261115041504';
import { TRUPP_NAMES, TRUPP_COLORS, TRUPP_ROLES, TRUPP_DEFAULT_ROLE, TRUPP_SIZE_DEFAULT, roleLimit, roleFromBot } from '../../shared/trupp.data.js?v=20261115041504';
import { WEAPONS } from '../../shared/weapons.data.js?v=20261115041504';

const isHuman = (a) => !!(a && (a.isPlayer || a.isRemoteHuman));

export class TruppSquads extends SquadSystem {
  constructor(G, mode, size = TRUPP_SIZE_DEFAULT) {
    super(G);
    this.mode = mode;
    this.size = Math.max(2, Math.min(9, size | 0 || TRUPP_SIZE_DEFAULT));
    this.prefs = new Map(); // Akteur → { squad: 'auto'|'neu'|Name, role }
    this.serial = 0; // Änderungszähler (HUD/Netz)
  }

  /** Wunsch eines Menschen (Lobby bzw. Client-Anfrage vor dem Start). */
  setPref(actor, pref) {
    if (!actor) return;
    const cur = this.prefs.get(actor) || {};
    this.prefs.set(actor, { ...cur, ...pref });
  }

  /* ------------------------------------------------------------ Aufbau */

  build() {
    const G = this.G;
    for (const a of G.actors) { a.squad = null; a.squadLabel = null; }
    this.list = [];
    this._byTeam = { A: [], B: [] };
    for (const team of ['A', 'B']) {
      const pool = G.actors.filter((a) => a.team === team && !a.isStreakEntity);
      const humans = pool.filter(isHuman);
      const bots = pool.filter((a) => !isHuman(a));
      // Menschen zuerst: Wunsch-Trupp, „neu“ oder der erste Trupp mit Platz
      for (const h of humans) {
        const pref = this.prefs.get(h) || {};
        let sq = null;
        if (pref.squad && pref.squad !== 'auto' && pref.squad !== 'neu') sq = this._byTeam[team].find((s) => s.name === pref.squad && this._room(s));
        if (!sq && pref.squad !== 'neu') sq = this._byTeam[team].find((s) => this._room(s) && !s.locked);
        if (!sq) sq = this._make(team, []);
        this._join(sq, h);
      }
      // Bots: Trupps der Menschen auffüllen, dann eigene Trupps (in Erzeugungsreihenfolge = Feuerteams der Trupptaktik)
      for (const b of bots) {
        let sq = this._byTeam[team].find((s) => this._room(s) && !s.locked);
        if (!sq) sq = this._make(team, []);
        this._join(sq, b);
      }
      for (const sq of this._byTeam[team]) this._assignRoles(sq);
    }
    this.serial++;
  }

  _room(sq) {
    return this.members(sq).length < sq.size;
  }

  _make(team, members) {
    const list = this._byTeam[team];
    const used = new Set(list.map((s) => s.index));
    let index = 0;
    while (used.has(index)) index++;
    const name = TRUPP_NAMES[index % TRUPP_NAMES.length] + (index >= TRUPP_NAMES.length ? `-${Math.floor(index / TRUPP_NAMES.length) + 1}` : '');
    const sq = {
      id: `${team}-${index}`, team, index, name, label: name, color: TRUPP_COLORS[index % TRUPP_COLORS.length], size: this.size, locked: false,
      members: [], leader: null, order: null, orderAt: 0, orderBy: null, targetAt: 0,
    };
    list.push(sq);
    list.sort((x, y) => x.index - y.index);
    this.list.push(sq);
    for (const m of members) this._join(sq, m);
    this.serial++;
    return sq;
  }

  _join(sq, a) {
    if (a.squad && a.squad !== sq) this._remove(a.squad, a);
    if (!sq.members.includes(a)) sq.members.push(a);
    a.squad = sq;
    a.squadLabel = sq.name;
    if (!a.truppRole) a.truppRole = this._wantRole(a);
    this.serial++;
  }

  _remove(sq, a) {
    const i = sq.members.indexOf(a);
    if (i >= 0) sq.members.splice(i, 1);
    if (a.squad === sq) { a.squad = null; a.squadLabel = null; }
    if (sq.leader === a) { sq.leader = null; if (a.truppRole === 'truppfuehrer') a.truppRole = TRUPP_DEFAULT_ROLE; }
    this.serial++;
  }

  /** Leeren Trupp auflösen. */
  _prune(sq) {
    if (this.members(sq).length) return;
    const l = this._byTeam[sq.team];
    const i = l.indexOf(sq);
    if (i >= 0) l.splice(i, 1);
    const j = this.list.indexOf(sq);
    if (j >= 0) this.list.splice(j, 1);
    this.serial++;
  }

  /** Wunschrolle: Menschen aus prefs, Bots aus Klasse/Waffe. */
  _wantRole(a) {
    if (isHuman(a)) {
      const p = this.prefs.get(a);
      return p && TRUPP_ROLES[p.role] ? p.role : TRUPP_DEFAULT_ROLE;
    }
    const lo = a.loadout || {};
    return roleFromBot({ role: a.role, cls: a.cls, primaryCls: WEAPONS[lo.primary] && WEAPONS[lo.primary].cls, secondaryCls: WEAPONS[lo.secondary] && WEAPONS[lo.secondary].cls });
  }

  /** Rollen eines Trupps nach den Höchstzahlen ordnen; Führer: Mensch mit Wunsch Truppführer, sonst ein Bot, sonst Mensch. */
  _assignRoles(sq) {
    const mem = this.members(sq);
    let lead = sq.leader && mem.includes(sq.leader) ? sq.leader : null;
    if (!lead || !isHuman(lead)) {
      const wants = mem.find((m) => isHuman(m) && this._wantRole(m) === 'truppfuehrer');
      if (wants) lead = wants;
    }
    if (!lead) lead = mem.find((m) => !isHuman(m) && m.role === 'leader') || mem.find((m) => !isHuman(m)) || mem[0] || null;
    sq.leader = lead;
    const count = {};
    // Menschen haben Vorrang bei begrenzten Rollen
    const order = [...mem].sort((x, y) => (isHuman(y) ? 1 : 0) - (isHuman(x) ? 1 : 0));
    for (const m of order) {
      let r = m === lead ? 'truppfuehrer' : (m.truppRole && m.truppRole !== 'truppfuehrer' ? m.truppRole : this._wantRole(m));
      if (r === 'truppfuehrer' && m !== lead) r = TRUPP_DEFAULT_ROLE;
      if ((count[r] || 0) >= roleLimit(r, sq.size)) r = TRUPP_DEFAULT_ROLE;
      count[r] = (count[r] || 0) + 1;
      m.truppRole = r;
    }
    this.serial++;
  }

  /** Anzahl einer Rolle im Trupp (ohne `except`). */
  roleCount(sq, role, except = null) {
    return this.members(sq).filter((m) => m !== except && m.truppRole === role).length;
  }

  /* ------------------------------------------------------------ Laufendes Spiel */

  /** Trupp eines Akteurs; spät hinzugekommene (Bots online, neue Mitspieler) kommen in den ersten Trupp mit Platz. */
  of(actor) {
    if (!actor || (actor.team !== 'A' && actor.team !== 'B') || actor.isStreakEntity) return null;
    if (actor.squad && actor.squad.team === actor.team && this.list.includes(actor.squad)) return actor.squad;
    if (this.mode && this.mode.replica) return null; // Abbild: Trupps kommen vom Host
    const list = this._byTeam[actor.team];
    let sq = list.find((s) => !s.locked && this._room(s));
    if (!sq) sq = this._make(actor.team, []);
    actor.truppRole = null;
    this._join(sq, actor);
    this._assignRoles(sq);
    return sq;
  }

  /** Beitreten (Mensch): Platz frei, nicht gesperrt (außer für den, der ihn erstellt hat). → Fehlertext | null */
  join(actor, sq) {
    if (!actor || !sq || sq.team !== actor.team) return 'Falsches Team.';
    if (actor.squad === sq) return null;
    if (sq.locked) return 'Trupp ist gesperrt.';
    if (!this._room(sq)) {
      // Menschen verdrängen einen Bot (der wechselt in einen anderen Trupp)
      const bot = this.members(sq).filter((m) => !isHuman(m) && m !== sq.leader).pop() || this.members(sq).find((m) => !isHuman(m));
      if (!bot) return 'Trupp ist voll.';
      this._remove(sq, bot);
      bot.truppRole = null;
      const dest = this._byTeam[sq.team].find((s) => s !== sq && !s.locked && this._room(s)) || this._make(sq.team, []);
      this._join(dest, bot);
      this._assignRoles(dest);
    }
    const old = actor.squad;
    if (old) { this._remove(old, actor); this._assignRoles(old); }
    actor.truppRole = this._keepRole(actor, sq);
    this._join(sq, actor);
    this._assignRoles(sq);
    if (old) this._prune(old);
    return null;
  }

  /** Neuen Trupp erstellen und führen; Bots aus reinen Bot-Trupps füllen ihn auf. */
  create(actor, { fill = true } = {}) {
    if (!actor || (actor.team !== 'A' && actor.team !== 'B')) return null;
    const old = actor.squad;
    if (old) { this._remove(old, actor); this._assignRoles(old); }
    const sq = this._make(actor.team, []);
    this._join(sq, actor);
    sq.leader = actor;
    actor.truppRole = 'truppfuehrer';
    if (old) this._prune(old);
    if (fill) this.fill(sq);
    this._assignRoles(sq);
    return sq;
  }

  /** Verlassen: eigener neuer Trupp (allein, ohne Bots). */
  leave(actor) {
    if (!actor || !actor.squad) return null;
    return this.create(actor, { fill: false });
  }

  /** Bots aus Trupps ohne Menschen in `sq` holen, bis er voll ist (nicht bei gesperrten Trupps). */
  fill(sq) {
    if (!sq || sq.locked) return 0;
    let n = 0;
    const donors = this._byTeam[sq.team].filter((s) => s !== sq && !this.members(s).some(isHuman)).sort((x, y) => this.members(y).length - this.members(x).length);
    for (const d of donors) {
      while (this._room(sq)) {
        const b = this.members(d).filter((m) => m !== d.leader).pop() || (this.members(d).length === 1 ? this.members(d)[0] : null);
        if (!b) break;
        this._remove(d, b);
        b.truppRole = null;
        this._join(sq, b);
        n++;
      }
      this._assignRoles(d);
      this._prune(d);
      if (!this._room(sq)) break;
    }
    return n;
  }

  /** Rolle wählen (Mensch). → Fehlertext | null */
  setRole(actor, role) {
    const sq = actor && actor.squad;
    const r = TRUPP_ROLES[role];
    if (!sq || !r) return 'Unbekannte Rolle.';
    if (actor.truppRole === role) return null;
    if (role === 'truppfuehrer') return this.takeLead(actor);
    if (this.roleCount(sq, role, actor) >= roleLimit(role, sq.size)) {
      // Bots geben begrenzte Rollen an Menschen ab
      const bot = this.members(sq).find((m) => m !== actor && !isHuman(m) && m.truppRole === role);
      if (!bot) return `${r.name}: im Trupp schon vergeben.`;
      bot.truppRole = TRUPP_DEFAULT_ROLE;
    }
    if (sq.leader === actor) {
      // Führung abgeben: an einen anderen Menschen, sonst einen Bot
      const next = this.members(sq).find((m) => m !== actor && isHuman(m)) || this.members(sq).find((m) => m !== actor);
      sq.leader = next || actor;
      if (next) next.truppRole = 'truppfuehrer';
      if (!next) return 'Allein im Trupp: du bleibst Truppführer.';
    }
    actor.truppRole = role;
    this.setPref(actor, { role });
    this.serial++;
    return null;
  }

  /** Führung übernehmen: ein Bot-Führer tritt ab; ein menschlicher nicht. */
  takeLead(actor) {
    const sq = actor && actor.squad;
    if (!sq) return 'Kein Trupp.';
    if (sq.leader === actor) return null;
    const cur = sq.leader;
    if (cur && isHuman(cur) && this.members(sq).includes(cur)) return `${cur.name || 'Ein Mitspieler'} führt diesen Trupp.`;
    if (cur) cur.truppRole = TRUPP_DEFAULT_ROLE;
    sq.leader = actor;
    actor.truppRole = 'truppfuehrer';
    this.setPref(actor, { role: 'truppfuehrer' });
    this.serial++;
    return null;
  }

  /** Truppführer ernennt ein anderes Mitglied. */
  promote(by, target) {
    const sq = by && by.squad;
    if (!sq || sq.leader !== by || !target || target.squad !== sq || target === by) return 'Nicht möglich.';
    by.truppRole = TRUPP_DEFAULT_ROLE;
    sq.leader = target;
    target.truppRole = 'truppfuehrer';
    this.serial++;
    return null;
  }

  lock(by, on = null) {
    const sq = by && by.squad;
    if (!sq || sq.leader !== by) return 'Nur der Truppführer.';
    sq.locked = on == null ? !sq.locked : !!on;
    this.serial++;
    return null;
  }

  /** Rolle beim Wechsel behalten, wenn im neuen Trupp Platz ist. */
  _keepRole(actor, sq) {
    const r = actor.truppRole && actor.truppRole !== 'truppfuehrer' ? actor.truppRole : this._wantRole(actor);
    return this.roleCount(sq, r, actor) < roleLimit(r, sq.size) ? r : TRUPP_DEFAULT_ROLE;
  }

  byId(id) {
    return this.list.find((s) => s.id === id) || null;
  }

  teamList(team) {
    return (this._byTeam[team] || []).slice();
  }

  /* ------------------------------------------------------------ Netz (Abbild) */

  /** Zustand: [id, Team, Name, Index, Plätze, gesperrt, Führer-netId, [[netId, Rolle], …], Befehl, Ziel]. */
  netList() {
    const out = [];
    for (const sq of this.list) {
      const mem = this.members(sq).filter((m) => Number.isInteger(m.netId)).map((m) => [m.netId, m.truppRole || TRUPP_DEFAULT_ROLE]);
      out.push([sq.id, sq.team, sq.name, sq.index, sq.size, sq.locked ? 1 : 0, sq.leader && Number.isInteger(sq.leader.netId) ? sq.leader.netId : 0, mem,
        sq.order ? sq.order.kind : '', sq.order ? sq.order.objectiveId : '']);
    }
    return out;
  }

  /** Abbild: Trupps aus dem Zustand des Hosts. find(netId) → Akteur. */
  applyNet(rows, find) {
    if (!Array.isArray(rows)) return;
    const seen = new Set();
    for (const a of this.G.actors) { a.squad = null; a.squadLabel = null; }
    const keep = new Map(this.list.map((s) => [s.id, s]));
    this.list = [];
    this._byTeam = { A: [], B: [] };
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 8) continue;
      const [id, team, name, index, size, locked, lead, mem, ok, oid] = row;
      if ((team !== 'A' && team !== 'B') || seen.has(id)) continue;
      seen.add(id);
      const sq = keep.get(id) || { id, team, members: [], order: null, orderAt: 0, orderBy: null, targetAt: 0 };
      sq.team = team; sq.name = String(name).slice(0, 24); sq.label = sq.name; sq.index = index | 0; sq.size = Math.max(1, Math.min(9, size | 0));
      sq.color = TRUPP_COLORS[sq.index % TRUPP_COLORS.length];
      sq.locked = !!locked;
      sq.members = [];
      sq.leader = null;
      for (const [nid, role] of Array.isArray(mem) ? mem : []) {
        const a = find(nid);
        if (!a) continue;
        sq.members.push(a);
        a.squad = sq;
        a.squadLabel = sq.name;
        a.truppRole = TRUPP_ROLES[role] ? role : TRUPP_DEFAULT_ROLE;
        if (nid === lead) sq.leader = a;
      }
      const prev = sq.order;
      sq.order = ok && oid ? { kind: ok === 'defend' ? 'defend' : 'attack', objectiveId: String(oid), label: '', at: prev && prev.objectiveId === oid ? prev.at : this.G.time.elapsed } : null;
      this._byTeam[team].push(sq);
      this.list.push(sq);
    }
    this.serial++;
  }

  dispose() {
    super.dispose();
    for (const a of this.G.actors) a.truppRole = null;
    this.prefs.clear();
  }
}
