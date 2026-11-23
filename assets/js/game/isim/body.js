// NULLPUNKT — Infanteriesimulation: Körper (Spielstil „Simulation“).
//
//  • Verwundungen je Körperteil (Kopf, Rumpf, linker/rechter Arm, linkes/rechtes Bein) aus dem Trefferpunkt; Schwere
//    nach Schaden: Streifschuss, schwer, Arterie (nur Arm/Bein). Bein = humpeln (kein Sprint), Arm = Zittern beim
//    Zielen, langsameres Nachladen (über injuries.js-Felder arm/leg, die Spieler/Controller schon auswerten).
//  • Blut (0–100) statt sofortiger Lebensanzeige: Blutungen zehren es auf; unter 70 % verblasst das Bild, unter 50 %
//    Tunnelblick und Schwanken, unter 33 % Bewusstlosigkeit, unter 12 % Tod. Verband (Taste Verband) stillt Streifschüsse
//    und mindert schwere Blutungen, Abbinden stoppt eine Arterienblutung an Arm/Bein (Glied bleibt beeinträchtigt).
//  • Bewusstlos statt sofort tot: tödlicher Treffer (nicht Kopf, kein Überschuss) → am Boden, Bild schwarz; nach
//    15–30 s wacht man auf, wenn noch genug Blut da ist – sonst stirbt man. Verbündete Bots kommen helfen (optional:
//    nur wenn Verbündete da sind) und versorgen die Wunden. Taste Interagieren halten = aufgeben.
//  • Belastung: Gewicht (isim/kit.js) → Ausdauerverbrauch, Tempo, Atmung. Atmung im Anschlag sichtbar: Visier hebt und
//    senkt sich im Atemtakt, schneller und stärker bei Erschöpfung, Blutverlust und Armwunden; Atem anhalten mit der
//    Sprinttaste (alle Waffen). Waffe aufgelegt (an Deckung oder liegend): kaum Schwanken, weniger Rückstoß.
// Schaden und Bewusstlosigkeit entscheidet nur, wer den Schaden rechnet (offline bzw. Host für sich selbst); auf einem
// Mehrspieler-Client gibt es Verwundungen ohne Bewusstlosigkeit (der Host kennt die Simulation des Clients nicht).
import * as THREE from 'three';
import { issueCommand } from '../bots/ai/orders.js?v=20261123115551';

