// NULLPUNKT — Panzersimulation: feste Stellungen als Ziele (Pak mit Schutzschild, Feldbunker mit MG-Scharte).
// Sie erben von Vehicle (vehicle.js): Treffer über Vehicle.raycast (Granaten, MG, Explosionen, Rammen), Schaden/Wrack über
// applyDamage/destroy, Wärmebild/Minikarte wie Fahrzeuge – aber ohne Sitze, Physik und Motor (eigener Takt).
// Bedienung: ein Bot des Gegners steht an der Stellung (crew). Fällt er, schweigt die Waffe.
//   Pak:    richtet sich auf das nächste feindliche Fahrzeug in Sicht (≤ 900 m, Schwenkbereich ±30°) und schießt alle ~7 s
//           eine Panzergranate (Modus-Munition der Generation) mit Streuung, die sich mit jedem Schuss verringert
//   Bunker: MG-Feuerstöße auf ungedeckte Gegner (Infanterie, offene Luken) ≤ 380 m
// Panzer-Kampagne (19.11.): Funkstelle, Nachschublager, Behelfsbrücke – feste Ziele ohne Bedienung (nur Granaten wirken).
// Typen werden zur Laufzeit in VEHICLES angelegt (registerEmplacements), nicht in data.js → keine Netz-Indizes.
import * as THREE from 'three';
import { VEHICLES, VEHICLE_WEAPONS } from '../data.js?v=20261121041936';
import { Vehicle } from '../vehicle.js?v=20261121041936';
import { vehicleMaterials } from '../materials.js?v=20261121041936';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

const BASE = () => {
  const j = VEHICLES.jeep;
  return { wheels: { ...j.wheels }, engine: { ...j.engine }, grip: { ...j.grip }, drag: 1, angularDamp: 3 };
};

export function registerEmplacements() {
  if (VEHICLES.psim_pak) return;
  VEHICLES.psim_pak = {
    id: 'psim_pak', name: 'Pak-Stellung', cls: 'Panzerabwehrkanone', drive: 'static', model: 'psim_pak', sound: null,
    health: 140, armored: false, respawn: 1e9, wreckTime: 1e9, smallArmsMult: 0.35, explosiveMult: 1.4, ramMult: 2,
    mass: 1800, com: [0, 0.5, 0], hullBox: [0, 0.6, 0.2, 1.05, 0.6, 1.6], zones: { hull: { label: 'Geschütz', hp: 140 } },
    seats: [], emplacement: 'pak', ...BASE(),
  };
  VEHICLES.psim_bunker = {
    id: 'psim_bunker', name: 'Feldbunker', cls: 'Bunker', drive: 'static', model: 'psim_bunker', sound: null,
    health: 900, armored: false, respawn: 1e9, wreckTime: 1e9, smallArmsMult: 0, explosiveMult: 0.6, ramMult: 0.05,
    mass: 9e6, com: [0, 1.1, 0], hullBox: [0, 1.15, 0, 2.6, 1.15, 2.3], zones: { hull: { label: 'Bunker', hp: 900 } },
    seats: [], emplacement: 'bunker', ...BASE(),
  };
  // Panzer-Kampagne: weitere Einrichtungen (ohne Bedienung): Funkstelle, Nachschublager, Behelfsbrücke
  VEHICLES.psim_funk = {
    id: 'psim_funk', name: 'Funkstelle', cls: 'Funkstelle', drive: 'static', model: 'psim_funk', sound: null,
    health: 260, armored: false, respawn: 1e9, wreckTime: 1e9, smallArmsMult: 0.12, explosiveMult: 1.2, ramMult: 1.5,
    mass: 9e6, com: [0, 1.2, 0], hullBox: [0, 1.25, 0, 1.35, 1.25, 2.7], zones: { hull: { label: 'Funkstelle', hp: 260 } },
    seats: [], emplacement: 'funk', ...BASE(),
  };
  VEHICLES.psim_lager = {
    id: 'psim_lager', name: 'Nachschublager', cls: 'Nachschublager', drive: 'static', model: 'psim_lager', sound: null,
    health: 320, armored: false, respawn: 1e9, wreckTime: 1e9, smallArmsMult: 0.1, explosiveMult: 1.6, ramMult: 1.5,
    mass: 9e6, com: [0, 0.8, 0], hullBox: [0, 0.85, 0, 3.6, 0.85, 3.0], zones: { hull: { label: 'Lager', hp: 320 } },
    seats: [], emplacement: 'lager', ...BASE(),
  };
  VEHICLES.psim_bruecke = {
    id: 'psim_bruecke', name: 'Behelfsbrücke', cls: 'Brücke', drive: 'static', model: 'psim_bruecke', sound: null,
    health: 620, armored: false, respawn: 1e9, wreckTime: 1e9, smallArmsMult: 0, explosiveMult: 0.8, ramMult: 0.05,
    mass: 9e6, com: [0, 0.9, 0], hullBox: [0, 0.75, 0, 2.3, 0.75, 8.2], zones: { hull: { label: 'Brücke', hp: 620 } },
    seats: [], emplacement: 'bruecke', ...BASE(),
  };
  VEHICLE_WEAPONS.psim_bunker_mg = {
    id: 'psim_bunker_mg', name: 'Bunker-MG', short: 'MG', kind: 'mg', caliber: '762x51', rpm: 700, mag: 250, reload: 6, spread: 0.012, range: 380, profile: 'lmg',
    damage: { max: 30, min: 20, rangeStart: 40, rangeEnd: 300 }, headMult: 1.6, limbMult: 0.9, penetration: 0.35, vehicleMult: 0.3, tracerEvery: 3, icon: 'mg',
  };
}

