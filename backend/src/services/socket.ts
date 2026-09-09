import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { AuditLog, Approval } from '@prisma/client';

let io: Server | null = null;

/**
 * Initialize Socket.io server attached to the given HTTP server.
 */
export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
