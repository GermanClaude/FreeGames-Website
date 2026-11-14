# NULLPUNKT als Desktop-Spiel (Windows-.exe)

Stand: 14.11.2026 · Ordner `desktop/` · Workflow `.github/workflows/desktop.yml`

Die Desktop-App ist eine **Hülle aus Electron** um genau denselben Spielcode wie die Webseite. Es gibt keinen Fork und
keine Kopie im Repo: Beim Bauen packt electron-builder den aktuellen Stand von `spielen.html` und `assets/**` in die App
(`resources/game`). Die Browser-Version bleibt unverändert die leichte Variante.

## Was die Desktop-Version mehr kann

| | Browser | Desktop-App |
|---|---|---|
| Assets (Texturen, Modelle, HDRIs, Klang) | werden beim Spielen geladen | liegen lokal in der App, kein Download, kein Zeitlimit |
| Grafikstufen | Niedrig – Ultra | zusätzlich **Extrem** |
| JS-Speicher | Tab-Grenze (2–4 GB, mit anderen Tabs geteilt) | fest 4 GB nur für das Spiel (mehr erlaubt V8 nicht) |
| GPU | Chrome-Sperrliste kann die GPU abschalten | Sperrliste aus, dedizierte GPU auf Laptops, WebGPU an |
| Hintergrund | Tab im Hintergrund wird gedrosselt | keine Drosselung (wichtig, wenn du online Host bist) |
| Vollbild | Browser-Vollbild (Esc beendet) | F11 oder Alt+Enter, startet im Vollbild |
| Mehrspieler | WebRTC über Nostr-Relays | gleich – Desktop- und Browser-Spieler spielen zusammen |

**Stufe „Extrem“** (Einstellungen → Grafik → Grafikqualität; nur in der App sichtbar): technisch „Ultra“ plus
- Sonnenschatten 8192² statt 4096² (wenn die GPU so große Texturen kann, sonst 4096²), bis 32 Figuren mit Schatten,
- 1,5× Partikel, 240 Einschusslöcher,
- Fotoscan-Texturen/Modelle in der größten vorhandenen Stufe (Anforderung 4K – heute gibt es höchstens 2K-Sätze; kommen
  4K-Sätze ins Manifest, nimmt Extrem sie automatisch), HDRI-Licht und Himmel 2K,
- Großkarten: Sichtweite 1400 m statt 850 m, Bäume bis 1300 m, mehr Gras, größere Minikarte,
- Massenschlacht bis **400 je Seite** (Ultra: 250), mehr volle Soldaten vor dem Wechsel auf Silhouetten.

Empfohlen: aktuelle Grafikkarte mit ≥ 8 GB Grafikspeicher und ≥ 16 GB RAM. Ruckelt es, „Ultra“ wählen.

Technik: Das Spiel erkennt die App an `window.nullpunktDesktop` (aus `desktop/preload.js`). Alle Unterschiede hängen an
dieser Erkennung (`engine/renderer.js` EXTREME_PRESET, `shared/settings.js`, `world/library.js`, `world/terrain/bigworld.js`,
`shared/modes.data.js` MASS_SIDE, `bots/crowd.js`, Einladungslinks in `ui/net-menus.js`). Im Browser ist nichts davon aktiv.

## Mehrspieler zwischen App und Browser

Gleiches Protokoll, gleicher Code. Ein Spiel kommt nur zustande, wenn **Spielfassung (BUILD) und NET_VERSION gleich**
sind – das gilt schon heute zwischen zwei Browsern. Praktisch heißt das:

- Wird die Webseite aktualisiert, braucht die App die passende neue Version. Die App prüft beim Start (still, ohne
  Download) `version.json` der Webseite und sagt Bescheid, wenn online eine neuere Fassung läuft.
- Deshalb: **bei jeder Veröffentlichung der Webseite auch einen Tag `vX.Y.Z` setzen**, dann baut GitHub die passende App.
- Einladungslinks aus der App zeigen auf die öffentliche Seite (`…github.io/FreeGames-Website/spielen.html?raum=CODE`),
  Browser-Spieler können sie direkt öffnen. Raumcodes funktionieren in beide Richtungen.
- WebRTC (Datenkanäle), Nostr-WebSockets, `crypto.subtle` laufen in Electron wie in Chrome (die App liefert das Spiel über
  das eigene, als „sicher“ registrierte Protokoll `app://nullpunkt/`).

## Bauen

Voraussetzung: Node.js 22 (oder neuer).

```bash
cd desktop
npm ci                 # Electron (~110 MB) + electron-builder
npm start              # App direkt aus dem Repo starten (Entwicklung, Fenster statt Vollbild, F12 = DevTools)
npm run dist:win       # Windows: Installer + portable .exe → desktop/dist/
npm run dist:win-zip   # Windows als ZIP (entpacken, NULLPUNKT.exe starten)
npm run dist:linux     # Linux-AppImage
```

