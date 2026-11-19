// NULLPUNKT — Kampagne, Mission 4 „Hafennacht“ (Hafen, Abend, bewölkt): Schleichen, Sabotage, Befreiung.
// Darens Unterlagen führen zum Frachter „Seeschwalbe“: Kessars gefälschte Uniformen und Sprengstoff stehen in drei
// Containern auf dem Terminal. Falk schleicht mit Weber (folgt geduckt, ohne KI) durch das Containerlabyrinth, markiert
// die Container für die Pioniere und holt den erpressten Kapitän Vogt aus dem Kaibüro. Dann geht der Alarm los: Vogt
// muss über den Kai zum Boot am Südkai, Lenz kommt mit zwei Mann zur Hilfe.
// Mechanik: Entdeckungsanzeige (director.stealth – Wahrnehmung der Bots), Streifen (wave.patrol), schallgedämpfte
// Waffe (mission.loadout.att), Begleitschutz (director.extra, protect). Entdeckt vor der Befreiung → Fehlschlag
// (auf „Rekrut“ nur Gefecht). Checkpoints: start, c2, c3, buero, ausbruch.

import { actor } from './cast.js?v=20261115041504';

const START = [10.5, 46];
const BOAT = [-40.6, 45.4];
const C1 = { at: [6.0, 26.6], label: 'Container 1' };      // Reihe 4, blauer Container
const C2 = { at: [-12.3, 12.5], label: 'Container 2' };    // Reihe 2, gelber Container
const C3 = { at: [-22.3, -14], label: 'Container 3' };     // Westrand, grüner Container
const OFFICE = [-31.5, -21.6];                             // Kaibüro Nord (begehbar)
/** Wachen beim Schleichen: Wahrnehmung eine Stufe unter der Kampagnen-Schwierigkeit (fair im Halbdunkel). */
const STEALTH_DIFF = { rekrut: 'rekrut', regulaer: 'rekrut', veteran: 'regulaer', elite: 'veteran' };

const CUT_INTRO = {
  location: ['Containerterminal Nordkai', '19:46 Uhr · Tag 23 der Waffenruhe'],
  cast: {
    falk: actor('falk', { pos: [9.8, 47.6], yaw: 0.2, aim: -0.5, crouch: true }),
    weber: actor('weber', { pos: [11.7, 48.0], yaw: -0.3, aim: -0.6, crouch: true }),
    lenz: actor('lenz', { pos: [10.6, 49.6], yaw: 0.05, aim: -0.55 }),
  },
  beats: [
    { cam: { from: [62, 24, 64], to: [36, 16, 58], look: [-10, 4, 0], lookTo: [-20, 3, -10] }, dur: 7, fadeIn: 1.6,
      say: { who: 'funk', text: 'Anker an Trupp Lenz: Der Frachter Seeschwalbe liegt seit gestern Abend am Nordkai. Ladung laut Papieren: Ersatzteile.' } },
    { cam: { from: [16, 2.2, 52], to: [15, 2.0, 51], look: [10.6, 1.2, 48.4] },
      say: { who: 'brandt', text: 'Darens Unterlagen sagen etwas anderes. Uniformen des Nordkorps, Funkgeräte, Sprengstoff. Drei Container stehen schon auf dem Terminal.' } },
    { cam: { close: 'lenz', side: 0.4, dist: 0.95, push: 0.1 },
      say: { who: 'lenz', text: 'Wir markieren sie für die Pioniere. Kein Alarm – sonst jagen sie die Ladung hoch, bevor wir sie sichern.', expr: 'ernst' } },
    { cam: { close: 'weber', side: -0.35, dist: 0.9 },
      say: { who: 'weber', text: 'Und der Kapitän? Anselm Vogt. Sie halten ihn im Kaibüro fest. Seine Familie haben sie bedroht, damit er fährt.', expr: 'nachdenklich' } },
    { cam: { close: 'lenz', side: -0.3, dist: 0.85, push: 0.1 },
      say: { who: 'lenz', text: 'Den holen wir mit raus. Falke, du gehst mit Weber rein. Ich decke euch vom Südtor und bringe das Boot.', expr: 'entschlossen' } },
    { cam: { close: 'falk', side: 0.35, dist: 0.9 },
      say: { who: 'falk', text: 'Leise rein, leise raus.', expr: 'entschlossen' } },
    { cam: { from: [14, 1.6, 44], to: [12, 2.4, 40], look: [9.8, 1, 47.6], lookTo: [0, 2, 20] },
      act: [{ who: 'falk', walk: [[9.6, 42], [9.8, 36]], speed: 1.2, at: 0.5 }, { who: 'weber', walk: [[11.2, 43], [11, 37]], speed: 1.2, at: 1.0 }],
      say: { who: 'lenz', text: 'Bleibt geduckt und im Schatten. Die Wachen gehen Streife – wartet, bis sie euch den Rücken zudrehen.' }, fadeOut: 0.9 },
  ],
};

