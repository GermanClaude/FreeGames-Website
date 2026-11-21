// NULLPUNKT — Panzersimulation (Modus „Panzer“, modes/panzer.js): Munitionsarten, Panzerung nach Winkel, Durchschlag und
// Wirkung im Ziel. Nur im Modus aktiv – die normalen Modi behalten PG/SG aus data.js unverändert.
//
// Munition je Generation (frei erfundene Bezeichnungen, Werte an reale Klassen angelehnt):
//   modern (120 mm): Wuchtgeschoss (APFSDS, ~1650 m/s, Durchschlag ~600 mm RHA, verliert mit der Entfernung),
//                    Mehrzweck (HEAT-MP, Hohlladung ~500 mm unabhängig von der Entfernung, Splitter), Sprenggranate (HE,
//                    großer Splitterradius, kaum Durchschlag), Kanister (Wolframkugeln gegen Infanterie bis ~500 m)
//   2. WK (75/88 mm): Panzergranate (APCBC mit Sprengladung, Normalisierung, Abpraller ab ~70°), Hohlladung (langsam,
//                    flache Kurve fehlt → starker Fall), Sprenggranate, Kartätsche
//   1. WK (37/57 mm): Panzergranate (Vollgeschoss), Sprenggranate, Kartätsche
// Registrierung: je Panzertyp eigene Kennungen `psim_<typ>_<art>` in VEHICLE_WEAPONS (hinten angehängt; die Kennungen der
// übrigen Waffen und das Netz bleiben unberührt – der Modus ist nur offline). Felder wie data.js (speed, gravity, reload, …)
// plus `psim` = { art, pen0, penLoss, ke, norm, rico, dmgPen, dmgNo, cone, coneLen, filler, pellets }.
//
// Panzerung: D.armor (optional in data.js, Format unten) oder die Tabelle ARMOR je Typ, sonst Rückfall je Generation.
//   { hull: { front, side, rear, top }, turret: { … } } mit Fläche = [mm, Neigung°] oder { ke, ce, slope } (Verbund).
// Effektive Dicke = Nenndicke / cos(Auftreffwinkel zur geneigten Platte), Wucht-/Panzergranaten normalisieren um `norm`°.
import * as THREE from 'three';
import { VEHICLES, VEHICLE_WEAPONS } from '../data.js?v=20261121041936';
import { SHORT, gunSeat } from '../crew.js?v=20261121041936';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

/** Arten: Anzeige, Kurzzeichen, Rolle (ke = Wucht, ce = Hohlladung, he = Spreng, can = Schrot). */
export const KINDS = {
  wucht: { label: 'Wuchtgeschoss', short: 'WU', call: 'Wucht', role: 'ke', color: '#d9d2b0' },
  mz: { label: 'Mehrzweckgranate', short: 'MZ', call: 'Mehrzweck', role: 'ce', color: '#c9a04a' },
  spreng: { label: 'Sprenggranate', short: 'SP', call: 'Spreng', role: 'he', color: '#9bb06a' },
  kan: { label: 'Kanister', short: 'KA', call: 'Kanister', role: 'can', color: '#8fb3c9' },
  pzgr: { label: 'Panzergranate', short: 'PZ', call: 'Panzergranate', role: 'ke', color: '#d9d2b0' },
  hl: { label: 'Hohlladung', short: 'HL', call: 'Hohlladung', role: 'ce', color: '#c9a04a' },
  kart: { label: 'Kartätsche', short: 'KT', call: 'Kartätsche', role: 'can', color: '#8fb3c9' },
  // Strang panzermod-Typen (19.11.): Kalter Krieg (KP-68, 105 mm) und Schützenpanzer (SZ-8, 30 mm + Lenkflugkörper)
  tsg: { label: 'Treibspiegelgeschoss', short: 'TS', call: 'Treibspiegel', role: 'ke', color: '#d9d2b0' },
  qk: { label: 'Quetschkopfgranate', short: 'QK', call: 'Quetschkopf', role: 'he', color: '#b6a36a' },
  lfk: { label: 'Lenkflugkörper', short: 'LF', call: 'Lenkflugkörper', role: 'ce', color: '#c9a04a' },
};

