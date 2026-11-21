/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// NULLPUNKT — Service Worker (PWA, app 14.11.): Offline-Spiel und schnelles Laden für die installierte Web-App
// (Handy, Tablet, PC über Chrome/Edge, Meta-Quest-Browser) und den Browser. Registriert von shared/pwa.js als
// sw.js?v=<BUILD> – eine neue Fassung bringt so einen neuen Service Worker mit.
//
// Zwischenspeicher:
//   np-code-<BUILD>  Seiten, Code, Stile, Schriften, Bilder, three.js (gehört zur Fassung; alte werden beim Aktivieren gelöscht)
//   np-lib           assets/lib/** (Texturen, Modelle, HDRIs, Klang – groß, bleibt über Fassungen hinweg; jeder Eintrag
//                    trägt die Fassung, in der er geholt wurde, und wird nach einem Update einmal im Hintergrund
//                    nachgeprüft: GitHub Pages antwortet dann meist 304, die Datei kommt aus dem HTTP-Cache)
// Strategien:
//   Seitenaufrufe (HTML), version.json: zuerst Netz (4 s Zeitlimit), sonst Zwischenspeicher → offline spielbar.
//   Dateien mit ?v=<BUILD>: zuerst Zwischenspeicher (Adresse ändert sich mit jeder Fassung).
//   Übrige eigene Dateien: Zwischenspeicher sofort, im Hintergrund nachladen (stale-while-revalidate).
//   Range-Anfragen (Audio/Video-Streaming), fremde Ursprünge (Nostr-Relays, Poly Haven), POST: nicht angefasst.
//   cache: 'reload'/'no-store' (engine/update.js „Jetzt aktualisieren“): immer Netz, Ergebnis wird gespeichert.
// Nachrichten: {t:'precache'} lädt alle Seiten und den ganzen Code (aus HTML/JS/CSS gesammelt, ohne assets/lib) für
// den Offline-Betrieb vor und meldet {t:'precache:progress', done, total} bzw. {t:'precache:done', ok, failed, bytes}.
// {t:'status'} → {t:'status', build, code, lib} (Anzahl Einträge).
// riesen (20.11.): Dateien App-exklusiver Karten (APP_ONLY, Riesenkarte „Weitmark“) kommen NIE in np-code/np-lib und
// nicht ins Offline-Paket der Web-Version (Speicher; im Browser ist die Karte ohnehin gesperrt). Die Android-App legt sie
// beim ersten Laden der Karte selbst in np-app ab (world/terrain/bigworld.js); von dort liefert sie dieser Service
// Worker auch offline. Die Desktop-App hat alle Dateien lokal (kein Service Worker).
'use strict';

const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev';
const CODE = `np-code-${BUILD}`;
const LIB = 'np-lib';
const SCOPE = new URL(self.registration ? self.registration.scope : './', self.location.href);
const SHELL = ['./', 'index.html', 'spielen.html', 'manifest.webmanifest', 'version.json', 'assets/img/icon-192.png', 'assets/img/icon-512.png'];
const NET_TIMEOUT_MS = 4000;

const inScope = (url) => url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);
const relPath = (url) => url.pathname.slice(SCOPE.pathname.length);
const isLib = (url) => relPath(url).startsWith('assets/lib/');
const APP = 'np-app';
const APP_ONLY = ['assets/js/game/world/maps/weitmark'];
const isAppOnly = (url) => APP_ONLY.some((p) => relPath(url).startsWith(p));

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CODE);
    // Grundgerüst; einzelne Fehler (offline beim Update) brechen die Installation nicht ab
    await Promise.all(SHELL.map((p) => fetch(new Request(new URL(p, SCOPE), { cache: 'reload' }))
      .then((r) => (r.ok ? c.put(new URL(p, SCOPE).href, r) : null)).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('np-code-') && k !== CODE) await caches.delete(k);
    try { if (self.registration.navigationPreload) await self.registration.navigationPreload.enable(); } catch { /* */ }
    await self.clients.claim();
  })());
});

