// NULLPUNKT — Detailmodell des GW-4 Steppe (Geländewagen) ab medium (Nutzer 14.11.: „Jeeps … enorm hoher Detailgrad“).
//
// Ersetzt in den Nahstufen 0/1 die Quader-Karosserie aus models.js buildJeep (low und Fernstufe unverändert):
//   Motorhaube als Querschnitts-Loft (kantig-militärisch, gewölbt, Lüftungsschlitze, Haubenverschlüsse, Scharnierleiste),
//   Kühlergrill mit senkrechten Schlitzen und Rahmen, Kotflügel als Profil-Extrusion mit Radbogen und Radhausschale,
//   offene Wanne als U-Loft mit Wandstärke (innen sichtbar), Heckklappe mit Ketten, Windschutzscheibe mit Rohrrahmen,
//   Scharnieren und Klemmen, Überrollbügel aus gebogenem Rohr, Stoßfänger mit Abschleppösen, Trittbretter (Riffelblech),
//   Unterboden: Leiterrahmen, Starrachsen mit Differential, Blattfedern, Stoßdämpfer, Kardanwelle, Auspuff, Tank,
//   Ausstattung: Kanister in Halterung, Pionierwerkzeug (Spaten, Axt), Verzurrösen, Tarnscheinwerfer, Spiegel, Antenne.
// Räder: Geländereifen mit Stollen (bodykit.tire 'mud'), Stahlfelge mit Lochkranz, Beadlock-Ring, Radmuttern.
//
// jeepBodyHQ(J, S, paint, lod) – J = { B (Lack/Kleinteile), box, cyl, sideExtrude }; jeepWheelHQ(R, J, S, paint, r, sx, lod)
import * as THREE from 'three';
import { tube, roundPlate, tire, steelRim } from './bodykit.js?v=20261123073102';
import { jeepBody } from './carbody.js?v=20261123073102';
import { addCarBody, surfaceProbe } from './models-car.js?v=20261123073102';

const PI = Math.PI, HP = PI / 2;
const lerp = (a, b, t) => a + (b - a) * t;


