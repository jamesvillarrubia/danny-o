#!/usr/bin/env bash
# Pre-deployment check script
# Run this before deploying to Fly.io to catch errors early

set -e

echo "🔍 Pre-deployment checks starting..."
echo ""

# Type check
echo "📝 Running TypeScript type checks..."
pnpm typecheck || {
  echo "❌ Type check failed! Fix TypeScript errors before deploying."
  exit 1
}
echo "✅ Type checks passed"
echo ""

# Lint
echo "🔍 Running linters..."
pnpm lint || {
  echo "❌ Linting failed! Fix linting errors before deploying."
  exit 1
}
echo "✅ Linting passed"
echo ""

# Build
echo "🏗️  Testing build..."
pnpm build:api || {
  echo "❌ Build failed! Fix build errors before deploying."
  exit 1
}
echo "✅ Build successful"
echo ""

echo "✨ All pre-deployment checks passed! Safe to deploy."
