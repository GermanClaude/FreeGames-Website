// NULLPUNKT — Infanteriesimulation: Bildschirm-Ebene (Spielstil „Simulation“). Rein darstellend (DOM in #hud).
// Kein Fadenkreuz, keine Zahlen, keine Gegnermarken – nur, was ein Soldat wirklich sieht oder hört:
//   Zustand als Bild: Entsättigung/Tunnelblick bei Blutverlust, Rotblitz bei Treffern, Schwarz bei Bewusstlosigkeit,
//   Atem-Beschlag bei Erschöpfung. Funk/Sprachmeldungen als Untertitel (+ Sprachausgabe, wenn verfügbar).
//   Gegenstände nur auf Tastendruck: Marschkompass (halten), Karte (halten, Papier, ohne eigene Position),
//   Ausrüstung (Weste/Rucksack mit Gewicht, Umpacken), Ablesung beim Magazin-/Lager-Check (Schätzung in Worten).
//   Führung wie im Panzer-Modus (vehicles/psim/hud.js): Handgriffe als Prüfliste aus dem echten Zustand.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
#isim{position:absolute;inset:0;pointer-events:none;font-family:"Barlow Condensed","Roboto Condensed",system-ui,sans-serif;color:#e8e4d6;z-index:6}
#isim [hidden]{display:none!important}
.is-desat{position:absolute;inset:0;background:#808080;mix-blend-mode:saturation;opacity:0;transition:opacity .6s}
.is-vig{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 30%,rgba(0,0,0,.55) 62%,rgba(0,0,0,.97) 92%)}
.is-red{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at 50% 50%,rgba(120,0,0,0) 35%,rgba(140,10,0,.55) 80%,rgba(90,0,0,.85) 100%)}
.is-black{position:absolute;inset:0;background:#000;opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;transition:opacity .25s}
.is-black p{margin:0;font-size:clamp(15px,1.6vw,20px);letter-spacing:.12em;color:#9a9284;text-transform:uppercase}
.is-black small{font-size:13px;color:#7d776c;letter-spacing:.06em}
.is-black kbd,.is-guide kbd,.is-inv kbd,.is-hint kbd{font:inherit;font-size:.85em;background:#2a2c26;border:1px solid #6a6c5e;border-radius:3px;padding:0 4px;margin:0 2px;color:#e8e4d6}
.is-sub{position:absolute;left:50%;bottom:15%;transform:translateX(-50%);width:min(680px,56vw);display:flex;flex-direction:column;gap:4px;align-items:center}
.is-line{background:rgba(8,10,8,.66);border-left:3px solid #9fb07a;padding:3px 10px;font-size:clamp(13px,1.3vw,16px);max-width:100%;transition:opacity .4s}
.is-line b{color:#c9d79f;font-weight:600;margin-right:8px;text-transform:uppercase;font-size:.8em;letter-spacing:.08em}
.is-line.is-me{border-left-color:#6fa8dc}.is-line.is-me b{color:#9cc6ee}.is-line.is-funk{border-left-color:#d8a64a}.is-line.is-funk b{color:#e7c27a}
.is-line.is-warn{border-left-color:#d8543c}.is-line.is-warn b{color:#f08a74}
.is-read{position:absolute;left:50%;bottom:26%;transform:translateX(-50%);text-align:center;text-shadow:0 1px 4px #000;transition:opacity .5s}
.is-read b{display:block;font-size:clamp(17px,1.8vw,22px);letter-spacing:.06em;font-weight:600}.is-read span{font-size:13px;opacity:.85}
.is-note{position:absolute;right:calc(18px + env(safe-area-inset-right));bottom:12%;font-size:14px;letter-spacing:.08em;text-transform:uppercase;text-shadow:0 1px 3px #000;opacity:.85;transition:opacity .5s}
.is-comp{position:absolute;left:50%;bottom:4%;width:min(300px,40vw);aspect-ratio:1;transform:translateX(-50%) translateY(18%);border-radius:50%;
  background:radial-gradient(circle at 50% 45%,#3b3a33 0,#24241f 62%,#15150f 70%,#4a4436 71%,#2b281f 78%,rgba(0,0,0,0) 79%);box-shadow:0 10px 30px rgba(0,0,0,.6);transition:transform .25s}
.is-comp svg{position:absolute;inset:9%;width:82%;height:82%}
.is-comp .is-cl{position:absolute;left:50%;top:6%;width:2px;height:16%;margin-left:-1px;background:#e04b2e}
.is-comp b{position:absolute;left:50%;bottom:20%;transform:translateX(-50%);font-size:15px;letter-spacing:.12em;color:#d9cfb0}
.is-map{position:absolute;left:50%;top:50%;width:min(78vh,74vw);aspect-ratio:1;transform:translate(-50%,-50%) rotate(-1.2deg);background:#d8ccab;padding:2.2%;
  box-shadow:0 18px 50px rgba(0,0,0,.7),inset 0 0 60px rgba(90,70,30,.45)}
.is-map canvas{width:100%;height:100%;display:block}
.is-map p{position:absolute;left:3%;bottom:.4%;margin:0;font-size:12px;color:#4a3f2a;letter-spacing:.06em}
.is-inv{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,92vw);background:rgba(12,13,10,.9);border:1px solid rgba(200,200,170,.22);padding:14px 16px;font-size:14px}
.is-inv h3{margin:0 0 8px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#a9b08e;font-weight:600;display:flex;justify-content:space-between}
.is-inv .is-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.is-inv ul{margin:0;padding:0;list-style:none}.is-inv li{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.is-inv li em{font-style:normal;opacity:.75}
.is-inv .is-acts{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px}
.is-inv .is-cond{margin-top:8px;font-size:13px;color:#cfc6ad}
.is-load{height:5px;background:rgba(233,230,223,.15);margin-top:4px}.is-load i{display:block;height:100%;background:#9fd37a;transform-origin:left}
.is-load.is-heavy i{background:#e7c35a}.is-load.is-over i{background:#e5634b}
.is-guide{position:absolute;right:calc(14px + env(safe-area-inset-right));top:24%;width:290px;background:rgba(10,12,10,.6);border:1px solid rgba(200,200,170,.16);padding:7px 10px;font-size:13px}
.is-guide h4{margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a9b08e;font-weight:600}
.is-guide ul{margin:0;padding:0}.is-guide li{list-style:none;padding:2px 0 2px 20px;position:relative;opacity:.75}
.is-guide li::before{content:"";position:absolute;left:2px;top:6px;width:10px;height:10px;border:1px solid #a9b08e}
.is-guide li.is-done{opacity:.5;text-decoration:line-through}.is-guide li.is-done::before{background:#9fd37a;border-color:#9fd37a}
.is-guide li.is-next{opacity:1;color:#ffe2a0}.is-guide li.is-next::before{border-color:#ffd678}
.is-guide li.is-warn{opacity:1;color:#f3a08a}.is-guide li.is-warn::before{border-color:#e5634b}
.is-guide p{margin:6px 0 0;font-size:12px;color:#cfd8b8;line-height:1.35}
.is-hint{position:absolute;right:calc(14px + env(safe-area-inset-right));top:24%;font-size:12px;background:rgba(10,12,10,.55);padding:3px 8px}
@media (max-height:560px),(max-width:900px){.is-guide{width:220px;font-size:11.5px;top:20%}.is-inv{font-size:12px;padding:10px}.is-sub{bottom:12%}}
body[data-input-mode="touch"] .is-guide{right:auto;left:calc(8px + env(safe-area-inset-left));top:calc(var(--mm-touch,118px) + 34px);width:200px}
body[data-input-mode="touch"] .is-guide kbd,body[data-input-mode="touch"] .is-hint{display:none}
`;

export class SimHUD {
  constructor(sim) {
    this.sim = sim;
    this.G = sim.G;
    if (!document.getElementById('isim-css')) {
      const st = document.createElement('style'); st.id = 'isim-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const host = document.getElementById('hud') || document.body;
    const r = document.createElement('div');
    r.id = 'isim';
    r.innerHTML = `
      <div class="is-desat"></div><div class="is-vig"></div><div class="is-red"></div>
      <div class="is-read" hidden><b></b><span></span></div>
      <div class="is-note" hidden></div>
      <div class="is-comp" hidden><div class="is-cl"></div><svg viewBox="-100 -100 200 200"><g class="is-rose"></g></svg><b></b></div>
      <div class="is-map" hidden><canvas width="1024" height="1024"></canvas><p></p></div>
      <div class="is-inv" hidden></div>
      <div class="is-guide" hidden><h4>Handgriffe</h4><ul></ul><p hidden></p></div>
      <div class="is-hint" hidden></div>
      <div class="is-sub"></div>
      <div class="is-black"><p></p><small></small></div>`;
    host.appendChild(r);
    this.root = r;
    const q = (s) => r.querySelector(s);
    this.el = {
      desat: q('.is-desat'), vig: q('.is-vig'), red: q('.is-red'), black: q('.is-black'), blackP: q('.is-black p'), blackS: q('.is-black small'),
      read: q('.is-read'), readB: q('.is-read b'), readS: q('.is-read span'), note: q('.is-note'), comp: q('.is-comp'), rose: q('.is-rose'), compB: q('.is-comp b'),
      map: q('.is-map'), mapC: q('.is-map canvas'), mapP: q('.is-map p'), inv: q('.is-inv'), guide: q('.is-guide'), guideL: q('.is-guide ul'), guideP: q('.is-guide p'),
      hint: q('.is-hint'), sub: q('.is-sub'),
    };
    this._c = {};
    this.lines = [];
    this._readT = 0; this._noteT = 0;
    this._buildRose();
    this._mapDrawn = null;
  }

  _set(k, el, prop, v) {
    if (this._c[k] === v) return;
    this._c[k] = v;
    if (prop === 'hidden') el.hidden = !!v;
    else if (prop === 'html') el.innerHTML = v;
    else if (prop === 'text') el.textContent = v;
    else if (prop === 'op') el.style.opacity = v;
    else if (prop === 'tf') el.style.transform = v;
  }

  _buildRose() {
    let s = '';
    for (let d = 0; d < 360; d += 5) {
      const a = (d * Math.PI) / 180, big = d % 45 === 0, mid = d % 15 === 0;
      const r0 = big ? 70 : mid ? 76 : 80, r1 = 86;
      s += `<line x1="${(Math.sin(a) * r0).toFixed(1)}" y1="${(-Math.cos(a) * r0).toFixed(1)}" x2="${(Math.sin(a) * r1).toFixed(1)}" y2="${(-Math.cos(a) * r1).toFixed(1)}" stroke="#d9cfb0" stroke-width="${big ? 2 : 1}"/>`;
    }
    const lab = [[0, 'N'], [45, 'NO'], [90, 'O'], [135, 'SO'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
    for (const [d, t] of lab) {
      const a = (d * Math.PI) / 180;
      s += `<text x="${(Math.sin(a) * 56).toFixed(1)}" y="${(-Math.cos(a) * 56 + 5).toFixed(1)}" fill="${d === 0 ? '#e86a4a' : '#d9cfb0'}" font-size="${t.length > 1 ? 11 : 16}" text-anchor="middle" font-family="inherit">${t}</text>`;
    }
    s += '<path d="M0 -40 L6 0 L0 40 L-6 0Z" fill="#2c2a24" stroke="#77705e"/><path d="M0 -40 L6 0 L-6 0Z" fill="#c2412c"/><circle r="4" fill="#77705e"/>';
    this.el.rose.innerHTML = s;
  }

  /* ---------------------------------------------------------------- Funk */

  say(from, text, { tone = '', voice = true } = {}) {
    if (!text) return;
    const now = this.G.time.elapsed;
    const k = from + '|' + text;
    this._last = this._last || new Map();
    if (now - (this._last.get(k) ?? -99) < 3) return;
    this._last.set(k, now);
    const me = from === 'Du';
    const line = { until: now + 2.8 + text.length * 0.045, el: document.createElement('div') };
    line.el.className = `is-line${me ? ' is-me' : tone ? ' is-' + tone : ''}`;
    line.el.innerHTML = `<b>${esc(from)}</b>${esc(text)}`;
    this.el.sub.appendChild(line.el);
    this.lines.push(line);
    while (this.lines.length > 3) this.lines.shift().el.remove();
    if (voice && !me && this.sim.voice) this._speak(text, from);
  }

  _speak(text, from) {
    const S = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!S || typeof SpeechSynthesisUtterance === 'undefined') return;
    try {
      if (S.speaking && S.pending) return;
      const u = new SpeechSynthesisUtterance(text.replace(/–/g, ','));
      u.lang = 'de-DE';
      const vs = S.getVoices ? S.getVoices().filter((x) => /^de/i.test(x.lang)) : [];
      if (vs.length) u.voice = vs[from.length % vs.length];
      u.rate = 1.08; u.pitch = 0.9 + (from.length % 5) * 0.05; u.volume = 0.85;
      S.speak(u);
    } catch { /* keine Stimme */ }
  }

  readout(t, sub) {
    this._set('readB', this.el.readB, 'text', t);
    this._set('readS', this.el.readS, 'text', sub || '');
    this._readT = 3.2;
  }

  note(t) { this._set('note', this.el.note, 'text', t); this._noteT = 1.8; }

  /* ---------------------------------------------------------------- Karte */

  _drawMap() {
    const W = this.G.world;
    const mm = W && W.minimap;
    const cv = this.el.mapC, ctx = cv.getContext('2d');
    if (this._mapDrawn === W) return;
    this._mapDrawn = W;
    const S = cv.width;
    ctx.fillStyle = '#d8ccab'; ctx.fillRect(0, 0, S, S);
    if (mm && mm.canvas) {
      ctx.save();
      ctx.filter = 'grayscale(1) sepia(.65) contrast(1.15) brightness(1.05)';
      ctx.globalAlpha = 0.85;
      ctx.drawImage(mm.canvas, 0, 0, S, S);
      ctx.restore();
    }
    // Planquadrate (A–H, 1–8) und Nordpfeil – die eigene Position steht nicht drauf
    ctx.strokeStyle = 'rgba(60,45,20,.45)'; ctx.lineWidth = 1.5; ctx.fillStyle = 'rgba(50,38,18,.85)'; ctx.font = '600 22px serif';
    for (let i = 0; i <= 8; i++) {
      const p = (i / 8) * S;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke();
      if (i < 8) { ctx.fillText('ABCDEFGH'[i], p + 8, 26); ctx.fillText(String(i + 1), 6, p + 50); }
    }
    ctx.save(); ctx.translate(S - 60, 70); ctx.fillStyle = '#5a1d10';
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(14, 10); ctx.lineTo(0, 0); ctx.lineTo(-14, 10); ctx.closePath(); ctx.fill();
    ctx.font = '700 26px serif'; ctx.fillText('N', -9, 40); ctx.restore();
    // Einsatzziele des Modus (Flaggen) als Bleistiftkreise
    const objs = (this.G.mode && this.G.mode.objectives) || [];
    if (mm && typeof mm.worldToMap === 'function') {
      ctx.strokeStyle = 'rgba(140,30,20,.8)'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(140,30,20,.9)'; ctx.font = '700 26px serif';
      for (const o of objs) {
        const p = o && (o.position || o.pos);
        if (!p) continue;
        const uv = mm.worldToMap(p.x, p.z);
        const x = uv.u * S, y = uv.v * S;
        ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke();
        if (o.label || o.id) ctx.fillText(String(o.label || o.id).slice(0, 2).toUpperCase(), x + 22, y + 8);
      }
    }
    this.el.mapP.textContent = `${(W && W.def && W.def.name) || (this.G.match && this.G.match.mapId) || 'Lageskizze'} · Gitter 1:${mm && mm.size ? Math.round(mm.size.x / 8) : '?'} m je Quadrat`;
  }

  /* ---------------------------------------------------------------- Takt */

  update(dt, s) {
    const now = this.G.time.elapsed;
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const L = this.lines[i];
      if (now > L.until) { L.el.remove(); this.lines.splice(i, 1); } else if (now > L.until - 0.5) L.el.style.opacity = '0';
    }
    const el = this.el;
    // Zustand als Bild
    this._set('desat', el.desat, 'op', s.desat.toFixed(2));
    this._set('vig', el.vig, 'op', s.vignette.toFixed(2));
    this._set('red', el.red, 'op', s.red.toFixed(2));
    this._set('black', el.black, 'op', s.black.toFixed(2));
    if (s.blackText) { this._set('blackP', el.blackP, 'text', s.blackText); this._set('blackS', el.blackS, 'html', s.blackSub || ''); }
    else this._set('blackP', el.blackP, 'text', '');
    // Ablesung / Notiz
    this._readT -= dt; this._noteT -= dt;
    this._set('readH', el.read, 'hidden', this._readT <= 0);
    this._set('noteH', el.note, 'hidden', this._noteT <= 0);
    // Kompass
    this._set('compH', el.comp, 'hidden', !s.compass);
    if (s.compass) {
      const hd = s.heading;
      el.rose.setAttribute('transform', `rotate(${(-hd).toFixed(1)})`);
      this._set('compB', el.compB, 'text', `${String(Math.round(hd / 5) * 5 % 360).padStart(3, '0')}°`);
    }
    // Karte
    this._set('mapH', el.map, 'hidden', !s.map);
    if (s.map) this._drawMap();
    // Ausrüstung
    this._set('invH', el.inv, 'hidden', !s.inv);
    if (s.inv) this._set('inv', el.inv, 'html', s.inv);
    // Führung
    this._set('guideH', el.guide, 'hidden', !s.steps);
    if (s.steps) {
      let next = false;
      this._set('steps', el.guideL, 'html', s.steps.map((x) => {
        const cls = x.warn ? 'is-warn' : x.done ? 'is-done' : !next ? (next = true, 'is-next') : '';
        return `<li class="${cls}">${x.html}</li>`;
      }).join(''));
      this._set('whyH', el.guideP, 'hidden', !s.why);
      if (s.why) this._set('why', el.guideP, 'text', s.why);
    }
    this._set('hintH', el.hint, 'hidden', !s.hint || !!s.steps);
    if (s.hint) this._set('hint', el.hint, 'html', s.hint);
  }

  dispose() { this.root.remove(); try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* */ } }
}

export { esc };
