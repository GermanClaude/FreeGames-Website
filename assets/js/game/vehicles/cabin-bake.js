// NULLPUNKT — Innenraum-Licht backen (Nutzer 20.11.: „sehr gute Innenbeleuchtung, weiche Schatten, Kontaktschatten“).
//
// Statt Schattenkarten (Sampler-Grenze, Kosten) werden je Eckpunkt zwei Dinge einmal ausgerechnet und als Attribute
// abgelegt – Grundlage ist ein grobes Belegungsgitter (Voxel, 3–4 cm) aus allen Innenraum-Netzen eines Raums:
//   cabA.x  Umgebungsverdeckung (AO, Halbkugel, Reichweite ~0,4 m): Ecken, Fugen und Kontaktstellen werden dunkler,
//           der Innenraum-Shader legt dort zusätzlich Schmutz ab
//   cabA.y  Abnutzung (von cabin.js beim Bauen gesetzt: Griffe, Hebel, Trittflächen) – bleibt erhalten
//   cabA.z  Raum (0 Turm/Kampfraum, 1 Fahrerraum) – Schatten gelten nur für die Lampen dieses Raums
//   cabS0/cabS1  Schatten der ersten vier Innenleuchten (0 frei … 1 verdeckt), weich über zwei versetzte Strahlen
// Fehlende Attribute liest WebGL als 0 → kein Effekt (Teile, die nach dem Backen dazukommen, bleiben einfach hell).
//
// Läuft schrittweise (Zeitbudget je Bild), damit das erste Einsteigen nicht ruckelt; große Flächen werden vorher
// unterteilt (≤ tess m Kantenlänge), damit die Verdeckung auch auf Wänden und Boden sichtbar wird.
import * as THREE from 'three';

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4(), _nm = new THREE.Matrix3();

/** Dreiecke mit Kanten > maxLen rekursiv teilen (nicht indiziert, alle Attribute linear). → neue Geometrie oder null
 * (innen2: verschachtelte Puffer statt Arrays je Ecke – die modellierten Schalen haben viele große Flächen) */
