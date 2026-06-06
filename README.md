# AgentFlow Pro — Monorepo

Multi-Agent AI SaaS Platform

## Structure

```
agentflow-pro/
├── apps/
│   ├── api-gateway/       # Node.js / Express API + Auth + Billing
│   └── frontend/          # React 18 + TypeScript + TailwindCSS + ReactFlow
├── services/
│   └── orchestrator/      # Python / LangGraph agent execution engine
└── packages/
    └── shared/            # Shared types, constants, utilities
```

## Quick Start

```bash
# Install all workspace deps
npm install

# Copy env
cp .env.example .env

# Run all services (API + Frontend)
npm run dev

# Run orchestrator separately
npm run dev:orchestrator
```

## Services & Ports

| Service        | Port |
|---------------|------|
| API Gateway   | 3000 |
| Frontend      | 5173 |
| Orchestrator  | 8001 |
| MongoDB       | 27017|
| Redis         | 6379 |
