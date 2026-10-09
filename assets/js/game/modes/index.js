// NULLPUNKT — Modus-Fabrik (§9): createMode(G, modeId, opts) → Mode.
// tdm Team-Deathmatch · ffa Jeder gegen jeden · dom Herrschaft · gun Waffenspiel · training Schießstand ·
// cq Eroberung (Tickets, Trupps, Einsatzkarte) · kc Abschuss bestätigt · inf Infiziert.
// Gemeinsame API siehe base.js; Bot-Schnittstelle (objectives, objectiveFor, streaks) im Changelog.

import { MODES } from '../../shared/modes.data.js?v=20261009171007';
import { BaseMode } from './base.js?v=20261009171007';
import { TdmMode } from './tdm.js?v=20261009171007';
import { FfaMode } from './ffa.js?v=20261009171007';
import { DomMode } from './dom.js?v=20261009171007';
import { GunMode } from './gun.js?v=20261009171007';
import { TrainingMode } from './training.js?v=20261009171007';
import { ConquestMode } from './conquest.js?v=20261009171007';
import { KillConfirmedMode } from './killconfirmed.js?v=20261009171007';
import { InfectedMode } from './infected.js?v=20261009171007';

export const MODE_CLASSES = { tdm: TdmMode, ffa: FfaMode, dom: DomMode, gun: GunMode, training: TrainingMode, cq: ConquestMode, kc: KillConfirmedMode, inf: InfectedMode };

export function createMode(G, modeId, opts = {}) {
  const Cls = MODE_CLASSES[modeId];
  if (Cls) return new Cls(G, modeId, opts);
  // Unbekannter Modus: nach Datenlage Team- oder Einzelwertung
  const def = MODES[modeId];
  return def && def.teams === false ? new FfaMode(G, modeId, opts) : new TdmMode(G, modeId, opts);
}

export { BaseMode, TdmMode, FfaMode, DomMode, GunMode, TrainingMode, ConquestMode, KillConfirmedMode, InfectedMode };
export { SquadSystem } from './squads.js?v=20261009171007';
export { chooseSpawn } from './spawns.js?v=20261009171007';
export { StreakManager } from './streaks.js?v=20261009171007';
