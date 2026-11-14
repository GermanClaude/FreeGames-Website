// NULLPUNKT — Kampagne, Mission 7 „Niemandsland“ (Niemandsland): große Schlacht, Halten der Linie.
// Kessar greift mit allem an, was ihm folgt. Darens Brigade verweigert den Befehl; Nordkorps- und Ostbund-Soldaten gehen
// gemeinsam aus dem Südgraben vor, nehmen die Kapellenruine, halten sie gegen drei immer größere Wellen (Massenschlacht:
// Nebengefechte an Dorfruine und Trichterfeld laufen dauernd mit), holen das Artillerie-Funkgerät vom Panzerwrack zurück,
// markieren Kessars Panzerkolonne für einen Präzisionsschlag zweier Jäger und bergen zum Schluss die Verwundeten.
// Checkpoints: start, halten, funk, schlag, bergen. Team A (Spieler) im Süden (+z), Kessar im Norden (−z).

import { actor } from './cast.js?v=20261114060746';
import { guardZone, stopGuard, ostbund, squad, purgeDead, strike, jetPass, prop } from './hilfen-b.js?v=20261114060746';

const CHAPEL = [125, -6];
const NORTH = [[95, -92], [125, -98], [155, -92], [110, -80], [140, -82], [80, -84], [170, -86]];
const WEST = [[62, -48], [56, -20], [70, -70], [50, -36]];
const EAST = [[192, -40], [196, -12], [186, -62], [200, -28]];
const WRECK = [4, 16];
const OP = [16, 4]; // Beobachtungspunkt am Trichterrand
const SAN = [124, 10]; // Sanitätsposten in der Ruine
const WOUNDED = [{ id: 'v1', at: [88, -24], yaw: 0.8 }, { id: 'v2', at: [158, -36], yaw: -0.6 }];

const CUT_INTRO = {
  groundRel: true,
  location: ['Niemandsland · Südgraben', '06:04 Uhr · Tag 23'],
  cast: {
    brandt: actor('brandt', { pos: [129.5, 121.2], yaw: 1.6, aim: -0.9 }),
    daren: actor('daren', { pos: [127.2, 121.6], yaw: -1.5, aim: -1.0 }),
    lenz: actor('lenz', { pos: [125.4, 120.6], yaw: -1.2, aim: -0.6 }),
    falk: actor('falk', { pos: [123.6, 121.4], yaw: -1.7, aim: -0.6 }),
    weber: actor('weber', { pos: [131.6, 120.4], yaw: 1.9, crouch: true, aim: -0.7 }),
    orlan: actor('orlan', { pos: [128.4, 123.2], yaw: 3.0, aim: -0.6 }),
  },
  beats: [
    { cam: { path: [[60, 38, 210], [92, 26, 168], [112, 14, 140]], look: [125, 2, -6], lookTo: [125, 1, 60] }, dur: 8, fadeIn: 1.6,
      say: { who: 'funk', text: 'Anker an alle Einheiten: Starke Kräfte der Brigade Kessar vor der Nordstellung. Infanterie, Panzer, mindestens zwei Bataillone.' } },
    { cam: { over: ['brandt', 'daren'] },
      say: { who: 'daren', text: 'Mein Befehl lautete, heute Morgen mit Kessar zu marschieren. Ich habe ihn verweigert. Zweihundert meiner Leute auch.', expr: 'ernst' } },
    { cam: { close: 'brandt', side: 0.4, dist: 0.9, push: 0.1 },
      say: { who: 'brandt', text: 'Dann stehen wir heute im selben Graben, Major. Das hätte vor einer Woche niemand geglaubt.', expr: 'nachdenklich' } },
    { cam: { close: 'lenz', side: -0.35, dist: 0.9 },
      say: { who: 'lenz', text: 'Die Kapellenruine ist der einzige feste Punkt im Niemandsland. Wer sie hält, sieht beide Linien.' } },
    { cam: { close: 'orlan', side: 0.35, dist: 0.95 },
      say: { who: 'orlan', text: 'Hauptfeldwebel Orlan, Dritte Grenzbrigade. Meine Gruppe geht mit Ihnen, Feldwebel. Sagen Sie uns, wo wir stehen sollen.', expr: 'entschlossen' } },
    { cam: { close: 'lenz', side: 0.3, dist: 0.85, push: 0.1 },
      say: { who: 'lenz', text: 'Neben uns. Das reicht.', expr: 'entschlossen' } },
    { cam: { close: 'weber', side: -0.4, dist: 0.95 },
      say: { who: 'weber', text: 'Unser Beobachtungsposten am Panzerwrack ist in der Nacht überrannt worden. Mit ihm das Artillerie-Funkgerät.', expr: 'angespannt' } },
    { cam: { close: 'brandt', side: -0.3, dist: 0.85 },
      say: { who: 'brandt', text: 'Erst die Kapelle, dann das Gerät. Und jeder Verwundete wird geborgen – gleich, welche Uniform er trägt.', expr: 'entschlossen' } },
    { cam: { from: [118, 4, 128], to: [119, 6, 132], look: [126, 1.5, 120], lookTo: [126, 2, 100] },
      act: [{ who: 'falk', walk: [[124, 117], [125, 110]], speed: 2.2, at: 0.8 }, { who: 'lenz', walk: [[126, 117], [127, 111]], speed: 2.0, at: 1.2 }, { who: 'orlan', walk: [[129, 117], [131, 110]], speed: 2.0, at: 1.6 }],
      say: { who: 'falk', text: 'Verstanden. Raus aus dem Graben.', expr: 'entschlossen' }, dur: 4.5, fadeOut: 1.0 },
  ],
};

