// NULLPUNKT — Massenschlacht (masse): Budget-/Scheduler-/Impostor-System für große Bot-Zahlen (100 … 500 Akteure).
//
// Drei Bausteine, die der BotManager je Bild benutzt (nur kleine Hooks in manager.js / bot.js / physics.js):
//
//  • ActorGrid – räumliches Raster (8-m-Zellen) aller lebenden Akteure, einmal je Bild neu gefüllt. Ersetzt die
//    O(N²)-Schleifen (Ausweichen der Bots, weiche Trennung, Spawn-Belegung) durch Nachbarschaftsabfragen.
//
//  • CrowdImpostors – ferne Soldaten als instanzierte Silhouetten: 5 Posen (Stehen, Laufen A/B, Hocken, Liegen) mit je
//    EINEM InstancedMesh (≈ 300 Dreiecke, Teamfarbe je Instanz). Ein voller Soldat kostet 1 SkinnedMesh (Knochentextur je
//    Bild) + 2–4 Draw Calls Waffe + Animation; als Impostor nur eine Matrix. Wer Impostor wird, entscheidet ein Budget:
//    die nächsten FULL_BUDGET sichtbaren Soldaten bleiben voll, weitere ab IMP_MIN m werden Silhouetten, jenseits von
//    IMP_FAR m immer. Zielfernrohr (kleines FOV) holt die vollen Modelle zurück (Abstand × FOV/60).
//
//  • crowdScale(n) – Skalierung des Simulationstakts: ab ~64 lebenden Bots werden die Abstandsschwellen der
//    Simulations-Detailstufen (manager SIM_LOD) enger und die volle Rate auf die nächsten Bots begrenzt.
//
// Weitere Hooks: Hören (manager._hear/_onImpact) und Ausweichen (bot._separation) über ActorGrid, weiche Trennung
// (engine/physics.separateActors) als Sweep nach x, Spawns verteilt (spreadSpawn), Namensschilder ohne Kopfposition, wenn
// unsichtbar. Grenzen der Teamgröße: shared/modes.data.js (limitsFor, MASS_SIDE).
//
// Prüfhilfe: G.bots.crowd.stats() → { impostors, full, capacity, drawCalls }; G.bots.massOpt = false schaltet alles hier
// ab (A/B-Messung im selben Match); G.prof = {} bzw. G.bots._botProf = {} sammeln CPU-Zeiten (main.step, Bot-Abschnitte).
//
// Messung (14.11., Grenzland, Prüfstand A/B im selben Match, Bot-Stufe „hoch“, Median der Simulations-CPU-Zeit je Bild ohne
// Rendern, 4-Kern-VM unter starker Fremdlast → absolute Zahlen ≈ 3× zu hoch, Verhältnisse belastbar):
//   Akteure   vorher → nachher   Bot-Schritte/Bild   Animationen/Bild   Sichtstrahlen/Bild
//     24        2,4 →  2,5 ms        –                  –                  –        (bis 64 Bots unverändert)
//    100       15,1 → 18,1 ms*     79 → 64            27 → 19            101 → 98
//    250       45,9 → 22,3 ms     211 → 115           81 → 27            144 → 96
//    500       90,3 → 53,4 ms     376 → 210          121 → 42            144 → 96
//   1000       Absturz (Speicher, ≈ 2 MB je Bot) bzw. vorher 314 ms/Bild → nicht freigegeben
//   (* Rauschen; bei 100 greift nur die leichte Skalierung.) Draw Calls: Silhouetten 1–5 statt ≈ 4 je ferner Soldat.
import * as THREE from 'three';
import { SCHEMES } from './soldier/materials.js?v=20261119182451';

/* ============================================================== Raster */

const KEY = (i, j) => (i + 4096) * 8192 + (j + 4096);

export class ActorGrid {
  /** cell = Zellgröße in m (8: Ausweichen/Spawns; 32: Wahrnehmung auf 50–130 m). */
  constructor(cell = 8) {
    this.cell = cell;
    this.cells = new Map();
    this._pool = [];
    this.frame = -1;
    this.reserved = []; // x, y, z je reservierten Spawnpunkt (dieses Bild)
  }

  /** Raster neu füllen (lebende Akteure mit Körper). */
  rebuild(actors, frame) {
    this.frame = frame;
    this.reserved.length = 0;
    for (const list of this.cells.values()) { list.length = 0; this._pool.push(list); }
    this.cells.clear();
    for (let n = 0; n < actors.length; n++) {
      const a = actors[n];
      if (!a || !a.alive || !a.position) continue;
      const k = KEY(Math.floor(a.position.x / this.cell), Math.floor(a.position.z / this.cell));
      let list = this.cells.get(k);
      if (!list) { list = this._pool.pop() || []; this.cells.set(k, list); }
      list.push(a);
    }
  }

