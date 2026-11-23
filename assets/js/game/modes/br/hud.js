// NULLPUNKT — Battle Royale: Anzeigen (ergänzen das normale HUD, ui/hud.js, über dessen Modus-Haken):
//   • Stand oben (hudScores/hudClock): „Übrig“ | Zonen-Uhr | eigene Abschüsse, darunter die Zonenzeile (hudSub): Phase, Zustand
//   • Ausrüstung unten links über dem Leben: Weste/Platten, Helm, Verbände, Granaten, Rauch
//   • Warnung außerhalb der Zone (Schaden/s, Richtung zur Zone) und ein leichter Rotschleier am Rand
//   • Hinweise beim Einstieg (Absprung, Schirm) und die große Karte (Einstieg automatisch, sonst Taste „Karte“ halten):
//     Kartenbild, aktuelle Zone, angekündigte Zone (gestrichelt), Flugroute mit Flugzeug, eigene Lage
//   • Minikarte (drawMinimap): Zone abgedunkelt, Kreis, nächster Kreis gestrichelt
// HUD-Stil (Einstellung hudStyle): „voll“ alles; „reduziert“ Ausrüstung nur kurz nach Änderungen bzw. mit gehaltener
// Punktetabelle; „aus“ (Bodycam) keine Zahlen – Ausrüstung und Karte nur auf Tastendruck, Zonenwarnung als Text.
// Alle Texte deutsch im Quelltext, übersetzt über tx() (shared/i18n.js, Tabelle tools/i18n/66-br.mjs).
import { tx } from '../../../shared/i18n.js?v=20261123082814';
import { VEST_NAMES, HELMET_NAMES } from './items.js?v=20261123082814';
import { bandagesOf } from './inventory.js?v=20261123082814';

