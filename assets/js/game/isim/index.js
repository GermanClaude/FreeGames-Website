// NULLPUNKT — Infanteriesimulation (Spielstil „Simulation“, Nutzer 19.11.: „wo du wirklich alles selber machen musst“).
// Gegenstück zur Panzersimulation (vehicles/psim/): Handgriffe statt Automatik, Zustand wird aus dem echten Spielzustand
// gelesen, Führung „Tutorial / Hilfe auf Anfrage / Aus“ (Einstellung simGuide, URL fuehrung=…), Schritte in jeder
// physikalisch möglichen Reihenfolge erlaubt.
//
// Aufbau: main.js legt G.isim an, wenn G.match.sim (classes.data.js GAME_STYLES.simulation, nur SIM_MODES) – sonst gibt es
// das Objekt nicht und kein Spielsystem merkt etwas davon (alle Haken prüfen `G.isim` bzw. `controller.sim`).
//   gun.js   Magazine einzeln, Patrone im Lager, Durchladen, taktisch/Notfall nachladen, Sicherung/Feuerwahl,
//            Ladehemmungen, Magazin-/Lager-Check, Visiereinstellung, Geschossfall + Flugzeit
//   kit.js   Weste/Rucksack mit Plätzen und Gewicht, Granaten/Verbandszeug aus bestimmten Taschen, Umpacken
//   body.js  Wunden je Körperteil, Blut, Verband/Abbinden, Bewusstlosigkeit + Kameradenhilfe, Belastung, Atmung, Auflegen
//   hud.js   kein HUD außer Gegenständen auf Tastendruck (Kompass, Karte, Ausrüstung), Zustand als Bild, Funk-Untertitel
// Tasten (shared/bindings.data.js, Gruppe „Simulation“): sim_durchladen O, sim_magcheck I (2×: Lager), sim_kompass „,“,
// sim_karte „.“, sim_inventar P, sim_abbinden 7, sim_visier_auf/ab Bild↑/↓, sim_hilfe F2; dazu vorhandene: Feuermodus M
// (mit „Sicher“), Nachladen R (2×: Notfall), Verband N, Sprint im Anschlag = Atem anhalten, Interagieren halten = aufgeben.
// Debug: spielen.html?debug=1&autostart=1&mode=tdm&map=hafen&style=simulation[&fuehrung=tutorial|hilfe|aus][&stimme=0]
// Konsole: __game.isim → { gun, kit, body, state(), jam(), wound(part, sev) }
import { SimGun } from './gun.js?v=20261115041504';
import { SimKit, LIMIT_KG } from './kit.js?v=20261115041504';
import { SimBody, PARTS } from './body.js?v=20261115041504';
import { SimHUD, esc } from './hud.js?v=20261115041504';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ORDER_TEXT = {
  follow: ['Trupp, mir nach!', 'Verstanden, folgen.'], attack: ['Angriff – auf mein Zeichen!', 'Verstanden, greifen an.'],
  spread: ['Ausschwärmen!', 'Schwärmen aus.'], defend: ['Dort verteidigen!', 'Verstanden, beziehen Stellung.'],
  hold: ['Stellung halten!', 'Halten.'], regroup: ['Sammeln bei mir!', 'Kommen zu dir.'], formation: ['Formation wechseln!', 'Verstanden.'],
  free: ['Frei handeln!', 'Verstanden, frei.'],
};
const TACTIC_TEXT = {
  suppress: 'Niederhalten!', flank: 'Wir gehen in die Flanke!', smoke: 'Nebel!', medic: 'Sanitäter kommt!', fallback: 'Ausweichen – zurück!',
  regroup: 'Sammeln!', spot: 'Feind gesichtet!', at: 'Panzerabwehr nach vorn!', bound: 'Sprung vor – ich decke!', overwatch: 'Ich sichere.',
  clear_grenade: 'Granate in den Raum!', enter: 'Wir gehen rein!', stack: 'Am Eingang bereit!', crossfire: 'Kreuzfeuer!',
};

