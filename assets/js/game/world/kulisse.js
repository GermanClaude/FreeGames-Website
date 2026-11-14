// NULLPUNKT — gfx-welt (14.11.): ferne Ufer-Kulissen (Owner: world). Ersetzt flache Quader am Horizont (Hafen:
// grüne Kästen jenseits des Wassers) durch einen niedrigen Landstreifen mit Uferböschung, Hügelkamm, Baumreihe und
// einzelnen Hallen/Wohnblöcken/Schornsteinen – alles in EINER Geometrie mit Vertexfarben (ein Draw Call, ≈ 4–8 k
// Dreiecke je Streifen, keine Texturen). Nur Optik: keine Kollision, keine Minikarte, kein Schattenwurf; gesät über
// die Lage (gleich bei jedem Laden). Der Dunst der Karte färbt die Kulisse in die Ferne.
//
// farShore(b, { x, z0, z1, depth, h, face: +1|-1, seed, town }) – Streifen entlang z, Ufer bei x (Seite face zeigt
// zum Spielfeld), Tiefe depth landeinwärts, Hügelhöhe h.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const _c = new THREE.Color();
const SRGB = (hex, k = 1) => { _c.set(hex); return [_c.r * k, _c.g * k, _c.b * k]; };

export function farShoreGeometry(o) {
  const r = rng(o.seed ?? 7);
  const P = [], C = [];
  const tri = (a, b, c, ca, cb = ca, cc = ca) => { P.push(...a, ...b, ...c); C.push(...ca, ...cb, ...cc); };
  const quad = (a, b, c, d, ca, cb = ca, cc = cb, cd = ca) => { tri(a, b, c, ca, cb, cc); tri(a, c, d, ca, cc, cd); };
  const f = o.face ?? 1, X = o.x, z0 = o.z0, z1 = o.z1, D = o.depth ?? 60, H = o.h ?? 14, wl = o.water ?? -1.8;
  // Gelände: Spalten alle 6 m, Profil quer: Wasserlinie → Uferkante → Böschungskopf → Kamm → Rückseite
  const cols = Math.max(2, Math.round((z1 - z0) / 6));
  const prof = [[0, wl - 0.6], [2, wl + 0.6], [6, 2.2], [D * 0.45, H * 0.75], [D * 0.75, H], [D, H * 0.6]];
  const rows = [];
  for (let i = 0; i <= cols; i++) {
    const z = z0 + (z1 - z0) * (i / cols);
    const n1 = Math.sin(z * 0.021 + o.seed) * 0.5 + Math.sin(z * 0.057 + o.seed * 2) * 0.3 + (r() - 0.5) * 0.3;
    rows.push(prof.map(([dx, y], k) => [X - f * dx * (k >= 3 ? 1 + n1 * 0.15 : 1), k >= 3 ? y * (1 + n1 * 0.35) : y + (k === 2 ? n1 * 0.6 : 0), z]));
  }
  const col = [SRGB('#5d574c'), SRGB('#6b6455'), SRGB('#5f6a45'), SRGB('#53603d'), SRGB('#4b5838'), SRGB('#46523a')];
  for (let i = 0; i < cols; i++) for (let k = 0; k < prof.length - 1; k++) {
    const a = rows[i][k], b = rows[i + 1][k], c = rows[i + 1][k + 1], d = rows[i][k + 1];
    const v = 0.85 + r() * 0.3, ca = col[k].map((x) => x * v), cd = col[k + 1].map((x) => x * v);
    if (f > 0) quad(a, d, c, b, ca, cd, cd, ca); else quad(a, b, c, d, ca, ca, cd, cd);
  }
  const yAt = (dx, z) => { // Geländehöhe (grob) für Aufbauten
    const i = Math.max(0, Math.min(cols, Math.round((z - z0) / ((z1 - z0) / cols))));
    const row = rows[i];
    for (let k = 0; k < row.length - 1; k++) { const xa = Math.abs(row[k][0] - X), xb = Math.abs(row[k + 1][0] - X); if (dx >= xa && dx <= xb) return row[k][1] + (row[k + 1][1] - row[k][1]) * ((dx - xa) / Math.max(1e-3, xb - xa)); }
    return row[row.length - 1][1];
  };
  // Baumkronen: geduckte Ikosaeder-Büschel in Gruppen (Waldstücke) + einzelne Pappeln
  const ico0 = new THREE.IcosahedronGeometry(1, 1), ico = ico0.index ? ico0.toNonIndexed() : ico0, ip = ico.attributes.position;
  const tree = (x, y, z, rad, hgt, hex) => {
    const base = SRGB(hex, 0.8 + r() * 0.35);
    for (let i = 0; i < ip.count; i += 3) {
      const pts = [0, 1, 2].map((k) => [x + ip.getX(i + k) * rad, y + hgt * 0.55 + ip.getY(i + k) * hgt * 0.5, z + ip.getZ(i + k) * rad]);
      const up = (ip.getY(i) + ip.getY(i + 1) + ip.getY(i + 2)) / 3; // oben heller, unten dunkler
      const k = 0.7 + up * 0.3;
      tri(pts[0], pts[1], pts[2], base.map((c) => c * k));
    }
  };
  const greens = ['#3f5233', '#465a35', '#394b30', '#506038', '#3b4a35'];
  for (let z = z0 + 4; z < z1 - 4; z += 3 + r() * 6) {
    if (r() < 0.25) { z += 10 + r() * 20; continue; } // Lücken
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const dx = 8 + r() * (D * 0.8), zz = z + (r() - 0.5) * 6, y = yAt(dx, zz);
      if (r() < 0.12) tree(X - f * dx, y, zz, 1.6 + r() * 0.6, 14 + r() * 6, '#4a5a34'); // Pappel
      else tree(X - f * dx, y, zz, 3 + r() * 3, 7 + r() * 6, greens[Math.floor(r() * greens.length)]);
    }
  }
  // Ortschaft/Gewerbe: Quader mit Dach, Schornsteine
  const box = (cx, y, cz, w, h, d, hex, roof) => {
    const c = SRGB(hex), cs = c.map((x) => x * 0.72), ct = roof ? SRGB(roof) : c.map((x) => x * 1.08);
    const x0 = cx - w / 2, x1 = cx + w / 2, za = cz - d / 2, zb = cz + d / 2, y1 = y + h;
    quad([x0, y, zb], [x1, y, zb], [x1, y1, zb], [x0, y1, zb], c); // +z
    quad([x1, y, za], [x0, y, za], [x0, y1, za], [x1, y1, za], c); // -z
    quad([x1, y, zb], [x1, y, za], [x1, y1, za], [x1, y1, zb], f > 0 ? c : cs); // +x
    quad([x0, y, za], [x0, y, zb], [x0, y1, zb], [x0, y1, za], f > 0 ? cs : c); // -x
    quad([x0, y1, zb], [x1, y1, zb], [x1, y1, za], [x0, y1, za], ct); // Dach
  };
  if (o.town) {
    const walls = ['#a9a69e', '#b8b0a2', '#8f939a', '#c9c4b8', '#9a8f80', '#7d8288'];
    for (let z = z0 + 10; z < z1 - 10; z += 8 + r() * 18) {
      if (r() < 0.35) continue;
      const dx = 10 + r() * D * 0.5, w = 8 + r() * 18, d = 10 + r() * 22, h = 5 + r() * (r() < 0.2 ? 22 : 9);
      const y = yAt(dx, z) - 1;
      box(X - f * (dx + w / 2), y, z, w, h, d, walls[Math.floor(r() * walls.length)], r() < 0.5 ? '#6f5246' : '#5e6266');
      if (r() < 0.12) box(X - f * (dx + w / 2), y + h, z + d * 0.3, 1.6, 12 + r() * 14, 1.6, '#8a7f74');
    }
  }
  ico.dispose(); ico0.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

let mat = null;
export function farShore(b, o) {
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    mat.name = 'kulisse'; mat.userData.surface = 'grass';
  }
  const mesh = new THREE.Mesh(farShoreGeometry(o), mat);
  mesh.name = 'kulisse-ufer'; mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  b.object(mesh);
  return mesh;
}
