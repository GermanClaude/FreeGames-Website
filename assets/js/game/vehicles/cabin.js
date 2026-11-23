// NULLPUNKT — Besatzungsräume im Detail (Nutzer 14.11.: „Die Panzer sind von innen noch ziemlich schlecht … so detailliert
// wie möglich“). Ergänzt den Grund-Innenraum aus models.js (Hülle, Gestell, Verschluss, Turmkorb) um ausgestattete Plätze:
//
//   Fahrerraum (Wannenraum, eigene geschlossene Kammer vor dem Kampfraum): Sitz mit Polstern, zwei Lenkhebel, Gas-/Brems-
//     (WK: Kupplungs-)pedal, Gangwahlhebel, schräge Instrumententafel mit Rundinstrumenten (Drehzahl, Tempo, Öl, Wasser),
//     Warnleuchten, Kippschaltern, Notaus unter Klappe, Anzeige (modern), drei Winkelspiegel mit Stirnpolstern, Lukenring
//     mit Verriegelung, Bodenluke, Kraftstoffbehälter, Feuerlöscher, Erste-Hilfe-Kasten, Kabelbäume mit Schellen.
//   Richtschütze: Hauptzieloptik mit Okular + Augenmuschel und Stirnpolster, Steuergriff mit Abzügen, Handräder für Höhe
//     und Seite (drehen mit Rohr/Turm), Feuerleitrechner mit Live-Bildschirm (Entfernung, Munition, Bereitschaft), Munitions-
//     wahltasten (leuchten je Sorte), Hilfszielfernrohr; 2. WK/1. WK: Zielfernrohr, Turmrichtungsanzeiger, Fußabzug.
//   Kommandant: Kuppelring mit Winkelspiegeln rundum, Rundblickperiskop-Okular, Lagebildschirm (modern), Funkgeräte-
//     stapel mit Bedienfeld, Hörer an Spiralkabel (pendelt), Kopfhörer am Haken, Kartentasche.
//   Funker (Bug-MG, 2. WK; Nutzer 20.11.): eigene Kammer rechts vom Fahrer mit Kugelblende und MG (folgt der Lafette),
//     Zielfernrohr, Gurt-/Hülsensack, Funkgerätestapel mit Kanalwahl und Schaltern, Gurtkasten-Regal, Winkelspiegel, Sitz.
//   Winkelspiegel (alle Plätze): Glaslagen in info.prisms – psim/optics.js legt das Außenbild auf den Spiegel im Blick.
//   Ladeschütze: Koaxial-MG mit Gurtkasten und Hülsenschacht (am Rohr, nickt mit), Sicherungsschalter, Hülsenauswurf nach
//     jedem Schuss (Hülsenboden bzw. Messinghülse fliegt aus dem Verschluss, bleibt im Korb liegen) mit Pulverdampf.
//   Allgemein: Kabelbäume und Hydraulikleitungen an Decke/Wänden, Lüfter (dreht), Stoßpolster, Schalterkästen,
//     Bordsprechkästen, Warnschilder (deutsch, frei erfunden), Typenschild, Innenbeleuchtung rot/grün (modern),
//     Glühlampen (2. WK) bzw. Öllampe (1. WK) als echte Lichtquellen im Innenraum-Shader.
//
// Licht: alle Innenraum-Materialien sind Klone mit dem Haken „cabin“ – Sonne/Himmel stark gedämpft (geschlossener
// Stahlkasten), dafür bis zu vier Punktlichter (Weltraum, geteilte Uniforms; nur ein lokaler Insasse) mit Flackern bei
// Schuss/Treffer, plus Gebrauchsspuren (Schmutz, Kratzer, Abrieb) prozedural im Objektraum. Wände nutzen die Fotoscan-
// Sätze (metal_painted/gunmetal_worn, KTX2) der Fahrzeugmaterialien, sobald sie geladen sind.
//
// Leistung: nichts davon existiert, bevor ein lokaler Spieler eine Innensicht öffnet (attachCabin aus models.js
// setInterior) – dann je Typ/Stufe EINE Vorlage gebaut und geklont, Geometrien geteilt; Bildschirme zeichnen höchstens
// 5×/s. low: weniger Kleinteile (keine Kabelbäume/Schellen, gröbere Rundungen).
//
// attachCabin(model, D, quality) → cab | null; syncCabin(cab, vehicle, dt) je Bild (vehicle.js _syncCrew, nur innen);
// setCabinVisible(cab, on).
// Nutzer 21.11.: Transporter (MTW-13, RS-8) über attachTroopCabin (Fahrerkabine mit Durchgang + Mannschaftsraum aus
// cabin-troop.js), Schützenpanzer mit Mannschaftsraum im Detail, 2.-WK-Fahrerplatz epochentypisch (Sehklappe, Blechtafel,
// Kurskreisel, Zündschloss/Anlasserknopf), Funker mit Durchgang zum Kampfraum; cabinSeatAnchors(vehicle) liefert die
// Sitz-Anker (Hüfte, Auge, Blickrichtung je Platz) für die sichtbaren Besatzungsfiguren (crew-figures.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { boxUV } from '../engine/textures.js?v=20261123082814';
import { addShaderPatch, copyShaderPatches, ensureWorldVaryings } from '../world/shading.js?v=20261123082814';
import { driverCabin, vehicleWeapon } from './data.js?v=20261123082814';
import * as DT from './cabin-detail.js?v=20261123082814';
import { createBake, relMatrix, tessellate } from './cabin-bake.js?v=20261123082814';
import * as SH from './cabin-shape.js?v=20261123082814';
import * as BASE from './cabin-base.js?v=20261123082814';
import { assets, tierFor } from '../../../lib/loader.js?v=20261123082814';
import { funkerCabin, funkerLayout, funkerDoor, loaderPrism, driverLayoutWk2 } from './periscopes.js?v=20261123082814';
import { buildTroopRoom, troopSeatH } from './cabin-troop.js?v=20261123082814';

const PI = Math.PI, HP = PI / 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _Y = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/* ===================================================================== Geometrie-Helfer */

// Nutzer 20.11. („zu kantig“): Kästen und Zylinder mit Fase und gewichteten Normalen (cabin-shape.js) – ab medium
let CHAMF = 1;
const box = (w, h, d) => (CHAMF ? SH.cbox(w, h, d, Math.max(0.0015, Math.min(0.006, Math.min(w, h, d) * 0.2))) : new THREE.BoxGeometry(w, h, d));
const rbox = (w, h, d, r = 0.02, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const cyl = (r1, r2, h, seg = 12, open = false) => (CHAMF && !open && Math.max(r1, r2) > 0.006 ? SH.ccyl(r1, r2, h, seg, Math.max(0.0008, Math.min(0.004, Math.min(Math.max(r1, r2), h) * 0.15))) : new THREE.CylinderGeometry(r1, r2, h, Math.max(3, seg | 0), 1, open));
const tor = (R, r, rs = 6, ts = 24, arc = PI * 2) => new THREE.TorusGeometry(R, r, rs, ts, arc);

/** Drehung, die lokal +Z von `from` nach `to` zeigen lässt (Schilder, Bildschirme, Okulare). */
function aim(from, to, up = _up) {
  _m.lookAt(V3(to), V3(from), up);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}
/** Drehung für eine Fläche mit Normale n (lokal +Z → n). */
function facing(n) { return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), V3(n).normalize()); }
function toQuat(rot) {
  if (!rot) return _q.identity();
  if (rot.isQuaternion) return _q.copy(rot);
  _e.set(rot[0] || 0, rot[1] || 0, rot[2] || 0, rot[3] || 'XYZ');
  return _q.setFromEuler(_e);
}

/** Sammelt Geometrien je Material, verschmilzt sie zu einem Netz je Material (wenige Draw Calls). */
// Innenraum-Attribute je Eckpunkt (cabin-bake.js): cabA = (Verdeckung, Abnutzung, Raum), cabS0/cabS1 = Lampenschatten.
// Abnutzung setzt der Bucket aus seiner Eigenschaft `wear` (Griffe, Hebel, Kanten: blankes Metall im Shader).
// TESS > 0: große Dreiecke beim Verschmelzen teilen (damit die gebackene Verdeckung auf Wänden/Boden sichtbar wird).
let TESS = 0;
class MB {
  constructor() { this.m = new Map(); this.wear = 0; }
  add(geom, mat, pos = null, rot = null, scl = null, keepUV = false) {
    if (!mat) { geom.dispose(); return this; }
    let g = geom.index ? geom.toNonIndexed() : geom;
    if (g !== geom) geom.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(keepUV && k === 'uv')) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    _m.compose(_p.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0), toQuat(rot), _s.set(scl ? scl[0] : 1, scl ? scl[1] : 1, scl ? scl[2] : 1));
    g.applyMatrix4(_m);
    if (!keepUV || !g.attributes.uv) boxUV(g, 1);
    const n = g.attributes.position.count, ca = new Float32Array(n * 3);
    if (this.wear) for (let i = 0; i < n; i++) ca[i * 3 + 1] = this.wear;
    g.setAttribute('cabA', new THREE.BufferAttribute(ca, 3));
    g.setAttribute('cabS0', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('cabS1', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    // Kantenmaske (Abrieb an konvexen Kanten/Rundungen); Schilder, Bildschirme: keine
    g.setAttribute('cabE', new THREE.BufferAttribute(keepUV || mat.userData.noEdge ? SH.edgeNone(n) : SH.edgeMask(g), 4));
    if (!this.m.has(mat)) this.m.set(mat, []);
    this.m.get(mat).push(g);
    return this;
  }
  /** Zylinder zwischen zwei Punkten. */
  rod(mat, a, b, r, seg = 8, r2 = r) {
    _a.fromArray(a); _b.fromArray(b);
    const len = _a.distanceTo(_b);
    if (len < 1e-4) return this;
    const q = new THREE.Quaternion().setFromUnitVectors(_Y, _c.subVectors(_b, _a).normalize());
    return this.add(cyl(r2, r, len, seg), mat, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], q);
  }
  /** Leitung entlang Stützpunkten (Catmull-Rom). */
  tube(mat, pts, r, radial = 6, perM = 10) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => V3(p)), false, 'centripetal');
    const n = Math.max(4, Math.round(curve.getLength() * perM));
    return this.add(new THREE.TubeGeometry(curve, n, r, radial, false), mat);
  }
  build(parent, name = 'cab') {
    for (const [mat, list] of this.m) {
      let g = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (list.length > 1) for (const x of list) x.dispose();
      if (TESS > 0 && !mat.userData.noTess) { const t = tessellate(g, TESS); if (t) { g.dispose(); g = t; } }
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = name;
      mesh.castShadow = false; mesh.receiveShadow = false;
      parent.add(mesh);
    }
    this.m.clear();
    return parent;
  }
}

/** Kleine bewegliche Gruppe (eigene Netze) – Hebel, Pedale, Zeiger, Handräder. */
function part(parent, name, pos, rot = null) {
  const g = new THREE.Group();
  g.name = name;
  if (pos) g.position.fromArray(pos);
  if (rot) g.quaternion.copy(rot.isQuaternion ? rot : toQuat(rot));
  parent.add(g);
  return g;
}

/* ===================================================================== Texturen (Leinwand, einmal) */

let ATLAS = null;
/** Schilder, Frontplatten und Rundinstrumente in einem 1024×1024-Atlas (Regal-Packen). rect(key) → [u0, v0, u1, v1, aspect] */
function atlas() {
  if (ATLAS) return ATLAS;
  const W = 1024, H = 2048;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#202020'; g.fillRect(0, 0, W, H);
  const rects = {};
  let x = 0, y = 0, rowH = 0;
  const put = (key, w, h, draw) => {
    if (x + w > W) { x = 0; y += rowH + 2; rowH = 0; }
    g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip();
    draw(g, w, h);
    g.restore();
    rects[key] = [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H, w / h];
    x += w + 2; rowH = Math.max(rowH, h);
  };
  const SANS = '"DejaVu Sans Condensed","Arial Narrow",Arial,sans-serif';
  const grime = (g2, w, h, k = 1) => {
    for (let i = 0; i < 70 * k; i++) { g2.fillStyle = `rgba(30,24,16,${Math.random() * 0.18})`; g2.beginPath(); g2.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 5, 0, 7); g2.fill(); }
    for (let i = 0; i < 10 * k; i++) { g2.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.12})`; g2.lineWidth = 0.6; g2.beginPath(); const sx = Math.random() * w, sy = Math.random() * h; g2.moveTo(sx, sy); g2.lineTo(sx + (Math.random() - 0.5) * 40, sy + (Math.random() - 0.5) * 8); g2.stroke(); }
    const gr = g2.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,30,15,0.35)');
    g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
  };
  const STY = {
    warn: ['#d8b021', '#111'], red: ['#a8231b', '#f3eee2'], black: ['#1d1e1b', '#e9e5d8'], white: ['#e4dfcf', '#161616'],
    green: ['#2d6036', '#f0ede0'], blue: ['#24476e', '#eef'], olive: ['#4c5236', '#e8e2c8'], ivory: ['#d8cfae', '#2a2416'],
  };
  /** Schild: Hintergrund, Rand (warn: Warnstreifen), 1–2 Zeilen, Schrauben in den Ecken. */
  const plate = (key, style, l1, l2 = '', w = 256, h = 64) => put(key, w, h, (g2) => {
    const [bg, fg] = STY[style];
    g2.fillStyle = bg; g2.fillRect(0, 0, w, h);
    if (style === 'warn') {
      g2.save(); g2.beginPath(); g2.rect(0, 0, w, 9); g2.rect(0, h - 9, w, 9); g2.clip();
      g2.fillStyle = '#111'; for (let i = -2; i < w / 12 + 2; i++) { g2.beginPath(); g2.moveTo(i * 24, 0); g2.lineTo(i * 24 + 12, 0); g2.lineTo(i * 24 + 12 - h, h); g2.lineTo(i * 24 - h, h); g2.fill(); }
      g2.restore();
    } else { g2.strokeStyle = fg; g2.globalAlpha = 0.7; g2.lineWidth = 2; g2.strokeRect(4, 4, w - 8, h - 8); g2.globalAlpha = 1; }
    g2.fillStyle = fg; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    const fit = (txt, size, yy, weight) => { let s = size; g2.font = `${weight} ${s}px ${SANS}`; while (g2.measureText(txt).width > w - 22 && s > 8) { s--; g2.font = `${weight} ${s}px ${SANS}`; } g2.fillText(txt, w / 2, yy); };
    if (l2) { fit(l1, Math.round(h * 0.34), h * 0.38, 700); fit(l2, Math.round(h * 0.2), h * 0.7, 500); } else fit(l1, Math.round(h * 0.46), h * 0.53, 800);
    for (const [sx, sy] of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]]) { g2.fillStyle = 'rgba(60,60,60,.9)'; g2.beginPath(); g2.arc(sx, sy, 2.6, 0, 7); g2.fill(); g2.fillStyle = 'rgba(200,200,200,.5)'; g2.fillRect(sx - 2, sy - 0.5, 4, 1); }
    grime(g2, w, h);
  });
  // Warn- und Hinweisschilder (frei erfunden)
  plate('ruecklauf', 'warn', 'ACHTUNG! ROHRRÜCKLAUF', 'Nicht im Rücklaufbereich aufhalten');
  plate('loescher', 'red', 'FEUERLÖSCHER', 'Im Brandfall Sicherung ziehen');
  plate('notaus', 'red', 'NOTAUS', '', 128, 48);
  plate('haupt', 'black', 'HAUPTSCHALTER', 'Batterie 24 V – vor Wartung trennen');
  plate('munition', 'warn', 'MUNITION', 'Rauchen und offenes Feuer verboten');
  plate('luke', 'white', 'LUKE VERRIEGELT?', 'Vor Fahrtantritt prüfen');
  plate('kopf', 'warn', 'KOPF EINZIEHEN', '', 256, 48);
  plate('funk', 'black', 'SPRECHFUNK SF-7', 'Kanal 1–8 · nur mit Kopfhörer');
  plate('bsa', 'black', 'BORDSPRECHANLAGE BS-4', 'Intern · Funk 1 · Funk 2');
  plate('hydraulik', 'warn', 'HYDRAULIK 180 bar', 'Leitungen nicht als Tritt benutzen');
  plate('huelse', 'white', 'HÜLSENSACK', 'Regelmäßig leeren');
  plate('tuer', 'red', 'SCHIEBETÜR', 'Im Gefecht geschlossen halten');
  plate('geprueft', 'green', 'GEPRÜFT 03/26', 'Feuerlöschanlage FLA-2', 192, 56);
  plate('turmsperre', 'warn', 'TURMSPERRE', 'Vor dem Ausstieg einlegen');
  plate('richt', 'black', 'RICHTANTRIEB', 'Elektrisch – Hand');
  plate('lenk', 'white', 'LENKHEBEL', 'Ziehen = Kette bremsen');
  plate('gang', 'black', 'GANGWAHL', 'R2  R1  N  1  2  3  4  5');
  plate('erstehilfe', 'green', 'ERSTE HILFE', 'Verbandkasten · Tragetuch', 192, 64);
  plate('wasser', 'blue', 'TRINKWASSER', '10 l', 160, 56);
  plate('kabel', 'warn', 'KABEL NICHT KNICKEN', '', 256, 40);
  plate('sitz', 'white', 'FAHRERSITZ', 'Hebel ziehen – Höhe verstellen');
  plate('luefter', 'black', 'LÜFTER', 'Nach dem Schuss einschalten');
  plate('zuendung', 'black', 'ANLASSEN', 'Vorglühen – Start');
  plate('diesel', 'olive', 'DIESEL 600 l', 'Behälter vorn rechts');
  plate('sicher', 'red', 'SICHER – FEUER', 'Ladeschütze', 192, 56);
  plate('nicht', 'warn', 'NICHT BETRETEN', '', 192, 40);
  plate('typ', 'ivory', 'RÜSTWERK NORD · Wanne 2147', 'Baujahr 2019 · Prüfung 03/26', 256, 56);
  plate('optik', 'black', 'OPTIK – NUR MIT TUCH', 'Augenmuschel sauber halten', 256, 56);
  plate('bodenluke', 'white', 'NOTAUSSTIEG', 'Hebel drehen – Luke fällt', 192, 56);
  plate('wk_achtung', 'ivory', 'ACHTUNG!', 'Rohrrücklauf – Abstand halten', 256, 64);
  plate('wk_munition', 'ivory', 'Munition', 'Nur mit Handschuhen greifen', 256, 64);
  plate('wk_funk', 'ivory', 'Empfänger E-3', 'Frequenz nicht verstellen', 256, 64);
  // Wartungsetiketten (frei erfunden) und Warnstreifen
  plate('w_oel', 'white', 'ÖLSTAND PRÜFEN', 'alle 50 Betriebsstunden · HL-46', 224, 56);
  plate('w_erde', 'green', 'ERDUNG', 'Masseband nicht lösen', 160, 48);
  plate('w_24v', 'warn', '24 V =', '', 128, 40);
  plate('w_hoch', 'red', 'HOCHSPANNUNG', 'Nur Fachpersonal öffnen', 224, 56);
  plate('w_schmier', 'ivory', 'SCHMIERSTELLE', 'Fett F-2 · wöchentlich', 192, 52);
  plate('w_pruef', 'white', 'GEPRÜFT 08/26', 'Instandsetzung Nord · Nr. 4471', 224, 52);
  plate('w_sprung', 'warn', 'SPRENGKLAPPE', 'Bunkerdecke nicht belasten', 224, 56);
  plate('w_kopf', 'black', 'KOPFSCHUTZ', 'Polster bei Riss ersetzen', 192, 52);
  plate('w_stau', 'olive', 'STAUFACH 3', 'Werkzeug · Abschleppseil', 192, 52);
  plate('w_hydr', 'black', 'HYDRAULIKÖL', 'HL-46 · max. 2,4 l', 192, 52);
  plate('w_nass', 'ivory', 'NASSLAGERUNG', 'Wasserstand täglich prüfen', 224, 56);
  plate('w_keil', 'warn', 'KEIL SCHLIESST SELBSTTÄTIG', 'Hand weg vom Ladeloch', 256, 56);
  plate('w_luke', 'white', 'LUKE', 'Hebel drehen – aufstoßen', 160, 48);
  plate('w_sitz', 'white', 'SITZ', 'Höhe: Hebel ziehen', 128, 44);
  plate('w_funk2', 'black', 'ANTENNENWAHL', 'A1 vorn · A2 hinten', 192, 52);
  // Schilder der Bedienteile (Simulation)
  for (const [k, t1, t2] of [['p_batterie', 'BATTERIE', 'EIN – AUS'], ['p_anlasser', 'ANLASSER', 'Vorglühen – Start'], ['p_licht', 'INNENLICHT', 'Gefecht · Arbeit · Aus'],
    ['p_bremse', 'FESTSTELLBREMSE', 'Knopf drücken – lösen'], ['p_waffe', 'WAFFE', 'Scharf – Gesichert'], ['p_antrieb', 'TURMANTRIEB', 'Elektrisch – Hand'],
    ['p_laser', 'LASER-EM', 'Messen'], ['p_wahl', 'MUNITIONSWAHL', 'Ladeschütze'], ['p_funk', 'FUNK', 'Senden – Empfang'], ['p_sicherung', 'SICHERUNG', 'Gesichert – Feuer'],
    ['p_funkein', 'FUNKGERÄT', 'Ein – Aus'], ['p_senden', 'SPRECHTASTE', 'Lagemeldung'], ['p_gurt', 'GURTKÄSTEN', 'je 150 Schuss']]) plate(k, 'black', t1, t2, 192, 48);
  put('streifen', 256, 32, (g2, w, h) => {
    g2.fillStyle = '#d8b021'; g2.fillRect(0, 0, w, h);
    g2.fillStyle = '#141414'; for (let i = -2; i < w / 16 + 2; i++) { g2.beginPath(); g2.moveTo(i * 32, 0); g2.lineTo(i * 32 + 16, 0); g2.lineTo(i * 32 + 16 - h, h); g2.lineTo(i * 32 - h, h); g2.fill(); }
    grime(g2, w, h, 0.6);
  });
  // Schablonenschrift direkt auf dem Anstrich (durchsichtiger Grund, Material 'schablone' mit alphaTest)
  const stencil = (key, text, w, h, col = 'rgba(240,236,224,0.92)', size = 0.62) => put(key, w, h, (g2) => {
    g2.clearRect(0, 0, w, h);
    g2.fillStyle = col; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.font = `700 ${Math.round(h * size)}px ${SANS}`;
    const parts = text.split('|');
    parts.forEach((t, i) => g2.fillText(t, w / 2, h * (i + 0.5) / parts.length));
    // Schablonenstege: feine Lücken quer durch die Zeichen
    g2.globalCompositeOperation = 'destination-out';
    for (let x = 6; x < w; x += 23) g2.fillRect(x, 0, 1.6, h);
    for (let i = 0; i < 120; i++) { g2.fillStyle = `rgba(0,0,0,${Math.random() * 0.5})`; g2.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2); }
    g2.globalCompositeOperation = 'source-over';
  });
  stencil('s_kampf', 'KAMPFRAUM', 256, 48);
  stencil('s_turm', 'TURMSPERRE ↓', 256, 48);
  stencil('s_ladesch', 'LADESCHÜTZE', 256, 48);
  stencil('s_richt', 'RICHTSCHÜTZE', 256, 48);
  stencil('s_kdt', 'KOMMANDANT', 256, 48);
  stencil('s_fahrer', 'FAHRER', 192, 48);
  stencil('s_nr', 'W 2147-3', 192, 48);
  stencil('s_kg', '24 kg', 128, 48);
  stencil('s_halt', 'HALTEGRIFF', 256, 48);
  stencil('s_tritt', 'KEIN TRITT', 256, 48, 'rgba(25,25,22,0.9)');
  stencil('s_pfeil', '▲ OBEN ▲', 192, 48, 'rgba(25,25,22,0.9)');
  stencil('s_wk', 'Kampfraum · Nr. 311', 256, 48, 'rgba(40,34,22,0.9)');
  // Mannschaftsraum (cabin-troop.js, Nutzer 21.11.)
  for (let i = 1; i <= 4; i++) stencil('s_platz' + i, 'PLATZ ' + i, 128, 40);
  stencil('s_notaus', 'NOTAUSSTIEG', 256, 40, 'rgba(25,25,22,0.9)');
  plate('w_rampe', 'warn', 'RAMPE', 'Nur im Stand öffnen – Bereich frei?', 224, 56);
  // Gebrauchsspuren als Abziehbilder (Nutzer 20.11.): Hülsen-Abdrücke (Rußring), Ölfleck – durchsichtiger Grund
  // (Nutzer 21.11.: Ölfleck hieß wie das Öldruck-Zifferblatt 'd_oel' → das Zifferblatt überschrieb ihn, Skalen lagen am Boden)
  put('d_ring', 128, 128, (g2, w, h) => {
    g2.clearRect(0, 0, w, h);
    for (let k = 0; k < 3; k++) {
      const r = 44 - k * 9 + Math.random() * 3;
      g2.strokeStyle = `rgba(${18 + k * 10},${15 + k * 8},${10 + k * 5},${0.95 - k * 0.2})`; g2.lineWidth = 5 - k;
      g2.beginPath(); for (let i = 0; i <= 48; i++) { const a = (i / 48) * PI * 2, rr = r + Math.sin(a * 5 + k) * 1.5; if (Math.random() < 0.12 && k) { g2.stroke(); g2.beginPath(); continue; } g2.lineTo(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr); } g2.stroke();
    }
    g2.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 160; i++) { g2.fillStyle = `rgba(0,0,0,${Math.random()})`; g2.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); }
    g2.globalCompositeOperation = 'source-over';
  });
  put('d_fleck', 128, 128, (g2, w, h) => {
    g2.clearRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { const x = w / 2 + (Math.random() - 0.5) * 50, y = h / 2 + (Math.random() - 0.5) * 40, r = 10 + Math.random() * 22; g2.fillStyle = `rgba(${22 + Math.random() * 10},${17 + Math.random() * 6},${8},0.95)`; g2.beginPath(); g2.ellipse(x, y, r, r * (0.6 + Math.random() * 0.4), Math.random() * 3, 0, 7); g2.fill(); }
    g2.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 90; i++) { g2.fillStyle = 'rgba(0,0,0,1)'; g2.beginPath(); g2.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, 7); g2.fill(); }
    g2.globalCompositeOperation = 'source-over';
  });
  // Klebeband mit Bleistiftnotizen an Konsolen (frei erfunden)
  const HAND = '"Segoe Print","Bradley Hand","Comic Sans MS","DejaVu Sans",cursive';
  const note = (key, text, w = 192, h = 48, tape = '#d9cfa6') => put(key, w, h, (g2) => {
    g2.fillStyle = tape; g2.fillRect(0, 0, w, h);
    // Kreppstruktur, ausgefranste Enden, Schmutz
    for (let x = 0; x < w; x += 3) { g2.fillStyle = `rgba(120,100,60,${0.04 + Math.random() * 0.06})`; g2.fillRect(x, 0, 1.5, h); }
    for (let y = 0; y < h; y += 2) { g2.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`; g2.fillRect(0, y, 2 + Math.random() * 3, 2); g2.fillRect(w - 2 - Math.random() * 3, y, 5, 2); }
    g2.fillStyle = 'rgba(55,52,48,0.85)'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.save(); g2.translate(w / 2, h / 2); g2.rotate(-0.03); g2.font = `500 ${Math.round(h * 0.48)}px ${HAND}`;
    let sz = Math.round(h * 0.48); while (g2.measureText(text).width > w - 14 && sz > 8) { sz--; g2.font = `500 ${sz}px ${HAND}`; }
    g2.fillText(text, 0, 1); g2.restore();
    for (let i = 0; i < 40; i++) { g2.fillStyle = `rgba(60,45,25,${Math.random() * 0.2})`; g2.beginPath(); g2.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, 7); g2.fill(); }
  });
  note('n_entf', 'Hof 1250 · Mast 900');
  note('n_kanal', 'K3 = Zug, K5 = Kp.');
  note('n_oel', 'Öl gepr. 14.11. – Wolf');
  note('n_batt', 'Batt. 2 schwach!');
  note('n_nicht', 'NICHT DRÜCKEN!!', 160, 44);
  note('n_band', ' ', 128, 32, '#bdb48f');
  note('n_wk', 'Richtpkt. Kirchturm 3-40', 224, 48, '#d6cba8');
  // Funkgerät-Front (modern): Anzeige, Drehknopf-Ringe, Beschriftung
  const radioFront = (key, title, freq) => put(key, 256, 128, (g2, w, h) => {
    g2.fillStyle = '#2a2d29'; g2.fillRect(0, 0, w, h);
    g2.fillStyle = '#121411'; g2.fillRect(14, 14, 110, 34);
    g2.fillStyle = '#9fdc5a'; g2.font = `700 24px ${SANS}`; g2.textBaseline = 'middle'; g2.textAlign = 'left'; g2.fillText(freq, 20, 32);
    g2.fillStyle = '#e4e0d2'; g2.font = `700 13px ${SANS}`; g2.fillText(title, 14, 64);
    g2.font = `500 10px ${SANS}`;
    const knobs = [[160, 34, 'KANAL'], [214, 34, 'LAUTST.'], [160, 92, 'BETRIEB'], [214, 92, 'LEISTUNG']];
    for (const [kx, ky, t] of knobs) {
      g2.strokeStyle = '#d9d4c4'; g2.lineWidth = 1.2; g2.beginPath(); g2.arc(kx, ky, 18, 0.75 * PI, 2.25 * PI); g2.stroke();
      for (let i = 0; i <= 8; i++) { const a = 0.75 * PI + i * 1.5 * PI / 8; g2.beginPath(); g2.moveTo(kx + Math.cos(a) * 18, ky + Math.sin(a) * 18); g2.lineTo(kx + Math.cos(a) * 22, ky + Math.sin(a) * 22); g2.stroke(); }
      g2.textAlign = 'center'; g2.fillStyle = '#e4e0d2'; g2.fillText(t, kx, ky + 30 > h ? ky - 26 : ky + 30);
    }
    g2.textAlign = 'left';
    for (let i = 0; i < 6; i++) { g2.fillStyle = '#121411'; g2.fillRect(16 + i * 18, 82, 12, 12); g2.fillStyle = '#d9d4c4'; g2.fillText(String(i + 1), 18 + i * 18, 104); }
    grime(g2, w, h, 1.2);
  });
  radioFront('radio1', 'SF-7 · FUNK 1', '46.750');
  radioFront('radio2', 'SF-7 · FUNK 2', '51.125');
  // Bordsprechkasten / Schalterfeld
  put('bsakasten', 128, 128, (g2, w, h) => {
    g2.fillStyle = '#2b2e29'; g2.fillRect(0, 0, w, h);
    g2.fillStyle = '#e4e0d2'; g2.font = `700 12px ${SANS}`; g2.textAlign = 'center'; g2.fillText('BS-4', w / 2, 16);
    g2.font = `500 9px ${SANS}`;
    for (const [kx, ky, t] of [[36, 52, 'INTERN'], [92, 52, 'FUNK 1'], [36, 104, 'FUNK 2'], [92, 104, 'LAUT']]) { g2.strokeStyle = '#d9d4c4'; g2.beginPath(); g2.arc(kx, ky, 15, 0, 7); g2.stroke(); g2.fillText(t, kx, ky + 24 > h ? ky - 20 : ky + 24); }
    grime(g2, w, h);
  });
  put('schalter', 256, 64, (g2, w, h) => {
    g2.fillStyle = '#1f211e'; g2.fillRect(0, 0, w, h);
    g2.fillStyle = '#e6e2d4'; g2.font = `700 10px ${SANS}`; g2.textAlign = 'center';
    const t = ['LICHT', 'LÜFTER', 'PUMPE', 'HEIZUNG', 'TURM'];
    t.forEach((s, i) => { const cx = 26 + i * 51; g2.fillText(s, cx, 12); g2.fillText('EIN', cx, 26); g2.fillText('AUS', cx, h - 6); g2.strokeStyle = '#777'; g2.strokeRect(cx - 9, 31, 18, 18); });
    grime(g2, w, h);
  });
  put('tasten', 192, 64, (g2, w, h) => {
    g2.fillStyle = '#1b1d1a'; g2.fillRect(0, 0, w, h);
    g2.fillStyle = '#e6e2d4'; g2.font = `700 12px ${SANS}`; g2.textAlign = 'center';
    ['PG', 'SG', 'MG'].forEach((s, i) => g2.fillText(s, 32 + i * 64, 14));
    g2.font = `500 9px ${SANS}`; g2.fillText('MUNITIONSWAHL', w / 2, h - 6);
    grime(g2, w, h);
  });
  // Rundinstrumente (Ziffernblätter): modern schwarz, 2. WK elfenbein, 1. WK Messing; Zeiger sind eigene Netze
  const dial = (key, face, ink, label, max, red = null, sub = '') => put(key, 128, 128, (g2, w) => {
    const cx = w / 2, cy = w / 2;
    g2.fillStyle = '#0d0d0d'; g2.fillRect(0, 0, w, w);
    g2.fillStyle = face; g2.beginPath(); g2.arc(cx, cy, 62, 0, 7); g2.fill();
    const a0 = 0.75 * PI, a1 = 2.25 * PI;
    if (red) { g2.strokeStyle = '#c0281c'; g2.lineWidth = 6; g2.beginPath(); g2.arc(cx, cy, 52, a0 + (a1 - a0) * red, a1); g2.stroke(); }
    g2.strokeStyle = ink; g2.fillStyle = ink;
    const n = 10;
    for (let i = 0; i <= n * 2; i++) {
      const a = a0 + (a1 - a0) * (i / (n * 2)), big = i % 2 === 0;
      g2.lineWidth = big ? 2.2 : 1.1;
      g2.beginPath(); g2.moveTo(cx + Math.cos(a) * (big ? 46 : 50), cy + Math.sin(a) * (big ? 46 : 50)); g2.lineTo(cx + Math.cos(a) * 56, cy + Math.sin(a) * 56); g2.stroke();
      if (big && i % 4 === 0) { g2.font = `700 12px ${SANS}`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(String(Math.round(max * i / (n * 2))), cx + Math.cos(a) * 36, cy + Math.sin(a) * 36); }
    }
    g2.font = `700 10px ${SANS}`; g2.textAlign = 'center'; g2.fillText(label, cx, cy + 22);
    if (sub) { g2.font = `500 8px ${SANS}`; g2.fillText(sub, cx, cy + 34); }
  });
  dial('d_rpm', '#141514', '#e8e6dc', '×100 /min', 30, 0.87);
  dial('d_kmh', '#141514', '#e8e6dc', 'km/h', 80);
  dial('d_oel', '#141514', '#e8e6dc', 'ÖL bar', 10, 0.9);
  dial('d_rpm6', '#141514', '#e8e6dc', '×100 /min', 60, 0.88);
  dial('d_kmh12', '#141514', '#e8e6dc', 'km/h', 120);
  dial('d_wasser', '#141514', '#e8e6dc', 'KÜHLW. ×10 °C', 12, 0.85);
  dial('w_rpm', '#e6dcbc', '#1b1712', 'U/min ×100', 35, 0.88);
  dial('w_kmh', '#e6dcbc', '#1b1712', 'km/h', 60);
  dial('w_oel', '#e6dcbc', '#1b1712', 'Öldruck', 10, 0.9);
  dial('w_az', '#e6dcbc', '#1b1712', 'Turm ×100 ‰', 64, null, 'Richtungsanzeiger');
  dial('e_rpm', '#c9a961', '#2a1d0c', 'Umdr. ×100', 16, 0.9);
  dial('e_oel', '#c9a961', '#2a1d0c', 'Öl', 6, 0.85);
  // Fahrerplatz 2. WK (Nutzer 21.11.): Kühlwasser-Fernthermometer, Kurskreisel-Rose, Beschriftung der Bedienteile
  dial('w_temp', '#e6dcbc', '#1b1712', 'Wasser ×10 °C', 12, 0.83);
  put('w_kurs', 128, 128, (g2, w) => {
    const cx = w / 2, cy = w / 2;
    g2.fillStyle = '#ddd2b0'; g2.beginPath(); g2.arc(cx, cy, 62, 0, 7); g2.fill();
    g2.strokeStyle = '#1b1712'; g2.fillStyle = '#1b1712';
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * PI * 2 - HP, big = i % 6 === 0;
      g2.lineWidth = big ? 2 : 1; g2.beginPath(); g2.moveTo(cx + Math.cos(a) * (big ? 46 : 52), cy + Math.sin(a) * (big ? 46 : 52)); g2.lineTo(cx + Math.cos(a) * 58, cy + Math.sin(a) * 58); g2.stroke();
    }
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    [['N', 0], ['O', 90], ['S', 180], ['W', 270]].forEach(([t, d]) => { const a = (d / 180) * PI - HP; g2.font = `800 15px ${SANS}`; g2.fillStyle = t === 'N' ? '#8a2a14' : '#1b1712'; g2.fillText(t, cx + Math.cos(a) * 34, cy + Math.sin(a) * 34); });
    g2.fillStyle = '#1b1712'; g2.font = `700 9px ${SANS}`;
    for (const d of [30, 60, 120, 150, 210, 240, 300, 330]) { const a = (d / 180) * PI - HP; g2.fillText(String(d / 10), cx + Math.cos(a) * 36, cy + Math.sin(a) * 36); }
    g2.font = `600 8px ${SANS}`; g2.fillText('KURSKREISEL', cx, cy + 14);
    grime(g2, w, w, 0.5);
  });
  plate('k_zuend', 'ivory', 'Zündung', 'Aus · Ein', 128, 40);
  plate('k_anl', 'ivory', 'Anlasser', 'drücken', 128, 40);
  plate('k_licht', 'ivory', 'Licht', 'Aus · Tarn · Innen', 128, 40);
  plate('k_klappe', 'ivory', 'Sehklappe', 'Glasblock bei Sprung tauschen', 160, 44);
  // Steppnaht-Polster (Höhe → Normalen, für die Polsterflächen)
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (y + rowH > H) console.warn('[cabin] Schilder-Atlas zu klein', y + rowH);
  ATLAS = { tex: t, rects };
  return ATLAS;
}

