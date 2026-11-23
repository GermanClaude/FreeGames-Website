// NULLPUNKT — Temporale Kantenglättung (TAA) für die Welt (gfx-licht, Einstellung gfxAA 'taa'; Standard auf ultra).
//
// Ablauf je Bild (engine/post/pipeline.js):
//   jitter(camera) → Welt rendert mit Subpixel-Versatz (Halton 2/3, 8 Positionen) → [AO, Reflexionen, Kontaktschatten]
//   → resolve(): aktuelles Bild + Verlauf (umprojiziert über Tiefe und die Kameramatrizen des Vorbilds) → neuer Verlauf
//   → zurück ins HDR-Ziel → Viewmodel wird danach OHNE Versatz darübergezeichnet (bewegt sich mit der Kamera, hätte
//   keine gültige Umprojektion – SMAA glättet seine Kanten weiterhin im Bildraum).
// Gegen Nachziehen: Nachbarschafts-Varianzbegrenzung (3×3, YCoCg, in wahrnehmungsnahem Raum nach Belichtung),
// Catmull-Rom-Abtastung des Verlaufs (bleibt scharf), stärkere Gewichtung des aktuellen Bilds bei Bewegung.
// Verlauf wird bei Größenwechsel (dynamische Auflösung), Teleport und Neuaufbau verworfen.
// Feine Geometrie (Zäune, Gras, Leitungen, Kanten) steht damit ruhig; der Zufallsdrehwinkel der weichen
// Sonnenschatten (world/shading.js, GFX.npGfx.y) wechselt je Bild und wird hier zu glatten Halbschatten gemittelt.

import * as THREE from 'three';
import { FULLSCREEN_VERT, GLSL_COMMON, hdrTarget } from './common.js?v=20261123073102';

