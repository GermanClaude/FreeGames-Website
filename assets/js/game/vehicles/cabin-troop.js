// NULLPUNKT — Mannschaftsraum der Schützen im Detail (Nutzer 21.11.: „Mannschaftsraum sehr grob: untexturierte Kastenbänke,
// schwarzer Boden mit weißen Streifen …“; Schützenpanzer „karg“). Baut für cabin.js (gleiche Sammel-Buckets, Innenraum-
// Materialien mit Innenlicht und Gebrauchsspuren, gebackene Verdeckung) den Kampfraum hinter dem Fahrer/Turm:
//   Raumschale (gerundet, vorn optional mit Durchgang zur Fahrerkabine), Riffelblechboden mit Schweißnähten,
//   gepolsterte Sitzbänke (Sitz- und Rückenkissen je Platz, Vierpunkt-Gurte mit Schloss, Klappgestell, Taschen und
//   Munitionskästen darunter), Waffenhalter mit Gummiklemmen und eingesteckten Gewehren, Funkgerät mit Hörer und
//   Spiralkabel, Kabelbäume/Leitungen mit Schellen, Gepäcknetze, Deckenleuchten (echte Lichtquellen), Haltegriffe,
//   Dachlukendeckel (Innenseite), Heckrampe von innen (Rahmen, Versteifungen, Tür mit Winkelspiegel und Griff,
//   Haltegriffe, Hydraulikzylinder, Scharniere), Feuerlöscher, Wasserkanister, Verbandkasten, Schilder/Schablonen.
// Frei erfunden; Maße aus D.troop { z0, z1, floor, roof, halfW } (Wannenraum).
//
// buildTroopRoom(B, C, det, D, K, cab, { era, frontDoor }) – K: Helfer aus cabin.js (Frame, part, label, stencil,
// harness, extinguisher, box, rbox, cyl, tor). frontDoor: [x0, x1, y0, y1] Öffnung in der Stirnwand (Fahrerkabine).
import * as THREE from 'three';
import * as SH from './cabin-shape.js?v=20261123115551';
import * as DT from './cabin-detail.js?v=20261123115551';
import * as BASE from './cabin-base.js?v=20261123115551';

/**
 * Sitzhöhe der Bänke über dem Boden (Oberkante Polster) – Proportionen 22.11.: echte Bänke 0,35–0,42 m; in niedrigen Räumen
 * tiefer (bis 0,28 m), damit ein sitzender 1,80-m-Soldat (Hüftgelenk → Scheitel ≈ 0,85 m, leicht vorgebeugt) unter das Dach
 * passt. Vorher 0,3 × Raumhöhe: im SZ-8 (1,02 m) stak der Kopf 0,27 m durchs Dach. cabin.js (Sitz-Anker) nutzt dieselbe Höhe.
 */
export function troopSeatH(T) {
  const H = T.roof - T.floor;
  return Math.max(0.28, Math.min(0.42, H - 0.9));
}

const PI = Math.PI, HP = PI / 2;
const Q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

/** Plätze der Schützen (geschlossener Kampfraum) je Seite: [{ x, z }] aus den Sitzdaten. */
function ridersOf(D) {
  return (D.seats || []).filter((s) => (s.passenger || /^schuetze/.test(s.id)) && !s.exposed).map((s) => ({ x: s.pos[0], z: s.pos[2] }));
}

