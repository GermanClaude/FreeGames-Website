// NULLPUNKT — Battle Royale: Beute auf der Karte (Punkte aus dem Navigationsgraph, Gegenstände als einfache Modelle).
//
// Beutepunkte: zufällige Knoten des Navigationsgraphs (also erreichbar), bevorzugt unter Dach (Gebäude: Strahl nach oben trifft
// eine Decke und mindestens zwei Wände in der Nähe), Mindestabstand 5 m. Jeder Punkt bekommt 1–3 Gegenstände (items.js
// rollSpot); einige besonders abgeschiedene Innenpunkte tragen die seltenen BR-Waffen (shared/weapons-br.data.js).
// Darstellung: Waffen als Drittpersonen-Modell (weapons/models.js, lod 'third'), alles andere als schlichte Kästen/Formen mit
// eigenen, texturlosen Materialien (1–2 Sampler). Sichtbar nur im Umkreis von 42 m um die Kamera (alle 0,3 s geprüft).
// Die Kartendateien bleiben unberührt: hier wird nur ausgelesen (world.nav, world.raycast, world.groundHeight).
import * as THREE from 'three';
import { rollSpot, weaponPool, itemName } from './items.js?v=20261123073102';

const SHOW_R = 42;
const SPACING = 5;
const _up = new THREE.Vector3(0, 1, 0);
const _dirs = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
const _o = new THREE.Vector3(), _cam = new THREE.Vector3();

