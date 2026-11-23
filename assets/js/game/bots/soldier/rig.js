// NULLPUNKT — Skelett des Soldaten (Bindepose, Modellraum: Füße im Ursprung, Blick −Z, rechts +X).
// Alle Knochen haben in der Bindepose die Einheitsrotation; Gliedmaßen zeigen entlang −Y.
// Die Animation (animator.js) rechnet eine eigene Vorwärtskinematik im Modellraum und schreibt nur
// lokale Quaternionen (+ Hüftposition) in die three.js-Knochen.

export const BONES = [
  // name, parent, offset (relativ zum Elternknochen)
  ['hips', -1, [0, 0.95, 0]],
  ['spine', 0, [0, 0.1, 0]],
  ['chest', 1, [0, 0.2, 0]],
  ['neck', 2, [0, 0.235, 0.0]],
  ['head', 3, [0, 0.085, 0.005]],
  ['upperArmL', 2, [-0.215, 0.185, 0.0]], // 21.10.: Schultergelenk wie beim Menschen (Körper aus einem Guss, body-mesh.js)
  // Proportionen 22.11.: Arme waren ≈ 9 cm zu kurz (Faust auf Schritthöhe, Handgelenk 0,905 m) → Oberarm 0,30, Unterarm 0,265,
  // Hand 0,10 (Richtwerte 1,80 m: Ellbogen ≈ 1,13 m, Handgelenk ≈ 0,87 m, Fingerspitzen ≈ Mitte Oberschenkel)
  ['foreArmL', 5, [0, -0.3, 0]],
  ['handL', 6, [0, -0.265, 0]],
  ['upperArmR', 2, [0.215, 0.185, 0.0]],
  ['foreArmR', 8, [0, -0.3, 0]],
  ['handR', 9, [0, -0.265, 0]],
  ['thighL', 0, [-0.1, -0.04, 0]],
  ['shinL', 11, [0, -0.42, 0]],
  ['footL', 12, [0, -0.41, 0]],
  ['thighR', 0, [0.1, -0.04, 0]],
  ['shinR', 14, [0, -0.42, 0]],
  ['footR', 15, [0, -0.41, 0]],
];

export const BONE = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
export const BONE_COUNT = BONES.length;

/** Bindepositionen im Modellraum (Summe der Offsets). */
export const BIND = (() => {
  const out = [];
  for (let i = 0; i < BONES.length; i++) {
    const [, p, o] = BONES[i];
    const base = p >= 0 ? out[p] : [0, 0, 0];
    out.push([base[0] + o[0], base[1] + o[1], base[2] + o[2]]);
  }
  return out;
})();

/** Maße für IK und Ragdoll. */
export const DIM = {
  upperArm: 0.3,
  foreArm: 0.265,
  hand: 0.1, // Handgelenk → Fingergrundgelenke (Mittelhand); die Finger sind zur lockeren Faust gekrümmt (body-mesh.js)
  thigh: 0.42,
  shin: 0.41,
  ankle: 0.08, // Knöchelhöhe über der Sohle
  hipWidth: 0.1,
  hipDrop: 0.04,
  shoulderX: 0.215,
  shoulderY: 0.185,
  standHip: 0.935,
  crouchHip: 0.6,
  headCenter: [0, 0.125, -0.005], // relativ zum Kopfknochen – 22.11.: Mitte zwischen Kinn (1,59) und Helmoberkante (1,84)
};

/** Griffpunkt in der Hand (Handknochenraum, rechte Hand; links x gespiegelt): Mitte der Handfläche – wächst mit der Hand. */
export const GRIP_Y = -0.73 * DIM.hand;

/**
 * Proportionen 22.11.: Lage der Armgelenke vor der Armverlängerung (Oberarm 0,28, Unterarm 0,25, Hand 0,085). Ausrüstung,
 * die in diesen alten Modellraum-Höhen geschrieben ist, rechnet sich mit armY() an die neuen Gelenke um (Abstand zum
 * nächstoberen Gelenk bleibt). → y im heutigen Modellraum
 */
const ARM_OLD = { shoulder: 1.435, elbow: 1.155, wrist: 0.905 };
export function armY(y, bone = 'foreArm') {
  const sh = BIND[BONE.upperArmL][1], el = BIND[BONE.foreArmL][1], wr = BIND[BONE.handL][1];
  if (bone === 'hand') return wr + (y - ARM_OLD.wrist);
  if (bone === 'foreArm') return el + (y - ARM_OLD.elbow);
  return sh + (y - ARM_OLD.shoulder);
}
