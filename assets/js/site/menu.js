/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// Spielmenü (21.11.): Die Startseite bedient sich wie das Menü eines Spiels (nur mit html.shell, also mit JavaScript).
// • Kategorien (.panel in index.html) öffnen sich als eigene Bildschirme mit Übergang, Kopfleiste (Zurück, Symbol,
//   Titel, Reiter) und eigenem Scrollbereich; Pfad oben in der Statuszeile. Zurück: Esc, Rücktaste, Controller B,
//   Browser-Zurück (jede geöffnete Kategorie ist ein Verlaufseintrag #name).
// • Direktlinks: index.html#news, #galerie, #karten … und alle alten Abschnitts-Anker (#einsatz, #fragen, #entstehung …)
//   öffnen die Kategorie, in der sie liegen, und fahren das Ziel an (jump.js leitet Sprünge hierher um).
// • Bedienung: Maus, Touch, Tastatur (Pfeile wählen räumlich, Enter bestätigt, Q/E Reiter), Controller (Gamepad-API:
//   Steuerkreuz/linker Stick wählen, A bestätigt, B zurück, LB/RB Reiter, rechter Stick blättert, Start spielt).
// • Startbild: wechselnde Spielszenen (Kamerafahrt), Staub, Körperkamera-HUD; Tastenleiste unten.
// • Übergang ins Spiel: jeder Link auf spielen.html zeigt kurz einen Ladeschirm (Modus, Karte, Tipp), dann geht's los.
// • prefers-reduced-motion bzw. Einstellung „Bewegung reduzieren“: keine Szenenwechsel, kein Staub, Übergänge kurz.
import { t } from './lang.js?v=20261121041936';
import { setRouter } from './jump.js?v=20261121041936';
import { reduced } from './motion.js?v=20261121041936';
import { afterBoot, bootVisible } from './boot.js?v=20261121041936';

const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAP_PICS = new Set(['hafen', 'altstadt', 'werk', 'bibliothek', 'range', 'grenzland', 'niemandsland', 'brandwald', 'flugplatz', 'stadtkern']);

const panels = new Map();
let current = null;
let depth = 0; // eigene Verlaufseinträge dieser Seite
let mode = 'mouse';
let snd = null;
let ensureView = () => Promise.resolve();
let getData = () => null;
let hero = null;

/* ------------------------------------------------------------------ Hilfen */

function visibleEl(el) {
  if (!el.getClientRects().length) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}
function openDialog() { return $('dialog[open]'); }
function scopeEl() { return openDialog() || current?.el || hero; }
function candidates(scope) {
  let list = $$(FOCUSABLE, scope).filter((el) => !el.closest('[inert]') && !el.matches('.bull, .skip') && visibleEl(el));
  if (scope === hero) list = list.filter((el) => el.closest('#hero-menu, .brief-news, .zero-line'));
  return list;
}
function scrollerOf(el) { return el.closest('.p-body') || null; }
function focusEl(el, { sound = true } = {}) {
  if (!el) return;
  try { el.focus({ preventScroll: true }); } catch { /* */ }
  const sc = scrollerOf(el);
  if (sc) {
    const r = el.getBoundingClientRect();
    const s = sc.getBoundingClientRect();
    const pad = 48;
    if (r.top < s.top + pad || r.bottom > s.bottom - pad) {
      const top = sc.scrollTop + (r.top - s.top) - Math.max(pad, (s.height - r.height) / 3);
      sc.scrollTo({ top: Math.max(0, top), behavior: reduced() ? 'auto' : 'smooth' });
    }
  }
  if (sound) snd?.ui('hover');
}

/* ------------------------------------------------------------------ Eingabeart, Tastenleiste */

