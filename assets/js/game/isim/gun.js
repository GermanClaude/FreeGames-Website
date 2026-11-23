// NULLPUNKT — Infanteriesimulation: Waffenhandhabung (Spielstil „Simulation“, Nutzer 19.11.).
//
// Hängt als `controller.sim` am WeaponController des Spielers (weapons/controller.js fragt nur, wenn gesetzt – Arcade und
// Realistisch laufen unverändert). Zustand je Waffenplatz (slot-Objekt des Controllers):
//   chamber 0|1     Patrone im Lager (+1 zum Magazin)
//   mag {n, cap}    eingesetztes Magazin mit echtem Füllstand (null = keins eingesetzt)
//   safe            Sicherung (Wahlhebel „Sicher“ – Taste Feuermodus schaltet Sicher → Einzel → … zurück auf Sicher)
//   jam             null | 'huelse' (Hülsenklemmer) | 'doppel' (Doppelzuführung) – Abzug tot, bis behoben
//   dirt, cond      Verschmutzung (wächst mit Schüssen, Liegen) und Zustand der Waffe → Ladehemmungs-Wahrscheinlichkeit
//   zero            Visiereinstellung in m (Geschossfall: Treffpunkt liegt nur auf dieser Entfernung im Haltepunkt)
// Ersatzmagazine liegen einzeln im Inventar (isim/kit.js) – halbleere bleiben halbleer. Controller-Felder bleiben ehrlich:
// st.mag = chamber + mag.n, st.reserve = Summe aller mitgeführten Magazine (Munition aufsammeln landet als Magazin im Kit).
//
// Waffen ohne Kastenmagazin (Flinte mit Röhre, Revolver, Kipplauf, Werfer, Gatling): nur Sicherung, Ladehemmung und
// Visier – die Munition zählt der Controller wie bisher.
//
// Ballistik: Kugeln behalten den Treffer-Strahl des Spiels (combat.fireHitscan), aber der Abgangswinkel folgt dem
// Geschossfall (flache Bahn, g/2v² · (d² − d·Visier)) und der Treffer wird um die Flugzeit d/v verzögert ausgewertet –
// bewegte Ziele muss man vorhalten, auf 400 m liegt der Treffer ohne passende Visiereinstellung deutlich tief.
import * as THREE from 'three';
import { fireModesOf, fireModeLabel, weaponHandling } from '../../shared/weapons.data.js?v=20261123115551';
import { ID_TO_MODEL, handlingFor } from '../weapons/gunsmith/handling.js?v=20261123115551';
import { INSPECTS, inspectMech } from '../weapons/anim/inspects.js?v=20261123115551';

const G_ACC = 9.81;
/** Mündungsgeschwindigkeit je Klasse (m/s). */
const V0 = { pistol: 360, smg: 390, ar: 880, marksman: 840, sniper: 850, lmg: 860, shotgun: 400, launcher: 0 };
/** Visier-Stufen je Klasse (m); Optik mit Vergrößerung erlaubt weiter. */
const ZEROS = {
  pistol: [25], shotgun: [25], smg: [50, 100, 150, 200],
  ar: [100, 200, 300, 400, 500, 600], lmg: [100, 200, 300, 400, 500, 600, 700, 800],
  marksman: [100, 200, 300, 400, 500, 600, 700, 800], sniper: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
};
const ZERO_DEF = { pistol: 25, shotgun: 25, smg: 50, ar: 100, lmg: 100, marksman: 100, sniper: 100 };
/** Grundwahrscheinlichkeit einer Ladehemmung je Schuss (sauber, Zustand gut) – selten. */
const JAM_BASE = 0.0006;
const _d = new THREE.Vector3(), _o = new THREE.Vector3(), _m = new THREE.Vector3(), _t = new THREE.Vector3();

/** Ist die Waffe eine mit Kastenmagazin/Gurtkasten (volle Magazinsimulation)? */
export function boxFed(def) {
  if (!def || !(def.mag > 0) || def.cls === 'melee' || def.perShellReload || def.projectile || def.spinUp > 0) return false;
  const h = handlingFor(ID_TO_MODEL[def.id] || def.model);
  return !(h && (h.action === 'revolver' || h.action === 'break' || h.reload === 'rocket' || h.reload === 'shell'));
}

