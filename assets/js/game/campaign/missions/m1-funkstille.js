// NULLPUNKT — Kampagne, Mission 1 „Funkstille“ (Altstadt): Infiltration und Häuserkampf.
// Trupp Lenz dringt im Morgengrauen über die Marktgasse und das Torhaus zum Glockenturm vor, wo Kessars Leute das
// Funkrelais des Tals abgeschaltet haben. Ziele: Marktgasse → Wachposten → Torhaus (Funkunterlagen) → Brunnenplatz →
// Glockenturm (Relais neu starten, Gegenstoß abwehren). Checkpoints: start, torhaus, turm.

import { actor } from './cast.js?v=20261114060746';

const CUT_INTRO = {
  location: ['Sant Aurel · Altstadt', '05:52 Uhr · Tag 21 der Waffenruhe'],
  cast: {
    falk: actor('falk', { pos: [-14.6, 43.6], yaw: 0.15, aim: -0.5 }),
    lenz: actor('lenz', { pos: [-13.1, 42.4], yaw: 2.2, aim: -0.55 }),
    weber: actor('weber', { pos: [-15.9, 42.5], yaw: -2.4, crouch: true, aim: -0.6 }),
  },
  beats: [
    { cam: { from: [-46, 24, 68], to: [-18, 15, 58], look: [4, 6, 2], lookTo: [17.5, 9, -10.5], ease: 'inOut' }, dur: 7, fadeIn: 1.4,
      say: { who: 'funk', text: 'Anker an alle Einheiten: Das Funkrelais Sant Aurel sendet seit drei Stunden nicht mehr. Keine Verbindung ins Tal.' } },
    { cam: { from: [-4.5, 2.4, 47.5], to: [-6.0, 2.0, 47.0], look: [-14, 1.6, 43.4] },
      say: { who: 'brandt', text: 'Falke, Lenz – das Relais im Glockenturm ist unsere einzige Leitung zu den Dörfern. Ich brauche es zurück.' } },
    { cam: { over: ['falk', 'lenz'] },
      say: { who: 'lenz', text: 'Drei Wochen Waffenruhe, und jetzt das. Jemand will, dass wir blind und taub sind.', expr: 'ernst' } },
    { cam: { close: 'lenz', side: 0.42, dist: 0.9, push: 0.15 },
      say: { who: 'lenz', text: 'Wir gehen durch die Marktgasse, dann übers Torhaus zum Brunnenplatz. Leise, solange es geht.' } },
    { cam: { close: 'weber', side: -0.4, dist: 0.95 },
      say: { who: 'weber', text: 'Ich höre ihre Frequenz mit. Alles verschlüsselt, alles kurz. Das ist nicht der normale Ostbund.', expr: 'nachdenklich' } },
    { cam: { close: 'lenz', side: -0.3, dist: 0.8, push: 0.12 },
      say: { who: 'lenz', text: 'Regeln wie besprochen: Wer die Waffe niederlegt, wird nicht angerührt. Die Leute sitzen in ihren Kellern. Wir schießen nur, wenn wir müssen.', expr: 'entschlossen' } },
    { cam: { close: 'falk', side: 0.35, dist: 0.9 },
      say: { who: 'falk', text: 'Verstanden. Ich übernehme die Spitze.', expr: 'entschlossen' } },
    { cam: { from: [-6.0, 2.0, 47.6], to: [-7.0, 3.0, 49.0], look: [-14.2, 1.7, 43.8], lookTo: [-26, 1.9, 44] },
      act: [{ who: 'falk', walk: [[-19, 44.5], [-27, 44.5]], speed: 1.6, at: 0.6 }, { who: 'lenz', walk: [[-17, 43.5], [-25, 43.5]], speed: 1.5, at: 1.2 }, { who: 'weber', crouch: false, at: 0.4 }, { who: 'weber', walk: [[-19, 43.2], [-26, 43.2]], speed: 1.5, at: 1.6 }],
      say: { who: 'lenz', text: 'Dann los. Gott behüte uns – und die Menschen hier.', expr: 'ernst' }, fadeOut: 0.9 },
  ],
};

const CUT_OUTRO = {
  location: ['Glockenturm von Sant Aurel', '07:18 Uhr'],
  cast: {
    falk: actor('falk', { pos: [12.6, -4.6], yaw: -2.6, aim: -0.6 }),
    lenz: actor('lenz', { pos: [14.4, -3.6], yaw: 2.9, aim: -0.6 }),
    weber: actor('weber', { pos: [14.0, -6.2], yaw: 0.3, crouch: true, aim: -0.7 }),
  },
  beats: [
    { cam: { orbit: [17.5, 6, -10.5], radius: 14, height: -3, from: -1.45, to: -0.95 }, dur: 5, fadeIn: 1,
      say: { who: 'weber', text: 'Relais läuft wieder. Und ich habe ihren Funkverkehr der letzten Nacht entschlüsselt.' } },
    { cam: { close: 'weber', side: 0.5, dist: 0.85, push: 0.12 },
      say: { who: 'weber', text: 'Befehl an die Brigade Kessar: Morgen, sechs Uhr, Angriff auf Werk Sieben. In Uniformen des Nordkorps.', expr: 'angespannt' } },
    { cam: { close: 'lenz', side: -0.35, dist: 0.9 },
      say: { who: 'lenz', text: 'In unseren Uniformen?', expr: 'fragend' } },
    { cam: { over: ['lenz', 'weber'] },
      say: { who: 'weber', text: 'Im Werk laufen die Pumpen für das ganze Tal. Dort arbeiten dreihundert Leute, viele mit ihren Familien.', expr: 'ernst' } },
    { cam: { close: 'lenz', side: 0.4, dist: 0.85, push: 0.1 },
      say: { who: 'lenz', text: 'Sie wollen, dass es so aussieht, als hätten wir die Waffenruhe gebrochen.', expr: 'traurig' } },
    { cam: { from: [8, 2.2, 1], to: [7, 3.5, 3], look: [13.8, 1.8, -5] },
      say: { who: 'brandt', text: 'Anker hat mitgehört. Gute Arbeit, Falke. Wir verlegen sofort zum Werk und bringen die Leute dort raus.' } },
    { cam: { close: 'falk', side: -0.4, dist: 1.0 },
      say: { who: 'brandt', text: 'Und niemand schießt, der nicht muss. Wir sind nicht wie Kessar.', expr: 'entschlossen' }, fadeOut: 1.2 },
  ],
};