const CUT_OUTRO = {
  groundRel: true,
  location: ['Kapellenruine', '07:41 Uhr'],
  cast: {
    brandt: actor('brandt', { pos: [124.0, 6.8], yaw: 2.4, aim: -0.9 }),
    daren: actor('daren', { pos: [122.2, 5.0], yaw: -0.8, aim: -1.0 }),
    lenz: actor('lenz', { pos: [126.6, 4.6], yaw: 1.2, aim: -0.6 }),
    falk: actor('falk', { pos: [125.6, 8.4], yaw: 3.1, aim: -0.6 }),
    weber: actor('weber', { pos: [127.6, 7.2], yaw: 1.7, crouch: true, aim: -0.7 }),
    hofer: actor('hofer', { pos: [121.0, 8.6], yaw: -2.2, crouch: true, aim: -0.8 }),
  },
  beats: [
    { cam: { orbit: [125, 3, -6], radius: 26, height: 8, from: 2.4, to: 3.1 }, dur: 6, fadeIn: 1.2,
      say: { who: 'funk', text: 'Anker an alle: Kessars Verbände ziehen sich auf breiter Front zurück. Die Linie hält.' } },
    { cam: { close: 'hofer', side: 0.4, dist: 0.9 },
      say: { who: 'hofer', text: 'Alle Verwundeten sind versorgt. Drei von ihnen tragen die Uniform des Ostbunds. Sie werden es schaffen.', expr: 'erleichtert' } },
    { cam: { close: 'daren', side: -0.35, dist: 0.9, push: 0.1 },
      say: { who: 'daren', text: 'Meine Leute haben heute gegen Männer gekämpft, mit denen sie gestern noch gegessen haben. Das vergessen sie nicht.', expr: 'traurig' } },
    { cam: { close: 'brandt', side: 0.35, dist: 0.9 },
      say: { who: 'brandt', text: 'Sie haben es getan, damit andere morgen nicht kämpfen müssen. Auch das wird man nicht vergessen.', expr: 'ernst' } },
    { cam: { close: 'weber', side: -0.4, dist: 0.95, push: 0.1 },
      say: { who: 'weber', text: 'Herr Hauptmann – Kessar sendet. Auf allen Frequenzen gleichzeitig.', expr: 'angespannt' } },
    { cam: { over: ['falk', 'weber'] },
      say: { who: 'kessar', text: 'Soldaten des Ostbunds. Eure Offiziere haben euch an den Feind verkauft. Ich werde euch die Wahrheit selbst senden – bald, und überall.' } },
    { cam: { close: 'lenz', side: 0.35, dist: 0.85 },
      say: { who: 'lenz', text: 'Er gibt nicht auf. Er sucht sich nur ein lauteres Mikrofon.', expr: 'nachdenklich' } },
    { cam: { close: 'brandt', side: -0.3, dist: 0.85, push: 0.12 },
      say: { who: 'brandt', text: 'Dann muss die Wahrheit vor ihm ankommen. Major Daren sagt heute Abend vor der Kommission aus. Falke – du bringst ihn hin.', expr: 'entschlossen' } },
    { cam: { from: [104, 7, 30], to: [100, 12, 40], look: [125, 2, -2] }, dur: 4.5, fadeOut: 1.4,
      say: { who: 'daren', text: 'Dann fahren wir. Bevor er es sich anders überlegt.', expr: 'entschlossen' } },
  ],
};

