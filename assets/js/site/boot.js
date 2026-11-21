/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// Spielmenü (21.11.): Ladebildschirm der Startseite. Zeigt die echten Ladeschritte aus main.js (Spieldaten, Schriften,
// Texturen, Service Worker/Update) mit Fortschrittsbalken und wechselnden Tipps. Einmal je Sitzung (Kopfskript setzt
// html.boot-on), überspringbar mit Klick, Taste oder Controller-Knopf; ohne künstliche Wartezeit (höchstens eine kurze
// Mindestdauer, damit nichts nur aufblitzt). In der PC-App gehen dieselben Schritte an das Startfenster der App
// (window.nullpunktDesktop.bootStep/bootDone, desktop/preload.js); dort bleibt die Seite unsichtbar, bis sie fertig ist.
import { t } from './lang.js?v=20261121041936';

const html = document.documentElement;
const A = window.nullpunktDesktop;
const visible = html.classList.contains('boot-on');
const $ = (id) => document.getElementById(id);
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const T0 = performance.now();
const MIN_MS = 650; // kein Aufblitzen
const MAX_MS = 9000; // Sicherheitsnetz
let pct = 0;
let done = false;
let tipT = 0;
let tipI = 0;
const doneFns = [];

function tips() { const x = t('tips'); return Array.isArray(x) && x.length ? x : []; }
function nextTip() {
  const el = $('boot-tip');
  const list = tips();
  if (!el || !list.length) return;
  el.classList.remove('swap');
  void el.offsetWidth;
  el.textContent = list[tipI++ % list.length];
  el.classList.add('swap');
}

/** Ein Ladeschritt: Beschriftung, Fortschritt in Prozent (steigt nur), ok = als erledigt ins Protokoll. */
export function bootStep(label, p, { ok = false } = {}) {
  if (done && !A) return;
  pct = Math.max(pct, Math.min(100, p));
  try { A?.bootStep?.({ label: String(label), pct: Math.round(pct), ok: !!ok }); } catch { /* ältere App */ }
  if (!visible || done) return;
  const step = $('boot-step');
  const fill = $('boot-fill');
  const bar = $('boot-bar');
  const pc = $('boot-pct');
  if (step) step.textContent = label;
  if (pc) pc.textContent = `${Math.round(pct)} %`;
  if (fill) fill.style.transform = `scaleX(${(pct / 100).toFixed(3)})`;
  bar?.setAttribute('aria-valuenow', String(Math.round(pct)));
  if (ok) {
    const log = $('boot-log');
    if (log) {
      const li = document.createElement('li');
      li.textContent = label;
      log.append(li);
      while (log.children.length > 3) log.firstElementChild.remove();
    }
  }
}

/** Ladebildschirm schließen (nach den Schritten oder beim Überspringen). */
export function bootDone({ skipped = false } = {}) {
  if (done) return;
  done = true;
  try { window.sessionStorage.setItem('np-boot', '1'); } catch { /* */ }
  try { A?.bootDone?.(); } catch { /* */ }
  clearInterval(tipT);
  const fin = () => { for (const fn of doneFns.splice(0)) { try { fn(); } catch { /* */ } } };
  if (!visible) { fin(); return; }
  const conn = document.querySelector('.boot-conn');
  if (conn) { conn.textContent = t('boot.conn.ok'); conn.classList.add('ok'); }
  const wait = skipped || reduced() ? 0 : Math.max(0, MIN_MS - (performance.now() - T0));
  setTimeout(() => {
    html.classList.add('boot-out');
    setTimeout(() => {
      html.classList.remove('boot-on', 'boot-out');
      fin();
    }, reduced() ? 0 : 430);
  }, wait);
}

export const bootVisible = () => visible && !done;
/** Rückruf, wenn der Ladebildschirm weg ist (sofort, wenn keiner da war). */
export function afterBoot(fn) { if (done && !html.classList.contains('boot-on')) fn(); else doneFns.push(fn); }

if (visible) {
  const skip = (e) => {
    if (done) return;
    if (e) { e.preventDefault(); e.stopPropagation(); }
    bootDone({ skipped: true });
  };
  const box = $('boot');
  box?.addEventListener('click', skip);
  const onKey = (e) => {
    if (done) { window.removeEventListener('keydown', onKey, true); return; }
    if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta') return;
    skip(e);
    window.removeEventListener('keydown', onKey, true);
  };
  window.addEventListener('keydown', onKey, true);
  // Controller: irgendein Knopf überspringt (nur solange der Ladebildschirm steht)
  const pad = () => {
    if (done) return;
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    if (pads.some((p) => p.buttons?.some((b) => b.pressed))) { bootDone({ skipped: true }); return; }
    requestAnimationFrame(pad);
  };
  window.addEventListener('gamepadconnected', () => requestAnimationFrame(pad), { once: true });
  const sk = $('boot-skip');
  if (sk) sk.textContent = t('boot.skip');
  nextTip();
  tipT = setInterval(nextTip, 2600);
}
setTimeout(() => bootDone(), MAX_MS);