export class SimGun {
  constructor(sim) {
    this.sim = sim;
    this.G = sim.G;
    this.state = new WeakMap();   // slot → Zustand
    this.queue = [];              // Kugeln im Flug { at, args }
    this.recoilMult = 1;          // aufgelegt: weniger Hochschlag
    this.swayMult = 1;            // aufgelegt/Atem/Körper: Faktor für das Schwanken des Controllers
    this.act = null;              // laufender Handgriff { kind, t, dur, at, st, applied }
    this._dryAt = -9;
    this._safeHintAt = -9;
    this._reloadPress = -9;
  }

  /* ---------------------------------------------------------------- Zustand */

  /** Zustand eines Waffenplatzes (legt ihn an: Patrone im Lager, gesichert, volles Magazin). */
  of(st) {
    let s = this.state.get(st);
    if (s && s.def === st.def) return s;
    const def = st.def;
    const box = boxFed(def);
    s = {
      def, box, cap: def.mag | 0, chamber: box && st.mag > 0 ? 1 : 0, mag: box ? { n: Math.max(0, (st.mag | 0) - 1), cap: def.mag | 0 } : null,
      safe: def.cls !== 'melee', jam: null, dirt: 0.03 + Math.random() * 0.08, cond: 0.82 + Math.random() * 0.18, heat: 0,
      zero: ZERO_DEF[def.cls] || 100, shots: 0, lastMode: null,
    };
    if (box && st.mag <= 0) { s.chamber = 0; s.mag.n = 0; }
    this.state.set(st, s);
    if (box) this.sim.kit.ensureMags(def, st);
    this._sync(st, s);
    return s;
  }

  /** Alle Plätze neu (Spawn): Zustand verwerfen, Kit neu packen. */
  reset() {
    this.state = new WeakMap();
    this.queue.length = 0;
    this.act = null;
  }

  handles(st) { return !!st && this.of(st).box; }
  /** Schussbereit (für die Feuerschleife des Controllers). */
  ready(st) { const s = this.of(st); return !s.jam && (!s.box || s.chamber > 0); }

  _sync(st, s) {
    if (!s.box) return;
    st.mag = s.chamber + (s.mag ? s.mag.n : 0);
    st.reserve = this.sim.kit.roundsFor(s.def.id);
  }

  /** Abgleich nach fremden Änderungen (Nachschub, Aufsammeln, Neubefüllung). */
  reconcile(ctrl) {
    for (const st of ctrl.slots) {
      if (!st || !st.def || st.def.cls === 'melee') continue;
      const s = this.of(st);
      if (!s.box) continue;
      const want = s.chamber + (s.mag ? s.mag.n : 0);
      if (st.mag !== want) {
        // Controller hat aufgefüllt (Nachschubkiste/refill): Magazin voll, Patrone im Lager bleibt wie sie war
        if (st.mag > want) { if (!s.mag) s.mag = { n: 0, cap: s.cap }; s.mag.n = Math.min(s.cap, Math.max(0, st.mag - s.chamber)); }
        else { const n = Math.max(0, st.mag - s.chamber); if (s.mag) s.mag.n = n; else s.chamber = Math.min(s.chamber, st.mag); }
      }
      const kitR = this.sim.kit.roundsFor(s.def.id);
      if (st.reserve > kitR) this.sim.kit.addLoose(s.def, st.reserve - kitR);   // aufgesammelt → als Magazin(e)
      this._sync(st, s);
    }
  }

  /* ---------------------------------------------------------------- Abzug */

  canFire(ctrl, st, it) {
    const s = this.of(st);
    const now = this.G.time.elapsed;
    const press = it.firePressed || ctrl._fireBuffer > 0;
    if (this.act || this.sim.blocksWeapon()) return false;
    if (s.safe) {
      if (it.firePressed && now - this._safeHintAt > 1.2) { this._safeHintAt = now; this.sim.event('gesichert'); }
      return false;
    }
    if (s.jam || (s.box && s.chamber <= 0)) {
      if (press && now - this._dryAt > 0.35) {
        this._dryAt = now;
        this.G.events.emit('weapon:dryfire', { actor: ctrl.actor, weaponId: s.def.id });
        this.sim.event(s.jam ? 'klemmt' : 'klick', { st, s });
      }
      return false;
    }
    return true;
  }

