import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, ChevronLeft, ChevronRight, AlertTriangle, Zap, LogOut, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompetition } from '../../context/CompetitionContext';
import { useTimer } from '../../hooks/useTimer';
import { MOCK_STRIKE3_QUESTIONS, MOCK_STRIKE2_QUESTIONS } from '../../data/mock-questions';
import CodeQuestion from '../../components/competition/CodeQuestion';
import DebugQuestion from '../../components/competition/DebugQuestion';
import StrikeCountdownOverlay from '../../components/competition/StrikeCountdownOverlay';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { AntiCheatModal } from '../../components/competition/AntiCheatModal';

function TimerBar({ endsAt, totalSeconds, onExpired }: { endsAt?: string | null; totalSeconds: number; onExpired: () => void }) {
  const { displayTime, timerState, progress } = useTimer(endsAt, totalSeconds, onExpired);
  const colorClass = timerState === 'timeup' ? 'timer-timeup' : timerState === 'warning' ? 'timer-warning' : 'timer-normal';
  const barColor = timerState === 'timeup' ? 'bg-red-500' : timerState === 'warning' ? 'bg-yellow-500' : 'bg-purple-500';
  return (
    <div className="flex items-center gap-3">
      <Clock className={`w-4 h-4 ${colorClass}`} />
      <span className={`text-lg font-mono font-bold tabular-nums ${colorClass}`}>{displayTime}</span>
      <div className="w-24 h-1.5 bg-dark-700 rounded-full overflow-hidden hidden sm:block">
        <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

type Section = 'code' | 'debug';

export default function Strike3() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { competitionState, submitAnswer, isQuestionLocked, getSubmission, onStrikeTimerExpired, carryForward } = useCompetition();
  const { phase, currentStrikeId, activeStrike } = competitionState;
  const [section, setSection] = useState<Section>('code');
  const [codeIdx, setCodeIdx] = useState(0);
  const [timerExpired, setTimerExpired] = useState(false);

  useEffect(() => {
    if (phase === 'complete' && competitionState.completedStrikes.includes('strike3')) {
      navigate('/participant/round-complete', { replace: true });
    } else if (phase !== 'active' || currentStrikeId !== 'strike3') {
      navigate('/participant/waiting', { replace: true });
    }
  }, [phase, currentStrikeId, competitionState.completedStrikes, navigate]);

  const handleTimerExpired = useCallback(() => {
    setTimerExpired(true);
    onStrikeTimerExpired();
    navigate('/participant/round-complete');
  }, [onStrikeTimerExpired, navigate]);

  const codeQuestions = MOCK_STRIKE3_QUESTIONS;
  // Only carried-forward DEBUG questions (not yet submitted)
  const carriedDebugIds = carryForward.debugQuestionIds;
  const carriedDebugQuestions = MOCK_STRIKE2_QUESTIONS.filter((q) => carriedDebugIds.includes(q.id));
  const hasCarriedDebug = carriedDebugQuestions.length > 0;

  const activeCodeQ = codeQuestions[codeIdx];

  const handleCodeSubmit = (code: string) => {
    if (!activeCodeQ || !user?.team) return;
    submitAnswer({ questionId: activeCodeQ.id, teamId: user.team.teamId, strikeId: 'strike3', answer: code, status: 'submitted' });
  };

  const handleDebugSubmit = (questionId: string) => (code: string) => {
    if (!user?.team) return;
    submitAnswer({
      questionId,
      teamId: user.team.teamId,
      strikeId: 'strike3',
      answer: code,
      status: 'submitted',
      isCarriedForward: true,
    });
  };

  const codeSubmittedIds = new Set(codeQuestions.filter((q) => getSubmission(q.id)?.status === 'submitted').map((q) => q.id));

  const handleAutoSubmit = useCallback(() => {
    handleTimerExpired();
  }, [handleTimerExpired]);

  const {
    warningCount,
    activeViolation,
    isLockedOut,
    dismissModal,
  } = useAntiCheat({
    enabled: phase === 'active' && currentStrikeId === 'strike3',
    teamId: user?.team?.teamId || '',
    strikeId: 'strike3',
    onAutoSubmit: handleAutoSubmit,
  });

  const [showCountdown, setShowCountdown] = useState(() => {
    if (!activeStrike?.startedAt) return false;
    const diff = (Date.now() - new Date(activeStrike.startedAt).getTime()) / 1000;
    return diff < 6;
  });

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Anti-Cheat Warning Modal */}
      <AntiCheatModal
        violation={activeViolation}
        warningCount={warningCount}
        isLockedOut={isLockedOut}
        onDismiss={dismissModal}
      />

      {/* 5-second countdown banner on strike start */}
      {showCountdown && (
        <StrikeCountdownOverlay
          strikeId="strike3"
          durationSeconds={5}
          onComplete={() => setShowCountdown(false)}
        />
      )}

      {/* Header */}
      <header className="border-b border-purple-900/50 bg-dark-900/90 backdrop-blur-sm px-4 sm:px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-white font-black text-sm tracking-tight hidden sm:block">VIGYANTRA <span className="text-purple-400">2026</span></span>
              <span className="text-xs font-mono text-purple-300 bg-purple-900/30 border border-purple-500/50 px-2 py-0.5 rounded uppercase tracking-wider">STRIKE 3</span>
              <span className="text-xs font-mono text-purple-300 bg-purple-900/30 border border-purple-500/50 px-2 py-0.5 rounded uppercase tracking-wider">CODE</span>
              <span className="text-xs font-mono text-slate-400 bg-dark-800 border border-dark-600 px-2 py-0.5 rounded flex items-center gap-1">
                <Users className="w-3 h-3" /> FULL TEAM
              </span>
            </div>
            {user?.team && <p className="text-slate-500 text-xs font-mono mt-0.5">{user.team.teamId} · {user.team.teamName}</p>}
          </div>
          <div className="flex items-center gap-4">
            <TimerBar endsAt={activeStrike?.endsAt} totalSeconds={20 * 60} onExpired={handleTimerExpired} />
            <button onClick={() => { logout(); navigate('/participant/login', { replace: true }); }} className="btn-ghost p-2" aria-label="Logout"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-white font-black text-2xl tracking-wide">STRIKE 3 — <span className="text-purple-400">CODE</span></h1>
          <p className="text-slate-500 text-sm font-mono mt-1">Full team active · All 3 members · 20 minutes</p>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-2 border-b border-dark-700 pb-3">
          <button onClick={() => setSection('code')} className={`px-4 py-2 rounded-t-lg font-mono text-sm font-semibold transition-all border-b-2 ${section === 'code' ? 'border-purple-500 text-purple-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            Code Challenges ({codeQuestions.length})
          </button>
          {hasCarriedDebug && (
            <button onClick={() => setSection('debug')} className={`px-4 py-2 rounded-t-lg font-mono text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${section === 'debug' ? 'border-yellow-500 text-yellow-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
              Carried Debug ({carriedDebugQuestions.length})
            </button>
          )}
        </div>

        {/* Code section */}
        {section === 'code' && (
          <div className="space-y-5">
            {/* Q nav */}
            <div className="flex items-center gap-2 flex-wrap">
              {codeQuestions.map((q, i) => {
                const submitted = codeSubmittedIds.has(q.id);
                return (
                  <button key={q.id} onClick={() => setCodeIdx(i)}
                    className={`relative px-3 py-1.5 rounded-lg font-mono text-sm font-semibold border transition-all ${i === codeIdx ? 'bg-purple-500/20 border-purple-500 text-purple-300' : submitted ? 'bg-green-900/20 border-green-500/50 text-green-400' : 'bg-dark-800 border-dark-600 text-slate-400 hover:border-slate-500'}`}>
                    C{q.index}
                    {submitted && <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-dark-950" />}
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={activeCodeQ?.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                {activeCodeQ && (
                  <CodeQuestion
                    question={activeCodeQ}
                    submission={getSubmission(activeCodeQ.id)}
                    onSubmit={handleCodeSubmit}
                    isLocked={isQuestionLocked(activeCodeQ.id) || timerExpired}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between">
              <button onClick={() => setCodeIdx((i) => Math.max(0, i - 1))} disabled={codeIdx === 0} className="btn-ghost flex items-center gap-2 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /> Previous</button>
              <span className="text-slate-600 text-sm font-mono">{codeIdx + 1} / {codeQuestions.length}</span>
              <button onClick={() => setCodeIdx((i) => Math.min(codeQuestions.length - 1, i + 1))} disabled={codeIdx === codeQuestions.length - 1} className="btn-ghost flex items-center gap-2 disabled:opacity-30">Next <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {/* Carried debug section */}
        {section === 'debug' && hasCarriedDebug && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-yellow-900/20 border border-yellow-700/40 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <p className="text-yellow-300 text-sm font-mono">These debug questions were not submitted during Strike 2. Complete them now.</p>
            </div>
            {carriedDebugQuestions.map((q) => (
              <DebugQuestion
                key={q.id}
                question={q}
                submission={getSubmission(q.id)}
                onSubmit={handleDebugSubmit(q.id)}
                isLocked={isQuestionLocked(q.id) || timerExpired}
                isCarriedForward={true}
              />
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="card-dark p-4 flex items-center gap-4 flex-wrap">
          <span className="text-slate-500 text-xs font-mono tracking-widest uppercase">Code Progress:</span>
          {codeQuestions.map((q) => {
            const submitted = getSubmission(q.id)?.status === 'submitted';
            return (
              <div key={q.id} className={`flex items-center gap-1.5 text-xs font-mono ${submitted ? 'text-green-400' : 'text-slate-600'}`}>
                {submitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-dark-500" />}
                C{q.index}
              </div>
            );
          })}
          {hasCarriedDebug && (
            <>
              <span className="text-slate-700 font-mono">|</span>
              <span className="text-slate-500 text-xs font-mono tracking-widest uppercase">Carried Debug:</span>
              {carriedDebugQuestions.map((q) => {
                const submitted = getSubmission(q.id)?.status === 'submitted';
                return (
                  <div key={q.id} className={`flex items-center gap-1.5 text-xs font-mono ${submitted ? 'text-green-400' : 'text-yellow-600'}`}>
                    {submitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    D{q.index}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
