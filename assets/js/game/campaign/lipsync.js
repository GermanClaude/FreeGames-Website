// NULLPUNKT — Kampagne: Lippensynchronität ohne Sprachausgabe (Text → Laute → Viseme mit Zeitachse).
//
// Die Dialoge laufen als Untertitel; die Figuren bewegen dazu den Mund. textToVisemes(text, { cps }) zerlegt den deutschen
// Satz mit Graphem-Regeln (längste Folge zuerst: tsch/sch/ch/chs/ck/qu/pf/ph/tz/ng/nk, ie/ei/ai/au/eu/äu, Dehnungs-h,
// Doppelvokale, ä/ö/ü/ß, sp/st am Wortanfang, Auslaut-e/-en) in Laute und verteilt sie nach Lesegeschwindigkeit auf eine
// Zeitachse: Vokale länger als Konsonanten, lange Vokale/Doppellaute länger als kurze, Pausen an Satzzeichen
// (Komma kurz, Punkt/Ausrufe-/Fragezeichen lang, Gedankenstrich/Auslassung mittel), kleine Lücke zwischen Wörtern.
//
// Visemsatz (wie die verbreiteten 15 Mundbilder): sil PP FF TH DD kk CH SS nn RR aa E I O U.
// Jedes Visem hat eine Mundform { open (Kiefer), wide (Breite), round (Rundung), press (Lippen zu), teeth (Zähne sichtbar) },
// sampleMouth(track, t, out) mischt benachbarte Laute weich (Koartikulation) – die Gesichts-Schicht (face.js) setzt
// daraus entweder das Visem der Gesichts-API (bots/soldier, sobald vorhanden) oder die eigene Kiefer-/Mundbewegung.
//
// Reine Funktionen, kein DOM, kein three.js – auch in Node prüfbar.

export const VISEMES = Object.freeze(['sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U']);

/** Mundform je Visem (0…1). */
export const VISEME_SHAPES = Object.freeze({
  sil: { open: 0.0, wide: 0.3, round: 0.0, press: 0.35, teeth: 0 },
  PP: { open: 0.0, wide: 0.3, round: 0.12, press: 1, teeth: 0 },
  FF: { open: 0.1, wide: 0.42, round: 0.0, press: 0.2, teeth: 1 },
  TH: { open: 0.2, wide: 0.42, round: 0.0, press: 0, teeth: 0.7 },
  DD: { open: 0.24, wide: 0.45, round: 0.05, press: 0, teeth: 0.45 },
  kk: { open: 0.34, wide: 0.4, round: 0.05, press: 0, teeth: 0.2 },
  CH: { open: 0.2, wide: 0.12, round: 0.8, press: 0, teeth: 0.6 },
  SS: { open: 0.1, wide: 0.62, round: 0.0, press: 0, teeth: 1 },
  nn: { open: 0.18, wide: 0.42, round: 0.05, press: 0, teeth: 0.3 },
  RR: { open: 0.3, wide: 0.3, round: 0.3, press: 0, teeth: 0.2 },
  aa: { open: 1.0, wide: 0.55, round: 0.0, press: 0, teeth: 0.15 },
  E: { open: 0.55, wide: 0.78, round: 0.0, press: 0, teeth: 0.4 },
  I: { open: 0.28, wide: 1.0, round: 0.0, press: 0, teeth: 0.6 },
  O: { open: 0.62, wide: 0.12, round: 0.85, press: 0, teeth: 0 },
  U: { open: 0.3, wide: 0.0, round: 1.0, press: 0, teeth: 0 },
});

// Laut-Gewichte (relative Dauer): kurze Vokale 1, lange 1,7, Doppellaute 1,9; Verschlusslaute kurz, Reibelaute mittel
const W = { vShort: 1.0, vLong: 1.7, diph: 1.9, plosive: 0.62, fric: 0.85, nasal: 0.7, liquid: 0.66, glide: 0.55, breath: 0.5, schwa: 0.7 };
// Pausen an Satzzeichen (s)
const PAUSE = { ',': 0.2, ';': 0.3, ':': 0.3, '.': 0.42, '!': 0.42, '?': 0.42, '…': 0.5, '–': 0.28, '—': 0.28, '-': 0, '(': 0.12, ')': 0.12, '"': 0, '„': 0, '“': 0, '»': 0, '«': 0 };
const WORD_GAP = 0.05;
export const DEFAULT_CPS = 14; // Buchstaben je Sekunde (≈ 140 Wörter/min) – Lesetempo „Normal“
export const READING_SPEEDS = Object.freeze({ langsam: 11, normal: 14, schnell: 18 });

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'ä', 'ö', 'ü', 'y']);
const isLetter = (c) => /[a-zäöüß]/.test(c);

