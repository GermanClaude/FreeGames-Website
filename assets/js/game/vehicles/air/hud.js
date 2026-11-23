// NULLPUNKT — Flug-HUD (Kanvas über dem Spielbild): Leiter mit Horizont (rollt mit), Flugbahnmarker, Nasenkreuz,
// Fahrt- und Höhenband, Steigrate, Kursband, Schub/Kollektiv, Drehzahl, Lastvielfaches/Anstellwinkel (Jet), Täuschkörper,
// Zielmarke der gewählten Waffe (Kanone/Raketen: Strahl, Bomben: berechneter Aufschlagpunkt), Warnungen (Boden,
// Strömungsabriss, Raketenwarnung, Luftraum, Ausfälle, Luftstart). Bordschütze: Zieloptik mit Entfernung und Turmlage.
// Dazu die Touch-Knöpfe der Flugsteuerung (input.js verarbeitet .tc-btn[data-action] selbst). Weapons/Sitze/Zustand
// zeigt weiter die Fahrzeugtafel (vehicles/hud.js).
import * as THREE from 'three';
import { compass, tx } from '../../../shared/i18n.js?v=20261123073102';

const CSS = `
.ah-cv{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3}
.ah-cv[hidden]{display:none}
.va-btn{display:none}
body[data-vehicle-air] .va-btn.va-pilot{display:grid}
body[data-vehicle-air]:not([data-air-pilot="1"]) .va-btn.va-pilot{display:none}
body[data-vehicle-air="heli"] .va-btn.va-jet,body[data-vehicle-air="jet"] .va-btn.va-heli{display:none!important}
body[data-vehicle-air] .vc-btn.vc-gas,body[data-vehicle-air] .vc-btn.vc-brake,body[data-vehicle-air] .vc-btn.vc-light{display:none!important}
body[data-vehicle-air] .vh-ret,body[data-vehicle-air] .vh-gun{display:none!important}
.va-up{--s:60;left:calc(3% + env(safe-area-inset-left));bottom:calc(58% + env(safe-area-inset-bottom));border-radius:14px}
.va-down{--s:56;left:calc(3% + env(safe-area-inset-left) + var(--tc-u) * 70);bottom:calc(60% + env(safe-area-inset-bottom));border-radius:14px}
.va-hover{--s:52;right:calc(2.2% + env(safe-area-inset-right) + var(--tc-u) * 86);bottom:calc(46% + env(safe-area-inset-bottom))}
.va-boost{--s:52;right:calc(2.2% + env(safe-area-inset-right) + var(--tc-u) * 150);bottom:calc(30% + env(safe-area-inset-bottom))}
.va-flare{--s:52;right:calc(2.2% + env(safe-area-inset-right) + var(--tc-u) * 86);bottom:calc(30% + env(safe-area-inset-bottom));border-color:rgba(255,194,61,.85)}
`;

const TOUCH = [
  ['va-up', 'v_gas', 'Stei-<br>gen', 'va-pilot va-heli'],
  ['va-down', 'v_brake', 'Sin-<br>ken', 'va-pilot va-heli'],
  ['va-up', 'v_gas', 'Schub<br>+', 'va-pilot va-jet'],
  ['va-down', 'v_brake', 'Schub<br>−', 'va-pilot va-jet'],
  ['va-hover', 'v_hover', 'Schwe-<br>ben', 'va-pilot va-heli'],
  ['va-hover', 'v_hover', 'Brem-<br>se', 'va-pilot va-jet'],
  ['va-boost', 'v_boost', 'Nach-<br>brenner', 'va-pilot va-jet'],
  ['va-flare', 'v_flare', 'Täusch-<br>körper', 'va-pilot'],
];

