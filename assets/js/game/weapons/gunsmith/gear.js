// Nahkampf & Wurfwaffen: Kampfmesser, Splittergranate, Haftgranate
import { ellipsePts } from './parts.js?v=20261123115551';

export function knife(b) {
  // Kampfmesser (13.11., nach dem Vorbild USMC-Kampfmesser): Griff aus gepressten Lederscheiben (Ringe mit dunklen
  // Distanzscheiben, längs leicht oval), gerade Stahl-Parierstange mit Rundenden, Knaufkappe mit vernieteter Angel und
  // Fangriemenloch; Klinge 178 mm Clip-Point, schwarz beschichtet, Hohlkehle beidseitig, Falschschneide oben, blanke
  // Schneidfase, Fingerkerbe (Choil), Daumenrillen. Klinge zeigt nach −Z (vorn), Schneide unten.
  const nr = b.hi ? 18 : 1, gl = 0.106, sx = 0.8;
  if (b.hi) {
    for (let i = 0; i < nr; i++) {
      const u0 = -0.054 + i * gl / nr, belly = 0.0128 + 0.0016 * Math.sin(Math.PI * (i + 0.5) / nr);   // leicht bauchig
      const dark = i % 6 === 5;
      b.cyl(dark ? 'rubber' : 'leather', belly, belly, gl / nr - 0.0004, 0, 0, u0 + gl / nr / 2, { seg: 16, sx });
    }
  } else b.cyl('leather', 0.014, 0.014, gl, 0, 0, -0.001, { seg: 6, sx });
  b.lathe('steel', [[0, 0], [0, 0.014], [0.004, 0.0148], [0.01, 0.0132], [0.012, 0.0]], 0, 0, -0.07, { seg: b.seg(14, 6), sx });
  b.box('steel', 0.009, 0.064, 0.0065, 0, -0.002, 0.057, { c: 0.002 });
  // Klinge: Clip-Point, beschichtet, mit blank geschliffener Schneide und Hohlkehle
  const blade = [[0.06, 0.013], [0.18, 0.013], [0.205, 0.008], [0.245, 0.0], [0.232, -0.008], [0.205, -0.015], [0.17, -0.019], [0.07, -0.019], [0.06, -0.016]];
  b.part('blade', 0, 0, 0);
  b.side('bladeCoat', blade, 0.0055, 0, { part: 'blade', bevel: 0.0016 });
  b.side('blade', [[0.074, -0.0125], [0.17, -0.0125], [0.203, -0.009], [0.236, -0.0045], [0.2455, 0.0], [0.232, -0.0085], [0.205, -0.0155], [0.17, -0.0195], [0.074, -0.0195]], 0.0036, 0, { part: 'blade', bevel: 0.0012 });
  b.side('blade', [[0.18, 0.0132], [0.205, 0.0085], [0.2455, 0.0], [0.205, 0.0105], [0.18, 0.0145]], 0.0028, 0, { part: 'blade', bevel: 0.0008 });
  if (b.hi) {
    for (const s of [-1, 1]) {
      b.box('cavity', 0.0008, 0.0035, 0.09, s * 0.0029, 0.004, 0.125, { part: 'blade', c: 0 });                  // Hohlkehle
      b.box('steelDark', 0.0004, 0.0008, 0.09, s * 0.003, 0.0062, 0.125, { part: 'blade', c: 0 });               // Kante der Kehle
      b.box('steelDark', 0.0004, 0.004, 0.012, s * 0.00285, 0.003, 0.074, { part: 'blade', c: 0 });               // Ricasso-Stempel
    }
    // Fingerkerbe (Choil) vor der Parierstange, Daumenrillen auf dem Rücken, Parierstangen-Enden, Knaufmutter, Fangriemen
    b.cyl('cavity', 0.0036, 0.0036, 0.0058, 0, -0.0192, 0.067, { axis: 'x', seg: 14, part: 'blade' });
    for (let i = 0; i < 7; i++) b.box('cavity', 0.0058, 0.0009, 0.0011, 0, 0.0131, 0.068 + i * 0.0032, { part: 'blade', c: 0 });
    for (const s of [-1, 1]) b.sphere('steel', 0.005, 0, s * 0.032, 0.057);
    b.cyl('cavity', 0.0032, 0.0032, 0.0236, 0, 0, -0.064, { axis: 'x', seg: 12 });
    b.cyl('steelBright', 0.0042, 0.0046, 0.003, 0, 0, -0.0715, { seg: 12 });                                        // vernietete Angel
    b.box('steelDark', 0.0082, 0.026, 0.0016, 0, -0.002, 0.0532, { c: 0 });
    b.tube('cord', [[0, 0.0, -0.064], [0, -0.012, -0.075], [0, -0.03, -0.08], [0, -0.05, -0.078], [0, -0.062, -0.07]], 0.0018, { seg: 6 });
  }
  b.anchor('muzzle', 0, -0.002, 0.24);
  b.anchor('rightHandGrip', 0, 0, 0, { data: { rake: 0 } });
  b.meta = { sight: 'none', kind: 'melee' };
}

