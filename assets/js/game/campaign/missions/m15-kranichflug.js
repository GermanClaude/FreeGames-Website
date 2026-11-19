// NULLPUNKT — Kampagne, Mission 15 „Kranichflug“ (Fliegerhorst Hagenmoor, Abend): Geiselbefreiung und Jet-Einsatz. Ende
// von Akt III – mit einer Teilantwort auf die Kranich-Frage und offenem Ende.
// Die Graue Kompanie hat den Fliegerhorst besetzt und das Bodenpersonal in den Unterkünften eingeschlossen. Falk dringt
// vom Südzaun über den Appellplatz in die Kasernen 1 und 2 ein und holt die Geiseln Raum für Raum heraus (geschützte
// Figuren – ein Treffer ist ein Fehlschlag). Dann hebt Seyfrieds Hubschrauber vom Vorfeld ab. Der einzige startbereite
// Jäger, der „JK-9 Falke“, steht auf der Startbahn (world.runway: Start vom Boden). Mit Sanders Stimme im Funk startet
// Falk, schießt die beiden Begleithubschrauber ab und zwingt Seyfried mit drei dichten Überflügen zur Landung. Outro:
// Seyfried gesteht, dass „Kranich“ drei sind – er zahlt, Dr. Pell sitzt in der Kommission, den dritten kennt er nicht.
// Checkpoints: start, appell, kaserne1, kaserne2, jet, luft, landung.

import * as THREE from 'three';
import { actor } from './cast.js?v=20261115041504';
import { clearAir, purgeDead } from './hilfen-b.js?v=20261115041504';
import { pilot, circuit } from './hilfen-c.js?v=20261115041504';

const START = [-128, 206];
const APPELL = [-146, 156];
const K1 = { door: [-160, 120.5], hostages: [{ id: 'g1', at: [-150, 128.5], yaw: 3.1 }, { id: 'g2', at: [-169, 129], yaw: 0.4 }], guards: [[-152, 125], [-146, 131], [-167, 125], [-173, 130]] };
const K2 = { door: [-100, 120.5], hostages: [{ id: 'g3', at: [-91, 128.5], yaw: -2.6 }, { id: 'g4', at: [-109, 129], yaw: 2.2 }], guards: [[-94, 125], [-88, 131], [-106, 125], [-112, 131]] };
const MEET = [-130, 112];           // Sammelpunkt nördlich der Kasernen (Hofer nimmt die Geiseln)
const JET_AT = [-210, 40];          // Startbahn 09/27, Westteil (Blick nach Osten)
const JET_YAW = -Math.PI / 2;
const PAD = [40, -100];             // Vorfeld: Seyfrieds Hubschrauber
const LAND = [-60, -210];           // Landeplatz auf dem Feld nördlich des Vorfelds
const ALT = 70;
const ROUND = [[320, ALT, -230], [-330, ALT, -240], [-360, ALT, 180], [330, ALT, 200]];

