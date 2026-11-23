/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// Spielmenü (21.11.): Schnellwahl oben in „Einstellungen“ – Sprache (über lang.js an die Übersetzungs-API), Menüklänge,
// Grafik-Voreinstellung und Bewegung. Grafik und Bewegung sind dieselben Einstellungen wie im Spiel (shared/settings.js);
// die vollständige Liste steht darunter im Abschnitt „Alle Einstellungen“.
import { $, h } from './dom.js?v=20261123115551';
import { announce } from './live.js?v=20261123115551';
import { t, LANGS, getLang, setLang, onLang, hasTranslations } from './lang.js?v=20261123115551';

function seg(label, opts, cur, onPick, { lang = false } = {}) {
  const id = `q-${Math.random().toString(36).slice(2, 8)}`;
  const box = h('div.seg', { role: 'group', 'aria-labelledby': id, ...(lang ? { 'data-noi18n': '' } : {}) });
  const btns = opts.map(([v, txt]) => {
    const b = h('button', { type: 'button', 'data-v': v, 'aria-pressed': String(v === cur), ...(lang ? { lang: v === 'zh' ? 'zh-Hans' : v } : {}) }, txt);
    b.addEventListener('click', () => onPick(v, b));
    return b;
  });
  box.append(...btns);
  const set = (v) => { for (const b of btns) b.setAttribute('aria-pressed', String(b.dataset.v === v)); };
  const row = h('div.q-row', {}, h('span.q-lab', { id }, label), box);
  return { row, set, box };
}

export function init(sec, D, ctx = {}) {
  const root = $('#quick-root', sec);
  if (!root) return;
  const S = D.settings;
  const snd = ctx.sound;

  // Sprache
  const note = h('p.q-note', { hidden: true }, t('quick.lang.note'));
  const langRow = seg(t('quick.lang'), LANGS, getLang(), async (v) => {
    await setLang(v);
    langRow.set(v);
    note.hidden = hasTranslations() || v === 'de';
    snd?.ui('click');
    announce(LANGS.find(([c]) => c === v)?.[1] || v);
  }, { lang: true });
  note.hidden = hasTranslations() || getLang() === 'de';
  langRow.row.append(note);
  onLang((v) => langRow.set(v));

  // Menüklänge (gleicher Schalter wie „Ton“ in der Statuszeile)
  const tog = document.getElementById('sound-toggle');
  const soundRow = seg(t('quick.sound'), [['an', t('quick.on')], ['aus', t('quick.off')]], snd?.enabled ? 'an' : 'aus', (v) => {
    if ((v === 'an') !== !!snd?.enabled) tog?.click();
    soundRow.set(snd?.enabled ? 'an' : 'aus');
  });
  tog?.addEventListener('click', () => setTimeout(() => soundRow.set(snd?.enabled ? 'an' : 'aus'), 0));

  root.replaceChildren(langRow.row, soundRow.row);

  // Grafik-Voreinstellung
  const q = D.schema?.quality;
  if (S && q?.options) {
    const opts = q.options.filter((o) => !q.locked?.includes(o)).map((o) => [o, q.labels?.[o] || o]); // app-engine: „Extrem“ nur in der App
    const gfx = seg(t('quick.gfx'), opts, S.get('quality'), (v) => { S.set('quality', v); gfx.set(S.get('quality')); snd?.ui('click'); announce(q.labels?.[v] || v); });
    root.append(gfx.row);
    S.onChange((k, v) => { if (k === 'quality') gfx.set(v); });
  }
  // Bewegung
  if (S) {
    const mot = seg(t('quick.motion'), [['voll', t('quick.motion.full')], ['reduziert', t('quick.motion.less')]], S.get('reducedMotion') ? 'reduziert' : 'voll', (v) => {
      S.set('reducedMotion', v === 'reduziert'); snd?.ui('click');
    });
    root.append(mot.row);
    S.onChange((k, v) => { if (k === 'reducedMotion') mot.set(v ? 'reduziert' : 'voll'); });
  }
  // Profil
  const name = () => (S?.get('playerName') || 'Operator');
  const who = h('span', {}, name());
  root.append(h('div.q-row', {}, h('span.q-lab', {}, t('quick.profile')),
    h('p', {}, who, ' · ', h('a', { href: '#profil' }, t('quick.profile.go')))));
  S?.onChange((k) => { if (k === 'playerName') who.textContent = name(); });
}