export const MISSION_1 = {
  id: 'm1',
  number: 1,
  act: 1,
  title: 'Funkstille',
  short: 'Funkstille',
  map: 'altstadt',
  time: 'morgen',
  weather: 'morgennebel',
  type: 'Infiltration · Häuserkampf',
  summary: 'Das Funkrelais im Glockenturm von Sant Aurel schweigt. Dring mit Trupp Lenz durch Marktgasse und Torhaus vor und bring die Verbindung ins Tal zurück.',
  speakers: null, // gesetzt in missions/index.js
  cutscenes: { intro: CUT_INTRO, outro: CUT_OUTRO },

  prepare(m) {
    m.allies([
      { role: 'lenz', name: 'Fw. Lenz', at: [-12.6, 45.6] },
      { role: 'weber', name: 'OGefr. Weber', at: [-15.6, 45.8] },
    ]);
    m.order('follow');
  },

  stages: [
    {
      id: 'start',
      checkpoint: { at: [-14, 46.5], yaw: 0.35 },
      *run(m) {
        yield m.cutsceneAt('intro');
        m.order('follow');
        yield m.reach('markt', 'Erreiche die Marktgasse', { at: [-32, 30], r: 6, label: 'Marktgasse' });
        m.say('lenz', 'Halt. Zwei, drei Posten zwischen den Ständen. Sie haben uns noch nicht gesehen.');
        m.wave('w1', { count: 3, at: [[-33, 12], [-30.5, 2], [-35, -7]], hold: true });
        yield 1;
        yield m.killObjective('posten', 'Schalte die Wachposten in der Marktgasse aus', 'w1');
        m.say('weber', 'Posten ist weg. Keiner hat Alarm gefunkt – noch nicht.');
        yield 1.2;
      },
    },
    {
      id: 'torhaus',
      checkpoint: { at: [-31, 16], yaw: -1.2 },
      setup(m) { m.order('follow'); },
      *run(m) {
        m.clearObjectives();
        yield m.reach('tor', 'Durchsuche das Torhaus', { at: [-21.5, 2.5], r: 5, label: 'Torhaus' });
        m.say('lenz', 'Kontakt von Süden! Sie haben uns gehört – in Deckung!', { expr: 'angespannt' });
        m.wave('w2', { count: 4, at: [[-20, -30], [-10, -26], [-30, -24], [-14, -36]], attack: 'player' });
        yield m.killObjective('w2', 'Wehre den Gegenstoß ab', 'w2');
        m.say('weber', 'Hier liegt ein Funkgerät mit Schlüsselliste. Das brauche ich – gib mir Deckung, Falke.');
        yield m.holdZone('unterlagen', 'Sichere die Funkunterlagen', { at: [-21.5, 2.5], r: 3.5, secs: 4, label: 'Unterlagen', action: 'Unterlagen sichern' });
        m.say('weber', 'Hab sie. Mit der Liste kann ich ihre Befehle lesen, sobald das Relais wieder läuft.');
        yield 1;
      },
    },
    {
      id: 'turm',
      checkpoint: { at: [-18, 4], yaw: -1.57 },
      setup(m) { m.order('follow'); },
      *run(m) {
        m.clearObjectives();
        m.say('lenz', 'Weiter zum Brunnenplatz. Der Glockenturm steht direkt dahinter.');
        yield m.reach('platz', 'Rücke zum Brunnenplatz vor', { at: [-2, 2], r: 7, label: 'Brunnenplatz' });
        m.wave('w3', { count: 5, at: [[12, -6], [22, 9], [8, -20], [26, -16], [10, 14]], attack: [3, 0], radius: 8 });
        m.say('lenz', 'Sie halten den Platz! Bleib an den Säulen, nicht über die offene Fläche!', { expr: 'angespannt' });
        yield m.killObjective('w3', 'Säubere den Brunnenplatz', 'w3');
        m.say('weber', 'Platz ist frei. Der Turmeingang ist auf der Westseite.');
        yield m.reach('turm', 'Erreiche den Glockenturm', { at: [14.5, -8.5], r: 3.5, label: 'Glockenturm' });
        m.wave('w4', { count: 3, at: [[40, -12], [42, 6], [36, -24]], attack: 'player' });
        m.say('lenz', 'Verstärkung von Osten! Halte durch, bis das Relais läuft!', { expr: 'angespannt' });
        yield m.holdZone('relais', 'Starte das Funkrelais neu', { at: [14.5, -8.5], r: 4, secs: 8, label: 'Relais', action: 'Relais startet' });
        m.say('funk', 'Anker hier – wir empfangen euch wieder! Relais Sant Aurel ist zurück im Netz.');
        yield m.killObjective('w4', 'Wehre die Verstärkung ab', 'w4');
        yield 1.5;
        m.complete();
      },
    },
  ],
};
