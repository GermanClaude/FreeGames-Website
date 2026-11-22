/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// Spielmenü (21.11.): Mehrspieler – Raumcode eingeben und beitreten (spielen.html?raum=CODE, wie ein Einladungslink).
// Ohne JavaScript schickt das Formular denselben Code per GET. Hier: Eingabe normalisieren (wie net/signal.js normCode:
// Großbuchstaben, ohne I/O/0/1, höchstens 6 Zeichen) und mit Übergangs-Ladeschirm starten.
import { $ } from './dom.js?v=20261122020853';
import { warpTo } from './menu.js?v=20261122020853';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const norm = (s) => [...String(s || '').toUpperCase()].filter((c) => ALPHA.includes(c)).join('').slice(0, 6);

export function init(sec, D, ctx = {}) {
  const form = $('.mp-join', sec);
  const input = $('#mp-code', sec);
  if (!form || !input) return;
  input.addEventListener('input', () => {
    const v = norm(input.value);
    if (v !== input.value) input.value = v;
    input.setCustomValidity('');
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = norm(input.value);
    input.value = v;
    if (v.length !== 6) {
      input.setCustomValidity('Der Raumcode hat sechs Zeichen.');
      input.reportValidity();
      return;
    }
    ctx.sound?.ui('confirm');
    warpTo(`spielen.html?raum=${encodeURIComponent(v)}`);
  });
}
