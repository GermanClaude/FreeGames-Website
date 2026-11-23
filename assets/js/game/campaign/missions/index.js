// NULLPUNKT — Kampagne: Verzeichnis der spielbaren Missionen. Die Reihenfolge der Kampagne kommt aus ../outline.js
// (OUTLINE); hier stehen nur die vorhandenen Missionsdateien. Neue Mission: EINE Import-Zeile und EINE Zeile in EXTRA.

import { SPEAKERS } from './cast.js?v=20261123115551';
import { OUTLINE } from '../outline.js?v=20261123115551';
import { MISSION_0 } from './m0-ausbildung.js?v=20261123115551';
import { MISSION_1 } from './m1-funkstille.js?v=20261123115551';
import { MISSION_2 } from './m2-werk.js?v=20261123115551';
import { MISSION_3 } from './m3-fluss.js?v=20261123115551';
import { MISSION_4 } from './m4-hafennacht.js?v=20261123115551';
import { MISSION_5 } from './m5-archiv.js?v=20261123115551';
import { MISSION_6 } from './m6-feuerlinie.js?v=20261123115551';
// --- kampagne-b: Importe M7–M11 hier (je eine Zeile) ---
import { MISSION_7 } from './m7-niemandsland.js?v=20261123115551';
import { MISSION_8 } from './m8-geleit.js?v=20261123115551';
import { MISSION_9 } from './m9-glockenschlag.js?v=20261123115551';
import { MISSION_10 } from './m10-rollfeld.js?v=20261123115551';
import { MISSION_11 } from './m11-stadtkern.js?v=20261123115551';
// --- kamp3: Akt III (M12–M15) ---
import { MISSION_12 } from './m12-nachtsicht.js?v=20261123115551';
import { MISSION_13 } from './m13-weitblick.js?v=20261123115551';
import { MISSION_14 } from './m14-grabenlinie.js?v=20261123115551';
import { MISSION_15 } from './m15-kranichflug.js?v=20261123115551';

const LIST = [
  MISSION_0, MISSION_1, MISSION_2, MISSION_3, MISSION_4, MISSION_5, MISSION_6,
];
// --- kampagne-b: Missionen M7–M11 hier in EXTRA eintragen (je eine Zeile, z. B. MISSION_7,) ---
const EXTRA = [
  MISSION_7,
  MISSION_8,
  MISSION_9,
  MISSION_10,
  MISSION_11,
  MISSION_12,
  MISSION_13,
  MISSION_14,
  MISSION_15,
];

export const MISSIONS = {};
for (const m of [...LIST, ...EXTRA]) if (m && m.id) { MISSIONS[m.id] = m; m.speakers = SPEAKERS; }

/** Spielbare Missionen in Kampagnenreihenfolge (outline.js; danach Missionen ohne Gliederungseintrag nach Nummer). */
export const MISSION_ORDER = [
  ...OUTLINE.map((o) => o.id).filter((id) => MISSIONS[id]),
  ...Object.values(MISSIONS).filter((m) => !OUTLINE.some((o) => o.id === m.id)).sort((a, b) => a.number - b.number).map((m) => m.id),
];
/** Missionen der Geschichte (ohne Ausbildung) – Freischaltung der Reihe nach. */
export const STORY_ORDER = MISSION_ORDER.filter((id) => !MISSIONS[id].tutorial);

export function missionById(id) { return (id && MISSIONS[id]) || null; }
export { SPEAKERS };
