// NULLPUNKT — Mehrsprachigkeit (i18n): Deutsch (Quelle) + Englisch, Spanisch, Französisch, Russisch, vereinfachtes Chinesisch.
//
// ÜBERBLICK
//   Der Quelltext bleibt deutsch. Übersetzt wird über Kataloge: Schlüssel → Text. Ein Schlüssel ist entweder
//   • der deutsche Text selbst („Einsatz starten“) – wie gettext; fehlt die Übersetzung, erscheint der deutsche Text, oder
//   • ein semantischer Schlüssel („site.hero.title“, beginnt mit Kleinbuchstaben + Punkt) – sein deutscher Text steht in i18n/de.js.
//   Kataloge: assets/js/shared/i18n/<sprache>.js (export default { … }); erzeugt aus den Tabellen tools/i18n/*.mjs
//   (node tools/i18n-build.mjs), geprüft mit node tools/i18n-check.mjs (fehlende/überzählige Schlüssel je Sprache).
//
// API (für Spiel und Startseite)
//   LANGUAGES                 [{ id:'de'|'en'|'es'|'fr'|'ru'|'zh', name (eigene Schreibweise), locale (BCP 47) }]
//   getLanguage()             wirksame Sprache ('de' …), nie 'auto'
//   getLanguageSetting()      gespeicherte Wahl ('auto' | id)
//   setLanguage(id|'auto')    speichert in den Einstellungen (settings 'language'), lädt den Katalog, übersetzt die Seite neu,
//                             ruft onChange-Hörer → Promise<Sprache>
//   onChange(fn)              fn(lang) nach jedem Wechsel → Abmeldefunktion
//   ready                     Promise: Katalog der Startsprache geladen (dieses Modul wartet beim Import schon darauf)
//   t(key, params)            übersetzter Text. Platzhalter {name} bzw. {0}; Plural: Katalogwert { one, few, many, other }
//                             wird mit params.n (oder params.count / erstem Zahlenparameter) über Intl.PluralRules gewählt.
//   tx(deText, ctx?)          deutschen Laufzeittext übersetzen; ctx wählt Kontextschlüssel „ctx|Text“ (mehrdeutige Wörter) (wie die Seitenübersetzung: exakt, Zahlen-Schablonen
//                             „{#}“, Platzhalter-Muster, Teile mit „ · “) – für Canvas, Sprachausgabe, Untertitel.
//   plural(n, forms)          Pluralform wählen; fmtNumber(n, opts), fmtDate(d, opts), fmtTime(d, opts), fmtList(arr)
//   compass(deg)              Himmelsrichtung (0, 45, … 315 Grad) in der aktiven Sprache: N/NO/O … bzw. N/NE/E … / С/СВ/В … / 北/东北/东 …
//   locale()                  BCP-47-Tag der Sprache (z. B. 'zh-CN'), für eigene Intl-Aufrufe
//   translateDom(root)        Teilbaum sofort übersetzen (läuft sonst automatisch über einen MutationObserver)
//   voiceFor(seed)            passende Stimme (speechSynthesis) der Sprache oder null → dann nur Untertitel
//
// SEITENÜBERSETZUNG (nur wenn Sprache ≠ Deutsch, sonst null Kosten)
//   Textknoten und die Attribute title/aria-label/placeholder/alt werden beim Einfügen/Ändern nachgeschlagen.
//   Kein Übersetzen: Elemente mit data-noi18n, translate="no", script/style/textarea/input, contenteditable.
//   Das deutsche Original merkt sich der Übersetzer (WeakMap) – so geht ein Wechsel ohne Neuladen in jede Richtung.
//   Canvas-Texte (fillText/strokeText/measureText) und speechSynthesis laufen über dieselbe Nachschlage-Funktion:
//   Stimmen werden auf die gewählte Sprache umgestellt; gibt es keine, bleibt es bei Untertiteln (nichts wird gesprochen).
//
// MEHRSPIELER: Netzmeldungen tragen weiterhin Ids/Parameter bzw. den deutschen Quelltext; jeder Empfänger übersetzt selbst.