  /** Punkt für den Rest des Bildes belegen (Spawn im selben Bild – der Akteur steht noch nicht dort). */
  reserve(p) {
    if (this.reserved.length < 3072) this.reserved.push(p.x, p.y, p.z);
  }

  /** Alle Akteure in Zellen, die den Kreis (x, z, r) berühren, an fn(actor) (ohne Abstandsprüfung). */
  each(x, z, r, fn) {
    const CELL = this.cell;
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const list = this.cells.get(KEY(i, j));
      if (list) for (let k = 0; k < list.length; k++) fn(list[k]);
    }
  }

  /** Gibt es einen lebenden Akteur (außer `except`) näher als r an p? */
  occupied(p, r, except = null) {
    const r2 = r * r;
    const R = this.reserved;
    for (let k = 0; k < R.length; k += 3) { const dx = R[k] - p.x, dz = R[k + 2] - p.z; if (dx * dx + dz * dz < r2 && Math.abs(R[k + 1] - p.y) < 2) return true; }
    const CELL = this.cell;
    const i0 = Math.floor((p.x - r) / CELL), i1 = Math.floor((p.x + r) / CELL);
    const j0 = Math.floor((p.z - r) / CELL), j1 = Math.floor((p.z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const list = this.cells.get(KEY(i, j));
      if (!list) continue;
      for (let k = 0; k < list.length; k++) {
        const a = list[k];
        if (a === except || !a.alive) continue;
        const dx = a.position.x - p.x, dz = a.position.z - p.z;
        if (dx * dx + dz * dz < r2 && Math.abs(a.position.y - p.y) < 2) return true;
      }
    }
    return false;
  }
}

/* ============================================================== Skalierung */

/** Volle Soldaten (nächste sichtbare) je Grafikstufe; der Rest ab IMP_MIN m als Silhouette. */
export const FULL_BUDGET = Object.freeze({ low: 14, medium: 28, high: 44, ultra: 60, extrem: 96 }); // extrem: Desktop-App
/** Ab hier (m × FOV/60) darf ein Soldat Silhouette werden (low früher: kleiner Bildschirm, schwache GPU). */
export const IMP_MIN = Object.freeze({ low: 34, medium: 50, high: 60, ultra: 70, extrem: 90 });
/** Jenseits davon immer Silhouette (≈ 8–10 Pixel hoch in 1080p) – auch in kleinen Matches. */
export const IMP_FAR = Object.freeze({ low: 110, medium: 150, high: 180, ultra: 220, extrem: 300 });

/**
 * Simulations-Skalierung nach Anzahl lebender KI-Bots: `dist` < 1 zieht die Abstandsschwellen der Simulations-Detailstufen
 * an die Kamera heran, `anim` die der Animationsrate, `deep` erlaubt die Stufe „sehr fern, selten“ (manager SIM_LOD[4]).
 * Bis 64 Bots unverändert (Verhalten der bisherigen Matches).
 */
export function crowdScale(n) {
  if (n <= 64) return { dist: 1, anim: 1, deep: false };
  if (n <= 120) return { dist: 0.75, anim: 1, deep: false };
  if (n <= 260) return { dist: 0.55, anim: 0.75, deep: true };
  return { dist: 0.4, anim: 0.6, deep: true };
}

/* ============================================================== Silhouetten */

const POSES = ['stand', 'runA', 'runB', 'crouch', 'prone'];
// Vertex-Farben je Teil (× Teamfarbe der Instanz): Uniform ≈ 1, Ausrüstung dunkler, Haut heller/wärmer
// (gemessen am Bild: volle Soldaten wirken durch Schattierung/Tarnmuster deutlich dunkler als die Grundfarbe)
const C_UNI = [0.95, 0.95, 0.92], C_PANTS = [0.86, 0.86, 0.82], C_GEAR = [0.62, 0.62, 0.58], C_SKIN = [1.5, 1.15, 0.92], C_GUN = [0.28, 0.28, 0.3], C_BOOT = [0.46, 0.43, 0.38];

/** Geometrie (nicht indiziert) mit Farbe in die Sammelpuffer übernehmen. */
function put(out, g, col) {
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    out.p.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    out.n.push(nor.getX(i), nor.getY(i), nor.getZ(i));
    out.c.push(col[0], col[1], col[2]);
  }
  g.dispose();
}

