// NULLPUNKT — Trophäen (13.11.): dauerhafte Erfolge in den Stufen Bronze/Silber/Gold/Platin.
// Werte kommen aus dem Profil (profile.js: Summen, Medaillen, Zähler, Modus-Siege, Waffen-Statistik) und dem
// Trophäen-Speicher profile.trophies = { done: { id: Zeitstempel }, maps: { mapId: Matches }, best: { matchKills, win1000 } }.
// trophyStats(profil) leitet daraus alle Kennzahlen ab, trophyView(profil) liefert die Liste für Übersicht und Prüfung.
// Waffen-Trophäen (weapon: RegExp auf die Waffen-Id) erscheinen nur, wenn es eine passende Waffe gibt (z. B. Minigun).
// Platin „Nullpunkt“ zählt alle übrigen sichtbaren Trophäen.

import { MAP_ORDER } from './maps.data.js?v=20261123073102';
import { SECRETS } from './modes.data.js?v=20261123073102';
import { WEAPON_IDS } from './weapons.data.js?v=20261123073102';

export const TROPHY_TIERS = {
  bronze: { name: 'Bronze', rank: 1 },
  silber: { name: 'Silber', rank: 2 },
  gold: { name: 'Gold', rank: 3 },
  platin: { name: 'Platin', rank: 4 },
};

/** Karten für „Weltenbummler“ (ohne Schießstand). */
export const TROPHY_MAPS = MAP_ORDER.filter((id) => id !== 'range');

const medal = (p, id) => ((p.medals || {})[id] | 0);
const counter = (p, id) => ((p.counters || {})[id] | 0);
const modeWins = (p, id) => (((p.modeStats || {})[id] || {}).wins | 0);

/**
 * Trophäen: { id, name, text, tier, stat, goal, icon?, weapon? }. stat = Schlüssel aus trophyStats.
 * icon: Name aus ui/icons.js (Standard trophy).
 */
