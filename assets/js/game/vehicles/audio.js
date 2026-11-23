// NULLPUNKT — Fahrzeugklänge (Owner: audio). Motor-, Ketten-, Turm-, Rotor- und Triebwerksklänge laufen live als
// WebAudio-Knoten im sfx-Bus der AudioEngine (Lautstärke, Hall/Begrenzer, Stummschaltung gelten mit); Einzelklänge
// (Kanone, MG, Abpraller, Aufprall) über `G.audio.play(name, …)`. Höchstens MAX_VOICES Fahrzeuge gleichzeitig (nächste zuerst).
//
// Aufbau je Fahrzeug (Nutzer 20.11. „Sounds realistischer“):
//   Motor: synthetisierte Drehzahlstufen (engine-sound.js: Zündimpulse je Zylinder, Auspuffresonanzen, Diesel-Nageln,
//          Ventiltrieb) → überblendet nach Drehzahl, Klangfarbe nach Last (Tiefpass), Ansaugrauschen, Turbo, Anlasser
//   Ketten: Glied-Schläge langsam/schnell überblendet nach Kettentempo, Quietschen beim Lenken, Getriebesingen
//   Räder: Abrollgeräusch nach Tempo · Turm: Richtantrieb (elektrisch-hydraulisch bzw. Zahnkranz) nach Drehrate
//   Raum: Innenraum (Luke zu) dumpf mit Wannen-Dröhnen, Laufzeit Abstand/343 m/s über eine Verzögerungsleitung (ergibt
//         echten Doppler beim Vorbeifahren/-fliegen), Luftdämpfung nach Abstand, Verdeckung per Sichtstrahl → Tiefpass,
//         HRTF ab „high“ wie die AudioEngine.
import { AirVoice, AIR_RANGE, useSpatialOut } from './air/audio.js?v=20261123082814';
import { ENGINE_KINDS, engineKindOf, rpmSteps, renderEngineLoop, renderTrackLoop, renderNoiseLoop, renderRotorLoop, renderBuzzLoop, renderCrackleLoop } from './engine-sound.js?v=20261123082814';

const MAX_VOICES = 3;
const RANGE = 110;
const C_SOUND = 343;

/** Pegel je Motorart (Abgleich gegen den alten Oszillator-Klang, gemessen per Offline-Rendering). */
const KIND_VOL = { tank_modern: 1.3, tank_kk: 1.3, tank_ww2: 1.55, tank_ww1: 1.65, car: 1.25, pkw: 1.05, diesel: 1.3, stapler: 0.85 };

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Puffer-Kasten je AudioContext: Schleifen werden einmal gerechnet und von allen Stimmen geteilt. */
export class SoundKit {
  constructor(ctx, low = false) {
    this.ctx = ctx; this.sr = low ? 24000 : 32000; this.cache = new Map();
  }
  _buf(key, fn) {
    let b = this.cache.get(key);
    if (b) return b;
    const r = fn(this.sr);
    const chans = Array.isArray(r.data) ? r.data : [r.data];
    const ab = this.ctx.createBuffer(chans.length, chans[0].length, r.sr);
    chans.forEach((c, i) => ab.copyToChannel ? ab.copyToChannel(c, i) : ab.getChannelData(i).set(c));
    b = { buffer: ab, meta: r };
    this.cache.set(key, b);
    return b;
  }
  engine(kind, ref) { return this._buf(`eng:${kind}:${Math.round(ref)}`, (sr) => renderEngineLoop(kind, ref, sr)); }
  track(count, heavy) { return this._buf(`trk:${count}:${heavy}`, (sr) => renderTrackLoop(count, sr, 1, heavy)); }
  noise(seed = 1) { return this._buf(`noise:${seed}`, (sr) => renderNoiseLoop(sr, seed)); }
  custom(key, fn) { return this._buf(key, fn); }
  /** Schleifenquelle starten (zufälliger Einstieg, damit gleiche Fahrzeuge nicht phasengleich laufen). */
  loop(b, t, rate = 1) {
    const s = this.ctx.createBufferSource(); s.buffer = b.buffer; s.loop = true; s.playbackRate.value = rate;
    s.start(t, Math.random() * b.buffer.duration * 0.9);
    return s;
  }
}

const setp = (p, v, t, tau) => { if (p) p.setTargetAtTime(v, t, tau); };
function gainNode(ctx, v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
function filter(ctx, type, f, q = 0.7, gain = 0) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; }

