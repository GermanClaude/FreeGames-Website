// NULLPUNKT — Kampagne, Mission 5 „Archiv“ (Bibliothek als Staatsarchiv von Sant Aurel): Aufklärung, Geiselbefreiung,
// Beweise. Kessars Leute halten die Archivare im großen Lesesaal fest und wollen die Originale der Waffenruhe im
// Magazin (hinter den Eisengittern im Süden) vernichten. Falk klärt von der Galerie aus auf und markiert die Wachen
// (anlegen und anvisieren), der Trupp wartet am Eingang auf sein Zeichen (erster Schuss). Geiseln (Figuren ohne KI,
// protect) dürfen nicht getroffen werden. Danach: Geiseln zum Eingang, Originale aus dem Magazin bergen, Gegenstoß
// abwehren, raus aus dem brennenden Ostflügel. Die Zauber-Ausstattung der Karte (fliegende Bücher, Kerzen) wird für die
// Kampagne ausgeblendet. Ende von Akt I: Rauch über dem Brandwald. Checkpoints: start, zugriff, geiseln, magazin, raus.

import { actor } from './cast.js?v=20261114060746';

const ENTRY = [0, 23.2];
const GALLERY = [35.6, 4.4, 13.5];
const GUARDS = [[20, 3], [-20, -3], [31.5, -9], [-31.5, 9], [27, -3.25], [-3.2, -16.5]];
const HOSTAGES = [
  { id: 'lindner', name: 'Dr. Lindner', at: [0, 7], yaw: Math.PI },
  { id: 'arch1', name: 'Archivar Kemper', at: [0, -7], yaw: 0 },
  { id: 'arch2', name: 'Archivarin Sell', at: [13.5, 7.2], yaw: Math.PI / 2 },
  { id: 'arch3', name: 'Archivar Brun', at: [-13.5, -7.2], yaw: -Math.PI / 2 },
];
const VAULT = [0, -23.6];

const CUT_INTRO = {
  location: ['Staatsarchiv Sant Aurel', '06:10 Uhr · Tag 24 der Waffenruhe'],
  cast: {
    lenz: actor('lenz', { pos: [1.4, 23.0], yaw: 2.6, aim: -0.6 }),
    falk: actor('falk', { pos: [-0.6, 22.4], yaw: -2.9, aim: -0.6 }),
    weber: actor('weber', { pos: [-2.2, 23.8], yaw: -2.2, aim: -0.6, crouch: true }),
    hofer: actor('hofer', { pos: [2.8, 24.4], yaw: 2.9, aim: -0.7 }),
  },
  beats: [
    { cam: { from: [0, 9, -18], to: [0, 7.5, 2], look: [0, 3, 20], lookTo: [0, 1.6, 23] }, dur: 7, fadeIn: 1.5,
      say: { who: 'funk', text: 'Anker an Trupp Lenz: Im Staatsarchiv brennt seit einer Stunde Licht. Niemand hat die Wachablösung gemeldet.' } },
    { cam: { from: [4.5, 2.1, 19.6], to: [4.0, 2.0, 20.4], look: [0.4, 1.4, 23.2] },
      say: { who: 'lenz', text: 'Vogt hatte recht. Sie halten die Archivare im Lesesaal fest. Mindestens sechs Mann.', expr: 'ernst' } },
    { cam: { close: 'weber', side: 0.4, dist: 0.9 },
      say: { who: 'weber', text: 'Hinten im Magazin liegen die Originale der Waffenruhe. Mit Unterschriften beider Seiten. Wenn die verbrennen …', expr: 'angespannt' } },
    { cam: { close: 'lenz', side: -0.35, dist: 0.9, push: 0.1 },
      say: { who: 'lenz', text: 'Falke, du gehst über die Treppe auf die Galerie und markierst jede Wache, die du siehst. Wir warten hier.', expr: 'entschlossen' } },
    { cam: { close: 'hofer', side: 0.3, dist: 0.95 },
      say: { who: 'hofer', text: 'Und wenn es losgeht: Die Geiseln sitzen mitten zwischen ihnen. Jeder Schuss muss sitzen.', expr: 'ernst' } },
    { cam: { close: 'falk', side: -0.35, dist: 0.9 },
      say: { who: 'falk', text: 'Ich gebe das Zeichen. Mein erster Schuss.', expr: 'entschlossen' }, fadeOut: 1 },
  ],
};

