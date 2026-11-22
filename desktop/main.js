// NULLPUNKT — Desktop-Hülle (Electron). Kein eigener Spielcode: die App zeigt spielen.html aus dem Repo-Stand, der beim
// Bauen als extraResources/game mitgepackt wird (im Entwicklungsmodus direkt aus dem Repo-Ordner über diesem Ordner).
//
// • Dateien über das eigene Protokoll app://nullpunkt/ (fester Ursprung → Einstellungen/Profil im localStorage bleiben
//   über Neustarts erhalten; „secure“ → crypto.subtle/WebRTC wie auf https). ES-Module, KTX2, WASM (Basis-Transcoder)
//   bekommen den richtigen MIME-Typ; Abfrageteile (?v=…) werden ignoriert; Range-Anfragen (Audio/Video) gehen.
// • Mehr Leistung als im Browser: großer JS-Heap (--max-old-space-size), GPU-Sperrliste aus, keine Drosselung im
//   Hintergrund (Online-Host läuft weiter, wenn das Fenster nicht vorne ist), WebGPU freigeschaltet.
// • Spiel erkennt die App an window.nullpunktDesktop (preload.js) → Grafikstufe „Extrem“, Einladungslinks auf die
//   öffentliche Seite.
// • F11 / Alt+Enter: Vollbild umschalten; F12 (nur mit --dev): Entwicklerwerkzeuge. Kein Menü.
// • app (14.11.): Start auf der interaktiven Startseite (index.html, dort Bereich „App“ mit App-Einstellungen); ein
//   Einladungslink oder --query startet direkt im Spiel. Fenstergröße/Vollbild werden gemerkt. App-Einstellungen in
//   userData/nullpunkt-app.json: Bildrate ohne VSync (Neustart), Start im Vollbild. Stürzt der Spielprozess ab, merkt
//   sich die App das (lastCrash) – „Extrem“ nimmt dann 4K- statt 8K-Schatten (engine/renderer.js).
// • Spielmenü (21.11.): Beim Start zuerst ein eigenes Startfenster (splash.html, über app://nullpunkt/__splash.html,
//   damit es die Spielschriften nutzen kann) mit echten Ladeschritten: App/Spielfassung, Grafikkarte, Update-Prüfung
//   gegen die Webseite, danach die Schritte der Startseite (Spieldaten, Texturen …, über preload.js bootStep/bootDone).
//   Das Hauptfenster bleibt verborgen, bis die Startseite fertig meldet (höchstens 15 s), dann Übergang ins Hauptmenü.
//   NULLPUNKT_NO_SPLASH=1 schaltet das Startfenster ab (Tests).
// • Selbstaktualisierung (21.11., updater.js): Installer/AppImage laden neue Releases im Hintergrund und installieren
//   beim Beenden oder per „Jetzt neu starten und installieren“; die portable .exe meldet nur „Neue Version verfügbar“.
// • VR: WebXR/OpenXR-Schalter gesetzt; ob Electron eine Brille meldet, hängt von der Electron-Fassung ab (Spiel zeigt
//   sonst im VR-Abschnitt einen Hinweis auf Chrome/Edge bzw. den Quest-Browser).
'use strict';

const { app, BrowserWindow, protocol, ipcMain, shell, Menu, session, dialog, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { Readable } = require('node:stream');
const { createUpdater } = require('./updater.js');

const SCHEME = 'app';
const HOST = 'nullpunkt';
const ORIGIN = `${SCHEME}://${HOST}`;
const WEB_URL = 'https://germanclaude.github.io/FreeGames-Website/';
const RELEASES_URL = 'https://github.com/GermanClaude/FreeGames-Website/releases';
const DEV = process.argv.includes('--dev') || !app.isPackaged;

/* ------------------------------------------------------------------ App-Einstellungen (userData) */

const CFG_DEFAULTS = { vsync: true, startFullscreen: true, bounds: null, wasFullscreen: null, lastCrash: null };
const CFG_KEYS = new Set(['vsync', 'startFullscreen']); // von der Seite änderbar (lastCrash nur löschen)
let cfgFile = null;
let cfg = { ...CFG_DEFAULTS };
try {
  cfgFile = path.join(app.getPath('userData'), 'nullpunkt-app.json');
  cfg = { ...CFG_DEFAULTS, ...JSON.parse(fs.readFileSync(cfgFile, 'utf8')) };
} catch { /* erster Start */ }
function saveCfg() {
  if (!cfgFile) return;
  try { fs.mkdirSync(path.dirname(cfgFile), { recursive: true }); fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 1)); } catch { /* schreibgeschützt */ }
}
const CRASH_MEMORY_MS = 3 * 24 * 3600 * 1000;
const recentCrash = () => (cfg.lastCrash && Date.now() - (cfg.lastCrash.at || 0) < CRASH_MEMORY_MS ? cfg.lastCrash : null);

