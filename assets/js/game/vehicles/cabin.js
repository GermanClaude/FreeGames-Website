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
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { boxUV } from '../engine/textures.js?v=20261114060746';
import { addShaderPatch, copyShaderPatches, ensureWorldVaryings } from '../world/shading.js?v=20261114060746';
import { driverCabin, vehicleWeapon } from './data.js?v=20261114060746';

const PI = Math.PI, HP = PI / 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _Y = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/* ===================================================================== Geometrie-Helfer */

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.02, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const cyl = (r1, r2, h, seg = 12, open = false) => new THREE.CylinderGeometry(r1, r2, h, Math.max(3, seg | 0), 1, open);
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
class MB {
  constructor() { this.m = new Map(); }
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
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (list.length > 1) for (const x of list) x.dispose();
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
  const W = 1024, H = 1024;
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
  // Steppnaht-Polster (Höhe → Normalen, für die Polsterflächen)
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
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

/** Geteilte Uniforms des Innenlichts (nur ein lokaler Insasse → ein Satz). */
const CAB_U = {
  uCabLP: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
  uCabLC: { value: [new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0)] },
  uCabAmb: { value: 0.32 }, uCabSun: { value: 0.12 }, uCabWear: { value: 1 },
};

function cabinShader(sh) {
  Object.assign(sh.uniforms, CAB_U);
  ensureWorldVaryings(sh);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vCabO;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCabO = position;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vCabO;
      uniform vec3 uCabLP[ 4 ]; uniform vec3 uCabLC[ 4 ]; uniform float uCabAmb; uniform float uCabSun; uniform float uCabWear;
      float cbH( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
      float cbN( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( mix( cbH( i ), cbH( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( cbH( i + vec3( 0.0, 1.0, 0.0 ) ), cbH( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
                    mix( mix( cbH( i + vec3( 0.0, 0.0, 1.0 ) ), cbH( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( cbH( i + vec3( 0.0, 1.0, 1.0 ) ), cbH( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z ); }`)
    .replace('#include <map_fragment>', `#include <map_fragment>
      // Gebrauchsspuren: fleckige Verschmutzung, dunkle Griffspuren, helle Kratzer (Objektraum, kein Texturbedarf)
      float cbG = cbN( vCabO * 3.1 ) * 0.6 + cbN( vCabO * 11.0 + 4.0 ) * 0.4;
      float cbD = smoothstep( 0.62, 0.8, cbN( vCabO * vec3( 7.0, 2.2, 7.0 ) + 1.7 ) );
      float cbS = smoothstep( 0.955, 0.985, cbN( vCabO * vec3( 70.0, 4.0, 70.0 ) + 9.0 ) ) * smoothstep( 0.4, 0.7, cbN( vCabO * 2.3 ) );
      diffuseColor.rgb *= mix( 1.0, ( 0.8 + 0.2 * cbG ) * ( 1.0 - 0.32 * cbD ), uCabWear );
      diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * 1.6 + vec3( 0.05 ), cbS * 0.55 * uCabWear );`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp( roughnessFactor + ( cbD * 0.12 - cbS * 0.3 ) * uCabWear, 0.04, 1.0 );`)
    .replace('#include <aomap_fragment>', `
      // geschlossener Stahlkasten: Sonne/Himmel kaum, dafür Innenleuchten (Punktlichter im Weltraum)
      reflectedLight.directDiffuse *= uCabSun; reflectedLight.directSpecular *= uCabSun;
      reflectedLight.indirectDiffuse *= uCabAmb; reflectedLight.indirectSpecular *= uCabAmb;
      {
        vec3 cbNw = normalize( inverseTransformDirection( normal, viewMatrix ) );
        vec3 cbV = normalize( cameraPosition - vNpWorld );
        float cbR4 = max( pow( roughnessFactor, 4.0 ), 0.0015 );
        float cbSh = clamp( 2.0 / cbR4 - 2.0, 1.0, 900.0 );
        for ( int i = 0; i < 4; i ++ ) {
          vec3 L = uCabLP[ i ] - vNpWorld; float d2 = max( dot( L, L ), 1e-4 ); L *= inversesqrt( d2 );
          float att = 1.0 / ( 1.0 + d2 * 7.0 );
          float nl = max( dot( cbNw, L ), 0.0 );
          float wrapL = clamp( ( dot( cbNw, L ) + 0.35 ) / 1.35, 0.0, 1.0 );
          reflectedLight.directDiffuse += diffuseColor.rgb * uCabLC[ i ] * mix( nl, wrapL, 0.35 ) * att;
          vec3 Hh = normalize( L + cbV );
          reflectedLight.directSpecular += uCabLC[ i ] * pow( max( dot( cbNw, Hh ), 0.0 ), cbSh ) * ( cbSh + 2.0 ) / 8.0 * nl * att * 0.12 * mix( 0.04, 1.0, metalnessFactor );
        }
      }
      #include <aomap_fragment>`);
}
function cabPatch(m) { addShaderPatch(m, 'cabin', cabinShader); m.userData.cabin = true; return m; }

let CM = null;
/** Innenraum-Materialsatz (lazy). Klone der Fahrzeugmaterialien behalten deren Fotoscan-Texturen (resync bei Bedarf). */
function cabinMats(S) {
  if (CM) return CM;
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
  const std = (name, p) => cabPatch(new THREE.MeshStandardMaterial({ name: 'cab:' + name, ...p }));
  const A = atlas();
  const paintSrc = S.paint.null;
  const wall = (name, color, rough, metal) => {
    const m = std(name, { color, roughness: rough, metalness: metal, normalScale: new THREE.Vector2(0.35, 0.35) });
    m.userData.wallFrom = paintSrc; // Normalen/ORM aus dem Lack-Fotoscan (resync)
    return m;
  };
  CM = {
    pairs,
    // Wandanstrich je Generation: modern helles Graugrün, 2. WK Elfenbein, 1. WK roher, geölter Stahl
    wall: { modern: wall('wand', 0x9aa591, 0.78, 0.15), wk2: wall('wand2', 0xd8cfb2, 0.72, 0.1), wk1: wall('wand1', 0x5f5a50, 0.62, 0.45) },
    floor: clone(S.dark, 'boden', { color: 0x3a3b37 }),
    metal: clone(S.dark, 'metall'),
    steel: clone(S.steel, 'stahl'),
    black: std('schwarz', { color: 0x1a1b1a, roughness: 0.55, metalness: 0.35 }),
    olive: std('oliv', { color: 0x434a33, roughness: 0.7, metalness: 0.2 }),
    rubber: clone(S.rubber, 'gummi'),
    canvas: clone(S.canvas, 'segeltuch'),
    pad: std('polster', { color: 0x2f3128, roughness: 0.62, metalness: 0, normalMap: quiltNormal(), normalScale: new THREE.Vector2(0.9, 0.9) }),
    leather: std('leder', { color: 0x4a3322, roughness: 0.58, metalness: 0, normalMap: quiltNormal(), normalScale: new THREE.Vector2(0.6, 0.6) }),
    red: clone(S.red, 'rot'),
    yellow: std('gelb', { color: 0xc9a227, roughness: 0.55, metalness: 0.1 }),
    orange: std('orange', { color: 0xb35a1a, roughness: 0.6, metalness: 0.05 }),
    brass: clone(S.brass, 'messing', { emissiveIntensity: 0.4 }),
    wood: clone(S.wood, 'holz'),
    shell: clone(S.shell, 'granate'),
    sleeve: clone(S.sleeve, 'aermel'),
    label: std('schild', { map: A.tex, roughness: 0.62, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    gauge: std('instrument', { map: A.tex, emissive: 0x6a8a5a, emissiveMap: A.tex, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    needle: std('zeiger', { color: 0xfff1d0, emissive: 0xffd28a, emissiveIntensity: 0.8, roughness: 0.4 }),
    // Winkelspiegel-Glas: Tageslicht aus dem Prisma (leicht grünlich vergütet)
    prism: std('prisma', { color: 0x203036, roughness: 0.05, metalness: 0.6, emissive: 0xffffff, emissiveMap: prismTex(), emissiveIntensity: 1.0, envMapIntensity: 1.5 }),
    lens: std('linse', { color: 0x071214, roughness: 0.04, metalness: 0.9, emissive: 0x0c2a30, emissiveIntensity: 0.8 }),
    lampRed: std('lampe-rot', { color: 0x3a0806, emissive: 0xff2a14, emissiveIntensity: 3.2, roughness: 0.3 }),
    lampGreen: std('lampe-gruen', { color: 0x06200a, emissive: 0x3cff5a, emissiveIntensity: 2.4, roughness: 0.3 }),
    lampAmber: std('lampe-gelb', { color: 0x2a1a04, emissive: 0xffa21c, emissiveIntensity: 2.4, roughness: 0.3 }),
    lampOff: std('lampe-aus', { color: 0x221a18, roughness: 0.25, metalness: 0.2 }),
    lampWarm: std('gluehlampe', { color: 0xffe0b0, emissive: 0xffb860, emissiveIntensity: 3.5, roughness: 0.3 }),
    flame: std('flamme', { color: 0xffc070, emissive: 0xff8a2a, emissiveIntensity: 5, roughness: 0.5 }),
    cableRed: std('kabel-rot', { color: 0x7a1a14, roughness: 0.6 }),
    cableYel: std('kabel-gelb', { color: 0x8a7420, roughness: 0.6 }),
    casing: std('huelse', { color: 0xb8913f, roughness: 0.3, metalness: 0.9, emissive: 0x1a1206, emissiveIntensity: 1 }),
    stub: std('huelsenboden', { color: 0x9c8248, roughness: 0.38, metalness: 0.85 }),
    smoke: new THREE.MeshBasicMaterial({ name: 'cab:dampf', color: 0x9a948a, transparent: true, opacity: 0.3, depthWrite: false }),
  };
  for (const k of ['modern', 'wk2', 'wk1']) pairs.push([CM.wall[k], null]);
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
    [S.sleeve, CM.sleeve], [S.lensOn, CM.lampGreen], [S.lamp, CM.lampWarm],
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
export function cabinWarmMaterials(S) {
  const C = cabinMats(S);
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

/** Handrad (Rand, Speichen, Nabe, Kurbel) als Gruppe; lokale Z = Drehachse. */
function handwheel(parent, name, pos, quat, R, C, mat, det) {
  const p = part(parent, name, pos, quat);
  const B = new MB();
  B.add(tor(R, R * 0.12, 6, det ? 28 : 14), mat);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; B.rod(mat, [0, 0, 0], [Math.cos(a) * R, Math.sin(a) * R, 0], R * 0.07, 6); }
  B.add(cyl(R * 0.2, R * 0.2, R * 0.35, 10), C.metal, [0, 0, 0], [HP, 0, 0]);
  B.rod(C.steel, [R, 0, 0], [R, 0, R * 0.55], R * 0.05, 6);
  B.add(cyl(R * 0.11, R * 0.11, R * 0.6, 8), C.rubber, [R, 0, R * 0.75], [HP, 0, 0]);
  B.build(p, name);
  return p;
}

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

function buildDriver(root, D, C, det, era, cab) {
  const R = driverCabin(D);
  if (!R) return null;
  const grp = new THREE.Group();
  grp.name = 'cabin:fahrer';
  root.add(grp);
  const B = new MB();
  const W = C.wall[era], modern = era === 'modern', wk1 = era === 'wk1';
  const { xl, xr, floor: yF, roof: yR, zFT, zFB, zB, eye: E } = R;
  const x0 = R.F[0], z0 = R.F[2];
  // Raum: Boden, Glacis (schräg), Decke, Rückwand, Seitenwände – nach innen gekehrt
  B.add(roomGeom([[zB, yF], [zFB, yF], [zFT, yR], [zB, yR]], xl, xr), W);
  B.add(box(xr - xl - 0.04, 0.012, zB - zFB - 0.06), C.floor, [(xl + xr) / 2, yF + 0.006, (zB + zFB) / 2]);
  if (det) for (let z = zFB + 0.12; z < zB - 0.05; z += 0.11) B.add(box(xr - xl - 0.1, 0.004, 0.012), C.steel, [(xl + xr) / 2, yF + 0.014, z], [0, 0.35, 0]);
  // Schweißnähte / Rippen an Glacis und Decke
  const gl = Math.hypot(zFT - zFB, yR - yF), ga = Math.atan2(yR - yF, zFB - zFT);
  // Schweißnaht quer über das Glacis (flach auf der Fläche)
  const gn = new THREE.Vector3(0, -(zFB - zFT), yR - yF).normalize(); // Innen-Normale des Glacis (zeigt nach hinten oben)
  if (det) B.add(box(xr - xl - 0.06, 0.018, 0.012), C.metal, [(xl + xr) / 2, yF + (yR - yF) * 0.55 + gn.y * 0.004, zFB + (zFT - zFB) * 0.55 + gn.z * 0.004], [ga - PI, 0, 0]);
  for (const zz of [zFT + 0.25, (zFT + zB) / 2 + 0.1]) B.add(box(xr - xl - 0.04, 0.03, 0.035), C.metal, [(xl + xr) / 2, yR - 0.016, zz]);
  if (wk1 || era === 'wk2') {
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

  // ---- Lenkhebel (Drehpunkt am Boden, ziehen = Kette bremsen)
  for (const [nm, sx] of [['hebel:l', -1], ['hebel:r', 1]]) {
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
  if (!modern) peds.push(['pedal:kupplung', x0 - 0.2, 0.08, 0.08]);
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

  // ---- Gangwahl: modern Wählhebel in Kulisse rechts, Weltkrieg Schalthebel aus dem Boden links
  if (modern) {
    B.add(rbox(0.08, 0.06, 0.24, 0.01), C.black, [x0 + 0.32, sy + 0.33, sz - 0.04]);
    label(B, C, 'gang', [x0 + 0.32, sy + 0.361, sz - 0.04], [-HP, 0, HP], 0.22);
    B.add(box(0.06, 0.33, 0.06), C.metal, [x0 + 0.32, sy + 0.15, sz - 0.04]);
    const p = part(grp, 'gang', [x0 + 0.32, sy + 0.36, sz - 0.04]);
    const L = new MB();
    L.rod(C.steel, [0, 0, 0], [0, 0.12, 0], 0.008, 6);
    L.add(rbox(0.04, 0.05, 0.05, 0.015), C.black, [0, 0.14, 0]);
    L.build(p, 'gang');
  } else {
    const p = part(grp, 'gang', [x0 - 0.33, sy + 0.02, sz - 0.12]);
    const L = new MB();
    L.add(cyl(0.05, 0.06, 0.05, 10), C.metal);
    L.rod(C.steel, [0, 0, 0], [0, 0.55, 0.05], 0.012, 6);
    L.add(new THREE.SphereGeometry(0.03, 10, 8), wk1 ? C.wood : C.black, [0, 0.57, 0.05]);
    L.build(p, 'gang');
  }

  // ---- Instrumententafel (schräg, zum Auge gedreht)
  const dir = new THREE.Vector3(0, -0.48, -1).normalize();
  const P = V3(E).addScaledVector(dir, 0.52);
  P.z = Math.max(P.z, zFB + (P.y - yF) / Math.max(0.2, yR - yF) * (zFT - zFB) + 0.14);
  const PF = new Frame(B, P.toArray(), aim(P.toArray(), E));
  const pw = Math.min(0.66, xr - xl - 0.08);
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
  } else if (era === 'wk2') {
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

  // ---- Winkelspiegel (drei Prismen an der Decke vorn) mit Stirnpolstern
  const nP = wk1 ? 1 : 3;
  for (let k = 0; k < nP; k++) {
    const kk = nP === 1 ? 0 : k - 1;
    const c = [x0 + kk * 0.26, yR - 0.085, zFT + 0.1 + Math.abs(kk) * 0.04];
    const F = new Frame(B, c, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -kk * 0.35, 0)));
    F.add(rbox(0.21, 0.15, 0.14, 0.012), C.metal, [0, 0, 0]);
    F.add(new THREE.PlaneGeometry(0.17, 0.07), C.prism, [0, -0.015, 0.0705], null, null, true);
    F.add(box(0.19, 0.012, 0.02), C.rubber, [0, 0.026, 0.075]);
    F.add(rbox(0.21, 0.05, 0.06, 0.02), C.pad, [0, 0.07, 0.08]);
    if (det) for (const sx of [-1, 1]) F.add(cyl(0.01, 0.01, 0.02, 6), C.steel, [sx * 0.09, -0.06, 0.07], [HP, 0, 0]);
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
  label(B, C, 'diesel', [xr - 0.097, yF + 0.07 + tH * 0.72, z0 - 0.2], [0, -HP, 0], 0.18);
  B.add(cyl(0.012, 0.012, tH * 0.6, 8), C.lens, [xr - 0.1, yF + 0.07 + tH * 0.45, z0 - 0.62]);
  B.add(box(0.02, tH * 0.65, 0.04), C.steel, [xr - 0.095, yF + 0.07 + tH * 0.45, z0 - 0.62]);
  B.add(rbox(0.26, 0.24, 0.4, 0.015), C.black, [xr - 0.22, yF + 0.13, z0 + 0.36]);
  for (const zz of [z0 + 0.24, z0 + 0.48]) { B.add(cyl(0.02, 0.02, 0.03, 8), C.metal, [xr - 0.22, yF + 0.265, zz]); B.add(box(0.012, 0.012, 0.08), zz < z0 + 0.3 ? C.cableRed : C.black, [xr - 0.22, yF + 0.29, zz + 0.05]); }
  label(B, C, 'haupt', [xr - 0.351, yF + 0.16, z0 + 0.36], [0, -HP, 0], 0.15);
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
  B.add(box(0.46, Math.min(0.62, yR - yF - 0.25), 0.012), C.rubber, [ox, yF + 0.36, zB - 0.008]);
  B.add(box(0.5, 0.03, 0.03), C.steel, [ox, yF + 0.36 + Math.min(0.31, (yR - yF - 0.25) / 2), zB - 0.02]);
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
  // Deckenleuchten: modern rot (Gefechtslicht), Weltkrieg Glühlampe
  const lp = [x0 - toC * 0.05, yR - 0.03, z0 + 0.32];
  B.add(rbox(0.14, 0.04, 0.08, 0.01), C.black, lp);
  B.add(box(0.1, 0.012, 0.05), modern ? C.lampRed : C.lampWarm, [lp[0], lp[1] - 0.02, lp[2]]);
  if (det) B.add(box(0.12, 0.004, 0.006), C.steel, [lp[0], lp[1] - 0.028, lp[2]]);
  cab.lamps.push({ obj: 'hull', pos: new THREE.Vector3(lp[0], lp[1] - 0.06, lp[2]), col: new THREE.Color(modern ? 0xff3a22 : 0xffc27a).multiplyScalar(modern ? 0.9 : 0.9), where: 'fahrer' });
  cab.lamps.push({ obj: 'hull', pos: P.clone().addScaledVector(V3(E).sub(P).normalize(), 0.12), col: new THREE.Color(modern ? 0x48ff70 : 0xffb050).multiplyScalar(modern ? 0.28 : 0.15), where: 'fahrer' });
  cab.lamps.push({ obj: 'hull', pos: new THREE.Vector3(x0, yR - 0.1, zFT + 0.2), col: new THREE.Color(0x9ab8c8).multiplyScalar(0.25), where: 'fahrer' }); // Tageslicht durch die Winkelspiegel
  B.build(grp, 'fahrerraum');
  cab.driverEye = E;
  return grp;
}

/* ===================================================================== Turm-/Kampfraum (Gruppenraum des Innenraums) */

/** Ankerpunkte der Plätze im Gruppenraum des Innenraums (KP-1-Aufbau, um shift/scale verschoben). */
function anchorsOf(D) {
  const I = D.interior || {}, sh = I.shift || [0, 0, 0], sc = I.scale || 1;
  const toG = (p) => [(p[0] - sh[0]) / sc, (p[1] - sh[1]) / sc, (p[2] - sh[2]) / sc];
  const innen = (pred) => { const s = D.seats.find(pred); const v = s && (s.views || []).find((x) => x.interior && x.space === 'turret'); return v ? toG(v.pos) : null; };
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
      cab.screens.fcs = true;
      ['mbt_ap', 'mbt_he', 'mg'].forEach((k, i) => {
        const bp = part(grp, 'btn:' + k, SF.w([-0.053 + i * 0.053, -0.12, 0.01]), SF.q);
        const bm = new THREE.Mesh(box(0.026, 0.014, 0.008), C.lampOff);
        bm.name = 'btn'; bp.add(bm);
        cab.partNames.push('btn:' + k);
      });
      cab.lamps.push({ obj: 'tur', pos: V3(SF.w([0, 0.01, 0.12])), col: new THREE.Color(0x40ff60).multiplyScalar(0.22), where: 'turm' });
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
      B.add(tor(r + 0.1, 0.04, 6, det ? 32 : 16), C.pad, [hx, yr - 0.06, hz], [HP, 0, 0]);
      const n = modern ? 6 : 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2 + 0.3;
        const p = [hx + Math.sin(a) * (r + 0.02), yr - 0.1, hz + Math.cos(a) * (r + 0.02)];
        const F = new Frame(B, p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a + PI, 0)));
        F.add(rbox(0.13, 0.1, 0.08, 0.01), C.metal);
        F.add(new THREE.PlaneGeometry(0.11, 0.05), C.prism, [0, 0.005, 0.0405], null, null, true);
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
      for (let i = 0; i < 5; i++) DF.add(box(0.016, 0.012, 0.01), C.rubber, [0.112, 0.06 - i * 0.03, 0.002]);
      DF.rod(C.steel, [0, -0.1, -0.04], [0, -0.3, -0.12], 0.02);
      cab.screens.cmd = true;
      cab.lamps.push({ obj: 'tur', pos: V3(DF.w([0, 0, 0.12])), col: new THREE.Color(0x60ff80).multiplyScalar(0.16), where: 'turm' });
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
  if (!wk1) {
    // Sicherungsschalter mit Leuchte an der rechten Wand
    const sp = [1.17, l[1] - 0.12, l[2] - 0.45];
    B.add(rbox(0.06, 0.12, 0.16, 0.01), C.black, sp);
    label(B, C, 'sicher', [sp[0] - 0.0315, sp[1] + 0.1, sp[2]], [0, -HP, 0], 0.14);
    B.rod(C.steel, [sp[0] - 0.03, sp[1] - 0.02, sp[2] + 0.03], [sp[0] - 0.09, sp[1] + 0.02, sp[2] + 0.03], 0.008);
    const lp = part(grp, 'lampe:sicher', [sp[0] - 0.032, sp[1] + 0.025, sp[2] - 0.04]);
    const lm = new THREE.Mesh(cyl(0.014, 0.014, 0.012, 10).rotateZ(HP), C.lampRed); lm.name = 'lampe'; lp.add(lm);
    cab.partNames.push('lampe:sicher');
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
    const ab = [cx + Math.sign(cx) * 0.17 * sc, cy - 0.06 * sc, zc + 0.05 * sc];
    GB.add(rbox(0.14 * sc, 0.2 * sc, 0.3 * sc, 0.01), C.olive, ab);
    GB.add(box(0.15 * sc, 0.02 * sc, 0.31 * sc), C.metal, [ab[0], ab[1] + 0.105 * sc, ab[2]]);
    GB.tube(C.metal, [[ab[0] - Math.sign(cx) * 0.05 * sc, ab[1] + 0.1 * sc, ab[2]], [cx + Math.sign(cx) * 0.07 * sc, cy + 0.06 * sc, zc], [cx + Math.sign(cx) * 0.04 * sc, cy + 0.03 * sc, zc - 0.05 * sc]], 0.02 * sc, 6, 12);
    GB.add(box(0.06 * sc, 0.25 * sc, 0.08 * sc), C.metal, [cx, cy - 0.18 * sc, zc + 0.05 * sc]);
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
    harness(B, C, [[0.98, 0.71, -0.85], [1.02, 0.71, 0.0], [0.98, 0.71, 1.2], [0.6, 0.71, 1.7]], det);
    harness(B, C, [[-0.98, 0.71, -0.85], [-1.02, 0.71, 0.1], [-0.98, 0.71, 1.25]], det, 2);
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
    const fp = [0.35, 0.7, 0.75];
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
  for (const lp of lampSpots) {
    B.add(rbox(0.14, 0.04, 0.08, 0.01), C.black, lp);
    B.add(box(0.1, 0.012, 0.05), modern ? C.lampRed : C.lampWarm, [lp[0], lp[1] - 0.02, lp[2]]);
  }
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
  B.build(grp, 'turmraum');
  GB.build(gunG, 'rohrraum');
  return { tur: grp, gun: gunG };
}

/* ===================================================================== Vorlage, Anbau, Takt */

const TPL = new Map();
function eraOf(D) { return D.era === 'wk2' ? 'wk2' : D.era === 'wk1' ? 'wk1' : 'modern'; }
/** Hülse je Panzer: modern nur der Hülsenboden (verbrennbare Hülse), sonst Messinghülse (Länge, Radius in m). */
const CASE = { mbt: null, wk2: [0.36, 0.042], wk2h: [0.57, 0.052], wk1: [0.3, 0.034], wk1l: [0.2, 0.024] };

function buildTemplate(D, C, det) {
  const era = eraOf(D);
  const info = { lamps: [], screens: {}, partNames: [], driverEye: null };
  const A = anchorsOf(D);
  const t = buildTurret(D, C, det, era, info, A);
  const hull = new THREE.Group();
  hull.name = 'cabin:wanne';
  buildDriver(hull, D, C, det, era, info);
  for (const gg of [t.tur, t.gun, hull]) gg.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { tur: t.tur, gun: t.gun, hull, info, A, era };
}

/** Hülsen-/Dampf-Pool je Anbau (eigene Netze; Geometrie geteilt je Typ). */
const CASE_GEO = new Map();
function caseGeom(D) {
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
  CASE_GEO.set(D.id, g);
  return g;
}

/**
 * Detail-Innenraum an ein Fahrzeugmodell (models.js createVehicleModel) hängen – erst beim ersten Öffnen einer
 * Innensicht. → cab | null
 */
export function attachCabin(model, D, S, quality = 'high') {
  if (!model || !model.interior || !D || D.drive !== 'tracked') return null;
  const C = cabinMats(S);
  resyncMats();
  const det = quality === 'low' ? 0 : quality === 'medium' ? 1 : 2;
  const key = `${D.id}:${det}`;
  let tpl = TPL.get(key);
  if (!tpl) { tpl = buildTemplate(D, C, det); TPL.set(key, tpl); }
  const tur = tpl.tur.clone(true), gun = tpl.gun.clone(true), hull = tpl.hull.clone(true);
  model.interior.add(tur);
  if (model.gun) model.gun.add(gun);
  model.root.add(hull);
  const cab = {
    D, C, det, era: tpl.era, A: tpl.A, tur, gun, hull, model, info: tpl.info,
    needles: [], pend: [], pedals: [], parts: {}, btn: {}, lamps: tpl.info.lamps.map((l) => ({ ...l, w: new THREE.Vector3() })),
    t: 0, recoilPrev: 0, hitPrev: null, flick: 0, ejectAt: -1, casings: [], smoke: [], vel: null, acc: new THREE.Vector3(), yawPrev: null, pitchPrev: null,
    screenT: 0,
  };
  for (const gg of [tur, gun, hull]) gg.traverse((o) => {
    if (!o.name || o.isMesh) return;
    if (o.name.startsWith('zeiger:')) cab.needles.push(o);
    else if (o.name.startsWith('pendel:')) cab.pend.push(o);
    else if (o.name.startsWith('pedal:')) cab.pedals.push(o);
    else if (o.name.startsWith('btn:')) cab.btn[o.name.slice(4)] = o.children[0];
    else if (o.name.startsWith('hebel:') || o.name.startsWith('rad:') || ['gang', 'griff', 'luefter', 'lampe:sicher'].includes(o.name)) cab.parts[o.name] = o;
  });
  for (const p of cab.pend) p.userData.pend = { ax: 0, az: 0, vx: 0, vz: 0 };
  // Munitionsbunker-Tür: Warnschild fährt mit
  const door = model.interior.getObjectByName('rackDoor');
  if (door) {
    const B = new MB();
    label(B, C, 'tuer', [0.25, 0.12, -0.02], [0, PI, 0], 0.22);
    label(B, C, 'munition', [-0.25, 0.12, -0.02], [0, PI, 0], 0.22);
    B.build(door, 'tuerschild');
  } else {
    const rg = model.interior.getObjectByName('rackGrp');
    if (rg) { const B = new MB(); label(B, C, cab.era === 'modern' ? 'munition' : 'wk_munition', [0, 0.36, -0.4], [0, PI, 0], 0.22); B.build(rg, 'gestellschild'); }
  }
  // Hülsen (6) und Pulverdampf (3)
  const cg = caseGeom(D), cm = CASE[D.id] ? C.casing : C.stub;
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(cg, cm); m.visible = false; m.name = 'huelse'; tur.add(m); cab.casings.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), rest: true, t: 0 }); }
  for (let i = 0; i < 3; i++) { const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: C.smoke.map, color: 0xa29a8e, transparent: true, opacity: 0, depthWrite: false })); sm.visible = false; sm.name = 'dampf'; tur.add(sm); cab.smoke.push({ s: sm, t: 9 }); }
  setCabinVisible(cab, false);
  return cab;
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
  if (P['hebel:l']) ease(P['hebel:l'], 10, 0.38 * clamp(Math.max(0, steer) + brake * 0.8, 0, 1));
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
  // --- Lampen → Shader (Weltraum); Satz je nach Platz (Fahrerraum oder Turm)
  const where = ctx.driver ? 'fahrer' : 'turm';
  const LP = CAB_U.uCabLP.value, LCo = CAB_U.uCabLC.value;
  let k = 0;
  const f = 1 - cab.flick * (0.55 + 0.45 * Math.sin(cab.t * 63)) * 0.8;
  for (const L of cab.lamps) {
    if (L.where !== where || k >= 4) continue;
    const obj = L.obj === 'tur' ? cab.tur : L.obj === 'gun' ? cab.gun : cab.hull;
    obj.updateWorldMatrix(true, false);
    LP[k].copy(L.pos).applyMatrix4(obj.matrixWorld);
    const fl = L.flicker ? 0.82 + 0.1 * Math.sin(cab.t * 13.7) + 0.08 * Math.sin(cab.t * 31.1 + 1.3) : 1;
    LCo[k].copy(L.col).multiplyScalar(Math.max(0.1, f) * fl);
    k++;
  }
  for (; k < 4; k++) LCo[k].setRGB(0, 0, 0);
  // offene Luke in der Nähe? → mehr Tageslicht; sonst geschlossener Kasten
  CAB_U.uCabSun.value = ctx.hatchOpen ? 0.5 : 0.1;
  CAB_U.uCabAmb.value = ctx.hatchOpen ? 0.55 : 0.3;
}

/** Hülse aus dem Verschluss (Lage im Turmgruppenraum), fliegt nach hinten unten, rollt aus. */
function eject(cab) {
  const M = cab.model;
  if (!M.breech) return;
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
  const IP = [-0.46, 1.19, -0.61];
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
