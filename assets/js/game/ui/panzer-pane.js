// NULLPUNKT — Lobby-Reiter „Panzer“ (Nutzer 20.11.: eigener Reiter neben Einsatz/Ausrüstung/Fortschritt/Kampagne/Mehrspieler).
// Inhalt: Panzerauswahl (alle Kampfpanzer inkl. LP-21, LP-39, SP-45, SP-58) mit drehbarer Vorschau (Kastenmodell aus den
// Fahrzeugdaten – Wanne, Turm, Rohr, Laufwerk; ziehen zum Drehen) und Kurzinfo (Kaliber, Panzerung vorn, Sicht, Besatzung,
// Gewicht, Tempo), Karte (nur Großkarten mit Panzermodus), Rolle, Spielart, Führung, Feindkräfte; Start über den Fußknopf
// (data-act pz-start → start()) bzw. den Knopf im Reiter; Einstieg in die Panzer-Kampagne „Eisenwind“ (Reiter Kampagne).
// Einstellungen wie bisher in settings.modeOptions.panzer (modes/panzer.js liest sie), Karte in settings.lastPanzerMap.
// Startseite: spielen.html?tab=panzer öffnet die Lobby in diesem Reiter (ui/lobby.js).
import { VEHICLES } from '../vehicles/data.js?v=20261123073102';
import { armorOf, caliberOf } from '../vehicles/psim/ammo.js?v=20261123073102';
import { modeOptionValues } from '../../shared/modes.data.js?v=20261123073102';
import { drawMapArt } from './mapart.js?v=20261123073102';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TANKS = ['mbt', 'spz', 'lp21', 'kk', 'kks', 'wk2', 'wk2m', 'wk2h', 'wk2s', 'wk2l', 'wk2j', 'wk1', 'wk1l'];
const ERA_NAME = { modern: 'Modern', kk: 'Kalter Krieg', wk2: '2. Weltkrieg', wk1: '1. Weltkrieg' };
const ROLES = [['kommandant', 'Kommandant'], ['richtschuetze', 'Richtschütze'], ['fahrer', 'Fahrer'], ['ladeschuetze', 'Ladeschütze'], ['mgschuetze', 'MG-Schütze']];
const ENEMY_INF = { leicht: 6, mittel: 10, schwer: 16 };

const CSS = `
.lb[data-tab="panzer"] .lb-side{display:none}
.lb[data-tab="panzer"] .lb-main{grid-template-columns:minmax(0,1fr)}
.pz-pane{display:grid;grid-template-columns:minmax(260px,1fr) minmax(300px,1.15fr);gap:16px;padding:4px 2px 18px}
.pz-pane h2{margin:0 0 8px}
.pz-hero{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:10px 20px;padding:12px 16px;border:1px solid var(--np-line,rgba(233,230,223,.12));background:linear-gradient(110deg,rgba(255,91,31,.13),rgba(10,11,13,.4) 55%)}
.pz-hero small{display:block;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--np-signal,#ff5b1f)}
.pz-hero b{display:block;font-size:clamp(20px,2.6vw,30px);letter-spacing:.06em;text-transform:uppercase}
.pz-hero p{margin:2px 0 0;color:var(--np-ink-2,#b9b5ac);font-size:13.5px;max-width:620px;line-height:1.4}
.pz-hero .m-btn{margin-left:auto}
.pz-tanks{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.pz-tank{display:flex;flex-direction:column;align-items:flex-start;gap:1px;min-height:52px;padding:7px 10px;border:1px solid var(--np-line,rgba(233,230,223,.12));background:rgba(10,11,13,.55);color:inherit;font:inherit;text-align:left;cursor:pointer}
.pz-tank b{font-size:14px;letter-spacing:.03em}.pz-tank small{font-size:11.5px;opacity:.7}
.pz-tank[aria-pressed="true"],.pz-map[aria-pressed="true"]{border-color:var(--np-signal,#ff5b1f);background:rgba(255,91,31,.14)}
.pz-tank:focus-visible,.pz-map:focus-visible,.pz-seg button:focus-visible{outline:2px solid var(--np-signal,#ff5b1f);outline-offset:1px}
.pz-era{grid-column:1/-1;margin:6px 0 0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--np-ink-2,#b9b5ac)}
.pz-view{position:relative;border:1px solid var(--np-line,rgba(233,230,223,.12));background:radial-gradient(ellipse at 50% 70%,rgba(80,86,70,.35),rgba(10,11,13,.75) 70%);touch-action:none;cursor:grab}
.pz-view canvas{display:block;width:100%;height:220px}
.pz-view i{position:absolute;right:8px;bottom:6px;font-style:normal;font-size:11px;opacity:.55;letter-spacing:.08em}
.pz-info{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:4px 12px;margin:10px 0 4px;font-size:13px}
.pz-info span{display:flex;flex-direction:column}.pz-info small{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;opacity:.6}
.pz-desc{margin:6px 0 0;font-size:13px;color:var(--np-ink-2,#b9b5ac);line-height:1.4}
.pz-maps{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}
.pz-map{position:relative;padding:0;border:1px solid var(--np-line,rgba(233,230,223,.12));background:rgba(10,11,13,.55);color:inherit;font:inherit;cursor:pointer;text-align:left;overflow:hidden}
.pz-map canvas{display:block;width:100%;height:64px}
.pz-map span{display:block;padding:4px 8px;font-size:13px}
.pz-opts{display:grid;gap:10px;margin-top:12px}
.pz-opts label{display:block;font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.7;margin-bottom:4px}
.pz-seg{display:flex;flex-wrap:wrap;gap:4px}
.pz-seg button{min-height:38px;padding:0 12px;border:1px solid var(--np-line,rgba(233,230,223,.12));background:rgba(10,11,13,.55);color:inherit;font:inherit;font-size:13.5px;cursor:pointer}
.pz-seg button[aria-pressed="true"]{border-color:var(--np-signal,#ff5b1f);background:rgba(255,91,31,.16)}
.pz-hint{font-size:12px;opacity:.75;margin-top:3px;line-height:1.35}
.pz-go{margin-top:14px}
@media (max-width:820px){.pz-pane{grid-template-columns:1fr}.pz-view canvas{height:170px}.pz-tanks{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}.pz-hero .m-btn{margin-left:0}}
`;

