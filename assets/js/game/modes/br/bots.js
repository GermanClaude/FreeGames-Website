// NULLPUNKT — Battle Royale: Verhalten der KI-Bots über der normalen Bot-KI (bots/ai/brain.js).
// Die Bot-KI kämpft, deckt sich, wirft Granaten wie immer; der Modus liefert ihr über objectiveFor(bot) ein Ziel:
//   • Beute: lohnendster freier Gegenstand im Umkreis (Nutzen aus inventory.value, geteilt durch die Entfernung) – reserviert,
//     damit nicht drei Bots zur selben Kiste laufen; in Griffweite (1,7 m) nimmt der Bot ihn auf.
//   • Zone: außerhalb des angekündigten Kreises (oder wenn es knapp wird) ein Punkt im nächsten Kreis.
//   • sonst ab und zu nichts (dann sucht die Bot-KI selbst: Gefechtslärm, Umherziehen) – der Zonenpunkt holt sie zurück.
// Dazu je Bot alle ~0,6 s: leere Waffe wechseln bzw. wegwerfen, ohne Feind in Ruhe verbinden (Verband: +30 Leben in 2,5 s).
// Ferne Bots (Simulationsstufe ≥ 2 des Bot-Managers) werden seltener verwaltet und schauen nur 30 m weit nach Beute.
import * as THREE from 'three';
import { take, value, guns, bandagesOf, setBandages, setGuns, ammoCount } from './inventory.js?v=20261123115551';
import { ammoTypeOf } from './items.js?v=20261123115551';

const PICK_R = 1.7;
const HEAL = 30, HEAL_TIME = 2.5;
const _v = new THREE.Vector3();

export class BrBots {
  constructor(mode) {
    this.mode = mode;
    this.G = mode.G;
    this._i = 0;
  }

  get ctx() { return this.mode.ctx; }

  /** Gestaffelte Verwaltung (je Bild ein Teil der Bots). */
  tick(dt) {
    const G = this.G, M = this.mode;
    const bots = (G.bots && G.bots.bots) || [];
    if (!bots.length) return;
    const now = G.time.elapsed;
    const n = Math.max(1, Math.ceil(bots.length * dt / 0.6));
    for (let k = 0; k < n; k++) {
      const b = bots[this._i++ % bots.length];
      if (!b || !b.alive || b.puppet || M.airborne(b)) continue;
      if ((b.simTier | 0) >= 2 && now < (b._brNext || 0)) continue;
      b._brNext = now + 1.6;
      this.manage(b, now);
    }
    // Aufnahme in Griffweite und laufende Verbände: jedes Bild billig
    for (const b of bots) {
      if (!b.alive || b.puppet || M.airborne(b)) continue;
      const st = b._br;
      if (st && st.healing && now >= st.healing) {
        st.healing = 0;
        if (b.alive && now - (b.lastDamageTime || -1e9) > 1.5) b.health = Math.min(b.maxHealth, b.health + HEAL);
      }
      const t = b._brTarget;
      if (t && !t.taken && Math.hypot(t.position.x - b.position.x, t.position.z - b.position.z) < PICK_R && Math.abs(t.position.y - b.position.y) < 1.6) {
        this.pickup(b, t);
      }
    }
  }

  pickup(b, it) {
    const M = this.mode;
    b._brTarget = null;
    if (it.claim === b) it.claim = null;
    const r = take(this.ctx, b, it);
    if (!r.ok) { it.ignore = it.ignore || new Set(); it.ignore.add(b); return false; }
    M.loot.take(it);
    if (r.drop && r.drop.length) M.loot.scatter(r.drop, b.position);
    b._objAt = 0; // sofort neues Ziel
    return true;
  }

