# Freetown UrbanAI

Freetown UrbanAI is a prototype Mayor's Office Policy Intelligence Pilot for source-grounded briefing support across curated climate, urban resilience, AQS, Moyiba, CAP, and partner-facing policy materials.

It is a bounded leadership-use evidence console. It is not a generic chatbot, a tracker replacement, a full FCC-wide IT platform, or an official deployment claim.

## Current Architecture

The current system is:

```text
React/Vite frontend -> Node/Express backend API -> SQLite local corpus/retrieval -> direct model provider layer
```

The backend owns the request lifecycle: sessions, message persistence, request logging, corpus retrieval, direct model invocation, response normalization, and answer composition. Provider selection is isolated behind `backend/src/services/upstreamPolicyService.ts` and `backend/src/providers/`.

The backend supports:

- local login with hashed passwords and bearer-session tokens
- basic roles for `admin`, `operator`, and `briefing_user`
- user-bound chat sessions and scoped session history
- login-first frontend access shell with role-aware console rendering
- local metadata storage in SQLite
- `.md`, `.txt`, `.json`, `.html`, and `.htm` text extraction
- deterministic chunking
- SQLite FTS5 lexical retrieval
- approved-only default retrieval for normal briefing use
- explicit debug/test access for draft-inclusive retrieval
- retrieval-backed answers when no direct provider is configured
- source, caveat, and claim-safety response fields

## Quick Start

Install root frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
npm --prefix backend install
```

Create local env files:

```bash
cp .env.example .env.local
cp backend/.env.example backend/.env
```

Initialize the database and seed the safe demo corpus:

```bash
npm run db:init
npm run bootstrap:admin
npm run seed:demo
```

Start backend and frontend in two terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Or run both from one terminal:

```bash
npm run dev:all
```

Open the frontend at `http://localhost:5173`. The backend defaults to `http://localhost:3001/api`.

Unauthenticated users see only the internal access screen. The policy console, evidence panels, corpus status, and role-aware controls load only after successful login.

## Operator Workflow

Use this sequence to reproduce the intended local prototype state:

1. `npm install`
2. `npm --prefix backend install`
3. `cp .env.example .env.local`
4. `cp backend/.env.example backend/.env`
5. `npm run db:init`
6. Set a real local `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`.
7. `npm run bootstrap:admin`
8. `npm run seed:demo`
9. `npm run dev:backend`
10. `npm run dev:frontend`
11. Sign in with the bootstrapped admin account.
12. Ask a retrieval-backed briefing question in the UI.
13. Inspect `GET http://localhost:3001/api/ready` or use an admin token for retrieval debug if needed.

## Environment Model

Frontend config lives in `.env.local`:

```bash
VITE_POLICY_API_BASE_URL=http://localhost:3001/api
```

The frontend should only know the backend API URL. It should not know raw model-provider credentials, webhook URLs, or provider request shapes.

Backend config lives in `backend/.env`:

```bash
PORT=3001
CORS_ORIGIN=http://localhost:5173
DATA_DIR=data
DB_PATH=data/freetown.db
UPLOAD_DIR=data/uploads

MODEL_PROVIDER_TYPE=none
MODEL_PROVIDER_MODEL=
MODEL_PROVIDER_TIMEOUT_MS=30000
MODEL_PROVIDER_BASE_URL=
MODEL_PROVIDER_API_KEY=
MODEL_PROVIDER_API_KEY_ENV_VAR=
ANTHROPIC_VERSION=2023-06-01
LEGACY_N8N_CHAT_WEBHOOK_URL=

OPENAI_API_KEY=
ANTHROPIC_API_KEY=
DASHSCOPE_API_KEY=

ADMIN_EMAIL=admin@example.local
ADMIN_NAME=Policy Intelligence Admin
ADMIN_PASSWORD=change-this-local-password
ADMIN_ROLE=admin
```

Provider notes:

