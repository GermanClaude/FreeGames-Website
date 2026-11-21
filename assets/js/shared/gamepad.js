// NULLPUNKT — Controller und Konsolen (Strang „plattform“, 19.11.): eine gemeinsame Quelle für
//   activePad()      den Controller, mit dem gerade gespielt wird (zuletzt benutzt, Standard-Mapping bevorzugt) –
//                    statt „erster verbundener“: Steam Input, Steam Deck, VR-Brillen und Windows melden oft zusätzliche,
//                    ruhende Geräte vor dem echten Controller (dann reagierte vorher gar nichts).
//   padFamily(id)    'xbox' | 'ps' | 'nintendo' | 'steam' aus der Geräte-Kennung (Hersteller-ID oder Name),
//   consoleKind(ua)  'xbox' | 'playstation' | 'nintendo' | 'steamdeck' | 'tv' | null aus dem User-Agent
//                    (Edge auf der Xbox, PS-Browser, Steam Deck im Spielmodus, Fernseher mit Browser),
//   tvDefault()      soll der TV-/Konsolen-Modus (große Schrift, Couch-Abstand) automatisch an sein?
// Reines Modul ohne DOM-Pflicht (Node-Tests: scratchpad/plat/).

/** Name/Kennung → Familie. Vendor-IDs: 045e Microsoft, 054c Sony, 057e Nintendo, 28de Valve. */
export function padFamily(id) {
  const s = String(id || '');
  if (/054c|dualsense|dualshock|playstation|ps[345] controller/i.test(s)) return 'ps';
  if (/057e|nintendo|pro controller|joy-?con/i.test(s)) return 'nintendo';
  if (/28de|steam deck|steam virtual|valve|steam controller/i.test(s)) return 'steam';
  // „Wireless Controller“ ohne Hersteller (Safari/macOS, Firefox): fast immer ein PlayStation-Controller
  if (/^wireless controller/i.test(s.trim())) return 'ps';
  return 'xbox';
}

/** Symbolsatz zu einer Familie: Steam/Steam Deck nutzt die Xbox-Beschriftung (A/B/X/Y an denselben Stellen). */
export function padGlyphSet(family) {
  return family === 'ps' ? 'ps' : family === 'nintendo' ? 'nintendo' : 'xbox';
}

let _last = null; // zuletzt aktiver Controller (index)
const _stamp = new Map(); // index → letzter Zeitstempel mit Eingabe

/** Hat dieser Controller gerade eine Eingabe (Taste oder Stick außerhalb der Totzone)? */
function busy(p) {
  const b = p.buttons || [];
  for (let i = 0; i < b.length; i++) { const x = b[i]; if (x && (x.pressed || x.value > 0.5)) return true; }
  const a = p.axes || [];
  for (let i = 0; i < a.length && i < 4; i++) if (Math.abs(a[i] || 0) > 0.45) return true;
  return false;
}

/**
 * Der Controller, mit dem gespielt wird: wer zuletzt eine Eingabe hatte; ohne Eingabe der zuletzt aktive, sonst der erste
 * mit Standard-Mapping, sonst der erste verbundene. pads = navigator.getGamepads() (Tests: eigene Liste).
 */
export function activePad(pads = null) {
  let list = pads;
  if (!list) {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
    try { list = navigator.getGamepads() || []; } catch { return null; }
  }
  let first = null, firstStd = null, lastPad = null, best = null, bestT = -1;
  for (const p of list) {
    if (!p || p.connected === false) continue;
    if (!first) first = p;
    if (!firstStd && p.mapping === 'standard') firstStd = p;
    if (p.index === _last) lastPad = p;
    if (busy(p)) {
      const t = Number(p.timestamp) || 0;
      _stamp.set(p.index, t);
      // bei gleichem Zeitstempel: Standard-Mapping bevorzugen
      if (t > bestT || (t === bestT && best && best.mapping !== 'standard' && p.mapping === 'standard')) { best = p; bestT = t; }
    }
  }
  const pick = best || lastPad || firstStd || first;
  if (pick) _last = pick.index;
  return pick;
}

/** Für Tests: Auswahl vergessen. */
export function resetPadChoice() { _last = null; _stamp.clear(); }

/** Konsole/Fernseher aus dem User-Agent (navigator.userAgent). */
export function consoleKind(ua) {
  const s = String(ua == null ? (typeof navigator !== 'undefined' ? navigator.userAgent : '') : ua);
  if (/Xbox|XboxOne|Xbox Series/i.test(s)) return 'xbox';
  if (/PlayStation|PS[345]\b/i.test(s)) return 'playstation';
  if (/Nintendo (Switch|WiiU)/i.test(s)) return 'nintendo';
  if (/Steam ?Deck|Valve Steam (Client|GameOverlay|Tenfoot)/i.test(s)) return 'steamdeck';
  if (/SMART-TV|SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|AFT[A-Z]|HbbTV|CrKey|GoogleTV|Android TV|AppleTV/i.test(s)) return 'tv';
  return null;
}

/** TV-/Konsolen-Modus automatisch: Konsole oder Fernseher, nicht aber das Steam Deck (kleiner Bildschirm in der Hand). */
export function tvDefault(ua) {
  const k = consoleKind(ua);
  return k === 'xbox' || k === 'playstation' || k === 'tv';
}

/**
 * Effektive Oberflächen-Skalierung (1 = normal) aus den Einstellungen tvMode ('auto'|'an'|'aus') und
 * uiScale ('auto'|'90'|'100'|'115'|'130'|'150'); width = Fensterbreite (CSS-px).
 */
export function uiScaleFor(tvMode, uiScale, { ua = null, width = 1280 } = {}) {
  const tv = tvMode === 'an' || (tvMode !== 'aus' && tvDefault(ua));
  let s = uiScale && uiScale !== 'auto' ? Number(uiScale) / 100 : tv ? 1.3 : 1;
  if (!Number.isFinite(s) || s <= 0) s = 1;
  // Schmale Fenster: nicht über den Rand hinaus vergrößern (Lobby braucht ≈ 1100 CSS-px ohne Umbruch)
  const w = Number(width) || 1280;
  if (s > 1) s = Math.max(1, Math.min(s, w / 1100));
  return { tv, scale: Math.round(Math.min(1.6, Math.max(0.8, s)) * 100) / 100 };
}
