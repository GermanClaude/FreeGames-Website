// NULLPUNKT — Oberflächen-Haken der Welt-Materialien (Owner: engine/texturen, 14.11.)
//
// Ein Shader-Haken „surf:<variante>“ (über world/shading.js addShaderPatch) für Fotoscan- und prozedurale Materialien:
//   • nxy   – Normalen-Karten als XY-Paar (X in RGB, Y in Alpha; Z rekonstruiert). ETC1S hat getrennte Farb- und
//             Alpha-Ebenen → deutlich sauberere Normalen als RGB-ETC1S (gemessen PSNR 27 → 33 dB) bei ≈ 1,7× Datei.
//             Die Sätze tragen im Manifest tiers[n].normalXY (assets/lib/loader.js setzt set.normalXY).
//             Dabei wird Y negiert (OpenGL-Scan ohne Y-Spiegelung im KTX2) und die Sätze werden mit negativer
//             V-Wiederholung gezeichnet (engine/textures.js) – Bilder stehen aufrecht, Relief ist nicht mehr vertikal
//             invertiert.
//   • nflip – (texturen3) dasselbe für RGB-Normalen: Alle Poly-Haven-Sätze liegen ungespiegelt im KTX2 (Zeile 0 =
//             Bildoberkante) – außer den 512ern der Runde-2-Sätze (Manifest tiers[n].vflip). loader.js setzt
//             set.unflipped; textures.js zeichnet dann mit negativer V-Wiederholung, hier wird Y negiert. Vorher
//             standen die alten Sätze (und low) kopf und ihr Relief war vertikal invertiert.
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
import { addShaderPatch, removeShaderPatch, ensureWorldVaryings } from '../world/shading.js?v=20261123115551';

