// NULLPUNKT — Kampagne „Stille Grenze“: Gliederung der ganzen Kampagne (8 Missionen) als Bauplan zum Weiterbauen.
//
// Grundidee: Ein moderner Militär-Thriller an der Grenze zweier erfundener Bündnisse – Nordkorps und Ostbund – nach drei
// Wochen Waffenruhe. Ein abtrünniger Oberst des Ostbunds (Kessar) will mit inszenierten Angriffen in fremden Uniformen
// einen neuen Krieg auslösen. Der Trupp von Feldwebel Lenz und Hauptmann Brandt soll die Waffenruhe retten, Zivilisten
// schützen und die Wahrheit ans Licht bringen. Ein Offizier der Gegenseite (Major Daren) wird zum Verbündeten.
// Ton: ernst, ruhig, ohne Verherrlichung; Gewalt nur im Rahmen des Spiels, keine Flüche, keine Gotteslästerung,
// keine sexuellen Inhalte. Leitmotive: Verantwortung für Schwächere, Wahrhaftigkeit, Treue, Vergebung, Mut zum Frieden.
// Alle Namen, Orte und Einheiten sind frei erfunden.
//
// Status: 'spielbar' (missions/*.js vorhanden) | 'geplant' (nur Gliederung). Für eine neue Mission: Datei nach dem
// Muster von m1–m3 anlegen (Abschnitte mit Checkpoint, Zwischensequenzen intro/outro), in missions/index.js eintragen
// und hier den Status setzen. Hubschrauber/Jets (vehicles/*, paralleler Strang) sind für Mission 6 vorgesehen.

export const CAMPAIGN = {
  id: 'stille-grenze',
  title: 'Stille Grenze',
  tagline: 'Drei Wochen Waffenruhe. Ein Mann, der sie brechen will.',
  summary: 'Im Grenztal von Sant Aurel hält die Waffenruhe zwischen Nordkorps und Ostbund seit drei Wochen. Dann verstummt das Funkrelais, und Feldwebel Lenz und sein Trupp stoßen auf einen Plan, der beide Seiten zurück in den Krieg treiben soll.',
};

export const CHARACTERS = [
  { id: 'falk', name: 'Unteroffizier Falk („Falke“)', role: 'Spielerfigur. Ruhig, zuverlässig, spricht wenig. Wächst vom Gruppenmitglied zum Truppführer.' },
  { id: 'lenz', name: 'Feldwebel Martin Lenz', role: 'Truppführer. Pragmatisch, fürsorglich, hält die Regeln auch dann ein, wenn es schwerfällt.' },
  { id: 'weber', name: 'Obergefreiter Jonas Weber', role: 'Funker. Jung, klug, nervös unter Feuer. Entschlüsselt Kessars Funkverkehr.' },
  { id: 'brandt', name: 'Hauptmann Elias Brandt', role: 'Kompaniechef. Besonnenes Gewissen der Truppe: „Niemand schießt, der nicht muss.“' },
  { id: 'roth', name: 'Leutnant Ida Roth', role: 'Panzerzugführerin. Direkt, erfahren, bringt Falk das Fahren im Turm bei.' },
  { id: 'hofer', name: 'Sanitäter Paul Hofer', role: 'Sanitäter. Versorgt Freund und Feind gleichermaßen.' },
  { id: 'daren', name: 'Major Ilja Daren', role: 'Offizier des Ostbunds. Will den Krieg verhindern und wechselt das Vertrauen, nicht die Seite.' },
  { id: 'kessar', name: 'Oberst Radan Kessar', role: 'Abtrünniger Brigadekommandeur. Hält den Frieden für Schwäche und will ihn mit Täuschung beenden.' },
];

