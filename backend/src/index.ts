import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import http from 'http';
import { initSocketServer } from './services/socket';
import { initPolicyEngine } from './services/policyEngine';
import redis from './lib/redis';
import prisma from './lib/prisma';

// Route imports
import agentsRouter from './routes/agents';
import gatewayRouter from './routes/gateway';
import auditRouter from './routes/audit';
import policiesRouter from './routes/policies';
import approvalsRouter from './routes/approvals';
import authRouter from './routes/auth';

const app = express();
const server = http.createServer(app);

// ─── Middleware ──────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ─── Routes ─────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/gateway', gatewayRouter);
app.use('/api/audit', auditRouter);
app.use('/api/policies', policiesRouter);
app.use('/api/approvals', approvalsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Socket.io ──────────────────────────────────────────────────

initSocketServer(server);

// ─── Start Server ───────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3001', 10);

async function start() {
  try {
    // Connect Redis
    await redis.connect();
    console.log('[Server] Redis connected');

    // Verify Postgres connection
    await prisma.$connect();
    console.log('[Server] Postgres connected');

    // Load precompiled OPA/WASM policy
    await initPolicyEngine();
    console.log('[Server] Policy engine ready');

    server.listen(PORT, () => {
      console.log(`[Server] AgentGuard backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ──────────────────────────────────────────

async function shutdown() {
  console.log('\n[Server] Shutting down...');
  server.close();
  await redis.quit();
  await prisma.$disconnect();
  console.log('[Server] Cleanup complete');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
