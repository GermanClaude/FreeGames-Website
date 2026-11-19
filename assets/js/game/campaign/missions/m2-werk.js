// NULLPUNKT — Kampagne, Mission 2 „Werk Sieben“ (Werk): Verteidigung einer Stellung.
// Die Familien der Werkssiedlung werden aus dem Werkshof abtransportiert. Der Trupp hält das Werkstor der Walzhalle gegen
// drei Angriffswellen (Süden durch die Halle, Westhof, beides), bis der letzte Lkw draußen ist. Die Stellung fällt,
// wenn Angreifer das Tor 15 s lang ohne Verteidiger halten. Checkpoints: start, welle1, welle2, welle3.

import { actor } from './cast.js?v=20261119182451';

const SOUTH = [[0, -42], [-9, -44], [9, -44], [-17, -39], [17, -39]];
const WEST = [[-60, 8], [-64, -6], [-58, 22], [-70, 0], [-56, -18]];
const LOSE_SECS = 15;

const CUT_INTRO = {
  location: ['Walzwerk 7 · Werkshof', '05:21 Uhr'],
  cast: {
    brandt: actor('brandt', { pos: [7.4, 38.6], yaw: 1.45, aim: -0.9 }),
    lenz: actor('lenz', { pos: [4.6, 39.6], yaw: -1.7, aim: -0.6 }),
    falk: actor('falk', { pos: [5.0, 37.3], yaw: -1.4, aim: -0.6 }),
    weber: actor('weber', { pos: [3.6, 38.2], yaw: -1.6, aim: -0.6 }),
  },
  beats: [
    { cam: { from: [34, 19, 64], to: [14, 9, 54], look: [0, 4, 12], lookTo: [4, 2, 36] }, dur: 7, fadeIn: 1.4,
      say: { who: 'funk', text: 'Anker an Werk Sieben: Busse und Lkw sind unterwegs. Erste Abfahrt in vier Minuten.' } },
    { cam: { from: [13, 2.3, 33.5], to: [12, 2.0, 35], look: [5.6, 1.8, 38.3] },
      say: { who: 'brandt', text: 'Die Familien aus der Werkssiedlung warten im Werkshof. Die Lkw nehmen sie mit, sobald alle oben sind.' } },
    { cam: { close: 'brandt', side: 0.4, dist: 0.9, push: 0.12 },
      say: { who: 'brandt', text: 'Kessars Leute kommen von Süden durch die Walzhalle und über den Westhof. Wir halten das Werkstor.', expr: 'ernst' } },
    { cam: { close: 'lenz', side: -0.4, dist: 0.9 },
      say: { who: 'lenz', text: 'Wir sind eine Handvoll gegen eine Brigade, Herr Hauptmann.', expr: 'nachdenklich' } },
    { cam: { close: 'brandt', side: -0.3, dist: 0.85, push: 0.1 },
      say: { who: 'brandt', text: 'Wir müssen nicht siegen, Lenz. Wir müssen nur lange genug stehen, bis der letzte Lkw draußen ist.', expr: 'entschlossen' } },
    { cam: { close: 'weber', side: 0.35, dist: 0.95 },
      say: { who: 'weber', text: 'Und wenn sie wirklich unsere Uniformen tragen?', expr: 'fragend' } },
    { cam: { over: ['weber', 'brandt'] },
      say: { who: 'brandt', text: 'Dann erkennt man den Unterschied daran, wer die Zivilisten schützt. Auf eure Plätze.', expr: 'entschlossen' }, fadeOut: 1 },
  ],
};