  onShot(ctrl, st, def) {
    const s = this.of(st);
    s.shots++;
    s.heat = Math.min(1, s.heat + 0.025);
    s.dirt = Math.min(1, s.dirt + 0.0012 + (this.sim.prone() ? 0.0008 : 0));
    if (s.box) {
      s.chamber = 0;
      if (s.mag && s.mag.n > 0) { s.mag.n -= 1; s.chamber = 1; }
    }
    // Ladehemmung: selten, häufiger bei Schmutz, schlechtem Zustand, heißem Lauf und fast leeren Magazinen (Federdruck)
    const lowMag = s.box && s.mag && s.mag.n > 0 && s.mag.n < 4 ? 0.0012 : 0;
    const p = JAM_BASE + s.dirt * 0.004 + (1 - s.cond) * 0.006 + s.heat * 0.0015 + lowMag;
    if ((s.box ? s.chamber > 0 : st.mag > 0) && Math.random() < p * (this.sim.forceJam ? 1e4 : 1)) {
      this.sim.forceJam = false;
      s.jam = s.box && s.mag && s.mag.n > 0 && Math.random() < 0.35 ? 'doppel' : 'huelse';
      this.sim.event('ladehemmung', { s });
      try { const A = this.G.audio; if (A && typeof A.simAction === 'function') A.simAction('jam', { actor: ctrl.actor, weaponId: def.id }); } catch { /* */ }
    }
    this._sync(st, s);
    if (s.box && s.chamber === 0 && !s.jam) this.sim.event('leer', { s });
  }

  /* ---------------------------------------------------------------- Feuerwahl */

  cycleMode(ctrl, st, modes) {
    const s = this.of(st);
    const list = ['sicher', ...modes];
    const cur = s.safe ? 'sicher' : ctrl._modeOf(st);
    const next = list[(list.indexOf(cur) + 1) % list.length];
    if (next === 'sicher') s.safe = true;
    else { s.safe = false; st.mode = next; }
    ctrl._burstLeft = 0; ctrl._fireBuffer = 0;
    this.G.events.emit('weapon:firemode', { actor: ctrl.actor, weaponId: s.def.id, mode: next });
    this.sim.event('wahlhebel', { text: next === 'sicher' ? 'Gesichert' : fireModeLabel(s.def, next) });
  }

  /** Aktueller Wahlhebel als Text. */
  modeText(ctrl, st) {
    const s = this.of(st);
    if (s.safe) return 'Gesichert';
    const modes = fireModesOf(s.def);
    return fireModeLabel(s.def, modes.includes(st.mode) ? st.mode : ctrl._modeOf(st));
  }

  canThrow(slot) { return this.sim.kit.canThrow(slot) && !this.act && !this.sim.blocksWeapon(); }

  /* ---------------------------------------------------------------- Nachladen */

  /** → undefined (kein Kastenmagazin: Controller wie bisher) | null (verweigert) | { dur, mode, mag } */
  beginReload(ctrl, st) {
    const s = this.of(st);
    if (!s.box) return this.act || this.sim.blocksWeapon() ? null : undefined;
    if (this.act || this.sim.blocksWeapon()) return null;
    const next = this.sim.kit.takeBestMag(s.def.id, true);
    if (!next) {
      this.sim.event(this.sim.kit.hasMagInPack(s.def.id) ? 'magRucksack' : 'keinMagazin');
      return null;
    }
    if (s.mag && next.n <= s.mag.n && s.mag.n > 0) this.sim.event('magSchlechter');
    const base = s.def.reloadTime || 2;
    const now = this.G.time.elapsed;
    // zweimal kurz hintereinander = Notfall (Magazin fallen lassen) – auch, wenn die Waffe schon leer ist und man es eilig hat
    const quick = now - this._reloadPress < 0.45;
    this._reloadPress = now;
    return { dur: base * (quick ? 0.8 : 1.3), mode: quick ? 'notfall' : 'taktisch', mag: next };
  }