/**
 * Räumlicher Ausgang einer Fahrzeugstimme: Kabine (Innenraum-Filter) → Luft/Verdeckung (Tiefpass) → Laufzeit
 * (Verzögerung = Abstand/343 m/s, gleitend → Doppler) → Panner (verzögerte Position) → Bus.
 */
export class SpatialOut {
  constructor(ctx, dest, { ref = 7, roll = 1.1, hrtf = false, maxDelay = 3 } = {}) {
    this.ctx = ctx;
    this.in = gainNode(ctx, 1);
    this.cabLp = filter(ctx, 'lowpass', 20000, 0.5);
    this.cabLs = filter(ctx, 'lowshelf', 90, 0.7, 0);
    this.air = filter(ctx, 'lowpass', 20000, 0.5);
    this.occ = gainNode(ctx, 1);
    this.delay = ctx.createDelay(maxDelay);
    this.maxDelay = maxDelay - 0.05;
    this.pan = ctx.createPanner();
    Object.assign(this.pan, { panningModel: hrtf ? 'HRTF' : 'equalpower', distanceModel: 'inverse', refDistance: ref, maxDistance: 10000, rolloffFactor: roll });
    this.in.connect(this.cabLp).connect(this.cabLs).connect(this.air).connect(this.occ).connect(this.delay).connect(this.pan).connect(dest);
    this.hist = []; this.first = true; this._occT = -9; this._occ = false; this.dist = 0;
  }
  /**
   * pos: Weltposition der Quelle · inside 0..1 (Hörer im geschlossenen Fahrzeug) · cab: { lp, boost } Innenraum-Klang
   * A: AudioEngine (Hörer, Verdeckung) · key: Cache-Schlüssel für die Verdeckung.
   */
  update(pos, inside, A, key, cab = null) {
    const ctx = this.ctx, t = ctx.currentTime, L = A && A.listener;
    const lx = L && L.valid ? L.x : pos.x, ly = L && L.valid ? L.y : pos.y, lz = L && L.valid ? L.z : pos.z;
    const d = Math.hypot(pos.x - lx, pos.y - ly, pos.z - lz);
    this.dist = d;
    // Laufzeit: außen Abstand/c, innen keine (Hörer sitzt im Fahrzeug)
    const want = inside > 0.5 ? 0 : Math.min(this.maxDelay, d / C_SOUND);
    if (this.first) this.delay.delayTime.value = want; else setp(this.delay.delayTime, want, t, 0.12);
    // Verzögerte Position für den Panner (Schall kommt von dort, wo die Quelle war)
    this.hist.push([t, pos.x, pos.y, pos.z]);
    while (this.hist.length > 2 && this.hist[1][0] < t - want - 0.05) this.hist.shift();
    if (this.hist.length > 400) this.hist.splice(0, this.hist.length - 400);
    let p = this.hist[0];
    for (let i = this.hist.length - 1; i >= 0; i--) if (this.hist[i][0] <= t - want) { p = this.hist[i]; break; }
    let px = p[1], py = p[2], pz = p[3];
    if (inside > 0.5) { px = lx; py = ly - 0.8; pz = lz + 0.01; } // innen: Klang umgibt den Hörer (Wanne), leicht von unten
    if (this.pan.positionX) {
      if (this.first) { this.pan.positionX.value = px; this.pan.positionY.value = py; this.pan.positionZ.value = pz; }
      else { setp(this.pan.positionX, px, t, 0.03); setp(this.pan.positionY, py, t, 0.03); setp(this.pan.positionZ, pz, t, 0.03); }
    } else this.pan.setPosition(px, py, pz);
    // Luftdämpfung (hohe Frequenzen ~ 10–20 dB/km) und Verdeckung (Sichtstrahl Hörer → Quelle, höchstens alle 0,3 s)
    if (inside < 0.5 && A && typeof A._occluded === 'function' && t - this._occT > 0.3) {
      this._occT = t;
      try { this._occ = !!A._occluded({ x: pos.x, y: pos.y + 1.2, z: pos.z }, { id: key }); } catch { this._occ = false; }
    } else if (inside >= 0.5) this._occ = false;
    const airLp = inside > 0.5 ? 20000 : Math.max(1400, 20000 * Math.exp(-d / 260));
    const lp = this._occ ? Math.min(airLp, 950) : airLp;
    setp(this.air.frequency, lp, t, this.first ? 0.001 : 0.15);
    setp(this.occ.gain, this._occ ? 0.6 : 1, t, 0.15);
    // Innenraum: Stahlwanne dämpft die Höhen, dröhnt im Bass
    const cl = cab ? cab.lp : 1100, cb = cab ? cab.boost : 6;
    setp(this.cabLp.frequency, inside > 0.01 ? 20000 * Math.pow(cl / 20000, inside) : 20000, t, 0.15);
    setp(this.cabLs.gain, cb * inside, t, 0.15);
    this.first = false;
  }
  disconnect() { for (const n of [this.in, this.cabLp, this.cabLs, this.air, this.occ, this.delay, this.pan]) try { n.disconnect(); } catch { /* egal */ } }
}

