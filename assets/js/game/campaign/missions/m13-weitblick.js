// NULLPUNKT — Kampagne, Mission 13 „Weitblick“ (Stadtkern Veldmark, Mittag): Scharfschützen-Überwachung mit Zielmarkierung.
// Die Kommission hält ihre erste öffentliche Sitzung auf dem Lindenplatz. Falk liegt mit dem Scharfschützengewehr auf
// der Dachterrasse des Kaufhauses Süd, Weber neben ihm mit dem Spektiv. Unter den Menschen auf dem Platz suchen sie drei
// Späher der Grauen Kompanie (Beschreibung per Funk) und markieren sie im Zielfernrohr für Lenz’ Zugriff – auf Zivilisten
// zu schießen beendet die Mission. Danach greifen die Söldner trotzdem an: Falk deckt Kommissarin Haas auf dem Weg in die
// U-Bahn, gewinnt das Duell mit dem feindlichen Scharfschützen auf dem Kaufhaus Nord und holt bei Lenz die Sitzordnung
// ab, die ein Späher bei sich trug – Haas erkennt die Handschrift ihres Stellvertreters Dr. Pell, der verschwunden ist.
// Checkpoints: start, spaeher, angriff, duell, platz.

import * as THREE from 'three';
import { actor } from './cast.js?v=20261123073102';
import { purgeDead } from './hilfen-b.js?v=20261123073102';
import { scopeMark, walker, arm, roofY } from './hilfen-c.js?v=20261123073102';

// Kaufhaus Süd: x −14…14, z 24…36, Dachterrasse auf 8,4 m mit Sandsäcken an der Brüstung (x −9…−4 und 1…5, z 25,3)
const NEST = [3, 25.9];        // hinter dem östlichen Sandsackwall an der Brüstung (zwischen den beiden Linden)
const WEBER = [5.6, 26.3];
const ROOF_IN = [6, 30];        // Ausstieg/Treppenhaus Ostseite (x ≈ 12, z ≈ 32)
const STAIRS = [11.6, 32];
const PODIUM = [4, -19];        // Rednerpult der Kommission auf dem Nordplatz
const UBAHN = [-10, -18.2];     // Abgang Nord (Treppe x −11,5…−8,5, z −9…−16,4)
const NORTH_ROOF = [-6.5, -26.2]; // Kaufhaus Nord, Sandsack-Stellung (gespiegelt)
const SHOPS = [[-22, -12.4], [22, -12.4], [-38, -12.4], [38, -12.4], [12, -14], [-14, -5]];
const EDGE = [[-30, -46], [0, -42], [30, -46], [-52, -20], [52, -20]];
const LENZ = [2, 6];            // Lenz am Platzrand (Treffpunkt am Ende)

/** Menschen auf dem Platz: Runden zwischen Podium, Litfaßsäule und Ständen (Nordplatz, x −7…13, z −11…−23). */
const CROWD = [
  { route: [[-6, -12], [2, -14], [-4, -20]], variant: 'zivil' },
  { route: [[8, -12], [12, -18], [6, -22]], variant: 'zivil-strick' },
  { route: [[0, -22], [-6, -20], [2, -16]], variant: 'zivil-hemd' },
  { route: [[10, -22], [6, -16], [12, -12]], variant: 'zivil-pullover' }, // 20.11.: mehr Kleidungsvielfalt (keine Warnweste,
  { route: [[-2, -11], [4, -12], [8, -11]], variant: 'zivilistin-mantel' }, // keine dunkle Jacke mit hellem Hemd – Späher bleiben eindeutig)
  { route: [[-6, -23], [0, -20], [6, -23]], variant: 'zivil-hemd' },
  { route: [[12, -20], [10, -14]], variant: 'zivilistin-pullover' },
  { route: [[-4, -16], [-6, -13]], variant: 'zivil' },
];
/** Die drei Späher (Beschreibung per Funk; Aussehen eindeutig: Warnweste bzw. dunkle Jacke mit hellem Hemd). */
const SPIES = [
  { id: 'sp1', name: 'Späher mit Warnweste', variant: 'zivil-arbeit', route: [[11, -22], [13, -16], [11, -12]], desc: 'Erster Mann: Warnweste, Arbeitsjacke. Er geht an der Ostseite auf und ab und schaut nie zum Podium.' },
  { id: 'sp2', name: 'Späher in dunkler Jacke', variant: 'kapitaen', route: [[-6, -21], [-2, -23], [-7, -18]], desc: 'Zweiter: dunkle Jacke, helles Hemd, bei der Treppe zur U-Bahn. Er zählt die Ausgänge.' },
  { id: 'sp3', name: 'Späher mit Warnweste', variant: 'zivil-arbeit', route: [[2, -11], [-3, -12], [5, -12]], desc: 'Der dritte: auch eine Warnweste, ganz vorn an der Absperrung zur Allee. Er hat ein Funkgerät in der Jackentasche.' },
];

