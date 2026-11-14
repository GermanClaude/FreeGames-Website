// NULLPUNKT — Oberflächen-Haken der Welt-Materialien (Owner: engine/texturen, 14.11.)
//
// Ein Shader-Haken „surf:<variante>“ (über world/shading.js addShaderPatch) für Fotoscan- und prozedurale Materialien:
//   • nxy   – Normalen-Karten als XY-Paar (X in RGB, Y in Alpha; Z rekonstruiert). ETC1S hat getrennte Farb- und
//             Alpha-Ebenen → deutlich sauberere Normalen als RGB-ETC1S (gemessen PSNR 27 → 33 dB) bei ≈ 1,7× Datei.
//             Die Sätze tragen im Manifest tiers[n].normalXY (assets/lib/loader.js setzt set.normalXY).
//             Dabei wird Y negiert (OpenGL-Scan ohne Y-Spiegelung im KTX2) und die Sätze werden mit negativer
//             V-Wiederholung gezeichnet (engine/textures.js) – Bilder stehen aufrecht, Relief ist nicht mehr vertikal
//             invertiert (die 512er-Stufe ist dafür gespiegelt kodiert).
//   • hex   – Kachel-Auflösung nach Mikkelsen („Practical Real-Time Hex-Tiling“, 2022): drei versetzte (und für
//             ungerichtete Böden gedrehte) Abtastungen je Karte auf einem Dreiecksgitter, gewichtet nach Helligkeit –
//             keine sichtbare Wiederholung mehr auf großen Flächen. Albedo, Normalen (Drehung zurückgerechnet) und ORM
//             (einmal abgetastet, für Rauheit/Metall/AO geteilt) nutzen dieselben Gewichte. Nur high/ultra.
//   • grime – Sockelschmutz/Spritzwasser an Wandfüßen und eine feuchte Kante direkt am Boden (Vertex-Attribut
//             npGrime aus world/builder.js: 1 am Fuß, 0 ab ≈ 1,6 m), unregelmäßiger Rand über Weltraum-Rauschen.
//             Ab medium (der Builder setzt das Attribut nicht auf low).
//   • joint – Plattenfugen in Weltkoordinaten auf Böden (Beton), mit Helligkeitsstreuung je Platte. Ab medium.
//
// Technik: Die three-Bausteine (map_fragment, normal_fragment_maps, roughness-/metalness-/aomap_fragment) bleiben
// unangetastet; nur „texture2D“ wird um diese Einschlüsse herum auf eigene Abtastfunktionen umgelenkt. So vertragen
// sich die Haken mit allen anderen, die hinter denselben Einschlüssen Code anhängen (Makro-Variation, Detailnormalen,
// Einschusslöcher …), unabhängig von der Reihenfolge.
import * as THREE from 'three';
import { addShaderPatch, removeShaderPatch, ensureWorldVaryings } from '../world/shading.js?v=20261114060746';