export const OUTLINE = [
  {
    n: 1, id: 'm1', title: 'Funkstille', map: 'altstadt', status: 'spielbar', type: 'Infiltration · Häuserkampf',
    story: 'Das Funkrelais im Glockenturm von Sant Aurel schweigt. Trupp Lenz dringt über Marktgasse und Torhaus vor, stellt die Verbindung wieder her und entschlüsselt einen Befehl: Angriff auf Werk Sieben – in Uniformen des Nordkorps.',
    goals: ['Marktgasse erreichen, Wachposten ausschalten', 'Torhaus: Gegenstoß abwehren, Funkunterlagen sichern', 'Brunnenplatz säubern', 'Glockenturm: Relais neu starten, Verstärkung abwehren'],
  },
  {
    n: 2, id: 'm2', title: 'Werk Sieben', map: 'werk', status: 'spielbar', type: 'Verteidigung einer Stellung',
    story: 'Die Familien der Werkssiedlung müssen raus, bevor Kessar angreift. Der Trupp hält das Werkstor der Walzhalle gegen drei Wellen. Danach meldet sich Major Daren auf offenem Kanal: Kessar will die Flussbrücke sprengen.',
    goals: ['Stellung am Werkstor beziehen', 'Drei Angriffswellen abwehren (Süden, Westhof, beide)', 'Tor nie unbesetzt lassen', 'Restliche Angreifer vertreiben'],
  },
  {
    n: 3, id: 'm3', title: 'Eiserner Fluss', map: 'grenzland', status: 'spielbar', type: 'Fahrzeug · Feuerunterstützung',
    story: 'Falk übernimmt den Kampfpanzer „Eisen 2“, deckt die Infanterie im Dorf und kämpft die Brücke frei. Am Ende tritt Daren allein mit erhobenen Händen auf die Brücke und übergibt Kessars unterschriebene Befehle.',
    goals: ['In den Panzer steigen', 'Vorstoß ins Dorf decken, Geländewagen zerstören', 'Zwei Kampfpanzer ausschalten', 'Brücke für die Pioniere halten'],
  },
  {
    n: 4, id: 'm4', title: 'Hafennacht', map: 'hafen', status: 'geplant', type: 'Schleichen · Sabotage (Nacht)',
    story: 'Darens Unterlagen führen zu einem Frachter im Hafen, der Kessars gefälschte Uniformen und Funkgeräte bringt. Nachts, ohne Alarm: Ladung markieren, Zünder entfernen, den Kapitän – einen erpressten Zivilisten – lebend herausholen.',
    goals: ['Unentdeckt über die Kaimauer (Alarmstufe als Mechanik)', 'Drei Container markieren', 'Kapitän befreien und zum Boot bringen', 'Optional: Funkraum abhören'],
    tech: ['Entdeckungsanzeige/Alarm in director.js (Sichtkegel der Bots, „gesehen“-Ereignis)', 'Nachtbeleuchtung über timeOfDay „nacht“', 'Begleitfigur (Kapitän) folgt dem Spieler'],
  },
  {
    n: 5, id: 'm5', title: 'Archiv', map: 'bibliothek', status: 'geplant', type: 'Geiselbefreiung · Beweissicherung',
    story: 'Kessars Leute halten Archivare in der Bibliothek fest, um die Akten der Waffenruhe zu vernichten. Der Trupp muss Raum für Raum vorgehen – ohne die Geiseln zu gefährden – und die Originalverträge sichern, die Kessars Fälschungen widerlegen.',
    goals: ['Lesesaal ohne zivile Verluste räumen (Zivilisten als eigene Figurenklasse, Beschuss = Fehlschlag)', 'Akten aus dem Magazin bergen', 'Brand im Ostflügel eindämmen'],
    tech: ['Zivile Figuren (Soldatenrig ohne Waffe, Pose „Hände hoch/kauern“)', 'Fehlschlag bei Treffern auf Zivilisten'],
  },
  {
    n: 6, id: 'm6', title: 'Brandwald', map: 'brandwald', status: 'geplant', type: 'Luftlandung · Rettung (Hubschrauber)',
    story: 'Kessar lässt den Wald oberhalb zweier Dörfer anzünden, um den Vormarsch zu decken. Falk fliegt als Bordschütze im Hubschrauber mit, die Lenz-Gruppe wird abgesetzt und bringt die Dorfbewohner zur Landezone, während der Hubschrauber Deckung gibt.',
    goals: ['Bordschütze im Anflug (Feuer nur auf markierte Stellungen)', 'Abseilen, Dorfbewohner sammeln', 'Landezone gegen den Gegenstoß halten', 'Mit dem letzten Flug abheben'],
    tech: ['Hubschrauber/Jets aus vehicles/* (paralleler Strang) – Sitz „Bordschütze“, Flugroute als Skript', 'Rauch/Feuer der Karte als Sichtbehinderung'],
  },
  {
    n: 7, id: 'm7', title: 'Niemandsland', map: 'niemandsland', status: 'geplant', type: 'Große Schlacht · Halten der Linie',
    story: 'Kessar greift mit allem an, was ihm folgt. Darens Brigade erhält den Befehl, mitzumarschieren – und verweigert ihn. Nordkorps und Ostbund-Soldaten halten gemeinsam die Kapellenruine, bis Kessars Angriff zusammenbricht.',
    goals: ['Kapellenruine halten (Zonenkontrolle wie Mission 2, größer)', 'Gemeinsame Verbündete beider Fraktionen (Team A mit Ostbund-Tarnung)', 'Artillerie-Funkgerät zurückerobern', 'Verwundete bergen'],
    tech: ['Verbündete mit Ostbund-Aussehen (camo B, Team A)', 'Präzisionsschlag als Skriptereignis'],
  },
  {
    n: 8, id: 'm8', title: 'Nullpunkt', map: 'grenzland', status: 'geplant', type: 'Finale · Erstürmung',
    story: 'Kessar hat sich im Bunker auf dem Funkhügel verschanzt und will über den Sender Angriffsbefehle an alle Einheiten schicken. Der Trupp stürmt den Hügel; im Bunker stellt Falk Kessar, der sich am Ende ergibt. Daren und Brandt verkünden gemeinsam über denselben Sender die Fortsetzung der Waffenruhe.',
    goals: ['Funkhügel stürmen (Gräben, Gittermast)', 'Sender abschalten, bevor der Countdown endet', 'Kessar lebend festnehmen (Fehlschlag, wenn er fällt)', 'Epilog: Ansprache am Sender'],
    tech: ['Bunkerinnenraum der Karte Grenzland (Funkhügel E)', 'Festnahme-Sequenz statt Kampf'],
  },
];
