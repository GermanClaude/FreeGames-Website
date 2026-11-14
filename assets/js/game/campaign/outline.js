// NULLPUNKT — Kampagne „Stille Grenze“: Gliederung der ganzen Kampagne (Akte, 12 Missionen M0–M11) als Bauplan.
//
// Grundidee: Ein moderner Militär-Thriller an der Grenze zweier erfundener Bündnisse – Nordkorps und Ostbund – nach drei
// Wochen Waffenruhe. Ein abtrünniger Oberst des Ostbunds (Kessar) will mit inszenierten Angriffen in fremden Uniformen
// einen neuen Krieg auslösen. Der Trupp von Feldwebel Lenz und Hauptmann Brandt soll die Waffenruhe retten, Zivilisten
// schützen und die Wahrheit ans Licht bringen. Ein Offizier der Gegenseite (Major Daren) wird zum Verbündeten.
// Ton: ernst, ruhig, ohne Verherrlichung; Gewalt nur im Rahmen des Spiels, keine Flüche, keine Gotteslästerung,
// keine Anzüglichkeiten. Leitmotive: Verantwortung für Schwächere, Wahrhaftigkeit, Treue, Vergebung, Mut zum Frieden.
// Alle Namen, Orte und Einheiten sind frei erfunden.
//
// Aufbau: Akt I „Waffenruhe“ (M0–M5), Akt II „Feuer im Tal“ (M6–M11). Akt II endet OFFEN: Kessar ist gefasst, aber
// seine Geldgeber („Kranich“) bleiben im Dunkeln – ein letzter Funkspruch kündigt „Phase zwei“ an. Akt III und weitere
// Kapitel kommen mit späteren Updates und stellen dabei neue Karten/Waffen/Fahrzeuge vor (showcase).
//
// Felder je Mission:
//   n, id, act, title, map (Karten-Id), mapFallback (Karte, falls die Karte im Build fehlt), time/weather (Vorschlag),
//   status 'spielbar' | 'geplant' (spielbar = Datei in missions/ vorhanden, das Menü erkennt das selbst),
//   minutes (Ziel-Spielzeit inkl. Zwischensequenzen), type, story, goals, teaches (vermittelte Mechanik),
//   showcase { karten, waffen, fahrzeuge } (was das Kapitel „vorstellt“ – das Menü zeigt es an),
//   since: Build-Stempel (version.json „build“, JJJJMMTThhmmss oder JJJJMMTT), ab dem das Kapitel im Spiel ist. Kapitel,
//   die ein Spieler noch nicht kannte, bekommen im Menü das Abzeichen „NEU“, und die Lobby zeigt beim ersten Start
//   danach einen dezenten Hinweis (progress.js syncNew). owner: welcher Arbeitsstrang die Mission schreibt.
//
// Neues Kapitel anhängen (spätere Updates): Eintrag hier mit act (oder neuem Akt in ACTS), since = Build-Stempel knapp
// über dem aktuellen version.json, showcase mit den neuen Inhalten; Missionsdatei in missions/ (Muster m4–m6), eine
// Import-/Listenzeile in missions/index.js, Karte in shared/modes.data.js (kampagne.missionMaps).

export const CAMPAIGN = {
  id: 'stille-grenze',
  title: 'Stille Grenze',
  tagline: 'Drei Wochen Waffenruhe. Ein Mann, der sie brechen will.',
  summary: 'Im Grenztal von Sant Aurel hält die Waffenruhe zwischen Nordkorps und Ostbund seit drei Wochen. Dann verstummt das Funkrelais, und Feldwebel Lenz und sein Trupp stoßen auf einen Plan, der beide Seiten zurück in den Krieg treiben soll.',
};

/** Build-Stempel, mit dem M1–M3 erschienen sind (Ausgangsstand für „NEU“ bei Spielern, die schon gespielt haben). */
export const CAMPAIGN_BASE_BUILD = '20261114060746';
/** Kapitel dieser Runde (M0, M4–M11): erster Build danach. */
const R2 = '20261114060747';

export const ACTS = [
  { n: 1, id: 'akt1', title: 'Akt I · Waffenruhe', short: 'Akt I', summary: 'Ein verstummtes Relais, ein bedrohtes Werk, eine Brücke – und die ersten Beweise, dass jemand den Krieg will.' },
  { n: 2, id: 'akt2', title: 'Akt II · Feuer im Tal', short: 'Akt II', summary: 'Kessar setzt alles auf eine Karte. Nordkorps und Ostbund-Soldaten kämpfen Seite an Seite – doch hinter Kessar steht noch jemand.', open: true },
];

