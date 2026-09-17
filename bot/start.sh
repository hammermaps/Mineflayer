#!/usr/bin/env bash
set -euo pipefail

bot_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 oder neuer ist erforderlich." >&2
  exit 1
fi
node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 22 ]; then
  echo "Node.js 22 oder neuer ist erforderlich (gefunden: $(node --version))." >&2
  exit 1
fi
if [ -f "$bot_dir/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$bot_dir/.env"
  set +a
fi
if [ -n "${WORKER_CONFIG:-}" ] && [[ "$WORKER_CONFIG" != /* ]]; then
  export WORKER_CONFIG="$bot_dir/$WORKER_CONFIG"
else
  export WORKER_CONFIG="${WORKER_CONFIG:-$bot_dir/config.json}"
fi
while true; do
  set +e
  node "$bot_dir/src/index.js"
  exit_code=$?
  set -e
  echo "WorkerBot getrennt (Exit $exit_code); erneuter Verbindungsversuch in 5 Sekunden." >&2
  sleep 5
done
