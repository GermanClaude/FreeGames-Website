// NULLPUNKT — Weitere Panzermodelle + gemeinsame Anbauteile (Nutzer 15.11.: „mehrere weitere Panzermodelle, grafisch extrem
// gut … außen nicht mehr kastig“). Alle Namen frei erfunden, Bauart je Epoche realistisch:
//
//   SZ-8 Igel     (spz,  modern)       Schützenpanzer: Motor vorn rechts, Fahrer vorn links, Zwei-Mann-Turm mit 30-mm-
//                                      Maschinenkanone, Lenkflugkörper-Startgerät links am Turm, Kampfraum hinten mit
//                                      Heckrampe für vier Schützen, Schürzen mit Zusatzpanzerung.
//   KP-68 Auerochs (kk,  Kalter Krieg) Kampfpanzer der 1960er/70er: geschweißte Wanne, großer Gussturm mit Kommandanten-
//                                      kuppel (MG), 105-mm-Kanone mit Wärmeschutzhülle, Infrarot-Suchscheinwerfer über der
//                                      Blende, später Laser-Entfernungsmesser, Stereo-Entfernungsmesser-Köpfe am Turm.
//   MP-43 Elch    (wk2m, 2. WK)       mittlerer Panzer: stark geneigte Platten, Federlaufwerk mit fünf großen Laufrollen,
//                                      gegossener, gerundeter Turm, 85-mm-Kanone, Zusatztanks am Heck, Haltegriffe.
//   JP-44 Stier   (wk2j, 2. WK)       Jagdpanzer ohne Turm: niedrige, rundum geneigte Kasematte, 75-mm-Kanone in einer
//                                      gegossenen Topfblende rechts der Mitte (Schwenkbereich ±11°, gerichtet über den Rumpf),
//                                      ferngerichtetes Dach-MG, vier große Laufrollen.
//
// Gemeinsame Teile (auch von den Bestandspanzern in models.js genutzt): Triebrad/Leitrad als drehende Rollensätze
// (Nahstufe high/ultra), Nebelwurfbecher, Scheinwerfer mit Schutzgitter, Abschleppseil, Ersatzkettenglieder, Staukasten,
// Kanister, Antennen, Schweißnähte. Gerundete Hüllen kommen aus vehicles/armorkit.js (Unterteilungsflächen).
//
// Baukasten K (aus models.js): Bucket, box, cyl, sph, sideExtrude, topExtrude, addTracks, trackPathFor, addLenses,
// addRoadWheelHQ, addRoadWheel, rgWheel, markingMaterial, VEHICLES, HQ, DET, setLod. Signatur der Bauer: (lod, S, team, K)
// → { hull, tur, gun, cmg }. low (HQ aus) bleibt bei einfachen Quadern/Extrusionen (Handy).
import * as THREE from 'three';
import { armorShell, sideHullRings, stackRings, weldSeam, insetPoly } from './armorkit.js?v=20261115041504';

const PI = Math.PI, HP = PI / 2;

/* ===================================================================== Anbauteile */

/** Triebrad: lackierte Scheibe mit Erleichterungslöchern, Nabe, zwei Zahnkränze – dreht (Nahstufe, high/ultra). */
export function sprocket(K, B, S, paint, x, y, z, r, w, teeth, lod) {
  if (lod === 0 && K.rgWheel(`sp${r}|${w}|${teeth}`, x, y, z, r, (BB, cx) => sprocket(K, BB, S, paint, cx, 0, 0, r, w, teeth, lod), true)) return;
  const { box, cyl } = K, sx = Math.sign(x) || 1, seg = lod === 0 ? 22 : 12;
  if (lod > 1 || !K.HQ) { B.add(cyl(r, r, w, lod > 1 ? 8 : 12), S.dark, [x, y, z], [0, 0, HP]); return; }
  B.add(cyl(r * 0.8, r * 0.8, w * 0.86, seg), paint, [x, y, z], [0, 0, HP]);
  B.add(cyl(r * 0.3, r * 0.34, w + 0.08, Math.max(8, seg >> 1)), S.dark, [x, y, z], [0, 0, HP]);
  B.add(cyl(r * 0.2, r * 0.24, 0.07, Math.max(8, seg >> 1)), S.dark, [x + sx * (w / 2 + 0.07), y, z], [0, 0, HP]);
  if (lod === 0) {
    for (const dx of [-w * 0.3, w * 0.3]) {
      B.add(cyl(r * 0.92, r * 0.92, 0.05, seg), S.dark, [x + dx, y, z], [0, 0, HP]);
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * PI * 2;
        B.add(box(0.05, 0.07, 0.06), S.dark, [x + dx, y + Math.sin(a) * (r * 0.96), z + Math.cos(a) * (r * 0.96)], [a, 0, 0]);
      }
    }
    if (K.DET === 2) {
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.26; B.add(cyl(r * 0.11, r * 0.11, 0.02, 8), S.rubber, [x + sx * (w * 0.43 + 0.006), y + Math.sin(a) * r * 0.56, z + Math.cos(a) * r * 0.56], [0, 0, HP]); }
      for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; B.add(box(0.025, 0.025, 0.025), S.dark, [x + sx * (w / 2 + 0.035), y + Math.sin(a) * r * 0.27, z + Math.cos(a) * r * 0.27]); }
    }
  } else B.add(cyl(r * 0.96, r * 0.96, w * 0.75, seg), S.dark, [x, y, z], [0, 0, HP]);
}

/** Leitrad: Doppelscheibe (Kettenzahn läuft dazwischen), Speichen außen, Nabe – dreht (Nahstufe, high/ultra). */
export function idler(K, B, S, paint, x, y, z, r, w, lod, spokes = 6) {
  if (lod === 0 && K.rgWheel(`id${r}|${w}|${spokes}`, x, y, z, r, (BB, cx) => idler(K, BB, S, paint, cx, 0, 0, r, w, lod, spokes), true)) return;
  const { box, cyl } = K, sx = Math.sign(x) || 1, seg = lod === 0 ? 22 : 12;
  if (lod > 1 || !K.HQ) { B.add(cyl(r, r, w, lod > 1 ? 8 : 12), S.dark, [x, y, z], [0, 0, HP]); return; }
  for (const dx of [-w * 0.3, w * 0.3]) B.add(cyl(r, r, w * 0.34, seg), S.dark, [x + dx, y, z], [0, 0, HP]);
  B.add(cyl(r * 0.8, r * 0.8, w * 0.95, seg), paint, [x, y, z], [0, 0, HP]);
  B.add(cyl(r * 0.26, r * 0.3, w + 0.1, Math.max(8, seg >> 1)), S.dark, [x, y, z], [0, 0, HP]);
  if (lod === 0) for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * PI * 2 + 0.3;
    B.add(box(0.045, 0.05, r * 0.62), paint, [x + sx * (w * 0.48 + 0.02), y + Math.sin(a) * r * 0.5, z + Math.cos(a) * r * 0.5], [a, 0, 0]);
  }
}

/** Nebelwurfbecher: Halterung + n Becher im Fächer (Gier yaw, Neigung up), in Turm-Bucket T. */
export function smokeRack(K, T, S, paint, x, y, z, n, sx, lod, { up = 0.55, spread = 0.16, r = 0.045, len = 0.24 } = {}) {
  const { box, cyl } = K;
  T.add(box(0.12, 0.08, n * 0.1 + 0.06), paint, [x, y - 0.06, z]);
  for (let i = 0; i < n; i++) {
    const k = i - (n - 1) / 2;
    T.add(cyl(r, r * 1.05, len, lod === 0 ? 10 : 6, lod > 0), S.dark, [x + sx * 0.02, y + 0.02, z + k * 0.1], [0, 0, sx * up]);
    if (lod === 0 && K.DET === 2) T.add(cyl(r * 0.85, r * 0.85, 0.012, 8), S.rubber, [x + sx * (0.02 + Math.sin(up) * len / 2), y + 0.02 + Math.cos(up) * len / 2, z + k * 0.1], [0, 0, sx * up]);
  }
  void spread;
}

/** Scheinwerfer mit Gehäuse und Schutzgitter (Ring + Stäbe) vor dem Glas (Glas selbst: addLenses). */
export function guardedLamp(K, B, S, L, r, lod, { guard = true } = {}) {
  const { box, cyl } = K;
  B.add(cyl(r * 1.15, r * 1.25, 0.16, lod < 2 ? 12 : 8), S.dark, [L[0], L[1], L[2] + 0.09], [HP, 0, 0]);
  if (!guard || lod > 1) return;
  B.add(new THREE.TorusGeometry(r * 1.35, 0.008, 4, lod === 0 ? 16 : 10), S.dark, [L[0], L[1], L[2] - 0.08]);
  for (const a of [-0.5, 0, 0.5]) B.add(box(0.008, r * 2.6, 0.008), S.dark, [L[0] + a * r * 1.6, L[1], L[2] - 0.08]);
  for (const sx of [-1, 1]) B.add(box(0.014, 0.014, 0.12), S.dark, [L[0] + sx * r * 1.3, L[1] + r * 0.9, L[2]]);
}