import { settings } from './settings.js?v=20261123115551';
import { BUILD } from './build.js?v=20261123115551';
import { setKeyLabelLanguage, loadKeyboardLayout } from './bindings.data.js?v=20261123115551';
import DE from './i18n/de.js?v=20261123115551';

export const LANGUAGES = Object.freeze([
  Object.freeze({ id: 'de', name: 'Deutsch', english: 'German', locale: 'de-DE' }),
  Object.freeze({ id: 'en', name: 'English', english: 'English', locale: 'en-US' }),
  Object.freeze({ id: 'es', name: 'Español', english: 'Spanish', locale: 'es-ES' }),
  Object.freeze({ id: 'fr', name: 'Français', english: 'French', locale: 'fr-FR' }),
  Object.freeze({ id: 'ru', name: 'Русский', english: 'Russian', locale: 'ru-RU' }),
  Object.freeze({ id: 'zh', name: '简体中文', english: 'Chinese (Simplified)', locale: 'zh-CN' }),
]);
const IDS = LANGUAGES.map((l) => l.id);
const HAS_DOM = typeof document !== 'undefined';

/* ------------------------------------------------------------------ Sprache bestimmen */

/** Erste unterstützte Sprache aus navigator.languages, sonst Deutsch. */
export function detectLanguage() {
  try {
    const list = (typeof navigator !== 'undefined' && (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])) || [];
    for (const tag of list) {
      const base = String(tag || '').toLowerCase().split(/[-_]/)[0];
      if (base === 'zh') {
        // nur vereinfachtes Chinesisch vorhanden: zh-TW/zh-HK/zh-Hant bekommen es trotzdem (besser als Deutsch)
        return 'zh';
      }
      if (IDS.includes(base)) return base;
    }
  } catch { /* */ }
  return 'de';
}

function urlLanguage() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    return q && IDS.includes(q) ? q : null;
  } catch { return null; }
}

function resolve(choice) {
  return IDS.includes(choice) ? choice : detectLanguage();
}

let lang = 'de';
let CAT = null; // Katalog der Zielsprache (null bei Deutsch)
const catalogs = new Map(); // id → Katalog
const listeners = new Set();

export function getLanguage() { return lang; }
export function getLanguageSetting() { const v = settings.get('language'); return v || 'auto'; }
export function locale() { return (LANGUAGES.find((l) => l.id === lang) || LANGUAGES[0]).locale; }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Kataloge als feste import()-Literale: so findet auch das Offline-Paket (sw.js) sie, und ?v= bleibt die Fassung
const CATALOGS = {
  en: () => import('./i18n/en.js?v=20261123115551'),
  es: () => import('./i18n/es.js?v=20261123115551'),
  fr: () => import('./i18n/fr.js?v=20261123115551'),
  ru: () => import('./i18n/ru.js?v=20261123115551'),
  zh: () => import('./i18n/zh.js?v=20261123115551'),
};
void BUILD;

async function loadCatalog(id) {
  if (id === 'de') return null;
  if (catalogs.has(id)) return catalogs.get(id);
  try {
    const m = await CATALOGS[id]();
    const c = (m && m.default) || {};
    catalogs.set(id, c);
    return c;
  } catch (err) {
    console.error('[NULLPUNKT] Sprachkatalog fehlt:', id, err);
    return null;
  }
}

/* ------------------------------------------------------------------ Formatieren, Plural */

