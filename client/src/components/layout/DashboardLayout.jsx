/**
 * Dashboard Layout with sidebar navigation
 */
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../common/NotificationBell';
import NotificationToasts from '../common/NotificationToasts';

const NAV_LINKS = {
  citizen: [
    { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { to: '/emergency', icon: '🆘', label: 'SOS Request' },
    { to: '/history', icon: '🕘', label: 'Request History' },
    { to: '/map', icon: '🗺️', label: 'Live Map' },
    { to: '/alerts', icon: '🔔', label: 'Alerts' },
    { to: '/chat', icon: '💬', label: 'Chat' },
    { to: '/profile', icon: '👤', label: 'Profile' },
  ],
  volunteer: [
    { to: '/volunteer', icon: '🏠', label: 'Dashboard' },
    { to: '/volunteer/history', icon: '🕘', label: 'Mission History' },
    { to: '/map', icon: '🗺️', label: 'Rescue Map' },
    { to: '/alerts', icon: '🔔', label: 'Alerts' },
    { to: '/chat', icon: '💬', label: 'Chat' },
    { to: '/profile', icon: '👤', label: 'Profile' },
  ],
  admin: [
    { to: '/admin', icon: '🏠', label: 'Dashboard' },
    { to: '/map', icon: '🗺️', label: 'Disaster Map' },
    { to: '/alerts', icon: '📢', label: 'Alerts' },
    { to: '/profile', icon: '👤', label: 'Profile' },
  ],
};

export default function DashboardLayout({ children, title }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const links = NAV_LINKS[user?.role] || NAV_LINKS.citizen;
  const rolePrimaryAction = user?.role === 'citizen'
    ? { to: '/emergency', label: '🆘 SOS' }
    : user?.role === 'volunteer'
      ? { to: '/volunteer', label: '🧭 Missions' }
      : user?.role === 'admin'
        ? { to: '/admin', label: '🛡️ Control' }
        : null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white transform transition-transform duration-300 
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex-shrink-0`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-800">
            <Link to="/" className="flex items-center gap-3">
              <span className="text-3xl">🚁</span>
              <div>
                <div className="font-display text-xl tracking-widest">RESCUE WINGS</div>
                <div className="text-xs text-gray-400 capitalize">{user?.role} Panel</div>
              </div>
            </Link>
          </div>

          {/* User info */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm">{user?.name}</div>
                <div className="text-xs text-gray-400 capitalize">{user?.role}</div>
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 p-4 space-y-1">
            {links.map(link => (
              <Link key={link.to} to={link.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm
                  ${location.pathname === link.to ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                <span className="text-lg">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-800">
            <button onClick={async () => { await logout(); navigate('/'); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition-all text-sm font-medium">
              <span>🚪</span> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 lg:px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
              <span className="text-xl">☰</span>
            </button>
            <h1 className="font-bold text-xl text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {rolePrimaryAction && (
              <Link to={rolePrimaryAction.to} className="btn-primary py-2 text-sm flex items-center gap-1">
                {rolePrimaryAction.label}
              </Link>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
      <NotificationToasts />
    </div>
  );
}
