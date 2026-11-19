// NULLPUNKT — Panzer-Kampagne „Eisenwind“: Bausteine (Figuren, Kartenrahmen, Feind-/Verbündetenpanzer, Einrichtungen,
// Ziele, Infanterie, Bordsprech). Genutzt von eisenwind-a.js / eisenwind-b.js (Missionen) und mode.js.
import * as THREE from 'three';

/** Figuren (Sprecher-Ids für Dialoge und Darsteller in Zwischensequenzen). */
export const PZ_SPEAKERS = {
  asmus: { name: 'Oberfeldwebel Asmus', color: '#ffc23d', team: 'A', variant: 'kundschafter', weapon: null }, // Zugführer „Falke 1“
  sievers: { name: 'Hauptmann Sievers', color: '#8fc9ff', team: 'A', variant: 'kundschafter', weapon: 'pi_p9' }, // Kompaniechef „Amboss“
  wendt: { name: 'Leutnant Wendt', color: '#7fd6a0', team: 'A', variant: 'sturm', weapon: 'ar_m17' }, // Infanteriezug „Kiesel“
  martell: { name: 'Unteroffizier Martell', color: '#e0a8ff', team: 'A', variant: 'kundschafter', weapon: null }, // Besatzung Falke 2
  ollmann: { name: 'Gefreiter Ollmann', color: '#d9c38a', team: 'A', variant: 'kundschafter', weapon: null },
  emil: { name: 'Wachtmeister Emil Asmus', color: '#e6b98a', team: 'A', variant: 'kundschafter', weapon: null }, // M5 (Erinnerung)
  amboss: { name: 'Amboss (Kompanie)', color: '#c9c4b8', radioOnly: true },
  falke1: { name: 'Falke 1 (Asmus)', color: '#ffc23d', radioOnly: true },
  kiesel: { name: 'Kiesel (Wendt)', color: '#7fd6a0', radioOnly: true },
  korvan: { name: 'Korvanischer Funk', color: '#ff7a7a', radioOnly: true },
  vesk: { name: 'Oberst Vesk', color: '#ff5b5b', radioOnly: true },
  kolonne: { name: 'Kolonne Ostrau', color: '#d6d0c2', radioOnly: true },
  erzaehler: { name: 'Asmus (erzählt)', color: '#ffc23d', radioOnly: true },
};

/** Kartenrahmen aus den Basen der Karte. */
export function makeFrame(G, A, B) {
  const d = new THREE.Vector3(B.x - A.x, 0, B.z - A.z);
  const L = Math.max(140, d.length());
  d.normalize();
  const r = new THREE.Vector3(-d.z, 0, d.x);
  const at = (t, lat = 0) => [+(A.x + d.x * L * t + r.x * lat).toFixed(2), +(A.z + d.z * L * t + r.z * lat).toFixed(2)];
  const yaw = Math.atan2(-d.x, -d.z);
  return {
    A, B, L, d, r, yaw, back: yaw + Math.PI, toB: B.clone(), toA: A.clone(),
    at,
    p3: (t, lat, h) => { const q = at(t, lat); return [q[0], h, q[1]]; },
    /** Punkt in Metern vor/neben einem Rahmenpunkt (dz vorwärts zur Feindbasis, dx rechts). */
    off: (t, lat, dx, dz) => at(t + dz / L, lat + dx),
    m: (meters) => meters / L, // Meter → Streckenanteil
  };
}

/* ======================================================================== Bausteine für Missionen */

const _v = new THREE.Vector3();

/** Freier Stellplatz nahe [x,z] (Grundfläche des Typs), sonst der Punkt selbst. */
function spot(m, pz, at, type, toward, maxR = 40) {
  const sys = m.G.vehicles, p = m.vec(at);
  const avoid = [...pz.empl.map((e) => e.position), ...pz.enemies.map((e) => e.v.position), ...(pz.friends || []).map((e) => e.v.position)];
  const s = sys.findSpot(p, type, { maxR, toward, avoid });
  return s || { position: p, yaw: toward ? Math.atan2(-(toward.x - p.x), -(toward.z - p.z)) : 0 };
}

/** Feindpanzer: at = [x,z]; o: { yaw, route: [[x,z]…], hold, type } → EnemyTank */
export function foeTank(m, pz, type, at, o = {}) {
  const s = spot(m, pz, at, type, pz.F.toA);
  const e = pz.spawnTank(type, s.position, o.yaw ?? s.yaw, 'B', { post: s.position.clone(), route: o.route ? o.route.map((q) => m.vec(q)) : null, hold: !!o.hold });
  return e;
}