const CUT_OUTRO = {
  location: ['Staatsarchiv · Eingangshalle', '06:58 Uhr'],
  cast: {
    lindner: actor('lindner', { pos: [0.8, 22.6], yaw: 2.5, aim: -1.0 }),
    falk: actor('falk', { pos: [-1.0, 21.6], yaw: -0.7, aim: -0.6 }),
    lenz: actor('lenz', { pos: [-2.4, 23.4], yaw: -1.4, aim: -0.6 }),
    weber: actor('weber', { pos: [2.6, 24.2], yaw: 2.2, aim: -0.6 }),
  },
  beats: [
    { cam: { from: [6, 3.2, 14], to: [4.5, 2.6, 16.5], look: [0, 1.4, 22.6] }, dur: 5, fadeIn: 1,
      say: { who: 'lindner', text: 'Das sind sie. Die Originale. Beide Unterschriften, beide Siegel. Kessars Papiere sind dagegen nichts wert.', expr: 'ernst' } },
    { cam: { close: 'lindner', side: 0.4, dist: 0.95, push: 0.1 },
      say: { who: 'lindner', text: 'Ich habe dreißig Jahre auf diese Akten aufgepasst. Ich hätte nie gedacht, dass jemand dafür sein Leben riskiert.', expr: 'traurig' } },
    { cam: { close: 'falk', side: -0.35, dist: 0.9 },
      say: { who: 'falk', text: 'Sie haben uns die Wahrheit aufbewahrt. Das ist mehr wert, als Sie denken.' } },
    { cam: { close: 'weber', side: 0.35, dist: 0.9, push: 0.1 },
      say: { who: 'weber', text: 'Feldwebel … Anker meldet Rauch über dem Brandwald. Das ganze Waldstück oberhalb des Holzplatzes steht in Flammen.', expr: 'angespannt' } },
    { cam: { close: 'lenz', side: -0.3, dist: 0.9 },
      say: { who: 'brandt', text: 'Kessar hat ihn angezündet, um seinen Vormarsch zu decken. Auf dem Holzplatz sitzen Arbeiter mit ihren Familien fest.' } },
    { cam: { over: ['falk', 'lenz'] },
      say: { who: 'brandt', text: 'Die Hubschrauber stehen bereit. Ihr fliegt in einer Stunde.', expr: 'entschlossen' } },
    { cam: { from: [0, 4, 12], to: [0, 6, 6], look: [0, 1.5, 22] }, dur: 3, fadeOut: 1.2,
      say: { who: 'lenz', text: 'Dann los. Keiner bleibt im Feuer zurück.', expr: 'entschlossen' } },
    { cam: { from: [0, 6, 6], look: [0, 1.5, 22] }, card: ['Ende von Akt I', 'Waffenruhe', 'Akt II · Feuer im Tal beginnt mit Mission 6 „Feuerlinie“'], dur: 4.5 },
  ],
};

function hideMagic(m) {
  const g = m.G.scene && m.G.scene.getObjectByName('magie');
  if (g) g.visible = false; // Staatsarchiv statt Zauberbibliothek
}

function hostages(m, { follow = false } = {}) {
  for (const h of HOSTAGES) {
    if (m.extras.has(h.id)) continue;
    const x = m.extra(h.id, { pos: h.at, yaw: h.yaw, variant: h.id === 'lindner' ? 'kundschafter' : 'sanitaeter', name: h.name, crouch: !follow, protect: true, aim: -1.2 });
    if (follow) x.follow(m.G.player);
  }
}

