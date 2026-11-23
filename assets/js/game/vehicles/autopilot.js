// NULLPUNKT — Fahrer-Autopilot für Bots (und Tests): Pure Pursuit entlang eines Pfads mit Hindernisfächer,
// Abbremsen vor Kurven/Ziel, Rückwärtsfahren bei Ziel hinter dem Fahrzeug und Freifahren, wenn es feststeckt.
// Eingang: intent.moveTo (Vector3) oder intent.path (Vector3[]); Ausgang: intent.{throttle, steer, brake,
// handbrake} (werden vom Fahrzeug übernommen) sowie intent.arrived / intent.stuck / intent.blocked.
import * as THREE from 'three';
import { collisionRay } from '../engine/physics.js?v=20261123073102';

const _t = new THREE.Vector3(), _l = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3();
const _hit = {}, _q = new THREE.Vector3();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Punkt auf dem Pfad im Abstand `ahead` ab der Projektion von pos (Pfadindex wird mitgeführt). */
function pursuitTarget(intent, pos, ahead, out) {
  const path = intent.path;
  let i = Math.min(intent._wp | 0, path.length - 1);
  // Wegpunkte überspringen, die schon nah/überholt sind
  while (i < path.length - 1 && pos.distanceTo(path[i]) < Math.max(3, ahead * 0.6)) i++;
  intent._wp = i;
  let rest = ahead;
  let p = pos;
  for (let k = i; k < path.length; k++) {
    const d = p.distanceTo(path[k]);
    if (d >= rest) return out.copy(path[k]).sub(p).multiplyScalar(rest / Math.max(1e-3, d)).add(p);
    rest -= d;
    p = path[k];
  }
  return out.copy(path[path.length - 1]);
}

/**
 * Stellt intent.throttle/steer/brake aus moveTo/path. dt in s. world für Hindernisstrahlen.
 * Rückgabe: true, wenn der Autopilot steuert.
 */
