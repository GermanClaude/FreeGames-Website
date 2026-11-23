/* NULLPUNKT — Zusatzwaffen des Battle-Royale-Modus (modes/br/*, 22.11.): fünf frei erfundene Waffen nach realen Bauarten, die
 * es im normalen Spiel nicht gibt. Sie stehen NICHT in WEAPON_IDS (keine Freischaltung, kein Arsenal, keine Lobby, keine
 * Bot-Ausrüstung): registerBrWeapons() trägt sie für die Dauer eines Matches in WEAPONS ein (BR, auf Wunsch auch der
 * Zombie-Modus), unregisterBrWeapons() nimmt sie beim Verlassen wieder heraus. Modelle: game/weapons/gunsmith/guns-br.js.
 *
 *   SM-12 Amboss   Schweres MG 12,7 mm aus der Hand (Gurtkasten 50, Zweibein): drei Treffer, durchschlägt fast jede Deckung,
 *                  sehr träge und laut.
 *   AS-20 Sturmflut Vollautomatische Flinte mit 20er-Trommel: 5 Schuss/s Schrot, auf Raumlänge verheerend.
 *   MT-95 Schwarm  Maschinenpistole 9 mm mit 95-Schuss-Doppeltrommel: hält den Abzug lange, schwer und langsam nachgeladen.
 *   AB-3 Sehne     Armbrust mit Rollen (Compound): lautloser Bolzen, Flugbahn mit Fall, ein Kopftreffer genügt.
 *   SV-9 Flüsterer Präzisionsgewehr mit Integralschalldämpfer, Unterschallpatrone: leise, 10 Schuss, 3-fach-Visier.
 *
 * Reine Daten + kleine Hilfen; importiert nur weapons.data.js (Rechenfunktionen). Werte folgen den Feldern dort (Kopfkommentar).
 */
import { computeStats, adsFovFor, HANDLING_BY_CLASS } from './weapons.data.js?v=20261123073102';