- `MODEL_PROVIDER_TYPE=openai_compatible` supports OpenAI itself and OpenAI-compatible endpoints such as Alibaba DashScope / Qwen-style APIs.
- `MODEL_PROVIDER_BASE_URL` is optional for `openai_compatible` and `anthropic`; defaults are built in.
- Use `MODEL_PROVIDER_API_KEY` directly or point at a named secret with `MODEL_PROVIDER_API_KEY_ENV_VAR`. This is useful for values like `OPENAI_API_KEY`, `DASHSCOPE_API_KEY`, or `ANTHROPIC_API_KEY`.
- `MODEL_PROVIDER_TYPE=anthropic` uses the native Anthropic Messages API path.
- `LEGACY_N8N_CHAT_WEBHOOK_URL` exists only for transition use when `MODEL_PROVIDER_TYPE=legacy_n8n`.
- Leave provider fields empty for retrieval-only local operation without direct model synthesis.

`ADMIN_*` values are used by `npm run bootstrap:admin` to create or update the initial local administrator. Do not commit real passwords.

## Data Layout

Runtime data is local-first:

- `data/freetown.db` stores corpus metadata, extracted text, chunks, sessions, messages, and request logs.
- `data/uploads/` stores uploaded local evidence files.
- `backend/fixtures/demo-corpus/` contains safe committed demo corpus files.
- `backend/dist/` and `dist/` are generated build outputs.

SQLite files, uploads, and generated build outputs are gitignored. See `data/README.md` for the runtime storage notes.

## Corpus And Retrieval

Corpus lifecycle status is intentionally simple:

- `registered`
- `extracting`
- `extracted`
- `chunking`
- `chunked`
- `indexing`
- `indexed`
- `failed`

Normal leadership-use retrieval is approved-only by default. Draft material does not silently influence briefing answers. Draft-inclusive retrieval is limited to explicit debug/test pathways, such as:

```bash
curl -H "Authorization: Bearer <admin-or-operator-token>" \
  "http://localhost:3001/api/retrieval/debug?q=partner%20briefing&includeDrafts=true"
```

Frontend-facing document responses do not expose local host filesystem paths. The backend keeps internal `file_path` metadata for ingestion and reindexing.

## Authentication And Roles

The Phase 6 governance layer uses local email/password login for a small trusted user set. Passwords are salted and hashed with `scrypt`; API sessions are stored in SQLite and sent by the frontend as bearer tokens.

Roles are intentionally minimal:

- `admin` - platform/system owner. This role maps to project ownership and can perform corpus operations, owner-only retrieval debug, and broad session-governance inspection.
- `operator` - corpus/evidence operations support. This role can upload, register, edit, approve, ingest, reindex, and inspect document chunks, but is not treated as platform owner.
- `briefing_user` - leadership-use consumer. This role can use chat, view approved evidence outputs, view normal document/corpus status, and access only their own chat history.

Route policy:

- `POST /api/chat` requires login and binds the chat session to the authenticated user.
- `GET /api/documents`, `GET /api/documents/:id`, and `GET /api/corpus/stats` require login.
- Document mutation, upload, ingestion, reindexing, chunk inspection, and approval routes require `admin` or `operator`.
- `GET /api/retrieval/debug` requires `admin`; draft-inclusive debug requires an explicit `includeDrafts=true` flag.
- `GET /api/sessions/:id/history` is owner-scoped for `operator` and `briefing_user`. `admin` may inspect sessions for local governance and troubleshooting.

Backend permission matrix:

| Route | briefing_user | operator | admin |
|---|---:|---:|---:|
| `POST /api/chat` | Yes | Yes | Yes |
| `GET /api/documents` | Yes | Yes | Yes |
| `GET /api/documents/stats` | Yes | Yes | Yes |
| `GET /api/documents/:id` | Yes | Yes | Yes |
| `POST /api/documents` | No | Yes | Yes |
| `POST /api/documents/upload` | No | Yes | Yes |
| `POST /api/documents/reindex` | No | Yes | Yes |
| `PATCH /api/documents/:id` | No | Yes | Yes |
| `POST /api/documents/:id/ingest` | No | Yes | Yes |
| `POST /api/documents/:id/reindex` | No | Yes | Yes |
| `GET /api/documents/:id/chunks` | No | Yes | Yes |
| `PATCH /api/documents/:id/approval` | No | Yes | Yes |
| `GET /api/corpus/stats` | Yes | Yes | Yes |
| `GET /api/retrieval/debug` | No | No | Yes |
| `GET /api/sessions/:id/history` | Own only | Own only | Any session |

Frontend behavior:

- Before login, the app shows a restrained internal access screen with no corpus details, debug affordances, or operational state.
- After login, the app renders the policy intelligence console and starts protected corpus/document loading.
- Expired or invalid auth returns the app to the login gate and clears the local policy session id.
- `briefing_user` accounts see normal briefing and approved-evidence views.
- `operator` accounts can see corpus-management affordances, such as evidence upload.
- `admin` accounts are labelled as platform owner and retain owner-only debug/session-governance routes.

Create or update the first admin user with:

```bash
ADMIN_EMAIL=admin@example.local ADMIN_PASSWORD=change-this-local-password npm run bootstrap:admin
```

For normal local work, put the same values in `backend/.env` and run `npm run bootstrap:admin`.

## Scripts

Root scripts:

- `npm run dev:frontend` - start Vite frontend.
- `npm run dev:backend` - start backend from TypeScript source.
- `npm run dev:all` - start backend and frontend together for local work.
- `npm run db:init` - initialize SQLite schema.
- `npm run bootstrap:admin` - create or update the first local admin user from backend env vars.
- `npm run seed:demo` - load safe demo corpus fixtures.
- `npm run reindex` - reindex locally ingestible registered files.
- `npm run test:backend` - run backend tests.
- `npm run typecheck:backend` - run backend TypeScript checks.
- `npm run build:backend` - build backend to `backend/dist`.
- `npm run build:frontend` - build frontend to `dist`.
- `npm run build:all` - build backend and frontend.
- `npm run validate` - run backend typecheck, backend tests, and both builds.

Backend scripts are also available inside `backend/package.json`.

## Docker

Build and start both services:

```bash
docker compose up --build
```

The frontend is served at `http://localhost:5173`; the backend is exposed at `http://localhost:3001`.

Seed the demo corpus inside the backend container:

```bash
docker compose run --rm backend npm run bootstrap:admin
docker compose run --rm backend npm run seed:demo
```

Check readiness:

```bash
curl http://localhost:3001/api/ready
```

Docker uses a named volume, `freetown-urbanai-data`, for SQLite and uploads. This is local prototype packaging, not production deployment.

## Runtime Checks

Useful backend routes:

- `GET /api/health` - backend process is alive.
- `GET /api/ready` - backend status, corpus readiness, and direct provider configuration status.
- `POST /api/auth/login` - local user login.
- `GET /api/auth/me` - current authenticated user.
- `POST /api/auth/logout` - revoke the current local API session.
- `GET /api/corpus/stats` - authenticated document/chunk counts and lifecycle state.
- `GET /api/documents` - authenticated API-safe document registry listing.
- `GET /api/documents/:id/chunks` - admin/operator chunk inspection for a document.
- `GET /api/retrieval/debug?q=partner%20briefing` - admin-only approved-only retrieval debug.
- `GET /api/retrieval/debug?q=partner%20briefing&includeDrafts=true` - admin-only explicit draft-inclusive debug.
- `POST /api/chat` - authenticated backend-owned policy intelligence chat route.

Before a demo, the app is usable when:

- backend is running
- frontend is pointed at the backend API
- at least one local user has been bootstrapped
- at least one approved document is indexed
- a direct provider is either configured or intentionally absent

## Governance Notes

This prototype should be described carefully:

- It supports Mayor's Office briefing and evidence retrieval.
- It uses approved or curated evidence rather than claiming ownership of FCC records.
- Normal briefing retrieval defaults to approved evidence only.
- Draft material is for explicit pilot testing/debugging, not silent leadership-use evidence.
- Users must sign in before using the briefing console.
- Chat sessions are user-bound; only the platform owner can inspect across users.
- Corpus mutation is available to operator/admin users; retrieval debug is admin-only.
- It does not replace Mariama's tracker or any operational FCC tracking system.
- It is not positioned as an Alpha, Digital Economy, or FCC-wide platform.
- It does not imply official FCC adoption or production deployment.
- Outputs require human review before external use.

## Still Deferred

- embeddings or vector DB
- SSO/OAuth or enterprise IAM
- multi-tenant access control
- PDF/DOCX parsing
- production ingestion/watch workflows
- formal approval workflow
- advanced reranking or retrieval evaluation
- LLM-grade claim-safety generation
- cloud deployment hardening
- advanced provider failover or routing