useSpatialOut(SpatialOut);

class EngineVoice {
  constructor(ctx, dest, v, kit, hrtf) {
    this.ctx = ctx; this.kit = kit;
    const def = v.def || {}, E = def.engine || {};
    this.kind = engineKindOf(def); this.K = ENGINE_KINDS[this.kind];
    this.idle = E.idleRpm || 800; this.rated = E.ratedRpm || this.idle * 4; this.cut = E.cutRpm || this.rated * 1.05;
    this.tracked = def.drive === 'tracked' || !!def.halftrack; // Halbkette (data-troop.js): Kettenklang des Hinterlaufwerks
    this.turret = !!(v.mount && (def.traverse || def.turretLimits));
    this.mass = def.mass || 2000;
    this.vol = KIND_VOL[this.kind] ?? 0.7;
    const t = ctx.currentTime;
    this.out = new SpatialOut(ctx, dest, { ref: this.tracked ? 8 : 6, roll: 1.1, hrtf });
    this.master = gainNode(ctx, 0); this.master.connect(this.out.in);
    // Motor: Drehzahlstufen
    this.eng = gainNode(ctx, 1);
    this.tone = filter(ctx, 'lowpass', 3000, 0.6);
    this.eng.connect(this.tone).connect(this.master);
    this.layers = rpmSteps(this.idle, this.cut).map((ref) => {
      const b = kit.engine(this.kind, ref), g = gainNode(ctx, 0), s = kit.loop(b, t, 1);
      s.connect(g).connect(this.eng);
      return { ref: b.meta.ref, src: s, g };
    });
    const nz = kit.noise(1), nz2 = kit.noise(2);
    // Ansaugen/Auspuffrauschen
    this.nSrc = kit.loop(nz, t); this.nBp = filter(ctx, 'bandpass', 400, 0.9); this.nG = gainNode(ctx, 0);
    this.nSrc.connect(this.nBp).connect(this.nG).connect(this.master);
    // Turbo-Pfeifen
    this.nodes = [this.nSrc, ...this.layers.map((l) => l.src)];
    if (this.K.turbo > 0.01) {
      this.turbo = ctx.createOscillator(); this.turbo.type = 'sine'; this.turbo.frequency.value = 2500;
      this.turboG = gainNode(ctx, 0); this.turbo.connect(this.turboG).connect(this.master); this.turbo.start(t); this.nodes.push(this.turbo);
    }
    if (this.tracked) {
      const heavy = this.mass > 35000 ? 1.25 : this.mass > 15000 ? 1 : 0.8;
      this.trkPitch = this.mass > 35000 ? 0.17 : 0.15; // Gliedteilung (m)
      const slow = kit.track(8, heavy), fast = kit.track(36, heavy);
      this.trkSlow = kit.loop(slow, t); this.trkFast = kit.loop(fast, t);
      this.vSlow = 8 * this.trkPitch; this.vFast = 36 * this.trkPitch;
      this.gSlow = gainNode(ctx, 0); this.gFast = gainNode(ctx, 0);
      this.trkLp = filter(ctx, 'lowpass', 6000, 0.6);
      this.trkSlow.connect(this.gSlow).connect(this.trkLp); this.trkFast.connect(this.gFast).connect(this.trkLp);
      this.trkLp.connect(this.master);
      // Quietschen (Lenken: Glieder schieben seitlich über Triebrad/Leitrad) und Getriebesingen
      this.sqSrc = kit.loop(nz2, t, 1.3); this.sqBp = filter(ctx, 'bandpass', 2100, 7); this.sqG = gainNode(ctx, 0);
      this.sqSrc.connect(this.sqBp).connect(this.sqG).connect(this.master);
      this.whine = ctx.createOscillator(); this.whine.type = 'triangle'; this.whine.frequency.value = 100;
      this.whineG = gainNode(ctx, 0); this.whine.connect(this.whineG).connect(this.master); this.whine.start(t);
      this.nodes.push(this.trkSlow, this.trkFast, this.sqSrc, this.whine);
    } else {
      // Abrollen der Reifen
      this.rdSrc = kit.loop(nz2, t, 0.8); this.rdLp = filter(ctx, 'lowpass', 500, 0.6); this.rdG = gainNode(ctx, 0);
      this.rdSrc.connect(this.rdLp).connect(this.rdG).connect(this.master);
      this.nodes.push(this.rdSrc);
    }
    if (this.turret) {
      const modern = !def.era || def.era === 'modern' || def.era === 'kk';
      this.turModern = modern;
      this.tur = ctx.createOscillator(); this.tur.type = 'sawtooth'; this.tur.frequency.value = modern ? 180 : 22;
      this.turBp = filter(ctx, 'bandpass', modern ? 1100 : 1600, modern ? 2.5 : 1.2);
      this.turG = gainNode(ctx, 0); this.tur.connect(this.turBp).connect(this.turG).connect(this.master); this.tur.start(t);
      this.turN = kit.loop(nz, t, 1.7); this.turNb = filter(ctx, 'bandpass', modern ? 450 : 900, 1.5); this.turNg = gainNode(ctx, 0);
      this.turN.connect(this.turNb).connect(this.turNg).connect(this.master);
      this.nodes.push(this.tur, this.turN);
      this._yaw = v.mount.turretYaw; this._yawRate = 0;
    }
    this.on = null; this.age = 0; this.key = `veh:${v.id ?? Math.random().toString(36).slice(2)}`;
  }