const HEX_FN = /* glsl */`
uniform vec4 npSurf; // x: Hex-Kontrast, y: Hex-Zellen je Texturwiederholung, z: Drehung (0..1), w: frei
bool npHxReady = false; vec3 npHxW; vec3 npHxWf; vec2 npHxO0, npHxO1, npHxO2; mat2 npHxR0, npHxR1, npHxR2; vec2 npHxDx, npHxDy;
bool npHxOrmReady = false; vec4 npHxOrm;
vec2 npHxHash( vec2 p ) { p = vec2( dot( p, vec2( 127.1, 311.7 ) ), dot( p, vec2( 269.5, 183.3 ) ) ); return fract( sin( p ) * 43758.5453 ); }
mat2 npHxRot( vec2 h ) { float a = ( h.y * 2.0 - 1.0 ) * 3.14159265 * npSurf.z; float c = cos( a ), s = sin( a ); return mat2( c, s, -s, c ); }
void npHxSetup( vec2 uv ) {
  npHxReady = true;
  npHxDx = dFdx( uv ); npHxDy = dFdy( uv );
  vec2 st = uv * npSurf.y * 3.46410162;
  vec2 sk = vec2( st.x, -0.57735027 * st.x + 1.15470054 * st.y );
  vec2 b = floor( sk ); vec3 t = vec3( fract( sk ), 0.0 ); t.z = 1.0 - t.x - t.y;
  vec2 v0, v1, v2;
  if ( t.z > 0.0 ) { npHxW = vec3( t.z, t.y, t.x ); v0 = b; v1 = b + vec2( 0.0, 1.0 ); v2 = b + vec2( 1.0, 0.0 ); }
  else { npHxW = vec3( -t.z, 1.0 - t.y, 1.0 - t.x ); v0 = b + vec2( 1.0 ); v1 = b + vec2( 1.0, 0.0 ); v2 = b + vec2( 0.0, 1.0 ); }
  vec2 h0 = npHxHash( v0 ), h1 = npHxHash( v1 ), h2 = npHxHash( v2 );
  npHxR0 = npHxRot( h0 ); npHxR1 = npHxRot( h1 ); npHxR2 = npHxRot( h2 );
  npHxO0 = h0; npHxO1 = h1.yx; npHxO2 = fract( h2 * 1.7 );
  npHxWf = npHxW / ( npHxW.x + npHxW.y + npHxW.z );
}
vec4 npHxTap( sampler2D s, vec2 uv, mat2 R, vec2 o ) { return textureGrad( s, R * uv + o, R * npHxDx, R * npHxDy ); }
// Albedo: Gewichte aus der Helligkeit der drei Abtastungen (helle Details setzen sich durch, kein Grauschleier)
vec4 npHexMap( sampler2D s, vec2 uv ) {
  if ( !npHxReady ) npHxSetup( uv );
  vec4 c0 = npHxTap( s, uv, npHxR0, npHxO0 ), c1 = npHxTap( s, uv, npHxR1, npHxO1 ), c2 = npHxTap( s, uv, npHxR2, npHxO2 );
  vec3 L = vec3( dot( c0.rgb, vec3( 0.299, 0.587, 0.114 ) ), dot( c1.rgb, vec3( 0.299, 0.587, 0.114 ) ), dot( c2.rgb, vec3( 0.299, 0.587, 0.114 ) ) );
  vec3 W = mix( vec3( 1.0 ), L, npSurf.x ) * pow( npHxW, vec3( 7.0 ) );
  npHxWf = W / max( W.x + W.y + W.z, 1e-5 );
  return c0 * npHxWf.x + c1 * npHxWf.y + c2 * npHxWf.z;
}
vec3 npNrmDecode( vec4 t ) {
#ifdef NP_NXY
  // Y negiert: KTX2 liegt ohne Y-Spiegelung vor (Zeile 0 = Bildoberkante bei t = 0), die Scans sind OpenGL-Normalen
  // (+Y = Bild-oben = −t); three erwartet +Y = +t (Bitangente aus den UV-Ableitungen)
  vec2 xy = vec2( t.r, 1.0 - t.a ) * 2.0 - 1.0;
  return vec3( xy, sqrt( clamp( 1.0 - dot( xy, xy ), 0.0, 1.0 ) ) );
#else
  return t.xyz * 2.0 - 1.0;
#endif
}
vec4 npHexNrm( sampler2D s, vec2 uv ) {
  if ( !npHxReady ) npHxSetup( uv );
  vec3 n0 = npNrmDecode( npHxTap( s, uv, npHxR0, npHxO0 ) ), n1 = npNrmDecode( npHxTap( s, uv, npHxR1, npHxO1 ) ), n2 = npNrmDecode( npHxTap( s, uv, npHxR2, npHxO2 ) );
  // Drehung der Abtastung zurück in den Tangentenraum der Fläche (R^T)
  n0.xy = n0.xy * npHxR0; n1.xy = n1.xy * npHxR1; n2.xy = n2.xy * npHxR2;
  vec3 n = normalize( n0 * npHxWf.x + n1 * npHxWf.y + n2 * npHxWf.z );
  return vec4( n * 0.5 + 0.5, 1.0 );
}
vec4 npHexOrm( sampler2D s, vec2 uv ) {
  if ( !npHxOrmReady ) {
    if ( !npHxReady ) npHxSetup( uv );
    npHxOrmReady = true;
    npHxOrm = npHxTap( s, uv, npHxR0, npHxO0 ) * npHxWf.x + npHxTap( s, uv, npHxR1, npHxO1 ) * npHxWf.y + npHxTap( s, uv, npHxR2, npHxO2 ) * npHxWf.z;
  }
  return npHxOrm;
}
`;

