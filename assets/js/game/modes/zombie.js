// NULLPUNKT — Zombie-Modus (offline): Wellen-Überleben gegen Untote, allein oder mit KI-Kameraden (Team A gegen Team B).
// Ablauf: Vorbereitung (PREP_S) → Welle 1 … n (zombie-waves.js waveSpec: Zahl, Mischung Schlurfer/Hetzer/Hüne, Härte) →
// je Welle eine Pause (PAUSE_S) mit Nachschub: Munitionsausgabe und Sanitätsstation (mappoints) neben dem Spieler, alle
// Stationen sofort bereit, KI-Kameraden aufgefüllt, Gefallene kommen neben einem Lebenden zurück. Sieg nach der letzten
// Welle (Option „wellen“: 5/10/15) bzw. endlos bis zum letzten Mann; fallen alle Überlebenden, ist das Spiel aus.
// Regisseur: hält höchstens spec.maxAlive Untote gleichzeitig am Leben, setzt Nachrücker in kleinen Gruppen außer Sicht
// (Navigationsknoten 24–80 m von jedem Überlebenden, keine Sichtlinie von dessen Augen), vergibt Flanken (Umzingeln),
// gibt Untoten ohne Hinweis eine Witterung (lureFor: ungefähr dort, wo Menschen sind – mit der Zeit genauer) und holt
// Festgelaufene an einen neuen Einsatzort. Punkte: Abschüsse (50, Kopftreffer +20), überstandene Wellen (waveBonus).
// Untote sind Bot-Unterklassen (bots/zombie/zombie.js) in G.bots.bots/G.actors; Wertungstabelle und Ergebnis lassen sie aus.
// Mehrspieler: nicht freigeschaltet (MODES.zombie.online = false) – siehe Bericht/Changelog.
import * as THREE from 'three';
import { BaseMode } from './base.js?v=20261123115551';
import { SCORE_RULES, modeOptionValues, parseModeOptions } from '../../shared/modes.data.js?v=20261123115551';
import { waveSpec, pickType, waveBonus, PAUSE_S, PREP_S, TYPE_IDS } from './zombie-waves.js?v=20261123115551';
import { createZombie } from '../bots/zombie/zombie.js?v=20261123115551';
import { warmRagMesh } from '../bots/zombie/look.js?v=20261123115551';
import { refillAmmo } from '../mappoints.js?v=20261123115551';
import { tx } from '../../shared/i18n.js?v=20261123115551';

const _eye = new THREE.Vector3();
const _p = new THREE.Vector3();
const rnd = (a, b) => a + Math.random() * (b - a);
const DIFF_DMG = { rekrut: 0.75, regulaer: 1, veteran: 1.15, elite: 1.3 };

export class ZombieMode extends BaseMode {
  constructor(G, modeId, opts) {
    super(G, modeId, opts);
    this.teams = true;
    this.scores = { A: 0, B: 0 };
    this.teamNames = { A: tx('Überlebende'), B: tx('Untote') };
    this.rules = { ...SCORE_RULES, kill: 50, headshot: 20 };
    this.timeLimit = 0;
    this.timeLeft = Infinity;
    this.scoreLimit = 0;
    let raw = {};
    try { raw = { ...((G.settings.get('modeOptions') || {})[modeId] || {}) }; } catch { raw = {}; }
    const url = G.params && typeof G.params.get === 'function' ? G.params.get('mopt') : null;
    if (url) raw = { ...raw, ...parseModeOptions(url) };
    const o = modeOptionValues(modeId, opts.modeOpts || raw);
    this.endless = o.wellen === 'endlos';
    this.waveMax = this.endless ? Infinity : Math.max(1, Number(o.wellen) || 10);
    this.density = o.horde || 'mittel';
    this.wave = 0;
    this.cleared = 0;
    this.phase = 'vorbereitung'; // 'vorbereitung' | 'welle' | 'pause'
    this._phaseEnd = 0;
    this._waveStart = 0;
    this.spec = null;
    this.spawned = {};
    this.killedWave = 0;
    this.totalKills = 0;
    this.zombies = [];
    this._cands = null;
    this._nextSpawn = 0;
    this._respawnOpen = false;
    this._supply = null;
    this._checkAt = 0;
    this._said = 0;
    this._won = false;
    this._flankI = 0;
    this._seed = 1;
  }

