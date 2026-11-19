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
  // Runde 2 (kampagne-a): M0, M4–M6
  krell: { name: 'Oberfeldwebel Krell', color: '#d9c38a', team: 'A', variant: 'kundschafter', weapon: null }, // Ausbilder (M0)
  vogt: { name: 'Kapitän Vogt', color: '#9fc7d9', team: 'A', variant: 'kapitaen', weapon: null }, // erpresster Kapitän (M4)
  lindner: { name: 'Dr. Lindner', color: '#e8c9a8', team: 'A', variant: 'zivil-strick', weapon: null }, // Archivleiterin (M5)
  sander: { name: 'Oberleutnant Sander', color: '#a9d4ff', team: 'A', variant: 'kundschafter', weapon: 'pi_p9' }, // Pilot „Libelle 1“ (M6, M10)
  zivil: { name: 'Dorfbewohner', color: '#d6d0c2', radioOnly: true }, // Zivilisten (Zurufe)
};

/** Darsteller-Vorlage für eine Zwischensequenz: cast('lenz', { pos, yaw, … }). */
export function actor(role, o = {}) {
  const s = SPEAKERS[role] || {};
  return { role, team: s.team || 'A', variant: s.variant || 'sturm', weapon: s.weapon === undefined ? 'ar_m17' : s.weapon, name: s.name, color: s.color, ...o };
}

// --- kampagne-b: Figuren für M7–M11 (frei erfunden) ---
Object.assign(SPEAKERS, {
  orlan: { name: 'Hauptfeldwebel Orlan', color: '#e6b98a', team: 'B', variant: 'grenadier', weapon: 'ar_m17' }, // Ostbund, Darens Brigade (M7, M8)
  haas: { name: 'Kommissarin Elin Haas', color: '#b9d7c4', team: 'A', variant: 'zivil', weapon: null }, // Waffenstillstandskommission (M8)
  malek: { name: 'Gefreiter Malek', color: '#d7a07a', team: 'B', variant: 'funker', weapon: null }, // gefangener Funker Kessars (M9)
  kranich: { name: 'Unbekannte Stimme', color: '#9aa3b5', radioOnly: true }, // offenes Ende (M11)
  libelle: { name: 'Libelle 1', color: '#a9d4ff', radioOnly: true }, // Hubschrauberfunk, falls Sander nicht im Bild
});
if (!SPEAKERS.sander) SPEAKERS.sander = { name: 'Oberleutnant Kai Sander', color: '#a9d4ff', team: 'A', variant: 'kundschafter', weapon: 'pi_p9' };