/** Verwundeter im Trichter (Figur ohne KI, geduckt) und Bergen: aufnehmen (halten) → zum Sanitätsposten bringen. */
function* rescue(m, w, i) {
  const fig = prop(m, { role: 'verwundet', name: 'Verwundeter', team: i % 2 ? 'B' : 'A', variant: i % 2 ? 'grenadier' : 'sturm', weapon: null, at: w.at, yaw: w.yaw, crouch: true, aim: -1.2 });
  m.say(i ? 'hofer' : 'lenz', i ? 'Noch einer, Falke – östlich der Ruine, im großen Trichter. Ein Ostbund-Soldat.' : 'Verwundeter im Trichter westlich der Ruine! Hol ihn rein, wir geben Deckung!', { radio: true });
  yield m.holdZone(w.id, i ? 'Birg den zweiten Verwundeten' : 'Birg den Verwundeten im Trichter', { at: w.at, r: 3, secs: 4, label: 'Verwundeter', action: 'Verwundeten aufnehmen' });
  if (fig) fig.remove();
  m.tip('Du trägst den Verwundeten – zurück zum Sanitätsposten.', 4);
  yield m.reach(`${w.id}s`, 'Bring ihn zum Sanitätsposten', { at: SAN, r: 4, label: 'Sanitäter' });
  m.say('hofer', i ? 'Ich habe ihn. Danke, Falke.' : 'Leg ihn hierher. Er atmet – gut gemacht.', { expr: 'erleichtert' });
  m.progress('verw', i + 1, 2);
}

