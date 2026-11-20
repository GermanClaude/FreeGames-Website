/* NULLPUNKT — Modus „Trupp“ (reine Daten, ohne three.js/DOM): Rollen je Trupp, Markierungen, Funksprüche, Unterstützung
 * des Kommandanten, Front-Reihenfolge der Kontrollpunkte. Spiel (game/modes/trupp*.js, game/ui/trupp-hud.js) und Website
 * lesen dieselben Tabellen.
 *
 * Frontlinie: Die Kontrollpunkte einer Großkarte liegen als Linie zwischen den beiden HQs. Team A beginnt mit dem ersten
 * Punkt, Team B mit dem letzten; einnehmbar ist für jede Seite nur der nächste Punkt hinter der eigenen Kette (Reihenfolge).
 * Quelle der Linie (frontOrder):
 *   1. MAPS[id].trupp.order = ['A', 'B', …]  (Ids der Eroberungspunkte in Front-Reihenfolge, von HQ A nach HQ B)
 *   2. sonst world.objectives.trupp (Kartendatei: [{ id, name, position, radius, spawns }]) – eigene Punkte
 *   3. sonst die Eroberungspunkte (world.objectives.cq), sortiert nach der Lage auf der Achse HQ A → HQ B.
 * So läuft jede Großkarte mit Eroberungspunkten ohne weitere Daten, auch neue (z. B. die Riesenkarte der App).
 */

/** Truppgrößen (Plätze je Trupp), Standard und Lobby-Werte. */
export const TRUPP_SIZES = Object.freeze([4, 6, 9]);
export const TRUPP_SIZE_DEFAULT = 6;
/** Rufnamen der Trupps (frei erfunden, Buchstabieralphabet-artig). */
export const TRUPP_NAMES = Object.freeze(['Anton', 'Berta', 'Cäsar', 'Dora', 'Emil', 'Friedrich', 'Gustav', 'Heinrich', 'Ida', 'Julius', 'Kaufmann', 'Ludwig']);
/** Truppfarben (HUD, Namensschilder, Kompass) – je Trupp-Index. */
export const TRUPP_COLORS = Object.freeze(['#57d68d', '#f2c84b', '#5fb4ff', '#ff8a5c', '#c792ff', '#4fe3e0', '#ff6fae', '#b5d35a', '#e8e8e8', '#ffa94d', '#8fa8ff', '#d4a373']);

/**
 * Rollen. max: Höchstzahl je Trupp als [Trupp bis 5 Plätze, ab 6 Plätzen]; 0 = gesperrt, Infinity = frei.
 * cls = Soldatenklasse (Weste, Helm, Gerät, Aussehen aus classes.data.js). weapons = erlaubte Waffenklassen der
 * Hauptwaffe (eigene Wahl bleibt, wenn sie passt), prefer = Standardwaffen, secondary 'launcher' = Panzerabwehrwerfer.
 * build = Bauwerke (building.js) – Truppführer baut den Außenposten (Bunker) nur mit einem Pionier des Trupps daneben.
 */
