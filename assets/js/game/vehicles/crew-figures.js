// NULLPUNKT — Sichtbare Besatzung im Innenraum (Nutzer 21.11.: „Als Ladeschütze siehst du den Richtschützen nicht“).
//
// In der Innensicht (Sicht `interior`) des eigenen Fahrzeugs sitzt auf jedem besetzten Platz eine Figur – Bots und im
// Mehrspieler die Mitspieler; der eigene Platz bleibt leer (dort gibt es höchstens die Ego-Hände des Ladeschützen).
//   Figur      Soldatenmodell (bots/character.js) in der Ausführung „Panzerbesatzung“ (Feldjacke, Feldmütze mit Funk-
//              Kopfhörer; Weltkrieg: Kopfhaube mit Kopfhörer), Detailstufe nach Kameraabstand (nah: volle Stufe mit Gesicht);
//              Grafikstufe low: einfache Stufe ohne Gesicht, kein Kopf-Leerlauf
//   Pose       eigene Vorwärtskinematik (Knochen der Bindepose zeigen entlang −Y): sitzend (Oberschenkel waagerecht,
//              Füße am Boden), Oberkörper zum Augpunkt der Innensicht geneigt; Arme per Zwei-Knochen-IK an die Bedienteile:
//              Richtschütze an den Handgriffen unter der Optik, Fahrer an den Lenkhebeln (ziehen beim Lenken), Kommandant
//              an den Periskopgriffen, Funker am Bug-MG (Funkgerät, wenn er nicht schießt), Ladeschütze stehend am Verschluss
//              bzw. Gestell – Ladeablauf synchron zur Ladeautomatik von crew.js (greifen → tragen → ansetzen → einschieben),
//              Granate in der Hand; Mitfahrer Hände auf den Knien
//   Kopf       Leerlauf-Blicke (alle paar Sekunden ein anderer Punkt, weich), Kommandant schaut beim Zielwechsel kurz zum
//              Ziel, Ladeschütze zu seinen Händen, Richtschütze/Kommandant am Okular bleiben ruhig
// Anker: cabinSeatAnchors(vehicle) aus cabin.js (Hüfte, Auge, Blickrichtung, Haltung je Platz), Rückfall: Augpunkte der
// Innensichten (views.js). Kosten: nur Innensicht, nur eigenes Fahrzeug; Figuren entstehen beim ersten Blick in den
// Innenraum und verschwinden beim Aussteigen.
import * as THREE from 'three';
import { createSoldier } from '../bots/character.js?v=20261122020853';
import { BONES, BONE, BIND, DIM } from '../bots/soldier/rig.js?v=20261122020853';
import { twoBone } from '../bots/soldier/ik.js?v=20261122020853';
import { spaceLocal } from './views.js?v=20261122020853';
import { cabinSeatAnchors } from './cabin.js?v=20261122020853';
import { driverCabin } from './data.js?v=20261122020853';
import { funkerCabin, funkerLayout } from './periscopes.js?v=20261122020853';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), DOWN = new THREE.Vector3(0, -1, 0);
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _eye = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1), _sd = new THREE.Vector3();
const _E = new THREE.Vector3(), _T = new THREE.Vector3(), _pole = new THREE.Vector3();
const N = BIND.length;
// Elternknochen und lokale Offsets je Knochen (Kind − Eltern in der Bindepose)
const PARENT = BONES.map((b) => b[1]);
const LOFF = BIND.map((b, i) => (PARENT[i] < 0 ? new THREE.Vector3(...b) : new THREE.Vector3(b[0] - BIND[PARENT[i]][0], b[1] - BIND[PARENT[i]][1], b[2] - BIND[PARENT[i]][2])));
const HIP_Y = BIND[0][1];
// Scheitel (Mütze/Kopfhörer eingerechnet) über der Wurzel bei Rumpfneigung lean – wie die Vorwärtskinematik unten: Hüfte →
// Lende senkrecht, Lende → Brust 45 %, Brust → Hals 100 %, Hals → Kopf 60 % der Neigung, Kopf aufrecht (Kopf → Scheitel ≈ 0,26 m)
const L_SP = BIND[BONE.spine][1] - HIP_Y, L_CH = BIND[BONE.chest][1] - BIND[BONE.spine][1], L_NK = BIND[BONE.neck][1] - BIND[BONE.chest][1], L_HD = BIND[BONE.head][1] - BIND[BONE.neck][1];
function crownAt(hipsY, lean) {
  return hipsY + L_SP + L_CH * Math.cos(lean * 0.45) + L_NK * Math.cos(lean) + L_HD * Math.cos(lean * 0.6) + 0.26;
}