/** Antwort mit Fassungsstempel (für np-lib) – nur vollständige 200er ohne Vary-Fallen. */
function stamp(res) {
  const h = new Headers(res.headers);
  h.set('x-np-build', BUILD);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

function timeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

async function put(cacheName, req, res) {
  if (!res || res.status !== 200 || res.type === 'opaque') return;
  try {
    const c = await caches.open(cacheName);
    await c.put(req, cacheName === LIB ? stamp(res) : res);
  } catch { /* Speicher voll: einfach nicht speichern */ }
}

async function networkFirst(e, req, key) {
  try {
    const pre = e.preloadResponse ? await e.preloadResponse.catch(() => null) : null;
    const res = pre || await timeout(fetch(req), NET_TIMEOUT_MS);
    if (res.ok) { const copy = res.clone(); e.waitUntil(put(CODE, key, copy)); }
    return res;
  } catch {
    const c = await caches.open(CODE);
    const hit = (await c.match(key, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match(new URL('index.html', SCOPE).href) : null);
    if (hit) return hit;
    return new Response('<!doctype html><meta charset="utf-8"><title>NULLPUNKT – offline</title><body style="background:#0a0b0d;color:#eee;font:16px system-ui;padding:2em">'
      + '<h1>Keine Verbindung.</h1><p>Diese Seite ist noch nicht offline gespeichert. Einmal online öffnen (oder auf der Startseite unter „App“ „Für offline speichern“ wählen), dann geht es auch ohne Netz.</p>',
    { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}

async function cacheFirst(e, req, cacheName) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  if (hit) {
    // np-lib: nach einem Fassungswechsel einmal im Hintergrund nachprüfen (bedingte Anfrage, meist 304 → HTTP-Cache)
    if (cacheName === LIB && hit.headers.get('x-np-build') !== BUILD) {
      e.waitUntil(fetch(req, { cache: 'no-cache' }).then((r) => put(LIB, req, r)).catch(() => {}));
    }
    return hit;
  }
  const res = await fetch(req);
  if (res.ok) { const copy = res.clone(); e.waitUntil(put(cacheName, req, copy)); }
  return res;
}

async function staleWhileRevalidate(e, req) {
  const c = await caches.open(CODE);
  const hit = await c.match(req);
  const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); return put(CODE, req, copy).then(() => res); } return res; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (!inScope(url)) return;
  const rel = relPath(url);
  if (rel === 'sw.js' || rel.startsWith('sw.js')) return;
  // riesen: App-exklusiv – nur aus np-app (von der App befüllt), sonst Netz ohne Zwischenspeichern
  if (isAppOnly(url)) { e.respondWith(caches.open(APP).then((c) => c.match(req)).then((hit) => hit || fetch(req)).catch(() => fetch(req))); return; }
  // Ausdrücklich am Cache vorbei (Update-Knopf): Netz, Ergebnis merken
  if (req.cache === 'reload' || req.cache === 'no-store') {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok && rel !== 'version.json') { const copy = res.clone(); e.waitUntil(put(isLib(url) ? LIB : CODE, req, copy)); }
      return res;
    }));
    return;
  }
  if (req.mode === 'navigate' || /\.html$/.test(rel) || rel === '' || rel === 'version.json' || rel === 'manifest.webmanifest') {
    // Schlüssel ohne Abfrage: spielen.html?mode=… und spielen.html teilen sich einen Eintrag
    const key = new URL(url.pathname, url.origin).href;
    e.respondWith(networkFirst(e, req, key));
    return;
  }
  if (isLib(url)) { e.respondWith(cacheFirst(e, req, LIB)); return; }
  if (url.searchParams.get('v') === BUILD) { e.respondWith(cacheFirst(e, req, CODE)); return; }
  e.respondWith(staleWhileRevalidate(e, req));
});

/* ------------------------------------------------------------------ Offline-Paket (Code vorladen) */

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"\n]+?)\1/g;
const URL_RE = /new\s+URL\(\s*(['"])([^'"\n]+?)\1\s*,\s*import\.meta\.url\s*\)/g;
const HTML_RE = /\b(?:src|href)\s*=\s*(['"])([^'"#\n]+?)\1/g;
const CSS_RE = /url\(\s*(['"]?)([^'")\n]+?)\1\s*\)/g;
const IMPORTMAP_RE = /"(\.\/assets\/vendor\/[^"]+?\.js)"/g;

function collect(text, base, kind) {
  const out = [];
  const add = (spec) => {
    if (!spec || /^(data:|blob:|mailto:|javascript:|#)/.test(spec)) return;
    if (kind === 'js' && !/^(\.|\/)/.test(spec)) {
      // nackte Namen (three, three/addons/…) über die Import-Map
      if (spec === 'three') spec = new URL('assets/vendor/three/three.module.min.js', SCOPE).href;
      else if (spec.startsWith('three/addons/')) spec = new URL('assets/vendor/three/addons/' + spec.slice(13), SCOPE).href;
      else return;
    }
    try { const u = new URL(spec, base); if (inScope(u) && !isLib(u) && !isAppOnly(u)) out.push(u.href); } catch { /* */ }
  };
  const res = kind === 'html' ? [HTML_RE, IMPORTMAP_RE, IMPORT_RE] : kind === 'css' ? [CSS_RE] : [IMPORT_RE, URL_RE];
  for (const re of res) { re.lastIndex = 0; let m; while ((m = re.exec(text))) add(m[2] || m[1]); }
  return out;
}

let precaching = null;
async function precacheAll(reply) {
  const c = await caches.open(CODE);
  const seen = new Set();
  const queue = SHELL.map((p) => new URL(p, SCOPE).href);
  let done = 0, failed = 0, bytes = 0;
  const worker = async () => {
    while (queue.length) {
      const href = queue.shift();
      const u = new URL(href);
      const key = /\.html$|\/$/.test(u.pathname) ? new URL(u.pathname, u.origin).href : href;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        let res = await c.match(key);
        if (!res) {
          res = await fetch(href, { cache: 'no-cache' });
          if (!res.ok) throw new Error(String(res.status));
          await c.put(key, res.clone());
        }
        const type = res.headers.get('content-type') || '';
        const kind = /html/.test(type) || /\.html$|\/$/.test(u.pathname) ? 'html' : /javascript/.test(type) || /\.m?js$/.test(u.pathname) ? 'js' : /css/.test(type) || /\.css$/.test(u.pathname) ? 'css' : null;
        if (kind) {
          const text = await res.text();
          bytes += text.length;
          for (const n of collect(text, href, kind)) if (!seen.has(n)) queue.push(n);
        } else {
          const b = await res.blob(); bytes += b.size;
        }
      } catch { failed++; }
      done++;
      if (done % 25 === 0) reply({ t: 'precache:progress', done, total: done + queue.length });
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { t: 'precache:done', ok: done - failed, failed, bytes };
}

self.addEventListener('message', (e) => {
  const d = e.data || {};
  const src = e.source;
  const reply = (m) => { try { src && src.postMessage(m); } catch { /* */ } };
  if (d.t === 'precache') {
    if (!precaching) precaching = precacheAll(reply).finally(() => { precaching = null; });
    e.waitUntil(precaching.then(reply));
  } else if (d.t === 'status') {
    e.waitUntil((async () => {
      const code = (await (await caches.open(CODE)).keys()).length;
      const lib = (await (await caches.open(LIB)).keys()).length;
      reply({ t: 'status', build: BUILD, code, lib });
    })());
  }
});
