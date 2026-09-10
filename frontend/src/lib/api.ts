import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: baseUrl,
  withCredentials: true,
});

// ─── Auth ─────────────────────────────────────────────────────

export const authApi = {
  devLogin: async () => {
    const res = await api.post('/auth/dev-login');
    return res.data;
  },
  googleLogin: async (credential: string) => {
    const res = await api.post('/auth/google/callback', { credential });
    return res.data;
  },
  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
  me: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

// ─── Agents ───────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  owner: string;
  role: string;
  status: string;
  createdAt: string;
  apiKey?: string;
}

export const agentsApi = {
  list: () => api.get<Agent[]>('/agents').then(r => r.data),
  get: (id: string) => api.get<Agent>(`/agents/${id}`).then(r => r.data),
  create: (data: { name: string; owner: string; role: string }) =>
    api.post<Agent & { apiKey: string }>('/agents', data).then(r => r.data),
  update: (id: string, data: { role?: string; status?: string }) =>
    api.patch<Agent>(`/agents/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/agents/${id}`),
};

// ─── Gateway ──────────────────────────────────────────────────

export const gatewayApi = {
  check: (apiKey: string, tool: string, args?: Record<string, any>) =>
    api.post('/gateway/check', { tool, args }, {
      headers: { 'X-API-Key': apiKey },
    }).then(r => r.data),
};

// ─── Policies ─────────────────────────────────────────────────

export interface Policy {
  id: string;
  regoSource: string;
  version: number;
  updatedAt: string;
}

export const policiesApi = {
  get: (agentId: string) =>
    api.get<Policy>(`/policies/${agentId}`).then(r => r.data),
};

// ─── Approvals ────────────────────────────────────────────────

export interface Approval {
  id: string;
  auditLogId: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  auditLog: AuditLog & { agent: { id: string; name: string; role: string } };
}

export const approvalsApi = {
  list: (status?: string) =>
    api.get<Approval[]>('/approvals', { params: status ? { status } : {} }).then(r => r.data),
  decide: (id: string, decision: 'approve' | 'deny') =>
    api.post<Approval>(`/approvals/${id}/decide`, { decision }).then(r => r.data),
};

// ─── Audit ────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  agentId: string;
  tool: string;
  argsSummary: string;
  decision: string;
  latencyMs: number;
  createdAt: string;
  agent?: { id: string; name: string; role: string };
  approval?: { id: string; status: string } | null;
}

export interface AuditResponse {
  data: AuditLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const auditApi = {
  list: (params?: { agentId?: string; decision?: string; page?: number }) =>
    api.get<AuditResponse>('/audit', { params }).then(r => r.data),
};

export default api;
