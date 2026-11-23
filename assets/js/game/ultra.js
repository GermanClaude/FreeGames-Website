// NULLPUNKT — Ultra-Realismus (Spielstil „Ultra-Realismus“, Nutzer 22.11.: „so wie Bodycam – Physik, Realismus, gefühlt
// gar kein HUD“). Regeln stehen in shared/classes.data.js (GAME_STYLES.ultra: Schaden, Kopftreffer tödlich, keine
// Regeneration, Verbände heilen, Teambeschuss, Fallschaden, kein HUD); main.applyStyle setzt G.match.style = 'realistisch'
// (alle Realismus-Regeln gelten) und G.match.ultra = true, dann legt main dieses Modul als G.ultra an.
//
// Dieses Modul setzt nur Parameter, die Spieler, Waffe und HUD von sich aus lesen (alle optional, ohne Ultra = 1/aus):
//   player.moveInertia        Faktor auf Beschleunigen/Bremsen am Boden (player.js) – träger Anlauf und Halt
//   player.moveSpeedMult      Tempo (Gehen/Sprint) × Verwundung
//   player.fallSafe/fallDamageMult  Fallschaden früher und stärker
//   player.weaponWeightMult   gefühlte Waffenmasse (controller → viewmodel s.weightMult): Nachlauf beim Schwenken, Schwanken
//   player.aimSwayMult        Zielwandern/Zielfernrohr-Schwanken × (Ausdauer, Verwundung) (controller._updateSway)
//   player.aimDriftMin        Mindest-Zielwandern im Anschlag (auch Waffen, die sonst ruhig liegen)
//   player.aimBreath          Atemzug hebt/senkt die Mündung im Anschlag (rad); Atem anhalten = Sprint-Taste im Anschlag
//   player.freeAimRecoilShare Anteil des Rückstoßes, der bei freiem Zielen die Waffe statt der Sicht bewegt
// Dazu: Körperkamera-Stoß bei jedem eigenen Schuss (Kamera sitzt an der Brust, nicht an der Waffe), kurze und blasse
// Ziel-/Zonenmarken nach dem Einsatz (HUD .is-brief, game.css), einmalige Hinweise auf Magazin-Prüfen und Verband.
// Keine Allokation je Bild, keine Strahlen – kostet praktisch nichts.
import { tx } from '../shared/i18n.js?v=20261123073102';

/** Abstimmung (Bodycam-Gefühl; Bewegungsphysik geprüft mit festen Zeitschritten, siehe Bericht). */
export const ULTRA = Object.freeze({
  inertia: 0.55,      // Beschleunigung/Bremsen × 0,55: Gehen ≈ 0,32 s auf 90 % statt 0,18 s, Sprint ≈ 0,56 s
  speed: 0.9,         // Grundtempo (Gehen 4,9 m/s, Sprint 7,4 m/s)
  woundSlow: 0.2,     // bis −20 % bei fast leerem Leben
  weight: 1.5,        // gefühlte Masse der Waffe
  sway: 1.5,          // Zielwandern
  woundSway: 1.0,     // + bis 100 % verwundet
  tiredSway: 0.6,     // + bis 60 % bei leerer Ausdauer
  driftMin: 0.0011,   // rad Mindest-Zielwandern im Anschlag
  breath: 0.0012,     // rad Atemzug im Anschlag (ruhig); nach dem Sprint bis ×3,2
  recoilShare: 0.7,   // freies Zielen: 70 % des Stoßes in die Waffe
  brief: 5,           // s Zielmarken nach dem Einsatz
});

// Körperkamera-Stoß je Schuss (Feder-Geschwindigkeiten der player._cam-Federn) nach Waffenklasse
const JOLT = { pistol: 0.7, smg: 0.75, ar: 1, marksman: 1.25, lmg: 1.1, shotgun: 1.8, sniper: 2, launcher: 2.2, melee: 0 };

