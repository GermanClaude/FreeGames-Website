// NULLPUNKT — Kampagne, Mission 14 „Grabenlinie“ (Niemandsland, Abend): Verteidigung mit Bauen und Graben.
// Haas lässt den Grenzvertrag in der Kapellenruine unterschreiben. Bis die Delegationen eingetroffen sind, bleibt wenig
// Zeit: Falk hebt mit dem Klappspaten Schützenlöcher aus (Gelände-Höhenfeld, digging.js) und baut Sandsackwälle bzw.
// Schützenlöcher (Taste „Bauen“, building.js). Dann hält der Trupp die Ruine gegen die Graue Kompanie, schaltet ihren
// Mörsertrupp im Trichterfeld aus und stößt mit Leutnant Roths Panzer „Eisen 1“ (KI, Nebenelement) gegen ihre Fahrzeuge
// vor. Am Ende wird Jaro Vahl verwundet gestellt und nennt Seyfried – Hagenmoor.
// Checkpoints: start, bauen, welle, moerser, gegenstoss, vahl. Fehlschlag: Ruine fällt (Feinde ohne Verteidiger), die
// Delegierten werden getroffen, Vahl fällt.

import { actor } from './cast.js?v=20261123073102';
import { guardZone, stopGuard, purgeDead, prop, allyTank, giveLauncher, clearAir } from './hilfen-b.js?v=20261123073102';
import { buildCount, digCount, giveMelee } from './hilfen-c.js?v=20261123073102';

const CHAPEL = [125, -6];
const INSIDE = [124, 8];                 // Delegierte (Sanitätsposten in der Ruine, M7)
const FRONT = [125, -24];                // Vorfeld nördlich der Ruine: hier wird gegraben
const NORTH = [[95, -92], [125, -98], [155, -92], [110, -80], [140, -82], [80, -84], [170, -86]];
const WEST = [[62, -48], [56, -20], [70, -70], [50, -36]];
const EAST = [[192, -40], [196, -12], [186, -62], [200, -28]];
const MORTAR = [[136, -104], [142, -100], [132, -108]];
const VAHL = [104, -88];
const TANK_AT = [128, 70];

const CUT_INTRO = {
  groundRel: true,
  location: ['Niemandsland · Kapellenruine', '18:12 Uhr · Tag 27'],
  cast: {
    haas: actor('haas', { pos: [INSIDE[0] + 1.2, INSIDE[1] - 0.6], yaw: 0.4, aim: -1.0 }),
    lenz: actor('lenz', { pos: [INSIDE[0] - 1.4, INSIDE[1] - 1.8], yaw: 2.6, aim: -0.8 }),
    falk: actor('falk', { pos: [INSIDE[0] - 0.2, INSIDE[1] - 3.2], yaw: 3.0, aim: -0.6 }),
    weber: actor('weber', { pos: [INSIDE[0] + 2.6, INSIDE[1] - 2.4], yaw: -2.6, crouch: true, aim: -0.7 }),
    daren: actor('daren', { pos: [INSIDE[0] + 2.4, INSIDE[1] + 0.8], yaw: -1.2, aim: -1.0 }),
  },
  beats: [
    { cam: { from: [CHAPEL[0] - 40, 24, CHAPEL[1] + 50], to: [CHAPEL[0] - 16, 10, CHAPEL[1] + 22], look: [CHAPEL[0], 2, CHAPEL[1]], ease: 'inOut' }, dur: 7, fadeIn: 1.6,
      say: { who: 'funk', text: 'Anker an Kapelle: Die Delegationen sind unterwegs. Ankunft in etwa zwanzig Minuten. Bewegung im Trichterfeld nördlich von euch.' } },
    { cam: { close: 'haas', side: 0.4, dist: 0.95, push: 0.1 },
      say: { who: 'haas', text: 'Hier haben vor hundert Jahren Männer auf beiden Seiten in Gräben gelegen. Wenn wir hier unterschreiben, versteht jeder, worum es geht.', expr: 'ernst' } },
    { cam: { close: 'daren', side: -0.35, dist: 0.9 },
      say: { who: 'daren', text: 'Meine Brigade hält die Straße nach Osten. Aber die Graue Kompanie kommt nicht über Straßen. Sie kommt durch die Trichter.', expr: 'nachdenklich' } },
    { cam: { close: 'lenz', side: 0.35, dist: 0.9 },
      say: { who: 'lenz', text: 'Dann machen wir es wie die vor hundert Jahren. Wir graben. Falke, Spaten, Sandsäcke, alles, was Deckung gibt – vor der Nordmauer.', expr: 'entschlossen' } },
    { cam: { close: 'falk', side: -0.3, dist: 0.85, push: 0.1 },
      say: { who: 'falk', text: 'Wie lange haben wir?', expr: 'ernst' } },
    { cam: { close: 'weber', side: 0.4, dist: 0.95 },
      say: { who: 'weber', text: 'Wenn Vahl so pünktlich ist wie seine Sendungen: knapp drei Minuten.', expr: 'angespannt' } },
    { cam: { from: [CHAPEL[0] + 6, 3, CHAPEL[1] - 12], to: [CHAPEL[0] + 2, 5, CHAPEL[1] - 18], look: [FRONT[0], 0.5, FRONT[1] - 10] }, dur: 4, fadeOut: 1.2,
      say: { who: 'haas', text: 'Dann graben Sie, Unteroffizier. Ich bleibe hier. Wer unterschreiben will, muss auch stehen bleiben können.', expr: 'entschlossen' } },
  ],
};

