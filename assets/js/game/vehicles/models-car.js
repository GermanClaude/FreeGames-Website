// NULLPUNKT — Detailkarosserie der Limousine/Kombi/Fließheck (Nutzer 14.11.: „Autos sehen absolut vereinfacht aus“).
//
// Nur medium+ (K.HQ) und nur Nahstufen 0/1 – low und die Fernstufe 2 behalten die bisherige Profil-Extrusion aus
// models-civil.js (Dreiecke auf dem Handy unverändert). Geometrie aus bodykit.js:
//   Unterbau als Querschnitts-Loft (Vorderwagen und Heck geschlossen, Kabine als offenes U mit Wandstärke – innen sichtbar),
//   Radläufe mit Radhausschalen und Lippe, Dachaufbau mit gewölbter Front-/Heckscheibe, Seitenscheiben in der eingezogenen
//   Flanke, A/B/C(/D)-Säulen, Dach als Platte mit Himmel innen, Fenstergummis, Tür-/Hauben-/Klappenfugen, Türgriffe,
//   Spiegel, Scheinwerfer (Gehäuse, Projektoren, Tagfahrlicht-Leiste), Grill mit Lamellen, Kennzeichen (erfunden), Rück-
//   leuchten, Nebelschlussleuchte, Wischer, Haifischantenne, Tankklappe, Unterboden mit Auspuffanlage, Achsen.
// Bauform je Variante (Lack bleibt variant % 8): Stufenheck, Kombi, Fließheck – gleiche Maße/Kollision/Sitze (data.js).
//
// pkwBodyHQ(K, S, B, GB, LB, lod, paint, variant) füllt die Buckets (Lack/Kleinteile B, Glas GB, Scheinwerfer LB).
import * as THREE from 'three';
import { bodyLoft, curve, withArches, sideX, surface, ribbon, tube, roundPlate, merge } from './bodykit.js?v=20261114060746';

const PI = Math.PI, HP = PI / 2;
const lerp = (a, b, t) => a + (b - a) * t;

/** Bauform aus der Variante (entkoppelt von der Farbe): 0 Stufenheck, 1 Kombi, 2 Fließheck. */
export const pkwStyle = (variant) => [0, 1, 2, 0, 2, 1, 0, 1][(variant | 0) % 8];

/* ------------------------------------------------------------------ Kennzeichen (erfunden) */