export function updateAutopilot(vehicle, intent, dt, world) {
  if (!intent.path && intent.moveTo) intent.path = [intent.moveTo.clone()];
  const path = intent.path;
  if (!path || !path.length) return false;
  const b = vehicle.body, def = vehicle.def;
  const pos = b.origin(_o);
  const final = path[path.length - 1];
  const distFinal = Math.hypot(final.x - pos.x, final.z - pos.z);
  const v = b.speed;
  const vmax = Math.min(intent.maxSpeed || def.engine.maxSpeed, def.engine.maxSpeed);
  const ahead = clamp(4 + Math.abs(v) * 0.8, 5, 18);
  // gross (23.11.): Wegpunkt dicht neben dem Fahrzeug (innerhalb des Wendekreises, > 60° seitlich) überspringen – sonst
  // kreist das Fahrzeug mit vollem Einschlag um ihn (Niemandsland: Halbkette am Basisausgang)
  while ((intent._wp | 0) < path.length - 1) {
    const w = path[intent._wp | 0];
    if (Math.hypot(w.x - pos.x, w.z - pos.z) > 10) break;
    b.toLocal(_l.copy(w), _d);
    if (Math.abs(Math.atan2(_d.x, -_d.z)) < 1.05) break;
    intent._wp = (intent._wp | 0) + 1;
  }
  pursuitTarget(intent, pos, ahead, _t); // führt den Wegpunktindex nach
  // Ankunft erst am letzten Wegpunkt (Rundkurse enden am Start)
  intent.arrived = intent._wp >= path.length - 1 && distFinal < (intent.arriveRadius || 4);
  // Teilweg (Zeitbudget der Planung erschöpft): am Ende weiterplanen statt „angekommen“
  if (intent.arrived && path.partial && intent.moveTo && (intent._replans | 0) < 6 && world && world.scale === 'gross') {
    intent._replans = (intent._replans | 0) + 1;
    const hb = def.hullBox;
    let np = null;
    try { np = planVehiclePath(world, b.origin(_q), intent.moveTo, hb[3], vehicle.sys && typeof vehicle.sys.vehicleCircles === 'function' ? vehicle.sys.vehicleCircles(vehicle) : null); } catch { np = null; }
    if (np && np.length && np[np.length - 1].distanceTo(final) > 2) { intent.path = np; intent._wp = 0; intent.arrived = false; return true; }
  }
  if (intent.arrived) {
    intent.throttle = 0; intent.steer = 0; intent.brake = 1;
    intent._stuckT = 0;
    return true;
  }
  b.toLocal(_t, _l);
  // Lokal: −Z vorn, +X rechts
  const ang = Math.atan2(_l.x, -_l.z);
  const behind = Math.abs(ang) > 2.1;
  // Freifahren
  if (intent._reverseT > 0) {
    intent._reverseT -= dt;
    intent.throttle = -0.8;
    intent.steer = intent._reverseSteer || 0;
    intent.brake = 0;
    return true;
  }
  let throttle, steer;
  if (behind && distFinal < 14 && intent.reverseAllowed !== false) {
    // Ziel kurz hinter uns: rückwärts mit umgekehrter Lenkung
    throttle = -0.7;
    steer = clamp(-Math.sign(ang) * (Math.PI - Math.abs(ang)) * 1.8, -1, 1);
  } else {
    steer = clamp(ang * (vehicle.body.tracked ? 2.2 : 1.7), -1, 1);
    const turnSlow = 1 - Math.min(0.75, Math.abs(ang) / 1.3);
    const arriveSlow = clamp(distFinal / 18, 0.25, 1);
    const want = vmax * turnSlow * arriveSlow;
    throttle = clamp((want - v) * 0.35 + want / Math.max(1, def.engine.maxSpeed) * 0.5, -1, 1);
    if (vehicle.body.tracked && Math.abs(ang) > 0.9 && Math.abs(v) < 3) throttle = Math.min(throttle, 0.15); // auf der Stelle drehen
  }
  // Hindernisfächer (3 Strahlen in Stoßstangenhöhe)
  if (world && throttle > 0) {
    const len = 3 + Math.abs(v) * 1.1;
    const hb = def.hullBox;
    let left = len, right = len, mid = len;
    for (const [k, a] of [[0, 0], [1, -0.42], [2, 0.42]]) {
      _d.set(Math.sin(a), 0, -Math.cos(a)).applyQuaternion(b.quat);
      _f.set(0, 0.85, hb[2] - hb[5] + 0.2);
      b.toWorld(_f, _o);
      const h = collisionRay(world, _o, _d, len, _hit);
      const dd = h ? h.distance : len;
      if (k === 0) mid = dd; else if (k === 1) left = dd; else right = dd;
    }
    if (mid < len * 0.7 || left < len * 0.45 || right < len * 0.45) {
      steer = clamp(steer + (right > left ? 0.7 : -0.7), -1, 1);
      throttle *= clamp(mid / len, 0.3, 1);
    }
  }
  // Feststecken erkennen. gross (23.11.): Schwelle 0,15 statt 0,3 – der Hindernisfächer drosselt vor einem Hindernis auf
  // genau 0,3, dann griff die Erkennung nie (Brandwald: Transporter schob minutenlang gegen einen Stamm); zusätzlich echter
  // Weg statt Raddrehzahl (durchdrehende Räder meldeten 3 m/s im Stand)
  const op = b.origin(_q); // pos (_o) ist nach dem Hindernisfächer überschrieben
  if (!intent._pp) { intent._pp = op.clone(); intent._pt = 0; }
  intent._pt += dt;
  if (op.distanceTo(intent._pp) > 1.5) { intent._pp.copy(op); intent._pt = 0; }
  if (throttle > 0.15 && Math.abs(v) < 0.6) intent._stuckT = (intent._stuckT || 0) + dt;
  else intent._stuckT = Math.max(0, (intent._stuckT || 0) - dt * 2);
  intent.stuck = intent._stuckT > 2.5 || (throttle > 0.15 && intent._pt > 3.5);
  if (intent.stuck) {
    intent._stuckT = 0; intent._pt = 0; intent._pp.copy(op);
    intent._reverseT = 1.6;
    intent._reverseSteer = steer >= 0 ? -1 : 1;
    intent.stuckCount = (intent.stuckCount || 0) + 1;
    intent.blocked = intent.stuckCount >= 3;
    // Großkarte: Stelle vor dem Bug sperren und den Restweg neu planen (statt dreimal gegen dasselbe Hindernis)
    if (!intent.blocked && world && world.scale === 'gross' && world.nav) {
      const hb = def.hullBox;
      _f.set(0, 0.5, hb[2] - hb[5] - 1.0);
      b.toWorld(_f, _o);
      const ban = world._vehBan || (world._vehBan = []);
      ban.push([_o.x, _o.z]);
      if (ban.length > 64) ban.shift();
      if (world._vehPathCache) world._vehPathCache.clear();
      try {
        const np = planVehiclePath(world, op, final, hb[3], vehicle.sys && typeof vehicle.sys.vehicleCircles === 'function' ? vehicle.sys.vehicleCircles(vehicle) : null);
        if (np && np.length) { intent.path = np; intent._wp = 0; }
      } catch { /* alter Weg bleibt */ }
    }
  }
  intent.throttle = throttle;
  intent.steer = steer;
  intent.brake = 0;
  return true;
}