function ensureCss() {
  if (typeof document === 'undefined' || document.getElementById('pz-pane-css')) return;
  const st = document.createElement('style'); st.id = 'pz-pane-css'; st.textContent = CSS; document.head.appendChild(st);
}

/** Kurzwerte eines Panzers für die Karte/Info. */
export function tankInfo(id) {
  const D = VEHICLES[id];
  if (!D) return null;
  const era = D.era || 'modern';
  const A = armorOf(D), f = (A.hull && A.hull.front) || [0, 0], tf = (A.turret && A.turret.front) || f;
  const mm = (p) => (Array.isArray(p) ? p[0] : p.ke || p.mm || 0);
  const sp = D.engine && D.engine.maxSpeed ? Math.round(D.engine.maxSpeed * 3.6) : null;
  const gun = id === 'spz' ? '30 mm + Lenkflugkörper' : `${caliberOf(D)} mm`;
  return {
    id, name: D.name, cls: D.cls || 'Panzer', era, eraName: ERA_NAME[era] || era, gun,
    armor: `Wanne ${mm(f)} mm · Turm ${mm(tf)} mm`, sight: D.noThermal ? 'Optik, Winkelspiegel' : 'Wärmebild, Restlicht, Winkelspiegel',
    crew: D.seats.filter((s) => !/^schuetze/.test(s.id)).map((s) => s.label).join(', '), crewN: D.seats.length,
    mass: D.mass ? `${Math.round(D.mass / 1000)} t` : '–', speed: sp ? `${sp} km/h` : '–',
    mg: D.seats.some((s) => s.id === 'funker' || s.id === 'mg'),
  };
}

