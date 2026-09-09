import { NavLink, Outlet } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

const navItems = [
  { to: '/agents', label: 'Agents', icon: '🤖' },
  { to: '/approvals', label: 'Approvals', icon: '✅' },
  { to: '/activity', label: 'Activity Feed', icon: '📊' },
];

export function Layout() {
  const { connected } = useSocket();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-900 border-r border-slate-700/50 flex flex-col">
        <div className="p-6 border-b border-slate-700/50">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            🛡️ AgentGuard
          </h1>
          <p className="text-xs text-slate-400 mt-1">Permission Gateway</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className={connected ? 'live-dot' : 'w-2 h-2 rounded-full bg-red-400'} />
            {connected ? 'Live' : 'Disconnected'}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