const CUT_INTRO = {
  groundRel: true,
  location: ['Fliegerhorst Hagenmoor · Südzaun', '19:18 Uhr · Tag 28'],
  cast: {
    falk: actor('falk', { pos: [START[0] + 0.6, START[1] - 1.2], yaw: 0.1, aim: -0.6 }),
    lenz: actor('lenz', { pos: [START[0] - 1.4, START[1] - 0.2], yaw: -0.4, aim: -0.9 }),
    weber: actor('weber', { pos: [START[0] + 2.0, START[1] + 0.8], yaw: 0.5, crouch: true, aim: -0.7 }),
    hofer: actor('hofer', { pos: [START[0] - 0.4, START[1] + 1.6], yaw: 0.0, aim: -0.8 }),
    sander: actor('sander', { pos: [START[0] + 1.4, START[1] + 2.4], yaw: -2.6, crouch: true, aim: -1.0 }),
  },
  beats: [
    { cam: { from: [START[0] - 60, 40, START[1] + 30], to: [START[0] - 25, 16, START[1] + 12], look: [-130, 3, 130], lookTo: [START[0], 1.5, START[1]], ease: 'inOut' }, dur: 7, fadeIn: 1.6,
      say: { who: 'funk', text: 'Anker an Trupp Falke: Funkspruch vom Fliegerhorst Hagenmoor. Die Graue Kompanie hält zwanzig Leute vom Bodenpersonal in den Unterkünften fest.' } },
    { cam: { close: 'weber', side: 0.4, dist: 0.9, push: 0.1 },
      say: { who: 'weber', text: 'Und auf dem Vorfeld wird ein Hubschrauber betankt. Zivil lackiert, aber mit Zusatztanks. Weit genug für jedes Land, das keine Fragen stellt.', expr: 'angespannt' } },
    { cam: { close: 'lenz', side: -0.35, dist: 0.9 },
      say: { who: 'lenz', text: 'Seyfried. Zuerst die Geiseln, dann der Hubschrauber. In dieser Reihenfolge.', expr: 'entschlossen' } },
    { cam: { close: 'sander', side: 0.35, dist: 0.9 },
      say: { who: 'sander', text: 'Mein Bein trägt mich noch nicht in ein Cockpit. Aber auf der Bahn steht ein JK-9, vollgetankt. Falke, du hattest zwölf Stunden im Simulator in Hohenfeld.', expr: 'ernst' } },
    { cam: { close: 'falk', side: -0.3, dist: 0.85, push: 0.12 },
      say: { who: 'falk', text: 'Elf. Und in der zwölften bin ich abgestürzt.', expr: 'nachdenklich' } },
    { cam: { close: 'sander', side: -0.35, dist: 0.9 },
      say: { who: 'sander', text: 'Dann weißt du, wie man es nicht macht. Ich bleibe am Funk und rede dich hoch.', expr: 'erleichtert' } },
    { cam: { close: 'hofer', side: 0.4, dist: 0.95 },
      say: { who: 'hofer', text: 'Ich nehme jede Geisel, die ihr mir bringt. Und wenn einer von euch blutet, sagt es mir, bevor es zu spät ist.', expr: 'ernst' } },
    { cam: { from: [START[0] + 6, 2.2, START[1] - 6], to: [START[0] + 8, 3.5, START[1] - 10], look: [START[0], 1.2, START[1]], lookTo: [APPELL[0], 2, APPELL[1]] }, dur: 4, fadeOut: 1.2,
      act: [{ who: 'falk', walk: [[START[0] - 2, START[1] - 10]], speed: 1.8, at: 0.4 }, { who: 'lenz', walk: [[START[0] - 4, START[1] - 9]], speed: 1.7, at: 0.8 }],
      say: { who: 'brandt', text: 'Niemand schießt, der nicht muss. Und Falke – komm mit dem Flugzeug zurück. Es gehört dem Steuerzahler.' } },
  ],
};

