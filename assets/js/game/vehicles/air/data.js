// NULLPUNKT — Luftfahrzeuge: reine Daten (ohne three). vehicles/data.js hängt AIR_VEHICLES an VEHICLES und AIR_WEAPONS an
// VEHICLE_WEAPONS an (ans Ende → bisherige Typ-/Waffen-Indizes unverändert).
//
// Frei erfundene Muster (keine echten Vorbilder/Marken):
//   KHS-4 Sperber – Kampf- und Transporthubschrauber: Tandemcockpit (Schütze vorn, Pilot hinten erhöht), Truppenraum mit
//                   Schiebetüren für 4 Mann, Stummelflügel mit Raketenbehältern, 30-mm-Kinnturm, Fünfblatt-Hauptrotor.
//   JK-9 Falke    – einsitziger Kampfjet: Pfeil-Deltaflügel, ein Triebwerk mit Nachbrenner, Doppelseitenleitwerk,
//                   Bordkanone im Rumpf, Raketenbehälter und Freifallbomben unter den Flügeln.
//
// Koordinaten wie data.js: Meter, X rechts, Y oben, −Z vorn. Ursprung = Bodenkontakt unter der Rumpfmitte (Fahrwerk in
// Ruhe). def.air = 'heli' | 'jet' kennzeichnet Luftfahrzeuge (index.js/net.js/hud wählen danach), def.flight = Flugmodell.
//
// Sitze: drive = Pilot (Flugsteuerung), mount 'fixed' = starre Waffen in Flugrichtung (Aufhängepunkte weapons[].hp),
// mount 'mg' = Kinnturm (Gier um ±mgYawLimit, Nicken mgLimits). cabin: Insassen sitzen als Figur im Modell (setOccupant).
// views[].air: Cockpit-Sicht rollt mit dem Luftfahrzeug (air/camera.js).

const deg = (d) => (d * Math.PI) / 180;

/**
 * Bordwaffen. kind 'mg' = Hitscan über combat.fireHitscan (Kanonen mit he: kleine Splitterwirkung am Einschlag),
 * kind 'rocket'/'bomb' = ballistische Körper über den ShellPool (projectiles.js; look → Darstellung, trail → Rauchspur,
 * selfSafe → so lange trifft der Körper das eigene Luftfahrzeug nicht). hp = Aufhängepunkte (lokal, abwechselnd).
 */
