// NULLPUNKT — Kampagne, Mission 11 „Stadtkern“ (Karte stadtkern; Rückfall: Altstadt): Finale von Akt II mit offenem Ende.
// Kessar hat sich im Funkhaus von Veldmark verschanzt, mitten im dichten Stadtkern. Der Trupp (Falk führt, Lenz und
// Daren dabei) bringt unterwegs Zivilisten aus der Schusslinie, kämpft sich über den Platz und durch das Funkhaus und
// stellt Kessar, der sich ergibt. Brandt und Daren verkünden über den Sender die Fortsetzung der Waffenruhe – dann meldet
// sich auf der offenen Frequenz eine fremde Stimme: „Phase zwei beginnt.“ (Cliffhanger: Akt III folgt mit einem Update.)
// Checkpoints: start, platz, funkhaus, kessar.
//
// Koordinaten je Karte (COORDS): „stadtkern“ (Strang karten-neu) nur, wenn die Karte existiert UND Koordinaten hat.

import * as THREE from 'three';
import { actor } from './cast.js?v=20261122020853';
import { mapFor, purgeDead, prop, ostbund, guardZone, stopGuard } from './hilfen-b.js?v=20261122020853';

const COORDS = {
  // Stadtkern „Lindenplatz“ (karten-neu): Team A Süd (+z, Hinterstraße z ≈ 51), Lindenallee bei z 0, Kaufhaus Nord
  // (x −14…14, z −24…−36, 2 Geschosse, Dachterrasse) = Funkhaus; Kessar auf dem Dach (roof: true → Höhe aus dem Gelände).
  stadtkern: {
    place: 'Veldmark · Lindenplatz',
    start: [-2, 51.5], startYaw: 0,
    gasse: [-8, 41],
    civ: [{ at: [-6, 20], yaw: 2.6 }, { at: [10, 21], yaw: -2.4 }],
    platz: [0, 5],
    platzFoes: [[-22, -12.4], [22, -12.4], [0, -16], [-38, -12.4], [38, -12.4], [-14, -5], [12, -14], [-30, -30]],
    platzFlank: [[52, 0], [48, -20], [-52, 0]],
    tor: [5.5, -20],
    gang: [12, -18],
    haus: [2, -29], hausYaw: 3.1,
    inside: [[-8, -29], [6, -31], [-11, -27], [10, -33], [0, -33], [-4, -26]],
    kessar: [-4, -30], kessarYaw: 0, roof: true,
    sender: [-9, -31],
  },
  altstadt: {
    place: 'Veldmark · Altstadtviertel',
    start: [4.5, 47], startYaw: 0,
    gasse: [-1, 21],
    civ: [{ at: [10.5, 7], yaw: 2.4 }, { at: [-12.6, 17.6], yaw: -0.8 }], // Gruppen, die in Deckung gebracht werden
    civHome: [[17, 18], [-21, 26.5]],
    platz: [-2, 2],
    platzFoes: [[12, -6], [22, 9], [8, -20], [26, -16], [10, 14], [-10, -6], [3, -31], [17, -20]],
    platzFlank: [[40, -12], [42, 6], [36, -24]],
    tor: [-21.5, 2.5],
    gang: [-31.5, -16],
    haus: [-21.5, -36.5], hausYaw: 1.6,
    inside: [[-20, -30], [-10, -26], [-30, -24], [-34, -38], [-14, -36]],
    kessar: [-14.5, -38], kessarYaw: 1.2,
    sender: [-17, -36],
  },
};

const MAPID = mapFor('stadtkern', 'altstadt', COORDS);
const C = (m) => m.get('C') || COORDS[MAPID];