const RESOLVE_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  uniform sampler2D tCur;
  uniform sampler2D tHist;
  uniform highp sampler2D tDepth;
  uniform sampler2D tExposure;
  uniform mat4 uInvVP;      // aktuelles Bild (mit Versatz): NDC → Welt
  uniform mat4 uPrevVP;     // Vorbild (ohne Versatz): Welt → Clip
  uniform vec4 uSize;       // w, h, 1/w, 1/h
  uniform float uValid;
  uniform float uExp;       // Kartenbelichtung
  uniform float uAuto;      // automatische Belichtung aktiv (tExposure.r)
  uniform float uAlpha;     // Grundgewicht des aktuellen Bilds
  varying vec2 vUv;
  vec3 toYCoCg(vec3 c) { return vec3(dot(c, vec3(0.25, 0.5, 0.25)), dot(c, vec3(0.5, 0.0, -0.5)), dot(c, vec3(-0.25, 0.5, -0.25))); }
  vec3 fromYCoCg(vec3 y) { return vec3(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z); }
  float gE;
  bool npOk(vec3 c) { return all(equal(c, c)) && all(lessThan(abs(c), vec3(1e30))); }
  vec3 tm(vec3 c) { c *= gE; return c / (1.0 + npMax3(c)); }
  vec3 itm(vec3 c) { return c / max(1.0 - npMax3(c), 1e-3) / gE; }
  vec3 histCR(vec2 uv) {
    vec2 sp = uv * uSize.xy;
    vec2 tp = floor(sp - 0.5) + 0.5;
    vec2 f = sp - tp;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 t0 = (tp - 1.0) * uSize.zw, t3 = (tp + 2.0) * uSize.zw, t12 = (tp + w2 / w12) * uSize.zw;
    vec3 r = texture2D(tHist, vec2(t12.x, t0.y)).rgb * (w12.x * w0.y)
      + texture2D(tHist, vec2(t0.x, t12.y)).rgb * (w0.x * w12.y)
      + texture2D(tHist, t12).rgb * (w12.x * w12.y)
      + texture2D(tHist, vec2(t3.x, t12.y)).rgb * (w3.x * w12.y)
      + texture2D(tHist, vec2(t12.x, t3.y)).rgb * (w12.x * w3.y);
    float ws = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
    vec3 h = max(r / max(ws, 1e-4), 0.0);
    return npOk(h) ? h : texture2D(tHist, uv).rgb;
  }
  void main() {
    gE = uExp * (uAuto > 0.5 ? texelFetch(tExposure, ivec2(0), 0).r : 1.0);
    if (!(gE > 1e-6) || gE > 1e6) gE = 1.0; // Schutz: Belichtung 0/NaN → sonst NaN im ganzen Bild
    vec3 cur = tm(texture2D(tCur, vUv).rgb);
    vec3 cY = toYCoCg(cur);
    vec3 m1 = cY, m2 = cY * cY;
    float dMin = texture2D(tDepth, vUv).x;
    vec2 dOff = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      if (i == 0 && j == 0) continue;
      vec2 o = vec2(float(i), float(j)) * uSize.zw;
      vec3 y = toYCoCg(tm(texture2D(tCur, vUv + o).rgb));
      m1 += y; m2 += y * y;
      // Tiefe nur an den Ecken (Kreuz-Dilatation, 5 statt 9 Abfragen – SwiftShader: TAA ≈ ⅓ billiger)
      if (i != 0 && j != 0) {
        float d = texture2D(tDepth, vUv + o).x;
        if (d < dMin) { dMin = d; dOff = o; }
      }
    }
    // Umprojektion mit der nächstliegenden Tiefe der Nachbarschaft (Kanten nehmen die Bewegung des Vordergrunds)
    vec2 uvD = vUv + dOff;
    vec4 wp = uInvVP * vec4(uvD * 2.0 - 1.0, dMin * 2.0 - 1.0, 1.0);
    wp /= wp.w;
    vec4 pc = uPrevVP * vec4(wp.xyz, 1.0);
    vec2 puv = vUv + ((pc.xy / pc.w) * 0.5 + 0.5 - uvD);
    if (uValid < 0.5 || pc.w <= 0.0 || any(lessThan(puv, vec2(0.0))) || any(greaterThan(puv, vec2(1.0)))) {
      gl_FragColor = vec4(itm(cur), 1.0);
      return;
    }
    vec3 hY = toYCoCg(tm(histCR(puv)));
    vec3 mean = m1 / 9.0;
    vec3 sig = sqrt(max(m2 / 9.0 - mean * mean, 0.0));
    vec3 ext = sig * 1.15 + vec3(0.002, 0.001, 0.001);
    // Varianzbegrenzung: Verlauf entlang der Linie zum Mittelwert in die Box ziehen (nicht kanalweise klemmen)
    vec3 dv = hY - mean;
    vec3 u = abs(dv) / max(ext, vec3(1e-5));
    float mu = max(u.x, max(u.y, u.z));
    if (mu > 1.0) hY = mean + dv / mu;
    float speed = length((puv - vUv) * uSize.xy);
    float a = clamp(uAlpha + speed * 0.025, uAlpha, 0.35);
    // Leuchtdichte-Gewichtung gegen Flackern einzelner heller Pixel
    float wc = a / (1.0 + cY.x), wh = (1.0 - a) / (1.0 + hY.x);
    vec3 res = (cY * wc + hY * wh) / (wc + wh);
    vec3 outC = itm(max(fromYCoCg(res), 0.0));
    if (!npOk(outC)) outC = npOk(texture2D(tCur, vUv).rgb) ? texture2D(tCur, vUv).rgb : vec3(0.0);
    gl_FragColor = vec4(outC, 1.0);
  }
`;

const COPY_FRAG = /* glsl */ `
  uniform sampler2D tSrc;
  varying vec2 vUv;
  void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }
