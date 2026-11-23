// NULLPUNKT — Bildschirmraum-Licht (gfx-licht): Reflexionen (SSR) und Kontaktschatten (Bildschirmraum-Sonnenschatten).
//
// Beide laufen in engine/post/pipeline.js direkt nach der Welt (vor Viewmodel und TAA) und lesen:
//   • die volle Tiefe der Szene (hdr.depthTexture, gleiche Kamera samt TAA-Versatz),
//   • den Normalen-Vorpass der GTAO (halbe Auflösung auf „hoch“, voll auf „ultra“). Dessen Material ersetzt
//     gbufferMaterial(): Blicknormale (rgb) + Glanz im Alphakanal (Rauheit aus Wert × Rauheitskarte, +2 für Metall).
//     Ohne GTAO (Einstellung AO aus) zeichnet die Kette nur diesen Vorpass.
//
// SSR (ultra; Option gfxSSR): Strahlmarsch im Blickraum (24 Schritte, quadratisch wachsend, + 5 Halbierungsschritte)
// gegen die Tiefe, Startversatz je Bild gedreht (TAA mittelt), Auflösung des Normalen-Vorpasses (ultra voll, sonst halb).
// Getroffene Farbe = HDR-Bild dieses
// Bilds. Gewicht = Fresnel (Schlick, F0 0,04 bzw. Metall 0,6) × Glanz × Rand-/Distanz-/Rückblick-Ausblendung. Mischen
// ersetzt den Anteil der (zu hellen, himmelsfarbenen) Umgebungsspiegelung durch das, was wirklich gegenüber steht:
// Wasser im Hafen, Glas, Metall, glatte Böden.
// Kontaktschatten (high/ultra; Option gfxContact): Strahl zur Sonne über 0,45 m (12 Schritte) in der Tiefe – kleine
// Verdeckungen, die die Schattenkarte (1,5–4 cm Texel) verliert: Füße, Kisten, Sandsäcke auf dem Boden, Leisten.
// Eigenes 8-Bit-Ziel (die Tiefe hängt am HDR-Ziel – darin lesen und zugleich zeichnen wäre eine Rückkopplung), dann
// multiplikativ aufs HDR-Bild (nur Flächen, die zur Sonne zeigen), ausgeblendet nach 35 m.

import * as THREE from 'three';
import { FULLSCREEN_VERT, GLSL_COMMON } from './common.js?v=20261123073102';

/* ------------------------------------------------------------ Normalen + Glanz (Vorpass) */

const GB_VERT_UV = /* glsl */ `
  uniform mat3 npUvT;
  varying vec2 vNpUv;
`;

