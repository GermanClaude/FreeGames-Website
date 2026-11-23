// NULLPUNKT — Kampagne, Mission 3 „Eiserner Fluss“ (Grenzland): Fahrzeug und Feuerunterstützung.
// Falk fährt den Kampfpanzer „Eisen 2“ die Landstraße hinab, deckt die Infanterie von Lenz beim Vorstoß ins Dorf,
// schaltet die feindlichen Panzer an der Flussbrücke aus und hält die Brücke, bis die Pioniere Kessars Sprengladungen
// entfernt haben. Checkpoints: start, dorf, bruecke.

import { actor } from './cast.js?v=20261123082814';
import { arm } from './hilfen-c.js?v=20261123082814';

// kamp3 (15.11.): vertieft – Panzerabwehrtrupps am Ortsrand (Raketenwerfer gegen Eisen 2) und ein Gegenstoß über die
// Brücke mit zwei Geländewagen, nachdem die Pioniere fertig sind.
const AT_TEAMS = [[-30, 94], [-48, 72], [24, 95]];

const TANK_AT = [13.5, 121];
const TANK_YAW = 0.12; // Blick die Straße hinunter (Süden, −Z)
const VILLAGE = [[-26, 58], [18, 63], [-8, 41], [-30, 94], [24, 95], [35, 41], [-14, 82]];
const BRIDGE = [40, -30];

const CUT_INTRO = {
  groundRel: true, // Kamerahöhen über dem Gelände (Hügel)
  location: ['Grenzland · Bereitstellungsraum Nord', '04:47 Uhr'],
  cast: {
    roth: actor('roth', { pos: [10.4, 124.8], yaw: -1.2, aim: -0.7 }),
    falk: actor('falk', { pos: [8.2, 126.2], yaw: 2.0, aim: -0.6 }),
    lenz: actor('lenz', { pos: [7.6, 123.8], yaw: 1.4, aim: -0.6 }),
  },
  beats: [
    { cam: { path: [[70, 46, 190], [46, 34, 160], [26, 22, 138]], look: [22, 2, 70], lookTo: [40, 2, -30] }, dur: 8, fadeIn: 1.6,
      say: { who: 'funk', text: 'Anker an Eisen-Zug: Aufklärung meldet feindliche Pioniere an der Flussbrücke. Dazu mindestens zwei Kampfpanzer.' } },
    { cam: { from: [2.5, 2.4, 131], to: [3.5, 2.6, 129.5], look: [11, 1.6, 123] },
      say: { who: 'roth', text: 'Eisen 1 hat einen Kettenschaden, der fährt heute nicht mehr. Also fährst du Eisen 2, Falke. Ich führe vom Funkgerät aus.' } },
    { cam: { close: 'falk', side: 0.4, dist: 0.95 },
      say: { who: 'falk', text: 'Ich saß seit der Ausbildung nicht mehr im Turm.', expr: 'nachdenklich' } },
    { cam: { close: 'roth', side: -0.35, dist: 0.85, push: 0.1 },
      say: { who: 'roth', text: 'Dann merk dir drei Dinge: Panzergranate gegen Panzer. Sprenggranate gegen Stellungen. Und nie stehen bleiben, wenn einer auf dich zielt.', expr: 'entschlossen' } },
    { cam: { over: ['falk', 'lenz'] },
      say: { who: 'lenz', text: 'Wir gehen mit der Infanterie durchs Dorf vor. Halte uns die Häuser vom Hals.' } },
    { cam: { from: [20, 5, 112], to: [22, 4, 116], look: [12, 1.5, 123] },
      say: { who: 'brandt', text: 'Die Brücke muss stehen bleiben. Ohne sie kommt keine Hilfe mehr ins Tal.' } },
    { cam: { close: 'roth', side: 0.3, dist: 1.0 },
      act: [{ who: 'falk', walk: [[11, 122.5]], speed: 1.6, at: 1.0 }],
      say: { who: 'roth', text: 'Aufsitzen!', expr: 'angespannt' }, dur: 2.6, fadeOut: 0.9 },
  ],
};

