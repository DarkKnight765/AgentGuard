import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/**
 * Middleware that verifies the admin JWT from cookie or Authorization header.
 * Protects admin-facing routes: /api/agents, /api/policies, /api/approvals, /api/audit.
 *
 * Agent gateway (/api/gateway/check) uses agentAuth middleware instead.
 */
export async function adminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.agentguard_token || req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
