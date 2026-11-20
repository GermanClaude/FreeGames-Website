// NULLPUNKT — Winkelspiegel, Periskope und Sichtgeräte je Besatzungsplatz (Nutzer 20.11.: „Gibt es auch Periskope? Es soll
// nicht nur Ladeschützen-Innenansicht geben, sondern auch Fahrer, MG-Schütze, Kommandant. Zudem soll man auch die Sitze
// wechseln können.“). Reine Daten/Rechnung ohne three.js – data.js hängt die Sichten beim Laden an (hinten an die Sichtliste:
// Sicht-Indizes im Netz bleiben gleich).
//
// Neue Sichten (alle mit peek: true – nicht in der Sicht-Taste „C“, sondern aus der Innensicht heraus „durchsehen“):
//   Fahrer       'winkel'  drei Winkelspiegel vorn (1. WK: Sehschlitz), Maus schwenkt von Spiegel zu Spiegel
//   Kommandant   'winkel'  Winkelspiegel rundum in der Kuppel (modern 6, sonst 7)
//   Ladeschütze  'winkel'  drehbarer Winkelspiegel vor seiner Luke (ohne Luke: im Turmdach über dem Platz)
//   Funker       'winkel'  Winkelspiegel im Wannendach vor seiner Luke; dazu 'innen' (Funkerplatz: Funkgerät, Kugelblende)
//   Richtschütze 'hilfs'   Hilfszielfernrohr neben der Hauptzieloptik (modern/Kalter Krieg)
// Format eines Winkelspiegels (view.prisms[i]): { head: Kamera am Spiegelkopf (außen, Raum der Sicht), yaw: Blickrichtung
// relativ zu Wanne/Turm (Gier, positiv = links), inner: Glas innen (Hotspot, Raum der Sicht), rot: drehbar (Blick = Spiegel) }.
// glass: 'modern' | 'kk' | 'wk2' | 'wk1' (Glasgüte im Overlay: Vergütung, Staub, Schlieren; 1. WK offener Sehschlitz).

const PI = Math.PI;
const wrap = (a) => { while (a > PI) a -= PI * 2; while (a < -PI) a += PI * 2; return a; };

/** Glasgüte nach Panzergeneration. */
export function glassOf(D) { return D.era === 'wk1' ? 'wk1' : D.era === 'wk2' ? 'wk2' : D.era === 'kk' ? 'kk' : 'modern'; }

/** Funkerplatz (Bug-MG, Wannenraum rechts vom Fahrer): gespiegelte Kammer wie der Fahrerraum. → { F, xl, xr, floor, roof, zFT, zFB, zB, eye, mg } | null */
export function funkerCabin(D, driverCabin) {
  if (!D || !D.cmgHull || !D.seats) return null;
  const s = D.seats.find((x) => x.id === 'funker');
  const R = driverCabin(D);
  if (!s || !R) return null;
  const hb = D.hullBox, F = s.pos;
  const hullTop = hb[1] + hb[4] - 0.06;
  const floor = Math.max(hb[1] - hb[4] + 0.1, F[1] - 0.02);
  const roof = Math.max(hullTop, floor + 1.0);
  const half = Math.max(0.6, hb[3] - 0.32);
  const xl = Math.max(R.xr + 0.02, F[0] - 0.56), xr = Math.min(half, F[0] + 0.56);
  const mg = D.cmgPivot || [F[0], roof - 0.3, R.zFT];
  const eye = [F[0] - 0.04, Math.min(Math.max(F[1] + 0.9, floor + 0.66), roof - 0.13), F[2] + 0.3];
  return { F, xl, xr, floor, roof, zFT: R.zFT, zFB: R.zFB, zB: R.zB, eye, mg };
}

