# NULLPUNKT als App – alle Wege, Kosten, Grenzen

Stand: 14.11.2026 · Strang „app“ · Desktop-Details: [`desktop.md`](desktop.md)

**Alles ist kostenlos und ohne Konto.** Es gibt keinen Store-Zwang, keine Anmeldung, keine Werbung. Alle Plattformen
spielen in denselben Mehrspieler-Räumen (P2P über Nostr-Relays + WebRTC), sofern sie dieselbe Spielfassung (BUILD) haben.

## Überblick

| Weg | Für | Was man bekommt | Download | Kosten |
|---|---|---|---|---|
| **Browser** | alle | das Spiel, sofort | nichts | 0 € |
| **Web-App (PWA)** | PC (Chrome/Edge), Android, iPhone/iPad, Meta Quest | eigenes Fenster/Symbol, Vollbild, Start ohne Adressleiste, offline spielbar | nichts vorab (Code ≈ 13 MB beim „Für offline speichern“, Grafik beim Spielen) | 0 € |
| **PC-App** (Electron) | Windows, Linux | Extrem-Grafik, Massenschlacht bis 400/Seite, alle Assets lokal, eigener 4-GB-Speicher, Host im Hintergrund, Startseite + App-Einstellungen | ≈ 280 MB | 0 € |
| **Android-App** (Capacitor, APK) | Android | eigenes App-Symbol, Vollbild ohne Systemleisten, gleiche Fassung wie online | ≈ 5–10 MB | 0 € |
| iOS-App-Store | – | **nicht gebaut** | – | bräuchte Apple-Entwicklerkonto (99 $/Jahr) + Mac |
| VR | Meta Quest (Quest-Browser), PC-VR (Chrome/Edge) | WebXR-Beta im Spiel | nichts | 0 € |

### PWA-Installation oder echte App – der Unterschied

- **Web-App (PWA)** = die Webseite, vom Browser „installiert“: Symbol im Startmenü/Startbildschirm, eigenes Fenster ohne
  Adressleiste, Service Worker hält Code und gespielte Karten für offline vor. Technisch läuft sie **im Browser** (Chrome,
  Edge, Safari, Quest-Browser) – mit dessen Grenzen: Tab-Speicher (2–4 GB, mit anderen Tabs geteilt), GPU-Sperrliste,
  Drosselung im Hintergrund, Grafik bis „Ultra“. Updates kommen automatisch mit der Webseite. Kein Download vorab.
- **Echte App (PC-App)** = eigenes Programm (Electron, mit eigenem Chromium). Alles liegt lokal (≈ 280 MB), eigene
  Speichergrenze nur fürs Spiel, Hardware-Schalter (Sperrliste aus, dedizierte GPU, keine Hintergrund-Drosselung), daher
  die Zusätze Extrem-Grafik und größere Massenschlacht. Updates: neue Version installieren (die App sagt Bescheid).
- **Android-App** = schlanke Hülle (WebView), die die Webseite lädt. Vorteil gegenüber der PWA: echtes APK (z. B. zum
  Weitergeben), Vollbild ohne Systemleisten. Grafisch gleich wie die Web-App.

## Download-Wege (Startseite §08 „App“)

Die Startseite hat den Bereich **§08 App · Herunterladen** (Index → „App“):

- **PC-App:** Knöpfe auf `https://github.com/GermanClaude/FreeGames-Website/releases/latest/download/…`
  - `NULLPUNKT-Setup.exe` (Windows-Installer), `NULLPUNKT-portable.exe` (ohne Installation), `NULLPUNKT-linux.AppImage`
  - Dateinamen sind **ohne Versionsnummer** (desktop/package.json `artifactName`), sonst würden die Links bei jedem
    Release brechen. Die Knöpfe funktionieren erst, wenn ein Release mit Tag `v*` existiert.
- **Im Browser installieren:** Knopf „Als App installieren“ (Chrome/Edge/Android: `beforeinstallprompt`), sonst passende
  Anleitung (iPhone: Teilen → Zum Home-Bildschirm; Quest-Browser; Firefox: geht am PC nicht → Chrome/Edge oder PC-App;
  Safari/Mac: Ablage → Zum Dock). „Für offline speichern“ lädt Seiten + gesamten Code in den Zwischenspeicher.