function setMode(m) {
  if (m === mode) return;
  mode = m;
  html.dataset.input = m;
  renderHints();
}
function renderHints() {
  const el = $('#hints');
  if (!el) return;
  const pad = mode === 'pad';
  const tabs = current && current.tabs.length > 1;
  const k = (keys, label, act) => `<span class="hk"${act ? ` data-act="${act}"` : ''}>${keys}<span>${esc(label)}</span></span>`;
  const left = `<span class="h-left"><span><b>●</b> ${esc(current ? current.title : t('menu.root'))}</span></span>`;
  let right;
  if (pad) {
    right = k('<i class="pad sh">✚</i>', t('hint.nav'))
      + k('<i class="pad a">A</i>', t('hint.ok'))
      + (current ? k('<i class="pad b">B</i>', t('hint.back'), 'back') : '')
      + (tabs ? k('<i class="pad sh">LB</i><i class="pad sh">RB</i>', t('hint.tabs')) : '')
      + (current ? k('<i class="pad sh">R</i>', t('hint.scroll')) : '');
  } else {
    right = k('<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>', t('hint.nav'))
      + k('<kbd>Enter</kbd>', t('hint.ok'))
      + (current ? k('<kbd>Esc</kbd>', t('hint.back'), 'back') : '')
      + (tabs ? k('<kbd>Q</kbd><kbd>E</kbd>', t('hint.tabs')) : '');
  }
  el.innerHTML = left + right;
}

/* ------------------------------------------------------------------ Pfad (Breadcrumb) */

function renderCrumbs(tabName) {
  const ol = $('#crumbs ol');
  if (!ol) return;
  const items = [`<li><a href="#nullpunkt" data-crumb="root">${esc(t('menu.root'))}</a></li>`];
  if (current) {
    if (current.tabs.length > 1 && tabName) {
      items.push(`<li><a href="#${esc(current.name)}" class="cr-in">${esc(current.title)}</a></li>`);
      items.push(`<li><span class="cr-in" aria-current="page">${esc(tabName)}</span></li>`);
    } else items.push(`<li><span class="cr-in" aria-current="page">${esc(current.title)}</span></li>`);
  }
  ol.innerHTML = items.join('');
}

/* ------------------------------------------------------------------ Bildschirme aufbauen */

function buildPanel(el) {
  const name = el.dataset.panel;
  const title = el.dataset.title || name;
  const secs = $$(':scope > section.sec', el);
  const bg = document.createElement('div');
  bg.className = 'p-bg';
  bg.setAttribute('aria-hidden', 'true');
  const head = document.createElement('header');
  head.className = 'p-head';
  const tabs = secs.map((s) => ({ id: s.id, name: s.dataset.tab || title, sec: s }));
  head.innerHTML = `<button class="p-back" type="button"><svg aria-hidden="true"><use href="#i-zurueck"/></svg><span class="pb-t">${esc(t('menu.back'))}</span><kbd>Esc</kbd></button>
    <div class="p-ttl"><span class="p-ic" aria-hidden="true"><svg><use href="#${esc(el.dataset.icon || 'i-info')}"/></svg></span><div class="p-tt"><p class="p-title">${esc(title)}</p><p class="p-kick">${esc(el.dataset.kicker || '')}</p></div></div>`
    + (tabs.length > 1 ? `<nav class="p-tabs" aria-label="Reiter"><kbd aria-hidden="true">Q</kbd><div class="p-tabs-list">${tabs.map((x, i) => `<button class="p-tab" type="button" data-sec="${esc(x.id)}"${i ? '' : ' aria-current="true"'}>${esc(x.name)}</button>`).join('')}</div><kbd aria-hidden="true">E</kbd></nav>` : '');
  const body = document.createElement('div');
  body.className = 'p-body';
  body.append(...el.childNodes);
  el.append(bg, head, body);
  if (tabs.length > 1) {
    for (const x of tabs) {
      const p = document.createElement('p');
      p.className = 'p-sec-h';
      p.setAttribute('aria-hidden', 'true');
      p.textContent = x.name;
      (x.sec.querySelector(':scope > .content') || x.sec).prepend(p);
    }
  }
  const P = { name, el, head, body, bg, title, tabs, tab: 0, bgSet: false };
  head.querySelector('.p-back').addEventListener('click', () => back());
  for (const b of $$('.p-tab', head)) b.addEventListener('click', () => { selectTab(P, tabs.findIndex((x) => x.id === b.dataset.sec), true); snd?.ui('click'); });
  // Reiter folgen dem Scrollen (Scroll-Spy im Bildschirm)
  let raf = 0;
  body.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; spyTabs(P); });
  }, { passive: true });
  panels.set(name, P);
  return P;
}

