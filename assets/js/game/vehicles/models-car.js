// NULLPUNKT — Karosserie der Limousine/Kombi/Schrägheck als Unterteilungsfläche (Nutzer 15.11.: „immer noch absolut
// unrealistisch und kastig“; vorher Querschnitts-Loft mit flacher Haubenplatte, Dachkante und Silberstreifen).
//
// Nur medium+ (K.HQ) und nur Nahstufen 0/1 – low und die Fernstufe 2 behalten die Profil-Extrusion aus models-civil.js
// (Dreiecke auf dem Handy unverändert). Form aus carbody.js (Kontrollkäfig → Catmull-Clark):
//   high/ultra Stufe 0: zwei Unterteilungen (≈ 28 000 Dreiecke Blech/Glas), Stufe 1 und medium: eine (≈ 6 400).
// Scheiben bündig mit Siebdruckrand, Leuchten/Grill als Flächen derselben Haut, Fugen als feine Bänder, Innenhaut
// (Türverkleidung/Himmel) – dazu Anbauteile: Spiegel, Griffmulden, Wischer, Antenne, Tankklappe, Kennzeichen (erfunden),
// Grill-Lamellen, Projektoren/Tagfahrlicht, Rückleuchten-Kammern, Auspuff, Unterboden, Radhausschalen, Dachreling (Kombi).
// Bauform je Variante (Lack bleibt variant % 8): Stufenheck, Kombi, Schrägheck – gleiche Maße/Kollision/Sitze (data.js).
//
// pkwBodyHQ(K, S, B, GB, LB, lod, paint, variant) füllt die Buckets (Lack/Kleinteile B, Glas GB, Scheinwerfer LB).
// addCarBody(R, S, B, GB, LB, paint) – Teile einer carbody-Karosserie in die Buckets (auch Kastenwagen/Lkw).
import * as THREE from 'three';
import { tube, roundPlate } from './bodykit.js?v=20261121041936';
import { pkwBody, pkwShape, TAG, softBox } from './carbody.js?v=20261121041936';

const PI = Math.PI, HP = PI / 2;
const lerp = (a, b, t) => a + (b - a) * t;

/** Bauform aus der Variante (entkoppelt von der Farbe): 0 Stufenheck, 1 Kombi, 2 Schrägheck. */
export const pkwStyle = (variant) => [0, 1, 2, 0, 2, 1, 0, 1][(variant | 0) % 8];

/* ------------------------------------------------------------------ Kennzeichen (erfunden) */