/** Blick durch ein Prisma: Himmel, dunstiger Horizont, Gelände, Randabschattung, grünliche Vergütung. */
let PRISM = null;
function prismTex() {
  if (PRISM) return PRISM;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, '#7f9fae'); gr.addColorStop(0.46, '#b9c8c4'); gr.addColorStop(0.5, '#7d8466'); gr.addColorStop(0.62, '#4f5638'); gr.addColorStop(1, '#2c2f21');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
  g.fillStyle = 'rgba(40,46,30,0.6)';
  for (let x = 0; x < 128; x += 2) { const h = 2 + Math.abs(Math.sin(x * 0.09) * 4 + Math.sin(x * 0.31) * 1.5); g.fillRect(x, 31 - h, 2, h); }
  const v = g.createRadialGradient(64, 32, 18, 64, 32, 72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,10,8,0.65)');
  g.fillStyle = v; g.fillRect(0, 0, 128, 64);
  PRISM = new THREE.CanvasTexture(c);
  PRISM.colorSpace = THREE.SRGBColorSpace;
  return PRISM;
}

/** Steppnaht-Normalenkarte (Rautenpolster). */
let QUILT = null;
function quiltNormal() {
  if (QUILT) return QUILT;
  const N = 128, h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + y) / N * 2, v = (x - y + N) / N * 2;
    const du = Math.abs((u % 1) - 0.5) * 2, dv = Math.abs((v % 1) - 0.5) * 2;
    h[y * N + x] = Math.min(1, Math.sqrt(Math.min(1 - du, 1 - dv) * 3));
  }
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  const at = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), o = (y * N + x) * 4;
    img.data[o] = (-dx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  QUILT = new THREE.CanvasTexture(c);
  QUILT.wrapS = QUILT.wrapT = THREE.RepeatWrapping; QUILT.repeat.set(6, 6); QUILT.anisotropy = 4;
  return QUILT;
}

/* ===================================================================== Bildschirme (Leinwand, live) */

const SCREENS = {};
function screen(key, w, h) {
  if (SCREENS[key]) return SCREENS[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = cabPatch(new THREE.MeshStandardMaterial({ name: 'cab:schirm-' + key, color: 0x050605, roughness: 0.25, metalness: 0, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.25 }));
  mat.userData.cabK = new THREE.Vector4(0, 0, 0, 3); mat.userData.noEdge = true;
  SCREENS[key] = { c, g: c.getContext('2d'), t, mat, last: '', at: -1 };
  return SCREENS[key];
}

const MONO = '"DejaVu Sans Mono","Courier New",monospace';
/** Feuerleitrechner (grün, monochrom): Entfernung, Munition, Bereitschaft, Rohrerhöhung, Turmwinkel, Ladefortschritt. */
function drawFcs(S, d) {
  const key = `${d.range}|${d.ammo}|${d.ready}|${d.elev}|${d.az}|${d.load}|${d.therm}|${Math.floor(d.t * 2) % 2}`;
  if (key === S.last) return;
  S.last = key;
  const g = S.g, w = S.c.width, h = S.c.height;
  g.fillStyle = '#020502'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(80,255,120,0.04)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  const G1 = '#7dff8a', G2 = '#3fae4c';
  g.fillStyle = G2; g.fillRect(0, 0, w, 18);
  g.fillStyle = '#021'; g.font = `700 12px ${MONO}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('FLR-3  FEUERLEITRECHNER', 6, 10);
  g.fillStyle = G1; g.font = `700 13px ${MONO}`;
  g.fillText('ENTF.', 8, 34); g.font = `700 30px ${MONO}`; g.fillText(d.range, 60, 38);
  g.font = `700 12px ${MONO}`; g.fillText('m', 210, 42);
  g.fillText(`MUN  ${d.ammo}`, 8, 70);
  g.fillText(`ERH. ${d.elev}`, 8, 88);
  g.fillText(`TURM ${d.az}`, 8, 106);
  g.fillText(`WÄRMEBILD ${d.therm ? 'EIN' : 'AUS'}`, 8, 124);
  // Bereitschaft (blinkt beim Laden)
  const ready = d.ready === 'BEREIT';
  if (ready || Math.floor(d.t * 2) % 2) { g.fillStyle = ready ? G1 : '#ffd25a'; g.fillRect(150, 62, 98, 22); g.fillStyle = '#020'; g.textAlign = 'center'; g.fillText(d.ready, 199, 74); g.textAlign = 'left'; }
  g.strokeStyle = G2; g.strokeRect(150, 92, 98, 10);
  g.fillStyle = G1; g.fillRect(151, 93, 96 * clamp(d.load, 0, 1), 8);
  g.fillStyle = G2; g.font = `500 10px ${MONO}`; g.fillText('LADEN', 150, 114);
  g.fillText('BAL OK  NEIG OK  WIND 2', 8, h - 8);
  S.t.needsUpdate = true;
}

/** Lagebild des Kommandanten: Raster, Nordpfeil, eigenes Fahrzeug, Turmrichtung, Funkstatus. */
function drawCmd(S, d) {
  const key = `${Math.round(d.hdg * 40)}|${Math.round(d.tur * 40)}|${d.team}|${Math.floor(d.t)}`;
  if (key === S.last) return;
  S.last = key;
  const g = S.g, w = S.c.width, h = S.c.height;
  g.fillStyle = '#071008'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(110,200,120,0.22)'; g.lineWidth = 1;
  const cx = w / 2, cy = h / 2 + 8, a = d.hdg;
  g.save(); g.translate(cx, cy); g.rotate(a);
  for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(i * 24, -150); g.lineTo(i * 24, 150); g.stroke(); g.beginPath(); g.moveTo(-150, i * 24); g.lineTo(150, i * 24); g.stroke(); }
  // Geländelinien (frei)
  g.strokeStyle = 'rgba(200,170,90,0.45)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(-140, 30); g.bezierCurveTo(-60, -10, 10, 60, 140, 10); g.stroke();
  g.beginPath(); g.moveTo(-90, -120); g.bezierCurveTo(-40, -60, 30, -90, 120, -40); g.stroke();
  // Nordpfeil
  g.fillStyle = '#9fe6a6'; g.beginPath(); g.moveTo(0, -78); g.lineTo(-6, -64); g.lineTo(6, -64); g.fill();
  g.font = `700 11px ${MONO}`; g.textAlign = 'center'; g.fillText('N', 0, -86);
  // Freund-/Feindmarken (fest, frei erfunden)
  g.fillStyle = d.team === 'B' ? '#ff6650' : '#5aa0ff'; g.fillRect(-52, -30, 10, 7); g.fillRect(40, 44, 10, 7);
  g.fillStyle = d.team === 'B' ? '#5aa0ff' : '#ff6650'; g.beginPath(); g.moveTo(70, -60); g.lineTo(78, -52); g.lineTo(70, -44); g.lineTo(62, -52); g.fill();
  g.restore();
  // Eigenes Fahrzeug (Blick nach oben) + Turmrichtung
  g.save(); g.translate(cx, cy);
  g.strokeStyle = '#d6ffd9'; g.lineWidth = 2; g.strokeRect(-6, -10, 12, 20);
  g.rotate(-d.tur); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -26); g.stroke();
  g.restore();
  g.fillStyle = '#163a1b'; g.fillRect(0, 0, w, 16);
  g.fillStyle = '#b8f5be'; g.font = `700 11px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(`LAGEBILD  KURS ${String(Math.round(((-d.hdg * 180 / PI) % 360 + 360) % 360)).padStart(3, '0')}°`, 6, 8);
  g.fillText(`FUNK 1 ${Math.floor(d.t) % 7 === 0 ? 'SENDET' : 'BEREIT'}`, 6, h - 8);
  S.t.needsUpdate = true;
}

/** Fahreranzeige (modern): Gang, Tempo, Drehzahlbalken, Kraftstoff, Warnungen. */
function drawDrv(S, d) {
  const key = `${d.gear}|${d.kmh}|${Math.round(d.rpm * 20)}|${d.warn}`;
  if (key === S.last) return;
  S.last = key;
  const g = S.g, w = S.c.width, h = S.c.height;
  g.fillStyle = '#080604'; g.fillRect(0, 0, w, h);
  const A = '#ffb347';
  g.fillStyle = A; g.font = `700 44px ${MONO}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText(d.gear, 10, 40);
  g.font = `700 28px ${MONO}`; g.textAlign = 'right'; g.fillText(String(d.kmh), w - 44, 34);
  g.font = `600 11px ${MONO}`; g.fillText('km/h', w - 8, 40);
  g.strokeStyle = A; g.strokeRect(10, 76, w - 20, 12);
  g.fillRect(11, 77, (w - 22) * clamp(d.rpm, 0, 1), 10);
  g.textAlign = 'left'; g.font = `600 11px ${MONO}`; g.fillText('DREHZAHL', 10, 98);
  g.fillText('KRAFTSTOFF 72 %', 10, 114);
  if (d.warn) { g.fillStyle = '#ff4a2a'; g.fillText(d.warn, 130, 114); }
  S.t.needsUpdate = true;
}

/* ===================================================================== Materialien (Klone mit Innenraum-Licht) */

/** Geteilte Uniforms des Innenlichts (nur ein lokaler Insasse → ein Satz). Sechs Leuchten: 0–3 mit gebackenem Schatten
 * (Kuppellampen), 4–5 ohne (Bildschirme, Leuchtmelder, Tageslicht der Winkelspiegel). Dazu Tageslicht durch eine offene
 * Luke (Lichtkegel von oben), Raum des Insassen (uCabSet: 0 Turm, 1 Fahrerraum) für die Schattenzuordnung. */
const NL = 6;
const CAB_U = {
  uCabLP: { value: Array.from({ length: NL }, () => new THREE.Vector3()) },
  uCabLC: { value: Array.from({ length: NL }, () => new THREE.Color(0, 0, 0)) },
  uCabAmb: { value: 0.32 }, uCabSun: { value: 0.12 }, uCabWear: { value: 1 }, uCabSet: { value: 0 },
  uCabHP: { value: new THREE.Vector3() }, uCabHC: { value: new THREE.Color(0, 0, 0) },
};

/** Abnutzungs-Masken (cab_wear, RGBA: Kratzer, Schlieren, Abplatzer, Fingerabdrücke) – Platzhalter bis zum Laden. */
const WEAR0 = (() => { const t = new THREE.DataTexture(new Uint8Array([0, 80, 0, 90]), 1, 1); t.needsUpdate = true; return t; })();
CAB_U.uCabGr = { value: WEAR0 };
CAB_U.uCabEra = { value: new THREE.Vector4(0.2, 0, 0.5, 0) }; // x Rost, y –, z Staub, w –

/**
 * Innenraum-Shader: Innenlicht (Punktlichter, gebackene Verdeckung/Schatten) und Gebrauchsspuren (Nutzer 20.11.):
 * Kantenabrieb aus der gebackenen Kantenmaske (cabE) mit freigelegter Grundierung und blankem Metall, Lackabplatzer,
 * Kratzer, Rost in Abplatzern und als Läufer (je Ära), Staub auf waagrechten Flächen und in Ecken, Öl/Fett, Fingerabdrücke
 * an Griffen und Bildschirmen, abgelaufenes Riffelblech, abgewetzte Polster, verblasste/abgekratzte Aufkleber.
 * Masken triplanar im Objektraum aus cab_wear (CAB_GR, ab medium), sonst prozedural. uCabK je Material:
 * x Lack (Abrieb), y Rost-Neigung, z Stoff/Gummi, w Sonderfall (1 Riffelboden, 2 Aufkleber, 3 Bildschirm).
 */
function cabinShader(sh, renderer, mat) {
  Object.assign(sh.uniforms, CAB_U);
  sh.uniforms.uCabK = { value: (mat && mat.userData.cabK) || new THREE.Vector4(0, 0, 0, 0) };
  ensureWorldVaryings(sh);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec4 vCabO4;\nvarying vec4 vCabN4;\nattribute vec3 cabA;\nattribute vec2 cabS0;\nattribute vec2 cabS1;\nattribute vec4 cabE;\nvarying vec4 vCabS;\nvarying vec4 vCabE;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n// gepackt (Varyings sparen): O4 = Objektlage + Verdeckung, N4 = Objektnormale + Abnutzung + 2 × Raum\nvCabO4 = vec4( position, cabA.x );\nvCabN4 = vec4( normal, clamp( cabA.y, 0.0, 1.0 ) + 2.0 * step( 0.5, cabA.z ) );\nvCabS = vec4( cabS0, cabS1 );\nvCabE = cabE;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec4 vCabO4; varying vec4 vCabN4; varying vec4 vCabS; varying vec4 vCabE;
      #define vCabO vCabO4.xyz
      #define vCabA vec3( vCabO4.w, vCabN4.w - 2.0 * step( 1.5, vCabN4.w ), step( 1.5, vCabN4.w ) )
      uniform vec3 uCabLP[ ${NL} ]; uniform vec3 uCabLC[ ${NL} ]; uniform float uCabAmb; uniform float uCabSun; uniform float uCabWear; uniform float uCabSet;
      uniform vec3 uCabHP; uniform vec3 uCabHC; uniform vec4 uCabK; uniform vec4 uCabEra;
      float cbH( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
      float cbN( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( mix( cbH( i ), cbH( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( cbH( i + vec3( 0.0, 1.0, 0.0 ) ), cbH( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
                    mix( mix( cbH( i + vec3( 0.0, 0.0, 1.0 ) ), cbH( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( cbH( i + vec3( 0.0, 1.0, 1.0 ) ), cbH( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z ); }
      #ifdef CAB_GR
      uniform sampler2D uCabGr;
      vec4 cbMask( vec3 p, vec3 n ) {
        vec3 w = pow( abs( n ), vec3( 6.0 ) ); w /= max( 1e-4, w.x + w.y + w.z );
        const float s = 1.6667;
        return texture2D( uCabGr, p.zy * s ) * w.x + texture2D( uCabGr, p.xz * s + 0.37 ) * w.y + texture2D( uCabGr, p.xy * s + 0.71 ) * w.z;
      }
      #else
      vec4 cbMask( vec3 p, vec3 n ) {
        return vec4( smoothstep( 0.86, 0.97, cbN( p * vec3( 70.0, 4.0, 70.0 ) ) ), cbN( p * vec3( 7.0, 1.0, 7.0 ) ), smoothstep( 0.62, 0.8, cbN( p * 19.0 ) ), cbN( p * 11.0 + 3.0 ) );
      }
      #endif
      float cbPrim = 0.0, cbBare = 0.0, cbRust = 0.0, cbScr = 0.0, cbFing = 0.0, cbDust = 0.0, cbDirt = 0.0, cbAO = 0.0, cbHgt = 0.0, cbPol = 0.0;`)
    .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 cbNo = normalize( vCabN4.xyz ); // Objektnormale
        vec4 cbM = cbMask( vCabO, cbNo );
        cbAO = clamp( vCabA.x, 0.0, 1.0 );
        float cbWr = clamp( vCabA.y, 0.0, 1.0 );                         // Griffstellen (gebaut)
        float cbE0 = min( min( vCabE.x, vCabE.y ), vCabE.z );
        float cbEdge = max( 1.0 - smoothstep( 0.0, 0.009, cbE0 ), clamp( vCabE.w, 0.0, 1.0 ) * 0.85 );
        float cbLo = cbN( vCabO * 1.4 + 5.0 );                            // stark/schwach abgenutzte Zonen
        float W = uCabWear;
        vec3 cbC = diffuseColor.rgb;
        if ( uCabK.w > 1.5 && uCabK.w < 2.5 ) {
          // Aufkleber/Schilder: ausgebleicht, angeschmutzt, Ecken und Streifen abgekratzt
          float l = dot( cbC, vec3( 0.3, 0.59, 0.11 ) );
          cbC = mix( cbC, vec3( l ) * 1.05 + 0.03, ( 0.18 + 0.35 * cbLo ) * W );
          float sc = max( smoothstep( 0.4, 0.7, cbM.r ) * 0.6, smoothstep( 0.72, 0.88, cbM.b * ( 0.5 + cbLo ) ) );
          cbC = mix( cbC, vec3( 0.55, 0.53, 0.48 ), sc * W );
          cbC *= 1.0 - 0.25 * cbM.g * W;
          cbScr = sc;
        } else {
          if ( uCabK.x > 0.0 ) {
            // Kantenabrieb: Lack → Grundierung (rotbraun) → blankes Metall, ausgefranst über die Abplatzer-Maske
            // nur stellenweise (Abplatzer-Maske × feines Rauschen × Zonen), Griffstellen stärker
            float en = cbM.b * 0.8 + cbN( vCabO * 55.0 ) * 0.45 + cbLo * 0.35;
            float e = cbEdge * ( en + uCabEra.y ) + cbWr * ( 0.35 + 0.5 * cbM.b + 0.2 * cbN( vCabO * 30.0 ) );
            cbPrim = smoothstep( 0.78, 0.84, e ) * W * uCabK.x;
            cbBare = smoothstep( 0.98, 1.06, e + cbM.r * 0.15 ) * W * uCabK.x;
            // Abplatzer auf der Fläche (gruppiert, eher unten)
            // (Nutzer 21.11.: auf Decken wirkten die Flächen-Abplatzer wie Spritzer → dort selten, eher an Kanten)
            float fc = cbM.b * smoothstep( 0.42 - uCabEra.y, 0.85, cbLo ) * ( 1.15 - 0.5 * smoothstep( 0.2, 0.7, vCabO.y ) ) * ( 1.0 - 0.75 * smoothstep( 0.3, 0.8, -cbNo.y ) );
            cbPrim = max( cbPrim, smoothstep( 0.5, 0.56, fc ) * W * uCabK.x );
            cbBare = max( cbBare, smoothstep( 0.7, 0.78, fc ) * W * uCabK.x );
            // Kratzer und Schrammen im Lack
            cbScr = smoothstep( 0.16, 0.5, cbM.r ) * ( 0.3 + 0.7 * smoothstep( 0.25, 0.75, cbLo ) ) * W * uCabK.x;
            float lum = dot( cbC, vec3( 0.3, 0.59, 0.11 ) );
            cbC = mix( cbC, mix( vec3( 0.36, 0.34, 0.31 ), cbC * 1.3 + 0.05, step( lum, 0.25 ) ), cbScr * 0.55 );
            // Grundierung: matt graubraun-ocker (kein Rot – Nutzer 21.11.: rote Flecken wirkten wie Blut)
            cbC = mix( cbC, vec3( 0.2, 0.115, 0.062 ) * ( 0.8 + 0.4 * cbN( vCabO * 70.0 ) ), cbPrim );
            cbC = mix( cbC, vec3( 0.52, 0.51, 0.49 ) * ( 0.85 + 0.3 * cbN( vCabO * 150.0 ) ), cbBare );
            cbHgt = -( cbPrim + cbBare ) * 0.00035;
          }
          if ( uCabK.z > 0.0 ) {
            // Stoff/Gummi/Polster: abgewetzt (heller, glänzend) an Kanten und Griffstellen, Fettflecken
            float sc = smoothstep( 0.45, 0.85, cbEdge * 0.7 + cbWr * 0.9 + cbM.g * 0.35 ) * W * uCabK.z;
            cbC = mix( cbC, cbC * 1.45 + vec3( 0.035, 0.032, 0.028 ), sc );
            cbC *= 1.0 - 0.3 * smoothstep( 0.55, 0.9, cbM.a * cbLo * 1.6 ) * W * uCabK.z;
            cbPol = sc;
          }
          // blankes Metall (Stahl, Messing): Kratzer nur als Glanzunterschied
          if ( uCabK.x <= 0.0 && uCabK.z <= 0.0 && uCabK.w < 0.5 ) {
            cbScr = smoothstep( 0.2, 0.6, cbM.r ) * W * 0.5;
            cbC *= ( 1.0 - 0.35 * smoothstep( 0.35, 0.9, cbM.g ) * W ) * ( 1.0 + 0.25 * cbScr );
          }
          // Rost (Nutzer 21.11.: braun-orange und körnig, an Kanten, Nähten und als Läufer – keine Spritzerform, kein Blutrot):
          // an abgestoßenen Kanten/Griffstellen, in Abplatzern nahe Kanten, Läufer senkrecht unter Kanten, feine Körnung
          float ra = uCabEra.x * uCabK.y * W;
          if ( ra > 0.0 ) {
            float gr = cbN( vCabO * 260.0 ), gr2 = cbN( vCabO * 95.0 + 3.1 );
            float edgeZone = max( 1.0 - smoothstep( 0.0, 0.03, cbE0 ), clamp( vCabE.w, 0.0, 1.0 ) );
            float spot = max( cbBare, cbPrim * 0.5 ) * ( 0.25 + 0.75 * edgeZone ) * smoothstep( 0.35, 0.65, cbN( vCabO * 40.0 ) + 0.25 * ra );
            float seam = edgeZone * smoothstep( 0.5, 0.8, cbN( vCabO * 18.0 + 7.0 ) * 0.7 + cbLo * 0.5 ) * ra;
            float vert = 1.0 - smoothstep( 0.4, 0.75, abs( cbNo.y ) );
            float run = smoothstep( 0.35, 0.8, cbM.g ) * smoothstep( 0.5, 0.82, cbN( vec3( vCabO.x * 14.0, vCabO.y * 0.9, vCabO.z * 14.0 ) ) ) * vert * ( 0.4 + 0.6 * edgeZone );
            cbRust = clamp( spot * 1.1 + seam * 0.8 + run * 0.55, 0.0, 1.0 ) * min( 1.0, ra );
            cbRust *= smoothstep( 0.15, 0.55, gr * 0.6 + gr2 * 0.6 ); // körnig, ausgefranster Rand
            vec3 rc = mix( vec3( 0.19, 0.085, 0.032 ), vec3( 0.43, 0.205, 0.075 ), gr2 * 0.7 + gr * 0.3 );
            rc = mix( rc, vec3( 0.12, 0.07, 0.04 ), smoothstep( 0.7, 0.95, gr ) * 0.6 ); // dunkle Körner
            cbC = mix( cbC, rc, cbRust * 0.8 );
            cbHgt += cbRust * ( 0.00015 + 0.00025 * gr );
          }
          // Fingerabdrücke / Fettfilm an Griffen und Bildschirmen
          cbFing = cbM.a * smoothstep( 0.15, 0.6, cbWr + ( uCabK.w > 2.5 ? 0.7 : 0.0 ) ) * W;
          cbC *= 1.0 - 0.22 * cbFing * ( 1.0 - cbBare );
          // Staub auf waagrechten Flächen und in Ecken (bräunlich-grau, matt)
          cbDust = smoothstep( 0.55, 0.95, cbNo.y ) * uCabEra.z * W * ( 0.3 + 0.7 * smoothstep( 0.2, 0.8, cbM.g + cbAO * 0.6 ) ) * ( 1.0 - cbWr );
          cbC = mix( cbC, vec3( 0.36, 0.33, 0.28 ), cbDust * 0.55 );
        }
        // gebackene Verdeckung: Schmutz sammelt sich in Ecken, Fugen und unter Bauteilen (bräunlich, fleckig)
        cbDirt = smoothstep( 0.18, 0.75, cbAO ) * ( 0.45 + 0.55 * cbN( vCabO * 9.0 + 2.0 ) ) * W;
        cbC = mix( cbC, cbC * vec3( 0.55, 0.49, 0.4 ), cbDirt * 0.6 );
        diffuseColor.rgb = cbC;
      }`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      #if defined( USE_ROUGHNESSMAP )
      if ( uCabK.w > 0.5 && uCabK.w < 1.5 ) {
        // Riffelblech: erhabene Rauten in den Laufwegen blank gelaufen (Höhe steckt im ORM-R-Kanal)
        float raised = smoothstep( 0.86, 0.96, texelRoughness.r );
        float path = smoothstep( 0.3, 0.75, cbN( vec3( vCabO.x * 1.6, 0.0, vCabO.z * 1.6 ) ) ) * uCabWear;
        cbPol = raised * path;
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.62, 0.61, 0.58 ), cbPol * 0.8 );
      }
      #endif
      roughnessFactor = clamp( roughnessFactor + cbDirt * 0.15, 0.04, 1.0 );
      roughnessFactor = mix( roughnessFactor, roughnessFactor + 0.15, cbScr * 0.6 );
      roughnessFactor = mix( roughnessFactor, 0.66, cbPrim * ( 1.0 - cbBare ) );
      roughnessFactor = mix( roughnessFactor, 0.3, cbBare );
      roughnessFactor = mix( roughnessFactor, 0.3, cbPol * 0.7 );
      roughnessFactor = mix( roughnessFactor, 0.92, max( cbRust, cbDust ) );
      roughnessFactor = mix( roughnessFactor, 0.2, cbFing * 0.85 );`)
    .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      metalnessFactor = mix( metalnessFactor, 0.0, cbPrim * ( 1.0 - cbBare ) );
      metalnessFactor = mix( metalnessFactor, 0.92, max( cbBare, cbPol * 0.8 ) * ( 1.0 - cbRust ) );
      metalnessFactor = mix( metalnessFactor, 0.0, max( cbRust, cbDust ) );`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        // Abplatzer liegen tiefer als der Lack, Rost trägt auf (Höhe aus den Masken, Ableitungen im Bildraum)
        vec3 dpx = mat3( viewMatrix ) * dFdx( vNpWorld ), dpy = mat3( viewMatrix ) * dFdy( vNpWorld );
        vec2 dh = vec2( dFdx( cbHgt ), dFdy( cbHgt ) );
        vec3 r1 = cross( dpy, normal ), r2 = cross( normal, dpx );
        float dt = dot( dpx, r1 );
        if ( abs( dt ) > 1e-12 ) normal = normalize( abs( dt ) * normal - sign( dt ) * ( dh.x * r1 + dh.y * r2 ) );
      }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if ( uCabK.w > 2.5 ) totalEmissiveRadiance *= 1.0 - 0.3 * cbFing; // Fingerabdrücke auf Bildschirmen`)
    .replace('#include <aomap_fragment>', `
      // geschlossener Stahlkasten: Sonne/Himmel kaum, dafür Innenleuchten (Punktlichter im Weltraum)
      float cbAmbO = 1.0 - cbAO * 0.7;
      reflectedLight.directDiffuse *= uCabSun; reflectedLight.directSpecular *= uCabSun;
      reflectedLight.indirectDiffuse *= uCabAmb * cbAmbO; reflectedLight.indirectSpecular *= uCabAmb * cbAmbO;
      {
        vec3 cbNw = normalize( inverseTransformDirection( normal, viewMatrix ) );
        vec3 cbV = normalize( cameraPosition - vNpWorld );
        // Öl auf waagrechten Flächen in Bodennähe (Pfützen glänzen dunkel)
        float cbOil = smoothstep( 0.72, 0.86, cbN( vCabO * 3.3 + 7.0 ) ) * smoothstep( 0.75, 0.95, cbNw.y ) * uCabWear * ( 0.4 + cbAO ) * ( 1.0 - cbDust );
        diffuseColor.rgb *= 1.0 - cbOil * 0.55;
        float cbR4 = max( pow( mix( roughnessFactor, 0.12, cbOil ), 4.0 ), 0.0015 );
        float cbSh = clamp( 2.0 / cbR4 - 2.0, 1.0, 900.0 );
        bool cbOwn = abs( vCabA.z - uCabSet ) < 0.5;
        float cbDirO = 1.0 - cbAO * 0.45; // Kontaktschatten auch für das Lampenlicht
        float cbSpec = mix( 0.04, 1.0, metalnessFactor );
        for ( int i = 0; i < ${NL}; i ++ ) {
          vec3 L = uCabLP[ i ] - vNpWorld; float d2 = max( dot( L, L ), 1e-4 ); L *= inversesqrt( d2 );
          float att = 1.0 / ( 1.0 + d2 * 7.0 );
          float vis = 1.0;
          if ( cbOwn && i < 4 ) vis = 1.0 - ( i == 0 ? vCabS.x : i == 1 ? vCabS.y : i == 2 ? vCabS.z : vCabS.w ) * 0.92;
          float nl = max( dot( cbNw, L ), 0.0 );
          float wrapL = clamp( ( dot( cbNw, L ) + 0.35 ) / 1.35, 0.0, 1.0 );
          reflectedLight.directDiffuse += diffuseColor.rgb * ( 1.0 - metalnessFactor * 0.85 ) * uCabLC[ i ] * mix( nl, wrapL, 0.35 ) * att * vis * cbDirO;
          vec3 Hh = normalize( L + cbV );
          reflectedLight.directSpecular += uCabLC[ i ] * pow( max( dot( cbNw, Hh ), 0.0 ), cbSh ) * ( cbSh + 2.0 ) / 8.0 * nl * att * vis * mix( 0.12, 0.35, cbOil ) * cbSpec * mix( vec3( 1.0 ), diffuseColor.rgb * 1.6 + 0.2, metalnessFactor );
        }
        // Tageslicht durch eine offene Luke: Kegel von oben, weich, ohne Schatten (Verdeckung dämpft)
        vec3 cbHL = uCabHP - vNpWorld; float cbHd2 = max( dot( cbHL, cbHL ), 1e-4 ); cbHL *= inversesqrt( cbHd2 );
        float cbCone = smoothstep( 0.35, 0.85, cbHL.y );
        reflectedLight.directDiffuse += diffuseColor.rgb * uCabHC * clamp( ( dot( cbNw, cbHL ) + 0.25 ) / 1.25, 0.0, 1.0 ) * cbCone / ( 1.0 + cbHd2 * 1.6 ) * cbAmbO;
      }
      #include <aomap_fragment>`);
}
function cabPatch(m) {
  if (CABGR) m.defines = { ...(m.defines || {}), CAB_GR: '' };
  addShaderPatch(m, 'cabin', cabinShader); m.userData.cabin = true; return m;
}

/** Zusatzsätze laden (ab medium): Masken für Gebrauchsspuren, Riffelblech, Stoffstruktur der Splitterschutzmatten. */
function loadCabinSets(det) {
  const tier = det >= 2 ? 1024 : 512;
  (async () => {
    try {
      if (!assets.renderer) return;
      await assets.ready();
      const [wear, riffel, fab] = await Promise.all(['cab_wear', 'cab_riffel', 'fabric_uniform'].map((id) => assets.loadTextureSet(id, tier).catch(() => null)));
      if (wear && wear.ormMap) { const t = wear.ormMap; t.anisotropy = Math.max(t.anisotropy || 1, 4); CAB_U.uCabGr.value = t; }
      if (riffel && CM) {
        const f = CM.floor, rep = 1 / 0.45;
        for (const t of [riffel.map, riffel.normalMap, riffel.ormMap]) { t.repeat.set(rep, rep); t.anisotropy = Math.max(t.anisotropy || 1, 8); }
        Object.assign(f, { map: riffel.map, normalMap: riffel.normalMap, aoMap: riffel.ormMap, roughnessMap: riffel.ormMap, metalnessMap: riffel.ormMap, roughness: 1, metalness: 1, aoMapIntensity: 0.6 });
        f.color.setHex(0xb6b4ad); f.normalScale.set(1, 1);
        f.needsUpdate = true;
      }
      if (fab && CM) {
        const n = fab.normalMap.clone(); n.repeat.set(5, 5); n.needsUpdate = true;
        CM.liner.normalMap = n; CM.liner.normalScale = new THREE.Vector2(0.8, 0.8); CM.liner.needsUpdate = true;
      }
    } catch (err) { console.info('[cabin] Zusatztexturen nicht verfügbar – prozedural.', err && err.message); }
  })();
}

