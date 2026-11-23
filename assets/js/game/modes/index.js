// NULLPUNKT — Modus-Fabrik (§9): createMode(G, modeId, opts) → Mode.
// tdm Team-Deathmatch · ffa Jeder gegen jeden · dom Herrschaft · gun Waffenspiel · training Schießstand ·
// cq Eroberung (Tickets, Trupps, Einsatzkarte) · kc Abschuss bestätigt · inf Infiziert · messer Nur Messer ·
// hp Stellung (wandernde Zone, 26.10.) · trupp Trupp (eigener KI-Trupp, Front in Reihenfolge, 20.11.) ·
// br Battle Royale (Solo gegen Bots, schrumpfende Zone, Beute, kein Wiedereinstieg, 22.11.).
// Gemeinsame API siehe base.js; Bot-Schnittstelle (objectives, objectiveFor, streaks) im Changelog.

import { MODES } from '../../shared/modes.data.js?v=20261123073102';
import { BaseMode } from './base.js?v=20261123073102';
import { TdmMode } from './tdm.js?v=20261123073102';
import { FfaMode } from './ffa.js?v=20261123073102';
import { DomMode } from './dom.js?v=20261123073102';
import { GunMode } from './gun.js?v=20261123073102';
import { TrainingMode } from './training.js?v=20261123073102';
import { ConquestMode } from './conquest.js?v=20261123073102';
import { KillConfirmedMode } from './killconfirmed.js?v=20261123073102';
import { InfectedMode } from './infected.js?v=20261123073102';
import { UltimateMode } from './ultimate.js?v=20261123073102';
import { KnifeMode } from './knife.js?v=20261123073102';
import { HoldPointMode } from './hp.js?v=20261123073102';
import { TruppMode } from './trupp.js?v=20261123073102'; // Trupp: eigener KI-Trupp, Front-Eroberung (20.11.)
import { BattleRoyaleMode } from './br/br.js?v=20261123073102'; // Battle Royale: Solo gegen Bots, Zone, Beute (22.11., modes/br/*)
import { ZombieMode } from './zombie.js?v=20261123073102'; // Zombies: Wellen-Überleben gegen Untote (offline, 22.11.)
import { CampaignMode, campaignConditions as infantryConditions } from '../campaign/mode.js?v=20261123073102'; // Kampagne „Stille Grenze“ (game/campaign/*)
import { PanzerMode } from './panzer.js?v=20261123073102'; // Panzersimulation (vehicles/psim/*)
import { PanzerCampaignMode } from '../campaign/panzer/mode.js?v=20261123073102'; // Panzer-Kampagne „Eisenwind“ (Missionen p1…p6)
import { pzMission } from '../campaign/panzer/missions.js?v=20261123073102';

export const MODE_CLASSES = { tdm: TdmMode, ffa: FfaMode, dom: DomMode, gun: GunMode, training: TrainingMode, cq: ConquestMode, kc: KillConfirmedMode, inf: InfectedMode, zombie: ZombieMode, messer: KnifeMode, ult: UltimateMode, hp: HoldPointMode, trupp: TruppMode, br: BattleRoyaleMode, kampagne: CampaignMode, panzer: PanzerMode };

export function createMode(G, modeId, opts = {}) {
  // Panzer-Kampagne: läuft unter „kampagne“ (Karte/Wetter/Checkpoint wie die Infanterie-Kampagne), Missions-Ids p1…p6
  if (modeId === 'kampagne' && opts.campaign && pzMission(opts.campaign.mission)) return new PanzerCampaignMode(G, modeId, opts);
  const Cls = MODE_CLASSES[modeId];
  if (Cls) return new Cls(G, modeId, opts);
  // Unbekannter Modus: nach Datenlage Team- oder Einzelwertung
  const def = MODES[modeId];
  return def && def.teams === false ? new FfaMode(G, modeId, opts) : new TdmMode(G, modeId, opts);
}

export { BaseMode, TdmMode, FfaMode, DomMode, GunMode, TrainingMode, ConquestMode, KillConfirmedMode, InfectedMode, KnifeMode, HoldPointMode };
/** kamp3: Tageszeit/Wetter der Mission (main.js startMatch) – auch für die Panzer-Kampagne. */
export function campaignConditions(missionId) {
  const pm = pzMission(missionId);
  if (pm) return { time: pm.time || null, weather: pm.weather || null };
  return infantryConditions(missionId);
}
export { SquadSystem } from './squads.js?v=20261123073102';
export { chooseSpawn } from './spawns.js?v=20261123073102';
export { StreakManager } from './streaks.js?v=20261123073102';
