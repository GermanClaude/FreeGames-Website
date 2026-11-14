// NULLPUNKT — Zusatzdetails der Luftfahrzeuge (Nutzer 14.11.: „Flugzeuge … enorm hoher Detailgrad“), nur Nahstufe und
// nur medium+ (low unverändert). Wird aus air/models.js (heliFuselage/heliInterior, jetFuselage/jetInterior) aufgerufen.
//
// KHS-4 Sperber: Drahtschneider über/unter der Kanzel (Sägezähne), Radarwarner-Kuppeln an Bug und Heck, Freund-Feind-
//   Antennen, Peitschenantennen, Landescheinwerfer + Suchscheinwerfer unter dem Bug, Haltegriffe und Trittmulden, Nieten-
//   leisten an den Kanzelrahmen, Einlaufgitter der Triebwerke, Heckrotor-Getriebeverkleidung, Verzurrösen, Fahrwerk mit
//   Federbein, Drehmomentstütze, Radnabe und Bremse; Lenkflugkörper (je Seite zwei an der Außenschiene).
//   Kanzel: Rundinstrumente neben den Bildschirmen, Schalterleisten, Seitenkonsolen mit Tastenfeldern, Dachpaneel,
//   Kollektivhebel mit Griff, Pedale, Gurtzeug, Visiereinheit des Schützen.
// JK-9 Falke: Staurohr mit Anströmwinkelgebern, Antennenschaufeln, Formationsleuchtstreifen, Entladerstäbe an Flügel- und
//   Leitwerkshinterkanten, Wirbelgeneratoren, Täuschkörper-Klappe, Betankungssonde, Grenzschicht-Abluftgitter, Kanonen-
//   Entlüftung; Fahrwerk: Federbein mit Drehmomentstütze, Landescheinwerfer, Radnaben. Luft-Luft-Flugkörper an den
//   Flügelspitzenschienen. Kanzel: Seitenkonsolen mit Schaltern/Drehknöpfen, Rundinstrumente, Schleudersitz mit Kopfteil,
//   Gurtzeug und Fallschirmpaket, Haubenspiegel, HUD-Rahmen.
import * as THREE from 'three';

const PI = Math.PI, HP = PI / 2;
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylZ = (r0, r1, len, seg = 10) => new THREE.CylinderGeometry(r0, r1, len, seg).rotateX(HP);
const cylY = (r0, r1, len, seg = 10) => new THREE.CylinderGeometry(r0, r1, len, seg);
function tube(pts, r, seg = 5) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  return new THREE.TubeGeometry(c, Math.max(4, pts.length * 3), r, seg, false);
}

/** Lenkflugkörper (Achse z, Spitze −z): Rumpf, Suchkopf, Kreuzflügel, Leitwerk, Warnband. */
function missile(B, M, x, y, z, len = 1.6, r = 0.09, fins = true) {
  B.add(cylZ(r, r, len * 0.82, 12), M.missile, [x, y, z]);
  B.add(new THREE.SphereGeometry(r, 12, 6, 0, PI * 2, 0, HP).rotateX(-HP), M.glass, [x, y, z - len * 0.41]);
  B.add(cylZ(r * 0.6, r, len * 0.08, 12), M.missile, [x, y, z + len * 0.45]);
  B.add(cylZ(r * 1.01, r * 1.01, 0.05, 12), M.band, [x, y, z - len * 0.2]);
  if (fins) for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4;
    B.add(box(0.012, r * 1.6, 0.22), M.missile, [x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, z + len * 0.32], [0, 0, a + HP]);
    B.add(box(0.01, r * 1.1, 0.12), M.missile, [x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1, z - len * 0.18], [0, 0, a + HP]);
  }
}

/** Rundinstrument: Gehäuse + leuchtendes Zifferblatt, Normale zur Kanzel (rx Neigung). */
function gauge(B, M, x, y, z, r, rx) {
  B.add(cylY(r * 1.15, r * 1.15, 0.025, 14), M.panel, [x, y, z], [rx + HP, 0, 0]);
  B.add(cylY(r, r, 0.03, 14), M.screen, [x, y, z], [rx + HP, 0, 0]);
}