const prCache = new Map();
function pluralRules() {
  let p = prCache.get(lang);
  if (!p) { try { p = new Intl.PluralRules(locale()); } catch { p = { select: (n) => (n === 1 ? 'one' : 'other') }; } prCache.set(lang, p); }
  return p;
}
/** Pluralform aus { zero?, one, two?, few?, many?, other } für n. */
export function plural(n, forms) {
  if (!forms || typeof forms !== 'object') return forms;
  const k = pluralRules().select(Number(n) || 0);
  return forms[k] ?? forms.other ?? forms.many ?? forms.one ?? '';
}
export function fmtNumber(n, opts) { try { return new Intl.NumberFormat(locale(), opts).format(n); } catch { return String(n); } }
export function fmtDate(d, opts = { dateStyle: 'medium' }) { try { return new Intl.DateTimeFormat(locale(), opts).format(d); } catch { return String(d); } }
export function fmtTime(d, opts = { hour: '2-digit', minute: '2-digit' }) { try { return new Intl.DateTimeFormat(locale(), opts).format(d); } catch { return String(d); } }
const COMPASS_LABELS = {
  de: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'],
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  es: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
  fr: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
  ru: ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'],
  zh: ['北', '东北', '东', '东南', '南', '西南', '西', '西北'],
};
/** Himmelsrichtung für 0/45/…/315 Grad in der aktiven Sprache (Kompassleisten im HUD). */
export function compass(deg) {
  const i = ((Math.round(deg / 45) % 8) + 8) % 8;
  return (COMPASS_LABELS[lang] || COMPASS_LABELS.de)[i];
}
export function fmtList(arr, opts = { type: 'conjunction' }) { try { return new Intl.ListFormat(locale(), opts).format(arr); } catch { return arr.join(', '); } }

