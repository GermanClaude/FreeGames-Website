// NULLPUNKT — Panzersimulation: Können der KI-Besatzungen (Nutzer 21.11.: „Bots viel zu gut, eigene Bots richtig schlecht“).
//
// Ein Modell für alle Schützen im Modus „Panzer“ (eigene KI-Besatzung, Feindpanzer, verbündete Panzer, Pak):
//   Erkennen   Zeit bis zur Zielerkennung T = (0,8 s + Entfernung/330 m) × Können × Tarnung ÷ Bewegung ÷ Mündungsfeuer
//              (Rumpf in Deckung/nur Turm sichtbar ×1,8, Infanterie ×1,7, Rauch, fahrendes Ziel ×0,55, feuerndes Ziel ×0,35)
//   Richten    nach dem Erkennen braucht der Schütze settle Sekunden (Turm schwenken, Entfernung messen, Haltepunkt)
//   Treffen    jeder Schuss = Haltepunkt + Fehler: Grundfehler σ0 (rad) je Generation × Können, fahrender Schütze ×,
//              Vorhaltfehler bei fahrendem Ziel; nach jedem Schuss schrumpft der Grundfehler (Korrektur nach Fehlschuss,
//              Faktor corr) – erster Schuss auf 1000 m stehend: Feind „mittel“ ≈ 30 %, eigene Besatzung modern ≈ 80 %
//   Laden      Ladezeit × reload (crew.js, Fahrzeugfeld _reloadMul)
// Stufe der Gegner: Schwierigkeit (Kampagne Rekrut … Elite; frei: Einstellung) + Option „gegner“ (leicht −1, mittel 0,
// schwer +1) → −1 … 4. Eigene Besatzung: feste, gute Werte (OWN).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** Normalverteilte Zufallszahl (σ = 1). */
export function randn() {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

const DIFF_IDX = { rekrut: 0, regulaer: 1, veteran: 2, elite: 3 };
const GEGNER_OFF = { leicht: -1, mittel: 0, schwer: 1 };
// Tabellen über die Stufen −1 … 4
const T = {
  aim: [2.1, 1.6, 1.2, 0.95, 0.8, 0.7],
  detect: [2.1, 1.7, 1.3, 1.05, 0.9, 0.8],
  settle: [1.9, 1.55, 1.25, 1.05, 0.9, 0.8],
  reload: [1.4, 1.28, 1.15, 1.05, 1.0, 0.95],
  corr: [0.85, 0.75, 0.64, 0.56, 0.5, 0.45],
};
const tab = (arr, L) => { const i = clamp(L + 1, 0, arr.length - 1), a = Math.floor(i), f = i - a; return arr[a] + (arr[Math.min(a + 1, arr.length - 1)] - arr[a]) * f; };

/** Stufe der Gegner (−1 … 4) aus Schwierigkeit und Option „gegner“. */
export function foeLevel(G, mode = G && G.mode) {
  const d = DIFF_IDX[G && G.match && G.match.difficulty];
  const g = GEGNER_OFF[mode && mode.cfg && mode.cfg.gegner];
  return clamp((d ?? 1) + (g ?? 0), -1, 4);
}

/** Können einer Stufe. */
export function skillAt(L) {
  return { level: L, aim: tab(T.aim, L), detect: tab(T.detect, L), settle: tab(T.settle, L), reload: tab(T.reload, L), corr: tab(T.corr, L), lead: 0.3, own: false };
}
/** Eigene KI-Besatzung (Spielerpanzer): erfasst schnell, schießt präzise, korrigiert gut. */
export const OWN = { level: 5, aim: 0.55, detect: 0.55, settle: 0.6, reload: 0.92, corr: 0.35, lead: 0.12, own: true };
/** Verbündete KI-Panzer (Kampagne): ordentliche Besatzungen. */
export const FRIEND = { level: 3, aim: 0.85, detect: 0.9, settle: 0.95, reload: 1.0, corr: 0.5, lead: 0.25, own: false };

/** Grundfehler (rad, σ) des ersten Schusses je Generation: modern mit Laser/Rechner, Weltkrieg mit Strichplatte. */
export const SIGMA0 = { modern: 0.0016, wk2: 0.0022, wk1: 0.0028 };
/** Mindestrichtzeit (s) nach dem Erkennen bis zum ersten Schuss (× skill.settle). */
export const SETTLE = { modern: 1.8, wk2: 2.8, wk1: 3.2 };
/** Streuung der Waffe je Schuss (rad, σ). */
export const DISP = 0.00022;

/**
 * Erkennungszeit (s) für ein Ziel. o: { dist, vis (1 ganz sichtbar, 0.5 nur Turm/Kopf), infantry, moving, fired (vor s),
 * smoke (0..1 Sicht), observerMoving } – skill.detect skaliert.
 */
export function detectTime(skill, o) {
  let t = (0.8 + o.dist / 330) * skill.detect;
  if (o.vis < 1) t *= 1.8;
  if (o.infantry) t *= 1.7;
  if (o.smoke != null && o.smoke < 1) t /= Math.max(0.08, o.smoke);
  if (o.moving) t *= 0.55;
  if (o.fired != null && o.fired < 4) t *= 0.35;
  if (o.observerMoving) t *= 1.4;
  return t;
}

/** Schuss-Grundfehler (σ, rad) für Generation, Können und eigene Fahrt. */
export function sigmaFor(era, skill, shooterSpeed) {
  const s0 = (SIGMA0[era] || SIGMA0.wk2) * skill.aim;
  const mv = Math.abs(shooterSpeed || 0);
  if (mv < 0.8) return s0;
  const k = era === 'modern' ? (skill.own ? 1.5 : 2.2) : 4;
  return s0 * (1 + (k - 1) * Math.min(1, mv / 6));
}
