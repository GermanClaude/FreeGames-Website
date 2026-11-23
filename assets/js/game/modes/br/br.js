// NULLPUNKT — Battle Royale (22.11.): Solo, jeder gegen jeden, offline gegen KI-Bots auf einer Großkarte (Grenzland, Flugplatz,
// in der App Weitmark). Teilnehmer je Grafikstufe (shared/modes.data.js limitsFor: 30/40/50/60, Telefone 24).
//
// Ablauf: Alle beginnen nur mit dem Messer (keine Weste, keine Granaten, keine Verbände, keine Klassenfähigkeit). Einstieg aus
// dem Transportflugzeug bzw. zufällig am Fallschirm (drop.js). Beute liegt in Gebäuden und Stellungen (loot.js, items.js), seltene
// Sonderwaffen (shared/weapons-br.data.js) an wenigen Orten und in zwei Versorgungsabwürfen. Die Zone schrumpft in sechs Phasen
// (zone.js), außerhalb gibt es Schaden je Sekunde. Keine Regeneration (styleFlags.regenDelay), Verbände heilen 30 Leben (Taste N,
// injuries.js styleFlags.bandageHeal). Kein Wiedereinstieg: Wer fällt, bekommt seinen Platz (Teilnehmer, die noch leben + 1) und
// lässt seine ganze Ausrüstung fallen. Der Letzte gewinnt. Fällt der Spieler, endet das Match für ihn nach 5 s mit seinem Platz.
// Bots: bots.js (Beute, Zone, Verbände) über objectiveFor(bot) – die übrige KI (Gefecht, Deckung) bleibt die normale.
// Mehrspieler: nur offline (MODES.br.online = false).
import * as THREE from 'three';
import { BaseMode } from '../base.js?v=20261123115551';
import { WEAPONS } from '../../../shared/weapons.data.js?v=20261123115551';
import { modeOptionValues, parseModeOptions } from '../../../shared/modes.data.js?v=20261123115551';
import { registerBrWeapons, unregisterBrWeapons, BR_WEAPON_IDS } from '../../../shared/weapons-br.data.js?v=20261123115551';
import { tx } from '../../../shared/i18n.js?v=20261123115551';
import { Zone } from './zone.js?v=20261123115551';
import { LootField, rngFrom } from './loot.js?v=20261123115551';
import { DropSystem, makeCanopy, makePlane } from './drop.js?v=20261123115551';
import { BrBots } from './bots.js?v=20261123115551';
import { BrHud } from './hud.js?v=20261123115551';
import { take, dropAll, strip, guns } from './inventory.js?v=20261123115551';
import { ammoTypeOf, AMMO_TYPES } from './items.js?v=20261123115551';

const PICK_R = 2.2;
const END_DELAY = 5;
const _v = new THREE.Vector3(), _f = new THREE.Vector3();

export class BattleRoyaleMode extends BaseMode {
  constructor(G, modeId, opts) {
    super(G, modeId, opts);
    this.teams = false;
    this.scores = {};
    this.lockLoadout = true;        // Ausrüstung kommt von der Karte
    this.ffaObjectives = true;      // bots/ai/brain.js: Ziele auch ohne Team (Beute, Zone)
    this.respawnDelay = 1e6;
    this.registered = registerBrWeapons(WEAPONS); // (attach meldet erneut an: BaseMode.attach ruft zuerst detach → onDetach)
    // Optionen (Lobby/URL mopt): Zonentempo, Einstieg
    let raw = {};
    try { raw = { ...((G.settings.get('modeOptions') || {})[this.id] || {}) }; } catch { raw = {}; }
    const url = G.params && typeof G.params.get === 'function' ? G.params.get('mopt') : null;
    if (url) raw = { ...raw, ...parseModeOptions(url) };
    if (opts && opts.modeOpts) raw = { ...raw, ...opts.modeOpts };
    this.options = modeOptionValues(this.id, raw);
    // Keine Regeneration, Verbände heilen (injuries.js)
    if (G.match) { G.match.styleFlags = { ...(G.match.styleFlags || {}), regenDelay: 1e9, bandageHeal: 30 }; this.flags = G.match.styleFlags; }
    this.seed = (G.params && G.params.get && Number(G.params.get('seed'))) || ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    this.rng = rngFrom(this.seed);
    this.placement = new Map();   // Akteur → Platz
    this.eliminated = [];         // Reihenfolge des Ausscheidens
    this.total = 0;
    this.zone = null;
    this.loot = null;
    this.drop = null;
    this.ai = new BrBots(this);
    this.hud = new BrHud(this);
    this.ctx = { G, W: WEAPONS, injuries: null };
    this._near = null;
    this._zoneT = 0;
    this._endAt = 0;
    this._wall = null;
    this._supply = [];
    this._supplyDone = new Set();
  }

