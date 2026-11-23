// NULLPUNKT — Battle Royale: Ausrüstung eines Akteurs (Spieler und Bots gleich): zwei Waffenplätze + Messer, Munitionsvorrat
// je Art (Rucksack), Weste/Helm (combat.equipArmor-Zustand), Verbände, Splitter-/Rauchgranaten, Ersatzplatten.
//   take(ctx, actor, item) → { ok, text, tone, drop: [Gegenstände, die zurück auf den Boden fallen] }
//   dropAll(actor) → [Gegenstände] (Tod: alles fällt)
//   value(ctx, actor, item) → Nutzen für Bots (0 = nutzlos)
// ctx = { G, W (Waffentabelle), injuries }
import { createArmorState } from '../../../shared/classes.data.js?v=20261123082814';
import { AMMO_TYPES, VEST_RANK, HELMET_RANK, GRENADE_MAX, BANDAGE_MAX, ammoTypeOf, weaponValue, itemName } from './items.js?v=20261123082814';

export const KNIFE_LOADOUT = { primary: 'knife', secondary: null, lethal: null, tactical: null, melee: 'knife', tool: null };

/** Zustand am Akteur (a._br). */
export function brState(a) {
  if (!a._br) a._br = { ammo: {}, bandages: 0, healAt: 0, healing: 0, kills: 0 };
  return a._br;
}

/** Schusswaffen-Plätze des Akteurs (ohne Messer). */
export function guns(a) {
  const w = a && a.weapon;
  return w && Array.isArray(w.slots) ? w.slots.filter((s) => s && s.def && s.def.cls !== 'melee') : [];
}

/** Verbände: Spieler über injuries (Taste N heilt mit styleFlags.bandageHeal), Bots im eigenen Zustand. */
export function bandagesOf(ctx, a) {
  if (a.isPlayer && ctx.injuries) return ctx.injuries.of(a).bandages | 0;
  return brState(a).bandages | 0;
}
export function setBandages(ctx, a, n) {
  n = Math.max(0, Math.min(BANDAGE_MAX, n | 0));
  if (a.isPlayer && ctx.injuries) ctx.injuries.of(a).bandages = n;
  brState(a).bandages = n;
}

/** Vorrat einer Munitionsart: eigener Platz (Reserve) bzw. Rucksack. */
export function ammoCount(a, type) {
  let n = brState(a).ammo[type] || 0;
  for (const s of guns(a)) if (ammoTypeOf(s.def) === type) n += s.reserve | 0;
  return n;
}

function addAmmo(a, type, n) {
  const T = AMMO_TYPES[type];
  if (!T || n <= 0) return 0;
  const slots = guns(a).filter((s) => ammoTypeOf(s.def) === type).sort((x, y) => (x.reserve | 0) - (y.reserve | 0));
  if (slots.length) {
    const s = slots[0];
    const add = Math.max(0, Math.min(n, T.max - (s.reserve | 0)));
    s.reserve = (s.reserve | 0) + add;
    return add;
  }
  const st = brState(a);
  const add = Math.max(0, Math.min(n, T.max - (st.ammo[type] || 0)));
  st.ammo[type] = (st.ammo[type] || 0) + add;
  return add;
}

/**
 * Waffenplätze setzen: ids = [Platz 1, Platz 2] (null = leer). Alte Plätze behalten Magazin und Reserve (setLoadout), eine neue
 * Waffe bekommt mag Patronen im Magazin und die Rucksack-Munition ihrer Art als Reserve. Granaten bleiben erhalten.
 */