export class InfantrySim {
  constructor(G, opts = {}) {
    this.G = G;
    const P = G.params && typeof G.params.get === 'function' ? G.params : typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    let guide = 'tutorial';
    try { guide = G.settings.get('simGuide') || 'tutorial'; } catch { /* */ }
    const pg = P && (P.get('fuehrung') || P.get('simguide'));
    if (pg === 'tutorial' || pg === 'hilfe' || pg === 'aus') guide = pg;
    if (opts.guide) guide = opts.guide;
    this.guide = ['tutorial', 'hilfe', 'aus'].includes(guide) ? guide : 'tutorial';
    this._helpOn = this.guide === 'tutorial';
    this.voice = !(P && P.get('stimme') === '0') && typeof window !== 'undefined' && !!window.speechSynthesis;
    this.stats = { shots: 0, reloads: 0, charges: 0, clears: 0, magChecks: 0, chamberChecks: 0, zeroSet: 0, compass: 0, map: 0, inv: 0, rested: 0, treated: 0 };
    this.kit = new SimKit(this);
    this.gun = new SimGun(this);
    this.body = new SimBody(this);
    this.hud = new SimHUD(this);
    this.inv = { open: false, busy: null };
    this._compT = 0; this._mapT = 0;
    this._t = 0;
    this._lastTactic = new Map();
    this._needPack = true;
    this.forceJam = false;
    const on = (n, f) => G.events.on(n, f);
    this._off = [
      on('actor:hit', (e) => { if (e.target === G.player) this.body.onHit(e); }),
      on('actor:spawn', (e) => { if (e.actor === G.player) this._needPack = true; }),
      on('weapon:fire', (e) => { if (e.actor === G.player) this.stats.shots++; }),
      on('bot:command', (e) => this._onCommand(e)),
      on('bot:tactic', (e) => this._onTactic(e)),
      on('kill', (e) => this._onKill(e)),
    ];
    if (typeof document !== 'undefined') document.body.classList.add('isim-on');
  }

  /* ---------------------------------------------------------------- Abfragen der Haken */

  /** Waffe nicht benutzbar (Gegenstand in der Hand, Versorgen, bewusstlos). */
  blocksWeapon() { return this.inv.open || this._compT > 0.15 || this._mapT > 0.15 || !!this.body.act || !!this.body.down; }
  prone() { const P = this.G.player; return !!(P && P.prone); }
  /** combat.damage → bewusstlos statt tot? */
  interceptDeath(target, info, amount, before) {
    if (target !== this.G.player || (this.G.match && this.G.match.netRole === 'client')) return false;
    return this.body.interceptDeath(target, info, amount, before);
  }
  readout([t, sub]) { this.hud.readout(t, sub); }

  /* ---------------------------------------------------------------- Rückmeldungen */

