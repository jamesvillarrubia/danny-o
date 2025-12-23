# Welcome to Danny Tasks

Danny Tasks is an AI-powered task management system with intelligent categorization, prioritization, and time estimation.

## Features

- **AI-Powered Classification** — Automatically categorizes tasks using Claude AI
- **Model Context Protocol (MCP)** — 17 MCP tools for AI agent integration
- **Intelligent Enrichment** — Estimates time, energy level, and supplies needed
- **Multi-Database Support** — SQLite (local), PostgreSQL (production)
- **CLI & HTTP & MCP Modes** — Three interfaces to the same business logic
- **Todoist Integration** — Optional bi-directional sync with Todoist

## Quick Start

1. [Deploy your instance](/deployment) using our deployment wizard
2. Configure your API keys (Todoist and Claude)
3. Start managing tasks with AI assistance

## Architecture

Danny Tasks consists of:

- **API** (Backend) - NestJS application with CLI, HTTP, and MCP interfaces
- **Web** (Frontend) - React application for task management
- **Extension** (Browser) - Chrome extension for quick task access

## Next Steps

- [Deployment Guide](/deployment) - Get started with one-click deployment
- [API Documentation](/docs/api) - Learn about the API endpoints
- [Configuration](/docs/configuration) - Configure your instance
