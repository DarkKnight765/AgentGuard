import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agentsApi } from '../lib/api';
import type { Agent } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { useSocket } from '../hooks/useSocket';

export function AgentsList() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', owner: '', role: 'reader' });
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const onAgentStatus = useCallback((data: { agentId: string; status: string }) => {
    queryClient.setQueryData<Agent[]>(['agents'], (old) =>
      old?.map(a => a.id === data.agentId ? { ...a, status: data.status } : a)
    );
  }, [queryClient]);

  useSocket({ onAgentStatus });

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await agentsApi.create(newAgent);
      setCreatedKey(result.apiKey);
      setNewAgent({ name: '', owner: '', role: 'reader' });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch (err) {
      console.error('Create failed:', err);
    }
  };

  const toggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'suspended' : 'active';
    await agentsApi.update(agent.id, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ['agents'] });
  };

  const activeCount = agents?.filter(a => a.status === 'active').length || 0;
  const totalCount = agents?.length || 0;
  const suspendedCount = agents?.filter(a => a.status === 'suspended').length || 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <span className="section-label">Dashboard</span>
          <h2 className="text-3xl font-bold text-white tracking-tight mt-1">Your Agents</h2>
          <p className="text-white/30 text-sm mt-1">Manage and monitor registered AI agents</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setCreatedKey(null); }}
          className="btn-primary px-6 py-2.5 rounded-full text-sm"
        >
          + Register Agent
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card card-hover">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">Total Agents</p>
          <p className="stat-number text-white">{totalCount}</p>
        </div>
        <div className="card card-hover">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">Active</p>
          <p className="stat-number text-emerald-400">{activeCount}</p>
        </div>
        <div className="card card-hover">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">Suspended</p>
          <p className="stat-number text-red-400">{suspendedCount}</p>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card mb-6">
          <h3 className="text-base font-semibold text-white mb-5">Register New Agent</h3>
          <form onSubmit={handleCreate} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-[11px] text-white/30 font-medium uppercase tracking-wider mb-2">Name</label>
              <input
                type="text"
                value={newAgent.name}
                onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                className="input-dark w-full"
                placeholder="ResearchAgent"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] text-white/30 font-medium uppercase tracking-wider mb-2">Owner</label>
              <input
                type="text"
                value={newAgent.owner}
                onChange={e => setNewAgent({ ...newAgent, owner: e.target.value })}
                className="input-dark w-full"
                placeholder="research-team"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-white/30 font-medium uppercase tracking-wider mb-2">Role</label>
              <select
                value={newAgent.role}
                onChange={e => setNewAgent({ ...newAgent, role: e.target.value })}
                className="select-dark"
              >
                <option value="reader">reader</option>
                <option value="deployer">deployer</option>
              </select>
            </div>
            <button type="submit" className="btn-primary px-6 py-2.5 rounded-xl text-sm">
              Create
            </button>
          </form>

          {createdKey && (
            <div className="mt-5 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
              <p className="text-orange-400 text-sm font-semibold mb-2">⚠️ Save this API key — it cannot be recovered:</p>
              <code className="block text-xs text-orange-300/80 break-all font-mono bg-black/40 p-3 rounded-lg">
                {createdKey}
              </code>
            </div>
          )}
        </div>
      )}

      {/* Agents table */}
      <div className="card p-0 overflow-hidden">
        <table className="table-dark">
          <thead>
            <tr>
              <th>Name</th>
              <th>Owner</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-12 text-white/20">Loading agents...</td></tr>
            )}
            {agents?.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="text-center py-12 text-white/20">No agents registered yet</td></tr>
            )}
            {agents?.map(agent => (
              <tr key={agent.id}>
                <td className="font-medium text-white">{agent.name}</td>
                <td className="text-white/40">{agent.owner}</td>
                <td><StatusBadge status={agent.role} /></td>
                <td><StatusBadge status={agent.status} /></td>
                <td className="text-white/30 text-sm">
                  {new Date(agent.createdAt).toLocaleDateString()}
                </td>
                <td className="text-right">
                  <button
                    onClick={() => toggleStatus(agent)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      agent.status === 'active' ? 'btn-danger' : 'btn-success'
                    }`}
                  >
                    {agent.status === 'active' ? 'Suspend' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
