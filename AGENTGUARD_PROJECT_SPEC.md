# AgentGuard — Project Specification

## 0. What this document is

This is the complete build spec for **AgentGuard**, a permission gateway and admin control surface for AI agents. Hand this whole file to an AI coding assistant as the starting context for the project. It defines scope, architecture, schema, API contract, and file layout precisely so the build doesn't drift into a larger system than intended.

## 1. One-sentence pitch

AgentGuard intercepts every tool call an AI agent tries to make, checks it against a policy, and lets a human admin see, approve, deny, or instantly kill agent access — in real time.

## 2. Problem this demonstrates (context, not a build requirement)

AI agents are increasingly given tool access (GitHub, databases, cloud APIs) with little runtime enforcement or human oversight. Most teams have no way to see what an agent tried to do, no way to require approval for risky actions, and — critically — no reliable way to shut an agent down mid-operation if it misbehaves. AgentGuard is a small, complete demonstration of the enforcement primitive that larger "agent governance platforms" are built around: identity, policy evaluation, audit, and a working kill switch.

## 3. Explicit scope — read this before building anything

**In scope (build all of this):**
- Agent registry (CRUD, roles, status, API keys)
- Permission gateway that evaluates every simulated tool call
- Policy evaluation via OPA (compiled to WASM, runs in-process — not a separate service)
- Redis cache for active policies and simple per-agent rate/call counters
- Postgres for agents, policies, audit log, approvals
- Approval workflow (pending queue, admin approve/deny)
- Kill switch (suspend an agent; takes effect on its very next call)
- Admin dashboard: agent list, policy editor, approvals queue, live audit feed
- A demo script that plays a scripted sequence of agent calls for a live walkthrough

**Explicitly out of scope — do not build these, do not suggest adding them:**
- A task scheduler or DAG-based multi-step task orchestration
- A budget/cost-tracking system beyond a simple call counter
- Agent-to-agent delegation graphs or agent-to-agent permission chains
- Any language other than TypeScript for application code (no Go, no C++, no Python services)
- Multi-tenant / multi-org support
- Horizontal scaling, load balancing, or high-availability concerns
- A real LLM agent framework integration (LangGraph, CrewAI, etc.) — the demo script simulates agent calls directly against the gateway API instead

If a request during implementation would add any of the above, flag it rather than building it — scope creep is the primary risk on this project, not missing features.

## 4. Architecture

Three logical pieces, all inside **one Node.js/TypeScript backend process**:

```
 [ AI agents ]                [ Admin (browser) ]
       |                              |
       v                              v
 +---------------------------------------------------+
 |              AgentGuard backend (one service)       |
 |                                                     |
 |  +-----------+   +-----------+   +--------------+  |
 |  |  Gateway  |   |   Redis   |   |   Postgres   |  |
 |  | (OPA/WASM |   | (cached   |   | (agents,     |  |
 |  |  in-      |<->| policies, |   |  audit log,  |  |
 |  |  process) |   |  limits)  |   |  approvals)  |  |
 |  +-----------+   +-----------+   +--------------+  |
 +---------------------------------------------------+
                       |
                       v
              [ WebSocket to dashboard ]
```

- OPA policies are compiled ahead of time (`opa build`) to a `.wasm` bundle and evaluated in-process via `@open-policy-agent/opa-wasm`. There is no separate OPA server/container.
- Redis holds each agent's currently active compiled policy reference plus fast-moving counters (calls today, etc). It is a cache in front of Postgres, not the source of truth.
- Postgres is the source of truth for everything durable.
- The dashboard receives live updates over a WebSocket (new audit entries, new pending approvals, resolved approvals).

## 5. Request lifecycle

