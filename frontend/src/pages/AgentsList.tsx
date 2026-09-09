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

  // Live status updates via WebSocket
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Agents</h2>
          <p className="text-slate-400 text-sm mt-1">Manage registered AI agents</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setCreatedKey(null); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Register Agent
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Register New Agent</h3>
          <form onSubmit={handleCreate} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={newAgent.name}
                onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                className="w-full px-3 py-2 bg-surface-800 border border-slate-600 rounded-lg text-sm text-white"
                placeholder="ResearchAgent"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Owner</label>
              <input
                type="text"
                value={newAgent.owner}
                onChange={e => setNewAgent({ ...newAgent, owner: e.target.value })}
                className="w-full px-3 py-2 bg-surface-800 border border-slate-600 rounded-lg text-sm text-white"
                placeholder="research-team"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Role</label>
              <select
                value={newAgent.role}
                onChange={e => setNewAgent({ ...newAgent, role: e.target.value })}
                className="px-3 py-2 bg-surface-800 border border-slate-600 rounded-lg text-sm text-white"
              >
                <option value="reader">reader</option>
                <option value="deployer">deployer</option>
              </select>
            </div>
            <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
              Create
            </button>
          </form>

          {createdKey && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-amber-400 text-sm font-medium">⚠️ Save this API key — it cannot be recovered:</p>
              <code className="block mt-1 text-xs text-amber-300 break-all font-mono bg-surface-950 p-2 rounded">
                {createdKey}
              </code>
            </div>
          )}
        </div>
      )}

      {/* Agents table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left text-xs text-slate-400 font-medium px-6 py-3">Name</th>
              <th className="text-left text-xs text-slate-400 font-medium px-6 py-3">Owner</th>
              <th className="text-left text-xs text-slate-400 font-medium px-6 py-3">Role</th>
              <th className="text-left text-xs text-slate-400 font-medium px-6 py-3">Status</th>
              <th className="text-left text-xs text-slate-400 font-medium px-6 py-3">Created</th>
              <th className="text-right text-xs text-slate-400 font-medium px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
            )}
            {agents?.map(agent => (
              <tr key={agent.id} className="border-b border-slate-700/30 hover:bg-surface-800/50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-white">{agent.name}</td>
                <td className="px-6 py-4 text-sm text-slate-300">{agent.owner}</td>
                <td className="px-6 py-4"><StatusBadge status={agent.role} /></td>
                <td className="px-6 py-4"><StatusBadge status={agent.status} /></td>
                <td className="px-6 py-4 text-sm text-slate-400">
                  {new Date(agent.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => toggleStatus(agent)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      agent.status === 'active'
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
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