const CUT_OUTRO = (m) => {
  const [lx, lz] = LAND;
  return {
    groundRel: true,
    location: ['Fliegerhorst Hagenmoor · Nordfeld', '19:56 Uhr'],
    cast: {
      seyfried: actor('seyfried', { pos: [lx + 7, lz + 1], yaw: 2.2, aim: -1.1 }),
      lenz: actor('lenz', { pos: [lx + 5, lz + 3], yaw: -1.0, aim: -0.8 }),
      weber: actor('weber', { pos: [lx + 9.5, lz + 3.5], yaw: -2.0, aim: -0.7 }),
      falk: actor('falk', { pos: [lx + 4, lz - 0.6], yaw: -1.6, aim: -0.6 }),
      haas: actor('haas', { pos: [lx + 3, lz + 5], yaw: -0.4, aim: -1.0 }),
    },
    beats: [
      { cam: { from: [lx + 40, 22, lz + 30], to: [lx + 20, 9, lz + 14], look: [lx + 6, 1.2, lz + 2] }, dur: 6, fadeIn: 1.2,
        say: { who: 'sander', text: 'Libelle 1 an Falke: Er ist unten. Du kannst jetzt aufhören, über ihn hinwegzudonnern. Landebahn ist frei – mach es ordentlich.', expr: 'erleichtert' } },
      { cam: { close: 'seyfried', side: 0.4, dist: 0.9, push: 0.1 },
        say: { who: 'seyfried', text: 'Sie verhaften einen Geschäftsmann, Feldwebel. Ich habe Ware geliefert. Was die Leute damit machen, ist nicht meine Sache.', expr: 'ernst' } },
      { cam: { close: 'lenz', side: -0.35, dist: 0.9 },
        say: { who: 'lenz', text: 'Sie haben Söldner bezahlt, damit sie eine Waffenruhe brechen. Damit Sie wieder liefern können. Das ist sehr wohl Ihre Sache.', expr: 'entschlossen' } },
      { cam: { close: 'haas', side: 0.35, dist: 0.95 },
        say: { who: 'haas', text: 'Wer ist Kranich, Herr Seyfried? Ihr Name steht in Kessars Notizbuch. Aber nicht allein.', expr: 'ernst' } },
      { cam: { close: 'seyfried', side: -0.4, dist: 0.85, push: 0.12 },
        say: { who: 'seyfried', text: 'Kranich sind drei. Ich bin der, der zahlt. Der zweite sitzt an Ihrem Tisch, Frau Kommissarin – Sie haben ihm Ihre Sitzordnung anvertraut.', expr: 'nachdenklich' } },
      { cam: { close: 'haas', side: -0.3, dist: 0.9 },
        say: { who: 'haas', text: 'Ansgar.', expr: 'traurig' } },
      { cam: { close: 'weber', side: 0.4, dist: 0.95 },
        say: { who: 'weber', text: 'Und der dritte?', expr: 'fragend' } },
      { cam: { close: 'seyfried', side: 0.3, dist: 0.85 },
        say: { who: 'seyfried', text: 'Den hat keiner von uns je gesehen. Er spricht nur über Funk. Und er hat schon für den Fall bezahlt, dass ich heute verliere.', expr: 'angespannt' } },
      { cam: { from: [lx + 2, 1.8, lz - 4], to: [lx + 1, 2.2, lz - 6], look: [lx + 6, 1.4, lz + 2] }, loc: false,
        say: { who: 'kranich', text: 'Seyfried hat gezahlt, was er zahlen sollte. Er wird nicht mehr gebraucht. Doktor Pell – Sie wissen, wohin Sie gehen.' } },
      { cam: { close: 'falk', side: 0.35, dist: 0.9, push: 0.15 }, fadeOut: 1.6,
        say: { who: 'falk', text: 'Dann finden wir ihn. Den dritten. Wie die beiden anderen.', expr: 'entschlossen' } },
      { cam: { from: [lx + 10, 8, lz + 14], to: [lx + 14, 16, lz + 22], look: [lx, 1.5, lz] }, card: ['Ende von Akt III · Phase zwei', 'Zwei Kranich sind bekannt. Einer fehlt.', 'Fortsetzung folgt mit einem kommenden Update.'], dur: 6, fadeIn: 1.2 },
    ],
  };
};

/** Geisel (geschützte Figur, geduckt); folgt nach der Befreiung dem Spieler zum Sammelpunkt. */
function hostage(m, h, follow = false) {
  const x = m.extra(h.id, { pos: h.at, yaw: h.yaw, variant: ['zivil-arbeit', 'zivil-hemd', 'zivil', 'zivil-arbeit'][+h.id.slice(1) - 1] || 'zivil', name: 'Bodenpersonal', crouch: !follow, protect: true, aim: -1.2, failText: 'Eine Geisel wurde getroffen. Wir schießen nur, wenn wir sicher sind.' });
  if (follow) x.follow(m.G.player);
  return x;
}

