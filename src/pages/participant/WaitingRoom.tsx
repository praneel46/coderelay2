// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Participant — Waiting Room
// Shown before any strike starts and between strikes.
// Navigation OUT is driven ONLY by organizer action (phase → 'active').
// ============================================================

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Clock,
  Users,
  LogOut,
  Trophy,
  ChevronRight,
  CheckCircle2,
  Hourglass,
  Wifi,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompetition } from '../../context/CompetitionContext';
import type { StrikeId } from '../../types/competition';

// ----------------------------------------------------------------
// Member relay pill
// ----------------------------------------------------------------
type MemberStatus = 'waiting' | 'active' | 'completed';

interface MemberPillProps {
  index: 1 | 2 | 3;
  name: string;
  status: MemberStatus;
}

function MemberPill({ index, name, status }: MemberPillProps) {
  const colorMap: Record<MemberStatus, string> = {
    waiting: 'border-dark-600 text-slate-600',
    active: 'border-cyan-500/60 text-cyan-300 bg-cyan-900/10',
    completed: 'border-green-500/60 text-green-400 bg-green-900/10',
  };
  const dotMap: Record<MemberStatus, string> = {
    waiting: 'bg-slate-700',
    active: 'bg-cyan-400 animate-pulse',
    completed: 'bg-green-400',
  };
  return (
    <div className={`flex items-center gap-3 border rounded-lg px-4 py-3 ${colorMap[status]}`}>
      <span className="font-mono font-bold text-sm w-5 text-center opacity-70">M{index}</span>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotMap[status]}`} />
      <span className="font-medium text-sm truncate">{name}</span>
      {status === 'completed' && (
        <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto flex-shrink-0" />
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Status message helper
// ----------------------------------------------------------------
interface StatusInfo {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

function getStatusInfo(phase: string, completedStrikes: StrikeId[]): StatusInfo {
  if (phase === 'finished') {
    return {
      label: 'ROUND 2 COMPLETE',
      sublabel: 'All strikes finished. Await results.',
      icon: <Trophy className="w-6 h-6 text-yellow-400" />,
    };
  }
  if (phase === 'complete') {
    if (completedStrikes.includes('strike2')) {
      return {
        label: 'STRIKE 2 COMPLETE — WAITING FOR STRIKE 3',
        sublabel: 'The organizer will start Strike 3 shortly.',
        icon: <Hourglass className="w-6 h-6 text-indigo-400" />,
      };
    }
    if (completedStrikes.includes('strike1')) {
      return {
        label: 'STRIKE 1 COMPLETE — WAITING FOR STRIKE 2',
        sublabel: 'The organizer will start Strike 2 shortly.',
        icon: <Hourglass className="w-6 h-6 text-cyan-400" />,
      };
    }
  }
  return {
    label: 'WAITING FOR STRIKE 1 TO BEGIN',
    sublabel: 'Competition has not started yet.',
    icon: <Clock className="w-6 h-6 text-slate-400" />,
  };
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------
export default function WaitingRoom() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { competitionState } = useCompetition();

  const { phase, currentStrikeId, completedStrikes } = competitionState;
  const team = user?.team;

  // ── Auto-navigate when organizer starts a strike ──
  useEffect(() => {
    if (phase === 'active') {
      if (currentStrikeId === 'strike1') navigate('/participant/strike1', { replace: true });
      else if (currentStrikeId === 'strike2') navigate('/participant/strike2', { replace: true });
      else if (currentStrikeId === 'strike3') navigate('/participant/strike3', { replace: true });
    }
    if (phase === 'finished') {
      navigate('/participant/round-complete', { replace: true });
    }
  }, [phase, currentStrikeId, navigate]);

  const statusInfo = getStatusInfo(phase, completedStrikes);

  // Determine per-member relay status for display
  const getMemberStatus = (memberIndex: 1 | 2 | 3): MemberStatus => {
    if (completedStrikes.includes('strike3')) return 'completed';
    if (completedStrikes.includes('strike2')) {
      return memberIndex <= 2 ? 'completed' : 'waiting';
    }
    if (completedStrikes.includes('strike1')) {
      return memberIndex === 1 ? 'completed' : 'waiting';
    }
    return 'waiting';
  };

  const handleLogout = () => {
    logout();
    navigate('/participant/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-dark-950 bg-grid-pattern flex flex-col">
      {/* ── Top bar ── */}
      <header className="border-b border-dark-700 bg-dark-900/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-white font-black text-lg tracking-tight">
              VIGYANTRA{' '}
              <span className="text-cyan-400 text-glow-cyan">2026</span>
            </span>
            <span className="badge-active">Round 2</span>
          </div>
          <p className="text-slate-500 text-xs font-mono tracking-widest mt-0.5">CODE RELAY</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Live connection dot */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-mono hidden sm:block">Connected</span>
          </div>
          <button
            onClick={handleLogout}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 space-y-6">

        {/* ── Competition status card ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="card-glow p-8 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            {statusInfo.icon}
            <h2 className="text-xl sm:text-2xl font-black tracking-widest text-white text-glow-white">
              {statusInfo.label}
            </h2>
          </div>
          <p className="text-slate-400 font-mono text-sm">{statusInfo.sublabel}</p>

          {/* Strike progress chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {(
              [
                { sid: 'strike1' as StrikeId, short: 'S1', label: 'PREDICT' },
                { sid: 'strike2' as StrikeId, short: 'S2', label: 'DEBUG' },
                { sid: 'strike3' as StrikeId, short: 'S3', label: 'CODE' },
              ] as const
            ).map(({ sid, short, label }) => {
              const isDone = completedStrikes.includes(sid);
              return (
                <div
                  key={sid}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono font-semibold tracking-wider ${
                    isDone
                      ? 'border-green-500/50 text-green-400 bg-green-900/10'
                      : 'border-dark-600 text-slate-600 bg-dark-800'
                  }`}
                >
                  {isDone && <CheckCircle2 className="w-3 h-3" />}
                  {short} · {label}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Team info & relay status ── */}
        {team && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="card-dark p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-cyan-400" />
              <h3 className="text-white font-bold tracking-wide">Your Team</h3>
            </div>

            <div className="mb-5">
              <p className="text-cyan-400 font-black text-xl text-glow-cyan">{team.teamName}</p>
              <p className="text-slate-500 font-mono text-sm mt-1">{team.teamId}</p>
            </div>

            <div className="space-y-2">
              {team.members.map((member) => (
                <MemberPill
                  key={member.index}
                  index={member.index}
                  name={member.name}
                  status={getMemberStatus(member.index)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Instruction banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="card-dark p-5 flex items-start gap-3"
        >
          <Wifi className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-slate-300 font-medium text-sm">
              Stay ready. The organizer will start the competition.
            </p>
            <p className="text-slate-600 text-xs font-mono mt-1">
              This page will automatically navigate when your strike begins.
              Do not close or refresh this tab unnecessarily.
            </p>
          </div>
        </motion.div>

        {/* ── Strike overview ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="card-dark p-5"
        >
          <h3 className="text-slate-400 text-xs font-mono tracking-widest uppercase mb-4">
            Strike Overview
          </h3>
          <div className="space-y-3">
            {[
              {
                short: 'S1',
                name: 'PREDICT',
                duration: '5 min',
                members: 'Member 1',
                color: 'text-cyan-400',
                done: completedStrikes.includes('strike1'),
              },
              {
                short: 'S2',
                name: 'DEBUG',
                duration: '15 min',
                members: 'Members 1 + 2',
                color: 'text-indigo-400',
                done: completedStrikes.includes('strike2'),
              },
              {
                short: 'S3',
                name: 'CODE',
                duration: '20 min',
                members: 'All 3 Members',
                color: 'text-purple-400',
                done: completedStrikes.includes('strike3'),
              },
            ].map((s) => (
              <div key={s.short} className="flex items-center gap-4">
                <span
                  className={`font-black text-sm w-6 ${
                    s.done ? 'text-green-400' : s.color
                  }`}
                >
                  {s.short}
                </span>
                <ChevronRight className="w-3 h-3 text-slate-700 flex-shrink-0" />
                <span
                  className={`font-mono font-bold text-sm w-16 ${
                    s.done ? 'text-green-400' : 'text-slate-300'
                  }`}
                >
                  {s.name}
                </span>
                <span className="text-slate-600 text-xs font-mono">{s.duration}</span>
                <span className="text-slate-600 text-xs font-mono ml-auto">{s.members}</span>
                {s.done && (
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      <footer className="border-t border-dark-800 py-4 text-center">
        <p className="text-slate-700 text-xs font-mono tracking-widest">
          VIGYANTRA 2026 · CODE RELAY · ROUND 2
        </p>
      </footer>
    </div>
  );
}
