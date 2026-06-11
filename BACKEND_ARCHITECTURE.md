# Freetown UrbanAI — Backend Architecture

## Phase 7 Checkpoint: Direct Provider Ownership

The backend now owns direct model invocation as part of the normal request path. The intended runtime boundary is no longer "backend plus a normal n8n model bridge." It is:

```text
Frontend
  -> backend API
  -> local retrieval and answer-composition layer
  -> direct provider client
```

Supported provider types in the current backend are:

- `openai_compatible`
- `anthropic`
- `legacy_n8n` as an explicit transition-only fallback
- `none` for retrieval-only operation without model synthesis

The provider layer is isolated into `backend/src/providers/`:

- `config.ts` resolves env-driven provider selection
- `openaiCompatibleProvider.ts` handles OpenAI-compatible chat-completions APIs
- `anthropicProvider.ts` handles Anthropic Messages API calls
- `legacyN8nProvider.ts` exists only for explicit transition use

This keeps ownership clean:

- retrieval still happens before generation
- answer composition still happens in the backend
- auth, session logging, and governance remain unchanged
- provider-specific request/response quirks are contained behind one service boundary

The current configuration model is explicit rather than magical:

- `MODEL_PROVIDER_TYPE`
- `MODEL_PROVIDER_MODEL`
- `MODEL_PROVIDER_TIMEOUT_MS`
- `MODEL_PROVIDER_BASE_URL`
- `MODEL_PROVIDER_API_KEY` or `MODEL_PROVIDER_API_KEY_ENV_VAR`
- `ANTHROPIC_VERSION` for native Anthropic calls
- `LEGACY_N8N_CHAT_WEBHOOK_URL` only when legacy webhook bridging is intentionally retained

This means the backend can now call OpenAI-compatible endpoints directly, including OpenAI itself and Alibaba DashScope / Qwen-style OpenAI-compatible APIs, while also supporting a separate native Anthropic/Claude path.

## Phase 6 Checkpoint: Minimum Governance And Access Layer

The project now has a lean local governance layer appropriate for a bounded Mayor's Office Policy Intelligence Pilot. This is not enterprise IAM, SSO, or a production identity system; it is a real local access boundary for a small trusted user set.

Current access model:

```text
Unauthenticated user
  -> login gate
  -> POST /api/auth/login
  -> bearer token
  -> authenticated backend API
```

The backend now owns:

- local user records in SQLite
- salted `scrypt` password hashes
- bearer-session token persistence and revocation
- role checks for `admin`, `operator`, and `briefing_user`
- user-bound chat sessions
- owner-scoped session history for normal users
- request/audit logging with authenticated `user_id` and action labels

Phase 6.3 separates the roles into a clearer three-level ownership model:

- `admin` is the platform/system owner. It maps to project ownership and retains owner-only governance controls such as retrieval debug and broad session inspection.
- `operator` is corpus/evidence operations support. It can manage documents and evidence operations, but it is not equivalent to platform owner.
- `briefing_user` is a leadership-use consumer. It can use the tool and view normal approved-evidence outputs, but cannot perform corpus operations or debug/admin actions.

Route policy is intentionally simple:

- `GET /api/health` and `GET /api/ready` remain public runtime checks.
- `POST /api/auth/login`, `GET /api/auth/me`, and `POST /api/auth/logout` own local auth flow.
- `POST /api/chat` requires login and binds each chat session to the authenticated user.
- `GET /api/documents`, `GET /api/documents/:id`, and `GET /api/corpus/stats` require login.
- Document mutation, upload, ingestion, reindexing, chunk inspection, and approval operations require `admin` or `operator`.
- `GET /api/retrieval/debug` requires `admin`; draft-inclusive retrieval debug requires an explicit `includeDrafts=true` opt-in.
- `GET /api/sessions/:id/history` is scoped to the owning user for `briefing_user` and `operator`. `admin` may inspect any session for owner-level local governance and troubleshooting.

The frontend now has:

- a login gate before the policy intelligence console
- token-based authenticated API calls
- logout
- current-user display
- role-based hiding of corpus upload/management controls for normal briefing users
- owner/operator labels that distinguish platform ownership from corpus operations

