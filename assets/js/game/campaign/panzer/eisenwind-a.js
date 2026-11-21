// NULLPUNKT — Panzer-Kampagne „Eisenwind“, Missionen 1–3 (frei erfunden):
//   P1 „Erster Kontakt“   Grenzland, Morgen – Durchbruch durch eine Sperrlinie (Pak, Bunker, Panzer), Funkstelle zerstören
//   P2 „Höhe 214“         Flugplatz, Abend  – Verteidigung einer Stellung gegen drei Angriffswellen (Panzer, Schützenpanzer,
//                         Panzerabwehrtrupps), Falke 1 an der Flanke
//   P3 „Geleit nach Ostrau“ Grenzland, Vormittag – Geleitschutz für drei Transporter mit dem alten KP-68 „Auerochs“ aus der
//                         Reserve (Kalter Krieg: Treibspiegel/Hohlladung/Quetschkopf, nur Optik); Hinterhalte am Weg
// Positionen im Kartenrahmen F (kit.js makeFrame): F.at(t, quer).
import { convoy } from '../missions/hilfen-b.js?v=20261121041936';
import { foeTank, allyTank, target, destroy, infantry, aliveOf, playerPos, crewSay, cast, roleTip } from './kit.js?v=20261121041936';

/* ====================================================================== P1 Erster Kontakt */

