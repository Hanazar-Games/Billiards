#!/bin/bash
# Harness bootstrap: installs dependencies, runs the fast (Node-only) test
# suites and prints where development stands. Safe to run repeatedly.
# Update FAST_SUITES whenever the client's test layout changes; packages/*
# are picked up on their own.
set -euo pipefail
cd "$(dirname "$0")/.."

node_version=$(node -p 'process.versions.node')
IFS=. read -r major minor _ <<< "$node_version"
if (( major < 22 || (major == 22 && minor < 12) )); then
  echo "Node >= 22.12 required (found $node_version)" >&2
  exit 1
fi

# Browser suites use a preinstalled Chromium when one exists.
if [ -x /opt/pw-browsers/chromium ]; then
  export PUPPETEER_SKIP_DOWNLOAD=1
fi
npm install --no-audit --no-fund --loglevel=error

FAST_SUITES=(table lan ai audio instant-replay career ui-layout settings-audit
  trainer-challenge-safety achievement-toast tournament highlight panels runtime
  sim-worker trajectory-player local-match no-legacy-physics no-legacy-rules)
failed=()
for suite in "${FAST_SUITES[@]}"; do
  if ! npm run -s -w apps/client "test:$suite" > /dev/null 2>&1; then
    failed+=("$suite")
  fi
done

# Workspace packages (packages/*) run their own test script.
for pkg in packages/*/package.json; do
  [ -f "$pkg" ] || continue
  ws=$(dirname "$pkg")
  if ! npm test -w "$ws" > /dev/null 2>&1; then
    failed+=("$ws")
  fi
done

echo "== Harness: baseline =="
if [ ${#failed[@]} -eq 0 ]; then
  echo "fast suites: ${#FAST_SUITES[@]}/${#FAST_SUITES[@]} passing"
else
  echo "fast suites FAILING: ${failed[*]} (rerun with: npm run -w apps/client test:<suite>, or npm test -w <packages/name>)"
fi

node harness/status.mjs

[ ${#failed[@]} -eq 0 ]
