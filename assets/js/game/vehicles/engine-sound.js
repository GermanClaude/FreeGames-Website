// NULLPUNKT — Fahrzeug-Klangquellen (Owner: audio): Schleifen-Puffer für Motoren, Ketten, Rotoren und Strahltriebwerke,
// rein rechnerisch (Float32Array, kein WebAudio) – vehicles/audio.js legt daraus AudioBuffer an und spielt sie mit
// playbackRate nach Drehzahl/Tempo ab. Prinzip wie bei Rennspielen: mehrere Aufnahme-„Drehzahlstufen“ (hier
// synthetisiert) werden überblendet, damit die Klangfarbe (Auspuffresonanzen) beim Hochdrehen nicht mitwandert.
//
// Motor: Zündimpulse je Zylinder (Viertakt: Zündfrequenz = U/min / 120 × Zylinder) mit fester Ungleichförmigkeit je
// Zylinder (V-Motor-„Blubbern“, leicht verschiedene Füllung) und kleiner Streuung je Arbeitsspiel, durch Auspuff-
// Resonanzen gefiltert; Diesel: Nageln (Hochpass-Knack je Zündung); Ventiltrieb: leises Ticken. Die Schleife enthält
// eine ganze Zahl Arbeitsspiele und wird zirkulär gefiltert (drei Kopien, die mittlere zählt) → nahtlos.
// Ketten: einzelne Kettenglied-Schläge (Metall-Moden + Stoß), alle paar Glieder ein schwerer Laufrollen-Schlag.
// Rotor: Blattschlag (tiefer Druckstoß + scharfer BVI-„Slap“) und Rauschen je Blattdurchgang, Heckrotor als Summen.
// Strahl: „Buzzsaw“ (Bläser-Drehklang-Harmonische mit fester Blattstreuung) und Nachbrenner-Knistern.
import { Biquad, makeRng, hashString, clamp } from '../engine/audio/dsp.js?v=20261123073102';

const TAU = Math.PI * 2;

/**
 * Motorarten. cyl: Zylinder · v: V-Motor (ungleichmäßiger Zündabstand) · diesel: Nageln · pipes: Auspuffresonanzen
 * [Hz, Q, Pegel] · body: Tiefpass des Grundklangs (Hz) · rough: Streuung je Arbeitsspiel · imb: Ungleichheit je Zylinder
 * · tick: Ventiltrieb · knock: Diesel-Nageln · steps: Drehzahlstufen (Bezugsdrehzahlen der Schleifen).
 */
export const ENGINE_KINDS = {
  // Moderner Panzer-Diesel (V12, Turbo): tief, dicht, Turbopfeifen, kräftiges Nageln im Leerlauf
  tank_modern: { cyl: 12, v: true, diesel: true, pipes: [[88, 2.5, 1], [210, 3.5, 0.55], [470, 4, 0.3], [1250, 3, 0.12]], body: 2400, rough: 0.07, imb: 0.1, tick: 0.12, knock: 0.42, turbo: 0.55 },
  // Kalter Krieg: Mehrstoff-V12 ohne Turbo, rauer
  tank_kk: { cyl: 12, v: true, diesel: true, pipes: [[80, 2.2, 1], [190, 3, 0.6], [420, 3.5, 0.35], [1100, 3, 0.15]], body: 2200, rough: 0.1, imb: 0.14, tick: 0.14, knock: 0.5, turbo: 0.15 },
  // 2. Weltkrieg: V12-Ottomotor, sonorer, weniger Nageln, offene Auspuffrohre
  tank_ww2: { cyl: 12, v: true, diesel: false, pipes: [[105, 2.8, 1], [260, 3.5, 0.6], [610, 4, 0.3], [1500, 3, 0.1]], body: 3000, rough: 0.08, imb: 0.12, tick: 0.1, knock: 0.08, turbo: 0 },
  // 1. Weltkrieg: langsamer Reihensechser, laut klappernd (offene Ventile, Ketten-Primärtrieb)
  tank_ww1: { cyl: 6, v: false, diesel: false, pipes: [[72, 2, 1], [175, 3, 0.7], [400, 3, 0.4], [950, 2.5, 0.2]], body: 2600, rough: 0.16, imb: 0.18, tick: 0.35, knock: 0.05, turbo: 0 },
  // Geländewagen: V8-Benziner
  car: { cyl: 8, v: true, diesel: false, pipes: [[120, 3, 1], [330, 4, 0.5], [800, 4, 0.25], [2100, 3, 0.08]], body: 3600, rough: 0.05, imb: 0.12, tick: 0.06, knock: 0.03, turbo: 0 },
  // Limousine: Reihenvierer-Benziner (heller, glatter)
  pkw: { cyl: 4, v: false, diesel: false, pipes: [[150, 3, 1], [420, 4, 0.45], [1050, 4, 0.22], [2600, 3, 0.08]], body: 4200, rough: 0.04, imb: 0.06, tick: 0.05, knock: 0.02, turbo: 0 },
  // Transporter/Lkw: Reihensechser-Diesel mit Turbo
  diesel: { cyl: 6, v: false, diesel: true, pipes: [[95, 2.5, 1], [250, 3.5, 0.55], [600, 4, 0.3], [1500, 3, 0.12]], body: 2600, rough: 0.07, imb: 0.08, tick: 0.12, knock: 0.55, turbo: 0.3 },
  // Gabelstapler: Treibgas-Vierzylinder, dünn, gleichförmig
  stapler: { cyl: 4, v: false, diesel: false, pipes: [[130, 2.5, 1], [380, 3.5, 0.5], [900, 3, 0.25]], body: 3000, rough: 0.05, imb: 0.06, tick: 0.1, knock: 0.05, turbo: 0 },
};