/** Abschleppseil: durchhängende Litze entlang pts, Kauschen an den Enden, Halteklammern. */
export function towCable(K, B, S, pts, lod, r = 0.02) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  B.add(new THREE.TubeGeometry(curve, lod === 0 ? 48 : 16, r, lod === 0 ? 6 : 4, false), S.dark);
  if (lod > 0) return;
  for (const t of [0, 1]) { const p = curve.getPointAt(t); B.add(new THREE.TorusGeometry(r * 2.6, r * 0.8, 5, 10), S.dark, [p.x, p.y, p.z], [0, HP, 0]); }
  for (const t of [0.3, 0.7]) { const p = curve.getPointAt(t); B.add(K.box(0.03, 0.05, 0.03), S.dark, [p.x, p.y, p.z]); }
}

/** Ersatzkettenglieder: n Platten mit Greifsteg und Bolzen, Reihe entlang dir (Einheitsvektor), Normale n (Achsen-Rotation rot). */
export function spareLinks(K, B, S, p0, n, w, pitch, rot, lod, dir = [1, 0, 0]) {
  const { box, cyl } = K;
  for (let i = 0; i < n; i++) {
    const c = [p0[0] + dir[0] * i * pitch, p0[1] + dir[1] * i * pitch, p0[2] + dir[2] * i * pitch];
    B.add(box(w, 0.035, pitch * 0.86), S.dark, c, rot);
    if (lod === 0) { B.add(box(w * 0.9, 0.03, 0.04), S.dark, [c[0], c[1] + 0.025, c[2]], rot); if (K.DET === 2) B.add(cyl(0.012, 0.012, w + 0.05, 6), S.steel, c, [rot ? rot[0] : 0, rot ? rot[1] : 0, HP]); }
  }
}

/** Kanister (geprägte Flanken, Griffe), Mitte p, Gier ry. */
export function jerrycan(K, B, mat, S, p, ry, lod) {
  const { box } = K;
  B.add(box(0.16, 0.46, 0.34), mat, p, [0, ry, 0]);
  if (lod === 0) {
    B.add(box(0.17, 0.035, 0.3), mat, [p[0], p[1] + 0.1, p[2]], [0, ry, 0]);
    B.add(box(0.05, 0.05, 0.14), S.dark, [p[0], p[1] + 0.26, p[2] - 0.05], [0, ry, 0]);
  }
}

/** Peitschenantenne mit Fuß und Federsockel. */
export function antenna(K, B, S, p, len, lod) {
  const { cyl } = K;
  B.add(cyl(0.045, 0.06, 0.09, 8), S.dark, p);
  B.add(cyl(0.022, 0.022, 0.12, 6), S.rubber, [p[0], p[1] + 0.1, p[2]]);
  B.add(cyl(0.006, 0.011, len, 4), S.dark, [p[0], p[1] + 0.16 + len / 2, p[2]]);
  if (lod === 0) B.add(new THREE.SphereGeometry(0.014, 6, 4), S.dark, [p[0], p[1] + 0.16 + len, p[2]]);
}

/** Schweißraupe (nur Nahstufe high/ultra) – Lackmaterial, Naht als geriffelte Wulst. */
export function weld(K, B, paint, pts, lod, r = 0.011) {
  if (lod !== 0 || K.DET !== 2) return;
  B.add(weldSeam(pts, r), paint);
}

/** Staukasten mit Deckel, Scharnieren und Riegeln. */
export function stowBox(K, B, paint, S, p, size, lod, ry = 0) {
  const { box } = K;
  B.add(box(size[0], size[1], size[2]), paint, p, [0, ry, 0]);
  if (lod > 0) return;
  B.add(box(size[0] + 0.02, 0.02, size[2] + 0.02), paint, [p[0], p[1] + size[1] / 2, p[2]], [0, ry, 0]);
  if (K.DET === 2) for (const k of [-0.3, 0.3]) B.add(box(0.03, 0.06, 0.03), S.dark, [p[0] + Math.cos(ry) * k * size[0], p[1] + size[1] * 0.3, p[2] - Math.sin(ry) * k * size[0] + (Math.abs(ry) < 0.1 ? -size[2] / 2 - 0.012 : 0)], [0, ry, 0]);
}

/** Rollen der Laufwerke: Liste z-Lagen, HQ-Rolle (Gummibandage, Scheibe, Nabe). */
function roadWheels(K, B, S, paint, x, y, zs, r, lod, w = 0.42) {
  const rs = lod === 0 ? (K.DET === 2 ? 18 : 14) : (K.DET === 2 ? 10 : 8);
  for (const z of zs) {
    if (K.HQ) K.addRoadWheelHQ(B, S, paint, x, y, z, r, rs, lod);
    else K.addRoadWheel(B, S, x, y, z, r, 8, lod);
  }
  void w;
}

/** Stützrollen (Rückrollen) mit Achsträger. */
function returnRollers(K, B, S, x, y, zs, r, lod, sx) {
  if (lod > 1) return;
  for (const z of zs) {
    B.add(K.cyl(r, r, 0.18, lod === 0 ? 12 : 8), S.rubber, [x, y, z], [0, 0, HP]);
    B.add(K.cyl(0.04, 0.04, 0.32, 6), S.dark, [x - sx * 0.12, y, z], [0, 0, HP]);
  }
}

/** Gerundete Hülle (HQ, Stufe < 2) oder Rückfall-Extrusion. */
export function hullShell(K, B, paint, prof, w, lod, opt = {}) {
  if (K.HQ && lod < 2) B.add(armorShell(sideHullRings(prof, w, opt), { levels: lod === 0 ? (K.DET === 2 ? 2 : 1) : 0, cast: !!opt.cast, castAmp: opt.castAmp || 0.006 }), paint);
  else B.add(K.sideExtrude(prof, w), paint);
}

/** Gussturm-Grundriss: Ellipse (Halbachse a quer, vorn f, hinten b) mit n Punkten; flatFront > 0 flacht die Blendenseite ab. */
export function castFoot(a, f, b, n = 16, { flatFront = 0, bustle = 0 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * PI * 2, s = Math.sin(t), c = Math.cos(t);
    let v = c > 0 ? c * f : c * b;
    if (flatFront && c > 0) v -= flatFront * c * c;
    if (bustle && c < -0.3) v -= bustle * (-c - 0.3);
    out.push([s * a, v]);
  }
  return out;
}

const scalePoly = (p, k, kv = k, dv = 0) => p.map(([x, v]) => [x * k, v * kv + dv]);

/** Gussturm aus Höhenlagen [[y, a, f, b], …] (Ellipsen), Deckel oben weich. */
export function castTurret(K, T, paint, levels, lod, opt = {}) {
  const n = lod === 0 ? 16 : 12;
  // Höhen etwas gestreckt: die Unterteilung (B-Spline) zieht die Hülle nach innen, Turm wirkte sonst flach
  const L = levels.map(([y, a, f, b]) => [y * (K.HQ && lod < 2 ? 1.18 : 1), castFoot(a, f, b, n, opt)]);
  if (K.HQ && lod < 2) T.add(armorShell(stackRings(L, { cast: true, rTop: opt.rTop ?? 0.12, rBot: 0.05 }), { levels: lod === 0 ? (K.DET === 2 ? 2 : 1) : 0, cast: true, castAmp: opt.castAmp || 0.009 }), paint);
  else {
    const top = L[L.length - 1];
    T.add(K.topExtrude(L[0][1], top[0]), paint);
  }
}

/* ===================================================================== SZ-8 Igel (Schützenpanzer, modern) */

