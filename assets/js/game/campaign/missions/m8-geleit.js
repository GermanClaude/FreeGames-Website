// NULLPUNKT — Kampagne, Mission 8 „Geleit“ (Grenzland, Abend): Konvoi, Bordschütze im Geländewagen, Panzerabwehr zu Fuß.
// Major Daren soll vor der Waffenstillstandskommission aussagen. Kolonne: Kampfpanzer „Eisen 1“ (Roth) vorn, Geländewagen
// mit Falk am schweren MG (Weber fährt), Kastenwagen mit Daren, Geländewagen mit Lenz und Hofer. Flankenangriffe aus den
// Feldern, Minensperre und Hinterhalt im Dorf, ein feindlicher Panzer von Westen (Raketenwerfer, weil der Turm von Eisen 1
// klemmt), Lenz wird verwundet. Zu Fuß bringt Falk Daren zum Kommissionsposten am Nordhang.
// Checkpoints: start, fahrt, hinterhalt, panzer, nordhang.

import { actor } from './cast.js?v=20261114060746';
import { convoy, allyTank, toughen, giveLauncher, escort, purgeDead, prop, clearAir, ostbund } from './hilfen-b.js?v=20261114060746';

const YAW = 2.78; // Blick die Landstraße hinauf (Brücke → Dorf)
const ROUTE = [[25, 13], [14, 36], [6, 52]];
const STOP = [6, 52];
const VILLAGE_HOUSES = [[-8, 40], [18, 64], [-26, 58], [35, 40], [-14, 82], [24, 70]];
const POST = [46, 190]; // Kommissionsposten am Nordhang
// Kolonne im Dorf (Wiedereinstieg ab dem Hinterhalt)
const PARKED = { tank: [7, 50], jeep: [12, 39], trans: [16, 30], jeep2: [20, 21] };

const CUT_INTRO = {
  groundRel: true,
  location: ['Grenzland · Flussbrücke', '18:12 Uhr · Tag 23'],
  cast: {
    brandt: actor('brandt', { pos: [27.4, 3.6], yaw: -1.9, aim: -0.9 }),
    daren: actor('daren', { pos: [25.2, 4.6], yaw: 1.2, aim: -1.0 }),
    roth: actor('roth', { pos: [29.0, 6.0], yaw: 2.6, aim: -0.7 }),
    lenz: actor('lenz', { pos: [24.0, 2.4], yaw: 0.6, aim: -0.6 }),
    falk: actor('falk', { pos: [26.2, 1.4], yaw: 0.1, aim: -0.6 }),
    weber: actor('weber', { pos: [28.6, 1.8], yaw: -0.6, aim: -0.6 }),
  },
  beats: [
    { cam: { path: [[70, 30, -60], [52, 18, -30], [40, 9, -6]], look: [30, 2, 10], lookTo: [8, 2, 70] }, dur: 8, fadeIn: 1.6,
      say: { who: 'funk', text: 'Anker an Geleit: Die Kommission erwartet Major Daren um neunzehn Uhr am Nordhang. Die Straße durchs Dorf ist frei gemeldet.' } },
    { cam: { close: 'brandt', side: 0.4, dist: 0.9, push: 0.1 },
      say: { who: 'brandt', text: 'Frei gemeldet heißt nicht frei. Kessar weiß genau, was Major Daren aussagen wird.', expr: 'ernst' } },
    { cam: { close: 'daren', side: -0.35, dist: 0.9 },
      say: { who: 'daren', text: 'Befehle mit seiner Unterschrift, Funkprotokolle, Namen. Wenn ich ankomme, kann niemand mehr behaupten, das Nordkorps habe angegriffen.', expr: 'entschlossen' } },
    { cam: { close: 'roth', side: 0.35, dist: 0.9 },
      say: { who: 'roth', text: 'Eisen 1 fährt vorn. Die Kette ist geflickt – sie hält, solange niemand drauftritt.', expr: 'nachdenklich' } },
    { cam: { over: ['falk', 'lenz'] },
      say: { who: 'lenz', text: 'Falke, du stehst am MG im zweiten Wagen, Weber fährt. Achte auf alles, was sich in den Feldern bewegt.' } },
    { cam: { close: 'weber', side: -0.4, dist: 0.95 },
      say: { who: 'weber', text: 'Ich fahre vorsichtig. Versprochen.', expr: 'erleichtert' } },
    { cam: { over: ['falk', 'daren'], dist: 1.3 },
      act: [{ who: 'daren', face: 'falk' }],
      say: { who: 'daren', text: 'Unteroffizier – vor einer Woche hätten Sie auf mich geschossen. Danke, dass Sie es heute nicht tun.', expr: 'ernst' } },
    { cam: { close: 'falk', side: 0.35, dist: 0.9, push: 0.1 },
      say: { who: 'falk', text: 'Vor einer Woche wussten wir nicht, wer Sie sind.', expr: 'nachdenklich' } },
    { cam: { from: [16, 4, 4], to: [14, 6, 0], look: [27, 1.5, 3] },
      act: [{ who: 'falk', walk: [[31, -6]], speed: 1.8, at: 0.6 }, { who: 'weber', walk: [[33, -9]], speed: 1.8, at: 0.4 }, { who: 'daren', walk: [[35, -18]], speed: 1.5, at: 1.0 }],
      say: { who: 'brandt', text: 'Aufsitzen. Wir fahren.', expr: 'entschlossen' }, dur: 3.5, fadeOut: 1.0 },
  ],
};

