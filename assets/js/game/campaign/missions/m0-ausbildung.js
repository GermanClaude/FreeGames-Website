// NULLPUNKT — Kampagne, Mission 0 „Grundausbildung“ (Schießstand): Ausbildung Schritt für Schritt.
// Oberfeldwebel Krell frischt mit Falk alles auf, was die Kampagne braucht. Jeder Schritt wartet auf die echte Aktion
// des Spielers (Eingabe bzw. Spielzustand), die Hinweise nennen die Taste des gerade benutzten Geräts (Tastatur/Maus,
// Gamepad oder Touch; aus der Belegung in den Einstellungen – m.key()). Abschnitte mit Checkpoint:
//   bewegung (Umsehen, Laufen, Sprinten, Ducken, Hinlegen, Springen, Überklettern, Treppe)
//   schiessen (Zielen, Treffen 25 m, Nachladen, Feuermodus, Waffenwechsel, Pistole, Nahkampf, Weitschuss liegend)
//   ausruestung (Granate, taktische Granate, Klassen-Ausrüstung, Verband, Panzerplatte)
//   trupp (Befehlsrad: Markieren/Angreifen, Mir folgen; Wegpunkt und Minikarte)
//   fahrzeug (Einsteigen, Fahren, MG-Sitz, Aussteigen)
// Auch einzeln aus dem Kampagnenmenü startbar („Ausbildung“). Spieler unverwundbar, Munition wird aufgefüllt.

import { actor } from './cast.js?v=20261123082814';
import { FIRE_SELECT } from '../../../shared/weapons.data.js?v=20261123082814';
import { refillAmmo } from '../../mappoints.js?v=20261123082814';

const LANE4 = [-2.75, 36.4]; // Schützenposition Bahn 4 (Blick nach Süden)
const JEEP_AT = [24.2, 24];
const ROUTE = [[24.5, -40], [0, -73], [-25, -40], [-25.2, 14]];

const CUT_INTRO = {
  location: ['Schießstand Hohenfeld', 'Drei Wochen vor dem Ende der Waffenruhe'],
  cast: {
    krell: actor('krell', { pos: [1.2, 50.6], yaw: 2.4, aim: -1.0 }),
    falk: actor('falk', { pos: [-0.6, 48.8], yaw: -0.75, aim: -0.6 }),
    lenz: actor('lenz', { pos: [-3.2, 52.4], yaw: -1.9, aim: -0.7 }),
  },
  beats: [
    { cam: { from: [16, 9, 70], to: [8, 5, 60], look: [0, 1.5, 40], lookTo: [0, 1.4, 50] }, dur: 6, fadeIn: 1.4,
      say: { who: 'krell', text: 'Unteroffizier Falk. Sie waren lange im Stab. Heute frischen wir alles auf, was Sie draußen brauchen.' } },
    { cam: { close: 'krell', side: 0.4, dist: 0.95, push: 0.1 },
      say: { who: 'krell', text: 'Bewegung, Waffe, Ausrüstung, Trupp, Fahrzeug. Schritt für Schritt. Ich sage an, Sie machen.', expr: 'ernst' } },
    { cam: { over: ['falk', 'krell'] },
      say: { who: 'falk', text: 'Verstanden, Herr Oberfeldwebel.' } },
    { cam: { close: 'lenz', side: -0.35, dist: 0.95 },
      say: { who: 'lenz', text: 'Ich schaue zu. Wer mir in drei Wochen den Rücken freihält, soll das hier im Schlaf können.', expr: 'entschlossen' } },
    { cam: { close: 'krell', side: -0.3, dist: 0.9 },
      say: { who: 'krell', text: 'Die Hinweise oben zeigen die Tasten, die Sie gerade benutzen. Fangen wir an.' }, fadeOut: 0.8 },
  ],
};

