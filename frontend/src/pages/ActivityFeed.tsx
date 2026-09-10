import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auditApi } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { useSocket } from '../hooks/useSocket';

export function ActivityFeed() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterDecision, setFilterDecision] = useState<string>('');

  const onAuditNew = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['audit'] });
  }, [queryClient]);

  useSocket({ onAuditNew });

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, filterDecision],
    queryFn: () =>
      auditApi.list({
        page,
        decision: filterDecision || undefined,
      }),
  });

  const logs = data?.data || [];
  const totalCount = data?.pagination.total || 0;

  const totalAllowed = logs.filter((l) => l.decision === 'allow').length;
  const totalDenied = logs.filter((l) => l.decision === 'deny').length;
  const totalPending = logs.filter((l) => l.decision === 'needs_approval').length;
  const avgLatency = logs.length
    ? Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / logs.length)
    : 0;

  const distribution = [
    {
      name: 'Allowed',
      count: totalAllowed,
      bg: 'bg-emerald-400',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
    },
    {
      name: 'Denied',
      count: totalDenied,
      bg: 'bg-red-400',
      text: 'text-red-400',
      border: 'border-red-500/20',
    },
    {
      name: 'Needs Approval',
      count: totalPending,
      bg: 'bg-amber-400',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
    },
  ];

  const totalInPage = logs.length || 1;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <span className="section-label">Real-Time Observability</span>
        <h2 className="text-3xl font-bold text-white tracking-tight mt-1">
          Activity & Audit Feed
        </h2>
        <p className="text-white/30 text-sm mt-1 flex items-center gap-2">
          Sub-millisecond live audit stream of intercepted tool calls
          <span className="live-dot"></span>
          <span className="text-emerald-400 text-xs font-medium">Live Gateway Stream</span>
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card card-hover">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">
            Total Events
          </p>
          <p className="stat-number text-white">{totalCount}</p>
        </div>
        <div className="card card-hover">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">
            Allowed
          </p>
          <p className="stat-number text-emerald-400">{totalAllowed}</p>
        </div>
        <div className="card card-hover">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">
            Denied
          </p>
          <p className="stat-number text-red-400">{totalDenied}</p>
        </div>
        <div className="card card-hover">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">
            Avg Latency
          </p>
          <p className="stat-number text-orange-400">
            {avgLatency}
            <span className="text-lg font-medium text-white/20">ms</span>
          </p>
        </div>
      </div>

      {/* Decision Distribution Bar Breakdown — strictly proportional & bug-free */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] text-white/30 font-medium uppercase tracking-wider">
            Decision Distribution (Current Window)
          </p>
          <span className="text-xs text-white/30 font-mono">
            {logs.length} evaluated
          </span>
        </div>

        <div className="space-y-3">
          {distribution.map((item) => {
            const pct = Math.round((item.count / totalInPage) * 100);
            return (
              <div key={item.name} className="flex items-center gap-4 text-xs">
                <span className="w-28 text-white/60 font-medium">{item.name}</span>
                <div className="flex-1 h-3 bg-white/[0.04] rounded-full overflow-hidden p-0.5 border border-white/[0.06]">
                  <div
                    className={`h-full ${item.bg} rounded-full transition-all duration-500`}
                    style={{ width: `${item.count > 0 ? Math.max(pct, 4) : 0}%` }}
                  />
                </div>
                <div className="w-24 text-right font-mono flex items-center justify-end gap-1.5">
                  <span className={`font-semibold ${item.text}`}>{item.count}</span>
                  <span className="text-white/25 text-[11px]">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="filter-tabs">
          {['', 'allow', 'deny', 'needs_approval'].map((d) => (
            <button
              key={d}
              onClick={() => {
                setFilterDecision(d);
                setPage(1);
              }}
              className={`filter-tab ${filterDecision === d ? 'filter-tab-active' : ''}`}
            >
              {d === ''
                ? 'All Decisions'
                : d === 'allow'
                ? 'Allowed'
                : d === 'deny'
                ? 'Denied'
                : 'Needs Approval'}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table — with smooth live updates */}
      <div className="card p-0 overflow-hidden shadow-xl border border-white/[0.06]">
        <div className="overflow-x-auto">
          <table className="table-dark w-full">
            <thead>
              <tr>
                <th className="w-32">Time</th>
                <th className="w-44">Agent</th>
                <th>Tool Intercepted</th>
                <th className="w-36">Decision</th>
                <th className="text-right w-28">Latency</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-white/20 animate-pulse">
                    Streaming activity feed...
                  </td>
                </tr>
              )}
              {logs.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-white/20">
                    No activity recorded for this filter
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="text-white/40 text-xs font-mono">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="text-white font-medium text-xs">
                    {log.agent?.name || log.agentId.slice(0, 8)}
                  </td>
                  <td>
                    <span className="code-inline font-mono text-xs text-white/80">
                      {log.tool}
                    </span>
                    {log.argsSummary && log.argsSummary !== '{}' && (
                      <span className="ml-2 text-[11px] text-white/25 font-mono truncate max-w-xs inline-block align-bottom">
                        {log.argsSummary}
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={log.decision} />
                  </td>
                  <td className="text-right text-emerald-400/90 text-xs font-mono font-medium">
                    {log.latencyMs}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-white/20 font-mono">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total events)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-ghost px-4 py-1.5 rounded-lg text-xs disabled:opacity-30"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pagination.totalPages}
              className="btn-ghost px-4 py-1.5 rounded-lg text-xs disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