// Zahlen bis 20 ausschreiben (kommen in Funksprüchen vor: „Trupp 2“, „3 Minuten“)
const NUM = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig'];

/** Text normalisieren: klein, Zahlen ≤ 20 als Wort, übrige Ziffern einzeln. */
// Andere Sprachen (shared/i18n.js übersetzt die Zeilen vor dem Sprechen): Kyrillisch wird in deutsche Schreibweise
// umgeschrieben, chinesische Schriftzeichen werden zu je einer Silbe (Konsonant + Vokal aus dem Zeichencode), Akzente
// (é, à, ñ, ç …) fallen weg – so laufen dieselben Graphem-Regeln, Mund und Lesedauer passen ungefähr.
const CYR = { а: 'a', б: 'b', в: 'w', г: 'g', д: 'd', е: 'e', ё: 'jo', ж: 'sch', з: 's', и: 'i', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'ch', ц: 'z', ч: 'tsch', ш: 'sch', щ: 'schtsch', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'ju', я: 'ja', і: 'i', ї: 'ji', є: 'je' };
const CJK_P = { '，': ',', '。': '.', '！': '!', '？': '?', '：': ':', '；': ';', '、': ',', '（': '(', '）': ')', '“': '„', '”': '“', '……': '…', '——': '–' };
const CJK_C = ['b', 'd', 'g', 'm', 'n', 'l', 'h', 's', 'sch', 'z', 'k', 't', 'w', 'j', 'f', 'p'];
const CJK_V = ['a', 'e', 'i', 'o', 'u', 'ai', 'ao', 'en', 'an', 'ang'];
export function romanize(text) {
  let s = String(text || '');
  if (/[\u0400-\u04ff]/.test(s)) s = s.replace(/[\u0400-\u04ff]/g, (ch) => { const lo = ch.toLowerCase(); const r = CYR[lo]; return r == null ? ch : (ch !== lo ? r.charAt(0).toUpperCase() + r.slice(1) : r); });
  if (/[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/.test(s)) {
    s = s.replace(/……|——|[，。！？：；、（）“”]/g, (m) => CJK_P[m] || m);
    s = s.replace(/[\u3400-\u9fff]/g, (ch) => { const c = ch.charCodeAt(0); return ` ${CJK_C[c % CJK_C.length]}${CJK_V[(c >> 4) % CJK_V.length]} `; });
  }
  if (/[^\u0000-\u007f äöüÄÖÜß]/.test(s)) s = s.normalize('NFD').replace(/([^aouAOU])[\u0300-\u036f]+/g, '$1').replace(/[\u0300-\u036f]/g, '').normalize('NFC');
  return s;
}

export function normalize(text) {
  return romanize(text)
    .replace(/\.\.\./g, '…')
    .replace(/\d+/g, (d) => { const n = Number(d); return n <= 20 ? NUM[n] : d.split('').map((x) => NUM[Number(x)]).join(' '); })
    .toLowerCase();
}

/**
 * Ein Wort (nur Buchstaben) → Laute [{ v, w, k }] (k: 'v' Vokal, 'd' Doppellaut-Teil, 'c' Konsonant).
 * Regeln in Reihenfolge: Mehrbuchstaben-Folgen vor Einzelbuchstaben.
 */
export function wordToPhones(word) {
  const out = [];
  const w = word;
  const n = w.length;
  const push = (v, wt, k = 'c') => out.push({ v, w: wt, k });
  let i = 0;
  while (i < n) {
    const c = w[i];
    const rest = w.slice(i);
    const prev = i > 0 ? w[i - 1] : '';
    const start = i === 0;
    // --- Konsonantenfolgen
    if (rest.startsWith('tsch')) { push('CH', W.fric * 1.2); i += 4; continue; }
    if (rest.startsWith('sch')) { push('CH', W.fric); i += 3; continue; }
    if (rest.startsWith('chs')) { push('kk', W.fric * 0.7); push('SS', W.fric); i += 3; continue; }
    if (rest.startsWith('ch')) {
      // ach-Laut nach a/o/u/au (hinten, offener), sonst ich-Laut (breit, Zähne)
      const back = /[aou]$/.test(prev) || (i >= 2 && w.slice(i - 2, i) === 'au');
      push(back ? 'kk' : 'SS', W.fric);
      i += 2; continue;
    }
    if (start && (rest.startsWith('sp') || rest.startsWith('st'))) { push('CH', W.fric); i += 1; continue; } // „schp“, „scht“
    if (rest.startsWith('ck')) { push('kk', W.plosive); i += 2; continue; }
    if (rest.startsWith('qu')) { push('kk', W.plosive); push('FF', W.fric * 0.7); i += 2; continue; }
    if (rest.startsWith('pf')) { push('PP', W.plosive * 0.8); push('FF', W.fric); i += 2; continue; }
    if (rest.startsWith('ph')) { push('FF', W.fric); i += 2; continue; }
    if (rest.startsWith('th')) { push('DD', W.plosive); i += 2; continue; }
    if (rest.startsWith('tz')) { push('DD', W.plosive * 0.7); push('SS', W.fric); i += 2; continue; }
    if (rest.startsWith('ng')) { push('nn', W.nasal * 1.1); i += 2; continue; }
    if (rest.startsWith('nk')) { push('nn', W.nasal); push('kk', W.plosive); i += 2; continue; }
    // --- Vokalfolgen
    if (rest.startsWith('ie')) { push('I', W.vLong, 'v'); i += 2; if (w[i] === 'h') i++; continue; }
    if (/^(ei|ai|ey|ay)/.test(rest)) { push('aa', W.diph * 0.55, 'd'); push('I', W.diph * 0.45, 'd'); i += 2; continue; }
    if (rest.startsWith('au')) { push('aa', W.diph * 0.55, 'd'); push('U', W.diph * 0.45, 'd'); i += 2; continue; }
    if (rest.startsWith('eu') || rest.startsWith('äu')) { push('O', W.diph * 0.55, 'd'); push('I', W.diph * 0.45, 'd'); i += 2; continue; }
    if (VOWELS.has(c)) {
      const v = c === 'a' ? 'aa' : c === 'e' || c === 'ä' ? 'E' : c === 'i' ? 'I' : c === 'o' || c === 'ö' ? 'O' : 'U';
      const next = w[i + 1];
      // lang: Doppelvokal (aa/ee/oo) oder Dehnungs-h vor Konsonant/Wortende
      if (next === c) { push(v, W.vLong, 'v'); i += 2; continue; }
      if (next === 'h' && (i + 2 >= n || !VOWELS.has(w[i + 2]))) { push(v, W.vLong, 'v'); i += 2; continue; }
      // Auslaut „-e“ und Endung „-en/-el/-er“: unbetontes Schwa (kurz, halb offen)
      if (c === 'e' && i > 0 && (i === n - 1 || ((w[i + 1] === 'n' || w[i + 1] === 'l' || w[i + 1] === 'r') && i + 2 === n))) {
        push('E', W.schwa, 'v');
        if (w[i + 1] === 'r' && i + 2 === n) { out[out.length - 1].v = 'aa'; out[out.length - 1].w = W.schwa; i += 2; continue; } // „-er“ ≈ a
        i += 1; continue;
      }
      // ö/ü: gerundete Vorderzungenvokale
      if (c === 'ü' || c === 'y') { push('U', W.vShort, 'v'); i += 1; continue; }
      // offene Silbe (Vokal + ein Konsonant + Vokal) tendenziell lang
      const open = i + 2 < n && !VOWELS.has(next || '') && VOWELS.has(w[i + 2]);
      push(v, open ? W.vShort * 1.25 : W.vShort, 'v');
      i += 1; continue;
    }
    // --- Einzelkonsonanten (Doppelkonsonanten = einer)
    if (c === prev && !VOWELS.has(c)) { i += 1; continue; }
    switch (c) {
      case 'b': case 'p': push('PP', W.plosive); break;
      case 'm': push('PP', W.nasal); break;
      case 'f': case 'v': case 'w': push('FF', W.fric); break;
      case 'd': case 't': push('DD', W.plosive); break;
      case 'n': push('nn', W.nasal); break;
      case 'l': push('nn', W.liquid); break;
      case 'k': case 'g': case 'q': push('kk', W.plosive); break;
      case 'c': push(/[eiy]/.test(w[i + 1] || '') ? 'SS' : 'kk', W.plosive); break;
      case 's': case 'z': case 'ß': push('SS', W.fric); break;
      case 'x': push('kk', W.plosive * 0.7); push('SS', W.fric); break;
      case 'r': push('RR', W.liquid); break;
      case 'j': push('I', W.glide); break;
      case 'h': if (!VOWELS.has(prev)) push('kk', W.breath); break; // Hauch (Wortanfang/nach Konsonant); nach Vokal stumm
      default: break;
    }
    i += 1;
  }
  return out;
}

/**
 * Text → Zeitachse.
 * opts: cps (Buchstaben/s, Lesetempo), lead (s Vorlauf vor dem ersten Laut), intensity (0…1.3)
 * → { duration, segments: [{ t0, t1, v, w (Stärke 0…1.2), word }], words: [{ t0, t1, text }], pauses: [{ t0, t1, mark }] }
 */
export function textToVisemes(text, opts = {}) {
  const cps = Math.max(4, Math.min(40, Number(opts.cps) || DEFAULT_CPS));
  const lead = Number.isFinite(opts.lead) ? opts.lead : 0.08;
  const baseIntensity = Number.isFinite(opts.intensity) ? opts.intensity : 1;
  const norm = normalize(text);
  // Tokens: Wörter und Satzzeichen
  const tokens = norm.match(/[a-zäöüß]+|[.,;:!?…–—()"„“»«-]/g) || [];
  // Satzweise Betonung: Ausrufesätze kräftiger, Fragen leicht
  const items = [];
  let letters = 0;
  let sentence = [];
  const flush = (mark) => {
    const k = mark === '!' ? 1.15 : mark === '?' ? 1.02 : 1;
    for (const it of sentence) it.gain = k;
    sentence = [];
  };
  for (const t of tokens) {
    if (isLetter(t[0])) {
      const phones = wordToPhones(t);
      if (!phones.length) continue;
      letters += t.length;
      const it = { kind: 'word', text: t, phones, gain: 1 };
      items.push(it);
      sentence.push(it);
    } else {
      items.push({ kind: 'pause', mark: t, dur: PAUSE[t] ?? 0 });
      if (t === '.' || t === '!' || t === '?' || t === '…') flush(t);
    }
  }
  flush('.');
  let weightSum = 0;
  for (const it of items) if (it.kind === 'word') for (const p of it.phones) weightSum += p.w;
  // Sprechzeit = Buchstaben / Lesetempo, verteilt nach Lautgewicht
  const speech = letters / cps;
  const unit = weightSum > 0 ? speech / weightSum : 0;
  const segments = [];
  const words = [];
  const pauses = [];
  let t = lead;
  let lastWasWord = false;
  for (const it of items) {
    if (it.kind === 'pause') {
      if (it.dur > 0) { pauses.push({ t0: t, t1: t + it.dur, mark: it.mark }); t += it.dur; }
      lastWasWord = false;
      continue;
    }
    if (lastWasWord) t += WORD_GAP;
    const w0 = t;
    const ph = it.phones;
    for (let j = 0; j < ph.length; j++) {
      const p = ph[j];
      const d = Math.max(0.035, p.w * unit);
      // Betonung: erster Vokal eines Wortes etwas kräftiger, Schwa schwächer
      let s = baseIntensity * it.gain * (p.k === 'v' && j === ph.findIndex((q) => q.k !== 'c') ? 1.08 : 1);
      if (p.w === W.schwa) s *= 0.75;
      segments.push({ t0: t, t1: t + d, v: p.v, w: Math.min(1.25, s), word: words.length });
      t += d;
    }
    words.push({ t0: w0, t1: t, text: it.text });
    lastWasWord = true;
  }
  return { duration: t + 0.12, speech, cps, segments, words, pauses, text: String(text || '') };
}

/** Anzeigedauer eines Untertitels: Sprechzeit + Nachlauf (mind. 1,6 s). */
export function subtitleDuration(track, linger = 0.9) {
  return Math.max(1.6, (track ? track.duration : 0) + linger);
}

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Segment-Index zur Zeit t (binäre Suche); −1 vor dem ersten, segments.length nach dem letzten. */
function segIndex(segs, t) {
  if (!segs.length || t < segs[0].t0) return -1;
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid].t0 <= t) lo = mid; else hi = mid - 1;
  }
  return t > segs[lo].t1 + 0.0001 ? (lo === segs.length - 1 ? segs.length : lo + 0.5) : lo;
}

