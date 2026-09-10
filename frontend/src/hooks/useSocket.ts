import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AuditLog, Approval } from '../lib/api';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    // In production, connect to VITE_API_URL. In local dev, connect to port 3001 or current host.
    const rawUrl = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:3001' : '/');
    const url = rawUrl.replace(/\/+$/, '');
    socket = io(url, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      withCredentials: true,
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
  const [connected, setConnected] = useState(() => (socket ? socket.connected : false));

  useEffect(() => {
    const s = getSocket();

    // Immediately sync current connection state
    setConnected(s.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    if (events?.onAuditNew) s.on('audit:new', events.onAuditNew);
    if (events?.onApprovalNew) s.on('approval:new', events.onApprovalNew);
    if (events?.onApprovalResolved) s.on('approval:resolved', events.onApprovalResolved);
    if (events?.onAgentStatus) s.on('agent:status', events.onAgentStatus);

    if (!s.connected) {
      s.connect();
    }

    return () => {
      if (events?.onAuditNew) s.off('audit:new', events.onAuditNew);
      if (events?.onApprovalNew) s.off('approval:new', events.onApprovalNew);
      if (events?.onApprovalResolved) s.off('approval:resolved', events.onApprovalResolved);
      if (events?.onAgentStatus) s.off('agent:status', events.onAgentStatus);
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, [events?.onAuditNew, events?.onApprovalNew, events?.onApprovalResolved, events?.onAgentStatus]);

  return { connected };
}