The local operator bootstrap path is:

```bash
npm run db:init
ADMIN_EMAIL=admin@example.local ADMIN_PASSWORD=change-this-local-password npm run bootstrap:admin
npm run seed:demo
```

This strengthens the pilot boundary: normal leadership-use retrieval remains approved-only, draft-inclusive retrieval remains explicit admin-only debug behavior, operators can support corpus operations without becoming platform owners, and non-admin users cannot inspect another user's session history by default.

Still intentionally deferred after Phase 6:

- SSO/OAuth and enterprise identity providers
- multi-tenant access architecture
- fine-grained permission matrices
- production-grade secrets management
- audit dashboards
- embeddings or vector database

## Phase 5 Checkpoint: Runtime And Packaging Model

The project is now packaged as a reproducible local engineering artifact rather than only a prototype codebase.

Current runtime model:

```text
Browser
  -> frontend container or Vite dev server
  -> backend API
  -> local SQLite data directory
  -> optional temporary upstream model/workflow bridge
```

Configuration is split by ownership boundary:

- Frontend config lives in `.env.local` and only points at `VITE_POLICY_API_BASE_URL`.
- Backend config lives in `backend/.env` and owns `PORT`, `CORS_ORIGIN`, `DATA_DIR`, `DB_PATH`, `UPLOAD_DIR`, and optional `N8N_CHAT_WEBHOOK_URL`.
- Upstream workflow config is backend-only. The frontend never receives raw n8n/webhook configuration.

Local storage is explicit:

- `data/freetown.db` is the SQLite runtime database.
- `data/uploads/` is local uploaded evidence storage.
- `backend/fixtures/demo-corpus/` is the committed safe demo corpus.
- `dist/` and `backend/dist/` are generated build outputs.
- DB files, WAL files, uploads, build outputs, and local env files are gitignored.

Operational readiness is split into two routes:

- `GET /api/health` confirms the backend process is alive.
- `GET /api/ready` confirms whether the backend is usable for retrieval-backed briefing, including corpus readiness and optional upstream configuration status.

Root-level operator scripts now support:

- `npm run db:init`
- `npm run seed:demo`
- `npm run reindex`
- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run dev:all`
- `npm run test:backend`
- `npm run build:all`
- `npm run validate`

Docker packaging is intentionally pragmatic:

- `backend/Dockerfile` builds and runs the Express backend.
- `Dockerfile.frontend` builds the Vite frontend and serves it with nginx.
- `docker-compose.yml` runs a two-container local stack with a named SQLite/upload volume.

This is not production infrastructure. It is a portable local packaging layer that makes the pilot easier to run, validate, move, and later deploy.

## Phase 4 Checkpoint: Current Implemented State

The project has moved beyond the original frontend-to-webhook shell. The current implemented boundary is:

```
Frontend -> Node/Express API -> SQLite corpus/retrieval layer -> optional temporary n8n upstream
```

The backend now owns the main request lifecycle for the Mayor's Office Policy Intelligence Pilot:

- `POST /api/chat` owns session continuity, message persistence, request logging, retrieval, optional upstream proxying, answer composition, and response normalization.
- `GET /api/health` exposes a simple backend availability check.
- `GET /api/corpus/stats` exposes corpus health and document/chunk counts.
- `GET /api/retrieval/debug?q=...` exposes normalized query terms, FTS query, filters, ranked chunks, and rank reasons for developer/governance debugging.
- `GET /api/documents`, `GET /api/documents/:id`, `PATCH /api/documents/:id`, `POST /api/documents/:id/ingest`, `POST /api/documents/:id/reindex`, `POST /api/documents/reindex`, and `GET /api/documents/:id/chunks` make the local corpus operationally inspectable.

The corpus lifecycle is now explicit and local-first:

- `registered`
- `extracting`
- `extracted`
- `chunking`
- `chunked`
- `indexing`
- `indexed`
- `failed`

The retrieval layer remains intentionally lean: SQLite FTS5, query normalization, approval/sensitivity filtering, basic title/section/approval weighting, duplicate suppression, and per-document result limits. Normal chat and briefing retrieval defaults to approved documents only. Draft-inclusive retrieval is available only through explicit developer/debug filters such as `includeDrafts=true` or an explicit approval-status override. Phase 6 later added a lean local auth and role boundary; embeddings, vector search, PDF/DOCX parsing, enterprise IAM, and full governance workflows remain intentionally deferred.

Frontend-facing document serialization is API-safe: normal document responses do not expose local absolute `file_path` values. The backend still stores internal paths for ingestion/reindex operations, but the frontend receives only governance-relevant metadata such as title, file name, source type, approval status, sensitivity level, lifecycle status, timestamps, and chunk counts.

Answer assembly now lives in `backend/src/services/answerComposerService.ts`. The composer combines retrieved approved chunks, optional upstream output, source metadata, caveats, and claim-safety posture into the frontend `PolicyIntelligenceResponse` contract. If no upstream model is configured, the backend returns an honest retrieval-backed evidence shell rather than pretending to synthesize a full briefing.

Local developer workflow now includes:

- `npm run db:init`
- `npm run ingest -- /path/to/evidence.md "Optional title"`
- `npm run seed:demo`
- `npm run reindex`
- `npm test`
- `npm run typecheck`
- `npm run build`

The sections below preserve the original architecture analysis and migration plan for project history. Where they describe missing backend capability, read that as the starting point before Phases 1-4, not the current implementation state.

## 1. Current Architecture: Honest Assessment

### What exists today

The frontend is a React/Vite single-page app that talks directly to two
external webhooks:

1. **Chat webhook** — sends `{ sessionId, action, chatInput, prompt, mode }`
   and expects a structured `PolicyIntelligenceResponse` back.
2. **Upload webhook** — sends `FormData` with a file and session metadata.

There is no backend in this repository. The entire intelligence layer is
assumed to live inside whatever n8n (or similar) workflow sits behind those
webhooks.

### What is actually missing

| Concern | Status |
|---|---|
| API layer with a stable contract | **Missing.** Frontend talks to opaque webhooks. |
| Document registry / corpus metadata | **Missing.** LeftPanel hardcodes 5 strings. |
| Document ingestion pipeline | **Missing.** Upload hits a webhook; no processing. |
| Chunking / indexing | **Missing.** No text splitting, no embeddings. |
| Retrieval layer | **Missing.** No vector store, no search. |
| Answer generation with structured contract | **Missing.** Frontend defensively normalises whatever comes back. |
| Source citation binding | **Missing.** `sources[]` in the response is not tied to actual chunks. |
| Claim safety / caveat generation | **Missing.** Frontend displays these fields; nobody generates them. |
| Sensitivity / approval boundary | **Missing.** "Curated" is a label, not a mechanism. |
| Server-side session continuity | **Missing.** SessionId lives only in `sessionStorage`. |
| Request logging / audit trail | **Missing.** Zero traceability. |
| Authentication | **Missing.** Anyone with the URL can query. |

### Dead code

- `services/geminiService.ts` — thin wrapper around `policyIntelligenceService`,
  not imported anywhere meaningful. Should be deleted once the backend owns
  answer generation.
- `components/Sidebar.tsx` — not imported in `App.tsx`. Leftover from an
  earlier layout. Can be removed.

### Summary

The frontend is well-shaped. The response contract (`PolicyIntelligenceResponse`
in `types.ts`) is a reasonable target. But behind that contract there is
**nothing** — no data layer, no retrieval layer, no generation layer, no
logging, no session state. The project is a UI shell pointing at a black box.

---

## 2. Target Backend Architecture

### Design principles

1. **One backend service** — not microservices. A solo-builder project.
2. **SQLite for metadata** — zero infra, portable, sufficient for a pilot
   corpus of hundreds of documents.
3. **Node.js (Express)** — same language as the frontend, one toolchain.
4. **n8n stays as a workflow orchestrator** — not as the primary API or
   retrieval layer.
5. **The backend owns the response contract** — the frontend never normalises
   webhook output again.
6. **Every request is logged** — this is a Mayor's Office tool, not a toy.

### Component map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Vite)                      │
│  App.tsx · ChatMessage · LeftPanel · RightPanel                    │
│  Sends: POST /api/chat  ·  POST /api/documents/upload              │
│         GET /api/documents  ·  GET /api/sessions/:id/history       │
└────────────────────────────┬────────────────────────────────────────┘
                             │  HTTP (JSON / multipart)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API SERVER  (Node.js + Express)               │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │  /api/chat    │  │ /api/docs    │  │  /api/sessions            │ │
│  │  route handler│  │ route handler│  │  route handler            │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────────┘ │
│         │                 │                       │                 │
│         ▼                 ▼                       ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    MIDDLEWARE LAYER                          │   │
│  │  requestLogger · apiKeyAuth · errorHandler                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   CORE SERVICES                              │   │
│  │                                                              │   │
│  │  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐ │   │
│  │  │ SessionManager │  │ DocumentRegistry│  │ RequestLog   │ │   │
│  │  │ (SQLite)       │  │ (SQLite)        │  │ (SQLite)     │ │   │
│  │  └────────────────┘  └────────┬────────┘  └──────────────┘ │   │
│  │                               │                             │   │
│  └───────────────────────────────┼─────────────────────────────┘   │
│                                  │                                  │
│  ┌───────────────────────────────▼─────────────────────────────┐   │
│  │                 INGESTION PIPELINE                           │   │
│  │                                                              │   │
│  │  upload → extract text → chunk → metadata → store           │   │
│  │                                                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │   │
│  │  │TextExtract│→│ Chunker  │→│ Metadata │→│ ChunkStore │ │   │
│  │  │(pdf/docx) │  │          │  │ Extractor│  │ (SQLite)   │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   RETRIEVAL LAYER                             │   │
│  │                                                              │   │
│  │  query → embed → search chunks → rank → return sources[]    │   │
│  │                                                              │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │   │
│  │  │ Embedding │→│ ChunkSearch  │→│ SourceRanker            │ │   │
│  │  │ (Gemini)  │  │ (SQLite FTS  │  │ (filters by approval,  │ │   │
│  │  │           │  │  or vector)  │  │  sensitivity, mode)    │ │   │
│  │  └──────────┘  └──────────────┘  └────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 ANSWER GENERATION LAYER                       │   │
│  │                                                              │   │
│  │  retrieved chunks + query + mode → LLM → structured response │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
│  │  │ PromptBuilder │→│ LLM (Gemini) │→│ ResponseBuilder  │  │   │
│  │  │ (per mode)    │  │              │  │ (claim safety,   │  │   │
│  │  │               │  │              │  │  caveats, sources)│  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    n8n (OPTIONAL)                              │   │
│  │  External workflow triggers, notifications, scheduled tasks   │   │
│  │  NOT in the critical request path                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SQLite DATABASE                             │
│                                                                     │
│  Tables:                                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────────┐ │
│  │ documents     │ │ chunks       │ │ sessions                    │ │
│  │ id            │ │ id           │ │ id                          │ │
│  │ title         │ │ document_id  │ │ created_at                  │ │
│  │ type          │ │ content      │ │ last_active                 │ │
│  │ file_path     │ │ page         │ └─────────────────────────────┘ │
│  │ sensitivity   │ │ section      │                                 │
│  │ approval      │ │ embedding    │ ┌─────────────────────────────┐ │
│  │ source_url    │ │ created_at   │ │ messages                    │ │
│  │ uploaded_by   │ └──────────────┘ │ id                          │ │
│  │ chunk_count   │                  │ session_id                  │ │
│  │ ingested_at   │                  │ role                        │ │
│  │ created_at    │                  │ text                        │ │
│  └──────────────┘                   │ mode                        │ │
│                                     │ sources_json                │ │
│  ┌─────────────────────────────┐    │ claim_safety                │ │
│  │ request_log                 │    │ created_at                  │ │
│  │ id                          │    └─────────────────────────────┘ │
│  │ session_id                  │                                    │
│  │ mode                        │                                    │
│  │ query                       │                                    │
│  │ response_json               │                                    │
│  │ sources_json                │                                    │
│  │ claim_safety                │                                    │
│  │ latency_ms                  │                                    │
│  │ created_at                  │                                    │
│  └─────────────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. n8n Boundary: What Stays, What Moves

### Stays in n8n (optional, not in critical path)

- **Webhook triggers** for external document ingestion (e.g. email
  attachments arriving, shared drive updates).
- **Scheduled corpus refresh** — periodic re-check of published FCC
  documents or C40 materials.
- **Notification dispatch** — email/Slack alerts when a new document is
  ingested or a claim check flags a risk.
- **Multi-step workflow orchestration** that doesn't belong in the API
  server (e.g. a document arriving by email → extract → ingest → notify).

### Moves out of n8n (into the backend)

| Concern | Current (n8n webhook) | Target (backend) |
|---|---|---|
| Chat request handling | Opaque webhook | `POST /api/chat` route |
| LLM call + prompt | Inside n8n workflow | `AnswerGenerationService` |
| Response shaping | n8n returns whatever | `ResponseBuilder` enforces contract |
| Document upload | Opaque webhook | `POST /api/documents/upload` route |
| Text extraction | n8n or missing | `TextExtractor` service |
| Chunking | n8n or missing | `Chunker` service |
| Retrieval / search | n8n or missing | `RetrievalService` |
| Session state | Client-side only | `SessionManager` (SQLite) |
| Request logging | None | `RequestLogger` (SQLite) |

### Principle

n8n is a **workflow glue**, not a backend. It should trigger things and
connect services, not own the intelligence pipeline. The backend owns the
request lifecycle end-to-end.

---

## 4. Migration Plan

### Phase 0 — Current State

```
Frontend ──POST──▸ n8n webhook ──▸ ??? ──▸ response (unpredictable shape)
```

- No backend, no DB, no retrieval, no logging.
- Frontend does defensive normalisation (`normalizeResponse`).
- "Evidence corpus" is 5 hardcoded strings in `LeftPanel.tsx`.

### Phase 1 — Near-Term Target (the API skeleton)

**Goal:** A real backend that owns the request lifecycle, stores documents,
and can proxy or replace the n8n chat webhook.

```
Frontend ──POST /api/chat──▸ Express server
                                ├── requestLogger (writes to SQLite)
                                ├── sessionManager (loads/saves session)
                                ├── retrievalService (searches chunks)
                                ├── answerGeneration (calls Gemini)
                                └── responseBuilder (enforces contract)
                                     │
                                     ▼
                              PolicyIntelligenceResponse

