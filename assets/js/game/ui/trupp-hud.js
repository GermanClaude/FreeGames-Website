// NULLPUNKT — Anzeige des Modus „Trupp“ (modes/trupp.js): eigener Trupp (Soldaten, Rollen, Zustand – antippen/anklicken =
// Soldat wechseln), Frontleiste (Punkte in Reihenfolge, nächstes Ziel, gesperrte Punkte), Funk-Protokoll (Truppfunk grün,
// Teamfunk weiß, Meldungen gold), Weltmarkierungen (Markierungen, Sammelpunkt, Außenposten, Einschlagzonen) mit
// Kompass-Strichen, Funkrad (Taste „Trupp-Funkrad“ halten: Pionier-Bauaufträge, Sammelpunkt, Feind markieren, Funk) und
// Truppmenü (Trupp-Typ, Soldaten und Waffen, Funk, Kommandant). Wechsel-Blende beim Übernehmen eines Kameraden.
// Wird vom Modus erzeugt (onAttach) und je Bild von ui/hud.js aufgerufen (G.trupp.hud.update). Eigene Stilregeln (TRUPP_CSS).
import * as THREE from 'three';
import { el, esc, setStyle, setText, toggle, meters, clamp } from './dom.js?v=20261123073102';
import {
  TRUPP_ROLES, TRUPP_TYPES, TRUPP_TYPE_ORDER, TRUPP_RADIO, TRUPP_SUPPORT, TRUPP_MARKS,
} from '../../shared/trupp.data.js?v=20261123073102';
import { WEAPONS } from '../../shared/weapons.data.js?v=20261123073102';
import { tx } from '../../shared/i18n.js?v=20261123073102';

const _eye = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const DEG_PX = 2.4; // wie der Kompass-Streifen in hud.js (Grad → px)

const svg = (b) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
const IC = {
  sandsack: svg('<path d="M3 18h18M4 18c0-2 1.5-3 4-3s4 1 4 3M12 18c0-2 1.5-3 4-3s4 1 4 3M8 15c0-2 1.5-3 4-3s4 1 4 3"/>'),
  mgnest: svg('<path d="M3 19c2-4 5-6 9-6s7 2 9 6"/><path d="M12 13l5-6M15 9.5l3 1"/>'),
  bunker: svg('<path d="M3 19V11l9-5 9 5v8"/><path d="M7 14h10"/><path d="M3 19h18"/>'),
  sammelpunkt: svg('<path d="M6 21V4"/><path d="M6 5h10l-2 3 2 3H6"/><circle cx="17" cy="18" r="2.5"/>'),
  feind: svg('<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>'),
  angriff: svg('<circle cx="12" cy="12" r="7"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>'),
  sani: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>'),
  ja: svg('<path d="M5 12.5l4.2 4.2L19 7"/>'),
  verteidigen: svg('<path d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6z"/>'),
  bewegen: svg('<path d="M12 21.5s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z"/><circle cx="12" cy="10.5" r="2"/>'),
  outpost: svg('<path d="M3 19V11l9-5 9 5v8"/><path d="M12 19v-5"/>'),
  artillerie: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>'),
  luftschlag: svg('<path d="M12 2l2 7 8 3-8 1-2 9-2-9-8-1 8-3z"/>'),
};
/** Funkrad im Uhrzeigersinn ab oben. */
const WHEEL = [
  { id: 'sandsack', label: 'Sandsäcke', sub: 'Pionier', act: { a: 'bau', k: 'sandsack' }, point: true },
  { id: 'mgnest', label: 'MG-Nest', sub: 'Pionier', act: { a: 'bau', k: 'mgnest' }, point: true },
  { id: 'bunker', label: 'Bunker', sub: 'Außenposten', act: { a: 'bau', k: 'bunker' }, point: true },
  { id: 'sammelpunkt', label: 'Sammelpunkt', sub: 'Pionier', act: { a: 'bau', k: 'sammelpunkt' }, point: true },
  { id: 'feind', label: 'Feind', sub: 'markieren', act: { a: 'mark', k: 'feind' }, point: true, target: true },
  { id: 'angriff', label: 'Angriff', sub: 'markieren', act: { a: 'mark', k: 'angriff' }, point: true },
  { id: 'sani', label: 'Sanitäter!', sub: 'Truppfunk', act: { a: 'say', m: 'sani' } },
  { id: 'ja', label: 'Verstanden', sub: 'Truppfunk', act: { a: 'say', m: 'ja' } },
];
const SEG = (Math.PI * 2) / WHEEL.length;
const DEAD = 0.34;
const TAP_MS = 320;
const MARK_TONE = { angriff: '#ff4b3e', verteidigen: '#5fb4ff', bewegen: '#f2c84b', feind: '#ff8a2a' };

function sector(i, r0, r1, gap = 0.035) {
  const a0 = i * SEG - SEG / 2 + gap, a1 = i * SEG + SEG / 2 - gap;
  const p = (r, a) => `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`;
  return `M${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`;
}