/** Notlösung für eine Karte ohne Koordinaten (Ablauf entlang Start A → Start B). */
function auto(G) {
  const w = G.world;
  const avg = (list) => { const v = new THREE.Vector3(); if (!list || !list.length) return v; for (const s of list) v.add(s.position || new THREE.Vector3(s.x, 0, s.z)); return v.multiplyScalar(1 / list.length); };
  const a = avg(w && w.spawns && w.spawns.A), b = avg(w && w.spawns && w.spawns.B);
  const L = (t, s = 0) => { const d = b.clone().sub(a); const n = new THREE.Vector3(-d.z, 0, d.x).normalize(); const p = a.clone().addScaledVector(d, t).addScaledVector(n, s); return [Math.round(p.x), Math.round(p.z)]; };
  return {
    place: 'Veldmark · Stadtkern', start: L(0), startYaw: Math.atan2(-(b.x - a.x), -(b.z - a.z)), gasse: L(0.2),
    civ: [{ at: L(0.25, 6), yaw: 0 }, { at: L(0.35, -6), yaw: 0 }], civHome: [L(0.15, 8), L(0.3, -8)],
    platz: L(0.45), platzFoes: [L(0.5, 6), L(0.55, -6), L(0.6, 0), L(0.52, 10), L(0.58, -10)], platzFlank: [L(0.5, 20), L(0.55, -20)],
    tor: L(0.65), gang: L(0.75), haus: L(0.85), hausYaw: 0, inside: [L(0.86, 3), L(0.88, -3), L(0.9, 0), L(0.84, 5)],
    kessar: L(0.92), kessarYaw: 0, sender: L(0.9, 2),
  };
}

const CUT_INTRO = (m) => {
  const c = C(m);
  const [x, z] = c.start;
  return {
    location: [c.place, '06:20 Uhr · Tag 24'],
    cast: {
      brandt: actor('brandt', { pos: [x + 1.6, z - 0.4], yaw: 1.7, aim: -0.9 }),
      daren: actor('daren', { pos: [x + 0.4, z + 1.4], yaw: 3.0, aim: -1.0 }),
      lenz: actor('lenz', { pos: [x - 1.6, z + 0.6], yaw: -1.6, aim: -1.2 }),
      falk: actor('falk', { pos: [x - 0.6, z - 1.6], yaw: -0.3, aim: -0.6 }),
      weber: actor('weber', { pos: [x + 2.2, z + 1.6], yaw: 2.4, crouch: true, aim: -0.7 }),
    },
    beats: [
      { cam: { from: [x - 30, 22, z + 26], to: [x - 14, 12, z + 14], look: [x, 3, z - 30], lookTo: [x, 1.4, z] }, dur: 7, fadeIn: 1.6,
        say: { who: 'funk', text: 'Anker an alle: Das Funkhaus von Veldmark ist besetzt. Kessar hält die Belegschaft fest. Die Straßen füllen sich – die Stadt geht zur Arbeit.' } },
      { cam: { close: 'daren', side: 0.4, dist: 0.9, push: 0.1 },
        say: { who: 'daren', text: 'Ich kenne Kessar seit zwanzig Jahren. Er schießt nicht, solange er glaubt, noch reden zu können. Lassen Sie ihn nicht reden.', expr: 'ernst' } },
      { cam: { close: 'brandt', side: -0.35, dist: 0.9 },
        say: { who: 'brandt', text: 'Wir brauchen ihn lebend. Vor einem Gericht – nicht als Märtyrer für seine Anhänger.', expr: 'entschlossen' } },
      { cam: { close: 'lenz', side: 0.35, dist: 0.9 },
        say: { who: 'lenz', text: 'Falke, du führst. Ich folge dir diesmal.', expr: 'erleichtert' } },
      { cam: { close: 'falk', side: -0.3, dist: 0.85, push: 0.1 },
        say: { who: 'falk', text: 'Dann bleiben wir zusammen. Erst die Leute aus der Schusslinie, dann das Funkhaus.', expr: 'entschlossen' } },
      { cam: { close: 'weber', side: 0.4, dist: 0.95 },
        say: { who: 'weber', text: 'Kessar spricht auf einer zweiten Frequenz mit jemandem. Verschlüsselt – aber nicht mit seinem eigenen Schlüssel.', expr: 'nachdenklich' } },
      { cam: { over: ['falk', 'brandt'] },
        say: { who: 'brandt', text: 'Darum kümmern wir uns, wenn er in Gewahrsam ist. Geht.', expr: 'entschlossen' } },
      { cam: { from: [x + 6, 2.2, z + 6], to: [x + 7, 3, z + 9], look: [x, 1.4, z], lookTo: [x - 2, 1.6, z - 14] }, dur: 3.5, fadeOut: 1.0,
        act: [{ who: 'falk', walk: [[x - 1, z - 8], [x - 2, z - 14]], speed: 2.4, at: 0.3 }, { who: 'lenz', walk: [[x - 2.5, z - 7], [x - 3.5, z - 12]], speed: 2.0, at: 0.8 }, { who: 'daren', walk: [[x + 0.5, z - 7], [x, z - 12]], speed: 2.0, at: 1.1 }] },
    ],
  };
};