let SH = null;
function shared() {
  if (SH) return SH;
  const m = (color, rough = 0.8, metal = 0.05) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  SH = {
    ammo: new THREE.BoxGeometry(0.26, 0.12, 0.14),
    lid: new THREE.BoxGeometry(0.27, 0.02, 0.15),
    vest: new THREE.BoxGeometry(0.38, 0.07, 0.44),
    plateG: new THREE.BoxGeometry(0.25, 0.022, 0.31),
    helmet: new THREE.SphereGeometry(0.13, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
    band: new THREE.BoxGeometry(0.11, 0.05, 0.08),
    bag: new THREE.BoxGeometry(0.26, 0.15, 0.13),
    gren: new THREE.CylinderGeometry(0.03, 0.032, 0.09, 10),
    mats: {
      ammo: m(0x4a5036, 0.7, 0.3), schrot: m(0x5d3424, 0.7, 0.2), schwer: m(0x3b3d35, 0.6, 0.4), lid: m(0x2c2e27, 0.6, 0.5),
      leicht: m(0x5a5c4c, 0.92), mittel: m(0x3f4632, 0.92), schwer2: m(0x2a2d27, 0.9), plate: m(0x34363a, 0.6, 0.2),
      helmet: m(0x3f4630, 0.75, 0.1), helmetS: m(0x2c2f2a, 0.65, 0.15), band: m(0xcfc8b6, 0.95), bag: m(0x55603f, 0.92),
      frag: m(0x3c4231, 0.6, 0.3), smoke: m(0x6d7066, 0.6, 0.3),
    },
  };
  return SH;
}

/** Zufallszahlen mit Startwert (mulberry32). */
export function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

let nextId = 1;

export class LootField {
  constructor(G, { rng = Math.random, WEAPONS } = {}) {
    this.G = G;
    this.rng = rng;
    this.W = WEAPONS;
    this.items = [];
    this.spots = [];
    this.group = new THREE.Group();
    this.group.name = 'br:beute';
    this._t = 0;
    this.stats = { spots: 0, indoor: 0, items: 0, rare: 0, ms: 0 };
    if (G.scene) G.scene.add(this.group);
  }

  /** Ist (x, y, z) unter Dach und zwischen Wänden? (Strahl nach oben ≤ 9 m, ≥ 2 Wände ≤ 7 m) */
  _indoor(w, p) {
    _o.set(p.x, p.y + 0.9, p.z);
    const up = w.raycast(_o, _up, 9);
    if (!up) return false;
    let walls = 0;
    for (const d of _dirs) if (w.raycast(_o, d, 7)) walls++;
    return walls >= 2;
  }

  /**
   * Beutepunkte setzen und füllen. players = Teilnehmerzahl (Menge), rare = BR-Sonderwaffen-Ids, ids = gewöhnliche Waffen.
   * → stats
   */
  build({ players = 40, rare = [], ids = null } = {}) {
    const G = this.G, w = G.world, t0 = performance.now();
    const nav = w && w.nav;
    if (!nav || !nav.nodes || !nav.nodes.length || typeof w.raycast !== 'function') return this.stats;
    const b = w.bounds;
    const nodes = nav.nodes;
    const want = Math.min(360, Math.max(70, Math.round(players * 4.2)));
    const tests = Math.min(nodes.length, 3600);
    const cand = [];
    for (let i = 0; i < tests; i++) {
      const n = nodes[(this.rng() * nodes.length) | 0];
      const p = n.position;
      if (b && (p.x < b.min.x + 4 || p.x > b.max.x - 4 || p.z < b.min.z + 4 || p.z > b.max.z - 4)) continue;
      cand.push({ p, indoor: this._indoor(w, p), cover: !!n.cover });
    }
    // drinnen zuerst (dichter), dann Deckungsplätze draußen, dann der Rest
    cand.sort((a, c) => (c.indoor - a.indoor) || (c.cover - a.cover));
    const grid = new Map();
    const key = (x, z) => `${Math.floor(x / SPACING)},${Math.floor(z / SPACING)}`;
    const free = (p) => {
      const gx = Math.floor(p.x / SPACING), gz = Math.floor(p.z / SPACING);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const l = grid.get(`${gx + dx},${gz + dz}`);
        if (l && l.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < SPACING && Math.abs(q.y - p.y) < 2.5)) return false;
      }
      return true;
    };
    const outdoorMax = Math.round(want * 0.35);
    let outdoor = 0;
    for (const c of cand) {
      if (this.spots.length >= want) break;
      if (!c.indoor && outdoor >= outdoorMax) continue;
      if (!free(c.p)) continue;
      const k = key(c.p.x, c.p.z);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(c.p);
      if (!c.indoor) outdoor++;
      this.spots.push({ position: c.p.clone(), indoor: c.indoor });
    }
    // Gegenstände
    const pool = weaponPool(this.W, ids);
    for (const s of this.spots) {
      for (const it of rollSpot(this.rng, pool, this.W, { indoor: s.indoor })) this.spawn(it, s.position, 0.55);
    }
    // seltene Waffen: abgeschiedene Innenpunkte, möglichst weit voneinander
    const inner = this.spots.filter((s) => s.indoor);
    const chosen = [];
    for (const id of rare) {
      let best = null, bd = -1;
      for (let k = 0; k < 24 && inner.length; k++) {
        const s = inner[(this.rng() * inner.length) | 0];
        const d = chosen.length ? Math.min(...chosen.map((c) => Math.hypot(c.x - s.position.x, c.z - s.position.z))) : 1e6;
        if (d > bd) { bd = d; best = s; }
      }
      const s = best || this.spots[(this.rng() * this.spots.length) | 0];
      if (!s || !this.W[id]) continue;
      chosen.push(s.position);
      this.spawn({ kind: 'weapon', key: id, amount: this.W[id].mag, rare: true }, s.position, 0.3);
      this.stats.rare++;
    }
    this.stats.spots = this.spots.length;
    this.stats.indoor = inner.length;
    this.stats.items = this.items.length;
    this.stats.ms = Math.round(performance.now() - t0);
    return this.stats;
  }

  /** Gegenstand an pos (± scatter m) ablegen. → Eintrag */
  spawn(it, pos, scatter = 0) {
    const G = this.G;
    const p = pos.clone();
    if (scatter > 0) {
      const a = this.rng() * Math.PI * 2, r = scatter * (0.4 + 0.6 * this.rng());
      p.x += Math.cos(a) * r; p.z += Math.sin(a) * r;
      const w = G.world;
      const y = w && typeof w.groundHeight === 'function' ? w.groundHeight(p.x, p.z, pos.y + 1.2) : null;
      p.y = y != null && Math.abs(y - pos.y) < 1.2 ? y : pos.y;
    }
    const e = { id: nextId++, kind: it.kind, key: it.key, amount: it.amount | 0, rare: !!it.rare || !!(this.W[it.key] && this.W[it.key].brOnly), position: p, yaw: this.rng() * Math.PI * 2, mesh: null, taken: false, claim: null, claimUntil: 0 };
    this.items.push(e);
    return e;
  }

  /** Mehrere Gegenstände rund um pos verteilen (Ausrüstung eines Gefallenen). */
  scatter(list, pos) {
    const out = [];
    list.forEach((it, i) => {
      const a = (i / Math.max(1, list.length)) * Math.PI * 2 + this.rng() * 0.6;
      const q = pos.clone();
      q.x += Math.cos(a) * (0.5 + 0.35 * (i % 2)); q.z += Math.sin(a) * (0.5 + 0.35 * (i % 2));
      out.push(this.spawn(it, q, 0.15));
    });
    return out;
  }

  name(e) { return itemName(e, this.W); }

  /** Nächster freier Gegenstand im Umkreis r (waagerecht, |Δy| < 1.6) mit Filter. → Eintrag | null */
  nearest(pos, r, filter = null) {
    let best = null, bd = r;
    for (const e of this.items) {
      if (e.taken) continue;
      const d = Math.hypot(e.position.x - pos.x, e.position.z - pos.z);
      if (d >= bd || Math.abs(e.position.y - pos.y) > 1.6) continue;
      if (filter && !filter(e, d)) continue;
      bd = d; best = e;
    }
    return best;
  }

  /** Gegenstand vom Boden nehmen (Modell weg). */
  take(e) {
    if (!e || e.taken) return false;
    e.taken = true;
    if (e.mesh) { e.mesh.removeFromParent(); e.mesh = null; }
    const i = this.items.indexOf(e);
    if (i >= 0) this.items.splice(i, 1);
    return true;
  }

  _mesh(e) {
    const S = shared();
    const M = S.mats;
    let m = null;
    if (e.kind === 'weapon' || e.kind === 'grenade') {
      const models = this.G.modules && this.G.modules.models;
      const key = e.kind === 'grenade' ? e.key : (this.W[e.key] && this.W[e.key].model) || e.key;
      try { if (models && models.createWeaponModel) m = models.createWeaponModel(key, { lod: 'third' }); } catch { m = null; }
      if (m && e.kind === 'weapon') { m.rotation.set(0, 0, Math.PI / 2); const g = new THREE.Group(); g.add(m); m.position.y = 0.035; m = g; }
      if (!m && e.kind === 'grenade') m = new THREE.Mesh(S.gren, e.key === 'smoke' ? M.smoke : M.frag);
    }
    if (!m) {
      const g = new THREE.Group();
      if (e.kind === 'ammo') {
        const body = new THREE.Mesh(S.ammo, e.key === 'schrot' ? M.schrot : e.key === 'schwer' || e.key === 'granate' ? M.schwer : M.ammo);
        body.position.y = 0.06;
        const lid = new THREE.Mesh(S.lid, M.lid);
        lid.position.y = 0.125;
        g.add(body, lid);
      } else if (e.kind === 'vest') {
        const v = new THREE.Mesh(S.vest, e.key === 'schwer' ? M.schwer2 : e.key === 'mittel' ? M.mittel : M.leicht);
        v.position.y = 0.035;
        g.add(v);
      } else if (e.kind === 'helmet') {
        const h = new THREE.Mesh(S.helmet, e.key === 'schwer' ? M.helmetS : M.helmet);
        h.scale.set(1, 0.85, 1.12);
        g.add(h);
      } else if (e.kind === 'bandage') {
        const h = new THREE.Mesh(e.key === 'tasche' ? S.bag : S.band, e.key === 'tasche' ? M.bag : M.band);
        h.position.y = e.key === 'tasche' ? 0.075 : 0.025;
        g.add(h);
      } else if (e.kind === 'plate') {
        const h = new THREE.Mesh(S.plateG, M.plate);
        h.position.y = 0.011;
        g.add(h);
      } else if (e.kind === 'grenade') {
        const h = new THREE.Mesh(S.gren, e.key === 'smoke' ? M.smoke : M.frag);
        h.rotation.z = Math.PI / 2; h.position.y = 0.03;
        g.add(h);
      }
      m = g;
    }
    m.position.add(e.position);
    m.rotation.y = e.yaw;
    m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    m.userData.brItem = e.id;
    return m;
  }

  /** Sichtbarkeit nach Kameraabstand (alle 0,3 s). */
  update(dt) {
    this._t -= dt;
    if (this._t > 0) return;
    this._t = 0.3;
    const cam = this.G.camera;
    if (!cam) return;
    cam.getWorldPosition(_cam);
    let made = 0;
    for (const e of this.items) {
      const d = Math.hypot(e.position.x - _cam.x, e.position.z - _cam.z);
      const show = d < SHOW_R && Math.abs(e.position.y - _cam.y) < 40;
      if (show && !e.mesh) {
        if (made >= 6) continue; // je Durchgang höchstens 6 neue Modelle (kein Ruckeln beim Landen)
        e.mesh = this._mesh(e);
        this.group.add(e.mesh);
        made++;
      }
      if (e.mesh) e.mesh.visible = show;
    }
  }

  /** Aufwärmobjekte (eine Kiste je Material) für den Kompilierdurchgang. */
  warmObjects() {
    const S = shared();
    return Object.values(S.mats).map((m) => new THREE.Mesh(S.band, m));
  }

  dispose() {
    for (const e of this.items) if (e.mesh) e.mesh.removeFromParent();
    this.items.length = 0;
    this.spots.length = 0;
    this.group.removeFromParent();
  }
}