export const ERA_KINDS = { modern: ['wucht', 'mz', 'spreng', 'kan'], wk2: ['pzgr', 'hl', 'spreng', 'kart'], wk1: ['pzgr', 'spreng', 'kart'] };
/** Eigene Sätze je Typ: KP-68 (1960er, 105 mm: Treibspiegel, Hohlladung, Quetschkopf, Kanister), SZ-8 (30-mm-Maschinenkanone). */
export const TYPE_KINDS = { kk: ['tsg', 'hl', 'qk', 'kan'], spz: ['wucht', 'spreng', 'lfk'] };
const TYPE_LOADOUT = { kk: { tsg: 0.4, hl: 0.25, qk: 0.25, kan: 0.1 }, spz: { wucht: 0.45, spreng: 0.53, lfk: 0.02 } };
// Fahrzeug-Strang 20.11. (data-troop.js): SP-58 (1950er, gezogene 120 mm: Panzergranate, Hohlladung, Quetschkopf, Spreng),
// RS-8 (30-mm-Maschinenkanone wie SZ-8, ohne Lenkflugkörper); Feinwerte je Typ über D.psimMods (registerAmmo)
Object.assign(TYPE_KINDS, { kks: ['pzgr', 'hl', 'qk', 'spreng'], rsp: ['wucht', 'spreng'] });
Object.assign(TYPE_LOADOUT, { kks: { pzgr: 0.42, hl: 0.22, qk: 0.16, spreng: 0.2 }, rsp: { wucht: 0.4, spreng: 0.6 } });
/** Gestellbelegung (Anteile) je Generation. */
const LOADOUT = {
  modern: { wucht: 0.42, mz: 0.32, spreng: 0.16, kan: 0.1 },
  wk2: { pzgr: 0.45, hl: 0.08, spreng: 0.42, kart: 0.05 },
  wk1: { pzgr: 0.35, spreng: 0.55, kart: 0.1 },
};
/** Ladezeit (s) mit Ladeschütze nach Kaliber (Handladen), ohne Ladeschützen (Kommandant/Richtschütze lädt) länger. */
const reloadFor = (cal) => (cal >= 110 ? 6.2 : cal >= 85 ? 6.0 : cal >= 70 ? 4.2 : cal >= 50 ? 4.6 : 3.0);

// Kalter Krieg (kk, Strang panzermod) nutzt den modernen Munitionssatz (Wucht/Hohlladung/Spreng/Kanister)
export const eraOf = (D) => { const e = (D && D.era) || 'modern'; return e === 'kk' ? 'modern' : e; };

/** Kaliber (mm) aus weaponMods-Namen („75 mm …“), sonst 120 (modern) bzw. 75. */
export function caliberOf(D) {
  const n = D && D.weaponMods && D.weaponMods.mbt_ap && /(\d+)\s*mm/.exec(D.weaponMods.mbt_ap.name || '');
  if (n) return +n[1];
  return eraOf(D) === 'modern' ? 120 : 75;
}

