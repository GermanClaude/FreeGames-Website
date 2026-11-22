// NULLPUNKT — Zerbrechliche Requisiten (zerstoerung 15.11., Nutzer: „realistische Zerstörung“): Holzkisten, Paletten,
// Zaunfelder, Blechkisten. Die Welt merkt sich beim Bau je Stück seine Dreiecke (world/builder.js beginBreak,
// world/bruch.js); hier sammelt jedes Stück Schaden und zerbricht:
// • Kugeln ('impact' auf seine Fläche, Schaden nach Waffe): Holz splittert nach einigen Treffern, Blech/Zaun kaum.
// • Explosionen ('explosion'): Druck nach Abstand und Ladung (Granate ≈ 1, Rakete 2,6, Sprenggranate 3,2 …).
// • Fahrzeuge: ein Fahrzeug, das mit mehr als Schritttempo hineinfährt, zermalmt Kisten/Paletten/Zaunfelder.
// Bruch: Dreiecke aus Kugel-/Kollisions-BVH und Optik weg (world.breakables.disable), Staub/Splitter (effects.rubble),
// Krachen, dazu Bretter/Bleche als einfache Starrkörper (fallen, prallen ab, bleiben liegen – je Grafikstufe begrenzt,
// die ältesten verschwinden). Was auf dem Stück stand (Kistenstapel), stürzt kurz danach mit.
// Mehrspieler: Der Host bzw. das Einzelspiel entscheidet; zerbrochene Stücke gehen als 'ev' pb {i:[…]} an alle, neue
// Clients bekommen die Liste beim Beitritt (net/sync-host.js). Clients zerbrechen nichts selbst – Kollision und
// Deckung sind damit auf allen Geräten gleich; Trümmerflug ist reine Optik (aus der Stück-Id gewürfelt).
import * as THREE from 'three';
import { WEAPONS } from '../shared/weapons.data.js?v=20261122020853';

const CELL = 4;
// Druck je Ladungsart (wie bullet-holes.js BLAST_Q) – Explosion zerlegt Holz im Umkreis von ≈ 1,5 + 1,2·Q m
const BLAST_Q = { frag: 1, semtex: 1.5, impact: 0.8, rocket: 2.6, shell_he: 3.2, shell_heat: 2.2, shell_ap: 1.2, drone: 1.1, strike: 3, c4: 3.5, sentry: 0.15, tank: 3 };
// Anteil des Kugelschadens je Werkstoff (Zaun/Blech: Kugeln stanzen nur Löcher)
const BULLET_K = { wood: 1, metal: 0.04, fabric: 0.6 };
const PIECES = { low: 40, medium: 120, high: 260, ultra: 380 };
const GRAV = 9.81;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
const _c = new THREE.Color();
const WOOD = [[0.42, 0.3, 0.18], [0.5, 0.37, 0.22], [0.36, 0.26, 0.16]];
const METAL = [[0.32, 0.34, 0.35], [0.26, 0.28, 0.3], [0.4, 0.4, 0.38]];