const CUT_OUTRO = {
  groundRel: true,
  location: ['Niemandsland · Trichterfeld', '19:04 Uhr'],
  cast: {
    vahl: actor('vahl', { pos: [VAHL[0], VAHL[1]], yaw: 2.6, crouch: true, aim: -1.2 }),
    falk: actor('falk', { pos: [VAHL[0] + 1.6, VAHL[1] + 1.8], yaw: -2.4, aim: -0.6 }),
    lenz: actor('lenz', { pos: [VAHL[0] - 1.2, VAHL[1] + 2.4], yaw: 2.8, aim: -0.8 }),
    hofer: actor('hofer', { pos: [VAHL[0] - 0.8, VAHL[1] - 0.6], yaw: 1.2, crouch: true, aim: -0.9 }),
    haas: actor('haas', { pos: [INSIDE[0], INSIDE[1]], yaw: 0.2, aim: -1.0 }),
    daren: actor('daren', { pos: [INSIDE[0] + 1.4, INSIDE[1] + 0.6], yaw: -0.6, aim: -1.0 }),
  },
  beats: [
    { cam: { from: [VAHL[0] + 18, 9, VAHL[1] + 16], to: [VAHL[0] + 8, 4, VAHL[1] + 8], look: [VAHL[0], 0.8, VAHL[1]] }, dur: 6, fadeIn: 1.2,
      say: { who: 'hofer', text: 'Durchschuss am Oberschenkel. Er wird es überleben. Halt still.', expr: 'ernst' } },
    { cam: { close: 'vahl', side: 0.4, dist: 0.85, push: 0.1 },
      say: { who: 'vahl', text: 'Ihr verschwendet Verbandszeug. Ich werde nichts sagen, was ihr nicht schon wisst.', expr: 'traurig' } },
    { cam: { close: 'falk', side: -0.35, dist: 0.9 },
      say: { who: 'falk', text: 'Du hast heute für jemanden gekämpft, der nicht einmal hergekommen ist. Wer bezahlt dich?', expr: 'ernst' } },
    { cam: { close: 'vahl', side: -0.4, dist: 0.85 },
      say: { who: 'vahl', text: 'Ein Mann, der an beide Seiten Granaten verkauft. Konrad Seyfried. Er sitzt in Hagenmoor und wartet auf seinen Abflug. Wenn ihr euch beeilt.', expr: 'nachdenklich' } },
    { cam: { close: 'lenz', side: 0.35, dist: 0.9 },
      say: { who: 'lenz', text: 'Seyfried. Der „Kranich“?', expr: 'fragend' } },
    { cam: { close: 'vahl', side: 0.3, dist: 0.85, push: 0.12 },
      say: { who: 'vahl', text: 'Einer davon. Kranich ist ein Zugvogel. Die fliegen nie allein.', expr: 'traurig' } },
    { cam: { from: [INSIDE[0] + 5, 2.2, INSIDE[1] - 5], to: [INSIDE[0] + 3.5, 2, INSIDE[1] - 3.5], look: [INSIDE[0], 1.3, INSIDE[1]] }, loc: false,
      say: { who: 'haas', text: 'Der Grenzvertrag ist unterschrieben. Von beiden Seiten. In einer Ruine, unter Beschuss, aber unterschrieben.', expr: 'erleichtert' } },
    { cam: { close: 'daren', side: -0.3, dist: 0.9 }, dur: 4.5, fadeOut: 1.4,
      say: { who: 'daren', text: 'Dann holt euch Seyfried. Bevor er wegfliegt und den nächsten Krieg bezahlt.', expr: 'entschlossen' } },
  ],
};

