// NULLPUNKT — Panzer-Kampagne „Eisenwind“, Missionen 4–6 (frei erfunden):
//   P4 „Nachtfalke“        Brandwald, Nacht (abgedunkeltes Abendbild) – Überfall auf Nachschublager und Behelfsbrücke, nur mit
//                         Wärmebild/Restlicht sind die Panzer im Waldrand zu sehen
//   P5 „Die Furt“          Niemandsland, Morgennebel – Erinnerung: Asmus’ Großvater Emil im MP-4 „Bison“ vor achtzig Jahren,
//                         nur Optik und Winkelspiegel, Pak-Riegel, schwerer SP-6 „Moloch“ (nur von der Seite verwundbar)
//   P6 „Brücken von Mirenfurt“ Stadtkern, Mittag – Stadtkampf mit dem Infanteriezug „Kiesel“: Panzerabwehrtrupps in den
//                         Häusern, Pak am Markt, Bunker am Brückenkopf; Ende: Waffenstillstand
import { foeTank, allyTank, target, destroy, infantry, playerPos, crewSay, cast, roleTip } from './kit.js?v=20261115041504';

/** Punkt neben dem Spielerpanzer (dx rechts, dz vor) als [x,z]. */
function playerSpot(pz, dx, dz) {
  const v = pz.tank;
  if (!v) return [0, 0];
  const y = v.body.yaw(), p = v.position;
  return [p.x + Math.cos(y) * dx - Math.sin(y) * dz, p.z - Math.sin(y) * dx - Math.cos(y) * dz];
}

const killIfAlive = (list) => { for (const e of list) { const v = e && e.v ? e.v : e; if (v && v.alive) v.destroy(null, 'kampagne'); } };

/* ====================================================================== P4 Nachtfalke */