  /** Zweites Drücken während eines taktischen Wechsels → Notfall-Nachladen (schneller, altes Magazin fällt). */
  toEmergency(ctrl) {
    const r = ctrl._reload;
    if (!r || !r.sim || r.sim.mode !== 'taktisch' || r.inserted || r.t > r.dur * 0.45) return false;
    const base = ctrl.currentDef.reloadTime || 2;
    r.sim.mode = 'notfall';
    r.dur = base * 0.8;
    r.insertAt = r.dur * 0.76;
    if (r.t > r.insertAt - 0.2) r.t = Math.max(0, r.insertAt - 0.2);
    this.sim.event('notfall');
    return true;
  }

  insertMag(ctrl, st, r) {
    const s = this.of(st);
    const old = s.mag;
    s.mag = { n: r.mag.n, cap: r.mag.cap };
    this.sim.kit.removeMag(r.mag);
    if (old) {
      if (r.mode === 'notfall') this.sim.event('magFallen', { n: old.n });
      else this.sim.kit.stowMag(s.def, old.n, old.cap);
    }
    this.sim.stats.reloads++;
    this._sync(st, s);
    if (s.chamber === 0) this.sim.event('durchladenNoetig');
  }

  /* ---------------------------------------------------------------- Handgriffe */

  /** Durchladen bzw. Ladehemmung beheben (Taste). */
  charge(ctrl) {
    const st = ctrl.current;
    if (!st || !st.def || st.def.cls === 'melee' || this.act || ctrl._reload || ctrl._switch || ctrl._throw || ctrl._melee || this.sim.blocksWeapon()) return false;
    const s = this.of(st);
    const jam = !!s.jam;
    if (!jam && !s.box) { this.sim.event('nichtNoetig'); return false; }
    const vm = ctrl.viewModel;
    const dur = jam ? 2.3 + (s.jam === 'doppel' ? 0.9 : 0) : (st.def.cls === 'pistol' ? 0.95 : st.def.cls === 'sniper' ? 1.0 : st.def.cls === 'lmg' ? 1.25 : 1.1);
    this.act = { kind: jam ? 'clear' : 'charge', t: 0, dur, at: jam ? 0.78 : 0.56, st, applied: false };
    if (vm && typeof vm.playSim === 'function') vm.playSim(jam ? 'clear' : 'charge', dur);
    // Klang (audio 20.11.): Durchladen bzw. Hemmung beheben (Magazin anschlagen – repetieren – Hülse fällt)
    try { const A = this.G.audio; if (A && typeof A.simAction === 'function') A.simAction(jam ? 'clear' : 'charge', { actor: ctrl.actor, weaponId: st.def.id, dur, jam: s.jam }); } catch { /* */ }
    if (ctrl.ads && this.G.input && this.G.input.cancelAds) this.G.input.cancelAds();
    return true;
  }

  /** Magazin prüfen (variant 'magazin') bzw. Patronenlager prüfen ('kammer'). */
  check(ctrl, which) {
    const st = ctrl.current;
    const vm = ctrl.viewModel;
    if (!st || !st.def || st.def.cls === 'melee' || this.act || ctrl._reload || ctrl._switch || ctrl._throw || !vm || this.sim.blocksWeapon()) return false;
    // Variante der Inspektion (anim/inspects.js): Magazin-Check bzw. Trommel/Kasten/Röhre; Lager-Check = „kammer“
    const list = vm.h ? INSPECTS[inspectMech(vm.h)] || [] : [];
    const want = which === 'kammer' ? ['kammer', 'kammern'] : ['magazin', 'trommel', 'kasten', 'roehre', 'deckel', 'kipp'];
    let idx = list.findIndex((x) => want.includes(x[0]));
    if (idx < 0) idx = 0;
    if (vm.action && vm.action.type !== 'ready' && vm.action.type !== 'fidget' && vm.action.type !== 'inspect') return false;
    vm.action = null;
    vm.playInspect(idx);
    const A = vm.action;
    const dur = A ? A.dur : 2.5;
    this.act = { kind: which === 'kammer' ? 'kammer' : 'magazin', t: 0, dur, at: 0.42, st, applied: false, inspect: true };
    return true;
  }