export function buildTroopRoom(B, C, det, D, K, cab, { era = 'modern', frontDoor = null } = {}) {
  const T = D.troop;
  const { z0, z1, floor: yF, roof: yR, halfW: wx } = T;
  const W = C.wall[era] || C.wall.modern;
  const { box, rbox, cyl, tor, Frame } = K;
  const L = z1 - z0, zm = (z0 + z1) / 2, H = yR - yF;
  // ---- Raumschale (Stirnwand vorn ggf. mit Durchgang zur Fahrerkabine)
  B.add(SH.prism([[-wx, z0], [wx, z0], [wx, z1], [-wx, z1]], yF, yR, { rc: 0.08, r0: 0.04, r1: 0.06, bulge: 0.006, steps: det > 1 ? 4 : 2, arcSteps: det ? 3 : 1, axes: 'xzy', open: frontDoor && det ? [0] : null }), W);
  if (frontDoor && det) {
    const [a, b2, c0, c1] = frontDoor;
    B.add(SH.holeWall(-wx, wx, yF, yR, [[a, b2, c0, c1]]), W, [0, 0, z0 + 0.002]);
    for (const y of [yF + 0.006, yR - 0.006]) B.add(box(wx * 2, 0.012, 0.08), W, [0, y, z0 + 0.04]);
    for (const x of [-wx + 0.006, wx - 0.006]) B.add(box(0.012, H, 0.08), W, [x, (yF + yR) / 2, z0 + 0.04]);
    const F = new Frame(B, [(a + b2) / 2, (c0 + c1) / 2, z0 + 0.016], null), dw = b2 - a, dh = c1 - c0;
    for (const sx of [-1, 1]) F.add(box(0.045, dh + 0.06, 0.03), C.metal, [sx * (dw / 2 + 0.02), 0, 0]);
    for (const sy of [-1, 1]) F.add(box(dw + 0.08, 0.045, 0.03), C.metal, [0, sy * (dh / 2 + 0.02), 0]);
    F.add(cyl(0.012, 0.012, dw, 8), C.rubber, [0, -dh / 2, 0.02], [0, 0, HP]);
    K.label(F.w([0, dh / 2 + 0.08, 0.017]), null, 'kopf', 0.16);
  }
  // ---- Boden: Riffelblech in Feldern, Schweißnähte, Zurrösen
  B.add(box(wx * 2 - 0.06, 0.014, L - 0.08), C.floor, [0, yF + 0.007, zm]);
  if (det) {
    for (let z = z0 + 0.6; z < z1 - 0.3; z += 0.9) DT.weld(B, C.metal, [[-wx + 0.05, yF + 0.015, z], [wx - 0.05, yF + 0.015, z]]);
    for (const sx of [-1, 1]) for (let z = z0 + 0.4; z < z1 - 0.2; z += 0.8) B.add(tor(0.022, 0.006, 4, 10), C.steel, [sx * 0.32, yF + 0.02, z], [HP, 0, 0]);
  }
  // ---- Sitzbänke: Plätze aus den Sitzdaten (sonst gleichmäßig), Gestell durchgehend
  let riders = ridersOf(D);
  if (!riders.length) for (let z = z0 + 0.45; z < z1 - 0.4; z += 0.62) for (const sx of [-1, 1]) riders.push({ x: sx, z });
  const segLen = 0.5, sy = yF + troopSeatH(T);
  for (const sx of [-1, 1]) {
    const mine = riders.filter((r) => Math.sign(r.x) === sx).map((r) => r.z).sort((a, b) => a - b);
    if (!mine.length) continue;
    const bx = sx * (wx - 0.25), za = Math.max(z0 + 0.12, mine[0] - 0.3), zb = Math.min(z1 - 0.35, mine[mine.length - 1] + 0.3);
    // Gestell: zwei Längsholme, Beine mit Fußplatten, Klappscharniere an der Wand
    for (const dx of [-0.16, 0.14]) B.rod(C.steel, [bx + sx * dx, sy - 0.06, za], [bx + sx * dx, sy - 0.06, zb], 0.016, det ? 10 : 6);
    for (let z = za + 0.05; z <= zb - 0.04; z += Math.max(0.4, (zb - za - 0.1) / Math.max(1, Math.round((zb - za) / 0.6)))) {
      B.rod(C.steel, [bx - sx * 0.14, sy - 0.06, z], [bx - sx * 0.14, yF + 0.02, z], 0.014, 8);
      B.add(box(0.06, 0.008, 0.06), C.metal, [bx - sx * 0.14, yF + 0.017, z]);
      B.add(box(0.05, 0.08, 0.035), C.metal, [sx * (wx - 0.03), sy - 0.06, z]);
      B.rod(C.steel, [sx * (wx - 0.03), sy - 0.06, z], [bx + sx * 0.14, sy - 0.06, z], 0.012, 6);
    }
    mine.forEach((z, i) => {
      const seed = (i + (sx > 0 ? 3 : 0)) % 3;
      // Sitzkissen (gesteppt), Rückenkissen an der Wand, Kopfpolster
      B.add(box(0.4, 0.03, segLen - 0.02), C.metal, [bx, sy - 0.035, z]);
      B.add(rbox(0.4, 0.07, segLen - 0.04, 0.03, det > 1 ? 2 : 1), C.pad, [bx, sy, z]);
      if (det) DT.worn(B, 0.7, () => B.add(SH.quilt(0.26, segLen * 0.6, 0.004, { nx: 1, ny: 2, res: 3 }), C.pad, [bx, sy + 0.036, z], [-HP, 0, 0]));
      const backX = sx * (wx - 0.045);
      B.add(rbox(0.06, 0.4, segLen - 0.05, 0.025, det > 1 ? 2 : 1), C.pad, [backX, sy + 0.32, z], [0, 0, sx * 0.06]);
      B.add(rbox(0.05, 0.14, 0.24, 0.02), C.pad, [sx * (wx - 0.04), sy + 0.68, z]);
      if (det && seed === 1 && C.patch) B.add(SH.quilt(0.1, 0.08, 0.005, { nx: 1, ny: 1, res: 2 }), C.patch, [bx + sx * 0.06, sy + 0.037, z + 0.08], [-HP, 0, 0.3]);
      // Gurt: zwei Schultergurte von der Wand über das Rückenkissen, Beckengurt mit Schloss
      if (det) {
        for (const dz of [-0.1, 0.1]) {
          B.add(box(0.012, 0.46, 0.045), C.canvas, [sx * (wx - 0.08), sy + 0.36, z + dz], [0, 0, sx * 0.06]);
          B.add(box(0.03, 0.025, 0.05), C.steel, [sx * (wx - 0.04), sy + 0.6, z + dz]);
        }
        B.add(box(0.2, 0.006, 0.045), C.canvas, [bx + sx * 0.05, sy + 0.038, z - 0.02], [0, 0.2, 0]);
        DT.worn(B, 0.7, () => B.add(rbox(0.06, 0.016, 0.05, 0.005), C.steel, [bx - sx * 0.06, sy + 0.044, z - 0.04]));
        B.add(box(0.045, 0.006, 0.22), C.canvas, [bx - sx * 0.14, sy - 0.03, z - 0.12], [0.6, 0, 0]);
      }
      // unter der Bank: abwechselnd Munitionskasten und Tasche
      if (det && i % 2 === 0) BASE.crate(new DT.LF(B, [bx + sx * 0.02, yF + 0.01, z], Q(0, HP, 0)), Object.assign(Object.create(C), { wood: C.olive }), det, 0.28, 0.17, 0.16);
      else if (det) BASE.pouch(new DT.LF(B, [bx, yF + 0.01, z], Q(0, sx > 0 ? -HP : HP, 0)), C, det, 0.26, 0.2, 0.14);
      K.stencil([sx * (wx - 0.004), sy + 0.95, z], [0, -sx * HP, 0], 's_platz' + ((i % 4) + 1), 0.11);
    });
    // Waffenhalter zwischen den Plätzen: Wandschiene, zwei Gummiklemmen, eingestecktes Gewehr (Kolben unten)
    for (let i = 0; i < mine.length - 1; i++) {
      const z = (mine[i] + mine[i + 1]) / 2, x = sx * (wx - 0.06);
      B.add(box(0.03, 0.62, 0.04), C.metal, [x, sy + 0.42, z]);
      for (const y of [sy + 0.2, sy + 0.62]) B.add(rbox(0.06, 0.05, 0.07, 0.015), C.rubber, [x - sx * 0.035, y, z]);
      if (det && i % 2 === 0) {
        const gx = x - sx * 0.07;
        B.add(rbox(0.045, 0.24, 0.08, 0.012), C.black, [gx, sy + 0.1, z]);                       // Kolben
        B.add(box(0.04, 0.32, 0.05), C.black, [gx, sy + 0.38, z]);                               // Gehäuse
        B.add(box(0.035, 0.12, 0.04), C.black, [gx, sy + 0.32, z - 0.06], [0.25, 0, 0]);         // Magazin
        B.rod(C.steel, [gx, sy + 0.54, z], [gx, sy + 0.92, z], 0.009, 6);                         // Lauf
        B.add(box(0.012, 0.5, 0.012), C.canvas, [gx + sx * 0.022, sy + 0.38, z + 0.02]);         // Trageriemen
      }
    }
    // Gepäcknetz über den Plätzen (Rahmen + Netzstreifen), Haltegriffe an der Decke
    const ny = yR - 0.17, nx = sx * (wx - 0.17);
    B.rod(C.steel, [nx - sx * 0.12, ny, za], [nx - sx * 0.12, ny, zb], 0.008, 6);
    if (det) for (let z = za; z <= zb; z += 0.1) B.add(box(0.24, 0.004, 0.006), C.canvas, [nx, ny + 0.02, z], [0, 0, sx * 0.25]);
    if (det) BASE.pouch(new DT.LF(B, [nx, ny + 0.005, (za + zb) / 2], Q(0, sx > 0 ? -HP : HP, 0)), C, det, 0.34, 0.12, 0.16);
    for (let z = za + 0.2; z < zb; z += 0.9) BASE.grip(new DT.LF(B, [sx * 0.42, yR - 0.004, z], Q(HP, 0, 0)), C, det, 0.24);
    // Leitungen: Kabelbaum oben an der Wand, Rohr darunter, Schellen
    K.harness([[sx * (wx - 0.035), yR - 0.06, z0 + 0.1], [sx * (wx - 0.03), yR - 0.07, zm], [sx * (wx - 0.035), yR - 0.06, z1 - 0.15]], det, 2);
    BASE.pipe(B, C, det, [[sx * (wx - 0.04), yR - 0.13, z0 + 0.15], [sx * (wx - 0.04), yR - 0.13, zm], [sx * (wx - 0.04), yR - 0.13, z1 - 0.2]], 0.014, C.steel);
  }
  // Mittelgang-Kabelkanal an der Decke, Lüfter
  if (det) BASE.duct(B, C, det, [0, yR - 0.004, z0 + 0.3], [0, yR - 0.004, z1 - 0.4], [0, -1, 0], 0.09, 0.04);
  // ---- Deckenleuchten (echte Lichtquellen im Innenraum-Shader)
  const lampZ = [z0 + Math.min(0.7, L * 0.25), z1 - Math.min(0.8, L * 0.28)];
  lampZ.forEach((z, i) => {
    const lx = i ? 0.22 : -0.22;
    DT.domeLamp(B, C, det, new DT.LF(B, [lx, yR - 0.024, z], Q(HP, 0, 0)), C.dome);
    cab.lamps.push({ obj: 'hull', pos: new THREE.Vector3(lx, yR - 0.1, z), col: new THREE.Color(era === 'modern' ? 0xffe6c4 : 0xffbd78).multiplyScalar(0.55), where: 'fahrer' });
  });
  // ---- Funkgerät an der Stirnwand (rechts oben), Hörer mit Spiralkabel, Bordsprechkasten
  {
    const rx = wx - 0.32, ry = yR - 0.36;
    BASE.cabinet(new DT.LF(B, [rx, ry, z0 + 0.004], null), C, det, 0.34, 0.22, 0.26, { mat: C.olive, hinge: false, handle: true, flabel: K.flabel, plate: 'w_24v' });
    const FF = new DT.LF(B, [rx, ry, z0 + 0.268], null);
    for (let i = 0; i < 3; i++) FF.add(cyl(0.016, 0.014, 0.024, 10), C.black, [-0.1 + i * 0.05, 0.05, 0.012], [HP, 0, 0]);
    FF.add(box(0.1, 0.03, 0.006), C.disp, [0.08, 0.05, 0.004]);
    FF.add(box(0.012, 0.012, 0.01), C.lampGreen, [0.1, -0.03, 0.005]);
    K.flabel(FF, 'funk', [0, -0.05, 0.004], 0.16);
    B.add(rbox(0.05, 0.16, 0.05, 0.018), C.black, [rx - 0.26, ry - 0.05, z0 + 0.05]);
    if (det) B.tube(C.black, [[rx - 0.26, ry - 0.13, z0 + 0.05], [rx - 0.24, ry - 0.3, z0 + 0.08], [rx - 0.2, ry - 0.36, z0 + 0.07], [rx - 0.14, ry - 0.12, z0 + 0.05]], 0.005, 5, 14);
    BASE.cabinet(new DT.LF(B, [-wx + 0.3, yR - 0.3, z0 + 0.004], null), C, det, 0.12, 0.16, 0.1, { mat: C.olive });
    K.label([-wx + 0.3, yR - 0.4, z0 + 0.006], null, 'bsa', 0.16);
  }
  // ---- Dachluke (Innenseite) über dem hinteren Kampfraum
  const HL = D.hatches && D.hatches.loader && D.hatches.loader.space === 'hull' ? D.hatches.loader : null;
  if (HL) {
    B.add(tor(HL.r + 0.03, 0.022, 6, det ? 28 : 14), C.steel, [HL.pos[0], yR - 0.02, HL.pos[2]], [HP, 0, 0]);
    B.add(cyl(HL.r, HL.r, 0.012, det ? 24 : 12), C.metal, [HL.pos[0], yR - 0.008, HL.pos[2]]);
    if (det) DT.hatchInner(B, C, det, HL.pos, HL.r, yR - 0.02, 'x', 1);
    K.label([HL.pos[0] + HL.r + 0.12, yR - 0.006, HL.pos[2]], [HP, 0, 0], 'w_luke', 0.12);
  }
  // ---- Heckrampe von innen: Rahmen, Versteifungen, Tür mit Winkelspiegel und Griff, Haltegriffe, Zylinder, Scharniere
  {
    const zr = z1 - 0.006, rw = Math.min(wx * 2 - 0.16, (D.ramp && D.ramp.w) || 1.9), rh = H - 0.12, ry0 = yF + 0.03;
    const F = new Frame(B, [0, ry0 + rh / 2, zr], Q(0, PI, 0)); // +Z zeigt in den Raum
    for (const s2 of [-1, 1]) F.add(box(0.06, rh, 0.04), C.metal, [s2 * (rw / 2 - 0.03), 0, 0.02]);
    for (const s2 of [-1, 1]) F.add(box(rw, 0.06, 0.04), C.metal, [0, s2 * (rh / 2 - 0.03), 0.02]);
    for (let k = 1; k <= 2; k++) F.add(box(rw - 0.1, 0.05, 0.03), C.metal, [0, -rh / 2 + k * rh / 3, 0.016]);
    // Tür (rechts in Fahrtrichtung = links von innen gesehen), Dichtung, Griff, Winkelspiegel
    const dx = -rw * 0.22, dw = 0.62, dh = rh * 0.78;
    F.add(box(dw, dh, 0.025), W, [dx, -rh / 2 + dh / 2 + 0.04, 0.045]);
    F.add(box(dw + 0.02, 0.012, 0.03), C.rubber, [dx, -rh / 2 + dh + 0.05, 0.045]);
    for (const s2 of [-1, 1]) F.add(box(0.012, dh, 0.03), C.rubber, [dx + s2 * (dw / 2 + 0.006), -rh / 2 + dh / 2 + 0.04, 0.045]);
    DT.worn(B, 0.9, () => B.add(SH.bentTube([F.w([dx + dw / 2 - 0.08, -0.05, 0.06]), F.w([dx + dw / 2 - 0.08, -0.05, 0.11]), F.w([dx + dw / 2 - 0.08, 0.1, 0.11]), F.w([dx + dw / 2 - 0.08, 0.1, 0.06])], 0.011, 0.022, det ? 8 : 6), C.steel));
    F.add(rbox(0.08, 0.06, 0.06, 0.01), C.black, [dx + dw / 2 - 0.08, -0.12, 0.085]);
    const pz = -rh / 2 + dh * 0.82;
    F.add(rbox(0.2, 0.12, 0.1, 0.012), C.metal, [dx, pz, 0.1]);
    F.add(new THREE.PlaneGeometry(0.15, 0.05), C.prism, [dx, pz - 0.01, 0.1505], null, null, true);
    F.add(rbox(0.2, 0.04, 0.05, 0.015), C.pad, [dx, pz + 0.075, 0.13]);
    // Haltegriffe beidseits, Hydraulikzylinder, Scharniere unten
    for (const s2 of [-1, 1]) DT.worn(B, 0.9, () => B.add(SH.bentTube([F.w([s2 * (rw / 2 - 0.12), 0.05, 0.04]), F.w([s2 * (rw / 2 - 0.12), 0.05, 0.1]), F.w([s2 * (rw / 2 - 0.12), 0.35, 0.1]), F.w([s2 * (rw / 2 - 0.12), 0.35, 0.04])], 0.012, 0.025, det ? 8 : 6), C.steel));
    for (const s2 of [-1, 1]) {
      const a = F.w([-s2 * (rw / 2 - 0.05), rh / 2 - 0.15, 0.08]), b = [s2 * (wx - 0.08), yF + H * 0.75, z1 - 0.55]; // F ist um 180° gedreht → −s2
      B.rod(C.steel, a, b, 0.022, det ? 10 : 6);
      B.rod(C.metal, a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], 0.034, det ? 10 : 6);
    }
    for (const s2 of [-0.36, 0.36]) F.add(cyl(0.03, 0.03, 0.22, 10), C.steel, [s2 * rw, -rh / 2 + 0.01, 0.04], [0, 0, HP]);
    K.label(F.w([rw * 0.22, 0.15, 0.04]), Q(0, PI, 0), 'w_rampe', 0.2);
    K.stencil(F.w([dx, -rh / 2 + dh * 0.45, 0.059]), Q(0, PI, 0), 's_notaus', 0.2);
  }
  // ---- Ausstattung: Feuerlöscher, Wasserkanister, Verbandkasten, Leitung zur Rampe, Schilder
  K.extinguisher([-wx + 0.09, yF + 0.3, z0 + 0.2], -1);
  B.add(rbox(0.14, 0.34, 0.24, 0.02), C.olive, [wx - 0.1, yF + 0.18, z0 + 0.2]);
  B.add(cyl(0.022, 0.022, 0.05, 8), C.black, [wx - 0.1, yF + 0.37, z0 + 0.14]);
  K.label([wx - 0.171, yF + 0.2, z0 + 0.2], [0, -HP, 0], 'wasser', 0.11);
  DT.firstAid(B, C, det, new DT.LF(B, [-wx + 0.004, yR - 0.35, z1 - 0.7], Q(0, HP, 0)), (key, lp, w) => K.label(new DT.LF(B, [-wx + 0.004, yR - 0.35, z1 - 0.7], Q(0, HP, 0)).w(lp), Q(0, HP, 0), key, w));
  if (det) {
    K.stencil([0, yR - 0.004, zm], [HP, 0, 0], 's_kampf', 0.3);
    BASE.spatter(B, C, [-wx + 0.01, yF + 0.012, z0 + 0.1], [-wx + 0.01, yF + 0.012, z1 - 0.1], 14, 5, 0.02);
  }
}