export const P4 = {
  id: 'p4', number: 4, title: 'Nachtfalke', short: 'Nachtfalke',
  map: 'brandwald', time: 'abend', weather: 'bewoelkt', tank: 'mbt', models: ['mbt', 'spz'],
  type: 'Nachtgefecht · Wärmebild · Lager und Brücke', minutes: 16,
  summary: 'Nachts greift Falke 2 hinter der Front an: Zerstöre das korvanische Nachschublager im Brandwald und die Behelfsbrücke, über die ihr Nachschub rollt. Im Dunkeln verraten sich Panzer nur im Wärmebild.',
  goals: ['Wärmebild einschalten (G in Optik oder Periskop)', 'Nachschublager zerstören', 'Behelfsbrücke zerstören', 'Zurück zum Sammelpunkt'],
  build(F, pz) {
    const T0 = 0.08;
    const intro = () => ({
      groundRel: true,
      location: ['Brandwald · hinter der Front', '23:40 Uhr'],
      cast: {
        asmus: cast('asmus', { pos: F.off(T0, 0, 5, 0.5), yaw: F.yaw + 1.7, aim: -0.7 }),
        sievers: cast('sievers', { pos: F.off(T0, 0, 7, -2), yaw: F.yaw - 1.3, aim: -0.8 }),
      },
      beats: [
        { cam: { path: [F.p3(T0 + 0.1, 25, 16), F.p3(T0 + 0.04, 14, 7), F.p3(T0 + 0.01, 8, 3.5)], look: F.p3(T0, 0, 1.5) }, dur: 7, fadeIn: 1.6,
          say: { who: 'sievers', text: 'Die Korvaner bringen ihren Nachschub nachts über eine Behelfsbrücke im Brandwald. Daneben liegt ihr Lager.', expr: 'ernst' } },
        { cam: { close: 'asmus', side: 0.35, dist: 0.9 },
          say: { who: 'asmus', text: 'Kein Licht, kein Funk ohne Not. Im Wärmebild sehen wir ihre Motoren lange bevor sie uns hören.', expr: 'nachdenklich' } },
        { cam: { close: 'sievers', side: -0.4, dist: 0.9, push: 0.08 },
          say: { who: 'sievers', text: 'Erst das Lager, dann die Brücke. Danach sofort zurück. Ich will euch vor Sonnenaufgang wiedersehen.', expr: 'entschlossen' } },
        { cam: { from: F.p3(T0 - 0.02, -10, 3), to: F.p3(T0 - 0.03, -14, 5), look: F.p3(T0 + 0.3, 0, 2) }, dur: 3.5, fadeOut: 1,
          say: { who: 'asmus', text: 'Falke 2, ihr fahrt allein. Falke 1 sichert den Rückweg.', expr: 'ernst' } },
      ],
    });
    const outro = () => ({
      groundRel: true,
      location: ['Sammelpunkt', '01:20 Uhr'],
      cast: { asmus: cast('asmus', { pos: playerSpot(pz, 5, 1), yaw: F.yaw + 1.7, aim: -0.6 }) },
      beats: [
        { cam: { from: F.p3(0.2, 18, 12), to: F.p3(0.18, 12, 7), look: F.p3(0.15, 0, 2) }, dur: 5, fadeIn: 1,
          say: { who: 'amboss', text: 'Amboss: Lager und Brücke brennen. Der Hauptverband steht ohne Treibstoff.' } },
        { cam: { close: 'asmus', side: 0.35, dist: 0.95 },
          say: { who: 'asmus', text: 'Mein Großvater hat einmal gesagt: An der Furt von Mirenfurt entscheidet sich jeder Krieg in diesem Tal. Er war dabei – vor achtzig Jahren.', expr: 'nachdenklich' } },
        { cam: { close: 'asmus', side: -0.3, dist: 0.85, push: 0.05 }, dur: 4.5, fadeOut: 1.6,
          say: { who: 'asmus', text: 'Setzt euch. Ich erzähle euch, wie es damals war.', expr: 'erleichtert' } },
      ],
    });
    return {
      night: { dark: 0.4, vis: 0.38 },
      cutscenes: { intro, outro },
      prepare(m) {
        m.set('lager', [target(m, pz, 'lager', F.at(0.6, 30)), target(m, pz, 'lager', F.at(0.64, 55))]);
        m.set('bruecke', target(m, pz, 'bruecke', F.at(0.82, 0)));
        m.set('wache', [foeTank(m, pz, 'mbt', F.at(0.55, -45), { hold: true }), foeTank(m, pz, 'spz', F.at(0.68, 80), { hold: true })]);
        infantry(m, 'lagerwache', 5, F.at(0.62, 40), { hold: true, r: 10 });
      },
      stages: [
        {
          id: 'start', name: 'Anmarsch',
          checkpoint: { at: F.at(T0, 6), yaw: F.yaw },
          *run(m) {
            yield m.cutsceneAt('intro');
            m.tip(`Wärmebild: ${m.key('grenade', 'WB')} in der Optik oder im Periskop · ${m.key('verband', 'N')} Polarität/Restlicht`, 9);
            yield 2;
            m.tip(roleTip(pz), 8);
            const th = () => !!(m.G.vehicles && m.G.vehicles.thermal && m.G.vehicles.thermal.on);
            m.objective('wb', 'Schalte das Wärmebild ein', { optional: true });
            m.every(() => { if (th()) { m.done('wb'); return true; } return false; });
            yield destroy(m, 'lager', 'Zerstöre das Nachschublager', m.get('lager'), { label: 'Lager' });
            m.say('korvan', 'Alarm im Lager! Feindlicher Panzer im Wald!');
            crewSay(pz, 'Richtschütze', 'Lager brennt! Jetzt wissen sie, dass wir hier sind.');
          },
        },
        {
          id: 'bruecke', name: 'Brücke',
          checkpoint: { at: F.at(0.5, 0), yaw: F.yaw },
          setup(m) { killIfAlive(m.get('lager')); },
          *run(m) {
            const gegen = [foeTank(m, pz, 'mbt', F.at(0.98, -20), { route: [F.at(0.78, -10)] })];
            m.set('gegen', gegen);
            yield 2;
            m.say('falke1', 'Falke 1: Motorengeräusch jenseits der Brücke. Da kommt einer.');
            yield destroy(m, 'bruecke', 'Zerstöre die Behelfsbrücke (Sprenggranate)', [m.get('bruecke')], { label: 'Brücke' });
            m.say('amboss', 'Brücke ist unten. Gut gemacht – und jetzt raus da!');
            const left = [...gegen, ...m.get('wache')].filter((e) => e && e.v.alive);
            if (left.length) m.objective('frei', 'Feindpanzer in der Nähe ausschalten (optional)', { optional: true });
          },
        },
        {
          id: 'rueckzug', name: 'Rückweg',
          checkpoint: { at: F.at(0.7, 0), yaw: F.back },
          setup(m) { killIfAlive([m.get('bruecke'), ...m.get('lager')]); },
          *run(m) {
            yield m.reach('sammel', 'Zurück zum Sammelpunkt', { at: F.at(0.15, 0), r: 30, label: 'Sammelpunkt' });
            m.complete();
          },
        },
      ],
    };
  },
};