/**
 * Mundform zur Zeit t (Koartikulation: Übergang über ±45 ms an jeder Lautgrenze, Pausen öffnen zur Ruhe).
 * out: { open, wide, round, press, teeth, viseme, weight } → out
 */
export function sampleMouth(track, t, out = {}) {
  const segs = track && track.segments ? track.segments : [];
  const rest = VISEME_SHAPES.sil;
  const set = (s, k, v, w) => {
    out.open = s.open * k; out.wide = lerp(rest.wide, s.wide, k); out.round = s.round * k; out.press = s.press * k; out.teeth = s.teeth * k;
    out.viseme = v; out.weight = w;
    return out;
  };
  const i = segIndex(segs, t);
  if (i === -1 || i >= segs.length) return set(rest, 1, 'sil', 0);
  if (!Number.isInteger(i)) {
    // in einer Lücke (Wortgrenze oder Satzpause): kurz Richtung Ruhe
    const a = segs[Math.floor(i)], b = segs[Math.ceil(i)];
    const gap = b.t0 - a.t1;
    const x = gap > 0 ? (t - a.t1) / gap : 1;
    const toRest = gap > 0.15 ? 1 : 0.45; // Satzpause: ganz zu, Wortgrenze: halb
    const sa = VISEME_SHAPES[a.v], sb = VISEME_SHAPES[b.v];
    const k1 = smooth(Math.min(1, x * 2.2)) * toRest; // a → Ruhe
    const k2 = smooth(Math.max(0, (x - 0.55) / 0.45)); // Ruhe → b
    const mix = (key) => lerp(lerp(sa[key] * a.w, rest[key], k1), sb[key] * b.w, k2 * (gap > 0.15 ? 0.35 : 0.6));
    out.open = Math.max(0, mix('open')); out.wide = mix('wide'); out.round = mix('round'); out.press = mix('press'); out.teeth = mix('teeth');
    out.viseme = k2 > 0.5 ? b.v : k1 > 0.5 ? 'sil' : a.v; out.weight = k2 > 0.5 ? b.w * k2 : a.w * (1 - k1);
    return out;
  }
  const s = segs[i];
  const S = VISEME_SHAPES[s.v];
  const blend = Math.min(0.045, (s.t1 - s.t0) * 0.45);
  // Übergang vom vorigen / zum nächsten Laut (nur bei direktem Anschluss)
  const prev = i > 0 && segs[i - 1].t1 >= s.t0 - 0.001 ? segs[i - 1] : null;
  const next = i < segs.length - 1 && segs[i + 1].t0 <= s.t1 + 0.001 ? segs[i + 1] : null;
  let base = S, w = s.w, other = null, k = 0, ow = 0;
  if (prev && t < s.t0 + blend) { other = VISEME_SHAPES[prev.v]; ow = prev.w; k = 0.5 * (1 - smooth((t - s.t0) / blend)); }
  else if (next && t > s.t1 - blend) { other = VISEME_SHAPES[next.v]; ow = next.w; k = 0.5 * smooth((t - (s.t1 - blend)) / blend); }
  const v = (key) => {
    const a = base[key] * (key === 'wide' ? 1 : w);
    return other ? lerp(a, other[key] * (key === 'wide' ? 1 : ow), k) : a;
  };
  out.open = v('open'); out.wide = v('wide'); out.round = v('round'); out.press = v('press'); out.teeth = v('teeth');
  // Verschlusslaute: Lippen ganz zu (Kraft unabhängig von der Betonung)
  if (s.v === 'PP' && !other) { out.press = 1; out.open = 0; }
  out.viseme = s.v; out.weight = w;
  return out;
}

/** Gerade gesprochenes Wort (für Hervorhebung im Untertitel) – Index oder −1. */
export function wordAt(track, t) {
  const ws = track && track.words ? track.words : [];
  for (let i = 0; i < ws.length; i++) if (t >= ws[i].t0 && t <= ws[i].t1 + 0.04) return i;
  return -1;
}

/**
 * Mimik je Satz: ausdrücklich (line.expr) oder aus der Zeichensetzung – „!“ angespannt, „?“ fragend, „…“ nachdenklich.
 * Ausdrücke: neutral | ernst | angespannt | fragend | nachdenklich | erleichtert | traurig | entschlossen
 */
export const EXPRESSIONS = Object.freeze(['neutral', 'ernst', 'angespannt', 'fragend', 'nachdenklich', 'erleichtert', 'traurig', 'entschlossen']);
export function expressionFor(text, explicit = null) {
  if (explicit && EXPRESSIONS.includes(explicit)) return explicit;
  const s = String(text || '').trim();
  if (/!\s*$/.test(s)) return 'angespannt';
  if (/\?\s*$/.test(s)) return 'fragend';
  if (/(…|\.\.\.)\s*$/.test(s)) return 'nachdenklich';
  return 'ernst';
}
