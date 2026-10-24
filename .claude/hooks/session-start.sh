#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: prepares dependencies and
# prints the harness status (see harness/init.sh) into the session context.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Browser suites run on the preinstalled Chromium instead of a downloaded one.
if [ -x /opt/pw-browsers/chromium ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo 'export PUPPETEER_SKIP_DOWNLOAD=1'
    echo 'export PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium'
  } >> "$CLAUDE_ENV_FILE"
fi

exec bash harness/init.sh