  /* ------------------------------------------------------------ Lebenszyklus */

  onAttach(s) {
    s.on('kill', (e) => { const v = e && e.victim; if (v && v.isZombie && !this.isOver) this._zombieDown(v); });
  }

  warmObjects() {
    try { return [warmRagMesh()]; } catch { return []; }
  }

  onStart() {
    this.phase = 'vorbereitung';
    this._phaseEnd = this.elapsed + PREP_S;
    this._collectCandidates();
    this._notice(tx('Sie kommen. Such dir eine Stellung und sichere die Zugänge.'), 'signal');
  }

  onDetach() {
    this.zombies.length = 0;
  }

  onSpawn(actor) {
    if (!actor) return;
    if (actor.isZombie) actor.armor = null; // keine Westen/Platten für Untote (Kopf tödlich, Körper nach Typ)
  }

  canRespawn(actor) {
    if (this.isOver || !actor || actor.isZombie) return false;
    return this._respawnOpen;
  }

  respawnNote() {
    if (this.isOver) return null;
    return this.phase === 'welle' ? tx('Gefallen – zurück in der nächsten Pause, solange jemand durchhält') : tx('Gleich geht es weiter …');
  }

  allowOvertime() { return false; }

  /* ------------------------------------------------------------ Takt */

  tick(dt, playing) {
    if (!playing || this.isOver) return;
    const now = this.elapsed;
    if (this.phase !== 'welle') {
      const left = this._phaseEnd - now;
      if (left <= 5.05 && this._said !== this.wave + 1) { this._said = this.wave + 1; this._notice(tx(`Welle ${this.wave + 1} in 5 Sekunden.`), 'signal'); }
      if (left <= 0) this._beginWave();
      return;
    }
    // Welle: Nachrücker setzen, Festgelaufene versetzen, Ende prüfen
    this._direct(now);
    if (now >= this._checkAt) { this._checkAt = now + 2; this._recycle(now); }
    this._count();
    if (!this._humansAlive()) { this._won = false; this.end('wiped'); return; }
    if (this.spec && this.killedWave >= this.spec.total) this._endWave();
  }

  _count() {
    let alive = 0;
    for (const z of this.zombies) if (z.alive) alive++;
    this.aliveZombies = alive;
    this.scores.A = this.cleared;
    this.scores.B = this.spec ? Math.max(0, this.spec.total - this.killedWave) : 0;
  }

  _humans() {
    return this.G.actors.filter((a) => a.team === 'A' && !a.isZombie && !a.isStreakEntity);
  }

  _humansAlive() {
    for (const a of this.G.actors) if (a.alive && a.team === 'A' && !a.isZombie && !a.isStreakEntity) return true;
    return false;
  }

  /* ------------------------------------------------------------ Wellen */

  _crew() {
    const hs = this._humans();
    return { crew: hs.length, allies: hs.filter((a) => a.isBot).length };
  }

  _beginWave() {
    const G = this.G;
    this.wave += 1;
    const { crew, allies } = this._crew();
    const tier = (G.bots && G.bots.tier) || 'high';
    this.spec = waveSpec(this.wave, { crew, allies, density: this.density, tier });
    this.spawned = Object.fromEntries(TYPE_IDS.map((id) => [id, 0]));
    this.killedWave = 0;
    this.phase = 'welle';
    this._waveStart = this.elapsed;
    this._nextSpawn = this.elapsed + 1.2;
    this._respawnOpen = false;
    const last = !this.endless && this.wave >= this.waveMax;
    this._notice(last ? tx(`Letzte Welle – ${this.spec.total} Untote.`) : tx(`Welle ${this.wave} – ${this.spec.total} Untote.`), 'enemy');
    this._ui('capture_lost');
    G.events.emit('zombie:wave', { mode: this, wave: this.wave, phase: 'start', total: this.spec.total });
  }

