/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// Spielmenü (21.11.): Sprache und Texte des Menüs. Brücke zur Übersetzungs-API (shared/i18n.js: t(), tx(), setLanguage(),
// getLanguage(), onChange()); main.js lädt sie und meldet sie hier an. Die Sprache speichert i18n.js in den
// Einstellungen ('language'); die Seite übersetzt es selbst (MutationObserver). Texte, die das Menü per Skript setzt,
// stehen in strings.de.js: zuerst der Katalogschlüssel 'site.<schlüssel>', sonst tx(deutscher Text), sonst Deutsch.
import { STRINGS, LANGS } from './strings.de.js?v=20261123115551';

const CODES = new Set(LANGS.map(([c]) => c));
let api = null;
let pending = null; // Wahl vor dem Laden der API
const fns = new Set();
const notify = (code) => { for (const fn of [...fns]) { try { fn(code); } catch { /* */ } } };

// Himmelsrichtungen im Körperkamera-Kompass (N/O/S/W) in der gewählten Sprache (Einzelbuchstaben übersetzt der Katalog nicht)
const DEG = { N: 0, O: 90, S: 180, W: 270 };
function compassStrip() {
  if (!api?.compass) return;
  for (const s of document.querySelectorAll('.cam-strip span')) {
    const d = s.dataset.deg ?? DEG[s.textContent.trim()];
    if (d == null) continue;
    s.dataset.deg = d;
    s.textContent = api.compass(+d);
  }
}
fns.add(compassStrip);

/** Übersetzungs-API anschließen (main.js, nach dem Laden von shared/i18n.js). */
export function attachI18n(mod) {
  if (!mod || typeof mod.t !== 'function') return;
  api = mod;
  try { api.onChange?.((code) => notify(code || getLang())); } catch { /* */ }
  if (pending) { const p = pending; pending = null; setLang(p); }
  notify(getLang());
}

export const hasTranslations = () => !!api;
export { LANGS };

function tr(s) {
  if (!api?.tx || getLang() === 'de') return s;
  try { return Array.isArray(s) ? s.map((x) => api.tx(x)) : api.tx(s); } catch { return s; }
}

/** Text zu einem Schlüssel; {name}-Platzhalter werden ersetzt. Listen (z. B. 'tips') kommen als Array zurück. */
export function t(key, vars) {
  let s;
  if (api) {
    try {
      const r = api.t(`site.${key}`, vars);
      if (r != null && r !== `site.${key}`) s = r;
    } catch { /* */ }
  }
  if (s == null) s = tr(STRINGS[key] ?? key);
  if (typeof s === 'string' && vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return s;
}

export function getLang() {
  try { if (api?.getLanguage) return api.getLanguage() || 'de'; } catch { /* */ }
  return pending || 'de';
}

export async function setLang(code) {
  if (!CODES.has(code)) return false;
  if (!api?.setLanguage) { pending = code; notify(code); return true; }
  try { await api.setLanguage(code); } catch { /* */ }
  notify(code);
  return true;
}

export function onLang(fn) { fns.add(fn); return () => fns.delete(fn); }