/** Spieldateien: gepackt unter resources/game, sonst der Repo-Ordner. NULLPUNKT_GAME_DIR überschreibt (Tests). */
const GAME_DIR = process.env.NULLPUNKT_GAME_DIR
  ? path.resolve(process.env.NULLPUNKT_GAME_DIR)
  : app.isPackaged ? path.join(process.resourcesPath, 'game') : path.resolve(__dirname, '..');

/* ------------------------------------------------------------------ Schalter (vor app.ready) */

// Speicher: JS-Heap des Spiels fest auf 4 GB (Chrome-Tab: je nach RAM 2–4 GB und mit anderen Tabs geteilt); bei wenig
// RAM die Hälfte des Arbeitsspeichers.
const totalGB = os.totalmem() / 1073741824;
// V8 mit Zeigerkompression (Chromium/Electron) begrenzt einen Heap auf ≈ 4 GB – mehr bringt der Schalter nicht.
const heapMB = Math.max(2048, Math.min(4096, Math.floor((totalGB * 1024) / 2)));
app.commandLine.appendSwitch('js-flags', `--max-old-space-size=${heapMB}`);
// GPU: Hardwarebeschleunigung erzwingen (auch auf GPUs der Chromium-Sperrliste), Rasterung auf der GPU, WebGPU an.
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('force_high_performance_gpu'); // Laptops: dedizierte GPU statt der integrierten
// Bildrate nicht an die Bildschirmfrequenz koppeln? Nein – VSync bleibt an (Spiel hat eigene FPS-Grenze).
// Keine Drosselung im Hintergrund (Online-Host, Ladebildschirm hinter anderem Fenster)
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
// app: Bildrate ohne VSync (App-Einstellung, wirkt nach Neustart) – für Monitore ohne Adaptive Sync / Messungen
if (cfg.vsync === false) {
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('disable-frame-rate-limit');
}
// VR: WebXR über OpenXR (Windows: SteamVR, Meta Quest Link, WMR). Nur ein Versuch – ob eine Brille gemeldet wird,
// hängt davon ab, ob die Electron-Fassung den XR-Dienst enthält; das Spiel prüft isSessionSupported('immersive-vr').
app.commandLine.appendSwitch('enable-features', 'WebXR,OpenXR');
// Ton ohne Klick starten (Menümusik)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (process.env.NULLPUNKT_NO_GPU === '1') app.disableHardwareAcceleration(); // Tests ohne GPU

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true, allowServiceWorkers: false },
}]);

/* ------------------------------------------------------------------ Dateien ausliefern */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.hdr': 'application/octet-stream', '.exr': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

function notFound() { return new Response('Nicht gefunden', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } }); }

async function serve(request) {
  const url = new URL(request.url);
  if (url.host !== HOST) return notFound();
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return notFound(); }
  if (rel.endsWith('/')) rel += 'index.html';
  // Startfenster (gehört zur App, nicht zum Spielordner)
  let file;
  if (rel === '/__splash.html') file = path.join(__dirname, 'splash.html');
  else {
    file = path.normalize(path.join(GAME_DIR, rel));
    if (file !== GAME_DIR && !file.startsWith(GAME_DIR + path.sep)) return notFound(); // nichts außerhalb des Spielordners
  }
  let st;
  try { st = await fs.promises.stat(file); } catch { return notFound(); }
  if (!st.isFile()) return notFound();
  const headers = {
    'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-cache',
    'accept-ranges': 'bytes',
    // Ursprungsisolierung wie ein guter Webserver (SharedArrayBuffer/genaue Zeitmessung möglich)
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    date: new Date().toUTCString(),
  };
  const size = st.size;
  const range = request.headers.get('range');
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    let end = m[1] && m[2] ? Math.min(size - 1, Number(m[2])) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    headers['content-range'] = `bytes ${start}-${end}/${size}`;
    headers['content-length'] = String(end - start + 1);
    if (request.method === 'HEAD') return new Response(null, { status: 206, headers });
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), { status: 206, headers });
  }
  headers['content-length'] = String(size);
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  // kleine Dateien am Stück (schneller als Streams), große gestreamt
  if (size < 4 * 1048576) return new Response(await fs.promises.readFile(file), { status: 200, headers });
  return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers });
}

