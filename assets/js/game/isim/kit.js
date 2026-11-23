// NULLPUNKT — Infanteriesimulation: Ausrüstung mit Plätzen und Gewicht (Spielstil „Simulation“).
//
// Weste (schneller Zugriff): Magazintaschen (4 für die Langwaffe, 2 für die Pistole), 2 Granattaschen (tödlich/taktisch),
// Erste-Hilfe-Tasche (2 Verbandpäckchen, 1 Abbindesystem). Rucksack (langsam, nur über das Ausrüstungsmenü): übrige
// Magazine, weitere Granaten, Ersatzverband, Wasser. Nachladen greift nur aus der Weste; Granaten werfen nur aus der
// Granattasche; Verband/Abbinden aus der Erste-Hilfe-Tasche (sonst dauert es länger – erst den Rucksack öffnen).
// Gewicht: Grundausstattung + Schutzweste + Waffen (weapons.data handling.mass) + Magazine mit echtem Füllstand + Granaten
// + Sanitätsmaterial → Belastung (Ausdauer, Tempo, Schwanken; isim/body.js). Obergrenze 42 kg: darüber nimmt man nichts auf.
import { weaponHandling } from '../../shared/weapons.data.js?v=20261123082814';

export const LIMIT_KG = 42;
const BASE_KG = 7.5;           // Uniform, Stiefel, Helm, Koppel, Wasser, Rucksack leer
const ROUND_KG = { pistol: 0.008, smg: 0.009, shotgun: 0.04, ar: 0.012, lmg: 0.025, marksman: 0.024, sniper: 0.026 };
const MAG_KG = { pistol: 0.08, smg: 0.12, ar: 0.13, marksman: 0.16, sniper: 0.16, lmg: 0.35 };
const VEST_MAGS = { primary: 4, secondary: 2 };
let _id = 1;

export class SimKit {
  constructor(sim) {
    this.sim = sim;
    this.G = sim.G;
    this.items = [];   // { id, kind: 'mag'|'granate'|'verband'|'abbinde', where: 'weste'|'rucksack', wid, cls, n, cap, eq, slot }
    this.packed = false;
  }

  /** Neu packen (Spawn): Granaten, Sanitätsmaterial; Magazine legt gun.of() je Waffe an (ensureMags). */
  pack(ctrl) {
    this.items.length = 0;
    this._magsFor = new Set();
    for (const slot of ['lethal', 'tactical']) {
      const e = ctrl && ctrl.equipment && ctrl.equipment[slot];
      if (!e || !e.id) continue;
      for (let i = 0; i < (e.count | 0); i++) this.items.push({ id: _id++, kind: 'granate', where: i === 0 ? 'weste' : 'rucksack', eq: e.id, slot });
    }
    this.items.push({ id: _id++, kind: 'verband', where: 'weste' }, { id: _id++, kind: 'verband', where: 'weste' }, { id: _id++, kind: 'abbinde', where: 'weste' });
    this.items.push({ id: _id++, kind: 'verband', where: 'rucksack' });
    this.packed = true;
  }

  /** Ersatzmagazine einer Waffe (einmal je Leben): Vorrat des Controllers → volle Magazine, Weste zuerst. */
  ensureMags(def, st) {
    if (!this._magsFor) this._magsFor = new Set();
    if (this._magsFor.has(def.id)) return;
    this._magsFor.add(def.id);
    const cap = def.mag | 0;
    let left = Math.max(0, st.reserve | 0);
    const vest = def.slot === 'secondary' || def.cls === 'pistol' ? VEST_MAGS.secondary : VEST_MAGS.primary;
    let inVest = 0;
    while (left > 0) {
      const n = Math.min(cap, left);
      left -= n;
      this.items.push({ id: _id++, kind: 'mag', where: inVest < vest ? 'weste' : 'rucksack', wid: def.id, cls: def.cls, n, cap });
      inVest++;
    }
  }

  mags(wid, where = null) { return this.items.filter((x) => x.kind === 'mag' && x.wid === wid && (!where || x.where === where)); }
  roundsFor(wid) { let n = 0; for (const x of this.items) if (x.kind === 'mag' && x.wid === wid) n += x.n; return n; }
  hasMagInPack(wid) { return this.mags(wid, 'rucksack').some((m) => m.n > 0); }
  vestFree(wid) {
    const it = this.items.find((x) => x.kind === 'mag' && x.wid === wid);
    const cls = it ? it.cls : 'ar';
    const cap = cls === 'pistol' ? VEST_MAGS.secondary : VEST_MAGS.primary;
    return Math.max(0, cap - this.mags(wid, 'weste').length);
  }

