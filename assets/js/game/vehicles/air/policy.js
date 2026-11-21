// NULLPUNKT — Regeln für Luftfahrzeuge (Nutzer 20.11.: „NPCs sollen keine Helikopter und keine Jets benutzen“ und „für
// Jets und Helikopter einen extra Platz als Spawn-Option – als nächste Klasse“). Reine Logik ohne three.js (Node-Test:
// scratchpad, VehicleSystem.enter/switchSeat, Host-Prüfung der Client-Anfragen in vehicles/net.js).
//
//   - Bots besteigen KEIN Luftfahrzeug (weder Pilot noch Bordschütze noch Truppenraum) – in keinem Team, keinem Modus.
//     Ausnahme: skriptgesteuerte Kampagnen-Figuren (Modus 'kampagne') und ausdrücklich freigegebene KI-Piloten
//     (actor._airScript, nur air.pilotBot – im normalen Spiel ausgeschaltet, ?airbots=1|2 nur zum Testen).
//   - Den Pilotensitz (seat.def.drive) eines Luftfahrzeugs übernimmt nur ein Mensch der Klasse „Pilot“. Andere Menschen
//     dürfen im Hubschrauber als Bordschütze oder im Truppenraum mitfliegen; der Jet hat nur den Pilotensitz.
//   - Modi mit eigenen Fahrzeugregeln (Kampagne, Schießstand/Ausbildung, Trupp: Rolle Fahrer/Besatzung) sind ausgenommen.

export const PILOT_CLASS = 'pilot';
/** Modi, in denen Missionsskripte Bots (Story-Piloten) in Luftfahrzeuge setzen dürfen. */
export const SCRIPTED_AIR_MODES = Object.freeze(['kampagne']);
/** Modi ohne Klassenregel für Menschen (eigene Sitzregeln bzw. Pflicht-Abschnitte der Kampagne). */
export const FREE_AIR_MODES = Object.freeze(['kampagne', 'training', 'trupp']);

export const isAirDef = (def) => !!(def && def.air);
export const isAirVehicle = (v) => !!(v && (v.isAircraft || isAirDef(v.def)));
export const isHumanActor = (a) => !!(a && (a.isPlayer || a.isRemoteHuman));

/** Klasse eines Akteurs (Spieler, Puppe eines entfernten Spielers, Bot). */
export function actorClass(a) {
  if (!a) return null;
  return a.cls || (a.loadout && a.loadout.cls) || (a.classDef && a.classDef.id) || null;
}
export const isPilot = (a) => actorClass(a) === PILOT_CLASS;

/** Kontext aus der Modus-Id (G.match.modeId). */
export function airContext(modeId) {
  return { scripted: SCRIPTED_AIR_MODES.includes(modeId), free: FREE_AIR_MODES.includes(modeId) };
}

/** Darf ein Bot dieses Fahrzeug (Definition) besteigen? Luftfahrzeuge nur skriptgesteuert. */
export function botMayBoard(def, ctx = {}, actor = null) {
  if (!isAirDef(def)) return true;
  return !!(ctx.scripted || (actor && actor._airScript));
}

/** Fahrzeugwahl der Bots (Transporter, Trupp, Einsatz): Luftfahrzeuge herausfiltern. list: Fahrzeuge oder Definitionen. */
export function botVehicleChoices(list, ctx = {}) {
  return (list || []).filter((v) => v && botMayBoard(v.def || v, ctx));
}

/**
 * Sitz im Luftfahrzeug für einen Akteur (Semantik wie mode.vehicleSeatFor). want = gewünschter Sitz (null = beliebig),
 * idx = vorgeschlagener freier Sitz. → { idx, why } (idx −1 = abgelehnt; why: 'bot' | 'pilot')
 */
export function airSeatFor(actor, v, want, idx, ctx = {}) {
  if (!isAirVehicle(v) || idx == null || idx < 0) return { idx, why: null };
  if (!isHumanActor(actor)) return botMayBoard(v.def, ctx, actor) ? { idx, why: null } : { idx: -1, why: 'bot' };
  if (ctx.free || isPilot(actor)) return { idx, why: null };
  const seats = v.seats || [];
  const flies = (i) => !!(seats[i] && seats[i].def && seats[i].def.drive);
  if (want != null && want >= 0 && flies(want)) return { idx: -1, why: 'pilot' };
  if (!flies(idx)) return { idx, why: null };
  const other = seats.findIndex((s, i) => !s.actor && !flies(i));
  return other >= 0 ? { idx: other, why: null } : { idx: -1, why: 'pilot' };
}

/** Text zu einer Ablehnung (HUD/Netz). */
export const AIR_WHY = Object.freeze({
  pilot: 'Nur die Klasse Pilot fliegt Luftfahrzeuge',
  bot: 'Luftfahrzeuge fliegen nur Spieler',
});
