#!/bin/sh
# Setup Fly.io Cron Jobs
#
# This script creates scheduled machines for cron jobs.
# Run this after deploying your main app.

set -e

APP_NAME="${FLY_APP_NAME:-danny-tasks-api}"
CRON_SECRET="${CRON_SECRET}"

if [ -z "$CRON_SECRET" ]; then
  echo "Warning: CRON_SECRET not set. Cron jobs will run without authentication."
  echo "Set it with: fly secrets set CRON_SECRET=your-secret-here"
fi

echo "Setting up cron jobs for ${APP_NAME}..."

# Create sync cron machine (runs every 5 minutes)
echo "Creating sync cron machine..."
fly machines create \
  --name "${APP_NAME}-cron-sync" \
  --region iad \
  --vm-size shared-cpu-1x \
  --vm-memory 256 \
  --schedule "*/5 * * * *" \
  --env "FLY_APP_NAME=${APP_NAME}" \
  --env "CRON_SECRET=${CRON_SECRET}" \
  --env "NODE_ENV=production" \
  --command "/app/scripts/fly-cron.sh sync" \
  --image "curlimages/curl:latest" \
  || echo "Machine may already exist, skipping..."

# Create classify cron machine (runs every 15 minutes)
echo "Creating classify cron machine..."
fly machines create \
  --name "${APP_NAME}-cron-classify" \
  --region iad \
  --vm-size shared-cpu-1x \
  --vm-memory 256 \
  --schedule "*/15 * * * *" \
  --env "FLY_APP_NAME=${APP_NAME}" \
  --env "CRON_SECRET=${CRON_SECRET}" \
  --env "NODE_ENV=production" \
  --command "/app/scripts/fly-cron.sh classify" \
  --image "curlimages/curl:latest" \
  || echo "Machine may already exist, skipping..."

echo ""
echo "Cron jobs configured!"
echo ""
echo "To verify, check machine status:"
echo "  fly machines list"
echo ""
echo "To view cron logs:"
echo "  fly logs -a ${APP_NAME}-cron-sync"
echo "  fly logs -a ${APP_NAME}-cron-classify"
