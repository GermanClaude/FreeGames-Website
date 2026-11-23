// NULLPUNKT — Reiter „HUD“: HUD-Stil (Voll · Reduziert · Realismus wie Bodycam) mit Schema-Vorschau,
// Fadenkreuz (Form, Farbe, Vorschau), Bodycam-Einblendung, FPS-Anzeige. Vorlage „Ultra-Realismus“ (wie Bodycam): setzt
// Spielstil, HUD, Bildstil, Kamerabewegung, Waffenhaltung und freies Zielen auf einmal (alles einzeln wieder änderbar).

import { esc } from '../dom.js?v=20261123082814';
import { rowHtml, headHtml, bindRows, syncRows } from './rows.js?v=20261123082814';
import { HINTS } from './schema-page.js?v=20261123082814';

const STYLES = [
  { id: 'voll', label: 'Voll', desc: 'Alles im Blick: Minikarte, Kompass, Munition, Leben, Treffermarker.' },
  { id: 'reduziert', label: 'Reduziert', desc: 'Ohne Minikarte und Kompass, Munition nur als Balken, Leben nur nach Treffern.' },
  { id: 'aus', label: 'Realismus', desc: 'Wie Bodycam: kein Fadenkreuz, keine Munitions- und Lebensanzeige. Nur das Nötigste.' },
];

/** Vorlage „Ultra-Realismus“ (Spielstil GAME_STYLES.ultra, game/ultra.js) – jede Taste setzt genau diese Werte. */
export const ULTRA_PRESET = Object.freeze({
  gameStyle: 'ultra', hudStyle: 'aus', bodycamStamp: true, realisticCrosshair: false,
  lensStyle: 'bodycam', lensStrength: 0.7, grain: 0.55, lensArtifacts: 0.35, lensBorder: false, autoExposure: true,
  cameraMotion: 0.8, weaponPose: 'bodycam', weaponSway: 1, freeAim: 'light',
});
const presetOn = (S) => Object.entries(ULTRA_PRESET).every(([k, v]) => S.get(k) === v);

// Schema je Stil: Minikarte, Punktestand, Kompass, Leben, Munition, Fadenkreuz, Killfeed
function styleArt(id) {
  const full = id === 'voll';
  const red = id === 'reduziert';
  const parts = [
    full ? '<circle class="ha-mm" cx="12" cy="12" r="8"/>' : '',
    `<rect class="ha-top" x="${full ? 38 : 40}" y="3" width="${full ? 24 : 20}" height="5" rx="1"/>`,
    full ? '<rect class="ha-comp" x="34" y="10" width="32" height="2" rx="1"/>' : '',
    full ? '<rect class="ha-hp" x="4" y="51" width="22" height="3" rx="1"/>' : red ? '<rect class="ha-hp is-dim" x="4" y="51" width="16" height="2" rx="1"/>' : '',
    full ? '<rect class="ha-ammo" x="78" y="47" width="18" height="8" rx="1"/>' : red ? '<rect class="ha-ammo is-dim" x="82" y="52" width="14" height="2" rx="1"/>' : '',
    id !== 'aus' ? '<path class="ha-x" d="M50 26v3M50 31v3M45 30h3M52 30h3"/>' : '',
    id !== 'aus' ? '<rect class="ha-feed" x="70" y="16" width="26" height="2" rx="1"/><rect class="ha-feed" x="76" y="20" width="20" height="2" rx="1"/>' : '<rect class="ha-feed is-dim" x="80" y="16" width="16" height="2" rx="1"/>',
  ].join('');
  return `<svg class="ha" viewBox="0 0 100 60" aria-hidden="true"><rect class="ha-bg" width="100" height="60" rx="3"/>${parts}</svg>`;
}