/** Quader-Teil (Mittelpunkt, Maße, Drehung um X in rad). */
function box(out, cx, cy, cz, sx, sy, sz, col, rotX = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
  if (rotX) g.rotateX(rotX);
  g.translate(cx, cy, cz);
  put(out, g, col);
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _dirV = new THREE.Vector3(), _qq = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0);
/** Glied als sechseckiger Kegelstumpf von a nach b (Radien r0 → r1). */
function limb(out, ax, ay, az, bx, by, bz, r0, r1, col) {
  _a.set(ax, ay, az); _b.set(bx, by, bz);
  const len = _a.distanceTo(_b);
  const g = new THREE.CylinderGeometry(r1, r0, len, 6, 1, false).toNonIndexed();
  _dirV.subVectors(_b, _a).normalize();
  _qq.setFromUnitVectors(_Y, _dirV);
  g.applyQuaternion(_qq);
  g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  put(out, g, col);
}

/** Bein von der Hüfte (hx, hy, hz): Neigung `ang` (rad, + = nach vorn, −Z), Kniebeuge `knee`. */
function leg(out, hx, hy, hz, ang, knee = 0) {
  const th = 0.45, sh = 0.45;
  const kx = hx, ky = hy - Math.cos(ang) * th, kz = hz - Math.sin(ang) * th;
  limb(out, hx, hy, hz, kx, ky, kz, 0.095, 0.072, C_PANTS);
  const a2 = ang - knee;
  const fy = ky - Math.cos(a2) * sh, fz = kz - Math.sin(a2) * sh;
  limb(out, kx, ky, kz, kx, fy + 0.06, fz, 0.068, 0.052, C_PANTS);
  box(out, kx, fy + 0.05, fz - 0.05, 0.11, 0.1, 0.26, C_BOOT);
}

/** Geometrie einer Pose (Füße bei y = 0, Blick −Z), ≈ 400 Dreiecke. */
function poseGeometry(pose) {
  const out = { p: [], n: [], c: [] };
  const crouch = pose === 'crouch';
  const run = pose === 'runA' || pose === 'runB';
  const s = pose === 'runB' ? -1 : 1;
  const hipY = crouch ? 0.6 : run ? 0.88 : 0.93;
  const lean = crouch ? 0.3 : run ? 0.22 : 0.06;
  if (crouch) {
    leg(out, -0.1, hipY, 0, 1.3, 2.3);
    leg(out, 0.1, hipY, 0, 0.15, 1.75);
  } else if (run) {
    leg(out, -0.1, hipY, 0, 0.5 * s, 0.2 + (s > 0 ? 0.15 : 0.9));
    leg(out, 0.1, hipY, 0, -0.5 * s, 0.2 + (s > 0 ? 0.9 : 0.15));
  } else {
    leg(out, -0.1, hipY, 0, 0.04, 0.05);
    leg(out, 0.1, hipY, 0, -0.04, 0.05);
  }
  // Becken, Rumpf (um die Hüfte geneigt), Plattenträger, Rucksack
  box(out, 0, hipY + 0.03, 0, 0.34, 0.18, 0.22, C_PANTS);
  const tl = 0.54;
  const ty = hipY + 0.1 + Math.cos(lean) * tl / 2, tz = -Math.sin(lean) * tl / 2;
  limb(out, 0, hipY + 0.08, 0, 0, hipY + 0.1 + Math.cos(lean) * tl, -Math.sin(lean) * tl, 0.15, 0.19, C_UNI);
  box(out, 0, ty - 0.02, tz - 0.07, 0.36, tl * 0.66, 0.16, C_GEAR, -lean);
  box(out, 0, ty + 0.02, tz + 0.14, 0.3, tl * 0.6, 0.14, C_GEAR, -lean);
  const shY = hipY + 0.1 + Math.cos(lean) * tl, shZ = -Math.sin(lean) * tl;
  // Kopf + Helm
  const hd = new THREE.SphereGeometry(0.1, 7, 5).toNonIndexed(); hd.translate(0, shY + 0.15, shZ - 0.02); put(out, hd, C_SKIN);
  const hm = new THREE.SphereGeometry(0.128, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55).toNonIndexed(); hm.translate(0, shY + 0.17, shZ); put(out, hm, C_GEAR);
  // Arme im Anschlag (Schulter → Ellbogen → Hand an der Waffe)
  const gy = shY - 0.16, gz = shZ - 0.42;
  limb(out, -0.2, shY - 0.03, shZ, -0.2, shY - 0.27, shZ - 0.2, 0.06, 0.05, C_UNI);
  limb(out, -0.2, shY - 0.27, shZ - 0.2, -0.05, gy - 0.04, gz - 0.12, 0.05, 0.04, C_UNI);
  limb(out, 0.2, shY - 0.03, shZ, 0.19, shY - 0.3, shZ - 0.06, 0.06, 0.05, C_UNI);
  limb(out, 0.19, shY - 0.3, shZ - 0.06, 0.06, gy - 0.05, gz + 0.12, 0.05, 0.04, C_UNI);
  // Gewehr (Schaft an der rechten Schulter)
  box(out, 0.05, gy, gz, 0.05, 0.08, 0.84, C_GUN);
  box(out, 0.05, gy - 0.1, gz + 0.06, 0.04, 0.13, 0.06, C_GUN);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.n, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(out.c, 3));
  if (pose === 'prone') {
    // Liegen: stehende Figur nach vorn gekippt (Kopf voraus), knapp über dem Boden
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.16, -0.9);
  }
  g.computeBoundingSphere();
  return g;
}

