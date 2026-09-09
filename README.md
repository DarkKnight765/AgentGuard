# AgentGuard

AgentGuard intercepts every tool call an AI agent tries to make, checks it against a policy, and lets a human admin see, approve, deny, or instantly kill agent access — in real time.

## Architecture

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

## Quick Start

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Install backend dependencies
cd backend && npm install

# 3. Run database migrations
npx prisma migrate dev

# 4. Seed demo agents
npx prisma db seed

# 5. Start the backend
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. See the file for all required variables.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Cache | Redis 7 (ioredis) |
| Policy Engine | OPA compiled to WASM (in-process) |
| Frontend | React + TypeScript + Tailwind CSS v3 |
| Real-time | Socket.io |
| Auth (admin) | Google OAuth 2.0 + JWT |
| Auth (agents) | Per-agent API key, SHA-256 hashed at rest |
