/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// §03 Kampagne: „Stille Grenze“ (Infanterie) und „Eisenwind“ (Panzer) als Reiter. Missionen der Infanterie-Kampagne
// kommen direkt aus game/campaign/outline.js (reine Daten, ohne three.js) – neue Kapitel erscheinen hier von selbst.
// Die Panzer-Missionen stehen in game/campaign/panzer/eisenwind-a/-b.js zusammen mit ihrem Ablauf (three.js); damit die
// Startseite das nicht laden muss, steht hier eine Kurzliste (Quelle: deren Kopfdaten id/title/map/tank/type/minutes).
// „Kampagne öffnen.“ führt in die Lobby, Reiter Kampagne (spielen.html?tab=kampagne bzw. ?tab=eisenwind).
import { h, $, tabs } from './dom.js?v=20261122020853';

/** Eisenwind (Stand 20.11.): [Nummer, Titel, Karte, Panzer-Id, Art, Minuten]. */
const EISENWIND = [
  [1, 'Erster Kontakt', 'grenzland', 'mbt', 'Durchbruch · Pak, Bunker, Panzer, Funkstelle', 15],
  [2, 'Höhe 214', 'flugplatz', 'mbt', 'Verteidigung · drei Angriffswellen', 18],
  [3, 'Geleit nach Ostrau', 'grenzland', 'kk', 'Geleitschutz · nur Optik, kein Wärmebild', 16],
  [4, 'Nachtfalke', 'brandwald', 'mbt', 'Nachtgefecht · Wärmebild · Lager und Brücke', 16],
  [5, 'Die Furt', 'niemandsland', 'wk2', 'Erinnerung · achtzig Jahre früher · nur Optik', 15],
  [6, 'Brücken von Mirenfurt', 'stadtkern', 'mbt', 'Stadtkampf · mit Infanterie', 18],
];
const EISENWIND_INFO = {
  title: 'Eisenwind',
  tagline: 'Eine Besatzung, ein Tal, sechs Einsätze.',
  summary: 'Herbst im Tal der Miren: Korvanische Panzer überschreiten die Grenze. Mit „Falke 2“ und deiner Besatzung brichst du durch Sperrlinien, hältst eine Höhe, geleitest Nachschub, schlägst bei Nacht zu – und erfährst, warum Oberfeldwebel Asmus die Furt von Mirenfurt so gut kennt.',
};
const TANK_FALLBACK = { mbt: 'KP-1 Mammut', kk: 'KP-68 Auerochs', wk2: 'MP-4 Bison' };
const PIC = new Set(['hafen', 'altstadt', 'werk', 'bibliothek', 'range', 'grenzland', 'niemandsland', 'brandwald', 'flugplatz', 'stadtkern']);

const hours = (min) => {
  const hrs = min / 60;
  return hrs >= 1 ? `rund ${hrs.toFixed(1).replace('.', ',').replace(',0', '')} Stunden` : `${min} Minuten`;
};

function mapName(D, id) { return D.P?.MAPS?.[id]?.name || id; }
function tankName(D, id) {
  const opt = (D.M?.MODES?.panzer?.options || []).find((o) => o.id === 'panzer');
  return opt?.labels?.[id] || TANK_FALLBACK[id] || id;
}

function thumb(map) {
  if (!PIC.has(map)) return null;
  return h('img.camp-thumb', { src: `assets/img/maps/${map}-s.webp`, width: 800, height: 300, alt: '', loading: 'lazy', decoding: 'async' });
}

/** Ein Missionseintrag mit Aufklapper (Ziele, Lerninhalte). */
function missionItem({ code, title, type, map, mapLabel, minutes, extra, goals, teaches }) {
  const id = `camp-m-${code.toLowerCase()}`;
  const more = goals?.length || teaches?.length;
  const head = h('div.camp-mhead', {},
    thumb(map),
    h('div.camp-mtxt', {},
      h('p.mono-s', {}, `${code} · ${mapLabel} · ${minutes} Min.${extra ? ` · ${extra}` : ''}`),
      h('h4.camp-mtitle', {}, title),
      h('p.camp-mtype', {}, type)));
  const li = h('li.camp-m', {}, head);
  if (more) {
    const body = h('div.camp-mbody', { id, hidden: true },
      goals?.length ? [h('p.mono-s', {}, 'Ziele'), h('ul.camp-goals', {}, goals.map((g) => h('li', {}, g)))] : null,
      teaches?.length ? h('p.camp-teach', {}, h('strong', {}, 'Du lernst: '), teaches.join(', ')) : null);
    const btn = h('button.txt-btn.camp-more', { type: 'button', 'aria-expanded': 'false', 'aria-controls': id }, 'Ziele zeigen');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Ziele ausblenden' : 'Ziele zeigen';
      body.hidden = !open;
    });
    li.append(btn, body);
  }
  return li;
}