function* building(m, K, n) {
  const hs = K.hostages.map((h) => hostage(m, h));
  m.wave(`k${n}`, { count: K.guards.length, scale: false, at: K.guards, hold: true });
  yield m.reach(`tuer${n}`, `Dring in Kaserne ${n} ein`, { at: K.door, r: 4, label: `Kaserne ${n}` });
  m.say('lenz', n === 1 ? 'Stuben links und rechts vom Treppenhaus. Geiseln sitzen am Boden – zielt hoch und sauber.' : 'Gleiche Aufteilung wie nebenan. Langsam. Jede Tür ist eine Frage.', { expr: 'angespannt' });
  yield m.killObjective(`kk${n}`, `Befreie die Stuben in Kaserne ${n}`, `k${n}`);
  for (let i = 0; i < hs.length; i++) {
    const h = K.hostages[i];
    yield m.holdZone(`los${h.id}`, 'Löse die Fesseln der Geisel', { at: h.at, r: 2.2, secs: 2.5, label: 'Geisel', action: 'Fesseln lösen' });
    hs[i].crouch = false;
    hs[i].follow(m.G.player);
    m.say(i ? 'zivil' : 'weber', i ? 'Danke … danke. Sie haben den Hauptmann in den Turm gebracht. Der ist nicht mehr zurückgekommen.' : 'Ganz ruhig. Bleiben Sie hinter Unteroffizier Falk, und ducken Sie sich, wenn er es sagt.', { radio: false });
  }
  yield m.reach(`sammel${n}`, 'Bring die Geiseln zum Sammelpunkt bei Hofer', { at: MEET, r: 5, label: 'Hofer' });
  for (const h of hs) if (!h.removed) { h.follow(null); h.walk([[MEET[0] - 3 + Math.random() * 2, MEET[1] + 2]], 1.4); }
  m.say('hofer', 'Ich habe sie. Alle unverletzt. Geh, Falke.', { expr: 'erleichtert' });
  m.progress('geiseln', n * 2, 4);
  yield 2;
  for (const h of hs) if (!h.removed) h.remove();
}

function jet(m) {
  const air = m.G.vehicles && m.G.vehicles.air;
  if (!air) return null;
  let j = m.get('jet');
  if (j && j.alive) return j;
  const p = m.vec(JET_AT);
  p.y += 0.3;
  try { j = air.spawn('jet', p, { yaw: JET_YAW, team: 'A' }); } catch (err) { console.warn('[Kampagne] Jet', err); j = null; }
  if (j) { m.vehicles.push(j); m.set('jet', j); }
  return j;
}

/** Seyfrieds Hubschrauber (zivil, Team B) mit Autopilot-Pilot. */
function seyfriedHeli(m, airborne) {
  const air = m.G.vehicles.air;
  const p = airborne ? new THREE.Vector3(ROUND[0][0], ALT, ROUND[0][2]) : m.vec(PAD);
  if (!airborne) p.y += 0.2;
  let h = null;
  try { h = air.spawn('heli', p, { yaw: 0, team: 'B', airborne }); } catch (err) { console.warn('[Kampagne] Hubschrauber', err); }
  if (!h) return null;
  m.vehicles.push(h);
  h._kcTough = true;
  // nicht abschießbar (Seyfried soll lebend landen): Schaden stark gedämpft
  const orig = h.applyDamage ? h.applyDamage.bind(h) : null;
  if (orig) h.applyDamage = (amount, info) => orig(amount * 0.02, info);
  pilot(m, h, 'B', 'Seyfrieds Pilot');
  m.set('sey', h);
  return h;
}

function escorts(m) {
  const air = m.G.vehicles.air;
  const out = [];
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Vector3(i ? -150 : 150, ALT + 15, -180 + i * 30);
    let h = null;
    try { h = air.spawn('heli', p, { yaw: 0, team: 'B', airborne: true }); } catch { h = null; }
    if (!h) continue;
    m.vehicles.push(h);
    const [b] = m._spawnBots('B', 1);
    if (b) {
      b._kc = { enemy: true, wave: 'eskorte', crew: true };
      m._place(b, { position: p.clone(), yaw: 0 });
      try { air.pilotBot(b, h); air.order(h, { orbit: new THREE.Vector3(0, ALT, -40), radius: 260, alt: ALT + 10, attack: m.G.player.vehicle || m.G.player }); } catch { /* */ }
    }
    out.push(h);
  }
  m.set('esc', out);
  return out;
}