export const P1 = {
  id: 'p1', number: 1, title: 'Erster Kontakt', short: 'Erster Kontakt',
  map: 'grenzland', time: 'morgen', weather: 'klar', tank: 'mbt', models: ['mbt'],
  type: 'Durchbruch · Pak, Bunker, Panzer, Funkstelle', minutes: 15,
  summary: 'Korvanische Panzer haben in der Nacht die Grenze überschritten. Brich mit Falke 1 durch ihre Sperrlinie aus Pak-Stellungen, Bunker und Panzern und zerstör die Funkstelle, die ihre Artillerie lenkt.',
  goals: ['Pak-Stellungen und Bunker der Sperrlinie vernichten', 'Den Panzer an der Straße ausschalten', 'Die Funkstelle hinter der Linie zerstören'],
  build(F, pz) {
    const T0 = 0.06;
    const intro = () => ({
      groundRel: true,
      location: ['Tal der Miren · Grenzland', '05:40 Uhr · erster Kriegstag'],
      cast: {
        asmus: cast('asmus', { pos: F.off(T0, 0, 5.5, 1.5), yaw: F.yaw + 1.9, aim: -0.8 }),
        sievers: cast('sievers', { pos: F.off(T0, 0, 7.5, -0.5), yaw: F.yaw - 1.2, aim: -0.9 }),
      },
      beats: [
        { cam: { path: [F.p3(T0 - 0.06, -40, 26), F.p3(T0 - 0.02, -20, 12), F.p3(T0, -10, 5)], look: F.p3(T0, 0, 1.6), lookTo: F.p3(T0 + 0.2, 0, 2) }, dur: 8, fadeIn: 1.5,
          say: { who: 'amboss', text: 'Amboss an alle Falken: Korvanische Panzer haben um vier Uhr die Grenze bei Mirenfurt überschritten. Vor uns liegt ihre Sperrlinie.' } },
        { cam: { close: 'sievers', side: 0.4, dist: 0.9, push: 0.1 },
          say: { who: 'sievers', text: 'Eingegrabene Pak, ein Bunker an der Straße und dahinter eine Funkstelle, die ihre Artillerie lenkt. Ohne die Funkstelle sind sie blind.', expr: 'ernst' } },
        { cam: { close: 'asmus', side: -0.35, dist: 0.9 },
          say: { who: 'asmus', text: 'Falke 2, ihr fahrt rechts von mir. Erst die Pak, dann alles, was sich bewegt. Die Funkstelle nehmen wir uns gemeinsam.', expr: 'entschlossen' } },
        { cam: { over: ['asmus', 'sievers'] },
          say: { who: 'sievers', text: 'Niemand fährt allein. Wer getroffen wird, meldet sich – wir holen jeden heraus.', expr: 'nachdenklich' } },
        { cam: { from: F.p3(T0 - 0.02, 14, 4), to: F.p3(T0 - 0.03, 18, 6), look: F.p3(T0, 0, 1.4) },
          act: [{ who: 'asmus', walk: [F.off(T0, 0, 2.5, -4)], speed: 1.8, at: 0.5 }, { who: 'sievers', walk: [F.off(T0, 0, 12, -6)], speed: 1.6, at: 0.8 }],
          say: { who: 'asmus', text: 'Aufsitzen. Motoren an.', expr: 'entschlossen' }, dur: 3.5, fadeOut: 1 },
      ],
    });
    const outro = () => ({
      groundRel: true,
      location: ['Hinter der Sperrlinie', '07:15 Uhr'],
      cast: { asmus: cast('asmus', { pos: playerSpot(pz, 5, 2), yaw: F.yaw + 1.8, aim: -0.7 }) },
      beats: [
        { cam: { from: F.p3(0.7, -30, 18), to: F.p3(0.72, -24, 12), look: F.p3(0.8, 20, 1) }, dur: 5, fadeIn: 1,
          say: { who: 'amboss', text: 'Amboss: Funkstelle ist still. Gut gemacht, Graufalken. Die Artillerie schießt jetzt ins Leere.' } },
        { cam: { close: 'asmus', side: 0.35, dist: 0.95 },
          say: { who: 'asmus', text: 'Das war erst die Vorhut. Der Hauptverband kommt über die Höhe beim alten Flugplatz – und wir sind die Einzigen, die dort stehen.', expr: 'ernst' } },
        { cam: { from: F.p3(0.72, -10, 3), to: F.p3(0.7, -14, 5), look: F.p3(0.9, 0, 4) }, dur: 4, fadeOut: 1.4,
          say: { who: 'asmus', text: 'Munition auffüllen, Ketten prüfen. In einer Stunde sind wir unterwegs.', expr: 'nachdenklich' } },
      ],
    });
    return {
      cutscenes: { intro, outro },
      prepare(m) {
        const linie = [
          target(m, pz, 'pak', F.at(0.46, -45)),
          target(m, pz, 'pak', F.at(0.48, 40)),
          target(m, pz, 'bunker', F.at(0.52, 4)),
        ];
        const panzer = foeTank(m, pz, 'mbt', F.at(0.58, -20), { hold: true });
        m.set('linie', linie); m.set('panzer1', panzer);
        infantry(m, 'graben', 5, F.at(0.47, 10), { hold: true, r: 12 });
        m.set('funk', target(m, pz, 'funk', F.at(0.8, 28)));
        m.set('falke1', allyTank(m, pz, 'mbt', F.at(T0, -22), { name: 'Oberfeldwebel Asmus', side: -1 }));
        m.on('vehicle:destroyed', (e) => {
          const v = e && e.vehicle;
          if (!v) return;
          const f1 = m.get('falke1');
          if (f1 && v === f1.v) m.say('falke1', 'Falke 1 ist liegen geblieben! Wir steigen aus – kämpft weiter, Falke 2!');
          if (v.isEmplacement && v.kind === 'pak' && !m.get('pakSaid')) { m.set('pakSaid', true); crewSay(pz, 'Richtschütze', 'Pak brennt! Die zweite steht weiter rechts.'); }
        });
      },
      stages: [
        {
          id: 'start', name: 'Bereitstellung',
          checkpoint: { at: F.at(T0, 6), yaw: F.yaw },
          *run(m) {
            yield m.cutsceneAt('intro');
            m.tip(roleTip(pz), 9);
            yield 1.5;
            m.say('amboss', 'Amboss an Falke 2: Ihr habt Feuerfreiheit ab der Sperrlinie. Viel Glück.');
            const linie = [...m.get('linie'), m.get('panzer1')];
            yield destroy(m, 'linie', 'Durchbrich die Sperrlinie: Pak, Bunker und Panzer vernichten', linie, { label: 'Sperrlinie' });
            m.say('falke1', 'Linie ist offen! Falke 2, mir nach – die Funkstelle liegt rechts hinter dem Waldstück.');
          },
        },
        {
          id: 'funk', name: 'Funkstelle',
          checkpoint: { at: F.at(0.42, 10), yaw: F.yaw },
          setup(m) { for (const e of [...m.get('linie'), m.get('panzer1')]) { const v = e && e.v ? e.v : e; if (v && v.alive) v.destroy(null, 'kampagne'); } },
          *run(m) {
            // Gegenstoß: ein Panzer aus der Tiefe
            m.set('gegen', foeTank(m, pz, 'mbt', F.at(0.95, -30), { route: [F.at(0.75, -10)] }));
            infantry(m, 'funkwache', 4, F.at(0.78, 22), { hold: true, r: 8 });
            yield 2;
            m.say('korvan', 'Hier Rabe 7 – feindliche Panzer an der Linie! Erbitten Feuer auf Planquadrat Mirenfurt Nord!');
            yield 2;
            crewSay(pz, 'Richtschütze', 'Die Funkstelle ruft Artillerie! Wir müssen schneller sein.');
            yield destroy(m, 'funk', 'Zerstöre die Funkstelle (Sprenggranate)', [m.get('funk')], { label: 'Funkstelle' });
            m.say('korvan', 'Rabe 7, melden! Rabe 7 …');
            const g = m.get('gegen');
            if (g && g.v.alive) yield destroy(m, 'gegen', 'Wehre den Gegenstoß ab', [g], { label: 'Panzer' });
            yield 1.5;
            m.complete();
          },
        },
      ],
    };
  },
};

