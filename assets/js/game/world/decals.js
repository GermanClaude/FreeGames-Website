// NULLPUNKT — env-look: Verwitterungs-Decals an Wänden (Owner: world/env-look). Nur medium+ (low bleibt unverändert).
//
// Ein eigener kleiner Atlas (8 Zellen à 256², 1024×512 RGBA ≈ 2,8 MB GPU inkl. Mipmaps, einmal je Sitzung) mit
// Rostläufen, Wasser-/Kalkfahnen, Schmutzsockel, Rissen, Leckflecken, Plakaten, Sprühzeichen und Rußfahnen.
// Platzierung nach dem Weltaufbau per Strahltest gegen die Kugel-BVH (world.raycast): auf einem gestreuten Raster
// werden waagerechte Strahlen geschossen; senkrechte Treffer bekommen je nach Material (Container, Wellblech, Beton,
// Putz, Ziegel) ein passendes Decal, wenn die ganze Fläche des Decals auf derselben Wand liegt (4 Eckstrahlen).
// Gesät über die Kartenkennung → jedes Laden gleich. karten-voll (14.11.): zweite Atlashälfte (1024×1024) mit
// Einschüssen, MG-Garben, Splitterwurf, Brandflecken, Kreidezeichen, zweitem Plakat, Graffiti und Algensockeln. Je Zelle (64/44/32 m) ein InstancedMesh (Culling), Ausblenden
// ab ≈ 34–48 m im Shader. Höchstens 140/220/300 Decals (medium/high/ultra).
//
// placeLookDecals(world, group, { quality, seed, def }) → { count, meshes, ms }
import * as THREE from 'three';
import { streuRaster, bodenY } from './bodenauflage.js?v=20261115041504'; // fuell: Bereiche (Großkarten) + Bodenhöhe

export const LOOK_DECAL = { rust: 0, water: 1, grime: 2, cracks: 3, leak: 4, poster: 5, tag: 6, soot: 7,
  // karten-voll (14.11.): Kriegsspuren und mehr Stadtleben (zweite Atlashälfte, 1024×1024)
  einschuss: 8, splitter: 9, brand: 10, plakat: 11, graffiti: 12, garbe: 13, kreide: 14, algen: 15 };
const ROWS = 4;
const CAP = { medium: 300, high: 540, ultra: 760 }; // karten-voll: vorher 140/220/300; fuell (20.11.): vorher 180/300/420
/** Zellgröße der Instanz-Gruppen (m): größer = weniger Draw Calls, kleiner = besseres Frustum-Culling. */
const CELL = { medium: 64, high: 44, ultra: 32 };