const CUT_OUTRO = {
  location: ['Südkai · Boot der Hafenaufsicht', '20:31 Uhr'],
  cast: {
    falk: actor('falk', { pos: [-38.6, 43.8], yaw: 2.4, aim: -0.6 }),
    vogt: actor('vogt', { pos: [-40.2, 45.6], yaw: -0.9, aim: -1.0 }),
    lenz: actor('lenz', { pos: [-37.4, 45.9], yaw: 1.8, aim: -0.6 }),
    weber: actor('weber', { pos: [-38.2, 41.9], yaw: 2.9, aim: -0.6 }),
  },
  beats: [
    { cam: { from: [-30, 9, 30], to: [-32, 6, 36], look: [-39, 1.2, 44.5] }, dur: 5.5, fadeIn: 1,
      say: { who: 'funk', text: 'Pioniere melden: Drei Container gesichert. Uniformen mit unseren Abzeichen, Funkgeräte, zwei Tonnen Sprengstoff.' } },
    { cam: { close: 'vogt', side: 0.4, dist: 0.95, push: 0.1 },
      say: { who: 'vogt', text: 'Sie haben gesagt, meiner Frau und den Kindern geschieht nichts, solange ich fahre und schweige.', expr: 'traurig' } },
    { cam: { close: 'lenz', side: -0.35, dist: 0.9 },
      say: { who: 'lenz', text: 'Ihre Familie ist in Sicherheit, Herr Vogt. Anker hat sie heute Nachmittag abgeholt.', expr: 'ernst' } },
    { cam: { close: 'vogt', side: -0.3, dist: 0.9 },
      say: { who: 'vogt', text: 'Dann sage ich Ihnen alles. Kessars Leute sprachen vom Staatsarchiv. Dort liegen die Originale der Waffenruhe.', expr: 'nachdenklich' } },
    { cam: { over: ['falk', 'weber'] },
      say: { who: 'weber', text: 'Wenn die Originale verschwinden, steht Kessars Fälschung allein da. Dann glaubt jeder seine Geschichte.', expr: 'angespannt' } },
    { cam: { close: 'lenz', side: 0.3, dist: 0.85, push: 0.1 },
      say: { who: 'lenz', text: 'Dann sind wir vor ihm dort. Alle ins Boot.', expr: 'entschlossen' }, fadeOut: 1.2 },
  ],
};

/** Wachen eines Abschnitts mit Entdeckungsanzeige; Alarm → Fehlschlag (Rekrut: Gefecht). */
function guard(m, waves) {
  const old = m.get('stealth');
  if (old) old.stop();
  const st = m.stealth(waves, {
    onAlarm: (why) => {
      const txt = why === 'schuss' ? 'Ein Schuss ohne Schalldämpfer – sie haben es gehört.' : why === 'getroffen' ? 'Die Wache hat überlebt und schlägt Alarm.' : 'Du wurdest entdeckt.';
      if (m.diffId === 'rekrut') {
        m.say('weber', 'Sie haben uns! Feuer frei, aber schnell!', { expr: 'angespannt' });
        m.tip(`${txt} (Rekrut: weiter im Gefecht)`, 4);
        return;
      }
      m.say('feind', 'Alarm am Terminal! Ladung vorbereiten!', { radio: true });
      let t = 0;
      m.every((dt) => { t += dt; if (t < 1.8) return false; m.fail(`${txt} Kessars Leute sprengen die Ladung, bevor die Pioniere sie sichern.`); return true; });
    },
  });
  m.set('stealth', st);
  return st;
}

/** Container markieren: in der Nähe bleiben (Peilsender anbringen). */
function markContainer(m, id, c, n) {
  return m.holdZone(id, `Markiere ${c.label} (${n} von 3)`, { at: c.at, r: 2.2, secs: 3, label: c.label, action: 'Peilsender anbringen' });
}