let geoCache = null;
function geometries() {
  if (!geoCache) geoCache = POSES.map((p) => poseGeometry(p));
  return geoCache;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();
const schemeColor = new Map();
function colorOf(scheme) {
  let c = schemeColor.get(scheme);
  if (!c) {
    const S = SCHEMES[scheme] || SCHEMES.A;
    // Mittel aus hellem und dunklem Tarnfleck – aus der Ferne verschwimmt das Muster zu dieser Farbe
    const a = new THREE.Color(S.camo[0]), b = new THREE.Color(S.camo[1]);
    c = a.lerp(b, 0.4);
    schemeColor.set(scheme, c);
  }
  return c;
}

/** k-kleinster Wert der ersten n Einträge (Quickselect, ordnet a teilweise um). */
function kth(a, n, k) {
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const pv = a[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (a[i] < pv) i++;
      while (a[j] > pv) j--;
      if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; }
    }
    if (k <= j) hi = j; else if (k >= i) lo = i; else return a[k];
  }
  return a[k];
}

export class CrowdImpostors {
  constructor(mgr) {
    this.mgr = mgr;
    this.root = null;
    this.meshes = [];
    this.capacity = 0;
    this.material = null;
    this.counts = { impostors: 0, full: 0 };
  }

  _ensure(scene, need) {
    if (this.root && need <= this.capacity) { if (this.root.parent !== scene) scene.add(this.root); return; }
    const cap = Math.max(64, Math.ceil(need / 64) * 64);
    this.dispose(false);
    if (!this.material) this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, name: 'masse-silhouette' });
    const root = (this.root = new THREE.Group());
    root.name = 'masse-silhouetten';
    this.meshes = geometries().map((g, i) => {
      const m = new THREE.InstancedMesh(g, this.material, cap);
      m.name = `silhouette-${POSES[i]}`;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = false;
      m.count = 0;
      root.add(m);
      return m;
    });
    this.capacity = cap;
    scene.add(root);
  }

  /**
   * Je Bild nach der Sicht-/Abstandsbestimmung: entscheidet voll ↔ Silhouette für lebende, sichtbare Soldaten und füllt
   * die Instanzen. `bots` mit camDist/inView gesetzt. Gibt nichts zurück; setzt bot.impostor.
   */
  update(bots, scene, tier, fovK, now) {
    const full = FULL_BUDGET[tier] ?? FULL_BUDGET.high;
    const minD0 = IMP_MIN[tier] ?? IMP_MIN.high;
    const farD = IMP_FAR[tier] ?? IMP_FAR.high;
    // Kandidaten: lebende, sichtbare, nicht-Puppen-Soldaten
    const cand = this._cand || (this._cand = []);
    cand.length = 0;
    let dist = this._dist;
    if (!dist || dist.length < bots.length) dist = this._dist = new Float64Array(Math.max(64, bots.length * 2));
    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      const s = b.soldier;
      const ok = b.alive && b.inView && s && s.state === 'alive' && !b.vehicle && !b.puppet;
      if (!ok) { if (b.impostor) this._release(b); continue; }
      dist[cand.length] = b.camDist;
      cand.push(b);
    }
    // Budget: nächste `full` bleiben voll – Abstand des full-nächsten per Auswahl (O(n), keine Sortierung je Bild)
    const limit = cand.length > full ? kth(dist, cand.length, full - 1) : Infinity;
    // Gedränge (viel mehr sichtbare als volle Soldaten): Silhouetten schon ab 80 % des Mindestabstands
    const minD = cand.length > full * 3 ? minD0 * 0.8 : minD0;
    if (!this.root && !cand.some((b) => b.camDist * fovK > farD || (b.camDist * fovK > minD && b.camDist > limit))) { this.counts.impostors = 0; this.counts.full = cand.length; return; }
    this._ensure(scene, bots.length);
    const M = this.meshes;
    for (let k = 0; k < M.length; k++) M[k].count = 0;
    let nImp = 0, nFull = 0;
    for (let i = 0; i < cand.length; i++) {
      const b = cand[i];
      const d = b.camDist * fovK;
      const imp = d > farD || (d > minD && b.camDist > limit) || (b.impostor && d > minD - 3 && b.camDist >= limit - 2);
      const s = b.soldier;
      if (!imp) {
        if (b.impostor) this._release(b);
        nFull++;
        continue;
      }
      b.impostor = true;
      s.root.visible = false;
      b.animEvery = 10; // Pose nur selten nachführen (Trefferzonen: Hocken/Liegen), kein Skinning – der Soldat ist verborgen
      // Pose
      const v = b.body ? b.body.velocity : null;
      const sp = v ? Math.hypot(v.x, v.z) : 0;
      let pose = 0;
      if (b.stance === 'prone') pose = 4;
      else if (b.crouching && sp < 2.2) pose = 3;
      else if (sp > 1.2) pose = ((now * (sp > 4 ? 3.2 : 2.2) + (b.simPhase || 0) * 0.37) | 0) % 2 ? 2 : 1;
      const m = M[pose];
      const idx = m.count++;
      const yaw = Number.isFinite(b.yaw) ? b.yaw : s.anim.bodyYaw; // Blickrichtung (bodyYaw steht ohne Animation still)
      _q.setFromAxisAngle(_up, yaw);
      _m.compose(s.root.position, _q, _s); // Wurzel (zwischen Simulationstakten entlang der Geschwindigkeit geschoben)
      m.setMatrixAt(idx, _m);
      _c.copy(colorOf(s.scheme));
      m.setColorAt(idx, _c);
      nImp++;
    }
    for (let k = 0; k < M.length; k++) {
      if (M[k].count) { M[k].instanceMatrix.needsUpdate = true; if (M[k].instanceColor) M[k].instanceColor.needsUpdate = true; }
      M[k].visible = M[k].count > 0;
    }
    this.counts.impostors = nImp;
    this.counts.full = nFull;
  }

  /** Bot wieder als vollen Soldaten zeigen (Pose einmal neu berechnen lassen). */
  _release(b) {
    b.impostor = false;
    b._animAcc = Math.max(b._animAcc || 0, 0.05);
  }

  stats() {
    return { impostors: this.counts.impostors, full: this.counts.full, capacity: this.capacity, drawCalls: this.meshes.filter((m) => m.visible && m.count).length };
  }

  dispose(all = true) {
    if (this.root) { this.root.removeFromParent(); for (const m of this.meshes) m.dispose(); }
    this.root = null;
    this.meshes = [];
    this.capacity = 0;
    if (all && this.material) { this.material.dispose(); this.material = null; }
  }
}

