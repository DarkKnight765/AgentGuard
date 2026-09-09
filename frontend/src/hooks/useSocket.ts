import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AuditLog, Approval } from '../lib/api';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export interface SocketEvents {
  onAuditNew?: (auditLog: AuditLog) => void;
  onApprovalNew?: (approval: Approval) => void;
  onApprovalResolved?: (data: { approvalId: string; status: string }) => void;
  onAgentStatus?: (data: { agentId: string; status: string }) => void;
}

export function useSocket(events?: SocketEvents) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    if (events?.onAuditNew) s.on('audit:new', events.onAuditNew);
    if (events?.onApprovalNew) s.on('approval:new', events.onApprovalNew);
    if (events?.onApprovalResolved) s.on('approval:resolved', events.onApprovalResolved);
    if (events?.onAgentStatus) s.on('agent:status', events.onAgentStatus);

    if (!s.connected) s.connect();

    return () => {
      if (events?.onAuditNew) s.off('audit:new', events.onAuditNew);
      if (events?.onApprovalNew) s.off('approval:new', events.onApprovalNew);
      if (events?.onApprovalResolved) s.off('approval:resolved', events.onApprovalResolved);
      if (events?.onAgentStatus) s.off('agent:status', events.onAgentStatus);
      s.off('connect');
      s.off('disconnect');
    };
  }, [events?.onAuditNew, events?.onApprovalNew, events?.onApprovalResolved, events?.onAgentStatus]);

  return { connected };
}