const CUT_OUTRO = {
  groundRel: true,
  location: ['Flussbrücke', '06:12 Uhr'],
  cast: {
    falk: actor('falk', { pos: [32.6, -7.5], yaw: -2.6, aim: -0.6 }),
    lenz: actor('lenz', { pos: [34.8, -6.8], yaw: -2.8, aim: -0.4 }),
    brandt: actor('brandt', { pos: [31.0, -9.2], yaw: -2.4, aim: -0.9 }),
    daren: actor('daren', { pos: [40.5, -27.5], yaw: 0.4, aim: -1.1, top: true }),
  },
  beats: [
    { cam: { from: [18, 9, 4], to: [22, 7, 0], look: [40, 1, -26] }, dur: 5, fadeIn: 1,
      say: { who: 'funk', text: 'Pioniere melden: Alle Sprengladungen an der Brücke entfernt. Die Straße ins Tal ist offen.' } },
    { cam: { over: ['lenz', 'daren'], dist: 1.4 },
      act: [{ who: 'daren', walk: [[37.5, -19], [34.4, -11.6]], speed: 1.1 }],
      say: { who: 'lenz', text: 'Bewegung auf der Südseite. Ein Mann, allein. Er hat die Hände oben.', expr: 'angespannt' } },
    { cam: { close: 'daren', side: 0.4, dist: 1.1, push: 0.15 },
      say: { who: 'daren', text: 'Nicht schießen. Ich bin Major Daren.', expr: 'ernst' } },
    { cam: { close: 'brandt', side: -0.35, dist: 0.9 },
      act: [{ who: 'daren', face: 'brandt' }],
      say: { who: 'brandt', text: 'Sie haben uns gewarnt, Major. Warum?', expr: 'fragend' } },
    { cam: { close: 'daren', side: -0.4, dist: 0.85, push: 0.1 },
      say: { who: 'daren', text: 'Kessar ist nicht der Ostbund. Er will einen Krieg, den keiner von uns will. Hier – seine Befehle, mit seiner Unterschrift.', expr: 'ernst' } },
    { cam: { close: 'lenz', side: 0.35, dist: 0.9 },
      say: { who: 'lenz', text: 'Und warum sollten wir Ihnen trauen?', expr: 'fragend' } },
    { cam: { over: ['brandt', 'daren'] },
      say: { who: 'daren', text: 'Weil ich meine Leute nach Hause bringen will. Genau wie Sie.', expr: 'traurig' } },
    { cam: { from: [26, 3, -2], to: [24, 6, 2], look: [33.5, 1.5, -10] },
      say: { who: 'brandt', text: 'Dann fangen wir damit an. Gemeinsam.', expr: 'entschlossen' }, dur: 4.5, fadeOut: 1.4 },
    { cam: { from: [24, 6, 2], look: [33.5, 1.5, -10] }, card: ['Kampagne · Stille Grenze', 'Als Nächstes', 'Mission 4 · Hafennacht'], dur: 4.5 },
  ],
};