const CUT_OUTRO = {
  location: ['Walzwerk 7 · Werkstor', '05:34 Uhr'],
  cast: {
    brandt: actor('brandt', { pos: [4.4, 37.7], yaw: -2.6, aim: -0.9 }), // Runde 2: vorher auf einer Kiste (0,81 m)
    lenz: actor('lenz', { pos: [1.2, 35.6], yaw: 0.5, aim: -0.6 }),
    falk: actor('falk', { pos: [-0.6, 37.0], yaw: -0.9, aim: -0.6 }),
    weber: actor('weber', { pos: [2.0, 39.4], yaw: 2.9, crouch: true, aim: -0.7 }),
  },
  beats: [
    { cam: { from: [-14, 6, 52], to: [-8, 4, 46], look: [1.5, 1.7, 37.5] }, dur: 5, fadeIn: 1,
      say: { who: 'funk', text: 'Letzter Lkw hat die Brücke von Ebersfeld passiert. Alle Zivilisten aus Werk Sieben sind in Sicherheit.' } },
    { cam: { close: 'lenz', side: 0.4, dist: 0.9 },
      say: { who: 'lenz', text: 'Alle raus. Keiner zurückgelassen.', expr: 'erleichtert' } },
    { cam: { close: 'weber', side: -0.4, dist: 0.9, push: 0.1 },
      say: { who: 'weber', text: 'Herr Hauptmann – jemand ist auf unserer Frequenz. Offener Kanal, ohne Schlüssel.', expr: 'angespannt' } },
    { cam: { from: [6, 2.4, 41], to: [5, 2.2, 40], look: [1.6, 1.7, 37.4] },
      say: { who: 'daren', text: 'Hier spricht Major Ilja Daren, Ostbund, Dritte Grenzbrigade. Ich weiß, was Oberst Kessar vorhat.' } },
    { cam: { close: 'brandt', side: 0.35, dist: 0.95 },
      say: { who: 'daren', text: 'Er sprengt heute Nacht die Brücke am Grenzfluss. Dann ist das Tal abgeschnitten – und alle werden Ihnen die Schuld geben.' } },
    { cam: { close: 'brandt', side: -0.35, dist: 0.85, push: 0.1 },
      say: { who: 'brandt', text: 'Warum erzählen Sie uns das, Major?', expr: 'fragend' } },
    { cam: { over: ['falk', 'brandt'] },
      say: { who: 'daren', text: 'Weil meine Leute nicht für Kessars Lügen sterben sollen. Halten Sie die Brücke. Ich melde mich wieder.' } },
    { cam: { close: 'brandt', side: 0.2, dist: 0.9 },
      say: { who: 'brandt', text: 'Falke, mach dich bereit. Du fährst Eisen 2. Wir gehen an den Fluss.', expr: 'entschlossen' }, fadeOut: 1.2 },
  ],
};

/** Kontrolle des Werkstors: läuft ab der ersten Welle (einmal angelegt, gilt über die Checkpoints). */
function guardGate(m) {
  if (m.get('gate')) return;
  m.set('gate', true);
  let lost = 0;
  m.every((dt) => {
    if (m.G.match.state !== 'playing') return false;
    const foes = m.countIn('tor', 'B');
    const ours = m.countIn('tor', 'A');
    if (foes > 0 && ours === 0) lost += dt;
    else lost = Math.max(0, lost - dt * 0.5);
    m.bar('halten', 1 - lost / LOSE_SECS);
    if (lost > 0.5 && !m.get('warned')) { m.set('warned', true); m.say('lenz', 'Sie sind am Tor! Zurück in die Stellung!', { expr: 'angespannt', radio: true }); }
    if (lost <= 0) m.set('warned', false);
    if (lost >= LOSE_SECS) { m.fail('Das Werkstor ist gefallen – die Lkw kommen nicht mehr heraus.'); return true; }
    return false;
  });
}

function trucks(m, n) {
  m.objective('lkw', 'Lkw mit Zivilisten abgefahren', { total: 3, quiet: true });
  m.progress('lkw', n, 3);
}

