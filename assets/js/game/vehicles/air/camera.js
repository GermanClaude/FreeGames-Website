// NULLPUNKT — Kameras im Luftfahrzeug: Cockpitsicht rollt mit (Horizont kippt), Verfolger hinter dem Luftfahrzeug
// (folgt der Nase gedämpft, freies Umsehen per relYaw/relPitch, Federarm mit Kollision, nie unter dem Boden).
// Sichten mit Lafettenblick (Bordschütze: Zieloptik, vorderes Cockpit, Außenansicht) übernimmt VehicleCamera unverändert.
// Schreibt den Zustand der VehicleCamera (pos, dir, view, sight, zoom, ready) mit, damit index.js/vehicle.js gleich lesen.
import * as THREE from 'three';
import { collisionRay, keepClear } from '../../engine/physics.js?v=20261114060746';
import { viewOf, viewAnchor, viewZoom } from '../views.js?v=20261114060746';

const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3(), _f = new THREE.Vector3(), _piv = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _hit = {};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/**
 * Kamera eines Luftfahrzeug-Sitzes setzen. vc = VehicleCamera (Zustand), camera = Spielerkamera.
 * → { sight, zoom, view }
 */
export function updateAirCamera(vc, camera, v, seat, dt, world, baseFov = 70, view = null) {
  view = view || viewOf(seat);
  if (view.look === 'mount') return vc.update(camera, v, seat, dt, world, baseFov, view);
  const tp = view.tp;
  const wantZoom = viewZoom(view, seat.zoomIndex || 0);
  const switched = vc.view !== view;
  vc.view = view;
  vc.sight = !tp;
  if (switched) { vc.zoom = wantZoom; vc.ready = false; }
  vc.zoom += (wantZoom - vc.zoom) * (1 - Math.exp(-dt * 14));
  const b = v.body, L = seat.look;
  if (!tp) {
    viewAnchor(v, view, _p, null);
    _e.set(L.relPitch || 0, L.relYaw || 0, 0, 'YXZ');
    _q.setFromEuler(_e).premultiply(b.renderQuat);
    // leichtes Rotorzittern im Hubschrauber (nur Darstellung)
    if (v.air === 'heli' && b.rpm > 0.5) {
      const t = v.G.time.elapsed, a = 0.0018 * b.rpm * (b.onGround ? 0.5 : 1);
      _q.multiply(_q2.setFromEuler(_e.set(Math.sin(t * 41) * a, Math.sin(t * 37 + 1) * a, Math.sin(t * 29 + 2) * a, 'YXZ')));
    }
    camera.position.copy(_p);
    camera.quaternion.copy(_q);
    vc.pos.copy(_p);
    vc.ready = true;
  } else {
    // Verfolger: Kurs der Nase (ohne Rollen), Nicken halb, gedämpft; dazu freier Blick
    b.forward(_f);
    const yawN = Math.atan2(-_f.x, -_f.z);
    const pitchN = Math.asin(clamp(_f.y, -1, 1)) * (v.air === 'jet' ? 0.85 : 0.35);
    const st = vc._air || (vc._air = { yaw: yawN, pitch: pitchN });
    if (!vc.ready) { st.yaw = yawN; st.pitch = pitchN; }
    const k = 1 - Math.exp(-dt * (v.air === 'jet' ? 5 : 3.2));
    st.yaw += wrap(yawN - st.yaw) * k;
    st.pitch += (pitchN - st.pitch) * k;
    const yaw = st.yaw + (L.relYaw || 0), pitch = clamp(st.pitch + (L.relPitch || 0) - 0.12, -1.3, 1.3);
    const c = Math.cos(pitch);
    _d.set(-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c);
    b.toWorldRender(_t.set(0, tp.pivot, 0), _piv);
    _p.copy(_piv).addScaledVector(_d, -tp.dist);
    _p.y += tp.height - tp.pivot;
    // Federarm mit Kollision
    _t.copy(_p).sub(_piv);
    const len = _t.length();
    let arm = len;
    if (len > 1e-3 && world) {
      _t.multiplyScalar(1 / len);
      const h = collisionRay(world, _piv, _t, len + 0.4, _hit);
      if (h) arm = Math.max(1.5, h.distance - 0.4);
    }
    vc.arm = !vc.ready || !(vc.arm > 0) || arm < vc.arm ? arm : vc.arm + (arm - vc.arm) * (1 - Math.exp(-dt * 3));
    if (len > 1e-3) _p.copy(_piv).addScaledVector(_t, Math.min(vc.arm, len));
    if (!vc.ready) vc.pos.copy(_p);
    else vc.pos.lerp(_p, 1 - Math.exp(-dt * 18));
    if (world && typeof world.heightAt === 'function') {
      const g = world.heightAt(vc.pos.x, vc.pos.z);
      if (Number.isFinite(g) && vc.pos.y < g + 0.6) vc.pos.y = g + 0.6;
    }
    if (world) keepClear(world, vc.pos, 0.2);
    vc.ready = true;
    camera.position.copy(vc.pos);
    camera.up.set(0, 1, 0);
    _t.copy(_piv).addScaledVector(_d, 6);
    camera.lookAt(_t);
  }
  camera.getWorldDirection(vc.dir);
  const fov = clamp((2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) / vc.zoom) * 180) / Math.PI, 3, 120);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  return { sight: vc.sight, zoom: vc.zoom, view };
}