/** Drehbare Kastenansicht (Wanne, Turm, Rohr, Ketten) aus hullBox/turretBox/muzzle – ohne WebGL. */
function drawTank(cv, D, yaw, pitch = 0.42) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.max(10, Math.round(r.width * dpr)), H = Math.max(10, Math.round(r.height * dpr));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  if (!D) return;
  const hb = D.hullBox, tb = D.turretBox, tp = D.turretPivot || [0, hb[1] + hb[4], 0];
  const boxes = [];
  const box = (cx, cy, cz, hx, hy, hz, col, taper = 1) => boxes.push({ c: [cx, cy, cz], h: [hx, hy, hz], col, taper });
  const wy = D.wheels ? D.wheels.radius : 0.35, tx = D.wheels ? D.wheels.x : hb[3] * 0.8;
  for (const s of [-1, 1]) box(s * tx, wy, hb[2], 0.28, wy, hb[5] * 0.96, '#2b2b27');
  box(hb[0], hb[1], hb[2], hb[3], hb[4], hb[5], '#6c6f55');
  const tur = D.turretLimits ? null : tb;
  if (tur) box(tp[0] + tur[0], tp[1] + tur[1], tp[2] + tur[2], tur[3], tur[4], tur[5], '#7a7d61', 0.82);
  const gp = D.gunPivot || [0, 0.4, -1], mz = D.muzzle || [0, 0, -4];
  const gl = Math.abs(mz[2]);
  box(tp[0] + gp[0], tp[1] + gp[1], tp[2] + gp[2] - gl / 2, 0.07, 0.07, gl / 2, '#4d4f3e');
  const span = Math.max(hb[5] + 0.5, gl / 2 + Math.abs(tp[2] + gp[2]) * 0.5 + 1);
  const sc = Math.min(W, H * 1.9) / (span * 2.6);
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), spp = Math.sin(pitch);
  const P = (x, y, z) => { const X = x * cy - z * sy, Z = x * sy + z * cy; const Y = y * cp - Z * spp, D2 = -(y * spp + Z * cp); /* Tiefe: größer = weiter weg */ return [W / 2 + X * sc, H * 0.62 - Y * sc, D2]; };
  const L = [0.45, 0.8, 0.35]; const ln = Math.hypot(...L);
  const faces = [];
  for (const b of boxes) {
    const [x, y, z] = b.c, [hx, hy, hz] = b.h, t = b.taper;
    const v = (sx, sy2, sz) => { const k = sy2 > 0 ? t : 1; return [x + sx * hx * k, y + sy2 * hy, z + sz * hz * k]; };
    const quads = [[[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [0, 0, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1], [0, 0, -1]],
      [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1], [1, 0, 0]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, 0, 0]], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1], [0, 1, 0]]];
    for (const q of quads) {
      const pts = q.slice(0, 4).map((s) => P(...v(...s)));
      const n = q[4];
      const nx = n[0] * cy - n[2] * sy, nz = n[0] * sy + n[2] * cy, ny = n[1] * cp - nz * spp, nd = -(n[1] * spp + nz * cp);
      if (nd > 0.02) continue; // abgewandt
      const lit = 0.45 + 0.55 * Math.max(0, (nx * L[0] + ny * L[1] - nd * L[2]) / ln);
      faces.push({ pts, d: pts.reduce((a, p) => a + p[2], 0) / 4, col: b.col, lit });
    }
  }
  faces.sort((a, b) => b.d - a.d);
  // Schatten
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(W / 2, H * 0.62 + 4, hb[3] * sc * 1.25 + Math.abs(sy) * hb[5] * sc * 0.6, sc * 0.5, 0, 0, Math.PI * 2); g.fill();
  for (const f of faces) {
    g.beginPath(); f.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
    const c = parseInt(f.col.slice(1), 16), k = f.lit;
    g.fillStyle = `rgb(${((c >> 16) & 255) * k | 0},${((c >> 8) & 255) * k | 0},${(c & 255) * k | 0})`;
    g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
  }
}

export class PanzerPane {
  constructor(lobby) {
    this.lobby = lobby;
    this.G = lobby.G;
    this.el = null;
    this.yaw = 0.7;
    this._raf = 0;
  }

  get menus() { return this.lobby.menus; }

  opts() {
    let raw = {};
    try { raw = { ...((this.G.settings.get('modeOptions') || {}).panzer || {}) }; } catch { raw = {}; }
    return modeOptionValues('panzer', raw);
  }

  tank() { const t = this.opts().panzer; return VEHICLES[t] && TANKS.includes(t) ? t : 'mbt'; }

  maps() { return this.lobby.mapsFor('panzer'); }

  map() {
    let m = null;
    try { m = this.G.settings.get('lastPanzerMap'); } catch { m = null; }
    const L = this.maps();
    return L.includes(m) ? m : L.includes('grenzland') ? 'grenzland' : L[0];
  }

  mount(el) {
    ensureCss();
    this.el = el;
    this.render();
  }

