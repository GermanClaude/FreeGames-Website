// NULLPUNKT — Android-Projekt nach `npx cap add android` anpassen (läuft im Workflow .github/workflows/android.yml und
// lokal). Das erzeugte Projekt mobile/android/ gehört nicht ins Repo – es wird bei jedem Bau neu erzeugt und gepatcht:
//   • Rechte: Mikrofon (Sprachchat, WebRTC) + Audio-Einstellungen; INTERNET bringt Capacitor mit
//   • Geräte: Touchscreen/Controller optional, Android-TV-Starter (Leanback) – Spiel ist komplett per Controller bedienbar
//   • Aktivität: Querformat/Hochformat frei (Startseite hochkant, Spiel quer), Bildschirm an, Hardwarebeschleunigung
//   • MainActivity: Vollbild (System-Leisten ausblenden, mit Wischen kurz einblenden), Mikrofon-Freigabe für getUserMedia
//   • Symbol: assets/img/icon-512.png als Launcher-Symbol (adaptive Symbole der Vorlage entfernt)
//   • Version: APP_VERSION (z. B. aus dem Tag v1.2.3) und APP_VERSION_CODE (Laufnummer) in app/build.gradle
// Aufruf: node scripts/patch-android.mjs   (im Ordner mobile/)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.resolve(HERE, '..');
const REPO = path.resolve(MOBILE, '..');
const AND = path.join(MOBILE, 'android');
const cfg = JSON.parse(fs.readFileSync(path.join(MOBILE, 'capacitor.config.json'), 'utf8'));
const APP_ID = cfg.appId;

if (!fs.existsSync(AND)) { console.error('mobile/android fehlt – erst `npx cap add android`.'); process.exit(1); }

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); console.log('  gepatcht', path.relative(MOBILE, p)); };

/* Manifest */
const manPath = path.join(AND, 'app/src/main/AndroidManifest.xml');
let man = read(manPath);
for (const perm of ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.WAKE_LOCK']) {
  if (!man.includes(perm)) man = man.replace(/(<\/manifest>)/, `    <uses-permission android:name="${perm}" />\n$1`);
}
if (!man.includes('android.hardware.microphone')) man = man.replace(/(<\/manifest>)/, '    <uses-feature android:name="android.hardware.microphone" android:required="false" />\n$1');
// plattform (19.11.): auch ohne Touchscreen installierbar (Android-TV, Chromebook, Konsolen-artige Geräte mit Controller);
// Controller sind optional. Android TV listet die App im Leanback-Starter (Kategorie LEANBACK_LAUNCHER, Banner = Symbol).
for (const f of ['android.hardware.touchscreen', 'android.hardware.gamepad', 'android.software.leanback']) {
  if (!man.includes(`"${f}"`)) man = man.replace(/(<\/manifest>)/, `    <uses-feature android:name="${f}" android:required="false" />\n$1`);
}
if (!man.includes('LEANBACK_LAUNCHER')) {
  man = man.replace(/(<category android:name="android.intent.category.LAUNCHER"\s*\/>)/, '$1\n                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />');
}
if (!/android:banner=/.test(man)) man = man.replace(/<application\b/, '<application\n        android:banner="@mipmap/ic_launcher"');
man = man.replace(/<activity\b([^>]*?)>/, (m, attrs) => {
  let a = attrs;
  if (!/screenOrientation=/.test(a)) a += '\n            android:screenOrientation="fullUser"';
  if (!/hardwareAccelerated=/.test(a)) a += '\n            android:hardwareAccelerated="true"';
  if (!/keepScreenOn=/.test(a)) a += '\n            android:keepScreenOn="true"';
  return `<activity${a}>`;
});
write(manPath, man);

/* MainActivity: Vollbild + Mikrofon */
const javaDir = path.join(AND, 'app/src/main/java', ...APP_ID.split('.'));
const mainJava = path.join(javaDir, 'MainActivity.java');
write(mainJava, `package ${APP_ID};

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/** NULLPUNKT: Webseite im Vollbild (System-Leisten aus, Wischen blendet sie kurz ein). Generiert von scripts/patch-android.mjs. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        immersive();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    private void immersive() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
`);

/* Symbol */
const res = path.join(AND, 'app/src/main/res');
const icon = path.join(REPO, 'assets/img/icon-512.png');
fs.rmSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true, force: true });
for (const d of fs.readdirSync(res).filter((x) => x.startsWith('mipmap-'))) {
  for (const f of fs.readdirSync(path.join(res, d))) if (/^ic_launcher/.test(f)) fs.rmSync(path.join(res, d, f));
  fs.copyFileSync(icon, path.join(res, d, 'ic_launcher.png'));
  fs.copyFileSync(icon, path.join(res, d, 'ic_launcher_round.png'));
}
console.log('  Symbol: icon-512.png in', fs.readdirSync(res).filter((x) => x.startsWith('mipmap-')).join(', '));
// Startbild (Splash) einfarbig statt Capacitor-Logo
for (const d of fs.readdirSync(res).filter((x) => x.startsWith('drawable'))) {
  const p = path.join(res, d, 'splash.png');
  if (fs.existsSync(p)) fs.copyFileSync(icon, p);
}

/* Version */
const gradlePath = path.join(AND, 'app/build.gradle');
let gr = read(gradlePath);
const ver = String(process.env.APP_VERSION || JSON.parse(read(path.join(MOBILE, 'package.json'))).version).replace(/^v/, '');
const code = Math.max(1, parseInt(process.env.APP_VERSION_CODE || '1', 10) || 1);
gr = gr.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${ver}"`);
// Signatur für Release-Bau aus Umgebungsvariablen (Workflow-Secrets); ohne Variablen bleibt nur der Debug-Bau
if (!gr.includes('NULLPUNKT_KEYSTORE')) {
  gr = gr.replace(/android\s*\{/, `android {
    signingConfigs {
        release {
            if (System.getenv("NULLPUNKT_KEYSTORE")) {
                storeFile file(System.getenv("NULLPUNKT_KEYSTORE"))
                storePassword System.getenv("NULLPUNKT_KEYSTORE_PASSWORD")
                keyAlias System.getenv("NULLPUNKT_KEY_ALIAS")
                keyPassword System.getenv("NULLPUNKT_KEY_PASSWORD")
            }
        }
    }`);
  gr = gr.replace(/(buildTypes\s*\{\s*release\s*\{)/, `$1\n            if (System.getenv("NULLPUNKT_KEYSTORE")) signingConfig signingConfigs.release`);
}
write(gradlePath, gr);
console.log(`  Version ${ver} (${code})`);
