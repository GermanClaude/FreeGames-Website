# NULLPUNKT.

Ein Ego-Shooter im Browser im Stil von *Call of Duty: Mobile*, gespielt gegen Bots oder online mit Freunden (Mehrspieler, Beta), dazu eine minimale, interaktive Website. Er läuft auf dem Rechner, dem Handy, dem Tablet und mit VR-Brille (Beta), ohne Download und ohne Konto.

**Live:** https://germanclaude.github.io/FreeGames-Website/ (sobald GitHub Pages eingeschaltet ist, siehe unten)

- **Website** (`index.html`): ein Schriftmusterbuch, das zurückschießt. Die Seite zeigt keine Fotos und keine Kästen, nur Typografie, feine Linien und einen orangen Zielpunkt. Die Breite der Schrift steht für Reichweite, ihre Stärke für Schaden.
- **Spiel** (`spielen.html`): realistischer Ego-Shooter gegen Bots mit acht Modi (Eroberung mit Panzern und Jeeps, Team-Deathmatch, Jeder gegen jeden, Herrschaft, Abschuss bestätigt, Infiziert, Waffenspiel, Schießstand) auf fünf Karten (Hafen, Altstadt, Werk, Schießstand und die große Karte Grenzland). Dazu kommen 20 Waffen inklusive Raketenwerfer, vier Nahkampfwaffen, Splitter-, Haft-, Aufschlag-, Brand-, Blend- und Rauchgranaten, 25 Tarnmuster, vier Klassen (Sturm, Sanitäter, Pionier, Aufklärer) mit Rüstung und Platten, Hinlegen, Lehnen und Klettern. Es spielen bis zu 32 gegen 32, auf Veteran und Elite mit Trupp-Taktik. Wählbar sind Wetter (Klar, Dunst, Morgennebel, Bewölkt), Tageszeit und Spielstil (Arcade oder Realistisch). Die Bots lernen auf Wunsch deinen Spielstil (Lieblingsplätze, Kampfentfernung, Camping) und stellen sich darauf ein, je nach Schwierigkeit unterschiedlich stark (Einstellung „Lernende Bots“). Hinzu kommen Abschussserien, Medaillen, Erfahrungspunkte (EP) und Ränge bis Stufe 55. Auf Handy und Tablet gibt es Touch-Steuerung. Online spielen bis zu 32 Teilnehmer in einem Raum (freie Plätze füllen Bots auf), verbündeten Bots gibt man über ein Befehlsrad Anweisungen.

Alles ist statisch, aus HTML, CSS und JavaScript (ES-Module), ohne Build-Schritt. Es gibt keinen eigenen Server, keine Datenbank, keine Cookies, kein Tracking und keine externen Skripte oder Schriften. Ein Teil der Grafik und der Klänge entsteht beim Laden im Browser. Dazu kommen frei verwendbare Fototexturen, 3D-Modelle, Himmel und Klangaufnahmen (CC0) in `assets/lib/`; die Quellen stehen in `CREDITS.md`.

## GitHub Pages einschalten (einmalig)

1. Im Repository **Settings → Pages** öffnen.
2. Unter *Build and deployment* bei **Source** „Deploy from a branch“ wählen.
3. Bei **Branch** `main` und den Ordner `/ (root)` wählen und **Save** klicken.
4. Nach ein bis zwei Minuten ist die Seite unter **https://germanclaude.github.io/FreeGames-Website/** erreichbar. Jeder weitere Push auf `main` aktualisiert sie automatisch.

Die Datei `.nojekyll` sorgt dafür, dass GitHub die Dateien unverändert ausliefert. Alle Pfade sind relativ, die Seite funktioniert deshalb im Unterordner `/FreeGames-Website/`. `404.html` ist die Fehlerseite für falsche Adressen.

Link-Vorschauen (Messenger, soziale Netze) brauchen absolute Adressen. In `index.html` zeigen `canonical`, `og:url`, `og:image` und `twitter:image` auf `https://germanclaude.github.io/FreeGames-Website/`. Wer eine eigene Domain nutzt, passt diese vier Zeilen an.

## Spielen

1. Website öffnen und auf **Sofort spielen.** tippen. Wer Modus, Karte, Schwierigkeit und Teamgröße selbst wählen will, nimmt **Einsatz zusammenstellen**.
2. In der Lobby die Ausrüstung wählen und **Einsatz starten** drücken.

**Tastatur und Maus:** W A S D laufen, Maus zielen, linke Maustaste feuern, rechte Maustaste über Kimme und Korn zielen, R nachladen, Leertaste springen bzw. klettern, C ducken bzw. aus dem Sprint rutschen, Y hinlegen (auf englischen Tastaturen Z), Z Befehlsrad für verbündete Bots (englisch Y), Q/E lehnen, Umschalt sprinten (beim Zielfernrohr: Atem anhalten), V Messer, G Granate (halten zum Kochen), X Blend- oder Rauchgranate, 1/2 oder Mausrad Waffe wechseln, 4 Schutzplatte einsetzen, B Klassen-Ausrüstung, I Waffe ansehen, L Ausrüstung wechseln, 3/5 Abschussserien, F interagieren und Fahrzeuge, Tab Punktetabelle, Esc Pause. Alle Tasten lassen sich in den Einstellungen frei belegen.

**Gamepad:** Sticks laufen und zielen, rechter Trigger feuern, linker Trigger zielen. Die übrigen Belegungen zeigt das Spiel unter *Steuerung*.