const CUT_OUTRO = (m) => {
  const c = C(m);
  const [kx, kz] = c.kessar;
  const [sx, sz] = c.sender;
  const Y = c.Y || 0, top = !!c.roof;
  const cam = (p) => [p[0], p[1] + Y, p[2]];
  return {
    location: ['Funkhaus', '06:58 Uhr'],
    cast: {
      kessar: actor('kessar', { pos: [kx, kz], yaw: c.kessarYaw, aim: -1.2, weapon: null, top }),
      falk: actor('falk', { pos: [kx - 2.2, kz + 1.4], yaw: c.kessarYaw - 2.6, aim: -0.9, top }),
      daren: actor('daren', { pos: [kx - 1.2, kz + 2.8], yaw: c.kessarYaw - 2.9, aim: -1.0, top }),
      lenz: actor('lenz', { pos: [kx - 3.4, kz - 0.4], yaw: c.kessarYaw - 2.2, aim: -1.2, top }),
      weber: actor('weber', { pos: [sx, sz + 2.2], yaw: 0.4, crouch: true, aim: -0.7, top }),
      brandt: actor('brandt', { pos: [sx + 1.4, sz + 2.6], yaw: -0.6, aim: -0.9, top }),
    },
    beats: [
      { cam: { from: cam([kx - 9, 3.2, kz + 7]), to: cam([kx - 7, 2.6, kz + 5]), look: cam([kx - 1, 1.4, kz + 1]) }, dur: 5, fadeIn: 1.2,
        say: { who: 'kessar', text: 'Sie glauben, Sie hätten gewonnen, Unteroffizier. Sie haben einen einzigen Mann verhaftet.', expr: 'ernst' } },
      { cam: { close: 'falk', side: 0.35, dist: 0.9 },
        say: { who: 'falk', text: 'Einen Mann, der sich vor einem Gericht verantworten wird. Das genügt für heute.', expr: 'entschlossen' } },
      { cam: { over: ['daren', 'kessar'] },
        say: { who: 'daren', text: 'Radan. Es ist vorbei. Deine Leute sind nach Hause gegangen.', expr: 'traurig' } },
      { cam: { close: 'kessar', side: -0.4, dist: 0.85, push: 0.12 },
        say: { who: 'kessar', text: 'Meine Leute? Ilja, du verstehst es immer noch nicht. Ich war nie derjenige, der bezahlt hat.', expr: 'nachdenklich' } },
      { cam: { close: 'lenz', side: 0.4, dist: 0.9 },
        act: [{ who: 'lenz', look: 'kessar' }],
        say: { who: 'lenz', text: 'In seiner Jacke: ein Notizbuch. Zahlungen, Daten, Treffpunkte. Und immer derselbe Absender – „Kranich“.', expr: 'angespannt' } },
      { cam: { from: cam([sx + 6, 2.4, sz + 6]), to: cam([sx + 4.5, 2.2, sz + 5]), look: cam([sx + 0.6, 1.4, sz + 2.4]) }, loc: false,
        say: { who: 'daren', text: 'Hier spricht Major Ilja Daren, Ostbund, Dritte Grenzbrigade. An alle Einheiten beider Seiten.' } },
      { cam: { close: 'brandt', side: 0.35, dist: 0.9, push: 0.1 },
        say: { who: 'brandt', text: 'Und Hauptmann Elias Brandt, Nordkorps. Die Waffenruhe gilt – für beide Seiten, ab sofort und ohne Ausnahme. Niemand schießt, der nicht muss.', expr: 'entschlossen' } },
      { cam: { close: 'weber', side: -0.4, dist: 0.95 },
        say: { who: 'weber', text: 'Herr Hauptmann … jemand ist auf unserer offenen Frequenz. Kein Rufzeichen. Das Signal kommt nicht aus dem Tal.', expr: 'angespannt' } },
      { cam: { close: 'falk', side: 0.3, dist: 1.0, push: 0.15 },
        say: { who: 'kranich', text: 'Kessar ist gescheitert. Das war vorhersehbar. Phase zwei beginnt.' } },
      { cam: { close: 'brandt', side: -0.3, dist: 0.85 },
        say: { who: 'brandt', text: 'Wer spricht da? Melden Sie sich!', expr: 'fragend' }, fadeOut: 1.6 },
      { cam: { from: cam([sx + 6, 6, sz + 10]), to: cam([sx + 8, 12, sz + 16]), look: cam([sx, 1.5, sz]) }, card: ['Ende von Akt II · Feuer im Tal', 'Die Geschichte geht weiter', 'Akt III · Phase zwei – Mission 12 „Nachtsicht“'], dur: 6, fadeIn: 1.2 },
    ],
  };
};

