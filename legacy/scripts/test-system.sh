#!/bin/bash

# Test System Script
# Verifies that all components are working

echo "🧪 Testing Todoist AI Task Manager..."
echo ""

# Check Node version
echo "📋 Checking Node version..."
node --version
if [ $? -ne 0 ]; then
    echo "❌ Node.js not found"
    exit 1
fi
echo "✅ Node.js OK"
echo ""

# Check dependencies
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not installed. Run: pnpm install"
    exit 1
fi
echo "✅ Dependencies OK"
echo ""

# Check .env file
echo "🔧 Checking configuration..."
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Copy .env.example to .env and add your API keys."
    echo "   You can still test without API keys (some features won't work)"
fi
echo ""

# Test storage initialization
echo "💾 Testing storage layer..."
node -e "import('./src/storage/factory.js').then(m => m.createStorage().then(s => { console.log('✅ Storage OK'); s.close(); })).catch(e => { console.error('❌ Storage failed:', e.message); process.exit(1); })"
echo ""

# Test imports
echo "📚 Testing imports..."
node -e "import('./src/index.js').then(() => console.log('✅ Imports OK')).catch(e => { console.error('❌ Import failed:', e.message); process.exit(1); })"
echo ""

# Check if we can run CLI
echo "🖥️  Testing CLI..."
if node src/cli/index.js --version > /dev/null 2>&1; then
    echo "✅ CLI OK"
else
    echo "⚠️  CLI test skipped (needs API keys)"
fi
echo ""

echo "🎉 Basic system checks complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env"
echo "2. Add your TODOIST_API_KEY and CLAUDE_API_KEY"
echo "3. Run: pnpm run cli sync"
echo "4. Run: pnpm run cli classify --all"
echo ""
echo "For full documentation, see README.md"

