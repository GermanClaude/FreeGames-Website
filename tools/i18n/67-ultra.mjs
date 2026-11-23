// Ultra-Realismus 22.11. (Spielstil wie Bodycam: shared/classes.data.js GAME_STYLES.ultra, game/ultra.js, Lobby, Vorlage unter
// Einstellungen → HUD (ui/settings/hud-page.js), Vergleichstabelle der Startseite (site/sim-view.js, index.html)).
// Spalten: de, en, es, fr, ru, zh
export default [
['Ultra-Realismus', 'Ultra realism', 'Ultrarrealismo', 'Ultra-réalisme', 'Ультрареализм', '极致写实'],
['Wie Bodycam: gefühlt kein HUD, Trägheit und Waffengewicht, Kopftreffer tödlich, keine Heilung außer Verbänden, Teambeschuss an.',
  'Like bodycam: practically no HUD, inertia and weapon weight, headshots are lethal, no healing except bandages, friendly fire on.',
  'Como una bodycam: prácticamente sin HUD, inercia y peso del arma, los disparos a la cabeza matan, sin curación salvo vendas, fuego amigo activado.',
  'Comme une bodycam : pratiquement pas d’ATH, inertie et poids de l’arme, tirs à la tête mortels, aucun soin hors bandages, tirs alliés activés.',
  'Как бодикам: интерфейса почти нет, инерция и вес оружия, попадание в голову смертельно, лечение только бинтами, огонь по своим включён.',
  '像随身摄像机：几乎没有 HUD，有惯性和武器重量，爆头即死，只能用绷带治疗，开启友军伤害。'],
// game/ultra.js: Hinweise zu Beginn des Matches; injuries.js: Verband ohne offene Wunde
['Ultra-Realismus: keine Anzeigen. Heilung nur mit Verband.', 'Ultra realism: no displays. Healing only with bandages.', 'Ultrarrealismo: sin indicadores. Solo te curas con vendas.', 'Ultra-réalisme : aucun affichage. Soins uniquement avec des bandages.', 'Ультрареализм: никаких индикаторов. Лечение только бинтами.', '极致写实：没有任何显示。只能用绷带治疗。'],
['Verband angelegt.', 'Bandage applied.', 'Venda aplicada.', 'Bandage posé.', 'Бинт наложен.', '已包扎。'],
// Lobby (ui/lobby.js) unter dem Spielstil
['Magazin prüfen I · Verband N · Atem anhalten im Anschlag: Sprint-Taste. Vorlage „Ultra-Realismus“ unter Einstellungen → HUD.',
  'Check magazine I · Bandage N · Hold breath while aiming: sprint key. “Ultra realism” preset under Settings → HUD.',
  'Comprobar cargador I · Venda N · Contener la respiración al apuntar: tecla de esprint. Plantilla «Ultrarrealismo» en Ajustes → HUD.',
  'Vérifier le chargeur I · Bandage N · Retenir son souffle en visant : touche de sprint. Préréglage « Ultra-réalisme » dans Paramètres → ATH.',
  'Проверить магазин I · Бинт N · Задержать дыхание при прицеливании: клавиша бега. Шаблон «Ультрареализм»: Настройки → Интерфейс.',
  '检查弹匣 I · 绷带 N · 瞄准时屏息：冲刺键。“极致写实”预设位于 设置 → HUD。'],
// Einstellungen → HUD: Vorlage
['Aktiv', 'Active', 'Activa', 'Actif', 'Активно', '已启用'],
['Wie Bodycam: Spielstil „Ultra-Realismus“, kein HUD, Zeitstempel, Bodycam-Linse, tiefe Waffenhaltung, mehr Kamerabewegung, freies Zielen (leicht). Bei Reiseübelkeit danach unter „Grafik“ die Kamerabewegung senken.',
  'Like bodycam: “Ultra realism” game style, no HUD, timestamp, bodycam lens, low weapon position, more camera motion, free aim (light). If you get motion sick, lower camera motion under “Graphics” afterwards.',
  'Como una bodycam: estilo «Ultrarrealismo», sin HUD, marca de tiempo, lente bodycam, arma baja, más movimiento de cámara, apuntado libre (leve). Si te mareas, baja después el movimiento de cámara en «Gráficos».',
  'Comme une bodycam : style « Ultra-réalisme », pas d’ATH, horodatage, objectif bodycam, arme portée bas, plus de mouvement de caméra, visée libre (légère). En cas de cinétose, réduisez ensuite le mouvement de caméra dans « Graphismes ».',
  'Как бодикам: стиль «Ультрареализм», без интерфейса, отметка времени, объектив бодикама, низкое положение оружия, больше движения камеры, свободное прицеливание (слабое). Если укачивает, уменьшите движение камеры в разделе «Графика».',
  '像随身摄像机：“极致写实”玩法风格、无 HUD、时间戳、随身摄像机镜头、低持枪姿势、更多镜头晃动、自由瞄准（轻）。如感到晕动，可随后在“图形”中降低镜头晃动。'],
// Startseite §04 (site/sim-view.js, index.html)
['nie – nur Verband', 'never – bandages only', 'nunca: solo vendas', 'jamais – bandages seulement', 'никогда – только бинт', '从不——仅靠绷带'],
['Kopftreffer sofort tödlich', 'Headshots instantly lethal', 'Disparo a la cabeza letal al instante', 'Tir à la tête mortel sur le coup', 'Попадание в голову – сразу насмерть', '爆头即死'],
['Teambeschuss', 'Friendly fire', 'Fuego amigo', 'Tirs alliés', 'Огонь по своим', '友军伤害'],
['Trägheit, Waffengewicht, Atem im Anschlag', 'Inertia, weapon weight, breathing while aiming', 'Inercia, peso del arma, respiración al apuntar', 'Inertie, poids de l’arme, respiration en visée', 'Инерция, вес оружия, дыхание при прицеливании', '惯性、武器重量、瞄准时呼吸'],
['Ultra-Realismus gibt es in: {0}. In den übrigen Modi spielt er sich wie „Realistisch“.', 'Ultra realism is available in: {0}. In the other modes it plays like “Realistic”.', 'El ultrarrealismo está en: {0}. En los demás modos se juega como «Realista».', 'L’ultra-réalisme existe dans : {0}. Dans les autres modes, il se joue comme « Réaliste ».', 'Ультрареализм есть в: {0}. В остальных режимах играется как «Реализм».', '极致写实可用于：{0}。在其他模式中，它的玩法与“写实”相同。'],
['Ultra-Realismus gibt es in:', 'Ultra realism is available in:', 'El ultrarrealismo está en:', 'L’ultra-réalisme existe dans :', 'Ультрареализм есть в:', '极致写实可用于：'],
['. In den übrigen Modi spielt er sich wie „Realistisch“.', '. In the other modes it plays like “Realistic”.', '. En los demás modos se juega como «Realista».', '. Dans les autres modes, il se joue comme « Réaliste ».', '. В остальных режимах играется как «Реализм».', '。在其他模式中，它的玩法与“写实”相同。'],
['Ultra-Realismus wie Bodycam', 'Ultra realism like bodycam', 'Ultrarrealismo como una bodycam', 'Ultra-réalisme façon bodycam', 'Ультрареализм как бодикам', '随身摄像机式极致写实'],
['×2,2', '×2.2', '×2,2', '×2,2', '×2,2', '×2.2'],
];