/** Punkt neben dem Spielerpanzer (dx rechts, dz vor) als [x,z] – für Sequenzen am Missionsende. */
function playerSpot(pz, dx, dz) {
  const v = pz.tank;
  if (!v) return [0, 0];
  const y = v.body.yaw(), p = v.position;
  return [p.x + Math.cos(y) * dx - Math.sin(y) * dz, p.z - Math.sin(y) * dx - Math.cos(y) * dz];
}

/* ====================================================================== P2 Höhe 214 */

export const P2 = {
  id: 'p2', number: 2, title: 'Höhe 214', short: 'Höhe 214',
  map: 'flugplatz', time: 'abend', weather: 'dunst', tank: 'mbt', models: ['mbt', 'spz'],
  type: 'Verteidigung · drei Angriffswellen', minutes: 18,
  summary: 'Der korvanische Hauptverband will über die Höhe am alten Flugplatz ins Tal. Halte mit Falke 1 die Stellung, bis die Kompanie heran ist – drei Wellen aus Panzern, Schützenpanzern und Panzerabwehrtrupps.',
  goals: ['In der Stellung bleiben (Höhe halten)', 'Drei Angriffswellen abwehren', 'Falke 1 möglichst nicht verlieren'],
  build(F, pz) {
    const T0 = 0.28, HOLD = F.at(T0, 0);
    const intro = () => ({
      groundRel: true,
      location: ['Höhe 214 · alter Flugplatz', '18:20 Uhr'],
      cast: {
        asmus: cast('asmus', { pos: F.off(T0, 0, 5.5, 0), yaw: F.yaw + 1.6, aim: -0.7 }),
        sievers: cast('sievers', { pos: F.off(T0, 0, 8, -2), yaw: F.yaw - 1.3, aim: -0.8 }),
      },
      beats: [
        { cam: { path: [F.p3(T0 + 0.25, 30, 30), F.p3(T0 + 0.1, 15, 14), F.p3(T0 + 0.02, 6, 5)], look: F.p3(T0, 0, 1.5) }, dur: 8, fadeIn: 1.4,
          say: { who: 'amboss', text: 'Amboss an Falken: Aufklärung meldet zwanzig Fahrzeuge im Anmarsch auf die Höhe. Die Kompanie braucht noch eine halbe Stunde.' } },
        { cam: { close: 'sievers', side: -0.4, dist: 0.9 },
          say: { who: 'sievers', text: 'Ihr zwei seid alles, was zwischen ihnen und dem Tal steht. Haltet die Höhe – aber verheizt euch nicht.', expr: 'ernst' } },
        { cam: { close: 'asmus', side: 0.35, dist: 0.9, push: 0.08 },
          say: { who: 'asmus', text: 'Rumpf in Deckung, nur der Turm schaut über die Kuppe. Schießen, zurücksetzen, neue Stellung. Wer stehen bleibt, wird gesehen.', expr: 'entschlossen' } },
        { cam: { over: ['sievers', 'asmus'] },
          say: { who: 'asmus', text: 'Und achtet auf die Trupps mit Panzerfäusten. Die kommen leise durchs hohe Gras.', expr: 'nachdenklich' } },
        { cam: { from: F.p3(T0 - 0.03, -12, 4), to: F.p3(T0 - 0.04, -16, 6), look: F.p3(T0 + 0.3, 0, 3) }, dur: 3.5, fadeOut: 1,
          say: { who: 'amboss', text: 'Erste Welle in vier Kilometern. Viel Glück, Graufalken.' } },
      ],
    });
    const outro = () => ({
      groundRel: true,
      location: ['Höhe 214', '19:05 Uhr'],
      cast: { asmus: cast('asmus', { pos: playerSpot(pz, 5, 1), yaw: F.yaw + 1.6, aim: -0.6 }), sievers: cast('sievers', { pos: playerSpot(pz, 7, -2), yaw: F.yaw - 1.4, aim: -0.8 }) },
      beats: [
        { cam: { from: F.p3(T0 + 0.05, 20, 14), to: F.p3(T0 + 0.03, 14, 8), look: F.p3(T0, 0, 2) }, dur: 5, fadeIn: 1,
          say: { who: 'amboss', text: 'Amboss: Die Kompanie ist auf der Höhe. Der Feind zieht sich zurück.' } },
        { cam: { close: 'sievers', side: 0.4, dist: 0.9 },
          say: { who: 'sievers', text: 'Ihr habt gehalten. Jetzt brauchen wir Treibstoff und Granaten – die Kolonne aus Ostrau steckt fest.', expr: 'nachdenklich' } },
        { cam: { close: 'asmus', side: -0.35, dist: 0.95 },
          say: { who: 'asmus', text: 'Unser Turmantrieb muss in die Werkstatt. Aber in der Reserve steht noch der alte Auerochs. Der hat schon meinen Vater gefahren.', expr: 'erleichtert' } },
        { cam: { from: F.p3(T0 - 0.02, 10, 3), to: F.p3(T0 - 0.03, 14, 5), look: F.p3(T0, 0, 1.5) }, dur: 4, fadeOut: 1.4,
          say: { who: 'sievers', text: 'Dann holt ihn aus der Halle. Morgen früh geleitet ihr die Kolonne.', expr: 'entschlossen' } },
      ],
    });
    // Wellen: Panzer/Schützenpanzer fahren auf die Höhe zu, Panzerabwehrtrupps schleichen über die Flanken
    const wave = (m, n, tanks, ifv, inf) => {
      const list = [];
      for (let i = 0; i < tanks; i++) list.push(foeTank(m, pz, 'mbt', F.at(0.92 + (i % 2) * 0.04, (i - (tanks - 1) / 2) * 45), { route: [F.at(0.6, (i - 0.5) * 30), F.at(T0 + 0.12, (i - 0.5) * 50)] }));
      for (let i = 0; i < ifv; i++) list.push(foeTank(m, pz, 'spz', F.at(0.88, 70 * (i % 2 ? 1 : -1)), { route: [F.at(0.55, 60 * (i % 2 ? 1 : -1)), F.at(T0 + 0.1, 40 * (i % 2 ? 1 : -1))] }));
      if (inf) infantry(m, `trupp${n}`, inf, F.at(0.62, n % 2 ? 55 : -55), { attack: HOLD, cls: 'pionier', r: 6 });
      m.set(`welle${n}`, list);
      return list;
    };
    const holdCheck = (m) => {
      m.zone('hoehe', { at: HOLD, r: 70 });
      let out = 0;
      m.every((dt) => {
        if (m.get('frei')) return true;
        if (!m.inZone('hoehe')) {
          out += dt;
          if (out > 1 && !m.get('warn')) { m.set('warn', true); m.toast('Zurück auf die Höhe! Die Stellung darf nicht fallen.', 'warn', 4); }
          if (out > 35) { m.fail('Die Höhe ist gefallen – ihr habt die Stellung verlassen.'); return true; }
        } else { out = 0; m.set('warn', false); }
        return false;
      });
    };
    return {
      cutscenes: { intro, outro },
      prepare(m) {
        m.set('falke1', allyTank(m, pz, 'mbt', F.at(T0, -30), { name: 'Oberfeldwebel Asmus', hold: true }));
        m.on('vehicle:destroyed', (e) => { const f1 = m.get('falke1'); if (f1 && e && e.vehicle === f1.v) m.say('falke1', 'Falke 1 getroffen – wir steigen aus! Falke 2, die Höhe gehört jetzt dir allein!'); });
      },
      stages: [
        {
          id: 'start', name: 'Erste Welle',
          checkpoint: { at: F.at(T0, 6), yaw: F.yaw },
          *run(m) {
            yield m.cutsceneAt('intro');
            holdCheck(m);
            m.objective('halten', 'Halte die Höhe 214', {});
            m.tip(roleTip(pz), 8);
            yield 6;
            const w = wave(m, 1, 2, 0, 0);
            m.say('falke1', 'Zwei Panzer, Zwölf Uhr, auf der Straße. Wir schießen zuerst.');
            yield destroy(m, 'w1', 'Erste Welle abwehren', w, { label: 'Panzer' });
            m.say('amboss', 'Gut. Die nächste Welle ist schon unterwegs – mit Schützenpanzern und Infanterie.');
            yield 4;
          },
        },
        {
          id: 'welle2', name: 'Zweite Welle',
          checkpoint: { at: F.at(T0, 6), yaw: F.yaw },
          setup(m) { holdCheck(m); m.objective('halten', 'Halte die Höhe 214', { quiet: true }); },
          *run(m) {
            const w = wave(m, 2, 1, 2, 5);
            yield 3;
            crewSay(pz, 'Kommandant', 'Schützenpanzer links und rechts! Achtung, abgesessene Trupps mit Panzerfäusten!');
            yield destroy(m, 'w2', 'Zweite Welle abwehren (Panzer und Schützenpanzer)', w, { label: 'Feind' });
            const tr = m.waves && m.waves.get('trupp2');
            if (tr && tr.bots.some((b) => b.alive)) { m.say('falke1', 'Infanterie noch im Gras vor uns – Kanister oder Maschinengewehr!'); const t0 = m.elapsed; yield m.until(() => !tr.bots.some((b) => b.alive) || m.elapsed - t0 > 60); }
            m.say('amboss', 'Letzte Welle formiert sich. Die Kompanie ist in zehn Minuten da – haltet durch.');
            yield 4;
          },
        },
        {
          id: 'welle3', name: 'Letzte Welle',
          checkpoint: { at: F.at(T0, 6), yaw: F.yaw },
          setup(m) { holdCheck(m); m.objective('halten', 'Halte die Höhe 214', { quiet: true }); },
          *run(m) {
            const w = wave(m, 3, 3, 1, 4);
            m.say('korvan', 'Alle Einheiten: Höhe 214 nehmen, koste es, was es wolle!');
            yield 2;
            crewSay(pz, 'Richtschütze', 'Drei Panzer in breiter Front. Ich nehme den linken.');
            yield destroy(m, 'w3', 'Letzte Welle abwehren', w, { label: 'Feind' });
            m.set('frei', true);
            m.done('halten');
            yield 1.5;
            m.complete();
          },
        },
      ],
    };
  },
};

