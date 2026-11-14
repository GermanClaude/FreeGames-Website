// NULLPUNKT — Tiefenschärfe beim Zielen (gfx-licht, Einstellung gfxDOF; Standard ab „hoch“).
//
// Nur während des Anlegens (viewmodel: scene.userData.npAds 0..1, mit Zielfernrohr-Overlay 0) und nur auf die Welt
// (vor dem Viewmodel, nach TAA): Schärfe liegt auf dem Ziel unter dem Fadenkreuz (Tiefe in der Bildmitte, auf der
// GPU geglättet – 1×1-Ping-Pong, kein Zurücklesen). Nahes vor dem Ziel (Deckungskante, Gras, Zaun) wird deutlich
// weich, Fernes dahinter nur leicht – wie ein Auge, das auf die Kimme scharf stellt. Unschärfekreis aus Tiefe, 16
// Proben auf einer Goldener-Winkel-Spirale; Proben zählen nur, wenn ihr eigener Kreis den Abstand deckt (kein
// Ausbluten scharfer Ziele in den Hintergrund). Kosten nur beim Zielen: 1 Vollbildpass + Kopie + 1×1; das HDR-Zwischenziel
// entsteht erst beim ersten Anlegen.

import * as THREE from 'three';
import { FULLSCREEN_VERT, GLSL_COMMON, hdrTarget } from './common.js?v=20261114060746';

const FOCUS_FRAG = /* glsl */ `
  uniform highp sampler2D tDepth;
  uniform sampler2D tPrev;
  uniform mat4 uInvProj;
  uniform float uRate;
  uniform float uReset;
  varying vec2 vUv;
  float lin(vec2 uv) { float d = texture2D(tDepth, uv).x; vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return -p.z / p.w; }
  void main() {
    // kleinste von 5 Tiefen um die Mitte (Ziel vor dem Hintergrund gewinnt)
    float z = lin(vec2(0.5));
    z = min(z, lin(vec2(0.5) + vec2(0.006, 0.0)));
    z = min(z, lin(vec2(0.5) - vec2(0.006, 0.0)));
    z = min(z, lin(vec2(0.5) + vec2(0.0, 0.01)));
    z = min(z, lin(vec2(0.5) - vec2(0.0, 0.01)));
    if (!(z == z) || z > 1e6) z = 400.0; // Himmel/NaN (echte GPUs: Division durch 0) → fern
    z = clamp(z, 0.5, 400.0);
    float prev = texelFetch(tPrev, ivec2(0), 0).r;
    float f = uReset > 0.5 || !(prev > 0.0) || prev > 1e6 ? z : exp(mix(log(prev), log(z), uRate));
    if (!(f == f)) f = z;
    gl_FragColor = vec4(f, 0.0, 0.0, 1.0);
  }
`;

const DOF_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  uniform sampler2D tColor;
  uniform highp sampler2D tDepth;
  uniform sampler2D tFocus;
  uniform mat4 uInvProj;
  uniform vec4 uSize;
  uniform float uMaxR;      // Pixel (volle Ausprägung)
  uniform float uAmount;    // Anlegen 0..1
  varying vec2 vUv;
  float lin(vec2 uv) { float d = texture2D(tDepth, uv).x; vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return -p.z / p.w; }
  float cocOf(float z, float f) {
    float nearC = clamp((f - z) / max(f, 1e-3) * 1.8 - 0.12, 0.0, 1.0);
    float farC = 0.3 * clamp((z - f) / max(f * 3.0, 1.0), 0.0, 1.0);
    return max(nearC, farC) * uMaxR * uAmount;
  }
  void main() {
    float f = texelFetch(tFocus, ivec2(0), 0).r;
    if (!(f > 0.0) || f > 1e6) f = 400.0;
    vec3 c0 = texture2D(tColor, vUv).rgb;
    float r0 = cocOf(lin(vUv), f);
    if (!(r0 >= 0.5) || uAmount <= 0.001) { gl_FragColor = vec4(c0, 1.0); return; }
    vec3 acc = c0;
    float wsum = 1.0;
    const int N = 16;
    for (int i = 0; i < N; i++) {
      float t = (float(i) + 0.5) / float(N);
      float r = sqrt(t) * r0;
      float a = float(i) * 2.39996323;
      vec2 o = vec2(cos(a), sin(a)) * r * uSize.zw;
      vec2 uv = vUv + o;
      float rs = cocOf(lin(uv), f);
      // Probe zählt, wenn sie selbst unscharf genug ist, um hierher zu streuen (oder hinter uns liegt)
      float w = smoothstep(r - 1.0, r + 0.5, max(rs, r0 * 0.8));
      acc += texture2D(tColor, uv).rgb * w;
      wsum += w;
    }
    vec3 o = acc / wsum;
    gl_FragColor = vec4(all(equal(o, o)) ? o : c0, 1.0);
  }
