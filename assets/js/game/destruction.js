// NULLPUNKT — Zerstörbare Fassaden (Wunschliste 10.10., „wie Battlefield“): ausgewählte Hauswände bestehen aus Paneelen
// (≈ 1,5 m, world/arch.js wall({ destructible })). Jedes Paneel ist ein eigenes Mesh und ein beweglicher Festkörper
// (Kollision/Kugeln über building.js addSolid). Explosionen (Granate, Rakete, Panzer, Luftschlag) und wiederholte
// schwere Treffer (MG, Präzisionsgewehr, Panzerbüchse) zermürben es; bei 0 bricht es heraus: Staubwolke, Brocken,
// Durchgang. Steht ein Paneel danach ohne Halt da (darunter und beidseitig nichts mehr), stürzt es nach.
// Jedes Gerät rechnet aus denselben Ereignissen ('explosion', Treffer) – reine Weltänderung, keine Netzbotschaft.
//
// zerstoerung 15.11. – gemeinsame Schnittstelle für alle Wirkungen (Panzersimulation, Granaten, Kleinwaffen):
//   G.destruction.impact({ point, normal, dir, type: 'bullet'|'ap'|'heat'|'he'|'charge', cal, energy, radius, weaponId,
//                          shooter, explode }) → { pass, keep, exit, breach, wall }
//   • 'ap' (Wucht), 'heat' (Hohlladung), 'he' (Spreng): Wand vor Ort (bullet-holes.js wallAt) → Bresche über
//     vehicles/breach.js (Host/Einzelspiel entscheidet, Form geht als 'ev' br an alle). Wucht stanzt und fliegt mit
//     Restenergie weiter (pass/keep/exit), Hohlladung stanzt einen engen Kanal mit weitem Ausbruch hinten, Spreng reißt
//     eine zerfetzte Bresche. explode: true zündet zusätzlich die Explosion (Druck/Splitter auf Wände, Requisiten, Menschen).
//   • 'bullet': Einschuss mit Kaliber/Werkstoff (bullet-holes.js hit) – gleicher Weg wie combat.fireHitscan.
//   • 'charge': Sprengladung (C4) an der Fläche: Explosion Typ 'c4' (bullet-holes.js blast reißt die Wand auf).
// Durchbrüche, durch die ein Mensch passt, bekommen Navigationskanten (Bots laufen hindurch, _navLink), Kisten/Paletten/
// Zaunfelder zerbrechen (breakables.js).
import * as THREE from 'three';
import { worldPartsFrom } from './building.js?v=20261122020853';
import { Capsule } from 'three/addons/math/Capsule.js';
import { Breakables } from './breakables.js?v=20261122020853';
import { WEAPONS } from '../shared/weapons.data.js?v=20261122020853';

const HP = { concrete: 380, plaster: 260, tile: 300, wood: 160, metal: 300 };
const _n = new THREE.Vector3();
const _c = new THREE.Vector3();

