// NULLPUNKT — Kampagne: Bildschirm-Ebene (#np-campaign über HUD und Touch-Steuerung).
//
// Zwischensequenz: Kinobalken (Letterbox), Ortseinblendung, Untertitel-Box mit Sprechername (Farbe je Figur,
// gerade gesprochenes Wort hervorgehoben), Knopf „Überspringen“ (Touch/Maus; Tastatur: Leertaste/Eingabe, Gamepad A),
// Abblende. Mission: Zielliste (oben links, Häkchen, Zähler, Fortschrittsbalken), Wegpunkt mit Entfernung (am
// Bildrand als Pfeil), Funksprüche als Untertitel, Titelkarte, Hinweise (Checkpoint, Tipp), Fehlschlag-Tafel.
// Am Handy: Untertitel groß genug (min. 15 px), Balken schmaler, Knöpfe ≥ 44 px, nichts über den Steuerknöpfen
// (Zielliste schmal und klein, Untertitel mittig über dem Feuerknopf-Bereich).

import * as THREE from 'three';

const CSS = `
body[data-cutscene="1"] #hud, body[data-cutscene="1"] #hud-top, body[data-cutscene="1"] #touch-ui, body[data-cutscene="1"] #lock-hint, body[data-cutscene="1"] .ht-root { visibility: hidden !important; }
#np-campaign { position: absolute; inset: 0; z-index: 40; pointer-events: none; font-family: var(--np-font, 'Inter', system-ui, sans-serif); color: #ece9e2; }
#np-campaign[hidden] { display: none; }
#np-campaign .kc-fade { position: absolute; inset: 0; background: #000; opacity: 0; transition: opacity .5s linear; }
#np-campaign .kc-bar { position: absolute; left: 0; right: 0; height: 0; background: #000; transition: height .6s cubic-bezier(.3,.7,.2,1); }
#np-campaign .kc-bar.top { top: 0; } #np-campaign .kc-bar.bot { bottom: 0; }
#np-campaign.is-cine .kc-bar { height: 11vh; }
#np-campaign .kc-loc { position: absolute; left: 4vw; top: calc(11vh + 14px); opacity: 0; transition: opacity .8s; text-shadow: 0 1px 3px #000; }
#np-campaign .kc-loc.on { opacity: 1; }
#np-campaign .kc-loc b { display: block; font-size: clamp(16px, 2.2vw, 26px); letter-spacing: .14em; text-transform: uppercase; font-weight: 700; }
#np-campaign .kc-loc small { display: block; font-size: clamp(12px, 1.4vw, 15px); color: #c9c4b8; letter-spacing: .06em; margin-top: 2px; }
#np-campaign .kc-sub { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(11vh + 12px); width: min(78vw, 880px); text-align: center;
  background: rgba(8,9,11,.78); border-radius: 6px; padding: 10px 16px 12px; opacity: 0; transition: opacity .18s; box-shadow: 0 4px 18px rgba(0,0,0,.35); }
#np-campaign .kc-sub.on { opacity: 1; }
#np-campaign .kc-sub .kc-who { display: block; font-size: clamp(12px, 1.3vw, 14px); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 3px; }
#np-campaign .kc-sub .kc-txt { font-size: clamp(16px, 2.05vw, 23px); line-height: 1.32; }
#np-campaign .kc-sub .kc-txt i { font-style: normal; color: #fff; }
#np-campaign .kc-sub .kc-txt i.said { color: #fff; } #np-campaign .kc-sub .kc-txt i.todo { color: #b7b2a7; }
#np-campaign .kc-sub.radio { bottom: 21vh; width: min(64vw, 720px); background: rgba(8,9,11,.66); padding: 7px 14px 9px; }
#np-campaign .kc-sub.radio .kc-txt { font-size: clamp(15px, 1.7vw, 19px); }
#np-campaign .kc-sub.radio .kc-who::before { content: ''; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: currentColor; margin-right: 7px; vertical-align: 1px; animation: kc-pulse 1s infinite; }
@keyframes kc-pulse { 50% { opacity: .25; } }
#np-campaign .kc-skip { position: absolute; right: 3vw; bottom: calc(11vh + 12px); pointer-events: auto; min-height: 44px; min-width: 44px; padding: 0 16px; border-radius: 22px;
  border: 1px solid rgba(255,255,255,.28); background: rgba(10,11,13,.7); color: #ece9e2; font: 600 14px/1 inherit; letter-spacing: .05em; display: none; align-items: center; gap: 8px; cursor: pointer; }
#np-campaign.is-cine .kc-skip { display: inline-flex; }
#np-campaign .kc-skip kbd { font: 600 11px/1 inherit; padding: 3px 5px; border: 1px solid rgba(255,255,255,.35); border-radius: 3px; color: #c9c4b8; }
body[data-input-mode="touch"] #np-campaign .kc-skip kbd { display: none; }
#np-campaign .kc-skip .kc-ring { width: 16px; height: 16px; }
#np-campaign .kc-obj { position: absolute; left: 14px; top: 196px; width: min(300px, 34vw); opacity: 0; transition: opacity .3s; }
#np-campaign.is-play .kc-obj.on { opacity: 1; }
#np-campaign .kc-obj h4 { margin: 0 0 4px; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--np-signal, #ff5b1f); text-shadow: 0 1px 2px #000; }
#np-campaign .kc-obj ul { list-style: none; margin: 0; padding: 0; }
#np-campaign .kc-obj li { position: relative; padding: 4px 8px 5px 24px; margin-bottom: 3px; background: linear-gradient(90deg, rgba(8,9,11,.66), rgba(8,9,11,.18)); font-size: 14px; line-height: 1.25; text-shadow: 0 1px 2px #000; border-left: 2px solid var(--np-signal, #ff5b1f); }
#np-campaign .kc-obj li::before { content: ''; position: absolute; left: 7px; top: 8px; width: 9px; height: 9px; border: 1.6px solid #ece9e2; border-radius: 2px; }
#np-campaign .kc-obj li.done { opacity: .6; border-left-color: var(--np-ok, #5fe08a); }
#np-campaign .kc-obj li.done::before { background: var(--np-ok, #5fe08a); border-color: var(--np-ok, #5fe08a); }
#np-campaign .kc-obj li.opt { border-left-color: #8a867d; }
#np-campaign .kc-obj li small { color: #c9c4b8; margin-left: 6px; font-variant-numeric: tabular-nums; }
#np-campaign .kc-obj li .kc-prog { display: block; height: 3px; margin-top: 4px; background: rgba(255,255,255,.15); }
#np-campaign .kc-obj li .kc-prog u { display: block; height: 100%; background: var(--np-signal, #ff5b1f); transform-origin: left; }
#np-campaign .kc-timer { display: inline-block; margin-top: 2px; padding: 3px 8px; background: rgba(8,9,11,.6); font: 700 15px/1.2 inherit; font-variant-numeric: tabular-nums; }
#np-campaign .kc-timer[hidden] { display: none; }
#np-campaign .kc-wp { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); display: none; flex-direction: column; align-items: center; text-shadow: 0 1px 2px #000; }
#np-campaign.is-play .kc-wp.on { display: flex; }
#np-campaign .kc-wp i { width: 14px; height: 14px; border: 2px solid var(--np-signal, #ff5b1f); transform: rotate(45deg); background: rgba(255,91,31,.25); }
#np-campaign .kc-wp b { margin-top: 5px; font: 700 12px/1 inherit; letter-spacing: .05em; color: #fff; }
#np-campaign .kc-wp span { font: 600 11px/1 inherit; color: #e9e2cf; margin-top: 2px; letter-spacing: .06em; text-transform: uppercase; }
#np-campaign .kc-wp.edge i { border-radius: 0; transform: rotate(var(--a, 0deg)); border: 0; width: 0; height: 0; background: none;
  border-left: 9px solid transparent; border-right: 9px solid transparent; border-bottom: 16px solid var(--np-signal, #ff5b1f); }
#np-campaign .kc-card { position: absolute; left: 50%; top: 36%; transform: translate(-50%, -50%); text-align: center; opacity: 0; transition: opacity .9s; text-shadow: 0 2px 8px #000; }
#np-campaign .kc-card.on { opacity: 1; }
#np-campaign .kc-card small { display: block; font-size: clamp(12px, 1.5vw, 16px); letter-spacing: .3em; text-transform: uppercase; color: var(--np-signal, #ff5b1f); }
#np-campaign .kc-card b { display: block; font-size: clamp(28px, 5vw, 58px); letter-spacing: .08em; text-transform: uppercase; margin-top: 4px; }
#np-campaign .kc-card span { display: block; font-size: clamp(13px, 1.6vw, 18px); color: #d5d0c4; margin-top: 6px; }
#np-campaign .kc-toast { position: absolute; left: 50%; top: 30%; transform: translateX(-50%); padding: 7px 16px; background: rgba(8,9,11,.72); border-left: 3px solid var(--np-ok, #5fe08a);
  font: 600 15px/1.25 inherit; opacity: 0; transition: opacity .3s; white-space: nowrap; max-width: 90vw; overflow: hidden; text-overflow: ellipsis; }
#np-campaign .kc-toast.on { opacity: 1; }
#np-campaign .kc-toast.warn { border-left-color: var(--np-enemy, #ff3b3b); }
#np-campaign .kc-toast.tip { border-left-color: var(--np-gold, #ffc23d); }
#np-campaign .kc-fail { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.62); pointer-events: auto; }
#np-campaign .kc-fail.on { display: flex; }
#np-campaign .kc-fail > div { text-align: center; max-width: 80vw; }
#np-campaign .kc-fail b { display: block; font-size: clamp(26px, 4.5vw, 48px); letter-spacing: .1em; text-transform: uppercase; color: var(--np-enemy, #ff3b3b); }
#np-campaign .kc-fail p { font-size: clamp(14px, 1.8vw, 18px); color: #d5d0c4; margin: 8px 0 18px; }
#np-campaign .kc-fail button { pointer-events: auto; min-height: 46px; padding: 0 20px; margin: 4px; border-radius: 4px; border: 1px solid rgba(255,255,255,.3); background: rgba(20,22,26,.9); color: #fff; font: 600 15px/1 inherit; cursor: pointer; }
#np-campaign .kc-fail button.pri { background: var(--np-signal, #ff5b1f); border-color: transparent; color: #111; }
#np-campaign .kc-hold { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); display: none; text-align: center; font: 600 14px/1.2 inherit; text-shadow: 0 1px 2px #000; }
#np-campaign .kc-hold.on { display: block; }
#np-campaign .kc-hold i { display: block; width: 180px; height: 5px; margin: 6px auto 0; background: rgba(255,255,255,.2); }
#np-campaign .kc-hold i u { display: block; height: 100%; background: var(--np-signal, #ff5b1f); transform-origin: left; }
/* Handy (quer, niedrige Höhe): schmalere Balken, Zielliste kompakt, Untertitel über den Steuerknöpfen */
@media (max-height: 520px) {
  #np-campaign.is-cine .kc-bar { height: 8vh; }
  #np-campaign .kc-loc { top: calc(8vh + 8px); }
  #np-campaign .kc-sub { bottom: calc(8vh + 6px); width: min(84vw, 760px); padding: 7px 12px 9px; }
  #np-campaign .kc-skip { bottom: auto; top: calc(8vh + 8px); right: 12px; }
  #np-campaign .kc-obj { top: 132px; width: min(240px, 34vw); }
  #np-campaign .kc-obj li { font-size: 12.5px; padding: 3px 6px 4px 21px; }
  #np-campaign .kc-obj li::before { top: 6px; left: 6px; width: 8px; height: 8px; }
  #np-campaign .kc-sub.radio { bottom: auto; top: 10px; width: min(56vw, 560px); }
  #np-campaign .kc-card { top: 40%; }
}
/* Kampagne: Punktestand der Teams ist bedeutungslos – Platz für Funksprüche oben */
body[data-campaign="1"] #hud .h-scores { visibility: hidden; }
/* Touch: Zielliste rechts neben der Minikarte (links darunter liegen Zielen-/Stick-Knöpfe) */
body[data-input-mode="touch"] #np-campaign .kc-obj { left: 118px; top: 6px; width: min(200px, 23vw); }
body[data-input-mode="touch"] #np-campaign .kc-obj h4 { font-size: 10px; }
body[data-input-mode="touch"] #np-campaign .kc-obj li { font-size: 12px; padding: 3px 6px 4px 20px; }
body[data-input-mode="touch"] #np-campaign .kc-obj li::before { top: 6px; left: 6px; width: 7px; height: 7px; }
body[data-input-mode="touch"] #np-campaign .kc-sub.radio { bottom: auto; top: 8px; left: calc(50% + 86px); width: min(31vw, 520px); }
body[data-input-mode="touch"] #np-campaign .kc-sub.radio .kc-txt { font-size: 15px; }
`;