`;

const COPY_FRAG = /* glsl */ `
  uniform sampler2D tSrc;
  varying vec2 vUv;
  void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }
`;

function focusTarget() {
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false,
    magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, generateMipmaps: false,
  });
  rt.texture.name = 'np:fokus';
  return rt;
}

export class AimDepthOfField {
  constructor(fmt) {
    this.fmt = fmt;
    this.target = null;
    this.focus = [focusTarget(), focusTarget()];
    this.fi = 0;
    this.w = 1; this.h = 1;
    this.active = false;
    this.focusMat = new THREE.ShaderMaterial({
      name: 'np:dof-fokus',
      uniforms: { tDepth: { value: null }, tPrev: { value: null }, uInvProj: { value: new THREE.Matrix4() }, uRate: { value: 0.2 }, uReset: { value: 1 } },
      vertexShader: FULLSCREEN_VERT, fragmentShader: FOCUS_FRAG, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    this.mat = new THREE.ShaderMaterial({
      name: 'np:dof',
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, tFocus: { value: null }, uInvProj: { value: new THREE.Matrix4() },
        uSize: { value: new THREE.Vector4(1, 1, 1, 1) }, uMaxR: { value: 6 }, uAmount: { value: 0 },
      },
      vertexShader: FULLSCREEN_VERT, fragmentShader: DOF_FRAG, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    this.copyMat = new THREE.ShaderMaterial({
      name: 'np:dof-kopie', uniforms: { tSrc: { value: null } },
      vertexShader: FULLSCREEN_VERT, fragmentShader: COPY_FRAG, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
  }

  setSize(renderer, w, h) {
    this.w = w; this.h = h;
    if (this.target) this.target.setSize(w, h); // Ziel erst beim ersten Anlegen (render)
  }

  /** amount = Anlegen 0..1; dt für die Fokusnachführung. */
  render(renderer, fs, hdr, camera, amount, dt) {
    if (amount < 0.02 || !hdr.depthTexture) { this.active = false; return false; }
    if (!this.target) { this.target = hdrTarget(renderer, this.w, this.h, { fmt: this.fmt }); this.target.texture.name = 'np:dof'; }
    const fu = this.focusMat.uniforms;
    fu.tDepth.value = hdr.depthTexture;
    fu.tPrev.value = this.focus[this.fi].texture;
    fu.uInvProj.value.copy(camera.projectionMatrixInverse);
    fu.uRate.value = Math.min(1, (dt || 0.016) * 9);
    fu.uReset.value = this.active ? 0 : 1;
    this.fi ^= 1;
    fs.draw(renderer, this.focusMat, this.focus[this.fi]);
    const u = this.mat.uniforms;
    u.tColor.value = hdr.texture;
    u.tDepth.value = hdr.depthTexture;
    u.tFocus.value = this.focus[this.fi].texture;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uSize.value.set(this.w, this.h, 1 / this.w, 1 / this.h);
    u.uMaxR.value = Math.max(2, this.h * 0.009);
    u.uAmount.value = Math.min(1, amount);
    fs.draw(renderer, this.mat, this.target);
    this.copyMat.uniforms.tSrc.value = this.target.texture;
    fs.draw(renderer, this.copyMat, hdr);
    this.active = true;
    return true;
  }

  materials() { return [this.focusMat, this.mat, this.copyMat]; }
  bytes() { return this.target ? this.target.width * this.target.height * (this.target.npBpp || 4) + 16 : 0; }
  dispose() {
    if (this.target) this.target.dispose();
    this.target = null;
    for (const t of this.focus) t.dispose();
    this.focusMat.dispose(); this.mat.dispose(); this.copyMat.dispose();
  }
}
