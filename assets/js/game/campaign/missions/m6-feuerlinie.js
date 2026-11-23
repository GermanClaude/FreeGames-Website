// NULLPUNKT — Kampagne, Mission 6 „Feuerlinie“ (Brandwald, Abend, Dunst): Hubschrauber, Rettung, geordneter Rückzug.
// Akt II beginnt: Kessar hat den Wald oberhalb des Holzplatzes angezündet, dort sitzen Arbeiter mit ihren Familien fest.
// Falk fliegt als Bordschütze im Hubschrauber „Libelle 1“ (G.vehicles.air, Pilot Oblt. Sander als Bot mit Skript-
// Autopilot air.fly) und schaltet die Flugabwehr am Holzplatz aus. Abgesetzt sammelt er mit Lenz und Weber die Arbeiter
// (Figuren ohne KI, folgen dem Spieler) und zieht sich vor Feuer und Feind über zwei Linien zurück – Landezone am
// Holzplatz, dann die alte Frontstellung im Süden –, bis „Libelle 1“ zur Evakuierung landet.
// Checkpoints: start, anflug, sammeln, linie1, rueckzug, evakuierung. Kartenfahrzeuge werden geräumt (mapVehicles: false),
// damit keine KI-Hubschrauber der Karte eingreifen.

import { actor } from './cast.js?v=20261123073102';

const PAD = [24, 141];
const YARD = [106, -22];
const LZ = [96, -3]; // Rand der Lichtung am Holzplatz (keine Baumleichen)
const LINE2 = [76, 96];
const EVAC = [62, 116];
const WORKERS = [
  { id: 'w1', name: 'Arbeiter Haller', at: [100, -27] },
  { id: 'w2', name: 'Arbeiterin Rieck', at: [112, -17] },
  { id: 'w3', name: 'Junge Tamo', at: [113, -16], small: true },
  { id: 'w4', name: 'Arbeiter Oswin', at: [118, -30] },
  { id: 'w5', name: 'Arbeiterin Jola', at: [98, -14] },
];
const FLAK = [[98, -32], [114, -12], [96, -12], [120, -28], [108, -36], [90, -24], [124, -18], [104, -8]];

/** Einsatzbesprechung am Hubschrauber (Lage hängt vom freien Stellplatz ab, den die Mission sucht). */
function CUT_INTRO(m) {
  const pad = m.get('pad') || PAD;
  const [hx, hz] = pad;
  const o = (dx, dz) => [hx + dx, hz + dz];
  return {
    groundRel: true,
    location: ['Brandwald · Basis Süd', '18:12 Uhr · Tag 24 der Waffenruhe'],
    cast: {
      sander: actor('sander', { pos: o(-6.4, 2.6), yaw: 1.2, aim: -1.0 }),
      lenz: actor('lenz', { pos: o(-8.6, 4.4), yaw: -1.9, aim: -0.6 }),
      falk: actor('falk', { pos: o(-9.0, 1.8), yaw: -1.3, aim: -0.6 }),
      weber: actor('weber', { pos: o(-10.4, 3.6), yaw: -1.6, aim: -0.6, crouch: true }),
    },
    beats: [
      { cam: { path: [[hx - 50, 40, hz - 80], [hx - 14, 30, hz - 50], [hx + 6, 20, hz - 20]], look: [106, 10, -22], lookTo: [hx, 2, hz] }, dur: 8, fadeIn: 1.6,
        say: { who: 'funk', text: 'Anker an alle: Der Brand oberhalb des Holzplatzes breitet sich nach Süden aus. Funkkontakt zu den Arbeitern abgerissen.' } },
      { cam: { from: [hx - 15, 2.2, hz + 8], to: [hx - 14, 2.0, hz + 7], look: [hx - 8.4, 1.4, hz + 3] },
        say: { who: 'sander', text: 'Libelle 1 ist aufgetankt. Am Holzplatz steht Flugabwehr – zwei, drei Nester, vielleicht mehr. Ich kann nicht landen, solange die feuern.' } },
      { cam: { close: 'sander', side: 0.35, dist: 0.95, push: 0.1 },
        say: { who: 'sander', text: 'Falke, du sitzt am Kinnturm. Ich halte uns im Kreis, du räumst den Platz frei.', expr: 'entschlossen' } },
      { cam: { close: 'lenz', side: -0.35, dist: 0.9 },
        say: { who: 'lenz', text: 'Danach setzt du uns ab. Wir holen die Leute und bringen sie zur Landezone.', expr: 'ernst' } },
      { cam: { close: 'weber', side: 0.3, dist: 0.95 },
        say: { who: 'weber', text: 'Der Wind dreht nach Süden. Das Feuer kommt schneller, als uns lieb ist.', expr: 'angespannt' } },
      { cam: { over: ['falk', 'lenz'] },
        say: { who: 'lenz', text: 'Dann sind wir schneller. Aufsitzen.', expr: 'entschlossen' }, fadeOut: 0.9 },
    ],
  };
}

