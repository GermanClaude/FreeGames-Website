// NULLPUNKT — VR: echtes Zielfernrohrbild (plattform, 19.11.; Einstellung vrScope). Am Bildschirm zeigt das HUD ein
// flaches Fernrohr-Overlay – in der Brille gibt es kein Overlay, man sah bisher nur das Rohr ohne Vergrößerung.
// Jetzt: eine Linse am Okular (Scheibe im Ego-Bild, Kind der Waffe) zeigt ein eigenes Bild der Welt aus dem Fernrohr:
//   Bildwinkel = 2·atan(r / (d · Vergrößerung)) mit Linsenradius r und Augenabstand d – das Bild in der Linse ist also
//   genau um die Vergrößerung größer als die Welt daneben (wie echt), weiter weg wird der Kreis kleiner.
//   Austrittspupille: Auge seitlich neben der Achse → schwarzer Halbmond (Schatten), zu weit weg → nur dunkles Glas.
//   Absehen im Shader (Fadenkreuz mit dicken Außenbalken; Kampfvisier: Leuchtpunkt + Winkel).
// Gerendert wird nur, solange das Auge ≤ 30 cm vor dem Okular ist, mit eigener kleiner Zielgröße (Brille 320², PC 512²),
// ohne Schattenaktualisierung – renderer.js ruft dafür vor dem Bild xrPrePass auf.
// Nur für vergrößernde Optiken (scope.overlay 'sniper' | 'acog', Zoom > 1,4). Ein Sampler (16er-Grenze unkritisch).

import * as THREE from 'three';

const NEAR_EYE = 0.3; // m: weiter weg wird nicht gerendert
const STANDALONE_UA = /OculusBrowser|Quest|Pico|Wolvic/i;

/** Bildwinkel (Grad) der Fernrohrkamera: Linsenradius r, Augenabstand d (m), Vergrößerung zoom. */
export function scopeFov(r, d, zoom) {
  const dd = Math.max(0.03, d);
  return THREE.MathUtils.radToDeg(2 * Math.atan(r / (dd * Math.max(1, zoom))));
}