/** Wachen nicht vorzeitig aufmerksam werden lassen (Aufklärung): Entdeckungsgrad des Spielers zurücksetzen. */
function unaware(m, waveId, until) {
  m.every(() => {
    if (until()) return true;
    const P = m.G.player;
    const w = m.waves.get(waveId);
    for (const b of (w && w.bots) || []) { const r = b.alive && b.memory && b.memory.get ? b.memory.get(P) : null; if (r) { r.spot = 0; r.visible = false; } }
    return false;
  });
}

/** Markieren: anlegen und eine Wache ~0,7 s anvisieren (Sichtlinie). */
function markLoop(m, waveId, need) {
  const cam = m.G.camera;
  const v = cam.position.clone(), d = cam.position.clone(), h = cam.position.clone();
  let cur = null, t = 0;
  m.every((dt) => {
    const w = m.waves.get(waveId);
    const n = w ? w.bots.filter((b) => b._kc && b._kc.marked).length : 0;
    m.progress('markieren', n, need);
    if (n >= need || m.get('zeichen')) { if (m.ui) m.ui.hold(null); return true; }
    const P = m.G.player, wp = P.weapon;
    if (!wp || wp.adsProgress < 0.55 || !w) { t = 0; cur = null; if (m.ui) m.ui.hold(null); return false; }
    cam.getWorldDirection(d);
    v.copy(cam.position);
    let best = null, ba = 0.075;
    for (const b of w.bots) {
      if (!b.alive || (b._kc && b._kc.marked)) continue;
      h.set(b.position.x, b.position.y + 1.3, b.position.z).sub(v);
      const dist = h.length();
      if (dist > 95) continue;
      const a = Math.acos(Math.max(-1, Math.min(1, h.dot(d) / dist)));
      if (a > ba) continue;
      const W = m.G.world;
      if (W && W.lineOfSight && !W.lineOfSight(v, h.add(v))) continue;
      ba = a; best = b;
    }
    if (best && best === cur) t += dt; else { cur = best; t = 0; }
    if (m.ui) m.ui.hold(cur ? 'Markieren …' : null, t / 0.7);
    if (cur && t >= 0.7) {
      cur._kc.marked = true;
      m.markActor(cur);
      m.toast(`Wache markiert (${n + 1} von ${need})`, 'ok', 1.6);
      cur = null; t = 0;
    }
    return false;
  });
}