function spyTabs(P) {
  if (P.tabs.length < 2) return;
  const line = P.body.scrollTop + P.body.clientHeight * 0.35;
  let i = 0;
  P.tabs.forEach((x, k) => { if (x.sec.offsetTop <= line) i = k; });
  if (P.body.scrollTop + P.body.clientHeight >= P.body.scrollHeight - 4) i = P.tabs.length - 1;
  if (i !== P.tab) { P.tab = i; markTab(P); }
}
function markTab(P) {
  $$('.p-tab', P.head).forEach((b, k) => { if (k === P.tab) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  const cur = $$('.p-tab', P.head)[P.tab];
  cur?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  if (current === P) renderCrumbs(P.tab > 0 ? P.tabs[P.tab].name : null);
}
function selectTab(P, i, focusTab = false) {
  if (!P || P.tabs.length < 2) return;
  const n = P.tabs.length;
  i = ((i % n) + n) % n;
  P.tab = i;
  markTab(P);
  const sec = P.tabs[i].sec;
  P.body.scrollTo({ top: i === 0 ? 0 : Math.max(0, sec.offsetTop - 4), behavior: reduced() ? 'auto' : 'smooth' });
  if (focusTab) { /* Klick: Fokus bleibt auf dem Reiter */ } else focusEl($$('.p-tab', P.head)[i], { sound: false });
}

/* ------------------------------------------------------------------ Öffnen, schließen, Verlauf */

function setBg(P) {
  if (P.bgSet) return;
  P.bgSet = true;
  const src = P.el.dataset.bg;
  if (src) P.bg.style.setProperty('--pbg', `url("${src}")`);
}

function wipe() {
  if (reduced()) return;
  let w = $('.p-wipe');
  if (!w) { w = document.createElement('div'); w.className = 'p-wipe'; w.setAttribute('aria-hidden', 'true'); document.body.append(w); }
  w.classList.remove('run');
  void w.offsetWidth;
  w.classList.add('run');
}

async function reveal(P, target) {
  // Abschnitte bis zum Ziel aufbauen (Views füllen sich), dann ohne Bewegung anfahren
  await Promise.all($$('section[data-view]', P.el).map((s) => ensureView(s.dataset.view)));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (current !== P || !target || !target.isConnected) return;
  let el = target;
  if (!el.getClientRects().length) el = target.closest('section.sec') || target; // z. B. verborgene Entstehungsgeschichte
  if (el.matches('details') && !el.open) el.open = true;
  const r = el.getBoundingClientRect();
  const s = P.body.getBoundingClientRect();
  P.body.scrollTo({ top: Math.max(0, P.body.scrollTop + r.top - s.top - 8), behavior: 'auto' });
  if (!el.matches(FOCUSABLE)) el.setAttribute('tabindex', '-1');
  try { el.focus({ preventScroll: true }); } catch { /* */ }
}

function open(name, { push = true, target = null, sound = true } = {}) {
  const P = panels.get(name);
  if (!P) return false;
  if (current === P) { if (target) reveal(P, target); return true; }
  if (current) {
    const old = current;
    old.el.classList.remove('is-open');
    old.el.setAttribute('aria-hidden', 'true');
  }
  current = P;
  setBg(P);
  for (const s of $$('section[data-view]', P.el)) ensureView(s.dataset.view);
  P.el.classList.remove('is-closing');
  P.el.removeAttribute('aria-hidden');
  if (!target) { P.body.scrollTop = 0; P.tab = 0; markTab(P); }
  P.el.classList.add('is-open');
  html.classList.add('panel-open');
  if (hero) hero.inert = true;
  wipe();
  if (sound) snd?.ui('confirm');
  renderCrumbs(null);
  renderHints();
  if (push) {
    try { history.pushState({ np: name }, '', `#${name}`); depth++; } catch { /* */ }
  }
  if (target) reveal(P, target);
  else {
    requestAnimationFrame(() => {
      if (current !== P) return;
      if (mode === 'key' || mode === 'pad') {
        const first = candidates(P.body)[0] || $('.p-back', P.head);
        focusEl(first, { sound: false });
      } else {
        const tt = $('.p-title', P.head);
        tt.setAttribute('tabindex', '-1');
        try { tt.focus({ preventScroll: true }); } catch { /* */ }
      }
    });
  }
  window.dispatchEvent(new CustomEvent('np:panel', { detail: { name } }));
  return true;
}

function close({ sound = true } = {}) {
  if (!current) return;
  const P = current;
  current = null;
  P.el.classList.remove('is-open');
  P.el.setAttribute('aria-hidden', 'true');
  P.el.classList.add('is-closing');
  setTimeout(() => P.el.classList.remove('is-closing'), reduced() ? 0 : 230);
  html.classList.remove('panel-open');
  if (hero) hero.inert = false;
  if (sound) snd?.ui('back');
  renderCrumbs(null);
  renderHints();
  const item = $(`#hero-menu [data-cat="${P.name}"]`);
  if (item && (mode === 'key' || mode === 'pad')) focusEl(item, { sound: false });
  else if (document.activeElement && P.el.contains(document.activeElement)) document.activeElement.blur();
  window.dispatchEvent(new CustomEvent('np:panel', { detail: { name: null } }));
}

/** Zurück: Dialog → Kategorie → Hauptmenü. */
export function back() {
  const dlg = openDialog();
  if (dlg) { dlg.close(); return; }
  if (!current) return;
  if (depth > 0) { history.back(); return; } // popstate zählt depth herunter und schließt
  close();
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* */ }
}

function resolve(hash) {
  let id = '';
  try { id = decodeURIComponent(String(hash || '').replace(/^#/, '')); } catch { id = ''; }
  if (!id || id === 'nullpunkt' || id === 'hauptmenue') return { name: null };
  if (panels.has(id)) return { name: id };
  const el = document.getElementById(id);
  if (!el) return { name: null };
  const p = el.closest('.panel');
  if (!p) return { name: null };
  const first = $('section.sec', p);
  return { name: p.dataset.panel, target: el === first || el === p ? null : el };
}

function route(hash, { push = false, sound = true } = {}) {
  const r = resolve(hash);
  if (r.name) open(r.name, { push, target: r.target, sound });
  else close({ sound });
}

/* ------------------------------------------------------------------ Räumliche Navigation */

function move(dir) {
  const scope = scopeEl();
  if (!scope) return false;
  const list = candidates(scope);
  if (!list.length) return false;
  const cur = document.activeElement;
  if (!cur || cur === document.body || !scope.contains(cur) || !list.includes(cur)) {
    let first = list[0];
    if (current && scope === current.el) {
      // im Bildschirm: erstes sichtbares Element im Scrollbereich
      const s = current.body.getBoundingClientRect();
      first = list.find((el) => current.body.contains(el) && el.getBoundingClientRect().top >= s.top - 2) || list[0];
    }
    focusEl(first);
    return true;
  }
  const r = cur.getBoundingClientRect();
  const cx = (r.left + r.right) / 2;
  const cy = (r.top + r.bottom) / 2;
  let best = null;
  let bs = Infinity;
  for (const el of list) {
    if (el === cur || el.contains(cur) || cur.contains(el)) continue;
    const c = el.getBoundingClientRect();
    const ex = (c.left + c.right) / 2;
    const ey = (c.top + c.bottom) / 2;
    let primary;
    let ortho;
    if (dir === 'down' || dir === 'up') {
      if (dir === 'down' ? !(ey > cy + 2 && c.top > r.top + 2) : !(ey < cy - 2 && c.bottom < r.bottom - 2)) continue;
      primary = dir === 'down' ? Math.max(0, c.top - r.bottom) : Math.max(0, r.top - c.bottom);
      ortho = c.right < r.left ? r.left - c.right : c.left > r.right ? c.left - r.right : 0;
      const score = primary + ortho * 2 + Math.abs(ex - cx) * 0.05;
      if (score < bs) { bs = score; best = el; }
    } else {
      if (dir === 'right' ? !(ex > cx + 2 && c.left > r.left + 2) : !(ex < cx - 2 && c.right < r.right - 2)) continue;
      primary = dir === 'right' ? Math.max(0, c.left - r.right) : Math.max(0, r.left - c.right);
      ortho = c.bottom < r.top ? r.top - c.bottom : c.top > r.bottom ? c.top - r.bottom : 0;
      const score = primary + ortho * 3 + Math.abs(ey - cy) * 0.05;
      if (score < bs) { bs = score; best = el; }
    }
  }
  if (best) { focusEl(best); return true; }
  // Nichts mehr in dieser Richtung: im Bildschirm weiterblättern
  if (current && scope === current.el && (dir === 'down' || dir === 'up')) {
    current.body.scrollBy({ top: (dir === 'down' ? 1 : -1) * current.body.clientHeight * 0.6, behavior: reduced() ? 'auto' : 'smooth' });
    return true;
  }
  return false;
}

const TYPING = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select, [contenteditable="true"]';

function onKey(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  if (bootVisible()) return;
  const a = document.activeElement;
  const typing = !!(a && a.matches?.(TYPING));
  const k = e.key;
  if (k === 'Escape') {
    if (openDialog()) return; // schließt der Browser selbst
    if (current) { e.preventDefault(); back(); }
    return;
  }
  if (k === 'Backspace' && !typing && current) { e.preventDefault(); back(); return; }
  if ((k === 'q' || k === 'Q' || k === 'e' || k === 'E') && !typing && current && current.tabs.length > 1 && !openDialog()) {
    e.preventDefault();
    selectTab(current, current.tab + (k.toLowerCase() === 'e' ? 1 : -1));
    snd?.ui('click');
    return;
  }
  const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[k];
  if (!dir || typing) return;
  // Reiterleisten und Regler, die Pfeiltasten selbst nutzen, haben schon preventDefault gesetzt
  if (a?.closest?.('[role="tablist"], [role="radiogroup"], [role="slider"], [role="listbox"], [role="menu"]') && (dir === 'left' || dir === 'right')) return;
  if (openDialog()?.id === 'lightbox') return; // Bildbetrachter blättert selbst
  if (move(dir)) e.preventDefault();
}

/* ------------------------------------------------------------------ Controller */

let padRaf = 0;
let last = null;
const rep = {};
function padState(p) {
  const b = (i) => !!p.buttons?.[i]?.pressed;
  const ax = p.axes || [];
  return {
    up: b(12) || (ax[1] || 0) < -0.55, down: b(13) || (ax[1] || 0) > 0.55,
    left: b(14) || (ax[0] || 0) < -0.55, right: b(15) || (ax[0] || 0) > 0.55,
    a: b(0), b: b(1), lb: b(4), rb: b(5), start: b(9), sy: ax[3] || 0,
  };
}
function adjust(el, dir) {
  if (el.matches('input[type="range"]')) {
    if (dir === 'right') el.stepUp(); else el.stepDown();
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  if (el.matches('select')) {
    const n = el.options.length;
    if (!n) return true;
    el.selectedIndex = (el.selectedIndex + (dir === 'right' ? 1 : -1) + n) % n;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    snd?.ui('click');
    return true;
  }
  return false;
}
function padDir(dir) {
  setMode('pad');
  const dlg = openDialog();
  if (dlg?.id === 'lightbox' && (dir === 'left' || dir === 'right')) { dlg.dispatchEvent(new CustomEvent('np:nav', { detail: dir === 'left' ? -1 : 1 })); return; }
  const a = document.activeElement;
  if (a && (dir === 'left' || dir === 'right') && a.matches?.('input[type="range"], select') && adjust(a, dir)) return;
  move(dir);
}
function padButton(name) {
  setMode('pad');
  if (name === 'b') { back(); return; }
  if (name === 'a') {
    const a = document.activeElement;
    const scope = scopeEl();
    if (a && a !== document.body && scope?.contains(a)) {
      if (a.matches('select')) { adjust(a, 'right'); return; }
      if (a.matches('input[type="text"], input:not([type]), textarea')) return;
      a.click();
    } else move('down');
    return;
  }
  if (name === 'lb' || name === 'rb') {
    const dlg = openDialog();
    if (dlg?.id === 'lightbox') { dlg.dispatchEvent(new CustomEvent('np:nav', { detail: name === 'lb' ? -1 : 1 })); return; }
    if (current && current.tabs.length > 1) { selectTab(current, current.tab + (name === 'rb' ? 1 : -1)); snd?.ui('click'); }
    return;
  }
  if (name === 'start' && !current && !openDialog()) $('#hero-menu .cta-fill')?.click();
}
function padTick() {
  padRaf = 0;
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  if (!pads.length) { last = null; return; }
  const p = pads.find((x) => x.mapping === 'standard') || pads[0];
  const s = padState(p);
  if (!last) last = s; // gehaltene Knöpfe (z. B. vom Überspringen) lösen nichts aus
  if (!document.hidden && !bootVisible()) {
    const now = performance.now();
    for (const d of ['up', 'down', 'left', 'right']) {
      if (s[d] && !last[d]) { padDir(d); rep[d] = now + 380; }
      else if (s[d] && now >= (rep[d] || 0)) { padDir(d); rep[d] = now + 110; }
    }
    for (const b of ['a', 'b', 'lb', 'rb', 'start']) if (s[b] && !last[b]) padButton(b);
    if (current && Math.abs(s.sy) > 0.2) { current.body.scrollTop += s.sy * 22; setMode('pad'); }
  }
  last = s;
  padRaf = requestAnimationFrame(padTick);
}
function startPad() { if (!padRaf) padRaf = requestAnimationFrame(padTick); }

/* ------------------------------------------------------------------ Startbild: Szenen und Staub */

const SCENES = ['assets/img/neu/vgl-hafen-nachher.webp', 'assets/img/neu/zerstoerung.webp', 'assets/img/neu/vgl-wald-nachher.webp', 'assets/img/neu/isim.webp'];
function scenes() {
  const box = $('#scene');
  if (!box || navigator.connection?.saveData) return;
  const land = window.matchMedia('(orientation: landscape)');
  let i = 0;
  let shown = null;
  const step = async () => {
    if (document.hidden || current || reduced() || !land.matches) return;
    const src = i < SCENES.length ? SCENES[i] : null;
    i = (i + 1) % (SCENES.length + 1); // nach allen Szenen wieder das Startbild
    let img = null;
    if (src) {
      img = box.querySelector(`img[data-src="${src}"]`);
      if (!img) {
        img = new Image();
        img.alt = '';
        img.decoding = 'async';
        img.dataset.src = src;
        img.src = src;
        try { await img.decode(); } catch { return; }
        box.append(img);
      }
    }
    requestAnimationFrame(() => {
      shown?.classList.remove('on');
      img?.classList.add('on');
      shown = img;
    });
  };
  setInterval(step, 14000);
}

function dust() {
  const cv = $('#dust');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  let parts = [];
  let w = 0;
  let h = 0;
  let raf = 0;
  let lastT = 0;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(70, Math.round((w * h) / 22000));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: 0.5 + Math.random() * 1.8,
      vx: 4 + Math.random() * 10, vy: -2 - Math.random() * 6, a: 0.08 + Math.random() * 0.35, ph: Math.random() * 6.28,
    }));
  };
  const tick = (now) => {
    raf = 0;
    if (document.hidden || current || reduced()) return;
    const dt = Math.min(0.1, (now - (lastT || now)) / 1000);
    if (now - lastT < 33) { raf = requestAnimationFrame(tick); return; } // ~30 Bilder/s genügen
    lastT = now;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.ph += dt;
      p.x += (p.vx + Math.sin(p.ph) * 3) * dt;
      p.y += (p.vy + Math.cos(p.ph * 0.7) * 2) * dt;
      if (p.x > w + 4) p.x = -4;
      if (p.y < -4) p.y = h + 4;
      ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.ph * 1.3));
      ctx.fillStyle = '#E8E2D2';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  };
  const run = () => { if (!raf && !document.hidden && !current && !reduced()) { lastT = 0; raf = requestAnimationFrame(tick); } };
  resize();
  window.addEventListener('resize', () => { resize(); });
  document.addEventListener('visibilitychange', run);
  window.addEventListener('np:panel', run);
  run();
}