let atlas = null;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function drawAtlas(ctx) {
  const C = 256, r = rng(4242);
  const cell = (i, fn) => { ctx.save(); ctx.translate((i % 4) * C, Math.floor(i / 4) * C); ctx.beginPath(); ctx.rect(0, 0, C, C); ctx.clip(); fn(); ctx.restore(); };
  const streaks = (n, col, a0, len0, w0, drip) => {
    for (let k = 0; k < n; k++) {
      const x = 20 + r() * 216, w = w0 * (0.4 + r()), len = len0 * (0.45 + r() * 0.55);
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, `rgba(${col},${a0})`); g.addColorStop(0.55, `rgba(${col},${a0 * 0.55})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - w / 2, 0);
      let xx = x;
      for (let y = 0; y <= len; y += 8) { xx += (r() - 0.5) * 1.6; ctx.lineTo(xx - w / 2 * (1 - y / len * 0.6), y); }
      for (let y = len; y >= 0; y -= 8) ctx.lineTo(xx + w / 2 * (1 - y / len * 0.6), y);
      ctx.closePath(); ctx.fill();
      if (drip && r() < 0.5) { ctx.fillStyle = `rgba(${col},${a0 * 0.8})`; ctx.beginPath(); ctx.arc(xx, len * 0.9, w * 0.25, 0, 7); ctx.fill(); }
    }
  };
  // 0 Rostlauf (von oben, orange-braun, Tropfnasen)
  cell(0, () => { streaks(20, '108,62,32', 0.4, 250, 8, true); streaks(12, '66,40,22', 0.36, 200, 4, true); });
  // 1 Wasser-/Kalkfahne (grau-dunkel, breit, weich)
  // tex4: helle Kalkfahnen deutlich schwächer (× 2,1 im Shader → wirkten auf dunklem Putz wie glänzende Folienstreifen)
  cell(1, () => { streaks(10, '28,28,26', 0.3, 256, 34, false); streaks(6, '190,186,176', 0.07, 200, 26, false); });
  // 2 Schmutzsockel (unten dunkel, Spritzer, nach oben auslaufend)
  cell(2, () => {
    const g = ctx.createLinearGradient(0, 256, 0, 40);
    g.addColorStop(0, 'rgba(40,34,26,0.62)'); g.addColorStop(0.35, 'rgba(52,44,34,0.32)'); g.addColorStop(1, 'rgba(52,44,34,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) { const y = 256 - Math.pow(r(), 2.2) * 150; ctx.fillStyle = `rgba(36,30,22,${0.15 + r() * 0.35})`; ctx.beginPath(); ctx.arc(r() * 256, y, 0.6 + r() * 2.2, 0, 7); ctx.fill(); }
    // seitlich weich auslaufen (Kanten unsichtbar)
    ctx.globalCompositeOperation = 'destination-in';
    const s = ctx.createLinearGradient(0, 0, 256, 0);
    s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.12, 'rgba(0,0,0,1)'); s.addColorStop(0.88, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = s; ctx.fillRect(0, 0, 256, 256);
  });
  // 3 Wandrisse (verästelt, mit hellem Kantenausbruch)
  cell(3, () => {
    ctx.lineCap = 'round';
    // tex4 (15.11.): feiner (vorher 2,2 px tiefschwarz = 1–2 cm breite „Filzstift“-Linien); Haarriss mit weichem
    // Schmutzsaum und hellem Kantenausbruch daneben, Breite schwankt entlang des Risses
    const pts = [];
    const crack = (x, y, a, len, w) => {
      const path = [[x, y, w]];
      for (let i = 0; i < len; i++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 4; y += Math.sin(a) * 4; path.push([x, y, w * (0.6 + r() * 0.5)]); if (r() < 0.07 && w > 0.5) crack(x, y, a + (r() - 0.5) * 2.2, len * 0.45, w * 0.6); }
      pts.push(path);
    };
    crack(128, 18, Math.PI / 2 + 0.2, 44, 1.25); crack(128, 128, 0.3, 22, 0.9);
    const draw = (col, k, dx, dy) => { for (const path of pts) for (let i = 1; i < path.length; i++) { ctx.strokeStyle = col; ctx.lineWidth = path[i][2] * k; ctx.beginPath(); ctx.moveTo(path[i - 1][0] + dx, path[i - 1][1] + dy); ctx.lineTo(path[i][0] + dx, path[i][1] + dy); ctx.stroke(); } };
    draw('rgba(40,34,28,0.16)', 4.5, 0, 1.5);   // Schmutzsaum (Wasser zieht in den Riss)
    draw('rgba(236,230,218,0.35)', 1.2, -0.9, -0.9); // Kantenausbruch hell
    draw('rgba(22,19,16,0.72)', 1, 0, 0);
  });
  // 4 Leckfleck (dunkler Fleck mit Läufen nach unten)
  cell(4, () => {
    for (let i = 0; i < 9; i++) { const x = 128 + (r() - 0.5) * 90, y = 50 + (r() - 0.5) * 40, rr = 30 + r() * 40; const g = ctx.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, 'rgba(30,28,24,0.38)'); g.addColorStop(1, 'rgba(30,28,24,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256); }
    ctx.save(); ctx.translate(40, 50); ctx.scale(0.7, 0.8); streaks(8, '30,28,24', 0.4, 240, 14, true); ctx.restore();
  });
  // 5 Plakat (verblichen, eingerissen; Text ohne echte Marken)
  cell(5, () => {
    ctx.fillStyle = '#d9cfb8'; ctx.fillRect(28, 14, 200, 228);
    ctx.fillStyle = '#9c3b2a'; ctx.fillRect(40, 28, 176, 64);
    ctx.fillStyle = '#efe6d2'; ctx.font = '700 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ZUTRITT', 128, 72);
    ctx.fillStyle = '#3b3a36'; for (let i = 0; i < 9; i++) ctx.fillRect(44, 112 + i * 13, 120 + r() * 50, 6);
    ctx.fillStyle = '#2d4a63'; ctx.fillRect(40, 220 - 18, 176, 14);
    // Verwitterung: ausgebleicht, Ränder eingerissen, Flecken
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.5 + r() * 0.5; ctx.beginPath(); const e = r() < 0.5; ctx.arc(e ? (r() < 0.5 ? 28 : 228) + (r() - 0.5) * 16 : 28 + r() * 200, e ? 14 + r() * 228 : (r() < 0.5 ? 14 : 242) + (r() - 0.5) * 16, 3 + r() * 10, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(150, 242); ctx.lineTo(228, 150); ctx.lineTo(228, 242); ctx.fill();
    ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 1;
    for (let i = 0; i < 12; i++) { const x = r() * 256, y = r() * 256, rr = 20 + r() * 50; const g = ctx.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, 'rgba(80,66,44,0.35)'); g.addColorStop(1, 'rgba(80,66,44,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256); }
  });
  // 6 Sprühzeichen (Schablonen-Nummer + Pfeil, übergesprüht)
  cell(6, () => {
    ctx.fillStyle = 'rgba(240,236,226,0.82)'; ctx.font = '700 92px monospace'; ctx.textAlign = 'center'; ctx.fillText('B7', 128, 130);
    ctx.fillRect(64, 160, 110, 16); ctx.beginPath(); ctx.moveTo(170, 145); ctx.lineTo(210, 168); ctx.lineTo(170, 191); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 500; i++) { ctx.globalAlpha = r() * 0.6; ctx.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); }
  });
  // 7 Rußfahne (Brand-/Abgasspur, nach oben breiter)
  cell(7, () => {
    for (let i = 0; i < 14; i++) { const y = 256 - i * 16, x = 128 + (r() - 0.5) * 30, rr = 30 + i * 6; const g = ctx.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(14,12,10,${0.28 - i * 0.012})`); g.addColorStop(1, 'rgba(14,12,10,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256); }
  });
  // --- karten-voll (14.11.): zweite Atlashälfte ---
  // Einschuss: Loch mit dunklem Kanal, hellem Abplatzkrater und Splitterstrahlen
  const hole = (x, y, rr) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 3.2);
    g.addColorStop(0, 'rgba(232,226,212,0.75)'); g.addColorStop(0.45, 'rgba(210,202,186,0.45)'); g.addColorStop(1, 'rgba(210,202,186,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr * 3.2, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(40,36,30,0.5)'; ctx.lineWidth = 0.8;
    for (let k = 0; k < 7; k++) { const a = r() * 7, l = rr * (1.4 + r() * 2.4); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
    const h = ctx.createRadialGradient(x, y, 0, x, y, rr * 1.25);
    h.addColorStop(0, 'rgba(8,7,6,1)'); h.addColorStop(0.7, 'rgba(22,20,18,0.95)'); h.addColorStop(1, 'rgba(60,54,46,0)');
    ctx.fillStyle = h; ctx.beginPath(); ctx.arc(x, y, rr * 1.25, 0, 7); ctx.fill();
  };
  cell(8, () => { for (let i = 0; i < 9; i++) hole(128 + (r() - 0.5) * 150, 128 + (r() - 0.5) * 150, 3.5 + r() * 3); });
  // Splitterwurf: viele kleine Krater, nach außen dünner
  cell(9, () => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 120); g.addColorStop(0, 'rgba(20,18,16,0.35)'); g.addColorStop(1, 'rgba(20,18,16,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) { const a = r() * 7, d = Math.pow(r(), 0.7) * 118; hole(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 0.8 + r() * 2.2 * (1 - d / 140)); }
  });
  // Brandfleck (Explosion/Feuer): schwarzer Kern, verrußter Rand, nach oben gezogen
  cell(10, () => {
    for (let i = 0; i < 16; i++) { const x = 128 + (r() - 0.5) * 60, y = 150 - r() * 90, rr = 40 + r() * 60; const g = ctx.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(10,9,8,${0.3 + r() * 0.25})`); g.addColorStop(1, 'rgba(10,9,8,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256); }
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 160; i++) { ctx.globalAlpha = r() * 0.4; ctx.beginPath(); ctx.arc(r() * 256, r() * 256, 1 + r() * 4, 0, 7); ctx.fill(); }
  });
  // Plakat 2 (Veranstaltung, frei erfunden) – verblichen, halb abgerissen
  cell(11, () => {
    ctx.fillStyle = '#e6dcc0'; ctx.fillRect(34, 10, 190, 236);
    ctx.fillStyle = '#2d5a6a'; ctx.fillRect(34, 10, 190, 120);
    ctx.fillStyle = '#f0c040'; ctx.beginPath(); ctx.arc(128, 70, 40, 0, 7); ctx.fill();
    ctx.fillStyle = '#1e2a30'; ctx.font = '700 30px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SOMMERFEST', 128, 162);
    ctx.font = '600 18px sans-serif'; ctx.fillText('AM BRUNNEN · 20 UHR', 128, 190);
    ctx.fillStyle = '#7a2a20'; ctx.fillRect(54, 210, 150, 14);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.moveTo(34, 160); ctx.lineTo(90, 246); ctx.lineTo(34, 246); ctx.fill();
    for (let i = 0; i < 50; i++) { ctx.globalAlpha = 0.4 + r() * 0.6; ctx.beginPath(); ctx.arc(34 + r() * 190, r() < 0.5 ? 10 : 246, 3 + r() * 9, 0, 7); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 1;
    for (let i = 0; i < 10; i++) { const x = r() * 256, y = r() * 256, rr = 20 + r() * 50; const g = ctx.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, 'rgba(90,76,50,0.35)'); g.addColorStop(1, 'rgba(90,76,50,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256); }
  });
  // Graffiti: freihändige Schriftzüge (Kringel, keine echten Zeichen/Marken)
  cell(12, () => {
    // tex4 (15.11.): Sprühdose statt Comic-Zickzack – erfundene, schnell gesprühte Buchstabenzüge (keine echten Zeichen)
    // mit weichem Sprühnebel (Unschärfe), Laufnasen, verblasst und teils übergestrichen
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // ein durchgehender, schnell gesprühter Schriftzug (Schleifen/Haken, keine echten Buchstaben), dünn, ohne Kontur
    const pts = [];
    let x = 26, y = 130;
    for (let g = 0; g < 7; g++) {
      const up = 40 + r() * 40, loop = r() < 0.5;
      pts.push([x + 6, y - up], [x + 12 + (loop ? 10 : 0), y - up * (loop ? 0.6 : 0.2)], [x + 18, y + 6 + r() * 10]);
      x += 26 + r() * 6;
    }
    const hue = r() < 0.5 ? '44,46,54' : (r() < 0.5 ? '150,58,48' : '52,78,110');
    ctx.strokeStyle = `rgba(${hue},0.75)`; ctx.lineWidth = 4.5; ctx.shadowColor = `rgba(${hue},0.6)`; ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.moveTo(26, 130);
    for (let i = 0; i + 1 < pts.length; i += 2) ctx.quadraticCurveTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    ctx.stroke(); ctx.shadowBlur = 0;
    // Unterstrich + Laufnasen
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(30, 150); ctx.quadraticCurveTo(120, 160, x, 146); ctx.stroke();
    for (let k = 0; k < 5; k++) { const qx = 30 + r() * (x - 30), qy = 120 + r() * 30, len = 8 + r() * 26; const g2 = ctx.createLinearGradient(0, qy, 0, qy + len); g2.addColorStop(0, `rgba(${hue},0.5)`); g2.addColorStop(1, `rgba(${hue},0)`); ctx.fillStyle = g2; ctx.fillRect(qx - 0.8, qy, 1.6, len); }
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 900; i++) { ctx.globalAlpha = r() * 0.55; ctx.fillRect(r() * 256, r() * 256, 1 + r() * 2.5, 1 + r() * 2.5); } // abgewittert
    ctx.globalAlpha = 0.35; ctx.fillRect(0, 150 + r() * 40, 256, 60); // teils überstrichen/verblasst
  });
  // MG-Garbe: Einschussreihe schräg über die Wand
  cell(13, () => { for (let i = 0; i < 12; i++) hole(20 + i * 19 + (r() - 0.5) * 8, 170 - i * 9 + (r() - 0.5) * 18, 3 + r() * 2.5); });
  // Kreidemarkierung (Durchsuchungszeichen: Kreuz im Kreis, Strich, Pfeil)
  cell(14, () => {
    ctx.strokeStyle = 'rgba(238,236,228,0.85)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(110, 110, 62, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(66, 66); ctx.lineTo(154, 154); ctx.moveTo(154, 66); ctx.lineTo(66, 154); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60, 214); ctx.lineTo(200, 214); ctx.lineTo(182, 198); ctx.moveTo(200, 214); ctx.lineTo(182, 230); ctx.stroke();
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 600; i++) { ctx.globalAlpha = r() * 0.6; ctx.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1); }
  });
  // Algen/Moos vom Boden aufsteigend (feuchte Sockel)
  cell(15, () => {
    const g = ctx.createLinearGradient(0, 256, 0, 60); g.addColorStop(0, 'rgba(52,70,34,0.6)'); g.addColorStop(0.5, 'rgba(60,76,40,0.28)'); g.addColorStop(1, 'rgba(60,76,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 300; i++) { const y = 256 - Math.pow(r(), 1.8) * 170; ctx.fillStyle = `rgba(${40 + r() * 30},${60 + r() * 30},${24 + r() * 16},${0.15 + r() * 0.35})`; ctx.beginPath(); ctx.arc(r() * 256, y, 1 + r() * 4, 0, 7); ctx.fill(); }
    ctx.globalCompositeOperation = 'destination-in';
    const s = ctx.createLinearGradient(0, 0, 256, 0); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.15, 'rgba(0,0,0,1)'); s.addColorStop(0.85, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = s; ctx.fillRect(0, 0, 256, 256);
  });
}

function getAtlas() {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256 * ROWS;
  drawAtlas(c.getContext('2d'));
  atlas = new THREE.CanvasTexture(c);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  atlas.name = 'np:look-decals';
  return atlas;
}

function decalMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: getAtlas(), transparent: true, depthWrite: false, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  m.name = 'look-decals';
  m.userData.disposable = true; m.userData.surface = 'concrete';
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = aCell.xy + uv * aCell.zw;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      // Atlas ist weich gezeichnet (mittlere Deckung 0,1–0,2) → Verstärkung, sonst verschwinden die Läufe auf dunklen Wänden
      diffuseColor.a = clamp( diffuseColor.a * 2.1, 0.0, 1.0 ) * ( 1.0 - smoothstep( 34.0, 48.0, length( vViewPosition ) ) );`);
  };
  m.customProgramCacheKey = () => 'np-look-decals-v2';
  return m;
}

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _bx = new THREE.Vector3(), _by = new THREE.Vector3();
const _col = new THREE.Color();