/** Material für den Normalen-Vorpass: wie MeshNormalMaterial, Alpha = Rauheit (+2 für Metall) des Objektmaterials. */
export function gbufferMaterial() {
  const lib = THREE.ShaderLib.normal;
  const uniforms = THREE.UniformsUtils.clone(lib.uniforms);
  Object.assign(uniforms, {
    npUvT: { value: new THREE.Matrix3() },
    npRoughMap: { value: null },
    npRough: { value: new THREE.Vector4(1, 0, 0, 0) }, // x Rauheit, y Metall, z Karte an, w Kanal (1 = G)
  });
  let vs = lib.vertexShader.replace('#include <common>', `#include <common>\n${GB_VERT_UV}`);
  vs = vs.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vNpUv = ( npUvT * vec3( uv, 1.0 ) ).xy;');
  let fs = lib.fragmentShader.replace('uniform float opacity;', `uniform float opacity;
  uniform sampler2D npRoughMap;
  uniform vec4 npRough;
  varying vec2 vNpUv;`);
  const out = 'gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );';
  if (!fs.includes(out) || !vs.includes('vNpUv = ')) return null; // three.js-Bausteine geändert → Standard-Normalenmaterial
  fs = fs.replace(out, `float npR = npRough.x;
  if ( npRough.z > 0.5 ) npR *= texture2D( npRoughMap, vNpUv ).g;
  gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, min( npR, 0.999 ) + 2.0 * step( 0.5, npRough.y ) );`);
  fs = fs.replace('#ifdef OPAQUE\n\t\tgl_FragColor.a = 1.0;\n\t#endif', '');
  const m = new THREE.ShaderMaterial({ name: 'np:gbuffer', uniforms, vertexShader: vs, fragmentShader: fs, blending: THREE.NoBlending });
  const R = uniforms.npRough.value;
  const last = { mat: null };
  m.onBeforeRender = function (renderer, scene, camera, geometry, object, group) {
    let src = object.material;
    if (Array.isArray(src)) src = src[group && group.materialIndex != null ? group.materialIndex : 0];
    if (src === last.mat) return;
    last.mat = src;
    let rough = 1, metal = 0, map = null;
    if (src && (src.isMeshStandardMaterial || src.isMeshPhysicalMaterial)) {
      rough = src.roughness ?? 1;
      metal = (src.metalness ?? 0) * (src.metalnessMap ? 0.6 : 1);
      if (src.userData && Number.isFinite(src.userData.npGloss)) rough = src.userData.npGloss;
      else if (src.roughnessMap && src.roughnessMap.isTexture && src.roughnessMap.image) map = src.roughnessMap;
    } else if (src && src.isMeshPhongMaterial) rough = Math.max(0.2, 1 - (src.shininess || 30) / 120);
    R.set(rough, metal, map ? 1 : 0, 1);
    uniforms.npRoughMap.value = map;
    if (map) { if (map.matrixAutoUpdate) map.updateMatrix(); uniforms.npUvT.value.copy(map.matrix); }
    this.uniformsNeedUpdate = true;
  };
  m.npResetCache = () => { last.mat = null; };
  return m;
}

/* ------------------------------------------------------------ Reflexionen */

const SSR_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  uniform sampler2D tColor;
  uniform highp sampler2D tDepth;
  uniform sampler2D tNormal;
  uniform mat4 uProj;
  uniform mat4 uInvProj;
  uniform vec4 uSize;        // volle Auflösung (Tiefe/Farbe)
  uniform float uSeed;
  uniform float uMaxDist;
  uniform float uStrength;
  varying vec2 vUv;
  vec3 viewPos(vec2 uv, float d) { vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
  vec2 proj(vec3 p) { vec4 c = uProj * vec4(p, 1.0); return (c.xy / c.w) * 0.5 + 0.5; }
  float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
  void main() {
    gl_FragColor = vec4(0.0);
    float d = texture2D(tDepth, vUv).x;
    if (d >= 0.99999) return;
    vec4 nr = texture2D(tNormal, vUv);
    float metal = step(1.5, nr.a);
    float rough = nr.a - 2.0 * metal;
    float gloss = 1.0 - smoothstep(0.18, 0.55, rough);
    if (gloss <= 0.0) return;
    vec3 P = viewPos(vUv, d);
    vec3 nRaw = nr.rgb * 2.0 - 1.0;
    if (!(dot(nRaw, nRaw) > 0.01)) return; // leere Normale → normalize() wäre NaN (echte GPUs)
    vec3 N = normalize(nRaw);
    vec3 V = normalize(-P);
    float nv = max(dot(N, V), 0.0);
    vec3 F0 = vec3(mix(0.04, 0.6, metal));
    float F = F0.x + (1.0 - F0.x) * pow(1.0 - nv, 5.0);
    vec3 Rd = reflect(-V, N);
    // leichte Streuung je nach Rauheit (TAA mittelt)
    float n = ign(gl_FragCoord.xy + uSeed * 37.0);
    float n2 = ign(gl_FragCoord.yx * 1.37 + uSeed * 17.0);
    vec3 tA = normalize(abs(N.y) < 0.9 ? cross(N, vec3(0.0, 1.0, 0.0)) : cross(N, vec3(1.0, 0.0, 0.0)));
    vec3 tB = cross(N, tA);
    float ang = n2 * 6.2831853;
    Rd = normalize(Rd + (tA * cos(ang) + tB * sin(ang)) * rough * rough * 0.6 * n);
    float back = smoothstep(-0.2, 0.25, -Rd.z); // Strahlen zur Kamera hin sind unzuverlässig
    if (back <= 0.0) return;
    float dist = min(uMaxDist, max(4.0, -P.z * 1.5));
    vec3 O = P + N * (0.02 + 0.002 * -P.z);
    const int STEPS = 24;
    float tPrev = 0.0;
    float hit = 0.0;
    vec2 huv = vec2(0.0);
    for (int i = 1; i <= STEPS; i++) {
      float f = (float(i) - 1.0 + n) / float(STEPS);
      float t = dist * f * f + 0.05;
      vec3 Q = O + Rd * t;
      if (Q.z > -0.05) break;
      vec2 suv = proj(Q);
      if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) break;
      float sd = texture2D(tDepth, suv).x;
      float sz = viewPos(suv, sd).z;
      float dz = sz - Q.z; // > 0: Strahl liegt hinter der sichtbaren Fläche
      float thick = 0.12 + (t - tPrev) * 1.2 + 0.01 * -Q.z;
      if (dz > 0.0 && dz < thick && sd < 0.99999) {
        // Halbierung zwischen tPrev und t
        float a = tPrev, b = t;
        for (int k = 0; k < 5; k++) {
          float m = 0.5 * (a + b);
          vec3 M = O + Rd * m;
          vec2 muv = proj(M);
          float mz = viewPos(muv, texture2D(tDepth, muv).x).z;
          if (mz - M.z > 0.0) b = m; else a = m;
        }
        huv = proj(O + Rd * b);
        hit = 1.0 - smoothstep(0.55, 1.0, b / dist);
        break;
      }
      tPrev = t;
    }
    if (hit <= 0.0) return;
    vec2 e = smoothstep(vec2(0.0), vec2(0.08, 0.1), huv) * (1.0 - smoothstep(vec2(0.92, 0.9), vec2(1.0), huv));
    float w = F * gloss * hit * back * e.x * e.y * uStrength;
    vec3 c = texture2D(tColor, huv).rgb;
    c = min(c, vec3(64.0)); // Sonnenscheibe/Glanzlichter nicht als Feuerwerk spiegeln
    vec4 o = vec4(c * w, w);
    gl_FragColor = all(equal(o, o)) && all(lessThan(abs(o), vec4(1e30))) ? o : vec4(0.0);
  }
