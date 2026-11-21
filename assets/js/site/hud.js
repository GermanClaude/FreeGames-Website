/* NULLPUNKT – © 2026 German Legend. Alle Rechte vorbehalten. Siehe LICENSE. */
// Startbildschirm (21.11.): Körperkamera-Einblendung (Uhr, REC) und Hauptmenü wie im Spiel.
// - Uhr läuft nur, solange der Startbildschirm sichtbar ist; außerhalb pausieren auch die CSS-Bewegungen (.hero.off).
// - Hauptmenü: Pfeiltasten ↑/↓ (und Pos1/Ende) wandern durch die Einträge, Enter folgt dem Link (Standardverhalten).
// - Controller: Steuerkreuz/linker Stick hoch/runter, A bestätigt – nur solange der Startbildschirm im Bild ist und
//   ein Controller verbunden ist (keine Dauerschleife ohne Controller).
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

  /* Hauptmenü */
  const items = menu ? [...menu.querySelectorAll('a')] : [];
  const idx = () => items.indexOf(document.activeElement);
  const focusAt = (i) => {
    const n = items.length;
    if (!n) return;
    const el = items[((i % n) + n) % n];
    el.focus({ preventScroll: true });
    sound?.ui('hover');
  };
  menu?.addEventListener('keydown', (e) => {
    const i = idx();
    if (i < 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(items.length - 1); }
  });
  for (const a of items) a.addEventListener('pointerenter', () => sound?.ui('hover'));
  for (const a of items) if (!a.matches('.cta-fill')) a.addEventListener('click', () => sound?.ui('click'));

  /* Controller */
  let padLoop = 0;
  let last = { up: false, down: false, a: false };
  const padTick = () => {
    padLoop = 0;
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    if (!pads.length || !visible) return;
    const p = pads[0];
    const ax = p.axes?.[1] || 0;
    const now = {
      up: !!p.buttons?.[12]?.pressed || ax < -0.6,
      down: !!p.buttons?.[13]?.pressed || ax > 0.6,
      a: !!p.buttons?.[0]?.pressed,
    };
    const i = idx();
    if (now.down && !last.down) focusAt(i < 0 ? 0 : i + 1);
    if (now.up && !last.up) focusAt(i < 0 ? 0 : i - 1);
    if (now.a && !last.a && i >= 0) items[i].click();
    last = now;
    padLoop = requestAnimationFrame(padTick);
  };
  const startPad = () => { if (!padLoop && visible && navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) padLoop = requestAnimationFrame(padTick); };
  window.addEventListener('gamepadconnected', startPad);

  /* Sichtbarkeit */
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    hero.classList.toggle('off', !visible);
    if (visible && !document.hidden) { startClock(); startPad(); } else stopClock();
  });
  io.observe(hero);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopClock(); else if (visible) startClock(); });
  startClock();
}