/* --------------------------------------------------------------------- Modelle */

let MAT = null;
function mats() {
  if (MAT) return MAT;
  const S = vehicleMaterials();
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8c8a83'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { const v = 110 + Math.random() * 60; g.fillStyle = `rgba(${v},${v - 2},${v - 8},0.35)`; g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  g.strokeStyle = 'rgba(60,58,52,0.5)'; g.lineWidth = 1;
  for (let y = 16; y < 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y + (Math.random() - 0.5) * 3); g.stroke(); } // Schalbretter
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  MAT = {
    concrete: new THREE.MeshStandardMaterial({ name: 'psim:beton', color: 0xb8b4aa, map: tex, roughness: 0.95, metalness: 0 }),
    dark: new THREE.MeshStandardMaterial({ name: 'psim:scharte', color: 0x050505, roughness: 1 }),
    sand: S.sack, net: S.canvas, steel: S.dark, paint: S.paint.B, rubber: S.rubber, wood: S.wood, wreck: S.wreck,
  };
  return MAT;
}

function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function sandbags(root, M, cx, cz, r0, a0, a1, rows = 2) {
  const g = new THREE.CapsuleGeometry(0.17, 0.42, 2, 6).rotateZ(Math.PI / 2).scale(1, 0.62, 0.95);
  for (let row = 0; row < rows; row++) {
    const r = r0 - row * 0.08, n = Math.max(3, Math.round(((a1 - a0) * r) / 0.58));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * (i + (row % 2) * 0.5)) / (n + 0.5);
      root.add(mesh(g, M.sand, cx + Math.sin(a) * r, 0.12 + row * 0.2, cz - Math.cos(a) * r, 0, -a + (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.08));
    }
  }
}