/** Zivilisten-Gruppe (zwei Figuren, geduckt) und Ziel „in Deckung bringen“. */
function civGroup(m, g, i) {
  const [x, z] = g.at;
  return [
    prop(m, { role: 'zivil', name: 'Einwohner', team: 'A', variant: 'zivil', weapon: null, at: [x, z], yaw: g.yaw, crouch: true, aim: -1.0, protect: true }),
    prop(m, { role: 'zivil', name: 'Einwohnerin', team: 'A', variant: i ? 'zivil-hemd' : 'zivil-strick', weapon: null, at: [x + 0.9, z + 0.6], yaw: g.yaw + 0.4, crouch: true, aim: -1.1, protect: true }),
  ];
}

export const MISSION_11 = {
  id: 'm11',
  number: 11,
  title: 'Stadtkern',
  short: 'Stadtkern',
  map: MAPID,
  time: 'morgen',
  weather: 'morgennebel',
  type: 'Finale · Häuserkampf · Festnahme',
  summary: 'Kessar hat sich im Funkhaus von Veldmark verschanzt. Bring die Menschen auf der Straße in Sicherheit, kämpf dich über den Platz und durch das Funkhaus – und nimm Kessar lebend fest.',
  finale: true,
  cutscenes: { intro: (m) => CUT_INTRO(m), outro: (m) => CUT_OUTRO(m) },

  prepare(m) {
    const G = m.G;
    const id = G.match && G.match.mapId;
    m.set('C', COORDS[id] || auto(G));
    { const c0 = m.get('C'); c0.Y = 0; if (c0.roof && G.world && G.world.groundHeight) { const y = G.world.groundHeight(c0.kessar[0], c0.kessar[1], 40); if (Number.isFinite(y)) c0.Y = y; } }
    if (!COORDS[id]) console.warn(`[Kampagne] M11: keine Koordinaten für Karte ${id} – Notablauf aus den Startpunkten`);
    const c = C(m);
    const [x, z] = c.start;
    m.allies([
      { role: 'lenz', name: 'Fw. Lenz', at: [x - 2, z + 1] },
      { role: 'weber', name: 'OGefr. Weber', at: [x + 2, z + 1] },
      { role: 'daren', name: 'Maj. Daren', at: [x, z + 2.5] },
      { name: 'Gefr. Albrecht', at: [x - 3.5, z + 2] },
      { name: 'Gefr. Kuhn', at: [x + 3.5, z + 2] },
    ]);
    const d = m.ally('daren');
    if (d) ostbund(m, d);
    m.order('follow');
    purgeDead(m);
  },

  stages: [
    {
      id: 'start',
      checkpoint: { at: COORDS[MAPID].start, yaw: COORDS[MAPID].startYaw },
      *run(m) {
        const c = C(m);
        yield m.cutsceneAt('intro');
        m.order('follow');
        const groups = c.civ.map((g, i) => civGroup(m, g, i));
        m.wave('s1', { count: 4, at: [c.platzFoes[0], c.platzFoes[4], c.platzFoes[1], c.platzFoes[5]], attack: c.gasse, radius: 8 });
        yield m.reach('gasse', 'Rücke in die Gasse vor', { at: c.gasse, r: 6, label: 'Gasse' });
        m.say('lenz', 'Zivilisten, da vorn an der Hauswand! Bring sie in den Hausflur, wir halten die Straße!', { expr: 'angespannt' });
        m.objective('ziv', 'Zivilisten in Sicherheit gebracht', { total: c.civ.length, quiet: true });
        m.progress('ziv', 0, c.civ.length);
        for (let i = 0; i < c.civ.length; i++) {
          yield m.holdZone(`ziv${i}`, 'Bring die Menschen aus der Schusslinie', { at: c.civ[i].at, r: 3, secs: 4, label: 'Zivilisten', action: 'Leute in den Hausflur schicken' });
          for (const p of groups[i]) if (p) p.remove();
          m.progress('ziv', i + 1, c.civ.length);
          m.say('daren', i ? 'Sie sind drin. Gut so.' : 'Ruhig, ruhig – hier hinein, und weg von den Fenstern.', { expr: 'ernst' });
        }
        m.done('ziv');
        yield m.killObjective('s1k', 'Wehre die Streife ab', 's1');
        yield 1;
      },
    },
    {
      id: 'platz',
      checkpoint: { at: COORDS[MAPID].gasse, yaw: COORDS[MAPID].startYaw },
      setup(m) { m.order('follow'); },
      *run(m) {
        const c = C(m);
        m.clearObjectives();
        m.say('weber', 'Der Platz liegt zwischen uns und dem Funkhaus. Sie haben Schützen auf den Dächern.');
        m.wave('p1', { count: 8, at: c.platzFoes, attack: c.platz, radius: 9 });
        yield m.reach('platz', 'Kämpf dich über den Platz', { at: c.platz, r: 8, label: 'Platz' });
        m.order('spread', c.platz);
        m.wave('p2', { count: 4, at: c.platzFlank, attack: 'player', radius: 7 });
        m.say('lenz', 'Flanke rechts! Daren, mit mir – Falke, du nimmst die Mitte!', { expr: 'angespannt' });
        m.say('kessar', 'Hier spricht Oberst Kessar. Wer das Funkhaus betritt, ist für jeden Toten darin verantwortlich.', { radio: true });
        yield m.killObjective('pk', 'Säubere den Platz', ['p1', 'p2']);
        m.say('daren', 'Er droht nur. Er braucht die Leute im Haus lebend – sonst hört ihm niemand mehr zu.', { expr: 'ernst' });
        yield 1.5;
      },
    },
    {
      id: 'funkhaus',
      checkpoint: { at: COORDS[MAPID].platz, yaw: 1.2 },
      setup(m) { m.order('follow'); },
      *run(m) {
        const c = C(m);
        m.clearObjectives();
        m.order('follow');
        m.wave('g1', { count: 4, at: [c.tor, c.gang, [c.gang[0] + 3, c.gang[1] + 6], [c.tor[0] - 6, c.tor[1]]], hold: true });
        yield m.reach('tor', 'Stoß durch das Tor zum Funkhaus vor', { at: c.tor, r: 5, label: 'Tor' });
        yield m.killObjective('g1k', 'Brich den Widerstand am Tor', 'g1');
        m.zone('funkhaus', { at: c.haus, r: 9 });
        m.wave('innen', { count: 6, at: c.inside, hold: true });
        m.wave('nach', { count: 4, at: [c.platzFoes[2], c.platzFoes[6], c.platzFoes[7]], attack: 'player', radius: 6 });
        yield m.reach('haus', 'Dringe ins Funkhaus ein', { at: c.haus, r: 6, label: 'Funkhaus' });
        m.say('weber', 'Belegschaft im Keller eingeschlossen – sie klopfen! Kessar muss oben am Sender sein.', { expr: 'angespannt' });
        m.objective('halten', 'Die Belegschaft darf nicht in Gefahr geraten', { pos: c.haus, label: 'Funkhaus', progress: 1, optional: true });
        guardZone(m, 'funkhaus', { secs: 14, bar: 'halten', warn: ['lenz', 'Sie wollen zurück ins Haus! Haltet den Eingang!'], fail: 'Kessars Leute haben das Funkhaus zurückerobert.' });
        yield m.killObjective('ik', 'Säubere das Funkhaus Raum für Raum', ['innen', 'nach']);
        stopGuard(m, 'funkhaus');
        m.done('halten', { quiet: true });
        yield 1;
      },
    },
    {
      id: 'kessar',
      checkpoint: { at: COORDS[MAPID].haus, yaw: COORDS[MAPID].hausYaw },
      setup(m) { m.order('follow'); },
      *run(m) {
        const c = C(m);
        m.clearObjectives();
        m.order('hold');
        const k = prop(m, { role: 'kessar', at: c.kessar, yaw: c.kessarYaw, aim: -1.2, weapon: null, top: !!c.roof, protect: true, failText: 'Kessar wurde getroffen. Ohne seine Aussage bleibt die Wahrheit im Dunkeln – wir brauchen ihn lebend.' });
        if (c.roof) {
          const roofAt = [c.kessar[0], (c.Y || 0) + 0.1, c.kessar[1]];
          m.zone('dach', { at: roofAt, r: 9, h: 2.5 });
          m.objective('dach', 'Steig über das Treppenhaus aufs Dach', { pos: roofAt, label: 'Dach' });
          m.say('weber', 'Er ist oben auf dem Dach, am Sendemast! Treppenhaus an der Ostseite!', { expr: 'angespannt' });
          yield () => m.inZone('dach');
          m.done('dach');
        }
        m.wave('leib', { count: 3, at: [[c.kessar[0] + 2.5, c.kessar[1] + 1.5], [c.kessar[0] - 2.5, c.kessar[1] + 1], [c.kessar[0], c.kessar[1] + 3]], hold: true });
        m.say('lenz', 'Da ist er – mit zwei, drei Mann Leibwache. Nicht auf Kessar schießen, Falke! Nur die Wachen!', { expr: 'angespannt' });
        m.tip('Kessar ist unbewaffnet. Schalte die Leibwache aus und fordere ihn zur Aufgabe auf.', 6);
        yield m.killObjective('lk', 'Schalte Kessars Leibwache aus', 'leib');
        m.say('daren', 'Radan! Es ist vorbei. Leg die Hände auf den Kopf.', { expr: 'entschlossen' });
        yield m.holdZone('aufgabe', 'Nimm Kessar fest', { at: c.kessar, r: 3, secs: 4, label: 'Kessar', action: 'Kessar wird festgenommen' });
        if (k) k.remove();
        yield 0.5;
        m.complete();
      },
    },
  ],

  /** Testlauf: nichts Besonderes (Zonen/Wellen genügen). */
  _test() {},
};