  _endWave() {
    const G = this.G;
    this.cleared = this.wave;
    this.scores.A = this.cleared;
    for (const a of this._humans()) if (a.alive) this.award(a, 'wave', waveBonus(this.wave));
    G.events.emit('zombie:wave', { mode: this, wave: this.wave, phase: 'end' });
    if (!this.endless && this.wave >= this.waveMax) { this._won = true; this.end('cleared'); return; }
    this.phase = 'pause';
    this._phaseEnd = this.elapsed + PAUSE_S;
    this._ui('capture');
    this._notice(tx(`Welle ${this.wave} überstanden. Nachschub liegt bereit.`), 'gold');
    this._resupply();
  }

  /** Pause: Gefallene zurück, Kameraden auffüllen, Nachschub neben den Spieler, Stationen bereit. */
  _resupply() {
    const G = this.G;
    const living = this._humans().filter((a) => a.alive);
    const anchor = (G.player && G.player.alive && G.player.team === 'A') ? G.player : living[0] || null;
    // Gefallene neben einem Lebenden einsetzen
    this._respawnOpen = true;
    try {
      for (const a of this._humans()) {
        if (a.alive || typeof G.spawnActor !== 'function') continue;
        const host = anchor || living[0];
        const pos = host ? this._nearSpot(host.position, 2.5, 7) : null;
        G.spawnActor(a, pos ? { position: pos, yaw: host.yaw || 0 } : null);
      }
    } catch (err) { console.error('[NULLPUNKT] Zombie: Wiedereinstieg', err); } finally { this._respawnOpen = false; }
    for (const a of this._humans()) {
      if (!a.alive) continue;
      if (a.isBot) { try { refillAmmo(a); } catch { /* */ } a.health = a.maxHealth; }
    }
    // Nachschub: Munition + Sanität (Stationen der Karte, sofort bereit)
    const P = G.points;
    if (P && Array.isArray(P.points)) {
      for (const p of P.points) p.readyAt = 0;
      if (anchor && typeof P._add === 'function') {
        const a = this._nearSpot(anchor.position, 2.5, 6);
        const b = a ? this._nearSpot(a, 1.6, 3.5, anchor.position) : null;
        if (a && b) {
          const yaw = Math.atan2(anchor.position.x - a.x, anchor.position.z - a.z);
          if (!this._supply) {
            try { this._supply = [P._add('munition', a.clone(), null, yaw), P._add('sani', b.clone(), null, yaw)]; } catch (err) { console.error('[NULLPUNKT] Zombie: Nachschub', err); this._supply = null; }
          } else {
            for (const [pt, at] of [[this._supply[0], a], [this._supply[1], b]]) {
              if (!pt) continue;
              pt.position.copy(at);
              if (pt.mesh) { pt.mesh.position.copy(at); pt.mesh.rotation.y = yaw; }
              pt.readyAt = 0;
            }
          }
        }
      }
    }
  }

  _zombieDown() {
    this.killedWave += 1;
    this.totalKills += 1;
    this._count();
  }

  /* ------------------------------------------------------------ Regisseur */

