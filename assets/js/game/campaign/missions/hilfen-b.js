// NULLPUNKT — Kampagne, gemeinsame Bausteine für die Missionen 7–11 (Strang kampagne-b). Nur Funktionen, die mit der
// vorhandenen Regie (director.js) arbeiten, ohne sie zu ändern:
//   mapFor(neu, ersatz, koord)      – Karte der Mission: neue Karte nur, wenn sie im Build existiert UND Koordinaten hat
//   clearAir(m)                     – Luftfahrzeuge der Karten-Stellplätze entfernen (sonst holt sich ein KI-Pilot den
//                                     feindlichen Hubschrauber mitten in der Mission)
//   convoy(m, id, defs)             – Fahrzeugkolonne des Nordkorps mit Bot-Fahrern (Route, Tempo, Halt/Weiter)
//   allyTank(m, id, o)              – verbündeter Panzer mit Bot-Besatzung: fährt eine Route, schießt auf Feinde/Fahrzeuge
//   strike(m, punkte, o)            – Einschläge (Präzisionsschlag/Bomben) nacheinander, mit Schaden
//   jetPass(m, von, nach, o)        – Überflug eines Kampfjets (Bot-Pilot, Autopilot), verschwindet danach
//   guardZone(m, zone, o)           – Zone darf nicht ohne Verteidiger von Feinden gehalten werden (wie Werk Sieben)
//   giveLauncher(m, id)             – Spieler bekommt einen Raketenwerfer als Zweitwaffe (bleibt nach dem Wiedereinstieg)
//   escort(m, rolle)                – Begleitfigur folgt dem Spieler (Befehl „folgen“ nur für diesen Bot)
//   ostbund(m, bot)                 – Verbündeten in Ostbund-Uniform kleiden (Team A, Tarnschema des Ostbunds)
//   squad(m, id, o)                 – Nebengefecht: zwei Gruppen ohne Spielerbezug, werden laufend aufgefüllt (Massenschlacht)
//   purgeDead(m)                    – gefallene Gegner nach einer Weile entfernen (Speicher bei vielen Wellen)
//   prop(m, def)                    – Figur ohne KI im Spiel (Verwundeter, Gefangener), Rollen-Aussehen, echte Bodenhöhe

import * as THREE from 'three';
import { MAPS } from '../../../shared/maps.data.js?v=20261119182451';
import { issueCommand } from '../../bots/ai/orders.js?v=20261119182451';
import { schemeForTeam } from '../../bots/character.js?v=20261119182451';
import { StageActor } from '../stage.js?v=20261119182451';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

/** Karte wählen: neue Karte nur, wenn sie registriert ist und die Mission für sie Koordinaten hat. */
export function mapFor(neu, ersatz, coords) {
  return MAPS[neu] && coords && coords[neu] ? neu : ersatz;
}

/** Luftfahrzeuge der Karten-Stellplätze entfernen (Stellplätze werden gelöscht, damit nichts nachwächst). */
export function clearAir(m, { ground = false } = {}) {
  const sys = m.G.vehicles;
  if (!sys || !sys.attached || !Array.isArray(sys.spawns)) return 0;
  let n = 0;
  const mine = new Set(m.vehicles);
  sys.spawns = sys.spawns.filter((sp) => {
    const d = sp && sp.type && sys.list ? (sp.vehicle ? sp.vehicle.def : null) : null;
    const air = (d && d.air) || sp.type === 'heli' || sp.type === 'jet';
    const mil = !(d && d.civil) && !['pkw', 'transporter', 'stapler', 'zugmaschine'].includes(sp.type);
    if (!(air || (ground && mil))) return true;
    if (sp.vehicle && !mine.has(sp.vehicle)) { try { sys.removeVehicle(sp.vehicle); n++; } catch { /* */ } }
    return false;
  });
  return n;
}

/** Bot ins Fahrzeug setzen (Sitz idx); legt bei Bedarf einen namenlosen Verbündeten an. */
function crew(m, v, idx, bot = null, name = null) {
  if (!v) return null;
  if (!bot) {
    const [b] = m._spawnBots('A', 1);
    if (!b) return null;
    b._kc = { ally: false, crew: true };
    if (name) { b.name = name; const pl = m.G.bots._plates && m.G.bots._plates.get(b); if (pl && pl.setName) pl.setName(name); }
    m._place(b, { position: v.position.clone(), yaw: 0 });
    bot = b;
  }
  try { m.G.vehicles.enter(bot, v, idx); } catch (err) { console.warn('[Kampagne] Besatzung', err); }
  return bot;
}

