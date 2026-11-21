// NULLPUNKT — Weitere Panzer und Truppentransporter (Nutzer 20.11.: „mehr schwere und leichte Panzer, simple unbewaffnete
// und bewaffnete Fahrzeuge zum Truppentransport“). Reine Daten wie data.js (wird dort angehängt; Kennungen hinten an
// VEHICLE_IDS → Netz-Typindex 16 ff., Fahrzeugblock 6 Bit). Alle Namen und Fahrzeuge frei erfunden, Bauart je Gattung
// und Epoche plausibel (keine Nachbauten realer Modelle).
//
//   Leichte Panzer   LP-21 Gämse   (lp21, modern)  luftverlastbarer Leichtpanzer, 105-mm-Kanone, Wärmebild, 4 Mann
//                    LP-39 Frettchen (wk2l, 2. WK) genieteter Leichtpanzer, 37-mm-Kanone, Bug-MG, 4 Mann
//   Schwere Panzer   SP-45 Walross (wk2s, 2. WK)   stark geneigte Platten, lange 88-mm-Kanone, Schachtellaufwerk, 5 Mann
//                    SP-58 Mastodon (kks, K. Krieg) Gussturm, gezogene 120-mm-Kanone, Kuppel-MG, 4 Mann
//   Unbewaffnet      LKW-5 Ackergaul (lkw)  6×6-Lkw mit Plane, 2 + 8 Sitze (Bänke unter der Plane)
//                    GMW-6 Murmel    (gmw)  geländegängiger Mannschaftswagen 4×4, Doppelkabine, offene Ladefläche, 2 + 6
//                    ZK-8 Packesel   (hkw)  ungepanzerter Halbkettenwagen (2. WK), drei Sitzreihen + Heckbank, 10 Sitze
//   Bewaffnet        RS-8 Waran      (rsp)  Radschützenpanzer 8×8, 30-mm-Turm, Heckrampe, 3 + 8
//                    MTW-13 Kröte    (mtw)  Ketten-Mannschaftstransportwagen, offenes .50-MG an der Kuppel, Heckrampe, 2 + 8
//                    GW-7 Steinbock  (gwmg) Geländewagen mit MG-Ring über der Ladefläche, 5 Sitze
//                    SPW-41 Hamster  (spw)  Schützenpanzerwagen (Halbkette, 2. WK) mit MG-Schild, offen, 3 + 7
//
// Neue Felder (Auswertung vehicles/index.js, vehicle.js, models.js, ride.js):
//   transport: true        Truppentransporter (Bot-Fahrten ride.js, Lobby-Text)
//   halftrack: true        Halbkette: vorn gelenkte Räder, hinten Kettenlaufwerk (Simulation als Radfahrzeug mit drei
//                          Hinterachsen unter der Kette, Kettenband läuft mit der Fahrgeschwindigkeit)
//   ramp: { … }            Heckrampe/Hecktüren (Modell öffnet sie beim Auf-/Absitzen im Stand)
//   mgYaw: [min, max]      Schwenkbereich der 'mg'-Lafette (MG-Schild vorn), sonst rundum
//   Sicht fireOut: true    Mitfahrer feuert mit der eigenen Infanteriewaffe (offene Ladefläche, Dachluke), crouch: true
//                          = geduckt sitzende Figur in offenen Sitzen
//   noCabin / noTurretInterior: kein Panzer-Innenraum (cabin.js) – eigener Kampfraum aus dem Modellbauer (hullInterior)
// Rollen-Stellplätze der Karten (kind 'truck' | 'utility' | 'apc' | 'apc2' | 'gwmg' | 'light' | 'heavy') wählen den Typ
// je Panzergeneration (ROLE_TYPES, transportTypeFor) – auch für die neue Großkarte.

const deg = (d) => (d * Math.PI) / 180;
const PI = Math.PI;

/* ---------------------------------------------------------------- Bausteine */

const TANK_RR = { concrete: 0.03, tile: 0.03, wood: 0.035, metal: 0.03, dirt: 0.045, grass: 0.05, sand: 0.08, default: 0.04 };
const TANK_TR = { concrete: 0.75, tile: 0.7, wood: 0.6, metal: 0.55, dirt: 0.85, grass: 0.7, sand: 0.6, default: 0.8 };
const CAR_RR = { concrete: 0.014, tile: 0.015, wood: 0.02, metal: 0.015, dirt: 0.032, grass: 0.042, sand: 0.08, default: 0.022 };
const OFF_TR = { concrete: 1.0, tile: 0.95, wood: 0.85, metal: 0.8, dirt: 0.85, grass: 0.75, sand: 0.65, default: 0.9 };
const HT_TR = { concrete: 0.95, tile: 0.9, wood: 0.8, metal: 0.75, dirt: 0.95, grass: 0.85, sand: 0.8, default: 0.92 };
const MBT_TQ = [[600, 2200], [700, 2700], [1000, 3800], [1400, 4550], [1700, 4700], [2000, 4600], [2300, 4350], [2600, 4040], [2750, 0]];
const WW2_TQ = [[500, 1450], [600, 1700], [1000, 2150], [1600, 2400], [2200, 2400], [2600, 2280], [3000, 2080], [3150, 0]];
const TRUCK_TQ = [[500, 1200], [600, 1500], [1000, 2300], [1400, 2300], [1700, 2100], [1900, 1800], [2100, 0]];
const tq = (pts, k) => pts.map(([r, t]) => [r, Math.round(t * k)]);
const GEARS_TANK = { '-2': 2.55, '-1': 5.9, 1: 6.4, 2: 4.1, 3: 2.6, 4: 1.65, 5: 1.05 };

/** Außenansicht (Ansicht 'aussen'); look 'mount' folgt der Lafette. */
const out = (dist, height, pivot, look = 'rel') => (look === 'mount'
  ? { id: 'aussen', label: 'Außenansicht', look, zoom: [1], tp: { dist, height, pivot } }
  : { id: 'aussen', label: 'Außenansicht', look, yaw: [-3.1, 3.1], pitch: [-0.7, 0.75], zoom: [1], tp: { dist, height, pivot } });
const TURRET_IN = (pos, extra = {}) => ({ id: 'innen', label: 'Turm innen', space: 'turret', pos, look: 'relTurret', yaw: [-PI, PI], pitch: [-0.9, 0.5], zoom: [1], interior: true, ...extra });

/** Tankkettenantrieb (Kennwerte wie data.js): Drehmomentkurve, Achsübersetzung, Triebradradius, Bremse, Kennwerte. */
function tankEngine({ curve, k, rated = 2600, idle = 700, F, r = 0.3, brake, turn = 0.8, turnM = 0.62, lat = 4.4, vmax, vrev, air = 3.4, drag = 14000, conv = 1.75, lag = 0.25, shift = 0.5 }) {
  return {
    idleRpm: idle, ratedRpm: rated, cutRpm: Math.round(rated * 1.055), cruiseRpm: Math.round(rated * 0.87), torque: tq(curve, k),
    gears: GEARS_TANK, finalDrive: F, sprocketR: r, efficiency: 0.74, rotInertia: 1.15,
    converter: { stallRpm: Math.round(rated * 0.56), mult: conv, coupleRpm: Math.round(rated * 0.54) }, torqueLag: lag, shiftTime: shift,
    autoUp: Math.round(rated * 0.94), autoDown: Math.round(rated * 0.48),
    engineBrake: [250, 0.3], rollRes: TANK_RR, traction: TANK_TR, airRes: air, neutralDrag: drag,
    brake, turnRate: turn, turnRateMoving: turnM, latAccMax: lat, maxSpeed: vmax, reverseSpeed: vrev,
  };
}
/** Radfahrzeug-Antrieb (Diesel/Benziner mit Wandlerautomatik). */
function wheelEngine({ curve, k, rated, idle = 650, gears, F, r, brake, vmax, vrev, air = 1.6, trac = OFF_TR, rr = CAR_RR, conv = 1.9, lag = 0.2, eb = [60, 0.03] }) {
  return {
    idleRpm: idle, ratedRpm: rated, cutRpm: Math.round(rated * 1.08), cruiseRpm: Math.round(rated * 0.8), torque: tq(curve, k),
    gears, finalDrive: F, sprocketR: r, efficiency: 0.85, rotInertia: 1.1,
    converter: { stallRpm: Math.round(rated * 0.6), mult: conv, coupleRpm: Math.round(rated * 0.52) }, torqueLag: lag, shiftTime: 0.35,
    autoUp: Math.round(rated * 0.93), autoDown: Math.round(rated * 0.42),
    engineBrake: eb, rollRes: rr, traction: trac, airRes: air, brake, maxSpeed: vmax, reverseSpeed: vrev,
  };
}

/**
 * Mitfahrersitz. kind: 'closed' (geschlossener Kampfraum, Innensicht), 'cabin' (Kabine/Plane: sitzende Figur im Modell),
 * 'open' (offene Ladefläche: geduckte Figur, mit fireOut Aufstehen und Feuern). eye = Augpunkt sitzend (Wannenraum),
 * stand = Füße beim Feuern (Augenhöhe +1,62 m), yaw = Feuerbereich relativ zur Fahrtrichtung.
 */
function rider(id, label, pos, eye, exit, kind, tpv, { stand = null, yaw = null, fireLabel = 'Aufstehen und feuern', hatch = null } = {}) {
  const views = [];
  if (kind === 'closed') views.push({ id: 'innen', label: 'Kampfraum', space: 'hull', pos: eye, look: 'rel', yaw: [-PI, PI], pitch: [-0.9, 0.6], zoom: [1], interior: true });
  else views.push({ id: 'sitz', label: kind === 'cabin' ? 'Ego-Sicht' : 'Sitz', space: 'hull', pos: eye, look: 'rel', yaw: [-2.6, 2.6], pitch: [-0.8, 0.7], zoom: [1], exposed: true, crouch: kind === 'open' });
  if (stand) {
    views.push({
      id: 'feuern', label: fireLabel, space: 'hull', pos: [stand[0], stand[1] + 1.62, stand[2]], look: 'rel', yaw: yaw || [-PI, PI], pitch: [-0.7, 0.8], zoom: [1],
      exposed: true, fireOut: true, pin: stand, ...(hatch ? { hatch } : {}),
    });
  }
  views.push(out(tpv.dist, tpv.height, tpv.pivot));
  return { id, label, weapons: [], exposed: kind !== 'closed', cabin: kind === 'cabin', passenger: true, pos, exit, views };
}
/** Fahrer-/Beifahrersitz einer Kabine (wie civSeat in data.js). */
function cabSeat(id, label, pos, eye, exit, tpv, drive = false) {
  return {
    id, label, drive, weapons: [], exposed: true, cabin: true, pos, exit,
    views: [
      { id: 'sitz', label: 'Ego-Sicht', space: 'hull', pos: eye, look: 'rel', yaw: [-2.4, 2.4], pitch: [-0.8, 0.7], zoom: [1, 1.6], exposed: true },
      out(tpv.dist, tpv.height, tpv.pivot),
    ],
  };
}

