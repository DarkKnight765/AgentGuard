import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalsApi } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { useSocket } from '../hooks/useSocket';

export function Approvals() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('pending');

  // Live updates
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

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Approvals</h2>
        <p className="text-slate-400 text-sm mt-1">Review and decide on pending agent tool calls</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-surface-900 p-1 rounded-lg border border-slate-700/50 w-fit">
        {['pending', 'approved', 'denied', ''].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === s
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Approvals list */}
      <div className="space-y-3">
        {isLoading && <p className="text-slate-400">Loading...</p>}
        {approvals?.length === 0 && (
          <div className="card text-center text-slate-400 py-12">
            No {filter || ''} approvals
          </div>
        )}
        {approvals?.map(approval => (
          <div key={approval.id} className="card flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-white font-medium">{approval.auditLog.agent.name}</span>
                <StatusBadge status={approval.auditLog.agent.role} />
                <span className="text-slate-500">→</span>
                <code className="text-blue-400 text-sm bg-blue-500/10 px-2 py-0.5 rounded">
                  {approval.auditLog.tool}
                </code>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>{new Date(approval.createdAt).toLocaleString()}</span>
                {approval.auditLog.argsSummary !== '{}' && (
                  <span className="truncate max-w-xs">Args: {approval.auditLog.argsSummary}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge status={approval.status} />
              {approval.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecide(approval.id, 'approve')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecide(approval.id, 'deny')}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-colors"
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
