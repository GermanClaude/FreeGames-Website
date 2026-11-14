// NULLPUNKT — Flugsteuerung des Spielers (Pilotensitz eines Luftfahrzeugs). Allgemeines (Aussteigen, Sicht, Sitzwechsel,
// Waffen, Feuern, Licht) übernimmt readPlayerControls (controls.js); hier kommen die Fluggrößen dazu.
//
// Belegung (alle Geräte gleich gedacht: linker Stick/WASD = Höhe/Schub + Gieren, rechter Stick/Maus/Ziehen = Steuerknüppel):
//   Tastatur/Maus: W/S Steigen/Sinken (Hubschrauber) bzw. Schub +/− (Jet), A/D Heckrotor/Seitenruder, Maus = zyklisch bzw.
//     Knüppel (Nicken/Rollen; Maus hoch = Nase hoch), rechte Maustaste halten = Umsehen (+ Zoom), Leertaste = Schweben
//     (Hubschrauber: aufrichten und abbremsen) bzw. Luftbremse (Jet), Umschalt = Nachbrenner, X = Täuschkörper,
//     LMT feuern, Mausrad/Maus 5 Waffe, C Sicht, F Aussteigen (in der Luft: Absprung mit Fallschirm), T Scheinwerfer.
//   Gamepad: linker Stick Höhe/Schub + Gieren, rechter Stick Knüppel, RT Feuer, LT Umsehen, A Schweben/Luftbremse,
//     L3 Nachbrenner, RB Täuschkörper, Y Waffe, B Sicht, X halten Aussteigen.
//   Touch: linker Stick Höhe/Schub + Gieren, Ziehen rechts = Knüppel, Knöpfe „Steigen/Sinken“ (v_gas/v_brake),
//     „Schweben“ bzw. „Bremse“ (v_hover), „Nachbrenner“ (v_boost), „Täusch.“ (v_flare), Feuer, Waffe, Sicht, Aussteigen.
// Der Knüppel ist „virtuell“: Mausweg/Stickrate laden ihn auf, losgelassen kehrt er zur Mitte zurück (Lage bleibt –
// Ratensteuerung mit Lagehaltung im Flugmodell).
import { readPlayerControls } from '../controls.js?v=20261114004313';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Flugeingaben eines Bildes in seat.intent (pitch, roll, level, boost, flare, brake; throttle/steer aus drive-input). */
export function readAirControls(input, vehicle, seat, dt, opts = {}) {
  if (!input) return readPlayerControls(input, vehicle, seat, dt, opts);
  const it = seat.intent;
  const free = !!(input.active ? input.active('ads') : input.down('ads'));
  const lx = input.look.dx || 0, ly = input.look.dy || 0;
  // Ohne Umsehen gehört die Blickeingabe dem Knüppel (Sicht bleibt auf der Nase, zentriert sich)
  if (!free) { input.look.dx = 0; input.look.dy = 0; }
  let out;
  try { out = readPlayerControls(input, vehicle, seat, dt, opts); } finally { input.look.dx = lx; input.look.dy = ly; }
  const S = seat._air || (seat._air = { p: 0, r: 0 });
  const dev = input.lastDevice;
  const touch = input.mode === 'touch';
  const pad = dev === 'gamepad';
  if (opts.frozen) { S.p = S.r = 0; it.pitch = it.roll = 0; it.level = true; it.boost = it.flare = false; return out; }
  const K = pad ? 2.6 : touch ? 3.4 : 3.6;
  if (!free) {
    S.r = clamp(S.r + lx * K, -1, 1);
    S.p = clamp(S.p - ly * K, -1, 1);
  }
  const tau = pad ? 0.12 : touch ? 0.3 : 0.22;
  const k = Math.exp(-dt / tau);
  S.r *= k; S.p *= k;
  if (!free && seat.look) {
    // Blick zur Nase zurück, solange nicht umgesehen wird
    const L = seat.look, c = 1 - Math.exp(-dt * 3);
    L.relYaw += (0 - L.relYaw) * c;
    L.relPitch += ((vehicle.air === 'heli' ? -0.12 : -0.04) - L.relPitch) * c;
  }
  it.pitch = S.p;
  it.roll = S.r;
  const heli = vehicle.air === 'heli';
  const hold = input.down('jump') || input.down('v_hover');
  if (heli) { it.level = hold; it.brake = 0; } else { it.level = false; it.brake = hold ? 1 : 0; }
  it.handbrake = false;
  it.boost = !!(input.down('sprint') || input.down('v_boost'));
  it.flare = !!(input.down('tactical') || input.down('v_flare'));
  return out;
}
