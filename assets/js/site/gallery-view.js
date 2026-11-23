/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// Spielmenü (21.11.): Galerie. Alle Bilder (assets/img/neu, Kartenbilder, Vorher/Nachher) stehen statisch im HTML als
// Raster mit Links auf die große Fassung (ohne JavaScript öffnet der Link das Bild). Hier: Filter nach Thema,
// Vollbild-Betrachter (<dialog id="lightbox">) mit Pfeiltasten, Wischen, Controller (LB/RB bzw. Steuerkreuz) und
// der Vorher/Nachher-Regler (aus news-view.js).
import { $, $$ } from './dom.js?v=20261123082814';
import { announce } from './live.js?v=20261123082814';
import { t } from './lang.js?v=20261123082814';
import { initCompare } from './news-view.js?v=20261123082814';

function initFilter(sec) {
  const bar = $('#gal-filter', sec);
  const items = $$('#gal-list > li', sec);
  const count = $('#gal-count', sec);
  if (!bar || !items.length) return;
  bar.hidden = false;
  const chips = $$('[data-f]', bar);
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    const f = b.dataset.f;
    for (const c of chips) c.setAttribute('aria-pressed', String(c === b));
    let n = 0;
    for (const li of items) {
      const on = f === 'alle' || (li.dataset.tags || '').split(/\s+/).includes(f);
      li.hidden = !on;
      if (on) n++;
    }
    const txt = t('gal.count', { n });
    if (count) count.textContent = txt;
    announce(txt);
  });
}

function initLightbox(sec, snd) {
  const dlg = document.getElementById('lightbox');
  const list = $('#gal-list', sec);
  if (!dlg || !list || typeof dlg.showModal !== 'function') return;
  const img = $('#lb-img', dlg);
  const cap = $('#lb-cap', dlg);
  const cnt = $('#lb-count', dlg);
  let items = [];
  let i = 0;
  let opener = null;
  const show = (k) => {
    if (!items.length) return;
    i = (k + items.length) % items.length;
    const a = items[i];
    const thumb = $('img', a);
    img.removeAttribute('src');
    img.width = Number(a.dataset.w) || 1280;
    img.height = Number(a.dataset.h) || 720;
    img.alt = thumb?.alt || '';
    img.src = a.getAttribute('href');
    img.style.animation = 'none';
    void img.offsetWidth;
    img.style.animation = '';
    cap.textContent = `${$('.gal-cap', a)?.textContent || ''}${thumb?.alt ? ` – ${thumb.alt}` : ''}`;
    cnt.textContent = t('gal.of', { i: i + 1, n: items.length });
    // Nachbarn vorladen
    for (const d of [1, -1]) { const n = items[(i + d + items.length) % items.length]; if (n) { const p = new Image(); p.src = n.getAttribute('href'); } }
  };
  list.addEventListener('click', (e) => {
    const a = e.target.closest('a.gal-it');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    items = $$('#gal-list > li:not([hidden]) a.gal-it', sec);
    opener = a;
    show(items.indexOf(a));
    dlg.showModal();
    snd?.ui('confirm');
    $('.lb-close', dlg)?.focus();
  });
  dlg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lb]');
    if (b) {
      const act = b.dataset.lb;
      if (act === 'close') dlg.close();
      else { show(i + (act === 'next' ? 1 : -1)); snd?.ui('hover'); }
      return;
    }
    if (e.target === dlg) dlg.close();
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(i + (e.key === 'ArrowRight' ? 1 : -1)); snd?.ui('hover'); }
  });
  dlg.addEventListener('np:nav', (e) => { show(i + (e.detail > 0 ? 1 : -1)); snd?.ui('hover'); });
  // Wischen
  let x0 = null;
  dlg.addEventListener('touchstart', (e) => { x0 = e.touches[0]?.clientX ?? null; }, { passive: true });
  dlg.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? x0) - x0;
    x0 = null;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
  }, { passive: true });
  dlg.addEventListener('close', () => { snd?.ui('back'); try { opener?.focus({ preventScroll: true }); } catch { /* */ } });
}

export function init(sec, D, ctx = {}) {
  initFilter(sec);
  initLightbox(sec, ctx.sound);
  initCompare(sec);
}
