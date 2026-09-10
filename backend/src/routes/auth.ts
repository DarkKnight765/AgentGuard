import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const router = Router();

const JWT_SECRET = (process.env.JWT_SECRET || 'dev-secret-change-me').trim();
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ─── POST /api/auth/google/callback — Google OAuth login ────────
// Receives the Google ID token from the frontend, verifies it,
// and issues a JWT session cookie.

router.post('/google/callback', async (req: Request, res: Response) => {
  const { credential } = req.body;

  if (!credential) {
    res.status(400).json({ error: 'Missing credential' });
    return;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }

    const { sub, email, name, picture } = payload;

    // Issue JWT
    const token = jwt.sign(
      { sub, email, name, picture },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set httpOnly cookie (sameSite: 'none' required for cross-domain on Render)
    res.cookie('agentguard_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({ user: { email, name, picture }, token });
  } catch (err) {
    console.error('[Auth] Google callback error:', err);
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

// ─── POST /api/auth/dev-login — Dev-only login bypass ───────────
// Skips Google OAuth for local development.

router.post('/dev-login', async (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Dev login disabled in production' });
    return;
  }

  const token = jwt.sign(
    { sub: 'dev-user', email: 'dev@agentguard.local', name: 'Dev Admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.cookie('agentguard_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({ user: { email: 'dev@agentguard.local', name: 'Dev Admin' }, token });
});

// ─── GET /api/auth/me — Get current user from JWT ───────────────

router.get('/me', (req: Request, res: Response) => {
  const token = req.cookies?.agentguard_token || req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ user: payload });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ─── POST /api/auth/logout ──────────────────────────────────────

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('agentguard_token');
  res.json({ message: 'Logged out' });
});

export default router;