export const MISSION_2 = {
  id: 'm2',
  number: 2,
  act: 1,
  title: 'Werk Sieben',
  short: 'Werk Sieben',
  map: 'werk',
  time: 'morgen',
  weather: 'dunst',
  type: 'Verteidigung einer Stellung',
  summary: 'Kessar will das Werk angreifen und dem Nordkorps die Schuld geben. Halte das Werkstor, bis die Familien der Werkssiedlung abtransportiert sind.',
  cutscenes: { intro: CUT_INTRO, outro: CUT_OUTRO },

  prepare(m) {
    m.allies([
      { role: 'lenz', name: 'Fw. Lenz', at: [2.5, 42] },
      { role: 'weber', name: 'OGefr. Weber', at: [-1, 42.5] },
      { role: 'hofer', name: 'San. Hofer', at: [4.5, 43] },
      { name: 'Gefr. Albrecht', at: [-3, 41.5] },
    ]);
    m.zone('tor', { at: [0, 33], r: 8.5 });
    m.order('follow');
  },

  stages: [
    {
      id: 'start',
      checkpoint: { at: [1.5, 44], yaw: 0 },
      *run(m) {
        yield m.cutsceneAt('intro');
        yield m.reach('stellung', 'Beziehe Stellung am Werkstor', { at: [0, 33], r: 6, label: 'Werkstor' });
        m.order('defend', [0, 32]);
        m.tip('Befehlsrad (Z bzw. Touch-Knopf oben rechts): Befehle an deine Kameraden.', 6);
        m.say('lenz', 'Ich nehme die linke Seite, Weber die Rohrbrücke. Falke, du hältst die Mitte.');
        yield m.timer(25, 'Angriff in');
      },
    },
    {
      id: 'welle1',
      checkpoint: { at: [0, 38], yaw: 0 },
      setup(m) { m.order('defend', [0, 32]); },
      *run(m) {
        m.clearObjectives();
        m.objective('halten', 'Halte das Werkstor', { pos: [0, 31], label: 'Werkstor', progress: 1 });
        trucks(m, 0);
        guardGate(m);
        m.wave('w1', { count: 5, at: SOUTH, attack: 'tor', radius: 7 });
        m.say('weber', 'Bewegung in der Walzhalle! Sie kommen von Süden!', { expr: 'angespannt' });
        yield m.timer(65, 'Evakuierung');
        trucks(m, 1);
        m.say('funk', 'Erster Lkw ist raus. Noch zwei.');
        yield 2;
      },
    },
    {
      id: 'welle2',
      checkpoint: { at: [0, 38], yaw: 0 },
      setup(m) { m.order('defend', [0, 32]); },
      *run(m) {
        m.clearObjectives();
        m.objective('halten', 'Halte das Werkstor', { pos: [0, 31], label: 'Werkstor', progress: 1, quiet: true });
        trucks(m, 1);
        guardGate(m);
        m.wave('w2', { count: 6, at: WEST, attack: 'tor', radius: 7 });
        m.say('feind', 'Nordkorps, ihr steht auf fremdem Boden. Legt die Waffen nieder, dann lassen wir euch abziehen.', { radio: true });
        yield 6;
        m.say('brandt', 'Nicht antworten. Er will nur wissen, wie viele wir sind.', { radio: true });
        m.say('lenz', 'Westhof! Sie kommen über die Container!', { expr: 'angespannt' });
        yield m.timer(65, 'Evakuierung');
        trucks(m, 2);
        m.say('funk', 'Zweiter Lkw ist raus. Der letzte wird beladen – haltet durch.');
        yield 2;
      },
    },
    {
      id: 'welle3',
      checkpoint: { at: [0, 38], yaw: 0 },
      setup(m) { m.order('defend', [0, 32]); },
      *run(m) {
        m.clearObjectives();
        m.objective('halten', 'Halte das Werkstor', { pos: [0, 31], label: 'Werkstor', progress: 1, quiet: true });
        trucks(m, 2);
        guardGate(m);
        m.wave('w3a', { count: 4, at: SOUTH, attack: 'tor', radius: 6 });
        m.wave('w3b', { count: 3, at: WEST, attack: 'tor', radius: 6 });
        m.say('hofer', 'Ich habe Verwundete hinter dem Tor. Lasst sie nicht durch!', { expr: 'angespannt' });
        yield 8;
        m.say('brandt', 'Letzte Welle. Wer jetzt steht, rettet dreihundert Menschen.', { radio: true, expr: 'entschlossen' });
        yield m.timer(70, 'Evakuierung');
        trucks(m, 3);
        m.done('halten');
        m.say('funk', 'Letzter Lkw ist durch! Alle Zivilisten sind raus!');
        const rest = ['w1', 'w2', 'w3a', 'w3b'].filter((w) => m.waves.has(w));
        yield m.killObjective('rest', 'Vertreibe die restlichen Angreifer', rest);
        m.say('lenz', 'Sie ziehen ab. Feuer einstellen!');
        yield 2;
        m.complete();
      },
    },
  ],
};
