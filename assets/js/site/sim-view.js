/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// §04 Simulation: Spielstile Arcade / Realistisch / Ultra-Realismus / Simulation im Vergleich – die Werte kommen direkt aus
// shared/classes.data.js (GAME_STYLES), ändern sich dort also mit. Ein Stil lässt sich als Vorgabe setzen (Einstellung
// gameStyle, gilt in der Lobby). Darunter die vier Plätze im Panzer als Reiter (statisch im HTML, hier nur Reiter).
import { h, $, $$, tabs } from './dom.js?v=20261122020853';
import { announce } from './live.js?v=20261122020853';

const yes = (v) => (v ? 'ja' : 'nein');
const num = (v) => String(v).replace('.', ',');
const HUD = { voll: 'volles HUD', reduziert: 'reduziert', aus: 'kein HUD' };
const XH = { an: 'immer', einstellung: 'nach Einstellung', aus: 'nie' };
const PLATES = { alle: 'Freund und Feind', team: 'nur eigenes Team', aus: 'keine' };
const HITS = { immer: 'immer, auch durch Wände', sicht: 'nur bei Sicht', aus: 'keine' };

/** Zeilen: [Bezeichnung, (stil) → Text]. */
const ROWS = [
  ['Anzeige', (s) => HUD[s.hudMin] || s.hudMin],
  ['Fadenkreuz', (s) => XH[s.crosshair] || s.crosshair],
  ['Namensschilder', (s) => PLATES[s.nameplates] || s.nameplates],
  ['Gegner auf der Minikarte', (s) => yes(s.minimapEnemies)],
  ['Trefferanzeige', (s) => HITS[s.hitmarkers] || s.hitmarkers],
  ['Schaden durch Kugeln', (s) => `×${num(s.bulletMult)}`],
  ['Heilung setzt ein nach', (s) => (s.regenDelay >= 1e6 ? 'nie – nur Verband' : `${num(s.regenDelay)} s`)],
  ['Kopftreffer sofort tödlich', (s) => yes(!!s.headKill)],
  ['Teambeschuss', (s) => yes(!!s.friendlyFire)],
  ['Trägheit, Waffengewicht, Atem im Anschlag', (s) => yes(!!s.ultra)],
  ['Ausdauer', (s) => (s.staminaMult > 1 ? 'knapper' : 'normal')],
  ['Magazine einzeln, Durchladen, Ladehemmung', (s) => yes(s.id === 'simulation')],
  ['Verwundung je Körperteil, Bewusstlosigkeit', (s) => yes(s.id === 'simulation')],
];

function styleTable(sec, D, C, ctx) {
  const root = $('#sim-root', sec);
  if (!root || !C?.GAME_STYLES) return;
  const order = (C.STYLE_ORDER || Object.keys(C.GAME_STYLES)).filter((id) => C.GAME_STYLES[id]);
  const S = D.settings;
  const current = () => (order.includes(S.get('gameStyle')) ? S.get('gameStyle') : order[0]);
  let sel = current();

  const pick = h('div.sim-pick', { role: 'group', 'aria-label': 'Spielstil' });
  const btns = order.map((id) => {
    const b = h('button.chip', { type: 'button', 'aria-pressed': 'false', 'data-s': id }, C.GAME_STYLES[id].label);
    pick.append(b);
    return b;
  });
  const head = h('tr', {}, h('th', { scope: 'col' }, h('span.sr-only', {}, 'Merkmal')), order.map((id) => h('th', { scope: 'col', 'data-s': id }, C.GAME_STYLES[id].label)));
  const body = h('tbody', {}, ROWS.map(([label, fn]) => h('tr', {}, h('th', { scope: 'row' }, label), order.map((id) => h('td', { 'data-s': id }, fn(C.GAME_STYLES[id]))))));
  const table = h('table.sim-table', {}, h('caption.sr-only', {}, 'Spielstile im Vergleich'), h('thead', {}, head), body);
  const desc = h('p.sim-desc', { 'aria-live': 'polite' });
  const simModes = (C.SIM_MODES || []).map((id) => D.M?.MODES?.[id]?.name).filter(Boolean);
  const note = simModes.length ? h('p.sim-note', {}, `Simulation gibt es in: ${simModes.join(', ')}. In den übrigen Modi spielt sie sich wie „Realistisch“.`) : null;
  // Ultra-Realismus (wie Bodycam): eigene Modusliste
  const ultraModes = (C.ULTRA_MODES || []).map((id) => D.M?.MODES?.[id]?.name).filter(Boolean);
  const unote = ultraModes.length ? h('p.sim-note', {}, `Ultra-Realismus gibt es in: ${ultraModes.join(', ')}. In den übrigen Modi spielt er sich wie „Realistisch“.`) : null;
  const setBtn = h('button.txt-btn.sim-set', { type: 'button' });
  const state = h('span.mono-s.sim-state');

  const paint = () => {
    for (const b of btns) b.setAttribute('aria-pressed', String(b.dataset.s === sel));
    root.dataset.sel = sel;
    for (const el of $$('[data-s]', table)) el.classList.toggle('on', el.dataset.s === sel);
    desc.textContent = C.GAME_STYLES[sel].desc || '';
    const isCur = current() === sel;
    setBtn.textContent = isCur ? 'Ist deine Vorgabe' : `„${C.GAME_STYLES[sel].label}“ als Vorgabe nehmen`;
    setBtn.disabled = isCur;
    state.textContent = `Deine Vorgabe: ${C.GAME_STYLES[current()].label}`;
  };
  pick.addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    sel = b.dataset.s;
    paint();
    ctx.sound?.ui('click');
  });
  setBtn.addEventListener('click', () => {
    try { S.set('gameStyle', sel); } catch { /* egal */ }
    paint();
    announce(`Spielstil ${C.GAME_STYLES[sel].label} ist jetzt deine Vorgabe.`, { now: true });
  });
  S.onChange?.((k) => { if (k === 'gameStyle') paint(); });
  root.replaceChildren(pick, h('div.sim-scroll', {}, table), desc, note, unote, h('p.sim-acts', {}, setBtn, state));
  paint();
}

function crewTabs(sec, ctx) {
  const box = $('#crew-roles', sec);
  if (!box) return;
  const roles = $$('.crew-role', box);
  if (!roles.length) return;
  const list = h('div.tabs.crew-tabs');
  for (const r of roles) {
    const name = r.querySelector('h4')?.textContent || r.id;
    list.append(h('button.tab', { type: 'button', role: 'tab', id: `${r.id}-tab`, 'aria-controls': r.id, 'aria-selected': 'false', tabindex: '-1' }, name));
    r.setAttribute('role', 'tabpanel');
    r.setAttribute('aria-labelledby', `${r.id}-tab`);
    r.querySelector('h4')?.classList.add('sr-only');
  }
  box.before(list);
  box.classList.add('is-tabs');
  const tb = tabs(list, { label: 'Plätze im Panzer', onSelect: (t, user) => { if (user) ctx.sound?.ui('click'); } });
  tb.select(tb.items[1] || tb.items[0]); // Richtschütze zuerst: dort passiert am meisten
}

export async function init(sec, D, ctx = {}) {
  let C = null;
  try { C = await import('../shared/classes.data.js?v=20261122020853'); } catch { C = null; }
  styleTable(sec, D, C, ctx);
  crewTabs(sec, ctx);
}