const Y = (m) => m.get('Y') || 8.4;
const R = (m, p, lift = 0) => [p[0], Y(m) + lift, p[1]];

const CUT_INTRO = (m) => {
  const y = Y(m);
  return {
    location: ['Veldmark · Lindenplatz, Dach des Kaufhauses', '11:42 Uhr · Tag 26'],
    cast: {
      falk: actor('falk', { pos: R(m, NEST), yaw: 0, aim: -0.3, weapon: 'sr_brecher', crouch: true }),
      weber: actor('weber', { pos: R(m, WEBER), yaw: 0.2, aim: -0.5, crouch: true }),
      lenz: actor('lenz', { pos: [LENZ[0], LENZ[1]], yaw: 3.0, aim: -0.9 }),
      haas: actor('haas', { pos: [PODIUM[0], PODIUM[1]], yaw: 3.1, aim: -1.0 }),
      pell: actor('pell', { pos: [PODIUM[0] + 1.6, PODIUM[1] - 0.8], yaw: 2.8, aim: -1.0 }),
    },
    beats: [
      { cam: { from: [-40, 30, 50], to: [-20, 22, 34], look: [0, 2, -14], lookTo: [0, y, 26], ease: 'inOut' }, dur: 7, fadeIn: 1.4,
        say: { who: 'funk', text: 'Anker an alle: Sitzung der Waffenstillstandskommission beginnt um zwölf Uhr. Etwa dreihundert Menschen auf dem Lindenplatz.' } },
      { cam: { close: 'haas', side: 0.4, dist: 0.95, push: 0.1 },
        say: { who: 'haas', text: 'Wir verhandeln nicht mehr in Zelten und Kasernen. Die Menschen sollen sehen, was beschlossen wird – und wer es beschließt.', expr: 'entschlossen' } },
      { cam: { close: 'pell', side: -0.35, dist: 0.9 },
        say: { who: 'pell', text: 'Ich habe die Sitzordnung noch einmal geändert, Frau Kommissarin. Die Delegationen sitzen jetzt näher an der Allee. Wegen der Sonne.', expr: 'erleichtert' } },
      { cam: { from: [NEST[0] + 3, y + 1.6, NEST[1] + 3.5], to: [NEST[0] + 1.6, y + 1.2, NEST[1] + 1.8], look: [NEST[0], y + 0.8, NEST[1] - 4] },
        say: { who: 'weber', text: 'Spektiv steht. Ich sehe das Podium, die Allee, beide U-Bahn-Abgänge. Und sehr viele Menschen.', expr: 'angespannt' } },
      { cam: { close: 'falk', side: 0.35, dist: 0.85, push: 0.1 },
        say: { who: 'falk', text: 'Laut Vahls Rechner sind drei Späher auf dem Platz. Wir schießen nicht. Wir zeigen sie nur.', expr: 'ernst' } },
      { cam: { close: 'lenz', side: -0.35, dist: 0.9 },
        say: { who: 'lenz', text: 'Markier sie mir, Falke. Ich hole sie leise raus, einen nach dem anderen. Und wenn du dir nicht sicher bist – dann bist du dir nicht sicher.', expr: 'ernst' } },
      { cam: { from: [NEST[0] - 2, y + 3, NEST[1] + 6], to: [NEST[0] - 1, y + 2.2, NEST[1] + 3], look: [0, 1.5, -16] }, dur: 4, fadeOut: 1.2,
        say: { who: 'brandt', text: 'Weitblick, Falke. Mehr brauchst du heute nicht.' } },
    ],
  };
};