/** Daten einer Art für Kaliber/Generation. */
function kindSpec(kind, cal, era) {
  const k = cal / 75; // Bezug 75 mm
  if (cal <= 40 && era === 'modern') {
    // Maschinenkanone (SZ-8): Pfeilgeschoss und Spreng-Brand in Feuerstößen, Lenkflugkörper (langsam, Hohlladung)
    if (kind === 'wucht') return { speed: 1400, life: 1.6, pen0: 110, penLoss: 0.05, norm: 0, rico: 78, dmgPen: 70, dmgNo: 4, cone: 8, coneLen: 1.2, filler: 0, splash: { radius: 0.8, maxDamage: 25 }, actorDamage: 90, penetrating: true, reload: 0.3 };
    if (kind === 'spreng') return { speed: 1080, life: 2.2, pen0: 12, penLoss: 0, norm: 0, rico: 88, dmgPen: 40, dmgNo: 10, cone: 20, coneLen: 1.0, filler: 0.4, splash: { radius: 3.2, maxDamage: 75, innerRadius: 0.8, minDamage: 12 }, actorDamage: 110, penetrating: false, reload: 0.3 };
  }
  if (kind === 'lfk') return { speed: 260, gravity: 0.6, life: 9, pen0: 700, penLoss: 0, norm: 0, rico: 85, dmgPen: 380, dmgNo: 50, cone: 10, coneLen: 2.8, filler: 0, splash: { radius: 4, maxDamage: 150, innerRadius: 1.2, minDamage: 20 }, actorDamage: 210, penetrating: false, reload: 12 };
  if (kind === 'tsg') return { speed: 1470, life: 3.4, pen0: 300 * (cal / 105), penLoss: 0.03, norm: 2, rico: 75, dmgPen: 320, dmgNo: 12, cone: 16, coneLen: 2.8, filler: 0, splash: { radius: 2.2, maxDamage: 70 }, actorDamage: 230, penetrating: true };
  if (kind === 'qk') return { speed: 730, life: 5, pen0: 30, penLoss: 0, norm: 0, rico: 86, dmgPen: 240, dmgNo: 95, cone: 26, coneLen: 1.6, filler: 1.2, splash: { radius: 8, maxDamage: 200, innerRadius: 2, minDamage: 25 }, actorDamage: 220, penetrating: false };
  if (kind === 'hl' && era === 'modern') return { speed: 1170, life: 4, pen0: 3.6 * cal, penLoss: 0, norm: 0, rico: 82, dmgPen: 290, dmgNo: 35, cone: 9, coneLen: 2.4, filler: 0, splash: { radius: 6, maxDamage: 150, innerRadius: 1.5, minDamage: 22 }, actorDamage: 200, penetrating: false };
  const base = (VEHICLES.wk2 && VEHICLES.wk2.weaponMods) || {};
  switch (kind) {
    case 'wucht': return { speed: 1650, life: 3.2, pen0: 600 * (cal / 120), penLoss: 0.04, norm: 0, rico: 80, dmgPen: 360, dmgNo: 14, cone: 14, coneLen: 3.2, filler: 0, splash: { radius: 2.2, maxDamage: 70 }, actorDamage: 260, penetrating: true };
    case 'mz': return { speed: 1140, life: 3.6, pen0: 500 * (cal / 120), penLoss: 0, norm: 0, rico: 82, dmgPen: 300, dmgNo: 40, cone: 9, coneLen: 2.6, filler: 0, splash: { radius: 7, maxDamage: 165, innerRadius: 1.8, minDamage: 25 }, actorDamage: 220, penetrating: false };
    case 'spreng': {
      if (era === 'modern') return { speed: 960, life: 4.5, pen0: 45, penLoss: 0, norm: 0, rico: 88, dmgPen: 260, dmgNo: 70, cone: 30, coneLen: 1.8, filler: 1, splash: { radius: 11, maxDamage: 230, innerRadius: 2.4, minDamage: 30 }, actorDamage: 240, penetrating: false };
      const he = base.mbt_he || {};
      const sp = era === 'wk1' ? (cal < 45 ? 360 : 400) : cal >= 85 ? 520 : (he.speed || 460);
      return { speed: sp, life: 6, pen0: 10 * k, penLoss: 0, norm: 0, rico: 88, dmgPen: 160 * k, dmgNo: 45 * k, cone: 30, coneLen: 1.5, filler: 1, splash: { radius: 4 + 3.4 * k, maxDamage: 110 + 60 * k, innerRadius: 1.0 + 0.6 * k, minDamage: 15 }, actorDamage: 160 + 40 * k, penetrating: false };
    }
    case 'kan': return { speed: 1400, life: 0.5, pellets: 40, spreadRad: 0.032, pelletRange: 520, pelletDmg: 75, pen0: 5, penLoss: 0, rico: 90, dmgPen: 0, dmgNo: 4, cone: 0, coneLen: 0, filler: 0, splash: { radius: 0.5, maxDamage: 0 }, actorDamage: 0, penetrating: false };
    case 'kart': return { speed: era === 'wk1' ? 420 : 600, life: 0.5, pellets: 24, spreadRad: 0.05, pelletRange: 240, pelletDmg: 55 + 15 * k, pen0: 3, penLoss: 0, rico: 90, dmgPen: 0, dmgNo: 3, cone: 0, coneLen: 0, filler: 0, splash: { radius: 0.5, maxDamage: 0 }, actorDamage: 0, penetrating: false };
    case 'hl': return { speed: cal >= 85 ? 600 : 450, life: 6, pen0: 80 * k, penLoss: 0, norm: 0, rico: 80, dmgPen: 230 * k, dmgNo: 30, cone: 9, coneLen: 2.0, filler: 0, splash: { radius: 4.5, maxDamage: 120, innerRadius: 1.2, minDamage: 15 }, actorDamage: 190, penetrating: false };
    case 'pzgr':
    default: {
      // Panzergranate: Durchschlag nach Kaliber/Mündungsgeschwindigkeit; 2. WK mit Haube und Sprengladung (filler)
      const D0 = era === 'wk1' ? (cal < 45 ? { v: 380, p: 26 } : { v: 480, p: 48 }) : cal >= 85 ? { v: 780, p: 165 } : { v: 620, p: 102 };
      return { speed: D0.v, life: 6, pen0: D0.p, penLoss: era === 'wk1' ? 0.012 : 0.02, norm: era === 'wk1' ? 2 : 4, rico: era === 'wk1' ? 62 : 70, dmgPen: (era === 'wk1' ? 220 : 300) * Math.sqrt(k), dmgNo: 14, cone: 22, coneLen: 2.2, filler: era === 'wk1' ? 0 : 1.6, splash: { radius: 2.0, maxDamage: 70 }, actorDamage: 200, penetrating: true };
    }
  }
}