Frontend ──POST /api/documents/upload──▸ Express server
                                ├── textExtractor
                                ├── chunker
                                └── documentRegistry (writes to SQLite)
```

**Deliverables:**

1. `backend/` directory with Express server.
2. SQLite database with `documents`, `chunks`, `sessions`, `messages`,
   `request_log` tables.
3. `POST /api/chat` — accepts the same payload the frontend already sends,
   returns a contract-enforced `PolicyIntelligenceResponse`.
4. `POST /api/documents/upload` — accepts file upload and registers
   document metadata. Text extraction and chunking are intentionally later.
5. `GET /api/documents` — returns the document registry (replaces
   hardcoded LeftPanel list).
6. `GET /api/sessions/:id/history` — returns conversation history.
7. Request logging middleware — every `/api/chat` request logged with
   latency, mode, sources, claim safety.
8. Frontend `.env.local` updated to point `VITE_POLICY_API_BASE_URL`
   at `http://localhost:3001/api`.

**What changes in the frontend:** The frontend service layer now calls
the backend API for chat, upload, health, and document registry data. It
does not call n8n or raw workflow webhooks directly.

### Phase 2 — Current Target (backend-owned lifecycle)

**Goal:** Move the system from `frontend -> webhook` to
`frontend -> backend API -> optional temporary n8n proxy`.