`;

// Zusammensetzen: HDR = HDR·(1 − w) + Spiegelung (vormultipliziert), bilinear aus halber Auflösung
const SSR_MIX_FRAG = /* glsl */ `
  uniform sampler2D tSSR;
  varying vec2 vUv;
  void main() { vec4 s = texture2D(tSSR, vUv); gl_FragColor = vec4(s.rgb, s.a); }
`;

export class ScreenSpaceReflections {
  constructor(fmt) {
    this.fmt = fmt;
    this.target = null;
    this.scale = 0.5;
    this.w = 1; this.h = 1;
    this.mat = new THREE.ShaderMaterial({
      name: 'np:ssr',
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, tNormal: { value: null },
        uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() },
        uSize: { value: new THREE.Vector4(1, 1, 1, 1) }, uSeed: { value: 0 }, uMaxDist: { value: 40 }, uStrength: { value: 0.85 },
      },
      vertexShader: FULLSCREEN_VERT, fragmentShader: SSR_FRAG, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    this.mixMat = new THREE.ShaderMaterial({
      name: 'np:ssr-mix', uniforms: { tSSR: { value: null } },
      vertexShader: FULLSCREEN_VERT, fragmentShader: SSR_MIX_FRAG, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
  }

  setSize(renderer, w, h) {
    this.w = w; this.h = h;
    // RGBA16F (Gewicht im Alphakanal)
    const sw = Math.max(1, Math.round(w * this.scale)), sh = Math.max(1, Math.round(h * this.scale));
    if (!this.target) {
      this.target = new THREE.WebGLRenderTarget(sw, sh, {
        format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false,
        magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false,
      });
      this.target.texture.name = 'np:ssr';
      this.target.npBpp = 8;
    } else this.target.setSize(sw, sh);
  }

  render(renderer, fs, hdr, normalTex, camera, seed) {
    const u = this.mat.uniforms;
    u.tColor.value = hdr.texture;
    u.tDepth.value = hdr.depthTexture;
    u.tNormal.value = normalTex;
    u.uProj.value.copy(camera.projectionMatrix);
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uSize.value.set(this.w, this.h, 1 / this.w, 1 / this.h);
    u.uSeed.value = seed;
    fs.draw(renderer, this.mat, this.target);
    this.mixMat.uniforms.tSSR.value = this.target.texture;
    fs.draw(renderer, this.mixMat, hdr);
  }

  materials() { return [this.mat, this.mixMat]; }
  bytes() { return this.target ? this.target.width * this.target.height * 8 : 0; }
  dispose() { if (this.target) this.target.dispose(); this.target = null; this.mat.dispose(); this.mixMat.dispose(); }
}

/* ------------------------------------------------------------ Kontaktschatten */

const CONTACT_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  uniform highp sampler2D tDepth;
  uniform sampler2D tNormal;
  uniform float uHasNormal;
  uniform mat4 uProj;
  uniform mat4 uInvProj;
  uniform vec3 uSunView;     // Richtung zur Sonne (Blickraum)
  uniform vec4 uSize;
  uniform float uSeed;
  uniform float uStrength;
  uniform float uLength;
  // grafik (22.11.): Verdecker nur aus der deckenden Tiefe des Normalen-Vorpasses (ohne Gras/Laub/Alpha-Karten, eigene
  // AO-Kamera mit kürzerer Sichtweite → eigene Rückprojektion). Mit der vollen Szenentiefe warfen Grasbüschel als
  // „massive“ Körper schwarze Mulden auf den Boden.
  uniform highp sampler2D tOpaque;
  uniform float uHasOpaque;
  uniform mat4 uInvProjO;
  varying vec2 vUv;
  vec3 viewPos(vec2 uv, float d) { vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
  vec3 viewPosO(vec2 uv, float d) { vec4 p = uInvProjO * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
  vec2 proj(vec3 p) { vec4 c = uProj * vec4(p, 1.0); return (c.xy / c.w) * 0.5 + 0.5; }
  float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
  void main() {
    gl_FragColor = vec4(1.0);
    float d = texture2D(tDepth, vUv).x;
    if (d >= 0.99999) return;
    vec3 P = viewPos(vUv, d);
    float fade = 1.0 - smoothstep(22.0, 35.0, -P.z);
    if (fade <= 0.0) return;
    vec3 N;
    if (uHasNormal > 0.5) N = normalize(texture2D(tNormal, vUv).rgb * 2.0 - 1.0);
    else {
      vec3 px = viewPos(vUv + vec2(uSize.z, 0.0), texture2D(tDepth, vUv + vec2(uSize.z, 0.0)).x) - P;
      vec3 py = viewPos(vUv + vec2(0.0, uSize.w), texture2D(tDepth, vUv + vec2(0.0, uSize.w)).x) - P;
      N = normalize(cross(px, py));
    }
    if (!(dot(N, N) > 0.5)) return; // NaN/leere Normale (echte GPUs) → kein Kontaktschatten
    float nl = dot(N, uSunView);
    if (nl <= 0.02) return; // abgewandt: liegt ohnehin im Eigenschatten
    float n = ign(gl_FragCoord.xy + uSeed * 23.0);
    vec3 O = P + N * (0.008 + 0.0015 * -P.z);
    const int STEPS = 12;
    float occ = 0.0;
    for (int i = 0; i < STEPS; i++) {
      float t = uLength * (float(i) + n) / float(STEPS);
      vec3 Q = O + uSunView * t;
      vec2 suv = proj(Q);
      if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) break;
      float sd = texture2D(tDepth, suv).x;
      float dz = viewPos(suv, sd).z - Q.z;
      // dünne Verdecker zählen (Dicke ~ 0,3 m + Tiefenauflösung): kein Schatten hinter ganzen Wänden
      float thick = 0.3 + 0.004 * -Q.z;
      bool hit = dz > 0.015 && dz < thick;
      // Verdecker muss auch in der deckenden Tiefe davor liegen (Gras/Laub zählen nicht). Nur als Bestätigung: die
      // Vorpass-Tiefe hat high halbe Auflösung – allein genutzt warf der Boden flacher Blickwinkel Zeilenstreifen auf sich selbst
      if (hit && uHasOpaque > 0.5) { float so = texture2D(tOpaque, suv).x; hit = so < 0.99999 && viewPosO(suv, so).z - Q.z > 0.5 * dz; }
      if (hit) { occ = 1.0 - float(i) / float(STEPS) * 0.5; break; }
    }
    float s = occ * fade * smoothstep(0.02, 0.2, nl) * uStrength;
    gl_FragColor = vec4(vec3(1.0 - s), 1.0);
  }
`;