/** Abflug: Lage relativ zum Landeplatz der Evakuierung. */
function CUT_OUTRO(m) {
  const [ex, ez] = m.get('evac') || [EVAC[0], EVAC[1]];
  const dx = ex - 62 + 9, dz = ez - 116; // 9 m neben dem schwebenden Hubschrauber
  const o = (x, z) => [x + dx, z + dz];
  const c3 = (x, y, z) => [x + dx, y, z + dz];
  return {
  groundRel: true,
  location: ['Alte Frontstellung Süd', '18:57 Uhr'],
  cast: {
    falk: actor('falk', { pos: o(64.4, 112.6), yaw: 2.6, aim: -0.6 }),
    lenz: actor('lenz', { pos: o(66.2, 113.8), yaw: 2.2, aim: -0.6 }),
    weber: actor('weber', { pos: o(63.2, 114.8), yaw: -2.6, aim: -0.7, crouch: true }),
    haller: actor('zivil', { pos: o(65.6, 111.0), yaw: -2.9, aim: -1.1, variant: 'zivil-arbeit', weapon: null, name: 'Arbeiter Haller' }),
  },
  beats: [
    { cam: { from: c3(44, 14, 96), to: c3(50, 9, 102), look: c3(64, 2, 113) }, dur: 5.5, fadeIn: 1,
      say: { who: 'sander', text: 'Alle an Bord? Ich zähle vierzehn Zivilisten und euch drei. Libelle 1 hebt ab.' } },
    { cam: { close: 'haller', side: 0.4, dist: 1.0, push: 0.1 },
      say: { who: 'haller', text: 'Wir dachten, niemand kommt. Das Feuer war schon am Sägewerk.', expr: 'traurig' } },
    { cam: { close: 'lenz', side: -0.35, dist: 0.9 },
      say: { who: 'lenz', text: 'Jetzt sind Sie raus. Das zählt.', expr: 'ernst' } },
    { cam: { close: 'weber', side: 0.35, dist: 0.9, push: 0.1 },
      say: { who: 'weber', text: 'Feldwebel … ich habe Kessars Funk entschlüsselt. Er zieht alles zusammen, was ihm folgt. Morgen früh, im Niemandsland.', expr: 'angespannt' } },
    { cam: { close: 'lenz', side: 0.3, dist: 0.9 },
      say: { who: 'weber', text: 'Und die Brigade von Major Daren hat Befehl, mitzumarschieren.', expr: 'angespannt' } },
    { cam: { over: ['falk', 'weber'] },
      say: { who: 'daren', text: 'Hier Daren, offener Kanal. Ich habe den Befehl erhalten. Ich werde ihn nicht ausführen.', expr: 'ernst' } },
    { cam: { from: c3(56, 6, 104), to: c3(52, 12, 98), look: c3(64, 2, 113) }, dur: 4, fadeOut: 1.4,
      say: { who: 'brandt', text: 'Dann stehen wir morgen nicht allein. Kommt nach Hause, alle.', expr: 'entschlossen' } },
  ],
};
}

/* ------------------------------------------------------------ Hilfen */

const P = (m) => m.G.player;