/** Hinweis am Ende der Liste (offenes Ende, neue Kapitel folgen mit Updates). */
export const TO_BE_CONTINUED = { title: 'Fortsetzung folgt', text: 'Akt III ist in Arbeit. Neue Kapitel erscheinen mit kommenden Updates und stellen neue Karten, Waffen und Fahrzeuge vor.' };

export const CHARACTERS = [
  { id: 'falk', name: 'Unteroffizier Falk („Falke“)', role: 'Spielerfigur. Ruhig, zuverlässig, spricht wenig. Wächst vom Gruppenmitglied zum Truppführer (ab M9 führt er den Trupp).' },
  { id: 'lenz', name: 'Feldwebel Martin Lenz', role: 'Truppführer. Pragmatisch, fürsorglich, hält die Regeln auch dann ein, wenn es schwerfällt. In M8 verwundet, ab M10 wieder dabei.' },
  { id: 'weber', name: 'Obergefreiter Jonas Weber', role: 'Funker. Jung, klug, nervös unter Feuer. Entschlüsselt Kessars Funkverkehr.' },
  { id: 'brandt', name: 'Hauptmann Elias Brandt', role: 'Kompaniechef. Besonnenes Gewissen der Truppe: „Niemand schießt, der nicht muss.“' },
  { id: 'roth', name: 'Leutnant Ida Roth', role: 'Panzerzugführerin. Direkt, erfahren, bringt Falk das Fahren im Turm bei.' },
  { id: 'hofer', name: 'Sanitäter Paul Hofer', role: 'Sanitäter. Versorgt Freund und Feind gleichermaßen.' },
  { id: 'daren', name: 'Major Ilja Daren', role: 'Offizier des Ostbunds. Will den Krieg verhindern und wechselt das Vertrauen, nicht die Seite.' },
  { id: 'kessar', name: 'Oberst Radan Kessar', role: 'Abtrünniger Brigadekommandeur. Hält den Frieden für Schwäche und will ihn mit Täuschung beenden.' },
  { id: 'krell', name: 'Oberfeldwebel Krell', role: 'Ausbilder am Schießstand Hohenfeld (M0). Knapp, genau, geduldig.' },
  { id: 'vogt', name: 'Kapitän Anselm Vogt', role: 'Kapitän des Frachters „Seeschwalbe“ (M4). Von Kessars Leuten erpresst, hilft danach als Zeuge.' },
  { id: 'lindner', name: 'Dr. Mira Lindner', role: 'Leiterin des Staatsarchivs (M5). Hütet die Originale der Waffenruhe-Verträge.' },
  { id: 'sander', name: 'Oberleutnant Kai Sander', role: 'Hubschrauberpilot, Rufname „Libelle 1“ (M6, M10).' },
];

