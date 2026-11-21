/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// NULLPUNKT — Web-App (PWA, app 14.11.): Service Worker (sw.js) registrieren, Installationsangebot (Chromium/Edge:
// beforeinstallprompt; iPhone/iPad: Anleitung „Zum Home-Bildschirm“), Offline-Paket vorladen, Plattform erkennen.
// Wird von index.html und spielen.html als eigenes Modul geladen (registriert sich selbst im Leerlauf) und von der
// Startseite (site/app-view.js) für den Bereich „App“ benutzt.
//
// Kein Service Worker in der Desktop-App (Dateien liegen dort ohnehin lokal, app://-Protokoll) und auf localhost nur
// mit ?sw=1 (sonst sähe die Entwicklung bei gleicher BUILD alten Code aus dem Zwischenspeicher). ?sw=0 meldet ihn ab.
import { BUILD } from './build.js?v=20261121041936';

const W = typeof window !== 'undefined' ? window : null;
const N = typeof navigator !== 'undefined' ? navigator : {};

/** Plattform: 'desktop-app' (Electron), 'android-app' (Capacitor-Hülle), 'pwa' (installierte Web-App), 'web'. */
export function appKind() {
  if (!W) return 'web';
  if (W.nullpunktDesktop) return 'desktop-app';
  try { if (W.Capacitor && typeof W.Capacitor.isNativePlatform === 'function' && W.Capacitor.isNativePlatform()) return 'android-app'; } catch { /* */ }
  if (isStandalone()) return 'pwa';
  return 'web';
}

export function isStandalone() {
  if (!W) return false;
  try {
    return N.standalone === true || W.matchMedia('(display-mode: standalone)').matches || W.matchMedia('(display-mode: fullscreen)').matches
      || W.matchMedia('(display-mode: window-controls-overlay)').matches;
  } catch { return false; }
}

const UA = N.userAgent || '';
export const device = Object.freeze({
  ios: /iPhone|iPod|iPad/.test(UA) || (N.platform === 'MacIntel' && (N.maxTouchPoints || 0) > 1),
  android: /Android/i.test(UA),
  quest: /OculusBrowser|Quest/i.test(UA),
  safari: /Safari/.test(UA) && !/Chrome|CriOS|FxiOS|EdgiOS|Android/.test(UA),
  firefox: /Firefox|FxiOS/.test(UA),
  windows: /Windows/.test(UA),
  linux: /Linux/.test(UA) && !/Android/.test(UA),
  mac: /Macintosh/.test(UA),
});

/* ------------------------------------------------------------------ Installationsangebot */

let installEvent = null;
let installed = false;
const listeners = new Set();
const notify = () => { for (const f of listeners) { try { f(installState()); } catch { /* */ } } };
if (W) {
  W.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; notify(); });
  W.addEventListener('appinstalled', () => { installEvent = null; installed = true; notify(); precache().catch(() => {}); });
}

/** { canPrompt, installed, standalone, kind, ios, android, quest } */
export function installState() {
  return { canPrompt: !!installEvent, installed: installed || isStandalone(), standalone: isStandalone(), kind: appKind(), ...device };
}
export function onInstallChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Installationsdialog (aus einer Geste) → 'accepted' | 'dismissed' | 'unavailable'. */
export async function promptInstall() {
  const ev = installEvent;
  if (!ev) return 'unavailable';
  installEvent = null;
  try {
    ev.prompt();
    const r = await ev.userChoice;
    notify();
    return r && r.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch { notify(); return 'unavailable'; }
}

/* ------------------------------------------------------------------ Service Worker */

const LOCAL = W ? /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(location.hostname) : false;
let regP = null;

function swWanted() {
  if (!W || !('serviceWorker' in N) || !W.isSecureContext) return false;
  if (W.nullpunktDesktop || location.protocol === 'app:') return false;
  const q = new URLSearchParams(location.search).get('sw');
  if (q === '0') {
    try { localStorage.removeItem('nullpunkt:sw'); } catch { /* */ }
    N.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    return false;
  }
  if (q === '1') { try { localStorage.setItem('nullpunkt:sw', '1'); } catch { /* */ } return true; }
  if (LOCAL) { try { return localStorage.getItem('nullpunkt:sw') === '1'; } catch { return false; } }
  return true;
}

export function registerSW() {
  if (regP) return regP;
  if (!swWanted()) return (regP = Promise.resolve(null));
  const url = new URL('sw.js', document.baseURI);
  url.searchParams.set('v', BUILD);
  regP = N.serviceWorker.register(url.href, { scope: new URL('./', document.baseURI).pathname, updateViaCache: 'none' })
    .then((r) => r, (err) => { console.warn('[NULLPUNKT] Service Worker:', err && err.message); return null; });
  return regP;
}

async function controller() {
  const r = await registerSW();
  if (!r) return null;
  await N.serviceWorker.ready;
  return r.active || N.serviceWorker.controller;
}

function ask(msg, { onProgress, timeout = 0 } = {}) {
  return controller().then((sw) => new Promise((resolve, reject) => {
    if (!sw) { reject(new Error('kein Service Worker')); return; }
    let t = 0;
    const done = msg.t === 'precache' ? 'precache:done' : msg.t;
    const on = (e) => {
      const d = e.data || {};
      if (d.t === 'precache:progress') { if (onProgress) onProgress(d); return; }
      if (d.t === done) { clearTimeout(t); N.serviceWorker.removeEventListener('message', on); resolve(d); }
    };
    if (timeout) t = setTimeout(() => { N.serviceWorker.removeEventListener('message', on); reject(new Error('timeout')); }, timeout);
    // Der Service Worker antwortet über e.source.postMessage → navigator.serviceWorker 'message'
    N.serviceWorker.addEventListener('message', on);
    sw.postMessage(msg);
  }));
}

/** Ganzen Code + Seiten für offline vorladen (ohne assets/lib – die kommen beim Spielen dazu). */
export function precache(onProgress) {
  try { if (N.storage && N.storage.persist) N.storage.persist().catch(() => {}); } catch { /* */ }
  return ask({ t: 'precache' }, { onProgress });
}
/** { build, code, lib } – Einträge im Zwischenspeicher. */
export function swStatus() { return ask({ t: 'status' }, { timeout: 5000 }); }

/** Speicherbelegung (Bytes) der Seite, falls der Browser es verrät. */
export async function storageUsage() {
  try { const e = await N.storage.estimate(); return { usage: e.usage || 0, quota: e.quota || 0 }; } catch { return null; }
}

// Selbst registrieren, wenn die Seite steht (nicht während des ersten Ladens um Bandbreite konkurrieren)
if (W) {
  const go = () => { const idle = W.requestIdleCallback || ((f) => setTimeout(f, 1500)); idle(() => registerSW(), { timeout: 5000 }); };
  if (document.readyState === 'complete') go(); else W.addEventListener('load', go, { once: true });
}
