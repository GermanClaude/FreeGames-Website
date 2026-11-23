// NULLPUNKT — Übungsmenü des Schießstands (Pause → „Übungsgelände“, nur Training auf der Karte range mit
// world.uebung; Logik in modes/training-gelaende.js). Abschnitte: Teleport, Hilfen (Fahrzeug zurücksetzen, Munition,
// Ziele, Zeitlupe, Unverwundbar), Fahrzeug herbeirufen (alle Muster), Panzer-Übung (Simulation/Arcade, Rolle, Panzer →
// Modus „Panzer“ auf dieser Karte), Trefferbilanz. Nutzt nur vorhandene Menü-Klassen (game.css).
import { esc } from './dom.js?v=20261123073102';
import { ICON } from './icons.js?v=20261123073102';

const ROLES = [['kommandant', 'Kommandant'], ['richtschuetze', 'Richtschütze'], ['fahrer', 'Fahrer'], ['ladeschuetze', 'Ladeschütze'], ['mgschuetze', 'MG-Schütze']];
const TANKS = ['karte', 'mbt', 'spz', 'lp21', 'kk', 'kks', 'wk2', 'wk2m', 'wk2h', 'wk2s', 'wk2l', 'wk2j', 'wk1', 'wk1l'];

/** @param {object} menus Menus-Instanz (ui/menus.js) */
export function showUebung(menus) {
  const G = menus.G, U = G.mode && G.mode.gelaende;
  if (!U) { menus.showPause(); return; }
  const A = U.U.areas, info = U.info();
  const pz = { stil: 'simulation', rolle: 'kommandant', panzer: 'karte', ...((G.settings.get('modeOptions') || {}).panzer || {}) };
  const seg = (key, list, cur) => `<div class="m-seg" role="radiogroup" data-seg="${key}">${list.map(([id, l]) => `<button type="button" role="radio" data-val="${esc(id)}" aria-checked="${id === cur}">${esc(l)}</button>`).join('')}</div>`;
  const tile = (attr, title, sub, on = false) => `<button type="button" class="ar-item${on ? ' is-on' : ''}" ${attr}><b>${esc(title)}</b><small>${esc(sub)}</small></button>`;
  const st = info.stats;
  const s = menus._screen('uebung', 'm-sub', `
    <div class="sub sub-wide">
      <header class="sub-head"><button type="button" class="m-icon" data-act="back" aria-label="Zurück">${ICON.back}</button><div><div class="m-kicker">Schießstand</div><h1 class="m-title">Übungsgelände<em>.</em></h1></div></header>
      <p class="sub-lead">Alle Fahrzeuge und Ziele zum Ausprobieren – allein, ohne Gegner. Teleport-Tafeln draußen bringen dich ebenso zwischen den Bereichen hin und her.</p>
      <div class="sub-body m-scroll" data-scrollable>
        <section><h2 class="m-h2">Teleport</h2><div class="ar-grid">${Object.entries(A).map(([id, a]) => tile(`data-tp="${id}"`, a.name, { stand: 'Bahnen 1–8, Parcours, Waffenkammer', hof: 'Alle Muster zum Einsteigen', strecke: 'Slalom, Rampe, Graben, Furt …', schiessbahn: 'Ziele 200–2500 m, Ziel-Panzer', flugfeld: 'Startbahn 1200 m, Landeplätze', zielgebiet: 'Bodenziele, Ballons, Drohnen' }[id] || '')).join('')}</div></section>
        <section><h2 class="m-h2">Hilfen</h2><div class="ar-grid">
          ${tile('data-do="reset"', 'Fahrzeug zurücksetzen', 'Aufrichten, reparieren, anhalten')}
          ${tile('data-do="refill"', 'Munition auffüllen', 'Waffen und eigenes Fahrzeug')}
          ${tile('data-do="targets"', 'Ziele zurücksetzen', 'Alle Ziele aufstellen, Bilanz leeren')}
          ${tile('data-do="slow"', 'Zeitlupe', info.slow ? 'An (35 %)' : 'Aus', info.slow)}
          ${tile('data-do="god"', 'Unverwundbar', info.god ? 'An (auch dein Fahrzeug)' : 'Aus', info.god)}
        </div></section>
        <section><h2 class="m-h2">Fahrzeug herbeirufen</h2><p class="sub-lead">Erscheint neben dir, du sitzt sofort am Steuer (Jets: auf der Startbahn). Das zuvor gerufene verschwindet.</p>
          ${U.catalog().map(([g, list]) => `<h3 class="m-kicker" style="margin:12px 0 6px">${esc(g)}</h3><div class="ar-grid">${list.map((v) => tile(`data-veh="${esc(v.id)}"`, v.name, v.cls)).join('')}</div>`).join('')}
        </section>
        <section><h2 class="m-h2">Panzer-Übung (Panzermodus)</h2>
          <p class="sub-lead">Im Übungsgelände fährst und schießt du jeden Panzer frei (Sitzwechsel im Fahrzeug). Für Simulation mit Handgriffen, Rolle und KI-Besatzung startet der Modus „Panzer“ auf dieser Karte: eigene Feuerstellung an der Panzerschießbahn, leichte Feindkräfte im Zielraum. Sonst: Lobby → Reiter „Panzer“.</p>
          <div style="display:grid;gap:8px;margin:10px 0">
            ${seg('stil', [['simulation', 'Simulation'], ['arcade', 'Arcade']], pz.stil)}
            ${seg('rolle', ROLES, pz.rolle)}
            <div class="m-seg" role="radiogroup" data-seg="panzer" style="grid-auto-flow:row;grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">${TANKS.map((id) => `<button type="button" role="radio" data-val="${id}" aria-checked="${id === pz.panzer}">${esc(id === 'karte' ? 'Nach Karte' : U.vehName(id))}</button>`).join('')}</div>
          </div>
          <div class="m-actions"><button type="button" class="m-btn m-primary" data-do="panzer">${ICON.tank || ICON.play}<span>Panzer-Übung starten</span></button></div>
        </section>
        <section><h2 class="m-h2">Trefferbilanz</h2><p class="sub-lead">${st.hits} Treffer · ${st.pen} Durchschläge · ${st.rico} Abpraller · weitester ${st.longest ? st.longest.toLocaleString('de-DE') + ' m' : '–'}${st.last ? ' · zuletzt: ' + esc(st.last) : ''}</p></section>
      </div>
    </div>`);
  s.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'back') { menus.sound('back'); menus.showPause(); return; }
    const segEl = b.closest('[data-seg]');
    if (segEl && b.dataset.val) {
      pz[segEl.dataset.seg] = b.dataset.val;
      segEl.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      menus.sound('click');
      return;
    }
    const resume = () => { menus.sound('confirm'); menus._resume(); };
    if (b.dataset.tp) { if (U.teleport(b.dataset.tp)) resume(); return; }
    if (b.dataset.veh) { if (U.summon(b.dataset.veh)) resume(); else menus.sound('back'); return; }
    const d = b.dataset.do;
    if (d === 'reset') { if (U.resetVehicle()) resume(); else menus.sound('back'); }
    else if (d === 'refill') { U.refill(); resume(); }
    else if (d === 'targets') { U.resetTargets(); resume(); }
    else if (d === 'slow') { U.setSlow(!U.slow); menus.sound('confirm'); showUebung(menus); }
    else if (d === 'god') { U.setGod(!U.god); menus.sound('confirm'); showUebung(menus); }
    else if (d === 'panzer') { menus.sound('confirm'); menus.hideAll?.(); U.startPanzer(pz); }
  });
  menus.parent = 'pause';
  menus._focusFirst(s, '.ar-item');
}
