import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { AuditLog, Approval } from '@prisma/client';

let io: Server | null = null;

/**
 * Initialize Socket.io server attached to the given HTTP server.
 */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost',
].filter(Boolean) as string[];

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(o => origin === o || origin.startsWith(o))) {
          return callback(null, true);
        }
        try {
          if (/\.onrender\.com$/.test(new URL(origin).hostname)) {
            return callback(null, true);
          }
        } catch {
          // ignore
        }
        callback(null, false);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[Socket] Server initialized');
  return io;
}

/**
 * Get the Socket.io server instance.
 */
export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized — call initSocketServer first');
  return io;
}

// ─── Event Emission Helpers ─────────────────────────────────────
// These match the WebSocket events from spec §13:
//   audit:new, approval:new, approval:resolved, agent:status

export function emitAuditNew(auditLog: AuditLog): void {
  if (io) io.emit('audit:new', auditLog);
}

export function emitApprovalNew(approval: Approval & { auditLog?: AuditLog }): void {
  if (io) io.emit('approval:new', approval);
}

export function emitApprovalResolved(approvalId: string, status: string): void {
  if (io) io.emit('approval:resolved', { approvalId, status });
}

export function emitAgentStatus(agentId: string, status: string): void {
  if (io) io.emit('agent:status', { agentId, status });
}
