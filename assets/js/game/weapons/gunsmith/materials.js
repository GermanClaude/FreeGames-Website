// Gemeinsame PBR-Materialien der Waffen (geteilt zwischen allen Modellen, LODs und Klonen).
import * as THREE from 'three';
import { wearMap, brushedMap, grainNormal, stippleNormal, knurlNormal, woodMap, reticleMap, polymerMap, drumFaceMap, drumFaceNormal, finishMaps } from './textures.js?v=20261122020853';
import { p9SlideMaps, p9FrameMaps, SLIDE_CAMO_REPEAT, FRAME_CAMO_REPEAT } from './p9-tex.js?v=20261122020853';
import { m17FurnMaps, FURN_CAMO_REPEAT } from './m17-tex.js?v=20261122020853';
import { kv47WoodMaps, kv47RecMaps, WOOD_CAMO_REPEAT, REC_CAMO_REPEAT } from './kv47-tex.js?v=20261122020853';
import { qx90FrameMaps, qx90UpperMaps, FRAME_CAMO_REPEAT as QX_FRAME_REPEAT, UPPER_CAMO_REPEAT as QX_UPPER_REPEAT } from './qx90-tex.js?v=20261122020853';
import { vp9FurnMaps, CAMO_REPEAT as VP9_CAMO_REPEAT } from './vp9-tex.js?v=20261122020853';
import { adlerMaps, CAMO_REPEAT as ADLER_CAMO_REPEAT } from './adler-tex.js?v=20261122020853';
import { zwWoodMaps, WOOD_CAMO_REPEAT as ZW_WOOD_REPEAT } from './zwilling-tex.js?v=20261122020853';
import { p9aMaps, CAMO_REPEAT as P9A_CAMO_REPEAT } from './p9a-tex.js?v=20261122020853';
import { wirbelWoodMaps, wirbelMantelAlpha, WOOD_CAMO_REPEAT as WIRBEL_WOOD_REPEAT, MANTEL_CAMO_REPEAT as WIRBEL_MANTEL_REPEAT } from './wirbel-tex.js?v=20261122020853';
import { dropCached } from './textures.js?v=20261122020853';
import { kitMaps, KIT_R } from './finish-kit.js?v=20261122020853';
import { vmLight } from './vmlight.js?v=20261122020853';   // Weltschatten auf der Ego-Waffe (waffen, 14.11.)

const mats = new Map();

// UV-Maßstab: 1 UV-Einheit = UV_SCALE Meter (siehe builder.js boxUV)
export const UV_SCALE = 0.2;

function std(o) {
  const m = new THREE.MeshStandardMaterial(o);
  return m;
}
const solid = (m) => { m.userData.solid = true; return m; };

// Feinere Kachelung der geteilten Detailtexturen (aus der Nähe scharf statt verwaschen); Klone teilen das Bild
const fine = (t, n) => { const c = t.clone(); c.repeat.set(n, n); c.needsUpdate = true; return c; };

// Gebrauchsspuren im Shader (PC-Detailstufe): Attribut wearDirt (x = Kante/Fase blank, y = Schmutz in Kehlen, aus
// cavityColors bzw. Builder-Fasen) plus vorzeichenbehaftete Krümmung aus den Bildschirm-Ableitungen (außen = Abrieb,
// innen = Schmutz/Verdeckung). Abrieb nur fleckweise (Rauschen im Bauteil-Raum), nie als gleichmäßige Umrisslinie.
// Dazu: Unebenheiten (feine Wellen im Bauteil-Raum als Normalenstörung → Spiegelungen verziehen sich wie an echtem
// Metall), fleckige Rauheit (Fett/Griffspuren) und leichte Farbschwankung des Eloxals; Kehlen verdecken Umgebungslicht.
// Fehlt das Attribut (Bot-Detailstufe), liefert WebGL (0, 0) → nur die Krümmungsanteile.
const WEAR_GLSL = `
varying vec2 vWD; varying vec3 vObjP; varying vec3 vObjN; uniform vec3 uWearCol; uniform vec4 uDust;
float wh3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float wn3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wh3(i), wh3(i + vec3(1, 0, 0)), f.x), mix(wh3(i + vec3(0, 1, 0)), wh3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(wh3(i + vec3(0, 0, 1)), wh3(i + vec3(1, 0, 1)), f.x), mix(wh3(i + vec3(0, 1, 1)), wh3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
`;
// Handy (grober Zeiger): ohne Shader-Zusätze (leichte Fassung, Nutzer 13.10.)
const WEAR_ON = !(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
// kit (finish-kit.js): Rauheitskarte trägt im Rotkanal Tönung (≤ 0,7) bzw. blanke Stellen (> 0,7, Kratzer bis aufs Grundmetall →
// wie Kantenabrieb mit der Abriebfarbe); kt = Stärke der Tönung
function wearPatch(m, { col, metal, rough, k = 1, bump = 0.00012, tone = 0.12, smear = 0.35, kit = false, kt = 1 }) {
  if (!WEAR_ON) return m;
  const wc = new THREE.Color(col);
  const f = (v) => v.toFixed(5);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWearCol = { value: wc };
    sh.uniforms.uDust = DUST;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 wearDirt;\nvarying vec2 vWD;\nvarying vec3 vObjP;\nvarying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWD = wearDirt; vObjP = transformed; vObjN = objectNormal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + WEAR_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float kBare = 0.0;
        ${kit ? `#ifdef USE_ROUGHNESSMAP
        { float kR = texture2D(roughnessMap, vRoughnessMapUv).r;
          kBare = smoothstep(0.7, 0.9, kR);
          diffuseColor.rgb *= 1.0 + ${f(kt)} * (min(kR, 0.7) - 0.35) / 0.35; }
        #endif` : ''}
        float wPatch = smoothstep(0.38, 0.62, wn3(vObjP * 160.0)) * 0.7 + smoothstep(0.5, 0.75, wn3(vObjP * 900.0 + 7.0)) * 0.3;
        float wLow = wn3(vObjP * 38.0 + 3.0), wBig = wn3(vObjP * 7.0 + 11.0);
        float wConv = 0.0, wConc = 0.0;
        #ifndef FLAT_SHADED
        {
          vec3 wn = normalize(vNormal), wp = -vViewPosition, px = dFdx(wp), py = dFdy(wp);
          float kx = dot(dFdx(wn), px) / max(dot(px, px), 1e-12), ky = dot(dFdy(wn), py) / max(dot(py, py), 1e-12);
          wConv = smoothstep(900.0, 2600.0, max(kx, ky));
          wConc = smoothstep(300.0, 1400.0, -min(kx, ky));
        }
        #endif
        float wEdge = clamp(max(max(vWD.x, wConv * 0.9) * (0.06 + 0.94 * wPatch) * ${f(k)}, kBare), 0.0, 1.0);
        float wDirt = clamp(max(vWD.y, wConc * 0.7), 0.0, 1.0);
        diffuseColor.rgb *= 1.0 + ${f(tone)} * (wBig - 0.5) + ${f(tone * 0.5)} * (wLow - 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, uWearCol, wEdge * 0.9) * (1.0 - 0.55 * wDirt);
        // Kartenstaub (waffen 14.11.): feiner Staub in Kehlen, Rillen und auf nach oben weisenden Flächen, fleckig; Farbe/Menge
        // aus dem Kartenboden (setWeaponDust, Viewmodel je Karte). Kanten bleiben sauber (dort reibt die Hand ihn ab).
        float wUp = clamp(normalize(vObjN).y, 0.0, 1.0);
        float wDust = clamp((wDirt * 0.85 + wUp * wUp * 0.32 * smoothstep(0.35, 0.8, wn3(vObjP * 70.0 + 19.0)) + 0.05 * wn3(vObjP * 260.0 + 3.0)) * (1.0 - wEdge), 0.0, 1.0) * uDust.a;
        diffuseColor.rgb = mix(diffuseColor.rgb, uDust.rgb, wDust * 0.75);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor *= 1.0 + ${f(smear)} * (wLow - 0.5) + ${f(smear * 0.6)} * (wBig - 0.5);
        roughnessFactor = clamp(mix(mix(roughnessFactor, ${f(rough)}, wEdge), 0.92, wDirt), 0.04, 1.0);
        roughnessFactor = mix(roughnessFactor, 0.95, wDust * 0.8);
        // Fingerabdrücke/Hautfett (waffen 14.11.): vereinzelte ovale Abdrücke (~12 × 9 mm) mit Papillarlinien (0,45 mm) – im
        // Glanzlicht sichtbar; Linien blenden aus, sobald sie kleiner als ein Pixel werden (kein Flimmern)
        {
          vec3 fc = floor(vObjP * 28.0), fq = fract(vObjP * 28.0) - 0.5;
          float fh = wh3(fc + 41.0);
          if (fh > 0.8) {
            vec3 fo = vec3(wh3(fc + 3.1), wh3(fc + 5.7), wh3(fc + 9.3)) - 0.5;
            vec3 fd = (fq - fo * 0.4) / 28.0;
            float fr = length(fd * vec3(1.0, 1.25, 1.0));
            float fSpot = 1.0 - smoothstep(0.0035, 0.0062, fr);
            float fRid = 0.5 + 0.5 * sin(fr * 13960.0 + fh * 40.0);
            float fAA = 1.0 - smoothstep(0.3, 0.9, fwidth(fr) * 2800.0);
            roughnessFactor *= 1.0 - fSpot * (0.16 + 0.22 * mix(0.5, fRid, fAA)) * (1.0 - wDust);
          }
        }`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, ${f(metal)}, wEdge);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 wGrad = vec3(0.0); float wDet = 1.0;
        #ifndef FLAT_SHADED
        {
          // Unebenheiten: Höhe in Metern aus zwei Rauschlagen (Wellen ~2 cm, Korn ~3 mm), als Oberflächengradient
          float hgt = (wn3(vObjP * 55.0) + 0.35 * wn3(vObjP * 330.0 + 5.0)) * ${f(bump)};
          vec3 sp = -vViewPosition, sx = dFdx(sp), sy = dFdy(sp);
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
          wDet = dot(sx, r1);
          wGrad = sign(wDet) * (dFdx(hgt) * r1 + dFdy(hgt) * r2);
          normal = normalize(abs(wDet) * normal - wGrad);
        }
        #endif`)
      .replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
        #ifdef USE_CLEARCOAT
          clearcoatNormal = normalize(abs(wDet) * clearcoatNormal - wGrad * 0.8);   // Glanzschicht folgt den Wellen
        #endif`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        { float wAO = 1.0 - 0.7 * wDirt; reflectedLight.indirectDiffuse *= wAO; reflectedLight.indirectSpecular *= wAO * wAO; }`);
  };
  m.customProgramCacheKey = () => `wear6:${col}:${metal}:${rough}:${k}:${bump}:${tone}:${smear}:${kit ? kt : '-'}`;
  return m;
}
// Kartenstaub (waffen 14.11.): geteiltes Uniform aller wearPatch-Materialien; rgb = Staubfarbe (linear), a = Menge 0…1
const DUST = { value: new THREE.Vector4(0.32, 0.29, 0.25, 0) };
/** Staubfarbe (THREE.Color oder Hex, sRGB) und -menge (0…1) für alle Ego-Waffen setzen (viewmodel.js je Karte). */
export function setWeaponDust(color, amount = 0.5) {
  const c = color && color.isColor ? color.clone() : new THREE.Color(color ?? 0x8a7d6a);
  DUST.value.set(c.r, c.g, c.b, Math.max(0, Math.min(1, amount)));
}
const ALU_WEAR = { col: 0x8f9398, metal: 1, rough: 0.3 }, STEEL_WEAR = { col: 0x85878a, metal: 1, rough: 0.34, bump: 0.00008 };
const POLY_WEAR = { col: 0x3d3e41, metal: 0, rough: 0.5, k: 0.7, bump: 0.00006, tone: 0.06, smear: 0.25 };
// Edelstahl (Adler): Kanten blank poliert statt dunkler Grund – heller, glatter, kaum Beulen
const STAINLESS_WEAR = { col: 0xe4e6ea, metal: 1, rough: 0.1, k: 0.75, bump: 0.00002, tone: 0.05, smear: 0.3 };
function phys(o) { return new THREE.MeshPhysicalMaterial(o); }

