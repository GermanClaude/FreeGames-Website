// NULLPUNKT — Soldaten-Ausrüstung: 8 Ausrüstungsvarianten (Kopfbedeckung, Gesichtsschutz, Brille, Weste,
// Rucksack, Ärmel, Knieschoner, Holster …) × 3 Detailstufen → eine geteilte, gecachte Geometrie.
// Farben kommen über Palettenplätze aus dem Material (Farbschema) → dieselbe Geometrie für alle Schemata.
// Koordinaten: Modellraum der Bindepose (Füße im Ursprung, Blick −Z, rechts +X, Arme hängen).
// Körper (15.11., soldier-body-v2): ein durchgehendes, weich gehäutetes Netz aus tools/assets/soldier/build_body.py
// (MakeHuman-Grundnetz, CC0; body-mesh.js) mit Kleidungshülle; zivile Ausführungen bekommen einen eigenen, schmaleren Körper –
// Muskeln, Uniform mit Falten/Taschen, Stiefel, Handschuhe, Kopf; Bereiche → Materialien je Ausführung.
// Ausrüstung aus abgerundeten Quadern; auf Stufe 2 nur noch die Silhouette tragenden Teile.
// Gesichter sind verdeckt (Realismus-Plan C1: Sturmhaube, Halstuch, Shemagh, Gasmaske + Schutzbrillen) – wie Bodycam,
// das Gesichter verpixelt; so entsteht kein „Uncanny Valley“ aus der Nähe.
// 20.11. (Strang „mensch“, Vorbilder: Aufbau von Kampfstiefeln, Plattenträgern, Feldanzügen, Strick/Mantel – siehe Bericht):
// Stiefel mit Leisten, Profilsohle, Ösen/Schnellhaken und Schnürung; Taschenklappen mit Knöpfen am Feldanzug; Träger neu am
// Körper abgegriffen; Zivilkleidung (Pullover, Mantel mit weich gehäuteten Schößen, Kragen am gemessenen Halsausschnitt),
// Zivilistinnen mit eigenem Körper und Frisur; Hautton je Soldat über den Palettenplatz 'skin'.
import * as THREE from 'three';
import { SkinBuilder, limb, rbox, ellipsoid, cyl, torus, xf, lathe } from './builder.js?v=20261115041504';
import { hullShell, hullP, hullN, hullPath, sweep, rectProfile, roundProfile, onHull, pad, rectPoly, place, curve } from './gear-parts.js?v=20261115041504';
import { SKIN_TONES } from './materials.js?v=20261115041504';
import { BONE, DIM } from './rig.js?v=20261115041504';
import { BODY_MESH } from './body-mesh.js?v=20261115041504';

export const VARIANTS = [
  // Nutzer 16.10.: Grundausführungen wie die Soldaten im Video – Helm mit Tarnbezug (ohne Nachtsicht), dunkle
  // Sturmhaube/Halstuch, Plattenträger, großer Rucksack; Abwechslung nur noch über Weste, Rucksack und Kleinteile
  { id: 'sturm', name: 'Sturm', shirt: 'combat', head: 'helmet', cover: true, ears: true, face: 'balaclava', eyes: null, vest: 'plate', back: 'assault', knees: true, holster: true, sleeves: 'long', skin: 1, hair: '#2a2119' },
  { id: 'spaeher', name: 'Späher', head: 'boonie', veil: true, face: 'gaiter', eyes: null, vest: 'rig', back: 'assault', knees: false, holster: false, sleeves: 'long', skin: 2, hair: '#3b2a1c' },
  { id: 'funker', name: 'Funker', shirt: 'combat', head: 'helmet', cover: true, ears: true, face: 'balaclava', eyes: null, vest: 'plate', back: 'radio', knees: false, holster: true, sleeves: 'long', skin: 0, hair: '#5a4026' },
  { id: 'grenadier', name: 'Grenadier', shirt: 'combat', head: 'helmet', cover: true, face: 'balaclava', eyes: null, vest: 'plate', back: 'assault', knees: true, dump: true, sleeves: 'long', skin: 3, hair: '#18120d' },
  { id: 'schatten', name: 'Schatten', head: 'helmet', cover: true, face: 'balaclava', eyes: null, vest: 'light', back: 'assault', knees: false, holster: true, sleeves: 'long', skin: 4, hair: '#141110' },
  { id: 'bastion', name: 'Bastion', shirt: 'combat', head: 'helmet', cover: true, face: 'balaclava', eyes: null, vest: 'heavy', back: 'none', knees: true, pauldrons: true, dump: true, sleeves: 'long', skin: 1, hair: '#2a2119' },
  { id: 'kundschafter', name: 'Kundschafter', head: 'cap', capBack: true, ears: true, face: 'gaiter', eyes: null, vest: 'rig', back: 'assault', knees: true, sleeves: 'long', skin: 5, hair: '#4a3420' },
  { id: 'pionier', name: 'Pionier', shirt: 'combat', head: 'helmet', cover: true, ears: true, face: 'balaclava', eyes: null, vest: 'plate', back: 'assault', knees: true, holster: true, dump: true, sleeves: 'rolled', skin: 2, hair: '#2e2016' },
  // Klassen-Ausführungen (bots-scale): Sanitäter (leichte Weste, Armbinde mit rotem Kreuz, Sanitätstasche), Panzerpionier
  // (schwere Weste mit Schulterschutz, Werfer RW-90 auf dem Rücken), Scharfschütze (Tarnüberwurf/„Ghillie“ über Kopf und Schultern)
  { id: 'sanitaeter', name: 'Sanitäter', shirt: 'combat', head: 'helmet', cover: true, ears: true, face: 'gaiter', eyes: 'glasses', vest: 'light', back: 'medbag', armband: 'medic', knees: false, holster: true, sleeves: 'long', skin: 3, hair: '#2a2119' },
  { id: 'panzerpionier', name: 'Panzerpionier', shirt: 'combat', head: 'helmet', face: 'balaclava', eyes: 'goggles', vest: 'heavy', back: 'launcher', knees: true, pauldrons: true, dump: true, sleeves: 'long', skin: 0, hair: '#18120d' },
  { id: 'scharfschuetze', name: 'Scharfschütze', head: 'boonie', face: 'shemagh', eyes: null, shemagh: true, vest: 'rig', back: 'hydration', ghillie: true, knees: false, holster: false, sleeves: 'rolled', skin: 5, hair: '#3b2a1c' },
];
export const VARIANT_IDS = VARIANTS.map((v) => v.id);

/**
 * Zivile Kleidung (sol 15.11.; Kampagne: Geiseln, Einwohner, Arbeiter, Kapitän, Archivare) – NICHT in VARIANTS, damit Bots
 * und Zufallsauswahl sie nie bekommen; createSoldier({ variant: 'zivil' … }) nimmt sie über die Id. Kein Helm, keine Weste,
 * kein Gürtelzeug, keine Teamabzeichen; Jacke/Hemd/Strickjacke, Hose, Halbschuhe, bloße Hände.
 */
export const CIVIL_VARIANTS = [
  { id: 'zivil', name: 'Zivilist (Jacke)', civil: true, top: 'jacke', topColor: '#4d5a52', shirtColor: '#b9b3a6', pantsColor: '#3d4757', shoeColor: '#3b2d23', sleeves: 'long', skin: 0, hair: '#3b2a1c' },
  { id: 'zivil-hemd', name: 'Zivilist (Hemd)', civil: true, top: 'hemd', topColor: '#7f93a6', shirtColor: '#7f93a6', pantsColor: '#5b5246', shoeColor: '#2b2622', sleeves: 'rolled', skin: 2, hair: '#2a2119' },
  // 20.11.: Zivilistinnen mit eigenem (weiblichem) Körper und Kopf (MakeHuman weiblich, CC0) und Frisur als Geometrie –
  // Kampagne: Kommissarin Haas, Dr. Lindner, Einwohnerinnen, Delegierte
  { id: 'zivil-strick', name: 'Zivilistin (Strickjacke)', civil: true, female: true, top: 'strick', topColor: '#7a5f50', shirtColor: '#cfc6b4', pantsColor: '#2f3238', shoeColor: '#241f1c', sleeves: 'long', skin: 5, hair: '#4a3420', hairStyle: 'dutt' },
  { id: 'zivil-arbeit', name: 'Arbeiter', civil: true, top: 'jacke', topColor: '#33465e', shirtColor: '#8c8a80', pantsColor: '#3a3f47', shoeColor: '#2e2a26', sleeves: 'long', skin: 3, hair: '#18120d', hiVis: true },
  { id: 'kapitaen', name: 'Kapitän', civil: true, top: 'jacke', topColor: '#1e2838', shirtColor: '#d8d6cf', pantsColor: '#23272e', shoeColor: '#1b1a19', sleeves: 'long', skin: 0, hair: '#5a4026' },
  // 20.11.: mehr Abwechslung – Pullover mit Rippbündchen, knielanger Mantel mit Revers; Männer und Frauen
  { id: 'zivil-pullover', name: 'Zivilist (Pullover)', civil: true, top: 'pullover', topColor: '#5c3431', shirtColor: '#c9c3b5', pantsColor: '#34465e', shoeColor: '#2a2420', sleeves: 'long', skin: 1, hair: '#2a2119', jeans: true },
  { id: 'zivil-mantel', name: 'Zivilist (Mantel)', civil: true, top: 'mantel', topColor: '#3d3a35', shirtColor: '#d6d3cb', pantsColor: '#2b2d31', shoeColor: '#1c1a18', sleeves: 'long', skin: 0, hair: '#3b2a1c' },
  { id: 'zivilistin-mantel', name: 'Zivilistin (Mantel)', civil: true, female: true, top: 'mantel', topColor: '#7a6249', shirtColor: '#e0dbd0', pantsColor: '#2a2c33', shoeColor: '#2a1f19', sleeves: 'long', skin: 2, hair: '#2a1d15', hairStyle: 'zopf' },
  { id: 'zivilistin-pullover', name: 'Zivilistin (Pullover)', civil: true, female: true, top: 'pullover', topColor: '#8e8878', shirtColor: '#e0dbd0', pantsColor: '#3b4a63', shoeColor: '#3a2d24', sleeves: 'long', skin: 4, hair: '#3a281b', hairStyle: 'offen', jeans: true },
];
export const CIVIL_IDS = CIVIL_VARIANTS.map((v) => v.id);
/** Ausführung (Soldat oder zivil) zu einer Id; unbekannt → erste Soldaten-Ausführung. */
export function variantDef(id) {
  return VARIANTS.find((v) => v.id === id) || CIVIL_VARIANTS.find((v) => v.id === id) || VARIANTS[0];
}

// Auflösung der Ausrüstungsteile je Detailstufe (Körper selbst: body-mesh.js mit eigenen Stufen 7000/2600/700 Dreiecke):
// Profilsegmente, Ringe, Kappenringe, Rundquader, Kugel-Segmente, Zylinder
const Q = [
  { seg: 16, tseg: 14, rings: 3, cap: 3, rb: 2, sw: 16, sh: 10, cs: 12, smooth: 2 },
  { seg: 10, tseg: 10, rings: 2, cap: 2, rb: 1, sw: 11, sh: 7, cs: 8, smooth: 1 },
  { seg: 4, tseg: 6, rings: 1, cap: 1, rb: 0, sw: 6, sh: 3, cs: 4, smooth: 0 },
];

const cache = new Map();

// Körpernetz je Detailstufe dekodieren (einmalig, geteilt von allen Ausführungen)
const bodyCache = [];
function b64(str, T) {
  const bin = atob(str), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new T(u.buffer);
}
function bodyMesh(lod, civil = false, female = false) {
  // soldier-body-v2: eigener Zivilkörper (schmaler, ohne Uniform); v3 (20.11.): weiblicher Zivilkörper
  const fem = civil && female && BODY_MESH.female;
  const ck = fem ? lod + 6 : civil && BODY_MESH.civil ? lod + 3 : lod;
  if (bodyCache[ck]) return bodyCache[ck];
  const E = (ck > 5 ? BODY_MESH.female : ck > 2 ? BODY_MESH.civil : BODY_MESH.lods)[lod];
  const P = b64(E.pos, Uint16Array), N = b64(E.nrm, Int8Array), U = b64(E.uv, Int16Array);
  const pos = new Float32Array(E.n * 3), nrm = new Float32Array(E.n * 3), uv = new Float32Array(E.n * 2);
  for (let v = 0; v < E.n; v++) {
    for (let k = 0; k < 3; k++) { pos[v * 3 + k] = E.lo[k] + P[v * 3 + k] * E.sc[k]; nrm[v * 3 + k] = N[v * 3 + k] / 127; }
    uv[v * 2] = U[v * 2] / 16000; uv[v * 2 + 1] = U[v * 2 + 1] / 16000;
  }
  const D0 = { n: E.n, pos, nrm, uv, idx: b64(E.idx, Uint16Array), ski: b64(E.ski, Uint8Array), skw: b64(E.skw, Uint8Array), reg: b64(E.reg, Uint8Array), ao: b64(E.ao, Uint8Array) };
  // gesamt 20.11.: Bereiche der gröbsten Stufe aus Stufe 0 übernehmen (nächste Ecke mit ähnlicher Normale). Die erzeugten
  // Bereichsdaten der Uniform-Stufe 2 waren vertauscht (Gesicht/Schädel an Oberschenkeln und Brust → Hautflecken auf low).
  if (lod === 2) {
    // mensch3: nur Ecken desselben Hauptknochens (sonst holten Oberarm-Ecken der Zivilisten Hals-/Handbereiche → Hautstreifen)
    const B0 = bodyMesh(0, civil, female), r = D0.reg, sk = D0.ski;
    for (let v = 0; v < E.n; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
      let best = Infinity, br = r[v], best2 = Infinity, br2 = r[v];
      for (let u = 0; u < B0.n; u++) {
        const dx = B0.pos[u * 3] - x, dy = B0.pos[u * 3 + 1] - y, dz = B0.pos[u * 3 + 2] - z;
        const q = dx * dx + dy * dy + dz * dz;
        if (q < best && B0.nrm[u * 3] * nx + B0.nrm[u * 3 + 1] * ny + B0.nrm[u * 3 + 2] * nz > 0.2) {
          if (B0.ski[u * 4] === sk[v * 4]) { best = q; br = B0.reg[u]; } else if (q < best2) { best2 = q; br2 = B0.reg[u]; }
        }
      }
      r[v] = best < Infinity ? br : br2;
      // Oberkopf der gröbsten Stufe: nur wenige Schädel-Ecken → Kopf wirkte kahl (Hautton über den ganzen Kopf gemischt)
      if (sk[v * 4] === BONE.head && y > 1.72 && !(z < -0.065 && y < 1.765) && BODY_MESH.regions.SKULL !== undefined) r[v] = BODY_MESH.regions.SKULL;
    }
  }
  bodyCache[ck] = D0;
  return D0;
}

// Helm nach hinten gekippt (≈ 17°): Vorderkante über den Augenbrauen, Nackenschutz hinten tiefer – wie ein echter Helm
const HELMET_TILT = new THREE.Matrix4().makeTranslation(0, 1.712, 0.006)
  .multiply(new THREE.Matrix4().makeRotationX(0.3))
  .multiply(new THREE.Matrix4().makeTranslation(0, -1.712, -0.006));
const tiltHelmet = (g) => g.applyMatrix4(HELMET_TILT);
void tiltHelmet;
/** Helmrand (θ ab Scheitel, rad) je Richtung φ (gear-parts.js): vorn 74° (≈ 2,5 cm über den Brauen), seitlich 93° mit
 *  Ausschnitt über den Ohren (High-Cut), hinten 117° (tief über den Hinterkopf). */
function helmetRim(ph) {
  const s = Math.sin(ph), c = Math.cos(ph);
  // vorn über einen breiten Bogen hoch (Stirn/Brauenbogen bleiben frei, kein Krempen-Effekt an den Schläfen), dann zum Ohr
  let th = s < 0 ? 93 - 19 * Math.pow(Math.min(1, -s * 1.35), 0.8) : 93 + 24 * s;
  th -= 6 * Math.exp(-((1 - Math.abs(c)) ** 2) / 0.004);
  return (th * Math.PI) / 180;
}
// Umgebungsverdeckung je Detailstufe (Strahlen, Zellmaß)
const AO = [{ cell: 0.02, dirs: 8 }, { cell: 0.022, dirs: 8 }, { cell: 0.03, dirs: 6, steps: [0.04, 0.09, 0.16] }];

/**
 * Geometrie (gecacht) für Variante × Detailstufe. noHead: Kopf (Schädel, Gesicht, Augen, Ohren) weglassen – den zeichnet
 * dann face.js (modellierter Kopf mit Mimik, nur Detailstufe 0) – als Ansicht derselben Puffer (headlessView). `schemeId` wird ignoriert (Farben aus dem Material) und bleibt
 * nur für die bisherige Signatur erhalten.
 */
export function soldierGeometry(variantId, schemeId, lod = 0, { noHead = false } = {}) {
  void schemeId;
  const l = Math.max(0, Math.min(2, lod | 0));
  const key = `${variantId}|${l}`;
  let g = cache.get(key);
  if (!g) {
    const v = variantDef(variantId);
    g = buildSoldier(v, l);
    g.userData.key = key;
    cache.set(key, g);
  }
  return noHead ? headlessView(g) : g;
}

/**
 * Ansicht ohne Kopf: dieselben Puffer (Attribute + Index, kein zweiter Upload), nur der drawRange endet vor den
 * Kopf-Dreiecken (builder: tail → ans Ende sortiert). Wird mit der Geometrie zusammen freigegeben.
 */
