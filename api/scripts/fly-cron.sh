#!/bin/sh
# Fly.io Cron Job Script
# 
# This script is called by scheduled Fly.io machines to trigger cron endpoints.
# It uses the CRON_SECRET environment variable for authentication.

set -e

ENDPOINT=$1
API_URL="${FLY_APP_NAME:-danny-tasks-api}.fly.dev"
CRON_SECRET="${CRON_SECRET}"

if [ -z "$ENDPOINT" ]; then
  echo "Usage: $0 <endpoint>"
  echo "Example: $0 sync"
  exit 1
fi

# Construct full URL
FULL_URL="https://${API_URL}/api/cron/${ENDPOINT}"

# Make request with authorization header if secret is set
if [ -n "$CRON_SECRET" ]; then
  curl -f -X GET \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "User-Agent: Fly.io-Cron/1.0" \
    "$FULL_URL"
else
  # No secret configured - make request without auth
  curl -f -X GET \
    -H "User-Agent: Fly.io-Cron/1.0" \
    "$FULL_URL"
fi
