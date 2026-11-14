// NULLPUNKT — Hintergrund-Rechner für Soldatenköpfe (face-sdf.js): baut Kopfnetz + Morph-Ziele abseits des Hauptfadens
// (≈ 0,2–2 s je Kopfform) und schickt die Puffer übertragen (ohne Kopie) zurück. Nachricht: { id, res, shape }.
import { buildFaceData } from './face-sdf.js?v=20261114004313';

self.onmessage = (e) => {
  const { id, res, shape } = e.data || {};
  try {
    const D = buildFaceData(res, shape);
    const tr = [D.pos.buffer, D.nrm.buffer, D.col.buffer, D.rest.buffer, D.idx.buffer, D.ski.buffer, D.skw.buffer];
    for (const m of D.morphs) tr.push(m.pos.buffer, m.nrm.buffer, m.col.buffer);
    self.postMessage({ id, D }, tr);
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
