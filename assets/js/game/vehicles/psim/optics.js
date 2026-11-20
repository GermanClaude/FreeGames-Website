// NULLPUNKT — Panzersimulation: Sichtgeräte.
//   • Moderne Panzer: Wärmebild (G, aus vehicles/thermal.js) mit Polarität weiß-/schwarz-heiß und Restlichtverstärker
//     (N schaltet: aus → Restlicht → aus; bei Wärmebild an: weiß-heiß ↔ schwarz-heiß). Weltkriegspanzer: nur Optik.
//     Umsetzung als Filter auf der Bildfläche (kein zusätzlicher Renderdurchgang – läuft auch auf dem Handy).
//   • Winkelspiegel im Innenraum zeigen ein echtes Außenbild (Nutzer 20.11.): EIN Render-Target für den Spiegel, auf den der
//     Insasse gerade schaut (nächster Spiegel zur Bildmitte, ≤ 1,6 m) – eine Glasfläche mit dem Bild liegt über dessen
//     gemaltem Prisma, die übrigen bleiben gemalt (cabin.js prismTex). Kamera über dem Spiegelkopf in Spiegelrichtung, eigenes
//     Fahrzeug ausgeblendet. ultra 384×160 / 10 Bilder/s, high 256×108 / 8, medium 160×68 / 4, low: aus (gemaltes Prisma).
//   • Durchsehen (Sicht 'prism', periscopes.js): das Hauptbild selbst kommt vom Spiegelkopf; hier nur die Glasgüte als Filter
//     (2. WK gelblich/weich, Kalter Krieg leicht grünstichig, modern klar).
import * as THREE from 'three';

const WH = 'grayscale(1) contrast(1.55) brightness(0.78)';
const BH = 'grayscale(1) invert(1) contrast(1.6) brightness(0.9)';
const NV = 'grayscale(1) sepia(1) hue-rotate(58deg) saturate(3.2) brightness(1.9) contrast(1.25)';
const OPTIC_VIEWS = new Set(['optic', 'wide', 'peri', 'slit', 'binocular', 'prism']);
const GLASS = { modern: 'contrast(1.03) saturate(.96)', kk: 'saturate(.86) contrast(.96) hue-rotate(6deg)', wk2: 'sepia(.22) saturate(.85) contrast(.9) brightness(.96) blur(.35px)', wk1: 'brightness(.88) contrast(.95)' };
const RT_Q = { ultra: [384, 160, 0.1], high: [256, 108, 0.125], medium: [160, 68, 0.25] };
const _w = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _q = new THREE.Quaternion();

export class PanzerOptics {
  constructor(mode) {
    this.mode = mode;
    this.G = mode.G;
    this.polarity = 'weiss';
    this.nv = false;
    this._filter = null;
    this.rt = null;
    this.cam = null;
    this._t = 0;
    this._prisms = null;
    this._orig = new Map();
    const q = (this.G.renderer && this.G.renderer.quality) || 'high';
    this.rtq = RT_Q[q] || null;
    this.liveMirrors = !!this.rtq;
    this.live = null;    // Glasfläche mit dem Außenbild (über dem aktiven Spiegel)
    this.active = null;  // aktiver Spiegel (cabin.js info.prisms)
  }

  get canvas() { const r = this.G.renderer && this.G.renderer.renderer; return r && r.domElement; }

  /** N gedrückt: Polarität bzw. Restlicht umschalten. → Anzeigetext */
  cycle(v, view) {
    if (!v || v.def.noThermal) return 'Nur Optik – kein Wärmebild/Restlicht';
    const th = this.G.vehicles && this.G.vehicles.thermal;
    if (th && th.on) { this.polarity = this.polarity === 'weiss' ? 'schwarz' : 'weiss'; return this.polarity === 'weiss' ? 'Wärmebild weiß-heiß' : 'Wärmebild schwarz-heiß'; }
    if (!view || !OPTIC_VIEWS.has(view.overlay)) return 'Restlicht nur in Optik/Periskop';
    this.nv = !this.nv;
    return this.nv ? 'Restlichtverstärker an' : 'Restlichtverstärker aus';
  }

  /** Je Bild nach dem Fahrzeugtakt: Filter setzen, Spiegelbild rendern. → Anzeigetext der Sichtart oder '' */
  update(dt, v, view, inside) {
    const c = this.canvas;
    const th = this.G.vehicles && this.G.vehicles.thermal;
    const inOptic = !!(view && !view.tp && OPTIC_VIEWS.has(view.overlay));
    if (!inOptic) this.nv = false;
    let f = null, label = '';
    if (th && th.on) { f = this.polarity === 'schwarz' ? BH : WH; label = this.polarity === 'schwarz' ? 'WB · SCHWARZ-HEISS' : 'WB · WEISS-HEISS'; }
    else if (this.nv && inOptic && v && !v.def.noThermal) { f = NV; label = 'RESTLICHT'; }
    const glass = !f && view && !view.tp && view.overlay === 'prism' ? GLASS[view.glass] || null : null;
    if (!f && this.mode.baseFilter) f = this.mode.baseFilter; // Nachtbild der Panzer-Kampagne (ohne Sichtgerät)
    if (glass) f = f ? `${f} ${glass}` : glass;
    if (c && (f !== this._filter || (f && c.style.filter !== f))) { if (f || this._filter) c.style.filter = f || ''; this._filter = f; }
    if (this.liveMirrors && inside && v) this._mirrors(dt, v);
    else this._restoreMirrors();
    return label;
  }