  event(kind, d = {}) {
    const H = this.hud, A = this.G.audio;
    const play = (n, o) => { try { A && A.play(n, o || {}); } catch { /* */ } };
    const tut = this.guide !== 'aus';
    const k = (a, fb) => (this.G.input && this.G.input.label(a)) || fb;
    switch (kind) {
      case 'gesichert': H.note(tut ? `Gesichert – Wahlhebel (${k('feuermodus', 'M')})` : 'Gesichert'); break;
      case 'klick': H.note('Klick.'); break;
      case 'klemmt': H.note('Abzug tot.'); break;
      case 'ladehemmung': H.say('Du', 'Ladehemmung!'); if (this._alliesNear(30)) setTimeout(() => this.hud && H.say(this._allyName(), 'Ich decke dich!'), 900); break;
      case 'wahlhebel': H.note(d.text); break;
      case 'magRucksack': H.note(`Weste leer – Magazine im Rucksack (${k('sim_inventar', 'P')})`); break;
      case 'keinMagazin': H.note('Keine Magazine mehr'); H.say('Du', 'Brauche Munition!'); break;
      case 'magSchlechter': H.note('Kein volleres Magazin in der Weste'); break;
      case 'notfall': H.note('Magazin fallen lassen'); break;
      case 'magFallen': if (d.n > 0) H.note('Magazin mit Restpatronen verloren'); break;
      case 'durchladenNoetig': if (tut) H.note(`Durchladen (${k('sim_durchladen', 'O')})`); break;
      case 'patroneRaus': H.note('Patrone ausgeworfen'); break;
      case 'durchgeladen': H.note('Fertig geladen'); break;
      case 'durchgeladenLeer': H.note('Durchgeladen – Magazin leer'); break;
      case 'behoben': H.say('Du', 'Wieder feuerbereit!'); break;
      case 'nichtNoetig': H.note('Nicht nötig bei dieser Waffe'); break;
      case 'visier': H.note(`${d.optic ? 'Absehen' : 'Visier'} ${d.zero} m`); break;
      case 'visierAnschlag': H.note(`Visier am Anschlag (${d.zero} m)`); break;
      case 'zuSchwer': H.note(`Zu schwer – über ${LIMIT_KG} kg bleibt liegen`); break;
      case 'getroffen':
        play('pain', { volume: 0.9 });
        H.note(`Treffer: ${PARTS[d.part] || ''}${d.sev === 'arterie' ? ' – es spritzt!' : ''}`);
        if (d.sev !== 'streif' && this._alliesNear(40)) H.say('Du', d.sev === 'arterie' ? 'Bin getroffen – schwer!' : 'Bin getroffen!');
        break;
      case 'bewusstlos': case 'ohnmacht': play('bodyfall', { volume: 0.8 }); break;
      case 'sani': H.say(d.name, 'Halt durch, ich komme!', { tone: 'funk' }); break;
      case 'stabilisiert': H.say(d.name, 'Blutung gestillt – du wirst wieder.', { tone: 'funk' }); break;
      case 'aufgewacht': H.note('Wieder bei Bewusstsein'); break;
      case 'aufgelegt': this.stats.rested++; H.note(d.how === 'liegend' ? 'Liegend aufgestützt' : 'Waffe aufgelegt'); try { A && A.play('rustle', { volume: 0.4 }); } catch { /* */ } break;
      case 'luft': play('breath_out', { volume: 0.8 }); break;
      case 'verbinden': H.note(`Verband: ${PARTS[d.part] || ''}${d.rucksack ? ' (aus dem Rucksack)' : ''}`); break;
      case 'abbinden': H.note(`Abbinden: ${PARTS[d.part] || ''}`); break;
      case 'verbunden': H.note(d.still ? 'Verbunden – blutet noch' : 'Verbunden'); break;
      case 'abgebunden': H.note('Abgebunden – Blutung steht'); break;
      case 'keineBlutung': case 'keineWunde': H.note('Keine Wunde zu versorgen'); break;
      case 'abbindenNurGlied': H.note('Abbinden nur an Arm oder Bein'); break;
      case 'keinVerband': H.note('Kein Verbandpäckchen mehr'); break;
      case 'keinAbbinde': H.note('Kein Abbindesystem mehr'); break;
      case 'leer': break;
      default: break;
    }
  }

  _alliesNear(r) {
    const P = this.G.player;
    if (!P || !P.team) return false;
    return (this.G.actors || []).some((a) => a !== P && a.alive && a.team === P.team && a.position.distanceTo(P.position) < r);
  }
  _allyName() {
    const P = this.G.player;
    let best = null, bd = 1e9;
    for (const a of this.G.actors || []) if (a !== P && a.alive && P && a.team === P.team) { const d = a.position.distanceTo(P.position); if (d < bd) { bd = d; best = a; } }
    return best ? best.name || 'Kamerad' : 'Trupp';
  }