export function hudPage(P) {
  const S = P.settings;
  let host = null;
  let off = null;
  const ROWS = ['crosshairStyle', 'crosshairColor', 'reticleSize', 'bodycamStamp', 'showFps', 'tvMode', 'uiScale'];

  function sync() {
    if (!host) return;
    const v = S.get('hudStyle');
    host.querySelectorAll('[data-hs]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hs === v)));
    const x = host.querySelector('.sp-xh');
    if (x) {
      x.dataset.style = S.get('crosshairStyle');
      x.style.setProperty('--cc', S.get('crosshairColor'));
      x.classList.toggle('is-off', v === 'aus');
    }
    const note = host.querySelector('[data-xh-note]');
    if (note) note.hidden = v !== 'aus';
    const pr = host.querySelector('[data-ultra-preset]');
    if (pr) {
      const on = presetOn(S);
      pr.setAttribute('aria-pressed', String(on));
      const st = host.querySelector('[data-ultra-state]');
      if (st) st.textContent = on ? 'Aktiv' : '';
    }
  }

  return {
    keys: ['hudStyle', ...ROWS],
    resetLabel: 'HUD',
    mount(h) {
      host = h;
      host.innerHTML = `
        ${headHtml('Vorlage')}
        <div class="lk-cards hs-cards">
          <button type="button" class="lk-card" data-ultra-preset aria-pressed="false">${styleArt('aus')}<b>Ultra-Realismus <small data-ultra-state></small></b><small>Wie Bodycam: Spielstil „Ultra-Realismus“, kein HUD, Zeitstempel, Bodycam-Linse, tiefe Waffenhaltung, mehr Kamerabewegung, freies Zielen (leicht). Bei Reiseübelkeit danach unter „Grafik“ die Kamerabewegung senken.</small></button>
        </div>
        ${headHtml('HUD-Stil')}
        <div class="lk-cards hs-cards" role="radiogroup" aria-label="HUD-Stil">
          ${STYLES.map((s) => `<button type="button" class="lk-card" role="radio" data-hs="${s.id}" aria-pressed="false">${styleArt(s.id)}<b>${esc(s.label)}</b><small>${esc(s.desc)}</small></button>`).join('')}
        </div>
        ${headHtml('Fadenkreuz')}
        <div class="sp-xpreview" aria-hidden="true"><div class="sp-xh"><i class="l"></i><i class="r"></i><i class="t"></i><i class="b"></i><i class="c"></i><i class="o"></i></div><span>Vorschau</span><small data-xh-note hidden>Im Stil „Realismus“ ausgeblendet.</small></div>
        ${rowHtml(P, 'crosshairStyle', { hint: 'Schrotflinten zeigen immer den Streukreis.' })}
        ${rowHtml(P, 'crosshairColor')}
        ${headHtml('Visier')}
        ${rowHtml(P, 'reticleSize', { hint: 'Größe des Leuchtpunkts in Leuchtpunkt- und Holo-Visieren (beim Holo nur der Mittelpunkt, der Ring bleibt).' })}
        ${headHtml('Anzeigen')}
        ${rowHtml(P, 'bodycamStamp', { hint: HINTS.bodycamStamp })}
        ${rowHtml(P, 'showFps', { hint: HINTS.showFps })}
        ${headHtml('Oberfläche')}
        ${rowHtml(P, 'tvMode', { hint: 'Für Fernseher und Konsolen: größere Schrift und Knöpfe, Abstand zum Bildschirmrand. Automatisch an im Xbox- und PlayStation-Browser und auf Fernsehern.' })}
        ${rowHtml(P, 'uiScale', { hint: 'Größe von Menüs und HUD-Anzeigen. Automatisch: 130 % im TV-Modus, sonst 100 %.' })}`;
      off = bindRows(host, { ...P, after: sync });
      host.addEventListener('click', onClick);
      sync();
    },
    unmount() { if (off) off(); if (host) host.removeEventListener('click', onClick); host = null; },
    sync(key) { if (!host) return; syncRows(host, P, key); sync(); },
  };

  function onClick(e) {
    if (e.target.closest('[data-ultra-preset]')) {
      for (const [k, v] of Object.entries(ULTRA_PRESET)) { try { S.set(k, v); } catch { /* unbekannter Schlüssel */ } }
      P.sound('click');
      sync();
      return;
    }
    const b = e.target.closest('[data-hs]');
    if (!b) return;
    S.set('hudStyle', b.dataset.hs);
    P.sound('click');
    sync();
  }
}
