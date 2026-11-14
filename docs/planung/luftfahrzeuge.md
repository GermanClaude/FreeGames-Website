# Luftfahrzeuge (Hubschrauber und Kampfjet)

Stand 14.11. – Code in `assets/js/game/vehicles/air/*`, eingebunden in das Fahrzeugsystem `G.vehicles`.

## Muster

| Typ | Name | Sitze | Waffen |
|---|---|---|---|
| `heli` | KHS-4 Sperber (Kampf-/Transporthubschrauber) | Pilot, Bordschütze, 4 × Truppenraum | Pilot: 80-mm-Raketen (14), 30-mm-Kanone starr · Schütze: 30-mm-Kinnturm · Täuschkörper |
| `jet` | JK-9 Falke (Kampfjet) | Pilot | 27-mm-Bordkanone, 70-mm-Raketen (12), 250-kg-Bomben (4) · Täuschkörper |

Nur auf großen Karten (`militaryVehiclesAllowed`: Grenzland, Niemandsland, Brandwald) mit Fahrzeug-Stellplätzen; je Team ein
Hubschrauber und ein Jet hinter der eigenen Basis (Platz frei von Gebäuden und Baumkronen). Der Jet steht am Boden und
startet nach dem Einsteigen aus der Luft (Karten ohne Startbahn). Luftraum: Kartenrand + 650 m (Jet) bzw. + 120 m
(Hubschrauber) – danach Warnung, nach 5 s kehrt ein Autopilot um.

URL: `?air=0` (keine Luftfahrzeuge), `?air=1` (auch ohne Fahrzeug-Stellplätze), `?airbots=0|1|2` (KI-Piloten aus |
nur Gegnerteam (Standard, offline) | beide Teams).

## Steuerung

| | Tastatur/Maus | Gamepad | Touch |
|---|---|---|---|
| Steigen/Sinken bzw. Schub ± | W/S | linker Stick ↕ | linker Stick ↕, „Steigen/Sinken“ |
| Gieren (Heckrotor/Seitenruder) | A/D | linker Stick ↔ | linker Stick ↔ |
| Knüppel (Nicken/Rollen) | Maus | rechter Stick | Ziehen rechts |
| Umsehen (+ Zoom) | rechte Maustaste halten | LT | – |
| Schweben (Heli) / Luftbremse (Jet) | Leertaste | A | „Schweben“/„Bremse“ |
| Nachbrenner | Umschalt | L3 | „Nachbrenner“ |
| Täuschkörper | X | RB | „Täuschkörper“ |
| Feuer / Waffe / Sicht | LMT / Mausrad / C | RT / Y / B | wie Fahrzeuge |
| Aussteigen (in der Luft: Fallschirm) | F | X halten | „Aussteigen“ |

## Skript-API (`G.vehicles.air`)

```js
const air = G.vehicles.air;
const h = air.spawn('heli', pos, { yaw: 0, team: 'A' });                     // am Boden, Rotor aus
const j = air.spawn('jet', posInAir, { team: 'B', airborne: true, speed: 120 }); // im Flug
air.board(G.player, h, 0);          // Sitz 0 = Pilot, 1 = Bordschütze, 2–5 Truppenraum (auch Bots)
const ai = air.pilotBot(bot, h);    // KI-Pilot (nur Hubschrauber): Abheben, Umkreisen, Angreifen, Rückzug
air.order(h, { orbit: punkt, attack: zielAkteurOderFahrzeug, home: basis });
air.fly(h, { to: punkt, alt: 60, speed: 40 });   // Autopilot ohne KI (Pilot muss an Bord sein)
air.fly(h, { hover: true, alt: 30 });            // Schweben auf Höhe über Grund
air.release(h);                     // Autopilot/KI beenden
air.flares(h);                      // Täuschkörper-Salve
air.destroy(h, angreifer);          // Abschuss (Tests/Skripte)
air.list();                         // alle Luftfahrzeuge
```

Ereignisse (`G.events`): `vehicle:airstart {vehicle, phase: 'bereit'|'start'}`, `vehicle:flare {vehicle}` sowie alle
Fahrzeugereignisse (`vehicle:enter/exit/seat/fire/hit/damaged/destroyed …`). Zustand am Objekt: `v.body.agl` (Höhe über
Grund), `v.body.vel`, `v.body.rpm`, `v.alive`, `v.health`, `v.zones`, `v.flares.left`, `v.threat` (Raketenwarnung bis).

## Flugabwehr

Raketen des Raketenwerfers (RW-90 Donnerkeil, auch Bots) erfassen beim Abschuss ein feindliches Luftfahrzeug im 8°-Kegel
(≤ 700 m), lenken leicht nach (1,7 rad/s) und zünden in 6,5 m Nähe (330 Schaden + Splitter). Täuschkörper lenken sie mit
85 % ab. Das Trophäensystem bleibt unverändert.

## Netz

Host-autoritativ über `vehicles/net.js` (gleicher 64-Byte-Block, Interpolation wie Panzer): Pilot schickt Knüppel in
`aimYaw/aimPitch`, Täuschkörper/Nachbrenner/Schweben in `bits 5–7`; Raketen/Bomben als `'vs'`, Täuschkörper als `'vf'`.
`NET_VERSION` 17.