export const TRUPP_ROLES = Object.freeze({
  truppfuehrer: {
    id: 'truppfuehrer', name: 'Truppführer', short: 'TF', cls: 'sturm', max: [1, 1], leader: true,
    text: 'Führt den Trupp: Markierungen, Sammelpunkt, Befehle an die Bots des Trupps, Außenposten mit einem Pionier.',
    weapons: ['ar', 'carbine'], prefer: ['ar_m17', 'ar_kv47', 'ar_g7'], secondary: ['pi_p9', 'pi_adler'], lethal: 'frag', tactical: 'smoke',
    build: ['sandsack', 'mulde', 'bunker'],
  },
  schuetze: {
    id: 'schuetze', name: 'Schütze', short: 'SCH', cls: 'sturm', max: [Infinity, Infinity],
    text: 'Rückgrat des Trupps: Sturmgewehr, Splitter- und Blendgranate.',
    weapons: ['ar', 'carbine', 'shotgun'], prefer: ['ar_kv47', 'ar_m17', 'ar_k36'], secondary: ['pi_p9', 'pi_adler'], lethal: 'frag', tactical: 'flash',
    build: ['sandsack', 'mulde'],
  },
  sanitaeter: {
    id: 'sanitaeter', name: 'Sanitäter', short: 'SAN', cls: 'sanitaeter', max: [1, 2],
    text: 'Belebt bewusstlose Kameraden wieder (F an der Person) und trägt den Verbandskasten.',
    weapons: ['smg', 'carbine', 'ar'], prefer: ['smg_vp9', 'smg_qx90', 'smg_wespe'], secondary: ['pi_p9'], lethal: 'frag', tactical: 'smoke',
    build: ['sandsack', 'mulde'],
  },
  mg: {
    id: 'mg', name: 'MG-Schütze', short: 'MG', cls: 'sturm', max: [1, 1],
    text: 'Niederhaltendes Feuer mit dem leichten MG; baut MG-Nester.',
    weapons: ['lmg'], prefer: ['lmg_hm60', 'lmg_lm8'], secondary: ['pi_adler', 'pi_p9'], lethal: 'frag',
    build: ['sandsack', 'mulde', 'mgnest'],
  },
  panzerabwehr: {
    id: 'panzerabwehr', name: 'Panzerabwehr', short: 'PA', cls: 'pionier', max: [1, 2],
    text: 'Panzerabwehrwerfer statt Pistole, schwere Weste; repariert Fahrzeuge.',
    weapons: ['smg', 'ar', 'carbine'], prefer: ['smg_keiler', 'ar_kv47', 'smg_vp9'], secondary: ['launcher'], lethal: 'semtex',
    build: ['sandsack', 'mulde'],
  },
  zielfernrohr: {
    id: 'zielfernrohr', name: 'Zielfernrohrschütze', short: 'ZF', cls: 'aufklaerer', max: [1, 1],
    text: 'Präzisionsgewehr mit Zielfernrohr, markiert Gegner länger.',
    weapons: ['sniper', 'marksman'], prefer: ['mr_sk14', 'sr_brecher', 'mr_elster'], secondary: ['pi_p9'], lethal: 'frag', tactical: 'smoke',
    build: ['sandsack', 'mulde'],
  },
  pionier: {
    id: 'pionier', name: 'Pionier', short: 'PIO', cls: 'pionier', max: [1, 2],
    text: 'Baut Bunker (Außenposten mit dem Truppführer), MG-Nester und Deckungen doppelt so schnell; Schrot oder MP.',
    weapons: ['shotgun', 'smg'], prefer: ['sg_bulldog', 'smg_keiler', 'sg_hagel'], secondary: ['pi_p9', 'pi_adler'], lethal: 'impact', tactical: 'smoke',
    build: ['sandsack', 'mulde', 'mgnest', 'bunker'],
  },
  besatzung: {
    id: 'besatzung', name: 'Fahrer/Besatzung', short: 'BES', cls: 'besatzung', max: [2, 4], crew: true,
    text: 'Darf gepanzerte Fahrzeuge und Luftfahrzeuge fahren und bedienen (andere Rollen nur als Mitfahrer).',
    weapons: ['smg'], prefer: ['smg_vp9', 'smg_qx90'], secondary: ['pi_p9'], lethal: 'frag', tactical: 'smoke',
    build: ['sandsack'],
  },
});
export const TRUPP_ROLE_ORDER = Object.freeze(['truppfuehrer', 'schuetze', 'sanitaeter', 'mg', 'panzerabwehr', 'zielfernrohr', 'pionier', 'besatzung']);
export const TRUPP_DEFAULT_ROLE = 'schuetze';

/** Höchstzahl einer Rolle in einem Trupp mit `size` Plätzen. */
export function roleLimit(roleId, size) {
  const r = TRUPP_ROLES[roleId];
  if (!r) return 0;
  return size >= 6 ? r.max[1] : r.max[0];
}

/** Bot-Rolle der Trupptaktik (bots/ai/squad.js) bzw. Klasse/Waffe → Truppenrolle. */
export function roleFromBot({ role, cls, primaryCls, secondaryCls } = {}) {
  if (cls === 'sanitaeter' || role === 'medic') return 'sanitaeter';
  if (cls === 'besatzung') return 'besatzung';
  if (primaryCls === 'lmg' || role === 'mg') return 'mg';
  if (secondaryCls === 'launcher') return 'panzerabwehr';
  if (primaryCls === 'sniper' || primaryCls === 'marksman' || role === 'marksman') return 'zielfernrohr';
  if (cls === 'pionier' || role === 'grenadier') return 'pionier';
  return 'schuetze';
}

/** Markierungen (Truppführer; „Feind gesichtet“ darf jedes Mitglied). life in s, max je Trupp. tone = HUD-Farbe. */
export const TRUPP_MARKS = Object.freeze({
  angriff: { id: 'angriff', name: 'Angriff', life: 180, max: 1, tone: 'enemy', order: 'attack', leader: true },
  verteidigen: { id: 'verteidigen', name: 'Verteidigen', life: 240, max: 1, tone: 'ally', order: 'defend', leader: true },
  bewegen: { id: 'bewegen', name: 'Bewegen', life: 150, max: 1, tone: 'signal', order: 'spread', leader: true },
  feind: { id: 'feind', name: 'Feind gesichtet', life: 25, max: 3, tone: 'warn', order: null, leader: false },
});
export const TRUPP_MARK_IDS = Object.freeze(Object.keys(TRUPP_MARKS));