let CM = null;
/** Innenraum-Materialsatz (lazy). Klone der Fahrzeugmaterialien behalten deren Fotoscan-Texturen (resync bei Bedarf). */
let CABGR = false;
const K4 = (x = 0, y = 0, z = 0, w = 0) => new THREE.Vector4(x, y, z, w);
function cabinMats(S, det = 2) {
  if (CM) return CM;
  CABGR = det >= 1; // Masken-Textur nur ab medium (low: prozedurale Masken, keine Zusatztexturen)
  const pairs = [];
  const clone = (base, name, params = {}) => {
    const m = base.clone();
    if (!copyShaderPatches(base, m)) { m.onBeforeCompile = THREE.Material.prototype.onBeforeCompile; m.customProgramCacheKey = THREE.Material.prototype.customProgramCacheKey; }
    m.name = 'cab:' + name;
    const col = params.color; delete params.color;
    Object.assign(m, params);
    if (col != null) m.color = new THREE.Color(col);
    pairs.push([m, base]);
    return cabPatch(m);
  };
  const std = (name, p, k = null) => { const m = cabPatch(new THREE.MeshStandardMaterial({ name: 'cab:' + name, ...p })); if (k) m.userData.cabK = k; return m; };
  const A = atlas();
  const paintSrc = S.paint.null;
  // Lack: seidenmatt (Rauheit × ORM ≈ 0,45–0,5), Normalen/ORM aus dem Lack-Fotoscan (resync)
  const wall = (name, color, rough, metal, k = K4(1, 1, 0, 0)) => {
    const m = std(name, { color, roughness: rough, metalness: metal, normalScale: new THREE.Vector2(0.35, 0.35) }, k);
    m.userData.wallFrom = paintSrc;
    return m;
  };
  const tag = (m, k) => { m.userData.cabK = k; return m; };
  CM = {
    pairs,
    // Wandanstrich je Ära (Nutzer 20.11.): modern hellgrau/weiß, Kalter Krieg hellgrün, 2. WK Elfenbein, 1. WK Creme
    wall: { modern: wall('wand', 0xc6c9c0, 0.95, 0.08, K4(1, 0.6, 0, 0)), kk: wall('wand-kk', 0xa3b48f, 0.95, 0.08, K4(1, 0.8, 0, 0)), wk2: wall('wand2', 0xd8ceac, 0.95, 0.06), wk1: wall('wand1', 0xcabd98, 1.0, 0.06) },
    // Riffelblech (cab_riffel, ab medium): blanker Stahl, erhabene Rauten in den Laufwegen poliert
    floor: std('boden', { color: 0x8c8c86, roughness: 0.6, metalness: 0.5 }, K4(0, 1, 0, 1)),
    // Halter, Gehäuse, Gussteile: dunkel graugrün lackiert
    metal: wall('metall', 0x585d52, 0.95, 0.15),
    steel: tag(clone(S.steel, 'stahl', { color: 0x7e8286, roughness: 0.36, metalness: 0.85 }), K4(0, 0.8, 0, 0)),
    breech: tag(clone(S.steel, 'verschluss', { color: 0x5c5b57, roughness: 0.44, metalness: 0.85 }), K4(0, 0.5, 0, 0)),
    black: wall('schwarz', 0x1e1f1d, 0.85, 0.2, K4(0.7, 0.4, 0, 0)),
    olive: wall('oliv', 0x4b5337, 0.95, 0.12),
    rubber: tag(clone(S.rubber, 'gummi', { roughness: 0.9 }), K4(0, 0, 0.6, 0)),
    canvas: tag(clone(S.canvas, 'segeltuch'), K4(0, 0, 1, 0)),
    pad: std('polster', { color: 0x2f3128, roughness: 0.7, metalness: 0, normalMap: quiltNormal(), normalScale: new THREE.Vector2(0.9, 0.9) }, K4(0, 0, 1, 0)),
    leather: std('leder', { color: 0x4a3322, roughness: 0.58, metalness: 0, normalMap: quiltNormal(), normalScale: new THREE.Vector2(0.6, 0.6) }, K4(0, 0, 1, 0)),
    // Splitterschutzmatten (gesteppt) und ihr Einfassband
    liner: std('splitterschutz', { color: 0x8f8b74, roughness: 0.95, metalness: 0 }, K4(0, 0, 0.8, 0)),
    linerBand: std('einfassband', { color: 0x55553f, roughness: 0.85, metalness: 0 }, K4(0, 0, 1, 0)),
    // Schaumstoff (aufgerissene Polster), Flicken, Klebeband
    foam: std('schaumstoff', { color: 0xb59a52, roughness: 1, metalness: 0 }, K4(0, 0, 0.3, 0)),
    patch: std('flicken', { color: 0x4e4a36, roughness: 0.9, metalness: 0, normalMap: quiltNormal(), normalScale: new THREE.Vector2(0.3, 0.3) }, K4(0, 0, 1, 0)),
    red: tag(clone(S.red, 'rot', { roughness: 0.5 }), K4(1, 0.5, 0, 0)),
    yellow: std('gelb', { color: 0xc9a227, roughness: 0.55, metalness: 0.1 }, K4(1, 0.5, 0, 0)),
    orange: std('orange', { color: 0xb35a1a, roughness: 0.6, metalness: 0.05 }, K4(1, 0.5, 0, 0)),
    brass: clone(S.brass, 'messing', { emissiveIntensity: 0.4 }),
    wood: tag(clone(S.wood, 'holz'), K4(0, 0, 0.6, 0)),
    shell: clone(S.shell, 'granate'),
    sleeve: clone(S.sleeve, 'aermel'),
    label: std('schild', { map: A.tex, roughness: 0.62, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, K4(0, 0, 0, 2)),
    gauge: std('instrument', { map: A.tex, emissive: 0x6a8a5a, emissiveMap: A.tex, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    needle: std('zeiger', { color: 0xfff1d0, emissive: 0xffd28a, emissiveIntensity: 0.8, roughness: 0.4 }),
    // Winkelspiegel-Glas: Tageslicht aus dem Prisma (leicht grünlich vergütet)
    prism: std('prisma', { color: 0x203036, roughness: 0.05, metalness: 0.6, emissive: 0xffffff, emissiveMap: prismTex(), emissiveIntensity: 1.0, envMapIntensity: 1.5 }),
    lens: std('linse', { color: 0x071214, roughness: 0.04, metalness: 0.9, emissive: 0x0c2a30, emissiveIntensity: 0.8 }),
    lampRed: std('lampe-rot', { color: 0x3a0806, emissive: 0xff2a14, emissiveIntensity: 3.2, roughness: 0.3 }),
    lampGreen: std('lampe-gruen', { color: 0x06200a, emissive: 0x3cff5a, emissiveIntensity: 1.6, roughness: 0.3 }),
    lampAmber: std('lampe-gelb', { color: 0x2a1a04, emissive: 0xffa21c, emissiveIntensity: 2.4, roughness: 0.3 }),
    disp: std('anzeige', { color: 0x0a1a0c, emissive: 0x52d070, emissiveIntensity: 0.55, roughness: 0.3 }),
    lampOff: std('lampe-aus', { color: 0x221a18, roughness: 0.25, metalness: 0.2 }),
    lampWarm: std('gluehlampe', { color: 0xffe0b0, emissive: 0xffb860, emissiveIntensity: 3.5, roughness: 0.3 }),
    flame: std('flamme', { color: 0xffc070, emissive: 0xff8a2a, emissiveIntensity: 5, roughness: 0.5 }),
    cableRed: std('kabel-rot', { color: 0x7a1a14, roughness: 0.6 }),
    cableYel: std('kabel-gelb', { color: 0x8a7420, roughness: 0.6 }),
    casing: std('huelse', { color: 0xb8913f, roughness: 0.3, metalness: 0.9, emissive: 0x1a1206, emissiveIntensity: 1 }),
    stub: std('huelsenboden', { color: 0x9c8248, roughness: 0.38, metalness: 0.85 }),
    smoke: new THREE.MeshBasicMaterial({ name: 'cab:dampf', color: 0x9a948a, transparent: true, opacity: 0.3, depthWrite: false }),
    // Streuscheibe der Kuppellampen: Farbe/Helligkeit folgt dem Lichtmodus (syncCabin)
    dome: std('kuppellampe', { color: 0x1c1a18, emissive: 0xff3020, emissiveIntensity: 1.6, roughness: 0.35 }),
    // Schablonenschrift direkt auf dem Anstrich (Atlas, durchsichtiger Grund)
    stencil: std('schablone', { map: A.tex, alphaTest: 0.4, roughness: 0.75, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, K4(0, 0, 0, 2)),
  };
  // Kantenmaske nur, wo der Shader sie nutzt (Lack, Stoff/Gummi, Holz)
  for (const k of ['label', 'gauge', 'needle', 'prism', 'stencil', 'lens', 'lampRed', 'lampGreen', 'lampAmber', 'disp', 'lampOff', 'lampWarm', 'flame', 'dome', 'steel', 'brass', 'casing', 'stub', 'shell', 'sleeve', 'cableRed', 'cableYel', 'floor', 'needle', 'breech']) CM[k].userData.noEdge = true;
  if (CABGR) loadCabinSets(det);
  for (const k of ['label', 'gauge', 'needle', 'prism', 'stencil', 'casing', 'stub']) CM[k].userData.noTess = true;
  for (const k of ['modern', 'kk', 'wk2', 'wk1']) pairs.push([CM.wall[k], null]);
  for (const m of [CM.metal, CM.black, CM.olive]) pairs.push([m, null]);
  // Rauch-Sprite: weiche Scheibe
  const sc = document.createElement('canvas'); sc.width = sc.height = 64;
  const sg = sc.getContext('2d'), gr = sg.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
  CM.smoke.map = new THREE.CanvasTexture(sc);
  CM.smoke.alphaMap = null;
  // Grund-Innenraum (models.js) → Klone mit Innenlicht
  CM.remap = new Map([
    [S.cabin, CM.wall.modern], [S.cabinWk2, CM.wall.wk2], [S.cabinWk1, CM.wall.wk1], [S.dark, CM.metal], [S.steel, CM.steel],
    [S.rubber, CM.rubber], [S.canvas, CM.canvas], [S.red, CM.red], [S.shell, CM.shell], [S.brass, CM.brass], [S.wood, CM.wood],
    [S.sleeve, CM.sleeve], [S.lensOn, CM.disp], [S.lamp, CM.lampWarm],
  ]);
  return CM;
}

/** Fotoscan-Texturen nachziehen (Fahrzeugmaterialien werden im Hintergrund aufgewertet). */
function resyncMats() {
  if (!CM) return;
  for (const [m, base] of CM.pairs) {
    const src = base || m.userData.wallFrom;
    if (!src) continue;
    const keys = base ? ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'] : ['normalMap', 'roughnessMap', 'aoMap'];
    let ch = false;
    for (const k of keys) if (m[k] !== src[k] && !(k === 'normalMap' && m === CM.pad)) { m[k] = src[k]; ch = true; }
    if (ch) m.needsUpdate = true;
  }
}

/** Warmlauf (Shader vorkompilieren): Materialliste für index.js/materials.js. */
export function cabinWarmMaterials(S, det = 2) {
  const C = cabinMats(S, det);
  return Object.values(C).flatMap((v) => (v && v.isMaterial ? [v] : v && typeof v === 'object' && !(v instanceof Map) && !Array.isArray(v) ? Object.values(v).filter((x) => x && x.isMaterial) : []));
}

/* ===================================================================== Bauteile */

/** Lokaler Rahmen (Lage + Drehung) – Teile in Rahmenkoordinaten in einen Bucket legen. */
class Frame {
  constructor(B, pos, quat) { this.B = B; this.p = V3(pos); this.q = quat ? quat.clone() : new THREE.Quaternion(); }
  w(l) { return _a.fromArray(l).applyQuaternion(this.q).add(this.p).toArray(); }
  add(geom, mat, lpos = [0, 0, 0], lrot = null, scl = null, keepUV = false) {
    const q = this.q.clone().multiply(toQuat(lrot).clone());
    this.B.add(geom, mat, this.w(lpos), q, scl, keepUV);
    return this;
  }
  rod(mat, a, b, r, seg = 8) { this.B.rod(mat, this.w(a), this.w(b), r, seg); return this; }
}

/** Schild aus dem Atlas (Breite w, Höhe aus dem Seitenverhältnis), Fläche zeigt nach +Z des Rahmens/der Drehung. */
function plateGeom(key, w) {
  const r = atlas().rects[key];
  if (!r) return null;
  const h = w / r[4];
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1]));
  return g;
}
function label(B, C, key, pos, rot, w) { const g = plateGeom(key, w); if (g) B.add(g, C.label, pos, rot, null, true); }
function flabel(F, C, key, lpos, w, lrot = null) { const g = plateGeom(key, w); if (g) F.add(g, C.label, lpos, lrot, null, true); }

/** Rundinstrument: Ziffernblatt (Atlas), Ring, Zeiger (eigene Gruppe, dreht um lokal Z). → Zeigergruppe */
function gauge(F, C, key, lpos, r, bezelMat, parent, kind, max, det) {
  const rc = atlas().rects[key];
  const g = new THREE.CircleGeometry(r, det ? 28 : 16);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, rc[0] + uv.getX(i) * (rc[2] - rc[0]), rc[1] + uv.getY(i) * (rc[3] - rc[1]));
  F.add(g, C.gauge, [lpos[0], lpos[1], lpos[2] + 0.001], null, null, true);
  F.add(tor(r * 1.02, r * 0.09, 5, det ? 24 : 12), bezelMat, [lpos[0], lpos[1], lpos[2] + 0.002]);
  F.add(cyl(r * 1.1, r * 1.1, 0.012, det ? 20 : 10), C.black, [lpos[0], lpos[1], lpos[2] - 0.006], [HP, 0, 0]);
  const p = part(parent, 'zeiger:' + kind, F.w([lpos[0], lpos[1], lpos[2] + 0.004]), F.q);
  const NB = new MB();
  NB.add(box(r * 0.07, r * 0.9, 0.002), C.needle, [0, r * 0.32, 0]);
  NB.add(cyl(r * 0.12, r * 0.12, 0.004, 8), C.black, [0, 0, 0.002], [HP, 0, 0]);
  NB.build(p, 'zeiger');
  p.userData.gauge = { kind, max, full: key === 'w_az' };
  return p;
}

/** Handrad (Rand mit Griffmulden, Speichen, Nabe mit Mutter, Kurbel mit drehbarem Knauf) als Gruppe; lokale Z = Drehachse. */
function handwheel(parent, name, pos, quat, R, C, mat, det) {
  const p = part(parent, name, pos, quat);
  const B = new MB();
  B.wear = 0.55;
  B.add(tor(R, R * 0.12, det ? 8 : 6, det ? 32 : 14), mat);
  if (det > 1) for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; B.add(new THREE.SphereGeometry(R * 0.13, 6, 4), mat, [Math.cos(a) * R, Math.sin(a) * R, 0]); }
  B.wear = 0;
  for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2 + 0.5; B.rod(mat, [Math.cos(a) * R * 0.18, Math.sin(a) * R * 0.18, -R * 0.08], [Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, 0], R * 0.065, 6); }
  B.add(cyl(R * 0.22, R * 0.24, R * 0.4, 12), C.metal, [0, 0, -R * 0.05], [HP, 0, 0]);
  if (det) B.add(cyl(R * 0.12, R * 0.12, R * 0.1, 6), C.steel, [0, 0, R * 0.17], [HP, 0, 0]);
  B.wear = 0.8;
  B.rod(C.steel, [R * 0.95, 0, 0], [R * 0.95, 0, R * 0.5], R * 0.055, 6);
  B.add(cyl(R * 0.12, R * 0.1, R * 0.62, 10), C.rubber, [R * 0.95, 0, R * 0.82], [HP, 0, 0]);
  if (det) B.add(new THREE.SphereGeometry(R * 0.12, 8, 6), C.rubber, [R * 0.95, 0, R * 1.13]);
  B.build(p, name);
  return p;
}

/** Bedienteil der Simulation (psim/sim.js Hotspot-Ziel): Kippschalter unter Schutzbügel mit Leuchtmelder an pos, Front zum
 * Auge. Gruppe 'sw:<id>' mit beweglichem 'hebel' (dreht um X) und 'lampe' (Material wechselt). */
function simSwitch(grp, B, C, det, era, id, pos, eye, labelKey, o = {}) {
  const q = aim(pos, eye);
  const F = new DT.LF(B, pos, q);
  const lab = (key, lp, w) => { const g = plateGeom(key, w); if (g) F.add(g, C.label, lp, null, null, true); };
  const U = DT.switchUnit(B, C, det, F, { era, lab, labelKey, ...o });
  const p = part(grp, 'sw:' + id, pos, q);
  const hv = part(p, 'hebel', U.leverAt);
  const LB = new MB(); LB.wear = 0.6; LB.add(U.lever[0], C.steel); LB.add(U.lever[1], era === 'modern' ? C.black : C.red); LB.build(hv, 'hebel');
  const lm = new THREE.Mesh(U.lamp, C.lampOff); lm.name = 'lampe'; lm.position.fromArray(U.lampAt); p.add(lm);
  cab_sw.push('sw:' + id);
  return p;
}
let cab_sw = [];
/** Schablonenschrift (durchsichtiger Grund) an eine Fläche. */
function stencil(B, C, key, pos, rot, w) { const g = plateGeom(key, w); if (g) B.add(g, C.stencil, pos, rot, null, true); }

/** Okular mit Augenmuschel (Rahmen +Z zum Auge), Optikkörper dahinter, Stirnpolster. */
function eyepiece(F, C, det, { body = [0.16, 0.22, 0.36], brow = true, brass = false } = {}) {
  const mt = brass ? C.brass : C.metal;
  F.add(cyl(0.032, 0.036, 0.09, det ? 16 : 10), mt, [0, 0, -0.02], [HP, 0, 0]);
  F.add(cyl(0.046, 0.038, 0.045, det ? 18 : 10, true), C.rubber, [0, 0, 0.045], [HP, 0, 0]);
  F.add(tor(0.044, 0.008, 5, det ? 18 : 10), C.rubber, [0, 0, 0.068]);
  F.add(cyl(0.024, 0.024, 0.005, 12), C.lens, [0, 0, 0.026], [HP, 0, 0]);
  F.add(rbox(body[0], body[1], body[2], 0.025), mt, [0, 0.02, -0.07 - body[2] / 2]);
  if (det) for (const sx of [-1, 1]) F.add(cyl(0.012, 0.012, 0.02, 8), C.steel, [sx * body[0] / 2, 0.06, -0.12], [0, 0, HP]);
  if (brow) F.add(rbox(0.19, 0.055, 0.07, 0.024), C.pad, [0, 0.085, 0.04]);
}

/** Rotes Feuerlöscher-Set an einer Wand (Normale n in xz). */
function extinguisher(B, C, pos, nx, det) {
  B.add(cyl(0.062, 0.062, 0.38, det ? 16 : 10), C.red, pos);
  B.add(new THREE.SphereGeometry(0.062, det ? 14 : 8, 6, 0, PI * 2, 0, HP), C.red, [pos[0], pos[1] + 0.19, pos[2]]);
  B.add(cyl(0.02, 0.025, 0.06, 8), C.black, [pos[0], pos[1] + 0.27, pos[2]]);
  B.add(box(0.11, 0.015, 0.025), C.black, [pos[0], pos[1] + 0.31, pos[2]]);
  B.add(box(0.012, 0.03, 0.012), C.yellow, [pos[0] + 0.03, pos[1] + 0.29, pos[2]]);  // Sicherungsstift
  if (det) B.tube(C.black, [[pos[0] + 0.02, pos[1] + 0.27, pos[2]], [pos[0] + 0.07, pos[1] + 0.2, pos[2] + 0.02], [pos[0] + 0.07, pos[1] - 0.05, pos[2] + 0.04]], 0.009, 5);
  for (const dy of [-0.1, 0.1]) B.add(tor(0.066, 0.008, 4, 16), C.steel, [pos[0], pos[1] + dy, pos[2]], [HP, 0, 0]);
  B.add(box(0.02, 0.32, 0.05), C.steel, [pos[0] - nx * 0.07, pos[1], pos[2]]);
}

/** Kabelbaum entlang Punkten (2–3 Leitungen) mit Schellen. */
function harness(B, C, pts, det, colors = 3) {
  if (!det) { B.tube(C.black, pts, 0.014, 5, 4); return; }
  const offs = [[0, 0], [0.018, 0.006], [-0.012, 0.016]];
  const mats = [C.black, C.cableRed, C.cableYel];
  for (let k = 0; k < colors; k++) B.tube(mats[k], pts.map((p) => [p[0] + offs[k][0], p[1] + offs[k][1], p[2] + offs[k][0] * 0.5]), k ? 0.006 : 0.011, 5, 6);
  // Schellen alle ~25 cm
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => V3(p)), false, 'centripetal');
  const n = Math.max(1, Math.round(curve.getLength() / 0.25));
  for (let i = 1; i < n; i++) {
    const p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n);
    B.add(tor(0.022, 0.004, 4, 10), C.steel, p.toArray(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), t));
  }
  // Kabelbinder zwischen den Schellen
  if (det > 1) for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; BASE.tie(B, C, curve.getPointAt(u).toArray(), curve.getTangentAt(u).toArray(), 0.017); }
}

/** Fläche nach innen kehren (Wicklung + Normalen). */
function inwardGeom(geom) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  if (g !== geom) geom.dispose();
  g.deleteAttribute('uv');
  for (const name of ['position', 'normal']) {
    const a = g.attributes[name].array;
    for (let t = 0; t < a.length; t += 9) for (let k = 0; k < 3; k++) { const x = a[t + 3 + k]; a[t + 3 + k] = a[t + 6 + k]; a[t + 6 + k] = x; }
  }
  const n = g.attributes.normal.array;
  for (let i = 0; i < n.length; i++) n[i] = -n[i];
  return g;
}

/** Raum aus Seitenprofil [[z, y], …] (konvex) über x = xl…xr, Flächen nach innen. */
function roomGeom(poly, xl, xr) {
  const pos = [], nor = [];
  const V = THREE.Vector3;
  const push = (a, b, c, n) => {
    const f = _a.subVectors(b, a).cross(_b.subVectors(c, a));
    if (f.dot(n) < 0) { const t = b; b = c; c = t; }
    for (const v of [a, b, c]) { pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); }
  };
  let cz = 0, cy = 0;
  for (const [z, y] of poly) { cz += z; cy += y; }
  cz /= poly.length; cy /= poly.length;
  for (let i = 0; i < poly.length; i++) {
    const [z1, y1] = poly[i], [z2, y2] = poly[(i + 1) % poly.length];
    let nz = -(y2 - y1), ny = z2 - z1;
    const l = Math.hypot(nz, ny) || 1; nz /= l; ny /= l;
    if (nz * ((z1 + z2) / 2 - cz) + ny * ((y1 + y2) / 2 - cy) > 0) { nz = -nz; ny = -ny; }
    const n = new V(0, ny, nz);
    push(new V(xl, y1, z1), new V(xr, y1, z1), new V(xr, y2, z2), n);
    push(new V(xl, y1, z1), new V(xr, y2, z2), new V(xl, y2, z2), n);
  }
  const tris = THREE.ShapeUtils.triangulateShape(poly.map(([z, y]) => new THREE.Vector2(z, y)), []);
  for (const [i, j, k] of tris) for (const [x, nx] of [[xl, 1], [xr, -1]]) push(new V(x, poly[i][1], poly[i][0]), new V(x, poly[j][1], poly[j][0]), new V(x, poly[k][1], poly[k][0]), new V(nx, 0, 0));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/* ===================================================================== Fahrerraum (Wannenraum) */

/**
 * Bedienteil 2. WK (Simulation 'sw:<id>', Hotspot folgt dem Teil): Rosette auf der Tafel, bewegliches Teil 'hebel' dreht um
 * die Achse zum Auge (set(): rotation.x) – Zündschloss mit Schlüssel, Anlasserknopf, Lichtdrehschalter; Schild darunter.
 */
function wkSwitch(grp, B, C, det, id, kind, F, lp, labelKey) {
  const p = part(grp, 'sw:' + id, F.w(lp), F.q);
  F.add(cyl(0.021, 0.023, 0.008, det ? 16 : 10), C.steel, [lp[0], lp[1], lp[2] + 0.004], [HP, 0, 0]);
  if (kind === 'key') F.add(tor(0.017, 0.003, 4, 14), C.brass, [lp[0], lp[1], lp[2] + 0.009]);
  if (labelKey) flabel(F, C, labelKey, [lp[0], lp[1] - 0.043, lp[2] + 0.0015], 0.074);
  const ax = part(p, 'achse', [0, 0, 0.008], new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -HP, 0)));
  const hv = part(ax, 'hebel', [0, 0, 0]);
  const L = new MB(); L.wear = 0.75;
  const X = [0, 0, -HP]; // Zylinderachse → lokal +X (= zum Auge)
  if (kind === 'key') {
    L.add(cyl(0.009, 0.009, 0.014, 10), C.brass, [0.007, 0, 0], X);
    L.add(box(0.005, 0.028, 0.022), C.steel, [0.026, 0, 0]);
    L.add(cyl(0.004, 0.004, 0.006, 8), C.black, [0.026, 0.006, 0], [HP, 0, 0]);
  } else if (kind === 'button') {
    L.add(cyl(0.015, 0.015, 0.008, 12), C.steel, [0.004, 0, 0], X);
    L.add(cyl(0.012, 0.013, 0.014, 12), C.red, [0.014, 0, 0], X);
  } else {
    L.add(cyl(0.017, 0.015, 0.018, 12), C.black, [0.009, 0, 0], X);
    L.add(box(0.006, 0.026, 0.006), C.black, [0.02, 0.006, 0]);
    L.add(box(0.002, 0.012, 0.002), C.needle, [0.0235, 0.012, 0]);
  }
  L.build(hv, 'hebel');
  cab_sw.push('sw:' + id);
  return p;
}

/** Instrumententafel 2. WK (Nutzer 21.11.): gekantete Blechtafel mit Nieten, Rundinstrumente Drehzahl, Öldruck, Kühlwasser,
 * Kurskreisel (Zeiger zeigt den Kurs), Lade- und Öldruck-Kontrolllampe, Zündschloss, Anlasserknopf, Lichtdrehschalter. */
function wk2Panel(grp, B, PF, C, det, pw, E) {
  const H = 0.27;
  PF.add(box(pw, H, 0.012), C.metal, [0, 0, -0.006]);
  PF.add(box(pw + 0.02, 0.018, 0.06), C.metal, [0, H / 2 + 0.006, -0.025]);
  PF.add(box(pw + 0.02, 0.018, 0.045), C.metal, [0, -H / 2 - 0.006, -0.02]);
  for (const sx of [-1, 1]) PF.add(box(0.018, H + 0.02, 0.06), C.metal, [sx * (pw / 2 + 0.006), 0, -0.025]);
  if (det) for (let i = 0; i <= 8; i++) for (const sy of [-1, 1]) DT.rivet(PF, C.metal, [-pw / 2 + 0.02 + i * (pw - 0.04) / 8, sy * (H / 2 - 0.015), 0.001], 0.0055);
  const ga = (key, x, y, r, kind, max) => {
    PF.add(cyl(r * 1.16, r * 1.2, 0.03, det ? 20 : 12), C.metal, [x, y, -0.006], [HP, 0, 0]); // Einbautopf
    return gauge(PF, C, key, [x, y, 0.012], r, C.steel, grp, kind, max, det);
  };
  ga('w_rpm', -pw / 2 + 0.095, 0.035, 0.058, 'rpm', 3500);
  ga('w_oel', -0.045, 0.048, 0.043, 'oel', 10);
  ga('w_temp', 0.075, 0.048, 0.043, 'wasser', 120);
  // Kurskreisel: Gehäuse mit rundem Fenster, Kurszeiger über der Rose, Stellknopf
  const kx = pw / 2 - 0.095, ky = 0.03;
  PF.add(rbox(0.15, 0.14, 0.09, 0.02), C.metal, [kx, ky, 0.02]);
  gauge(PF, C, 'w_kurs', [kx, ky, 0.066], 0.05, C.brass, grp, 'kurs', 1, det);
  PF.add(cyl(0.012, 0.012, 0.025, 10), C.black, [kx + 0.055, ky - 0.06, 0.07], [HP, 0, 0]);
  // Kontrolllampen (Ladung rot, Öldruck grün) mit Messingfassung
  [[-0.02, C.lampRed], [0.02, C.lampOff]].forEach(([x, m]) => { PF.add(cyl(0.008, 0.008, 0.012, 8), m, [x, -0.075, 0.004], [HP, 0, 0]); PF.add(tor(0.0105, 0.0028, 4, 10), C.brass, [x, -0.075, 0.008]); });
  wkSwitch(grp, B, C, det, 'batterie', 'key', PF, [-pw / 2 + 0.07, -0.07, 0.0], 'k_zuend');
  wkSwitch(grp, B, C, det, 'anlasser', 'button', PF, [-pw / 2 + 0.17, -0.07, 0.0], 'k_anl');
  wkSwitch(grp, B, C, det, 'licht', 'rotary', PF, [0.12, -0.07, 0.0], 'k_licht');
  // Knieschutz-Bügel unter der Tafel
  PF.rod(C.steel, [-pw / 2, -0.17, 0.02], [pw / 2, -0.17, 0.02], 0.01);
}