  update(dt, ctrl) {
    const G = this.G;
    const now = G.time.elapsed;
    // Kugeln im Flug
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      if (now < q.at) continue;
      this.queue.splice(i, 1);
      if (q.args.shooter && q.args.shooter.alive && G.combat) { try { G.combat.fireHitscan(q.args); } catch (err) { console.warn('[isim] Kugel', err); } }
    }
    if (!ctrl) return;
    const st = ctrl.current;
    for (const sl of ctrl.slots) { if (sl && sl.def && sl.def.cls !== 'melee') { const s = this.of(sl); s.heat = Math.max(0, s.heat - dt * 0.04); } }
    const A = this.act;
    if (A) {
      // Waffenwechsel/Tod bricht den Handgriff ab
      if (A.st !== st || !ctrl.actor.alive) { this.act = null; if (ctrl.viewModel && !A.inspect) ctrl.viewModel.cancelAction(); try { this.G.audio?.cancelSim?.(ctrl.actor); } catch { /* */ } return; }
      // Prüfen abgebrochen (Schuss, Zielen, Sprint brechen das Inspizieren im Controller ab)
      if (A.inspect && ctrl.viewModel && ctrl.viewModel.actionName !== 'inspect' && A.t > 0.1) { this.act = null; return; }
      A.t += dt;
      if (!A.applied && A.t >= A.dur * A.at) { A.applied = true; this._apply(ctrl, A); }
      if (A.t >= A.dur) this.act = null;
    }
  }

  _apply(ctrl, A) {
    const st = A.st, s = this.of(st);
    if (A.kind === 'charge') {
      if (s.chamber > 0) this.sim.event('patroneRaus');
      s.chamber = 0;
      if (s.mag && s.mag.n > 0) { s.mag.n -= 1; s.chamber = 1; }
      s.jam = null;
      this.sim.stats.charges++;
      this.sim.event(s.chamber ? 'durchgeladen' : 'durchgeladenLeer');
    } else if (A.kind === 'clear') {
      // Hülse/Doppelzuführung raus: die klemmende Patrone ist verloren, die nächste kommt ins Lager
      s.jam = null;
      s.chamber = 0;
      if (s.box && s.mag && s.mag.n > 0) { s.mag.n -= 1; s.chamber = 1; }
      s.dirt = Math.max(0, s.dirt - 0.05);
      this.sim.stats.clears++;
      this.sim.event('behoben', { s });
    } else if (A.kind === 'magazin') {
      this.sim.stats.magChecks++;
      this.sim.readout(this._magWords(s, st));
    } else if (A.kind === 'kammer') {
      this.sim.stats.chamberChecks++;
      this.sim.readout(s.jam ? (s.jam === 'doppel' ? ['Zwei Patronen im Lager – Doppelzuführung!', 'Durchladen (Hemmung beheben)'] : ['Hülse klemmt im Auswurf!', 'Durchladen (Hemmung beheben)'])
        : !s.box ? [st.mag > 0 ? 'Geladen' : 'Leer', ''] : s.chamber ? ['Patrone im Lager', ''] : ['Lager leer', s.mag && s.mag.n > 0 ? 'Durchladen' : 'Nachladen, dann durchladen']);
    }
    this._sync(st, s);
  }

  /** Füllstand als Gefühl/Blick (keine exakte Zahl): Schätzung mit Unschärfe ± 10 %. */
  _magWords(s, st) {
    if (!s.box) {
      const n = st.mag, cap = s.def.mag || 1;
      return [n <= 0 ? 'Leer' : n >= cap ? 'Voll geladen' : `Etwa ${Math.max(1, Math.round(n / cap * 4))} von 4 geladen`, ''];
    }
    if (!s.mag) return ['Kein Magazin eingesetzt', ''];
    const f = Math.max(0, Math.min(1, s.mag.n / Math.max(1, s.mag.cap) + (Math.random() - 0.5) * 0.12));
    const w = s.mag.n === 0 ? 'Magazin leer' : f > 0.93 ? 'Magazin voll' : f > 0.75 ? 'Magazin fast voll' : f > 0.55 ? 'Magazin gut halb voll' : f > 0.38 ? 'Magazin etwa halb' : f > 0.18 ? 'Magazin knapp ein Drittel' : 'Magazin fast leer';
    const kg = s.mag.n * (s.def.cls === 'pistol' || s.def.cls === 'smg' ? 0.009 : 0.013);
    const feel = s.mag.n === 0 ? 'federleicht' : kg > 0.3 ? 'liegt schwer in der Hand' : kg > 0.15 ? 'spürbar Gewicht' : 'leicht';
    return [w, `${feel} · Ersatz: ${this.sim.kit.magSummary(s.def.id)}`];
  }

  /* ---------------------------------------------------------------- Visier */

  zeroStep(ctrl, dir) {
    const st = ctrl.current;
    if (!st || !st.def || st.def.cls === 'melee') return;
    const s = this.of(st);
    const list = ZEROS[s.def.cls] || [100];
    const optic = !!(s.def.scope && s.def.scope.zoom > 2);
    const max = optic ? list[list.length - 1] : Math.min(list[list.length - 1], s.def.cls === 'ar' ? 400 : list[list.length - 1]);
    const opts = list.filter((z) => z <= max);
    let i = opts.indexOf(s.zero);
    if (i < 0) i = 0;
    const j = Math.max(0, Math.min(opts.length - 1, i + dir));
    if (j === i) { this.sim.event('visierAnschlag', { zero: s.zero }); return; }
    s.zero = opts[j];
    this.sim.stats.zeroSet++;
    this.G.events.emit('weapon:firemode', { actor: ctrl.actor, weaponId: s.def.id, mode: 'visier' }); // Raste klickt
    this.sim.event('visier', { zero: s.zero, optic });
  }

  zeroOf(st) { return st ? this.of(st).zero : 100; }

  /* ---------------------------------------------------------------- Ballistik */

  /** Kugel mit Fall und Flugzeit. → true (übernommen; Controller überspringt seinen Treffer-Strahl) */
  fireBullet(ctrl, a) {
    const def = a.weapon;
    const v = V0[def.cls];
    if (!v || a.pellets > 1 || def.projectile) return false;
    const G = this.G;
    const s = this.of(ctrl.current);
    _d.copy(a.dir).normalize();
    let dist = a.range;
    try {
      const h = G.world && G.world.raycast(a.origin, _d, a.range);
      if (h && Number.isFinite(h.distance)) dist = h.distance;
    } catch { /* Welt im Abbau */ }
    const Z = s.zero || 100;
    // Abstand der Bahn unter der Visierlinie (m), flache Bahn ohne Luftwiderstand; + Visierhöhe ≈ 6 cm unter dem Auge
    const drop = (G_ACC / (2 * v * v)) * (dist * dist - dist * Z) + 0.06 * (1 - dist / Math.max(1, Z));
    const ang = Math.atan2(drop, Math.max(1, dist));
    // Richtung um die waagerechte Querachse nach unten kippen
    _t.set(-_d.z, 0, _d.x);
    if (_t.lengthSq() < 1e-6) _t.set(1, 0, 0); else _t.normalize();
    _d.applyAxisAngle(_t, -ang);
    const args = { shooter: a.shooter, origin: _o.copy(a.origin).clone(), dir: _d.clone(), range: a.range, weapon: def, pelletIndex: a.pelletIndex, damageScale: a.damageScale };
    const tof = dist / v;
    if (a.tracer) {
      const to = args.origin.clone().addScaledVector(args.dir, dist);
      G.events.emit('tracer', { from: _m.copy(a.muzzle).clone(), to, actor: a.shooter, weaponId: def.id, hit: false });
    }
    if (tof < 0.03) { try { G.combat && G.combat.fireHitscan(args); } catch (err) { console.warn('[isim] Kugel', err); } return true; }
    this.queue.push({ at: G.time.elapsed + tof, args });
    return true;
  }

  dispose() { this.queue.length = 0; this.act = null; }
}

export { V0, ZEROS, weaponHandling };
