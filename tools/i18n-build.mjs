#!/usr/bin/env node
// NULLPUNKT — Sprachkataloge erzeugen: tools/i18n/*.mjs (Übersetzungstabellen) → assets/js/shared/i18n/<sprache>.js
//
// Tabellenformat (je Bereich eine Datei, export default [...]):
//   ['Deutscher Text', 'English', 'Español', 'Français', 'Русский', '简体中文']      Schlüssel = deutscher Text
//   { key: 'site.hero.title', de: '…', en: '…', es: '…', fr: '…', ru: '…', zh: '…' } semantischer Schlüssel
// Platzhalter: {name} bzw. {0} (benannte Teile, auch zur Laufzeit erkannt) und {#} (jede Zahl, der Reihe nach; {#2} = zweite).
// Plural: statt Text ein Objekt { one, few, many, other } (Formen der Zielsprache, Intl.PluralRules).
// Leere Zelle (null/'') = noch nicht übersetzt → Deutsch erscheint (i18n-check meldet es).
//
// Aufruf: node tools/i18n-build.mjs        (schreibt die Kataloge; meldet doppelte Schlüssel mit abweichender Übersetzung)

import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'tools', 'i18n');
const OUT = join(ROOT, 'assets', 'js', 'shared', 'i18n');
export const LANGS = ['en', 'es', 'fr', 'ru', 'zh'];

/** Alle Tabellen laden → { de: {semKey: text}, en: {...}, ..., rows: [{ file, key, de, vals }] } */
export async function loadTables() {
  const files = readdirSync(SRC).filter((f) => f.endsWith('.mjs')).sort();
  const cat = { de: {} };
  for (const l of LANGS) cat[l] = {};
  const rows = [];
  const warnings = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(join(SRC, f)).href);
    const list = mod.default || [];
    for (const r of list) {
      let key, de, vals;
      if (Array.isArray(r)) { key = r[0]; de = r[0]; vals = r.slice(1); }
      else if (r && typeof r === 'object' && r.key) { key = r.key; de = r.de; vals = LANGS.map((l) => r[l]); cat.de[key] = de; }
      else { warnings.push(`${f}: ungültige Zeile ${JSON.stringify(r).slice(0, 80)}`); continue; }
      if (typeof key !== 'string' || !key) { warnings.push(`${f}: leerer Schlüssel`); continue; }
      rows.push({ file: f, key, de, vals });
      LANGS.forEach((l, i) => {
        const v = vals[i];
        if (v == null || v === '') return;
        const prev = cat[l][key];
        if (prev != null && JSON.stringify(prev) !== JSON.stringify(v)) warnings.push(`${f}: „${key.slice(0, 60)}“ (${l}) doppelt mit anderer Übersetzung – erste gilt`);
        if (prev == null) cat[l][key] = v;
      });
    }
  }
  return { cat, rows, warnings, files };
}

function serialize(obj, header) {
  const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const body = keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(obj[k])}`).join(',\n');
  return `${header}\nexport default {\n${body}${keys.length ? ',' : ''}\n};\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { cat, rows, warnings } = await loadTables();
  const head = (l) => `// NULLPUNKT — Sprachkatalog „${l}“ (shared/i18n.js). ERZEUGT von tools/i18n-build.mjs aus tools/i18n/*.mjs – nicht von Hand ändern.`;
  writeFileSync(join(OUT, 'de.js'), serialize(cat.de, `// NULLPUNKT — Deutsche Texte zu semantischen Schlüsseln (shared/i18n.js). Texte, deren Schlüssel der deutsche Text selbst ist,\n// stehen nicht hier (sie sind ihr eigener Schlüssel). ERZEUGT von tools/i18n-build.mjs aus tools/i18n/*.mjs.`));
  for (const l of LANGS) writeFileSync(join(OUT, `${l}.js`), serialize(cat[l], head(l)));
  for (const w of warnings) console.warn('Warnung:', w);
  console.log(`${rows.length} Zeilen → ${LANGS.map((l) => `${l}: ${Object.keys(cat[l]).length}`).join(', ')}`);
}