export async function init(sec, D, ctx = {}) {
  const root = $('#camp-root', sec);
  const cta = $('#camp-cta', sec);
  if (!root) return;
  let O = null;
  try { O = await import('../game/campaign/outline.js?v=20261122020853'); } catch { O = null; }

  const list = h('div.tabs.camp-tabs');
  const tabSg = h('button.tab', { type: 'button', role: 'tab', id: 'camp-tab-sg', 'aria-controls': 'camp-panel-sg', 'aria-selected': 'true' }, 'Stille Grenze');
  const tabPz = h('button.tab', { type: 'button', role: 'tab', id: 'camp-tab-pz', 'aria-controls': 'camp-panel-pz', 'aria-selected': 'false', tabindex: '-1' }, 'Eisenwind');
  list.append(tabSg, tabPz);
  const panelSg = h('div.tabpanel.camp-panel', { id: 'camp-panel-sg', role: 'tabpanel', 'aria-labelledby': 'camp-tab-sg' });
  const panelPz = h('div.tabpanel.camp-panel', { id: 'camp-panel-pz', role: 'tabpanel', 'aria-labelledby': 'camp-tab-pz', hidden: true });

  /* ---------------------------------------------------------------- Stille Grenze */
  if (O && Array.isArray(O.OUTLINE)) {
    const playable = O.OUTLINE.filter((m) => m.status === 'spielbar');
    const mins = playable.reduce((s, m) => s + (m.minutes || 0), 0);
    for (const el of document.querySelectorAll('[data-count="sg-missions"]')) el.textContent = String(playable.length);
    panelSg.append(
      h('p.camp-lead', {}, O.CAMPAIGN?.tagline || ''),
      h('p.camp-sum', {}, O.CAMPAIGN?.summary || ''),
      h('p.mono-s.camp-facts', {}, `${playable.length} Missionen · ${(O.ACTS || []).length} Akte · ${hours(mins)} · Infanterie mit Trupp, Fahrzeugen und Hubschrauber`));
    for (const act of O.ACTS || []) {
      const ms = playable.filter((m) => m.act === act.n);
      if (!ms.length) continue;
      panelSg.append(h('section.camp-act', { 'aria-label': act.title },
        h('h4.camp-act-h', {}, act.title),
        h('p.camp-act-sum', {}, act.summary),
        h('ol.camp-list', {}, ms.map((m) => missionItem({
          code: `M${m.n}`, title: m.title, type: m.type, map: m.map, mapLabel: mapName(D, m.map), minutes: m.minutes,
          extra: m.tutorial ? 'Einstieg' : '', goals: m.goals, teaches: m.teaches,
        })))));
    }
    if (O.TO_BE_CONTINUED) panelSg.append(h('p.camp-tbc', {}, h('strong', {}, `${O.TO_BE_CONTINUED.title}. `), O.TO_BE_CONTINUED.text));
  } else {
    panelSg.append(h('p.camp-sum', {}, 'Im Grenztal von Sant Aurel hält die Waffenruhe seit drei Wochen. Dann verstummt das Funkrelais. Drei Akte, 16 Missionen.'));
  }

  /* ---------------------------------------------------------------- Eisenwind */
  const pzMin = EISENWIND.reduce((s, m) => s + m[5], 0);
  panelPz.append(
    h('p.camp-lead', {}, EISENWIND_INFO.tagline),
    h('p.camp-sum', {}, EISENWIND_INFO.summary),
    h('p.mono-s.camp-facts', {}, `${EISENWIND.length} Einsätze · ${hours(pzMin)} · Rolle frei wählbar, Simulation oder Arcade`),
    h('ol.camp-list', {}, EISENWIND.map(([n, title, map, tank, type, min]) => missionItem({
      code: `P${n}`, title, type, map, mapLabel: mapName(D, map), minutes: min, extra: tankName(D, tank),
    }))));

  root.replaceChildren(list, panelSg, panelPz);
  const setCta = (pz) => { if (cta) { cta.setAttribute('href', pz ? 'spielen.html?tab=eisenwind' : 'spielen.html?tab=kampagne'); cta.firstChild.nodeValue = pz ? 'Eisenwind öffnen' : 'Stille Grenze öffnen'; } };
  const tb = tabs(list, {
    label: 'Kampagnen',
    onSelect: (tab, user) => { setCta(tab === tabPz); if (user) ctx.sound?.ui('click'); },
  });
  setCta(false);
  window.addEventListener('np:campaign', (e) => tb.select(e.detail === 'eisenwind' ? tabPz : tabSg));
}
