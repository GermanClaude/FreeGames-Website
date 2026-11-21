/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Nutzung, Kopie oder Übernahme nur mit vorheriger
 * schriftlicher Erlaubnis (Discord German_Legend_26201, legendgerman749@gmail.com). Siehe LICENSE. */
// NULLPUNKT — Website. Start: Chrom und Hero sofort, Daten parallel, Abschnitte erst in Sichtnähe.
import { loadData } from './data.js?v=20261121041936';
import { initNav, setNavSound } from './nav.js?v=20261121041936';
import { initCursor } from './cursor.js?v=20261121041936';
import { initZero } from './zero.js?v=20261121041936';
import { fitAll, fontsReady } from './fit.js?v=20261121041936';
import { initDeploy } from './deploy.js?v=20261121041936';
import { sound } from './sound.js?v=20261121041936';
import { setSettingReduced } from './motion.js?v=20261121041936';
import { signalLost } from './dom.js?v=20261121041936';
import { startSiteClock } from '../shared/sitetime.js?v=20261121041936';
import { initJumps, jumpTo, setEnsureUpTo } from './jump.js?v=20261121041936';
import { initHud } from './hud.js?v=20261121041936'; // Startbildschirm (21.11.)
import { bootStep, bootDone } from './boot.js?v=20261121041936'; // Spielmenü (21.11.): Ladebildschirm
import { initMenu } from './menu.js?v=20261121041936'; // Spielmenü (21.11.): Kategorien als Bildschirme
import { t, attachI18n } from './lang.js?v=20261121041936';
import { BUILD } from '../shared/build.js?v=20261121041936';

const html = document.documentElement;
const DEBUG = /[?&]debug=1/.test(location.search);
html.classList.remove('no-js');
html.classList.add('js');

function detectWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}
// Zurück aus dem Spiel über den Zwischenspeicher des Browsers (bfcache): Der eingefrorene Tab hat die 'storage'-
// Ereignisse des Spiels verpasst. Ein synthetisches 'storage'-Ereignis (key null = „alles neu lesen“) nimmt denselben
// Weg wie die Tab-Synchronisation: Profil, Einstellungen und Website-Speicher lesen neu und melden Änderungen weiter
// (Fahne, Profil, Status, Satzbau, Einstellungen).
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  try { window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: window.localStorage })); } catch { /* kein Speicher */ }
});

const webgl = detectWebGL();
html.classList.toggle('no-webgl', !webgl);
const saveData = !!navigator.connection?.saveData;
const pendingEnsure = [];
const ctx = {
  sound, webgl, saveData,
  // Bis die Abschnitte starten dürfen (Schriften), werden Anfragen gesammelt.
  ensure: (key) => new Promise((resolve) => pendingEnsure.push(() => ctx.ensure(key).then(resolve))),
};

/* Chrom + Hero */
// Telefone und Tablets: Hinweis unter „Sofort spielen.“ (quer halten, Touch-Belegung)
const coarseMq = window.matchMedia('(pointer: coarse)');
const touchPlay = document.getElementById('touch-play');
const showTouch = () => { if (touchPlay) touchPlay.hidden = !coarseMq.matches; };
showTouch();
coarseMq.addEventListener?.('change', showTouch);
// app (14.11.): in der Desktop-/Android-App heißt es nicht „im Browser, kein Download“
if (html.classList.contains('is-app')) {
  const lead = document.querySelector('#nullpunkt .lead');
  if (lead) lead.textContent = window.nullpunktDesktop ? 'Ego-Shooter. Du gegen Bots oder online mit allen – PC-App mit Extrem-Grafik.' : 'Ego-Shooter. Du gegen Bots oder online mit allen.';
}
startSiteClock(); // Zeit auf der Webseite fürs Zwiegespräch (§09 Über)
initNav();
setNavSound(sound);
initZero({ sound });
initHud({ sound });
// Spielmenü: Kategorien bauen, Anker/Direktlinks umleiten (vor dem Aufbau der Abschnitte, die Bildschirme verschieben sie)
initMenu({ sound, ensureView: (key) => ctx.ensure(key), getData: () => ctx.D });
// Übersetzung (shared/i18n.js): übersetzt die Seite selbst, sobald eine andere Sprache als Deutsch gewählt ist
import('../shared/i18n.js?v=20261121041936').then(attachI18n).catch((err) => console.error('[NULLPUNKT] Übersetzung:', err));

