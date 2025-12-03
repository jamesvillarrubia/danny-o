# Danny-O: AI-Powered Task Management Agent

This repository contains two isolated implementations of an AI-powered task management system for Todoist:

## 📁 Project Structure

### `legacy/` - Original Prototype (JavaScript)
The initial MVP implementation built with vanilla JavaScript/Node.js. This version served as the proof-of-concept and exploration of core features.

**👉 [View Legacy Documentation](./legacy/README.md)**

### `nest/` - Production Version (NestJS TypeScript)
The production-ready implementation built with NestJS and TypeScript. Features full modularity, comprehensive testing, Docker support, and MCP (Model Context Protocol) integration.

**👉 [View NestJS Documentation](./nest/README.md)**

## 🚀 Quick Start

Choose your implementation:

**For exploring the original concept:**
```bash
cd legacy
pnpm install
# See legacy/README.md for setup
```

**For production use:**
```bash
cd nest
pnpm install
# See nest/README.md for setup
```

## 📋 Key Differences

| Feature | Legacy | NestJS |
|---------|--------|--------|
| Language | JavaScript | TypeScript |
| Framework | None | NestJS |
| Architecture | Flat/Simple | Modular/DI |
| Testing | Basic | Comprehensive (Unit/Integration/E2E) |
| Deployment | Manual | Docker + Cloud Ready |
| Type Safety | None | Strict TypeScript |
| MCP Server | Basic | Full Implementation |

## 📖 Documentation

Both implementations share the same core functionality but differ in architecture and deployment strategies. Refer to each subdirectory's README for specific documentation.

---

**Note:** Each implementation is completely isolated with its own dependencies, configuration, and data storage. They can coexist and run side-by-side without conflict.

