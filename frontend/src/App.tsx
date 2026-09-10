import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { AgentsList } from './pages/AgentsList';
import { AgentDetail } from './pages/AgentDetail';
import { Approvals } from './pages/Approvals';
import { ActivityFeed } from './pages/ActivityFeed';
import { authApi } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    authApi.me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/agents" element={<AgentsList />} />
        <Route path="/agents/:id" element={<AgentDetail />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/activity" element={<ActivityFeed />} />
        <Route path="*" element={<Navigate to="/agents" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