const CUT_OUTRO = {
  groundRel: true,
  location: ['Nordhang · Posten der Waffenstillstandskommission', '19:04 Uhr'],
  cast: {
    haas: actor('haas', { pos: [47.6, 192.4], yaw: 2.6, aim: -1.0 }),
    daren: actor('daren', { pos: [45.6, 189.4], yaw: -0.5, aim: -1.0 }),
    brandt: actor('brandt', { pos: [49.2, 189.6], yaw: 0.9, aim: -0.9 }),
    falk: actor('falk', { pos: [44.2, 187.4], yaw: -0.2, aim: -0.6 }),
    weber: actor('weber', { pos: [42.4, 189.0], yaw: -1.1, crouch: true, aim: -0.7 }),
  },
  beats: [
    { cam: { from: [20, 14, 160], to: [28, 9, 172], look: [46, 2, 190] }, dur: 6, fadeIn: 1.2,
      say: { who: 'funk', text: 'Anker: Geleit hat den Nordhang erreicht. Der Zeuge ist unverletzt.' } },
    { cam: { close: 'haas', side: 0.4, dist: 0.9, push: 0.1 },
      say: { who: 'haas', text: 'Major Daren. Die Kommission hat Ihre Unterlagen gelesen. Ihnen ist klar, dass Sie damit Ihre Laufbahn beenden?', expr: 'ernst' } },
    { cam: { close: 'daren', side: -0.35, dist: 0.9 },
      say: { who: 'daren', text: 'Meine Laufbahn ist mir weniger wert als die Menschen in diesem Tal.', expr: 'entschlossen' } },
    { cam: { over: ['daren', 'haas'] },
      say: { who: 'haas', text: 'Dann nehmen wir Ihre Aussage noch heute Nacht auf. Beide Seiten werden sie hören.', expr: 'nachdenklich' } },
    { cam: { close: 'falk', side: 0.4, dist: 0.95 },
      say: { who: 'hofer', text: 'Hofer an Falke: Feldwebel Lenz ist stabil. Er kommt durch – aber ein paar Tage fällt er aus.' } },
    { cam: { close: 'brandt', side: -0.3, dist: 0.85, push: 0.1 },
      say: { who: 'brandt', text: 'Falke, bis Lenz zurück ist, führst du den Trupp.', expr: 'entschlossen' } },
    { cam: { close: 'weber', side: 0.4, dist: 0.95 },
      say: { who: 'weber', text: 'Herr Hauptmann! Das Relais in Sant Aurel – Kessars Leute haben es besetzt. Er will heute Nacht senden, auf allen Kanälen.', expr: 'angespannt' } },
    { cam: { from: [36, 4, 178], to: [32, 7, 172], look: [46, 1.6, 190] }, dur: 4.5, fadeOut: 1.4,
      say: { who: 'brandt', text: 'Dann gehen wir dorthin zurück, wo alles angefangen hat.', expr: 'ernst' } },
  ],
};