**Completed boundary:**

1. `POST /api/chat` owns session creation/update, user/model message
   persistence, request logging, and response contract enforcement.
2. Temporary n8n calls live behind `upstreamPolicyService`; n8n response
   shape does not leak to the frontend.
3. Plain text or inconsistent upstream output is normalized into
   `PolicyIntelligenceResponse` by the backend.
4. `GET /api/documents` returns backend document registry state.
5. `POST /api/documents` registers lean document metadata.
6. `POST /api/documents/upload` keeps file upload as registration only.
7. `GET /api/health` confirms backend availability.
8. The evidence panel reads backend registry data where available while
   preserving the Mayor's Office pilot framing.

### Phase 3 — Current Target (local corpus + lexical retrieval)

**Goal:** Give the backend a real local evidence corpus backbone without
jumping to embeddings or enterprise ingestion.

**Completed / target behavior:**

1. Documents carry durable corpus metadata: source type, file name, file
   path, mime type, ingestion status, approval status, sensitivity level,
   timestamps, and chunk count.
2. Supported local extraction formats are `.md`, `.txt`, `.json`, and
   `.html`.
3. Extracted text is stored in `document_texts`.
4. Text is split into deterministic ordered chunks with optional heading
   hints.
5. Chunks are indexed with SQLite FTS5.
6. `retrievalService` retrieves top matching chunks for a query.
7. `POST /api/chat` retrieves local evidence before optional upstream
   model proxying.