initJumps();

// Telefon quer: Abschnittsüberschriften auch nach der Höhe begrenzen (sonst füllt EINSATZ. den ganzen ersten Blick).
// Die Breite gleicht über die Breitenachse aus; zu kurze Wörter stehen dann linksbündig.
const shortLandscape = window.matchMedia('(pointer: coarse) and (max-height: 500px)');
for (const hl of document.querySelectorAll('h2.hl[data-fit]')) {
  hl.fitOpts = { ...(hl.fitOpts || {}), max: () => (shortLandscape.matches ? Math.max(56, Math.round(window.innerHeight * 0.27)) : 320) };
}
shortLandscape.addEventListener?.('change', () => fitAll(document));

let fontsDone = false;
const fontsP = (document.fonts?.ready || Promise.resolve()).then(() => {
  fontsDone = true;
  fontsReady();
  fitAll(document, { now: true });
});
// Sicherheitsnetz, falls die Schriften hängen (nur dann; sonst würde es laufende Zustände neu setzen)
setTimeout(() => { if (!fontsDone) { fontsReady(); fitAll(document, { now: true }); } }, 3000);

const VIEWS = {
  news: () => import('./news-view.js?v=20261121041936'), // §02 Neu (20.11.)
  campaign: () => import('./campaign-view.js?v=20261121041936'), // §03 Kampagne
  sim: () => import('./sim-view.js?v=20261121041936'), // §04 Simulation
  modes: () => import('./modes-view.js?v=20261121041936'),
  maps: () => import('./maps-view.js?v=20261121041936'),
  arsenal: () => import('./arsenal-view.js?v=20261121041936'),
  profile: () => import('./profile-view.js?v=20261121041936'),
  settings: () => import('./settings-view.js?v=20261121041936'),
  controls: () => import('./controls-view.js?v=20261121041936'),
  about: () => import('./about-view.js?v=20261121041936'),
  app: () => import('./app-view.js?v=20261121041936'), // app (14.11.): Herunterladen / Web-App / App-Einstellungen
  gallery: () => import('./gallery-view.js?v=20261121041936'), // Spielmenü (21.11.): Galerie mit Bildbetrachter
  quick: () => import('./quick-view.js?v=20261121041936'), // Spielmenü (21.11.): Schnellwahl Sprache/Ton/Grafik
  multi: () => import('./multi-view.js?v=20261121041936'), // Spielmenü (21.11.): Mehrspieler – Raumcode
};

/* Ladebildschirm (21.11.): die echten Schritte nach den Spieldaten – Texturen vorladen, Service Worker, Update-Prüfung */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function preloadImages(srcs, ms = 3000) {
  let n = 0;
  return Promise.all(srcs.filter(Boolean).map((src) => Promise.race([
    new Promise((res) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { n++; (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(res); };
      im.onerror = () => res();
      im.src = src;
    }),
    wait(ms),
  ]))).then(() => n);
}
async function bootSequence() {
  try {
    bootStep(t('boot.tex'), 62);
    const hero = document.querySelector('.hero-img');
    const wide = window.matchMedia('(orientation: landscape)').matches;
    const n = await preloadImages([
      hero?.currentSrc || hero?.src,
      document.querySelector('#brief-news img')?.src,
      wide ? 'assets/img/neu/vgl-hafen-nachher.webp' : null,
      'assets/img/maps/hafen.webp', // Übergang „Sofort spielen“
      'assets/img/neu/hero-m.webp',
    ]);
    bootStep(t('boot.tex.ok', { n }), 82, { ok: true });
    bootStep(t('boot.update'), 86);
    const swP = import('../shared/pwa.js?v=20261121041936').then((m) => m.registerSW()).catch(() => null);
    let web = '';
    let offline = false;
    try {
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 2500);
      const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store', signal: ctl.signal });
      clearTimeout(tm);
      web = String((await r.json()).build || '');
    } catch { offline = true; }
    const reg = await Promise.race([swP, wait(1200).then(() => null)]);
    bootStep(offline ? t('boot.update.off', { build: BUILD }) : web && web > BUILD ? t('boot.update.new', { build: web }) : t('boot.update.ok', { build: BUILD }), 96, { ok: true });
    if (reg) bootStep(t('boot.update.sw'), 98, { ok: true });
    bootStep(t('boot.ready'), 100);
  } catch (err) { console.error('[NULLPUNKT] Ladebildschirm:', err); }
  bootDone();
}

