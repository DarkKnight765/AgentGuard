import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { emitApprovalResolved } from '../services/socket';

const router = Router();

// ─── Validation Schema ──────────────────────────────────────────

const decideSchema = z.object({
  decision: z.enum(['approve', 'deny']),
});

// ─── GET /api/approvals — List approvals (filterable by status) ─

router.get('/', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;

  const where: any = {};
  if (status && ['pending', 'approved', 'denied'].includes(status)) {
    where.status = status;
  }

  try {
    const approvals = await prisma.approval.findMany({
      where,
      include: {
        auditLog: {
          include: {
            agent: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(approvals);
  } catch (err) {
    console.error('[Approvals] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/approvals/:id/decide — Approve or deny ──────────

router.post('/:id/decide', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const parsed = decideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { decision } = parsed.data;
  const status = decision === 'approve' ? 'approved' : 'denied';

  try {
    const approval = await prisma.approval.update({
      where: { id },
      data: {
        status,
        reviewedBy: 'admin', // TODO: populate from JWT in Phase 3 auth
        reviewedAt: new Date(),
      },
      include: {
        auditLog: {
          include: {
            agent: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
    });

    // Emit WebSocket event for real-time dashboard updates
    emitApprovalResolved(approval.id, status);

    res.json(approval);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Approval not found' });
      return;
    }
    console.error('[Approvals] Decide error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
