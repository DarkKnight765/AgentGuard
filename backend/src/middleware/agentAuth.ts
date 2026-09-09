import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { Agent } from '@prisma/client';

// Extend Express Request to include the authenticated agent
declare global {
  namespace Express {
    interface Request {
      agent?: Agent;
    }
  }
}

/**
 * Middleware that authenticates an agent via X-API-Key header.
 *
 * Uses SHA-256 hashing for O(1) indexed lookup — API keys are high-entropy
 * random tokens, so bcrypt's slow/salted design is unnecessary here.
 * This is the same approach used by Stripe and GitHub for API key auth.
 */
export async function agentAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    res.status(401).json({ error: 'Missing X-API-Key header' });
    return;
  }

  // SHA-256 hash the incoming key for direct DB lookup
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

  try {
    const agent = await prisma.agent.findFirst({
      where: { apiKeyHash: hash },
    });

    if (!agent) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    req.agent = agent;
    next();
  } catch (err) {
    console.error('[AgentAuth] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