const DEFS = {
  // Parkerisierter Stahl / Gunmetal
  steel: () => std({ color: 0x3f4146, metalness: 0.82, roughness: 0.5, roughnessMap: wearMap(), metalnessMap: wearMap() }),
  // Brünierter Lauf
  steelDark: () => std({ color: 0x2b2c30, metalness: 0.9, roughness: 0.4, roughnessMap: wearMap() }),
  // Blankes Metall (Verschluss, Laufmündung innen sichtbar)
  steelBright: () => std({ color: 0x8d9095, metalness: 1, roughness: 0.3, roughnessMap: wearMap() }),
  // Schwarz eloxiertes Aluminium
  alu: () => std({ color: 0x2a2b2f, metalness: 0.6, roughness: 0.46, roughnessMap: wearMap(), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.08, 0.08) }),
  // Cerakote Flat Dark Earth
  aluTan: () => std({ color: 0x8f7a58, metalness: 0.25, roughness: 0.62, roughnessMap: wearMap(), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.3, 0.3) }),
  // Cerakote Oliv (Scharfschützengewehr-Schaft)
  aluOD: () => std({ color: 0x3f4630, metalness: 0.2, roughness: 0.66, roughnessMap: wearMap(), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.35, 0.35) }),
  polymer: () => std({ color: 0x1f2023, metalness: 0.0, roughness: 0.78, roughnessMap: wearMap(), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.12, 0.12) }),
  // FDE-Kunststoff (Schaft, Magazin): Grundton × Albedo-Fleckung ≈ #66553c im Mittel (sonnenbeschienen nicht grell)
  polymerTan: () => std({ color: 0x7f6b4d, map: polymerMap(), metalness: 0.0, roughness: 0.8, roughnessMap: wearMap(), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.16, 0.16) }),
  polymerOD: () => std({ color: 0x3f4630, metalness: 0.0, roughness: 0.8, roughnessMap: wearMap(), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.12, 0.12) }),
  polymerGrey: () => std({ color: 0x35383b, metalness: 0.0, roughness: 0.74, roughnessMap: wearMap(), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.12, 0.12) }),
  // Griffflächen mit Stippling
  grip: () => std({ color: 0x1c1d20, metalness: 0.0, roughness: 0.88, normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.45, 0.45) }),
  gripTan: () => std({ color: 0x75644a, metalness: 0.0, roughness: 0.9, normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.45, 0.45) }),
  rubber: () => std({ color: 0x18181a, metalness: 0.0, roughness: 0.9, normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.22, 0.22) }),
  woodWarm: () => std({ color: 0xffffff, map: woodMap('warm'), metalness: 0.0, roughness: 0.58, roughnessMap: wearMap(), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.2, 0.2) }),
  woodWalnut: () => std({ color: 0xffffff, map: woodMap('walnut'), metalness: 0.0, roughness: 0.42, roughnessMap: wearMap() }),
  // ZW-12 Zwilling (26.10.): Läufe tief brüniert und glänzender als die Basküle (IZH-43E), Schlossteile blank, Holz-Atlas
  zwBarrel: () => wearPatch(std({ color: 0x14161a, metalness: 0.72, roughness: 0.3, roughnessMap: fine(finishMaps('steel').rough, 3), normalMap: fine(finishMaps('steel').normal, 5), normalScale: new THREE.Vector2(0.06, 0.06) }), { ...STEEL_WEAR, bump: 0.00003 }),
  zwBlued: () => wearPatch(std({ color: 0x1c1e21, metalness: 0.62, roughness: 0.4, roughnessMap: fine(finishMaps('steel').rough, 2.5), normalMap: fine(finishMaps('steel').normal, 4), normalScale: new THREE.Vector2(0.1, 0.1) }), { ...STEEL_WEAR, bump: 0.00004 }),
  zwPolish: () => wearPatch(std({ color: 0x9a9ea4, metalness: 1.0, roughness: 0.26, roughnessMap: fine(brushedMap(), 10) }), { ...STEEL_WEAR, bump: 0.00002 }),
  zwWood: () => zwWoodMat(false), 'zwWood@lite': () => zwWoodMat(true),
  stainless: () => std({ color: 0x9da1a6, metalness: 1.0, roughness: 0.36, roughnessMap: brushedMap() }),
  brass: () => std({ color: 0xc09a45, metalness: 1.0, roughness: 0.3, roughnessMap: wearMap() }),
  copper: () => std({ color: 0xb8703f, metalness: 1.0, roughness: 0.32 }),
  // Goldakzente der Waffen der ersten Stunde (UR-1, P-0, Erstlicht): poliert, bleibt unter jeder Tarnung golden
  // Pistole nach Vorbild (P-9 ≈ Glock 17): nitrierter Schlitten mit Abrieb, seidenmatter Rahmenkunststoff, Laufhaube
  slideNitride: () => std({ color: 0x323336, metalness: 0.55, roughness: 0.4, roughnessMap: wearMap(), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.1, 0.1) }),
  polymerSatin: () => std({ color: 0x131416, metalness: 0.0, roughness: 0.62, normalMap: grainNormal(), normalScale: new THREE.Vector2(0.14, 0.14) }),
  // P-9 nach Foto (p9-tex.js): Nitrid-Schlitten mit Rillen/Gravur/Kratzern, Polymerrahmen mit Würfelraster und Rillen
  // Schlitten: satiniertes Nitrid – echtes Metall (Spiegelung der Umgebung), Glanz längs gezogen (Anisotropie entlang
  // der Atlas-U-Richtung = Schlittenlänge), blank geriebene Kanten aus dem Atlas (Rauheit/Albedo)
  p9Slide: () => p9SlideMat(false), 'p9Slide@lite': () => p9SlideMat(true),
  p9Frame: () => p9FrameMat(false), 'p9Frame@lite': () => p9FrameMat(true),
  // M-17 nach Foto: eloxiertes Gehäuse (matt, leichter Glanz), Schienen-Handschutz, phosphatierter Stahl (Lauf,
  // Kornträger), Polymer-Schaft/-Griff mit eigenem Atlas (m17-tex.js)
  // M-17 (Nutzer 13.10.2026: realistisch statt „knetig“): anthrazit eloxiert mit seidiger Klarschicht (spiegelt die
  // Umgebung weich), Phosphat-Stahl matt, Magazin grau beschichtet; alle mit Gebrauchsspuren (wearPatch).
  m17Mag: () => wearPatch(std({ color: 0x4a4d51, metalness: 0.4, roughness: 0.52, roughnessMap: fine(finishMaps('alu').rough, 2), normalMap: fine(finishMaps('alu').normal, 2.5), normalScale: new THREE.Vector2(0.18, 0.18) }), { col: 0xaeb2b7, metal: 1, rough: 0.26, k: 1.15 }),
  m17Rec: () => wearPatch(phys({ color: 0x2b2d30, metalness: 0.15, roughness: 0.64, clearcoat: 0.06, clearcoatRoughness: 0.3, roughnessMap: fine(finishMaps('alu').rough, 2), normalMap: fine(finishMaps('alu').normal, 2.5), normalScale: new THREE.Vector2(0.2, 0.2) }), ALU_WEAR),
  m17Ras: () => wearPatch(phys({ color: 0x292b2e, metalness: 0.15, roughness: 0.66, clearcoat: 0.05, clearcoatRoughness: 0.3, roughnessMap: fine(finishMaps('alu').rough, 2), normalMap: fine(finishMaps('alu').normal, 2.5), normalScale: new THREE.Vector2(0.2, 0.2) }), { ...ALU_WEAR, tone: 0.16 }),
  m17Steel: () => wearPatch(std({ color: 0x2b2c2d, metalness: 0.3, roughness: 0.64, roughnessMap: fine(finishMaps('steel').rough, 2.5), normalMap: fine(finishMaps('steel').normal, 4), normalScale: new THREE.Vector2(0.12, 0.12) }), { ...STEEL_WEAR, bump: 0.00004 }),
  // Verschlussgruppe (innen, keine Tarnung): manganphosphatiert, leicht geölt – matter Grund mit dünnem Ölglanz
  m17Bcg: () => wearPatch(phys({ color: 0x2c2d2e, metalness: 0.5, roughness: 0.55, clearcoat: 0.45, clearcoatRoughness: 0.22, roughnessMap: fine(finishMaps('steel').rough, 3), normalMap: fine(finishMaps('steel').normal, 5), normalScale: new THREE.Vector2(0.08, 0.08) }), { col: 0x9a9c9e, metal: 1, rough: 0.3, bump: 0.00003, tone: 0.06 }),
  m17RecV: () => DEFS.m17Rec(), m17RasV: () => DEFS.m17Ras(), m17SteelV: () => DEFS.m17Steel(), m17FurnV: () => DEFS.m17Furn(),
  m17Furn: () => m17FurnMat(false), 'm17Furn@lite': () => m17FurnMat(true),
  barrelNitride: () => std({ color: 0x38393c, metalness: 0.85, roughness: 0.42, roughnessMap: wearMap() }),
  // KV-47 nach Foto (25.10., Holz-Baukasten G1 in holz-tex.js): Lackholz + Pressstoffgriff (ein Atlas, Klarlack),
  // Gehäuse schwarz lackiert (Atlas mit Prägungen), brünierter Stahl (Lauf, Visier, Kleinteile), Magazin und Träger
  kv47Wood: () => kv47WoodMat(false), 'kv47Wood@lite': () => kv47WoodMat(true),
  kv47Rec: () => kv47RecMat(false), 'kv47Rec@lite': () => kv47RecMat(true),
  kv47Steel: () => wearPatch(std({ color: 0x252629, metalness: 0.5, roughness: 0.46, roughnessMap: fine(finishMaps('steel').rough, 2.5), normalMap: fine(finishMaps('steel').normal, 4), normalScale: new THREE.Vector2(0.14, 0.14) }), { col: 0x8a8e94, metal: 1, rough: 0.28, bump: 0.00005, tone: 0.1 }),
  // Magazin (Prüfung 25.10.: wirkte flach blaugrau): brünierter Stahl, fast schwarz, glänzend, Kanten/Rippen blank gerieben
  kv47Mag: () => wearPatch(std({ color: 0x41454b, metalness: 0.78, roughness: 0.3, roughnessMap: fine(finishMaps('steel').rough, 2), normalMap: fine(finishMaps('steel').normal, 3), normalScale: new THREE.Vector2(0.12, 0.12) }), { col: 0xb4b8be, metal: 1, rough: 0.2, k: 1.5, bump: 0.00006, tone: 0.14 }),
  kv47Bcg: () => wearPatch(phys({ color: 0x3a3c40, metalness: 0.72, roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.25, roughnessMap: fine(finishMaps('steel').rough, 3), normalMap: fine(finishMaps('steel').normal, 5), normalScale: new THREE.Vector2(0.08, 0.08) }), { col: 0xa4a7ab, metal: 1, rough: 0.22, bump: 0.00003, tone: 0.06 }),
  // QX-90 nach Foto (25.10., Polymer-Baukasten G12): Rahmen matter Spritzguss (Atlas), Lauf-/Visiergruppe schwarzer Guss
  // (Atlas, Kratzer, blanke Kanten), Ringvisier eloxiert, Kleinteile schwarzer Kunststoff, Schaftkappe gummiert, Stahl
  // (Lauf, Dämpfer, Spannhebelstangen, Schrauben) phosphatiert; Magazin Rauch-Polymer (durchscheinend, Patronen sichtbar)
  qx90Frame: () => qx90FrameMat(false), 'qx90Frame@lite': () => qx90FrameMat(true),
  qx90Upper: () => qx90UpperMat(false), 'qx90Upper@lite': () => qx90UpperMat(true),
  // Prüfung 25.10.: Optik im Foto so hell wie der Rahmen (0,97), im Modell halb so hell (0x18191b, metallisch) – matt
  // eloxiert, dunkelgrau
  qx90Optic: () => wearPatch(phys({ color: 0x3a3b3e, metalness: 0.18, roughness: 0.56, clearcoat: 0.05, clearcoatRoughness: 0.45, roughnessMap: fine(finishMaps('alu').rough, 2), normalMap: fine(finishMaps('alu').normal, 2.5), normalScale: new THREE.Vector2(0.1, 0.1) }), { ...ALU_WEAR, col: 0x8a8e93, k: 0.7 }),
  qx90Black: () => wearPatch(std({ color: 0x1c1d1f, metalness: 0.0, roughness: 0.62, normalMap: grainNormal(), normalScale: new THREE.Vector2(0.14, 0.14) }), POLY_WEAR),
  // Schaftkappe: im Foto glatt (gummiert, matt) mit feiner Fuge, Ton wie der Rahmen – vorher kräftig gestippelt und fast schwarz
  qx90Butt: () => wearPatch(std({ color: 0x3b3c3f, metalness: 0.0, roughness: 0.82, normalMap: grainNormal(), normalScale: new THREE.Vector2(0.07, 0.07) }), { ...POLY_WEAR, k: 0.35 }),
  // Stahl (Lauf, Dämpfer, Schrauben): Fotos glatt-matt phosphatiert, dunkelgrau – Prüfung 25.10.: wirkte genarbt
  qx90Steel: () => wearPatch(std({ color: 0x3e3f42, metalness: 0.6, roughness: 0.5, roughnessMap: fine(finishMaps('steel').rough, 2.5), normalMap: fine(finishMaps('steel').normal, 4), normalScale: new THREE.Vector2(0.04, 0.04) }), { col: 0xa3a6ab, metal: 1, rough: 0.28, bump: 0.00002, tone: 0.06 }),
  qx90Rod: () => wearPatch(std({ color: 0x67645f, metalness: 0.8, roughness: 0.4, roughnessMap: fine(finishMaps('steel').rough, 3), normalMap: fine(finishMaps('steel').normal, 4), normalScale: new THREE.Vector2(0.1, 0.1) }), { col: 0xb8b8b4, metal: 1, rough: 0.22, bump: 0.00004, tone: 0.1 }),
  // Rauch-Polymer (Fotos: dunkel rauchbraun, glänzend, Patronen nur gedämpft zu ahnen – Prüfung 25.10.: vorher hell und
  // glasig mit grellen Patronen): fast deckend, Patronen dahinter mit eigenem, abgedunkeltem Material (qx90Rounds)
  qx90Mag: () => solid(std({ color: 0x2c241d, metalness: 0.0, roughness: 0.46, transparent: true, opacity: 0.9, envMapIntensity: 0.22 })),
  qx90Rounds: () => std({ color: 0x4e4944, vertexColors: true, metalness: 0.55, roughness: 0.52, envMapIntensity: 0.35 }),
  qx90MagTick: () => std({ color: 0x8a7656, metalness: 0.0, roughness: 0.55 }),
  qx90MagCap: () => std({ color: 0x1b1c1e, metalness: 0.0, roughness: 0.55, normalMap: grainNormal(), normalScale: new THREE.Vector2(0.12, 0.12) }),
  // VP-9 nach Foto (24.10.): Gehäuse aus schwarz lackiertem Stahlblech (seidenmatt, an Kanten bis auf den Stahl
  // abgerieben – das Fotovorbild ist dort fast blank), Kleinteile/Lauf brüniert, Magazin schwarz phosphatiert, Verschluss
  // geölt; Kunststoffteile (Griffstück, Handschutz, Schulterstütze) mit eigenem Atlas (vp9-tex.js)
  // 25.10. (Prüfung: wirkte genarbt wie Guss, kaum von Kunststoff zu unterscheiden): Lack glatter – Korn der Normale ×0,4,
  // kaum Beulen, leichter Lackglanz (Klarschicht); der Kunststoff bleibt matt mit Strahlkorn aus dem Atlas
  vp9Rec: () => wearPatch(phys({ color: 0x2a2c2f, metalness: 0.28, roughness: 0.44, clearcoat: 0.32, clearcoatRoughness: 0.3, roughnessMap: fine(finishMaps('steel').rough, 2.5), normalMap: fine(finishMaps('steel').normal, 2), normalScale: new THREE.Vector2(0.04, 0.04) }), { col: 0x7d8186, metal: 1, rough: 0.34, bump: 0.000015, k: 1.1, tone: 0.08 }),
  vp9Steel: () => wearPatch(std({ color: 0x232426, metalness: 0.55, roughness: 0.5, roughnessMap: fine(finishMaps('steel').rough, 3), normalMap: fine(finishMaps('steel').normal, 4), normalScale: new THREE.Vector2(0.1, 0.1) }), { ...STEEL_WEAR, bump: 0.00004 }),
  vp9Mag: () => wearPatch(std({ color: 0x202123, metalness: 0.5, roughness: 0.46, roughnessMap: fine(finishMaps('steel').rough, 2.5), normalMap: fine(finishMaps('steel').normal, 3), normalScale: new THREE.Vector2(0.1, 0.1) }), { col: 0x8a8d91, metal: 1, rough: 0.3, k: 0.85 }),
  vp9Bcg: () => wearPatch(phys({ color: 0x2e2f31, metalness: 0.7, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.2, roughnessMap: fine(finishMaps('steel').rough, 3), normalMap: fine(finishMaps('steel').normal, 5), normalScale: new THREE.Vector2(0.08, 0.08) }), { col: 0xa0a3a6, metal: 1, rough: 0.25, bump: 0.00003, tone: 0.06 }),
  vp9Furn: () => vp9FurnMat('max'), vp9FurnS: () => vp9FurnMat('std'), 'vp9Furn@lite': () => vp9FurnMat('lite'),
  // Adler .50 nach Foto (25.10.): Edelstahl mit eigenem Atlas (adler-tex.js – Schlitten gebürstet, Lauf poliert, Rahmen gestrahlt,
  // Rillen/Gravuren/Abrieb), Wickelgriff aus demselben Atlas (Kunststoff), Kleinteile poliert, Kimme/Korn brüniert
  adlerSteel: () => adlerMat('max', true), adlerSteelS: () => adlerMat('std', true), 'adlerSteel@lite': () => adlerMat('lite', true),
  adlerGrip: () => adlerMat('max', false), adlerGripS: () => adlerMat('std', false), 'adlerGrip@lite': () => adlerMat('lite', false),
  // Kleinteile ohne eigene Detailkarten (25.10., Bauzeit): Strich/Abrieb aus den geteilten Karten, die das Modell ohnehin lädt
  // P-9A (Glock 18C, 26.10.): Nitrid-Schlitten und Polymerrahmen teilen einen Atlas (p9a-tex.js) – je Stufe (…S = PC niedrig/mittel)
  p9aSlide: () => p9aMat('max', true), p9aSlideS: () => p9aMat('std', true), 'p9aSlide@lite': () => p9aMat('lite', true),
  p9aFrame: () => p9aMat('max', false), p9aFrameS: () => p9aMat('std', false), 'p9aFrame@lite': () => p9aMat('lite', false),
  // PS-41 Wirbel (PPSch-41, 26.10.): Birkenschaft mit Atlas (wirbel-tex.js), brünierter Stahl mit blanken Kanten (Foto: stark
  // abgegriffen, an Mantel und Gehäuse fast blank), Laufmantel mit Durchlässigkeitskarte (Schlitze), Trommel heller gebläut,
  // Verschluss geölt blank
  wirbelWood: () => wirbelWoodMat(false), 'wirbelWood@lite': () => wirbelWoodMat(true),
  wirbelSteel: () => wearPatch(std({ color: 0x323438, metalness: 0.62, roughness: 0.42, roughnessMap: fine(finishMaps('steel').rough, 2.5), normalMap: fine(finishMaps('steel').normal, 4), normalScale: new THREE.Vector2(0.12, 0.12) }), WIRBEL_WEAR),
  wirbelMantel: () => wirbelMantelMat(false), 'wirbelMantel@lite': () => wirbelMantelMat(true),
  wirbelDrum: () => wearPatch(std({ color: 0x55585d, metalness: 0.78, roughness: 0.32, roughnessMap: fine(finishMaps('steel').rough, 2), normalMap: fine(finishMaps('steel').normal, 3), normalScale: new THREE.Vector2(0.1, 0.1) }), { ...WIRBEL_WEAR, k: 1.2 }),
  wirbelBolt: () => wearPatch(phys({ color: 0x55575b, metalness: 0.85, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.25, roughnessMap: fine(finishMaps('steel').rough, 3), normalMap: fine(finishMaps('steel').normal, 5), normalScale: new THREE.Vector2(0.08, 0.08) }), { col: 0xb0b2b6, metal: 1, rough: 0.2 }),
  adlerPolish: () => wearPatch(std({ color: 0xc6cacf, metalness: 1.0, roughness: 0.2, roughnessMap: fine(brushedMap(), 12) }), STAINLESS_WEAR),
  adlerBlued: () => wearPatch(std({ color: 0x1d1e20, metalness: 0.6, roughness: 0.42, roughnessMap: fine(wearMap(), 6) }), { ...STEEL_WEAR, bump: 0.00003 }),
  // Trommelmagazin: eigener Kunststoff (keine Tarnung) und Deckel mit eigener Textur
  drumBody: () => std({ color: 0x2a2c30, map: polymerMap(), metalness: 0.0, roughness: 0.66, normalMap: grainNormal(), normalScale: new THREE.Vector2(0.2, 0.2) }),
  drumFace: () => std({ color: 0xffffff, map: drumFaceMap(), normalMap: drumFaceNormal(), normalScale: new THREE.Vector2(0.9, 0.9), metalness: 0.0, roughness: 0.62 }),
  goldTrim: () => std({ color: 0xe9b949, metalness: 1.0, roughness: 0.16, envMapIntensity: 1.5 }),
  shellRed: () => std({ color: 0x8f1f17, metalness: 0.0, roughness: 0.5, roughnessMap: wearMap() }),
  knurl: () => std({ color: 0x2c2d31, metalness: 0.7, roughness: 0.5, normalMap: knurlNormal(), normalScale: new THREE.Vector2(1, 1) }),
  // Optik-Linse: dunkel, stark spiegelnd, bläulich vergütet
  lens: () => std({ color: 0x0c1b22, metalness: 1.0, roughness: 0.04, envMapIntensity: 1.6, emissive: 0x06141c, emissiveIntensity: 1 }),
  // Durchsichtige Optiklinse (Rotpunkt/ACOG): leicht bläulich vergütet, spiegelt die Umgebung
  lensClear: () => std({ color: 0x8fb8d8, metalness: 0.6, roughness: 0.04, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.8 }),
  // Holo-Fenster: leicht getöntes Glas
  glass: () => std({ color: 0x9fd8d0, metalness: 0.4, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false, envMapIntensity: 1.4 }),
  // Molotow (13.11.): braungrünes Flaschenglas, Benzingemisch darin, Stofflappen im Hals
  bottleGlass: () => std({ color: 0x5f7a4a, metalness: 0.1, roughness: 0.06, transparent: true, opacity: 0.42, depthWrite: false, envMapIntensity: 1.6 }),
  fuel: () => std({ color: 0xb98a2e, metalness: 0.0, roughness: 0.15, transparent: true, opacity: 0.7, envMapIntensity: 1.0 }),
  rag: () => std({ color: 0xb8ad94, metalness: 0.0, roughness: 0.98, normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.9, 0.9) }),
  ragSoot: () => std({ color: 0x3a3430, metalness: 0.0, roughness: 1.0, normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.9, 0.9) }),
  leather: () => std({ color: 0x5a3a22, metalness: 0.0, roughness: 0.62, normalMap: grainNormal(), normalScale: new THREE.Vector2(0.35, 0.35) }),
  // Transluzentes Rauchglas/-Magazin (OG-Gewehr, Molotow-Flasche; die QX-90 hat seit 25.10. ihr eigenes qx90Mag)
  smoke: () => std({ color: 0x3c4a50, metalness: 0.1, roughness: 0.18, transparent: true, opacity: 0.62, envMapIntensity: 1.2 }),
  // Durchscheinende Polymermagazine (Rauch, Wüstenbraun, Grau wie Lancer/UMP/AUG): Patronen + Zubringer innen
  // sichtbar (magfill.js). userData.solid: zählt für den Handkontakt (contact.js) wie ein festes Teil;
  // Bot-Detailstufe: undurchsichtige Ersatzfarbe (LOD_COLORS)
  smokeTan: () => solid(std({ color: 0x9a7f55, metalness: 0.05, roughness: 0.3, transparent: true, opacity: 0.58, envMapIntensity: 1.1 })),
  smokeGrey: () => solid(std({ color: 0x5c6266, metalness: 0.05, roughness: 0.26, transparent: true, opacity: 0.52, envMapIntensity: 1.1 })),
  smokeDark: () => solid(std({ color: 0x2f363b, metalness: 0.08, roughness: 0.24, transparent: true, opacity: 0.6, envMapIntensity: 1.2 })),
  // Patronen im Magazin (InstancedMesh, Vertex-Farben Messing/Tombak bzw. rote Schrothülse) und Zubringer
  rounds: () => std({ color: 0xffffff, vertexColors: true, metalness: 0.95, roughness: 0.3 }),
  roundsShell: () => std({ color: 0xffffff, vertexColors: true, metalness: 0.35, roughness: 0.48 }),
  follower: () => std({ color: 0x8a4a22, metalness: 0.0, roughness: 0.6 }),
  paintWhite: () => std({ color: 0xdedbd2, metalness: 0.0, roughness: 0.6 }),
  paintOlive: () => std({ color: 0x505733, metalness: 0.25, roughness: 0.62, roughnessMap: wearMap(), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.35, 0.35) }),
  paintYellow: () => std({ color: 0xc9a52b, metalness: 0.1, roughness: 0.55 }),
  paintSignal: () => std({ color: 0xff5b1f, metalness: 0.0, roughness: 0.5 }),
  putty: () => std({ color: 0x6f6448, metalness: 0.0, roughness: 0.95, normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.6, 0.6) }),
  blade: () => std({ color: 0x9a9ea3, metalness: 1.0, roughness: 0.22, roughnessMap: brushedMap() }),
  bladeCoat: () => std({ color: 0x2a2b2d, metalness: 0.55, roughness: 0.5, roughnessMap: wearMap() }),
  // Stoffhülle (Schutzplatte, Taschen): Oliv, grob
  canvasOD: () => std({ color: 0x4a4f36, metalness: 0.0, roughness: 0.95, normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.5, 0.5) }),
  cord: () => std({ color: 0x3b3f2e, metalness: 0.0, roughness: 0.95, normalMap: knurlNormal(), normalScale: new THREE.Vector2(0.8, 0.8) }),
  // Leere/Innenraum (Auswurföffnung, Laufbohrung)
  cavity: () => new THREE.MeshBasicMaterial({ color: 0x050505 }),
  // Laufkrone: blank gedrehte Fase um die Bohrung (fängt Spiegelungen, macht das Loch sichtbar)
  crown: () => std({ color: 0xa9adb2, metalness: 1.0, roughness: 0.2, side: THREE.DoubleSide }),
  // Selbstleuchtend (bloom-freundlich, kein Tonemapping)
  glowRed: () => new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.35, 0.15), toneMapped: false }),
  glowGreen: () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3.2, 0.5), toneMapped: false }),
  glowAmber: () => new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 1.4, 0.3), toneMapped: false }),
  // Absehen
  reticleHolo: () => new THREE.MeshBasicMaterial({ map: reticleMap('holo', reticleSize), color: new THREE.Color(3.2, 0.55, 0.25), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  reticleDot: () => new THREE.MeshBasicMaterial({ map: reticleMap('dot', reticleSize), color: new THREE.Color(3.5, 0.3, 0.15), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  reticleChevron: () => new THREE.MeshBasicMaterial({ map: reticleMap('chevron'), color: new THREE.Color(3.4, 0.7, 0.15), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  // Bot-Detailstufe: zwei Sammelmaterialien mit Vertex-Farben (ein Draw Call je Gruppe)
  lodMetal: () => std({ color: 0xffffff, vertexColors: true, metalness: 0.75, roughness: 0.45, roughnessMap: wearMap() }),
  lodMatte: () => std({ color: 0xffffff, vertexColors: true, metalness: 0.0, roughness: 0.72, roughnessMap: wearMap() }),
};

// Atlas-Materialien nach Foto (24.10., Vorarbeit V4): je Stufe eigener Atlas – am Handy (Builder b.lite) die Fassung
// key@lite mit halber Kantenlänge (¼ Speicher); texKey = Eintrag im Textur-Cache, den freeAtlasMaterials freigibt
function p9SlideMat(lite) { const t = p9SlideMaps(lite); const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t.map, metalness: 0.78, roughness: 1.0, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1), envMapIntensity: 1.1 }); m.userData.camoRepeat = SLIDE_CAMO_REPEAT; m.userData.texKey = t.key; return wearPatch(m, { col: 0x9a9c9f, metal: 1, rough: 0.28 }); }
function p9FrameMat(lite) { const t = p9FrameMaps(lite); const m = std({ color: 0x232427, map: t.map, metalness: 0.0, roughness: 1.0, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1) }); m.userData.camoRepeat = FRAME_CAMO_REPEAT; m.userData.texKey = t.key; return wearPatch(m, POLY_WEAR); }
// Lackholz: Klarlack-Schicht (spiegelt weich), Abrieb heller und matt; Gehäuse: schwarzer Lack, an Kanten Stahl blank.
// Prüfung 25.10.: Holz-Abrieb schwächer (k 0,35) – im Foto keine hellen Ringe an den Handschutz-Enden, Lack weniger glänzend;
// Grundglanz unter dem Lack schwach (specularIntensity 0,4), sonst liegt ein rosa Schleier über dem Holz (Foto: dunkle Zonen satt)
function kv47WoodMat(lite) { const t = kv47WoodMaps(lite); const m = phys({ color: 0xffffff, map: t.map, metalness: 0.0, roughness: t.roughnessMap ? 1.0 : t.roughness, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1), clearcoat: 0.2, clearcoatRoughness: 0.34, specularIntensity: 0.4 }); m.userData.camoRepeat = WOOD_CAMO_REPEAT; m.userData.texKey = t.key; return wearPatch(m, { col: 0xb07850, metal: 0, rough: 0.62, k: 0.35, bump: 0.00005, tone: 0.06, smear: 0.2 }); }
// PS-41 Wirbel: Abrieb kräftig und fleckig (Kriegsfertigung, lange benutzt), Lackholz wie KV-47 mit etwas mehr Glanz
const WIRBEL_WEAR = { col: 0x9a948d, metal: 1, rough: 0.3, k: 1.4, bump: 0.00006, tone: 0.12, smear: 0.3 };
function wirbelWoodMat(lite) { const t = wirbelWoodMaps(lite); const m = phys({ color: 0xffffff, map: t.map, metalness: 0.0, roughness: t.roughnessMap ? 1.0 : t.roughness, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1), clearcoat: 0.25, clearcoatRoughness: 0.32, specularIntensity: 0.4 }); m.userData.camoRepeat = WIRBEL_WOOD_REPEAT; m.userData.texKey = t.key; return wearPatch(m, { col: 0xa8704a, metal: 0, rough: 0.62, k: 0.45, bump: 0.00005, tone: 0.06, smear: 0.2 }); }
// Mantel: Rohr mit Ausschnitten über alphaMap/alphaTest (wirbel-tex.js); Innenfläche als eigene Fläche im Bauplan
function wirbelMantelMat(lite) { const t = wirbelMantelAlpha(lite); const m = std({ color: 0x323438, metalness: 0.62, roughness: 0.42, alphaMap: t.map, alphaTest: 0.5, roughnessMap: fine(finishMaps('steel').rough, 2.5), normalMap: fine(finishMaps('steel').normal, 4), normalScale: new THREE.Vector2(0.12, 0.12) }); m.userData.camoRepeat = WIRBEL_MANTEL_REPEAT; m.userData.texKey = t.key; return wearPatch(m, WIRBEL_WEAR); }
function kv47RecMat(lite) { const t = kv47RecMaps(lite); const m = phys({ color: 0xffffff, map: t.map, metalness: 0.35, roughness: t.roughnessMap ? 1.0 : t.roughness, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1), clearcoat: 0.18, clearcoatRoughness: 0.4 }); m.userData.camoRepeat = REC_CAMO_REPEAT; m.userData.texKey = t.key; return wearPatch(m, { col: 0x8c8f94, metal: 1, rough: 0.3, bump: 0.00006, tone: 0.08 }); }
// QX-90: Spritzguss matt (Rauheit aus dem Atlas, Handy konstant), Guss metallisch-schwarz mit blanken Kanten
function qx90FrameMat(lite) { const t = qx90FrameMaps(lite); const m = std({ color: 0xffffff, map: t.map, metalness: 0.0, roughness: t.roughnessMap ? 1.0 : t.roughness, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1) }); m.userData.camoRepeat = QX_FRAME_REPEAT; m.userData.texKey = t.key; return wearPatch(m, { col: 0x4a4c50, metal: 0, rough: 0.42, k: 0.75, bump: 0.00005, tone: 0.06, smear: 0.25 }); }
// Guss (Prüfung 25.10.): weniger metallisch (0,5 → 0,25) – im Foto satinierter Lack, fast so hell wie der Rahmen
function qx90UpperMat(lite) { const t = qx90UpperMaps(lite); const m = std({ color: 0xffffff, map: t.map, metalness: 0.25, roughness: t.roughnessMap ? 1.0 : t.roughness, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1) }); m.userData.camoRepeat = QX_UPPER_REPEAT; m.userData.texKey = t.key; return wearPatch(m, { col: 0x9a9da2, metal: 1, rough: 0.3, bump: 0.00004, tone: 0.08 }); }
function m17FurnMat(lite) { const t = m17FurnMaps(lite); const m = std({ color: 0x26272a, map: t.map, metalness: 0.0, roughness: 1.0, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1) }); m.userData.camoRepeat = FURN_CAMO_REPEAT; m.userData.texKey = t.key; return wearPatch(m, POLY_WEAR); }
// Handy: Atlas ohne Rauheitskarte (§8.3) – mittlere Rauheit des Kunststoffs als Konstante
// Adler: Stahl und Griff teilen den Atlas (gleicher texKey); Handy ohne Rauheitskarte (Rauheit konstant)
function adlerMat(tier, steel) { const t = adlerMaps(tier); const m = std({ color: 0xffffff, map: t.map, metalness: steel ? 1.0 : 0.0, roughness: t.roughnessMap ? 1.0 : steel ? 0.26 : 0.8, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1) }); m.userData.camoRepeat = ADLER_CAMO_REPEAT; m.userData.texKey = t.key; return wearPatch(m, steel ? STAINLESS_WEAR : POLY_WEAR); }
// P-9A: Schlitten wie P-9 (Nitrid, metallisch), Rahmen wie P-9 (Polymer, Atlas hell × Materialfarbe); Handy ohne Rauheitskarte
function p9aMat(tier, slide) {
  const t = p9aMaps(tier), rough = t.roughnessMap;
  const m = slide ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t.map, metalness: 0.78, roughness: rough ? 1.0 : 0.46, roughnessMap: rough, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1), envMapIntensity: 1.1 })
    : std({ color: 0x232427, map: t.map, metalness: 0.0, roughness: rough ? 1.0 : 0.5, roughnessMap: rough, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1) });
  m.userData.camoRepeat = P9A_CAMO_REPEAT; m.userData.texKey = t.key;
  return wearPatch(m, slide ? { col: 0x9a9c9f, metal: 1, rough: 0.28 } : POLY_WEAR);
}
function vp9FurnMat(tier) { const t = vp9FurnMaps(tier); const m = std({ color: 0xffffff, map: t.map, metalness: 0.0, roughness: t.roughnessMap ? 1.0 : 0.8, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1) }); m.userData.camoRepeat = VP9_CAMO_REPEAT; m.userData.texKey = t.key; return wearPatch(m, POLY_WEAR); }
// Schlüssel mit eigener Handy-Fassung (key@lite) und Atlas-Materialien (je Waffe freigebbar)
const LITE = new Set(['m17Furn', 'p9Slide', 'p9Frame', 'kv47Wood', 'kv47Rec', 'vp9Furn', 'qx90Frame', 'qx90Upper', 'adlerSteel', 'adlerGrip', 'p9aSlide', 'p9aFrame', 'wirbelWood', 'wirbelMantel']);
const ATLAS = new Set(['m17Furn', 'm17Furn@lite', 'p9Slide', 'p9Slide@lite', 'p9Frame', 'p9Frame@lite', 'kv47Wood', 'kv47Wood@lite', 'kv47Rec', 'kv47Rec@lite',
  'vp9Furn', 'vp9FurnS', 'vp9Furn@lite', 'qx90Frame', 'qx90Frame@lite', 'qx90Upper', 'qx90Upper@lite',
  'adlerSteel', 'adlerSteelS', 'adlerSteel@lite', 'adlerGrip', 'adlerGripS', 'adlerGrip@lite',
  'p9aSlide', 'p9aSlideS', 'p9aSlide@lite', 'p9aFrame', 'p9aFrameS', 'p9aFrame@lite',
  'wirbelWood', 'wirbelWood@lite', 'wirbelMantel', 'wirbelMantel@lite']);