function pakModel(team) {
  const M = mats();
  const root = new THREE.Group(); root.name = 'psim:pak';
  const gun = new THREE.Group(); gun.name = 'pak:schwenk'; gun.position.set(0, 0.62, 0); root.add(gun);
  // Schutzschild (gekantet), Wiege, Rohr mit Mündungsbremse, Räder, gespreizte Holme
  const shieldMat = M.paint;
  gun.add(mesh(new THREE.BoxGeometry(1.7, 0.95, 0.025), shieldMat, 0, 0.3, -0.25, -0.12));
  for (const s of [-1, 1]) gun.add(mesh(new THREE.BoxGeometry(0.45, 0.85, 0.025), shieldMat, s * 1.02, 0.26, -0.12, -0.12, s * 0.5));
  gun.add(mesh(new THREE.BoxGeometry(0.5, 0.22, 0.02), shieldMat, 0, 0.84, -0.28, -0.5));
  const barrel = new THREE.Group(); barrel.name = 'pak:rohr'; barrel.position.set(0, 0.32, 0); gun.add(barrel);
  barrel.add(mesh(new THREE.BoxGeometry(0.26, 0.24, 1.1), M.steel, 0, 0, 0.25));
  barrel.add(mesh(new THREE.CylinderGeometry(0.055, 0.07, 2.9, 12).rotateX(Math.PI / 2), M.steel, 0, 0.02, -1.65));
  barrel.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 12).rotateX(Math.PI / 2), M.steel, 0, 0.02, -3.12));
  barrel.add(mesh(new THREE.BoxGeometry(0.2, 0.06, 0.18), M.steel, 0, 0.02, -3.12));
  barrel.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 10).rotateX(Math.PI / 2), M.steel, 0, -0.14, -0.3)); // Rücklaufbremse
  const wheelG = new THREE.CylinderGeometry(0.42, 0.42, 0.16, 18).rotateZ(Math.PI / 2);
  for (const s of [-1, 1]) {
    root.add(mesh(wheelG, M.rubber, s * 0.82, 0.42, 0.05));
    root.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 10).rotateZ(Math.PI / 2), M.steel, s * 0.82, 0.42, 0.05));
    const trail = mesh(new THREE.BoxGeometry(0.12, 0.12, 2.3), M.paint, s * 0.45, 0.24, 1.25, 0.12, s * -0.28);
    root.add(trail);
    root.add(mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), M.steel, s * 0.78, 0.07, 2.3));
  }
  root.add(mesh(new THREE.BoxGeometry(1.7, 0.1, 0.12), M.steel, 0, 0.42, 0.05));
  // Bettung: Sandsackring, Munitionskisten, Tarnnetz-Fetzen
  sandbags(root, M, 0, 0.3, 2.0, -1.25, 1.25, 2);
  for (let i = 0; i < 3; i++) root.add(mesh(new THREE.BoxGeometry(0.6, 0.22, 0.3), M.wood, 1.25 + (i % 2) * 0.1, 0.11 + Math.floor(i / 2) * 0.22, 1.3 + i * 0.05, 0, 0.3));
  const net = mesh(new THREE.PlaneGeometry(2.6, 1.6, 6, 4), M.net, 0, 1.45, 0.7, -Math.PI / 2 + 0.25);
  const p = net.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (Math.random() - 0.5) * 0.25);
  net.geometry.computeVertexNormals(); net.material = M.net; root.add(net);
  void team;
  return { root, gun, barrel };
}

function bunkerModel() {
  const M = mats();
  const root = new THREE.Group(); root.name = 'psim:bunker';
  // Betonkörper mit abgeschrägter Front, Scharte, Erdanschüttung seitlich, Tarnnetz, Lüfterrohr
  const body = new THREE.BoxGeometry(5.0, 2.0, 4.4, 2, 2, 2);
  const pp = body.attributes.position;
  for (let i = 0; i < pp.count; i++) if (pp.getY(i) > 0.5 && pp.getZ(i) < 0) pp.setZ(i, pp.getZ(i) + 0.6); // Front oben zurück
  body.computeVertexNormals();
  const uv = body.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.2, uv.getY(i) * 1.1);
  root.add(mesh(body, M.concrete, 0, 1.0, 0));
  root.add(mesh(new THREE.BoxGeometry(5.4, 0.35, 4.8), M.concrete, 0, 2.15, 0.1));
  root.add(mesh(new THREE.BoxGeometry(1.6, 0.22, 0.4), M.dark, 0, 1.35, -1.95)); // MG-Scharte
  root.add(mesh(new THREE.BoxGeometry(2.0, 0.08, 0.5), M.concrete, 0, 1.52, -2.05));
  root.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), M.steel, 1.6, 2.6, 1.2));
  // Erdwälle
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(1.4, 2.4, 1.6, 7, 1, false, 0, Math.PI);
    root.add(mesh(g, M.net, s * 2.6, 0.8, 0, 0, s > 0 ? 0 : Math.PI));
  }
  sandbags(root, M, 0, -2.6, 1.6, -0.9, 0.9, 2);
  const net = mesh(new THREE.PlaneGeometry(6.4, 5.4, 8, 6), M.net, 0, 2.42, 0.1, -Math.PI / 2);
  const p = net.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (Math.random() - 0.5) * 0.3);
  net.geometry.computeVertexNormals(); root.add(net);
  return { root, gun: null, barrel: null };
}

