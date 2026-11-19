// NULLPUNKT — Zerbrechliche Requisiten der Welt (zerstoerung 15.11.): Zugriff auf die beim Bau gemerkten Dreiecke
// (builder.js beginBreak/endBreak) – zerbricht eine Kiste, ein Palettenstapel oder ein Zaunfeld, schaltet disable(rec)
// genau dessen Dreiecke ab: Kugel-BVH und Kollisions-BVH (disableOrig, wie gefällte Bäume), Kapsel-Octree (Dreiecke
// weit unter die Karte verlegt – nicht entartet, damit die Ebenenrechnung des Octrees endlich bleibt) und die Optik
// (Eckpunkte des Bereichs auf einen Punkt gezogen, nur dieser Pufferausschnitt wird neu hochgeladen).
// Navigation bleibt unberührt (Graph aus dem Bau): wo eine Kiste stand, fehlen höchstens ein paar Knoten.
import * as THREE from 'three';

/**
 * @param {Array} recs   builder.breakables (mit vis/col/bul aufgelöst)
 * @param {object} o     { cbvh, bvh, octree, colOff = 0, bulOff = 0 }
 */
export function breakableAccess(recs, { cbvh = null, bvh = null, octree = null, colOff = 0, bulOff = 0 } = {}) {
  const list = (recs || []).filter((r) => r && (r.vis.length || r.col.length));
  for (const r of list) { r.colOff = colOff; r.bulOff = bulOff; }
  return { list, disable: (r) => disableRec(r, { cbvh, bvh, octree }) };
}

/** Mehrere Zugänge (Großkarten: je Ort ein Builder) zu einem zusammenfassen – Ids fortlaufend. */
export function mergeAccess(parts) {
  const list = [], by = new Map();
  for (const p of parts) for (const r of p.list) { by.set(r, p); list.push(r); }
  return { list, disable: (r) => { const p = by.get(r); if (p) p.disable(r); } };
}

const FAR = -1e4;
function disableRec(r, { cbvh, bvh, octree }) {
  if (!r || r.off) return;
  r.off = true;
  const co = r.colOff || 0, bo = r.bulOff || 0;
  for (const [s, n] of r.col) {
    if (cbvh && typeof cbvh.disableOrig === 'function') cbvh.disableOrig(co + s, n);
    const all = octree && octree.allTris;
    if (all) for (let k = co + s; k < co + s + n && k < all.length; k++) { const t = all[k]; t.a.set(0, FAR, 0); t.b.set(1, FAR, 0); t.c.set(0, FAR, 1); }
  }
  if (bvh && typeof bvh.disableOrig === 'function' && r.bul) for (const [s, n] of r.bul) bvh.disableOrig(bo + s, n);
  for (const [mesh, v0, vn] of r.vis) {
    const pa = mesh && mesh.geometry && mesh.geometry.attributes.position;
    if (!pa) continue;
    const a = pa.array, x = a[v0 * 3], y = a[v0 * 3 + 1], z = a[v0 * 3 + 2];
    for (let v = v0; v < v0 + vn; v++) { a[v * 3] = x; a[v * 3 + 1] = y; a[v * 3 + 2] = z; }
    if (typeof pa.addUpdateRange === 'function') pa.addUpdateRange(v0 * 3, vn * 3);
    pa.needsUpdate = true;
  }
}

/** Mittelpunkt (Welt) einer Requisite. */
export function recCenter(r, out = new THREE.Vector3()) { return out.set(r.x, r.y + r.h / 2, r.z); }