const CUT_OUTRO = {
  location: ['Schießstand Hohenfeld', 'Am selben Abend'],
  cast: {
    krell: actor('krell', { pos: [1.4, 49.8], yaw: 2.6, aim: -1.0 }),
    falk: actor('falk', { pos: [-0.4, 48.0], yaw: -0.6, aim: -0.6 }),
    lenz: actor('lenz', { pos: [-2.6, 50.6], yaw: -1.6, aim: -0.6 }),
    weber: actor('weber', { pos: [3.6, 52.2], yaw: 2.9, aim: -0.7 }),
  },
  beats: [
    { cam: { from: [10, 4, 58], to: [7, 3, 55], look: [0, 1.4, 49.5] }, dur: 5, fadeIn: 1,
      say: { who: 'krell', text: 'Das war ordentlich, Falk. Der Rest kommt draußen – mit jedem Tag.' } },
    { cam: { close: 'falk', side: 0.4, dist: 0.95 },
      say: { who: 'falk', text: 'Danke, Herr Oberfeldwebel.' } },
    { cam: { close: 'weber', side: -0.35, dist: 0.9, push: 0.1 },
      act: [{ who: 'weber', walk: [[2.2, 50.6]], speed: 2.4 }],
      say: { who: 'weber', text: 'Feldwebel! Anker meldet: Das Funkrelais in Sant Aurel ist verstummt. Keine Verbindung mehr ins Tal.', expr: 'angespannt' } },
    { cam: { close: 'lenz', side: 0.3, dist: 0.9 },
      say: { who: 'lenz', text: 'Dann ist die Übung vorbei. Falke, du kommst mit. Abfahrt in zehn Minuten.', expr: 'entschlossen' } },
    { cam: { from: [-6, 2.4, 44], to: [-8, 6, 40], look: [0, 1.4, 50] },
      say: { who: 'krell', text: 'Passen Sie aufeinander auf.', expr: 'ernst' }, fadeOut: 1.2 },
    { cam: { from: [-8, 6, 40], look: [0, 1.4, 50] }, card: ['Ausbildung abgeschlossen', 'Mission 1 · Funkstille', 'Die Kampagne beginnt in Sant Aurel'], dur: 4 },
  ],
};

/* ------------------------------------------------------------ Hilfen */

