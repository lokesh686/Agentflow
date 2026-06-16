# AgentFlow Pro

Multi-agent workflow SaaS with:

- **apps/api-gateway**: Node/Express API, auth, billing, workflows, executions, Redis pub/sub, Socket.io
- **apps/frontend**: React + Vite + TypeScript dashboard and workflow builder
- **services/orchestrator**: FastAPI + LangGraph worker that consumes Redis jobs and publishes live status
- **packages/shared**: placeholder for shared code

## Architecture

```text
Frontend -> API Gateway -> MongoDB / Redis -> Orchestrator -> Redis pub/sub -> Socket.io -> Frontend
```

### Runtime flow

1. A user creates or edits a workflow in the frontend.
2. The API gateway stores the workflow in MongoDB and validates the graph.
3. Starting an execution creates an execution record and pushes a Redis job.
4. The orchestrator consumes the job, runs the LangGraph workflow, and publishes step/status/result events.
5. The API gateway forwards Redis events to browser clients through Socket.io rooms.

## Repository structure

```text
agentflow-pro/
├── apps/
│   ├── api-gateway/   # Express API, auth, billing, workflows, executions
│   └── frontend/      # React 18 + TypeScript + Zustand + ReactFlow
├── services/
│   └── orchestrator/  # FastAPI worker and Redis queue processor
└── packages/
    └── shared/        # Shared code for future cross-app reuse
```

## Tech stack

| Area | Stack |
| --- | --- |
| API | Node.js, Express, Mongoose, Joi, Redis, Socket.io |
| Frontend | React 18, Vite, TypeScript, Zustand, React Router, ReactFlow |
| Orchestrator | Python 3.11, FastAPI, LangGraph, LangChain, Motor, Redis |
| Billing | Stripe |
| Auth | JWT + refresh-token rotation |

## Requirements

- Node.js 18+
- npm 9+
- Python 3.11+
- MongoDB
- Redis

## Setup

```bash
npm install
cp .env.example .env
cp services/orchestrator/.env.example services/orchestrator/.env
```

Populate the env files with MongoDB, Redis, JWT, SMTP, Stripe, and LLM values before starting the services.

## Run locally

### Full dev stack

```bash
npm run dev
```

### Individual services

```bash
npm run dev:api
npm run dev:frontend
npm run dev:orchestrator
```

## Build and test

```bash
npm run build
npm test
```

### Targeted API tests

```bash
npm test --workspace=apps/api-gateway
npm test --workspace=apps/api-gateway -- src/__tests__/auth.test.js
```

### Frontend build

```bash
npm run build --workspace=apps/frontend
```

## Ports

| Service | Port |
| --- | --- |
| API gateway | 3000 |
| Frontend | 5173 |
| Orchestrator | 8001 |
| MongoDB | 27017 |
| Redis | 6379 |

## Environment variables

### Root `.env.example`

- `MONGODB_URI`
- `REDIS_URL`
- `JWT_SECRET_PRIVATE`
- `JWT_SECRET_PUBLIC`
- `JWT_ACCESS_EXPIRY`
- `JWT_REFRESH_EXPIRY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `PINECONE_API_KEY`, `PINECONE_HOST`
- `OPENAI_API_KEY`, `GEMINI_API_KEY`
- `ORCHESTRATOR_URL`
- `VITE_API_URL`, `VITE_WS_URL`

### Orchestrator `.env.example`

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `TAVILY_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_HOST`
- `MONGODB_URI`
- `REDIS_URL`
- `PORT`
- `MAX_AGENT_STEPS`
- `MAX_EXECUTION_TIME_SECONDS`

## API surface

### Auth

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/auth/verify-email`
- `POST /v1/auth/forgot-password`
- `POST /v1/auth/reset-password`
- `GET /v1/auth/me`

### Workflows

- `POST /v1/workflows`
- `GET /v1/workflows`
- `GET /v1/workflows/:id`
- `PUT /v1/workflows/:id`
- `DELETE /v1/workflows/:id`
- `GET /v1/workflows/:id/versions/:version`
- `POST /v1/workflows/:id/execute`

### Executions

- `GET /v1/executions`
- `GET /v1/executions/:id`
- `POST /v1/executions/:id/cancel`
- `POST /v1/executions/:id/approve`

### Billing

- `GET /v1/billing`
- `POST /v1/billing/checkout`
- `POST /v1/billing/portal`
- `POST /v1/billing/webhook`

### Orchestrator

- `POST /api/trigger`
- `GET /api/executions/:execution_id/status`
- `GET /api/queue/length`
- `GET /health`

## Real-time events

The API gateway exposes Socket.io rooms for:

- `execution:<executionId>`
- `team:<teamId>`

The orchestrator publishes Redis events with execution step/status/error/done payloads, and the gateway forwards them to matching rooms.

## Key conventions

- API responses use `success` plus `data` or `error`.
- Route validation lives in the route layer with Joi.
- Workflow graphs use ReactFlow-style nodes and edges and are converted before persistence.
- Workflow history is capped at 10 snapshots.
- Execution updates are streamed through Redis pub/sub into Socket.io rooms.
- Refresh tokens are rotated and stored hashed.

## Reliability backlog

### P0

1. Add orchestrator tests for `build_graph`, `run_workflow`, `publish_*`, and the Redis worker loop.
2. Add Socket.io integration coverage for `join:team` and `join:execution` room routing.
3. Add end-to-end smoke tests for register/login/create workflow/execute workflow.

### P1

1. Add startup validation for required env vars and fail fast on missing MongoDB, Redis, JWT, Stripe, or LLM config.
2. Add queue retry/dead-letter handling in the orchestrator so transient failures do not drop jobs.
3. Add idempotency around execution/job processing to reduce duplicate processing after retries or reconnects.

### P2

1. Add structured logging and metrics for queue depth, execution duration, step failures, and API auth failures.
2. Add frontend error boundaries and loading-state coverage for workflow builder and execution detail pages.
3. Add health checks that verify MongoDB, Redis, and the orchestrator worker are all reachable.

## Notes

- `packages/shared` is present but currently acts as a placeholder.
- Docker Compose is available in `docker-compose.yml` for MongoDB, Redis, API gateway, orchestrator, and frontend.
