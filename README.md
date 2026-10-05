# NULLPUNKT.

Ein Ego-Shooter im Browser im Stil von *Call of Duty: Mobile*, gespielt gegen Bots, dazu eine minimale, interaktive Website. Er läuft auf dem Rechner, dem Handy und dem Tablet, ohne Download und ohne Konto.

**Live:** https://germanclaude.github.io/FreeGames-Website/ (sobald GitHub Pages eingeschaltet ist, siehe unten)

- **Website** (`index.html`): ein Schriftmusterbuch, das zurückschießt. Die Seite zeigt keine Fotos und keine Kästen, nur Typografie, feine Linien und einen orangen Zielpunkt. Die Breite der Schrift steht für Reichweite, ihre Stärke für Schaden.
- **Spiel** (`spielen.html`): schnelle Matches gegen Bots in fünf Modi (Team-Deathmatch, Jeder gegen jeden, Herrschaft, Waffenspiel, Schießstand) auf vier Karten (Hafen, Altstadt, Werk, Schießstand). Dazu kommen zehn Waffen, Messer, Splitter- und Haftgranate, Abschussserien (Aufklärer, Präzisionsschlag, Wachgeschütz), Medaillen, Erfahrungspunkte (EP) und Ränge bis Stufe 55. Auf Handy und Tablet gibt es Touch-Steuerung wie in COD Mobile.

Alles ist statisch, aus HTML, CSS und JavaScript (ES-Module), ohne Build-Schritt. Es gibt keinen Server, keine Datenbank, keine Cookies, kein Tracking und keine externen Skripte oder Schriften. Grafik, Texturen, 3D-Modelle und Klänge entstehen beim Laden im Browser.

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

**Tastatur und Maus:** W A S D laufen, Maus zielen, linke Maustaste feuern, rechte Maustaste über Kimme und Korn zielen, R nachladen, Leertaste springen, C ducken bzw. aus dem Sprint rutschen, Umschalt sprinten (beim Zielfernrohr: Atem anhalten), V Messer, G oder Q Granate (halten zum Kochen), 1/2 oder Mausrad Waffe wechseln, 3/4/5 Abschussserien, F/E interagieren (Schießstand), Tab Punktetabelle, Esc Pause.

**Gamepad:** Sticks laufen und zielen, rechter Trigger feuern, linker Trigger zielen. Die übrigen Belegungen zeigt das Spiel unter *Steuerung*.

**Touch:** Gespielt wird im Querformat. Links liegt ein schwebender Joystick; wer ihn bis an den Rand schiebt, sprintet dauerhaft. Rechts wischen zum Umsehen. Der große Feuerknopf erlaubt gleichzeitig Zielen per Wischen. Dazu kommen Knöpfe für Zielen, Nachladen, Springen, Ducken, Granate, Messer, Waffenwechsel und Abschussserien. Zielhilfe und Automatisches Feuern lassen sich in den Einstellungen einschalten.

Die Grafikqualität wählt sich auf „Automatisch“ selbst: niedrig auf Handys, hoch auf starken Rechnern. Bricht die Bildrate ein, senkt das Spiel die Auflösung.

## Daten und Datenschutz

Einstellungen, Fortschritt und Match-Verlauf liegen nur im lokalen Speicher des Browsers (Schlüssel `nullpunkt:*`). Auf der Website lassen sie sich unter **Über → Lokale Daten löschen** entfernen. Es werden keine Daten übertragen. Beim Hosting auf GitHub Pages verarbeitet GitHub technisch notwendige Zugriffsdaten wie IP-Adressen.

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
assets/js/shared/  Daten und Speicher für Website und Spiel (Waffen, Modi, Karten, Einstellungen, Profil)
assets/js/site/    Website
assets/js/game/    Spiel: Engine, Welt und Karten, Waffen, Bots, Modi, HUD und Menüs
```

Dieses Repository enthält die veröffentlichte Fassung. Die Entwicklungsfassung mit Testseiten (`dev/`), Werkzeugen (`tools/`) und technischer Dokumentation (`docs/ARCHITECTURE.md`, `docs/SITE_DESIGN.md`) liegt im Repository `websiteeine-website`.

## Lizenzen

- Three.js: MIT-Lizenz (`assets/vendor/three/LICENSE`)
- Schriften Archivo, JetBrains Mono, Rajdhani: SIL Open Font License 1.1 (`assets/fonts/OFL-*.txt`)