  _onCommand(e) {
    const P = this.G.player;
    if (!P || e.leader !== P) return;
    const t = ORDER_TEXT[e.order];
    if (!t) return;
    this.hud.say('Du', t[0]);
    if (e.count > 0 && e.bots && e.bots[0]) setTimeout(() => this.hud && this.hud.say(e.bots[0].name || 'Trupp', t[1], { tone: 'funk' }), 700);
  }

  _onTactic(e) {
    const P = this.G.player;
    if (!P || !e || e.team !== P.team || !TACTIC_TEXT[e.type]) return;
    const now = this.G.time.elapsed;
    if (now - (this._lastTactic.get(e.type) ?? -99) < 10) return;
    this._lastTactic.set(e.type, now);
    this.hud.say(`Trupp ${e.squad != null ? String(e.squad).slice(0, 8) : ''}`.trim(), TACTIC_TEXT[e.type], { tone: 'funk' });
  }

  _onKill(e) {
    const P = this.G.player;
    if (!P) return;
    const now = this.G.time.elapsed;
    if (e.victim === P) { this._needPack = true; return; }
    const near = (a, r) => a && a.position && a.position.distanceTo(P.position) < r;
    if (e.killer === P && this._alliesNear(45) && Math.random() < 0.6 && now - (this._killSay || -9) > 5) {
      this._killSay = now;
      const n = this._allyName();
      setTimeout(() => this.hud && this.hud.say(n, Math.random() < 0.5 ? 'Treffer – der liegt.' : 'Gut getroffen!', { tone: 'funk' }), 600);
    } else if (e.killer && e.killer !== P && e.killer.team === P.team && near(e.killer, 60) && now - (this._killSay || -9) > 6) {
      this._killSay = now;
      this.hud.say(e.killer.name || 'Kamerad', 'Feind ausgeschaltet.', { tone: 'funk' });
    } else if (e.victim && e.victim.team === P.team && near(e.victim, 70) && now - (this._lossSay || -9) > 6) {
      this._lossSay = now;
      this.hud.say('Trupp', `${e.victim.name || 'Kamerad'} ist gefallen!`, { tone: 'warn' });
    }
  }

  /* ---------------------------------------------------------------- Takt */

  /** Vor dem Spieler (main.js): Tasten, die im Ausrüstungsmenü andere Bedeutung haben, abfangen. */
  preUpdate() {
    const I = this.G.input;
    if (!I || !this.inv.open) return;
    const map = { slot1: 1, slot2: 2, streak1: 3, streak2: 4, plate: 4 };
    for (const a of Object.keys(map)) if (I.pressed(a)) { I.consume(a); this._invAction(map[a]); }
    for (const a of ['fire', 'ads', 'reload', 'grenade', 'tactical', 'melee', 'swap']) I.consume(a);
  }

  _invAction(n) {
    const G = this.G, P = G.player, ctrl = P && P.weapon;
    if (!ctrl || this.inv.busy) return;
    const prim = ctrl.slots[0] && ctrl.slots[0].def, sec = ctrl.slots[1] && ctrl.slots[1].def;
    const ids = [prim, sec].filter((d) => d && d.mag > 0).map((d) => d.id);
    let dur = 0, fn = null, label = '';
    if (n === 1) { label = 'Magazine umpacken'; dur = 3.5; fn = () => ids.reduce((s, id) => s + this.kit.repackMags(id), 0); }
    else if (n === 2) { label = 'Leere Magazine in den Rucksack'; dur = 2; fn = () => ids.reduce((s, id) => s + this.kit.stowEmpties(id), 0); }
    else if (n === 3) { label = 'Magazine zusammenlegen'; dur = 8; fn = () => ids.reduce((s, id) => s + this.kit.consolidate(id), 0); }
    else if (n === 4) { label = 'Granaten und Verbandszeug umpacken'; dur = 3; fn = () => this.kit.repackGear(); }
    if (!fn) return;
    this.inv.busy = { t: 0, dur, fn, label };
    try { G.audio && G.audio.play('gear', { volume: 0.6 }); } catch { /* */ }
  }

