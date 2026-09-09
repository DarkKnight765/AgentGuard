import { authApi } from '../lib/api';

export function Login({ onLogin }: { onLogin: () => void }) {
  const handleDevLogin = async () => {
    try {
      await authApi.devLogin();
      onLogin();
    } catch (err) {
      console.error('Dev login failed:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950">
      <div className="card max-w-md w-full text-center">
        <div className="text-4xl mb-4">🛡️</div>
        <h1 className="text-2xl font-bold text-white mb-2">AgentGuard</h1>
        <p className="text-slate-400 text-sm mb-8">
          Permission gateway for AI agents
        </p>

        <button
          onClick={handleDevLogin}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors mb-3"
        >
          Sign in (Dev Mode)
        </button>

        <p className="text-xs text-slate-500 mt-4">
          Google OAuth available when GOOGLE_CLIENT_ID is configured
        </p>
      </div>
    </div>
  );
}