const PARTS = { kopf: 'Kopf', rumpf: 'Oberkörper', armL: 'linker Arm', armR: 'rechter Arm', beinL: 'linkes Bein', beinR: 'rechtes Bein' };
/** Blutverlust je Sekunde (Prozentpunkte Blut) je Schwere. */
const BLEED = { streif: 0.12, schwer: 0.55, arterie: 2.6 };
const BLOOD_FAINT = 33, BLOOD_DEATH = 12;
const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class SimBody {
  constructor(sim) {
    this.sim = sim;
    this.G = sim.G;
    this.reset();
  }

  reset() {
    this.wounds = [];        // { part, sev, bleed, bandaged, tq, t }
    this.blood = 100;
    this.pain = 0;           // 0..1, klingt ab
    this.down = null;        // Bewusstlosigkeit { t, dur, attacker, weaponId, helper }
    this.breath = 1;         // Atem anhalten (0..1 Vorrat)
    this.holding = false;
    this._swayX = 0; this._swayY = 0; this._t = Math.random() * 10;
    this.rested = null;      // 'liegend' | 'aufgelegt' | null
    this._restK = 0;
    this.act = null;         // Verband/Abbinden { kind, t, dur, wound }
    this.hitFlash = 0;
    this.load = 0;
  }

  get bleeding() { let r = 0; for (const w of this.wounds) r += w.bleed; return r; }
  get worst() { return this.wounds.filter((w) => w.bleed > 0).sort((a, b) => b.bleed - a.bleed)[0] || null; }
  partLabel(p) { return PARTS[p] || p; }

  /* ---------------------------------------------------------------- Treffer */

  /** Treffer am Spieler (actor:hit, nur Schaden rechnende Seite oder Client-Abbild). */
  onHit(e) {
    const P = this.G.player;
    if (!P || e.target !== P || !(e.amount > 0) || e.weaponId === 'world') return;
    const amt = e.amount;
    this.pain = Math.min(1, this.pain + amt / 60);
    this.hitFlash = Math.min(1, 0.45 + amt / 50);
    if (e.weaponId === 'fall') { if (amt > 25) this._wound(Math.random() < 0.5 ? 'beinL' : 'beinR', amt > 50 ? 'schwer' : 'streif'); return; }
    const part = this._part(P, e);
    let sev = amt < 14 ? 'streif' : 'schwer';
    if ((part.startsWith('arm') || part.startsWith('bein')) && amt >= 18 && Math.random() < 0.18 + amt / 200) sev = 'arterie';
    if (e.explosive && amt >= 20) { this._wound(Math.random() < 0.5 ? 'beinL' : 'beinR', 'streif'); }
    this._wound(part, sev);
    this.sim.event('getroffen', { part, sev });
  }

  _part(P, e) {
    if (e.zone === 'head') return 'kopf';
    const py = e.point ? e.point.y - P.position.y : 1.0 + Math.random() * 0.4;
    let side = Math.random() < 0.5 ? 'L' : 'R';
    if (e.point) {
      _r.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
      side = _v.copy(e.point).sub(P.position).dot(_r) >= 0 ? 'R' : 'L';
    }
    if (e.zone === 'limb') return py >= 0.95 ? 'arm' + side : 'bein' + side;
    return py < 0.85 ? 'bein' + side : 'rumpf';
  }

  _wound(part, sev) {
    const w = { part, sev, bleed: BLEED[sev] * (0.8 + Math.random() * 0.4), bandaged: false, tq: false, t: this.G.time.elapsed };
    if (part === 'kopf' && sev === 'schwer') w.bleed *= 0.6;
    this.wounds.push(w);
    this._syncInjury();
    return w;
  }

  /** injuries.js-Felder (arm/leg) aus den Wunden: Arm zittert, Bein humpelt – Verband lindert, Abbinden lähmt. */
  _syncInjury() {
    const P = this.G.player;
    if (!P) return;
    const inj = this.G.injuries;
    const j = inj ? inj.of(P) : (P.injury || (P.injury = { arm: false, leg: false, bleed: 0, bleedLeft: 0, by: null, wid: null, bandages: 0 }));
    const bad = (w) => w.tq || (!w.bandaged && w.sev !== 'streif');
    j.arm = this.wounds.some((w) => w.part.startsWith('arm') && bad(w));
    j.leg = this.wounds.some((w) => w.part.startsWith('bein') && bad(w));
    j.bleed = 0; j.bleedLeft = 0;   // die Simulation blutet selbst (Blut statt Lebenspunkte)
  }

  /* ---------------------------------------------------------------- Bewusstlos */

  /** combat.damage: tödlicher Treffer → bewusstlos statt tot? (true = abgefangen, Leben bleibt bei 1) */
  interceptDeath(target, info, amount, before) {
    if (this.down) return false;
    if (info.weaponId === 'world' || info.weaponId === 'fall' && amount > 120) return false;
    if (info.zone === 'head' && !info.explosive) return false;               // Kopftreffer: sofort
    if (amount > (before || 0) + 70) return false;                            // weit über tödlich (Explosion, Großkaliber)
    this.down = { t: 0, dur: 15 + Math.random() * 15, attacker: info.attacker || null, weaponId: info.weaponId || null, zone: info.zone || 'body', helper: null, helpT: 0, giveT: 0 };
    target.simDown = true;
    target.health = 1;
    if (!this.wounds.some((w) => w.bleed > 0)) this._wound(info.zone === 'limb' ? 'beinR' : 'rumpf', 'schwer');
    this.blood = Math.min(this.blood, 55);
    try { if (typeof target.setStance === 'function') target.setStance('prone'); } catch { /* */ }
    if (this.G.input && this.G.input.cancelAds) this.G.input.cancelAds();
    this._callHelp();
    this.sim.event('bewusstlos');
    return true;
  }

  _callHelp() {
    const P = this.G.player, d = this.down;
    if (!P || !d || !P.team) return;
    let best = null, bd = 70;
    for (const a of this.G.actors || []) {
      if (!a.isBot || a.puppet || !a.alive || a.team !== P.team || a.simDown) continue;
      const dist = a.position.distanceTo(P.position);
      const medic = a.gadget && a.gadget.id === 'medkit';
      const score = dist - (medic ? 25 : 0);
      if (score < bd) { bd = score; best = a; }
    }
    if (!best) return;
    d.helper = best;
    try { issueCommand(this.G, [best], best, 'attack', { point: P.position.clone() }, this.G.time.elapsed); } catch { /* ohne Befehlsschicht */ }
    this.sim.event('sani', { name: best.name || 'Kamerad' });
  }

  _wake() {
    const P = this.G.player;
    const d = this.down;
    this.down = null;
    if (!P) return;
    P.simDown = false;
    P.health = Math.max(P.health, 18);
    P.lastDamageTime = this.G.time.elapsed;
    if (d && d.helper && d.helper.alive) { try { issueCommand(this.G, [d.helper], d.helper, 'free', {}, this.G.time.elapsed); } catch { /* */ } }
    this.pain = 1;
    this.sim.event('aufgewacht');
  }

  _die(reason) {
    const P = this.G.player;
    const d = this.down;
    this.down = null;
    if (!P || !P.alive) return;
    P.simDown = false;
    if (d && d.helper && d.helper.alive) { try { issueCommand(this.G, [d.helper], d.helper, 'free', {}, this.G.time.elapsed); } catch { /* */ } }
    if (this.G.match && this.G.match.netRole === 'client') return;
    P.health = 0;
    if (this.G.combat) this.G.combat._kill(P, { attacker: d && d.attacker && d.attacker !== P ? d.attacker : null, weaponId: (d && d.weaponId) || 'bleed', zone: (d && d.zone) || 'body' });
    void reason;
  }

  /* ---------------------------------------------------------------- Versorgen */

  /** Verband (true) bzw. Abbinden (false) starten. */
  treat(tourniquet) {
    const P = this.G.player;
    if (!P || !P.alive || this.down || this.act) return false;
    const ctrl = P.weapon;
    if (ctrl && (ctrl._reload || ctrl._throw || ctrl._melee)) return false;
    let w;
    if (tourniquet) {
      w = this.wounds.filter((x) => !x.tq && (x.part.startsWith('arm') || x.part.startsWith('bein')) && x.bleed > 0).sort((a, b) => b.bleed - a.bleed)[0];
      if (!w) { this.sim.event(this.wounds.some((x) => x.bleed > 0) ? 'abbindenNurGlied' : 'keineBlutung'); return false; }
    } else {
      w = this.wounds.filter((x) => !x.bandaged && !x.tq && x.bleed > 0).sort((a, b) => (a.sev === 'arterie') - (b.sev === 'arterie') || b.bleed - a.bleed)[0]
        || this.wounds.filter((x) => !x.bandaged && !x.tq).sort((a, b) => b.bleed - a.bleed)[0];
      if (!w) { this.sim.event('keineWunde'); return false; }
    }
    const where = this.sim.kit.takeMed(tourniquet ? 'abbinde' : 'verband');
    if (!where) { this.sim.event(tourniquet ? 'keinAbbinde' : 'keinVerband'); return false; }
    const dur = (tourniquet ? 4.5 : 5.5) + (where === 'rucksack' ? 3 : 0) + (this.wounds.some((x) => x.part.startsWith('arm') && !x.bandaged) ? 1.5 : 0);
    this.act = { kind: tourniquet ? 'tourniquet' : 'bandage', t: 0, dur, wound: w };
    const vm = ctrl && ctrl.viewModel;
    if (vm && typeof vm.playSim === 'function') vm.playSim(this.act.kind, dur);
    if (this.G.input && this.G.input.cancelAds) this.G.input.cancelAds();
    P._busyUntil = Math.max(P._busyUntil || 0, this.G.time.elapsed + dur);
    this.sim.event(tourniquet ? 'abbinden' : 'verbinden', { part: w.part, rucksack: where === 'rucksack' });
    return true;
  }

  _finishTreat() {
    const A = this.act;
    this.act = null;
    const w = A.wound;
    if (!w || !this.wounds.includes(w)) return;
    if (A.kind === 'tourniquet') { w.tq = true; w.bleed = 0; }
    else {
      w.bandaged = true;
      w.bleed = w.sev === 'streif' ? 0 : w.sev === 'schwer' ? w.bleed * 0.12 : w.bleed * 0.55;   // Arterie: Verband hält sie kaum
    }
    this.sim.stats.treated++;
    this._syncInjury();
    this.sim.event(A.kind === 'tourniquet' ? 'abgebunden' : 'verbunden', { part: w.part, still: w.bleed > 0.3 });
  }

  /** Verbündeter Bot versorgt den Bewusstlosen. */
  _stabilize(helper) {
    for (const w of this.wounds) { if (w.sev === 'arterie' && (w.part.startsWith('arm') || w.part.startsWith('bein'))) { w.tq = true; w.bleed = 0; } else { w.bandaged = true; w.bleed = w.sev === 'streif' ? 0 : w.bleed * 0.1; } }
    this.blood = Math.max(this.blood, BLOOD_FAINT + 8);
    this._syncInjury();
    if (this.down) this.down.dur = Math.min(this.down.dur, this.down.t + 3);
    this.sim.event('stabilisiert', { name: helper.name || 'Kamerad' });
  }

  /* ---------------------------------------------------------------- Takt */

  update(dt, ctrl, input) {
    const G = this.G, P = G.player;
    if (!P || !P.alive) return;
    const now = G.time.elapsed;
    const host = !G.match || G.match.netRole !== 'client';
    this.pain = Math.max(0, this.pain - dt * 0.05);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 1.6);
    // Blutung
    const bleed = this.bleeding;
    if (bleed > 0) this.blood = Math.max(0, this.blood - bleed * dt);
    else if (!this.down) this.blood = Math.min(100, this.blood + dt * 0.08);   // sehr langsame Erholung ohne Blutung
    if (host && !this.down && this.blood < BLOOD_FAINT && P.alive) {
      // ohnmächtig durch Blutverlust
      this.down = { t: 0, dur: 20 + Math.random() * 10, attacker: null, weaponId: 'bleed', zone: 'body', helper: null, helpT: 0, giveT: 0 };
      const last = P._damageLog && P._damageLog[P._damageLog.length - 1];
      if (last) this.down.attacker = last.attacker;
      P.simDown = true;
      try { P.setStance && P.setStance('prone'); } catch { /* */ }
      this._callHelp();
      this.sim.event('ohnmacht');
    }
    // Bewusstlos
    const d = this.down;
    if (d) {
      d.t += dt;
      P.lastDamageTime = now;
      if (d.helper) {
        if (!d.helper.alive) { d.helper = null; this._callHelp(); }
        else if (d.helper.position.distanceTo(P.position) < 2.6) { d.helpT += dt; if (d.helpT > 2.5 && !d.stab) { d.stab = true; this._stabilize(d.helper); } }
      }
      if (input && input.down('interact')) { d.giveT += dt; if (d.giveT > 1.6) { this._die('aufgegeben'); return; } } else d.giveT = 0;
      if (host && this.blood < BLOOD_DEATH) { this._die('blut'); return; }
      if (d.t >= d.dur) { if (this.blood >= BLOOD_FAINT - 3) this._wake(); else if (host) { this._die('blut'); return; } else this._wake(); }
      return;
    }
    // Verband/Abbinden
    if (this.act) {
      this.act.t += dt;
      if (ctrl && (ctrl._reload || ctrl._switch)) { this.act = null; if (ctrl.viewModel) ctrl.viewModel.cancelAction(); }
      else if (this.act.t >= this.act.dur) this._finishTreat();
    }
    // Belastung → Ausdauer, Tempo
    this.load = this.sim.kit.weight();
    const over = Math.max(0, this.load - 18);
    P.simStamina = (1 + over / 22) * (1 + (100 - this.blood) / 120);   // × Spielstil (player.js nach stamina.setStyle)
    P.simSpeed = clamp(1 - over * 0.011 - (this.blood < 60 ? (60 - this.blood) * 0.006 : 0), 0.62, 1);
  }

  /** Waffe aufgelegt? (nach player.update/controller: Haltung + kurzer Strahl unter der Mündung) */
  updateRest(dt, ctrl) {
    const P = this.G.player, W = this.G.world;
    let rest = null;
    if (P && ctrl && ctrl.adsProgress > 0.6 && !P.simDown) {
      if (P.prone) rest = 'liegend';
      else if (W && typeof W.raycast === 'function') {
        P.getEyePosition(_a);
        _b.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
        // Auflage: unter der Waffe (25–40 cm unter dem Auge) liegt binnen 70 cm etwas, auf Augenhöhe ist frei
        try {
          const lowY = _a.y - 0.3;
          const low = W.raycast(_v.set(_a.x, lowY, _a.z), _b, 0.75);
          const eye = W.raycast(_a, _b, 0.85);
          if (low && low.distance < 0.75 && !(eye && eye.distance < 0.85)) rest = 'aufgelegt';
        } catch { /* Welt im Abbau */ }
      }
    }
    if (rest && !this.rested) this.sim.event('aufgelegt', { how: rest });
    this.rested = rest;
    this._restK += ((rest ? 1 : 0) - this._restK) * Math.min(1, dt * 6);
  }

  /** Schwanken im Anschlag (Atmung, Herzschlag, Erschöpfung, Wunden) direkt auf den Blick; → Faktor für den Controller. */
  sway(dt, ctrl, input) {
    const P = this.G.player;
    if (!P || !ctrl || this.down) { this._applySway(P, 0, 0); return 1; }
    const a = ctrl.adsProgress || 0;
    const fatigue = clamp((1 - (P.stamina ? P.stamina.ratio : 1)) * 0.8 + (P.exertion || 0) * 0.5, 0, 1);
    const armW = P.injury && P.injury.arm ? 1 : 0;
    const blood = clamp((80 - this.blood) / 50, 0, 1);
    // Atem anhalten (Sprinttaste im Anschlag, alle Waffen): Vorrat ≈ 7 s, erschöpft kürzer, danach Schnappen
    const want = a > 0.6 && input && input.down('sprint');
    if (want && this.breath > 0) { this.holding = true; this.breath = Math.max(0, this.breath - dt / (7 - 4 * fatigue)); if (this.breath <= 0) { this.holding = false; this._gasp = 1.5; this.sim.event('luft'); } }
    else { this.holding = false; this.breath = Math.min(1, this.breath + dt / (4 + 4 * fatigue)); }
    if (this._gasp > 0) this._gasp -= dt;
    const stance = P.prone ? 0.35 : P.crouching ? 0.7 : 1;
    const rest = 1 - 0.8 * this._restK;
    const hold = this.holding ? 0.25 : this._gasp > 0 ? 1.8 : 1;
    const amp = 0.0011 * (1 + 2.4 * fatigue + 2 * blood + 1.6 * armW + this.pain) * stance * rest * hold * (0.25 + 0.75 * a);
    // Atemtakt: 0,22 Hz in Ruhe … 0,6 Hz erschöpft; dazu Wandern und Herzschlag-Zucken
    this._t += dt;
    const t = this._t;
    const f = 0.22 + 0.4 * fatigue + 0.2 * blood;
    this._ph = (this._ph || 0) + dt * f * Math.PI * 2 * (this.holding ? 0.15 : 1);
    let y = Math.sin(this._ph) * amp * 1.4;
    let x = (Math.sin(t * 0.37 + 1.3) * 0.6 + Math.sin(t * 0.91) * 0.3) * amp;
    const hr = 1.1 + 1.2 * fatigue + blood;
    const beat = Math.pow(Math.max(0, Math.sin(t * hr * Math.PI * 2)), 12);
    y += beat * amp * 0.5 * (fatigue + blood);
    if (armW) { x += Math.sin(t * 9.1) * amp * 0.35; y += Math.sin(t * 7.3 + 1) * amp * 0.3; }
    this._applySway(P, x, y);
    // Faktor für das Schwanken/Zielwandern des Controllers (Zielfernrohr): aufgelegt ruhiger, Atem angehalten ruhiger
    ctrl.sim && (ctrl.sim.recoilMult = 1 - 0.4 * this._restK);
    return (1 - 0.75 * this._restK) * (this.holding ? 0.4 : 1) * (1 + 0.8 * blood + 0.5 * armW);
  }

  _applySway(P, x, y) {
    if (!P) return;
    if (Number.isFinite(P.yaw)) P.yaw -= x - this._swayX;
    if (Number.isFinite(P.pitch)) P.pitch += y - this._swayY;
    this._swayX = x; this._swayY = y;
  }

  /** Zustand als Wörter (Ausrüstungsmenü/Hilfe) – keine Zahlen. */
  conditionText() {
    const b = this.blood;
    const blood = b > 85 ? 'bei Kräften' : b > 65 ? 'blass, etwas schwindlig' : b > 45 ? 'schwach, Hände zittern' : 'kurz vor der Ohnmacht';
    const ws = this.wounds.map((w) => `${PARTS[w.part]}: ${w.sev === 'streif' ? 'Streifschuss' : w.sev === 'arterie' ? 'starke Blutung (Arterie)' : 'Schusswunde'}${w.tq ? ', abgebunden' : w.bandaged ? ', verbunden' : w.bleed > 0 ? ', blutet' : ''}`);
    return { blood, wounds: ws };
  }
}

export { PARTS };