export function jeepBodyHQ(J, S, paint, lod) {
  const { B, box, cyl } = J;
  const fine = lod === 0;
  // Nutzer 15.11.: Blech als Unterteilungsfläche (carbody.js jeepBody): Haube mit Sicke, ausgestellte Kotflügel,
  // offene Wanne mit Bördelrand und Innenwand, Windlauf, senkrechtes Heck – gekantete Radien statt Lofts/Quadern
  const R = jeepBody(fine ? 2 : 1);
  const probe = surfaceProbe([...R.parts.values()], `jeep:${fine ? 2 : 1}`);
  const onHood = (x, z) => { const q = probe([x, 3, z], [0, -1, 0]); return q ? q.p[1] : 1.2; };
  // Leiterrahmen + Querträger
  for (const sx of [-1, 1]) B.add(box(0.1, 0.16, 4.5), S.dark, [sx * 0.48, 0.56, 0]);
  for (const z of [-2.1, -0.9, 0.4, 1.9]) B.add(box(0.9, 0.1, 0.1), S.dark, [0, 0.56, z]);
  // Kühlergrill: senkrechte Stege (Wagenfarbe) vor den Grillflächen
  const slots = fine ? 9 : 5;
  for (let i = 0; i < slots; i++) { const x = -0.5 + (i / (slots - 1)) * 1.0, q = probe([x, 0.84, -4], [0, 0, 1]); B.add(roundPlate(0.05, 0.28, 0.03, 0.012), paint, [x, 0.84, (q ? q.p[2] : -2.39) - 0.012]); }
  if (fine) {
    // Haubenverschlüsse (Gummispanner), Scharniere an der Spritzwand, Lüftungsschlitze, Fuge
    for (const sx of [-1, 1]) {
      B.add(box(0.05, 0.12, 0.03), S.rubber, [sx * 0.9, 1.04, -1.75]);
      B.add(box(0.04, 0.03, 0.06), S.dark, [sx * 0.9, 1.11, -1.75]);
      for (let k = 0; k < 6; k++) { const z = -1.62 + k * 0.07; B.add(box(0.26, 0.012, 0.03), S.dark, [sx * 0.42, onHood(sx * 0.42, z) + 0.004, z], [-0.08, 0, 0]); }
      for (let k = 0; k < 6; k++) B.add(box(0.26, 0.012, 0.03), S.dark, [sx * 0.42, 1.165 + k * 0.004, -1.6 + k * 0.07], [-0.08, 0, 0]);
    }
    B.add(cyl(0.018, 0.018, 1.5, 8), S.dark, [0, 1.29, -0.95], [0, 0, HP]);
  }
  // Radhausschalen (vorn/hinten)
  for (const sx of [-1, 1]) {
    const g = new THREE.CylinderGeometry(0.53, 0.53, 0.32, fine ? 18 : 9, 1, true, 0, PI);
    const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.computeVertexNormals();
    B.add(g, S.dark, [sx * 0.76, 0.42, -1.45], [0, 0, HP]);
    B.add(g.clone(), S.dark, [sx * 0.76, 0.42, 1.38], [0, 0, HP]);
  }
  // Armaturenbrett (Ego-Cockpit: cabin.js hängt an cockpit.dash/floor – unverändert)
  B.add(box(1.8, 0.06, 0.32), S.interior, [0, 1.28, -0.75]);                                           // Wannenboden                                   // Armaturenbrett (Ego-Cockpit: cabin.js)
  if (fine) {
    for (const sx of [-1, 1]) for (const yy of [0.95, 1.25]) B.add(new THREE.TorusGeometry(0.03, 0.008, 4, 8), S.dark, [sx * 0.62, yy, 2.215], [0, 0, 0]); // Klappenhaken
    for (const sx of [-1, 1]) B.add(tube([[sx * 0.9, 1.33, 2.17], [sx * 0.9, 1.25, 2.3], [sx * 0.88, 1.12, 2.23]], 0.006, 4, 3), S.steel); // Ketten
  }
  // Kotflügel hinten (Gummiverbreiterung über dem Radbogen) + Radkasten innen
  for (const sx of [-1, 1]) {
    const pts = []; for (let i = 0; i <= (fine ? 12 : 6); i++) { const a = (i / (fine ? 12 : 6)) * PI; pts.push([sx * 1.0, 0.42 + Math.sin(a) * 0.58, 1.38 + Math.cos(a) * 0.58]); }
    B.add(tube(pts, 0.04, fine ? 6 : 4, 2), S.rubber);
    B.add(box(0.32, 0.26, 0.95), paint, [sx * 0.76, 1.03, 1.38]);
  }
  // Windschutzscheibe: Rohrrahmen, Scharniere, Klemmen
  const ws = (x, y) => [x, 1.26 + y * Math.cos(0.08), -0.92 - y * Math.sin(0.08)];
  B.add(tube([ws(-0.88, 0), ws(-0.88, 0.54), ws(-0.84, 0.58), ws(0.84, 0.58), ws(0.88, 0.54), ws(0.88, 0)], 0.026, fine ? 8 : 5, 3), S.dark);
  B.add(box(1.8, 0.05, 0.06), S.dark, [0, 1.27, -0.92]);
  if (fine) for (const sx of [-1, 1]) { B.add(cyl(0.025, 0.025, 0.08, 8), S.steel, [sx * 0.8, 1.28, -0.88], [0, 0, HP]); B.add(box(0.05, 0.08, 0.05), S.dark, [sx * 0.9, 1.5, -0.92]); }
  // Überrollbügel (gebogen) + Längsstreben
  for (const sx of [-1, 1]) B.add(tube([[sx * 0.88, 1.32, 0.3], [sx * 0.88, 1.95, 0.3], [sx * 0.8, 2.08, 0.3]], 0.04, fine ? 8 : 5, 3), S.dark);
  B.add(tube([[-0.8, 2.08, 0.3], [-0.6, 2.1, 0.3], [0.6, 2.1, 0.3], [0.8, 2.08, 0.3]], 0.04, fine ? 8 : 5, 2), S.dark);
  for (const sx of [-1, 1]) B.add(tube([[sx * 0.86, 1.9, 0.32], [sx * 0.88, 1.5, 1.4], [sx * 0.9, 1.36, 2.0]], 0.032, fine ? 6 : 4, 3), S.dark);
  // Stoßfänger vorn/hinten, Abschleppösen, Trittbretter (Riffelblech)
  B.add(roundPlate(2.02, 0.18, 0.2, 0.03), S.dark, [0, 0.56, -2.5]);
  B.add(roundPlate(1.92, 0.15, 0.16, 0.03), S.dark, [0, 0.62, 2.3]);
  for (const sx of [-1, 1]) {
    B.add(box(0.2, 0.035, 1.4), S.dark, [sx * 0.98, 0.7, 0.24]);
    if (fine) for (let k = 0; k < 10; k++) B.add(box(0.04, 0.008, 0.02), S.dark, [sx * (0.95 + (k % 2) * 0.06), 0.72, -0.36 + k * 0.13], [0, (k % 2 ? 0.7 : -0.7), 0]);
    B.add(box(0.06, 0.18, 0.06), S.dark, [sx * 0.92, 0.6, -0.3]);
    B.add(box(0.06, 0.18, 0.06), S.dark, [sx * 0.92, 0.6, 0.8]);
  }
  // Unterboden: Achsen mit Differential, Blattfedern, Stoßdämpfer, Kardanwelle, Auspuff, Tank
  const ax = [-1.45, 1.38];
  for (const z of ax) {
    B.add(cyl(0.06, 0.06, 1.6, fine ? 10 : 6), S.dark, [0, 0.42, z], [0, 0, HP]);
    B.add(new THREE.SphereGeometry(0.16, fine ? 12 : 6, fine ? 8 : 4), S.dark, [0.1, 0.42, z], null, [1, 1, 0.8]);
    for (const sx of [-1, 1]) {
      B.add(box(0.08, 0.06, 1.1), S.steel, [sx * 0.5, 0.5, z]);                                 // Blattfeder
      if (fine) for (let k = 1; k <= 3; k++) B.add(box(0.075, 0.015, 1.1 - k * 0.22), S.steel, [sx * 0.5, 0.47 - k * 0.016, z]);
      B.add(cyl(0.025, 0.025, 0.42, 6), S.dark, [sx * 0.66, 0.6, z + 0.25], [0.25, 0, 0]);         // Stoßdämpfer
    }
  }
  B.add(cyl(0.035, 0.035, 2.6, 6), S.dark, [0.1, 0.46, -0.05], [HP, 0, 0]);                      // Kardanwelle
  B.add(tube([[-0.3, 0.6, -1.9], [-0.35, 0.46, -0.8], [-0.4, 0.46, 1.0], [-0.55, 0.52, 2.25]], 0.035, 6, 3), S.dark);
  B.add(box(0.7, 0.26, 0.5), S.dark, [0.35, 0.62, 1.9]);                                         // Tank
  // Scheinwerfer-Töpfe (vor dem Grill), Rückleuchten
  for (const sx of [-1, 1]) {
    B.add(cyl(0.13, 0.12, 0.08, fine ? 18 : 10), S.dark, [sx * 0.66, 1.08, -2.43], [HP, 0, 0]);
    if (fine) B.add(new THREE.TorusGeometry(0.115, 0.012, 4, 18), S.steel, [sx * 0.66, 1.08, -2.465]);
    B.add(roundPlate(0.12, 0.14, 0.03, 0.02), S.rearLamp, [sx * 0.78, 1.15, 2.215]);
  }
  // Spiegel, Antennenfuß, Tarnlichter, Rückstrahler, Kanister in Halterung, Pionierwerkzeug, Verzurrösen
  for (const sx of [-1, 1]) {
    B.add(tube([[sx * 0.9, 1.5, -0.92], [sx * 1.05, 1.62, -0.92], [sx * 1.1, 1.66, -0.92]], 0.01, 4, 2), S.dark);
    B.add(roundPlate(0.14, 0.18, 0.035, 0.02), S.dark, [sx * 1.12, 1.72, -0.92]);
    B.add(box(0.12, 0.16, 0.005), S.optic || S.glass, [sx * 1.12, 1.72, -0.9]);
    B.add(roundPlate(0.1, 0.05, 0.03, 0.01), S.lensOff, [sx * 0.72, 1.12, -2.39]);              // Tarnlicht
    B.add(roundPlate(0.08, 0.05, 0.015, 0.01), S.rearLamp, [sx * 0.6, 0.8, 2.215]);             // Rückstrahler
  }
  if (fine) {
    // Spaten + Axt links an der Wanne, Verzurrösen
    B.add(cyl(0.016, 0.016, 0.9, 6), S.wood || S.canvas, [-0.975, 1.1, 0.8], [HP, 0, 0]);
    B.add(roundPlate(0.02, 0.18, 0.2, 0.04), S.steel, [-0.975, 1.1, 1.3]);
    B.add(cyl(0.015, 0.015, 0.7, 6), S.wood || S.canvas, [-0.975, 1.05, -0.2], [HP, 0, 0]);
    B.add(box(0.03, 0.14, 0.08), S.steel, [-0.975, 1.05, 0.15]);
    for (const sx of [-1, 1]) for (const z of [-0.4, 1.9]) B.add(new THREE.TorusGeometry(0.025, 0.007, 4, 8), S.steel, [sx * 0.97, 1.32, z], [0, HP, 0]);
    // Haubenfuge/Wannenkante: Kantenschutz
    for (const sx of [-1, 1]) B.add(tube([[sx * 0.935, 1.365, -0.9], [sx * 0.935, 1.365, 2.18]], 0.012, 4, 1), S.dark);
  }
  addCarBody(R, S, B, B, B, paint);
}