/** Autopilot-Zustand löschen (neues Ziel). */
export function resetAutopilot(intent) {
  intent._wp = 0; intent._stuckT = 0; intent._reverseT = 0; intent._pp = null; intent._pt = 0; intent._replans = 0; intent.stuck = false; intent.blocked = false; intent.stuckCount = 0; intent.arrived = false;
}

/*
 * gross (23.11.): Fahrweg auf Großkarten mit Fahrzeugbreite. Vorher plante VehicleSystem.planPath über das Straßennetz,
 * sobald die Welt eines hatte – auch ohne Straße in der Nähe (Brandwald: nur der Forstweg in der Kartenmitte) oder ganz
 * ohne Straßen (Niemandsland: leeres Netz → gerade Linie zum Ziel). Der erste Abschnitt führte damit geradewegs durch
 * Totholz-Haine, Laufgräben und Sandsackriegel am Basis-Ausgang; Transporter blieben bei (36/151), (−20/−214) u. a. hängen.
 * Jetzt: A* über den Navigationsgraphen, jede Verbindung zusätzlich für die Fahrzeugbreite geprüft (Höhenprofil in drei
 * Spuren ohne Graben/Stufe/Wall, Kollisionsstrahlen links/Mitte/rechts in Stoßstangen- und Aufbauhöhe). Ergebnisse je
 * Verbindung und Breitenklasse werden je Welt zwischengespeichert.
 */
const VP_MAX_EXPAND = 16000, VP_W = 1.25, VP_BUDGET_MS = 40;
const _vpHit = { t: 0, tri: 0, nx: 0, ny: 0, nz: 0, data: 0, back: false };

/** Boden unter (x, z) nahe der Bezugshöhe ref: Höhenfeld, darüber begehbare Bauwerksflächen (Brücken, Rampen, Platten). */
function groundNear(hf, col, x, z, ref) {
  const h = hf.heightAt(x, z);
  if (h >= ref - 0.6 || !col) return h;
  if (col.raycast(x, ref + 0.8, z, 0, -1, 0, 1.6, _vpHit) && _vpHit.ny > 0.7) return ref + 0.8 - _vpHit.t;
  return h;
}

/** Befahrbare Strecke A → B (Vector3-artig) für halbe Breite hw? */
/** Strecke A → B (xz) kommt einem Kreis [x, z, r] näher als hw? */
function nearCircles(A, B, hw, circles) {
  if (!circles || !circles.length) return false;
  const dx = B.x - A.x, dz = B.z - A.z, d2 = dx * dx + dz * dz || 1e-9;
  for (const [cx, cz, r] of circles) {
    const t = Math.max(0, Math.min(1, ((cx - A.x) * dx + (cz - A.z) * dz) / d2));
    if (Math.hypot(A.x + dx * t - cx, A.z + dz * t - cz) < r + hw) return true;
  }
  return false;
}