  /* ------------------------------------------------------------ Lebenszyklus */

  onAttach(s) {
    this.registered = registerBrWeapons(WEAPONS);
    s.on('kill', (e) => { if (e && e.victim) this._eliminate(e.victim, e); });
  }

  warmObjects() {
    const out = [];
    try {
      const lf = new LootField(this.G, { WEAPONS });
      out.push(...lf.warmObjects());
      lf.dispose();
      out.push(makeCanopy(), makePlane(), this._wallMesh());
    } catch (err) { console.warn('[NULLPUNKT] BR Aufwärmen:', err); }
    return out;
  }

  onStart() {
    const G = this.G;
    this.ctx.injuries = G.injuries || null;
    const actors = G.actors.filter((a) => a && !a.isStreakEntity);
    this.total = actors.length;
    for (const a of actors) {
      this.scores[a.id] = 0;
      strip(this.ctx, a);
      if (a.isPlayer) { a.ability = null; a.gadget = null; }
      else a.gadget = null;
    }
    const w = G.world;
    const b = w && w.bounds;
    const bounds = b ? { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z } : undefined;
    this.zone = new Zone({ bounds, tempo: this.options.zone, rng: this.rng, pick: (x, z) => this._navNear(x, z, 14) });
    // Beute
    this.loot = new LootField(G, { rng: this.rng, WEAPONS });
    const rare = [...BR_WEAPON_IDS].sort(() => this.rng() - 0.5);
    try { this.loot.build({ players: this.total, rare }); } catch (err) { console.error('[NULLPUNKT] BR Beute:', err); }
    // Einstieg
    const spots = this.loot.spots;
    this.drop = new DropSystem(G, {
      kind: this.options.einstieg, rng: this.rng,
      pickLanding: (rng) => {
        const s = spots.length ? spots[(rng() * spots.length) | 0] : null;
        if (!s) return null;
        const p = s.position.clone();
        p.x += (rng() - 0.5) * 14; p.z += (rng() - 0.5) * 14;
        const n = this._navNode(p);
        return n ? n.position.clone() : s.position.clone();
      },
    });
    this.drop.setup(actors);
    // Zonenwand
    this._wall = this._wallMesh();
    if (G.scene) G.scene.add(this._wall);
    this.hud.attach();
  }

  onMatchStart() {
    this.G.events.emit('br:start', { mode: this });
  }

  onDetach() {
    if (this.drop) this.drop.dispose();
    if (this.loot) this.loot.dispose();
    if (this._wall) { this._wall.removeFromParent(); this._wall = null; }
    for (const s of this._supply) if (s.mesh) s.mesh.removeFromParent();
    this._supply.length = 0;
    this.hud.detach();
    for (const a of this.G.actors || []) { if (a) { a.invulnerable = false; a._brTarget = null; } }
    unregisterBrWeapons(WEAPONS);
  }

  canRespawn() { return false; }

  /** Todesbildschirm (ui/hud.js): kein Wiedereinstieg. */
  respawnNote(p) {
    const pl = this.placement.get(p);
    return pl ? tx(`Ausgeschieden – Platz ${pl} von ${this.total}`) : tx('Ausgeschieden');
  }

  /* ------------------------------------------------------------ Hilfen */

  airborne(a) { return !!(this.drop && this.drop.airborne(a)); }
  get dropPhase() { return this.drop ? this.drop.playerPhase : 'none'; }

  _navNode(p) {
    const nav = this.G.world && this.G.world.nav;
    if (!nav || typeof nav.nearest !== 'function') return null;
    try { return nav.nearest(p); } catch { return null; }
  }