/** Schalterreihe (Kippschalter) auf einer geneigten Fläche. */
function switches(B, M, x0, y, z, n, dx, rx) {
  for (let i = 0; i < n; i++) B.add(box(0.012, 0.04, 0.012), M.steel, [x0 + i * dx, y, z], [rx, 0, 0]);
}

/* =================================================================== Hubschrauber */

export function heliDetailHQ(B, M, P) {
  // Drahtschneider oben (vor dem Rotormast) und unten (Bug) mit Sägezähnen
  B.add(box(0.06, 0.5, 0.06), M.steel, [0, 2.92, -3.0], [-0.5, 0, 0]);
  for (let k = 0; k < 4; k++) B.add(box(0.02, 0.06, 0.09), M.steel, [0.035, 2.78 + k * 0.08, -3.07 + k * 0.045], [-0.5, 0, 0]);
  B.add(box(0.05, 0.45, 0.05), M.steel, [0, 0.82, -7.0], [0.35, 0, 0]);
  // Radarwarner-Kuppeln (Bug beidseits, Heck), IFF-Klingen, Peitschenantennen
  for (const sx of [-1, 1]) {
    B.add(new THREE.SphereGeometry(0.07, 10, 6, 0, PI * 2, 0, HP), M.dark, [sx * 0.62, 1.42, -6.85], [-HP + 0.3, sx * 0.6, 0]);
    B.add(new THREE.SphereGeometry(0.06, 10, 6, 0, PI * 2, 0, HP), M.dark, [sx * 0.22, 2.55, 9.6], [HP, 0, 0]);
  }
  B.add(box(0.015, 0.16, 0.12), M.dark, [0, 0.62, -3.2]);
  B.add(box(0.015, 0.16, 0.12), M.dark, [0, 2.95, 5.8]);
  B.add(cylY(0.008, 0.012, 1.0, 4), M.dark, [0.35, 3.3, 2.6], [0.6, 0, 0]);
  B.add(cylY(0.008, 0.012, 0.8, 4), M.dark, [-0.3, 0.55, 2.0], [PI - 0.5, 0, 0]);
  // Lande-/Suchscheinwerfer unter dem Bug
  B.add(cylY(0.12, 0.1, 0.08, 14), M.dark, [0.3, 0.62, -4.4]);
  B.add(new THREE.CircleGeometry(0.1, 14).rotateX(HP), M.V.lensOff, [0.3, 0.575, -4.4]);
  B.add(cylY(0.09, 0.08, 0.1, 12), M.dark, [-0.35, 0.66, -3.4]);
  B.add(new THREE.CircleGeometry(0.075, 12).rotateX(HP), M.V.lensOff, [-0.35, 0.605, -3.4]);
  // Haltegriffe + Trittmulden an der linken Seite (Einstieg), Verzurrösen
  for (const sx of [-1, 1]) {
    for (const [y, z] of [[1.25, -4.9], [1.65, -3.6], [2.35, -4.2]]) B.add(box(0.03, 0.05, 0.14), M.dark, [sx * (y < 2 ? 0.9 : 0.95), y, z]);
    for (const z of [-2.2, 1.2]) B.add(new THREE.TorusGeometry(0.035, 0.009, 4, 8).rotateY(HP), M.steel, [sx * 1.15, 0.95, z]);
  }
  // Einlaufgitter (Ringe + Speichen) und Heckrotor-Getriebeverkleidung
  for (const sx of [-1, 1]) {
    const x = sx * 0.62;
    for (const r of [0.1, 0.17, 0.24]) B.add(new THREE.TorusGeometry(r, 0.008, 3, 18), M.steel, [x, 3.08, -2.41]);
    for (let i = 0; i < 6; i++) B.add(box(0.008, 0.48, 0.01), M.steel, [x, 3.08, -2.41], [0, 0, (i / 6) * PI]);
  }
  B.add(new THREE.SphereGeometry(0.28, 14, 8), P, [0, 3.95, 9.95], null, [0.7, 1, 1.3]);
  B.add(cylY(0.08, 0.08, 0.15, 10), M.dark, [0.3, 4.0, 10.0], [0, 0, HP]);
  // Nietenleisten an den Kanzelrahmen (kleine Köpfe)
  for (const sx of [-1, 1]) for (let i = 0; i < 18; i++) {
    const t = i / 17, z = -6.5 + t * 3.7, y = 1.95 + Math.sin(t * PI) * 0.05 + t * 0.32;
    B.add(new THREE.SphereGeometry(0.009, 4, 3), M.frame, [sx * (0.8 + t * 0.18), y, z]);
  }
  // Fahrwerk: Federbeine mit Drehmomentstütze, Nabe, Bremse; Bugrad-Gabel
  for (const sx of [-1, 1]) {
    B.add(cylY(0.05, 0.05, 0.55, 8), M.steel, [sx * 1.32, 0.75, 0.55], [0, 0, sx * 0.55]);
    B.add(cylY(0.035, 0.035, 0.32, 8), M.steel, [sx * 1.4, 0.58, 0.55], [0, 0, sx * 0.55]);
    B.add(box(0.03, 0.22, 0.04), M.dark, [sx * 1.35, 0.62, 0.66], [0, 0, sx * 0.5]);
    B.add(cylY(0.12, 0.12, 0.27, 12), M.dark, [sx * 1.5, 0.36, 0.55], [0, 0, HP]);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; B.add(cylY(0.012, 0.012, 0.29, 5), M.steel, [sx * 1.5, 0.36 + Math.sin(a) * 0.08, 0.55 + Math.cos(a) * 0.08], [0, 0, HP]); }
    B.add(box(0.06, 0.12, 0.1), M.dark, [sx * 1.38, 0.32, 0.43]);
  }
  for (const sx of [-1, 1]) B.add(box(0.03, 0.32, 0.05), M.steel, [sx * 0.13, 0.42, -5.4]);
  B.add(cylY(0.09, 0.09, 0.24, 10), M.dark, [0, 0.3, -5.4], [0, 0, HP]);
  // Lenkflugkörper an der Außenschiene (je Seite zwei, über/unter)
  for (const sx of [-1, 1]) {
    B.add(box(0.08, 0.5, 1.3), M.dark, [sx * 3.12, 1.25, -1.2]);
    for (const dy of [0.14, -0.14]) missile(B, M, sx * 3.25, 1.25 + dy, -1.25, 1.55, 0.085);
  }
}