/* ================================================================ Fahrzeuge */

export const TROOP_VEHICLES = {
  /* --------------------------------------------------------- LP-21 Gämse (modern, leichter Panzer) */
  // Luftverlastbarer Leichtpanzer (~24 t): Fahrer vorn mittig, Triebwerk hinten, flacher geschweißter Turm mit 105-mm-
  // Kanone (Mündungsbremse), Wärmebild, Kommandanten-Waffenstation, geschweißte Aluminium-/Stahlwanne mit Zusatzmodulen.
  lp21: {
    id: 'lp21', name: 'LP-21 Gämse', cls: 'Leichter Panzer', era: 'modern', drive: 'tracked', model: 'lp21', sound: 'tank',
    health: 640, armored: true, respawn: 70, wreckTime: 20,
    smallArmsMult: 0, explosiveMult: 0.45, ramMult: 0.3,
    mass: 24000, com: [0, 0.8, 0.15],
    hullBox: [0, 0.97, 0, 1.5, 0.52, 3.2],
    turretBox: [0, 0.32, 0.15, 1.08, 0.32, 1.35],
    turretPivot: [0, 1.48, 0.2],
    gunPivot: [0, 0.34, -1.05],
    muzzle: [0, 0, -4.45],
    coax: [0.32, 0.02, -0.45],
    cmgPivot: [-0.5, 0.78, 0.5], cmgMuzzle: [0, 0.06, -0.8],
    gunLimits: { min: deg(-10), max: deg(20) },
    traverse: deg(42), elevate: deg(30),
    wheels: { radius: 0.3, rest: 0.42, stiffness: 230000, damping: 24000, x: 1.17, z: [-2.3, -1.15, 0, 1.15, 2.3] },
    roadZ: [-2.35, -1.41, -0.47, 0.47, 1.41, 2.35],
    engine: tankEngine({ curve: MBT_TQ, k: 0.38, F: 4.0, r: 0.3, brake: 170000, turn: 0.95, turnM: 0.72, lat: 4.8, vmax: 19.4, vrev: 8.4, air: 3.0, drag: 11000 }),
    drivetrain: { powerKW: 410, pwr: 17.1, gears: '5/2 (Wandler)', vmax: 70 },
    grip: { long: 1.0, lat: 0.95, latTurning: 0.55, rollInfluence: 0.25 },
    drag: 0.9, angularDamp: 2.1,
    zones: { hull: { label: 'Wanne', hp: 640 }, engine: { label: 'Motor', hp: 190 }, tracks: { label: 'Ketten', hp: 180 }, turret: { label: 'Turm', hp: 210 } },
    armor: { hull: { front: [38, 62], side: [24, 0], rear: [18, 10], top: [12, 0], bottom: [10, 0] }, turret: { front: [55, 48], side: [26, 12], rear: [16, 5], top: [12, 0], mantlet: [45, 0] } },
    seats: [
      { id: 'driver', label: 'Fahrer', drive: true, weapons: [], pos: [0, 0.5, -2.25], exit: [[-2.7, 0, -1.7], [2.7, 0, -1.7], [0, 0, -4.6], [0, 0, 4.6]],
        views: [
          { id: 'spiegel', label: 'Winkelspiegel', space: 'hull', pos: [0, 1.5, -2.48], look: 'rel', yaw: [-0.6, 0.6], pitch: [-0.2, 0.25], zoom: [1.25], overlay: 'slit' },
          { id: 'luke', label: 'Luke offen', space: 'hull', pos: [0, 2.06, -2.22], look: 'rel', yaw: [-2.6, 2.6], pitch: [-0.6, 0.8], zoom: [1, 1.8], exposed: true, hatch: 'driver', pin: [0, 0.88, -2.25] },
          out(10, 4.2, 2.3),
        ] },
      { id: 'gunner', label: 'Richtschütze', weapons: ['mbt_ap', 'mbt_he', 'mbt_coax'], mount: 'gun', pos: [0.45, 0.7, -0.2], exit: [[2.7, 0, -0.3], [-2.7, 0, -0.3], [0, 0, 4.6]],
        views: [
          { id: 'optik', label: 'Hauptzieloptik', space: 'gun', pos: [0.5, 0.36, 0.42], look: 'mount', zoom: [3, 8], overlay: 'optic' },
          { id: 'weit', label: 'Weitwinkel', space: 'gun', pos: [0.5, 0.36, 0.42], look: 'mount', zoom: [1.2, 2.5], overlay: 'wide' },
          TURRET_IN([0.45, 0.48, -0.3]),
          out(10, 4.2, 2.3, 'mount'),
        ] },
      { id: 'commander', label: 'Kommandant', weapons: ['mbt_cmg'], mount: 'cmg', pos: [-0.5, 0.78, 0.55], exit: [[-2.7, 0, 0.5], [2.7, 0, 0.5], [0, 0, 4.6]],
        views: [
          { id: 'periskop', label: 'Rundblickoptik', space: 'cupola', pos: [0, 0.1, 0.12], look: 'mount', zoom: [1.5, 4, 8], overlay: 'peri' },
          { id: 'luke', label: 'Luke offen', space: 'turret', pos: [-0.5, 1.2, 0.68], look: 'mount', zoom: [1, 4, 7], overlay: 'binocular', exposed: true, hatch: 'commander', pin: [-0.5, 0.08, 0.6] },
          TURRET_IN([-0.5, 0.5, 0.45]),
          out(10, 4.4, 2.5, 'mount'),
        ] },
      { id: 'loader', label: 'Ladeschütze', loader: true, weapons: [], pos: [0.5, 0.78, 0.5], exit: [[2.7, 0, 0.5], [-2.7, 0, 0.5], [0, 0, 4.6]],
        views: [
          TURRET_IN([0.5, 0.5, 0.35], { overlay: 'loader' }),
          { id: 'luke', label: 'Luke offen', space: 'turret', pos: [0.5, 1.18, 0.55], look: 'relTurret', yaw: [-PI, PI], pitch: [-0.6, 0.8], zoom: [1, 2], exposed: true, hatch: 'loader', pin: [0.5, 0.06, 0.55] },
          out(10, 4.4, 2.5, 'relTurret'),
        ] },
    ],
    hatches: {
      driver: { space: 'hull', pos: [0, 1.5, -2.25], r: 0.28 },
      commander: { space: 'turret', pos: [-0.5, 0.66, 0.6], r: 0.3 },
      loader: { space: 'turret', pos: [0.5, 0.65, 0.55], r: 0.27 },
    },
    // Munition im Turmheck hinter der Schiebetür (wie KP-1, kleiner)
    interior: { scale: 0.9, shift: [0, -0.04, 0.08], breech: [0, 0.42, -0.55], breechScale: 0.85, loaderEye: [0.5, 0.6, 0.35], rack: [0, 0.42, 1.3], rackGrid: [6, 3], blastDoor: true },
    crew: { switchTime: 1.1, faceTol: 0.6 },
    ammo: { mbt_ap: 16, mbt_he: 20 },
    lights: [[-1.15, 1.25, -3.18], [1.15, 1.25, -3.18]],
    exhaust: [1.0, 1.35, 3.2],
    weaponMods: {
      mbt_ap: { name: '105 mm Wuchtgeschoss (PG)', speed: 1500, vehicleDamage: 250, actorDamage: 200, reload: 6.0, reloadNoLoader: 9.0, splash: { radius: 2.4, maxDamage: 85 }, shake: 0.45 },
      mbt_he: { name: '105 mm Mehrzweckgranate (SG)', speed: 1100, vehicleDamage: 165, actorDamage: 195, reload: 6.0, reloadNoLoader: 9.0, splash: { radius: 7.0, maxDamage: 160, innerRadius: 1.5, minDamage: 22 }, shake: 0.42 },
    },
  },

  /* --------------------------------------------------------- LP-39 Frettchen (2. WK, leichter Panzer) */
  // Genieteter Leichtpanzer (~10,5 t) der frühen Kriegsjahre: vier große Laufrollen an Blattfedern, Triebrad vorn,
  // kleiner Turm mit 37-mm-Kanone und Koaxial-MG, Bug-MG rechts im Kugelstand, Funkantenne, Kommandantenkuppel. 4 Mann.
  wk2l: {
    id: 'wk2l', name: 'LP-39 Frettchen', cls: 'Leichter Panzer', era: 'wk2', drive: 'tracked', model: 'wk2l', sound: 'tank',
    health: 480, armored: true, respawn: 55, wreckTime: 18, noThermal: true,
    smallArmsMult: 0, explosiveMult: 0.55, ramMult: 0.4,
    mass: 10500, com: [0, 0.82, 0.05],
    hullBox: [0, 1.02, 0, 1.22, 0.52, 2.38],
    turretBox: [0, 0.32, 0.05, 0.78, 0.32, 0.88],
    turretPivot: [0, 1.54, -0.15],
    gunPivot: [0, 0.3, -0.68],
    muzzle: [0, 0, -2.3],
    coax: [0.2, 0.02, -0.3],
    cmgHull: true, cmgPivot: [0.48, 1.3, -2.22], cmgMuzzle: [0, 0, -0.5],
    cmgLimits: { yaw: [-0.4, 0.4], pitch: [-0.17, 0.26] },
    gunLimits: { min: deg(-10), max: deg(20) },
    traverse: deg(26), elevate: deg(14),
    wheels: { radius: 0.32, rest: 0.4, stiffness: 120000, damping: 12000, x: 0.95, z: [-1.6, -0.8, 0, 0.8, 1.6] },
    roadZ: [-1.5, -0.5, 0.5, 1.5],
    engine: tankEngine({ curve: WW2_TQ, k: 0.24, rated: 3000, idle: 600, F: 6.4, r: 0.26, brake: 80000, turn: 1.0, turnM: 0.78, lat: 4.6, vmax: 12.2, vrev: 4.5, air: 2.0, drag: 6000, conv: 1.6, lag: 0.2, shift: 0.7 }),
    drivetrain: { powerKW: 110, pwr: 10.5, gears: '5/2 (Wechselgetriebe)', vmax: 44 },
    grip: { long: 1.0, lat: 0.95, latTurning: 0.55, rollInfluence: 0.25 },
    drag: 0.9, angularDamp: 2.0,
    zones: { hull: { label: 'Wanne', hp: 480 }, engine: { label: 'Motor', hp: 140 }, tracks: { label: 'Ketten', hp: 140 }, turret: { label: 'Turm', hp: 150 } },
    armor: { hull: { front: [30, 22], side: [15, 0], rear: [15, 10], top: [10, 0], bottom: [8, 0] }, turret: { front: [30, 12], side: [15, 10], rear: [15, 8], top: [10, 0], mantlet: [30, 0] } },
    seats: [
      { id: 'driver', label: 'Fahrer', drive: true, weapons: [], pos: [-0.42, 0.6, -1.62], exit: [[-2.3, 0, -1.4], [2.3, 0, -1.4], [0, 0, -3.6], [0, 0, 3.6]],
        views: [
          { id: 'sehklappe', label: 'Fahrersehklappe', space: 'hull', pos: [-0.42, 1.42, -2.02], look: 'rel', yaw: [-0.5, 0.5], pitch: [-0.2, 0.2], zoom: [1.15], overlay: 'slit' },
          { id: 'luke', label: 'Luke offen', space: 'hull', pos: [-0.42, 2.05, -1.66], look: 'rel', yaw: [-2.6, 2.6], pitch: [-0.6, 0.8], zoom: [1, 1.8], exposed: true, hatch: 'driver', pin: [-0.42, 0.92, -1.62] },
          out(8.5, 3.6, 2.0),
        ] },
      { id: 'gunner', label: 'Kommandant (richtet)', weapons: ['mbt_ap', 'mbt_he', 'wk2_mg'], mount: 'gun', pos: [-0.25, 0.85, -0.1], exit: [[-2.3, 0, -0.2], [2.3, 0, -0.2], [0, 0, 3.6]],
        views: [
          { id: 'optik', label: 'Zielfernrohr', space: 'gun', pos: [-0.2, 0.32, -0.42], look: 'mount', zoom: [2, 3.5], overlay: 'optic' },
          { id: 'weit', label: 'Weitwinkel', space: 'gun', pos: [-0.2, 0.32, -0.42], look: 'mount', zoom: [1.2], overlay: 'wide' },
          TURRET_IN([-0.25, 0.44, -0.2]),
          { id: 'luke', label: 'Kuppel offen', space: 'turret', pos: [-0.25, 1.22, 0.22], look: 'mount', zoom: [1, 4, 6], overlay: 'binocular', exposed: true, hatch: 'commander', pin: [-0.25, 0.12, 0.22] },
          out(8.5, 3.7, 2.1, 'mount'),
        ] },
      { id: 'funker', label: 'Funker (Bug-MG)', weapons: ['wk2_mg'], mount: 'cmg', pos: [0.48, 0.6, -1.62], exit: [[2.3, 0, -1.4], [-2.3, 0, -1.4], [0, 0, -3.6]],
        views: [
          { id: 'kugel', label: 'Kugelblende', space: 'cupola', pos: [0, 0.12, 0.38], look: 'mount', zoom: [1.4, 2.2], overlay: 'wide' },
          out(8.5, 3.6, 2.0, 'mount'),
        ] },
      { id: 'loader', label: 'Ladeschütze', loader: true, weapons: [], pos: [0.32, 0.85, 0.05], exit: [[2.3, 0, 0.1], [-2.3, 0, 0.1], [0, 0, 3.6]],
        views: [
          TURRET_IN([0.32, 0.46, 0.18], { overlay: 'loader' }),
          out(8.5, 3.7, 2.1, 'relTurret'),
        ] },
    ],
    hatches: {
      driver: { space: 'hull', pos: [-0.42, 1.53, -1.66], r: 0.24 },
      commander: { space: 'turret', pos: [-0.25, 0.64, 0.22], r: 0.27 },
    },
    // kleiner Kampfraum (Aufbau auf 74 %), Granaten in Klappkästen an der Turmwand
    interior: { scale: 0.74, shift: [0, -0.04, 0.1], breech: [0, 0.42, -0.55], breechScale: 0.45, loaderEye: [0.4, 0.6, 0.3], rack: [0, 0.32, 1.1], rackRot: [0.35, 0], rackGrid: [6, 3] },
    crew: { switchTime: 1.0, faceTol: 0.6 },
    ammo: { mbt_ap: 50, mbt_he: 40 },
    lights: [[-0.82, 1.42, -2.32]],
    exhaust: [0.7, 1.05, 2.4],
    weaponMods: {
      mbt_ap: { name: '37 mm Panzergranate (PG)', speed: 760, life: 2.6, vehicleDamage: 115, actorDamage: 140, reload: 2.8, reloadNoLoader: 4.6, splash: { radius: 1.4, maxDamage: 55 }, shake: 0.22 },
      mbt_he: { name: '37 mm Sprenggranate (SG)', speed: 690, life: 2.8, vehicleDamage: 60, actorDamage: 150, reload: 2.8, reloadNoLoader: 4.6, splash: { radius: 4.2, maxDamage: 115, innerRadius: 1.0, minDamage: 12 }, shake: 0.2 },
    },
    psimMods: { pzgr: { speed: 760, pen0: 48, dmgPen: 160, filler: 0.4 }, spreng: { speed: 690 } },
  },

  /* --------------------------------------------------------- SP-45 Walross (2. WK, schwerer Panzer) */
  // Später schwerer Panzer (~68 t): Bug und Seiten stark geneigt, Bug 150 mm/50°, Schachtellaufwerk mit neun Doppelrollen,
  // breite Ketten, großer geschweißter Turm mit Heckwulst, lange 88-mm-Kanone mit Doppelkammer-Mündungsbremse, 5 Mann.
  wk2s: {
    id: 'wk2s', name: 'SP-45 Walross', cls: 'Schwerer Panzer', era: 'wk2', drive: 'tracked', model: 'wk2s', sound: 'tank',
    health: 1120, armored: true, respawn: 95, wreckTime: 22, noThermal: true,
    smallArmsMult: 0, explosiveMult: 0.3, ramMult: 0.14,
    mass: 68000, com: [0, 0.95, 0.1],
    hullBox: [0, 1.24, 0.05, 1.86, 0.74, 3.6],
    turretBox: [0, 0.45, 0.4, 1.25, 0.45, 1.85],
    turretPivot: [0, 1.98, 0.05],
    gunPivot: [0, 0.44, -1.6],
    muzzle: [0, 0, -6.35],
    coax: [0.34, 0.03, -0.45],
    cmgHull: true, cmgPivot: [0.66, 1.52, -3.45], cmgMuzzle: [0, 0, -0.55],
    cmgLimits: { yaw: [-0.35, 0.35], pitch: [-0.17, 0.26] },
    gunLimits: { min: deg(-8), max: deg(15) },
    traverse: deg(13), elevate: deg(6),
    wheels: { radius: 0.42, rest: 0.44, stiffness: 600000, damping: 68000, x: 1.4, z: [-2.7, -1.35, 0, 1.35, 2.7] },
    roadZ: [-2.8, -2.1, -1.4, -0.7, 0, 0.7, 1.4, 2.1, 2.8],
    engine: tankEngine({ curve: WW2_TQ, k: 1.25, rated: 3000, idle: 600, F: 8.6, r: 0.32, brake: 420000, turn: 0.5, turnM: 0.4, lat: 3.4, vmax: 11.0, vrev: 3.6, air: 4.2, drag: 24000, conv: 1.6, lag: 0.3, shift: 0.8 }),
    drivetrain: { powerKW: 515, pwr: 7.6, gears: '8/4 (Vorwählgetriebe)', vmax: 40 },
    grip: { long: 1.0, lat: 0.95, latTurning: 0.55, rollInfluence: 0.25 },
    drag: 0.9, angularDamp: 2.5,
    zones: { hull: { label: 'Wanne', hp: 1120 }, engine: { label: 'Motor', hp: 260 }, tracks: { label: 'Ketten', hp: 250 }, turret: { label: 'Turm', hp: 320 } },
    armor: { hull: { front: [150, 50], side: [80, 25], rear: [80, 30], top: [40, 0], bottom: [25, 0] }, turret: { front: [180, 10], side: [80, 21], rear: [80, 21], top: [44, 0], mantlet: [150, 0] } },
    seats: [
      { id: 'driver', label: 'Fahrer', drive: true, weapons: [], pos: [-0.62, 0.66, -2.65], exit: [[-3.0, 0, -1.8], [3.0, 0, -1.8], [0, 0, -4.8], [0, 0, 4.8]],
        views: [
          { id: 'sehklappe', label: 'Fahrersehklappe', space: 'hull', pos: [-0.62, 1.7, -3.1], look: 'rel', yaw: [-0.45, 0.45], pitch: [-0.2, 0.2], zoom: [1.2], overlay: 'slit' },
          { id: 'luke', label: 'Luke offen', space: 'hull', pos: [-0.62, 2.55, -2.6], look: 'rel', yaw: [-2.6, 2.6], pitch: [-0.6, 0.8], zoom: [1, 1.8], exposed: true, hatch: 'driver', pin: [-0.62, 1.32, -2.62] },
          out(12, 5.1, 2.9),
        ] },
      { id: 'gunner', label: 'Richtschütze', weapons: ['mbt_ap', 'mbt_he', 'wk2_mg'], mount: 'gun', pos: [-0.45, 1.0, -0.35], exit: [[-3.0, 0, -0.4], [3.0, 0, -0.4], [0, 0, 4.8], [0, 0, -4.8]],
        views: [
          { id: 'optik', label: 'Zielfernrohr (Knickfernrohr)', space: 'gun', pos: [-0.32, 0.46, -1.2], look: 'mount', zoom: [3, 6], overlay: 'optic' },
          { id: 'weit', label: 'Weitwinkel', space: 'gun', pos: [-0.32, 0.46, -1.2], look: 'mount', zoom: [1.2], overlay: 'wide' },
          TURRET_IN([-0.42, 0.52, -0.75]),
          out(12, 5.1, 2.9, 'mount'),
        ] },
      { id: 'funker', label: 'Funker (Bug-MG)', weapons: ['wk2_mg'], mount: 'cmg', pos: [0.62, 0.66, -2.65], exit: [[3.0, 0, -1.8], [-3.0, 0, -1.8], [0, 0, -4.8]],
        views: [
          { id: 'kugel', label: 'Kugelblende', space: 'cupola', pos: [0, 0.13, 0.42], look: 'mount', zoom: [1.4, 2.2], overlay: 'wide' },
          out(11.5, 4.8, 2.6, 'mount'),
        ] },
      { id: 'commander', label: 'Kommandant', weapons: [], pos: [-0.58, 1.22, 0.8], exit: [[-3.0, 0, 0.6], [3.0, 0, 0.6], [0, 0, 4.8]],
        views: [
          { id: 'kuppel', label: 'Kommandantenkuppel', space: 'turret', pos: [-0.58, 1.1, 0.95], look: 'relTurret', yaw: [-PI, PI], pitch: [-0.35, 0.4], zoom: [1, 2], overlay: 'peri' },
          { id: 'luke', label: 'Luke offen', space: 'turret', pos: [-0.58, 1.6, 1.0], look: 'relTurret', yaw: [-PI, PI], pitch: [-0.6, 0.8], zoom: [1, 4, 7], overlay: 'binocular', exposed: true, hatch: 'commander', pin: [-0.58, 0.4, 0.95] },
          TURRET_IN([-0.5, 0.58, 0.6]),
          out(12, 5.2, 3.0, 'relTurret'),
        ] },
      { id: 'loader', label: 'Ladeschütze', loader: true, weapons: [], pos: [0.55, 1.05, 0.55], exit: [[3.0, 0, 0.6], [-3.0, 0, 0.6], [0, 0, 4.8]],
        views: [
          TURRET_IN([0.55, 0.6, 0.55], { overlay: 'loader' }),
          { id: 'luke', label: 'Luke offen', space: 'turret', pos: [0.55, 1.38, 0.62], look: 'relTurret', yaw: [-PI, PI], pitch: [-0.6, 0.8], zoom: [1, 2], exposed: true, hatch: 'loader', pin: [0.55, 0.15, 0.62] },
          out(12, 5.2, 3.0, 'relTurret'),
        ] },
    ],
    hatches: {
      driver: { space: 'hull', pos: [-0.62, 1.96, -2.62], r: 0.27 },
      commander: { space: 'turret', pos: [-0.58, 1.08, 0.95], r: 0.3 },
      loader: { space: 'turret', pos: [0.55, 0.9, 0.62], r: 0.27 },
    },
    // Munition im Turmheck (Wulst) und in den Seitenkammern über den Ketten
    interior: { breech: [0, 0.42, -0.55], loaderEye: [0.55, 0.62, 0.35], rack: [0, 0.45, 1.6], rackGrid: [8, 3] },
    crew: { switchTime: 1.4, faceTol: 0.6 },
    ammo: { mbt_ap: 38, mbt_he: 34 },
    lights: [[-1.2, 1.98, -3.45], [1.2, 1.98, -3.45]],
    exhaust: [0.55, 2.0, 3.6],
    weaponMods: {
      mbt_ap: { name: '88 mm Panzergranate lang (PG)', speed: 1000, vehicleDamage: 320, actorDamage: 210, reload: 6.0, reloadNoLoader: 10.0, splash: { radius: 2.3, maxDamage: 90 }, shake: 0.56 },
      mbt_he: { name: '88 mm Sprenggranate (SG)', speed: 700, vehicleDamage: 150, actorDamage: 205, reload: 6.0, reloadNoLoader: 10.0, splash: { radius: 7.5, maxDamage: 175, innerRadius: 1.6, minDamage: 22 }, shake: 0.5 },
    },
    psimMods: { pzgr: { speed: 1000, pen0: 205 }, hl: { speed: 600 } },
  },

  /* --------------------------------------------------------- SP-58 Mastodon (Kalter Krieg, schwerer Panzer) */
  // Schwerer Panzer der 1950er (~58 t): lange Wanne mit spitzem Gussbug, sieben Laufrollen, großer Gussturm mit weit
  // ausladendem Heck, gezogene 120-mm-Kanone mit Rauchabsauger, Stereo-Entfernungsmesser, Kommandantenkuppel mit MG.
  kks: {
    id: 'kks', name: 'SP-58 Mastodon', cls: 'Schwerer Panzer (Kalter Krieg)', era: 'kk', drive: 'tracked', model: 'kks', sound: 'tank',
    health: 1150, armored: true, respawn: 95, wreckTime: 22, noThermal: true,
    smallArmsMult: 0, explosiveMult: 0.3, ramMult: 0.15,
    mass: 58000, com: [0, 0.9, 0.15],
    hullBox: [0, 1.12, 0.05, 1.82, 0.62, 3.78],
    turretBox: [0, 0.48, 0.3, 1.3, 0.48, 1.95],
    turretPivot: [0, 1.74, -0.15],
    gunPivot: [0, 0.46, -1.5],
    muzzle: [0, 0, -6.65],
    coax: [0.4, 0.02, -0.55],
    cmgPivot: [-0.62, 1.04, 0.6], cmgMuzzle: [0.12, 0.22, -1.2],
    gunLimits: { min: deg(-7), max: deg(15) },
    traverse: deg(20), elevate: deg(5),
    wheels: { radius: 0.34, rest: 0.42, stiffness: 520000, damping: 56000, x: 1.42, z: [-2.8, -1.4, 0, 1.4, 2.8] },
    roadZ: [-2.85, -1.9, -0.95, 0, 0.95, 1.9, 2.85],
    engine: tankEngine({ curve: MBT_TQ, k: 0.56, F: 7.4, r: 0.3, brake: 360000, turn: 0.6, turnM: 0.48, lat: 3.8, vmax: 10.5, vrev: 4.0, air: 4.2, drag: 20000, conv: 1.7, lag: 0.3, shift: 0.65 }),
    drivetrain: { powerKW: 600, pwr: 10.3, gears: '5/2 (Wandler)', vmax: 38 },
    grip: { long: 1.0, lat: 0.95, latTurning: 0.55, rollInfluence: 0.25 },
    drag: 0.9, angularDamp: 2.4,
    zones: { hull: { label: 'Wanne', hp: 1150 }, engine: { label: 'Motor', hp: 260 }, tracks: { label: 'Ketten', hp: 240 }, turret: { label: 'Turm', hp: 330 } },
    armor: { hull: { front: [120, 60], side: [50, 0], rear: [38, 10], top: [25, 0], bottom: [20, 0] }, turret: { front: [240, 20], side: [120, 25], rear: [70, 15], top: [40, 0], mantlet: [200, 10] } },
    seats: [
      { id: 'driver', label: 'Fahrer', drive: true, weapons: [], pos: [0, 0.56, -2.85], exit: [[-3.0, 0, -2.0], [3.0, 0, -2.0], [0, 0, -5.0], [0, 0, 5.0]],
        views: [
          { id: 'spiegel', label: 'Winkelspiegel', space: 'hull', pos: [0, 1.56, -3.1], look: 'rel', yaw: [-0.55, 0.55], pitch: [-0.2, 0.25], zoom: [1.2], overlay: 'slit' },
          { id: 'luke', label: 'Luke offen', space: 'hull', pos: [0, 2.12, -2.82], look: 'rel', yaw: [-2.6, 2.6], pitch: [-0.6, 0.8], zoom: [1, 1.8], exposed: true, hatch: 'driver', pin: [0, 0.94, -2.85] },
          out(12, 5.0, 2.8),
        ] },
      { id: 'gunner', label: 'Richtschütze', weapons: ['mbt_ap', 'mbt_he', 'mbt_coax'], mount: 'gun', pos: [0.55, 0.78, -0.55], exit: [[3.0, 0, -0.5], [-3.0, 0, -0.5], [0, 0, 5.0]],
        views: [
          { id: 'optik', label: 'Zielfernrohr', space: 'gun', pos: [0.62, 0.42, 0.55], look: 'mount', zoom: [4, 8], overlay: 'optic' },
          { id: 'weit', label: 'Entfernungsmesser (Weitwinkel)', space: 'gun', pos: [0.62, 0.42, 0.55], look: 'mount', zoom: [1.2, 2.5], overlay: 'wide' },
          TURRET_IN([0.58, 0.62, -0.55]),
          out(12, 5.0, 2.8, 'mount'),
        ] },
      { id: 'commander', label: 'Kommandant', weapons: ['mbt_cmg'], mount: 'cmg', pos: [-0.62, 0.95, 0.6], exit: [[-3.0, 0, 0.6], [3.0, 0, 0.6], [0, 0, 5.0]],
        views: [
          { id: 'periskop', label: 'Kuppel-Winkelspiegel', space: 'cupola', pos: [0, 0.06, 0.05], look: 'mount', zoom: [1.5, 4], overlay: 'peri' },
          { id: 'luke', label: 'Luke offen', space: 'turret', pos: [-0.62, 1.52, 0.75], look: 'mount', zoom: [1, 4, 7], overlay: 'binocular', exposed: true, hatch: 'commander', pin: [-0.62, 0.32, 0.6] },
          TURRET_IN([-0.62, 0.64, 0.5]),
          out(11.5, 5.1, 3.0, 'mount'),
        ] },
      { id: 'loader', label: 'Ladeschütze', loader: true, weapons: [], pos: [0.55, 0.82, 0.5], exit: [[3.0, 0, 0.6], [-3.0, 0, 0.6], [0, 0, 5.0]],
        views: [
          TURRET_IN([0.55, 0.64, 0.4], { overlay: 'loader' }),
          { id: 'luke', label: 'Luke offen', space: 'turret', pos: [0.55, 1.38, 0.5], look: 'relTurret', yaw: [-PI, PI], pitch: [-0.6, 0.8], zoom: [1, 2], exposed: true, hatch: 'loader', pin: [0.55, 0.12, 0.5] },
          out(11.5, 5.1, 3.0, 'relTurret'),
        ] },
    ],
    hatches: {
      driver: { space: 'hull', pos: [0, 1.62, -2.85], r: 0.3 },
      commander: { space: 'turret', pos: [-0.62, 1.15, 0.6], r: 0.3 },
      loader: { space: 'turret', pos: [0.55, 0.92, 0.5], r: 0.29 },
    },
    // getrennte Munition (Granate + Kartusche): Gestell im Turmheck, daneben Kartuschenständer
    interior: { breech: [0, 0.42, -0.55], rack: [0, 0.46, 1.7], loaderEye: [0.55, 0.62, 0.35], rackGrid: [8, 3] },
    crew: { switchTime: 1.3, faceTol: 0.6 },
    ammo: { mbt_ap: 16, mbt_he: 18 },
    lights: [[-1.35, 1.32, -3.7], [1.35, 1.32, -3.7]],
    exhaust: [1.2, 1.55, 3.8],
    weaponMods: {
      mbt_ap: { name: '120 mm Panzergranate (PG)', speed: 1070, vehicleDamage: 330, actorDamage: 215, reload: 7.5, reloadNoLoader: 12.0, splash: { radius: 2.6, maxDamage: 95 }, shake: 0.6 },
      mbt_he: { name: '120 mm Sprenggranate (SG)', speed: 750, vehicleDamage: 180, actorDamage: 220, reload: 7.5, reloadNoLoader: 12.0, splash: { radius: 8.5, maxDamage: 190, innerRadius: 1.8, minDamage: 25 }, shake: 0.56 },
    },
    psimMods: { pzgr: { speed: 1070, pen0: 255, rico: 72, filler: 0.6 } },
  },

  /* --------------------------------------------------------- MTW-13 Kröte (Ketten-Mannschaftstransportwagen) */
  // Kastenförmige Aluminiumwanne (~12,5 t), Schwimmschwall-Brett am Bug, Motor vorn rechts, Fahrer vorn links, Kommandanten-
  // kuppel mit offenem .50-MG und Schutzschild, großer Dachluken-Deckel hinten, Heckrampe mit Tür. 2 Mann + 8 Schützen.
  mtw: {
    id: 'mtw', name: 'MTW-13 Kröte', cls: 'Mannschaftstransportwagen', era: 'kk', drive: 'tracked', model: 'mtw', sound: 'tank',
    transport: true, noCabin: true, noTurretInterior: true, noThermal: true,
    health: 520, armored: true, respawn: 60, wreckTime: 18,
    smallArmsMult: 0.04, explosiveMult: 0.6, ramMult: 0.35,
    mass: 12500, com: [0, 0.95, 0.1],
    hullBox: [0, 1.12, 0.1, 1.38, 0.72, 2.5],
    turretBox: [0, 0.24, 0, 0.42, 0.24, 0.42],
    turretPivot: [0.32, 1.86, -0.6],
    gunPivot: [0, 0.52, -0.2],
    muzzle: [0, 0, -1.3],
    coax: [0, 0, -0.7],
    cmgPivot: [0, 0, 0], cmgMuzzle: [0, 0, -1],
    gunLimits: { min: deg(-12), max: deg(55) },
    traverse: deg(120), elevate: deg(80),
    wheels: { radius: 0.3, rest: 0.4, stiffness: 160000, damping: 15000, x: 1.12, z: [-1.9, -0.95, 0, 0.95, 1.9] },
    roadZ: [-1.95, -0.97, 0, 0.97, 1.95],
    engine: tankEngine({ curve: MBT_TQ, k: 0.19, F: 3.9, r: 0.27, brake: 95000, turn: 1.0, turnM: 0.78, lat: 4.8, vmax: 18.0, vrev: 6.5, air: 2.6, drag: 6500, conv: 1.9, lag: 0.2, shift: 0.45 }),
    drivetrain: { powerKW: 160, pwr: 12.8, gears: '3/1 (Wandler)', vmax: 64 },
    grip: { long: 1.0, lat: 0.95, latTurning: 0.55, rollInfluence: 0.25 },
    drag: 0.9, angularDamp: 2.0,
    zones: { hull: { label: 'Wanne', hp: 520 }, engine: { label: 'Motor', hp: 160 }, tracks: { label: 'Ketten', hp: 150 }, turret: { label: 'Kuppel', hp: 120 } },
    armor: { hull: { front: [22, 45], side: [16, 0], rear: [16, 0], top: [12, 0], bottom: [10, 0] }, turret: { front: [12, 0], side: [12, 0], rear: [12, 0], top: [6, 0], mantlet: [10, 0] } },
    seats: [
      { id: 'driver', label: 'Fahrer', drive: true, weapons: [], pos: [-0.5, 0.62, -1.78], exit: [[-2.6, 0, -1.4], [2.6, 0, -1.4], [0, 0, 3.8], [0, 0, -3.6]],
        views: [
          { id: 'spiegel', label: 'Winkelspiegel', space: 'hull', pos: [-0.5, 1.68, -1.98], look: 'rel', yaw: [-0.6, 0.6], pitch: [-0.2, 0.25], zoom: [1.2], overlay: 'slit' },
          { id: 'luke', label: 'Luke offen', space: 'hull', pos: [-0.5, 2.28, -1.75], look: 'rel', yaw: [-2.6, 2.6], pitch: [-0.6, 0.8], zoom: [1, 1.8], exposed: true, hatch: 'driver', pin: [-0.5, 1.1, -1.78] },
          { id: 'innen', label: 'Fahrerplatz', space: 'hull', pos: [-0.5, 1.48, -1.65], look: 'rel', yaw: [-2.4, 2.4], pitch: [-0.9, 0.5], zoom: [1], interior: true },
          out(9, 3.9, 2.2),
        ] },
      { id: 'gunner', label: 'Kommandant (MG)', weapons: ['jeep_mg'], mount: 'gun', exposed: true, pos: [0.32, 0.78, -0.62], exit: [[2.6, 0, -0.6], [-2.6, 0, -0.6], [0, 0, 3.8]],
        views: [
          { id: 'mg', label: 'MG', space: 'gun', pos: [0, 0.22, 0.62], look: 'mount', zoom: [1, 2], exposed: true, hatch: 'commander' },
          { id: 'innen', label: 'Kuppel-Winkelspiegel', space: 'hull', pos: [0.32, 1.66, -0.62], look: 'rel', yaw: [-PI, PI], pitch: [-0.3, 0.3], zoom: [1.2], overlay: 'peri' },
          out(9, 4.0, 2.3, 'mount'),
        ] },
      ...[[-0.62, -0.15], [0.62, 0.3], [-0.62, 0.55], [0.62, 0.95], [-0.62, 1.25], [0.62, 1.6], [-0.62, 1.95], [0.62, 2.25]].map(([x, z], i) => rider(
        `schuetze${i + 1}`, `Schütze ${i + 1}`, [x, 0.62, z], [x * 0.85, 1.56, z], [[0, 0, 3.9], [x < 0 ? -2.6 : 2.6, 0, z], [x * 1.4, 0, 3.9]], 'closed', { dist: 9, height: 3.9, pivot: 2.2 },
        i >= 6 ? { stand: [x * 0.7, 0.62, 1.85], yaw: [x < 0 ? -PI : -1.2, x < 0 ? 1.2 : PI], fireLabel: 'Dachluke: feuern', hatch: 'loader' } : {},
      )),
    ],
    hatches: {
      driver: { space: 'hull', pos: [-0.5, 1.86, -1.78], r: 0.27 },
      commander: { space: 'turret', pos: [0, 0.06, 0.15], r: 0.3 },
      loader: { space: 'hull', pos: [0, 1.86, 1.55], r: 0.42 },
    },
    troop: { z0: -0.45, z1: 2.45, floor: 0.6, roof: 1.78, halfW: 1.12 },
    ramp: { z: 2.66, y0: 0.5, y1: 1.72, w: 2.0, kind: 'rampe' },
    crew: { switchTime: 1.0, faceTol: 0.6 },
    lights: [[-1.05, 1.5, -2.42], [1.05, 1.5, -2.42]],
    exhaust: [1.2, 1.82, -1.4],
  },

  /* --------------------------------------------------------- RS-8 Waran (Radschützenpanzer 8×8) */
  // ~26 t, vier Achsen (vordere zwei gelenkt), Fahrer vorn links, Motor vorn rechts, ferngerichteter Einmann-Turm mit 30-mm-
  // Maschinenkanone (Pfeil- und Sprenggranaten im Doppelgurt) und Koaxial-MG, Nebelwurfbecher, Kampfraum für acht mit
  // hydraulischer Heckrampe und zwei Dachluken.
  rsp: {
    id: 'rsp', name: 'RS-8 Waran', cls: 'Radschützenpanzer', era: 'modern', drive: 'wheeled', model: 'rsp', sound: 'diesel',
    transport: true,
    health: 720, armored: true, respawn: 70, wreckTime: 20,
    smallArmsMult: 0, explosiveMult: 0.5, ramMult: 0.35,
    mass: 26000, com: [0, 1.15, 0.05],
    hullBox: [0, 1.48, 0, 1.45, 0.8, 3.85],
    turretBox: [0, 0.3, 0.05, 0.95, 0.3, 1.05],
    turretPivot: [0, 2.28, -0.55],
    gunPivot: [0, 0.32, -0.92],
    muzzle: [0, 0, -3.15],
    coax: [0.3, 0.02, -0.4],
    cmgPivot: [-0.5, 0.72, 0.2], cmgMuzzle: [0, 0, -0.3],
    gunLimits: { min: deg(-9), max: deg(45) },
    traverse: deg(60), elevate: deg(40),
    wheels: { radius: 0.6, rest: 0.34, stiffness: 340000, damping: 32000, x: 1.12, z: [-2.55, -1.15, 0.65, 2.05], steer: [true, true, false, false], drive: [true, true, true, true], maxSteer: deg(28) },
    steerK: [1, 0.55, 0, 0],
    engine: wheelEngine({ curve: TRUCK_TQ, k: 0.85, rated: 2100, idle: 600, gears: { '-1': 6.5, 1: 6.5, 2: 4.1, 3: 2.6, 4: 1.7, 5: 1.15, 6: 0.85 }, F: 5.2, r: 0.6, brake: 260000, vmax: 27, vrev: 6, air: 4.2, eb: [220, 0.12] }),
    drivetrain: { powerKW: 400, pwr: 15.4, gears: '6/1 (Automatik)', vmax: 100 },
    grip: { long: 1.08, lat: 1.0, handbrakeLat: 0.42, rollInfluence: 0.28 },
    drag: 0.55, angularDamp: 1.9,
    zones: { hull: { label: 'Wanne', hp: 720 }, engine: { label: 'Motor', hp: 210 }, tracks: { label: 'Räder', hp: 260 }, turret: { label: 'Turm', hp: 200 } },
    armor: { hull: { front: [32, 58], side: [20, 12], rear: [16, 10], top: [12, 0], bottom: [16, 0] }, turret: { front: [30, 45], side: [16, 10], rear: [12, 0], top: [10, 0], mantlet: [26, 0] } },
    seats: [
      { id: 'driver', label: 'Fahrer', drive: true, weapons: [], pos: [-0.62, 0.95, -2.85], exit: [[-2.8, 0, -2.2], [2.8, 0, -2.2], [0, 0, 5.2], [0, 0, -5.0]],
        views: [
          { id: 'spiegel', label: 'Winkelspiegel', space: 'hull', pos: [-0.62, 2.12, -3.02], look: 'rel', yaw: [-0.65, 0.65], pitch: [-0.2, 0.25], zoom: [1.2], overlay: 'slit' },
          { id: 'luke', label: 'Luke offen', space: 'hull', pos: [-0.62, 2.72, -2.85], look: 'rel', yaw: [-2.6, 2.6], pitch: [-0.6, 0.8], zoom: [1, 1.8], exposed: true, hatch: 'driver', pin: [-0.62, 1.52, -2.85] },
          { id: 'innen', label: 'Fahrerplatz', space: 'hull', pos: [-0.62, 1.95, -2.7], look: 'rel', yaw: [-2.0, 2.0], pitch: [-0.9, 0.5], zoom: [1], interior: true },
          out(11, 4.6, 2.6),
        ] },
      { id: 'gunner', label: 'Richtschütze', weapons: ['mbt_ap', 'mbt_he', 'mbt_coax'], mount: 'gun', pos: [0.4, 1.15, -0.55], exit: [[2.8, 0, -0.5], [-2.8, 0, -0.5], [0, 0, 5.2]],
        views: [
          { id: 'optik', label: 'Zieloptik', space: 'gun', pos: [0.48, 0.38, 0.3], look: 'mount', zoom: [3, 8], overlay: 'optic' },
          { id: 'weit', label: 'Weitwinkel', space: 'gun', pos: [0.48, 0.38, 0.3], look: 'mount', zoom: [1.2, 2.5], overlay: 'wide' },
          out(11, 4.6, 2.6, 'mount'),
        ] },
      { id: 'commander', label: 'Kommandant', weapons: [], mount: 'cmg', pos: [-0.45, 1.2, -0.3], exit: [[-2.8, 0, -0.2], [2.8, 0, -0.2], [0, 0, 5.2]],
        views: [
          { id: 'periskop', label: 'Rundblickoptik', space: 'cupola', pos: [0, 0.04, -0.04], look: 'mount', zoom: [2, 6], overlay: 'peri' },
          { id: 'luke', label: 'Luke offen', space: 'turret', pos: [-0.5, 1.15, 0.3], look: 'relTurret', yaw: [-PI, PI], pitch: [-0.6, 0.8], zoom: [1, 4, 7], overlay: 'binocular', exposed: true, hatch: 'commander', pin: [-0.5, 0.05, 0.25] },
          out(11, 4.7, 2.7, 'relTurret'),
        ] },
      ...[[-0.68, 0.55], [0.68, 0.85], [-0.68, 1.15], [0.68, 1.5], [-0.68, 1.85], [0.68, 2.2], [-0.68, 2.55], [0.68, 2.9]].map(([x, z], i) => rider(
        `schuetze${i + 1}`, `Schütze ${i + 1}`, [x, 0.95, z], [x * 0.88, 1.9, z], [[x * 0.5, 0, 5.3], [x < 0 ? -2.8 : 2.8, 0, z], [0, 0, 5.3]], 'closed', { dist: 11, height: 4.6, pivot: 2.6 },
        i >= 6 ? { stand: [x * 0.75, 0.98, 2.75], yaw: [x < 0 ? -PI : -0.9, x < 0 ? 0.9 : PI], fireLabel: 'Dachluke: feuern', hatch: 'loader' } : {},
      )),
    ],
    hatches: {
      driver: { space: 'hull', pos: [-0.62, 2.26, -2.85], r: 0.28 },
      commander: { space: 'turret', pos: [-0.5, 0.6, 0.25], r: 0.3 },
      loader: { space: 'hull', pos: [0, 2.27, 2.7], r: 0.36 },
    },
    // Kampfraum der Schützen hinten (Aufbau wie SZ-8: Bänke, Rampe, Dachluken); Turmraum klein (Einmann-Turm)
    interior: { scale: 0.8, shift: [0, -0.05, 0.05], breech: [0, 0.42, -0.55], breechScale: 0.42, loaderEye: [0.5, 0.62, 0.35], rack: [0, 0.4, 0.9], rackGrid: [6, 2], basket: false },
    troop: { z0: 0.15, z1: 3.62, floor: 0.95, roof: 2.18, halfW: 1.18 },
    ramp: { z: 3.89, y0: 0.82, y1: 2.12, w: 2.0, kind: 'rampe' },
    crew: { switchTime: 1.1, faceTol: 0.6 },
    ammo: { mbt_ap: 160, mbt_he: 240 },
    lights: [[-1.15, 1.72, -3.82], [1.15, 1.72, -3.82]],
    exhaust: [1.42, 2.05, -1.2],
    weaponMods: {
      mbt_ap: { name: '30 mm Pfeilgeschoss (Maschinenkanone)', speed: 1400, life: 1.3, vehicleDamage: 46, actorDamage: 75, reload: 0.32, reloadNoLoader: 0.32, splash: { radius: 0.9, maxDamage: 28 }, shake: 0.08 },
      mbt_he: { name: '30 mm Sprenggranate (Maschinenkanone)', speed: 1080, life: 2.0, vehicleDamage: 26, actorDamage: 95, reload: 0.32, reloadNoLoader: 0.32, splash: { radius: 3.0, maxDamage: 70, innerRadius: 0.8, minDamage: 12 }, shake: 0.08 },
    },
  },

  /* --------------------------------------------------------- LKW-5 Ackergaul (Lkw mit Plane, unbewaffnet) */
  // 6×6-Lastwagen (~9,5 t, 5 t Nutzlast): Frontlenker-Kabine, Ladefläche mit Bordwänden, Spriegel und Plane, zwei Sitzbänke
  // längs (je vier), Rückstrahler, Reservrad hinter der Kabine. Diesel 180 kW, Allrad, Einzelbereifung im Gelände.
  lkw: {
    id: 'lkw', name: 'LKW-5 Ackergaul', cls: 'Lkw (Truppentransport)', era: 'modern', drive: 'wheeled', model: 'lkw', sound: 'diesel',
    transport: true,
    health: 560, armored: false, respawn: 45, wreckTime: 16,
    smallArmsMult: 0.38, explosiveMult: 0.9, ramMult: 0.55,
    mass: 9500, com: [0, 1.25, -0.2],
    hullBox: [0, 1.72, 0.45, 1.25, 1.52, 4.0],
    // Kabinenfenster; Plane (Kugeln gehen durch) bzw. Luft hinter der Kabine
    glassBand: [[1.95, 2.85, -3.6, -2.35], [1.55, 3.25, -1.75, 4.45]],
    wheels: { radius: 0.56, rest: 0.3, stiffness: 300000, damping: 26000, x: 1.0, z: [-2.6, 1.15, 2.55], steer: [true, false, false], drive: [true, true, true], maxSteer: deg(32) },
    engine: wheelEngine({ curve: TRUCK_TQ, k: 0.5, rated: 2300, idle: 600, gears: { '-1': 6.8, 1: 6.8, 2: 4.3, 3: 2.8, 4: 1.85, 5: 1.25, 6: 0.95 }, F: 5.6, r: 0.56, brake: 120000, vmax: 24, vrev: 5.5, air: 3.4, eb: [150, 0.1] }),
    drivetrain: { powerKW: 180, pwr: 18.9, gears: '6/1 (Automatik)', vmax: 86 },
    grip: { long: 1.05, lat: 1.0, handbrakeLat: 0.36, rollInfluence: 0.32 },
    drag: 0.5, angularDamp: 1.8,
    zones: { hull: { label: 'Fahrgestell', hp: 560 }, engine: { label: 'Motor', hp: 200 }, tracks: { label: 'Räder', hp: 230 } },
    seats: [
      cabSeat('driver', 'Fahrer', [-0.55, 1.6, -3.0], [-0.55, 2.52, -3.0], [[-2.4, 0, -3.0], [2.4, 0, -3.0], [0, 0, -5.4], [0, 0, 5.6]], { dist: 12, height: 4.8, pivot: 2.6 }, true),
      cabSeat('passenger', 'Beifahrer', [0.55, 1.6, -3.0], [0.55, 2.52, -3.0], [[2.4, 0, -3.0], [-2.4, 0, -3.0], [0, 0, 5.6]], { dist: 12, height: 4.8, pivot: 2.6 }),
      ...[-1.15, -0.15, 0.85, 1.85].flatMap((z, k) => [-1, 1].map((sx) => rider(
        `bank${sx < 0 ? 'l' : 'r'}${k + 1}`, `Ladefläche ${sx < 0 ? 'links' : 'rechts'} ${k + 1}`, [sx * 0.66, 1.42, z], [sx * 0.62, 2.48, z],
        [[sx * 0.6, 0, 5.6], [0, 0, 5.6], [sx * 2.4, 0, z]], 'cabin', { dist: 12, height: 4.8, pivot: 2.6 },
      ))),
    ],
    ramp: { z: 4.43, y0: 1.42, y1: 2.15, w: 2.36, kind: 'bordwand' },
    lights: [[-0.95, 1.28, -3.55], [0.95, 1.28, -3.55]],
    exhaust: [1.15, 3.05, -2.25],
  },

  /* --------------------------------------------------------- GMW-6 Murmel (geländegängiger Mannschaftswagen) */
  // Leichter 4×4 (~3,4 t) mit Portalachsen und Doppelkabine (2 vorn), offene Ladefläche mit Klappbänken für sechs,
  // Überrollbügel, Heckklappe. Diesel 120 kW.
  gmw: {
    id: 'gmw', name: 'GMW-6 Murmel', cls: 'Mannschaftswagen', era: 'modern', drive: 'wheeled', model: 'gmw', sound: 'diesel',
    transport: true,
    health: 380, armored: false, respawn: 35, wreckTime: 15,
    smallArmsMult: 0.42, explosiveMult: 1.0, ramMult: 0.9,
    mass: 3400, com: [0, 0.85, 0],
    hullBox: [0, 1.25, 0.15, 1.02, 0.95, 2.65],
    glassBand: [[1.55, 2.25, -1.85, -0.55], [1.42, 2.6, -0.3, 2.85]],
    wheels: { radius: 0.45, rest: 0.32, stiffness: 95000, damping: 8200, x: 0.88, z: [-1.65, 1.55], steer: [true, false], drive: [true, true], maxSteer: deg(34) },
    engine: wheelEngine({ curve: TRUCK_TQ, k: 0.22, rated: 3200, idle: 700, gears: { '-1': 4.6, 1: 4.6, 2: 2.8, 3: 1.8, 4: 1.25, 5: 0.95 }, F: 4.9, r: 0.45, brake: 42000, vmax: 30, vrev: 7.5, air: 1.9, eb: [50, 0.025] }),
    drivetrain: { powerKW: 120, pwr: 35, gears: '5/1 (Automatik)', vmax: 108 },
    grip: { long: 1.12, lat: 1.1, handbrakeLat: 0.32, rollInfluence: 0.24 },
    drag: 0.45, angularDamp: 1.5,
    zones: { hull: { label: 'Karosserie', hp: 380 }, engine: { label: 'Motor', hp: 150 }, tracks: { label: 'Räder', hp: 170 } },
    seats: [
      cabSeat('driver', 'Fahrer', [-0.45, 1.0, -1.15], [-0.45, 1.98, -1.15], [[-2.1, 0, -1.15], [2.1, 0, -1.15], [0, 0, -3.6], [0, 0, 3.8]], { dist: 8.5, height: 3.4, pivot: 1.8 }, true),
      cabSeat('passenger', 'Beifahrer', [0.45, 1.0, -1.15], [0.45, 1.98, -1.15], [[2.1, 0, -1.15], [-2.1, 0, -1.15], [0, 0, 3.8]], { dist: 8.5, height: 3.4, pivot: 1.8 }),
      ...[0.3, 1.1, 1.9].flatMap((z, k) => [-1, 1].map((sx) => rider(
        `bank${sx < 0 ? 'l' : 'r'}${k + 1}`, `Ladefläche ${sx < 0 ? 'links' : 'rechts'} ${k + 1}`, [sx * 0.62, 1.12, z], [sx * 0.6, 2.02, z],
        [[sx * 0.6, 0, 3.9], [sx * 2.1, 0, z], [0, 0, 3.9]], 'open', { dist: 8.5, height: 3.4, pivot: 1.8 },
        { stand: [sx * 0.5, 1.12, z], yaw: [-PI, PI] },
      ))),
    ],
    lights: [[-0.72, 1.12, -2.72], [0.72, 1.12, -2.72]],
    exhaust: [0.9, 0.55, 2.7],
  },

  /* --------------------------------------------------------- GW-7 Steinbock (Geländewagen mit MG-Ring) */
  // Schwerer offener Geländewagen (~3,2 t), Klappscheibe, Kastenaufbau hinten mit Drehring und schwerem MG auf
  // Schwenkarm, Kanisterhalter, Ersatzrad, Funkantenne. 2 vorn, MG-Schütze, zwei Mitfahrer hinten (feuern aus dem Aufbau).
  gwmg: {
    id: 'gwmg', name: 'GW-7 Steinbock', cls: 'Geländewagen (MG-Ring)', era: 'modern', drive: 'wheeled', model: 'gwmg', sound: 'car',
    transport: true,
    health: 400, armored: false, respawn: 32, wreckTime: 15,
    smallArmsMult: 0.4, explosiveMult: 1.0, ramMult: 0.9,
    mass: 3200, com: [0, 0.7, 0.05],
    hullBox: [0, 1.05, 0.05, 1.04, 0.62, 2.5],
    glassBand: [[1.2, 1.7, -1.4, 2.6]],
    wheels: { radius: 0.44, rest: 0.36, stiffness: 78000, damping: 7000, x: 0.9, z: [-1.5, 1.45], steer: [true, false], drive: [true, true], maxSteer: deg(34) },
    engine: wheelEngine({ curve: [[700, 210], [800, 260], [1500, 360], [2500, 420], [3500, 400], [4500, 330], [5000, 270], [5400, 0]], k: 1, rated: 5000, idle: 800, gears: { '-1': 5.6, 1: 5.28, 2: 3.42, 3: 2.22, 4: 1.44 }, F: 4.9, r: 0.44, brake: 36000, vmax: 31, vrev: 8.6, air: 1.7, eb: [25, 0.012] }),
    drivetrain: { powerKW: 170, pwr: 53, gears: '4/1 (Automatik)', vmax: 112 },
    grip: { long: 1.15, lat: 1.15, handbrakeLat: 0.32, rollInfluence: 0.2 },
    drag: 0.45, angularDamp: 1.4,
    mgPivot: [0, 2.12, 0.55],
    mgMuzzle: [0, 0.08, -1.15],
    mgLimits: { min: deg(-14), max: deg(45) },
    zones: { hull: { label: 'Karosserie', hp: 400 }, engine: { label: 'Motor', hp: 150 }, tracks: { label: 'Räder', hp: 170 } },
    seats: [
      cabSeat('driver', 'Fahrer', [-0.46, 0.66, -0.25], [-0.46, 1.66, -0.22], [[-2.1, 0, -0.2], [2.1, 0, -0.2], [0, 0, -3.5], [0, 0, 3.5]], { dist: 8, height: 3.4, pivot: 1.7 }, true),
      { id: 'gunner', label: 'MG-Schütze', weapons: ['jeep_mg'], mount: 'mg', exposed: true, pos: [0, 1.02, 1.05], exit: [[2.1, 0, 1.0], [-2.1, 0, 1.0], [0, 0, 3.5]],
        views: [{ id: 'mg', label: 'MG', space: 'mg', pos: [0, 0.32, 0.62], look: 'mount', zoom: [1, 2], exposed: true }, out(7.8, 3.7, 2.0, 'mount')] },
      cabSeat('passenger', 'Beifahrer', [0.46, 0.66, -0.25], [0.46, 1.66, -0.22], [[2.1, 0, -0.2], [-2.1, 0, -0.2], [0, 0, 3.5]], { dist: 8, height: 3.4, pivot: 1.7 }),
      ...[-1, 1].map((sx) => rider(`hinten${sx < 0 ? 'l' : 'r'}`, `Aufbau ${sx < 0 ? 'links' : 'rechts'}`, [sx * 0.6, 0.86, 1.85], [sx * 0.6, 1.8, 1.9],
        [[sx * 2.1, 0, 1.8], [0, 0, 3.6]], 'open', { dist: 8, height: 3.4, pivot: 1.7 }, { stand: [sx * 0.62, 0.86, 1.95], yaw: sx < 0 ? [-PI, 0.3] : [-0.3, PI] })),
    ],
    lights: [[-0.7, 1.08, -2.45], [0.7, 1.08, -2.45]],
    exhaust: [0.85, 0.5, 2.5],
  },

  /* --------------------------------------------------------- ZK-8 Packesel (Halbkettenwagen, ungepanzert, 2. WK) */
  // Mittlerer Zugkraftwagen (~9 t): lange Motorhaube, offener Aufbau mit drei Sitzreihen und Heckbank, Faltverdeck hinten
  // zusammengelegt, Kettenlaufwerk mit sechs Doppel-Laufrollen, gelenkte Vorderräder. Benziner 110 kW. 10 Sitze, alle offen.
  hkw: {
    id: 'hkw', name: 'ZK-8 Packesel', cls: 'Halbkettenwagen (Zugkraftwagen)', era: 'wk2', drive: 'wheeled', model: 'hkw', sound: 'car',
    transport: true, halftrack: true, noThermal: true,
    health: 480, armored: false, respawn: 45, wreckTime: 16,
    smallArmsMult: 0.38, explosiveMult: 0.95, ramMult: 0.5,
    mass: 9000, com: [0, 0.95, 0.35],
    hullBox: [0, 1.25, 0.2, 1.22, 0.98, 3.3],
    glassBand: [[1.35, 2.45, -0.95, 3.6]],
    wheels: { radius: 0.48, rest: 0.3, stiffness: 240000, damping: 22000, x: 0.98, z: [-2.55, -0.15, 1.05, 2.25], steer: [true, false, false, false], drive: [false, true, true, true], maxSteer: deg(30) },
    track: { z0: -0.75, z1: 2.95, r: 0.36, w: 0.4, x: 0.98, sprocket: [-0.7, 0.62, 0.36], idler: [2.95, 0.5, 0.33], road: [-0.25, 0.4, 1.05, 1.7, 2.35] },
    engine: wheelEngine({ curve: WW2_TQ, k: 0.24, rated: 2600, idle: 600, gears: { '-1': 7.2, 1: 7.2, 2: 4.6, 3: 3.0, 4: 2.0, 5: 1.35 }, F: 4.4, r: 0.48, brake: 90000, vmax: 14.5, vrev: 3.6, air: 2.6, trac: HT_TR, conv: 1.7, eb: [140, 0.1] }),
    drivetrain: { powerKW: 110, pwr: 12.2, gears: '4/1 + Gelände', vmax: 52 },
    grip: { long: 1.15, lat: 1.35, handbrakeLat: 0.6, rollInfluence: 0.3 },
    drag: 0.6, angularDamp: 2.0,
    zones: { hull: { label: 'Fahrgestell', hp: 480 }, engine: { label: 'Motor', hp: 160 }, tracks: { label: 'Laufwerk', hp: 220 } },
    seats: [
      cabSeat('driver', 'Fahrer', [-0.5, 1.02, -0.62], [-0.5, 2.05, -0.6], [[-2.3, 0, -0.6], [2.3, 0, -0.6], [0, 0, -4.4], [0, 0, 4.4]], { dist: 11, height: 4.4, pivot: 2.2 }, true),
      cabSeat('beifahrer', 'Beifahrer', [0.5, 1.02, -0.62], [0.5, 2.05, -0.6], [[2.3, 0, -0.6], [-2.3, 0, -0.6], [0, 0, 4.4]], { dist: 11, height: 4.4, pivot: 2.2 }),
      ...[[0, -0.62], [-0.55, 0.35], [0, 0.35], [0.55, 0.35], [-0.55, 1.3], [0, 1.3], [0.55, 1.3], [-0.45, 2.6]].map(([x, z], i) => rider(
        `reihe${i + 1}`, i === 0 ? 'Vorderbank Mitte' : i < 4 ? `Zweite Reihe ${i}` : i < 7 ? `Dritte Reihe ${i - 3}` : 'Heckbank',
        [x, 1.02, z], [x, 2.05, z + 0.02], [[x < 0 ? -2.3 : 2.3, 0, z], [0, 0, 4.4], [x < 0 ? 2.3 : -2.3, 0, z]], 'open', { dist: 11, height: 4.4, pivot: 2.2 },
        { stand: [x * 0.9, 1.02, z], yaw: [-PI, PI] },
      )),
    ],
    lights: [[-0.62, 1.48, -3.4], [0.62, 1.48, -3.4]],
    exhaust: [0.9, 0.55, -1.2],
  },

  /* --------------------------------------------------------- SPW-41 Hamster (Schützenpanzerwagen, Halbkette, 2. WK) */
  // Leicht gepanzerter Halbkettenwagen (~8,5 t), geknickte Panzerplatten (8–14 mm), offener Kampfraum, MG mit Schutzschild
  // über dem Fahrerhaus, Sitzbänke längs, zweiflügelige Hecktür. 3 Mann + 7 Schützen, alle Schützen feuern über die Bordwand.
  spw: {
    id: 'spw', name: 'SPW-41 Hamster', cls: 'Schützenpanzerwagen', era: 'wk2', drive: 'wheeled', model: 'spw', sound: 'car',
    transport: true, halftrack: true, noThermal: true,
    health: 520, armored: true, respawn: 50, wreckTime: 18,
    smallArmsMult: 0.05, explosiveMult: 0.75, ramMult: 0.45,
    mass: 8500, com: [0, 0.98, 0.3],
    hullBox: [0, 1.22, 0.15, 1.1, 0.9, 3.05],
    glassBand: [[1.98, 2.6, -0.75, 3.3]],
    wheels: { radius: 0.44, rest: 0.3, stiffness: 230000, damping: 21000, x: 0.92, z: [-2.25, -0.2, 0.95, 2.1], steer: [true, false, false, false], drive: [false, true, true, true], maxSteer: deg(30) },
    track: { z0: -0.75, z1: 2.75, r: 0.33, w: 0.36, x: 0.92, sprocket: [-0.72, 0.58, 0.33], idler: [2.75, 0.48, 0.3], road: [-0.2, 0.45, 1.1, 1.75, 2.3] },
    engine: wheelEngine({ curve: WW2_TQ, k: 0.22, rated: 2800, idle: 600, gears: { '-1': 7.2, 1: 7.2, 2: 4.6, 3: 3.0, 4: 2.0, 5: 1.35 }, F: 4.5, r: 0.44, brake: 85000, vmax: 14.2, vrev: 3.6, air: 2.4, trac: HT_TR, conv: 1.7, eb: [130, 0.1] }),
    drivetrain: { powerKW: 100, pwr: 11.8, gears: '4/1 + Gelände', vmax: 50 },
    grip: { long: 1.15, lat: 1.35, handbrakeLat: 0.6, rollInfluence: 0.3 },
    drag: 0.6, angularDamp: 2.0,
    mgPivot: [0, 2.06, -0.72],
    mgMuzzle: [0, 0.04, -0.95],
    mgLimits: { min: deg(-10), max: deg(35) },
    mgYaw: [-0.9, 0.9],
    zones: { hull: { label: 'Wanne', hp: 520 }, engine: { label: 'Motor', hp: 160 }, tracks: { label: 'Laufwerk', hp: 210 } },
    armor: { hull: { front: [14, 30], side: [8, 30], rear: [8, 10], top: [3, 0], bottom: [6, 0] }, turret: { front: [8, 10], side: [6, 0], rear: [6, 0], top: [3, 0], mantlet: [8, 0] } },
    seats: [
      { id: 'driver', label: 'Fahrer', drive: true, weapons: [], pos: [-0.42, 0.85, -1.15], exit: [[-2.2, 0, -1.0], [2.2, 0, -1.0], [0, 0, 4.3], [0, 0, -4.2]],
        views: [
          { id: 'sehklappe', label: 'Sehklappe', space: 'hull', pos: [-0.42, 1.76, -1.32], look: 'rel', yaw: [-0.6, 0.6], pitch: [-0.25, 0.2], zoom: [1.1], overlay: 'slit' },
          { id: 'offen', label: 'Über die Panzerung', space: 'hull', pos: [-0.42, 2.15, -1.1], look: 'rel', yaw: [-2.4, 2.4], pitch: [-0.6, 0.8], zoom: [1, 1.6], exposed: true, crouch: true },
          out(10.5, 4.3, 2.2),
        ] },
      { id: 'gunner', label: 'MG-Schütze', weapons: ['wk2_mg'], mount: 'mg', exposed: true, pos: [0, 0.92, -0.32], exit: [[2.2, 0, -0.3], [-2.2, 0, -0.3], [0, 0, 4.3]],
        views: [{ id: 'mg', label: 'MG mit Schild', space: 'mg', pos: [0, 0.3, 0.62], look: 'mount', zoom: [1, 1.8], exposed: true }, out(10, 4.3, 2.2, 'mount')] },
      { id: 'beifahrer', label: 'Kommandant', weapons: [], pos: [0.42, 0.85, -1.15], exit: [[2.2, 0, -1.0], [-2.2, 0, -1.0], [0, 0, 4.3]],
        views: [
          { id: 'sehklappe', label: 'Sehklappe', space: 'hull', pos: [0.42, 1.76, -1.32], look: 'rel', yaw: [-0.6, 0.6], pitch: [-0.25, 0.2], zoom: [1.1], overlay: 'slit' },
          { id: 'offen', label: 'Fernglas über die Panzerung', space: 'hull', pos: [0.42, 2.15, -1.1], look: 'rel', yaw: [-2.4, 2.4], pitch: [-0.6, 0.8], zoom: [1, 4, 6], overlay: 'binocular', exposed: true, crouch: true },
          out(10.5, 4.3, 2.2),
        ] },
      ...[[-0.6, 0.35], [0.6, 0.55], [-0.6, 1.05], [0.6, 1.25], [-0.6, 1.75], [0.6, 1.95], [-0.6, 2.45]].map(([x, z], i) => rider(
        `schuetze${i + 1}`, `Schütze ${i + 1}`, [x, 0.9, z], [x * 0.8, 1.86, z], [[x * 0.4, 0, 4.4], [x < 0 ? -2.2 : 2.2, 0, z], [0, 0, 4.4]], 'open', { dist: 10.5, height: 4.3, pivot: 2.2 },
        { stand: [x * 0.82, 0.9, z], yaw: x < 0 ? [-PI, 0.5] : [-0.5, PI], fireLabel: 'Über die Bordwand feuern' },
      )),
    ],
    ramp: { z: 3.18, y0: 0.6, y1: 1.95, w: 1.1, kind: 'tueren' },
    lights: [[-0.62, 1.4, -3.0], [0.62, 1.4, -3.0]],
    exhaust: [0.85, 0.55, -1.0],
  },
};

/** Rollen-Stellplätze der Karten → Typ je Panzergeneration (modern, kk, wk2, wk1). */
export const ROLE_TYPES = {
  modern: { truck: 'lkw', utility: 'gmw', apc: 'rsp', apc2: 'mtw', gwmg: 'gwmg', light: 'lp21', heavy: 'mbt' },
  kk: { truck: 'lkw', utility: 'gmw', apc: 'mtw', apc2: 'mtw', gwmg: 'gwmg', light: 'lp21', heavy: 'kks' },
  wk2: { truck: 'hkw', utility: 'hkw', apc: 'spw', apc2: 'spw', gwmg: 'jeep', light: 'wk2l', heavy: 'wk2s' },
  wk1: { truck: 'hkw', utility: 'hkw', apc: 'spw', apc2: 'spw', gwmg: 'jeep', light: 'wk1l', heavy: 'wk1' },
};
export const ROLE_KINDS = new Set(Object.keys(ROLE_TYPES.modern));