/* ====================================================================== P3 Geleit nach Ostrau */

export const P3 = {
  id: 'p3', number: 3, title: 'Geleit nach Ostrau', short: 'Geleit',
  map: 'grenzland', time: 'vormittag', weather: 'bewoelkt', tank: 'kk', models: ['kk', 'mbt', 'transporter'],
  type: 'Geleitschutz · KP-68 „Auerochs“ (nur Optik)', minutes: 16,
  summary: 'Treibstoff, Munition und Sanitätsmaterial müssen durchs Tal. Geleite die drei Transporter der Kolonne mit dem alten KP-68 „Auerochs“ – ohne Wärmebild, mit Treibspiegel, Hohlladung und Quetschkopf. Mindestens zwei Wagen müssen ankommen.',
  goals: ['Die Kolonne begleiten (nicht zu weit zurückfallen)', 'Hinterhalt mit Pak und Infanterie zerschlagen', 'Angriff aus der Flanke abwehren', 'Mindestens zwei Transporter ans Ziel bringen'],
  build(F, pz) {
    const T0 = 0.05;
    const ROUTE = [F.at(0.2, 4), F.at(0.4, 0), F.at(0.6, -6), F.at(0.8, -2), F.at(0.9, 0)];
    const intro = () => ({
      groundRel: true,
      location: ['Grenzland · Straße nach Ostrau', '09:30 Uhr · zweiter Kriegstag'],
      cast: {
        asmus: cast('asmus', { pos: F.off(T0, 0, 5, 1), yaw: F.yaw + 1.7, aim: -0.7 }),
        ollmann: cast('ollmann', { pos: F.off(T0, 0, 6.5, -2.5), yaw: F.yaw - 2.2, aim: -0.8 }),
      },
      beats: [
        { cam: { path: [F.p3(T0 - 0.04, 30, 18), F.p3(T0, 22, 8), F.p3(T0 + 0.02, 12, 4)], look: F.p3(T0, 0, 1.5) }, dur: 7, fadeIn: 1.4,
          say: { who: 'amboss', text: 'Amboss an Falke 2: Die Kolonne aus Ostrau ist bereit. Drei Wagen – Treibstoff, Granaten, Sanitätsmaterial.' } },
        { cam: { close: 'ollmann', side: 0.4, dist: 0.95 },
          say: { who: 'ollmann', text: 'Der Auerochs startet beim ersten Versuch, Herr Oberfeldwebel. Alt, aber ehrlich.', expr: 'erleichtert' } },
        { cam: { close: 'asmus', side: -0.35, dist: 0.9, push: 0.08 },
          say: { who: 'asmus', text: 'Kein Wärmebild, kein Laser. Ihr seht nur, was das Auge sieht. Treibspiegel gegen Panzer, Quetschkopf gegen Stellungen.', expr: 'ernst' } },
        { cam: { over: ['ollmann', 'asmus'] },
          say: { who: 'asmus', text: 'Fahrt vorn, aber nicht zu weit. Die Wagen sind nicht gepanzert. Ohne sie steht morgen die ganze Kompanie still.', expr: 'entschlossen' } },
        { cam: { from: F.p3(T0 + 0.04, -8, 3), to: F.p3(T0 + 0.05, -12, 5), look: F.p3(T0, 6, 1.5) }, dur: 3.5, fadeOut: 1,
          say: { who: 'kolonne', text: 'Kolonne an Falke 2: Wir folgen euch. Fahrt nicht zu schnell.' } },
      ],
    });
    const outro = () => ({
      groundRel: true,
      location: ['Sammelraum Ostrau', '10:50 Uhr'],
      cast: { asmus: cast('asmus', { pos: playerSpot(pz, 5, 1), yaw: F.yaw + 1.6, aim: -0.6 }) },
      beats: [
        { cam: { from: F.p3(0.8, 26, 16), to: F.p3(0.84, 18, 9), look: F.p3(0.9, 0, 1.5) }, dur: 5, fadeIn: 1,
          say: { who: 'kolonne', text: 'Kolonne angekommen. Danke, Falke 2. Ohne euch wären wir im Graben liegen geblieben.' } },
        { cam: { close: 'asmus', side: 0.35, dist: 0.9 },
          say: { who: 'asmus', text: 'Heute Nacht greifen wir ihr Lager an der Behelfsbrücke an. Dafür bekommt ihr Falke 2 zurück – mit Wärmebild.', expr: 'entschlossen' } },
        { cam: { from: F.p3(0.86, -6, 3), to: F.p3(0.85, -10, 5), look: F.p3(0.9, 0, 2) }, dur: 4, fadeOut: 1.4,
          say: { who: 'asmus', text: 'Ruht euch aus. Im Dunkeln sieht man nur, was warm ist.', expr: 'nachdenklich' } },
      ],
    });
    return {
      cutscenes: { intro, outro },
      prepare(m) {
        const later = m.startIndex >= 1;
        const base = later ? 0.42 : T0;
        const c = convoy(m, 'kolonne', [
          { type: 'transporter', at: F.at(base - 0.03, 10), yaw: F.yaw, name: 'Gefr. Albrecht' },
          { type: 'transporter', at: F.at(base - 0.06, 10), yaw: F.yaw, name: 'Gefr. Pohl' },
          { type: 'transporter', at: F.at(base - 0.09, 10), yaw: F.yaw, name: 'OGefr. Kuhn' },
        ]);
        m.set('kolonne', c);
        // Hinterhalt 1 (Pak + Panzerabwehrtrupp), Flankenangriff 2 (zwei Panzer, Kalter Krieg)
        m.set('pak', target(m, pz, 'pak', F.at(0.45, 70)));
        m.set('bunker', target(m, pz, 'bunker', F.at(0.5, -60)));
        const lost = () => c.list.filter((e) => !e.v.alive || e.v.wreck).length;
        m.on('vehicle:destroyed', (e) => {
          if (!e || !c.list.some((x) => x.v === e.vehicle)) return;
          const n = lost();
          if (n >= 2) m.fail('Zwei Transporter verloren – die Kolonne kann nicht weiter.');
          else m.say('kolonne', 'Wagen getroffen! Wir verlieren einen Wagen – Falke 2, schützt den Rest!');
        });
        // Kolonne fährt nur, wenn der Panzer in der Nähe ist
        m.every(() => {
          if (!c.route || m.get('angekommen')) return !!m.get('angekommen');
          const lead = c.lead();
          if (!lead) return false;
          const d = lead.v.position.distanceTo(playerPos(m));
          const halt = d > 85 || m.get('stopp');
          if (halt && c.moving) { c.stop(); if (d > 85) m.toast('Die Kolonne wartet auf dich.', 'tip', 2.4); }
          else if (!halt && !c.moving) c.go(remaining(m, c, ROUTE), { speed: 6, gap: 16 });
          return false;
        });
      },
      stages: [
        {
          id: 'start', name: 'Abfahrt',
          checkpoint: { at: F.at(T0 + 0.02, 6), yaw: F.yaw },
          *run(m) {
            yield m.cutsceneAt('intro');
            m.tip(roleTip(pz), 8);
            const c = m.get('kolonne');
            c.route = ROUTE.map((q) => m.vec(q));
            m.objective('geleit', 'Geleite die Kolonne nach Ostrau', { pos: () => (c.lead() ? c.lead().v.position : null), label: 'Kolonne', noDrive: false });
            yield 3;
            crewSay(pz, 'Fahrer', 'Motor läuft. Der alte Diesel zieht gut.');
            const ahead = (t) => () => (c.lead() && F.prog(c.lead().v.position) > t) || F.prog(playerPos(m)) > t + 0.04;
            yield m.until(ahead(0.3));
            m.set('stopp', true);
            infantry(m, 'hinterhalt', 6, F.at(0.43, 45), { attack: 'player', cls: 'pionier', r: 8 });
            m.say('kolonne', 'Beschuss von rechts! Kolonne hält!');
            crewSay(pz, 'Kommandant', 'Pak rechts am Waldrand! Und Infanterie im Graben – Kanister!');
            yield destroy(m, 'hinterhalt', 'Zerschlage den Hinterhalt (Pak, Bunker)', [m.get('pak'), m.get('bunker')], { label: 'Hinterhalt' });
            m.set('stopp', false);
            m.say('kolonne', 'Weg ist frei, wir fahren weiter.');
          },
        },
        {
          id: 'flanke', name: 'Flankenangriff',
          checkpoint: { at: F.at(0.44, 4), yaw: F.yaw },
          setup(m) { for (const k of ['pak', 'bunker']) { const v = m.get(k); if (v && v.alive) v.destroy(null, 'kampagne'); } const c = m.get('kolonne'); c.route = ROUTE.map((q) => m.vec(q)); m.objective('geleit', 'Geleite die Kolonne nach Ostrau', { pos: () => (c.lead() ? c.lead().v.position : null), label: 'Kolonne', quiet: true }); },
          *run(m) {
            const c = m.get('kolonne');
            yield m.until(() => (c.lead() && F.prog(c.lead().v.position) > 0.55) || F.prog(playerPos(m)) > 0.6);
            const f = [foeTank(m, pz, 'kk', F.at(0.7, -140), { route: [F.at(0.66, -50)] }), foeTank(m, pz, 'kk', F.at(0.76, -150), { route: [F.at(0.72, -60)] })];
            m.set('stopp', true);
            m.say('kolonne', 'Panzer links auf dem Hang! Zwei Stück!');
            crewSay(pz, 'Kommandant', 'Panzer links – Treibspiegel! Wir stellen uns zwischen sie und die Wagen.');
            yield destroy(m, 'flanke', 'Wehre den Flankenangriff ab', f, { label: 'Panzer' });
            m.set('stopp', false);
            m.say('kolonne', 'Danke, Falke 2. Noch zwei Kilometer.');
            yield m.until(() => c.arrived(16) || (c.lead() && (c.lead().v.position.distanceTo(m.vec(ROUTE[ROUTE.length - 1])) < 22 || F.prog(c.lead().v.position) > 0.87)));
            m.set('angekommen', true);
            c.stop();
            m.done('geleit');
            yield 1;
            m.complete();
          },
        },
      ],
    };
  },
};

/** Restliche Wegpunkte ab dem nächsten vor dem Führungsfahrzeug. */
function remaining(m, c, route) {
  const lead = c.lead();
  const pts = route.map((q) => m.vec(q));
  if (!lead) return route;
  let best = 0, bd = Infinity;
  pts.forEach((p, i) => { const d = p.distanceTo(lead.v.position); if (d < bd) { bd = d; best = i; } });
  // nächsten Punkt überspringen, wenn er schon (fast) erreicht ist
  if (bd < 15 && best < pts.length - 1) best++;
  return route.slice(best);
}

void aliveOf;