/**
 * Kolonne: defs = [{ type, at:[x,z], yaw, driver?: Bot, name?: 'Fahrername', gunner?: true }] – Fahrzeuge des Nordkorps
 * mit Bot-Fahrer. → { list: [{ v, driver, gunner }], go(route, { speed, gap }), stop(), alive(), arrived(r), lead }
 * Die Fahrzeuge folgen derselben Route (Vector3-Liste), jedes mit Abstand hinter dem vorderen; sie halten an, wenn das
 * vordere steht oder der Weg blockiert ist.
 */
export function convoy(m, id, defs) {
  const list = [];
  for (const d of defs) {
    const v = m.vehicle(d.type, d.at, d.yaw || 0, 'A');
    if (!v) continue;
    const driver = crew(m, v, 0, d.driver || null, d.name || null);
    const gunner = d.gunner ? crew(m, v, 1, null, d.gunnerName || null) : null;
    list.push({ v, driver, gunner, def: d });
  }
  const c = { id, list, route: null, speed: 6, gap: 14, moving: false, holdFor: null };
  c.alive = () => list.every((e) => e.v.alive && !e.v.wreck);
  c.lead = () => list.find((e) => e.v.alive && !e.v.wreck) || null;
  c.go = (route, { speed = 6, gap = 14 } = {}) => {
    c.route = route.map((p) => m.vec(p));
    c.speed = speed; c.gap = gap; c.moving = true;
    list.forEach((e, i) => {
      if (!e.driver || !e.driver.alive || e.driver.vehicle !== e.v) return;
      e.v.followPath(e.driver, c.route, { arriveRadius: 4 + i * gap * 0.6, maxSpeed: speed });
    });
  };
  c.stop = () => { c.moving = false; for (const e of list) if (e.driver && e.driver.vehicle === e.v) e.v.stop(e.driver); };
  /** Fahrzeug e hat die Zone (Punkt, Radius) erreicht? */
  c.near = (p, r = 12) => { const q = m.vec(p); return list.some((e) => e.v.alive && e.v.position.distanceTo(q) < r); };
  c.arrived = (r = 10) => !!c.route && c.lead() && c.lead().v.position.distanceTo(c.route[c.route.length - 1]) < r;
  // Abstand halten: Folgefahrzeuge bremsen, wenn sie dem Vordermann zu nahe kommen; MG-Schützen der Kolonne schießen
  m.every((dt) => {
    if (!c.moving) return false;
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      if (!b.driver || b.driver.vehicle !== b.v) continue;
      const it = b.v.intentFor(b.driver);
      if (!it) continue;
      const d = a.v.alive ? a.v.position.distanceTo(b.v.position) : 99;
      it.maxSpeed = d < c.gap * 0.7 ? 0.5 : d < c.gap ? c.speed * 0.6 : c.speed;
    }
    for (const e of list) if (e.gunner && e.gunner.alive && e.gunner.vehicle === e.v) gunnerAI(m, e.v, e.gunner, dt, 70);
    return false;
  });
  return c;
}

