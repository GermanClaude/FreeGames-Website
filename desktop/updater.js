// NULLPUNKT — Selbstaktualisierung der Desktop-App (electron-updater, GitHub-Releases GermanClaude/FreeGames-Website).
//
// • Installer (NSIS, Windows) und AppImage (Linux): beim Start und danach alle 30 min prüfen, neue Version im Hintergrund
//   laden (Fortschritt ins Startfenster und an die Seite: „Updates & App“), installiert wird beim Beenden – oder sofort
//   über „Jetzt neu starten und installieren“ (quitAndInstall).
// • Portable .exe (PORTABLE_EXECUTABLE_DIR) kann sich nicht selbst ersetzen: nur latest.yml des neuesten Releases lesen,
//   „Neue Version verfügbar“ melden und auf Wunsch den Download (NULLPUNKT-portable.exe) im Browser öffnen.
// • Entwicklung (nicht gepackt), Linux ohne AppImage, NULLPUNKT_NO_UPDATE_CHECK=1: keine Prüfung.
// • Fehler (offline, noch kein Release/keine latest.yml, Rate-Limit) werden still als Zustand 'error' gemerkt – nie ein
//   Dialog, nie ein Absturz; die nächste Prüfung läuft regulär.
// Zustand → { mode, status, version, current, percent, bytesPerSecond, transferred, total, error, checkedAt }
//   mode: 'auto' | 'portable' | 'dev' | 'off'
//   status: 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'downloaded' | 'manual' | 'error' | 'disabled'
'use strict';