const REG = new Map(); // Typ → [Kennung …]

/** Munition eines Panzertyps anlegen (einmal je Typ) → Liste der Kennungen in Gestellreihenfolge. */
export function registerAmmo(type) {
  if (REG.has(type)) return REG.get(type);
  const D = VEHICLES[type];
  const era = eraOf(D), cal = caliberOf(D);
  const list = [];
  for (const kind of TYPE_KINDS[type] || ERA_KINDS[era] || ERA_KINDS.modern) {
    const s = kindSpec(kind, cal, era), K = KINDS[kind];
    if (D.psimMods && D.psimMods[kind]) Object.assign(s, D.psimMods[kind]); // Feinwerte je Typ (data-troop.js)
    const id = `psim_${type}_${kind}`;
    const rl = s.reload || reloadFor(cal);
    VEHICLE_WEAPONS[id] = {
      id, name: kind === 'lfk' ? K.label : `${cal} mm ${K.label}`, short: K.short, kind: 'shell', icon: 'shell',
      speed: s.speed, gravity: s.gravity ?? 9.81, reload: rl, reloadNoLoader: s.reload ? rl : rl * 1.7, mag: 1, life: s.life,
      vehicleDamage: s.dmgPen, actorDamage: s.actorDamage, splash: s.splash, penetrating: s.penetrating,
      shake: clamp(cal / 220, 0.2, 0.6), selfSafe: 0.3,
      psim: { kind, role: K.role, cal, era, ...s },
    };
    SHORT[id] = K.short;
    list.push(id);
  }
  // Schrotkugel (Kanister/Kartätsche) als Hitscan-Waffe (Trefferauswertung wie MG)
  const pid = `psim_${type}_kugel`;
  const kin = list.map((id) => VEHICLE_WEAPONS[id]).find((w) => w.psim.pellets);
  if (kin) {
    VEHICLE_WEAPONS[pid] = {
      id: pid, name: KINDS[kin.psim.kind].label, short: KINDS[kin.psim.kind].short, kind: 'mg', caliber: '762x51',
      rpm: 60, mag: 1, reload: 1, spread: 0, range: kin.psim.pelletRange, profile: 'lmg', icon: 'shell',
      damage: { max: kin.psim.pelletDmg, min: kin.psim.pelletDmg * 0.4, rangeStart: 40, rangeEnd: kin.psim.pelletRange }, headMult: 1.4, limbMult: 0.85, penetration: 0.3,
      vehicleMult: 0.05, tracerEvery: 99,
    };
  }
  REG.set(type, list);
  return list;
}

