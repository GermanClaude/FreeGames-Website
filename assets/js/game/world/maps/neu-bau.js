// NULLPUNKT — Gemeinsame Bausteine der Karten „Flugplatz“ und „Stadtkern“ (Strang karten-neu, 14.11.) (Owner: world).
// Treppenläufe mit schräger Unterseite (Laufplatte statt Vollkeil: darunter bleibt Kopfhöhe), zweiläufige
// Treppenhäuser mit Zwischenpodest (Aussparungen für building().holes), Tonnendach-Schalen (Hangar, Schutzbau) mit
// Innen- und Außenhaut, Giebelwände mit Toröffnung, Schäden/Trümmer und kleine Ausstattung.
// Regeln wie die übrigen Karten: deterministisch (Zufall nur über hash01 der Position), Kollision unabhängig von der
// Grafikstufe; Optik darf nach b.lookQuality sparen.
import * as THREE from 'three';
import { frame, hash01 } from '../props.js?v=20261115041504';
import { railing } from '../arch.js?v=20261115041504';

export const KEIN = { collide: false, minimap: false };
export const VG = { ...KEIN, grad: false };
const DIRV = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
export const hoch = (b) => b.lookQuality === 'high' || b.lookQuality === 'ultra';
export const mittel = (b) => b.lookQuality && b.lookQuality !== 'low';

// ---------------------------------------------------------------------------
// Treppen
// ---------------------------------------------------------------------------
/**
 * Ein Treppenlauf. (x, z) = Mitte der untersten Stufenkante, Aufstieg in Richtung dir; o: { y0, y1, w, run, mat, tint,
 * soffit (Unterseite sichtbar, Standard true), nosing (Stufenkante, Farbe), steel (Gitterroststufen) }.
 * Kollision: schräge Laufplatte (0,22 m) – unter dem Lauf bleibt Platz (Treppenhaus mit Zwischenpodest).
 */
export function flight(b, o) {
  const y0 = o.y0, y1 = o.y1, rise = y1 - y0, w = o.w ?? 1.2;
  const run = o.run ?? Math.max(1.2, rise / 0.6);
  const [dx, dz] = DIRV[o.dir];
  const ry = Math.atan2(dx, dz), rx = -dz, rz = dx;
  const P = (f, r = 0) => [o.x + dx * f + rx * r, o.z + dz * f + rz * r];
  const n = Math.max(2, Math.round(rise / 0.18)), sr = rise / n, sd = run / n;
  const mat = o.mat || 'concrete', steel = !!o.steel;
  for (let i = 0; i < n; i++) {
    const [cx, cz] = P((i + 0.5) * sd);
    const top = y0 + (i + 1) * sr;
    if (steel) b.box(cx, top - 0.04, cz, w, 0.04, sd + 0.03, 'metal_grate', { ry, ...VG, ao: false });
    else b.box(cx, top - sr - 0.16, cz, w, sr + 0.16, sd, mat, { ry, ...KEIN, tint: o.tint, aoFloor: y0, interior: o.interior });
    if (o.nosing && !steel) { const [nx, nz] = P(i * sd + 0.02); b.box(nx, top - 0.025, nz, w, 0.03, 0.04, 'metal_galvanized', { ry, ...VG, ao: false, tint: o.nosing === true ? undefined : o.nosing }); }
  }
  const ang = Math.atan2(rise, run), len = Math.hypot(rise, run);
  const [mx, mz] = P(run / 2);
  if (steel) {
    for (const s of [-1, 1]) { const [cx, cz] = P(run / 2, s * (w / 2 + 0.03)); b.box(cx, y0 + rise / 2 - 0.15, cz, 0.05, 0.3, len, 'metal_painted', { ry, rx: -ang, tint: o.tint || '#3d4247', ...VG, uv: 'local' }); }
  } else if (o.soffit !== false) {
    // sichtbare Laufplatte unten (schräg)
    b.box(mx, y0 + rise / 2 - 0.34, mz, w, 0.16, len, mat, { ry, rx: -ang, tint: o.tint, ...VG, uv: 'local', interior: o.interior });
  }
  // Kollision: schräge Platte, Oberkante durch die Stufenkanten
  // (Platte je Ende ≈ 0,2 m länger: die Drehung um die Unterkante verschiebt die Oberseite um 0,1 m zurück – sonst bliebe
  // oben ein Spalt zum Podest, den die Navigation als Loch wertet)
  b.box(mx, y0 + rise / 2 - 0.22, mz, w, 0.22, len + 0.42, 'black', { ry, rx: -ang, visual: false, minimap: 'stairs' });
  const [ax, az] = P(-0.6), [bx, bz] = P(run + 0.6);
  b.navPoint(ax, y0 + 0.2, az);
  const [sx0, sz0] = P(0.35), [sx1, sz1] = P(run - 0.3);
  b.navLine(sx0, y0 + (rise * 0.35) / run + 0.2, sz0, sx1, y1 - (rise * 0.3) / run + 0.2, sz1, 1.0);
  b.navPoint(bx, y1 + 0.2, bz);
  return { run, P };
}