  /** Spiegel im Blick (Glas-Weltlage, ≤ 1,6 m, ≤ 0,6 rad zur Bildmitte). → { rec, parent } | null */
  _pick(cab) {
    const list = cab.info && cab.info.prisms;
    if (!list || !list.length) return null;
    const cam = this.G.camera;
    cam.getWorldDirection(_f);
    let best = null, ba = 0.6;
    for (const rec of list) {
      const parent = rec.obj === 'tur' ? cab.tur : cab.hull;
      if (!parent || !parent.visible) continue;
      parent.localToWorld(_w.fromArray(rec.pos));
      const d = _w.sub(cam.position);
      const len = d.length();
      if (len > 1.6 || len < 0.05) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, d.multiplyScalar(1 / len).dot(_f))));
      if (ang < ba) { ba = ang; best = { rec, parent }; }
    }
    return best;
  }

  _mirrors(dt, v) {
    const cab = v.model && v.model.cabin;
    const R = this.G.renderer && this.G.renderer.renderer;
    if (!cab || !R) return;
    const pick = this._pick(cab);
    if (!pick) { if (this.live) this.live.visible = false; this.active = null; return; }
    if (!this.rt) {
      const [w, h] = this.rtq;
      this.rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
      this.rt.texture.colorSpace = THREE.SRGBColorSpace;
      this.cam = new THREE.PerspectiveCamera(26, w / h, 0.3, 1800);
      const mat = new THREE.MeshBasicMaterial({ map: this.rt.texture, toneMapped: false, depthWrite: true });
      mat.name = 'psim:spiegelbild';
      this.live = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      this.live.name = 'psim:spiegelbild';
      this.live.renderOrder = 2;
    }
    const { rec, parent } = pick;
    if (this.active !== rec || this.live.parent !== parent) {
      this.active = rec;
      parent.add(this.live);
      this.live.position.fromArray(rec.pos);
      this.live.quaternion.fromArray(rec.quat);
      this.live.translateZ(0.0012);
      this.live.scale.set(rec.w * 0.97, rec.h * 0.94, 1);
      this.cam.aspect = rec.w / rec.h; this.cam.updateProjectionMatrix();
      this._t = 0;
    }
    this.live.visible = true;
    this._t -= dt;
    if (this._t > 0) return;
    this._t = this.rtq[2];
    // Kamera über dem Spiegelkopf: Glas (innen) + hoch + nach außen, Blick nach außen (waagrecht, leicht abwärts)
    this.live.updateWorldMatrix(true, false);
    this.live.getWorldPosition(_w);
    this.live.getWorldQuaternion(_q);
    _n.set(0, 0, -1).applyQuaternion(_q); _n.y = 0;
    if (_n.lengthSq() < 1e-6) _n.set(0, 0, -1); _n.normalize();
    v.body.toWorldRender(_u.set(0, 1, 0), _u).sub(v.body.toWorldRender(_f.set(0, 0, 0), _f)).normalize();
    this.cam.position.copy(_w).addScaledVector(_u, rec.up || 0.15).addScaledVector(_n, 0.12);
    this.cam.up.copy(_u);
    this.cam.lookAt(_f.copy(this.cam.position).add(_n).addScaledVector(_u, -0.03));
    this.cam.updateMatrixWorld();
    const G = this.G, root = v.model.root, vis = root.visible;
    const prev = R.getRenderTarget(), sh = R.shadowMap.autoUpdate;
    try {
      root.visible = false;
      R.shadowMap.autoUpdate = false;
      R.setRenderTarget(this.rt);
      R.render(G.scene, this.cam);
    } catch { /* Spiegelbild ausgelassen */ } finally {
      R.setRenderTarget(prev);
      R.shadowMap.autoUpdate = sh;
      root.visible = vis;
    }
  }

  _restoreMirrors() {
    if (this.live) this.live.visible = false;
    this.active = null;
  }

  dispose() {
    this._restoreMirrors();
    const c = this.canvas;
    if (c && this._filter) c.style.filter = '';
    this._filter = null;
    if (this.live) { this.live.removeFromParent(); this.live.geometry.dispose(); this.live.material.dispose(); this.live = null; }
    if (this.rt) { this.rt.dispose(); this.rt = null; }
  }
}
