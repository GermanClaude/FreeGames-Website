/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// §02 Neu: Neuheiten als Karten (statisch im HTML, hier nur Filter), Sprünge in Kampagne/Steuerung mit Vorauswahl und
// der Vorher-Nachher-Regler (Bildpaare aus assets/img/neu, gleiche Kamera). Ohne JavaScript stehen alle Karten da und der
// Regler zeigt die Hälfte von beiden Bildern.
import { $, $$ } from './dom.js?v=20261123073102';
import { announce } from './live.js?v=20261123073102';

/** Vergleichspaare: Bildname (assets/img/neu/vgl-<id>-vorher|nachher), Beschriftung, Alternativtexte. */
const VGL = {
  wald: {
    cap: 'Waldrand im Grenzland, Grafikstufe Hoch: vor und nach der Überarbeitung der Bäume (14. November).',
    a: 'Vorher: Waldrand im Grenzland mit lichten, flachen Bäumen.',
    b: 'Nachher: derselbe Waldrand mit dichteren Bäumen und Sträuchern.',
  },
  hafen: {
    cap: 'Hafenkai, Grafikstufe Hoch: vor und nach der Runde für Gelände und Kleinkram (14. und 15. November).',
    a: 'Vorher: Hafenkai mit wenigen Paletten.',
    b: 'Nachher: derselbe Kai mit gestapelter Ladung, Paletten und Kleinkram.',
  },
  auto: {
    cap: 'Ziviler Pkw aus drei Richtungen: kastige Karosserie vorher (15. November), geformte Karosserie nachher (19. November).',
    a: 'Vorher: roter Pkw mit kantiger Kastenform.',
    b: 'Nachher: derselbe Pkw mit gerundeter, geformter Karosserie.',
  },
};

function setImg(img, base) {
  img.src = `assets/img/neu/${base}-s.webp`;
  img.srcset = `assets/img/neu/${base}-s.webp 640w, assets/img/neu/${base}.webp 1280w`;
}

function initFilter(sec) {
  const bar = $('#news-filter', sec);
  const cards = $$('.news-card', sec);
  const count = $('#news-count', sec);
  if (!bar || !cards.length) return;
  bar.hidden = false;
  const chips = $$('[data-f]', bar);
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    const f = b.dataset.f;
    for (const c of chips) c.setAttribute('aria-pressed', String(c === b));
    let n = 0;
    for (const card of cards) {
      const on = f === 'alle' || (card.dataset.tags || '').split(/\s+/).includes(f);
      card.hidden = !on;
      if (on) n++;
    }
    const txt = `${n} ${n === 1 ? 'Neuheit' : 'Neuheiten'}${f === 'alle' ? '' : ` in „${b.textContent}“`}.`;
    if (count) count.textContent = txt;
    announce(txt);
  });
}

/** Bilder, die (noch) fehlen, nehmen ihre Abbildung mit – die Karte bleibt als Text stehen. */
function guardImages(sec) {
  for (const img of $$('.news-pic img', sec)) {
    const drop = () => { const fig = img.closest('figure'); const card = img.closest('.news-card'); fig?.remove(); card?.classList.add('is-text'); };
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) drop();
    else img.addEventListener('error', drop, { once: true });
  }
}

/** Links mit data-camp / data-ctl: Ziel-Abschnitt aufbauen und den passenden Reiter wählen. */
function initJumps(sec, ctx) {
  sec.addEventListener('click', async (e) => {
    const a = e.target.closest('a[data-camp], a[data-ctl]');
    if (!a) return;
    if (a.dataset.camp) { await ctx.ensure?.('campaign'); window.dispatchEvent(new CustomEvent('np:campaign', { detail: a.dataset.camp })); }
    if (a.dataset.ctl) { await ctx.ensure?.('controls'); window.dispatchEvent(new CustomEvent('np:controls', { detail: a.dataset.ctl })); }
  });
}

export function initCompare(sec) {
  const stage = $('#vgl-stage', sec);
  const pick = $('#vgl-pick', sec);
  if (!stage) return;
  const range = $('.vgl-range', stage);
  const imgA = $('.vgl-a', stage);
  const imgB = $('.vgl-b', stage);
  const cap = $('#vgl-cap', sec);
  stage.classList.add('is-live');
  const set = (v) => {
    const p = Math.max(0, Math.min(100, Number(v) || 0));
    stage.style.setProperty('--p', `${p}%`);
    range?.setAttribute('aria-valuetext', p <= 2 ? 'nur nachher' : p >= 98 ? 'nur vorher' : `${Math.round(p)} Prozent vorher, ${Math.round(100 - p)} Prozent nachher`);
  };
  if (range) {
    range.addEventListener('input', () => set(range.value));
    set(range.value);
  }
  if (!pick) return;
  pick.hidden = false;
  const chips = $$('[data-v]', pick);
  pick.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b || !VGL[b.dataset.v]) return;
    const id = b.dataset.v;
    const d = VGL[id];
    for (const c of chips) c.setAttribute('aria-pressed', String(c === b));
    setImg(imgA, `vgl-${id}-vorher`); imgA.alt = d.a;
    setImg(imgB, `vgl-${id}-nachher`); imgB.alt = d.b;
    stage.classList.toggle('is-strip', id === 'auto'); // Auto: Streifen aus drei Ansichten (3:1)
    if (cap) cap.textContent = d.cap;
    if (range) { range.value = '50'; set(50); }
    announce(d.cap);
  });
}

export function init(sec, D, ctx = {}) {
  guardImages(sec);
  initFilter(sec);
  initJumps(sec, ctx);
  initCompare(sec);
}