export const MISSION_15 = {
  id: 'm15',
  number: 15,
  act: 3,
  title: 'Kranichflug',
  short: 'Kranichflug',
  map: 'flugplatz',
  time: 'abend',
  weather: 'klar',
  type: 'Geiselbefreiung · Jet-Einsatz',
  summary: 'Die Graue Kompanie hält das Bodenpersonal von Hagenmoor fest, und Seyfrieds Hubschrauber steht startbereit. Befrei die Geiseln, starte den Jäger von der Bahn und zwing Seyfried zur Landung.',
  loadoutHint: 'Jet: W/S Schub, Maus neigen/rollen, A/D Seitenruder. Auf der Bahn Vollgas, ab etwa 60 m/s sanft ziehen.',
  loadout: { primary: 'ar_k36', secondary: 'pi_p9' },
  mapVehicles: false,
  finale: true,
  cutscenes: { intro: CUT_INTRO, outro: (m) => CUT_OUTRO(m) },

  prepare(m) {
    clearAir(m, { ground: true });
    purgeDead(m);
    const sp = m.spawnPoint ? m.spawnPoint.position : m.vec(START);
    m.allies([
      { role: 'lenz', name: 'Fw. Lenz', at: [sp.x - 2, sp.z + 1] },
      { role: 'weber', name: 'OGefr. Weber', at: [sp.x + 2, sp.z + 1] },
      { role: 'hofer', name: 'San. Hofer', at: [sp.x, sp.z + 2.5] },
      { name: 'Gefr. Albrecht', at: [sp.x - 3.5, sp.z + 1.5] },
    ]);
    m.order('follow');
    m.on('vehicle:destroyed', (e) => { if (e && e.vehicle && e.vehicle === m.get('jet')) m.fail('Der JK-9 ist verloren.'); });
  },

  stages: [
    {
      id: 'start',
      checkpoint: { at: START, yaw: 0.1 },
      *run(m) {
        yield m.cutsceneAt('intro');
        m.order('follow');
        m.objective('geiseln', 'Geiseln befreit', { total: 4, quiet: true });
        m.progress('geiseln', 0, 4);
        m.wave('zaun', { count: 3, at: [[-140, 190], [-118, 186], [-98, 196]], hold: true });
        yield m.killObjective('zk', 'Schalte die Streife am Südzaun aus', 'zaun');
        yield 0.5;
      },
    },
    {
      id: 'appell',
      checkpoint: { at: [-128, 192], yaw: 0.2 },
      setup(m) { m.order('follow'); m.objective('geiseln', 'Geiseln befreit', { total: 4, quiet: true }); },
      *run(m) {
        m.clearObjectives({ keepOpen: true });
        m.wave('ap', { count: 5, at: [[-123, 141], [-137, 157], [-146, 166], [-120, 166], [-110, 150]], hold: true });
        m.wave('apv', { count: 3, at: [[-60, 150], [-70, 120]], attack: APPELL, radius: 9 });
        m.say('weber', 'Sandsäcke am Appellplatz, zwei MG-Posten. Und sie haben Leute an den Fenstern der Kantine.', { expr: 'angespannt' });
        yield m.reach('appell', 'Stoß über den Appellplatz vor', { at: APPELL, r: 8, label: 'Appellplatz' });
        yield m.killObjective('apk', 'Räum den Appellplatz', ['ap', 'apv']);
        m.say('lenz', 'Kaserne eins zuerst. Weber, du sicherst den Eingang.', { expr: 'entschlossen' });
        yield 1;
      },
    },
    {
      id: 'kaserne1',
      checkpoint: { at: APPELL, yaw: 0.3 },
      setup(m) { m.order('follow'); m.objective('geiseln', 'Geiseln befreit', { total: 4, quiet: true }); },
      *run(m) {
        m.clearObjectives({ keepOpen: true });
        yield* building(m, K1, 1);
      },
    },
    {
      id: 'kaserne2',
      checkpoint: { at: MEET, yaw: -1.57 },
      setup(m) { m.order('follow'); m.objective('geiseln', 'Geiseln befreit', { total: 4, quiet: true }); m.progress('geiseln', 2, 4); },
      *run(m) {
        m.clearObjectives({ keepOpen: true });
        m.say('weber', 'Kaserne zwei. Zwei Stuben, mindestens vier Wachen. Sie wissen jetzt, dass wir kommen.', { expr: 'angespannt' });
        yield* building(m, K2, 2);
        m.done('geiseln');
        yield 1;
      },
    },
    {
      id: 'jet',
      checkpoint: { at: [-180, 70], yaw: 0.785 },
      setup(m) { m.order('follow'); },
      *run(m) {
        m.clearObjectives();
        const G = m.G;
        const j = jet(m);
        if (!j) { m.fail('Kein Jäger verfügbar (Luftfahrzeuge auf dieser Karte aus).'); return; }
        const s = seyfriedHeli(m, false);
        if (s) { s.autopilot = { hover: true, alt: 0 }; }
        m.wave('bahn', { count: 4, at: [[-190, 62], [-226, 58], [-200, 18], [-240, 24]], hold: true });
        m.say('weber', 'Rotoren auf dem Vorfeld! Seyfried startet!', { expr: 'angespannt' });
        yield 3;
        if (s) circuit(m, s, ROUND, { speed: 38, reach: 70 });
        m.say('sander', 'Falke, zum Jäger! Er steht auf der Bahn, Westende. Einsteigen, Haube zu – den Rest erkläre ich dir.', { radio: true, expr: 'entschlossen' });
        m.introduce('fahrzeug', 'jet', 'JK-9 Falke: Kampfjet mit Bordkanone, Raketen und Bomben. Auf dem Fliegerhorst startet er von der Bahn.');
        m.objective('einsteigen', 'Steig in den JK-9 auf der Startbahn', { pos: () => (j.alive ? j.position : null), label: 'JK-9' });
        m.tip('Einsteigen: F · Gamepad X · Touch: Knopf „Einsteigen“. Wachen an der Bahn zuerst ausschalten.', 6);
        yield () => G.player.vehicle === j;
        m.done('einsteigen');
        m.set('imJet', true);
        yield 0.5;
      },
    },
    {
      id: 'luft',
      checkpoint: { at: [-200, 58], yaw: -1.57 },
      setup(m) {
        const G = m.G, j = jet(m);
        const s = seyfriedHeli(m, true);
        if (s) circuit(m, s, ROUND, { speed: 38, reach: 70 });
        if (j) setTimeout(() => { try { if (j.alive && G.player.vehicle !== j) G.vehicles.enter(G.player, j, 0); } catch { /* */ } }, 80);
      },
      *run(m) {
        m.clearObjectives();
        const G = m.G;
        const j = m.get('jet');
        if (!j) { m.fail('Kein Jäger verfügbar.'); return; }
        if (G.player.vehicle !== j) { try { G.vehicles.enter(G.player, j, 0); } catch { /* */ } }
        m.say('sander', 'Gut. Schub ganz nach vorn. Bleib auf der Mittellinie. Bei sechzig Metern pro Sekunde ziehst du sanft – nicht reißen.', { radio: true });
        m.tip('Start: Vollgas (W bzw. rechter Trigger), auf der Mittellinie bleiben, ab etwa 60 m/s die Nase sanft anheben.', 9);
        m.objective('abheben', 'Starte den JK-9 von der Bahn', { label: 'Startbahn' });
        yield () => j.alive && j.body && !j.body.onGround && (j.body.agl || 0) > 25;
        m.done('abheben');
        m.say('sander', 'Du fliegst! Fahrwerk kommt von selbst. Jetzt such dir die zwei Begleiter – die schießen auf alles, was sich Seyfried nähert.', { radio: true, expr: 'erleichtert' });
        const esc = escorts(m);
        const alive = (h) => h && h.alive && !h.wreck;
        m.objective('esk', 'Schieß die Begleithubschrauber ab', { pos: () => { const h = esc.find(alive); return h ? h.position : null; }, label: 'Begleiter', total: esc.length });
        yield m.until(() => { const n = esc.filter((h) => !alive(h)).length; m.progress('esk', n, esc.length); return n >= esc.length; });
        m.done('esk');
        m.say('sander', 'Beide unten! Seyfried ist allein. Abschießen dürfen wir ihn nicht – wir brauchen ihn. Zwing ihn runter: dichte Überflüge, damit sein Pilot begreift, dass er keine Wahl hat.', { radio: true });
        yield 1;
      },
    },
    {
      id: 'landung',
      checkpoint: { at: [-200, 58], yaw: -1.57 },
      setup(m) {
        const G = m.G, j = jet(m);
        if (!m.get('sey')) { const s = seyfriedHeli(m, true); if (s) circuit(m, s, ROUND, { speed: 38, reach: 70 }); }
        if (j) setTimeout(() => { try { if (j.alive && G.player.vehicle !== j) G.vehicles.enter(G.player, j, 0); } catch { /* */ } }, 80);
      },
      *run(m) {
        m.clearObjectives();
        const G = m.G, air = G.vehicles.air;
        const s = m.get('sey');
        if (!s) { m.complete(); return; }
        let passes = 0, close = false;
        m.objective('pass', 'Zwing Seyfried mit dichten Überflügen zur Landung (unter 150 m)', { pos: () => (s.alive ? s.position : null), label: 'Seyfried', total: 3 });
        m.progress('pass', 0, 3);
        yield m.until(() => {
          const P = G.player;
          const me = P.vehicle ? P.vehicle.position : P.position;
          const d = me.distanceTo(s.position);
          if (!close && d < 150) { close = true; }
          if (close && d > 260) {
            close = false;
            passes += 1;
            m.progress('pass', passes, 3);
            m.say(passes < 3 ? 'sander' : 'grau', passes === 1 ? 'Das hat er gespürt! Noch einmal!' : passes === 2 ? 'Er wird langsamer. Einmal noch, dann hat er genug.' : 'Wir landen. Wir landen! Nicht schießen!', { radio: true });
          }
          return passes >= 3 || m.get('testPass');
        });
        m.done('pass');
        // Landung auf dem Nordfeld: hinfliegen, dann absinken
        const lp = m.vec(LAND);
        try { air.fly(s, { to: lp.clone().setY(lp.y + 30), alt: 30, speed: 25 }); } catch { /* */ }
        m.objective('folgen', 'Bleib über Seyfried, bis er gelandet ist', { pos: () => (s.alive ? s.position : null), label: 'Seyfried' });
        yield () => !s.alive || Math.hypot(s.position.x - lp.x, s.position.z - lp.z) < 60 || m.get('testPass');
        try { air.fly(s, { hover: true, alt: 0 }); } catch { /* */ }
        yield () => !s.alive || (s.body && (s.body.onGround || s.body.agl < 2)) || m.get('testPass');
        m.done('folgen');
        m.say('lenz', 'Er ist unten! Wir sind mit dem Wagen gleich da. Seyfried steigt aus – mit erhobenen Händen.', { radio: true, expr: 'erleichtert' });
        yield 2;
        m.complete();
      },
    },
  ],

  /** Testlauf (run.js): Jet in die Luft setzen, Begleiter abschießen, Überflüge erledigen. */
  _test(d) {
    const G = d.G, air = G.vehicles && G.vehicles.air, j = d.get('jet');
    if (d.objs.some((o) => o.id === 'einsteigen' && !o.done) && j && j.alive && G.player.vehicle !== j) { try { G.vehicles.enter(G.player, j, 0); } catch { /* */ } }
    if (d.objs.some((o) => o.id === 'abheben' && !o.done) && j && j.alive) {
      const p = j.position.clone(); p.y += 120;
      j.body.setPose(p, JET_YAW, { airborne: true, speed: 110 });
    }
    if (d.objs.some((o) => o.id === 'esk' && !o.done)) for (const h of d.get('esc') || []) if (h.alive) air.destroy(h, G.player);
    if (d.objs.some((o) => (o.id === 'pass' || o.id === 'folgen') && !o.done)) d.set('testPass', true);
  },
};
