// NULLPUNKT — Kampagne, Mission 12 „Nachtsicht“ (Grenzland, Nacht): Akt III beginnt. Nachteinsatz mit Nachtsichtgerät.
// Zwei Nächte nach Kessars Festnahme hat Weber die fremde Stimme („Phase zwei beginnt“) angepeilt: Sie sendet vom
// Funkhügel. Trupp Falk (Lenz, Weber, Hofer) schleicht vom Waldrand über das Gehöft (Beobachtungsposten der „Grauen
// Kompanie“), die Feldwege hinunter und über die Furt zum Funkhügel, stürmt den Bunker und kopiert den Funkrechner. Dann
// steigen Leuchtkugeln auf – Ausweichen zum Abholpunkt am Waldweg. Vahl, der Anführer der Söldner, entkommt.
// Mechanik: night() aus hilfen-c.js (Nachtbild, Nachtsicht mit der Taste „Lampe“, Bots sehen schlechter), Entdeckungs-
// anzeige (director.stealth; Alarm = mehr Gegner, kein Fehlschlag), schallgedämpfte Waffe, Leuchtkugeln (heller, Sicht
// der Bots besser). Checkpoints: start, gehoeft, furt, huegel, flucht.

import { actor } from './cast.js?v=20261122020853';
import { purgeDead, clearAir } from './hilfen-b.js?v=20261122020853';
import { night } from './hilfen-c.js?v=20261122020853';

const START = [-214, 150];          // Waldrand nordwestlich des Gehöfts (Feldweg)
const FARM = [-150, 104];           // Gehöft (Hof zwischen Scheune und Wohnhaus)
const FARM_GUARDS = [[-140, 112], [-162, 98], [-152, 92]];
const LANE = [[-156, 72], [-156, 40], [-156, 6]];
const FORD = [-150, -30];           // Furt (Feldweg kreuzt den Fluss)
const SOUTH_BANK = [-144, -57];
const HILL = [-121, -142];          // Funkhügel: Bunker
const HILL_GUARDS = [[-125, -151], [-117, -135], [-112, -150], [-132, -132], [-120, -156]];
const PICKUP = [-178, -88];         // Abholpunkt am Waldweg westlich der Furt
/** Wachen beim Schleichen: eine Stufe unter der Kampagnen-Schwierigkeit (Nacht, Söldner ohne Nachtsicht). */
const STEALTH_DIFF = { rekrut: 'rekrut', regulaer: 'rekrut', veteran: 'regulaer', elite: 'veteran' };

const CUT_INTRO = {
  groundRel: true,
  location: ['Grenzland · Waldrand bei Gehöft Lohmann', '01:12 Uhr · Tag 26'],
  cast: {
    falk: actor('falk', { pos: [START[0] + 0.6, START[1] - 1.2], yaw: 2.4, aim: -0.5, crouch: true }),
    lenz: actor('lenz', { pos: [START[0] - 1.2, START[1] - 0.4], yaw: -2.7, aim: -0.9 }),
    weber: actor('weber', { pos: [START[0] + 1.9, START[1] + 0.6], yaw: 2.9, aim: -0.7, crouch: true }),
    hofer: actor('hofer', { pos: [START[0] - 0.4, START[1] + 1.6], yaw: 3.1, aim: -0.8 }),
  },
  beats: [
    { cam: { from: [START[0] + 40, 30, START[1] - 40], to: [START[0] + 18, 12, START[1] - 14], look: [FARM[0], 2, FARM[1]], lookTo: [START[0], 1.4, START[1]], ease: 'inOut' }, dur: 7, fadeIn: 2,
      say: { who: 'funk', text: 'Anker an Trupp Falke: Peilung bestätigt. Die Stimme sendet vom Funkhügel, jede Nacht um zwei Uhr, immer nur vierzig Sekunden.' } },
    { cam: { close: 'weber', side: 0.4, dist: 0.9, push: 0.1 },
      say: { who: 'weber', text: 'Kein Rufzeichen, keine Uniform, keine Fahne. Die Leute dort nennen sich „Graue Kompanie“. Sie kämpfen für den, der zahlt.', expr: 'angespannt' } },
    { cam: { close: 'lenz', side: -0.35, dist: 0.9 },
      say: { who: 'lenz', text: 'Söldner. Kessar hat für eine Idee gekämpft – eine falsche, aber eine Idee. Die hier kämpfen für eine Rechnung.', expr: 'ernst' } },
    { cam: { close: 'hofer', side: 0.35, dist: 0.95 },
      say: { who: 'hofer', text: 'Mond ist hinter den Wolken. Ohne Nachtsicht seht ihr da draußen keine zehn Meter weit. Sie übrigens auch nicht.', expr: 'nachdenklich' } },
    { cam: { close: 'falk', side: -0.3, dist: 0.85, push: 0.12 },
      say: { who: 'falk', text: 'Dann sind wir die Einzigen, die sehen. Gehöft zuerst, dort sitzt ihr Beobachtungsposten.', expr: 'entschlossen' } },
    { cam: { over: ['lenz', 'falk'] },
      say: { who: 'lenz', text: 'Du führst, Falke. Ich bin nur der mit dem kaputten Arm, der dir über die Schulter schaut.', expr: 'erleichtert' } },
    { cam: { from: [START[0] + 6, 2.2, START[1] - 5], to: [START[0] + 8, 3.0, START[1] - 8], look: [START[0], 1.2, START[1]], lookTo: [FARM[0], 1.5, FARM[1]] }, dur: 4.5, fadeOut: 1.2,
      act: [{ who: 'falk', walk: [[START[0] + 6, START[1] - 7]], speed: 1.1, at: 0.6 }, { who: 'weber', walk: [[START[0] + 7, START[1] - 5]], speed: 1.1, at: 1.0 }],
      say: { who: 'brandt', text: 'Niemand schießt, der nicht muss. Das gilt auch in der Nacht. Viel Glück.' } },
  ],
};