/**
 * Zweiläufiges Treppenhaus (Podesttreppe). (cx, cz) Mitte, w quer (zwei Läufe nebeneinander), L längs; dir = Richtung,
 * in der der erste Lauf vom Geschosspodest (Antritt am „Anfang“) zum Zwischenpodest am „Ende“ aufsteigt.
 * levels: Geschosshöhen [y0, y1, …] (Fußbodenoberkanten); jede Etage: Lauf A (linke Spur) bis zur halben Höhe, Podest,
 * Lauf B (rechte Spur) zurück zur nächsten Etage. o: { land (Podesttiefe 1,25), mat, tint, wall (Mittelwand, Standard
 * true), railTint, roof (true: letzter Lauf endet auf der Dachplatte → Dachausstieg) }.
 * → { holes: (k) => Aussparung in der Decke auf Höhe levels[k] (k ≥ 1), lanes }
 */
export function stairCore(b, o) {
  const { cx, cz, w, L, levels } = o;
  const dir = o.dir || 'n', [dx, dz] = DIRV[dir];
  const rx = -dz, rz = dx; // rechts der Aufstiegsrichtung
  const land = o.land ?? 1.25, gap = 0.14, lw = (w - gap) / 2;
  const P = (f, r) => [cx + dx * f + rx * r, cz + dz * f + rz * r];
  const runL = L - 2 * land;
  const rA = -(gap / 2 + lw / 2), rB = gap / 2 + lw / 2;
  const mat = o.mat || 'concrete';
  for (let k = 0; k + 1 < levels.length; k++) {
    const y0 = levels[k], y1 = levels[k + 1], ym = (y0 + y1) / 2;
    // Lauf A: linke Spur, vom Anfang (f = −L/2 + land) zum Ende
    const [ax, az] = P(-L / 2 + land, rA);
    flight(b, { x: ax, z: az, dir, y0, y1: ym, w: lw, run: runL, mat, tint: o.tint, nosing: o.nosing, interior: o.interior, steel: o.steel });
    // Zwischenpodest (volle Breite)
    const [px, pz] = P(L / 2 - land / 2, 0);
    b.box(px, ym - 0.2, pz, Math.abs(rx) > 0.5 ? w : land, 0.2, Math.abs(rx) > 0.5 ? land : w, mat, { tint: o.tint, grad: false, minimap: false, interior: o.interior });
    b.navPoint(px, ym + 0.2, pz);
    // Lauf B: rechte Spur, vom Ende zurück
    const [bx, bz] = P(L / 2 - land, rB);
    flight(b, { x: bx, z: bz, dir: OPP[dir], y0: ym, y1, w: lw, run: runL, mat, tint: o.tint, nosing: o.nosing, interior: o.interior, steel: o.steel });
    // Mittelwand zwischen den Läufen (bis unter das Podest der nächsten Etage) bzw. Geländer
    const [mx, mz] = P(0, 0);
    if (o.wall !== false) b.box(mx, y0, mz, Math.abs(rx) > 0.5 ? gap : runL, y1 - y0 - 0.02, Math.abs(rx) > 0.5 ? runL : gap, o.wallMat || 'plaster_white', { tint: o.wallTint, minimap: false, grad: false, interior: o.interior });
    else {
      const [r0x, r0z] = P(-L / 2 + land, 0), [r1x, r1z] = P(L / 2 - land, 0);
      railing(b, r0x, r0z, r1x, r1z, y0 + 0.05, { y1: ym + 0.05, h: 0.95, tint: o.railTint || '#2c2f33', posts: 4 });
      railing(b, r1x, r1z, r0x, r0z, ym + 0.05, { y1: y1 + 0.05, h: 0.95, tint: o.railTint || '#2c2f33', posts: 4, collider: false });
    }
  }
  // Oberste Etage: Absturzsicherung an der linken Spur (dort führt kein Lauf weiter) – nur ohne Dachausstieg
  const top = levels[levels.length - 1];
  if (!o.roof) {
    const [g0x, g0z] = P(-L / 2 + land + 0.02, -w / 2 + 0.03), [g1x, g1z] = P(-L / 2 + land + 0.02, -gap / 2);
    railing(b, g0x, g0z, g1x, g1z, top, { h: 1.0, tint: o.railTint || '#2c2f33', posts: 2 });
    const [h0x, h0z] = P(-L / 2 + land, 0), [h1x, h1z] = P(L / 2 - 0.05, 0);
    // Handlauf über dem Treppenauge nur als Optik: sein Kollisionsquader ragte sonst über dem Zwischenpodest in Kopfhöhe
    railing(b, h0x, h0z, h1x, h1z, top, { h: 1.0, tint: o.railTint || '#2c2f33', posts: 4, collider: false });
  }
  const holeRect = () => {
    const [ax, az] = P(-L / 2 + land, -w / 2), [bx, bz] = P(L / 2, w / 2);
    return { x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz) };
  };
  return { holes: (k) => ({ floor: k, ...holeRect() }), rect: holeRect(), P, land };
}

