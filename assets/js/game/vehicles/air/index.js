// NULLPUNKT — Luftunterstützung im Fahrzeugsystem (G.vehicles.air): Stellplätze (je Team ein Hubschrauber und ein Jet
// auf großen Karten), Spieler-Sicht/-Steuerung im Luftfahrzeug, Flug-HUD, Täuschkörper (Darstellung + Ablenkung),
// Flugabwehr (Raketenwerfer der Infanterie lenken leicht auf erfasste Luftfahrzeuge, Annäherungszünder), Fallschirm
// beim Absprung, KI-Piloten für Hubschrauber, Klang und die Skript-API für Modi/Kampagne.
//
// ───────────────────────────── Skript-API (Kampagne, Modi, Konsole) ─────────────────────────────
//   const air = G.vehicles.air;
//   air.types                                  → ['heli', 'jet']
//   air.spawn('heli', pos, { yaw, team, airborne: false })            → Aircraft (am Boden, Rotor aus)
//   air.spawn('jet', pos, { yaw, team, airborne: true, speed: 120 })  → Aircraft im Flug (pos = Weltpunkt in Flughöhe)
//   air.board(actor, aircraft, seat = 0)        → Sitzindex | −1 (Spieler oder Bot; Sitz 0 = Pilot, 1 = Schütze, 2… Truppenraum)
//   air.pilotBot(bot, aircraft)                 → KI-Pilot (Hubschrauber; setzt den Bot ggf. auf den Pilotensitz)
//   air.order(aircraft, { orbit: Vector3, radius, alt, attack: actor|vehicle|null, home: Vector3 })  → KI-Auftrag ändern
//   air.fly(aircraft, { to: Vector3, alt, speed } | { hover: true, alt })  → Autopilot (Pilot an Bord; bis air.release)
//   air.release(aircraft)                       → Autopilot/KI-Auftrag beenden
//   air.list()                                  → alle Luftfahrzeuge (lebend und Wracks)
//   air.destroy(aircraft, by = null)            → sofort abschießen (Tests/Skripte)
//   air.flares(aircraft)                        → Täuschkörper-Salve
// Ereignisse (G.events): vehicle:airstart {vehicle, phase: 'bereit'|'start'}, vehicle:flare {vehicle}, dazu alle
// vehicle:*-Ereignisse der Bodenfahrzeuge (enter/exit/seat/fire/hit/damaged/destroyed …).
// URL: ?air=0 (keine Luftfahrzeuge) | ?air=1 (auch ohne Fahrzeug-Stellplätze) · ?airbots=0|1|2 (KI-Piloten: aus, Standard |
// nur Gegnerteam | beide Teams – nur zum Testen; Nutzer 20.11.: im Spiel fliegen keine Bots, air/policy.js).
// Klasse Pilot (shared/classes.data.js): Einsatz direkt im Cockpit eines freien Luftfahrzeugs des eigenen Teams (air/deploy.js,
// Auswahl im Einsatz-/Ausrüstungsbildschirm ui/deploy.js). Einzelspieler: Stellplätze nur fürs eigene Team (keine
// unbemannten Feind-Luftfahrzeuge als Zielscheibe), online für beide Teams.
import * as THREE from 'three';
import { VEHICLES } from '../data.js?v=20261122020853';
import { collisionRay } from '../../engine/physics.js?v=20261122020853';
import { groundBelow } from './flight.js?v=20261122020853';
import { prepareAirModels, airProjectileMesh, airMaterials, airWarmMaterials } from './models.js?v=20261122020853';
import { readAirControls } from './controls.js?v=20261122020853';
import { updateAirCamera } from './camera.js?v=20261122020853';
import { AirHUD } from './hud.js?v=20261122020853';
import { AirVoice, AIR_RANGE } from './audio.js?v=20261122020853';
import { HeliPilotAI } from './pilot-ai.js?v=20261122020853';
import { AirDeploy } from './deploy.js?v=20261122020853';

export { AirVoice, AIR_RANGE, airWarmMaterials };

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0), _hit = {};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** Alle Startpunkte der Welt: Teams, FFA, Hauptquartiere (Großkarten), Flaggen-Spawns der Eroberung. */
function spawnPoints(w) {
  const sp = w.spawns || {}, out = [];
  for (const L of [sp.A, sp.B, sp.ffa, sp.hq && sp.hq.A, sp.hq && sp.hq.B]) if (Array.isArray(L)) for (const s of L) if (s && s.position) out.push(s.position);
  const cq = w.objectives && w.objectives.cq;
  if (Array.isArray(cq)) for (const o of cq) for (const s of o.spawns || []) if (s && s.position) out.push(s.position);
  return out;
}
export const AIR_TYPES = ['heli', 'jet'];
export const AIR_CAP = { low: 2, medium: 4, high: 4, ultra: 4 };
const FLARE_COL = new THREE.Color(1.0, 0.82, 0.5);

export class AirSupport {
  constructor(sys) {
    this.sys = sys;
    this.hud = null;
    this.types = AIR_TYPES;
    this._offs = [];
    this.flareList = [];
    this.chutes = new Map();   // actor → { mesh }
    this.pilots = new Map();   // aircraft → HeliPilotAI
    this._botT = 0;
    this._pools = new Map();   // look → [Group] (Körper im Flug)
    this.deploy = new AirDeploy(this); // Klasse Pilot: Einsatz im Cockpit
  }