  update(dt) {
    const G = this.G, P = G.player;
    if (!P) return;
    const ctrl = P.weapon;
    const I = G.input;
    if (ctrl && ctrl.sim !== this.gun) ctrl.sim = this.gun;
    if (this._needPack && P.alive && ctrl && ctrl.slots && ctrl.slots.length) {
      this._needPack = false;
      this.gun.reset(); this.body.reset(); P.simDown = false;
      this.kit.pack(ctrl);
      for (const st of ctrl.slots) if (st && st.def && st.def.cls !== 'melee') this.gun.of(st);
      this.inv.open = false; this.inv.busy = null;
    }
    const playing = G.match && G.match.state === 'playing';
    const alive = P.alive && playing && !P.vehicle;
    this._t += dt;
    // Abgleich mit fremden Änderungen (Nachschub, Aufsammeln, Wurf)
    if (ctrl && this._t > 0.25) { this._t = 0; try { this.gun.reconcile(ctrl); } catch (err) { console.warn('[isim] Abgleich', err); } }
    if (ctrl) this.kit.syncGrenades(ctrl);
    this.gun.update(dt, alive ? ctrl : null);
    this.body.update(dt, ctrl, I);
    const down = !!this.body.down;
    // Tasten
    if (alive && I && !down) {
      const p = (a) => I.pressed(a);
      if (p('sim_hilfe')) { this._helpOn = !this._helpOn; if (this.guide === 'aus') this.guide = 'hilfe'; }
      if (p('sim_inventar')) { this.inv.open = !this.inv.open; if (this.inv.open) this.stats.inv++; if (I.cancelAds) I.cancelAds(); }
      if (!this.inv.open && ctrl) {
        if (p('sim_durchladen')) this.gun.charge(ctrl);
        if (p('sim_magcheck') || p('inspect')) {
          const nowT = G.time.elapsed;
          const second = nowT - (this._chkAt || -9) < 4 && !this.gun.act;
          this._chkAt = second ? -9 : nowT;
          this.gun.check(ctrl, second ? 'kammer' : 'magazin');
        }
        if (p('sim_visier_auf')) this.gun.zeroStep(ctrl, 1);
        if (p('sim_visier_ab')) this.gun.zeroStep(ctrl, -1);
        if (p('reload') && ctrl._reload) this.gun.toEmergency(ctrl);
        if (p('verband')) this.body.treat(false);
        if (p('sim_abbinden')) this.body.treat(true);
      }
      const hc = I.down('sim_kompass'), hm = I.down('sim_karte');
      this._compT = hc ? this._compT + dt : 0;
      this._mapT = hm ? this._mapT + dt : 0;
      if (hc && this._compT < dt * 1.5) this.stats.compass++;
      if (hm && this._mapT < dt * 1.5) this.stats.map++;
      if ((hc || hm) && I.cancelAds) I.cancelAds();
    } else { this._compT = 0; this._mapT = 0; if (!alive) this.inv.open = false; }
    // Ausrüstungsmenü: Umpacken braucht Zeit
    const B = this.inv.busy;
    if (B) { B.t += dt; if (B.t >= B.dur) { this.inv.busy = null; const n = B.fn(); this.hud.note(n ? `${B.label}: erledigt` : `${B.label}: nichts zu tun`); } }
    // Auflegen, Atmung/Schwanken
    if (alive && ctrl) { this.body.updateRest(dt, ctrl); this.gun.swayMult = this.body.sway(dt, ctrl, I); }
    else { this.body.sway(dt, null, I); this.gun.swayMult = 1; }
    this._draw(dt, alive);
  }

  /* ---------------------------------------------------------------- Bild */