// ---------------------------------------------------------------------------
// Tonnendach / Giebel (Hangar, Flugzeugschutzbau)
// ---------------------------------------------------------------------------
/**
 * Kreisbogen-Schale (Querschnitt in x/y, Länge entlang z, Mitte bei z = 0). span = lichte Weite, rise = Stich über
 * dem Kämpfer (y = 0), seg Segmente; t = Dicke (Außen- und Innenhaut getrennt, Stirnkanten zu). → BufferGeometry
 */
export function vaultGeom(span, rise, len, seg = 18, t = 0.12, uvScale = 1) {
  const R = (span * span / 4 + rise * rise) / (2 * rise), a = Math.asin(Math.min(1, span / 2 / R)), yc = rise - R;
  const P = [], N = [], U = [];
  const quad = (p0, p1, p2, p3, n0, n1, n2, n3, u0, u1, v0, v1) => {
    for (const [p, nn, uu] of [[p0, n0, [u0, v0]], [p1, n1, [u1, v0]], [p2, n2, [u1, v1]], [p0, n0, [u0, v0]], [p2, n2, [u1, v1]], [p3, n3, [u0, v1]]]) { P.push(...p); N.push(...nn); U.push(uu[0] * uvScale, uu[1] * uvScale); }
  };
  const z0 = -len / 2, z1 = len / 2;
  let arc = 0;
  for (let i = 0; i < seg; i++) {
    const t0 = -a + (2 * a * i) / seg, t1 = -a + (2 * a * (i + 1)) / seg;
    const s0 = Math.sin(t0), c0 = Math.cos(t0), s1 = Math.sin(t1), c1 = Math.cos(t1);
    const da = R * (t1 - t0);
    // außen (Normale nach außen)
    const o0 = [R * s0, yc + R * c0], o1 = [R * s1, yc + R * c1];
    quad([o0[0], o0[1], z1], [o1[0], o1[1], z1], [o1[0], o1[1], z0], [o0[0], o0[1], z0], [s0, c0, 0], [s1, c1, 0], [s1, c1, 0], [s0, c0, 0], arc, arc + da, 0, len);
    // innen (Radius R − t, Normale nach innen, Wicklung umgekehrt)
    const Ri = R - t, i0 = [Ri * s0, yc + Ri * c0], i1 = [Ri * s1, yc + Ri * c1];
    quad([i0[0], i0[1], z0], [i1[0], i1[1], z0], [i1[0], i1[1], z1], [i0[0], i0[1], z1], [-s0, -c0, 0], [-s1, -c1, 0], [-s1, -c1, 0], [-s0, -c0, 0], arc, arc + da, 0, len);
    arc += da;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  return g;
}

/** Punkte des Bogens (Kämpfer bei y = 0, Weite span, Stich rise) als [x, y], von links nach rechts. */
export function vaultProfile(span, rise, seg = 18) {
  const R = (span * span / 4 + rise * rise) / (2 * rise), a = Math.asin(Math.min(1, span / 2 / R)), yc = rise - R;
  const out = [];
  for (let i = 0; i <= seg; i++) { const t = -a + (2 * a * i) / seg; out.push([R * Math.sin(t), yc + R * Math.cos(t)]); }
  return out;
}

/**
 * Giebelwand (Fläche in x/y, Dicke t entlang z, Mitte bei z = 0): Rechteck span × wallH, darauf das Bogensegment; optional
 * rechteckige Öffnung door { w, h, x } (unten offen). → nicht indizierte Geometrie (für b.geom, Kollision 'mesh').
 */
export function gableGeom(span, wallH, rise, t, door = null, seg = 18) {
  const s = new THREE.Shape();
  const hw = span / 2;
  if (door) {
    const dx0 = (door.x || 0) - door.w / 2, dx1 = (door.x || 0) + door.w / 2;
    s.moveTo(-hw, 0); s.lineTo(dx0, 0); s.lineTo(dx0, door.h); s.lineTo(dx1, door.h); s.lineTo(dx1, 0); s.lineTo(hw, 0);
  } else { s.moveTo(-hw, 0); s.lineTo(hw, 0); }
  s.lineTo(hw, wallH);
  const prof = vaultProfile(span, rise, seg);
  for (let i = prof.length - 1; i >= 0; i--) s.lineTo(prof[i][0], wallH + prof[i][1]);
  s.lineTo(-hw, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -t / 2);
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute('uv');
  return ng;
}

// ---------------------------------------------------------------------------
// Kleinteile, Schäden
// ---------------------------------------------------------------------------
/** Trümmerhaufen (Mauerwerk/Beton) um (x, z), Radius r: Brocken mit Kollision nur als flacher Hügel. */
export function rubble(b, x, z, r = 1.6, o = {}) {
  const y = o.y ?? 0, n = Math.round(6 + r * 5), mat = o.mat || 'concrete_dirty', tint = o.tint || '#a49d92';
  for (let i = 0; i < n; i++) {
    const a = hash01(x + i, z, 31) * Math.PI * 2, d = Math.sqrt(hash01(x, z + i, 32)) * r;
    const s = 0.15 + hash01(x - i, z + i, 33) * 0.45 * (1 - d / (r + 0.01)) + 0.08;
    // platz (19.11.): Brocken optional aus anderem Material (o.chunkMat/chunkTint, z. B. Asphaltschollen auf Erdaushub)
    const m = hash01(x + i * 3, z - i, 34) < 0.35 ? (o.brick ? 'brick' : 'concrete') : (o.chunkMat || mat);
    b.box(x + Math.cos(a) * d, y - 0.05, z + Math.sin(a) * d, s * 1.4, s * 0.8, s, m, { ry: a * 2, rx: (hash01(i, x, 35) - 0.5) * 0.6, rz: (hash01(i, z, 36) - 0.5) * 0.6, tint: m === 'brick' ? undefined : m === o.chunkMat ? (o.chunkTint || tint) : tint, ...VG });
  }
  // flacher Schutthügel (begehbar, Kugeln stoppen)
  b.cyl(x, y - 0.05, z, r * 0.95, Math.min(0.75, r * 0.35), mat, { r1: r * 0.35, seg: 10, tint, minimap: o.minimap ?? 'cover' });
  b.decal(x, y + 0.02, z, r * 2.8, r * 2.6, 'stain', { opacity: 0.5 });
}

/** Einschlagloch/Durchbruch-Kante (nur Optik): Brandfleck + Ruß auf einer Wand (Normale n). */
export function soot(b, x, y, z, n, s = 1.6) {
  b.decal(x, y, z, s, s * 1.2, 'soot', { normal: n, tangent: [n[2], 0, -n[0]], opacity: 0.85 });
}

/** Abgeplatzter Putz (Mauerwerk sichtbar) an einer Wand mit Normale n (waagerecht). */
export function chip(b, x, y, z, n, w = 0.8, cell = 'chip_brick') {
  b.decal(x, y, z, w, w * 0.7, cell, { normal: n, tangent: [n[2], 0, -n[0]], opacity: 1 });
}

/** Stahlgeländer-Absperrung (Bauzaun-Element) von A nach B. */
export function bauzaun(b, x0, z0, x1, z1, o = {}) {
  const y = o.y ?? 0, L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0), n = Math.max(1, Math.round(L / 3.5));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, cx = x0 + (x1 - x0) * t, cz = z0 + (z1 - z0) * t, seg = L / n - 0.05;
    const f = frame(b, cx, y, cz, ry);
    f.box(0, 0.12, 0, seg, 1.85, 0.02, 'chainlink', { ...VG, ao: false, cast: false, bullet: false });
    for (const s of [-1, 1]) f.cyl(s * (seg / 2 - 0.02), 0.1, 0, 0.022, 1.9, 'metal_galvanized', { ...KEIN, seg: 6 });
    for (const s of [-1, 1]) f.box(s * (seg / 2 - 0.02), 0, 0, 0.24, 0.12, 0.6, 'concrete', { ...KEIN, tint: '#9a9890' });
  }
  b.box((x0 + x1) / 2, y, (z0 + z1) / 2, L, 2.0, 0.1, 'black', { ry, visual: false, minimap: 'wall', bullet: false });
}