function buildDriver(root, D, C, det, era, cab, o = {}) {
  // o.R: Raum (Radfahrzeuge: troopDriverRoom), o.wheel: Lenkrad statt Lenkbügel/-hebel, o.door: { rect, zK } Durchgang
  // in der Rückwand mit Gang bis zum Mannschaftsraum (Transporter, Nutzer 21.11.)
  const R = o.R || driverCabin(D);
  if (!R) return null;
  const grp = new THREE.Group();
  grp.name = 'cabin:fahrer';
  root.add(grp);
  const B = new MB();
  const W = C.wall[era], modern = era === 'modern', wk1 = era === 'wk1';
  // 2. WK (Nutzer 21.11.: „zu modern“): Sehklappe mit Glasblock + zwei Winkelspiegel, Blechtafel mit Rundinstrumenten,
  // Kurskreisel, Zündschloss/Anlasserknopf/Lichtschalter statt Schaltkasten, Schalthebel mit Kulisse rechts
  const w2 = D.era === 'wk2';
  // Kalter Krieg (KP-68, SP-58; Raum/Wandfarbe wie 'wk2'): Wandlerautomatik wie die Simulation (psim eraOf: kk → modern) –
  // Lenkbügel, Wählhebel rechts, keine Kupplung, schwarze Rundinstrumente ohne Bildschirm, geschweißte Wände ohne Nieten
  const kk = D.era === 'kk', auto = modern || kk;
  const { xl, xr, floor: yF, roof: yR, zFT, zFB, zB, eye: E } = R;
  const x0 = R.F[0], z0 = R.F[2];
  // Raum: Boden, Glacis (schräg), Decke, Rückwand, Seitenwände – nach innen gekehrt
  // Raum: gerundetes Prisma (Hohlkehlen an den Stößen, leicht gewölbte Flächen) statt ebener Polygone
  const dr = det && o.door ? o.door.rect : null;
  if (det) B.add(SH.prism([[zB, yF], [zFB, yF], [zFT, yR], [zB, yR]], xl, xr, { rc: 0.07, r0: 0.05, r1: 0.05, bulge: 0.006, steps: det > 1 ? 4 : 2, arcSteps: det > 1 ? 3 : 2, axes: 'zyx', open: dr ? [3] : null }), W);
  else B.add(roomGeom([[zB, yF], [zFB, yF], [zFT, yR], [zB, yR]], xl, xr), W);
  if (dr) {
    // Trennwand zum Mannschaftsraum mit Durchgang, Gang (Laibung) bis zur Stirnwand des Mannschaftsraums, Rahmen
    B.add(SH.holeWall(-xr, -xl, yF, yR, [[-dr[1], -dr[0], dr[2], dr[3]]]), W, [0, 0, zB - 0.002], [0, PI, 0]);
    for (const x of [xl + 0.006, xr - 0.006]) B.add(box(0.012, yR - yF, 0.075), W, [x, (yF + yR) / 2, zB - 0.036]);
    for (const y of [yF + 0.006, yR - 0.006]) B.add(box(xr - xl, 0.012, 0.075), W, [(xl + xr) / 2, y, zB - 0.036]);
    if (o.door.zK > zB + 0.02) { B.add(SH.tunnel(dr[0], dr[1], dr[2], dr[3], zB - 0.004, o.door.zK + 0.02), W); B.add(box(dr[1] - dr[0], 0.012, o.door.zK - zB), C.floor, [(dr[0] + dr[1]) / 2, dr[2] + 0.006, (zB + o.door.zK) / 2]); }
    const DF = new Frame(B, [(dr[0] + dr[1]) / 2, (dr[2] + dr[3]) / 2, zB - 0.012], null), dw = dr[1] - dr[0], dh = dr[3] - dr[2];
    for (const sx of [-1, 1]) DF.add(box(0.045, dh + 0.06, 0.03), C.metal, [sx * (dw / 2 + 0.02), 0, 0]);
    for (const sy of [-1, 1]) DF.add(box(dw + 0.08, 0.045, 0.03), C.metal, [0, sy * (dh / 2 + 0.02), 0]);
  }
  B.add(box(xr - xl - 0.04, 0.012, zB - zFB - 0.06), C.floor, [(xl + xr) / 2, yF + 0.006, (zB + zFB) / 2]);
  if (det) for (let z = zFB + 0.12; z < zB - 0.05; z += 0.11) B.add(box(xr - xl - 0.1, 0.004, 0.012), C.steel, [(xl + xr) / 2, yF + 0.014, z], [0, 0.35, 0]);
  // Schweißnähte / Rippen an Glacis und Decke
  const gl = Math.hypot(zFT - zFB, yR - yF), ga = Math.atan2(yR - yF, zFB - zFT);
  // Schweißnaht quer über das Glacis (flach auf der Fläche)
  const gn = new THREE.Vector3(0, -(zFB - zFT), yR - yF).normalize(); // Innen-Normale des Glacis (zeigt nach hinten oben)
  if (det) B.add(box(xr - xl - 0.06, 0.018, 0.012), C.metal, [(xl + xr) / 2, yF + (yR - yF) * 0.55 + gn.y * 0.004, zFB + (zFT - zFB) * 0.55 + gn.z * 0.004], [ga - PI, 0, 0]);
  for (const zz of [zFT + 0.25, (zFT + zB) / 2 + 0.1]) B.add(box(xr - xl - 0.04, 0.03, 0.035), C.metal, [(xl + xr) / 2, yR - 0.016, zz]);
  if (wk1 || (era === 'wk2' && !kk)) {
    // Nieten an den Wänden
    for (let z = zFT + 0.1; z < zB; z += 0.16) for (const x of [xl + 0.006, xr - 0.006]) for (const y of [yF + 0.12, yR - 0.1]) B.add(new THREE.SphereGeometry(0.011, 6, 4), C.metal, [x, y, z]);
  }

  // ---- Sitz: Sockel, Schienen, Polster (Rautensteppung), Lehne zurückgeneigt, Kopfstütze, Gurte, Höhenhebel
  const sy = yF, sz = z0;
  B.add(box(0.3, 0.14, 0.3), C.metal, [x0, sy + 0.07, sz + 0.12]);
  for (const sx of [-1, 1]) B.add(box(0.03, 0.03, 0.46), C.steel, [x0 + sx * 0.13, sy + 0.015, sz + 0.12]);
  const seatMat = wk1 ? C.leather : C.pad;
  B.add(rbox(0.46, 0.09, 0.44, 0.035, det ? 3 : 1), seatMat, [x0, sy + 0.2, sz + 0.1]);
  for (const sx of [-1, 1]) B.add(rbox(0.06, 0.07, 0.4, 0.025), seatMat, [x0 + sx * 0.22, sy + 0.24, sz + 0.1]);
  B.add(rbox(0.46, 0.56, 0.09, 0.035, det ? 3 : 1), seatMat, [x0, sy + 0.52, sz + 0.37], [0.38, 0, 0]);
  B.add(box(0.4, 0.5, 0.025), C.metal, [x0, sy + 0.53, sz + 0.43], [0.38, 0, 0]);
  B.add(rbox(0.28, 0.15, 0.08, 0.03), seatMat, [x0, sy + 0.88, sz + 0.5], [0.38, 0, 0]);
  if (det) for (const sx of [-1, 1]) B.add(box(0.045, 0.62, 0.006), C.canvas, [x0 + sx * 0.12, sy + 0.5, sz + 0.32], [0.38, 0, sx * 0.08]);
  B.rod(C.steel, [x0 + 0.25, sy + 0.16, sz - 0.02], [x0 + 0.3, sy + 0.2, sz - 0.12], 0.008);
  B.add(cyl(0.015, 0.015, 0.05, 8), C.red, [x0 + 0.305, sy + 0.205, sz - 0.14], [HP, 0, 0]);
  label(B, C, 'sitz', [x0 + 0.231, sy + 0.12, sz + 0.12], [0, HP, 0], 0.15);
  if (det) {
    // durchgesessen (abgewetzt), aufgerissene Vorderkante mit Schaumstoff, aufgenähter Flicken an der Lehne
    DT.worn(B, 0.8, () => B.add(SH.quilt(0.26, 0.22, 0.004, { nx: 1, ny: 1, res: 3 }), seatMat, [x0, sy + 0.2475, sz + 0.12], [-HP, 0, 0]));
    B.add(box(0.12, 0.014, 0.012), C.black, [x0 - 0.08, sy + 0.21, sz - 0.118]);
    for (let i = 0; i < 5; i++) B.add(new THREE.SphereGeometry(0.01 + (i % 2) * 0.005, 6, 4), C.foam, [x0 - 0.125 + i * 0.022, sy + 0.208 + (i % 2) * 0.004, sz - 0.118]);
    B.add(SH.quilt(0.12, 0.1, 0.006, { nx: 1, ny: 1, res: 2 }), C.patch, [x0 + 0.1, sy + 0.632, sz + 0.358], [0.38, PI, 0.15]);
  }

  // ---- Lenkung: modern Lenkbügel an der Lenksäule (dreht), sonst Lenkhebel (Drehpunkt am Boden, ziehen = Kette bremsen)
  if (!auto) for (const [nm, sx] of [['hebel:l', -1], ['hebel:r', 1]]) {
    const p = part(grp, nm, [x0 + sx * 0.2, sy + 0.04, sz - 0.3]);
    const L = new MB();
    L.add(box(0.07, 0.05, 0.09), C.metal, [0, 0, 0]);
    L.add(cyl(0.03, 0.045, 0.1, 10, true), C.rubber, [0, 0.07, 0]);
    L.rod(C.steel, [0, 0, 0], [0, 0.5, 0.1], 0.013, 8);
    L.add(cyl(0.023, 0.021, 0.13, 12), C.rubber, [0, 0.55, 0.11], [0.2, 0, 0]);
    L.add(cyl(0.012, 0.012, 0.02, 8), C.red, [0, 0.625, 0.125], [0.2, 0, 0]);
    if (det) L.add(box(0.016, 0.03, 0.014), C.black, [-sx * 0.012, 0.51, 0.085]);
    L.build(p, nm);
  }
  label(B, C, 'lenk', [x0, sy + 0.071, sz - 0.25], [-HP, 0, 0], 0.16);

  // ---- Pedale (Gas rechts, Bremse Mitte, Kupplung links bei den Weltkriegspanzern)
  const peds = [['pedal:gas', x0 + 0.13, 0.07, 0.1], ['pedal:bremse', x0 - 0.04, 0.12, 0.08]];
  if (!auto) peds.push(['pedal:kupplung', x0 - 0.2, 0.08, 0.08]);
  for (const [nm, px, pw, ph] of peds) {
    const p = part(grp, nm, [px, sy + 0.03, sz - 0.8]);
    p.userData.pedal = true;
    const L = new MB();
    L.add(box(pw + 0.02, 0.03, 0.05), C.metal, [0, 0, 0]);
    L.rod(C.steel, [0, 0, 0], [0, 0.18, 0.1], 0.012, 6);
    L.add(rbox(pw, 0.02, ph + 0.05, 0.008), C.metal, [0, 0.19, 0.11], [-0.95, 0, 0]);
    L.add(box(pw - 0.01, 0.006, ph + 0.03), C.rubber, [0, 0.2, 0.12], [-0.95, 0, 0]);
    L.build(p, nm);
  }

  // ---- Gangwahl: modern/Kalter Krieg Wählhebel in Kulisse rechts, Weltkrieg Schalthebel aus dem Boden links
  if (auto) {
    B.add(rbox(0.08, 0.06, 0.24, 0.01), C.black, [x0 + 0.32, sy + 0.33, sz - 0.04]);
    label(B, C, 'gang', [x0 + 0.32, sy + 0.361, sz - 0.04], [-HP, 0, HP], 0.22);
    B.add(box(0.06, 0.33, 0.06), C.metal, [x0 + 0.32, sy + 0.15, sz - 0.04]);
    const p = part(grp, 'gang', [x0 + 0.32, sy + 0.36, sz - 0.04]);
    const L = new MB();
    L.rod(C.steel, [0, 0, 0], [0, 0.12, 0], 0.008, 6);
    L.add(rbox(0.04, 0.05, 0.05, 0.015), C.black, [0, 0.14, 0]);
    L.build(p, 'gang');
  } else {
    const gx = w2 ? Math.min(x0 + 0.31, xr - 0.16) : x0 - 0.33;
    if (w2) {
      // Getriebe-Schaltgehäuse mit Kulisse (H-Schaltbild, Rastnasen), Hebel kommt durch den Kulissenschlitz
      B.add(rbox(0.2, 0.3, 0.3, 0.02), C.metal, [gx, sy + 0.15, sz - 0.12]);
      B.add(box(0.17, 0.012, 0.22), C.steel, [gx, sy + 0.306, sz - 0.12]);
      for (const dx of [-0.045, 0, 0.045]) B.add(box(0.012, 0.004, 0.16), C.black, [gx + dx, sy + 0.313, sz - 0.12]);
      B.add(box(0.1, 0.004, 0.012), C.black, [gx, sy + 0.313, sz - 0.12]);
      if (det) { const F = new DT.LF(B, [gx, sy + 0.313, sz - 0.12], new THREE.Quaternion().setFromEuler(new THREE.Euler(-HP, 0, 0))); for (const a of [-1, 1]) for (const b of [-1, 1]) DT.bolt(F, C.steel, [a * 0.075, b * 0.1, 0], 0.005, det); }
    }
    const p = part(grp, 'gang', [gx, sy + 0.02, sz - 0.12]);
    const L = new MB();
    L.add(cyl(0.05, 0.06, 0.05, 10), C.metal);
    L.rod(C.steel, [0, 0, 0], [0, 0.55, 0.05], 0.012, 6);
    L.wear = 0.8; L.add(new THREE.SphereGeometry(0.03, 10, 8), wk1 || w2 ? C.wood : C.black, [0, 0.57, 0.05]); L.wear = 0;
    L.build(p, 'gang');
  }

  // ---- Instrumententafel (schräg, zum Auge gedreht)
  const dir = new THREE.Vector3(0, -0.48, -1).normalize();
  const P = V3(E).addScaledVector(dir, 0.52);
  P.z = Math.max(P.z, zFB + (P.y - yF) / Math.max(0.2, yR - yF) * (zFT - zFB) + 0.14);
  const PF = new Frame(B, P.toArray(), aim(P.toArray(), E));
  const pw = Math.min(0.66, xr - xl - 0.08);
  if (w2) wk2Panel(grp, B, PF, C, det, pw, E);
  else {
  PF.add(rbox(pw, 0.3, 0.05, 0.015), C.black, [0, 0, -0.03]);
  PF.add(box(pw + 0.02, 0.025, 0.08), C.metal, [0, 0.16, -0.02]);
  if (det) for (const sx of [-1, 1]) PF.add(cyl(0.006, 0.006, 0.01, 6), C.steel, [sx * (pw / 2 - 0.02), 0.13, 0.0], [HP, 0, 0]);
  const ga2 = (key, x, y, r, kind, max) => gauge(PF, C, key, [x, y, 0], r, wk1 ? C.brass : C.steel, grp, kind, max, det);
  if (modern) {
    ga2('d_rpm', -pw / 2 + 0.08, 0.055, 0.055, 'rpm', 3000);
    ga2('d_kmh', -pw / 2 + 0.21, 0.055, 0.055, 'kmh', 80);
    ga2('d_oel', pw / 2 - 0.05, 0.09, 0.032, 'oel', 10);
    ga2('d_wasser', pw / 2 - 0.05, 0.015, 0.032, 'wasser', 120);
    // Fahreranzeige
    const s = screen('drv', 256, 128);
    PF.add(rbox(0.19, 0.105, 0.02, 0.008), C.black, [0.07, 0.05, 0.004]);
    const sg = new THREE.PlaneGeometry(0.17, 0.085);
    PF.add(sg, s.mat, [0.07, 0.05, 0.015], null, null, true);
    flabel(PF, C, 'n_oel', [-pw / 2 + 0.1, 0.128, 0.003], 0.11);
  } else if (kk) {
    // Kalter Krieg: schwarze Rundinstrumente (Drehzahl, Tempo, Öl, Kühlwasser), Batterieanzeige, kein Bildschirm
    ga2('d_rpm', -pw / 2 + 0.09, 0.05, 0.06, 'rpm', 3000);
    ga2('d_kmh', -pw / 2 + 0.24, 0.05, 0.06, 'kmh', 80);
    ga2('d_oel', pw / 2 - 0.05, 0.09, 0.032, 'oel', 10);
    ga2('d_wasser', pw / 2 - 0.05, 0.015, 0.032, 'wasser', 120);
    flabel(PF, C, 'n_batt', [pw / 2 - 0.16, 0.128, 0.003], 0.1);
  } else if (era === 'wk2') {
    flabel(PF, C, 'n_batt', [pw / 2 - 0.12, 0.128, 0.003], 0.1);
    ga2('w_rpm', -pw / 2 + 0.09, 0.05, 0.06, 'rpm', 3500);
    ga2('w_kmh', 0, 0.05, 0.06, 'kmh', 60);
    ga2('w_oel', pw / 2 - 0.09, 0.05, 0.045, 'oel', 10);
  } else {
    ga2('e_rpm', -0.08, 0.05, 0.06, 'rpm', 1600);
    ga2('e_oel', 0.1, 0.05, 0.045, 'oel', 6);
  }
  // Warnleuchten, Kippschalter mit Schriftfeld, Notaus unter Klappe, Anlasser
  const lampMats = modern ? [C.lampGreen, C.lampOff, C.lampAmber, C.lampOff, C.lampRed, C.lampGreen] : [C.lampWarm, C.lampOff, C.lampRed];
  lampMats.forEach((m, i) => { PF.add(cyl(0.009, 0.009, 0.012, 8), m, [-pw / 2 + 0.05 + i * 0.035, -0.07, 0.004], [HP, 0, 0]); PF.add(tor(0.011, 0.003, 4, 10), C.steel, [-pw / 2 + 0.05 + i * 0.035, -0.07, 0.007]); });
  if (det || modern) {
    flabel(PF, C, 'schalter', [pw / 2 - 0.15, -0.075, 0.002], 0.24);
    for (let i = 0; i < 5; i++) {
      const sx = pw / 2 - 0.15 - 0.12 + 0.0255 + i * (0.24 / 5) * 0.98;
      PF.add(cyl(0.007, 0.007, 0.012, 8), C.steel, [sx, -0.078, 0.006], [HP, 0, 0]);
      PF.add(cyl(0.003, 0.002, 0.03, 6), C.steel, [sx, -0.068 + (i % 2) * -0.018, 0.014], [i % 2 ? -0.6 : 0.6, 0, 0]);
    }
  }
  PF.add(box(0.05, 0.05, 0.02), C.red, [pw / 2 - 0.03, -0.12, 0.004]);
  PF.add(box(0.054, 0.006, 0.035), C.red, [pw / 2 - 0.03, -0.094, 0.02], [-0.7, 0, 0]);
  flabel(PF, C, 'notaus', [pw / 2 - 0.03, -0.155, 0.003], 0.06);
  PF.add(cyl(0.014, 0.014, 0.018, 10), wk1 ? C.brass : C.black, [-pw / 2 + 0.06, -0.12, 0.008], [HP, 0, 0]);
  flabel(PF, C, 'zuendung', [-pw / 2 + 0.13, -0.122, 0.002], 0.09);
  if (wk1) PF.add(box(0.5, 0.3, 0.02), C.wood, [0, 0, -0.058]);
  // Schutzbügel unter der Tafel (Knie)
  PF.rod(C.steel, [-pw / 2, -0.16, 0.02], [pw / 2, -0.16, 0.02], 0.01);
  }

  // ---- Winkelspiegel (drei Prismen an der Decke vorn) mit Stirnpolstern
  const nP = wk1 ? 1 : 3;
  const L2 = w2 ? driverLayoutWk2(R) : null;
  for (let k = 0; k < nP; k++) {
    if (w2 && k === 1) continue; // 2. WK: Mitte = Sehklappe (unten)
    const kk = nP === 1 ? 0 : k - 1;
    const c = w2 ? L2.prisms[k ? 1 : 0].c : [x0 + kk * 0.26, yR - 0.085, zFT + 0.1 + Math.abs(kk) * 0.04];
    const F = new Frame(B, c, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, w2 ? L2.prisms[k ? 1 : 0].yaw : -kk * 0.35, 0)));
    F.add(rbox(0.21, 0.15, 0.14, 0.012), C.metal, [0, 0, 0]);
    F.add(new THREE.PlaneGeometry(0.17, 0.07), C.prism, [0, -0.015, 0.0705], null, null, true);
    (cab.prisms || (cab.prisms = [])).push({ obj: 'hull', pos: F.w([0, -0.015, 0.072]), quat: F.q.toArray(), w: 0.17, h: 0.07, up: 0.12 }); // Glas (optics.js: Außenbild auf dem Spiegel im Blick)
    F.add(box(0.19, 0.012, 0.02), C.rubber, [0, 0.026, 0.075]);
    F.add(rbox(0.21, 0.05, 0.06, 0.02), C.pad, [0, 0.07, 0.08]);
    if (det) for (const sx of [-1, 1]) F.add(cyl(0.01, 0.01, 0.02, 6), C.steel, [sx * 0.09, -0.06, 0.07], [HP, 0, 0]);
  }
  if (w2) {
    // Sehklappe: Gussrahmen in der Bugplatte, Panzerglasblock (dick, gelblich, in Gummi gefasst) mit Halteklammern,
    // Stirnpolster darüber, Klappenhebel rechts (Sehklappe auf/zu), Schutzbügel
    const V = L2.visor, c = V.c, F = new Frame(B, c, null);
    const dz = c[2] - V.zg;
    // Gussrahmen um das Fenster (oben/unten/seitlich), Glasblock etwas zurückgesetzt in Gummi
    const fw = V.w + 0.14, fh = V.h + 0.12, fd = dz + 0.04, fz = -dz / 2 + 0.005;
    for (const sy of [-1, 1]) F.add(rbox(fw, (fh - V.h) / 2, fd, 0.012), C.metal, [0, sy * (V.h / 2 + (fh - V.h) / 4), fz]);
    for (const sx of [-1, 1]) F.add(rbox((fw - V.w) / 2, V.h + 0.01, fd, 0.012), C.metal, [sx * (V.w / 2 + (fw - V.w) / 4), 0, fz]);
    F.add(box(V.w + 0.012, V.h + 0.012, 0.012), C.rubber, [0, 0, -0.012]);
    F.add(box(V.w - 0.004, V.h - 0.004, 0.06), C.lens, [0, 0, -0.05]);
    F.add(new THREE.PlaneGeometry(V.w - 0.012, V.h - 0.01), C.prism, [0, 0, -0.0195], null, null, true);
    (cab.prisms || (cab.prisms = [])).push({ obj: 'hull', pos: F.w([0, 0, -0.018]), quat: F.q.toArray(), w: V.w - 0.012, h: V.h - 0.01, up: 0 });
    for (const sx of [-1, 1]) F.add(box(0.022, V.h + 0.05, 0.016), C.steel, [sx * (V.w / 2 + 0.018), 0, 0.006]);
    if (det) for (const sx of [-1, 1]) for (const sy of [-1, 1]) DT.bolt(F, C.steel, [sx * (V.w / 2 + 0.05), sy * (V.h / 2 + 0.035), 0.014], 0.007, det);
    F.add(rbox(V.w + 0.1, 0.05, 0.06, 0.02), C.pad, [0, V.h / 2 + 0.085, 0.035]);
    F.rod(C.steel, [V.w / 2 + 0.07, -0.02, 0.02], [V.w / 2 + 0.13, -0.09, 0.08], 0.009);
    F.add(cyl(0.014, 0.012, 0.05, 8), C.wood, [V.w / 2 + 0.135, -0.1, 0.09], [0.7, 0, 0]);
    label(B, C, 'k_klappe', F.w([-0.06, -V.h / 2 - 0.036, 0.027]), null, 0.1);
  }
  if (wk1) {
    // Sehschlitze mit Schiebern (1. WK): Schlitz hell, Schieber darüber
    B.add(new THREE.PlaneGeometry(0.36, 0.035), C.prism, [x0, yR - 0.22, zFT + 0.024], null, null, true);
    B.add(box(0.42, 0.09, 0.03), C.metal, [x0, yR - 0.16, zFT + 0.03]);
  }

  // ---- Luke: Ring, Unterseite, Verriegelung, Polsterring
  if (R.hatch) {
    const [hx, , hz] = R.hatch.pos, hr = R.hatch.r;
    B.add(tor(hr + 0.02, 0.024, 6, det ? 28 : 14), C.steel, [hx, yR - 0.025, hz], [HP, 0, 0]);
    B.add(tor(hr + 0.07, 0.034, 6, det ? 28 : 14), C.pad, [hx, yR - 0.04, hz], [HP, 0, 0]);
    B.add(cyl(hr, hr, 0.012, det ? 24 : 12), C.metal, [hx, yR - 0.008, hz]);
    B.rod(C.steel, [hx - hr * 0.6, yR - 0.04, hz], [hx + hr * 0.6, yR - 0.04, hz], 0.012);
    B.add(rbox(0.05, 0.04, 0.12, 0.012), C.black, [hx + hr * 0.6, yR - 0.06, hz]);
    B.rod(C.steel, [hx - 0.12, yR - 0.02, hz + hr * 0.75], [hx + 0.12, yR - 0.02, hz + hr * 0.75], 0.01);
    for (const sx of [-0.12, 0.12]) B.rod(C.steel, [hx + sx, yR - 0.02, hz + hr * 0.75], [hx + sx, yR - 0.05, hz + hr * 0.75], 0.01);
    label(B, C, 'luke', [xl + 0.006, yR - 0.12, hz], [0, HP, 0], 0.17);
  }

  // ---- linke Wand: Feuerlöscher, Hauptschalter, Kartentasche, Erste Hilfe, Haltegriff, Kabelbaum
  extinguisher(B, C, [xl + 0.075, yF + 0.36, z0 - 0.02], -1, det);
  label(B, C, 'loescher', [xl + 0.006, yF + 0.66, z0 - 0.02], [0, HP, 0], 0.17);
  label(B, C, 'geprueft', [xl + 0.006, yF + 0.6, z0 + 0.12], [0, HP, 0], 0.09);
  B.add(box(0.04, 0.12, 0.12), C.black, [xl + 0.02, yF + 0.55, z0 - 0.5]);
  B.add(cyl(0.035, 0.035, 0.03, 12), C.red, [xl + 0.05, yF + 0.55, z0 - 0.5], [0, 0, HP]);
  B.add(box(0.012, 0.012, 0.07), C.red, [xl + 0.068, yF + 0.55, z0 - 0.5]);
  label(B, C, 'haupt', [xl + 0.006, yF + 0.66, z0 - 0.5], [0, HP, 0], 0.16);
  B.add(rbox(0.04, 0.26, 0.3, 0.012), C.canvas, [xl + 0.03, yF + 0.3, z0 + 0.38]);
  B.add(box(0.03, 0.02, 0.28), C.canvas, [xl + 0.05, yF + 0.42, z0 + 0.38]);
  if (det) {
    B.add(rbox(0.09, 0.13, 0.2, 0.01), modern ? C.olive : C.metal, [xl + 0.05, yR - 0.2, z0 + 0.42]);
    label(B, C, 'erstehilfe', [xl + 0.096, yR - 0.2, z0 + 0.42], [0, HP, 0], 0.16);
  }
  B.rod(C.steel, [xl + 0.07, yR - 0.05, z0 - 0.25], [xl + 0.07, yR - 0.05, z0 + 0.05], 0.012);
  for (const zz of [z0 - 0.25, z0 + 0.05]) B.rod(C.steel, [xl + 0.07, yR - 0.05, zz], [xl + 0.005, yR - 0.05, zz], 0.012);
  harness(B, C, [[xl + 0.035, yR - 0.06, zFT + 0.15], [xl + 0.03, yR - 0.08, z0 - 0.2], [xl + 0.035, yR - 0.07, zB - 0.06]], det);
  harness(B, C, [PF.w([-pw / 2 + 0.02, -0.1, -0.05]), [xl + 0.06, yF + 0.62, P.z + 0.05], [xl + 0.035, yR - 0.1, z0 - 0.3]], det, 2);
  if (det) label(B, C, 'kabel', [xl + 0.006, yR - 0.16, z0 - 0.15], [0, HP, 0], 0.14);

  // ---- rechte Wand: Kraftstoffbehälter mit Sichtrohr, Batteriekasten, Wasserkanister
  const tH = yR - yF - 0.14;
  B.add(rbox(0.09, tH, 0.92, 0.02), modern ? C.olive : W, [xr - 0.045, yF + 0.07 + tH / 2, z0 - 0.2]);
  if (det) for (const zz of [z0 - 0.5, z0 + 0.1]) B.add(box(0.012, tH - 0.06, 0.02), C.metal, [xr - 0.092, yF + 0.07 + tH / 2, zz]);
  label(B, C, 'diesel', [xr - 0.097, yF + 0.07 + tH * 0.3, z0 - 0.42], [0, -HP, 0], 0.16);
  B.add(cyl(0.012, 0.012, tH * 0.6, 8), C.lens, [xr - 0.1, yF + 0.07 + tH * 0.45, z0 - 0.62]);
  B.add(box(0.02, tH * 0.65, 0.04), C.steel, [xr - 0.095, yF + 0.07 + tH * 0.45, z0 - 0.62]);
  if (!w2) {
    B.add(rbox(0.26, 0.24, 0.4, 0.015), C.black, [xr - 0.22, yF + 0.13, z0 + 0.36]);
    for (const zz of [z0 + 0.24, z0 + 0.48]) { B.add(cyl(0.02, 0.02, 0.03, 8), C.metal, [xr - 0.22, yF + 0.265, zz]); B.add(box(0.012, 0.012, 0.08), zz < z0 + 0.3 ? C.cableRed : C.black, [xr - 0.22, yF + 0.29, zz + 0.05]); }
    label(B, C, 'haupt', [xr - 0.351, yF + 0.16, z0 + 0.36], [0, -HP, 0], 0.15);
  } else {
    // 2. WK: Werkzeugkasten (Holz, Eisenbeschläge) statt Batteriekasten
    B.add(box(0.24, 0.2, 0.42), C.wood, [xr - 0.22, yF + 0.11, z0 + 0.36]);
    for (const zz of [z0 + 0.17, z0 + 0.55]) B.add(box(0.25, 0.03, 0.02), C.metal, [xr - 0.22, yF + 0.11, zz]);
    DT.worn(B, 0.8, () => B.add(SH.bentTube([[xr - 0.25, yF + 0.21, z0 + 0.3], [xr - 0.25, yF + 0.25, z0 + 0.3], [xr - 0.25, yF + 0.25, z0 + 0.42], [xr - 0.25, yF + 0.21, z0 + 0.42]], 0.006, 0.015, 6), C.steel));
  }
  if (det) {
    B.add(rbox(0.12, 0.3, 0.2, 0.025), C.olive, [xr - 0.17, yF + 0.16, z0 - 0.62]);
    B.add(cyl(0.02, 0.02, 0.04, 8), C.black, [xr - 0.17, yF + 0.33, z0 - 0.66]);
    label(B, C, 'wasser', [xr - 0.231, yF + 0.17, z0 - 0.62], [0, -HP, 0], 0.11);
  }
  harness(B, C, [[xr - 0.03, yR - 0.06, zFT + 0.2], [xr - 0.03, yR - 0.08, z0], [xr - 0.035, yR - 0.06, zB - 0.06]], det, 2);

  // ---- Boden & Rückwand: Notausstiegsluke, Durchstieg zum Kampfraum, Bordsprechkasten, Kopfhörer, Typenschild, Leuchten
  B.add(cyl(0.24, 0.24, 0.016, det ? 24 : 12), C.metal, [x0 - 0.02, yF + 0.012, zB - 0.25]);
  B.rod(C.steel, [x0 - 0.12, yF + 0.03, zB - 0.25], [x0 + 0.1, yF + 0.03, zB - 0.25], 0.012);
  label(B, C, 'bodenluke', [x0 - 0.02, yF + 0.022, zB - 0.42], [-HP, 0, 0], 0.13);
  const toC = x0 < 0 ? 1 : -1, ox = clamp(x0 + toC * 0.28, xl + 0.3, xr - 0.3);
  if (!dr) {
    B.add(box(0.46, Math.min(0.62, yR - yF - 0.25), 0.012), C.rubber, [ox, yF + 0.36, zB - 0.008]);
    B.add(box(0.5, 0.03, 0.03), C.steel, [ox, yF + 0.36 + Math.min(0.31, (yR - yF - 0.25) / 2), zB - 0.02]);
  }
  B.add(rbox(0.13, 0.13, 0.05, 0.01), C.black, [x0 - toC * 0.22, yR - 0.22, zB - 0.03]);
  label(B, C, 'bsakasten', [x0 - toC * 0.22, yR - 0.22, zB - 0.056], [0, PI, 0], 0.12);
  label(B, C, 'typ', [x0 + toC * 0.25, yR - 0.1, zB - 0.004], [0, PI, 0], 0.18);
  // Kopfhörer am Haken (pendelt)
  {
    const p = part(grp, 'pendel:kopfhoerer', [x0 - toC * 0.06, yR - 0.08, zB - 0.06]);
    const L = new MB();
    L.add(tor(0.075, 0.009, 5, 14, PI), C.black, [0, -0.08, 0], [0, 0, 0]);
    for (const sx of [-1, 1]) L.add(cyl(0.04, 0.04, 0.03, 12), C.black, [sx * 0.075, -0.09, 0], [0, 0, HP]);
    L.add(cyl(0.005, 0.005, 0.1, 5), C.black, [0, -0.02, 0]);
    L.build(p, 'kopfhoerer');
    p.userData.pend = { ax: 0, az: 0, vx: 0, vz: 0 };
  }
  if (modern && o.wheel) {
    // Radfahrzeug: Lenkrad mit drei Speichen und Prallnabe an schräger Lenksäule (dreht mit dem Lenkeinschlag)
    const cp = [x0, P.y - 0.2, P.z + 0.2];
    B.rod(C.black, [x0, P.y - 0.34, P.z - 0.05], cp, 0.03, 12);
    B.add(rbox(0.12, 0.1, 0.16, 0.03), C.black, [x0, P.y - 0.3, P.z - 0.02], [0.6, 0, 0]);
    const p = part(grp, 'hebel:l', [cp[0], cp[1] + 0.012, cp[2] + 0.02], [-0.95, 0, 0]);
    p.userData.yoke = true; p.userData.wheel = true;
    const L = new MB();
    L.wear = 0.85; L.add(tor(0.19, 0.017, 8, det ? 36 : 18), C.rubber, [0, 0, 0.02], [HP, 0, 0]); L.wear = 0;
    for (const a of [-HP, HP + 0.6, HP - 0.6 + PI]) L.rod(C.metal, [0, 0.0, 0], [Math.cos(a) * 0.18, 0.02, Math.sin(a) * 0.18], 0.011, 8);
    L.add(cyl(0.06, 0.055, 0.05, det ? 18 : 10), C.black, [0, 0.015, 0]);
    L.add(cyl(0.035, 0.035, 0.008, 12), C.steel, [0, 0.043, 0]);
    L.build(p, 'hebel:l');
  } else if (auto) {
    // Lenkbügel vor der Instrumententafel (Säule aus dem Boden)
    const cp = [x0, P.y - 0.26, P.z + 0.17];
    B.rod(C.metal, [x0, sy + 0.05, P.z - 0.02], cp, 0.035, 12);
    B.add(cyl(0.06, 0.07, 0.12, 14), C.black, [x0, sy + 0.08, P.z - 0.01]);
    B.add(cyl(0.045, 0.045, 0.06, 14), C.black, cp, [-0.55, 0, 0]);
    if (det) B.tube(C.cableYel, [[x0 + 0.04, sy + 0.1, P.z], [x0 + 0.05, (sy + cp[1]) / 2, (P.z + cp[2]) / 2 - 0.03], [x0 + 0.03, cp[1] - 0.03, cp[2] - 0.02]], 0.006, 5, 10);
    const p = part(grp, 'hebel:l', [cp[0], cp[1] + 0.03, cp[2] + 0.03], [-0.35, 0, 0]);
    p.userData.yoke = true;
    const L = new MB();
    // Bügel: Querholm, zwei Handgriffe (gummiert, abgegriffen), Daumentasten, Mittelnabe
    L.add(rbox(0.12, 0.07, 0.05, 0.012), C.black, [0, 0, 0]);
    L.rod(C.metal, [-0.2, 0.02, 0.0], [0.2, 0.02, 0.0], 0.016, 10);
    for (const s2 of [-1, 1]) {
      L.rod(C.metal, [s2 * 0.2, 0.02, 0], [s2 * 0.24, 0.1, 0.02], 0.016, 10);
      L.wear = 0.9; L.add(cyl(0.024, 0.022, 0.13, 12), C.rubber, [s2 * 0.25, 0.14, 0.025], [0.15, 0, -s2 * 0.25]); L.wear = 0;
      L.add(cyl(0.008, 0.008, 0.01, 8), C.red, [s2 * 0.25, 0.21, 0.05], [HP, 0, 0]);
      if (det) L.add(box(0.02, 0.012, 0.014), C.black, [s2 * 0.235, 0.12, 0.045]);
    }
    L.add(cyl(0.025, 0.025, 0.02, 12), C.steel, [0, 0, 0.03], [HP, 0, 0]);
    L.build(p, 'hebel:l');
  }

  // ---- Detail (Nutzer 20.11.): Riffelblech, Schweißnähte, Schraubenreihen, Bedienteile der Simulation, Leitungen
  if (det) {
    // Riffelblech: Bodenplatte trägt die Riffelblech-Textur (cab_riffel); Schweißspritzer an den Nähten
    BASE.spatter(B, C, [xl + 0.01, yF + 0.012, zFB + 0.1], [xl + 0.01, yF + 0.012, zB - 0.1], 16, 3, 0.02);
    BASE.spatter(B, C, [xr - 0.01, yF + 0.012, zFB + 0.1], [xr - 0.01, yF + 0.012, zB - 0.1], 12, 7, 0.02);
    for (const x of [xl + 0.004, xr - 0.004]) { DT.weld(B, C.metal, [[x, yF + 0.006, zFB + 0.02], [x, yF + 0.006, zB - 0.01]]); DT.weld(B, C.metal, [[x, yR - 0.006, zFT + 0.02], [x, yR - 0.006, zB - 0.01]]); }
    DT.weld(B, C.metal, [[xl + 0.01, yR - 0.006, zB - 0.006], [xr - 0.01, yR - 0.006, zB - 0.006]]);
    DT.weld(B, C.metal, [[xl + 0.01, yF + 0.006, zFB + 0.006], [xr - 0.01, yF + 0.006, zFB + 0.006]]);
    // Schrauben an den Deckenrippen bzw. Nieten (1. WK) an den Wandstößen
    for (const zz of [zFT + 0.25, (zFT + zB) / 2 + 0.1]) { const F = new DT.LF(B, [0, yR - 0.032, zz], new THREE.Quaternion().setFromEuler(new THREE.Euler(HP, 0, 0))); DT.boltRow(F, C.steel, [xl + 0.06, 0, 0], [xr - 0.06, 0, 0], Math.max(4, Math.round((xr - xl) / 0.12)), 0.007, det); }
    if (wk1) for (const x of [xl + 0.002, xr - 0.002]) { const F = new DT.LF(B, [x, 0, 0], new THREE.Quaternion().setFromEuler(new THREE.Euler(0, x < x0 ? HP : -HP, 0))); for (let z = zFT + 0.05; z < zB; z += 0.08) DT.rivet(F, C.metal, [x < x0 ? -z : z, (yF + yR) / 2, 0], 0.008); }
    // Hydraulik-/Bremsleitungen unten rechts mit Schellen
    for (const dy of [0, 0.035]) B.tube(C.steel, [[xr - 0.03, yF + 0.09 + dy, zFB + 0.15], [xr - 0.03, yF + 0.09 + dy, z0 - 0.3], [xr - 0.05, yF + 0.07 + dy, zB - 0.05]], 0.008, 6, 8);
    for (let z = zFB + 0.3; z < zB - 0.1; z += 0.28) B.add(box(0.02, 0.07, 0.025), C.metal, [xr - 0.03, yF + 0.1, z]);
    // Stecker am Instrumententräger, Kabel zur Wand
    const PB = new DT.LF(B, PF.w([0, -0.05, -0.06]), PF.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PI, 0))));
    for (let i = 0; i < 3; i++) DT.connector(PB, C, [-0.15 + i * 0.12, 0, 0], det, i === 1 ? C.cableRed : C.rubber);
    // Feldflasche, Prüfplakette, Etiketten, Schablonenschrift
    DT.bottle(B, C, det, new DT.LF(B, [xl + 0.003, yF + 0.3, z0 + 0.12], new THREE.Quaternion().setFromEuler(new THREE.Euler(0, HP, 0))), [0, 0, 0]);
    if (!w2) label(B, C, 'w_24v', [xr - 0.351, yF + 0.22, z0 + 0.5], [0, -HP, 0], 0.08);
    label(B, C, 'w_pruef', [xl + 0.006, yF + 0.8, z0 + 0.2], [0, HP, 0], 0.12);
    label(B, C, 'w_oel', [xr - 0.0975, yF + 0.07 + tH * 0.15, z0 + 0.0], [0, -HP, 0], 0.12);
    stencil(B, C, 's_fahrer', [ox, yR - 0.06, zB - 0.003], [0, PI, 0], 0.22);
    stencil(B, C, 's_nr', [xr - 0.0945, yF + 0.07 + tH * 0.85, z0 - 0.45], [0, -HP, 0], 0.16);
    stencil(B, C, 's_halt', [xl + 0.004, yR - 0.1, z0 - 0.1], [0, HP, 0], 0.16);
  }
  // Schalttafel rechts (Simulation: Batterie, Anlasser, Innenlicht) auf dem Kraftstoffbehälter – 2. WK: an der Instrumententafel
  if (!w2) {
    const pz = E[2] - 0.23, py = E[1] - 0.2;
    B.add(rbox(0.024, 0.34, 0.32, 0.006), C.black, [xr - 0.1, py, pz]);
    if (det) { const F = new DT.LF(B, [xr - 0.113, py, pz], new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -HP, 0))); for (const sy of [-1, 1]) for (const sz2 of [-1, 1]) DT.bolt(F, C.steel, [sz2 * 0.14, sy * 0.155, 0], 0.006, det); }
    simSwitch(grp, B, C, det, era, 'batterie', [xr - 0.13, E[1] - 0.28, E[2] - 0.3], E, 'p_batterie');
    simSwitch(grp, B, C, det, era, 'anlasser', [xr - 0.13, E[1] - 0.28, E[2] - 0.16], E, 'p_anlasser', { guard: false });
    simSwitch(grp, B, C, det, era, 'licht', [xr - 0.13, E[1] - 0.12, E[2] - 0.23], E, 'p_licht');
    if (det) harness(B, C, [[xr - 0.1, py + 0.17, pz], [xr - 0.06, yR - 0.1, pz + 0.05], [xr - 0.035, yR - 0.07, pz + 0.3]], det, 2);
  }
  // Feststellbremse links: Hebel mit Rastsegment und Druckknopf (Simulation: 'sw:bremse', Hebel kippt)
  {
    const hp = [xl + 0.11, yF + 0.3, z0 - 0.3];
    const p = part(grp, 'sw:bremse', hp, new THREE.Quaternion());
    cab_sw.push('sw:bremse');
    B.add(rbox(0.06, 0.05, 0.16, 0.008), C.metal, [hp[0], yF + 0.03, hp[2]]);
    for (let i = 0; i < 7; i++) { const a = -0.5 + i * 0.16; B.add(box(0.012, 0.018, 0.012), C.steel, [hp[0] - 0.02, yF + 0.05 + Math.cos(a) * 0.09, hp[2] + Math.sin(a) * 0.09], [a, 0, 0]); }
    B.add(cyl(0.09, 0.09, 0.008, 12, false), C.metal, [hp[0] - 0.024, yF + 0.05, hp[2]], [0, 0, HP]);
    const hv = part(p, 'hebel', [0, yF + 0.05 - hp[1], 0]);
    const L = new MB();
    L.rod(C.steel, [0, 0, 0], [0, hp[1] - yF - 0.05, 0], 0.012, 8);
    L.wear = 0.85; L.add(cyl(0.02, 0.018, 0.11, 10), C.rubber, [0, hp[1] - yF - 0.05 + 0.04, 0]); L.wear = 0;
    L.add(cyl(0.009, 0.009, 0.02, 8), C.red, [0, hp[1] - yF - 0.05 + 0.1, 0]);
    L.build(hv, 'hebel');
    const lm = new THREE.Mesh(cyl(0.008, 0.008, 0.008, 10).rotateX(HP), C.lampOff); lm.name = 'lampe'; lm.position.set(0.0, yF + 0.07 - hp[1], 0.085); p.add(lm);
    label(B, C, 'p_bremse', [hp[0], yF + 0.0565, hp[2] + 0.04], [-HP, 0, 0], 0.09);
  }
  // Fahrerluke: Unterseite mit Scharnier, Feder und Verriegelung
  if (R.hatch && det) DT.hatchInner(B, C, det, R.hatch.pos, R.hatch.r, yR - 0.02, 'x', 1);
  // Kuppellampe (Streuscheibe folgt dem Lichtmodus), Tageslicht durch die Winkelspiegel
  const lp = [x0 - toC * 0.05, yR - 0.03, z0 + 0.32];
  DT.domeLamp(B, C, det, new DT.LF(B, [lp[0], lp[1] + 0.01, lp[2]], new THREE.Quaternion().setFromEuler(new THREE.Euler(HP, 0, 0))), C.dome);
  cab.lamps.push({ obj: 'hull', pos: new THREE.Vector3(lp[0], lp[1] - 0.06, lp[2]), col: new THREE.Color(modern ? 0xff3a22 : 0xffb870).multiplyScalar(modern ? 0.9 : 0.62), where: 'fahrer' });
  cab.lamps.push({ obj: 'hull', pos: P.clone().addScaledVector(V3(E).sub(P).normalize(), 0.12), col: new THREE.Color(modern ? 0x48ff70 : 0xffb050).multiplyScalar(modern ? 0.28 : 0.15), where: 'fahrer', glow: true });
  cab.lamps.push({ obj: 'hull', pos: new THREE.Vector3(x0, yR - 0.1, zFT + 0.2), col: new THREE.Color(0x9ab8c8).multiplyScalar(0.25), where: 'fahrer', glow: true }); // Tageslicht durch die Winkelspiegel
  B.build(grp, 'fahrerraum');
  cab.driverEye = E;
  return grp;
}