8. If no upstream model is configured, chat returns an honest
   retrieval-backed response shell with chunk snippets and source metadata.

### Phase 4 — Medium-Term Target (semantic retrieval + generation)

**Goal:** Semantic retrieval from the actual document corpus. Claim safety
and caveat generation. Session-aware context.

**Future deliverables:**

1. Embedding pipeline and vector/hybrid search.
2. Prompt templates per mode.
3. Claim safety evaluator.
4. Caveat generator.
5. Strong source citation binding with retrieval evaluation.
6. More formal approval workflow.

### Phase 5 — Future (hardening)

1. **API key authentication** — simple header-based auth for the pilot.
2. **Role-based access** — admin (can upload, approve) vs advisor (can
   query only).
3. **Audit log export** — downloadable CSV/JSON of all requests, sources
   cited, claim safety levels.
4. **Corpus health dashboard** — document count, chunk count, approval
   status distribution, last ingestion time.
5. **Rate limiting** — protect against accidental overload.
6. **n8n integration** — n8n triggers ingestion when new documents appear
   in a watched folder, sends notifications on claim safety alerts.
7. **Multi-model fallback** — if Gemini is down, fall back to a local
   model or return a graceful degradation message.

---

## 5. Recommended First Component to Build

### The API server + document registry

This is the minimum viable backend. It gives you:

- A real HTTP server the frontend can talk to.
- A document registry (replaces hardcoded strings).
- Request logging (the first traceability mechanism).
- Session management (server-side conversation history).
- The API contract the frontend already expects.
- A foundation for retrieval and generation to land on.

### Why this and not retrieval first

Retrieval without a registry is meaningless. You need to know **what
documents exist** before you can search them. The document registry is
the schema that everything else depends on.

### What gets scaffolded

```
backend/
├── package.json
├── tsconfig.json
└── src/
    ├── server.ts          # Express app, middleware, routes
    ├── db.ts              # SQLite setup + schema
    ├── routes/
    │   ├── chat.ts        # POST /api/chat
    │   └── documents.ts   # GET/POST /api/documents
    ├── services/
    │   ├── sessionManager.ts
    │   ├── documentRegistry.ts
    │   └── requestLogger.ts
    └── types.ts           # Shared backend types
```

### What does NOT get built yet

- Embedding / vector search (Phase 3).
- Text extraction from PDF/DOCX (Phase 3).
- Chunking logic (Phase 3).
- Claim safety / caveat generation (Phase 3).
- Authentication (Phase 3).

The chat endpoint initially does a simple passthrough: it logs the
request, loads session history, and either proxies to the existing n8n
webhook or returns a placeholder response. This is intentional — the
backend skeleton must exist before the intelligence layer can land on it.

---

## 6. API Contract

The backend **owns** the response contract. The frontend's
`PolicyIntelligenceResponse` (in `types.ts`) is the source of truth.

### POST /api/chat

