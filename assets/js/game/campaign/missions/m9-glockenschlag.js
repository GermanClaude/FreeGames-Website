// NULLPUNKT — Kampagne, Mission 9 „Glockenschlag“ (Altstadt, Abend): Häuserkampf unter Zeitdruck, Falk führt den Trupp.
// Kessar will über das Relais im Glockenturm gefälschte Angriffsbefehle an alle Einheiten senden. Lenz liegt im
// Lazarett; Falk führt den Trupp zum ersten Mal selbst – diesmal von Osten nach Westen. Ein Countdown läuft bis zur
// Sendung. Unterwegs flüchten Einwohner in die Kirche am Brunnenplatz, die nicht fallen darf. Am Ende wird der Funker
// lebend in der Marktgasse gestellt und verrät den Fliegerhorst Hagenmoor.
// Checkpoints: start, kirche, turm, funker. Fehlschlag: Countdown endet, Kirche fällt.

import { actor } from './cast.js?v=20261115041504';
import { guardZone, stopGuard, purgeDead, prop } from './hilfen-b.js?v=20261115041504';

const SEND = 11 * 60; // Sekunden bis zur Sendung
const LEFT = { start: SEND, kirche: 8 * 60, turm: 5 * 60, funker: null }; // Restzeit beim Wiedereinstieg
const CHURCH = [25, 0];
const TOWER = [14.5, -8.5];
const MALEK = [-33.5, 12.5];
const NORTH = [[17, -20], [26.5, -36], [33, -27], [3, -31], [8, -20]];
const SOUTH = [[17, 18], [25, 24.5], [33, 12], [-1, 21], [10, 14]];
const WEST = [[-10, -6], [-18, 4], [-21, 26.5], [-12.6, 17.6], [-2, 2]];

const CUT_INTRO = {
  location: ['Sant Aurel · Ostviertel', '20:47 Uhr · Tag 23'],
  cast: {
    falk: actor('falk', { pos: [57.4, 43.4], yaw: 0.3, aim: -0.6 }),
    weber: actor('weber', { pos: [59.2, 42.2], yaw: 2.4, aim: -0.6 }),
    hofer: actor('hofer', { pos: [55.8, 41.8], yaw: -2.5, aim: -0.7 }),
  },
  beats: [
    { cam: { from: [86, 26, 70], to: [70, 18, 58], look: [20, 6, -4], lookTo: [17.5, 10, -10.5], ease: 'inOut' }, dur: 7, fadeIn: 1.4,
      say: { who: 'funk', text: 'Anker an Trupp Falke: Das Relais von Sant Aurel sendet einen Prüfton. In elf Minuten geht Kessars Botschaft an alle Einheiten beider Seiten.' } },
    { cam: { close: 'weber', side: -0.4, dist: 0.9, push: 0.1 },
      say: { who: 'weber', text: 'Wenn das rausgeht, glauben Tausende, das Nordkorps hätte Darens Brigade überfallen. Dann schießen alle auf alle.', expr: 'angespannt' } },
    { cam: { over: ['weber', 'falk'] },
      say: { who: 'brandt', text: 'Falke, das ist jetzt dein Trupp. Ich sage dir, was ich Lenz immer gesagt habe: Behalte die Leute im Blick, nicht nur den Feind.' } },
    { cam: { close: 'falk', side: 0.35, dist: 0.9 },
      say: { who: 'falk', text: 'Verstanden, Herr Hauptmann.', expr: 'entschlossen' } },
    { cam: { close: 'hofer', side: 0.4, dist: 0.95 },
      say: { who: 'hofer', text: 'Die Leute vom Brunnenplatz sind in die Kirche geflüchtet. Alte, Kinder. Wenn dort gekämpft wird …', expr: 'ernst' } },
    { cam: { close: 'falk', side: -0.35, dist: 0.85, push: 0.12 },
      say: { who: 'falk', text: 'Dann sorgen wir dafür, dass dort nicht gekämpft wird. Weber, Hofer – mit mir. Albrecht und Kuhn sichern hinten.', expr: 'entschlossen' } },
    { cam: { close: 'weber', side: 0.35, dist: 0.9 },
      say: { who: 'weber', text: 'Wie beim ersten Mal. Nur andersherum.', expr: 'nachdenklich' } },
    { cam: { from: [64, 2.2, 50], to: [65, 3, 52], look: [57.5, 1.4, 43], lookTo: [50, 1.6, 30] },
      act: [{ who: 'falk', walk: [[54, 36], [50, 28]], speed: 2.4, at: 0.4 }, { who: 'weber', walk: [[55, 37], [51, 30]], speed: 2.2, at: 0.9 }, { who: 'hofer', walk: [[53, 38], [49, 31]], speed: 2.2, at: 1.3 }],
      say: { who: 'falk', text: 'Los.', expr: 'entschlossen' }, dur: 3.5, fadeOut: 1.0 },
  ],
};

