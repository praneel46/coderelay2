import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, ChevronLeft, ChevronRight, AlertTriangle, Zap, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompetition } from '../../context/CompetitionContext';
import { useTimer } from '../../hooks/useTimer';
import { MOCK_STRIKE2_QUESTIONS } from '../../data/mock-questions';
import DebugQuestion from '../../components/competition/DebugQuestion';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { AntiCheatModal } from '../../components/competition/AntiCheatModal';

// Inline timer bar
function TimerBar({ endsAt, totalSeconds, onExpired }: { endsAt?: string | null; totalSeconds: number; onExpired: () => void }) {
  const { displayTime, timerState, progress } = useTimer(endsAt, totalSeconds, onExpired);

  if (!endsAt) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
        <span className="text-xs font-mono font-bold tracking-wide text-amber-400">
          WAITING FOR OFFICIAL TIMER
        </span>
      </div>
    );
  }
  const colorClass = timerState === 'timeup' ? 'timer-timeup' : timerState === 'warning' ? 'timer-warning' : 'timer-normal';
  const barColor = timerState === 'timeup' ? 'bg-red-500' : timerState === 'warning' ? 'bg-yellow-500' : 'bg-indigo-500';
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

// Question nav
function QNav({ questions, activeIndex, onSelect, submittedIds }: { questions: typeof MOCK_STRIKE2_QUESTIONS; activeIndex: number; onSelect: (i: number) => void; submittedIds: Set<string> }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {questions.map((q, i) => {
        const submitted = submittedIds.has(q.id);
        const active = i === activeIndex;
        return (
          <button key={q.id} onClick={() => onSelect(i)}
            className={`relative px-3 py-1.5 rounded-lg font-mono text-sm font-semibold transition-all duration-150 border ${active ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : submitted ? 'bg-green-900/20 border-green-500/50 text-green-400' : 'bg-dark-800 border-dark-600 text-slate-400 hover:border-slate-500'}`}>
            D{q.index}
            {submitted && <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-dark-950" />}
          </button>
        );
      })}
    </div>
  );
}

