#!/usr/bin/env node
// NULLPUNKT — Sprachkataloge prüfen (shared/i18n.js, Tabellen tools/i18n/*.mjs, Kataloge assets/js/shared/i18n/*.js).
//
//   node tools/i18n-check.mjs                Übersicht je Sprache: Schlüssel, fehlend (leere Zellen), überzählig (im Katalog,
//                                            aber in keiner Tabelle = veraltet → i18n-build laufen lassen), Platzhalter-Fehler
//   node tools/i18n-check.mjs -v             dazu die fehlenden/fehlerhaften Schlüssel einzeln
//   node tools/i18n-check.mjs --scan [Pfade] deutsche Texte im Quelltext suchen, die in keinem Katalog stehen (Abdeckung je Datei;
//                                            Standard: Spiel-Oberfläche, Daten, Kampagne, Isim, Modi). Mit -v die Texte selbst.
// Rückgabewert 1, wenn Platzhalter falsch sind oder Kataloge veraltet sind.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadTables, LANGS } from './i18n-build.mjs';

const ROOT = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const VERBOSE = args.includes('-v');
const { cat, rows, warnings } = await loadTables();
let bad = 0;

function holes(s) {
  if (s == null) return '';
  if (typeof s === 'object') s = s.other ?? Object.values(s)[0] ?? '';
  const named = (s.match(/\{[A-Za-z_]\w*\}|\{\d+\}/g) || []).sort().join('');
  const nums = (s.match(/\{#\d?\}/g) || []).length;
  return named + '#' + nums;
}

if (!args.includes('--scan')) {
  for (const w of warnings) console.log('Warnung:', w);
  console.log(`Tabellen: ${rows.length} Zeilen, ${new Set(rows.map((r) => r.key)).size} Schlüssel\n`);
  console.log('Sprache  Schlüssel  fehlend  überzählig  Platzhalter');
  for (const [i, l] of LANGS.entries()) {
    const missing = [], ph = [];
    const seen = new Set();
    for (const r of rows) {
      if (seen.has(r.key)) continue;
      seen.add(r.key);
      const v = r.vals[i];
      if (v == null || v === '') { missing.push(r.key); continue; }
      // Platzhalter: {#}-Anzahl und benannte Platzhalter müssen zum Deutschen passen ({#2} zählt als {#})
      const a = holes(r.de), b = holes(typeof v === 'object' ? (v.other ?? v.many ?? v.one) : v);
      if (a !== b) ph.push(`${r.key} → ${JSON.stringify(v).slice(0, 80)}`);
    }
    let extra = [];
    const file = join(ROOT, 'assets/js/shared/i18n', `${l}.js`);
    if (existsSync(file)) {
      const gen = (await import(pathToFileURL(file).href + '?t=' + Date.now())).default || {};
      extra = Object.keys(gen).filter((k) => !(k in cat[l]));
      const stale = Object.keys(cat[l]).filter((k) => JSON.stringify(gen[k]) !== JSON.stringify(cat[l][k]));
      if (stale.length) { console.log(`  ${l}: ${stale.length} Einträge nicht erzeugt/veraltet → node tools/i18n-build.mjs`); bad = 1; }
    }
    if (ph.length) bad = 1;
    console.log(`${l.padEnd(8)} ${String(seen.size - missing.length).padStart(9)}  ${String(missing.length).padStart(7)}  ${String(extra.length).padStart(10)}  ${String(ph.length).padStart(11)}`);
    if (VERBOSE) {
      for (const k of missing) console.log(`   fehlt   ${k.slice(0, 100)}`);
      for (const k of extra) console.log(`   übrig   ${k.slice(0, 100)}`);
      for (const k of ph) console.log(`   {…}     ${k}`);
    }
  }
  process.exit(bad);
}

/* ------------------------------------------------------------------ --scan: Abdeckung im Quelltext */

const DEF = ['assets/js/game/ui', 'assets/js/shared', 'assets/js/game/campaign', 'assets/js/game/isim', 'assets/js/game/modes', 'spielen.html'];
const paths = args.filter((a) => !a.startsWith('-'));
const targets = paths.length ? paths : DEF;
const SKIP = /i18n|body-mesh|glove-mesh|\.worker\.js$/;
const files = [];
function walk(p) {
  const abs = join(ROOT, p);
  if (!existsSync(abs)) return;
  if (statSync(abs).isDirectory()) { for (const f of readdirSync(abs)) walk(join(p, f)); return; }
  if (/\.(m?js|html)$/.test(p) && !SKIP.test(p)) files.push(abs);
}
targets.forEach(walk);

const known = new Set();
for (const r of rows) { known.add(r.key); if (/\{\w+\}/.test(r.key)) known.add(r.key.replace(/\{#?\w*\}/g, "{#}")); }
const DE_HINT = /[äöüÄÖÜß]|\b(der|die|das|und|nicht|mit|für|auf|ist|ein|eine|zu|von|im|den|dem|des|bei|aus|oder|wird|kein|keine|nach|über|Spieler|Karte|Modus|Waffe|Ziel|Feind|Runde|Zurück|Einsatz|Sekunden|Abschuss|Treffer|Taste)\b/;
/** Deutscher Anzeigetext? (grob: Wörter mit Großbuchstaben/Umlaut, keine Ids/CSS/Pfade) */
function isText(s) {
  s = s.trim();
  if (s.length < 3 || !/\p{L}{3}/u.test(s)) return false;
  if (/^[\w\-./:#?=&%@]+$/.test(s) && !/[A-ZÄÖÜ][a-zäöüß]{2}/.test(s)) return false;
  if (/^(rgba?|hsla?|url|translate|var|calc)\(/.test(s) || /[{};]\s*$/.test(s)) return false;
  if (/^\[[^\]]+\]$/.test(s) || /^\.[a-z]/.test(s)) return false;
  return DE_HINT.test(s) || /^[A-ZÄÖÜ][a-zäöüß]+(\s|$)/.test(s);
}
/** Text in Bausteine zerlegen: HTML-Tags und ${…} trennen → Textknoten-Kandidaten */
function pieces(lit) {
  return lit.replace(/<[^>]*>/g, '\u0001').replace(/\$\{[^}]*\}/g, '{#}').split('\u0001').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
function strings(src) {
  const out = [];
  const re = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g; // einfache Literale (Vorlagen ohne Zeilenumbruch)
  let m;
  while ((m = re.exec(src))) out.push(m[2].replace(/\\(.)/g, '$1'));
  return out;
}
function isKnown(s) {
  if (known.has(s)) return true;
  const n = s.replace(/\d+(?:[.,]\d+)*/g, '{#}');
  if (known.has(n)) return true;
  const core = s.replace(/[\s:：…!.?]+$/, '');
  if (core !== s && (known.has(core) || known.has(core.replace(/\d+(?:[.,]\d+)*/g, '{#}')))) return true;
  if (s.includes(' · ') && s.split(' · ').every((p) => isKnown(p.trim()))) return true;
  return false;
}
let tot = 0, totKnown = 0;
const report = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const cand = new Set();
  const lits = f.endsWith('.html') ? src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').split(/<[^>]*>/) : strings(src).flatMap(pieces);
  for (const s0 of lits) {
    const s = s0.replace(/\s+/g, ' ').trim();
    if (s.includes('console.') || /^\[[A-Za-z]/.test(s)) continue;
    if (isText(s)) cand.add(s);
  }
  if (!cand.size) continue;
  const miss = [...cand].filter((s) => !isKnown(s));
  tot += cand.size; totKnown += cand.size - miss.length;
  report.push({ f: relative(ROOT, f), n: cand.size, miss });
}
report.sort((a, b) => b.miss.length - a.miss.length);
console.log('fehlend / Kandidaten  Datei');
for (const r of report) {
  if (!r.miss.length && !VERBOSE) continue;
  console.log(`${String(r.miss.length).padStart(7)} / ${String(r.n).padEnd(10)}  ${r.f}`);
  if (VERBOSE) for (const s of r.miss) console.log('          · ' + s.slice(0, 140));
}
console.log(`\nAbdeckung (grob, Kandidaten aus dem Quelltext): ${totKnown}/${tot} = ${tot ? Math.round((100 * totKnown) / tot) : 0} %`);