export const MISSION_3 = {
  id: 'm3',
  number: 3,
  title: 'Eiserner Fluss',
  short: 'Eiserner Fluss',
  map: 'grenzland',
  time: 'morgen',
  weather: 'dunst',
  type: 'Fahrzeug · Feuerunterstützung',
  summary: 'Kessar will die Brücke am Grenzfluss sprengen. Fahr den Kampfpanzer „Eisen 2“, decke die Infanterie im Dorf und halte die Brücke für die Pioniere.',
  loadoutHint: 'Einsteigen: F (Gamepad X, Touch: Knopf am Fahrzeug).',
  mapVehicles: false, // Runde 2: Kartenfahrzeuge (u. a. Hubschrauber mit KI-Pilot) räumen – die Mission stellt ihre eigenen
  act: 1,
  cutscenes: { intro: CUT_INTRO, outro: CUT_OUTRO },

  prepare(m, { resumed }) {
    // Wiedereinstieg am Checkpoint: Panzer steht dort bereit (sonst am Bereitstellungsraum)
    const sp = resumed && m.spawnPoint ? m.spawnPoint.position : null;
    const tank = m.vehicle('tank', sp ? [sp.x + 3.5, sp.z - 2] : TANK_AT, TANK_YAW, 'A');
    m.set('tank', tank);
    m.allies([
      { role: 'lenz', name: 'Fw. Lenz', at: [6, 126] },
      { role: 'weber', name: 'OGefr. Weber', at: [4.5, 127.5] },
      { name: 'Gefr. Albrecht', at: [5, 124] },
      { name: 'Gefr. Kuhn', at: [3, 125.5] },
    ]);
    m.order('follow');
    // Wiedereinstieg: direkt im Panzer
    if (resumed && tank) {
      m.G.player.respawnAt = null;
      setTimeout(() => { try { if (tank.alive && !m.G.player.vehicle) m.G.vehicles.enter(m.G.player, tank); } catch { /* */ } }, 50);
    }
    m.on('vehicle:destroyed', (e) => {
      if (e && e.vehicle && e.vehicle === m.get('tank')) m.fail('Eisen 2 wurde zerstört.');
    });
  },

  stages: [
    {
      id: 'start',
      checkpoint: { at: [9, 127], yaw: 2.8 },
      *run(m) {
        yield m.cutsceneAt('intro');
        const tank = m.get('tank');
        m.objective('aufsitzen', 'Steig in den Kampfpanzer „Eisen 2“', { pos: () => (tank ? tank.position : null), label: 'Eisen 2' });
        m.tip('Einsteigen: F · Gamepad X · Touch: Knopf „Einsteigen“', 6);
        yield () => !!(m.G.player.vehicle && m.G.player.vehicle === tank);
        m.done('aufsitzen');
        m.say('roth', 'Gut. Motor läuft. Die Kanone ist geladen. Folge der Straße nach Süden.', { radio: true });
        yield 2;
      },
    },
    {
      id: 'dorf',
      checkpoint: { at: [9, 118], yaw: 0 },
      setup(m) { m.order('attack', [-6, 74]); },
      *run(m) {
        m.clearObjectives();
        m.order('attack', [-6, 74]);
        yield m.reach('dorfrand', 'Unterstütze den Vorstoß ins Dorf', { at: [4, 92], r: 16, label: 'Dorf' });
        m.wave('dorf', { count: 6, at: VILLAGE, hold: true });
        const jeep = m.scriptTank('jeep', { type: 'jeep', at: [35, 46], yaw: -0.6, route: [[22, 58], [8, 66]], range: 80, fireEvery: 2.5 });
        m.say('lenz', 'Feuer aus den Häusern! Falke, Sprenggranaten auf die Fenster – wir rücken nach!', { expr: 'angespannt' });
        m.objective('jeep', 'Zerstöre den Geländewagen', { pos: () => (jeep && jeep.v && jeep.v.alive ? jeep.v.position : null), label: 'Geländewagen', total: null });
        const jeepDone = m.until(() => !jeep || !jeep.v || !jeep.v.alive || jeep.v.wreck || !(jeep.bot && jeep.bot.alive));
        const village = m.killObjective('dorf', 'Säubere das Dorf', 'dorf');
        yield jeepDone;
        m.done('jeep');
        yield village;
        m.say('lenz', 'Dorf ist sauber. Ein paar Leute im Keller der Kapelle – denen geht es gut.');
        yield 1.5;
        // Panzerabwehrtrupps in den Gehöften am Ortsrand
        m.wave('pak', { count: 3, scale: false, at: AT_TEAMS, hold: true });
        for (const b of m.waves.get('pak').bots) arm(b, 'at_donner');
        m.say('roth', 'Achtung, Falke: Raketenwerfer! Drei Trupps in den Häusern am Ortsrand. Bleib in Bewegung und zeig ihnen nie die Seite.', { radio: true, expr: 'angespannt' });
        m.tip('Sprenggranate gegen Häuser und Deckung, MG gegen Infanterie im Freien.', 5);
        yield m.killObjective('pakk', 'Schalte die Panzerabwehrtrupps am Ortsrand aus', 'pak');
        m.say('lenz', 'Danke. Ohne dich hätten sie Eisen 2 von der Straße geholt.', { radio: true });
        yield 1;
      },
    },
    {
      id: 'bruecke',
      checkpoint: { at: [6, 70], yaw: 0 },
      setup(m) { m.order('follow'); },
      *run(m) {
        m.clearObjectives();
        m.order('follow');
        m.say('roth', 'Weiter zur Brücke. Bleib auf der Straße, auf den Feldern ist der Boden weich.', { radio: true });
        yield m.reach('anfahrt', 'Rücke zur Brücke vor', { at: [26, 4], r: 16, label: 'Brücke' });
        const t1 = m.scriptTank('t1', { at: [62, -78], yaw: 0.6, route: [[50, -48]], range: 140, fireEvery: 7 });
        const t2 = m.scriptTank('t2', { at: [24, -78], yaw: -0.4, route: [[34, -50]], range: 140, fireEvery: 8 });
        m.wave('wache', { count: 4, at: [[44, -44], [52, -40], [32, -42], [40, -52]], hold: true });
        m.say('roth', 'Zwei Panzer jenseits der Brücke! Panzergranate laden – und in Bewegung bleiben!', { expr: 'angespannt', radio: true });
        const alive = (s) => !!(s && s.v && s.v.alive && !s.v.wreck && s.bot && s.bot.alive);
        m.objective('panzer', 'Schalte die feindlichen Panzer aus', { pos: () => { const s = [t1, t2].find(alive); return s ? s.v.position : null; }, label: 'Panzer', total: 2 });
        yield m.until(() => { const n = [t1, t2].filter((s) => !alive(s)).length; m.progress('panzer', n, 2); return n >= 2; });
        m.done('panzer');
        m.order('attack', BRIDGE);
        m.say('lenz', 'Pioniere vor! Falke, deck sie auf der Brücke.');
        yield m.holdZone('sichern', 'Sichere die Brücke für die Pioniere', { at: BRIDGE, r: 14, secs: 20, label: 'Brücke', action: 'Pioniere arbeiten' });
        yield m.killObjective('wache', 'Schalte die Brückenwache aus', 'wache');
        // Gegenstoß: zwei Geländewagen und Infanterie von der Werkstraße
        m.say('roth', 'Staub auf der Werkstraße. Zwei Geländewagen mit schweren MGs – sie wollen die Pioniere von der Brücke holen!', { radio: true, expr: 'angespannt' });
        const j1 = m.scriptTank('gj1', { type: 'jeep', at: [62, -78], yaw: 0.6, route: [[52, -52], [44, -40]], range: 90, fireEvery: 2.5 });
        const j2 = m.scriptTank('gj2', { type: 'jeep', at: [24, -78], yaw: -0.4, route: [[32, -54], [38, -42]], range: 90, fireEvery: 2.5 });
        m.wave('gs', { count: 4, at: [[44, -60], [56, -64], [30, -62], [40, -70]], attack: BRIDGE, radius: 10 });
        const ok = (s2) => !!(s2 && s2.v && s2.v.alive && !s2.v.wreck && s2.bot && s2.bot.alive);
        m.objective('gj', 'Wehre den Gegenstoß an der Brücke ab', { pos: () => { const x = [j1, j2].find(ok); return x ? x.v.position : null; }, label: 'Geländewagen', total: 2 });
        yield m.until(() => { const n = [j1, j2].filter((x) => !ok(x)).length; m.progress('gj', n, 2); return n >= 2; });
        m.done('gj');
        yield m.killObjective('gsk', 'Schalte die Infanterie am Südufer aus', 'gs');
        yield 1.5;
        m.complete();
      },
    },
  ],

  /** Testlauf (run.js): in den Panzer setzen. */
  _test(d) {
    const t = d.get('tank'), G = d.G;
    if (t && t.alive && G.player.alive && G.player.vehicle !== t && d.objs.some((o) => o.id === 'aufsitzen' && !o.done)) { try { G.vehicles.enter(G.player, t); } catch { /* */ } }
  },
};

