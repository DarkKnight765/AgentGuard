import { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agentsApi, policiesApi, auditApi } from '../lib/api';
import type { Agent } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { useSocket } from '../hooks/useSocket';

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const onAgentStatus = useCallback(
    (data: { agentId: string; status: string }) => {
      if (data.agentId === id) {
        queryClient.setQueryData<Agent>(['agent', id], (old) =>
          old ? { ...old, status: data.status } : old
        );
        queryClient.invalidateQueries({ queryKey: ['agents'] });
      }
    },
    [id, queryClient]
  );

  const onAuditNew = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['audit', id] });
  }, [id, queryClient]);

  useSocket({ onAgentStatus, onAuditNew });

  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.get(id!),
    enabled: Boolean(id),
  });

  const { data: policy, isLoading: policyLoading } = useQuery({
    queryKey: ['policy', id],
    queryFn: () => policiesApi.get(id!),
    enabled: Boolean(id),
  });

  const { data: auditResponse, isLoading: auditLoading } = useQuery({
    queryKey: ['audit', id],
    queryFn: () => auditApi.list({ agentId: id, page: 1 }),
    enabled: Boolean(id),
  });

  const toggleStatus = async () => {
    if (!agent) return;
    const newStatus = agent.status === 'active' ? 'suspended' : 'active';
    await agentsApi.update(agent.id, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ['agent', id] });
    queryClient.invalidateQueries({ queryKey: ['agents'] });
  };

  if (agentLoading) {
    return (
      <div className="py-20 text-center text-white/30">
        Loading agent details...
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="py-20 text-center">
        <p className="text-white/50 mb-4">Agent not found</p>
        <Link to="/agents" className="btn-secondary px-4 py-2 rounded-xl text-sm">
          ← Back to Agents
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Navigation & Header */}
      <div>
        <Link
          to="/agents"
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors mb-4"
        >
          ← Back to Agents List
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold text-white tracking-tight">
                {agent.name}
              </h2>
              <StatusBadge status={agent.status} />
              <StatusBadge status={agent.role} />
            </div>
            <p className="text-white/30 text-sm mt-1 font-mono">ID: {agent.id}</p>
          </div>

          <button
            onClick={toggleStatus}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg ${
              agent.status === 'active'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            {agent.status === 'active' ? '🛑 Kill Switch (Suspend)' : '⚡ Reactivate Agent'}
          </button>
        </div>
      </div>

      {/* Agent Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-1">
            Owner
          </p>
          <p className="text-lg font-semibold text-white">{agent.owner}</p>
        </div>
        <div className="card">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-1">
            Role
          </p>
          <p className="text-lg font-semibold text-white capitalize">{agent.role}</p>
        </div>
        <div className="card">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-1">
            Registered
          </p>
          <p className="text-lg font-semibold text-white">
            {new Date(agent.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="card">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-1">
            Enforcement Mode
          </p>
          <p className="text-lg font-semibold text-emerald-400">OPA / WASM</p>
        </div>
      </div>

      {/* Policy Viewer (Read-Only) */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Rego Policy Specification</h3>
            <p className="text-xs text-white/30 mt-0.5">
              Read-only view • Enforced in-process via precompiled WASM module
            </p>
          </div>
          {policy && (
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-white/5 text-white/40 border border-white/10">
              Version {policy.version}
            </span>
          )}
        </div>

        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/60">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
            <span className="text-[11px] font-mono text-white/30">base.rego (read-only)</span>
            <span className="text-[10px] text-emerald-400/80 font-medium">
              ● Active in-process
            </span>
          </div>
          {policyLoading ? (
            <div className="p-6 text-center text-xs text-white/30">Loading policy...</div>
          ) : (
            <pre className="p-4 text-xs font-mono text-emerald-300/90 leading-relaxed overflow-x-auto whitespace-pre">
              {policy?.regoSource || '# No explicit policy source found in database'}
            </pre>
          )}
        </div>
        <p className="text-[11px] text-white/20 mt-3">
          ℹ️ In accordance with production security specifications, policies are precompiled into WASM at startup for zero-overhead, sub-millisecond in-process evaluation. Dynamic runtime compilation is disabled.
        </p>
      </div>

      {/* Filtered Audit Log */}
      <div className="card p-0 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Recent Activity & Audit Log</h3>
            <p className="text-xs text-white/30 mt-0.5">
              Real-time audit log of tool calls intercepted for this agent
            </p>
          </div>
          <span className="text-xs text-white/30 font-mono">
            {auditResponse?.pagination.total || 0} total calls
          </span>
        </div>

        <table className="table-dark">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Arguments</th>
              <th>Decision</th>
              <th>Latency</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {auditLoading && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-white/20">
                  Loading agent audit logs...
                </td>
              </tr>
            )}
            {auditResponse?.data.length === 0 && !auditLoading && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-white/20">
                  No activity recorded for this agent yet
                </td>
              </tr>
            )}
            {auditResponse?.data.map((log) => (
              <tr key={log.id}>
                <td className="font-mono text-xs text-white font-medium">
                  {log.tool}
                </td>
                <td className="font-mono text-[11px] text-white/40 max-w-xs truncate">
                  {log.argsSummary || '{}'}
                </td>
                <td>
                  <StatusBadge status={log.decision} />
                </td>
                <td className="font-mono text-xs text-white/30">
                  {log.latencyMs}ms
                </td>
                <td className="text-white/30 text-xs">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