/** Drei (1. WK: ein) Winkelspiegel des Fahrers – Lage wie cabin.js buildDriver. */
function driverPrisms(D, R) {
  const hb = D.hullBox, top = hb[1] + hb[4];
  const wk1 = D.era === 'wk1';
  const x0 = R.F[0], yR = R.roof, zFT = R.zFT;
  if (wk1) return [{ head: [x0, yR - 0.22, zFT - 0.06], yaw: 0, inner: [x0, yR - 0.22, zFT + 0.03], w: 0.36 }];
  const out = [];
  for (let k = 0; k < 3; k++) {
    const kk = k - 1, yaw = -kk * 0.35;
    const c = [x0 + kk * 0.26, yR - 0.085, zFT + 0.1 + Math.abs(kk) * 0.04];
    out.push({ head: [c[0] - Math.sin(yaw) * 0.06, Math.max(top, yR) + 0.07, zFT - 0.04], yaw, inner: [c[0] + Math.sin(-yaw) * 0.07, c[1] - 0.015, c[2] + Math.cos(yaw) * 0.07], w: 0.17 });
  }
  return out;
}

/** Winkelspiegel der Kommandantenkuppel – Lage wie cabin.js buildTurret (Gruppenraum → Turmraum über shift/scale). */
function cupolaPrisms(D, H) {
  const I = D.interior || {}, sh = I.shift || [0, 0, 0], sc = I.scale || 1;
  const modern = (D.era || 'modern') === 'modern';
  const n = modern ? 6 : 7;
  const hg = [(H.pos[0] - sh[0]) / sc, (H.pos[1] - sh[1]) / sc, (H.pos[2] - sh[2]) / sc], rg = H.r / sc;
  const yr = Math.min(hg[1], 0.75) - 0.03;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + 0.3;
    const sa = Math.sin(a), ca = Math.cos(a);
    const pg = [hg[0] + sa * (rg + 0.02), yr - 0.1, hg[2] + ca * (rg + 0.02)];
    const inner = [pg[0] * sc + sh[0] - sa * 0.04 * sc, (pg[1] + 0.005) * sc + sh[1], pg[2] * sc + sh[2] - ca * 0.04 * sc];
    const head = [H.pos[0] + sa * (H.r + 0.12), H.pos[1] + 0.14, H.pos[2] + ca * (H.r + 0.12)];
    out.push({ head, yaw: wrap(a + PI), inner, w: 0.11 });
  }
  return out;
}

/** Drehbarer Winkelspiegel des Ladeschützen (vor der Luke bzw. im Turmdach über dem Platz). */
export function loaderPrism(D) {
  const H = D.hatches && D.hatches.loader;
  if (H && H.space === 'turret') return [{ head: [H.pos[0], H.pos[1] + 0.13, H.pos[2] - H.r - 0.13], yaw: 0, inner: [H.pos[0], H.pos[1] - 0.13, H.pos[2] - H.r - 0.06], rot: true, w: 0.12 }];
  if (D.era === 'wk1') return null;
  const I = D.interior || {}, sh = I.shift || [0, 0, 0], sc = I.scale || 1, le = I.loaderEye || [0.55, 0.62, 0.35];
  const tb = D.turretBox, roof = tb[1] + tb[4];
  const ex = le[0] * sc + sh[0], ez = le[2] * sc + sh[2];
  return [{ head: [ex, roof + 0.1, ez - 0.32], yaw: 0, inner: [ex, roof - 0.14, ez - 0.26], rot: true, w: 0.12 }];
}

/** Winkelspiegel im Wannendach über dem Funker. */
function funkerPrism(D, R) {
  const hb = D.hullBox, top = hb[1] + hb[4];
  return [{ head: [R.F[0], top + 0.07, R.zFT - 0.04], yaw: 0, inner: [R.F[0], R.roof - 0.1, R.zFT + 0.17], w: 0.17 }];
}

/** Gierbereich, der alle Spiegel (± halbe Fensterbreite) überdeckt. */
function yawSpan(list) {
  if (list.some((p) => p.rot)) return [-PI, PI];
  if (list.length >= 5) return [-PI, PI];
  let a = Infinity, b = -Infinity;
  for (const p of list) { a = Math.min(a, p.yaw); b = Math.max(b, p.yaw); }
  return [a - 0.45, b + 0.45];
}

const prismView = (id, label, space, look, prisms, glass, extra = {}) => ({
  id, label, space, pos: prisms[0].head, look, yaw: yawSpan(prisms), pitch: [-0.28, 0.24], zoom: [1], overlay: 'prism', peek: true, prisms, glass, ...extra,
});

/**
 * Sichten anhängen (einmal je Typ, beim Laden von data.js; driverCabin aus data.js). Nur Kettenfahrzeuge mit Innenraum.
 */
