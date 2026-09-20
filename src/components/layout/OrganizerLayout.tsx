// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// OrganizerLayout — sidebar + topbar wrapper for all organizer pages
// ============================================================

import React, { useState } from 'react';
import { NavLink, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Zap,
  Users,
  GraduationCap,
  Activity,
  Layers,
  ServerCog,
  Trophy,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// ----------------------------------------------------------------
// Nav items
// ----------------------------------------------------------------
interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview',      path: '/organizer/overview',      icon: LayoutDashboard },
  { label: 'Round Control', path: '/organizer/round-control', icon: Zap },
  { label: 'Teams',         path: '/organizer/teams',         icon: Users },
  { label: 'Judges',        path: '/organizer/judges',        icon: GraduationCap },
  { label: 'Submissions',   path: '/organizer/submissions',   icon: FileCheck2 },
  { label: 'Live Monitor',  path: '/organizer/monitor',       icon: Activity },
  { label: 'Sessions',      path: '/organizer/sessions',      icon: Layers },
  { label: 'System Status', path: '/organizer/system-status', icon: ServerCog },
  { label: 'Results',       path: '/organizer/results',       icon: Trophy },
];

// ----------------------------------------------------------------
// Sidebar content (shared between desktop & mobile drawer)
// ----------------------------------------------------------------
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Branding */}
      <div className="px-6 py-5 border-b border-dark-700">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
          <span className="text-xs font-mono text-indigo-300 uppercase tracking-widest">
            Organizer
          </span>
        </div>
        <p className="text-[11px] text-slate-600 font-mono leading-tight">
          CODE RELAY · ROUND 2
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700/70 border border-transparent',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={[
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300',
                  ].join(' ')}
                />
                <span>{label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom indicator */}
      <div className="px-6 py-4 border-t border-dark-700">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-slate-500 font-mono">Control Panel Active</span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Layout
// ----------------------------------------------------------------
interface OrganizerLayoutProps {
  children: React.ReactNode;
}

export default function OrganizerLayout({ children }: OrganizerLayoutProps) {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auth guard
  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'organizer') {
    return <Navigate to="/organizer/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/organizer/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* ---- Desktop Sidebar ---- */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-dark-900 border-r border-dark-700 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* ---- Mobile Drawer Overlay ---- */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-60 bg-dark-900 border-r border-dark-700 flex flex-col"
            >
              {/* Close button */}
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ---- Main area ---- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ---- Top Bar ---- */}
        <header className="sticky top-0 z-30 bg-dark-900/80 backdrop-blur-md border-b border-dark-700 px-4 lg:px-6 h-14 flex items-center justify-between shrink-0">
          {/* Left: hamburger + title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white transition-colors p-1"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-widest hidden sm:block">
                VIGYANTRA 2026
              </span>
              <span className="text-slate-700 hidden sm:block">·</span>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-widest hidden sm:block">
                CODE RELAY
              </span>
              <span className="text-slate-700 hidden md:block">·</span>
              <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest font-bold hidden md:block">
                ORGANIZER
              </span>
            </div>
          </div>

          {/* Right: organizer badge + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-indigo-900/20 border border-indigo-700/30 px-3 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs text-indigo-300 font-mono">ORGANIZER</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-900/10 border border-transparent hover:border-red-800/30"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </header>

        {/* ---- Page Content ---- */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