const kb = (s) => `<kbd>${s}</kbd>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Taste als <kbd> (Touch: Knopfname im Text). */
const K = (m, action, touch) => { const t = m.key(action, touch); return m.device === 'touch' ? `<b>${esc(t)}</b>` : kb(esc(t.replace(/^[[(]|[\])]$/g, ''))); };
const DEV = (m, o) => o[m.device] ?? o.kb;

const TOTAL = 35; // Anzahl Schritte (übersprungene zählen mit)

/**
 * Ein Ausbildungsschritt: zeigt die Tafel, setzt Eingaben zurück und wartet, bis s.done(m, st) wahr ist.
 * s: { title, text(m, st) → HTML, done(m, st), setup?(m, st), say?: [who, text], skip?(m) (Schritt entfällt), tick?(m, st, dt) }
 */
function* lesson(m, s) {
  if (s.skip && s.skip(m)) { m.set('lesson', (m.get('lesson') || 0) + 1); return; }
  const st = { t: 0, p: null, n: 0, last: m.elapsed };
  m.set('lesson', (m.get('lesson') || 0) + 1);
  const nr = m.get('lesson');
  m.clearPresses();
  if (s.setup) s.setup(m, st);
  if (s.say) m.say(s.say[0], s.say[1], { radio: false });
  let key = '';
  yield m.until(() => {
    const dt = Math.min(0.25, m.elapsed - st.last);
    st.last = m.elapsed;
    st.t += dt;
    if (s.tick) s.tick(m, st, dt);
    const html = typeof s.text === 'function' ? s.text(m, st) : s.text;
    const k = `${html}|${st.p == null ? '' : st.p.toFixed(2)}`;
    if (k !== key && m.ui) { key = k; m.ui.lesson(`Ausbildung · Schritt ${nr} von ${TOTAL}`, s.title, html, st.p); }
    return !!s.done(m, st);
  });
  if (m.ui) m.ui.lesson(`Ausbildung · Schritt ${nr} von ${TOTAL}`, `✓ ${s.title}`, s.okText || 'Gut.', 1);
  m.G.events.emit('ui:sound', { name: 'confirm' });
  yield 1.1;
}

const P = (m) => m.G.player;
const W = (m) => (P(m) && P(m).weapon) || null;
function refill(m) { try { refillAmmo(P(m)); } catch { /* */ } }
/** Zieltreffer zählen (Bahnziele des Schießstands, target:hit). */
function hitCounter(m, filter) {
  const st = { n: 0 };
  m.on('target:hit', (e) => { if (e && e.shooter === P(m) && (!filter || filter(e))) st.n++; });
  return st;
}

/* ------------------------------------------------------------ Mission */

export const MISSION_0 = {
  id: 'm0',
  number: 0,
  act: 1,
  tutorial: true,
  title: 'Grundausbildung',
  short: 'Ausbildung',
  map: 'range',
  time: null,
  weather: null,
  type: 'Ausbildung · Schießstand',
  summary: 'Am Schießstand Hohenfeld lernst du unter Oberfeldwebel Krell alles, was die Kampagne verlangt: Bewegung, Waffen, Granaten, Ausrüstung, Befehle an den Trupp und den Geländewagen. Jeder Schritt wartet auf dich.',
  loadout: { primary: 'ar_m17', secondary: 'pi_p9' },
  cutscenes: { intro: CUT_INTRO, outro: CUT_OUTRO },

  prepare(m) {
    m.allies([
      { role: 'lenz', name: 'Fw. Lenz', at: [-3, 53] },
      { role: 'weber', name: 'OGefr. Weber', at: [3.5, 53.2] },
    ]);
    m.order('hold', [0, 53]);
    // Ereignisse für die Schritte
    m.on('weapon:reload', (e) => { if (e && e.actor === P(m) && e.phase === 'start') m.set('reloaded', true); });
    m.on('weapon:switch', (e) => { if (e && e.actor === P(m)) m.set('switched', (m.get('switched') || 0) + 1); });
    m.on('weapon:firemode', (e) => { if (!e || !e.actor || e.actor === P(m)) m.set('firemode', true); });
    m.on('player:mantle', (e) => { if (e && e.phase === 'start') m.set('vaulted', true); });
    m.on('vehicle:enter', (e) => { if (e && e.actor === P(m)) m.set('inJeep', true); });
    m.on('vehicle:exit', (e) => { if (e && e.actor === P(m)) m.set('inJeep', false); });
    m.on('grenade:throw', (e) => { if (!e || e.actor !== P(m)) return; const tac = ['smoke', 'flash', 'stun', 'rauch', 'blend'].some((k) => String(e.type || '').includes(k)); m.set(tac ? 'threwTac' : 'threw', true); });
    const jeep = m.vehicle('jeep', JEEP_AT, 0, 'A');
    m.set('jeep', jeep);
  },

  stages: [
    {
      id: 'bewegung',
      name: 'Bewegung',
      checkpoint: { at: [0, 48.5], yaw: 0 },
      *run(m) {
        if (!m.resumed) yield m.cutsceneAt('intro');
        m.G.player.invulnerable = true;
        m.objective('ausbildung', 'Folge den Anweisungen des Ausbilders', { quiet: true });
        // 1 Umsehen
        yield* lesson(m, {
          title: 'Umsehen',
          text: (mm) => DEV(mm, { kb: 'Bewege die <b>Maus</b>, um dich umzusehen.', pad: 'Sieh dich mit dem <b>rechten Stick</b> um.', touch: 'Wische auf der <b>rechten Bildschirmhälfte</b>, um dich umzusehen.' }),
          setup: (mm, st) => { st.y0 = P(mm).yaw; st.acc = 0; },
          tick: (mm, st) => { const y = P(mm).yaw; let d = y - st.y0; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; st.acc += Math.abs(d); st.y0 = y; st.p = Math.min(1, st.acc / 2.4); },
          done: (mm, st) => st.acc > 2.4,
        });
        // 2 Laufen
        const go = m.reach('lauf', 'Gehe zur Markierung', { at: [-8.5, 46.8], r: 1.8, label: 'Hierher' });
        yield* lesson(m, {
          title: 'Bewegen',
          text: (mm) => DEV(mm, { kb: `Laufe mit ${K(mm, 'move_forward')} ${K(mm, 'move_left')} ${K(mm, 'move_back')} ${K(mm, 'move_right')} zur Markierung.`, pad: 'Laufe mit dem <b>linken Stick</b> zur Markierung.', touch: 'Laufe mit dem <b>Stick links</b> zur Markierung.' }),
          done: () => go.done,
        });
        // 3 Sprinten
        yield* lesson(m, {
          title: 'Sprinten',
          say: ['krell', 'Gut. Jetzt schnell – sprinten Sie ein Stück.'],
          text: (mm) => DEV(mm, { kb: `Halte ${K(mm, 'sprint')} beim Laufen gedrückt und sprinte zwei Sekunden.`, pad: `Drücke ${K(mm, 'sprint')} (linken Stick) beim Laufen und sprinte zwei Sekunden.`, touch: 'Schiebe den <b>Stick ganz nach vorn</b> und sprinte zwei Sekunden.' }),
          tick: (mm, st, dt) => { if (P(mm).sprinting) st.n += dt; st.p = Math.min(1, st.n / 2); },
          done: (mm, st) => st.n >= 2,
        });
        // 4 Ducken
        yield* lesson(m, {
          title: 'Ducken',
          text: (mm) => `Ducke dich mit ${K(mm, 'crouch', 'Ducken')}. Geduckt bist du leiser und schwerer zu treffen.`,
          done: (mm) => P(mm).crouching,
        });
        // 5 Hinlegen
        yield* lesson(m, {
          title: 'Hinlegen',
          text: (mm) => DEV(mm, { kb: `Lege dich mit ${K(mm, 'prone')} hin.`, pad: `Halte ${K(mm, 'crouch')} gedrückt, um dich hinzulegen.`, touch: `Lege dich mit ${K(mm, 'prone', 'Hinlegen')} hin.` }),
          done: (mm) => P(mm).prone,
        });
        // 6 Aufstehen + Springen
        yield* lesson(m, {
          title: 'Aufstehen und springen',
          text: (mm) => `Steh auf (${K(mm, 'jump', 'Springen')} oder ${K(mm, 'crouch', 'Ducken')}) und springe mit ${K(mm, 'jump', 'Springen')}.`,
          tick: (mm, st) => { const p = P(mm); if (!p.prone && !p.crouching && p.body && !p.body.onGround) st.jumped = true; },
          done: (mm, st) => st.jumped,
        });
        // 7 Überklettern (Fenster im Parcours)
        const ins = m.zone('innen', { box: [-27, 45.3, -12.4, 50.8] });
        m.objective('fenster', 'Klettere durch das Fenster in den Parcours', { pos: [-12, 53.6], label: 'Fenster' });
        yield* lesson(m, {
          title: 'Überklettern',
          say: ['krell', 'Der Parcours. Durch das Fenster – nicht durch die Tür.'],
          text: (mm) => `Laufe an das Fenster der Holzwand und drücke ${K(mm, 'jump', 'Springen')}, um hindurchzuklettern.`,
          setup: (mm) => mm.set('vaulted', false),
          tick: (mm, st) => { if (P(mm).mantling || mm.get('vaulted')) st.vault = true; },
          done: (mm, st) => st.vault && P(mm).position.x < -12.3,
        });
        m.done('fenster', { quiet: true });
        void ins;
        // 8 Treppe/Turm
        const tower = m.reach('turm', 'Steig auf den Turm des Parcours', { at: [-24, 2.6, 59], r: 2.2, h: 1.2, label: 'Turm' });
        yield* lesson(m, {
          title: 'Treppen und Höhe',
          text: 'Steige über die Treppe auf den Holzturm. Von oben siehst du weiter – und wirst gesehen.',
          done: () => tower.done,
        });
        // 9 Lehnen
        yield* lesson(m, {
          title: 'Um die Ecke lehnen',
          text: (mm) => DEV(mm, { kb: `Lehne dich mit ${K(mm, 'lean_left')} nach links und ${K(mm, 'lean_right')} nach rechts.`, pad: `Lehne dich mit ${K(mm, 'lean_left')} nach links und ${K(mm, 'lean_right')} nach rechts.`, touch: 'Lehnen kannst du in den Touch-Einstellungen als Knopf einblenden. Tippe auf <b>Zielen</b>, um weiterzumachen.' }),
          tick: (mm, st) => { if (Math.abs(P(mm).lean || 0) > 0.3) st.lean = true; },
          done: (mm, st) => st.lean || (mm.device === 'touch' && mm.didPress('ads')),
        });
        m.clearObjectives();
      },
    },
    {
      id: 'schiessen',
      name: 'Schießstand',
      checkpoint: { at: LANE4, yaw: 0 },
      setup(m) { refill(m); m.set('lesson', 9); m.G.player.invulnerable = true; },
      *run(m) {
        m.clearObjectives();
        const lane = m.reach('bahn', 'Geh an den Schießtisch von Bahn 4', { at: LANE4, r: 1.6, label: 'Bahn 4' });
        m.say('krell', 'Bahn vier. Die Klappziele stehen auf zehn bis hundert Meter.');
        yield* lesson(m, { title: 'Zum Schießstand', text: 'Geh an den Schießtisch von Bahn 4 (Wegpunkt).', done: () => lane.done });
        refill(m);
        // Zielen
        yield* lesson(m, {
          title: 'Zielen',
          text: (mm) => `Lege mit ${K(mm, 'ads', 'Zielen')} an. Über Kimme und Korn bzw. die Optik triffst du deutlich genauer.`,
          done: (mm) => { const w = W(mm); return !!(w && w.adsProgress > 0.8); },
        });
        // Treffen 25 m
        const c25 = hitCounter(m, (e) => e.distance <= 25);
        yield* lesson(m, {
          title: 'Schießen',
          text: (mm, st) => `Triff drei Ziele auf 10 oder 25 Meter: anlegen und ${K(mm, 'fire', 'Feuern')}. (${Math.min(3, c25.n)}/3)`,
          tick: (mm, st) => { st.p = Math.min(1, c25.n / 3); },
          done: () => c25.n >= 3,
        });
        // Nachladen
        yield* lesson(m, {
          title: 'Nachladen',
          text: (mm) => `Lade mit ${K(mm, 'reload', 'Nachladen')} nach. Ein volles Magazin vor dem nächsten Gefecht rettet Leben.`,
          setup: (mm) => mm.set('reloaded', false),
          done: (mm) => mm.get('reloaded'),
        });
        // Feuermodus (nur wenn die Waffe mehrere hat)
        yield* lesson(m, {
          title: 'Feuermodus',
          skip: (mm) => { const w = W(mm); const d = w && w.currentDef; const fs = d && FIRE_SELECT[d.id]; return !(fs && Array.isArray(fs.modes) && fs.modes.length > 1); },
          text: (mm) => `Schalte mit ${K(mm, 'feuermodus', 'Feuermodus')} zwischen Einzelfeuer, Feuerstoß und Dauerfeuer um.`,
          setup: (mm) => mm.set('firemode', false),
          done: (mm) => mm.get('firemode') || mm.didPress('feuermodus'),
        });
        // Waffenwechsel + Pistole
        yield* lesson(m, {
          title: 'Waffe wechseln',
          text: (mm) => `Wechsle mit ${K(mm, 'swap', 'Waffe wechseln')} zur Pistole.`,
          setup: (mm) => mm.set('switched', 0),
          done: (mm) => { const w = W(mm); return (mm.get('switched') || 0) > 0 && w && w.currentDef && w.currentDef.slot === 'secondary'; },
        });
        const c10 = hitCounter(m, (e) => e.distance <= 10);
        yield* lesson(m, {
          title: 'Pistole',
          text: (mm) => `Triff zwei Ziele auf 10 Meter mit der Pistole. (${Math.min(2, c10.n)}/2)`,
          tick: (mm, st) => { st.p = Math.min(1, c10.n / 2); },
          done: () => c10.n >= 2,
        });
        yield* lesson(m, {
          title: 'Zurück zum Gewehr',
          text: (mm) => DEV(mm, { kb: `Nimm das Gewehr wieder: ${K(mm, 'slot1')} oder ${K(mm, 'swap')}.`, pad: `Nimm mit ${K(mm, 'swap')} das Gewehr wieder.`, touch: `Nimm mit ${K(mm, 'swap', 'Waffe wechseln')} das Gewehr wieder.` }),
          done: (mm) => { const w = W(mm); return w && w.currentDef && w.currentDef.slot !== 'secondary'; },
        });
        // Nahkampf
        yield* lesson(m, {
          title: 'Nahkampf',
          text: (mm) => `Ein Schlag mit dem Kolben bzw. Messer: ${K(mm, 'melee', 'Messer')}.`,
          done: (mm) => mm.didPress('melee'),
        });
        // Weitschuss liegend
        const c50 = hitCounter(m, (e) => e.distance >= 50);
        yield* lesson(m, {
          title: 'Weitschuss',
          say: ['krell', 'Auf fünfzig Meter und weiter: hinlegen, anlegen, ruhig atmen.'],
          text: (mm) => `Leg dich hin (${K(mm, mm.device === 'pad' ? 'crouch' : 'prone', 'Hinlegen')}), lege an und triff ein Ziel auf 50 Meter oder weiter.`,
          tick: (mm, st) => { st.p = c50.n ? 1 : P(mm).prone ? 0.5 : 0; },
          done: () => c50.n >= 1,
        });
      },
    },
    {
      id: 'ausruestung',
      name: 'Ausrüstung',
      checkpoint: { at: LANE4, yaw: 0 },
      setup(m) { refill(m); m.set('lesson', 19); m.G.player.invulnerable = true; },
      *run(m) {
        m.clearObjectives();
        refill(m);
        m.say('krell', 'Granaten. Ziel sind die Sandsäcke rechts vorn auf der Bahn.');
        m.objective('granate', 'Wirf eine Granate hinter die Sandsäcke', { pos: [17, -8], label: 'Sandsäcke' });
        yield* lesson(m, {
          title: 'Granate werfen',
          text: (mm) => `Wirf eine Splittergranate mit ${K(mm, 'grenade', 'Granate')}. Halten = vorkochen, Loslassen = werfen.`,
          setup: (mm) => mm.set('threw', false),
          done: (mm) => mm.get('threw'),
        });
        m.done('granate', { quiet: true });
        yield* lesson(m, {
          title: 'Taktische Granate',
          skip: (mm) => { const lo = P(mm).loadout || {}; return !lo.tactical; },
          text: (mm) => `Taktische Granaten (Rauch, Blendung) wirfst du mit ${K(mm, 'tactical', 'Taktische Granate')}. Rauch deckt Bewegungen über offene Flächen.`,
          setup: (mm) => mm.set('threwTac', false),
          done: (mm) => mm.get('threwTac') || mm.didPress('tactical'),
        });
        yield* lesson(m, {
          title: 'Klassen-Ausrüstung',
          text: (mm) => {
            const g = P(mm).gadget;
            const name = { adrenalin: 'Adrenalinspritze', medkit: 'Verbandskasten', repair: 'Reparaturwerkzeug', fernglas: 'Fernglas', spot: 'Markieren' }[g && g.id] || 'Ausrüstung deiner Klasse';
            return `Deine Klasse trägt: <b>${esc(name)}</b>. Setze sie mit ${K(mm, 'gadget', 'Klassen-Ausrüstung')} ein.`;
          },
          done: (mm) => mm.didPress('gadget'),
        });
        yield* lesson(m, {
          title: 'Verband',
          say: ['krell', 'Blutungen zuerst. Ein Verband dauert Sekunden – nehmen Sie sich die Zeit.'],
          text: (mm) => `Lege mit ${K(mm, 'verband', 'Verband')} einen Verband an. Er stillt Blutungen und versorgt Arm und Bein.`,
          done: (mm) => mm.didPress('verband'),
        });
        yield* lesson(m, {
          title: 'Panzerplatte',
          skip: (mm) => { const p = P(mm); return !(p.armor || (p.loadout && p.loadout.armor)); },
          text: (mm) => `Beschädigte Schutzweste? Setze mit ${K(mm, 'plate', 'Panzerplatte')} eine neue Platte ein (halten: alle).`,
          done: (mm) => mm.didPress('plate'),
        });
      },
    },
    {
      id: 'trupp',
      name: 'Trupp',
      checkpoint: { at: [0, 46], yaw: Math.PI },
      setup(m) { refill(m); m.set('lesson', 24); m.G.player.invulnerable = true; },
      *run(m) {
        m.clearObjectives();
        const back = m.reach('vorplatz', 'Geh zurück auf den Vorplatz zu Lenz', { at: [0, 49], r: 4, label: 'Lenz' });
        m.say('lenz', 'Falke, zu mir. Jetzt lernst du, uns zu führen.', { radio: true });
        yield* lesson(m, { title: 'Wegpunkte', text: 'Ziele zeigt dir der <b>Wegpunkt</b> mit Entfernung – am Bildrand als Pfeil. Folge ihm zu Lenz.', done: () => back.done });
        yield* lesson(m, {
          title: 'Minikarte',
          text: (mm) => `Die <b>Minikarte</b> zeigt deine Kameraden (blau) und markierte Gegner. ${mm.device === 'kb' ? `Die Punktetabelle zeigt ${K(mm, 'scoreboard')}.` : ''} Schau sie dir an – weiter, sobald du ${K(mm, 'crouch', 'Ducken')} drückst.`,
          done: (mm) => mm.didPress('crouch'),
        });
        const t0 = m.G.time.elapsed;
        const ordered = (kinds) => m.allyList.some((b) => b.alive && b.command && b.command.by === P(m) && b.command.issued >= t0 && (!kinds || kinds.includes(b.command.kind)));
        yield* lesson(m, {
          title: 'Befehlsrad: Markieren und Angreifen',
          say: ['lenz', 'Zeig uns ein Ziel. Wir gehen hin, du gibst Deckung.'],
          text: (mm) => DEV(mm, {
            kb: `Ziele auf die Bahnen, halte ${K(mm, 'befehl')} und wähle mit der Maus <b>Angreifen</b> oder <b>Verteidigen</b> – das setzt eine Markierung.`,
            pad: `Ziele auf die Bahnen, halte ${K(mm, 'befehl')} und wähle mit dem rechten Stick <b>Angreifen</b> oder <b>Verteidigen</b> – das setzt eine Markierung.`,
            touch: `Ziele auf die Bahnen, tippe ${K(mm, 'befehl', 'Befehlsrad')} oben rechts und wähle <b>Angreifen</b> oder <b>Verteidigen</b> – das setzt eine Markierung.` }),
          done: () => ordered(['attack', 'defend', 'spread']),
        });
        yield 3;
        yield* lesson(m, {
          title: 'Befehl: Mir folgen',
          text: (mm) => `Hol den Trupp zurück: Befehlsrad (${K(mm, 'befehl', 'Befehlsrad')}) → <b>Mir folgen</b>.`,
          done: () => ordered(['follow', 'regroup']),
        });
      },
    },
    {
      id: 'fahrzeug',
      name: 'Fahrzeug',
      checkpoint: { at: [21, 30], yaw: Math.PI * 0.9 },
      setup(m) { m.order('follow'); m.set('lesson', 28); m.G.player.invulnerable = true; },
      *run(m) {
        m.clearObjectives();
        const jeep = m.get('jeep');
        if (!jeep || !jeep.alive) { m.tip('Kein Fahrzeug verfügbar – dieser Teil entfällt.', 4); yield 2; m.complete(); return; }
        m.objective('jeep', 'Steig in den Geländewagen', { pos: () => jeep.position, label: 'Geländewagen' });
        m.introduce('fahrzeug', 'jeep', 'GW-4 Steppe: schnell, geländegängig, schweres MG auf dem Dach.');
        yield* lesson(m, {
          title: 'Einsteigen',
          say: ['krell', 'Der Geländewagen steht am Ende der Bahnen. Einsteigen, Runde fahren.'],
          text: (mm) => `Geh zum Geländewagen und steig mit ${K(mm, 'interact', 'Einsteigen')} ein.`,
          done: (mm) => P(mm).vehicle === jeep,
        });
        m.done('jeep', { quiet: true });
        for (let i = 0; i < ROUTE.length; i++) {
          const r = m.reach(`fahrt${i}`, `Fahre zum Wegpunkt ${i + 1} von ${ROUTE.length}`, { at: ROUTE[i], r: 7, label: `Fahrt ${i + 1}` });
          yield* lesson(m, {
            title: `Fahren (${i + 1}/${ROUTE.length})`,
            text: (mm) => DEV(mm, { kb: `Gas und Lenkung mit ${K(mm, 'move_forward')} ${K(mm, 'move_left')} ${K(mm, 'move_back')} ${K(mm, 'move_right')}, umsehen mit der Maus. Fahre zum Wegpunkt.`, pad: 'Gas, Rückwärts und Lenken mit dem <b>linken Stick</b>, umsehen mit dem rechten. Fahre zum Wegpunkt.', touch: 'Fahre mit dem <b>Stick</b> (vor = Gas, zurück = rückwärts); der Knopf <b>Bremse</b> hält an. Fahre zum Wegpunkt.' }),
            done: () => r.done || P(m).vehicle !== jeep && m.inZone(`fahrt${i}`),
          });
          if (P(m).vehicle !== jeep) {
            m.objective('jeep', 'Steig wieder in den Geländewagen', { pos: () => jeep.position, label: 'Geländewagen' });
            yield () => P(m).vehicle === jeep;
            m.done('jeep', { quiet: true });
          }
        }
        yield* lesson(m, {
          title: 'Sitz wechseln',
          text: (mm) => DEV(mm, { kb: 'Wechsle mit den Zifferntasten <kbd>1</kbd>–<kbd>4</kbd> an das MG auf dem Dach (Sitz 2).', pad: `Wechsle mit ${K(mm, 'seat_next')} an das MG.`, touch: 'Tippe auf den <b>Sitz-Knopf</b>, um an das MG zu wechseln.' }),
          setup: (mm, st) => { st.seat0 = jeep.seatOf ? jeep.seatOf(P(mm)) : 0; },
          done: (mm, st) => P(mm).vehicle === jeep && jeep.seatOf && jeep.seatOf(P(mm)) !== st.seat0,
        });
        yield* lesson(m, {
          title: 'Aussteigen',
          text: (mm) => `Steig mit ${K(mm, 'interact', 'Aussteigen')} aus.`,
          done: (mm) => !P(mm).vehicle,
        });
        m.say('krell', 'Gut gemacht. Kommen Sie zum Vorplatz.');
        yield 2;
        m.ui && m.ui.lesson(null);
        m.complete();
      },
    },
  ],
};