function headlessView(g) {
  let v = g.userData.headlessView;
  if (v) return v;
  v = new THREE.BufferGeometry();
  for (const k of Object.keys(g.attributes)) v.setAttribute(k, g.attributes[k]);
  v.setIndex(g.index);
  v.setDrawRange(0, g.userData.tailStart ?? g.index.count);
  v.boundingSphere = g.boundingSphere; v.boundingBox = g.boundingBox;
  v.userData = { key: g.userData.key + '|ohneKopf', variant: g.userData.variant, lod: g.userData.lod, triangles: (g.userData.tailStart ?? g.index.count) / 3, bytes: 0, headless: true };
  g.userData.headlessView = v;
  return v;
}

/** Gecachte Geometrien (Diagnose/Speicherschätzung): { count, bytes, triangles: {key: n} } */
export function soldierGeometryStats() {
  let bytes = 0;
  const triangles = {};
  for (const [k, g] of cache) { bytes += g.userData.bytes || 0; triangles[k] = g.userData.triangles; }
  return { count: cache.size, bytes, triangles };
}

export function disposeSoldierGeometries() {
  for (const g of cache.values()) { if (g.userData.headlessView) g.userData.headlessView.dispose(); g.dispose(); }
  cache.clear();
}

/* ======================================================================== Aufbau */

/**
 * Statur (Nutzer 16.10.: „viel zu dünn – schau dir die Breite an“): die Video-Soldaten sind wuchtig – breiter Rumpf mit
 * dicker Uniform, Weste und Rucksack, kräftige Arme und Beine. Die Maße unten sind für die schlanke Grundfigur
 * (Schulter bei x = ±0,19) geschrieben; je Knochen wird quer um die Gliedachse skaliert und die Arme auf die neue
 * Schulterbreite (DIM.shoulderX) geschoben. Kopf/Helm bleiben gleich groß.
 */
function bulkTable() {
  // 21.10.: Der Körper (body-mesh.js) hat seine Endmaße; skaliert werden nur noch die auf die alte Grundfigur
  // geschriebenen Ausrüstungsteile am Rumpf (Weste, Gürtel, Taschen, Rucksack sitzen so auf dem kräftigeren Rumpf).
  const T = {};
  const set = (name, o) => { T[BONE[name]] = { cx: 0, cz: 0, sx: 1, sz: 1, tx: 0, ...o }; };
  // 15.11. (soldier-body-v2, MakeHuman-Körper): Rumpf schlanker und in der Tiefe nach vorn verlagert (Rücken flacher als
  // der alte Kastenrumpf) → Querschnitte je Höhe neu gemessen (build_body.py) und die Faktoren/Versätze daran angepasst
  set('hips', { cz: 0.006, sx: 1.107, sz: 1.114, tz: -0.0376 });
  set('spine', { cz: 0.006, sx: 1.095, sz: 1.047, tz: -0.0344 });
  set('chest', { cz: 0.006, sx: 1.106, sz: 1.082, tz: -0.0193 });
  set('neck', { cz: 0.012, sx: 1.22, sz: 1.22 });
  return T;
}
const BULK = bulkTable();

// Gurtverläufe über die Schulter als (y, z)-Punkte vor der BULK-Skalierung. 20.11.: am Körper v3 (body-mesh.js, Stufe 0) neu
// abgegriffen – Schnitt bei x = 0,111 bzw. 0,138 (nach BULK), äußerste Kontur je Winkel um (y 1,40, z 0) + Gurtdicke (Weste 1,1 cm,
// Rucksack 2,6 cm – liegt über dem Westenträger), geglättet; vorher schwebte der Träger vorn 2–4 cm über der Brust und tauchte
// hinten 3–5 cm in den Rücken. Westenträger von der Front- zur Rückenplatte, Rucksackträger vom Rucksack über die Schulter nach vorn.
const VEST_STRAP = [[1.432, -0.118], [1.442, -0.092], [1.45, -0.072], [1.47, -0.058], [1.483, -0.048], [1.492, -0.04], [1.501, -0.032], [1.509, -0.024], [1.516, -0.014], [1.523, -0.004], [1.532, 0.007], [1.544, 0.02], [1.555, 0.034], [1.562, 0.05], [1.566, 0.067], [1.567, 0.084], [1.563, 0.101], [1.555, 0.117], [1.541, 0.128], [1.518, 0.134], [1.49, 0.135], [1.467, 0.136], [1.45, 0.137], [1.44, 0.14]];
const PACK_STRAP = [[1.44, 0.165], [1.454, 0.146], [1.473, 0.149], [1.494, 0.149], [1.516, 0.143], [1.538, 0.132], [1.556, 0.118], [1.567, 0.102], [1.573, 0.086], [1.574, 0.069], [1.571, 0.051], [1.565, 0.034], [1.557, 0.018], [1.544, 0.0], [1.524, -0.022], [1.503, -0.045], [1.486, -0.06], [1.475, -0.069], [1.466, -0.076]];