export function vehicleSegmentOk(world, A, B, hw) {
  const hf = world.terrain && world.terrain.heightfield, col = world.debugData && world.debugData.colliderBVH;
  const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), dy = B.y - A.y;
  if (d < 0.3) return Math.abs(dy) < 0.6;
  if (Math.abs(dy) > d * 0.5 + 0.25) return false; // > ≈ 27°
  const ux = dx / d, uz = dz / d, px = -uz, pz = ux, n = Math.max(1, Math.ceil(d / 1.2));
  // Höhenprofil in Spuren alle ≤ 0,7 m bis 0,3 m über die Fahrzeugbreite hinaus (Grabenrampen der Infanterie, 3 m Trichter,
  // sind für Fahrzeuge zu schmal – vorher fanden drei Spuren eine Lücke und das Fahrzeug blieb im Graben hängen)
  const hwT = hw + 0.3, nt = Math.max(2, Math.ceil((2 * hwT) / 0.7)), lanes = [];
  for (let k = 0; k <= nt; k++) lanes.push(-hwT + (2 * hwT * k) / nt);
  if (hf) for (const o of lanes) {
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = A.x + dx * t + px * o, z = A.z + dz * t + pz * o, ref = A.y + dy * t;
      if (!hf.contains(x, z)) return false;
      const h = groundNear(hf, col, x, z, ref);
      if (h < ref - 0.45 || h > ref + 0.9) return false;        // Graben/Loch bzw. Wall unter dem Fahrzeug
      if (prev !== null && Math.abs(h - prev) > 0.5 + (d / n) * 0.45) return false; // Stufe/Grabenkante
      if (hf.waterY != null && h < hf.waterY - 0.9) return false; // tiefes Wasser
      prev = h;
    }
  }
  // Sperrpunkte (Autopilot: hier festgefahren)
  for (const [bx, bz] of world._vehBan || []) {
    const t = Math.max(0, Math.min(1, ((bx - A.x) * dx + (bz - A.z) * dz) / (d * d)));
    if (Math.hypot(A.x + dx * t - bx, A.z + dz * t - bz) < hw + 1.5) return false;
  }
  if (col) {
    const len = Math.hypot(d, dy), lx = dx / len, ly = dy / len, lz = dz / len, w = hw + 0.6; // Spielraum: gelenkt wird nicht spurgenau
    // Spuren alle ≤ 0,55 m über die ganze Breite (dünne Stämme passten zwischen drei Strahlen hindurch); 0,25 m: Stümpfe und
    // liegende Stämme unter der Stoßstange (das Gelände selbst ist nicht in der Bauwerks-BVH), 0,9 m: Aufbau, 1,7 m Mitte
    const nl = Math.max(2, Math.ceil((2 * w) / 0.55));
    for (let k = 0; k <= nl; k++) {
      const o = -w + (2 * w * k) / nl;
      for (const hy of [0.25, 0.9]) if (col.occluded(A.x + px * o, A.y + hy, A.z + pz * o, lx, ly, lz, len)) return false;
    }
    if (col.occluded(A.x, A.y + 1.7, A.z, lx, ly, lz, len)) return false;
  }
  return true;
}

