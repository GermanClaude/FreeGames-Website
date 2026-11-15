// NULLPUNKT — Ausgebrannte Autowracks als echte Karosserie (Nutzer 14.11.: „das zivile Auto im Stadtkern ist ein grober
// Quader mit Scheibenrädern“). Gleiche Form wie die fahrbaren Limousinen (vehicles/models-car.js: Querschnitts-Loft,
// Dachaufbau), aber ausgebrannt: Blech verbeult und eingesackt, Dach eingedrückt, keine Scheiben (nur Säulen und Gummireste),
// Reifen abgebrannt (das Wrack sitzt auf den Felgen, schief), Innenraum als verkohlte Sitzgestelle mit Federn, Lenkrad-
// Skelett, Motorhaube aufgebogen. Farbe je Ecke (Vertexfarben × Tönung): verkohlt schwarz, Rost, Asche, an der Unterkante
// und hinten Lackreste des ursprünglichen Farbtons. Statische Weltgeometrie (MapBuilder.geom) → Welt-Shading wie die
// Umgebung; Kollision weiter als einfacher Quader (wie vorher). Nur medium+ (b.quality !== 'low'); low bleibt beim Requisit.
//
// autoWrack(b, x, y, z, ry, { seed, color, style, burnt }) – ry wie Requisiten (lokal +z = Front).
import * as THREE from 'three';
import { bodyLoft, surface, tube, steelRim, alloyRim, merge } from '../vehicles/bodykit.js?v=20261114060746';
import { pkwShape, pkwGreenhouse } from '../vehicles/models-car.js?v=20261114060746';

const PI = Math.PI, HP = PI / 2;
const lerp = (a, b, t) => a + (b - a) * t;

function rng(seed) { let s = Math.abs(Math.floor(seed) * 9301 + 49297) % 233280 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function vhash(x, y, z) { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(vhash(ix, iy, iz), vhash(ix + 1, iy, iz), u), L(vhash(ix, iy + 1, iz), vhash(ix + 1, iy + 1, iz), u), v),
    L(L(vhash(ix, iy, iz + 1), vhash(ix + 1, iy, iz + 1), u), L(vhash(ix, iy + 1, iz + 1), vhash(ix + 1, iy + 1, iz + 1), u), v), w);
}

/** Beulen entlang der Normalen + Einsacken nach oben; danach Vertexfarben (Brand/Rost/Asche/Lackrest). */
function burn(g, seed, paint, { dent = 0.03, sag = 0, roofY = 9, keepPaint = 0.35 } = {}) {
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  ng.computeVertexNormals();
  const P = ng.attributes.position, N = ng.attributes.normal, n = P.count;
  const o = seed * 1.37;
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const d = (vnoise(x * 3.1 + o, y * 3.1, z * 3.1) - 0.5) * 2 * dent + (vnoise(x * 9 + o, y * 9, z * 9) - 0.5) * dent * 0.35;
    let yy = y + N.getY(i) * d;
    if (y > roofY) yy -= sag * (1 - Math.min(1, Math.abs(x) / 0.7) ** 2) * Math.sin(Math.min(1, Math.max(0, (z + 0.3) / 1.4)) * PI);
    P.setXYZ(i, x + N.getX(i) * d, yy, z + N.getZ(i) * d);
  }
  ng.computeVertexNormals();
  const C = new Float32Array(n * 3), pc = new THREE.Color(paint), c = new THREE.Color();
  const CHAR = new THREE.Color(0.07, 0.062, 0.056), RUST = new THREE.Color(0.42, 0.22, 0.11), ASH = new THREE.Color(0.38, 0.36, 0.33);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const r = vnoise(x * 2.3 + o, y * 2.3 + 4, z * 2.3), r2 = vnoise(x * 7 + o, y * 7, z * 7 + 2);
    c.copy(CHAR).lerp(RUST, Math.min(1, Math.max(0, (r - 0.35) * 2.2)) * 0.85);
    c.lerp(ASH, Math.max(0, r2 - 0.6) * 1.6 * (y > 0.9 ? 1 : 0.4));
    // Lackreste unten/hinten (weniger heiß), fleckig
    const keep = Math.max(0, 1 - (y - 0.3) / 0.45) * keepPaint * (vnoise(x * 4 + o, y * 4, z * 4 + 9) > 0.45 ? 1 : 0.2);
    c.lerp(pc.clone().multiplyScalar(0.75), Math.min(0.85, keep));
    C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b;
  }
  ng.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return ng;
}

