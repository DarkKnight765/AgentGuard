# 🛡️ AgentGuard

A high-performance, developer-first gateway designed to govern AI agents in production. AgentGuard intercepts, audits, and applies policy-based access control to any tool calls made by autonomous agents before they reach your internal APIs.

## Architecture

AgentGuard acts as a proxy layer between your agents and your backend systems.

1. **Gateway (`/api/gateway/check`)**: Agents send their intended tool call and arguments here.
2. **Policy Engine**: A sub-millisecond Open Policy Agent (OPA) WebAssembly module evaluates the request against your organization's rules.
3. **Approvals**: High-risk actions (e.g., `deploy_production`) are held in a pending state. Admins are notified in real-time via the Dashboard to approve or deny.
4. **Audit**: Every decision is logged asynchronously to Postgres for compliance.

### Tech Stack
- **Backend**: Node.js, Express, TypeScript, Prisma (Postgres), Redis (Caching)
- **Policy**: Open Policy Agent (Rego compiled to WASM)
- **Frontend**: React, Vite, TailwindCSS v3, React Query, Recharts, Socket.io
- **Auth**: Google OAuth (`google-auth-library`), JWT

## Getting Started (Docker Compose)

The easiest way to run AgentGuard is using Docker Compose. This brings up Postgres, Redis, the Node.js backend, and the Nginx-served React frontend.

1. Clone the repository
2. Build and start the stack:
   ```bash
   docker-compose up --build
   ```
3. Open the dashboard at [http://localhost](http://localhost)
4. Click **Sign in (Dev Mode)** to log in as a local administrator.

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

## Creating Your First Agent

1. Log into the Dashboard.
2. Navigate to the **Agents** tab and click **+ Register Agent**.
3. Provide a Name, Owner, and select a Role (e.g., `reader` or `deployer`).
4. **Important:** Copy the generated `API_KEY`. It is hashed with SHA-256 in the database and cannot be recovered.

## Testing the Gateway

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