/** Motorart eines Fahrzeugs (def.sound + def.era). */
export function engineKindOf(def) {
  const s = def && def.sound;
  if (s === 'tank') return def.era === 'wk1' ? 'tank_ww1' : def.era === 'wk2' ? 'tank_ww2' : def.era === 'kk' ? 'tank_kk' : 'tank_modern';
  return ENGINE_KINDS[s] ? s : 'car';
}

/** Bezugsdrehzahlen der Schleifen (Faktor ≤ 2 zwischen Stufen → playbackRate bleibt in 0,7 … 1,45). */
export function rpmSteps(idle, cut) {
  const steps = [];
  let r = idle * 1.15;
  steps.push(r);
  while (r * 1.45 < cut) { r *= 2; steps.push(Math.min(r, cut * 0.92)); }
  return steps;
}

function lp1(d, sr, f) { const a = Math.exp(-TAU * f / sr); let y = 0; for (let i = 0; i < d.length; i++) { y = d[i] * (1 - a) + y * a; d[i] = y; } return d; }
function biq(d, sr, type, f, q, g = 0) { const b = new Biquad(sr, type, f, q, g); for (let i = 0; i < d.length; i++) d[i] = b.tick(d[i]); return d; }

/** Zirkulär filtern: drei Kopien hintereinander, die mittlere ist eingeschwungen und nahtlos. */
function circular(x, fn) {
  const N = x.length, t = new Float32Array(N * 3);
  t.set(x, 0); t.set(x, N); t.set(x, 2 * N);
  fn(t);
  return t.slice(N, 2 * N);
}
/** Impuls zirkulär einmischen. */
function addCirc(d, at, src, g = 1) {
  const N = d.length; let i0 = Math.round(at) % N; if (i0 < 0) i0 += N;
  for (let i = 0; i < src.length; i++) d[(i0 + i) % N] += src[i] * g;
}
function rmsNorm(d, target) {
  let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
  const r = Math.sqrt(s / d.length) || 1, k = target / r;
  for (let i = 0; i < d.length; i++) d[i] *= k;
  return d;
}
function noise(n, R) { const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = R() * 2 - 1; return d; }

/**
 * Motor-Schleife bei Bezugsdrehzahl ref (U/min) → { data, sr, ref, fire } (fire = Zündfrequenz in Hz bei ref).
 * Abspielen mit playbackRate = rpm / ref.
 */
