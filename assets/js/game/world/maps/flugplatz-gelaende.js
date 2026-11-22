// NULLPUNKT — Flugplatz: Erdwälle, Splitterschutz, Materiallager, Fahrzeuge (gelaende, 14.11. Runde 3). (Owner: world)
// Orchestrator: „Der Flugplatz wirkt von oben sehr leer und flach (viel Wiese zwischen Bahn, Rollwegen und Gebäuden).“
// Die Flächen zwischen Bahn, Rollweg und Vorfeld sind Bauflächen (terrain.pads, eben) – Höhenunterschiede entstehen dort
// als Bauteile (gelaende.huegel/erdwall), außerhalb über das Kleinrelief (terrain.relief in flugplatz.js):
//   · Erdwälle (1,3 m, begehbar) im Wiesenstreifen zwischen Rollweg und Startbahn – Deckung beim Queren
//   · Splitterschutzwände (Beton-T-Wände, 3 m) als U um die Abstellplätze 1 und 4 (Schulflugzeuge), offen zum Rollweg
//   · zwei Materiallager (Container, Kisten-, Paletten-, Fassstapel, Lkw) zwischen Vorfeld und Startbereichen
//   · Splitterschutzwälle um zwei Fahrzeug-Abstellplätze südlich der Bahn
// Startbahn (z 40 ± 22,5 + 20 m Sicherheitsstreifen), Rollweg A (z −35 ± 10) samt Abrollwegen (x ±150, ±400), An-/Abflug-
// schneisen (|x| > 420) und alle Flaggen/Startpunkte/Fahrzeug-Stellplätze bleiben frei (Prüfung je Teil, sonst entfällt
// es mitsamt dem Gegenstück). Spiegelgleich in x (Team A West, Team B Ost). Höhe je Teil aus dem Gelände (ctx.hf).
import { container, crateStack, palletStack, barrelGroup, sandbags, hash01 } from '../props.js?v=20261122020853';
import { armeeLkw } from './flugplatz-bau.js?v=20261122020853';
import { freiPruefer, sperrKreise, platzFrei, erdwall } from '../gelaende.js?v=20261122020853';
import { KAMPAGNE_PUNKTE } from '../kampagne-punkte.js?v=20261122020853';

/** Sperrflächen: Bahn, Rollweg, Abrollwege, Schneisen, Straßen als Rechtecke [x0, z0, x1, z1]. */
const SPERR_RECHTECKE = [
  [-560, 40 - 44, 560, 40 + 44],            // Startbahn + Sicherheitsstreifen (Flügel, Ausrollen)
  [-430, -35 - 14, 430, -35 + 14],          // Rollweg A
  ...[-400, -150, 150, 400].map((x) => [x - 16, -35, x + 16, 40]), // Abrollwege A1–A4
  [-560, -40, -420, 120], [420, -40, 560, 120],   // Anflugschneisen
  [-260, 94, 260, 106],                      // Lagerstraße
  [-5, 100, 5, 260],                         // Zufahrt
];

/** Beton-T-Wand (Splitterschutz): Fuß 1,2 m, Wand 0,3 × h, Länge L entlang lokal x. */
function tWand(b, x, y, z, ry, L, h = 3.0) {
  const c = Math.cos(ry), s = Math.sin(ry), t = ['#a9a59c', '#b3afa5', '#9f9b92'];
  for (let k = 0, n = Math.round(L / 1.25); k < n; k++) {
    const lx = -L / 2 + (k + 0.5) * (L / n), px = x + lx * c, pz = z - lx * s, tt = t[Math.floor(hash01(px, pz, 601) * 3)];
    b.box(px, y, pz, L / n - 0.03, 0.35, 1.2, 'concrete', { ry, tint: tt, minimap: false });
    b.box(px, y + 0.35, pz, L / n - 0.03, h - 0.35, 0.3, 'concrete', { ry, tint: tt, minimap: 'wall' });
  }
}

