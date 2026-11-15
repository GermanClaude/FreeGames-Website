// NULLPUNKT — Kampagne, Mission 10 „Rollfeld“ (Fliegerhorst Hagenmoor; Rückfall: Grenzland, Kieswerk als Ausweichplatz):
// Großangriff mit Luftunterstützung. Libelle 1 bringt den Trupp heran; im Anflug wird Pilot Sander getroffen, und Falk
// muss den Hubschrauber selbst in die Landezone fliegen (Pilot!). Am Boden: zwei Flugabwehrstellungen sprengen, die Jäger
// räumen das Vorfeld, die Hallen durchkämmen und Kessars startbereite Maschine auf dem Vorfeld zerstören, bevor sie abhebt.
// Kessar entkommt im letzten Moment im Wagen in die Stadt Veldmark (Outro).
// Checkpoints: flug, landezone, flak, hallen, vorfeld.
//
// Koordinaten je Karte (COORDS): Die neue Karte „flugplatz“ (Strang karten-neu) wird nur benutzt, wenn sie im Build
// existiert UND hier Koordinaten hat; sonst Grenzland (Kieswerk). Fehlen sie für eine geladene Karte, rechnet auto()
// einen Ablauf aus den Startpunkten der Karte (Notlösung).

import * as THREE from 'three';
import { actor } from './cast.js?v=20261115041504';
import { mapFor, clearAir, purgeDead, strike, jetPass, giveLauncher, prop } from './hilfen-b.js?v=20261115041504';

const COORDS = {
  // Fliegerhorst Hagenmoor (karten-neu): Startbahn z 40 (W–O), Vorfeld z −132…−45, Hangars x −120/−40/40 bei z −150
  // (Tor nach Süden), Flakstellungen südlich der Bahn (±60, 84), Gefechtsstand A im Westen (−415, −110).
  flugplatz: {
    place: ['Fliegerhorst Hagenmoor', 'Hangars'],
    stage: [-392, -84], stageYaw: -1.57,
    flyFrom: [-360, -40], flyYaw: -2.12, alt: 40,
    hit: [-230, 40],
    lz: [-140, 76],
    flak: [[-60, 84], [60, 84]],
    flakGuards: [[[-54, 90], [-66, 78], [-52, 76]], [[66, 90], [54, 78], [68, 76]]],
    apron: [[-40, -110], [-20, -100], [-60, -104], [0, -112]],
    hall: [-40, -136], hallIn: [[-48, -145], [-32, -155], [-40, -142], [-50, -158], [-30, -146], [-36, -160]],
    plane: [40, -100],
    reinf: [[140, -60], [120, -20], [150, 10]],
    outro: null,
  },
  grenzland: {
    place: ['Kieswerk · Ausweichplatz', 'Halle'],
    stage: [56, 200], stageYaw: 2.9,           // Bereitstellung (Intro, Wiedereinstieg vor dem Flug)
    flyFrom: [50, 168], flyYaw: 2.9, alt: 42,   // Start in der Luft
    hit: [72, 40],                              // hier wird Sander getroffen
    lz: [94, -66],                              // Landezone
    flak: [[128, -86], [126, -138]],
    flakGuards: [[[132, -92], [124, -80], [136, -82]], [[132, -140], [120, -134], [128, -146]]],
    apron: [[150, -96], [160, -84], [142, -104], [156, -104]], // Vorfeld (Jäger-Angriff)
    hall: [166, -118], hallIn: [[164, -110], [170, -124], [162, -126], [172, -112], [166, -118]],
    plane: [152, -92],                          // Kessars Maschine (Hubschrauber als Transporter)
    reinf: [[190, -60], [196, -90], [186, -150]],
    outro: { cam: [[118, 10, -40], [124, 7, -52]], look: [150, 2, -92], cast: { lenz: [138, -84], weber: [140, -82], falk: [141, -86], hofer: [136, -87], sander: [137, -82] } },
  },
};

const MAPID = mapFor('flugplatz', 'grenzland', COORDS);