/** Geländerad: Stollenreifen, Stahlfelge mit Lochkranz, Beadlock-Ring mit Schrauben, Nabe. R = Bucket des Rads. */
export function jeepWheelHQ(R, J, S, paint, r, sx, lod) {
  const fine = lod === 0, ri = r * 0.6;
  R.add(tire(r, 0.32, ri, { kind: 'mud', seg: fine ? 48 : 24 }), S.rubber);
  const bar = new THREE.CylinderGeometry(ri * 0.98, ri * 0.98, 0.26, fine ? 24 : 12, 1, true);
  bar.rotateZ(HP);
  const ix = bar.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  bar.computeVertexNormals();
  R.add(bar, S.dark);
  R.add(steelRim(ri, { holes: 6, seg: fine ? 24 : 12 }), paint, [sx * 0.07, 0, 0], sx < 0 ? [0, PI, 0] : null);
  R.add(new THREE.TorusGeometry(ri * 0.96, 0.018, 4, fine ? 28 : 14), S.dark, [sx * 0.1, 0, 0], [0, HP, 0]);
  R.add(J.cyl(0.07, 0.08, 0.1, fine ? 12 : 6), S.dark, [sx * 0.11, 0, 0], [0, 0, HP]);
  if (fine) {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; R.add(J.box(0.025, 0.02, 0.02), S.steel, [sx * 0.112, Math.sin(a) * ri * 0.96, Math.cos(a) * ri * 0.96]); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.26; R.add(J.cyl(0.013, 0.013, 0.03, 6), S.steel, [sx * 0.16, Math.sin(a) * 0.05, Math.cos(a) * 0.05], [0, 0, HP]); }
  }
}