/** Materialschlüssel für die Handy-Stufe (eigener, kleinerer Atlas), sonst der Schlüssel selbst. */
export function liteKey(key) { return LITE.has(key) ? key + '@lite' : key; }

// Ersatzfarben (sRGB) für texturierte Materialien in der Bot-Detailstufe
const LOD_COLORS = { woodWarm: 0x6a3a22, woodWalnut: 0x4a2d1c, polymerTan: 0x66553c, smokeTan: 0x6e5a3e, smokeGrey: 0x45494c, smokeDark: 0x25292c };
// Bot-Detailstufe ohne Erzeugung der (texturierten) Waffenmaterialien (24.10., V4: Bots ohne Atlas/Texturen – vorher
// legte schon der erste Bot mit M-17 deren Materialien samt Oberflächenkarten an, ≈ 0,2 s): Farbe wie material.color,
// Metall-Gruppe wie metalness ≥ 0,5
const LOD_META = { m17Rec: [0x2b2d30, 0], m17Ras: [0x292b2e, 0], m17Steel: [0x2b2c2d, 0], m17Mag: [0x4a4d51, 0], m17Bcg: [0x2c2d2e, 1],
  m17Furn: [0x26272a, 0], p9Slide: [0x5c5e62, 1], p9Frame: [0x232427, 0],
  kv47Wood: [0x4e1f0c, 0], kv47Rec: [0x222325, 0], kv47Steel: [0x252629, 1], kv47Mag: [0x33363b, 1], kv47Bcg: [0x3a3c40, 1],
  qx90Frame: [0x3a3b3e, 0], qx90Upper: [0x343538, 0], qx90Mag: [0x2c241d, 0], qx90Rod: [0x67645f, 1],
  // QX-90 Bots: Farben direkt (sonst baute die Bot-Stufe Alu-/Stahl-/Stippel-Kacheln nur zum Farbablesen, ≈ 130 ms)
  qx90Optic: [0x3a3b3e, 0], qx90Butt: [0x3b3c3f, 0], qx90Steel: [0x3e3f42, 1], qx90MagCap: [0x1b1c1e, 0], qx90Black: [0x1c1d1f, 0],
  qx90MagTick: [0x8a7656, 0],
  vp9Rec: [0x2a2c2f, 0], vp9Steel: [0x232426, 1], vp9Mag: [0x202123, 1], vp9Bcg: [0x2e2f31, 1], vp9Furn: [0x26272a, 0], vp9FurnS: [0x26272a, 0],
  adlerSteel: [0xb9bdc1, 1], adlerSteelS: [0xb9bdc1, 1], adlerGrip: [0x1c1d1f, 0], adlerGripS: [0x1c1d1f, 0], adlerPolish: [0xc6cacf, 1], adlerBlued: [0x1d1e20, 1],
  p9aSlide: [0x5c5e62, 1], p9aSlideS: [0x5c5e62, 1], p9aFrame: [0x232427, 0], p9aFrameS: [0x232427, 0],
  wirbelWood: [0x52230f, 0], wirbelSteel: [0x323438, 1], wirbelMantel: [0x323438, 1], wirbelDrum: [0x55585d, 1], wirbelBolt: [0x55575b, 1] };