const COL = '#8dffa8', COLW = '#ffd34a', COLR = '#ff5a3c';
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class AirHUD {
  constructor(sys) {
    this.sys = sys;
    this.G = sys.G;
    this._c = {};
    this.t = 0;
    if (!document.getElementById('air-hud-css')) {
      const st = document.createElement('style'); st.id = 'air-hud-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const host = document.getElementById('hud') || document.body;
    this.cv = document.createElement('canvas');
    this.cv.className = 'ah-cv';
    this.cv.hidden = true;
    host.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.touch = [];
    const tui = document.getElementById('touch-ui');
    if (tui) {
      for (const [cls, action, label, extra] of TOUCH) {
        const b = document.createElement('div');
        b.className = `tc-btn vc-btn va-btn ${cls} ${extra}`;
        b.dataset.action = action;
        b.setAttribute('role', 'button');
        // Getrennte Wörter („Stei-<br>gen“) erreicht die Seitenübersetzung nicht (zwei Textknoten) → hier übersetzen
        const plain = label.replace(/-<br>/g, '').replace(/<br>/g, ' '), tr = tx(plain, 'touch');
        b.setAttribute('aria-label', tr);
        b.innerHTML = `<span>${tr !== plain ? String(tr).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) : label}</span>`;
        tui.appendChild(b);
        this.touch.push(b);
      }
    }
    this._scr = { x: 0, y: 0, on: false };
  }

  _body(key, val) {
    const d = document.body.dataset;
    if (this._c[key] === val) return;
    this._c[key] = val;
    if (val == null) delete d[key]; else d[key] = val;
  }

  _project(p, out = this._scr) {
    const cam = this.G.camera;
    _d.copy(p).project(cam);
    out.on = _d.z < 1 && _d.z > -1;
    out.x = (_d.x * 0.5 + 0.5) * this.w;
    out.y = (-_d.y * 0.5 + 0.5) * this.h;
    return out;
  }

  hide() {
    if (!this.cv.hidden) this.cv.hidden = true;
    this._body('vehicleAir', null);
    this._body('airPilot', null);
  }

  /** s = Zustand aus VehicleSystem._updatePlayer (seated, vehicle, seat, view, sight, visible). */
  update(dt, s) {
    const v = s && s.seated ? s.vehicle : null;
    if (!v || !v.isAircraft || s.visible === false) { this.hide(); return; }
    this.t += dt;
    const seat = s.seat;
    const pilot = !!seat.def.drive;
    this._body('vehicleAir', v.air);
    this._body('airPilot', pilot ? '1' : '0');
    const cv = this.cv;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    this.w = W; this.h = H;
    if (cv.hidden) cv.hidden = false;
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    this.G.camera.updateMatrixWorld();
    const sc = clamp(Math.min(W, H) / 820, 0.62, 1.25);
    g.lineWidth = 1.6 * sc;
    g.font = `600 ${Math.round(14 * sc)}px ui-monospace,Consolas,monospace`;
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 3;
    const view = s.view || {};
    if (!pilot && view.overlay === 'airgun') this._gunner(g, v, seat, s, sc);
    else if (pilot) this._pilot(g, v, seat, s, sc);
    else this._passenger(g, v, sc);
    this._warnings(g, v, pilot, sc);
  }

  /* ------------------------------------------------------------------ Pilot */

  _pilot(g, v, seat, s, sc) {
    const b = v.body, W = this.w, H = this.h, cam = this.G.camera;
    const tp = !!(s.view && s.view.tp);
    g.strokeStyle = COL; g.fillStyle = COL;
    const cp = cam.position;
    // Nasenkreuz (Bohrachse) und Flugbahnmarker
    b.forward(_f);
    const nose = this._project(_a.copy(b.renderPos).addScaledVector(_f, 800), { x: 0, y: 0, on: false });
    const V = b.vel.length();
    let fpm = null;
    if (V > 3) { fpm = this._project(_b.copy(b.renderPos).addScaledVector(b.vel, 800 / V), { x: 0, y: 0, on: false }); }
    // Leiter: Horizont + 10°-Stufen entlang des Nasenkurses
    const yaw = Math.atan2(-_f.x, -_f.z);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw); // rechts (waagerecht)
    const ladder = (deg) => {
      const p = (deg * Math.PI) / 180, c = Math.cos(p);
      _c.set(cp.x - Math.sin(yaw) * c * 1000, cp.y + Math.sin(p) * 1000, cp.z - Math.cos(yaw) * c * 1000);
      const half = deg === 0 ? 260 : 70, gap = deg === 0 ? 70 : 26;
      const L1 = this._project(_a.copy(_c).addScaledVector(_d.set(rx, 0, rz), -half), { x: 0, y: 0, on: false });
      const L2 = this._project(_a.copy(_c).addScaledVector(_d.set(rx, 0, rz), -gap), { x: 0, y: 0, on: false });
      const R1 = this._project(_a.copy(_c).addScaledVector(_d.set(rx, 0, rz), gap), { x: 0, y: 0, on: false });
      const R2 = this._project(_a.copy(_c).addScaledVector(_d.set(rx, 0, rz), half), { x: 0, y: 0, on: false });
      if (!L1.on || !R2.on) return;
      g.beginPath();
      if (deg < 0) g.setLineDash([6 * sc, 5 * sc]); else g.setLineDash([]);
      g.moveTo(L1.x, L1.y); g.lineTo(L2.x, L2.y); g.moveTo(R1.x, R1.y); g.lineTo(R2.x, R2.y);
      g.stroke();
      g.setLineDash([]);
      if (deg) { g.textAlign = 'left'; g.fillText(String(Math.abs(deg)), R2.x + 6 * sc, R2.y); g.textAlign = 'right'; g.fillText(String(Math.abs(deg)), L1.x - 6 * sc, L1.y); }
    };
    g.save();
    g.beginPath(); g.rect(W * 0.2, H * 0.12, W * 0.6, H * 0.72); g.clip();
    for (let d = -60; d <= 60; d += 10) ladder(d);
    g.restore();
    // Nasenkreuz
    if (nose.on) {
      g.beginPath();
      g.moveTo(nose.x - 22 * sc, nose.y); g.lineTo(nose.x - 8 * sc, nose.y); g.lineTo(nose.x - 4 * sc, nose.y + 6 * sc);
      g.moveTo(nose.x + 22 * sc, nose.y); g.lineTo(nose.x + 8 * sc, nose.y); g.lineTo(nose.x + 4 * sc, nose.y + 6 * sc);
      g.stroke();
    }
    if (fpm && fpm.on && v.air === 'jet') {
      g.beginPath(); g.arc(fpm.x, fpm.y, 7 * sc, 0, Math.PI * 2);
      g.moveTo(fpm.x - 7 * sc, fpm.y); g.lineTo(fpm.x - 18 * sc, fpm.y); g.moveTo(fpm.x + 7 * sc, fpm.y); g.lineTo(fpm.x + 18 * sc, fpm.y);
      g.moveTo(fpm.x, fpm.y - 7 * sc); g.lineTo(fpm.x, fpm.y - 14 * sc); g.stroke();
    }
    // Zielmarke der gewählten Waffe
    const w = seat.weapons[seat.weaponIndex];
    if (w) this._pipper(g, v, seat, w, sc, fpm);
    // Bänder: Fahrt links, Höhe rechts, Kurs oben
    const kmh = Math.round(V * 3.6);
    this._tape(g, W * 0.24, H * 0.5, sc, kmh, 50, 'KM/H', true);
    this._tape(g, W * 0.76, H * 0.5, sc, Math.round(b.agl), v.air === 'jet' ? 50 : 10, 'M', false);
    g.textAlign = 'left';
    g.fillText(`${b.vs >= 0 ? '▲' : '▼'} ${Math.abs(b.vs).toFixed(1).replace('.', ',')} m/s`, W * 0.76 + 6 * sc, H * 0.5 + 92 * sc);
    this._heading(g, W * 0.5, H * 0.11, sc, yaw);
    // Leistung, Lage, Täuschkörper (links unten über der Fahrt)
    const x0 = W * 0.24 - 54 * sc, y0 = H * 0.5 + 118 * sc;
    g.textAlign = 'left';
    if (v.air === 'heli') {
      g.fillText(`ROTOR ${Math.round(b.rpm * 100)} %`, x0, y0);
      const col = clamp(0.5 + (seat.intent.throttle || 0) * 0.5, 0, 1);
      this._bar(g, x0, y0 + 16 * sc, 90 * sc, col, 'KOLL');
      g.fillText(`TK ${v.flares.left}`, x0, y0 + 48 * sc);
    } else {
      g.fillStyle = b.ab > 0.1 ? COLW : COL;
      g.fillText(`SCHUB ${Math.round(b.thr * 100)} %${b.ab > 0.1 ? ' NB' : ''}`, x0, y0);
      g.fillStyle = COL;
      this._bar(g, x0, y0 + 16 * sc, 90 * sc, b.thr, '');
      g.fillText(`G ${b.gload.toFixed(1).replace('.', ',')}   α ${Math.round((b.aoa * 180) / Math.PI)}°`, x0, y0 + 36 * sc);
      g.fillText(`TK ${v.flares.left}`, x0, y0 + 54 * sc);
    }
    void tp;
  }

  _pipper(g, v, seat, w, sc, fpm) {
    const def = w.def;
    g.strokeStyle = COL; g.fillStyle = COL;
    if (def.kind === 'bomb') {
      // Aufschlagpunkt: Bahn ab dem Flugzeug (Geschwindigkeit + Schwerkraft) gegen den Boden
      const b = v.body, world = this.sys.world;
      _a.copy(b.renderPos); _b.copy(b.vel);
      let hit = null;
      for (let i = 0; i < 80 && world; i++) {
        const h = 0.25;
        _c.copy(_a);
        _b.y -= (def.gravity || 9.81) * h;
        _a.addScaledVector(_b, h);
        const gy = typeof world.heightAt === 'function' ? world.heightAt(_a.x, _a.z) : null;
        if (Number.isFinite(gy) && _a.y <= gy) { hit = _a.clone(); hit.y = gy; break; }
      }
      if (hit) {
        const p = this._project(hit, { x: 0, y: 0, on: false });
        if (p.on) {
          g.beginPath(); g.arc(p.x, p.y, 12 * sc, 0, Math.PI * 2); g.stroke();
          g.beginPath(); g.arc(p.x, p.y, 2 * sc, 0, Math.PI * 2); g.fill();
          if (fpm && fpm.on) { g.setLineDash([4 * sc, 4 * sc]); g.beginPath(); g.moveTo(fpm.x, fpm.y); g.lineTo(p.x, p.y); g.stroke(); g.setLineDash([]); }
        }
      }
      return;
    }
    v.muzzle(seat.index, _a, _b, true);
    const range = def.range || 900;
    const sys = this.sys;
    sys._ignore = v;
    const h = sys._rc ? sys._rc.orig.call(sys.world, _a, _b, range) : null;
    sys._ignore = null;
    const dist = h ? h.distance : range;
    _c.copy(_a).addScaledVector(_b, dist);
    if (def.kind === 'rocket' && def.speed) { const t = dist / def.speed; _c.y -= 0.5 * (def.gravity || 0) * t * t; }
    const p = this._project(_c, { x: 0, y: 0, on: false });
    if (!p.on) return;
    const ready = v.canFire(seat.index);
    g.strokeStyle = ready ? COL : 'rgba(141,255,168,0.45)';
    g.beginPath();
    if (def.kind === 'rocket') { g.rect(p.x - 10 * sc, p.y - 10 * sc, 20 * sc, 20 * sc); g.moveTo(p.x, p.y - 16 * sc); g.lineTo(p.x, p.y - 10 * sc); g.moveTo(p.x, p.y + 10 * sc); g.lineTo(p.x, p.y + 16 * sc); }
    else { g.arc(p.x, p.y, 14 * sc, 0, Math.PI * 2); g.moveTo(p.x + 2, p.y); g.arc(p.x, p.y, 2 * sc, 0, Math.PI * 2); }
    g.stroke();
    g.textAlign = 'left';
    if (h) g.fillText(`${Math.round(dist)} m`, p.x + 18 * sc, p.y + 14 * sc);
  }

  _tape(g, x, y, sc, val, step, unit, left) {
    const hh = 90 * sc, px = 2.4 * sc / (step / 10);
    g.save();
    g.beginPath(); g.rect(x - 60 * sc, y - hh, 120 * sc, hh * 2); g.clip();
    g.strokeStyle = COL; g.fillStyle = COL;
    const base = Math.floor(val / step) * step;
    for (let k = -6; k <= 6; k++) {
      const v = base + k * step;
      const yy = y - (v - val) * px;
      g.beginPath();
      const d = left ? 1 : -1;
      g.moveTo(x, yy); g.lineTo(x + d * -10 * sc, yy); g.stroke();
      g.textAlign = left ? 'right' : 'left';
      if (v >= 0) g.fillText(String(v), x - d * 14 * sc, yy);
    }
    g.restore();
    g.strokeStyle = COL;
    g.beginPath(); g.moveTo(x, y - hh); g.lineTo(x, y + hh); g.stroke();
    // Wertkasten
    const bw = 64 * sc, bh = 22 * sc, bx = left ? x - bw - 12 * sc : x + 12 * sc;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(bx, y - bh / 2, bw, bh);
    g.strokeRect(bx, y - bh / 2, bw, bh);
    g.fillStyle = COL; g.textAlign = 'center'; g.fillText(String(val), bx + bw / 2, y);
    g.font = g.font.replace(/\d+px/, `${Math.round(11 * sc)}px`);
    g.fillText(unit, bx + bw / 2, y - hh - 10 * sc);
    g.font = g.font.replace(/\d+px/, `${Math.round(14 * sc)}px`);
  }

  _heading(g, x, y, sc, yaw) {
    let hdg = ((-yaw * 180) / Math.PI) % 360; if (hdg < 0) hdg += 360;
    const half = 160 * sc, px = 3.2 * sc;
    g.save();
    g.beginPath(); g.rect(x - half, y - 20 * sc, half * 2, 40 * sc); g.clip();
    g.strokeStyle = COL; g.fillStyle = COL; g.textAlign = 'center';
    const base = Math.floor(hdg / 5) * 5;
    for (let k = -12; k <= 12; k++) {
      const d = base + k * 5, xx = x + (d - hdg) * px;
      const dd = ((d % 360) + 360) % 360;
      g.beginPath(); g.moveTo(xx, y + 8 * sc); g.lineTo(xx, y + (dd % 10 === 0 ? 0 : 4) * sc); g.stroke();
      if (dd % 45 === 0) g.fillText(compass(dd), xx, y - 8 * sc);
      else if (dd % 15 === 0) g.fillText(String(dd / 10).padStart(2, '0'), xx, y - 8 * sc);
    }
    g.restore();
    g.beginPath(); g.moveTo(x, y + 10 * sc); g.lineTo(x - 5 * sc, y + 18 * sc); g.lineTo(x + 5 * sc, y + 18 * sc); g.closePath(); g.fill();
  }

  _bar(g, x, y, w, f, label) {
    g.strokeStyle = COL; g.strokeRect(x, y, w, 8);
    g.fillStyle = COL; g.fillRect(x + 1, y + 1, (w - 2) * clamp(f, 0, 1), 6);
    if (label) { g.textAlign = 'left'; g.fillText(label, x + w + 6, y + 4); }
  }

  /* ------------------------------------------------------------------ Bordschütze */

  _gunner(g, v, seat, s, sc) {
    const W = this.w, H = this.h, cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.42;
    // Optikrand + leichte Tönung
    g.save();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(30,60,40,0.10)'; g.fillRect(0, 0, W, H);
    g.beginPath(); g.rect(0, 0, W, H); g.arc(cx, cy, R, 0, Math.PI * 2, true); g.fillStyle = 'rgba(4,6,6,0.88)'; g.fill();
    g.restore();
    g.strokeStyle = '#e9f4ea'; g.fillStyle = '#e9f4ea';
    g.beginPath();
    g.moveTo(cx - R, cy); g.lineTo(cx - 18 * sc, cy); g.moveTo(cx + 18 * sc, cy); g.lineTo(cx + R, cy);
    g.moveTo(cx, cy - R); g.lineTo(cx, cy - 18 * sc); g.moveTo(cx, cy + 18 * sc); g.lineTo(cx, cy + R);
    g.rect(cx - 6 * sc, cy - 6 * sc, 12 * sc, 12 * sc);
    g.stroke();
    for (let k = 1; k <= 4; k++) { g.beginPath(); g.moveTo(cx - 6 * sc, cy + k * 26 * sc); g.lineTo(cx + 6 * sc, cy + k * 26 * sc); g.stroke(); }
    // Entfernung (Strahl der Optik)
    const sys = this.sys;
    const dir = sys.camera.dir;
    sys._ignore = v;
    const h = sys._rc ? sys._rc.orig.call(sys.world, this.G.camera.position, dir, 3000) : null;
    sys._ignore = null;
    g.textAlign = 'left';
    g.fillText(h ? `E ${Math.round(h.distance)} m` : 'E ––– m', cx + R * 0.45, cy + R * 0.7);
    g.fillText(`×${(s.zoom || 1).toFixed(1).replace('.', ',')}`, cx + R * 0.45, cy + R * 0.7 + 18 * sc);
    // Turmlage: Gier/Nicken relativ zum Rumpf
    const m = v.mount, lim = v.def.mgYawLimit || 2;
    const bx = cx - 90 * sc, by = cy + R * 0.86;
    g.strokeRect(bx, by, 180 * sc, 8 * sc);
    g.fillRect(bx + (0.5 - m.mgYaw / (2 * lim)) * 180 * sc - 2, by - 3, 4, 14 * sc);
    const lx = cx - R * 0.86, ly = cy - 60 * sc;
    g.strokeRect(lx, ly, 8 * sc, 120 * sc);
    const L = v.def.mgLimits || { min: -1, max: 0.3 };
    g.fillRect(lx - 3, ly + (1 - (m.mgPitch - L.min) / (L.max - L.min)) * 120 * sc - 2, 14 * sc, 4);
    const w = seat.weapons[seat.weaponIndex];
    if (w) { g.textAlign = 'right'; g.fillText(`${w.def.short || 'MK'} ${w.mag}${w.reloadT > 0 ? ' …' : ''}`, cx - R * 0.45, cy + R * 0.7); }
  }

  _passenger(g, v, sc) {
    const b = v.body;
    g.fillStyle = COL; g.textAlign = 'left';
    g.fillText(`${Math.round(b.vel.length() * 3.6)} km/h   ${Math.round(b.agl)} m`, 18 * sc, this.h * 0.18);
  }

  /* ------------------------------------------------------------------ Warnungen */

  _warnings(g, v, pilot, sc) {
    const b = v.body, now = this.G.time.elapsed;
    const list = [];
    if (!v.alive) list.push(['ABSTURZ', COLR]);
    if (v.threat > now) list.push(['RAKETENWARNUNG – TÄUSCHKÖRPER!', COLR]);
    if (v.alive && !b.onGround && b.vs < -6 && b.agl < Math.max(25, -b.vs * 3.2)) list.push([v.air === 'jet' ? 'ZIEHEN! BODEN' : 'BODEN – STEIGEN!', COLR]);
    if (v.air === 'jet' && b.stall > 0.25) list.push(['STRÖMUNGSABRISS', COLR]);
    if (v.zoneReturn) list.push(['LUFTRAUM VERLASSEN – AUTOPILOT KEHRT UM', COLW]);
    else if (v.zoneWarn > 0.2) list.push([`LUFTRAUM VERLASSEN – UMKEHREN (${Math.max(0, Math.ceil(5 - v.zoneWarn))})`, COLW]);
    if (v.zones.tracks && v.zones.tracks.hp <= 0) list.push([v.air === 'heli' ? 'HECKROTOR AUSGEFALLEN' : 'LEITWERK BESCHÄDIGT', COLW]);
    if (v.zones.engine && v.zones.engine.hp <= 0) list.push(['TRIEBWERK BESCHÄDIGT', COLW]);
    if (v.launchAt != null && pilot) list.push([`LUFTSTART IN ${Math.max(0, v.launchAt - now).toFixed(1).replace('.', ',')} s`, COLW]);
    if (pilot && v.air === 'heli' && b.onGround && b.rpm < 0.97 && v.alive) list.push([`ROTOR LÄUFT HOCH … ${Math.round(b.rpm * 100)} %`, COL]);
    if (!list.length) return;
    const blink = Math.floor(this.t * 3) % 2 === 0;
    g.textAlign = 'center';
    g.font = g.font.replace(/\d+px/, `${Math.round(17 * sc)}px`);
    list.slice(0, 3).forEach(([txt, col], i) => {
      if (col === COLR && !blink) return;
      g.fillStyle = col;
      g.fillText(txt, this.w / 2, this.h * 0.2 + i * 24 * sc);
    });
    g.font = g.font.replace(/\d+px/, `${Math.round(14 * sc)}px`);
  }

  dispose() {
    this.cv.remove();
    for (const b of this.touch) b.remove();
    this.touch = [];
    this.hide();
  }
}
