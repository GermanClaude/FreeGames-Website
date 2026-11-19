// NULLPUNKT — Feinheiten der Wanddurchbrüche (zerstoerung 15.11., zu bullet-holes.js):
// • Bewehrungsstahl: In Betonbreschen (Stil 1, ab 10 cm Wand) bleiben die Stäbe der Matten stehen – zwei Lagen bei
//   dicken Wänden, Raster 20 cm. Was die Öffnung kreuzt, ist meist gerissen und als Stummel vom Rand nach innen gebogen
//   (Sprengung/Granate drückt die Wand hinein), ein Teil spannt verbogen über das Loch. Gerechnet aus Umriss und Seed
//   der Bresche – auf allen Geräten gleich; neu gebaut, wenn die Bresche um > 15 % wächst (je Bild höchstens eine).
// • Fallende Brocken: Der Schutt der Bresche (bullet-holes.js _rubblePile) bricht am Rand heraus und fällt ballistisch
//   zum Liegeplatz (≈ 0,3–0,9 s), statt dort aufzutauchen. Auf „niedrig“ sofort am Platz.
// • Schuttkegel als Deckung: Unter großen Breschen (≥ 0,6 m²) liegt innen ein flacher Kegel (≤ 0,42 m, unter der
//   Stufenhöhe – begehbar), der Kugeln aufhält (building.addSolid, je Karte höchstens COVER_MAX).
// Nur Optik + Deckung; Kosten: ein InstancedMesh (Zylinder, 6 Seiten) je Match, Arbeit verteilt auf update().
import * as THREE from 'three';
import { worldPartsFrom } from './building.js?v=20261115041504';