/** Mörserfeuer: Einschläge in der Nähe der Ruine, solange der Mörsertrupp lebt. */
function mortar(m, waveId) {
  const G = m.G;
  const pts = [[118, -18], [134, -22], [112, -6], [140, -8], [126, -30], [120, 2]];
  let t = 4, i = 0;
  m.every((dt) => {
    if (m.cleared(waveId) || m.state !== 'run') return true;
    t -= dt;
    if (t > 0) return false;
    t = 5 + Math.random() * 3;
    const p = m.vec(pts[i++ % pts.length]);
    p.x += (Math.random() - 0.5) * 8; p.z += (Math.random() - 0.5) * 8;
    const w = m.waves.get(waveId);
    const crew = w && w.bots.find((b) => b.alive);
    try { G.combat.explode({ position: p.setY(p.y + 0.3), radius: 6, maxDamage: 70, attacker: crew || null, weaponId: 'shell_he', type: 'shell_he', concuss: true }); } catch (err) { console.warn('[Kampagne] Mörser', err); }
    return false;
  });
}

function delegates(m) {
  const old = m.get('deleg') || [];
  for (const p of old) if (p) p.remove();
  const list = [
    prop(m, { role: 'haas', at: [INSIDE[0] + 1.2, INSIDE[1] - 0.6], yaw: 0.4, aim: -1.0, protect: true, failText: 'Kommissarin Haas wurde getroffen.' }),
    prop(m, { role: 'zivil', name: 'Delegierter', team: 'A', variant: 'zivil-hemd', weapon: null, at: [INSIDE[0] - 1.6, INSIDE[1] + 1.2], yaw: 0.2, crouch: true, aim: -1.1, protect: true, failText: 'Ein Delegierter wurde getroffen.' }),
    prop(m, { role: 'zivil', name: 'Delegierte', team: 'A', variant: 'zivil-strick', weapon: null, at: [INSIDE[0] + 3, INSIDE[1] + 1.6], yaw: -0.4, crouch: true, aim: -1.1, protect: true, failText: 'Eine Delegierte wurde getroffen.' }),
  ];
  m.set('deleg', list);
}

function hold(m) {
  guardZone(m, 'ruine', { secs: 14, bar: 'ruine', warn: ['lenz', 'Sie sind in der Ruine! Falke, zurück zur Kapelle!'], fail: 'Die Graue Kompanie hat die Kapellenruine gestürmt.' });
}

