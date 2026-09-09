import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// ─── GET /api/policies/:agentId — Fetch current Rego source ────
// Read-only for the MVP. The actual enforcement comes from the
// precompiled policy.wasm, not from this stored source.

router.get('/:agentId', async (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;

  try {
    const policy = await prisma.policy.findFirst({
      where: { agentId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        regoSource: true,
        version: true,
        updatedAt: true,
      },
    });

    if (!policy) {
      res.status(404).json({ error: 'No policy found for this agent' });
      return;
    }

    res.json(policy);
  } catch (err) {
    console.error('[Policies] Fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