/** Hubschrauber mit Pilot (Sander) und Truppe an Bord; Spieler als Bordschütze (Sitz 1). */
function crew(m, { airborne = false, board = true } = {}) {
  let heli = m.get('heli');
  if (!heli || !heli.alive) {
    if (airborne) heli = m.heli([LZ[0] - 40, LZ[1] + 70], { yaw: Math.PI * 0.85, airborne: true, alt: 45 });
    else {
      // freier, ebener Stellplatz ohne Baumleichen (Rotorkreis) nahe der Basis – Suche des Luftfahrzeugsystems
      const air = m.G.vehicles && m.G.vehicles.air;
      let spot = null;
      try { spot = air && air.findSpot ? air.findSpot(m.vec(PAD), 'heli', { toward: m.vec(YARD) }) || air.findSpot(m.vec(PAD), 'heli', { toward: m.vec(YARD), maxR: 200 }) : null; } catch { spot = null; }
      const at = spot ? [spot.position.x, spot.position.y, spot.position.z] : PAD;
      m.set('pad', [at[0], at[at.length - 1]]);
      heli = m.heli(at, { yaw: spot ? spot.yaw : Math.PI * 0.8 });
    }
    m.set('heli', heli);
  }
  if (!heli) return null;
  const pad = m.get('pad') || PAD;
  if (!m.ally('sander')) m.allies([{ role: 'sander', name: 'Oblt. Sander', at: [pad[0] - 4, pad[1] + 3] }]);
  const sander = m.ally('sander');
  if (sander && sander.vehicle !== heli) m.boardAir(heli, 0, sander);
  if (board && P(m).vehicle !== heli) m.boardAir(heli, 1, P(m));
  return heli;
}

/**
 * Libelle 1 hält etwas aus (Skript): Rumpf nie unter 45 %, und der Skript-Autopilot (Pilot ist ein Bot, der Spieler
 * sitzt am Kinnturm) verliert den Hubschrauber nicht an Baumleichen-Spitzen oder harte Aufsetzer: Kollisionsschaden aus.
 */
function sturdy(m, heli) {
  if (heli && !heli._kcSturdy && typeof heli.applyDamage === 'function') {
    heli._kcSturdy = true;
    const orig = heli.applyDamage.bind(heli);
    heli.applyDamage = (amount, info = {}) => (info && info.kind === 'collision' ? 0 : orig(amount, info));
  }
  m.every(() => {
    if (!heli || !heli.alive) return true;
    if (heli.health < heli.maxHealth * 0.45) heli.repair(heli.maxHealth * 0.25);
    return false;
  });
}

/** Kreisflug um c (Radius r, Höhe alt) mit dem Skript-Autopilot. */
function orbit(m, heli, c, r = 55, alt = 42, speed = 26) {
  const air = m.G.vehicles.air;
  const C = m.vec(c);
  m.set('orbit', true);
  m.every(() => {
    if (!heli || !heli.alive || !m.get('orbit')) return true;
    const p = heli.body.pos;
    const a = Math.atan2(p.z - C.z, p.x - C.x) + 0.55;
    air.fly(heli, { to: C.clone().add({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r }), alt, speed });
    return false;
  });
}

function workers(m, { follow = false, at = null } = {}) {
  WORKERS.forEach((w, k) => {
    if (m.extras.has(w.id)) return;
    const pos = at ? [at[0] + (k % 3) * 1.4 - 1.4, at[1] + Math.floor(k / 3) * 1.4] : w.at;
    const x = m.extra(w.id, { pos, variant: ['zivil-arbeit', 'zivil', 'zivil-hemd', 'zivil-strick'][k % 4], name: w.name, crouch: !follow, protect: true, aim: -1.2 });
    if (follow) x.follow(P(m));
  });
}

function fireLine(m, z, x0 = 70, x1 = 130, step = 9, dur = 400) {
  for (let x = x0; x <= x1; x += step) m.fire([x + Math.sin(x) * 2, z + Math.cos(x * 0.7) * 3], 3.2, dur);
  m.smoke([(x0 + x1) / 2, z - 6], { radius: 14, duration: dur, color: '#4e4a45' });
}