**Touch:** Gespielt wird im Querformat. Links liegt ein schwebender Joystick; wer ihn bis an den Rand schiebt, sprintet dauerhaft. Rechts wischen zum Umsehen. Der große Feuerknopf erlaubt gleichzeitig Zielen per Wischen. Dazu kommen Knöpfe für Zielen, Nachladen, Springen, Ducken, Granate, Messer, Waffenwechsel und Abschussserien. Zielhilfe und Automatisches Feuern lassen sich in den Einstellungen einschalten.

### Mehrspieler (Beta)

1. In der Lobby den Reiter **Mehrspieler** öffnen.
2. **Raum öffnen**: Du bist Host. Den angezeigten Raumcode (6 Zeichen) oder den Einladungslink an Freunde schicken. Wahlweise erscheint der Raum in der Liste **Öffentliche Spiele**.
3. **Beitreten**: Raumcode eingeben oder ein öffentliches Spiel antippen.
4. Der Host stellt Modus, Karte, Mitspielerzahl (bis 32, Rest füllen Bots), Ausdauer, Tageszeit und mehr ein und startet das Match.

Der Verbindungstest im Raum zeigt, wer sich am besten als Host eignet (schnelle Leitung und starkes Gerät). Gespielt wird direkt zwischen den Browsern; der Host-Rechner übernimmt die Bots und die Spielregeln. Hinter manchen Firmen- oder Mobilfunknetzen kommt keine direkte Verbindung zustande – dann hilft ein anderes Netz (z. B. WLAN statt Mobilfunk). Es ist eine erste Fassung: Fehler gerne melden.

### VR (Beta)

Mit Meta Quest 3 (oder anderer WebXR-Brille) im Browser der Brille die Seite öffnen, dann **Einstellungen → Steuerung → VR (Beta)**. Bewegung per Stick, Drehen in Stufen oder fließend, Vignette gegen Übelkeit einstellbar, Ducken und Lehnen mit dem Körper, Anzeige am Handgelenk. Online sehen die anderen deine Kopf- und Handbewegungen.

**Vollbild:** Das Spiel geht beim ersten Klick bzw. Tippen ins Vollbild; Alt + Eingabe oder F11 schaltet um. Auf dem iPhone erlaubt iOS kein Vollbild für Webseiten – dort über Teilen → „Zum Home-Bildschirm“ hinzufügen und vom neuen Symbol starten, dann läuft es ohne Browserleisten.

Die Grafikqualität wählt sich auf „Automatisch“ selbst: niedrig auf Handys, hoch auf starken Rechnern. Bricht die Bildrate ein, senkt das Spiel die Auflösung.

## Daten und Datenschutz

Einstellungen, Fortschritt und Match-Verlauf liegen nur im lokalen Speicher des Browsers (Schlüssel `nullpunkt:*`). Auf der Website lassen sie sich unter **Über → Lokale Daten löschen** entfernen. Ohne Mehrspieler werden keine Daten übertragen.

**Mehrspieler:** Nur beim Öffnen oder Beitreten eines Raums verlassen Daten das Gerät. Öffentliche Nostr-Relays vermitteln den Verbindungsaufbau (Verbindungsangebote verschlüsselt, ohne Konto), STUN-Server von Google und Cloudflare helfen beim Finden der Verbindung. Danach laufen die Daten direkt zwischen den Browsern (WebRTC); die Mitspieler im Raum sehen dabei technisch die IP-Adresse. Sichtbar sind außerdem Spielername, Team, Stufe und Gerät. Öffentliche Spiele stehen mit Raumcode, Hostname und Karte in einer öffentlichen Liste. Beim Hosting auf GitHub Pages verarbeitet GitHub technisch notwendige Zugriffsdaten wie IP-Adressen.

**Impressum:** Ob eines nötig ist, hängt vom Angebot ab (§ 5 DDG, § 18 MStV); im Zweifel rechtlich beraten lassen. Die Angaben stehen in `assets/js/site/config.js`. Solange dort kein Name eingetragen ist, bleibt der Impressum-Block ausgeblendet.

## Lokal ausprobieren

ES-Module brauchen einen Webserver; ein Doppelklick auf `index.html` reicht nicht:

```sh
npx http-server -p 8765 -c-1 .
# dann http://localhost:8765/ öffnen
```

## Aufbau

```
index.html, spielen.html, 404.html, manifest.webmanifest, .nojekyll
assets/css/        Gestaltung (gemeinsame Werte, Website, Spiel)
assets/fonts/      Archivo, JetBrains Mono, Rajdhani (SIL Open Font License)
assets/img/        Symbole, Vorschaubild, Kartenbilder
assets/vendor/     Three.js r186 (MIT) mit den benötigten Zusatzmodulen
assets/lib/        Fototexturen, 3D-Modelle, HDRI-Himmel und Klangaufnahmen (CC0) mit Lader
assets/js/shared/  Daten und Speicher für Website und Spiel (Waffen, Modi, Karten, Einstellungen, Profil)
assets/js/site/    Website
assets/js/game/    Spiel: Engine, Welt und Karten, Waffen, Bots, Modi, HUD und Menüs
```

Dieses Repository enthält die veröffentlichte Fassung. Die Entwicklungsfassung mit Testseiten (`dev/`), Werkzeugen (`tools/`) und technischer Dokumentation (`docs/ARCHITECTURE.md`, `docs/SITE_DESIGN.md`) liegt im Repository `websiteeine-website`.

## Lizenzen

- Three.js: MIT-Lizenz (`assets/vendor/three/LICENSE`)
- Schriften Archivo, JetBrains Mono, Rajdhani: SIL Open Font License 1.1 (`assets/fonts/OFL-*.txt`)
- Fototexturen, Modelle, HDRI-Himmel und Klangaufnahmen in `assets/lib/`: CC0 (Poly Haven, ambientCG u. a., siehe `CREDITS.md`)