function weber(m) {
  const P = m.G.player.position;
  const w = m.extra('weber', { pos: [P.x + 1.2, P.z + 1.4], variant: 'funker', weapon: 'ar_m17', name: 'OGefr. Weber', aim: -0.6, face: false });
  w.follow(m.G.player, { crouch: true });
  return w;
}

export const MISSION_4 = {
  id: 'm4',
  number: 4,
  act: 1,
  title: 'Hafennacht',
  short: 'Hafennacht',
  map: 'hafen',
  time: 'abend',
  weather: 'bewoelkt',
  type: 'Schleichen · Sabotage · Befreiung',
  summary: 'Am Nordkai liegt der Frachter „Seeschwalbe“ mit Kessars gefälschten Uniformen und Sprengstoff. Schleich dich mit Weber über das Terminal, markiere die Container und hol den erpressten Kapitän heraus – ohne Alarm.',
  loadout: { primary: 'smg_wespe', secondary: 'pi_p9', att: { smg_wespe: { muendung: 'daempfer' }, pi_p9: { muendung: 'daempfer' } } },
  cutscenes: { intro: CUT_INTRO, outro: CUT_OUTRO },

  prepare() {},

  stages: [
    {
      id: 'start',
      name: 'Südtor',
      checkpoint: { at: START, yaw: 0 },
      *run(m) {
        yield m.cutsceneAt('intro');
        m.introduce('waffe', 'smg_wespe', 'KM-7 Wespe mit Schalldämpfer: leise und ohne Mündungsfeuer – Wachen hören den Schuss kaum.');
        weber(m);
        m.wave('g1', { count: 3, scale: false, at: [[10.5, 30], [0.4, 14], [-1.5, 36]], hold: true, difficulty: STEALTH_DIFF[m.diffId] || 'rekrut', patrol: [[[10.5, 30], [10.5, 8], [10.5, 30]], [[0.4, 14], [0.4, 4]], [[-1.5, 36], [-1.5, 26]]] });
        guard(m, ['g1']);
        m.tip('Geduckt bist du leiser und schwerer zu sehen. Die Anzeige oben zeigt, wie nah eine Wache daran ist, dich zu erkennen.', 7);
        m.say('weber', 'Erster Container steht gleich vorn, Reihe vier. Der blaue.', { radio: false });
        yield markContainer(m, 'c1', C1, 1);
        m.say('lenz', 'Gut. Sender sitzt. Weiter nach Westen.', { radio: true });
        yield 1;
      },
    },
    {
      id: 'c2',
      name: 'Kranplatz',
      checkpoint: { at: [6.5, 28.5], yaw: 1.2 },
      setup(m) { weber(m); },
      *run(m) {
        m.clearObjectives();
        m.wave('g2', { count: 3, scale: false, at: [[-7.5, 18], [-20.6, 18], [-11.5, -2]], hold: true, difficulty: STEALTH_DIFF[m.diffId] || 'rekrut', patrol: [[[-7.5, 18], [-7.5, 8]], [[-20.6, 18], [-20.6, 24]], [[-11.5, -2], [-11.5, -6]]] });
        guard(m, ['g1', 'g2']);
        m.say('weber', 'Der gelbe Container am Kranplatz. Zwei Wachen, eine geht Streife.', { radio: false });
        yield markContainer(m, 'c2', C2, 2);
        m.say('weber', 'Zwei von drei. Der letzte steht am Westrand, fast am Kai.');
        yield 1;
      },
    },
    {
      id: 'c3',
      name: 'Westrand',
      checkpoint: { at: [-12.0, 16.5], yaw: 1.6 },
      setup(m) { weber(m); },
      *run(m) {
        m.clearObjectives();
        m.wave('g3', { count: 2, scale: false, at: [[-20.8, 2], [-28, -8]], hold: true, difficulty: STEALTH_DIFF[m.diffId] || 'rekrut', patrol: [[[-20.8, 2], [-20.8, -20]], [[-28, -8], [-28, 6]]] });
        guard(m, ['g1', 'g2', 'g3']);
        yield markContainer(m, 'c3', C3, 3);
        m.say('lenz', 'Alle drei markiert. Die Pioniere warten auf euer Zeichen. Jetzt der Kapitän.', { radio: true });
        yield 1;
      },
    },
    {
      id: 'buero',
      name: 'Kaibüro',
      checkpoint: { at: [-21.5, -8], yaw: 2.2 },
      setup(m) { weber(m); },
      *run(m) {
        m.clearObjectives();
        const vogt = m.extra('vogt', { pos: OFFICE, yaw: Math.PI, variant: 'kapitaen', name: 'Kapitän Vogt', crouch: true, protect: true, aim: -1.1 });
        m.wave('g4', { count: 3, scale: false, at: [[-30, -16], [-36, -24], [-27.5, -27]], hold: true, difficulty: STEALTH_DIFF[m.diffId] || 'rekrut', patrol: [[[-30, -16], [-34, -16]], [[-36, -24], [-36, -34]], [[-27.5, -27], [-27.5, -33]]] });
        const st = guard(m, ['g1', 'g2', 'g3', 'g4']);
        m.say('weber', 'Das Kaibüro. Drei Wachen davor. Pass auf, dass du den Kapitän nicht triffst.');
        yield m.reach('tuer', 'Erreiche das Kaibüro', { at: [-31.5, -19.2], r: 2.2, label: 'Kaibüro' });
        yield m.holdZone('fesseln', 'Befreie Kapitän Vogt', { at: OFFICE, r: 2.2, secs: 3, label: 'Kapitän', action: 'Fesseln lösen' });
        st.stop();
        if (m.ui) m.ui.meter(null);
        vogt.follow(m.G.player);
        m.say('vogt', 'Wer sind Sie? … Nordkorps? Endlich. Bringen Sie mich hier weg.', { expr: 'angespannt' });
        yield 2;
      },
    },
    {
      id: 'ausbruch',
      name: 'Ausbruch',
      checkpoint: { at: [-30.5, -17.5], yaw: 3.1 },
      setup(m) {
        weber(m);
        const v = m.extra('vogt', { pos: [-31.5, -19.5], variant: 'kapitaen', name: 'Kapitän Vogt', protect: true, aim: -1.1 });
        v.follow(m.G.player);
      },
      *run(m) {
        m.clearObjectives();
        const vogt = m.extras.get('vogt');
        m.say('feind', 'Der Kapitän ist weg! Alle Mann zum Kaibüro!', { radio: true });
        // Alarm: Gefecht; Lenz kommt mit zwei Mann vom Südkai
        m.removeEnemies();
        m.wave('n1', { count: 4, at: [[-30, -46], [-20, -46], [-10, -46], [-36, -44]], attack: 'player' });
        m.allies([
          { role: 'lenz', name: 'Fw. Lenz', at: [-36, 40] },
          { name: 'Gefr. Albrecht', at: [-34, 41.5] },
          { name: 'Gefr. Kuhn', at: [-38, 41.5] },
        ]);
        m.order('attack', [-30, 10]);
        m.say('lenz', 'Wir hören euch! Kommt nach Süden, am Kai entlang – wir halten euch den Weg frei!', { radio: true, expr: 'angespannt' });
        m.objective('vogt', 'Kapitän Vogt muss überleben', { quiet: true });
        yield m.reach('kai', 'Bring Vogt am Kai entlang nach Süden', { at: [-36, 6], r: 7, label: 'Kai' });
        m.wave('n2', { count: 4, at: [[-16, -20], [-8, -12], [-18, 2], [-6, 0]], attack: 'player' });
        m.say('weber', 'Von links, aus den Containern!', { expr: 'angespannt' });
        yield m.reach('steg', 'Erreiche das Boot am Südkai', { at: [-38.5, 40], r: 6, label: 'Boot' });
        m.order('defend', [-37, 38]);
        m.say('lenz', 'Das Boot legt gleich an. Haltet sie vom Kai fern!', { radio: false, expr: 'entschlossen' });
        m.wave('n3', { count: 5, at: [[-30, 10], [-20, 14], [-36, 18], [-12, 20], [-26, 24]], attack: [-37, 38], radius: 8 });
        const near = () => vogt && vogt.position.distanceTo(m.vec(BOAT)) < 9;
        yield m.holdZone('pier', 'Halte den Steg, bis das Boot anlegt', { at: [-38.5, 40], r: 7, secs: 40, label: 'Steg', action: 'Boot legt an' });
        m.done('vogt', { quiet: true });
        yield m.killObjective('rest', 'Wehre die letzten Angreifer ab', ['n3']);
        if (vogt && !near()) vogt.walk([[-39, 42], [BOAT[0], BOAT[1]]], 2.2);
        m.say('lenz', 'Boot ist da. Alle an Bord!');
        yield 2;
        m.complete();
      },
    },
  ],
};