export function buildSPZ(lod, S, team, K) {
  K.setLod(lod);
  const D = K.VEHICLES.spz, W = D.wheels, DET = K.DET, HQ = K.HQ;
  const { box, cyl, Bucket } = K;
  const seg = [20, 12, 7][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  const lowProf = [[3.22, 0.5], [3.42, 0.95], [-3.4, 0.95], [-3.25, 0.5]];
  const upProf = [[3.44, 0.94], [3.25, 1.15], [2.55, 1.68], [-3.05, 1.7], [-3.32, 1.55], [-3.36, 0.94]];
  hullShell(K, B, paint, lowProf, 2.3, lod, { r: 0.05, rs: 0.05 });
  hullShell(K, B, paint, upProf, 3.16, lod, { r: 0.04, rs: 0.05, tuck: 0.1 });
  // Schürzen mit Zusatzpanzer-Modulen, Gummiunterkante
  for (const sx of [-1, 1]) {
    if (lod < 2) for (let i = 0; i < 5; i++) {
      const z = -2.6 + i * 1.3;
      B.add(box(0.07, 0.48, 1.24), paint, [sx * 1.62, 0.72, z], [0, 0, sx * 0.03]);
      if (lod === 0) { B.add(box(0.03, 0.12, 1.2), S.rubber, [sx * 1.6, 0.43, z]); if (DET === 2) for (let j = 0; j < 4; j++) for (const dy of [-0.15, 0.15]) B.add(cyl(0.016, 0.016, 0.02, 6), S.dark, [sx * 1.66, 0.74 + dy, z - 0.45 + j * 0.3], [0, 0, HP]); }
    } else B.add(box(0.06, 0.48, 6.4), paint, [sx * 1.62, 0.72, 0]);
  }
  // Bug: Motorraum vorn rechts (Lüftergitter), Fahrerluke vorn links mit Winkelspiegeln, Scheinwerfer, Abschleppösen
  if (lod < 2) {
    B.add(box(1.1, 0.05, 1.0), S.dark, [0.75, 1.69, -2.0]);
    if (lod === 0) for (let i = 0; i < 9; i++) B.add(box(1.04, 0.04, 0.05), paint, [0.75, 1.71, -2.42 + i * 0.105], [0.5, 0, 0]);
    for (let i = -1; i <= 1; i++) B.add(box(0.14, 0.08, 0.1), S.optic, [-0.62 + i * 0.2, 1.72, -2.42 + Math.abs(i) * 0.05], [0, -i * 0.35, 0]);
    B.add(box(0.6, 0.06, 0.05), paint, [-0.62, 1.72, -2.5]);                               // Spritzblech
    B.add(box(0.5, 0.18, 0.4), paint, [1.25, 1.12, -2.85], [-0.6, 0, 0]);                 // Luftfilterhutze
    for (const sx of [-1, 1]) B.add(new THREE.TorusGeometry(0.07, 0.022, 4, 8), S.dark, [sx * 0.85, 0.78, -3.42], [0, HP, 0]);
    // Auspuff rechts vorn mit Hitzeblech
    B.add(box(0.06, 0.3, 0.5), S.dark, [1.6, 1.4, -1.8]);
    if (lod === 0) for (let j = 0; j < 4; j++) B.add(box(0.04, 0.025, 0.46), paint, [1.63, 1.3 + j * 0.065, -1.8]);
  }
  for (const L of D.lights) guardedLamp(K, B, S, L, 0.08, lod);
  // Dach über dem Kampfraum: zwei Lukendeckel, Winkelspiegel der Schützen, Antennen; Heck: Rampe, Rücklichter, Kästen
  if (lod < 2) {
    for (const sx of [-1, 1]) {
      B.add(box(0.62, 0.05, 1.3), paint, [sx * 0.48, 1.725, 2.0]);
      if (lod === 0) {
        for (const dz of [-0.45, 0.45]) B.add(cyl(0.03, 0.03, 0.12, 8), S.dark, [sx * 0.15, 1.75, 2.0 + dz], [HP, 0, 0]); // Scharniere
        B.add(box(0.03, 0.03, 0.2), S.dark, [sx * 0.72, 1.765, 2.0]);
      }
      for (const z of [1.1, 2.6]) B.add(box(0.1, 0.08, 0.14), S.optic, [sx * 1.15, 1.74, z], [0, sx * HP, 0]);
      antenna(K, B, S, [sx * 1.05, 1.7, 2.85], lod === 0 ? 2.1 : 1.4, lod);
    }
    // Heckrampe (Fuge, Scharnierleiste unten, Tür mit Winkelspiegel)
    B.add(box(1.9, 0.6, 0.06), paint, [0, 1.15, 3.38], [-0.26, 0, 0]);
    if (lod === 0) {
      B.add(cyl(0.035, 0.035, 1.9, 8), S.dark, [0, 0.86, 3.32], [0, 0, HP]);
      B.add(box(0.62, 0.48, 0.02), S.dark, [0.42, 1.18, 3.42], [-0.26, 0, 0]);
      B.add(box(0.12, 0.06, 0.06), S.optic, [0.42, 1.4, 3.42], [-0.26, 0, 0]);
      for (const sx of [-1, 1]) { B.add(box(0.12, 0.08, 0.04), S.rearLamp, [sx * 1.3, 1.45, 3.34]); B.add(box(0.36, 0.5, 0.4), S.dark, [sx * 1.32, 1.3, 3.1]); }
      B.add(box(0.16, 0.16, 0.16), S.dark, [0, 0.72, 3.3]);                               // Anhängekupplung
    }
  }
  // Werkzeug + Abschleppseile an den Flanken
  if (HQ && lod < 2) for (const sx of [-1, 1]) towCable(K, B, S, [[sx * 1.56, 1.5, -1.0], [sx * 1.58, 1.44, 0.4], [sx * 1.57, 1.48, 1.9]], lod);
  if (lod === 0) { B.add(box(0.05, 0.08, 1.2), S.wood, [-1.2, 1.72, 0.2]); B.add(box(0.22, 0.02, 0.28), S.dark, [-1.2, 1.72, 0.85]); }
  // Schweißnähte (Glacis/Dach, Dachkanten)
  if (HQ) {
    weld(K, B, paint, [[-1.5, 1.68, -2.55], [1.5, 1.68, -2.55]], lod);
    for (const sx of [-1, 1]) weld(K, B, paint, [[sx * 1.47, 1.69, -2.5], [sx * 1.47, 1.7, 3.0]], lod);
    weld(K, B, paint, [[-1.45, 1.13, -3.27], [1.45, 1.13, -3.27]], lod);
  }
  B.add(cyl(0.18, 0.18, 0.02, seg), mark, [-1.1, 1.0, 3.36], [HP, 0, 0]);
  // Laufwerk: 6 Laufrollen, Triebrad vorn, Leitrad hinten, 3 Stützrollen
  for (const sx of [-1, 1]) {
    const x = sx * W.x;
    if (lod < 2) { roadWheels(K, B, S, paint, x, W.radius, D.roadZ, W.radius, lod); returnRollers(K, B, S, x, 0.86, [-1.7, 0, 1.7], 0.085, lod, sx); }
    else for (const z of [-1.8, 0, 1.8]) B.add(cyl(W.radius, W.radius, 0.42, seg), S.rubber, [x, W.radius, z], [0, 0, HP]);
    sprocket(K, B, S, paint, x, 0.6, -3.0, 0.3, 0.46, 11, lod);
    idler(K, B, S, paint, x, 0.56, 3.02, 0.28, 0.44, lod);
  }
  B.build(hull, { shadow: true });
  K.addTracks(hull, K.trackPathFor(lod, -2.5, 2.5, [-3.0, 0.6, 0.3], [3.02, 0.56, 0.28], [[1.7, 0.945], [0, 0.945], [-1.7, 0.945]], 0.012), W.x, 0.5);
  K.addLenses(hull, D, seg, 0.07);

  // Turm (zwei Mann): geschweißt, keilförmige Front, Zusatzpanzer-Wangen
  const tur = new THREE.Group();
  const T = new Bucket();
  const foot = [[-0.5, 1.2], [0.5, 1.2], [1.0, 0.55], [1.04, -0.75], [0.82, -1.02], [-0.82, -1.02], [-1.04, -0.75], [-1.0, 0.55]];
  if (HQ && lod < 2) T.add(armorShell(stackRings([[0, foot], [0.6, insetPoly(foot, 0.1)]], { r: 0.035, rTop: 0.04, rBot: 0.035 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0 }), paint);
  else T.add(K.topExtrude(foot, 0.6), paint);
  T.add(cyl(0.86, 0.88, 0.1, seg + 4), S.dark, [0, -0.03, 0]);
  if (lod < 2) {
    // Wangenmodule (Abstandspanzer), Optiken, Luken, ATGM-Startgerät, Staukorb
    for (const sx of [-1, 1]) {
      T.add(box(0.12, 0.42, 0.85), paint, [sx * 1.06, 0.28, -0.3], [0, sx * 0.08, 0]);
      if (lod === 0 && DET === 2) for (let j = 0; j < 3; j++) T.add(cyl(0.018, 0.018, 0.02, 6), S.dark, [sx * 1.125, 0.42, -0.6 + j * 0.3], [0, 0, HP]);
      smokeRack(K, T, S, paint, sx * 0.86, 0.66, -0.75, 4, sx, lod);
    }
    T.add(box(0.36, 0.28, 0.4), paint, [0.55, 0.74, -0.68]);                               // Richtschützen-Optik
    T.add(box(0.3, 0.16, 0.02), S.optic, [0.55, 0.76, -0.885]);
    T.add(cyl(0.08, 0.1, 0.3, 10), paint, [-0.55, 0.75, 0.1]);                               // Mast Rundblickoptik (Kopf = cmg)
    // Lenkflugkörper-Startgerät links (zwei Rohre im Kasten, Halterung)
    T.add(box(0.1, 0.36, 0.3), S.dark, [-1.17, 0.38, 0.25]);
    T.add(box(0.36, 0.32, 1.25), paint, [-1.4, 0.42, 0.05]);
    if (lod === 0) for (const dy of [-0.08, 0.08]) { T.add(cyl(0.065, 0.065, 0.03, 12), S.dark, [-1.4, 0.42 + dy, -0.58], [HP, 0, 0]); T.add(cyl(0.05, 0.05, 0.02, 10), S.optic, [-1.4, 0.42 + dy, -0.595], [HP, 0, 0]); }
    T.add(box(1.7, 0.04, 0.4), S.dark, [0, 0.12, 1.22]);
    for (const sx of [-1, 0, 1]) T.add(box(0.035, 0.34, 0.035), S.dark, [sx * 0.84, 0.29, 1.42]);
    T.add(box(1.7, 0.035, 0.035), S.dark, [0, 0.46, 1.42]);
    if (lod === 0) { T.add(box(0.7, 0.28, 0.32), S.canvas, [-0.35, 0.28, 1.22]); T.add(box(0.5, 0.24, 0.3), S.canvas, [0.45, 0.26, 1.22]); }
    antenna(K, T, S, [0.75, 0.6, 0.85], lod === 0 ? 1.8 : 1.2, lod);
    if (lod === 0) for (const [x, z] of [[-0.85, -0.7], [0.85, -0.7], [-0.75, 0.85], [0.75, 0.85]]) T.add(new THREE.TorusGeometry(0.045, 0.013, 4, 8), S.dark, [x, 0.61, z], [0, HP, 0]);
    if (HQ) { weld(K, T, paint, [[-0.46, 0.59, -1.08], [0.46, 0.59, -1.08], [0.9, 0.59, -0.5], [0.94, 0.59, 0.6], [0.74, 0.59, 0.9]], lod); }
  }
  for (const sx of [-1, 1]) T.add(cyl(0.14, 0.14, 0.02, seg), mark, [sx * 1.06, 0.28, 0.35], [0, 0, HP]);
  const turLod = new THREE.Group();
  T.build(turLod, { off: D.turretPivot });
  tur.add(turLod);

  // 30-mm-Maschinenkanone: schmale Blende, Wiege, Rohr mit Mündungsfeuerdämpfer, Koaxial-MG
  const gun = new THREE.Group();
  const G = new Bucket();
  G.add(box(0.42, 0.34, 0.36), paint, [0, 0, 0.05]);
  G.add(box(0.28, 0.24, 0.3), paint, [0, 0, -0.25]);
  G.add(cyl(0.045, 0.045, 2.35, seg), S.dark, [0, 0, -1.5], [HP, 0, 0]);
  G.add(cyl(0.065, 0.065, 0.55, seg), paint, [0, 0, -0.6], [HP, 0, 0]);
  G.add(cyl(0.06, 0.055, 0.24, seg), S.dark, [0, 0, -2.75], [HP, 0, 0]);
  if (lod === 0) { for (let i = 0; i < 4; i++) G.add(box(0.13, 0.012, 0.02), S.dark, [0, 0, -2.68 - i * 0.05]); G.add(box(0.07, 0.07, 0.12), S.dark, [0, 0.08, -0.95]); }
  G.add(cyl(0.016, 0.016, 0.35, 6), S.dark, [D.coax[0], D.coax[1], -0.4], [HP, 0, 0]);
  const gunLod = new THREE.Group();
  G.build(gunLod, { off: [D.turretPivot[0] + D.gunPivot[0], D.turretPivot[1] + D.gunPivot[1], D.turretPivot[2] + D.gunPivot[2]] });
  gun.add(gunLod);

  // Rundblickoptik des Kommandanten (dreht mit seinem Blick)
  const cmg = new THREE.Group();
  const C = new Bucket();
  C.add(cyl(0.14, 0.14, 0.2, seg), paint, [0, 0, 0]);
  C.add(box(0.2, 0.12, 0.04), S.optic, [0, 0.01, -0.13]);
  if (lod < 2) C.add(box(0.26, 0.03, 0.22), paint, [0, 0.11, -0.02]);
  const cmgLod = new THREE.Group();
  C.build(cmgLod, { shadow: lod < 2, off: [D.turretPivot[0] + D.cmgPivot[0], D.turretPivot[1] + D.cmgPivot[1], D.turretPivot[2] + D.cmgPivot[2]] });
  cmg.add(cmgLod);
  return { hull, tur, gun, cmg };
}

/* ===================================================================== KP-68 Auerochs (Kalter Krieg) */

export function buildKK(lod, S, team, K) {
  K.setLod(lod);
  const D = K.VEHICLES.kk, W = D.wheels, DET = K.DET, HQ = K.HQ;
  const { box, cyl, sph, Bucket } = K;
  const seg = [20, 12, 7][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  hullShell(K, B, paint, [[3.15, 0.5], [3.48, 0.98], [-3.42, 0.98], [-3.3, 0.5]], 2.3, lod, { r: 0.06, rs: 0.05 });
  hullShell(K, B, paint, [[3.5, 0.97], [2.35, 1.55], [-2.9, 1.58], [-3.4, 1.4], [-3.44, 0.97]], 2.5, lod, { r: 0.05, rs: 0.05, tuck: 0.05 });
  // Kettenabdeckungen (Kotflügel) mit Staukästen
  for (const sx of [-1, 1]) {
    B.add(box(0.5, 0.035, 6.6), paint, [sx * 1.5, 1.2, 0.05]);
    if (lod < 2) {
      for (const z of [-1.2, 0.2, 1.6]) stowBox(K, B, paint, S, [sx * 1.5, 1.42, z], [0.46, 0.4, 1.1], lod);
      B.add(box(0.5, 0.3, 0.03), S.rubber, [sx * 1.5, 1.05, -3.3]);
      if (lod === 0) for (const z of [-2.6, 2.9]) B.add(box(0.04, 0.2, 0.04), S.dark, [sx * 1.73, 1.12, z]);
    }
  }
  if (lod < 2) {
    // Glacis: Ersatzkettenglieder, Scheinwerfer, Abschleppösen, Fahrer-Winkelspiegel; Heck: Gitter, Auspuff, Leuchten
    spareLinks(K, B, S, [-0.5, 1.28, -2.94], 6, 0.5, 0.18, [-0.47, 0, 0], lod, [0.2, 0, 0]);
    for (let i = -1; i <= 1; i++) B.add(box(0.13, 0.08, 0.1), S.optic, [-0.55 + i * 0.19, 1.58, -2.58], [0, -i * 0.3, 0]);
    for (const sx of [-1, 1]) B.add(new THREE.TorusGeometry(0.075, 0.024, 4, 8), S.dark, [sx * 0.9, 0.82, -3.47], [0, HP, 0]);
    B.add(box(2.2, 0.05, 1.5), S.dark, [0, 1.585, 2.05]);
    if (lod === 0) for (let i = 0; i < 8; i++) B.add(box(2.1, 0.04, 0.05), paint, [0, 1.61, 1.4 + i * 0.18]);
    B.add(box(1.6, 0.36, 0.04), S.dark, [0, 1.2, 3.42]);
    for (const sx of [-1, 1]) { B.add(box(0.12, 0.08, 0.04), S.rearLamp, [sx * 1.25, 1.3, 3.42]); B.add(cyl(0.09, 0.09, 0.2, 10), S.dark, [sx * 0.6, 1.1, 3.45], [HP, 0, 0]); }
    for (const sx of [-1, 1]) jerrycan(K, B, paint, S, [sx * 0.95, 1.83, 3.05], 0, lod);
  }
  for (const L of D.lights) guardedLamp(K, B, S, L, 0.1, lod);
  if (HQ && lod < 2) {
    for (const sx of [-1, 1]) towCable(K, B, S, [[sx * 1.27, 1.6, -2.1], [sx * 1.29, 1.58, -0.6], [sx * 1.28, 1.6, 0.9]], lod);
    weld(K, B, paint, [[-1.2, 1.55, -2.35], [1.2, 1.55, -2.35]], lod);
    weld(K, B, paint, [[-1.2, 0.98, -3.48], [1.2, 0.98, -3.48]], lod);
    for (const sx of [-1, 1]) weld(K, B, paint, [[sx * 1.22, 1.56, -2.3], [sx * 1.22, 1.58, 2.85]], lod);
  }
  if (lod === 0) { B.add(box(0.05, 0.08, 1.3), S.wood, [0.6, 1.6, -1.6]); B.add(box(0.22, 0.02, 0.28), S.dark, [0.6, 1.6, -0.95]); B.add(cyl(0.014, 0.014, 1.2, 6), S.dark, [0.85, 1.6, -1.5], [HP, 0, 0]); }
  for (const sx of [-1, 1]) B.add(cyl(0.2, 0.2, 0.02, seg), mark, [sx * 1.73, 1.42, 1.6], [0, 0, HP]);
  // Laufwerk: 6 Laufrollen, 3 Stützrollen, Leitrad vorn, Triebrad hinten
  for (const sx of [-1, 1]) {
    const x = sx * W.x;
    if (lod < 2) { roadWheels(K, B, S, paint, x, W.radius, D.roadZ, W.radius, lod); returnRollers(K, B, S, x, 0.83, [-1.9, -0.3, 1.3], 0.09, lod, sx); }
    else for (const z of [-1.8, 0, 1.8]) B.add(cyl(W.radius, W.radius, 0.42, seg), S.rubber, [x, W.radius, z], [0, 0, HP]);
    idler(K, B, S, paint, x, 0.55, -3.02, 0.28, 0.46, lod);
    sprocket(K, B, S, paint, x, 0.58, 2.96, 0.3, 0.48, 12, lod);
  }
  B.build(hull, { shadow: true });
  K.addTracks(hull, K.trackPathFor(lod, -2.45, 2.45, [-3.02, 0.55, 0.28], [2.96, 0.58, 0.3], [[1.3, 0.92], [-0.3, 0.92], [-1.9, 0.92]], 0.014), W.x, 0.56);
  K.addLenses(hull, D, seg, 0.085);

  // Gussturm (rund, nach hinten zum Heckwulst gestreckt), Kuppel, Entfernungsmesser-Köpfe, Nebelwurfbecher, Staukorb
  const tur = new THREE.Group();
  const T = new Bucket();
  castTurret(K, T, paint, [[0, 1.12, 1.5, 1.45], [0.32, 1.16, 1.45, 1.55], [0.6, 0.98, 1.1, 1.35], [0.78, 0.7, 0.75, 1.0]], lod, { bustle: 0.25, rTop: 0.14 });
  T.add(cyl(1.0, 1.02, 0.1, seg + 4), S.dark, [0, -0.03, 0]);
  if (lod < 2) {
    for (const sx of [-1, 1]) {
      T.add(cyl(0.08, 0.08, 0.12, 10), paint, [sx * 1.12, 0.48, -0.2], [0, 0, HP]);             // Stereo-Entfernungsmesser
      T.add(cyl(0.06, 0.06, 0.02, 10), S.optic, [sx * 1.185, 0.48, -0.2], [0, 0, HP]);
      smokeRack(K, T, S, paint, sx * 0.98, 0.52, 0.45, 4, sx, lod, { up: 0.6 });
    }
    T.add(box(0.36, 0.2, 0.42), paint, [0.6, 0.82, -0.75]);                                   // Richtschützen-Optikhaube
    T.add(box(0.28, 0.12, 0.02), S.optic, [0.6, 0.83, -0.97]);
    T.add(cyl(0.3, 0.3, 0.04, seg), S.dark, [0.55, 0.79, 0.4]);                                 // Ladeschützenluke (Ring)
    // Staukorb am Heck
    T.add(box(1.9, 0.04, 0.45), S.dark, [0, 0.2, 1.72]);
    for (const sx of [-1, 0, 1]) T.add(box(0.035, 0.36, 0.035), S.dark, [sx * 0.95, 0.38, 1.93]);
    T.add(box(1.9, 0.035, 0.035), S.dark, [0, 0.56, 1.93]);
    if (lod === 0) { T.add(box(0.8, 0.3, 0.38), S.canvas, [-0.45, 0.36, 1.72]); T.add(cyl(0.11, 0.11, 0.8, 10), S.canvas, [0.5, 0.33, 1.72], [0, 0, HP]); }
    antenna(K, T, S, [-0.6, 0.7, 1.2], lod === 0 ? 2.3 : 1.5, lod);
    antenna(K, T, S, [0.65, 0.68, 1.25], lod === 0 ? 2.0 : 1.3, lod);
    if (lod === 0) for (const [x, z] of [[-0.95, -0.6], [0.95, -0.6], [-0.85, 1.05], [0.85, 1.05]]) T.add(new THREE.TorusGeometry(0.05, 0.015, 4, 8), S.dark, [x, 0.64, z], [0, HP, 0]);
  }
  // Kommandantenkuppel (Grundring; Kuppel selbst = cmg)
  T.add(cyl(0.42, 0.44, 0.08, seg), paint, [D.cmgPivot[0], 0.85, D.cmgPivot[2]]);
  for (const sx of [-1, 1]) T.add(cyl(0.17, 0.17, 0.02, seg), mark, [sx * 1.13, 0.3, 0.6], [0, 0, HP]);
  const turLod = new THREE.Group();
  T.build(turLod, { off: D.turretPivot });
  tur.add(turLod);

  // Kanone: gegossene Blende, 105 mm mit Wärmeschutzhülle und Rauchabsauger, IR-Suchscheinwerfer, Laser-Entfernungsmesser
  const gun = new THREE.Group();
  const G = new Bucket();
  if (HQ && lod < 2) G.add(armorShell(stackRings([[-0.32, [[-0.5, 0.25], [0.5, 0.25], [0.52, -0.2], [-0.52, -0.2]]], [0.32, [[-0.46, 0.2], [0.46, 0.2], [0.48, -0.2], [-0.48, -0.2]]]], { r: 0.07, rTop: 0.08, rBot: 0.08 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0, cast: true, castAmp: 0.008 }), paint, [0, 0, -0.02], [-HP, 0, 0]);
  else G.add(box(1.0, 0.62, 0.45), paint, [0, 0, -0.02]);
  G.add(cyl(0.16, 0.19, 0.22, seg), paint, [0, 0, -0.32], [HP, 0, 0]);
  G.add(cyl(0.08, 0.08, 4.6, seg), paint, [0, 0, -2.75], [HP, 0, 0]);
  G.add(cyl(0.128, 0.128, 0.7, seg), paint, [0, 0, -2.6], [HP, 0, 0]);                       // Rauchabsauger
  for (const z of lod < 2 ? [-1.0, -1.7, -3.5, -4.3] : []) G.add(cyl(0.092, 0.092, 0.05, 12), S.dark, [0, 0, z], [HP, 0, 0]);
  G.add(cyl(0.095, 0.1, 0.16, seg), S.dark, [0, 0, -5.0], [HP, 0, 0]);
  // IR-Suchscheinwerfer (Trommel mit dunklem Filter) über der Blende
  if (lod < 2) {
    G.add(box(0.1, 0.18, 0.12), S.dark, [0, 0.38, -0.15]);
    G.add(cyl(0.24, 0.24, 0.34, seg), paint, [0, 0.62, -0.18], [HP, 0, 0]);
    G.add(cyl(0.21, 0.21, 0.03, seg), S.optic, [0, 0.62, -0.36], [HP, 0, 0]);
    if (lod === 0) { G.add(new THREE.TorusGeometry(0.235, 0.012, 4, 20), S.dark, [0, 0.62, -0.355]); for (let i = 0; i < 3; i++) G.add(box(0.46, 0.012, 0.012), S.dark, [0, 0.52 + i * 0.1, -0.37]); }
    G.add(box(0.2, 0.16, 0.34), S.dark, [0.42, 0.18, -0.25]);                                 // Laser-Entfernungsmesser (Nachrüstung)
    G.add(box(0.07, 0.07, 0.02), S.optic, [0.42, 0.2, -0.425]);
  }
  G.add(box(0.1, 0.08, 0.2), S.dark, [D.coax[0], D.coax[1], -0.36]);
  const gunLod = new THREE.Group();
  G.build(gunLod, { off: [D.turretPivot[0] + D.gunPivot[0], D.turretPivot[1] + D.gunPivot[1], D.turretPivot[2] + D.gunPivot[2]] });
  gun.add(gunLod);

  // Kommandantenkuppel mit Sichtblöcken + schwerem MG (dreht mit dem Kommandanten)
  const cmg = new THREE.Group();
  const C = new Bucket();
  C.add(cyl(0.38, 0.4, 0.22, seg), paint, [0, -0.02, 0]);
  if (lod < 2) for (let i = 0; i < (lod === 0 ? 8 : 5); i++) { const a = (i / (lod === 0 ? 8 : 5)) * PI * 2; C.add(box(0.11, 0.07, 0.05), S.optic, [Math.sin(a) * 0.385, 0.0, Math.cos(a) * 0.385], [0, a, 0]); }
  C.add(sph(0.36, lod === 0 ? 14 : 8), paint, [0, 0.08, 0], null, [1, 0.3, 1]);
  C.add(box(0.12, 0.13, 0.5), S.dark, [0.12, 0.22, -0.2]);
  C.add(cyl(0.022, 0.022, 0.8, 8), S.dark, [0.12, 0.22, -0.8], [HP, 0, 0]);
  if (lod === 0) C.add(box(0.12, 0.14, 0.2), S.dark, [0.25, 0.18, -0.1]);
  const cmgLod = new THREE.Group();
  C.build(cmgLod, { shadow: lod < 2, off: [D.turretPivot[0] + D.cmgPivot[0], D.turretPivot[1] + D.cmgPivot[1], D.turretPivot[2] + D.cmgPivot[2]] });
  cmg.add(cmgLod);
  return { hull, tur, gun, cmg };
}

/* ===================================================================== MP-43 Elch (2. WK, mittlerer Panzer) */

export function buildWK2M(lod, S, team, K) {
  K.setLod(lod);
  const D = K.VEHICLES.wk2m, W = D.wheels, DET = K.DET, HQ = K.HQ;
  const { box, cyl, sph, Bucket } = K;
  const seg = [18, 10, 6][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  hullShell(K, B, paint, [[2.85, 0.42], [3.05, 0.9], [-2.95, 0.92], [-2.78, 0.42]], 1.9, lod, { r: 0.05, rs: 0.05 });
  // Oberwanne mit stark geneigten Bug-, Seiten- und Heckplatten
  hullShell(K, B, paint, [[3.08, 0.88], [1.75, 1.5], [-2.55, 1.52], [-3.0, 0.98], [-3.0, 0.88]], 3.0, lod, { r: 0.04, rs: 0.04, tuck: 0.42 });
  if (lod < 2) {
    // Fahrerluke in der Bugplatte (fest) mit zwei Winkelspiegeln, Kugelblende des Bug-MG
    B.add(box(0.55, 0.05, 0.6), paint, [-0.5, 1.29, -2.32], [-1.07, 0, 0]);
    for (const dx of [-0.14, 0.14]) B.add(box(0.12, 0.06, 0.08), S.optic, [-0.5 + dx, 1.45, -2.08], [-1.07, 0, 0]);
    if (lod === 0) for (const dx of [-0.3, 0.3]) B.add(cyl(0.025, 0.025, 0.12, 8), S.dark, [-0.5 + dx, 1.5, -2.0], [0, 0, HP]);
    B.add(sph(0.16, seg), paint, [D.cmgPivot[0], D.cmgPivot[1], D.cmgPivot[2] + 0.04]);
    // Ersatzkettenglieder, Haltegriffe für Aufsitzer, Zusatztanks am Heck, Lüftergitter, Auspuffrohre
    spareLinks(K, B, S, [0.15, 1.03, -2.75], 3, 0.48, 0.2, [-1.07, 0, 0], lod, [0.5, 0, 0]);
    for (const sx of [-1, 1]) {
      B.add(cyl(0.2, 0.2, 0.75, Math.max(8, seg)), S.dark, [sx * 1.25, 1.35, 1.6], [HP, 0, 0]);        // Zusatztank
      if (lod === 0) for (const dz of [-0.25, 0.25]) B.add(new THREE.TorusGeometry(0.205, 0.012, 4, 14), S.dark, [sx * 1.25, 1.35, 1.6 + dz]);
      B.add(cyl(0.065, 0.075, 0.22, 10), S.dark, [sx * 0.55, 1.08, 2.95], [HP + 0.3, 0, 0]);
      if (lod === 0) for (const z of [-1.3, -0.4, 0.5]) B.add(box(0.03, 0.06, 0.3), S.dark, [sx * 1.14, 1.42, z]);
    }
    B.add(box(1.5, 0.05, 0.9), S.dark, [0, 1.525, 1.95]);
    if (lod === 0) for (let i = 0; i < 6; i++) B.add(box(1.4, 0.035, 0.05), paint, [0, 1.55, 1.58 + i * 0.15]);
    B.add(box(1.0, 0.5, 0.06), paint, [0, 1.15, 2.92], [0.75, 0, 0]);                          // runde Heckklappe (Getriebe)
  }
  for (const L of D.lights) guardedLamp(K, B, S, L, 0.08, lod, { guard: false });
  if (HQ && lod < 2) {
    for (const sx of [-1, 1]) towCable(K, B, S, [[sx * 1.15, 1.25, -1.6], [sx * 1.2, 1.2, -0.2], [sx * 1.15, 1.25, 1.0]], lod, 0.024);
    weld(K, B, paint, [[-1.0, 1.5, -1.75], [1.0, 1.5, -1.75]], lod, 0.014);
    weld(K, B, paint, [[-1.25, 0.9, -3.05], [1.25, 0.9, -3.05]], lod, 0.014);
    for (const sx of [-1, 1]) weld(K, B, paint, [[sx * 1.06, 1.5, -1.7], [sx * 1.06, 1.52, 2.5]], lod, 0.014);
  }
  if (lod === 0) { B.add(box(0.05, 0.05, 1.0), S.wood, [-1.18, 1.28, -0.2]); B.add(box(0.2, 0.03, 0.12), S.dark, [-1.18, 1.28, -0.75]); }
  for (const sx of [-1, 1]) B.add(cyl(0.2, 0.2, 0.02, seg), mark, [sx * 1.31, 1.2, 0.3], [0, 0, -sx * 0.99]); // auf der geneigten Seitenplatte
  // Federlaufwerk: fünf große Laufrollen, Triebrad hinten, Leitrad vorn, keine Stützrollen (Kette liegt auf)
  for (const sx of [-1, 1]) {
    const x = sx * W.x;
    if (lod < 2) roadWheels(K, B, S, paint, x, 0.41, D.roadZ, 0.41, lod);
    else for (const z of [-1.6, 0, 1.6]) B.add(cyl(0.41, 0.41, 0.42, seg), S.rubber, [x, 0.41, z], [0, 0, HP]);
    idler(K, B, S, paint, x, 0.5, -2.68, 0.3, 0.42, lod, 0);
    sprocket(K, B, S, paint, x, 0.55, 2.62, 0.32, 0.44, 6, lod);
  }
  B.build(hull, { shadow: true });
  K.addTracks(hull, K.trackPathFor(lod, -2.15, 2.15, [-2.68, 0.5, 0.3], [2.62, 0.55, 0.32], D.roadZ.slice().reverse().map((z) => [z, 0.82]), 0.022), W.x, 0.5);
  K.addLenses(hull, D, seg, 0.065);

  // Gussturm (gerundet), zwei Dachluken, Kommandantenkuppel, Lüfterhauben, Haltegriffe
  const tur = new THREE.Group();
  const T = new Bucket();
  castTurret(K, T, paint, [[0, 0.98, 1.25, 1.15], [0.3, 1.02, 1.2, 1.2], [0.58, 0.86, 0.95, 1.05], [0.74, 0.62, 0.6, 0.8]], lod, { bustle: 0.12, rTop: 0.12, castAmp: 0.012 });
  T.add(cyl(0.88, 0.9, 0.1, seg + 4), S.dark, [0, -0.03, 0]);
  T.add(cyl(0.3, 0.32, 0.22, seg), paint, [-0.4, 0.82, 0.5]);                                  // Kuppel
  if (lod < 2) {
    for (let i = 0; i < (lod === 0 ? 5 : 3); i++) { const a = (i / 5) * PI * 2; T.add(box(0.1, 0.06, 0.05), S.optic, [-0.4 + Math.sin(a) * 0.31, 0.86, 0.5 + Math.cos(a) * 0.31], [0, a, 0]); }
    T.add(cyl(0.26, 0.26, 0.04, seg), S.dark, [0.42, 0.74, 0.4]);
    for (const x of [-0.25, 0.25]) T.add(sph(0.11, 10), paint, [x, 0.73, 0.95], null, [1, 0.45, 1]);  // Lüfterhauben
    for (const sx of [-1, 1]) T.add(cyl(0.018, 0.018, 1.3, 6), S.dark, [sx * 1.02, 0.42, 0.1], [HP, 0, 0]); // Haltegriffe
    if (lod === 0) for (const sx of [-1, 1]) for (const z of [-0.45, 0.65]) T.add(box(0.03, 0.06, 0.03), S.dark, [sx * 1.0, 0.42, z]);
    T.add(box(0.12, 0.12, 0.12), S.dark, [0.35, 0.73, -0.55]);                                  // Winkelspiegel Richtschütze
    antenna(K, T, S, [0.75, 0.55, 0.5], lod === 0 ? 1.6 : 1.1, lod);
    if (lod === 0) for (const [x, z] of [[-0.8, -0.5], [0.8, -0.5], [-0.7, 0.85], [0.7, 0.85]]) T.add(new THREE.TorusGeometry(0.045, 0.014, 4, 8), S.dark, [x, 0.6, z], [0, HP, 0]);
  }
  for (const sx of [-1, 1]) T.add(cyl(0.17, 0.17, 0.02, seg), mark, [sx * 1.02, 0.3, 0.2], [0, 0, HP]);
  const turLod = new THREE.Group();
  T.build(turLod, { off: D.turretPivot });
  tur.add(turLod);

  // 85-mm-Kanone: Gussblende (gewölbt), langes Rohr ohne Mündungsbremse, Koax-MG
  const gun = new THREE.Group();
  const G = new Bucket();
  if (HQ && lod < 2) G.add(armorShell(stackRings([[-0.28, [[-0.44, 0.2], [0.44, 0.2], [0.46, -0.16], [-0.46, -0.16]]], [0.28, [[-0.4, 0.17], [0.4, 0.17], [0.42, -0.17], [-0.42, -0.17]]]], { r: 0.06, rTop: 0.07, rBot: 0.07 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0, cast: true, castAmp: 0.01 }), paint, [0, 0, -0.05], [-HP, 0, 0]);
  else G.add(box(0.88, 0.54, 0.34), paint, [0, 0, -0.05]);
  G.add(cyl(0.12, 0.14, 0.4, seg), paint, [0, 0, -0.4], [HP, 0, 0]);
  G.add(cyl(0.065, 0.058, 4.0, seg), paint, [0, 0, -2.6], [HP, 0, 0]);
  G.add(cyl(0.072, 0.072, 0.07, seg), S.dark, [0, 0, -4.6], [HP, 0, 0]);
  G.add(cyl(0.02, 0.02, 0.22, 6), S.dark, [D.coax[0], D.coax[1], -0.3], [HP, 0, 0]);
  const gunLod = new THREE.Group();
  G.build(gunLod, { off: [D.turretPivot[0] + D.gunPivot[0], D.turretPivot[1] + D.gunPivot[1], D.turretPivot[2] + D.gunPivot[2]] });
  gun.add(gunLod);

  // Bug-MG in der Kugelblende
  const cmg = new THREE.Group();
  const C = new Bucket();
  C.add(sph(0.12, seg), paint, [0, 0, -0.06]);
  C.add(cyl(0.03, 0.03, 0.32, 8), S.dark, [0, 0, -0.28], [HP, 0, 0]);
  if (lod < 2) C.add(cyl(0.014, 0.014, 0.5, 6), S.dark, [0, 0, -0.42], [HP, 0, 0]);
  const cmgLod = new THREE.Group();
  C.build(cmgLod, { shadow: lod < 2, off: D.cmgPivot });
  cmg.add(cmgLod);
  return { hull, tur, gun, cmg };
}

/* ===================================================================== JP-44 Stier (2. WK, Jagdpanzer) */

export function buildWK2J(lod, S, team, K) {
  K.setLod(lod);
  const D = K.VEHICLES.wk2j, W = D.wheels, DET = K.DET, HQ = K.HQ;
  const { box, cyl, Bucket } = K;
  const seg = [18, 10, 6][lod];
  const paint = S.paint[team] || S.paint.null, mark = S.mark[team] || S.mark.null;
  const hull = new THREE.Group();
  const B = new Bucket();
  hullShell(K, B, paint, [[2.9, 0.42], [3.12, 0.82], [-2.95, 0.88], [-2.8, 0.42]], 1.78, lod, { r: 0.05, rs: 0.05 });
  // Kasematte: Bugplatte ~60°, Dach, abfallendes Motordeck, Seiten 40° geneigt
  hullShell(K, B, paint, [[3.14, 0.8], [1.35, 1.82], [-1.55, 1.86], [-1.75, 1.62], [-2.85, 1.45], [-3.0, 0.86], [-2.95, 0.8]], 2.72, lod, { r: 0.045, rs: 0.045, tuck: 0.38 });
  if (lod < 2) {
    // Fahrer-Sehschlitze, Dachluken, Rundumfeuer-MG-Sockel, Scherenfernrohr-Klappe, Motorgitter, Auspuff, Werkzeug
    for (const dx of [-0.12, 0.12]) B.add(box(0.12, 0.04, 0.05), S.optic, [-0.6 + dx, 1.55, -1.82], [-1.03, 0, 0]);
    B.add(cyl(0.26, 0.26, 0.05, seg), S.dark, [0.45, 1.86, -0.35]);
    B.add(box(0.45, 0.04, 0.5), paint, [-0.45, 1.885, 0.3]);
    B.add(box(0.2, 0.12, 0.2), S.dark, [0.2, 1.92, -1.15]);                                     // Sfl-Zielfernrohr (Kopf)
    B.add(box(0.14, 0.06, 0.02), S.optic, [0.2, 1.93, -1.255]);
    B.add(box(1.4, 0.04, 0.9), S.dark, [0, 1.56, -2.25 + 4.3]);
    if (lod === 0) for (let i = 0; i < 6; i++) B.add(box(1.34, 0.03, 0.05), paint, [0, 1.58, 1.65 + i * 0.15], [-0.17, 0, 0]);
    B.add(cyl(0.11, 0.12, 0.6, 10), S.dark, [0.4, 1.32, 2.92], [0, 0, HP]);                     // Auspufftopf quer
    B.add(cyl(0.035, 0.035, 0.2, 8), S.dark, [0.75, 1.42, 2.92]);
    for (const sx of [-1, 1]) {
      B.add(box(0.5, 0.03, 0.45), paint, [sx * 1.05, 0.88, -3.0]);                              // Kotflügel vorn
      if (lod === 0) for (let i = 0; i < 4; i++) B.add(box(0.035, 0.12, 0.6), S.dark, [sx * 1.18, 1.02, -1.0 + i * 0.75]);  // Schürzenhalter
    }
    // Ersatzkettenglieder am Heck, Wagenheber, Kanister
    spareLinks(K, B, S, [-0.9, 1.15, 2.98], 5, 0.36, 0.14, [0.6, 0, 0], lod, [0.45, 0, 0]);
    jerrycan(K, B, paint, S, [-1.1, 1.62, 2.4], HP, lod);
  }
  for (const L of D.lights) guardedLamp(K, B, S, L, 0.075, lod, { guard: false });
  if (HQ && lod < 2) {
    for (const sx of [-1, 1]) towCable(K, B, S, [[sx * 1.08, 1.32, -1.4], [sx * 1.12, 1.28, 0.0], [sx * 1.08, 1.32, 1.3]], lod);
    weld(K, B, paint, [[-0.92, 1.82, -1.35], [0.92, 1.82, -1.35]], lod, 0.013);
    weld(K, B, paint, [[-1.28, 0.82, -3.1], [1.28, 0.82, -3.1]], lod, 0.013);
    for (const sx of [-1, 1]) weld(K, B, paint, [[sx * 0.98, 1.82, -1.3], [sx * 0.98, 1.86, -1.55]], lod, 0.013);
  }
  if (lod === 0) { B.add(box(0.05, 0.05, 1.0), S.wood, [1.0, 1.45, 0.4], [0, 0, -0.7]); B.add(box(0.2, 0.03, 0.12), S.dark, [1.0, 1.45, -0.15], [0, 0, -0.7]); }
  for (const sx of [-1, 1]) B.add(cyl(0.2, 0.2, 0.02, seg), mark, [sx * 1.18, 1.3, 0.2], [0, 0, sx * 0.4 + HP]);
  // Laufwerk: vier große Laufrollen, eine Stützrolle, Triebrad vorn, Leitrad hinten
  for (const sx of [-1, 1]) {
    const x = sx * W.x;
    if (lod < 2) { roadWheels(K, B, S, paint, x, 0.39, D.roadZ, 0.39, lod); returnRollers(K, B, S, x, 0.86, [0.0], 0.08, lod, sx); }
    else for (const z of [-1.3, 1.3]) B.add(cyl(0.39, 0.39, 0.38, seg), S.rubber, [x, 0.39, z], [0, 0, HP]);
    sprocket(K, B, S, paint, x, 0.62, -2.62, 0.3, 0.38, 10, lod);
    idler(K, B, S, paint, x, 0.52, 2.62, 0.28, 0.36, lod, 6);
  }
  B.build(hull, { shadow: true });
  K.addTracks(hull, K.trackPathFor(lod, -2.0, 2.0, [-2.62, 0.62, 0.3], [2.62, 0.52, 0.28], [[0, 0.94]], 0.02), W.x, 0.36);
  K.addLenses(hull, D, seg, 0.06);

  // „Turm“ = gegossene Topfblende in der Bugplatte (schwenkt ±11°)
  const tur = new THREE.Group();
  const T = new Bucket();
  if (HQ && lod < 2) T.add(armorShell(stackRings([[-0.32, castFoot(0.34, 0.3, 0.3, 12)], [-0.05, castFoot(0.4, 0.36, 0.36, 12)], [0.22, castFoot(0.3, 0.26, 0.3, 12)]], { cast: true, rTop: 0.1 }), { levels: lod === 0 ? (DET === 2 ? 2 : 1) : 0, cast: true, castAmp: 0.01 }), paint, [0, 0, -0.05]);
  else T.add(K.sph(0.38, seg), paint, [0, 0, -0.05], null, [1, 0.8, 0.9]);
  const turLod = new THREE.Group();
  T.build(turLod, { off: D.turretPivot });
  tur.add(turLod);

  // 75-mm-Kanone: Saukopf-Rohrblende (konisch), langes Rohr, Mündung
  const gun = new THREE.Group();
  const G = new Bucket();
  G.add(cyl(0.11, 0.28, 0.6, seg), paint, [0, 0, -0.48], [HP, 0, 0]);
  G.add(cyl(0.06, 0.052, 3.0, seg), paint, [0, 0, -2.25], [HP, 0, 0]);
  G.add(cyl(0.064, 0.064, 0.09, seg), S.dark, [0, 0, -3.7], [HP, 0, 0]);
  if (lod < 2) G.add(cyl(0.07, 0.07, 0.04, seg), S.dark, [0, 0, -0.85], [HP, 0, 0]);
  const gunLod = new THREE.Group();
  G.build(gunLod, { off: [D.turretPivot[0] + D.gunPivot[0], D.turretPivot[1] + D.gunPivot[1], D.turretPivot[2] + D.gunPivot[2]] });
  gun.add(gunLod);

  // Dach-MG mit Schutzschild (ferngerichtet vom Ladeschützen)
  const cmg = new THREE.Group();
  const C = new Bucket();
  C.add(cyl(0.05, 0.06, 0.18, 8), S.dark, [0, -0.08, 0.05]);
  C.add(box(0.1, 0.12, 0.55), S.dark, [0, 0.04, -0.12]);
  C.add(cyl(0.016, 0.016, 0.55, 6), S.dark, [0, 0.05, -0.65], [HP, 0, 0]);
  if (lod < 2) { C.add(box(0.42, 0.3, 0.02), paint, [0, 0.04, -0.3], [0.1, 0, 0]); C.add(box(0.1, 0.12, 0.14), S.dark, [0.1, 0.0, -0.05]); }
  const cmgLod = new THREE.Group();
  C.build(cmgLod, { shadow: lod < 2, off: D.cmgPivot });
  cmg.add(cmgLod);
  return { hull, tur, gun, cmg };
}

/* ===================================================================== Kampfraum der Schützen (SZ-8, Wannenraum) */

/**
 * Kampfraum hinter dem Turmkorb: Sitzbänke längs (Polster, Gurte), Waffenhalter, Funkgerät, Rampe mit Tür und Winkelspiegel,
 * Dachluken, Deckenleuchten, Leitungen, Feuerlöscher, Wasserkanister, Gepäcknetze. Wird an hullInterior gehängt (sichtbar mit
 * dem Innenraum). D.troop: { z0, z1, floor, roof, halfW }.
 */
export function buildTroop(K, S, D) {
  const { box, cyl, Bucket } = K, T = D.troop, grp = new THREE.Group();
  grp.name = 'troopInterior';
  const B = new Bucket(), CAB = S.cabin;
  const { z0, z1, floor: yF, roof: yR, halfW: wx } = T;
  // Raum (nach innen gekehrt) – Boden, Wände, Decke; Rückwand = Rampe
  B.add(K.inward(K.topExtrude([[-wx, -z0], [wx, -z0], [wx, -z1], [-wx, -z1]], yR - yF)), CAB, [0, yF, 0]);
  B.add(box(wx * 2 - 0.1, 0.02, z1 - z0 - 0.1), S.dark, [0, yF + 0.01, (z0 + z1) / 2]);
  for (let z = z0 + 0.25; z < z1 - 0.1; z += 0.3) B.add(box(wx * 2 - 0.2, 0.006, 0.02), S.steel, [0, yF + 0.023, z]);
  // Bänke beidseitig mit Polstern, Rückenpolster, Gurte
  for (const sx of [-1, 1]) {
    const bx = sx * (wx - 0.25);
    B.add(box(0.42, 0.05, z1 - z0 - 0.5), S.steel, [bx, yF + 0.42, (z0 + z1) / 2 - 0.05]);
    B.add(box(0.38, 0.08, z1 - z0 - 0.55), S.canvas, [bx, yF + 0.48, (z0 + z1) / 2 - 0.05]);
    B.add(box(0.06, 0.45, z1 - z0 - 0.6), S.canvas, [sx * (wx - 0.04), yF + 0.82, (z0 + z1) / 2 - 0.05]);
    for (let k = 0; k < 2; k++) {
      const zz = z0 + 0.55 + k * 1.05;
      for (const dz of [-0.15, 0.15]) B.add(box(0.04, 0.6, 0.012), S.canvas, [sx * (wx - 0.08), yF + 0.78, zz + dz], [0, 0, sx * 0.12]);
      B.add(box(0.06, 0.6, 0.06), S.dark, [sx * (wx - 0.06), yF + 0.95, zz + 0.45]);            // Waffenhalter
      B.add(box(0.05, 0.08, 0.05), S.rubber, [sx * (wx - 0.08), yF + 1.2, zz + 0.45]);
    }
    for (let i = 0; i < 4; i++) B.add(box(0.03, 0.03, 0.03), S.steel, [bx, yF + 0.2, z0 + 0.4 + i * 0.6]);
    B.add(box(0.05, 0.05, z1 - z0 - 0.3), S.steel, [bx, yF + 0.22, (z0 + z1) / 2]);
    // Gepäcknetz oben, Leitungen
    B.add(box(0.3, 0.012, z1 - z0 - 0.6), S.canvas, [sx * (wx - 0.18), yR - 0.18, (z0 + z1) / 2]);
    B.add(cyl(0.018, 0.018, z1 - z0 - 0.2, 6), S.rubber, [sx * (wx - 0.05), yR - 0.08, (z0 + z1) / 2], [HP, 0, 0]);
    B.add(cyl(0.012, 0.012, z1 - z0 - 0.2, 6), S.steel, [sx * (wx - 0.08), yR - 0.06, (z0 + z1) / 2], [HP, 0, 0]);
  }
  // Rampe hinten: Türblatt, Tür mit Winkelspiegel und Griff, Hydraulikzylinder
  B.add(box(wx * 2 - 0.05, yR - yF - 0.05, 0.04), S.steel, [0, (yF + yR) / 2, z1 - 0.03]);
  B.add(box(0.6, 0.95, 0.03), S.dark, [0.4, yF + 0.6, z1 - 0.06]);
  B.add(box(0.12, 0.04, 0.12), S.dark, [0.6, yF + 0.6, z1 - 0.1]);
  B.add(box(0.14, 0.08, 0.06), S.optic, [0.4, yF + 1.0, z1 - 0.08]);
  for (const sx of [-1, 1]) B.add(cyl(0.035, 0.035, 0.7, 8), S.steel, [sx * (wx - 0.15), yF + 0.6, z1 - 0.35], [0.9, 0, 0]);
  // Dachluken (Innenseite), Winkelspiegel der Schützen, Deckenleuchten, Funkgerät, Löscher, Kanister, Munitionskisten
  for (const sx of [-1, 1]) {
    B.add(box(0.6, 0.02, 1.2), S.steel, [sx * 0.48, yR - 0.012, (z0 + z1) / 2 + 0.3]);
    B.add(box(0.03, 0.06, 0.2), S.dark, [sx * 0.7, yR - 0.05, (z0 + z1) / 2 + 0.3]);
    for (const z of [z0 + 0.35, z0 + 1.85]) B.add(box(0.12, 0.1, 0.16), S.dark, [sx * (wx - 0.12), yR - 0.07, z]);
  }
  for (const z of [z0 + 0.5, z1 - 0.5]) { B.add(box(0.14, 0.04, 0.08), S.dark, [0, yR - 0.02, z]); B.add(box(0.1, 0.012, 0.05), S.lensOn, [0, yR - 0.042, z]); }
  B.add(box(0.36, 0.3, 0.28), S.dark, [-0.25, yF + 0.17, z0 + 0.2]);
  for (let i = 0; i < 4; i++) B.add(box(0.02, 0.012, 0.012), i % 2 ? S.lensOn : S.rubber, [-0.2 + i * 0.03, yF + 0.26, z0 + 0.345]);
  B.add(cyl(0.06, 0.06, 0.4, 10), S.red, [0.35, yF + 0.22, z0 + 0.15]);
  for (let i = 0; i < 2; i++) B.add(box(0.3, 0.2, 0.16), S.dark, [0.0, yF + 0.12, z0 + 0.6 + i * 0.5]);
  B.build(grp, { shadow: false });
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return grp;
}

/** Bauer je Modell-Schlüssel (models.js TANK_BUILDERS). */
export const NEW_TANK_BUILDERS = { spz: buildSPZ, kk: buildKK, wk2m: buildWK2M, wk2j: buildWK2J };