const SVG = (d) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 32" fill="none" stroke="currentColor" ' +
  `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

const PATTERN = {
  amboss: [[0, 1.4], [0.3, 1.3], [0.55, 1.15], [0.3, 1.05], [-0.2, 0.95], [-0.5, 0.9], [-0.25, 0.85], [0.3, 0.85]],
  sturmflut: [[0, 1], [0.4, 0.95], [-0.3, 0.95], [0.5, 0.9], [-0.5, 0.9], [0.3, 0.85]],
  schwarm: [[0, 1], [0.2, 0.95], [-0.25, 0.95], [0.35, 0.9], [-0.3, 0.9], [0.25, 0.85], [-0.2, 0.85], [0.3, 0.85]],
};

/** Gemeinsame Kennzeichen: nur als Beute (brOnly), nie in Freischaltungen, Bots tragen sie nur, wenn sie sie finden. */
const BR = { brOnly: true, unlockLevel: 999, botWeight: 0 };

export const BR_WEAPONS_RAW = {
  hmg_amboss: {
    ...BR, id: 'hmg_amboss', name: 'SM-12 Amboss', cls: 'lmg', slot: 'primary', rarity: 'selten',
    description: 'Schweres Maschinengewehr im Kaliber 12,7 mm, für den Einsatz aus der Hand umgebaut: Gurtkasten mit fünfzig Patronen, Zweibein, Tragegriff. Drei Treffer genügen, Deckung aus Holz, Blech und Ziegel hält nicht – dafür trägt man vierzehn Kilo und jeder Feuerstoß reißt die Mündung hoch.',
    damage: { max: 46, min: 38, rangeStart: 40, rangeEnd: 95 }, headMult: 1.4, limbMult: 0.9, pellets: 1,
    rpm: 480, fireMode: 'auto', burstCount: 1, mag: 50, reserve: 50, killAmmo: 15,
    reloadTime: 7.0, reloadEmptyTime: 8.0, perShellReload: false,
    equipTime: 1.2, adsTime: 0.55, adsZoom: 1.25, sight: 'iron', scope: null, sprintToFire: 0.5,
    moveSpeedMult: 0.74, adsMoveMult: 0.4, hipSpread: 0.085, adsSpread: 0.0042, moveSpreadMult: 1.8, jumpSpreadMult: 3.2,
    recoil: { vertical: 0.012, horizontal: 0.0062, recovery: 6, firstShotMult: 1.4, pattern: PATTERN.amboss, visual: 1.2, firstShotSpread: 0.9 },
    handling: { ...HANDLING_BY_CLASS.lmg, mass: 14.5, inertia: 2.0, swayScale: 1.35, aimDrift: 0.0011, reach: 1.32 },
    range: 160, penetration: 0.95, antiMateriel: true, caliber: '50bmg', suppressed: false,
    sound: { profile: 'lmg', pitch: 0.82, cal: '.50bmg' }, model: 'amboss', attSlots: [],
  },
  sg_sturmflut: {
    ...BR, id: 'sg_sturmflut', name: 'AS-20 Sturmflut', cls: 'shotgun', slot: 'primary', rarity: 'selten',
    description: 'Vollautomatische Flinte mit Gasdrucklader und Trommel für zwanzig Schrotpatronen. Fünf Schuss in der Sekunde räumen jeden Flur – jenseits von fünfzehn Metern bleibt nur Lärm, und die volle Trommel wiegt wie ein Ziegelstein.',
    damage: { max: 11, min: 3, rangeStart: 4, rangeEnd: 15 }, headMult: 1.1, limbMult: 0.9, pellets: 8,
    rpm: 300, fireMode: 'auto', burstCount: 1, mag: 20, reserve: 20, killAmmo: 8,
    reloadTime: 3.6, reloadEmptyTime: 4.3, perShellReload: false,
    equipTime: 0.75, adsTime: 0.3, adsZoom: 1.15, sight: 'iron', scope: null, sprintToFire: 0.22,
    moveSpeedMult: 0.92, adsMoveMult: 0.62, hipSpread: 0.064, adsSpread: 0.05, moveSpreadMult: 1.15, jumpSpreadMult: 1.7,
    recoil: { vertical: 0.028, horizontal: 0.012, recovery: 7, firstShotMult: 1.0, pattern: PATTERN.sturmflut, visual: 1.05, firstShotSpread: 1 },
    handling: { ...HANDLING_BY_CLASS.shotgun, mass: 5.6, inertia: 1.2, swayScale: 1.08, aimDrift: 0.0005, reach: 0.98 },
    range: 30, penetration: 0.15, suppressed: false, sound: { profile: 'shotgun', pitch: 1.05 }, model: 'sturmflut', attSlots: [],
  },
  smg_schwarm: {
    ...BR, id: 'smg_schwarm', name: 'MT-95 Schwarm', cls: 'smg', slot: 'primary', rarity: 'selten',
    description: 'Maschinenpistole im Kaliber 9 mm mit Doppeltrommel für fünfundneunzig Patronen. Wer den Abzug hält, hält ihn lange; die volle Trommel macht sie kopflastig, und der Wechsel dauert, bis jemand anders zuerst schießt.',
    damage: { max: 22, min: 14, rangeStart: 12, rangeEnd: 26 }, headMult: 1.3, limbMult: 0.9, pellets: 1,
    rpm: 880, fireMode: 'auto', burstCount: 1, mag: 95, reserve: 95, killAmmo: 30,
    reloadTime: 3.8, reloadEmptyTime: 4.5, perShellReload: false,
    equipTime: 0.6, adsTime: 0.24, adsZoom: 1.2, sight: 'iron', scope: null, sprintToFire: 0.16,
    moveSpeedMult: 0.95, adsMoveMult: 0.68, hipSpread: 0.036, adsSpread: 0.0042, moveSpreadMult: 1.3, jumpSpreadMult: 2.1,
    recoil: { vertical: 0.0047, horizontal: 0.0036, recovery: 11, firstShotMult: 1.0, pattern: PATTERN.schwarm, visual: 0.95, firstShotSpread: 0.85 },
    handling: { ...HANDLING_BY_CLASS.smg, mass: 4.6, inertia: 1.0, swayScale: 0.98, aimDrift: 0.00045, reach: 0.72 },
    range: 85, penetration: 0.35, suppressed: false, sound: { profile: 'smg', pitch: 0.97 }, model: 'schwarm', attSlots: [],
  },
  xb_sehne: {
    ...BR, id: 'xb_sehne', name: 'AB-3 Sehne', cls: 'marksman', slot: 'primary', rarity: 'selten',
    description: 'Armbrust mit Umlenkrollen und Spannhilfe: Ein Bolzen, kein Knall, kein Mündungsfeuer. Der Bolzen fliegt sichtbar im Bogen – wer den Fall einrechnet, trifft lautlos bis weit über fünfzig Meter, ein Kopftreffer genügt immer.',
    // damage = Bolzentreffer am Körper (Werte/Website); Wirkung über projectile (ballistics/rockets.js, bolt: true)
    damage: { max: 95, min: 80, rangeStart: 0, rangeEnd: 90 }, headMult: 2.2, limbMult: 0.75, pellets: 1,
    rpm: 30, fireMode: 'single', burstCount: 1, mag: 1, reserve: 8, killAmmo: 2,
    reloadTime: 2.8, reloadEmptyTime: 2.8, perShellReload: false,
    equipTime: 0.7, adsTime: 0.34, adsZoom: 2.0, sight: 'acog', scope: { zoom: 2.0, overlay: 'acog' }, sprintToFire: 0.3,
    moveSpeedMult: 0.96, adsMoveMult: 0.55, hipSpread: 0.05, adsSpread: 0.0012, moveSpreadMult: 1.7, jumpSpreadMult: 2.8,
    recoil: { vertical: 0.012, horizontal: 0.004, recovery: 6, firstShotMult: 1.0, visual: 0.7, firstShotSpread: 1 },
    handling: { ...HANDLING_BY_CLASS.marksman, mass: 3.9, inertia: 1.1, swayScale: 1.05, aimDrift: 0.0004, reach: 0.78 },
    projectile: { kind: 'bolt', bolt: true, mesh: 'bolzen', speed: 105, cruise: 105, boost: 0, gravity: 6, life: 4, armDistance: 0, actorDamage: 95, vehicleDamage: 2 },
    range: 140, penetration: 0, suppressed: true, sound: { profile: 'pistol', pitch: 1.9, cal: '.45acp' }, model: 'sehne', attSlots: [],
  },
  mr_fluester: {
    ...BR, id: 'mr_fluester', name: 'SV-9 Flüsterer', cls: 'marksman', slot: 'primary', rarity: 'selten',
    description: 'Halbautomatisches Präzisionsgewehr mit Schalldämpfer über die ganze Lauflänge und schwerer Unterschallpatrone. Kaum hörbar, kein Mündungsfeuer, 3-fach-Visier – drei Treffer am Körper, Kopf und Brust genügen.',
    damage: { max: 44, min: 34, rangeStart: 20, rangeEnd: 60 }, headMult: 1.8, limbMult: 0.85, pellets: 1,
    rpm: 330, fireMode: 'semi', burstCount: 1, mag: 10, reserve: 30, killAmmo: 10,
    reloadTime: 2.2, reloadEmptyTime: 2.8, perShellReload: false,
    equipTime: 0.6, adsTime: 0.28, adsZoom: 3.0, sight: 'acog', scope: { zoom: 3.0, overlay: 'acog' }, sprintToFire: 0.22,
    moveSpeedMult: 0.95, adsMoveMult: 0.6, hipSpread: 0.06, adsSpread: 0.001, moveSpreadMult: 1.7, jumpSpreadMult: 2.6,
    recoil: { vertical: 0.017, horizontal: 0.005, recovery: 9, firstShotMult: 1.0, visual: 0.85, firstShotSpread: 0.7 }, scopeSway: 0.0018,
    handling: { ...HANDLING_BY_CLASS.marksman, mass: 3.2, inertia: 1.0, swayScale: 1.0, aimDrift: 0.0004, reach: 0.9 },
    range: 120, penetration: 0.6, caliber: '762x39', suppressed: true, sound: { profile: 'smg', pitch: 0.82, cal: '7.62x39' }, model: 'fluester', attSlots: [],
  },
};

const ICONS = {
  amboss: SVG('M4 12L24 11V19L6 23Z M24 9H50V19H24Z M28 6H44V9 M50 11H86V16H50Z M54 10V17 M60 10V17 M66 10V17 M72 10V17 M86 12H93V15H86Z ' +
    'M30 19L28 27H34L36 19 M38 19V28H48V19 M78 16L73 27 M78 16L83 27'),
  sturmflut: SVG('M4 13L22 11V18L6 22Z M22 10H50V18H22Z M26 18L24 25H30L32 18 M36 18A7 7 0 1 0 36 31.5A7 7 0 1 0 36 18 M50 11H86V15H50Z M50 15.5H70V18H50Z M86 11.5H91V14.5H86Z M30 10V7H36'),
  schwarm: SVG('M4 12H8V21H4Z M8 13H18 M8 19L18 16 M18 10H56V17H18Z M24 17L22 25H28L30 17 M34 17A6 6 0 1 0 34 29A6 6 0 1 0 34 17 M44 17A6 6 0 1 0 44 29A6 6 0 1 0 44 17 M56 11H78V15H56Z M78 12H84'),
  sehne: SVG('M4 14L24 12V18L6 22Z M24 12H66V16H24Z M30 16L28 23H34L36 16 M62 4L66 14L62 26 M62 4Q56 14 62 26 M60 6L30 14L60 24 M66 14H90 M90 12.5L93 14L90 15.5 M40 12V8H52V12'),
  fluester: SVG('M4 12L24 10V19L6 24Z M24 10H44V18H24Z M30 18L28 26H34L36 18 M38 18V27H43V18 M44 11H90V17H44Z M50 11V17 M70 11V17 M28 10V6H48V10 M32 6V3H44V6'),
};

export const BR_WEAPON_IDS = Object.keys(BR_WEAPONS_RAW);

/** Fertige Definitionen (wie WEAPONS-Einträge: adsFov, icon, stats). */
export const BR_WEAPONS = {};
for (const id of BR_WEAPON_IDS) {
  const def = BR_WEAPONS_RAW[id];
  def.adsFov = Math.round(adsFovFor(def) * 10) / 10;
  def.icon = ICONS[def.model];
  def.stats = computeStats(def);
  BR_WEAPONS[id] = def;
}

/** Waffen in die Waffentabelle eintragen (idempotent). → Liste der Ids */
export function registerBrWeapons(WEAPONS) {
  if (!WEAPONS) return [];
  for (const id of BR_WEAPON_IDS) if (!WEAPONS[id]) WEAPONS[id] = BR_WEAPONS[id];
  return BR_WEAPON_IDS.slice();
}

/** Wieder austragen (Match-Ende): danach sehen Lobby, Pausenmenü und Bot-Ausrüstung sie nicht mehr. */
export function unregisterBrWeapons(WEAPONS) {
  if (!WEAPONS) return;
  for (const id of BR_WEAPON_IDS) if (WEAPONS[id] === BR_WEAPONS[id]) delete WEAPONS[id];
}

export const isBrWeapon = (id) => !!BR_WEAPONS[id];
