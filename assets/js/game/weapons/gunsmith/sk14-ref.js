// SK-14: Umrisse vom Referenzfoto (13.11.2026, Nutzer: „Waffenmodelle anhand der echten Versionen so detailliert wie
// möglich“). Vorbild Mk 14 EBR (M14-Gehäuse im Aluminium-Chassis: Schienen-Handschutz mit Langlöchern, Mittelteil mit
// Bohrungsreihe, Schiebeschaft auf zwei Stangen mit Wangenauflage und durchbrochener Kappe, Pistolengriff, M14-Abzugsbügel,
// 20er-Stahlmagazin, Gaszylinder unter dem Lauf, Korn mit Schutzohren, langer Mündungsfeuerdämpfer).
// Umriss: „Mk14 EBR.png“ (Wikimedia Commons, linke Seite, 1018 × 346 px; hier gespiegelt, Mündung rechts). Das helle Chassis
// hebt sich kaum vom Hintergrund ab – Umrisse daher von Hand aus vergrößerten Ausschnitten (Raster 5 px) abgenommen.
// Bild nicht im Repo. Kalibrierung: Gesamtlänge (Schaft ausgezogen) ≈ 975 mm = 965 px (x 22 … 987) → 990 px/m (1 mm/px).
// Bezug: Griffmitte oben (x 288, y 172) ↔ Ursprung, Laufachse y 104.
export const PPM = 990, XG = 288, YG = 172, YA = 104;

// Schaftkappe (Polymer, durchbrochen), Wangenauflage, zwei Schaftstangen
export const BUTT = [[24, 146], [38, 140], [60, 137], [88, 138], [93, 146], [90, 162], [84, 186], [78, 214], [72, 240], [66, 252], [52, 257], [42, 255], [36, 240], [30, 205], [25, 172]];
export const BUTT_HOLES = [[60, 175, 5], [64, 192, 5], [67, 209, 5], [69, 226, 5], [52, 236, 4]];   // Durchbrüche [x, y, r]
export const CHEEK = [[52, 136], [120, 133], [188, 132], [196, 135], [194, 143], [150, 146], [96, 149], [56, 149]];
export const RODS = [[88, 300, 156, 4.2], [88, 300, 167, 4.2]];   // Schaftstangen x0, x1, y, r
export const STOCK_BLOCK = [[228, 148], [300, 144], [300, 175], [228, 175], [222, 166], [222, 156]];   // Schaftaufnahme
// Chassis: Mittelteil unter dem Gehäuse (Bohrungsreihe), Handschutz vorn (Schiene oben, Langlöcher), Griff
export const CHASSIS = [[300, 140], [498, 140], [500, 112], [520, 100], [520, 90], [790, 90], [794, 95], [794, 150], [700, 152], [690, 162], [640, 166], [510, 166], [500, 175], [420, 175], [372, 178], [330, 176], [300, 175]];
export const CHASSIS_HOLES = [[421, 162, 3.5], [433, 162, 3.5], [446, 162, 3.5], [459, 162, 3.5], [472, 162, 3.5], [485, 162, 3.5]];
export const HG_SLOTS = [[528, 110, 556, 118], [562, 110, 590, 118], [596, 110, 624, 118], [630, 110, 658, 118], [700, 110, 728, 118], [734, 110, 762, 118]];
export const HG_PANEL = [505, 120, 690, 160];      // dunkles Seitenteil (Schienenabdeckung) am Mittelteil
export const RAIL = [330, 790, 84];               // obere Schiene x0, x1, Unterkante y
export const GRIP = [[268, 172], [306, 172], [303, 186], [292, 215], [282, 248], [279, 258], [262, 262], [244, 260], [242, 252], [256, 222], [264, 192]];
// M14-Gehäuse (Stahl, dunkel) mit Kimme, Spannschieber rechts, Abzugsbügel
export const REC = [[300, 140], [300, 120], [310, 117], [340, 115], [342, 101], [395, 100], [500, 98], [500, 140]];
export const RSIGHT = [350, 110, 7];             // Kimmentrommel (Mitte, Radius px)
export const OPROD = [[420, 128], [490, 128], [494, 133], [494, 138], [420, 138]];   // Spannschieber (rechts, Ruhe vorn)
export const OPROD_KNOB = [430, 124, 6];
export const CHARGE_BACK = 355;
export const GUARD = [[312, 176], [366, 176], [366, 186], [360, 198], [345, 202], [326, 200], [314, 190]];
export const GUARD_OPEN = [[320, 178], [356, 178], [355, 189], [346, 196], [330, 195], [321, 188]];
export const TRIGGER = [[334, 176], [339, 176], [341, 184], [339, 192], [335, 190], [336, 184]];
// Magazin (gerade, Stahl), Magazinhalter
export const MAG = [[418, 175], [500, 175], [500, 210], [502, 255], [498, 262], [425, 262], [420, 255], [418, 210]];
export const MAG_TOP = [459, 176];
// Lauf, Gaszylinder, Korn, Mündungsfeuerdämpfer
export const BARREL = [[790, 7.5], [880, 6.8], [905, 6.6]];      // [x, Radius px]
export const GAS = [790, 880, 117, 5.4];                        // Gaszylinder x0, x1, Achse y, Radius px
export const GAS_LOCK = [868, 902, 117, 6.2];                   // Gasverschluss
export const FSIGHT = [[880, 100], [884, 76], [896, 76], [900, 100]];   // Kornträger mit Schutzohren
export const HIDER = [905, 987, 8.2];
