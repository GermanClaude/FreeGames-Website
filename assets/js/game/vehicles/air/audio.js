// NULLPUNKT — Klang der Luftfahrzeuge, live synthetisiert (gleiche Schnittstelle wie EngineVoice in vehicles/audio.js,
// im sfx-Bus der AudioEngine): Hubschrauber = Blattschlag („Wop-wop“: Rauschen, im Takt der Blattfolgefrequenz
// amplitudenmoduliert, dazu tiefer Schlag), Turbinenpfeifen und Getriebesingen nach Drehzahl; Jet = Triebwerksrauschen
// (Tiefpass nach Schub), Verdichterpfeifen, Nachbrenner-Grollen. Außen mit Entfernungsdämpfung, im Cockpit gedämpft.
export const AIR_RANGE = 420;

export class AirVoice {
  constructor(ctx, dest, kind, noise) {
    this.ctx = ctx;
    this.kind = kind;
    const t = ctx.currentTime;
    this.out = ctx.createGain(); this.out.gain.value = 0;
    this.pan = ctx.createPanner();
    Object.assign(this.pan, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: kind === 'jet' ? 22 : 16, maxDistance: 900, rolloffFactor: 0.9 });
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 900; this.lp.Q.value = 0.6;
    this.lp.connect(this.out);
    this.out.connect(this.pan).connect(dest);
    this.nodes = [];
    const src = (rate = 1) => { const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true; n.playbackRate.value = rate; n.start(t, Math.random()); this.nodes.push(n); return n; };
    if (kind === 'jet') {
      // Rauschen (Strahl) + Pfeifen (Verdichter) + Nachbrenner (tiefes Rauschen)
      this.roarF = ctx.createBiquadFilter(); this.roarF.type = 'lowpass'; this.roarF.frequency.value = 600; this.roarF.Q.value = 0.4;
      this.roarG = ctx.createGain(); this.roarG.gain.value = 0;
      src(1).connect(this.roarF).connect(this.roarG).connect(this.lp);
      this.whine = ctx.createOscillator(); this.whine.type = 'sawtooth'; this.whine.frequency.value = 900; this.whine.start(t); this.nodes.push(this.whine);
      this.whF = ctx.createBiquadFilter(); this.whF.type = 'bandpass'; this.whF.Q.value = 6; this.whF.frequency.value = 1800;
      this.whG = ctx.createGain(); this.whG.gain.value = 0;
      this.whine.connect(this.whF).connect(this.whG).connect(this.out);
      this.abF = ctx.createBiquadFilter(); this.abF.type = 'lowpass'; this.abF.frequency.value = 160;
      this.abG = ctx.createGain(); this.abG.gain.value = 0;
      src(0.6).connect(this.abF).connect(this.abG).connect(this.out);
    } else {
      // Blattschlag: Bandpass-Rauschen × (LFO im Blatttakt)
      this.bpf = ctx.createBiquadFilter(); this.bpf.type = 'bandpass'; this.bpf.frequency.value = 260; this.bpf.Q.value = 0.9;
      this.chop = ctx.createGain(); this.chop.gain.value = 0;
      this.lfo = ctx.createOscillator(); this.lfo.type = 'sawtooth'; this.lfo.frequency.value = 20; this.lfo.start(t); this.nodes.push(this.lfo);
      this.lfoG = ctx.createGain(); this.lfoG.gain.value = 0;
      this.lfo.connect(this.lfoG).connect(this.chop.gain);
      src(1).connect(this.bpf).connect(this.chop).connect(this.lp);
      // tiefer Schlag im selben Takt
      this.thump = ctx.createOscillator(); this.thump.type = 'sine'; this.thump.frequency.value = 20; this.thump.start(t); this.nodes.push(this.thump);
      this.thG = ctx.createGain(); this.thG.gain.value = 0;
      this.thump.connect(this.thG).connect(this.out);
      // Turbine/Getriebe
      this.whine = ctx.createOscillator(); this.whine.type = 'triangle'; this.whine.frequency.value = 1200; this.whine.start(t); this.nodes.push(this.whine);
      this.whG = ctx.createGain(); this.whG.gain.value = 0;
      this.whine.connect(this.whG).connect(this.out);
      this.hissF = ctx.createBiquadFilter(); this.hissF.type = 'highpass'; this.hissF.frequency.value = 2500;
      this.hissG = ctx.createGain(); this.hissG.gain.value = 0;
      src(1.3).connect(this.hissF).connect(this.hissG).connect(this.out);
    }
    this.vehicle = null;
  }

  set(v, inside, dt) {
    const t = this.ctx.currentTime, b = v.body;
    const rep = v.sys && v.sys.replica;
    const rpm = Math.max(0, Math.min(1.1, rep ? (b.drive.rpmNorm || 0) : b.rpm));
    const damp = inside ? 0.5 : 1;
    if (this.kind === 'jet') {
      const na = v._netAir;
      const thr = rep ? (na ? na.thr : 0.7) : b.thr, ab = rep ? (na ? na.ab : 0) : b.ab;
      const p = rpm * (0.35 + thr * 0.65);
      this.roarF.frequency.setTargetAtTime(300 + p * 2200 * (inside ? 0.4 : 1), t, 0.1);
      this.roarG.gain.setTargetAtTime(p * 1.1, t, 0.12);
      this.whine.frequency.setTargetAtTime(700 + rpm * 2600 + thr * 600, t, 0.15);
      this.whF.frequency.setTargetAtTime(1200 + rpm * 2600, t, 0.15);
      this.whG.gain.setTargetAtTime(rpm * 0.05 * damp, t, 0.15);
      this.abG.gain.setTargetAtTime(ab * 1.4 * damp, t, 0.1);
      this.lp.frequency.setTargetAtTime(inside ? 900 : 5000, t, 0.1);
      this.out.gain.setTargetAtTime(v.alive ? 0.9 * (inside ? 0.6 : 1) : 0, t, 0.15);
    } else {
      const bpf = rpm * 21.5; // 5 Blätter × 4,3 U/s
      this.lfo.frequency.setTargetAtTime(Math.max(0.5, bpf), t, 0.1);
      this.thump.frequency.setTargetAtTime(Math.max(8, bpf * 2), t, 0.1);
      const load = Math.min(1, 0.6 + Math.abs((v.seats[0] && v.seats[0].intent.throttle) || 0) * 0.4 + b.vel.length() / 200);
      this.lfoG.gain.setTargetAtTime(rpm * 0.9 * load, t, 0.1);
      this.chop.gain.setTargetAtTime(rpm * 0.9 * load, t, 0.1); // Grundpegel = LFO-Hub → 0 … 2× (Schlag beim Sägezahn-Rücksprung)
      this.bpf.frequency.setTargetAtTime(180 + rpm * 160, t, 0.2);
      this.thG.gain.setTargetAtTime(rpm * 0.35 * load * damp, t, 0.1);
      this.whine.frequency.setTargetAtTime(400 + rpm * 1400, t, 0.3);
      this.whG.gain.setTargetAtTime(rpm * 0.025 * damp, t, 0.2);
      this.hissG.gain.setTargetAtTime(rpm * 0.12, t, 0.2);
      this.lp.frequency.setTargetAtTime(inside ? 700 : 3200, t, 0.1);
      this.out.gain.setTargetAtTime(v.alive || rpm > 0.05 ? 1.0 * (inside ? 0.7 : 1) : 0, t, 0.2);
    }
    const pos = b.renderPos;
    if (this.pan.positionX) {
      this.pan.positionX.setTargetAtTime(pos.x, t, 0.03);
      this.pan.positionY.setTargetAtTime(pos.y, t, 0.03);
      this.pan.positionZ.setTargetAtTime(pos.z, t, 0.03);
    } else this.pan.setPosition(pos.x, pos.y, pos.z);
    void dt;
  }

  stop() {
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.1);
    for (const n of this.nodes) try { n.stop(t + 0.6); } catch { /* schon gestoppt */ }
    setTimeout(() => { try { this.out.disconnect(); this.pan.disconnect(); } catch { /* egal */ } }, 800);
  }
}
