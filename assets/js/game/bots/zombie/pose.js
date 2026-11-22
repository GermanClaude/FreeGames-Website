// NULLPUNKT — Zombie-Modus: Haltung der Untoten über der Soldaten-Animation (bots/soldier/animator.js bleibt unverändert).
// Nach soldier.animate() werden einzelne lokale Knochen-Drehungen (anim.lq) überlagert bzw. ersetzt, danach rechnet die
// Vorwärtskinematik des Animators (anim._fk) die Modellraum-Gelenke neu – Trefferzonen, Kopfmitte und Ragdoll folgen also
// der sichtbaren Haltung. Inhalt: gebeugter Rumpf mit Seitwanken im Schrittrhythmus, hängender/geneigter Kopf, Arme
// vorgestreckt oder schlaff (je Aussehen), Schlurfen (ein Bein zieht nach: Fuß bleibt flach, Knie steifer), Schlag
// (Ausholen → Zuschlagen → Nachschwingen) aus zombie.js (attack 0…1, Phase).
import * as THREE from 'three';
import { BONE, BONE_COUNT, DIM } from '../soldier/rig.js?v=20261122020853';

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Lokale Drehung nachschalten (Drehung im Knochenraum, Reihenfolge YXZ). */
function post(lq, i, x, y = 0, z = 0) {
  _e.set(x, y, z, 'YXZ');
  lq[i].multiply(_q.setFromEuler(_e));
}

/** Lokale Drehung ersetzen. */
function setLocal(lq, i, x, y = 0, z = 0) {
  _e.set(x, y, z, 'YXZ');
  lq[i].setFromEuler(_e);
}

/**
 * Haltung überlagern. st: { look, attack (0 = keiner, sonst 0…1 Fortschritt des Schlags), speed (m/s), lunge (0…1),
 * time (s, eigener Takt), slow (0.35…1, Beintreffer) }
 */
export function applyZombiePose(soldier, st) {
  const a = soldier && soldier.anim;
  if (!a || soldier.state !== 'alive' || !a.lq) return;
  const lq = a.lq;
  const L = st.look || {};
  const ph = (a.phase || 0) * Math.PI * 2;
  const t = st.time || 0;
  const sp = clamp((st.speed || 0) / 5, 0, 1);
  const hunch = (L.hunch ?? 0.8) * (1 - 0.35 * sp);
  const sway = Math.sin(ph) * (0.07 + 0.05 * (1 - sp)) + Math.sin(t * 0.9 + (L.tilt || 0) * 3) * 0.03;
  const atk = st.attack || 0;
  // Schlag: Ausholen (0…0,55) → Zuschlagen (0,55…0,75) → Nachschwingen
  const wind = atk > 0 ? (atk < 0.55 ? atk / 0.55 : atk < 0.75 ? 1 - (atk - 0.55) / 0.2 : 0) : 0;
  const strike = atk > 0.55 ? clamp(1 - Math.abs(atk - 0.72) / 0.22, 0, 1) : 0;

  // Rumpf: nach vorn gebeugt, wankt seitlich; beim Ausholen zurück, beim Schlag nach vorn
  post(lq, BONE.spine, -0.16 * hunch - 0.12 * strike + 0.08 * wind, 0, sway * 0.6);
  post(lq, BONE.chest, -0.12 * hunch - 0.1 * strike + 0.06 * wind, 0, sway * 0.4);
  // Kopf: hängt nach vorn, zur Seite geneigt, ruckt gelegentlich
  const jerk = Math.max(0, Math.sin(t * 1.7 + (L.tilt || 0) * 5)) ** 12 * 0.25;
  post(lq, BONE.neck, 0.12 * hunch, jerk * 0.6, (L.tilt || 0) * 0.22 + sway * 0.3);
  post(lq, BONE.head, -0.05 - 0.05 * hunch, 0, (L.tilt || 0) * 0.18 - jerk);

  // Arme (Schulter = Brust-Raum): vorgestreckt (+x hebt den Arm nach vorn), schlaff, oder tief/breit
  const reach = 1.5 + 0.1 * sp + 0.5 * wind - 0.45 * strike;
  const bob = Math.sin(ph) * 0.08;
  const limpArm = (side) => {
    setLocal(lq, side < 0 ? BONE.upperArmL : BONE.upperArmR, 0.12 + bob * side * 0.5 + 0.25 * wind, 0, side * 0.08);
    setLocal(lq, side < 0 ? BONE.foreArmL : BONE.foreArmR, 0.2 + 0.15 * wind, 0, 0);
    setLocal(lq, side < 0 ? BONE.handL : BONE.handR, 0.25, 0, 0);
  };
  const reachArm = (side, k = 1) => {
    const r = reach * k + bob * side;
    setLocal(lq, side < 0 ? BONE.upperArmL : BONE.upperArmR, r, side * 0.12, side * (0.12 + 0.1 * strike));
    setLocal(lq, side < 0 ? BONE.foreArmL : BONE.foreArmR, 0.28 - 0.2 * strike + 0.15 * wind, 0, 0);
    setLocal(lq, side < 0 ? BONE.handL : BONE.handR, -0.35, 0, side * -0.2);
  };
  const arms = L.arms | 0;
  if (arms === 3) {
    // Hüne: Arme tief und breit, beim Schlag beide hoch über den Kopf und nieder
    const k = 0.45 + 0.9 * wind - 0.2 * strike;
    for (const side of [-1, 1]) {
      setLocal(lq, side < 0 ? BONE.upperArmL : BONE.upperArmR, k + bob * side, side * 0.1, side * (0.32 - 0.15 * wind));
      setLocal(lq, side < 0 ? BONE.foreArmL : BONE.foreArmR, 0.35 + 0.3 * wind, 0, 0);
      setLocal(lq, side < 0 ? BONE.handL : BONE.handR, -0.2, 0, 0);
    }
  } else {
    if (arms === 1 && atk === 0) limpArm(-1); else reachArm(-1, arms === 2 ? 0.85 : 1);
    if (arms === 2 && atk === 0) limpArm(1); else reachArm(1, arms === 1 ? 0.85 : 1);
  }

  // Schlurfen: ein Bein steifer (Knie weniger gebeugt, Fuß bleibt flach) – stärker bei Beintreffern
  const drag = (1 - sp) * 0.7 + (1 - (st.slow ?? 1)) * 1.2;
  if (drag > 0.02) {
    const sh = L.limp < 0 ? BONE.shinL : BONE.shinR;
    const ft = L.limp < 0 ? BONE.footL : BONE.footR;
    const th = L.limp < 0 ? BONE.thighL : BONE.thighR;
    _e.setFromQuaternion(lq[sh], 'YXZ');
    setLocal(lq, sh, _e.x * (1 - 0.45 * clamp(drag, 0, 1)), _e.y, _e.z);
    post(lq, th, 0, L.limp * 0.12 * clamp(drag, 0, 1), L.limp * 0.04);
    _e.setFromQuaternion(lq[ft], 'YXZ');
    setLocal(lq, ft, _e.x * 0.4, _e.y, _e.z);
  }

  // Vorwärtskinematik neu (Becken bleibt), Kopfmitte, Knochen schreiben
  if (typeof a._fk === 'function') for (let i = 1; i < BONE_COUNT; i++) a._fk(i);
  if (a.headCenter && a.wq && a.wp) a.headCenter.fromArray(DIM.headCenter).applyQuaternion(a.wq[BONE.head]).add(a.wp[BONE.head]);
  if (typeof soldier._writePose === 'function') soldier._writePose();
  void _v;
}
