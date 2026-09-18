import React, { useState } from 'react';
import { NavLink, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  ClipboardCheck,
  LogOut,
  Menu,
  X,
  Scale,
  Award,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface JudgeNavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const JUDGE_NAV_ITEMS: JudgeNavItem[] = [
  { label: 'Assigned Teams', path: '/judge/teams', icon: Users },
  { label: 'Evaluations', path: '/judge/teams', icon: ClipboardCheck },
];

function JudgeSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();

  return (
    <div className="flex flex-col h-full">
      {/* Branding */}
      <div className="px-6 py-5 border-b border-dark-700">
        <div className="flex items-center gap-2 mb-1">
          <Scale className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-mono text-emerald-300 uppercase tracking-widest font-bold">
            JUDGE PORTAL
          </span>
        </div>
        <p className="text-[11px] text-slate-500 font-mono leading-tight">
          {user?.judgeName || 'Official Evaluator'} ({user?.judgeId || 'J---'})
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {JUDGE_NAV_ITEMS.map(({ label, path, icon: Icon }, idx) => (
          <NavLink
            key={idx}
            to={path}
            onClick={onNavigate}
            end={idx === 0}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700/70 border border-transparent',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={[
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300',
                  ].join(' ')}
                />
                <span>{label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Status indicator */}
      <div className="px-6 py-4 border-t border-dark-700">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-slate-400 font-mono">Evaluation Model Active</span>
        </div>
        <p className="text-[10px] text-slate-600 font-mono mt-1">
          Predict (/30) + Debug (/60) + Code (/60) = /150
        </p>
      </div>
    </div>
  );
}

interface JudgeLayoutProps {
  children: React.ReactNode;
}

export default function JudgeLayout({ children }: JudgeLayoutProps) {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'judge') {
    return <Navigate to="/judge/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/judge/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-dark-900 border-r border-dark-700 sticky top-0 h-screen">
        <JudgeSidebarContent />
      </aside>

      {/* Mobile Drawer */}
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
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-64 bg-dark-900 border-r border-dark-700 flex flex-col"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <JudgeSidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-dark-900/80 backdrop-blur-md border-b border-dark-700 px-4 lg:px-6 h-14 flex items-center justify-between shrink-0">
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
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest font-bold">
                JUDGE CONSOLE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-emerald-900/20 border border-emerald-700/30 px-3 py-1 rounded-full">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-300 font-mono">
                {user.judgeName || user.judgeId}
              </span>
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

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
