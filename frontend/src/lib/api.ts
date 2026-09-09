import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// ─── Auth ─────────────────────────────────────────────────────

export const authApi = {
  devLogin: () => api.post('/auth/dev-login'),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
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