/** Welches Decal passt zu einer Wand? → [Zelle, Breite, Höhe, Mittenhöhe über Boden] | null */
/** fuell (20.11.): Anteil Kriegsspuren je Karte (ohne def.lookDecals.krieg). */
const KRIEG = { stadtkern: 0.34, niemandsland: 0.5, brandwald: 0.42, grenzland: 0.2, flugplatz: 0.18, werk: 0.13, hafen: 0.1, altstadt: 0.12, range: 0.04, bibliothek: 0.02 };
function pick(name, r, krieg = 0.12) {
  const n = name || '';
  // gesamt 20.11.: nie auf Scheiben (Schaufenster Stadtkern: Einschuss/Kreide schwebte als heller Fleck auf dem Glas)
  if (/glass|glas|fenster|window/i.test(n)) return null;
  // karten-voll: Kriegsspuren (Einschüsse, Garben, Splitter, Brand) an festen Wänden – Anteil je Karte (def.lookDecals.krieg)
  if (!/container/.test(n) && r() < krieg) {
    const w = r();
    return w < 0.4 ? [LOOK_DECAL.einschuss, 0.7 + r() * 0.6, 0.7 + r() * 0.6, 1.0 + r() * 1.2] : w < 0.62 ? [LOOK_DECAL.garbe, 1.4 + r() * 0.8, 0.9 + r() * 0.4, 1.3 + r() * 0.6]
      : w < 0.82 ? [LOOK_DECAL.splitter, 1.2 + r() * 0.9, 1.2 + r() * 0.9, 1.0 + r() * 0.8] : w < 0.93 ? [LOOK_DECAL.brand, 1.6 + r() * 1.2, 1.8 + r() * 1.2, 1.4] : [LOOK_DECAL.kreide, 0.8, 0.8, 1.5];
  }
  if (/plaster|brick|stone/.test(n) && r() < 0.18) {
    const w = r();
    return w < 0.35 ? [LOOK_DECAL.plakat, 0.62, 0.8, 1.55] : w < 0.7 ? [LOOK_DECAL.graffiti, 1.4 + r() * 0.8, 0.8 + r() * 0.3, 1.2 + r() * 0.4] : [LOOK_DECAL.algen, 1.6 + r() * 1.6, 0.8, 0.4];
  }
  const k = r();
  if (/container/.test(n)) return k < 0.65 ? [LOOK_DECAL.rust, 0.5 + r() * 0.8, 1.0 + r() * 0.9, 2.59 - 0.5] : k < 0.85 ? [LOOK_DECAL.water, 0.8 + r(), 1.4 + r(), 1.6] : [LOOK_DECAL.tag, 0.9, 0.9, 1.3 + r() * 0.4];
  if (/corrugated|cladding|shutter|metal_rust/.test(n)) return k < 0.55 ? [LOOK_DECAL.rust, 0.6 + r() * 0.9, 1.2 + r() * 1.2, 2.2] : k < 0.8 ? [LOOK_DECAL.grime, 1.6 + r() * 1.6, 0.7, 0.35] : [LOOK_DECAL.water, 1 + r(), 1.6 + r(), 1.8];
  if (/brick/.test(n)) return k < 0.4 ? [LOOK_DECAL.grime, 1.8 + r() * 2, 0.8, 0.4] : k < 0.65 ? [LOOK_DECAL.water, 0.9 + r() * 1.2, 1.8 + r() * 1.4, 2.0] : k < 0.8 ? [LOOK_DECAL.soot, 1.0 + r() * 0.8, 1.6 + r(), 1.9] : k < 0.92 ? [LOOK_DECAL.leak, 0.9, 1.2, 1.9] : [LOOK_DECAL.poster, 0.62, 0.8, 1.55];
  if (/concrete|plaster|stone|panel/.test(n)) return k < 0.35 ? [LOOK_DECAL.grime, 1.8 + r() * 2, 0.8, 0.4] : k < 0.55 ? [LOOK_DECAL.water, 0.9 + r() * 1.3, 1.8 + r() * 1.4, 2.0] : k < 0.7 ? [LOOK_DECAL.cracks, 0.9 + r() * 0.8, 0.9 + r() * 0.8, 1.2 + r()] : k < 0.82 ? [LOOK_DECAL.leak, 1.0, 1.3, 1.9] : k < 0.93 ? [LOOK_DECAL.poster, 0.62, 0.8, 1.55] : [LOOK_DECAL.tag, 0.9, 0.9, 1.4];
  return null;
}