const CUT_OUTRO = {
  groundRel: true,
  location: ['Waldweg westlich der Furt', '02:31 Uhr'],
  cast: {
    falk: actor('falk', { pos: [PICKUP[0] + 0.8, PICKUP[1] - 0.6], yaw: 1.4, aim: -0.6, crouch: true }),
    weber: actor('weber', { pos: [PICKUP[0] - 0.9, PICKUP[1] + 0.4], yaw: 1.9, aim: -0.9, crouch: true }),
    lenz: actor('lenz', { pos: [PICKUP[0] + 1.6, PICKUP[1] + 1.4], yaw: 2.6, aim: -0.9 }),
    hofer: actor('hofer', { pos: [PICKUP[0] - 1.8, PICKUP[1] - 1.4], yaw: 0.6, aim: -0.8 }),
  },
  beats: [
    { cam: { from: [PICKUP[0] + 30, 16, PICKUP[1] - 22], to: [PICKUP[0] + 14, 7, PICKUP[1] - 10], look: [PICKUP[0], 1.2, PICKUP[1]] }, dur: 6, fadeIn: 1.5,
      say: { who: 'grau', text: 'Hier Vahl. Der Hügel ist verloren. Plan bleibt. Mittag, Lindenplatz. Niemand redet.' } },
    { cam: { close: 'weber', side: 0.4, dist: 0.85, push: 0.1 },
      say: { who: 'weber', text: 'Das war ihr Anführer. Jaro Vahl. Und hier, auf dem Rechner: Sitzordnung, Zeitplan, Fluchtwege. Für Veldmark. Für morgen Mittag.', expr: 'angespannt' } },
    { cam: { close: 'lenz', side: -0.35, dist: 0.9 },
      say: { who: 'lenz', text: 'Die öffentliche Sitzung der Kommission. Hunderte Menschen auf dem Lindenplatz, und Haas mittendrin.', expr: 'ernst' } },
    { cam: { close: 'falk', side: 0.3, dist: 0.85 },
      say: { who: 'falk', text: 'Woher kennen Söldner die Sitzordnung einer Sitzung, die noch gar nicht stattgefunden hat?', expr: 'nachdenklich' } },
    { cam: { close: 'hofer', side: -0.35, dist: 0.95 },
      say: { who: 'hofer', text: 'Von jemandem, der sie geschrieben hat.', expr: 'ernst' } },
    { cam: { close: 'falk', side: -0.3, dist: 0.95, push: 0.1 },
      say: { who: 'brandt', text: 'Haas sagt die Sitzung nicht ab. Sie sagt, wer sich vor Söldnern versteckt, hat schon verloren. Falke – du bekommst ein Dach und ein Gewehr.' } },
    { cam: { from: [PICKUP[0] + 6, 4, PICKUP[1] + 6], to: [PICKUP[0] + 10, 10, PICKUP[1] + 12], look: [PICKUP[0], 1, PICKUP[1]] }, dur: 4.5, fadeOut: 1.6,
      say: { who: 'lenz', text: 'Dann schlaf zwei Stunden. Mehr kriegst du nicht.', expr: 'erleichtert' } },
  ],
};