let SHELL = null;
function shellMesh() {
  if (!SHELL) {
    const g = new THREE.CylinderGeometry(0.06, 0.06, 0.62, 10); g.rotateX(Math.PI / 2);
    SHELL = { g, m: new THREE.MeshStandardMaterial({ name: 'besatzung:granate', color: 0x9a7a3a, metalness: 0.75, roughness: 0.35 }) };
  }
  const m = new THREE.Mesh(SHELL.g, SHELL.m);
  m.name = 'besatzung:granate';
  m.frustumCulled = false;
  return m;
}

/** Anker je Platz: cabin.js, sonst aus den Innensichten (Auge − 0,65 m ≈ Hüfte). */
function anchorsOf(v) {
  let list = null;
  try { list = cabinSeatAnchors(v); } catch { list = null; }
  if (list && list.length) return list; // Anker direkt (cabin.js: Lader stehend, Richtschütze hinter der Optik, Mitfahrer quer)
  return v.seats.map((s, index) => {
    const inner = (s.def.views || []).find((x) => x.interior);
    const eye = inner ? inner.station || inner.pos : null;
    return { index, seat: s.def.id, role: s.def.id, space: inner && inner.space === 'turret' ? 'turret' : 'hull', eye: eye ? eye.slice() : null, hip: eye ? [eye[0], eye[1] - 0.7, eye[2] + 0.08] : null, yaw: 0, posture: 'sitzend', interior: !!inner };
  });
}

/** Eine Figur (Soldatenmodell + Pose). */
class Figure {
  constructor(sys, v, seat, anchor, actor) {
    this.sys = sys; this.v = v; this.seat = seat; this.a = anchor; this.actor = actor;
    const G = sys.G, low = sys.low;
    const era = (v.def.era || 'modern');
    this.soldier = createSoldier({
      // Mitfahrer (Schützenpanzer/Transporter): eigene Infanterie-Ausrüstung des Bots, Besatzung: Panzerkombi mit Kopfhörer
      team: v.team || actor.team || 'A', variant: seat.def.passenger ? (actor.soldier && actor.soldier.variant) || actor.variant || 0 : era === 'modern' || era === 'kk' ? 'panzerbesatzung' : 'panzerbesatzung-wk',
      camo: actor.soldier && actor.soldier.scheme ? actor.soldier.scheme : null, quality: low ? 'low' : 'high',
      models: G.bots && G.bots.models ? G.bots.models : null, name: actor.name || '', face: low ? false : undefined,
    });
    const S = this.soldier;
    S.state = 'alive';
    S.root.name = `besatzung:${seat.def.id}`;
    S.root.visible = false;
    for (const m of S.meshes) { m.castShadow = false; m.receiveShadow = false; }
    G.scene.add(S.root);
    this.Qm = Array.from({ length: N }, () => new THREE.Quaternion());
    this.P = Array.from({ length: N }, () => new THREE.Vector3());
    this.head = { yaw: 0, pitch: 0, ty: 0, tp: 0, t: 1 + Math.random() * 3 };
    this.yaw = anchor.yaw || 0; // Körpergier (Ladeschütze dreht sich zum Gestell)
    this.load = { p: 0, carry: false };
    this.shell = null;
    this.ph = Math.random() * 10;
  }

  dispose() {
    try { this.soldier.dispose(); } catch { /* */ }
    if (this.shell) this.shell.removeFromParent();
  }

