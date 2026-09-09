import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { agentAuth } from '../middleware/agentAuth';
import { getAgentStatus, incrementCallCounter } from '../services/redisCache';
import { emitAuditNew, emitApprovalNew } from '../services/socket';
import { evaluatePolicy, toDecision } from '../services/policyEngine';

const router = Router();

// ─── Validation Schema ──────────────────────────────────────────

const gatewayCheckSchema = z.object({
  tool: z.string().min(1).max(200),
  args: z.record(z.any()).optional().default({}),
});

// ─── POST /api/gateway/check — Core interception endpoint ──────
//
// Request lifecycle (spec §5):
//   1. Agent auth via X-API-Key header
//   2. Check agent status in Redis — if suspended, deny immediately
//   3. Evaluate policy via OPA/WASM in-process
//   4. Write AuditLog row regardless of outcome
//   5. allow/deny → return immediately
//   6. needs_approval → create Approval row, emit WebSocket event, return pending

router.post('/check', agentAuth, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const agent = req.agent!;

  const parsed = gatewayCheckSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { tool, args } = parsed.data;
  const argsSummary = JSON.stringify(args).substring(0, 500);

  try {
    // Step 1: Check agent status in Redis (kill switch check)
    // This runs BEFORE policy evaluation — a suspended agent is denied
    // within milliseconds regardless of what the policy says.
    const status = await getAgentStatus(agent.id);
    if (status === 'suspended') {
      const latencyMs = Date.now() - startTime;
      const auditLog = await prisma.auditLog.create({
        data: {
          agentId: agent.id,
          tool,
          argsSummary,
          decision: 'deny',
          latencyMs,
        },
      });
      emitAuditNew(auditLog);
      await incrementCallCounter(agent.id);

      res.json({
        decision: 'deny',
        reason: 'Agent is suspended',
        latencyMs,
      });
      return;
    }

    // Step 2: Evaluate policy via OPA/WASM (in-process, sub-millisecond)
    const policyResult = evaluatePolicy({
      role: agent.role,
      tool,
      args,
    });
    const decision = toDecision(policyResult);

    const latencyMs = Date.now() - startTime;

    // Step 3: Write audit log (every call, regardless of outcome)
    const auditLog = await prisma.auditLog.create({
      data: {
        agentId: agent.id,
        tool,
        argsSummary,
        decision,
        latencyMs,
      },
    });
    emitAuditNew(auditLog);
    await incrementCallCounter(agent.id);

    // Step 4: Handle decision
    if (decision === 'needs_approval') {
      const approval = await prisma.approval.create({
        data: {
          auditLogId: auditLog.id,
        },
        include: {
          auditLog: true,
        },
      });
      emitApprovalNew(approval);

      res.json({
        decision: 'needs_approval',
        approvalId: approval.id,
        latencyMs,
      });
      return;
    }

    res.json({
      decision,
      latencyMs,
    });
  } catch (err) {
    console.error('[Gateway] Check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
