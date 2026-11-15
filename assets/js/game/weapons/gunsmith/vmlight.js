// Weltschatten auf der Ego-Waffe (waffen, 14.11.2026 – Nutzer: „Waffen passen nicht zur Map, andere Beleuchtung als die Welt“).
// Waffe und Arme liegen in einer eigenen Viewmodel-Szene (eigene Kamera, eigene Lichter, siehe viewmodel.js). Bisher dunkelte
// dort nur eine Sonde (3 Strahlen zur Sonne, geglättet) die ganze Waffe gleichmäßig ab – Schattenkanten von Kran, Dachrinne,
// Baum oder Fensterkreuz liefen nie über Lauf und Hände, die Waffe wirkte wie aufgeklebt.
// Hier: ein Shader-Haken für alle Ego-Materialien, der die Sonne der Viewmodel-Szene (erkannt an ihrer Richtung) mit der echten
// Schattenkarte der Welt (Nahkaskade der Kartensonne, world/lighting.js) abschattet. Jedes Fragment wird dafür wie
// viewmodel._vmToWorld an seine Weltlage gebracht (gleiche Bildposition und Tiefe, Sichtfeld-Ausgleich) und dort in der
// Schattenkarte nachgeschlagen (8 Hardware-PCF-Proben, kein Rauschen – das Viewmodel läuft nicht durchs TAA).
// Eigenständig wie models.js (kein Import der Weltmodule): der Haken hängt sich vor einen vorhandenen onBeforeCompile;
// world/shading.js addShaderPatch übernimmt ihn später als „eigenen“ Haken. Ohne Welt (Website-Vitrine, Waffenlabor) bleibt
// npVmShP.x = 0 → exakt das bisherige Bild. Handy (grober Zeiger): kein Haken, kein Mehraufwand.
import * as THREE from 'three';

const PC = !(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);

/** Geteilte Uniforms (ein Satz für alle Ego-Materialien; viewmodel.js setzt sie je Bild vor dem Viewmodel-Durchgang). */
export const VMU = {
  npVmSh: { value: null },                                  // DepthTexture der Kartensonne (Vergleichsmodus)
  npVmShM: { value: new THREE.Matrix4() },                  // Viewmodel-Sicht → Schatten-UV/Tiefe
  npVmShP: { value: new THREE.Vector4(0, 1 / 2048, -0.0004, 0.03) }, // x an, y Texel (UV), z Tiefen-Bias, w Normalenversatz (m)
  npVmSunDir: { value: new THREE.Vector3(0, 1, 0) },        // Richtung zur Viewmodel-Sonne (Sichtraum) – nur dieses Licht
};

// Eingehängt hinter shadowmap_pars_fragment (dort sind vViewPosition, vNormal und getDirectionalLightInfo bekannt). Ein Makro
// leitet getDirectionalLightInfo auf die Hülle um: kein Standard-Baustein wird ersetzt – world/shading.js (lights_fragment_begin)
// bleibt in beliebiger Reihenfolge kombinierbar (Waffenmaterialien in der Weltszene, z. B. aufgestellte Trophäe, Bot-Waffen).
const FUNCS = /* glsl */ `
uniform highp sampler2DShadow npVmSh;
uniform mat4 npVmShM;
uniform vec4 npVmShP;
uniform vec3 npVmSunDir;
#if NUM_DIR_LIGHTS > 0
float npVmSunVis( vec3 vp, vec3 vn ) {
	vec4 c = npVmShM * vec4( vp + vn * npVmShP.w, 1.0 );
	vec3 s = c.xyz / c.w;
	if ( s.x <= 0.0 || s.x >= 1.0 || s.y <= 0.0 || s.y >= 1.0 || s.z >= 1.0 ) return 1.0;
	float z = s.z + npVmShP.z;
	vec2 t = vec2( npVmShP.y * 1.6 );
	float v = texture( npVmSh, vec3( s.xy, z ) ) * 2.0
		+ texture( npVmSh, vec3( s.xy + vec2( -1.0, -0.35 ) * t, z ) )
		+ texture( npVmSh, vec3( s.xy + vec2( 0.35, -1.0 ) * t, z ) )
		+ texture( npVmSh, vec3( s.xy + vec2( 1.0, 0.35 ) * t, z ) )
		+ texture( npVmSh, vec3( s.xy + vec2( -0.35, 1.0 ) * t, z ) )
		+ texture( npVmSh, vec3( s.xy + vec2( -0.7, 0.7 ) * t * 1.9, z ) )
		+ texture( npVmSh, vec3( s.xy + vec2( 0.7, -0.7 ) * t * 1.9, z ) );
	return v / 8.0;
}
void npVmDirInfo( const in DirectionalLight dl, out IncidentLight l ) {
	getDirectionalLightInfo( dl, l );
	if ( npVmShP.x > 0.5 && dot( dl.direction, npVmSunDir ) > 0.999 ) {
		#ifdef FLAT_SHADED
		vec3 vn = vec3( 0.0 );
		#else
		vec3 vn = normalize( vNormal );
		#endif
		l.color *= npVmSunVis( - vViewPosition, vn );
	}
}
#define getDirectionalLightInfo( a, b ) npVmDirInfo( a, b )
#endif
`;

