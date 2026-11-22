// Logik-Durchgang 22.11.: Funkspruch der Panzersimulation mit Pluralformen (modes/panzer.js: Aufzählung als ein Platzhalter,
// jeder Teil „{#} Panzer“ usw. wählt die Form nach der Zahl – vorher „1 AT guns, 1 bunkers“), Zielmarke der Besatzung
// („Panzerabwehrtrupp 200 m“, modes/panzer.js targetLabel aus vehicles/psim/crew-ai.js TARGET_LABEL) blieb deutsch.
// Spalten: de, en, es, fr, ru, zh
export default [
['Kompanie an {0}: Feindstellung voraus – {1}. Angreifen und vernichten!', 'Company to {0}: enemy position ahead – {1}. Attack and destroy!', 'Compañía a {0}: posición enemiga al frente: {1}. ¡Atacad y destruid!', 'Compagnie à {0} : position ennemie devant – {1}. Attaquez et détruisez !', 'Рота – {0}: впереди позиция противника – {1}. Атаковать и уничтожить!', '连部呼叫 {0}：前方敌军阵地——{1}。进攻并摧毁！'],
['{#} Panzer', { one: '{#} tank', other: '{#} tanks' }, { one: '{#} tanque', other: '{#} tanques' }, { one: '{#} char', other: '{#} chars' }, { one: '{#} танк', few: '{#} танка', many: '{#} танков', other: '{#} танка' }, '{#} 辆坦克'],
['{#} Pak', { one: '{#} AT gun', other: '{#} AT guns' }, { one: '{#} cañón AT', other: '{#} cañones AT' }, { one: '{#} canon AC', other: '{#} canons AC' }, '{#} ПТО', '{#} 门反坦克炮'],
['{#} Bunker', { one: '{#} bunker', other: '{#} bunkers' }, { one: '{#} búnker', other: '{#} búnkeres' }, { one: '{#} bunker', other: '{#} bunkers' }, { one: '{#} дот', few: '{#} дота', many: '{#} дотов', other: '{#} дота' }, '{#} 座碉堡'],
// Zielmarke im Optik-/Außenbild: „<Ziel> <Entfernung> m“
['Panzer {#} m', 'Tank {#} m', 'Tanque {#} m', 'Char {#} m', 'Танк {#} м', '坦克 {#} 米'],
['Pak {#} m', 'AT gun {#} m', 'Cañón AT {#} m', 'Canon AC {#} m', 'ПТО {#} м', '反坦克炮 {#} 米'],
['Bunker {#} m', 'Bunker {#} m', 'Búnker {#} m', 'Bunker {#} m', 'Дот {#} м', '碉堡 {#} 米'],
['Infanterie {#} m', 'Infantry {#} m', 'Infantería {#} m', 'Infanterie {#} m', 'Пехота {#} м', '步兵 {#} 米'],
['Panzerabwehrtrupp {#} m', 'Anti-tank squad {#} m', 'Escuadra antitanque {#} m', 'Escouade antichar {#} m', 'Противотанковое отделение {#} м', '反坦克小队 {#} 米'], // wie der Funkspruch (Katalog „Panzerabwehrtrupp“)
['Fahrzeug {#} m', 'Vehicle {#} m', 'Vehículo {#} m', 'Véhicule {#} m', 'Машина {#} м', '车辆 {#} 米'],
['Funkstelle {#} m', 'Radio post {#} m', 'Puesto de radio {#} m', 'Poste radio {#} m', 'Радиоточка {#} м', '电台 {#} 米'],
['Nachschublager {#} m', 'Supply depot {#} m', 'Depósito de suministros {#} m', 'Dépôt de ravitaillement {#} m', 'Склад снабжения {#} м', '补给站 {#} 米'],
['Brücke {#} m', 'Bridge {#} m', 'Puente {#} m', 'Pont {#} m', 'Мост {#} м', '桥梁 {#} 米'],
// Todesanzeige im Modus TDM Ultimate (modes/ultimate.js respawnNote): ein Leben je Runde
['Ausgeschaltet – zurück in der nächsten Runde', 'Eliminated – back next round', 'Eliminado: vuelves en la próxima ronda', 'Éliminé – retour à la prochaine manche', 'Выбыл – вернёшься в следующем раунде', '已被淘汰——下一回合返回'],
['Nächste Runde beginnt', 'Next round starting', 'Empieza la próxima ronda', 'La prochaine manche commence', 'Начинается следующий раунд', '下一回合即将开始'],
// Todesanzeige „von <b>Name</b>“ (ui/hud.js deathBy): das freistehende „von“ blieb im englischen Spiel deutsch
['von', 'by', 'por', 'par', 'от', '击杀者'],
['Restleben {#}', 'Health left {#}', 'Vida restante {#}', 'Vie restante {#}', 'Осталось здоровья: {#}', '剩余生命 {#}'], // Todesanzeige: Leben des Gegners
];