  get G() { return this.sys.G; }

  /* =============================================================== Lebenszyklus */

  attach() {
    const G = this.G, sys = this.sys;
    try { this.hud = new AirHUD(sys); } catch (err) { this.hud = null; console.warn('[luft] HUD nicht verfügbar', err); }
    const ev = G.events;
    this._offs = [
      ev.on('projectile:launch', (e) => this._onLaunch(e)),
      ev.on('vehicle:exit', (e) => this._onExit(e)),
      ev.on('vehicle:flare', (e) => this._flareFx(e && e.vehicle)),
      ev.on('vehicle:airstart', (e) => { if (e && e.phase === 'start' && e.vehicle && G.player && G.player.vehicle === e.vehicle) sys._flash('Luftstart – frei zum Einsatz'); }),
    ];
    this.group = new THREE.Group(); this.group.name = 'air-fx';
    if (sys.group) sys.group.add(this.group);
    if (sys.replica && !sys.civilOnly && this.enabled()) {
      try { prepareAirModels(AIR_TYPES, ['A', 'B'], sys.quality); } catch (err) { console.warn('[luft] Modelle', err); }
    }
    this.deploy.attach();
  }

  detach() {
    this.deploy.detach();
    for (const off of this._offs) try { off(); } catch { /* gelöst */ }
    this._offs = [];
    for (const [a, c] of this.chutes) { c.mesh.removeFromParent(); a._chute = null; }
    this.chutes.clear();
    for (const f of this.flareList) f.mesh.removeFromParent();
    this.flareList.length = 0;
    for (const [, ai] of this.pilots) this._releaseBot(ai.bot);
    this.pilots.clear();
    for (const v of this.sys.list) v.autopilot = null;
    this._navClear();
    if (this.group) { this.group.removeFromParent(); this.group = null; }
    if (this.hud) { this.hud.dispose(); this.hud = null; }
  }

  /** Luftfahrzeuge in diesem Match? (große Karte, Fahrzeuge an, nicht ?air=0) */
  enabled() {
    const G = this.G, sys = this.sys;
    const p = G.params && typeof G.params.get === 'function' ? G.params.get('air') : null;
    if (p === '0') return false;
    return !!sys.military && !sys.civilOnly;
  }

  /**
   * Bekommt dieses Team Luftfahrzeug-Stellplätze? Bots fliegen nicht (policy.js) – im Einzelspieler stünden die
   * Luftfahrzeuge des Gegnerteams nur unbemannt als Zielscheibe herum, also nur das Team des Spielers (FFA: alle).
   * Online (Menschen in beiden Teams) und in der Kampagne (Skripte) bleiben alle Plätze.
   */
  wantsTeam(team) {
    const G = this.G;
    if (team == null || (G.match && (G.match.netRole || G.match.modeId === 'kampagne'))) return true;
    const p = this.G.params && typeof this.G.params.get === 'function' ? this.G.params.get('airteams') : null;
    if (p === 'beide') return true;
    const me = G.player ? G.player.team : null;
    return me !== 'A' && me !== 'B' ? true : team === me;
  }

  /** Vorlagen für Luftfahrzeuge, die die Karte selbst aufstellt (world.vehicleSpawns mit heli/jet, VehicleSystem._setupSpawns). */
  prepareModels(types, teams = ['A', 'B']) {
    try { prepareAirModels(types, teams.length ? teams : [null], this.sys.quality); } catch (err) { console.warn('[luft] Modelle', err); }
  }

