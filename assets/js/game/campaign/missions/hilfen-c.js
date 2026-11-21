// NULLPUNKT — Kampagne, gemeinsame Bausteine für Akt III „Phase zwei“ (M12–M15, Strang kamp3). Arbeiten mit der
// vorhandenen Regie (director.js), ohne sie zu ändern:
//   night(m, o)                 – Nachteinsatz: Nachtbild (Abdunklung über dem Spielbild, HUD bleibt hell), Bots sehen
//                                 schlechter (world.nightVis → bots/ai/perception.js) und Nachtsichtgerät (Taste der
//                                 Aktion „Lampe“, Standard T / Gamepad Steuerkreuz ↓ bzw. Touch-Knopf „NSG“).
//                                 → { nvg (an?), set(on), off() } – endet mit der Mission
//   scopeMark(m, id, text, list, o) – Ziele im Visier markieren: anvisieren (Zielfernrohr) und kurz halten → markiert
//   tail(m, id, text, getPos, o) – Ziel in Reichweite halten (Fortschrittsbalken), z. B. Überflüge/Verfolgung
//   walker(m, id, def)          – Zivilist/Verdächtiger, der eine Runde läuft (Extra; geschützt → Treffer = Fehlschlag)
//   buildCount(m) / digCount(m) – fertige Bauwerke (Taste K) bzw. Spatenhiebe in den Boden seit Aufruf
//   giveMelee(m, id)            – Nahkampfwaffe setzen (z. B. Klappspaten zum Graben)
//   pilot(m, v, team)           – Bot ohne KI auf den Pilotensitz (für den Autopiloten air.fly)
//   circuit(m, v, pts, o)       – Luftfahrzeug fliegt eine Runde durch Wegpunkte (Autopilot), immer wieder

import * as THREE from 'three';
import { tx } from '../../../shared/i18n.js?v=20261121041936';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _f = new THREE.Vector3();

/* ======================================================================== Nacht und Nachtsicht */

const CSS = `
#kc-night { position: absolute; inset: 0; pointer-events: none; z-index: 0; transition: background .5s ease; }
#kc-night.on { background: radial-gradient(ellipse 62% 70% at 50% 50%, rgba(0,0,0,0) 58%, rgba(0,0,0,.55) 78%, #000 100%); }
#kc-night.on::after { content: ''; position: absolute; inset: 0; opacity: .22;
  background: repeating-linear-gradient(0deg, rgba(160,255,170,.10) 0 1px, rgba(0,0,0,0) 1px 3px); animation: kc-nvg-roll 0.7s steps(4) infinite; }
body[data-quality="low"] #kc-night.on::after { animation: none; }
#kc-night .kc-nvg-tag { position: absolute; left: 50%; top: 9%; transform: translateX(-50%); font: 600 12px/1 system-ui, sans-serif;
  letter-spacing: .3em; color: rgba(190,255,190,.75); display: none; }
#kc-night.on .kc-nvg-tag { display: block; }
@keyframes kc-nvg-roll { from { background-position: 0 0; } to { background-position: 0 3px; } }
#kc-nvg-btn { position: fixed; right: 14px; top: 38%; min-width: 54px; min-height: 44px; border-radius: 10px; z-index: 40;
  background: rgba(10,14,10,.6); color: #bfe9bf; border: 1px solid rgba(191,233,191,.45); font: 600 13px system-ui, sans-serif; }
body[data-cutscene="1"] #kc-nvg-btn { display: none; }
`;

// Nachtbild: dunkel, entsättigt, leicht ins Blaue (Sepia + Farbdrehung ≈ Mondlicht)
const FILTER_DARK = (k) => `brightness(${k}) saturate(.5) sepia(.32) hue-rotate(185deg) contrast(1.08)`;
// Restlichtverstärker: Graustufen → grünes Phosphorbild, hell, etwas Kontrast
const FILTER_NVG = 'grayscale(1) brightness(1.7) contrast(1.22) sepia(1) hue-rotate(58deg) saturate(2.6)';

/**
 * Nachteinsatz. o = { dark: Helligkeit ohne Nachtsicht (0,2–0,6), vis: Entdeckungsfaktor der Bots (0–1), nvg: Nachtsicht
 * verfügbar, start: Nachtsicht zu Beginn an }.
 */
