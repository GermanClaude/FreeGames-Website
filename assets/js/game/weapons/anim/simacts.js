// NULLPUNKT – Ego-Ansicht: Handgriffe der Infanteriesimulation (Spielstil „Simulation“, game/isim/, Nutzer 19.11.).
// Wird in viewmodel.js in ViewModel.prototype gemischt (wie anim/inspects.js). Eine Aktion 'sim' mit Unterart:
//   charge      Durchladen: Spannhebel/Schlitten/Kammerstängel/Pumpe ganz durch (Choreografie von „Bereitmachen“, aber
//               als echte, blockierende Aktion – die Spiellogik lädt erst nach, wenn der Hebel vorschnellt)
//   clear       Ladehemmung beheben („Klopfen – Ziehen – Kanten“): Handballen schlägt ans Magazin, Waffe kippt zur
//               Auswurfseite, Spannhebel ganz durch, kurzer Blick ins Auswurffenster
//   bandage     Verband anlegen: Waffe nach rechts unten weg, linke Hand wickelt die Binde (Requisit) in Kreisen
//   tourniquet  Abbinden: Waffe weg, Band anlegen, Knebel mehrmals drehen, einhaken
// Spielzeit = Dauer der Aktion (isim/gun.js, isim/body.js); die Wirkung tritt dort zum festen Anteil ein (charge 0,58,
// clear 0,78, bandage/tourniquet am Ende). Alles mit den vorhandenen Ego-Händen (gunsmith/arms.js: 'free'-Anfragen,
// Anker magGrab/chargeGrab/slideGrab/boltGrab).
import * as THREE from 'three';
import { curve, windowW, clamp } from '../gunsmith/anim.js?v=20261121041936';
import { req } from './reloads.js?v=20261121041936';
import { inspectMech } from './inspects.js?v=20261121041936';

const Z3 = [0, 0, 0];

let _bandMat = null, _tqMat = null;
/** Kleine Requisiten (Binde, Abbindeband) – einmal je Ansicht, keine Texturen (Sampler-Grenze). */
function simProp(vm, kind) {
  const P = vm._simProps || (vm._simProps = {});
  if (P[kind]) return P[kind];
  const g = new THREE.Group();
  if (kind === 'bandage') {
    _bandMat = _bandMat || new THREE.MeshStandardMaterial({ name: 'isim:binde', color: 0xd9d4c4, roughness: 0.95 });
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 14), _bandMat);
    roll.rotation.z = Math.PI / 2;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.002, 0.11), _bandMat);
    tail.position.set(0, -0.02, 0.05);
    g.add(roll, tail);
  } else {
    _tqMat = _tqMat || new THREE.MeshStandardMaterial({ name: 'isim:abbindeband', color: 0x2c2d28, roughness: 0.8 });
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 18), _tqMat);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.09, 6), _tqMat);
    rod.rotation.z = Math.PI / 2; rod.position.y = 0.045;
    g.add(strap, rod);
  }
  g.visible = false;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  vm.root.add(g);
  P[kind] = g;
  return g;
}