  _starter(t) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = gainNode(ctx, 0), am = ctx.createOscillator(), amg = gainNode(ctx, 0.5);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(150, t + 0.7);
    am.frequency.value = this.K.cyl * 1.6; am.connect(amg).connect(g.gain);
    const bp = filter(ctx, 'bandpass', 700, 1.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.05); g.gain.setTargetAtTime(0, t + 0.75, 0.08);
    o.connect(bp).connect(g).connect(this.master);
    o.start(t); am.start(t); o.stop(t + 1.3); am.stop(t + 1.3);
    o.onended = () => { try { g.disconnect(); bp.disconnect(); amg.disconnect(); } catch { /* */ } };
  }

  set(v, inside, dt, A) {
    const ctx = this.ctx, t = ctx.currentTime, b = v.body, D = b.drive, K = this.K;
    this.age += dt;
    const on = !!v.alive && (!D || D.rpm > 0 || D.rpmNorm > 0);
    if (this.on === false && on && this.age > 0.3) this._starter(t);
    this.on = on;
    const rn = D ? clamp(D.rpmNorm || 0, 0, 1.15) : clamp(b.rpm || 0, 0, 1.15);
    const rpm = on ? (D && D.rpm > 1 ? D.rpm : this.idle + rn * (this.rated - this.idle)) : this.idle * 0.3;
    const load = on ? clamp(D ? D.throttle : Math.abs((b.controls && b.controls.throttle) || 0)) : 0;
    const dip = D && D.shifting ? 0.75 : 1;
    const lug = D && D.lugging ? 1 : 0;
    // Drehzahlstufen: logarithmisch überblenden (gleiche Leistung)
    const L = this.layers, lr = Math.log(rpm);
    let w = L.map(() => 0);
    if (L.length === 1 || lr <= Math.log(L[0].ref)) w[0] = 1;
    else if (lr >= Math.log(L[L.length - 1].ref)) w[L.length - 1] = 1;
    else for (let i = 0; i < L.length - 1; i++) {
      const a = Math.log(L[i].ref), c = Math.log(L[i + 1].ref);
      if (lr >= a && lr <= c) { const x = (lr - a) / (c - a); w[i] = Math.cos(x * Math.PI / 2); w[i + 1] = Math.sin(x * Math.PI / 2); }
    }
    for (let i = 0; i < L.length; i++) { setp(L[i].src.playbackRate, clamp(rpm / L[i].ref, 0.2, 3), t, 0.05); setp(L[i].g.gain, w[i], t, 0.06); }
    // Last: Klangfarbe (unter Last hell und rau, im Schub dumpf) und Pegel
    const rN = clamp((rpm - this.idle) / Math.max(1, this.rated - this.idle), 0, 1.1);
    setp(this.tone.frequency, (700 + K.body * (0.25 + 0.55 * load + 0.35 * rN)) * (lug ? 0.8 : 1), t, 0.08);
    const vol = on ? this.vol * (0.5 + 0.3 * rN + 0.35 * load) * dip * (1 - 0.4 * inside) : 0;
    setp(this.master.gain, vol, t, on ? (D && D.shifting ? 0.05 : 0.1) : 0.35);
    setp(this.nBp.frequency, 260 + 1400 * rN, t, 0.1);
    setp(this.nG.gain, (0.04 + 0.28 * load * (0.3 + rN)) * dip, t, 0.1);
    if (this.turbo) {
      setp(this.turbo.frequency, 2200 + 5200 * Math.pow(rN, 1.3) * (0.6 + 0.4 * load), t, 0.6); // Turbo läuft träge nach
      setp(this.turboG.gain, K.turbo * 0.02 * rN * (0.35 + 0.65 * load), t, 0.5);
    }
    if (this.tracked) {
      const ts = b.trackSpeed || [0, 0], sp = (Math.abs(ts[0]) + Math.abs(ts[1])) / 2, diff = Math.abs(ts[0] - ts[1]);
      const x = smooth(this.vSlow * 0.9, this.vSlow * 2.6, sp), mv = smooth(0.08, 0.9, sp);
      const mk = Math.sqrt(this.mass / 30000);
      setp(this.trkSlow.playbackRate, clamp(sp / this.vSlow, 0.3, 2.6), t, 0.06);
      setp(this.trkFast.playbackRate, clamp(sp / this.vFast, 0.3, 2.4), t, 0.06);
      setp(this.gSlow.gain, 0.55 * mv * Math.cos(x * Math.PI / 2) * mk, t, 0.08);
      setp(this.gFast.gain, 0.6 * Math.sin(x * Math.PI / 2) * (0.7 + 0.3 * clamp(sp / 12)) * mk, t, 0.08);
      setp(this.trkLp.frequency, 2600 + 300 * sp, t, 0.1);
      setp(this.sqG.gain, smooth(0.6, 3.5, diff) * 0.05 * (0.5 + 0.5 * Math.random()), t, 0.12);
      setp(this.sqBp.frequency, 1800 + 600 * Math.random(), t, 0.2);
      setp(this.whine.frequency, 40 + sp * 52, t, 0.08);
      setp(this.whineG.gain, smooth(0.5, 4, sp) * 0.012 * (0.4 + 0.6 * load), t, 0.1);
    } else if (this.rdG) {
      const sp = b.vel ? b.vel.length() : 0;
      setp(this.rdLp.frequency, 250 + sp * 55, t, 0.1);
      setp(this.rdG.gain, smooth(0.3, 25, sp) * 0.55, t, 0.1);
      // Abrollen klingt auch bei abgestelltem Motor (rollt aus) – Master nur halb zu
      if (!on && sp > 0.5) setp(this.master.gain, 0.35 * this.vol * smooth(0.5, 10, sp), t, 0.2);
    }
    if (this.turret) {
      let dy = v.mount.turretYaw - this._yaw;
      if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI;
      this._yaw = v.mount.turretYaw;
      const rate = dt > 0 ? Math.abs(dy) / dt : 0;
      this._yawRate += (rate - this._yawRate) * clamp(dt * 12);
      const r = smooth(0.02, 0.6, this._yawRate), inn = 1 + inside * 1.5;
      setp(this.tur.frequency, this.turModern ? 150 + this._yawRate * 260 : 14 + this._yawRate * 90, t, 0.05);
      setp(this.turG.gain, r * (this.turModern ? 0.03 : 0.05) * inn, t, 0.05);
      setp(this.turNg.gain, r * 0.06 * inn, t, 0.06);
    }
    const p = b.renderPos;
    this.out.update(p, inside, A, this.key, { lp: this.tracked ? 1000 : 2200, boost: this.tracked ? 7 : 3 });
  }

  stop() {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.08);
    for (const n of this.nodes) if (n) try { n.stop(t + 0.5); } catch { /* schon gestoppt */ }
    setTimeout(() => { try { this.master.disconnect(); } catch { /* */ } this.out.disconnect(); }, 800);
  }
}