/**
 * Panzersperre („Tschechenigel“): drei gleich lange Doppel-T-Träger (≈ IPB 140, 2,1 m), in der Mitte rechtwinklig
 * gekreuzt und verschweißt (Knotenbleche), so gekippt, dass die Raumdiagonale senkrecht steht → drei Enden auf dem
 * Boden, drei ragen schräg nach oben (≈ 1,2 m). Rostverlauf je Ecke (Vertexfarben: heller Flugrost, dunkle Rostnarben,
 * Reste der grauen Grundierung). Nutzer 20.11.: vorher nur zwei Balken in V-Form. Eine Geometrie je Variante (3),
 * landet im Material-Eimer metal_rust (kein zusätzlicher Draw Call). Kollision wie bisher (Deckungsquader).
 */
const IGEL = new Map();
function igelGeom(v) {
  if (IGEL.has(v)) return IGEL.get(v);
  const L = 2.1, Hh = 0.14, Bf = 0.14, tf = 0.012, tw = 0.008;
  // Achsen: Würfelkanten so gedreht, dass (1,1,1) nach oben zeigt; danach um die Hochachse je Variante
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 1, 1).normalize(), new THREE.Vector3(0, 1, 0));
  const yc = (L / 2) / Math.sqrt(3); // Knotenhöhe: Trägerenden (Achse) auf dem Boden
  const parts = [];
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  axes.forEach((a, i) => {
    const A = new THREE.Vector3(...a), U = new THREE.Vector3(...axes[(i + 1) % 3]), W = new THREE.Vector3(...axes[(i + 2) % 3]);
    // Profil in lokalen Koordinaten (x = Länge, y = Steg-Richtung, z = Flansch-Richtung): Steg + zwei Flansche
    const seg = 6, prof = [
      new THREE.BoxGeometry(L, Hh - 2 * tf, tw, seg, 1, 1),
      new THREE.BoxGeometry(L, tf, Bf, seg, 1, 1).translate(0, (Hh - tf) / 2, 0),
      new THREE.BoxGeometry(L, tf, Bf, seg, 1, 1).translate(0, -(Hh - tf) / 2, 0),
    ];
    // Träger leicht gegeneinander versetzt (an der Kreuzung ausgeklinkt und überlappend verschweißt)
    const m = new THREE.Matrix4().makeBasis(A, U, W).premultiply(new THREE.Matrix4().makeRotationFromQuaternion(q));
    for (const g of prof) parts.push(g.applyMatrix4(m));
  });
  // Knotenbleche (Dreieckbleche in den drei Winkeln) + Schweißnähte als kleine Wülste
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Vector3(...axes[i]), c = new THREE.Vector3(...axes[(i + 1) % 3]);
    const sh = new THREE.Shape([new THREE.Vector2(0.07, 0.07), new THREE.Vector2(0.3, 0.07), new THREE.Vector2(0.07, 0.3)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: false }).translate(0, 0, -0.005);
    const n = a.clone().cross(c);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(a, c, n)).applyQuaternion(q);
    parts.push(g);
  }
  parts.push(new THREE.IcosahedronGeometry(0.11, 0).applyQuaternion(q));
  // Bodenplatten an den drei unteren Enden (angeschweißte Fußbleche, auf dem Boden aufliegend)
  for (const a of axes) {
    const e = new THREE.Vector3(...a).multiplyScalar(-L / 2).applyQuaternion(q);
    parts.push(new THREE.BoxGeometry(0.2, 0.012, 0.2).translate(e.x, e.y + 0.006, e.z));
  }
  const flat = parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position') n.deleteAttribute(k); return n; });
  let geo = mergeVerts(flat);
  geo.translate(0, yc, 0).rotateY(v * 2.1);
  geo.computeVertexNormals();
  // Rost je Ecke: helle Flugrost-Flächen, dunkle Narben, Grundierungsreste; unten (Spritzwasser) dunkler
  const P = geo.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color();
  const DARK = new THREE.Color(0.2, 0.1, 0.05), LIGHT = new THREE.Color(0.62, 0.32, 0.13), PRIMER = new THREE.Color(0.36, 0.36, 0.34);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const n1 = hash01(Math.round(x * 6), Math.round(z * 6) + Math.round(y * 6) * 7, 31 + v), n2 = hash01(Math.round(x * 2.5), Math.round(y * 2.5) + Math.round(z * 2.5) * 5, 37 + v);
    c.copy(DARK).lerp(LIGHT, 0.25 + n1 * 0.6);
    if (n2 > 0.72) c.lerp(PRIMER, 0.5);
    c.multiplyScalar(0.55 + 0.45 * Math.min(1, y / 0.5));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  IGEL.set(v, geo);
  return geo;
}
function mergeVerts(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}
export function igel(b, x, z, o = {}) {
  const y = o.y ?? 0, ry = o.ry ?? hash01(x, z, 7) * Math.PI;
  b.geom(igelGeom(Math.floor(hash01(x, z, 8) * 3)), x, y, z, 'metal_rust', { ry, ...VG, tint: '#d8c8b8' });
  b.box(x, y, z, 1.4, 1.1, 1.4, 'black', { ry, visual: false, minimap: 'cover' });
}

/** Mülltonnen-Gruppe aus Primitiven (Hinterhof). */
export function tonnen(b, x, z, ry = 0, n = 3, o = {}) {
  const f = frame(b, x, o.y ?? 0, z, ry), cols = ['#2f4a3a', '#5a5f66', '#7a3a2e', '#2f4a6a'];
  for (let i = 0; i < n; i++) {
    const lx = (i - (n - 1) / 2) * 0.72;
    f.box(lx, 0.03, 0, 0.62, 1.05, 0.7, 'polymer', { tint: cols[Math.floor(hash01(x + i, z, 2) * cols.length)], ...KEIN });
    f.box(lx, 1.08, -0.02, 0.66, 0.05, 0.74, 'polymer', { tint: '#2b2d30', ...VG, rx: hash01(x, z + i, 3) < 0.3 ? -0.6 : 0 });
  }
  f.solid(0, 0, 0, n * 0.72, 1.1, 0.72, { minimap: 'cover' });
}