/** Gestellbelegung nach Generation (Summe = Gestell des Panzers aus data.js). */
export function rackFor(type) {
  const D = VEHICLES[type], ids = registerAmmo(type);
  const total = Object.values(D.ammo || { a: 40 }).reduce((a, b) => a + b, 0);
  const L = TYPE_LOADOUT[type] || LOADOUT[eraOf(D)] || LOADOUT.modern, out = {};
  let used = 0;
  ids.forEach((id, i) => {
    const kind = VEHICLE_WEAPONS[id].psim.kind;
    const n = i === ids.length - 1 ? Math.max(2, total - used) : Math.max(2, Math.round(total * (L[kind] || 0.2)));
    out[id] = n; used += n;
  });
  return out;
}

/**
 * Panzer mit der Modus-Munition ausrüsten: Richtschützensitz bekommt alle Arten (vor dem MG), Gestell neu belegt,
 * erste Art (Wucht/Panzergranate) geladen. Modelldarstellung (Gestell/Granate in der Hand) über die Grundsorten PG/SG.
 */
export function equipTank(v) {
  const g = v.gun, gs = gunSeat(v);
  if (!g || !gs) return null;
  const ids = registerAmmo(v.type);
  const mg = gs.weapons.filter((w) => w.def.kind !== 'shell');
  gs.weapons = [...ids.map((id) => ({ def: VEHICLE_WEAPONS[id], mag: 1, reserve: null, reloadT: 0, cooldown: 0, shots: 0 })), ...mg];
  gs.weaponIndex = 0;
  gs._shellWish = ids[0];
  g.rack = rackFor(v.type);
  g.rack[ids[0]] = Math.max(0, g.rack[ids[0]] - 1);
  g.loaded = ids[0]; g.select = ids[0]; g.step = 'geladen'; g.breechOpen = false; g.held = null; g.auto = false;
  v._psimAmmo = ids;
  // Gestell-/Granatendarstellung: Arten auf die beiden Modellsorten abbilden (models.js kennt nur mbt_ap/mbt_he)
  const M = v.model, baseOf = (id) => (id && VEHICLE_WEAPONS[id] && VEHICLE_WEAPONS[id].psim ? (VEHICLE_WEAPONS[id].psim.role === 'ke' ? 'mbt_ap' : 'mbt_he') : id);
  if (M && !M._psimWrapped) {
    M._psimWrapped = true;
    const oRack = M.setRack, oHeld = M.setHeld, oAnim = M.setLoadAnim;
    if (oRack) M.setRack = (c) => { const o = { mbt_ap: 0, mbt_he: 0 }; for (const [k, n] of Object.entries(c || {})) { const b = baseOf(k); if (b in o) o[b] += n | 0; } return oRack(o); };
    if (oHeld) M.setHeld = (t) => oHeld(baseOf(t));
    if (oAnim) M.setLoadAnim = (k, p, t, ...r) => oAnim(k, p, baseOf(t), ...r);
  }
  return ids;
}

/** Art einer Munitionskennung (oder null). */
export const kindOf = (id) => (id && VEHICLE_WEAPONS[id] && VEHICLE_WEAPONS[id].psim ? VEHICLE_WEAPONS[id].psim.kind : null);
/** Kennung einer Art für einen Panzer. */
export const idFor = (v, kind) => (v && v._psimAmmo ? v._psimAmmo.find((id) => kindOf(id) === kind) || null : null);

/* ===================================================================== Panzerung */

// [mm, Neigung° von der Senkrechten]; Verbund modern als { ke, ce } (bereits wirksame Werte, Neigung 0)
export const ARMOR = {
  mbt: {
    hull: { front: { ke: 560, ce: 760, slope: 0 }, side: { ke: 75, ce: 240, slope: 0 }, rear: [40, 0], top: [35, 0] },
    turret: { front: { ke: 640, ce: 920, slope: 0 }, side: { ke: 200, ce: 300, slope: 0 }, rear: [50, 0], top: [45, 0] },
  },
  wk2: { hull: { front: [51, 56], side: [38, 0], rear: [38, 10], top: [19, 0] }, turret: { front: [80, 30], side: [51, 5], rear: [51, 0], top: [25, 0] } },
  wk2h: { hull: { front: [100, 9], side: [80, 0], rear: [80, 8], top: [25, 0] }, turret: { front: [120, 0], side: [80, 0], rear: [80, 0], top: [25, 0] } },
  wk1: { hull: { front: [30, 15], side: [20, 0], rear: [20, 0], top: [10, 0] }, turret: { front: [30, 0], side: [15, 0], rear: [15, 0], top: [10, 0] } },
  wk1l: { hull: { front: [16, 30], side: [16, 0], rear: [16, 0], top: [8, 0] }, turret: { front: [22, 0], side: [16, 0], rear: [16, 0], top: [8, 0] } },
};
const ERA_ARMOR = { modern: ARMOR.mbt, wk2: ARMOR.wk2, wk1: ARMOR.wk1 };