export class VehicleAudio {
  constructor(G) {
    this.G = G;
    this.voices = new Map(); // vehicle → EngineVoice | AirVoice
    this._noise = null;
    this._ctx = null;
    this.kit = null;
    this._warm = false;
  }

  _dest() {
    const A = this.G.audio;
    if (!A || A.silent || !A.ctx || !A.bus || !A.bus.sfx) return null;
    const bus = A.bus.veh || A.bus.sfx; // eigener Regler „Fahrzeuge“ (ältere Engine: sfx)
    if (A.ctx.state !== 'running') return null;
    if (this._ctx !== A.ctx) {
      this._ctx = A.ctx;
      const low = typeof A._quality === 'function' && A._quality() === 'low';
      this.kit = new SoundKit(A.ctx, low);
      this._noise = this.kit.noise(1).buffer;
    }
    return bus;
  }

  /**
   * Schleifen einer Stimme vorab rechnen – höchstens eine je Bild (je ~10–20 ms, Handy mehr), damit ein auftauchendes
   * Fahrzeug kein Ruckeln auslöst. true = alles da, Stimme darf starten.
   */
  _ready(v) {
    const K = this.kit, jobs = [];
    if (v.isAircraft) {
      jobs.push(() => K.noise(3), () => K.noise(4));
      if (v.air === 'jet') jobs.push(() => K.custom('buzz', (sr) => renderBuzzLoop(80, sr)), () => K.custom('crackle', (sr) => renderCrackleLoop(sr)));
      else jobs.push(() => K.custom('rotor5', (sr) => { const r = renderRotorLoop(5, 4.3, sr); return { data: [r.soft, r.slap], sr: r.sr, rev: r.rev }; }));
    } else {
      const E = (v.def && v.def.engine) || {}, idle = E.idleRpm || 800, cut = E.cutRpm || (E.ratedRpm || idle * 4) * 1.05, kind = engineKindOf(v.def);
      for (const r of rpmSteps(idle, cut)) jobs.push(() => K.engine(kind, r));
      jobs.push(() => K.noise(1), () => K.noise(2));
      if (v.def && (v.def.drive === 'tracked' || v.def.halftrack)) { const m = v.def.mass || 2000, h = m > 35000 ? 1.25 : m > 15000 ? 1 : 0.8; jobs.push(() => K.track(8, h), () => K.track(36, h)); }
    }
    for (const j of jobs) {
      const before = K.cache.size; j();
      if (K.cache.size > before) return false; // eine neue Schleife gerechnet → nächstes Bild weiter
    }
    return true;
  }