/** Funkstelle: Gerätekabine auf Kufen, Gittermast mit Abspannung, Stromerzeuger, Richtantenne. */
function funkModel() {
  const M = mats();
  const root = new THREE.Group(); root.name = 'psim:funk';
  const cab = new THREE.Group(); root.add(cab);
  cab.add(mesh(new THREE.BoxGeometry(2.5, 2.2, 5.2), M.paint, 0, 1.35, 0));
  cab.add(mesh(new THREE.BoxGeometry(2.6, 0.08, 5.3), M.steel, 0, 2.48, 0));
  for (const s of [-1, 1]) cab.add(mesh(new THREE.BoxGeometry(0.16, 0.22, 5.4), M.steel, s * 1.0, 0.13, 0)); // Kufen
  cab.add(mesh(new THREE.BoxGeometry(0.9, 1.7, 0.05), M.steel, 0.5, 1.15, 2.63)); // Tür
  cab.add(mesh(new THREE.BoxGeometry(0.7, 0.35, 0.05), M.dark, -0.6, 1.7, 2.63)); // Lüftung
  const mast = new THREE.Group(); mast.position.set(-2.6, 0, -1.2); root.add(mast);
  const legG = new THREE.CylinderGeometry(0.035, 0.05, 13, 5);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; mast.add(mesh(legG, M.steel, Math.cos(a) * 0.22, 6.5, Math.sin(a) * 0.22)); }
  for (let y = 1; y < 13; y += 1.3) mast.add(mesh(new THREE.TorusGeometry(0.22, 0.02, 3, 6).rotateX(Math.PI / 2), M.steel, 0, y, 0));
  mast.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.2, 4), M.steel, 0, 14.4, 0)); // Peitschenantenne
  mast.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 14).rotateX(Math.PI / 2.2), M.steel, 0.3, 11.4, 0)); // Richtantenne
  for (let i = 0; i < 3; i++) { // Abspannseile
    const a = (i / 3) * Math.PI * 2 + 0.4, L = 9.2;
    const g = new THREE.CylinderGeometry(0.008, 0.008, L, 3);
    const m = mesh(g, M.steel, Math.cos(a) * 3.2, 6.1, Math.sin(a) * 3.2);
    m.lookAt(new THREE.Vector3(0, 12, 0).add(mast.position)); m.rotateX(Math.PI / 2);
    mast.add(m);
  }
  root.add(mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), M.paint, 2.1, 0.45, 1.6)); // Stromerzeuger
  root.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), M.dark, 2.3, 1.1, 1.6));
  sandbags(root, M, 0, 0, 3.6, -0.7, 0.7, 2);
  return { root, gun: null, barrel: null, mast, cab };
}

/** Nachschublager: Kistenstapel unter Tarnplane, Treibstofffässer, Granatkisten auf Paletten. */
function lagerModel() {
  const M = mats();
  const root = new THREE.Group(); root.name = 'psim:lager';
  const stock = new THREE.Group(); root.add(stock);
  const crate = new THREE.BoxGeometry(1.1, 0.55, 0.7), pal = new THREE.BoxGeometry(1.25, 0.14, 1.25);
  const drum = new THREE.CylinderGeometry(0.29, 0.29, 0.88, 12);
  let k = 0;
  for (let ix = -2; ix <= 2; ix++) for (let iz = -1; iz <= 1; iz++) {
    const x = ix * 1.35, z = iz * 1.45 - 0.4;
    if (k++ % 4 === 3) { // Fässer
      for (let d = 0; d < 4; d++) stock.add(mesh(drum, M.paint, x + (d % 2 - 0.5) * 0.6, 0.58, z + (Math.floor(d / 2) - 0.5) * 0.6));
      stock.add(mesh(pal, M.wood, x, 0.07, z));
      continue;
    }
    stock.add(mesh(pal, M.wood, x, 0.07, z));
    const h = 1 + ((ix * 7 + iz * 3) & 1) + (ix === 0 ? 1 : 0);
    for (let j = 0; j < h; j++) stock.add(mesh(crate, j % 2 ? M.wood : M.paint, x + (Math.random() - 0.5) * 0.05, 0.42 + j * 0.56, z, 0, (Math.random() - 0.5) * 0.06));
  }
  // Tarnplane auf Stangen
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) root.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), M.wood, sx * 3.6, 1.3, sz * 2.4 - 0.4));
  const tarp = mesh(new THREE.PlaneGeometry(7.8, 5.6, 8, 6), M.net, 0, 2.55, -0.4, -Math.PI / 2);
  const p = tarp.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(p.getX(i)) * 0.06 + (Math.random() - 0.5) * 0.2);
  tarp.geometry.computeVertexNormals(); root.add(tarp);
  return { root, gun: null, barrel: null, stock, tarp };
}