  /** Bestes (vollstes) Magazin aus der Weste – nur ansehen, nicht entnehmen (insertMag nimmt es heraus). */
  takeBestMag(wid, vestOnly = true) {
    let best = null;
    for (const m of this.mags(wid, vestOnly ? 'weste' : null)) if (m.n > 0 && (!best || m.n > best.n)) best = m;
    return best;
  }

  removeMag(m) { const i = this.items.indexOf(m); if (i >= 0) this.items.splice(i, 1); }

  /** Altes Magazin zurück in die Tasche (taktisch) – Weste, wenn Platz ist, sonst Rucksack (Abwurfsack). */
  stowMag(def, n, cap) {
    const where = this.vestFree(def.id) > 0 ? 'weste' : 'rucksack';
    this.items.push({ id: _id++, kind: 'mag', where, wid: def.id, cls: def.cls, n, cap });
  }

  /** Aufgesammelte Patronen (Munition an der Leiche): als Magazine in den Rucksack, Weste zuerst, solange das Gewicht reicht. */
  addLoose(def, rounds) {
    const cap = def.mag | 0;
    if (!(cap > 0)) return;
    // zuerst angebrochene leere/halbe Magazine füllen, dann neue (gefundene) Magazine
    for (const m of this.mags(def.id)) { if (rounds <= 0) break; const k = Math.min(cap - m.n, rounds); m.n += k; rounds -= k; }
    while (rounds > 0 && this.weight() < LIMIT_KG) {
      const n = Math.min(cap, rounds);
      rounds -= n;
      this.items.push({ id: _id++, kind: 'mag', where: this.vestFree(def.id) > 0 ? 'weste' : 'rucksack', wid: def.id, cls: def.cls, n, cap });
    }
    if (rounds > 0) this.sim.event('zuSchwer');
  }

  /* ---------------------------------------------------------------- Granaten / Sanität */

  canThrow(slot) { return this.items.some((x) => x.kind === 'granate' && x.slot === slot && x.where === 'weste'); }
  /** Controller hat geworfen (Zählerstand kleiner als das Kit) → aus der Granattasche nehmen. */
  syncGrenades(ctrl) {
    for (const slot of ['lethal', 'tactical']) {
      const e = ctrl.equipment && ctrl.equipment[slot];
      if (!e) continue;
      const mine = this.items.filter((x) => x.kind === 'granate' && x.slot === slot);
      let diff = mine.length - (e.count | 0);
      while (diff > 0) { const g = mine.find((x) => x.where === 'weste') || mine[0]; this.items.splice(this.items.indexOf(g), 1); mine.splice(mine.indexOf(g), 1); diff--; }
      while (diff < 0) { this.items.push({ id: _id++, kind: 'granate', where: this.canThrow(slot) ? 'rucksack' : 'weste', eq: e.id, slot }); diff++; }
    }
  }

  /** Sanitätsmaterial nehmen: Weste zuerst (schnell), sonst Rucksack (langsam). → 'weste' | 'rucksack' | null */
  takeMed(kind) {
    const it = this.items.find((x) => x.kind === kind && x.where === 'weste') || this.items.find((x) => x.kind === kind);
    if (!it) return null;
    this.items.splice(this.items.indexOf(it), 1);
    return it.where;
  }
  count(kind, where = null) { return this.items.filter((x) => x.kind === kind && (!where || x.where === where)).length; }

  /* ---------------------------------------------------------------- Umpacken (Ausrüstungsmenü) */