export const OUTLINE = [
  /* ---------------------------------------------------------------- Akt I · Waffenruhe */
  {
    n: 0, id: 'm0', act: 1, title: 'Grundausbildung', map: 'range', status: 'spielbar', type: 'Ausbildung · Schießstand', minutes: 12, since: R2, owner: 'kampagne-a', tutorial: true,
    story: 'Drei Wochen vor dem Ende der Waffenruhe: Unteroffizier Falk frischt am Schießstand Hohenfeld unter Oberfeldwebel Krell alles auf, was er im Einsatz brauchen wird – vom ersten Schritt bis zum Befehl an den Trupp und der Fahrt im Geländewagen.',
    goals: ['Bewegen, Ducken, Hinlegen, Sprinten, Springen', 'Zielen, Schießen, Nachladen, Waffe und Feuermodus wechseln', 'Granaten, Ausrüstung, Verband', 'Befehle an den Trupp, Geländewagen fahren, Wegpunkte und Minikarte'],
    teaches: ['Bewegung', 'Waffen', 'Granaten', 'Ausrüstung', 'Trupp-Befehle', 'Fahrzeug', 'Minikarte'],
    showcase: { karten: ['range'], waffen: ['ar_m17', 'pi_p9'], fahrzeuge: ['jeep'] },
  },
  {
    n: 1, id: 'm1', act: 1, title: 'Funkstille', map: 'altstadt', status: 'spielbar', type: 'Infiltration · Häuserkampf', minutes: 10, since: CAMPAIGN_BASE_BUILD, owner: 'kampagne-a',
    story: 'Das Funkrelais im Glockenturm von Sant Aurel schweigt. Trupp Lenz dringt über Marktgasse und Torhaus vor, stellt die Verbindung wieder her und entschlüsselt einen Befehl: Angriff auf Werk Sieben – in Uniformen des Nordkorps.',
    goals: ['Marktgasse erreichen, Wachposten ausschalten', 'Torhaus: Gegenstoß abwehren, Funkunterlagen sichern', 'Brunnenplatz säubern', 'Glockenturm: Relais neu starten, Verstärkung abwehren'],
    teaches: ['Häuserkampf mit Trupp', 'Halten einer Zone'],
    showcase: { karten: ['altstadt'] },
  },
  {
    n: 2, id: 'm2', act: 1, title: 'Werk Sieben', map: 'werk', status: 'spielbar', type: 'Verteidigung einer Stellung', minutes: 11, since: CAMPAIGN_BASE_BUILD, owner: 'kampagne-a',
    story: 'Die Familien der Werkssiedlung müssen raus, bevor Kessar angreift. Der Trupp hält das Werkstor der Walzhalle gegen drei Wellen. Danach meldet sich Major Daren auf offenem Kanal: Kessar will die Flussbrücke sprengen.',
    goals: ['Stellung am Werkstor beziehen', 'Drei Angriffswellen abwehren (Süden, Westhof, beide)', 'Tor nie unbesetzt lassen', 'Restliche Angreifer vertreiben'],
    teaches: ['Befehlsrad: Verteidigen'],
    showcase: { karten: ['werk'] },
  },
  {
    n: 3, id: 'm3', act: 1, title: 'Eiserner Fluss', map: 'grenzland', status: 'spielbar', type: 'Fahrzeug · Feuerunterstützung', minutes: 12, since: CAMPAIGN_BASE_BUILD, owner: 'kampagne-a',
    story: 'Falk übernimmt den Kampfpanzer „Eisen 2“, deckt die Infanterie im Dorf und kämpft die Brücke frei. Am Ende tritt Daren allein mit erhobenen Händen auf die Brücke und übergibt Kessars unterschriebene Befehle.',
    goals: ['In den Panzer steigen', 'Vorstoß ins Dorf decken, Geländewagen zerstören', 'Zwei Kampfpanzer ausschalten', 'Brücke für die Pioniere halten'],
    teaches: ['Kampfpanzer: Munitionsarten, Fahren und Schießen'],
    showcase: { karten: ['grenzland'], fahrzeuge: ['mbt'] },
  },
  {
    n: 4, id: 'm4', act: 1, title: 'Hafennacht', map: 'hafen', time: 'abend', weather: 'bewoelkt', status: 'spielbar', type: 'Schleichen · Sabotage · Befreiung', minutes: 13, since: R2, owner: 'kampagne-a',
    story: 'Darens Unterlagen führen zum Frachter „Seeschwalbe“, der Kessars gefälschte Uniformen und Sprengstoff bringt. In der Abenddämmerung schleichen Falk und Weber über den Kai, markieren die Ladung für die Pioniere und holen den erpressten Kapitän Vogt heraus. Als der Alarm losgeht, bleibt nur der Weg zum Boot – unter Feuer.',
    goals: ['Unentdeckt über die Kaimauer (Entdeckungsanzeige, Alarm)', 'Drei Container markieren', 'Kapitän Vogt befreien und zum Boot begleiten', 'Ausbruch: die Pier halten, bis das Boot ablegt'],
    teaches: ['Schleichen: geduckt/liegend, Sichtlinien, schallgedämpfte Waffe', 'Begleitschutz'],
    showcase: { karten: ['hafen'], waffen: ['smg_wespe'] },
  },
  {
    n: 5, id: 'm5', act: 1, title: 'Archiv', map: 'bibliothek', status: 'spielbar', type: 'Aufklärung · Geiselbefreiung · Beweise', minutes: 13, since: R2, owner: 'kampagne-a',
    story: 'Kessars Leute halten die Archivare im Staatsarchiv fest und wollen die Originale der Waffenruhe vernichten – die einzigen Papiere, die seine Fälschungen widerlegen. Falk klärt erst auf, markiert die Wachen, dann geht der Trupp Raum für Raum vor. Keine Geisel darf zu Schaden kommen. Am Ende brennt der Ostflügel, und über dem Tal steigt Rauch auf: Kessar hat den Brandwald angezündet.',
    goals: ['Aufklärung: Wachen im Blick markieren', 'Lesesaal stürmen, ohne Geiseln zu treffen', 'Geiseln zum Ausgang bringen', 'Originalverträge aus dem Magazin bergen und das Archiv verlassen'],
    teaches: ['Markieren (anvisieren)', 'Präzises Schießen neben Zivilisten', 'Trupp-Befehl „Halten“/„Folgen“'],
    showcase: { karten: ['bibliothek'], waffen: ['mr_sk14'] },
  },
  /* ---------------------------------------------------------------- Akt II · Feuer im Tal */
  {
    n: 6, id: 'm6', act: 2, title: 'Feuerlinie', map: 'brandwald', time: 'abend', weather: 'dunst', status: 'spielbar', type: 'Hubschrauber · Rettung · Rückzug', minutes: 14, since: R2, owner: 'kampagne-a',
    story: 'Der Wald oberhalb der Dörfer brennt. Falk fliegt als Bordschütze im Hubschrauber „Libelle 1“ mit, hält die Landezone frei und wird mit Lenz abgesetzt. Am Boden sammeln sie die Dorfbewohner und ziehen sich vor Feuer und Feind Linie um Linie zur Landezone zurück. Im letzten Flug entschlüsselt Weber: Kessar greift mit allem an – im Niemandsland.',
    goals: ['Bordschütze: Flugabwehr-Stellungen ausschalten', 'Absetzen, Dorfbewohner sammeln', 'Rückzug über zwei Linien zur Landezone', 'Mit dem letzten Flug abheben'],
    teaches: ['Bordschütze im Hubschrauber', 'Geordneter Rückzug'],
    showcase: { karten: ['brandwald'], fahrzeuge: ['heli'] },
  },
  {
    n: 7, id: 'm7', act: 2, title: 'Niemandsland', map: 'niemandsland', time: 'morgen', weather: 'morgennebel', status: 'spielbar', type: 'Große Schlacht · Halten der Linie', minutes: 14, since: R2, owner: 'kampagne-b',
    story: 'Kessar greift mit allem an, was ihm folgt. Darens Brigade erhält den Befehl, mitzumarschieren – und verweigert ihn. Nordkorps- und Ostbund-Soldaten halten gemeinsam die Kapellenruine, holen das Artillerie-Funkgerät zurück und bergen die Verwundeten, bis Kessars Angriff zusammenbricht. Kessar zieht sich zurück und kündigt über Funk an, „die Wahrheit selbst zu senden“.',
    goals: ['Kapellenruine halten (Zonenkontrolle, größer als M2)', 'Artillerie-Funkgerät zurückerobern', 'Präzisionsschlag auf die Panzerkolonne anfordern (Skriptereignis)', 'Verwundete zum Sanitätsposten bergen'],
    teaches: ['Große Schlacht mit vielen Verbündeten', 'Luft-/Artillerieunterstützung anfordern'],
    tech: ['Verbündete mit Ostbund-Aussehen (Team A, camo des Ostbunds)', 'Präzisionsschlag als Skriptereignis (G.effects.explosion an mehreren Punkten)'],
    showcase: { karten: ['niemandsland'] },
  },
  {
    n: 8, id: 'm8', act: 2, title: 'Geleit', map: 'grenzland', time: 'abend', weather: 'bewoelkt', status: 'spielbar', type: 'Konvoi · Bordschütze im Geländewagen', minutes: 12, since: R2, owner: 'kampagne-b',
    story: 'Daren soll vor der Waffenstillstandskommission aussagen. Falk sichert als Bordschütze am schweren MG eines Geländewagens den Konvoi vom Dorf zum Verhandlungszelt am Nordhang. Ein Hinterhalt stoppt die Kolonne; zu Fuß kämpft sich der Trupp durch die Felder, ein feindlicher Panzer muss mit dem Raketenwerfer ausgeschaltet werden. Lenz wird verwundet. Daren erreicht das Zelt – doch Kessar hat das Relais von Sant Aurel besetzt.',
    goals: ['Konvoi begleiten (Bordschütze, Fahrzeuge dürfen nicht ausfallen)', 'Hinterhalt im Dorf zerschlagen', 'Panzer mit dem Raketenwerfer ausschalten', 'Lenz zum Sanitäter bringen, Daren ins Zelt bringen'],
    teaches: ['Geländewagen-MG', 'Panzerabwehr zu Fuß (at_donner)'],
    tech: ['Konvoi: scriptTank-artige Fahrten mit Team A (director.vehicle + vehicle.driveTo)', 'Spieler am MG-Sitz des Geländewagens (G.vehicles.enter(player, jeep, Sitz))'],
    showcase: { fahrzeuge: ['jeep'], waffen: ['at_donner'] },
  },
  {
    n: 9, id: 'm9', act: 2, title: 'Glockenschlag', map: 'altstadt', time: 'abend', weather: 'dunst', status: 'spielbar', type: 'Häuserkampf · Falk führt den Trupp', minutes: 12, since: R2, owner: 'kampagne-b',
    story: 'Zurück in Sant Aurel, diesmal am Abend und unter Zeitdruck: Kessar will über das Relais im Glockenturm gefälschte Angriffsbefehle an alle Einheiten senden. Lenz liegt im Lazarett – Falk führt den Trupp zum ersten Mal selbst. Die Einwohner suchen Schutz in der Kirche am Brunnenplatz. Das Relais wird rechtzeitig abgeschaltet; ein gefangener Funker verrät, dass Kessar zum Flugplatz Hallstein flieht.',
    goals: ['Trupp per Befehlsrad führen (Halten, Vorrücken, Folgen)', 'Den Sender vor Ablauf des Countdowns abschalten', 'Einwohner in der Kirche schützen', 'Den Funker lebend festnehmen'],
    teaches: ['Befehle an den Trupp unter Druck', 'Altstadt in umgekehrter Richtung (Osten → Westen)'],
    showcase: { karten: ['altstadt'] },
  },
  {
    n: 10, id: 'm10', act: 2, title: 'Rollfeld', map: 'flugplatz', mapFallback: 'grenzland', time: 'morgen', weather: 'klar', status: 'spielbar', type: 'Großangriff · Flugplatz', minutes: 14, since: R2, owner: 'kampagne-b',
    story: 'Kessar will mit den Unterlagen seiner Geldgeber außer Landes fliegen. Der Trupp – Lenz wieder dabei, Arm in der Schlinge – landet mit „Libelle 1“ am Rand des Militärflugplatzes Hallstein. Flugabwehr ausschalten, durch die Hangars vorstoßen, die Transportmaschine auf der Startbahn stoppen. Kessar entkommt im letzten Moment mit einem Wagen in die Stadt Veldmark.',
    goals: ['Flugabwehr am Rand des Flugplatzes ausschalten', 'Hangars durchkämmen (Innenräume)', 'Transportmaschine auf der Startbahn stoppen (Fahrwerk/Triebwerke beschießen oder Bahn blockieren)', 'Verfolgung aufnehmen'],
    teaches: ['Großkarte mit Luftunterstützung (verbündete Jets überfliegen per air.spawn jet airborne)'],
    tech: ['Karte „flugplatz“ (Strang karten-neu): Startbahn, Hangars. Fehlt die Karte, Rückfall auf grenzland (Bereitstellungsraum als „Feldflugplatz“) – Koordinaten je Karte (m.mapId)'],
    showcase: { karten: ['flugplatz'], fahrzeuge: ['jet', 'heli'] },
  },
  {
    n: 11, id: 'm11', act: 2, title: 'Stadtkern', map: 'stadtkern', mapFallback: 'altstadt', time: 'morgen', weather: 'morgennebel', status: 'spielbar', type: 'Finale · Verfolgung · Festnahme', minutes: 15, since: R2, owner: 'kampagne-b',
    story: 'Kessar hat sich im Funkhaus von Veldmark verschanzt, mitten im dichten Stadtkern. Stockwerk für Stockwerk, durch Treppenhäuser und Wohnungen, an Zivilisten vorbei, stellt Falk ihn auf dem Dach. Kessar ergibt sich. Daren und Brandt verkünden über den Sender gemeinsam die Fortsetzung der Waffenruhe. Doch in Kessars Tasche steckt ein Notizbuch mit Zahlungen eines „Kranich“ – und auf der offenen Frequenz meldet sich eine fremde Stimme: „Kessar ist gescheitert. Phase zwei beginnt.“',
    goals: ['Durch den Stadtkern zum Funkhaus vorstoßen (mehrstöckig, Innenräume)', 'Zivilisten nicht gefährden', 'Kessar lebend festnehmen (Fehlschlag, wenn er fällt)', 'Epilog: Ansprache am Sender – offenes Ende (Kranich, Phase zwei)'],
    teaches: ['Mehrstöckiger Häuserkampf'],
    tech: ['Karte „stadtkern“ (Strang karten-neu). Fehlt sie, Rückfall auf altstadt (Rathaus/Glockenturm als Funkhaus)', 'Festnahme-Sequenz statt Kampf', 'Schlusskarte: „Ende von Akt II – die Geschichte geht weiter“'],
    showcase: { karten: ['stadtkern'] },
    cliffhanger: true,
  },
];

/** Summe der Ziel-Spielzeiten (Minuten). */
export const TOTAL_MINUTES = OUTLINE.reduce((s, o) => s + (o.minutes || 0), 0);
export const outlineById = (id) => OUTLINE.find((o) => o.id === id) || null;
