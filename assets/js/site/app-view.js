/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// §08 App: Herunterladen (PC-App aus dem GitHub-Release, Android-APK), Web-App installieren (beforeinstallprompt,
// Anleitung für iPhone/Firefox/Safari), Offline-Paket, VR-Hinweis, Vergleich. In der Desktop-App statt der Downloads:
// „Du spielst in der App“ mit großem „Spielen.“, Systemangaben, App-Einstellungen (VSync, Start im Vollbild,
// Absturzmerker), Vollbild und Beenden. Plattform-Erkennung und Service Worker: shared/pwa.js.
import { appKind, installState, onInstallChange, promptInstall, precache, swStatus, storageUsage, registerSW } from '../shared/pwa.js?v=20261121041936';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mb = (b) => `${Math.round(b / 1048576)} MB`;

export function init(sec, D, ctx) {
  const kind = appKind();
  // Startbildschirm (21.11.): In der PC-App führt der Menüeintrag zu den App-Einstellungen statt zu den Downloads
  const mi = document.querySelector('#hero-menu a[href="#app"]');
  if (mi && kind === 'desktop-app') mi.lastChild.nodeValue = 'App-Einstellungen';
  if (kind === 'desktop-app') { initDesktop(sec, D, ctx); return; }
  initWeb(sec, kind);
}

/* ------------------------------------------------------------------ Browser / Web-App / Android-App */

function initWeb(sec, kind) {
  const btn = sec.querySelector('#pwa-install');
  const off = sec.querySelector('#pwa-offline');
  const hint = sec.querySelector('#pwa-hint');
  const state = sec.querySelector('#pwa-state');
  if (!btn || !hint) return;
  // Android-App (Capacitor): Download-Karten der PC-App bleiben (Hinweis für den Rechner), Installieren entfällt
  const render = () => {
    const st = installState();
    btn.hidden = !st.canPrompt || st.installed || kind === 'android-app';
    let t = '';
    if (kind === 'android-app') t = 'Du spielst in der Android-App.';
    else if (st.installed) t = 'Installiert – du spielst gerade in der Web-App.';
    else if (st.canPrompt) t = st.android ? 'Legt NULLPUNKT als App auf den Startbildschirm.' : 'Öffnet NULLPUNKT künftig in einem eigenen Fenster, mit Symbol im Startmenü bzw. auf dem Schreibtisch.';
    else if (st.ios) t = 'iPhone/iPad: in Safari unten auf Teilen tippen → „Zum Home-Bildschirm“ → „Hinzufügen“.';
    else if (st.quest) t = 'Quest-Browser: Menü (drei Punkte) → „Installieren“ bzw. als Lesezeichen anheften.';
    else if (st.firefox) t = 'Firefox installiert keine Web-Apps auf dem PC – in Chrome oder Edge öffnen (Symbol in der Adressleiste) oder unten die PC-App nehmen. Spielen geht hier trotzdem.';
    else if (st.safari && st.mac) t = 'Safari auf dem Mac: Ablage → „Zum Dock hinzufügen“.';
    else t = 'Chrome/Edge: Symbol „App installieren“ rechts in der Adressleiste bzw. Menü → „App installieren“. Erscheint es nicht, ist die Seite schon installiert oder der Browser bietet es nicht an.';
    hint.textContent = t;
  };
  render();
  onInstallChange(render);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const r = await promptInstall();
    btn.disabled = false;
    if (state) state.textContent = r === 'accepted' ? 'Installiert. NULLPUNKT liegt jetzt bei deinen Apps.' : r === 'dismissed' ? 'Abgebrochen – geht jederzeit wieder.' : '';
    render();
  });
  // Offline speichern: nur mit Service Worker (nicht auf localhost ohne ?sw=1, nicht in Firefox-Privatfenstern …)
  if (off) {
    registerSW().then((reg) => {
      if (!reg) return;
      off.hidden = false;
      const show = async () => {
        try {
          const s = await swStatus();
          const u = await storageUsage();
          if (state && s && s.code > 20) state.textContent = `Offline bereit: ${s.code} Spieldateien${s.lib ? `, ${s.lib} Grafik-/Klangdateien` : ''}${u && u.usage ? ` (${mb(u.usage)})` : ''}. Karten, die du schon gespielt hast, laufen auch ohne Netz.`;
        } catch { /* Service Worker noch nicht bereit */ }
      };
      show();
      off.addEventListener('click', async () => {
        off.disabled = true;
        if (state) state.textContent = 'Speichere Spieldateien …';
        try {
          const r = await precache((p) => { if (state) state.textContent = `Speichere Spieldateien … ${p.done} / ${p.total}`; });
          if (state) state.textContent = `Gespeichert: ${r.ok} Dateien (${mb(r.bytes)})${r.failed ? `, ${r.failed} nicht erreichbar` : ''}. Grafik der Karten kommt beim ersten Spielen dazu.`;
          await show();
        } catch { if (state) state.textContent = 'Speichern ging nicht (offline oder Speicher voll).'; }
        off.disabled = false;
      });
    });
  }
}

/* ------------------------------------------------------------------ Desktop-App */