export function frag(b) {
  // Splittergranate (13.11., nach dem Vorbild M67): Stahlkugel 64 mm, olivgrün mit gelber Kennlinie, Pressnaht am
  // Äquator, Zünderhals mit Gewinde, Zünderkörper, langer gewölbter Sicherungsbügel (Löffel) mit Lasche, Sicherungsclip,
  // Abzugsring mit Splint.
  const s = b.seg(22, 8);
  b.sphere('paintOlive', 0.032, 0, 0, 0, { seg: s, hseg: b.seg(16, 6) });
  b.cyl('paintYellow', 0.0122, 0.0122, 0.0035, 0, 0.0298, 0, { axis: 'v', seg: b.seg(16, 6) });
  if (b.hi) {
    b.torus('paintOlive', 0.0318, 0.0008, 0, 0.0, 0, { rx: Math.PI / 2, seg: 6, tseg: 36 });                      // Äquatornaht
    b.cyl('paintYellow', 0.0311, 0.0311, 0.0022, 0, 0.0085, 0, { axis: 'v', seg: 28 });                           // Kennlinie
    for (let i = 0; i < 4; i++) b.cyl('steelDark', 0.0098, 0.0098, 0.0008, 0, 0.0328 + i * 0.0014, 0, { axis: 'v', seg: 14 }); // Gewinde
  }
  b.cyl('steel', 0.0088, 0.0102, 0.014, 0, 0.039, 0, { axis: 'v', seg: b.seg(14, 6) });
  b.cyl('steel', 0.0062, 0.0088, 0.006, 0, 0.049, 0, { axis: 'v', seg: b.seg(12, 6) });
  if (b.hi) b.cyl('steelDark', 0.0035, 0.0035, 0.003, 0, 0.053, 0, { axis: 'v', seg: 10 });
  // Löffel: gewölbtes Band an der rechten Seite bis knapp unter den Äquator, Lasche am Ende
  b.part('spoon', 0.01, 0.046, 0);
  const n = b.hi ? 10 : 3, outer = [], inner = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 - 0.15 - i * (1.75 / n);
    outer.push([Math.cos(a) * 0.0368 + 0.002, Math.sin(a) * 0.0368 + 0.012]);
    inner.push([Math.cos(a) * 0.0342 + 0.002, Math.sin(a) * 0.0342 + 0.012]);
  }
  b.front('steel', [...outer, ...inner.reverse()], 0.014, -0.007, { part: 'spoon' });
  b.box('steel', 0.014, 0.004, 0.014, 0.006, 0.0505, 0, { part: 'spoon', c: 0.001 });
  if (b.hi) {
    const e = outer[n];
    b.box('steel', 0.006, 0.0025, 0.01, e[0] - 0.002, e[1] - 0.001, 0, { part: 'spoon', rz: 0.6, c: 0.0005 });   // Lasche
    b.box('steelDark', 0.0004, 0.02, 0.006, 0.037, 0.03, 0, { part: 'spoon', rz: -0.35, c: 0 });                  // Prägesicke
    b.tube('steelBright', [[0.03, 0.018, -0.008], [0.034, 0.03, -0.009], [0.028, 0.042, -0.008], [0.02, 0.046, -0.004]], 0.0007, { seg: 5, part: 'spoon' }); // Sicherungsclip
  }
  // Ring + Splint
  b.part('pin', -0.012, 0.042, 0);
  b.torus('steelBright', 0.0105, 0.0014, -0.026, 0.042, 0, { part: 'pin', ry: Math.PI / 2, seg: b.seg(6, 3), tseg: b.seg(18, 8) });
  b.cyl('steelBright', 0.0011, 0.0011, 0.026, -0.008, 0.042, 0, { part: 'pin', axis: 'x', seg: 6 });
  if (b.hi) b.cyl('steelBright', 0.0011, 0.0011, 0.006, 0.006, 0.0405, 0.0018, { part: 'pin', axis: 'x', rz: -0.5, seg: 6 }); // aufgebogenes Splintende
  b.anchor('pinGrab', -0.034, 0.042, 0, { part: 'pin' });
  b.anchor('rightHandGrip', 0, 0, 0);
  b.meta = { sight: 'none', kind: 'grenade' };
}