export const TROPHIES = [
  // Abschüsse
  { id: 'erster_abschuss', name: 'Feuertaufe', text: 'Erziele deinen ersten Abschuss.', tier: 'bronze', stat: 'kills', goal: 1 },
  { id: 'kills_100', name: 'Hundertschaft', text: 'Erziele 100 Abschüsse.', tier: 'bronze', stat: 'kills', goal: 100 },
  { id: 'kills_1000', name: 'Tausendsassa', text: 'Erziele 1.000 Abschüsse.', tier: 'silber', stat: 'kills', goal: 1000 },
  { id: 'kills_10000', name: 'Legende', text: 'Erziele 10.000 Abschüsse.', tier: 'gold', stat: 'kills', goal: 10000 },
  { id: 'match_100', name: 'Ein-Mann-Armee', text: 'Erziele 100 Abschüsse in einem einzigen Match.', tier: 'silber', stat: 'matchKills', goal: 100 },
  { id: 'win_1000', name: 'Tausend und eins', text: 'Gewinne ein Match mit einem Abschussziel von 1.000.', tier: 'gold', stat: 'win1000', goal: 1 },
  // Präzision
  { id: 'kopf_50', name: 'Scharfes Auge', text: '50 Abschüsse per Kopftreffer.', tier: 'bronze', stat: 'headshots', goal: 50 },
  { id: 'kopf_500', name: 'Kopfgeld', text: '500 Abschüsse per Kopftreffer.', tier: 'silber', stat: 'headshots', goal: 500 },
  { id: 'kopfjaeger_10', name: 'Trophäenjäger', text: 'Verdiene 10-mal die Medaille „Kopfjäger“.', tier: 'silber', stat: 'm_kopfjaeger', goal: 10 },
  { id: 'weit_150', name: 'Fernmelder', text: 'Ein Abschuss über mindestens 150 Meter.', tier: 'silber', stat: 'longestKill', goal: 150 },
  { id: 'weit_400', name: 'Auf eine Meile', text: 'Ein Abschuss über mindestens 400 Meter.', tier: 'gold', stat: 'longestKill', goal: 400 },
  { id: 'kollateral', name: 'Zwei auf einen Streich', text: 'Zwei Gegner mit einer einzigen Kugel.', tier: 'silber', stat: 'm_kollateral', goal: 1 },
  // Nahkampf und Sprengstoff
  { id: 'messer_10', name: 'Leise Klinge', text: '10 Abschüsse mit dem Messer.', tier: 'bronze', stat: 'm_nahkampf', goal: 10 },
  { id: 'messer_100', name: 'Klingenmeister', text: '100 Abschüsse mit dem Messer.', tier: 'gold', stat: 'm_nahkampf', goal: 100 },
  { id: 'granate_25', name: 'Werfer', text: '25 Abschüsse mit Granaten.', tier: 'bronze', stat: 'm_granate', goal: 25 },
  { id: 'fahrzeug_1', name: 'Panzerknacker', text: 'Zerstöre ein gegnerisches Fahrzeug.', tier: 'bronze', stat: 'vehicles', goal: 1 },
  { id: 'fahrzeug_50', name: 'Schrotthändler', text: 'Zerstöre 50 gegnerische Fahrzeuge.', tier: 'gold', stat: 'vehicles', goal: 50 },
  // Serien und Medaillen
  { id: 'serie_10', name: 'Unberührbar', text: 'Erreiche eine Serie von 10 Abschüssen.', tier: 'silber', stat: 'bestStreak', goal: 10 },
  { id: 'serie_25', name: 'Naturgewalt', text: 'Erreiche eine Serie von 25 Abschüssen.', tier: 'gold', stat: 'bestStreak', goal: 25 },
  { id: 'kahlschlag', name: 'Kahlschlag', text: 'Fünf Abschüsse in schneller Folge.', tier: 'gold', stat: 'm_kahlschlag', goal: 1 },
  { id: 'unaufhaltsam', name: 'Ohne Kratzer', text: 'Beende ein Match ohne einen Tod (mindestens fünf Abschüsse).', tier: 'gold', stat: 'm_unaufhaltsam', goal: 1 },
  { id: 'mvp_10', name: 'Spieler des Spiels', text: 'Werde 10-mal MVP.', tier: 'silber', stat: 'm_mvp', goal: 10 },
  { id: 'medaillen_100', name: 'Ordensträger', text: 'Verdiene 100 Medaillen.', tier: 'bronze', stat: 'medals', goal: 100 },
  { id: 'medaillen_1000', name: 'Ordensbrust', text: 'Verdiene 1.000 Medaillen.', tier: 'gold', stat: 'medals', goal: 1000 },
  // Siege und Modi
  { id: 'sieg_1', name: 'Erster Sieg', text: 'Gewinne ein Match.', tier: 'bronze', stat: 'wins', goal: 1 },
  { id: 'sieg_50', name: 'Siegertyp', text: 'Gewinne 50 Matches.', tier: 'silber', stat: 'wins', goal: 50 },
  { id: 'sieg_250', name: 'Feldherr', text: 'Gewinne 250 Matches.', tier: 'gold', stat: 'wins', goal: 250 },
  { id: 'tdm_10', name: 'Teamplayer', text: 'Gewinne 10 Matches Team-Deathmatch.', tier: 'bronze', stat: 'w_tdm', goal: 10 },
  { id: 'ffa_10', name: 'Einzelkämpfer', text: 'Gewinne 10 Matches Jeder gegen jeden.', tier: 'bronze', stat: 'w_ffa', goal: 10 },
  { id: 'dom_10', name: 'Flaggenherr', text: 'Gewinne 10 Matches Herrschaft.', tier: 'bronze', stat: 'w_dom', goal: 10 },
  { id: 'cq_5', name: 'Eroberer', text: 'Gewinne 5 Matches Eroberung.', tier: 'silber', stat: 'w_cq', goal: 5 },
  { id: 'modi_6', name: 'Allrounder', text: 'Gewinne in 6 verschiedenen Modi.', tier: 'gold', stat: 'modesWon', goal: 6 },
  { id: 'marken_100', name: 'Buchhalter', text: 'Sammle 100 Erkennungsmarken (Abschuss bestätigt).', tier: 'bronze', stat: 'confirms', goal: 100 },
  { id: 'infiziert_50', name: 'Seuche', text: 'Infiziere 50 Überlebende.', tier: 'bronze', stat: 'infects', goal: 50 },
  // Erfahrung
  { id: 'stufe_10', name: 'Gefreiter', text: 'Erreiche Stufe 10.', tier: 'bronze', stat: 'level', goal: 10 },
  { id: 'stufe_30', name: 'Unteroffizier', text: 'Erreiche Stufe 30.', tier: 'silber', stat: 'level', goal: 30 },
  { id: 'stufe_55', name: 'Höchststufe', text: 'Erreiche Stufe 55.', tier: 'gold', stat: 'level', goal: 55 },
  { id: 'spielzeit_10', name: 'Dienstzeit', text: 'Spiele insgesamt 10 Stunden.', tier: 'silber', stat: 'hours', goal: 10 },
  { id: 'karten', name: 'Weltenbummler', text: 'Spiele ein Match auf jeder Karte.', tier: 'silber', stat: 'maps', goal: TROPHY_MAPS.length },
  { id: 'geheimnis_1', name: 'Neugierig', text: 'Finde ein Geheimnis.', tier: 'bronze', stat: 'secrets', goal: 1 },
  { id: 'geheimnis_alle', name: 'Schatzsucher', text: 'Finde alle Geheimnisse.', tier: 'gold', stat: 'secrets', goal: Math.max(1, SECRETS.length) },
  { id: 'waffen_10', name: 'Waffennarr', text: 'Je 25 Abschüsse mit 10 verschiedenen Waffen.', tier: 'silber', stat: 'weapons25', goal: 10 },
  // Waffen-Trophäen (nur sichtbar, wenn die Waffe existiert)
  { id: 'minigun_250', name: 'Dauerfeuer', text: '250 Abschüsse mit der Minigun RG-6 Orkan.', tier: 'silber', stat: 'w:minigun', goal: 250, weapon: /minigun|gatling|orkan/i },
  // Platin
  { id: 'nullpunkt', name: 'Nullpunkt', text: 'Schalte alle anderen Trophäen frei.', tier: 'platin', stat: 'allOthers', goal: 0, icon: 'star' },
];

