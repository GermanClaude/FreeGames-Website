// Handmaße (hands-v4): gemeinsame Quelle für das Hand-Rig (arms.js) und den Netzgenerator
// tools/assets/hands/build_hand.py (MakeHuman-Hand, erzeugt glove-mesh.js). Keine Abhängigkeiten – auch in Node importierbar.
// Handkoordinaten (rechte Hand): Handgelenk im Ursprung, Finger −Z, Handrücken +Y, Daumen −X. Meter.
// Ändern → `MH_DIR=… python3 -I tools/assets/hands/build_hand.py` neu ausführen (glove-mesh.js prüft die Prüfsumme).

// Fingerradien: Kollisions-/Messradien (Kapseln für Kontaktlöser und Prüfwerkzeuge); das sichtbare Netz ist ≈ 4 % weiter.
// hands-v4 (15.11.): Grundglieder ≈ 12 % kräftiger (Nutzer: Hände „wie Knochen“ – echte Finger im Handschuh sind ≈ 2 cm
// dick), Mittel-/Endglieder nach der Verjüngung des MakeHuman-Netzes (build_hand.py gibt die passenden Radien aus).
export const FINGERS = [
  { x: -0.0285, y: 0.001, z: -0.08, len: [0.043, 0.027, 0.022], r: [0.01, 0.0088, 0.0073], splay: 0.07 },
  { x: -0.0093, y: 0.002, z: -0.084, len: [0.047, 0.03, 0.023], r: [0.0103, 0.0091, 0.0075], splay: 0.0 },
  { x: 0.0102, y: 0.001, z: -0.081, len: [0.044, 0.028, 0.022], r: [0.0098, 0.0086, 0.0072], splay: -0.06 },
  { x: 0.0285, y: -0.002, z: -0.073, len: [0.034, 0.022, 0.019], r: [0.0089, 0.0078, 0.0066], splay: -0.14 },
];
export const THUMB = { base: [-0.027, -0.011, -0.018], len: [0.042, 0.032, 0.026], r: [0.0122, 0.0118, 0.0103] };
// Ruheausrichtung des Daumengrundglieds: Blickrichtung F (Knochen −Z) und Rückenrichtung B (Knochen +Y) – hands-v4: die
// natürliche Haltung der MakeHuman-Hand (build_hand.py gibt sie aus), damit die Umzielung die Glieder nicht verdreht
export const THUMB_REST = { F: [-0.647, -0.697, -0.307], B: [-0.697, 0.379, 0.608] };

// Bindehaltung des Handschuhnetzes (Pose-Format wie arms.js POSES: f[i] = [Grund, Mittel, End, Spreizung − FINGERS.splay/2],
// t = [Quaternion Daumengrund (rechte Hand) x, y, z, w, Beugung Grund-, Endgelenk]). hands-v4: die entspannte Haltung der
// MakeHuman-Quellhand (leicht gespreizt und gebeugt) – die Umzielung skaliert die Glieder dann nur (keine Knitter).
export const BIND_SPLAY = [0.209, -0.066, -0.237, -0.344];
export const BIND_CURL = [[0.29, 0.193, 0.126], [0.343, 0.097, 0.125], [0.327, 0.08, 0.14], [0.391, 0.136, 0.034]];
export const BIND_THUMB_FLEX = [0.171, 0.377];

// Prüfsumme der Maße (das erzeugte Netz passt nur zu genau diesen Knochen)
export function handDimsKey() {
  const a = [];
  for (const f of FINGERS) a.push(f.x, f.y, f.z, ...f.len, f.splay);
  a.push(...THUMB.base, ...THUMB.len, ...THUMB_REST.F, ...THUMB_REST.B, ...BIND_SPLAY, ...BIND_CURL.flat(), ...BIND_THUMB_FLEX);
  let h = 0;
  for (const v of a) h = (Math.imul(h, 31) + Math.round(v * 1e5)) | 0;
  return (h >>> 0).toString(16);
}