  /** Raum → Welt (Darstellungslage). */
  toWorld(p, out) {
    const v = this.v;
    spaceLocal(v, this.a.space === 'turret' ? 'turret' : 'hull', p, out, null);
    return v.body.toWorldRender(out, out);
  }

  /** Raumpunkt (Array oder Vector3) → Modellraum der Figur. */
  toModel(p, root, out) {
    out.set(p.x ?? p[0], p.y ?? p[1], p.z ?? p[2]).sub(root);
    return out.applyAxisAngle(Y, -this.yaw);
  }

  /** Ziele der Hände (Raumkoordinaten) und Haltung je Rolle. → { l, r, look, lean, stand } */
  _targets(dt) {
    const v = this.v, D = v.def, a = this.a, s = this.seat;
    const hip = a.hip, eye = a.eye || [hip[0], hip[1] + 0.72, hip[2] - 0.1];
    const I = D.interior || {}, sc = I.scale || 1, sh = I.shift || [0, 0, 0];
    const ip = (p) => [p[0] * sc + sh[0], p[1] * sc + sh[1], p[2] * sc + sh[2]];
    const role = s.def.drive ? 'fahrer' : s.def.loader ? 'lader' : s.def.id === 'commander' ? 'kommandant' : s.def.mount === 'gun' ? 'richtschuetze' : s.def.id === 'funker' ? 'funker' : s.def.mount ? 'mg' : 'mitfahrer';
    // Mitfahrer steht in der Dachluke und feuert: draußen sichtbar (Soldatenmodell, index.js) – keine zweite, sitzende Figur
    if (s.hatchT >= 0.5 && (s.def.views || [])[s.view] && s.def.views[s.view].fireOut) return null;
    const o = { role, l: null, r: null, lookAt: null, steady: false, stand: a.posture === 'stehend', yawTo: null, shell: false };
    if (role === 'richtschuetze') {
      const inner = (s.def.views || []).find((x) => x.interior);
      const st = inner && inner.station; // Okular: Griffe darunter, etwas zum Schützen hin
      const gp = st ? [st[0], st[1] - 0.3, st[2] + 0.1] : [eye[0], eye[1] - 0.32, eye[2] - 0.25];
      o.l = [gp[0] - 0.13, gp[1], gp[2]]; o.r = [gp[0] + 0.13, gp[1], gp[2]]; o.steady = true;
      const seatI = s.intent;
      if (seatI && seatI.fire) { o.r[1] += 0.02; o.r[2] += 0.02; } // Daumen am Abzug
    } else if (role === 'kommandant') {
      if (s.hatchOpen) return null; // steht in der Luke: draußen sichtbar (Soldatenmodell)
      o.l = [eye[0] - 0.17, eye[1] - 0.1, eye[2] - 0.2]; o.r = [eye[0] + 0.17, eye[1] - 0.1, eye[2] - 0.2]; o.steady = true;
    } else if (role === 'fahrer') {
      const R = driverCabin(D);
      const F = R ? R.F : hip;
      const st = v.body.controls ? clamp(+v.body.controls.steer || 0, -1, 1) : 0;
      // Lenkhebel: Ziehen = Hand nach hinten (+Z) auf der Lenkseite
      o.l = [F[0] - 0.2, F[1] + 0.52, F[2] - 0.22 + (st < 0 ? -st * 0.1 : 0)];
      o.r = [F[0] + 0.2, F[1] + 0.52, F[2] - 0.22 + (st > 0 ? st * 0.1 : 0)];
    } else if (role === 'funker') {
      const FK = funkerCabin(D, driverCabin);
      const mg = D.cmgPivot || [hip[0], hip[1] + 0.5, hip[2] - 0.5];
      const grip = [mg[0], mg[1] - 0.06, mg[2] + 0.32];
      o.r = [grip[0] + 0.05, grip[1], grip[2]];
      const firing = s.intent && s.intent.fire;
      o.l = firing || !FK ? [grip[0] - 0.08, grip[1] + 0.02, grip[2] - 0.05] : funkerLayout(FK).kanal.slice();
      if (!firing && FK) o.lookAt = funkerLayout(FK).radio;
    } else if (role === 'lader') {
      const g = v.gun;
      const rack = ip(I.rack || [0, 0.45, 1.55]), br = ip(I.breech || [0, 0.42, -0.55]);
      // Fortschritt des Ladevorgangs: Automatik (Bot) bzw. Handgriffe (Mitspieler)
      let p = -1;
      if (g && g.auto && g.autoMax > 0.5) p = 1 - g.autoT / g.autoMax;
      else if (g && g.busy > 0) p = g.busyKind === 'greifen' ? 0.15 + 0.3 * (1 - g.busy / (g._busyMax || 1)) : g.busyKind === 'einschieben' ? 0.75 + 0.17 * (1 - g.busy / (g._busyMax || 1)) : g.busyKind === 'schliessen' ? 0.95 : 0.1;
      else if (g && g.step === 'gegriffen') p = 0.6;
      const brk = [br[0] + 0.05, br[1] + 0.02, br[2] + 0.55]; // Verschlussende (hinter dem Keil)
      if (p < 0) { // bereit: Hand am Sicherungshebel, Blick zum Verschluss
        o.l = [brk[0] - 0.18, brk[1] - 0.05, brk[2] + 0.12]; o.r = [brk[0] + 0.22, brk[1] + 0.08, brk[2] + 0.08];
        o.yawTo = brk; o.lookAt = brk;
      } else if (p < 0.45) { // zum Gestell, Granate greifen
        const k = smooth(p / 0.2);
        o.yawTo = rack; o.lookAt = rack;
        o.l = [rack[0] - 0.12, rack[1] + 0.05 * k, rack[2] - 0.15 + 0.12 * k]; o.r = [rack[0] + 0.12, rack[1] + 0.05 * k, rack[2] - 0.1 + 0.12 * k];
        o.shell = p > 0.25;
      } else if (p < 0.75) { // Granate vor der Brust zum Verschluss tragen
        const k = smooth((p - 0.45) / 0.3);
        o.yawTo = k > 0.5 ? brk : rack; o.lookAt = brk;
        const mid = [hip[0] * 0.5 + brk[0] * 0.5, hip[1] + 0.35, hip[2] * 0.5 + brk[2] * 0.5];
        o.l = [mid[0] - 0.14, mid[1], mid[2]]; o.r = [mid[0] + 0.14, mid[1] - 0.04, mid[2] + 0.12];
        o.shell = true;
      } else { // ansetzen, einschieben (Faust schiebt nach), Keil schließt
        const k = smooth((p - 0.75) / 0.17);
        o.yawTo = brk; o.lookAt = brk;
        o.l = [brk[0] - 0.12, brk[1] + 0.06, brk[2] + 0.2 - 0.25 * k]; o.r = [brk[0] + 0.02, brk[1] + 0.02, brk[2] + 0.32 - 0.42 * k];
        o.shell = p < 0.9;
      }
    } else if (role === 'mg') {
      o.l = [eye[0] - 0.1, eye[1] - 0.3, eye[2] - 0.35]; o.r = [eye[0] + 0.1, eye[1] - 0.3, eye[2] - 0.32];
    } else {
      // Hände auf den Knien – in Blickrichtung der Figur (a.yaw; Bänke quer: ±90°). Proportionen 22.11.: vorher ohne Drehung,
      // die Mitfahrer griffen neben sich bzw. hinter sich in die Bordwand
      const yw = a.yaw || 0, fx = -Math.sin(yw), fz = -Math.cos(yw), rx = Math.cos(yw), rz = -Math.sin(yw);
      o.l = [hip[0] - rx * 0.14 + fx * 0.34, hip[1] + 0.06, hip[2] - rz * 0.14 + fz * 0.34];
      o.r = [hip[0] + rx * 0.14 + fx * 0.34, hip[1] + 0.06, hip[2] + rz * 0.14 + fz * 0.34];
    }
    return o;
  }