export function flugplatzGelaende(b, ctx, def) {
  const hf = ctx.hf, yAt = (x, z) => hf.heightAt(x, z);
  const fl = def.flags || {};
  const frei = freiPruefer(sperrKreise({ spawns: def.spawns, flags: [...(fl.cq || []), ...(fl.dom || [])], rFlag: 12, punkte: [...(def.vehicles || []).map((v) => [v.x, v.z, 10]), ...(KAMPAGNE_PUNKTE.flugplatz || []).map(([x, z]) => [x, z, 3])] }));
  let gesetzt = 0;
  const aus = [];
  const imRechteck = (x, z, hw, hd) => SPERR_RECHTECKE.some(([x0, z0, x1, z1]) => x + hw > x0 && x - hw < x1 && z + hd > z0 && z - hd < z1);
  const paar = (x, z, hw, hd, fn) => {
    if (imRechteck(x, z, hw, hd) || imRechteck(-x, z, hw, hd)) { aus.push(`${x},${z}[Bahn/Rollweg]`); return; }
    if (!platzFrei(b, frei, x, z, hw, hd, 0, 1.5) || !platzFrei(b, frei, -x, z, hw, hd, 0, 1.5)) { aus.push(`${x},${z}[${frei.grund}]`); return; }
    fn(x, 1); fn(-x, -1); gesetzt += 2;
  };
  // 1) Erdwälle im Wiesenstreifen Rollweg ↔ Bahn (z ≈ −8 … −2), versetzt, Lücken für Fahrzeuge
  for (const [x, z, L] of [[45, -14.5, 18], [100, -13, 16], [205, -14, 20], [265, -12.5, 16], [335, -14.5, 18]]) {
    paar(x, z, L / 2 + 3.2, 3.4, (px) => erdwall(b, px - L / 2, z, px + L / 2, z, { y: yAt(px, z) - 0.05, w: 6.6, h: 1.35, tint: '#d2d8b0', mat: 'grass' }));
  }
  // 2) Splitterschutz-U um die Abstellplätze (1/4 bei x ±140, sonst 2/3 bei ±80), offen nach Süden (Rollweg)
  for (const sx of [140, 80]) {
    paar(sx, -103, 13.5, 9.5, (px) => {
      const y = yAt(px, -100);
      tWand(b, px, y, -112.5, 0, 24);
      for (const s of [-1, 1]) tWand(b, px + s * 12.4, y, -103, Math.PI / 2, 18);
    });
  }
  // 3) Materiallager zwischen Vorfeld und Startbereichen (x ±190, z −78)
  paar(192, -78, 12, 9, (px, s) => {
    const y = yAt(px, -78);
    container(b, px + 6 * s, y, -84, { len: 12.19, ry: 0.02 * s, color: s > 0 ? '#5d6345' : '#4f5a44' });
    container(b, px + 6 * s, y + 2.59, -84, { len: 6.06, ry: -0.03 * s, color: '#6b6a58' });
    crateStack(b, px - 4 * s, -80, { y, ry: 0.2 * s, pattern: [[0, 0, 0, 1.2], [1.25, 0, 0.05, 1.1], [0.55, 1, 0.02, 1.0], [-1.25, 0, 0.1, 1.1]] });
    palletStack(b, px - 7.5 * s, -74, { y, n: 4, ry: 0.4 * s, load: 'boxes' });
    barrelGroup(b, px + 1 * s, -72.5, { y, n: 5, colors: ['#4b5a3a', '#4b5a3a', '#c9a227'] });
    armeeLkw(b, px + 7 * s, -73, Math.PI / 2 * s + 0.08, { y });
  });
  // 4) Fahrzeug-Abstellplätze mit Splitterschutzwall südlich der Bahn (zwischen Bahn und Lagerstraße)
  paar(230, 116, 12, 8, (px, s) => {
    const y = yAt(px, 116);
    erdwall(b, px - 10, 123, px + 10, 123, { y: y - 0.05, w: 6.4, h: 1.6, tint: '#d2d8b0', mat: 'grass' });
    erdwall(b, px - 11 * s, 112, px - 11 * s, 121, { y: y - 0.05, w: 6.4, h: 1.6, tint: '#d2d8b0', mat: 'grass' });
    armeeLkw(b, px - 2, 115, 0.05 * s, { y });
    armeeLkw(b, px + 4, 115.5, -0.04 * s, { y, plane: '#4f5540' });
  });
  // 5) Sandsack-Stellungen an den Abrollwegen (Knie-/Brusthöhe, quer zur Laufrichtung Ost–West)
  for (const [x, z] of [[180, -16], [125, -11], [300, -16]]) {
    paar(x, z, 3.2, 1.2, (px) => sandbags(b, px - 2.6, z, px + 2.6, z, { rows: 4, y: yAt(px, z) - 0.03 }));
  }
  if (globalThis.location?.search?.includes('debug=1')) console.info(`[gelaende] flugplatz: ${gesetzt} Teile, verworfen ${aus.join(' ')}`);
  return { gesetzt, verworfen: aus.length };
}