export const MISSION_8 = {
  id: 'm8',
  number: 8,
  title: 'Geleit',
  short: 'Geleit',
  map: 'grenzland',
  time: 'abend',
  weather: 'bewoelkt',
  type: 'Konvoi · Bordschütze im Geländewagen',
  summary: 'Major Daren muss lebend vor die Waffenstillstandskommission. Sichere die Kolonne am MG des Geländewagens, zerschlag den Hinterhalt im Dorf und bring Daren zum Nordhang.',
  loadoutHint: 'Einsteigen: F (Gamepad X, Touch: Knopf am Fahrzeug).',
  cutscenes: { intro: CUT_INTRO, outro: CUT_OUTRO },

  prepare(m) {
    clearAir(m);
    purgeDead(m);
    const later = m.startIndex >= 2; // ab dem Hinterhalt: Kolonne steht im Dorf, Trupp zu Fuß
    const P = later ? PARKED : { tank: [31, 0], jeep: [35, -11], trans: [38, -22], jeep2: [41, -33] };
    const tank = allyTank(m, 'eisen1', { at: P.tank, yaw: YAW, name: 'Lt. Roth', range: 110, fireEvery: 7 });
    if (tank) toughen(tank.v, 0.3);
    m.set('eisen1', tank);
    const col = convoy(m, 'kolonne', [
      { type: 'jeep', at: P.jeep, yaw: YAW, name: later ? 'Gefr. Pohl' : 'OGefr. Weber' },
      { type: 'transporter', at: P.trans, yaw: YAW, name: 'Gefr. Albrecht' },
      { type: 'jeep', at: P.jeep2, yaw: YAW, name: 'Gefr. Kuhn', gunner: true, gunnerName: 'Gefr. Seidel' },
    ]);
    for (const e of col.list) toughen(e.v, e.def.type === 'transporter' ? 0.25 : 0.45);
    m.set('kolonne', col);
    m.set('jeep', col.list[0] ? col.list[0].v : null);
    m.set('trans', col.list[1] ? col.list[1].v : null);
    m.on('vehicle:destroyed', (e) => {
      if (e && e.vehicle && e.vehicle === m.get('trans') && !m.get('trans-ok')) m.fail('Der Wagen mit Major Daren wurde zerstört.');
    });
    if (later) spawnSquad(m, [8, 44]);
    // Wiedereinstieg während der Fahrt: zurück ans MG
    m.on('actor:spawn', (e) => {
      if (!e || e.actor !== m.G.player || m.get('abgesessen')) return;
      const jeep = m.get('jeep');
      if (jeep && jeep.alive && m.objs.some((o) => o.id === 'kolonne' && !o.done)) setTimeout(() => { try { if (!m.G.player.vehicle) m.G.vehicles.enter(m.G.player, jeep, 1); } catch { /* */ } }, 80);
    });
  },

  stages: [
    {
      id: 'start',
      checkpoint: { at: [30, -4], yaw: YAW },
      *run(m) {
        yield m.cutsceneAt('intro');
        const jeep = m.get('jeep');
        m.objective('mg', 'Steig als MG-Schütze in den Geländewagen', { pos: () => (jeep ? jeep.position : null), label: 'Geländewagen' });
        m.tip('Einsteigen: F · Gamepad X · Touch: „Einsteigen“. Der Fahrersitz ist besetzt – du kommst ans MG.', 6);
        yield () => !!(m.G.player.vehicle && m.G.player.vehicle === jeep);
        if (jeep.seatOf(m.G.player) !== 1) { try { m.G.vehicles.switchSeat(m.G.player, 1); } catch { /* */ } }
        m.done('mg');
        m.say('weber', 'Halt dich fest. Wir fahren an.', { radio: false });
        yield 1.5;
      },
    },
    {
      id: 'fahrt',
      checkpoint: { at: [33, -8], yaw: YAW },
      setup(m) {
        const jeep = m.get('jeep');
        setTimeout(() => { try { if (jeep && jeep.alive && !m.G.player.vehicle) m.G.vehicles.enter(m.G.player, jeep, 1); } catch { /* */ } }, 60);
      },
      *run(m) {
        m.clearObjectives();
        const col = m.get('kolonne');
        const tank = m.get('eisen1');
        if (tank) tank.go([...ROUTE, [4, 56]], 5);
        col.go(ROUTE, { speed: 5, gap: 13 });
        const trans = m.get('trans');
        m.objective('kolonne', 'Sichere die Kolonne bis ins Dorf', { pos: STOP, label: 'Dorf' });
        m.objective('daren', 'Der Wagen mit Major Daren darf nicht ausfallen', { pos: () => (trans && trans.alive ? trans.position : null), label: 'Daren', optional: true });
        yield 6;
        m.wave('f1', { count: 5, at: [[-30, 16], [-36, 28], [-24, 6], [-40, 20], [-28, 34]], attack: 'player', radius: 10 });
        m.say('roth', 'Bewegung in den Feldern links! Falke, halt drauf!', { expr: 'angespannt', radio: true });
        const f1 = m.killObjective('f1', 'Wehre den Angriff aus den Feldern ab', 'f1');
        yield [f1, () => col.near([14, 36], 14)];
        m.wave('f2', { count: 5, at: [[35, 40], [40, 46], [30, 36], [44, 34], [38, 52]], attack: 'player', radius: 8 });
        m.say('weber', 'Rechts, bei den Häusern! Sie haben einen Werfer!', { expr: 'angespannt' });
        yield m.killObjective('f2', 'Halte die Häuser rechts nieder', 'f2');
        const t0 = m.elapsed;
        yield [f1, () => col.near(STOP, 16) || m.elapsed - t0 > 90];
        if (!col.near(STOP, 16)) parkConvoy(m); // Kolonne hängt fest (Hindernis): ins Dorf setzen
        m.done('kolonne');
        yield 0.5;
      },
    },
    {
      id: 'hinterhalt',
      checkpoint: { at: [8, 44], yaw: YAW },
      *run(m) {
        m.clearObjectives();
        const col = m.get('kolonne');
        const tank = m.get('eisen1');
        if (col) col.stop();
        if (tank) tank.hold();
        // Minensperre vor Eisen 1
        {
          try { const p = tank && tank.ok() ? tank.v.position.clone() : m.vec([4, 56]); p.z += 4; m.G.combat.explode({ position: p, radius: 5, maxDamage: 40, attacker: null, weaponId: 'mine', type: 'frag' }); } catch { /* */ }
        }
        m.say('roth', 'Mine! Die Kette ist gerissen – Eisen 1 steht. Und der Turm klemmt!', { expr: 'angespannt', radio: true });
        yield 1.5;
        // Alle absitzen: Spieler und Fahrer der Kolonne → Trupp zu Fuß
        m.set('abgesessen', true);
        if (m.G.player.vehicle) { try { m.G.vehicles.removeFromSeat(m.G.player, { teleport: true }); } catch { /* */ } }
        if (!m.ally('lenz')) spawnSquad(m, null);
        m.wave('hh', { count: 8, at: VILLAGE_HOUSES, hold: true });
        m.wave('hh2', { count: 4, at: [[-20, 70], [-30, 80], [-10, 92], [-34, 64]], attack: 'player', radius: 8 });
        m.order('attack', [0, 60]);
        m.say('lenz', 'Hinterhalt! Raus aus den Wagen, in die Häuser! Hofer, bleib beim Major!', { expr: 'angespannt' });
        yield m.killObjective('hh', 'Zerschlage den Hinterhalt im Dorf', ['hh', 'hh2']);
        m.say('lenz', 'Dorf ist ruhig. Lagemeldung, Leutnant?');
        yield 1;
      },
    },
    {
      id: 'panzer',
      checkpoint: { at: [4, 60], yaw: 0.8 },
      setup(m) { m.order('hold'); },
      *run(m) {
        m.clearObjectives();
        m.order('hold');
        const kt = m.scriptTank('kt', { at: [-112, 98], yaw: -1.75, route: [[-70, 88], [-34, 80]], range: 120, fireEvery: 8 });
        m.say('roth', 'Feindpanzer von Westen, auf dem Weg vom Gehöft! Ich kann den Turm nicht drehen – ihr müsst ihn zu Fuß stoppen!', { expr: 'angespannt', radio: true });
        yield 2;
        giveLauncher(m, 'at_donner');
        m.say('hofer', 'Falke! Im Wagen liegt ein Donnerkeil. Nimm ihn – ich habe ihn dir in die Hand gedrückt.', { expr: 'angespannt' });
        m.tip('Raketenwerfer: Waffe wechseln (Mausrad bzw. Y / Touch: Waffensymbol). Von der Seite oder von hinten trifft er am stärksten.', 7);
        m.wave('kti', { count: 4, at: [[-60, 92], [-56, 80], [-66, 86], [-50, 96]], attack: [-20, 76], radius: 8 });
        const alive = () => !!(kt && kt.v && kt.v.alive && !kt.v.wreck);
        m.objective('kt', 'Schalte den Panzer mit dem Raketenwerfer aus', { pos: () => (alive() ? kt.v.position : null), label: 'Panzer' });
        yield m.until(() => !alive());
        m.done('kt');
        // Lenz wird verwundet (Granatsplitter des letzten Schusses)
        const lz = m.ally('lenz');
        const at = lz && lz.alive ? [lz.position.x, lz.position.z] : [-2, 66];
        try { if (lz) { m.G.vehicles && lz.vehicle && m.G.vehicles.removeFromSeat(lz, { teleport: false }); m.G.bots.removeBot(lz); m.allyByRole.delete('lenz'); m.allyList = m.allyList.filter((b) => b !== lz); } } catch { /* */ }
        try { m.G.combat.explode({ position: m.vec([at[0] + 1.5, at[1] - 1]), radius: 2, maxDamage: 1, attacker: null, weaponId: 'mbt_he', type: 'frag' }); } catch { /* */ }
        const fig = prop(m, { role: 'lenz', at, yaw: 0.4, crouch: true, aim: -1.2 });
        m.say('weber', 'Lenz ist getroffen! Hofer! Hofer, hierher!', { expr: 'angespannt' });
        yield 1;
        yield m.holdZone('lenz', 'Versorge Feldwebel Lenz', { at, r: 3, secs: 5, label: 'Lenz', action: 'Druckverband anlegen' });
        if (fig) fig.remove();
        m.say('lenz', 'Ist nicht so schlimm, wie es aussieht … Bring den Major hoch, Falke. Das ist wichtiger.', { expr: 'traurig', radio: true });
        m.wave('nach', { count: 5, at: [[-34, 80], [-40, 70], [-28, 90]], attack: 'player', radius: 8 });
        yield m.reach('san', 'Bring Lenz zum Sanitätswagen', { at: [16, 30], r: 5, label: 'Sanitätswagen' });
        m.say('hofer', 'Ich habe ihn. Er bleibt bei mir im Wagen. Los jetzt!', { expr: 'ernst' });
        yield 1;
      },
    },
    {
      id: 'nordhang',
      checkpoint: { at: [10, 40], yaw: 2.9 },
      setup(m) { giveLauncher(m, 'at_donner'); },
      *run(m) {
        m.clearObjectives();
        m.set('trans-ok', true);
        const lz = m.ally('lenz');
        if (lz) { try { m.G.bots.removeBot(lz); m.allyByRole.delete('lenz'); m.allyList = m.allyList.filter((b) => b !== lz); } catch { /* */ } }
        const darenIn = escort(m, 'daren');
        m.order('follow');
        m.say('daren', 'Ich bleibe hinter Ihnen, Unteroffizier. Gehen Sie voran.');
        m.wave('turm', { count: 2, at: [[-8, 92], [-6, 103]], hold: true });
        m.wave('feld', { count: 6, at: [[20, 140], [32, 150], [12, 132], [40, 160], [26, 128], [8, 150]], hold: true });
        yield m.reach('ausgang', 'Bring Major Daren durchs Dorf nach Norden', { at: [6, 104], r: 9, label: 'Dorfausgang' });
        m.say('weber', 'Schütze im Kapellenturm! Und weiter oben in den Hecken – sie warten auf uns.', { expr: 'angespannt' });
        yield m.killObjective('hecken', 'Räume den Weg zum Nordhang', ['turm', 'feld']);
        m.zone('posten', { at: POST, r: 9 });
        m.objective('posten', 'Bring Major Daren zum Kommissionsposten', { pos: POST, label: 'Kommission' });
        yield () => m.inZone('posten') && (darenIn('posten') || !m.ally('daren'));
        m.done('posten');
        m.say('funk', 'Kommission an Geleit: Wir sehen Sie. Kommen Sie herein.');
        yield 1.5;
        m.complete();
      },
    },
  ],

  /** Testlauf (run.js): in den Geländewagen setzen, Kolonne ans Ziel stellen. */
  _test(d) {
    const G = d.G, jeep = d.get('jeep'), col = d.get('kolonne');
    if (d.objs.some((o) => o.id === 'mg' && !o.done) && jeep && !G.player.vehicle) G.vehicles.enter(G.player, jeep, 1);
    if (col && col.moving) {
      const tgt = d.objs.find((o) => o.id === 'kolonne' && !o.done) ? STOP : null;
      if (tgt) col.list.forEach((e, i) => { const p = d.vec([tgt[0] + 2 * i, tgt[1] - 9 * i]); e.v.body.setPose(p.setY(p.y + 0.5), e.v.body.yaw ? e.v.body.yaw() : YAW); });
    }
    const dz = d.ally('daren');
    if (dz && d.zones.has('posten') && !d.inZone('posten', dz)) { const z = d.zones.get('posten'); try { dz.body.teleport(z.c.clone().setY(z.c.y + 0.3)); } catch { /* */ } }
  },
};

