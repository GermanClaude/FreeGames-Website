// NULLPUNKT — Panzersimulation „selbst machen“: Bedienelemente im Innenraum (Hotspots), Handgriffe je Rolle, Kopf neigen.
//
// Blick in der Innensicht auf ein Bedienelement → Ring + Beschriftung; LMT/F = bedienen (Hebel vor/ein), RMT = zurück/aus.
//   Fahrer:        Hauptschalter (Batterie, Innenlicht), Anlasser (Motor startet nach ~2 s Orgeln), Feststellbremse,
//                  Wahlhebel (modern R/N/D, Weltkrieg Gänge – auch Mausrad), Lenkhebel (Anzeige), Innenlicht
//   Richtschütze:  Hauptschalter Waffe (scharf), Turmantrieb (aus = Notbetrieb über Handräder: 6°/s), Rechner-Munitionswahl,
//                  Laser-Entfernungsmesser, Handräder (Hinweis)
//   Ladeschütze:   Munitionsgestell/-bunker (greifen), Verschluss (einschieben/schließen), Sicherung (entsichern)
//   Kommandant:    Luke auf/zu, Funkgerät (Lagemeldung)
// Bedienteile: wo der Detail-Innenraum (cabin.js) einen echten Schalter hat ('sw:<id>', Kippschalter unter Bügel mit
// Leuchtmelder), ist er das Ziel des Hotspots; sonst setzt die Simulation ab medium eigene Schalterkästen, auf low gibt es
// nur die Markierung (vereinfachte Interaktion). Kopf neigen: Q/E seitlich, Z vorbeugen (halten).
import * as THREE from 'three';
import { driverCabin } from '../data.js?v=20261115041504';
import { spaceLocal, viewOf } from '../views.js?v=20261115041504';
import { kindOf, KINDS } from './ammo.js?v=20261115041504';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

let PMAT = null;
function panelMats() {
  if (PMAT) return PMAT;
  PMAT = {
    box: new THREE.MeshStandardMaterial({ name: 'psim:schaltkasten', color: 0x2b2e28, roughness: 0.7, metalness: 0.4 }),
    lever: new THREE.MeshStandardMaterial({ name: 'psim:hebel', color: 0x8a8d86, roughness: 0.35, metalness: 0.8 }),
    knob: new THREE.MeshStandardMaterial({ name: 'psim:knauf', color: 0xb02a1c, roughness: 0.5 }),
    on: new THREE.MeshStandardMaterial({ name: 'psim:lampe-an', color: 0x40ff60, emissive: 0x30ff50, emissiveIntensity: 2.2 }),
    off: new THREE.MeshStandardMaterial({ name: 'psim:lampe-aus', color: 0x401010, emissive: 0x200000, emissiveIntensity: 0.5 }),
    warn: new THREE.MeshStandardMaterial({ name: 'psim:lampe-warn', color: 0xffa020, emissive: 0xff8010, emissiveIntensity: 2.4 }),
  };
  return PMAT;
}

/** Schalterkasten mit Kipphebel und Leuchte. → { group, set(on, warn) } */
function switchBox(w = 0.11, h = 0.08) {
  const M = panelMats();
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.035), M.box); g.add(box);
  const piv = new THREE.Group(); piv.position.set(0, 0, 0.02); g.add(piv);
  const lv = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.05, 6), M.lever); lv.position.y = 0.025; piv.add(lv);
  const kn = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), M.knob); kn.position.y = 0.05; piv.add(kn);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), M.off); lamp.position.set(w * 0.32, h * 0.25, 0.02); g.add(lamp);
  return { group: g, set(on, warn = false) { piv.rotation.x = on ? -0.6 : 0.6; lamp.material = warn ? M.warn : on ? M.on : M.off; } };
}

export class SimControls {
  constructor(mode) {
    this.mode = mode;
    this.G = mode.G;
    this.hot = null;          // Hotspot im Blick
    this.list = [];
    this._built = null;
    this.lean = new THREE.Vector3();
    this._p = { x: 0, y: 0, on: false };
    this.quality = (this.G.renderer && this.G.renderer.quality) || 'high';
  }