export class TruppHud {
  constructor(G, mode) {
    this.G = G;
    this.mode = mode;
    this.layer = document.getElementById('hud-top') || document.getElementById('game-root') || document.body;
    this._style();
    this.root = el('div', 'tr-root');
    this.root.innerHTML = `
      <div class="tr-front" aria-label="Frontlinie"></div>
      <section class="tr-squad" aria-label="Eigener Trupp"><header><i></i><b></b><span></span></header><ol></ol><footer></footer></section>
      <div class="tr-radio" aria-live="polite"></div>
      <div class="tr-marks"></div>
      <div class="tr-fade"></div>
      <button type="button" class="tr-deploybtn" hidden>Trupp wählen</button>`;
    this.layer.appendChild(this.root);
    this.el = {
      front: this.root.querySelector('.tr-front'), squad: this.root.querySelector('.tr-squad'), head: this.root.querySelector('.tr-squad header b'),
      headSub: this.root.querySelector('.tr-squad header span'), headDot: this.root.querySelector('.tr-squad header i'), list: this.root.querySelector('.tr-squad ol'),
      foot: this.root.querySelector('.tr-squad footer'), radio: this.root.querySelector('.tr-radio'), marks: this.root.querySelector('.tr-marks'),
      fade: this.root.querySelector('.tr-fade'), deployBtn: this.root.querySelector('.tr-deploybtn'),
    };
    this.el.list.addEventListener('click', (e) => {
      const li = e.target.closest('[data-nid]');
      if (!li) return;
      const a = this._actor(li.dataset.nid);
      if (a) this.mode.request({ a: 'swap', id: this._idOf(a) });
    });
    this.el.deployBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.openMenu('trupp'); });
    this._markEls = new Map();
    this._compassEls = new Map();
    this._radioN = 0;
    this._t = 0;
    this._sig = '';
    this._frontSig = '';
    this._buildWheel();
    this.menu = null;
    const ev = G.events;
    this._offs = [
      ev.on('trupp:radio', (e) => this._onRadio(e.entry)),
      ev.on('trupp:notice', (e) => this._notice(e.text)),
      ev.on('trupp:switch', (e) => { if (e.actor === G.player) this._flash(); }),
    ];
    for (const e of mode.radio.slice(-5)) this._onRadio(e);
  }

  dispose() {
    for (const off of this._offs) { try { off(); } catch { /* */ } }
    this._offs = [];
    this.closeWheel(true);
    this.closeMenu();
    if (this.root) this.root.remove();
    if (this.wheelRoot) this.wheelRoot.remove();
    for (const n of this._compassEls.values()) n.remove();
    this._compassEls.clear();
    const H = this.G.hud;
    for (const k of (H && H.el && H.el.mks) || []) if (k && k.n) { k.n.classList.remove('tr-hide', 'tr-locked'); k.n.style.marginTop = ''; }
  }

  _style() {
    if (document.getElementById('trupp-css')) return;
    const st = document.createElement('style');
    st.id = 'trupp-css';
    st.textContent = TRUPP_CSS;
    document.head.appendChild(st);
  }

  _idOf(a) { return Number.isInteger(a.netId) && this.mode.replica ? a.netId : a; }
  _actor(key) { return this._rowActors && this._rowActors.get(key) || null; }
  _notice(text) {
    const H = this.G.hud;
    if (H && typeof H._notice === 'function') H._notice(text, 'gold', null, 3.2, 'trupp');
  }

  /* ------------------------------------------------------------ je Bild */

  update(dt) {
    const G = this.G;
    const m = this.mode;
    if (G.mode !== m) return;
    const p = G.player;
    const input = G.input;
    // Tasten
    if (input && typeof input.pressed === 'function' && G.match.state === 'playing') {
      if (this.menu) { if (input.pressed('trupp_menu') || input.pressed('pause')) this.closeMenu(); }
      else if (input.pressed('trupp_menu')) this.openMenu();
      if (!this.menu && p && p.alive && input.pressed('trupp_wechsel')) m.request({ a: 'swap' });
    }
    this._updateWheel(dt);
    toggle(this.el.front, 'tr-hide', !!(this.wOpen || this.menu || (G.hud && G.hud.wheel && G.hud.wheel.isOpen))); // Frontzeile nicht durch das Rad scheinen lassen
    this._t -= dt;
    if (this._t <= 0) { this._t = 0.25; toggle(this.root, 'is-touch', !!(input && input.mode === 'touch')); this._renderSquad(); this._renderFront(); if (this.menu) this._renderMenu(false); }
    this._updateMarks();
    this._declutter();
    // Einsatzkarte offen und Trupp gefallen: Knopf „Trupp wählen“
    const dep = document.body.dataset.deploy;
    this.el.deployBtn.hidden = !(dep && p && !p.alive) || !!this.menu;
    // Funk-Protokoll ausdünnen
    const now = performance.now();
    for (const n of [...this.el.radio.children]) if (now - Number(n.dataset.t) > 9000) n.remove();
  }

  /* ------------------------------------------------------------ Trupp-Liste */

  _renderSquad() {
    const G = this.G;
    const m = this.mode;
    const p = G.player;
    const sq = p && p.squad;
    toggle(this.el.squad, 'is-off', !sq);
    if (!sq) return;
    const mem = m.squads.members(sq);
    const type = TRUPP_TYPES[sq.type];
    const rows = [];
    this._rowActors = new Map();
    let alive = 0;
    for (const a of mem) {
      const role = TRUPP_ROLES[a.truppRole] || TRUPP_ROLES.schuetze;
      const down = !a.alive && G.injuries && G.injuries.down && G.injuries.down.has(a);
      const st = a === p ? (a.alive ? 'du' : 'gefallen') : a.alive ? 'lebt' : a._absorbed ? 'übernommen' : down ? 'bewusstlos' : 'gefallen';
      if (a.alive) alive++;
      const hp = a.alive ? Math.round((a.health / (a.maxHealth || 100)) * 100) : 0;
      const key = String(a.id);
      this._rowActors.set(key, a);
      const dist = a !== p && a.alive && p && p.alive ? meters(Math.round(a.position.distanceTo(p.position))) : '';
      rows.push(`<li data-nid="${esc(key)}" class="is-${st === 'du' ? 'me' : a.alive ? 'ok' : 'dead'}"><em>${esc(role.short)}</em><b>${esc(a.name || 'Soldat')}</b><span>${a.alive && a !== p ? `${hp} % · ${dist}` : esc(st)}</span><u style="width:${hp}%"></u></li>`);
    }
    const sig = rows.join('');
    if (sig !== this._sig) { this._sig = sig; this.el.list.innerHTML = sig; }
    setText(this.el.head, `Trupp ${sq.name}`);
    setText(this.el.headSub, `${type ? type.name : 'Trupp'} · ${alive}/${mem.length}`);
    setStyle(this.el.headDot, 'background', sq.color || '#57d68d');
    const k = (id) => (G.input && typeof G.input.label === 'function' ? G.input.label(id) : '');
    const pend = m._pendingType && m._pendingType.get && m._pendingType.get(p);
    setText(this.el.foot, `${k('trupp_wechsel') ? `${k('trupp_wechsel')} wechseln · ` : ''}${k('trupp_funk') ? `${k('trupp_funk')} Funkrad · ` : ''}${k('trupp_menu') ? `${k('trupp_menu')} Truppmenü` : ''}${pend ? ` · nächster Einsatz: ${TRUPP_TYPES[pend].name}` : ''}`);
  }

  /* ------------------------------------------------------------ Frontleiste */

  _renderFront() {
    const G = this.G;
    const m = this.mode;
    const team = G.player ? G.player.team : 'A';
    const other = team === 'A' ? 'B' : 'A';
    const info = typeof m.frontInfo === 'function' ? m.frontInfo() : [];
    // Eine Zeile unter dem Kompass (die Flaggenleiste des HUD zeigt schon alle Punkte): nächstes Ziel, bedrohter eigener Punkt
    const tgt = info.find((f) => f.open[team]);
    const threat = info.find((f) => f.open[other] && f.owner === team);
    const locked = info.filter((f) => !f.open[team] && f.owner !== team).map((f) => f.id);
    const nm = (f) => `${f.id}${f.name ? ` – ${f.name}` : ''}`;
    const html = info.length ? `${tgt ? `<b class="is-tgt">Ziel ${esc(nm(tgt))}${tgt.capturingTeam === team ? ` · ${Math.round((tgt.progress || 0) * 100)} %` : ''}</b>` : '<b>Alle Punkte gehalten</b>'}${threat ? `<span class="is-threat">Halten ${esc(threat.id)}${threat.capturingTeam === other ? ' – wird eingenommen!' : ''}</span>` : ''}${locked.length ? `<span class="is-lock">gesperrt ${esc(locked.join(' '))}</span>` : ''}` : '';
    if (html !== this._frontSig) { this._frontSig = html; this.el.front.innerHTML = html; }
    // Lage: knapp unter dem Kompass (sonst unter dem Punktestand)
    const c = document.querySelector('.h-compass');
    const r = c && c.offsetParent ? c.getBoundingClientRect() : null;
    const lr = this.root.getBoundingClientRect();
    const top = r && r.width ? Math.round(r.bottom - lr.top + 16) : null;
    if (top !== this._frontTop) { this._frontTop = top; setStyle(this.el.front, 'top', top != null ? `${top}px` : ''); }
  }

  /**
   * Marker entwirren (je Bild nach hud.js _updateMarkers und den eigenen Markierungen): nichts über der Truppliste/dem Funk,
   * übereinanderliegende Marker untereinander versetzen, gesperrte Frontpunkte abgeblendet.
   */
  _declutter() {
    const G = this.G;
    const m = this.mode;
    const H = G.hud;
    const team = G.player ? G.player.team : 'A';
    const items = [];
    const byId = new Map(m.objectives.map((f) => [f.id, f]));
    for (const k of (H && H.el && H.el.mks) || []) {
      if (!k || !k.n || k.x == null) continue;
      const f = byId.get(k.id);
      toggle(k.n, 'tr-locked', !!f && f.owner !== team && !m.touchable(team, f));
      items.push({ n: k.n, x: k.x, y: k.y, h: 58 });
    }
    for (const [, n] of this._markEls) if (n._x != null) items.push({ n, x: n._x, y: n._y, h: 40 });
    const lr = this.root.getBoundingClientRect();
    const rects = [];
    for (const el of [this.el.squad, this.el.radio, this.el.front]) {
      if (!el || el.classList.contains('is-off') || !el.offsetParent || !el.childElementCount) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) rects.push({ l: r.left - lr.left - 22, t: r.top - lr.top - 26, r: r.right - lr.left + 22, b: r.bottom - lr.top + 34 });
    }
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    const placed = [];
    for (const it of items) {
      let off = 0;
      for (let k = 0; k < 6; k++) {
        const hit = placed.find((q) => Math.abs(q.x - it.x) < 40 && Math.abs(q.y + q.off - (it.y + off)) < Math.max(q.h, it.h) * 0.8);
        if (!hit) break;
        off = hit.y + hit.off + Math.max(hit.h, it.h) * 0.8 - it.y;
      }
      it.off = off;
      placed.push(it);
      const mt = off ? `${Math.round(off)}px` : '';
      if (it.n.style.marginTop !== mt) it.n.style.marginTop = mt;
      const y = it.y + off;
      const hide = rects.some((r) => it.x > r.l && it.x < r.r && y > r.t && y < r.b);
      toggle(it.n, 'tr-hide', hide);
    }
  }

  /* ------------------------------------------------------------ Funk */

  _onRadio(e) {
    const G = this.G;
    const p = G.player;
    if (!e || !p || (e.team && e.team !== p.team)) return;
    if (e.sq && (!p.squad || p.squad.id !== e.sq)) return;
    if (e.to && e.to !== p) return;
    if (e.n <= this._radioN) return;
    this._radioN = e.n;
    const text = this.mode.radioText(e);
    if (!text) return;
    const who = e.from ? (e.from === p ? 'Du' : e.from.name || 'Soldat') : e.sq ? 'Trupp' : 'Funk';
    const n = el('div', `tr-msg ${e.sq ? 'is-sq' : e.from ? 'is-team' : 'is-sys'}`, `<b>${esc(who)}</b> ${esc(text)}`);
    n.dataset.t = String(performance.now());
    this.el.radio.appendChild(n);
    while (this.el.radio.children.length > 6) this.el.radio.firstChild.remove();
  }

  _flash() {
    const f = this.el.fade;
    f.classList.remove('is-on');
    void f.offsetWidth;
    f.classList.add('is-on');
  }

  /* ------------------------------------------------------------ Weltmarkierungen + Kompass */

  _markList() {
    const G = this.G;
    const m = this.mode;
    const p = G.player;
    const team = p ? p.team : 'A';
    const out = [];
    for (const k of m.marks) if (k.team === team && (k.kind !== 'feind' || true) && (!k.sq || !p.squad || k.sq === p.squad || k.kind === 'feind')) {
      if (k.sq && p.squad && k.sq !== p.squad && k.kind !== 'feind') continue;
      out.push({ key: `m${k.n}`, pos: k.pos, icon: IC[k.kind], color: MARK_TONE[k.kind], label: TRUPP_MARKS[k.kind].name, up: 1.6 });
    }
    const r = p && p.squad && m.rallies.get(p.squad.id);
    if (r) out.push({ key: 'rally', pos: r.pos, icon: IC.sammelpunkt, color: r.blocked ? '#ff4b3e' : p.squad.color, label: `Sammelpunkt (${r.uses})`, up: 2.2 });
    for (const o of m.outposts) if (o.team === team) out.push({ key: `o${o.id}`, pos: o.pos, icon: IC.outpost, color: o.blocked ? '#ff4b3e' : '#c7e66a', label: 'Außenposten', up: 3.2 });
    for (let i = 0; i < m.supportMarks.length; i++) { const s = m.supportMarks[i]; if (s.team === team) out.push({ key: `s${i}${s.kind}`, pos: s.pos, icon: IC[s.kind], color: '#ffb43c', label: TRUPP_SUPPORT[s.kind] ? TRUPP_SUPPORT[s.kind].name : 'Einschlag', up: 1 }); }
    return out;
  }

  _updateMarks() {
    const G = this.G;
    const cam = G.camera;
    const p = G.player;
    if (!cam || !p) return;
    const list = this._markList();
    const vw = window.innerWidth, vh = window.innerHeight;
    const lens = G.renderer && G.renderer.lens;
    const seen = new Set();
    const strip = document.querySelector('.h-compass');
    const heading = ((((-p.yaw * 180) / Math.PI) % 360) + 360) % 360;
    for (const k of list) {
      seen.add(k.key);
      let n = this._markEls.get(k.key);
      if (!n) {
        n = el('div', 'tr-mk', `<div class="tr-mk-d">${k.icon || ''}</div><span></span>`);
        this.el.marks.appendChild(n);
        this._markEls.set(k.key, n);
      }
      setStyle(n, 'color', k.color);
      _v.copy(k.pos); _v.y += k.up;
      _w.copy(_v).applyMatrix4(cam.matrixWorldInverse);
      const behind = _w.z > 0;
      _v.project(cam);
      if (!behind && lens && typeof lens.toScreen === 'function') lens.toScreen(_v);
      let x = (_v.x * 0.5 + 0.5) * vw, y = (-_v.y * 0.5 + 0.5) * vh;
      if (behind) { x = vw - x; y = vh - 70; }
      const edge = behind || x < 40 || x > vw - 40 || y < 80 || y > vh - 60;
      x = Math.round(clamp(x, 40, vw - 40));
      y = Math.round(clamp(y, 80, vh - 60));
      n._x = x; n._y = y;
      setStyle(n, 'transform', `translate(${x}px, ${y}px)`);
      toggle(n, 'is-edge', edge);
      setText(n.querySelector('span'), `${k.label} · ${meters(Math.round(p.position.distanceTo(k.pos)))}`);
      // Kompass-Strich
      if (strip) {
        let c = this._compassEls.get(k.key);
        if (!c) { c = el('i', 'tr-cmp'); strip.appendChild(c); this._compassEls.set(k.key, c); }
        const brg = ((Math.atan2(k.pos.x - p.position.x, -(k.pos.z - p.position.z)) * 180) / Math.PI + 360) % 360;
        let d = brg - heading;
        d = ((d + 540) % 360) - 180;
        const w = strip.clientWidth || 300;
        const px = w / 2 + d * DEG_PX;
        setStyle(c, 'left', `${Math.round(px)}px`);
        setStyle(c, 'background', k.color);
        toggle(c, 'is-out', px < 4 || px > w - 4);
      }
    }
    for (const [key, n] of this._markEls) if (!seen.has(key)) { n.remove(); this._markEls.delete(key); }
    for (const [key, n] of this._compassEls) if (!seen.has(key) || !n.isConnected) { n.remove(); this._compassEls.delete(key); }
  }

  /* ------------------------------------------------------------ Zielpunkt */

  aim() {
    const G = this.G;
    const p = G.player;
    p.getEyePosition(_eye);
    if (typeof p.getAimDirection === 'function') p.getAimDirection(_dir); else _dir.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    _dir.normalize();
    const hit = G.world && typeof G.world.raycast === 'function' ? G.world.raycast(_eye, _dir, 400) : null;
    const far = hit ? hit.distance : 150;
    let target = null;
    const aimT = G.input && G.input.aimTarget;
    if (aimT && aimT.alive && G.combat && G.combat.isHostile(p, aimT)) target = aimT;
    if (!target && G.combat) {
      let best = Infinity;
      for (const a of G.actors) {
        if (!a.alive || a === p || a.isStreakEntity || !G.combat.isHostile(p, a)) continue;
        _v.copy(a.position); _v.y += 1.1;
        const t = _w.subVectors(_v, _eye).dot(_dir);
        if (t < 2 || t > far + 1) continue;
        const off = _w.copy(_dir).multiplyScalar(t).add(_eye).distanceTo(_v);
        if (off < 1.6 + t * 0.012 && off < best) { best = off; target = a; }
      }
    }
    const point = hit ? hit.point.clone().addScaledVector(hit.normal, 0.3) : _eye.clone().addScaledVector(_dir, 60).setY(p.position.y);
    return { point, target };
  }

  _send(act, withPoint, withTarget) {
    const m = this.mode;
    const msg = { ...act };
    if (withPoint) {
      const { point, target } = this.aim();
      const pt = withTarget && target ? target.position : point;
      msg.p = [Math.round(pt.x * 100) / 100, Math.round(pt.y * 100) / 100, Math.round(pt.z * 100) / 100];
      if (withTarget && target) { if (m.replica) msg.tg = target.netId; else msg.tgA = target; }
    }
    m.request(msg);
    this.G.events.emit('ui:sound', { name: 'confirm' });
  }

  /* ------------------------------------------------------------ Funkrad */

  _buildWheel() {
    const r = el('div', 'cw-root tr-wheel');
    r.hidden = true;
    r.setAttribute('role', 'menu');
    r.setAttribute('aria-label', 'Funkrad');
    const segs = WHEEL.map((w, i) => `<path class="cw-seg" data-i="${i}" d="${sector(i, 41, 97)}"/>`).join('');
    r.innerHTML = `<svg class="cw-ring" viewBox="-100 -100 200 200" aria-hidden="true"><circle class="cw-back" r="98"/>${segs}<circle class="cw-hub" r="38"/><path class="cw-ptr" d="M-5 -41L0 -49L5 -41Z"/></svg>
      ${WHEEL.map((w, i) => { const a = i * SEG; const x = 50 + Math.sin(a) * 34.5, y = 50 - Math.cos(a) * 34.5; return `<button type="button" class="cw-item" data-i="${i}" role="menuitem" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%">${IC[w.id]}<span>${esc(w.label)}<small>${esc(w.sub)}</small></span></button>`; }).join('')}
      <button type="button" class="cw-center" aria-label="Schließen"><b class="cw-title">Funk</b><span class="cw-hint"></span></button><div class="cw-foot"></div>`;
    this.layer.appendChild(r);
    this.wheelRoot = r;
    this.wSegs = [...r.querySelectorAll('.cw-seg')];
    this.wItems = [...r.querySelectorAll('.cw-item')];
    this.wPtr = r.querySelector('.cw-ptr');
    this.wTitle = r.querySelector('.cw-title');
    this.wHint = r.querySelector('.cw-hint');
    this.wFoot = r.querySelector('.cw-foot');
    this.wOpen = false;
    this.wSel = -1;
    r.addEventListener('pointerdown', (e) => {
      if (!this.wOpen) return;
      const b = e.target.closest('[data-i]');
      e.preventDefault(); e.stopPropagation();
      if (b) this._wConfirm(Number(b.dataset.i)); else if (e.target.closest('.cw-center')) this.closeWheel();
    });
  }

  _wAvail() {
    const G = this.G;
    const p = G.player;
    if (!p || !p.alive || G.match.state !== 'playing' || this.menu) return false;
    if (G.xr && G.xr.presenting) return false;
    const cw = G.hud && G.hud.wheel;
    return !(cw && cw.isOpen);
  }

  _updateWheel() {
    const G = this.G;
    const input = G.input;
    if (!input) return;
    const W = input.wheel;
    if (this.wOpen && (!this._wAvail() || W.cancel)) this.closeWheel();
    if (!this.wOpen) {
      if (input.pressed('trupp_funk') && this._wAvail()) this.openWheel();
      return;
    }
    if (!this.wTap) {
      const mag = Math.hypot(W.x, W.y);
      let sel = -1;
      if (mag > DEAD) sel = (Math.round(Math.atan2(W.x, -W.y) / SEG) + WHEEL.length) % WHEEL.length;
      if (sel !== this.wSel) this._wSelect(sel);
      setStyle(this.wPtr, 'transform', mag > 0.12 ? `rotate(${((Math.atan2(W.x, -W.y) * 180) / Math.PI).toFixed(1)}deg)` : '');
      toggle(this.wPtr, 'is-on', mag > 0.12);
    }
    if (W.click) { W.click = false; if (this.wSel >= 0) this._wConfirm(this.wSel); else this.closeWheel(); }
    else if (this.wSticky) { if (input.pressed('trupp_funk')) { if (this.wSel >= 0) this._wConfirm(this.wSel); else this.closeWheel(); } }
    else if (input.released('trupp_funk') || !input.down('trupp_funk')) {
      const quick = performance.now() - this._wAt < TAP_MS;
      if (quick && !W.drag && this.wSel < 0) {
        this.wSticky = true;
        this.wTap = input.mode === 'touch';
        toggle(this.wheelRoot, 'is-tap', this.wTap);
        setText(this.wFoot, this.wTap ? 'Feld antippen. Mitte schließt.' : 'Wählen, Klick bestätigt.');
      } else if (this.wSel >= 0) this._wConfirm(this.wSel);
      else this.closeWheel();
    }
  }

  openWheel() {
    const G = this.G;
    this.wOpen = true;
    this.wSticky = false;
    this.wTap = false;
    this._wAt = performance.now();
    G.input.openWheel();
    this.wheelRoot.hidden = false;
    toggle(this.wheelRoot, 'is-tap', false);
    this._wSelect(-1);
    setText(this.wFoot, G.input.mode === 'touch' ? 'Ziehen und loslassen – oder antippen.' : 'Zeigen, wählen, loslassen.');
    G.events.emit('ui:sound', { name: 'toggle' });
  }

  closeWheel(silent = false) {
    if (!this.wOpen) return;
    this.wOpen = false;
    this.wheelRoot.hidden = true;
    if (this.G.input) this.G.input.closeWheel();
    if (!silent) this.G.events.emit('ui:sound', { name: 'back' });
  }

  _wSelect(i) {
    if (this.wSel >= 0) { this.wSegs[this.wSel].classList.remove('is-sel'); this.wItems[this.wSel].classList.remove('is-sel'); }
    this.wSel = i;
    if (i >= 0) {
      this.wSegs[i].classList.add('is-sel');
      this.wItems[i].classList.add('is-sel');
      setText(this.wTitle, WHEEL[i].label);
      setText(this.wHint, WHEEL[i].point ? 'Punkt im Fadenkreuz' : WHEEL[i].sub);
    } else { setText(this.wTitle, 'Funk'); setText(this.wHint, 'Mitte: abbrechen'); }
  }

  _wConfirm(i) {
    const w = WHEEL[i];
    this.closeWheel(true);
    if (!w) return;
    this._send(w.act, !!w.point, !!w.target);
  }

  /* ------------------------------------------------------------ Truppmenü */

  openMenu(tab = 'trupp') {
    const G = this.G;
    if (this.menu) return;
    this.closeWheel(true);
    const inp = G.input;
    let aim = null;
    try { if (G.player && G.player.alive) aim = this.aim().point; } catch { aim = null; }
    this.menu = { tab, aim, lock: inp ? !!inp.allowUnlockedMouse : false };
    if (inp && inp.mode === 'desktop') { inp.allowUnlockedMouse = true; try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* */ } }
    if (typeof G.holdUi === 'function') G.holdUi(true);
    const n = el('div', 'tr-menu');
    n.setAttribute('role', 'dialog');
    n.setAttribute('aria-label', 'Truppmenü');
    this.layer.appendChild(n);
    this.menu.el = n;
    n.addEventListener('click', (e) => this._menuClick(e));
    n.addEventListener('change', (e) => this._menuChange(e));
    this._renderMenu(true);
    G.events.emit('ui:sound', { name: 'open' });
  }

  closeMenu() {
    const M = this.menu;
    if (!M) return;
    this.menu = null;
    M.el.remove();
    const G = this.G;
    const inp = G.input;
    if (inp) inp.allowUnlockedMouse = M.lock;
    if (typeof G.holdUi === 'function') G.holdUi(false);
    if (inp && inp.mode === 'desktop' && !inp.allowUnlockedMouse && G.match.state === 'playing' && G.player && G.player.alive && !document.body.dataset.deploy) { try { inp.requestLock(); } catch { /* */ } }
  }

  _renderMenu(full) {
    const M = this.menu;
    if (!M) return;
    const G = this.G;
    const m = this.mode;
    const p = G.player;
    const sq = p && p.squad;
    const cur = typeof m.typeOf === 'function' ? m.typeOf(p) : sq && sq.type;
    const tab = M.tab;
    let body = '';
    if (tab === 'trupp') {
      body = `<h3>Trupp-Typ <small>gilt beim nächsten Einsatz des ganzen Trupps</small></h3><div class="tr-types">${TRUPP_TYPE_ORDER.map((id) => {
        const t = TRUPP_TYPES[id];
        const roles = t.roles.map((r) => TRUPP_ROLES[r].short).join(' · ');
        return `<button type="button" data-type="${id}" class="tr-type${cur === id ? ' is-on' : ''}"><b>${esc(t.name)}</b><small>${t.roles.length} Mann${t.vehicle ? ` · ${t.vehicle === 'panzer' ? 'im Panzer' : 'im Fahrzeug'}` : ''}</small><span>${esc(t.text)}</span><em>${esc(roles)}</em></button>`;
      }).join('')}</div>`;
      if (sq) {
        const mem = m.squads.members(sq);
        body += `<h3>Soldaten <small>Hauptwaffe je Soldat (passend zur Rolle) – gilt beim nächsten Einsatz</small></h3><div class="tr-sol">${mem.map((a) => {
          const r = TRUPP_ROLES[a.truppRole] || TRUPP_ROLES.schuetze;
          const lo = a.loadout || {};
          const opts = Object.keys(WEAPONS).filter((id) => WEAPONS[id].slot === 'primary' && !WEAPONS[id].og && r.weapons.includes(WEAPONS[id].cls));
          const sel = opts.includes(lo.primary) ? lo.primary : '';
          return `<div class="tr-solrow${a === p ? ' is-me' : ''}"><em>${esc(r.short)}</em><b>${esc(a.name || 'Soldat')}</b><span>${esc(tx(r.name, 'trupp'))}${a === p ? ` (${esc(tx('du'))})` : ''}</span>
            <select data-wpn="${esc(String(a.id))}" aria-label="Hauptwaffe">${sel ? '' : '<option value="">Standard</option>'}${opts.map((id) => `<option value="${id}"${id === sel ? ' selected' : ''}>${esc(WEAPONS[id].name || id)}</option>`).join('')}</select></div>`;
        }).join('')}</div>`;
      }
    } else if (tab === 'funk') {
      const btn = (ch) => Object.entries(TRUPP_RADIO).filter(([, d]) => d.ch === ch).map(([id]) => `<button type="button" class="m-btn tr-say" data-say="${id}">${esc(m.radioText({ msg: id, pt: (m.objectives[m._targets[p ? p.team : 'A']] || {}).id }))}</button>`).join('');
      body = `<h3>Truppfunk</h3><div class="tr-says">${btn('s')}</div><h3>Teamfunk</h3><div class="tr-says">${btn('t')}</div>
        <h3>Markierungen</h3><div class="tr-says"><button type="button" class="m-btn" data-mk="angriff">Angriff (Fadenkreuz)</button><button type="button" class="m-btn" data-mk="verteidigen">Verteidigen (Fadenkreuz)</button><button type="button" class="m-btn" data-mk="bewegen">Bewegen (Fadenkreuz)</button><button type="button" class="m-btn" data-clr="1">Markierungen löschen</button></div>`;
    } else {
      const team = p ? p.team : 'A';
      const me = m.commander[team] === p;
      const who = m.commander[team];
      const cd = (k) => Math.ceil(m.supportLeft(team, k));
      body = !m.commandersOn ? '<p class="tr-p">Der Kommandant ist in diesem Spiel ausgeschaltet (Lobby: Modus-Einstellung „Kommandant“).</p>'
        : `<p class="tr-p">${who ? `Kommandant: <b>${esc(who === p ? 'du' : who.name || 'Mitspieler')}</b>` : 'Kein Kommandant – die KI ruft selten Artillerie.'}</p>
        <div class="tr-says"><button type="button" class="m-btn m-primary" data-cmd="1">${me ? 'Kommando abgeben' : 'Kommando übernehmen'}</button></div>
        ${me ? `<h3>Unterstützung <small>auf den Punkt im Fadenkreuz beim Öffnen des Menüs</small></h3><div class="tr-says">${Object.values(TRUPP_SUPPORT).map((s) => `<button type="button" class="m-btn" data-sup="${s.id}"${cd(s.id) > 0 || !M.aim ? ' disabled' : ''}>${IC[s.id]}<span>${esc(s.name)}${cd(s.id) > 0 ? ` – ${cd(s.id)} s` : ' – bereit'}</span></button>`).join('')}</div>
        <h3>Ziele der Trupps</h3><div class="tr-cmds">${m.squads.teamList(team).map((s) => `<div class="tr-cmdrow"><i style="background:${s.color}"></i><b>${esc(s.name)}</b><span>${s.owner ? esc(s.owner.name || 'Spieler') : 'KI'}${s.order ? ` · ${s.order.kind === 'defend' ? 'hält' : 'greift'} ${esc(s.order.objectiveId)}` : ''}</span>${m.objectives.map((f) => `<button type="button" class="tr-obj" data-sq="${esc(s.id)}" data-f="${esc(f.id)}">${esc(f.id)}</button>`).join('')}</div>`).join('')}</div>` : ''}`;
    }
    const html = `<div class="tr-panel"><header><b>Truppmenü</b><nav>${[['trupp', 'Trupp'], ['funk', 'Funk'], ['kommando', 'Kommando']].map(([id, l]) => `<button type="button" data-tab="${id}" class="${id === tab ? 'is-on' : ''}">${l}</button>`).join('')}</nav><button type="button" class="m-icon" data-close="1" aria-label="Schließen">✕</button></header><div class="tr-body">${body}</div></div>`;
    if (!full && M._html === html) return;
    if (!full && M.el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return; // offene Auswahl nicht zerstören
    M._html = html;
    M.el.innerHTML = html;
  }

  _menuClick(e) {
    const b = e.target.closest('button');
    const M = this.menu;
    if (!M) return;
    if (!b) { if (e.target === M.el) this.closeMenu(); return; }
    const d = b.dataset;
    const m = this.mode;
    if (d.close) { this.closeMenu(); return; }
    if (d.tab) { M.tab = d.tab; this._renderMenu(true); this.G.events.emit('ui:sound', { name: 'click' }); return; }
    if (d.type) { m.request({ a: 'type', ty: d.type }); this.G.events.emit('ui:sound', { name: 'confirm' }); setTimeout(() => this._renderMenu(true), 60); return; }
    if (d.say) { m.request({ a: 'say', m: d.say }); this.closeMenu(); return; }
    if (d.mk) { if (M.aim) { m.request({ a: 'mark', k: d.mk, p: [M.aim.x, M.aim.y, M.aim.z] }); } this.closeMenu(); return; }
    if (d.clr) { m.request({ a: 'clr' }); this.closeMenu(); return; }
    if (d.cmd) { m.request({ a: 'cmd' }); setTimeout(() => this._renderMenu(true), 60); return; }
    if (d.sup) { if (M.aim) m.request({ a: 'sup', k: d.sup, p: [M.aim.x, M.aim.y, M.aim.z] }); this.closeMenu(); return; }
    if (d.sq && d.f) { m.request({ a: 'obj', sq: d.sq, f: d.f }); this.G.events.emit('ui:sound', { name: 'confirm' }); }
  }

  _menuChange(e) {
    const s = e.target.closest('select[data-wpn]');
    if (!s) return;
    const a = this.G.actors.find((x) => String(x.id) === s.dataset.wpn);
    if (a && s.value) this.mode.request({ a: 'waffe', id: this._idOf(a), w: s.value });
  }
}

const TRUPP_CSS = `
.tr-root { position: absolute; inset: 0; pointer-events: none; font-family: var(--font-hud, 'Rajdhani NP', system-ui, sans-serif); color: var(--np-ink, #e9e6df); text-shadow: 0 1px 2px rgba(0,0,0,.85); }
.tr-front { position: absolute; left: 50%; top: calc(var(--top-h, 64px) + 64px); transform: translateX(-50%); display: flex; gap: 10px; align-items: baseline; white-space: nowrap; font: 600 13px/1.1 var(--font-hud, sans-serif); letter-spacing: .05em; }
.tr-front b { font-weight: 700; color: #f2c84b; text-transform: uppercase; }
.tr-front .is-threat { color: #ff8a2a; font-weight: 700; text-transform: uppercase; animation: tr-blink 1.2s steps(2) infinite; }
.tr-front .is-lock { color: rgba(233,230,223,.6); font-size: 11.5px; }
@keyframes tr-blink { 50% { opacity: .55; } }
.tr-hide { visibility: hidden !important; }
.tr-locked { opacity: .42; }
.tr-squad { position: absolute; left: calc(var(--pad-l, 16px) + 2px); top: 30%; width: 222px; background: rgba(10,11,13,.5); border-left: 2px solid rgba(233,230,223,.25); padding: 6px 8px 6px; pointer-events: auto; }
.tr-squad.is-off { display: none; }
.tr-squad header { display: flex; align-items: center; gap: 6px; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }
.tr-squad header i { width: 9px; height: 9px; border-radius: 2px; flex: none; }
.tr-squad header span { margin-left: auto; font-size: 11px; opacity: .8; text-transform: none; }
.tr-squad ol { list-style: none; margin: 5px 0 3px; padding: 0; display: grid; gap: 2px; }
.tr-squad li { position: relative; display: grid; grid-template-columns: 30px 1fr auto; gap: 5px; align-items: baseline; padding: 2px 4px 3px; font-size: 12.5px; cursor: pointer; background: rgba(255,255,255,.03); }
.tr-squad li:hover { background: rgba(255,255,255,.1); }
.tr-squad li em { font-style: normal; font-weight: 700; font-size: 10.5px; color: #f2c84b; letter-spacing: .05em; }
.tr-squad li b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tr-squad li span { font-size: 11px; opacity: .8; }
.tr-squad li u { position: absolute; left: 0; bottom: 0; height: 2px; background: #57d68d; text-decoration: none; }
.tr-squad li.is-me { background: rgba(87,214,141,.16); }
.tr-squad li.is-me b { color: #8ff0b6; }
.tr-squad li.is-dead { opacity: .45; cursor: default; }
.tr-squad footer { font-size: 10.5px; opacity: .7; letter-spacing: .03em; }
.tr-radio { position: absolute; left: calc(var(--pad-l, 16px) + 2px); top: calc(30% - 8px); transform: translateY(-100%); width: 330px; display: flex; flex-direction: column; gap: 2px; }
.tr-msg { font-size: 12.5px; padding: 2px 6px; background: rgba(10,11,13,.45); animation: tr-in .2s ease-out; }
.tr-msg b { font-weight: 700; margin-right: 3px; }
.tr-msg.is-sq b { color: #8ff0b6; } .tr-msg.is-team b { color: #cfe0ff; } .tr-msg.is-sys { color: #f2d27a; } .tr-msg.is-sys b { color: #f2c84b; }
@keyframes tr-in { from { opacity: 0; transform: translateX(-8px); } }
.tr-marks { position: absolute; inset: 0; overflow: hidden; }
.tr-mk { position: absolute; left: 0; top: 0; width: 0; height: 0; }
.tr-mk-d { position: absolute; left: -12px; top: -12px; width: 24px; height: 24px; display: grid; place-items: center; border: 1.5px solid currentColor; border-radius: 50%; background: rgba(10,11,13,.55); }
.tr-mk-d svg { width: 15px; height: 15px; }
.tr-mk span { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); white-space: nowrap; font: 600 11px/1 var(--font-hud, sans-serif); letter-spacing: .04em; color: #fff; }
.tr-mk.is-edge span { display: none; }
.tr-cmp { position: absolute; bottom: -1px; width: 6px; height: 6px; margin-left: -3px; transform: rotate(45deg); pointer-events: none; }
.tr-cmp.is-out { display: none; }
.tr-fade { position: absolute; inset: 0; background: #000; opacity: 0; }
.tr-fade.is-on { animation: tr-fade .45s ease-out; }
@keyframes tr-fade { 0% { opacity: .85; } 100% { opacity: 0; } }
.tr-deploybtn { position: absolute; right: 18px; top: 18px; z-index: 40; pointer-events: auto; padding: 9px 16px; font: 700 14px/1 var(--font-hud, sans-serif); letter-spacing: .08em; text-transform: uppercase; color: #101214; background: #f2c84b; border: 0; cursor: pointer; }
.tr-wheel .cw-item small { color: #f2c84b; }
.tr-menu { position: absolute; inset: 0; z-index: 45; display: grid; place-items: center; background: rgba(5,6,8,.55); pointer-events: auto; }
.tr-panel { width: min(920px, calc(100vw - 32px)); max-height: calc(100vh - 40px); display: flex; flex-direction: column; background: rgba(16,18,21,.96); border: 1px solid rgba(233,230,223,.18); color: var(--np-ink, #e9e6df); font-family: var(--font-hud, sans-serif); text-shadow: none; }
.tr-panel header { display: flex; align-items: center; gap: 14px; padding: 10px 14px; border-bottom: 1px solid rgba(233,230,223,.12); }
.tr-panel header b { font-size: 18px; letter-spacing: .1em; text-transform: uppercase; }
.tr-panel nav { display: flex; gap: 4px; margin-right: auto; }
.tr-panel nav button, .tr-panel header .m-icon { background: none; border: 1px solid rgba(233,230,223,.2); color: inherit; padding: 6px 12px; font: 600 13px/1 var(--font-hud, sans-serif); letter-spacing: .06em; text-transform: uppercase; cursor: pointer; }
.tr-panel nav button.is-on { background: #f2c84b; color: #101214; border-color: #f2c84b; }
.tr-body { overflow: auto; padding: 8px 14px 16px; }
.tr-body h3 { margin: 12px 0 6px; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: #f2c84b; }
.tr-body h3 small { margin-left: 8px; font-size: 11px; letter-spacing: .02em; text-transform: none; color: rgba(233,230,223,.6); }
.tr-types { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; }
.tr-type { display: grid; gap: 3px; text-align: left; padding: 8px 10px; background: rgba(255,255,255,.04); border: 1px solid rgba(233,230,223,.14); color: inherit; cursor: pointer; font-family: inherit; }
.tr-type:hover { background: rgba(255,255,255,.09); }
.tr-type.is-on { border-color: #57d68d; background: rgba(87,214,141,.12); }
.tr-type b { font-size: 15px; letter-spacing: .04em; }
.tr-type small { font-size: 11px; color: #f2c84b; letter-spacing: .05em; text-transform: uppercase; }
.tr-type span { font-size: 12px; color: rgba(233,230,223,.78); line-height: 1.3; }
.tr-type em { font-style: normal; font-size: 10.5px; color: rgba(233,230,223,.55); letter-spacing: .05em; }
.tr-sol { display: grid; gap: 3px; }
.tr-solrow { display: grid; grid-template-columns: 38px minmax(90px, 1fr) minmax(90px, 1fr) minmax(140px, 1.2fr); gap: 8px; align-items: center; padding: 3px 6px; background: rgba(255,255,255,.03); font-size: 13px; }
.tr-solrow.is-me { background: rgba(87,214,141,.12); }
.tr-solrow em { font-style: normal; font-weight: 700; font-size: 11px; color: #f2c84b; }
.tr-solrow span { font-size: 12px; opacity: .75; }
.tr-solrow select { background: #1c1f23; color: inherit; border: 1px solid rgba(233,230,223,.2); padding: 3px 4px; font: inherit; font-size: 12px; }
.tr-says { display: flex; flex-wrap: wrap; gap: 6px; }
.tr-says .m-btn { display: inline-flex; align-items: center; gap: 6px; }
.tr-says .m-btn svg { width: 16px; height: 16px; }
.tr-p { font-size: 13.5px; }
.tr-cmds { display: grid; gap: 3px; }
.tr-cmdrow { display: flex; align-items: center; gap: 6px; padding: 3px 6px; background: rgba(255,255,255,.03); font-size: 13px; flex-wrap: wrap; }
.tr-cmdrow i { width: 9px; height: 9px; border-radius: 2px; }
.tr-cmdrow span { opacity: .7; font-size: 12px; margin-right: auto; }
.tr-obj { min-width: 28px; padding: 3px 6px; background: rgba(255,255,255,.06); border: 1px solid rgba(233,230,223,.2); color: inherit; cursor: pointer; font: 700 12px/1 var(--font-hud, sans-serif); }
/* Touch: kompakte Truppleiste oben links neben der Minikarte (links unten liegen Stick und Knöpfe), Funk darunter */
.tr-root.is-touch .tr-squad { left: calc(var(--pad-l, 0px) + 108px); top: 4px; width: 188px; padding: 3px 5px 4px; border-left-width: 2px; }
.tr-root.is-touch .tr-squad header { font-size: 11px; }
.tr-root.is-touch .tr-squad header span { font-size: 10px; }
.tr-root.is-touch .tr-squad ol { display: flex; flex-wrap: wrap; gap: 2px; margin: 3px 0 0; }
.tr-root.is-touch .tr-squad li { display: block; width: 28px; height: 22px; padding: 2px 0 0; text-align: center; }
.tr-root.is-touch .tr-squad li b, .tr-root.is-touch .tr-squad li span, .tr-root.is-touch .tr-squad footer { display: none; }
.tr-root.is-touch .tr-squad li em { font-size: 9.5px; }
.tr-root.is-touch .tr-radio { left: calc(var(--pad-l, 0px) + 108px); top: 64px; transform: none; width: 188px; }
.tr-root.is-touch .tr-msg { font-size: 10.5px; padding: 1px 4px; }
@media (max-width: 720px), (max-height: 480px) {
  .tr-squad { width: 168px; top: 34%; padding: 4px 6px; }
  .tr-squad li { grid-template-columns: 26px 1fr; font-size: 11.5px; }
  .tr-squad li span, .tr-squad footer { display: none; }
  .tr-radio { width: 240px; }
  .tr-msg { font-size: 11px; }
  .tr-front { font-size: 11px; gap: 6px; }
  .tr-front .is-lock { display: none; }
  .tr-solrow { grid-template-columns: 34px 1fr; }
}
`;
