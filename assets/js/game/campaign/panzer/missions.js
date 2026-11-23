// NULLPUNKT — Panzer-Kampagne „Eisenwind“: Verzeichnis, Figuren, Kartenrahmen und Bausteine der Missionen.
//
// Geschichte (frei erfunden): Das Königreich Veldmark und die Republik Korvan teilen sich das Tal der Miren. In einer
// Herbstnacht überschreiten korvanische Panzerverbände die Grenze. Die 3. Kompanie des Panzerbataillons 41 („Graufalken“)
// stellt sich ihnen entgegen – du fährst in „Falke 2“, Zugführer ist Oberfeldwebel Henrik Asmus („Falke 1“), Kompaniechef
// Hauptmann Ilse Sievers („Amboss“). Asmus’ Großvater Emil kämpfte vor achtzig Jahren an derselben Furt von Mirenfurt –
// Mission 5 spielt diese Erinnerung mit einem alten Panzer nach. Ton: ernst, ruhig, Verantwortung füreinander, keine
// Verherrlichung, keine Flüche. Alle Namen, Länder, Orte und Einheiten sind erfunden.
//
// Missionsdatei: { id, number, title, short, map, time, weather, tank, models, type, summary, goals, roles, minutes,
//   build(F, pz) → { prepare(m), stages: [{ id, name, checkpoint: { at, yaw }, setup(m), *run(m) }], cutscenes, night } }
// F = Kartenrahmen (eigene Basis → Feindbasis): F.at(t, quer) → [x, z] (t = Anteil der Strecke, quer in m, + = rechts),
//   F.p3(t, quer, höhe) → [x, höhe, z], F.yaw (Blick zur Feindbasis), F.L (Länge). pz = Modus (campaign/panzer/mode.js).
import { P1, P2, P3 } from './eisenwind-a.js?v=20261123115551';
import { P4, P5, P6 } from './eisenwind-b.js?v=20261123115551';

export const PZ_CAMPAIGN = {
  id: 'eisenwind',
  title: 'Eisenwind',
  tagline: 'Eine Besatzung, ein Tal, sechs Einsätze.',
  summary: 'Herbst im Tal der Miren: Korvanische Panzer überschreiten die Grenze. Mit „Falke 2“ und deiner Besatzung brichst du durch Sperrlinien, hältst eine Höhe, geleitest Nachschub, schlägst bei Nacht zu – und erfährst, warum Oberfeldwebel Asmus die Furt von Mirenfurt so gut kennt.',
};

const LIST = [P1, P2, P3, P4, P5, P6];
export const PZ_MISSIONS = {};
for (const m of LIST) PZ_MISSIONS[m.id] = m;
export const PZ_ORDER = LIST.map((m) => m.id);
export function pzMission(id) { return (id && PZ_MISSIONS[id]) || null; }
export const PZ_MAPS = Object.fromEntries(LIST.map((m) => [m.id, m.map]));

export { PZ_SPEAKERS, makeFrame } from './kit.js?v=20261123115551';
