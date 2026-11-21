// NULLPUNKT — VR: Teleport-Fortbewegung (plattform, 19.11.; Einstellung vrLocomotion 'teleport'). Gegen Reiseübelkeit:
// keine Bewegung im Bild, nur ein kurzes Abblenden.
//   Stick der Nebenhand nach vorn halten → Bogen (Wurfparabel) aus der Nebenhand, Ziel-Ring auf dem Boden (grün = frei,
//   rot = nicht erreichbar); Stick loslassen → Abblenden, Körper ans Ziel, Aufblenden. Stick zur Seite/zurück im Zielen
//   bricht ab. Seitliches/Rückwärtslaufen per Stick bleibt möglich (nur „vorwärts“ zielt).
// Gültig: Boden (Normale steil nach oben), Kapsel passt hin, freie Sicht Brust → Ziel, Weite ≤ MAX_DIST waagerecht.
// Mehrspieler: Weite und Takt sind ans Lauftempo gebunden (Anti-Cheat des Hosts, net/anticheat.js: Einzelsprung ≤ 6 m,
// Budget = Gehen × Zeit) – nach jedem Sprung ruht der Teleport dist / TEMPO Sekunden.
// Bogen-Rechnung (traceArc) ist reine Logik und per Node prüfbar (scratchpad/plat/test-xr-teleport.mjs).

import * as THREE from 'three';
import { collisionRay } from '../physics.js?v=20261121041936';

export const MAX_DIST = 4.5; // m waagerecht
export const ARC_SPEED = 7.5; // m/s Abwurf des Bogens
export const ARC_G = 9.81;
export const TEMPO = 5.2; // m/s mittleres Höchsttempo (Gehen 5,4)
const STEP = 0.045; // s je Bogenstück
const MAX_T = 1.6;
const MIN_NY = 0.72; // Boden: Normale höchstens ≈ 44° geneigt
const AIM_IN = -0.6; // Stick y (vorn negativ)
const AIM_OUT = -0.3;
const SEG = Math.ceil(MAX_T / STEP) + 1;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _hit = {};

/**
 * Bogen aus origin in Richtung dir (normiert) gegen die Welt (rayFn(origin, dir, len) → { distance, ny } | null).
 * → { points: Vector3[], hit: Vector3 | null, ny, n } (n = benutzte Punkte).
 */
export function traceArc(origin, dir, rayFn, points, speed = ARC_SPEED, g = ARC_G) {
  const vx = dir.x * speed, vy = dir.y * speed, vz = dir.z * speed;
  let n = 0;
  points[n++].copy(origin);
  for (let i = 1; i < points.length; i++) {
    const t = i * STEP;
    _b.set(origin.x + vx * t, origin.y + vy * t - 0.5 * g * t * t, origin.z + vz * t);
    _a.copy(points[n - 1]);
    _d.subVectors(_b, _a);
    const len = _d.length();
    if (len > 1e-6) {
      _d.multiplyScalar(1 / len);
      const h = rayFn(_a, _d, len);
      if (h && h.distance <= len) {
        points[n++].copy(_a).addScaledVector(_d, h.distance);
        return { points, hit: points[n - 1], ny: h.ny, n };
      }
    }
    points[n++].copy(_b);
  }
  return { points, hit: null, ny: 0, n };
}

export class VrTeleport {
  constructor(xr) {
    this.xr = xr;
    this.G = xr.G;
    this.aiming = false;
    this.valid = false;
    this.target = new THREE.Vector3();
    this.cooldown = 0;
    this._fadeT = 0; // > 0: Abblenden läuft, danach Sprung
    this._pts = Array.from({ length: SEG }, () => new THREE.Vector3());
    this._line = null;
    this._ring = null;
    this.jumps = 0;
  }

  get enabled() { return this.G.settings.get('vrLocomotion') === 'teleport'; }