  _draw(dt, alive) {
    const G = this.G, P = G.player, b = this.body;
    const S = this._S || (this._S = {});
    const blood = b.blood;
    const fatigue = P && P.stamina ? 1 - P.stamina.ratio : 0;
    const d = b.down;
    S.desat = alive ? clamp((82 - blood) / 45, 0, 0.92) : 0;
    S.vignette = alive ? clamp(Math.max((72 - blood) / 38, fatigue * 0.3, b.pain * 0.25, b.holding ? 0.18 : 0), 0, 0.95) : 0;
    S.red = alive ? b.hitFlash * 0.85 : 0;
    // kurz vor der Ohnmacht flackert es schwarz; bewusstlos schwarz mit langsamen Atemzügen
    const flick = alive && !d && blood < 42 ? (Math.sin(G.time.elapsed * 1.7) * 0.5 + 0.5) * (42 - blood) / 30 : 0;
    S.black = d ? 0.93 + Math.sin(d.t * 1.2) * 0.05 : clamp(flick, 0, 0.6);
    if (d) {
      const k = (a, fb) => (G.input && G.input.label(a)) || fb;
      S.blackText = d.stab ? 'Versorgt – du kommst zu dir …' : 'Bewusstlos';
      S.blackSub = `${d.helper && d.helper.alive ? `${esc(d.helper.name || 'Kamerad')} ist unterwegs · ` : ''}<kbd>${esc(k('interact', 'F'))}</kbd> halten: aufgeben`;
    } else S.blackText = null;
    S.compass = alive && this._compT > 0.15;
    if (S.compass) S.heading = ((((-P.yaw * 180) / Math.PI) % 360) + 360) % 360;
    S.map = alive && this._mapT > 0.2;
    S.inv = alive && this.inv.open ? this._invHtml() : null;
    // Führung
    const steps = alive && this.guide !== 'aus' ? this._steps() : null;
    S.steps = null; S.why = null; S.hint = null;
    if (steps && (this.guide === 'tutorial' || this._helpOn)) {
      S.steps = steps;
      const next = steps.find((x) => x.warn) || steps.find((x) => !x.done);
      S.why = this.guide === 'tutorial' || this._helpOn ? next && next.why : null;
    } else if (steps) {
      const warn = steps.find((x) => x.warn);
      S.hint = warn ? `${warn.html}` : `<kbd>${esc((G.input && G.input.label('sim_hilfe')) || 'F2')}</kbd> Hilfe zu den Handgriffen`;
    }
    this.hud.update(dt, S);
  }

  _invHtml() {
    const k = (a, fb) => `<kbd>${esc((this.G.input && this.G.input.label(a)) || fb)}</kbd>`;
    const col = (where, title) => `<div><h3>${title}</h3><ul>${this.kit.rows(where).map((r) => `<li><span>${esc(r.label)}</span><em>×${r.n}</em></li>`).join('') || '<li><em>leer</em></li>'}</ul></div>`;
    const kg = this.kit.weight();
    const f = clamp(kg / LIMIT_KG, 0, 1);
    const load = kg > 34 ? 'überladen' : kg > 26 ? 'schwer' : kg > 18 ? 'mittel' : 'leicht';
    const c = this.body.conditionText();
    const B = this.inv.busy;
    return `<h3><span>Ausrüstung</span><span>${kg.toFixed(1).replace('.', ',')} kg · ${load}</span></h3>
      <div class="is-load${kg > 34 ? ' is-over' : kg > 26 ? ' is-heavy' : ''}"><i style="transform:scaleX(${f.toFixed(3)})"></i></div>
      <div class="is-cols">${col('weste', 'Weste (schneller Zugriff)')}${col('rucksack', 'Rucksack')}</div>
      <div class="is-cond">Zustand: ${esc(c.blood)}${c.wounds.length ? ` · ${c.wounds.map(esc).join(' · ')}` : ' · unverletzt'}</div>
      <div class="is-acts">${B ? `<span>${esc(B.label)} … ${Math.round((B.t / B.dur) * 100)} %</span>` : `<span>${k('slot1', '1')} Magazine aus dem Rucksack in die Weste</span><span>${k('slot2', '2')} Leere Magazine in den Rucksack</span><span>${k('streak1', '3')} Angebrochene zusammenlegen</span><span>${k('streak2', '4')} Granaten/Verband in die Weste</span>`}<span>${k('sim_inventar', 'P')} schließen</span></div>`;
  }