const _lodCol = new Map();
/** Farbe (linear) + Metall-Gruppe eines Materials für die zusammengeführte Bot-Detailstufe. */
// ZW-12 Zwilling (26.10.): Holz-Atlas wie KV-47 (Lack/Öl-Klarschicht), Handy ohne Rauheitskarte; Bots ohne Atlas
function zwWoodMat(lite) { const t = zwWoodMaps(lite); const m = phys({ color: 0xffffff, map: t.map, metalness: 0.0, roughness: t.roughnessMap ? 1.0 : t.roughness, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1), clearcoat: 0.3, clearcoatRoughness: 0.3, specularIntensity: 0.4 }); m.userData.camoRepeat = ZW_WOOD_REPEAT; m.userData.texKey = t.key; return wearPatch(m, { col: 0xa06a40, metal: 0, rough: 0.6, k: 0.35, bump: 0.00005, tone: 0.06, smear: 0.2 }); }
LITE.add('zwWood'); for (const k of ['zwWood', 'zwWood@lite']) ATLAS.add(k);
Object.assign(LOD_META, { zwWood: [0x4a1f0b, 0], zwBarrel: [0x14161a, 1], zwBlued: [0x1c1e21, 1], zwPolish: [0x9a9ea4, 1] });
export function lodInfo(key) {
  let r = _lodCol.get(key);
  if (!r && LOD_META[key]) { r = { color: new THREE.Color(LOD_META[key][0]), metal: !!LOD_META[key][1] }; _lodCol.set(key, r); }
  if (!r) {
    if (ATLAS.has(key)) {   // nie einen Atlas für Bots erzeugen: neutrale Ersatzfarbe, Hinweis für den Bauplan
      console.warn(`[gunsmith] Atlas-Material ${key} in der Bot-Stufe – LOD_META ergänzen`);
      r = { color: new THREE.Color(0x333333), metal: false }; _lodCol.set(key, r); return r;
    }
    const m = getMat(key);
    const color = LOD_COLORS[key] !== undefined ? new THREE.Color(LOD_COLORS[key]) : (m.color ? m.color.clone() : new THREE.Color(0x333333));
    r = { color, metal: (m.metalness ?? 0) >= 0.5 };
    _lodCol.set(key, r);
  }
  return r;
}