const REBAR_MAX = { low: 0, medium: 420, high: 900, ultra: 1400 };
const COVER_MAX = 24;
const SP = 0.2;          // Mattenraster (m)
const RB_R = 0.007;      // Stabradius (Ø 14 mm)
const GRAV = 9.81;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _mid = new THREE.Vector3();
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
const _tx = new THREE.Vector3(), _ty = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function rng(seed) {
  let s = (Math.floor(seed * 1e5) * 2654435761) >>> 0 || 7;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class BreachDetail {
  constructor(holes) {
    this.H = holes;
    const G = holes.G;
    this.G = G;
    const q = (G.renderer && G.renderer.quality) || 'high';
    this.quality = q;
    this.anim = [];
    this.covers = [];
    this._dirty = new Set();
    const cap = REBAR_MAX[q] ?? 420;
    this.rebar = null;
    if (cap > 0) {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
      const mat = new THREE.MeshStandardMaterial({ color: 0x4b3a2c, roughness: 0.62, metalness: 0.55, name: 'bewehrung' });
      mat.userData.surface = 'metal';
      this.rebar = new THREE.InstancedMesh(geo, mat, cap);
      this.rebar.name = 'bewehrung';
      this.rebar.count = 0;
      this.rebar.frustumCulled = false;
      this.rebar.castShadow = q === 'high' || q === 'ultra';
      this.rebar.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this._rbN = 0;
      if (G.scene) G.scene.add(this.rebar);
    }
    this.stats = { rebar: 0, covers: 0, falling: 0 };
  }

  /** Bresche h hat sich geändert (Umriss gewachsen): Stahl neu, sobald Zeit ist. */
  touch(h) {
    if (!h || !h.cut || h.dead) return;
    if (this.rebar && h.style === 1 && (h.tn || 0) >= 0.1) this._dirty.add(h);
  }

  // --- Bewehrung ----------------------------------------------------------------------------------------------

  _area(h) { let A = 0; for (let k = 0; k < h.prof.length; k++) A += h.prof[k] * h.prof[k]; return (A * Math.PI) / h.prof.length; }

  _seg(a, b, r) {
    const M = this.rebar, cap = M.instanceMatrix.count;
    _d.copy(b).sub(a);
    const L = _d.length();
    if (L < 0.01) return -1;
    _mid.copy(a).add(b).multiplyScalar(0.5);
    _q.setFromUnitVectors(_up, _d.multiplyScalar(1 / L));
    _s.set(r, L, r);
    _m.compose(_mid, _q, _s);
    const slot = this._rbN % cap;
    // Ring voll: der älteste Stab einer anderen Bresche weicht (dessen Liste verliert ihn)
    const prev = this._owner && this._owner[slot];
    if (prev && prev._rb) { const i = prev._rb.indexOf(slot); if (i >= 0) prev._rb.splice(i, 1); }
    (this._owner || (this._owner = []))[slot] = this._cur;
    M.setMatrixAt(slot, _m);
    this._rbN++;
    return slot;
  }

  _build(h) {
    const M = this.rebar, H = this.H;
    if (!M || h.dead || !h.prof) return;
    const A = this._area(h);
    if (h._rbA && A < h._rbA * 1.15) return;
    h._rbA = A;
    // alte Stäbe dieser Bresche weg
    for (const sl of h._rb || []) M.setMatrixAt(sl, ZERO);
    h._rb = [];
    this._cur = h;
    H._frame(h.n, _tx, _ty);
    let R = 0; for (const r of h.prof) R = Math.max(R, r);
    R *= 1.25;
    const rnd = rng((h.seed || 0) + h.pos.x * 0.37 + h.pos.z * 0.71);
    const tn = h.tn;
    // Lagen: dünne Wand mittig, dicke Wand je 5 cm unter beiden Flächen
    const layers = tn > 0.22 ? [0.05, tn - 0.05] : [tn * 0.5];
    // Rasterlage an der Wand festmachen (Weltlage entlang tx/ty), nicht an der Breschenmitte
    const ox = (((h.pos.dot(_tx) % SP) + SP) % SP), oy = (((h.pos.y % SP) + SP) % SP);
    const inside = (x, y, f) => Math.hypot(x, y) < H._cutR(h, x, y, f) * 0.96;
    const P = (x, y, depth, bend = 0, out = new THREE.Vector3()) => out.copy(h.pos).addScaledVector(_tx, x).addScaledVector(_ty, y).addScaledVector(h.n, -depth - bend);
    for (const depth of layers) {
      const f = Math.min(1, depth / Math.max(tn, 1e-3));
      for (const axis of [0, 1]) {
        // axis 0: senkrechte Stäbe (laufen entlang y), 1: waagerechte
        const off = axis ? oy : ox;
        for (let c = -R - off; c <= R; c += SP) {
          // offene Strecke entlang des Stabs
          let a0 = null, a1 = null;
          for (let t = -R; t <= R; t += 0.04) {
            const x = axis ? t : c, y = axis ? c : t;
            if (inside(x, y, f)) { if (a0 === null) a0 = t; a1 = t; }
          }
          if (a0 === null || a1 - a0 < 0.08) continue;
          const len = a1 - a0;
          const at = (t, dp, bend) => (axis ? P(t, c, dp, bend) : P(c, t, dp, bend));
          const r = rnd();
          if (r < 0.28 && len < 1.6) {
            // verbogen, aber ganz: Bogen nach innen (3 Stücke)
            const bow = len * (0.12 + 0.18 * rnd());
            const p0 = at(a0 - 0.04, depth, 0), p1 = at(a0 + len * 0.33, depth, bow * 0.8), p2 = at(a0 + len * 0.66, depth, bow), p3 = at(a1 + 0.04, depth, 0);
            for (const [u, v] of [[p0, p1], [p1, p2], [p2, p3]]) { const sl = this._seg(u, v, RB_R); if (sl >= 0) h._rb.push(sl); }
          } else if (r < 0.9) {
            // gerissen: Stummel von beiden Rändern, erst gerade, dann nach innen umgebogen
            for (const [s0, dirS] of [[a0, 1], [a1, -1]]) {
              if (rnd() < 0.12) continue; // ganz abgerissen
              const L1 = len * (0.12 + 0.3 * rnd()), L2 = len * (0.05 + 0.18 * rnd());
              const p0 = at(s0 - dirS * 0.04, depth, 0);
              const p1 = at(s0 + dirS * L1, depth, L1 * 0.15);
              const p2 = at(s0 + dirS * (L1 + L2 * 0.4), depth, L1 * 0.15 + L2 * (0.6 + 0.6 * rnd()));
              for (const [u, v] of [[p0, p1], [p1, p2]]) { const sl = this._seg(u, v, RB_R); if (sl >= 0) h._rb.push(sl); }
            }
          }
          // sonst: Stab ganz herausgerissen
        }
      }
    }
    this._cur = null;
    M.count = Math.min(M.instanceMatrix.count, this._rbN);
    M.instanceMatrix.needsUpdate = true;
    this.stats.rebar = Math.min(M.instanceMatrix.count, this._rbN);
  }

  /** Bresche verschwunden (removeWhere): ihre Stäbe weg. */
  drop(h) {
    if (!this.rebar || !h || !h._rb) return;
    for (const sl of h._rb) this.rebar.setMatrixAt(sl, ZERO);
    h._rb = [];
    this.rebar.instanceMatrix.needsUpdate = true;
  }

  // --- fallende Brocken -----------------------------------------------------------------------------------------

  /** Brocken slot fliegt von p0 nach p1 (Endlage q, s); quiet/niedrig: sofort. */
  fall(M, slot, p0, p1, q, s, delay = 0) {
    if (this.quality === 'low') return false;
    const dy = Math.max(0.05, p0.y - p1.y);
    const T = Math.max(0.22, Math.min(0.9, Math.sqrt((2 * dy) / GRAV)));
    const vy = (p1.y - p0.y + 0.5 * GRAV * T * T) / T;
    // vorher unsichtbar (Platz belegt, Matrix 0) – erscheint am Rand, sobald die Verzögerung vorbei ist
    M.setMatrixAt(slot, ZERO);
    this.anim.push({ M, slot, p0: p0.clone(), p1: p1.clone(), q: q.clone(), s: s.clone(), T, vy, t: -delay, spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), w: 4 + Math.random() * 8 });
    return true;
  }

  // --- Schuttkegel als Deckung ----------------------------------------------------------------------------------

  /**
   * Kegel unter Bresche h (sync oder Sprengung): Quader innen am Wandfuß, Breite nach dem unteren Umriss.
   * floorY: Bodenhöhe innen (gemessen vom Aufrufer), A: Umrissfläche (m²).
   */
  cover(h, floorY, A) {
    const B = this.G.building;
    if (!B || typeof B.addSolid !== 'function' || !Number.isFinite(floorY) || A < 0.6 || h.tn < 0.08) return;
    // breiteste Stelle der unteren Hälfte
    let w = 0;
    const N = h.prof.length;
    for (let k = 0; k < N; k++) {
      const th = (k / N) * Math.PI * 2;
      if (Math.sin(th) > 0.1) continue;
      w = Math.max(w, Math.abs(Math.cos(th)) * h.prof[k]);
    }
    w = Math.max(0.5, Math.min(3.2, w * 1.8));
    const hh = Math.max(0.15, Math.min(0.42, 0.1 + 0.55 * Math.min(0.6, h.tn) * Math.sqrt(A) * 0.6));
    const n = h.n, depth = 0.85;
    const c = _a.copy(h.pos).addScaledVector(n, -(h.tn + depth / 2 + 0.02));
    const ry = Math.atan2(n.x, n.z);
    const part = worldPartsFrom([[0, hh / 2, 0, w / 2, hh / 2, depth / 2, 0]], c.x, floorY, c.z, ry)[0];
    let sol = h._cover;
    if (!sol) {
      sol = h._cover = { id: `schutt${this.covers.length}`, def: { surface: h.style === 7 ? 'brick' : 'concrete' }, mesh: this.H._rubble, parts: [part] };
      this.covers.push(sol);
      B.addSolid(sol);
      if (this.covers.length > COVER_MAX) B.removeSolid(this.covers.shift());
    } else sol.parts = [part];
    sol.hh = hh;
    this.stats.covers = this.covers.length;
    return { w, hh, depth, c: c.clone(), ry, floorY };
  }

  update(dt) {
    if (this._dirty.size) {
      const h = this._dirty.values().next().value;
      this._dirty.delete(h);
      try { this._build(h); } catch (err) { console.warn('[bewehrung]', err); }
    }
    if (!this.anim.length) { this.stats.falling = 0; return; }
    const touched = new Set();
    for (let i = this.anim.length - 1; i >= 0; i--) {
      const a = this.anim[i];
      a.t += dt;
      if (a.t < 0) continue;
      const t = Math.min(a.t, a.T), u = t / a.T;
      _a.lerpVectors(a.p0, a.p1, u);
      _a.y = a.p0.y + a.vy * t - 0.5 * GRAV * t * t;
      if (a.t >= a.T) { _a.copy(a.p1); _m.compose(_a, a.q, a.s); this.anim.splice(i, 1); }
      else { _q.setFromAxisAngle(a.spin, a.w * (a.T - t)); _q.multiply(a.q); _m.compose(_a, _q, a.s); }
      a.M.setMatrixAt(a.slot, _m);
      touched.add(a.M);
    }
    for (const M of touched) M.instanceMatrix.needsUpdate = true;
    this.stats.falling = this.anim.length;
  }

  dispose() {
    const B = this.G.building;
    if (B) for (const s of this.covers) B.removeSolid(s);
    this.covers = [];
    this.anim = [];
    this._dirty.clear();
    if (this.rebar) { this.rebar.removeFromParent(); this.rebar.geometry.dispose(); this.rebar.material.dispose(); this.rebar = null; }
  }
}
