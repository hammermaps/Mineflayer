# WorkerBot für Paper 26.3

Der WorkerBot ist eine eigenständige Anwendung. Er verändert die Mineflayer-API nicht und akzeptiert **keine Chat-Befehle**: Steuerung erfolgt ausschließlich über das OP-geprüfte Paper-Gateway `/worker`.

## Start

1. `cp bot/.env.example bot/.env` und bei Bedarf Host, Port, Botname oder Auth-Modus anpassen.
2. `npm install` im Repository ausführen (installiert auch `mineflayer-pathfinder`).
3. Gateway bauen und installieren:
   `cd bot/paper-worker-gateway && mvn package && cp target/paper-worker-gateway.jar ../../test-server/plugins/`
   Das Gateway wird kompatibel zu Java 25 gebaut und läuft auch mit Java 26. In `plugins/PaperWorkerGateway/config.yml` muss `bot-player-name` dem `WORKER_USERNAME` entsprechen.
4. Paper starten und danach `bot/start.sh` ausführen.

Die erste Änderung über `/worker area ...` oder `/worker chest ...` legt die lokale, absichtlich ignorierte `bot/config.json` an. Die versionierte `config.example.json` dokumentiert Rollen, Ressourcen und Standard-Gegner.

## OP-Befehle

`/worker status`, `stop`, `equip`, `pos1`, `pos2`, `area save <guard|farm|forest> <name>`, `chest set <name>`, `patrol start <area>`, `patrol stop`, `guard start <area>`, `guard stop`, `deposit wood <chest>` und `find <resource> [radius]`.

Wache und Patrouille verwenden den gespeicherten Bereich. Nur die in `roles.guard.allowedMobs` konfigurierte feindliche Mobliste wird innerhalb dieses Bereichs angegriffen. Eine Verteidigung unterbricht die Patrouille und führt sie danach fort. Farmer und Förster enthalten bereits Bereich-, Ressourcen-, Werkzeug- und Lagerverträge; Fällen, Aufforsten, Feldanlage und Ernte sind bewusst noch nicht implementiert.

## Prüfung

`npm run bot:test` testet Nachrichtenschema, Bereichsvalidierung, Prioritätswarteschlange, Ausrüstungswahl und Holzerkennung. Für die manuelle 26.3-Integration: als OP die obigen Befehle ausführen, Chatzeilen ohne `/worker` müssen ignoriert bleiben; Wache, Ausrüstung und Holzeinlagerung im lokalen Paper-Server prüfen.