const CUT_OUTRO = (m) => ({
  location: ['Lindenplatz · U-Bahn-Abgang Süd', '12:37 Uhr'],
  cast: {
    falk: actor('falk', { pos: [LENZ[0] - 0.8, LENZ[1] + 1.2], yaw: 2.6, aim: -0.6, weapon: 'sr_brecher' }),
    lenz: actor('lenz', { pos: [LENZ[0] + 0.9, LENZ[1] - 0.2], yaw: -0.6, aim: -0.9 }),
    weber: actor('weber', { pos: [LENZ[0] - 1.8, LENZ[1] - 0.6], yaw: 1.2, aim: -0.7 }),
    haas: actor('haas', { pos: [LENZ[0] + 0.2, LENZ[1] - 1.6], yaw: 0.3, aim: -1.0 }),
  },
  beats: [
    { cam: { from: [LENZ[0] + 14, 9, LENZ[1] + 12], to: [LENZ[0] + 7, 5, LENZ[1] + 7], look: [LENZ[0], 1.5, LENZ[1]] }, dur: 6, fadeIn: 1.2,
      say: { who: 'funk', text: 'Anker: Lindenplatz gesichert. Keine Toten unter den Zivilisten. Drei Späher und elf Söldner in Gewahrsam.' } },
    { cam: { close: 'lenz', side: 0.4, dist: 0.9 },
      say: { who: 'lenz', text: 'Der Mann mit dem Funkgerät hatte das hier in der Tasche. Die Sitzordnung. Mit Kreuzen an den Plätzen der Delegationen.', expr: 'ernst' } },
    { cam: { close: 'haas', side: -0.35, dist: 0.9, push: 0.12 },
      say: { who: 'haas', text: 'Das ist nicht die Fassung, die wir verteilt haben. Das ist die geänderte. Und das ist Ansgars Handschrift.', expr: 'traurig' } },
    { cam: { close: 'weber', side: 0.35, dist: 0.95 },
      say: { who: 'weber', text: 'Dr. Pell ist nicht in der U-Bahn angekommen. Er ist beim ersten Schuss in den Hauseingang am Nordplatz gegangen – und dann war er weg.', expr: 'angespannt' } },
    { cam: { close: 'falk', side: -0.3, dist: 0.9 },
      say: { who: 'falk', text: 'Er wusste, wo sie sitzen würden. Weil er sie dorthin gesetzt hat.', expr: 'ernst' } },
    { cam: { close: 'haas', side: 0.3, dist: 0.85 },
      say: { who: 'haas', text: 'Dann unterschreiben wir den Grenzvertrag nicht hier. Sondern dort, wo der Krieg die tiefsten Spuren hinterlassen hat – in der Kapellenruine im Niemandsland. Morgen Abend.', expr: 'entschlossen' } },
    { cam: { over: ['lenz', 'haas'] }, dur: 4.5, fadeOut: 1.4,
      say: { who: 'lenz', text: 'Dann graben wir uns dort ein. Und diesmal kommen sie zu uns.', expr: 'entschlossen' } },
  ],
});

/** Spieler auf die Dachterrasse stellen (Checkpoint-Punkt mit Dachhöhe). */
function toRoof(m, p) {
  const v = new THREE.Vector3(p[0], Y(m) + 0.05, p[1]);
  if (m.spawnPoint) m.spawnPoint.position.copy(v);
  return v;
}

function crowd(m) {
  const list = m.get('crowd') || [];
  for (const x of list) if (x && !x.removed) x.remove();
  // Handy (quality low): weniger Menschen auf dem Platz (jede Figur ist ein volles Soldaten-Rig)
  const lowQ = m.G.renderer && m.G.renderer.quality === 'low';
  const out = CROWD.slice(0, lowQ ? 5 : CROWD.length).map((c, i) => walker(m, `ziv${i}`, { route: c.route, variant: c.variant, name: 'Passant', speed: 1.0 + (i % 3) * 0.15, pause: 1.5 + (i % 4) }));
  m.set('crowd', out);
  return out;
}