  /** Stellplätze (VehicleSystem._setupSpawns, Host/offline): je Team Hubschrauber + Jet nahe der Basis. */
  setupSpawns(force = false) {
    const G = this.G, sys = this.sys, w = sys.world;
    if (!w || !this.enabled()) return;
    const p = G.params && typeof G.params.get === 'function' ? G.params.get('air') : null;
    if (!force && p !== '1' && !(Array.isArray(w.vehicleSpawns) && w.vehicleSpawns.length) && !(G.match && G.match.vehicles)) return;
    // Karte mit eigenen Luftfahrzeug-Stellplätzen (Flugplatz: Jets auf der Bahn, Hubschrauber auf Landeplätzen) → keine
    // zusätzlichen automatischen Plätze (die Karteneinträge meldet VehicleSystem._setupSpawns an)
    if (!force && Array.isArray(w.vehicleSpawns) && w.vehicleSpawns.some((e) => e && VEHICLES[e.type] && VEHICLES[e.type].air)) return;
    const ffa = !!(G.match && G.match.ffa);
    const teams = ffa ? [null] : ['A', 'B'].filter((t) => this.wantsTeam(t));
    const center = w.bounds ? w.bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    try { prepareAirModels(AIR_TYPES, teams, sys.quality); } catch (err) { console.warn('[luft] Modelle', err); }
    const placed = sys.spawns.map((s) => s.position);
    // Reihenfolge Typ vor Team: bei der Stufen-Obergrenze (Handy: 2) bekommt jedes Team zuerst einen Hubschrauber
    const anchors = teams.map((team) => {
      const list = (w.spawns && (team ? w.spawns[team] : w.spawns.ffa)) || [];
      const anchor = new THREE.Vector3();
      if (list.length) { for (const s of list) anchor.add(s.position); anchor.multiplyScalar(1 / list.length); } else anchor.copy(center);
      // von der Mitte weg (hinter die eigene Basis) – Hubschrauber/Jet stehen nicht im Gefecht
      _d.copy(anchor).sub(center).setY(0);
      if (_d.lengthSq() > 1) anchor.addScaledVector(_d.normalize(), 25);
      return { team, anchor };
    });
    for (const type of AIR_TYPES) {
      for (const { team, anchor } of anchors) {
        // erst abseits der Bot-Laufwege (Spawns → Flaggen), sonst weiter weg, zuletzt wie früher ohne Laufwege
        const spot = this.findSpot(anchor, type, { avoid: placed, toward: center }) || this.findSpot(anchor, type, { avoid: placed, toward: center, maxR: 220, flat: 1.4 })
          || this.findSpot(anchor, type, { avoid: placed, toward: center, maxR: 220, flat: 1.4, lanes: false });
        if (!spot) { console.info(`[luft] kein Stellplatz für ${type} (${team || 'neutral'})`); continue; }
        placed.push(spot.position);
        sys.registerSpawn({ type, position: spot.position, yaw: spot.yaw, team });
      }
    }
  }