  _direct(now) {
    const S = this.spec;
    if (!S || now < this._nextSpawn) return;
    let done = 0;
    for (const id of TYPE_IDS) done += this.spawned[id] | 0;
    if (done >= S.total) return;
    let alive = 0;
    for (const z of this.zombies) if (z.alive) alive++;
    const room = Math.min(S.burst, S.total - done, S.maxAlive - alive);
    if (room <= 0) { this._nextSpawn = now + 0.4; return; }
    const pt = this._spawnPoint(this._fails > 6);
    if (!pt) { this._fails = (this._fails | 0) + 1; this._nextSpawn = now + 0.6; return; }
    this._fails = 0;
    let n = 0;
    for (let i = 0; i < room; i++) {
      const type = pickType(S, this.spawned);
      if (!type) break;
      const pos = i === 0 ? pt.clone() : this._nearSpot(pt, 0.8, 2.6) || pt.clone();
      if (this._place(type, pos)) { this.spawned[type] = (this.spawned[type] | 0) + 1; n++; }
    }
    this._nextSpawn = now + S.interval * rnd(0.6, 1.4) * Math.max(1, n);
  }

  /** Untoten des Typs holen (freier aus dem Vorrat oder neu) und einsetzen. */
  _place(type, pos) {
    const G = this.G;
    const M = G.bots;
    if (!M || typeof G.spawnActor !== 'function') return false;
    const now = G.time.elapsed;
    let z = null;
    for (const c of this.zombies) if (!c.alive && c.typeId === type && now - (c.diedAt ?? -1e9) > 1.5 && (!z || (c.diedAt ?? 0) < (z.diedAt ?? 0))) z = c;
    if (!z) {
      try { z = createZombie(M, { type, difficulty: G.match.difficulty, seed: this._seed++ * 977 + ((Math.random() * 1e6) | 0) }); } catch (err) { console.error('[NULLPUNKT] Zombie anlegen', err); return false; }
      this.zombies.push(z);
    }
    const S = this.spec;
    const dm = DIFF_DMG[G.match.difficulty] || 1;
    z.setWave({ hpMult: S ? S.hpMult : 1, speedMult: S ? S.speedMult : 1, dmgMult: (S ? S.dmgMult : 1) * dm });
    // Flanken reihum verteilen: links/rechts abwechselnd, unterschiedlich weit
    const k = this._flankI++;
    z.flank = (k % 2 ? 1 : -1) * (0.35 + ((k * 0.618) % 1) * 1.1);
    let yaw = 0;
    const tgt = this._nearestHuman(pos);
    if (tgt) yaw = Math.atan2(-(tgt.position.x - pos.x), -(tgt.position.z - pos.z));
    try { G.spawnActor(z, { position: pos, yaw }); } catch (err) { console.error('[NULLPUNKT] Zombie einsetzen', err); return false; }
    z.respawnAt = null;
    return z.alive;
  }