export function tessellate(geom, maxLen) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const P = g.attributes.position, n = P.count;
  if (!n) return null;
  const names = Object.keys(g.attributes);
  const src = names.map((k) => g.attributes[k]);
  const L2 = maxLen * maxLen;
  const pa = P.array;
  const d2 = (i, j) => { const dx = pa[i * 3] - pa[j * 3], dy = pa[i * 3 + 1] - pa[j * 3 + 1], dz = pa[i * 3 + 2] - pa[j * 3 + 2]; return dx * dx + dy * dy + dz * dz; };
  const ar = (i, j, k) => {
    const ux = pa[j * 3] - pa[i * 3], uy = pa[j * 3 + 1] - pa[i * 3 + 1], uz = pa[j * 3 + 2] - pa[i * 3 + 2];
    const wx = pa[k * 3] - pa[i * 3], wy = pa[k * 3 + 1] - pa[i * 3 + 1], wz = pa[k * 3 + 2] - pa[i * 3 + 2];
    return Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
  };
  let need = false;
  for (let t = 0; t < n && !need; t += 3) if ((d2(t, t + 1) > L2 || d2(t + 1, t + 2) > L2 || d2(t + 2, t) > L2) && ar(t, t + 1, t + 2) >= L2 * 0.3) need = true;
  if (!need) return null;
  // verschachteln: je Ecke alle Attribute hintereinander (Position zuerst)
  const pi = names.indexOf('position');
  const order = [pi, ...names.map((_, i) => i).filter((i) => i !== pi)];
  const sizes = order.map((i) => src[i].itemSize), stride = sizes.reduce((x, y) => x + y, 0);
  const IN = new Float32Array(n * stride);
  { let off = 0; for (let q = 0; q < order.length; q++) { const a = src[order[q]].array, sz = sizes[q]; for (let v = 0; v < n; v++) for (let k = 0; k < sz; k++) IN[v * stride + off + k] = a[v * sz + k]; off += sz; } }
  let out = new Float32Array(Math.max(stride * 3 * 64, n * stride * 2)), on = 0;
  const emit = (buf, o) => {
    if (on + stride > out.length) { const nb = new Float32Array(out.length * 2); nb.set(out); out = nb; }
    for (let k = 0; k < stride; k++) out[on + k] = buf[o + k];
    on += stride;
  };
  const pool = new Float32Array(stride * 16);
  const dd = (A, a, B, b) => { const dx = A[a] - B[b], dy = A[a + 1] - B[b + 1], dz = A[a + 2] - B[b + 2]; return dx * dx + dy * dy + dz * dz; };
  const area = (A, a, B, b, C, c) => {
    const ux = B[b] - A[a], uy = B[b + 1] - A[a + 1], uz = B[b + 2] - A[a + 2], wx = C[c] - A[a], wy = C[c + 1] - A[a + 1], wz = C[c + 2] - A[a + 2];
    return Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
  };
  const split = (A, a, B, b, C, c, depth) => {
    const ab = dd(A, a, B, b), bc = dd(B, b, C, c), ca = dd(C, c, A, a), mx = Math.max(ab, bc, ca);
    // nur große Flächen teilen (lange, schmale Dreiecke von Rohren/Kanten bleiben)
    if (mx <= L2 || depth > 12 || area(A, a, B, b, C, c) < L2 * 0.3) { emit(A, a); emit(B, b); emit(C, c); return; }
    const m = depth * stride;
    // längste Kante halbieren (Kanten zwischen Dreiecken teilen sich gleich)
    if (mx === ab) { for (let k = 0; k < stride; k++) pool[m + k] = (A[a + k] + B[b + k]) / 2; split(A, a, pool, m, C, c, depth + 1); split(pool, m, B, b, C, c, depth + 1); }
    else if (mx === bc) { for (let k = 0; k < stride; k++) pool[m + k] = (B[b + k] + C[c + k]) / 2; split(A, a, B, b, pool, m, depth + 1); split(A, a, pool, m, C, c, depth + 1); }
    else { for (let k = 0; k < stride; k++) pool[m + k] = (C[c + k] + A[a + k]) / 2; split(A, a, B, b, pool, m, depth + 1); split(pool, m, B, b, C, c, depth + 1); }
  };
  for (let t = 0; t < n; t += 3) split(IN, t * stride, IN, (t + 1) * stride, IN, (t + 2) * stride, 0);
  const nv = on / stride;
  const ng = new THREE.BufferGeometry();
  let off = 0;
  for (let q = 0; q < order.length; q++) {
    const a = src[order[q]], sz = sizes[q];
    const Arr = a.array.constructor === Float32Array || a.array.constructor === Array ? Float32Array : a.array.constructor;
    const arr = new Arr(nv * sz);
    for (let v = 0; v < nv; v++) for (let k = 0; k < sz; k++) arr[v * sz + k] = out[v * stride + off + k];
    ng.setAttribute(names[order[q]], new THREE.BufferAttribute(arr, sz, a.normalized));
    off += sz;
  }
  return ng;
}

/** Fibonacci-Halbkugel um +Z, kosinusgewichtet. */
function hemi(N) {
  const d = [];
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N, a = i * 2.39996323;
    const r = Math.sqrt(u), z = Math.sqrt(1 - u);
    d.push([Math.cos(a) * r, Math.sin(a) * r, z]);
  }
  return d;
}

/**
 * Backauftrag anlegen.
 * spaces: [{ set: 0|1, items: [{ mesh, M: Matrix4 (Netz → Raum), occ (belegt das Gitter), set, shadow, skip }], lamps: [Vector3 im Raum] (≤ 4), shadows }]
 * opts: { cell, aoDirs, aoReach, tess }
 * → { step(ms) → true wenn fertig, done, progress }
 */