/** Deutsche Zahl im Text („1.234“, „0,5“) in die Schreibweise der Zielsprache. Andere Zahlen bleiben. */
function localNum(s) {
  if (lang === 'de') return s;
  let v = null, frac = 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+(,\d+)?$/.test(s)) {
    const [i, f] = s.split(',');
    frac = f ? f.length : 0;
    v = Number(i.replace(/\./g, '') + (f ? '.' + f : ''));
  }
  if (v == null || !Number.isFinite(v)) return s;
  if (frac === 0 && v < 10000 && !s.includes('.')) return s; // Jahreszahlen, Ids, kleine Zahlen unverändert
  return fmtNumber(v, { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

function fill(str, params) {
  if (!params || typeof str !== 'string' || str.indexOf('{') < 0) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => {
    if (!(k in params)) return m;
    const v = params[k];
    return typeof v === 'number' ? fmtNumber(v) : String(v);
  });
}

function pickN(params) {
  if (!params) return 0;
  if (typeof params.n === 'number') return params.n;
  if (typeof params.count === 'number') return params.count;
  for (const v of Object.values(params)) if (typeof v === 'number') return v;
  return 0;
}

/**
 * Text zum Schlüssel. key = deutscher Text oder semantischer Schlüssel (i18n/de.js). params ersetzen {name}/{0}.
 */
export function t(key, params) {
  let v = CAT ? CAT[key] : undefined;
  if (v == null || v === '') v = DE[key];
  if (v == null || v === '') v = key;
  if (typeof v === 'object') v = plural(pickN(params), v);
  return fill(v, params);
}

/* ------------------------------------------------------------------ Nachschlagen deutscher Laufzeittexte */

const NUM_RE = /\d+(?:[.,]\d+)*/g;
let exact = null; // Map deutscher Text → Übersetzung
let numeric = null; // Map Schablone mit {#} → Übersetzung
let exactU = null, numericU = null; // dieselben Schlüssel in Großbuchstaben („KARTEN“, „AB STUFE 2“ auf der Startseite)
let patterns = null; // [{ re, keys, out, first }]
let cache = new Map();

function buildIndex() {
  exact = new Map(); numeric = new Map(); patterns = []; exactU = new Map(); numericU = new Map();
  cache = new Map();
  if (!CAT) return;
  for (const [k, v] of Object.entries(CAT)) {
    if (v == null || v === '') continue;
    if (/^[a-z][a-z0-9_]*\.[\w.]+$/.test(k)) { // semantischer Schlüssel: deutscher Text aus de.js
      const de = DE[k];
      if (typeof de === 'string' && de) addKey(de, v);
      continue;
    }
    addKey(k, v);
  }
  // Spezifischere Schablonen zuerst („Ziel {0} von {1}“ vor „Ziel {0}“)
  patterns.sort((x, y) => y.lit - x.lit);
}
function addKey(k, v) {
  if (k.includes('{#}')) { numeric.set(k, v); const u = k.toUpperCase(); if (!numericU.has(u)) numericU.set(u, v); return; }
  if (/\{\w+\}/.test(k)) {
    const keys = [];
    const src = k.split(/(\{\w+\})/).map((p) => {
      const m = /^\{(\w+)\}$/.exec(p);
      if (m) { keys.push(m[1]); return '(.+?)'; }
      return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    patterns.push({ re: new RegExp('^' + src + '$', 's'), reI: new RegExp('^' + src + '$', 'si'), keys, out: v, lit: k.replace(/\{\w+\}/g, '').length });
    return;
  }
  exact.set(k, v);
  const u = k.toUpperCase(); if (!exactU.has(u)) exactU.set(u, v);
}

function sub(out, params, n) {
  if (typeof out === 'object') out = plural(n, out);
  return out.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
}

function lookupCore(s, depth, caps = false) {
  let v = (caps ? exactU : exact).get(s);
  if (v !== undefined) return typeof v === 'object' ? plural(1, v) : v;
  // Textstück mit Trenner am Ende („Marsch/schneller ·“ zwischen zwei <kbd>): erst das Stück selbst
  const tm = depth < 2 ? /^(.*?\S)(\s*·)$/s.exec(s) : null;
  if (tm) { const r = lookup(tm[1], depth + 1); if (r != null) return r + tm[2]; }
  // Zahlen-Schablone: „Runde 3 von 10“ ↔ „Runde {#} von {#}“
  if (/\d/.test(s)) {
    const nums = [];
    const key = s.replace(NUM_RE, (m) => { nums.push(m); return '{#}'; });
    v = (caps ? numericU : numeric).get(key);
    if (v !== undefined) {
      const n0 = nums.length ? Number(nums[0].replace(/\./g, '').replace(',', '.')) : 0;
      let o = typeof v === 'object' ? plural(n0, v) : v;
      let i = 0;
      // {#} der Reihe nach; {#1}, {#2} … für umgestellte Reihenfolge
      o = o.replace(/\{#(\d?)\}/g, (m, d) => { const j = d ? Number(d) - 1 : i++; return nums[j] != null ? localNum(nums[j]) : ''; });
      return o;
    }
  }
  for (const p of patterns) {
    const m = (caps ? p.reI : p.re).exec(s);
    if (!m) continue;
    const params = {};
    let n = 0;
    p.keys.forEach((k, i) => {
      const raw = m[i + 1];
      if (!n && /^\d/.test(raw)) n = Number(raw.replace(/\./g, '').replace(',', '.')) || 0;
      const tr = depth < 2 && /\p{L}{2}/u.test(raw) ? lookup(raw, depth + 1) : null;
      params[k] = tr != null ? tr : (/^\d+(?:[.,]\d+)*$/.test(raw) ? localNum(raw) : raw);
    });
    return sub(p.out, params, n);
  }
  // Zusammengesetzt: „Hafen · Tag“, „A / B“
  // Komma-Listen nur in Platzhalter-Werten („große Karten ({0})“ mit {0} = „Hafen, Werk“)
  for (const sep of depth > 0 ? [' · ', ' | ', ' / ', ' – ', ', '] : [' · ', ' | ', ' / ', ' – ']) {
    if (s.includes(sep) && depth < 2) {
      const parts = s.split(sep);
      let any = false;
      const outp = parts.map((p) => { const r = lookup(p.trim(), depth + 1); if (r != null) { any = true; return r; } return p; });
      if (any) return outp.join(sep === ', ' && lang === 'zh' ? '、' : sep);
    }
  }
  // Trenner am Anfang („· Realistisch“, „– Verband (2)“, „(kein Platz)“)
  const lm = /^([·–—|,;+(]\s*|[.:]\s+)([\s\S]+)$/.exec(s);
  if (lm && depth < 2) {
    const close = lm[1].startsWith('(') && lm[2].endsWith(')');
    const r = lookup(close ? lm[2].slice(0, -1) : lm[2], depth + 1);
    const pre = lang === 'zh' && /^[.:]\s/.test(lm[1]) ? (lm[1][0] === '.' ? '。' : '：') : lm[1];
    if (r != null) return pre + r + (close ? ')' : '');
  }
  // Satzzeichen am Ende („Bereit:“, „Lädt …“)
  const pm = /^(.*?)(\s*[:：…!.?·]+)$/s.exec(s);
  if (pm && pm[1] && depth < 2) {
    const r = lookup(pm[1], depth + 1);
    if (r != null) return r + (lang === 'zh' ? pm[2].replace(':', '：').replace(/^\s+/, '') : (lang === 'fr' && /^[:!?]/.test(pm[2]) ? ' ' + pm[2] : pm[2]));
  }
  return null;
}

/** Übersetzung eines deutschen Texts oder null (nicht im Katalog). Ränder (Leerraum) bleiben erhalten. */
function lookup(s, depth = 0) {
  if (!CAT || !s) return null;
  const c = cache.get(s);
  if (c !== undefined) return c;
  let r = null;
  if (/\p{L}{2}/u.test(s)) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    const core = m[2];
    let out = core ? lookupCore(core, depth) : null;
    // Quelltext-Umbrüche in HTML-Vorlagen („…ein kleines\n    Experiment.“) wie Leerzeichen behandeln
    if (out == null && /\s{2,}|[\n\t]/.test(core)) out = lookupCore(core.replace(/\s+/g, ' '), depth);
    // Versalien („KARTEN“, „AB STUFE 2“, „STURM­GEWEHR“): gleiche Schlüssel ohne Groß-/Kleinschreibung, Ergebnis in Versalien
    if (out == null && core.length > 1 && core === core.toUpperCase() && core !== core.toLowerCase()) {
      const c = core.replace(/\u00ad/g, '').replace(/\s+/g, ' ');
      const r2 = lookupCore(c, depth, true);
      if (r2 != null) { try { out = r2.toLocaleUpperCase(locale()); } catch { out = r2.toUpperCase(); } }
    }
    if (out != null && out !== core) r = m[1] + out + m[3];
  }
  if (cache.size > 30000) cache.clear();
  cache.set(s, r);
  return r;
}

/** Deutschen Laufzeittext übersetzen (unverändert, wenn unbekannt oder Sprache Deutsch). */
export function tx(s, ctx) {
  if (!CAT || typeof s !== 'string') return s;
  // Kontext für mehrdeutige Wörter: Katalogschlüssel „ctx|Text“ (z. B. „trupp|Schütze“ → Rifleman statt Marksman)
  if (ctx) { const c = exact.get(ctx + '|' + s.trim()); if (c !== undefined) return typeof c === 'object' ? plural(1, c) : c; }
  const r = lookup(s);
  return r == null ? s : r;
}

/* ------------------------------------------------------------------ Seitenübersetzung */

const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'aria-description'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'svg', 'SVG', 'CODE', 'PRE', 'TEMPLATE']);
const textOrig = new WeakMap(); // Textknoten → { de, out }
const attrOrig = new WeakMap(); // Element → { [attr]: { de, out } }
let observer = null;

function skipEl(el) {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName) || e.isContentEditable) return true;
    if (e.hasAttribute('data-noi18n') || e.getAttribute('translate') === 'no') return true;
  }
  return false;
}

