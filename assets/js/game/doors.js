// NULLPUNKT — Bewegliche Türen und Tore (Daten aus dem Kartenbau: world.doors aus arch.js, world.gates z. B. die Rolltore
// der Hafen-Lagerhalle). Türen: F öffnet/schließt; geschlossen hält sie Gehende auf, wer im Sprint dagegenläuft, rammt
// sie auf; Bots öffnen sie im Vorbeigehen; Schüsse gehen durch (Holz, combat.js Durchschlag) und zerlegen sie nach
// genug Treffern; Explosionen reißen sie heraus. Tore: Schaltpult innen und außen (F) fährt das Tor hoch bzw. runter.
// Kollision/Kugeln über die beweglichen Festkörper von building.js (addSolid). Online entscheidet der Host:
// Client → 'door' {i, a: 't' (umschalten) | 'k' (auframmen) | 'h' (Treffer), d}; Host → 'ev' dr {i, s, b, k} an alle.
// Fenster (world.windows, arch.js glass): Flügel mit Scheibe, F öffnet nach innen; Kugel, Messerhieb oder Explosion
// zerbricht die Scheibe (Splitter, Klirren) – danach offen zum Durchsteigen/-schießen. Gezeichnet gebündelt (zwei
// InstancedMesh für alle Scheiben und Rahmen), Reihenfolge der Einträge: Türen, Fenster, Tore (gleich auf allen Geräten).
import * as THREE from 'three';
import { worldPartsFrom, worldPartsMatrix } from './building.js?v=20261115041504';

const DOOR_HP = 420;   // Kugeln: die Tür wird erst durchlöchert, zerfällt spät (Explosionen reißen sie sofort heraus)
const HINGE_HP = 70;   // je Scharnier (Treffer im Umkreis); beide hin → Tür lose, kippt bei Berührung
const HINGE_R = 0.2;   // Trefferumkreis um ein Scharnier (m)
const DOOR_T = 0.06;
const OPEN_TIME = 0.55, KICK_TIME = 0.14, GATE_TIME = 3.2;
const USE_REACH = 1.6, PANEL_REACH = 1.4;
const WIN_T = 0.05, WIN_BAR = 0.055;
const _wm = new THREE.Matrix4(), _wz = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * tex4 (15.11.): Fensterglas mit Fresnel – frontal durchsichtig (≈ 22 % Deckung), zum flachen Blick hin spiegelnd
 * (bis 88 %), dazu leichte Schlieren/Staub in Weltkoordinaten (Rauheit/Deckung schwanken). Vorher: überall gleiche 32 %
 * Deckung und hellblaue Eigenfarbe – wirkte wie eine getönte Folie ohne Spiegelung, dunkle Räume als schwarze Flächen.
 * interior (ab high): „Interior Mapping“ – hinter Scheiben, deren Raum nicht begehbar ist (kein Wegenetz-Knoten dahinter,
 * Doors._winInterior), zeichnet der Shader einen Raum per Strahlschnitt (Rückwand, Seitenwände, Dielenboden, Decke,
 * Möbelband, Gardinen; Farben je Fenster gewürfelt, Helligkeit aus dem Umgebungslicht der Scheibe). Nah (< 4 m), offen
 * oder von innen gesehen: normales Glas (begehbare Räume zeigen immer den echten Raum – keine versteckten Gegner).
 */
