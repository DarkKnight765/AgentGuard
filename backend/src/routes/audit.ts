import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';

const router = Router();

// ─── Query Validation ───────────────────────────────────────────

const auditQuerySchema = z.object({
  agentId: z.string().uuid().optional(),
  decision: z.enum(['allow', 'deny', 'needs_approval']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const PAGE_SIZE = 20;

// ─── GET /api/audit — Paginated, filterable audit log ───────────

router.get('/', async (req: Request, res: Response) => {
  const parsed = auditQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { agentId, decision, page } = parsed.data;

  // Build filter conditions
  const where: any = {};
  if (agentId) where.agentId = agentId;
  if (decision) where.decision = decision;

  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          agent: {
            select: { id: true, name: true, role: true },
          },
          approval: {
            select: { id: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data: logs,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (err) {
    console.error('[Audit] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