export const MISSION_5 = {
  id: 'm5',
  number: 5,
  act: 1,
  title: 'Archiv',
  short: 'Archiv',
  map: 'bibliothek',
  time: null,
  weather: null,
  type: 'Aufklärung · Geiselbefreiung · Beweise',
  summary: 'Kessars Leute halten die Archivare im Staatsarchiv fest und wollen die Originale der Waffenruhe vernichten. Kläre von der Galerie auf, gib das Zeichen zum Zugriff – und triff keine Geisel.',
  loadout: { primary: 'mr_sk14', secondary: 'pi_p9' },
  cutscenes: { intro: CUT_INTRO, outro: CUT_OUTRO },

  prepare(m) {
    hideMagic(m);
    m.allies([
      { role: 'lenz', name: 'Fw. Lenz', at: [1.5, 22.5] },
      { role: 'weber', name: 'OGefr. Weber', at: [-1.5, 22.5] },
      { role: 'hofer', name: 'San. Hofer', at: [3.5, 23.5] },
    ]);
    m.order('hold', ENTRY);
  },

  stages: [
    {
      id: 'start',
      name: 'Galerie',
      checkpoint: { at: [0, 21.5], yaw: 0 },
      *run(m) {
        yield m.cutsceneAt('intro');
        hideMagic(m);
        m.introduce('waffe', 'mr_sk14', 'SK-14: Zielfernrohrgewehr für präzise Schüsse auf mittlere Distanz – ideal, wenn Geiseln in der Nähe sind.');
        hostages(m);
        m.wave('wachen', { count: GUARDS.length, scale: false, at: GUARDS, hold: true });
        unaware(m, 'wachen', () => m.get('zeichen'));
        m.order('hold', ENTRY);
        m.on('weapon:fire', (e) => { if (e && e.actor === m.G.player && !m.get('zeichen')) m.set('zeichen', 'schuss'); });
        m.tip(`Befehl an den Trupp: Halten. Sie warten am Eingang, bis du schießt.`, 5);
        yield m.reach('galerie', 'Steig auf die Ostgalerie', { at: GALLERY, r: 3, h: 1.6, label: 'Galerie' });
        m.say('weber', 'Wir sehen dich auf der Galerie. Leg an und halte die Wachen kurz im Visier – dann sind sie markiert.', { radio: true });
        m.objective('markieren', 'Markiere die Wachen (anlegen und anvisieren)', { total: 5 });
        markLoop(m, 'wachen', 5);
        yield () => {
          const w = m.waves.get('wachen');
          return m.get('zeichen') || (w && w.bots.filter((b) => b._kc && b._kc.marked).length >= 5);
        };
        if (!m.get('zeichen')) {
          m.done('markieren');
          // übrige Wachen auch markieren (der Trupp sieht sie jetzt)
          for (const b of m.waves.get('wachen').bots) if (b.alive) m.markActor(b);
          m.say('lenz', 'Gute Arbeit. Wir sehen sie jetzt alle. Dein Schuss – dann gehen wir rein.', { radio: true, expr: 'entschlossen' });
        } else {
          m.say('lenz', 'Zu früh! Wir gehen rein – bleibt an den Geiseln vorbei!', { radio: true, expr: 'angespannt' });
        }
        yield 0.5;
      },
    },
    {
      id: 'zugriff',
      name: 'Zugriff',
      checkpoint: { at: GALLERY, yaw: 1.4 },
      setup(m) {
        hostages(m);
        m.wave('wachen', { count: GUARDS.length, scale: false, at: GUARDS, hold: true });
        for (const b of m.waves.get('wachen').bots) m.markActor(b);
        m.order('hold', ENTRY);
        m.on('weapon:fire', (e) => { if (e && e.actor === m.G.player && !m.get('zeichen')) m.set('zeichen', 'schuss'); });
      },
      *run(m) {
        m.clearObjectives();
        m.objective('zeichen', 'Gib das Zeichen: dein erster Schuss', { quiet: true });
        yield () => !!m.get('zeichen');
        m.done('zeichen', { quiet: true });
        m.order('attack', [0, 0]);
        m.say('lenz', 'Zugriff! Zugriff!', { expr: 'angespannt' });
        m.say('hofer', 'Köpfe runter! Bleiben Sie am Boden!', { expr: 'angespannt' });
        yield m.killObjective('wachen', 'Schalte die Wachen aus – ohne die Geiseln zu treffen', 'wachen');
        m.say('weber', 'Lesesaal ist sauber. Alle Geiseln leben.', { expr: 'erleichtert' });
        yield 1.5;
      },
    },
    {
      id: 'geiseln',
      name: 'Geiseln',
      checkpoint: { at: [6, 10], yaw: Math.PI },
      setup(m) { hostages(m); m.order('follow'); },
      *run(m) {
        m.clearObjectives();
        m.order('follow');
        m.say('lindner', 'Danke … danke. Wir sind vier. Niemand ist verletzt.', { radio: false });
        const ids = HOSTAGES.map((h) => h.id);
        m.objective('sammeln', 'Sammle die Geiseln ein (zu ihnen gehen)', { total: ids.length });
        m.objective('raus1', 'Bring sie zum Eingang', { pos: ENTRY, label: 'Eingang', quiet: true });
        const entry = m.vec(ENTRY);
        yield m.until(() => {
          let n = 0, safe = 0;
          for (const id of ids) {
            const x = m.extras.get(id);
            if (!x) continue;
            if (!x.target && x.position.distanceTo(m.G.player.position) < 2.6) { x.follow(m.G.player); m.toast(`${x.a.name} folgt dir`, 'ok', 1.4); }
            if (x.target) n++;
            if (x.position.distanceTo(entry) < 6) safe++;
          }
          m.progress('sammeln', n, ids.length);
          if (n >= ids.length) m.done('sammeln', { quiet: true });
          return safe >= ids.length;
        });
        m.done('raus1');
        for (const id of ids) { const x = m.extras.get(id); if (x) { x.follow(null); x.crouch = true; } }
        m.say('hofer', 'Ich bleibe bei ihnen. Geht ins Magazin.', { radio: false });
        yield 1;
      },
    },
    {
      id: 'magazin',
      name: 'Magazin',
      checkpoint: { at: [0, 17], yaw: 0 },
      setup(m) {
        const at = (k) => [ENTRY[0] - 3 + k * 2, ENTRY[1] + 0.8];
        HOSTAGES.forEach((h, k) => { if (!m.extras.has(h.id)) m.extra(h.id, { pos: at(k), variant: h.id === 'lindner' ? 'kundschafter' : 'sanitaeter', name: h.name, crouch: true, protect: true, aim: -1.2 }); });
        m.order('follow');
      },
      *run(m) {
        m.clearObjectives();
        m.order('follow');
        m.say('lindner', 'Die Originale liegen im Magazin, hinter dem mittleren Gitter. Fach sieben, die grauen Mappen.', { radio: false });
        yield m.reach('gitter', 'Geh durch das mittlere Gitter ins Magazin', { at: [0, -19.5], r: 3, label: 'Magazin' });
        // Gegenstoß aus dem Süden; der Ostflügel brennt
        m.wave('gegen', { count: 5, at: [[-28, -24.8], [28, -24.8], [-17, -24.8], [17, -24.8], [-11, -24.8]], attack: 'player' });
        for (const p of [[22, 12], [24, 2], [18, -8], [26, -14]]) m.fire(p, 2.6, 200);
        m.smoke([24, -2], { radius: 7, duration: 200, color: '#5d5a55' });
        m.say('weber', 'Sie kommen durch die Seitengänge! Und der Ostflügel brennt!', { expr: 'angespannt', radio: true });
        const akten = m.holdZone('akten', 'Berge die Originalverträge', { at: VAULT, r: 2.6, secs: 8, label: 'Fach 7', action: 'Akten einpacken' });
        yield akten;
        yield m.killObjective('gegen', 'Wehre den Gegenstoß ab', 'gegen');
        yield 1;
      },
    },
    {
      id: 'raus',
      name: 'Ausgang',
      checkpoint: { at: [0, -17], yaw: Math.PI },
      setup(m) { m.order('follow'); },
      *run(m) {
        m.clearObjectives();
        for (const p of [[14, 6], [10, -10], [30, 4], [6, 14]]) m.fire(p, 2.4, 160);
        m.smoke([12, 0], { radius: 8, duration: 160, color: '#55524d' });
        m.say('lenz', 'Das Feuer greift auf den Mittelgang über. Raus hier, alle!', { expr: 'angespannt' });
        m.wave('nach', { count: 3, at: [[-30, 9], [-20, 3], [-27, 4.25]], attack: 'player' });
        let late = false;
        m.timer(90, 'Feuer', () => { late = true; });
        yield m.reach('ausgang', 'Raus aus dem Archiv – zum Eingang', { at: ENTRY, r: 4, label: 'Ausgang' });
        if (late) m.tip('Knapp – der Rauch hat schon den Eingang erreicht.', 3);
        m.stopTimer();
        yield 1;
        m.complete();
      },
    },
  ],
};