/* ====================================================================== P5 Die Furt (Erinnerung) */

export const P5 = {
  id: 'p5', number: 5, title: 'Die Furt', short: 'Die Furt',
  map: 'niemandsland', time: 'morgen', weather: 'morgennebel', tank: 'wk2', models: ['wk2', 'wk2h', 'wk2j'],
  type: 'Erinnerung · MP-4 „Bison“ · nur Optik', minutes: 15,
  summary: 'Vor achtzig Jahren: Wachtmeister Emil Asmus führt einen MP-4 „Bison“ gegen den Pak-Riegel vor der Furt von Mirenfurt. Kein Wärmebild, kein Laser – Winkelspiegel, Zielfernrohr und Entfernung schätzen. Der schwere „Moloch“ ist von vorn kaum zu knacken.',
  goals: ['Pak-Riegel an der Hecke ausschalten', 'Den Jagdpanzer im Hinterhalt finden', 'Den schweren SP-6 „Moloch“ von der Seite bekämpfen', 'Bunker an der Furt zerstören'],
  build(F, pz) {
    const T0 = 0.07;
    const intro = () => ({
      groundRel: true,
      location: ['Furt von Mirenfurt', 'Vor achtzig Jahren · Morgennebel'],
      cast: {
        emil: cast('emil', { pos: F.off(T0, 0, 4.5, 1), yaw: F.yaw + 1.8, aim: -0.6 }),
      },
      beats: [
        { cam: { path: [F.p3(T0 + 0.2, -40, 22), F.p3(T0 + 0.08, -20, 10), F.p3(T0 + 0.02, -8, 4)], look: F.p3(T0, 0, 1.5) }, dur: 8, fadeIn: 2.2,
          say: { who: 'erzaehler', text: 'Mein Großvater Emil war zweiundzwanzig. Sein Panzer hieß Bison, und sein Zielfernrohr war alles, was er hatte.' } },
        { cam: { close: 'emil', side: 0.4, dist: 0.9, push: 0.08 },
          say: { who: 'emil', text: 'Vor uns die Hecke, dahinter Pak. Wer sich zeigt, bekommt die erste Granate. Also zeigen wir uns nicht.', expr: 'ernst' } },
        { cam: { close: 'emil', side: -0.35, dist: 1.0 },
          say: { who: 'erzaehler', text: 'An der Furt stand ihr schwerer Moloch. Von vorn prallte alles an ihm ab. Emil wusste das.' } },
        { cam: { from: F.p3(T0 - 0.02, 10, 3), to: F.p3(T0 - 0.03, 14, 5), look: F.p3(T0 + 0.4, 0, 3) }, dur: 4, fadeOut: 1.2,
          act: [{ who: 'emil', walk: [F.off(T0, 0, 1.5, -2)], speed: 1.6, at: 0.4 }],
          say: { who: 'emil', text: 'Aufsitzen. Und betet nicht ums Glück – betet, dass wir alle heimkommen.', expr: 'entschlossen' } },
      ],
    });
    const outro = () => ({
      groundRel: true,
      location: ['Furt von Mirenfurt', 'Heute'],
      cast: { asmus: cast('asmus', { pos: playerSpot(pz, 5, 1), yaw: F.yaw + 1.7, aim: -0.6 }) },
      beats: [
        { cam: { from: F.p3(0.7, 20, 14), to: F.p3(0.72, 14, 8), look: F.p3(0.8, 0, 2) }, dur: 6, fadeIn: 1.4,
          say: { who: 'erzaehler', text: 'Sie kamen über die Furt. Nicht alle. Emil hat den Namen jedes Einzelnen bis zu seinem letzten Tag gewusst.' } },
        { cam: { close: 'asmus', side: 0.35, dist: 0.95 },
          say: { who: 'asmus', text: 'Morgen fahren wir nach Mirenfurt. Die Stadt, die Brücken – genau dort, wo er damals stand. Diesmal mit Leutnant Wendts Infanterie.', expr: 'entschlossen' } },
        { cam: { close: 'asmus', side: -0.3, dist: 0.85 }, dur: 4, fadeOut: 1.6,
          say: { who: 'asmus', text: 'Und diesmal kommen wir alle heim.', expr: 'nachdenklich' } },
      ],
    });
    return {
      cutscenes: { intro, outro },
      prepare(m) {
        m.set('pak', [target(m, pz, 'pak', F.at(0.4, -35)), target(m, pz, 'pak', F.at(0.42, 30))]);
        m.set('stier', foeTank(m, pz, 'wk2j', F.at(0.55, 75), { hold: true }));
        m.set('moloch', foeTank(m, pz, 'wk2h', F.at(0.72, -5), { hold: true }));
        m.set('bunker', target(m, pz, 'bunker', F.at(0.8, 30)));
        infantry(m, 'hecke', 5, F.at(0.42, 0), { hold: true, r: 14 });
        m.on('vehicle:ricochet', (e) => {
          const mo = m.get('moloch');
          if (mo && e && e.vehicle === mo.v && !m.get('ricoSaid')) { m.set('ricoSaid', true); m.say('emil', 'Abpraller! Von vorn hat das keinen Sinn – wir müssen ihm in die Seite!'); }
        });
      },
      stages: [
        {
          id: 'start', name: 'Hecke',
          checkpoint: { at: F.at(T0, 6), yaw: F.yaw },
          *run(m) {
            yield m.cutsceneAt('intro');
            m.ui && m.ui.card('Erinnerung', 'Die Furt', 'Vor achtzig Jahren · MP-4 „Bison“', true);
            yield 3.5;
            m.ui && m.ui.card('', '', '', false);
            m.tip('Nur Optik: kein Wärmebild, kein Laser. Entfernung über die Strichplatte schätzen; im Stand schießen.', 9);
            yield 2;
            m.tip(roleTip(pz), 8);
            yield destroy(m, 'pak', 'Schalte den Pak-Riegel an der Hecke aus', m.get('pak'), { label: 'Pak' });
            m.say('emil', 'Riegel ist offen. Langsam vor – rechts im Gebüsch hat sich etwas bewegt.');
            const st = m.get('stier');
            if (st && st.v.alive) yield destroy(m, 'stier', 'Finde und vernichte den Jagdpanzer im Hinterhalt', [st], { label: 'Jagdpanzer' });
          },
        },
        {
          id: 'moloch', name: 'Moloch',
          checkpoint: { at: F.at(0.4, 0), yaw: F.yaw },
          setup(m) { killIfAlive([...m.get('pak'), m.get('stier')]); },
          *run(m) {
            m.say('erzaehler', 'Dann sah Emil ihn: den Moloch, eingegraben vor der Furt. Achtundachtzig Millimeter, hundert Millimeter Stahl vorn.');
            yield 2;
            m.tip('Der SP-6 „Moloch“ hält Panzergranaten von vorn aus. Über die Flanke fahren und die Seite treffen.', 8);
            yield destroy(m, 'moloch', 'Bekämpfe den „Moloch“ – von der Seite!', [m.get('moloch')], { label: 'Moloch' });
            m.say('emil', 'Er brennt. Die Besatzung springt ab – lasst sie gehen.');
            yield destroy(m, 'bunker', 'Zerstöre den Bunker an der Furt', [m.get('bunker')], { label: 'Bunker' });
            yield 1.5;
            m.complete();
          },
        },
      ],
    };
  },
};