const PLATES = new Map();
/** Kennzeichen-Material je Variante: weißes Schild, blauer Länderstreifen „NP“, frei erfundene Kennung. */
export function plateMaterial(variant, S) {
  const k = (variant | 0) % 8;
  if (PLATES.has(k)) return PLATES.get(k);
  let m = S.plate;
  try {
    const c = document.createElement('canvas'); c.width = 256; c.height = 56;
    const g = c.getContext('2d');
    g.fillStyle = '#ecebe4'; g.fillRect(0, 0, 256, 56);
    g.strokeStyle = '#1b1b1b'; g.lineWidth = 3; g.strokeRect(2.5, 2.5, 251, 51);
    g.fillStyle = '#23409a'; g.fillRect(4, 4, 26, 48);
    g.fillStyle = '#f2d24a';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; g.beginPath(); g.arc(17 + Math.cos(a) * 7, 19 + Math.sin(a) * 7, 1.3, 0, 7); g.fill(); }
    g.fillStyle = '#ffffff'; g.font = '700 13px sans-serif'; g.textAlign = 'center'; g.fillText('NP', 17, 46);
    const towns = ['LH', 'GR', 'AS', 'HF', 'BW', 'SK', 'NL', 'FP'];
    const num = String(1000 + ((k * 2753 + 417) % 8999));
    g.fillStyle = '#141414'; g.font = '700 34px monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(`${towns[k]}·${'KMRTZ'[k % 5]} ${num}`, 38, 30);
    g.fillStyle = '#7a8a3a'; g.beginPath(); g.arc(112, 28, 6, 0, 7); g.fill();
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(90,80,60,${Math.random() * 0.08})`; g.fillRect(Math.random() * 256, 30 + Math.random() * 26, 2 + Math.random() * 6, 1 + Math.random() * 3); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    m = new THREE.MeshStandardMaterial({ name: `veh:kennzeichen${k}`, map: t, roughness: 0.42, metalness: 0.15 });
  } catch { /* ohne DOM: einfarbig */ }
  PLATES.set(k, m);
  return m;
}

/* ------------------------------------------------------------------ Teile einer carbody-Karosserie */

/** Materialien je Flächenmarke. */
export function bodyMaterials(S, paint) {
  return new Map([
    [TAG.PAINT, ['B', paint]], [TAG.GLASS, ['GB', S.carGlass]], [TAG.FRIT, ['B', S.frit]], [TAG.TRIM, ['B', S.gloss]],
    [TAG.LAMP, ['LB', S.lensOff]], [TAG.RLAMP, ['B', S.rearLamp]], [TAG.GRILLE, ['B', S.plastic]], [TAG.PLASTIC, ['B', S.grain]],
    [TAG.CHROME, ['B', S.chrome]], [TAG.AMBER, ['B', S.amber]], [TAG.DARK, ['B', S.dark]],
  ]);
}

/** Karosserie-Teile R (carbody) in die Buckets; over: Map(marke → Material) überschreibt einzelne Zuordnungen. */
export function addCarBody(R, S, B, GB, LB, paint, over = null) {
  const M = bodyMaterials(S, paint), BK = { B, GB, LB };
  for (const [t, g] of R.parts) {
    const [bk, mat] = (over && over.has(t)) ? ['B', over.get(t)] : (M.get(t) || ['B', paint]);
    if (bk === 'GB') GB.add(g, mat);
    else if (bk === 'LB') LB.add(g, mat, null, null, null, { tag: { lens: true } });
    else BK[bk].add(g, mat);
  }
  if (R.seams) B.add(R.seams, S.seam);
  if (R.inner) { B.add(R.inner.trim, S.trim); B.add(R.inner.dark, S.interior); }
}

/** Treffer auf einer Teilfläche (Raycast): → { p: [x,y,z], n: [x,y,z] } oder null. */
const PROBES = new Map();
/** Treffer werden je Karosserie (key) gemerkt – die Varianten (Lackfarben) einer Bauform fragen dieselben Punkte ab. */
export function surfaceProbe(geoms, key = null) {
  const memo = key ? (PROBES.get(key) || PROBES.set(key, new Map()).get(key)) : null;
  let meshes = null;
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3();
  const cast = (origin, dir) => {
    if (!meshes) meshes = geoms.filter(Boolean).map((g) => { const m = new THREE.Mesh(g, mat); g.computeBoundingSphere(); m.updateMatrixWorld(true); return m; });
    rc.set(o.fromArray(origin), d.fromArray(dir).normalize());
    const hit = rc.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const n = hit.face.normal.clone();
    if (n.dot(d) > 0) n.negate();
    return { p: [hit.point.x, hit.point.y, hit.point.z], n: [n.x, n.y, n.z] };
  };
  return (origin, dir) => {
    if (!memo) return cast(origin, dir);
    const k = `${origin.map((v) => v.toFixed(4))}|${dir.map((v) => v.toFixed(4))}`;
    if (!memo.has(k)) memo.set(k, cast(origin, dir));
    const r = memo.get(k);
    return r ? { p: r.p.slice(), n: r.n.slice() } : null;
  };
}

/** Euler-Drehung, die +z auf die Normale n dreht (für flache Anbauteile auf gewölbten Flächen). */
function alignZ(n) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n[0], n[1], n[2]));
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

/** Gedrungene, weiche Schale (Spiegelgehäuse, Antennenfuß): Kugel gestaucht, hinten abgeschnitten. */
function shell(rx, ry, rz, seg = 14) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg >> 1), 0, PI * 2, 0, PI);
  g.scale(rx, ry, rz);
  return g;
}

/* ------------------------------------------------------------------ Aufbau */

export function pkwBodyHQ(K, S, B, GB, LB, lod, paint, variant) {
  const style = pkwStyle(variant);
  const level = lod === 0 && K.DET >= 2 ? 2 : 1;
  const fine = level >= 2;
  const R = pkwBody(style, level), SH = R.meta, { G } = SH;
  const probe = surfaceProbe([R.parts.get(TAG.PAINT), R.parts.get(TAG.GLASS), R.parts.get(TAG.FRIT), R.parts.get(TAG.PLASTIC), R.parts.get(TAG.GRILLE), R.parts.get(TAG.LAMP), R.parts.get(TAG.TRIM), R.parts.get(TAG.RLAMP)], `pkw:${style}:${level}`);
  const hitSide = (sx, y, z) => probe([sx * 2, y, z], [-sx, 0, 0]);
  const hitFront = (x, y) => probe([x, y, -4], [0, 0, 1]);
  const hitRear = (x, y) => probe([x, y, 4], [0, 0, -1]);
  const hitTop = (x, z) => probe([x, 3, z], [0, -1, 0]);

  // Anbauteile zuerst (Treffer auf der Haut), dann die Haut selbst in die Buckets
  // Außenspiegel: Fuß am Türdreieck, Gehäuse in Wagenfarbe, Spiegelglas, Blinker
  for (const sx of [-1, 1]) {
    const h = hitSide(sx, G.top(G.zA0) + 0.03, G.zA0 + 0.13) || { p: [sx * 0.84, 0.97, G.zA0 + 0.13], n: [sx, 0, 0] };
    const base = h.p;
    B.add(roundPlate(0.06, 0.08, 0.14, 0.02), S.gloss, [base[0] + sx * 0.03, base[1] + 0.02, base[2] + 0.02], [0, 0, -sx * 0.25]);
    const c = [base[0] + sx * 0.15, base[1] + 0.07, base[2] + 0.04];
    B.add(softBox(0.22, 0.11, 0.09, { crease: 0, levels: fine ? 2 : 1 }), paint, c, [0, -sx * 0.12, 0]);
    B.add(roundPlate(0.19, 0.085, 0.006, 0.035), S.chrome, [c[0] + sx * 0.004, c[1], c[2] + 0.046], [0, -sx * 0.12, 0]);
    if (fine) B.add(roundPlate(0.07, 0.014, 0.02, 0.006), S.amber, [c[0] + sx * 0.07, c[1] - 0.035, c[2] - 0.02], [0, -sx * 0.4, 0]);
  }
  // Türgriffe (Griffmulde dunkel + Griff in Wagenfarbe), Tankklappe, Seitenblinker
  for (const sx of [-1, 1]) for (const z of [-0.36, 0.62]) {
    const h = hitSide(sx, 0.855, z);
    if (!h) continue;
    const rot = alignZ(h.n);
    B.add(roundPlate(0.17, 0.045, 0.004, 0.02), S.seam, [h.p[0] + h.n[0] * 0.001, h.p[1], h.p[2]], rot);
    B.add(roundPlate(0.15, 0.03, 0.022, 0.014, 0.006), paint, [h.p[0] + h.n[0] * 0.011, h.p[1] + 0.004, h.p[2]], rot);
  }
  {
    const h = hitSide(1, 0.87, 1.66);
    if (h && fine) {
      B.add(new THREE.CircleGeometry(0.075, 20), paint, [h.p[0] + h.n[0] * 0.003, h.p[1], h.p[2]], alignZ(h.n));
      B.add(new THREE.TorusGeometry(0.077, 0.0025, 3, 24), S.seam, [h.p[0] + h.n[0] * 0.002, h.p[1], h.p[2]], alignZ(h.n));
    }
  }
  if (fine) for (const sx of [-1, 1]) { const h = hitSide(sx, 0.74, -1.84); if (h) B.add(roundPlate(0.07, 0.022, 0.012, 0.01), S.amber, [h.p[0] + h.n[0] * 0.004, h.p[1], h.p[2]], alignZ(h.n)); }

  // Front: Kennzeichen, Grill-Lamellen, Projektoren + Tagfahrlicht-Leiste, Nebelscheinwerfer
  {
    const h = hitFront(0, 0.47);
    const z = h ? h.p[2] : -2.36;
    B.add(new THREE.PlaneGeometry(0.52, 0.112), plateMaterial(variant, S), [0, 0.47, z - 0.012], [0, PI, 0], null, { keepUV: true });
    B.add(roundPlate(0.54, 0.125, 0.012, 0.008), S.grain, [0, 0.47, z - 0.005]);
    // Grill: horizontale Lamellen + Rahmen
    const gTop = 0.69, gBot = 0.545, n = fine ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const y = lerp(gBot + 0.012, gTop - 0.015, i / (n - 1));
      const pts = [];
      for (let k = 0; k <= 8; k++) { const x = lerp(-0.42, 0.42, k / 8), q = hitFront(x, y); pts.push(q ? [x, y, q.p[2] - 0.006] : [x, y, -2.355]); }
      B.add(tube(pts, 0.0065, 4, 2), S.dark);
    }
    if (fine) {
      const pts = [];
      for (let k = 0; k <= 10; k++) { const x = lerp(-0.4, 0.4, k / 10), q = hitFront(x, 0.375); pts.push(q ? [x, 0.375, q.p[2] - 0.004] : [x, 0.375, -2.35]); }
      B.add(tube(pts, 0.006, 4, 2), S.dark);
    }
    for (const sx of [-1, 1]) {
      const lc = hitFront(sx * 0.66, 0.648);
      if (!lc) continue;
      const rot = alignZ(lc.n);
      if (fine) {
        // zwei Projektoren (Chrom-Reflektor mit Linsenring), klein im Scheinwerferglas
        for (const dx of [-0.075, 0.06]) {
          const q = hitFront(sx * 0.66 + sx * dx, 0.655) || lc;
          B.add(new THREE.CircleGeometry(0.026, 18), S.chrome, [q.p[0] + q.n[0] * 0.003, q.p[1], q.p[2] + q.n[2] * 0.003], alignZ(q.n));
          B.add(new THREE.TorusGeometry(0.028, 0.003, 4, 22), S.lensOff, [q.p[0] + q.n[0] * 0.004, q.p[1], q.p[2] + q.n[2] * 0.004], alignZ(q.n));
        }
      }
      const fg = hitFront(sx * 0.66, 0.365);
      if (fg) B.add(roundPlate(0.11, 0.045, 0.012, 0.02), S.lensOff, [fg.p[0], fg.p[1], fg.p[2] - 0.005], rot);
    }
  }
  // Heck: Kennzeichen, Leuchten-Kammern (Rückfahr-/Blinkerfeld), Reflektoren, Auspuff, Diffusor-Leiste
  {
    const py = 0.68, h = hitRear(0, py), z = h ? h.p[2] : 2.36;
    B.add(new THREE.PlaneGeometry(0.52, 0.112), plateMaterial(variant, S), [0, py, z + 0.012], null, null, { keepUV: true });
    B.add(roundPlate(0.56, 0.135, 0.012, 0.01), S.grain, [0, py, z + 0.005]);
    if (fine) for (const sx of [-1, 1]) {
      const q = hitRear(sx * 0.62, 0.8);
      if (q) {
        const rot = alignZ(q.n);
        B.add(roundPlate(0.12, 0.035, 0.006, 0.01), S.lensOff, [q.p[0] + q.n[0] * 0.004, q.p[1] - 0.02, q.p[2] + q.n[2] * 0.004], rot);
        B.add(roundPlate(0.2, 0.012, 0.006, 0.005), S.amber, [q.p[0] + q.n[0] * 0.004, q.p[1] + 0.03, q.p[2] + q.n[2] * 0.004], rot);
      }
      const rf = hitRear(sx * 0.6, 0.4);
      if (rf) B.add(roundPlate(0.11, 0.025, 0.006, 0.01), S.rearLamp, [rf.p[0], rf.p[1], rf.p[2] + 0.004], alignZ(rf.n));
    }
    const ex = hitRear(0.5, 0.38);
    const ez = ex && ex.p[2] > 2 ? ex.p[2] : 2.33;
    B.add(new THREE.CylinderGeometry(0.036, 0.04, 0.22, fine ? 16 : 8, 1, true), S.chrome, [0.5, 0.3, ez - 0.07], [HP, 0, 0]);
    B.add(new THREE.CircleGeometry(0.034, fine ? 16 : 8), S.dark, [0.5, 0.3, ez - 0.04]);
  }
  // Wischer (auf dem Windlauf), Haifisch-Antenne, Dachreling (Kombi), dritte Bremsleuchte
  if (fine) {
    for (const [x0, x1] of [[-0.62, -0.06], [0.08, 0.6]]) {
      const pts = [];
      for (let k = 0; k <= 6; k++) { const x = lerp(x0, x1, k / 6), q = probe([x, 2, G.zA0 + 0.12], [0, -0.35, -1]); pts.push(q ? [q.p[0], q.p[1] + 0.012, q.p[2] + 0.01] : [x, 0.97, G.zA0 + 0.06]); }
      B.add(tube(pts, 0.006, 4, 1), S.dark);
      B.add(tube([pts[0], [pts[0][0], pts[0][1] - 0.01, pts[0][2] + 0.04]], 0.009, 4, 1), S.dark);
    }
    const an = hitTop(0, G.zC1 - 0.16) || { p: [0, 1.44, G.zC1 - 0.16] };
    B.add(shell(0.03, 0.055, 0.1, 12), S.gloss, [an.p[0], an.p[1] + 0.005, an.p[2]]);
  }
  if (style === 1 && fine) {
    for (const sx of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 10; k++) { const z = lerp(G.zA1 + 0.15, G.zC1 - 0.05, k / 10), q = hitTop(sx * 0.53, z); pts.push([sx * 0.53, (q ? q.p[1] : 1.44) + 0.045, z]); }
      B.add(tube(pts, 0.014, 6, 2), S.gloss);
      for (const k of [0, 5, 10]) B.add(roundPlate(0.03, 0.05, 0.07, 0.01), S.gloss, [pts[k][0], pts[k][1] - 0.025, pts[k][2]]);
    }
  }
  // Radhausschalen (Kunststoff, innen sichtbar) – Halbröhren in den Radläufen
  for (const ar of SH.arches) for (const sx of [-1, 1]) {
    const g = new THREE.CylinderGeometry(ar.R - 0.012, ar.R - 0.012, 0.22, fine ? 20 : 10, 1, true, 0, PI);
    const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.computeVertexNormals();
    B.add(g, S.grain, [sx * 0.66, ar.y, ar.z], [0, 0, HP]);
  }
  // Unterboden: Bodenblech, Tank, Auspuffanlage, Achsen
  B.add(K.box(1.56, 0.03, 4.0), S.dark, [0, 0.285, 0.0]);
  if (fine) {
    B.add(K.box(0.7, 0.18, 0.5), S.dark, [-0.1, 0.35, 0.85]);
    B.add(tube([[0.12, 0.27, -1.6], [0.16, 0.25, -0.6], [0.2, 0.25, 0.6], [0.4, 0.29, 1.7], [0.5, 0.3, 2.2]], 0.028, 6, 3), S.dark);
    B.add(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 12), S.dark, [0.38, 0.29, 1.85], [HP, 0, 0], [1.4, 1, 0.75]);
    B.add(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), S.dark, [0, 0.32, 1.43], [0, 0, HP]);
    B.add(K.box(1.1, 0.08, 0.3), S.dark, [0, 0.34, -1.38]);
  }
  addCarBody(R, S, B, GB, LB, paint);
}

export { pkwShape };