// Materialien, die in der Bot-Detailstufe entfallen (Durchsicht, Leuchten, Hohlräume)
export const LOD_SKIP = new Set(['cavity', 'glass', 'lens', 'lensClear', 'lensEye', 'smoke', 'reticleHolo', 'reticleDot', 'reticleChevron', 'glowRed', 'glowGreen', 'glowAmber']);

export function getMat(key) {
  let m = mats.get(key);
  if (!m) {
    const make = DEFS[key];
    if (!make) throw new Error(`Unbekanntes Waffenmaterial: ${key}`);
    m = vmLight(make());
    m.name = 'gs:' + key;
    mats.set(key, m);
  }
  return m;
}

export function materialKeys() { return Object.keys(DEFS); }

// Leuchtpunkt-Größe (Einstellung reticleSize): gilt für alle Leuchtpunkt- und Holo-Visiere, auch schon gebaute
let reticleSize = 1;
export function setReticleSize(s) {
  s = Number.isFinite(s) ? Math.min(2.5, Math.max(0.4, s)) : 1;
  if (s === reticleSize) return;
  reticleSize = s;
  for (const [key, type] of [['reticleHolo', 'holo'], ['reticleDot', 'dot']]) {
    const m = mats.get(key);
    if (m) { m.map = reticleMap(type, s); m.needsUpdate = true; }
  }
}