function initDesktop(sec, D, ctx) {
  const A = window.nullpunktDesktop;
  const box = sec.querySelector('#app-desk');
  const get = sec.querySelector('#app-get');
  if (!box) return;
  if (get) get.hidden = true;
  const tag = sec.querySelector('.tagline');
  if (tag) tag.textContent = 'Du spielst in der PC-App. Hier ist alles, was nur die App kann.';
  const play = document.querySelector('.hero-cta .cta-fill');
  const href = (play && play.getAttribute('href')) || 'spielen.html';
  const cfg = A.config || {};
  const crash = A.lastCrash;
  const os = { win32: 'Windows', linux: 'Linux', darwin: 'macOS' }[A.platform] || A.platform;
  box.innerHTML = `
    <p class="app-play"><a class="cta-fill" href="${esc(href)}" data-play data-kill>Spielen<span class="o">.</span></a>
      <a class="dl-btn" href="spielen.html">Lobby &amp; Mehrspieler</a></p>
    <dl class="keys app-sys">
      <div><dt><code>App</code></dt><dd>Version ${esc(A.version || '?')} · Spielfassung ${esc(A.build || '?')} · ${esc(os)} ${esc(A.arch || '')}</dd></div>
      <div><dt><code>System</code></dt><dd>${esc(A.memoryGB || '?')} GB RAM · ${esc(A.cpus || '?')} Kerne · Spielspeicher ${esc(A.heapMB || '?')} MB · Chrome ${esc(String(A.chrome || '').split('.')[0])}</dd></div>
    </dl>
    <h3 class="mono-h">Nur in der App</h3>
    <ul class="app-feat">
      <li><strong>Grafikstufe Extrem</strong> – Einstellungen → Grafik. Schatten bis 8192² (auf starken Grafikkarten mit 16 GB RAM, sonst 4096²), mehr Figurenschatten, Partikel und Einschüsse, größte Texturstufe, weitere Sicht auf Großkarten.</li>
      <li><strong>Massenschlacht bis 400 je Seite</strong> (Browser: bis 250).</li>
      <li><strong>Alle Grafiken lokal</strong> – nichts wird nachgeladen, Karten starten schneller.</li>
      <li><strong>Eigener Speicher</strong> – bis 4 GB nur für das Spiel, Grafikkarten-Sperrliste aus, dedizierte GPU auf Laptops.</li>
      <li><strong>Host im Hintergrund</strong> – dein Online-Raum läuft weiter, auch wenn das Fenster nicht vorne ist.</li>
      <li><strong>Vollbild und Maus ohne Browser-Hinweise</strong> – F11 oder Alt+Enter, die App merkt sich Fenster und Vollbild.</li>
    </ul>
    <h3 class="mono-h">App-Einstellungen</h3>
    <div class="app-cfg">
      <label class="app-chk"><input type="checkbox" data-cfg="startFullscreen"${cfg.startFullscreen !== false ? ' checked' : ''}> Im Vollbild starten</label>
      <label class="app-chk"><input type="checkbox" data-cfg="vsync"${cfg.vsync === false ? ' checked' : ''}> Bildrate nicht an den Bildschirm koppeln (VSync aus, wirkt nach Neustart)</label>
      <p class="dl-note" data-cfg-note aria-live="polite"></p>
      ${crash ? `<p class="dl-note app-crash">Der Spielprozess ist zuletzt abgestürzt (${esc(new Date(crash.at).toLocaleString('de-DE'))}, ${esc(crash.reason)}). „Extrem“ nutzt deshalb 4K- statt 8K-Schatten. <button class="txt-btn" type="button" data-act="crash-reset">Zurücksetzen</button></p>` : ''}
      <p class="app-acts"><button class="txt-btn" type="button" data-act="fs">Vollbild an/aus</button> <button class="txt-btn" type="button" data-act="web">Webseite im Browser</button> <button class="txt-btn" type="button" data-act="quit">Beenden</button></p>
    </div>
    <p class="dl-note">Mehrspieler: Browser-, Handy- und VR-Spieler sind in denselben Räumen, wenn alle dieselbe Spielfassung haben. Einladungslinks aus der App führen auf die Webseite.</p>`;
  box.hidden = false;
  const note = box.querySelector('[data-cfg-note]');
  box.addEventListener('change', async (e) => {
    const inp = e.target.closest('input[data-cfg]');
    if (!inp) return;
    const key = inp.dataset.cfg;
    const val = key === 'vsync' ? !inp.checked : inp.checked;
    const ok = await A.setConfig(key, val).catch(() => false);
    if (note) {
      if (!ok) note.textContent = 'Konnte nicht gespeichert werden.';
      else if (key === 'vsync') { note.innerHTML = 'Gespeichert. Wirkt nach einem Neustart der App. <button class="txt-btn" type="button" data-act="relaunch">Jetzt neu starten</button>'; }
      else note.textContent = 'Gespeichert.';
    }
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'fs') A.toggleFullscreen();
    else if (act === 'quit') A.quit();
    else if (act === 'relaunch') A.relaunch();
    else if (act === 'web') A.openExternal(A.webUrl);
    else if (act === 'crash-reset') { A.setConfig('lastCrash', null).then(() => { b.closest('p').textContent = 'Zurückgesetzt. Extrem nutzt wieder 8K-Schatten, wo die Grafikkarte es kann.'; }); }
  });
}