/* ------------------------------------------------------------------ Fenster */

let win = null;

function readBuild() {
  try { return JSON.parse(fs.readFileSync(path.join(GAME_DIR, 'version.json'), 'utf8')).build || ''; } catch { return ''; }
}

const INFO_STATIC = {
  app: 'nullpunkt-desktop',
  version: app.getVersion(),
  build: readBuild(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  platform: process.platform,
  arch: process.arch,
  memoryGB: Math.round(totalGB * 10) / 10,
  heapMB,
  cpus: os.cpus().length,
  webUrl: WEB_URL,
  releasesUrl: RELEASES_URL,
};
/** Daten für window.nullpunktDesktop (bei jedem Seitenaufruf neu: Einstellungen und Absturzmerker können sich ändern). */
const info = () => ({
  ...INFO_STATIC,
  lastCrash: recentCrash(),
  config: { vsync: cfg.vsync !== false, startFullscreen: cfg.startFullscreen !== false },
  features: ['extrem', 'massenschlacht-400', 'host-hintergrund', 'lokale-assets', 'vsync-aus', 'fenster-merken'],
});
const INFO = INFO_STATIC;

function toggleFullscreen(w = win) {
  if (!w || w.isDestroyed()) return false;
  w.setFullScreen(!w.isFullScreen());
  return w.isFullScreen();
}

function createWindow() {
  const b = cfg.bounds && cfg.bounds.width >= 960 && cfg.bounds.height >= 540 ? cfg.bounds : null;
  const startFs = process.env.NULLPUNKT_WINDOWED === '1' ? false
    : DEV ? false : cfg.wasFullscreen === false ? false : cfg.startFullscreen !== false;
  win = new BrowserWindow({
    title: 'NULLPUNKT',
    width: b ? b.width : 1600,
    height: b ? b.height : 900,
    ...(b && Number.isFinite(b.x) && Number.isFinite(b.y) ? { x: b.x, y: b.y } : {}),
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#0a0b0d',
    icon: path.join(GAME_DIR, 'assets', 'img', process.platform === 'win32' ? 'icon-192.png' : 'icon-512.png'),
    autoHideMenuBar: true,
    show: false,
    fullscreen: startFs,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
      enableWebSQL: false,
      devTools: true,
    },
  });
  win.setMenu(null);
  // Startseite: erst zeigen, wenn sie „fertig“ meldet (Ladebildschirm im Startfenster); Spiel direkt: sobald bereit
  const url = startUrl();
  const waitBoot = !!splash && /\/index\.html$/.test(url);
  win.once('ready-to-show', () => { if (!waitBoot) showMain(); else setTimeout(showMain, 15000); });
  // Titel bleibt „NULLPUNKT“ (die Seite setzt sonst ihren eigenen)
  win.on('page-title-updated', (e) => e.preventDefault());
  win.on('enter-full-screen', () => win.webContents.send('np:fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('np:fullscreen', false));
  // Fenster merken (Größe/Lage im Fenstermodus, ob zuletzt Vollbild)
  win.on('close', () => {
    try {
      cfg.wasFullscreen = win.isFullScreen();
      if (!win.isFullScreen() && !win.isMaximized() && !win.isMinimized()) cfg.bounds = win.getBounds();
      saveCfg();
    } catch { /* */ }
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) { toggleFullscreen(); event.preventDefault(); }
    else if (input.key === 'F12' && DEV) { win.webContents.toggleDevTools(); event.preventDefault(); }
  });

  // Fremde Seiten (Hilfe, Quellen, GitHub) im Standardbrowser öffnen, das Spiel bleibt in der App
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGIN + '/')) return { action: 'allow' };
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith(ORIGIN + '/')) return;
    e.preventDefault();
    if (/^https?:\/\//.test(url)) {
      // Einladungslinks der Webseite (spielen.html?raum=CODE) in der App öffnen statt im Browser
      try {
        const u = new URL(url);
        if (u.href.startsWith(WEB_URL) && /spielen\.html$/.test(u.pathname)) { win.loadURL(`${ORIGIN}/spielen.html${u.search}`); return; }
      } catch { /* */ }
      shell.openExternal(url);
    }
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit') return;
    console.error('[NULLPUNKT] Spielprozess beendet:', JSON.stringify(details));
    cfg.lastCrash = { at: Date.now(), reason: details.reason, code: details.exitCode, url: String(win.webContents.getURL() || '').replace(ORIGIN, '').slice(0, 200) };
    saveCfg();
    if (process.env.NULLPUNKT_NO_DIALOGS === '1') return; // Tests
    const r = dialog.showMessageBoxSync(win, {
      type: 'error', title: 'NULLPUNKT', message: 'Das Spiel wurde unerwartet beendet.',
      detail: `Grund: ${details.reason}. Bei „oom“ hilft eine niedrigere Grafikstufe oder weniger Bots.`, buttons: ['Neu laden', 'Beenden'],
    });
    if (r === 0) win.loadURL(startUrl()); else app.quit();
  });

  win.loadURL(url);
}

