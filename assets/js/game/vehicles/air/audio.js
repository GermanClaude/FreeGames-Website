// NULLPUNKT — Klang der Luftfahrzeuge (Owner: audio), live in der AudioEngine (sfx-Bus), gleiche Schnittstelle wie die
// Motorstimme in vehicles/audio.js. Seit 20.11. aus synthetisierten Schleifen (vehicles/engine-sound.js):
//   Hubschrauber: Blattschlag je Blattdurchgang (tiefer Druckstoß + Rauschen) und – unter Last, im Sinkflug und in
//                 Kurven – der scharfe Blattwirbel-„Slap“; Heckrotor-Summen; Turbinen- und Getriebesingen.
//   Jet:          Strahlrauschen (Tiefpass nach Schub, nach hinten abgestrahlt), „Buzzsaw“ des Bläsers und
//                 Verdichterpfeifen (nach vorne), Nachbrenner mit Grollen und Knistern.
// Raum (SpatialOut): Laufzeit über eine Verzögerungsleitung → echter Doppler und „Schall hinkt dem Flugzeug hinterher“,
// Luftdämpfung nach Abstand, Verdeckung, im Cockpit gedämpft.
import { renderRotorLoop, renderBuzzLoop, renderCrackleLoop } from '../engine-sound.js?v=20261123073102';

export const AIR_RANGE = 650;

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const setp = (p, v, t, tau) => { if (p) p.setTargetAtTime(v, t, tau); };
const ROTOR_REV = 4.3; // Hauptrotor U/s bei Nenndrehzahl (5 Blätter → 21,5 Hz Blattfolge)
const FAN_REV = 80;    // Bläser U/s bei Nenndrehzahl

let SpatialOutRef = null;
/** vehicles/audio.js reicht SpatialOut herein (vermeidet zirkulären Import). */
export function useSpatialOut(cls) { SpatialOutRef = cls; }

export class AirVoice {
  constructor(ctx, dest, kind, kit, hrtf = false) {
    this.ctx = ctx;
    this.kind = kind;
    const t = ctx.currentTime;
    const g = (v = 0) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const f = (type, fr, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = fr; n.Q.value = q; return n; };
    this.out = new SpatialOutRef(ctx, dest, { ref: kind === 'jet' ? 24 : 18, roll: 0.9, hrtf, maxDelay: 2.5 });
    this.master = g(0); this.master.connect(this.out.in);
    this.nodes = [];
    const noise = kit.noise(3), noise2 = kit.noise(4);
    if (kind === 'jet') {
      const buzz = kit.custom('buzz', (sr) => renderBuzzLoop(FAN_REV, sr)), crk = kit.custom('crackle', (sr) => renderCrackleLoop(sr));
      this.buzzRef = buzz.meta.fan;
      // Strahl (Mischungsgeräusch): breit, nach Schub heller
      this.roar = kit.loop(noise, t); this.roarF = f('lowpass', 600, 0.5); this.roarB = f('lowshelf', 120); this.roarB.gain.value = 4; this.roarG = g();
      this.roar.connect(this.roarF).connect(this.roarB).connect(this.roarG).connect(this.master);
      // Bläser-Buzzsaw (Überschall-Schaufelspitzen, Drehklang-Harmonische)
      this.buzz = kit.loop(buzz, t); this.buzzF = f('lowpass', 4000, 0.6); this.buzzG = g();
      this.buzz.connect(this.buzzF).connect(this.buzzG).connect(this.master);
      // Verdichterpfeifen: zwei Töne (Stufen), leicht schwebend
      this.wh1 = ctx.createOscillator(); this.wh1.type = 'sine'; this.wh2 = ctx.createOscillator(); this.wh2.type = 'sine';
      this.whG = g(); this.wh1.connect(this.whG); this.wh2.connect(this.whG); this.whG.connect(this.master);
      this.wh1.start(t); this.wh2.start(t);
      // Nachbrenner: tiefes Grollen + Knistern
      this.ab = kit.loop(noise2, t, 0.6); this.abF = f('lowpass', 170); this.abG = g();
      this.ab.connect(this.abF).connect(this.abG).connect(this.master);
      this.crk = kit.loop(crk, t); this.crkG = g(); this.crk.connect(this.crkG).connect(this.master);
      this.nodes.push(this.roar, this.buzz, this.wh1, this.wh2, this.ab, this.crk);
    } else {
      const rot = kit.custom('rotor5', (sr) => { const r = renderRotorLoop(5, ROTOR_REV, sr); return { data: [r.soft, r.slap], sr: r.sr, rev: r.rev }; });
      this.rotRef = rot.meta.rev;
      // Stereo-Schleife: Kanal 0 weicher Blattschlag, Kanal 1 Slap → aufteilen
      this.rot = kit.loop(rot, t);
      const split = ctx.createChannelSplitter(2);
      this.softG = g(); this.slapG = g();
      this.rot.connect(split); split.connect(this.softG, 0); split.connect(this.slapG, 1);
      this.slapF = f('highshelf', 2500); this.slapF.gain.value = 0;
      this.softG.connect(this.master); this.slapG.connect(this.slapF).connect(this.master);
      // Turbine (hohes Pfeifen) und Hauptgetriebe (Zahneingriff)
      this.turb = ctx.createOscillator(); this.turb.type = 'sine'; this.turbG = g();
      this.gear = ctx.createOscillator(); this.gear.type = 'triangle'; this.gearG = g();
      this.turb.connect(this.turbG).connect(this.master); this.gear.connect(this.gearG).connect(this.master);
      this.turb.start(t); this.gear.start(t);
      this.hiss = kit.loop(noise2, t, 1.3); this.hissF = f('highpass', 2500); this.hissG = g();
      this.hiss.connect(this.hissF).connect(this.hissG).connect(this.master);
      this.nodes.push(this.rot, this.turb, this.gear, this.hiss);
      this._vs = 0;
    }
    this.key = `air:${Math.random().toString(36).slice(2)}`;
    this._f = { x: 0, y: 0, z: -1 };
  }