export function heliInteriorHQ(B, M) {
  for (const [z, y, w] of [[-5.6, 1.15, 0.7], [-3.85, 1.42, 0.78]]) {
    // Rundinstrumente neben dem Bildschirm, Schalterleisten, Warnleuchtenfeld
    const py = y + 0.55, pz = z - 0.6, rx = -0.55;
    for (const sx of [-1, 1]) { gauge(B, M, sx * w * 0.62, py + 0.06, pz + 0.07, 0.04, rx); gauge(B, M, sx * w * 0.62, py - 0.06, pz + 0.12, 0.035, rx); }
    switches(B, M, -w * 0.5, py - 0.15, pz + 0.18, 10, w * 0.11, rx);
    // Seitenkonsolen mit Tastenfeldern
    for (const sx of [-1, 1]) {
      B.add(box(0.2, 0.06, 0.7), M.panel, [sx * (w - 0.22), y + 0.42, z + 0.05]);
      for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) B.add(box(0.03, 0.012, 0.03), M.steel, [sx * (w - 0.26) + k * 0.06, y + 0.456, z - 0.2 + i * 0.12]);
    }
    // Kollektiv (Griff mit Schalterkopf), Pedale, Gurtzeug, Kopfstütze
    B.add(cylY(0.03, 0.03, 0.12, 8), M.dark, [-w + 0.22, y + 0.45, z - 0.15], [-0.3 + HP, 0, 0]);
    for (const sx of [-1, 1]) B.add(box(0.1, 0.16, 0.03), M.dark, [sx * 0.14, y + 0.12, z - 0.72], [0.6, 0, 0]);
    for (const sx of [-1, 1]) B.add(box(0.05, 0.6, 0.012), M.band, [sx * 0.12, y + 0.55, z + 0.385], [0.12, 0, 0]);
    B.add(box(0.36, 0.05, 0.012), M.band, [0, y + 0.3, z + 0.36]);
  }
  // Visiereinheit des Schützen (vorn), Dachpaneel des Piloten
  B.add(box(0.22, 0.2, 0.3), M.panel, [0, 1.9, -6.0]);
  B.add(cylZ(0.05, 0.06, 0.12, 12), M.black, [0, 1.92, -5.8]);
  B.add(box(0.5, 0.06, 0.3), M.panel, [0, 2.8, -3.95], [0.3, 0, 0]);
  switches(B, M, -0.2, 2.78, -3.86, 8, 0.055, 0.3 + HP);
}

