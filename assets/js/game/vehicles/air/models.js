// NULLPUNKT — Prozedurale Modelle der Luftfahrzeuge: KHS-4 Sperber (Kampf-/Transporthubschrauber) und JK-9 Falke (Kampfjet).
//
// Rumpf als Querschnitts-Loft (Superellipsen), Flächen als abgerundete Extrusionen, Kleinteile aus Grundkörpern; je Material
// zu einem Mesh verschmolzen, zwei LOD-Stufen (Nah mit Cockpit-Innenraum, Antennen, Klappen; Fern vereinfacht).
// Lack: Paneel-/Nietentextur (Kanvas: Fugen, Nietreihen, Wartungsklappen + Normalenkarte) mit Tarnanstrich im Shader
// (Rauschen im Modellraum, Teamfarben, aufgehellte Unterseite beim Jet). Glas getönt und spiegelnd, Cockpit mit
// leuchtenden Bildschirmen, Sitzen, Steuerknüppel; Insassen als sitzende Figuren (setOccupant).
// Bewegliche Teile außerhalb der LOD-Stufen: Hauptrotor (Blätter + Bewegungsunschärfe-Scheibe, Überblendung nach
// Drehzahl), Heckrotor, Kinnturm ('mg'), beim Jet Höhen-/Querruder, Seitenruder, Fahrwerk (einfahrbar), Nachbrenner.
//
// createAirModel(type, { team, quality }) → { root, mg, wheels:[], trackMats:[], occ:[], setRotor(main, tail, rpm, alive),
//   setJet({thr, ab, gear, pitch, roll, yaw}), setStores(n), setLights(on), setWreck(on), setInterior(on), setOccupant(i, on), dispose() }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxUV } from '../../engine/textures.js?v=20261121041936';
import { VEHICLES } from '../data.js?v=20261121041936';
import { vehicleMaterials, markingMaterial } from '../materials.js?v=20261121041936';
import { heliDetailHQ, heliInteriorHQ, jetDetailHQ, jetInteriorHQ, jetGearDetailHQ } from './models-detail.js?v=20261121041936';

const PI = Math.PI, HP = PI / 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const LOD_DIST = { low: 70, medium: 110, high: 150, ultra: 190 };
const TEMPLATES = new Map();

/* =================================================================== Materialien */

let MAT = null;