  update(dt, cam, visible) {
    const S = this.soldier, a = this.a;
    if (!visible || !a.hip) { if (S.root.visible) S.root.visible = false; return; }
    const o = this._targets(dt);
    if (!o) { if (S.root.visible) S.root.visible = false; return; }
    this.ph += dt;
    const hip = a.hip;
    // Körpergier (stehender Ladeschütze dreht sich zum Gestell/Verschluss)
    if (o.stand && o.yawTo) {
      const want = Math.atan2(-(o.yawTo[0] - hip[0]), -(o.yawTo[2] - hip[2]));
      this.yaw += wrap(want - this.yaw) * (1 - Math.exp(-dt * 5));
    } else this.yaw = a.yaw || 0;
    // Wurzel (Raum): Hüftgelenk ~10 cm über der Sitzfläche; stehend: Füße am Boden
    const root = _w.set(hip[0], hip[1] - HIP_Y + (o.stand ? 0 : 0.1), hip[2]);
    // Kopfziel → Neigung des Oberkörpers (Augpunkt der Innensicht)
    const P = this.P, Qm = this.Qm;
    const eyeM = this.toModel(a.look || a.eye || [hip[0], hip[1] + 0.75, hip[2]], root, _eye); // look: Richtschütze am Okular (cabin.js)
    const hipsPos = P[0].set(0, HIP_Y, 0);
    if (o.stand) hipsPos.y = HIP_Y - 0.02 + Math.sin(this.ph * 1.3) * 0.004;
    const dz = eyeM.z - hipsPos.z, dy = Math.max(0.3, eyeM.y - hipsPos.y);
    let lean = clamp(Math.atan2(-dz, dy), -0.15, o.stand ? 0.45 : 0.7) + (o.steady ? 0 : Math.sin(this.ph * 0.7) * 0.01);
    // Proportionen 22.11.: niedriger Raum (a.roof, cabin.js: Mannschaftsraum, Turmdecke, Fahrer-/Funkerraum) – der Scheitel
    // samt Mütze bleibt 4 cm unter der Decke. rest 22.11.: vorher nur für Mitfahrer; im Turm steckten Kopf und Mütze der
    // Besatzung in der Decke (von innen unsichtbar). Sitzend: vorbeugen bis 0,7 rad (die Neigung verteilt sich auf Lende/Brust,
    // der Kopf richtet sich zu 40 % wieder auf; der Fahrer lehnt sich stattdessen zurück – Liegesitz unter geschlossener
    // Luke), dann tiefer sitzen (≤ 0,25 m), zuletzt weiter neigen (≤ 1 rad); stehend: in die Knie (≤ 0,12 m), vorbeugen, tiefer
    // in die Knie (enge Türme der Weltkriegs-Panzer)
    if (a.roof != null) {
      const lim = a.roof - 0.04 - (hip[1] - HIP_Y + (o.stand ? 0 : 0.1)); // Decke über der Wurzel (Modellraum)
      let over = crownAt(hipsPos.y, lean) - lim;
      const back = o.role === 'fahrer';
      const tilt = (max) => {
        for (let k = 0; over > 0 && k < 30 && (back ? lean > -max : lean < max); k++) {
          lean = back ? Math.max(-max, Math.min(lean, 0) - 0.04) : Math.min(max, Math.max(lean, 0) + 0.04);
          over = crownAt(hipsPos.y, lean) - lim;
        }
      };
      const sink = (max) => { if (over > 0) { const k = Math.min(over, max); hipsPos.y -= k; over -= k; } };
      if (o.stand) { sink(0.12); tilt(0.45); sink(0.2); } else { tilt(0.7); sink(0.25); tilt(1.0); }
    }
    const breath = Math.sin(this.ph * 1.6) * 0.012;
    // FK Rumpf
    Qm[0].identity();
    Qm[1].setFromAxisAngle(X, -lean * 0.45);
    Qm[2].copy(Qm[1]).multiply(_q.setFromAxisAngle(X, -lean * 0.55 + breath));
    for (const i of [1, 2]) P[i].copy(LOFF[i]).applyQuaternion(Qm[PARENT[i]]).add(P[PARENT[i]]);
    // Kopf/Blick
    const H = this.head;
    if (!this.sys.low) {
      H.t -= dt;
      if (H.t <= 0) { H.t = 2.2 + Math.random() * 4; H.ty = o.steady ? (Math.random() - 0.5) * 0.12 : (Math.random() - 0.5) * 0.9; H.tp = o.steady ? 0 : (Math.random() - 0.5) * 0.35; }
    }
    let ty = H.ty, tp = H.tp;
    if (o.lookAt) { const L = this.toModel(o.lookAt, root, _v); const hp = P[2]; ty = Math.atan2(-(L.x - hp.x), -(L.z - hp.z)); tp = Math.atan2(L.y - hp.y - 0.3, Math.hypot(L.x - hp.x, L.z - hp.z)); }
    if (o.role === 'kommandant' && this.sys.cmdLook && this.sys.cmdLook.until > this.sys.G.time.elapsed) { ty = this.sys.cmdLook.yaw; tp = 0.05; }
    const kh = 1 - Math.exp(-dt * (o.lookAt ? 6 : 3));
    H.yaw += (clamp(ty, -1.1, 1.1) - H.yaw) * kh; H.pitch += (clamp(tp, -0.6, 0.5) - H.pitch) * kh;
    Qm[3].copy(Qm[2]).multiply(_q.setFromAxisAngle(X, lean * 0.4));
    P[3].copy(LOFF[3]).applyQuaternion(Qm[2]).add(P[2]);
    _q.setFromAxisAngle(Y, H.yaw); _q2.setFromAxisAngle(X, H.pitch); Qm[4].copy(_q).multiply(_q2);
    P[4].copy(LOFF[4]).applyQuaternion(Qm[3]).add(P[3]);
    // Arme (Schulter → Hand, Ellbogen nach außen/unten)
    for (const [ui, side, tgt] of [[BONE.upperArmL, -1, o.l], [BONE.upperArmR, 1, o.r]]) {
      const fi = ui + 1, hi = ui + 2;
      P[ui].copy(LOFF[ui]).applyQuaternion(Qm[2]).add(P[2]);
      const T = tgt ? this.toModel(tgt, root, _T) : _T.set(side * 0.25, P[0].y + 0.1, -0.25);
      _pole.set(side * 0.8, -1, 0.35);
      twoBone(P[ui], T, DIM.upperArm, DIM.foreArm, _pole, _E, _v);
      Qm[ui].setFromUnitVectors(DOWN, _p.subVectors(_E, P[ui]).normalize());
      Qm[fi].setFromUnitVectors(DOWN, _p.subVectors(_v, _E).normalize());
      Qm[hi].copy(Qm[fi]);
      P[fi].copy(_E); P[hi].copy(_v);
    }
    // Beine: sitzend Oberschenkel nach vorn, Füße am Boden; stehend leicht gebeugt
    for (const [ti, side] of [[BONE.thighL, -1], [BONE.thighR, 1]]) {
      const si = ti + 1, fi = ti + 2;
      P[ti].copy(LOFF[ti]).applyQuaternion(Qm[0]).add(P[0]);
      const F = o.stand ? _T.set(side * 0.13, DIM.ankle, side * 0.06) : _T.set(side * 0.13, P[0].y - 0.43 - 0.1 + 0.08, -0.46);
      _pole.set(side * 0.1, 0.2, -1);
      twoBone(P[ti], F, DIM.thigh, DIM.shin, _pole, _E, _v);
      Qm[ti].setFromUnitVectors(DOWN, _p.subVectors(_E, P[ti]).normalize());
      Qm[si].setFromUnitVectors(DOWN, _p.subVectors(_v, _E).normalize());
      Qm[fi].identity();
    }
    // Modellraum → lokale Knochenquaternionen
    const B = S.bones;
    for (let i = 0; i < N; i++) {
      const p = PARENT[i];
      if (p < 0) B[i].quaternion.copy(Qm[i]);
      else B[i].quaternion.copy(_q.copy(Qm[p]).invert().multiply(Qm[i]));
    }
    B[0].position.copy(P[0]);
    // Granate in der Hand (Ladeschütze)
    if (o.shell) {
      if (!this.shell) { this.shell = shellMesh(); S.root.add(this.shell); }
      this.shell.visible = true;
      this.shell.position.copy(P[BONE.handL]).add(P[BONE.handR]).multiplyScalar(0.5);
      this.shell.position.y -= 0.03;
      _p.subVectors(P[BONE.handR], P[BONE.handL]);
      this.shell.quaternion.setFromUnitVectors(Z, _sd.set(_p.x * 0.3, 0, -1).normalize());
    } else if (this.shell) this.shell.visible = false;
    // Welt: Wurzel im Raum + Raumdrehung (Turm) + Körpergier
    const v = this.v;
    this.toWorld([root.x, root.y, root.z], S.root.position);
    _q.setFromAxisAngle(Y, (this.a.space === 'turret' ? v.mount.turretYaw : 0) + this.yaw);
    S.root.quaternion.copy(v.body.renderQuat).multiply(_q);
    if (!S.root.visible) S.root.visible = true;
    S.updateLod(cam ? S.root.position.distanceTo(cam.position) * 0.5 : 2);
    if (S.face && S.face.visible && !this.sys.low) { try { S.face.update(dt); } catch { /* */ } }
  }
}