/**
 * Funkerplatz (Bug-MG-Schütze, 2. WK-Panzer mit Kugelblende; Nutzer 20.11.): eigene Kammer rechts vom Fahrer (gleiche Bugform),
 * Kugelblende mit MG (dreht mit der Lafette: 'bugmg'), Zielfernrohr mit Augenmuschel, Pistolengriff, Gurtsack und Hülsensack,
 * Funkgerätestapel über dem Getriebe (Empfänger/Sender mit glimmenden Skalen, Kanalwahl 'rad:kanal', Schalter Ein/Aus und
 * Sprechtaste als Bedienteile der Simulation), Kopfhörer, Regal mit Ersatz-Gurtkästen, Winkelspiegel im Dach, Sitz, Lampe.
 */
function buildFunker(root, D, C, det, era, cab) {
  const F = funkerCabin(D, driverCabin);
  if (!F) return null;
  const L = funkerLayout(F);
  const grp = new THREE.Group();
  grp.name = 'cabin:funker';
  root.add(grp);
  const B = new MB();
  const W = C.wall[era], wk = era !== 'modern';
  const { xl, xr, floor: yF, roof: yR, zFT, zFB, zB, eye: E } = F;
  const x0 = F.F[0], z0 = F.F[2];
  // Rückwand mit Durchgang zum Kampfraum (Nutzer 21.11.): Prisma hinten offen, eigene Wand mit Öffnung, Laibung bis zum
  // Kampfraum (models.js hullCompartment beginnt dahinter; ohne Turmkorb: Kasematte), Rahmen mit Kantenschutz
  const door = funkerDoor(F);
  if (det) B.add(SH.prism([[zB, yF], [zFB, yF], [zFT, yR], [zB, yR]], xl, xr, { rc: 0.07, r0: 0.05, r1: 0.05, bulge: 0.006, steps: det > 1 ? 4 : 2, arcSteps: det > 1 ? 3 : 2, axes: 'zyx', open: [3] }), W);
  else B.add(roomGeom([[zB, yF], [zFB, yF], [zFT, yR], [zB, yR]], xl, xr), W);
  if (det) {
    B.add(SH.holeWall(-xr, -xl, yF, yR, [[-door[1], -door[0], door[2], door[3]]]), W, [0, 0, zB - 0.002], [0, PI, 0]);
    for (const x of [xl + 0.006, xr - 0.006]) B.add(box(0.012, yR - yF, 0.075), W, [x, (yF + yR) / 2, zB - 0.036]); // Ecken (Hohlkehle fehlt)
    for (const y of [yF + 0.006, yR - 0.006]) B.add(box(xr - xl, 0.012, 0.075), W, [(xl + xr) / 2, y, zB - 0.036]);
    const A0 = anchorsOf(D), zK = A0.basket ? BASE.hullDims(D, A0).zF : zB + 0.12;
    B.add(SH.tunnel(door[0], door[1], door[2], door[3], zB - 0.004, zK + 0.03), W);
    const DF = new Frame(B, [(door[0] + door[1]) / 2, (door[2] + door[3]) / 2, zB - 0.012], null), dw = door[1] - door[0], dh = door[3] - door[2];
    for (const sx of [-1, 1]) DF.add(box(0.045, dh + 0.06, 0.03), C.metal, [sx * (dw / 2 + 0.02), 0, 0]);
    for (const sy of [-1, 1]) DF.add(box(dw + 0.08, 0.045, 0.03), C.metal, [0, sy * (dh / 2 + 0.02), 0]);
    DF.add(cyl(0.012, 0.012, dw, 8), C.rubber, [0, -dh / 2 - 0.0, -0.02], [0, 0, HP]);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) DT.bolt(new DT.LF(B, DF.w([sx * (dw / 2 + 0.02), sy * (dh / 2 - 0.05), -0.016]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PI, 0))), C.steel, [0, 0, 0], 0.006, det);
  }
  B.add(box(xr - xl - 0.04, 0.012, zB - zFB - 0.06), C.floor, [(xl + xr) / 2, yF + 0.006, (zB + zFB) / 2]);
  for (const zz of [zFT + 0.25, (zFT + zB) / 2 + 0.1]) B.add(box(xr - xl - 0.04, 0.03, 0.035), C.metal, [(xl + xr) / 2, yR - 0.016, zz]);
  if (det) for (let z = zFT + 0.1; z < zB; z += 0.16) for (const y of [yF + 0.12, yR - 0.1]) B.add(new THREE.SphereGeometry(0.011, 6, 4), C.metal, [xr - 0.006, y, z]);
  // ---- Kugelblende: Panzerring in der Bugplatte (Normale der Schräge), Kugel, MG mit Zielfernrohr (dreht mit der Lafette)
  const mg = F.mg;
  const gn = new THREE.Vector3(0, -(zFB - zFT), yR - yF).normalize();
  const qg = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), gn);
  { const RF = new Frame(B, [mg[0], mg[1], mg[2]], qg);
    RF.add(tor(0.17, 0.035, 8, det ? 28 : 14), C.metal, [0, 0, 0.12]);
    RF.add(cyl(0.21, 0.21, 0.03, det ? 28 : 14), C.metal, [0, 0, 0.1], [HP, 0, 0]);
    if (det) for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; RF.add(cyl(0.012, 0.012, 0.02, 6), C.steel, [Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.12], [HP, 0, 0]); }
    label(B, C, 'w_kopf', RF.w([0, 0.26, 0.115]), qg, 0.1);
  }
  {
    const p = part(grp, 'bugmg', mg);
    const M = new MB();
    M.add(new THREE.SphereGeometry(0.15, det ? 20 : 12, det ? 14 : 8), C.metal, [0, 0, 0]);
    M.add(box(0.085, 0.11, 0.46), C.black, [0, -0.005, 0.32]);          // Gehäuse
    M.add(box(0.095, 0.03, 0.2), C.black, [0, 0.06, 0.26]);              // Zuführerdeckel
    M.wear = 0.7; M.rod(C.metal, [0, -0.06, 0.4], [0, -0.17, 0.44], 0.018, 8); M.wear = 0; // Pistolengriff
    M.add(box(0.012, 0.035, 0.04), C.steel, [0, -0.07, 0.36]);            // Abzugsbügel
    M.add(rbox(0.07, 0.09, 0.08, 0.02), C.rubber, [0, -0.02, 0.6]);       // Schulterstütze
    M.rod(C.steel, [0, -0.02, 0.55], [0, -0.02, 0.5], 0.012, 6);
    M.rod(C.metal, [0.0, 0.1, 0.02], [0.0, 0.12, 0.34], 0.022, 10);       // Zielfernrohr
    M.add(cyl(0.032, 0.028, 0.05, 12, true), C.rubber, [0, 0.13, 0.37], [HP, 0, 0]); // Augenmuschel
    M.add(cyl(0.02, 0.02, 0.004, 10), C.lens, [0, 0.13, 0.35], [HP, 0, 0]);
    M.add(box(0.03, 0.05, 0.05), C.metal, [0, 0.07, 0.06]);              // Fernrohrträger
    // Gurtsack rechts (Gurt läuft ein), Hülsensack unten
    M.add(rbox(0.12, 0.16, 0.18, 0.03), C.canvas, [0.11, -0.12, 0.24]);
    if (det) for (let i = 0; i < 5; i++) M.add(cyl(0.006, 0.006, 0.05, 6), C.brass, [0.055, 0.02 - i * 0.004, 0.18 + i * 0.022], [0, 0, HP]);
    M.add(rbox(0.13, 0.18, 0.2, 0.05), C.canvas, [0, -0.2, 0.18]);
    M.build(p, 'bugmg');
    for (const ch of p.children) ch.scale.setScalar(0.86); // MG etwas schlanker (Sicht des Funkers frei)
    cab.partNames.push('bugmg');
  }
  // ---- Funkgeräte über dem Getriebe (links), Front zum Funker (+X)
  const Qy = (y) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, y, 0));
  const [rx, ry, rz] = L.radio;
  B.add(box(0.3, 0.04, 0.4), C.metal, [rx, yF + 0.37, rz]);                 // Konsole auf dem Getriebe
  B.add(box(0.26, 0.32, 0.36), C.metal, [rx - 0.02, yF + 0.2, rz]);
  for (const [y, h, key] of [[yF + 0.5, 0.19, 'sender'], [yF + 0.745, 0.21, 'empf']]) {
    BASE.cabinet(new DT.LF(B, [rx - 0.12, y, rz], Qy(HP)), C, det, 0.36, h, 0.24, { mat: wk ? C.metal : C.olive, hinge: false, handle: true, beads: det > 1 });
    const FF = new DT.LF(B, [rx + 0.122, y, rz], Qy(HP));
    if (key === 'empf') {
      for (let i = 0; i < 2; i++) {
        const lp = [-0.09 + i * 0.12, 0.035, 0.004];
        FF.add(cyl(0.034, 0.034, 0.012, det ? 18 : 10, 0.002), C.black, lp, [HP, 0, 0]);
        FF.add(new THREE.CircleGeometry(0.027, det ? 18 : 10), C.lampWarm, [lp[0], lp[1], lp[2] + 0.0065], null, null, true);
        FF.add(tor(0.031, 0.004, 4, det ? 18 : 10), C.brass, [lp[0], lp[1], lp[2] + 0.006]);
      }
      FF.add(box(0.1, 0.03, 0.006), C.disp, [0.11, 0.05, 0.004]);
    } else {
      for (let i = 0; i < 3; i++) FF.add(cyl(0.016, 0.014, 0.024, 10), C.black, [0.0 + i * 0.05, 0.05, 0.012], [HP, 0, 0]);
      FF.add(box(0.06, 0.02, 0.006), C.lampAmber, [0.12, 0.055, 0.004]);
    }
  }
  label(B, C, wk ? 'wk_funk' : 'funk', [rx + 0.123, yF + 0.86, rz], Qy(HP), 0.2);
  label(B, C, 'n_kanal', [rx + 0.123, yF + 0.645, rz + 0.12], Qy(HP), 0.09);
  // Kanalwahl (Drehknopf mit Zeiger) – psim/sim.js 'kanal', syncCabin dreht nach vehicle._psimKanal
  {
    const p = part(grp, 'rad:kanal', L.kanal, Qy(HP));
    const K = new MB();
    K.add(cyl(0.03, 0.034, 0.03, det ? 16 : 10), C.black, [0, 0, 0.015], [HP, 0, 0]);
    K.add(box(0.008, 0.026, 0.006), C.yellow, [0, 0.014, 0.032]);
    K.build(p, 'kanal');
    cab.partNames.push('rad:kanal');
    for (let i = 0; i < 8; i++) { const a = -1.2 + (i / 7) * 2.4; B.add(box(0.004, 0.01, 0.004), C.steel, new DT.LF(B, L.kanal, Qy(HP)).w([Math.sin(a) * 0.045, Math.cos(a) * 0.045, 0.002]), Qy(HP)); }
  }
  simSwitch(grp, B, C, det, era, 'funkgeraet', L.ein, E, 'p_funkein');
  simSwitch(grp, B, C, det, era, 'senden', L.senden, E, 'p_senden', { guard: false });
  if (det) {
    harness(B, C, [[rx, yF + 0.86, rz - 0.15], [rx + 0.02, yR - 0.08, rz - 0.2], [xl + 0.05, yR - 0.06, zB - 0.1]], det, 2);
    B.tube(C.black, [[rx + 0.1, yF + 0.6, rz + 0.18], [rx + 0.2, yF + 0.45, rz + 0.26], [x0 - 0.1, yF + 0.55, z0 + 0.25]], 0.005, 5, 8); // Kopfhörerkabel
  }
  // Kopfhörer am Haken (pendelt), Bordsprechkasten an der Rückwand
  {
    const p = part(grp, 'pendel:kopfhoerer2', [xl + 0.05, yR - 0.2, z0 + 0.25]);
    const K = new MB();
    K.add(tor(0.075, 0.009, 5, 14, PI), C.black, [0, -0.08, 0], [0, HP, 0]);
    for (const sz of [-1, 1]) K.add(cyl(0.04, 0.04, 0.03, 12), C.black, [0, -0.09, sz * 0.075], [HP, 0, 0]);
    K.build(p, 'kopfhoerer');
    p.userData.pend = { ax: 0, az: 0, vx: 0, vz: 0 };
    B.add(box(0.04, 0.03, 0.05), C.steel, [xl + 0.03, yR - 0.19, z0 + 0.25]);
  }
  { const bx = x0 + 0.2 > door[0] - 0.1 && x0 + 0.2 < door[1] + 0.1 ? (door[1] + 0.14 < xr - 0.08 ? door[1] + 0.14 : door[0] - 0.14) : x0 + 0.2;
    BASE.cabinet(new DT.LF(B, [bx, yF + 0.62, zB - 0.005], Qy(PI)), C, det, 0.12, 0.17, 0.1, { mat: wk ? C.metal : C.olive }); }
  // ---- Regal mit Ersatz-Gurtkästen an der rechten Wand
  {
    const [gx, gy, gz] = L.regal;
    B.add(box(0.05, 0.02, 0.5), C.steel, [gx + 0.04, gy - 0.1, gz]);
    for (let i = 0; i < 3; i++) {
      const z = gz - 0.17 + i * 0.17;
      B.add(rbox(0.1, 0.17, 0.14, 0.01), C.olive, [gx, gy, z]);
      B.add(box(0.06, 0.012, 0.02), C.steel, [gx, gy + 0.095, z]);
      if (det) B.add(box(0.004, 0.06, 0.08), C.black, [gx - 0.051, gy, z]);
    }
    B.rod(C.steel, [gx - 0.07, gy + 0.05, gz - 0.27], [gx - 0.07, gy + 0.05, gz + 0.27], 0.006);
    label(B, C, 'p_gurt', [xr - 0.004, gy + 0.18, gz], Qy(-HP), 0.12);
    // Ersatzlauf in Klammern darüber
    B.rod(C.metal, [xr - 0.05, yR - 0.22, gz - 0.35], [xr - 0.05, yR - 0.22, gz + 0.25], 0.016, 10);
    for (const dz of [-0.25, 0.15]) B.add(box(0.03, 0.04, 0.02), C.steel, [xr - 0.03, yR - 0.22, gz + dz]);
  }
  // ---- Winkelspiegel im Dach vor der Luke, Sitz, Lampe, Etiketten
  {
    const c = [x0, yR - 0.085, zFT + 0.1];
    const P = new Frame(B, c, new THREE.Quaternion());
    P.add(rbox(0.21, 0.15, 0.14, 0.012), C.metal, [0, 0, 0]);
    P.add(new THREE.PlaneGeometry(0.17, 0.07), C.prism, [0, -0.015, 0.0705], null, null, true);
    P.add(box(0.19, 0.012, 0.02), C.rubber, [0, 0.026, 0.075]);
    P.add(rbox(0.21, 0.05, 0.06, 0.02), C.pad, [0, 0.07, 0.08]);
    (cab.prisms || (cab.prisms = [])).push({ obj: 'hull', pos: P.w([0, -0.015, 0.072]), quat: P.q.toArray(), w: 0.17, h: 0.07, up: 0.12 });
  }
  if (det) DT.seat(B, C, det, L.seat, 0, { post: 0.26, back: true, w: 0.4, d: 0.38, foot: false, seed: 4 });
  else B.add(rbox(0.4, 0.08, 0.38, 0.03), C.pad, L.seat);
  DT.domeLamp(B, C, det, new DT.LF(B, [L.lamp[0], L.lamp[1] + 0.01, L.lamp[2]], new THREE.Quaternion().setFromEuler(new THREE.Euler(HP, 0, 0))), C.dome);
  cab.lamps.push({ obj: 'hull', pos: new THREE.Vector3(L.lamp[0], L.lamp[1] - 0.06, L.lamp[2]), col: new THREE.Color(0xffb46a).multiplyScalar(0.45), where: 'fahrer' });
  if (det) { stencil(B, C, 's_nr', [xr - 0.004, yF + 0.6, z0 - 0.4], [0, -HP, 0], 0.14); label(B, C, 'w_24v', [xl + 0.004, yF + 0.25, z0 + 0.3], [0, HP, 0], 0.08); extinguisher(B, C, [xr - 0.09, yF + 0.25, zB - 0.15], 1, det); }
  B.build(grp, 'funkerraum');
  cab.funkerEye = E;
  return grp;
}

/* ===================================================================== Turm-/Kampfraum (Gruppenraum des Innenraums) */

/** Ankerpunkte der Plätze im Gruppenraum des Innenraums (KP-1-Aufbau, um shift/scale verschoben). */
function anchorsOf(D) {
  const I = D.interior || {}, sh = I.shift || [0, 0, 0], sc = I.scale || 1;
  const toG = (p) => [(p[0] - sh[0]) / sc, (p[1] - sh[1]) / sc, (p[2] - sh[2]) / sc];
  const innen = (pred) => { const s = D.seats.find(pred); const v = s && (s.views || []).find((x) => x.interior && x.space === 'turret'); return v ? toG(v.station || v.pos) : null; };
  const hatch = (id) => { const h = D.hatches && D.hatches[id]; return h && h.space === 'turret' ? { pos: toG(h.pos), r: h.r / sc } : null; };
  const basket = !D.turretLimits && I.basket !== false;
  const hb = D.hullBox, tp = D.turretPivot, le = I.loaderEye || [0.55, 0.62, 0.35];
  const yb = basket ? (Math.max(hb[1] - hb[4] + 0.12 - tp[1], sh[1] + sc * le[1] - 1.68) - sh[1]) / sc : 0.07;
  const ringR = (D.ringR || D.turretBox[3] * 0.8) / sc;
  return {
    I, sh, sc, toG, basket, yb, ringR, rc: [-sh[0] / sc, 0.06, -sh[2] / sc],
    gun: innen((s) => s.mount === 'gun'), cmd: innen((s) => s.id === 'commander'), load: le,
    hatchC: hatch('commander'), hatchL: hatch('loader'),
    /** Gruppenraum → Rohrraum (Rohrerhöhung 0) */
    gunLocal: (p) => [p[0] * sc + sh[0] - D.gunPivot[0], p[1] * sc + sh[1] - D.gunPivot[1], p[2] * sc + sh[2] - D.gunPivot[2]],
  };
}

/** Zusatzausstattung Turm/Kampfraum (Nutzer 20.11.): Bedienteile der Simulation als echte Schalter, Sitze mit Polstern
 * und Gurten, Riffelblech im Turmkorb, Lukenunterseiten, Schweißnähte und Schraubenreihen, Feuerlöscher, Feldflasche,
 * Verbandkasten, Etiketten und Schablonenschrift. Alles im Gruppenraum des Innenraums (wie buildTurret). */
function turretDetail(D, C, det, era, cab, A, B, grp, GB) {
  const modern = era === 'modern', wk1 = era === 'wk1';
  const Qy = (y) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, y, 0));
  const g = A.gun, c = A.cmd, l = A.load;
  const rackRight = A.I.rack && A.I.rack[0] > 0.5;
  // ---- Richtschütze: Waffenschaltkasten oben rechts vor dem Platz (Hauptschalter Waffe, Turmantrieb, Laser)
  if (g) {
    const ids = modern ? [['waffe', 'p_waffe'], ['antrieb', 'p_antrieb'], ['laser', 'p_laser']] : [['waffe', 'p_waffe'], ['antrieb', 'p_antrieb']];
    const base = [g[0] + 0.17, g[1] + 0.05, g[2] - 0.33];
    const mid = [base[0] + (ids.length - 1) * 0.055, base[1], base[2] + 0.02];
    const q = aim(mid, g);
    const F = new DT.LF(B, mid, q);
    F.add(rbox(ids.length * 0.115 + 0.03, 0.16, 0.02, 0.006), wk1 || era === 'wk2' ? C.metal : C.black, [0, -0.005, -0.04]);
    for (const sx of [-1, 1]) F.rod(C.steel, [sx * ids.length * 0.05, 0.07, -0.045], [sx * ids.length * 0.05, 0.74 - mid[1] + 0.1, -0.12], 0.008, 6);
    ids.forEach(([id, key], i) => simSwitch(grp, B, C, det, era, id, F.w([(i - (ids.length - 1) / 2) * 0.115, 0, -0.02]), g, key));
    if (det) harness(B, C, [F.w([0, 0.07, -0.05]), [mid[0] + 0.05, 0.72, mid[2] + 0.05], [Math.min(1.1, mid[0] + 0.4), 0.71, mid[2] + 0.3]], det, 2);
  }
  // ---- Ladeschütze: Munitionswahl neben dem Gestell bzw. der Bunkertür
  if (l && A.I.rack) {
    const I = A.I, rw = I.rackGrid ? I.rackGrid[0] * 0.155 + 0.07 : 1.62, rr = I.rackRot || [0, 0];
    const loc = new THREE.Vector3(rw / 2 + 0.1, 0.12, -0.36 - 0.3).applyEuler(new THREE.Euler(rr[0], rr[1], 0, 'YXZ')).add(V3(I.rack));
    simSwitch(grp, B, C, det, era, 'wahl', loc.toArray(), l, 'p_wahl');
  }
  // ---- Kommandant: Funk-Bedienteil an der linken Wand
  if (c && !wk1) {
    const fp = modern ? [-1.08, 0.64, 0.64] : [-1.02, 0.6, 0.02];
    B.add(rbox(0.03, 0.14, 0.16, 0.006), C.black, [fp[0] - 0.08, fp[1], fp[2]]);
    simSwitch(grp, B, C, det, era, 'funk', fp, c, 'p_funk');
    if (det) { B.tube(C.black, [[fp[0] - 0.08, fp[1] - 0.06, fp[2] + 0.05], [fp[0] - 0.12, fp[1] - 0.15, fp[2] + 0.15], [fp[0] - 0.1, 0.45, modern ? 0.8 : -0.15]], 0.006, 5, 10); label(B, C, 'w_funk2', [fp[0] - 0.064, fp[1] + 0.1, fp[2]], [0, HP, 0], 0.12); }
  }
  // ---- Ladeschütze: drehbarer Winkelspiegel vor der Luke (Kopf im Dach, Griffe links/rechts, Stirnpolster)
  const LP = l && !wk1 ? loaderPrism(D) : null;
  if (LP) {
    const ig = A.toG(LP[0].inner);
    const P = new Frame(B, ig, new THREE.Quaternion());
    P.add(cyl(0.085, 0.085, 0.05, det ? 20 : 12), C.steel, [0, 0.11, 0]);           // Drehring im Dach
    P.add(rbox(0.17, 0.2, 0.12, 0.012), C.metal, [0, 0, -0.01]);
    P.add(new THREE.PlaneGeometry(0.12, 0.06), C.prism, [0, -0.02, 0.0505], null, null, true);
    P.add(box(0.14, 0.012, 0.02), C.rubber, [0, 0.015, 0.055]);
    P.add(rbox(0.17, 0.045, 0.05, 0.02), C.pad, [0, 0.06, 0.06]);
    for (const sx of [-1, 1]) { P.rod(C.steel, [sx * 0.085, -0.04, 0.02], [sx * 0.13, -0.06, 0.07], 0.008); P.add(cyl(0.015, 0.015, 0.06, 8), C.rubber, [sx * 0.13, -0.06, 0.09], [HP, 0, 0]); }
    (cab.prisms || (cab.prisms = [])).push({ obj: 'tur', pos: P.w([0, -0.02, 0.052]), quat: P.q.toArray(), w: 0.12, h: 0.06, up: 0.3 });
  }
  if (!det) return;
  // ---- Sitze
  if (c && !wk1) {
    const post = A.basket ? Math.max(0.2, 0.34 - 0.085 - A.yb) : 0.19;
    // am Platz des Kommandanten, Lehne gut hinter dem Augpunkt (Nutzer 21.11.: Auge zwischen Polstern, zu wenig Platz)
    const cz = Math.max(0.55, c[2] + 0.2);
    DT.seat(B, C, det, [c[0], 0.345, cz], 0, { post, back: true, w: 0.42, d: 0.4, foot: false, seed: 1 });
    label(B, C, 'w_sitz', [c[0] + 0.215, 0.27, cz], [0, HP, 0], 0.07);
  }
  if (!wk1) {
    if (rackRight) DT.seat(B, C, det, [0.6, 0.34, 1.35], PI, { post: 0.2, back: false, seed: 2 });
    else DT.seat(B, C, det, [1.15, 0.4, 0.25], HP, { folded: true, w: 0.4, d: 0.36 });
  }
  if (A.basket && g) {
    const rB = A.ringR - 0.07, [cx, , cz] = A.rc, h = -A.yb;
    const gx = cx + rB * 0.45, gz = cz - rB * 0.45;
    DT.seat(B, C, det, [gx, A.yb + h * 0.56 + 0.045, gz], 0, { post: h * 0.56 - 0.04, back: true, w: 0.4, d: 0.38, foot: true, seed: 3 });
  }
  // ---- Riffelblech: Turmkorbboden bzw. Bodenplatte (1. WK)
  if (A.basket) {
    const rB = A.ringR - 0.07;
    // Trittkante (gelb/schwarz) am Korbrand vorn (Durchstieg)
    label(B, C, 'streifen', [A.rc[0], A.yb + 0.0045, A.rc[2] - rB + 0.07], [-HP, 0, 0], 0.4);
  }
  // ---- Lukenunterseiten (Kommandant: Scharnier hinten; Ladeschütze: Scharnier außen rechts)
  if (A.hatchC) DT.hatchInner(B, C, det, A.hatchC.pos, A.hatchC.r, A.hatchC.pos[1], 'x', 1);
  if (A.hatchL) { DT.hatchInner(B, C, det, A.hatchL.pos, A.hatchL.r, A.hatchL.pos[1], 'z', 1); label(B, C, 'w_luke', [A.hatchL.pos[0], A.hatchL.pos[1] - 0.011, A.hatchL.pos[2] - A.hatchL.r - 0.09], [HP, 0, PI], 0.1); }
  // ---- Schweißnähte an den Turmecken und am Dachrand, Schraubenreihen am Dach
  const foot = [[-0.9, 1.15], [0.9, 1.15], [1.24, 0.8], [1.25, -1.45], [0.9, -1.92], [-0.9, -1.92], [-1.25, -1.45], [-1.24, 0.8]].map(([x, v]) => [x * 0.985, -v * 0.985]);
  if (!wk1) {
    for (const [x, z] of foot) DT.weld(B, C.metal, [[x, 0.07, z], [x, 0.74, z]], 0.005);
    DT.weld(B, C.metal, [...foot.map(([x, z]) => [x, 0.742, z]), [foot[0][0], 0.742, foot[0][1]]], 0.005);
    const QB = new THREE.Quaternion().setFromEuler(new THREE.Euler(HP, 0, 0));
    for (const z of [-0.65, 1.35]) DT.boltRow(new DT.LF(B, [0, 0.749, z], QB), C.steel, [-0.85, 0, 0], [0.85, 0, 0], 12, 0.008, det);
  } else {
    // 1. WK: Nietreihen an den Wänden
    for (const [x, z, ry] of [[-1.235, 0, HP], [1.235, 0, -HP]]) { const F = new DT.LF(B, [x, 0, z], Qy(ry)); for (let k = -1.3; k <= 0.8; k += 0.1) for (const y of [0.18, 0.62]) DT.rivet(F, C.metal, [k, y, 0], 0.009); }
  }
  // ---- Feuerlöscher (Grund-Innenraum) mit Halterung, Schlauch und Ring; Feldflasche; Verbandkasten
  const fx = rackRight ? -1.1 : 1.1, fz = rackRight ? 0.3 : 0.95;
  extinguisher(B, C, [fx, 0.33, fz], fx > 0 ? 1 : -1, det);
  if (!wk1) {
    DT.bottle(B, C, det, new DT.LF(B, [1.235, 0.42, 0.62], Qy(-HP)), [0, 0, 0]);
    DT.firstAid(B, C, det, new DT.LF(B, [-1.235, 0.52, -0.6], Qy(HP)), (key, lp, w) => { const g2 = plateGeom(key, w); if (g2) B.add(g2, C.label, new DT.LF(B, [-1.235, 0.52, -0.6], Qy(HP)).w(lp), Qy(HP), null, true); });
  }
  // ---- Etiketten und Schablonenschrift (frei erfunden)
  stencil(B, C, 's_ladesch', [1.237, 0.6, 0.45], [0, -HP, 0], 0.26);
  stencil(B, C, 's_kdt', [-1.237, 0.62, 0.15], [0, HP, 0], 0.24);
  stencil(B, C, 's_nr', [-1.237, 0.16, 0.2], [0, HP, 0], 0.18);
  stencil(B, C, wk1 ? 's_wk' : 's_kampf', [1.237, 0.15, -0.3], [0, -HP, 0], 0.26);
  if (A.basket) stencil(B, C, 's_tritt', [A.rc[0] + 0.12, A.yb + 0.262, A.rc[2]], [-HP, 0, 0], 0.14);
  if (!wk1) {
    label(B, C, 'w_kopf', [-0.62, 0.7, 0.3], [HP, 0, PI], 0.11);
    label(B, C, modern ? 'w_hydr' : 'w_schmier', [1.237, 0.42, -0.25], [0, -HP, 0], 0.11);
    label(B, C, 'w_erde', [-1.237, 0.3, -0.3], [0, HP, 0], 0.09);
  }
  if (A.I.wet) label(B, C, 'w_nass', [A.I.rack[0], A.I.rack[1] + 0.01, A.I.rack[2] - 0.5], [-HP, 0, 0], 0.16);
  // Tageslicht durch die Winkelspiegel der Kuppel (weich, ohne Schatten)
  if (A.hatchC && !wk1) cab.lamps.push({ obj: 'tur', pos: V3([A.hatchC.pos[0], Math.min(A.hatchC.pos[1], 0.75) - 0.18, A.hatchC.pos[2]]), col: new THREE.Color(0x9ab8c8).multiplyScalar(0.2), where: 'turm', glow: true });
}

