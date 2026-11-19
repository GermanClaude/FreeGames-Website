// NULLPUNKT — Hintergrund-Rechner für Soldatenköpfe: lädt das Kopf-Asset (face-mesh.js), baut Kopfnetz + Morph-Ziele je Profil
// und backt die Hautkarten (face-skin.js) abseits des Hauptfadens; Puffer werden übertragen (ohne Kopie).
// Nachrichten: { id, kind: 'mesh', res, profile } → { id, D } · { id, kind: 'tex', look, w, h } → { id, T }
import { loadHeadAsset, buildHeadData, transferList } from './face-mesh.js?v=20261119182451';
import { bakeFaceMaps } from './face-skin.js?v=20261119182451';

self.onmessage = async (e) => {
  const { id, kind, res, profile, look, w, h } = e.data || {};
  try {
    const A = await loadHeadAsset();
    if (kind === 'tex') {
      const T = bakeFaceMaps(A, look, w, h);
      self.postMessage({ id, T }, [T.a.buffer, T.b.buffer]);
    } else {
      const D = buildHeadData(A, res, profile);
      self.postMessage({ id, D }, transferList(D));
    }
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