/* ------------------------------------------------------------------ Übergang ins Spiel */

function warpLabel(url) {
  const q = url.searchParams;
  const D = getData();
  const mode = q.get('mode');
  const map = q.get('map');
  const tab = q.get('tab');
  if (q.get('raum')) return t('warp.room', { code: q.get('raum').toUpperCase() });
  if (tab === 'kampagne') return `${t('warp.campaign')} · Stille Grenze`;
  if (tab === 'eisenwind') return `${t('warp.campaign')} · Eisenwind`;
  if (tab === 'panzer') return 'Panzer';
  const mn = (mode && (D?.M?.MODES?.[mode]?.name)) || '';
  const pn = (map && (D?.P?.MAPS?.[map]?.name)) || '';
  return [mn, pn].filter(Boolean).join(' · ') || t('warp.lobby');
}
function warpPic(url) {
  const q = url.searchParams;
  const map = q.get('map');
  if (map && MAP_PICS.has(map)) return `assets/img/maps/${map}.webp`;
  const tab = q.get('tab');
  if (tab === 'eisenwind' || tab === 'panzer') return 'assets/img/neu/eisenwind.webp';
  if (tab === 'kampagne') return 'assets/img/neu/stille-grenze.webp';
  return 'assets/img/neu/hero-m.webp';
}
let warping = false;
export function warpTo(href) {
  let url;
  try { url = new URL(href, location.href); } catch { location.href = href; return; }
  if (warping) return;
  warping = true;
  const box = $('#warp');
  if (!box) { location.href = url.href; return; }
  const ms = reduced() ? 120 : 650;
  box.style.setProperty('--warp-ms', `${ms + 400}ms`);
  $('#warp-pic', box)?.style.setProperty('--wbg', `url("${warpPic(url)}")`);
  const tt = $('#warp-t', box);
  if (tt) tt.textContent = warpLabel(url);
  const kk = $('.warp-k', box);
  if (kk) kk.textContent = t('warp.title');
  const tips = t('tips');
  const tip = $('#warp-tip', box);
  if (tip && Array.isArray(tips) && tips.length) tip.textContent = tips[Math.floor(Math.random() * tips.length)];
  box.hidden = false;
  try { window.sessionStorage.setItem('np-boot', '1'); } catch { /* */ }
  setTimeout(() => { location.href = url.href; }, ms);
  // Falls die Navigation abbricht (Download-Dialog, Blocker): Übergang nach einer Weile wieder lösen
  setTimeout(() => { warping = false; box.hidden = true; }, 8000);
}
function isGameUrl(u) {
  return u.origin === location.origin && /\/spielen\.html$/.test(u.pathname);
}
function initWarp() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    let u;
    try { u = new URL(a.href, location.href); } catch { return; }
    if (!isGameUrl(u)) return;
    e.preventDefault();
    warpTo(u.href);
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) { warping = false; const b = $('#warp'); if (b) b.hidden = true; } });
}