  /**
   * Handgriffe als Zustand (done aus dem echten Spielzustand bzw. was du schon einmal getan hast) – die Reihenfolge ist
   * nur die Empfehlung; warn = jetzt nötig (Ladehemmung, leeres Lager, Blutung).
   */
  _steps() {
    const G = this.G, P = G.player, ctrl = P && P.weapon, st = ctrl && ctrl.current;
    if (!st || !st.def) return null;
    const k = (a, fb) => `<kbd>${esc((G.input && G.input.label(a)) || fb)}</kbd>`;
    const S = this.stats, melee = st.def.cls === 'melee';
    const s = melee ? null : this.gun.of(st);
    const out = [];
    const b = this.body;
    if (b.wounds.some((w) => w.sev === 'arterie' && w.bleed > 0 && !w.tq)) out.push({ html: `Abbinden ${k('sim_abbinden', '7')}`, warn: true, why: 'Arterienblutung an Arm oder Bein: In einer halben Minute bist du bewusstlos. Abbinden stoppt sie sofort – das Glied bleibt danach beeinträchtigt.' });
    else if (b.bleeding > 0.05 && b.wounds.some((w) => w.bleed > 0 && !w.bandaged)) out.push({ html: `Verband anlegen ${k('verband', 'N')}`, warn: true, why: 'Du blutest. Ein Verband stillt Streifschüsse und mindert schwere Blutungen. Erst in Deckung gehen – die Waffe ist dabei weg.' });
    if (s && s.jam) out.push({ html: `Ladehemmung beheben ${k('sim_durchladen', 'O')}`, warn: true, why: 'Der Abzug ist tot: Klopfen (Magazin sitzt?), Ziehen (Spannhebel ganz durch), Kanten – die klemmende Patrone fliegt heraus.' });
    else if (s && s.box && s.chamber === 0 && s.mag && s.mag.n > 0) out.push({ html: `Durchladen ${k('sim_durchladen', 'O')}`, warn: true, why: 'Nach einem leer geschossenen Magazin steht der Verschluss offen bzw. das Lager ist leer: erst durchladen, dann kommt die nächste Patrone.' });
    else if (s && s.box && s.chamber === 0 && (!s.mag || s.mag.n === 0)) out.push({ html: `Nachladen ${k('reload', 'R')}`, warn: true, why: 'Lager und Magazin sind leer. Neues Magazin aus der Weste – danach durchladen.' });
    if (!melee) {
      out.push({ html: `Sicherung lösen ${k('feuermodus', 'M')}`, done: !s.safe, why: 'Der Wahlhebel steht auf „Sicher“ – der Abzug ist blockiert. Weiterschalten: Einzelfeuer, dann (falls vorhanden) Feuerstoß/Dauerfeuer, dann wieder Sicher.' });
      out.push({ html: `Lager prüfen ${k('sim_magcheck', 'I')} 2×`, done: S.chamberChecks > 0, why: 'Zweimal kurz drücken: Verschluss ein Stück zurück – liegt eine Patrone im Lager? Ohne Patrone im Lager klickt es beim Abziehen nur.' });
      out.push({ html: `Magazin prüfen ${k('sim_magcheck', 'I')}`, done: S.magChecks > 0, why: 'Es gibt keine Munitionsanzeige. Magazin herausziehen, wiegen, ansehen – du bekommst nur eine Schätzung.' });
      out.push({ html: `Visier einstellen ${k('sim_visier_auf', 'Bild ↑')}/${k('sim_visier_ab', 'Bild ↓')}`, done: S.zeroSet > 0, why: `Die Kugel fällt: Nur auf der eingestellten Entfernung (jetzt ${s.zero} m) trifft sie den Haltepunkt. Weiter weg hoch halten bzw. Visier verstellen, bewegte Ziele vorhalten – die Kugel fliegt eine Weile.` });
      out.push({ html: 'Schießen – auf Treffer hören', done: S.shots > 0, why: 'Kein Fadenkreuz, kein Treffermarker: Zielen über Kimme und Korn bzw. Optik. Treffer hörst du am Aufschlag, Kameraden melden „Treffer“.' });
      out.push({ html: `Nachladen ${k('reload', 'R')} · 2× = Notfall`, done: S.reloads > 0, why: 'Einmal: taktisch, das alte Magazin kommt zurück in die Tasche (langsamer). Zweimal schnell: Notfall – das alte fällt zu Boden, samt Restpatronen.' });
      out.push({ html: 'Waffe auflegen (Deckung oder liegend)', done: S.rested > 0, why: 'Im Anschlag an einer Kante/Brüstung oder im Liegen liegt die Waffe auf: kaum Schwanken, weniger Rückstoß. Sprinttaste im Anschlag: Atem anhalten.' });
    }
    out.push({ html: `Kompass ${k('sim_kompass', ',')} · Karte ${k('sim_karte', '.')} halten`, done: S.compass > 0 && S.map > 0, why: 'Keine Minikarte: Richtung mit dem Marschkompass, Lage mit der Papierkarte – deine Position musst du selbst bestimmen.' });
    out.push({ html: `Ausrüstung ${k('sim_inventar', 'P')}`, done: S.inv > 0, why: 'Nachladen greift nur aus der Weste, Granaten nur aus der Granattasche. Rucksack umpacken braucht Zeit – Gewicht macht müde und langsam.' });
    // warn zuerst, danach die übrigen in Empfehlungsreihenfolge
    return out.filter((x) => x.warn).concat(out.filter((x) => !x.warn));
  }