const CSS = `
.br-hud { position: absolute; inset: 0; pointer-events: none; font-family: "Rajdhani NP", "Rajdhani", system-ui, sans-serif; color: var(--hud-ink, #e9e6df); text-shadow: var(--hud-shadow, 0 1px 2px rgba(0,0,0,.75)); }
.br-zone { display: flex; gap: 10px; align-items: baseline; padding: 1px 10px; background: var(--hud-bg, rgba(10,11,13,.58)); border-radius: 2px; font-size: 13px; letter-spacing: .06em; color: var(--np-ink-2, #c9c5bb); white-space: nowrap; text-transform: uppercase; }
.br-zone b { color: var(--hud-ink, #e9e6df); font-weight: 700; }
.br-zone.is-shrink b { color: #e0a060; }
.br-inv { position: absolute; left: var(--pad-l, 18px); bottom: calc(var(--pad-b, 18px) + 52px); display: flex; flex-wrap: wrap; gap: 4px; max-width: 300px; transition: opacity .25s; }
.br-inv span { padding: 1px 7px; background: var(--hud-bg, rgba(10,11,13,.58)); border-radius: 2px; font-size: 12px; letter-spacing: .05em; white-space: nowrap; }
.br-inv span.is-off { opacity: .45; }
.br-inv span b { font-weight: 700; margin-left: 3px; }
.br-warn { position: absolute; left: 50%; top: 31%; transform: translateX(-50%); padding: 3px 12px; background: rgba(40,12,8,.6); border-radius: 2px; font-size: 15px; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; color: #f0c2a8; }
.br-warn i { display: inline-block; font-style: normal; margin-left: 8px; transform-origin: 50% 55%; }
.br-veil { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(120,30,16,.42) 100%); opacity: 0; transition: opacity .6s; }
.br-veil.is-on { opacity: 1; }
.br-hint { position: absolute; left: 50%; bottom: 9%; transform: translateX(-50%); padding: 4px 14px; background: var(--hud-bg, rgba(10,11,13,.58)); border-radius: 2px; font-size: 16px; letter-spacing: .06em; white-space: nowrap; }
.br-hint kbd { font: inherit; font-weight: 700; padding: 0 5px; margin-right: 6px; border: 1px solid rgba(233,230,223,.5); border-radius: 2px; }
.br-map { position: absolute; left: 50%; top: 50%; width: min(62vmin, 560px); height: min(62vmin, 560px); transform: translate(-50%, -52%); border-radius: 3px; box-shadow: 0 0 0 1px rgba(233,230,223,.22), 0 8px 30px rgba(0,0,0,.5); background: #0d1013; }
.br-map canvas { width: 100%; height: 100%; display: block; }
.br-map small { position: absolute; left: 8px; top: 6px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--np-ink-2, #c9c5bb); }
.h-root[data-hud="aus"] .br-zone b.n { display: none; }
`;

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
const clock = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export class BrHud {
  constructor(mode) {
    this.mode = mode;
    this.G = mode.G;
    this.root = null;
    this._invKey = '';
    this._invShowT = 0;
    this._mapT = 0;
  }

  attach() {
    const G = this.G;
    const host = (G.hud && G.hud.root) || document.getElementById('hud');
    if (!host || typeof document === 'undefined') return;
    if (!document.getElementById('br-hud-css')) {
      const st = document.createElement('style');
      st.id = 'br-hud-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    const r = document.createElement('div');
    r.className = 'br-hud';
    r.innerHTML = '<div class="br-veil"></div><div class="br-inv"></div><div class="br-warn" hidden></div><div class="br-hint" hidden></div><div class="br-map" hidden><canvas></canvas><small></small></div>';
    host.appendChild(r);
    this.root = r;
    this.el = { veil: r.querySelector('.br-veil'), inv: r.querySelector('.br-inv'), warn: r.querySelector('.br-warn'), hint: r.querySelector('.br-hint'), map: r.querySelector('.br-map'), canvas: r.querySelector('.br-map canvas'), mapT: r.querySelector('.br-map small') };
  }

  detach() {
    if (this.root) this.root.remove();
    this.root = null;
  }

  _style() { const h = this.G.hud; return (h && h.style) || 'voll'; }
  _key(a) { const h = this.G.hud; try { return h && typeof h._keyFor === 'function' ? h._keyFor(a) : ''; } catch { return ''; } }

  /** Zeile unter dem Stand (ui/hud.js _buildModeSections). */
  sub() { return '<div class="br-zone"><span class="p"></span><b class="n"></b></div>'; }

  update(dt) {
    if (!this.root) return;
    const G = this.G, M = this.mode, P = G.player, z = M.zone;
    const style = this._style();
    const input = G.input;
    const held = (a) => !!(input && typeof input.down === 'function' && input.down(a));
    // --- Zonenzeile
    const zl = G.hud && G.hud.root ? G.hud.root.querySelector('.br-zone') : null;
    if (zl && z) {
      const i = z.info();
      const p = zl.querySelector('.p'), n = zl.querySelector('.n');
      const txt = M.dropPhase === 'plane' ? tx('Absetzphase') : i.state === 'ende' ? tx('Letzter Kreis') : i.state === 'schrumpfen' ? tx(`Phase ${i.phase}/${i.phases} · Zone schrumpft`) : tx(`Phase ${i.phase}/${i.phases} · Zone steht`);
      if (p.textContent !== txt) p.textContent = txt;
      const nt = i.state === 'ende' ? '' : clock(i.left);
      if (n.textContent !== nt) n.textContent = nt;
      zl.classList.toggle('is-shrink', i.state === 'schrumpfen');
    }
    // --- Ausrüstung
    const key = P && P.alive ? this._invKeyOf(P) : '';
    if (key !== this._invKey) { this._invKey = key; this._renderInv(P); this._invShowT = 5; }
    this._invShowT = Math.max(0, this._invShowT - dt);
    const board = held('scoreboard');
    const showInv = !!(P && P.alive && !M.airborne(P)) && (style === 'voll' || board || (style === 'reduziert' && this._invShowT > 0));
    this.el.inv.style.opacity = showInv ? '1' : '0';
    // --- Zone: Warnung + Schleier
    let out = 0;
    if (P && P.alive && z && !M.airborne(P)) out = z.outside(P.position.x, P.position.z);
    this.el.veil.classList.toggle('is-on', out > 0);
    this.el.warn.hidden = !(out > 0);
    if (out > 0) {
      const c = z.cur;
      // Richtung zur Zonenmitte relativ zum Blick (vorn = (−sin, −cos), rechts = (cos, −sin))
      const dx = c.x - P.position.x, dz = c.z - P.position.z, sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
      const rel = Math.atan2(dx * cy - dz * sy, -dx * sy - dz * cy);
      const k = ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
      const t = style === 'aus' ? tx('Außerhalb der Zone') : tx(`Außerhalb der Zone · ${Math.round(z.dps)} Schaden/s · ${Math.round(out)} m`);
      const html = `${escapeHtml(t)}<i>${ARROWS[k]}</i>`;
      if (this._warnHtml !== html) { this._warnHtml = html; this.el.warn.innerHTML = html; }
    }
    // --- Einstieg: Hinweis
    const ph = M.dropPhase;
    let hint = '';
    if (P && P.alive) {
      const jk = this._key('jump') || (input && input.mode === 'touch' ? tx('Springen') : tx('Leertaste'));
      if (ph === 'plane' && M.drop && M.drop.route) hint = `<kbd>${escapeHtml(jk)}</kbd>${escapeHtml(tx(`Abspringen · automatisch in ${Math.max(0, Math.ceil(M.drop.route.dur - M.drop.t))} s`))}`;
      else if (ph === 'free') hint = `<kbd>${escapeHtml(jk)}</kbd>${escapeHtml(tx('Fallschirm öffnen'))}`;
      else if (ph === 'chute') hint = escapeHtml(tx('Am Fallschirm – mit der Laufrichtung steuern'));
    }
    if (G.match && G.match.state === 'countdown' && ph === 'plane') hint = escapeHtml(tx('Gleich geht es los – Absprung mit der Sprungtaste'));
    this.el.hint.hidden = !hint;
    if (hint && this._hintHtml !== hint) { this._hintHtml = hint; this.el.hint.innerHTML = hint; }
    // --- große Karte
    const showMap = !!P && (ph === 'plane' || held('sim_karte'));
    this.el.map.hidden = !showMap;
    if (showMap) {
      this._mapT -= dt;
      if (this._mapT <= 0) { this._mapT = 1 / 15; this._drawMap(); }
      const mk = this._key('sim_karte');
      const t = ph === 'plane' ? tx('Flugroute und Zone') : mk ? tx(`Karte (${mk} halten)`) : tx('Karte');
      if (this.el.mapT.textContent !== t) this.el.mapT.textContent = t;
    }
  }

  _invKeyOf(P) {
    const a = P.armor, w = P.weapon, e = w && w.equipment;
    const C = this.mode.ctx;
    return [a ? `${a.tier}:${Math.round(a.hp)}:${a.carry}:${a.helmetId}:${Math.round(a.helmetHp || 0)}` : '-', bandagesOf(C, P),
      e && e.lethal ? `${e.lethal.id}:${e.lethal.count}` : '', e && e.tactical ? `${e.tactical.id}:${e.tactical.count}` : ''].join('|');
  }

  _renderInv(P) {
    if (!P) { this.el.inv.innerHTML = ''; return; }
    const a = P.armor, w = P.weapon, e = w && w.equipment, C = this.mode.ctx;
    const num = this._style() !== 'aus';
    const chip = (label, n, off = false) => `<span${off ? ' class="is-off"' : ''}>${escapeHtml(tx(label))}${n != null && num ? `<b>${escapeHtml(String(n))}</b>` : ''}</span>`;
    const parts = [];
    if (a && a.tier && a.tier !== 'keine') parts.push(chip(VEST_NAMES[a.tier] || 'Schutzweste', a.carry > 0 ? `+${a.carry}` : null, a.hp <= 0.5));
    else parts.push(chip('Keine Weste', null, true));
    if (a && a.helmetId && a.helmetId !== 'keine') parts.push(chip(HELMET_NAMES[a.helmetId] || 'Helm', null, (a.helmetHp || 0) <= 0));
    const b = bandagesOf(C, P);
    parts.push(chip('Verbände', b, b <= 0));
    if (e && e.lethal && e.lethal.id && e.lethal.count > 0) parts.push(chip('Granaten', e.lethal.count));
    if (e && e.tactical && e.tactical.id && e.tactical.count > 0) parts.push(chip('Rauch', e.tactical.count));
    this.el.inv.innerHTML = parts.join('');
  }

  _drawMap() {
    const G = this.G, M = this.mode, w = G.world, mm = w && w.minimap;
    const cv = this.el.canvas;
    const px = Math.max(64, Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1)));
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    if (!mm) return;
    if (mm.canvas) { ctx.globalAlpha = 0.95; ctx.drawImage(mm.canvas, 0, 0, px, px); ctx.globalAlpha = 1; }
    const extent = mm.size ? Math.max(mm.size.x, mm.size.z || mm.size.x) : 500;
    const k = px / extent;
    const P = (x, z) => { const uv = mm.worldToMap(x, z); return [uv.u * px, uv.v * px]; };
    const z = M.zone;
    const d = px / 400;
    if (z) {
      const c = z.cur, [cx, cy] = P(c.x, c.z);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, px, px); ctx.arc(cx, cy, Math.max(0, c.r * k), 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(120,40,24,.32)'; ctx.fill('evenodd');
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, c.r * k), 0, Math.PI * 2);
      ctx.lineWidth = 2 * d; ctx.strokeStyle = 'rgba(232,170,120,.9)'; ctx.stroke();
      const n = z.next;
      if (n) {
        const [nx, ny] = P(n.x, n.z);
        ctx.beginPath(); ctx.arc(nx, ny, Math.max(1, n.r * k), 0, Math.PI * 2);
        ctx.setLineDash([6 * d, 5 * d]); ctx.lineWidth = 1.6 * d; ctx.strokeStyle = 'rgba(240,238,230,.9)'; ctx.stroke();
      }
      ctx.restore();
    }
    // Flugroute
    const D = M.drop;
    if (D && D.route && (D.plane || M.dropPhase === 'plane')) {
      const [ax, ay] = P(D.route.a.x, D.route.a.z), [bx, by] = P(D.route.b.x, D.route.b.z);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      ctx.setLineDash([3 * d, 4 * d]); ctx.lineWidth = 1.5 * d; ctx.strokeStyle = 'rgba(233,230,223,.75)'; ctx.stroke();
      ctx.restore();
      const f = Math.min(1, D.t / D.route.dur);
      const qx = ax + (bx - ax) * f, qy = ay + (by - ay) * f;
      const ang = Math.atan2(by - ay, bx - ax);
      tri(ctx, qx, qy, ang, 7 * d, '#e9e6df');
    }
    // Versorgungsabwürfe
    for (const s of M.supplies || []) {
      const [sx, sy] = P(s.pos.x, s.pos.z);
      ctx.fillStyle = s.landed ? '#c9a54a' : 'rgba(201,165,74,.6)'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = d;
      ctx.fillRect(sx - 4 * d, sy - 4 * d, 8 * d, 8 * d); ctx.strokeRect(sx - 4 * d, sy - 4 * d, 8 * d, 8 * d);
    }
    // eigene Lage
    const p = G.player;
    if (p) {
      const [x, y] = P(p.position.x, p.position.z);
      tri(ctx, x, y, Math.atan2(-Math.cos(p.yaw), -Math.sin(p.yaw)), 6 * d, '#ffc23d');
    }
  }

  /** Minikarte (ui/minimap.js Haken): Zone und nächster Kreis im Kartenmaßstab. */
  drawMinimap(ctx, toScreen, scale, d, half, rad) {
    const z = this.mode.zone;
    if (!z) return;
    const pt = { x: 0, y: 0 };
    const c = z.cur;
    toScreen(c.x, c.z, pt);
    ctx.save();
    ctx.beginPath();
    ctx.rect(half - rad - 2, half - rad - 2, rad * 2 + 4, rad * 2 + 4);
    ctx.arc(pt.x, pt.y, Math.max(0, c.r * scale), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(120,40,24,.28)';
    ctx.fill('evenodd');
    ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0.5, c.r * scale), 0, Math.PI * 2);
    ctx.lineWidth = 1.6 * d; ctx.strokeStyle = 'rgba(232,170,120,.85)'; ctx.stroke();
    const n = z.next;
    if (n) {
      toScreen(n.x, n.z, pt);
      ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(1, n.r * scale), 0, Math.PI * 2);
      ctx.setLineDash([4 * d, 3 * d]); ctx.lineWidth = 1.2 * d; ctx.strokeStyle = 'rgba(240,238,230,.75)'; ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const s of this.mode.supplies || []) {
      toScreen(s.pos.x, s.pos.z, pt);
      let x = pt.x - half, y = pt.y - half;
      const len = Math.hypot(x, y), lim = rad - 7 * d;
      if (len > lim) { x = (x / len) * lim; y = (y / len) * lim; }
      ctx.fillStyle = '#c9a54a'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = d;
      ctx.fillRect(half + x - 3.5 * d, half + y - 3.5 * d, 7 * d, 7 * d); ctx.strokeRect(half + x - 3.5 * d, half + y - 3.5 * d, 7 * d, 7 * d);
    }
    ctx.restore();
  }
}

function tri(ctx, x, y, ang, s, col) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, s * 0.6); ctx.lineTo(-s * 0.35, 0); ctx.lineTo(-s * 0.7, -s * 0.6); ctx.closePath();
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = s * 0.2; ctx.fill(); ctx.stroke();
  ctx.restore();
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
