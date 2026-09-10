# 🛡️ AgentGuard

A high-performance, developer-first gateway designed to govern AI agents in production. AgentGuard intercepts, audits, and applies policy-based access control to any tool calls made by autonomous agents before they reach your internal APIs.

## Architecture

```
 [ AI agents ]                [ Admin (browser) ]
       |                              |
       v                              v
 +---------------------------------------------------+
 |              AgentGuard backend (one service)     |
 |                                                   |
 |  +-----------+   +-----------+   +--------------+ |
 |  |  Gateway  |   |   Redis   |   |   Postgres   | |
 |  | (OPA/WASM |   | (cached   |   | (agents,     | |
 |  |  in-      |<->| policies, |   |  audit log,  | |
 |  |  process) |   |  limits)  |   |  approvals)  | |
 |  +-----------+   +-----------+   +--------------+ |
 +---------------------------------------------------+
                       |
                       v
              [ WebSocket to dashboard ]
```

AgentGuard acts as an in-process proxy layer between your agents and your backend systems:

1. **Gateway (`/api/gateway/check`)**: Agents send their intended tool call and arguments alongside an API key header.
2. **Policy Engine**: An in-process Open Policy Agent (OPA) WebAssembly module evaluates the request in sub-millisecond time (<1ms) against compiled Rego rules.
3. **Approvals**: High-risk actions (e.g., `deploy_production`, `delete_repository`) are quarantined in a pending state. Admins are notified in real-time via WebSocket to approve or deny.
4. **Audit**: Every decision is logged to Postgres with execution latency metrics for full compliance and live dashboard observation.

---

## Architecture & Scoping Decisions

AgentGuard was intentionally designed around a focused, defensible enforcement primitive rather than drifting into a bloated "agent orchestration platform". Key technical trade-offs include:

### 1. In-Process OPA/WASM vs. Separate OPA Server Daemon
- **Zero Network Overhead**: Evaluating Rego rules compiled to WebAssembly in-process takes sub-millisecond execution (<1ms) compared to 5–15ms roundtrip latency over HTTP to a sidecar or remote OPA server.
- **Simplified Operational Footprint**: No separate OPA container to deploy, monitor, health-check, or scale. The single Node.js backend process handles the complete gateway stack.

### 2. Precompiled WASM vs. Runtime Policy Recompilation
- **Zero Production Compiler Footprint**: Policies are compiled ahead-of-time using `policies/build.sh`. The `opa` compiler executable is never required in production docker images, drastically reducing attack surface and container size.
- **Deterministic & Immutable**: Eliminates runtime compilation spikes, temp file I/O locks, memory exhaustion risks, and compilation failure modes on critical path API requests. The dashboard displays a read-only policy specification that reflects the verified compiled artifact.

### 3. Redis: The Kill-Switch Invalidation Layer (Not Just "Speed")
- **Instant Kill Switch**: Suspending an agent via `PATCH /api/agents/:id` updates Postgres and writes through to Redis (`agent:{id}:status`) immediately. The gateway inspects Redis on the agent's very next call and denies access in milliseconds—bypassing both the database and the OPA policy engine entirely.
- **Volatile Counter Management**: High-velocity daily call counters (`agent:{id}:calls:{date}`) live in Redis with a 48h TTL, avoiding write contention and table bloat in Postgres.

### 4. Deliberately Out of Scope
- **No Agent Orchestration / DAG Scheduling**: AgentGuard is an interception gateway and control plane, not a workflow engine (like LangGraph, CrewAI, or Temporal).
- **No Complex Billing/Cost Systems**: Volatile call counters fulfill runtime operational throttling without introducing billing engine complexity.
- **No Agent-to-Agent Permission Chains**: Focus is placed on human-to-agent governance, role isolation, and auditability.

---

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Prisma (Postgres), Redis (`ioredis`)
- **Policy Engine**: Open Policy Agent (`@open-policy-agent/opa-wasm`), precompiled Rego
- **Frontend**: React, Vite, TailwindCSS v3, TanStack React Query, Recharts, Socket.io
- **Auth**: Google OAuth (`google-auth-library`), Dev Session Cookies, Agent API Keys (SHA-256 hashed at rest)

---

## Live Demo Walkthrough

AgentGuard includes an automated 8-step live walkthrough script (`demo/simulate.ts`) that verifies the full gateway lifecycle and explicitly measures kill-switch latency:

```bash
# Run against a running backend
cd backend
npm run demo
```

The script executes and validates:
1. Agent registration and secret key generation
2. Allowed call execution (`read_repository` for `reader`)
3. High-risk quarantined action (`delete_repository` flags `needs_approval`)
4. Human-in-the-loop admin denial
5. Role isolation with a second agent (`deployer`)
6. Human-in-the-loop admin approval (`deploy_production`)
7. Emergency kill switch trigger (admin sets status to `suspended`)
8. Immediate subsequent call blocked in <5ms, proving write-through Redis status enforcement prior to policy evaluation.

---

## Getting Started (Docker Compose)

The easiest way to run AgentGuard is using Docker Compose. This brings up Postgres, Redis, the Node.js backend, and the Nginx-served React frontend.

1. Clone the repository
2. Build and start the stack:
   ```bash
   docker-compose up --build
   ```
3. Open the dashboard at [http://localhost](http://localhost)
4. Click **Sign in (Dev Mode)** to log in as a local administrator.

---

## Local Development

If you prefer to run the services locally without Docker:

### 1. Infrastructure
You need Postgres and Redis running. You can use the provided `docker-compose.yml` just for infrastructure:
```bash
docker-compose up db redis -d
```

### 2. Backend
```bash
cd backend
npm install
npm run dev
```
*Note: The backend will automatically run Prisma migrations on startup if needed.*

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Creating Your First Agent

1. Log into the Dashboard.
2. Navigate to the **Agents** tab and click **+ Register Agent**.
3. Provide a Name, Owner, and select a Role (e.g., `reader` or `deployer`).
4. **Important:** Copy the generated `API_KEY`. It is hashed with SHA-256 in the database and cannot be recovered.

---

## Testing the Gateway via cURL

You can test the gateway's policy engine using `curl`:

**Allowed Request (Reader role calling a read tool):**
```bash
curl -X POST http://localhost:3001/api/gateway/check \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tool": "read_logs"}'
```

**Needs Approval Request (Deployer role calling a deploy tool):**
```bash
curl -X POST http://localhost:3001/api/gateway/check \
  -H "X-API-Key: YOUR_DEPLOYER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tool": "deploy_production"}'
```
*This will return `status: pending`. You can then approve it in the Dashboard.*

---

## Modifying Policies

Policies are written in [Rego](https://www.openpolicyagent.org/docs/latest/policy-language/).

1. Edit `policies/base.rego`.
2. Recompile the policy to WebAssembly (requires the `opa` CLI):
   ```bash
   cd policies
   ./build.sh
   ```
3. Restart the backend to load the new `policy.wasm` file.

*Note: OPA is only required at build time. The production backend relies solely on the precompiled `.wasm` artifact.*