export const MISSION_7 = {
  id: 'm7',
  number: 7,
  title: 'Niemandsland',
  short: 'Niemandsland',
  map: 'niemandsland',
  time: 'morgen',
  weather: 'morgennebel',
  type: 'Große Schlacht · Halten der Linie',
  summary: 'Kessar greift mit allem an, was ihm folgt. Nimm mit Nordkorps- und Ostbund-Soldaten die Kapellenruine, halte sie gegen seine Wellen, hol das Artillerie-Funkgerät zurück und birg die Verwundeten.',
  cutscenes: { intro: CUT_INTRO, outro: CUT_OUTRO },

  prepare(m) {
    const bots = m.allies([
      { role: 'lenz', name: 'Fw. Lenz', at: [125, 118] },
      { role: 'weber', name: 'OGefr. Weber', at: [122, 119] },
      { role: 'hofer', name: 'San. Hofer', at: [131, 119] },
      { role: 'orlan', name: 'Hptfw. Orlan', at: [134, 118] },
      { name: 'Gefr. Albrecht', at: [118, 119] },
      { name: 'Gefr. Kuhn', at: [138, 119] },
      { name: 'Sold. Basko', at: [141, 118] },
      { name: 'Sold. Terek', at: [114, 119] },
      { name: 'Sold. Marn', at: [145, 119] },
    ]);
    // Ostbund-Soldaten (Darens Brigade) in ihrer eigenen Uniform
    for (const b of bots) if (/Orlan|Sold\./.test(b.name || '')) ostbund(m, b);
    m.zone('kapelle', { at: CHAPEL, r: 15 });
    m.order('follow');
    purgeDead(m);
    // Massenschlacht: Nebengefechte links und rechts (laufend aufgefüllt; Handy: halbe Stärke)
    m.set('fern', [
      squad(m, 'dorf', { a: { n: 8, at: [[-120, 30], [-130, 24], [-110, 28]], kind: 'defend', point: [-120, 0], ostbund: true }, b: { n: 10, at: [[-130, -90], [-110, -96], [-150, -84]], attack: [-120, 0] }, every: 20 }),
      squad(m, 'mitte', { a: { n: 6, at: [[-10, 60], [10, 62], [0, 70]], kind: 'defend', point: [0, 30] }, b: { n: 8, at: [[-20, -90], [20, -94], [0, -100]], attack: [0, 20] }, every: 22 }),
    ]);
    m.on('vehicle:destroyed', () => {});
  },

  stages: [
    {
      id: 'start',
      checkpoint: { at: [126, 120], yaw: 0 },
      *run(m) {
        yield m.cutsceneAt('intro');
        m.order('attack', CHAPEL);
        m.tip('Granattrichter geben Deckung. Geduckt laufen, im Trichter verschnaufen.', 6);
        m.say('lenz', 'Von Trichter zu Trichter! Nicht stehen bleiben im Draht!', { expr: 'angespannt' });
        m.wave('k0', { count: 6, at: [[121, -10], [129, -2], [125, -14], [119, 2], [131, -12], [126, 4]], hold: true });
        m.wave('mg', { count: 2, at: [[100, -30], [150, -28]], hold: true });
        yield m.reach('anlauf', 'Arbeite dich zur Kapellenruine vor', { at: [125, 30], r: 12, label: 'Kapellenruine' });
        m.say('orlan', 'Sie sitzen in der Ruine! Wir gehen links herum!', { expr: 'angespannt' });
        yield m.killObjective('k0', 'Nimm die Kapellenruine', ['k0', 'mg']);
        m.say('lenz', 'Ruine ist unser. Alle in die Mauern – sie kommen gleich zurück.');
        yield 1.5;
      },
    },
    {
      id: 'halten',
      checkpoint: { at: [125, 6], yaw: 0 },
      setup(m) { m.order('defend', CHAPEL); },
      *run(m) {
        m.clearObjectives();
        m.order('defend', CHAPEL);
        m.objective('halten', 'Halte die Kapellenruine', { pos: CHAPEL, label: 'Kapellenruine', progress: 1 });
        guardZone(m, 'kapelle', { secs: 18, bar: 'halten', warn: ['lenz', 'Sie sind in der Ruine! Zurück in die Mauern!'], fail: 'Die Kapellenruine ist gefallen – die Linie bricht.' });
        m.tip('Befehlsrad (Z bzw. Touch-Knopf): „Verteidigen“ auf eine Mauerlücke legt deine Leute dorthin.', 6);
        yield 4;
        m.wave('h1', { count: 10, at: NORTH, attack: 'kapelle', radius: 10 });
        m.say('weber', 'Erste Welle aus dem Norden! Ich zähle zehn, zwölf – mehr!', { expr: 'angespannt' });
        yield m.timer(60, 'Nächste Welle');
        m.wave('h2a', { count: 7, at: WEST, attack: 'kapelle', radius: 10 });
        m.wave('h2b', { count: 6, at: NORTH, attack: 'kapelle', radius: 10 });
        m.say('orlan', 'Westflanke! Sie kommen durch die Trichter links von uns!', { expr: 'angespannt' });
        yield 5;
        m.say('feind', 'Dritte Grenzbrigade, kehrt in eure Stellungen zurück. Oberst Kessar vergibt euch noch.', { radio: true });
        yield 5;
        m.say('daren', 'Hört nicht hin. Wer heute hier steht, steht für seine Familie zu Hause, nicht für Kessar.', { radio: true, expr: 'entschlossen' });
        yield m.timer(65, 'Nächste Welle');
        m.wave('h3a', { count: 9, at: NORTH, attack: 'kapelle', radius: 9 });
        m.wave('h3b', { count: 7, at: EAST, attack: 'kapelle', radius: 9 });
        m.say('lenz', 'Von zwei Seiten! Jeder hält seinen Abschnitt – keiner weicht!', { expr: 'angespannt' });
        yield m.timer(70, 'Halten');
        const rest = ['h1', 'h2a', 'h2b', 'h3a', 'h3b'];
        yield m.killObjective('rest', 'Schlage den Angriff zurück', rest);
        m.done('halten');
        stopGuard(m, 'kapelle');
        m.say('brandt', 'Gut gehalten. Ihre Infanterie ist erschöpft – jetzt brauchen wir das Funkgerät, bevor die Panzer kommen.', { radio: true });
        yield 2;
      },
    },
    {
      id: 'funk',
      checkpoint: { at: [118, 6], yaw: 1.4 },
      setup(m) { m.order('follow'); },
      *run(m) {
        m.clearObjectives();
        m.order('follow');
        m.say('weber', 'Das Gerät liegt im Unterstand am Panzerwrack. Westlich, gut hundert Meter. Ich komme mit.');
        m.wave('beob', { count: 7, at: [[-6, 8], [10, 4], [0, -8], [14, 18], [-12, 20], [6, -2], [-4, 26]], hold: true });
        yield m.reach('wrack', 'Erreiche das Panzerwrack', { at: [24, 12], r: 10, label: 'Panzerwrack' });
        m.say('lenz', 'Kessars Leute halten das Wrack! Weber, bleib hinter mir!', { expr: 'angespannt' });
        yield m.killObjective('beob', 'Säubere den Beobachtungsposten', 'beob');
        m.say('weber', 'Hier ist es. Die Antenne ist abgerissen – gib mir einen Moment.');
        yield m.holdZone('geraet', 'Setze das Artillerie-Funkgerät instand', { at: WRECK, r: 4, secs: 8, label: 'Funkgerät', action: 'Funkgerät wird instand gesetzt' });
        m.say('funk', 'Anker hört euch. Was braucht ihr?');
        yield 1;
      },
    },
    {
      id: 'schlag',
      checkpoint: { at: [10, 20], yaw: 0 },
      setup(m) { m.order('hold'); },
      *run(m) {
        m.clearObjectives();
        m.order('hold');
        const tanks = [
          m.scriptTank('p1', { at: [40, -175], yaw: 0.3, route: [[60, -110], [90, -60]], range: 150, fireEvery: 9 }),
          m.scriptTank('p2', { at: [70, -185], yaw: 0.2, route: [[80, -120], [110, -70]], range: 150, fireEvery: 10 }),
          m.scriptTank('p3', { at: [10, -180], yaw: 0.4, route: [[40, -115], [70, -70]], range: 150, fireEvery: 11 }),
        ].filter(Boolean);
        m.set('kolonne', tanks);
        m.say('weber', 'Panzer! Drei Stück, aus der Nordstellung, Richtung Kapelle!', { expr: 'angespannt' });
        yield 3;
        m.say('funk', 'Anker hier. Zwei Jäger sind in der Luft. Markiert uns die Kolonne, dann schlagen sie zu.', { radio: true });
        m.tip('Bleib am Beobachtungspunkt und halte die Kolonne im Blick, bis die Zielmeldung durch ist.', 6);
        yield m.holdZone('markieren', 'Markiere die Panzerkolonne für den Präzisionsschlag', { at: OP, r: 4, secs: 10, label: 'Beobachtungspunkt', action: 'Zielkoordinaten werden übermittelt' });
        m.say('weber', 'Koordinaten raus. Jäger im Anflug – Köpfe runter!', { expr: 'angespannt' });
        const alive = (s) => !!(s && s.v && s.v.alive && !s.v.wreck);
        let struck = false;
        const hit = () => {
          if (struck) return;
          struck = true;
          const pts = [];
          for (const s of tanks) if (alive(s)) { const p = s.v.position; pts.push([p.x, p.z], [p.x + 6, p.z - 4], [p.x - 5, p.z + 5]); }
          if (pts.length) strike(m, pts, { every: 0.35, radius: 9, damage: 300, vehicles: tanks.map((s) => s.v) });
        };
        const j1 = jetPass(m, [-260, 140, 120], [260, 140, -260], { speed: 160, overAt: [60, -100], onOver: hit });
        jetPass(m, [-280, 160, 150], [240, 160, -280], { speed: 160 });
        // Rückfall: Schlag kommt spätestens nach 14 s (Jet abgelenkt, zu langsam auf schwachen Geräten)
        let t = 0;
        m.every((dt) => { t += dt; if (t > 14) { hit(); return true; } return struck; });
        m.objective('kolonne', 'Präzisionsschlag auf die Panzerkolonne', { pos: () => { const s = tanks.find(alive); return s ? s.v.position : null; }, label: 'Panzer', total: tanks.length });
        yield m.until(() => { const n = tanks.filter((s) => !alive(s)).length; m.progress('kolonne', n, tanks.length); return n >= tanks.length || (struck && t > 22); });
        // Überlebende (Rückfall) zerstört der zweite Anflug
        for (const s of tanks) if (alive(s)) { try { s.v.destroy(m.G.player, 'bomb_250'); } catch { /* */ } }
        m.done('kolonne');
        void j1;
        m.say('funk', 'Treffer bestätigt. Die Kolonne brennt. Gute Arbeit, Eisen-Zug.', { radio: true });
        yield 2;
        m.say('lenz', 'Zurück zur Kapelle. Da draußen liegen noch Verwundete.');
        yield 1;
      },
    },
    {
      id: 'bergen',
      checkpoint: { at: [120, 10], yaw: 0 },
      setup(m) { m.order('defend', CHAPEL); },
      *run(m) {
        m.clearObjectives();
        m.order('defend', CHAPEL);
        yield m.reach('zurueck', 'Kehre zur Kapellenruine zurück', { at: CHAPEL, r: 12, label: 'Kapellenruine' });
        m.objective('verw', 'Verwundete geborgen', { total: 2, quiet: true });
        m.progress('verw', 0, 2);
        m.wave('g1', { count: 8, at: NORTH, attack: 'kapelle', radius: 10 });
        m.say('hofer', 'Ich brauche jeden, der tragen kann. Ich bleibe hier am Posten.', { expr: 'ernst' });
        for (let i = 0; i < WOUNDED.length; i++) {
          yield* rescue(m, WOUNDED[i], i);
          if (i === 0) { m.wave('g2', { count: 6, at: EAST, attack: 'kapelle', radius: 10 }); m.say('orlan', 'Sie versuchen es noch einmal! Von Osten!', { expr: 'angespannt' }); }
        }
        m.done('verw');
        yield m.killObjective('g', 'Schlage den letzten Angriff zurück', ['g1', 'g2']);
        const fern = m.get('fern') || [];
        for (const s of fern) s.stop();
        m.say('funk', 'Anker an alle: Die Brigade Kessar weicht zurück. Ich wiederhole: Sie weichen zurück!');
        yield 3;
        m.complete();
      },
    },
  ],
};
