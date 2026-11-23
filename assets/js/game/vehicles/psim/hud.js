// NULLPUNKT — Panzersimulation: Bordsprech/Funk (Untertitel + optionale Sprachausgabe), HUD-Ebene des Modus:
// Besatzungs- und Modulstatus, Gestell je Munitionsart, Befehlsanzeige für den Fahrer, Wegmarke, Hotspot-Markierung
// (Simulation: Bedienelement im Blick), Befehlsrad (Taste „Befehlsrad“ halten), Bedienhilfe, Prüfliste der Handgriffe.
// Rein darstellend (DOM); Logik in modes/panzer.js, crew-ai.js und sim.js.
import { KINDS, kindOf, MOD_LABEL, modsOf } from './ammo.js?v=20261123082814';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
#psim{position:absolute;inset:0;pointer-events:none;font-family:"Barlow Condensed","Roboto Condensed",system-ui,sans-serif;color:#e8e4d6;z-index:6}
#psim [hidden]{display:none!important}
.ps-sub{position:absolute;left:50%;bottom:17%;transform:translateX(-50%);width:min(700px,52vw);display:flex;flex-direction:column;gap:4px;align-items:center}
.ps-line{background:rgba(8,10,8,.72);border-left:3px solid #9fb07a;padding:4px 10px;font-size:clamp(13px,1.35vw,17px);letter-spacing:.02em;max-width:100%;transition:opacity .4s}
.ps-line b{color:#c9d79f;font-weight:600;margin-right:8px;text-transform:uppercase;font-size:.8em;letter-spacing:.08em}
.ps-line.is-funk{border-left-color:#d8a64a}.ps-line.is-funk b{color:#e7c27a}
.ps-line.is-me{border-left-color:#6fa8dc}.ps-line.is-me b{color:#9cc6ee}
.ps-line.is-warn{border-left-color:#d8543c}.ps-line.is-warn b{color:#f08a74}
/* Aufräumen 19.11.: links unten eine Spalte (Kopf mit Fahrzeug/Tempo/Hülle, Besatzung, Munition, Zustand), rechts eine Spalte
   (Sichtgerät, Hilfe-Hinweis, Handgriffe ODER Bedienhilfe), Bordsprech unten mittig (höchstens 3 Zeilen, ein Hinweis zur Zeit).
   Das alte Fahrzeug-HUD (.vh-panel: Name, Zonen, Waffen-/Munitionsliste, Gestell) ist im Modus aus – nichts doppelt. */
.ps-side{position:absolute;left:calc(14px + env(safe-area-inset-left));bottom:15%;display:flex;flex-direction:column;gap:5px;width:236px;font-size:12.5px;max-height:62vh;overflow:hidden}
.ps-head{display:flex;align-items:baseline;justify-content:space-between;gap:6px;padding:5px 9px;background:rgba(10,12,10,.62);border:1px solid rgba(200,200,170,.16)}
.ps-head b{font-size:14px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ps-head span{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}.ps-head small{font-size:11px;opacity:.75;margin-left:2px}
.ps-hull{height:4px;margin:-3px 0 0;background:rgba(233,230,223,.16)}.ps-hull i{display:block;height:100%;background:#9fd37a;transform-origin:left}
.ps-hull.is-low i{background:#e7c35a}.ps-hull.is-crit i{background:#e5634b}
.ps-side.is-tight .ps-crewl{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}.ps-side.is-tight .ps-crewl .ps-row{font-size:11px}.ps-side.is-tight .ps-box h4{display:none}
.ps-right{position:absolute;right:calc(14px + env(safe-area-inset-right));top:25%;width:280px;display:flex;flex-direction:column;align-items:stretch;gap:6px;max-height:58vh;overflow:hidden}
.ps-right>*{position:static!important;width:auto!important}
.ps-box{background:rgba(10,12,10,.62);border:1px solid rgba(200,200,170,.16);padding:7px 9px}
.ps-box h4{margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a9b08e;font-weight:600}
.ps-row{display:flex;justify-content:space-between;gap:6px;line-height:1.35;white-space:nowrap}.ps-row i{overflow:hidden;text-overflow:ellipsis}
.ps-row i{font-style:normal;color:#bdbca9}.ps-row em{font-style:normal;font-size:12px;opacity:.85}
.ps-ok{color:#9fd37a}.ps-hurt{color:#e7c35a}.ps-dead{color:#e5634b}.ps-me{color:#9cc6ee}
.ps-mods{display:flex;flex-wrap:wrap;gap:3px 4px}.ps-mods span{white-space:nowrap;padding:1px 5px;border-radius:2px;background:rgba(233,230,223,.08);font-size:11.5px}
.ps-mods span.ps-hurt{background:rgba(231,195,90,.16)}.ps-mods span.ps-dead{background:rgba(229,99,75,.2)}
.ps-row kbd{font:inherit;font-size:.85em;background:#2a2c26;border:1px solid #6a6c5e;border-radius:3px;padding:0 4px;margin-right:5px}
.ps-row .ps-short{display:none}
.ps-ammo .ps-row.is-sel{background:rgba(160,180,120,.16)}
.ps-ammo .ps-row.is-load i::after{content:" ●";color:#e7c35a}
.ps-ord{position:absolute;left:50%;top:13%;transform:translateX(-50%);text-align:center;font-size:clamp(20px,3vw,34px);letter-spacing:.16em;text-transform:uppercase;color:#f0e6c0;text-shadow:0 2px 6px #000}
.ps-ord small{display:block;font-size:13px;letter-spacing:.1em;opacity:.8}
.ps-mark{position:absolute;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border:2px solid #e7c27a;transform-origin:center;transform:rotate(45deg);box-shadow:0 0 6px rgba(0,0,0,.8)}
.ps-mark span{position:absolute;left:30px;top:-6px;transform:rotate(-45deg);white-space:nowrap;font-size:12px;color:#e7c27a}
.ps-tgt{position:absolute;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border:2px dashed #e5634b;border-radius:50%}
.ps-tgt span{position:absolute;left:40px;top:6px;white-space:nowrap;font-size:12px;color:#f08a74}
.ps-hot{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid rgba(255,214,120,.95);box-shadow:0 0 12px rgba(255,200,90,.6),inset 0 0 8px rgba(255,200,90,.4);animation:psPulse 1s ease-in-out infinite}
.ps-hot span{position:absolute;left:52px;top:6px;white-space:nowrap;background:rgba(10,10,8,.78);padding:3px 8px;font-size:14px;border-left:2px solid #ffd678}
.ps-hot span kbd,.ps-help kbd,.ps-steps kbd{font:inherit;font-size:.85em;background:#2a2c26;border:1px solid #6a6c5e;border-radius:3px;padding:0 4px;margin:0 2px}
@keyframes psPulse{50%{transform:scale(1.12)}}
.ps-next{border-color:rgba(120,200,255,.95);box-shadow:0 0 12px rgba(90,170,255,.6)}.ps-next span{border-left-color:#7cc4ff}
.ps-why{margin:6px 0 0;font-size:12px;color:#cfd8b8;line-height:1.35}.ps-hint{font-size:12px;background:rgba(10,12,10,.6);padding:3px 8px;align-self:flex-end}
.ps-dot{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:rgba(255,240,200,.85);box-shadow:0 0 3px #000}
.ps-steps{font-size:13px}
.ps-steps li{list-style:none;padding:2px 0 2px 20px;position:relative;opacity:.75}
.ps-steps li::before{content:"";position:absolute;left:2px;top:6px;width:10px;height:10px;border:1px solid #a9b08e}
.ps-steps li.is-done{opacity:.5;text-decoration:line-through}.ps-steps li.is-done::before{background:#9fd37a;border-color:#9fd37a}
.ps-steps li.is-next{opacity:1;color:#ffe2a0}.ps-steps li.is-next::before{border-color:#ffd678}
.ps-steps ul{margin:0;padding:0}
.ps-help{font-size:12.5px;line-height:1.45}.ps-help h4{margin:0 0 4px}.ps-help p{margin:0 0 2px}
.ps-help p{margin:0}
.ps-wheel{position:absolute;left:50%;top:50%;width:380px;height:380px;margin:-190px 0 0 -190px}
.ps-wheel svg{width:100%;height:100%}
.ps-wheel path{fill:rgba(10,12,10,.72);stroke:rgba(220,210,170,.35);stroke-width:1}
.ps-wheel path.is-on{fill:rgba(150,170,100,.55)}
.ps-wheel text{fill:#efe8cf;font-size:9px;text-anchor:middle;dominant-baseline:middle;font-family:inherit;letter-spacing:.04em}
.ps-wheel .ps-wc{fill:#c9d79f;font-size:10px;letter-spacing:.14em}
.ps-wheel text.ps-ws{font-size:7px;fill:#bdbca9}.ps-wheel path.is-cur{fill:rgba(90,130,170,.5)}.ps-wheel path.is-off{fill:rgba(10,12,10,.4)}
.ps-swhint{position:absolute;left:50%;top:calc(50% + 200px);transform:translateX(-50%);font-size:13px;background:rgba(10,12,10,.6);padding:3px 10px;white-space:nowrap}
.ps-crack{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 0,rgba(0,0,0,.2) 40%,rgba(0,0,0,.95) 75%);}
.ps-crack svg{position:absolute;inset:0;width:100%;height:100%}
.ps-crack p{position:absolute;left:50%;top:60%;transform:translateX(-50%);font-size:18px;color:#f08a74;text-shadow:0 1px 3px #000;letter-spacing:.08em}
.ps-banner{position:absolute;left:50%;top:30%;transform:translateX(-50%);font-size:clamp(22px,3.4vw,40px);letter-spacing:.2em;text-transform:uppercase;text-shadow:0 2px 8px #000;color:#f3e7c0}
.ps-vis{font-size:12px;letter-spacing:.12em;background:rgba(10,12,10,.6);padding:3px 8px;color:#c9d79f;align-self:flex-end}
.psim-on .vh-panel,.psim-on .vh-rack,.psim-on .vh-seats{display:none!important}
.psim-on .vo-load{bottom:calc(4% + env(safe-area-inset-bottom))}
.psim-on .vo-arrow{top:66%}
/* Handy/kleine Fenster: alles kompakter; Touch (quer): Zustand rechts oben unter der Pause, Handgriffe links unter der Minikarte,
   Bordsprech schmal zwischen Stick und Feuerknöpfen, Bedienhilfe aus (Tastatur) */
@media (max-height:560px),(max-width:900px){
  .ps-side{width:188px;font-size:11px;bottom:12%;gap:3px;max-height:70vh}.ps-box{padding:4px 7px}.ps-box h4{font-size:10px;margin-bottom:2px}.ps-row{line-height:1.25}
  .ps-head{padding:3px 7px}.ps-head b{font-size:12px}.ps-head span{font-size:13px}
  .ps-right{width:210px;top:22%}.ps-steps{font-size:11.5px}.ps-steps li{padding:1px 0 1px 18px}.ps-steps li::before{top:4px;width:9px;height:9px}.ps-why{font-size:11px;margin-top:3px}
  .ps-help{display:none!important}.ps-line{font-size:13px;padding:3px 8px}.ps-sub{width:min(560px,56vw);bottom:14%}
}
/* Touch (Handy quer): Knöpfe belegen die Ränder – oben rechts nur Kopf + Munition als Kürzel (Zustand nur bei Schaden), Handgriffe
   als eine Zeile (nächster Schritt) oben mittig unter dem Funk, Bordsprech schmal über dem Waffenknopf */
body[data-input-mode="touch"] .ps-side{left:auto;right:calc(8px + env(safe-area-inset-right));top:56px;bottom:auto;width:176px;font-size:10.5px;max-height:none;gap:2px}
body[data-input-mode="touch"] .ps-side .ps-crew,body[data-input-mode="touch"] .ps-box h4,body[data-input-mode="touch"] .ps-ammol .ps-row:last-child em:only-child{display:none}
body[data-input-mode="touch"] .ps-side .ps-mbox{display:none}body[data-input-mode="touch"] .ps-side.has-dmg .ps-mbox{display:block}
body[data-input-mode="touch"] .ps-ammo{padding:2px 5px}
body[data-input-mode="touch"] .ps-ammol{display:flex;flex-wrap:wrap;gap:2px 6px}
body[data-input-mode="touch"] .ps-ammol .ps-row{gap:3px;line-height:1.2}
body[data-input-mode="touch"] .ps-ammol .ps-row i .ps-long,body[data-input-mode="touch"] .ps-row kbd{display:none}
body[data-input-mode="touch"] .ps-ammol .ps-row i .ps-short{display:inline}
body[data-input-mode="touch"] .ps-right{right:auto;left:50%;transform:translateX(-50%);top:92px;width:auto!important;max-width:46vw;max-height:none;align-items:center}
body[data-input-mode="touch"] .ps-steps{padding:3px 8px;font-size:12px}
body[data-input-mode="touch"] .ps-steps h4,body[data-input-mode="touch"] .ps-steps li:not(.is-next),body[data-input-mode="touch"] .ps-why,body[data-input-mode="touch"] .ps-steps kbd,body[data-input-mode="touch"] .ps-hint{display:none!important}
body[data-input-mode="touch"] .ps-steps li{padding-left:18px}
body[data-input-mode="touch"] .ps-help{display:none!important}
body[data-input-mode="touch"] .ps-sub{bottom:15%;width:min(400px,40vw)}
body[data-input-mode="touch"] .ps-line{font-size:12px;padding:2px 7px}
body[data-input-mode="touch"] .ps-ord{top:22%;font-size:20px}
`;

/** Bordsprech/Funk: Zeilen mit Sprecher, Dauer nach Textlänge, Sprachausgabe (de-DE) wenn verfügbar und an. */
export class Radio {
  constructor(mode, host) {
    this.mode = mode;
    this.box = host;
    this.lines = [];
    this.voice = false;
    this._last = new Map();
    this._q = [];
    this._speaking = false;
  }

  say(from, text, { key = null, tone = null, quiet = false, prio = 0 } = {}) {
    if (!text) return;
    // Funkgerät aus bzw. falscher Kanal (Funkerplatz, Simulation): keine Meldungen der Kompanie
    if (from === 'Funk' && this.mode.funkMuted && this.mode.funkMuted()) return;
    const G = this.mode.G, now = G.time.elapsed;
    // Wiederholung derselben Meldung unterdrücken
    const k = `${from}|${text}`;
    if (now - (this._last.get(k) ?? -99) < 2.5) return;
    this._last.set(k, now);
    const me = this.mode.roleLabel && from === this.mode.roleLabel();
    const cls = tone || (from === 'Funk' ? 'funk' : me ? 'me' : '');
    const life = 2.6 + text.length * 0.045;
    const line = { from: me ? `${from} (du)` : from, text, until: now + life, cls, el: null };
    // höchstens ein Hinweis zur Zeit (ersetzt den vorigen), höchstens drei Zeilen insgesamt
    if (from === 'Hinweis') for (let i = this.lines.length - 1; i >= 0; i--) if (this.lines[i].hint) { this.lines[i].el?.remove(); this.lines.splice(i, 1); }
    line.hint = from === 'Hinweis';
    this.lines.push(line);
    while (this.lines.length > 3) { const old = this.lines.shift(); old.el?.remove(); }
    const el = document.createElement('div');
    el.className = `ps-line${cls ? ' is-' + cls : ''}`;
    el.innerHTML = `<b>${esc(line.from)}</b>${esc(text)}`;
    this.box.appendChild(el);
    line.el = el;
    this.mode.G.events.emit('psim:radio', { from, text, key });
    this._click();
    if (this.voice && !me && !quiet) this._speak(text, from);
    void prio;
  }

  _click() {
    const A = this.mode.G.vehicles && this.mode.G.vehicles.audio;
    const ctx = A && A._ctx, dest = A && A._dest && A._dest();
    if (!ctx || !dest) return;
    try {
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.05);
      g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.07);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.08);
    } catch { /* */ }
  }

  _speak(text, from) {
    const S = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!S || typeof SpeechSynthesisUtterance === 'undefined') return;
    try {
      if (S.speaking && this._q.length > 2) return;
      const u = new SpeechSynthesisUtterance(text.replace(/–/g, ','));
      u.lang = 'de-DE';
      const vs = S.getVoices ? S.getVoices().filter((x) => /^de/i.test(x.lang)) : [];
      if (vs.length) u.voice = vs[(from.length + (from === 'Kommandant' ? 0 : 1)) % vs.length];
      u.rate = from === 'Kommandant' ? 1.12 : 1.05; u.pitch = from === 'Fahrer' ? 0.85 : from === 'Ladeschütze' ? 1.1 : 0.95;
      u.volume = 0.9;
      S.speak(u);
    } catch { /* keine Stimme */ }
  }

  update() {
    const now = this.mode.G.time.elapsed;
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const L = this.lines[i];
      if (now > L.until) { L.el?.remove(); this.lines.splice(i, 1); } else if (now > L.until - 0.5 && L.el) L.el.style.opacity = '0';
    }
  }

  clear() { for (const L of this.lines) L.el?.remove(); this.lines.length = 0; try { window.speechSynthesis?.cancel(); } catch { /* */ } }
}

const WHEEL_ITEMS = [
  { id: 'vor', label: 'Marsch!' }, { id: 'rechts', label: 'Rechts!' }, { id: 'feuer', label: 'Feuer!' }, { id: 'rumpf', label: 'Front zum Ziel' },
  { id: 'halt', label: 'Halt!' }, { id: 'deckung', label: 'Deckung!' }, { id: 'markierung', label: 'Zur Markierung' }, { id: 'links', label: 'Links!' },
  { id: 'zurueck', label: 'Zurück!' }, { id: 'feuerfrei', label: 'Feuer frei/einst.' }, { id: 'uebergabe', label: 'Ziel übergeben' }, { id: 'ammo', label: 'Munition ↻' },
];

export class PanzerHUD {
  constructor(mode) {
    this.mode = mode;
    if (!document.getElementById('psim-css')) {
      const st = document.createElement('style'); st.id = 'psim-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const host = document.getElementById('hud') || document.body;
    const r = document.createElement('div');
    r.id = 'psim';
    r.innerHTML = `
      <div class="ps-crack" hidden></div>
      <div class="ps-dot" hidden></div>
      <div class="ps-mark" hidden><span>Markierung</span></div>
      <div class="ps-tgt" hidden><span></span></div>
      <div class="ps-hot" hidden><span></span></div>
      <div class="ps-hot ps-next" hidden><span></span></div>
      <div class="ps-ord" hidden></div>
      <div class="ps-side">
        <div class="ps-head"><b></b><span></span></div><div class="ps-hull"><i></i></div>
        <div class="ps-box ps-crew"><h4>Besatzung</h4><div class="ps-crewl"></div></div>
        <div class="ps-box ps-ammo"><h4>Munition</h4><div class="ps-ammol"></div></div>
        <div class="ps-box ps-mbox"><h4>Zustand</h4><div class="ps-mods"></div></div>
      </div>
      <div class="ps-right">
        <div class="ps-vis" hidden></div>
        <div class="ps-hint" hidden></div>
        <div class="ps-box ps-steps" hidden><h4>Handgriffe</h4><ul></ul><p class="ps-why" hidden></p></div>
        <div class="ps-box ps-help" hidden></div>
      </div>
      <div class="ps-wheel" hidden></div>
      <div class="ps-wheel ps-seatw" hidden></div>
      <div class="ps-swhint" hidden>Maus/Stick: Platz wählen · loslassen: wechseln</div>
      <div class="ps-banner" hidden></div>
      <div class="ps-sub"></div>`;
    host.appendChild(r);
    this.root = r;
    const q = (s) => r.querySelector(s);
    this.el = {
      crew: q('.ps-crewl'), ammo: q('.ps-ammol'), mods: q('.ps-mods'), ord: q('.ps-ord'), mark: q('.ps-mark'), tgt: q('.ps-tgt'), tgtL: q('.ps-tgt span'),
      hot: q('.ps-hot:not(.ps-next)'), hotL: q('.ps-hot:not(.ps-next) span'), next: q('.ps-next'), nextL: q('.ps-next span'), steps: q('.ps-steps'), stepsL: q('.ps-steps ul'), why: q('.ps-why'), hint: q('.ps-hint'), help: q('.ps-help'), wheel: q('.ps-wheel:not(.ps-seatw)'), seatw: q('.ps-seatw'), swhint: q('.ps-swhint'),
      sub: q('.ps-sub'), crack: q('.ps-crack'), banner: q('.ps-banner'), dot: q('.ps-dot'), vis: q('.ps-vis'), side: q('.ps-side'), right: q('.ps-right'),
      headN: q('.ps-head b'), headS: q('.ps-head span'), hull: q('.ps-hull'), hullI: q('.ps-hull i'),
    };
    this._c = {};
    this._t = 0;
    this.wheelItems = WHEEL_ITEMS;
    this._buildWheel();
    this.el.crack.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M50 50 L18 22 M50 50 L82 30 M50 50 L64 88 M50 50 L22 70 M50 50 L40 6 M34 36 L26 48 M66 40 L76 52" stroke="rgba(230,230,220,.55)" stroke-width=".35" fill="none"/></svg><p>Hauptzieloptik ausgefallen – Hilfsvisier (Sicht wechseln)</p>`;
  }

  _set(k, el, prop, v) {
    if (this._c[k] === v) return;
    this._c[k] = v;
    if (prop === 'hidden') el.hidden = !!v;
    else if (prop === 'html') el.innerHTML = v;
    else if (prop === 'text') el.textContent = v;
    else if (prop === 'tf') el.style.transform = v;
  }

  _buildWheel() {
    const n = this.wheelItems.length, seg = (Math.PI * 2) / n, r0 = 34, r1 = 96;
    const p = (r, a) => `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`;
    let s = '<svg viewBox="-100 -100 200 200">';
    this.wheelItems.forEach((it, i) => {
      const a0 = i * seg - seg / 2 + 0.03, a1 = i * seg + seg / 2 - 0.03, am = i * seg;
      s += `<path data-i="${i}" d="M${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z"/>`;
      s += `<text x="${(Math.sin(am) * 66).toFixed(1)}" y="${(-Math.cos(am) * 66).toFixed(1)}">${esc(it.label)}</text>`;
    });
    s += '<text class="ps-wc" x="0" y="0">BEFEHL</text></svg>';
    this.el.wheel.innerHTML = s;
    this.wheelPaths = [...this.el.wheel.querySelectorAll('path')];
  }

  setWheel(open, sel = -1) {
    this._set('wheelH', this.el.wheel, 'hidden', !open);
    if (!open) return;
    if (this._c.wsel === sel) return;
    this._c.wsel = sel;
    this.wheelPaths.forEach((p, i) => p.classList.toggle('is-on', i === sel));
  }

  /** Sitzrad (Platzwechsel, Taste „Sitzrad“ halten): items [{ label, sub, cur, off }], sel = gewählter Eintrag. */
  setSeatWheel(open, items = null, sel = -1) {
    const el = this.el.seatw;
    this._set('swH', el, 'hidden', !open);
    this._set('swhH', this.el.swhint, 'hidden', !open);
    if (!open || !items) return;
    const key = items.map((i) => `${i.label}|${i.sub}|${i.cur ? 1 : 0}|${i.off ? 1 : 0}`).join(';');
    if (this._c.swKey !== key) {
      this._c.swKey = key; this._c.swSel = null;
      const n = items.length, seg = (Math.PI * 2) / n, r0 = 34, r1 = 96;
      const p = (r, a) => `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`;
      let h = '<svg viewBox="-100 -100 200 200">';
      items.forEach((it, i) => {
        const a0 = i * seg - seg / 2 + 0.03, a1 = i * seg + seg / 2 - 0.03, am = i * seg;
        h += `<path class="${it.cur ? 'is-cur' : it.off ? 'is-off' : ''}" d="M${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z"/>`;
        const tx = Math.sin(am) * 65, ty = -Math.cos(am) * 65;
        h += `<text x="${tx.toFixed(1)}" y="${(ty - 4).toFixed(1)}">${esc(it.label)}</text><text class="ps-ws" x="${tx.toFixed(1)}" y="${(ty + 7).toFixed(1)}">${esc(it.sub || '')}</text>`;
      });
      h += '<text class="ps-wc" x="0" y="0">PLATZ</text></svg>';
      el.innerHTML = h;
      this.seatPaths = [...el.querySelectorAll('path')];
    }
    if (this._c.swSel === sel) return;
    this._c.swSel = sel;
    this.seatPaths.forEach((pp, i) => pp.classList.toggle('is-on', i === sel));
  }

  update(dt, s) {
    this._t -= dt;
    const el = this.el;
    // Projektionen jedes Bild
    const proj = (key, node, p, label, labelEl) => {
      if (!p || !p.on) { this._set(key + 'H', node, 'hidden', true); return; }
      this._set(key + 'H', node, 'hidden', false);
      node.style.left = `${p.x.toFixed(1)}px`; node.style.top = `${p.y.toFixed(1)}px`;
      if (labelEl && label != null) this._set(key + 'L', labelEl, 'html', label);
    };
    proj('mark', el.mark, s.mark, null, null);
    proj('tgt', el.tgt, s.target, s.targetLabel || '', el.tgtL);
    proj('hot', el.hot, s.hot, s.hotLabel || '', el.hotL);
    proj('next', el.next, s.next, s.nextLabel || '', el.nextL);
    this._set('dotH', el.dot, 'hidden', !s.dot);
    this._set('crackH', el.crack, 'hidden', !s.crack);
    this._set('ordH', el.ord, 'hidden', !s.order);
    if (s.order) this._set('ordT', el.ord, 'html', s.order);
    this._set('visH', el.vis, 'hidden', !s.vision);
    if (s.vision) this._set('visT', el.vis, 'text', s.vision);
    this._set('banH', el.banner, 'hidden', !s.banner);
    if (s.banner) this._set('banT', el.banner, 'text', s.banner);
    this._set('sideH', el.side, 'hidden', !s.visible);
    this._set('rightH', el.right, 'hidden', !s.visible);
    if (this._t > 0) return;
    this._t = 0.2;
    // Linke Spalte unter einer Zielliste (Kampagne, s.reserveTop = Unterkante in px) halten statt sie zu überdecken
    if (s.visible && typeof window !== 'undefined' && document.body.dataset.inputMode !== 'touch') {
      const vh = window.innerHeight || 720, h = el.side.offsetHeight || 0;
      const top = Math.max(vh * 0.85 - h, s.reserveTop || 0);
      const tight = top + h > vh - 6;
      if (this._c.sideTop !== Math.round(top)) { this._c.sideTop = Math.round(top); el.side.style.top = `${Math.round(top)}px`; el.side.style.bottom = 'auto'; }
      if (this._c.tight !== tight) { this._c.tight = tight; el.side.classList.toggle('is-tight', tight); }
    } else if (this._c.sideTop != null) { this._c.sideTop = null; el.side.style.top = ''; el.side.style.bottom = ''; }
    // Kopf: Fahrzeug, Tempo, Hülle (ersetzt die Fahrzeugtafel des Fahrzeug-HUDs)
    const V = s.vehicle;
    if (V) {
      this._set('headN', el.headN, 'text', V.def.name || '');
      this._set('headS', el.headS, 'html', `${Math.round(Math.abs(V.body.speed) * 3.6)}<small>km/h</small>`);
      const hp = Math.max(0, Math.min(1, V.health / (V.maxHealth || 1)));
      this._set('hullT', el.hullI, 'tf', `scaleX(${hp.toFixed(3)})`);
      const hc = hp < 0.3 ? 'ps-hull is-crit' : hp < 0.6 ? 'ps-hull is-low' : 'ps-hull';
      if (this._c.hullC !== hc) { this._c.hullC = hc; el.hull.className = hc; }
    }
    // Besatzung
    const crew = (s.crew || []).map((c) => `<div class="ps-row"><i class="${c.me ? 'ps-me' : ''}">${esc(c.role)}</i><em class="${c.cls}">${esc(c.state)}</em></div>`).join('');
    this._set('crew', el.crew, 'html', crew);
    // Munition
    const ammo = (s.ammo || []).map((a) => `<div class="ps-row${a.sel ? ' is-sel' : ''}${a.loaded ? ' is-load' : ''}"><i>${a.key ? `<kbd>${esc(a.key)}</kbd>` : ''}<span class="ps-long">${esc(a.label)}</span><span class="ps-short">${esc(a.short || '')}</span></i><em>${a.n}</em></div>`).join('') + (s.loadText ? `<div class="ps-row"><em>${esc(s.loadText)}</em></div>` : '');
    this._set('ammo', el.ammo, 'html', ammo);
    // Module
    const mods = s.vehicle ? modsOf(s.vehicle) : null;
    if (mods) {
      // nur Abweichungen als Plaketten (kein Umbruch in Spalten); alles heil → eine Zeile
      const bad = ['motor', 'ketten', 'turm', 'optik', 'rohr', 'munition', 'funk'].filter((k) => mods[k] < 1);
      const m = (mods.brand > 0 ? '<span class="ps-dead">Brand!</span>' : '')
        + bad.map((k) => `<span class="${mods[k] > 0 ? 'ps-hurt' : 'ps-dead'}">${MOD_LABEL[k]} ${mods[k] > 0 ? 'beschädigt' : 'ausgefallen'}</span>`).join('')
        || '<span class="ps-ok">Alle Baugruppen i. O.</span>';
      this._set('mods', el.mods, 'html', m);
      const dmg = bad.length > 0 || mods.brand > 0;
      if (this._c.dmg !== dmg) { this._c.dmg = dmg; el.side.classList.toggle('has-dmg', dmg); }
    }
    // Prüfliste / Hilfe
    const st = s.steps;
    this._set('stepsH', el.steps, 'hidden', !st || !st.length);
    if (st && st.length) {
      let next = false;
      this._set('steps', el.stepsL, 'html', st.map((x) => { const cls = x.done ? 'is-done' : !next ? (next = true, 'is-next') : ''; return `<li class="${cls}">${x.html}</li>`; }).join(''));
    }
    this._set('whyH', el.why, 'hidden', !s.stepWhy);
    if (s.stepWhy) this._set('why', el.why, 'text', s.stepWhy);
    this._set('hintH', el.hint, 'hidden', !s.stepHint);
    if (s.stepHint) this._set('hint', el.hint, 'html', s.stepHint);
    this._set('helpH', el.help, 'hidden', !s.help);
    if (s.help) this._set('help', el.help, 'html', s.help);
  }

  dispose() { this.root.remove(); }
}

/** Gestellzeilen für das HUD. */
export function ammoRows(v, keyOf = null, sel = null) {
  const g = v && v.gun;
  if (!g || !v._psimAmmo) return [];
  return v._psimAmmo.map((id, i) => {
    const k = kindOf(id);
    return { label: KINDS[k].label, short: KINDS[k].short, n: g.rack[id] | 0, sel: id === sel, loaded: g.loaded === id && g.step === 'geladen', key: keyOf ? keyOf(i) : null };
  });
}