/* ------------------------------------------------------------------ Startfenster (Ladebildschirm) */

let splash = null;
let mainShown = false;

function splashSend(fn, arg) {
  if (!splash || splash.isDestroyed()) return;
  splash.webContents.executeJavaScript(`window.${fn} && window.${fn}(${JSON.stringify(arg ?? null)})`).catch(() => {});
}

function createSplash() {
  if (process.env.NULLPUNKT_NO_SPLASH === '1') return;
  splash = new BrowserWindow({
    title: 'NULLPUNKT',
    width: 760, height: 428, center: true, frame: false, resizable: false, movable: true, minimizable: true, maximizable: false,
    fullscreenable: false, show: false, backgroundColor: '#070909', skipTaskbar: false,
    icon: path.join(GAME_DIR, 'assets', 'img', process.platform === 'win32' ? 'icon-192.png' : 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, devTools: DEV },
  });
  splash.setMenu(null);
  splash.once('ready-to-show', () => { if (!mainShown) splash.show(); });
  splash.on('closed', () => { splash = null; });
  splash.webContents.on('will-navigate', (e) => e.preventDefault());
  splash.webContents.once('did-finish-load', () => { splashSteps().catch(() => {}); });
  splash.loadURL(`${ORIGIN}/__splash.html`);
}

/** Eigene Schritte des Startfensters (vor bzw. neben den Schritten der Startseite). */
async function splashSteps() {
  splashSend('npInfo', { version: app.getVersion(), build: INFO.build, platform: process.platform });
  splashSend('npStep', { label: `PC-App ${app.getVersion()} · Spielfassung ${INFO.build || '?'}`, pct: 4, ok: true });
  let gpu = '';
  try {
    const st = app.getGPUFeatureStatus();
    gpu = /^enabled/.test(st.webgl2 || '') ? 'Grafikkarte: WebGL 2 mit Hardwarebeschleunigung' : `Grafik: ${st.webgl2 || 'unbekannt'} (Software-Darstellung möglich)`;
  } catch { gpu = 'Grafikkarte geprüft'; }
  splashSend('npStep', { label: gpu, pct: 8, ok: true });
  splashSend('npStep', { label: 'Update-Prüfung …', pct: 10 });
  const r = await fetchWebBuild();
  splashSend('npStep', {
    label: r.error ? 'Update-Prüfung: offline – du spielst die installierte Fassung' : r.newer ? `Neuere Spielfassung ${r.web} online (Hinweis folgt)` : 'Update-Prüfung: aktuell',
    pct: 12, ok: true,
  });
}

/* ------------------------------------------------------------------ Selbstaktualisierung */