/** Behelfsbrücke (Pioniergerät): Stahlträger mit Fahrbahn auf zwei Holzstapeln, Geländer – über Graben/Bach gelegt. */
function brueckeModel() {
  const M = mats();
  const root = new THREE.Group(); root.name = 'psim:bruecke';
  const halves = [];
  for (const s of [-1, 1]) {
    const h = new THREE.Group(); h.position.set(0, 1.0, 0); root.add(h); halves.push(h);
    h.add(mesh(new THREE.BoxGeometry(4.0, 0.12, 8.1), M.steel, 0, 0.16, s * 4.05)); // Fahrbahn
    for (const x of [-1.6, -0.5, 0.5, 1.6]) h.add(mesh(new THREE.BoxGeometry(0.22, 0.42, 8.1), M.steel, x, -0.12, s * 4.05)); // Träger
    for (const x of [-2.0, 2.0]) {
      h.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 8.1), M.steel, x, 1.0, s * 4.05)); // Geländer
      for (let z = 0.4; z < 8.1; z += 2) h.add(mesh(new THREE.BoxGeometry(0.06, 0.85, 0.06), M.steel, x, 0.6, s * z));
    }
    for (let z = 0.6; z < 8; z += 0.9) h.add(mesh(new THREE.BoxGeometry(3.9, 0.03, 0.08), M.dark, 0, 0.235, s * z)); // Querrillen
  }
  for (const s of [-1, 1]) for (let j = 0; j < 4; j++) root.add(mesh(new THREE.BoxGeometry(4.4, 0.24, 0.5 + (j % 2) * 0.1), M.wood, 0, 0.12 + j * 0.24, s * 7.6 + (j % 2 ? 0.3 : -0.3), 0, j % 2 ? Math.PI / 2 * 0 : 0));
  return { root, gun: null, barrel: null, halves };
}

const MODELS = { psim_pak: pakModel, psim_bunker: bunkerModel, psim_funk: funkModel, psim_lager: lagerModel, psim_bruecke: brueckeModel };

/** Modell-Hülle mit der Schnittstelle, die vehicle.js/index.js erwarten. */
function makeModel(type, team) {
  const parts = (MODELS[type] || bunkerModel)(team);
  const M = mats();
  const model = {
    root: parts.root, gun: parts.gun, barrel: parts.barrel, turret: null, wheels: [], trackMats: [], occ: [], lightsOn: false, wrecked: false,
    scrollTracks() {}, setLights() {},
    setWreck(on) {
      if (model.wrecked || !on) return;
      model.wrecked = true;
      parts.root.traverse((o) => { if (o.isMesh && o.material !== M.sand) o.material = M.wreck; });
      if (parts.barrel) { parts.barrel.rotation.x = -0.35; parts.barrel.position.y -= 0.15; }
      if (parts.gun) parts.gun.rotation.z = 0.25;
      if (type === 'psim_bunker') parts.root.children.forEach((c, i) => { if (i > 1 && i < 6) c.visible = false; });
      if (parts.mast) { parts.mast.rotation.z = 1.35; parts.mast.position.y = 0.3; }
      if (parts.cab) { parts.cab.rotation.z = 0.08; parts.cab.position.y = -0.25; }
      if (parts.stock) parts.stock.children.forEach((c, i) => { if (i % 3) c.visible = false; else { c.rotation.z = (Math.random() - 0.5) * 0.8; c.position.y *= 0.4; } });
      if (parts.tarp) parts.tarp.visible = false;
      if (parts.halves) parts.halves.forEach((h, i) => { h.rotation.x = (i ? -1 : 1) * 0.42; h.position.y = -0.4; });
    },
    addScar() {},
    dispose() { parts.root.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); }); },
  };
  return model;
}

/* --------------------------------------------------------------------- Entität */

export class Emplacement extends Vehicle {
  constructor(sys, type, opts = {}) {
    super(sys, type, opts);
    this.isEmplacement = true;
    this.kind = this.def.emplacement;
    this.crew = null;      // Bot an der Stellung
    this.ammoId = opts.ammoId || null;
    this.aimYaw = 0; this.aimPitch = 0;
    this.cool = 4 + Math.random() * 3;
    this.shots = 0;
    this.target = null;
    this._scanT = 0; this._burst = 0; this._burstT = 0;
    this.baseYaw = opts.yaw || 0;
  }

  _makeModel(type, opts) { return makeModel(type, opts.team); }

  get isOccupied() { return false; }