/* ====================================================================== P6 Brücken von Mirenfurt */

export const P6 = {
  id: 'p6', number: 6, title: 'Brücken von Mirenfurt', short: 'Mirenfurt',
  map: 'stadtkern', mapFallback: 'altstadt', time: 'mittag', weather: 'dunst', tank: 'mbt', models: ['mbt', 'spz'],
  type: 'Stadtkampf · mit Infanterie „Kiesel“', minutes: 18,
  summary: 'Mirenfurt: Gassen, Dächer, Brücken. Mit dem Infanteriezug von Leutnant Wendt rückst du durch die Stadt vor. Panzerabwehrtrupps lauern in den Häusern – die Infanterie schützt dich, du schützt die Infanterie.',
  goals: ['Mit „Kiesel“ zum Marktplatz vorrücken', 'Pak und Panzer am Markt vernichten', 'Brückenkopf (Bunker) nehmen', 'Die Brücke erreichen'],
  build(F, pz) {
    const T0 = 0.06;
    const intro = () => ({
      groundRel: true,
      location: ['Mirenfurt · Altstadt', '12:10 Uhr · fünfter Kriegstag'],
      cast: {
        asmus: cast('asmus', { pos: F.off(T0, 0, 5, 0.5), yaw: F.yaw + 1.7, aim: -0.7 }),
        wendt: cast('wendt', { pos: F.off(T0, 0, 7, -1.5), yaw: F.yaw - 1.4, aim: -0.6 }),
      },
      beats: [
        { cam: { path: [F.p3(T0 + 0.12, 10, 22), F.p3(T0 + 0.05, 8, 10), F.p3(T0 + 0.01, 7, 3.5)], look: F.p3(T0, 0, 1.5) }, dur: 7, fadeIn: 1.4,
          say: { who: 'amboss', text: 'Amboss an Falke 2 und Kiesel: Die Korvaner halten die Brücken von Mirenfurt. Wir nehmen die Stadt zurück – Haus für Haus.' } },
        { cam: { close: 'wendt', side: 0.4, dist: 0.9 },
          say: { who: 'wendt', text: 'Leutnant Wendt, Zug Kiesel. In den Gassen seid ihr blind – wir sind eure Augen. Und ihr seid unser Schild.', expr: 'entschlossen' } },
        { cam: { close: 'asmus', side: -0.35, dist: 0.9 },
          say: { who: 'asmus', text: 'Fenster und Dächer im Auge behalten. Panzerfäuste kommen von oben. Sprenggranate in das Fenster, nicht in die Straße.', expr: 'ernst' } },
        { cam: { over: ['asmus', 'wendt'] },
          say: { who: 'wendt', text: 'Und schießt nicht in die Kirche. Da drin sitzen noch Leute aus der Stadt.', expr: 'nachdenklich' } },
        { cam: { from: F.p3(T0 + 0.02, -8, 3), to: F.p3(T0 + 0.03, -12, 5), look: F.p3(T0 + 0.2, 0, 3) }, dur: 3.5, fadeOut: 1,
          act: [{ who: 'wendt', walk: [F.off(T0, 0, 6, 8)], speed: 2.2, at: 0.3 }],
          say: { who: 'kiesel', text: 'Kiesel vorgehen! Falke 2 folgt.' } },
      ],
    });
    const outro = () => ({
      groundRel: true,
      location: ['Brücke von Mirenfurt', '13:40 Uhr'],
      cast: {
        asmus: cast('asmus', { pos: playerSpot(pz, 5, 1), yaw: F.yaw + 1.7, aim: -0.6 }),
        wendt: cast('wendt', { pos: playerSpot(pz, 7, -1.5), yaw: F.yaw - 1.4, aim: -0.6 }),
        sievers: cast('sievers', { pos: playerSpot(pz, 8.5, 1.5), yaw: F.yaw - 2.2, aim: -0.7 }),
      },
      beats: [
        { cam: { from: F.p3(0.85, 18, 16), to: F.p3(0.82, 12, 9), look: F.p3(0.8, 0, 2) }, dur: 6, fadeIn: 1.2,
          say: { who: 'vesk', text: 'Hier Oberst Vesk an die veldmärkischen Truppen. Wir räumen Mirenfurt. Ich bitte um Waffenruhe für unsere Verwundeten.' } },
        { cam: { close: 'sievers', side: 0.4, dist: 0.9 },
          say: { who: 'sievers', text: 'Waffenruhe gewährt. Holt eure Leute, Oberst. Niemand schießt mehr auf dieser Brücke.', expr: 'ernst' } },
        { cam: { close: 'wendt', side: -0.35, dist: 0.9 },
          say: { who: 'wendt', text: 'Die Leute aus der Kirche sind unverletzt. Danke, Falke 2. Ihr habt keinen von uns allein gelassen.', expr: 'erleichtert' } },
        { cam: { close: 'asmus', side: 0.35, dist: 0.95, push: 0.06 },
          say: { who: 'asmus', text: 'Großvater, wir sind an deiner Furt. Und diesmal kommen alle heim.', expr: 'nachdenklich' } },
        { cam: { from: F.p3(0.78, -16, 6), to: F.p3(0.76, -22, 14), look: F.p3(0.85, 0, 2) }, dur: 5, fadeOut: 2,
          say: { who: 'amboss', text: 'Amboss an alle Falken: Auftrag erfüllt. Sammeln am Markt. Ende.' } },
      ],
    });
    return {
      cutscenes: { intro, outro },
      prepare(m) {
        const later = m.startIndex >= 1;
        const at = later ? 0.4 : T0;
        m.allies([
          { role: 'wendt', name: 'Leutnant Wendt', at: F.at(at + 0.02, 6) },
          { role: 'kiesel1', name: 'Uffz. Berger', at: F.at(at + 0.02, 9) },
          { role: 'kiesel2', name: 'Gefr. Lind', at: F.at(at + 0.01, 7) },
          { role: 'kiesel3', name: 'Gefr. Haupt', at: F.at(at, 9) },
        ]);
        m.set('markt', [target(m, pz, 'pak', F.at(0.45, 12)), foeTank(m, pz, 'mbt', F.at(0.52, -8), { hold: true })]);
        m.set('kopf', [target(m, pz, 'bunker', F.at(0.72, 0)), foeTank(m, pz, 'spz', F.at(0.76, 18), { hold: true })]);
      },
      stages: [
        {
          id: 'start', name: 'Gassen',
          checkpoint: { at: F.at(T0, 0), yaw: F.yaw },
          *run(m) {
            yield m.cutsceneAt('intro');
            m.order('follow');
            m.tip(roleTip(pz), 8);
            infantry(m, 'gasse', 6, F.at(0.25, 6), { attack: 'player', cls: 'pionier', r: 10 });
            yield 2;
            m.say('kiesel', 'Kontakt! Panzerfaust im ersten Stock links!');
            yield m.killObjective('gasse', 'Säubere die Gasse mit Kiesel', ['gasse']);
            m.say('wendt', 'Gasse frei. Weiter zum Markt – bleibt dicht bei uns.');
            // Marktplatz: Zone um die Pak-Stellung (Stellplatz liegt sicher auf der Straße, nicht in einem Haus)
            const pak = m.get('markt')[0];
            const mp = pak ? [pak.position.x, pak.position.z] : F.at(0.38, 0);
            m.objective('markt', 'Rücke mit Kiesel zum Marktplatz vor', { pos: mp, label: 'Markt' });
            yield m.until(() => playerPos(m).distanceTo(m.vec(mp)) < 45 || (pak && !pak.alive));
            m.done('markt');
          },
        },
        {
          id: 'markt', name: 'Marktplatz',
          checkpoint: { at: F.at(0.38, 0), yaw: F.yaw },
          *run(m) {
            m.order('follow');
            infantry(m, 'markt', 5, F.at(0.48, -15), { hold: true, cls: 'pionier', r: 10 });
            crewSay(pz, 'Kommandant', 'Pak am Brunnen und ein Panzer hinter dem Rathaus!');
            yield destroy(m, 'marktziele', 'Vernichte Pak und Panzer am Markt', m.get('markt'), { label: 'Markt' });
            m.say('wendt', 'Markt ist unser! Der Brückenkopf ist der letzte Riegel.');
          },
        },
        {
          id: 'bruecke', name: 'Brückenkopf',
          checkpoint: { at: F.at(0.58, 0), yaw: F.yaw },
          setup(m) { killIfAlive(m.get('markt')); },
          *run(m) {
            m.order('follow');
            infantry(m, 'kopf', 5, F.at(0.7, 10), { hold: true, cls: 'pionier', r: 9 });
            m.say('korvan', 'Brückenkopf an Vesk: Feindliche Panzer und Infanterie am Markt. Wir halten!');
            yield destroy(m, 'kopf', 'Nimm den Brückenkopf (Bunker und Schützenpanzer)', m.get('kopf'), { label: 'Brückenkopf' });
            const bk = m.get('kopf')[0];
            yield m.reach('ziel', 'Erreiche die Brücke', { at: bk ? [bk.position.x, bk.position.z] : F.at(0.8, 0), r: 30, label: 'Brücke' });
            m.complete();
          },
        },
      ],
    };
  },
};