/** Wachen eines Abschnitts mit Entdeckungsanzeige. Alarm: kein Fehlschlag, aber Verstärkung und Leuchtkugel. */
function guard(m, waves, reinf) {
  const old = m.get('stealth');
  if (old) old.stop();
  const st = m.stealth(waves, {
    label: 'Unentdeckt',
    onAlarm: (why) => {
      m.set('alarm', (m.get('alarm') || 0) + 1);
      const txt = why === 'schuss' ? 'Ein ungedämpfter Schuss – sie haben es gehört.' : why === 'getroffen' ? 'Die Wache hat überlebt und schlägt Alarm.' : 'Du wurdest entdeckt.';
      m.tip(txt, 4);
      m.say('grau', 'Kontakt! Leuchtkugel!', { radio: true, minor: true });
      flare(m, 14);
      if (reinf) m.wave(`${waves[0]}:alarm`, { count: 3, at: reinf, attack: 'player', radius: 8 });
      m.say('lenz', 'Sie haben uns. Feuer frei – und dann weiter, bevor mehr kommen!', { expr: 'angespannt' });
    },
  });
  m.set('stealth', st);
  return st;
}

/** Leuchtkugel: für secs Sekunden heller (Spieler sieht, aber Bots auch). */
function flare(m, secs = 12) {
  const n = m._kcNight;
  if (!n) return;
  const G = m.G;
  try { const P = G.player; const p = P.position.clone(); p.y += 60; G.effects && G.effects.flare && G.effects.flare(p); } catch { /* */ }
  const prev = n.dark;
  n.flare = (n.flare || 0) + 1;
  const canvas = document.getElementById('game-canvas');
  const apply = () => { if (canvas && !n.nvg && n.on) canvas.style.filter = 'brightness(0.62) saturate(0.5) sepia(0.25)'; if (G.world) G.world.nightVis = 0.85; };
  apply();
  let t = 0;
  m.every((dt) => {
    t += dt;
    if (!n.on) return true;
    if (t < secs) { if (!n.nvg) apply(); return false; }
    n.flare -= 1;
    if (!n.flare) n.set(n.nvg); // zurück zum Nachtbild
    void prev;
    return true;
  });
}

function stealthWave(m, id, at, patrol = null) {
  return m.wave(id, { count: at.length, scale: false, at, hold: true, difficulty: STEALTH_DIFF[m.diffId] || 'rekrut', patrol });
}