export function createBake(spaces, opts = {}) {
  const cell = opts.cell || 0.035, aoN = opts.aoDirs || 12, reach = opts.aoReach || 0.42;
  const DIRS = hemi(aoN);
  const jobs = [];
  for (const S of spaces) jobs.push({ S, phase: 0, grid: null, mi: 0, vi: 0, cache: null });
  let ji = 0;
  const state = { done: false, progress: 0, verts: 0 };

  function buildGrid(S) {
    const box = new THREE.Box3();
    for (const it of S.items) {
      const g = it.mesh.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      box.union(g.boundingBox.clone().applyMatrix4(it.M));
    }
    box.expandByScalar(cell * 2);
    const nx = Math.max(1, Math.ceil((box.max.x - box.min.x) / cell)), ny = Math.max(1, Math.ceil((box.max.y - box.min.y) / cell)), nz = Math.max(1, Math.ceil((box.max.z - box.min.z) / cell));
    if (nx * ny * nz > 6e6) return null;
    const occ = new Uint8Array(nx * ny * nz);
    const ox = box.min.x, oy = box.min.y, oz = box.min.z, inv = 1 / cell;
    const mark = (x, y, z) => {
      const i = ((x - ox) * inv) | 0, j = ((y - oy) * inv) | 0, k = ((z - oz) * inv) | 0;
      if (i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz) occ[(k * ny + j) * nx + i] = 1;
    };
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (const it of S.items) {
      if (it.occ === false) continue;
      const g = it.mesh.geometry, P = g.attributes.position, I = g.index;
      const cnt = I ? I.count : P.count;
      for (let t = 0; t + 2 < cnt; t += 3) {
        const i0 = I ? I.getX(t) : t, i1 = I ? I.getX(t + 1) : t + 1, i2 = I ? I.getX(t + 2) : t + 2;
        a.fromBufferAttribute(P, i0).applyMatrix4(it.M); b.fromBufferAttribute(P, i1).applyMatrix4(it.M); c.fromBufferAttribute(P, i2).applyMatrix4(it.M);
        const L = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
        const s = Math.max(1, Math.ceil(L / (cell * 0.7)));
        for (let u = 0; u <= s; u++) for (let v = 0; v <= s - u; v++) {
          const fu = u / s, fv = v / s, fw = 1 - fu - fv;
          mark(a.x * fw + b.x * fu + c.x * fv, a.y * fw + b.y * fu + c.y * fv, a.z * fw + b.z * fu + c.z * fv);
        }
      }
    }
    return { occ, nx, ny, nz, ox, oy, oz, inv };
  }

  const hit = (G, x, y, z) => {
    const i = ((x - G.ox) * G.inv) | 0, j = ((y - G.oy) * G.inv) | 0, k = ((z - G.oz) * G.inv) | 0;
    if (i < 0 || j < 0 || k < 0 || i >= G.nx || j >= G.ny || k >= G.nz) return 0;
    return G.occ[(k * G.ny + j) * G.nx + i];
  };
  /** frei bis zur Länge len? (Start p, Richtung d normiert) → 0 frei, sonst Gewicht 1 − t/len·0,5 */
  const march = (G, px, py, pz, dx, dy, dz, len, w) => {
    for (let t = cell * 0.6; t < len; t += cell * 0.9) if (hit(G, px + dx * t, py + dy * t, pz + dz * t)) return w ? 1 - (t / len) * 0.55 : 1;
    return 0;
  };

  const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
  function vertex(J, it, P, N, i, A, S0, S1) {
    _v.fromBufferAttribute(P, i).applyMatrix4(it.M);
    _n.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize();
    const doSh = J.S.shadows && it.shadow !== false, set = it.set != null ? it.set : J.S.set;
    const key = `${Math.round(_v.x * 400)},${Math.round(_v.y * 400)},${Math.round(_v.z * 400)},${Math.round(_n.x * 4)},${Math.round(_n.y * 4)},${Math.round(_n.z * 4)},${doSh ? 1 : 0}`;
    let r = J.cache.get(key);
    if (!r) {
      const G = J.grid, S = J.S;
      // Start etwas vor der Fläche (aus der eigenen Zelle heraus)
      const off = cell * 1.25;
      const px = _v.x + _n.x * off, py = _v.y + _n.y * off, pz = _v.z + _n.z * off;
      // Basis um die Normale
      if (Math.abs(_n.y) < 0.9) _t1.set(0, 1, 0); else _t1.set(1, 0, 0);
      _t1.cross(_n).normalize(); _t2.crossVectors(_n, _t1);
      let o = 0;
      for (const d of DIRS) {
        const dx = _t1.x * d[0] + _t2.x * d[1] + _n.x * d[2], dy = _t1.y * d[0] + _t2.y * d[1] + _n.y * d[2], dz = _t1.z * d[0] + _t2.z * d[1] + _n.z * d[2];
        o += march(G, px, py, pz, dx, dy, dz, reach, true);
      }
      o = Math.min(1, (o / DIRS.length) * 1.35);
      const sh = [0, 0, 0, 0];
      if (doSh) for (let l = 0; l < S.lamps.length && l < 4; l++) {
        const L = S.lamps[l];
        let lx = L.x - px, ly = L.y - py, lz = L.z - pz;
        const dist = Math.hypot(lx, ly, lz);
        if (dist < 0.12 || dist > 3.2) continue;
        if (lx * _n.x + ly * _n.y + lz * _n.z <= 0) continue; // Rückseite: Licht wirkt ohnehin nicht
        // zwei Strahlen zu leicht versetzten Punkten der Leuchte (weicher Halbschatten)
        let b = 0;
        for (const s of [-1, 1]) {
          const tx = L.x + _t1.x * 0.05 * s - px, ty = L.y + 0.0 - py, tz = L.z + _t1.z * 0.05 * s - pz;
          const dd = Math.hypot(tx, ty, tz);
          b += march(G, px, py, pz, tx / dd, ty / dd, tz / dd, dd - 0.09, false);
        }
        sh[l] = b / 2;
      }
      r = [o, sh[0], sh[1], sh[2], sh[3]];
      J.cache.set(key, r);
    }
    A.array[i * 3] = r[0];
    A.array[i * 3 + 2] = set;
    S0.array[i * 2] = r[1]; S0.array[i * 2 + 1] = r[2];
    S1.array[i * 2] = r[3]; S1.array[i * 2 + 1] = r[4];
  }

  function ensureAttrs(g) {
    const n = g.attributes.position.count;
    let A = g.attributes.cabA;
    if (!A || A.count !== n) { A = new THREE.BufferAttribute(new Float32Array(n * 3), 3); g.setAttribute('cabA', A); }
    let S0 = g.attributes.cabS0;
    if (!S0 || S0.count !== n) { S0 = new THREE.BufferAttribute(new Float32Array(n * 2), 2); g.setAttribute('cabS0', S0); }
    let S1 = g.attributes.cabS1;
    if (!S1 || S1.count !== n) { S1 = new THREE.BufferAttribute(new Float32Array(n * 2), 2); g.setAttribute('cabS1', S1); }
    return [A, S0, S1];
  }

  const total = spaces.reduce((s, S) => s + S.items.reduce((a, it) => a + (it.mesh.geometry.attributes.position ? it.mesh.geometry.attributes.position.count : 0), 0), 0) || 1;
  let doneV = 0;

  state.step = (ms = 8) => {
    if (state.done) return true;
    const t0 = performance.now();
    while (ji < jobs.length) {
      const J = jobs[ji];
      if (!J.grid) {
        J.grid = buildGrid(J.S);
        J.cache = new Map();
        if (!J.grid) { ji++; continue; }
        if (performance.now() - t0 > ms) return false;
      }
      while (J.mi < J.S.items.length) {
        const it = J.S.items[J.mi];
        const g = it.mesh.geometry;
        if (it.skip || !g.attributes.normal) { J.mi++; continue; }
        const P = g.attributes.position, N = g.attributes.normal;
        const [A, S0, S1] = ensureAttrs(g);
        _nm.getNormalMatrix(it.M);
        while (J.vi < P.count) {
          vertex(J, it, P, N, J.vi, A, S0, S1);
          J.vi++; doneV++;
          if ((J.vi & 255) === 0 && performance.now() - t0 > ms) { state.progress = doneV / total; return false; }
        }
        A.needsUpdate = true; S0.needsUpdate = true; S1.needsUpdate = true;
        J.mi++; J.vi = 0;
      }
      J.grid = null; J.cache = null; // Speicher frei
      ji++;
    }
    state.done = true;
    state.progress = 1;
    state.verts = doneV;
    return true;
  };
  return state;
}

/** Matrix eines Netzes relativ zu einem Bezugsobjekt (beide Weltmatrizen aktuell). */
export function relMatrix(mesh, ref, out = new THREE.Matrix4()) {
  _m.copy(ref.matrixWorld).invert();
  return out.multiplyMatrices(_m, mesh.matrixWorld);
}