export function addCrewViews(VEHICLES, driverCabin) {
  for (const D of Object.values(VEHICLES)) {
    if (!D || D.drive !== 'tracked' || !D.seats || D.civil || D._crewViews) continue;
    D._crewViews = true;
    const glass = glassOf(D);
    const has = (s, id) => (s.views || []).some((v) => v.id === id);
    const R = driverCabin(D);
    for (const s of D.seats) {
      if (!s.views) continue;
      if (s.drive && R && !has(s, 'winkel')) s.views.push(prismView('winkel', D.era === 'wk1' ? 'Sehschlitz' : 'Winkelspiegel', 'hull', 'rel', driverPrisms(D, R), glass));
      else if (s.id === 'commander') {
        const H = D.hatches && D.hatches.commander;
        if (H && H.space === 'turret' && D.era !== 'wk1' && s.views.some((v) => v.interior && v.space === 'turret') && !has(s, 'winkel')) s.views.push(prismView('winkel', 'Kuppel-Winkelspiegel', 'turret', 'relTurret', cupolaPrisms(D, H), glass));
      } else if (s.loader && !has(s, 'winkel')) {
        const P = loaderPrism(D);
        if (P) s.views.push(prismView('winkel', 'Winkelspiegel (drehbar)', 'turret', 'relTurret', P, glass));
      } else if (s.id === 'funker' && D.cmgHull) {
        const F = funkerCabin(D, driverCabin);
        if (F && !has(s, 'innen')) s.views.push({ id: 'innen', label: 'Funkerplatz', space: 'hull', pos: F.eye, look: 'rel', yaw: [-2.0, 2.0], pitch: [-0.9, 0.5], zoom: [1], interior: true });
        if (F && !has(s, 'winkel')) s.views.push(prismView('winkel', 'Winkelspiegel', 'hull', 'rel', funkerPrism(D, F), glass));
      } else if (s.mount === 'gun' && (D.era === 'kk' || !D.era || D.era === 'modern') && !has(s, 'hilfs')) {
        const o = s.views.find((v) => v.overlay === 'optic');
        if (o) s.views.push({ id: 'hilfs', label: 'Hilfszielfernrohr', space: 'gun', pos: [o.pos[0] + 0.14, o.pos[1] - 0.06, o.pos[2] + 0.05], look: 'mount', zoom: [6], overlay: 'optic', aux: true, peek: true });
      }
    }
  }
}

/** Aktiver Spiegel einer Sicht nach Blick (relYaw): nächster Spiegel; drehbar → 0. */
export function prismIndex(view, relYaw) {
  const P = view && view.prisms;
  if (!P || P.length < 2) return 0;
  let best = 0, bd = Infinity;
  for (let i = 0; i < P.length; i++) { const d = Math.abs(wrap(relYaw - P[i].yaw)); if (d < bd) { bd = d; best = i; } }
  return best;
}

/**
 * Bedienteile des Funkerplatzes (Wannenraum, Lage für cabin.js und die Hotspots in psim/sim.js gleich): Funkgerätestapel
 * links über dem Getriebe (Empfänger oben, Sender unten), Kanalwahl, Ein/Aus, Gurtsack am MG, Gurtkasten-Regal rechts.
 */
export function funkerLayout(F) {
  const x0 = F.F[0], z0 = F.F[2], y0 = F.floor;
  const rx = F.xl + 0.15, rz = z0 - 0.12;
  const mg = F.mg;
  return {
    radio: [rx, y0 + 0.62, rz],           // Mitte des Stapels (Front zeigt nach +X)
    front: rx + 0.13,                     // x der Frontplatten
    ein: [rx + 0.135, y0 + 0.5, rz + 0.07],
    kanal: [rx + 0.14, y0 + 0.76, rz - 0.04],
    senden: [rx + 0.135, y0 + 0.5, rz - 0.08],
    gurt: [mg[0] + 0.1, mg[1] - 0.11, mg[2] + 0.22],    // Gurtsack am MG (Ruhelage)
    regal: [F.xr - 0.1, y0 + 0.2, z0 - 0.05],
    lamp: [x0, F.roof - 0.04, z0 + 0.22],
    seat: [x0, y0 + 0.34, z0 + 0.1],
  };
}
