import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { authApi } from '../lib/api';

export function Login({ onLogin }: { onLogin: () => void }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setError(null);
      setLoading(true);
      await authApi.googleLogin(credentialResponse.credential);
      onLogin();
      navigate('/agents');
    } catch (err: any) {
      console.error('Google login failed:', err);
      const msg = err.response?.data?.error || err.message || 'Login failed';
      setError(`Google login error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Navigation Bar */}
      <nav className="flex items-center justify-between px-10 py-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-300 to-orange-600 shadow-lg shadow-orange-500/20 flex items-center justify-center">
              <span className="text-black text-xs font-black">A</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">AgentGuard</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-white/30">
            <a href="#" className="text-orange-400 font-medium">Home</a>
            <a href="#" className="hover:text-white/60 transition-colors">About</a>
            <a href="#" className="hover:text-white/60 transition-colors">Agents</a>
            <a href="#" className="hover:text-white/60 transition-colors">Docs</a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="scale-90 origin-right">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google popup login failed or was closed.')}
              theme="filled_black"
              shape="pill"
            />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
        {/* Dot pattern */}
        <div className="absolute inset-0 bg-dots opacity-40"></div>

        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/5 blur-[150px] rounded-full"></div>

        {/* Available tag */}
        <div className="relative z-10 flex items-center gap-2 mb-8">
          <span className="live-dot"></span>
          <span className="text-xs text-white/30 font-medium">Available now, open source</span>
        </div>

        {/* Main heading */}
        <h1 className="relative z-10 text-7xl md:text-8xl lg:text-9xl font-black text-white tracking-tighter leading-[0.9] mb-6">
          AGENT<br />
          <span className="text-gradient-orange">GUARD</span>
        </h1>

        <p className="relative z-10 text-white/30 text-lg max-w-md mb-10 leading-relaxed">
          Home of intelligent agent governance. Intercept, audit, and control every AI tool call in real time.
        </p>

        {/* CTA button */}
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="scale-110 shadow-xl shadow-orange-500/10 rounded-full">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google popup login failed or was closed.')}
              theme="filled_black"
              shape="pill"
              size="large"
              text="continue_with"
            />
          </div>
          {loading && (
            <div className="text-xs text-orange-400 font-mono animate-pulse">
              Authenticating with gateway...
            </div>
          )}
        </div>

        {error && (
          <div className="relative z-10 mt-5 px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono max-w-md animate-fade-in text-center">
            ⚠️ {error}
          </div>
        )}

        {/* Hero end */}
      </div>

      {/* Why section */}
      <div className="px-8 py-20 text-center">
        <span className="section-label">Why Us</span>
        <h2 className="text-4xl font-bold text-white tracking-tight mt-3 mb-4">
          AgentGuard Is The Home Of<br />Governed Agents
        </h2>
        <p className="text-white/30 text-sm max-w-lg mx-auto mb-12">
          AgentGuard works at the intersection of security and AI to allow anyone to
          register, monitor, and govern autonomous Agents.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          <div className="card card-hover text-left">
            <div className="text-2xl mb-4">🛡️</div>
            <h3 className="text-white font-semibold mb-2">Policy Engine</h3>
            <p className="text-white/20 text-sm leading-relaxed">
              Sub-millisecond OPA/WASM evaluation. Define rules in Rego, compile once, enforce everywhere.
            </p>
          </div>
          <div className="card card-hover text-left">
            <div className="text-2xl mb-4">⚡</div>
            <h3 className="text-white font-semibold mb-2">Real-Time Audit</h3>
            <p className="text-white/20 text-sm leading-relaxed">
              Every tool call is logged, streamed via WebSocket, and searchable in the dashboard instantly.
            </p>
          </div>
          <div className="card card-hover text-left">
            <div className="text-2xl mb-4">🔐</div>
            <h3 className="text-white font-semibold mb-2">Approval Workflows</h3>
            <p className="text-white/20 text-sm leading-relaxed">
              High-risk actions require human review. Approve or deny from the live dashboard in one click.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] px-8 py-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-amber-300 to-orange-600 flex items-center justify-center">
            <span className="text-black text-[8px] font-black">A</span>
          </div>
          <span className="text-white/20 text-xs font-medium">AgentGuard</span>
        </div>
        <p className="text-white/10 text-xs">Copyright © AgentGuard. All rights reserved.</p>
        <div className="flex items-center gap-6 text-white/15 text-xs">
          <a href="#" className="hover:text-white/30 transition-colors">Mission</a>
          <a href="#" className="hover:text-white/30 transition-colors">Docs</a>
          <a href="#" className="hover:text-white/30 transition-colors">Contact</a>
        </div>
      </footer>
    </div>
  );
}
