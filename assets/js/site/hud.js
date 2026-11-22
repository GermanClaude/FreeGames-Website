/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// Startbildschirm (21.11.): Körperkamera-Einblendung (Uhr, REC) und Hauptmenü wie im Spiel.
// - Uhr läuft nur, solange der Startbildschirm sichtbar ist; außerhalb pausieren auch die CSS-Bewegungen (.hero.off).
// - Hauptmenü: Pfeiltasten ↑/↓ (und Pos1/Ende) wandern durch die Einträge, Enter folgt dem Link (Standardverhalten).
// - Controller und räumliche Tastaturbedienung: menu.js (Spielmenü, 21.11.).
// - Klänge nur über sound.ui (spielt erst nach ausdrücklichem Einschalten „Ton: an“).

const pad2 = (n) => String(n).padStart(2, '0');

export function initHud({ sound } = {}) {
  const hero = document.getElementById('nullpunkt');
  const clock = document.getElementById('cam-clock');
  const menu = document.getElementById('hero-menu');
  if (!hero) return;
  let visible = true;
  let timer = 0;

  const tick = () => {
    if (!clock) return;
    const d = new Date();
    clock.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  };
  const startClock = () => { if (!timer) { tick(); timer = setInterval(tick, 1000); } };
  const stopClock = () => { clearInterval(timer); timer = 0; };

  /* Hauptmenü: Tastatur- und Controller-Bedienung übernimmt seit dem Spielmenü (21.11.) menu.js – räumlich für alle
     Bildschirme. Ohne Spielmenü (kein html.shell) bleibt die einfache Pfeiltasten-Bedienung der Liste. */
  const items = menu ? [...menu.querySelectorAll('a')] : [];
  if (!document.documentElement.classList.contains('shell')) {
    const idx = () => items.indexOf(document.activeElement);
    const focusAt = (i) => {
      const n = items.length;
      if (!n) return;
      items[((i % n) + n) % n].focus({ preventScroll: true });
      sound?.ui('hover');
    };
    menu?.addEventListener('keydown', (e) => {
      const i = idx();
      if (i < 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(i + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(i - 1); }
    });
  }
  for (const a of items) if (!a.matches('.cta-fill') && !a.dataset.cat) a.addEventListener('click', () => sound?.ui('click'));

  /* Sichtbarkeit */
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    hero.classList.toggle('off', !visible);
    if (visible && !document.hidden) startClock(); else stopClock();
  });
  io.observe(hero);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopClock(); else if (visible) startClock(); });
  startClock();
}
