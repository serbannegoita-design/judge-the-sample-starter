#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf 'Node.js and npm are required. Install Node.js 22.12+ (or 20.19+) and reopen Git Bash.\n' >&2
  exit 1
fi
if [ ! -d node_modules ]; then
  npm install
fi
printf '\nOpen the Local address printed by Vite (usually http://127.0.0.1:5173/).\nStop with Ctrl+C in this terminal.\n\n'
npm run dev
