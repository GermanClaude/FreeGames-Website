// NULLPUNKT — Battle Royale: Beute-Gegenstände und Beutetabellen (reine Daten + Hilfen, ohne three.js/DOM – in Node prüfbar).
//
// Gegenstand: { kind, key, amount } – kind 'weapon' (key = Waffen-Id, amount = Patronen im Magazin), 'ammo' (key = Munitionsart,
// amount = Patronen), 'vest' (key = Westenstufe leicht|mittel|schwer), 'helmet' (standard|schwer), 'bandage' (amount = Anzahl),
// 'grenade' (key = frag|smoke, amount), 'plate' (amount = Platten).
// Munitionsarten je Waffe: ammoTypeOf(def). Seltene Waffen (shared/weapons-br.data.js) liegen nur an wenigen besonderen Orten.

/** Munitionsarten: Name, Patronen je Packung, Höchstvorrat (Rucksack). */
export const AMMO_TYPES = {
  pistole: { name: 'Pistolenmunition', pack: 40, max: 240 },
  gewehr: { name: 'Gewehrmunition', pack: 45, max: 270 },
  schwer: { name: 'Schwere Munition', pack: 10, max: 60 },
  schrot: { name: 'Schrotpatronen', pack: 12, max: 72 },
  granate: { name: '40-mm-Granaten', pack: 3, max: 15 },
  bolzen: { name: 'Armbrustbolzen', pack: 4, max: 24 },
};

export const VEST_NAMES = { leicht: 'Leichte Schutzweste', mittel: 'Schutzweste', schwer: 'Schwere Schutzweste' };
export const HELMET_NAMES = { standard: 'Gefechtshelm', schwer: 'Schwerer Helm' };
export const VEST_RANK = { keine: 0, leicht: 1, mittel: 2, schwer: 3 };
export const HELMET_RANK = { keine: 0, standard: 1, schwer: 2 };
export const GRENADE_MAX = 3;
export const BANDAGE_MAX = 8;

/** Munitionsart einer Waffendefinition. */
export function ammoTypeOf(def) {
  if (!def || !(def.mag > 0) || def.cls === 'melee') return null;
  if (def.projectile && def.projectile.bolt) return 'bolzen';
  if (def.cls === 'launcher') return def.projectile && def.projectile.grenade ? 'granate' : 'granate';
  if (def.cls === 'shotgun') return 'schrot';
  if (def.cls === 'pistol' || def.cls === 'smg') return 'pistole';
  if (def.cls === 'sniper' || def.antiMateriel || def.caliber === '50bmg') return 'schwer';
  return 'gewehr';
}

/** Gewöhnliche Bodenbeute: Gewicht je Waffenklasse (Klasse fehlt = gar nicht). */
const CLASS_WEIGHT = { ar: 1.0, smg: 1.15, pistol: 1.3, shotgun: 0.8, marksman: 0.55, sniper: 0.3, lmg: 0.35, launcher: 0.1 };
/** Waffen, die nie auf dem Boden liegen (Waffen der ersten Stunde, Panzerabwehr, Gatling – zu stark bzw. Klasse). */
const NEVER = new Set(['ar_ursprung', 'pi_funke', 'erstlicht', 'at_donner', 'hmg_orkan']);

/** Gewichtete Waffenliste aus der Waffentabelle (ohne BR-Sonderwaffen). → [[id, w], …] */
export function weaponPool(WEAPONS, ids) {
  const out = [];
  for (const id of ids || Object.keys(WEAPONS)) {
    const d = WEAPONS[id];
    if (!d || d.brOnly || d.og || NEVER.has(id) || d.cls === 'melee' || !(d.mag > 0)) continue;
    const w = CLASS_WEIGHT[d.cls];
    if (w) out.push([id, w * (d.botWeight != null && d.botWeight < 1 ? 0.6 : 1)]);
  }
  return out;
}

function pickW(list, rng) {
  let sum = 0;
  for (const [, w] of list) sum += w;
  let r = rng() * sum;
  for (const e of list) { r -= e[1]; if (r <= 0) return e[0]; }
  return list.length ? list[list.length - 1][0] : null;
}

/**
 * Inhalt eines Beutepunkts (1–3 Gegenstände). indoor: in Gebäuden etwas reichhaltiger. → [{ kind, key, amount }]
 * Tabelle (je Gegenstand): Waffe 30 %, Munition 26 %, Verband 15 %, Weste 7 %, Helm 6 %, Granate 10 %, Platte 6 %.
 */
export function rollSpot(rng, pool, WEAPONS, { indoor = false } = {}) {
  const n = 1 + (rng() < (indoor ? 0.55 : 0.35) ? 1 : 0) + (indoor && rng() < 0.2 ? 1 : 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = rng();
    if (r < 0.3) {
      const id = pickW(pool, rng);
      const d = id && WEAPONS[id];
      if (!d) continue;
      out.push({ kind: 'weapon', key: id, amount: d.mag });
      // Passende Munition liegt oft daneben
      const t = ammoTypeOf(d);
      if (t && rng() < 0.6) out.push({ kind: 'ammo', key: t, amount: AMMO_TYPES[t].pack });
    } else if (r < 0.56) {
      const t = pickW([['pistole', 1], ['gewehr', 1.1], ['schrot', 0.5], ['schwer', 0.22], ['granate', 0.08]], rng);
      out.push({ kind: 'ammo', key: t, amount: AMMO_TYPES[t].pack });
    } else if (r < 0.71) out.push({ kind: 'bandage', key: rng() < 0.2 ? 'tasche' : 'verband', amount: 0 });
    else if (r < 0.78) out.push({ kind: 'vest', key: pickW([['leicht', 1], ['mittel', 0.55], ['schwer', 0.18]], rng), amount: 0 });
    else if (r < 0.84) out.push({ kind: 'helmet', key: rng() < 0.25 ? 'schwer' : 'standard', amount: 0 });
    else if (r < 0.94) out.push({ kind: 'grenade', key: rng() < 0.7 ? 'frag' : 'smoke', amount: 1 });
    else out.push({ kind: 'plate', key: 'platte', amount: 1 });
  }
  for (const it of out) if (it.kind === 'bandage') it.amount = it.key === 'tasche' ? 4 : 2;
  return out;
}

/** Anzeigename eines Gegenstands (deutsch; Übersetzung über tx). */
export function itemName(it, WEAPONS) {
  switch (it.kind) {
    case 'weapon': return (WEAPONS[it.key] && WEAPONS[it.key].name) || it.key;
    case 'ammo': return AMMO_TYPES[it.key] ? AMMO_TYPES[it.key].name : 'Munition';
    case 'vest': return VEST_NAMES[it.key] || 'Schutzweste';
    case 'helmet': return HELMET_NAMES[it.key] || 'Helm';
    case 'bandage': return it.key === 'tasche' ? 'Sanitätstasche' : 'Verbandspäckchen';
    case 'grenade': return it.key === 'smoke' ? 'Rauchgranate' : 'Splittergranate';
    case 'plate': return 'Schutzplatte';
    default: return 'Beute';
  }
}

/** Grober Kampfwert einer Waffe für Bots (höher = lieber). */
export function weaponValue(def) {
  if (!def || def.cls === 'melee') return 0;
  const base = { ar: 7, smg: 6.2, lmg: 7.2, marksman: 6.4, sniper: 6, shotgun: 5.6, pistol: 3, launcher: 3.5 }[def.cls] || 4;
  return base + (def.brOnly ? 2.2 : 0) + (def.unlockLevel || 1) * 0.02;
}