export class Destruction {
  constructor(G) {
    this.G = G;
    this.panels = [];
    this.broken = 0;
    this._queue = [];
    const list = (G.world && G.world.destructibles) || [];
    const byKey = new Map();
    for (const d of list) {
      const surface = (d.mesh && d.mesh.userData.surface) || 'concrete';
      const part = worldPartsFrom([[0, d.h / 2, 0, d.w / 2, d.h / 2, d.d / 2, 0]], d.x, d.y, d.z, d.ry)[0];
      const p = { d, hp: HP[surface] ?? 300, max: HP[surface] ?? 300, surface, alive: true, solid: null, center: new THREE.Vector3(d.x, d.y + d.h / 2, d.z) };
      p.solid = { id: `wand${d.id}`, def: { surface }, mesh: d.mesh, parts: [part], onHit: (dmg, by, def) => this._bullet(p, dmg, def) };
      if (G.building) G.building.addSolid(p.solid);
      byKey.set(`${d.wall}|${d.col}|${d.row}`, p);
      this.panels.push(p);
    }
    // Nachbarn für den Einsturz (gleiche Wand: darunter, links, rechts)
    for (const p of this.panels) {
      const { wall, col, row } = p.d;
      p.below = [...byKey.values()].find((q) => q.d.wall === wall && q.d.col === col && q.d.row < row && Math.abs(q.d.y + q.d.h - p.d.y) < 0.05) || null;
      p.side = [...byKey.values()].filter((q) => q !== p && q.d.wall === wall && q.d.row === row && Math.abs(Math.hypot(q.d.x - p.d.x, q.d.z - p.d.z) - (p.d.w + q.d.w) / 2) < 0.05);
    }
    this._off = this.panels.length ? [G.events.on('explosion', (e) => this._explosion(e))] : [];
    // Breschen/Paneele → Navigationskanten; zerbrechliche Requisiten
    this._navDone = new Set();
    this._navQ = [];
    this._off.push(G.events.on('wall:breach', (e) => this._navQ.push({ p: e.position, id: e.id, at: (G.time ? G.time.elapsed : 0) + 0.3 })));
    this._off.push(G.events.on('wall:break', (e) => this._navQ.push({ p: e.position, id: null, at: (G.time ? G.time.elapsed : 0) + 0.4 })));
    this._off.push(G.events.on('wall:cut', (e) => this._navQ.push({ p: e.position, id: null, at: (G.time ? G.time.elapsed : 0) + 0.3 })));
    try { this.breakables = new Breakables(G); } catch (err) { console.warn('[destruction] Requisiten:', err); this.breakables = null; }
  }

  // --- gemeinsame Schnittstelle --------------------------------------------------------------------------------

  /**
   * Wirkung an einer Fläche (siehe Kopf). Sucht die Fläche selbst, wenn nur point/dir gegeben sind.
   * @returns {{ pass: boolean, keep?: number, exit?: THREE.Vector3, breach: boolean, wall: object|null }}
   */
  impact(o = {}) {
    const G = this.G, W = G.world, H = G.holes;
    const out = { pass: false, breach: false, wall: null };
    if (!o.point || !W || typeof W.raycast !== 'function') return out;
    const type = o.type || 'bullet';
    const dir = (o.dir ? o.dir.clone() : o.normal ? o.normal.clone().negate() : new THREE.Vector3(0, 0, -1)).normalize();
    // Fläche: 0,4 m vor dem Punkt entlang der Flugrichtung
    const from = o.point.clone().addScaledVector(dir, -0.4);
    const hit = W.raycast(from, dir, 1.2);
    if (type === 'bullet') {
      if (!hit || !H) return out;
      const def = o.weapon || (o.weaponId && WEAPONS[o.weaponId]) || { id: o.weaponId || null, caliber: o.caliber || '5.56', damage: { max: 25, min: 20 } };
      const info = H.hit(hit, def, dir, o.distance || 20, o.energy ?? 1);
      G.events.emit('impact', { point: hit.point.clone(), normal: hit.normal.clone(), surface: hit.surface || 'concrete', shooter: o.shooter || null, weaponId: def.id, penetrated: !!(info && info.passed), hole: true, dir: dir.clone() });
      if (info && info.passed && info.exitPoint) { out.pass = true; out.keep = info.energyLeft; out.exit = info.exitPoint.clone(); }
      return out;
    }
    if (type === 'charge') {
      const at = (hit ? hit.point : o.point).clone().addScaledVector(hit ? hit.normal : dir.clone().negate(), 0.12);
      if (G.combat) G.combat.explode({ position: at, radius: o.radius || 7, maxDamage: o.maxDamage || 220, attacker: o.shooter || null, weaponId: o.weaponId || 'c4', type: 'c4' });
      out.breach = true;
      return out;
    }
    const cal = o.cal || (o.energy ? Math.max(20, Math.min(155, Math.sqrt(o.energy) * 1.6)) : 120);
    const B = G.vehicles && G.vehicles.breaching;
    if (hit && B && typeof B.shell === 'function' && !hit.actor && !hit.vehicle) {
      const def = { id: o.weaponId || null, name: `${cal} mm`, cal, penetrating: type === 'ap', heat: type === 'heat', psim: o.psim || null };
      const shell = { def, shooter: o.shooter || null, pen: o.pen ?? null, walls: o.walls | 0 };
      const n0 = H && H._sync ? H._sync.size : 0;
      let r = null;
      try { r = B.shell(shell, hit, dir); } catch (err) { console.warn('[destruction] impact:', err); }
      out.breach = !!(H && H._sync && H._sync.size !== n0) || !!(r && r.pass);
      if (r && r.pass) { out.pass = true; out.keep = r.keep; out.exit = r.exit; }
    }
    if (o.explode && G.combat) {
      const at = (hit ? hit.point : o.point).clone().addScaledVector(hit ? hit.normal : dir.clone().negate(), 0.25);
      G.combat.explode({ position: at, radius: o.radius || (type === 'he' ? 9 : type === 'heat' ? 5 : 2.5), maxDamage: o.maxDamage || 180, attacker: o.shooter || null, weaponId: o.weaponId || null, type: type === 'ap' ? 'shell_ap' : type === 'heat' ? 'shell_heat' : 'shell_he' });
    }
    return out;
  }