  _nearestHuman(pos) {
    let best = null, bd = Infinity;
    for (const a of this.G.actors) {
      if (!a.alive || a.team !== 'A' || a.isZombie) continue;
      const d = a.position.distanceToSquared(pos);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  /** Kandidaten für Einsatzorte: Navigationsknoten (Stichprobe) + Startpunkte von Team B. */
  _collectCandidates() {
    const W = this.G.world;
    const out = [];
    const nav = W && W.nav;
    const nodes = nav && Array.isArray(nav.nodes) ? nav.nodes : [];
    const step = Math.max(1, Math.floor(nodes.length / 900));
    const b = W && W.bounds;
    for (let i = 0; i < nodes.length; i += step) {
      const p = nodes[(i + ((Math.random() * step) | 0)) % nodes.length].position;
      if (!p || (b && (p.x < b.min.x + 2 || p.x > b.max.x - 2 || p.z < b.min.z + 2 || p.z > b.max.z - 2))) continue;
      out.push(p.clone());
    }
    for (const t of ['B', 'ffa', 'A']) for (const s of (W && W.spawns && W.spawns[t]) || []) if (s && s.position) out.push(s.position.clone());
    this._cands = out;
  }

  /** Einsatzort außer Sicht: 24–80 m vom nächsten Überlebenden, keine Sichtlinie von dessen Augen (Brust- und Kopfhöhe). */
  _spawnPoint(relax = false) {
    const G = this.G;
    const W = G.world;
    const C = this._cands;
    if (!C || !C.length) return null;
    const hs = this._humans().filter((a) => a.alive);
    if (!hs.length) return null;
    const groundY = hs.reduce((s, a) => s + a.position.y, 0) / hs.length;
    let relaxed = null;
    for (let t = 0; t < 18; t++) {
      const c = C[(Math.random() * C.length) | 0];
      let dmin = Infinity;
      for (const h of hs) dmin = Math.min(dmin, h.position.distanceTo(c));
      if (dmin < (relax ? 16 : 24) || dmin > (relax ? 120 : 80)) continue;
      if (Math.abs(c.y - groundY) > 7) continue; // keine Dächer weit über/unter dem Geschehen
      if (relax) { if (!relaxed) relaxed = c; continue; }
      let seen = false;
      for (const h of hs) {
        if (h.position.distanceTo(c) > 90) continue;
        if (h.getEyePosition) h.getEyePosition(_eye); else _eye.copy(h.position).setY(h.position.y + 1.6);
        if (!W || typeof W.lineOfSight !== 'function') break;
        if (W.lineOfSight(_eye, _p.set(c.x, c.y + 1.5, c.z)) || W.lineOfSight(_eye, _p.set(c.x, c.y + 0.6, c.z))) { seen = true; break; }
      }
      if (!seen) return c;
      if (!relaxed && dmin > 40) relaxed = c;
    }
    // notfalls weit weg und nicht im Blickfeld des Spielers (nach mehreren Fehlversuchen auch näher)
    if (relaxed) {
      const P = G.player;
      if (!P || !P.alive) return relaxed;
      const fx = -Math.sin(P.yaw || 0), fz = -Math.cos(P.yaw || 0);
      const dx = relaxed.x - P.position.x, dz = relaxed.z - P.position.z;
      if ((dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1) < (relax ? 0.55 : 0.2)) return relaxed;
    }
    return null;
  }

  /** Freier Navigationsknoten im Ring [rMin, rMax] um pos (nicht näher als 1,4 m an avoid). */
  _nearSpot(pos, rMin, rMax, avoid = null) {
    const nav = this.G.world && this.G.world.nav;
    if (nav && typeof nav.nodesInRadius === 'function') {
      const list = nav.nodesInRadius(pos, rMax).filter((n) => {
        const d = n.position.distanceTo(pos);
        return d >= rMin && Math.abs(n.position.y - pos.y) < 1.2 && (!avoid || n.position.distanceTo(avoid) > 1.4);
      });
      if (list.length) return list[(Math.random() * list.length) | 0].position.clone();
    }
    return null;
  }

  /** Untote fern vom Geschehen, die lange nichts gefunden haben, an einen neuen Einsatzort holen. */
  _recycle(now) {
    const G = this.G;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const h = this._nearestHuman(z.position);
      if (!h) return;
      const d = h.position.distanceTo(z.position);
      const lost = G.time.elapsed - (z._lostAt || 0);
      const stuck = z.nav && z.nav.failed && G.time.elapsed - (z._spawnedAt || 0) > 12;
      if ((d > 55 && lost > 25) || (stuck && d > 30 && !z.inView)) {
        const pt = this._spawnPoint();
        if (pt && pt.distanceTo(h.position) < d) { try { G.spawnActor(z, { position: pt.clone(), yaw: z.yaw }); } catch { /* */ } }
      }
    }
    void now;
  }

  /**
   * Witterung für Untote ohne Hinweis: ungefähr der nächste Überlebende – anfangs ±22 m, mit der Dauer der Welle genauer.
   * (zombie.js _think, Modus „streunen“)
   */
  lureFor(z) {
    const G = this.G;
    const now = G.time.elapsed;
    if (z._lure && now < z._lureAt) return z._lure;
    const h = this._nearestHuman(z.position);
    if (!h) return null;
    const err = Math.max(4, 22 - (this.elapsed - this._waveStart) * 0.3);
    const a = Math.random() * Math.PI * 2, r = Math.random() * err;
    const tgt = _p.set(h.position.x + Math.cos(a) * r, h.position.y, h.position.z + Math.sin(a) * r);
    const nav = G.world && G.world.nav;
    const n = nav && typeof nav.nearest === 'function' ? nav.nearest(tgt) : null;
    z._lure = (z._lure || new THREE.Vector3()).copy(n ? n.position : tgt);
    z._lureAt = now + rnd(3, 6);
    return z._lure;
  }

  /* ------------------------------------------------------------ KI-Kameraden */

  /** Kameraden bleiben beim Spieler (bzw. dem nächsten Lebenden) und verteidigen von dort. */
  objectiveFor(bot) {
    if (!bot || bot.team !== 'A' || bot.isZombie) return null;
    const G = this.G;
    let anchor = G.player && G.player.alive && G.player.team === 'A' ? G.player : null;
    if (!anchor) for (const a of G.actors) if (a !== bot && a.alive && a.team === 'A' && !a.isZombie) { anchor = a; break; }
    if (!anchor) return null;
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4;
    return { id: 'trupp', position: new THREE.Vector3(anchor.position.x + Math.cos(a) * r, anchor.position.y, anchor.position.z + Math.sin(a) * r), radius: 8, kind: 'capture' };
  }

  /* ------------------------------------------------------------ Anzeige */

  /** Kopfleiste (ui/hud.js): Welle, verbleibende Untote, Uhr (Pause: Restzeit; Welle: Dauer). */
  hudState() {
    const S = this.spec;
    const pause = this.phase !== 'welle';
    const n = pause ? this.wave + 1 : this.wave;
    const left = S && !pause ? Math.max(0, S.total - this.killedWave) : 0;
    return {
      time: pause ? Math.max(0, this._phaseEnd - this.elapsed) : this.elapsed - this._waveStart,
      timeSub: pause ? (this.wave ? tx('Pause') : tx('Vorbereitung')) : '',
      last: pause && this._phaseEnd - this.elapsed <= 5,
      a: Number.isFinite(this.waveMax) ? `${n}/${this.waveMax}` : String(n),
      aLabel: tx('Welle'),
      aBar: Number.isFinite(this.waveMax) ? Math.min(1, this.cleared / this.waveMax) : 0,
      b: pause ? '–' : String(left),
      bLabel: tx('Untote übrig'),
      bBar: S && !pause ? left / Math.max(1, S.total) : 0,
    };
  }

  _notice(text, tone) { this.G.events.emit('mode:notice', { text, tone }); }

  _ui(name) {
    const A = this.G.audio;
    if (A && typeof A.ui === 'function') { try { A.ui(name); } catch { /* */ } }
  }

  /* ------------------------------------------------------------ Wertung / Ergebnis */

  scoreboard() {
    return super.scoreboard().filter((r) => !(r.actor && r.actor.isZombie));
  }

  extraRow(a) {
    return { label: tx('Kopftreffer'), value: a.stats ? a.stats.headshots || 0 : 0 };
  }

  decide() {
    return { winner: this._won ? 'A' : 'B' };
  }

  end(reason) {
    if (this.isOver) return;
    if (reason === 'cleared') this._won = true;
    super.end(reason);
  }

  buildResult(reason) {
    const r = super.buildResult(reason);
    r.teamNames = { A: tx('Wellen überstanden'), B: this.endless ? tx('Untote erledigt') : tx('Wellen gesamt') };
    r.teamScores = { A: this.cleared, B: this.endless ? this.totalKills : this.waveMax };
    r.extra = { waves: this.cleared, reached: this.wave, kills: this.totalKills, endless: this.endless };
    return r;
  }
}