  _hrtf() { const A = this.G.audio; try { return !!(A && typeof A._hrtf === 'function' && A._hrtf()); } catch { return false; } }

  /** Hörer im geschlossenen Fahrzeug? 0 (außen/offen) … 1 (Luke zu). */
  _inside(v, listenerVehicle) {
    if (v !== listenerVehicle) return 0;
    if (v.isAircraft) return 1;
    if (!v.def || !v.def.armored) return 0;
    const P = this.G.player, i = P && typeof v.seatOf === 'function' ? v.seatOf(P) : -1, s = i >= 0 ? v.seats[i] : null;
    return s ? 1 - clamp(s.hatchT || 0) : 1;
  }

  update(dt, vehicles, listenerVehicle) {
    const dest = this._dest();
    if (!dest) { if (this.voices.size) this.stopAll(); return; }
    const A = this.G.audio, L = A.listener;
    const cam = this.G.camera;
    if (!cam && !(L && L.valid)) return;
    const cp = L && L.valid ? L : cam.position;
    if (!this._warm && vehicles.length) {
      this._warm = true; // Kanonenklänge für Fahrzeugkarten vorrendern (Worker, nur bei Bedarf)
      try { if (typeof A.prerender === 'function') A.prerender(['cannon_near', 'cannon_far', 'cannon_in']); } catch { /* */ }
    }
    this._frame = (this._frame || 0) + 1;
    const ranked = [];
    for (const v of vehicles) {
      if (!v.alive) continue;
      const p = v.body.renderPos, d = Math.hypot(p.x - cp.x, p.y - cp.y, p.z - cp.z);
      if (d > (v.isAircraft ? AIR_RANGE : RANGE)) continue;
      // Leerlauf ohne Besatzung: nur wenn sehr nah (Motor aus); Luftfahrzeuge, solange Rotor/Triebwerk auslaufen
      const roll = !v.isAircraft && v.body.vel && v.body.vel.lengthSq() > 1;
      if (!v.isOccupied && !roll && !(v.isAircraft && ((v.sys && v.sys.replica ? v.body.drive.rpmNorm : v.body.rpm) || 0) > 0.05)) continue;
      ranked.push([d, v]);
    }
    ranked.sort((a, b) => a[0] - b[0]);
    const max = typeof A._quality === 'function' && A._quality() === 'low' ? 2 : MAX_VOICES;
    const keep = new Set(ranked.slice(0, max).map((x) => x[1]));
    for (const [v, voice] of this.voices) if (!keep.has(v)) { voice.stop(); this.voices.delete(v); }
    for (const v of keep) {
      let voice = this.voices.get(v);
      if (!voice) {
        if (this._built === this._frame) continue; // in diesem Bild schon gerechnet
        if (!this._ready(v)) { this._built = this._frame; continue; }
        try {
          voice = v.isAircraft ? new AirVoice(this._ctx, dest, v.air, this.kit, this._hrtf()) : new EngineVoice(this._ctx, dest, v, this.kit, this._hrtf());
        } catch (err) { if (A && typeof A._error === 'function') A._error(err); continue; }
        this.voices.set(v, voice);
      }
      voice.set(v, this._inside(v, listenerVehicle), dt, A);
    }
  }