1. Agent calls `POST /api/gateway/check` with its API key, the tool name, and arguments.
2. Gateway checks the agent's status in Redis. If suspended → deny immediately, log it, return.
3. Gateway loads the agent's compiled policy from Redis (cache miss → load from Postgres, populate Redis).
4. OPA evaluates `{agent, tool, args}` against the policy in-process → `allow` / `deny` / `needs_approval`.
5. Write a row to `audit_log` regardless of outcome.
6. `allow` / `deny` → return the decision to the caller immediately.
7. `needs_approval` → create a row in `approvals` (status `pending`), emit a `approval:new` WebSocket event, return `pending` with an approval id to the caller.
8. Admin approves/denies via `POST /api/approvals/:id/decide` → updates the row, emits `approval:resolved`.

## 6. Kill switch flow

1. Admin clicks "Suspend" on an agent in the dashboard → `PATCH /api/agents/:id` with `status: suspended`.
2. Backend writes the new status to Postgres, then immediately deletes/overwrites that agent's Redis entry.
3. The agent's very next call to `/api/gateway/check` reads the suspended status before it ever reaches OPA and is denied.
4. This is the flow to demo live: run the demo script, suspend the agent mid-run from the dashboard, show the next call being denied within milliseconds.

## 7. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + TypeScript + Tailwind CSS | Plain React (not Next.js) — no SSR needed for an internal admin tool |
| Frontend data | `@tanstack/react-query`, `socket.io-client`, `recharts` | Fetching, live feed, summary charts |
| Backend | Node.js + Express + TypeScript | |
| ORM | Prisma | |
| Database | PostgreSQL | |
| Cache | Redis (`ioredis` client) | |
| Policy engine | Open Policy Agent, compiled to WASM (`@open-policy-agent/opa-wasm`) | Policies written in Rego, versioned in `/policies` |
| Real-time | Socket.io | |
| Auth (admin) | Google OAuth 2.0 + JWT session | |
| Auth (agents) | Per-agent API key, hashed at rest | |
| Deployment | Docker Compose (local) → Render (hosted) | Postgres + Redis + backend + frontend as separate services |

## 8. Repository layout

```
agentguard/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── AgentsList.tsx
│   │   │   ├── AgentDetail.tsx        # policy editor, suspend toggle
│   │   │   ├── Approvals.tsx
│   │   │   └── ActivityFeed.tsx
│   │   ├── components/
│   │   ├── hooks/useSocket.ts
│   │   └── lib/api.ts
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── agents.ts
│   │   │   ├── policies.ts
│   │   │   ├── gateway.ts              # the core interception endpoint
│   │   │   ├── approvals.ts
│   │   │   └── audit.ts
│   │   ├── services/
│   │   │   ├── policyEngine.ts         # loads/evaluates compiled OPA wasm
│   │   │   ├── redisCache.ts
│   │   │   └── socket.ts
│   │   ├── prisma/schema.prisma
│   │   └── index.ts
│   └── package.json
├── policies/
│   ├── base.rego
│   └── build.sh                        # compiles .rego -> .wasm
├── demo/
│   └── simulate.ts                     # scripted agent call sequence for live demo
├── docker-compose.yml
└── README.md
```

## 9. Database schema (Prisma)

```prisma
model Agent {
  id          String   @id @default(uuid())
  name        String
  owner       String
  role        String   // e.g. "reader", "deployer"
  status      String   @default("active") // active | suspended
  apiKeyHash  String
  createdAt   DateTime @default(now())
  policies    Policy[]
  auditLogs   AuditLog[]
}

model Policy {
  id          String   @id @default(uuid())
  agentId     String
  agent       Agent    @relation(fields: [agentId], references: [id])
  regoSource  String
  version     Int      @default(1)
  updatedAt   DateTime @updatedAt
}

model AuditLog {
  id           String   @id @default(uuid())
  agentId      String
  agent        Agent    @relation(fields: [agentId], references: [id])
  tool         String
  argsSummary  String
  decision     String   // allow | deny | needs_approval
  latencyMs    Int
  createdAt    DateTime @default(now())
  approval     Approval?
}

model Approval {
  id           String   @id @default(uuid())
  auditLogId   String   @unique
  auditLog     AuditLog @relation(fields: [auditLogId], references: [id])
  status       String   @default("pending") // pending | approved | denied
  reviewedBy   String?
  reviewedAt   DateTime?
  createdAt    DateTime @default(now())
}
```

