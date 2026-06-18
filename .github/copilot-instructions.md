# Copilot Instructions

## Repository layout

- Monorepo with `apps/api-gateway` (Node/Express), `apps/frontend` (React/Vite/TypeScript), `services/orchestrator` (FastAPI/Python), and `packages/shared` for shared code.
- The API gateway is the app-facing backend; the orchestrator is the execution engine that consumes Redis jobs and publishes status back to the UI.

## Commands

- Install dependencies: `npm install`
- Run full dev stack (API + frontend): `npm run dev`
- Run only the API gateway: `npm run dev:api`
- Run only the frontend: `npm run dev:frontend`
- Run the orchestrator: `npm run dev:orchestrator`
- Build all workspaces: `npm run build`
- Run all workspace tests: `npm test`
- Run API gateway tests: `npm test --workspace=apps/api-gateway`
- Run a single API test file: `npm test --workspace=apps/api-gateway -- src/__tests__/auth.test.js`
- Build the frontend only: `npm run build --workspace=apps/frontend`

## High-level architecture

- `src/index.js` in the API gateway wires Express, CORS, rate limiting, MongoDB, Redis, and Socket.io, then mounts auth/workflow/execution/billing routes under `/v1`.
- Workflow CRUD stays in MongoDB via Mongoose models; workflow graphs are persisted as ReactFlow-style nodes and edges, versioned, and soft-deleted.
- Execution requests are queued in Redis from the API gateway, processed by the Python orchestrator worker, and streamed back through Redis pub/sub to Socket.io rooms.
- The frontend uses React Router for page layout, Zustand stores for server state, ReactFlow for workflow building, and Socket.io for live execution updates.

## Conventions to follow

- API responses use a `success` flag plus `data` or `error`; keep that shape consistent in new routes.
- Route validation is done with Joi inside the route layer, usually through a local `validate(schema)` helper.
- `requireAuth` attaches `req.user` with `sub`, `teamId`, `role`, and `email`; role checks use the `viewer < member < admin < owner` hierarchy.
- Workflow graphs must use the existing node types (`research`, `writer`, `code`, `data`, `decision`, `notifier`, `custom`) and edge condition types (`always`, `on_success`, `on_error`, `contains`, `custom`).
- Custom workflow nodes require a non-empty `systemPrompt`; disconnected nodes and invalid edges are rejected by both client and server validation.
- Workflow history is capped at 10 snapshots, and graph edits snapshot the previous version before incrementing `version`.
- Lists for workflows and executions are cursor-based and exclude heavy nested data like history or steps.
- Frontend auth tokens live in `localStorage`, with `src/lib/api.ts` handling bearer injection and one silent refresh retry on `401`.
- The frontend workflow builder converts between Mongo shapes and ReactFlow shapes with explicit helper functions; preserve that boundary when editing builder code.