/** Helfer für cabin-base.js (Schilder, Feuerlöscher) an einem Bucket. */
function kit(B, C, det) {
  return {
    label: (key, pos, rot, w) => label(B, C, key, pos, rot, w),
    flabel: (F, key, lpos, w, lrot = null) => flabel(F, C, key, lpos, w, lrot),
    extinguisher: (pos, nx) => extinguisher(B, C, pos, nx, det),
  };
}

/**
 * Splitterschutzmatten (gesteppt, mit Einfassband und Druckknöpfen) an den Seitenwänden des Turms: Raster je Wand,
 * Felder mit Anbauten (Schilder, Kästen, Halter – alles, was der Bucket an der Wand schon hat) bleiben frei.
 */
function wallLiners(B, C, det) {
  const occ = [];
  for (const [mat, list] of B.m) {
    if (mat === C.wall.modern || mat === C.wall.kk) continue;
    for (const g of list) {
      if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox;
      if (bb.max.x - bb.min.x > 1.2 || bb.max.z - bb.min.z > 1.6) continue;
      if (bb.max.x > 1.1 || bb.min.x < -1.1) occ.push(bb);
    }
  }
  const zs = [-0.62, -0.24, 0.14, 0.52, 0.9, 1.28], ys = [[0.13, 0.39], [0.41, 0.66]];
  for (const sx of [-1, 1]) {
    const wallAt = (z) => 1.24 + (z + 0.8) / 2.25 * 0.01;
    for (let i = 0; i < zs.length - 1; i++) for (const [y0, y1] of ys) {
      const z0 = zs[i] + 0.006, z1 = zs[i + 1] - 0.006, zc = (z0 + z1) / 2, x = sx * (wallAt(zc) + 0.01 * Math.sin(PI * (((y0 + y1) / 2) - 0.06) / 0.69) - 0.003);
      const blocked = occ.some((bb) => (sx > 0 ? bb.max.x > Math.abs(x) - 0.06 : bb.min.x < -Math.abs(x) + 0.06) && bb.max.z > z0 - 0.01 && bb.min.z < z1 + 0.01 && bb.max.y > y0 - 0.01 && bb.min.y < y1 + 0.01);
      if (blocked) continue;
      BASE.linerPad(new DT.LF(B, [x, (y0 + y1) / 2, zc], new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sx > 0 ? -HP : HP, 0))), C, det, z1 - z0, y1 - y0, 0.024);
    }
  }
}

function buildTurret(D, C, det, era, cab, A) {
  const grp = new THREE.Group();
  grp.name = 'cabin:turm';
  const gunG = new THREE.Group();
  gunG.name = 'cabin:rohr';
  const B = new MB(), GB = new MB();
  const modern = era === 'modern', wk1 = era === 'wk1', sc = A.sc;
  const W = C.wall[era];
  const tb = (D.interior && D.interior.breech) || [0, 0.42, -0.55];
  const bs = sc * ((D.interior && D.interior.breechScale) || 1);
  const breechGun = A.gunLocal(tb);

  // ---------------------------------------------------------------- Grund-Innenraum modelliert (Nutzer 20.11.)
  // ersetzt die Kästen aus models.js (attachCabin blendet sie aus): Schale, Böden, Rahmen, Griffe, Leitungen, Geräte, Korb
  BASE.turretBase(B, C, det, era, D, A, kit(B, C, det), { gunSeat: !!(det && A.basket && A.gun), cmdSeat: !!(det && A.cmd && !wk1), loadSeat: !!(det && !wk1) });

  // ---------------------------------------------------------------- Richtschütze
  const g = A.gun;
  if (g) {
    if (modern) {
      // Hauptzieloptik (turmfest) mit Okular, Säule zur Decke, Stirnpolster
      const O = [g[0] - 0.01, g[1] - 0.01, g[2] - 0.3];
      const F = new Frame(B, O, aim(O, g));
      eyepiece(F, C, det);
      F.add(box(0.12, Math.max(0.05, 0.74 - O[1]), 0.14), C.metal, [0, (0.74 - O[1]) / 2 + 0.1, -0.33]);
      flabel(F, C, 'optik', [0.0815, 0.02, -0.25], 0.16, [0, HP, 0]);
      // Steuergriff (eigene Gruppe: kippt mit dem Richten)
      const gp = F.w([0, -0.3, -0.02]);
      const p = part(grp, 'griff', gp, F.q);
      const L = new MB();
      L.rod(C.metal, [0, 0, -0.04], [0, -0.3, -0.12], 0.025, 8);
      L.add(rbox(0.3, 0.05, 0.07, 0.015), C.metal, [0, 0, -0.03]);
      for (const sx of [-1, 1]) {
        L.add(cyl(0.022, 0.02, 0.13, 12), C.rubber, [sx * 0.15, -0.035, 0], [0.25, 0, sx * 0.15]);
        L.add(box(0.016, 0.03, 0.02), C.red, [sx * 0.15, 0.005, 0.03]);
        L.add(cyl(0.008, 0.008, 0.012, 8), C.black, [sx * 0.15, 0.03, -0.005]);
        L.add(box(0.04, 0.012, 0.03), C.black, [sx * 0.15, -0.09, 0.03], [0.3, 0, 0]); // Handballenschalter
      }
      L.build(part(p, 'griff:innen'), 'griff');
      cab.partNames.push('griff');
      // Feuerleitrechner-Bildschirm mit Tasten, Munitionswahl darunter
      const SP = [g[0] + 0.27, g[1] - 0.12, g[2] - 0.24];
      const SF = new Frame(B, SP, aim(SP, g));
      SF.add(rbox(0.23, 0.18, 0.06, 0.012), C.black, [0, 0, -0.032]);
      SF.add(new THREE.PlaneGeometry(0.176, 0.11), screen('fcs', 256, 160).mat, [0, 0.01, 0.001], null, null, true);
      for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) SF.add(box(0.012, 0.016, 0.01), C.rubber, [sx * 0.103, 0.05 - i * 0.03, 0.002]);
      for (let i = 0; i < 5; i++) SF.add(box(0.022, 0.01, 0.01), C.rubber, [-0.07 + i * 0.035, -0.072, 0.002]);
      SF.add(rbox(0.16, 0.06, 0.03, 0.008), C.black, [0, -0.125, -0.01]);
      flabel(SF, C, 'tasten', [0, -0.125, 0.0065], 0.15);
      flabel(SF, C, 'n_entf', [0.04, 0.078, 0.0], 0.1);
      cab.screens.fcs = true;
      ['mbt_ap', 'mbt_he', 'mg'].forEach((k, i) => {
        const bp = part(grp, 'btn:' + k, SF.w([-0.053 + i * 0.053, -0.12, 0.01]), SF.q);
        const bm = new THREE.Mesh(box(0.026, 0.014, 0.008), C.lampOff);
        bm.name = 'btn'; bp.add(bm);
        cab.partNames.push('btn:' + k);
      });
      cab.lamps.push({ obj: 'tur', pos: V3(SF.w([0, 0.01, 0.12])), col: new THREE.Color(0x40ff60).multiplyScalar(0.22), where: 'turm', glow: true });
      // Rechnerkasten an der Turmwand (Rippen, Stecker)
      const wx = Math.min(1.16, g[0] + 0.5);
      B.add(rbox(0.12, 0.26, 0.38, 0.015), C.olive, [wx, g[1] - 0.32, g[2] - 0.12]);
      if (det) for (let i = 0; i < 6; i++) B.add(box(0.012, 0.22, 0.012), C.metal, [wx - 0.066, g[1] - 0.32, g[2] - 0.27 + i * 0.06]);
      for (let i = 0; i < 3; i++) B.add(cyl(0.018, 0.018, 0.04, 10), C.metal, [wx - 0.02, g[1] - 0.17, g[2] - 0.22 + i * 0.09]);
      label(B, C, 'richt', [wx - 0.0615, g[1] - 0.22, g[2] - 0.12], [0, -HP, 0], 0.15);
      harness(B, C, [[wx - 0.02, g[1] - 0.15, g[2] - 0.13], [wx - 0.05, 0.7, g[2] - 0.1], [wx - 0.04, 0.71, g[2] + 0.5]], det);
      // Hilfszielfernrohr (am Rohr, nickt mit)
      const ax = Math.max(0.33, g[0] - 0.26);
      const a0 = A.gunLocal([ax, g[1] - 0.06, g[2] - 0.3]), a1 = A.gunLocal([ax, g[1] - 0.06, -1.1]);
      GB.rod(C.metal, a0, a1, 0.03 * sc, 12);
      GB.add(cyl(0.04 * sc, 0.035 * sc, 0.05 * sc, 12, true), C.rubber, [a0[0], a0[1], a0[2] + 0.02 * sc], [HP, 0, 0]);
      GB.add(box(0.05 * sc, 0.07 * sc, 0.1 * sc), C.metal, [a0[0], a0[1] - 0.05 * sc, (a0[2] + a1[2]) / 2]);
    } else {
      // Zielfernrohr am Rohr (nickt mit), Augenmuschel, Stirnpolster
      const O = [g[0] - 0.02, g[1] - 0.02, g[2] - 0.28];
      const Og = A.gunLocal(O), Eg = A.gunLocal(g);
      const F = new Frame(GB, Og, aim(Og, Eg));
      eyepiece(F, C, det, { body: [0.09 * sc, 0.1 * sc, 0.12], brass: wk1 });
      F.add(cyl(0.04 * sc, 0.04 * sc, 0.7 * sc, 12), wk1 ? C.brass : C.metal, [0, 0.01, -0.5 * sc], [HP, 0, 0]);
      F.add(box(0.05, 0.05, 0.25 * sc), C.metal, [-0.03, -0.05, -0.35 * sc]);
      if (era === 'wk2') {
        // Turmrichtungsanzeiger (Uhr) vor dem Richtschützen
        const AP = [g[0] - 0.22, g[1] - 0.2, g[2] - 0.32];
        const AF = new Frame(B, AP, aim(AP, g));
        AF.add(rbox(0.15, 0.15, 0.05, 0.015), C.black, [0, 0, -0.03]);
        gauge(AF, C, 'w_az', [0, 0, 0], 0.06, C.steel, grp, 'az', 1, det);
      }
      // Fußabzüge
      for (const [i, m] of [[0, C.metal], [1, C.red]]) B.add(rbox(0.09, 0.02, 0.13, 0.008), m, [g[0] - 0.08 + i * 0.13, A.yb + 0.06, g[2] - 0.35], [-0.35, 0, 0]);
    }
    // Handräder: Höhe (rechts, Achse quer), Seite (vorn links, Achse zum Schützen)
    const R = modern ? 0.075 : wk1 ? 0.13 : 0.1;
    const mat = wk1 ? C.metal : modern ? C.black : C.metal;
    const ep = [g[0] + 0.22 + R * 0.4, g[1] - 0.34, g[2] - 0.2];
    handwheel(grp, 'rad:hoehe', ep, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, HP, 0)), R, C, mat, det);
    B.add(rbox(0.08, 0.1, 0.1, 0.01), C.metal, [ep[0] + 0.07, ep[1], ep[2]]);
    const tp = [g[0] - 0.18, g[1] - 0.38, g[2] - 0.3];
    handwheel(grp, 'rad:seite', tp, aim(tp, [g[0] - 0.1, g[1] - 0.2, g[2]]), R * 1.1, C, mat, det);
    B.add(rbox(0.14, 0.12, 0.12, 0.015), C.metal, [tp[0], tp[1], tp[2] - 0.1]);
    B.rod(C.metal, [tp[0], tp[1] - 0.06, tp[2] - 0.1], [tp[0], A.yb + 0.1, tp[2] - 0.1], 0.03);
    cab.partNames.push('rad:hoehe', 'rad:seite');
    label(B, C, wk1 || era === 'wk2' ? 'wk_achtung' : 'turmsperre', [tp[0], tp[1] + 0.1, tp[2] - 0.035], aim([0, 0, 0], [0, 0, 1]), 0.13);
  }

  // ---------------------------------------------------------------- Kommandant
  const c = A.cmd, H = A.hatchC;
  if (c && !wk1) {
    if (H) {
      // Kuppel: Laufring, Polsterring, Winkelspiegel rundum, Lukenunterseite mit Verriegelung und Ausgleichsfeder
      const [hx, hy, hz] = H.pos, r = H.r;
      const yr = Math.min(hy, 0.75) - 0.03;
      B.add(tor(r + 0.05, 0.032, 6, det ? 32 : 16), C.steel, [hx, yr, hz], [HP, 0, 0]);
      B.add(tor(r + 0.1, 0.026, 6, det ? 32 : 16), C.pad, [hx, yr - 0.045, hz], [HP, 0, 0]); // Polsterring (schmal: Nutzer 21.11.)
      // Kuppelschacht: Wand zwischen Turmdecke und Spiegelkranz, die Winkelspiegel sitzen darin
      { const hgt = Math.max(0.12, Math.max(0.76, hy - 0.01) - (yr - 0.17)); const g2 = inwardGeom(cyl(r + 0.075, r + 0.075, hgt, det ? 32 : 16, true)); B.add(g2, W, [hx, yr - 0.17 + hgt / 2, hz]); } // Schacht bis an die Luke (Nutzer 21.11.: hohe Kuppel – Lücke nach außen)
      B.add(tor(r + 0.075, 0.015, 4, det ? 32 : 16), C.steel, [hx, yr - 0.17, hz], [HP, 0, 0]);
      const n = modern ? 6 : 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2 + 0.3;
        const p = [hx + Math.sin(a) * (r + 0.02), yr - 0.1, hz + Math.cos(a) * (r + 0.02)];
        const F = new Frame(B, p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a + PI, 0)));
        F.add(rbox(0.13, 0.1, 0.08, 0.01), C.metal);
        F.add(new THREE.PlaneGeometry(0.11, 0.05), C.prism, [0, 0.005, 0.0405], null, null, true);
        (cab.prisms || (cab.prisms = [])).push({ obj: 'tur', pos: F.w([0, 0.005, 0.042]), quat: F.q.toArray(), w: 0.11, h: 0.05, up: 0.2 });
        F.add(box(0.12, 0.01, 0.012), C.rubber, [0, 0.033, 0.042]);
      }
      B.rod(C.steel, [hx - r * 0.7, yr + 0.02, hz], [hx + r * 0.7, yr + 0.02, hz], 0.012);
      B.add(cyl(0.025, 0.025, 0.12, 10), C.black, [hx + r * 0.5, yr - 0.02, hz + r * 0.3], [0, 0, HP]);
      B.rod(C.steel, [hx - r * 0.85, yr - 0.03, hz - 0.1], [hx - r * 0.85, yr - 0.03, hz + 0.1], 0.015);
      label(B, C, 'kopf', [hx, yr - 0.155, hz + r + 0.13], aim([0, 0, 0], [0, 0, -1]), 0.16);
    }
    if (modern) {
      const O = [c[0] + 0.05, c[1] - 0.02, c[2] - 0.29];
      const F = new Frame(B, O, aim(O, c));
      eyepiece(F, C, det);
      F.add(box(0.12, Math.max(0.05, 0.74 - O[1]), 0.14), C.metal, [0, (0.74 - O[1]) / 2 + 0.1, -0.33]);
      // Lagebildschirm
      const DP = [c[0] - 0.24, c[1] - 0.16, c[2] - 0.22];
      const DF = new Frame(B, DP, aim(DP, c));
      DF.add(rbox(0.25, 0.2, 0.06, 0.012), C.black, [0, 0, -0.032]);
      DF.add(new THREE.PlaneGeometry(0.19, 0.143), screen('cmd', 256, 192).mat, [0, 0.005, 0.001], null, null, true);
      flabel(DF, C, 'n_kanal', [-0.05, 0.087, 0.0], 0.09);
      for (let i = 0; i < 5; i++) DF.add(box(0.016, 0.012, 0.01), C.rubber, [0.112, 0.06 - i * 0.03, 0.002]);
      DF.rod(C.steel, [0, -0.1, -0.04], [0, -0.3, -0.12], 0.02);
      cab.screens.cmd = true;
      cab.lamps.push({ obj: 'tur', pos: V3(DF.w([0, 0, 0.12])), col: new THREE.Color(0x60ff80).multiplyScalar(0.16), where: 'turm', glow: true });
    }
    // Funkgeräte an der linken Turmwand (modern: zwei Geräte im Gestell; 2. WK: Empfänger zusätzlich zum Röhrengerät)
    const rx = -1.12, rz = modern ? 0.95 : 0.3;
    if (modern) {
      for (const [i, key] of [[0, 'radio1'], [1, 'radio2']]) {
        const y = 0.33 + i * 0.16;
        B.add(rbox(0.2, 0.14, 0.34, 0.01), C.olive, [rx, y, rz]);
        label(B, C, key, [rx + 0.1015, y, rz], [0, HP, 0], 0.3);
        for (const [dz, dy] of [[0.07, 0.028], [0.125, 0.028], [0.07, -0.032], [0.125, -0.032]]) B.add(cyl(0.014, 0.014, 0.018, 10), C.black, [rx + 0.11, y + dy, rz + dz], [0, 0, HP]);
      }
      for (const sz of [-1, 1]) B.add(box(0.22, 0.36, 0.02), C.metal, [rx, 0.41, rz + sz * 0.18]);
      label(B, C, 'funk', [rx + 0.101, 0.6, rz], [0, HP, 0], 0.22);
      harness(B, C, [[rx, 0.48, rz - 0.15], [rx + 0.02, 0.7, rz - 0.3], [rx + 0.05, 0.72, rz - 0.8]], det);
    } else {
      B.add(rbox(0.18, 0.2, 0.3, 0.01), C.metal, [-1.1, 0.58, -0.25]);
      label(B, C, 'wk_funk', [-1.0085, 0.58, -0.25], [0, HP, 0], 0.26);
      for (let i = 0; i < 2; i++) B.add(cyl(0.025, 0.025, 0.02, 10), C.black, [-1.0, 0.52, -0.33 + i * 0.16], [0, 0, HP]);
    }
    // Hörer am Spiralkabel (pendelt) und Kopfhörer am Haken; Bordsprechkasten; Kartentasche
    const hp = [rx + 0.14, modern ? 0.62 : 0.66, rz - 0.22];
    {
      const p = part(grp, 'pendel:hoerer', hp);
      const L = new MB();
      L.add(rbox(0.05, 0.2, 0.04, 0.015), C.black, [0, -0.13, 0]);
      for (const sy of [-1, 1]) L.add(cyl(0.03, 0.03, 0.035, 10), C.black, [0, -0.13 + sy * 0.09, 0.01], [HP, 0, 0]);
      if (det) {
        // Spiralkabel zum Gerät (Wendel um eine gebogene Linie)
        const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.04, 0), new THREE.Vector3(-0.05, -0.2, 0.05), new THREE.Vector3(-0.12, -0.15, 0.12)]);
        const hel = [];
        for (let i = 0; i <= 120; i++) { const t = i / 120, P0 = path.getPointAt(t), a = t * PI * 2 * 14; hel.push(new THREE.Vector3(P0.x + Math.cos(a) * 0.011, P0.y + Math.sin(a) * 0.011, P0.z)); }
        L.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hel), 240, 0.0035, 4, false), C.black);
      }
      L.build(p, 'hoerer');
      p.userData.pend = { ax: 0, az: 0, vx: 0, vz: 0 };
      cab.partNames.push('pendel:hoerer');
    }
    B.add(box(0.03, 0.03, 0.05), C.steel, [hp[0] - 0.01, hp[1] + 0.01, hp[2]]);
    {
      const p = part(grp, 'pendel:kopfhoerer', [rx + 0.08, 0.7, c[2] - 0.15]);
      const L = new MB();
      L.add(tor(0.075, 0.009, 5, 14, PI), C.black, [0, -0.08, 0], [0, HP, 0]);
      for (const sz of [-1, 1]) L.add(cyl(0.04, 0.04, 0.03, 12), C.black, [0, -0.09, sz * 0.075], [HP, 0, 0]);
      L.build(p, 'kopfhoerer');
      p.userData.pend = { ax: 0, az: 0, vx: 0, vz: 0 };
      cab.partNames.push('pendel:kopfhoerer');
    }
    B.add(rbox(0.06, 0.13, 0.13, 0.01), C.black, [-1.15, 0.3, c[2] - 0.2]);
    label(B, C, 'bsakasten', [-1.1185, 0.3, c[2] - 0.2], [0, HP, 0], 0.12);
    B.add(rbox(0.04, 0.3, 0.36, 0.015), C.canvas, [-1.17, 0.42, c[2] - 0.62]);
    label(B, C, 'typ', [-1.149, 0.66, c[2] - 0.62], [0, HP, 0], 0.2);
  }

  // ---------------------------------------------------------------- Ladeschütze, Koaxial-MG
  const l = A.load;
  if (l) { // alle Generationen (1. WK: an der Kampfraumwand rechts)
    // Sicherung (Simulation 'sw:sicherung'): Schalter unter Bügel an der rechten Wand, darüber die Feuerbereit-Leuchte
    const sp = [1.15, l[1] - 0.12, l[2] - 0.45];
    B.add(rbox(0.03, 0.2, 0.2, 0.008), C.black, [1.2, sp[1] + 0.02, sp[2]]);
    simSwitch(grp, B, C, det, era, 'sicherung', sp, l, 'p_sicherung');
    label(B, C, 'sicher', [1.184, sp[1] + 0.105, sp[2]], [0, -HP, 0], 0.12);
    if (det) label(B, C, 'n_nicht', [1.1835, sp[1] - 0.07, sp[2] + 0.04], [0, -HP, 0.06], 0.08);
    const lp = part(grp, 'lampe:sicher', [1.18, sp[1] + 0.06, sp[2] + 0.07]);
    const lm = new THREE.Mesh(cyl(0.012, 0.012, 0.012, 10).rotateZ(HP), C.lampRed); lm.name = 'lampe'; lp.add(lm);
    B.add(tor(0.0135, 0.003, 4, 12), C.steel, [1.18, sp[1] + 0.06, sp[2] + 0.07], [0, HP, 0]);
    cab.partNames.push('lampe:sicher');
    if (det) harness(B, C, [[1.2, sp[1] + 0.12, sp[2]], [1.2, 0.68, sp[2] - 0.05], [1.1, 0.71, sp[2] - 0.2]], det, 2);
  }
  if (D.coax && Math.abs(D.coax[0]) >= 0.15 && !wk1) {
    const cx = D.coax[0], cy = D.coax[1];
    const zf = (-1.15 * sc + A.sh[2]) - D.gunPivot[2] + 0.04, len = 0.62 * sc;
    const zc = zf + len / 2;
    GB.add(rbox(0.1 * sc, 0.13 * sc, len, 0.01), C.black, [cx, cy, zc]);
    GB.add(box(0.11 * sc, 0.03 * sc, len * 0.45), C.metal, [cx, cy + 0.075 * sc, zc + len * 0.12]);
    GB.add(cyl(0.022 * sc, 0.022 * sc, 0.2 * sc, 10), C.metal, [cx, cy, zf - 0.05], [HP, 0, 0]);
    GB.add(rbox(0.035 * sc, 0.035 * sc, 0.12 * sc, 0.008), C.metal, [cx + 0.07 * sc, cy, zc + len * 0.25]); // Spannschieber
    // Gurtkasten + Zuführung, Hülsenschacht nach unten
    const ab = [cx, cy - 0.2 * sc, zc + 0.12 * sc]; // unter dem Gehäuse – auf Augenhöhe des Richtschützen steht nichts
    GB.add(rbox(0.14 * sc, 0.2 * sc, 0.3 * sc, 0.01), C.olive, ab);
    GB.add(box(0.15 * sc, 0.02 * sc, 0.31 * sc), C.metal, [ab[0], ab[1] + 0.105 * sc, ab[2]]);
    GB.tube(C.metal, [[ab[0] - 0.05 * sc, ab[1] + 0.1 * sc, ab[2] - 0.08 * sc], [cx - 0.09 * sc, cy - 0.02 * sc, zc], [cx - 0.055 * sc, cy + 0.02 * sc, zc - 0.05 * sc]], 0.02 * sc, 6, 12);
    GB.add(box(0.06 * sc, 0.25 * sc, 0.08 * sc), C.metal, [cx + 0.08 * sc, cy - 0.18 * sc, zc - 0.12 * sc]);
  }
  // Rücklaufschutz: Warnschilder beidseitig (am Rohr, laufen mit zurück)
  const lk = modern ? 'ruecklauf' : 'wk_achtung';
  label(GB, C, lk, [breechGun[0] + 0.355 * bs, breechGun[1] - 0.04 * bs, breechGun[2] + 0.5 * bs], [0, HP, 0], 0.2 * bs);
  label(GB, C, lk, [breechGun[0] - 0.355 * bs, breechGun[1] - 0.04 * bs, breechGun[2] + 0.5 * bs], [0, -HP, 0], 0.2 * bs);
  if (modern) {
    // Hülsenfangsack unter dem Verschluss
    const hb = [breechGun[0], breechGun[1] - 0.48 * bs, breechGun[2] + 0.75 * bs];
    GB.add(rbox(0.42 * bs, 0.26 * bs, 0.32 * bs, 0.05 * bs, 2), C.canvas, hb);
    GB.add(box(0.44 * bs, 0.02 * bs, 0.34 * bs), C.steel, [hb[0], hb[1] + 0.13 * bs, hb[2]]);
    label(GB, C, 'huelse', [hb[0], hb[1], hb[2] + 0.161 * bs], null, 0.16 * bs);
  }

  // ---------------------------------------------------------------- Allgemein: Kabel, Leitungen, Lüfter, Polster, Schalter, Schilder
  if (det) {
    harness(B, C, [[1.02, 0.71, -0.85], [1.07, 0.71, 0.0], [1.06, 0.71, 1.05]], det);
    harness(B, C, [[-1.02, 0.71, -0.85], [-1.07, 0.71, 0.1], [-1.06, 0.71, 1.05]], det, 2);
    harness(B, C, [[-0.3, 0.72, -1.05], [0, 0.72, -1.08], [0.35, 0.72, -1.05]], det, 2);
  } else B.tube(C.black, [[1.0, 0.71, -0.85], [1.0, 0.71, 1.2]], 0.014, 4, 2);
  if (modern) {
    // Hydraulikleitungen rechts unten (Turmrichtantrieb) mit Schild
    for (const dy of [0, 0.045]) B.tube(C.steel, [[1.18, 0.16 + dy, -0.85], [1.19, 0.16 + dy, -0.3], [1.15, 0.12 + dy, 0.2], [0.9, 0.08 + dy, 0.5]], 0.011, 6, 6);
    label(B, C, 'hydraulik', [1.2, 0.3, -0.55], [0, -HP, 0], 0.17);
    // Schalterfeld über dem Richtschützen
    B.add(rbox(0.04, 0.09, 0.3, 0.008), C.black, [1.2, 0.6, -0.55]);
    label(B, C, 'schalter', [1.179, 0.6, -0.55], [0, -HP, 0], 0.28);
    for (let i = 0; i < 5; i++) B.add(cyl(0.003, 0.002, 0.03, 5), C.steel, [1.165, 0.6 + (i % 2 ? -0.01 : 0.01), -0.55 + 0.11 - i * 0.055], [0, 0, HP + (i % 2 ? 0.5 : -0.5)]);
  }
  if (!wk1) {
    // Lüfter in der Turmdecke (dreht), Gitter, Schild
    const fp = [-0.15, 0.7, 1.2];
    B.add(cyl(0.13, 0.13, 0.08, det ? 24 : 12, true), C.metal, fp);
    for (const rr of det ? [0.04, 0.08, 0.12] : [0.12]) B.add(tor(rr, 0.004, 4, det ? 20 : 10), C.steel, [fp[0], fp[1] - 0.042, fp[2]], [HP, 0, 0]);
    const fan = part(grp, 'luefter', [fp[0], fp[1] - 0.01, fp[2]]);
    const L = new MB();
    for (let i = 0; i < 5; i++) L.add(box(0.11, 0.004, 0.035), C.black, [Math.cos(i / 5 * PI * 2) * 0.06, 0, Math.sin(i / 5 * PI * 2) * 0.06], [0.4, -i / 5 * PI * 2, 0]);
    L.add(cyl(0.025, 0.025, 0.03, 10), C.black);
    L.build(fan, 'luefter');
    cab.partNames.push('luefter');
    label(B, C, 'luefter', [fp[0] + 0.22, 0.735, fp[2]], [HP, 0, 0], 0.14);
    // Stoßpolster an der Decke über den Köpfen
    for (const p of [g, l, c].filter(Boolean)) B.add(rbox(0.3, 0.04, 0.26, 0.018), C.pad, [p[0], 0.725, p[2] + 0.05]);
  } else {
    // 1. WK: Holzbank, Seilschlaufen, Kettenzug am Dach, Werkzeug am Haken
    B.add(rbox(1.2, 0.05, 0.3, 0.01), C.wood, [0.2, 0.25, 0.85]);
    for (const x of [-0.3, 0.7]) B.add(box(0.05, 0.2, 0.25), C.wood, [x, 0.13, 0.85]);
    for (const x of [-0.6, 0.0, 0.6]) B.add(tor(0.05, 0.008, 4, 10), C.canvas, [x, 0.68, -0.2], [0, 0, 0]);
    B.rod(C.metal, [0.9, 0.5, -0.3], [0.9, 0.2, -0.3], 0.012);
    B.add(box(0.05, 0.16, 0.02), C.metal, [0.9, 0.12, -0.3]);
  }
  // Leuchten (Gehäuse) – Lichtquellen für den Innenraum-Shader
  const lampSpots = wk1 ? [] : [[-0.55, 0.735, -0.3], [0.75, 0.735, 0.95]];
  const QD = new THREE.Quaternion().setFromEuler(new THREE.Euler(HP, 0, 0));
  for (const lp of lampSpots) DT.domeLamp(B, C, det, new DT.LF(B, [lp[0], lp[1] + 0.005, lp[2]], QD), C.dome);
  if (!wk1) DT.domeLamp(B, C, det, new DT.LF(B, [0.15, 0.74, 0.1], QD), C.dome); // Gehäuse um die Grundleuchte
  const LC = modern ? [0xc8d4ff, 0xff3320, 0xff3320] : era === 'wk2' ? [0xffc27a, 0xffb060, 0xffb060] : [0xff9a40, 0xff9a40, 0xff9a40];
  const LI = modern ? [0.38, 0.55, 0.5] : era === 'wk2' ? [0.7, 0.5, 0.45] : [0.9, 0.0, 0.0];
  const L0 = wk1 ? [0.2, 0.5, 0.95] : [0.15, 0.68, 0.1];
  cab.lamps.push({ obj: 'tur', pos: V3(L0), col: new THREE.Color(LC[0]).multiplyScalar(LI[0]), where: 'turm', flicker: wk1 });
  if (!wk1) for (let i = 0; i < 2; i++) cab.lamps.push({ obj: 'tur', pos: V3([lampSpots[i][0], 0.68, lampSpots[i][2]]), col: new THREE.Color(LC[i + 1]).multiplyScalar(LI[i + 1]), where: 'turm' });
  if (A.basket) cab.lamps.push({ obj: 'tur', pos: V3([A.rc[0], A.yb + 0.55, A.rc[2]]), col: new THREE.Color(modern ? 0xffe0c0 : 0xffc27a).multiplyScalar(0.3), where: 'turm' });
  if (wk1) cab.lamps.push({ obj: 'tur', pos: V3([-0.6, 0.55, -0.6]), col: new THREE.Color(0xffa860).multiplyScalar(0.25), where: 'turm' });
  // Schild „Geprüft“ am Feuerlöscher des Grund-Innenraums, Typenschild
  const rackRight = A.I.rack && A.I.rack[0] > 0.5;
  const fx = rackRight ? -1.1 : 1.1, fz = rackRight ? 0.3 : 0.95;
  label(B, C, 'loescher', [fx + (fx > 0 ? 0.1 : -0.1), 0.62, fz], [0, fx > 0 ? -HP : HP, 0], 0.15);
  label(B, C, 'geprueft', [fx + (fx > 0 ? 0.1 : -0.1), 0.56, fz], [0, fx > 0 ? -HP : HP, 0], 0.09);
  if (A.basket) {
    const [rx2, , rz2] = A.rc;
    label(B, C, 'nicht', [rx2, A.yb + 0.2, rz2 - 0.165], [0, PI, 0], 0.12);
  }
  turretDetail(D, C, det, era, cab, A, B, grp, GB);
  // Splitterschutzmatten an den freien Turmwänden (moderne Panzer)
  if (modern && det) wallLiners(B, C, det);
  // Hülsen-Abdrücke und Ölflecken auf dem Korbboden bzw. der Bodenplatte, Schweißspritzer an den Turmnähten
  if (det) {
    const fy = A.basket ? A.yb + 0.0015 : 0.0815, [cx, , cz] = A.basket ? A.rc : [0.15, 0, 0.3];
    for (let i = 0; i < (det > 1 ? 7 : 3); i++) { const a = i * 2.3 + 0.4, r = 0.12 + (i % 3) * 0.13; stencil(B, C, i % 3 === 2 ? 'd_fleck' : 'd_ring', [cx + Math.cos(a) * r, fy + i * 0.0002, cz + Math.sin(a) * r], [-HP, 0, a], i % 3 === 2 ? 0.16 : 0.11); }
    if (!wk1) for (const [x, z] of [[0.9, 1.15], [-0.9, 1.15], [1.24, -0.8]]) BASE.spatter(B, C, [x * 0.985, 0.12, -z * 0.985], [x * 0.985, 0.7, -z * 0.985], 9, Math.round(x * 10 + 20), 0.02);
  }
  B.build(grp, 'turmraum');
  GB.build(gunG, 'rohrraum');
  return { tur: grp, gun: gunG };
}