/** Funksprüche (Text-Schnellbefehle). ch: 's' Truppfunk, 't' Teamfunk. {p} = nächster Frontpunkt. */
export const TRUPP_RADIO = Object.freeze({
  sani: { ch: 's', text: 'Brauche einen Sanitäter!' },
  muni: { ch: 's', text: 'Brauche Munition!' },
  ja: { ch: 's', text: 'Verstanden.' },
  nein: { ch: 's', text: 'Negativ.' },
  deckung: { ch: 's', text: 'Gebe Deckung – los!' },
  warten: { ch: 's', text: 'Warten, nicht vorrücken!' },
  danke: { ch: 's', text: 'Danke!' },
  sammeln: { ch: 's', text: 'Sammeln bei mir!' },
  hilfe: { ch: 't', text: 'Brauchen Verstärkung bei {p}!' },
  panzer: { ch: 't', text: 'Feindpanzer gesichtet!' },
  fahrzeug: { ch: 't', text: 'Brauchen ein Fahrzeug zum Vorrücken!' },
  angriff: { ch: 't', text: 'Wir greifen {p} an!' },
  halten: { ch: 't', text: 'Wir halten {p}!' },
  unterst: { ch: 't', text: 'Fordern Unterstützung an!' },
  luft: { ch: 't', text: 'Luftfahrzeug gesichtet!' },
  danke_t: { ch: 't', text: 'Danke für die Unterstützung!' },
});

/** Unterstützung des Kommandanten (je Team, Abklingzeit in s). */
export const TRUPP_SUPPORT = Object.freeze({
  artillerie: { id: 'artillerie', name: 'Artillerie', cooldown: 240, first: 90, shells: 10, radius: 22, delay: 4, spread: 18, dur: 8, maxDamage: 160, blast: 8 },
  luftschlag: { id: 'luftschlag', name: 'Luftschlag', cooldown: 300, first: 150, impacts: 5, spacing: 7, radius: 8, maxDamage: 210 },
});

/** Sammelpunkt / Außenposten. */
export const TRUPP_RALLY = Object.freeze({ uses: 9, cooldown: 60, overrunR: 12, overrunT: 3, blockR: 30, minFromEnemyPoint: 45 });
export const TRUPP_OUTPOST = Object.freeze({ max: 2, leaderR: 25, overrunR: 15, overrunT: 6 });

/** Bewusstlos: so lange kann ein Sanitäter wiederbeleben (s); Wiedereinstieg frühestens nach respawnDelay. */
export const TRUPP_DOWN_TIME = 40;

/** Verstärkungstickets je Seite nach Teamgröße (inkl. Spieler), × Matchlänge. Punktverlust kostet einen Anteil davon. */
export const TRUPP_TICKETS = Object.freeze([[8, 120], [16, 200], [24, 260], [32, 320], [50, 450], [100, 700], [250, 1400]]);
export const TRUPP_LOSS_SHARE = 0.06;
export function truppTickets(sideSize, mult = 1) {
  let t = TRUPP_TICKETS[TRUPP_TICKETS.length - 1][1];
  for (const [max, n] of TRUPP_TICKETS) if (sideSize <= max) { t = n; break; }
  return Math.max(10, Math.round(t * (mult || 1)));
}

/**
 * Front-Reihenfolge: list = Punkte [{ id, position: {x,z} }], hq = { A: {x,z}, B: {x,z} }, order = optionale Id-Liste.
 * → Liste in Reihenfolge HQ A → HQ B (unbekannte Ids der Liste werden übergangen, fehlende Punkte hinten nach Lage einsortiert).
 */
export function frontOrder(list, hq, order = null) {
  const pts = (list || []).filter((p) => p && p.position);
  if (!pts.length) return [];
  const ax = hq && hq.A ? hq.A.x : 0, az = hq && hq.A ? hq.A.z : 0;
  let dx = (hq && hq.B ? hq.B.x : 0) - ax, dz = (hq && hq.B ? hq.B.z : 0) - az;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;
  const key = (p) => (p.position.x - ax) * dx + (p.position.z - az) * dz;
  if (Array.isArray(order) && order.length) {
    const out = [];
    for (const id of order) { const p = pts.find((x) => x.id === id); if (p && !out.includes(p)) out.push(p); }
    if (out.length >= 2) return out;
  }
  return pts.slice().sort((a, b) => key(a) - key(b));
}

/** Nächster einnehmbarer Punkt je Team (Index) bei Besitzern owners[] ('A'|'B'|null) in Front-Reihenfolge. */
export function frontTargets(owners) {
  const n = owners.length;
  let a = 0;
  while (a < n && owners[a] === 'A') a++;
  let b = n - 1;
  while (b >= 0 && owners[b] === 'B') b--;
  return { A: a < n ? a : -1, B: b >= 0 ? b : -1 };
}