export default function Strike2() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    competitionState,
    teamTimerDoc,
    submitAnswer,
    submitStrikeEarly,
    isStrikeCompleted,
    isQuestionLocked,
    getSubmission,
    onStrikeTimerExpired,
  } = useCompetition();
  const { phase, currentStrikeId, activeStrike } = competitionState;
  const teamId = user?.team?.teamId;
  const [activeIdx, setActiveIdx] = useState(0);
  const [timerExpired, setTimerExpired] = useState(false);
  const [showEarlySubmitConfirm, setShowEarlySubmitConfirm] = useState(false);

  // Authoritative independent Strike 2 timer resolution
  const teamStrikeTimer = teamTimerDoc?.strike2 || (teamId ? competitionState.teamTimers?.[teamId]?.strike2 : undefined);
  const [effectiveEndsAt, setEffectiveEndsAt] = useState<string | null>(() => {
    // Priority A: Team-specific timer from Firestore if valid and in future
    if (teamStrikeTimer?.endsAt && new Date(teamStrikeTimer.endsAt).getTime() > Date.now()) {
      return teamStrikeTimer.endsAt;
    }
    // Priority B: Global activeStrike if valid and in future
    if (activeStrike?.strikeId === 'strike2' && activeStrike.endsAt && new Date(activeStrike.endsAt).getTime() > Date.now()) {
      return activeStrike.endsAt;
    }
    // Priority C: Check sessionStorage for this team's Strike 2 timer
    if (teamId) {
      try {
        const storedEnds = sessionStorage.getItem(`vr2_strike_strike2_ends_${teamId}`);
        if (storedEnds && new Date(storedEnds).getTime() > Date.now()) {
          return storedEnds;
        }
      } catch {}
    }
    return null;
  });

  // Sync effectiveEndsAt whenever fresh authoritative timer is delivered
  useEffect(() => {
    if (teamStrikeTimer?.endsAt && new Date(teamStrikeTimer.endsAt).getTime() > Date.now()) {
      setEffectiveEndsAt(teamStrikeTimer.endsAt);
      if (teamId) {
        try { sessionStorage.setItem(`vr2_strike_strike2_ends_${teamId}`, teamStrikeTimer.endsAt); } catch {}
      }
    } else if (activeStrike?.strikeId === 'strike2' && activeStrike.endsAt && new Date(activeStrike.endsAt).getTime() > Date.now()) {
      setEffectiveEndsAt(activeStrike.endsAt);
      if (teamId) {
        try { sessionStorage.setItem(`vr2_strike_strike2_ends_${teamId}`, activeStrike.endsAt); } catch {}
      }
    }
  }, [teamStrikeTimer?.endsAt, activeStrike?.endsAt, activeStrike?.strikeId, teamId]);

  useEffect(() => {
    if (isStrikeCompleted('strike2')) {
      navigate('/participant/strike-complete', { state: { completedStrikeId: 'strike2' }, replace: true });
      return;
    }
    if (phase === 'complete' && competitionState.completedStrikes.includes('strike2')) {
      navigate('/participant/strike-complete', { state: { completedStrikeId: 'strike2' }, replace: true });
    } else if (phase !== 'active' || currentStrikeId !== 'strike2') {
      navigate('/participant/waiting', { replace: true });
    }
  }, [phase, currentStrikeId, competitionState.completedStrikes, isStrikeCompleted, navigate]);

  const handleTimerExpired = useCallback(async () => {
    setTimerExpired(true);
    await submitStrikeEarly('strike2');
    onStrikeTimerExpired();
    navigate('/participant/strike-complete', { state: { completedStrikeId: 'strike2' } });
  }, [onStrikeTimerExpired, submitStrikeEarly, navigate]);

  const handleEarlySubmit = async () => {
    setShowEarlySubmitConfirm(false);
    await submitStrikeEarly('strike2');
    navigate('/participant/strike-complete', { state: { completedStrikeId: 'strike2' }, replace: true });
  };

  const questions = MOCK_STRIKE2_QUESTIONS;
  const activeQuestion = questions[activeIdx];
  const submittedIds = new Set(questions.filter((q) => getSubmission(q.id)?.status === 'submitted').map((q) => q.id));

  const handleSubmit = (code: string) => {
    if (!activeQuestion || !user?.team || !effectiveEndsAt) return;
    submitAnswer({ questionId: activeQuestion.id, teamId: user.team.teamId, strikeId: 'strike2', answer: code, status: 'submitted' });
  };

  const submittedCount = submittedIds.size;
  const totalQ = questions.length;

  const handleAutoSubmit = useCallback(() => {
    handleTimerExpired();
  }, [handleTimerExpired]);

  const {
    warningCount,
    activeViolation,
    isLockedOut,
    dismissModal,
  } = useAntiCheat({
    enabled: phase === 'active' && currentStrikeId === 'strike2',
    teamId: user?.team?.teamId || '',
    strikeId: 'strike2',
    onAutoSubmit: handleAutoSubmit,
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


      {/* Header */}
      <header className="border-b border-dark-700 bg-dark-900/90 backdrop-blur-sm px-4 sm:px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span className="text-white font-black text-sm tracking-tight hidden sm:block">VIGYANTRA <span className="text-indigo-400">2026</span></span>
              <span className="badge-active text-xs bg-indigo-900/30 border-indigo-500/50 text-indigo-300">STRIKE 2</span>
              <span className="badge-active text-xs bg-indigo-900/30 border-indigo-500/50 text-indigo-300">DEBUG</span>
              <span className="text-xs font-mono text-slate-600 bg-dark-800 border border-dark-600 px-2 py-0.5 rounded">M1+M2</span>
            </div>
            {user?.team && <p className="text-slate-500 text-xs font-mono mt-0.5">{user.team.teamId} · {user.team.teamName}</p>}
          </div>
          <div className="flex items-center gap-3">
            <TimerBar endsAt={effectiveEndsAt} totalSeconds={15 * 60} onExpired={handleTimerExpired} />
            <button
              onClick={() => setShowEarlySubmitConfirm(true)}
              className="btn-primary text-xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 flex items-center gap-1.5 shadow-sm"
              title="Finish Strike 2 and move to Waiting Room"
            >
              <CheckCircle2 className="w-4 h-4" />
              Submit Strike
            </button>
            <button onClick={() => { logout(); navigate('/participant/login', { replace: true }); }} className="btn-ghost p-2" aria-label="Logout"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      {/* Early Submit Confirmation Modal */}
      {showEarlySubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-800 border border-indigo-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">SUBMIT STRIKE 2?</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              You have submitted {submittedCount} of {totalQ} debug questions.
              Any unanswered debug questions will be carried forward to Strike 3.
              Submitting now will move your team to the Waiting Room for Strike 3.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEarlySubmitConfirm(false)}
                className="btn-ghost flex-1 text-center"
              >
                Cancel
              </button>
              <button
                onClick={handleEarlySubmit}
                className="btn-primary flex-1 bg-indigo-600 hover:bg-indigo-500"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Title + nav */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-white font-black text-2xl tracking-wide">STRIKE 2 — <span className="text-indigo-400">DEBUG</span></h1>
            <p className="text-slate-500 text-sm font-mono mt-1">3 debug questions · Members 1 + 2 active · 15 minutes</p>
          </div>
          <QNav questions={questions} activeIndex={activeIdx} onSelect={setActiveIdx} submittedIds={submittedIds} />
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div key={activeQuestion?.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            {activeQuestion && (
              <DebugQuestion
                question={activeQuestion}
                submission={getSubmission(activeQuestion.id)}
                onSubmit={handleSubmit}
                isLocked={isQuestionLocked(activeQuestion.id) || timerExpired || !effectiveEndsAt}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Prev/Next */}
        <div className="flex items-center justify-between">
          <button onClick={() => setActiveIdx((i) => Math.max(0, i - 1))} disabled={activeIdx === 0} className="btn-ghost flex items-center gap-2 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /> Previous</button>
          <span className="text-slate-600 text-sm font-mono">{activeIdx + 1} / {questions.length}</span>
          <button onClick={() => setActiveIdx((i) => Math.min(questions.length - 1, i + 1))} disabled={activeIdx === questions.length - 1} className="btn-ghost flex items-center gap-2 disabled:opacity-30">Next <ChevronRight className="w-4 h-4" /></button>
        </div>

        {/* Carry-forward info */}
        <div className="card-dark p-4 border-yellow-800/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 text-sm font-semibold mb-1">Carry-Forward Notice</p>
              <p className="text-slate-400 text-xs font-mono">
                Questions not submitted before time runs out will carry forward to Strike 3.
                Submitted questions will be locked: <span className="text-green-400">{submittedCount}/{totalQ} submitted.</span>
              </p>
            </div>
          </div>
        </div>

        {/* Progress summary */}
        <div className="card-dark p-4 flex items-center gap-4 flex-wrap">
          <span className="text-slate-500 text-xs font-mono tracking-widest uppercase">Progress:</span>
          {questions.map((q) => {
            const sub = getSubmission(q.id);
            const submitted = sub?.status === 'submitted';
            return (
              <div key={q.id} className={`flex items-center gap-1.5 text-xs font-mono ${submitted ? 'text-green-400' : 'text-slate-600'}`}>
                {submitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-dark-500" />}
                D{q.index}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