export class UltraRealism {
  constructor(G) {
    this.G = G;
    this._briefUntil = 0;
    this._brief = false;
    this._told = false;
    const on = (n, f) => G.events.on(n, f);
    this._off = [
      on('actor:spawn', (e) => { if (e && e.actor === G.player) this._briefUntil = G.time.elapsed + ULTRA.brief; }),
      on('match:start', () => { this._briefUntil = G.time.elapsed + ULTRA.brief; this._tell(); }),
      on('weapon:fire', (e) => { if (e && e.actor === G.player) this._jolt(e); }),
    ];
  }

  /** Vor dem Bild des Spielers: Körper- und Waffenwerte (Verwundung/Ausdauer laufend). */
  preUpdate() {
    const G = this.G;
    const p = G.player;
    if (!p) return;
    const fl = (G.match && G.match.styleFlags) || {};
    const hp = p.maxHealth > 0 ? Math.max(0, Math.min(1, p.health / p.maxHealth)) : 1;
    const wound = 1 - hp;
    const st = p.stamina;
    const tired = st ? 1 - Math.max(0, Math.min(1, st.ratio)) : 0;
    p.moveInertia = ULTRA.inertia;
    p.moveSpeedMult = ULTRA.speed * (1 - ULTRA.woundSlow * wound);
    p.fallSafe = fl.fallSafe > 0 ? fl.fallSafe : 11;
    p.fallDamageMult = fl.fallMult > 0 ? fl.fallMult : 1.6;
    p.weaponWeightMult = ULTRA.weight;
    p.aimSwayMult = ULTRA.sway * (1 + ULTRA.woundSway * wound) * (1 + ULTRA.tiredSway * tired);
    p.aimDriftMin = ULTRA.driftMin;
    p.aimBreath = ULTRA.breath;
    p.freeAimRecoilShare = ULTRA.recoilShare;
    // Ziel-/Zonenmarken nur kurz nach dem Einsatz (blass, game.css .h-root[data-ultra].is-brief)
    const root = G.hud && G.hud.root;
    const brief = !!(p.alive && G.time.elapsed < this._briefUntil);
    if (root && brief !== this._brief) { this._brief = brief; root.classList.toggle('is-brief', brief); }
  }

  /** Eigener Schuss: die Brustkamera wird vom Körper mitgerissen – die Waffe bewegt sich im Bild davon unabhängig. */
  _jolt(e) {
    const p = this.G.player;
    const c = p && p._cam;
    if (!c || !c.p || !c.r) return;
    const W = this.G.data && this.G.data.WEAPONS;
    const def = W && e.weaponId ? W[e.weaponId] : null;
    const k = (def && JOLT[def.cls]) ?? 1;
    if (!(k > 0)) return;
    const prone = 1 - 0.6 * (p.proneBlend || 0);
    const s = k * prone * (0.85 + Math.random() * 0.3);
    c.p.v += 0.32 * s;                         // Brust kippt nach hinten → Bild nickt hoch
    c.r.v += (Math.random() - 0.5) * 0.5 * s;  // Schulter dreht
    c.x.v += (Math.random() - 0.5) * 0.22 * s;
    c.z.v -= 0.18 * s;                         // Körper weicht zurück
  }

  /** Einmal je Match: wie man ohne Anzeigen an Munition und Heilung kommt. */
  _tell() {
    if (this._told) return;
    this._told = true;
    const ev = this.G.events;
    const touch = this.G.input && this.G.input.mode === 'touch';
    ev.emit('injury:notice', { text: tx('Ultra-Realismus: keine Anzeigen. Heilung nur mit Verband.'), tone: 'dim', key: 'verband' });
    if (!touch) ev.emit('injury:notice', { text: tx('Magazin prüfen'), tone: 'dim', key: 'inspect' });
  }

  dispose() {
    for (const f of this._off) { try { f(); } catch { /* */ } }
    this._off = [];
    const p = this.G.player;
    if (p) {
      for (const k of ['moveInertia', 'moveSpeedMult', 'fallSafe', 'fallDamageMult', 'weaponWeightMult', 'aimSwayMult', 'aimDriftMin', 'aimBreath', 'freeAimRecoilShare']) p[k] = undefined;
    }
    const root = this.G.hud && this.G.hud.root;
    if (root) root.classList.remove('is-brief');
  }
}
