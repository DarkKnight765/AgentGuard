import redis from '../lib/redis';
import prisma from '../lib/prisma';

/**
 * Redis cache service.
 *
 * Redis key design (from spec §10):
 *   agent:{id}:status        -> "active" | "suspended"     (no TTL, invalidated on change)
 *   agent:{id}:policy        -> policy version/reference    (no TTL, invalidated on policy update)
 *   agent:{id}:calls:{date}  -> integer counter             (TTL: 48h)
 */

// ─── Agent Status ───────────────────────────────────────────────

/**
 * Get agent status from Redis, falling back to Postgres on cache miss.
 */
export async function getAgentStatus(agentId: string): Promise<string> {
  const cached = await redis.get(`agent:${agentId}:status`);
  if (cached) return cached;

  // Cache miss — load from Postgres
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { status: true },
  });

  if (!agent) throw new Error(`Agent ${agentId} not found`);

  // Populate cache
  await redis.set(`agent:${agentId}:status`, agent.status);
  return agent.status;
}

/**
 * Write agent status to both Postgres and Redis (write-through).
 * This is the kill switch mechanism — writing to Redis immediately
 * ensures the gateway sees the new status on the agent's very next call.
 */
export async function setAgentStatus(agentId: string, status: string): Promise<void> {
  await redis.set(`agent:${agentId}:status`, status);
}

/**
 * Invalidate all cached data for an agent (used on agent deletion).
 */
export async function invalidateAgent(agentId: string): Promise<void> {
  const keys = await redis.keys(`agent:${agentId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// ─── Call Counters ──────────────────────────────────────────────

/**
 * Increment the per-day call counter for an agent.
 * Key auto-expires after 48 hours.
 */
export async function incrementCallCounter(agentId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `agent:${agentId}:calls:${today}`;
  const count = await redis.incr(key);

  // Set TTL on first increment only
  if (count === 1) {
    await redis.expire(key, 48 * 60 * 60); // 48 hours
  }

  return count;
}

/**
 * Get the current day's call count for an agent.
 */
export async function getCallCount(agentId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const key = `agent:${agentId}:calls:${today}`;
  const count = await redis.get(key);
  return count ? parseInt(count, 10) : 0;
}

// ─── Policy Cache ───────────────────────────────────────────────

/**
 * Get cached policy version for an agent.
 */
export async function getAgentPolicyVersion(agentId: string): Promise<string | null> {
  return redis.get(`agent:${agentId}:policy`);
}

/**
 * Cache an agent's policy version reference.
 */
export async function setAgentPolicyVersion(agentId: string, version: string): Promise<void> {
  await redis.set(`agent:${agentId}:policy`, version);
}