  // --- Navigation durch Durchbrüche ------------------------------------------------------------------------------

  /**
   * Bresche/Paneel bei p offen: passt ein Mensch hindurch (Boden ≤ Stufenhöhe, ≥ 1,5 m hoch, ≥ 0,75 m breit), werden
   * die nächsten Navigationsknoten beidseits der Wand verbunden – Bots laufen dann hindurch. Der Graph bleibt sonst
   * unverändert (aus dem Bau); Kanten sind reine Pfadkosten, die Bewegung prüft die echte Kollision (Ausschnitte).
   */
  _navLink(p) {
    const G = this.G, W = G.world, nav = W && W.nav;
    if (!nav || typeof nav.nodesInRadius !== 'function' || !W.collider || typeof W.collider.capsuleIntersect !== 'function') return false;
    const key = `${Math.round(p.x * 2)}|${Math.round(p.z * 2)}`;
    if (this._navDone.has(key)) return false;
    // Wandnormale: waagerechte Strahlen rundum, kürzester Treffer
    let n = null, best = 9;
    const o = new THREE.Vector3(p.x, p.y, p.z), d = new THREE.Vector3();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      d.set(Math.cos(a), 0, Math.sin(a));
      const f = W.raycast(o.clone().addScaledVector(d, -2), d, 4);
      if (f && !f.actor && Math.abs(f.normal.y) < 0.3 && Math.abs(f.distance - 2) < best) { best = Math.abs(f.distance - 2); n = f.normal.clone().setY(0).normalize(); }
    }
    if (!n) n = new THREE.Vector3(1, 0, 0);
    const gy = W.groundHeight ? W.groundHeight(p.x + n.x * 0.8, p.z + n.z * 0.8, p.y + 0.5) : null;
    if (gy == null) return false;
    // Kapsel (0,35 m) durch die Öffnung: Mitte der Öffnung auf Bodenhöhe, drei Schritte quer durch die Wand
    let fits = 0;
    for (const s of [-0.7, 0, 0.7]) {
      const c = new THREE.Vector3(p.x - n.x * s, gy, p.z - n.z * s);
      const cap = new Capsule(new THREE.Vector3(c.x, gy + 0.35 + 0.42, c.z), new THREE.Vector3(c.x, gy + 1.45, c.z), 0.3);
      const hit = W.collider.capsuleIntersect(cap);
      if (!hit || hit.depth < 0.03) fits++;
    }
    if (fits < 3) return false;
    // Knoten beidseits: vorn (n) und hinten (−n), höchstens 3,5 m von der Öffnung, ungefähr Bodenhöhe
    const cand = nav.nodesInRadius(new THREE.Vector3(p.x, gy, p.z), 3.5).filter((q) => Math.abs(q.position.y - gy) < 0.7);
    const side = (q) => (q.position.x - p.x) * n.x + (q.position.z - p.z) * n.z;
    const A = cand.filter((q) => side(q) > 0.4), B = cand.filter((q) => side(q) < -0.4);
    if (!A.length || !B.length) return false;
    this._navDone.add(key);
    const a = A[0], b = B[0];
    const link = (x, y) => { if (!Array.isArray(x.links)) x.links = Array.from(x.links || []); if (!x.links.includes(y.id)) x.links.push(y.id); };
    link(a, b); link(b, a);
    if (A[1] && B[1]) { link(A[1], B[0]); link(B[0], A[1]); link(B[1], A[0]); link(A[0], B[1]); }
    G.events.emit('nav:link', { position: new THREE.Vector3(p.x, gy, p.z), a: a.id, b: b.id });
    return true;
  }

  _explosion(e) {
    if (!e || e.nonLethal || !e.position) return;
    const r = (e.radius || 6) + 0.8;
    // schwere Ladungen: Luftschlag, Panzergranaten (SG/PG, vehicles/projectiles.js) brechen Paneele schneller heraus
    const heavy = e.type === 'strike' || e.type === 'tank' || e.type === 'shell_he' || e.type === 'shell_ap';
    const power = 170 * Math.min(2.2, Math.max(e.type === 'shell_ap' ? 1 : 0, (e.radius || 6) / 5.5)) * (heavy ? 1.6 : 1);
    for (const p of this.panels) {
      if (!p.alive) continue;
      // Abstand zur Paneelfläche (nicht zur Mitte): Box-Nächstpunkt
      const box = p.solid.parts[0].box;
      box.clampPoint(e.position, _c);
      const d = _c.distanceTo(e.position);
      if (d > r) continue;
      this._damage(p, power * (1 - d / r) * (d < 1.2 ? 1.5 : 1));
    }
  }

  _bullet(p, dmg, def) {
    if (!p.alive || !def) return;
    const k = def.antiMateriel ? 3 : (def.penetration || 0) >= 0.75 ? 0.5 : 0.12;
    this._damage(p, dmg * k);
  }

  _damage(p, amount) {
    if (!p.alive || !(amount > 0)) return;
    p.hp -= amount;
    if (p.hp <= 0) this._break(p);
  }

  _break(p, chain = false) {
    if (!p.alive) return;
    p.alive = false;
    this.broken++;
    const G = this.G;
    if (G.building) G.building.removeSolid(p.solid);
    if (p.d.mesh) p.d.mesh.visible = false; // Geometrie gibt die Welt beim Abbau frei
    _n.set(Math.sin(p.d.ry), 0, Math.cos(p.d.ry)); // Wandnormale (lokal z)
    if (G.effects && typeof G.effects.rubble === 'function') G.effects.rubble(p.center, _n, p.surface, Math.max(p.d.w, p.d.h));
    if (G.audio && typeof G.audio.play === 'function') { try { G.audio.play('debris', { position: p.center, volume: chain ? 0.6 : 1 }); } catch { /* */ } }
    G.events.emit('wall:break', { position: p.center.clone(), surface: p.surface, chain });
    // ohne Halt: Paneele darüber stürzen kurz danach nach
    for (const q of this.panels) if (q.alive && q.below === p) this._queue.push({ p: q, at: G.time.elapsed + 0.25 + Math.random() * 0.2 });
  }

  update(dt = 0) {
    if (this.breakables) this.breakables.update(dt);
    if (this._navQ.length) {
      const now = this.G.time ? this.G.time.elapsed : 0;
      for (let i = this._navQ.length - 1; i >= 0; i--) {
        if (now < this._navQ[i].at) continue;
        const q = this._navQ.splice(i, 1)[0];
        try { this._navLink(q.p); } catch { /* Navigation ist Beiwerk */ }
      }
    }
    if (!this._queue.length) return;
    const now = this.G.time.elapsed;
    for (let i = this._queue.length - 1; i >= 0; i--) {
      const { p, at } = this._queue[i];
      if (now < at) continue;
      this._queue.splice(i, 1);
      if (!p.alive) continue;
      const held = p.side.some((q) => q.alive && q.below && q.below.alive);
      if (!held) this._break(p, true);
    }
  }

  dispose() {
    if (this.breakables) { this.breakables.dispose(); this.breakables = null; }
    for (const f of this._off) f();
    this._off = [];
    if (this.G.building) for (const p of this.panels) this.G.building.removeSolid(p.solid);
    this.panels = [];
    this._queue = [];
  }
}