  /**
   * Freien, ebenen Platz für ein Luftfahrzeug suchen (Hubschrauber: Rotorkreis frei, Jet: Spannweite/Länge frei).
   * → { position, yaw } | null
   */
  findSpot(near, type, { avoid = [], toward = null, maxR = 120, flat = 0.7, lanes = true } = {}) {
    const w = this.sys.world, def = VEHICLES[type];
    if (!w || !def) return null;
    const top = (w.bounds ? w.bounds.max.y : near.y + 60) + 5;
    const clearR = type === 'heli' ? def.flight.rotorR + 1.2 : 9;
    // Baumkronen (Vegetation hat nur Stämme als Kollision): Bäume im Suchkreis einmal sammeln
    const trees = [];
    const sp = w.vegetation && w.vegetation.species;
    if (sp) for (const kind of Object.keys(sp).filter((k) => k !== 'schilf')) {
      const L = sp[kind].list, n = sp[kind].count ?? (L ? L.length / 5 : 0);
      if (!L) continue;
      const cr = kind === 'fichte' ? 2.4 : kind === 'laub' ? 3.4 : 1.6;
      for (let i = 0; i < n; i++) {
        const x = L[i * 5], z = L[i * 5 + 2];
        if (Math.abs(x - near.x) > maxR + 30 || Math.abs(z - near.z) > maxR + 30) continue;
        trees.push(x, z, cr * (L[i * 5 + 3] || 1));
      }
    }
    // Startpunkte aller Art (Team, Hauptquartier, Flaggen-Spawns der Eroberung) und Laufwege (rest 22.11., Meldung „Bots
    // hängen an Jets/Hubschraubern an den Basis-Ecken“): Luftfahrzeuge stehen nicht mehr auf Wegen von Soldaten und Transportern
    const spawnPts = spawnPoints(w);
    const lane = lanes ? this._lanes(near) : null;
    for (let r = 0; r <= maxR; r += 4) {
      const steps = r === 0 ? 1 : Math.max(8, Math.round((r * Math.PI * 2) / 5));
      for (let k = 0; k < steps; k++) {
        const ang = (k / steps) * Math.PI * 2 + r * 0.31;
        const x = near.x + Math.cos(ang) * r, z = near.z + Math.sin(ang) * r;
        if (w.bounds && (x < w.bounds.min.x + 12 || x > w.bounds.max.x - 12 || z < w.bounds.min.z + 12 || z > w.bounds.max.z - 12)) continue;
        const gy = groundBelow(w, x, top, z, top - (w.bounds ? w.bounds.min.y : -20) + 10);
        if (gy == null) continue;
        const pos = new THREE.Vector3(x, gy, z);
        if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < clearR + 8)) continue;
        if (spawnPts.some((p) => Math.hypot(p.x - x, p.z - z) < clearR + (lanes ? 6 : 2))) continue;
        if (lane) { let hit = false; for (let i = 0; i < lane.length; i += 2) if (Math.hypot(lane[i] - x, lane[i + 1] - z) < clearR + 2.5) { hit = true; break; } if (hit) continue; }
        if (this.sys.list.some((v) => Math.hypot(v.body.pos.x - x, v.body.pos.z - z) < clearR + 6)) continue;
        let tree = false;
        for (let i = 0; i < trees.length; i += 3) if (Math.hypot(trees[i] - x, trees[i + 1] - z) < clearR + trees[i + 2]) { tree = true; break; }
        if (tree) continue;
        if (!this._clear(pos, clearR, type, flat)) continue;
        const yaw = toward ? Math.atan2(-(toward.x - x), -(toward.z - z)) : 0;
        return { position: pos, yaw };
      }
    }
    return null;
  }

  /**
   * Bot-Laufwege um `near` (260 m): Wege von den nächsten Startpunkten dort zu den zwei nächsten Flaggen und zur
   * Kartenmitte (world.nav.findPath), alle 2 m abgetastet → [x, z, x, z, …]. Je Welt und Anker zwischengespeichert.
   */
  _lanes(near) {
    const R = 220; // größter Suchradius von findSpot – ein Satz Wege je Anker
    const w = this.sys.world, nav = w && w.nav;
    if (!nav || typeof nav.findPath !== 'function') return null;
    const key = `${Math.round(near.x)}|${Math.round(near.z)}`;
    if (this._laneW !== w) { this._laneW = w; this._laneC = new Map(); }
    if (this._laneC.has(key)) return this._laneC.get(key);
    const out = [];
    try {
      // Startpunkte der Soldaten und Stellplätze der Bodenfahrzeuge (Transporter fahren von dort los – ride.js; ein Jet am
      // Ausgang des Fahrzeughofs wurde sonst angefahren und weggeschoben)
      const veh = this.sys.spawns.filter((e) => e.team && !(VEHICLES[e.type] && VEHICLES[e.type].air)).map((e) => e.position);
      const src = [...spawnPoints(w), ...veh].filter((p) => p && Math.hypot(p.x - near.x, p.z - near.z) < R + 40);
      // nahe Startpunkte zuerst, höchstens 8 (Großkarten: HQ-Reihe + Flaggen-Spawns)
      src.sort((a, b) => Math.hypot(a.x - near.x, a.z - near.z) - Math.hypot(b.x - near.x, b.z - near.z));
      const ob = w.objectives || {};
      const tg = [...(ob.cq || []), ...(ob.dom || []), ...(ob.trupp || [])].map((o) => o.position).filter(Boolean);
      tg.sort((a, b) => Math.hypot(a.x - near.x, a.z - near.z) - Math.hypot(b.x - near.x, b.z - near.z));
      const goals = tg.slice(0, 2);
      if (w.bounds) goals.push(w.bounds.getCenter(new THREE.Vector3()).setY(near.y));
      for (const s of [...src.slice(0, 8), ...veh.filter((p) => src.includes(p)).slice(0, 6)]) for (const g of goals) {
        const path = nav.findPath(s, g);
        let a = s;
        for (const b of path.slice(0, 40)) {
          const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 2));
          for (let k = 0; k < n; k++) out.push(a.x + (b.x - a.x) * (k / n), a.z + (b.z - a.z) * (k / n));
          a = b;
          if (Math.hypot(a.x - near.x, a.z - near.z) > R + 60) break; // weiter weg spielt keine Rolle
        }
      }
    } catch (err) { console.warn('[luft] Laufwege', err); }
    this._laneC.set(key, out);
    return out;
  }

  _clear(pos, R, type, flat = 0.7) {
    const w = this.sys.world;
    // eben: Bodenhöhe im Kreis R·0,6 ± 0,7 m
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const gy = groundBelow(w, pos.x + Math.cos(a) * R * 0.6, pos.y + 6, pos.z + Math.sin(a) * R * 0.6, 12);
      if (gy == null || Math.abs(gy - pos.y) > flat) return false;
    }
    // frei: Strahlen in Rotor-/Flächenhöhe, dazu nach oben (kein Dach, keine Krone)
    const hs = type === 'heli' ? [1.5, 4.6] : [1.2, 2.6];
    for (const h of hs) {
      _a.set(pos.x, pos.y + h, pos.z);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        _d.set(Math.cos(a), 0, Math.sin(a));
        if (collisionRay(w, _a, _d, R, _hit)) return false;
      }
    }
    _a.set(pos.x, pos.y + 1.2, pos.z);
    if (collisionRay(w, _a, _d.set(0, 1, 0), 30, _hit)) return false;
    return true;
  }

  /* =============================================================== Spieler */

  readControls(input, v, seat, dt, opts) { return readAirControls(input, v, seat, dt, opts); }
  camera(camera, v, seat, dt, world, baseFov, view) { return updateAirCamera(this.sys.camera, camera, v, seat, dt, world, baseFov, view); }

  /** Ausstieg aus einem fliegenden Luftfahrzeug: neben (Jet: über) dem Rumpf, Fallschirm folgt. → Vector3 | null */
  exitPoint(v, idx) {
    const b = v.body;
    if (b.onGround || b.agl < 3) return null; // am Boden: normale Ausstiege (index.js)
    const seat = v.seats[idx];
    const side = seat && seat.def.pos[0] < 0 ? -1 : 1;
    const off = v.air === 'jet' ? _a.set(0, 4.5, -2) : _a.set(side * 2.6, 0.6, seat ? seat.def.pos[2] : 0);
    const p = b.toWorld(off, new THREE.Vector3());
    const w = this.sys.world;
    if (w && typeof w.heightAt === 'function') { const g = w.heightAt(p.x, p.z); if (Number.isFinite(g) && p.y < g + 1) p.y = g + 1; }
    return p;
  }

  /* =============================================================== Waffen */

  /** Mündungsfeuer/Klang für Raketen und Bomben (Host und Clients). */
  fireFx(v, def, origin, dir, own) {
    const G = this.G, sys = this.sys;
    if (def.kind === 'rocket') {
      G.effects?.muzzleFlash?.(origin, dir, { cls: 'sniper', scale: 1.6 });
      G.effects?.backblast?.(origin, dir);
      sys.audio.play('launcher', { position: own ? null : origin, volume: own ? 0.6 : 1, pitch: 1.25, priority: 2 });
      sys.audio.play('sniper', { position: own ? null : origin, volume: own ? 0.35 : 0.7, pitch: 0.6, priority: 2 });
      if (own) G.player?.shake?.(def.shake || 0.12);
    } else if (def.kind === 'bomb') {
      sys.audio.play('reload_bolt', { position: own ? null : origin, volume: 0.7, pitch: 0.4, priority: 1 });
      if (v && v.model && v.model.setStores) {
        const w = v.seats[0] && v.seats[0].weapons.find((x) => x.def.id === def.id);
        if (w) v.model.setStores(Math.max(0, w.mag - (sys.replica ? 1 : 0)));
      }
    }
  }

  /** Kanone mit Sprengmunition: kleine Splitterwirkung am Einschlag (nur Infanterie; Fahrzeuge nehmen den Treffer). */
  cannonHit(def, res, actor) {
    const G = this.G;
    if (!res || !res.hit || !res.point || !G.combat) return;
    const at = res.point.clone ? res.point.clone() : new THREE.Vector3().copy(res.point);
    if (res.normal) at.addScaledVector(res.normal, 0.2);
    this.sys.ownExplosion(() => G.combat.explode({ position: at, radius: def.he.radius, maxDamage: def.he.maxDamage, attacker: actor || null, weaponId: def.id, type: 'cannon', concuss: false }));
  }

  /** Darstellung im Flug (ShellPool, def.look). */
  projectileMesh(look) {
    const pool = this._pools.get(look);
    if (pool && pool.length) return pool.pop();
    const m = airProjectileMesh(look);
    m.userData.airLook = look;
    return m;
  }
  releaseMesh(m) {
    const look = m.userData.airLook;
    if (!look) return;
    if (!this._pools.has(look)) this._pools.set(look, []);
    this._pools.get(look).push(m);
  }

  /* =============================================================== Täuschkörper */

  _flareFx(v) {
    if (!v || !v.body || !this.group) return;
    const G = this.G, b = v.body;
    const own = G.player && G.player.vehicle === v;
    this.sys.audio.play('launcher', { position: own ? null : b.renderPos, volume: own ? 0.35 : 0.6, pitch: 2.2, priority: 1 });
    const M = this._flareMat || (this._flareMat = new THREE.SpriteMaterial({ color: FLARE_COL, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, map: flareTex() }));
    const n = 6;
    b.right(_b); b.up(_c); b.forward(_d);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(M);
      s.scale.setScalar(2.2);
      const side = i % 2 ? 1 : -1;
      const p = b.toWorldRender(_a.set(side * (v.air === 'jet' ? 1.2 : 2.6), 1.2, v.air === 'jet' ? 4 : 0), new THREE.Vector3());
      const vel = b.vel.clone().multiplyScalar(0.85).addScaledVector(_b, side * (8 + Math.random() * 10)).addScaledVector(_c, -2 - Math.random() * 6).addScaledVector(_d, -4 - i * 2);
      s.position.copy(p);
      this.group.add(s);
      this.flareList.push({ mesh: s, pos: p, vel, life: 3.2 + Math.random() * 0.6, age: 0, smokeT: 0 });
    }
  }

  _updateFlares(dt) {
    const E = this.G.effects;
    for (let i = this.flareList.length - 1; i >= 0; i--) {
      const f = this.flareList[i];
      f.age += dt;
      if (f.age > f.life) { f.mesh.removeFromParent(); this.flareList.splice(i, 1); continue; }
      f.vel.y -= 9.81 * dt * 0.6;
      f.vel.multiplyScalar(Math.exp(-dt * 0.9));
      f.pos.addScaledVector(f.vel, dt);
      f.mesh.position.copy(f.pos);
      const k = 1 - f.age / f.life;
      f.mesh.scale.setScalar(1.2 + 1.6 * k * (0.8 + Math.random() * 0.4));
      f.smokeT -= dt;
      if (E && f.smokeT <= 0 && typeof E._puff === 'function') {
        f.smokeT = this.sys.quality === 'low' ? 0.12 : 0.05;
        try { E._puff(f.pos.x, f.pos.y, f.pos.z, 0, 0.2, 0, 2.2, 0.4, 1.6, [0.85, 0.85, 0.82], 0.35 * k, 1.5, 0.1); } catch { /* */ }
      }
    }
  }

  /* =============================================================== Flugabwehr (Raketenwerfer) */

  /** Abschuss einer Infanterie-Rakete: erfasst ein Luftfahrzeug im 8°-Kegel (≤ 700 m) → leichte Lenkung. */
  _onLaunch(e) {
    const r = e && e.rocket;
    if (!r || !r.dir) return;
    const shooter = r.actor;
    if (shooter && shooter.vehicle && shooter.vehicle.isAircraft) return;
    // Bots: engerer Erfassungskegel (≈ 4,5°) und nicht jede Rakete erfasst (Nutzer 20.11.: KI darf nicht jeden Treffer landen)
    const bot = !!(shooter && !shooter.isPlayer && !shooter.isRemoteHuman);
    if (bot && Math.random() > 0.55) return;
    let best = null, bc = Math.cos(bot ? 0.08 : 0.14);
    for (const v of this.sys.list) {
      if (!v.isAircraft || !v.alive || v.body.onGround) continue;
      if (shooter && typeof v.hostileTo === 'function' && !v.hostileTo(shooter)) continue;
      _a.copy(v.body.pos).sub(r.pos);
      const d = _a.length();
      if (d > 700 || d < 8) continue;
      const c = _a.dot(r.dir) / d;
      if (c > bc) { bc = c; best = v; }
    }
    if (best) { r.airTarget = best; r.airDecoy = null; }
  }

  /**
   * Lenkung je Bild (ballistics/rockets.js): Kurs auf den Vorhaltepunkt (max. 1,7 rad/s), Täuschkörper lenken ab (85 %),
   * Annäherungszünder 6 m (Host/offline: Schaden + Explosion). → true, wenn die Rakete verbraucht ist.
   */
  guide(r, dt) {
    const v = r.airTarget, G = this.G, now = G.time.elapsed;
    if (!v) return false;
    if (!v.alive) { r.airTarget = null; return false; }
    v.threat = now + 0.4;
    // Täuschkörper: einmal würfeln, dann auf die Fackel
    if (!r.airDecoy && v.flareUntil > now && this.flareList.length) {
      r.airDecoy = Math.random() < 0.85 ? this.flareList[Math.floor(Math.random() * this.flareList.length)] : 'frei';
    }
    let tgt;
    if (r.airDecoy && r.airDecoy !== 'frei') {
      tgt = _a.copy(r.airDecoy.pos);
      if (r.airDecoy.age >= r.airDecoy.life) { r.airTarget = null; return false; }
    } else {
      const sp = Math.max(60, r.vel.length());
      const t = clamp(v.body.pos.distanceTo(r.pos) / sp, 0, 3);
      tgt = _a.copy(v.body.pos).addScaledVector(v.body.vel, t * 0.8);
    }
    const want = _b.copy(tgt).sub(r.pos);
    const dist = want.length();
    want.multiplyScalar(1 / Math.max(1e-3, dist));
    const speed = r.vel.length();
    const cur = _c.copy(r.vel).multiplyScalar(1 / Math.max(1e-3, speed));
    const ang = Math.acos(clamp(cur.dot(want), -1, 1));
    const maxA = 1.7 * dt;
    if (ang > 1e-4) {
      const k = Math.min(1, maxA / ang);
      cur.lerp(want, k).normalize();
      r.vel.copy(cur).multiplyScalar(speed);
      r.dir.copy(cur);
      r.vel.y += (r.P.gravity ?? 4.5) * dt; // Schwerkraft wird gegengesteuert
    }
    // Annäherungszünder (nur am echten Ziel; Clients spielen nur die Bahn)
    if (r.airDecoy && r.airDecoy !== 'frei') return false;
    if (v.body.pos.distanceTo(r.pos) < 6.5 && !r.remote) {
      const rs = G.weapons && G.weapons.rocketSystem;
      const dealt = v.applyDamage(330, { attacker: r.actor || null, weaponId: r.def.id, kind: 'explosive', zone: 'hull', point: r.pos.clone() });
      if (dealt > 0) G.events.emit('vehicle:hit', { vehicle: v, attacker: r.actor || null, amount: dealt, weaponId: r.def.id, zone: 'hull' });
      if (rs && typeof rs._detonate === 'function') rs._detonate(r, r.pos.clone(), v, true);
      return true;
    }
    return false;
  }

  /* =============================================================== Fallschirm */

  _onExit(e) {
    const v = e && e.vehicle, a = e && e.actor;
    if (!v || !v.isAircraft || !a || !a.body) return;
    if (v.body.onGround || v.body.agl < 6) return;
    if (!a.alive) return;
    this._deploy(a);
  }

  _deploy(a) {
    if (this.chutes.has(a) || !this.group) return;
    const mesh = chuteMesh();
    this.group.add(mesh);
    this.chutes.set(a, { mesh, t: 0 });
    a._chute = true;
  }

  _updateChutes(dt) {
    for (const [a, c] of this.chutes) {
      c.t += dt;
      const body = a.body;
      const done = !a.alive || !body || a.vehicle || (c.t > 0.6 && body.onGround);
      if (done) { c.mesh.removeFromParent(); this.chutes.delete(a); a._chute = null; continue; }
      if (body.velocity) {
        if (body.velocity.y < -5.0) body.velocity.y = -5.0;
        body.velocity.x *= Math.exp(-dt * 0.6); body.velocity.z *= Math.exp(-dt * 0.6);
      }
      const p = a.position;
      c.mesh.position.set(p.x, p.y + 2.2 + Math.min(1, c.t * 2) * 2.4, p.z);
      c.mesh.scale.setScalar(Math.min(1, 0.2 + c.t * 1.6));
      c.mesh.rotation.y += dt * 0.2;
    }
  }

  /* =============================================================== KI-Piloten */

  _assignBots(dt) {
    const G = this.G, sys = this.sys;
    this._botT -= dt;
    if (this._botT > 0) return;
    this._botT = 4;
    if (sys.replica || !G.bots || !sys.live || (G.net && G.net.online && !(G.params && G.params.get && G.params.get('airbots') === '2'))) return;
    const mode = (G.params && typeof G.params.get === 'function' && G.params.get('airbots')) || '0'; // Standard: keine KI-Piloten
    if (mode === '0') return;
    if ((G.match && G.match.elapsed != null ? G.match.elapsed : G.time.elapsed) < 15) return;
    const me = G.player ? G.player.team ?? null : null;
    for (const v of sys.list) {
      if (v.air !== 'heli' || !v.alive || v.pilot || this.pilots.has(v) || v.autopilot) continue;
      const t = v.spawnTeam;
      if (t == null) continue;
      if (mode === '1' && t === me) continue;
      // Spieler in der Nähe des eigenen Hubschraubers: frei lassen
      if (G.player && G.player.alive && G.player.position.distanceTo(v.body.pos) < 40 && t === me) continue;
      const bots = (G.actors || []).filter((a) => a && !a.isPlayer && !a.isRemoteHuman && !a.puppet && a.alive && !a.vehicle && a.team === t);
      if (!bots.length) continue;
      bots.sort((x, y) => x.position.distanceToSquared(v.body.pos) - y.position.distanceToSquared(v.body.pos));
      this.pilotBot(bots[0], v);
    }
  }

  _holdBot(bot) {
    if (!bot || bot._airHeld) return;
    bot._airHeld = true;
    // Bot-Takt ruht, solange er fliegt (sonst liefe/schösse er im Sitz weiter); Leichen-/Tod-Logik bleibt beim Bot
    const orig = Object.getPrototypeOf(bot).update;
    bot.update = function airPilotUpdate(dt) { if (this.alive && this.vehicle && this.vehicle.isAircraft) return; return orig.call(this, dt); };
  }

  _releaseBot(bot) {
    if (!bot || !bot._airHeld) return;
    bot._airHeld = false;
    if (Object.prototype.hasOwnProperty.call(bot, 'update')) delete bot.update;
  }

  _updatePilots(dt) {
    for (const [v, ai] of this.pilots) {
      ai.update(dt);
      if (ai.done) { this.pilots.delete(v); this._releaseBot(ai.bot); }
    }
  }

  /* =============================================================== Takt */

  update(dt) {
    this._updateFlares(dt);
    this._updateChutes(dt);
    if (!this.sys.replica) {
      this._assignBots(dt);
      this._updatePilots(dt);
      this._navT = (this._navT || 0) - dt;
      if (this._navT <= 0) { this._navT = 0.5; this._navSync(); }
    }
    this.deploy.update(dt);
    // Täuschkörper: Bestand im Modell (Bomben am Jet)
    for (const v of this.sys.list) {
      if (v.air !== 'jet' || !v.model.setStores) continue;
      const w = v.seats[0] && v.seats[0].weapons.find((x) => x.def.kind === 'bomb');
      const n = w ? (w.reloadT > 0 ? 0 : w.mag) : 0;
      if (v._stores !== n) { v._stores = n; v.model.setStores(n); }
    }
  }

  /* =============================================================== Bot-Wege */

  /**
   * Abgestellte Luftfahrzeuge (und Wracks) als Sperrflächen ins Navigationsnetz (NavGraph.setBlocker, rest 22.11.): das
   * Netz kannte sie nicht, Wege führten mitten hindurch (die Kollision mit Fahrzeugen schiebt nur am Rumpfquader heraus,
   * durch die Tragflächen liefen Bots hindurch). Gesperrt werden die Teile, an denen ein Mensch hängen bleibt
   * (Unterkante < 2 m: Rumpf, Tragflächen, Heckausleger); fliegt es los, gibt die Fläche den Weg wieder frei.
   */
  _navSync() {
    const nav = this.sys.world && this.sys.world.nav;
    if (!nav || typeof nav.setBlocker !== 'function') return;
    const M = this._navBlk || (this._navBlk = new Map()); // Fahrzeug → { x, z, yaw }
    for (const [v] of M) if (!this.sys.list.includes(v)) { nav.setBlocker(v, null); M.delete(v); }
    for (const v of this.sys.list) {
      if (!v.isAircraft && !(v.def && v.def.air)) continue;
      const b = v.body;
      const parked = (v.alive || v.wreck) && (b.onGround || (b.agl ?? 0) < 1.2) && b.vel.lengthSq() < 4;
      const was = M.get(v);
      if (!parked) { if (was) { nav.setBlocker(v, null); M.delete(v); } continue; }
      const yaw = b.yaw();
      if (was && Math.hypot(was.x - b.pos.x, was.z - b.pos.z) < 0.8 && Math.abs(wrapA(was.yaw - yaw)) < 0.08) continue;
      const rects = [];
      for (const bx of v.def.boxes || [v.def.hullBox]) {
        if (bx[1] - bx[4] > 2.0) continue; // hoch liegende Teile (Leitwerk, Rotorkopf): darunter geht man durch
        const c = b.toWorld(_c.set(bx[0], bx[1], bx[2]), _c);
        rects.push({ x: c.x, z: c.z, yaw, hw: bx[3], hl: bx[5], y0: b.pos.y - 0.5, y1: b.pos.y + bx[1] + bx[4] });
      }
      nav.setBlocker(v, rects);
      M.set(v, { x: b.pos.x, z: b.pos.z, yaw });
    }
  }

  _navClear() {
    const nav = this.sys.world && this.sys.world.nav;
    if (this._navBlk && nav && typeof nav.setBlocker === 'function') for (const [v] of this._navBlk) nav.setBlocker(v, null);
    if (this._navBlk) this._navBlk.clear();
  }

  /* =============================================================== Skript-API */

  list() { return this.sys.list.filter((v) => v.isAircraft); }

  spawn(type, pos, { yaw = 0, team = null, airborne = false, speed = null } = {}) {
    const sys = this.sys;
    if (!sys.attached || !VEHICLES[type] || !VEHICLES[type].air) return null;
    try { prepareAirModels([type], [team], sys.quality); } catch { /* bei Bedarf */ }
    const p = pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z);
    const sp = speed ?? (airborne ? (type === 'jet' ? 120 : 0) : 0);
    return sys.spawnVehicle(type, p, yaw, team, { airborne, speed: sp });
  }

  board(actor, v, seat = 0) { return this.sys.enter(actor, v, seat); }

  pilotBot(bot, v) {
    if (!bot || !v || v.air !== 'heli') return null;
    bot._airScript = true; // ausdrücklich freigegebener KI-Pilot (Kampagne/Test, policy.js)
    if (bot.vehicle !== v || v.seatOf(bot) !== 0) {
      if (bot.vehicle) this.sys.removeFromSeat(bot, { teleport: false });
      if (this.sys.enter(bot, v, 0) !== 0) return null;
    }
    this._holdBot(bot);
    const ai = new HeliPilotAI(this, v, bot);
    this.pilots.set(v, ai);
    return ai;
  }

  order(v, { orbit = null, radius = null, alt = null, attack = undefined, home = null } = {}) {
    const ai = this.pilots.get(v);
    if (!ai) return false;
    if (orbit) { ai.orbit = orbit.clone(); ai._orbitT = Infinity; if (ai.state === 'start' && v.body.agl > 25) ai.state = 'patrouille'; }
    if (radius) ai.radius = radius;
    if (alt) ai.alt = alt;
    if (home) ai.home = home.clone();
    if (attack !== undefined) ai.target = attack ? (attack.isVehicle ? { vehicle: attack, actor: null } : { actor: attack, vehicle: null }) : null;
    return true;
  }

  /** Autopilot (ohne KI, Pilot muss an Bord sein): to = Ziel (Kurs), hover = Schweben auf alt. */
  fly(v, { to = null, alt = null, speed = null, hover = false } = {}) {
    if (!v || (!to && !hover)) return false;
    v.autopilot = { to: to ? to.clone() : null, alt, speed, hover: !!hover };
    return true;
  }

  release(v) {
    if (v) v.autopilot = null;
    const ai = this.pilots.get(v);
    if (ai) { this.pilots.delete(v); this._releaseBot(ai.bot); }
  }

  destroy(v, by = null) { if (v && v.alive) v.destroy(by, 'vehicle_explosion'); }
  flares(v) { return v ? v.deployFlares() : false; }

  warmMaterials() { try { airMaterials(); return airWarmMaterials(); } catch { return []; } }
}

