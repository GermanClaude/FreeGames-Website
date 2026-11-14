// NULLPUNKT — Kampagne „Stille Grenze“: Figuren (frei erfunden). Sprecher-Ids für Dialoge, Darsteller-Vorlagen für
// Zwischensequenzen (Ausführung = Soldaten-Variante aus bots/soldier/gear.js, Team A = Nordkorps, B = Ostbund).

export const SPEAKERS = {
  falk: { name: 'Unteroffizier Falk', color: '#ff9a6b', team: 'A', variant: 'schatten', weapon: 'ar_m17' }, // Spielerfigur, Rufname „Falke“
  lenz: { name: 'Feldwebel Lenz', color: '#ffc23d', team: 'A', variant: 'sturm', weapon: 'ar_m17' },
  weber: { name: 'Obergefreiter Weber', color: '#7fd6a0', team: 'A', variant: 'funker', weapon: 'ar_m17' },
  brandt: { name: 'Hauptmann Brandt', color: '#8fc9ff', team: 'A', variant: 'kundschafter', weapon: 'pi_p9' },
  roth: { name: 'Leutnant Roth', color: '#e0a8ff', team: 'A', variant: 'panzerpionier', weapon: 'ar_m17' },
  hofer: { name: 'Sanitäter Hofer', color: '#f2f2f2', team: 'A', variant: 'sanitaeter', weapon: 'ar_m17' },
  daren: { name: 'Major Daren', color: '#ff8c7a', team: 'B', variant: 'bastion', weapon: null },
  kessar: { name: 'Oberst Kessar', color: '#ff5b5b', team: 'B', variant: 'grenadier', weapon: null, radioOnly: true },
  funk: { name: 'Leitstelle Anker', color: '#c9c4b8', radioOnly: true },
  feind: { name: 'Feindfunk', color: '#ff7a7a', radioOnly: true },
};

/** Darsteller-Vorlage für eine Zwischensequenz: cast('lenz', { pos, yaw, … }). */
export function actor(role, o = {}) {
  const s = SPEAKERS[role] || {};
  return { role, team: s.team || 'A', variant: s.variant || 'sturm', weapon: s.weapon === undefined ? 'ar_m17' : s.weapon, name: s.name, color: s.color, ...o };
}