export function setGuns(ctx, a, ids, newId = null, newMag = 0) {
  const w = a.weapon;
  if (!w || typeof w.setLoadout !== 'function') return;
  const eq = w.equipment || {};
  const lethal = eq.lethal ? { ...eq.lethal } : null, tac = eq.tactical ? { ...eq.tactical } : null;
  const list = ids.filter(Boolean);
  const lo = { primary: list[0] || 'knife', secondary: list[1] || null, lethal: lethal && lethal.id ? lethal.id : null, tactical: tac && tac.id ? tac.id : null, melee: 'knife', tool: null };
  // Spieler: keine eigenen Aufsätze auf Beute (Aufheben = Waffe wie gefunden)
  if (a.isPlayer) { lo.keepPickups = true; lo.pickup = { id: newId || lo.primary, att: null, camo: null }; for (const id of list) if (w._pickups && !w._pickups[id]) w._pickups[id] = { id, att: null, camo: null }; }
  try { w.setLoadout(lo); } catch (err) { console.error('[NULLPUNKT] BR setLoadout:', err); return; }
  if (lethal && w.equipment.lethal) w.equipment.lethal.count = lethal.count | 0;
  if (tac && w.equipment.tactical) w.equipment.tactical.count = tac.count | 0;
  a.loadout = { ...(a.loadout || {}), primary: lo.primary, secondary: lo.secondary };
  if (newId) {
    const s = w.slots.find((x) => x.id === newId);
    if (s) {
      s.mag = Math.max(0, Math.min(s.def.mag | 0, newMag | 0));
      const t = ammoTypeOf(s.def), st = brState(a);
      s.reserve = 0;
      if (t && st.ammo[t]) { s.reserve = st.ammo[t]; st.ammo[t] = 0; }
      const idx = w.slots.indexOf(s);
      if (idx >= 0 && idx !== w.index && typeof w.switchTo === 'function') { try { w.switchTo(idx); } catch { /* */ } }
    }
  }
}

function armorState(a) { return a.armor || null; }

/** Weste/Helm setzen; übrige Werte (Platten, Helm-Haltbarkeit, Ersatzplatten) bleiben, soweit möglich. */
function setArmor(ctx, a, tier, helmet, { freshVest = false, freshHelmet = false } = {}) {
  const prev = armorState(a);
  const st = createArmorState(tier, helmet);
  if (prev) {
    if (!freshVest && prev.tier === st.tier) { st.hp = Math.min(st.maxHp, prev.hp); st.carry = prev.carry; }
    else st.carry = Math.min(st.carryMax, prev.carry | 0);
    if (!freshHelmet && prev.helmetId === st.helmetId) st.helmetHp = prev.helmetHp;
  } else st.carry = 0;
  a.armor = st;
  ctx.G.events.emit('armor:pickup', { actor: a, carry: st.carry });
}

/** Nutzen eines Gegenstands für den Akteur (Bots wählen danach). */
export function value(ctx, a, it) {
  const W = ctx.W;
  switch (it.kind) {
    case 'weapon': {
      const d = W[it.key];
      if (!d) return 0;
      const g = guns(a);
      if (g.some((s) => s.id === it.key)) return ammoCount(a, ammoTypeOf(d)) < (d.mag | 0) * 2 ? 1.5 : 0.2;
      const v = weaponValue(d);
      if (g.length < 2) return v + (g.length === 0 ? 4 : 0);
      const worst = Math.min(...g.map((s) => weaponValue(s.def) + (s.mag + s.reserve > 0 ? 0 : -4)));
      return v - worst > 0.6 ? v - worst : 0;
    }
    case 'ammo': {
      const g = guns(a).filter((s) => ammoTypeOf(s.def) === it.key);
      if (!g.length) return 0.3;
      const have = ammoCount(a, it.key), need = Math.max(...g.map((s) => s.def.mag | 0)) * 3;
      return have < need ? 4 + (have <= 0 ? 3 : 0) : 0.4;
    }
    case 'vest': { const s = armorState(a); return (VEST_RANK[it.key] || 0) > (s ? VEST_RANK[s.tier] || 0 : 0) ? 3 + VEST_RANK[it.key] : 0; }
    case 'helmet': { const s = armorState(a); return (HELMET_RANK[it.key] || 0) > (s ? HELMET_RANK[s.helmetId] || 0 : 0) ? 2.5 + HELMET_RANK[it.key] : 0; }
    case 'bandage': return bandagesOf(ctx, a) < 4 ? 2.5 : bandagesOf(ctx, a) < BANDAGE_MAX ? 0.6 : 0;
    case 'grenade': { const e = a.weapon && a.weapon.equipment; const c = it.key === 'smoke' ? e && e.tactical : e && e.lethal; return c && c.id === it.key && c.count >= (it.key === 'smoke' ? 1 : GRENADE_MAX) ? 0 : it.key === 'smoke' ? 0.6 : 1.6; }
    case 'plate': { const s = armorState(a); return s && s.slots > 0 && s.carry < s.carryMax ? 1.6 : 0; }
    default: return 0;
  }
}