/* =================================================================== Jet */

export function jetDetailHQ(B, M, P) {
  // Staurohr mit Anströmwinkelgebern, Antennenschaufeln, Betankungssonde
  for (const sx of [-1, 1]) B.add(box(0.008, 0.05, 0.08), M.dark, [sx * 0.42, 2.0, -7.1], [0, 0, sx * HP]);
  for (const [x, y, z, rz] of [[0, 1.27, -3.4, PI], [0, 2.94, 2.4, 0], [0.4, 1.3, 3.8, PI]]) B.add(box(0.012, 0.16, 0.2), M.dark, [x, y, z], [0, 0, rz]);
  B.add(tube([[0.48, 2.42, -6.6], [0.52, 2.5, -5.6], [0.5, 2.48, -4.8]], 0.035, 8), M.steel);
  B.add(cylZ(0.02, 0.035, 0.12, 8), M.dark, [0.48, 2.42, -6.66]);
  // Formationsleuchtstreifen (Rumpf, Leitwerke), Entladerstäbe an Hinterkanten, Wirbelgeneratoren
  for (const sx of [-1, 1]) {
    B.add(box(0.012, 0.05, 0.5), M.navW, [sx * 0.86, 2.1, -1.0]);
    B.add(box(0.012, 0.05, 0.5), M.navW, [sx * 0.95, 2.05, 5.2]);
    for (let i = 0; i < 3; i++) B.add(cylZ(0.005, 0.005, 0.18, 4), M.dark, [sx * (3.4 + i * 0.6), 1.78, 4.45 + i * 0.32]);
    for (let i = 0; i < 6; i++) B.add(box(0.006, 0.035, 0.07), M.dark, [sx * (1.8 + i * 0.45), 1.92, -0.2 + i * 0.45 * 0.97], [0, sx * 0.4, 0]);
  }
  // Täuschkörperklappe, Grenzschicht-Abluft (Gitter), Kanonenentlüftung
  for (let i = 0; i < 5; i++) B.add(box(0.2, 0.006, 0.015), M.black, [0, 1.3, 2.2 + i * 0.05]);
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) B.add(box(0.012, 0.03, 0.12), M.black, [sx * 0.9, 2.45, -2.7 + i * 0.05]);
  for (let i = 0; i < 4; i++) B.add(box(0.006, 0.05, 0.06), M.black, [-0.68, 2.05, -5.2 + i * 0.09]);
  // Luft-Luft-Flugkörper an den Flügelspitzenschienen
  for (const sx of [-1, 1]) missile(B, M, sx * 5.25, 1.66, 2.9, 2.6, 0.065);
  // Fahrwerk: Drehmomentstützen, Naben, Landescheinwerfer am Bugbein (feste Teile im Fahrwerksschacht)
  for (const sx of [-1, 1]) B.add(box(0.5, 0.05, 1.1), M.black, [sx * 1.7, 1.28, 1.1]);
  B.add(box(0.4, 0.05, 1.0), M.black, [0, 1.32, -4.9]);
  // Kanonen-Mündungsverkleidung
  B.add(cylZ(0.07, 0.08, 0.18, 10), M.dark, [-0.62, 1.95, -5.62]);
}