export const MISSION_6 = {
  id: 'm6',
  number: 6,
  act: 2,
  title: 'Feuerlinie',
  short: 'Feuerlinie',
  map: 'brandwald',
  time: 'abend',
  weather: 'dunst',
  type: 'Hubschrauber · Rettung · Rückzug',
  summary: 'Kessar hat den Wald über dem Holzplatz angezündet. Flieg als Bordschütze in „Libelle 1“, räume die Flugabwehr ab, hol die Arbeiter heraus und zieh dich Linie um Linie vor Feuer und Feind zurück.',
  mapVehicles: false,
  cutscenes: { intro: CUT_INTRO, outro: CUT_OUTRO },

  prepare(m) {
    m.on('vehicle:destroyed', (e) => { if (e && e.vehicle && e.vehicle === m.get('heli')) { console.warn('[Kampagne] Libelle 1 zerstört', e.weaponId || '', e.by ? e.by.name || e.by.team : ''); m.fail('„Libelle 1“ wurde abgeschossen.'); } });
  },

  stages: [
    {
      id: 'start',
      name: 'Basis',
      checkpoint: { at: [19, 146], yaw: -2.2 },
      *run(m) {
        const heli = crew(m, { board: false });
        const pad = m.get('pad') || PAD;
        m.allies([
          { role: 'lenz', name: 'Fw. Lenz', at: [pad[0] - 7, pad[1] + 5] },
          { role: 'weber', name: 'OGefr. Weber', at: [pad[0] - 8, pad[1] + 3] },
        ]);
        // Spieler neben den Hubschrauber (Stellplatz wird erst jetzt gesucht)
        const pd = m.get('pad') || PAD;
        m.checkpoint('start', { at: [pd[0] - 9, pd[1] + 1], yaw: -1.4 }, { silent: true, save: false });
        P(m).body.teleport(m.vec([pd[0] - 9, pd[1] + 1]));
        yield m.cutsceneAt('intro');
        if (!heli) { m.tip('Hubschrauber nicht verfügbar – Absetzen per Fahrzeug entfällt.', 4); m.set('noHeli', true); return; }
        sturdy(m, heli);
        for (const [role, seat] of [['lenz', 2], ['weber', 3]]) { const b = m.ally(role); if (b) m.boardAir(heli, seat, b); }
        m.objective('board', 'Steig in „Libelle 1“ (Bordschütze)', { pos: () => heli.position, label: 'Libelle 1' });
        m.tip(`Einsteigen: ${m.key('interact', 'Einsteigen')} – der Pilotensitz ist belegt, du kommst an den Kinnturm.`, 6);
        yield () => P(m).vehicle === heli;
        m.done('board', { quiet: true });
        yield 1;
      },
    },
    {
      id: 'anflug',
      name: 'Anflug',
      checkpoint: { at: [19, 146], yaw: -2.2 },
      setup(m) { crew(m, { airborne: true }); },
      *run(m) {
        m.clearObjectives();
        const heli = m.get('heli');
        if (!heli || m.get('noHeli')) { yield 1; return; }
        if (P(m).vehicle !== heli) m.boardAir(heli, 1, P(m));
        sturdy(m, heli);
        m.introduce('fahrzeug', 'heli', 'KHS-4 Sperber: Kampf- und Transporthubschrauber. Bordschütze am 30-mm-Kinnturm – zielen mit Maus/rechtem Stick, feuern wie gewohnt.');
        const air = m.G.vehicles.air;
        m.say('sander', 'Libelle 1 hebt ab. Kurs Holzplatz, Höhe vierzig.', { radio: true });
        // erst senkrecht über die Baumleichen steigen, dann Kurs
        air.fly(heli, { hover: true, alt: 42 });
        yield m.until(() => !heli.alive || (heli.body && heli.body.agl > 30));
        air.fly(heli, { to: m.vec([70, 60]), alt: 45, speed: 32 });
        yield m.until(() => heli.body.pos.distanceTo(m.vec([70, 60])) < 40 || !heli.alive);
        m.wave('flak', { count: FLAK.length, scale: false, at: FLAK, hold: true });
        for (const b of m.waves.get('flak').bots) m.markActor(b);
        orbit(m, heli, YARD, 58, 40, 24);
        m.say('sander', 'Flugabwehr am Holzplatz! Ich gehe in den Kreis – Falke, Feuer frei auf die markierten Stellungen!', { radio: true, expr: 'angespannt' });
        m.say('lenz', 'Achte auf die Hütten. Da drin sitzen Zivilisten – nur auf die Stellungen!', { radio: true });
        yield m.killObjective('flak', 'Schalte die Flugabwehr am Holzplatz aus', 'flak');
        m.set('orbit', false);
        m.say('sander', 'Platz ist frei. Ich setze euch an der Landezone ab.', { radio: true });
        air.fly(heli, { to: m.vec(LZ), alt: 18, speed: 18 });
        yield m.until(() => heli.body.pos.distanceTo(m.vec(LZ, 18)) < 26 || !heli.alive);
        // Absetzen (Seil): kurze Abblende, Trupp am Boden
        if (m.ui) m.ui.fade(1, 0.6);
        yield 0.8;
        const V = m.G.vehicles;
        for (const a of [P(m), m.ally('lenz'), m.ally('weber')]) if (a && a.vehicle === heli) { try { V.removeFromSeat(a, { teleport: false }); } catch { /* */ } }
        const lz = m.vec(LZ);
        P(m).body.teleport(lz.clone().setY(lz.y + 0.1));
        const L = m.ally('lenz'), Wb = m.ally('weber');
        if (L && L.body) L.body.teleport(m.vec([LZ[0] + 2, LZ[1] + 1.5]));
        if (Wb && Wb.body) Wb.body.teleport(m.vec([LZ[0] - 2, LZ[1] + 1.5]));
        air.fly(heli, { to: m.vec([60, 80]), alt: 50, speed: 30 });
        if (m.ui) m.ui.fade(0, 0.8);
        yield 1;
      },
    },
    {
      id: 'sammeln',
      name: 'Holzplatz',
      checkpoint: { at: LZ, yaw: 0 },
      setup(m) {
        m.allies([{ role: 'lenz', name: 'Fw. Lenz', at: [LZ[0] + 2, LZ[1] + 1.5] }, { role: 'weber', name: 'OGefr. Weber', at: [LZ[0] - 2, LZ[1] + 1.5] }]);
        const h = crew(m, { airborne: true, board: false });
        if (h) { const air = m.G.vehicles.air; air.fly(h, { to: m.vec([60, 80]), alt: 50, speed: 30 }); sturdy(m, h); }
      },
      *run(m) {
        m.clearObjectives();
        m.order('follow');
        workers(m);
        m.introduce('karte', 'brandwald', 'Brandwald: verbrannter Nadelwald, Gräben beider Seiten, Holzplatz im Osten.');
        m.say('lenz', 'Die Hütten am Sägewerk. Ruf, sie sollen rauskommen – und dann alle zu uns.', { radio: false });
        const ids = WORKERS.map((w) => w.id);
        m.objective('sammeln', 'Finde die Arbeiter am Holzplatz', { total: ids.length, pos: () => { const x = ids.map((id) => m.extras.get(id)).find((e) => e && !e.target); return x ? x.position : null; }, label: 'Arbeiter' });
        m.wave('nord1', { count: 4, at: [[96, -60], [110, -64], [124, -58], [104, -70]], attack: YARD, radius: 14 });
        let said = false;
        yield m.until(() => {
          let n = 0;
          for (const id of ids) {
            const x = m.extras.get(id);
            if (!x) continue;
            if (!x.target && x.position.distanceTo(P(m).position) < 3) { x.follow(P(m)); m.toast(`${x.a.name} folgt dir`, 'ok', 1.4); if (!said) { said = true; m.say('zivil', 'Hier! Wir sind hier drin! Nicht schießen!', { radio: false }); } }
            if (x.target) n++;
          }
          m.progress('sammeln', n, ids.length);
          return n >= ids.length;
        });
        m.done('sammeln');
        yield 1;
      },
    },
    {
      id: 'linie1',
      name: 'Landezone',
      checkpoint: { at: [LZ[0], LZ[1] + 2], yaw: Math.PI },
      setup(m) {
        m.allies([{ role: 'lenz', name: 'Fw. Lenz', at: [LZ[0] + 2, LZ[1] + 1.5] }, { role: 'weber', name: 'OGefr. Weber', at: [LZ[0] - 2, LZ[1] + 1.5] }]);
        workers(m, { follow: true, at: [LZ[0], LZ[1] + 4] });
        const h = crew(m, { airborne: true, board: false });
        if (h) sturdy(m, h);
      },
      *run(m) {
        m.clearObjectives();
        yield m.reach('lz', 'Bring die Arbeiter zur Landezone', { at: LZ, r: 7, label: 'Landezone' });
        m.order('defend', LZ);
        fireLine(m, -48);
        m.say('sander', 'Ich sehe euch. Aber der Rauch zieht genau über die Landezone – haltet noch aus, ich suche eine Lücke.', { radio: true });
        m.wave('nord2', { count: 6, at: [[90, -40], [104, -44], [118, -40], [84, -30], [126, -34], [98, -52]], attack: LZ, radius: 9 });
        m.say('weber', 'Sie kommen hinter dem Rauch hervor! Von Norden!', { expr: 'angespannt' });
        yield m.holdZone('halten1', 'Halte die Landezone', { at: LZ, r: 9, secs: 45, label: 'Landezone', action: 'Linie 1 halten' });
        fireLine(m, -26);
        m.say('sander', 'Keine Chance, der Rauch ist zu dicht. Zieht euch nach Süden zur alten Frontstellung zurück – dort lande ich!', { radio: true, expr: 'angespannt' });
        m.say('lenz', 'Rückzug! In Sprüngen, die Leute in der Mitte!', { expr: 'entschlossen' });
        yield 1;
      },
    },
    {
      id: 'rueckzug',
      name: 'Rückzug',
      checkpoint: { at: [LZ[0], LZ[1] + 6], yaw: Math.PI },
      setup(m) {
        m.allies([{ role: 'lenz', name: 'Fw. Lenz', at: [LZ[0] + 2, LZ[1] + 4] }, { role: 'weber', name: 'OGefr. Weber', at: [LZ[0] - 2, LZ[1] + 4] }]);
        workers(m, { follow: true, at: [LZ[0], LZ[1] + 8] });
        const h = crew(m, { airborne: true, board: false });
        if (h) sturdy(m, h);
      },
      *run(m) {
        m.clearObjectives();
        m.order('follow');
        fireLine(m, -8, 74, 124, 10, 300);
        m.wave('jaeger', { count: 5, at: [[92, -20], [104, -18], [116, -22], [86, -12], [110, -30]], attack: 'player' });
        yield m.reach('linie2', 'Zieh dich zur alten Frontstellung zurück', { at: LINE2, r: 10, label: 'Linie 2' });
        m.order('defend', LINE2);
        fireLine(m, 20, 70, 124, 10, 300);
        m.wave('nord3', { count: 6, at: [[70, 52], [84, 50], [96, 56], [62, 60], [104, 48], [78, 44]], attack: LINE2, radius: 10 });
        m.say('lenz', 'Hier halten wir. Gräben besetzen, die Leute runter in den Graben!', { expr: 'entschlossen' });
        yield m.holdZone('halten2', 'Halte die Frontstellung, bis Libelle 1 landet', { at: LINE2, r: 11, secs: 50, label: 'Linie 2', action: 'Linie 2 halten' });
        yield 1;
      },
    },
    {
      id: 'evakuierung',
      name: 'Evakuierung',
      checkpoint: { at: [LINE2[0], LINE2[1] + 4], yaw: Math.PI },
      setup(m) {
        m.allies([{ role: 'lenz', name: 'Fw. Lenz', at: [LINE2[0] + 2, LINE2[1] + 4] }, { role: 'weber', name: 'OGefr. Weber', at: [LINE2[0] - 2, LINE2[1] + 4] }]);
        workers(m, { follow: true, at: [LINE2[0], LINE2[1] + 6] });
        crew(m, { airborne: true, board: false });
      },
      *run(m) {
        m.clearObjectives();
        const heli = m.get('heli');
        const air = m.G.vehicles.air;
        // Landeplatz ohne Baumleichen (Rotorkreis frei) nahe der Frontstellung
        let spot = null;
        try { spot = air.findSpot ? air.findSpot(m.vec(EVAC), 'heli', { maxR: 70 }) : null; } catch { spot = null; }
        const ev = spot ? [spot.position.x, spot.position.z] : EVAC;
        m.set('evac', ev);
        if (heli && heli.alive) air.fly(heli, { to: m.vec(ev), alt: 10, speed: 20 });
        m.say('sander', 'Libelle 1 im Anflug auf die Frontstellung. Zwanzig Sekunden!', { radio: true });
        const rest = ['nord3', 'jaeger'].filter((w) => m.waves.has(w));
        if (rest.length) m.objective('rest', 'Halte die Verfolger auf Abstand', { quiet: true });
        yield m.reach('evac', 'Bring alle zum Hubschrauber', { at: ev, r: 9, label: 'Libelle 1' });
        if (heli && heli.alive) air.fly(heli, { hover: true, alt: spot ? 2.5 : 8 });
        const ids = WORKERS.map((w) => w.id);
        const evp = m.vec(ev);
        yield m.until(() => ids.every((id) => { const x = m.extras.get(id); return !x || x.position.distanceTo(evp) < 12; }));
        yield 1;
        m.complete();
      },
    },
  ],
};