/** Gegenstand aufnehmen. → { ok, text, tone, drop } */
export function take(ctx, a, it) {
  const W = ctx.W;
  const name = itemName(it, W);
  const res = (ok, text, tone = 'gold', drop = []) => ({ ok, text, tone, drop });
  switch (it.kind) {
    case 'weapon': {
      const d = W[it.key];
      if (!d || !a.weapon) return res(false, 'Unbekannte Waffe.', 'dim');
      const g = guns(a);
      const own = g.find((s) => s.id === it.key);
      if (own) {
        const t = ammoTypeOf(d);
        const got = addAmmo(a, t, it.amount | 0);
        if (!got) return res(false, 'Kein Platz für mehr Munition.', 'dim');
        return res(true, `Munition aus ${name} (+${got})`, 'gold');
      }
      const ids = g.map((s) => s.id);
      const drop = [];
      if (ids.length < 2) ids.push(it.key);
      else {
        // gehaltene Waffe tauschen (sonst die schwächere)
        const cur = a.weapon.current && a.weapon.current.def && a.weapon.current.def.cls !== 'melee' ? a.weapon.current : null;
        const out = cur || g.reduce((m, s) => (weaponValue(s.def) < weaponValue(m.def) ? s : m));
        const i = ids.indexOf(out.id);
        ids[i] = it.key;
        drop.push({ kind: 'weapon', key: out.id, amount: out.mag | 0 });
        const t = ammoTypeOf(out.def);
        if (t && out.reserve > 0) { const st = brState(a); st.ammo[t] = Math.min(AMMO_TYPES[t].max, (st.ammo[t] || 0) + out.reserve); out.reserve = 0; }
      }
      setGuns(ctx, a, ids, it.key, it.amount);
      return res(true, `${name} aufgenommen`, 'gold', drop);
    }
    case 'ammo': {
      const got = addAmmo(a, it.key, it.amount | 0);
      if (!got) return res(false, 'Kein Platz für mehr Munition.', 'dim');
      const rest = (it.amount | 0) - got;
      return res(true, `${name} aufgenommen (+${got})`, 'gold', rest > 0 ? [{ kind: 'ammo', key: it.key, amount: rest }] : []);
    }
    case 'vest': {
      const s = armorState(a);
      const cur = s ? s.tier : 'keine';
      const better = (VEST_RANK[it.key] || 0) > (VEST_RANK[cur] || 0) || (s && s.hp <= s.maxHp * 0.35 && (VEST_RANK[it.key] || 0) >= (VEST_RANK[cur] || 0));
      if (!better) return res(false, 'Deine Weste ist besser.', 'dim');
      const drop = cur !== 'keine' && s && s.hp > 0 ? [{ kind: 'vest', key: cur, amount: 0 }] : [];
      setArmor(ctx, a, it.key, s ? s.helmetId : 'keine', { freshVest: true });
      return res(true, `${name} angelegt`, 'gold', drop);
    }
    case 'helmet': {
      const s = armorState(a);
      const cur = s ? s.helmetId : 'keine';
      const better = (HELMET_RANK[it.key] || 0) > (HELMET_RANK[cur] || 0) || (s && s.helmetHp <= 0 && (HELMET_RANK[it.key] || 0) >= (HELMET_RANK[cur] || 0));
      if (!better) return res(false, 'Dein Helm ist besser.', 'dim');
      const drop = cur !== 'keine' && s && s.helmetHp > 0 ? [{ kind: 'helmet', key: cur, amount: 0 }] : [];
      setArmor(ctx, a, s ? s.tier : 'keine', it.key, { freshHelmet: true });
      return res(true, `${name} aufgesetzt`, 'gold', drop);
    }
    case 'bandage': {
      const n = bandagesOf(ctx, a);
      if (n >= BANDAGE_MAX) return res(false, 'Du trägst schon genug Verbände.', 'dim');
      const add = Math.min(BANDAGE_MAX - n, it.amount || 2);
      setBandages(ctx, a, n + add);
      return res(true, `${name} aufgenommen (+${add} Verbände)`, 'gold', it.amount > add ? [{ kind: 'bandage', key: it.key, amount: it.amount - add }] : []);
    }
    case 'grenade': {
      const e = a.weapon && a.weapon.equipment;
      if (!e) return res(false, '', 'dim');
      const slot = it.key === 'smoke' ? 'tactical' : 'lethal';
      const max = it.key === 'smoke' ? 2 : GRENADE_MAX;
      const c = e[slot];
      if (c && c.id === it.key && c.count >= max) return res(false, 'Mehr Granaten passen nicht.', 'dim');
      const drop = c && c.id && c.id !== it.key && c.count > 0 ? [{ kind: 'grenade', key: c.id, amount: c.count }] : [];
      const n = c && c.id === it.key ? c.count : 0;
      e[slot] = { id: it.key, count: Math.min(max, n + Math.max(1, it.amount | 0)) };
      return res(true, `${name} aufgenommen`, 'gold', drop);
    }
    case 'plate': {
      const s = armorState(a);
      if (!s || !(s.slots > 0)) return res(false, 'Ohne Weste nutzlos.', 'dim');
      if (s.carry >= s.carryMax) return res(false, 'Keine Tasche für weitere Platten frei.', 'dim');
      s.carry = Math.min(s.carryMax, s.carry + Math.max(1, it.amount | 0));
      ctx.G.events.emit('armor:pickup', { actor: a, carry: s.carry });
      return res(true, `${name} eingesteckt`, 'gold');
    }
    default: return res(false, '', 'dim');
  }
}