let updater = null;
const UPD_ERR = { offline: 'offline', 'kein-release': 'noch kein Release', gesperrt: 'GitHub gerade nicht erreichbar' };
function onUpdateState(st) {
  if (win && !win.isDestroyed()) win.webContents.send('np:update', st);
  if (!splash || splash.isDestroyed()) return;
  const label = st.status === 'checking' ? 'App-Update: Prüfung …'
    : st.status === 'downloading' ? `App-Update ${st.version || ''} wird im Hintergrund geladen${st.percent ? ` (${st.percent} %)` : ''}`
      : st.status === 'downloaded' ? `App-Update ${st.version || ''} bereit – wird beim Beenden installiert`
        : st.status === 'none' ? `App ${st.current} ist aktuell`
          : st.status === 'manual' ? `Neue App-Version ${st.version} verfügbar (Download unter „Updates & App“)`
            : st.status === 'error' ? `App-Update: ${UPD_ERR[st.error] || 'nicht möglich'}` : '';
  if (label) splashSend('npStep', { label, pct: 11, ok: st.status !== 'checking' && st.status !== 'downloading' });
}

function showMain() {
  if (mainShown || !win || win.isDestroyed()) return;
  mainShown = true;
  win.show();
  win.focus();
  if (splash && !splash.isDestroyed()) {
    splashSend('npDone');
    setTimeout(() => { try { splash?.close(); } catch { /* */ } }, 420);
  }
}

/** Start: die Startseite (index.html). Mit Abfrageteil aus der Befehlszeile (--query=debug=1&autostart=1 …) oder einem
 *  Einladungslink direkt spielen.html; --page=spielen.html startet ohne Abfrage im Spiel. */