/** Notlösung für eine Karte ohne Koordinaten: Ablauf entlang der Linie Start A → Start B. */
function auto(G) {
  const w = G.world;
  const avg = (list) => { const v = new THREE.Vector3(); if (!list || !list.length) return v; for (const s of list) v.add(s.position || new THREE.Vector3(s.x, 0, s.z)); return v.multiplyScalar(1 / list.length); };
  const a = avg(w && w.spawns && w.spawns.A), b = avg(w && w.spawns && w.spawns.B);
  const L = (t, s = 0) => { const d = b.clone().sub(a); const n = new THREE.Vector3(-d.z, 0, d.x).normalize(); const p = a.clone().addScaledVector(d, t).addScaledVector(n, s); return [Math.round(p.x), Math.round(p.z)]; };
  const yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
  return {
    place: ['Fliegerhorst Hagenmoor', 'Hangar'], stage: L(0), stageYaw: yaw, flyFrom: L(0.05), flyYaw: yaw, alt: 40, hit: L(0.25), lz: L(0.45),
    flak: [L(0.55, 12), L(0.6, -12)], flakGuards: [[L(0.56, 15), L(0.54, 9)], [L(0.61, -15), L(0.59, -9)]],
    apron: [L(0.7, 5), L(0.72, -5), L(0.68, 0)], hall: L(0.8), hallIn: [L(0.8, 3), L(0.82, -3), L(0.78, 0)], plane: L(0.88), reinf: [L(1, 10), L(1, -10)],
    outro: null,
  };
}

const C = (m) => m.get('C') || COORDS[MAPID];

const CUT_INTRO = (m) => {
  const c = C(m);
  const [x, z] = c.stage;
  return {
    groundRel: true,
    location: [`${c.place[0]} · Anflug`, '05:08 Uhr · Tag 24'],
    cast: {
      sander: actor('sander', { pos: [x + 1.5, z - 1.0], yaw: 2.2, aim: -0.8 }),
      falk: actor('falk', { pos: [x - 0.8, z - 2.2], yaw: -0.6, aim: -0.6 }),
      lenz: actor('lenz', { pos: [x - 1.6, z + 0.6], yaw: -1.8, aim: -1.2 }),
      weber: actor('weber', { pos: [x + 0.4, z + 1.8], yaw: 3.0, aim: -0.6 }),
    },
    beats: [
      { cam: { from: [x - 40, 30, z + 40], to: [x - 18, 14, z + 18], look: [x, 1, z], lookTo: [x + 20, 2, z - 60] }, dur: 7, fadeIn: 1.6,
        say: { who: 'funk', text: 'Anker an Libelle 1: Kessars Maschine wird auf dem Vorfeld betankt. Abflug in etwa zwanzig Minuten. Zwei Flugabwehrstellungen gemeldet.' } },
      { cam: { close: 'lenz', side: 0.4, dist: 0.9, push: 0.1 },
        say: { who: 'lenz', text: 'Ja, der Arm hängt in der Schlinge. Schießen kann ich mit der anderen Hand. Diskussion beendet.', expr: 'entschlossen' } },
      { cam: { close: 'falk', side: -0.35, dist: 0.9 },
        say: { who: 'falk', text: 'Niemand diskutiert, Feldwebel. Willkommen zurück.', expr: 'erleichtert' } },
      { cam: { close: 'sander', side: 0.35, dist: 0.9 },
        say: { who: 'sander', text: 'Falke, du sitzt vorn am Kinnturm. Wenn mir unterwegs etwas zustößt, bringst du uns runter. Du weißt, wie das geht.', expr: 'ernst' } },
      { cam: { close: 'falk', side: 0.3, dist: 0.85, push: 0.1 },
        say: { who: 'falk', text: 'Steigen und sinken mit dem Hebel, Richtung mit dem Knüppel, und im Zweifel schweben.', expr: 'nachdenklich' } },
      { cam: { close: 'sander', side: -0.3, dist: 0.85 },
        say: { who: 'sander', text: 'Genau so. Und nie mit der Nase zuerst auf den Boden.', expr: 'erleichtert' } },
      { cam: { over: ['weber', 'lenz'] },
        say: { who: 'weber', text: 'Kessar nimmt alles mit, was er über seine Geldgeber hat. Wenn er abhebt, sehen wir es nie wieder.', expr: 'angespannt' } },
      { cam: { from: [x + 10, 3, z + 8], to: [x + 14, 6, z + 12], look: [x, 1.4, z] }, dur: 3.5, fadeOut: 1.0,
        act: [{ who: 'falk', walk: [[x + 4, z - 6]], speed: 2, at: 0.5 }, { who: 'sander', walk: [[x + 5, z - 5]], speed: 2, at: 0.3 }],
        say: { who: 'lenz', text: 'Dann sorgen wir dafür, dass er nicht abhebt. Aufsitzen.', expr: 'entschlossen' } },
    ],
  };
};