export const MISSION_12 = {
  id: 'm12',
  number: 12,
  act: 3,
  title: 'Nachtsicht',
  short: 'Nachtsicht',
  map: 'grenzland',
  time: 'abend',
  weather: 'bewoelkt',
  type: 'Nachteinsatz · Schleichen · Nachtsicht',
  summary: 'Die fremde Stimme sendet vom Funkhügel. Schleich dich mit Nachtsichtgerät vom Gehöft über die Furt, stürm den Bunker der Grauen Kompanie und kopiere ihren Funkrechner.',
  loadoutHint: 'Nachtsicht: Taste „Lampe“ (Standard T, Gamepad Steuerkreuz ↓, Touch: Knopf „NSG“).',
  loadout: { primary: 'smg_wespe', secondary: 'pi_p9', att: { smg_wespe: { muendung: 'daempfer' }, pi_p9: { muendung: 'daempfer' } } },
  mapVehicles: false,
  cutscenes: { intro: CUT_INTRO, outro: CUT_OUTRO },

  prepare(m) {
    clearAir(m, { ground: true });
    purgeDead(m);
    night(m, { dark: 0.3, vis: 0.42, nvg: true, start: m.startIndex > 0 });
    const sp = m.spawnPoint ? m.spawnPoint.position : m.vec(START);
    m.allies([
      { role: 'lenz', name: 'Fw. Lenz', at: [sp.x - 1.5, sp.z + 1] },
      { role: 'weber', name: 'OGefr. Weber', at: [sp.x + 1.5, sp.z + 1] },
      { role: 'hofer', name: 'San. Hofer', at: [sp.x, sp.z + 2.2] },
    ]);
    m.order('follow');
  },

  stages: [
    {
      id: 'start',
      checkpoint: { at: START, yaw: -0.95 },
      *run(m) {
        yield m.cutsceneAt('intro');
        m.order('follow');
        m.objective('nsg', `Schalte das Nachtsichtgerät ein ${m.key('light', 'NSG')}`, {});
        m.tip(`Nachtsicht: ${m.key('light', 'NSG')} – grünes Restlichtbild. Die Söldner haben keine Nachtsicht: Bleib im Dunkeln und geduckt.`, 8);
        const n = m._kcNight;
        const t0 = m.elapsed;
        yield () => (n && n.nvg) || m.elapsed - t0 > 30;
        if (n && !n.nvg) n.set(true);
        m.done('nsg');
        m.say('weber', 'Restlicht reicht. Ich sehe die Scheune – und am Hoftor glimmt eine Zigarette.', { expr: 'nachdenklich' });
        yield m.reach('waldrand', 'Schleich zum Gehöft', { at: [-178, 124], r: 8, label: 'Gehöft' });
        yield 0.5;
      },
    },
    {
      id: 'gehoeft',
      checkpoint: { at: [-178, 124], yaw: -0.95 },
      setup(m) { m.order('follow'); },
      *run(m) {
        m.clearObjectives();
        stealthWave(m, 'g1', FARM_GUARDS, [[[-140, 112], [-132, 104], [-140, 112]], [[-162, 98], [-162, 98]], [[-152, 92], [-160, 86], [-152, 92]]]);
        guard(m, ['g1'], [[-190, 96], [-124, 90]]);
        m.order('hold');
        m.say('lenz', 'Wir bleiben hier am Zaun. Drei Posten. Einer geht Streife zwischen Scheune und Tank. Leise, Falke.', { expr: 'ernst' });
        m.tip('Schallgedämpft und aus kurzer Entfernung: Eine Wache, die überlebt, schlägt Alarm.', 6);
        yield m.killObjective('posten', 'Schalte den Beobachtungsposten am Gehöft lautlos aus', 'g1', { pos: FARM, label: 'Gehöft' });
        m.order('follow');
        m.say('weber', 'Sauber. In der Scheune steht ein Feldtelefon – Leitung nach Süden. Sie melden sich jede halbe Stunde.', { expr: 'angespannt' });
        yield m.holdZone('telefon', 'Klemme das Feldtelefon ab (Weber meldet sich an ihrer Stelle)', { at: FARM, r: 4, secs: 5, label: 'Feldtelefon', action: 'Leitung umklemmen' });
        m.say('weber', 'Hier Hof. Alles ruhig.', { radio: true, minor: true });
        m.say('grau', 'Verstanden, Hof.', { radio: true });
        yield 1;
      },
    },
    {
      id: 'furt',
      checkpoint: { at: FARM, yaw: 0.1 },
      setup(m) { m.order('follow'); const n = m._kcNight; if (n) n.set(true); },
      *run(m) {
        m.clearObjectives();
        m.order('follow');
        stealthWave(m, 'f1', [LANE[1], [-140, 20], FORD], [[LANE[1], LANE[2], LANE[1]], [[-140, 20], [-170, 20], [-140, 20]], [FORD, [-160, -24], FORD]]);
        stealthWave(m, 'f2', [SOUTH_BANK, [-130, -70]], [[SOUTH_BANK, [-150, -70], SOUTH_BANK], [[-130, -70], [-130, -90]]]);
        guard(m, ['f1', 'f2'], [[-120, -60], [-170, -10]]);
        m.say('lenz', 'Zwei Streifen am Feldweg, eine an der Furt. Du kannst sie umgehen – oder leise abräumen. Deine Entscheidung.', { expr: 'nachdenklich' });
        m.objective('leise', 'Optional: unentdeckt bis zum Funkhügel', { optional: true });
        yield m.reach('weg', 'Folge dem Feldweg nach Süden', { at: LANE[2], r: 10, label: 'Feldweg' });
        yield m.reach('furt', 'Überquere die Furt', { at: FORD, r: 9, label: 'Furt' });
        m.say('hofer', 'Das Wasser ist eiskalt. Bleibt in Bewegung, dann merkt man es nicht.', { minor: true });
        yield m.reach('ufer', 'Erreiche das Südufer', { at: SOUTH_BANK, r: 9, label: 'Südufer' });
        if (!m.get('alarm')) m.done('leise'); else { const o = m.objs.find((x) => x.id === 'leise'); if (o) o.text = 'Optional: unentdeckt bis zum Funkhügel (verfehlt)'; }
        yield 0.5;
      },
    },
    {
      id: 'huegel',
      checkpoint: { at: SOUTH_BANK, yaw: -0.26 },
      setup(m) { m.order('follow'); const n = m._kcNight; if (n) n.set(true); },
      *run(m) {
        m.clearObjectives();
        m.order('follow');
        const st = m.get('stealth');
        if (st) st.stop();
        m.wave('h1', { count: 5, at: HILL_GUARDS, hold: true, difficulty: STEALTH_DIFF[m.diffId] || 'rekrut' });
        guard(m, ['h1'], [[-96, -150], [-140, -166]]);
        m.say('weber', 'Da oben – der Gittermast und der Bunker. Fünf Mann, vielleicht mehr im Bunker. Die Sendung beginnt in zehn Minuten.', { expr: 'angespannt' });
        yield m.reach('fuss', 'Steig zum Funkhügel hinauf', { at: [-126, -118], r: 9, label: 'Funkhügel' });
        m.order('attack', HILL);
        m.say('lenz', 'Jetzt wird es laut, egal wie leise wir sind. Auf dein Zeichen, Falke!', { expr: 'entschlossen' });
        yield m.killObjective('hk', 'Nimm den Funkhügel', ['h1', ...(m.waves.has('h1:alarm') ? ['h1:alarm'] : [])], { pos: HILL, label: 'Bunker' });
        const st2 = m.get('stealth');
        if (st2) st2.stop();
        m.order('defend', HILL);
        m.wave('h2', { count: 5, at: [[-96, -150], [-140, -166], [-104, -170], [-150, -140]], attack: HILL, radius: 9 });
        flare(m, 30);
        m.say('grau', 'Funkhügel antwortet nicht! Alle Gruppen zum Hügel!', { radio: true });
        m.say('weber', 'Ich bin am Rechner! Gib mir eine Minute – und halt sie mir vom Leib!', { expr: 'angespannt' });
        const copy = m.holdZone('kopie', 'Deck Weber, bis der Funkrechner kopiert ist', { at: HILL, r: 9, secs: 45, label: 'Funkrechner', action: 'Daten werden kopiert' });
        yield [copy];
        yield m.killObjective('h2k', 'Wehre den Gegenstoß ab', 'h2');
        m.say('weber', 'Kopie fertig! Und ich habe ihre Sendung gelöscht. Heute Nacht spricht niemand mehr über diesen Mast.', { expr: 'erleichtert' });
        yield 1;
      },
    },
    {
      id: 'flucht',
      checkpoint: { at: HILL, yaw: 2.33 },
      setup(m) { m.order('follow'); const n = m._kcNight; if (n) n.set(true); },
      *run(m) {
        m.clearObjectives();
        m.order('follow');
        flare(m, 40);
        m.say('lenz', 'Leuchtkugeln über der Straße. Sie kommen mit Fahrzeugen. Wir gehen nicht zurück über die Furt – Waldweg nach Westen, zum Abholpunkt!', { expr: 'angespannt' });
        m.wave('v1', { count: 5, at: [[-96, -150], [-104, -170], [-80, -140], [-150, -150]], attack: 'player', radius: 10 });
        m.wave('v2', { count: 4, at: [[-200, -120], [-205, -70], [-160, -120]], attack: PICKUP, radius: 10 });
        yield m.reach('abhol', 'Weich zum Abholpunkt am Waldweg aus', { at: PICKUP, r: 8, label: 'Abholpunkt' });
        m.order('defend', PICKUP);
        m.say('hofer', 'Der Wagen ist da! Alle rein – ich zähle durch!', { expr: 'angespannt' });
        yield m.killObjective('vk', 'Sichere den Abholpunkt', ['v1', 'v2'], { pos: PICKUP, label: 'Abholpunkt' });
        yield 1;
        m.complete();
      },
    },
  ],

  /** Testlauf (run.js): Nachtsicht einschalten. */
  _test(d) { const n = d._kcNight; if (n && !n.nvg && d.objs.some((o) => o.id === 'nsg' && !o.done)) n.set(true); if (d.get('stealth') && !d.noDetect) d.noDetect = true; },
};
