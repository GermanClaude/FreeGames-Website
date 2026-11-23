// NULLPUNKT — Fahrzeugmaterialien (geteilt, überdauern Matches wie die Viewmodel-Materialien).
//
// Sofort verfügbar: prozedurale Materialien aus engine/textures.js (geklont, eigene Tönung). Danach im Hintergrund
// Aufwertung auf die CC0-Fotoscan-Sätze der Bibliothek (assets/lib/loader.js: metal_painted, gunmetal_worn,
// rubber, canvas, metal_rust_painted) – die Material-Objekte bleiben dieselben, nur die Texturen werden getauscht
// (kein Neuzuweisen an Meshes, keine Shader-Varianten-Explosion: map/normalMap/ORM gibt es in beiden Fällen).
import * as THREE from 'three';
import { getMaterial } from '../engine/textures.js?v=20261123115551';
import { assets, tierFor } from '../../../lib/loader.js?v=20261123115551';
import { addShaderPatch, removeShaderPatch } from '../world/shading.js?v=20261123115551';

let SET = null;
let upgrading = null;

/** Teamfarben der Lackierung (A = Oliv, B = Sand-Grau) und Kennung (A blau, B rot – wie Killfeed/Minikarte). */
export const TEAM_TINT = { A: 0x55613f, B: 0x8c7d5c, null: 0x5f6458 };
export const TEAM_MARK = { A: 0x3d7fe0, B: 0xd8432c, null: 0xd8d2c0 };

function fromBase(name, params) {
  let base = null;
  try { base = getMaterial(name); } catch { base = null; }
  const m = base ? base.clone() : new THREE.MeshStandardMaterial();
  m.name = `veh:${name}`;
  Object.assign(m, params);
  if (params.color != null) m.color = new THREE.Color(params.color);
  return m;
}

/** Autoglas: leicht grün-grau getönt; Deckung steigt zum flachen Blickwinkel (Fresnel), starke Umgebungsspiegelung. */
function carGlassMaterial() {
  const m = new THREE.MeshStandardMaterial({ name: 'veh:autoglas', color: 0x1a2423, roughness: 0.02, metalness: 0.0, transparent: true, opacity: 0.42, depthWrite: false, envMapIntensity: 2.2 });
  addShaderPatch(m, 'carGlass', (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      {
        float npF = pow( 1.0 - clamp( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 ), 4.0 );
        diffuseColor.a = mix( diffuseColor.a, 0.96, npF );
        outgoingLight += vec3( 0.04 ) * npF;
      }
      #include <opaque_fragment>`);
  });
  return m;
}