const CUT_OUTRO = (m) => {
  const c = C(m);
  const o = c.outro;
  const [px, pz] = c.plane;
  const cast = o ? o.cast : { lenz: [px - 10, pz + 6], weber: [px - 8, pz + 8], falk: [px - 7, pz + 5], hofer: [px - 12, pz + 4], sander: [px - 11, pz + 8] };
  return {
    groundRel: true,
    location: [`${c.place[0]} · Vorfeld`, '05:41 Uhr'],
    cast: {
      falk: actor('falk', { pos: cast.falk, yaw: -2.2, aim: -0.6 }),
      lenz: actor('lenz', { pos: cast.lenz, yaw: -1.6, aim: -1.2 }),
      weber: actor('weber', { pos: cast.weber, yaw: -2.8, crouch: true, aim: -0.7 }),
      hofer: actor('hofer', { pos: cast.hofer, yaw: 0.8, crouch: true, aim: -0.8 }),
      sander: actor('sander', { pos: cast.sander, yaw: 2.4, crouch: true, aim: -1.0 }),
    },
    beats: [
      { cam: o ? { from: o.cam[0], to: o.cam[1], look: o.look } : { from: [px - 40, 12, pz + 30], to: [px - 30, 8, pz + 22], look: [px, 2, pz] }, dur: 6, fadeIn: 1.2,
        say: { who: 'funk', text: 'Anker: Kessars Maschine brennt. Der Flugplatz ist in unserer Hand.' } },
      { cam: { close: 'weber', side: 0.4, dist: 0.9, push: 0.1 },
        say: { who: 'weber', text: 'Er war nicht an Bord. Ein Wagen ist eben durchs Südtor gerast – Richtung Veldmark.', expr: 'angespannt' } },
      { cam: { close: 'lenz', side: -0.35, dist: 0.9 },
        say: { who: 'lenz', text: 'In die Stadt. Er sucht sich Menschen, hinter denen er sich verstecken kann.', expr: 'ernst' } },
      { cam: { close: 'hofer', side: 0.4, dist: 0.95 },
        say: { who: 'hofer', text: 'Sander hat einen Splitter im Bein. Er bleibt bei mir. Aber er lässt dir etwas ausrichten, Falke.', expr: 'erleichtert' } },
      { cam: { close: 'sander', side: -0.3, dist: 0.9 },
        say: { who: 'sander', text: 'Nicht schlecht gelandet. Für einen Infanteristen.', expr: 'erleichtert' } },
      { cam: { close: 'falk', side: 0.35, dist: 0.85, push: 0.1 },
        say: { who: 'brandt', text: 'Falke, Lenz – Veldmark wacht gleich auf. Das Funkhaus im Stadtkern sendet in die ganze Region. Dahin will er.' } },
      { cam: { over: ['lenz', 'falk'] }, dur: 4.5, fadeOut: 1.4,
        say: { who: 'lenz', text: 'Dann holen wir ihn dort ab. Diesmal endgültig.', expr: 'entschlossen' } },
    ],
  };
};