/** → Vector3[] (ohne Start, mit Ziel) oder null (kein Navigationsgraph/kein Weg). */
export function planVehiclePath(world, from, to, hw = VP_W, avoid = null) {
  const nav = world && world.nav, nodes = nav && nav.nodes;
  if (!nodes || !nodes.length || typeof nav.nodesInRadius !== 'function') return null;
  const wk = Math.round(Math.max(0.75, Math.min(2.5, hw)) * 4) / 4;
  const caches = world._vehPathCache || (world._vehPathCache = new Map());
  let cache = caches.get(wk);
  if (!cache || cache.size > 400000) { cache = new Map(); caches.set(wk, cache); }
  const N = nodes.length;
  const ok = (a, c) => {
    const key = a < c ? a * N + c : c * N + a;
    let v = cache.get(key);
    if (v === undefined) { v = vehicleSegmentOk(world, nodes[a].position, nodes[c].position, wk) ? 1 : 0; cache.set(key, v); }
    return v === 1 && !nearCircles(nodes[a].position, nodes[c].position, wk, avoid); // andere Fahrzeuge: nicht zwischengespeichert
  };
  const segOk = (A, B, w) => vehicleSegmentOk(world, A, B, w) && !nearCircles(A, B, w, avoid);
  // Start/Ziel auf den Boden (Fahrzeugursprung bzw. gemittelte Zielhöhe liegen nicht genau darauf)
  const hf = world.terrain && world.terrain.heightfield, col = world.debugData && world.debugData.colliderBVH;
  if (hf) { from = from.clone(); from.y = groundNear(hf, col, from.x, from.z, from.y + 0.5); to = to.clone(); to.y = groundNear(hf, col, to.x, to.z, hf.heightAt(to.x, to.z) + 0.3); }
  const near = (p, r) => nav.nodesInRadius(p, r).filter((n) => Math.abs(n.position.y - p.y) < 2.5).slice(0, 10);
  const startN = near(from, 10).find((n) => segOk(from, n.position, wk * 0.8)) || near(from, 10).find((n) => vehicleSegmentOk(world, from, n.position, wk * 0.8));
  if (!startN) return null;
  const goalP = to, goalNs = new Set(near(to, 12).map((n) => n.id));
  // A* (gewichtete Heuristik), binärer Heap
  const g = new Map(), prev = new Map(), closed = new Set();
  const heap = [];
  const push = (id, f) => { heap.push([f, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const h = (id) => nodes[id].position.distanceTo(goalP) * 1.25;
  g.set(startN.id, 0); push(startN.id, h(startN.id));
  let best = startN.id, bestH = h(startN.id), found = -1, iter = 0;
  // Zeitbudget (läuft synchron beim Losfahren): danach Teilweg zum besten Knoten – die Verbindungsprüfungen bleiben
  // zwischengespeichert, spätere Planungen (Neuplanung, nächste Fahrt) kommen weiter
  const tEnd = performance.now() + VP_BUDGET_MS;
  while (heap.length && iter++ < VP_MAX_EXPAND && ((iter & 63) || performance.now() < tEnd)) {
    const [, cur] = pop();
    if (closed.has(cur)) continue;
    closed.add(cur);
    const hc = h(cur);
    if (hc < bestH) { bestH = hc; best = cur; }
    if (goalNs.has(cur) && segOk(nodes[cur].position, goalP, wk * 0.8)) { found = cur; break; }
    const cp = nodes[cur].position, gc = g.get(cur);
    for (const nb of nodes[cur].links) {
      if (closed.has(nb)) continue;
      const np = nodes[nb].position, cost = gc + cp.distanceTo(np) + Math.abs(np.y - cp.y) * 2 + (nodes[nb].cost || 0);
      if (cost >= (g.get(nb) ?? Infinity)) continue;
      if (!ok(cur, nb)) continue;
      g.set(nb, cost); prev.set(nb, cur); push(nb, cost + h(nb));
    }
  }
  const cut = found < 0 && heap.length > 0 && iter < VP_MAX_EXPAND; // Zeitbudget erschöpft, Suche nicht zu Ende
  const end = found >= 0 ? found : best;
  if (end === startN.id && found < 0) return null;
  const ids = [];
  for (let c = end; c !== undefined; c = prev.get(c)) ids.push(c);
  ids.reverse();
  // Glätten: bis zu 6 Knoten überspringen, wenn die direkte Strecke befahrbar ist (≤ 30 m)
  const P = [from, ...ids.map((i) => nodes[i].position)];
  const out = [];
  let i = 0;
  while (i < P.length - 1) {
    let j = Math.min(P.length - 1, i + 6);
    while (j > i + 1 && (P[i].distanceTo(P[j]) > 30 || !segOk(P[i], P[j], wk))) j--;
    out.push(P[j].clone());
    i = j;
  }
  if (found >= 0) out.push(goalP.clone());
  if (cut) out.partial = true; // Autopilot plant am Ende des Teilwegs weiter (Zwischenspeicher dann warm)
  return out;
}