`;

function halton(i, b) {
  let f = 1, r = 0;
  while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
  return r;
}
const JITTER = Array.from({ length: 8 }, (_, i) => [halton(i + 1, 2) - 0.5, halton(i + 1, 3) - 0.5]);

export class TemporalAA {
  constructor(fmt) {
    this.fmt = fmt;
    this.targets = [null, null];
    this.cur = 0;
    this.valid = false;
    this.w = 1; this.h = 1;
    this.index = 0;
    this.jitterOn = false;
    this.prevVP = new THREE.Matrix4();
    this.invVP = new THREE.Matrix4();
    this.curVP = new THREE.Matrix4();
    this.resolveMat = new THREE.ShaderMaterial({
      name: 'np:taa',
      uniforms: {
        tCur: { value: null }, tHist: { value: null }, tDepth: { value: null }, tExposure: { value: null },
        uInvVP: { value: this.invVP }, uPrevVP: { value: this.prevVP }, uSize: { value: new THREE.Vector4(1, 1, 1, 1) },
        uValid: { value: 0 }, uExp: { value: 1 }, uAuto: { value: 0 }, uAlpha: { value: 0.1 },
      },
      vertexShader: FULLSCREEN_VERT, fragmentShader: RESOLVE_FRAG, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    this.copyMat = new THREE.ShaderMaterial({
      name: 'np:taa-copy', uniforms: { tSrc: { value: null } },
      vertexShader: FULLSCREEN_VERT, fragmentShader: COPY_FRAG, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
  }

  setSize(renderer, w, h) {
    if (w === this.w && h === this.h && this.targets[0]) return;
    this.w = w; this.h = h;
    for (let i = 0; i < 2; i++) {
      if (!this.targets[i]) { this.targets[i] = hdrTarget(renderer, w, h, { fmt: this.fmt }); this.targets[i].texture.name = 'np:taa'; }
      else this.targets[i].setSize(w, h);
    }
    this.valid = false;
  }

  reset() { this.valid = false; }

  /** Subpixel-Versatz auf die Projektion der Kamera (nach widen/updateProjectionMatrix). Rückgängig: unjitter(). */
  jitter(camera) {
    camera.updateMatrixWorld();
    // Ohne Versatz für das nächste Bild merken
    this.curVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const [jx, jy] = JITTER[this.index++ & 7];
    const e = camera.projectionMatrix.elements;
    e[8] += (2 * jx) / this.w;
    e[9] += (2 * jy) / this.h;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    this.invVP.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
    this.jitterOn = true;
    return (this.index & 7) / 8; // Phase 0..1 (Drehung der Schattenproben)
  }

  unjitter(camera) {
    if (!this.jitterOn) return;
    this.jitterOn = false;
    camera.updateProjectionMatrix();
  }

  /** Verlauf auflösen und Ergebnis zurück ins HDR-Ziel (hdr.texture) schreiben. */
  resolve(renderer, fs, hdr, depthTexture, g) {
    const u = this.resolveMat.uniforms;
    const out = this.targets[this.cur], hist = this.targets[this.cur ^ 1];
    u.tCur.value = hdr.texture;
    u.tHist.value = hist.texture;
    u.tDepth.value = depthTexture;
    u.uSize.value.set(this.w, this.h, 1 / this.w, 1 / this.h);
    u.uValid.value = this.valid ? 1 : 0;
    u.uExp.value = g && Number.isFinite(g.exposure) ? g.exposure : 1;
    u.uAuto.value = g && g.auto && g.exposureTex ? 1 : 0;
    u.tExposure.value = g && g.auto ? g.exposureTex : null;
    fs.draw(renderer, this.resolveMat, out);
    this.copyMat.uniforms.tSrc.value = out.texture;
    fs.draw(renderer, this.copyMat, hdr);
    this.prevVP.copy(this.curVP);
    this.cur ^= 1;
    this.valid = true;
  }

  materials() { return [this.resolveMat, this.copyMat]; }

  bytes() { return this.targets.reduce((s, t) => s + (t ? t.width * t.height * (t.npBpp || 4) : 0), 0); }

  dispose() {
    for (const t of this.targets) if (t) t.dispose();
    this.targets = [null, null];
    this.resolveMat.dispose();
    this.copyMat.dispose();
  }
}