export function semtex(b) {
  // Zylindrischer Körper mit Warnstreifen, klebrige Masse unten, Zündmodul mit LED oben
  b.cyl('paintOlive', 0.024, 0.024, 0.07, 0, 0, 0, { axis: 'v', seg: b.seg(18, 7) });
  b.cyl('paintYellow', 0.0245, 0.0245, 0.012, 0, 0.018, 0, { axis: 'v', seg: b.seg(18, 7) });
  for (const v of [-0.012, 0.0115, 0.0245]) b.cyl('polymer', 0.0247, 0.0247, 0.003, 0, v, 0, { axis: 'v', seg: b.seg(18, 7) });
  b.sphere('putty', 0.027, 0, -0.04, 0, { sy: 0.45, seg: b.seg(16, 7), hseg: b.seg(10, 4) });
  b.box('polymer', 0.032, 0.016, 0.032, 0, 0.043, 0, { c: 0.004 });
  b.cyl('steel', 0.005, 0.006, 0.012, 0, 0.056, 0, { axis: 'v', seg: b.seg(10, 5) });
  if (b.hi) {
    // Klebeband-Wicklung, Zündkabel, Bedienknopf, Warnaufdruck
    b.cyl('rubber', 0.0249, 0.0249, 0.006, 0, -0.022, 0, { axis: 'v', seg: 18 });
    b.tube('copper', [[0.012, 0.048, -0.016], [0.022, 0.04, -0.02], [0.0252, 0.03, -0.012]], 0.0008, { seg: 5 });
    b.tube('paintSignal', [[-0.012, 0.048, -0.016], [-0.022, 0.04, -0.02], [-0.0252, 0.03, -0.012]], 0.0008, { seg: 5 });
    b.cyl('paintSignal', 0.004, 0.004, 0.003, 0.009, 0.052, 0.0, { axis: 'v', seg: 10 });
    for (let i = 0; i < 3; i++) b.box('paintWhite', 0.0005, 0.0012, 0.012, 0.0246, 0.003 - i * 0.004, 0, { c: 0 });
  }
  b.part('led', 0, 0.052, 0);
  b.sphere('glowRed', 0.0035, 0.009, 0.052, -0.016, { part: 'led', seg: 8, hseg: 6 });
  b.part('pin', -0.01, 0.056, 0);
  b.torus('steelBright', 0.009, 0.0013, -0.02, 0.056, 0, { part: 'pin', ry: Math.PI / 2, seg: b.seg(6, 3), tseg: b.seg(16, 8) });
  b.anchor('pinGrab', -0.028, 0.056, 0, { part: 'pin' });
  b.anchor('rightHandGrip', 0, 0, 0);
  b.meta = { sight: 'none', kind: 'grenade' };
}

export { ellipsePts };