  _ensureMeshes() {
    if (this._line) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 3), 3));
    const lm = new THREE.LineBasicMaterial({ color: 0x8fe08a, transparent: true, opacity: 0.85, depthTest: true, fog: false });
    lm.toneMapped = false;
    this._line = new THREE.Line(geo, lm);
    this._line.name = 'xr-teleport-bogen';
    this._line.frustumCulled = false;
    this._line.visible = false;
    const rm = new THREE.MeshBasicMaterial({ color: 0x8fe08a, transparent: true, opacity: 0.8, depthWrite: false, fog: false, side: THREE.DoubleSide });
    rm.toneMapped = false;
    this._ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2), rm);
    this._ring.name = 'xr-teleport-ziel';
    this._ring.visible = false;
    this.xr.group.add(this._line, this._ring);
  }

  _rayFn() {
    const world = this.G.world;
    return (o, d, len) => {
      const r = world ? collisionRay(world, o, d, len, _hit) : null;
      return r ? { distance: r.distance, ny: r.ny } : null;
    };
  }

  /**
   * Je Bild (preUpdate, nach dem Stick): stickY der Nebenhand (vorn negativ). Nimmt beim Zielen die Laufbewegung aus
   * input.move (Vorwärts-Anteil). → true, solange gezielt wird.
   */
  update(dt, stickX, stickY) {
    const xr = this.xr;
    const G = this.G;
    const p = G.player;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this._fadeT > 0) {
      this._fadeT -= dt;
      if (this._fadeT <= 0) this._jump();
      if (G.input) { G.input.move.x = 0; G.input.move.y = 0; }
      return true;
    }
    const ok = this.enabled && p && p.alive && !p.vehicle && xr.ready && G.match && G.match.state === 'playing' && !(xr.menu && xr.menu.open);
    if (!ok) { this._stop(); return false; }
    if (!this.aiming && stickY < AIM_IN && Math.abs(stickX) < 0.6) this.aiming = true;
    if (!this.aiming) return false;
    if (G.input) { G.input.move.x = 0; G.input.move.y = 0; }
    if (Math.abs(stickX) > 0.75 && stickY > AIM_OUT) { this._stop(); return false; } // zur Seite weg: Abbruch
    this._aim();
    if (stickY > AIM_OUT) {
      // losgelassen
      if (this.valid && this.cooldown <= 0) this._begin();
      else if (this.valid) xr._pulse(xr.hands.off, 0.1, 10);
      this._stop();
    }
    return true;
  }

  _aim() {
    const xr = this.xr;
    const O = xr.hands.off;
    this._ensureMeshes();
    if (!O.rayW.ok) { this.valid = false; this._line.visible = this._ring.visible = false; return; }
    const res = traceArc(O.rayW.pos, O.rayW.dir, this._rayFn(), this._pts);
    const p = this.G.player;
    let valid = false;
    if (res.hit && res.ny >= MIN_NY && p) {
      const b = p.body.position;
      const dist = Math.hypot(res.hit.x - b.x, res.hit.z - b.z);
      valid = dist <= MAX_DIST && dist > 0.4 && Math.abs(res.hit.y - b.y) < 2.2 && this._clear(res.hit);
      this.target.copy(res.hit);
    }
    this.valid = valid;
    // Bogen + Ring
    const pos = this._line.geometry.attributes.position;
    for (let i = 0; i < res.n; i++) pos.setXYZ(i, res.points[i].x, res.points[i].y, res.points[i].z);
    pos.needsUpdate = true;
    this._line.geometry.setDrawRange(0, res.n);
    const col = valid ? 0x8fe08a : 0xff6b4f;
    this._line.material.color.setHex(col);
    this._ring.material.color.setHex(col);
    this._line.visible = true;
    this._ring.visible = !!res.hit;
    if (res.hit) this._ring.position.copy(res.hit).y += 0.02;
  }

  /** Kapsel passt ans Ziel, freie Sicht Brust → Ziel (+1 m). */
  _clear(t) {
    const G = this.G;
    const world = G.world;
    const p = G.player;
    if (!world || !p) return false;
    const from = _a.copy(p.body.position); from.y += 1.0;
    const to = _b.copy(t); to.y += 1.0;
    _d.subVectors(to, from);
    const len = _d.length();
    if (len > 1e-3) {
      _d.multiplyScalar(1 / len);
      const h = collisionRay(world, from, _d, len, _hit);
      if (h && h.distance < len - 0.25) return false;
    }
    // Kopffreiheit: senkrecht nach oben 1,7 m frei
    const up = collisionRay(world, _a.copy(t).setY(t.y + 0.15), _d.set(0, 1, 0), 1.55, _hit);
    return !up;
  }

  _begin() {
    const xr = this.xr;
    xr.overlay.fadeTo(1, 0.08);
    this._fadeT = 0.09;
    this._pending = this.target.clone();
    xr._pulse(xr.hands.off, 0.25, 15);
  }

  _jump() {
    const xr = this.xr;
    const p = this.G.player;
    const t = this._pending;
    this._pending = null;
    if (p && p.alive && t) {
      const b = p.body.position;
      const dist = Math.hypot(t.x - b.x, t.z - b.z);
      try { p.body.teleport(new THREE.Vector3(t.x, t.y + 0.02, t.z)); } catch { /* */ }
      this.cooldown = dist / TEMPO;
      this.jumps++;
      this.G.events.emit('xr:teleport', { distance: dist });
    }
    xr.overlay.fadeTo(0, 0.18);
  }

  _stop() {
    this.aiming = false;
    this.valid = false;
    if (this._line) { this._line.visible = false; this._ring.visible = false; }
  }

  reset() { this._stop(); this._fadeT = 0; this._pending = null; this.cooldown = 0; }

  dispose() {
    this.reset();
    if (this._line) {
      this._line.removeFromParent(); this._ring.removeFromParent();
      this._line.geometry.dispose(); this._line.material.dispose();
      this._ring.geometry.dispose(); this._ring.material.dispose();
      this._line = this._ring = null;
    }
  }
}