function doText(node) {
  const cur = node.nodeValue;
  if (!cur || cur.length > 2000) return;
  const rec = textOrig.get(node);
  let de = cur;
  if (rec && cur === rec.out) de = rec.de; // schon übersetzt (Sprachwechsel: vom Original aus)
  else if (rec && cur === rec.de) de = rec.de;
  const out = CAT ? lookup(de) : null;
  if (out == null) {
    if (rec && cur === rec.out) node.nodeValue = rec.de; // zurück auf Deutsch / unbekannt in neuer Sprache
    if (rec) textOrig.delete(node);
    return;
  }
  textOrig.set(node, { de, out });
  if (cur !== out) node.nodeValue = out;
}

function doAttrs(el) {
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const cur = el.getAttribute(a);
    let map = attrOrig.get(el);
    const rec = map && map[a];
    let de = cur;
    if (rec && (cur === rec.out || cur === rec.de)) de = rec.de;
    const out = CAT ? lookup(de) : null;
    if (out == null) {
      if (rec && cur === rec.out) el.setAttribute(a, rec.de);
      if (rec) delete map[a];
      continue;
    }
    if (!map) attrOrig.set(el, (map = {}));
    map[a] = { de, out };
    if (cur !== out) el.setAttribute(a, out);
  }
}

