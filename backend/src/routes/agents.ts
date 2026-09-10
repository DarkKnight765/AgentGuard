import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { setAgentStatus, invalidateAgent } from '../services/redisCache';
import { emitAgentStatus } from '../services/socket';

const router = Router();

// ─── Validation Schemas ─────────────────────────────────────────

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  owner: z.string().min(1).max(100),
  role: z.enum(['reader', 'deployer']),
});

const updateAgentSchema = z.object({
  role: z.enum(['reader', 'deployer']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

// ─── GET /api/agents — List all agents ──────────────────────────

router.get('/', async (_req: Request, res: Response) => {
  try {
    const agents = await prisma.agent.findMany({
      select: {
        id: true,
        name: true,
        owner: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(agents);
  } catch (err) {
    console.error('[Agents] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/agents/:id — Get a single agent ───────────────────

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  try {
    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        owner: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    res.json(agent);
  } catch (err) {
    console.error('[Agents] Get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/agents — Register a new agent ───────────────────
// Returns the plaintext API key ONCE. Only the SHA-256 hash is stored.

router.post('/', async (req: Request, res: Response) => {
  const parsed = createAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { name, owner, role } = parsed.data;

  // Generate a high-entropy API key
  const apiKey = crypto.randomBytes(32).toString('hex');

  // SHA-256 hash for storage — deterministic, enables O(1) indexed lookup
  const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  try {
    const agent = await prisma.agent.create({
      data: { name, owner, role, apiKeyHash },
      select: {
        id: true,
        name: true,
        owner: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // Return the plaintext key once — it cannot be recovered after this
    res.status(201).json({ ...agent, apiKey });
  } catch (err) {
    console.error('[Agents] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/agents/:id — Update role/status ────────────────
// This is the kill switch entry point: setting status to "suspended"
// writes through to Redis immediately so the gateway sees it on the
// agent's very next call (spec §6).

router.patch('/:id', async (req: Request, res: Response) => {
  const parsed = updateAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const id = req.params.id as string;
  const data = parsed.data;

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  try {
    const agent = await prisma.agent.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        owner: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // Kill switch: if status changed, write through to Redis immediately
    if (data.status) {
      await setAgentStatus(id, data.status);
      emitAgentStatus(id, data.status);
    }

    res.json(agent);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    console.error('[Agents] Update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/agents/:id — Remove an agent ──────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  try {
    await prisma.agent.delete({ where: { id } });

    // Clean up all Redis keys for this agent
    await invalidateAgent(id);

    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    console.error('[Agents] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