function buildSoldier(V, lod) {
  const q = Q[lod];
  const B = new SkinBuilder({ ao: globalThis.__npNoAO ? null : AO[lod], bulk: BULK });
  const L0 = lod === 0, L01 = lod <= 1, FAR = lod === 2;

  // Materialien: color = feste Farbe (sRGB-Hex), pal = Schemafarbe (+ shade = sRGB-Faktor); cls = Materialklasse
  const C = {
    top: { color: '#dadada', camo: 1, detail: 1, cls: 'cloth' },
    // Kampfhemd (unter der Weste): einfarbiger Rumpf aus Funktionsstoff, Ärmel im Tarnmuster
    shirt: { pal: 'gear', shade: 0.9, detail: 1, cls: 'cloth' },
    pants: { color: '#c6c6c6', camo: 1, detail: 1, cls: 'cloth', wear: 0.3 },
    cover: { color: '#d2d2d2', camo: 1, detail: 1, cls: 'cloth' }, // Helmbezug im Tarnmuster
    // Weste, Taschen, Rucksack im Uniform-Tarn wie im Video (etwas dunkler als der Stoff, damit sich die Teile absetzen)
    gear: { color: '#c4c4c4', camo: 1, detail: 1, shine: 0.04, cls: 'gear' },
    gear2: { color: '#b2b2b2', camo: 1, detail: 1, shine: 0.04, cls: 'gear' },
    flap: { color: '#a8a8a8', camo: 1, detail: 1, shine: 0.04, cls: 'gear' },
    web: { color: '#8a8a8a', camo: 1, detail: 1, shine: 0.03, cls: 'gear' }, // MOLLE-Gurtband (Tarnstoff, dunkler)
    strap: { pal: 'strap', detail: 0.8, cls: 'gear' },
    helmet: { pal: 'helmet', detail: 0.6, shine: 0.16, cls: 'hard' },
    helmetDark: { pal: 'helmet', shade: 0.78, detail: 0.6, shine: 0.16, cls: 'hard' },
    // 20.11.: Hautton über den Palettenplatz 'skin' (je Soldat gleich dem Gesicht, character.js) statt fest je Ausführung
    skin: { pal: 'skin', detail: 0.6, shine: 0.3, cls: 'skin' },
    hair: { color: V.hair, detail: 0.8, shine: 0.08, cls: 'cloth' },
    glove: { pal: 'glove', detail: 0.8, shine: 0.16, cls: 'leather', wear: 0.5 },
    // 20.11.: Kampfstiefel sind mattes Rauleder/Cordura – vorher glänzend (0,3) → spiegelte den hellen Himmel und wirkte grau
    boot: { pal: 'boot', detail: 0.9, shine: 0.06, cls: 'leather', wear: 0.35 },
    sole: { color: '#1d1d1e', detail: 0.4, shine: 0.08, cls: 'leather' }, // mensch3: Gummi wie Leder (kaum Staub) – Sohlenbereich reicht zackig auf die Kappe (las sich als helle Streifen)
    metal: { pal: 'metal', detail: 0.2, shine: 0.88, cls: 'hard' },
    plastic: { color: '#1e2022', detail: 0.5, shine: 0.42, cls: 'hard' },
    lens: { color: '#0b1014', detail: 0, shine: 1, cls: 'glass' },
    smoke: { color: '#2b3034', detail: 0, shine: 1, cls: 'glass' }, // Schießbrille (getönt)
    accent: { pal: 'accent', shade: 0.6, detail: 0, emis: 0, shine: 0.3, cls: 'hard' },
    // Teamfarben-Band am Oberarm: gedeckt, ohne Leuchten (16.10.: im Video gibt es keine leuchtenden Bänder;
    // Teams erkennt man über Namensschild, Randlicht der Gegner und dieses Band)
    band: { pal: 'accent', shade: 0.46, detail: 0.6, emis: 0, shine: 0.1, cls: 'gear' },
    // Schutzbrille/Maskengläser: hellgrau spiegelnd mit kleinem Glanzlicht → Blickrichtung lesbar
    visor: { color: '#8ea4b0', detail: 0, shine: 1, emis: 0.1, cls: 'glass' },
    mag: { color: '#2a2b2c', detail: 0.4, shine: 0.55, cls: 'hard' },
    knee: { pal: 'gear2', shade: 0.85, detail: 0.7, shine: 0.2, cls: 'hard', wear: 0.8 },
    eye: { color: '#17120e', detail: 0, shine: 0.9, cls: 'glass' },
    eyeWhite: { color: '#a89d90', detail: 0, shine: 0.6, cls: 'glass' },
    socket: { pal: 'skin', shade: 0.66, detail: 0.4, shine: 0.12, cls: 'skin' }, // Augenpartie (Schatten unter der Stirn)
    brow: { color: shade(V.hair, 0.9), detail: 0.6, shine: 0.05, cls: 'cloth' },
    patch: { pal: 'gear', shade: 0.72, detail: 1, cls: 'gear' },
    knit: { color: '#2a2b2c', detail: 1, shine: 0, cls: 'cloth' },
    sand: { color: '#4b4c3c', detail: 1, cls: 'cloth' }, // Shemagh (dunkles Oliv – heller Sand las sich als Haut)
    // bots-scale: Sanitäter-Kennzeichen, Werferrohr, Tarnüberwurf (Jute-Streifen)
    medWhite: { color: '#d4d2c8', detail: 0.4, shine: 0.1, emis: 0.12, cls: 'cloth' },
    medRed: { color: '#9a1c18', detail: 0.3, shine: 0.1, emis: 0.1, cls: 'cloth' },
    tube: { color: '#3c4130', detail: 0.6, shine: 0.22, cls: 'hard', wear: 0.5 },
    jute: { color: '#55553a', camo: 0.5, detail: 1, shine: 0, cls: 'cloth' },
    jute2: { color: '#6b6444', detail: 1, shine: 0, cls: 'cloth' },
    jute3: { color: '#4a4f33', camo: 0.35, detail: 1, shine: 0, cls: 'cloth' }, // grünlicher Bast
    jute4: { color: '#7a6f4a', detail: 1, shine: 0, cls: 'cloth' }, // trockenes Gras
  };
  const covered = V.face === 'balaclava';
  const lowerCovered = covered || V.face === 'gaiter' || V.face === 'shemagh' || V.face === 'gasmask';
  // Sturmhaube: dunkler Stoff in Ausrüstungsfarbe; Halstuch im Tarnmuster der Uniform; Shemagh oliv-braun
  const faceFab = V.face === 'shemagh' ? C.sand : V.face === 'gaiter' ? { color: '#bdbdbd', camo: 1, detail: 1, cls: 'cloth' } : { pal: 'gear2', shade: 0.72, detail: 1, cls: 'cloth' };
  const add = (geo, bone, mat) => B.add(geo, { bone, ...mat });
  const pair = (geo, boneL, boneR, mat) => B.add(geo, { bone: boneL, mirrorBone: boneR, ...mat });
  const R = (w, h, d, r, opts) => rbox(w, h, d, r, q.rb, opts);
  const E = (rx, ry, rz, opts, cut, ws = q.sw, hs = q.sh) => ellipsoid(rx, ry, rz, FAR ? Math.min(ws, 6) : ws, FAR ? Math.min(hs, 3) : hs, opts, cut);
  // Tasche mit Deckel (Deckel oben, rundum etwas größer → liest sich als überstehende Klappe)
  const pouch = (w, h, d, x, y, z, bone = 'chest', mat = C.gear2) => {
    add(R(w, h, d, Math.min(0.014, d * 0.3), { p: [x, y, z] }), bone, mat);
    if (L0) {
      add(rbox(w + 0.006, h * 0.3, d + 0.006, 0.004, 1, { p: [x, y + h * 0.36, z] }), bone, C.flap);
      // Klettlasche unter dem Deckel + senkrechte Gurtschlaufe (MOLLE-Befestigung) vorn
      add(rbox(Math.min(0.026, w * 0.4), 0.018, 0.004, 0, 0, { p: [x, y + h * 0.17, z - d / 2 - 0.004] }), bone, C.strap);
      add(rbox(0.012, h * 0.5, 0.004, 0, 0, { p: [x, y - h * 0.12, z - d / 2 - 0.002] }), bone, C.web);
    }
  };
  // MOLLE-Feld: Reihen aus kurzen Gurtschlaufen mit Lücken (liest sich als Gurtband statt als Streifen)
  const molle = (x0, x1, y0, rows, z, bone = 'chest', dz = -1, bend = 0) => {
    const n = Math.max(1, Math.round((x1 - x0) / 0.038));
    const step = (x1 - x0) / n;
    // bend: Wölbung der Unterlage (z += bend·x² zur Mitte hin) – Schlaufen liegen auf der gebogenen Platte
    for (let i = 0; i < rows; i++) for (let k = 0; k < n; k++) {
      const xc = x0 + (k + 0.5) * step;
      add(rbox(step - 0.007, 0.0095, 0.005, 0, 0, { p: [xc, y0 + i * 0.026, z + dz * 0.0025 - dz * bend * xc * xc], r: [0, dz * 2 * bend * xc, 0] }), bone, C.web);
    }
  };
  const PLAST = { ...C.plastic, shine: 0.3 };
  const PKs = L0 ? { k: 3, fr: 2, bv: 4 } : L01 ? { k: 1, fr: 1, bv: 2 } : { k: 1, fr: 0, bv: 1 };
  // Gurt entlang eines (y, z)-Pfads, gespiegelt links/rechts bei ±x (step > 1 dünnt den Pfad für ferne LODs aus)
  const strapPath = (pts, x, w, th, mat, step = 1) => {
    const P = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    for (let i = 0; i + 1 < P.length; i++) {
      const [y0, z0] = P[i], [y1, z1] = P[i + 1];
      const len = Math.hypot(y1 - y0, z1 - z0);
      pair(rbox(w, len + th * 0.8, th, 0, 0, { p: [-x, (y0 + y1) / 2, (z0 + z1) / 2], r: [Math.atan2(z1 - z0, y1 - y0), 0, 0] }), 'chest', 'chest', mat);
    }
  };

  /* ------------------------------------------------------------ Körper (ein Guss, body-mesh.js) */
  // 21.10. (Nutzer: „wie B1-Kampfdroiden“): durchgehender Körper mit Muskeln, Uniformfalten, Taschen, Stiefeln und
  // Handschuhen, weich gehäutet (Schultern/Ellbogen/Knie verformen sich statt starrer Röhren). Bereiche → Materialien
  // je Ausführung (Kampfhemd mit einfarbigem Rumpf unter der Weste, hochgekrempelte Ärmel, Sturmhaube …).
  const RG = BODY_MESH.regions;
  const rolled = V.sleeves === 'rolled';
  // zivil: einfarbige Stoffe (Jacke/Hemd/Strick, Hose), Halbschuhe, bloße Hände
  const knit = V.top === 'strick' || V.top === 'pullover';
  const civ = V.civil ? {
    top: { color: V.topColor, detail: knit ? 1.0 : V.top === 'mantel' ? 0.8 : 0.55, shine: V.top === 'jacke' ? 0.06 : 0, cls: 'cloth', wear: 0.2 },
    shirt: { color: V.shirtColor, detail: 0.45, cls: 'cloth' },
    pants: { color: V.pantsColor, detail: V.jeans ? 1.0 : 0.7, cls: 'cloth', wear: V.jeans ? 0.6 : 0.35 },
    shoe: { color: V.shoeColor, detail: 0.7, shine: 0.35, cls: 'leather', wear: 0.4 },
  } : null;
  const bodyMat = (r) => {
    if (civ) switch (r) {
      case RG.SHIRT: case RG.SLEEVE: return civ.top;
      case RG.COLLAR: return V.top === 'hemd' ? civ.shirt : civ.top;
      case RG.FOREARM: return rolled ? C.skin : civ.top;
      case RG.GLOVE: return C.skin;
      case RG.PANTS: case RG.POCKET: case RG.PAD: return civ.pants;
      case RG.BOOT: case RG.TOE: case RG.TONGUE: return civ.shoe;
      case RG.SOLE: return C.sole;
      case RG.NECK: case RG.EARS: case RG.EYES: case RG.FACE: return C.skin;
      case RG.SKULL: return C.hair;
      default: return civ.top;
    }
    switch (r) {
      case RG.SHIRT: return V.shirt === 'combat' ? C.shirt : C.top;
      case RG.COLLAR: return V.shirt === 'combat' ? C.shirt : C.top;
      case RG.SLEEVE: return C.top;
      case RG.FOREARM: return rolled ? C.skin : C.top;
      case RG.GLOVE: return C.glove;
      case RG.PANTS: return C.pants;
      case RG.POCKET: return { ...C.pants, color: '#cfcfcf', wear: 0.45 };
      case RG.PAD: return { color: '#a9a9a9', camo: 1, detail: 1, cls: 'gear', wear: 0.6 }; // Polstertaschen (Cordura, dunkler)
      case RG.BOOT: return C.boot;
      // 20.11.: Zehenkappe (glatteres, dunkleres Leder) und Lasche/Schnürbereich (Cordura) – Aufbau echter Kampfstiefel
      // mensch3: Kappe/Lasche nur noch ein Hauch abgesetzt – die Bereichsgrenzen verlaufen im Netz zackig über die Dreiecke
      // (las sich als helle/dunkle Streifen auf dem Stiefel)
      case RG.TOE: return { pal: 'boot', shade: 0.95, detail: 0.6, shine: 0.12, cls: 'leather', wear: 0.45 };
      case RG.TONGUE: return { pal: 'boot', shade: 1.02, detail: 0.9, shine: 0.06, cls: 'leather', wear: 0.4 };
      case RG.SOLE: return C.sole;
      case RG.NECK: return covered || V.face === 'gaiter' ? faceFab : V.shemagh ? C.sand : C.skin;
      case RG.SKULL: return covered ? faceFab : V.shemagh ? C.sand : V.head === 'wrap' ? { pal: 'gear2', shade: 1.05, detail: 1, cls: 'cloth' } : C.hair;
      case RG.EARS: return covered ? faceFab : C.skin;
      case RG.EYES: return covered ? C.socket : C.skin;
      case RG.FACE: return lowerCovered && V.face !== 'gasmask' ? faceFab : C.skin;
      default: return C.top;
    }
  };
  // zivil: Uniform-Brusttaschen gehören zum Oberteil (Bereich POCKET gilt sonst für Hosentaschen)
  let BM = bodyMesh(lod, !!V.civil, !!V.female);
  // Messkörper (Stufe 0): Stoffoberfläche für Taschenklappen, Bündchen, Kragen
  const BM0 = bodyMesh(0, !!V.civil, !!V.female);
  if (civ) {
    const reg = BM.reg.slice();
    for (let i = 0; i < BM.n; i++) if (reg[i] === RG.POCKET && BM.pos[i * 3 + 1] > 1.0) reg[i] = RG.SHIRT;
    BM = { ...BM, reg };
  }
  B.addMesh(BM, bodyMat, L0 ? new Set([RG.NECK, RG.SKULL, RG.EYES, RG.FACE, RG.EARS]) : null);
  if (V.holster && !FAR) {
    // 15.11.: an den schlankeren Oberschenkel des MakeHuman-Körpers (Außenseite x ≈ 0,186, Mitte z ≈ −0,02) gerückt
    add(R(0.06, 0.17, 0.1, 0.022, { p: [0.214, 0.72, -0.004], r: [0.08, 0, -0.03] }), 'thighR', C.gear2);
    add(R(0.03, 0.075, 0.04, 0.008, { p: [0.216, 0.825, 0.029], r: [0.25, 0, -0.03] }), 'thighR', C.plastic);
    if (L01) add(torus(0.093, 0.008, 3, q.cs + 2, { p: [0.098, 0.62, -0.019], r: [Math.PI / 2, 0, 0], s: [1, 1.03, 1] }), 'thighR', C.strap);
  }
  // Knie-/Ellbogenschoner (sol 15.11.): gewölbte Hartschalen-Kissen um Knie bzw. Ellbogen gebogen, Haltegurte rundum
  const ring = (cx, y, cz, rx, rz, bone, mat, w = 0.012, n = 14) => {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz]); }
    const ups = pts.map((p) => { const dx = p[0] - cx, dz = p[2] - cz, l = Math.hypot(dx, dz); return [dx / l, 0, dz / l]; });
    pair(sweep(pts, ups, rectProfile(w, 0.003), { closed: true, smooth: false }), bone, bone.replace('L', 'R'), mat);
  };
  if (V.knees) {
    if (FAR) pair(R(0.12, 0.13, 0.04, 0.02, { p: [-0.106, 0.5, -0.09], r: [-0.1, 0, 0] }), 'shinL', 'shinR', C.knee);
    else {
      const kp = pad({ ...PKs, w: 0.108, h: 0.135, d: 0.03, rb: 0.012, rc: 0.032, puff: L0 ? 0.007 : 0.004, bend: [7, 2.5] });
      place(kp, { p: [-0.106, 0.502, -0.107], r: [-0.08, 0, 0] });
      pair(kp, 'shinL', 'shinR', C.knee);
      if (L0) {
        // Polsterrand hinter der Schale + Haltegurte (oben/unten) mit Steckschnalle außen
        const kp2 = pad({ k: 2, fr: 1, bv: 3, w: 0.118, h: 0.15, d: 0.012, rb: 0.005, rc: 0.035, bend: [7, 2.5] });
        place(kp2, { p: [-0.106, 0.5, -0.094], r: [-0.08, 0, 0] });
        pair(kp2, 'shinL', 'shinR', { pal: 'strap', shade: 0.9, detail: 1, cls: 'gear' });
        ring(-0.105, 0.452, 0, 0.08, 0.091, 'shinL', C.strap);
        pair(rbox(0.006, 0.02, 0.026, 0, 0, { p: [-0.181, 0.455, -0.01] }), 'shinL', 'shinR', PLAST);
      }
    }
    // Ellbogenschoner (gleiche Ausführungen; nur nah)
    if (L0) {
      const ep = pad({ ...PKs, w: 0.072, h: 0.092, d: 0.022, rb: 0.009, rc: 0.024, puff: L0 ? 0.005 : 0.003, bend: [10, 3] });
      place(ep, { r: [0, Math.PI, 0] });
      place(ep, { p: [-DIM.shoulderX - 0.006, 1.15, 0.066], r: [0.08, 0, 0] });
      pair(ep, 'foreArmL', 'foreArmR', C.knee);
      if (L0) ring(-DIM.shoulderX - 0.006, 1.115, -0.004, 0.061, 0.062, 'foreArmL', C.strap, 0.01, 12);
    }
  }
  /* ------------------------------------------------------------ Messen am Körpernetz (Stufe 0, Bindehaltung) */
  // Abstand der Stoff-/Lederoberfläche von einer senkrechten Achse (ax, az) in Richtung (dx, dz), Höhe y (± dy)
  const ARMS = new Set([RG.SLEEVE, RG.FOREARM, RG.GLOVE]);
  // Strahl von der Achse (ax, y, az) in Richtung (dx, 0, dz): fernster Schnitt mit den Dreiecken des Körpernetzes (Stoff-
  // oberfläche); filter true = ohne Arme, 'arm' = nur Arme. → Abstand (0 = kein Treffer)
  const surfAt = (y, ax, az, dx, dz, dy = 0.012, cone = 0.35, filter = false) => {
    void dy; void cone;
    const P = BM0.pos, RR = BM0.reg, I = BM0.idx;
    const dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
    let best = 0;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      if (filter === true && (ARMS.has(RR[a]) || ARMS.has(RR[b]) || ARMS.has(RR[c]))) continue;
      if (filter === 'arm' && !(ARMS.has(RR[a]) && ARMS.has(RR[b]) && ARMS.has(RR[c]))) continue;
      if (filter === 'neck' && !(RR[a] === RG.NECK && RR[b] === RG.NECK && RR[c] === RG.NECK)) continue;
      const ay = P[a * 3 + 1], by = P[b * 3 + 1], cy = P[c * 3 + 1];
      if ((ay > y && by > y && cy > y) || (ay < y && by < y && cy < y)) continue;
      // Möller–Trumbore
      const ax_ = P[a * 3] - ax, az_ = P[a * 3 + 2] - az;
      const e1x = P[b * 3] - P[a * 3], e1y = by - ay, e1z = P[b * 3 + 2] - P[a * 3 + 2];
      const e2x = P[c * 3] - P[a * 3], e2y = cy - ay, e2z = P[c * 3 + 2] - P[a * 3 + 2];
      const px = -dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y; // d × e2 (d = (dx, 0, dz))
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det;
      const sx_ = -ax_, sy_ = y - ay, sz_ = -az_; // Ursprung − a
      const u = (sx_ * px + sy_ * py + sz_ * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = sy_ * e1z - sz_ * e1y, qy = sz_ * e1x - sx_ * e1z, qz = sx_ * e1y - sy_ * e1x;
      const v = (dx * qx + dz * qz) * inv;
      if (v < 0 || u + v > 1) continue;
      const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (tt > best && tt < 0.4) best = tt;
    }
    return best;
  };
  // dünner Steg von a nach b (Schnürsenkel, Gurt), Breite w, Dicke t
  const _qa = new THREE.Quaternion(), _ea = new THREE.Euler(), _up = new THREE.Vector3(0, 1, 0), _dv = new THREE.Vector3();
  const bar = (a, b, w, t) => {
    _dv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _dv.length();
    _qa.setFromUnitVectors(_up, _dv.normalize());
    _ea.setFromQuaternion(_qa, 'XYZ');
    return rbox(w, len + w * 0.6, t, 0, 0, { p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r: [_ea.x, _ea.y, _ea.z] });
  };

  /* ------------------------------------------------------------ Stiefel / Schuhe (20.11.) */
  // Nach dem Aufbau echter Kampfstiefel: Schnürung über Kreuz – unten Ösen, oben Schnellhaken –, Schleife, Zuglasche hinten,
  // Profil-Laufsohle mit Trennfuge Zwischen-/Laufsohle und Stollen am Rand. Lage aus body-mesh.js (boots: Vorderkante
  // entlang der Schnürung, Sohlenumriss des linken Fußes; rechts gespiegelt).
  const BT = BODY_MESH.boots && BODY_MESH.boots[civ ? 'civil' : 'soldier'];
  if (BT && !FAR) {
    const cx = BT.cx;
    const inst = BT.lace.filter((p) => p[0] < 0.158).sort((a, b) => a[0] - b[0]);
    const shaftZ = BT.lace.filter((p) => p[0] >= 0.158).reduce((m, p) => Math.min(m, p[1]), Infinity);
    const zAt = (y) => {
      let z = Infinity;
      if (inst.length && y <= inst[inst.length - 1][0] + 0.004) {
        if (y <= inst[0][0]) z = inst[0][1];
        else for (let i = 1; i < inst.length; i++) if (y <= inst[i][0]) { const t = (y - inst[i - 1][0]) / (inst[i][0] - inst[i - 1][0]); z = inst[i - 1][1] + (inst[i][1] - inst[i - 1][1]) * t; break; }
      }
      if (y > 0.07 && Number.isFinite(shaftZ)) z = Math.min(z, shaftZ);
      return Number.isFinite(z) ? z : shaftZ;
    };
    const laceM = { color: '#191714', detail: 0.8, shine: 0.05, cls: 'cloth' };
    const metM = { color: '#2a2a28', detail: 0.2, shine: 0.75, cls: 'hard' };
    const bonesAt = (y) => (y < 0.115 ? ['footL', 'footR'] : ['shinL', 'shinR']);
    const rows = civ ? [0.06, 0.066, 0.072] : [0.096, 0.109, 0.122, 0.138, 0.154, 0.171, 0.188, 0.205];
    const half = civ ? 0.012 : 0.0165;
    const P = rows.map((y) => {
      const z = zAt(y);
      const inst2 = z < shaftZ - 0.004; // auf dem Rist (Fläche schräg nach oben/vorn)
      return { y, z, inst: inst2, L: [cx - half, y - (inst2 ? 0.0035 : 0), z + (inst2 ? 0.0035 : 0.0015)], R: [cx + half, y - (inst2 ? 0.0035 : 0), z + (inst2 ? 0.0035 : 0.0015)] };
    });
    if (L0) {
      for (let k = 0; k + 1 < P.length; k++) {
        const a = P[k], b = P[k + 1];
        const off = (p) => [p[0], p[1] + 0.0008, p[2] - 0.0026];
        const [b0, b1] = bonesAt((a.y + b.y) / 2);
        pair(bar(off(a.L), off(b.R), 0.0034, 0.0024), b0, b1, laceM);
        pair(bar(off(a.R), off(b.L), 0.0034, 0.0024), b0, b1, laceM);
      }
      // unterste Querschnürung
      { const a = P[0]; const [b0, b1] = bonesAt(a.y); pair(bar([a.L[0], a.L[1], a.L[2] - 0.0024], [a.R[0], a.R[1], a.R[2] - 0.0024], 0.0034, 0.0024), b0, b1, laceM); }
    }
    if (L0) {
      for (let k = 0; k < P.length; k++) {
        const p = P[k];
        const [b0, b1] = bonesAt(p.y);
        const hook = !civ && k >= 5;
        for (const q of [p.L, p.R]) {
          if (hook) {
            // Schnellhaken: Fuß + nach außen offener Bügel
            pair(cyl(0.0035, 0.0035, 0.003, 6, { p: [q[0], q[1], q[2] - 0.0012], r: [Math.PI / 2, 0, 0] }), b0, b1, metM);
            pair(torus(0.0036, 0.0011, 3, 6, { p: [q[0] + Math.sign(q[0] - cx) * 0.0012, q[1] + 0.001, q[2] - 0.0035], r: [0, Math.PI / 2, 0] }, Math.PI), b0, b1, metM);
          } else {
            pair(torus(0.0032, 0.0011, 3, 8, { p: [q[0], q[1], q[2] - 0.0006], r: [p.inst ? -1.0 : 0, 0, 0] }), b0, b1, metM);
          }
        }
      }
      // Schleife + Enden oben
      const t = P[P.length - 1];
      const [tb0, tb1] = bonesAt(t.y);
      const kc = [cx, t.y + 0.006, t.z - 0.004];
      for (const sx of [-1, 1]) {
        pair(torus(0.0085, 0.0018, 3, 8, { p: [cx + sx * 0.0085, kc[1] + 0.002, kc[2] - 0.001], r: [0, 0, sx * 0.5], s: [1.2, 0.75, 1] }), tb0, tb1, laceM);
        pair(bar(kc, [cx + sx * 0.012, kc[1] - 0.03, kc[2] - 0.002], 0.003, 0.0022), tb0, tb1, laceM);
      }
      if (!civ) {
        // Zuglasche hinten am Schaft
        pair(torus(0.008, 0.0024, 3, 8, { p: [cx, 0.212, 0.012 + 0.061 + 0.003], r: [0, 0, 0] }, Math.PI), 'shinL', 'shinR', { pal: 'strap', detail: 1, cls: 'gear' });
      }
    }
    // Sohle: Trennfuge (Zwischen-/Laufsohle) und Stollen am Rand
    if (L0 && BT.sole) {
      const S = BT.sole, n = S.length;
      const nrmAt = (i) => {
        const a = S[(i - 1 + n) % n], b = S[(i + 1) % n];
        let nx = b[2] - a[2], nz = -(b[0] - a[0]);
        const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        const p = S[i];
        if ((p[0] - cx) * nx + (p[2] + 0.07) * nz < 0) { nx = -nx; nz = -nz; }
        return [nx, nz];
      };
      const solM = { ...C.sole, color: '#0c0c0d', detail: 0.3 };
      const gp = [], gu = [];
      for (let i = 0; i < n; i++) {
        const [nx, nz] = nrmAt(i), p = S[i];
        const gy = p[1] + BT.soleH * 0.62;
        gp.push([p[0] + nx * 0.0016, gy, p[2] + nz * 0.0016]); gu.push([nx, 0, nz]);
      }
      pair(sweep(gp, gu, rectProfile(0.0026, 0.0018), { closed: true, smooth: false }), 'footL', 'footR', solM);
      if (L0 && !civ) for (let i = 0; i < n; i++) {
        const [nx, nz] = nrmAt(i), p = S[i];
        pair(rbox(0.0115, BT.soleH * 0.42, 0.006, 0, 0, { p: [p[0] + nx * 0.0012, p[1] + BT.soleH * 0.24, p[2] + nz * 0.0012], r: [0, Math.atan2(nx, nz), 0] }), 'footL', 'footR', C.sole);
      }
    }
  }

  /* ------------------------------------------------------------ Feldanzug: Taschenklappen (20.11.) */
  // Feldbluse/-hose nach dem üblichen Schnitt (Ärmeltaschen mit Klappe + Klettfeld, seitliche Beintaschen mit Knopfklappen,
  // Brusttaschen): Klappen als gewölbte Stoffkissen auf der gemessenen Stoffoberfläche (Taschenwulst steckt im Körpernetz)
  if (!civ && !FAR) {
    const flapM = { color: '#b8b8b8', camo: 1, detail: 1, cls: 'cloth', wear: 0.4 };
    const btnM = { pal: 'strap', shade: 0.8, detail: 0.3, shine: 0.35, cls: 'hard' };
    // seitliche Beintasche (Oberschenkel außen), Klappe mit zwei Knöpfen
    const tx = surfAt(0.742, -0.1, -0.01, -1, 0);
    if (tx > 0.05) {
      const x = -0.1 - tx - 0.002;
      pair(place(pad({ w: 0.13, h: 0.046, d: 0.008, rb: 0.003, rc: 0.012, puff: L0 ? 0.002 : 0, bend: [5.2, 0], k: L0 ? 2 : 1, fr: L0 ? 1 : 0, bv: L0 ? 3 : 1 }), { p: [x, 0.742, -0.01], r: [0, Math.PI / 2, -0.04] }), 'thighL', 'thighR', flapM);
      if (L0) for (const z of [-0.042, 0.022]) pair(cyl(0.0055, 0.0055, 0.003, 8, { p: [x - 0.0055, 0.728, z], r: [0, 0, Math.PI / 2] }), 'thighL', 'thighR', btnM);
    }
    // Ärmeltasche (Oberarm außen): Klappe über dem Klettfeld
    const sx = surfAt(1.348, -DIM.shoulderX, 0, -1, 0);
    if (sx > 0.03) pair(place(pad({ w: 0.072, h: 0.03, d: 0.006, rb: 0.0025, rc: 0.009, puff: L0 ? 0.0015 : 0, bend: [7.5, 0], k: L0 ? 2 : 1, fr: 0, bv: L0 ? 2 : 1 }), { p: [-DIM.shoulderX - sx - 0.006, 1.348, -0.002], r: [0, Math.PI / 2, 0] }), 'upperArmL', 'upperArmR', flapM);
    // Brusttaschen (sichtbar ohne Plattenträger)
    if (V.vest !== 'plate' && V.vest !== 'heavy' && V.vest !== 'light') {
      const cz = surfAt(1.384, -0.085, 0, 0, -1);
      if (cz > 0.05) pair(place(pad({ w: 0.098, h: 0.034, d: 0.006, rb: 0.0025, rc: 0.01, puff: L0 ? 0.0015 : 0, bend: [2, 0], k: L0 ? 2 : 1, fr: 0, bv: L0 ? 2 : 1 }), { p: [-0.085, 1.384, -cz - 0.003], r: [0.12, 0, 0] }), 'chest', 'chest', { ...flapM, noBulk: true });
    }
  }

  if (civ) {
    // 20.11.: Zivilkleidung am Körpernetz gemessen (Endmaße, noBulk) – gilt so für den männlichen und den weiblichen Körper.
    // Vorbilder: Strick mit Rippbündchen an Hals/Saum/Ärmeln, Hemdkragen mit Steg, Jacke mit Stehkragen und Reißverschluss,
    // knielanger Mantel mit Revers, Knopfleiste, Pattentaschen und Gehschlitz.
    const NB = { noBulk: true };
    const frontZ = (y, x = 0) => -surfAt(y, x, 0.006, 0, -1, 0.012, 0.2, true) + 0.006;
    const sideX = (y) => surfAt(y, 0, 0.006, 1, 0, 0.012, 0.25, true);
    const backZ = (y) => surfAt(y, 0, 0.006, 0, 1, 0.012, 0.2, true) + 0.006;
    // Rippe: Querschnitt radial gewellt (n Rippen je Umfang)
    const ribify = (g, n, amp, c = [0, 0]) => {
      const P = g.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i) - c[0], z = P.getZ(i) - c[1], a = Math.atan2(z, x), f = 1 + amp * Math.cos(a * n);
        P.setX(i, c[0] + x * f); P.setZ(i, c[1] + z * f);
      }
      g.computeVertexNormals();
      return g;
    };
    // Band um den Rumpf in Höhe y (Saum/Bund): Halbachsen aus dem Körper + Zugabe
    const hemBand = (y, h, add_, mat, rib) => {
      const rx = sideX(y) + add_, rf = -frontZ(y) + 0.006 + add_, rb = backZ(y) - 0.006 + add_;
      const rz = (rf + rb) / 2, cz = 0.006 + (rb - rf) / 2;
      const g = cyl(1, 1, h, L0 ? 48 : q.tseg, {}, true);
      if (rib && L0) ribify(g, 48, 0.02);
      add(place(g, { p: [0, y, cz], s: [rx, 1, rz] }), y < 1.0 ? 'hips' : 'spine', { ...mat, ...NB });
    };
    // Bündchen am Handgelenk (Unterarm, links gemessen, rechts gespiegelt)
    const cuff = (mat, h = 0.04, rib = true) => {
      const y = 0.945, ax = -DIM.shoulderX;
      const rxo = surfAt(y, ax, 0, -1, 0, 0.012, 0.35, 'arm'), rxi = surfAt(y, ax, 0, 1, 0, 0.012, 0.35, 'arm'), rzf = surfAt(y, ax, 0, 0, -1, 0.012, 0.35, 'arm'), rzb = surfAt(y, ax, 0, 0, 1, 0.012, 0.35, 'arm');
      if (!(rxo > 0.02 && rzf > 0.02)) return;
      const rx = (rxo + rxi) / 2 + 0.004, rz = (rzf + rzb) / 2 + 0.004;
      const g = cyl(1, 1, h, L0 ? 24 : q.cs, {}, true);
      if (rib && L0) ribify(g, 24, 0.035);
      pair(place(g, { p: [ax + (rxi - rxo) / 2, y, (rzb - rzf) / 2], s: [rx, 1, rz] }), 'foreArmL', 'foreArmR', { ...mat, ...NB });
    };
    // Kragen/Bündchen entlang des gemessenen Halsausschnitts (body-mesh.js boots.neck): w hoch, t dick, lift über der Kante
    const NL0 = (BODY_MESH.boots && BODY_MESH.boots.neck && BODY_MESH.boots.neck[V.female ? 'female' : 'civil']) || null;
    // mensch3: Kragen als Band zwischen Halsausschnitt und Hals – die Oberkante liegt am gemessenen Hals an (vorher stand der Kragen
    // als Ring auf dem weiten Ausschnitt ab). Stehkragen: Unterkante im Ausschnitt, Oberkante am Hals in Höhe +w. Umlegekragen
    // (fold): zusätzlich ein Blatt von der Stehkragen-Oberkante nach außen/unten auf Schulter und Brust (Hemd, Mantelrevers).
    // open (rad): vorn offen (Knopfleiste/Revers), rib: Rippen (Strick)
    const collar = (w, t, lift, mat, { open = 0, rib = false, out = 0, fold = 0, gap = 0.0035 } = {}) => {
      if (!NL0 || NL0.length < 8 || FAR) return;
      let L = NL0.map((p) => p.slice());
      for (let it = 0; it < 3; it++) L = L.map((p, i) => { const a = L[(i - 1 + L.length) % L.length], b = L[(i + 1) % L.length]; return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4, (a[2] + 2 * p[2] + b[2]) / 4]; });
      const cz0 = L.reduce((s_, p) => s_ + p[2], 0) / L.length;
      const N = L0 ? 56 : 22;
      const C3 = new THREE.CatmullRomCurve3(L.map((p) => new THREE.Vector3(...p)), true, 'centripetal');
      // Halsmitte je Höhe (vorn/hinten gemessen) und Halsradius je Richtung
      const neckC = new Map();
      const neckCz = (y) => { const k = Math.round(y * 500); if (!neckC.has(k)) { const yy = k / 500; const rf = surfAt(yy, 0, cz0, 0, -1, 0.012, 0.3, 'neck'), rb = surfAt(yy, 0, cz0, 0, 1, 0.012, 0.3, 'neck'); neckC.set(k, rf > 0.02 && rb > 0.02 ? cz0 + (rb - rf) / 2 : cz0); } return neckC.get(k); };
      const neckAt = (y, ox, oz) => { const cz = neckCz(y); const r = surfAt(y, 0, cz, ox, oz, 0.012, 0.3, 'neck'); return [cz, r]; };
      const B = [], T = [], F = [], keep = [];
      for (let i = 0; i < N; i++) {
        const v = C3.getPointAt(i / N);
        let ox = v.x, oz = v.z - cz0; const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
        const ang = Math.atan2(ox, -oz);
        if (open && Math.abs(ang) < open) continue;
        // Unterkante: knapp außerhalb der Ausschnittkante (deckt die gezackte Stoffgrenze), etwas eingesenkt
        const b = [v.x + ox * (t * 0.5 + out), v.y + lift - 0.004, v.z + oz * (t * 0.5 + out)];
        // Oberkante: am Hals in Höhe +w, Abstand = halbe Stoffdicke + Luft
        const yT = v.y + lift + w;
        const [cz, rn] = neckAt(yT, ox, oz);
        const rB = Math.hypot(b[0], b[2] - cz);
        let rT = rn > 0.02 ? rn + t * 0.5 + gap : rB - w * 0.35;
        rT = Math.min(rT, rB + 0.002); // nie nach außen kippen
        const tp = [ox * rT, yT, cz + oz * rT];
        B.push(b); T.push(tp); keep.push(ang);
        if (fold) {
          // Umlegeblatt: von der Oberkante nach außen/unten, Länge fold, liegt mit Luft auf Schulter/Brust
          let best = null;
          for (let k = 1; k <= 14; k++) {
            const yy = tp[1] - k * 0.006;
            const rb_ = surfAt(yy, 0, cz0, ox, oz, 0.012, 0.3, true);
            if (rb_ < 0.02) continue;
            const rq = Math.max(rb_ + t + 0.007, Math.hypot(b[0], b[2] - cz0) + t * 1.2 + 0.003 + (tp[1] - yy) * 0.25); // außen über dem Steg
            const q = [ox * rq, yy, cz0 + oz * rq];
            const d = Math.hypot(q[0] - tp[0], q[1] - tp[1], q[2] - tp[2]);
            best = q;
            if (d >= fold) break;
          }
          F.push(best || [tp[0] + ox * fold * 0.7, tp[1] - fold * 0.7, tp[2] + oz * fold * 0.7]);
        }
      }
      const n = B.length;
      if (n < 4) return;
      // Reihenfolge so drehen, dass die Lücke vorn am Anfang/Ende liegt
      if (open) {
        let gi = 0, gm = 0;
        for (let i = 0; i < n; i++) { const j = (i + 1) % n; const d = Math.hypot(B[j][0] - B[i][0], B[j][2] - B[i][2]); if (d > gm) { gm = d; gi = j; } }
        for (const A_ of [B, T, F]) if (A_.length) A_.push(...A_.splice(0, gi));
      }
      // Querschnitt je Spalte: innen unten → innen oben → Rand → außen oben → außen unten (→ Umlegeblatt)
      const pos = [], idx = [];
      const rowsOf = (i) => {
        const b = B[i], tp = T[i];
        const dx = tp[0] - b[0], dy = tp[1] - b[1], dz = tp[2] - b[2], dl = Math.hypot(dx, dy, dz) || 1;
        // Bandnormale: waagrecht nach außen, senkrecht zur Bandrichtung
        let nx = b[0], nz = b[2] - cz0; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
        const along = [dx / dl, dy / dl, dz / dl];
        const dn = nx * along[0] + nz * along[2];
        let n3 = [nx - along[0] * dn, -along[1] * dn, nz - along[2] * dn]; const l3 = Math.hypot(...n3) || 1; n3 = n3.map((q) => q / l3);
        const ribS = rib && L0 ? 1 + 0.12 * (i % 2) : 1;
        const h = t * 0.5 * ribS;
        const off = (p, s_) => [p[0] + n3[0] * h * s_, p[1] + n3[1] * h * s_, p[2] + n3[2] * h * s_];
        const rim = [tp[0] + along[0] * h * 0.8, tp[1] + along[1] * h * 0.8, tp[2] + along[2] * h * 0.8];
        const R_ = [off(b, -1), off(tp, -1), rim, off(tp, 1), off(b, 1)];
        if (fold) { const f = F[i]; R_.push([f[0] + n3[0] * h, f[1] + n3[1] * h, f[2] + n3[2] * h], [f[0] - n3[0] * h * 0.3, f[1] - h * 0.8, f[2] - n3[2] * h * 0.3]); }
        return R_;
      };
      const per = fold ? 7 : 5;
      for (let i = 0; i < n; i++) for (const p of rowsOf(i)) pos.push(...p);
      const segs = open ? n - 1 : n;
      for (let i = 0; i < segs; i++) {
        const a0 = i * per, b0 = ((i + 1) % n) * per;
        for (let k = 0; k + 1 < per; k++) idx.push(a0 + k, b0 + k, a0 + k + 1, a0 + k + 1, b0 + k, b0 + k + 1);
      }
      // offene Enden schließen (Stirnseiten vorn)
      if (open) for (const e of [0, n - 1]) { const o = e * per; for (let k = 1; k + 1 < per; k++) idx.push(o, o + k, o + k + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      // Umlauf so, dass die Außenseite (Zeile 3) nach außen zeigt – sonst Dreiecke umdrehen (einseitiges Material)
      { const Nn = g.attributes.normal.array; let sdot = 0;
        for (let i = 0; i < n; i++) { const v = i * per + 3, px = pos[v * 3], pz = pos[v * 3 + 2] - cz0; sdot += Nn[v * 3] * px + Nn[v * 3 + 2] * pz; }
        if (sdot < 0) { for (let k = 0; k < idx.length; k += 3) { const x_ = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = x_; } g.setIndex(idx); g.computeVertexNormals(); } }
      add(g, 'chest', { ...mat, ...NB });
    };
    // Knopfleiste/Reißverschluss vorn (am Körper gemessen)
    const placket = (y0, y1, w, t, mat, x = 0, n = 7) => {
      const pts = [];
      for (let i = 0; i <= n; i++) { const y = y0 + (y1 - y0) * i / n; pts.push([x, y, frontZ(y, x) - t / 2 - 0.0008]); }
      add(sweep(pts, [0, 0, -1], rectProfile(w, t), { smooth: false }), 'chest', { ...mat, ...NB });
      return pts;
    };
    const buttons = (ys, x, mat, r = 0.0055) => { if (L0) for (const y of ys) add(cyl(r, r, 0.003, 8, { p: [x, y, frontZ(y, x) - 0.004], r: [Math.PI / 2, 0, 0] }), 'chest', { ...mat, ...NB }); };
    const btnDark = { color: '#2a2420', detail: 0.3, shine: 0.45, cls: 'hard' };
    const btnLight = { color: '#d9d4c8', detail: 0.2, shine: 0.5, cls: 'hard' };
    const flapSide = (y, mat, ang = 0.45) => {
      if (!L0) return;
      for (const sx of [-1, 1]) {
        const x = sx * 0.1, z = frontZ(y, x);
        add(place(pad({ k: 2, fr: 0, bv: 2, w: 0.1, h: 0.03, d: 0.006, rb: 0.002, rc: 0.006, bend: [3, 0] }), { p: [x * 1.04, y, z - 0.004], r: [0, sx * ang, 0] }), 'spine', { ...mat, ...NB });
      }
    };
    const darker = (m, f) => ({ ...m, color: shade(V.topColor, f) });

    // Hosengürtel mit Schnalle (nicht unter dem Mantel)
    if (V.top !== 'mantel') {
      hemBand(0.985, 0.03, 0.003, { color: '#2a211b', detail: 0.7, shine: 0.3, cls: 'leather' }, false);
      if (L01) add(rbox(0.032, 0.026, 0.006, 0, 0, { p: [0, 0.985, frontZ(0.985) - 0.006] }), 'hips', { ...C.metal, ...NB });
    }
    if (V.top === 'jacke' || V.top === 'strick') {
      // Jackensaum, Reißverschluss bzw. Knopfleiste vorn, Taschen, Kragen
      hemBand(1.015, 0.04, 0.005, V.top === 'strick' ? civ.top : darker(civ.top, 0.92), V.top === 'strick');
      if (L01) {
        placket(1.0, 1.44, V.top === 'jacke' ? 0.007 : 0.016, 0.003, V.top === 'jacke' ? { color: '#1e1f20', detail: 0.4, shine: 0.4, cls: 'hard' } : civ.top);
        if (V.top === 'strick') buttons([1.1, 1.18, 1.26, 1.34, 1.41], 0, { color: '#3a2c22', detail: 0.3, shine: 0.4, cls: 'hard' });
        flapSide(1.09, darker(civ.top, 0.85));
      }
      if (V.top === 'jacke') { collar(0.038, 0.007, 0.0, civ.top, { open: 0.16 }); cuff(darker(civ.top, 0.9), 0.03, false); }
      else { collar(0.02, 0.004, 0.002, civ.shirt, { out: -0.004, open: 0.12 }); collar(0.012, 0.007, -0.004, civ.top, { rib: true, out: 0.002, open: 0.22, gap: 0.006 }); cuff(civ.top); }
      if (V.hiVis) for (const y of [1.12, 1.2]) hemBand(y, 0.026, 0.004, { color: '#d8dccf', detail: 0.3, shine: 0.6, emis: 0.05, cls: 'gear' }, false);
    } else if (V.top === 'pullover') {
      // Pullover: Rippbündchen an Hals, Saum, Ärmeln; darunter Hemdkragen
      hemBand(1.0, 0.055, 0.005, civ.top, true);
      collar(0.024, 0.008, -0.002, civ.top, { rib: true, out: -0.002 });
      cuff(civ.top, 0.05);
    } else if (V.top === 'mantel') {
      // Mantel: Revers/Kragen, Knopfleiste, Ärmelaufschlag; Mantelschöße unten an den Oberschenkeln (siehe unten)
      collar(0.022, 0.004, 0.002, civ.shirt, { open: 0.2, out: -0.004 });
      collar(0.03, 0.007, 0.0, darker(civ.top, 0.95), { open: 0.5, fold: 0.055, out: 0.002, gap: 0.006 });
      if (L01) { placket(0.98, 1.36, 0.03, 0.005, darker(civ.top, 0.97), -0.012); buttons([1.02, 1.12, 1.22, 1.32], -0.012, btnDark, 0.008); }
      cuff(darker(civ.top, 0.9), 0.05, false);
      hemBand(1.06, 0.035, 0.007, darker(civ.top, 0.9), false); // Gürtelschlaufe/Taille
    } else {
      // Hemd: Knopfleiste mit Knöpfen, Brusttaschen, Kragen mit Steg
      if (L01) {
        const pts = placket(1.0, 1.44, 0.022, 0.0025, darker(civ.top, 0.92));
        buttons(pts.slice(1, 7).map((p) => p[1]), 0, btnLight, 0.0045);
        if (L0) for (const sx of [-1, 1]) { const x = sx * 0.085, y = 1.33; add(place(pad({ k: 2, fr: 0, bv: 2, w: 0.075, h: 0.085, d: 0.005, rb: 0.002, rc: 0.006, bend: [2, 0] }), { p: [x, y, frontZ(y, x) - 0.003], r: [0, sx * 0.25, 0] }), 'chest', { ...civ.top, color: shade(V.topColor, 0.9), ...NB }); }
      }
      collar(0.022, 0.004, 0.0, civ.top, { open: 0.1, fold: 0.035, out: -0.002 });
    }
    // Mantelschöße: je Seite eine doppelwandige Stoffbahn um Becken/Oberschenkel (vorn übereinander, hinten Gehschlitz)
    if (V.top === 'mantel') {
      const y0 = 0.985, y1 = V.female ? 0.5 : 0.53, rows = L0 ? 8 : L01 ? 4 : 2, cols = L0 ? 16 : L01 ? 8 : 4;
      const rx0 = sideX(y0) + 0.012, rf0 = -frontZ(y0) + 0.006 + 0.012, rb0 = backZ(y0) - 0.006 + 0.014;
      // mensch3: Saum weiter (v. a. hinten/seitlich) – Oberschenkel schwingen beim Gehen innen frei, statt durchzustechen
      const rx1 = Math.max(rx0 + 0.065, 0.228), rf1 = rf0 + 0.035, rb1 = rb0 + 0.065;
      // vorn überlappen die Schöße (links außen, rechts 5 mm darunter) → auch in der Schrittstellung geschlossen.
      // Weich gehäutet (wie der Körper): oben am Becken, nach unten zunehmend am Oberschenkel (höchstens 70 %, zur Mitte
      // vorn/hinten weniger) – der Mantel schwingt beim Gehen mit und legt sich beim Hocken über die Knie, statt starr mit
      // dem Oberschenkel zu kippen.
      const pos = [], nrm = [], uvA = [], ski = [], skw = [], idx = [];
      const th0 = -0.14, th1 = Math.PI - 0.03;
      const panel = (side, shrink, thighBone) => {
        for (const shell of [0, 1]) {
          const base = pos.length / 3, inset = (shell ? -0.004 : 0) - shrink;
          for (let j = 0; j <= rows; j++) {
            const v = j / rows, y = y0 + (y1 - y0) * v, e = 1 - (1 - v) * (1 - v); // mensch3: Weite früh (Hüfte/Gesäß stechen nicht durch)
            const rx = rx0 + (rx1 - rx0) * e + inset, rf = rf0 + (rf1 - rf0) * e + inset, rb = rb0 + (rb1 - rb0) * e + inset;
            for (let i = 0; i <= cols; i++) {
              const th = th0 + (th1 - th0) * i / cols;
              const rz = th < Math.PI / 2 ? rf : rb;
              const x = side * rx * Math.sin(th), z = 0.006 - rz * Math.cos(th);
              pos.push(x, y, z);
              let nx = side * Math.sin(th) / rx, nz = -Math.cos(th) / rz; const nl = Math.hypot(nx, nz) || 1;
              nrm.push((shell ? -1 : 1) * nx / nl, 0, (shell ? -1 : 1) * nz / nl);
              uvA.push(th * 0.18, y);
              // mensch3: vorn folgt der Schoß dem Oberschenkel stärker (legt sich beim Hocken über das Knie), hinten hängt er am Becken
              const wT = Math.min(1, Math.max(0, (0.985 - y) / 0.36)) * Math.min(1, 0.56 + 0.5 * Math.cos(th)); // vorn ganz am Oberschenkel (gemischte Gewichte fallen bei 90° Beugung ein)
              const q = Math.round(wT * 255);
              ski.push(BONE.hips, BONE[thighBone], 0, 0); skw.push(255 - q, q, 0, 0);
            }
          }
          for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
            const a = base + j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
            if ((shell ? 1 : 0) ^ (side > 0 ? 1 : 0)) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
          }
        }
        // Saum: Ober- und Innenkante unten verbinden (Stoffkante statt offener Schale)
        const n1 = (rows + 1) * (cols + 1), base0 = pos.length / 3 - 2 * n1;
        for (let i = 0; i < cols; i++) {
          const o = base0 + rows * (cols + 1) + i, inn = o + n1;
          if (side > 0) idx.push(o, inn, o + 1, o + 1, inn, inn + 1); else idx.push(o, o + 1, inn, o + 1, inn + 1, inn);
        }
      };
      panel(-1, 0, 'thighL');
      panel(1, 0.005, 'thighR');
      const nV = pos.length / 3;
      B.addMesh({ n: nV, pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uvA), idx: new Uint16Array(idx), ski: new Uint8Array(ski), skw: new Uint8Array(skw), reg: new Uint8Array(nV), ao: new Uint8Array(nV).fill(235) }, () => civ.top);
    }
    // Frisuren der Zivilistinnen (20.11.): Haarkappe direkt aus dem (weiblichen) Kopfnetz geschnitten – alle Dreiecke über dem
    // Haaransatz, entlang der Normalen um 3–11 mm (Volumen) versetzt – sitzt so genau auf dem Kopf von face.js; dazu Dutt, Zopf
    // oder schulterlanges Haar. Haaransatz/Brauen malt face-skin.js.
    if (V.female && V.hairStyle) {
      const HM = { color: V.hair, detail: 1, shine: 0.22, cls: 'cloth', tail: L0 }; // mensch3: auf Stufe 0 zeichnet hair.js die Frisur am Detailkopf (Ansicht ohne Kopf blendet diese Kappe aus)
      const D2 = Math.PI / 180;
      const HC = [0, 1.7, -0.012];
      // Haaransatz θ(φ) ab Scheitel (φ: vorn 270°, hinten 90°): Stirn ≈ 46°, Schläfen ≈ 70°, über den Ohren ≈ 86°, Nacken ≈ 120°
      const line = (ph) => {
        const s_ = Math.sin(ph), c_ = Math.cos(ph);
        const f = Math.max(0, -s_), b = Math.max(0, s_);
        return (86 - 40 * Math.pow(f, 1.4) + 34 * Math.pow(b, 1.3) - 8 * Math.exp(-((Math.abs(c_) - 0.62) ** 2) / 0.02) * (s_ < 0 ? 1 : 0)) * D2;
      };
      const HB = bodyMesh(lod, true, true);
      const HEAD = new Set([RG.SKULL, RG.FACE, RG.EARS, RG.EYES, RG.NECK]);
      const nH = HB.n, sel = new Uint8Array(nH), thA = new Float32Array(nH), lnA = new Float32Array(nH);
      for (let i = 0; i < nH; i++) {
        if (!HEAD.has(HB.reg[i])) continue;
        const dx = HB.pos[i * 3] - HC[0], dy = HB.pos[i * 3 + 1] - HC[1], dz = HB.pos[i * 3 + 2] - HC[2];
        const th = Math.acos(Math.max(-1, Math.min(1, dy / (Math.hypot(dx, dy, dz) || 1)))), ph = Math.atan2(dz, dx);
        thA[i] = th; lnA[i] = line(ph);
        if (th < lnA[i] + 0.02) sel[i] = 1;
      }
      // Kappe: Dreiecke mit allen Ecken über dem Haaransatz, Ecken neu nummeriert, entlang der Normalen versetzt
      const map = new Int32Array(nH).fill(-1), cp = [], ci = [];
      for (let t = 0; t < HB.idx.length; t += 3) {
        const a = HB.idx[t], b = HB.idx[t + 1], c = HB.idx[t + 2];
        if (!(sel[a] && sel[b] && sel[c])) continue;
        for (const v of [a, b, c]) {
          if (map[v] < 0) {
            map[v] = cp.length / 3;
            const edge = Math.min(1, Math.max(0, (lnA[v] - thA[v]) / 0.22));
            const o = 0.0012 + 0.009 * edge * (0.6 + 0.4 * Math.cos(thA[v]));
            cp.push(HB.pos[v * 3] + HB.nrm[v * 3] * o, HB.pos[v * 3 + 1] + HB.nrm[v * 3 + 1] * o, HB.pos[v * 3 + 2] + HB.nrm[v * 3 + 2] * o);
          }
          ci.push(map[v]);
        }
      }
      if (ci.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
        g.setIndex(ci);
        g.computeVertexNormals();
        add(g, 'head', HM);
        // Rückseite (der Rand ist von vorn/unten einsehbar – sonst wirkt die Kappe dort durchsichtig)
        const gb = g.clone(); const ib = gb.index.array.slice(); for (let t = 0; t < ib.length; t += 3) { const x_ = ib[t + 1]; ib[t + 1] = ib[t + 2]; ib[t + 2] = x_; }
        gb.setIndex(Array.from(ib)); gb.computeVertexNormals();
        add(gb, 'head', { ...HM, color: shade(V.hair, 0.55) });
      }
      // Kopfradius in Richtung (θ, φ) (äußerste Ecke im Kegel) → Punkt auf der Haarkappe
      const capP = (th, ph, extra = 0) => {
        const d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
        let r = 0.09;
        for (let i = 0; i < nH; i++) {
          if (!HEAD.has(HB.reg[i])) continue;
          const dx = HB.pos[i * 3] - HC[0], dy = HB.pos[i * 3 + 1] - HC[1], dz = HB.pos[i * 3 + 2] - HC[2];
          const l = Math.hypot(dx, dy, dz) || 1;
          if ((dx * d[0] + dy * d[1] + dz * d[2]) / l > 0.985 && l > r) r = l;
        }
        r += 0.009 + extra;
        return [HC[0] + d[0] * r, HC[1] + d[1] * r, HC[2] + d[2] * r];
      };
      if (V.hairStyle === 'dutt') {
        const p = capP(100 * D2, 90 * D2, 0.018);
        add(E(0.04, 0.034, 0.03, { p }), 'head', HM);
        if (L0) add(torus(0.024, 0.0035, 3, 12, { p: [p[0], p[1], p[2] - 0.02], r: [0, 0, 0] }), 'head', { ...HM, color: shade(V.hair, 0.6) });
      } else if (V.hairStyle === 'zopf' && !FAR) {
        const p = capP(97 * D2, 90 * D2, 0.0);
        const pts = curve([p, [p[0], p[1] - 0.035, p[2] + 0.025], [p[0], p[1] - 0.12, p[2] + 0.03], [p[0], p[1] - 0.2, p[2] + 0.018]], L0 ? 10 : 5);
        add(sweep(pts, [0, 0, 1], roundProfile(0.017, L0 ? 8 : 5), { smooth: true, scale: (i) => 1 - 0.5 * (i / (pts.length - 1)) }), 'head', HM);
        add(torus(0.015, 0.004, 3, 10, { p: [pts[1][0], pts[1][1], pts[1][2]], r: [Math.PI / 2 - 0.6, 0, 0] }), 'head', { ...HM, color: '#1b1b1d', shine: 0.3 });
      } else if (V.hairStyle === 'offen') {
        // schulterlang: Haarvorhang seitlich/hinten ab knapp über dem Haaransatz, unten etwas abstehend
        const nP = L0 ? 24 : L01 ? 10 : 6, nY = L0 ? 6 : 3;
        const pos = [], idx = [];
        const tops = [];
        for (let i = 0; i <= nP; i++) { const ph = (-28 + 236 * i / nP) * D2; tops.push(capP(Math.max(0.5, line(ph) - 0.22), ph, 0.002)); }
        for (const shell of [0, 1]) {
          const base = pos.length / 3;
          for (let j = 0; j <= nY; j++) {
            const v = j / nY;
            for (let i = 0; i <= nP; i++) {
              const ph = (-28 + 236 * i / nP) * D2, top = tops[i];
              const r0 = Math.hypot(top[0] - HC[0], top[2] - HC[2]);
              const r = r0 + 0.016 * v * v - (shell ? 0.005 : 0);
              const a = Math.atan2(top[2] - HC[2], top[0] - HC[0]);
              const yb = top[1] - (0.12 + 0.04 * Math.max(0, Math.sin(ph))) * v;
              pos.push(HC[0] + Math.cos(a) * r, yb, HC[2] + Math.sin(a) * r);
            }
          }
          for (let j = 0; j < nY; j++) for (let i = 0; i < nP; i++) {
            const a = base + j * (nP + 1) + i, b = a + 1, c = a + nP + 1, d = c + 1;
            if (shell) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        add(g, 'head', HM);
      }
    }
  }
  // Gefechtsgürtel (Ring um das Becken) mit Schnalle, Taschen, Erste-Hilfe-Tasche hinten
  if (!civ) add(cyl(0.165, 0.165, 0.058, q.tseg, { p: [0, 0.995, 0.006], s: [1.03, 1, 0.74] }), 'hips', C.gear);
  if (!FAR && !civ) {
    add(R(0.06, 0.04, 0.012, 0.004, { p: [0, 0.995, -0.124] }), 'hips', C.metal);
    pair(R(0.058, 0.085, 0.07, 0.018, { p: [-0.168, 0.968, 0.04] }), 'hips', 'hips', C.gear2);
    add(R(0.1, 0.075, 0.055, 0.018, { p: [0.055, 0.97, 0.132] }), 'hips', C.gear2);
    if (L0) add(rbox(0.026, 0.026, 0.008, 0, 0, { p: [0.055, 0.975, 0.162] }), 'hips', C.accent); // Sanitätskreuz-Patch
    // Innen-/Außengürtel: dunkle Kanten oben und unten, Kobra-Schnalle (Metallbügel + Mittelsteg)
    if (L01) for (const y of [1.021, 0.969]) add(cyl(0.167, 0.167, 0.008, q.tseg, { p: [0, y, 0.006], s: [1.03, 1, 0.74] }, true), 'hips', C.strap);
    if (L0) {
      pair(rbox(0.012, 0.046, 0.016, 0, 0, { p: [-0.033, 0.995, -0.126] }), 'hips', 'hips', C.metal);
      add(rbox(0.016, 0.03, 0.006, 0, 0, { p: [0, 0.995, -0.132] }), 'hips', PLAST);
      // auf der Gürtelellipse sitzen (Halbachsen 0,17 / 0,122 um z = 0,006), Außenseite tangential ausgerichtet
      const onBelt = (th, d) => {
        const a = 0.17, b = 0.122, nx = b * Math.sin(th), nz = -a * Math.cos(th), nl = Math.hypot(nx, nz);
        return { p: [a * Math.sin(th) + (nx / nl) * (d / 2 + 0.002), 0, 0.006 - b * Math.cos(th) + (nz / nl) * (d / 2 + 0.002)], ry: -Math.atan2(b * Math.sin(th), a * Math.cos(th)) };
      };
      // zwei Pistolenmagazin-Taschen vorn links, Aderpresse (Tourniquet) quer vorn rechts
      for (const th of [-0.5, -0.7]) {
        const o = onBelt(th, 0.026);
        add(R(0.03, 0.07, 0.026, 0.006, { p: [o.p[0], 0.985, o.p[2]], r: [0, o.ry, 0] }), 'hips', C.gear2);
        add(rbox(0.033, 0.016, 0.029, 0, 0, { p: [o.p[0], 1.018, o.p[2]], r: [0, o.ry, 0] }), 'hips', C.flap);
      }
      const tq = onBelt(0.5, 0.032);
      add(cyl(0.016, 0.016, 0.075, 6, { p: [tq.p[0], 0.995, tq.p[2]], r: [0, tq.ry, Math.PI / 2] }), 'hips', PLAST);
      const tg = onBelt(0.78, 0.01);
      add(rbox(0.012, 0.024, 0.008, 0, 0, { p: [tg.p[0], 0.99, tg.p[2]], r: [0, tg.ry, 0] }), 'hips', C.medRed);
    }
  }
  if (V.dump && !FAR) add(R(0.1, 0.13, 0.08, 0.028, { p: [-0.125, 0.9, 0.122], r: [0.1, 0.3, 0] }), 'hips', C.gear2);
  if (V.vest === 'heavy') add(R(0.17, 0.15, 0.03, 0.014, { p: [0, 0.885, -0.12], r: [-0.12, 0, 0] }), 'hips', C.gear);

  /* ------------------------------------------------------------ Westen */
  // sol 15.11.: Plattenträger aus gewölbten Kissen (gear-parts.pad: gerundete Kanten, um die Brust gebogen, Schulterausschnitt)
  // statt Quadern; Taschen mit Deckeln, Gummizug und Magazinen, Funkgerät mit Antenne, Erste-Hilfe-Tasche mit Zuglasche,
  // gepolsterte Schulterträger, Kummerbund mit Gurtband. Ferne Stufe: nur die Silhouette tragenden Teile.
  const vest = V.vest;
  const PK = L0 ? { k: 3, fr: 2, bv: 4 } : L01 ? { k: 1, fr: 1, bv: 2 } : { k: 1, fr: 0, bv: 1 };
  // Kissen setzen: Mitte (x, y, z), Front zeigt nach −Z (dir 1) bzw. +Z (dir −1), Neigung rx, Drehung ry
  const PAD = (o, x, y, z, bone, mat, { dir = 1, rx = 0, ry = 0, rz = 0 } = {}) => {
    // ferne Stufe: schlichter Quader in den Außenmaßen (wie vorher – die Silhouette genügt)
    let g;
    if (FAR) {
      const P = o.poly, w = P ? Math.max(...P.map((v) => v[0])) * 2 : o.w, h = P ? Math.max(...P.map((v) => v[1])) * 2 : o.h;
      g = rbox(w, h, o.d, 0, 0);
    } else g = pad({ ...PK, ...o });
    if (dir < 0) place(g, { r: [0, Math.PI, 0] });
    place(g, { p: [x, y, z], r: [rx, ry, rz] });
    add(g, bone, mat);
    return g;
  };
  // Tasche mit Deckel (Kissen + überstehender, gewölbter Deckel mit gerundeten Ecken + Klettlasche + Gurtschlaufe)
  const pouch2 = (w, h, d, x, y, z, bone = 'chest', mat = C.gear2, { lid = true, ry = 0 } = {}) => {
    PAD({ w, h, d, rb: Math.min(0.01, d * 0.3), rc: Math.min(0.014, w * 0.25), puff: L0 ? 0.004 : 0 }, x, y, z, bone, mat, { ry });
    if (lid && L01) {
      const lh = Math.min(0.05, h * 0.42);
      const lid3 = pad({ w: w + 0.006, h: lh, d: 0.008, rb: 0.003, rc: 0.012, puff: 0.002, k: L0 ? 3 : 1, fr: L0 ? 1 : 0, bv: L0 ? 3 : 1, poly: rectPoly(w + 0.006, lh, 0, Math.min(0.012, lh * 0.3)) });
      place(lid3, { p: [0, h / 2 - lh / 2 + 0.006, -d / 2 - 0.004], r: [-0.08, 0, 0] });
      place(lid3, { p: [x, y, z], r: [0, ry, 0] });
      add(lid3, bone, C.flap);
      if (L0) {
        add(place(rbox(Math.min(0.026, w * 0.4), 0.014, 0.003, 0, 0), { p: [x, y + h / 2 - lh + 0.008, z - d / 2 - 0.009] }), bone, C.strap);
        add(place(rbox(0.016, h * 0.42, 0.003, 0, 0), { p: [x, y - h * 0.16, z - d / 2 - 0.004] }), bone, C.web);
      }
    }
  };
  if (vest === 'plate' || vest === 'heavy' || vest === 'light') {
    const heavy = vest === 'heavy';
    const t = vest === 'light' ? 0.038 : 0.052;
    const zF = -0.118 - t / 2, zB = 0.128 + t / 2;
    // Front- und Rückenplatte im Träger: Schulterausschnitt, um die Brust gebogen, Front leicht gepolstert
    PAD({ poly: rectPoly(0.29, 0.3, 0.05, 0.02), d: t, rb: 0.016, rc: 0.024, puff: 0.004, bend: [1.0, 0.25] }, 0, 1.285, zF, 'chest', C.gear);
    PAD({ poly: rectPoly(0.3, 0.32, 0.045, 0.02), d: t, rb: 0.016, rc: 0.024, puff: 0.003, bend: [1.0, 0.2] }, 0, 1.29, zB, 'chest', C.gear, { dir: -1 });
    // Kummerbund (Ring um den Bauch) mit Seitentaschen
    add(cyl(0.178, 0.172, 0.13, L0 ? 28 : q.tseg, { p: [0, 1.18, 0.006], s: [1.06, 1, 0.82] }), 'chest', C.gear);
    if (L0) for (const y of [1.247, 1.113]) add(cyl(0.18, 0.18, 0.008, 28, { p: [0, y, 0.006], s: [1.06, 1, 0.82] }, true), 'chest', C.strap); // Einfassband
    // gepolsterte Schulterträger von Platte zu Platte
    {
      const P = VEST_STRAP.filter((_, i) => FAR ? i % 6 === 0 || i === VEST_STRAP.length - 1 : L0 || i % 3 === 0 || i === VEST_STRAP.length - 1);
      const pts = P.map(([y, z]) => [-0.1, y, z]);
      const ups = P.map(([y, z]) => { const dy = y - 1.4, dz = z - 0.005, l = Math.hypot(dy, dz); return [0, dy / l, dz / l]; });
      pair(sweep(pts, ups, L0 ? [[-0.031, -0.004], [-0.026, -0.009], [0.026, -0.009], [0.031, -0.004], [0.031, 0.006], [0.024, 0.011], [-0.024, 0.011], [-0.031, 0.006]] : rectProfile(0.062, 0.016), { smooth: L0 }), 'chest', 'chest', C.gear);
    }
    const fzP = zF - t / 2 - 0.004, bzP = zB + t / 2 + 0.003; // Vorder-/Rückfläche der Platten (Mitte, mit Wölbung)
    if (L0) molle(-0.13, 0.13, 1.29, 3, fzP + 0.002, 'chest', -1, 1.0);
    else if (L01) for (let i = 0; i < 2; i++) add(rbox(0.26, 0.012, 0.005, 0, 0, { p: [0, 1.30 + i * 0.05, fzP - 0.0025] }), 'chest', C.web);
    if (L0) {
      // Steckschnallen, an denen die Schulterträger in die Frontplatte greifen
      pair(rbox(0.036, 0.024, 0.012, 0, 0, { p: [-0.098, 1.43, fzP + 0.004] }), 'chest', 'chest', PLAST);
      // Kummerbund: MOLLE an den Seiten + Klettzunge vorn
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) add(rbox(0.006, 0.0095, 0.06, 0, 0, { p: [sx * 0.19, 1.14 + i * 0.026, 0.006] }), 'chest', C.web);
      // Tragegriff (Rettungsschlaufe) oben an der Rückenplatte
      add(torus(0.035, 0.008, 4, 10, { p: [0, 1.44, bzP - 0.006] }, Math.PI), 'chest', C.strap);
    }
    // Granattaschen hinten am Kummerbund
    if (L01 && vest !== 'light') for (const sx of [-1, 1]) {
      add(cyl(0.026, 0.026, 0.072, L0 ? 12 : q.cs, { p: [sx * 0.19, 1.165, 0.088] }), 'chest', C.gear2);
      if (L0) add(cyl(0.029, 0.029, 0.016, 12, { p: [sx * 0.19, 1.205, 0.088] }), 'chest', C.flap);
    }
    if (vest !== 'light') {
      // drei Gewehrmagazin-Taschen vorn: offene Schnellzieh-Taschen mit Gummizug + Zuglasche, Magazine schauen heraus
      for (const x of [-0.088, 0, 0.088]) {
        PAD({ w: 0.074, h: 0.112, d: 0.044, rb: 0.01, rc: 0.012, puff: L0 ? 0.003 : 0 }, x, 1.19, -0.19, 'chest', C.gear2);
        if (L0) {
          // Magazin: gebogener Körper + Bodenplatte, Gummizug darüber, Zuglasche
          add(place(pad({ w: 0.058, h: 0.05, d: 0.024, rb: 0.004, rc: 0.006, k: 2, fr: 0, bv: 2, bend: [0, 0.6] }), { p: [x, 1.262, -0.188], r: [0.12, 0, 0] }), 'chest', C.mag);
          add(place(rbox(0.062, 0.008, 0.028, 0.003, 1), { p: [x, 1.289, -0.185], r: [0.12, 0, 0] }), 'chest', C.mag);
          add(place(sweep([[x - 0.034, 1.252, -0.2], [x, 1.25, -0.204], [x + 0.034, 1.252, -0.2]], [0, 0, -1], rectProfile(0.008, 0.004), { smooth: false }), {}), 'chest', C.strap);
          add(place(rbox(0.016, 0.024, 0.004, 0, 0), { p: [x, 1.262, -0.206] }), 'chest', PLAST);
          add(place(rbox(0.016, 0.05, 0.003, 0, 0), { p: [x, 1.18, -0.2135] }), 'chest', C.web);
        } else if (L01) add(rbox(0.058, 0.03, 0.026, 0, 0, { p: [x, 1.262, -0.183] }), 'chest', C.mag);
      }
      // Verwaltungs-/Kartentasche oben mit Reißverschluss und Klettfeld
      if (!FAR) PAD({ w: 0.17, h: 0.075, d: 0.03, rb: 0.009, rc: 0.012, puff: L0 ? 0.004 : 0 }, 0, 1.358, -0.183, 'chest', C.gear2);
      if (L0) add(sweep([[-0.07, 1.388, -0.199], [0.07, 1.388, -0.199]], [0, 0, -1], rectProfile(0.004, 0.003), { smooth: false }), 'chest', C.plastic);
      // Funkgerät links am Kummerbund: Tasche, Gerät mit Bedienknöpfen, biegsame Antenne nach hinten
      if (!FAR) {
        pouch2(0.058, 0.1, 0.05, -0.205, 1.2, 0.035, 'chest', C.gear2, { lid: false, ry: Math.PI / 2 });
        PAD({ w: 0.052, h: 0.06, d: 0.038, rb: 0.006, rc: 0.007, k: 1, fr: 0, bv: 2 }, -0.207, 1.275, 0.035, 'chest', { color: '#25282a', detail: 0.4, shine: 0.35, cls: 'hard' }, { ry: Math.PI / 2 });
        if (L01) {
          const ant = curve([[-0.207, 1.3, 0.05], [-0.212, 1.42, 0.07], [-0.2, 1.53, 0.115], [-0.18, 1.6, 0.17]], L0 ? 8 : 4);
          add(sweep(ant, [1, 0, 0], roundProfile(0.0035, L0 ? 5 : 3), { smooth: true }), 'chest', C.plastic);
        }
        if (L0) for (const zz of [0.022, 0.046]) add(cyl(0.006, 0.006, 0.014, 8, { p: [-0.207, 1.311, zz] }), 'chest', C.plastic);
      }
      // Erste-Hilfe-Tasche rechts am Kummerbund (rote Zuglasche + Kreuz)
      if (L0) {
        pouch2(0.08, 0.1, 0.032, 0.2, 1.16, -0.015, 'chest', C.gear2, { lid: false, ry: -Math.PI / 2 });
        add(place(rbox(0.004, 0.024, 0.03, 0, 0), { p: [0.217, 1.217, -0.015] }), 'chest', C.medRed);
        add(place(rbox(0.003, 0.022, 0.007, 0, 0), { p: [0.2155, 1.16, -0.015] }), 'chest', C.medRed);
        add(place(rbox(0.003, 0.007, 0.022, 0, 0), { p: [0.2155, 1.16, -0.015] }), 'chest', C.medRed);
      }
    } else if (!FAR) {
      PAD({ w: 0.15, h: 0.08, d: 0.03, rb: 0.009, rc: 0.012, puff: L0 ? 0.004 : 0 }, 0, 1.22, -0.168, 'chest', C.gear2);
    }
    // Teamabzeichen + Namensband
    const fz = vest === 'light' ? -0.158 : -0.172;
    add(rbox(0.07, 0.045, 0.004, 0, 0, { p: [0.078, 1.39, fz - 0.004] }), 'chest', C.accent);
    if (L0) add(rbox(0.11, 0.024, 0.004, 0, 0, { p: [-0.066, 1.39, fz - 0.003] }), 'chest', C.patch);
    // Rückenplatte: MOLLE nur, wenn kein großer Rucksack sie verdeckt
    if (L0 && V.back !== 'assault' && V.back !== 'radio') molle(-0.13, 0.13, 1.17, 6, bzP, 'chest', 1, 1.0);
    if (heavy) {
      // Kragen-/Halsschutz und Seitenpanzer
      add(torus(0.098, 0.03, L0 ? 6 : 4, L0 ? 20 : q.cs + 2, { p: [0, 1.478, 0.008], r: [Math.PI / 2, 0, 0], s: [1.06, 0.92, 1] }), 'chest', C.gear);
      for (const sx of [-1, 1]) PAD({ w: 0.13, h: 0.16, d: 0.035, rb: 0.01, rc: 0.014, bend: [1.5, 0] }, sx * 0.205, 1.23, 0.0, 'chest', C.gear2, { ry: -sx * Math.PI / 2 });
    }
  } else if (vest === 'rig') {
    PAD({ w: 0.31, h: 0.14, d: 0.07, rb: 0.016, rc: 0.02, puff: 0.004, bend: [1.2, 0] }, 0, 1.18, -0.142, 'chest', C.gear);
    for (const x of [-0.105, -0.035, 0.035, 0.105]) {
      pouch2(0.062, 0.1, 0.03, x, 1.205, -0.19, 'chest', C.gear2, { lid: false });
      if (L0) add(place(pad({ w: 0.05, h: 0.03, d: 0.022, rb: 0.004, rc: 0.005, k: 2, fr: 0, bv: 2 }), { p: [x, 1.262, -0.188], r: [0.1, 0, 0] }), 'chest', C.mag);
    }
    strapPath(VEST_STRAP, 0.1, 0.045, 0.01, C.strap, FAR ? 6 : L0 ? 1 : 3);
    pair(rbox(0.04, 0.33, 0.012, 0, 0, { p: [-0.055, 1.3, 0.13], r: [0, 0, -0.55] }), 'chest', 'chest', C.strap);
    pair(rbox(0.04, 0.22, 0.012, 0, 0, { p: [-0.105, 1.33, -0.122], r: [0.08, 0, 0.12] }), 'chest', 'chest', C.strap);
    add(rbox(0.06, 0.04, 0.006, 0, 0, { p: [0.09, 1.38, -0.128] }), 'chest', C.accent);
  }

  /* ------------------------------------------------------------ Rucksäcke */
  // sol 15.11.: Rucksackteile als gepolsterte Stoffkissen (gewölbte Außenseite nach hinten, gerundete Kanten) statt Rundquader
  const RP = (w, h, d, r, o = {}) => {
    if (FAR) return R(w, h, d, r, o);
    const g = pad({ ...PKs, w, h, d, rb: Math.min(r, d / 2 - 0.001), rc: Math.max(r, 0.012), puff: Math.min(0.014, d * 0.09) });
    place(g, { r: [0, Math.PI, 0] });
    return place(g, { p: o.p || [0, 0, 0], r: o.r || [0, 0, 0] });
  };
  if (V.back === 'assault') {
    // Video: großer Rucksack im Tarnmuster vom Nacken bis unter die Taille, mit Seitentaschen und Deckel
    add(RP(0.3, 0.44, 0.16, 0.07, { p: [0, 1.22, 0.252] }), 'chest', C.gear2);
    add(RP(0.28, 0.1, 0.175, 0.05, { p: [0, 1.415, 0.256] }), 'chest', C.flap);
    if (!FAR) {
      pair(R(0.045, 0.2, 0.1, 0.02, { p: [-0.145, 1.16, 0.252] }), 'chest', 'chest', C.gear);
      add(RP(0.2, 0.18, 0.045, 0.02, { p: [0, 1.14, 0.335] }), 'chest', C.gear);
      if (L0) {
        molle(-0.085, 0.085, 1.075, 4, 0.3575, 'chest', 1);
        // Tragegriff oben, Kompressionsriemen mit Schnallen an den Seitentaschen
        add(torus(0.03, 0.007, 3, 8, { p: [0, 1.468, 0.255], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.6] }, Math.PI), 'chest', C.strap);
        for (const y of [1.1, 1.22]) {
          pair(rbox(0.005, 0.016, 0.1, 0, 0, { p: [-0.17, y, 0.252] }), 'chest', 'chest', C.web);
          pair(rbox(0.007, 0.02, 0.018, 0, 0, { p: [-0.171, y, 0.226] }), 'chest', 'chest', PLAST);
        }
      }
    }
  } else if (V.back === 'radio') {
    // Funkgerät in einem Rucksack im Tarnmuster (Video: keine schwarzen Kästen auf dem Rücken), Antenne bleibt sichtbar
    add(RP(0.28, 0.4, 0.16, 0.045, { p: [0, 1.22, 0.255] }), 'chest', C.gear2);
    if (!FAR) add(RP(0.25, 0.11, 0.175, 0.035, { p: [0, 1.41, 0.26] }), 'chest', C.flap);
    add(cyl(0.006, 0.01, 0.55, 4, { p: [0.085, 1.66, 0.27], r: [-0.12, 0, -0.06] }), 'chest', C.plastic);
    if (L01) add(cyl(0.022, 0.022, 0.04, q.cs, { p: [-0.07, 1.47, 0.27] }), 'chest', C.metal);
    if (L0) {
      molle(-0.11, 0.11, 1.06, 6, 0.335, 'chest', 1);
    }
  } else if (V.back === 'medbag') {
    // Sanitätstasche: weißes Feld mit rotem Kreuz (von hinten auf Distanz lesbar)
    add(RP(0.25, 0.22, 0.12, 0.03, { p: [0, 1.24, 0.235] }), 'chest', C.gear2);
    add(rbox(0.11, 0.11, 0.004, 0, 0, { p: [0, 1.25, 0.297] }), 'chest', C.medWhite);
    add(rbox(0.075, 0.022, 0.004, 0, 0, { p: [0, 1.25, 0.3] }), 'chest', C.medRed);
    add(rbox(0.022, 0.075, 0.004, 0, 0, { p: [0, 1.25, 0.3] }), 'chest', C.medRed);
    if (!FAR) add(RP(0.2, 0.05, 0.1, 0.02, { p: [0, 1.375, 0.235] }), 'chest', C.flap);
  } else if (V.back === 'launcher') {
    // Werfer RW-90 schräg auf dem Rücken (Rohr, Kappen, Visier, Griffstück) + kleiner Rucksack mit Ersatzraketen
    add(RP(0.24, 0.26, 0.11, 0.03, { p: [0, 1.25, 0.225] }), 'chest', C.gear2);
    add(cyl(0.052, 0.052, 1.02, q.cs, { p: [0.02, 1.2, 0.315], r: [0, 0, 0.55] }), 'chest', C.tube);
    add(cyl(0.062, 0.062, 0.1, q.cs, { p: [-0.245, 1.633, 0.315], r: [0, 0, 0.55] }), 'chest', C.plastic);
    add(cyl(0.062, 0.062, 0.1, q.cs, { p: [0.285, 0.767, 0.315], r: [0, 0, 0.55] }), 'chest', C.plastic);
    if (!FAR) {
      add(rbox(0.035, 0.07, 0.05, 0, 0, { p: [0.04, 1.2, 0.37], r: [0, 0, 0.55] }), 'chest', C.plastic);
      add(rbox(0.03, 0.09, 0.04, 0, 0, { p: [0.12, 1.06, 0.36], r: [0, 0, 0.55] }), 'chest', C.plastic);
      pair(rbox(0.012, 0.36, 0.024, 0, 0, { p: [-0.12, 1.26, 0.2] }), 'chest', 'chest', C.strap);
    }
  } else if (V.back === 'hydration') {
    add(RP(0.2, 0.31, 0.065, 0.028, { p: [0, 1.28, 0.205] }), 'chest', C.gear2);
    if (L01) add(cyl(0.008, 0.008, 0.3, 4, { p: [-0.13, 1.34, -0.03], r: [0.4, 0, 0.3] }), 'chest', C.plastic);
  }
  // Rucksack-Tragegurte über die Schultern bis vorn auf Platte bzw. Brust, mit Brustgurt (Rucksack sitzt sichtbar am Körper)
  if (L01 && (V.back === 'assault' || V.back === 'radio' || V.back === 'medbag')) {
    const plateFront = -0.118 - (vest === 'light' ? 0.038 : 0.052) - 0.007;
    const front = vest === 'rig' ? [[1.42, -0.106], [1.36, -0.116], [1.26, -0.118]] : [[1.448, -0.106], [1.446, plateFront], [1.29, plateFront]];
    const start = V.back === 'medbag' ? [[1.35, 0.172]] : [];
    strapPath([...start, ...PACK_STRAP, ...front], 0.125, 0.042, 0.012, { ...C.gear2, color: '#9e9e9e' }, L0 ? 1 : 3);
    if (L0) {
      const zs = vest === 'rig' ? -0.124 : vest === 'light' ? plateFront - 0.004 : -0.204;
      add(rbox(0.25, 0.016, 0.006, 0, 0, { p: [0, 1.365, zs] }), 'chest', C.strap);
      add(rbox(0.034, 0.026, 0.01, 0, 0, { p: [0, 1.365, zs - 0.004] }), 'chest', PLAST);
      // Gurtversteller (Leiterschnallen) vorn
      pair(rbox(0.046, 0.016, 0.01, 0, 0, { p: [-0.125, 1.31, (vest === 'rig' ? -0.118 : plateFront) - 0.008] }), 'chest', 'chest', PLAST);
    }
  }

  /* ------------------------------------------------------------ Hals + Kopf (Kopf/Hals selbst: body-mesh.js) */
  if (V.shemagh) add(torus(0.082, 0.034, 5, q.cs, { p: [0, 1.5, 0.01], r: [Math.PI / 2, 0, 0] }), 'neck', C.sand);
  if (V.face === 'gaiter' && !FAR) add(torus(0.078, 0.016, 4, q.cs, { p: [0, 1.492, 0.012], r: [Math.PI / 2, 0, 0], s: [1, 1.08, 1] }), 'neck', faceFab);
  const wrapHead = V.head === 'wrap';
  if (L01 && V.face !== 'gasmask') {
    const F = BODY_MESH.face;
    const eyesHidden = V.eyes === 'shades' || V.eyes === 'glasses' || V.eyes === 'goggles';
    if (L0 && !eyesHidden) {
      // tail: auf Stufe 0 zeichnet face.js den Kopf – diese Teile liegen am Ende des Indexpuffers (Ansicht ohne Kopf)
      pair(E(0.012, 0.0052, 0.005, { p: [-0.033, 1.692, F.eyeZ + 0.001] }, undefined, 6, 4), 'head', 'head', { ...C.eyeWhite, tail: true });
      pair(E(0.0055, 0.0052, 0.003, { p: [-0.033, 1.692, F.eyeZ - 0.0032] }, undefined, 5, 4), 'head', 'head', { ...C.eye, tail: true });
      if (!covered) pair(rbox(0.032, 0.005, 0.008, 0, 0, { p: [-0.035, 1.712, F.browZ + 0.006], r: [0, 0, -0.08] }), 'head', 'head', { ...C.brow, tail: true });
    } else if (!eyesHidden) {
      add(rbox(0.074, 0.011, 0.01, 0, 0, { p: [0, 1.692, F.eyeZ - 0.002] }), 'head', C.eye);
    }
  }

  // Kopfbedeckungen (sol 15.11.: über der gemessenen Kopfhülle gear-parts.js gebaut – umschließen den anatomischen Kopf aus
  // face.js wie den Körperkopf der fernen Stufen; vorher kleine Ellipsoid-Schalen, unter denen die Stirn hervorstach)
  const helmet = V.head === 'helmet';
  const nph = L0 ? 40 : L01 ? 16 : 8, nth = L0 ? 10 : L01 ? 4 : 2;
  const RUB = { color: '#1b1c1d', detail: 0.5, shine: 0.22, cls: 'leather' }; // Gummi-Kantenprofil
  if (helmet) {
    // Gefechtshelm (High-Cut): Schale ≈ 2,4 cm über der Hülle (Polster + Schale), Vorderkante gut 2 cm über den Brauen,
    // seitlich über den Ohren ausgeschnitten, hinten tief über den Hinterkopf; Tarnbezug mit Gummizug, Gummi-Kantenprofil,
    // Innenpolster am Rand, Seitenschienen, Nachtsicht-Halterung, Akku-/Gegengewichtstasche, Klettfelder, Vierpunkt-Kinnriemen
    const OFF = 0.024;
    const rim = helmetRim;
    const shellMat = V.cover ? C.cover : C.helmet;
    add(hullShell({ th1: rim, off: OFF, nph, nth }), 'head', shellMat);
    if (!FAR) {
      // Kantenprofil (Gummi) rund um den Rand
      const rp = [];
      const ru = [];
      const nr = L0 ? 48 : 14;
      for (let i = 0; i < nr; i++) {
        const ph = (i / nr) * Math.PI * 2;
        rp.push(hullP(rim(ph) - 0.012, ph, OFF - 0.003));
        ru.push(hullN(rim(ph), ph, OFF));
      }
      add(sweep(rp, ru, L0 ? roundProfile(0.0062, 6, 0.0048) : rectProfile(0.011, 0.008), { closed: true, smooth: true }), 'head', RUB);
      // Seitenschienen (ARC) – auf Bezug bzw. Schale geschraubt
      const rail = hullPath([[80, 208], [84, 180], [82, 152]], OFF + 0.003, L0 ? 4 : 2);
      pair(sweep(rail.pts, rail.ups, rectProfile(0.014, 0.0055), { smooth: false }), 'head', 'head', C.plastic);
    }
    if (L0) {
      // Innenpolster/Futter am Rand (dunkler Schaumstoff, von unten und vorn sichtbar)
      add(hullShell({ th0: (ph) => rim(ph) - 0.42, th1: (ph) => rim(ph) - 0.01, off: 0.008, nph: 32, nth: 3, flip: true }), 'head', { color: '#26272a', detail: 0.9, shine: 0.02, cls: 'cloth' });
      // Stirnpolster
      add(onHull(pad({ w: 0.075, h: 0.024, d: 0.012, rb: 0.005, rc: 0.008, puff: 0.002, bend: [3, 0], k: 2, fr: 1, bv: 3 }), rim(Math.PI * 1.5) - 0.12, Math.PI * 1.5, 0.007), 'head', { color: '#2e2f31', detail: 1, cls: 'cloth' });
      if (V.cover) {
        // Gummizug um den Bezug + Nähte des Bezugs (vorn/hinten, seitlich)
        const bp = [], bu = [];
        for (let i = 0; i < 40; i++) { const ph = (i / 40) * Math.PI * 2; bp.push(hullP(rim(ph) - 0.38, ph, OFF + 0.002)); bu.push(hullN(rim(ph) - 0.38, ph, OFF)); }
        add(sweep(bp, bu, roundProfile(0.0032, 5), { closed: true }), 'head', C.strap);
        for (const ph of [90, 270, 0, 180]) {
          const s = hullPath([[3, ph], [40, ph], [75, ph]], OFF + 0.0008, 3);
          add(sweep(s.pts, s.ups, rectProfile(0.0035, 0.0018), { smooth: false }), 'head', { ...C.cover, color: '#9a9a9a' });
        }
      }
      // Klettfelder: oben/hinten und seitlich, Infrarot-Markierung oben
      add(onHull(pad({ w: 0.06, h: 0.04, d: 0.003, rb: 0.0012, rc: 0.006, k: 2, fr: 0, bv: 2, back: false }), 0.5, Math.PI / 2, OFF + 0.001), 'head', C.patch);
      pair(onHull(pad({ w: 0.055, h: 0.03, d: 0.003, rb: 0.0012, rc: 0.006, k: 2, fr: 0, bv: 2, back: false }), 1.0, Math.PI, OFF + 0.0015, 0.05), 'head', 'head', C.patch);
      add(onHull(pad({ w: 0.024, h: 0.016, d: 0.012, rb: 0.004, rc: 0.005, k: 2, fr: 0, bv: 2 }), 0.42, Math.PI / 2, OFF + 0.006), 'head', C.plastic);
      add(onHull(cyl(0.006, 0.007, 0.012, 8, { r: [Math.PI / 2, 0, 0] }), 0.42, Math.PI / 2, OFF + 0.014), 'head', C.lens);
      // Vierpunkt-Kinnriemen: vorn/hinten vom Helmrand am Ohr vorbei zur Schnalle am Kieferwinkel, dann unter das Kinn
      const D2 = Math.PI / 180;
      const jaw = hullP(127 * D2, 196 * D2, 0.008);
      const fr = hullPath([[rim(205 * D2) / D2 - 4, 205], [108, 202], [127, 196]], 0.008, 3);
      const bk = hullPath([[rim(158 * D2) / D2 - 4, 158], [112, 172], [127, 196]], 0.008, 3);
      const chin = curve([jaw, [-0.079, 1.602, -0.035], [-0.052, 1.564, -0.054], [0, 1.551, -0.064]], 8);
      const up = (p) => { const d = [p[0], p[1] - 1.66, p[2] - 0.0]; const l = Math.hypot(...d); return d.map((v) => v / l); };
      const STRAP = { pal: 'strap', shade: 0.9, detail: 0.9, cls: 'gear' };
      pair(sweep(fr.pts, fr.ups, rectProfile(0.014, 0.0024), { smooth: false }), 'head', 'head', STRAP);
      pair(sweep(bk.pts, bk.ups, rectProfile(0.014, 0.0024), { smooth: false }), 'head', 'head', STRAP);
      pair(sweep(chin, chin.map(up), rectProfile(0.016, 0.0024), { smooth: false }), 'head', 'head', STRAP);
      pair(onHull(pad({ w: 0.026, h: 0.02, d: 0.008, rb: 0.003, rc: 0.004, k: 1, fr: 0, bv: 2 }), 127 * D2, 196 * D2, 0.012), 'head', 'head', PLAST); // Schnalle
      add(place(rbox(0.03, 0.006, 0.02, 0, 0), { p: [0, 1.549, -0.062] }), 'head', PLAST); // Kinnschale/Verschluss
    } else if (L01) {
      const D2 = Math.PI / 180;
      const fr = hullPath([[rim(200 * D2) / D2 - 4, 200], [127, 196]], 0.008, 2);
      pair(sweep(fr.pts, fr.ups, rectProfile(0.012, 0.003), { smooth: false, caps: false }), 'head', 'head', C.strap);
    }
    if (!FAR) {
      // Nachtsicht-Halterung (Schwalbenschwanz-Platte mit Bügel) vorn, Gegengewicht-/Akkutasche hinten
      const thS = rim(Math.PI * 1.5) - 0.2;
      add(onHull(pad({ w: 0.048, h: 0.034, d: 0.01, rb: 0.003, rc: 0.008, k: L0 ? 2 : 1, fr: 0, bv: 2, bend: [5, 0] }), thS, Math.PI * 1.5, OFF + 0.005), 'head', V.nvg ? C.metal : C.plastic);
      if (L0) {
        add(onHull(rbox(0.02, 0.014, 0.012, 0.003, 1), thS + 0.11, Math.PI * 1.5, OFF + 0.012), 'head', C.metal);
        for (const sx of [-1, 1]) add(onHull(cyl(0.0035, 0.0035, 0.004, 6, { r: [Math.PI / 2, 0, 0] }), thS - 0.04, Math.PI * 1.5 + sx * 0.18, OFF + 0.012), 'head', C.metal); // Schrauben
      }
      add(onHull(pad({ w: 0.072, h: 0.05, d: 0.03, rb: 0.009, rc: 0.012, puff: 0.003, k: L0 ? 2 : 1, fr: L0 ? 1 : 0, bv: L0 ? 3 : 2 }), 1.38, Math.PI / 2, OFF + 0.017), 'head', C.flap);
      if (L0) add(onHull(pad({ w: 0.076, h: 0.02, d: 0.008, rb: 0.003, rc: 0.006, k: 1, fr: 0, bv: 2 }), 1.17, Math.PI / 2, OFF + 0.03), 'head', C.flap);
    }
    if (V.nvg && !FAR) {
      add(onHull(pad({ w: 0.08, h: 0.032, d: 0.045, rb: 0.012, rc: 0.014, k: 2, fr: 0, bv: 2 }), rim(Math.PI * 1.5) - 0.32, Math.PI * 1.5, OFF + 0.04), 'head', C.plastic);
    }
    // kleines Abzeichen in Teamfarbe hinten oben
    add(onHull(pad({ w: 0.024, h: 0.018, d: 0.006, rb: 0.002, rc: 0.004, k: 1, fr: 0, bv: 1 }), 0.62, Math.PI / 2, OFF + 0.004), 'head', C.accent);
  } else if (V.head === 'cap') {
    // Feldmütze: Sechs-Bahnen-Krone eng über der Hülle, gebogener Schirm, Knopf, Nähte, Teamband
    const back = V.capBack ? -1 : 1;
    const capMat = { pal: 'gear', shade: 1.08, detail: 1, cls: 'cloth' };
    const crim = (ph) => { const s = Math.sin(ph); return (s < 0 ? 79 + 9 * s : 79 + 15 * s) * Math.PI / 180; };
    add(hullShell({ th1: crim, off: 0.007, nph: Math.round(nph * 0.8), nth }), 'head', capMat);
    const fph = back > 0 ? Math.PI * 1.5 : Math.PI / 2;
    const vis = pad({ w: 0.16, h: 0.075, d: 0.006, rb: 0.0028, rc: 0.032, k: L0 ? 4 : 1, fr: L0 ? 2 : 0, bv: L0 ? 3 : 1, bend: [-2.2, 0] });
    // Schirm liegt waagerecht vor dem Rand, Seiten hängen
    place(vis, { p: [0, 0, 0], r: [-Math.PI / 2, 0, 0] });
    const rp = hullP(crim(fph), fph, 0.007), rn = hullN(crim(fph), fph, 0.007);
    place(vis, { p: [rp[0], rp[1] - 0.004, rp[2] + back * -0.034], r: [-0.15 * back, back > 0 ? 0 : Math.PI, 0] });
    add(vis, 'head', { pal: 'gear', shade: 0.92, detail: 1, cls: 'cloth' });
    void rn;
    add(onHull(pad({ w: 0.034, h: 0.024, d: 0.004, rb: 0.0015, rc: 0.005, k: 1, fr: 0, bv: 1 }), crim(fph) - 0.3, fph, 0.008), 'head', C.accent);
    const bp = [], bu = [];
    for (let i = 0; i < (L0 ? 36 : 10); i++) { const ph = (i / (L0 ? 36 : 10)) * Math.PI * 2; bp.push(hullP(crim(ph) - 0.06, ph, 0.0085)); bu.push(hullN(crim(ph), ph, 0.007)); }
    add(sweep(bp, bu, rectProfile(0.011, 0.003), { closed: true, smooth: false }), 'head', C.band);
    if (L0) {
      add(onHull(ellipsoid(0.009, 0.009, 0.005, 8, 4), 0, 0, 0.009), 'head', capMat); // Knopf
      for (let k = 0; k < 6; k++) {
        const ph = (30 + 60 * k);
        const s = hullPath([[4, ph], [40, ph], [crim(ph * Math.PI / 180) * 180 / Math.PI - 4, ph]], 0.0075, 3);
        add(sweep(s.pts, s.ups, rectProfile(0.003, 0.0016), { smooth: false }), 'head', { pal: 'gear', shade: 0.85, detail: 1, cls: 'cloth' });
      }
    }
  } else if (V.head === 'boonie') {
    // Buschhut: Krone über der Hülle, umlaufende, leicht hängende Krempe mit Steppnähten, Hutband in Teamfarbe
    const brim = (ph) => { const s = Math.sin(ph); return (s < 0 ? 84 + 6 * s : 84 + 10 * s) * Math.PI / 180; };
    add(hullShell({ th1: brim, off: 0.014, nph: Math.round(nph * 0.8), nth }), 'head', C.top);
    const np2 = L0 ? 40 : L01 ? 12 : 8;
    const bp = [], bu = [];
    for (let i = 0; i < np2; i++) {
      const ph = (i / np2) * Math.PI * 2;
      const p = hullP(brim(ph), ph, 0.014);
      bp.push(p); bu.push([Math.cos(ph), 0, Math.sin(ph)]);
    }
    const prof = [[0.002, -0.002], [-0.018 + 0.0015, 0.068], [-0.018 - 0.0015, 0.068], [-0.002, -0.002]];
    add(sweep(bp, bu, prof, { closed: true, smooth: false }), 'head', C.top);
    if (!FAR) {
      const hb = [], hu = [];
      for (let i = 0; i < np2; i++) { const ph = (i / np2) * Math.PI * 2; hb.push(hullP(brim(ph) - 0.1, ph, 0.0155)); hu.push(hullN(brim(ph) - 0.1, ph, 0.014)); }
      add(sweep(hb, hu, rectProfile(0.022, 0.003), { closed: true, smooth: false }), 'head', C.band);
      add(onHull(pad({ w: 0.035, h: 0.02, d: 0.004, rb: 0.0015, rc: 0.004, k: 1, fr: 0, bv: 1 }), brim(Math.PI * 1.5) - 0.1, Math.PI * 1.5, 0.018), 'head', C.accent);
    }
    if (L0) for (const b of [0.028, 0.05]) {
      const sp = bp.map((p, i) => [p[0] + bu[i][0] * b, p[1] - (0.018 / 0.068) * b + 0.0018, p[2] + bu[i][2] * b]);
      add(sweep(sp, [0, 1, 0], rectProfile(0.0025, 0.0012), { closed: true, smooth: false }), 'head', { ...C.top, color: '#a8a8a8' });
    }
  } else if (V.head === 'beanie') {
    add(E(0.103, 0.104, 0.114, { p: [0, 1.703, 0.012] }, { thetaLength: Math.PI * 0.55 }), 'head', C.knit);
    add(cyl(0.106, 0.108, 0.04, q.cs + 2, { p: [0, 1.718, 0.012], s: [1, 1, 1.07] }), 'head', { ...C.knit, color: '#323334' });
    add(rbox(0.03, 0.02, 0.006, 0, 0, { p: [0.045, 1.72, -0.106] }), 'head', C.accent);
    add(torus(0.107, 0.008, 3, q.cs + 2, { p: [0, 1.742, 0.012], r: [Math.PI / 2, 0, 0], s: [1, 1.07, 1] }), 'head', C.band);
  } else if (wrapHead) {
    // Kopftuch: über den Schädel gebunden, Stirnwulst, Knoten mit Enden im Nacken, Teamband
    const wrap = { pal: 'gear2', shade: 1.05, detail: 1, cls: 'cloth' };
    add(E(0.1, 0.104, 0.11, { p: [0, 1.703, 0.014] }, { thetaLength: Math.PI * 0.56 }), 'head', wrap);
    if (!FAR) add(torus(0.098, 0.012, 4, q.cs + 2, { p: [0, 1.715, 0.014], r: [Math.PI / 2 + 0.12, 0, 0], s: [1, 1.1, 1] }), 'head', { ...wrap, shade: 0.9 });
    if (L01) add(E(0.03, 0.026, 0.024, { p: [0, 1.7, 0.122] }, undefined, 8, 6), 'head', wrap);
    if (L01) pair(rbox(0.03, 0.09, 0.008, 0, 0, { p: [-0.018, 1.64, 0.13], r: [0.25, 0, 0.18] }), 'head', 'head', wrap);
    add(torus(0.1, 0.008, 3, q.cs + 2, { p: [0, 1.742, 0.014], r: [Math.PI / 2, 0, 0], s: [1, 1.08, 1] }), 'head', C.band);
  }
  // Headset (Kapsel-Gehörschutz mit Funk): ovale Kapseln mit Ohrpolster über den Ohren, mit Helm an den Seitenschienen
  // befestigt, sonst Kopfbügel; Mikrofonarm rechts zum Mund
  if (V.ears) {
    const cupProf = [[0.0005, 0], [0.026, 0], [0.034, 0.004], [0.038, 0.012], [0.039, 0.021], [0.035, 0.028], [0.025, 0.032], [0.0005, 0.033]];
    const cup = !L0 ? cyl(0.036, 0.038, 0.032, FAR ? 6 : 10, { r: [0, 0, Math.PI / 2], p: [0, 0.016, 0] }) : lathe(cupProf, 18);
    // lathe dreht um Y → um Z gekippt zeigt die Achse nach −X (linke Seite, rechts gespiegelt)
    place(cup, { r: [0, 0, Math.PI / 2] }); place(cup, { s: [1, 1.13, 0.9], p: [-0.101, 1.668, 0.012] });
    pair(cup, 'head', 'head', C.plastic);
    if (L0) {
      const cush = torus(0.029, 0.0085, L0 ? 6 : 3, L0 ? 18 : 8, { r: [0, Math.PI / 2, 0] });
      place(cush, { s: [1, 1.13, 0.9], p: [-0.1, 1.668, 0.012] });
      pair(cush, 'head', 'head', { color: '#2a2b2d', detail: 0.8, shine: 0.25, cls: 'leather' });
    }
    if (L0) {
      // Deckel/Lautstärke-Knöpfe, Gitter
      pair(cyl(0.004, 0.004, 0.008, 6, { p: [-0.118, 1.705, 0.03], r: [0, 0, 0.4] }), 'head', 'head', { color: '#2a2d30', detail: 0.3, shine: 0.4, cls: 'hard' });
      pair(ellipsoid(0.004, 0.024, 0.02, 6, 4, { p: [-0.1325, 1.668, 0.012] }), 'head', 'head', { color: '#26292c', detail: 0.4, shine: 0.3, cls: 'hard' });
    }
    if (helmet) {
      // Schienenadapter: kurzer Arm von der Kapsel hoch zur Seitenschiene
      if (!FAR) pair(rbox(0.012, 0.036, 0.022, 0.003, L0 ? 1 : 0, { p: [-0.116, 1.716, 0.008] }), 'head', 'head', C.plastic);
    } else if (!FAR) {
      const hb = hullPath([[84, 180], [55, 180], [25, 180], [0, 180], [-25, 180], [-55, 180], [-84, 180]], V.head === 'cap' ? 0.0115 : 0.006, L0 ? 3 : 1);
      add(sweep(hb.pts, hb.ups, rectProfile(0.024, 0.006), { smooth: false }), 'head', C.plastic);
    }
    if (L01) {
      const mic = curve([[0.12, 1.648, -0.018], [0.112, 1.625, -0.06], [0.075, 1.607, -0.1], [0.034, 1.612, -0.12]], L0 ? 10 : 5);
      add(sweep(mic, [0, 1, 0], roundProfile(0.0028, L0 ? 6 : 3), { smooth: true }), 'head', C.plastic);
      if (L0) add(ellipsoid(0.008, 0.007, 0.008, 8, 6, { p: [0.03, 1.612, -0.122] }), 'head', { color: '#1a1b1c', detail: 1, shine: 0.02, cls: 'cloth' });
    }
  }
  // Brillen / Maske
  if (V.eyes === 'goggles') {
    add(R(0.13, 0.046, 0.034, 0.016, { p: [0, 1.697, -0.093] }), 'head', { color: '#25282a', detail: 0.3, shine: 0.3, cls: 'hard' });
    if (!FAR) pair(R(0.05, 0.032, 0.008, 0.01, { p: [-0.031, 1.697, -0.111] }), 'head', 'head', C.visor);
    else add(R(0.11, 0.032, 0.008, 0.01, { p: [0, 1.697, -0.111] }), 'head', C.visor);
    if (!FAR) add(torus(0.112, 0.008, 3, q.cs, { p: [0, 1.697, 0.012], r: [Math.PI / 2, 0, 0], s: [1, 1.13, 1] }), 'head', C.strap);
  } else if (V.eyes === 'shades' || V.eyes === 'glasses') {
    // Schutzbrille als gebogenes Glasband (Panorama), Bügel bis zum Ohr
    const glass = V.eyes === 'shades' ? C.lens : C.smoke;
    if (FAR) add(rbox(0.112, 0.027, 0.014, 0, 0, { p: [0, 1.694, -0.099] }), 'head', glass);
    else {
      add(E(0.1, 0.06, 0.113, { p: [0, 1.694, 0.0] }, { phiStart: Math.PI * 1.5 - Math.PI * 0.36, phiLength: Math.PI * 0.72, thetaStart: Math.PI * 0.4, thetaLength: Math.PI * 0.2 }, 14, 4), 'head', glass);
      if (L0) add(E(0.101, 0.06, 0.114, { p: [0, 1.6945, 0.0] }, { phiStart: Math.PI * 1.5 - Math.PI * 0.37, phiLength: Math.PI * 0.74, thetaStart: Math.PI * 0.385, thetaLength: Math.PI * 0.03 }, 14, 1), 'head', C.plastic);
      if (L01) pair(rbox(0.006, 0.008, 0.1, 0, 0, { p: [-0.096, 1.697, -0.03] }), 'head', 'head', C.plastic);
    }
  }
  if (V.face === 'gasmask') {
    add(E(0.07, 0.074, 0.06, { p: [0, 1.64, -0.065] }), 'head', { color: '#2a2d2f', detail: 0.6, shine: 0.32, cls: 'leather' });
    // Sichtgläser deutlich vor der Maske, hell mit Glanzlicht (Blickrichtung erkennbar), dunkle Fassung
    pair(cyl(0.031, 0.031, 0.012, q.cs, { p: [-0.036, 1.69, -0.108], r: [Math.PI / 2 - 0.15, 0, 0] }), 'head', 'head', { color: '#151617', detail: 0, shine: 0.4, cls: 'hard' });
    pair(cyl(0.025, 0.025, 0.006, q.cs, { p: [-0.036, 1.69, -0.116], r: [Math.PI / 2 - 0.15, 0, 0] }), 'head', 'head', C.visor);
    // Filter dunkel (nicht in Hautfarbe – wirkte sonst wie ein Haarknoten)
    add(cyl(0.032, 0.032, 0.048, q.cs, { p: [0.035, 1.59, -0.115], r: [1.1, 0.4, 0] }), 'head', { color: '#1c1e1f', detail: 0.5, shine: 0.25, cls: 'hard' });
    if (!FAR) add(cyl(0.018, 0.018, 0.012, q.cs, { p: [0.044, 1.578, -0.136], r: [1.1, 0.4, 0] }), 'head', C.metal);
    add(E(0.1, 0.11, 0.106, { p: [0, 1.692, 0.018] }, { thetaLength: Math.PI * 0.62 }), 'head', C.top);
    if (L01) pair(rbox(0.012, 0.012, 0.11, 0, 0, { p: [-0.092, 1.67, 0.01], r: [0.4, 0, 0] }), 'head', 'head', C.strap); // Maskenbänder
  }

  /* ------------------------------------------------------------ Ghillie-Anzug / Tarnschleier */
  // 21.10. (Nutzer: „Scharfschützen … diese Ghillie-Suits“): Jute- und Bastbüschel über Kopf, Schultern, Rücken,
  // Arme und Beine; Brust und Gesicht bleiben frei (Waffe/Zielen). Tarnschleier (Späher): nur Kopf und Schultern.
  if (V.ghillie || V.veil) {
    let seed = 7 + VARIANTS.indexOf(V) * 101;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const full = !!V.ghillie;
    // Fransen in Lagen (wie ein echter Ghillie: dicht geschuppte Jutestreifen); ferne Stufen: weniger, breitere Fransen
    const dens = FAR ? 0.32 : L01 ? 0.6 : 1, wMul = 1 / dens;
    const juteM = [C.jute, C.jute2, C.jute3, C.jute4];
    const buckets = new Map();
    // zweiseitiges Viereck: oben am Punkt P (Breite w entlang t), hängt entlang d (Länge len), unten verjüngt
    const strip = (bone, P, t, d, len, w) => {
      const mi = (rnd() * juteM.length) | 0, key = bone + '|' + mi;
      let arr = buckets.get(key);
      if (!arr) buckets.set(key, (arr = []));
      const hw = w / 2, bw = hw * (0.55 + rnd() * 0.3);
      const a = [P[0] - t[0] * hw, P[1] - t[1] * hw, P[2] - t[2] * hw], b = [P[0] + t[0] * hw, P[1] + t[1] * hw, P[2] + t[2] * hw];
      const E2 = [P[0] + d[0] * len, P[1] + d[1] * len, P[2] + d[2] * len];
      const c = [E2[0] + t[0] * bw, E2[1] + t[1] * bw, E2[2] + t[2] * bw], e = [E2[0] - t[0] * bw, E2[1] - t[1] * bw, E2[2] - t[2] * bw];
      arr.push(...a, ...b, ...c, ...a, ...c, ...e, ...a, ...c, ...b, ...a, ...e, ...c);
    };
    // Ring von Fransen um eine senkrechte Achse (cx, cz) mit Halbachsen (ra, rb) in Höhe y, Winkel φ (0 = +x·sx, π/2 = hinten)
    const ring = (bone, cx, cz, ra, rb, y, sx, phi0, phi1, len0, len1, tilt0, tilt1) => {
      const arc = Math.abs(phi1 - phi0) * (ra + rb) / 2, w0 = 0.026 * wMul;
      const n = Math.max(2, Math.round(arc / (w0 * 0.85)));
      for (let i = 0; i < n; i++) {
        const ph = phi0 + (phi1 - phi0) * (i + 0.3 + rnd() * 0.4) / n;
        const ox = Math.cos(ph) * sx, oz = Math.sin(ph);
        const P = [cx + ox * ra, y + (rnd() - 0.5) * 0.02, cz + oz * rb];
        const nl = Math.hypot(ox / ra, oz / rb) || 1, nx = ox / ra / nl, nz = oz / rb / nl;
        const tilt = tilt0 + rnd() * (tilt1 - tilt0), st = Math.sin(tilt), ct = Math.cos(tilt);
        strip(bone, P, [-nz, 0, nx], [nx * st, -ct, nz * st], len0 + rnd() * (len1 - len0), w0 * (0.8 + rnd() * 0.5));
      }
    };
    const hy = V.head === 'boonie' ? 1.79 : 1.8;
    // Kapuze: Netz + drei Fransenlagen (Gesicht frei)
    add(E(0.16, 0.085, 0.17, { p: [0, hy - 0.045, 0.015] }, { thetaLength: Math.PI * 0.55 }, q.sw, Math.max(3, q.sh / 2)), 'head', C.jute3);
    for (const [dy, r] of [[0.0, 0.12], [-0.035, 0.16], [-0.07, 0.19]]) ring('head', 0, 0.015, r, r, hy + dy, 1, -0.55, Math.PI + 0.55, 0.07, 0.15, 0.35, 0.8);
    // Schultern (von oben über die Schulterkuppen) und Rücken/Seiten in Lagen bis zur Hüfte
    add(E(0.24, 0.16, 0.2, { p: [0, 1.4, 0.05] }, { thetaLength: Math.PI * 0.5 }), 'chest', C.jute3);
    ring('chest', 0, 0.02, 0.13, 0.11, 1.52, 1, -0.75, Math.PI + 0.75, 0.12, 0.2, 0.9, 1.25);
    const torsoLayers = full ? [1.47, 1.4, 1.33, 1.26, 1.19, 1.12, 1.05] : [1.47, 1.4, 1.33];
    for (const y of torsoLayers) ring('chest', 0, 0.035, 0.26, 0.27, y, 1, -0.35, Math.PI + 0.35, 0.09, 0.17, 0.12, 0.4);
    if (full) {
      for (const y of [0.99, 0.92]) ring('hips', 0, 0.03, 0.24, 0.22, y, 1, -0.25, Math.PI + 0.25, 0.09, 0.16, 0.1, 0.35);
      // Ärmel (außen/oben/hinten) und Hose (außen/hinten)
      for (const [ub, fb, sx] of [['upperArmL', 'foreArmL', -1], ['upperArmR', 'foreArmR', 1]]) {
        for (const y of [1.4, 1.32, 1.24, 1.16]) ring(ub, sx * DIM.shoulderX, 0, 0.082, 0.082, y, sx, -0.4, 2.1, 0.07, 0.13, 0.15, 0.45);
        for (const y of [1.06, 0.98]) ring(fb, sx * DIM.shoulderX, 0, 0.07, 0.07, y, sx, -0.3, 2.0, 0.05, 0.1, 0.15, 0.4);
      }
      for (const [tb, sb, sx] of [['thighL', 'shinL', -1], ['thighR', 'shinR', 1]]) {
        for (const y of [0.86, 0.78, 0.7, 0.62]) ring(tb, sx * 0.1, 0, 0.125, 0.125, y, sx, -0.5, 2.7, 0.08, 0.15, 0.1, 0.35);
        for (const y of [0.44, 0.36, 0.28]) ring(sb, sx * 0.1, 0.005, 0.088, 0.088, y, sx, -0.5, 2.7, 0.06, 0.12, 0.08, 0.3);
      }
    }
    for (const [key, arr] of buckets) {
      const [bone, mi] = key.split('|');
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      add(g, bone, juteM[+mi]);
    }
  }

  /* ------------------------------------------------------------ Arme (Arme/Hände selbst: body-mesh.js) */
  const AX = -DIM.shoulderX; // Armachse links (rechts gespiegelt)
  // Armbinde in Teamfarbe rund um den Oberarm (auch aus der Ferne und von hinten sichtbar)
  // 15.11.: Maße am schlankeren MakeHuman-Oberarm (Halbachsen ≈ 0,06 × 0,066) gemessen
  if (!civ) pair(cyl(0.07, 0.068, 0.055, q.cs, { p: [AX, 1.25, -0.003], s: [0.97, 1, 1.03] }, true), 'upperArmL', 'upperArmR', C.band);
  if (L0 && !civ) pair(rbox(0.006, 0.044, 0.05, 0, 0, { p: [AX - 0.066, 1.3, -0.003] }), 'upperArmL', 'upperArmR', C.patch); // Klett auf der Ärmeltasche
  if (V.armband === 'medic') {
    // Armbinde Sanitäter (weiß, rotes Kreuz außen) unter dem Teamband
    pair(cyl(0.067, 0.065, 0.065, q.cs, { p: [AX, 1.19, -0.003], s: [0.97, 1, 1.02] }, true), 'upperArmL', 'upperArmR', C.medWhite);
    pair(rbox(0.006, 0.044, 0.014, 0, 0, { p: [AX - 0.066, 1.19, -0.003] }), 'upperArmL', 'upperArmR', C.medRed);
    pair(rbox(0.006, 0.014, 0.044, 0, 0, { p: [AX - 0.066, 1.19, -0.003] }), 'upperArmL', 'upperArmR', C.medRed);
  }
  if (V.pauldrons) pair(E(0.102, 0.078, 0.108, { p: [AX - 0.018, 1.44, 0.0] }, { thetaLength: Math.PI * 0.5 }), 'upperArmL', 'upperArmR', C.gear);
  // hochgekrempelte Ärmel: Wulst unter dem Ellbogen
  // 20.11.: Wulst höher und dicker – deckt die Stoff/Haut-Grenze am Ellbogen (vorher gezackt sichtbar)
  if (rolled) pair(torus(0.062, 0.019, 4, q.cs, { p: [AX, 1.135, 0.0], r: [Math.PI / 2, 0, 0], s: [0.9, 1.04, 1] }), 'foreArmL', 'foreArmR', civ ? civ.top : C.top);
  if (L0) add(R(0.014, 0.024, 0.032, 0.004, { p: [AX - 0.041, 0.965, 0] }), 'foreArmL', C.plastic); // Uhr

  const geo = B.build();
  geo.userData.variant = V.id;
  geo.userData.lod = lod;
  return geo;
}

/** Farbe aufhellen/abdunkeln (sRGB-Hex). */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return '#' + ((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0');
}

export { shade, xf, limb };