  /* ---------------------------------------------------------------- Konsole */

  state() {
    const P = this.G.player, ctrl = P && P.weapon, st = ctrl && ctrl.current;
    const s = st && st.def && st.def.cls !== 'melee' ? this.gun.of(st) : null;
    return {
      guide: this.guide, weapon: st && st.def && st.def.id, chamber: s && s.chamber, mag: s && s.mag ? { ...s.mag } : null, safe: s && s.safe, jam: s && s.jam,
      zero: s && s.zero, mags: st ? this.kit.mags(st.def.id).map((m) => `${m.where}:${m.n}/${m.cap}`) : [], ctrlMag: st && st.mag, ctrlReserve: st && st.reserve,
      blood: Math.round(this.body.blood), wounds: this.body.wounds.map((w) => `${w.part}:${w.sev}${w.tq ? '+tq' : w.bandaged ? '+v' : ''}`), down: !!this.body.down,
      kg: +this.kit.weight().toFixed(1), rested: this.body.rested, act: this.gun.act && this.gun.act.kind, treat: this.body.act && this.body.act.kind, stats: { ...this.stats },
    };
  }
  jam() { this.forceJam = true; }
  wound(part = 'beinL', sev = 'schwer') { const w = this.body._wound(part, sev); this.body.hitFlash = 1; return w; }

  dispose() {
    for (const f of this._off) f();
    this._off = [];
    const P = this.G.player;
    if (P) { if (P.weapon && P.weapon.sim === this.gun) P.weapon.sim = null; P.simDown = false; P.simSpeed = undefined; P.simStamina = undefined; }
    this.gun.dispose();
    this.hud.dispose();
    if (typeof document !== 'undefined') document.body.classList.remove('isim-on');
  }
}
