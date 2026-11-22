// NULLPUNKT — TV-/Konsolen-Modus (plattform, 19.11.): größere Oberfläche für den Couch-Abstand und Fernseher mit
// Überscan. Einstellungen tvMode ('auto' | 'an' | 'aus'; auto = Xbox-/PlayStation-Browser und Fernseher, shared/gamepad.js
// tvDefault) und uiScale ('auto' | 90 … 150 %). Wirkung über CSS (assets/css/game.css, Abschnitt „TV-Modus“):
//   body.np-tv            größere Ränder (Überscan 3 %), dickerer Fokusrahmen
//   --np-ui-zoom          Zoomfaktor für Menüs (.m-screen) und die festen HUD-Blöcke (Ecken, Mitte oben, Hinweise) –
//                         nicht für Weltmarker/Fadenkreuz (die rechnen in Bildschirm-Pixeln)
// Rein DOM-seitig, kein Einfluss auf Spiellogik oder Netz.

import { uiScaleFor, consoleKind } from '../../shared/gamepad.js?v=20261122020853';

/** Zustand anwenden; → { tv, scale }. */
export function applyTvMode(settings) {
  if (typeof document === 'undefined' || !document.body) return { tv: false, scale: 1 };
  const get = (k, d) => { try { return settings && typeof settings.get === 'function' ? settings.get(k) ?? d : d; } catch { return d; } };
  const r = uiScaleFor(get('tvMode', 'auto'), get('uiScale', 'auto'), { width: window.innerWidth || 1280 });
  const b = document.body;
  b.classList.toggle('np-tv', r.tv);
  if (r.scale !== 1) b.style.setProperty('--np-ui-zoom', String(r.scale));
  else b.style.removeProperty('--np-ui-zoom');
  b.classList.toggle('np-ui-zoomed', r.scale !== 1);
  const kind = consoleKind();
  if (kind) b.dataset.console = kind; else delete b.dataset.console;
  return r;
}

/** Einmal beim Start: anwenden und bei Änderungen (Einstellung, Fenstergröße) nachziehen. → Abmelden. */
export function initTvMode(G) {
  const S = G && G.settings;
  // Edge auf der Xbox (EdgeHTML) steuert sonst mit dem Controller einen Mauszeiger und B = Zurück im Browser; so kommen
  // die Tasten als Gamepad-API im Spiel an. Andere Browser kennen die Eigenschaft nicht (harmlos).
  try { if (typeof navigator !== 'undefined' && 'gamepadInputEmulation' in navigator) navigator.gamepadInputEmulation = 'gamepad'; } catch { /* nur lesbar */ }
  const run = () => { try { G.tvMode = applyTvMode(S); } catch (err) { console.warn('[NULLPUNKT] TV-Modus:', err); } };
  run();
  let t = 0;
  const onResize = () => { clearTimeout(t); t = setTimeout(run, 150); };
  window.addEventListener('resize', onResize);
  const off = S && typeof S.onChange === 'function' ? S.onChange((key) => { if (key === 'tvMode' || key === 'uiScale') run(); }) : null;
  return () => { window.removeEventListener('resize', onResize); if (off) off(); };
}
