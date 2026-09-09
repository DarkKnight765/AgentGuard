import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalsApi } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { useSocket } from '../hooks/useSocket';

export function Approvals() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('pending');

  const onApprovalNew = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['approvals'] });
  }, [queryClient]);

  const onApprovalResolved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['approvals'] });
  }, [queryClient]);

  useSocket({ onApprovalNew, onApprovalResolved });

  const { data: approvals, isLoading } = useQuery({
    queryKey: ['approvals', filter],
    queryFn: () => approvalsApi.list(filter || undefined),
  });

  const handleDecide = async (id: string, decision: 'approve' | 'deny') => {
    await approvalsApi.decide(id, decision);
    queryClient.invalidateQueries({ queryKey: ['approvals'] });
  };

  const pendingCount = approvals?.filter(a => a.status === 'pending').length || 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <span className="section-label">Security</span>
        <h2 className="text-3xl font-bold text-white tracking-tight mt-1">Approvals</h2>
        <p className="text-white/30 text-sm mt-1">Review and decide on pending agent tool calls</p>
      </div>

      {/* Stat + filter row */}
      <div className="flex items-center justify-between mb-6">
        <div className="filter-tabs">
          {['pending', 'approved', 'denied', ''].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`filter-tab ${filter === s ? 'filter-tab-active' : ''}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {filter === 'pending' && pendingCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="live-dot"></span>
            <span className="text-orange-400 font-medium">{pendingCount} pending</span>
          </div>
        )}
      </div>

      {/* Approvals list */}
      <div className="space-y-3">
        {isLoading && (
          <div className="card text-center py-12 text-white/20">Loading approvals...</div>
        )}
        {!isLoading && approvals?.length === 0 && (
          <div className="card text-center py-16">
            <p className="text-white/20 text-lg mb-2">No {filter || ''} approvals</p>
            <p className="text-white/10 text-sm">Agent tool calls requiring review will appear here</p>
          </div>
        )}
        {approvals?.map(approval => (
          <div key={approval.id} className="card card-hover flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-white font-semibold">{approval.auditLog.agent.name}</span>
                <StatusBadge status={approval.auditLog.agent.role} />
                <span className="text-white/10">→</span>
                <span className="code-inline">{approval.auditLog.tool}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-white/20">
                <span>{new Date(approval.createdAt).toLocaleString()}</span>
                {approval.auditLog.argsSummary !== '{}' && (
                  <span className="truncate max-w-xs">Args: {approval.auditLog.argsSummary}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <StatusBadge status={approval.status} />
              {approval.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecide(approval.id, 'approve')}
                    className="btn-success px-4 py-2 rounded-lg text-xs"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecide(approval.id, 'deny')}
                    className="btn-danger px-4 py-2 rounded-lg text-xs"
                  >
                    Deny
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