/* ===================================================================== Vorlage, Anbau, Takt */

const TPL = new Map();
const ERA_WEAR = { modern: [0.18, 0.45, 0], kk: [0.45, 0.6, 0.08], wk2: [0.7, 0.72, 0.12], wk1: [1.0, 0.85, 0.2] }; // Rost, Staub, mehr Abplatzer
// Kalter Krieg (kk): analoge Instrumente und heller Innenanstrich wie im 2. WK (keine Bildschirme)
function eraOf(D) { return D.era === 'wk2' || D.era === 'kk' ? 'wk2' : D.era === 'wk1' ? 'wk1' : 'modern'; }
/** Hülse je Panzer: modern nur der Hülsenboden (verbrennbare Hülse), sonst Messinghülse (Länge, Radius in m). */
const CASE = { mbt: null, wk2: [0.36, 0.042], wk2h: [0.57, 0.052], wk1: [0.3, 0.034], wk1l: [0.2, 0.024], spz: [0.17, 0.018], kk: [0.6, 0.062], wk2m: [0.5, 0.05], wk2j: [0.45, 0.045] };

/** Kampfraum der Wanne (models.js hullCompartment, gleiche Maße): Riffelblech, Schweißnähte, Schrauben am Motorschott,
 * Leitungen mit Schellen, Schablonenschrift. Gruppe 'cabin:kampfraum' im Wannenraum. */
function buildHullExtras(D, C, det, era, A) {
  if (!A.basket) return null;
  const grp = new THREE.Group();
  grp.name = 'cabin:kampfraum';
  const B = new MB(), hb = D.hullBox, tp = D.turretPivot, ring = A.ringR * A.sc;
  const yF = hb[1] - hb[4] + 0.1, yR = tp[1] - 0.02;
  const wx = Math.max(ring + 0.12, Math.min(hb[3] - 0.5, ring + 0.3));
  const DC = driverCabin(D);
  const zF = Math.max(hb[2] - hb[5] + 0.35, tp[2] - ring - 0.75, DC ? DC.zB + 0.05 : -Infinity), zB = Math.min(hb[2] + hb[5] - 0.3, tp[2] + ring + 0.55);
  // Grund-Kampfraum modelliert (Schale, Riffelboden, Durchstieg, Munitionsstand, Motorschott, Kästen)
  BASE.hullBase(B, C, det, era, D, A, kit(B, C, det));
  if (!det) { B.build(grp, 'kampfraum'); return grp; }
  BASE.spatter(B, C, [-wx + 0.01, yF + 0.022, zF + 0.1], [-wx + 0.01, yF + 0.022, zB - 0.1], 14, 11, 0.02);
  for (const sx of [-1, 1]) {
    DT.weld(B, C.metal, [[sx * (wx - 0.005), yF + 0.006, zF + 0.01], [sx * (wx - 0.005), yF + 0.006, zB - 0.01]]);
    DT.weld(B, C.metal, [[sx * (wx - 0.005), yR - 0.006, zF + 0.01], [sx * (wx - 0.005), yR - 0.006, zB - 0.01]]);
    for (const dy of [0, 0.04]) B.tube(C.steel, [[sx * (wx - 0.03), yF + 0.42 + dy, zF + 0.1], [sx * (wx - 0.03), yF + 0.42 + dy, zB - 0.1]], 0.009, 6, 6);
    for (let z = zF + 0.25; z < zB - 0.1; z += 0.3) B.add(box(0.025, 0.09, 0.025), C.metal, [sx * (wx - 0.025), yF + 0.44, z]);
    const F = new DT.LF(B, [sx * wx * 0.45, yF + (yR - yF) * 0.66, zB - 0.036], new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PI, 0)));
    DT.boltRow(F, C.steel, [-wx * 0.36, 0.12, 0], [wx * 0.36, 0.12, 0], 6, 0.009, det);
    DT.boltRow(F, C.steel, [-wx * 0.36, -(yR - yF) * 0.5, 0], [wx * 0.36, -(yR - yF) * 0.5, 0], 6, 0.009, det);
  }
  stencil(B, C, 's_pfeil', [0, yF + (yR - yF) * 0.45, zB - 0.037], [0, PI, 0], 0.22);
  label(B, C, 'w_hoch', [wx * 0.45, yF + (yR - yF) * 0.5, zB - 0.037], [0, PI, 0], 0.16);
  label(B, C, 'w_oel', [-wx * 0.45, yF + (yR - yF) * 0.5, zB - 0.037], [0, PI, 0], 0.16);
  B.build(grp, 'kampfraum');
  return grp;
}

function buildTemplate(D, C0, det) {
  const era = eraOf(D);
  CHAMF = det >= 1 ? 1 : 0; DT.setChamfer(det >= 1);
  // Kalter Krieg: Ausstattung wie 2. WK, aber hellgrüner Anstrich
  const C = D.era === 'kk' ? Object.assign(Object.create(C0), { wall: { ...C0.wall, wk2: C0.wall.kk } }) : C0;
  const info = { lamps: [], screens: {}, partNames: [], driverEye: null, prisms: [] };
  const A = anchorsOf(D);
  cab_sw = [];
  TESS = det >= 2 ? 0.1 : det === 1 ? 0.16 : 0;
  const t = buildTurret(D, C, det, era, info, A);
  const hull = new THREE.Group();
  hull.name = 'cabin:wanne';
  buildDriver(hull, D, C, det, era, info);
  buildFunker(hull, D, C, det, era, info);
  const hx = buildHullExtras(D, C, det, era, A);
  if (hx) hull.add(hx);
  // Schützenpanzer (SZ-8 u. a.): Mannschaftsraum hinter dem Kampfraum (Nutzer 21.11.: „karg“)
  let hasTroop = false;
  if (D.troop && !D.noCabin) {
    const tg = new THREE.Group(); tg.name = 'cabin:truppe'; hull.add(tg);
    const TB = new MB();
    buildTroopRoom(TB, C, det, D, troopKit(TB, C, det), info, { era });
    TB.build(tg, 'mannschaftsraum');
    hasTroop = true;
  }
  // Verschluss (Bodenstück, Keil) und Gestell im Detail – werden beim Anbau an die Gruppen des Grund-Innenraums gehängt
  const br = new THREE.Group(); br.name = 'cabin:verschluss';
  DT.breechParts(MB, C, det, era, { guard: !D.turretLimits }).B.build(br, 'verschluss');
  const keil = new THREE.Group(); keil.name = 'cabin:keil';
  DT.keilParts(MB, C, det).build(keil, 'keil');
  const I = Object.assign({ breech: [0, 0.42, -0.55], rack: [0, 0.45, 1.55] }, D.interior || {});
  const grid = I.rackGrid || null, rows = grid ? grid[1] : 4, cols = grid ? grid[0] : 10, rz0 = -0.36;
  const slots = [];
  for (let cc = 0; cc < cols; cc++) for (let r = 0; r < rows; r++) slots.push([(cc - (cols - 1) / 2) * 0.155, (r - (rows - 1) / 2) * 0.135, rz0]);
  const RP = DT.rackParts(MB, C, det, era, { slots, rw: grid ? grid[0] * 0.155 + 0.07 : 1.62, rh: grid ? grid[1] * 0.135 + 0.06 : 0.6, rz0, blast: !!I.blastDoor, wet: !!I.wet });
  BASE.rackBox(RP.frame, C, det, { rw: grid ? grid[0] * 0.155 + 0.07 : 1.62, rh: grid ? grid[1] * 0.135 + 0.06 : 0.6, rz0, blast: !!I.blastDoor });
  const rack = new THREE.Group(); rack.name = 'cabin:gestell';
  RP.frame.build(rack, 'gestell');
  let door = null;
  if (RP.door) { door = new THREE.Group(); door.name = 'cabin:tuer'; RP.door.build(door, 'tuer'); }
  TESS = 0;
  info.sw = cab_sw.slice();
  for (const gg of [t.tur, t.gun, hull, br, keil, rack, door]) if (gg) gg.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { tur: t.tur, gun: t.gun, hull, br, keil, rack, door, info, A, era, hasTroop };
}

/** Helfer für cabin-troop.js (Mannschaftsraum) an einem Bucket. */
function troopKit(B, C, det) {
  return {
    Frame, box, rbox, cyl, tor,
    label: (pos, rot, key, w) => label(B, C, key, pos, rot, w),
    stencil: (pos, rot, key, w) => stencil(B, C, key, pos, rot, w),
    flabel: (F, key, lpos, w, lrot = null) => flabel(F, C, key, lpos, w, lrot),
    harness: (pts, d, colors = 3) => harness(B, C, pts, d, colors),
    extinguisher: (pos, nx) => extinguisher(B, C, pos, nx, det),
  };
}

/** Fahrerraum eines Transporters (auch Radfahrzeug, ohne Kettenprüfung) – Maße wie data.js driverCabin. */
function troopDriverRoom(D) {
  const R = driverCabin(D);
  if (R) return R;
  const s = D.seats && D.seats.find((x) => x.drive);
  if (!s || !D.troop) return null;
  const hb = D.hullBox, F = s.pos;
  const slit = (s.views || []).find((v) => v.overlay === 'slit') || null;
  const hatch = D.hatches && D.hatches.driver && D.hatches.driver.space === 'hull' ? D.hatches.driver : null;
  const floor = Math.max(hb[1] - hb[4] + 0.1, F[1] - 0.02);
  let roof = hatch ? hatch.pos[1] - 0.04 : hb[1] + hb[4] - 0.06;
  if (!hatch && slit) roof = Math.max(roof, slit.pos[1] + 0.12);
  roof = Math.max(roof, floor + 1.0);
  // Radfahrzeug: zwischen den Radkästen bleiben (Reifen ragten sonst in den Fahrerraum)
  const half = Math.max(0.6, Math.min(hb[3] - 0.32, D.wheels && D.wheels.x ? D.wheels.x - 0.3 : 9));
  const xl = Math.max(-half, F[0] - 0.6), xr = Math.min(half, F[0] + 0.6);
  const zFT = Math.min((slit ? slit.pos[2] : F[2] - 0.35) - 0.14, F[2] - 0.28);
  const zFB = Math.min(zFT - 0.25, Math.max(hb[2] - hb[5] + 0.14, F[2] - 1.0));
  const eye = [F[0], Math.min(Math.max(F[1] + 0.86, floor + 0.62), roof - 0.17), F[2] + 0.12];
  return { F, xl, xr, floor, roof, zFT, zFB, zB: F[2] + 0.68, eye, hatch };
}

/** Durchgang Fahrerkabine ↔ Mannschaftsraum (Rückwand des Fahrers, Stirnwand des Mannschaftsraums). */
function troopDoor(R, D) {
  const x0 = R.F[0], toC = x0 < 0 ? 1 : -1, ox = clamp(x0 + toC * 0.28, R.xl + 0.3, R.xr - 0.3);
  const T = D.troop, cx = clamp(ox, -T.halfW + 0.35, T.halfW - 0.35);
  const y0 = Math.max(R.floor, T.floor) + 0.1, y1 = Math.min(R.roof, T.roof) - 0.14;
  return [cx - 0.23, cx + 0.23, y0, Math.min(y1, y0 + 0.9)];
}

/** Vorlage Transporter (MTW, RS-8): Fahrerkabine (abgetrennt, Durchgang) + Mannschaftsraum (cabin-troop.js). */
function buildTroopTemplate(D, C0, det) {
  const era = eraOf(D);
  CHAMF = det >= 1 ? 1 : 0; DT.setChamfer(det >= 1);
  const C = D.era === 'kk' ? Object.assign(Object.create(C0), { wall: { ...C0.wall, wk2: C0.wall.kk } }) : C0;
  const info = { lamps: [], screens: {}, partNames: [], driverEye: null, prisms: [] };
  cab_sw = [];
  TESS = det >= 2 ? 0.1 : det === 1 ? 0.16 : 0;
  const hull = new THREE.Group();
  hull.name = 'cabin:wanne';
  const R = troopDriverRoom(D);
  const door = R && det ? troopDoor(R, D) : null;
  if (R) buildDriver(hull, D, C, det, era, info, { R, wheel: D.drive !== 'tracked', door: door ? { rect: door, zK: D.troop.z0 } : null });
  const tg = new THREE.Group(); tg.name = 'cabin:truppe'; hull.add(tg);
  const B = new MB();
  buildTroopRoom(B, C, det, D, troopKit(B, C, det), info, { era, frontDoor: door });
  B.build(tg, 'mannschaftsraum');
  TESS = 0;
  info.sw = cab_sw.slice();
  hull.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { hull, info, era };
}

/** Leuchten je Raum auf die Shader-Plätze verteilen, bewegliche Teile einsammeln (attachCabin/attachTroopCabin). */
function cabSlots(cab) {
  cab.slots = {};
  for (const where of ['turm', 'fahrer']) {
    const L = cab.lamps.filter((x) => x.where === where);
    const main = L.filter((x) => !x.glow), glow = L.filter((x) => x.glow);
    const sl = new Array(NL).fill(null);
    main.slice(0, 4).forEach((x, i) => { sl[i] = x; });
    [...glow, ...main.slice(4)].slice(0, NL - 4).forEach((x, i) => { sl[4 + i] = x; });
    cab.slots[where] = sl;
  }
}
function cabParts(cab, groups) {
  const C = cab.C;
  for (const gg of groups) gg.traverse((o) => {
    if (!o.name || o.isMesh) return;
    if (o.name.startsWith('zeiger:')) cab.needles.push(o);
    else if (o.name.startsWith('pendel:')) cab.pend.push(o);
    else if (o.name.startsWith('pedal:')) cab.pedals.push(o);
    else if (o.name.startsWith('btn:')) cab.btn[o.name.slice(4)] = o.children[0];
    else if (o.name.startsWith('sw:')) {
      const lever = o.getObjectByName('hebel'), lamp = o.getObjectByName('lampe');
      cab.parts[o.name] = o;
      cab.sw[o.name.slice(3)] = {
        group: o, cabin: true,
        set(on, warn = false) {
          if (lever) lever.rotation.x = on ? -0.45 : 0.45;
          if (lamp) { const m = warn ? C.lampAmber : on ? C.lampGreen : C.lampRed; if (lamp.material !== m) lamp.material = m; }
        },
      };
    } else if (o.name.startsWith('hebel:') || o.name.startsWith('rad:') || ['gang', 'griff', 'luefter', 'lampe:sicher', 'bugmg'].includes(o.name)) cab.parts[o.name] = o;
  });
  for (const p of cab.pend) p.userData.pend = { ax: 0, az: 0, vx: 0, vz: 0 };
}

/**
 * Transporter ohne Panzer-Innenraum (MTW-13, RS-8; Nutzer 21.11.: „Mannschaftsraum sehr grob“): Fahrerkabine und
 * Mannschaftsraum über das cabin-System (Innenlicht, Gebrauchsspuren, gebackene Verdeckung) statt der Kästen aus
 * models-heavy.js troopInner. Takt über syncCabin (Lampen, Hebel, Zeiger). → cab | null
 */
export function attachTroopCabin(model, D, S, quality = 'high') {
  if (!model || !D || !D.troop) return null;
  const det = quality === 'low' ? 0 : quality === 'medium' ? 1 : 2;
  const C = cabinMats(S, det);
  resyncMats();
  const key = `${D.id}:t:${det}`;
  let tpl = TPL.get(key);
  if (!tpl) { tpl = buildTroopTemplate(D, C, det); TPL.set(key, tpl); }
  const hull = tpl.hull.clone(true);
  if (model.hullInterior) model.hullInterior.traverse((o) => { if (o.isMesh) o.visible = false; });
  model.root.add(hull);
  const cab = {
    D, C, det, era: tpl.era, A: null, tur: new THREE.Group(), gun: new THREE.Group(), hull, model, info: tpl.info,
    needles: [], pend: [], pedals: [], parts: {}, btn: {}, sw: {}, lamps: tpl.info.lamps.map((l) => ({ ...l, w: new THREE.Vector3() })),
    t: 0, recoilPrev: 0, hitPrev: null, flick: 0, ejectAt: -1, casings: [], smoke: [], vel: null, acc: new THREE.Vector3(), yawPrev: null, pitchPrev: null,
    screenT: 0, extra: [], bake: null, troop: true,
  };
  cabSlots(cab);
  cabParts(cab, [hull]);
  if (det >= 1) {
    try {
      const H = [];
      model.root.updateMatrixWorld(true);
      hull.traverse((o) => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
        H.push({ mesh: o, M: relMatrix(o, model.root), occ: true, set: 1, shadow: true, skip: !!o.geometry.userData.cabBaked });
        o.geometry.userData.cabBaked = true;
      });
      const hl = cab.slots.fahrer.slice(0, 4).map((L) => (L ? L.pos.clone() : new THREE.Vector3(0, -99, 0)));
      cab.bake = createBake([{ set: 1, items: H, lamps: hl, shadows: true }], { cell: det >= 2 ? 0.035 : 0.05, aoDirs: det >= 2 ? 14 : 8, aoReach: 0.42 });
    } catch (err) { console.warn('[cabin] Licht backen (Transporter) nicht möglich:', err); cab.bake = null; }
  }
  setCabinVisible(cab, false);
  return cab;
}

/** Hülsen-/Dampf-Pool je Anbau (eigene Netze; Geometrie geteilt je Typ). */
const CASE_GEO = new Map();
function caseGeom(D) {
  const cyl = (r1, r2, h, n = 12, open = false) => new THREE.CylinderGeometry(r1, r2, h, n, 1, open);
  if (CASE_GEO.has(D.id)) return CASE_GEO.get(D.id);
  const spec = CASE[D.id] || null, sc = (D.interior && D.interior.scale) || 1;
  let g;
  if (!spec) { // Hülsenboden 120 mm
    const parts = [cyl(0.068, 0.068, 0.012, 20), cyl(0.06, 0.062, 0.07, 20, true)];
    parts[0].translate(0, -0.035, 0);
    g = mergeGeometries(parts.map((x) => x.toNonIndexed()), false);
  } else {
    const [len, r] = spec;
    const parts = [cyl(r * 1.12, r * 1.12, 0.01, 16), cyl(r, r * 1.04, len * 0.7, 16, true), cyl(r * 0.78, r, len * 0.1, 16, true), cyl(r * 0.76, r * 0.78, len * 0.2, 16, true)];
    parts[0].translate(0, -len / 2, 0); parts[1].translate(0, -len / 2 + len * 0.35, 0); parts[2].translate(0, len * 0.25, 0); parts[3].translate(0, len * 0.4, 0);
    g = mergeGeometries(parts.map((x) => x.toNonIndexed()), false);
    g.scale(sc, sc, sc);
  }
  g.setAttribute('cabE', new THREE.BufferAttribute(SH.edgeNone(g.attributes.position.count), 4));
  for (const [k, n] of [['cabA', 3], ['cabS0', 2], ['cabS1', 2]]) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * n), n));
  CASE_GEO.set(D.id, g);
  return g;
}

/**
 * Detail-Innenraum an ein Fahrzeugmodell (models.js createVehicleModel) hängen – erst beim ersten Öffnen einer
 * Innensicht. → cab | null
 */
export function attachCabin(model, D, S, quality = 'high') {
  if (!model || !model.interior || !D || D.drive !== 'tracked') return null;
  const det = quality === 'low' ? 0 : quality === 'medium' ? 1 : 2;
  const C = cabinMats(S, det);
  resyncMats();
  const key = `${D.id}:${det}`;
  let tpl = TPL.get(key);
  if (!tpl) { tpl = buildTemplate(D, C, det); TPL.set(key, tpl); }
  const tur = tpl.tur.clone(true), gun = tpl.gun.clone(true), hull = tpl.hull.clone(true);
  // Grund-Innenraum (models.js) ausblenden – cabin-base.js baut ihn modelliert nach. Bleiben: Granaten im Gestell,
  // Granate/Arme in der Hand, Gestell-/Türgruppen (eigene Detailnetze); ihnen fehlt nur die Kantenmaske.
  for (const o of model.interior.children) if (o.isMesh) o.visible = false;
  const rg0 = model.interior.getObjectByName('rackGrp');
  if (rg0) for (const o of rg0.children) if (o.isMesh && !o.userData.rack) o.visible = false;
  if (model.hullInterior && tpl.A.basket) for (const o of model.hullInterior.children) if (o.isMesh) o.visible = false;
  // Schützenpanzer: Mannschaftsraum im Detail (cabin-troop.js) statt der Kästen aus models-tanks.js buildTroop
  const tro = model.hullInterior && tpl.hasTroop ? model.hullInterior.getObjectByName('troopInterior') : null;
  if (tro) tro.traverse((o) => { if (o.isMesh) o.visible = false; });
  for (const gg of [model.interior, model.breech]) if (gg) gg.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.attributes.cabE) return;
    const g = o.geometry, n = g.attributes.position.count;
    g.setAttribute('cabE', new THREE.BufferAttribute(!g.index && g.attributes.normal ? SH.edgeMask(g) : SH.edgeNone(n), 4));
  });
  model.interior.add(tur);
  if (model.gun) model.gun.add(gun);
  model.root.add(hull);
  const cab = {
    D, C, det, era: tpl.era, A: tpl.A, tur, gun, hull, model, info: tpl.info,
    needles: [], pend: [], pedals: [], parts: {}, btn: {}, sw: {}, lamps: tpl.info.lamps.map((l) => ({ ...l, w: new THREE.Vector3() })),
    t: 0, recoilPrev: 0, hitPrev: null, flick: 0, ejectAt: -1, casings: [], smoke: [], vel: null, acc: new THREE.Vector3(), yawPrev: null, pitchPrev: null,
    screenT: 0, extra: [], bake: null,
  };
  // Leuchten auf die Shader-Plätze verteilen: je Raum zuerst bis zu vier Kuppellampen (gebackene Schatten), dann Leuchtmelder
  cab.slots = {};
  for (const where of ['turm', 'fahrer']) {
    const L = cab.lamps.filter((x) => x.where === where);
    const main = L.filter((x) => !x.glow), glow = L.filter((x) => x.glow);
    const sl = new Array(NL).fill(null);
    main.slice(0, 4).forEach((x, i) => { sl[i] = x; });
    [...glow, ...main.slice(4)].slice(0, NL - 4).forEach((x, i) => { sl[4 + i] = x; });
    cab.slots[where] = sl;
  }
  for (const gg of [tur, gun, hull]) gg.traverse((o) => {
    if (!o.name || o.isMesh) return;
    if (o.name.startsWith('zeiger:')) cab.needles.push(o);
    else if (o.name.startsWith('pendel:')) cab.pend.push(o);
    else if (o.name.startsWith('pedal:')) cab.pedals.push(o);
    else if (o.name.startsWith('btn:')) cab.btn[o.name.slice(4)] = o.children[0];
    else if (o.name.startsWith('sw:')) {
      // Bedienteil der Simulation: Hebel kippt, Leuchtmelder zeigt den Zustand (psim/sim.js set(on, warn))
      const lever = o.getObjectByName('hebel'), lamp = o.getObjectByName('lampe');
      cab.parts[o.name] = o;
      cab.sw[o.name.slice(3)] = {
        group: o, cabin: true,
        set(on, warn = false) {
          if (lever) lever.rotation.x = on ? -0.45 : 0.45;
          if (lamp) { const m = warn ? C.lampAmber : on ? C.lampGreen : C.lampRed; if (lamp.material !== m) lamp.material = m; }
        },
      };
    } else if (o.name.startsWith('hebel:') || o.name.startsWith('rad:') || ['gang', 'griff', 'luefter', 'lampe:sicher', 'bugmg'].includes(o.name)) cab.parts[o.name] = o;
  });
  for (const p of cab.pend) p.userData.pend = { ax: 0, az: 0, vx: 0, vz: 0 };
  // Verschluss im Detail: Grundnetze aus models.js ausblenden, Detail-Baugruppen anhängen (Keil fährt mit)
  const hideBase = (grp2) => { for (const o of grp2.children) if (o.isMesh) o.visible = false; };
  if (model.breech && tpl.br) {
    const br = tpl.br.clone(true);
    hideBase(model.breech);
    model.breech.add(br); cab.extra.push(br);
    const kg = model.breech.getObjectByName('breech:keil');
    if (kg && tpl.keil) { hideBase(kg); const k = tpl.keil.clone(true); kg.add(k); cab.extra.push(k); }
  }
  // Munitionsgestell: Köcher/Halter und Rahmen; Bunkertür im Detail (Schilder fahren mit)
  const rg = model.interior.getObjectByName('rackGrp');
  if (rg && tpl.rack) { const r = tpl.rack.clone(true); rg.add(r); cab.extra.push(r); }
  const door = model.interior.getObjectByName('rackDoor');
  if (door) {
    if (tpl.door) { hideBase(door); const d2 = tpl.door.clone(true); door.add(d2); cab.extra.push(d2); }
    const B = new MB();
    label(B, C, 'tuer', [0.25, 0.08, -0.0165], [0, PI, 0], 0.22);
    label(B, C, 'munition', [-0.25, 0.08, -0.0165], [0, PI, 0], 0.22);
    label(B, C, 'w_sprung', [0, -0.08, -0.0165], [0, PI, 0], 0.22);
    label(B, C, 'streifen', [0, 0.232, -0.0165], [0, PI, 0], 0.5);
    B.build(door, 'tuerschild');
  } else if (rg) { const B = new MB(); label(B, C, cab.era === 'modern' ? 'munition' : 'wk_munition', [0, 0.36, -0.4], [0, PI, 0], 0.22); B.build(rg, 'gestellschild'); }
  // Licht backen (ab medium): Grundnetze erst unterteilen (sie wurden noch nie gezeichnet), dann schrittweise rechnen
  if (det >= 1) {
    try { cab.bake = prepareBake(cab, model, tpl); } catch (err) { console.warn('[cabin] Licht backen nicht möglich:', err); cab.bake = null; }
  }
  // Hülsen (6) und Pulverdampf (3)
  const cg = caseGeom(D), cm = CASE[D.id] ? C.casing : C.stub;
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(cg, cm); m.visible = false; m.name = 'huelse'; tur.add(m); cab.casings.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), rest: true, t: 0 }); }
  for (let i = 0; i < 3; i++) { const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: C.smoke.map, color: 0xa29a8e, transparent: true, opacity: 0, depthWrite: false })); sm.visible = false; sm.name = 'dampf'; tur.add(sm); cab.smoke.push({ s: sm, t: 9 }); }
  setCabinVisible(cab, false);
  return cab;
}

/**
 * Backauftrag für Verdeckung und Lampenschatten (cabin-bake.js): zwei Räume – Turm (Bezug model.interior: Grund-Innenraum,
 * Detail, Verschluss und Rohrteile bei Rohrerhöhung 0) und Wanne (Bezug model.root: Fahrerraum mit eigenen Leuchten,
 * Kampfraum der Wanne ohne Lampenschatten). Grundnetze werden vorher unterteilt (nur einmal je Geometrie).
 */
function prepareBake(cab, model, tpl) {
  const tess = cab.det >= 2 ? 0.1 : 0.16;
  const M = model;
  // Rohr für die Lage auf 0 stellen (Rohrteile im Turmraum), danach zurück
  const gunRx = M.gun ? M.gun.rotation.x : 0, gunPz = M.gun ? M.gun.position.z : 0;
  if (M.gun) { M.gun.rotation.x = 0; M.gun.position.z = cab.D.gunPivot[2]; }
  M.root.updateMatrixWorld(true);
  const skipName = new Set(['held', 'pushArm', 'arms']);
  const collect = (root, ref, list, o2 = {}) => {
    const walk = (o, flags) => {
      if (skipName.has(o.name) || o.name === 'huelse' || o.isSprite) return;
      const f = { ...flags };
      if (o.name === 'rackDoor' || o.name === 'cabin:tuer') f.occ = false;
      if (o.name === 'cabin:fahrer' || o.name === 'cabin:funker' || o.name === 'cabin:truppe') { f.set = 1; f.shadow = true; }
      if (o.name === 'cabin:kampfraum') { f.set = 0; f.shadow = false; }
      if (o.isMesh && o.visible && o.geometry && o.geometry.attributes.position) {
        const g = o.geometry;
        // Grundnetze (models.js) unterteilen – Gestell-Granaten nicht (drawRange je Granate)
        if (!g.userData.cabTess && !o.userData.rack && !(o.material && o.material.userData && o.material.userData.noTess) && !g.attributes.cabA) {
          const t = tessellate(g, tess);
          if (t) { for (const k of Object.keys(g.attributes)) g.deleteAttribute(k); for (const k of Object.keys(t.attributes)) g.setAttribute(k, t.attributes[k]); g.setIndex(null); g.computeBoundingSphere(); g.computeBoundingBox(); }
          g.userData.cabTess = true;
        }
        list.push({ mesh: o, M: relMatrix(o, ref), occ: f.occ !== false, set: f.set, shadow: f.shadow, skip: !!g.userData.cabBaked });
        g.userData.cabBaked = true;
      }
      for (const ch of o.children) walk(ch, f);
    };
    walk(root, o2);
  };
  const T = [], H = [];
  collect(M.interior, M.interior, T);
  if (M.breech) collect(M.breech, M.interior, T);
  if (cab.gun) collect(cab.gun, M.interior, T);
  collect(cab.hull, M.root, H, { set: 0, shadow: false });
  if (M.hullInterior) collect(M.hullInterior, M.root, H, { set: 0, shadow: false });
  if (M.gun) { M.gun.rotation.x = gunRx; M.gun.position.z = gunPz; M.root.updateMatrixWorld(true); }
  const lampsOf = (where) => cab.slots[where].slice(0, 4).filter(Boolean).map((L) => L.pos.clone());
  const tl = cab.slots.turm.slice(0, 4).map((L) => (L ? L.pos.clone() : new THREE.Vector3(0, -99, 0)));
  const hl = cab.slots.fahrer.slice(0, 4).map((L) => (L ? L.pos.clone() : new THREE.Vector3(0, -99, 0)));
  void lampsOf;
  return createBake([
    { set: 0, items: T, lamps: tl, shadows: true },
    { set: 1, items: H, lamps: hl, shadows: true },
  ], { cell: cab.det >= 2 ? 0.035 : 0.05, aoDirs: cab.det >= 2 ? 14 : 8, aoReach: 0.42 });
}

/** Sichtbarkeit (mit dem Innenraum) + Materialien des Grund-Innenraums auf die Innenlicht-Klone legen. */
export function setCabinVisible(cab, on) {
  if (!cab) return;
  cab.tur.visible = cab.gun.visible = cab.hull.visible = !!on;
  if (!on) { CAB_U.uCabSun.value = 0.12; return; }
  resyncMats();
  const R = CM && CM.remap, M = cab.model;
  if (!R) return;
  const swap = (o) => { if (o.isMesh && R.has(o.material)) o.material = R.get(o.material); };
  for (const gg of [M.interior, M.hullInterior, M.breech]) if (gg) gg.traverse(swap);
}

const _w = new THREE.Vector3(), _l = new THREE.Vector3(), _iq = new THREE.Quaternion();
const lerp = (a, b, t) => a + (b - a) * t;