export function night(m, { dark = 0.34, vis = 0.45, nvg = true, start = false } = {}) {
  const G = m.G;
  if (m._kcNight) return m._kcNight;
  const canvas = typeof document !== 'undefined' ? document.getElementById('game-canvas') : null;
  const st = { nvg: false, on: true, presses: 0 };
  if (typeof document !== 'undefined' && !document.getElementById('kc-night-style')) {
    const s = document.createElement('style');
    s.id = 'kc-night-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  let layer = null, btn = null;
  if (canvas && canvas.parentNode) {
    layer = document.createElement('div');
    layer.id = 'kc-night';
    layer.innerHTML = '<span class="kc-nvg-tag">NSG · RESTLICHT</span>';
    canvas.parentNode.insertBefore(layer, canvas.nextSibling);
  }
  const touch = G.input && G.input.mode === 'touch';
  if (nvg && touch && typeof document !== 'undefined') {
    btn = document.createElement('button');
    btn.id = 'kc-nvg-btn';
    btn.type = 'button';
    btn.textContent = 'NSG';
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); st.set(!st.nvg); });
    document.body.appendChild(btn);
  }
  const apply = () => {
    const cine = !!m.cutscene;
    const on = st.on && !m.finished;
    const nv = on && st.nvg && !cine;
    // Sequenzen etwas heller (Gesichter sollen lesbar bleiben), sonst das Nachtbild bzw. die Nachtsicht
    if (canvas) canvas.style.filter = !on ? '' : nv ? FILTER_NVG : FILTER_DARK(cine ? Math.max(dark, 0.55) : dark);
    if (layer) layer.classList.toggle('on', nv);
    if (G.world) G.world.nightVis = on ? vis : 1;
  };
  st.set = (v) => {
    if (!nvg) return;
    const was = st.nvg;
    st.nvg = !!v;
    if (st.nvg !== was) { st.presses += 1; try { G.audio && G.audio.ui && G.audio.ui('click'); } catch { /* */ } }
    apply();
  };
  st.off = () => {
    st.on = false;
    st.nvg = false;
    if (canvas) canvas.style.filter = '';
    if (layer) { layer.remove(); layer = null; }
    if (btn) { btn.remove(); btn = null; }
    if (G.world) G.world.nightVis = 1;
  };
  // Taste „Lampe“ schaltet das Nachtsichtgerät (Flanke); läuft auch während Sequenzen (dann ohne NSG-Bild)
  let held = false, lastCine = null;
  const tick = () => {
    if (!st.on) return true;
    if (m.finished || m.state === 'done') { st.off(); return true; }
    const I = G.input;
    let down = false;
    try { down = !!(I && I.enabled && I.pressed('light')); } catch { down = false; }
    if (down && !held && nvg && !m.cutscene) st.set(!st.nvg);
    held = down;
    const cine = !!m.cutscene;
    if (cine !== lastCine) { lastCine = cine; apply(); }
    return false;
  };
  // eigener Takt (Ticker der Regie ruhen während der Sequenzen)
  const raf = () => { if (tick()) return; st._raf = requestAnimationFrame(raf); };
  st._raf = requestAnimationFrame(raf);
  const dispose = m.dispose.bind(m);
  m.dispose = () => { try { cancelAnimationFrame(st._raf); st.off(); } catch { /* */ } dispose(); };
  if (start) st.nvg = true;
  apply();
  m._kcNight = st;
  return st;
}

/* ======================================================================== Markieren im Visier */

/**
 * Ziele im Visier markieren: list = [{ key, pos: () => Vector3 (Brusthöhe), name, onMark }] – anvisieren (Zielfernrohr bzw.
 * Kimme: Aktion „Zielen“ halten) und `secs` Sekunden auf dem Ziel bleiben (Kegel `cone` rad, freie Sicht). → Handle (fertig,
 * wenn alle markiert). o = { secs, cone, needAds, range, label }
 */