export function renderEngineLoop(kind, ref, sr = 32000, seed = 1) {
  const K = ENGINE_KINDS[kind] || ENGINE_KINDS.car;
  const R = makeRng(hashString(kind) + Math.round(ref) * 31 + seed);
  const cycle = Math.max(8, Math.round(sr * 120 / ref)); // Arbeitsspiel (2 Umdrehungen) in Samples
  const exactRef = sr * 120 / cycle;
  const cycles = Math.max(4, Math.ceil(sr * 0.7 / cycle));
  const N = cycle * cycles;
  const ex = new Float32Array(N), kn = new Float32Array(N), tk = new Float32Array(N);
  // Feste Eigenheiten je Zylinder (wiederholen sich jedes Arbeitsspiel → typischer „Rhythmus“ des Motors)
  const cyl = K.cyl, off = [], amp = [];
  for (let i = 0; i < cyl; i++) {
    // V-Motor: Bänke leicht versetzt (Kurbelwellen-Kröpfung, Ansaugwege) – sonst nur kleine Streuung
    const v = K.v ? (i % 2 ? 0.018 : -0.018) : 0;
    off.push(i / cyl + v / cyl * 4 + R.bi() * 0.012 / cyl * 4);
    amp.push(1 + R.bi() * K.imb);
  }
  // Druckimpuls je Zündung: schneller Anstieg, Abklingen über ~ einen halben Zündabstand
  const gap = cycle / cyl, pw = Math.max(4, Math.round(gap * 0.55));
  const pulse = new Float32Array(pw * 3);
  for (let i = 0; i < pulse.length; i++) {
    const t = i / pw;
    pulse[i] = t < 0.08 ? t / 0.08 : Math.exp(-(t - 0.08) * 3.2) - 0.18 * Math.exp(-(t - 0.08) * 1.1); // kleiner Unterdruck danach
  }
  const kLen = Math.round(sr * 0.004), knock = new Float32Array(kLen);
  for (let c = 0; c < cycles; c++) {
    for (let i = 0; i < cyl; i++) {
      const at = (c + off[i]) * cycle + R.bi() * gap * 0.03;
      const a = amp[i] * (1 + R.bi() * K.rough);
      addCirc(ex, at, pulse, a);
      if (K.knock > 0.01) {
        for (let j = 0; j < kLen; j++) knock[j] = (R() * 2 - 1) * Math.exp(-j / (sr * 0.0009));
        addCirc(kn, at + R.range(0, 0.002) * sr, knock, a * (0.6 + 0.4 * R()));
      }
    }
    // Ventiltrieb/Nockenwelle: leise Ticks im Takt der halben Zylinderzahl, unregelmäßig
    if (K.tick > 0.01) for (let i = 0; i < cyl; i++) {
      for (let j = 0; j < kLen; j++) knock[j] = (R() * 2 - 1) * Math.exp(-j / (sr * 0.0006));
      addCirc(tk, (c + (i + 0.5) / cyl) * cycle + R.bi() * gap * 0.1, knock, 0.3 + 0.7 * R());
    }
  }
  const out = circular(ex, (t) => {
    // Grundklang: tiefpassgefilterte Impulsfolge + Auspuffresonanzen (parallel)
    const body = lp1(t.slice(), sr, K.body);
    const sum = new Float32Array(t.length);
    for (let i = 0; i < t.length; i++) sum[i] = body[i] * 0.55;
    for (const [f, q, g] of K.pipes) {
      if (f > sr * 0.45) continue;
      const b = biq(t.slice(), sr, 'bandpass', f, q);
      for (let i = 0; i < t.length; i++) sum[i] += b[i] * g * 1.6;
    }
    biq(sum, sr, 'highpass', 24, 0.7);
    t.set(sum);
  });
  rmsNorm(out, 0.2);
  if (K.knock > 0.01) {
    const k2 = circular(kn, (t) => { biq(t, sr, 'highpass', K.diesel ? 1400 : 2200, 0.7); biq(t, sr, 'lowpass', 6500, 0.7); biq(t, sr, 'peaking', 2800, 1.2, 4); });
    rmsNorm(k2, 0.2 * K.knock * 0.5);
    for (let i = 0; i < N; i++) out[i] += k2[i];
  }
  if (K.tick > 0.01) {
    const t2 = circular(tk, (t) => { biq(t, sr, 'bandpass', 3600, 1.5); });
    rmsNorm(t2, 0.2 * K.tick * 0.3);
    for (let i = 0; i < N; i++) out[i] += t2[i];
  }
  // Weiche Sättigung (Auspuff-Krümmer, Mikro) – mehr Obertöne, nimmt Spitzen
  for (let i = 0; i < N; i++) out[i] = Math.tanh(out[i] * 1.8) / 1.8;
  return { data: out, sr, ref: exactRef, fire: exactRef / 120 * cyl };
}

/**
 * Ketten-Schleife: count Glied-Schläge je Sekunde (Bezug), 1 s lang. Abspielen mit playbackRate = Tempo / vRef,
 * vRef = count × Gliedteilung. heavy: schwere Ketten (tiefer, Laufrollen poltern).
 */
