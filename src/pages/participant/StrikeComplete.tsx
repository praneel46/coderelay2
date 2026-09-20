import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Clock, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompetition } from '../../context/CompetitionContext';
import type { StrikeId } from '../../types/competition';

const STRIKE_INFO: Record<StrikeId, { label: string; subLabel: string; next: string; nextLabel: string; memberMsg: string; color: string }> = {
  strike1: { label: 'STRIKE 1', subLabel: 'PREDICT', next: 'Strike 2 — DEBUG', nextLabel: 'WAITING FOR STRIKE 2', memberMsg: 'Member 1 remains. Member 2 may now join.', color: 'text-cyan-400' },
  strike2: { label: 'STRIKE 2', subLabel: 'DEBUG', next: 'Strike 3 — CODE', nextLabel: 'WAITING FOR STRIKE 3', memberMsg: 'Members 1 & 2 remain. Member 3 may now join.', color: 'text-indigo-400' },
  strike3: { label: 'STRIKE 3', subLabel: 'CODE', next: '', nextLabel: 'ROUND 2 COMPLETE', memberMsg: 'All members participated. Round complete!', color: 'text-purple-400' },
};

export default function StrikeComplete() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { competitionState, teamTimerDoc, isStrikeCompleted } = useCompetition();

  // Derive completedStrikeId from location state or competition state
  const completedStrikeId: StrikeId =
    (location.state as { completedStrikeId?: StrikeId })?.completedStrikeId ??
    (competitionState.completedStrikes.length > 0
      ? competitionState.completedStrikes[competitionState.completedStrikes.length - 1]
      : 'strike1');

  const info = STRIKE_INFO[completedStrikeId];

  // If Strike 3 is complete, go to round-complete
  useEffect(() => {
    if (completedStrikeId === 'strike3') {
      const t = setTimeout(() => navigate('/participant/round-complete', { replace: true }), 2500);
      return () => clearTimeout(t);
    }
  }, [completedStrikeId, navigate]);

  // When organizer starts the next strike, auto-navigate
  useEffect(() => {
    const teamStrike = teamTimerDoc?.currentStrikeId;
    if (teamStrike && teamStrike !== completedStrikeId && teamTimerDoc?.[teamStrike]?.status === 'active' && !isStrikeCompleted(teamStrike)) {
      if (teamStrike === 'strike2') { navigate('/participant/strike2', { replace: true }); return; }
      if (teamStrike === 'strike3') { navigate('/participant/strike3', { replace: true }); return; }
    }
    if (competitionState.phase === 'active' && competitionState.currentStrikeId && competitionState.currentStrikeId !== completedStrikeId && !isStrikeCompleted(competitionState.currentStrikeId)) {
      if (competitionState.currentStrikeId === 'strike2') { navigate('/participant/strike2', { replace: true }); return; }
      if (competitionState.currentStrikeId === 'strike3') { navigate('/participant/strike3', { replace: true }); return; }
    }
  }, [competitionState.phase, competitionState.currentStrikeId, teamTimerDoc, completedStrikeId, isStrikeCompleted, navigate]);

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden bg-grid-pattern">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(6,182,212,0.05) 0%, transparent 70%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-lg text-center space-y-8 relative z-10"
      >
        {/* Completion icon */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 18 }}
          className="flex justify-center"
        >
          <div className="w-20 h-20 rounded-full bg-green-900/30 border-2 border-green-500/50 flex items-center justify-center shadow-glow-green">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
        </motion.div>

        {/* Strike label */}
        <div className="space-y-2">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-slate-500 text-xs font-mono uppercase tracking-[0.3em]">
            VIGYANTRA 2026 · CODE RELAY
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className={`text-4xl font-black tracking-wide ${info.color}`} style={{ textShadow: '0 0 30px currentColor' }}>
            {info.label} COMPLETE
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-white font-bold text-xl tracking-widest">
            {info.subLabel} PHASE COMPLETE
          </motion.p>
        </div>

        {/* Baton passed */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: 'spring' }}
          className="card-dark p-6 space-y-3"
        >
          <div className="flex items-center justify-center gap-3">
            <Zap className="w-5 h-5 text-cyan-400" />
            <span className="text-cyan-400 font-black text-lg tracking-widest">BATON PASSED</span>
            <Zap className="w-5 h-5 text-cyan-400" />
          </div>
          <p className="text-slate-300 text-sm font-mono">{info.memberMsg}</p>
          {user?.team && (
            <p className="text-slate-600 text-xs font-mono">{user.team.teamId} · {user.team.teamName}</p>
          )}
        </motion.div>

        {/* Next state */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }} className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-white font-bold text-lg tracking-widest">{info.nextLabel}</span>
          </div>
          <p className="text-slate-500 text-sm font-mono">Stay ready. The organizer will start the next phase.</p>
        </motion.div>

        {/* Waiting indicator */}
        {completedStrikeId !== 'strike3' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex items-center justify-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-cyan-500" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </div>
            <span className="text-slate-600 text-xs font-mono">Waiting for organizer</span>
          </motion.div>
        )}

        {/* Go to waiting room */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
          <button onClick={() => navigate('/participant/waiting')} className="btn-ghost flex items-center gap-2 mx-auto">
            Go to Waiting Room <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
