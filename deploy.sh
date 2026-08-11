#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — commit, push, and deploy to production server
# Usage: ./deploy.sh "your commit message here"
# ─────────────────────────────────────────────────────────────────────────────

set -e

MSG="${1}"

if [ -z "$MSG" ]; then
  echo "❌  Usage: ./deploy.sh \"your commit message\""
  exit 1
fi

echo "📦  Staging all changes..."
git add -A

echo "✅  Committing: $MSG"
git commit -m "$MSG"

echo "🚀  Pushing to GitHub..."
git push

echo "🌐  Deploying to server..."
ssh root@pntos.payroo.xyz "cd /var/www/pntos.payroo.xyz && git pull && npm run build && pm2 restart payroo"

echo "✅  Deploy complete!"