export const AIR_WEAPONS = {
  // Kinnturm des Sperber (Schütze): 30-mm-Maschinenkanone, Sprenggeschosse
  khs_kan: {
    id: 'khs_kan', name: '30-mm-Maschinenkanone', short: 'MK', kind: 'mg', caliber: '50bmg',
    rpm: 330, mag: 150, reload: 6, spread: 0.0045, range: 900, profile: 'ar_heavy',
    damage: { max: 60, min: 46, rangeStart: 80, rangeEnd: 600 }, headMult: 1.2, limbMult: 1, penetration: 0.8,
    vehicleMult: 1.0, antiMateriel: true, tracerEvery: 2, icon: 'mg', he: { radius: 2.6, maxDamage: 38 },
  },
  // Pilot des Sperber ohne Schützen: dieselbe Kanone starr nach vorn (Kinnturm in Grundstellung)
  khs_kanp: {
    id: 'khs_kanp', name: '30-mm-Kanone (starr)', short: 'MK', kind: 'mg', caliber: '50bmg',
    rpm: 330, mag: 150, reload: 6, spread: 0.006, range: 900, profile: 'ar_heavy',
    damage: { max: 60, min: 46, rangeStart: 80, rangeEnd: 600 }, headMult: 1.2, limbMult: 1, penetration: 0.8,
    vehicleMult: 1.0, antiMateriel: true, tracerEvery: 2, icon: 'mg', he: { radius: 2.6, maxDamage: 38 }, hp: [[0, 0.68, -7.45]],
  },
  // 80-mm-Raketen aus zwei Behältern (je 7), paarweise abwechselnd links/rechts
  khs_rak: {
    id: 'khs_rak', name: '80-mm-Raketen', short: 'RAK', kind: 'rocket', look: 'rocket', trail: true,
    speed: 320, gravity: 2.5, life: 4.2, mag: 14, rpm: 300, reload: 14, selfSafe: 0.6,
    vehicleDamage: 260, actorDamage: 160, splash: { radius: 6, maxDamage: 140, innerRadius: 1.4, minDamage: 20 },
    penetrating: false, shake: 0.18, icon: 'shell', hp: [[-2.65, 1.62, -1.35], [2.65, 1.62, -1.35]],
  },
  // Falke: 27-mm-Bordkanone im linken Rumpf
  jk_kan: {
    id: 'jk_kan', name: '27-mm-Bordkanone', short: 'BK', kind: 'mg', caliber: '50bmg',
    rpm: 1100, mag: 180, reload: 7, spread: 0.0055, range: 1100, profile: 'ar_heavy',
    damage: { max: 52, min: 40, rangeStart: 100, rangeEnd: 700 }, headMult: 1.2, limbMult: 1, penetration: 0.8,
    vehicleMult: 0.9, antiMateriel: true, tracerEvery: 3, icon: 'mg', he: { radius: 2.0, maxDamage: 30 }, hp: [[-0.62, 1.95, -5.6]],
  },
  jk_rak: {
    id: 'jk_rak', name: '70-mm-Raketen', short: 'RAK', kind: 'rocket', look: 'rocket', trail: true,
    speed: 380, gravity: 2.5, life: 4.0, mag: 12, rpm: 360, reload: 16, selfSafe: 0.6,
    vehicleDamage: 240, actorDamage: 150, splash: { radius: 5.5, maxDamage: 130, innerRadius: 1.3, minDamage: 20 },
    penetrating: false, shake: 0.12, icon: 'shell', hp: [[-3.15, 1.18, 0.2], [3.15, 1.18, 0.2]],
  },
  // 250-kg-Freifallbomben (Schwerkraft, Anfangsgeschwindigkeit = Flugzeug), großer Wirkradius
  jk_bmb: {
    id: 'jk_bmb', name: '250-kg-Bomben', short: 'BMB', kind: 'bomb', look: 'bomb',
    speed: 2, gravity: 9.81, life: 30, mag: 4, rpm: 150, reload: 22, selfSafe: 2.5, drop: true,
    vehicleDamage: 650, actorDamage: 300, splash: { radius: 15, maxDamage: 300, innerRadius: 4, minDamage: 40 },
    penetrating: false, shake: 0.3, icon: 'shell', hp: [[-1.9, 1.05, 0.6], [1.9, 1.05, 0.6], [-1.15, 1.05, 0.9], [1.15, 1.05, 0.9]],
  },
};

const tpHeli = { dist: 17, height: 5.5, pivot: 3.2 };
const tpJet = { dist: 21, height: 5.2, pivot: 2.6 };
const passView = (x, z) => [
  { id: 'sitz', label: 'Truppenraum', space: 'hull', pos: [x, 2.05, z], look: 'rel', yaw: [-2.6, 2.6], pitch: [-0.9, 0.8], zoom: [1], air: true, interior: true },
  { id: 'aussen', label: 'Außenansicht', look: 'rel', yaw: [-3.1, 3.1], pitch: [-0.9, 0.8], zoom: [1], tp: tpHeli },
];