const CUT_OUTRO = {
  location: ['Marktgasse', '21:01 Uhr'],
  cast: {
    malek: actor('malek', { pos: [-33.6, 12.4], yaw: 1.4, crouch: true, aim: -1.1 }),
    falk: actor('falk', { pos: [-31.0, 13.4], yaw: 1.9, aim: -0.9 }),
    weber: actor('weber', { pos: [-31.4, 10.6], yaw: 1.2, aim: -0.7 }),
    hofer: actor('hofer', { pos: [-30.0, 15.6], yaw: 2.4, aim: -0.8 }),
  },
  beats: [
    { cam: { from: [-18, 9, 28], to: [-22, 6, 24], look: [-32.5, 1, 12.5] }, dur: 5, fadeIn: 1,
      say: { who: 'funk', text: 'Anker an Falke: Das Relais schweigt. Keine Sendung ist hinausgegangen. Ich wiederhole: keine Sendung.' } },
    { cam: { close: 'malek', side: 0.4, dist: 0.9, push: 0.1 },
      act: [{ who: 'malek', crouch: false, at: 0.4 }, { who: 'malek', face: 'falk', at: 0.4 }],
      say: { who: 'malek', text: 'Nicht schießen. Ich bin nur Funker. Ich habe gesendet, was man mir gegeben hat.', expr: 'angespannt' } },
    { cam: { close: 'falk', side: -0.35, dist: 0.9 },
      say: { who: 'falk', text: 'Hier schießt niemand mehr. Wo ist Kessar?', expr: 'ernst' } },
    { cam: { over: ['falk', 'malek'] },
      say: { who: 'malek', text: 'Er war nie hier. Er sprach über eine Leitung aus dem Fliegerhorst Hagenmoor. Morgen früh fliegt er außer Landes – mit allem, was er über seine Geldgeber hat.', expr: 'traurig' } },
    { cam: { close: 'weber', side: 0.35, dist: 0.9 },
      say: { who: 'weber', text: 'Geldgeber? Kessar handelt nicht allein?', expr: 'fragend' } },
    { cam: { close: 'malek', side: -0.4, dist: 0.85, push: 0.1 },
      say: { who: 'malek', text: 'Er nennt sie nur „Kranich“. Mehr weiß ich wirklich nicht.', expr: 'angespannt' } },
    { cam: { close: 'hofer', side: 0.4, dist: 0.95 },
      say: { who: 'hofer', text: 'Seine Hand blutet. Ich verbinde ihn – dann gehört er der Kommission.', expr: 'ernst' } },
    { cam: { close: 'falk', side: 0.3, dist: 1.0 },
      say: { who: 'brandt', text: 'Gut gemacht, Falke. Du hast heute niemanden verloren. Ruht euch aus – um fünf Uhr fliegt ihr nach Hagenmoor. Lenz besteht darauf, mitzukommen.' } },
    { cam: { from: [-24, 3, 20], to: [-20, 7, 26], look: [-32, 1.4, 12.5] }, dur: 4, fadeOut: 1.4,
      say: { who: 'falk', text: 'Natürlich tut er das.', expr: 'erleichtert' } },
  ],
};

/** Countdown bis zur Sendung (Timer-Anzeige); Ablauf → Fehlschlag. */
function countdown(m, secs) {
  if (secs == null) return;
  m.timer(secs, 'Sendung in', () => m.fail('Kessars Botschaft ist hinausgegangen – beide Seiten greifen zu den Waffen.'));
}