const OWNER = 'GermanClaude';
const REPO = 'FreeGames-Website';
const LATEST = `https://github.com/${OWNER}/${REPO}/releases/latest/download`;
const PORTABLE_URL = `${LATEST}/NULLPUNKT-portable.exe`;
const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases`;
const EVERY_MS = 30 * 60 * 1000;

/** Versionsvergleich a > b (1.2.10 > 1.2.9; Vorabversionen zählen nicht als neuer). */
function newer(a, b) {
  const p = (v) => String(v || '').replace(/^v/, '').split('-')[0].split('.').map((x) => parseInt(x, 10) || 0);
  const x = p(a);
  const y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

function shortError(err) {
  const m = String((err && (err.message || err)) || 'Fehler');
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|net::ERR_|offline|getaddrinfo/i.test(m)) return 'offline';
  if (/404|Cannot find latest|Unable to find latest|No published versions|latest.*\.yml/i.test(m)) return 'kein-release';
  if (/403|rate limit/i.test(m)) return 'gesperrt';
  return m.split('\n')[0].slice(0, 160);
}

/**
 * @param {object} o
 * @param {Electron.App} o.app
 * @param {Electron.Shell} o.shell
 * @param {Electron.Net} o.net
 * @param {(state: object) => void} o.onState  wird bei jeder Änderung gerufen (Fenster, Startfenster)
 * @param {(msg: string) => void} [o.log]
 */
function createUpdater({ app, shell, net, onState, log = () => {} }) {
  const current = app.getVersion();
  let mode = 'auto';
  if (!app.isPackaged) mode = 'dev';
  else if (process.env.NULLPUNKT_NO_UPDATE_CHECK === '1') mode = 'off';
  else if (process.env.PORTABLE_EXECUTABLE_DIR) mode = 'portable';
  else if (process.platform === 'linux' && !process.env.APPIMAGE) mode = 'off';
  else if (process.platform === 'darwin') mode = 'off'; // keine Mac-Fassung

  const state = {
    mode, status: mode === 'dev' || mode === 'off' ? 'disabled' : 'idle', current, version: null,
    percent: 0, bytesPerSecond: 0, transferred: 0, total: 0, error: null, checkedAt: 0,
  };
  const set = (patch) => {
    Object.assign(state, patch);
    try { onState({ ...state }); } catch { /* */ }
  };

  let autoUpdater = null;
  if (mode === 'auto') {
    try {
      ({ autoUpdater } = require('electron-updater'));
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.allowPrerelease = false;
      autoUpdater.allowDowngrade = false;
      autoUpdater.logger = { info: (m) => log(`[update] ${m}`), warn: (m) => log(`[update] ${m}`), error: (m) => log(`[update] ${m}`), debug: () => {} };
      // Feed fest auf GitHub-Releases (zusätzlich zu app-update.yml aus dem Build)
      autoUpdater.setFeedURL({ provider: 'github', owner: OWNER, repo: REPO, releaseType: 'release' });
      autoUpdater.on('checking-for-update', () => set({ status: 'checking', error: null }));
      autoUpdater.on('update-not-available', () => set({ status: 'none', version: null, checkedAt: Date.now() }));
      autoUpdater.on('update-available', (info) => set({ status: 'downloading', version: info && info.version, percent: 0, checkedAt: Date.now() }));
      autoUpdater.on('download-progress', (p) => set({
        status: 'downloading', percent: Math.round((p && p.percent) || 0), bytesPerSecond: (p && p.bytesPerSecond) || 0,
        transferred: (p && p.transferred) || 0, total: (p && p.total) || 0,
      }));
      autoUpdater.on('update-downloaded', (info) => set({ status: 'downloaded', version: (info && info.version) || state.version, percent: 100 }));
      autoUpdater.on('error', (err) => {
        // Nach fertigem Download nicht mehr zurückfallen (z. B. Fehler bei einer späteren Prüfung)
        if (state.status === 'downloaded') return;
        set({ status: 'error', error: shortError(err), checkedAt: Date.now() });
      });
    } catch (err) {
      log(`[update] electron-updater fehlt: ${err && err.message}`);
      autoUpdater = null;
      mode = 'portable'; // Rückfall: wenigstens melden
      set({ mode });
    }
  }

  /** Portable/Rückfall: latest.yml des neuesten Releases lesen. */
  async function checkManual() {
    set({ status: 'checking', error: null });
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 10000);
      const res = await net.fetch(`${LATEST}/latest.yml?t=${Date.now()}`, { signal: ctl.signal, cache: 'no-store', redirect: 'follow' });
      clearTimeout(t);
      if (!res.ok) { set({ status: 'error', error: res.status === 404 ? 'kein-release' : `http ${res.status}`, checkedAt: Date.now() }); return; }
      const txt = await res.text();
      const m = /^version:\s*['"]?([^'"\s]+)/m.exec(txt);
      const v = m && m[1];
      if (v && newer(v, current)) set({ status: 'manual', version: v, checkedAt: Date.now() });
      else set({ status: 'none', version: null, checkedAt: Date.now() });
    } catch (err) {
      set({ status: 'error', error: shortError(err), checkedAt: Date.now() });
    }
  }

  let busy = false;
  async function check() {
    if (state.mode === 'dev' || state.mode === 'off') return { ...state };
    if (busy || state.status === 'downloading' || state.status === 'downloaded') return { ...state };
    busy = true;
    try {
      if (autoUpdater) await autoUpdater.checkForUpdates().catch((err) => { if (state.status !== 'downloaded') set({ status: 'error', error: shortError(err), checkedAt: Date.now() }); });
      else await checkManual();
    } finally { busy = false; }
    return { ...state };
  }

  function install() {
    if (!autoUpdater || state.status !== 'downloaded') return false;
    try {
      // isSilent=false (NSIS zeigt kurz den Fortschritt), isForceRunAfter=true (danach wieder starten)
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
      return true;
    } catch (err) { set({ status: 'error', error: shortError(err) }); return false; }
  }

  function openDownload() {
    shell.openExternal(state.mode === 'portable' ? PORTABLE_URL : RELEASES_URL);
    return true;
  }

  let timer = null;
  function start() {
    if (state.mode === 'dev' || state.mode === 'off') { set({}); return; }
    check();
    timer = setInterval(check, EVERY_MS);
    if (timer.unref) timer.unref();
  }

  return { state: () => ({ ...state }), check, install, openDownload, start, newer };
}

module.exports = { createUpdater, newer };