  manage(b, now) {
    const M = this.mode, L = M.loot, w = b.weapon;
    // --- Waffe: leere gehaltene Waffe → andere mit Munition; alles leer → wegwerfen (Messer)
    if (w && w.slots) {
      const g = guns(b);
      const cur = w.current;
      const empty = (s) => (s.mag | 0) <= 0 && (s.reserve | 0) <= 0;
      if (cur && cur.def && cur.def.cls !== 'melee' && empty(cur)) {
        const other = g.find((s) => s !== cur && !empty(s));
        if (other) { const i = w.slots.indexOf(other); if (i >= 0 && typeof w.switchTo === 'function') { try { w.switchTo(i); } catch { /* */ } } }
        else if (!w.isReloading) {
          // Rucksack-Munition dieser Art nachfüllen, sonst wegwerfen
          const t = ammoTypeOf(cur.def), st = b._br;
          if (t && st && st.ammo[t] > 0) { cur.reserve += st.ammo[t]; st.ammo[t] = 0; }
          else {
            const keep = g.filter((s) => !empty(s)).map((s) => s.id);
            L.scatter(g.filter((s) => empty(s)).map((s) => ({ kind: 'weapon', key: s.id, amount: 0 })), b.position);
            setGuns(this.ctx, b, keep);
          }
        }
      }
    }
    // --- Verband in Ruhe
    const st = b._br;
    if (st && !st.healing && b.health < b.maxHealth - 25 && bandagesOf(this.ctx, b) > 0 && now - (b.lastDamageTime || -1e9) > 4 && !(b.gunner && b.gunner.rec && b.gunner.rec.visible)) {
      setBandages(this.ctx, b, bandagesOf(this.ctx, b) - 1);
      st.healing = now + HEAL_TIME;
    }
    // --- Beuteziel
    const t = b._brTarget;
    if (t && (t.taken || (t.claim && t.claim !== b && now < t.claimUntil))) b._brTarget = null;
    if (b._brTarget && now < (b._brTargetUntil || 0)) return;
    const far = (b.simTier | 0) >= 2;
    const R = far ? 30 : 48;
    let best = null, bs = 0.35;
    const z = M.zone;
    const urgent = z && !z.inNext(b.position.x, b.position.z, 4) && z.state === 'schrumpfen';
    for (const it of L.items) {
      if (it.taken || (it.claim && it.claim !== b && now < it.claimUntil) || (it.ignore && it.ignore.has(b))) continue;
      const dx = it.position.x - b.position.x, dz = it.position.z - b.position.z;
      if (Math.abs(dx) > R || Math.abs(dz) > R) continue;
      const d = Math.hypot(dx, dz);
      if (d > R || Math.abs(it.position.y - b.position.y) > 7) continue;
      if (z && z.outside(it.position.x, it.position.z) > 0) continue; // nichts außerhalb der Zone holen
      if (urgent && !z.inNext(it.position.x, it.position.z, 2)) continue;
      const v = value(this.ctx, b, it);
      if (v <= 0) continue;
      const s = v / (1 + d / 14);
      if (s > bs) { bs = s; best = it; }
    }
    if (best) {
      best.claim = b; best.claimUntil = now + 14;
      b._brTarget = best; b._brTargetUntil = now + 14;
      b._objAt = 0;
    } else b._brTarget = null;
  }

  /** Ziel für die Bot-KI (brain.js objectiveFor; o.position wird dort kopiert). */
  objectiveFor(b) {
    const M = this.mode, z = M.zone, now = this.G.time.elapsed;
    if (M.airborne(b)) return null;
    const t = b._brTarget;
    const zoneGoal = () => {
      const n = z.next || z.cur;
      if (!b._brZone || now > b._brZoneUntil || Math.hypot(b._brZone.x - n.x, b._brZone.z - n.z) > n.r) {
        b._brZone = M.pointInCircle(n, 0.6) || new THREE.Vector3(n.x, b.position.y, n.z);
        b._brZoneUntil = now + 25 + Math.random() * 15;
      }
      return { id: 'br-zone', position: b._brZone, radius: Math.max(5, Math.min(18, n.r * 0.35)), kind: 'capture' };
    };
    if (!z) return t ? { id: 'br-beute', position: t.position, radius: 1.2, kind: 'loot' } : null;
    const out = !z.inNext(b.position.x, b.position.z, 6);
    const outNow = z.outside(b.position.x, b.position.z) > 0;
    // wie knapp? Restzeit bis zum Ende des Schrumpfens gegen den Weg (≈ 5 m/s)
    const n = z.next || z.cur;
    const dist = Math.max(0, Math.hypot(b.position.x - n.x, b.position.z - n.z) - n.r);
    const tLeft = z.state === 'warten' ? z.left + z._dur('schrumpfen') : z.left;
    if (outNow || (out && dist / 5 + 20 > tLeft)) { b._brTarget = null; return zoneGoal(); }
    if (t && !t.taken) return { id: 'br-beute', position: t.position, radius: 1.2, kind: 'loot' };
    if (out) return zoneGoal();
    // in der Zone ohne Beuteziel: meist selbst suchen lassen, manchmal einen Platz im Kreis halten
    const slot = Math.floor(now / 20 + (b.simPhase || 0) * 0.37) % 3;
    return slot === 0 ? zoneGoal() : null;
  }

  /** Bot-Ausrüstung kurz (Prüfstand): Waffen, Munition, Weste. */
  describe(b) {
    const g = guns(b).map((s) => `${s.id}:${s.mag}/${s.reserve}`);
    return { guns: g, ammo: g.length ? ammoCount(b, ammoTypeOf(guns(b)[0].def)) : 0, vest: b.armor ? b.armor.tier : 'keine', band: bandagesOf(this.ctx, b) };
  }
}

void _v;
