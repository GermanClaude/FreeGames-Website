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
// Aufbau: Akt I „Waffenruhe“ (M0–M5), Akt II „Feuer im Tal“ (M6–M11), Akt III „Phase zwei“ (M12–M15, kamp3 15.11.).
// Akt II endet mit Kessars Festnahme und der Stimme „Kranich“ („Phase zwei beginnt“). Akt III jagt die „Graue Kompanie“
// (Söldner ohne Hoheitszeichen) und deckt einen Teil der Kranich-Frage auf: „Kranich“ ist kein einzelner Mann – einer
// davon ist der Geldgeber Konrad Seyfried, ein zweiter sitzt in der Kommission (Dr. Pell). Akt III endet wieder OFFEN
// (der dritte Kranich bleibt unbekannt) – weitere Kapitel kommen mit Updates.
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
export const CAMPAIGN_BASE_BUILD = '20261122020853';
/** Kapitel dieser Runde (M0, M4–M11): erster Build danach. */
const R2 = '20261114060747';
/** Akt III (M12–M15, kamp3): erster Build nach 20261122020853. */
const R3 = '20261115041505';

export const ACTS = [
  { n: 1, id: 'akt1', title: 'Akt I · Waffenruhe', short: 'Akt I', summary: 'Ein verstummtes Relais, ein bedrohtes Werk, eine Brücke – und die ersten Beweise, dass jemand den Krieg will.' },
  { n: 2, id: 'akt2', title: 'Akt II · Feuer im Tal', short: 'Akt II', summary: 'Kessar setzt alles auf eine Karte. Nordkorps und Ostbund-Soldaten kämpfen Seite an Seite – doch hinter Kessar steht noch jemand.' },
  { n: 3, id: 'akt3', title: 'Akt III · Phase zwei', short: 'Akt III', summary: 'Söldner ohne Hoheitszeichen, ein Sender in der Nacht, ein Anschlag auf die Kommission – und die erste Antwort auf die Frage, wer „Kranich“ ist.', open: true },
];