const NXY_FN = /* glsl */`
vec4 npNxyTex( sampler2D s, vec2 uv ) {
  vec4 t = texture( s, uv ); vec2 xy = vec2( t.r, 1.0 - t.a ) * 2.0 - 1.0; // Y negiert (siehe npNrmDecode)
  return vec4( vec3( xy, sqrt( clamp( 1.0 - dot( xy, xy ), 0.0, 1.0 ) ) ) * 0.5 + 0.5, 1.0 );
}
`;

const JOINT_FN = /* glsl */`
uniform vec4 npJoint; // x: Plattenmaß (m), y: Fugenbreite (m), z: Fugen-Abdunklung, w: Helligkeitsstreuung je Platte
float npJm = 0.0; vec2 npJg = vec2( 0.0 );
`;

const GRIME_FN = /* glsl */`
uniform vec4 npGrimeP; // x: Schmutz, y: Nässe, z: Rauheit-Zuschlag Schmutz, w: Rauheit-Abschlag Nässe
varying float vNpGrime;
float npGrM = 0.0, npWetM = 0.0;
`;

/** Umlenken von texture2D um einen three-Einschluss herum. */
const wrap = (inc, fn) => `#undef texture2D\n#define texture2D( s, c ) ${fn}( s, c )\n#include <${inc}>\n#undef texture2D\n#define texture2D texture`;

const _fns = new Map();
/**
 * Haken-Funktion je Variante (gleiche Variante = gleiche Funktion und gleicher Programmtext).
 * v: { nxy, hex (Kontrast 0..1, 0 = aus), hexScale, rot (0..1), grime (0..1), wet (0..1), joint ([Maß m, Fuge m, Abdunklung, Streuung]) }
 */
