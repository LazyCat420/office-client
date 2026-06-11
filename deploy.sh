#!/bin/bash
# ============================================================
# Office Client — Build & Deploy to Synology NAS
#
# Thin wrapper — all logic lives in ../deploy-kit/lib.sh
#
# Usage:
#   npm run deploy              # full deploy
#   npm run deploy -- --dry-run # validate without deploying
#   npm run deploy -- --skip-pull
#   npm run deploy -- --no-cache
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="office-client"
DISPLAY_NAME="🏢 Office Client"
SKIP_ENV_DEPLOY=true

source "${SCRIPT_DIR}/../deploy-kit/lib.sh"