/**
 * Material nachträglich anmelden (z. B. Schriftzüge einzelner Waffen); vorhandene Schlüssel bleiben unverändert.
 * o.lite: eigene Handy-Fassung (key@lite), o.atlas: Atlas-Material (je Waffe freigebbar, nie in der Bot-Stufe).
 */
export function defineMat(key, make, o = {}) {
  if (!DEFS[key]) DEFS[key] = make;
  if (o.lite && !DEFS[key + '@lite']) { DEFS[key + '@lite'] = o.lite; LITE.add(key); }
  if (o.atlas) { ATLAS.add(key); if (o.lite) ATLAS.add(key + '@lite'); }
}

/**
 * Freigabe je Waffe (24.10., V4): Atlas-Materialien, die keine Vorlage mehr benutzt (used = Menge der Schlüssel),
 * samt Texturen freigeben; der Atlas entsteht bei Bedarf neu. Liefert die freigegebenen Schlüssel (Tarnklone dazu
 * gibt camos.js frei).
 */
export function freeAtlasMaterials(used) {
  const freed = [];
  for (const [key, m] of [...mats]) {
    if (!ATLAS.has(key) || used.has(key)) continue;
    mats.delete(key);
    freed.push(key);
    // Texturen: der letzte Nutzer eines Cache-Eintrags gibt ihn ganz frei (dropCached), sonst nur die eigenen Karten
    // (z. B. Schrift PC ↔ Handy); Karten, die ein verbleibendes Material mitbenutzt, bleiben
    const tk = m.userData.texKey, MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap'];
    if (tk && ![...mats.values()].some((o) => o.userData.texKey === tk)) dropCached(tk);
    else {
      const inUse = new Set();
      for (const o of mats.values()) for (const p of MAPS) if (o[p]) inUse.add(o[p]);
      for (const p of MAPS) if (m[p] && !inUse.has(m[p])) m[p].dispose();
    }
    m.dispose();
  }
  return freed;
}

// Vorrat für Instanz-Materialien des Viewmodels (Arme, Mündungsfeuer, Rauch, Hülsen). Beim Matchende werden sie
// hier geparkt statt entsorgt: dispose() gäbe ihre Shaderprogramme frei, und das nächste Match müsste jedes neu
// kompilieren und linken (auf Telefonen Hunderte ms). Ein Eintrag ist ein Material oder ein Objekt aus Materialien;
// Instanzzustand (Deckkraft, Textur) setzt der neue Besitzer beim Holen selbst.
const spare = new Map();

/** Material(-satz) unter `key` aus dem Vorrat holen, sonst mit make() neu anlegen. */
export function takeMaterials(key, make) {
  const list = spare.get(key);
  return list && list.length ? list.pop() : make();
}

/** Material(-satz) zurück in den Vorrat legen (ersetzt dispose(); endgültig frei erst mit disposeMaterials()). */
export function parkMaterials(key, set) {
  if (!set) return;
  let list = spare.get(key);
  if (!list) spare.set(key, (list = []));
  if (!list.includes(set)) list.push(set);
}

function disposeSet(set) {
  if (set.isMaterial) set.dispose();
  else for (const m of Object.values(set)) if (m && m.isMaterial) m.dispose();
}

export function disposeMaterials() {
  for (const m of mats.values()) m.dispose();
  mats.clear();
  for (const list of spare.values()) list.forEach(disposeSet);
  spare.clear();
}

// ---------------------------------------------------------------- Waffen nach Vorbild, Gruppe B (13.11.): KM-7 Wespe (Vector),
// SM-45 Keiler (UMP45), LM-8 Bär (RPK), HM-60 Hammer (M60), RG-6 Orkan (M134). Gemeinsame Oberflächen mit Gebrauchsspuren
// (wearPatch: Kantenabrieb, Schmutz in Kehlen, Griffspuren, Mikrowellen), Mikrokorn/Kratzer aus finishMaps.
const GB_STEEL = (n = 2.5) => ({ roughnessMap: fine(finishMaps('steel').rough, n), normalMap: fine(finishMaps('steel').normal, n * 1.6), normalScale: new THREE.Vector2(0.09, 0.09) });
const GB_POLY = (n = 2) => ({ roughnessMap: fine(finishMaps('alu').rough, n), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.06, 0.06) });
const GB_POLY_WEAR = { ...POLY_WEAR, bump: 0.00002 };
Object.assign(DEFS, {
  // Glasfaserverstärktes Polymer (Vector, UMP, M60-Schaft): seidenmatt, leicht körnig
  gbPoly: () => wearPatch(std({ color: 0x212225, metalness: 0.0, roughness: 0.66, ...GB_POLY(2) }), GB_POLY_WEAR),
  gbPolyGrey: () => wearPatch(std({ color: 0x2b2d2f, metalness: 0.0, roughness: 0.72, ...GB_POLY(2.5) }), GB_POLY_WEAR),
  // Griffflächen mit Struktur (Stippling/Riffelung)
  gbGrip: () => wearPatch(std({ color: 0x1b1c1e, metalness: 0.0, roughness: 0.86, normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.5, 0.5) }), { ...POLY_WEAR, k: 0.5 }),
  // Phosphatierter Stahl (Gehäuse M60/RPK, Schienen), brünierter Lauf, blanker Verschluss
  gbSteel: () => wearPatch(std({ color: 0x2c2d30, metalness: 0.55, roughness: 0.5, ...GB_STEEL(2.5) }), STEEL_WEAR),
  gbBlued: () => wearPatch(std({ color: 0x1b1c1f, metalness: 0.7, roughness: 0.38, ...GB_STEEL(3) }), { ...STEEL_WEAR, bump: 0.00004 }),
  gbBolt: () => wearPatch(phys({ color: 0x6d7075, metalness: 0.9, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.25, ...GB_STEEL(3) }), { ...STEEL_WEAR, bump: 0.00002 }),
  // Lauf nach Dauerfeuer: dunkel angelaufen (Minigun-Läufe, M60-Lauf)
  gbBarrel: () => wearPatch(std({ color: 0x232325, metalness: 0.72, roughness: 0.42, ...GB_STEEL(4) }), { ...STEEL_WEAR, col: 0x6a6c70, bump: 0.00003 }),
  // Schwarz eloxiertes Aluminium (Vector-Oberteil, Minigun-Gehäuse)
  gbAlu: () => wearPatch(phys({ color: 0x232427, metalness: 0.35, roughness: 0.5, clearcoat: 0.08, clearcoatRoughness: 0.4, roughnessMap: fine(finishMaps('alu').rough, 2), normalMap: fine(finishMaps('alu').normal, 3), normalScale: new THREE.Vector2(0.08, 0.08) }), ALU_WEAR),
  // Schichtholz (RPK, Pflaume-Lack) – Kacheln, Lack glänzt, Kanten hell abgegriffen
  gbWood: () => wearPatch(phys({ color: 0x9c7062, map: woodMap('warm'), metalness: 0.0, roughness: 0.46, clearcoat: 0.3, clearcoatRoughness: 0.35, roughnessMap: wearMap(), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.12, 0.12) }), { col: 0x8a5a3c, metal: 0, rough: 0.7, k: 0.6, bump: 0.00004, tone: 0.1, smear: 0.2 }),
  // Oliv lackierter Stahl (Munitionskasten), Bakelit-Braun (RPK-Griff, Magazin AK-Stil)
  gbOlive: () => wearPatch(std({ color: 0x4b5232, metalness: 0.3, roughness: 0.62, ...GB_STEEL(2) }), { col: 0x7d7f78, metal: 1, rough: 0.35, k: 0.8, bump: 0.00006, tone: 0.1, smear: 0.25 }),
  gbBakelite: () => wearPatch(phys({ color: 0x5a2a17, metalness: 0.0, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.3, ...GB_POLY(2) }), { col: 0x8a4a2a, metal: 0, rough: 0.5, k: 0.6, bump: 0.00004, tone: 0.12, smear: 0.2 }),
});
Object.assign(LOD_META, {
  gbPoly: [0x212225, 0], gbPolyGrey: [0x2b2d2f, 0], gbGrip: [0x1b1c1e, 0], gbSteel: [0x2c2d30, 1], gbBlued: [0x1b1c1f, 1], gbBolt: [0x6d7075, 1],
  gbBarrel: [0x232325, 1], gbAlu: [0x232427, 0], gbWood: [0x6a3422, 0], gbOlive: [0x4b5232, 0], gbBakelite: [0x5a2a17, 0],
});