export function armorOf(D) {
  return (D && (D.armor || ARMOR[D.id])) || (D && D.psimArmor) || ERA_ARMOR[eraOf(D)] || ARMOR.wk2;
}
function plateOf(D, part, face) {
  const A = armorOf(D), P = (A[part] || A.hull || {})[face] || (A.hull || {})[face] || [20, 0];
  if (Array.isArray(P)) return { ke: P[0], ce: P[0], slope: P[1] || 0 };
  return { ke: P.ke ?? P.mm ?? 20, ce: P.ce ?? P.ke ?? 20, slope: P.slope || 0 };
}

/**
 * Durchschlagsrechnung (rein): Granate (def.psim), Treffer (hit mit localNormal/face/zone), Flugrichtung (Welt), Entfernung.
 * → { eff, pen, thetaDeg, rico, pen: bool, plate, part }
 */
export function penetration(v, def, hit, dir, dist) {
  const P = def.psim, D = v.def;
  const part = hit.zone === 'turret' ? 'turret' : 'hull';
  const face = hit.face || 'side';
  const pl = plateOf(D, part, face);
  // Flugrichtung im Fahrzeugraum, Platten-Normale geneigt (front/rear/side kippen nach oben)
  _q.copy(v.body.quat).invert();
  const dl = _a.copy(dir).applyQuaternion(_q).normalize();
  const nl = _n.copy(hit.localNormal || _b.set(0, 0, -1));
  if (face !== 'top' && pl.slope) {
    const s = pl.slope * DEG;
    nl.multiplyScalar(Math.cos(s)).addScaledVector(UP, Math.sin(s)).normalize();
  }
  const cosT = clamp(-dl.dot(nl), 0.01, 1);
  let theta = Math.acos(cosT) / DEG;
  const rico = theta > (P.rico || 75) && P.role !== 'he';
  const thetaN = Math.max(0, theta - (P.norm || 0));
  const thick = P.role === 'ce' ? pl.ce : P.role === 'he' ? pl.ke * 1.0 : pl.ke;
  const eff = thick / Math.max(0.08, Math.cos(thetaN * DEG));
  const penMm = Math.max(0, (P.pen0 - (P.penLoss || 0) * Math.max(0, dist - 100)) * (0.95 + Math.random() * 0.1));
  return { eff, penMm, theta, rico, penetrated: !rico && penMm >= eff, part, face, plate: pl };
}

/* ===================================================================== Wirkung im Ziel */

const MODS = ['motor', 'ketten', 'turm', 'optik', 'rohr', 'munition', 'funk'];
export const MOD_LABEL = { motor: 'Motor', ketten: 'Ketten', turm: 'Turmantrieb', optik: 'Optik', rohr: 'Rohr', munition: 'Munition', funk: 'Funk', brand: 'Brand' };

/** Modulzustand eines Fahrzeugs (1 = heil, 0.5 = beschädigt, 0 = zerstört), Besatzung virtuell für Feinde. */
export function modsOf(v) {
  if (!v._psimMods) {
    v._psimMods = {};
    for (const k of MODS) v._psimMods[k] = 1;
    v._psimMods.brand = 0;
  }
  return v._psimMods;
}
/** Virtuelle Besatzung (alle Sitze; Feinde haben nur einen Bot an Bord – die übrigen Plätze rechnen wir hier). */
export function crewOf(v) {
  if (!v._psimCrew) v._psimCrew = v.seats.map((s) => ({ seat: s.index, role: s.def.id, label: s.def.label, hp: 100, state: 'ok' }));
  return v._psimCrew;
}

/** Sitzlage (Welt, Brusthöhe) eines Platzes. */
function seatWorld(v, s, out) {
  return v.body.toWorld(out.fromArray(s.def.pos).add(_c.set(0, 0.65, 0)), out);
}