export const AIR_VEHICLES = {
  heli: {
    id: 'heli', name: 'KHS-4 Sperber', cls: 'Kampfhubschrauber', air: 'heli', model: 'heli', sound: 'rotor',
    health: 640, armored: false, respawn: 75, wreckTime: 24, noThermal: true,
    smallArmsMult: 0.3, explosiveMult: 1.0, ramMult: 1.4,
    mass: 9200, com: [0, 1.75, -0.4],
    // Rumpf (Kollision/Einsteigen/Spot) – Treffer prüfen alle boxes (Rumpf, Heckausleger, Flügel, Leitwerk)
    hullBox: [0, 1.75, -1.6, 1.25, 1.25, 6.2],
    boxes: [
      [0, 1.75, -1.6, 1.25, 1.25, 6.2, 'hull'],
      [0, 3.05, -0.3, 0.9, 0.55, 2.6, 'engine'],
      [0, 2.25, 6.6, 0.45, 0.5, 3.4, 'tracks'],
      [0, 3.15, 9.8, 0.25, 1.2, 0.9, 'tracks'],
      [0, 1.62, -1.35, 3.05, 0.25, 0.75, 'hull'],
    ],
    gear: [[0, 0, -5.4], [-1.45, 0, 0.55], [1.45, 0, 0.55]],
    samples: [[0, 1.2, -8.1], [0, 2.4, 10.3], [-3.1, 1.6, -1.35], [3.1, 1.6, -1.35], [0, 3.6, -0.6], [0, 0.35, -1.5], [0, 4.3, 9.8], [-1.2, 1.7, -4], [1.2, 1.7, -4]],
    flight: {
      kind: 'heli', hub: [0, 4.55, -0.55], rotorR: 8.4, blades: 5, tailRotor: [0.52, 3.35, 10.1], tailR: 1.55,
      spool: 7, // s bis Nenndrehzahl
      maxTilt: deg(32), maxBank: deg(40), tiltRate: 2.6, yawRate: 1.45, climb: 13, descend: 10, vertK: 2.4,
      maxThrust: 1.75, dragLin: 0.06, dragQuad: 0.00085, maxSpeed: 82, groundEffect: 0.18, ceiling: 420,
    },
    zones: {
      hull: { label: 'Rumpf', hp: 640 },
      engine: { label: 'Triebwerk', hp: 220 },
      tracks: { label: 'Heckrotor', hp: 160 },
    },
    seats: [
      {
        id: 'pilot', label: 'Pilot', drive: true, cabin: true, weapons: ['khs_rak', 'khs_kanp'], mount: 'fixed',
        pos: [0, 1.25, -3.85], exit: [[-2.4, 0, -3.8], [2.4, 0, -3.8], [-2.6, 0, -1.2], [2.6, 0, -1.2]],
        views: [
          { id: 'cockpit', label: 'Cockpit', space: 'hull', pos: [0, 2.62, -3.72], look: 'rel', yaw: [-2.4, 2.4], pitch: [-1.1, 0.9], zoom: [1, 1.7], air: true, interior: true },
          { id: 'aussen', label: 'Außenansicht', look: 'rel', yaw: [-3.1, 3.1], pitch: [-0.9, 0.8], zoom: [1], tp: tpHeli },
        ],
      },
      {
        id: 'gunner', label: 'Bordschütze', cabin: true, weapons: ['khs_kan'], mount: 'mg',
        pos: [0, 0.95, -5.65], exit: [[-2.4, 0, -5.4], [2.4, 0, -5.4], [-2.6, 0, -1.2]],
        views: [
          { id: 'optik', label: 'Zieloptik', space: 'mg', pos: [0, -0.05, -0.15], look: 'mount', zoom: [2.2, 5, 10], overlay: 'airgun' },
          { id: 'cockpit', label: 'Vorderes Cockpit', space: 'hull', pos: [0, 2.28, -5.55], look: 'mount', zoom: [1, 1.8], air: true, interior: true },
          { id: 'aussen', label: 'Außenansicht', look: 'mount', zoom: [1], tp: tpHeli },
        ],
      },
      { id: 'p1', label: 'Truppenraum links vorn', cabin: true, weapons: [], pos: [-0.55, 0.95, -2.2], exit: [[-2.6, 0, -2.0], [2.6, 0, -2.0]], views: passView(-0.55, -2.2) },
      { id: 'p2', label: 'Truppenraum rechts vorn', cabin: true, weapons: [], pos: [0.55, 0.95, -2.2], exit: [[2.6, 0, -2.0], [-2.6, 0, -2.0]], views: passView(0.55, -2.2) },
      { id: 'p3', label: 'Truppenraum links hinten', cabin: true, weapons: [], pos: [-0.55, 0.95, -0.8], exit: [[-2.6, 0, -0.8], [2.6, 0, -0.8]], views: passView(-0.55, -0.8) },
      { id: 'p4', label: 'Truppenraum rechts hinten', cabin: true, weapons: [], pos: [0.55, 0.95, -0.8], exit: [[2.6, 0, -0.8], [-2.6, 0, -0.8]], views: passView(0.55, -0.8) },
    ],
    // Kinnturm (Raum 'mg' wie der MG-Träger des Geländewagens): Drehpunkt, Mündung im Turmraum, Grenzen
    mgPivot: [0, 0.82, -6.95],
    mgMuzzle: [0, -0.05, -1.25],
    mgLimits: { min: deg(-62), max: deg(14) },
    mgYawLimit: deg(115),
    crew: { switchTime: 1.2 },
    lights: [[0, 0.95, -6.6]],
  },

  jet: {
    id: 'jet', name: 'JK-9 Falke', cls: 'Kampfjet', air: 'jet', model: 'jet', sound: 'jet',
    health: 460, armored: false, respawn: 90, wreckTime: 20, noThermal: true,
    smallArmsMult: 0.3, explosiveMult: 1.1, ramMult: 1.4,
    mass: 12500, com: [0, 1.95, 0.2],
    hullBox: [0, 2.0, 0.1, 1.15, 0.95, 7.9],
    boxes: [
      [0, 2.0, 0.1, 1.15, 0.95, 7.9, 'hull'],
      [0, 1.78, 1.6, 5.2, 0.22, 2.2, 'hull'],
      [0, 2.0, 5.2, 0.9, 0.7, 2.4, 'engine'],
      [0, 3.6, 6.2, 1.7, 1.1, 1.3, 'tracks'],
    ],
    gear: [[0, 0, -4.9], [-1.7, 0, 1.1], [1.7, 0, 1.1]],
    samples: [[0, 2.0, -8.1], [0, 2.1, 7.9], [-5.2, 1.75, 2.6], [5.2, 1.75, 2.6], [-1.6, 4.5, 6.6], [1.6, 4.5, 6.6], [0, 1.0, 0.4], [0, 3.0, -2.2]],
    flight: {
      kind: 'jet', wingArea: 44, cla: 5.0, cl0: 0.24, alphaStall: deg(17), clMax: 1.45, cd0: 0.075, kInd: 0.09,
      thrust: 62000, afterburner: 108000, spool: 2.2,
      rates: { pitch: 1.15, roll: 3.1, yaw: 0.32 }, gLimit: 8.5, minSpeed: 48, stallSpeed: 56,
      airStart: { alt: 230, speed: 125, edge: 140 }, // Luftstart: Höhe über Grund (m), Fahrt (m/s), Abstand vom Kartenrand
      zoneMargin: 650, ceiling: 900,
    },
    zones: {
      hull: { label: 'Rumpf', hp: 460 },
      engine: { label: 'Triebwerk', hp: 180 },
      tracks: { label: 'Leitwerk', hp: 140 },
    },
    seats: [
      {
        id: 'pilot', label: 'Pilot', drive: true, cabin: true, weapons: ['jk_kan', 'jk_rak', 'jk_bmb'], mount: 'fixed',
        pos: [0, 1.75, -3.35], exit: [[-2.6, 0, -3.2], [2.6, 0, -3.2], [-2.0, 0, -6.0], [2.0, 0, -6.0]],
        views: [
          { id: 'cockpit', label: 'Cockpit', space: 'hull', pos: [0, 2.98, -3.32], look: 'rel', yaw: [-2.5, 2.5], pitch: [-1.0, 1.1], zoom: [1, 1.7], air: true, interior: true },
          { id: 'aussen', label: 'Außenansicht', look: 'rel', yaw: [-3.1, 3.1], pitch: [-0.9, 0.8], zoom: [1], tp: tpJet },
        ],
      },
    ],
    crew: { switchTime: 1.0 },
    lights: [[0, 0.9, -4.6]],
  },
};

/** Sitz eines Luftfahrzeugs mit Flugsteuerung. */
export const isAir = (def) => !!(def && def.air);