let styled = false;
export function ensureCampaignStyles() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.id = 'np-campaign-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _p = new THREE.Vector3();

export class CampaignUI {
  constructor(G) {
    this.G = G;
    ensureCampaignStyles();
    const root = (this.root = document.createElement('div'));
    root.id = 'np-campaign';
    root.innerHTML = `
      <div class="kc-bar top"></div><div class="kc-bar bot"></div>
      <div class="kc-obj"><h4>Auftrag</h4><ul></ul><span class="kc-timer" hidden></span></div>
      <div class="kc-wp"><i></i><b></b><span></span></div>
      <div class="kc-loc"><b></b><small></small></div>
      <div class="kc-card"><small></small><b></b><span></span></div>
      <div class="kc-toast"></div>
      <div class="kc-hold"><span></span><i><u></u></i></div>
      <div class="kc-sub" aria-live="polite"><span class="kc-who"></span><span class="kc-txt"></span></div>
      <button type="button" class="kc-skip" aria-label="Zwischensequenz überspringen"><svg class="kc-ring" viewBox="0 0 24 24" fill="currentColor"><path d="M4 5l9 7-9 7zM13 5l9 7-9 7z"/></svg><span>Überspringen</span><kbd>Leertaste</kbd></button>
      <div class="kc-fail"><div><b>Mission gescheitert</b><p></p><button type="button" class="pri" data-kc="retry">Ab Checkpoint</button><button type="button" data-kc="restart">Mission neu starten</button><button type="button" data-kc="quit">Kampagne</button></div></div>
      <div class="kc-fade"></div>`;
    const host = document.getElementById('game-root') || document.body;
    host.appendChild(root);
    const q = (s) => root.querySelector(s);
    this.el = {
      fade: q('.kc-fade'), obj: q('.kc-obj'), list: q('.kc-obj ul'), timer: q('.kc-timer'), wp: q('.kc-wp'), wpDist: q('.kc-wp b'), wpLabel: q('.kc-wp span'),
      loc: q('.kc-loc'), card: q('.kc-card'), toast: q('.kc-toast'), hold: q('.kc-hold'), sub: q('.kc-sub'), who: q('.kc-who'), txt: q('.kc-txt'),
      skip: q('.kc-skip'), fail: q('.kc-fail'), failText: q('.kc-fail p'),
    };
    this.onSkip = null;
    this.onFail = null;
    this.el.skip.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (this.onSkip) this.onSkip(); });
    this.el.skip.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.fail.addEventListener('click', (e) => {
      const b = e.target.closest('[data-kc]');
      if (b && this.onFail) this.onFail(b.dataset.kc);
    });
    this._toastT = 0;
    this._sub = null; // { words, track } für Wort-Hervorhebung
    this._wpKey = '';
    this._objKey = '';
  }

  dispose() { this.root.remove(); }

  setMode(mode) { // 'cine' | 'play' | null
    this.root.classList.toggle('is-cine', mode === 'cine');
    this.root.classList.toggle('is-play', mode === 'play');
  }

  fade(to, seconds = 0.5) {
    const f = this.el.fade;
    f.style.transitionDuration = `${Math.max(0, seconds)}s`;
    f.style.opacity = String(to);
  }

  location(title, sub = '', on = true) {
    this.el.loc.querySelector('b').textContent = title || '';
    this.el.loc.querySelector('small').textContent = sub || '';
    this.el.loc.classList.toggle('on', !!(on && title));
  }

  card(kicker, title, sub = '', on = true) {
    const c = this.el.card;
    c.querySelector('small').textContent = kicker || '';
    c.querySelector('b').textContent = title || '';
    c.querySelector('span').textContent = sub || '';
    c.classList.toggle('on', !!on);
  }

  /** Untertitel: who { name, color }, text, track (für Wort-Hervorhebung), radio = Funkspruch im Spiel. */
  subtitle(who, text, { track = null, radio = false } = {}) {
    const s = this.el.sub;
    if (!text) { s.classList.remove('on'); this._sub = null; return; }
    s.classList.toggle('radio', !!radio);
    this.el.who.textContent = who && who.name ? who.name : '';
    this.el.who.style.color = (who && who.color) || '#ffc23d';
    // Wörter einzeln (Hervorhebung des gesprochenen Wortes); Satzzeichen bleiben am Wort
    const parts = String(text).split(/(\s+)/);
    this.el.txt.innerHTML = parts.map((p) => (/^\s+$/.test(p) ? p : `<i class="todo">${esc(p)}</i>`)).join('');
    this._sub = { nodes: [...this.el.txt.querySelectorAll('i')], track, last: -1 };
    s.classList.add('on');
  }

  /** Fortschritt der Hervorhebung: Wortindex aus der Zeitachse (lipsync.wordAt) – Wörter bis dahin „gesagt“. */
  subtitleProgress(wordIndex) {
    const S = this._sub;
    if (!S || wordIndex === S.last) return;
    S.last = wordIndex;
    // Zeitachsen-Wörter (nur Buchstabenfolgen) ≈ Anzeigewörter; über die Anzahl abbilden
    const n = S.nodes.length;
    const total = S.track && S.track.words ? S.track.words.length : n;
    const upto = wordIndex < 0 ? (S.track && wordIndex === -2 ? n : -1) : Math.round(((wordIndex + 1) / Math.max(1, total)) * n) - 1;
    for (let i = 0; i < n; i++) S.nodes[i].className = i <= upto ? 'said' : 'todo';
  }

  skipVisible(on) { this.el.skip.style.visibility = on ? '' : 'hidden'; }

  toast(text, kind = 'ok', seconds = 2.6) {
    const t = this.el.toast;
    t.textContent = text;
    t.className = `kc-toast on ${kind}`;
    this._toastT = seconds;
  }

  hold(text, p) {
    const h = this.el.hold;
    if (text == null) { h.classList.remove('on'); return; }
    h.classList.add('on');
    h.querySelector('span').textContent = text;
    h.querySelector('u').style.transform = `scaleX(${Math.max(0, Math.min(1, p)).toFixed(3)})`;
  }

  /** Zielliste: [{ id, text, done, optional, count, total, progress }] */
  objectives(list, title = 'Auftrag') {
    const key = JSON.stringify(list) + title;
    if (key === this._objKey) return;
    this._objKey = key;
    this.el.obj.querySelector('h4').textContent = title;
    this.el.list.innerHTML = list.map((o) => {
      const cnt = Number.isFinite(o.total) && o.total > 0 ? `<small>${o.count | 0}/${o.total}</small>` : '';
      const bar = Number.isFinite(o.progress) && !o.done ? `<span class="kc-prog"><u style="transform:scaleX(${Math.max(0, Math.min(1, o.progress)).toFixed(3)})"></u></span>` : '';
      return `<li class="${o.done ? 'done' : ''}${o.optional ? ' opt' : ''}">${esc(o.text)}${cnt}${bar}</li>`;
    }).join('');
    this.el.obj.classList.toggle('on', list.length > 0);
  }

  timer(seconds, label = '') {
    const t = this.el.timer;
    if (seconds == null || !Number.isFinite(seconds)) { t.hidden = true; return; }
    t.hidden = false;
    const s = Math.max(0, Math.ceil(seconds));
    t.textContent = `${label ? label + ' ' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  fail(text) {
    this.el.failText.textContent = text || '';
    this.el.fail.classList.toggle('on', !!text);
  }

  /** Wegpunkt (Weltpunkt) projizieren; null = aus. label: kurzer Name. */
  waypoint(pos, label = '', camera = this.G.camera, from = null) {
    const w = this.el.wp;
    if (!pos || !camera) { w.classList.remove('on'); return; }
    const canvas = this.G.canvas;
    const W = canvas ? canvas.clientWidth : innerWidth, H = canvas ? canvas.clientHeight : innerHeight;
    _p.copy(pos);
    _p.y += 1.2;
    camera.updateMatrixWorld();
    const d = from ? from.distanceTo(pos) : camera.position.distanceTo(pos);
    _p.project(camera);
    let x = _p.x, y = _p.y;
    const behind = _p.z > 1;
    if (behind) { x = -x; y = -y; }
    const m = 0.9;
    const edge = behind || Math.abs(x) > m || Math.abs(y) > m;
    if (edge) {
      const k = m / Math.max(Math.abs(x), Math.abs(y), 1e-3);
      x *= k; y *= k;
    }
    const px = (x * 0.5 + 0.5) * W, py = (-y * 0.5 + 0.5) * H;
    w.style.left = `${px.toFixed(1)}px`;
    w.style.top = `${py.toFixed(1)}px`;
    w.classList.toggle('edge', edge);
    if (edge) w.style.setProperty('--a', `${(Math.atan2(x, y) * 180) / Math.PI}deg`);
    const txt = `${Math.round(d)} m`;
    if (this._wpKey !== txt + label) { this._wpKey = txt + label; this.el.wpDist.textContent = txt; this.el.wpLabel.textContent = label; }
    w.classList.add('on');
  }

  update(dt) {
    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) this.el.toast.classList.remove('on');
    }
  }
}