export class CrewFigures {
  constructor(sys) {
    this.sys = sys; this.G = sys.G;
    this.v = null; this.list = []; this.anchors = null;
    this.low = (sys.quality || (this.G.renderer && this.G.renderer.quality)) === 'low';
    this.cmdLook = null; this._lastTarget = null;
    this._err = false;
  }

  clear() { for (const f of this.list) f.dispose(); this.list.length = 0; this.v = null; this.anchors = null; }

  update(dt) {
    const G = this.G, p = G.player;
    const v = p && p.vehicle;
    const cv = this.sys.camera && this.sys.camera.view;
    const inside = !!(v && v.alive && cv && cv.interior && !cv.tp && G.scene);
    if (!v || !v.alive) { if (this.v) this.clear(); return; }
    if (v !== this.v) { this.clear(); this.v = v; }
    if (!inside) { for (const f of this.list) f.update(dt, null, false); return; }
    try {
      if (!this.anchors) this.anchors = anchorsOf(v);
      // Figuren je besetztem Platz (außer dem eigenen); Wechsel von Insassen → neue Figur
      for (const s of v.seats) {
        const a = s.actor;
        const want = a && a !== p && a.alive;
        let f = this.list.find((x) => x.seat === s);
        if (f && (!want || f.actor !== a)) { f.dispose(); this.list.splice(this.list.indexOf(f), 1); f = null; }
        const an = this.anchors[s.index];
        if (want && !f && an && an.hip && an.interior !== false) this.list.push(new Figure(this, v, s, an, a));
      }
      // Kommandant schaut beim Zielwechsel zum Ziel (Panzermodus: Besatzungs-KI)
      const crew = G.mode && G.mode.crew && G.mode.crew.v === v ? G.mode.crew : null;
      const t = crew && (crew.cmd.target || crew.gun.target);
      if (t && t.ent !== this._lastTarget && t.pos) {
        this._lastTarget = t.ent;
        const rel = wrap(Math.atan2(-(t.pos.x - v.position.x), -(t.pos.z - v.position.z)) - v.body.yaw() - v.mount.turretYaw);
        this.cmdLook = { yaw: clamp(rel, -1.1, 1.1), until: G.time.elapsed + 2.2 };
      }
      for (const f of this.list) f.update(dt, G.camera, true);
    } catch (err) {
      if (!this._err) { this._err = true; console.warn('[Fahrzeuge] Besatzungsfiguren:', err); }
    }
  }

  dispose() { this.clear(); }
}
