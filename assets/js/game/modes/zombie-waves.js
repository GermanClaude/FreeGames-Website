// NULLPUNKT — Zombie-Modus: Wellenplan (reine Logik, ohne three.js/DOM – in Node prüfbar).
// waveSpec(n, opts) beschreibt Welle n (1-basiert): Gesamtzahl, Mischung der Typen, Härte (Leben/Tempo/Schaden ×),
// gleichzeitig lebende Untote und Takt des Nachrückens. Die Zahl wächst mit der Welle und der Größe des eigenen Trupps
// (KI-Kameraden zählen halb), die Dichte („Horde“) skaliert alles. pickType() wählt den nächsten Typ so, dass die
// Mischung über die Welle aufgeht (keine drei Hüne am Anfang, keine am Ende). Kein Zufall außer über rnd().

/** Typen der Untoten (Werte je Typ; die Welle multipliziert Leben/Tempo/Schaden). */
export const ZOMBIE_TYPES = Object.freeze({
  // langsam, häufig: schlurft, beschleunigt nur auf den letzten Metern
  schlurfer: Object.freeze({ id: 'schlurfer', name: 'Schlurfer', hp: 120, roam: 0.85, chase: 1.3, lunge: 2.4, dmg: 17, reach: 1.45, windup: 0.55, cooldown: 1.35, view: 34, hearing: 1.5, stagger: 1, explosive: 1, pitch: 0.6 }),
  // schnell, zerbrechlich: hetzt im Lauf heran
  hetzer: Object.freeze({ id: 'hetzer', name: 'Hetzer', hp: 70, roam: 1.7, chase: 4.9, lunge: 5.6, dmg: 11, reach: 1.35, windup: 0.32, cooldown: 0.85, view: 52, hearing: 1.8, stagger: 1.2, explosive: 1, pitch: 0.72 }),
  // zäh: viel Leben, harter Schlag, kaum aufzuhalten (Kopftreffer bleiben tödlich)
  huene: Object.freeze({ id: 'huene', name: 'Hüne', hp: 460, roam: 1.25, chase: 2.0, lunge: 2.7, dmg: 36, reach: 1.6, windup: 0.75, cooldown: 1.8, view: 40, hearing: 1.4, stagger: 0.25, explosive: 0.6, pitch: 0.5 }),
});
export const TYPE_IDS = Object.freeze(Object.keys(ZOMBIE_TYPES));

/** Dichte der Horde (Lobby-Option „horde“). */
export const DENSITY = Object.freeze({ klein: 0.7, mittel: 1, gross: 1.4 });
/** Gleichzeitig lebende Untote je Grafikstufe (Leistung: jeder ist ein voller Soldat mit Skelett). */
export const MAX_ALIVE = Object.freeze({ low: 10, medium: 16, high: 22, ultra: 28 });
/** Pause zwischen den Wellen (s) und Vorlauf vor der ersten. */
export const PAUSE_S = 22;
export const PREP_S = 12;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Welle n. opts: { crew (Menschen + KI-Kameraden inkl. Spieler), allies (davon KI), density, tier }
 * → { n, total, mix: { schlurfer, hetzer, huene }, hpMult, speedMult, dmgMult, maxAlive, interval, burst }
 */
export function waveSpec(n, { crew = 1, allies = 0, density = 'mittel', tier = 'high' } = {}) {
  n = Math.max(1, n | 0);
  const k = DENSITY[density] || 1;
  const humans = Math.max(1, (crew | 0) - (allies | 0));
  // Spieler zählen voll, KI-Kameraden halb (sie schießen gut, aber nicht immer)
  const crewK = 1 + 0.55 * (humans - 1) + 0.35 * Math.max(0, allies | 0);
  const base = 6 + 3.4 * n + 0.22 * n * n;
  const total = Math.max(4, Math.round(base * k * crewK));
  const hetzerShare = n < 2 ? 0 : clamp(0.07 * (n - 1), 0, 0.38);
  const hueneShare = n < 4 ? 0 : clamp(0.035 * (n - 3), 0, 0.16);
  let huene = Math.round(total * hueneShare);
  if (n >= 5 && n % 5 === 0) huene = Math.max(huene, 1 + Math.floor(n / 10)); // jede fünfte Welle mindestens ein Hüne
  const hetzer = Math.round(total * hetzerShare);
  const schlurfer = Math.max(0, total - hetzer - huene);
  const cap = MAX_ALIVE[tier] || MAX_ALIVE.high;
  return {
    n, total: schlurfer + hetzer + huene,
    mix: { schlurfer, hetzer, huene },
    hpMult: clamp(1 + 0.055 * (n - 1), 1, 1.8),
    speedMult: clamp(1 + 0.022 * (n - 1), 1, 1.28),
    dmgMult: clamp(1 + 0.05 * (n - 1), 1, 1.7),
    maxAlive: Math.max(4, Math.min(cap, Math.round((6 + 1.6 * n) * Math.sqrt(k) * Math.sqrt(crewK)))),
    interval: clamp(2.6 - 0.13 * n, 0.55, 2.6), // s zwischen zwei Nachrückern (Gruppen: burst)
    burst: n < 3 ? 1 : n < 7 ? 2 : 3,
  };
}

/**
 * Nächster Typ: gewichtet nach dem, was von jeder Art noch übrig ist; Hüne frühestens nach einem Viertel der Welle.
 * spawned: { schlurfer, hetzer, huene } schon erzeugt. → Typ-Id oder null (Welle vollständig)
 */
export function pickType(spec, spawned, rnd = Math.random) {
  const left = {};
  let sum = 0;
  const done = TYPE_IDS.reduce((s, id) => s + (spawned[id] | 0), 0);
  for (const id of TYPE_IDS) {
    let l = Math.max(0, (spec.mix[id] | 0) - (spawned[id] | 0));
    if (id === 'huene' && done < spec.total * 0.25 && spec.total > 8) l = 0;
    left[id] = l;
    sum += l;
  }
  if (sum <= 0) {
    // nur noch Hüne übrig, aber zu früh → trotzdem freigeben
    for (const id of TYPE_IDS) if ((spec.mix[id] | 0) > (spawned[id] | 0)) return id;
    return null;
  }
  let r = rnd() * sum;
  for (const id of TYPE_IDS) { r -= left[id]; if (r < 0) return id; }
  return TYPE_IDS.find((id) => left[id] > 0) || null;
}

/** Punkte für eine überstandene Welle. */
export function waveBonus(n) {
  return 150 + 50 * Math.max(1, n | 0);
}

/**
 * Schadensregel der Untoten (combat.damage → actor.scaleDamage): Kopftreffer tödlich (ohne Explosion), Körpertreffer
 * voll, Arme 60 %, Beine 70 % und bremsen. info: { zone, explosive, legHit } → { amount, lethal, leg }
 */
export function zombieDamage(type, amount, { zone = 'body', explosive = false, legHit = false } = {}, health = 100) {
  if (explosive) return { amount: amount * (type.explosive || 1), lethal: false, leg: false };
  if (zone === 'head') return { amount: Math.max(amount, health + 1), lethal: true, leg: false };
  if (zone === 'limb') return legHit ? { amount: amount * 0.7, lethal: false, leg: true } : { amount: amount * 0.6, lethal: false, leg: false };
  return { amount, lethal: false, leg: false };
}

/** Tempo-Faktor nach Beintreffern (Summe des Beinschadens relativ zum Grundleben): bis auf 35 % herunter. */
export function legSlow(legDamage, baseHp) {
  const f = legDamage / Math.max(1, baseHp);
  return clamp(1 - f * 1.4, 0.35, 1);
}