function startUrl() {
  const page = process.argv.find((a) => a.startsWith('--page='));
  let q = '';
  const arg = process.argv.find((a) => a.startsWith('--query='));
  if (arg) q = arg.slice('--query='.length);
  const link = process.argv.find((a) => /^https?:\/\/.*spielen\.html\?/.test(a) || /^nullpunkt:/.test(a));
  if (!q && link) { try { q = new URL(link.replace(/^nullpunkt:\/*/, 'https://x/spielen.html')).search.slice(1); } catch { /* */ } }
  if (!q && !(page && /^--page=spielen\.html$/.test(page))) return `${ORIGIN}/index.html`;
  return `${ORIGIN}/spielen.html${q ? '?' + q : ''}`;
}

/* ------------------------------------------------------------------ Hinweis auf neue Spielversion */

// Online spielen Desktop und Browser nur mit gleicher Spielfassung (BUILD + NET_VERSION). Ist die Webseite neuer, sagt
// die App das einmal – ohne etwas selbst herunterzuladen.
let webCheck = null;
/** Spielfassung der Webseite → { local, web, newer, error }. Einmal je Start zwischengespeichert (force: neu fragen). */
function fetchWebBuild(force = false) {
  if (webCheck && !force) return webCheck;
  webCheck = (async () => {
    if (process.env.NULLPUNKT_NO_UPDATE_CHECK === '1') return { local: INFO.build, web: '', newer: false, error: 'aus' };
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 6000);
      const res = await net.fetch(`${WEB_URL}version.json?t=${Date.now()}`, { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(t);
      if (!res.ok) return { local: INFO.build, web: '', newer: false, error: `http ${res.status}` };
      const web = String((await res.json()).build || '');
      return { local: INFO.build, web, newer: !!(web && INFO.build && web > INFO.build), error: null };
    } catch (err) { return { local: INFO.build, web: '', newer: false, error: String(err && err.name || 'offline') }; }
  })();
  return webCheck;
}

async function checkWebVersion() {
  if (process.env.NULLPUNKT_NO_UPDATE_CHECK === '1') return;
  // Installer/AppImage aktualisieren sich selbst (updater.js) – dann kein zusätzlicher Dialog
  if (updater && updater.state().mode === 'auto') return;
  try {
    const chk = await fetchWebBuild();
    const web = chk.web;
    if (chk.error || !chk.newer || !win || win.isDestroyed()) return;
    const r = await dialog.showMessageBox(win, {
      type: 'info', title: 'NULLPUNKT', buttons: ['Später', 'Download-Seite öffnen'], defaultId: 0, cancelId: 0,
      message: 'Eine neuere Spielversion ist online.',
      detail: `Desktop: ${INFO.build}\nWebseite: ${web}\n\nOnline-Spiele mit Browser-Spielern brauchen dieselbe Version. Offline spielst du weiter wie bisher.`,
    });
    if (r.response === 1) shell.openExternal(RELEASES_URL);
  } catch { /* offline: kein Hinweis */ }
}

/* ------------------------------------------------------------------ Start */

const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    // Einladungslink an die laufende App (z. B. aus dem Browser/Messenger „Öffnen mit“): Raum in der App öffnen
    const link = (argv || []).find((x) => /^https?:\/\/.*spielen\.html\?/.test(x) || /^nullpunkt:/.test(x));
    if (link) { try { const q = new URL(link.replace(/^nullpunkt:\/*/, 'https://x/spielen.html')).search; win.loadURL(`${ORIGIN}/spielen.html${q}`); } catch { /* */ } }
  });

  ipcMain.on('np:info', (e) => { e.returnValue = info(); });
  ipcMain.handle('np:set-config', (_e, key, value) => {
    if (key === 'lastCrash' && value === null) { cfg.lastCrash = null; saveCfg(); return true; }
    if (!CFG_KEYS.has(key) || typeof value !== 'boolean') return false;
    cfg[key] = value;
    saveCfg();
    return true;
  });
  ipcMain.handle('np:relaunch', () => { app.relaunch(); app.exit(0); });
  ipcMain.handle('np:toggle-fullscreen', (e) => toggleFullscreen(BrowserWindow.fromWebContents(e.sender)));
  ipcMain.handle('np:set-fullscreen', (e, on) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.setFullScreen(!!on); return !!(w && w.isFullScreen()); });
  ipcMain.handle('np:is-fullscreen', (e) => { const w = BrowserWindow.fromWebContents(e.sender); return !!(w && w.isFullScreen()); });
  ipcMain.handle('np:open-external', (_e, url) => { if (/^https:\/\//.test(String(url))) shell.openExternal(String(url)); });
  ipcMain.handle('np:quit', () => app.quit());
  // Spielmenü (21.11.): Ladeschritte der Startseite ins Startfenster, „fertig“ zeigt das Hauptfenster
  ipcMain.on('np:boot', (_e, st) => {
    if (!st || typeof st !== 'object') return;
    const label = String(st.label || '').slice(0, 160);
    const pct = Math.max(0, Math.min(100, Number(st.pct) || 0));
    // Die Seite zählt 0–100; im Startfenster sind 0–12 % die eigenen Schritte der App
    splashSend('npStep', { label, pct: 12 + pct * 0.88, ok: !!st.ok });
  });
  ipcMain.on('np:boot-done', () => { if (!mainShown) setTimeout(showMain, 120); });
  ipcMain.handle('np:check-update', () => fetchWebBuild(true));
  // Selbstaktualisierung: Zustand, Prüfen, Installieren (Neustart), Download im Browser (portable)
  ipcMain.handle('np:update-state', () => (updater ? updater.state() : null));
  ipcMain.handle('np:update-check', () => (updater ? updater.check() : null));
  ipcMain.handle('np:update-install', () => (updater ? updater.install() : false));
  ipcMain.handle('np:update-open', () => (updater ? updater.openDownload() : false));

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    // riesen (20.11.): App-Kennung im Nutzeragenten (zusätzlich zu window.nullpunktDesktop) – das Spiel schaltet damit
    // App-exklusive Inhalte frei (Riesenkarte, shared/appgate.js) und meldet sie dem Host im Mehrspieler
    try { session.defaultSession.setUserAgent(`${session.defaultSession.getUserAgent()} NullpunktApp/${app.getVersion()} (desktop)`); } catch { /* */ }
    protocol.handle(SCHEME, serve);
    // Mikrofon (Sprachchat), Vollbild, Zeigersperre, Gamepad: erlauben; alles andere ablehnen
    const ALLOW = new Set(['media', 'fullscreen', 'pointerLock', 'keyboardLock', 'clipboard-sanitized-write', 'clipboard-read', 'speaker-selection', 'window-management']);
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(ALLOW.has(perm)));
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => ALLOW.has(perm));
    createSplash();
    createWindow();
    try {
      const ulog = DEV || process.env.NULLPUNKT_UPDATE_LOG === '1'; // Diagnose: Updater-Meldungen auf stdout
      updater = createUpdater({ app, shell, net, onState: (st) => { if (ulog) console.log('[update] Zustand', JSON.stringify(st)); onUpdateState(st); }, log: (m) => { if (ulog) console.log(m); } });
      updater.start();
    } catch (err) { console.error('[NULLPUNKT] Updater:', err); updater = null; }
    setTimeout(checkWebVersion, 8000);
  });
  app.on('window-all-closed', () => app.quit());
}