const weaponIdsFor = (re) => WEAPON_IDS.filter((id) => re.test(id));
/** Sichtbare Trophäen (Waffen-Trophäen nur mit passender Waffe). */
export function trophyList() {
  return TROPHIES.filter((t) => !t.weapon || weaponIdsFor(t.weapon).length > 0);
}

/** Alle Kennzahlen aus dem Profil (auch mit alten Profilen ohne trophies). */
export function trophyStats(p = {}) {
  const tr = (p.trophies && typeof p.trophies === 'object') ? p.trophies : {};
  const best = tr.best || {};
  const maps = tr.maps || {};
  const ws = p.weaponStats || {};
  const modeIds = Object.keys(p.modeStats || {}).filter((id) => id !== 'training' && modeWins(p, id) > 0);
  const out = {
    kills: p.kills | 0, headshots: p.headshots | 0, wins: p.wins | 0, bestStreak: p.bestStreak | 0,
    longestKill: Number(p.longestKill) || 0, level: p.level | 0, hours: (Number(p.playtime) || 0) / 3600,
    medals: Object.values(p.medals || {}).reduce((a, b) => a + (b | 0), 0),
    vehicles: counter(p, 'vehicles'), confirms: counter(p, 'confirms'), infects: counter(p, 'infects'),
    secrets: Object.keys(p.secrets || {}).length, maps: TROPHY_MAPS.filter((id) => (maps[id] | 0) > 0).length,
    matchKills: best.matchKills | 0, win1000: best.win1000 ? 1 : 0, modesWon: modeIds.length,
    weapons25: Object.values(ws).filter((w) => (w && w.kills | 0) >= 25).length,
  };
  for (const id of ['kopfjaeger', 'kollateral', 'nahkampf', 'granate', 'kahlschlag', 'unaufhaltsam', 'mvp']) out[`m_${id}`] = medal(p, id);
  for (const id of ['tdm', 'ffa', 'dom', 'cq']) out[`w_${id}`] = modeWins(p, id);
  for (const t of TROPHIES) {
    if (!t.weapon) continue;
    out[t.stat] = weaponIdsFor(t.weapon).reduce((a, id) => a + ((ws[id] && ws[id].kills) | 0), 0);
  }
  return out;
}

/**
 * Liste für Übersicht und Prüfung: [{ ...trophy, value, done, at, progress (0..1) }].
 * Erledigt = im Speicher vermerkt oder Ziel erreicht (rückwirkend für alte Profile).
 */
export function trophyView(p = {}) {
  const stats = trophyStats(p);
  const done = (p.trophies && p.trophies.done) || {};
  const list = trophyList();
  const rows = list.map((t) => {
    if (t.stat === 'allOthers') return null;
    const value = stats[t.stat] || 0;
    const ok = !!done[t.id] || value >= t.goal;
    return { ...t, value, done: ok, at: done[t.id] || 0, progress: ok ? 1 : Math.max(0, Math.min(1, value / t.goal)) };
  });
  const others = rows.filter(Boolean);
  const n = others.filter((r) => r.done).length;
  return list.map((t, i) => rows[i] || (() => {
    const ok = !!done[t.id] || n >= others.length;
    return { ...t, value: n, goal: others.length, done: ok, at: done[t.id] || 0, progress: ok ? 1 : n / Math.max(1, others.length) };
  })());
}

/** Neu erreichte Trophäen (noch nicht im Speicher). */
export function pendingTrophies(p = {}) {
  return trophyView(p).filter((r) => r.done && !r.at);
}