// ---------------------------------------------------------------- Waffen nach Vorbild, Gruppe A (13.11.): K-36 Kurzer (G36C),
// BX-20 Stier (AUG A3), G-7 Wächter (G3A3), SK-14 (Mk 14 EBR), UR-1 Ursprung. Oberflächen wie Gruppe B (wearPatch +
// finishMaps): glasfaserverstärktes Polymer in Schwarzgrau, Sand und Oliv, phosphatierter/brünierter Stahl, eloxiertes und
// beschichtetes Aluminium.
Object.assign(DEFS, {
  gaPoly: () => wearPatch(std({ color: 0x28292c, metalness: 0.0, roughness: 0.68, ...GB_POLY(2) }), POLY_WEAR),
  gaPolyDark: () => wearPatch(std({ color: 0x1c1d1f, metalness: 0.0, roughness: 0.62, ...GB_POLY(2.5) }), POLY_WEAR),
  gaPolyTan: () => wearPatch(std({ color: 0x766a50, metalness: 0.0, roughness: 0.74, ...GB_POLY(2) }), { ...POLY_WEAR, col: 0xa89a7c, tone: 0.08 }),
  gaPolyOD: () => wearPatch(std({ color: 0x4d5240, metalness: 0.0, roughness: 0.72, ...GB_POLY(2) }), { ...POLY_WEAR, col: 0x6a6f5c }),
  gaGrip: () => wearPatch(std({ color: 0x202124, metalness: 0.0, roughness: 0.86, normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.5, 0.5) }), { ...POLY_WEAR, k: 0.5 }),
  gaGripOD: () => wearPatch(std({ color: 0x4a4f3d, metalness: 0.0, roughness: 0.86, normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.45, 0.45) }), { ...POLY_WEAR, col: 0x666b58, k: 0.5 }),
  gaGripTan: () => wearPatch(std({ color: 0x7d7055, metalness: 0.0, roughness: 0.88, normalMap: stippleNormal(), normalScale: new THREE.Vector2(0.5, 0.5) }), { ...POLY_WEAR, col: 0x9a8d70, k: 0.5 }),
  gaSteel: () => wearPatch(std({ color: 0x2d2e31, metalness: 0.55, roughness: 0.5, ...GB_STEEL(2.5) }), STEEL_WEAR),
  gaBlued: () => wearPatch(std({ color: 0x1c1d20, metalness: 0.7, roughness: 0.38, ...GB_STEEL(3) }), { ...STEEL_WEAR, bump: 0.00004 }),
  gaBolt: () => wearPatch(phys({ color: 0x6e7176, metalness: 0.9, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.25, ...GB_STEEL(3) }), { ...STEEL_WEAR, bump: 0.00002 }),
  gaAlu: () => wearPatch(phys({ color: 0x242528, metalness: 0.35, roughness: 0.5, clearcoat: 0.08, clearcoatRoughness: 0.4, roughnessMap: fine(finishMaps('alu').rough, 2), normalMap: fine(finishMaps('alu').normal, 3), normalScale: new THREE.Vector2(0.08, 0.08) }), ALU_WEAR),
  gaTan: () => wearPatch(std({ color: 0x8c7854, metalness: 0.25, roughness: 0.62, roughnessMap: fine(finishMaps('alu').rough, 2), normalMap: grainNormal(), normalScale: new THREE.Vector2(0.28, 0.28) }), { col: 0x9fa2a6, metal: 1, rough: 0.3, k: 0.9 }),
  gaMag: () => wearPatch(std({ color: 0x35373a, metalness: 0.5, roughness: 0.46, ...GB_STEEL(2.5) }), { col: 0x8a8d91, metal: 1, rough: 0.3, k: 0.9 }),
});
Object.assign(LOD_META, {
  gaPoly: [0x28292c, 0], gaPolyDark: [0x1c1d1f, 0], gaPolyTan: [0x766a50, 0], gaPolyOD: [0x4d5240, 0], gaGrip: [0x202124, 0], gaGripOD: [0x4a4f3d, 0], gaGripTan: [0x7d7055, 0],
  gaSteel: [0x2d2e31, 1], gaBlued: [0x1c1d20, 1], gaBolt: [0x6e7176, 1], gaAlu: [0x242528, 0], gaTan: [0x8c7854, 0], gaMag: [0x35373a, 1],
});