const HEX_FN = /* glsl */`
uniform vec4 npSurf; // x: Hex-Kontrast, y: Hex-Zellen je Texturwiederholung, z: Drehung (0..1), w: Tiefen-Angleich (0..1, NP_HEXEQ)
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
  // texturen3: Versatz NUR aus dem Eckpunkt (früher je Platz h0 / h1.yx / fract(h2·1,7) – derselbe Gitterpunkt bekam in den
  // beiden angrenzenden Dreiecken verschiedene Versätze → harte, gerade Kanten = das Dreiecks-Flickenmuster auf Putz)
  npHxO0 = h0; npHxO1 = h1; npHxO2 = h2;
  npHxWf = npHxW / ( npHxW.x + npHxW.y + npHxW.z );
}
vec4 npHxTap( sampler2D s, vec2 uv, mat2 R, vec2 o ) { return textureGrad( s, R * uv + o, R * npHxDx, R * npHxDy ); }
// Albedo: Gewichte aus der Helligkeit der drei Abtastungen (helle Details setzen sich durch, kein Grauschleier).
// texturen3 (14.11.): Auf hellen, fast strukturlosen Flächen (Glattputz) zeichnete die alte Mischung ein Dreiecks-/
// Flickenmuster: jede Zelle holt einen anderen Ausschnitt mit anderer Grundhelligkeit (Wolken im Scan), und in den
// Zellmitten mittelt die Dreifach-Mischung das Korn weg (weniger Kontrast → sichtbare Punkte im Gitterabstand).
// Abhilfe: (1) Tiefen angleichen (NP_HEXEQ): je Abtastung eine grobe Mip-Stufe (≈ 1/8 der Kachel) lesen und auf den
// Texturmittelwert (1×1-Stufe) ziehen – Zellen unterscheiden sich nur noch im Feindetail, die großräumige Variation
// kommt aus der Weltraum-Variation (Makro-Haken); (2) Feindetail varianzerhaltend mischen (÷ √Σw², Heitz/Neyret),
// damit das Korn in den Mischzonen so kräftig bleibt wie in den Zellen.
vec4 npHexMap( sampler2D s, vec2 uv ) {
  if ( !npHxReady ) npHxSetup( uv );
  vec2 u0 = npHxR0 * uv + npHxO0, u1 = npHxR1 * uv + npHxO1, u2 = npHxR2 * uv + npHxO2;
  vec4 c0 = textureGrad( s, u0, npHxR0 * npHxDx, npHxR0 * npHxDy ), c1 = textureGrad( s, u1, npHxR1 * npHxDx, npHxR1 * npHxDy ), c2 = textureGrad( s, u2, npHxR2 * npHxDx, npHxR2 * npHxDy );
#ifdef NP_HEXEQ
  float npLod = max( 0.0, log2( float( textureSize( s, 0 ).x ) ) - 3.0 );
  vec3 m = textureLod( s, vec2( 0.5 ), 16.0 ).rgb;
  vec3 l0 = textureLod( s, u0, npLod ).rgb, l1 = textureLod( s, u1, npLod ).rgb, l2 = textureLod( s, u2, npLod ).rgb;
  // Feindetail relativ zur eigenen Umgebung (multiplikativ: Farbverhältnisse bleiben, nie negativ)
  vec3 d0 = c0.rgb / max( l0, 1e-3 ), d1 = c1.rgb / max( l1, 1e-3 ), d2 = c2.rgb / max( l2, 1e-3 );
  vec3 L = vec3( dot( d0, vec3( 0.299, 0.587, 0.114 ) ), dot( d1, vec3( 0.299, 0.587, 0.114 ) ), dot( d2, vec3( 0.299, 0.587, 0.114 ) ) );
  vec3 W = mix( vec3( 1.0 ), L, npSurf.x ) * pow( npHxW, vec3( 7.0 ) );
  npHxWf = W / max( W.x + W.y + W.z, 1e-5 );
  vec3 lo = mix( l0 * npHxWf.x + l1 * npHxWf.y + l2 * npHxWf.z, m, npSurf.w );
  vec3 dt = d0 * npHxWf.x + d1 * npHxWf.y + d2 * npHxWf.z;
  float k = min( 1.6, inversesqrt( max( dot( npHxWf, npHxWf ), 1e-4 ) ) );
  dt = max( vec3( 0.0 ), 1.0 + ( dt - 1.0 ) * k );
  return vec4( lo * dt, c0.a * npHxWf.x + c1.a * npHxWf.y + c2.a * npHxWf.z );
#else
  vec3 L = vec3( dot( c0.rgb, vec3( 0.299, 0.587, 0.114 ) ), dot( c1.rgb, vec3( 0.299, 0.587, 0.114 ) ), dot( c2.rgb, vec3( 0.299, 0.587, 0.114 ) ) );
  vec3 W = mix( vec3( 1.0 ), L, npSurf.x ) * pow( npHxW, vec3( 7.0 ) );
  npHxWf = W / max( W.x + W.y + W.z, 1e-5 );
  return c0 * npHxWf.x + c1 * npHxWf.y + c2 * npHxWf.z;
#endif
}
vec3 npNrmDecode( vec4 t ) {
#ifdef NP_NXY
  // Y negiert: KTX2 liegt ohne Y-Spiegelung vor (Zeile 0 = Bildoberkante bei t = 0), die Scans sind OpenGL-Normalen
  // (+Y = Bild-oben = −t); three erwartet +Y = +t (Bitangente aus den UV-Ableitungen)
  vec2 xy = vec2( t.r, 1.0 - t.a ) * 2.0 - 1.0;
  return vec3( xy, sqrt( clamp( 1.0 - dot( xy, xy ), 0.0, 1.0 ) ) );
#elif defined( NP_NFLIP )
  return vec3( t.x, 1.0 - t.y, t.z ) * 2.0 - 1.0; // RGB-Normale eines ungespiegelt kodierten Scans: Y negiert
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

// texturen3: RGB-Normalen ungespiegelt kodierter Poly-Haven-Sätze (alle Stufen außer den gespiegelten 512ern der
// Runde-2-Sätze, Manifest tiers[n].vflip): Bild wird mit negativer V-Wiederholung aufrecht gezeichnet, Y negiert
const NFLIP_FN = /* glsl */`
vec4 npNflipTex( sampler2D s, vec2 uv ) { vec4 t = texture( s, uv ); return vec4( t.r, 1.0 - t.g, t.b, t.a ); }
`;

// texturen3: Tiefen-Angleich ohne Hex (Mauerwerk, Holz, Blech …): großräumige Flecken des Scans (z. B. die dunklen
// Wolken im Ziegelsatz, die sich auf großen Fassaden alle 2,5 m wiederholen) über eine grobe Mip-Stufe (≈ 1/8 Kachel)
// herausrechnen; die großräumige Variation kommt dann aus der Weltraum-Variation (nicht kachelnd). 2 Abfragen mehr.
const EQ_FN = /* glsl */`
uniform vec4 npSurf;
vec4 npEqMap( sampler2D s, vec2 uv ) {
  vec4 c = texture( s, uv );
  float lod = max( 0.0, log2( float( textureSize( s, 0 ).x ) ) - 3.0 );
  vec3 lo = textureLod( s, uv, lod ).rgb, m = textureLod( s, vec2( 0.5 ), 16.0 ).rgb;
  c.rgb *= mix( vec3( 1.0 ), m / max( lo, vec3( 2e-3 ) ), npSurf.w );
  return c;
}
`;

// texturen3: Verwitterung in Weltkoordinaten auf senkrechten Flächen – Regen-/Schmutzläufer (senkrecht gestreckte
// Rauschbänder in Zonen) und fleckige Verfärbung; unabhängig von der Texturkachel, daher keine Wiederholung.
const WEATHER_FN = /* glsl */`
uniform vec4 npWeather; // x: Läufer, y: Flecken, z: Läufer-Dichte, w: frei
float npWxR = 0.0;
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
 * v: { nxy, nflip (RGB-Normale, Y negiert), hex (Kontrast 0..1, 0 = aus), hexScale, rot (0..1), hexEq (Tiefen-Angleich 0..1),
 *      eq (Tiefen-Angleich ohne Hex 0..1), weather ([Läufer, Flecken, Dichte] senkrechte Flächen), grime (0..1), wet (0..1), joint ([Maß m, Fuge m, Abdunklung, Streuung]) }
 */