const CONTACT_MIX_FRAG = /* glsl */ `
  uniform sampler2D tShadow;
  varying vec2 vUv;
  void main() { gl_FragColor = vec4(texture2D(tShadow, vUv).rgb, 1.0); }
`;

export class ContactShadows {
  constructor() {
    this.w = 1; this.h = 1;
    this.target = null;
    this.sunView = new THREE.Vector3();
    this.mat = new THREE.ShaderMaterial({
      name: 'np:contact',
      uniforms: {
        tDepth: { value: null }, tNormal: { value: null }, uHasNormal: { value: 0 },
        uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() },
        uSunView: { value: this.sunView }, uSize: { value: new THREE.Vector4(1, 1, 1, 1) },
        uSeed: { value: 0 }, uStrength: { value: 0.55 }, uLength: { value: 0.45 },
        tOpaque: { value: null }, uHasOpaque: { value: 0 }, uInvProjO: { value: new THREE.Matrix4() },
      },
      vertexShader: FULLSCREEN_VERT, fragmentShader: CONTACT_FRAG, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    this.mixMat = new THREE.ShaderMaterial({
      name: 'np:contact-mix', uniforms: { tShadow: { value: null } },
      vertexShader: FULLSCREEN_VERT, fragmentShader: CONTACT_MIX_FRAG, depthTest: false, depthWrite: false, transparent: true,
      // HDR × Ergebnis
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
    });
  }

  setSize(w, h) {
    this.w = w; this.h = h;
    if (!this.target) {
      this.target = new THREE.WebGLRenderTarget(w, h, {
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false,
        magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false,
      });
      this.target.texture.name = 'np:kontakt';
    } else this.target.setSize(w, h);
  }

  /**
   * sunDir = Richtung zur Sonne (Welt); strength 0..1 (Sonnenanteil der Karte). opaqueDepth/opaqueCam (optional): Tiefe des
   * Normalen-Vorpasses (nur deckende Geometrie) und die Kamera, mit der er gezeichnet wurde – dann zählen nur diese als Verdecker.
   */
  render(renderer, fs, hdr, normalTex, camera, sunDir, seed, strength, opaqueDepth = null, opaqueCam = null) {
    const u = this.mat.uniforms;
    u.tOpaque.value = opaqueDepth && opaqueCam ? opaqueDepth : null;
    u.uHasOpaque.value = opaqueDepth && opaqueCam ? 1 : 0;
    if (opaqueDepth && opaqueCam) u.uInvProjO.value.copy(opaqueCam.projectionMatrixInverse);
    u.tDepth.value = hdr.depthTexture;
    u.tNormal.value = normalTex;
    u.uHasNormal.value = normalTex ? 1 : 0;
    u.uProj.value.copy(camera.projectionMatrix);
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    this.sunView.copy(sunDir).transformDirection(camera.matrixWorldInverse);
    u.uSize.value.set(this.w, this.h, 1 / this.w, 1 / this.h);
    u.uSeed.value = seed;
    u.uStrength.value = strength;
    fs.draw(renderer, this.mat, this.target);
    this.mixMat.uniforms.tShadow.value = this.target.texture;
    fs.draw(renderer, this.mixMat, hdr);
  }

  materials() { return [this.mat, this.mixMat]; }
  bytes() { return this.target ? this.target.width * this.target.height * 4 : 0; }
  dispose() { if (this.target) this.target.dispose(); this.target = null; this.mat.dispose(); this.mixMat.dispose(); }
}