/** Alles, was der Akteur trägt, als Bodenbeute (Tod). */
export function dropAll(ctx, a) {
  const out = [];
  const st = brState(a);
  for (const s of guns(a)) {
    out.push({ kind: 'weapon', key: s.id, amount: s.mag | 0 });
    const t = ammoTypeOf(s.def);
    if (t && s.reserve > 0) st.ammo[t] = (st.ammo[t] || 0) + s.reserve;
  }
  for (const [t, n] of Object.entries(st.ammo)) if (n > 0) out.push({ kind: 'ammo', key: t, amount: Math.min(n, AMMO_TYPES[t] ? AMMO_TYPES[t].max : n) });
  const ar = a.armor;
  if (ar) {
    if (ar.tier && ar.tier !== 'keine' && ar.hp > 0) out.push({ kind: 'vest', key: ar.tier, amount: 0 });
    if (ar.helmetId && ar.helmetId !== 'keine' && ar.helmetHp > 0) out.push({ kind: 'helmet', key: ar.helmetId, amount: 0 });
    if (ar.carry > 0) out.push({ kind: 'plate', key: 'platte', amount: ar.carry | 0 });
  }
  const b = bandagesOf(ctx, a);
  if (b > 0) out.push({ kind: 'bandage', key: 'verband', amount: b });
  const e = a.weapon && a.weapon.equipment;
  if (e && e.lethal && e.lethal.id && e.lethal.count > 0) out.push({ kind: 'grenade', key: e.lethal.id, amount: e.lethal.count });
  if (e && e.tactical && e.tactical.id && e.tactical.count > 0) out.push({ kind: 'grenade', key: e.tactical.id, amount: e.tactical.count });
  st.ammo = {};
  return out;
}

/** Startausrüstung: nur das Messer, keine Granaten, keine Weste, keine Verbände. */
export function strip(ctx, a) {
  const st = brState(a);
  st.ammo = {}; st.bandages = 0; st.healing = 0;
  a.armor = null;
  const w = a.weapon;
  if (w && typeof w.setLoadout === 'function') {
    try { w.setLoadout({ ...KNIFE_LOADOUT, ...(a.isPlayer ? { keepPickups: false } : {}) }); } catch (err) { console.error('[NULLPUNKT] BR Messer:', err); }
    if (w.equipment) { w.equipment.lethal = { id: null, count: 0 }; w.equipment.tactical = { id: null, count: 0 }; }
  }
  a.loadout = { ...(a.loadout || {}), ...KNIFE_LOADOUT };
  if (a.isPlayer && ctx.injuries) ctx.injuries.of(a).bandages = 0;
}