  _navNear(x, z, r) {
    const w = this.G.world;
    const y = w && w.groundHeight ? w.groundHeight(x, z, 200) : 0;
    const n = this._navNode(_v.set(x, y == null ? 0 : y, z));
    return !!n && Math.hypot(n.position.x - x, n.position.z - z) < r;
  }

  /** Zufälliger erreichbarer Punkt im Kreis c (Anteil frac des Radius). */
  pointInCircle(c, frac = 0.7) {
    const w = this.G.world;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * c.r * frac;
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      const y = w && w.groundHeight ? w.groundHeight(x, z, 200) : 0;
      const n = this._navNode(_v.set(x, y == null ? 0 : y, z));
      if (n && Math.hypot(n.position.x - c.x, n.position.z - c.z) <= c.r) return n.position.clone();
    }
    return null;
  }

  aliveCount() {
    let n = 0;
    for (const a of this.G.actors) if (a && !a.isStreakEntity && a.alive) n++;
    return n;
  }

  _wallMesh() {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xb8683f, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, fog: true });
    const m = new THREE.Mesh(geo, mat);
    m.name = 'br:zonenwand';
    m.renderOrder = 2;
    m.frustumCulled = false;
    return m;
  }

  _notice(text, tone = 'gold') {
    const h = this.G.hud;
    try { if (h && typeof h._notice === 'function') { h._notice(tx(text), tone, null, 3.2, 'br'); return; } } catch { /* */ }
    this.G.events.emit('injury:notice', { text: tx(text), tone });
  }

  /* ------------------------------------------------------------ Bild */

  preUpdate(dt) {
    super.preUpdate(dt);
    const G = this.G;
    if (this.drop && !this.isOver) this.drop.preUpdate(dt, G.match.state === 'playing');
  }

  tick(dt, playing) {
    const G = this.G;
    const now = G.time.elapsed;
    if (!this.zone) return;
    // Einstieg (auch im Countdown: Spieler bleibt auf der Rampe)
    const landed = this.drop.update(dt, playing);
    for (const a of landed) {
      a.invulnerable = false;
      if (a.isPlayer) this._notice('Gelandet. Such dir Ausrüstung.', 'gold');
    }
    this.loot.update(dt);
    if (playing) {
      this.zone.update(dt);
      this._zoneDamage(dt);
      this.ai.tick(dt);
      this._supplyTick(dt);
    }
    this._playerLoot(playing);
    this._updateWall();
    this.hud.update(dt);
    // Ende: Spieler ausgeschieden → kurz zusehen, dann Ergebnis
    if (this._endAt && now >= this._endAt && !this.isOver) this.end('ausgeschieden');
  }

  _updateWall() {
    const m = this._wall, z = this.zone, b = this.G.world && this.G.world.bounds;
    if (!m || !z) return;
    const r = Math.max(0.5, z.cur.r);
    const y0 = b ? b.min.y - 10 : -10, y1 = b ? b.max.y + 140 : 150;
    m.position.set(z.cur.x, (y0 + y1) / 2, z.cur.z);
    m.scale.set(r, y1 - y0, r);
    m.visible = z.cur.r > 0.6;
  }

  _zoneDamage(dt) {
    this._zoneT -= dt;
    if (this._zoneT > 0) return;
    this._zoneT = 1;
    const G = this.G, z = this.zone;
    for (const a of G.actors) {
      if (!a || !a.alive || a.isStreakEntity || this.airborne(a)) continue;
      if (z.outside(a.position.x, a.position.z) <= 0) continue;
      // Umgebungsschaden ('world': umgeht Weste/Helm, Todesmeldung „Außerhalb des Einsatzgebiets“)
      G.combat.damage(a, { amount: z.dps, attacker: null, weaponId: 'world', zone: 'body' });
      if (a.isPlayer && G.renderer && G.renderer.suppress) G.renderer.suppress(0.12);
    }
  }

  /* ------------------------------------------------------------ Beute (Spieler) */

  _playerLoot(playing) {
    const G = this.G, P = G.player;
    this._near = null;
    if (!P || !P.alive || !playing || this.airborne(P) || P.vehicle) return;
    // nächster Gegenstand vor den Füßen (Blickrichtung bevorzugt)
    _f.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    let best = null, bs = Infinity;
    for (const e of this.loot.items) {
      if (e.taken) continue;
      const dx = e.position.x - P.position.x, dz = e.position.z - P.position.z;
      if (Math.abs(dx) > PICK_R || Math.abs(dz) > PICK_R) continue;
      const d = Math.hypot(dx, dz);
      if (d > PICK_R || Math.abs(e.position.y - P.position.y) > 1.6) continue;
      const s = d - (d > 0.01 ? (dx * _f.x + dz * _f.z) / d : 0) * 0.6;
      if (s < bs) { bs = s; best = e; }
    }
    this._near = best;
    if (best && G.input && typeof G.input.pressed === 'function' && G.input.pressed('interact')) {
      if (G.input.consume) G.input.consume('interact');
      this.pickup(best);
    }
  }

  /** Gegenstand für den Spieler aufnehmen (Taste F / Knopf). */
  pickup(e = this._near) {
    const G = this.G, P = G.player;
    if (!e || e.taken || !P || !P.alive) return false;
    const r = take(this.ctx, P, e);
    if (!r.ok) { if (r.text) this._notice(r.text, 'dim'); return false; }
    this.loot.take(e);
    if (r.drop && r.drop.length) this.loot.scatter(r.drop, P.position);
    this._notice(r.text, r.tone);
    const au = G.audio;
    if (au && typeof au.play === 'function') { try { au.play(e.kind === 'weapon' ? 'equip' : 'reload_mag_in', { position: P.position, volume: 0.7 }); } catch { /* */ } }
    this._near = null;
    return true;
  }

  /** Aufforderung im HUD (ui/hud.js _updatePrompt). */
  prompt() {
    const e = this._near;
    if (!e) return null;
    const G = this.G, P = G.player;
    const name = this.loot.name(e);
    let text;
    if (e.kind === 'weapon') {
      const g = guns(P);
      const def = WEAPONS[e.key];
      if (g.some((s) => s.id === e.key)) text = `Munition aus ${name} nehmen`;
      else if (g.length >= 2) {
        const cur = P.weapon && P.weapon.current && P.weapon.current.def;
        text = `${name} aufnehmen · tauscht ${cur && cur.cls !== 'melee' ? cur.name : g[0].def.name}`;
      } else text = `${name} aufnehmen`;
      if (def && e.rare) text += ' · selten';
    } else if (e.kind === 'ammo') text = `${name} aufnehmen (${e.amount})`;
    else text = `${name} aufnehmen`;
    return { text: tx(text), action: () => this.pickup(e) };
  }

  /* ------------------------------------------------------------ Versorgungsabwurf */

  _supplyTick(dt) {
    const z = this.zone;
    // zu Beginn der Phasen 2 und 4 (Wartezeit): Kiste am Schirm in den nächsten Kreis
    for (const ph of [1, 3]) {
      if (this._supplyDone.has(ph) || z.phase !== ph || z.state !== 'warten') continue;
      this._supplyDone.add(ph);
      const n = z.next || z.cur;
      const p = this.pointInCircle(n, 0.6);
      if (!p) continue;
      const mesh = new THREE.Group();
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: 0x4a5036, roughness: 0.85, metalness: 0.1 }));
      crate.position.y = 0.35;
      const can = makeCanopy();
      mesh.add(crate, can);
      mesh.position.set(p.x, p.y + 140, p.z);
      if (this.G.scene) this.G.scene.add(mesh);
      this._supply.push({ pos: p, mesh, crate, can, landed: false });
      this._notice('Versorgungsabwurf im nächsten Kreis – auf der Karte markiert.', 'gold');
    }
    for (const s of this._supply) {
      if (s.landed) continue;
      s.mesh.position.y -= 8 * dt;
      if (s.mesh.position.y <= s.pos.y) {
        s.mesh.position.y = s.pos.y;
        s.landed = true;
        s.can.removeFromParent();
        const id = BR_WEAPON_IDS[(this.rng() * BR_WEAPON_IDS.length) | 0];
        const def = WEAPONS[id];
        const t = ammoTypeOf(def);
        const list = [{ kind: 'weapon', key: id, amount: def ? def.mag : 0, rare: true }, { kind: 'vest', key: 'schwer', amount: 0 }, { kind: 'helmet', key: 'schwer', amount: 0 }, { kind: 'bandage', key: 'tasche', amount: 4 }];
        if (t) list.push({ kind: 'ammo', key: t, amount: AMMO_TYPES[t].pack * 2 });
        _v.copy(s.pos); _v.x += 1.1;
        this.loot.scatter(list, _v);
      }
    }
  }

  /** Versorgungsabwürfe für Karte/Minikarte. */
  get supplies() { return this._supply; }

  /* ------------------------------------------------------------ Ausscheiden, Wertung */

  _eliminate(victim, e) {
    if (!victim || victim.isStreakEntity || this.placement.has(victim) || this.isOver) return;
    if (this.drop) this.drop.release(victim);
    const left = this.aliveCount();
    const place = left + 1;
    this.placement.set(victim, place);
    this.eliminated.push(victim);
    victim.respawnAt = null;
    // Ausrüstung fällt
    try {
      const items = dropAll(this.ctx, victim);
      if (items.length && this.loot) this.loot.scatter(items, victim.position);
    } catch (err) { console.error('[NULLPUNKT] BR Beute des Gefallenen:', err); }
    victim.armor = null;
    if (victim.isPlayer) {
      this._endAt = this.G.time.elapsed + END_DELAY;
      this._notice(`Ausgeschieden – Platz ${place} von ${this.total}.`, 'enemy');
    } else if (e && e.killer && e.killer.isPlayer) {
      this._notice(`Noch ${left} übrig.`, 'gold');
    }
    if (left <= 1) {
      const last = this.G.actors.find((a) => a && !a.isStreakEntity && a.alive);
      if (last) this.placement.set(last, 1);
      if (last && last.isPlayer) this._notice('Letzter Überlebender!', 'gold');
      this.end('letzter');
    }
  }

  onKillScored(killer) {
    if (!killer || killer.isStreakEntity) return;
    this.scores[killer.id] = (this.scores[killer.id] || 0) + 1;
  }

  /** Platz (lebende teilen sich den besten noch offenen). */
  placeOf(a) { return this.placement.get(a) || (a.alive ? 1 : this.total); }

  compareRows(x, y) {
    const px = this.placement.get(x.actor) || 0, py = this.placement.get(y.actor) || 0;
    // Lebende vor Ausgeschiedenen, dann Platz, dann Abschüsse
    if (!px !== !py) return !px ? -1 : 1;
    return (px - py) || (y.kills - x.kills) || (x.isPlayer ? -1 : y.isPlayer ? 1 : 0);
  }

  rankKey(r) { return `${this.placement.get(r.actor) || 0}:${r.kills}`; }

  extraRow(a) { const p = this.placement.get(a); return { label: 'Platz', value: p ? p : '–' }; }

  decide(board) {
    const alive = board.filter((r) => !this.placement.has(r.actor) || this.placement.get(r.actor) === 1);
    if (alive.length === 1) return { winner: alive[0].actor.id };
    return { winner: 'draw' };
  }

  resultExtra() { return { placement: this.G.player ? this.placement.get(this.G.player) || null : null, total: this.total, seed: this.seed }; }

  /* ------------------------------------------------------------ HUD-Haken (ui/hud.js) */

  hudSub() { return this.hud.sub(); }
  hudClock() { return this.zone ? (this.zone.state === 'ende' ? Infinity : this.zone.left) : Infinity; }
  hudScores(p) {
    const left = this.aliveCount();
    return { a: left, as: tx('Übrig'), b: p && p.stats ? p.stats.kills | 0 : 0, bs: tx('Abschüsse'), ra: this.total ? left / this.total : 0, rb: 0 };
  }
  drawMinimap(ctx, toScreen, scale, d, half, rad) { this.hud.drawMinimap(ctx, toScreen, scale, d, half, rad); }

  /** Bot-KI (bots/ai/brain.js). */
  objectiveFor(bot) { return this.ai.objectiveFor(bot); }

  /** Prüfstand: Kurzzustand. */
  debugState() {
    const z = this.zone ? this.zone.info() : null;
    return {
      seed: this.seed, total: this.total, alive: this.aliveCount(), placed: this.placement.size, drop: this.dropPhase,
      zone: z && { phase: z.phase, state: z.state, left: Math.round(z.left), r: Math.round(z.cur.r) },
      loot: this.loot ? { ...this.loot.stats, now: this.loot.items.length } : null,
      pending: this.drop ? this.drop.pending : 0,
    };
  }
}