/** Verbündeter KI-Panzer (folgt dem Spieler seitlich versetzt, bzw. Route/hold). */
export function allyTank(m, pz, type, at, o = {}) {
  const s = spot(m, pz, at, type, pz.F.toB);
  return pz.spawnTank(type, s.position, o.yaw ?? s.yaw, 'A', { name: o.name || null, hold: !!o.hold, route: o.route ? o.route.map((q) => m.vec(q)) : null, side: o.side || 1 });
}

/** Einrichtung/Stellung: kind ∈ pak | bunker | funk | lager | bruecke. */
export function target(m, pz, kind, at, o = {}) {
  const s = spot(m, pz, at, `psim_${kind}`, o.face || pz.F.toA, o.maxR ?? (kind === 'bruecke' ? 60 : 35));
  return pz.spawnEmpl(kind, s.position, o.yaw ?? s.yaw, 'B', { crew: o.crew !== false });
}

const posOf = (x) => (x && x.v ? x.v : x);

/** Ziel „vernichte …“ mit Zähler und Wegpunkt zum nächsten lebenden Ziel → Handle (fertig, wenn alle zerstört). */
export function destroy(m, id, text, list, { label = 'Ziel', optional = false, need = null } = {}) {
  const ents = list.filter(Boolean).map(posOf);
  const n = need || ents.length;
  const near = () => {
    const P = m.G.player, from = P && P.vehicle ? P.vehicle.position : P ? P.position : null;
    let best = null, bd = Infinity;
    for (const e of ents) if (e.alive && from) { const d = e.position.distanceToSquared(from); if (d < bd) { bd = d; best = e.position; } }
    return best;
  };
  m.objective(id, text, { pos: near, label, total: n, optional });
  return m.until(() => {
    const dead = ents.filter((e) => !e.alive).length;
    m.progress(id, Math.min(dead, n), n);
    if (dead >= n) { m.done(id); return true; }
    return false;
  });
}

/** Infanterie (Welle der Regie): n Soldaten um [x,z] (Streuung r); o: { hold, attack, cls, scale } */
export function infantry(m, id, n, at, o = {}) {
  const pts = [];
  for (let i = 0; i < Math.max(1, Math.min(n, 6)); i++) { const a = (i / Math.max(1, n)) * Math.PI * 2; pts.push([at[0] + Math.cos(a) * (o.r || 6), at[1] + Math.sin(a) * (o.r || 6)]); }
  return m.wave(id, { count: n, at: pts, attack: o.attack || (o.hold ? null : 'player'), hold: o.hold !== false && !o.attack, radius: o.radius || 10, cls: o.cls || null, scale: o.scale });
}

/** Lebende Anzahl in einer Liste (Panzer-KI oder Einrichtungen). */
export const aliveOf = (list) => list.filter((x) => x && posOf(x).alive).length;

/** Spielerpanzer-Position (oder Spieler). */
export function playerPos(m) { const P = m.G.player; return P && P.vehicle ? P.vehicle.position : P ? P.position : _v.set(0, 0, 0); }

/** Bordsprech-Zeile der eigenen Besatzung (Rolle; spielt der Spieler sie, spricht der Kommandant bzw. Richtschütze). */
export function crewSay(pz, role, text, o = {}) {
  if (!pz.radio) return;
  const R = { Fahrer: 'fahrer', Richtschütze: 'richtschuetze', Ladeschütze: 'ladeschuetze', Kommandant: 'kommandant' };
  let from = role;
  if (R[role] === pz.role) from = role === 'Kommandant' ? 'Richtschütze' : 'Kommandant';
  pz.radio.say(from, text, o);
}

/** Darsteller-Vorlage für Zwischensequenzen. */
export function cast(role, o = {}) {
  const s = PZ_SPEAKERS[role] || {};
  return { role, team: s.team || 'A', variant: s.variant || 'kundschafter', weapon: s.weapon === undefined ? null : s.weapon, name: s.name, color: s.color, ...o };
}

/** Rolle-Hinweis für Missionstexte: was der Spieler in seiner Rolle zu tun hat. */
export function roleTip(pz) {
  if (pz.arcade) return 'Arcade: W/A/S/D fahren, Maus richten, Linksklick Feuer, 1–4 Munition.';
  return {
    kommandant: 'Kommandant: Ziel ins Periskop nehmen und übergeben (H), Munition befehlen (1–4), „Feuer!“ (Leertaste), Fahrbefehle mit W/A/S/D oder Markierung (B).',
    richtschuetze: 'Richtschütze: Waffe scharf, Munition am Rechner, in der Hauptzieloptik (C) richten und auf „Feuer!“ abziehen.',
    ladeschuetze: 'Ladeschütze: Befohlene Munition wählen, greifen, einschieben, Verschluss schließen, entsichern – die Kanone wartet auf dich.',
    fahrer: 'Fahrer: Motor anlassen, Bremse lösen, Gang einlegen. Fahrbefehle des Kommandanten stehen oben im Bild.',
  }[pz.role] || '';
}