**Request:**
```json
{
  "sessionId": "uuid",
  "prompt": "What can we safely say about the climate portfolio?",
  "mode": "briefing"
}
```

**Response (200):**
```json
{
  "answer": "Based on approved Climate Action Plan materials...",
  "mode": "briefing",
  "sources": [
    {
      "title": "Climate Action Plan Portfolio Assessment",
      "type": "PDF",
      "page": 12,
      "section": "Portfolio overview",
      "confidence": "high"
    }
  ],
  "caveats": [
    "This claim should only be used with the cited source attached."
  ],
  "claimSafety": {
    "level": "careful",
    "explanation": "Evidence covers the climate portfolio only, not FCC-wide claims."
  }
}
```

### POST /api/documents/upload

**Request:** `multipart/form-data` with `file` field.

**Response (201):**
```json
{
  "id": "doc-uuid",
  "title": "Climate Action Plan 2024",
  "type": "PDF",
  "status": "registered",
  "chunkCount": 0
}
```

### GET /api/documents

**Response (200):**
```json
[
  {
    "id": "doc-uuid",
    "title": "Climate Action Plan Portfolio Assessment",
    "type": "PDF",
    "sensitivity": "internal",
    "approval": "approved",
    "chunkCount": 47,
    "uploadedAt": "2026-06-04T10:00:00Z"
  }
]
```

### GET /api/sessions/:id/history

**Response (200):**
```json
{
  "sessionId": "uuid",
  "messages": [
    { "role": "user", "text": "...", "mode": "briefing", "timestamp": "..." },
    { "role": "model", "text": "...", "sources": [], "claimSafety": {}, "timestamp": "..." }
  ]
}
```

---

## 7. Database Schema (SQLite)

```sql
-- Document registry
CREATE TABLE documents (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  type          TEXT,
  file_path     TEXT,
  source_url    TEXT,
  sensitivity   TEXT DEFAULT 'internal',
  approval      TEXT DEFAULT 'draft',
  uploaded_by   TEXT,
  chunk_count   INTEGER DEFAULT 0,
  ingested_at   TEXT,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Document chunks
CREATE TABLE chunks (
  id            TEXT PRIMARY KEY,
  document_id   TEXT NOT NULL REFERENCES documents(id),
  content       TEXT NOT NULL,
  page          INTEGER,
  section       TEXT,
  embedding     BLOB,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Session state
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_active   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Conversation history
CREATE TABLE messages (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id),
  role          TEXT NOT NULL,
  text          TEXT NOT NULL,
  mode          TEXT,
  sources_json  TEXT,
  claim_safety  TEXT,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at_ms INTEGER,
  message_order INTEGER DEFAULT 0
);

-- Request audit log
CREATE TABLE request_log (
  id            TEXT PRIMARY KEY,
  session_id    TEXT,
  mode          TEXT,
  query         TEXT,
  response_json TEXT,
  sources_json  TEXT,
  claim_safety  TEXT,
  latency_ms    INTEGER,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at_ms INTEGER
);

-- Full-text search on chunks (scaffold only; retrieval deferred to Phase 3)
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  content, page, section, content=chunks, content_rowid=rowid
);
```

---

## 8. File Structure After Phase 2

```
freetown-urbanai/
├── index.html
├── App.tsx
├── index.tsx
├── types.ts
├── components/
│   ├── ChatMessage.tsx
│   ├── FreetownMap.tsx
│   ├── LeftPanel.tsx          # Fetches registry data from GET /api/documents
│   ├── RightPanel.tsx
│   └── Sidebar.tsx            # Can be deleted (unused)
├── services/
│   ├── policyIntelligenceService.ts
│   └── geminiService.ts       # Compatibility wrapper
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts
│       ├── db.ts
│       ├── routes/
│       │   ├── chat.ts
│       │   └── documents.ts
│       ├── services/
│       │   ├── sessionManager.ts
│       │   ├── documentRegistry.ts
│       │   ├── requestLogger.ts
│       │   └── upstreamPolicyService.ts
│       └── types.ts
├── data/                       # .gitignored
│   └── freetown.db
├── BACKEND_ARCHITECTURE.md
└── README.md
```