/** Hinweis am Ende der Liste (offenes Ende, neue Kapitel folgen mit Updates). */
export const TO_BE_CONTINUED = { title: 'Fortsetzung folgt', text: 'Der dritte Kranich ist noch unbekannt. Neue Kapitel erscheinen mit kommenden Updates und stellen neue Karten, Waffen und Fahrzeuge vor.' };

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
  { id: 'sander', name: 'Oberleutnant Kai Sander', role: 'Hubschrauberpilot, Rufname „Libelle 1“ (M6, M10). In M15 lotst er Falk per Funk durch den ersten Jetflug.' },
  { id: 'haas', name: 'Kommissarin Elin Haas', role: 'Leiterin der Waffenstillstandskommission (M8, M13–M15). Unbestechlich, mutig, manchmal zu vertrauensvoll.' },
  { id: 'pell', name: 'Dr. Ansgar Pell', role: 'Stellvertreter von Haas in der Kommission (M13–M15). Freundlich, gut informiert – zu gut.' },
  { id: 'vahl', name: 'Jaro Vahl', role: 'Anführer der „Grauen Kompanie“, Söldner ohne Hoheitszeichen (M12, M14). Kämpft für Geld, nicht für eine Seite.' },
  { id: 'seyfried', name: 'Konrad Seyfried', role: 'Industrieller, liefert an beide Seiten. Einer der „Kranich“ – der, der zahlt (M15).' },
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
    n: 1, id: 'm1', act: 1, title: 'Funkstille', map: 'altstadt', status: 'spielbar', type: 'Infiltration · Häuserkampf', minutes: 13, since: CAMPAIGN_BASE_BUILD, owner: 'kampagne-a',
    story: 'Das Funkrelais im Glockenturm von Sant Aurel schweigt. Trupp Lenz dringt über Marktgasse und Torhaus vor, stellt die Verbindung wieder her und entschlüsselt einen Befehl: Angriff auf Werk Sieben – in Uniformen des Nordkorps.',
    goals: ['Marktgasse erreichen, Wachposten ausschalten', 'Torhaus: Gegenstoß abwehren, Funkunterlagen sichern', 'Familie aus der Gasse in den Keller bringen (Begleitschutz)', 'Brunnenplatz säubern, Scharfschützen im Rathaus ausschalten', 'Glockenturm: Relais neu starten, Verstärkung abwehren'],
    teaches: ['Häuserkampf mit Trupp', 'Halten einer Zone'],
    showcase: { karten: ['altstadt'] },
  },
  {
    n: 2, id: 'm2', act: 1, title: 'Werk Sieben', map: 'werk', status: 'spielbar', type: 'Verteidigung einer Stellung', minutes: 13, since: CAMPAIGN_BASE_BUILD, owner: 'kampagne-a',
    story: 'Die Familien der Werkssiedlung müssen raus, bevor Kessar angreift. Der Trupp hält das Werkstor der Walzhalle gegen drei Wellen. Danach meldet sich Major Daren auf offenem Kanal: Kessar will die Flussbrücke sprengen.',
    goals: ['Nachzügler aus der Kantine zum Werkshof bringen', 'Stellung am Werkstor beziehen, Sandsäcke setzen (Bauen)', 'Drei Angriffswellen abwehren (Süden, Westhof, beide)', 'Tor nie unbesetzt lassen', 'Sprengladung an der Pumpstation entschärfen'],
    teaches: ['Befehlsrad: Verteidigen'],
    showcase: { karten: ['werk'] },
  },
  {
    n: 3, id: 'm3', act: 1, title: 'Eiserner Fluss', map: 'grenzland', status: 'spielbar', type: 'Fahrzeug · Feuerunterstützung', minutes: 14, since: CAMPAIGN_BASE_BUILD, owner: 'kampagne-a',
    story: 'Falk übernimmt den Kampfpanzer „Eisen 2“, deckt die Infanterie im Dorf und kämpft die Brücke frei. Am Ende tritt Daren allein mit erhobenen Händen auf die Brücke und übergibt Kessars unterschriebene Befehle.',
    goals: ['In den Panzer steigen', 'Vorstoß ins Dorf decken, Geländewagen zerstören', 'Panzerabwehrtrupps am Waldrand ausschalten', 'Zwei Kampfpanzer ausschalten', 'Brücke für die Pioniere halten, Gegenstoß abwehren'],
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
    story: 'Zurück in Sant Aurel, diesmal am Abend und unter Zeitdruck: Kessar will über das Relais im Glockenturm gefälschte Angriffsbefehle an alle Einheiten senden. Lenz liegt im Lazarett – Falk führt den Trupp zum ersten Mal selbst. Die Einwohner suchen Schutz in der Kirche am Brunnenplatz. Das Relais wird rechtzeitig abgeschaltet; ein gefangener Funker verrät, dass Kessar zum Fliegerhorst Hagenmoor flieht.',
    goals: ['Trupp per Befehlsrad führen (Halten, Vorrücken, Folgen)', 'Den Sender vor Ablauf des Countdowns abschalten', 'Einwohner in der Kirche schützen', 'Den Funker lebend festnehmen'],
    teaches: ['Befehle an den Trupp unter Druck', 'Altstadt in umgekehrter Richtung (Osten → Westen)'],
    showcase: { karten: ['altstadt'] },
  },
  {
    n: 10, id: 'm10', act: 2, title: 'Rollfeld', map: 'flugplatz', mapFallback: 'grenzland', time: 'morgen', weather: 'klar', status: 'spielbar', type: 'Großangriff · Flugplatz', minutes: 14, since: R2, owner: 'kampagne-b',
    story: 'Kessar will mit den Unterlagen seiner Geldgeber außer Landes fliegen. Der Trupp – Lenz wieder dabei, Arm in der Schlinge – landet mit „Libelle 1“ am Rand des Fliegerhorsts Hagenmoor. Flugabwehr ausschalten, durch die Hangars vorstoßen, die Transportmaschine auf der Startbahn stoppen. Kessar entkommt im letzten Moment mit einem Wagen in die Stadt Veldmark.',
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
  },
  /* ---------------------------------------------------------------- Akt III · Phase zwei (kamp3) */
  {
    n: 12, id: 'm12', act: 3, title: 'Nachtsicht', map: 'grenzland', time: 'abend', weather: 'bewoelkt', status: 'spielbar', type: 'Nachteinsatz · Schleichen · Nachtsicht', minutes: 14, since: R3, owner: 'kamp3',
    story: 'Zwei Nächte nach Kessars Festnahme hat Weber die fremde Stimme angepeilt: Sie sendet vom Funkhügel im Grenzland. Mit Nachtsichtgeräten schleicht der Trupp vom Gehöft über die Furt, schaltet Streifen lautlos aus und stürmt den Bunker der „Grauen Kompanie“ – Söldner ohne Hoheitszeichen. Ihr Anführer Jaro Vahl entkommt, aber Webers Kopie des Funkrechners verrät Phase zwei: einen Anschlag auf die öffentliche Sitzung der Kommission in Veldmark.',
    goals: ['Nachtsichtgerät benutzen (Taste „Lampe“)', 'Gehöft: Beobachtungsposten lautlos ausschalten', 'Über die Furt zum Funkhügel, Streifen umgehen oder ausschalten', 'Bunker stürmen, Funkrechner kopieren', 'Unter Leuchtkugeln zum Abholpunkt ausweichen'],
    teaches: ['Nachteinsatz mit Nachtsicht (Sicht der Gegner eingeschränkt)', 'Lautloses Vorgehen über große Entfernung'],
    tech: ['Nachtbild als Abdunklung über dem Spielbild, Nachtsicht als Restlichtfilter (hilfen-c.js night)', 'Wahrnehmung der Bots: world.nightVis (bots/ai/perception.js)'],
    showcase: { karten: ['grenzland'], waffen: ['smg_wespe'] },
  },
  {
    n: 13, id: 'm13', act: 3, title: 'Weitblick', map: 'stadtkern', time: 'mittag', weather: 'dunst', status: 'spielbar', type: 'Scharfschütze · Überwachung · Zielmarkierung', minutes: 13, since: R3, owner: 'kamp3',
    story: 'Die Kommission hält ihre erste öffentliche Sitzung auf dem Lindenplatz in Veldmark. Falk liegt mit dem Scharfschützengewehr auf dem Dach des Kaufhauses, Weber neben ihm mit dem Spektiv. Unter Hunderten Menschen suchen sie die Späher der Grauen Kompanie und markieren sie für Lenz’ Zugriff. Als der Angriff trotzdem kommt, deckt Falk Kommissarin Haas auf dem Weg in die U-Bahn und gewinnt ein Duell mit dem feindlichen Scharfschützen. Ein Späher hatte die Sitzordnung bei sich – mit einer Handschrift, die Haas kennt.',
    goals: ['Späher anhand der Beschreibung finden und im Zielfernrohr markieren', 'Nicht auf Zivilisten schießen (Fehlschlag)', 'Zugriff decken, Angreifer auf dem Platz ausschalten', 'Kommissarin Haas zur U-Bahn decken', 'Feindlichen Scharfschützen finden und ausschalten'],
    teaches: ['Scharfschützen-Überwachung, Zielmarkierung im Visier', 'Präzises Schießen über Menschenmengen'],
    showcase: { karten: ['stadtkern'], waffen: ['sr_brecher'] },
  },
  {
    n: 14, id: 'm14', act: 3, title: 'Grabenlinie', map: 'niemandsland', time: 'abend', weather: 'dunst', status: 'spielbar', type: 'Verteidigung · Bauen und Graben', minutes: 14, since: R3, owner: 'kamp3',
    story: 'Haas lässt den Grenzvertrag nicht in einer Stadt unterschreiben, sondern dort, wo der Krieg am tiefsten Spuren hinterlassen hat: in der Kapellenruine im Niemandsland. Bis die Delegationen eintreffen, bleibt eine Stunde – Falk und der Trupp heben Schützenlöcher aus, bauen Sandsackwälle und halten die Ruine gegen die Graue Kompanie. Leutnant Roth bringt „Eisen 1“ für einen kurzen Gegenstoß. Vahl wird gefangen und nennt einen Namen: Konrad Seyfried, der auf dem Fliegerhorst Hagenmoor auf seinen Abflug wartet.',
    goals: ['Mit dem Klappspaten graben und Sandsackwälle bauen (Taste „Bauen“)', 'Drei Angriffswellen abwehren, die Ruine nie aufgeben', 'Mörser der Söldner ausschalten', 'Geländewagen der Söldner stoppen – Roths Panzer unterstützt (Nebenelement)', 'Jaro Vahl lebend festnehmen'],
    teaches: ['Stellungsbau: Graben (Spaten) und Bauen (Sandsack, Schützenloch)', 'Verteidigung mit vorbereiteter Stellung'],
    showcase: { karten: ['niemandsland'], waffen: ['spaten'] },
  },
  {
    n: 15, id: 'm15', act: 3, title: 'Kranichflug', map: 'flugplatz', time: 'abend', weather: 'klar', status: 'spielbar', type: 'Geiselbefreiung · Jet-Einsatz', minutes: 15, since: R3, owner: 'kamp3',
    story: 'Die Graue Kompanie hat den Fliegerhorst Hagenmoor besetzt und das Bodenpersonal in den Unterkünften eingeschlossen. Falk holt die Geiseln Raum für Raum heraus. Dann hebt Seyfrieds Hubschrauber ab – und der einzige startbereite Jäger steht auf der Bahn. Mit Sanders Stimme im Funk startet Falk den „JK-9 Falke“, holt die Begleithubschrauber vom Himmel und zwingt Seyfried mit Überflügen zur Landung. Seyfried gesteht: „Kranich“ sind drei. Er ist der, der zahlt. Der zweite sitzt in der Kommission – Dr. Pell ist verschwunden. Den dritten kennt nicht einmal Seyfried.',
    goals: ['Unterkünfte: Geiseln befreien, ohne sie zu treffen', 'Zum Jäger auf der Startbahn', 'Von der Bahn starten (Jet-Steuerung)', 'Zwei Begleithubschrauber abschießen', 'Seyfrieds Hubschrauber mit dichten Überflügen zur Landung zwingen'],
    teaches: ['Jet: Start von der Bahn, Luftkampf gegen Hubschrauber', 'Geiselbefreiung im Gebäudekomplex'],
    tech: ['Karte „flugplatz“ mit world.runway (Jet startet vom Boden)'],
    showcase: { karten: ['flugplatz'], fahrzeuge: ['jet'] },
    cliffhanger: true,
  },
];

/** Summe der Ziel-Spielzeiten (Minuten). */
export const TOTAL_MINUTES = OUTLINE.reduce((s, o) => s + (o.minutes || 0), 0);
export const outlineById = (id) => OUTLINE.find((o) => o.id === id) || null;