const PLATES = new Map();
/** Kennzeichen-Material je Variante: weißes Schild, blauer Länderstreifen „NP“, frei erfundene Kennung. */
export function plateMaterial(variant, S) {
  const k = (variant | 0) % 8;
  if (PLATES.has(k)) return PLATES.get(k);
  let m = S.plate;
  try {
    const c = document.createElement('canvas'); c.width = 256; c.height = 56;
    const g = c.getContext('2d');
    g.fillStyle = '#ecebe4'; g.fillRect(0, 0, 256, 56);
    g.strokeStyle = '#1b1b1b'; g.lineWidth = 3; g.strokeRect(2.5, 2.5, 251, 51);
    g.fillStyle = '#23409a'; g.fillRect(4, 4, 26, 48);
    g.fillStyle = '#f2d24a';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; g.beginPath(); g.arc(17 + Math.cos(a) * 7, 19 + Math.sin(a) * 7, 1.3, 0, 7); g.fill(); }
    g.fillStyle = '#ffffff'; g.font = '700 13px sans-serif'; g.textAlign = 'center'; g.fillText('NP', 17, 46);
    const towns = ['LH', 'GR', 'AS', 'HF', 'BW', 'SK', 'NL', 'FP'];
    const num = String(1000 + ((k * 2753 + 417) % 8999));
    g.fillStyle = '#141414'; g.font = '700 34px monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(`${towns[k]}·${'KMRTZ'[k % 5]} ${num}`, 38, 30);
    // Plakette + leichter Schmutz
    g.fillStyle = '#7a8a3a'; g.beginPath(); g.arc(112, 28, 6, 0, 7); g.fill();
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(90,80,60,${Math.random() * 0.08})`; g.fillRect(Math.random() * 256, 30 + Math.random() * 26, 2 + Math.random() * 6, 1 + Math.random() * 3); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    m = new THREE.MeshStandardMaterial({ name: `veh:kennzeichen${k}`, map: t, roughness: 0.42, metalness: 0.15 });
  } catch { /* ohne DOM: einfarbig */ }
  PLATES.set(k, m);
  return m;
}

/** Kennzeichenplatte mit UV 0…1 (Material mit Textur), Mitte p, Normale ±z. */
function plateGeom(w, h, back) {
  const g = new THREE.PlaneGeometry(w, h);
  if (back) g.rotateY(PI);
  return g;
}

/* ------------------------------------------------------------------ Form */

function shapeOf(style) {
  const arches = [{ z: -1.38, y: 0.32, R: 0.385 }, { z: 1.43, y: 0.32, R: 0.385 }];
  const yb = withArches(curve([[-2.36, 0.34], [-2.33, 0.315], [-2.2, 0.3], [-1.9, 0.295], [1.95, 0.295], [2.22, 0.33], [2.32, 0.39], [2.36, 0.44]]), arches);
  const ys = curve([[-2.36, 0.7], [-2.33, 0.745], [-2.25, 0.775], [-1.6, 0.83], [-1.0, 0.895], [0, 0.94], [1.0, 0.965], [1.8, 0.975], [2.3, 0.95], [2.34, 0.92], [2.36, 0.88]]);
  const hood = curve([[-2.36, 0.745], [-2.33, 0.79], [-2.25, 0.818], [-1.6, 0.878], [-1.0, 0.935]]);
  const trunk = style === 1
    ? curve([[1.0, 1.0], [2.2, 1.015], [2.3, 1.0], [2.34, 0.97], [2.36, 0.92]])
    : curve([[1.0, 1.0], [1.8, 1.025], [2.2, 1.01], [2.3, 0.99], [2.34, 0.965], [2.36, 0.92]]);
  const w = curve([[-2.36, 0.79], [-2.33, 0.845], [-2.25, 0.875], [-1.9, 0.895], [-1.4, 0.9], [1.5, 0.9], [2.1, 0.89], [2.3, 0.85], [2.36, 0.8]]);
  const at = (z) => {
    const ww = w(z), cab = z > -1.0 && z < 1.05;
    return {
      yb: yb(z), ys: ys(z), yt: z < 0 ? hood(z) : trunk(z), w: ww, wt: ww - (cab ? 0.052 : 0.035),
      rb: 0.075, rs: 0.09, crown: z < 0 ? 0.028 : 0.02, bulge: 0.012,
    };
  };
  // Dachaufbau: Seitenlinie (Gürtel → Dach), z der Scheibenkanten
  const G = {
    zA0: -0.975, zA1: -0.26, yR: 1.425,
    zC1: style === 1 ? 2.07 : style === 2 ? 0.72 : 0.96,
    zC0: style === 1 ? 2.27 : style === 2 ? 2.12 : 1.74,
    yRe: style === 1 ? 1.395 : 1.41,
    zB: 0.08, xr: 0.655,
  };
  G.top = (z) => {
    if (z <= G.zA0) return ys(z) + 0.0;
    if (z < G.zA1) { const t = (z - G.zA0) / (G.zA1 - G.zA0); return lerp(hood(G.zA0) + 0.01, G.yR, Math.sin(t * HP) ** 0.85); }
    if (z <= G.zC1) return lerp(G.yR, G.yRe, (z - G.zA1) / (G.zC1 - G.zA1)) + Math.sin(((z - G.zA1) / (G.zC1 - G.zA1)) * PI) * 0.012;
    if (z < G.zC0) { const t = (z - G.zC1) / (G.zC0 - G.zC1); return lerp(G.yRe, trunk(G.zC0) + 0.005, style === 1 ? t : 1 - Math.cos(t * HP) ** 0.8); }
    return trunk(z);
  };
  return { at, ys, hood, trunk, yb, w, G, arches };
}

/** Dachaufbau-Punkt: z, t ∈ [−1, 1] (−1 linker Gürtel, ±0,5 Dachkante, 0 Mitte). */
function ghPoint(S, z, t) {
  const { at, G } = S;
  const st = at(z), yB = st.ys, top = Math.max(G.top(z), yB + 0.002);
  const xb = st.wt - 0.012, sg = t < 0 ? -1 : 1, a = Math.abs(t);
  // Dachkante zieht zu den Scheiben hin leicht ein (Draufsicht gerundet)
  const xr = Math.min(xb - 0.02, G.xr - (z < G.zA1 ? (G.zA1 - z) * 0.09 : 0) - (z > G.zC1 ? (z - G.zC1) * 0.06 : 0));
  if (a >= 0.5) {
    const s = (1 - a) / 0.5;
    return [sg * (lerp(xb, xr, s) + Math.sin(s * PI) * 0.018), lerp(yB, top, s), z];
  }
  const q = a / 0.5;
  return [sg * xr * q, top + 0.03 * (1 - q * q) * Math.min(1, (top - yB) / 0.2), z];
}

/* ------------------------------------------------------------------ Aufbau */

export function pkwBodyHQ(K, S, B, GB, LB, lod, paint, variant) {
  const style = pkwStyle(variant);
  const SH = shapeOf(style), { at, G } = SH;
  const fine = lod === 0 && K.DET >= 2, q = fine ? 4 : 2, dz = fine ? 0.05 : 0.11;
  const zsOf = (a, b, step, dense = []) => {
    const s = new Set();
    for (let z = a; z < b - 1e-4; z += step) s.add(+z.toFixed(4));
    s.add(b);
    for (const d of dense) if (d > a && d < b) s.add(d);
    // Radläufe fein abtasten
    for (const ar of SH.arches) for (let k = -10; k <= 10; k++) { const z = ar.z + (k / 10) * ar.R * 1.02; if (z > a && z < b) s.add(+z.toFixed(4)); }
    return [...s].sort((x, y) => x - y);
  };
  const nose = fine ? [-2.355, -2.345, -2.33, -2.31, -2.28, -2.24] : [-2.34, -2.3, -2.24];
  const tail = fine ? [2.25, 2.29, 2.32, 2.34, 2.35, 2.355] : [2.28, 2.33, 2.35];
  // Unterbau: Vorderwagen (geschlossen), Kabine (U), Heck (geschlossen)
  B.add(bodyLoft(zsOf(-2.36, -0.99, dz, nose), at, { q }), paint);
  B.add(bodyLoft(zsOf(-0.99, 1.05, dz * 1.6), at, { q, open: true, thick: 0.045 }), paint);
  B.add(bodyLoft(zsOf(1.05, 2.36, dz, tail), at, { q }), paint);

  // Türverkleidungen innen (vor der Innenhaut des Kabinen-U)
  for (const sx of [-1, 1]) {
    B.add(K.box(0.018, 0.44, 1.96), S.trim, [sx * 0.79, 0.62, 0.03]);
    if (fine) for (const z of [-0.45, 0.55]) B.add(K.box(0.03, 0.03, 0.12), S.chrome, [sx * 0.776, 0.86, z]); // Türöffner
  }
    // Radhausschalen (dunkel, innen sichtbar) + Lippe
  for (const ar of SH.arches) for (const sx of [-1, 1]) {
    const g = new THREE.CylinderGeometry(ar.R - 0.005, ar.R - 0.005, 0.34, fine ? 20 : 10, 1, true, 0, PI);
    const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.computeVertexNormals();
    B.add(g, S.plastic, [sx * 0.72, ar.y, ar.z], [0, 0, HP]);
    if (fine) {
      const lip = new THREE.TorusGeometry(ar.R + 0.004, 0.011, 4, 20, PI);
      const st = at(ar.z);
      B.add(lip, paint, [sx * (st.w - 0.006), ar.y, ar.z], [0, sx * HP, 0]);
    }
  }

  // Dachaufbau
  const zr = [G.zA0, G.zA1, G.zC1, G.zC0];
  const ghSurf = (z0, z1, t0, t1, nu, nv, thick, flip = false) => surface((u, v) => ghPoint(SH, lerp(z0, z1, v), lerp(t0, t1, u)), nu, nv, { thick, flip });
  const nz = fine ? 10 : 4, nt = fine ? 12 : 6;
  // Front-/Heckscheibe (Glas), Dach (Lack, Platte) mit Himmel
  GB.add(ghSurf(zr[0] + 0.03, zr[1], -0.5, 0.5, nt, nz, 0.006), S.glass);
  GB.add(ghSurf(zr[2], zr[3] - 0.03, -0.5, 0.5, nt, nz, 0.006), S.glass);
  B.add(ghSurf(zr[1] - 0.01, zr[2] + 0.01, -0.5, 0.5, nt, fine ? 8 : 3, 0.028), paint);
  // Seiten: Glas zwischen den Säulen, Säulen als Platten
  const zB = G.zB, zCg = style === 1 ? 1.06 : style === 2 ? Math.min(1.0, G.zC0 - 0.75) : G.zC1 + 0.02;
  for (const sg of [-1, 1]) {
    const T = (a) => sg * a;
    const side = (z0, z1, mat, bucket, thick, nu = fine ? 3 : 1, nv = fine ? 6 : 2) => {
      // Seitenstreifen |t| ∈ [0.5, 1]: Scheiben folgen der A-Säule bzw. Heckscheibe (dort keine Höhe)
      bucket.add(surface((u, v) => ghPoint(SH, lerp(z0, z1, v), T(lerp(1, 0.5, u))), nu, nv, { thick, flip: sg < 0 }), mat);
    };
    side(zr[0] + 0.03, zB - 0.045, S.glass, GB, 0.005);
    side(zB + 0.045, zCg - 0.03, S.glass, GB, 0.005);
    side(zB - 0.045, zB + 0.045, S.plastic, B, 0.03, 1, 2);                                  // B-Säule (schwarz)
    if (style === 1) {
      side(zCg - 0.03, 1.11, paint, B, 0.03, 1, 1);                                                 // C-Säule (schmal)
      side(1.11, 1.98, S.glass, GB, 0.005);                                                     // Seitenfenster hinten
      side(1.98, zr[3], paint, B, 0.03, 2, 3);                                                  // D-Säule
    } else if (style === 2) {
      side(zCg - 0.03, zCg + 0.06, paint, B, 0.03, 1, 1);                                        // C-Säule (schmal)
      side(zCg + 0.06, 1.62, S.glass, GB, 0.005);                                               // Dreiecksfenster hinten
      side(1.62, zr[3], paint, B, 0.03, 2, fine ? 6 : 2);
    } else side(zCg - 0.03, zr[3], paint, B, 0.03, 2, fine ? 6 : 2);                             // C-Säule
    // A-Säule + Dachkante (Profilleisten), Fenstergummis
    const edge = (z0, z1, t, n) => { const pts = []; for (let i = 0; i <= n; i++) pts.push(ghPoint(SH, lerp(z0, z1, i / n), t)); return pts; };
    B.add(tube(edge(zr[0], zr[1], T(0.5), fine ? 8 : 3), 0.03, fine ? 6 : 4, 2), paint);
    B.add(tube(edge(zr[2], zr[3], T(0.5), fine ? 8 : 3), 0.028, fine ? 6 : 4, 2), paint);
    B.add(tube(edge(zr[1], zr[2], T(0.5), fine ? 8 : 3), 0.018, 4, 2), paint);
    if (fine) {
      B.add(tube(edge(zr[0] + 0.02, zCg, T(0.97), 10), 0.009, 4, 2), S.plastic);              // Gürtel-Dichtung
      B.add(tube(edge(zr[0] + 0.02, zr[3], T(0.53), 12), 0.008, 4, 2), S.plastic);            // Dachrahmen-Gummi
    }
  }
  if (style === 1 && fine) {
    // Dachreling
    for (const sg of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const p = ghPoint(SH, lerp(zr[1] + 0.12, zr[2] - 0.08, i / 8), sg * 0.4); pts.push([p[0], p[1] + 0.05, p[2]]); }
      B.add(tube(pts, 0.014, 6, 2), S.chrome);
      for (const k of [0, 8]) B.add(K.box(0.03, 0.05, 0.08), S.plastic, [pts[k][0], pts[k][1] - 0.025, pts[k][2]]);
    }
  }

  // Front (bündig auf der Stirnfläche z = −2,36): Scheinwerfer mit Chromrahmen, Projektoren und Tagfahrlicht-Leiste,
  // Grill mit Chromrahmen und Lamellen, Stoßfänger-Einlass, Nebelscheinwerfer-Blenden, Kennzeichen
  const nz0 = -2.36;
  B.add(roundPlate(0.66, 0.15, 0.02, 0.04), S.plastic, [0, 0.63, nz0 - 0.004]);
  B.add(roundPlate(0.7, 0.19, 0.012, 0.06), S.chrome, [0, 0.63, nz0 + 0.002]);
  if (fine) for (let k = 0; k < 4; k++) B.add(K.box(0.6, 0.012, 0.01), S.chrome, [0, 0.585 + k * 0.03, nz0 - 0.016]);
  B.add(roundPlate(1.2, 0.09, 0.02, 0.035), S.plastic, [0, 0.4, nz0 - 0.004]);
  if (fine) for (const sx of [-1, 1]) B.add(roundPlate(0.15, 0.07, 0.02, 0.03), S.dark, [sx * 0.62, 0.42, nz0 - 0.006]);
  B.add(plateGeom(0.52, 0.112), plateMaterial(variant, S), [0, 0.52, nz0 - 0.017], [0, PI, 0], null, { keepUV: true });
  B.add(roundPlate(0.55, 0.13, 0.012, 0.01), S.plastic, [0, 0.52, nz0 - 0.008]);
  for (const sx of [-1, 1]) {
    const hp = [sx * 0.555, 0.655, nz0 - 0.004];
    B.add(roundPlate(0.36, 0.13, 0.016, 0.04), S.chrome, hp, [0, sx * 0.1, 0]);
    LB.add(roundPlate(0.33, 0.105, 0.012, 0.035), S.lensOff, [hp[0], hp[1], hp[2] - 0.01], [0, sx * 0.1, 0], null, { tag: { lens: true } });
    if (fine) {
      for (const dx of [-0.07, 0.07]) B.add(new THREE.CylinderGeometry(0.032, 0.034, 0.012, 16), S.dark, [hp[0] + dx, hp[1] + 0.005, hp[2] - 0.019], [HP, 0, 0]);
      B.add(K.box(0.3, 0.012, 0.008), S.lensOff, [hp[0], hp[1] - 0.042, hp[2] - 0.018]);               // Tagfahrlicht
      B.add(K.box(0.05, 0.03, 0.008), S.amber, [hp[0] + sx * 0.145, hp[1] + 0.02, hp[2] - 0.018]);
    }
  }
  // Heck: Leuchten, Kennzeichen, Stoßfänger (Diffusor), Auspuff, Reflektoren
  const tz = 2.36;
  for (const sx of [-1, 1]) {
    B.add(roundPlate(0.4, 0.14, 0.04, 0.03), S.rearLamp, [sx * 0.58, 0.82, tz - 0.012]);
    if (fine) {
      B.add(roundPlate(0.12, 0.05, 0.02, 0.01), S.chrome, [sx * 0.66, 0.8, tz + 0.006]);   // Rückfahrlicht
      B.add(roundPlate(0.11, 0.03, 0.02, 0.01), S.rearLamp, [sx * 0.68, 0.5, tz + 0.004]); // Reflektor
    }
  }
  B.add(plateGeom(0.52, 0.112), plateMaterial(variant, S), [0, 0.66, tz + 0.006], null, null, { keepUV: true });
  B.add(roundPlate(0.56, 0.13, 0.012, 0.01), S.plastic, [0, 0.66, tz]);
  B.add(roundPlate(1.5, 0.12, 0.05, 0.04), S.plastic, [0, 0.47, tz]);
  B.add(new THREE.CylinderGeometry(0.035, 0.038, 0.18, fine ? 12 : 6, 1, true), S.chrome, [0.52, 0.37, 2.3], [HP, 0, 0]);
  B.add(new THREE.CircleGeometry(0.033, fine ? 12 : 6), S.dark, [0.52, 0.37, 2.385]);

  // Spiegel, Türgriffe, Blinker, Wischer, Antenne, Tankklappe – Fugen (nur Stufe 0)
  for (const sx of [-1, 1]) {
    const st = at(-0.82), x0 = sx * (st.wt + 0.01);
    B.add(K.box(0.12, 0.05, 0.06), S.plastic, [x0 + sx * 0.05, 0.985, -0.83]);
    B.add(roundPlate(0.19, 0.11, 0.07, 0.04, 0.012), paint, [x0 + sx * 0.14, 1.04, -0.8], [0, sx * 0.12, 0]);
    B.add(roundPlate(0.16, 0.085, 0.006, 0.03), S.chrome, [x0 + sx * 0.14, 1.04, -0.763], [0, sx * 0.12, 0]);
    if (fine) {
      B.add(K.box(0.05, 0.015, 0.03), S.amber, [x0 + sx * 0.2, 1.01, -0.82]);
      for (const z of [-0.34, 0.6]) {
        const x = sideX(at(z), 0.86);
        B.add(roundPlate(0.15, 0.032, 0.03, 0.014), S.chrome, [sx * (x + 0.006), 0.86, z], [0, HP, 0]);
      }
      B.add(roundPlate(0.06, 0.022, 0.02, 0.01), S.amber, [sx * (sideX(at(-1.75), 0.76) + 0.004), 0.76, -1.75], [0, HP, 0]);
    }
  }
  if (fine) {
    for (const sx of [-1, 1]) {
      const a = ghPoint(SH, G.zA0 + 0.05, sx * 0.48), b = ghPoint(SH, G.zA0 + 0.08, sx * 0.03);
      B.add(tube([a, b], 0.009, 4, 1), S.plastic);
    }
    const ant = ghPoint(SH, G.zC1 - 0.12, 0);
    B.add(roundPlate(0.05, 0.06, 0.16, 0.025), paint, [0, ant[1] + 0.03, ant[2]]);
    { const x = sideX(at(1.62), 0.86); B.add(new THREE.TorusGeometry(0.065, 0.004, 3, 16), S.dark, [x + 0.003, 0.86, 1.62], [0, HP, 0]); }
    // Fugen: Türen (vorn, Mitte, hinten), Türunterkante, Motorhaube, Kofferraum/Heckklappe
    const vseam = (z, sg, y0, y1) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const y = lerp(y0, y1, i / 8); pts.push([sg * sideX(at(z), y), y, z]); }
      return ribbon(pts, 0.0045, [sg, 0, 0], 0.002);
    };
    const doorEnd = style === 1 ? 1.04 : 1.0;
    for (const sg of [-1, 1]) {
      for (const z of [-0.965, zB, doorEnd]) B.add(vseam(z, sg, at(z).yb + 0.06, at(z).ys - 0.004), S.dark);
      const pts = [];
      for (let i = 0; i <= 10; i++) { const z = lerp(-0.965, doorEnd, i / 10); const y = at(z).yb + 0.06; pts.push([sg * sideX(at(z), y), y, z]); }
      B.add(ribbon(pts, 0.0045, [sg, -0.3, 0], 0.002), S.dark);
    }
    const topSeam = (z0, z1, x, n = 10) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const z = lerp(z0, z1, i / n), st = at(z);
        const rs = Math.min(st.rs, Math.max(0.01, st.yt - st.ys)), rx = Math.min(rs * 1.5, st.wt * 0.5), xe = st.wt - rx;
        const xx = Math.min(Math.abs(x(z, xe)), xe), qq = xx / Math.max(0.01, xe);
        pts.push([Math.sign(x(z, xe)) * xx, Math.max(st.yt, st.ys + rs) + st.crown * (1 - qq * qq) + 0.001, z]);
      }
      return ribbon(pts, 0.0045, [0, 1, 0], 0.002);
    };
    for (const sg of [-1, 1]) B.add(topSeam(-2.2, -1.0, (z, xe) => sg * (xe - 0.01)), S.dark);
    B.add(topSeam(-2.21, -2.21, () => 0, 1), S.dark);
    const across = (z, n = 12) => { const pts = []; const st = at(z), xe = st.wt - Math.min(Math.min(st.rs, st.yt - st.ys) * 1.5, st.wt * 0.5) - 0.01; for (let i = 0; i <= n; i++) { const x = lerp(-xe, xe, i / n), qq = Math.abs(x) / xe; pts.push([x, Math.max(st.yt, st.ys) + st.crown * (1 - qq * qq) + 0.002, z]); } return ribbon(pts, 0.0045, [0, 1, 0], 0.001); };
    B.add(across(-2.2), S.dark);
    if (style === 0) {
      B.add(across(G.zC0 + 0.03), S.dark);
      for (const sg of [-1, 1]) B.add(topSeam(G.zC0 + 0.03, 2.3, (z, xe) => sg * (xe - 0.01), 6), S.dark);
    }
    // Heckklappe/Kofferraum: Unterkante quer über das Heck
    { const pts = []; for (let i = 0; i <= 10; i++) pts.push([lerp(-0.7, 0.7, i / 10), 0.74, tz + 0.001]); B.add(ribbon(pts, 0.0045, [0, 0, 1], 0.001), S.dark); }
    // Unterboden: Bodenblech, Tank, Auspuffanlage, Hinterachse, Vorderachs-Träger
    B.add(K.box(1.5, 0.03, 3.2), S.dark, [0, 0.29, 0.1]);
    B.add(K.box(0.7, 0.18, 0.5), S.dark, [-0.1, 0.35, 0.85]);
    B.add(tube([[0.12, 0.27, -1.6], [0.16, 0.25, -0.6], [0.2, 0.25, 0.6], [0.4, 0.29, 1.7], [0.52, 0.36, 2.25]], 0.028, 6, 3), S.dark);
    B.add(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 12), S.dark, [0.38, 0.29, 1.85], [HP, 0, 0], [1.4, 1, 0.75]);
    B.add(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), S.dark, [0, 0.32, 1.43], [0, 0, HP]);
    B.add(K.box(1.1, 0.08, 0.3), S.dark, [0, 0.34, -1.38]);
  }
}

export { merge };
export { shapeOf as pkwShape, ghPoint as pkwGreenhouse };
