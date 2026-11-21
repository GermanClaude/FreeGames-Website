/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// Spielmenü (21.11.): Texte, die das Hauptmenü, der Ladebildschirm und die Übergänge per JavaScript setzen – an einer
// Stelle, damit der Übersetzungs-Strang (shared/i18n.js) sie später übernehmen kann. Schlüssel bleiben stabil;
// lang.js fragt zuerst die i18n-API (t('site.<schlüssel>')) und fällt sonst auf diese deutschen Texte zurück.
export const STRINGS = Object.freeze({
  // Ladebildschirm
  'boot.code': 'Spielcode wird geladen …',
  'boot.data': 'Spieldaten: Waffen, Karten, Modi …',
  'boot.data.ok': 'Spieldaten bereit',
  'boot.fonts': 'Schriften und Startbildschirm …',
  'boot.fonts.ok': 'Schriften und Startbildschirm bereit',
  'boot.tex': 'Texturen werden vorgeladen …',
  'boot.tex.ok': 'Texturen vorgeladen ({n})',
  'boot.update': 'Service Worker und Update-Prüfung …',
  'boot.update.ok': 'Spielfassung {build} ist aktuell',
  'boot.update.new': 'Neuere Spielfassung {build} verfügbar – lädt beim nächsten Start',
  'boot.update.off': 'Offline – gespeicherte Fassung {build}',
  'boot.update.sw': 'Offline-Speicher aktiv',
  'boot.ready': 'Bereit.',
  'boot.skip': 'Überspringen',
  'boot.conn.ok': 'VERBINDUNG STEHT',
  // Tipps (Lade- und Übergangsbildschirm)
  'tips': [
    'Tipp: Gehockt und still stehend streut jede Waffe am wenigsten.',
    'Tipp: Im Panzer sagt der Kommandant das Ziel an – Richtschütze, Panzer, halbrechts, 800, Feuer.',
    'Tipp: Halbleere Magazine bleiben in der Simulation halbleer. Zähl mit.',
    'Tipp: Dauerfeuer frisst sich durch dünne Wände. Deckung ist nicht gleich Schutz.',
    'Tipp: Mit dem Raumcode spielen Browser, Handy, VR und PC-App zusammen.',
    'Tipp: Das Übungsgelände hat jedes Fahrzeug zum Einsteigen – ohne Gegner.',
    'Tipp: Fünf Schuss auf den Punkt im Hauptmenü schießen die Waffe ein.',
    'Tipp: Blutungen stillst du mit Verband oder Abbinden, bevor das Bild grau wird.',
    'Tipp: Controller? Steuerkreuz wählt, A bestätigt, B geht zurück.',
    'Tipp: Grafik ruckelt? Unter Einstellungen eine Stufe niedriger wählen.',
  ],
  // Menü
  'menu.root': 'Hauptmenü',
  'menu.back': 'Zurück',
  'menu.app.desktop': 'Updates & App',
  'menu.quit': 'Beenden',
  'hint.nav': 'Auswählen',
  'hint.ok': 'Bestätigen',
  'hint.back': 'Zurück',
  'hint.tabs': 'Reiter',
  'hint.scroll': 'Blättern',
  // Übergang ins Spiel
  'warp.title': 'Einsatz wird vorbereitet',
  'warp.lobby': 'Lobby',
  'warp.campaign': 'Kampagne',
  'warp.room': 'Raum {code}',
  // Galerie
  'gal.count': '{n} Bilder',
  'gal.of': '{i} / {n}',
  // Schnellwahl
  'quick.lang': 'Sprache',
  'quick.lang.note': 'Startseite und Spiel sind derzeit auf Deutsch. Die gewählte Sprache wird gespeichert und gilt, sobald die Übersetzung da ist.',
  'quick.sound': 'Menüklänge',
  'quick.on': 'An',
  'quick.off': 'Aus',
  'quick.gfx': 'Grafik',
  'quick.motion': 'Bewegung',
  'quick.motion.full': 'Voll',
  'quick.motion.less': 'Reduziert',
  'quick.profile': 'Profil',
  'quick.profile.go': 'Profil und Spielername',
  // Beenden
  'quit.ask': 'NULLPUNKT schließen?',
  // Neue Fassung (Webseite, Web-App, Android) und App-Update (PC-App)
  'upd.web': 'Neue Version von NULLPUNKT ist da.',
  'upd.web.reload': 'Neu laden',
  'upd.later': 'Später',
  'upd.app.ready': 'Update {version} ist geladen und wird beim Beenden installiert.',
  'upd.app.now': 'Jetzt neu starten und installieren',
  'upd.app.manual': 'Neue App-Version {version} verfügbar.',
  'upd.app.download': 'Herunterladen',
});

/** Sprachen der Auswahl (Name in der eigenen Sprache). */
export const LANGS = Object.freeze([
  ['de', 'Deutsch'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['ru', 'Русский'], ['zh', '简体中文'],
]);