  /** Magazine aus dem Rucksack in freie Westentaschen (volle zuerst). → Anzahl */
  repackMags(wid) {
    let free = this.vestFree(wid), k = 0;
    const pack = this.mags(wid, 'rucksack').filter((m) => m.n > 0).sort((a, b) => b.n - a.n);
    for (const m of pack) { if (free <= 0) break; m.where = 'weste'; free--; k++; }
    return k;
  }
  /** Leere Magazine aus der Weste in den Rucksack (Platz schaffen). → Anzahl */
  stowEmpties(wid) {
    let k = 0;
    for (const m of this.mags(wid, 'weste')) if (m.n === 0) { m.where = 'rucksack'; k++; }
    return k;
  }
  /** Angebrochene Magazine zusammenlegen: Patronen in die vollsten umfüllen. → Anzahl umgefüllter Patronen */
  consolidate(wid) {
    const ms = this.mags(wid).filter((m) => m.n < m.cap).sort((a, b) => b.n - a.n);
    let moved = 0;
    let i = 0, j = ms.length - 1;
    while (i < j) {
      const a = ms[i], b = ms[j];
      const k = Math.min(a.cap - a.n, b.n);
      a.n += k; b.n -= k; moved += k;
      if (a.n >= a.cap) i++;
      if (b.n <= 0) j--;
    }
    return moved;
  }
  /** Granaten und Verbandszeug aus dem Rucksack in die Westentaschen. → Anzahl */
  repackGear() {
    let k = 0;
    for (const slot of ['lethal', 'tactical']) {
      if (this.canThrow(slot)) continue;
      const g = this.items.find((x) => x.kind === 'granate' && x.slot === slot && x.where === 'rucksack');
      if (g) { g.where = 'weste'; k++; }
    }
    while (this.count('verband', 'weste') < 2) { const v = this.items.find((x) => x.kind === 'verband' && x.where === 'rucksack'); if (!v) break; v.where = 'weste'; k++; }
    return k;
  }

  /* ---------------------------------------------------------------- Gewicht */

  weight() {
    const P = this.G.player;
    let kg = BASE_KG;
    const ar = P && P.armor;
    if (ar && ar.maxHp > 0) kg += 3 + Math.min(9, ar.maxHp / 25);
    const ctrl = P && P.weapon;
    if (ctrl) for (const st of ctrl.slots) if (st && st.def && st.def.cls !== 'melee') kg += weaponHandling(st.def).mass || 3;
    for (const x of this.items) {
      if (x.kind === 'mag') kg += (MAG_KG[x.cls] || 0.13) + x.n * (ROUND_KG[x.cls] || 0.012);
      else if (x.kind === 'granate') kg += 0.45;
      else if (x.kind === 'verband') kg += 0.12;
      else if (x.kind === 'abbinde') kg += 0.08;
    }
    return kg;
  }

  /** Grobe Beschreibung der Ersatzmagazine (Gefühl, keine Zahl je Magazin). */
  magSummary(wid) {
    const v = this.mags(wid, 'weste'), r = this.mags(wid, 'rucksack');
    const full = (L) => L.filter((m) => m.n >= m.cap * 0.9).length, part = (L) => L.filter((m) => m.n > 0 && m.n < m.cap * 0.9).length, empty = (L) => L.filter((m) => m.n === 0).length;
    const parts = [];
    if (v.length) parts.push(`Weste ${full(v)} voll${part(v) ? `, ${part(v)} angebrochen` : ''}${empty(v) ? `, ${empty(v)} leer` : ''}`);
    else parts.push('Weste leer');
    if (r.length) parts.push(`Rucksack ${full(r) + part(r)}${empty(r) ? ` (+${empty(r)} leer)` : ''}`);
    return parts.join(' · ');
  }

  /** Einträge für das Ausrüstungsmenü. */
  rows(where) {
    const out = [];
    const W = this.G.data && this.G.data.WEAPONS ? this.G.data.WEAPONS : {};
    const EQ = this.G.data && this.G.data.EQUIPMENT ? this.G.data.EQUIPMENT : {};
    const groups = new Map();
    for (const x of this.items) {
      if (x.where !== where) continue;
      let key, label;
      if (x.kind === 'mag') {
        const st = x.n === 0 ? 'leer' : x.n >= x.cap * 0.9 ? 'voll' : x.n >= x.cap * 0.45 ? 'halb' : 'fast leer';
        key = `m:${x.wid}:${st}`; label = `Magazin ${W[x.wid] ? W[x.wid].name : x.wid} (${st})`;
      } else if (x.kind === 'granate') { key = `g:${x.eq}`; label = EQ[x.eq] ? EQ[x.eq].name : 'Granate'; }
      else if (x.kind === 'verband') { key = 'v'; label = 'Verbandpäckchen'; }
      else { key = 'a'; label = 'Abbindesystem'; }
      const g = groups.get(key) || { label, n: 0 };
      g.n++;
      groups.set(key, g);
    }
    for (const g of groups.values()) out.push(g);
    return out;
  }
}
