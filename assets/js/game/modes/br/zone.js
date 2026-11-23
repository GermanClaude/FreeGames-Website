// NULLPUNKT — Battle Royale: schrumpfende Zone (reine Logik, ohne three.js/DOM – in Node prüfbar).
//
// Ablauf: Phase k = Warten (Kreis k steht, der nächste Kreis k+1 ist schon angekündigt) → Schrumpfen (Mittelpunkt und Radius
// laufen linear von Kreis k nach k+1). Nach der letzten Phase steht der Endkreis (Radius 0) – außerhalb ist dann alles.
// Schaden je Sekunde außerhalb des aktuellen Kreises steigt mit der Phase. Der nächste Kreis liegt immer ganz im vorigen und
// innerhalb der Karte; über pick(x, z) → bool kann der Aufrufer Mittelpunkte ablehnen (z. B. Wasser, ohne Navigation).
//
// API: new Zone({ bounds: { minX, maxX, minZ, maxZ }, tempo: 'schnell'|'normal'|'langsam', rng, pick, center })
//   update(dt) · info() → { phase, phases, state 'warten'|'schrumpfen'|'ende', left, cur {x,z,r}, next {x,z,r}|null, dps }
//   outside(x, z) → m außerhalb (0 = innen) · inNext(x, z, margin) · dps · cur · next · elapsed

/** Phasen: [Wartezeit s, Schrumpfzeit s, Radius-Anteil des Startkreises, Schaden/s außerhalb]. */
export const ZONE_PHASES = [
  [100, 70, 0.56, 1],
  [70, 55, 0.33, 2],
  [55, 45, 0.18, 4],
  [45, 40, 0.085, 7],
  [35, 30, 0.03, 11],
  [25, 35, 0, 16],
];
export const ZONE_TEMPO = { schnell: 0.65, normal: 1, langsam: 1.45 };
const END_DPS = 22;

export class Zone {
  constructor(o = {}) {
    const b = o.bounds || { minX: -250, maxX: 250, minZ: -250, maxZ: 250 };
    this.bounds = b;
    this.rng = o.rng || Math.random;
    this.pick = typeof o.pick === 'function' ? o.pick : null;
    this.k = ZONE_TEMPO[o.tempo] || 1;
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    // Startkreis: deckt die ganze Karte (halbe Diagonale) – Mitte der Karte
    const cx = o.center ? o.center.x : (b.minX + b.maxX) / 2, cz = o.center ? o.center.z : (b.minZ + b.maxZ) / 2;
    this.r0 = Math.hypot(w, d) / 2 * 1.02;
    this.circles = [{ x: cx, z: cz, r: this.r0 }];
    for (let i = 0; i < ZONE_PHASES.length; i++) this.circles.push(this._nextCircle(this.circles[i], ZONE_PHASES[i][2] * Math.min(w, d) / 2 * 1.25, i === 0));
    this.phase = 0;      // Index der laufenden Phase (0 … n-1), n = Ende
    this.state = 'warten';
    this.t = 0;          // Zeit in der aktuellen Teilphase
    this.elapsed = 0;
    this.cur = { ...this.circles[0] };
  }

  get phases() { return ZONE_PHASES.length; }
  get next() { return this.phase < ZONE_PHASES.length ? this.circles[this.phase + 1] : null; }
  get dps() { return this.phase >= ZONE_PHASES.length ? END_DPS : ZONE_PHASES[this.phase][3]; }

  /** Nächster Kreis mit Radius r ganz im Kreis c und in der Karte (Mittelpunkt zufällig, notfalls näher an c). */
  _nextCircle(c, r, first) {
    const b = this.bounds;
    r = Math.max(0, Math.min(r, c.r * 0.9));
    for (let tries = 0; tries < 40; tries++) {
      const slack = Math.max(0, c.r - r) * (first ? 0.55 : 0.92) * (1 - tries / 50);
      const a = this.rng() * Math.PI * 2, d = Math.sqrt(this.rng()) * slack;
      let x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      // in der Karte halten (Rand 6 m)
      const m = Math.min(r, (b.maxX - b.minX) / 2 - 6, (b.maxZ - b.minZ) / 2 - 6);
      x = Math.min(b.maxX - m - 6, Math.max(b.minX + m + 6, x));
      z = Math.min(b.maxZ - m - 6, Math.max(b.minZ + m + 6, z));
      if (Math.hypot(x - c.x, z - c.z) + r > c.r + 0.01) continue;
      if (this.pick && tries < 32 && !this.pick(x, z, r)) continue;
      return { x, z, r };
    }
    return { x: c.x, z: c.z, r };
  }

  _dur(state) {
    const p = ZONE_PHASES[this.phase];
    return (state === 'warten' ? p[0] : p[1]) * this.k;
  }

  update(dt) {
    if (!(dt > 0)) return;
    this.elapsed += dt;
    if (this.phase >= ZONE_PHASES.length) return;
    this.t += dt;
    while (this.phase < ZONE_PHASES.length && this.t >= this._dur(this.state)) {
      this.t -= this._dur(this.state);
      if (this.state === 'warten') this.state = 'schrumpfen';
      else { this.phase++; this.state = this.phase >= ZONE_PHASES.length ? 'ende' : 'warten'; }
    }
    const a = this.circles[Math.min(this.phase, this.circles.length - 1)];
    if (this.state === 'schrumpfen') {
      const b = this.circles[this.phase + 1];
      const f = Math.min(1, this.t / this._dur('schrumpfen'));
      this.cur.x = a.x + (b.x - a.x) * f; this.cur.z = a.z + (b.z - a.z) * f; this.cur.r = a.r + (b.r - a.r) * f;
    } else if (this.state === 'ende') {
      const e = this.circles[this.circles.length - 1];
      this.cur.x = e.x; this.cur.z = e.z; this.cur.r = e.r;
    } else { this.cur.x = a.x; this.cur.z = a.z; this.cur.r = a.r; }
  }

  /** Restzeit der laufenden Teilphase (s). */
  get left() { return this.phase >= ZONE_PHASES.length ? 0 : Math.max(0, this._dur(this.state) - this.t); }

  outside(x, z) { return Math.max(0, Math.hypot(x - this.cur.x, z - this.cur.z) - this.cur.r); }

  /** Innerhalb des angekündigten nächsten Kreises (mit Rand margin m)? Nach der letzten Phase: im Endkreis. */
  inNext(x, z, margin = 0) {
    const n = this.next || this.cur;
    return Math.hypot(x - n.x, z - n.z) <= Math.max(0, n.r - margin);
  }

  info() {
    return { phase: Math.min(this.phase + 1, ZONE_PHASES.length), phases: ZONE_PHASES.length, state: this.state, left: this.left, cur: { ...this.cur }, next: this.next ? { ...this.next } : null, dps: this.dps };
  }

  /** Gesamtdauer bis zum Endkreis (s). */
  get total() { return ZONE_PHASES.reduce((s, p) => s + (p[0] + p[1]) * this.k, 0); }
}