/** Menschen fliehen: zum Abgang bzw. aus dem Bild, dann entfernen. */
function flee(m) {
  const list = (m.get('crowd') || []).concat(m.get('spies') || []);
  list.forEach((x, i) => {
    if (!x || x.removed) return;
    if (x.stopWalk) x.stopWalk();
    const goal = i % 3 === 0 ? UBAHN : i % 3 === 1 ? [-30, -2] : [30, -2];
    x.walk([goal], 3.2);
    let t = 0;
    m.every((dt) => { t += dt; if (x.removed) return true; if (!x.a.path || t > 12) { x.remove(); return true; } return false; });
  });
}

export const MISSION_13 = {
  id: 'm13',
  number: 13,
  act: 3,
  title: 'Weitblick',
  short: 'Weitblick',
  map: 'stadtkern',
  time: 'mittag',
  weather: 'dunst',
  type: 'Scharfschütze · Überwachung · Zielmarkierung',
  summary: 'Die Kommission tagt öffentlich auf dem Lindenplatz. Finde vom Dach aus die Späher der Grauen Kompanie in der Menge, markiere sie im Zielfernrohr und deck Kommissarin Haas, als der Angriff kommt.',
  loadoutHint: 'Zielfernrohr: rechte Maustaste. Markieren: Ziel im Visier halten, bis der Balken voll ist. Nicht auf Zivilisten schießen.',
  loadout: { primary: 'sr_brecher', secondary: 'pi_p9' },
  mapVehicles: false,
  cutscenes: { intro: (m) => CUT_INTRO(m), outro: (m) => CUT_OUTRO(m) },

  prepare(m) {
    m.set('Y', roofY(m, NEST[0], NEST[1], 30));
    purgeDead(m);
    // Checkpoints auf dem Dach: Höhe der Dachterrasse statt Straßenniveau
    const set = m._setSpawn.bind(m);
    m._setSpawn = (cp) => { set(cp); if (cp && cp.roof) toRoof(m, cp.at); };
    const st = m.mission.stages[m.startIndex];
    if (st && st.checkpoint && st.checkpoint.roof) toRoof(m, st.checkpoint.at);
    m.allies([
      { role: 'lenz', name: 'Fw. Lenz', at: LENZ },
      { role: 'hofer', name: 'San. Hofer', at: [LENZ[0] + 2, LENZ[1] + 1] },
      { name: 'Gefr. Albrecht', at: [LENZ[0] - 2, LENZ[1] + 1] },
      { name: 'Gefr. Kuhn', at: [LENZ[0] + 4, LENZ[1] + 0.5] },
    ]);
    m.order('hold', LENZ);
  },

  stages: [
    {
      id: 'start',
      checkpoint: { at: NEST, yaw: 0, roof: true },
      *run(m) {
        yield m.cutsceneAt('intro');
        m.introduce('waffe', 'sr_brecher', 'Brecher .338: Repetierer mit Zielfernrohr. Ein Schuss, ein Treffer – und jeder Fehler hat Folgen.');
        const w = m.extra('weber-dach', { pos: R(m, WEBER), yaw: 0.2, variant: 'funker', weapon: 'ar_m17', name: 'OGefr. Weber', crouch: true, aim: -0.5, top: true });
        m.set('weberDach', w);
        m.tip('Zielfernrohr: rechte Maustaste (Gamepad LT). Atem anhalten: Sprinttaste beim Zielen.', 6);
        yield m.reach('nest', 'Bezieh Stellung an der Brüstung', { at: R(m, NEST), r: 2.5, label: 'Stellung' });
        m.say('weber', 'Gut so. Von hier siehst du den ganzen Nordplatz. Die Sitzung beginnt gleich.', { expr: 'nachdenklich' });
        yield 1;
      },
    },
    {
      id: 'spaeher',
      checkpoint: { at: NEST, yaw: 0, roof: true },
      setup(m) { if (!m.extras.has('weber-dach')) m.extra('weber-dach', { pos: R(m, WEBER), yaw: 0.2, variant: 'funker', weapon: 'ar_m17', name: 'OGefr. Weber', crouch: true, aim: -0.5, top: true }); },
      *run(m) {
        m.clearObjectives();
        crowd(m);
        const spies = SPIES.map((s) => walker(m, s.id, { route: s.route, variant: s.variant, name: s.name, speed: 1.0, pause: 2.5, failText: 'Ein unbewaffneter Mann wurde erschossen. Wir zeigen die Späher nur – den Zugriff macht Lenz.' }));
        m.set('spies', spies);
        m.extra('haas', { pos: PODIUM, yaw: 3.1, variant: 'zivil-strick', name: 'Kommissarin Haas', aim: -1.0, protect: true, failText: 'Kommissarin Haas wurde getroffen.' });
        m.extra('pell', { pos: [PODIUM[0] + 1.6, PODIUM[1] - 0.8], yaw: 2.8, variant: 'zivil-hemd', name: 'Dr. Pell', aim: -1.0, protect: true, failText: 'Dr. Pell wurde getroffen. Wir schießen nur, wenn wir sicher sind.' });
        m.say('haas', 'Bürgerinnen und Bürger von Veldmark – drei Wochen Waffenruhe sind kein Frieden. Aber sie sind ein Anfang.', { radio: true });
        m.tip('Nicht schießen! Späher im Zielfernrohr anvisieren und halten, bis sie markiert sind.', 6);
        m.objective('ruhe', 'Nicht auf Menschen auf dem Platz schießen', { optional: true });
        for (let i = 0; i < SPIES.length; i++) {
          const s = SPIES[i], x = spies[i];
          m.say('weber', s.desc, { expr: 'angespannt' });
          yield 1.5;
          yield scopeMark(m, `mark${i}`, `Markiere ${s.name.replace('Späher', 'den Späher')}`, [{ key: s.id, name: s.name, pos: () => (x.removed ? null : x.a.pos.clone().setY(x.a.pos.y + 1.35)) }], { secs: 1.4, cone: 0.03 });
          m.say('lenz', i < 2 ? 'Hab ihn. Wir nehmen ihn am Rand, ganz ruhig.' : 'Der Letzte. Zugriff – jetzt!', { radio: true, expr: 'ernst' });
          // Lenz’ Leute holen ihn ab: er geht zur Allee und verschwindet aus dem Bild
          if (x.stopWalk) x.stopWalk();
          x.walk([[x.a.pos.x > 0 ? 30 : -30, -2]], 1.4);
          let t = 0;
          m.every((dt) => { t += dt; if (x.removed) return true; if (t > 9) { x.remove(); return true; } return false; });
          yield 2.5;
        }
        m.done('ruhe', { quiet: true });
        m.say('weber', 'Alle drei sind weg. Aber der mit dem Funkgerät hat noch gesendet, bevor Lenz ihn hatte. Zwei Worte: „Jetzt sofort“.', { expr: 'angespannt' });
        yield 2;
      },
    },
    {
      id: 'angriff',
      checkpoint: { at: NEST, yaw: 0, roof: true },
      *run(m) {
        m.clearObjectives();
        if (!m.get('crowd')) crowd(m);
        if (!m.extras.has('haas')) m.extra('haas', { pos: PODIUM, yaw: 3.1, variant: 'zivil-strick', name: 'Kommissarin Haas', aim: -1.0, protect: true, failText: 'Kommissarin Haas wurde getroffen.' });
        const haas = m.extras.get('haas');
        haas.protect = true;
        haas.failText = 'Kommissarin Haas wurde getroffen.';
        flee(m);
        const pell = m.extras.get('pell');
        if (pell) { pell.walk([[-22, -12.4]], 3); let t = 0; m.every((dt) => { t += dt; if (pell.removed) return true; if (t > 6) { pell.remove(); return true; } return false; }); }
        m.wave('a1', { count: 6, at: SHOPS, hold: true });
        m.wave('a2', { count: 4, at: EDGE, attack: PODIUM, radius: 7 });
        m.say('grau', 'Alle Gruppen: Platz nehmen. Ziel ist das Podium.', { radio: true });
        m.say('lenz', 'Schüsse aus den Läden am Nordplatz! Falke, wir bringen Haas zur U-Bahn – halt uns die Fenster frei!', { expr: 'angespannt' });
        m.order('attack', PODIUM);
        // Haas geht zum Abgang; stehen Söldner zu lange bei ihr, ist sie verloren
        yield 2;
        haas.walk([[0, -16], UBAHN], 1.6);
        m.objective('haas', 'Deck Kommissarin Haas auf dem Weg zur U-Bahn', { pos: () => (haas.removed ? null : haas.a.pos), label: 'Haas', progress: 1 });
        let danger = 0;
        m.every((dt) => {
          if (haas.removed) return true;
          let near = 0;
          for (const b of m.G.actors) if (b.alive && b.team === 'B' && b.position.distanceTo(haas.a.pos) < 7) near++;
          danger = near ? danger + dt * near : Math.max(0, danger - dt);
          m.bar('haas', 1 - danger / 10);
          if (danger >= 10) { m.fail('Die Söldner haben Kommissarin Haas erreicht.'); return true; }
          return false;
        });
        yield () => haas.removed || !haas.a.path;
        if (!haas.removed) haas.remove();
        m.done('haas');
        m.say('hofer', 'Haas ist unten in der U-Bahn! Sie ist unverletzt!', { expr: 'erleichtert' });
        yield m.killObjective('ak', 'Schalte die Angreifer am Nordplatz aus', ['a1', 'a2']);
        m.say('weber', 'Wo ist Dr. Pell? Er war eben noch am Podium …', { expr: 'fragend' });
        yield 1.5;
      },
    },
    {
      id: 'duell',
      checkpoint: { at: NEST, yaw: 0, roof: true },
      *run(m) {
        m.clearObjectives();
        const yN = roofY(m, NORTH_ROOF[0], NORTH_ROOF[1], 30);
        const w = m.wave('sniper', { count: 1, scale: false, at: [[NORTH_ROOF[0], yN + 0.1, NORTH_ROOF[1]]], hold: true });
        for (const b of w.bots) arm(b, 'sr_brecher');
        m.wave('dachN', { count: 2, at: [[NORTH_ROOF[0] + 8, yN + 0.1, NORTH_ROOF[1]], [NORTH_ROOF[0] + 4, yN + 0.1, NORTH_ROOF[1] - 3]], hold: true });
        m.say('weber', 'Blitz auf dem Kaufhaus gegenüber! Scharfschütze, Dachterrasse Nord – runter, Falke!', { expr: 'angespannt' });
        m.tip('Nicht zu lange über die Brüstung schauen. Ducken, Stellung wechseln, wieder hoch.', 6);
        yield m.killObjective('sk', 'Schalte den Scharfschützen auf dem Kaufhaus Nord aus', ['sniper', 'dachN'], { pos: [NORTH_ROOF[0], yN + 1.4, NORTH_ROOF[1]], label: 'Scharfschütze' });
        m.say('weber', 'Treffer. Das Dach ist leer.', { expr: 'erleichtert' });
        m.say('lenz', 'Komm runter auf den Platz, Falke. Das hier musst du sehen.', { radio: true });
        yield 1;
      },
    },
    {
      id: 'platz',
      checkpoint: { at: ROOF_IN, yaw: -1.57, roof: true },
      setup(m) { m.order('hold', LENZ); },
      *run(m) {
        m.clearObjectives();
        m.order('hold', LENZ);
        const wd = m.extras.get('weber-dach');
        if (wd) wd.remove();
        m.tip('Treppenhaus an der Ostseite des Daches.', 5);
        m.objective('treppe', 'Steig über das Treppenhaus hinunter', { pos: R(m, STAIRS, 0.2), label: 'Treppenhaus' });
        yield () => { const P = m.G.player; if (P.position.y < Y(m) - 3 || Math.hypot(P.position.x - LENZ[0], P.position.z - LENZ[1]) < 8) { m.done('treppe'); return true; } return false; };
        m.wave('rest', { count: 3, at: [[-30, -46], [30, -46], [0, -42]], attack: 'player', radius: 8 });
        yield m.reach('lenz', 'Triff Lenz am Platzrand', { at: LENZ, r: 4, label: 'Lenz' });
        yield m.killObjective('rk', 'Wehre die letzten Söldner ab', 'rest');
        yield 1;
        m.complete();
      },
    },
  ],

  /** Testlauf (run.js): Markierung erzwingen, Haas sofort in die U-Bahn. */
  _test(d) {
    const h = d.extras.get('haas');
    if (h && h.protect && h.a.path) { h.a.place(UBAHN, 0); h.a.path = null; }
    for (const o of d.objs) if (/^mark\d$/.test(o.id) && !o.done) { o.count = 1; d.done(o.id, { quiet: true }); }
    if (d.objs.some((o) => o.id === 'treppe' && !o.done) && d.G.campaign) d.G.campaign.teleport(LENZ);
  },
};