  /** Hotspot-Liste für die Rolle des Spielers am Panzer v. */
  build(v, role) {
    const D = v.def, st = this.mode.state;
    const L = [];
    const seat = v.seats[this.mode.playerSeat];
    if (!seat) return (this.list = L);
    const add = (o) => L.push({ r: 0.07, space: 'hull', ...o });
    const I = D.interior || {}, sc = I.scale || 1, sh = I.shift || [0, 0, 0];
    const ip = (p) => [p[0] * sc + sh[0], p[1] * sc + sh[1], p[2] * sc + sh[2]];
    const view = (seat.def.views || []).find((x) => x.interior) || viewOf(seat);
    const eye = view.station || view.pos || [0, 0.6, 0];
    if (role === 'fahrer') {
      const R = driverCabin(D);
      if (R) {
        const E = R.eye, F = R.F;
        add({ id: 'batterie', label: () => `Hauptschalter – ${st.battery ? 'EIN' : 'AUS'}`, pos: [R.xr - 0.05, E[1] - 0.28, E[2] - 0.3], panel: 'r', use: (d) => this.mode.simAction('batterie', d), on: () => st.battery });
        add({ id: 'anlasser', label: () => (st.engine === 'an' ? 'Anlasser – Motor läuft (RMT: Motor aus)' : st.engine === 'start' ? 'Anlasser – orgelt …' : 'Anlasser – drücken'), pos: [R.xr - 0.05, E[1] - 0.28, E[2] - 0.16], panel: 'r', use: (d) => this.mode.simAction('anlasser', d), on: () => st.engine === 'an', warn: () => st.engine === 'start' });
        add({ id: 'licht', label: () => `Innenlicht – ${{ kampf: 'Gefechtslicht', arbeit: 'Arbeitslicht', aus: 'aus' }[st.lights]}`, pos: [R.xr - 0.05, E[1] - 0.12, E[2] - 0.23], panel: 'r', use: (d) => this.mode.simAction('licht', d), on: () => st.lights !== 'aus' });
        add({ id: 'bremse', label: () => `Feststellbremse – ${st.parkBrake ? 'angezogen' : 'gelöst'}`, pos: [R.xl + 0.07, R.floor + 0.32, F[2] - 0.12], panel: 'l', use: (d) => this.mode.simAction('bremse', d), on: () => !st.parkBrake, warn: () => st.parkBrake });
        add({ id: 'gang', label: () => `Wahlhebel – ${this.mode.gearText()}  (LMT vor · RMT zurück · Mausrad)`, part: 'gang', pos: [F[0] + 0.22, F[1] + 0.45, F[2] - 0.1], r: 0.08, use: (d) => this.mode.simAction('gang', d) });
        add({ id: 'hebel', label: () => 'Lenkhebel (A/D ziehen)', part: 'hebel:l', pos: [F[0] - 0.2, F[1] + 0.55, F[2] - 0.2], r: 0.06, use: () => this.mode.hint('Lenken: A/D – der Hebel bremst die Kette dieser Seite') });
      }
    } else if (role === 'richtschuetze') {
      add({ id: 'waffe', space: 'turret', label: () => `Hauptschalter Waffe – ${st.armed ? 'SCHARF' : 'gesichert'}`, pos: [eye[0] + 0.24, eye[1] - 0.14, eye[2] - 0.32], panel: 'f', use: (d) => this.mode.simAction('waffe', d), on: () => st.armed, warn: () => (this.mode._warnLamp || 0) > this.G.time.elapsed });
      add({ id: 'antrieb', space: 'turret', label: () => `Turmantrieb – ${st.hydraulics ? 'elektrisch' : 'Notbetrieb (Handräder)'}`, pos: [eye[0] + 0.24, eye[1] - 0.26, eye[2] - 0.28], panel: 'f', use: (d) => this.mode.simAction('antrieb', d), on: () => st.hydraulics });
      add({ id: 'rechner', space: 'turret', label: () => `Feuerleitrechner – Munition: ${this.mode.selectedAmmoLabel()} (LMT/RMT wählen)`, part: 'btn:mbt_ap', pos: [eye[0] + 0.1, eye[1] - 0.06, eye[2] - 0.42], r: 0.08, use: (d) => this.mode.simAction('rechner', d) });
      if ((D.era || 'modern') === 'modern') add({ id: 'laser', space: 'turret', label: () => 'Laser-Entfernungsmesser – auslösen', pos: [eye[0] + 0.12, eye[1] - 0.16, eye[2] - 0.4], panel: 'f', use: () => this.mode.simAction('laser', 1), on: () => true });
      add({ id: 'rad', space: 'turret', label: () => 'Handräder Höhe/Seite (Notbetrieb: Maus dreht langsam)', part: 'rad:seite', pos: [eye[0] - 0.1, eye[1] - 0.35, eye[2] - 0.25], r: 0.07, use: () => this.mode.hint(st.hydraulics ? 'Handräder: nur im Notbetrieb – Turmantrieb ausschalten' : 'Notbetrieb: Maus dreht Turm/Rohr über die Handräder (langsam)') });
    } else if (role === 'ladeschuetze') {
      const rack = ip(I.rack || [0, 0.45, 1.55]), br = ip(I.breech || [0, 0.42, -0.55]);
      add({ id: 'wahl', space: 'turret', label: () => `Munitionswahl – ${this.mode.loaderSel()} (LMT/RMT wechseln)`, pos: [rack[0] + 0.35, rack[1] + 0.25, rack[2] - 0.35], panel: 'f', use: (d) => this.mode.simAction('wahl', d), on: () => true });
      add({ id: 'gestell', space: 'turret', label: () => this.mode.loaderLabel('gestell'), pos: rack, r: 0.2, use: () => this.mode.simAction('gestell', 1) });
      add({ id: 'verschluss', space: 'turret', label: () => this.mode.loaderLabel('verschluss'), pos: br, r: 0.16, use: () => this.mode.simAction('verschluss', 1) });
      add({ id: 'sicherung', space: 'turret', label: () => `Sicherung – ${st.safe ? 'GESICHERT (LMT entsichern)' : 'entsichert'}`, part: 'lampe:sicher', pos: [br[0] + 0.3, br[1] + 0.12, br[2] + 0.3], panel: 'f', use: (d) => this.mode.simAction('sicherung', d), on: () => !st.safe, warn: () => st.safe && v.gun && v.gun.step === 'geladen' });
    } else if (role === 'kommandant') {
      const H = D.hatches && D.hatches.commander;
      if (H) add({ id: 'luke', space: H.space || 'turret', label: () => `Luke – ${seat.hatchOpen ? 'offen (LMT schließen)' : 'zu (LMT öffnen)'}`, pos: [H.pos[0], H.pos[1] - 0.15, H.pos[2]], r: 0.2, use: () => this.mode.simAction('luke', 1) });
      add({ id: 'funk', space: 'turret', label: () => 'Funkgerät – Lagemeldung an die Kompanie', pos: [eye[0] - 0.3, eye[1] - 0.1, eye[2] + 0.2], panel: 'f', use: () => this.mode.simAction('funk', 1), on: () => true });
    }
    for (const h of L) h.local = h.pos.slice();
    this.list = L;
    this._built = null;
    return L;
  }