/** Nächster sichtbarer Feind (Infanterie) zu p innerhalb r. */
export function nearestFoe(m, p, r = 80, team = 'A') {
  let best = null, bd = r * r;
  for (const a of m.G.actors) {
    if (!a.alive || a.team === team || a.team == null) continue;
    const d = a.position.distanceToSquared(p);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

/** Schützen-KI eines MG-/Turmsitzes: zielt auf den nächsten Feind, kurze Feuerstöße bei Sichtlinie. */
function gunnerAI(m, v, bot, dt, range = 70) {
  const s = bot._kbGun || (bot._kbGun = { t: 0, burst: 0 });
  s.t -= dt;
  const foe = nearestFoe(m, v.position, range, 'A');
  if (!foe) { v.aimAt(bot, null, false); return; }
  _v.copy(foe.position); _v.y += 1.1;
  const W = m.G.world;
  _w.copy(v.position); _w.y += 2.2;
  const los = !W || !W.lineOfSight || W.lineOfSight(_w, _v);
  v.aimAt(bot, _v, false);
  const it = v.intentFor(bot);
  if (!it) return;
  if (los && s.t <= 0) { s.burst = 0.8 + Math.random() * 0.6; s.t = 2.2 + Math.random() * 1.5; }
  if (s.burst > 0) { s.burst -= dt; it.fire = los; } else it.fire = false;
}

/**
 * Verbündeter Kampfpanzer mit Bot-Besatzung (Fahrer = Richtschütze in einem Sitz, wie die Gegner in scriptTank):
 * o = { at, yaw, route: [[x,z],…], speed, range, fireEvery, name } → { v, bot, go(route), hold(), active }
 * Zielt auf feindliche Fahrzeuge (Vorrang) bzw. Infanterie in Reichweite und schießt alle fireEvery s.
 */
export function allyTank(m, id, o) {
  const v = m.vehicle(o.type || 'tank', o.at, o.yaw || 0, 'A');
  if (!v) return null;
  const bot = crew(m, v, 0, null, o.name || null);
  const t = { id, v, bot, route: null, leg: 0, speed: o.speed || 5, range: o.range || 120, fireEvery: o.fireEvery || 6, next: 2, active: true };
  t.go = (route, speed = t.speed) => {
    t.route = route.map((p) => m.vec(p)); t.speed = speed;
    if (bot && bot.vehicle === v) v.followPath(bot, t.route, { arriveRadius: 6, maxSpeed: speed });
  };
  t.hold = () => { if (bot && bot.vehicle === v) v.stop(bot); };
  t.ok = () => v.alive && !v.wreck;
  if (o.route) t.go(o.route, o.speed);
  m.every((dt) => {
    if (!t.ok() || !bot || !bot.alive || bot.vehicle !== v) return !t.ok();
    if (!t.active) return false;
    t.next -= dt;
    // Ziel: feindliches besetztes Fahrzeug, sonst Infanterie
    let tgt = null, bd = t.range * t.range;
    for (const x of m.G.vehicles.list) {
      if (!x.alive || x.wreck || x === v || !x.isOccupied || !x.hostileTo || !x.hostileTo(bot)) continue;
      const d = x.position.distanceToSquared(v.position);
      if (d < bd) { bd = d; tgt = x.position; }
    }
    if (!tgt) { const f = nearestFoe(m, v.position, t.range * 0.6, 'A'); if (f) tgt = f.position; }
    if (!tgt) return false;
    _v.copy(tgt); _v.y += 1.2;
    v.aimAt(bot, _v, false);
    const W = m.G.world;
    _w.copy(v.position); _w.y += 2.6;
    if (t.next <= 0 && (!W || !W.lineOfSight || W.lineOfSight(_w, _v))) {
      t.next = t.fireEvery * (0.8 + Math.random() * 0.4);
      const it = v.intentFor(bot);
      if (it) { it.fire = true; it.firePressed = true; setTimeout(() => { it.fire = false; }, 400); }
    }
    return false;
  });
  return t;
}

/**
 * Einschläge nacheinander: punkte [[x,z], …]; o = { every: s zwischen Einschlägen, radius, damage, vehicles: Liste von
 * Fahrzeugen, die im Radius zerstört werden } → Handle (fertig nach dem letzten Einschlag).
 */
export function strike(m, points, { every = 0.45, radius = 9, damage = 260, vehicles = null } = {}) {
  const G = m.G;
  const pts = points.map((p) => m.vec(p));
  let i = 0, t = 0;
  const h = m.until(() => i >= pts.length);
  m.every((dt) => {
    t -= dt;
    if (t > 0) return false;
    if (i >= pts.length) return true;
    const p = pts[i++];
    t = every * (0.7 + Math.random() * 0.6);
    try { G.combat.explode({ position: p.clone().setY(p.y + 0.3), radius, maxDamage: damage, attacker: G.player, weaponId: 'bomb_250', type: 'frag', concuss: true }); } catch (err) { console.warn('[Kampagne] Einschlag', err); }
    for (const v of vehicles || G.vehicles.list) {
      if (!v || !v.alive || v.wreck || v.team === 'A' || v.spawnTeam === 'A') continue;
      if (v.position.distanceTo(p) < radius * 0.9) { try { v.destroy(G.player, 'bomb_250'); } catch { /* */ } }
    }
    return i >= pts.length;
  });
  return h;
}

/**
 * Überflug eines Kampfjets (Team A): startet in der Luft bei von=[x,y,z], fliegt nach nach=[x,y,z] und wird danach
 * entfernt. → { v, done } (Handle fertig, wenn der Jet weg ist).
 */
export function jetPass(m, from, to, { team = 'A', speed = 150, alt = null, onOver = null, overAt = null } = {}) {
  const G = m.G;
  const air = G.vehicles && G.vehicles.air;
  const h = m.until(() => !st.v || st.gone);
  const st = { v: null, gone: false, over: false };
  if (!air) { st.gone = true; return { v: null, done: h }; }
  const a = new THREE.Vector3(from[0], from[1], from[2]);
  const b = new THREE.Vector3(to[0], to[1], to[2]);
  const yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
  let v = null;
  try { v = air.spawn('jet', a, { yaw, team, airborne: true, speed }); } catch (err) { console.warn('[Kampagne] Jet', err); }
  if (!v) { st.gone = true; return { v: null, done: h }; }
  st.v = v;
  const [pilot] = m._spawnBots(team, 1);
  if (pilot) {
    pilot._kc = { ally: false, crew: true };
    m._place(pilot, { position: a.clone(), yaw });
    try { air.board(pilot, v, 0); } catch { /* */ }
    pilot.update = function jetPilot() {}; // sitzt nur; der Autopilot fliegt
  }
  air.fly(v, { to: b, alt: alt ?? b.y, speed });
  const op = overAt ? m.vec(overAt) : null;
  m.every(() => {
    if (!v.alive) { st.gone = true; return true; }
    const p = v.body.pos;
    if (op && !st.over && Math.hypot(p.x - op.x, p.z - op.z) < 60) { st.over = true; if (onOver) { try { onOver(v); } catch (err) { console.error(err); } } }
    if (Math.hypot(p.x - b.x, p.z - b.z) < 80) {
      st.gone = true;
      try { air.release(v); } catch { /* */ }
      try { if (pilot) { G.vehicles.removeFromSeat(pilot, { teleport: false }); G.bots.removeBot(pilot); } } catch { /* */ }
      try { G.vehicles.removeVehicle(v); } catch { /* */ }
      return true;
    }
    return false;
  });
  return { v, done: h, state: st };
}

/**
 * Zone halten (wie das Werkstor in Mission 2): Feinde in der Zone ohne eigene Leute → Zähler läuft, nach secs Fehlschlag.
 * o = { secs, bar: Ziel-Id für den Balken, warn: [sprecher, text], fail: Text, flag } – läuft, bis stop() bzw. Flag.
 */
export function guardZone(m, zone, { secs = 15, bar = null, warn = null, fail = 'Die Stellung ist gefallen.', flag = null } = {}) {
  const key = flag || `guard:${zone}`;
  if (m.get(key)) return;
  m.set(key, true);
  let lost = 0, warned = false;
  m.every((dt) => {
    if (m.get(key) === 'aus') return true;
    if (m.G.match.state !== 'playing') return false;
    const foes = m.countIn(zone, 'B');
    const ours = m.countIn(zone, 'A');
    if (foes > 0 && ours === 0) lost += dt; else lost = Math.max(0, lost - dt * 0.5);
    if (bar) m.bar(bar, 1 - lost / secs);
    if (lost > 0.5 && !warned && warn) { warned = true; m.say(warn[0], warn[1], { expr: 'angespannt', radio: true }); }
    if (lost <= 0) warned = false;
    if (lost >= secs) { m.fail(fail); return true; }
    return false;
  });
}
export function stopGuard(m, zone, flag = null) { m.set(flag || `guard:${zone}`, 'aus'); }

/** Raketenwerfer als Zweitwaffe (bleibt über den Wiedereinstieg erhalten). */
export function giveLauncher(m, id = 'at_donner') {
  const P = m.G.player;
  const W = m.G.data && m.G.data.WEAPONS;
  if (!P || !W || !W[id]) return false;
  P.loadout = { ...(P.loadout || {}), secondary: id };
  try { if (P.weapon && typeof P.weapon.setLoadout === 'function') P.weapon.setLoadout(P.loadout); } catch (err) { console.warn('[Kampagne] Werfer', err); return false; }
  return true;
}

/** Einzelnen Verbündeten (Rolle) einen Befehl geben, ohne die anderen umzustellen. */
export function orderOne(m, role, kind, point = null) {
  const b = m.ally(role);
  if (!b || !b.alive) return 0;
  try { return issueCommand(m.G, [b], m.G.player, kind, { point: point ? m.vec(point) : null, target: null, formation: null }, m.G.time.elapsed); } catch { return 0; }
}

/** Begleitfigur (Rolle) folgt dem Spieler; → Funktion, die prüft, ob sie in der Zone ist. */
export function escort(m, role) {
  orderOne(m, role, 'follow');
  m.on('actor:spawn', (e) => { if (e && e.actor === m.ally(role)) orderOne(m, role, 'follow'); });
  return (zone) => { const b = m.ally(role); return !!(b && b.alive && m.inZone(zone, b)); };
}

/** Akteur einer Rolle sofort neben den Spieler bzw. an einen Punkt setzen (Begleitfigur hängt fest). */
export function bringAlly(m, role, at = null) {
  const b = m.ally(role);
  const G = m.G;
  if (!b || !b.alive) return false;
  const p = at ? m.vec(at) : G.player.position.clone().add(_v.set(1.5, 0, 1.5));
  p.y = m.vec([p.x, p.z]).y;
  try { if (b.body && b.body.teleport) b.body.teleport(p); else b.position.copy(p); } catch { return false; }
  return true;
}

/** Verbündeten in Ostbund-Uniform kleiden (bleibt nach dem Wiedereinstieg). */
export function ostbund(m, bot) {
  if (!bot || !bot.soldiers) return false;
  try {
    bot.scheme = schemeForTeam('B', m.G.world) || 'B';
    const i = bot.active | 0;
    const old = bot.soldiers[i];
    if (old) { try { old.root.removeFromParent(); old.dispose(); } catch { /* */ } }
    bot.soldiers[i] = null;
    const s = bot._soldier(i);
    s.reset(bot.position.clone(), bot.yaw || 0);
    bot._syncGun(true);
    return true;
  } catch (err) { console.warn('[Kampagne] Ostbund-Uniform', err); return false; }
}

/** Namen für Nebenfiguren (frei erfunden). */
const NK = ['Gefr. Albrecht', 'Gefr. Kuhn', 'Gefr. Seidel', 'Gefr. Brauer', 'Gefr. Winter', 'Gefr. Haas', 'OGefr. Lorenz', 'Gefr. Pohl', 'Gefr. Engel', 'Gefr. Reuter'];
const OB = ['Hptfw. Orlan', 'Sold. Basko', 'Sold. Terek', 'Sold. Marn', 'Sold. Velin', 'Gefr. Dravo', 'Sold. Kasim', 'Sold. Ondra', 'Sold. Rusan', 'Sold. Pelko'];
export const NAMES = { nordkorps: NK, ostbund: OB };

/**
 * Nebengefecht (Massenschlacht): Gruppe A (Verbündete, ohne Wiedereinstieg am Spieler) verteidigt bzw. greift einen Punkt
 * an, Gruppe B (Gegner) greift ihn an; beide Seiten werden alle `every` s auf ihre Stärke aufgefüllt, solange aktiv.
 * o = { a: { n, at: [[x,z]…], kind: 'defend'|'attack', point, ostbund }, b: { n, at, attack: [x,z] }, every }
 * → { stop(), alive() }
 */
export function squad(m, id, o) {
  const G = m.G;
  const lowQ = G.renderer && G.renderer.quality === 'low';
  const nA = Math.max(0, Math.round((o.a ? o.a.n : 0) * (lowQ ? 0.5 : 1)));
  const nB = Math.max(0, Math.round((o.b ? o.b.n : 0) * (lowQ ? 0.5 : 1)));
  const st = { on: true, a: [], b: [], t: 0 };
  const ptsA = o.a ? o.a.at.map((p) => m.vec(p)) : [];
  const pointA = o.a && o.a.point ? m.vec(o.a.point) : null;
  let k = 0;
  const fillA = () => {
    st.a = st.a.filter((b) => b.alive);
    const need = nA - st.a.length;
    if (need <= 0) return;
    const bots = m._spawnBots('A', need);
    bots.forEach((b, i) => {
      const p = ptsA[(k + i) % ptsA.length].clone().add(_v.set((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4));
      p.y = m.vec([p.x, p.z]).y;
      b._kc = { ally: false, crew: true, side: id };
      const nm = (o.a.ostbund ? OB : NK)[(k + i) % 10];
      b.name = nm; const pl = G.bots._plates && G.bots._plates.get(b); if (pl && pl.setName) pl.setName(nm);
      m._place(b, { position: p, yaw: 0 });
      if (o.a.ostbund) ostbund(m, b);
      st.a.push(b);
    });
    k += need;
    if (pointA) { try { issueCommand(G, bots, G.player, o.a.kind || 'defend', { point: pointA, target: null, formation: null }, G.time.elapsed); } catch { /* */ } }
  };
  let wn = 0;
  const fillB = () => {
    const w = m.waves.get(`${id}:b`);
    const alive = w ? w.bots.filter((b) => b.alive).length : 0;
    const need = nB - alive;
    if (need <= 0) return;
    m.wave(`${id}:b${++wn}`, { count: need, at: o.b.at, attack: o.b.attack, radius: o.b.radius || 10, scale: false });
    const nw = m.waves.get(`${id}:b${wn}`);
    // in einer Sammelwelle führen (Zählung)
    const all = m.waves.get(`${id}:b`) || { id: `${id}:b`, bots: [], total: 0, attack: o.b.attack, radius: 10 };
    all.bots = all.bots.filter((b) => b.alive).concat(nw.bots);
    all.total = all.bots.length;
    m.waves.set(`${id}:b`, all);
  };
  if (nA) fillA();
  if (nB) fillB();
  m.every((dt) => {
    if (!st.on) return true;
    st.t += dt;
    if (st.t >= (o.every || 18)) { st.t = 0; if (nA) fillA(); if (nB) fillB(); }
    return false;
  });
  return {
    stop(remove = false) {
      st.on = false;
      if (remove) for (const b of st.a) { try { G.bots.removeBot(b); } catch { /* */ } }
    },
    get allies() { return st.a; },
  };
}

/** Gefallene Gegner (und Nebenfiguren) nach `after` s entfernen – hält den Speicher bei langen Schlachten klein. */
export function purgeDead(m, after = 14) {
  if (m.get('purge')) return;
  m.set('purge', true);
  const dead = new Map();
  m.on('kill', (e) => { const v = e && e.victim; if (v && v.isBot && v._kc && (v._kc.enemy || v._kc.crew)) dead.set(v, m.elapsed); });
  let t = 0;
  m.every((dt) => {
    t += dt;
    if (t < 3) return false;
    t = 0;
    for (const [b, at] of dead) {
      if (b.alive) { dead.delete(b); continue; }
      if (m.elapsed - at < after) continue;
      dead.delete(b);
      try { m.G.bots.removeBot(b); const i = m.G.actors.indexOf(b); if (i >= 0) m.G.actors.splice(i, 1); } catch { /* */ }
    }
    return false;
  });
}

/**
 * Figur ohne KI im Spiel (Verwundeter, Gefangener …): def = { role, at: [x,z], yaw, crouch, aim, team, variant, weapon }
 * → StageActor (wird beim Entfernen bzw. Missionsende entsorgt). Gesicht/Lip-Sync wie in Zwischensequenzen.
 */
export function prop(m, def) {
  const spk = (m.mission.speakers || {})[def.role] || {};
  let a = null;
  try { a = new StageActor(m.G, { id: def.role || 'figur', ...spk, ...def, pos: def.at, face: def.face ?? false }); } catch (err) { console.warn('[Kampagne] Figur', err); return null; }
  const list = m._kbProps || (m._kbProps = []);
  list.push(a);
  if (!m._kbPropsHooked) {
    m._kbPropsHooked = true;
    const dispose = m.dispose.bind(m);
    m.dispose = () => { for (const x of m._kbProps || []) { try { x.dispose(); } catch { /* */ } } m._kbProps = []; dispose(); };
    // Takt (Animation) auch in Sequenzen; während der Sequenz ausgeblendet
    const tick = () => {
      if (m.finished && !m._kbProps.length) return;
      const dt = Math.min(0.1, m.G.time && m.G.time.dt ? m.G.time.dt : 1 / 60);
      for (const x of m._kbProps) { x.soldier.root.visible = !x.hidden && !m.cutscene; if (!m.cutscene) x.update(dt, m.G.camera ? m.G.camera.position : null); }
    };
    m.every(() => { tick(); return false; });
  }
  a.remove = () => { const i = m._kbProps.indexOf(a); if (i >= 0) m._kbProps.splice(i, 1); try { a.dispose(); } catch { /* */ } };
  return a;
}

/** Fahrzeug widerstandsfähiger machen (Schaden × k), z. B. Fahrzeuge einer Kolonne, die nicht ausfallen dürfen. */
export function toughen(v, k = 0.4) {
  if (!v || v._kbTough) return v;
  v._kbTough = true;
  const orig = v.applyDamage.bind(v);
  v.applyDamage = (amount, info) => orig(amount * k, info);
  return v;
}

/** Bot aus seinem Fahrzeug nehmen (neben das Fahrzeug). */
export function dismount(m, bot) {
  if (!bot || !bot.vehicle) return;
  try { m.G.vehicles.removeFromSeat(bot, { teleport: true }); } catch { /* */ }
}