/** Verschiebung des Pupillenschattens (Einheiten des Linsenradius) aus der Augenlage im Linsenraum (x, y quer, z Abstand). */
export function pupilOffset(ex, ey, ez, r, out = { x: 0, y: 0 }) {
  const k = 0.9 * Math.max(0.6, Math.min(3, ez / 0.08));
  out.x = (ex / Math.max(1e-3, r)) * k;
  out.y = (ey / Math.max(1e-3, r)) * k;
  return out;
}

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FRAG = /* glsl */`
uniform sampler2D map;
uniform vec2 uOff;
uniform float uOn;
uniform float uKind; // 0 Fernrohr, 1 Kampfvisier
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  vec3 glass = vec3(0.012, 0.016, 0.02) + vec3(0.05, 0.06, 0.07) * smoothstep(0.9, 0.2, length(p - vec2(-0.35, 0.4)));
  vec3 col = glass;
  if (uOn > 0.5) {
    float e = length(p + uOff);
    float vis = smoothstep(1.02, 0.72, e) * smoothstep(1.0, 0.93, r);
    col = mix(glass, texture2D(map, vUv).rgb, vis);
    float px = fwidth(p.x) * 1.2;
    if (uKind < 0.5) {
      // Fadenkreuz: dünn in der Mitte, dicke Balken außen
      float thin = 0.006 + px, thick = 0.035;
      float lx = abs(p.y) < mix(thin, thick, step(0.62, abs(p.x))) && abs(p.x) > 0.0 ? 1.0 : 0.0;
      float ly = abs(p.x) < mix(thin, thick, step(0.62, abs(p.y))) && p.y < 0.0 ? 1.0 : 0.0;
      float ly2 = abs(p.x) < thin && p.y >= 0.0 ? 1.0 : 0.0;
      col = mix(col, vec3(0.01), clamp(lx + ly + ly2, 0.0, 1.0) * vis);
    } else {
      // Kampfvisier: Winkel + Leuchtpunkt
      float w = 0.012 + px;
      float chev = (abs(abs(p.x) - (-p.y) * 0.9) < w && p.y < 0.0 && p.y > -0.14) ? 1.0 : 0.0;
      float post = (abs(p.x) < w && p.y < -0.14 && p.y > -0.7) ? 1.0 : 0.0;
      col = mix(col, vec3(0.01), clamp(chev + post, 0.0, 1.0) * vis);
      float dot = smoothstep(0.03 + px, 0.0, length(p));
      col += vec3(2.4, 0.25, 0.05) * dot * vis;
    }
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class VrScope {
  constructor(xr) {
    this.xr = xr;
    this.G = xr.G;
    this.active = false;
    this.renders = 0;
    this.fov = 0;
    this._rt = null;
    this._cam = new THREE.PerspectiveCamera(5, 1, 0.15, 1200);
    this._lens = null;
    this._lensKey = '';
    this._lensR = 0.016;
    this._zoom = 1;
    this._noop = () => {};
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._q = new THREE.Quaternion();
  }

  get enabled() { return this.G.settings.get('vrScope') !== false; }

  _size() { return typeof navigator !== 'undefined' && STANDALONE_UA.test(navigator.userAgent || '') ? 320 : 512; }

  _ensureRt() {
    if (this._rt) return this._rt;
    const s = this._size();
    this._rt = new THREE.WebGLRenderTarget(s, s, { type: THREE.HalfFloatType, depthBuffer: true, samples: 0 });
    this._rt.texture.name = 'xr-fernrohr';
    return this._rt;
  }

  _ensureLens() {
    if (this._lens) return this._lens;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, uOff: { value: new THREE.Vector2() }, uOn: { value: 0 }, uKind: { value: 0 } },
      vertexShader: VERT, fragmentShader: FRAG, toneMapped: true, fog: false, depthWrite: true,
    });
    this._lens = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat);
    this._lens.name = 'xr-fernrohr-linse';
    this._lens.renderOrder = 2;
    this._lens.frustumCulled = false;
    this._lens.visible = false;
    return this._lens;
  }

  /** Optik der aktuellen Waffe: { zoom, kind, gun, pos (Waffenraum), r } oder null. */
  _optic(vm) {
    const def = vm && vm.def;
    const sc = def && def.scope;
    const ov = sc ? sc.overlay : vm && vm._scopeOverlay;
    const zoom = (sc && sc.zoom) || (def && def.adsZoom) || 1;
    if (!vm || !vm.cur || !vm.gun || (ov !== 'sniper' && ov !== 'acog') || zoom <= 1.4) return null;
    const e = vm.cur;
    if (e.xrLens) return e.xrLens;
    const ads = e.ud && e.ud.adsOffset;
    const ex = ads ? -ads.x : 0, ey = ads ? -ads.y : 0.05, ez = ads ? -ads.z : 0.15;
    // Okular: Hinterkante des Optikkörpers (Teil 'optic') auf der Visierlinie, sonst ≈ 8 cm vor dem Auge
    let z = ez - (ov === 'sniper' ? 0.085 : 0.07);
    let r = ov === 'sniper' ? 0.017 : 0.013;
    const optic = e.ud && e.ud.parts ? e.ud.parts.optic : null;
    if (optic) {
      const box = new THREE.Box3();
      const inv = new THREE.Matrix4();
      vm.gun.updateWorldMatrix(true, true);
      inv.copy(vm.gun.matrixWorld).invert();
      const m = new THREE.Matrix4();
      const b = new THREE.Box3();
      optic.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        m.multiplyMatrices(inv, o.matrixWorld);
        b.copy(o.geometry.boundingBox).applyMatrix4(m);
        box.union(b);
      });
      if (!box.isEmpty()) {
        const sz = box.getSize(this._tmp);
        if (sz.z > 0.04 && box.max.z < ez) z = box.max.z - 0.002;
        r = THREE.MathUtils.clamp(Math.min(sz.x, sz.y) * 0.32, 0.009, 0.022); // Okular ist enger als die Box (Türme, Objektiv)
      }
    }
    e.xrLens = { zoom, kind: ov === 'acog' ? 1 : 0, pos: new THREE.Vector3(ex, ey, z), r };
    return e.xrLens;
  }

  /** Je Bild nach der Simulation (endFrame): Linse setzen, Kamera und Bildwinkel bestimmen. */
  frame() {
    const xr = this.xr;
    const vm = this.G.viewmodel && this.G.viewmodel.rig;
    const p = this.G.player;
    const ok = this.enabled && xr.presenting && xr.ready && xr.armed && vm && vm._vrOn && p && p.alive && !p.vehicle;
    const o = ok ? this._optic(vm) : null;
    if (!o) { this._hide(); return; }
    const lens = this._ensureLens();
    if (lens.parent !== vm.gun) vm.gun.add(lens);
    lens.position.copy(o.pos);
    lens.scale.setScalar(o.r);
    lens.quaternion.identity();
    lens.visible = vm.root.visible !== false;
    lens.updateMatrixWorld(true);
    const U = lens.material.uniforms;
    U.uKind.value = o.kind;
    // Auge im Linsenraum (z = Abstand nach hinten, Richtung Auge)
    const eye = this._tmp.copy(xr.eye);
    lens.worldToLocal(eye); // Einheiten: Linsenradius (Skalierung)
    const ez = eye.z * o.r, exr = eye.x * o.r, eyr = eye.y * o.r;
    const near = ez > 0.005 && ez < NEAR_EYE && Math.hypot(exr, eyr) < 0.06;
    this.active = near;
    U.uOn.value = near ? 1 : 0;
    if (!near) return;
    const off = pupilOffset(exr, eyr, ez, o.r, this._off || (this._off = { x: 0, y: 0 }));
    U.uOff.value.set(off.x, off.y);
    const rt = this._ensureRt();
    U.map.value = rt.texture;
    // Fernrohrkamera am Okular, Blick entlang des Laufs
    lens.getWorldPosition(this._tmp2);
    vm.gun.getWorldQuaternion(this._q);
    const cam = this._cam;
    cam.position.copy(this._tmp2);
    cam.quaternion.copy(this._q);
    this.fov = scopeFov(o.r, ez, o.zoom);
    cam.fov = this.fov;
    cam.aspect = 1;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  }

  _hide() {
    this.active = false;
    if (this._lens) this._lens.visible = false;
  }

  /** renderer.js (_renderXr, vor dem Bild): Weltbild ins Fernrohr – XR aus, Schatten unverändert, eigene Zielgröße. */
  prePass(renderer, scene) {
    if (!this.active || !this._rt || !scene) return;
    const xrm = renderer.xr;
    const prevT = renderer.getRenderTarget();
    const wasXr = xrm.enabled;
    const sm = renderer.shadowMap;
    const au = sm.autoUpdate, nu = sm.needsUpdate;
    const obr = scene.onBeforeRender;
    const grp = this.xr.group, gv = grp.visible;
    try {
      xrm.enabled = false;
      sm.autoUpdate = false; sm.needsUpdate = false;
      scene.onBeforeRender = this._noop;
      grp.visible = false; // Rig, Vignette, Handgelenk, Bogen nicht im Fernrohr
      renderer.setRenderTarget(this._rt);
      renderer.clear(true, true, false);
      renderer.render(scene, this._cam);
      this.renders++;
    } finally {
      grp.visible = gv;
      scene.onBeforeRender = obr;
      sm.autoUpdate = au; sm.needsUpdate = nu;
      renderer.setRenderTarget(prevT);
      xrm.enabled = wasXr;
    }
  }

  reset() { this._hide(); }

  dispose() {
    this._hide();
    if (this._lens) { this._lens.removeFromParent(); this._lens.geometry.dispose(); this._lens.material.dispose(); this._lens = null; }
    if (this._rt) { this._rt.dispose(); this._rt = null; }
  }
}