/**
 * Wirkung eines Durchschlags/Treffers: Module + Besatzung. Liefert Notizen (deutsch) für Meldungen.
 * info: { attacker, weaponId, point (Welt), dir (Welt), def, res (penetration), damage }
 */
export function applyEffects(sys, v, info) {
  const G = sys.G, P = info.def.psim, res = info.res, mods = modsOf(v), crew = crewOf(v), notes = [];
  const pt = info.point, d = info.dir;
  const local = v.body.toLocal(_b.copy(pt), new THREE.Vector3());
  const D = v.def, hb = D.hullBox;
  const rnd = Math.random;
  const hurt = (k, amt, note) => {
    const was = mods[k];
    mods[k] = Math.max(0, mods[k] - amt);
    if (was > 0 && mods[k] <= 0) notes.push(`${MOD_LABEL[k]} zerstört`);
    else if (was >= 1 && mods[k] < 1) notes.push(note || `${MOD_LABEL[k]} beschädigt`);
  };
  if (!res.penetrated) {
    // außen: Ketten/Optik/Rohr können auch ohne Durchschlag leiden (Sprengwirkung, Splitter, Wucht am Laufwerk)
    const he = P.role === 'he' || P.role === 'ce';
    if (info.hit.zone === 'tracks' && rnd() < (he ? 0.7 : 0.45)) hurt('ketten', 1, 'Kette getroffen');
    if (res.part === 'turret' && res.face === 'front' && rnd() < (he ? 0.3 : 0.12)) hurt('optik', he ? 1 : 0.5);
    if (res.part === 'turret' && res.face === 'front' && rnd() < 0.08) hurt('rohr', 0.5, 'Rohr getroffen');
    return notes;
  }
  // Durchschlag: Module nach Lage
  const engineBay = local.z > hb[2] + hb[5] * 0.4;
  if (engineBay || info.hit.zone === 'engine') { hurt('motor', P.role === 'he' ? 0.6 : 1); if (rnd() < 0.35) { mods.brand = Math.max(mods.brand, 1); notes.push('Motorraum brennt'); } }
  if (info.hit.zone === 'tracks') hurt('ketten', 1, 'Kette gerissen');
  if (res.part === 'turret') {
    if (rnd() < 0.45) hurt('turm', 0.6, 'Turmantrieb beschädigt');
    if (res.face === 'front' && rnd() < 0.4) hurt('optik', 1);
    if (rnd() < 0.2) hurt('rohr', 0.6, 'Rohrwiege getroffen');
  }
  if (rnd() < 0.15) hurt('funk', 1, 'Funk ausgefallen');
  // Besatzung im Splitterkegel / in der Sprengkugel
  const cosCone = Math.cos(Math.max(4, P.cone || 15) * DEG);
  const far = (P.coneLen || 2.5) + 0.6;
  const fill = P.filler || 0;
  const burst = fill ? _a.copy(pt).addScaledVector(d, 0.9) : null;
  for (const s of v.seats) {
    const c = crew[s.index];
    if (!c || c.state === 'tot') continue;
    const sp = seatWorld(v, s, new THREE.Vector3());
    const to = sp.clone().sub(pt), dist = to.length();
    let dmg = 0;
    if (dist < far && to.normalize().dot(d) > cosCone) dmg = Math.max(dmg, (P.role === 'ke' ? 140 : 160) * (1 - dist / (far + 0.5)) + 30);
    else if (dist < far * 0.75 && to.dot(d) > 0.2) dmg = Math.max(dmg, 45 * (1 - dist / far)); // Abplatzungen
    if (burst) { const bd = sp.distanceTo(burst); if (bd < fill) dmg = Math.max(dmg, 150 * (1 - bd / fill) + 25); }
    if (dmg <= 0) continue;
    dmg *= 0.75 + rnd() * 0.5;
    const a = s.actor;
    // KI-Panzer (EnemyTank, ein Bot fährt und richtet für alle): nur die virtuelle Besatzung wird getroffen – sonst legte ein
    // Splitter am Fahrersitz den ganzen Panzer still (der Bot steht stellvertretend für Fahrer und Richtschütze)
    if (a && a.alive && G.combat && !v._psimAI) {
      const inv = a.invulnerable;
      // Spieler (Nutzer 21.11.: „kein Sofort-Tod“): Splitterschutzauskleidung/Helm mindern; ein tödlicher Treffer macht ihn
      // höchstens alle 30 s nur schwer verwundet (Besatzungsausfälle statt Rundenende) – Munitionsbrand bleibt tödlich
      if (a.isPlayer) {
        dmg *= 0.6;
        const now = G.time.elapsed;
        if (dmg >= a.health && a.health > 15 && now - (a._psimSaved || -1e9) > 30) { a._psimSaved = now; dmg = a.health - 12; notes.push('Du bist schwer verwundet'); }
      }
      a.invulnerable = false;
      try { G.combat.damage(a, { amount: Math.round(dmg), attacker: info.attacker || null, weaponId: info.weaponId, explosive: true, point: pt.clone(), zone: 'body' }); } catch { /* */ }
      if (a.alive) a.invulnerable = inv;
      c.hp = a.alive ? Math.min(c.hp, (a.health / (a.maxHealth || 100)) * 100) : 0;
    } else c.hp -= dmg;
    const was = c.state;
    c.state = c.hp <= 0 || (a && !a.alive) ? 'tot' : c.hp < 60 ? 'verwundet' : 'ok';
    if (c.state !== was) notes.push(`${c.label} ${c.state === 'tot' ? 'ausgefallen' : 'verwundet'}`);
  }
  // Munition: Treffer nahe am Gestell (Turmraum bzw. Wanne) → Zündung (modern: Bunker mit Sprengklappen)
  const g = v.gun;
  if (g && D.turretPivot && mods.munition > 0) {
    const I = D.interior || {}, rk = I.rack || [0, 0.45, 1.55], sh = I.shift || [0, 0, 0], sc = I.scale || 1;
    _q.setFromAxisAngle(UP, v.mount.turretYaw);
    const rp = _c.set(rk[0] * sc + sh[0], rk[1] * sc + sh[1], rk[2] * sc + sh[2]).applyQuaternion(_q).add(_b.fromArray(D.turretPivot));
    v.body.toWorld(rp, rp);
    const n = Object.values(g.rack).reduce((x, y) => x + (y | 0), 0);
    const near = rp.distanceTo(pt) < 1.6 || (burst && rp.distanceTo(burst) < 1.6);
    if (near && n > 0 && rnd() < (P.role === 'ke' ? 0.45 : P.role === 'ce' ? 0.6 : 0.3) * Math.min(1, 0.4 + n / 14)) {
      if (I.blastDoor && g.step !== 'offen' && g.busyKind !== 'tuer' && g.busyKind !== 'greifen') {
        for (const k of Object.keys(g.rack)) g.rack[k] = 0;
        mods.munition = 0;
        notes.push('Munitionsbunker getroffen – Sprengklappen haben gehalten');
        G.effects?.explosion?.(rp.clone(), 3);
      } else {
        notes.push('Munition gezündet!');
        mods.munition = 0;
        v._ammoRack = true;
        v._psimCookoff = true;
      }
    }
  }
  return notes;
}

/** Ausgefallen? (Feind: Fahrer + Richtschütze tot oder ≥ 60 % der Besatzung; Munition gezündet) */
export function knockedOut(v) {
  if (v._psimCookoff) return 'Munition';
  const crew = v._psimCrew;
  if (!crew || !crew.length) return null;
  // Spielerpanzer: Besatzungsausfälle legen ihn nicht still – der Spieler kann den Platz wechseln (Sitzrad)
  if (v.seats.some((s) => s.actor && s.actor.isPlayer && s.actor.alive)) return null;
  // KI-Panzer: fällt der Bot an Bord (fährt und richtet stellvertretend), steht der Panzer still und schweigt → ausgefallen
  const ai = v._psimAI;
  if (ai && !(ai.bot && ai.bot.alive && ai.bot.vehicle === v)) return 'Besatzung';
  const dead = crew.filter((c) => c.state === 'tot').length;
  const dr = crew.find((c) => c.role === 'driver'), gu = crew.find((c) => c.role === 'gunner');
  if ((dr && dr.state === 'tot' && gu && gu.state === 'tot') || dead / crew.length >= 0.6) return 'Besatzung';
  return null;
}