/** Zusätze am Fahrwerksbein (je Bein, im Bein-Raum): Federbein, Drehmomentstütze, Nabe, ggf. Landescheinwerfer. */
export function jetGearDetailHQ(B, M, r, len, nose) {
  B.add(cylY(0.085, 0.085, len * 0.35, 10), M.steel, [0, -len * 0.25, 0]);
  B.add(box(0.03, len * 0.3, 0.04), M.dark, [0, -len * 0.7, 0.1], [0.4, 0, 0]);
  B.add(box(0.03, len * 0.3, 0.04), M.dark, [0, -len * 0.82, 0.1], [-0.4, 0, 0]);
  B.add(cylY(r * 0.32, r * 0.32, 0.28, 12), M.dark, [0, -len, 0], [0, 0, HP]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; B.add(cylY(0.012, 0.012, 0.3, 5), M.steel, [0, -len + Math.sin(a) * r * 0.22, Math.cos(a) * r * 0.22], [0, 0, HP]); }
  if (nose) { B.add(cylZ(0.06, 0.05, 0.08, 10), M.dark, [0, -len * 0.4, -0.12]); B.add(new THREE.CircleGeometry(0.05, 10), M.V.lensOff, [0, -len * 0.4, -0.165], [0, PI, 0]); }
}

export function jetInteriorHQ(B, M) {
  // Seitenkonsolen mit Schaltern/Drehknöpfen
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      B.add(cylY(0.016, 0.016, 0.02, 8), M.steel, [sx * 0.42, 2.16, -3.8 + i * 0.13]);
      B.add(box(0.01, 0.03, 0.01), M.steel, [sx * 0.36, 2.16, -3.75 + i * 0.13]);
    }
    B.add(box(0.16, 0.004, 0.8), M.screen, [sx * 0.4, 2.142, -3.4]);
  }
  // Rundinstrumente unter dem Hauptbildschirm
  for (const dx of [-0.3, -0.18, 0.18, 0.3]) gauge(B, M, dx, 2.5, -4.43, 0.035, -0.45);
  switches(B, M, -0.35, 2.43, -4.35, 12, 0.064, -0.45);
  // Schleudersitz: Kopfteil mit Fallschirmpaket, Gurtzeug, seitliche Rohre, Abzugsgriff (gelb-schwarz)
  B.add(box(0.44, 0.24, 0.16), M.dark, [0, 3.06, -2.82], [0.22, 0, 0]);
  B.add(box(0.36, 0.3, 0.1), M.suit, [0, 2.75, -2.95], [0.22, 0, 0]);
  for (const sx of [-1, 1]) {
    B.add(cylY(0.022, 0.022, 0.95, 6), M.steel, [sx * 0.27, 2.5, -2.95], [0.22, 0, 0]);
    B.add(box(0.05, 0.55, 0.012), M.band, [sx * 0.13, 2.42, -3.05], [0.22, 0, 0]);
  }
  B.add(box(0.3, 0.05, 0.012), M.band, [0, 2.15, -3.1]);
  // Haubenspiegel, HUD-Rahmen
  for (const sx of [-1, 1]) B.add(box(0.12, 0.05, 0.015), M.visor, [sx * 0.3, 3.1, -4.3], [0.2, 0, 0]);
  B.add(box(0.22, 0.012, 0.012), M.dark, [0, 2.98, -4.6]);
  for (const sx of [-1, 1]) B.add(box(0.012, 0.15, 0.012), M.dark, [sx * 0.11, 2.9, -4.58], [0.35, 0, 0]);
}