  /** Einzelklang über die AudioEngine (fehlertolerant). */
  play(name, opts) {
    const A = this.G.audio;
    if (!A || typeof A.play !== 'function') return null;
    try { return A.play(name, opts); } catch { return null; }
  }

  /**
   * Kanonenschuss (20.11.): eigene Kanonenklänge der AudioEngine (außen nah/fern, im Turm dumpf mit Mechanik).
   * own: Spieler sitzt in diesem Fahrzeug. Ältere Engine ohne Kanone → bisherige Explosion + Sub.
   */
  cannon(v, origin, own) {
    const A = this.G.audio;
    if (!A || typeof A.play !== 'function') return null;
    const m = (v && v.def && v.def.mass) || 30000;
    const pitch = m > 45000 ? 0.94 : m > 22000 ? 1.0 : 1.12; // Kaliber grob nach Fahrzeug (120 mm … 57 mm)
    if (typeof A._cannon === 'function') {
      const inside = own ? this._inside(v, v) : 0;
      return this.play('cannon', { position: own ? null : origin, player: own, inside, volume: 1, pitch, priority: 3 });
    }
    this.play('explosion', { position: own ? null : origin, volume: own ? 0.8 : 1, pitch: 1.55, priority: 3 });
    return this.play('boom_sub', { position: own ? null : origin, volume: 1, priority: 3 });
  }