- **Unter Windows** braucht man sonst nichts.
- **Unter Linux für Windows** braucht der NSIS-Installer `wine` inkl. 32 Bit
  (`dpkg --add-architecture i386 && apt-get install wine wine64 wine32:i386`). Ohne wine geht nur `dist:win-zip`.
- Die Electron-Binärdateien kommen von github.com (Releases). Ist das gesperrt: `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`
  bzw. `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/` setzen.
- Build-Ergebnisse gehören **nicht** ins Repo (`desktop/dist/` und `desktop/node_modules/` stehen in `.gitignore`).

### Automatisch über GitHub

`.github/workflows/desktop.yml` baut auf `windows-latest` (Installer + portable .exe) und `ubuntu-latest` (AppImage):

- **Tag pushen:** `git tag v1.0.0 && git push origin v1.0.0` → Release „v1.0.0“ mit den Dateien unter
  *Releases* (https://github.com/GermanClaude/FreeGames-Website/releases). Die Version der App wird aus dem Tag übernommen.
- **Von Hand:** GitHub → *Actions* → „Desktop-App bauen“ → *Run workflow*. Die Dateien liegen dann als Artefakt am Lauf
  (30 Tage).

GitHub Pages (die Webseite) wird davon nicht berührt.

## Installieren (Windows)

- **`NULLPUNKT-Setup-x.y.z.exe`** – Installer: Ordner wählbar, Verknüpfung auf Desktop und im Startmenü,
  deinstallierbar über „Apps & Features“. Installiert pro Benutzer (keine Administratorrechte nötig).
- **`NULLPUNKT-x.y.z-portable.exe`** – ohne Installation, z. B. vom USB-Stick. Entpackt sich bei jedem Start in einen
  Temp-Ordner (Start dauert dadurch einige Sekunden länger).

Spielstände, Profil und Einstellungen liegen in `%APPDATA%\NULLPUNKT` (bleiben bei Updates erhalten). Sie sind getrennt
von denen im Browser.

### Windows-SmartScreen-Warnung

Die .exe ist **nicht digital signiert** (ein Code-Signing-Zertifikat kostet Geld, ca. 70–400 € im Jahr). Windows zeigt
deshalb beim ersten Start „Der Computer wurde durch Windows geschützt“. Das ist bei unsignierten Programmen normal:
**„Weitere Informationen“ → „Trotzdem ausführen“**. Manche Virenscanner melden unsignierte Electron-Apps zusätzlich als
„unbekannt“. Wer das loswerden will, braucht ein Zertifikat (OV/EV) und setzt im Workflow `CSC_LINK`/`CSC_KEY_PASSWORD`
als Secrets – electron-builder signiert dann automatisch.

## Größe

Gemessen am Stand 14.11.2026 (Assets ≈ 164 MB):

| Datei | Größe |
|---|---|
| `NULLPUNKT-Setup-1.0.0.exe` (Installer) | ≈ 276 MB |
| `NULLPUNKT-1.0.0-portable.exe` | ≈ 262 MB |
| `NULLPUNKT-1.0.0-win-x64.zip` | ≈ 303 MB |
| `NULLPUNKT-1.0.0-x86_64.AppImage` (Linux) | ≈ 277 MB |
| installiert | ≈ 450 MB (Electron ≈ 270 MB + Spiel ≈ 180 MB) |

Wachsen die Assets (4K-Texturen), wächst die App entsprechend.

## Updates

Kein automatischer Updater (bewusst einfach). Neue Version: Installer der neuen Version einfach drüber installieren
(Einstellungen bleiben). Die App weist beim Start darauf hin, wenn die Webseite neuer ist. Ein Auto-Update wäre mit
`electron-updater` + GitHub-Releases möglich (braucht für Windows praktisch eine Signatur).

## Bedienung

- **F11** oder **Alt+Enter**: Vollbild an/aus. Die App startet im Vollbild.
- Maus (Zeigersperre), Tastatur, Gamepad und Mikrofon (Sprachchat) wie im Browser.
- Startparameter wie auf der Webseite: `NULLPUNKT.exe --query="debug=1&autostart=1&quality=extrem&map=hafen"`.
  Ein Einladungslink als Parameter (`NULLPUNKT.exe "https://…/spielen.html?raum=CODE"`) öffnet den Raum in der App.

## Bekannte Grenzen

- macOS wird nicht gebaut (bräuchte einen Mac-Runner und Notarisierung).
- Mehr als 4 GB JS-Heap gehen nicht (V8-Grenze); „Mehr Speicher“ heißt: die vollen 4 GB nur für das Spiel.
- Desktop ↔ Browser nur bei gleicher Spielfassung (siehe oben).
- Die Windows-.exe wurde unter Linux (wine) gebaut und dort nicht auf einem echten Windows gestartet; der GitHub-Workflow
  baut nativ auf Windows.
