import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { auditApi } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { useSocket } from '../hooks/useSocket';

const DECISION_COLORS: Record<string, string> = {
  allow: '#34d399',
  deny: '#f87171',
  needs_approval: '#fbbf24',
};

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
    queryFn: () => auditApi.list({
      page,
      decision: filterDecision || undefined,
    }),
  });

  const chartData = data ? [
    { name: 'Allowed', count: data.data.filter(l => l.decision === 'allow').length },
    { name: 'Denied', count: data.data.filter(l => l.decision === 'deny').length },
    { name: 'Pending', count: data.data.filter(l => l.decision === 'needs_approval').length },
  ] : [];

  const totalAllowed = data?.data.filter(l => l.decision === 'allow').length || 0;
  const totalDenied = data?.data.filter(l => l.decision === 'deny').length || 0;
  const avgLatency = data?.data.length ? Math.round(data.data.reduce((s, l) => s + l.latencyMs, 0) / data.data.length) : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <span className="section-label">Monitoring</span>
        <h2 className="text-3xl font-bold text-white tracking-tight mt-1">Activity Feed</h2>
        <p className="text-white/30 text-sm mt-1 flex items-center gap-2">
          Real-time audit log of all agent tool calls
          <span className="live-dot"></span>
          <span className="text-emerald-400 text-xs font-medium">Live</span>
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card card-hover">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">Total Events</p>
          <p className="stat-number text-white">{data?.pagination.total || 0}</p>
        </div>
        <div className="card card-hover">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">Allowed</p>
          <p className="stat-number text-emerald-400">{totalAllowed}</p>
        </div>
        <div className="card card-hover">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">Denied</p>
          <p className="stat-number text-red-400">{totalDenied}</p>
        </div>
        <div className="card card-hover">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">Avg Latency</p>
          <p className="stat-number text-orange-400">{avgLatency}<span className="text-lg font-medium text-white/20">ms</span></p>
        </div>
      </div>

      {/* Chart */}
      <div className="card mb-6">
        <p className="text-[11px] text-white/30 font-medium uppercase tracking-wider mb-4">Decision Distribution</p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={70} tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: '#0e0e0e',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '13px',
              }}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={DECISION_COLORS[entry.name.toLowerCase()] || DECISION_COLORS[entry.name === 'Pending' ? 'needs_approval' : 'allow'] || '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between mb-4">
        <div className="filter-tabs">
          {['', 'allow', 'deny', 'needs_approval'].map(d => (
            <button
              key={d}
              onClick={() => { setFilterDecision(d); setPage(1); }}
              className={`filter-tab ${filterDecision === d ? 'filter-tab-active' : ''}`}
            >
              {d || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Audit log table */}
      <div className="card p-0 overflow-hidden">
        <table className="table-dark">
          <thead>
            <tr>
              <th>Time</th>
              <th>Agent</th>
              <th>Tool</th>
              <th>Decision</th>
              <th className="text-right">Latency</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="text-center py-12 text-white/20">Loading activity...</td></tr>
            )}
            {data?.data.map(log => (
              <tr key={log.id}>
                <td className="text-white/30 text-sm">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </td>
                <td className="text-white font-medium">{log.agent?.name || log.agentId.slice(0, 8)}</td>
                <td><span className="code-inline">{log.tool}</span></td>
                <td><StatusBadge status={log.decision} /></td>
                <td className="text-right text-white/30 text-sm font-mono">{log.latencyMs}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <span className="text-xs text-white/20">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-ghost px-4 py-1.5 rounded-lg text-xs disabled:opacity-30"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
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