function surfaceFn(v, noiseTex) {
  const key = variantKey(v);
  let fn = _fns.get(key);
  if (fn) return fn;
  const u = {
    npSurf: { value: new THREE.Vector4(v.hex || 0, v.hexScale || 1.4, v.rot || 0, 0) },
    npSurfNoise: { value: noiseTex },
    npGrimeP: { value: new THREE.Vector4(v.grime || 0, v.wet ?? 0.8, 0.12, 0.38) },
    npJoint: { value: new THREE.Vector4(...(v.joint || [6, 0.012, 1, 0.1])) },
  };
  fn = (shader) => {
    Object.assign(shader.uniforms, u);
    if (v.grime || v.joint) ensureWorldVaryings(shader); // vor dem Lesen des Fragment-Texts (fügt dort Varyings ein)
    let fs = shader.fragmentShader;
    const head = [];
    if (v.nxy) head.push('#define NP_NXY 1');
    if (v.hex) head.push('#define NP_HEX 1', HEX_FN);
    else if (v.nxy) head.push(NXY_FN);
    if (v.grime || v.joint) head.push('uniform sampler2D npSurfNoise;');
    if (v.grime) head.push(GRIME_FN);
    if (v.joint) head.push(JOINT_FN);
    fs = fs.replace('#include <common>', '#include <common>\n' + head.join('\n'));
    if (v.hex) {
      fs = fs.replace('#include <map_fragment>', wrap('map_fragment', 'npHexMap'))
        .replace('#include <normal_fragment_maps>', wrap('normal_fragment_maps', 'npHexNrm'))
        .replace('#include <roughnessmap_fragment>', wrap('roughnessmap_fragment', 'npHexOrm'))
        .replace('#include <metalnessmap_fragment>', wrap('metalnessmap_fragment', 'npHexOrm'))
        .replace('#include <aomap_fragment>', wrap('aomap_fragment', 'npHexOrm'));
    } else if (v.nxy) {
      fs = fs.replace('#include <normal_fragment_maps>', wrap('normal_fragment_maps', 'npNxyTex'));
    }
    if (v.joint) {
      // Plattenfugen in Weltkoordinaten (nur nach oben weisende Flächen): Fuge abdunkeln, Kante zur Fuge neigen,
      // jede Platte leicht anders hell – ersetzt die in den früheren 6-m-Satz gemalten Fugen, gestochen scharf
      fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
        if ( normalize( vNpNormal ).y > 0.85 ) {
          vec2 npJp = vNpWorld.xz / npJoint.x, npJc = floor( npJp ), npJf = fract( npJp ) - 0.5;
          vec2 npJd = ( 0.5 - abs( npJf ) ) * npJoint.x;
          float npJdm = min( npJd.x, npJd.y ), npJaa = fwidth( npJdm ) + 1e-4;
          float npJw = npJoint.y * ( 0.7 + 0.6 * texture2D( npSurfNoise, vNpWorld.xz * 0.37 ).b );
          npJm = ( 1.0 - smoothstep( npJw - npJaa, npJw + npJaa * 2.5, npJdm ) ) * ( 1.0 - smoothstep( 0.6, 2.0, npJaa / npJoint.y ) );
          npJg = npJd.x < npJd.y ? vec2( sign( npJf.x ), 0.0 ) : vec2( 0.0, sign( npJf.y ) );
          float npJh = fract( sin( dot( npJc, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
          diffuseColor.rgb *= ( 1.0 + ( npJh - 0.5 ) * npJoint.w ) * mix( 1.0, 0.42, npJm * npJoint.z );
        }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if ( npJm > 0.001 ) normal = normalize( normal + ( viewMatrix * vec4( npJg.x, 0.0, npJg.y, 0.0 ) ).xyz * npJm * 0.7 );`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = min( 1.0, roughnessFactor + npJm * 0.15 );`);
    }
    if (v.grime) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float npGrime;\nvarying float vNpGrime;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNpGrime = npGrime;');
      // nach den Vertexfarben (Boden-AO des Builders): unregelmäßiger Schmutzsaum + feuchte Kante, leicht bräunlich
      fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
        if ( vNpGrime > 0.004 ) {
          vec3 npGn = abs( normalize( vNpNormal ) );
          vec2 npGp = npGn.x > npGn.z ? vNpWorld.zy : vNpWorld.xy;
          float npG1 = texture2D( npSurfNoise, npGp * vec2( 0.31, 0.9 ) ).b, npG2 = texture2D( npSurfNoise, npGp * vec2( 0.07, 0.21 ) + 0.41 ).r;
          float npGe = vNpGrime + ( npG1 - 0.5 ) * 0.42 + ( npG2 - 0.5 ) * 0.38;
          npGrM = smoothstep( 0.46, 0.8, npGe ) * npGrimeP.x;
          npWetM = smoothstep( 0.9, 0.985, vNpGrime + ( npG1 - 0.5 ) * 0.1 ) * npGrimeP.y;
          diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.74, 0.69, 0.62 ), npGrM ) * ( 1.0 - 0.32 * npWetM );
        }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp( roughnessFactor + npGrM * npGrimeP.z - npWetM * npGrimeP.w, 0.06, 1.0 );`);
    }
    shader.fragmentShader = fs;
  };
  _fns.set(key, fn);
  return fn;
}

function variantKey(v) {
  return [v.nxy ? 'n' : '', v.hex ? `h${v.hex}/${v.hexScale || 1.4}/${v.rot || 0}` : '', v.grime ? `g${v.grime}/${v.wet ?? 0.8}` : '', v.joint ? 'j' + v.joint.join('/') : ''].filter(Boolean).join('-');
}

/**
 * Oberflächen-Haken setzen/austauschen/entfernen (alles aus → kein Haken). Der Schlüssel enthält die Variante,
 * damit three verschiedene Programme anlegt (customProgramCacheKey enthält die Haken-Namen).
 */
export function applySurface(mat, v, noiseTex) {
  const key = variantKey(v);
  const old = mat.userData.npSurfKey;
  if (old && old !== key) removeShaderPatch(mat, 'surf:' + old);
  if (!key) { mat.userData.npSurfKey = null; return mat; }
  mat.userData.npSurfKey = key;
  return addShaderPatch(mat, 'surf:' + key, surfaceFn(v, noiseTex));
}