export const SIM_ACTIONS = {
  /** Handgriff starten (bricht Kosmetik ab, nicht aber Nachladen/Wurf). → bool */
  playSim(kind, dur, extra = {}) {
    if (!this.cur) return false;
    this._start('sim', dur, { kind, mech: inspectMech(this.h), charged: false, ...extra });
    return true;
  },

  /** Requisiten der Simulation ausblenden (Ende/Abbruch). */
  _simHide() {
    const P = this._simProps;
    if (P) for (const k in P) P[k].visible = false;
  },

  _actSim(A, out) {
    const u = clamp(A.t / A.dur, 0, 1);
    let done = u >= 1;
    switch (A.kind) {
      case 'charge':
        // „Bereitmachen“-Choreografie je Mechanik (anim/moves.js), aber als blockierende Aktion
        if (A.mech === 'launcher' || A.mech === 'knife') return done;
        this._actReady(A, out);
        break;
      case 'clear': done = this._simClear(A, out, u); break;
      case 'bandage': done = this._simWrap(A, out, u, 'bandage'); break;
      case 'tourniquet': done = this._simWrap(A, out, u, 'tourniquet'); break;
      default: break;
    }
    if (done) this._simHide();
    return done;
  },

  /** Ladehemmung: Klopfen (Magazin), Ziehen (Hebel ganz durch, Waffe zur Auswurfseite gekippt), Blick ins Fenster. */
  _simClear(A, out, u) {
    const an = this.cur.ud.anchors;
    // 1) Klopfen: Handballen von unten ans Magazin
    const wT = windowW(u, 0.02, 0.12, 0.22, 0.3);
    if (wT > 0) {
      if (an.magGrab) req(out.left, wT, { anchor: an.magGrab, style: 'mag', dy: -0.01 });
      else req(out.left, wT, { free: [[-0.08, -0.26, -0.36], [0.3, 0.8, -0.5], [-0.8, 0.2, 0.3], 'flat'] });
    }
    if (u > 0.16 && !A.tapped) { A.tapped = true; this._jolt.kick(1.3, 0, 0); }
    // 2) Ziehen + Kanten: Bereitmachen-Choreografie auf 0,3–0,8 gestaucht, Waffe zur Auswurfseite gerollt
    const sub = A._sub || (A._sub = { mech: A.mech, t: 0, dur: 1, variant: 0, charged: false });
    const c = clamp((u - 0.3) / 0.5, 0, 1);
    if (u >= 0.3 && u <= 0.82) { sub.t = c; this._actReady(sub, out); }
    const roll = windowW(u, 0.26, 0.4, 0.78, 0.9);
    out.r[2] += 0.55 * roll; out.r[0] += 0.08 * roll; out.p[1] += 0.01 * roll;
    // 3) Blick ins Auswurffenster
    const look = windowW(u, 0.8, 0.88, 0.94, 1.0);
    out.r[1] -= 0.35 * look; out.r[2] += 0.25 * look; out.p[0] -= 0.03 * look;
    return u >= 1;
  },

  /** Verband/Abbinden: Waffe weg (wie Platte einsetzen), linke Hand mit Requisit in Wickelkreisen bzw. Knebeldrehungen. */
  _simWrap(A, out, u, kind) {
    const gw = windowW(u, 0.0, 0.12, 0.86, 1.0);
    out.p[0] = 0.08 * gw; out.p[1] = -0.3 * gw; out.p[2] = 0.08 * gw;
    out.r[0] = -0.75 * gw; out.r[1] = 0.3 * gw; out.r[2] = 0.35 * gw;
    const w = windowW(u, 0.06, 0.18, 0.82, 0.94);
    const tq = kind === 'tourniquet';
    // Wickeln: Kreise unten in der Bildmitte (am eigenen Bein/Arm), Abbinden: Band anziehen, dann Knebel drehen
    const ph = (u - 0.18) * (tq ? 5 : 7) * Math.PI * 2;
    const active = u > 0.18 && u < 0.8 ? 1 : 0;
    const cx = -0.05, cy = -0.22, cz = -0.34;
    let pos;
    if (tq && u < 0.4) pos = curve(u, [[0.06, [-0.2, -0.42, -0.2]], [0.22, [-0.08, -0.3, -0.33]], [0.32, [-0.02, -0.38, -0.3]], [0.4, [-0.06, -0.3, -0.33]]]);
    else pos = [cx + 0.045 * Math.cos(ph) * active, cy + 0.03 * Math.sin(ph) * active, cz + 0.015 * Math.sin(ph * 0.5) * active];
    if (!active && !tq) pos = curve(u, [[0.06, [-0.22, -0.44, -0.2]], [0.18, [cx, cy, cz]], [0.8, [cx, cy, cz]], [0.94, [-0.22, -0.44, -0.2]]]);
    const twist = tq && u > 0.4 && u < 0.8 ? Math.sin(ph) * 0.6 : 0;
    const F = [0.15 + 0.2 * twist, 0.9, -0.35], B = [0.1, 0.3 - 0.3 * twist, 0.95];
    req(out.left, w, { free: [pos, F, B, tq ? 'pinch' : 'wrap'] });
    const prop = simProp(this, tq ? 'tourniquet' : 'bandage');
    this._attachProp(prop, this.arms.left.handBone, 'grenade', -1);
    prop.visible = u > 0.08 && u < 0.86;
    if (prop.visible) prop.rotation.z = (tq ? twist : ph * 0.15);
    if (tq && u > 0.84 && !A.hooked) { A.hooked = true; this._jolt.kick(0.6, 0, 0); }
    return u >= 1;
  },
};