  unmount() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; this.el = null; }

  /** Klick im Reiter (lobby.js leitet weiter). → true, wenn verarbeitet. */
  click(b) {
    const ds = b.dataset, M = this.menus;
    if (ds.pzt) { this.lobby._setModeOpt('panzer', 'panzer', ds.pzt); M.sound('click'); this.render(); return true; }
    if (ds.pzm) { try { this.G.settings.set('lastPanzerMap', ds.pzm); } catch { /* */ } M.sound('click'); this.render(); return true; }
    if (ds.pzo) { this.lobby._setModeOpt('panzer', ds.pzo, ds.v); M.sound('click'); this.render(); return true; }
    if (ds.pzgo != null) { this.start(b); return true; }
    if (ds.pzcamp != null) { this.lobby.tab = 'kampagne'; if (this.lobby.campaign) this.lobby.campaign.which = 'panzer'; this.lobby._syncTab(); M.sound('click'); return true; }
    return false;
  }

  /** Panzermodus starten (Modus/Karte nur für diesen Start; der Reiter Einsatz behält seine Wahl). */
  start(btn) {
    const L = this.lobby, M = this.menus, c = L.cfg;
    if (!M.onStart) return false;
    const keep = { modeId: c.modeId, mapId: c.mapId, allies: c.allies, enemies: c.enemies, balance: c.balance };
    const o = this.opts();
    if (o.panzer !== this.tank()) this.lobby._setModeOpt('panzer', 'panzer', this.tank()); // „Nach Karte“ → sichtbarer Panzer
    Object.assign(c, { modeId: 'panzer', mapId: this.map(), allies: 0, enemies: ENEMY_INF[o.gegner] ?? 10, balance: false });
    try { M._start(btn || L.el.start); } finally { Object.assign(c, keep); }
    return true;
  }

  footLabel() { const i = tankInfo(this.tank()); return `Panzer starten${i ? ` · ${i.name}` : ''}`; }

  summaryHtml() {
    const o = this.opts(), i = tankInfo(this.tank()), maps = (this.G.data && this.G.data.MAPS) || {};
    const role = (ROLES.find((r) => r[0] === o.rolle) || ROLES[0])[1];
    return `<small>PZR · ${esc((maps[this.map()] || {}).name || this.map())}</small><b>${esc(i ? i.name : 'Panzer')}</b><span>${o.stil === 'arcade' ? 'Arcade' : `Simulation · ${esc(role)}`} · Feind ${esc(o.gegner)}</span>`;
  }

  render() {
    const el = this.el;
    if (!el) return;
    const o = this.opts(), t = this.tank(), I = tankInfo(t), D = VEHICLES[t];
    const maps = (this.G.data && this.G.data.MAPS) || {}, mapSel = this.map();
    const seg = (k, list, cur) => `<div class="pz-seg" role="radiogroup">${list.map(([id, n]) => `<button type="button" role="radio" data-pzo="${k}" data-v="${id}" aria-pressed="${id === cur}" aria-checked="${id === cur}">${esc(n)}</button>`).join('')}</div>`;
    let lastEra = null;
    const tanks = TANKS.filter((id) => VEHICLES[id]).map((id) => {
      const x = tankInfo(id);
      const head = x.era !== lastEra ? `<p class="pz-era">${esc(x.eraName)}</p>` : '';
      lastEra = x.era;
      return `${head}<button type="button" class="pz-tank" data-pzt="${id}" aria-pressed="${id === t}"><b>${esc(x.name)}</b><small>${esc(x.cls)} · ${esc(x.gun)}</small></button>`;
    }).join('');
    const mapBtns = this.maps().map((id) => `<button type="button" class="pz-map" data-pzm="${id}" aria-pressed="${id === mapSel}"><canvas data-pzart="${id}"></canvas><span>${esc((maps[id] || {}).name || id)}</span></button>`).join('');
    const roleHint = o.stil === 'arcade' ? 'Arcade: du fährst und schießt; Platzwechsel Richtschütze ↔ Fahrer ↔ Kommandant mit dem Sitzrad (K halten).'
      : o.rolle === 'mgschuetze' && !I.mg ? 'Dieser Panzer hat kein Bug-MG – du sitzt als Kommandant am (fernbedienten) MG.' : 'Startplatz. Im Einsatz wechselst du mit dem Sitzrad (K halten), am Controller ◀/▶, Touch „Sitz“.';
    el.innerHTML = `<div class="pz-pane">
      <section class="pz-hero"><div><small>Panzersimulation</small><b>Eine Besatzung, ein Auftrag</b><p>Wähle Panzer, Karte und deinen Platz. Die KI besetzt den Rest der Besatzung; Winkelspiegel, Optiken und Innenräume für jeden Platz.</p></div>
        <button type="button" class="m-btn" data-pzcamp>Panzer-Kampagne „Eisenwind“ →</button></section>
      <section><h2 class="m-h2">Panzer</h2><div class="pz-tanks" role="group" aria-label="Panzer">${tanks}</div></section>
      <section>
        <div class="pz-view" aria-label="Panzervorschau – ziehen zum Drehen"><canvas class="pz-cv"></canvas><i>Ziehen zum Drehen</i></div>
        <div class="pz-info">
          <span><small>Panzer</small>${esc(I.name)}</span><span><small>Klasse</small>${esc(I.cls)} · ${esc(I.eraName)}</span>
          <span><small>Kaliber</small>${esc(I.gun)}</span><span><small>Panzerung vorn</small>${esc(I.armor)}</span>
          <span><small>Sicht</small>${esc(I.sight)}</span><span><small>Gewicht · Tempo</small>${esc(I.mass)} · ${esc(I.speed)}</span>
          <span style="grid-column:1/-1"><small>Besatzung (${I.crewN})</small>${esc(I.crew)}</span>
        </div>
        <div class="pz-opts">
          <div><label>Karte</label><div class="pz-maps" role="group" aria-label="Karte">${mapBtns}</div></div>
          <div><label>Deine Rolle</label>${seg('rolle', ROLES, o.rolle)}<div class="pz-hint">${esc(roleHint)}</div></div>
          <div><label>Spielart</label>${seg('stil', [['simulation', 'Simulation'], ['arcade', 'Arcade']], o.stil)}<div class="pz-hint">${o.stil === 'arcade' ? 'Fahren und schießen zugleich, Automatiklader, Außenansicht.' : 'Jeder Handgriff selbst, keine Außenansicht.'}</div></div>
          ${o.stil === 'simulation' ? `<div><label>Führung</label>${seg('fuehrung', [['tutorial', 'Tutorial'], ['hilfe', 'Hilfe auf Anfrage'], ['aus', 'Aus']], o.fuehrung)}</div>` : ''}
          <div><label>Feindkräfte</label>${seg('gegner', [['leicht', 'Leicht'], ['mittel', 'Mittel'], ['schwer', 'Schwer']], o.gegner)}<div class="pz-hint">Leicht: 2 Panzer, 1 Pak, 1 Bunker · Mittel: 3/2/2 · Schwer: 5/3/2 – dazu Infanterie.</div></div>
        </div>
        <button type="button" class="m-btn m-primary pz-go" data-pzgo>Panzer starten</button>
      </section>
    </div>`;
    void D;
    requestAnimationFrame(() => {
      if (!this.el) return;
      this.el.querySelectorAll('canvas[data-pzart]').forEach((cv) => { try { if (cv.offsetParent) drawMapArt(cv, maps[cv.dataset.pzart]); } catch { /* */ } });
      this._bindView();
    });
    this.lobby._renderSummary();
    this.lobby._renderStart();
  }

  _bindView() {
    const view = this.el && this.el.querySelector('.pz-view'), cv = view && view.querySelector('canvas');
    if (!cv) return;
    const D = VEHICLES[this.tank()];
    let drag = null, idle = 0;
    const draw = () => drawTank(cv, D, this.yaw);
    view.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y0: this.yaw }; try { view.setPointerCapture(e.pointerId); } catch { /* */ } });
    view.addEventListener('pointermove', (e) => { if (!drag) return; this.yaw = drag.y0 + (e.clientX - drag.x) * 0.012; idle = 0; draw(); });
    const up = () => { drag = null; };
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
    if (this._raf) cancelAnimationFrame(this._raf);
    let last = performance.now();
    const tick = (now) => {
      if (!this.el || !cv.isConnected) { this._raf = 0; return; }
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      idle += dt;
      if (!drag && idle > 2) { this.yaw += dt * 0.35; draw(); }
      this._raf = requestAnimationFrame(tick);
    };
    draw();
    this._raf = requestAnimationFrame(tick);
  }
}
