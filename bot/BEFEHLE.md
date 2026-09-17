# WorkerBot-Befehle

Alle Befehle werden von einem Server-OP im Spiel über `/worker` ausgeführt. Normale Chatnachrichten steuern den Bot nicht. Die Antwort erscheint als `[Worker]`-Nachricht.

## Steuerung und Status

| Befehl | Beispiel | Wirkung |
| --- | --- | --- |
| `/worker status` | `/worker status` | Rolle und aktuelle Aufgabe anzeigen. |
| `/worker stop` | `/worker stop` | Jede Worker-Aufgabe sofort beenden. |
| `/worker equip` | `/worker equip` | Beste verfügbare Rüstung und Waffe anlegen. |

## Bereiche anlegen

Stelle dich an die erste Ecke und speichere sie. Gehe dann zur diagonal gegenüberliegenden Ecke und speichere die zweite Position. Beide Punkte müssen in derselben Welt liegen.

```text
/worker pos1
/worker pos2
/worker area save guard dorf
```

Die Rollen `guard`, `farm` und `forest` sind für einen Bereich zulässig. Das gespeicherte Beispiel erzeugt den Wachdienstbereich `dorf`.

## Patrouille und Wachdienst

| Befehl | Beispiel | Wirkung |
| --- | --- | --- |
| `/worker patrol start <bereich>` | `/worker patrol start dorf` | Läuft die vier Ecken des Bereichs ab. Nicht erreichbare Punkte werden übersprungen. |
| `/worker patrol stop [bereich]` | `/worker patrol stop dorf` | Stoppt die aktive Patrouille. Die Bereichsangabe ist optional. |
| `/worker guard start <bereich>` | `/worker guard start dorf` | Patrouilliert und bekämpft nur konfigurierte feindliche Mobs im Bereich. |
| `/worker guard stop [bereich]` | `/worker guard stop` | Stoppt den aktiven Wachdienst. |

## Spieler folgen

```text
/worker follow
/worker follow Magicstyle
/worker follow stop
```

Ohne Spielernamen folgt WorkerBot dem OP, der den Befehl ausgeführt hat. Der Zielspieler muss sichtbar und in derselben Welt sein. WorkerBot hält ungefähr drei Blöcke Abstand und folgt nur innerhalb von 32 Blöcken. Bei größerer Entfernung hält er an und flüstert dem auslösenden OP eine persönliche, wechselnde Nachricht zu, etwa: `Magicstyle, du bist zu weit weg. Komm bitte näher, damit ich dir folgen kann.` Beim Annähern wird das Folgen automatisch fortgesetzt und ebenfalls per Flüstern mit einer persönlichen Variante bestätigt, zum Beispiel: `Ah, da bist du ja, Magicstyle. Ich komme!` Die Textvarianten liegen übersetzbar in `locales/de.json`.

Hat WorkerBot Creative-Flugberechtigung und das Ziel fliegt deutlich über ihm, aktiviert er den Flug und folgt dreidimensional. Sobald das Ziel wieder am Boden ist, verwendet der Bot wieder den normalen Boden-Pathfinder.

Folgt der Spieler unter Wasser oder liegt ein Ziel unter Wasser, wechselt WorkerBot automatisch auf Wasserwegfindung. Dabei kann er in Wasserhöhlen und vertikalen Wassersäulen auf- und abtauchen.

## Lager und Ressourcen

| Befehl | Beispiel | Wirkung |
| --- | --- | --- |
| `/worker chest set <name>` | `/worker chest set holzlager` | Speichert die gerade anvisierte Kiste oder das Fass. |
| `/worker deposit wood <kiste>` | `/worker deposit wood holzlager` | Legt unterstützte Baumstämme aus dem Inventar ab. |
| `/worker find <ressource> [radius]` | `/worker find oak_log 48` | Meldet die nächste gefundene Ressource im Radius 1 bis 128. |

Unterstützte ablegbare Holzarten sind Eichen-, Birken-, Fichten-, Dschungel-, Akazien-, Schwarzeichen-, Mangroven- und Kirschstämme sowie Crimson- und Warped-Stems.