let FT = null;
function flareTex() {
  if (FT) return FT;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,230,170,0.9)'); gr.addColorStop(0.5, 'rgba(255,150,60,0.35)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  FT = new THREE.CanvasTexture(c); FT.colorSpace = THREE.SRGBColorSpace;
  return FT;
}

let CHUTE = null;
function chuteMesh() {
  if (!CHUTE) {
    const canopy = new THREE.SphereGeometry(2.6, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
    canopy.scale(1, 0.55, 1);
    const mat = new THREE.MeshStandardMaterial({ name: 'air:schirm', color: 0x6d7558, roughness: 0.9, side: THREE.DoubleSide });
    const lines = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      lines.push(new THREE.Vector3(Math.cos(a) * 2.35, 0.55, Math.sin(a) * 2.35), new THREE.Vector3(0, -2.6, 0));
    }
    const lg = new THREE.BufferGeometry().setFromPoints(lines);
    CHUTE = { canopy, mat, lg, lm: new THREE.LineBasicMaterial({ color: 0x2a2a26 }) };
  }
  const g = new THREE.Group();
  const m = new THREE.Mesh(CHUTE.canopy, CHUTE.mat); m.castShadow = true;
  g.add(m, new THREE.LineSegments(CHUTE.lg, CHUTE.lm));
  return g;
}
void DOWN; void _hit;