export function placeLookDecals(world, group, { quality = 'high', seed = 1, def = {} } = {}) {
  const t0 = performance.now();
  let cap = CAP[quality] || 0;
  if (!cap || !world?.raycast || !world.bounds) return { count: 0, meshes: 0, ms: 0 };
  const opt = def.lookDecals || {};
  const density = opt.density ?? 1;
  const r = rng(seed);
  const step = (opt.step ?? 1.9) / Math.sqrt(density); // fuell (20.11.): vorher 2,6 m – auf dem Hafen kamen nur 59 Decals zustande
  const items = [];
  const taken = new Map(); // grobe Belegung (0,8 m) gegen Häufungen
  const key = (x, y, z) => `${Math.round(x / 0.8)}|${Math.round(y / 0.8)}|${Math.round(z / 0.8)}`;
  // gemischte Reihenfolge → bei Kappung gleichmäßig über die Karte verteilt; fuell: Großkarten nur in opt.bereiche
  const { cells, flaeche } = streuRaster(world, opt.bereiche, step, r);
  cap = Math.round(cap * flaeche * (opt.cap ?? 1));
  for (const [x, z] of cells) {
    if (items.length >= cap) break;
    const gy = bodenY(world, x, z);
    if (gy == null) continue;
    const a = r() * Math.PI * 2;
    _o.set(x, gy + 1.1, z); _d.set(Math.cos(a), 0, Math.sin(a));
    const h = world.raycast(_o, _d, 5.5); // fuell: vorher 3,2 m
    if (!h || Math.abs(h.normal.y) > 0.12 || h.distance < 0.25) continue;
    if (h.surface === 'glass') continue; // gesamt 20.11.: keine Decals auf Scheiben
    const name = h.object?.name || h.object?.material?.name || h.surface || '';
    const sel = pick(name, r, opt.krieg ?? KRIEG[def.id] ?? 0.12);
    if (!sel) continue;
    let [cell, w, hh, cy] = sel;
    // Normale zur Strahlquelle drehen (die BVH liefert die Dreiecksnormale ohne Ausrichtung)
    _n.copy(h.normal).setY(0).normalize();
    if (_n.dot(_d) > 0) _n.negate();
    _t.set(-_n.z, 0, _n.x); // waagerecht entlang der Wand
    const baseY = gy;
    // Container: Rost von der Oberkante (Höhe aus Strahl nach oben suchen wäre teuer → Containerhöhe)
    let py = baseY + cy;
    if (cell === LOOK_DECAL.rust || cell === LOOK_DECAL.water || cell === LOOK_DECAL.soot || cell === LOOK_DECAL.leak) py = baseY + cy - hh / 2 + 0.3;
    if (cell === LOOK_DECAL.grime || cell === LOOK_DECAL.algen) py = baseY + hh / 2 - 0.02;
    _p.copy(h.point).setY(py);
    const k = key(_p.x, _p.y, _p.z);
    if (taken.has(k)) continue;
    // ganze Decal-Fläche auf derselben Wand? (4 Ecken + Mitte, Strahl gegen die Normale)
    let ok = true;
    for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      _o.copy(_p).addScaledVector(_t, u * w).addScaledVector(_n, 0.15); _o.y += v * hh;
      _d.copy(_n).negate();
      const c = world.raycast(_o, _d, 0.4);
      if (!c || c.surface === 'glass' || Math.abs(c.distance - 0.15) > 0.06 || Math.abs(c.normal.dot(_n)) < 0.95) { ok = false; break; }
    }
    if (!ok) continue;
    taken.set(k, 1);
    items.push({ x: _p.x + _n.x * 0.012, y: _p.y, z: _p.z + _n.z * 0.012, nx: _n.x, nz: _n.z, w, h: hh, cell, tint: 0.82 + r() * 0.3 });
  }
  if (!items.length) return { count: 0, meshes: 0, ms: Math.round(performance.now() - t0) };
  // je Zelle ein InstancedMesh (Frustum-Culling)
  const byCell = new Map();
  const cs = CELL[quality] || 44;
  for (const it of items) { const ck = `${Math.floor(it.x / cs)}|${Math.floor(it.z / cs)}`; if (!byCell.has(ck)) byCell.set(ck, []); byCell.get(ck).push(it); }
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = decalMaterial();
  let meshes = 0;
  for (const list of byCell.values()) {
    const g = geo.clone();
    const cellAttr = new Float32Array(list.length * 4);
    const mesh = new THREE.InstancedMesh(g, mat, list.length);
    list.forEach((it, i) => {
      // Ebene: +Z = Wandnormale
      // rechtshändige Basis (x = up × n): sonst Spiegelung → Rückseite zur Kamera, Decal unsichtbar
      _bx.set(it.nz, 0, -it.nx); _by.set(0, 1, 0); _n.set(it.nx, 0, it.nz);
      _m.makeBasis(_bx, _by, _n); _q.setFromRotationMatrix(_m);
      _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.w, it.h, 1));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _col.setScalar(it.tint));
      cellAttr.set([(it.cell % 4) * 0.25, (ROWS - 1 - Math.floor(it.cell / 4)) / ROWS, 0.25, 1 / ROWS], i * 4);
    });
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellAttr, 4));
    mesh.computeBoundingSphere();
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = 2;
    mesh.name = 'look-decals';
    group.add(mesh);
    meshes++;
  }
  geo.dispose();
  return { count: items.length, meshes, ms: Math.round(performance.now() - t0) };
}