  /** Granatentreffer (hooks.js): Schild/Beton nach Munitionsart. → Schaden */
  shellHit(def, hit, dir, attacker) {
    const P = def.psim || {};
    let dmg;
    const T = { // [Spreng, Hohlladung, Wucht, Schrot]
      bunker: [520, 300, 70, 10], funk: [300, 220, 110, 25], lager: [340, 260, 120, 30], bruecke: [260, 180, 60, 0],
    }[this.kind];
    if (T) dmg = P.role === 'he' ? T[0] : P.role === 'ce' ? T[1] : P.role === 'ke' ? T[2] : T[3];
    else dmg = P.role === 'can' ? 20 : 400; // Pak: jeder Granatentreffer zerstört
    if (hit.face === 'front' && this.kind === 'pak' && P.role === 'ke' && Math.random() < 0.15) dmg = 60; // Schild lenkt ab
    this.sys.G.effects?.impact?.(hit.point, hit.normal, this.kind === 'bunker' ? 'concrete' : this.kind === 'lager' ? 'wood' : 'metal', { big: true, hole: true });
    return this.applyDamage(dmg, { attacker, weaponId: def.id, zone: 'hull', kind: 'psim', point: hit.point, dir });
  }

  update(dt, world) {
    void world;
    if (!this.alive) return;
    const G = this.G, sys = this.sys;
    if (!sys.live) return;
    const crew = this.crew && this.crew.alive ? this.crew : null;
    if (!crew) { this.target = null; return; }
    this._scanT -= dt;
    if (this._scanT <= 0) { this._scanT = 0.6; this.target = this._scan(); }
    const t = this.target;
    if (this.kind === 'pak') this._pak(dt, t, crew);
    else this._bunker(dt, t, crew);
  }

  _eye(out) { return this.body.toWorld(out.set(0, this.kind === 'pak' ? 1.0 : 1.35, this.kind === 'pak' ? -0.4 : -2.0), out); }

  _scan() {
    const G = this.G, W = G.world, eye = this._eye(_a);
    let best = null, bd = 1e9;
    if (this.kind === 'pak') {
      for (const v of this.sys.list) {
        if (!v.alive || v.isEmplacement || !v.hostileTo || !v.isOccupied || !v.hostileTo(this.crew)) continue;
        const d = v.position.distanceTo(eye);
        if (d > 900 || d > bd) continue;
        _b.copy(v.body.pos); _b.y += 0.6;
        const yaw = wrap(Math.atan2(-(_b.x - eye.x), -(_b.z - eye.z)) - this.body.yaw());
        if (Math.abs(yaw) > 0.55) continue;
        if (W && W.lineOfSight && !W.lineOfSight(eye, _b)) continue;
        best = v; bd = d;
      }
    } else {
      for (const a of G.actors) {
        if (!a.alive || a.team === this.crew.team || a.team == null) continue;
        if (a.vehicle && a.invulnerable) continue; // geschlossene Luke
        const p = a.getEyePosition ? a.getEyePosition(_b) : _b.copy(a.position).setY(a.position.y + 1.5);
        const d = p.distanceTo(eye);
        if (d > 380 || d > bd) continue;
        const yaw = wrap(Math.atan2(-(p.x - eye.x), -(p.z - eye.z)) - this.body.yaw());
        if (Math.abs(yaw) > 0.9) continue;
        if (W && W.lineOfSight && !W.lineOfSight(eye, p)) continue;
        best = a; bd = d;
      }
    }
    return best;
  }