/** Genarbter Kunststoff: feine Narbung als Normalen-Störung im Shader (Fahrzeugraum aVeh), matt. */
function grainPlastic() {
  const m = new THREE.MeshStandardMaterial({ name: 'veh:narbung', color: 0x1b1c1e, roughness: 0.78, metalness: 0.0 });
  addShaderPatch(m, 'grain', (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aVeh;\nvarying vec3 vGrP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrP = aVeh;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vGrP;
      float grH( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec3 q = vGrP * 900.0;
        vec3 g = vec3( grH( floor( q ) ), grH( floor( q ) + 7.1 ), grH( floor( q ) + 3.7 ) ) - 0.5;
        float fw = clamp( 1.0 - length( fwidth( q ) ) * 0.25, 0.0, 1.0 );
        normal = normalize( normal + g * 0.18 * fw );
        roughnessFactor = clamp( roughnessFactor + ( g.x ) * 0.12 * fw, 0.0, 1.0 );
      }`);
  });
  return m;
}

/** Kettenglieder (Kanvas, 64×256): Platten mit Stegen, dunkler Stahl. */
function trackTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#26241f'; g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 4; i++) {
    const x = i * 32;
    g.fillStyle = '#3b3833'; g.fillRect(x + 2, 4, 26, 56);
    g.fillStyle = '#4c4842'; g.fillRect(x + 6, 6, 4, 52); g.fillRect(x + 18, 6, 4, 52);
    g.fillStyle = '#17150f'; g.fillRect(x + 29, 0, 3, 64);
    g.fillStyle = '#5a554c'; g.fillRect(x + 12, 28, 6, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** env-look (medium+): Kettenglieder 256×128 mit Greifstegen, Bolzen, Verschleiß + passende Normalenkarte (aus Höhe). */
function trackTextureHQ() {
  const W = 256, H = 128, hc = document.createElement('canvas'); hc.width = W; hc.height = H;
  const h = hc.getContext('2d');
  h.fillStyle = '#000'; h.fillRect(0, 0, W, H);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#1f1d19'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const x = i * 64;
    // Platte
    g.fillStyle = '#3a3731'; g.fillRect(x + 3, 6, 54, 116);
    h.fillStyle = '#6a6a6a'; h.fillRect(x + 3, 6, 54, 116);
    // Greifsteg (quer) + Führungszahn (Mitte)
    g.fillStyle = '#56524a'; g.fillRect(x + 22, 6, 12, 116);
    h.fillStyle = '#f0f0f0'; h.fillRect(x + 22, 6, 12, 116);
    g.fillStyle = '#2b2925'; g.fillRect(x + 24, 54, 8, 20);
    h.fillStyle = '#ffffff'; h.fillRect(x + 23, 52, 10, 24);
    // Bolzen + Gummipolster
    for (const y of [16, 104]) { g.fillStyle = '#6b665c'; g.beginPath(); g.arc(x + 10, y, 4, 0, 7); g.arc(x + 48, y, 4, 0, 7); g.fill(); h.fillStyle = '#9a9a9a'; h.beginPath(); h.arc(x + 10, y, 4, 0, 7); h.arc(x + 48, y, 4, 0, 7); h.fill(); }
    g.fillStyle = '#141311'; g.fillRect(x + 58, 0, 6, H);
    // Endverbinder an beiden Kettenrändern (auch auf der Flanke sichtbar: v 0 … 0,08) mit Keilschraube
    for (const y of [0, 117]) {
      g.fillStyle = '#4d4941'; g.fillRect(x + 2, y, 54, 11);
      g.fillStyle = 'rgba(160,152,138,0.45)'; g.fillRect(x + 2, y + (y ? 0 : 9), 54, 2);
      g.fillStyle = '#26241f'; g.beginPath(); g.arc(x + 29, y + 5.5, 3.2, 0, 7); g.fill();
      h.fillStyle = '#c8c8c8'; h.fillRect(x + 2, y, 54, 11);
      h.fillStyle = '#e8e8e8'; h.beginPath(); h.arc(x + 29, y + 5.5, 3.2, 0, 7); h.fill();
    }
    // blanker Verschleiß an den Stegkanten
    g.fillStyle = 'rgba(150,145,135,0.35)'; g.fillRect(x + 22, 6, 2, 116); g.fillRect(x + 32, 6, 2, 116);
  }
  // Schmutz in den Fugen
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(52,42,30,${Math.random() * 0.35})`; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 1 + Math.random() * 4, 0, 7); g.fill(); }
  const hd = h.getImageData(0, 0, W, H).data, nc = document.createElement('canvas'); nc.width = W; nc.height = H;
  const nx = nc.getContext('2d'), out = nx.createImageData(W, H);
  const at = (x, y) => hd[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 3, dy = (at(x, y + 1) - at(x, y - 1)) * 3, l = Math.hypot(dx, dy, 1), o = (y * W + x) * 4;
    out.data[o] = (-dx / l * 0.5 + 0.5) * 255; out.data[o + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[o + 3] = 255;
  }
  nx.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  const n = new THREE.CanvasTexture(nc); n.wrapS = n.wrapT = THREE.RepeatWrapping; n.anisotropy = 4;
  return { map: t, normal: n };
}

/** Taktische Kennung (Schablone): Winkel + Nummer, weiß-grau, verwittert; je Team eine Textur (256×64). */
function markingTexture(team) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = 'rgba(226,222,208,0.92)';
  g.font = '700 46px monospace'; g.textBaseline = 'middle';
  // Winkel (A: ^, B: Balken) – lesbar wie echte Verbandsabzeichen, ohne reale Hoheitszeichen
  if (team === 'B') { g.fillRect(14, 20, 44, 9); g.fillRect(14, 35, 44, 9); } else { g.beginPath(); g.moveTo(12, 50); g.lineTo(36, 12); g.lineTo(60, 50); g.lineTo(50, 50); g.lineTo(36, 28); g.lineTo(22, 50); g.fill(); }
  g.fillText(team === 'B' ? '3 4' : team === 'A' ? '2 1' : '0 7', 84, 34);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 700; i++) { g.globalAlpha = Math.random() * 0.7; g.fillRect(Math.random() * 256, Math.random() * 64, 1 + Math.random() * 3, 1 + Math.random() * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// env-look: Tarnung (3 Töne je Team als Faktor auf die Teamtönung), Schlamm nach Höhe über Grund, Staub auf
// Oberseiten, Lackabplatzer – alles im Fahrzeugraum (Attribut aVeh aus models.js), keine Textur, nur medium+.
const CAMO = { A: [0x39452e, 0x5c4f37], B: [0x6b5d43, 0xa69c80], null: [0x4a4f45, 0x6c6a5c] };
const _ca = new THREE.Color(), _cb = new THREE.Color();
const LOOK_U = {}; // Tarn-Uniforms je Team (Panzer-Tarnungen, setVehicleSkin)

/**
 * Panzer-Tarnung (vehicles/skins.js) für die Fahrzeuge eines Teams: Grundlack + zwei Tarntöne; skin = null → Teamstandard.
 * Wirkt auf die geteilten Lackmaterialien (alle Fahrzeuge des Teams auf diesem Gerät).
 */
export function setVehicleSkin(team, skin) {
  const k = team ?? 'null', S = vehicleMaterials(), m = S.paint[k];
  if (!m) return;
  const custom = !!(skin && skin.base != null);
  // Epochenlacke (eraPaint) des Teams: eigene Grundfarbe/Tarntöne der Epoche, die gewählte Tarnung überschreibt beide
  for (const [key, em] of Object.entries(S.paintEra)) {
    const [tk, era] = key.split('|');
    if (tk !== k) continue;
    const E = ERA_LOOK[era];
    const eb = custom ? skin.base : E.tint[k] ?? E.tint.null;
    em.color.setHex(eb);
    const eu = LOOK_U[key];
    if (!eu) continue;
    const [e2, e3] = custom ? [skin.c2, skin.c3] : E.camo[k] || E.camo.null;
    _ca.setHex(eb);
    for (const [uk, hex] of [['uCamo2', e2], ['uCamo3', e3]]) { _cb.setHex(hex); eu[uk].value.set(_cb.r / Math.max(1e-4, _ca.r), _cb.g / Math.max(1e-4, _ca.g), _cb.b / Math.max(1e-4, _ca.b)); }
  }
  const base = custom ? skin.base : TEAM_TINT[k] ?? TEAM_TINT.null;
  m.color.setHex(base);
  const u = LOOK_U[k];
  if (!u) return;
  const [t2, t3] = custom ? [skin.c2, skin.c3] : CAMO[k] || CAMO.null;
  _ca.setHex(base);
  for (const [uk, hex] of [['uCamo2', t2], ['uCamo3', t3]]) { _cb.setHex(hex); u[uk].value.set(_cb.r / Math.max(1e-4, _ca.r), _cb.g / Math.max(1e-4, _ca.g), _cb.b / Math.max(1e-4, _ca.b)); }
}
/**
 * Lack je Panzer-Epoche (Nutzer 15.11.: „Tarnlack je Epoche und Karte“, Rost an WK-Fahrzeugen). Je Team und Epoche
 * Grundfarbe, zwei Tarntöne und Schema: 0 = Flecken (modern), 1 = einfarbig mit verblassten Flächen (Kalter Krieg,
 * 2. WK Team A), 2 = weich gespritzte Bänder mit Tupfen (2. WK Team B), 3 = von Hand gemalte Felder mit schwarzen
 * Trennlinien (1. WK); rust = Rostanteil an Abplatzern, Kanten und Laufspuren.
 */
const ERA_LOOK = {
  modern: { tint: TEAM_TINT, camo: CAMO, scheme: { A: 0, B: 0, null: 0 }, rust: 0 },
  kk: { tint: { A: 0x4a5435, B: 0x7b7253, null: 0x5a5c4a }, camo: { A: [0x3a3a2c, 0x56603d], B: [0x5f553d, 0x8e8566], null: [0x484a3d, 0x66675a] }, scheme: { A: 1, B: 1, null: 1 }, rust: 0.18 },
  wk2: { tint: { A: 0x4d5333, B: 0xa08c5c, null: 0x6a6648 }, camo: { A: [0x3d4229, 0x5e6141], B: [0x5c3a26, 0x3e4a2b], null: [0x4a4430, 0x5a5a40] }, scheme: { A: 1, B: 2, null: 1 }, rust: 0.5 },
  wk1: { tint: { A: 0x77705a, B: 0x5f624c, null: 0x6a6652 }, camo: { A: [0x4a5a3a, 0x8a6e42], B: [0x6e5038, 0x8c8452], null: [0x4e5a3e, 0x7a6644] }, scheme: { A: 3, B: 3, null: 3 }, rust: 0.85 },
};
function paintLookPatch(team, era = 'modern') {
  const E = ERA_LOOK[era] || ERA_LOOK.modern;
  const base = _ca.set(E.tint[team ?? 'null'] ?? E.tint.null);
  const ratio = (hex) => { _cb.set(hex); return new THREE.Vector3(_cb.r / Math.max(1e-4, base.r), _cb.g / Math.max(1e-4, base.g), _cb.b / Math.max(1e-4, base.b)); };
  const [t2, t3] = E.camo[team ?? 'null'] || E.camo.null;
  const u = {
    uCamo2: { value: ratio(t2) }, uCamo3: { value: ratio(t3) }, uMud: { value: new THREE.Color(0x4a3e2f).copy(VEH_ENV.uEnvMud.value) }, uDust: { value: new THREE.Color(0x9a8f78).copy(VEH_ENV.uEnvDust.value) },
    uScheme: { value: E.scheme[team ?? 'null'] ?? 0 }, uRust: { value: E.rust }, uEnvTint: VEH_ENV.uEnvTint, uEnvTintAmt: VEH_ENV.uEnvTintAmt,
  };
  LOOK_U[era === 'modern' ? team ?? 'null' : `${team ?? 'null'}|${era}`] = u;
  return (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aVeh;\nattribute vec3 aVehE;\nvarying vec3 vVeh;\nvarying vec3 vVehN;\nvarying vec3 vVehE;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvVeh = aVeh;\nvVehN = objectNormal;\nvVehE = aVehE;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vVeh; varying vec3 vVehN; varying vec3 vVehE;
        uniform vec3 uCamo2, uCamo3, uMud, uDust, uEnvTint; uniform float uScheme, uRust, uEnvTintAmt;
        float npVh( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
        float npVn( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( npVh( i ), npVh( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( npVh( i + vec3( 0.0, 1.0, 0.0 ) ), npVh( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
                      mix( mix( npVh( i + vec3( 0.0, 0.0, 1.0 ) ), npVh( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( npVh( i + vec3( 0.0, 1.0, 1.0 ) ), npVh( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z ); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float npC1 = npVn( vVeh * vec3( 0.55, 0.8, 0.55 ) ) * 0.65 + npVn( vVeh * 1.6 + 3.1 ) * 0.35;
        float npC2 = npVn( vVeh * vec3( 0.7, 0.9, 0.7 ) + 11.3 ) * 0.65 + npVn( vVeh * 2.1 + 7.0 ) * 0.35;
        float npT2 = smoothstep( 0.55, 0.59, npC1 ), npT3 = smoothstep( 0.58, 0.62, npC2 ) * ( 1.0 - npT2 );
        float npLine = 0.0;
        if ( uScheme > 0.5 && uScheme < 1.5 ) { npT2 = smoothstep( 0.6, 0.72, npC1 ) * 0.45; npT3 = smoothstep( 0.64, 0.74, npC2 ) * 0.3; }
        else if ( uScheme > 1.5 && uScheme < 2.5 ) {
          // weich gespritzte, lang gezogene Bänder + Tupfen
          float nb1 = npVn( vVeh * vec3( 0.55, 1.9, 0.38 ) + 2.0 ), nb2 = npVn( vVeh * vec3( 0.45, 1.6, 0.5 ) + 17.0 );
          npT2 = smoothstep( 0.52, 0.66, nb1 ); npT3 = smoothstep( 0.55, 0.68, nb2 ) * ( 1.0 - npT2 );
          vec3 dc = fract( vVeh * 3.2 ) - 0.5; float dot2 = 1.0 - smoothstep( 0.07, 0.13, length( dc.xy + dc.zx * 0.5 ) );
          npT3 = max( npT3, dot2 * step( 0.6, npVh( floor( vVeh * 3.2 ) ) ) * ( 1.0 - npT2 ) * 0.9 );
        } else if ( uScheme > 2.5 ) {
          // von Hand gemalte Felder mit schwarzen Trennlinien
          npT2 = step( 0.55, npC1 ); npT3 = step( 0.57, npC2 ) * ( 1.0 - npT2 );
          float lw = 0.012 + 0.006 * npVn( vVeh * 9.0 );
          npLine = max( 1.0 - smoothstep( lw * 0.5, lw, abs( npC1 - 0.55 ) ), ( 1.0 - npT2 ) * ( 1.0 - smoothstep( lw * 0.5, lw, abs( npC2 - 0.57 ) ) ) );
        }
        diffuseColor.rgb *= mix( vec3( 1.0 ), uCamo2, npT2 ) * mix( vec3( 1.0 ), uCamo3, npT3 );
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.03, 0.03, 0.028 ), npLine * 0.85 );
        // Kartenstimmung (Wüste/Wald/Stadt): Lack leicht zur Kartenfarbe gezogen (Helligkeit bleibt)
        float npLum = dot( diffuseColor.rgb, vec3( 0.333 ) ), npTl = max( 0.05, dot( uEnvTint, vec3( 0.333 ) ) );
        diffuseColor.rgb = mix( diffuseColor.rgb, uEnvTint * ( npLum / npTl ), uEnvTintAmt );
        float npMn = npVn( vVeh * vec3( 2.2, 0.8, 2.2 ) );
        float npVMud = 1.0 - smoothstep( 0.3 + npMn * 0.3, 1.05 + npMn * 0.5, vVeh.y );
        npVMud = max( npVMud, smoothstep( 0.78, 0.85, npVn( vVeh * 6.0 ) ) * ( 1.0 - smoothstep( 0.6, 1.7, vVeh.y ) ) * 0.8 );
        diffuseColor.rgb = mix( diffuseColor.rgb, uMud * ( 0.75 + 0.5 * npMn ), npVMud * 0.9 );
        float npUp = clamp( normalize( vVehN ).y, 0.0, 1.0 );
        diffuseColor.rgb = mix( diffuseColor.rgb, uDust, smoothstep( 0.6, 0.95, npUp ) * ( 0.18 + 0.34 * npVn( vVeh * 1.3 + 5.0 ) ) * ( 1.0 - npVMud ) );
        float npVCh = smoothstep( 0.8, 0.86, npVn( vVeh * 11.0 + 2.0 ) ) * ( 0.3 + 0.7 * smoothstep( 0.35, 0.9, npVn( vVeh * 1.1 ) ) ) * ( 1.0 - npVMud );
        // Abplatzer: dunkler Stahl, an Weltkriegsfahrzeugen Rost; Rostläufer unter Kanten (senkrechte Flächen)
        vec3 npRustC = vec3( 0.25, 0.12, 0.055 ) * ( 0.7 + 0.6 * npVn( vVeh * 31.0 ) );
        diffuseColor.rgb = mix( diffuseColor.rgb, mix( vec3( 0.05, 0.047, 0.043 ), npRustC, uRust ), npVCh * 0.8 );
        float npSt = smoothstep( 0.72, 0.93, npVn( vec3( vVeh.x * 26.0, vVeh.y * 1.1, vVeh.z * 26.0 ) ) ) * ( 1.0 - abs( normalize( vVehN ).y ) ) * smoothstep( 0.3, 0.75, npVn( vVeh * 2.3 + 1.7 ) );
        diffuseColor.rgb = mix( diffuseColor.rgb, npRustC * 0.9, npSt * uRust * 0.55 * ( 1.0 - npVMud ) );
        // Kantenabnutzung: helle, abgeschabte Außenkanten (Abstand aus aVehE), fleckig, unter Schlamm schwächer;
        // schmaler als ~1 Pixel ausgeblendet (kein Flimmern in der Ferne)
        float npEd = min( min( vVehE.x, vVehE.y ), vVehE.z );
        float npEW = 0.007 + 0.02 * npVn( vVeh * 5.0 + 9.1 );
        float npEw = ( 1.0 - smoothstep( npEW * 0.3, npEW, npEd ) ) * smoothstep( 0.32, 0.6, npVn( vVeh * 17.0 + 4.3 ) ) * ( 1.0 - npVMud * 0.85 );
        npEw *= step( 1e-4, vVehE.x + vVehE.y + vVehE.z ) * ( 1.0 - smoothstep( npEW * 0.6, npEW * 1.8, fwidth( npEd ) ) );
        diffuseColor.rgb = mix( diffuseColor.rgb, mix( diffuseColor.rgb * 1.5 + vec3( 0.075, 0.072, 0.064 ), npRustC * 1.2, uRust * 0.55 ), npEw * 0.8 );`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // Gussnarben (Gussflag aus armorkit: aVehE.z + 100) bzw. feine Walzhaut auf Platten – Höhenrauschen als Bump
          float npCast = step( 50.0, vVehE.z - min( vVehE.x, vVehE.y ) );
          // Ableitungen außerhalb der Verzweigung (gleichmäßiger Kontrollfluss), Anwendung nur auf Guss
          float npH = ( npVn( vVeh * 19.0 ) * 0.55 + npVn( vVeh * 41.0 + 3.0 ) * 0.45 ) * 0.0022 * npCast;
          vec3 npDx = dFdx( -vViewPosition ), npDy = dFdy( -vViewPosition );
          vec2 npDh = vec2( dFdx( npH ), dFdy( npH ) );
          if ( npCast > 0.5 ) {
            vec3 npR1 = cross( npDy, normal ), npR2 = cross( normal, npDx );
            float npDet = dot( npDx, npR1 );
            vec3 npN = abs( npDet ) * normal - sign( npDet ) * ( npDh.x * npR1 + npDh.y * npR2 );
            if ( abs( npDet ) > 1e-12 && dot( npN, npN ) > 1e-30 ) normal = normalize( npN );
          }
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix( mix( mix( roughnessFactor, 0.97, npVMud ), mix( 0.42, 0.9, uRust ), npVCh ), mix( 0.5, 0.85, uRust ), npEw * 0.7 );`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix( mix( mix( metalnessFactor, 0.0, npVMud ), mix( 0.85, 0.2, uRust ), npVCh ), mix( 0.7, 0.25, uRust ), npEw * 0.6 );`);
  };
}

let lookOn = false, lookFns = null;
const eraFns = {};
/**
 * Tarnung/Schlamm/Staub/Abplatzer an die (geteilten, matchübergreifenden) Lackmaterialien hängen – nur medium+;
 * auf low wird der Haken wieder entfernt (Qualitätswechsel/Auto-Stufe zwischen Matches). Aufruf je Match.
 */
export function applyVehicleLook(quality = 'high') {
  const want = quality !== 'low';
  if (want === lookOn) return false;
  const S = vehicleMaterials();
  if (want && !lookFns) lookFns = { A: paintLookPatch('A'), B: paintLookPatch('B'), null: paintLookPatch('null') };
  for (const k of ['A', 'B', 'null']) {
    if (want) addShaderPatch(S.paint[k], 'vehLook', lookFns[k]);
    else removeShaderPatch(S.paint[k], 'vehLook');
  }
  for (const [key, m] of Object.entries(S.paintEra)) {
    if (want) addShaderPatch(m, 'vehLook', eraPatchFn(key));
    else removeShaderPatch(m, 'vehLook');
  }
  if (want) addShaderPatch(S.rubberOut, 'civDirt', civilDirtPatch); else removeShaderPatch(S.rubberOut, 'civDirt');
  lookOn = want;
  return true;
}
function eraPatchFn(key) {
  if (!eraFns[key]) { const [k, era] = key.split('|'); eraFns[key] = paintLookPatch(k === 'null' ? null : k, era); }
  return eraFns[key];
}

/**
 * Außenlack eines Panzers der Epoche era ('modern' | 'kk' | 'wk2' | 'wk1') für team – modern = der geteilte Teamlack,
 * sonst ein eigener Klon (Fotoscan-Sätze wie der Teamlack, eigene Tarn-/Rost-Uniforms). Geteilt je Team und Epoche.
 */
export function eraPaint(team, era = 'modern') {
  const S = vehicleMaterials(), k = team === 'A' || team === 'B' ? team : 'null';
  if (!ERA_LOOK[era] || era === 'modern') return S.paint[k];
  const key = `${k}|${era}`;
  let m = S.paintEra[key];
  if (!m) {
    const base = S.paint[k];
    m = base.clone();
    m.onBeforeCompile = THREE.Material.prototype.onBeforeCompile; // Klon ohne die Haken des Teamlacks (eigene Uniforms)
    m.customProgramCacheKey = THREE.Material.prototype.customProgramCacheKey;
    m.name = `veh:lack-${era}-${k}`;
    m.color.setHex(ERA_LOOK[era].tint[k]);
    m.userData.vehPaint = true;
    S.paintEra[key] = m;
    if (lookOn) addShaderPatch(m, 'vehLook', eraPatchFn(key));
  }
  return m;
}
/** Gummi der Außenteile (Laufrollen, Schürzenkanten) mit Kartenschmutz – nur medium+ (braucht aVeh). */
export function exteriorRubber() { return vehicleMaterials().rubberOut; }

/** Kennzeichnungs-Material je Team (Schablone, alphaTest, liegt mit Versatz auf dem Lack). */
export function markingMaterial(team) {
  const S = vehicleMaterials();
  const k = team === 'A' || team === 'B' ? team : 'null';
  if (!S.marking[k]) S.marking[k] = new THREE.MeshStandardMaterial({ name: `veh:marking${k}`, map: markingTexture(k), transparent: true, alphaTest: 0.35, depthWrite: false, roughness: 0.75, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  return S.marking[k];
}

/**
 * Geteilter Materialsatz. Wird einmal erzeugt; `upgrade(renderer, quality)` tauscht im Hintergrund auf
 * Fotoscan-Texturen (sicher mehrfach aufrufbar).
 */
export function vehicleMaterials() {
  if (SET) return SET;
  const paint = (team) => {
    const m = fromBase('metal_painted', { color: TEAM_TINT[team], metalness: 0.25, roughness: 0.72, envMapIntensity: 0.8 });
    m.userData.vehPaint = true; // models.js: Kantenabstand (aVehE) für die Kantenabnutzung
    return m;
  };
  SET = {
    paint: { A: paint('A'), B: paint('B'), null: paint(null) },
    dark: fromBase('gunmetal', { color: 0x3a3a38, metalness: 0.6, roughness: 0.55 }),
    rubber: fromBase('rubber', { color: 0x1d1d1d, metalness: 0, roughness: 0.92 }),
    rubberOut: fromBase('rubber', { color: 0x1f1e1c, metalness: 0, roughness: 0.9 }),
    paintEra: {},
    canvas: fromBase('tarp', { color: 0x6b6345, metalness: 0, roughness: 0.95 }),
    interior: new THREE.MeshStandardMaterial({ name: 'veh:interior', color: 0x2c2d28, roughness: 0.9, metalness: 0.1 }),
    glass: new THREE.MeshStandardMaterial({ name: 'veh:glass', color: 0x1c2428, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.32, depthWrite: false, envMapIntensity: 1.6 }),
    // Optikglas der Panzer (Winkelspiegel, Zieloptik, Periskop): vergütet, undurchsichtig, spiegelnd
    optic: new THREE.MeshStandardMaterial({ name: 'veh:optic', color: 0x0d1a1f, roughness: 0.05, metalness: 0.85, envMapIntensity: 2.2, emissive: 0x06161a, emissiveIntensity: 0.6 }),
    // Turm-Innenraum (nur für den lokalen Insassen): Wandfarbe leicht selbstleuchtend (Innenlampe), Granaten mit Vertex-Farben
    cabin: new THREE.MeshStandardMaterial({ name: 'veh:cabin', color: 0x4d5446, roughness: 0.82, metalness: 0.12, emissive: 0x1b1d16, emissiveIntensity: 1 }),
    shell: new THREE.MeshStandardMaterial({ name: 'veh:shell', vertexColors: true, roughness: 0.5, metalness: 0.35, emissive: 0x0b0a08, emissiveIntensity: 1 }),
    steel: new THREE.MeshStandardMaterial({ name: 'veh:steel', color: 0x44484c, roughness: 0.5, metalness: 0.45, envMapIntensity: 0.45, emissive: 0x08090a, emissiveIntensity: 1 }),
    lensOn: new THREE.MeshStandardMaterial({ name: 'veh:lensOn', color: 0xfff6e0, emissive: 0xffe9c0, emissiveIntensity: 6, roughness: 0.2 }),
    // Innenraum (Nutzer 11.10.): Feuerlöscher, Ärmel des Ladeschützen
    red: new THREE.MeshStandardMaterial({ name: 'veh:rot', color: 0xb3241c, roughness: 0.45, metalness: 0.2 }),
    sleeve: new THREE.MeshStandardMaterial({ name: 'veh:aermel', color: 0x4b5236, roughness: 0.92 }),
    // Innenraum je Generation: 2. WK elfenbeinfarben gestrichen, 1. WK roher Stahl; Holz (Kisten, Bänke), Messing, Öllampe
    cabinWk2: new THREE.MeshStandardMaterial({ name: 'veh:cabin2', color: 0xd6cdb0, roughness: 0.78, metalness: 0.08, emissive: 0x2c291f, emissiveIntensity: 1 }),
    cabinWk1: new THREE.MeshStandardMaterial({ name: 'veh:cabin1', color: 0x625c50, roughness: 0.7, metalness: 0.35, emissive: 0x19160f, emissiveIntensity: 1 }),
    wood: new THREE.MeshStandardMaterial({ name: 'veh:holz', color: 0x6e4c2c, roughness: 0.85, emissive: 0x150d06, emissiveIntensity: 1 }),
    brass: new THREE.MeshStandardMaterial({ name: 'veh:messing', color: 0xb08a3e, roughness: 0.35, metalness: 0.85, emissive: 0x1a1206, emissiveIntensity: 1 }),
    lamp: new THREE.MeshStandardMaterial({ name: 'veh:lampe', color: 0xffd9a0, emissive: 0xffa040, emissiveIntensity: 4, roughness: 0.3 }),
    lensOff: new THREE.MeshStandardMaterial({ name: 'veh:lensOff', color: 0xb9b6ad, emissive: 0x332f26, emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.3 }),
    rearLamp: new THREE.MeshStandardMaterial({ name: 'veh:rear', color: 0x5a0d08, emissive: 0x6a0904, emissiveIntensity: 1.2, roughness: 0.3 }),
    mark: {
      A: new THREE.MeshStandardMaterial({ name: 'veh:markA', color: TEAM_MARK.A, emissive: TEAM_MARK.A, emissiveIntensity: 0.35, roughness: 0.6 }),
      B: new THREE.MeshStandardMaterial({ name: 'veh:markB', color: TEAM_MARK.B, emissive: TEAM_MARK.B, emissiveIntensity: 0.35, roughness: 0.6 }),
      null: new THREE.MeshStandardMaterial({ name: 'veh:mark', color: TEAM_MARK.null, roughness: 0.6 }),
    },
    wreck: fromBase('metal_rust', { color: 0x2a2420, metalness: 0.2, roughness: 0.95 }),
    // Zivilfahrzeuge (Nutzer 16.10.): Felgen, Kunststoff (Stoßfänger, Armaturenbrett), Sitzbezug, Himmel/Verkleidung,
    // Instrumente (leicht leuchtend), Blinker/Rundumleuchte, Kennzeichen, Chrom; Lack je Farbe über civilPaint()
    rim: new THREE.MeshStandardMaterial({ name: 'veh:felge', color: 0xb4b9bf, roughness: 0.32, metalness: 0.85, envMapIntensity: 1.2 }),
    plastic: new THREE.MeshStandardMaterial({ name: 'veh:kunststoff', color: 0x1e1f21, roughness: 0.62, metalness: 0.05 }),
    seat: new THREE.MeshStandardMaterial({ name: 'veh:sitz', color: 0x2b2c30, roughness: 0.96, metalness: 0 }),
    trim: new THREE.MeshStandardMaterial({ name: 'veh:verkleidung', color: 0x77787a, roughness: 0.9, metalness: 0 }),
    dial: new THREE.MeshStandardMaterial({ name: 'veh:instrument', color: 0x101214, roughness: 0.3, metalness: 0.1, emissive: 0x3a4a5a, emissiveIntensity: 0.6 }),
    amber: new THREE.MeshStandardMaterial({ name: 'veh:blinker', color: 0xd9861a, emissive: 0x5a3000, emissiveIntensity: 0.7, roughness: 0.25 }),
    plate: new THREE.MeshStandardMaterial({ name: 'veh:kennzeichen', color: 0xe6e6e0, roughness: 0.5, metalness: 0.1 }),
    chrome: new THREE.MeshStandardMaterial({ name: 'veh:chrom', color: 0xd8dadc, roughness: 0.12, metalness: 1, envMapIntensity: 1.4 }),
    carton: new THREE.MeshStandardMaterial({ name: 'veh:karton', color: 0xa98455, roughness: 0.92, metalness: 0 }),
    sack: new THREE.MeshStandardMaterial({ name: 'veh:sack', color: 0xd2c9b0, roughness: 0.97, metalness: 0 }),
    // autos (Unterteilungs-Karosserien): getöntes Autoglas (Fresnel-Deckung, Spiegelung), schwarzer Siebdruckrand der
    // Scheiben (Fritting), Fugen, genarbter Kunststoff (Stoßfänger-Unterteile, Schweller), Hochglanz-Schwarz (Säulenblenden)
    carGlass: carGlassMaterial(),
    frit: new THREE.MeshStandardMaterial({ name: 'veh:fritting', color: 0x060708, roughness: 0.12, metalness: 0.1, envMapIntensity: 1.3 }),
    seam: new THREE.MeshStandardMaterial({ name: 'veh:fuge', color: 0x070707, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    grain: grainPlastic(),
    gloss: new THREE.MeshStandardMaterial({ name: 'veh:hochglanz', color: 0x0b0c0d, roughness: 0.08, metalness: 0.15, envMapIntensity: 1.4 }),
    civ: {},
    trackTex: trackTexture(),
    trackHQ: null, // env-look: Kettenglieder mit Normalenkarte (medium+), bei Bedarf erzeugt
    marking: {},
    cone: new THREE.MeshBasicMaterial({ name: 'veh:cone', color: 0xffe2b0, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true }),
    flash: new THREE.MeshBasicMaterial({ name: 'veh:flash', color: 0xffc070, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  SET.trackMats = [];
  return SET;
}

/**
 * Kartenstimmung der Fahrzeuge (Nutzer 14.11.: „passend zur Map“): Schmutzfarbe unten (Schlamm im Grenzland, Staub in
 * der Altstadt, Ruß im Brandwald …), Staub auf Oberseiten, Menge und Nässe. Geteilte Uniforms für den Zivil-Lack;
 * Schlamm/Staub der Militärlackierung (vehLook) werden mitgesetzt. setVehicleEnvironment(mapId) je Match (index.js).
 */
const VEH_ENV_PRESET = {
  neutral: { mud: 0x4a4236, dust: 0x9a8f78, amt: 0.8, wet: 0.2, tint: 0x6a6a5a, ta: 0 },
  grenzland: { mud: 0x4b3b28, dust: 0x8f8266, amt: 1.15, wet: 0.55, tint: 0x4a5634, ta: 0.14 },
  niemandsland: { mud: 0x3d3326, dust: 0x7a705c, amt: 1.3, wet: 0.6, tint: 0x5c5444, ta: 0.16 },
  brandwald: { mud: 0x211d1a, dust: 0x5e5953, amt: 1.15, wet: 0.1, tint: 0x3d3b37, ta: 0.16 },
  altstadt: { mud: 0x7d6c52, dust: 0xb6a689, amt: 0.85, wet: 0, tint: 0xa8966e, ta: 0.3 },
  stadtkern: { mud: 0x4f4a43, dust: 0x9b9386, amt: 0.75, wet: 0.15, tint: 0x6c6c68, ta: 0.2 },
  hafen: { mud: 0x48443f, dust: 0x8f8b84, amt: 0.7, wet: 0.35, tint: 0x666a68, ta: 0.12 },
  werk: { mud: 0x3b3833, dust: 0x7a756c, amt: 0.9, wet: 0.2, tint: 0x5e5c56, ta: 0.12 },
  flugplatz: { mud: 0x6b604d, dust: 0xa89d84, amt: 0.75, wet: 0.05, tint: 0xa39270, ta: 0.26 },
  weitmark: { mud: 0x5a4f3d, dust: 0x9e927a, amt: 0.85, wet: 0.2, tint: 0x8a7a5c, ta: 0.2 },
};
export const VEH_ENV = { uEnvMud: { value: new THREE.Color(VEH_ENV_PRESET.neutral.mud) }, uEnvDust: { value: new THREE.Color(VEH_ENV_PRESET.neutral.dust) }, uEnvAmt: { value: 0.8 }, uEnvWet: { value: 0.2 }, uEnvTint: { value: new THREE.Color(VEH_ENV_PRESET.neutral.tint) }, uEnvTintAmt: { value: 0 } };
let envId = 'neutral';
export function setVehicleEnvironment(mapId) {
  const key = Object.keys(VEH_ENV_PRESET).find((k) => mapId && String(mapId).startsWith(k)) || 'neutral';
  envId = key;
  const P = VEH_ENV_PRESET[key];
  VEH_ENV.uEnvMud.value.setHex(P.mud); VEH_ENV.uEnvDust.value.setHex(P.dust); VEH_ENV.uEnvAmt.value = P.amt; VEH_ENV.uEnvWet.value = P.wet;
  VEH_ENV.uEnvTint.value.setHex(P.tint ?? 0x6a6a5a); VEH_ENV.uEnvTintAmt.value = P.ta ?? 0;
  for (const u of Object.values(LOOK_U)) { u.uMud.value.setHex(P.mud); u.uDust.value.setHex(P.dust); }
  return key;
}
export const vehicleEnvironment = () => envId;

/**
 * Straßenschmutz/Staub im Fahrzeugraum (aVeh), Klarlack wird unter Schmutz stumpf (Nutzer 15.11.: keine senkrechten
 * Laufspuren). Karosserien aus carbody.js bringen Masken je Ecke mit (aCv: x Spritzschmutz hinter den Rädern, y Wölbung):
 * Spritzschmutz als Körnung (dichter Kern, ausfransende Sprenkel), feiner Straßenfilm an Schweller/Stoßfänger-Unterkante,
 * Staub auf waagerechten Flächen und in Kehlen, Kantenabrieb (stumpfer Klarlack, vereinzelte Steinschläge) an Kanten.
 * high/ultra (Klarlack): Orangenhaut als feine Störung der Klarlack-Normale.
 */
function civilDirtPatch(sh) {
  Object.assign(sh.uniforms, VEH_ENV);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 aVeh;\nattribute vec2 aCv;\nvarying vec3 vCvP;\nvarying vec3 vCvN;\nvarying vec2 vCvM;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCvP = aVeh;\nvCvN = objectNormal;\nvCvM = aCv;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vCvP; varying vec3 vCvN; varying vec2 vCvM; uniform vec3 uEnvMud, uEnvDust; uniform float uEnvAmt, uEnvWet;
      float cvH( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
      float cvN( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( mix( cvH( i ), cvH( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( cvH( i + vec3( 0.0, 1.0, 0.0 ) ), cvH( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
                    mix( mix( cvH( i + vec3( 0.0, 0.0, 1.0 ) ), cvH( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( cvH( i + vec3( 0.0, 1.0, 1.0 ) ), cvH( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z ); }
      float cvDirt = 0.0, cvWear = 0.0;`)
    .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float n1 = cvN( vCvP * 2.6 ), n2 = cvN( vCvP * 9.0 + 4.0 ), n3 = cvN( vCvP * 41.0 + 1.7 ), n4 = cvN( vCvP * 120.0 + 9.3 );
        float fw = clamp( 1.0 - length( fwidth( vCvP * 41.0 ) ) * 0.6, 0.0, 1.0 );
        // Spritzschmutz: Maske × Wolken; im Kern geschlossen, am Rand nur Sprenkel (keine Laufspuren)
        float sp = clamp( vCvM.x * ( 0.45 + 0.75 * n1 ), 0.0, 1.0 );
        float n5 = cvN( vCvP * 260.0 + 5.1 ), fw2 = clamp( 1.0 - length( fwidth( vCvP * 260.0 ) ) * 0.7, 0.0, 1.0 );
        float grains = mix( 0.45, smoothstep( 0.45, 0.7, n5 * 0.7 + n4 * 0.3 ), fw2 );
        float spray = smoothstep( 0.1, 0.6, sp ) * mix( grains, 1.0, smoothstep( 0.45, 0.85, sp ) ) * 0.85;
        // Straßenfilm ganz unten (gleichmäßig, wolkig)
        float low = ( 1.0 - smoothstep( 0.24 + n1 * 0.1, 0.42 + n2 * 0.14, vCvP.y ) ) * 0.55;
        cvDirt = clamp( max( spray, low ) * uEnvAmt, 0.0, 1.0 );
        diffuseColor.rgb = mix( diffuseColor.rgb, uEnvMud * ( 0.85 + 0.25 * n2 ), cvDirt * 0.78 );
        // Staub auf Haube/Dach/Kofferraum + in Kehlen (Wölbung < 0)
        float up = clamp( normalize( vCvN ).y, 0.0, 1.0 );
        float dust = ( smoothstep( 0.55, 0.95, up ) * ( 0.1 + 0.22 * cvN( vCvP * 1.7 + 2.0 ) ) + clamp( -vCvM.y, 0.0, 1.0 ) * 0.25 * n2 ) * uEnvAmt * ( 1.0 - uEnvWet * 0.6 );
        diffuseColor.rgb = mix( diffuseColor.rgb, uEnvDust, clamp( dust, 0.0, 0.6 ) );
        cvDirt = max( cvDirt, dust * 1.4 );
        // Kantenabrieb: stumpfer Klarlack + seltene Steinschläge (Grundierung grau) an Kanten und vorn
        cvWear = smoothstep( 0.3, 0.9, vCvM.y ) * ( 0.5 + 0.5 * n2 );
        float chip = smoothstep( 0.93, 0.95, n4 * 0.7 + n3 * 0.3 ) * fw * smoothstep( 0.4, 0.9, cvWear + ( 1.0 - smoothstep( -2.42, -2.25, vCvP.z ) ) * 0.7 ) * ( 1.0 - cvDirt );
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.36, 0.36, 0.35 ), chip * 0.7 );
        cvWear = max( cvWear * 0.6, chip );
      }`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix( roughnessFactor, mix( 0.92, 0.55, uEnvWet ), clamp( cvDirt, 0.0, 1.0 ) );
      roughnessFactor = mix( roughnessFactor, 0.6, cvWear * 0.5 );`);
  // Klarlack nur, wo das Programm ihn hat (MeshPhysical mit clearcoat > 0 → USE_CLEARCOAT); MeshStandard teilt den Shader
  sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
      #ifdef USE_CLEARCOAT
      material.clearcoat *= 1.0 - clamp( cvDirt * 1.3 + cvWear * 0.4, 0.0, 1.0 );
      #endif`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
      #ifdef USE_CLEARCOAT
      {
        vec3 op = vCvP * 70.0;
        vec3 opN = vec3( cvN( op ), cvN( op + 3.3 ), cvN( op + 7.1 ) ) - 0.5;
        float opF = clamp( 1.0 - length( fwidth( op ) ) * 0.35, 0.0, 1.0 );
        clearcoatNormal = normalize( clearcoatNormal + opN * 0.035 * opF );
      }
      #endif`);
}

/**
 * Autolack einer Farbe (geteilt je Farbton und Stufe) – Zivilfahrzeuge. det 0 (low): glatter Standardlack wie bisher;
 * det 1 (medium): + Straßenschmutz/Staub (Kartenstimmung); det 2 (high/ultra): Basislack + Klarlack (MeshPhysical).
 */
export function civilPaint(hex, det = 0) {
  const S = vehicleMaterials(), k = `${hex}:${det | 0}`;
  if (!S.civ[k]) {
    const c = new THREE.Color(hex);
    // helle/bunte Töne als Uni-Lack, dunkle/graue als Metallic
    const hsl = c.getHSL({});
    const metallic = hsl.s < 0.25 && hsl.l > 0.12 && hsl.l < 0.85;
    const m = det >= 2
      ? new THREE.MeshPhysicalMaterial({ name: `veh:lack${hex}`, color: c, roughness: metallic ? 0.36 : 0.42, metalness: metallic ? 0.55 : 0.05, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.15 })
      : new THREE.MeshStandardMaterial({ name: `veh:lack${hex}`, color: c, roughness: 0.34, metalness: 0.4, envMapIntensity: 1.1 });
    if (det >= 1) addShaderPatch(m, 'civDirt', civilDirtPatch);
    S.civ[k] = m;
  }
  return S.civ[k];
}

/**
 * Vorzuwärmende Fahrzeugmaterialien (Shader, die nicht sofort sichtbar sind): Scheinwerfer an, Lichtkegel, Wrack,
 * Optikglas, Turm-Innenraum (Wände, Granaten, Verschluss) – index.js kompiliert sie beim Anschluss mit (§D.3).
 */
export function vehicleWarmMaterials() {
  const S = vehicleMaterials();
  return [S.rubberOut, ...Object.values(S.paintEra), S.carGlass, S.frit, S.seam, S.grain, S.gloss, S.lensOn, S.cone, S.wreck, S.optic, S.cabin, S.shell, S.steel, S.red, S.sleeve, S.cabinWk2, S.cabinWk1, S.wood, S.brass, S.lamp, S.rim, S.plastic, S.seat, S.trim, S.dial, S.amber, S.plate, S.chrome, S.carton, S.sack];
}

/** Kettenmaterial je Fahrzeugseite (eigene Texturkopie → eigener Versatz für den Kettenlauf). */
export function trackMaterial(hq = false) {
  const S = vehicleMaterials();
  if (hq && !S.trackHQ) S.trackHQ = trackTextureHQ();
  const tex = (hq ? S.trackHQ.map : S.trackTex).clone();
  tex.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ name: 'veh:track', map: tex, color: 0xffffff, roughness: 0.85, metalness: 0.45 });
  if (hq) { m.normalMap = S.trackHQ.normal.clone(); m.normalMap.needsUpdate = true; m.normalScale.set(1.2, 1.2); m.roughness = 0.78; m.metalness = 0.55; }
  return m;
}

function applySet(m, set, { metalness, roughness } = {}) {
  if (!set) return;
  m.map = set.map || m.map;
  m.normalMap = set.normalMap || m.normalMap;
  if (set.ormMap) { m.aoMap = set.ormMap; m.roughnessMap = set.ormMap; m.metalnessMap = set.ormMap; }
  if (metalness != null) m.metalness = metalness;
  if (roughness != null) m.roughness = roughness;
  m.needsUpdate = true;
}

/**
 * Fotoscan-Aufwertung (Hintergrund, Fehler werden still verschluckt → prozedurale Materialien bleiben).
 * Stufe: low 512, sonst 1024 (Fahrzeuge sind keine Helden-Sätze).
 */
export function upgradeVehicleMaterials(renderer, quality = 'high') {
  applyVehicleLook(quality); // je Match (auch nach dem ersten Aufruf): low entfernt den Haken wieder
  if (upgrading) return upgrading;
  const S = vehicleMaterials();
  upgrading = (async () => {
    try {
      if (!assets.renderer && renderer) assets.setRenderer(renderer);
      if (!assets.renderer) return false;
      await assets.ready();
      const tier = Math.min(1024, tierFor(quality, 'texture'));
      const load = (id) => assets.loadTextureSet(id, tier).catch(() => null);
      const [paint, dark, rubber, canvas, rust] = await Promise.all([
        load('metal_painted'), load('gunmetal_worn'), load('rubber'), load('canvas'), load('metal_rust_painted'),
      ]);
      // Lack: einfärbbarer Satz – Farbe bleibt die Teamtönung, Rauheit/Metall aus der ORM-Karte
      for (const k of ['A', 'B', 'null']) applySet(S.paint[k], paint, { metalness: 0.9, roughness: 1 });
      for (const m of Object.values(S.paintEra)) applySet(m, paint, { metalness: 0.9, roughness: 1 });
      applySet(S.rubberOut, rubber, { metalness: 1, roughness: 1 });
      applySet(S.dark, dark, { metalness: 1, roughness: 1 });
      applySet(S.rubber, rubber, { metalness: 1, roughness: 1 });
      applySet(S.canvas, canvas, { metalness: 1, roughness: 1 });
      applySet(S.wreck, rust, { metalness: 0.6, roughness: 1 });
      return true;
    } catch (err) {
      if (typeof console !== 'undefined') console.info('[vehicles] Fotoscan-Materialien nicht verfügbar – prozedural.', err && err.message);
      return false;
    }
  })();
  return upgrading;
}