export function renderTrackLoop(count, sr = 32000, seed = 1, heavy = 1) {
  const R = makeRng(9001 + count * 17 + seed);
  const N = sr, d = new Float32Array(N);
  const modesBase = [[310, 0.9, 0.035], [560, 0.8, 0.03], [910, 0.6, 0.022], [1480, 0.5, 0.016], [2350, 0.35, 0.012], [3700, 0.22, 0.008]];
  const gap = N / count;
  for (let k = 0; k < count; k++) {
    const at = k * gap + R.bi() * gap * 0.18, big = k % 7 === 3 || R() < 0.06;
    const a = (0.45 + 0.55 * R()) * (big ? 1.7 : 1);
    const n = Math.round(sr * 0.06), s = new Float32Array(n);
    for (const [f0, g, tau] of modesBase) {
      const f = f0 * (1 + R.bi() * 0.08) * (big ? 0.8 : 1) / Math.sqrt(heavy), w = TAU * f / sr, kk = Math.exp(-1 / (tau * sr));
      let e = g, ph = R() * TAU;
      for (let i = 0; i < n; i++) { s[i] += Math.sin(ph) * e; ph += w; e *= kk; }
    }
    // Stoß (Glied auf Rolle/Boden) + kurzes Kratzen
    for (let i = 0; i < n; i++) s[i] += (R() * 2 - 1) * Math.exp(-i / (sr * 0.0025)) * 0.9 + Math.sin(TAU * (big ? 65 : 95) * i / sr) * Math.exp(-i / (sr * 0.012)) * (big ? 1.6 : 0.7);
    addCirc(d, at, s, a);
  }
  const out = circular(d, (t) => { biq(t, sr, 'highpass', 40, 0.7); biq(t, sr, 'lowpass', 7000, 0.7); });
  for (let i = 0; i < N; i++) out[i] = Math.tanh(out[i] * 0.9);
  rmsNorm(out, 0.2);
  return { data: out, sr, count };
}

/**
 * Rotor-Schleife (Hauptrotor blades Blätter, Bezug rev U/s, 4 Umdrehungen) → { soft, slap, sr, rev }.
 * soft: Druckstoß + Rauschen je Blatt (Schwebeflug), slap: scharfer Blattwirbel-Schlag (Last, Sinkflug, Kurve).
 * Heckrotor (4 Blätter, 5,25 × Drehzahl) als Summen in soft.
 */
export function renderRotorLoop(blades = 5, rev = 4.3, sr = 32000, seed = 1) {
  const R = makeRng(4242 + blades * 13 + seed);
  const revs = 4, per = Math.round(sr / rev), N = per * revs, exactRev = sr / per;
  const soft = new Float32Array(N), slap = new Float32Array(N), swish = new Float32Array(N);
  const bladeAmp = []; for (let b = 0; b < blades; b++) bladeAmp.push(1 + R.bi() * 0.08); // Blattspurfehler
  const tw = Math.round(sr * 0.011), th = new Float32Array(tw * 4);
  for (let i = 0; i < th.length; i++) { const x = i / tw; th[i] = x < 1 ? 0.5 - 0.5 * Math.cos(Math.PI * x) : Math.exp(-(x - 1) * 1.6); }
  const sw = Math.round(sr * 0.002), sp = new Float32Array(sw * 6);
  for (let i = 0; i < sp.length; i++) { const x = i / sw; sp[i] = x < 0.5 ? x * 2 : x < 1.5 ? 1 - (x - 0.5) * 2 : -1 * Math.exp(-(x - 1.5) * 1.8); }
  const nw = Math.round(sr * 0.045);
  for (let r = 0; r < revs; r++) for (let b = 0; b < blades; b++) {
    const at = (r + b / blades) * per + R.bi() * 0.003 * sr, a = bladeAmp[b] * (1 + R.bi() * 0.05);
    addCirc(soft, at, th, a);
    addCirc(slap, at + 0.004 * sr, sp, a * (0.8 + 0.3 * R()));
    const nb = new Float32Array(nw);
    for (let i = 0; i < nw; i++) { const x = i / nw; nb[i] = (R() * 2 - 1) * Math.sin(Math.PI * x) * Math.sin(Math.PI * x); }
    addCirc(swish, at - nw * 0.3, nb, a);
  }
  // Heckrotor: 4 Blätter, 21 Umdrehungen in 4 Hauptumdrehungen
  const tail = new Float32Array(N), tn = 21 * 4, tpw = Math.round(sr * 0.0025), tp = new Float32Array(tpw * 3);
  for (let i = 0; i < tp.length; i++) { const x = i / tpw; tp[i] = x < 1 ? Math.sin(Math.PI * x) : -0.4 * Math.exp(-(x - 1) * 2); }
  for (let k = 0; k < tn; k++) addCirc(tail, k * N / tn + R.bi() * 0.0006 * sr, tp, 1 + R.bi() * 0.1);
  const S = circular(soft, (t) => { biq(t, sr, 'lowpass', 220, 0.7); biq(t, sr, 'highpass', 12, 0.7); });
  const W = circular(swish, (t) => { biq(t, sr, 'bandpass', 700, 0.7); });
  const T = circular(tail, (t) => { biq(t, sr, 'bandpass', 420, 0.9); });
  const P = circular(slap, (t) => { biq(t, sr, 'highpass', 60, 0.7); biq(t, sr, 'lowpass', 5200, 0.7); biq(t, sr, 'peaking', 900, 0.8, 5); });
  rmsNorm(S, 0.2); rmsNorm(W, 0.2 * 0.35); rmsNorm(T, 0.2 * 0.22); rmsNorm(P, 0.2);
  const softOut = new Float32Array(N);
  for (let i = 0; i < N; i++) softOut[i] = Math.tanh((S[i] + W[i] + T[i]) * 1.4) / 1.4;
  for (let i = 0; i < N; i++) P[i] = Math.tanh(P[i] * 1.6) / 1.6;
  return { soft: softOut, slap: P, sr, rev: exactRev };
}