- **Android:** PWA (empfohlen) oder `NULLPUNKT-android.apk` aus dem Release.
- **VR:** Hinweis Quest-Browser / PC-VR über Chrome oder Edge.
- Vergleichstabelle Web-App ↔ PC-App.

In der **PC-App** sind die Download-Karten ausgeblendet; dort steht „Du spielst in der PC-App“ mit großem „Spielen.“,
Systemangaben, „Nur in der App“ und App-Einstellungen. In der **Android-App** entfällt der Installieren-Knopf.

## Web-App (PWA) – Technik

- `manifest.webmanifest`: `display: standalone` mit `display_override: ["fullscreen", "standalone"]` (Android/Quest
  starten im Vollbild, am PC ein eigenes Fenster), `start_url: ./index.html?quelle=app` (Startseite, „Spielen.“ führt ins
  Spiel), `id` unverändert `./spielen.html` (bestehende Installationen bleiben dieselbe App), Symbole 192/512 als `any`
  und `maskable`, Schnellzugriffe „Sofort spielen“ und „Lobby & Mehrspieler“, `orientation: any` (Startseite hochkant,
  Spiel dreht selbst quer).
- `sw.js` (Wurzel, Geltungsbereich `./`), registriert von `assets/js/shared/pwa.js` als `sw.js?v=<BUILD>` – jede neue
  Fassung bringt einen neuen Service Worker mit. Zwischenspeicher:
  - `np-code-<BUILD>`: Seiten, Code, CSS, Schriften, Bilder, three.js. Alte Fassungen werden beim Aktivieren gelöscht.
  - `np-lib`: `assets/lib/**` (Texturen, Modelle, HDRIs, Klang), bleibt über Fassungen; jeder Eintrag wird nach einem
    Update einmal im Hintergrund nachgeprüft (bedingte Anfrage).
  - Seiten und `version.json`: zuerst Netz (4 s), sonst Zwischenspeicher. `?v=<BUILD>`-Dateien: zuerst Zwischenspeicher.
    Übrige eigene Dateien: sofort aus dem Speicher, im Hintergrund erneuern. Range-Anfragen, fremde Server (Relays),
    `cache: 'reload'` (Update-Knopf im Spiel) gehen am Speicher vorbei bzw. immer ins Netz.
  - **Wichtig für Veröffentlichungen:** Code-Änderungen erreichen PWA-Nutzer erst mit einer neuen BUILD (`tools/publish.sh`
    bzw. `version.json` + `?v=`). Wird Code ohne neue BUILD hochgeladen, sehen installierte Web-Apps bis zur nächsten BUILD
    den alten Stand (Seiten selbst kommen frisch).
- Kein Service Worker in der Desktop-App (`app://`, Dateien lokal) und auf `localhost` nur mit `?sw=1` (Entwicklung bei
  gleicher BUILD sonst mit altem Code). `?sw=0` meldet ihn ab.
- Datenschutz-Liste der Startseite nennt den Zwischenspeicher (nur Spieldateien).

## Android-App (APK) – `mobile/`

- **Capacitor 8.6.0**, Hülle mit `server.url = https://germanclaude.github.io/FreeGames-Website/index.html?quelle=android`:
  die App lädt die Webseite. Damit hat die Android-App **immer dieselbe Spielfassung wie der Browser** (Crossplay ohne
  Versionsfrust), und Updates brauchen kein neues APK. Offline übernimmt der Service Worker; ist beim allerersten Start
  kein Netz da, zeigt die App `www/offline.html`.
- Warum nicht TWA (Bubblewrap)? Eine TWA ohne Adressleiste braucht `/.well-known/assetlinks.json` auf der **Domain-Wurzel**
  `germanclaude.github.io` – das Projekt liegt unter `/FreeGames-Website/`, die Wurzel gehört einem anderen Repo. Ohne
  diese Datei zeigt eine TWA eine Browserleiste. Capacitor braucht das nicht.