/** Ausgebranntes Auto; (x, y, z) Boden unter der Mitte, ry wie Requisiten (+z = Front). */
export function autoWrack(b, x, y, z, ry, { seed = 1, color = '#3a3430', style = null } = {}) {
  const r = rng(Math.abs(seed) * 1000 + 7);
  const st = style ?? Math.floor(r() * 3);
  const SH = pkwShape(st), { at, G } = SH;
  const yaw = ry + PI; // Fahrzeugraum: vorn −z
  // Wrack sitzt tiefer (Reifen weg) und schief: eine Seite tiefer
  const drop = -0.2, roll = (r() - 0.5) * 0.08, pitch = (r() - 0.5) * 0.05;
  const place = (geom, mat, tint = '#ffffff') => {
    geom.translate(0, drop, 0);
    geom.rotateZ(roll); geom.rotateX(pitch);
    b.geom(geom, x, y, z, mat, { ry: yaw, tint, collide: false, minimap: false });
  };
  const zs = (a, c, step) => { const o = []; for (let v = a; v < c - 1e-4; v += step) o.push(+v.toFixed(3)); o.push(c); return o; };
  const seedN = seed * 3.7 + 1;
  // Karosserie (verbeult), Dach eingesackt, Haube aufgebogen
  const body = merge([
    bodyLoft(zs(-2.36, -0.99, 0.1), at, { q: 2 }),
    bodyLoft(zs(-0.99, 1.05, 0.14), at, { q: 2, open: true, thick: 0.03 }),
    bodyLoft(zs(1.05, 2.36, 0.1), at, { q: 2 }),
  ]);
  place(burn(body, seedN, color, { dent: 0.025 }), 'metal_rust');
  const ghs = (z0, z1, t0, t1, nu, nv, thick) => surface((u, v) => pkwGreenhouse(SH, lerp(z0, z1, v), lerp(t0, t1, u)), nu, nv, { thick });
  const roof = ghs(G.zA1 - 0.01, G.zC1 + 0.01, -0.5, 0.5, 6, 6, 0.02);
  place(burn(roof, seedN + 2, color, { dent: 0.03, sag: 0.09 + r() * 0.08, roofY: 1.2, keepPaint: 0 }), 'metal_rust');
  const edge = (z0, z1, t, n) => { const p = []; for (let i = 0; i <= n; i++) { const q = pkwGreenhouse(SH, lerp(z0, z1, i / n), t); p.push([q[0], q[1], q[2]]); } return p; };
  const pillars = [];
  for (const sg of [-1, 1]) {
    pillars.push(tube(edge(G.zA0, G.zA1, sg * 0.5, 5), 0.028, 4, 2));
    pillars.push(tube(edge(G.zC1, G.zC0, sg * 0.5, 5), 0.03, 4, 2));
    pillars.push(tube(edge(G.zA1, G.zC1, sg * 0.5, 5), 0.02, 4, 2));
    pillars.push(tube([pkwGreenhouse(SH, G.zB, sg * 0.98), pkwGreenhouse(SH, G.zB, sg * 0.5)], 0.03, 4, 2));
  }
  place(burn(merge(pillars), seedN + 3, color, { dent: 0.01, keepPaint: 0 }), 'metal_rust');
  // Haube: aufgebogen (Spalt vorn), Kotflügelkanten
  const hood = surface((u, v) => { const zz = lerp(-2.2, -1.02, v), s = at(zz), xx = lerp(-s.wt + 0.12, s.wt - 0.12, u); return [xx, s.yt + 0.035 + (1 - v) * 0.09, zz]; }, 6, 5, { thick: 0.015 });
  hood.rotateX(-0.04);
  place(burn(hood, seedN + 4, color, { dent: 0.02, keepPaint: 0.1 }), 'metal_rust');
  // Innenraum: Sitzgestelle mit Federn, Lenkrad-Skelett, Rest des Armaturenträgers
  const frames = [];
  for (const sx of [-0.38, 0.38]) {
    frames.push(tube([[sx - 0.22, 0.52, -0.2], [sx + 0.22, 0.52, -0.2], [sx + 0.22, 0.52, 0.28], [sx - 0.22, 0.52, 0.28], [sx - 0.22, 0.52, -0.2]], 0.012, 3, 2));
    frames.push(tube([[sx - 0.2, 0.52, 0.3], [sx - 0.2, 1.1, 0.42], [sx + 0.2, 1.1, 0.42], [sx + 0.2, 0.52, 0.3]], 0.012, 3, 2));
    for (let k = 0; k < 4; k++) frames.push(tube([[sx - 0.2, 0.5, -0.12 + k * 0.12], [sx, 0.47, -0.12 + k * 0.12], [sx + 0.2, 0.5, -0.12 + k * 0.12]], 0.006, 3, 2));
  }
  frames.push(tube([[-0.7, 0.53, 0.66], [0.7, 0.53, 0.66], [0.7, 1.0, 0.86], [-0.7, 1.0, 0.86], [-0.7, 0.53, 0.66]], 0.012, 3, 2));
  frames.push(new THREE.TorusGeometry(0.18, 0.012, 3, 14).rotateX(-0.43).translate(-0.38, 0.99, -0.52));
  frames.push(tube([[-0.38, 0.99, -0.52], [-0.38, 0.86, -0.78]], 0.02, 4, 1));
  frames.push(tube([[-0.8, 0.88, -0.82], [0.8, 0.88, -0.82]], 0.03, 4, 1));
  place(burn(merge(frames), seedN + 5, '#222', { dent: 0.004, keepPaint: 0 }), 'metal_rust');
  // Felgen (Reifen abgebrannt) – Radmitte tiefer, Drahtreste
  const rims = [];
  for (const wz of [-1.38, 1.43]) for (const sx of [-1, 1]) {
    const ri = 0.21, g = st === 2 ? alloyRim(ri, 0.16, { spokes: 5, twin: true, seg: 14 }).face : steelRim(ri, { holes: 8, seg: 14 });
    if (sx < 0) g.rotateY(PI);
    g.translate(sx * 0.82, ri + 0.2 - (r() * 0.03), wz);
    rims.push(g);
    const bar = new THREE.CylinderGeometry(ri * 0.98, ri * 0.98, 0.16, 14, 1, true).rotateZ(HP).translate(sx * 0.76, ri + 0.2, wz);
    rims.push(bar);
    rims.push(new THREE.TorusGeometry(ri * 1.08, 0.006, 3, 18).rotateY(HP).translate(sx * 0.78, ri + 0.2, wz));
  }
  place(burn(merge(rims), seedN + 6, '#3a2a20', { dent: 0.003, keepPaint: 0 }), 'metal_rust');
}