export const MISSION_9 = {
  id: 'm9',
  number: 9,
  title: 'Glockenschlag',
  short: 'Glockenschlag',
  map: 'altstadt',
  time: 'abend',
  weather: 'dunst',
  type: 'Häuserkampf · Falk führt den Trupp',
  summary: 'Kessar will über das Relais von Sant Aurel gefälschte Angriffsbefehle senden. Führ den Trupp selbst durch die Altstadt, schütz die Einwohner in der Kirche und schalte den Sender ab, bevor der Countdown endet.',
  cutscenes: { intro: CUT_INTRO, outro: CUT_OUTRO },

  prepare(m) {
    m.allies([
      { role: 'weber', name: 'OGefr. Weber', at: [59.5, 45.5] },
      { role: 'hofer', name: 'San. Hofer', at: [55.5, 45] },
      { name: 'Gefr. Albrecht', at: [61.5, 46.5] },
      { name: 'Gefr. Kuhn', at: [53.5, 46.5] },
    ]);
    m.zone('kirche', { at: CHURCH, r: 8 });
    m.order('follow');
    purgeDead(m);
    // Befehlsrad beobachten (Falk führt): letzter Befehl des Spielers
    const B = m.G.bots;
    if (B && typeof B.issueOrder === 'function' && !B._kbWrapped) {
      const orig = B.issueOrder;
      B._kbWrapped = true;
      B.issueOrder = function wrapped(o) { try { if (o && o.leader === m.G.player) m.set('befehl', o.order); } catch { /* */ } return orig.call(this, o); };
      const dispose = m.dispose.bind(m);
      m.dispose = () => { B.issueOrder = orig; B._kbWrapped = false; dispose(); };
    }
    // Einwohner in der Kirche (Figuren ohne KI, geduckt)
    const people = [[22, -3, 1.2], [24, 3, 2.6], [27.5, -1.5, -1.9], [21.5, 2.5, 0.6], [28, 3.5, -2.4]];
    m.set('leute', people.map(([x, z, yaw], i) => prop(m, { role: 'einwohner', name: 'Einwohner', team: 'A', variant: ['zivil', 'zivil-strick', 'zivil-hemd', 'zivil-arbeit', 'zivil-strick'][i], weapon: null, at: [x, z], yaw, crouch: i % 2 === 0, aim: -1.0 })));
  },

  stages: [
    {
      id: 'start',
      checkpoint: { at: [58, 45], yaw: 0.6 },
      *run(m) {
        yield m.cutsceneAt('intro');
        countdown(m, LEFT.start);
        m.objective('befehl', 'Gib deinem Trupp einen Befehl (Befehlsrad)', {});
        m.tip('Befehlsrad: Z halten (Gamepad: Steuerkreuz ↑, Touch: Knopf oben rechts) – z. B. „Ausschwärmen“ in die Gasse.', 8);
        const t0 = m.elapsed;
        yield () => !!m.get('befehl') || m.elapsed - t0 > 25;
        m.done('befehl', { quiet: !m.get('befehl') });
        if (m.get('befehl')) m.say('weber', 'Verstanden, Falke.'); else m.say('weber', 'Wir bleiben dicht bei dir, Falke.');
        m.wave('o1', { count: 5, at: [[55, 23], [48.5, 20], [62, 4.8], [65.5, 28], [50, 10]], hold: true });
        m.wave('o2', { count: 3, at: [[48.5, -20], [55, -23], [65.5, -28]], attack: 'player', radius: 8 });
        yield m.reach('gasse', 'Rücke durch die Gasse nach Westen vor', { at: [48.5, 24], r: 6, label: 'Gasse' });
        m.say('hofer', 'Vorsicht, Fenster oben rechts!', { expr: 'angespannt' });
        yield m.killObjective('ost', 'Säubere das Ostviertel', ['o1', 'o2']);
        m.say('weber', 'Ostviertel ist frei. Durch die Werkstatt kommen wir auf den Platz.');
        yield 1;
      },
    },
    {
      id: 'kirche',
      checkpoint: { at: [47, 3], yaw: 1.57 },
      setup(m) { countdown(m, LEFT.kirche); m.order('follow'); },
      *run(m) {
        m.clearObjectives();
        yield m.reach('werkstatt', 'Geh durch die Werkstatt zum Brunnenplatz', { at: [36, 2], r: 5, label: 'Werkstatt' });
        m.say('hofer', 'Sie kommen auf die Kirche zu! Von Norden und Süden!', { expr: 'angespannt' });
        m.order('defend', CHURCH);
        m.objective('kirche', 'Schütze die Einwohner in der Kirche', { pos: CHURCH, label: 'Kirche', progress: 1 });
        guardZone(m, 'kirche', { secs: 10, bar: 'kirche', warn: ['hofer', 'Sie sind an der Kirchentür! Falke!'], fail: 'Kessars Leute haben die Kirche gestürmt.' });
        m.wave('k1', { count: 5, at: NORTH, attack: 'kirche', radius: 6 });
        yield 10;
        m.wave('k2', { count: 5, at: SOUTH, attack: 'kirche', radius: 6 });
        m.say('weber', 'Zweite Gruppe von Süden! Sie wollen die Kirche als Deckung!', { expr: 'angespannt' });
        yield m.killObjective('kw', 'Wehre die Angreifer ab', ['k1', 'k2']);
        m.done('kirche');
        stopGuard(m, 'kirche');
        m.say('hofer', 'Allen geht es gut. Ein Kind hat nach dir gefragt – ob du der Soldat bist, der die Glocke wieder läuten lässt.', { expr: 'erleichtert' });
        yield 1.5;
      },
    },
    {
      id: 'turm',
      checkpoint: { at: [31, 5], yaw: 2.2 },
      setup(m) { countdown(m, LEFT.turm); m.order('follow'); },
      *run(m) {
        m.clearObjectives();
        m.order('follow');
        m.say('weber', 'Der Sender steht im Turm, wie beim ersten Mal. Eingang auf der Westseite.');
        m.wave('t1', { count: 3, at: [[12, -6], [8, -20], [17, -20]], hold: true });
        yield m.reach('turm', 'Erreiche den Glockenturm', { at: TOWER, r: 3.5, label: 'Glockenturm' });
        m.wave('t2', { count: 5, at: WEST, attack: 'player', radius: 6 });
        m.say('weber', 'Halt sie mir vom Hals – ich brauche Zeit, um die Leitung zu kappen!', { expr: 'angespannt' });
        yield m.holdZone('sender', 'Schalte den Sender ab', { at: TOWER, r: 4, secs: 10, label: 'Sender', action: 'Sender wird abgeschaltet' });
        m.stopTimer();
        m.say('funk', 'Anker hier – der Prüfton ist weg! Das Relais ist stumm!', { expr: 'erleichtert' });
        yield m.killObjective('t', 'Sichere den Turm', ['t1', 't2']);
        yield 1;
      },
    },
    {
      id: 'funker',
      checkpoint: { at: [12, -3], yaw: 1.6 },
      setup(m) { m.order('follow'); },
      *run(m) {
        m.clearObjectives();
        m.order('follow');
        const fig = prop(m, { role: 'malek', at: MALEK, yaw: 1.4, crouch: true, aim: -1.1 });
        m.say('weber', 'Der Funker ist raus – Richtung Torhaus und Marktgasse! Wir brauchen ihn lebend, Falke!', { expr: 'angespannt' });
        m.tip('Der Funker ist unbewaffnet – schalte seine Begleiter aus, nicht ihn.', 6);
        m.wave('f1', { count: 4, at: [[-21.5, 2.5], [-18, 4], [-30.5, 2], [-31, 16]], hold: true });
        m.wave('f2', { count: 3, at: [[-33, 30], [-30, -24], [-35, -7]], attack: 'player', radius: 6 });
        yield m.reach('tor', 'Verfolge den Funker durchs Torhaus', { at: [-21.5, 2.5], r: 5, label: 'Torhaus' });
        yield m.killObjective('fb', 'Schalte die Begleiter des Funkers aus', ['f1', 'f2']);
        m.say('weber', 'Da kauert er, hinter dem Marktstand. Er hebt die Hände – nimm ihn fest, Falke!', { expr: 'angespannt' });
        yield m.holdZone('fest', 'Nimm den Funker fest', { at: MALEK, r: 2.8, secs: 3, label: 'Funker', action: 'Festnahme' });
        if (fig) fig.remove();
        const people = m.get('leute') || [];
        for (const p of people) if (p) p.remove();
        yield 0.5;
        m.complete();
      },
    },
  ],

  /** Testlauf (run.js): Countdown der Sendung nicht verkürzen. */
  _test(d) { if (!d.get('befehl')) d.set('befehl', 'test'); if (d.timerLabel === 'Sendung in' && d.timerLeft != null && d.timerLeft < 60) d.timerLeft = 300; },
};
