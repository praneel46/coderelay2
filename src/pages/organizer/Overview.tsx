// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Overview — organizer dashboard overview page
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Wifi,
  Zap,
  CheckCircle2,
  Clock,
  Star,
  ArrowRight,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import OrganizerLayout from '../../components/layout/OrganizerLayout';
import { useCompetition } from '../../context/CompetitionContext';
import { STRIKE_CONFIGS } from '../../types/competition-state';

// ----------------------------------------------------------------
// Stat card
// ----------------------------------------------------------------
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  sub?: string;
}

function StatCard({ label, value, icon: Icon, iconColor, bgColor, borderColor, sub }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${bgColor} border ${borderColor} rounded-xl p-5`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">{label}</p>
        <div className={`${iconColor} opacity-80`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-black text-white mb-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 font-mono">{sub}</p>}
    </motion.div>
  );
}

// ----------------------------------------------------------------
// Phase badge
// ----------------------------------------------------------------
function PhaseBadge({ phase }: { phase: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    waiting:  { label: 'WAITING',  cls: 'bg-slate-700/50 border-slate-500/50 text-slate-300' },
    active:   { label: 'ACTIVE',   cls: 'bg-green-900/30 border-green-500/50 text-green-300' },
    complete: { label: 'COMPLETE', cls: 'bg-yellow-900/30 border-yellow-500/50 text-yellow-300' },
    finished: { label: 'FINISHED', cls: 'bg-indigo-900/30 border-indigo-500/50 text-indigo-300' },
  };
  const c = config[phase] ?? config.waiting;
  return (
    <span className={`border text-xs font-mono px-3 py-1 rounded-full uppercase tracking-wider ${c.cls}`}>
      {c.label}
    </span>
  );
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------
export default function Overview() {
  const navigate = useNavigate();
  const { competitionState, submissions } = useCompetition();

  const { phase, currentStrikeId, completedStrikes, globalLock, lastUpdatedAt } = competitionState;

  const submittedCount = submissions.filter((s) => s.status === 'submitted').length;
  const strikeLabel = currentStrikeId
    ? STRIKE_CONFIGS[currentStrikeId].label
    : 'None';

  const lastUpdated = new Date(lastUpdatedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const statCards: StatCardProps[] = [
    {
      label: 'Active Teams',
      value: 5,
      icon: Users,
      iconColor: 'text-cyan-400',
      bgColor: 'bg-dark-800',
      borderColor: 'border-dark-600',
      sub: 'Total registered',
    },
    {
      label: 'Connected',
      value: 4,
      icon: Wifi,
      iconColor: 'text-green-400',
      bgColor: 'bg-dark-800',
      borderColor: 'border-green-800/40',
      sub: '1 offline',
    },
    {
      label: 'Current Strike',
      value: strikeLabel,
      icon: Zap,
      iconColor: 'text-indigo-400',
      bgColor: 'bg-dark-800',
      borderColor: phase === 'active' ? 'border-indigo-700/50' : 'border-dark-600',
      sub: `Phase: ${phase.toUpperCase()}`,
    },
    {
      label: 'Submitted',
      value: submittedCount,
      icon: CheckCircle2,
      iconColor: 'text-green-400',
      bgColor: 'bg-dark-800',
      borderColor: 'border-dark-600',
      sub: 'Answers received',
    },
    {
      label: 'Pending Judging',
      value: 3,
      icon: Clock,
      iconColor: 'text-yellow-400',
      bgColor: 'bg-dark-800',
      borderColor: 'border-yellow-900/30',
      sub: 'Awaiting evaluation',
    },
    {
      label: 'Evaluated',
      value: 2,
      icon: Star,
      iconColor: 'text-amber-400',
      bgColor: 'bg-dark-800',
      borderColor: 'border-amber-900/30',
      sub: 'Marks submitted',
    },
  ];

  return (
    <OrganizerLayout>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white tracking-wider mb-1">
            OVERVIEW
          </h1>
          <p className="text-slate-500 text-sm font-mono">
            Competition dashboard · Last updated: {lastUpdated}
          </p>
        </div>

        {/* Current state banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={[
            'mb-8 rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4',
            globalLock
              ? 'bg-red-900/10 border-red-700/40'
              : phase === 'active'
              ? 'bg-indigo-900/10 border-indigo-700/40'
              : 'bg-dark-800 border-dark-600',
          ].join(' ')}
        >
          <div className="flex items-center gap-4 flex-wrap">
            {globalLock && (
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-600/40 px-3 py-1.5 rounded-lg">
                <Lock className="w-4 h-4 text-red-400" />
                <span className="text-red-300 text-xs font-mono uppercase tracking-widest font-bold">
                  GLOBAL LOCK ACTIVE
                </span>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-1">
                Competition Phase
              </p>
              <div className="flex items-center gap-3">
                <PhaseBadge phase={phase} />
                {currentStrikeId && (
                  <span className="text-sm font-mono text-slate-300">
                    {STRIKE_CONFIGS[currentStrikeId].label} — {STRIKE_CONFIGS[currentStrikeId].subLabel}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-1">
                Completed Strikes
              </p>
              <div className="flex items-center gap-1">
                {['strike1', 'strike2', 'strike3'].map((sid) => (
                  <span
                    key={sid}
                    className={[
                      'text-xs font-mono px-2 py-0.5 rounded border',
                      completedStrikes.includes(sid as any)
                        ? 'bg-green-900/30 border-green-600/40 text-green-400'
                        : 'bg-dark-700 border-dark-600 text-slate-600',
                    ].join(' ')}
                  >
                    {STRIKE_CONFIGS[sid as keyof typeof STRIKE_CONFIGS].label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {globalLock && (
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-mono">All submissions locked</span>
            </div>
          )}
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
            >
              <StatCard {...card} />
            </motion.div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-6">
          <h2 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/organizer/round-control')}
              className="btn-organizer flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Round Control</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/organizer/monitor')}
              className="btn-ghost flex items-center gap-2"
            >
              <Wifi className="w-4 h-4" />
              <span>Live Monitor</span>
            </button>
            <button
              onClick={() => navigate('/organizer/results')}
              className="btn-ghost flex items-center gap-2"
            >
              <Star className="w-4 h-4" />
              <span>View Results</span>
            </button>
          </div>
        </div>
      </div>
    </OrganizerLayout>
  );
}