function fresnelGlass(m, interior) {
  m.onBeforeCompile = (sh) => {
    let vs = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNpGw;' + (interior ? '\nattribute vec4 npWin;\nvarying vec3 vNpRay;\nvarying vec2 vNpUv;\nvarying vec4 vNpWin;\nvarying vec2 vNpSize;' : ''))
      .replace('#include <project_vertex>', `#include <project_vertex>
      {
        vec4 npW = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
        npW = instanceMatrix * npW;
        #endif
        vNpGw = ( modelMatrix * npW ).xyz;
        ${interior ? `#ifdef USE_INSTANCING
        mat4 npIM = modelMatrix * instanceMatrix;
        vec3 npAx = npIM[ 0 ].xyz, npAy = npIM[ 1 ].xyz;
        float npWd = length( npAx ), npHt = length( npAy );
        vec3 npNx = npAx / npWd, npNy = npAy / npHt, npNz = normalize( npIM[ 2 ].xyz ) * npWin.x;
        vec3 npRd = vNpGw - cameraPosition;
        vNpRay = vec3( dot( npRd, npNx ), dot( npRd, npNy ), dot( npRd, npNz ) );
        vNpUv = ( position.xy + 0.5 ) * vec2( npWd, npHt );
        vNpSize = vec2( npWd, npHt );
        vNpWin = npWin;
        #endif` : ''}
      }`);
    sh.vertexShader = vs;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vNpGw;
      float npGh( vec2 p ) { return fract( sin( dot( floor( p ), vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      float npGn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( npGh( i ), npGh( i + vec2( 1, 0 ) ), f.x ), mix( npGh( i + vec2( 0, 1 ) ), npGh( i + vec2( 1, 1 ) ), f.x ), f.y ); }
      ${interior ? `varying vec3 vNpRay; varying vec2 vNpUv; varying vec4 vNpWin; varying vec2 vNpSize;
      vec3 npPal( float s ) {
        float k = fract( s * 4.13 );
        return k < 0.3 ? vec3( 0.62, 0.58, 0.5 ) : k < 0.55 ? vec3( 0.55, 0.6, 0.6 ) : k < 0.75 ? vec3( 0.66, 0.55, 0.42 ) : k < 0.9 ? vec3( 0.7, 0.7, 0.66 ) : vec3( 0.45, 0.5, 0.42 );
      }
      // Raum hinter der Scheibe: p = Punkt auf der Scheibe (m, Ursprung unten links), d = Blickrichtung (lokal, z < 0 = hinein)
      vec3 npRoom( vec2 p, vec3 d, vec2 S, float seed ) {
        float RW = max( S.x * 2.4, 3.2 ), D = 3.0 + fract( seed * 7.1 ) * 2.0;
        float fl = -0.9, ce = S.y + 0.5;
        float xl = S.x * 0.5 - RW * 0.5, xr = S.x * 0.5 + RW * 0.5;
        float tz = -D / d.z;
        float tx = d.x > 0.0 ? ( xr - p.x ) / d.x : ( xl - p.x ) / min( d.x, -1e-4 );
        float ty = d.y > 0.0 ? ( ce - p.y ) / d.y : ( fl - p.y ) / min( d.y, -1e-4 );
        float t = min( tz, min( tx, ty ) );
        vec3 h = vec3( p, 0.0 ) + d * t;
        vec3 wall = npPal( seed ), c;
        if ( t == tz ) {
          c = wall * 0.95;
          float fx = S.x * 0.5 + ( fract( seed * 3.3 ) - 0.5 ) * RW * 0.6, fw = 0.5 + fract( seed * 5.7 ) * 0.8;
          float furn = step( h.y, fl + 0.55 + fract( seed * 2.9 ) * 0.5 ) * step( abs( h.x - fx ), fw );
          c = mix( c, vec3( 0.16, 0.12, 0.1 ) * ( 0.8 + 0.4 * fract( seed * 8.1 ) ), furn );
          float pic = step( abs( h.x - ( S.x * 0.5 - fx * 0.3 ) ), 0.35 ) * step( abs( h.y - ( S.y * 0.7 ) ), 0.25 ) * step( 0.5, fract( seed * 6.7 ) );
          c = mix( c, vec3( 0.2, 0.18, 0.15 ), pic * 0.8 );
        } else if ( t == tx ) {
          c = wall * 0.78;
          float shelf = step( 0.6, fract( seed * 11.3 ) ) * step( h.y, fl + 1.9 ) * step( -h.z, D * 0.7 ) * step( D * 0.25, -h.z );
          c = mix( c, vec3( 0.22, 0.17, 0.12 ), shelf * 0.85 );
        } else if ( d.y < 0.0 ) {
          c = vec3( 0.34, 0.25, 0.17 ) * ( 0.82 + 0.18 * step( 0.5, fract( h.x * 4.5 + floor( -h.z * 0.7 ) * 0.37 ) ) );
        } else c = vec3( 0.8, 0.79, 0.76 );
        c *= 0.55 * exp( h.z * 0.2 ) + 0.12; // tiefer im Raum dunkler (Licht kommt durchs Fenster)
        // Gardinen 10 cm hinter der Scheibe (70 % der Fenster)
        if ( fract( seed * 13.3 ) < 0.7 ) {
          float tc = -0.1 / d.z; vec2 q = p + d.xy * tc;
          float cw = S.x * ( 0.16 + 0.14 * fract( seed * 9.7 ) );
          if ( q.y > -0.1 && q.y < S.y + 0.2 && ( q.x < cw || q.x > S.x - cw ) ) {
            vec3 cc = fract( seed * 17.1 ) < 0.5 ? vec3( 0.78, 0.74, 0.64 ) : vec3( 0.55, 0.5, 0.42 );
            c = cc * ( 0.72 + 0.28 * sin( q.x * 60.0 ) ) * 0.7;
          }
        }
        return c;
      }` : ''}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      vec2 npGp = vNpGw.xy * vec2( 1.0, 0.6 ) + vNpGw.zz * vec2( 1.0, 0.0 );
      float npDirt = npGn( npGp * 3.1 ) * 0.6 + npGn( npGp * 11.0 ) * 0.4;
      npDirt = smoothstep( 0.45, 0.95, npDirt );
      roughnessFactor = clamp( roughnessFactor + npDirt * 0.22, 0.0, 1.0 );`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
      {
        float npFr = pow( 1.0 - clamp( abs( dot( normal, normalize( vViewPosition ) ) ), 0.0, 1.0 ), 4.0 );
        float npA = clamp( mix( 0.22, 0.88, npFr ) + npDirt * 0.12, 0.0, 0.95 );
        ${interior ? `if ( vNpWin.y > 0.5 && vNpRay.z < 0.0 ) {
          float npK = smoothstep( 3.0, 5.0, length( vNpRay ) );
          vec3 npIrr = reflectedLight.indirectDiffuse / max( diffuseColor.rgb, vec3( 1e-3 ) );
          vec3 npRm = npRoom( vNpUv, normalize( vNpRay ), vNpSize, vNpWin.z ) * npIrr * ( 1.0 - npFr ) * ( 1.0 - npDirt * 0.25 );
          vec3 npOpaque = gl_FragColor.rgb + npRm;
          float npA2 = mix( npA, 1.0, npK );
          gl_FragColor.rgb = mix( gl_FragColor.rgb * npA, npOpaque, npK ) / npA2;
          npA = npA2;
        }` : ''}
        gl_FragColor.a = npA;
      }`);
  };
  m.customProgramCacheKey = () => 'np-fresnel-glass-2' + (interior ? 'i' : '');
  return m;
}

let MATS = null;
function mats() {
  if (MATS) return MATS;
  MATS = {
    wood: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.8 }),
    gate: new THREE.MeshStandardMaterial({ color: 0xc9cdc9, roughness: 0.55, metalness: 0.45 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.6, metalness: 0.4 }),
    green: new THREE.MeshStandardMaterial({ color: 0x2fae4a, emissive: 0x2fae4a, emissiveIntensity: 0.8 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc8352a, emissive: 0xc8352a, emissiveIntensity: 0.8 }),
    box: new THREE.BoxGeometry(1, 1, 1),
    glass: fresnelGlass(new THREE.MeshStandardMaterial({ color: 0x1e2428, roughness: 0.05, metalness: 0, envMapIntensity: 2.2, transparent: true, opacity: 0.32, depthWrite: false }), false),
    frame: new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 0.7 }),
    tints: new Map(),
  };
  return MATS;
}
function woodMat(tint) {
  if (!tint) return mats().wood;
  let m = MATS.tints.get(tint);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: new THREE.Color(tint), roughness: 0.75 }); MATS.tints.set(tint, m); }
  return m;
}
const ang = (d) => Math.atan2(-d[1], d[0]); // Richtung (x, z) → rotation.y (lokal +x zeigt dorthin)
const lerpAng = (a, b, t) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; };

export class Doors {
  constructor(G) {
    this.G = G;
    this.items = []; // Türen dann Tore (gleiche Indizes auf allen Geräten)
    this.near = null;
    this.group = new THREE.Group();
    this.group.name = 'tueren';
    const W = G.world;
    const M = mats();
    for (const d of (W && W.doors) || []) {
      const pivot = new THREE.Group();
      pivot.position.set(d.hx, d.y, d.hz);
      const leaf = new THREE.Mesh(M.box, woodMat(d.tint));
      leaf.scale.set(d.w, d.h, DOOR_T);
      leaf.position.set(d.w / 2, d.h / 2, 0);
      leaf.castShadow = leaf.receiveShadow = true;
      pivot.add(leaf);
      // Klinke
      const knob = new THREE.Mesh(M.box, M.panel);
      knob.scale.set(0.12, 0.03, 0.14);
      knob.position.set(d.w - 0.1, 1.0, 0);
      pivot.add(knob);
      // Scharniere (zwei Bänder an der Angelseite)
      const hingeY = [0.22, d.h - 0.25];
      const hinges = hingeY.map((hy) => {
        const hm = new THREE.Mesh(M.box, M.panel);
        hm.scale.set(0.035, 0.11, DOOR_T + 0.02);
        hm.position.set(0.012, hy, 0);
        pivot.add(hm);
        return hm;
      });
      pivot.rotation.order = 'YXZ'; // Gier (Öffnen), dann Kippen um die Unterkante (umfallende Tür)
      this.group.add(pivot);
      pivot.userData.snapZ = DOOR_T / 2; // Einschusslöcher bleiben auf dem Blatt, auch wenn es schief hängt
      // Raumseite in lokaler z-Richtung (dorthin hängt eine Tür mit zerschossenem Band durch)
      const rs = -d.dc[1] * d.dopen[0] + d.dc[0] * d.dopen[1] >= 0 ? 1 : -1;
      const it = { type: 'door', d, mesh: pivot, t: d.open ? 1 : 0, target: d.open ? 1 : 0, speed: 1 / OPEN_TIME, hp: DOOR_HP, broken: false, solid: null,
        hingeY, hinges, hingeHp: [HINGE_HP, HINGE_HP], loose: false, fall: 0, th: 0, w: 0, sag: 0, sagY: 0, rs };
      it.solid = { id: `door${this.items.length}`, def: { surface: 'wood' }, mesh: pivot, attach: pivot, thick: DOOR_T, parts: [], onHit: (dmg, by, def, hit) => this._hit(it, dmg, by, hit) };
      this.items.push(it);
    }
    // Fenster: Flügel-Teile als Instanzen (Scheibe + Rahmenleisten), Lage über einen unsichtbaren Drehpunkt
    const wins = (W && W.windows) || [];
    if (wins.length) {
      const bars = wins.reduce((n, w) => n + (w.transom ? 6 : 5), 0);
      // tex4: ab high Innenraum-Darstellung hinter Scheiben nicht begehbarer Räume (eigene Geometrie: Instanz-Attribut npWin)
      const hiQ = G.renderer?.quality === 'high' || G.renderer?.quality === 'ultra';
      if (hiQ) {
        const gg = new THREE.BoxGeometry(1, 1, 1);
        this._winAttr = new THREE.InstancedBufferAttribute(new Float32Array(wins.length * 4), 4);
        gg.setAttribute('npWin', this._winAttr);
        if (!MATS.glassIn) MATS.glassIn = fresnelGlass(M.glass.clone(), true);
        this.winGlass = new THREE.InstancedMesh(gg, MATS.glassIn, wins.length);
      } else this.winGlass = new THREE.InstancedMesh(M.box, M.glass, wins.length);
      this.winFrame = new THREE.InstancedMesh(M.box, M.frame, bars);
      this.winGlass.name = 'fenster:scheiben'; this.winFrame.name = 'fenster:rahmen';
      this.winFrame.castShadow = true;
      this.winGlass.renderOrder = 2;
      this.winGlass.frustumCulled = this.winFrame.frustumCulled = false;
      this.group.add(this.winFrame, this.winGlass);
    }
    let bar = 0;
    wins.forEach((d, k) => {
      const pivot = new THREE.Object3D();
      pivot.position.set(d.hx, d.y, d.hz);
      const B = WIN_BAR, L = (x, y, w, h, t) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, 0), new THREE.Quaternion(), new THREE.Vector3(w, h, t));
      const parts = [L(B / 2, d.h / 2, B, d.h, WIN_T), L(d.w - B / 2, d.h / 2, B, d.h, WIN_T), L(d.w / 2, B / 2, d.w, B, WIN_T), L(d.w / 2, d.h - B / 2, d.w, B, WIN_T), L(d.w / 2, d.h / 2, B * 0.8, d.h, WIN_T * 0.9)];
      if (d.transom) parts.push(L(d.w / 2, d.h * 0.62, d.w, B * 0.8, WIN_T * 0.9));
      const it = { type: 'window', d, mesh: pivot, t: d.open ? 1 : 0, target: d.open ? 1 : 0, speed: 1 / OPEN_TIME, hp: 1, broken: false, solid: null,
        glass: k, glassM: L(d.w / 2, d.h / 2, d.w - B, d.h - B, 0.012), bars: parts.map((m, j) => ({ i: bar + j, m })) };
      bar += parts.length;
      it.solid = { id: `win${k}`, def: { surface: 'glass' }, mesh: pivot, parts: [], onHit: (dmg, by) => this._hit(it, dmg, by) };
      if (this._winAttr) {
        const a0 = ang(d.dc), lz = [Math.sin(a0), Math.cos(a0)];
        it.inner = this._winInterior(W, d);
        this._winAttr.setXYZW(k, lz[0] * d.dopen[0] + lz[1] * d.dopen[1] > 0 ? -1 : 1, it.inner ? 1 : 0, (Math.sin(d.hx * 12.9898 + d.hz * 78.233 + d.y * 3.1) * 43758.5453) % 1 + 1, 0);
      }
      this.items.push(it);
    });
    for (const g of (W && W.gates) || []) {
      const mesh = new THREE.Mesh(M.box, M.gate);
      mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh);
      const lamps = [];
      for (const [px, pz, pry] of g.panels || []) {
        const post = new THREE.Group();
        post.position.set(px, g.y, pz);
        post.rotation.y = pry;
        const box = new THREE.Mesh(M.box, M.panel);
        box.scale.set(0.32, 0.45, 0.14);
        box.position.set(0, 1.25, 0);
        const pole = new THREE.Mesh(M.box, M.panel);
        pole.scale.set(0.08, 1.05, 0.08);
        pole.position.set(0, 0.52, 0);
        const lamp = new THREE.Mesh(M.box, M.green);
        lamp.scale.set(0.08, 0.08, 0.04);
        lamp.position.set(0, 1.32, 0.08);
        post.add(box, pole, lamp);
        this.group.add(post);
        lamps.push(lamp);
      }
      const top = g.y + g.h;
      const it = { type: 'gate', d: g, mesh, lamps, bottom: g.bottom ?? 0, target: g.bottom ?? 0, open: (g.bottom ?? 0) > 1, solid: null };
      it.solid = { id: `gate${this.items.length}`, def: { surface: 'metal' }, mesh, parts: [] };
      it.top = top;
      this.items.push(it);
    }
    if (G.scene) G.scene.add(this.group);
    for (const it of this.items) { this._pose(it); if (G.building) G.building.addSolid(it.solid); }
    this._offs = [G.events.on('explosion', (e) => this._onExplosion(e)), G.events.on('impact', (e) => this._melee(e))];
  }

  get replica() { return this.G.match && this.G.match.netRole === 'client'; }

  /** Lage der Tür bzw. des Tors + Kollisionsteile. */
  _pose(it) {
    if (it.type === 'door') {
      const d = it.d;
      const a = lerpAng(ang(d.dc), ang(d.dopen), it.t);
      it.mesh.rotation.y = a;
      // ein Scharnier zerschossen: Blatt kippt um das verbliebene Band aus der Ebene (nie in Rahmen oder Sturz)
      const phi = it.fall ? it.fall * it.th : it.sag;
      it.mesh.rotation.x = phi;
      const yc = it.fall ? 0 : it.sagY, sp = Math.sin(phi);
      it.mesh.position.set(d.hx - yc * sp * Math.sin(a), d.y + yc * (1 - Math.cos(phi)), d.hz - yc * sp * Math.cos(a));
      // Kollision/Kugeln folgen dem Blatt genau (auch schief hängend); fallend erst, wenn es liegt (flaches Brett)
      it.mesh.updateMatrixWorld(true);
      it.solid.parts = it.broken || (it.fall && it.th <= 1.45) ? [] : worldPartsMatrix([[d.w / 2, d.h / 2, 0, d.w / 2, d.h / 2, DOOR_T / 2 + (it.fall ? 0.02 : 0)]], it.mesh.matrixWorld);
    } else if (it.type === 'window') {
      const d = it.d;
      const a = lerpAng(ang(d.dc), ang(d.dopen), it.t);
      it.mesh.rotation.y = a;
      it.mesh.updateMatrix();
      this.winGlass.setMatrixAt(it.glass, it.broken ? _wz : _wm.multiplyMatrices(it.mesh.matrix, it.glassM));
      if (this._winAttr && it.inner) { const on = !it.broken && it.t < 0.01 ? 1 : 0; if (this._winAttr.getY(it.glass) !== on) { this._winAttr.setY(it.glass, on); this._winAttr.needsUpdate = true; } }
      for (const b of it.bars) this.winFrame.setMatrixAt(b.i, it.broken ? _wz : _wm.multiplyMatrices(it.mesh.matrix, b.m));
      this.winGlass.instanceMatrix.needsUpdate = this.winFrame.instanceMatrix.needsUpdate = true;
      it.solid.parts = it.broken ? [] : worldPartsFrom([[d.w / 2, d.h / 2, 0, d.w / 2, d.h / 2, WIN_T / 2, 0]], d.hx, d.y, d.hz, a);
    } else {
      const g = it.d;
      const h = Math.max(0.02, it.top - (g.y + it.bottom));
      const along = g.axis === 'z';
      it.mesh.scale.set(along ? g.t : g.w, h, along ? g.w : g.t);
      it.mesh.position.set(g.x, g.y + it.bottom + h / 2, g.z);
      it.solid.parts = h > 0.15 ? worldPartsFrom([[0, it.bottom + h / 2, 0, (along ? g.t : g.w) / 2, h / 2, (along ? g.w : g.t) / 2, 0]], g.x, g.y, g.z, 0) : [];
      const M = mats();
      for (const l of it.lamps) l.material = it.target > 1 ? M.green : M.red;
    }
  }

  /** tex4: Raum hinter einem Fenster nicht begehbar? (kein Wegenetz-Knoten in ≈ 1–3 m dahinter auf Bodenhöhe) */
  _winInterior(W, d) {
    const nav = W?.nav;
    if (!nav?.nodesInRadius) return false;
    const cx = d.hx + d.dc[0] * d.w / 2 + d.dopen[0] * 1.8, cz = d.hz + d.dc[1] * d.w / 2 + d.dopen[1] * 1.8;
    const fy = d.y - 0.9;
    const near = nav.nodesInRadius(new THREE.Vector3(cx, fy, cz), 2.4);
    return !near.some(n => Math.abs(n.position.y - fy) < 1.3);
  }

  update(dt) {
    const G = this.G;
    const P = G.player;
    for (const it of this.items) {
      if (it.type === 'door' && it.fall && it.th < Math.PI / 2) {
        // Blatt kippt um die Unterkante (Stab: ω̇ = 3g/(2h)·sin θ), schlägt flach auf
        it.w += ((3 * 9.81) / (2 * it.d.h)) * Math.sin(Math.max(0.05, it.th)) * dt;
        it.th = Math.min(Math.PI / 2 - 0.03, it.th + it.w * dt);
        if (it.th >= Math.PI / 2 - 0.031) { it.th = Math.PI / 2 - 0.03; it.w = 0; this._landed(it); }
        this._pose(it);
        continue;
      }
      if (it.type === 'door' && it.loose && !it.fall && !this.replica) {
        // lose Tür: wer dagegenläuft, kippt sie um
        for (const a of this.G.actors || []) {
          if (!a.alive || !a.position || Math.abs(a.position.y - it.d.y) > 1.2) continue;
          if (this._doorDist(it, a.position) < 0.55) { this._topple(it, a.position); break; }
        }
      }
      if (it.type === 'door' || it.type === 'window') {
        if (it.t !== it.target) {
          const step = dt * it.speed;
          it.t = it.t < it.target ? Math.min(it.target, it.t + step) : Math.max(it.target, it.t - step);
          this._pose(it);
        }
      } else if (it.bottom !== it.target) {
        const step = dt * (it.d.h / GATE_TIME);
        it.bottom = it.bottom < it.target ? Math.min(it.target, it.bottom + step) : Math.max(it.target, it.bottom - step);
        this._pose(it);
      }
    }
    if (!this.replica) this._botsOpen();
    this.near = null;
    if (!P || !P.alive || P.vehicle || P.piloting || P.mounted || P.building || G.match.state !== 'playing') return;
    // im Sprint gegen eine geschlossene Tür: auframmen
    if (P.sprinting) {
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        if (it.type !== 'door' || it.broken || it.fall || it.target > 0 || it.t > 0.05) continue;
        if (this._doorDist(it, P.position) < 0.75 && Math.abs(P.position.y - it.d.y) < 1.2) { if (it.loose && !this.replica) this._topple(it, P.position); else this.request(i, 'k'); break; }
      }
    }
    // F: nächste Tür bzw. nächstes Schaltpult
    if (G.points && G.points.near) return;
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it.broken || it.fall) continue;
      let dd = Infinity;
      if (it.type === 'door') { if (Math.abs(P.position.y - it.d.y) < 1.2) dd = this._doorDist(it, P.position) - USE_REACH; }
      else if (it.type === 'window') { if (P.position.y > it.d.y - 1.6 && P.position.y < it.d.y + 0.6) dd = this._winDist(it, P.position) - USE_REACH; }
      else for (const [px, pz] of it.d.panels || []) dd = Math.min(dd, Math.hypot(px - P.position.x, pz - P.position.z) - PANEL_REACH);
      if (dd < 0 && dd < bd) { bd = dd; best = i; }
    }
    if (best < 0) return;
    const it = this.items[best];
    this.near = { i: best, text: it.type === 'window' ? (it.target > 0.5 ? 'Fenster schließen' : 'Fenster öffnen') : it.type === 'door' ? (it.target > 0.5 ? 'Tür schließen' : 'Tür öffnen') : (it.target > 1 ? 'Tor schließen (Schaltpult)' : 'Tor öffnen (Schaltpult)') };
    if (G.input && G.input.pressed('interact') && !(G.mode && G.mode.id === 'training')) { G.input.consume('interact'); this.request(best, 't'); }
  }

  /** waagerechter Abstand eines Punkts zur Türfläche (Mitte des Blatts). */
  _doorDist(it, p) {
    const d = it.d;
    const a = it.mesh.rotation.y, dx = Math.cos(a), dz = -Math.sin(a);
    const px = p.x - d.hx, pz = p.z - d.hz;
    const along = Math.max(0, Math.min(d.w, px * dx + pz * dz));
    return Math.hypot(px - dx * along, pz - dz * along);
  }

  /** Fenster: Abstand zur Fensteröffnung (geschlossene Lage), damit F auch am offenen Flügel greift. */
  _winDist(it, p) {
    const d = it.d, px = p.x - d.hx, pz = p.z - d.hz;
    const along = Math.max(0, Math.min(d.w, px * d.dc[0] + pz * d.dc[1]));
    return Math.hypot(px - d.dc[0] * along, pz - d.dc[1] * along);
  }

  /** Bots (offline/Host) öffnen Türen und Tore, vor denen sie stehen. */
  _botsOpen() {
    const G = this.G;
    this._botT = (this._botT || 0) + 1;
    if (this._botT % 10) return;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it.broken || it.type === 'window') continue;
      const closed = it.type === 'door' ? it.target < 0.5 && it.t < 0.5 : it.target < 1 && it.bottom < 2;
      if (!closed) continue;
      for (const a of G.actors) {
        if (!a.alive || !a.isBot || a.isRemoteHuman) continue;
        const near = it.type === 'door'
          ? this._doorDist(it, a.position) < 0.9 && Math.abs(a.position.y - it.d.y) < 1.2
          : Math.abs(a.position.x - it.d.x) < (it.d.axis === 'z' ? 1.3 : it.d.w / 2) && Math.abs(a.position.z - it.d.z) < (it.d.axis === 'z' ? it.d.w / 2 : 1.3);
        if (near) { this._apply(i, it.type === 'door' ? 1 : 2, false); break; }
      }
    }
  }

  /** Spieler-Aktion: offline/Host sofort, Client fragt den Host. */
  request(i, a, dmg = 0, x = 0) {
    const it = this.items[i];
    if (!it) return;
    if (this.replica) {
      const sync = this.G.net && this.G.net.sync;
      const now = this.G.time.elapsed;
      if (a !== 'h' && a !== 'g' && now - (it._reqAt || -1) < 0.6) return; // nicht jedes Bild erneut anfragen
      it._reqAt = now;
      if (sync && typeof sync.sendDoor === 'function') sync.sendDoor(i, a, dmg, x);
      return;
    }
    this.act(i, a, this.G.player, dmg, x);
  }

  /** Offline/Host: Aktion ausführen (actor für Abstandsprüfung online). → bool */
  act(i, a, actor, dmg = 0, x = 0) {
    const it = this.items[i];
    if (!it || it.broken) return false;
    if (a === 'h') { this._hit(it, dmg, actor); return true; }
    if (a === 'g' && it.type === 'door') { this._hingeDamage(it, x === 1 ? 1 : 0, dmg); return true; }
    if (a === 'p' && it.type === 'door') { if (it.loose) this._topple(it, null, x > 0 ? -1 : 1); return true; }
    if (it.type === 'door' && it.fall) return false;
    if (it.type === 'door' && it.loose && (a === 't' || a === 'k')) {
      // lose Tür: Anfassen oder Dagegenrennen wirft sie um (vom Spieler weg)
      if (actor && actor.position && this._doorDist(it, actor.position) > USE_REACH + 1) return false;
      this._topple(it, actor && actor.position ? actor.position : null);
      return true;
    }
    if (actor && actor.position) {
      const far = it.type === 'window' ? this._winDist(it, actor.position) > USE_REACH + 1 : it.type === 'door' ? this._doorDist(it, actor.position) > USE_REACH + 1 : !(it.d.panels || []).some(([px, pz]) => Math.hypot(px - actor.position.x, pz - actor.position.z) < PANEL_REACH + 1.5);
      if (far) return false;
    }
    if (it.type === 'gate') return this._apply(i, it.target > 1 ? 0 : it.top - it.d.y - 0.3, false);
    if (a === 'k') return it.type === 'window' ? false : this._apply(i, 1, true);
    return this._apply(i, it.target > 0.5 ? 0 : 1, false);
  }

  /** Zustand setzen (+ an Clients verteilen). door: s 0/1, gate: s = Unterkante. */
  _apply(i, s, kick, broken = false, fromNet = false) {
    const it = this.items[i];
    if (!it) return false;
    if (it.type === 'door' || it.type === 'window') {
      it.target = s;
      it.speed = 1 / (kick ? KICK_TIME : OPEN_TIME);
      if (kick) this._kickFx(it);
      else this._sound(it, 'gear', 0.5);
      if (broken && !it.broken) this._break(it);
    } else {
      it.target = s;
      this._sound(it, 'toggle', 0.9);
      this._pose(it);
    }
    const sync = this.G.net && this.G.net.sync;
    if (!fromNet && !this.replica && sync && typeof sync.relayDoor === 'function') sync.relayDoor(this._msg(i, kick));
    return true;
  }

  _msg(i, kick = false) {
    const it = this.items[i];
    const m = { i, s: Math.round((it.type === 'door' ? it.target : it.target) * 100) / 100, b: it.broken ? 1 : 0, k: kick ? 1 : 0 };
    if (it.type === 'door') { m.h = (it.hingeHp[0] > 0 ? 1 : 0) | (it.hingeHp[1] > 0 ? 2 : 0); if (it.fall) m.f = it.fall; }
    return m;
  }

  /** Abweichungen vom Kartenstand (für nachträglich beigetretene Clients). */
  snapshot() {
    const out = [];
    this.items.forEach((it, i) => {
      const def = it.type === 'door' || it.type === 'window' ? (it.d.open ? 1 : 0) : it.d.bottom ?? 0;
      if (it.broken || it.target !== def || it.fall || (it.type === 'door' && it.hingeHp.some((h) => h <= 0))) out.push(this._msg(i));
    });
    return out;
  }

  /** Client: Zustand vom Host ('ev' dr). */
  applyNet(m) {
    const it = this.items[m && m.i];
    if (!it) return;
    if (m.b && !it.broken) this._break(it);
    if (it.type === 'door' && Number.isInteger(m.h)) {
      for (let k = 0; k < 2; k++) if (!(m.h & (1 << k)) && it.hingeHp[k] > 0) { it.hingeHp[k] = 0; it.hinges[k].visible = false; }
      this._sagFromHinges(it);
      if ((m.f === 1 || m.f === -1) && !it.fall) { it.fall = m.f; it.th = 0.06; it.w = 0.6; }
      this._pose(it);
    }
    if (!it.broken && !it.fall) this._apply(m.i, Number(m.s) || 0, !!m.k, false, true);
  }

  /** Host: Wunsch eines Clients ('door' {i, a, d}). */
  netRequest(actor, m) {
    if (!actor || !actor.alive || !m || !Number.isInteger(m.i)) return;
    const a = ['k', 'h', 'g', 'p'].includes(m.a) ? m.a : 't';
    const dmg = a === 'h' || a === 'g' ? Math.max(0, Math.min(200, Number(m.d) || 0)) : 0;
    this.act(m.i, a, actor, dmg, m.x | 0);
  }

  /** Treffer (Kugel, combat.js onHit): Splitter, ab 0 Leben zerbricht die Tür. */
  _hit(it, dmg, by, hit) {
    if (it.broken || !(dmg > 0)) return;
    // Scharniere: Treffer nahe der Angelseite in Bandhöhe zerstören das Band (alle Geräte gleich aus dem Trefferpunkt);
    // liegende Tür: nur noch Holzschaden (zerfällt irgendwann)
    if (it.type === 'door' && !it.fall && hit && hit.point) this._hingeHit(it, hit.point, dmg, by);
    if (this.replica) {
      // Client: Treffer an den Host melden (gebündelt)
      if (by === this.G.player) this.request(this.items.indexOf(it), 'h', dmg);
      return;
    }
    it.hp -= dmg;
    if (it.hp <= 0) {
      this._break(it);
      const sync = this.G.net && this.G.net.sync;
      if (sync && typeof sync.relayDoor === 'function') sync.relayDoor(this._msg(this.items.indexOf(it)));
    }
  }

  /** Treffer am Scharnier (lokale Lage aus dem Trefferpunkt). Lose Tür: weiterer Treffer kippt sie vom Schützen weg. */
  _hingeHit(it, p, dmg, by) {
    const d = it.d;
    it.mesh.updateMatrixWorld(true);
    const lp = it.mesh.worldToLocal(p.clone());
    const i = this.items.indexOf(it);
    if (it.loose) {
      if (this.replica) { if (by === this.G.player) this.request(i, 'p', 0, lp.z < 0 ? 1 : -1); }
      else this._topple(it, by && by.position ? by.position : null, lp.z);
      return;
    }
    for (let k = 0; k < 2; k++) {
      if (it.hingeHp[k] <= 0) continue;
      if (lp.x > HINGE_R || Math.abs(lp.y - it.hingeY[k]) > HINGE_R) continue;
      if (this.replica) { if (by === this.G.player) this.request(i, 'g', dmg, k); }
      else this._hingeDamage(it, k, dmg);
    }
  }

  /** Offline/Host: Schaden an Scharnier k; reißt es, hängt die Tür schief bzw. ist lose (beide). */
  _hingeDamage(it, k, dmg) {
    if (it.hingeHp[k] <= 0 || it.fall) return;
    it.hingeHp[k] -= dmg;
    if (it.hingeHp[k] <= 0) {
      it.mesh.updateMatrixWorld(true);
      // Band reißt: Funken, Teil fällt weg
      it.hinges[k].visible = false;
      const hp = new THREE.Vector3(0.01, it.hingeY[k], 0).applyMatrix4(it.mesh.matrixWorld);
      this.G.events.emit('impact', { point: hp, normal: new THREE.Vector3(0, 1, 0), surface: 'metal', shooter: null, weaponId: null, fx: true });
      this._sound(it, 'impact_metal', 0.9);
    }
    const wasLoose = it.loose;
    this._sagFromHinges(it);
    if (it.loose && !wasLoose) this._sound(it, 'melee_hit', 0.5);
    this._pose(it);
    this._relayFall(it);
  }

  /** Lage nach den verbliebenen Bändern: eins hin → Blatt hängt am anderen schief in den Raum, beide hin → lose. */
  _sagFromHinges(it) {
    const ok = [it.hingeHp[0] > 0, it.hingeHp[1] > 0];
    it.loose = !ok[0] && !ok[1];
    if (ok[0] && ok[1]) { it.sag = 0; it.sagY = 0; }
    else if (ok[0]) { it.sag = it.rs * 0.035; it.sagY = it.hingeY[0]; } // oben los: Oberkante fällt in den Raum
    else if (ok[1]) { it.sag = -it.rs * 0.06; it.sagY = it.hingeY[1]; } // unten los: Unterkante schwingt heraus
    else { it.sag = it.rs * 0.045; it.sagY = 0; } // steht nur noch lose im Rahmen
  }

  /** Lose Tür kippt um – weg von der Position des Anstoßes (oder nach der Seite lz des Treffers). */
  _topple(it, from, lz = 0) {
    if (it.fall || it.broken) return;
    let side = lz < 0 ? 1 : -1;
    if (from) {
      it.mesh.updateMatrixWorld(true);
      const lp = it.mesh.worldToLocal(from.clone());
      side = lp.z > 0 ? -1 : 1;
    }
    it.fall = side;
    it.th = 0.06; it.w = 0.6;
    it.target = it.t;
    this._sound(it, 'melee_hit', 0.8);
    this._pose(it);
    this._relayFall(it);
    this.G.events.emit('door:fall', { door: it });
  }

  /** Tür liegt: Aufschlag (Staub, dumpfer Schlag). */
  _landed(it) {
    const d = it.d;
    it.mesh.updateMatrixWorld(true);
    const c = new THREE.Vector3(d.w / 2, d.h * 0.7, 0).applyMatrix4(it.mesh.matrixWorld);
    this.G.events.emit('impact', { point: c, normal: new THREE.Vector3(0, 1, 0), surface: 'wood', shooter: null, weaponId: null, fx: true, scale: 1.8 });
    const au = this.G.audio;
    if (au && typeof au.play === 'function') { try { au.play('debris', { position: c, volume: 1, pitch: 0.7 }); } catch { /* Beiwerk */ } }
  }

  _relayFall(it) {
    const sync = this.G.net && this.G.net.sync;
    if (!this.replica && sync && typeof sync.relayDoor === 'function') sync.relayDoor(this._msg(this.items.indexOf(it)));
  }

  _break(it) {
    if (it.type === 'window') return this._shatter(it);
    it.broken = true;
    it.hp = 0;
    it.mesh.visible = false;
    it.solid.parts = [];
    if (this.G.building) this.G.building.removeSolid(it.solid);
    // Splitter (Einschläge rund um die Türmitte)
    const d = it.d;
    const a = it.mesh.rotation.y, dx = Math.cos(a), dz = -Math.sin(a);
    for (let k = 0; k < 5; k++) {
      const s = 0.15 + (k / 4) * (d.w - 0.3);
      const p = new THREE.Vector3(d.hx + dx * s, d.y + 0.4 + (k % 3) * 0.6, d.hz + dz * s);
      this.G.events.emit('impact', { point: p, normal: new THREE.Vector3(-dz, 0, dx), surface: 'wood', shooter: null, weaponId: null });
    }
    this._sound(it, 'impact_metal', 1);
    this.G.events.emit('door:broken', { door: it });
  }

  /** Fensterscheibe zerspringt: Flügel weg, Splitter auf beiden Seiten, Klirren. */
  _shatter(it) {
    it.broken = true;
    it.hp = 0;
    this._pose(it);
    if (this.G.building) this.G.building.removeSolid(it.solid);
    const d = it.d;
    const a = it.mesh.rotation.y, dx = Math.cos(a), dz = -Math.sin(a);
    const n = new THREE.Vector3(-dz, 0, dx);
    for (let k = 0; k < 6; k++) {
      const s = 0.12 + ((k % 3) / 2) * (d.w - 0.24);
      const p = new THREE.Vector3(d.hx + dx * s, d.y + 0.2 + (k < 3 ? 0.25 : 0.7) * d.h, d.hz + dz * s);
      this.G.events.emit('impact', { point: p, normal: k % 2 ? n.clone() : n.clone().negate(), surface: 'glass', shooter: null, weaponId: null, fx: true });
    }
    this._sound(it, 'impact_glass', 1.4);
    this.G.events.emit('window:broken', { window: it });
  }

  /** Messerhieb/Kolben gegen eine Scheibe (Nahkampf trifft die Fläche, 'impact' melee). */
  _melee(e) {
    if (!e || !e.melee || !e.point || e.surface !== 'glass' || e.fx) return;
    const G = this.G;
    if (this.replica && e.shooter !== G.player) return;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it.type !== 'window' || it.broken) continue;
      const d = it.d;
      if (e.point.y < d.y - 0.1 || e.point.y > d.y + d.h + 0.1 || (it.t > 0.05 ? this._doorDist(it, e.point) : this._winDist(it, e.point)) > 0.25) continue;
      if (this.replica) this.request(i, 'h', 50);
      else this._hit(it, 50, e.shooter);
      return;
    }
  }

  _kickFx(it) {
    this._sound(it, 'melee_hit', 1);
    this.G.events.emit('door:kick', { door: it });
  }

  _onExplosion(e) {
    if (!e || e.net || e.nonLethal || this.replica || !e.position) return;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if ((it.type !== 'door' && it.type !== 'window') || it.broken) continue;
      const reach = it.type === 'window' ? (e.radius || 4) * 1.4 + 2 : (e.radius || 4) * 0.8 + 1; // Glas springt weiter
      const dist = Math.hypot(it.d.hx - e.position.x, it.d.y + 1 - e.position.y, it.d.hz - e.position.z);
      if (dist >= reach) continue;
      if (it.type === 'door' && !it.fall && dist > (e.radius || 4) * 0.35 + 0.6) {
        // weiter weg: Druckwelle reißt das Blatt aus den Angeln, es kippt von der Explosion weg
        for (let k = 0; k < 2; k++) { it.hingeHp[k] = 0; it.hinges[k].visible = false; }
        this._sagFromHinges(it);
        this._topple(it, e.position);
      } else this._hit(it, 999, e.attacker);
    }
  }

  _sound(it, name, volume) {
    const au = this.G.audio;
    const p = it.type === 'door' || it.type === 'window' ? new THREE.Vector3(it.d.hx, it.d.y + 1, it.d.hz) : new THREE.Vector3(it.d.x, it.d.y + 1.5, it.d.z);
    if (au && typeof au.play === 'function') { try { au.play(name, { position: p, volume }); } catch { /* Klang ist Beiwerk */ } }
  }

  dispose() {
    for (const off of this._offs) off();
    this._offs.length = 0;
    if (this.G.building) for (const it of this.items) this.G.building.removeSolid(it.solid);
    this.items.length = 0;
    for (const m of [this.winGlass, this.winFrame]) if (m) m.dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