/**
 * Strahltriebwerk: „Buzzsaw“-Schleife (Bläser mit blades Schaufeln, Bezug fan U/s) → { data, sr, fan }.
 * Harmonische der Wellendrehzahl mit fester, leicht unregelmäßiger Amplitude je Ordnung (Schaufelstreuung).
 */
export function renderBuzzLoop(fan = 80, sr = 32000, seed = 1, blades = 22) {
  const R = makeRng(777 + seed);
  const per = Math.round(sr / fan), revs = Math.max(8, Math.round(0.5 * fan)), N = per * revs, f0 = sr / per;
  const d = new Float32Array(N);
  for (let h = 1; h * f0 < sr * 0.45 && h <= 120; h++) {
    const near = Math.exp(-Math.pow((h - blades) / (blades * 0.35), 2)); // Energie um die Schaufelfrequenz
    const a = (0.15 + 0.85 * R()) * (0.25 / Math.sqrt(h) + near) * (h === blades ? 1.6 : 1);
    const ph = R() * TAU, w = TAU * h * f0 / sr;
    for (let i = 0; i < N; i++) d[i] += Math.sin(w * i + ph) * a;
  }
  rmsNorm(d, 0.2);
  return { data: d, sr, fan: f0 };
}

/** Nachbrenner-Knistern (2 s): unregelmäßige tiefe Knalle + Rauschen. */
export function renderCrackleLoop(sr = 32000, seed = 1) {
  const R = makeRng(31337 + seed), N = sr * 2, d = new Float32Array(N);
  const n = Math.round(sr * 0.03), s = new Float32Array(n);
  for (let k = 0; k < 140; k++) {
    for (let i = 0; i < n; i++) s[i] = (R() * 2 - 1) * Math.exp(-i / (sr * (0.002 + R() * 0.004)));
    addCirc(d, R() * N, s, Math.pow(R(), 2) * 1.5);
  }
  const out = circular(d, (t) => { biq(t, sr, 'lowpass', 1800, 0.7); biq(t, sr, 'highpass', 40, 0.7); });
  rmsNorm(out, 0.2);
  return { data: out, sr };
}

/** Rauschen (rosa-ähnlich, 2 s, nahtlos) für Ansaugen, Abrollen, Strahl. */
export function renderNoiseLoop(sr = 32000, seed = 1) {
  const R = makeRng(555 + seed), N = sr * 2;
  const out = circular(noise(N, R), (t) => {
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < t.length; i++) { const w = t[i]; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; t[i] = b0 + b1 + b2 + w * 0.1848; }
    biq(t, sr, 'highpass', 20, 0.7);
  });
  rmsNorm(out, 0.2);
  return { data: out, sr };
}

export { clamp };