/** Takt (nur sichtbar, nur lokaler Insasse): Hebel/Pedale/Zeiger, Handräder, Bildschirme, Lampen, Hülsen, Pendel. */
export function syncCabin(cab, v, dt, ctx = {}) {
  if (!cab || !v) return;
  cab.t += dt;
  const D = cab.D, b = v.body, m = v.mount, c = b.controls || {}, drv = b.drive || {}, E = D.engine || {};
  // --- Fahrer: Lenkhebel (Lenken zieht den kurveninneren Hebel, Bremse beide), Pedale, Gang, Instrumente
  const steer = clamp(+c.steer || 0, -1, 1), brake = clamp(+c.brake || 0, 0, 1) + (c.handbrake && Math.abs(b.speed || 0) < 0.5 ? 0.3 : 0), thr = clamp(+c.throttle || 0, -1, 1);
  const P = cab.parts;
  const ease = (o, k, want) => { o.rotation.x = lerp(o.rotation.x, want, Math.min(1, dt * k)); };
  if (P['hebel:l'] && P['hebel:l'].userData.wheel) P['hebel:l'].rotation.y = lerp(P['hebel:l'].rotation.y, steer * 2.2, Math.min(1, dt * 8));
  else if (P['hebel:l'] && P['hebel:l'].userData.yoke) P['hebel:l'].rotation.z = lerp(P['hebel:l'].rotation.z, steer * 0.6, Math.min(1, dt * 8));
  else if (P['hebel:l']) ease(P['hebel:l'], 10, 0.38 * clamp(Math.max(0, steer) + brake * 0.8, 0, 1));
  if (P['hebel:r']) ease(P['hebel:r'], 10, 0.38 * clamp(Math.max(0, -steer) + brake * 0.8, 0, 1));
  for (const p of cab.pedals) {
    const want = p.name === 'pedal:gas' ? Math.abs(thr) : p.name === 'pedal:bremse' ? clamp(brake, 0, 1) : drv.shifting ? 1 : 0;
    ease(p, 12, -0.32 * want);
  }
  if (P.gang) {
    const g = drv.gear | 0, maxG = 5;
    ease(P.gang, 8, clamp(-g / maxG, -1, 1) * 0.32);
  }
  const rpm = Math.max(0, +drv.rpm || 0), kmh = Math.abs(b.speed || 0) * 3.6;
  const on = rpm > 50;
  for (const n of cab.needles) {
    const G = n.userData.gauge;
    let t;
    switch (G.kind) {
      case 'rpm': t = rpm / G.max; break;
      case 'kmh': t = kmh / G.max; break;
      case 'oel': t = on ? (1.8 + 4.2 * clamp(rpm / (E.ratedRpm || 2600), 0, 1)) / G.max : 0; break;
      case 'wasser': t = on ? (78 + Math.min(14, cab.t * 0.3)) / G.max : 0.35; break;
      case 'az': t = 0; break;
      case 'kurs': n.rotation.z = typeof b.yaw === 'function' ? b.yaw() : 0; continue; // Kurskreisel: Zeiger folgt dem Kurs
      default: t = 0;
    }
    if (G.full) { n.rotation.z = m.turretYaw; continue; }
    // Zittern bei laufendem Motor
    const jit = on ? Math.sin(cab.t * 47 + n.id) * 0.006 : 0;
    const want = 0.75 * PI - 1.5 * PI * clamp(t, 0, 1.04) + jit;
    n.rotation.z = lerp(n.rotation.z, want, Math.min(1, dt * 6));
  }
  // --- Richtschütze: Handräder, Steuergriff
  if (cab.yawPrev == null) { cab.yawPrev = m.turretYaw; cab.pitchPrev = m.gunPitch; }
  let dyaw = m.turretYaw - cab.yawPrev; if (dyaw > PI) dyaw -= 2 * PI; if (dyaw < -PI) dyaw += 2 * PI;
  const dp = m.gunPitch - cab.pitchPrev;
  cab.yawPrev = m.turretYaw; cab.pitchPrev = m.gunPitch;
  if (P['rad:seite']) P['rad:seite'].rotateZ(dyaw * 14);
  if (P['rad:hoehe']) P['rad:hoehe'].rotateZ(-dp * 30);
  // --- Funker: Bug-MG folgt der Kugelblende, Kanalwahl nach dem Funkgerät (vehicle._psimKanal 1–8)
  if (P.bugmg) P.bugmg.rotation.set(m.cmgPitch || 0, m.cmgYaw || 0, 0, 'YXZ');
  if (P['rad:kanal']) P['rad:kanal'].children[0].rotation.z = lerp(P['rad:kanal'].children[0].rotation.z, 1.2 - (((v._psimKanal || 5) - 1) / 7) * 2.4, Math.min(1, dt * 10));
  if (P.griff) {
    const ry = clamp(dyaw / Math.max(dt, 1e-3) * 0.35, -0.25, 0.25), rx = clamp(-dp / Math.max(dt, 1e-3) * 0.6, -0.2, 0.2);
    P.griff.userData.r = P.griff.userData.r || { x: 0, z: 0 };
    const r = P.griff.userData.r;
    r.x = lerp(r.x, rx, Math.min(1, dt * 8)); r.z = lerp(r.z, ry, Math.min(1, dt * 8));
    P.griff.children[0].rotation.set(r.x, 0, r.z);
  }
  if (P.luefter) P.luefter.rotation.y += dt * (on ? 28 : 10);
  // Munitionswahl-Tasten, Sicherungsleuchte
  const gun = v.gun;
  if (gun) {
    const gs = v.seats.find((s) => s.def.mount === 'gun');
    const w = gs && gs.weapons && gs.weapons[gs.weaponIndex];
    const mg = !!(w && w.def && w.def.kind === 'mg');
    const sel = gun.select || gun.loaded;
    const C = cab.C;
    for (const k of Object.keys(cab.btn)) { const want = k === 'mg' ? (mg ? C.lampAmber : C.lampOff) : k === sel ? C.lampGreen : C.lampOff; if (cab.btn[k].material !== want) cab.btn[k].material = want; }
    const ls = P['lampe:sicher'];
    if (ls) { const want = gun.loaded && gun.step === 'geladen' ? C.lampGreen : C.lampRed; if (ls.children[0].material !== want) ls.children[0].material = want; }
  }
  // --- Bildschirme (≤ 5 Hz)
  cab.screenT -= dt;
  if (cab.screenT <= 0) {
    cab.screenT = 0.2;
    const I = cab.info.screens;
    if (I.fcs) {
      const ammo = gun && (gun.loaded || gun.select);
      const wd = ammo ? vehicleWeapon(v.type || D.id, ammo) : null;
      const ready = gun && gun.loaded && gun.step === 'geladen' && !(gun.busy > 0);
      const mil = (a) => Math.round(a * 6400 / (2 * PI));
      const el = mil(m.gunPitch), az = ((mil(-m.turretYaw) % 6400) + 6400) % 6400;
      drawFcs(screen('fcs', 256, 160), {
        range: Number.isFinite(v._laserRange) ? String(Math.round(v._laserRange)).padStart(4, '0') : '----',
        ammo: wd ? `${wd.short || ''} ${String(wd.name || '').replace(/\s*\(.*\)/, '').slice(0, 18)}` : ammo ? (ammo === 'mbt_ap' ? 'PG' : 'SG') : '—',
        ready: ready ? 'BEREIT' : gun && gun.busy > 0 ? 'LADEN' : 'LEER',
        elev: `${el >= 0 ? '+' : '−'}${String(Math.abs(el)).padStart(3, '0')} Str`, az: `${String(az).padStart(4, '0')} Str`,
        load: gun && gun._busyMax > 0 && gun.busy > 0 ? 1 - gun.busy / gun._busyMax : ready ? 1 : 0,
        therm: !!ctx.thermal, t: cab.t,
      });
    }
    if (I.cmd) drawCmd(screen('cmd', 256, 192), { hdg: typeof b.yaw === 'function' ? b.yaw() : 0, tur: m.turretYaw, team: v.team, t: cab.t });
    if (cab.det >= 0 && cab.era === 'modern' && cab.hull) {
      const z = v.zones || {};
      const warn = z.engine && z.engine.hp <= 0 ? 'MOTOR!' : z.tracks && z.tracks.hp <= 0 ? 'KETTE!' : '';
      drawDrv(screen('drv', 256, 128), { gear: ctx.gearName || String(drv.gear | 0), kmh: Math.round(kmh), rpm: rpm / (E.cutRpm || 2750), warn });
    }
  }
  // --- Schuss: Flackern, Hülse, Dampf; Treffer: Flackern
  if (v.recoil > cab.recoilPrev + 0.5) { cab.flick = 1; cab.ejectAt = cab.t + 0.22; }
  cab.recoilPrev = v.recoil;
  if (cab.hitPrev !== v.lastHitTime) { if (cab.hitPrev != null && v.lastHitTime > 0) cab.flick = 1.4; cab.hitPrev = v.lastHitTime; }
  cab.flick = Math.max(0, cab.flick - dt * 2.2);
  if (cab.ejectAt > 0 && cab.t >= cab.ejectAt) { cab.ejectAt = -1; eject(cab); }
  stepCasings(cab, dt);
  // --- Pendel (Hörer, Kopfhörer): Beschleunigung der Wanne im Wannenraum + Rückstoß
  const vel = b.velocity || b.vel;
  if (vel) {
    if (!cab.vel) cab.vel = vel.clone();
    _w.subVectors(vel, cab.vel).divideScalar(Math.max(dt, 1e-3));
    cab.vel.copy(vel);
    _iq.copy(b.renderQuat || b.quat || _iq.identity()).invert();
    _w.applyQuaternion(_iq);
    cab.acc.lerp(_w, Math.min(1, dt * 10));
  }
  for (const p of cab.pend) {
    const s = p.userData.pend;
    const kick = cab.flick > 0.95 ? 4 : 0;
    s.vx += (-s.ax * 38 - s.vx * 2.2 + cab.acc.z * 0.9 + kick) * dt;
    s.vz += (-s.az * 38 - s.vz * 2.2 - cab.acc.x * 0.9) * dt;
    s.ax = clamp(s.ax + s.vx * dt, -0.7, 0.7); s.az = clamp(s.az + s.vz * dt, -0.7, 0.7);
    p.rotation.set(s.ax, 0, s.az);
  }
  // --- Lampen → Shader (Weltraum); Satz je nach Platz (Fahrerraum oder Turm): 0–3 Kuppellampen (gebackene Schatten),
  // 4–5 Bildschirme/Leuchtmelder/Tageslicht
  const where = ctx.driver ? 'fahrer' : 'turm';
  CAB_U.uCabSet.value = ctx.driver ? 1 : 0;
  // Gebrauchsspuren je Ära: Rost (x) und Staub (z) – modern gepflegt, Weltkrieg stark verrostet
  { const e = cab.D.era || 'modern', E = ERA_WEAR[e] || ERA_WEAR.modern; CAB_U.uCabEra.value.set(E[0], E[2], E[1], 0); }
  const LP = CAB_U.uCabLP.value, LCo = CAB_U.uCabLC.value;
  const f = 1 - cab.flick * (0.55 + 0.45 * Math.sin(cab.t * 63)) * 0.8;
  const slots = cab.slots[where] || [];
  let dr = 0, dg = 0, db = 0, dn = 0;
  for (let k = 0; k < NL; k++) {
    const L = slots[k];
    if (!L) { LCo[k].setRGB(0, 0, 0); continue; }
    const obj = L.obj === 'tur' ? cab.tur : L.obj === 'gun' ? cab.gun : cab.hull;
    obj.updateWorldMatrix(true, false);
    LP[k].copy(L.pos).applyMatrix4(obj.matrixWorld);
    const fl = L.flicker ? 0.82 + 0.1 * Math.sin(cab.t * 13.7) + 0.08 * Math.sin(cab.t * 31.1 + 1.3) : 1;
    LCo[k].copy(L.col).multiplyScalar(Math.max(0.1, f) * fl);
    if (!L.glow) { dr += LCo[k].r; dg += LCo[k].g; db += LCo[k].b; dn++; }
  }
  // Streuscheiben der Kuppellampen leuchten in der Farbe des Lichtmodus (Gefecht rot/grün, Arbeit weiß, aus dunkel)
  const dome = cab.C.dome;
  if (dome && dn) {
    const mx = Math.max(dr, dg, db, 1e-4), lvl = Math.min(1, (dr + dg + db) / dn / 0.9);
    // Nutzer 21.11. („Deckenlampen überstrahlen stark weiß“): Streuscheibe gedämpft (kein Bloom-Fleck), Glühlampen der
    // Weltkriegs-/Kalter-Krieg-Panzer warm getönt
    if (cab.era === 'modern') dome.emissive.setRGB(dr / mx, dg / mx, db / mx);
    else dome.emissive.setRGB(0.55 + 0.45 * dr / mx, 0.36 + 0.3 * dg / mx, 0.14 + 0.14 * db / mx);
    dome.emissiveIntensity = 0.08 + (cab.era === 'modern' ? 1.2 : 0.5) * lvl;
  }
  // offene Luke: Tageslicht-Kegel von oben (Lukenmitte, 40 cm darüber), dazu mehr Himmelslicht
  let hk = 0;
  const HP3 = CAB_U.uCabHP.value;
  for (const s of v.seats) {
    if (!(s.hatchT > 0.05) || !s._hatchId) continue;
    const h = D.hatches && D.hatches[s._hatchId];
    if (!h || hk >= s.hatchT) continue;
    hk = s.hatchT;
    const ref = h.space === 'turret' ? cab.model.turret : cab.model.root;
    if (!ref) continue;
    ref.updateWorldMatrix(true, false);
    HP3.set(h.pos[0], h.pos[1] + 0.4, h.pos[2]).applyMatrix4(ref.matrixWorld);
  }
  CAB_U.uCabHC.value.setRGB(0.95, 0.97, 1.0).multiplyScalar(1.6 * hk * (ctx.day === false ? 0.15 : 1));
  // offene Luke in der Nähe? → mehr Tageslicht; sonst geschlossener Kasten
  CAB_U.uCabSun.value = ctx.hatchOpen ? 0.35 : 0.08;
  CAB_U.uCabAmb.value = ctx.hatchOpen ? 0.5 : 0.3;
  // Licht backen (schrittweise, Zeitbudget je Bild – bei langsamen Bildern mehr, damit es nicht ewig dauert)
  if (cab.bake && !cab.bake.done) cab.bake.step(dt > 0.5 ? 8000 : clamp(dt * 250, 8, 60));
}

/** Hülse aus dem Verschluss (Lage im Turmgruppenraum), fliegt nach hinten unten, rollt aus. */
function eject(cab) {
  const M = cab.model;
  if (!M.breech || !cab.A || !cab.casings.length) return;
  const slot = cab.casings.reduce((a, x) => (x.t > a.t ? x : a), cab.casings[0]);
  cab.casings.forEach((x) => { x.t += 1; });
  slot.t = 0;
  M.breech.updateWorldMatrix(true, false);
  _w.set(0, -0.05, 0.3).applyMatrix4(M.breech.matrixWorld);
  cab.tur.updateWorldMatrix(true, false);
  cab.tur.worldToLocal(slot.m.position.copy(_w));
  const s = cab.A.sc;
  slot.v.set((Math.random() - 0.5) * 0.4, -0.6 - Math.random() * 0.4, 2.0 + Math.random() * 0.6).divideScalar(s);
  slot.w.set(4 + Math.random() * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6);
  slot.m.rotation.set(HP, 0, 0);
  slot.m.visible = true;
  slot.rest = false;
  slot.life = 0;
  // Pulverdampf aus dem offenen Verschluss
  for (let i = 0; i < cab.smoke.length; i++) {
    const S = cab.smoke[i];
    S.t = -i * 0.12;
    S.s.position.copy(slot.m.position);
    S.s.position.y += 0.05 / s;
    S.s.visible = true;
  }
}
function stepCasings(cab, dt) {
  if (!cab.A || !cab.casings.length) return; // Transporter (attachTroopCabin): keine Hülsen
  const A = cab.A, s = A.sc, floor = A.yb + 0.03 / s;
  for (const c of cab.casings) {
    if (!c.m.visible || c.rest) continue;
    c.life += dt;
    c.v.y -= (9.81 / s) * dt;
    c.m.position.addScaledVector(c.v, dt);
    c.m.rotation.x += c.w.x * dt; c.m.rotation.y += c.w.y * dt; c.m.rotation.z += c.w.z * dt;
    // Wände des Turmkorbs (grob): Abstand zur Korbmitte begrenzen
    if (A.basket) {
      const dx = c.m.position.x - A.rc[0], dz = c.m.position.z - A.rc[2], r = Math.hypot(dx, dz), rm = A.ringR - 0.2;
      if (r > rm) { c.m.position.x = A.rc[0] + dx / r * rm; c.m.position.z = A.rc[2] + dz / r * rm; c.v.x *= -0.3; c.v.z *= -0.3; }
    }
    if (c.m.position.y < floor) {
      c.m.position.y = floor;
      if (Math.abs(c.v.y) > 0.6 / s) { c.v.y *= -0.28; c.v.x *= 0.5; c.v.z *= 0.5; c.w.multiplyScalar(0.5); }
      else { c.rest = true; c.m.rotation.set(c.m.rotation.x > 0 ? HP : HP, c.m.rotation.y, 0); c.m.rotation.x = CASE[cab.D.id] ? HP : 0; }
    }
    if (c.life > 4) c.rest = true;
  }
  for (const S of cab.smoke) {
    if (!S.s.visible) continue;
    S.t += dt;
    if (S.t < 0) { S.s.material.opacity = 0; continue; }
    const k = S.t / 2.2;
    if (k >= 1) { S.s.visible = false; continue; }
    S.s.position.y += dt * 0.25 / s;
    S.s.position.z += dt * 0.1 / s;
    const sz = (0.12 + k * 0.55) / s;
    S.s.scale.set(sz, sz, sz);
    S.s.material.opacity = 0.42 * (1 - k) * Math.min(1, S.t * 6);
  }
}

/* ===================================================================== Geländewagen: Fahrerplatz im Freien */

let JM = null;
/** Materialien ohne Innenlicht-Haken (offenes Fahrzeug: Sonne und Himmel wirken normal). */
function jeepMats(S) {
  if (JM) return JM;
  const A = atlas();
  JM = {
    label: new THREE.MeshStandardMaterial({ name: 'gw:schild', map: A.tex, roughness: 0.62, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    gauge: new THREE.MeshStandardMaterial({ name: 'gw:instrument', map: A.tex, emissive: 0x6a8a5a, emissiveMap: A.tex, emissiveIntensity: 0.2, roughness: 0.15, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    needle: new THREE.MeshStandardMaterial({ name: 'gw:zeiger', color: 0xfff1d0, emissive: 0xffd28a, emissiveIntensity: 0.5, roughness: 0.4 }),
    black: new THREE.MeshStandardMaterial({ name: 'gw:schwarz', color: 0x1c1d1b, roughness: 0.6, metalness: 0.3 }),
    olive: new THREE.MeshStandardMaterial({ name: 'gw:oliv', color: 0x454b33, roughness: 0.72, metalness: 0.2 }),
    lampGreen: new THREE.MeshStandardMaterial({ name: 'gw:lampe-gruen', color: 0x06200a, emissive: 0x3cff5a, emissiveIntensity: 1.6 }),
    lampRed: new THREE.MeshStandardMaterial({ name: 'gw:lampe-rot', color: 0x3a0806, emissive: 0xff2a14, emissiveIntensity: 1.6 }),
    lampOff: new THREE.MeshStandardMaterial({ name: 'gw:lampe-aus', color: 0x221a18, roughness: 0.25, metalness: 0.2 }),
  };
  return JM;
}

const JTPL = new Map();
function buildJeepCockpit(D, S, det) {
  const M = jeepMats(S);
  const C = { ...M, metal: S.dark, steel: S.steel, rubber: S.rubber, pad: S.canvas, canvas: S.canvas, red: S.red, yellow: M.olive, brass: S.dark, cableRed: S.red, cableYel: M.olive, lens: S.optic };
  const grp = new THREE.Group();
  grp.name = 'cabin:gw';
  const B = new MB();
  const eye = [-0.46, 1.62, -0.05];
  // Armaturenbrett: Blende, Instrumententräger vor dem Fahrer, Schalterleiste, Zündung, Handschuhfach, Haltegriff
  B.add(rbox(1.72, 0.24, 0.05, 0.015), M.olive, [0, 1.16, -0.645], [-0.12, 0, 0]);
  const IP = [-0.46, 1.38, -0.7]; // Instrumententräger auf dem Armaturenbrett (über dem Lenkrad sichtbar)
  const F = new Frame(B, IP, aim(IP, eye));
  F.add(rbox(0.4, 0.17, 0.07, 0.02), M.black, [0, 0, -0.03]);
  F.add(box(0.42, 0.03, 0.09), M.black, [0, 0.095, -0.01]); // Blendschutz
  gauge(F, C, 'd_kmh12', [-0.1, 0.005, 0], 0.058, S.steel, grp, 'kmh', 120, det);
  gauge(F, C, 'd_rpm6', [0.07, 0.005, 0], 0.058, S.steel, grp, 'rpm', 6000, det);
  gauge(F, C, 'd_wasser', [0.165, 0.03, 0], 0.025, S.steel, grp, 'wasser', 120, det);
  gauge(F, C, 'd_oel', [0.165, -0.035, 0], 0.025, S.steel, grp, 'oel', 10, det);
  [M.lampGreen, M.lampOff, M.lampRed, M.lampOff].forEach((m, i) => F.add(cyl(0.008, 0.008, 0.01, 8), m, [-0.17 + i * 0.03, -0.065, 0.004], [HP, 0, 0]));
  const SF = new Frame(B, [0.02, 1.13, -0.62], aim([0.02, 1.13, -0.62], [0, 1.6, 0]));
  flabel(SF, C, 'schalter', [0, 0, 0.002], 0.26);
  for (let i = 0; i < 5; i++) SF.add(cyl(0.003, 0.002, 0.03, 6), S.steel, [-0.1 + i * 0.0505, -0.005, 0.014], [i % 2 ? -0.6 : 0.6, 0, 0]);
  SF.add(cyl(0.015, 0.015, 0.02, 10), M.black, [0.17, -0.02, 0.008], [HP, 0, 0]);
  flabel(SF, C, 'zuendung', [0.17, 0.035, 0.002], 0.08);
  B.add(rbox(0.36, 0.13, 0.02, 0.008), M.olive, [0.46, 1.13, -0.612], [-0.12, 0, 0]);
  B.add(box(0.08, 0.015, 0.02), S.steel, [0.46, 1.17, -0.6]);
  B.rod(S.steel, [0.26, 1.29, -0.62], [0.66, 1.29, -0.62], 0.014);
  for (const x of [0.26, 0.66]) B.rod(S.steel, [x, 1.29, -0.62], [x, 1.25, -0.66], 0.014);
  // Innenspiegel, Kartenhalter
  B.add(rbox(0.22, 0.07, 0.025, 0.01), M.black, [0, 1.74, -0.9]);
  B.add(box(0.2, 0.055, 0.004), S.optic, [0, 1.74, -0.886]);
  B.add(box(0.26, 0.2, 0.01), S.canvas, [0.46, 1.33, -0.73], [-0.9, 0, 0]);
  // Funkgerät unter dem Armaturenbrett (Mitte), Hörer
  B.add(rbox(0.32, 0.16, 0.26, 0.01), M.olive, [0, 1.02, -0.52]);
  label(B, C, 'radio1', [0, 1.02, -0.389], null, 0.3);
  B.add(rbox(0.05, 0.18, 0.04, 0.015), M.black, [0.2, 1.03, -0.4], [0, 0, 0.2]);
  // Fußraum: Pedale (Kupplung, Bremse, Gas), Gummimatten
  for (const [nm, px, pw] of [['pedal:kupplung', -0.62, 0.07], ['pedal:bremse', -0.49, 0.08], ['pedal:gas', -0.34, 0.06]]) {
    const p = part(grp, nm, [px, 0.93, -0.62]);
    const L = new MB();
    L.rod(S.steel, [0, 0, 0], [0, 0.18, 0.08], 0.01, 6);
    L.add(rbox(pw, 0.02, 0.1, 0.006), S.rubber, [0, 0.19, 0.09], [-0.95, 0, 0]);
    L.build(p, nm);
  }
  for (const sx of [-1, 1]) B.add(box(0.5, 0.012, 0.6), S.rubber, [sx * 0.46, 0.926, -0.35]);
  // Schalthebel, Verteilergetriebe, Handbremse
  {
    const p = part(grp, 'gang', [-0.17, 0.93, -0.32]);
    const L = new MB();
    L.add(cyl(0.06, 0.07, 0.06, 10, true), S.rubber);
    L.rod(S.steel, [0, 0, 0], [0, 0.42, 0.06], 0.011, 6);
    L.add(new THREE.SphereGeometry(0.028, 10, 8), M.black, [0, 0.43, 0.06]);
    L.build(p, 'gang');
  }
  B.rod(S.steel, [-0.08, 0.93, -0.3], [-0.06, 1.2, -0.25], 0.009);
  B.add(new THREE.SphereGeometry(0.022, 8, 6), S.red, [-0.06, 1.21, -0.25]);
  B.rod(S.steel, [-0.1, 0.94, 0.05], [-0.1, 1.08, 0.22], 0.014);
  B.add(cyl(0.02, 0.02, 0.1, 8), S.rubber, [-0.1, 1.1, 0.25], [1.2, 0, 0]);
  // Feuerlöscher am Beifahrersitz, Verbandkasten hinter den Sitzen, Munitionskisten neben dem MG-Sockel
  extinguisher(B, C, [0.82, 1.15, -0.45], 1, det);
  B.add(rbox(0.22, 0.14, 0.12, 0.01), M.olive, [-0.6, 1.0, 0.38]);
  label(B, C, 'erstehilfe', [-0.6, 1.0, 0.441], null, 0.18);
  for (const [x, z] of [[0.32, 0.5], [0.32, 0.8], [-0.3, 0.65]]) {
    B.add(rbox(0.13, 0.19, 0.28, 0.01), M.olive, [x, 1.015, z]);
    B.add(box(0.05, 0.02, 0.1), S.dark, [x, 1.115, z]);
    label(B, C, 'munition', [x + (x > 0 ? 0.066 : -0.066), 1.02, z], [0, x > 0 ? HP : -HP, 0], 0.2);
  }
  harness(B, C, [[-0.85, 1.25, -0.7], [-0.88, 1.2, -0.2], [-0.88, 1.15, 0.5]], det, 2);
  B.build(grp, 'cockpit');
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return grp;
}

/** Fahrerplatz des Geländewagens (lazy, nur lokaler Insasse in der Ego-Sicht). */
export function attachCockpit(model, D, S, quality = 'high') {
  if (!model || !D || D.civil || D.drive === 'tracked' || D.model !== 'jeep') return null;
  const det = quality === 'low' ? 0 : quality === 'medium' ? 1 : 2;
  let tpl = JTPL.get(det);
  if (!tpl) { tpl = buildJeepCockpit(D, S, det); JTPL.set(det, tpl); }
  const grp = tpl.clone(true);
  // an die Bezugspunkte des Modells hängen (data.js cockpit; gebaut ist für Armaturenbrett-Oberkante 1,31 / z −0,75)
  const ck = D.cockpit || {};
  if (ck.dash) grp.position.set(0, ck.dash[1] - 1.31, ck.dash[2] + 0.75);
  model.root.add(grp);
  const cab = { D, grp, needles: [], pedals: [], parts: {}, t: 0 };
  grp.traverse((o) => {
    if (!o.name || o.isMesh) return;
    if (o.name.startsWith('zeiger:')) cab.needles.push(o);
    else if (o.name.startsWith('pedal:')) cab.pedals.push(o);
    else if (o.name === 'gang') cab.parts.gang = o;
  });
  grp.visible = false;
  return cab;
}

export function syncCockpit(cab, v, dt) {
  if (!cab || !v) return;
  cab.t += dt;
  const b = v.body, c = b.controls || {}, drv = b.drive || {};
  const thr = Math.abs(+c.throttle || 0), brake = clamp(+c.brake || 0, 0, 1);
  for (const p of cab.pedals) {
    const want = p.name === 'pedal:gas' ? thr : p.name === 'pedal:bremse' ? brake : drv.shifting ? 1 : 0;
    p.rotation.x = lerp(p.rotation.x, -0.32 * want, Math.min(1, dt * 12));
  }
  if (cab.parts.gang) cab.parts.gang.rotation.x = lerp(cab.parts.gang.rotation.x, clamp(-(drv.gear | 0) / 4, -1, 1) * 0.3, Math.min(1, dt * 8));
  const rpm = Math.max(0, +drv.rpm || 0), kmh = Math.abs(b.speed || 0) * 3.6, on = rpm > 50;
  for (const n of cab.needles) {
    const G = n.userData.gauge;
    const t = G.kind === 'rpm' ? rpm / 6000 : G.kind === 'kmh' ? kmh / G.max : G.kind === 'oel' ? (on ? 0.45 + 0.3 * clamp(rpm / 5000, 0, 1) : 0) : on ? 0.72 : 0.35;
    n.rotation.z = lerp(n.rotation.z, 0.75 * PI - 1.5 * PI * clamp(t, 0, 1.04) + (on ? Math.sin(cab.t * 41 + n.id) * 0.005 : 0), Math.min(1, dt * 6));
  }
}

/* ===================================================================== Sitz-Anker für Besatzungsfiguren */

const ROLE = { driver: 'fahrer', gunner: 'richtschuetze', commander: 'kommandant', loader: 'ladeschuetze', funker: 'funker', mg: 'mg', mechaniker: 'mechaniker' };
/**
 * Sitz-Anker je Platz (Strang crew-figures.js, Nutzer 21.11.: sichtbare Besatzung im Innenraum) – reine Daten aus der
 * Fahrzeugdefinition, gleiche Lagen, die cabin.js/cabin-troop.js für Sitze und Augpunkte nutzt. vehicleOrDef: Fahrzeug
 * (mit .def) oder Definition. → [{ index, seat, role, space ('hull' | 'turret'), hip [x,y,z] (Mitte Sitzfläche oben),
 * eye [x,y,z] (Augpunkt der Innensicht), yaw (rad, 0 = Fahrtrichtung −Z, positiv = nach links gedreht), posture
 * ('sitzend' | 'stehend'), interior (Platz liegt im geschlossenen Innenraum) }]. Koordinaten im Raum `space` (Wanne:
 * Fahrzeug lokal; Turm: Turmraum wie die Sichten). Plätze ohne Innenraum (offene Sitze) bekommen interior: false.
 */
export function cabinSeatAnchors(vehicleOrDef) {
  const D = vehicleOrDef && vehicleOrDef.def ? vehicleOrDef.def : vehicleOrDef;
  if (!D || !D.seats) return [];
  const I = D.interior || {}, sh = I.shift || [0, 0, 0], sc = I.scale || 1;
  const fromG = (p) => [p[0] * sc + sh[0], p[1] * sc + sh[1], p[2] * sc + sh[2]];
  const R = D.troop ? troopDriverRoom(D) : driverCabin(D);
  const FK = funkerCabin(D, driverCabin);
  const out = [];
  D.seats.forEach((s, index) => {
    const inner = (s.views || []).find((v) => v.interior) || null;
    const role = ROLE[s.id] || (s.loader ? 'ladeschuetze' : /^schuetze|^bank|^reihe|^hinten/.test(s.id) ? 'mitfahrer' : s.id);
    const eye = inner ? (inner.pos || null) : null;
    const a = { index, seat: s.id, role, space: inner && inner.space === 'turret' ? 'turret' : 'hull', hip: null, eye: eye ? eye.slice() : null, yaw: 0, posture: 'sitzend', interior: !!inner };
    if (s.drive && R) { a.space = 'hull'; a.hip = [R.F[0], R.floor + 0.29, R.F[2] + 0.1]; a.eye = R.eye.slice(); }
    else if (s.id === 'funker' && FK) { const L = funkerLayout(FK); a.space = 'hull'; a.hip = [L.seat[0], L.seat[1] + 0.04, L.seat[2]]; a.eye = FK.eye.slice(); }
    // Ladeschütze steht: Hüfte ≈ 0,68 m unter dem Auge, leicht hinter dem Kopf (Nutzer/Crew-Strang 21.11.: lag über dem Auge)
    else if (s.loader && inner && inner.space === 'turret') { const le = I.loaderEye || [0.55, 0.62, 0.35]; a.posture = 'stehend'; a.hip = fromG([le[0], le[1] - 0.68, le[2] + 0.06]); a.eye = fromG(le); a.yaw = 0; }
    // Richtschütze sitzt hinter der Optik (Station = Okular), Kommandant vor seiner Lehne (Sitz bei Station + 0,2 m)
    // Proportionen 22.11.: Richtschütze 8 cm näher an der Optik (Sitz 0,26 m hinter dem Okular, Stirn an der Stirnstütze);
    // look = Kopfziel der Figur (crew-figures.js) – vorher saß sie aufrecht am Augpunkt der Innensicht, 0,36 m hinter der Optik
    // rest 22.11. (Nutzer: „Richtschütze ohne Kopf in der Ladersicht“): der Sitz lag 0,6 m unter Okular bzw. Augpunkt – sitzend
    // reicht das Auge aber ≈ 0,8 m über die Sitzfläche: Scheitel und Mütze stießen durch die Turmdecke (gemessen KP-1: Decke
    // 0,25 m über dem Kopfknochen des Richtschützen, beim Kommandanten 0,01 m – Kopf von innen unsichtbar). Jetzt 0,8 m darunter
    // (Auge auf Okular-/Augpunkthöhe)
    else if (inner && inner.space === 'turret') { const st = inner.station || inner.pos, gun = s.mount === 'gun'; a.hip = [inner.pos[0], st[1] - 0.8 * sc, st[2] + (gun ? 0.26 : 0.2) * sc]; a.eye = inner.pos.slice(); if (gun && inner.station) a.look = [st[0], st[1], st[2] + 0.07 * sc]; }
    else if (inner && D.troop) { const side = Math.sign(s.pos[0]) || 1; a.hip = [s.pos[0] * (D.troop.halfW - 0.25) / Math.max(0.3, Math.abs(s.pos[0])), D.troop.floor + troopSeatH(D.troop) + 0.035, s.pos[2]]; a.yaw = side > 0 ? HP : -HP; a.roof = D.troop.roof; }
    else if (s.pos) { a.hip = [s.pos[0], s.pos[1] + 0.45, s.pos[2]]; a.interior = !!inner; }
    // Decke über dem Platz (crew-figures.js hält den Scheitel darunter): Turm – Schale des Innenraums (cabin-base.js
    // turretBase, Gruppenraum 0,75 m; die Luken sind in der Innenschale nicht ausgeschnitten); Fahrer/Funker – Raumdecke aus
    // driverCabin/funkerCabin
    if (a.roof == null && a.hip) {
      if (a.space === 'turret' && D.turretBox) a.roof = 0.75 * sc + sh[1];
      else if (s.drive && R && Number.isFinite(R.roof)) a.roof = R.roof;
      else if (s.id === 'funker' && FK && Number.isFinite(FK.roof)) a.roof = FK.roof;
    }
    out.push(a);
  });
  return out;
}