/** Hubschrauber Libelle 1 in der Luft (Wiedereinstieg im Flug) bzw. am Boden in der Landezone. */
function spawnHeli(m, airborne) {
  const G = m.G, air = G.vehicles && G.vehicles.air, c = C(m);
  if (!air) return null;
  let h = null;
  if (airborne) {
    const p = m.vec(c.flyFrom);
    p.y += c.alt;
    h = air.spawn('heli', p, { yaw: c.flyYaw, team: 'A', airborne: true });
  } else {
    const spot = air.findSpot(m.vec(c.lz), 'heli', { maxR: 30 }) || { position: m.vec(c.lz), yaw: c.flyYaw };
    h = air.spawn('heli', spot.position, { yaw: spot.yaw, team: 'A' });
  }
  if (h) m.vehicles.push(h);
  return h;
}

/** Hubschrauber gelandet (in der Zone, am Boden bzw. sehr tief und langsam)? */
function landed(m, h, zone) {
  if (!h || !h.alive) return false;
  const b = h.body;
  return m.inZone(zone, m.G.player) && (b.onGround || (b.agl < 1.6 && b.vel.length() < 3));
}

export const MISSION_10 = {
  id: 'm10',
  number: 10,
  title: 'Rollfeld',
  short: 'Rollfeld',
  map: MAPID,
  time: 'morgen',
  weather: 'klar',
  type: 'Großangriff · Hubschrauber · Flugplatz',
  summary: 'Kessar will mit den Unterlagen seiner Geldgeber außer Landes fliegen. Bring Libelle 1 in die Landezone, sprenge die Flugabwehr, durchkämme die Hallen und stoppe seine Maschine, bevor sie abhebt.',
  loadoutHint: 'Hubschrauber: W/S steigen/sinken, A/D drehen, Maus neigen, Leertaste schweben.',
  cutscenes: { intro: (m) => CUT_INTRO(m), outro: (m) => CUT_OUTRO(m) },

  prepare(m) {
    const G = m.G;
    const id = G.match && G.match.mapId;
    m.set('C', COORDS[id] || auto(G));
    if (!COORDS[id]) console.warn(`[Kampagne] M10: keine Koordinaten für Karte ${id} – Notablauf aus den Startpunkten`);
    clearAir(m);
    purgeDead(m);
    const c = C(m);
    m.zone('lz', { at: c.lz, r: 16 });
    // Hubschrauber: Wiedereinstieg im Flug (Abschnitt flug) – sonst steht er in der Landezone
    const inFlight = m.startIndex <= 1;
    const heli = spawnHeli(m, inFlight);
    m.set('heli', heli);
    const crew = m.allies([
      { role: 'lenz', name: 'Fw. Lenz', at: inFlight ? c.stage : c.lz },
      { role: 'weber', name: 'OGefr. Weber', at: inFlight ? c.stage : c.lz },
      { role: 'hofer', name: 'San. Hofer', at: inFlight ? c.stage : c.lz },
      { name: 'Gefr. Kuhn', at: inFlight ? c.stage : c.lz },
    ]);
    if (inFlight && heli) {
      const air = G.vehicles.air;
      crew.forEach((b, i) => { try { air.board(b, heli, 2 + i); } catch { /* */ } });
      // Sander (Pilot, Bot) fliegt den ersten Teil mit dem Autopiloten
      const [s] = m._spawnBots('A', 1);
      if (s) {
        s._kc = { ally: false, crew: true };
        s.name = 'Oblt. Sander';
        m._place(s, { position: heli.position.clone(), yaw: c.flyYaw });
        try { air.board(s, heli, 0); } catch { /* */ }
        s.update = function heliPilot() {};
        m.set('sander', s);
        air.fly(heli, { hover: true, alt: c.alt }); // während des Intros auf Höhe schweben
      }
      m.on('vehicle:destroyed', (e) => { if (e && e.vehicle === m.get('heli') && !m.get('gelandet')) m.fail('Libelle 1 ist abgestürzt.'); });
    }
  },

  stages: [
    {
      id: 'start',
      checkpoint: { at: COORDS[MAPID] ? COORDS[MAPID].stage : [0, 0], yaw: 0 },
      silentCheckpoint: true,
      *run(m) {
        yield m.cutsceneAt('intro');
      },
    },
    {
      id: 'flug',
      checkpoint: { at: COORDS[MAPID] ? COORDS[MAPID].flyFrom : [0, 0], yaw: 0 },
      *run(m) {
        const G = m.G, air = G.vehicles.air, c = C(m), heli = m.get('heli');
        if (!heli) { m.fail('Kein Hubschrauber verfügbar (Luftfahrzeuge auf dieser Karte aus).'); return; }
        // Spieler an den Kinnturm (Sitz 1), Sander fliegt
        try { if (G.player.vehicle !== heli) air.board(G.player, heli, 1); } catch { /* */ }
        const hit = m.vec(c.hit);
        air.fly(heli, { to: hit, alt: c.alt, speed: 22 });
        m.objective('ankunft', 'Anflug auf den Flugplatz – Kinnturm besetzt', { pos: c.lz, label: 'Landezone' });
        m.say('sander', 'Libelle 1, Kurs auf die Landezone. Noch zwei Minuten.', { radio: true });
        m.wave('boden', { count: 4, at: [[c.hit[0] + 20, c.hit[1] - 30], [c.hit[0] - 18, c.hit[1] - 34], [c.hit[0] + 4, c.hit[1] - 44], [c.hit[0] + 26, c.hit[1] - 52]], hold: true });
        m.tip('Kinnturm: zielen mit der Maus, feuern mit der linken Maustaste.', 5);
        const t0 = m.elapsed;
        yield () => Math.hypot(heli.body.pos.x - hit.x, heli.body.pos.z - hit.z) < 30 || m.elapsed - t0 > 40 || !heli.alive;
        // Treffer: Sander verwundet – Falk übernimmt
        try { G.effects && G.effects.explosion && G.effects.explosion(heli.body.pos.clone().add(new THREE.Vector3(3, -2, 2)), 4, {}); } catch { /* */ }
        try { G.player.shake && G.player.shake(1.2); } catch { /* */ }
        m.say('sander', 'Treffer! Ich bin am Bein erwischt – Falke, du musst übernehmen! Ich halte ihn so lange in der Schwebe!', { radio: true, expr: 'angespannt' });
        air.fly(heli, { hover: true, alt: c.alt });
        yield 3;
        const s = m.get('sander');
        try { if (s) { G.vehicles.removeFromSeat(s, { teleport: false }); G.bots.removeBot(s); } } catch { /* */ }
        try { air.release(heli); G.vehicles.switchSeat(G.player, 0); } catch { /* */ }
        if (heli.seatOf(G.player) !== 0) { try { G.vehicles.removeFromSeat(G.player, { teleport: false }); air.board(G.player, heli, 0); } catch { /* */ } }
        m.done('ankunft', { quiet: true });
        m.tip('Du fliegst: W/S steigen/sinken · A/D drehen · Maus neigen · Leertaste schweben (Gamepad: linker Stick, rechter Stick, A).', 9);
        m.say('sander', 'Ruhig. Nase leicht nach vorn, dann fliegt er von selbst. Die Landezone ist rot markiert.', { radio: true });
        m.objective('landen', 'Lande Libelle 1 in der Landezone', { pos: c.lz, label: 'Landezone' });
        yield () => landed(m, heli, 'lz') || !heli.alive;
        if (!heli.alive) return;
        m.set('gelandet', true);
        m.done('landen');
        m.say('sander', 'Aufgesetzt. Nicht schön, aber heil. Raus mit euch – ich bleibe beim Hubschrauber.', { radio: true, expr: 'erleichtert' });
        yield 1.5;
      },
    },
    {
      id: 'landezone',
      checkpoint: { at: COORDS[MAPID] ? COORDS[MAPID].lz : [0, 0], yaw: 2.6 },
      *run(m) {
        const G = m.G, heli = m.get('heli');
        m.clearObjectives();
        m.set('gelandet', true);
        // Alle aussteigen
        if (G.player.vehicle) { try { G.vehicles.removeFromSeat(G.player, { teleport: true }); } catch { /* */ } }
        for (const b of m.allyList) if (b.vehicle) { try { G.vehicles.removeFromSeat(b, { teleport: true }); } catch { /* */ } }
        if (heli && heli.alive) { try { G.vehicles.air.fly(heli, { hover: true, alt: 0 }); } catch { /* */ } }
        m.order('follow');
        giveLauncher(m, 'at_donner');
        m.say('lenz', 'Alle raus, ausschwärmen! Falke, nimm den Donnerkeil aus dem Gestell – den brauchen wir noch.', { expr: 'entschlossen' });
        yield 1;
      },
    },
    {
      id: 'flak',
      checkpoint: { at: COORDS[MAPID] ? COORDS[MAPID].lz : [0, 0], yaw: 2.6 },
      setup(m) { giveLauncher(m, 'at_donner'); m.order('follow'); },
      *run(m) {
        const c = C(m);
        m.clearObjectives();
        m.objective('flaks', 'Flugabwehrstellungen gesprengt', { total: 2, quiet: true });
        m.progress('flaks', 0, 2);
        for (let i = 0; i < 2; i++) {
          const id = `fg${i}`;
          m.wave(id, { count: 3, at: c.flakGuards[i], hold: true });
          if (i === 1) m.wave('fr', { count: 4, at: c.reinf, attack: 'player', radius: 10 });
          m.say(i ? 'weber' : 'lenz', i ? 'Jetzt die zweite Stellung. Sie haben uns gehört – Verstärkung kommt!' : 'Erste Flugabwehr, gleich vor uns. Wachen ausschalten, dann Ladung dran.', { expr: 'angespannt' });
          yield m.killObjective(`${id}k`, i ? 'Schalte die Wachen der zweiten Stellung aus' : 'Schalte die Wachen der Flugabwehr aus', id);
          yield m.holdZone(`flak${i}`, 'Bringe die Sprengladung an', { at: c.flak[i], r: 3.5, secs: 5, label: 'Flugabwehr', action: 'Sprengladung anbringen' });
          m.say('weber', 'Ladung sitzt. Weg da – zehn Meter!', { expr: 'angespannt' });
          yield 3;
          strike(m, [c.flak[i], [c.flak[i][0] + 2, c.flak[i][1] + 1]], { every: 0.3, radius: 6, damage: 200 });
          m.progress('flaks', i + 1, 2);
        }
        m.done('flaks');
        m.say('funk', 'Anker an Libelle 1: Luftraum frei. Zwei Jäger fliegen das Vorfeld an.', { radio: true });
        yield 1;
      },
    },
    {
      id: 'hallen',
      checkpoint: { at: COORDS[MAPID] ? COORDS[MAPID].flak[0] : [0, 0], yaw: 2.6 },
      setup(m) { giveLauncher(m, 'at_donner'); m.order('follow'); },
      *run(m) {
        const c = C(m);
        m.clearObjectives();
        // Jäger räumen das Vorfeld
        m.wave('vorfeld', { count: 6, at: c.apron, hold: true });
        const A = c.apron;
        let hitDone = false;
        const bomb = () => { if (hitDone) return; hitDone = true; strike(m, A.concat(A.map(([x, z]) => [x + 5, z - 4])), { every: 0.3, radius: 8, damage: 220 }); };
        jetPass(m, [A[0][0] - 380, 130, A[0][1] + 260], [A[0][0] + 320, 130, A[0][1] - 280], { speed: 170, overAt: A[0], onOver: bomb });
        let t = 0;
        m.every((dt) => { t += dt; if (t > 12) { bomb(); return true; } return hitDone; });
        m.say('weber', 'Jäger über uns! Runter!', { expr: 'angespannt' });
        yield 6;
        m.say('lenz', 'Das Vorfeld brennt. Die Hallen sind noch besetzt – rein da, Raum für Raum.', { expr: 'entschlossen' });
        m.wave('halle', { count: 6, at: c.hallIn, hold: true });
        yield m.reach('hallentor', `Dringe in die ${c.place[1]} ein`, { at: c.hall, r: 8, label: c.place[1] });
        yield m.killObjective('hk', `Durchkämme die ${c.place[1]}`, ['halle', 'vorfeld']);
        m.say('weber', 'Sauber. Und hört ihr das? Rotoren – auf dem Vorfeld läuft eine Maschine an!', { expr: 'angespannt' });
        yield 1;
      },
    },
    {
      id: 'vorfeld',
      checkpoint: { at: COORDS[MAPID] ? COORDS[MAPID].hall : [0, 0], yaw: 0.8 },
      setup(m) { giveLauncher(m, 'at_donner'); m.order('follow'); },
      *run(m) {
        const G = m.G, c = C(m), air = G.vehicles.air;
        m.clearObjectives();
        const spot = (air && air.findSpot(m.vec(c.plane), 'heli', { maxR: 40 })) || { position: m.vec(c.plane), yaw: 0 };
        const plane = air ? air.spawn('heli', spot.position, { yaw: spot.yaw, team: 'B' }) : null;
        if (plane) { m.vehicles.push(plane); plane.autopilot = { hover: true, alt: 0 }; }
        m.wave('wache', { count: 5, at: [[c.plane[0] + 8, c.plane[1] + 6], [c.plane[0] - 8, c.plane[1] + 4], [c.plane[0] + 10, c.plane[1] - 8], [c.plane[0] - 6, c.plane[1] - 10], [c.plane[0], c.plane[1] + 12]], hold: true });
        const alive = () => !!(plane && plane.alive && !plane.wreck);
        m.objective('maschine', 'Zerstöre Kessars Maschine, bevor sie abhebt', { pos: () => (alive() ? plane.position : null), label: 'Maschine' });
        m.tip('Raketenwerfer oder Granaten – die Maschine darf das Vorfeld nicht verlassen.', 6);
        m.say('lenz', 'Das ist sein Transporter! Bevor der in der Luft ist – Feuer frei!', { expr: 'angespannt' });
        let escaped = false;
        m.timer(75, 'Abflug in', () => {
          if (!alive()) return;
          escaped = true;
          m.fail('Kessars Maschine ist gestartet – mit ihr alle Beweise.');
        });
        yield m.until(() => !alive() || escaped);
        if (escaped) return;
        m.stopTimer();
        m.done('maschine');
        if (plane && plane.alive) { try { air.destroy(plane, G.player); } catch { /* */ } }
        m.say('weber', 'Getroffen! Sie brennt!', { expr: 'erleichtert' });
        yield m.killObjective('rest', 'Schalte die Wachen auf dem Vorfeld aus', 'wache');
        yield 1.5;
        m.complete();
      },
    },
  ],

  /** Testlauf (run.js): Hubschrauber in die Landezone setzen, Maschine abschießen. */
  _test(d) {
    const G = d.G, heli = d.get('heli');
    if (d.objs.some((o) => o.id === 'ankunft' && !o.done) && heli && heli.alive) {
      const p = d.vec(C(d).hit); p.y += C(d).alt;
      heli.body.setPose(p, heli.body.yaw ? heli.body.yaw() : 0, { airborne: true });
    }
    if (d.objs.some((o) => o.id === 'landen' && !o.done) && heli && heli.alive) {
      const z = d.zones.get('lz');
      heli.body.setPose(z.c.clone().setY(z.c.y + 0.2), heli.body.yaw ? heli.body.yaw() : 0);
      if (heli.body.vel) heli.body.vel.set(0, 0, 0);
      try { G.vehicles.air.fly(heli, { hover: true, alt: 0 }); } catch { /* */ }
    }
    if (d.objs.some((o) => o.id === 'maschine' && !o.done)) {
      for (const v of G.vehicles.air.list()) if (v.alive && v.team === 'B') G.vehicles.air.destroy(v, G.player);
    }
  },
};
void prop;
