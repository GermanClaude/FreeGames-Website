// NULLPUNKT – Waffen-LOD-Bäcker (20.11.2026, Nutzerwunsch „Mach die Waffen der NPCs auch detaillierter“).
//
// Bots, Mitspieler-Puppen und liegende Beute zeigten bisher nur die Bot-Detailstufe (models.js lod 'third': 176–1120 Dreiecke,
// Kleinteile < 9 mm weggelassen, Zylinder mit 6 Segmenten). Dieses Werkzeug baut aus der vollen Ego-Fassung (Stufe 'max', mit
// Kantenabrieb/Schmauch) zwei abgeleitete Stufen und legt sie als kompakte Binärdateien ab (assets/lib/waffen-lod/<modell>.bin):
//   nah  (Soldat in LOD 0, ≤ 13–18 m): ≈ 7 000–9 000 Dreiecke je Gewehr, Kleinteile, Visierung, Magazin, Schienen
//   mitte (LOD 1, bis 30–46 m):         ≈ 1 400–1 800 Dreiecke – saubere Silhouette statt Kisten
// Geometrie je Baugruppe wie die Bot-Fassung (Ursprung, Magazin, meta.botParts – Nachladen/Kipplauf bewegen sie weiter) und je
// Metall/Matt in zwei Netzen mit Vertex-Farben (Sammelmaterialien lodMetal/lodMatte: kein neues Shaderprogramm, keine Textur,
// Tarnmuster greifen wie bisher). Farbe = Materialfarbe der Bot-Stufe, Kanten aus dem Ego-Kantenabrieb heller, Ruß/Kehlen dunkler.
// Vereinfachung: meshoptimizer (Kantenkollaps mit Fehlerquadrik, Farbe als Attribut), danach Knicknormalen (40°).
//
// Aufruf (Repo-Wurzel):  npm i --prefix /tmp/mo meshoptimizer@0.22.0
//                        node tools/assets/waffen/bake_lod.mjs --meshopt /tmp/mo/node_modules/meshoptimizer [modell,modell…]
// Ohne Modellliste: alle Schusswaffen (models.js GUN_KEYS). Nach Änderungen an einem Bauplan das Modell neu backen – sonst zeigt
// die Nah-Stufe die alte Form (Anker/Hände kommen weiter aus der aktuellen Bot-Fassung, nur das Aussehen veraltet).
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const VER = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).build;
const OUT = path.join(ROOT, 'assets/lib/waffen-lod');

// three als Modul auflösen (wie die Importmap der Spielseite)
const hooks = `export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: ${JSON.stringify(pathToFileURL(path.join(ROOT, 'assets/vendor/three/three.module.min.js')).href)}, shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: ${JSON.stringify(pathToFileURL(path.join(ROOT, 'assets/vendor/three/addons/')).href)} + spec.slice(13), shortCircuit: true };
  return next(spec, ctx);
}`;
register('data:text/javascript,' + encodeURIComponent(hooks));