/* ============================================================== Spawns verteilen */

const _sp = new THREE.Vector3();
/**
 * Große Matches: belegter Spawnpunkt → freier Navigationsknoten im Umkreis (bis 22 m, gleiche Ebene), damit hundert
 * Bots nicht auf denselben zwölf Punkten stehen und sich gegenseitig wegschieben. Kleine Matches unverändert.
 * spawn = { position, yaw } (wird angepasst zurückgegeben).
 */
export function spreadSpawn(G, actor, spawn) {
  if (!spawn || !spawn.position || !G || G.actors.length <= 48) return spawn;
  const grid = G.bots && G.bots.grid;
  const nav = G.world && G.world.nav;
  if (!grid || !nav || typeof nav.nodesInRadius !== 'function') return spawn;
  if (grid.frame !== G.bots._frame) grid.rebuild(G.actors, G.bots._frame); // Matchbeginn: Raster noch vom letzten Bild
  const p = spawn.position;
  if (!grid.occupied(p, 1.3, actor)) { grid.reserve(p); return spawn; }
  const nodes = nav.nodesInRadius(p, 22);
  // ab der Mitte nach außen, mit etwas Zufall (sonst bildet jeder Spawnpunkt denselben Ring)
  for (let tries = 0, k = 0; k < nodes.length && tries < 40; k++) {
    const n = nodes[Math.min(nodes.length - 1, k + ((Math.random() * 3) | 0))];
    const q = n.position;
    if (Math.abs(q.y - p.y) > 3) continue;
    tries++;
    _sp.copy(q);
    if (grid.occupied(_sp, 1.3, actor)) continue;
    spawn.position.copy(q);
    grid.reserve(q);
    return spawn;
  }
  return spawn;
}
