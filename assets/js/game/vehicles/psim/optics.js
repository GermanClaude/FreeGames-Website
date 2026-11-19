// NULLPUNKT — Panzersimulation: Sichtgeräte.
//   • Moderne Panzer: Wärmebild (G, aus vehicles/thermal.js) mit Polarität weiß-/schwarz-heiß und Restlichtverstärker
//     (N schaltet: aus → Restlicht → aus; bei Wärmebild an: weiß-heiß ↔ schwarz-heiß). Weltkriegspanzer: nur Optik.
//     Umsetzung als Filter auf der Bildfläche (kein zusätzlicher Renderdurchgang – läuft auch auf dem Handy).
//   • Winkelspiegel im Innenraum zeigen ein echtes Außenbild: Render-Target (256×128, ≤ 8 Bilder/s) aus einer Kamera am
//     Spiegelkopf in Blickrichtung des Insassen – nur high/ultra; darunter bleibt das gemalte Prismenbild (cabin.js).
import * as THREE from 'three';

const WH = 'grayscale(1) contrast(1.55) brightness(0.78)';
const BH = 'grayscale(1) invert(1) contrast(1.6) brightness(0.9)';
const NV = 'grayscale(1) sepia(1) hue-rotate(58deg) saturate(3.2) brightness(1.9) contrast(1.25)';
const OPTIC_VIEWS = new Set(['optic', 'wide', 'peri', 'slit', 'binocular']);

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
    this.liveMirrors = q === 'high' || q === 'ultra';
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
    if (c && (f !== this._filter || (f && c.style.filter !== f))) { if (f || this._filter) c.style.filter = f || ''; this._filter = f; }
    if (this.liveMirrors && inside && v) this._mirrors(dt, v);
    else this._restoreMirrors();
    return label;
  }

  _prismMats(v) {
    const cab = v.model && v.model.cabin;
    if (!cab) return null;
    if (this._prisms && this._prisms.cab === cab) return this._prisms.mats;
    const mats = new Set();
    for (const g of [cab.hull, cab.tur, cab.gun]) if (g) g.traverse((o) => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && m.name === 'cab:prisma') mats.add(m); });
    this._prisms = { cab, mats: [...mats] };
    return this._prisms.mats;
  }

  _mirrors(dt, v) {
    const mats = this._prismMats(v);
    if (!mats || !mats.length) return;
    const R = this.G.renderer && this.G.renderer.renderer;
    if (!R) return;
    if (!this.rt) {
      this.rt = new THREE.WebGLRenderTarget(256, 128, { depthBuffer: true });
      this.rt.texture.colorSpace = THREE.SRGBColorSpace;
      this.cam = new THREE.PerspectiveCamera(48, 2, 0.3, 1800);
    }
    for (const m of mats) if (m.emissiveMap !== this.rt.texture) { if (!this._orig.has(m)) this._orig.set(m, { map: m.emissiveMap, i: m.emissiveIntensity }); m.emissiveMap = this.rt.texture; m.emissiveIntensity = 1.25; m.needsUpdate = true; }
    this._t -= dt;
    if (this._t > 0) return;
    this._t = 0.125;
    // Kamera am Spiegelkopf (Dach über dem Insassen), Blick des Insassen waagerecht
    const G = this.G, cam = G.camera;
    const hb = v.def.hullBox;
    const seat = v.seats[this.mode.playerSeat];
    const local = seat && seat.def.drive ? new THREE.Vector3(seat.def.pos[0], hb[1] + hb[4] + 0.15, seat.def.pos[2] - 0.2) : new THREE.Vector3(0, (v.def.turretPivot ? v.def.turretPivot[1] : hb[1] + hb[4]) + 0.95, 0);
    v.body.toWorldRender(local, this.cam.position);
    const d = new THREE.Vector3(); cam.getWorldDirection(d); d.y = Math.max(-0.15, Math.min(0.15, d.y)); d.normalize();
    this.cam.lookAt(this.cam.position.clone().add(d));
    this.cam.updateMatrixWorld();
    const root = v.model.root, vis = root.visible;
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
    if (!this._orig.size) return;
    for (const [m, o] of this._orig) { m.emissiveMap = o.map; m.emissiveIntensity = o.i; m.needsUpdate = true; }
    this._orig.clear();
  }

  dispose() {
    this._restoreMirrors();
    const c = this.canvas;
    if (c && this._filter) c.style.filter = '';
    this._filter = null;
    if (this.rt) { this.rt.dispose(); this.rt = null; }
  }
}
