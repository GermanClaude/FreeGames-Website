// NULLPUNKT — Desktop-Brücke (läuft isoliert vor der Seite). Das Spiel erkennt die App an window.nullpunktDesktop
// (Grafikstufe „Extrem“, Einladungslinks auf die öffentliche Seite, Bereich „App“ auf der Startseite). Nur Daten und wenige harmlose Befehle – kein Node.
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

let info = {};
try { info = ipcRenderer.sendSync('np:info') || {}; } catch { info = {}; }

const fsListeners = new Set();
ipcRenderer.on('np:fullscreen', (_e, on) => { for (const fn of fsListeners) { try { fn(!!on); } catch { /* */ } } });

contextBridge.exposeInMainWorld('nullpunktDesktop', Object.freeze({
  /** App-Kennung und Umgebung (Version der Hülle, Spielfassung, Electron/Chrome, RAM in GB, JS-Heap in MB, öffentliche URL). */
  ...info,
  isDesktop: true,
  /** Vollbild umschalten → Promise<bool> (neuer Zustand). */
  toggleFullscreen: () => ipcRenderer.invoke('np:toggle-fullscreen'),
  setFullscreen: (on) => ipcRenderer.invoke('np:set-fullscreen', !!on),
  isFullscreen: () => ipcRenderer.invoke('np:is-fullscreen'),
  /** Abo auf Vollbild-Wechsel (F11, Alt+Enter); gibt eine Abmeldefunktion zurück. */
  onFullscreen: (fn) => { if (typeof fn === 'function') fsListeners.add(fn); return () => fsListeners.delete(fn); },
  /** https-Link im Standardbrowser öffnen. */
  openExternal: (url) => ipcRenderer.invoke('np:open-external', String(url)),
  quit: () => ipcRenderer.invoke('np:quit'),
  /** App-Einstellung setzen (vsync, startFullscreen: bool; lastCrash: null = Absturzmerker löschen) → Promise<bool>. */
  setConfig: (key, value) => ipcRenderer.invoke('np:set-config', String(key), value),
  /** App neu starten (z. B. nach VSync-Wechsel). */
  relaunch: () => ipcRenderer.invoke('np:relaunch'),
}));