  /** Eigene Bedienteile in den Innenraum setzen (einmal, sobald der Innenraum existiert; nicht auf low). */
  _decorate(v) {
    if (this._built === v) return;
    const M = v.model;
    if (!M || !M.interior) return;
    // Detail-Innenraum (cabin.js) entsteht beim ersten Öffnen – kurz darauf warten, dann seine echten Schalter nutzen
    const cab = M.cabin;
    if (!cab && (this._cabWait = (this._cabWait || 0) + 1) < 30) return;
    this._built = v;
    const eyeW = this.G.camera ? this.G.camera.position.clone() : null;
    for (const h of this.list) {
      if (!h.panel) continue;
      // Ankerpunkt: Bedienteil des Innenraums ('sw:<id>': Kippschalter unter Bügel mit Leuchtmelder) statt Schalterkasten
      const own = cab && cab.sw && cab.sw[h.id];
      if (own) { h.part = 'sw:' + h.id; h.mesh = own; continue; }
      if (this.quality === 'low') continue;
      const sw = switchBox();
      const parent = h.space === 'turret' ? M.turret || M.root : M.root;
      if (!parent) continue;
      parent.updateWorldMatrix(true, false);
      const wp = this.world(v, h, _a); // noch ohne Netz: aus der Raumlage
      parent.add(sw.group);
      sw.group.position.copy(parent.worldToLocal(wp.clone()));
      // Ausrichtung: Front zum Auge des Insassen
      if (eyeW) { sw.group.updateWorldMatrix(true, false); sw.group.lookAt(eyeW); }
      sw.group.name = 'psim:' + h.id;
      h.mesh = sw;
    }
  }

