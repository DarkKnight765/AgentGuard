import { NavLink, Outlet } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { authApi } from '../lib/api';

const navItems = [
  { to: '/agents', label: 'Agents', icon: '⚡' },
  { to: '/approvals', label: 'Approvals', icon: '🔐' },
  { to: '/activity', label: 'Activity', icon: '📡' },
];

export function Layout() {
  const { connected } = useSocket();

  const handleLogout = async () => {
    try {
      await authApi.logout();
      window.location.href = '/';
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505]">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col border-r border-white/[0.06]">
        {/* Logo */}
        <div className="px-6 py-7">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-300 to-orange-600 shadow-lg shadow-orange-500/20 flex items-center justify-center">
              <span className="text-black text-xs font-black">A</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">AgentGuard</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5">
          <div className="px-3 mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/20">Navigation</span>
          </div>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500/15 to-transparent text-orange-400 border-l-2 border-orange-400'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-5 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-white/30 hover:text-white/60 hover:bg-white/[0.03] transition-all"
          >
            <span className="text-base">🚪</span>
            Logout
          </button>
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-white/20">
            <div className={connected ? 'live-dot' : 'w-1.5 h-1.5 rounded-full bg-red-400'} />
            {connected ? 'Connected' : 'Offline'}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