/** Paneele + Nieten (2 m × 2 m auf 512 px): Farbe (fast weiß, Lack tönt) und Höhe → Normalenkarte. */
function panelTextures() {
  const W = 512, c = document.createElement('canvas'); c.width = c.height = W;
  const h = document.createElement('canvas'); h.width = h.height = W;
  const g = c.getContext('2d'), hg = h.getContext('2d');
  g.fillStyle = '#dcdcd8'; g.fillRect(0, 0, W, W);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, W, W);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // Lackschattierung (Fleckigkeit, Ausbleichen)
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W, y = rnd() * W, r = 10 + rnd() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const a = rnd() * 0.06;
    gr.addColorStop(0, rnd() < 0.5 ? `rgba(255,255,250,${a})` : `rgba(60,58,50,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const line = (x0, y0, x1, y1) => {
    g.strokeStyle = 'rgba(40,40,36,0.75)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    hg.strokeStyle = '#2a2a2a'; hg.lineWidth = 2.2; hg.beginPath(); hg.moveTo(x0, y0); hg.lineTo(x1, y1); hg.stroke();
  };
  const rivets = (x0, y0, x1, y1, off) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / 9);
    const nx = -(y1 - y0) / len * off, ny = (x1 - x0) / len * off;
    for (let i = 1; i < n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t + nx, y = y0 + (y1 - y0) * t + ny;
      g.fillStyle = 'rgba(70,70,64,0.55)'; g.beginPath(); g.arc(x, y, 1.15, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,250,0.35)'; g.beginPath(); g.arc(x - 0.4, y - 0.4, 0.6, 0, 7); g.fill();
      hg.fillStyle = '#c8c8c8'; hg.beginPath(); hg.arc(x, y, 1.4, 0, 7); hg.fill();
    }
  };
  // Raster: Spanten (senkrecht) alle 0,5 m (128 px), Stringer (waagerecht) unregelmäßig, versetzte Stöße
  const xs = [0, 128, 256, 384, 512];
  for (const x of xs) { line(x, 0, x, W); rivets(x, 0, x, W, 5); rivets(x, 0, x, W, -5); }
  const rows = [0, 96, 224, 300, 420, 512];
  for (let r = 0; r < rows.length - 1; r++) {
    const y = rows[r];
    line(0, y, W, y); rivets(0, y, W, y, 5);
    // Stöße innerhalb der Reihe versetzt
    const xo = 64 + (r % 2) * 128;
    line(xo, rows[r], xo, rows[r + 1]); rivets(xo, rows[r], xo, rows[r + 1], 4);
  }
  // Wartungsklappen mit Schrauben in den Ecken
  for (let i = 0; i < 7; i++) {
    const x = 20 + rnd() * 420, y = 20 + rnd() * 420, w = 26 + rnd() * 60, hh = 20 + rnd() * 40;
    g.strokeStyle = 'rgba(40,40,36,0.7)'; g.lineWidth = 1.3; g.strokeRect(x, y, w, hh);
    hg.strokeStyle = '#3a3a3a'; hg.lineWidth = 1.8; hg.strokeRect(x, y, w, hh);
    for (const [px, py] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + hh - 4], [x + w - 4, y + hh - 4]]) {
      g.fillStyle = 'rgba(50,50,46,0.7)'; g.beginPath(); g.arc(px, py, 1.6, 0, 7); g.fill();
      hg.fillStyle = '#bdbdbd'; hg.beginPath(); hg.arc(px, py, 1.8, 0, 7); hg.fill();
    }
  }
  // Abnutzung/Schlieren (Abgas, Regen) senkrecht
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W, y = rnd() * W, l = 20 + rnd() * 90;
    g.strokeStyle = `rgba(55,50,42,${0.03 + rnd() * 0.05})`; g.lineWidth = 1 + rnd() * 3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 6, y + l); g.stroke();
  }
  // Normalenkarte aus der Höhe
  const hd = hg.getImageData(0, 0, W, W).data, nc = document.createElement('canvas'); nc.width = nc.height = W;
  const nx = nc.getContext('2d'), out = nx.createImageData(W, W);
  const at = (x, y) => hd[(((y + W) % W) * W + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), o = (y * W + x) * 4;
    out.data[o] = (-dx / l * 0.5 + 0.5) * 255; out.data[o + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[o + 3] = 255;
  }
  nx.putImageData(out, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const nrm = new THREE.CanvasTexture(nc);
  for (const t of [map, nrm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.5, 0.5); t.anisotropy = 4; }
  return { map, nrm };
}

/** Bildschirme im Cockpit (leuchtende Symbolik: Horizont, Karte, Waffen, Triebwerk). */
function screenTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#05080a'; g.fillRect(0, 0, 512, 128);
  const mfd = (x, draw) => { g.save(); g.translate(x, 0); g.fillStyle = '#0a1214'; g.fillRect(4, 4, 120, 120); g.strokeStyle = '#2b3a3d'; g.strokeRect(4.5, 4.5, 119, 119); draw(); g.restore(); };
  mfd(0, () => { // Horizont
    g.fillStyle = '#1d3a52'; g.fillRect(10, 10, 108, 52); g.fillStyle = '#4a3420'; g.fillRect(10, 62, 108, 56);
    g.strokeStyle = '#e8f0e0'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 62); g.lineTo(118, 62); g.stroke();
    g.strokeStyle = '#ffd34a'; g.beginPath(); g.moveTo(40, 64); g.lineTo(58, 64); g.lineTo(64, 70); g.lineTo(70, 64); g.lineTo(88, 64); g.stroke();
  });
  mfd(128, () => { // Karte
    g.strokeStyle = '#46d86a'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(10, 20 + i * 18); g.bezierCurveTo(40, 10 + i * 20, 80, 40 + i * 12, 118, 22 + i * 17); g.stroke(); }
    g.fillStyle = '#ffd34a'; g.beginPath(); g.moveTo(64, 56); g.lineTo(58, 72); g.lineTo(70, 72); g.fill();
  });
  mfd(256, () => { // Waffen
    g.fillStyle = '#46d86a'; g.font = 'bold 13px monospace';
    g.fillText('RAK 14', 16, 30); g.fillText('MK  150', 16, 52); g.fillText('TK   8', 16, 74); g.fillText('BEREIT', 16, 104);
    g.strokeStyle = '#46d86a'; g.strokeRect(84, 18, 28, 90);
  });
  mfd(384, () => { // Triebwerk
    g.strokeStyle = '#46d86a'; g.lineWidth = 3;
    for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(38 + i * 52, 52, 20, PI * 0.8, PI * 2.05); g.stroke(); }
    g.fillStyle = '#ffd34a'; g.fillRect(16, 88, 70, 8); g.fillStyle = '#46d86a'; g.fillRect(16, 104, 96, 8);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** Rotorscheibe (Bewegungsunschärfe): halbtransparente Ringe, dunkler zu den Blattspitzen, feine Blattschlieren. */
function discTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const cx = S / 2;
  const gr = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
  gr.addColorStop(0, 'rgba(30,32,30,0)'); gr.addColorStop(0.08, 'rgba(30,32,30,0.15)'); gr.addColorStop(0.5, 'rgba(32,34,32,0.35)');
  gr.addColorStop(0.93, 'rgba(36,36,34,0.45)'); gr.addColorStop(0.97, 'rgba(210,200,170,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  // Schlieren (5 Blätter, verwischt)
  for (let b = 0; b < 5; b++) {
    const a0 = (b / 5) * PI * 2;
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = `rgba(20,22,20,${0.05 * (1 - k / 14)})`; g.lineWidth = cx * 0.9;
      g.beginPath(); g.arc(cx, cx, cx * 0.5, a0 - k * 0.04, a0 - k * 0.04 + 0.03); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Flammenverlauf (Nachbrenner): heller Kern, Stoßknoten. */
function flameTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.15, 'rgba(255,190,110,0.95)'); gr.addColorStop(0.5, 'rgba(255,120,60,0.55)'); gr.addColorStop(1, 'rgba(120,80,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(255,255,255,${0.35 - i * 0.06})`; g.fillRect(0, 30 + i * 38, 64, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const CAMO = {
  heli: { A: [0x5b6942, 0x39432b, 0x6e5c3e], B: [0x9c8d68, 0x75664a, 0xb7a882], null: [0x6b6e5e, 0x4d5044, 0x85826e] },
  jet: { A: [0x77848b, 0x56626a, 0xa5aeb3], B: [0x948e7f, 0x716b5f, 0xbab5a8], null: [0x7d8184, 0x5d6164, 0xa9adb0] },
};

function paintMaterial(kind, team, tex) {
  const [base, c2, c3] = (CAMO[kind] || CAMO.heli)[team ?? 'null'] || CAMO.heli.null;
  const m = new THREE.MeshStandardMaterial({ name: `air:${kind}:${team}`, color: base, map: tex.map, normalMap: tex.nrm, normalScale: new THREE.Vector2(0.55, 0.55), roughness: kind === 'jet' ? 0.5 : 0.66, metalness: 0.28, envMapIntensity: 0.85 });
  const b = new THREE.Color(base), x2 = new THREE.Color(c2), x3 = new THREE.Color(c3);
  const ratio = (c) => new THREE.Vector3(c.r / Math.max(1e-4, b.r), c.g / Math.max(1e-4, b.g), c.b / Math.max(1e-4, b.b));
  const u = { uC2: { value: ratio(x2) }, uC3: { value: ratio(x3) }, uBelly: { value: kind === 'jet' ? 1 : 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAirP;\nvarying vec3 vAirN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAirP = position;\nvAirN = objectNormal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vAirP; varying vec3 vAirN; uniform vec3 uC2, uC3; uniform float uBelly;
        float apH( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
        float apN( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( apH( i ), apH( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( apH( i + vec3( 0.0, 1.0, 0.0 ) ), apH( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
                      mix( mix( apH( i + vec3( 0.0, 0.0, 1.0 ) ), apH( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( apH( i + vec3( 0.0, 1.0, 1.0 ) ), apH( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z ); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float ap1 = apN( vAirP * vec3( 0.42, 0.55, 0.2 ) ) * 0.7 + apN( vAirP * 1.3 + 3.1 ) * 0.3;
        float ap2 = apN( vAirP * vec3( 0.36, 0.5, 0.24 ) + 11.3 ) * 0.7 + apN( vAirP * 1.5 + 7.0 ) * 0.3;
        float apT2 = smoothstep( 0.5, 0.54, ap1 ), apT3 = smoothstep( 0.56, 0.6, ap2 ) * ( 1.0 - apT2 );
        float apB = uBelly * smoothstep( -0.05, -0.55, normalize( vAirN ).y );
        apT2 *= 1.0 - apB; apT3 = mix( apT3, 1.0, apB );
        diffuseColor.rgb *= mix( vec3( 1.0 ), uC2, apT2 ) * mix( vec3( 1.0 ), uC3, apT3 );`);
  };
  m.customProgramCacheKey = () => `airpaint`;
  return m;
}

export function airMaterials() {
  if (MAT) return MAT;
  const V = vehicleMaterials();
  const tex = panelTextures();
  const scr = screenTexture();
  MAT = {
    V,
    paint: { heli: {}, jet: {} },
    tex,
    glass: new THREE.MeshStandardMaterial({ name: 'air:glas', color: 0x2c3c44, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 2.4 }),
    frame: new THREE.MeshStandardMaterial({ name: 'air:rahmen', color: 0x30332f, roughness: 0.55, metalness: 0.35 }),
    tub: new THREE.MeshStandardMaterial({ name: 'air:wanne', color: 0x3a3e3f, roughness: 0.85, metalness: 0.1 }),
    panel: new THREE.MeshStandardMaterial({ name: 'air:instrument', color: 0x1b1d1e, roughness: 0.7, metalness: 0.2 }),
    screen: new THREE.MeshStandardMaterial({ name: 'air:bildschirm', color: 0x101414, map: scr, emissive: 0xffffff, emissiveMap: scr, emissiveIntensity: 1.25, roughness: 0.25, metalness: 0 }),
    seat: V.seat, rubber: V.rubber, dark: V.dark, steel: V.steel, plastic: V.plastic,
    blade: new THREE.MeshStandardMaterial({ name: 'air:blatt', color: 0x262826, roughness: 0.6, metalness: 0.2 }),
    tip: new THREE.MeshStandardMaterial({ name: 'air:blattspitze', color: 0xd9c35a, roughness: 0.5 }),
    black: new THREE.MeshStandardMaterial({ name: 'air:schwarz', color: 0x0b0c0c, roughness: 0.9 }),
    nozzle: new THREE.MeshStandardMaterial({ name: 'air:duese', color: 0x4a4440, roughness: 0.42, metalness: 0.85, envMapIntensity: 0.8 }),
    soot: new THREE.MeshStandardMaterial({ name: 'air:russ', color: 0x161412, roughness: 0.95 }),
    suit: new THREE.MeshStandardMaterial({ name: 'air:fliegeranzug', color: 0x58604a, roughness: 0.9 }),
    helmet: new THREE.MeshStandardMaterial({ name: 'air:helm', color: 0x4b5446, roughness: 0.5, metalness: 0.1 }),
    visor: new THREE.MeshStandardMaterial({ name: 'air:visier', color: 0x0d0f12, roughness: 0.08, metalness: 0.9, envMapIntensity: 2 }),
    navR: new THREE.MeshStandardMaterial({ name: 'air:posR', color: 0x400404, emissive: 0xff2010, emissiveIntensity: 2.2 }),
    navG: new THREE.MeshStandardMaterial({ name: 'air:posG', color: 0x043008, emissive: 0x20ff40, emissiveIntensity: 2.2 }),
    navW: new THREE.MeshStandardMaterial({ name: 'air:posW', color: 0x505050, emissive: 0xffffff, emissiveIntensity: 1.8 }),
    hud: new THREE.MeshBasicMaterial({ name: 'air:hudglas', color: 0x7dffa0, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }),
    discTex: discTexture(),
    flameTex: flameTexture(),
    missile: new THREE.MeshStandardMaterial({ name: 'air:rakete', color: 0x7c806f, roughness: 0.55, metalness: 0.3 }),
    bomb: new THREE.MeshStandardMaterial({ name: 'air:bombe', color: 0x4c5440, roughness: 0.6, metalness: 0.25 }),
    band: new THREE.MeshStandardMaterial({ name: 'air:band', color: 0xc7a733, roughness: 0.6 }),
  };
  for (const k of ['A', 'B', 'null']) { MAT.paint.heli[k] = paintMaterial('heli', k === 'null' ? null : k, tex); MAT.paint.jet[k] = paintMaterial('jet', k === 'null' ? null : k, tex); }
  return MAT;
}

/** Vorzuwärmende Luftfahrzeug-Materialien (index.js kompiliert sie beim Anschluss mit). */
export function airWarmMaterials() {
  const M = airMaterials();
  return [M.paint.heli.A, M.paint.heli.B, M.paint.jet.A, M.paint.jet.B, M.glass, M.frame, M.tub, M.panel, M.screen, M.blade, M.tip, M.black, M.nozzle, M.navR, M.navG, M.navW, M.suit, M.helmet, M.visor];
}

/* =================================================================== Geometrie-Bausteine */

/** Sammelt Geometrien je Material (Modellraum) und verschmilzt sie. */
class Bucket {
  constructor() { this.map = new Map(); }
  add(geom, mat, pos = null, rot = null, scl = null, ownUV = false) {
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    geom.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0), _q, _s.set(scl ? scl[0] : 1, scl ? scl[1] : 1, scl ? scl[2] : 1));
    g.applyMatrix4(_m);
    if (!ownUV || !g.attributes.uv) boxUV(g, 1);
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(g);
    return this;
  }
  build(parent, shadow = true) {
    for (const [mat, list] of this.map) {
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (list.length > 1) for (const g of list) g.dispose();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = shadow && !mat.transparent;
      mesh.receiveShadow = !mat.transparent;
      parent.add(mesh);
    }
    this.map.clear();
    return parent;
  }
}

/**
 * Loft über Superellipsen-Querschnitte (von vorn −Z nach hinten +Z): { z, w, h (oder ht/hb), y, x, n }.
 * half: nur obere Hälfte (Haube). UV: Umfangslänge × z (Meter) → Paneele laufen um den Rumpf.
 */
function loft(secs, seg = 20, { half = false, capStart = true, capEnd = true } = {}) {
  const cnt = half ? Math.floor(seg / 2) + 1 : seg;
  const pos = [], uv = [], idx = [];
  for (const s of secs) {
    const n = s.n || 2.4;
    let arc = 0, px = null, py = null;
    for (let i = 0; i < cnt; i++) {
      const a = half ? (i / (cnt - 1)) * PI : (i / seg) * PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const x = (s.x || 0) + s.w * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const hh = sn >= 0 ? (s.ht ?? s.h) : (s.hb ?? s.h);
      const y = s.y + hh * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
      if (px != null) arc += Math.hypot(x - px, y - py);
      px = x; py = y;
      pos.push(x, y, s.z); uv.push(arc, -s.z);
    }
  }
  const R = secs.length;
  for (let r = 0; r < R - 1; r++) {
    for (let i = 0; i < (half ? cnt - 1 : cnt); i++) {
      const i2 = half ? i + 1 : (i + 1) % cnt;
      const a = r * cnt + i, b = r * cnt + i2, c = (r + 1) * cnt + i, d = (r + 1) * cnt + i2;
      idx.push(a, b, c, b, d, c);
    }
  }
  if (!half) {
    const cap = (r, start) => {
      const s = secs[r];
      const ci = pos.length / 3;
      pos.push(s.x || 0, s.y, s.z); uv.push(0, -s.z);
      for (let i = 0; i < cnt; i++) {
        const a = r * cnt + i, b = r * cnt + ((i + 1) % cnt);
        if (start) idx.push(ci, b, a); else idx.push(ci, a, b);
      }
    };
    if (capStart) cap(0, true);
    if (capEnd) cap(R - 1, false);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Flügel/Flosse: Grundriss (x, z) in der Ebene, Dicke t, gerundete Kanten. → Geometrie (Unterseite y = 0) */
function wing(points, t = 0.14, bevel = 0.05, curve = 3) {
  const sh = new THREE.Shape();
  points.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z)));
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, t - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: curve, curveSegments: 4 });
  g.rotateX(HP); // Form-y → z, Extrusion → −y
  g.translate(0, t - bevel, 0);
  return g;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
/** An der YZ-Ebene spiegeln (Umlaufsinn korrigiert, sonst zeigen die Flächen nach innen). */
function mirrorX(geom) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  if (g !== geom) geom.dispose();
  g.scale(-1, 1, 1);
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k], n = a.itemSize, arr = a.array;
    for (let t = 0; t < a.count; t += 3) for (let c = 0; c < n; c++) { const i1 = (t + 1) * n + c, i2 = (t + 2) * n + c; const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp; }
    a.needsUpdate = true;
  }
  return g;
}
const cylZ = (r0, r1, len, seg = 12) => new THREE.CylinderGeometry(r0, r1, len, seg).rotateX(HP); // Achse z, r0 bei −z
const cylY = (r0, r1, len, seg = 12) => new THREE.CylinderGeometry(r0, r1, len, seg);
const sph = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);

/** Rohr (TubeGeometry) durch Punkte. */
function tube(pts, r, seg = 6, closed = false) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), closed, 'centripetal');
  return new THREE.TubeGeometry(curve, Math.max(4, pts.length * 4), r, seg, closed);
}

/** Bogen-Rahmen einer Haube am Querschnitt s (obere Hälfte), Stärke r. */
function frameArch(s, r = 0.035, steps = 12, grow = 0.02) {
  const pts = [];
  const n = s.n || 2.4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * PI, c = Math.cos(a), sn = Math.sin(a);
    pts.push([(s.x || 0) + (s.w + grow) * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), s.y + ((s.ht ?? s.h) + grow) * Math.pow(Math.abs(sn), 2 / n), s.z]);
  }
  return tube(pts, r, 5);
}

/** Sitzende Figur (Pilot/Schütze/Soldat) für die Kabine; Ursprung = Sitzfläche Mitte. */
function figure(M, { helmet = true, stick = true } = {}) {
  const B = new Bucket();
  B.add(box(0.42, 0.56, 0.26), M.suit, [0, 0.32, 0.02], [-0.12, 0, 0]);       // Oberkörper
  B.add(box(0.44, 0.16, 0.5), M.suit, [0, 0.06, -0.2]);                      // Oberschenkel
  B.add(box(0.36, 0.48, 0.14), M.suit, [0, -0.2, -0.46]);                    // Unterschenkel
  B.add(box(0.1, 0.42, 0.1), M.suit, [-0.25, 0.32, -0.12], [-0.9, 0, 0.12]); // Arme nach vorn
  B.add(box(0.1, 0.42, 0.1), M.suit, [0.25, 0.32, -0.12], [-0.9, 0, -0.12]);
  B.add(box(0.3, 0.18, 0.12), M.dark, [0, 0.42, -0.12]);                     // Weste
  if (helmet) {
    B.add(sph(0.155, 12, 9), M.helmet, [0, 0.78, 0.0], null, [1, 1.08, 1.12]);
    B.add(new THREE.SphereGeometry(0.14, 12, 8, 0, PI, HP * 0.55, HP * 0.6), M.visor, [0, 0.79, -0.03], [0, HP, 0], [1, 1, 1.15]);
  } else B.add(sph(0.13, 10, 8), M.suit, [0, 0.76, 0]);
  if (stick) B.add(cylY(0.018, 0.022, 0.3, 6), M.dark, [0.02, 0.05, -0.36], [0.2, 0, 0]);
  const g = new THREE.Group();
  B.build(g, false);
  return g;
}

/* =================================================================== KHS-4 Sperber */

function heliFuselage(B, M, P, det) {
  const seg = det ? 22 : 12;
  const secs = [
    { z: -8.15, w: 0.12, h: 0.14, y: 1.18, n: 2 },
    { z: -7.85, w: 0.42, h: 0.42, y: 1.2, n: 2.2 },
    { z: -7.3, w: 0.66, ht: 0.66, hb: 0.58, y: 1.3, n: 2.4 },
    { z: -6.5, w: 0.78, ht: 0.62, hb: 0.72, y: 1.42, n: 2.6 },
    { z: -5.2, w: 0.84, ht: 0.3, hb: 0.86, y: 1.56, n: 2.8 },
    { z: -4.4, w: 0.9, ht: 0.4, hb: 0.98, y: 1.66, n: 3 },
    { z: -3.2, w: 1.02, ht: 0.38, hb: 1.06, y: 1.78, n: 3.2 },
    { z: -2.6, w: 1.18, ht: 1.2, hb: 1.12, y: 1.8, n: 3.8 },
    { z: 0.9, w: 1.18, ht: 1.2, hb: 1.1, y: 1.82, n: 3.8 },
    { z: 1.8, w: 0.98, ht: 1.04, hb: 0.86, y: 2.02, n: 3 },
    { z: 2.8, w: 0.58, ht: 0.6, hb: 0.46, y: 2.38, n: 2.4 },
    { z: 6.0, w: 0.38, h: 0.42, y: 2.42, n: 2.2 },
    { z: 9.2, w: 0.26, h: 0.3, y: 2.48, n: 2.2 },
    { z: 10.3, w: 0.16, h: 0.2, y: 2.52, n: 2 },
  ];
  B.add(loft(secs, seg), P, null, null, null, true);
  // Hauben (Tandem, Schütze vorn tiefer): Glas + Rahmen
  const cg = [
    { z: -6.55, w: 0.7, h: 0.08, y: 1.95, n: 2.5 },
    { z: -6.1, w: 0.78, h: 0.56, y: 1.94, n: 2.6 },
    { z: -5.2, w: 0.82, h: 0.78, y: 1.86, n: 2.8 },
    { z: -4.75, w: 0.84, h: 0.68, y: 1.95, n: 2.8 },
  ];
  const cp = [
    { z: -4.75, w: 0.86, h: 0.6, y: 2.04, n: 2.6 },
    { z: -4.35, w: 0.9, h: 0.94, y: 2.06, n: 2.8 },
    { z: -3.4, w: 0.98, h: 0.88, y: 2.14, n: 3 },
    { z: -2.75, w: 0.98, h: 0.62, y: 2.3, n: 3 },
  ];
  B.add(loft(cg, seg, { half: true }), M.glass, null, null, null, true);
  B.add(loft(cp, seg, { half: true }), M.glass, null, null, null, true);
  for (const s of [...cg.slice(1), ...cp.slice(1)]) B.add(frameArch(s, 0.022), M.frame);
  // Längsrahmen der Hauben (Seiten + Mitte)
  for (const sx of [-1, 1]) {
    B.add(tube([[sx * 0.78, 1.95, -6.5], [sx * 0.82, 1.88, -5.2], [sx * 0.85, 1.97, -4.75], [sx * 0.9, 2.07, -4.3], [sx * 0.98, 2.15, -3.4], [sx * 0.98, 2.31, -2.75]], 0.03, 5), M.frame);
    B.add(tube([[sx * 0.55, 2.35, -6.0], [sx * 0.58, 2.48, -5.2], [sx * 0.55, 2.5, -4.75]], 0.022, 4), M.frame);
  }
  // Truppenraum: Schiebetüren mit Fenstern, Laufschiene
  for (const sx of [-1, 1]) {
    const x = sx * 1.2;
    B.add(box(0.05, 1.3, 1.65), P, [x + sx * 0.02, 1.78, -1.55]);
    B.add(box(0.06, 0.42, 0.55), M.glass, [x + sx * 0.04, 2.08, -1.78]);
    B.add(box(0.07, 0.48, 0.05), M.frame, [x + sx * 0.04, 2.08, -2.08]);
    B.add(box(0.07, 0.48, 0.05), M.frame, [x + sx * 0.04, 2.08, -1.5]);
    B.add(box(0.07, 0.05, 0.62), M.frame, [x + sx * 0.04, 2.33, -1.78]);
    B.add(box(0.07, 0.05, 0.62), M.frame, [x + sx * 0.04, 1.83, -1.78]);
    B.add(box(0.06, 0.06, 2.6), M.steel, [x + sx * 0.06, 2.62, -1.2]);      // Schiene
    B.add(box(0.05, 0.18, 0.04), M.dark, [x + sx * 0.06, 1.75, -0.8]);      // Griff
    // hintere Fenster (rund)
    if (det) for (const z of [-0.3, 0.45]) B.add(cylY(0.17, 0.17, 0.06, 14), M.glass, [x + sx * 0.01, 2.05, z], [0, 0, HP]);
    // Trittstufen
    B.add(box(0.28, 0.04, 0.22), M.steel, [x + sx * 0.12, 0.62, -1.9]);
  }
  // Heckausleger: Rücken-Verkleidung der Heckrotorwelle, Antennen
  B.add(box(0.26, 0.14, 6.6), P, [0, 2.86, 6.0]);
  if (det) for (let z = 3.4; z < 9; z += 1.1) B.add(box(0.3, 0.05, 0.08), M.dark, [0, 2.95, z]);
  // Seitenleitwerk (gepfeilt) + Höhenleitwerk
  const fin = wing([[0, -0.45], [1.9, 0.45], [1.9, 1.1], [0, 1.15]], 0.16, 0.05);
  B.add(fin, P, [0.08, 2.55, 9.15], [0, 0, HP]);
  const stab = wing([[0, 0], [1.65, 0.25], [1.65, 0.75], [0, 0.85]], 0.1, 0.035);
  B.add(stab, P, [0.2, 2.35, 8.25]);
  B.add(mirrorX(stab.clone()), P, [-0.2, 2.35, 8.25]);
  for (const sx of [-1, 1]) B.add(box(0.06, 0.32, 0.6), P, [sx * 1.85, 2.42, 8.65]); // Endscheiben
  // Hecksporn
  B.add(tube([[0, 2.2, 9.4], [0, 1.65, 10.0], [0, 1.6, 10.3]], 0.045, 5), M.steel);
  // Triebwerke (zwei Gondeln), Einläufe, Auspuff schräg nach außen
  for (const sx of [-1, 1]) {
    const x = sx * 0.62;
    B.add(loft([
      { z: -2.35, w: 0.3, h: 0.3, y: 3.08, x, n: 2.2 }, { z: -2.1, w: 0.42, h: 0.4, y: 3.1, x, n: 2.4 }, { z: 0.5, w: 0.44, h: 0.42, y: 3.12, x, n: 2.6 },
      { z: 1.3, w: 0.36, h: 0.34, y: 3.12, x, n: 2.4 },
    ], det ? 16 : 10), P, null, null, null, true);
    B.add(cylZ(0.26, 0.26, 0.08, 16), M.black, [x, 3.08, -2.36]);                   // Einlauf (dunkel)
    B.add(cylZ(0.12, 0.1, 0.3, 10), M.steel, [x, 3.08, -2.38]);                     // Nabe
    B.add(cylZ(0.24, 0.3, 0.9, 12), M.nozzle, [x + sx * 0.18, 3.12, 1.65], [0, sx * 0.4, 0]);  // Auspuff
    B.add(cylZ(0.23, 0.23, 0.05, 12), M.soot, [x + sx * 0.36, 3.12, 2.07], [0, sx * 0.4, 0]);
    if (det) for (let i = 0; i < 6; i++) B.add(box(0.02, 0.24, 0.5), M.dark, [x + sx * 0.44, 3.1, -1.4 + i * 0.32]); // Kühlschlitze
  }
  // Getriebeverkleidung + Rotormast-Sockel, IR-Störer
  B.add(loft([{ z: -1.9, w: 0.55, h: 0.3, y: 3.15, n: 2.4 }, { z: -1.2, w: 0.66, h: 0.55, y: 3.25, n: 3 }, { z: 0.4, w: 0.66, h: 0.55, y: 3.25, n: 3 }, { z: 1.1, w: 0.4, h: 0.3, y: 3.2, n: 2.4 }], det ? 16 : 10), P, null, null, null, true);
  B.add(cylY(0.2, 0.26, 0.6, 12), M.dark, [0, 3.95, -0.55]);
  if (det) {
    B.add(box(0.3, 0.22, 0.3), M.dark, [0, 3.62, 1.05]);
    B.add(cylY(0.1, 0.1, 0.2, 10), M.glass, [0, 3.83, 1.05]);
    // Antennen, Staurohre, Spiegel
    B.add(cylY(0.012, 0.02, 0.7, 5), M.dark, [0, 3.0, 4.2], [0.35, 0, 0]);
    B.add(cylY(0.01, 0.015, 0.5, 5), M.dark, [0.3, 0.9, 1.4], [PI, 0, 0]);
    for (const sx of [-1, 1]) B.add(cylZ(0.018, 0.018, 0.85, 6), M.steel, [sx * 0.42, 1.55, -8.2]);
    // Lüftungsgitter, Wartungsklappen (erhaben)
    for (const sx of [-1, 1]) { B.add(box(0.03, 0.4, 0.6), P, [sx * 1.19, 2.25, 0.35]); B.add(box(0.03, 0.3, 0.5), P, [sx * 0.86, 1.45, -4.0]); }
  }
  // Stummelflügel mit Anhedral + Raketenbehälter + Lastträger
  for (const sx of [-1, 1]) {
    const w = wing([[0, -0.75], [1.95, -0.55], [1.95, 0.45], [0, 0.75]], 0.2, 0.06);
    B.add(sx > 0 ? w : mirrorX(w), P, [sx * 1.1, 1.55, -1.35], [0, 0, sx * -0.14]);
    const x = sx * 2.65;
    B.add(box(0.12, 0.3, 0.9), M.dark, [x, 1.42, -1.35]);                          // Pylon
    B.add(cylZ(0.29, 0.29, 1.65, 16), M.paint.heli.null, [x, 1.05, -1.3]);           // Behälter
    B.add(cylZ(0.15, 0.29, 0.35, 16), M.paint.heli.null, [x, 1.05, -2.3]);           // Nasenkegel
    if (det) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 6) * PI * 2, r = i === 6 ? 0 : 0.16;
        B.add(cylZ(0.055, 0.055, 0.06, 8), M.black, [x + Math.cos(a) * r, 1.05 + Math.sin(a) * r, -0.45]);
      }
      B.add(box(0.61, 0.05, 0.05), M.band, [x, 1.05, -1.9]);
    }
    // Flügelende: Täuschkörper-Werfer
    B.add(box(0.2, 0.22, 0.42), M.dark, [sx * 3.1, 1.42, -1.1]);
  }
  // Fahrwerk: Bugrad, Haupträder an Stützen
  B.add(cylY(0.05, 0.05, 0.9, 8), M.steel, [0, 0.72, -5.4]);
  B.add(cylY(0.3, 0.3, 0.2, 18), M.rubber, [0, 0.3, -5.4], [0, 0, HP]);
  B.add(cylY(0.15, 0.15, 0.22, 12), M.steel, [0, 0.3, -5.4], [0, 0, HP]);
  for (const sx of [-1, 1]) {
    B.add(tube([[sx * 0.9, 1.0, 0.4], [sx * 1.45, 0.38, 0.55]], 0.06, 6), M.steel);
    B.add(tube([[sx * 0.9, 0.95, 1.1], [sx * 1.45, 0.38, 0.6]], 0.05, 6), M.steel);
    B.add(cylY(0.36, 0.36, 0.24, 18), M.rubber, [sx * 1.5, 0.36, 0.55], [0, 0, HP]);
    B.add(cylY(0.18, 0.18, 0.26, 12), M.steel, [sx * 1.5, 0.36, 0.55], [0, 0, HP]);
    B.add(box(0.5, 0.36, 1.2), P, [sx * 1.15, 0.95, 0.75]);                         // Fahrwerksverkleidung
  }
  // Sensorkugel über dem Kinnturm (Zielerfassung) + Kennung
  B.add(sph(0.27, 16, 12), P, [0, 1.25, -7.62]);
  B.add(box(0.2, 0.16, 0.08), M.glass, [0.0, 1.27, -7.88]);
  B.add(box(0.12, 0.12, 0.08), M.visor, [0.14, 1.2, -7.85]);
  const mk = markingMaterial(P.name.endsWith(':B') ? 'B' : P.name.endsWith(':A') ? 'A' : null);
  for (const sx of [-1, 1]) B.add(new THREE.PlaneGeometry(1.4, 0.35), mk, [sx * 1.215, 1.32, -0.3], [0, sx * HP, 0], null, true);
  for (const sx of [-1, 1]) B.add(new THREE.PlaneGeometry(1.1, 0.28), mk, [sx * 0.43, 2.45, 5.2], [0, sx * HP, 0], null, true);
}

function heliInterior(B, M) {
  // Cockpitwannen, Instrumententafeln mit Bildschirmen, Sitze, Knüppel, Kollektivhebel, Blendschutz
  for (const [z, y, w] of [[-5.6, 1.15, 0.7], [-3.85, 1.42, 0.78]]) {
    B.add(box(w * 2 - 0.1, 0.06, 1.3), M.tub, [0, y - 0.05, z + 0.1]);
    for (const sx of [-1, 1]) B.add(box(0.05, 0.75, 1.3), M.tub, [sx * (w - 0.08), y + 0.32, z + 0.1]);
    B.add(box(w * 1.5, 0.36, 0.1), M.panel, [0, y + 0.52, z - 0.6], [-0.55, 0, 0]);
    B.add(box(w * 1.38, 0.24, 0.02), M.screen, [0, y + 0.54, z - 0.54], [-0.55, 0, 0], null, true);
    B.add(box(w * 1.55, 0.04, 0.16), M.panel, [0, y + 0.74, z - 0.74]);              // Blendschutz
    B.add(box(0.5, 0.08, 0.55), M.seat, [0, y + 0.18, z + 0.15]);
    B.add(box(0.5, 0.72, 0.1), M.seat, [0, y + 0.55, z + 0.45], [0.12, 0, 0]);
    B.add(box(0.32, 0.25, 0.08), M.seat, [0, y + 1.0, z + 0.5]);
    B.add(cylY(0.018, 0.025, 0.36, 6), M.dark, [0, y + 0.32, z - 0.2], [0.15, 0, 0]);
    B.add(box(0.05, 0.05, 0.4), M.dark, [-w + 0.22, y + 0.35, z + 0.05], [-0.3, 0, 0]);
    B.add(box(0.12, 0.1, 0.4), M.panel, [w - 0.22, y + 0.3, z + 0.1]);
  }
  // Truppenraum: Bänke, Haltegurte
  for (const sx of [-1, 1]) {
    B.add(box(0.42, 0.06, 2.4), M.seat, [sx * 0.8, 1.15, -1.5]);
    B.add(box(0.06, 0.6, 2.4), M.seat, [sx * 1.08, 1.5, -1.5]);
  }
  B.add(box(2.2, 0.04, 3.6), M.tub, [0, 0.85, -1.2]);
  B.add(box(2.2, 0.04, 3.6), M.tub, [0, 2.88, -1.2]);
}

function buildHeliRotor(M, det, R) {
  const rotor = new THREE.Group(); rotor.name = 'rotor';
  const blades = new THREE.Group(); blades.name = 'blades';
  const B = new Bucket();
  const n = 5;
  B.add(cylY(0.32, 0.36, 0.22, 16), M.dark, [0, 0, 0]);
  B.add(cylY(0.14, 0.14, 0.5, 10), M.steel, [0, 0.25, 0]);
  B.add(cylY(0.45, 0.45, 0.05, 20), M.steel, [0, -0.32, 0]);                     // Taumelscheibe
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    // Blatt: Wurzel + verwundenes Profil (3 Abschnitte), gelbe Spitze
    const seg = det ? 3 : 1;
    for (let k = 0; k < seg; k++) {
      const r0 = 0.5 + (k / seg) * (R - 0.8), r1 = 0.5 + ((k + 1) / seg) * (R - 0.8);
      const mid = (r0 + r1) / 2, len = r1 - r0;
      const tw = 0.12 - k * 0.05;
      B.add(box(len + 0.02, 0.055, 0.56), M.blade, [c * mid, 0.05 + (mid / R) * 0.12, -s * mid], [tw, a, 0]);
    }
    B.add(box(0.3, 0.05, 0.56), M.tip, [c * (R - 0.45), 0.05, -s * (R - 0.45)], [0, a, 0]);
    B.add(box(0.6, 0.12, 0.2), M.steel, [c * 0.55, 0.02, -s * 0.55], [0, a, 0]);   // Blattanschluss
    if (det) B.add(cylY(0.02, 0.02, 0.35, 5), M.steel, [c * 0.35 - s * 0.12, -0.15, -s * 0.35 - c * 0.12]); // Steuerstange
  }
  B.build(blades);
  rotor.add(blades);
  // Bewegungsunschärfe-Scheibe (je Instanz eigenes Material, Deckkraft nach Drehzahl)
  const dm = new THREE.MeshBasicMaterial({ name: 'air:scheibe', map: M.discTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, color: 0xffffff });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 48).rotateX(-HP), dm);
  disc.name = 'disc'; disc.position.y = 0.06; disc.renderOrder = 5; disc.visible = false;
  rotor.add(disc);
  return rotor;
}

function buildTailRotor(M, r) {
  const g = new THREE.Group(); g.name = 'tail';
  const blades = new THREE.Group(); blades.name = 'tblades';
  const B = new Bucket();
  B.add(cylY(0.12, 0.12, 0.2, 10), M.dark, [0, 0, 0], [0, 0, HP]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2;
    B.add(box(0.03, r - 0.15, 0.2), M.blade, [0.08, Math.cos(a) * (r / 2 + 0.05), Math.sin(a) * (r / 2 + 0.05)], [a, 0, 0]);
    B.add(box(0.035, 0.18, 0.2), M.tip, [0.08, Math.cos(a) * (r - 0.12), Math.sin(a) * (r - 0.12)], [a, 0, 0]);
  }
  B.build(blades);
  g.add(blades);
  const dm = new THREE.MeshBasicMaterial({ name: 'air:heckscheibe', map: M.discTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24).rotateY(HP), dm);
  disc.name = 'tdisc'; disc.position.x = 0.08; disc.visible = false;
  g.add(disc);
  return g;
}

function buildChinTurret(M, P) {
  const g = new THREE.Group(); g.name = 'mg';
  const B = new Bucket();
  B.add(sph(0.3, 16, 12), P, [0, 0, 0]);
  B.add(box(0.34, 0.26, 0.5), M.dark, [0, -0.04, -0.25]);
  B.add(cylZ(0.06, 0.06, 1.1, 10), M.dark, [0, -0.05, -0.75]);
  B.add(cylZ(0.085, 0.085, 0.18, 10), M.steel, [0, -0.05, -1.3]);
  B.add(cylZ(0.11, 0.1, 0.35, 10), M.dark, [0, -0.05, -0.35]);
  B.add(box(0.06, 0.12, 0.6), M.dark, [0.18, -0.02, -0.15]);                     // Gurtzuführung
  B.build(g);
  return g;
}

function buildHeli(team, quality) {
  const M = airMaterials();
  const D = VEHICLES.heli;
  const P = M.paint.heli[team ?? 'null'];
  const root = new THREE.Group(); root.name = 'air:heli';
  const lod = new THREE.LOD();
  for (const det of [1, 0]) {
    const lv = new THREE.Group();
    const B = new Bucket();
    heliFuselage(B, M, P, det);
    if (det) heliInterior(B, M);
    if (det && quality !== 'low') { heliDetailHQ(B, M, P); heliInteriorHQ(B, M); } // Nutzer 14.11.: Detailstufe
    B.build(lv);
    lod.addLevel(lv, det ? 0 : LOD_DIST[quality] || 150);
  }
  root.add(lod);
  const F = D.flight;
  const rotor = buildHeliRotor(M, quality !== 'low', F.rotorR);
  rotor.position.fromArray(F.hub);
  root.add(rotor);
  const tail = buildTailRotor(M, F.tailR);
  tail.position.fromArray(F.tailRotor);
  root.add(tail);
  const mg = buildChinTurret(M, P);
  mg.position.fromArray(D.mgPivot);
  root.add(mg);
  addNavLights(root, M, [[-3.2, 1.52, -1.1], [3.2, 1.52, -1.1], [0, 4.45, 10.05], [0, 0.55, -1.0]]);
  addOccupants(root, M, D);
  addLamp(root, M, D.lights);
  return root;
}

/* =================================================================== JK-9 Falke */

function jetFuselage(B, M, P, det) {
  const seg = det ? 24 : 12;
  const secs = [
    { z: -8.35, w: 0.04, h: 0.04, y: 2.0, n: 2 },
    { z: -7.9, w: 0.24, h: 0.24, y: 2.0, n: 2 },
    { z: -6.9, w: 0.5, h: 0.5, y: 2.02, n: 2.1 },
    { z: -5.6, w: 0.68, ht: 0.56, hb: 0.6, y: 2.05, n: 2.3 },
    { z: -4.3, w: 0.76, ht: 0.52, hb: 0.66, y: 2.08, n: 2.5 },
    { z: -2.8, w: 0.86, ht: 0.58, hb: 0.72, y: 2.06, n: 2.8 },
    { z: -1.0, w: 1.12, ht: 0.7, hb: 0.74, y: 2.0, n: 3.2 },
    { z: 2.0, w: 1.18, ht: 0.66, hb: 0.74, y: 1.98, n: 3.4 },
    { z: 4.6, w: 1.0, ht: 0.64, hb: 0.68, y: 2.0, n: 3 },
    { z: 6.3, w: 0.72, h: 0.66, y: 2.02, n: 2.4 },
    { z: 7.25, w: 0.6, h: 0.6, y: 2.02, n: 2.2 },
  ];
  B.add(loft(secs, seg, { capEnd: false }), P, null, null, null, true);
  // Rücken (Wirbelsäule hinter der Haube) und Bauch-Kiele
  B.add(loft([{ z: -2.6, w: 0.35, h: 0.2, y: 2.72, n: 2.4 }, { z: 0, w: 0.45, h: 0.3, y: 2.62, n: 2.6 }, { z: 4.6, w: 0.4, h: 0.22, y: 2.55, n: 2.6 }, { z: 6.4, w: 0.15, h: 0.08, y: 2.5, n: 2 }], det ? 14 : 8), P, null, null, null, true);
  // Haube (Tropfenform) + Rahmen
  const cn = [
    { z: -5.75, w: 0.4, h: 0.05, y: 2.62, n: 2.2 },
    { z: -5.2, w: 0.56, h: 0.36, y: 2.62, n: 2.4 },
    { z: -4.1, w: 0.62, h: 0.56, y: 2.62, n: 2.5 },
    { z: -3.0, w: 0.58, h: 0.52, y: 2.66, n: 2.5 },
    { z: -2.25, w: 0.45, h: 0.3, y: 2.72, n: 2.4 },
  ];
  B.add(loft(cn, seg, { half: true }), M.glass, null, null, null, true);
  B.add(frameArch(cn[1], 0.026, 12, 0.01), M.frame);
  for (const sx of [-1, 1]) B.add(tube([[sx * 0.4, 2.63, -5.75], [sx * 0.57, 2.63, -5.2], [sx * 0.63, 2.63, -4.1], [sx * 0.58, 2.67, -3.0], [sx * 0.45, 2.73, -2.25]], 0.03, 5), M.frame);
  // Lufteinläufe beidseits (Kastenform), dunkle Öffnung, Grenzschichtplatte
  for (const sx of [-1, 1]) {
    const x = sx * 1.12;
    B.add(loft([
      { z: -3.1, w: 0.36, ht: 0.42, hb: 0.42, y: 1.82, x, n: 4 }, { z: -2.2, w: 0.42, h: 0.48, y: 1.82, x, n: 4 }, { z: 1.2, w: 0.38, h: 0.44, y: 1.85, x: sx * 0.96, n: 4 },
    ], det ? 14 : 8, { capStart: false }), P, null, null, null, true);
    B.add(box(0.62, 0.78, 0.04), M.black, [x, 1.82, -3.05]);
    B.add(box(0.04, 0.95, 0.9), M.steel, [sx * 0.74, 1.84, -3.0]);
  }
  // Flügel (beschnittenes Delta) + Vorderkantenwurzel
  for (const sx of [-1, 1]) {
    const w = wing([[0, -1.6], [4.25, 2.5], [4.25, 3.75], [0, 4.65]], 0.18, 0.06);
    B.add(sx > 0 ? w : mirrorX(w), P, [sx * 0.95, 1.72, 0], [0, 0, sx * -0.04]);
    const lx = wing([[0, -3.6], [0.55, -1.4], [0.55, 0], [0, 0]], 0.08, 0.03);
    B.add(sx > 0 ? lx : mirrorX(lx), P, [sx * 0.95, 1.86, 0]);
    // Flügelspitze: Startschiene
    B.add(box(0.12, 0.12, 1.7), M.dark, [sx * 5.25, 1.78, 3.0]);
  }
  // Schubdüse (Lamellen) + Düsenring
  B.add(cylZ(0.6, 0.54, 0.5, 20), M.nozzle, [0, 2.02, 7.5]);
  if (det) for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2; B.add(box(0.2, 0.03, 0.55), M.nozzle, [Math.cos(a) * 0.55, 2.02 + Math.sin(a) * 0.55, 7.55], [0, 0, a + HP]); }
  B.add(cylZ(0.46, 0.46, 0.05, 20), M.soot, [0, 2.02, 7.4]);
  // Bordkanone links (Mündungsöffnung), Staurohr, Antennen, Kennung
  B.add(cylZ(0.05, 0.05, 0.4, 8), M.black, [-0.62, 1.95, -5.45]);
  B.add(cylZ(0.012, 0.02, 0.6, 6), M.steel, [0, 2.0, -8.5]);
  if (det) {
    B.add(box(0.03, 0.25, 0.3), M.dark, [0, 2.92, -1.6], [0, 0, 0]);
    B.add(box(0.03, 0.18, 0.25), M.dark, [0, 1.25, 1.0], [PI, 0, 0]);
    for (const sx of [-1, 1]) B.add(box(0.03, 0.12, 0.3), M.dark, [sx * 0.55, 1.4, -6.0], [0, 0, sx * 0.5]);
    // Luftbremse/Klappen-Linien als erhabene Paneele
    B.add(box(0.9, 0.03, 1.2), P, [0, 2.84, 3.2]);
  }
  const mk = markingMaterial(P.name.endsWith(':B') ? 'B' : P.name.endsWith(':A') ? 'A' : null);
  for (const sx of [-1, 1]) B.add(new THREE.PlaneGeometry(1.2, 0.3), mk, [sx * 0.78, 2.0, -4.9], [0, sx * HP, 0], null, true);
}

function jetInterior(B, M) {
  B.add(box(1.0, 0.06, 2.2), M.tub, [0, 1.82, -3.6]);
  for (const sx of [-1, 1]) B.add(box(0.05, 0.62, 2.0), M.tub, [sx * 0.55, 2.2, -3.6]);
  B.add(box(0.9, 0.34, 0.1), M.panel, [0, 2.6, -4.5], [-0.45, 0, 0]);
  B.add(box(0.8, 0.22, 0.02), M.screen, [0, 2.62, -4.44], [-0.45, 0, 0], null, true);
  B.add(box(0.8, 0.035, 0.16), M.panel, [0, 2.79, -4.6]);
  B.add(box(0.2, 0.15, 0.006), M.hud, [0, 2.9, -4.55], [0.35, 0, 0]);             // HUD-Glas
  B.add(box(0.03, 0.08, 0.03), M.dark, [0, 2.83, -4.57]);
  // Schleudersitz
  B.add(box(0.52, 0.12, 0.55), M.seat, [0, 1.98, -3.3]);
  B.add(box(0.52, 0.85, 0.14), M.seat, [0, 2.45, -2.98], [0.22, 0, 0]);
  B.add(box(0.36, 0.3, 0.12), M.seat, [0, 3.0, -2.86], [0.22, 0, 0]);
  B.add(box(0.06, 0.2, 0.06), M.band, [0, 2.38, -3.62]);                          // Abzugsgriff
  B.add(cylY(0.018, 0.024, 0.3, 6), M.dark, [0.18, 2.12, -3.65]);                 // Seitenknüppel
  B.add(box(0.07, 0.1, 0.3), M.panel, [-0.36, 2.15, -3.4]);                       // Schubhebel
  for (const sx of [-1, 1]) B.add(box(0.18, 0.08, 0.9), M.panel, [sx * 0.4, 2.1, -3.4]);
}

function buildJet(team, quality) {
  const M = airMaterials();
  const D = VEHICLES.jet;
  const P = M.paint.jet[team ?? 'null'];
  const root = new THREE.Group(); root.name = 'air:jet';
  const lod = new THREE.LOD();
  for (const det of [1, 0]) {
    const lv = new THREE.Group();
    const B = new Bucket();
    jetFuselage(B, M, P, det);
    if (det) jetInterior(B, M);
    if (det && quality !== 'low') { jetDetailHQ(B, M, P); jetInteriorHQ(B, M); }
    B.build(lv);
    lod.addLevel(lv, det ? 0 : LOD_DIST[quality] || 150);
  }
  root.add(lod);
  // Bewegliche Flächen: Querruder (Flügelhinterkante), Höhenruder (Pendel), Seitenruder in den Leitwerken
  const surf = {};
  for (const sx of [-1, 1]) {
    const k = sx < 0 ? 'L' : 'R';
    const ail = new THREE.Group(); ail.position.set(sx * 3.3, 1.81, 4.05); ail.name = `quer${k}`;
    const B1 = new Bucket(); B1.add(box(2.0, 0.08, 0.5), P, [0, 0, 0.25]); B1.build(ail);
    root.add(ail); surf['ail' + k] = ail;
    const st = new THREE.Group(); st.position.set(sx * 1.05, 2.0, 7.0); st.name = `hoehe${k}`;
    const sw = wing([[0, -0.7], [2.0, 0.3], [2.0, 0.95], [0, 0.95]], 0.1, 0.035);
    const B2 = new Bucket(); B2.add(sx > 0 ? sw : mirrorX(sw), P, [0, -0.05, 0]); B2.build(st);
    root.add(st); surf['stab' + k] = st;
    // Seitenleitwerk (gekantet) mit Ruder
    const fin = new THREE.Group(); fin.position.set(sx * 0.95, 2.5, 4.7); fin.rotation.z = sx * -0.38; fin.name = `flosse${k}`;
    const B3 = new Bucket();
    B3.add(wing([[0, 0], [2.2, 1.8], [2.2, 2.7], [0, 2.9]], 0.12, 0.04), P, [0.06, 0, 0], [0, 0, HP]);
    B3.add(box(0.06, 0.12, 0.25), M.navW, [0, 2.2, 2.7]);
    B3.build(fin);
    const rud = new THREE.Group(); rud.position.set(0, 1.05, 2.75); rud.name = `ruder${k}`;
    const B4 = new Bucket(); B4.add(box(0.08, 1.7, 0.42), P, [0, 0, 0.2]); B4.build(rud);
    fin.add(rud); surf['rud' + k] = rud;
    root.add(fin);
  }
  // Fahrwerk (einfahrbar): Bein + Rad je Station
  const gear = new THREE.Group(); gear.name = 'gear';
  const legs = [];
  for (const [x, z, r, len] of [[0, -4.9, 0.3, 1.25], [-1.7, 1.1, 0.4, 1.0], [1.7, 1.1, 0.4, 1.0]]) {
    const leg = new THREE.Group(); leg.position.set(x, r + len, z);
    const B = new Bucket();
    B.add(cylY(0.06, 0.07, len, 8), M.steel, [0, -len / 2, 0]);
    B.add(cylY(r, r, 0.24, 18), M.rubber, [0, -len, 0], [0, 0, HP]);
    B.add(cylY(r * 0.5, r * 0.5, 0.26, 12), M.steel, [0, -len, 0], [0, 0, HP]);
    B.add(box(0.05, len * 0.9, 0.5), P, [x ? Math.sign(x) * 0.18 : 0.2, -len * 0.45, 0]);  // Fahrwerkstür
    if (quality !== 'low') jetGearDetailHQ(B, M, r, len, !x);
    B.build(leg);
    leg.userData.side = Math.sign(x);
    gear.add(leg); legs.push(leg);
  }
  root.add(gear);
  // Außenlasten: Raketenbehälter (bleiben), Bomben (fallen sichtbar weg)
  const stores = new THREE.Group(); stores.name = 'stores';
  const B5 = new Bucket();
  for (const sx of [-1, 1]) {
    const x = sx * 3.15;
    B5.add(box(0.1, 0.25, 1.1), M.dark, [x, 1.6, 0.4]);
    B5.add(cylZ(0.22, 0.22, 1.8, 14), M.paint.jet.null, [x, 1.25, 0.3]);
    B5.add(cylZ(0.1, 0.22, 0.35, 14), M.paint.jet.null, [x, 1.25, -0.75]);
    for (const xx of [sx * 1.9, sx * 1.15]) B5.add(box(0.08, 0.2, 0.9), M.dark, [xx, 1.62, 0.8]);
  }
  B5.build(stores);
  root.add(stores);
  const bombs = [];
  for (const hp of [[-1.9, 1.05, 0.6], [1.9, 1.05, 0.6], [-1.15, 1.05, 0.9], [1.15, 1.05, 0.9]]) {
    const b = new THREE.Group(); b.position.fromArray(hp); b.position.y += 0.28;
    const B6 = new Bucket(); bombGeom(B6, M); B6.build(b);
    stores.add(b); bombs.push(b);
  }
  // Nachbrenner-Flamme (je Instanz eigenes Material)
  const fm = new THREE.MeshBasicMaterial({ name: 'air:flamme', map: M.flameTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xffffff });
  const flame = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.05, 3.6, 16, 1, true).rotateX(-HP).translate(0, 0, 1.8), fm);
  flame.position.set(0, 2.02, 7.7); flame.name = 'flame'; flame.visible = false; flame.renderOrder = 6;
  const glowM = new THREE.MeshBasicMaterial({ name: 'air:glut', color: 0xff8a3a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20), glowM);
  glow.position.set(0, 2.02, 7.42); glow.name = 'glow';
  root.add(flame, glow);
  addNavLights(root, M, [[-5.3, 1.8, 2.3], [5.3, 1.8, 2.3], [0, 2.1, 7.8], [0, 1.08, 0.2]]);
  addOccupants(root, M, D);
  addLamp(root, M, D.lights);
  root.userData.surf = surf; root.userData.legs = legs; root.userData.bombs = bombs;
  return root;
}

function bombGeom(B, M) {
  B.add(cylZ(0.17, 0.17, 1.5, 14), M.bomb, [0, 0, 0]);
  B.add(new THREE.SphereGeometry(0.17, 14, 8, 0, PI * 2, 0, HP).rotateX(-HP), M.bomb, [0, 0, -0.75]);
  B.add(cylZ(0.17, 0.06, 0.55, 14), M.bomb, [0, 0, 1.02]);
  for (let i = 0; i < 4; i++) B.add(box(0.02, 0.36, 0.32), M.bomb, [0, 0, 1.15], [0, 0, (i * PI) / 4 + PI / 4]);
  B.add(cylZ(0.175, 0.175, 0.06, 14), M.band, [0, 0, -0.5]);
}

/* =================================================================== Gemeinsames */

function addNavLights(root, M, pts) {
  const g = new THREE.SphereGeometry(0.07, 8, 6);
  const mats = [M.navR, M.navG, M.navW, M.navR];
  pts.forEach((p, i) => { const m = new THREE.Mesh(g, mats[i]); m.position.fromArray(p); m.name = i === 3 ? 'beacon' : 'nav'; root.add(m); });
}

function addLamp(root, M, lights) {
  const V = M.V;
  for (const p of lights || []) {
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 14).rotateX(HP), V.lensOff);
    lens.position.fromArray(p); lens.position.y -= 0.02; lens.userData.lens = true;
    root.add(lens);
  }
}

function addOccupants(root, M, D) {
  D.seats.forEach((s, i) => {
    if (!s.cabin) return;
    const f = figure(M, { helmet: true, stick: !!s.drive || s.mount === 'mg' });
    f.position.set(s.pos[0], s.pos[1] + 0.12, s.pos[2]);
    f.name = `occ:${i}`;
    f.visible = false;
    root.add(f);
  });
}

function template(type, team, quality) {
  const key = `${type}:${team}:${quality}`;
  let t = TEMPLATES.get(key);
  if (!t) { t = type === 'jet' ? buildJet(team, quality) : buildHeli(team, quality); TEMPLATES.set(key, t); }
  return t;
}

/** Vorlagen vorbauen (Spawn ohne Ruckler). */
export function prepareAirModels(types, teams = ['A', 'B'], quality = 'high') {
  for (const t of types) for (const tm of teams) template(t, tm, quality);
}

export function createAirModel(type, { team = null, quality = 'high' } = {}) {
  const tpl = template(type, team, quality);
  const root = tpl.clone(true);
  const model = {
    root, type, turret: null, gun: null, cmg: null,
    mg: root.getObjectByName('mg') || null,
    wheels: [], trackMats: [], trackK: [1, 1], trackLen: [1, 1], lenses: [], cones: [], meshes: [], occ: [], hatches: {},
    lightsOn: false, wrecked: false, interior: false,
  };
  const own = [];
  root.traverse((o) => {
    if (o.isMesh) { model.meshes.push(o); o.userData.baseMat = o.material; if (o.userData.lens) model.lenses.push(o); }
    if (o.name && o.name.startsWith('occ:')) model.occ[+o.name.slice(4)] = o;
  });
  // Je Instanz eigene Materialien für Scheiben/Flamme (Deckkraft je Luftfahrzeug)
  const inst = (name) => {
    const o = root.getObjectByName(name);
    if (o && o.material) { o.material = o.material.clone(); o.userData.baseMat = o.material; own.push(o.material); }
    return o;
  };
  const rotor = root.getObjectByName('rotor'), blades = root.getObjectByName('blades'), disc = inst('disc');
  const tail = root.getObjectByName('tail'), tblades = root.getObjectByName('tblades'), tdisc = inst('tdisc');
  const flame = inst('flame'), glow = inst('glow');
  const beacons = [];
  root.traverse((o) => { if (o.name === 'beacon') beacons.push(o); });
  const surf = {}, legs = [], bombs = [];
  if (type === 'jet') {
    for (const k of ['ailL', 'ailR', 'stabL', 'stabR', 'rudL', 'rudR']) {
      const nm = { ailL: 'querL', ailR: 'querR', stabL: 'hoeheL', stabR: 'hoeheR', rudL: 'ruderL', rudR: 'ruderR' }[k];
      surf[k] = root.getObjectByName(nm);
    }
    const g = root.getObjectByName('gear');
    if (g) for (const c of g.children) legs.push(c);
    const st = root.getObjectByName('stores');
    if (st) for (const c of st.children) if (c.isGroup) bombs.push(c);
  }
  let blink = 0;
  model.setRotor = (main, tailA, rpm, alive) => {
    if (!rotor) return;
    rotor.rotation.y = main;
    const blur = alive ? THREE.MathUtils.smoothstep(rpm, 0.3, 0.85) : 0;
    if (disc) { disc.visible = blur > 0.02 && !model.wrecked; disc.material.opacity = blur * 0.85; }
    if (blades) blades.visible = !model.wrecked && blur < 0.92;
    if (tail) { tail.rotation.x = tailA; if (tdisc) { tdisc.visible = blur > 0.02 && !model.wrecked; tdisc.material.opacity = blur * 0.8; } if (tblades) tblades.visible = blur < 0.9; }
    blink = (blink + 1) % 90;
    for (const b of beacons) b.visible = alive && rpm > 0.1 && blink < 8;
  };
  model.setJet = ({ thr = 0, ab = 0, gear = 1, pitch = 0, roll = 0, yaw = 0, brake = false } = {}) => {
    if (surf.ailL) { surf.ailL.rotation.x = roll * 0.35; surf.ailR.rotation.x = -roll * 0.35; }
    if (surf.stabL) { surf.stabL.rotation.x = pitch * 0.25 - roll * 0.12; surf.stabR.rotation.x = pitch * 0.25 + roll * 0.12; }
    if (surf.rudL) { surf.rudL.rotation.y = -yaw * 0.4; surf.rudR.rotation.y = -yaw * 0.4; }
    for (const l of legs) {
      l.visible = gear > 0.04;
      l.rotation.x = (1 - gear) * (l.userData.side ? 0 : -1.4);
      l.rotation.z = (1 - gear) * (l.userData.side || 0) * 1.4;
    }
    if (flame) {
      const a = model.wrecked ? 0 : ab;
      flame.visible = a > 0.03;
      flame.material.opacity = a * (0.75 + Math.random() * 0.25);
      flame.scale.set(1, 1, 0.55 + a * 0.6 + Math.random() * 0.08);
    }
    if (glow) glow.material.opacity = model.wrecked ? 0 : Math.min(1, 0.15 + thr * 0.5 + ab * 0.6);
    void brake;
    blink = (blink + 1) % 90;
    for (const b of beacons) b.visible = !model.wrecked && thr > 0.02 && blink < 8;
  };
  model.setStores = (n) => { bombs.forEach((b, i) => { b.visible = i < n && !model.wrecked; }); };
  const V = vehicleMaterials();
  model.setLights = (on) => {
    model.lightsOn = !!on && !model.wrecked;
    for (const l of model.lenses) l.material = model.lightsOn ? V.lensOn : V.lensOff;
  };
  model.setOccupant = (i, on) => { const o = model.occ[i]; if (o) o.visible = !!on && !model.wrecked; };
  model.setInterior = (on) => { model.interior = !!on; };
  model.setWreck = (on) => {
    model.wrecked = !!on;
    for (const o of model.meshes) {
      const base = o.userData.baseMat;
      if (!base) continue;
      if (on) {
        if (base.transparent || base === airMaterials().screen || o.userData.lens) { o.visible = false; continue; }
        o.material = V.wreck;
      } else { o.visible = true; o.material = base; }
    }
    if (on) {
      for (const o of model.occ) if (o) o.visible = false;
      if (blades) { blades.visible = true; blades.scale.set(0.45, 1, 0.45); } // abgerissene Blattstümpfe
      if (disc) disc.visible = false;
      if (tdisc) tdisc.visible = false;
      if (flame) flame.visible = false;
      model.setLights(false);
    }
  };
  model.dispose = () => { for (const m of own) m.dispose(); };
  return model;
}

/** Körper im Flug (ShellPool, look 'rocket' | 'bomb'): kleines Modell, geteilte Geometrie. */
const PROJ = {};
export function airProjectileMesh(look) {
  const M = airMaterials();
  if (!PROJ[look]) {
    const B = new Bucket();
    if (look === 'bomb') bombGeom(B, M);
    else {
      B.add(cylZ(0.04, 0.04, 1.2, 8), M.missile, [0, 0, 0]);
      B.add(cylZ(0.0, 0.04, 0.22, 8), M.missile, [0, 0, -0.71]);
      for (let i = 0; i < 4; i++) B.add(box(0.01, 0.16, 0.14), M.dark, [0, 0, 0.55], [0, 0, (i * PI) / 2]);
    }
    const g = new THREE.Group();
    B.build(g, false);
    PROJ[look] = g;
  }
  const o = PROJ[look].clone(true);
  // ShellPool richtet +Z entlang der Flugbahn aus, die Körper zeigen nach −Z
  o.rotation.set(0, PI, 0);
  const w = new THREE.Group(); w.add(o);
  return w;
}

/** Dreiecke je Typ (Prüfung/Budget). */
export function airTriangles(type, quality = 'high') {
  const t = template(type, 'A', quality);
  let n = 0;
  t.traverse((o) => { if (o.isMesh && o.geometry) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return Math.round(n);
}