## 10. Redis key design

```
agent:{id}:status        -> "active" | "suspended"          (TTL: none, invalidated on change)
agent:{id}:policy        -> compiled policy reference/id     (TTL: none, invalidated on policy update)
agent:{id}:calls:{date}  -> integer counter, incremented per call (TTL: 48h)
```

## 11. Example policy (`policies/base.rego`)

```rego
package agentguard

default allow = false
default needs_approval = false

# Readers can call anything prefixed "read" or "get"
allow {
  input.role == "reader"
  startswith(input.tool, "read")
}

allow {
  input.role == "reader"
  startswith(input.tool, "get")
}

# Deployers can read freely, but risky actions need approval
allow {
  input.role == "deployer"
  startswith(input.tool, "read")
}

needs_approval {
  input.role == "deployer"
  input.tool == "deploy_production"
}

needs_approval {
  input.tool == "delete_repository"
}

# Everything not explicitly allowed or flagged for approval is denied by default.
```

## 12. API endpoints

```
POST   /api/auth/google/callback        - admin login via Google OAuth
GET    /api/agents                      - list all agents
POST   /api/agents                      - register a new agent (returns plaintext API key once)
PATCH  /api/agents/:id                  - update role/status (used for suspend/activate)
DELETE /api/agents/:id                  - remove an agent

GET    /api/policies/:agentId           - fetch current rego source
PUT    /api/policies/:agentId           - update rego source, recompile to wasm, bump version, invalidate cache

POST   /api/gateway/check               - core interception endpoint (agent auth via API key header)

GET    /api/approvals?status=pending    - list approvals
POST   /api/approvals/:id/decide        - { decision: "approve" | "deny" }

GET    /api/audit?agentId=&decision=&page=  - paginated, filterable audit log
```

## 13. WebSocket events (server → dashboard)

```
audit:new         - payload: the new AuditLog row
approval:new      - payload: the new Approval row (+ related audit entry)
approval:resolved - payload: { approvalId, status }
agent:status      - payload: { agentId, status }   (drives live "suspended" UI state)
```

## 14. Environment variables

```
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
PORT=3001
FRONTEND_URL=
```

## 15. Demo script (`demo/simulate.ts`)

Should run a fixed sequence against a locally running backend, printing each step's outcome:

1. Register (or use a seeded) `ResearchAgent` with role `reader`.
2. Call `read_repository` → expect `allow`.
3. Call `delete_repository` → expect `needs_approval`; print the approval id.
4. Call `POST /api/approvals/:id/decide` with `deny` → show the call was blocked.
5. Register/seed `DeploymentAgent` with role `deployer`.
6. Call `deploy_production` → expect `needs_approval`; this time approve it.
7. Suspend `ResearchAgent` via the agents endpoint.
8. Immediately call `read_repository` again as `ResearchAgent` → expect `deny`, to demonstrate the kill switch taking effect on the very next call.

## 16. Build order

1. **Week 1** — Postgres schema, Agent CRUD API, hardcoded role-check gateway (no OPA yet), seed script.
2. **Week 2** — Integrate OPA/WASM policy evaluation, add Redis caching for status + policy, wire up the kill-switch invalidation.
3. **Week 3** — Approval workflow (API + WebSocket events), dashboard: agents list, agent detail/policy editor, approvals queue.
4. **Week 4** — Live audit feed UI, demo script, README documenting the scoping decisions (why OPA-WASM over a separate OPA server, why Redis, why this was scoped down from a full "agent platform").

## 17. Definition of done for the MVP

- All 8 demo script steps run correctly against the deployed app.
- Suspending an agent from the dashboard blocks its next call in under ~1 second, visibly, on camera.
- The audit feed updates in real time without a page refresh while the demo script runs.
- The README explains the OPA-WASM choice, the Redis cache's actual purpose (not just "for speed"), and explicitly states what was left out of scope and why.
