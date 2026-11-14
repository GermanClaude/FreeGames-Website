// NULLPUNKT — Kampagne: Verzeichnis der spielbaren Missionen (Reihenfolge = Kampagne). Neue Missionen hier eintragen
// (und in ../outline.js den Status auf 'spielbar' setzen).

import { SPEAKERS } from './cast.js?v=20261114004313';
import { MISSION_1 } from './m1-funkstille.js?v=20261114004313';
import { MISSION_2 } from './m2-werk.js?v=20261114004313';
import { MISSION_3 } from './m3-fluss.js?v=20261114004313';

export const MISSION_ORDER = ['m1', 'm2', 'm3'];
export const MISSIONS = { m1: MISSION_1, m2: MISSION_2, m3: MISSION_3 };
for (const m of Object.values(MISSIONS)) m.speakers = SPEAKERS;

export function missionById(id) { return (id && MISSIONS[id]) || null; }
export { SPEAKERS };