export function scopeMark(m, id, text, list, { secs = 1.2, cone = 0.035, needAds = true, range = 260, label = 'Markieren' } = {}) {
  const G = m.G;
  const marked = new Set();
  const ob = m.objective(id, text, { total: list.length, quiet: false });
  m.progress(id, 0, list.length);
  let cur = null, t = 0;
  const h = m.until(() => marked.size >= list.length || ob.done); // ob.done: Tests/Skript erledigen das Ziel direkt
  m.every((dt) => {
    if (marked.size >= list.length || ob.done) { if (m.ui) m.ui.hold(null); m.done(id); return true; }
    const P = G.player, cam = G.camera;
    if (!P || !P.alive || !cam) return false;
    const ads = !needAds || !!(P.weapon && P.weapon.ads) || !!P.vehicle;
    cam.getWorldPosition(_v);
    cam.getWorldDirection(_f);
    let best = null, bd = cone;
    if (ads) {
      for (const tgt of list) {
        if (marked.has(tgt.key)) continue;
        let p = null;
        try { p = tgt.pos(); } catch { p = null; }
        if (!p) continue;
        _w.copy(p).sub(_v);
        const d = _w.length();
        if (d > range || d < 0.5) continue;
        const a = Math.acos(Math.min(1, _w.dot(_f) / d));
        // weiter entfernte Ziele: etwas größerer Kegel (das Zielfernrohr zittert)
        const lim = cone * (1 + Math.min(1, d / 120));
        if (a > lim || a > bd * 2) continue;
        const W = G.world;
        if (W && W.lineOfSight && !W.lineOfSight(_v, p)) continue;
        if (a < bd || !best) { bd = a; best = tgt; }
      }
    }
    if (best !== cur) { cur = best; t = 0; }
    if (cur) {
      t += dt;
      if (m.ui) m.ui.hold(`${tx(label)}: ${tx(cur.name || 'Ziel')} …`, t / secs);
      if (t >= secs) {
        marked.add(cur.key);
        m.progress(id, marked.size, list.length);
        m.toast(`Markiert: ${cur.name || 'Ziel'}`, 'ok', 2);
        try { if (cur.onMark) cur.onMark(cur); } catch (err) { console.error(err); }
        cur = null; t = 0;
        if (m.ui) m.ui.hold(null);
      }
    } else if (m.ui && t === 0) m.ui.hold(null);
    return false;
  });
  h.marked = marked;
  return h;
}

/* ======================================================================== Verfolgen / Überflug */

/**
 * Ziel in Reichweite halten: getPos() → Vector3 | null. o = { r (m), secs (Gesamtzeit in Reichweite), decay } →
 * Handle (fertig nach secs). Verlassen der Reichweite hält den Balken an (decay > 0: läuft langsam zurück).
 */
export function tail(m, id, text, getPos, { r = 300, secs = 20, decay = 0, label = 'Ziel' } = {}) {
  const G = m.G;
  const ob = m.objective(id, text, { pos: () => getPos(), label, progress: 0 });
  let t = 0, last = m.elapsed;
  return m.until(() => {
    const now = m.elapsed, dt = Math.min(0.25, now - last);
    last = now;
    const p = getPos();
    const P = G.player;
    if (!p || !P) return false;
    const me = P.vehicle ? P.vehicle.position : P.position;
    const inside = me.distanceTo(p) <= r;
    if (inside) t += m.rush ? dt * Math.max(1, secs / 2) : dt; else t = Math.max(0, t - dt * decay);
    ob.progress = t / secs;
    if (t >= secs) { m.done(id); return true; }
    return false;
  });
}

/* ======================================================================== Figuren */

/**
 * Zivilist/Verdächtiger, der eine Runde läuft: def = { route: [[x,z], …], speed, variant, name, protect, failText, loop,
 * pause } → Extra (mit .stopWalk()). Geschützte Figuren lösen beim Treffer durch den Spieler den Fehlschlag aus.
 */
export function walker(m, id, def) {
  const route = def.route || [];
  const x = m.extra(id, { pos: route[0], yaw: def.yaw || 0, variant: def.variant || 'zivil', name: def.name || 'Passant', protect: def.protect !== false, failText: def.failText || null, aim: -1.1, crouch: !!def.crouch });
  if (route.length < 2) return x;
  let leg = 1, wait = def.pause ?? 2;
  let stopped = false;
  x.stopWalk = () => { stopped = true; try { x.a.path = null; } catch { /* */ } };
  const go = () => { const q = route[leg]; x.walk([q], def.speed || 1.3); };
  go();
  m.every((dt) => {
    if (x.removed) return true;
    if (stopped) return false;
    if (!x.a.path) {
      wait -= dt;
      if (wait > 0) return false;
      wait = def.pause ?? 2 + Math.random() * 2;
      leg += 1;
      if (leg >= route.length) { if (def.loop === false) { stopped = true; return false; } leg = 0; }
      go();
    }
    return false;
  });
  return x;
}

/* ======================================================================== Bauen und Graben */

/** Zähler für fertige Bauwerke des Spielers (Taste K) seit dem Aufruf → () => Anzahl (je Art: byKind). */
export function buildCount(m) {
  const c = { n: 0, kinds: {} };
  m.on('build:done', (e) => { if (e && e.actor === m.G.player) { c.n += 1; c.kinds[e.kind] = (c.kinds[e.kind] || 0) + 1; } });
  const f = () => c.n;
  f.kind = (k) => c.kinds[k] || 0;
  return f;
}