/* ------------------------------------------------------------------ App: Beenden, Titel */

function initApp() {
  const A = window.nullpunktDesktop;
  if (!A) return;
  const appPanel = $('.panel[data-panel="app"]');
  const label = t('menu.app.desktop');
  if (appPanel) { appPanel.dataset.title = label; appPanel.setAttribute('aria-label', label); appPanel.dataset.icon = 'i-update'; appPanel.dataset.kicker = 'Version, Updates, App-Einstellungen'; }
  const tl = $('#tile-app');
  if (tl) tl.textContent = label;
  const ic = tl?.parentElement?.querySelector('use');
  ic?.setAttribute('href', '#i-update');
  for (const li of $$('.app-only')) li.hidden = false;
  const dlg = $('#quit-dialog');
  const openB = $('#quit-open');
  if (!dlg || !openB || typeof dlg.showModal !== 'function') return;
  openB.addEventListener('click', () => { dlg.showModal(); snd?.ui('click'); $('#quit-go', dlg)?.focus(); });
  dlg.querySelector('[data-close]')?.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $('#quit-go', dlg)?.addEventListener('click', () => { try { A.quit(); } catch { window.close(); } });
}

/* ------------------------------------------------------------------ Start */

export function initMenu(opts = {}) {
  if (!html.classList.contains('shell')) return null;
  snd = opts.sound || null;
  if (opts.ensureView) ensureView = opts.ensureView;
  if (opts.getData) getData = opts.getData;
  hero = $('#nullpunkt');
  initApp(); // vor dem Aufbau: Titel der App-Kategorie
  for (const el of $$('.panel')) { buildPanel(el); el.setAttribute('aria-hidden', 'true'); }

  // Wortmarke im Menü: nach Breite UND Höhe begrenzen (zero.js passt sie sonst an die ganze Seite an)
  const h1 = $('#h-null');
  if (h1) {
    h1.fitOpts = { ...(h1.fitOpts || {}),
      max: () => {
        const w = window.innerWidth;
        const hh = window.innerHeight;
        if (hh < 560 && w > hh) return Math.max(36, Math.min(76, hh * 0.13));
        if (w < hh) return Math.max(44, Math.min(110, hh * 0.085));
        return Math.max(56, Math.min(200, hh * 0.15));
      } };
  }

  setRouter((id, { hash = true } = {}) => {
    if (resolve(`#${id}`).name) route(`#${id}`, { push: hash });
    else if (current) {
      close();
      try { history.replaceState(null, '', location.pathname + location.search); } catch { /* */ }
    }
    return true;
  });
  window.addEventListener('popstate', () => {
    if (depth > 0) depth--;
    route(location.hash, { push: false });
  });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keydown', (e) => { if (!e.key.startsWith('Shift') && e.key !== 'Tab') setMode('key'); else if (e.key === 'Tab') setMode('key'); }, true);
  window.addEventListener('pointerdown', (e) => setMode(e.pointerType === 'touch' ? 'touch' : 'mouse'), true);
  window.addEventListener('gamepadconnected', startPad);
  if (navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) startPad();

  // Klänge: Überfahren und Fokus in Menüs
  const HOVER = '.menu-it, .tile, .p-tab, .p-back, .gal-it, .brief-news, .seg button, .news-card a, .dl-btn';
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.(HOVER);
    if (el && !el.contains(e.relatedTarget)) snd?.ui('hover');
  });
  $('#hints')?.addEventListener('click', (e) => { if (e.target.closest('[data-act="back"]')) back(); });

  // Menüpunkte: Kategorie öffnen (ohne den Umweg über den Anker, mit Klang)
  for (const a of $$('#hero-menu [data-cat]')) {
    if (a.tagName !== 'A') continue;
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      open(a.dataset.cat);
    });
  }
  // Erste Pfeiltaste im Hauptmenü: Fokus auf „Sofort spielen“
  renderCrumbs(null);
  html.dataset.input = mode;
  renderHints();
  initWarp();
  // Anfangszustand aus der Adresse (#news, #karten, #einsatz …)
  if (location.hash) route(location.hash, { push: false, sound: false });
  afterBoot(() => {
    if (reduced()) return;
    scenes();
    dust();
  });
  return { open, close, back, route };
}
