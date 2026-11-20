/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// NULLPUNKT — App-Kennung und App-exklusive Inhalte (riesen 20.11.). Nutzer: „gigantische Maps, 4× so groß wie die
// bisherigen, welche nur Spieler mit der App-Version spielen können – weder im Browser, noch im Handy-Browser, noch im
// VR-Browser.“ Karten mit MAPS[id].appOnly (shared/maps.data.js) sind nur in der Desktop-App (Electron, desktop/) und in
// der Android-App (Capacitor, mobile/) spielbar. Browser, Handy-Browser, installierte Web-App (PWA) und VR-Browser
// (Meta-Quest-Browser) sehen die Karte in der Lobby mit Schloss und dem Hinweis „Nur in der App“.
//
// Kennung (beide Wege setzt die App selbst, keiner davon setzt eine Webseite von sich aus):
//   · Desktop-App: window.nullpunktDesktop (desktop/preload.js, contextBridge) und Nutzeragent-Zusatz
//     „NullpunktApp/<Version> (desktop)“ (desktop/main.js)
//   · Android-App: window.Capacitor.isNativePlatform() (Capacitor-Brücke im WebView) und Nutzeragent-Zusatz
//     „NullpunktApp/<Version> (android)“ (mobile/capacitor.config.json appendUserAgent)
// Ehrlich: Das ist eine Plattform-Vorgabe, kein Kopierschutz. Der Spielcode liegt offen im Browser; wer den
// Nutzeragenten fälscht oder window.nullpunktDesktop selbst anlegt, kommt an der Sperre vorbei. Im Mehrspieler prüft
// der Host die Kennung, die der Beitretende mitschickt (net/index.js) – auch die ist fälschbar.
// Ohne Abhängigkeiten und ohne Nebenwirkungen beim Import (auch in Node/Worker lesbar).

const W = typeof window !== 'undefined' ? window : null;
const N = typeof navigator !== 'undefined' ? navigator : {};

/** Seite „App“ der Startseite (Herunterladen). */
export const APP_PAGE_URL = 'index.html#app';
/** Nutzeragent-Zusatz der Apps: „NullpunktApp/1.0.0 (desktop|android)“. */
export const APP_UA_RE = /\bNullpunktApp\/[\w.-]+ \((desktop|android)\)/;

let cached = null;

/**
 * Welche App läuft hier? → { kind: 'desktop-app' | 'android-app' | null, via: 'bridge' | 'ua' | null, vr: bool }
 * vr: Seite läuft in einem VR-Browser (Meta-Quest-Browser) – dort gibt es keine App-Kennung.
 */
export function appClient() {
  if (cached) return cached;
  let kind = null, via = null;
  try { if (W && W.nullpunktDesktop && W.nullpunktDesktop.isDesktop) { kind = 'desktop-app'; via = 'bridge'; } } catch { /* */ }
  if (!kind) {
    try { if (W && W.Capacitor && typeof W.Capacitor.isNativePlatform === 'function' && W.Capacitor.isNativePlatform()) { kind = 'android-app'; via = 'bridge'; } } catch { /* */ }
  }
  const ua = String(N.userAgent || '');
  if (!kind) {
    const m = ua.match(APP_UA_RE);
    if (m) { kind = m[1] === 'desktop' ? 'desktop-app' : 'android-app'; via = 'ua'; }
  }
  cached = Object.freeze({ kind, via, vr: /OculusBrowser|Quest|Pico|Wolvic/i.test(ua) && !kind });
  return cached;
}

/** Läuft das Spiel in einer der Apps (Desktop oder Android)? */
export const isAppClient = () => !!appClient().kind;

/** Karte (MAPS-Eintrag oder Objekt mit appOnly) nur in der App spielbar? */
export const isAppOnlyMap = (map) => !!(map && typeof map === 'object' && map.appOnly);

/** Karte hier gesperrt (App-exklusiv und kein App-Client)? */
export const mapLockedHere = (map) => isAppOnlyMap(map) && !isAppClient();

/** Hinweistext für eine gesperrte Karte (kurz, für Karte/Tooltip). */
export function lockReason() {
  const c = appClient();
  if (c.vr) return 'Nur in der App: im VR-Browser nicht spielbar – mit PC-VR über die PC-App (SteamVR, Quest Link).';
  return 'Nur in der App: PC-App (Windows, Linux) oder Android-App.';
}