  /** Weltlage eines Hotspots. */
  world(v, h, out) {
    const M = v.model, cab = M && M.cabin;
    const part = h.part && cab && cab.parts ? cab.parts[h.part] || (cab.btn && cab.btn[h.part.replace('btn:', '')]) : null;
    if (part) { part.updateWorldMatrix(true, false); return part.getWorldPosition(out); }
    if (h.mesh) { h.mesh.group.updateWorldMatrix(true, false); return h.mesh.group.getWorldPosition(out); }
    if (h.space === 'turret') { spaceLocal(v, 'turret', h.pos, out, null); return v.body.toWorldRender(out, out); }
    return v.body.toWorldRender(out.fromArray(h.pos), out);
  }

  /** Nach dem Kamerasetzen: Hotspot im Blick bestimmen, Bedienteile aktualisieren, Kopf neigen. → Anzeige-Zustand */
  frame(dt, v, inside) {
    const G = this.G, cam = G.camera;
    this.hot = null;
    if (!v || !cam) return null;
    if (inside) this._decorate(v);
    for (const h of this.list) if (h.mesh) { h.mesh.group.visible = inside; if (inside) h.mesh.set(h.on ? h.on() : true, h.warn ? h.warn() : false); }
    if (!inside) { this.lean.set(0, 0, 0); return null; }
    // Kopf neigen (Q/E seitlich, Z vorbeugen) – Kamera im Innenraum versetzen
    const I = G.input;
    const want = _a.set((I && I.down('lean_right') ? 1 : 0) - (I && I.down('lean_left') ? 1 : 0), 0, I && I.down('prone') ? 1 : 0);
    const k = 1 - Math.exp(-dt * 8);
    this.lean.x += (want.x * 0.13 - this.lean.x) * k;
    this.lean.z += (want.z * 0.16 - this.lean.z) * k;
    if (Math.abs(this.lean.x) + Math.abs(this.lean.z) > 1e-3) {
      cam.getWorldDirection(_f);
      _r.crossVectors(_f, _u.set(0, 1, 0)).normalize();
      cam.position.addScaledVector(_r, this.lean.x).addScaledVector(_f, this.lean.z);
      cam.position.y -= this.lean.z * 0.25;
      cam.updateMatrixWorld();
    }
    // Hotspot im Blick (Bildmitte)
    cam.getWorldDirection(_f);
    let best = null, ba = 1e9;
    for (const h of this.list) {
      const p = this.world(v, h, _b);
      const to = p.sub(cam.position);
      const d = to.length();
      if (d > 1.9 || d < 0.05) continue;
      const ang = Math.acos(clamp(to.normalize().dot(_f), -1, 1));
      const lim = Math.atan2(h.r, d) + 0.05;
      if (ang < lim && ang < ba) { ba = ang; best = h; }
    }
    this.hot = best;
    return best;
  }

  /** Bildschirmlage des aktiven Hotspots (HUD). */
  screen(v, project) {
    if (!this.hot) return null;
    return project(this.world(v, this.hot, _a), this._p);
  }

  dispose() {
    for (const h of this.list) if (h.mesh && !h.mesh.cabin) h.mesh.group.removeFromParent();
    this.list.length = 0;
  }
}

/** Beschriftung der Munitionsart (für Labels). */
export const ammoLabel = (id) => { const k = kindOf(id); return k ? KINDS[k].label : '–'; };