/** Teilbaum übersetzen (bzw. bei Deutsch auf die Originale zurücksetzen). */
export function translateDom(root = HAS_DOM ? document.documentElement : null) {
  if (!root) return;
  if (root.nodeType === 3) { if (!skipEl(root.parentElement)) doText(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1 && skipEl(root)) return;
  const walker = document.createTreeWalker(root, 5 /* ELEMENT | TEXT */, {
    acceptNode(n) {
      if (n.nodeType === 1) {
        if (SKIP_TAGS.has(n.tagName) || n.hasAttribute('data-noi18n') || n.getAttribute('translate') === 'no' || n.isContentEditable) return 2; // REJECT (ganzer Teilbaum)
        return 1;
      }
      return 1;
    },
  });
  if (root.nodeType === 1) doAttrs(root);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 3) doText(n); else doAttrs(n);
  }
}

function onMutations(list) {
  for (const m of list) {
    if (m.type === 'characterData') {
      const n = m.target;
      const rec = textOrig.get(n);
      if (rec && n.nodeValue === rec.out) continue; // eigene Änderung
      if (n.parentElement && !skipEl(n.parentElement)) doText(n);
    } else if (m.type === 'childList') {
      for (const n of m.addedNodes) {
        if (n.nodeType === 3) { if (n.parentElement && !skipEl(n.parentElement)) doText(n); } else if (n.nodeType === 1) translateDom(n);
      }
    } else if (m.type === 'attributes') {
      const el = m.target;
      const map = attrOrig.get(el);
      const rec = map && map[m.attributeName];
      if (rec && el.getAttribute(m.attributeName) === rec.out) continue;
      if (!skipEl(el)) doAttrs(el);
    }
  }
}