// Leinwand-Ersatz: die Bauplaene zeichnen Texturen (Materialien), hier zählt nur die Geometrie
const ctx2d = (cv) => new Proxy({ canvas: cv }, { get(t, p) {
  if (p in t) return t[p];
  if (p === 'getImageData' || p === 'createImageData') return (a, b, w, h) => { const W = w ?? a?.width ?? a, H = h ?? a?.height ?? b; return { width: W, height: H, data: new Uint8ClampedArray(Math.max(1, W * H * 4)) }; };
  if (p === 'measureText') return () => ({ width: 10 });
  if (p === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  if (/^create(Linear|Radial)Gradient$|^createPattern$/.test(p)) return () => ({ addColorStop() {} });
  return () => {};
}, set(t, p, v) { t[p] = v; return true; } });
const canvas = (w = 1, h = 1) => { const cv = { width: w, height: h, style: {}, addEventListener() {} }; cv.getContext = () => ctx2d(cv); return cv; };
globalThis.document = { createElement: () => canvas(), createElementNS: () => canvas(), body: { appendChild() {} } };
globalThis.OffscreenCanvas = class { constructor(w, h) { Object.assign(this, canvas(w, h)); this.getContext = () => ctx2d(this); } };
globalThis.ImageData = class { constructor(d, w, h) { if (typeof d === 'number') { h = w; w = d; d = new Uint8ClampedArray(w * h * 4); } Object.assign(this, { data: d, width: w, height: h }); } };
globalThis.window = globalThis; globalThis.self = globalThis;

const args = process.argv.slice(2);
const mi = args.indexOf('--meshopt');
const moPath = mi >= 0 ? args.splice(mi, 2)[1] : 'meshoptimizer';
const { MeshoptSimplifier } = await import(moPath.startsWith('/') ? pathToFileURL(path.join(moPath, 'index.module.js')).href : moPath);
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;

const THREE = await import('three');
const { mergeVertices, toCreasedNormals } = await import('three/addons/utils/BufferGeometryUtils.js');
const M = await import(pathToFileURL(path.join(ROOT, `assets/js/game/weapons/models.js`)).href + `?v=${VER}`);
const MAT = await import(pathToFileURL(path.join(ROOT, `assets/js/game/weapons/gunsmith/materials.js`)).href + `?v=${VER}`);

// Stufen: Dreiecksbudget je Waffe (verteilt nach Anteil der Baugruppe), relative Fehlergrenze
const LEVELS = [{ name: 'near', tris: 8000, err: 0.004 }, { name: 'mid', tris: 1600, err: 0.02 }];
// Ohne Bot-Gegenstück: durchsichtig, leuchtend, Schrift, Patronen-Instanzen
const SKIP = (mk) => MAT.LOD_SKIP.has(mk) && mk !== 'cavity' || mk.startsWith('schrift') || mk === 'follower';

const keys = args.length ? args[0].split(',') : M.GUN_KEYS;
fs.mkdirSync(OUT, { recursive: true });
const index = fs.existsSync(path.join(OUT, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')) : { v: 1, models: {} };

for (const key of keys) try {
  const t0 = Date.now();
  const third = M.createWeaponModel(key, { lod: 'third' });
  const ego = M.createWeaponModel(key, { lod: 'first', tier: 'max' });
  third.updateMatrixWorld(true); ego.updateMatrixWorld(true);
  // Baugruppen der Bot-Fassung: Gruppen mit eigenen Netzen 'gruppe:metal|matte' (Ursprung = 'root')
  const where = new Set(['root']);
  third.traverse((o) => { if (o.isMesh) { const w = o.name.split(':')[0]; if (w !== 'root') where.add(w); } });
  const groupOf = (o) => { for (let q = o; q && q !== ego; q = q.parent) if (where.has(q.name)) return q.name; return 'root'; };
  const frame = (w) => (w === 'root' ? ego : ego.getObjectByName(w));
  // Anker-Kontrolle: Ego und Bot müssen dieselben Drehpunkte haben (sonst säße die Nah-Stufe versetzt)
  for (const w of where) if (w !== 'root') {
    const a = frame(w).getWorldPosition(new THREE.Vector3()), b = third.getObjectByName(w).getWorldPosition(new THREE.Vector3());
    if (a.distanceTo(b) > 1e-4) console.warn(`  [${key}] Baugruppe ${w}: Drehpunkt weicht ab (${a.distanceTo(b).toFixed(4)} m)`);
  }
  const buckets = new Map();   // 'gruppe|metal' → [{ pos, nrm, col }]
  const inv = new Map([...where].map((w) => [w, frame(w).matrixWorld.clone().invert()]));
  const m4 = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(), c = new THREE.Color();
  let srcTris = 0;
  ego.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    for (let q = o; q && q !== ego; q = q.parent) if (!q.visible) return;   // verborgene Teile (Ladepatrone u. a.)
    const mk = o.name.split(':').slice(1).join(':');
    if (!mk || SKIP(mk)) return;
    let info; try { info = MAT.lodInfo(mk); } catch { return; }
    const w = groupOf(o);
    m4.multiplyMatrices(inv.get(w), o.matrixWorld); nm.getNormalMatrix(m4);
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const P = g.attributes.position, N = g.attributes.normal, WD = g.attributes.wearDirt, n = P.count;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const cavity = mk === 'cavity';
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m4); v.toArray(pos, i * 3);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); v.toArray(nrm, i * 3);
      c.copy(cavity ? new THREE.Color(0x050505) : info.color);
      if (WD && !cavity) {
        const edge = WD.getX(i), dirt = WD.getY(i);
        // Kantenabrieb: blankes Grundmetall bzw. abgegriffener Kunststoff/Lack (gedämpft – die Bot-Stufe hat kein Glanzlicht je Kante)
        if (edge > 0) c.lerp(info.metal ? new THREE.Color(0.32, 0.33, 0.34) : c.clone().multiplyScalar(1.7), 0.32 * edge);
        if (dirt > 0) c.multiplyScalar(1 - 0.5 * dirt);
      }
      c.toArray(col, i * 3);
    }
    if (g !== o.geometry) g.dispose();
    srcTris += n / 3;
    const k = w + '|' + (info.metal ? 'metal' : 'matte');
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push({ pos, nrm, col });
  });
  const out = { key, ver: VER, src: Math.round(srcTris), levels: [] };
  const blobs = [];
  let off = 0;
  for (const L of LEVELS) {
    const lv = { name: L.name, groups: [] };
    for (const [k, parts] of buckets) {
      const [w, kind] = k.split('|');
      // Zusammenfügen und nach Lage+Farbe verschweißen (Normalen kommen nach der Vereinfachung neu)
      const nV = parts.reduce((s, p) => s + p.pos.length / 3, 0);
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(nV * 3), col = new Float32Array(nV * 3);
      let o3 = 0;
      for (const p of parts) { pos.set(p.pos, o3); col.set(p.col, o3); o3 += p.pos.length; }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const wg = mergeVertices(geo, 1e-5);
      const share = (nV / 3) / srcTris;
      const target = Math.max(12, Math.round(L.tris * share)) * 3;
      const idx = new Uint32Array(wg.index.array);
      let simp = idx;
      if (target < idx.length) {
        const P = wg.attributes.position.array, C = wg.attributes.color.array;
        [simp] = MeshoptSimplifier.simplifyWithAttributes(idx, P, 3, C, 3, [0.6, 0.6, 0.6], null, target, L.err, ['Prune']);
        if (simp.length > target * 1.15) [simp] = MeshoptSimplifier.simplifyWithAttributes(idx, P, 3, C, 3, [0.3, 0.3, 0.3], null, target, L.err * 4, ['Prune']);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', wg.attributes.position);
      sg.setAttribute('color', wg.attributes.color);
      sg.setIndex(new THREE.BufferAttribute(simp, 1));
      const flat = toCreasedNormals(sg, (40 * Math.PI) / 180);   // nicht indiziert, Knicknormalen
      const fin = mergeVertices(flat, 1e-5);
      fin.computeBoundingBox();
      const bb = fin.boundingBox, vc = fin.attributes.position.count, ic = fin.index.count;
      // Kodierung: Lage uint16 im Hüllquader, Normale int8 ×4, Farbe uint8 ×4 (sRGB-nah, Quadratwurzel), Indizes uint16/uint32
      const P = fin.attributes.position.array, N = fin.attributes.normal.array, C = fin.attributes.color.array;
      const q = new Uint16Array(vc * 3), nn = new Int8Array(vc * 4), cc = new Uint8Array(vc * 4);
      const ext = [0, 1, 2].map((a) => Math.max(1e-6, bb.max.getComponent(a) - bb.min.getComponent(a)));
      for (let i = 0; i < vc; i++) {
        for (let a = 0; a < 3; a++) {
          q[i * 3 + a] = Math.round(((P[i * 3 + a] - bb.min.getComponent(a)) / ext[a]) * 65535);
          nn[i * 4 + a] = Math.round(Math.max(-1, Math.min(1, N[i * 3 + a])) * 127);
          cc[i * 4 + a] = Math.round(Math.sqrt(Math.max(0, Math.min(1, C[i * 3 + a]))) * 255);
        }
      }
      const big = vc > 65535;
      const I = big ? new Uint32Array(fin.index.array) : new Uint16Array(fin.index.array);
      const pad = (n) => (4 - (n % 4)) % 4;
      const chunks = [q, nn, cc, I];
      const g = { where: w, kind, vc, ic, big, min: bb.min.toArray(), ext, off };
      for (const ch of chunks) { const b = Buffer.from(ch.buffer, ch.byteOffset, ch.byteLength); blobs.push(b); off += b.length; const p = pad(b.length); if (p) { blobs.push(Buffer.alloc(p)); off += p; } }
      lv.groups.push(g);
      [geo, wg, sg, flat, fin].forEach((x) => x.dispose());
    }
    lv.tris = lv.groups.reduce((s, g) => s + g.ic / 3, 0);
    out.levels.push(lv);
  }
  const head = Buffer.from(JSON.stringify(out));
  const hp = (4 - ((head.length + 4) % 4)) % 4;
  const len = Buffer.alloc(4); len.writeUInt32LE(head.length + hp);
  const file = Buffer.concat([len, head, Buffer.alloc(hp, 0x20), ...blobs]);
  fs.writeFileSync(path.join(OUT, key + '.bin'), file);
  index.models[key] = { bytes: file.length, near: out.levels[0].tris, mid: out.levels[1].tris, src: out.src };
  console.log(`${key}: Quelle ${out.src} → nah ${out.levels[0].tris}, mitte ${out.levels[1].tris} Dreiecke, ${(file.length / 1024).toFixed(0)} KB, ${Date.now() - t0} ms`);
} catch (err) { console.error(`${key}: FEHLER`, err); process.exitCode = 1; }
index.v = 1;
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n');
