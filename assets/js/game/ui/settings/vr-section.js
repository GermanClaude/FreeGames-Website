// NULLPUNKT — Abschnitt „VR (Beta)“ im Reiter Steuerung (engine/xr, docs/planung/vr.md): Schalter „VR-Modus (Beta)“ nur,
// wenn der Browser „immersive-vr“ meldet (sonst ein Hinweis, wie man VR startet), dazu Komfort (Vignette, Drehen),
// Haupthand, Laufrichtung, Sitzend/Stehend, echtes Ducken/Lehnen, VR-Grafik und -Auflösung. Die Belegung der
// VR-Controller steht unter Belegung → VR-Controller.

import { esc } from '../dom.js?v=20261121041936';
import { rowHtml, syncRows, setRowDisabled } from './rows.js?v=20261121041936';

export const VR_KEYS = ['vrEnabled', 'vrHand', 'vrTurn', 'vrTurnStep', 'vrTurnSpeed', 'vrVignette', 'vrVignetteStrength', 'vrMoveDir',
  'vrLocomotion', 'vrSeated', 'vrPhysical', 'vrRoomScale', 'vrSmoothing', 'vrGripHold', 'vrTwoHand', 'vrReload', 'vrGrenadeGrab', 'vrScope', 'vrGunAmmo',
  'vrLaser', 'vrQuality', 'vrScale', 'vrFrameRate', 'vrFoveation'];

const HINTS = {
  vrEnabled: 'Im Match erscheint „VR starten“ (unten in der Mitte bzw. im Pausenmenü). Lobby und Einstellungen bleiben am Bildschirm.',
  vrHand: 'Die Waffe liegt in dieser Hand, das Handgelenk der anderen Hand zeigt Leben, Munition und Stand.',
  vrTurn: 'In Schritten ist für die meisten Menschen angenehmer.',
  vrTurnSpeed: 'Nur für flüssiges Drehen.',
  vrVignette: 'Dunkelt den Rand ab, solange du dich per Stick bewegst oder drehst – hilft gegen Übelkeit.',
  vrMoveDir: 'Blickrichtung: Stick nach vorn läuft dorthin, wohin du schaust. Controller: dorthin, wohin die linke Hand zeigt.',
  vrSeated: 'Sitzend: Ducken und Hinlegen nur per Taste (B bzw. lange halten), die Sitzhöhe gilt als Stehen.',
  vrPhysical: 'Kopf zur Seite neigen = lehnen, in die Hocke gehen = ducken, ganz runter = hinlegen.',
  vrGripHold: 'Griff-Taste der Waffenhand halten = Waffe halten. Loslassen steckt sie ins Holster, greifen (am Rücken/an der Hüfte) zieht sie.',
  vrTwoHand: 'Gewehre einhändig: Lauf hängt durch und wackelt, Streuung vierfach, Anlegen nur beidhändig (Nebenhand-Griff am Vorderschaft).',
  vrSmoothing: 'Glättet kleines Handzittern am Lauf; schnelle Schwenks bleiben ungebremst.',
  vrRoomScale: 'Wenn du im Raum gehst, geht deine Figur genauso mit (Stick zusätzlich). Aus: seitlicher Kopfversatz lehnt statt zu gehen.',
  vrLaser: 'Kleiner Punkt dort, wohin der Lauf zeigt (färbt sich bei Treffern).',
  vrQuality: 'Automatisch: auf der Quest-Brille „Niedrig“ (72–90 Bilder/s), am PC mit Air Link wie am Bildschirm.',
  vrScale: 'Weniger = schneller, aber unschärfer. Automatisch: Quest-Brille 80 %, PC 100 %.',
  vrLocomotion: 'Teleport: linken Stick nach vorn halten, Bogen auf den Boden richten, loslassen – kurzes Abblenden, keine Bewegung im Bild. Am angenehmsten bei Übelkeit.',
  vrReload: 'Per Hand: Taste der Waffenhand (A bzw. X) wirft das Magazin aus, Nebenhand greift ein neues an der Brust (Griff-Taste) und schiebt es von unten in den Schacht; bei leerem Patronenlager mit der Nebenhand hinten am Verschluss durchladen. Vereinfacht: Nachlade-Taste wie bisher.',
  vrGrenadeGrab: 'Nebenhand an die Brust, Griff-Taste halten = Granate in der Hand, ausholen und loslassen wirft sie mit deinem Schwung.',
  vrScope: 'Zielfernrohre und Kampfvisiere zeigen ein echtes vergrößertes Bild (kostet etwas Leistung, nur wenn das Auge nah am Okular ist).',
  vrGunAmmo: 'Kleine Anzeige seitlich an der Waffe (Patronen im Magazin), zusätzlich zur Uhr am Handgelenk.',
  vrFrameRate: 'Automatisch: die Brille entscheidet (Quest meist 72 oder 90 Hz). Höher ist flüssiger, braucht aber mehr Leistung.',
  vrFoveation: 'Rechnet den Bildrand mit weniger Pixeln (Quest). Automatisch: Brille stark, PC aus.',
};

