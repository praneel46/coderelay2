import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, CheckCircle2, LogOut } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useCompetition } from '../../context/CompetitionContext';
import { MOCK_STRIKE1_QUESTIONS, MOCK_STRIKE2_QUESTIONS, MOCK_STRIKE3_QUESTIONS } from '../../data/mock-questions';

export default function RoundComplete() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { submissions } = useCompetition();

  const teamId = user?.team?.teamId ?? '';

  useEffect(() => {
    if (teamId) {
      const teamRef = doc(db, COLLECTIONS.TEAMS, teamId);
      updateDoc(teamRef, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).catch((err) => {
        console.warn('Could not auto-transition team status to COMPLETED:', err);
      });
    }
  }, [teamId]);

  const teamSubmissions = submissions.filter((s) => s.teamId === teamId);

  const s1Count = MOCK_STRIKE1_QUESTIONS.filter((q) => teamSubmissions.some((s) => s.questionId === q.id)).length;
  const s2Count = MOCK_STRIKE2_QUESTIONS.filter((q) => teamSubmissions.some((s) => s.questionId === q.id)).length;
  const s3Count = MOCK_STRIKE3_QUESTIONS.filter((q) => teamSubmissions.some((s) => s.questionId === q.id)).length;
  const totalSubmitted = s1Count + s2Count + s3Count;
  const totalQuestions = 9;

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden bg-grid-pattern">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(6,182,212,0.06) 0%, transparent 70%)' }} />

      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="w-full max-w-lg text-center space-y-8 relative z-10">
        {/* Trophy */}
        <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 180, damping: 15 }} className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-cyan-900/20 border-2 border-cyan-500/40 flex items-center justify-center shadow-glow-cyan">
            <Trophy className="w-12 h-12 text-cyan-400" />
          </div>
        </motion.div>

        <div className="space-y-2">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-slate-500 text-xs font-mono uppercase tracking-[0.3em]">VIGYANTRA 2026 · CODE RELAY</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-4xl font-black text-white tracking-wide text-glow-white">ROUND 2 COMPLETE</motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-cyan-400 font-bold text-lg tracking-widest">ALL STRIKES COMPLETE</motion.p>
        </div>

        {/* Team */}
        {user?.team && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="card-dark p-4">
            <p className="text-slate-400 text-xs font-mono uppercase tracking-wider mb-1">Team</p>
            <p className="text-white font-bold text-lg">{user.team.teamName}</p>
            <p className="text-slate-500 text-sm font-mono">{user.team.teamId}</p>
          </motion.div>
        )}

        {/* Submission summary */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="card-dark p-5 space-y-4">
          <p className="text-slate-400 text-xs font-mono uppercase tracking-widest">Submission Summary</p>
          <div className="grid grid-cols-3 gap-3">
            {[{ label: 'PREDICT', count: s1Count, total: 3, color: 'text-cyan-400' }, { label: 'DEBUG', count: s2Count, total: 3, color: 'text-indigo-400' }, { label: 'CODE', count: s3Count, total: 3, color: 'text-purple-400' }].map(({ label, count, total, color }) => (
              <div key={label} className="text-center">
                <p className={`font-black text-2xl ${color}`}>{count}<span className="text-slate-600 text-sm">/{total}</span></p>
                <p className="text-slate-500 text-xs font-mono mt-1">{label}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-dark-600 pt-3 flex items-center justify-between">
            <span className="text-slate-400 text-sm font-mono">Total Submitted</span>
            <span className="text-white font-bold font-mono">{totalSubmitted}/{totalQuestions}</span>
          </div>
        </motion.div>

        {/* Member relay */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }} className="card-dark p-4">
          <p className="text-slate-500 text-xs font-mono uppercase tracking-widest mb-3">Relay Complete</p>
          <div className="flex items-center justify-center gap-3">
            {user?.team?.members.map((m, i) => (
              <React.Fragment key={m.index}>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-green-900/30 border border-green-500/50 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-green-400 text-xs font-mono">M{m.index}</span>
                </div>
                {i < 2 && <div className="w-8 h-px bg-green-500/30" />}
              </React.Fragment>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}>
          <p className="text-slate-500 text-sm font-mono mb-6">Thank you for participating. Results will be announced shortly.</p>
          <button onClick={() => { logout(); navigate('/participant/login', { replace: true }); }} className="btn-ghost flex items-center gap-2 mx-auto">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