function rngOf(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Breakables {
  constructor(G) {
    this.G = G;
    const acc = G.world && G.world.breakables;
    this.acc = acc && Array.isArray(acc.list) ? acc : null;
    this.list = this.acc ? this.acc.list : [];
    this.active = this.list.length > 0;
    this.stats = { pieces: 0, broken: 0, total: this.list.length };
    this._grid = new Map();
    this._queue = [];
    this._pieces = [];
    this._vehT = 0;
    if (!this.active) return;
    this.list.forEach((r, i) => {
      r.idx = i; r.dmg = 0; r.broken = false;
      r.c = Math.cos(r.ry); r.s = Math.sin(r.ry);
      const R = Math.hypot(r.w, r.d) / 2;
      for (let gx = Math.floor((r.x - R) / CELL); gx <= Math.floor((r.x + R) / CELL); gx++) {
        for (let gz = Math.floor((r.z - R) / CELL); gz <= Math.floor((r.z + R) / CELL); gz++) {
          const k = gx * 73856093 ^ gz * 19349663;
          let L = this._grid.get(k); if (!L) this._grid.set(k, (L = []));
          L.push(r);
        }
      }
    });
    // Stapel: was auf einem Stück steht (Unterkante ≈ Oberkante, Grundriss überlappt)
    for (const r of this.list) {
      r.above = this._near(r.x, r.z, Math.hypot(r.w, r.d)).filter((q) => q !== r && Math.abs(q.y - (r.y + r.h)) < 0.08 && Math.hypot(q.x - r.x, q.z - r.z) < (Math.min(r.w, r.d) + Math.min(q.w, q.d)) / 2);
    }
    const q = (G.renderer && G.renderer.quality) || 'high';
    this.quality = q;
    const max = PIECES[q] || 120;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, name: 'truemmer' });
    mat.userData.surface = 'wood';
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.name = 'truemmer-requisiten';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = q === 'high' || q === 'ultra';
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, _c.setRGB(1, 1, 1));
    this._slot = 0;
    if (G.scene) G.scene.add(this.mesh);
    this._off = [
      G.events.on('impact', (e) => this._impact(e)),
      G.events.on('explosion', (e) => this._explosion(e)),
    ];
  }

  /** Entscheidet dieses Gerät? (Einzelspiel/Host; Clients übernehmen 'ev' pb) */
  get authority() { const M = this.G.match; return !(M && M.netRole === 'client'); }

  _near(x, z, r) {
    const out = new Set();
    for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) {
      for (let gz = Math.floor((z - r) / CELL); gz <= Math.floor((z + r) / CELL); gz++) {
        const L = this._grid.get(gx * 73856093 ^ gz * 19349663);
        if (L) for (const q of L) out.add(q);
      }
    }
    return [...out];
  }

  /** Punkt p in Stück r (lokaler Quader, Zugabe m)? */
  _inside(r, p, m = 0.04) {
    const dx = p.x - r.x, dz = p.z - r.z;
    const lx = dx * r.c - dz * r.s, lz = dx * r.s + dz * r.c;
    return Math.abs(lx) <= r.w / 2 + m && Math.abs(lz) <= r.d / 2 + m && p.y >= r.y - m && p.y <= r.y + r.h + m;
  }

  /** Abstand von p zur Quaderhülle von r (0 innen). */
  _dist(r, p) {
    const dx = p.x - r.x, dz = p.z - r.z;
    const lx = dx * r.c - dz * r.s, lz = dx * r.s + dz * r.c;
    const ex = Math.max(0, Math.abs(lx) - r.w / 2), ez = Math.max(0, Math.abs(lz) - r.d / 2);
    const ey = Math.max(0, r.y - p.y, p.y - (r.y + r.h));
    return Math.hypot(ex, ey, ez);
  }

  _impact(e) {
    if (!this.active || !e || !e.point || e.exit || e.fx || !this.authority) return;
    const p = e.point;
    for (const r of this._near(p.x, p.z, 1.5)) {
      if (r.broken || !this._inside(r, p)) continue;
      const def = e.weaponId && WEAPONS[e.weaponId];
      const dmg = e.melee ? 25 : def && def.damage ? (def.damage.max || 25) * (def.pellets > 1 ? 0.5 : 1) * (def.antiMateriel ? 3 : 1) : 25;
      this.damage(r, dmg * (BULLET_K[r.surface] ?? 0.5), e.dir || null);
      return;
    }
  }

  _explosion(e) {
    if (!this.active || !e || !e.position || e.nonLethal || !this.authority) return;
    const Q = BLAST_Q[e.type] ?? BLAST_Q[e.weaponId] ?? Math.max(0.3, (e.radius || 4) / 6);
    const R = 1.5 + 1.2 * Q;
    const p = e.position;
    for (const r of this._near(p.x, p.z, R + 1.5)) {
      if (r.broken) continue;
      const d = this._dist(r, p);
      if (d > R) continue;
      // Holz: 160 hp-Kiste zerlegt eine Granate bis ≈ 2 m; Blech/Zaun brauchen schwere Ladungen oder Nähe
      const k = r.surface === 'metal' ? 0.35 : 1;
      const dmg = 420 * Q * k * Math.pow(1 - d / R, 1.3) + (d < 0.6 ? 200 * Q * k : 0);
      _v.set(r.x - p.x, 0, r.z - p.z);
      this.damage(r, dmg, _v.lengthSq() > 1e-6 ? _v.normalize().clone() : null);
    }
  }

  /** Schaden (Host/Einzelspiel). dir: Wirkrichtung (Trümmer fliegen dorthin). */
  damage(r, amount, dir = null) {
    if (!r || r.broken || !(amount > 0) || !this.authority) return;
    r.dmg += amount;
    if (r.dmg >= r.hp) this.breakRec(r, { dir });
  }

  /** Stück zerbrechen (auch aus dem Netz: fromNet; now = ohne Effekte, Nachreichen beim Beitritt). */
  breakRec(r, { dir = null, fromNet = false, now = false, chain = false } = {}) {
    if (!r || r.broken) return;
    r.broken = true;
    this.stats.broken++;
    const G = this.G;
    try { this.acc.disable(r); } catch { /* Welt im Abbau */ }
    if (!fromNet) this._relay([r.idx]);
    if (!now) this._fx(r, dir, chain);
    // was darauf stand, stürzt mit (leicht verzögert, nur die entscheidende Seite – die anderen bekommen 'pb')
    if (!fromNet) for (const q of r.above || []) if (!q.broken) this._queue.push({ r: q, at: (G.time ? G.time.elapsed : 0) + 0.18 + ((q.idx * 37) % 10) * 0.012, dir });
    G.events.emit('prop:break', { id: r.idx, kind: r.kind, position: new THREE.Vector3(r.x, r.y + r.h / 2, r.z) });
  }

  _relay(ids) {
    const G = this.G, M = G.match;
    const sync = G.net && G.net.sync;
    if (M && M.netRole === 'host' && sync && typeof sync.relayProps === 'function') { try { sync.relayProps(ids); } catch { /* */ } }
  }

  /** Netz ('ev' pb): Liste zerbrochener Ids. */
  applyNet(m) {
    if (!this.active || !m || !Array.isArray(m.i)) return;
    for (const i of m.i) { const r = this.list[i | 0]; if (r && !r.broken) this.breakRec(r, { fromNet: true, now: !!m.now }); }
  }

  /** Zerbrochene Ids (Host → Späteinsteiger). */
  snapshot() { return this.list.filter((r) => r.broken).map((r) => r.idx); }

  _fx(r, dir, chain) {
    const G = this.G, fx = G.effects;
    const c = new THREE.Vector3(r.x, r.y + r.h / 2, r.z);
    const n = _w.set(r.s, 0, r.c);
    const size = Math.max(r.w, r.h, r.d);
    try { if (fx && typeof fx.rubble === 'function') fx.rubble(c, n, r.surface === 'metal' ? 'metal' : 'wood', Math.min(1.6, size * (chain ? 0.6 : 0.9))); } catch { /* Beiwerk */ }
    const A = G.audio;
    if (A && typeof A.play === 'function') {
      try {
        A.play(r.surface === 'metal' ? 'impact_metal' : 'impact_wood', { position: c, volume: chain ? 0.7 : 1, pitch: 0.55 });
        A.play('debris', { position: c, volume: Math.min(1, 0.4 + size * 0.3) });
      } catch { /* Klang ist Beiwerk */ }
    }
    this._spawnPieces(r, dir);
  }

  /** Bretter (Holz) bzw. Bleche/Stäbe (Metall) als einfache Starrkörper. */
  _spawnPieces(r, dir) {
    const M = this.mesh;
    if (!M) return;
    const cap = M.instanceMatrix.count;
    const rnd = rngOf(r.idx + 1);
    const metal = r.surface === 'metal', fence = r.kind === 'zaun' || r.kind === 'gitterzaun';
    const vol = r.w * r.h * r.d;
    let n = fence ? 5 : Math.round(Math.max(4, Math.min(16, 6 + vol * 8)));
    if (this.quality === 'low') n = Math.ceil(n * 0.4);
    const pal = metal ? METAL : WOOD;
    const now = this.G.time ? this.G.time.elapsed : 0;
    for (let i = 0; i < n; i++) {
      // Lage im Stück (lokal), dann Welt
      const lx = (rnd() - 0.5) * r.w * 0.8, ly = r.h * (0.15 + 0.75 * rnd()), lz = (rnd() - 0.5) * r.d * 0.8;
      const wx = r.x + lx * r.c + lz * r.s, wz = r.z - lx * r.s + lz * r.c;
      let sx, sy, sz;
      if (fence) { sx = r.w * (0.3 + 0.4 * rnd()); sy = 0.04; sz = 0.04; }
      else if (r.kind === 'palette') { sx = 1.2 * (0.35 + 0.6 * rnd()); sy = 0.022; sz = 0.1 + 0.05 * rnd(); }
      else { const L = Math.max(r.w, r.d) * (0.3 + 0.6 * rnd()); sx = L; sy = metal ? 0.006 : 0.02 + 0.01 * rnd(); sz = metal ? L * (0.3 + 0.5 * rnd()) : 0.07 + 0.08 * rnd(); }
      const out = dir ? dir : _v.set(lx * r.c + lz * r.s, 0, -lx * r.s + lz * r.c).normalize();
      const sp = 1.2 + 3.5 * rnd();
      const pc = {
        p: new THREE.Vector3(wx, r.y + ly, wz),
        v: new THREE.Vector3(out.x * sp + (rnd() - 0.5) * 2, 1.5 + 3 * rnd(), out.z * sp + (rnd() - 0.5) * 2),
        q: new THREE.Quaternion().setFromEuler(_e.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28)),
        w: new THREE.Vector3((rnd() - 0.5) * 14, (rnd() - 0.5) * 14, (rnd() - 0.5) * 14),
        s: new THREE.Vector3(sx, sy, sz), floor: null, ft: 0, rest: false, t0: now, slot: this._slot % cap,
      };
      // Slot neu belegt: alter Körper fällt weg
      const old = this._pieces.findIndex((o) => o.slot === pc.slot);
      if (old >= 0) this._pieces.splice(old, 1);
      this._slot++;
      const col = pal[Math.floor(rnd() * pal.length)], b = 0.8 + 0.35 * rnd();
      M.setColorAt(pc.slot, _c.setRGB(col[0] * b, col[1] * b, col[2] * b));
      this._pieces.push(pc);
      this._write(pc);
    }
    M.count = Math.min(cap, this._slot);
    if (M.instanceColor) M.instanceColor.needsUpdate = true;
    this.stats.pieces = this._pieces.length;
  }

  _write(pc) {
    _m.compose(pc.p, pc.q, pc.s);
    this.mesh.setMatrixAt(pc.slot, _m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  _floorAt(p) {
    const W = this.G.world;
    const g = W && typeof W.groundHeight === 'function' ? W.groundHeight(p.x, p.z, p.y + 0.3) : null;
    return g == null ? p.y - 50 : g;
  }

  update(dt) {
    if (!this.active) return;
    const G = this.G, now = G.time ? G.time.elapsed : 0;
    if (this._queue.length) {
      for (let i = this._queue.length - 1; i >= 0; i--) {
        const it = this._queue[i];
        if (now < it.at) continue;
        this._queue.splice(i, 1);
        this.breakRec(it.r, { dir: it.dir, chain: true });
      }
    }
    // Fahrzeuge zermalmen (Host/Einzelspiel, 5 × je Sekunde)
    this._vehT -= dt;
    if (this._vehT <= 0 && this.authority) { this._vehT = 0.2; this._vehicles(); }
    if (!this._pieces.length) return;
    const step = Math.min(dt, 0.05);
    let moved = false;
    for (const pc of this._pieces) {
      if (pc.rest) continue;
      moved = true;
      pc.ft -= step;
      if (pc.floor == null || pc.ft <= 0) { pc.floor = this._floorAt(pc.p); pc.ft = 0.12; }
      pc.v.y -= GRAV * step;
      pc.p.addScaledVector(pc.v, step);
      const half = Math.max(pc.s.y, Math.min(pc.s.x, pc.s.z) * 0.25) * 0.5;
      if (pc.p.y - half <= pc.floor) {
        pc.p.y = pc.floor + half;
        if (pc.v.y < -1.2) { pc.v.y *= -0.28; pc.v.x *= 0.55; pc.v.z *= 0.55; pc.w.multiplyScalar(0.5); }
        else {
          // liegen bleiben: flach auf die größte Fläche drehen (Restdrehung um die Hochachse bleibt)
          pc.v.set(0, 0, 0); pc.rest = true;
          _e.setFromQuaternion(pc.q, 'YXZ');
          pc.q.setFromEuler(_e.set(0, _e.y, 0, 'YXZ'));
          pc.p.y = pc.floor + pc.s.y * 0.5;
        }
      }
      if (!pc.rest && pc.w.lengthSq() > 1e-4) {
        const a = pc.w.length() * step;
        _q.setFromAxisAngle(_w.copy(pc.w).normalize(), a);
        pc.q.premultiply(_q);
      }
      if (now - pc.t0 > 6) { pc.rest = true; }
      this._write(pc);
    }
    if (!moved) return;
  }

  _vehicles() {
    const V = this.G.vehicles;
    const list = V && Array.isArray(V.list) ? V.list : null;
    if (!list) return;
    for (const v of list) {
      const b = v && v.body;
      if (!v.alive || !b || !b.pos) continue;
      const vel = b.vel || b.velocity;
      const sp = vel ? Math.hypot(vel.x, vel.z) : 0;
      if (sp < 1.2) continue;
      const hb = v.def && v.def.hullBox;
      // hullBox: [Mitte x, y, z, halbe Breite, halbe Höhe, halbe Länge] – grob als Kreis um die Wanne
      const R = hb ? Math.max(1.2, ((hb[3] || 1) + (hb[5] || 2)) * 0.5) : 2.2;
      for (const r of this._near(b.pos.x, b.pos.z, R + 1)) {
        if (r.broken) continue;
        if (this._dist(r, b.pos) > R * 0.85 + 0.2) continue;
        if (r.kind === 'blechkiste' && !(v.def && v.def.armored)) continue;
        this.breakRec(r, { dir: vel ? _v.set(vel.x, 0, vel.z).normalize().clone() : null });
      }
    }
  }

  dispose() {
    for (const f of this._off || []) f();
    this._off = [];
    if (this.mesh) { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh = null; }
    this._pieces = [];
    this._queue = [];
    this.active = false;
  }
}
