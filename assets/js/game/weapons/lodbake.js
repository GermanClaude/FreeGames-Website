// NULLPUNKT – gebackene Detailstufen der Drittpersonen-Waffen (20.11.2026, Nutzerwunsch „Mach die Waffen der NPCs auch
// detaillierter“). Bots, Mitspieler-Puppen und liegende Beute trugen nur die Bot-Fassung (models.js lod 'third', 176–1120 Dreiecke,
// Kleinteile weggelassen). tools/assets/waffen/bake_lod.mjs leitet aus der vollen Ego-Fassung zwei Stufen ab und legt sie in
// assets/lib/waffen-lod/<modell>.bin ab:
//   Stufe 0 (nah, Soldat in LOD 0): ≈ 8 000 Dreiecke – Visierung, Schienen, Stifte, Magazin mit Sicken, Mündung, Kantenabrieb
//   Stufe 1 (mitte, Soldat in LOD 1): ≈ 1 600 Dreiecke – saubere Silhouette
//   Stufe 2 (fern): die bisherige Bot-Fassung (unverändert, immer vorhanden)
// Die Netze hängen an denselben Baugruppen wie die Bot-Fassung (Ursprung, Magazin, meta.botParts) und nutzen deren Materialien
// (lodMetal/lodMatte bzw. das Tarnmuster des Klons) – kein neues Shaderprogramm, keine Textur, Nachlade-/Kipplauf-Bewegungen der
// Bot-Animation greifen weiter. Geometrie wird je Modell einmal geladen und von allen Klonen geteilt.
// Nicht auf Handys (grober Zeiger) und nicht auf „niedrig“: dort bleibt alles wie bisher (kein Laden, kein Speicher).
import * as THREE from 'three';

const BASE = new URL('../../../lib/waffen-lod/', import.meta.url);
const VER = new URL(import.meta.url).search || '';
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

let enabled = false;
let index = null, indexP = null;
const data = new Map();   // Modell → { levels: [[{ where, kind, geo }], …] } | null (fehlt) | Promise

/** Gebackene Stufen ein/aus (Grafikstufe: ab „mittel“ am PC). Aus: Klone fallen beim nächsten setWeaponLod auf die Bot-Fassung zurück. */
export function setWeaponLodEnabled(on) {
  enabled = !!on && !TOUCH;
  if (enabled && !indexP) indexP = fetch(new URL('index.json' + VER, BASE)).then((r) => (r.ok ? r.json() : null)).then((j) => { index = j && j.models ? j.models : {}; }).catch(() => { index = {}; });
  return enabled;
}
export function weaponLodEnabled() { return enabled; }

function decode(buf) {
  const dv = new DataView(buf), hl = dv.getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  const base = 4 + hl;
  const levels = head.levels.map((lv) => lv.groups.map((g) => {
    let o = base + g.off;
    const take = (Ctor, n) => { const a = new Ctor(buf, o, n); o += a.byteLength + ((4 - (a.byteLength % 4)) % 4); return a; };
    const q = take(Uint16Array, g.vc * 3), nn = take(Int8Array, g.vc * 4), cc = take(Uint8Array, g.vc * 4), I = take(g.big ? Uint32Array : Uint16Array, g.ic);
    const pos = new Float32Array(g.vc * 3), nrm = new Float32Array(g.vc * 3), col = new Float32Array(g.vc * 3);
    for (let i = 0; i < g.vc; i++) for (let a = 0; a < 3; a++) {
      pos[i * 3 + a] = g.min[a] + (q[i * 3 + a] / 65535) * g.ext[a];
      nrm[i * 3 + a] = nn[i * 4 + a] / 127;
      const c = cc[i * 4 + a] / 255; col[i * 3 + a] = c * c;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(g.big ? new Uint32Array(I) : new Uint16Array(I), 1));
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    return { where: g.where, kind: g.kind, geo };
  }));
  return { levels, tris: head.levels.map((l) => l.tris) };
}

/** Daten eines Modells: vorhanden → Objekt, fehlt → null, lädt noch → undefined (Laden wird angestoßen). */
function dataFor(key) {
  const d = data.get(key);
  if (d && !(d instanceof Promise)) return d;
  if (d === null) return null;
  if (d) return undefined;
  if (!index) return undefined;
  if (!index[key]) { data.set(key, null); return null; }
  data.set(key, fetch(new URL(key + '.bin' + VER, BASE)).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { data.set(key, b ? decode(b) : null); })
    .catch(() => { data.set(key, null); }));
  return undefined;
}

/** Vorab laden (z. B. die Waffen, die Bots im Match tragen). */
export function prefetchWeaponLods(keys) { if (!enabled) return; for (const k of keys) if (k) dataFor(k); }

/**
 * Detailstufe eines Drittpersonen-Klons (createWeaponModel lod 'third') setzen: 0 nah, 1 mitte, 2 fern (Bot-Fassung). Klone mit
 * sichtbaren Aufsätzen (eigene Vorlage) bleiben auf der Bot-Fassung (die gebackenen Netze zeigen die Werkswaffe). → tatsächliche Stufe
 */
export function setWeaponLod(model, level) {
  const ud = model && model.userData;
  if (!ud || ud.lod !== 'third') return 2;
  let want = enabled && level < 2 && !(ud.tpl && ud.tpl.includes('|')) ? level : 2;
  let lv = ud.lodBake;
  if (want < 2 && !lv) {
    const d = dataFor(ud.key);
    if (!d) want = 2;
    else lv = ud.lodBake = attach(model, d);
  }
  if (ud.lodLevel === want) return want;
  ud.lodLevel = want;
  if (ud.farMeshes) for (const m of ud.farMeshes) m.visible = want === 2;
  if (lv) lv.forEach((ms, i) => { for (const m of ms) m.visible = i === want; });
  return want;
}

function attach(model, d) {
  // Bot-Netze je Baugruppe ('gruppe:metal|matte') – deren Material (Tarnmuster) und Schattenwurf übernehmen die neuen Netze
  const far = [], byName = new Map();
  model.traverse((o) => { if (o.isMesh && /^[^:]+:(metal|matte)$/.test(o.name)) { far.push(o); byName.set(o.name, o); } });
  model.userData.farMeshes = far;
  return d.levels.map((groups, li) => groups.map((g) => {
    const host = g.where === 'root' ? model : model.getObjectByName(g.where);
    const twin = byName.get(g.where + ':' + g.kind) || byName.get(g.where + ':' + (g.kind === 'metal' ? 'matte' : 'metal')) || far[0];
    const m = new THREE.Mesh(g.geo, twin ? twin.material : undefined);
    m.name = g.where + ':' + g.kind + ':lod' + li;
    m.castShadow = twin ? twin.castShadow : true; m.receiveShadow = false;
    m.frustumCulled = twin ? twin.frustumCulled : true;
    m.visible = false;
    (host || model).add(m);
    return m;
  }));
}

/** Speicher (Matchende/Stufe „niedrig“): geladene Netze freigeben – Klone mit angehängten Netzen behalten sie bis zum Entsorgen. */
export function disposeWeaponLods() {
  for (const d of data.values()) if (d && !(d instanceof Promise)) for (const lv of d.levels) for (const g of lv) g.geo.dispose();
  data.clear();
}