  _pak(dt, t, crew) {
    const G = this.G;
    if (!t || !t.alive) return;
    const eye = this._eye(_a);
    const def = VEHICLE_WEAPONS[this.ammoId];
    if (!def) return;
    const tp = _b.copy(t.body.pos); tp.y += 0.4;
    const dist = tp.distanceTo(eye);
    const tof = dist / def.speed;
    tp.addScaledVector(t.body.vel, tof);
    const dx = Math.hypot(tp.x - eye.x, tp.z - eye.z);
    const el = Vehicle.lobAngle(def.speed, def.gravity, dx, tp.y - eye.y);
    const yaw = wrap(Math.atan2(-(tp.x - eye.x), -(tp.z - eye.z)) - this.body.yaw());
    this.aimYaw += clamp(wrap(yaw - this.aimYaw), -0.35 * dt, 0.35 * dt);
    this.aimPitch += clamp(el - this.aimPitch, -0.2 * dt, 0.2 * dt);
    this.cool -= dt;
    if (this.cool > 0 || Math.abs(wrap(yaw - this.aimYaw)) > 0.01) return;
    this.cool = 6.5 + Math.random() * 2.5;
    // Streuung: erster Schuss grob, dann eingeschossen
    const diff = { rekrut: 1.5, regulaer: 1, veteran: 0.75, elite: 0.55 }[G.match && G.match.difficulty] || 1;
    const err = (0.006 / (1 + this.shots * 0.8) + 0.0012) * diff;
    this.shots++;
    const wy = this.body.yaw() + this.aimYaw + (Math.random() - 0.5) * 2 * err;
    const wp = this.aimPitch + (Math.random() - 0.5) * 2 * err * 0.7;
    _d.set(-Math.sin(wy) * Math.cos(wp), Math.sin(wp), -Math.cos(wy) * Math.cos(wp));
    const muzzle = this.body.toWorld(_a.set(0, 0.95, 0), new THREE.Vector3()).addScaledVector(_d, 3.3);
    this.sys.fire(this, { actor: crew, index: 0 }, { def, shots: this.shots }, muzzle, _d.clone());
  }

  _bunker(dt, t, crew) {
    const G = this.G;
    this._burstT -= dt;
    if (!t || !t.alive) { this._burst = 0; return; }
    if (this._burst <= 0 && this._burstT <= 0) { this._burst = 0.6 + Math.random() * 0.8; this._burstT = 1.6 + Math.random() * 1.6; }
    if (this._burst <= 0) return;
    this._burst -= dt;
    this._mgT = (this._mgT || 0) - dt;
    if (this._mgT > 0) return;
    const def = VEHICLE_WEAPONS.psim_bunker_mg;
    this._mgT = 60 / def.rpm;
    const eye = this._eye(_a).clone();
    const p = t.getEyePosition ? t.getEyePosition(_b) : _b.copy(t.position);
    _d.copy(p).sub(eye).normalize();
    const s = def.spread * (1.4 - Math.min(0.6, (this._hits || 0) * 0.05));
    _d.x += (Math.random() - 0.5) * s * 2; _d.y += (Math.random() - 0.5) * s * 1.4; _d.z += (Math.random() - 0.5) * s * 2; _d.normalize();
    this.sys._ignore = this;
    let res = null;
    try { res = G.combat.fireHitscan({ shooter: crew, origin: eye, dir: _d, range: def.range, weapon: def }); } catch { /* */ }
    this.sys._ignore = null;
    this._shots = (this._shots || 0) + 1;
    if (this._shots % 3 === 0 && res && res.point) G.events.emit('tracer', { from: eye, to: res.point.clone ? res.point.clone() : res.point, actor: crew, weaponId: def.id });
    G.effects?.muzzleFlash?.(eye, _d, { cls: 'lmg', scale: 1.1 });
    this.sys.audio.play('lmg', { position: eye, actor: crew, weapon: def.id });
  }

  sync() {
    const b = this.body, M = this.model;
    _a.copy(b.com).negate().applyQuaternion(b.renderQuat).add(b.renderPos);
    M.root.position.copy(_a);
    M.root.quaternion.copy(b.renderQuat);
    if (M.gun && !M.wrecked) M.gun.rotation.y = this.aimYaw;
    if (M.barrel && !M.wrecked) M.barrel.rotation.x = this.aimPitch;
    // Brand/Qualm des Wracks
    if (this.wreck && this.G.effects) {
      this._fxT = (this._fxT || 0) - 0.016;
      if (this._fxT <= 0) { this._fxT = 0.5; this.G.effects.smoke?.(_b.copy(b.renderPos).setY(b.renderPos.y + 1.2), { count: 1, color: 0x22201c, size: 1.6, life: 3, rise: 1.6, alpha: 0.4 }); }
    }
  }
}

/** Stellung erzeugen und ins Fahrzeugsystem hängen (wie VehicleSystem.spawnVehicle, ohne Rammen/Breschen). */
export function spawnEmplacement(sys, type, position, yaw, team, opts = {}) {
  registerEmplacements();
  const v = new Emplacement(sys, type, { position, yaw, team, quality: sys.quality, ...opts });
  sys.list.push(v);
  sys.group.add(v.model.root);
  v.sync(0);
  sys.G.events.emit('vehicle:spawn', { vehicle: v });
  return v;
}