function surfaceFn(v, noiseTex) {
  const key = variantKey(v);
  let fn = _fns.get(key);
  if (fn) return fn;
  const u = {
    npSurf: { value: new THREE.Vector4(v.hex || 0, v.hexScale || 1.4, v.rot || 0, v.hex ? v.hexEq || 0 : v.eq || 0) },
    npSurfNoise: { value: noiseTex },
    npGrimeP: { value: new THREE.Vector4(v.grime || 0, v.wet ?? 0.8, 0.12, 0.38) },
    npJoint: { value: new THREE.Vector4(...(v.joint || [6, 0.012, 1, 0.1])) },
    npWeather: { value: new THREE.Vector4(...(v.weather || [0, 0, 0.5, 0])) },
  };
  fn = (shader) => {
    Object.assign(shader.uniforms, u);
    if (v.grime || v.joint || v.weather) ensureWorldVaryings(shader); // vor dem Lesen des Fragment-Texts (fügt dort Varyings ein)
    let fs = shader.fragmentShader;
    const head = [];
    if (v.nxy) head.push('#define NP_NXY 1');
    else if (v.nflip) head.push('#define NP_NFLIP 1');
    if (v.hex && v.hexEq) head.push('#define NP_HEXEQ 1');
    if (v.hex) head.push('#define NP_HEX 1', HEX_FN);
    else if (v.nxy) head.push(NXY_FN);
    else if (v.nflip) head.push(NFLIP_FN);
    if (!v.hex && v.eq) head.push(EQ_FN);
    if (v.grime || v.joint || v.weather) head.push('uniform sampler2D npSurfNoise;');
    if (v.weather) head.push(WEATHER_FN);
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
    } else if (v.nflip) {
      fs = fs.replace('#include <normal_fragment_maps>', wrap('normal_fragment_maps', 'npNflipTex'));
    }
    if (!v.hex && v.eq) fs = fs.replace('#include <map_fragment>', wrap('map_fragment', 'npEqMap'));
    if (v.weather) {
      fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 npWn = normalize( vNpNormal );
          if ( abs( npWn.y ) < 0.5 ) {
            vec3 npWa = abs( npWn );
            vec2 npWp = npWa.x > npWa.z ? vNpWorld.zy : vNpWorld.xy;
            // Läufer: ≈ 6 cm breit, ≈ 1 m lang, nur in Zonen (≈ 10 m) – darin dichter oder lichter
            float npWs = texture2D( npSurfNoise, vec2( npWp.x * 0.55, npWp.y * 0.035 ) ).b;
            float npWz = texture2D( npSurfNoise, npWp * 0.021 + vec2( 0.13, 0.71 ) ).g;
            npWxR = smoothstep( 0.62 - 0.2 * npWeather.z, 0.88, npWs ) * smoothstep( 0.4, 0.72, npWz ) * npWeather.x;
            float npWf = texture2D( npSurfNoise, npWp * 0.09 + vec2( 0.7, 0.2 ) ).r;
            diffuseColor.rgb *= ( 1.0 - 0.26 * npWxR ) * mix( vec3( 1.0 ), vec3( 0.9, 0.92, 0.88 ), smoothstep( 0.55, 0.82, npWf ) * npWeather.y );
          }
        }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = min( 1.0, roughnessFactor + npWxR * 0.08 );`);
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
  return [v.nxy ? 'n' : v.nflip ? 'f' : '', v.hex ? `h${v.hex}/${v.hexScale || 1.4}/${v.rot || 0}${v.hexEq ? '/e' + v.hexEq : ''}` : v.eq ? 'e' + v.eq : '', v.weather ? 'w' + v.weather.join('/') : '', v.grime ? `g${v.grime}/${v.wet ?? 0.8}` : '', v.joint ? 'j' + v.joint.join('/') : ''].filter(Boolean).join('-');
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