function startObserver() {
  if (!HAS_DOM || observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver(onMutations);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
function stopObserver() { if (observer) { observer.disconnect(); observer = null; } }

/* ------------------------------------------------------------------ Canvas, Sprachausgabe */

let canvasPatched = false;
function patchCanvas() {
  if (canvasPatched || typeof CanvasRenderingContext2D === 'undefined') return;
  canvasPatched = true;
  const P = CanvasRenderingContext2D.prototype;
  for (const fn of ['fillText', 'strokeText', 'measureText']) {
    const orig = P[fn];
    if (typeof orig !== 'function') continue;
    P[fn] = function (text, ...rest) {
      if (CAT && typeof text === 'string' && text.length > 1) { const r = lookup(text); if (r != null) text = r; }
      return orig.call(this, text, ...rest);
    };
  }
}

/** Stimmen der Sprache (speechSynthesis), sortiert: lokale Stimmen zuerst. */
function voicesOf(id) {
  try {
    const S = window.speechSynthesis;
    const all = S && S.getVoices ? S.getVoices() : [];
    const tag = (LANGUAGES.find((l) => l.id === id) || LANGUAGES[0]).locale.toLowerCase();
    const base = tag.split('-')[0];
    let vs = all.filter((v) => String(v.lang || '').toLowerCase().replace('_', '-').startsWith(base));
    if (id === 'zh') { const cn = vs.filter((v) => /cn|hans/i.test(v.lang)); if (cn.length) vs = cn; }
    return vs;
  } catch { return []; }
}
/** Stimme für die gewählte Sprache (seed: z. B. Sprechername, für wechselnde Stimmen) oder null. */
export function voiceFor(seed = '') {
  const vs = voicesOf(lang);
  if (!vs.length) return null;
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return vs[h % vs.length];
}

let speechPatched = false;
function patchSpeech() {
  if (speechPatched || typeof window === 'undefined' || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === 'undefined') return;
  speechPatched = true;
  const S = window.speechSynthesis;
  const origSpeak = S.speak.bind(S);
  const origGet = S.getVoices ? S.getVoices.bind(S) : () => [];
  // Deutscher Text und deutsche Stimme aus älterem Code → Zielsprache (Text übersetzt, Stimme der Sprache oder stumm)
  try {
    S.getVoices = function () {
      const all = origGet();
      if (lang === 'de') return all;
      // Code filtert oft nach /^de/: deutsche Stimmen ausblenden, damit nie Deutsch über fremdsprachigen Text spricht
      return all.filter((v) => !/^de/i.test(String(v.lang || '')));
    };
  } catch { /* schreibgeschützt */ }
  S.speak = function (u) {
    try {
      if (lang !== 'de' && u) {
        if (typeof u.text === 'string') u.text = tx(u.text);
        const v = u.voice && !/^de/i.test(String(u.voice.lang || '')) && voicesOf(lang).includes(u.voice) ? u.voice : voiceFor(u.text.length);
        if (!v) return; // keine Stimme der Sprache → nur Untertitel
        u.voice = v;
        u.lang = v.lang || locale();
      }
    } catch { /* */ }
    return origSpeak(u);
  };
}

/* ------------------------------------------------------------------ Anwenden */

function applyDocument() {
  if (!HAS_DOM) return;
  const L = LANGUAGES.find((l) => l.id === lang) || LANGUAGES[0];
  document.documentElement.lang = L.id === 'zh' ? 'zh-CN' : L.id;
  document.documentElement.dataset.lang = L.id;
  if (CAT) { startObserver(); patchCanvas(); patchSpeech(); }
  else stopObserver();
  translateDom(document.documentElement);
  // Titel
  try {
    const tEl = document.querySelector('title');
    if (tEl && tEl.firstChild) doText(tEl.firstChild);
  } catch { /* */ }
}

async function apply(id) {
  const c = await loadCatalog(id);
  lang = c || id === 'de' ? id : 'de';
  CAT = lang === 'de' ? null : c;
  buildIndex();
  try { setKeyLabelLanguage(lang); } catch { /* */ }
  if (HAS_DOM) {
    if (document.body) applyDocument();
    else document.addEventListener('DOMContentLoaded', applyDocument, { once: true });
  }
  for (const fn of [...listeners]) { try { fn(lang); } catch (err) { console.error('[NULLPUNKT] i18n.onChange:', err); } }
  return lang;
}

/** Sprache wählen ('auto' = Browser) – wird gespeichert. */
export async function setLanguage(choice) {
  const v = choice === 'auto' || IDS.includes(choice) ? choice : 'auto';
  if (settings.get('language') !== v) settings.set('language', v); // löst über onChange unten apply() aus
  else await apply(resolve(v));
  return pending || lang;
}

let pending = null;
settings.onChange((key, value) => {
  if (key !== 'language') return;
  const id = urlLanguage() || resolve(value);
  if (id === lang && (id === 'de' || CAT)) return;
  pending = apply(id).finally(() => { pending = null; });
});

export const ready = apply(urlLanguage() || resolve(settings.get('language')));
// Layout-Karte des Browsers (Chromium) für richtige Tastennamen auf jeder Tastatur (QWERTZ/QWERTY/AZERTY …)
loadKeyboardLayout().then((m) => { if (m) setKeyLabelLanguage(lang, m); }).catch(() => {});
await ready;