  /** Richtung Flugzeug → Hörer gegen die Längsachse: 1 = Hörer vorn, 0 = hinten. */
  _front(b, A) {
    const L = A && A.listener; if (!L || !L.valid) return 0.5;
    const q = b.renderQuat || b.quat; if (!q) return 0.5;
    // (0,0,-1) mit Quaternion drehen
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const fx = -(2 * (x * z + w * y)), fy = -(2 * (y * z - w * x)), fz = -(1 - 2 * (x * x + y * y));
    const p = b.renderPos, dx = L.x - p.x, dy = L.y - p.y, dz = L.z - p.z, dl = Math.hypot(dx, dy, dz) || 1;
    return (1 + (fx * dx + fy * dy + fz * dz) / dl) / 2;
  }

  set(v, inside, dt, A) {
    const t = this.ctx.currentTime, b = v.body;
    const rep = v.sys && v.sys.replica;
    const rpm = Math.max(0, Math.min(1.1, rep ? (b.drive.rpmNorm || 0) : b.rpm));
    const fr = inside > 0.5 ? 0.5 : this._front(b, A);
    if (this.kind === 'jet') {
      const na = v._netAir;
      const thr = rep ? (na ? na.thr : 0.7) : b.thr, ab = rep ? (na ? na.ab : 0) : b.ab;
      const p = rpm * (0.3 + thr * 0.7), rear = 1 - fr;
      setp(this.roarF.frequency, 350 + p * 3800, t, 0.12);
      setp(this.roarG.gain, p * (0.55 + 0.9 * rear) * 1.1, t, 0.12);
      setp(this.buzz.playbackRate, clamp(rpm * FAN_REV / this.buzzRef, 0.05, 1.3), t, 0.15);
      setp(this.buzzG.gain, smooth(0.45, 0.95, p) * (0.25 + 0.9 * fr) * 0.35, t, 0.15);
      setp(this.wh1.frequency, 900 + rpm * 4200 + thr * 400, t, 0.2);
      setp(this.wh2.frequency, (900 + rpm * 4200 + thr * 400) * 1.47, t, 0.2);
      setp(this.whG.gain, rpm * 0.018 * (0.3 + 1.2 * fr) * (inside > 0.5 ? 0.6 : 1), t, 0.15);
      setp(this.abG.gain, ab * 1.3, t, 0.1);
      setp(this.crkG.gain, ab * 0.45 * (0.4 + 0.8 * rear), t, 0.1);
      setp(this.master.gain, v.alive || rpm > 0.05 ? 1.6 * (inside > 0.5 ? 0.5 : 1) : 0, t, 0.15);
    } else {
      setp(this.rot.playbackRate, Math.max(0.02, rpm * ROTOR_REV / this.rotRef), t, 0.1);
      // Last: Steuer (Kollektiv), Sinkrate und Fahrt – Blattwirbel-Schlag im Sinkflug/in Kurven
      const col = Math.abs((v.seats && v.seats[0] && v.seats[0].intent && v.seats[0].intent.throttle) || 0);
      const vy = b.vel ? b.vel.y : 0; this._vs += (vy - this._vs) * clamp(dt * 3);
      const spd = b.vel ? b.vel.length() : 0;
      const load = clamp(0.3 + col * 0.35 + smooth(1, 6, -this._vs) * 0.5 + smooth(20, 70, spd) * 0.3);
      setp(this.softG.gain, rpm * 1.0, t, 0.1);
      setp(this.slapG.gain, rpm * smooth(0.25, 0.95, load) * 0.9, t, 0.15);
      setp(this.slapF.gain, 3 * fr, t, 0.2); // Slap strahlt nach vorn/unten
      setp(this.turb.frequency, 2800 + rpm * 3600, t, 0.4);
      setp(this.turbG.gain, rpm * 0.006 * (inside > 0.5 ? 0.4 : 1), t, 0.3);
      setp(this.gear.frequency, 180 + rpm * 980, t, 0.3);
      setp(this.gearG.gain, rpm * (inside > 0.5 ? 0.02 : 0.006), t, 0.3); // im Rumpf hört man das Getriebe deutlich
      setp(this.hissG.gain, rpm * 0.1, t, 0.2);
      setp(this.master.gain, v.alive || rpm > 0.05 ? 1.6 * (inside > 0.5 ? 0.6 : 1) : 0, t, 0.2);
    }
    this.out.update(b.renderPos, inside, A, this.key, { lp: this.kind === 'jet' ? 900 : 750, boost: 4 });
  }

  stop() {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.1);
    for (const n of this.nodes) try { n.stop(t + 0.6); } catch { /* schon gestoppt */ }
    setTimeout(() => { try { this.master.disconnect(); } catch { /* */ } this.out.disconnect(); }, 900);
  }
}