// ---------------------------------------------------------------- Oberflächen-Baukasten (14.11.2026, gfx-waffen): alle Waffen ohne
// eigenen Foto-Atlas (Gruppen A/B/C, Werfer, Nahkampf, Granaten, Optiken/Aufsätze) bekommen kachelnde Detail-Sätze in echtem Maßstab
// (finish-kit.js: Erodierstruktur, Phosphatkristalle, Polierriefen, Strahlkorn, Stippling, Fischhaut, Rändel, Schleifriefen, Holzporen,
// Mikrokratzer bis aufs Grundmetall, Öl/Schmauch) – zusammen mit wearPatch (Kantenabrieb, Schmutz in Kehlen, Griffspuren, Wellen).
// Rauheit: Materialwert / KIT_R (Karte G = 0,7 ≙ Materialwert). Tarnungen ersetzen nur map – Rauheit/Normalen/Kratzer bleiben.
function kitMat(kind, o, wear, { scale = 1, physical = false, n = 1, kt = 1 } = {}) {
  const k = kitMaps(kind, scale);
  const m = (physical ? phys : std)({ ...o, roughness: (o.roughness ?? 0.6) / KIT_R, roughnessMap: k.orm, metalnessMap: k.orm, normalMap: k.normal, normalScale: new THREE.Vector2(n, n), ...(k.map ? { map: k.map } : {}) });
  return wearPatch(m, { ...wear, kit: true, kt });
}
const PARK_WEAR = { ...STEEL_WEAR, col: 0x7b7e82, rough: 0.34, bump: 0.00004, tone: 0.08 };
const BLUED_WEAR = { col: 0x9a9da2, metal: 1, rough: 0.22, k: 1.1, bump: 0.00003, tone: 0.07, smear: 0.4 };
const BOLT_WEAR = { col: 0xb4b7bb, metal: 1, rough: 0.16, bump: 0.00002, tone: 0.06, smear: 0.45 };
const KPOLY_WEAR = { ...POLY_WEAR, col: 0x4a4b4f, bump: 0.00002 };
const CERA_WEAR = { col: 0x8e9196, metal: 1, rough: 0.3, k: 0.85, bump: 0.00002, tone: 0.06, smear: 0.3 };
const WOOD_WEAR = { col: 0x94603e, metal: 0, rough: 0.6, k: 0.3, bump: 0.00004, tone: 0.06, smear: 0.2 };
// Allgemeine Materialien liegen meist auf Kisten mit Fasen (builder.js edgeWear: jede Fase voll „abgerieben“) – dort schwächer,
// sonst glänzt jede Kante wie Marmor (Prüfung 14.11.)
const GEN = (w, k = 0.4) => ({ ...w, k: (w.k ?? 1) * k });
const GRIP_WEAR = { ...POLY_WEAR, k: 0.5, bump: 0.00001, tone: 0.04 };
const poly = (color, rough = 0.68, wear = KPOLY_WEAR) => () => kitMat('poly', { color, metalness: 0, roughness: rough }, wear);
const grip = (color, wear = GRIP_WEAR) => () => kitMat('stipple', { color, metalness: 0, roughness: 0.86 }, wear);
Object.assign(DEFS, {
  // Gruppe A (K-36, BX-20, G-7, SK-14) und B (Wespe, Keiler, LM-8, HM-60, Orkan)
  gaPoly: poly(0x252629), gaPolyDark: poly(0x1b1c1e, 0.62), gaPolyTan: poly(0x766a50, 0.74, { ...KPOLY_WEAR, col: 0xa89a7c, tone: 0.08 }),
  gaPolyOD: poly(0x4b5040, 0.72, { ...KPOLY_WEAR, col: 0x6a6f5c }),
  gbPoly: poly(0x202124, 0.66), gbPolyGrey: poly(0x2a2c2e, 0.72),
  gaGrip: grip(0x1f2023), gaGripOD: grip(0x484d3b, { ...GRIP_WEAR, col: 0x666b58 }), gaGripTan: grip(0x7a6d52, { ...GRIP_WEAR, col: 0x9a8d70 }), gbGrip: grip(0x1b1c1e),
  gaSteel: () => kitMat('park', { color: 0x2f3033, metalness: 0.55, roughness: 0.55 }, PARK_WEAR),
  gbSteel: () => kitMat('park', { color: 0x2d2e31, metalness: 0.55, roughness: 0.55 }, PARK_WEAR),
  gaMag: () => kitMat('park', { color: 0x35373a, metalness: 0.5, roughness: 0.5 }, { ...PARK_WEAR, col: 0x8a8d91, k: 0.9 }),
  gaBlued: () => kitMat('blued', { color: 0x1c1d20, metalness: 0.75, roughness: 0.36 }, BLUED_WEAR),
  gbBlued: () => kitMat('blued', { color: 0x1b1c1f, metalness: 0.75, roughness: 0.36 }, BLUED_WEAR),
  // Lauf nach Dauerfeuer: dunkel angelaufen, matter
  gbBarrel: () => kitMat('blued', { color: 0x212123, metalness: 0.7, roughness: 0.46 }, { ...BLUED_WEAR, col: 0x6a6c70, k: 0.8 }),
  gaBolt: () => kitMat('bolt', { color: 0x6e7176, metalness: 0.92, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.22 }, BOLT_WEAR, { physical: true }),
  gbBolt: () => kitMat('bolt', { color: 0x6d7075, metalness: 0.92, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.22 }, BOLT_WEAR, { physical: true }),
  gaAlu: () => kitMat('anod', { color: 0x232427, metalness: 0.35, roughness: 0.5, clearcoat: 0.08, clearcoatRoughness: 0.4 }, ALU_WEAR, { physical: true }),
  gbAlu: () => kitMat('anod', { color: 0x222326, metalness: 0.35, roughness: 0.5, clearcoat: 0.08, clearcoatRoughness: 0.4 }, ALU_WEAR, { physical: true }),
  gaTan: () => kitMat('cera', { color: 0x8c7854, metalness: 0.15, roughness: 0.62 }, { ...CERA_WEAR, col: 0x9fa2a6 }),
  gbOlive: () => kitMat('cera', { color: 0x3f4529, metalness: 0.2, roughness: 0.62 }, { ...CERA_WEAR, col: 0x7d7f78, k: 0.8 }),
  // Schichtholz (RPK, Pflaumenlack): Holzfarbe aus dem Satz, rötlich getönt, Lack mit Klarschicht
  gbWood: () => kitMat('woodWarm', { color: 0xd2a296, metalness: 0, roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.28, specularIntensity: 0.5 }, { ...WOOD_WEAR, col: 0x8a5a3c, k: 0.6 }, { physical: true, kt: 0 }),
  gbBakelite: () => kitMat('poly', { color: 0x58291a, metalness: 0, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.25 }, { col: 0x8a4a2a, metal: 0, rough: 0.5, k: 0.6, bump: 0.00003, tone: 0.1, smear: 0.2 }, { physical: true, kt: 0.6 }),
  // Allgemeine Materialien (Gruppe C: Brecher, Titan, Bulldog, Hagel, Kobra; Werfer; Nahkampf; Granaten; Optiken/Aufsätze)
  steel: () => kitMat('park', { color: 0x35373a, metalness: 0.55, roughness: 0.55 }, GEN(PARK_WEAR)),
  steelDark: () => kitMat('blued', { color: 0x222326, metalness: 0.78, roughness: 0.36 }, GEN({ ...BLUED_WEAR, col: 0x7d8085 })),
  steelBright: () => kitMat('bolt', { color: 0x8d9095, metalness: 1, roughness: 0.3 }, GEN(BOLT_WEAR, 0.5)),
  alu: () => kitMat('anod', { color: 0x26272b, metalness: 0.3, roughness: 0.5, clearcoat: 0.08, clearcoatRoughness: 0.4 }, GEN(ALU_WEAR), { physical: true }),
  aluTan: () => kitMat('cera', { color: 0x8f7a58, metalness: 0.15, roughness: 0.62 }, GEN({ ...CERA_WEAR, col: 0x9fa2a6 }, 0.6)),
  aluOD: () => kitMat('cera', { color: 0x3f4630, metalness: 0.12, roughness: 0.66 }, GEN({ ...CERA_WEAR, col: 0x7d7f78 }, 0.6)),
  polymer: poly(0x1f2023, 0.74), polymerOD: poly(0x3f4630, 0.78, { ...KPOLY_WEAR, col: 0x5d634c }), polymerGrey: poly(0x35383b, 0.72),
  polymerTan: poly(0x6f5d43, 0.78, { ...KPOLY_WEAR, col: 0x9a8a6a, tone: 0.08 }),
  grip: grip(0x1c1d20), gripTan: grip(0x75644a, { ...GRIP_WEAR, col: 0x9a8d70 }),
  rubber: () => kitMat('rubber', { color: 0x19191b, metalness: 0, roughness: 0.86 }, { ...POLY_WEAR, k: 0.3, bump: 0.00001, tone: 0.04 }),
  knurl: () => kitMat('knurl', { color: 0x2c2d31, metalness: 0.75, roughness: 0.48 }, GEN(BLUED_WEAR, 0.5)),
  // Lackholz (Bulldog-Walnuss, Werfer, Spaten/Axt): Farbe, Poren und Maserung aus dem Satz, Klarlack spiegelt weich
  woodWalnut: () => kitMat('woodWalnut', { color: 0xffffff, metalness: 0, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.18, specularIntensity: 0.45 }, { ...WOOD_WEAR, col: 0x8a6040 }, { physical: true, kt: 0 }),
  woodWarm: () => kitMat('woodWarm', { color: 0xffffff, metalness: 0, roughness: 0.58, clearcoat: 0.35, clearcoatRoughness: 0.3, specularIntensity: 0.45 }, WOOD_WEAR, { physical: true, kt: 0 }),
  stainless: () => kitMat('blade', { color: 0x9da1a6, metalness: 1, roughness: 0.3 }, GEN(STAINLESS_WEAR, 0.6)),
  blade: () => kitMat('blade', { color: 0x9a9ea3, metalness: 1, roughness: 0.22 }, { ...STAINLESS_WEAR, col: 0xc9ccd0 }),
  bladeCoat: () => kitMat('cera', { color: 0x2a2b2d, metalness: 0.25, roughness: 0.52 }, GEN({ ...CERA_WEAR, col: 0x9a9ea3 }, 0.7)),
  paintOlive: () => kitMat('cera', { color: 0x505733, metalness: 0.1, roughness: 0.6 }, GEN({ ...CERA_WEAR, col: 0x7d7f78 }, 0.6)),
  // Leder (Messergriff-Scheiben, Riemen): Narbung aus dem Gummi-Satz, gröber gekachelt; Schrothülsen: gerillter Kunststoff matt
  leather: () => kitMat('rubber', { color: 0x5a3a22, metalness: 0, roughness: 0.6 }, { col: 0x7a5236, metal: 0, rough: 0.45, k: 0.3, bump: 0.00008, tone: 0.12, smear: 0.35 }, { scale: 0.6, n: 2.2 }),
  shellRed: () => kitMat('poly', { color: 0x8f1f17, metalness: 0, roughness: 0.5 }, { col: 0xa8443a, metal: 0, rough: 0.4, k: 0.6, bump: 0.00002, tone: 0.08, smear: 0.3 }),
  // Messing/Kupfer (Gurt, Patronen am Werfer, Zierteile): fein geschliffen, Schmauchschleier, Fingerabdrücke matter
  brass: () => kitMat('bolt', { color: 0xc9a14e, metalness: 1, roughness: 0.26 }, { col: 0xe6cf8f, metal: 1, rough: 0.16, k: 0.5, bump: 0.00002, tone: 0.1, smear: 0.5 }, { kt: 0.6 }),
  copper: () => kitMat('bolt', { color: 0xb8703f, metalness: 1, roughness: 0.3 }, { col: 0xd9926a, metal: 1, rough: 0.2, k: 0.5, bump: 0.00002, tone: 0.1, smear: 0.5 }, { kt: 0.5 }),
  // Patronen im Magazin (ohne UVs): Messing mit Fleckigkeit, Griffspuren, blanken Kanten
  rounds: () => wearPatch(std({ color: 0xffffff, vertexColors: true, metalness: 1, roughness: 0.24 }), { col: 0xf0dda5, metal: 1, rough: 0.14, k: 0.5, bump: 0.00001, tone: 0.16, smear: 0.7 }),
  // Laufkrone: blank gedreht, aber berußt (Schmauch aus dem Builder, Schmutzkanal)
  crown: () => wearPatch(std({ color: 0x8f9398, metalness: 1, roughness: 0.24, side: THREE.DoubleSide }), { col: 0xb5b9be, metal: 1, rough: 0.18, k: 0.4, bump: 0.00001, tone: 0.1, smear: 0.3 }),
  // Optik-Linsen: Mehrschicht-Vergütung als Dünnschicht-Interferenz (grün/violette Reflexe je nach Blickwinkel), Glas fast schwarz
  // visier (14.11.): wieder einseitig – jede Linse zeigt jetzt nach außen (Objektiv nach vorn, Okular nach hinten, parts.js /
  // guns-praezision.js); beidseitig spiegelte die Rückseite des Objektivs ins Rohr und schloss die Durchsicht
  // gesamt 20.11.: Vergütung dezenter (vorher iridescence 1 bei 220–460 nm → Okular wirkte flächig lila, v. a. in VR)
  lens: () => phys({ color: 0x04080b, metalness: 0, roughness: 0.02, envMapIntensity: 2.4, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.35, iridescenceIOR: 1.6, iridescenceThicknessRange: [380, 560], specularIntensity: 1, emissive: 0x02070b, emissiveIntensity: 1 }),
  lensClear: () => phys({ color: 0x8fb8d8, metalness: 0.6, roughness: 0.03, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.8, iridescence: 0.45, iridescenceIOR: 1.6, iridescenceThicknessRange: [380, 560] }),
  glass: () => phys({ color: 0x9fd8d0, metalness: 0.4, roughness: 0.04, transparent: true, opacity: 0.18, depthWrite: false, envMapIntensity: 1.4, iridescence: 0.6, iridescenceIOR: 1.6, iridescenceThicknessRange: [260, 400] }),
  // Augenseite durchsichtiger Optiken (visier, 14.11.): Okular von Rotpunkt/Holo/Kampfvisier, zum Auge gerichtet – nur ein Hauch
  // Tönung und kaum Spiegelung, damit man im Anschlag frei durchsieht. Die Außenseite (Objektiv/Frontscheibe) zeigt nach vorn und
  // behält die kräftigen Vergütungsreflexe (lensClear/glass), wird von hinten aber nicht gezeichnet.
  lensEye: () => phys({ color: 0xc4dcec, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.06, depthWrite: false, envMapIntensity: 0.6, iridescence: 0.5, iridescenceIOR: 1.8, iridescenceThicknessRange: [240, 420] }),
});
// Bot-Stufe: Ersatzfarben/Metallgruppe wie vor dem Umbau (die Bot-Fassung baut keine Detail-Sätze)
Object.assign(LOD_META, {
  steel: [0x3f4146, 1], steelDark: [0x2b2c30, 1], steelBright: [0x8d9095, 1], alu: [0x2a2b2f, 1], aluTan: [0x8f7a58, 0], aluOD: [0x3f4630, 0],
  polymer: [0x1f2023, 0], polymerTan: [0x66553c, 0], polymerOD: [0x3f4630, 0], polymerGrey: [0x35383b, 0], grip: [0x1c1d20, 0], gripTan: [0x75644a, 0],
  rubber: [0x18181a, 0], knurl: [0x2c2d31, 1], woodWalnut: [0x4a2d1c, 0], woodWarm: [0x6a3a22, 0], stainless: [0x9da1a6, 1], blade: [0x9a9ea3, 1],
  bladeCoat: [0x2a2b2d, 1], paintOlive: [0x505733, 0], brass: [0xc09a45, 1], copper: [0xb8703f, 1], crown: [0xa9adb2, 1],
  leather: [0x5a3a22, 0], shellRed: [0x8f1f17, 0],
});