/** Zähler für Spatenhiebe in den Erdboden (digging.js, Ereignis „dig“ ohne Krater) in der Nähe von at (r). */
export function digCount(m, at = null, r = 30) {
  let n = 0;
  const c = at ? m.vec(at) : null;
  m.on('dig', (e) => {
    if (!e || e.crater) return;
    if (c && Math.hypot(e.x - c.x, e.z - c.z) > r) return;
    n += 1;
  });
  return () => n;
}

/** Nahkampfwaffe setzen (bleibt nach dem Wiedereinstieg). */
export function giveMelee(m, id = 'spaten') {
  const P = m.G.player;
  const W = m.G.data && m.G.data.WEAPONS;
  if (!P || !W || !W[id]) return false;
  P.loadout = { ...(P.loadout || {}), melee: id };
  try { if (P.weapon && typeof P.weapon.setLoadout === 'function') P.weapon.setLoadout(P.loadout); } catch (err) { console.warn('[Kampagne] Nahkampfwaffe', err); return false; }
  return true;
}

/* ======================================================================== Luftfahrzeuge */

/** Bot ohne eigene KI auf den Pilotensitz setzen (der Autopilot air.fly fliegt). → Bot | null */
export function pilot(m, v, team = 'B', name = null) {
  const G = m.G, air = G.vehicles && G.vehicles.air;
  if (!air || !v) return null;
  const [b] = m._spawnBots(team, 1);
  if (!b) return null;
  b._kc = team === 'B' ? { enemy: true, wave: `pilot:${v.id || 'v'}`, crew: true } : { ally: false, crew: true };
  if (name) { b.name = name; const pl = G.bots._plates && G.bots._plates.get(b); if (pl && pl.setName) pl.setName(name); }
  m._place(b, { position: v.position.clone(), yaw: 0 });
  try { air.board(b, v, 0); } catch { /* */ }
  b.update = function scriptedPilot() {}; // sitzt nur
  return b;
}

/** Luftfahrzeug v fliegt Wegpunkte pts [[x,y,z]…] im Kreis (Autopilot). → { stop() } */
export function circuit(m, v, pts, { speed = 30, reach = 60, loop = true } = {}) {
  const G = m.G, air = G.vehicles && G.vehicles.air;
  const P = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const st = { i: 0, on: true };
  const fly = () => { try { air.fly(v, { to: P[st.i], alt: P[st.i].y, speed }); } catch { /* */ } };
  fly();
  m.every(() => {
    if (!st.on || !v.alive) return true;
    const b = v.body ? v.body.pos : v.position;
    if (Math.hypot(b.x - P[st.i].x, b.z - P[st.i].z) < reach) {
      st.i += 1;
      if (st.i >= P.length) { if (!loop) { st.on = false; return true; } st.i = 0; }
      fly();
    }
    return false;
  });
  st.stop = () => { st.on = false; };
  return st;
}

/** Bot eine bestimmte Hauptwaffe geben (z. B. Scharfschützengewehr). */
export function arm(bot, id) {
  if (!bot || !bot.weapon) return false;
  try {
    const W = bot.G && bot.G.data && bot.G.data.WEAPONS;
    const def = W && W[id];
    if (!def) return false;
    // Werfer/Pistolen auf den Zweitplatz – und gleich in die Hand (der Bot benutzt die Waffe in der Hand)
    const second = def.slot === 'secondary';
    bot.loadout = { ...(bot.loadout || {}), [second ? 'secondary' : 'primary']: id };
    bot.weapon.setLoadout(bot.loadout);
    if (second && Array.isArray(bot.weapon.slots)) { const i = bot.weapon.slots.findIndex((x) => x && x.id === id); if (i >= 0) { bot.weapon.index = i; if (typeof bot.weapon._refreshStatic === 'function') bot.weapon._refreshStatic(); } }
    if (typeof bot._syncGun === 'function') bot._syncGun(true);
    return true;
  } catch (err) { console.warn('[Kampagne] Waffe für Bot', err); return false; }
}

/** Höhe der obersten Standfläche bei (x, z) (Dach) – world.groundHeight von oben; Rückfall 0. */
export function roofY(m, x, z, from = 60) {
  const W = m.G.world;
  try { const y = W && W.groundHeight ? W.groundHeight(x, z, from) : null; return Number.isFinite(y) ? y : 0; } catch { return 0; }
}