function heroData(D) {
  const line = document.getElementById('data-line');
  if (!line || !D.ok.modes) return;
  const modes = D.M.MODE_ORDER.length;
  const maps = D.P.MAP_ORDER.length;
  const weapons = D.W ? D.W.WEAPON_IDS.filter((id) => D.W.WEAPONS[id].cls !== 'melee').length : 10;
  let bots = 0;
  for (const id of D.M.MODE_ORDER) {
    const l = D.M.MODES[id].limits;
    if (l) bots = Math.max(bots, (l.allies?.[1] || 0) + (l.enemies?.[1] || 0));
  }
  // Jede Angabe bleibt zusammen; umbrochen wird nur an den Mittelpunkten.
  const items = [`${modes} MODI`, `${maps} KARTEN`, `${weapons} WAFFEN`, `BIS ZU ${bots} BOTS`];
  // Zahlen im Fließtext (data-count) aus denselben Daten – neue Waffen, Modi oder Karten zählen von selbst mit
  const counts = { modes, maps, weapons, bots };
  for (const el of document.querySelectorAll('[data-count]')) if (counts[el.dataset.count] !== undefined) el.textContent = String(counts[el.dataset.count]);
  line.replaceChildren(...items.flatMap((t, i) => {
    const sp = document.createElement('span');
    sp.className = 'nw';
    sp.textContent = t;
    return i ? [document.createTextNode(' · '), sp] : [sp];
  }));
}

function statusWho(D) {
  const who = document.querySelector('.who');
  if (!who || !D.profile) return;
  const P = D.profile;
  const upd = () => {
    const p = P.get();
    const name = (D.settings.get('playerName') || p.name || 'Operator').toLocaleUpperCase('de-DE');
    document.getElementById('st-callsign').textContent = name;
    document.getElementById('st-level').textContent = `STUFE ${p.level}`;
    const icon = document.getElementById('st-rank');
    // Das Abzeichen ist nur Zierde (STUFE n steht daneben) und erscheint erst groß genug (≥ 1440 px, 20 px)
    try { icon.innerHTML = D.profileMod.rankIcon(p.level, { size: 20, title: false }); icon.setAttribute('aria-hidden', 'true'); } catch { icon.textContent = ''; }
    who.hidden = false;
  };
  upd();
  P.onChange(upd);
  D.settings.onChange((k) => { if (k === 'playerName') upd(); });
}