// Platzhalter-Tiefentextur im Vergleichsmodus: ein sampler2DShadow braucht immer eine passende Bindung (sonst „Mismatch between
// texture format and sampler type“ bei jedem Zeichenaufruf – Website-Vitrine, Waffenlabor, Bilder vor der ersten Weltschattenkarte)
let dummy = null;
function dummyDepth(renderer) {
  if (dummy && dummy.renderer === renderer) return dummy.tex;
  if (!renderer || !renderer.isWebGLRenderer) return null;
  const dt = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  dt.format = THREE.DepthFormat;
  dt.compareFunction = THREE.LessEqualCompare;
  dt.minFilter = dt.magFilter = THREE.LinearFilter;
  dt.name = 'np:vm-shadow-dummy';
  const rt = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, depthTexture: dt });
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.clear(false, true, false);
  renderer.setRenderTarget(prev);
  dummy = { rt, tex: dt, renderer };
  return dt;
}
/** Uniform ohne echte Karte wieder auf den Platzhalter legen (Matchende, Kontextverlust). */
export function resetVmLight() { VMU.npVmShP.value.x = 0; VMU.npVmSh.value = dummy ? dummy.tex : null; }

/** Der Haken selbst (MeshStandardMaterial/MeshPhysicalMaterial; andere Materialien bleiben unverändert). */
export function vmLightPatch(shader, renderer) {
  const fs = shader.fragmentShader;
  if (fs.includes('npVmDirInfo') || !fs.includes('#include <shadowmap_pars_fragment>') || !fs.includes('#include <lights_pars_begin>')) return;
  if (!VMU.npVmSh.value) VMU.npVmSh.value = dummyDepth(renderer);
  Object.assign(shader.uniforms, VMU);
  shader.fragmentShader = fs.replace('#include <shadowmap_pars_fragment>', `#include <shadowmap_pars_fragment>\n${FUNCS}`);
}

/** Ego-Material mit dem Haken versehen (idempotent; nur PC). → material */
export function vmLight(m) {
  if (!PC || !m || !m.isMaterial || m.userData.npVmLight || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) return m;
  m.userData.npVmLight = true;
  const obc = m.onBeforeCompile, key = m.customProgramCacheKey;
  const ownObc = obc !== THREE.Material.prototype.onBeforeCompile ? obc : null;
  const ownKey = key !== THREE.Material.prototype.customProgramCacheKey ? key : null;
  m.onBeforeCompile = function (sh, r) { if (ownObc) ownObc.call(this, sh, r); vmLightPatch(sh, r); };
  m.customProgramCacheKey = function () { return (ownKey ? ownKey.call(this) : '') + '|vmw2'; };
  m.needsUpdate = true;
  return m;
}

const _S = new THREE.Matrix4(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
/**
 * Uniforms für den nächsten Viewmodel-Durchgang setzen. sun = Kartensonne (DirectionalLight mit Schattenkarte), main =
 * Hauptkamera, vmCam = Viewmodel-Kamera (beide mit dem Sichtfeld dieses Bildes, auch überscannt), vmSun = Sonne der
 * Viewmodel-Szene (nur sie wird abgeschattet). on = false schaltet ab.
 */
export function updateVmLight(on, sun, main, vmCam, vmSun = null) {
  const P = VMU.npVmShP.value;
  const map = on && sun && sun.castShadow && sun.shadow && sun.shadow.map ? sun.shadow.map.depthTexture : null;
  if (!map || !main || !vmCam || !vmSun) { P.x = 0; if (dummy) VMU.npVmSh.value = dummy.tex; return false; }
  VMU.npVmSh.value = map;
  // Sichtfeld-Ausgleich wie viewmodel._vmToWorld: Bildposition + Tiefe bleiben, x/y skalieren mit tan(fov/2)
  const tm = Math.tan(THREE.MathUtils.degToRad(main.fov) / 2) / (main.zoom || 1);
  const tv = Math.tan(THREE.MathUtils.degToRad(vmCam.fov) / 2) / (vmCam.zoom || 1);
  const k = tv > 1e-6 ? tm / tv : 1;
  _S.makeScale(k, k, 1).premultiply(main.matrixWorld);
  VMU.npVmShM.value.copy(sun.shadow.matrix).multiply(_S);   // geometryPosition liegt schon im Sichtraum der Viewmodel-Kamera
  // Richtung zur Viewmodel-Sonne im Sichtraum (wie three.js: Position − Ziel, mit der Ansichtsmatrix gedreht)
  _a.setFromMatrixPosition(vmSun.matrixWorld).sub(_b.setFromMatrixPosition(vmSun.target.matrixWorld)).transformDirection(vmCam.matrixWorldInverse);
  VMU.npVmSunDir.value.copy(_a);
  const sz = sun.shadow.mapSize.x || 2048;
  P.set(1, 1 / sz, Math.min(-0.0001, sun.shadow.bias || -0.00035), 0.03);
  return true;
}