/** Kolonne ins Dorf stellen (Rückfall, wenn sie unterwegs festhängt). */
function parkConvoy(m) {
  const col = m.get('kolonne'), tank = m.get('eisen1');
  const put = (v, p) => { if (!v || !v.alive) return; const q = m.vec(p); try { v.body.setPose(q.setY(q.y + 0.5), YAW); if (v.body.vel) v.body.vel.set(0, 0, 0); } catch { /* */ } };
  if (tank && tank.v) put(tank.v, PARKED.tank);
  if (col) { put(col.list[0] && col.list[0].v, PARKED.jeep); put(col.list[1] && col.list[1].v, PARKED.trans); put(col.list[2] && col.list[2].v, PARKED.jeep2); }
}

/** Trupp zu Fuß (nach dem Absitzen bzw. Wiedereinstieg): Lenz, Weber, Hofer, Daren in Ostbund-Uniform. */
function spawnSquad(m, at) {
  const P = m.G.player;
  const base = at || [P.position.x, P.position.z];
  const bots = m.allies([
    { role: 'lenz', name: 'Fw. Lenz', at: [base[0] - 2, base[1] + 1] },
    { role: 'weber', name: 'OGefr. Weber', at: [base[0] + 2, base[1] + 1] },
    { role: 'hofer', name: 'San. Hofer', at: [base[0] + 3, base[1] - 2] },
    { role: 'daren', name: 'Maj. Daren', at: [base[0] - 3, base[1] - 2] },
  ]);
  const d = m.ally('daren');
  if (d) ostbund(m, d);
  // Fahrer der Kolonne steigen aus und kämpfen mit
  const col = m.get('kolonne');
  if (col) for (const e of col.list) { if (e.def.type === 'transporter') continue; if (e.driver && e.driver.vehicle) { try { m.G.vehicles.removeFromSeat(e.driver, { teleport: true }); } catch { /* */ } } }
  return bots;
}