/** Unterstützung: null = wird geprüft, true/false. */
function support(G) {
  if (!G.xr) return false;
  return G.xr.supported;
}

/** HTML des Abschnitts (ohne Überschrift). */
export function vrSectionHtml(P) {
  const G = P.G;
  const sup = support(G);
  if (sup !== true) {
    const why = sup === null
      ? 'VR-Unterstützung wird geprüft …'
      : 'Dieser Browser meldet keine VR-Brille (WebXR „immersive-vr“). Auf der Meta Quest 3: diese Seite im Quest-Browser öffnen. Am PC: Quest per Air Link oder Link-Kabel verbinden und die Seite in Chrome oder Edge öffnen (HTTPS).';
    // app (14.11.): Desktop-App (Electron) – WebXR/OpenXR ist eingeschaltet, Electron meldet aber nicht jede Brille;
    // Android-App (WebView) kann gar kein WebXR
    const appWhy = sup === null ? '' : typeof window !== 'undefined' && window.nullpunktDesktop
      ? ' Die PC-App versucht VR über OpenXR (SteamVR, Quest Link), meldet hier aber keine Brille – für PC-VR die Webseite in Chrome oder Edge öffnen; Mehrspieler-Räume sind dieselben.'
      : typeof window !== 'undefined' && window.Capacitor ? ' Die Android-App kann kein VR – auf der Quest den Quest-Browser nehmen.' : '';
    return `<p class="sp-tip" data-vr-status>${esc(why + appWhy)}</p>`;
  }
  const rows = VR_KEYS.map((k) => rowHtml(P, k, { hint: HINTS[k] })).join('');
  return `<p class="sp-tip" data-vr-status>${esc(statusText(G))}</p>${rows}`;
}

function statusText(G) {
  const on = G.settings.get('vrEnabled');
  if (!on) return 'VR-Brille erkannt. Schalte den VR-Modus ein, dann erscheint im Match „VR starten“.';
  const aa = G.renderer && G.renderer.msaa;
  return aa ? 'VR bereit: im Match „VR starten“ wählen. Menü in der Brille: Y-Taste (linke Hand).'
    : 'VR bereit. Kantenglättung für VR wirkt nach dem Neuladen der Seite.';
}

/** Zeilen sperren, solange VR aus ist; Statuszeile nachziehen. */
export function vrSectionSync(host, P, key = null) {
  if (!host) return;
  const G = P.G;
  if (key && VR_KEYS.includes(key)) syncRows(host, P, key);
  const st = host.querySelector('[data-vr-status]');
  if (st && support(G) === true) st.textContent = statusText(G);
  const on = !!G.settings.get('vrEnabled');
  const fluid = G.settings.get('vrTurn') === 'fluessig';
  for (const k of VR_KEYS) {
    if (k === 'vrEnabled') continue;
    let dis = !on;
    let note = dis ? 'Erst VR-Modus einschalten.' : '';
    if (on && k === 'vrTurnStep' && fluid) { dis = true; note = 'Nur beim Drehen in Schritten.'; }
    if (on && k === 'vrTurnSpeed' && !fluid) { dis = true; note = 'Nur beim flüssigen Drehen.'; }
    if (on && k === 'vrVignetteStrength' && !G.settings.get('vrVignette')) { dis = true; note = 'Vignette ist aus.'; }
    setRowDisabled(host, k, dis, note);
  }
}