async function boot() {
  bootStep(t('boot.data'), 14);
  const D = await loadData();
  bootStep(t('boot.data.ok'), 40, { ok: true });
  ctx.D = D;
  sound.init(D.settings);
  initCursor(D.settings);
  setSettingReduced(D.settings.get('reducedMotion'));
  D.settings.onChange((k, v) => { if (k === 'reducedMotion') setSettingReduced(v); });
  heroData(D);
  try { initDeploy(D, { snd: sound, webgl }); } catch (err) { console.error(err); signalLost(document.getElementById('satz')?.parentNode, 'Der Satzbau ist ausgefallen.'); }
  statusWho(D);

  // Abschnitte erst initialisieren, wenn sie innerhalb eines Bildschirms herankommen
  bootStep(t('boot.fonts'), 48);
  await fontsP;
  bootStep(t('boot.fonts.ok'), 56, { ok: true });
  bootSequence();
  const started = new Map();
  const start = (sec) => {
    const key = sec?.dataset.view;
    if (!key || !VIEWS[key]) return Promise.resolve();
    if (started.has(key)) return started.get(key);
    const p = (async () => {
      try {
        const m = await VIEWS[key]();
        const t0 = performance.now();
        await m.init(sec, D, ctx);
        if (DEBUG) console.info(`[NULLPUNKT] Abschnitt ${key}: ${Math.round(performance.now() - t0)} ms`);
      } catch (err) {
        console.error(`[NULLPUNKT] Abschnitt ${key}:`, err);
        signalLost(sec.querySelector('.content'), 'Dieser Abschnitt konnte nicht aufgebaut werden.');
      }
    })();
    started.set(key, p);
    return p;
  };
  // Andere Abschnitte können einen Abschnitt vorzeitig aufbauen lassen (z. B. „Im Arsenal prüfen.“)
  ctx.ensure = (key) => start(document.querySelector(`section[data-view="${key}"]`));
  const sections = [...document.querySelectorAll('section[data-view]')].filter((s) => VIEWS[s.dataset.view]);
  /** Alle Abschnitte vom Anfang bis einschließlich des Abschnitts, der el enthält (oder vor el liegt). */
  const ensureUpTo = (el) => Promise.all(sections
    .filter((s) => s === el || s.contains(el) || (s.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))
    .map(start));
  const ensureAll = () => Promise.all(sections.map(start));
  ctx.ensureUpTo = ensureUpTo;
  setEnsureUpTo(ensureUpTo);
  for (const fn of pendingEnsure.splice(0)) fn();
  // Was in Sichtnähe kommt, sofort …
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); start(e.target); }
  }, { rootMargin: '100% 0px' });
  for (const sec of sections) io.observe(sec);
  // … alles Übrige der Reihe nach im Leerlauf (Ankersprünge, Tab-Reihenfolge und Seitenhöhe sind dann stabil).
  // Telefone und schwache Geräte: nur in echten Leerlaufphasen (≥ 30 ms frei), später und nicht schon beim ersten
  // Tippen oder Scrollen – sonst blockiert der Aufbau genau die ersten Eingaben. Was in Sichtnähe kommt, baut der
  // Beobachter oben ohnehin auf, Sprünge und Tab sofort.
  const lowEnd = coarseMq.matches || (navigator.hardwareConcurrency || 8) <= 4 || saveData;
  const ric = window.requestIdleCallback;
  const idle = (fn) => {
    if (!ric) { setTimeout(fn, lowEnd ? 400 : 120); return; }
    const wait = (dl) => (dl.didTimeout || dl.timeRemaining() >= (lowEnd ? 30 : 8) ? fn() : ric(wait, { timeout: lowEnd ? 4000 : 1200 }));
    ric(wait, { timeout: lowEnd ? 4000 : 1200 });
  };
  const queue = [...sections];
  const next = () => {
    const sec = queue.shift();
    if (!sec) return;
    start(sec).then(() => idle(next));
  };
  // Erst wenn die Seite ein paar Sekunden steht: Der erste Bildschirm bleibt flüssig. Auf dem Rechner zieht eine
  // erste Bewegung (Scrollen, Tippen) den Aufbau vor.
  let queued = false;
  const kickOn = lowEnd ? ['keydown'] : ['scroll', 'pointerdown', 'keydown'];
  const kick = () => {
    if (queued) return;
    queued = true;
    for (const t of kickOn) window.removeEventListener(t, kick, true);
    idle(next);
  };
  for (const t of kickOn) window.addEventListener(t, kick, { capture: true, passive: true });
  setTimeout(kick, lowEnd ? 10000 : 4000);
  // Tastatur: Beim ersten Tab sofort alles aufbauen, damit die Fokusreihenfolge vollständig ist.
  const onTab = (e) => { if (e.key === 'Tab') { window.removeEventListener('keydown', onTab, true); ensureAll(); } };
  window.addEventListener('keydown', onTab, true);
  // Direktsprung per Anker (index.html#einstellungen): bis zum Ziel aufbauen, dann ohne Bewegung anfahren.
  const hashId = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
  if (hashId && document.getElementById(hashId)) jumpTo(hashId, { smooth: false, focus: false, hash: false });

  // Fahne (nach einem Match) – klein, wird im Leerlauf geladen
  if (D.profile) {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 400));
    idle(async () => {
      try { (await import('./fahne.js?v=20261121041936')).initFahne(D, ctx); } catch (err) { console.error('[NULLPUNKT] Fahne:', err); }
    });
  }
}

boot().catch((err) => { console.error('[NULLPUNKT] Start:', err); bootDone(); });
