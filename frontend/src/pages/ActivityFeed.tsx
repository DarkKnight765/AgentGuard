import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { auditApi } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { useSocket } from '../hooks/useSocket';

const DECISION_COLORS: Record<string, string> = {
  allow: '#10b981',
  deny: '#ef4444',
  needs_approval: '#f59e0b',
};

export function ActivityFeed() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterDecision, setFilterDecision] = useState<string>('');

  // Live audit feed — new entries appear without page refresh
  const onAuditNew = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['audit'] });
  }, [queryClient]);

  useSocket({ onAuditNew });

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, filterDecision],
    queryFn: () => auditApi.list({
      page,
      decision: filterDecision || undefined,
    }),
  });

  // Build chart data from current page results
  const chartData = data ? [
    { name: 'allow', count: data.data.filter(l => l.decision === 'allow').length },
    { name: 'deny', count: data.data.filter(l => l.decision === 'deny').length },
    { name: 'needs_approval', count: data.data.filter(l => l.decision === 'needs_approval').length },
  ] : [];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Activity Feed</h2>
        <p className="text-slate-400 text-sm mt-1">
          Real-time audit log of all agent tool calls
          <span className="inline-flex items-center gap-1 ml-2">
            <span className="live-dot" />
            <span className="text-emerald-400">Live</span>
          </span>
        </p>
      </div>

      {/* Chart */}
      <div className="card mb-6">
        <h3 className="text-sm font-medium text-slate-400 mb-4">Decisions (current page)</h3>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              labelStyle={{ color: '#f8fafc' }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={DECISION_COLORS[entry.name] || '#64748b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-4 bg-surface-900 p-1 rounded-lg border border-slate-700/50 w-fit">
        {['', 'allow', 'deny', 'needs_approval'].map(d => (
          <button
            key={d}
            onClick={() => { setFilterDecision(d); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filterDecision === d
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {d || 'All'}
          </button>
        ))}
      </div>

      {/* Audit log table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left text-xs text-slate-400 font-medium px-6 py-3">Time</th>
              <th className="text-left text-xs text-slate-400 font-medium px-6 py-3">Agent</th>
              <th className="text-left text-xs text-slate-400 font-medium px-6 py-3">Tool</th>
              <th className="text-left text-xs text-slate-400 font-medium px-6 py-3">Decision</th>
              <th className="text-right text-xs text-slate-400 font-medium px-6 py-3">Latency</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
            )}
            {data?.data.map(log => (
              <tr key={log.id} className="border-b border-slate-700/30 hover:bg-surface-800/50 transition-colors">
                <td className="px-6 py-3 text-xs text-slate-400">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </td>
                <td className="px-6 py-3 text-sm text-white">{log.agent?.name || log.agentId.slice(0, 8)}</td>
                <td className="px-6 py-3">
                  <code className="text-blue-400 text-xs bg-blue-500/10 px-2 py-0.5 rounded">{log.tool}</code>
                </td>
                <td className="px-6 py-3"><StatusBadge status={log.decision} /></td>
                <td className="px-6 py-3 text-right text-xs text-slate-400">{log.latencyMs}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-slate-400">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-surface-800 text-slate-300 rounded text-xs disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= data.pagination.totalPages}
              className="px-3 py-1 bg-surface-800 text-slate-300 rounded text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