export const MISSION_14 = {
  id: 'm14',
  number: 14,
  act: 3,
  title: 'Grabenlinie',
  short: 'Grabenlinie',
  map: 'niemandsland',
  time: 'abend',
  weather: 'dunst',
  type: 'Verteidigung · Bauen und Graben',
  summary: 'Der Grenzvertrag wird in der Kapellenruine unterschrieben. Grab dich mit dem Klappspaten ein, bau Sandsackwälle und halte die Ruine gegen die Graue Kompanie, bis die Delegationen fertig sind.',
  loadoutHint: 'Graben: Klappspaten (Nahkampftaste) in den Erdboden. Bauen: Taste „Bauen“ (Standard K), Linksklick setzt.',
  loadout: { primary: 'ar_m17', secondary: 'pi_p9' },
  mapVehicles: false,
  cutscenes: { intro: CUT_INTRO, outro: CUT_OUTRO },

  prepare(m) {
    clearAir(m, { ground: true });
    purgeDead(m);
    giveMelee(m, 'spaten');
    m.zone('ruine', { at: CHAPEL, r: 16 });
    const sp = m.spawnPoint ? m.spawnPoint.position : m.vec(CHAPEL);
    m.allies([
      { role: 'lenz', name: 'Fw. Lenz', at: [sp.x - 2, sp.z + 1] },
      { role: 'weber', name: 'OGefr. Weber', at: [sp.x + 2, sp.z + 1] },
      { role: 'hofer', name: 'San. Hofer', at: [sp.x, sp.z + 2.5] },
      { name: 'Gefr. Albrecht', at: [sp.x - 3.5, sp.z + 1] },
      { name: 'Gefr. Kuhn', at: [sp.x + 3.5, sp.z + 1] },
    ]);
    m.order('defend', CHAPEL);
    if (m.startIndex <= 5) delegates(m);
  },

  stages: [
    {
      id: 'start',
      checkpoint: { at: [125, 2], yaw: 0 },
      *run(m) {
        yield m.cutsceneAt('intro');
        m.introduce('waffe', 'spaten', 'Klappspaten „Maulwurf“: Jeder Hieb in den Erdboden hebt Erde aus – Schützenloch, Graben, so tief du willst.');
        yield 0.5;
      },
    },
    {
      id: 'bauen',
      checkpoint: { at: [125, -14], yaw: 0 },
      setup(m) { giveMelee(m, 'spaten'); m.order('defend', CHAPEL); },
      *run(m) {
        m.clearObjectives();
        const digs = digCount(m, FRONT, 40);
        const builds = buildCount(m);
        const DIG = 8, BUILD = 2;
        m.objective('graben', 'Heb vor der Nordmauer ein Schützenloch aus (Klappspaten)', { pos: FRONT, label: 'Vorfeld', total: DIG });
        m.objective('bau', `Baue Deckung: Sandsackwall oder Schützenloch ${m.key('bauen', 'Bauen')}`, { total: BUILD });
        m.tip(`Graben: Klappspaten ziehen ${m.key('melee', 'Messer')} und auf den Boden schlagen. Bauen: ${m.key('bauen', 'Bauen')} öffnet die Vorschau, ${m.key('fire', 'Feuer')} setzt.`, 9);
        m.say('lenz', 'Ich nehme die Westmauer, Weber die Ostecke. Falke, das Vorfeld gehört dir. Tief genug, dass du liegend nicht gesehen wirst.', { expr: 'entschlossen' });
        let ready = false;
        const tm = m.timer(170, 'Angriff in', () => { ready = true; });
        void tm;
        let warned = false;
        yield () => {
          m.progress('graben', Math.min(DIG, digs()), DIG);
          m.progress('bau', Math.min(BUILD, builds()), BUILD);
          if (digs() >= DIG) m.done('graben');
          if (builds() >= BUILD) m.done('bau');
          if (!warned && m.timerLeft != null && m.timerLeft < 45) { warned = true; m.say('weber', 'Ich sehe sie. Mündungsfeuer im Trichterfeld. Noch eine Minute, vielleicht weniger.', { expr: 'angespannt' }); }
          if (digs() >= DIG && builds() >= BUILD && !ready) { m.stopTimer(); ready = true; m.say('lenz', 'Gut gemacht. Jetzt in die Löcher – und warten.', { expr: 'ernst' }); }
          return ready;
        };
        for (const id of ['graben', 'bau']) { const o = m.objs.find((x) => x.id === id); if (o && !o.done) { o.done = true; o.text += ' (nicht fertig geworden)'; } }
        yield 2;
      },
    },
    {
      id: 'welle',
      checkpoint: { at: [125, -10], yaw: 0 },
      setup(m) { giveMelee(m, 'spaten'); m.order('defend', CHAPEL); },
      *run(m) {
        m.clearObjectives();
        m.order('defend', CHAPEL);
        m.objective('ruine', 'Halte die Kapellenruine', { pos: CHAPEL, label: 'Ruine', progress: 1 });
        hold(m);
        m.say('grau', 'Gruppen eins bis drei: Ruine nehmen. Keine Gefangenen, keine Zeugen.', { radio: true });
        m.wave('w1', { count: 6, at: NORTH, attack: 'ruine', radius: 10 });
        yield 18;
        m.wave('w2', { count: 4, at: WEST, attack: 'ruine', radius: 10 });
        m.say('weber', 'Westflanke! Sie kommen durch die Trichter an der Dorfruine!', { expr: 'angespannt' });
        yield m.killObjective('wk', 'Wehre den ersten Angriff ab', ['w1', 'w2']);
        m.say('haas', 'Die Delegation des Ostbunds ist eben eingetroffen. Wir beginnen mit der Lesung.', { radio: true });
        yield 2;
      },
    },
    {
      id: 'moerser',
      checkpoint: { at: [125, -10], yaw: 0 },
      setup(m) { giveMelee(m, 'spaten'); m.order('defend', CHAPEL); },
      *run(m) {
        m.clearObjectives();
        m.order('defend', CHAPEL);
        m.objective('ruine', 'Halte die Kapellenruine', { pos: CHAPEL, label: 'Ruine', progress: 1, quiet: true });
        hold(m);
        m.wave('mortar', { count: 3, scale: false, at: MORTAR, hold: true });
        mortar(m, 'mortar');
        m.wave('m1', { count: 5, at: EAST, attack: 'ruine', radius: 10 });
        m.say('lenz', 'Mörser! Die Einschläge kommen näher – das ist kein Zufall, die haben einen Beobachter!', { expr: 'angespannt' });
        m.say('weber', 'Mörserstellung im großen Trichter, Nordnordost, etwa hundert Meter. Falke, wir halten hier – geh raus und mach sie still!', { expr: 'angespannt' });
        yield m.killObjective('mk', 'Schalte den Mörsertrupp im Trichterfeld aus', 'mortar', { pos: MORTAR[0], label: 'Mörser' });
        m.say('weber', 'Mörser schweigt!', { expr: 'erleichtert' });
        yield m.killObjective('m1k', 'Wehre den Angriff von Osten ab', 'm1');
        yield 1.5;
      },
    },
    {
      id: 'gegenstoss',
      checkpoint: { at: [125, -10], yaw: 0 },
      setup(m) { giveMelee(m, 'spaten'); m.order('defend', CHAPEL); },
      *run(m) {
        m.clearObjectives();
        giveLauncher(m, 'at_donner');
        m.objective('ruine', 'Halte die Kapellenruine', { pos: CHAPEL, label: 'Ruine', progress: 1, quiet: true });
        hold(m);
        const tank = allyTank(m, 'eisen1', { at: TANK_AT, yaw: 0, route: [[126, 30], [118, -40]], speed: 5, name: 'Lt. Roth', range: 140, fireEvery: 6 });
        m.set('tank', tank);
        m.say('roth', 'Eisen 1, komme von Süden. Ich habe gehört, ihr braucht einen Türsteher.', { radio: true, expr: 'entschlossen' });
        const v1 = m.scriptTank('spw1', { type: 'jeep', at: [100, -120], yaw: 0.2, route: [[104, -70], [110, -40]], range: 90, fireEvery: 2.5 });
        const v2 = m.scriptTank('spw2', { type: 'jeep', at: [160, -118], yaw: -0.3, route: [[150, -70], [140, -44]], range: 90, fireEvery: 2.5 });
        m.wave('g1', { count: 6, at: NORTH, attack: 'ruine', radius: 9 });
        m.say('weber', 'Zwei Geländewagen mit schweren MGs! Sie wollen durchbrechen!', { expr: 'angespannt' });
        m.tip('Raketenwerfer „Donnerkeil“ als Zweitwaffe – oder Roths Panzer zeigen lassen, wo sie stehen.', 6);
        const alive = (s) => !!(s && s.v && s.v.alive && !s.v.wreck && s.bot && s.bot.alive);
        m.objective('spw', 'Stoppt die Geländewagen der Söldner (Roth unterstützt)', { pos: () => { const s = [v1, v2].find(alive); return s ? s.v.position : null; }, label: 'Fahrzeug', total: 2 });
        yield m.until(() => { const n = [v1, v2].filter((s) => !alive(s)).length; m.progress('spw', n, 2); return n >= 2; });
        m.done('spw');
        m.say('roth', 'Beide brennen. Ich fahre bis zum Trichterrand vor und halte von dort.', { radio: true });
        yield m.killObjective('gk', 'Schlag den letzten Angriff zurück', 'g1');
        stopGuard(m, 'ruine');
        m.done('ruine');
        yield 1.5;
      },
    },
    {
      id: 'vahl',
      checkpoint: { at: [118, -40], yaw: 0.4 },
      setup(m) { giveLauncher(m, 'at_donner'); m.order('follow'); },
      *run(m) {
        m.clearObjectives();
        m.order('follow');
        const v = prop(m, { role: 'vahl', at: VAHL, yaw: 2.6, crouch: true, aim: -1.2, protect: true, failText: 'Vahl ist gefallen. Er war der Einzige, der wusste, wer ihn bezahlt.' });
        m.say('weber', 'Funkverkehr aus dem Trichter bei der alten Feldbahn. Das ist Vahl! Er ruft einen Wagen – er will sich absetzen.', { expr: 'angespannt' });
        m.wave('leib', { count: 4, at: [[VAHL[0] + 4, VAHL[1] + 3], [VAHL[0] - 4, VAHL[1] + 2], [VAHL[0] + 2, VAHL[1] - 5], [VAHL[0] - 6, VAHL[1] - 3]], hold: true });
        m.tip('Vahl ist verwundet und unbewaffnet. Nur seine Leibwache – nicht ihn.', 6);
        yield m.killObjective('lk', 'Schalte Vahls Leibwache aus', 'leib', { pos: VAHL, label: 'Vahl' });
        m.say('lenz', 'Er hebt die Hände. Nimm ihn fest, Falke – und ruf Hofer.', { radio: true });
        yield m.holdZone('fest', 'Nimm Jaro Vahl fest', { at: VAHL, r: 3, secs: 4, label: 'Vahl', action: 'Festnahme' });
        if (v) v.remove();
        for (const p of m.get('deleg') || []) if (p) p.remove();
        yield 0.5;
        m.complete();
      },
    },
  ],

  /** Testlauf (run.js): Bauen/Graben überspringen. */
  _test(d) {
    if (d.objs.some((o) => o.id === 'graben' && !o.done) && d.timerLeft != null && d.timerLeft > 3) d.timerLeft = 3;
  },
};