- `scripts/patch-android.mjs` passt das bei jedem Bau neu erzeugte Projekt (`npx cap add android`) an: Mikrofon-Recht
  (Sprachchat), Bildschirm an, Ausrichtung frei, Vollbild ohne Systemleisten (MainActivity), App-Symbol, Version aus dem
  Tag, optionale Release-Signatur.
- **Bauen:** `.github/workflows/android.yml` (ubuntu-latest, JDK 21, Android-SDK der Runner-Vorlage) bei Tag `v*` oder
  von Hand. Ergebnis `NULLPUNKT-android.apk` als Artefakt und im Release.
  - Ohne Secrets: **Debug-APK** (debug-signiert). Jeder Bau hat einen anderen Debug-Schlüssel → ein Update lässt sich
    nicht über die alte Version installieren („App nicht installiert“), vorher deinstallieren.
  - Mit Secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`:
    signiertes Release-APK, Updates gehen drüber. Schlüssel einmal anlegen:
    `keytool -genkeypair -v -keystore nullpunkt.keystore -alias nullpunkt -keyalg RSA -keysize 2048 -validity 10000`,
    dann `base64 -w0 nullpunkt.keystore` als Secret. Den Schlüssel **nie** ins Repo legen und gut aufheben.
- **Lokal bauen:** `cd mobile && npm install && npx cap add android && node scripts/patch-android.mjs && npx cap sync android
  && cd android && ./gradlew assembleDebug` – braucht Android-SDK (Android Studio) und JDK 21.
- **Installieren:** APK im Handy-Browser herunterladen und öffnen. Android fragt „Aus dieser Quelle installieren?“ /
  „Unbekannte Apps installieren“ → für den Browser einmal erlauben. Google Play Protect kann warnen („Unbekannte App“),
  „Trotzdem installieren“. Ein Play-Store-Eintrag kostet einmalig 25 $ (nicht gemacht).
- Quest: Die Android-App kann **kein WebXR** (WebView). Für VR auf der Quest den Quest-Browser + PWA nehmen; ein
  eigenes Quest-APK gibt es deshalb nicht.

## iPhone / iPad

Nur als Web-App: Safari → Teilen → „Zum Home-Bildschirm“. Eine App-Store-App bräuchte ein kostenpflichtiges
Apple-Entwicklerkonto (99 $/Jahr), einen Mac mit Xcode und eine Prüfung durch Apple – bewusst nicht gebaut.
Grenzen auf iOS: Speicher pro Seite knapper, Safari kann den Zwischenspeicher nach Wochen ohne Nutzung leeren.

## VR

- **Meta Quest:** Quest-Browser öffnet die Seite, „Installieren“ legt sie als App ab. Im Spiel: Einstellungen →
  Steuerung → VR (Beta) einschalten, im Match „VR starten“.
- **PC-VR:** Brille über Link/Air Link oder SteamVR, Seite in Chrome/Edge.
- **PC-App:** Die App setzt die Schalter für WebXR/OpenXR (`enable-features=WebXR,OpenXR`). Ob Electron 45 damit eine Brille
  meldet, ist **ungetestet** (keine Brille in der Sandbox, Electron liefert den XR-Gerätedienst nicht zuverlässig mit).
  Meldet die App keine Brille, sagt der VR-Abschnitt im Spiel: für PC-VR die Webseite in Chrome/Edge öffnen – die
  Mehrspieler-Räume sind dieselben.

## Crossplay

- Ein Protokoll für alle (net/*). Ein Spiel kommt zustande, wenn **BUILD und NET_VERSION** gleich sind.
  - Browser, Web-App, Android-App, Quest: laden die Webseite → automatisch gleiche Fassung.
  - PC-App: bringt ihre Fassung mit; ist die Webseite neuer, meldet die App das beim Start (Download-Seite).
    Deshalb bei jeder Veröffentlichung einen Tag `vX.Y.Z` setzen (baut PC-App + APK).
- Einladungslinks zeigen immer auf die öffentliche Seite (`…/spielen.html?raum=CODE`), auch aus der PC-App. Im Browser,
  in der Web-App und auf der Quest öffnen sie direkt; in der PC-App über „Öffnen mit“/Startparameter bzw. Raumcode
  eintippen; in der Android-App den Code eintippen (Android öffnet https-Links ohne App-Link-Prüfung im Browser – der
  Browser-Spieler landet trotzdem im selben Raum).
- **Plattform-Symbol in Lobby, Raumliste und Punktetabelle:** Das Roster-Feld `device` gab es schon (`pc`/`mobile`/`vr`);
  neu ist `app` (PC-App) mit eigenem Symbol und den Bezeichnungen „PC (Browser)“, „PC-App“, „Handy/Tablet“, „VR-Brille“.
  Kein Protokollbruch (nur ein weiterer Wert im bestehenden Feld; ältere Gegenstellen lesen ihn als `pc`), daher
  **NET_VERSION nicht erhöht** (steht auf 17).

## Kosten & Warnungen (alles kostenlos)

| | Warnung | Was tun | Loswerden würde kosten |
|---|---|---|---|
| Windows-.exe | SmartScreen „Der Computer wurde durch Windows geschützt“ | „Weitere Informationen“ → „Trotzdem ausführen“ | Code-Signing-Zertifikat ≈ 70–400 €/Jahr |
| Linux-AppImage | – | `chmod +x NULLPUNKT-linux.AppImage` | – |
| Android-APK | „Unbekannte Apps installieren“, ggf. Play Protect | Browser erlauben, „Trotzdem installieren“ | Play Store 25 $ einmalig |
| iOS | – | Web-App über Safari | Apple-Konto 99 $/Jahr |
| PWA | keine | – | – |

## Grenzen / offen

- Android-APK **lokal nicht gebaut**: Die Sandbox erreicht `dl.google.com` nicht (Android-SDK und Googles Maven-Spiegel
  gesperrt). `npm install`, `npx cap add android` und `scripts/patch-android.mjs` liefen lokal; Gradle scheiterte am
  gesperrten Google-Maven. Der Workflow ist ungeprüft, bis er einmal auf GitHub läuft.
- Mikrofon in der Android-App (Sprachchat) ist vorbereitet (Recht im Manifest, Capacitor fragt zur Laufzeit), ungetestet.
- Service Worker in der Android-WebView (Offline-Start der App) ungetestet.
- PC-VR aus der Electron-App ungetestet (siehe oben).
- Die Release-Links der Startseite gehen erst, wenn ein Release mit den neuen festen Dateinamen existiert.

## Getestet (14.11., Sandbox ohne GPU)

- **Desktop-App (Electron 45, xvfb, unverpackt aus `desktop/`):** startet auf `app://nullpunkt/index.html`, erkennt sich
  (`is-desktop-app`), §08 zeigt den App-Bereich statt der Downloads; Klick auf „Lobby & Mehrspieler“ → `spielen.html`,
  Lobby lädt, eigenes Gerät im Netz = `app`. Keine Seitenfehler, keine 404.
- **Extrem in Electron:** Match Hafen (TDM, 4 Bots) mit `quality=extrem` lief an (nach 289 s Software-GL), Preset
  `extreme: true`, Schatten **4096** (Software-GL → kein 8K), keine Fehler. Der frühere Absturz trat mit 8K-Schatten in
  der Software-GL auf; mit der Absicherung lädt die Karte. 8K auf echter GPU weiterhin ungemessen.
- **PWA (Chromium/Playwright, localhost mit `?sw=1`):** Service Worker aktiv, Chrome meldet **keine
  Installierbarkeits-Fehler**, Manifest ohne Fehler; zweiter Aufruf der Startseite: 40/40 Anfragen aus dem Service
  Worker; „Für offline speichern“: 495 Dateien (12 MB) in 3 s; `spielen.html` danach 389/389 aus dem Service Worker;
  **offline** (Netz aus) laden Startseite (200) und Spiel-Lobby vollständig. iPhone-Ansicht zeigt die Safari-Anleitung.
  Der Install-Knopf selbst (`beforeinstallprompt`) erscheint im kopflosen Testbrowser nicht – nur im echten Chrome/Edge.