  /**
   * Ladeklänge im Turm (Nutzer 11.10.), live synthetisiert: 'greifen' (Granate aus dem Gestell: Schaben + Klacken),
   * 'einschieben' (Gleiten ins Rohr + dumpfer Anschlag), 'schliessen' (Keil fährt zu: metallisches Klirren), 'munition'
   * (Umschalten: Klicken), 'geladen' (Bereit-Klacken). vol: 1 im eigenen Turm, leiser für Nachbarn.
   * Seit 20.11.: Stahlmoden mit unharmonischen Teiltönen und Raumanteil der engen Wanne (frühe Reflexion ~3 ms).
   */
  loadSound(kind, vol = 1) {
    const dest = this._dest();
    if (!dest) return;
    const ctx = this._ctx, t0 = ctx.currentTime, out = ctx.createGain();
    out.gain.value = 0.55 * vol;
    // enge Stahlwanne: kurze, dichte Rückwürfe (Kammfilter-Färbung) statt trockener Klänge
    const dl = ctx.createDelay(0.05), fb = ctx.createGain(), wet = ctx.createGain(), wf = filter(ctx, 'lowpass', 3500, 0.6);
    dl.delayTime.value = 0.0034; fb.gain.value = 0.38; wet.gain.value = 0.45;
    out.connect(dest); out.connect(dl); dl.connect(wf).connect(fb).connect(dl); wf.connect(wet).connect(dest);
    const burst = (at, dur, f, q, g, type = 'bandpass') => {
      const n = ctx.createBufferSource(); n.buffer = this._noise;
      const bf = ctx.createBiquadFilter(); bf.type = type; bf.frequency.value = f; bf.Q.value = q;
      const gg = ctx.createGain(); gg.gain.setValueAtTime(0, t0 + at); gg.gain.linearRampToValueAtTime(g, t0 + at + 0.004); gg.gain.exponentialRampToValueAtTime(0.0008, t0 + at + dur);
      n.connect(bf); bf.connect(gg); gg.connect(out);
      n.start(t0 + at, Math.random() * 1.5); n.stop(t0 + at + dur + 0.05);
    };
    // Stahl: Teiltöne 1 : 2,76 : 5,40 : 8,93 (frei schwingende Platte/Stab), höhere klingen schneller ab
    const ring = (at, f0, dur, g, ratios = [1, 2.76, 5.4, 8.93]) => {
      ratios.forEach((r, k) => {
        const f = f0 * r * (0.985 + Math.random() * 0.03);
        if (f > ctx.sampleRate * 0.45) return;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const gg = ctx.createGain(), a = g / (1 + k * 0.6), d = dur / (1 + k * 0.7);
        gg.gain.setValueAtTime(0, t0 + at); gg.gain.linearRampToValueAtTime(a, t0 + at + 0.002); gg.gain.exponentialRampToValueAtTime(0.0005, t0 + at + d);
        o.connect(gg); gg.connect(out); o.start(t0 + at); o.stop(t0 + at + d + 0.05);
      });
    };
    const thump = (at, f, dur, g) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.8, t0 + at); o.frequency.exponentialRampToValueAtTime(f, t0 + at + 0.05);
      const gg = ctx.createGain(); gg.gain.setValueAtTime(0, t0 + at); gg.gain.linearRampToValueAtTime(g, t0 + at + 0.003); gg.gain.exponentialRampToValueAtTime(0.0008, t0 + at + dur);
      o.connect(gg); gg.connect(out); o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
    };
    if (kind === 'greifen') {
      burst(0, 0.05, 2600, 4, 0.4); ring(0, 1900, 0.08, 0.06);        // Riegel des Gestells schnappt
      burst(0.06, 0.42, 1100, 1.0, 0.18);                              // Hülse schabt aus der Halterung
      burst(0.1, 0.3, 3800, 2, 0.06);
      thump(0.5, 75, 0.22, 0.5); ring(0.5, 520, 0.3, 0.1);             // Granate in den Armen
      burst(0.5, 0.06, 1800, 1.5, 0.3);
    } else if (kind === 'einschieben') {
      burst(0, 0.5, 650, 0.9, 0.22, 'lowpass');                       // Gleiten ins Rohr
      burst(0.08, 0.4, 2100, 2, 0.1);
      thump(0.52, 52, 0.35, 0.95); ring(0.52, 310, 0.55, 0.18);        // Anschlag im Ladungsraum
      burst(0.52, 0.08, 3200, 2, 0.4);
    } else if (kind === 'schliessen') {
      burst(0, 0.05, 4200, 4, 0.35);                                  // Hebel
      thump(0.05, 85, 0.25, 0.85);
      ring(0.05, 410, 0.75, 0.24);                                    // Keil schlägt zu: schwerer Stahl klingt nach
      burst(0.05, 0.07, 2600, 2, 0.55);
      ring(0.09, 1350, 0.25, 0.06);
    } else if (kind === 'munition') {
      burst(0, 0.04, 3500, 5, 0.3); burst(0.07, 0.04, 2800, 5, 0.25); ring(0.07, 2400, 0.06, 0.03);
    } else if (kind === 'geladen') {
      burst(0, 0.05, 3000, 4, 0.3); ring(0.02, 880, 0.15, 0.05);
    }
    setTimeout(() => { try { out.disconnect(); dl.disconnect(); fb.disconnect(); wet.disconnect(); wf.disconnect(); } catch { /* */ } }, 2200);
  }

  stopAll() {
    for (const voice of this.voices.values()) voice.stop();
    this.voices.clear();
  }

  dispose() { this.stopAll(); }
}
