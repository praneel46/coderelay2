// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Participant — Strike 1: PREDICT (5 minutes, Member 1 only)
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Lock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Zap,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompetition } from '../../context/CompetitionContext';
import { useTimer } from '../../hooks/useTimer';
import { MOCK_STRIKE1_QUESTIONS } from '../../data/mock-questions';
import StrikeCountdownOverlay from '../../components/competition/StrikeCountdownOverlay';
import type { Question, MCQOption } from '../../types/competition';

// ----------------------------------------------------------------
// Timer bar component
// ----------------------------------------------------------------
interface TimerBarProps {
  endsAt: string | null | undefined;
  totalSeconds: number;
  onExpired: () => void;
}

function TimerBar({ endsAt, totalSeconds, onExpired }: TimerBarProps) {
  const { displayTime, timerState, progress } = useTimer(endsAt, totalSeconds, onExpired);

  const colorClass =
    timerState === 'timeup'
      ? 'timer-timeup'
      : timerState === 'warning'
      ? 'timer-warning'
      : 'timer-normal';

  const barColor =
    timerState === 'timeup'
      ? 'bg-red-500'
      : timerState === 'warning'
      ? 'bg-yellow-500'
      : 'bg-cyan-500';

  return (
    <div className="flex items-center gap-3">
      <Clock className={`w-4 h-4 ${colorClass}`} />
      <span className={`text-lg font-mono font-bold tabular-nums ${colorClass}`}>
        {displayTime}
      </span>
      <div className="w-24 h-1.5 bg-dark-700 rounded-full overflow-hidden hidden sm:block">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Question navigation tabs
// ----------------------------------------------------------------
interface QuestionNavProps {
  questions: Question[];
  activeIndex: number;
  onSelect: (i: number) => void;
  submittedIds: Set<string>;
  lockedIds: Set<string>;
}

function QuestionNav({ questions, activeIndex, onSelect, submittedIds, lockedIds }: QuestionNavProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {questions.map((q, i) => {
        const isSubmitted = submittedIds.has(q.id);
        const isLocked = lockedIds.has(q.id);
        const isActive = i === activeIndex;
        return (
          <button
            key={q.id}
            onClick={() => onSelect(i)}
            className={`relative px-3 py-1.5 rounded-lg font-mono text-sm font-semibold transition-all duration-150 border ${
              isActive
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : isSubmitted
                ? 'bg-green-900/20 border-green-500/50 text-green-400'
                : isLocked
                ? 'bg-slate-800 border-slate-700 text-slate-500'
                : 'bg-dark-800 border-dark-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
            }`}
          >
            Q{q.index}
            {isSubmitted && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-dark-950" />
            )}
            {isLocked && !isSubmitted && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-slate-600 rounded-full border border-dark-950" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------
// MCQ Question card
// ----------------------------------------------------------------
interface MCQQuestionProps {
  question: Question;
  selectedOption: string | null;
  onSelect: (key: string) => void;
  onSubmit: () => void;
  isLocked: boolean;
  isSubmitted: boolean;
  isExpired: boolean;
}

function MCQQuestion({
  question,
  selectedOption,
  onSelect,
  onSubmit,
  isLocked,
  isSubmitted,
  isExpired,
}: MCQQuestionProps) {
  const effectiveLocked = isLocked || isExpired;
  const options: MCQOption[] = question.options ?? [];

  return (
    <div className="space-y-6">
      {/* Question header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span className="badge-active">Q{question.index}</span>
            <span className="text-slate-400 text-xs font-mono uppercase tracking-widest">
              {question.type}
            </span>
            {question.language && (
              <span className="text-slate-600 text-xs font-mono uppercase tracking-wider bg-dark-800 border border-dark-600 px-2 py-0.5 rounded">
                {question.language}
              </span>
            )}
            {isSubmitted && <span className="badge-submitted">Submitted</span>}
            {isLocked && !isSubmitted && !isExpired && <span className="badge-locked">Locked</span>}
            {isExpired && !isSubmitted && <span className="badge-locked">Time Up</span>}
          </div>
          <h3 className="text-white font-bold text-lg">{question.title}</h3>
        </div>
      </div>

      {/* Statement — rendered preserving newlines */}
      <div className="card-dark p-5">
        <pre className="text-slate-300 text-sm font-mono whitespace-pre-wrap leading-relaxed">
          {question.statement}
        </pre>
      </div>

      {/* Options */}
      <div className="space-y-2.5">
        {options.map((opt) => {
          const isSelected = selectedOption === opt.key;
          return (
            <button
              key={opt.key}
              disabled={effectiveLocked}
              onClick={() => !effectiveLocked && onSelect(opt.key)}
              className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border transition-all duration-150 ${
                effectiveLocked
                  ? isSelected
                    ? 'border-slate-600 bg-slate-800/50 text-slate-400 cursor-not-allowed'
                    : 'border-dark-600 bg-dark-800 text-slate-600 cursor-not-allowed'
                  : isSelected
                  ? 'border-cyan-500 bg-cyan-900/20 text-white shadow-glow-cyan'
                  : 'border-dark-600 bg-dark-800 text-slate-300 hover:border-slate-500 hover:bg-dark-700'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-lg border flex items-center justify-center font-mono font-bold text-sm flex-shrink-0 ${
                  isSelected && !effectiveLocked
                    ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                    : isSelected && effectiveLocked
                    ? 'border-slate-500 bg-slate-700/50 text-slate-400'
                    : 'border-dark-600 text-slate-500'
                }`}
              >
                {opt.key}
              </span>
              <span className="text-sm font-medium">{opt.label}</span>
              {isSelected && effectiveLocked && (
                <Lock className="w-3.5 h-3.5 text-slate-500 ml-auto flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Submit button */}
      {!effectiveLocked && (
        <div className="flex items-center gap-4 pt-2">
          <button
            disabled={!selectedOption || isSubmitted}
            onClick={onSubmit}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Submit Answer
          </button>
          {!selectedOption && (
            <p className="text-slate-600 text-xs font-mono">Select an option to submit.</p>
          )}
        </div>
      )}
      {isSubmitted && (
        <div className="flex items-center gap-2 pt-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <p className="text-green-400 text-sm font-mono">Answer submitted successfully.</p>
        </div>
      )}
      {isExpired && !isSubmitted && (
        <div className="flex items-center gap-2 pt-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <p className="text-red-400 text-sm font-mono">Time expired — submission is locked.</p>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Strike 1 Page
// ----------------------------------------------------------------
export default function Strike1() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    competitionState,
    submitAnswer,
    isQuestionLocked,
    getSubmission,
    onStrikeTimerExpired,
  } = useCompetition();

  const { phase, currentStrikeId, activeStrike } = competitionState;
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [timerExpired, setTimerExpired] = useState(false);

  // ── Guard: wrong phase → waiting room ──
  useEffect(() => {
    if (phase === 'complete' && competitionState.completedStrikes.includes('strike1')) {
      navigate('/participant/strike-complete', {
        state: { completedStrikeId: 'strike1' },
        replace: true,
      });
    } else if (phase !== 'active' || currentStrikeId !== 'strike1') {
      navigate('/participant/waiting', { replace: true });
    }
  }, [phase, currentStrikeId, competitionState.completedStrikes, navigate]);

  const handleTimerExpired = useCallback(() => {
    setTimerExpired(true);
    onStrikeTimerExpired();
    navigate('/participant/strike-complete', {
      state: { completedStrikeId: 'strike1' },
    });
  }, [onStrikeTimerExpired, navigate]);

  const questions = MOCK_STRIKE1_QUESTIONS;
  const activeQuestion = questions[activeQuestionIndex];

  const submittedIds = new Set(
    questions.filter((q) => getSubmission(q.id)?.status === 'submitted').map((q) => q.id)
  );
  const lockedIds = new Set(questions.filter((q) => isQuestionLocked(q.id)).map((q) => q.id));

  const handleSelect = (key: string) => {
    if (!timerExpired && !isQuestionLocked(activeQuestion.id)) {
      setSelections((prev) => ({ ...prev, [activeQuestion.id]: key }));
    }
  };

  const handleSubmit = () => {
    if (!activeQuestion || !selections[activeQuestion.id] || !user?.team) return;
    submitAnswer({
      questionId: activeQuestion.id,
      teamId: user.team.teamId,
      strikeId: 'strike1',
      answer: selections[activeQuestion.id],
      status: 'submitted',
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/participant/login', { replace: true });
  };

  if (!activeQuestion) return null;

  const currentSubmission = getSubmission(activeQuestion.id);
  const isCurrentLocked = isQuestionLocked(activeQuestion.id);
  const isCurrentSubmitted = currentSubmission?.status === 'submitted';

  const [showCountdown, setShowCountdown] = useState(() => {
    // Show countdown if the strike was started recently (within 6 seconds)
    if (!activeStrike?.startedAt) return false;
    const diff = (Date.now() - new Date(activeStrike.startedAt).getTime()) / 1000;
    return diff < 6;
  });

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* 5-second countdown banner on strike start */}
      {showCountdown && (
        <StrikeCountdownOverlay
          strikeId="strike1"
          durationSeconds={5}
          onComplete={() => setShowCountdown(false)}
        />
      )}

      {/* ── Header ── */}
      <header className="border-b border-dark-700 bg-dark-900/90 backdrop-blur-sm px-4 sm:px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Left: branding */}
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-black text-sm tracking-tight hidden sm:block">
                VIGYANTRA <span className="text-cyan-400">2026</span>
              </span>
              <div className="flex items-center gap-1.5 ml-1">
                <span className="badge-active text-xs">STRIKE 1</span>
                <span className="badge-active text-xs">PREDICT</span>
                <span className="text-xs font-mono text-slate-600 bg-dark-800 border border-dark-600 px-2 py-0.5 rounded">
                  M1 ACTIVE
                </span>
              </div>
            </div>
            {user?.team && (
              <p className="text-slate-500 text-xs font-mono mt-0.5">
                {user.team.teamId} · {user.team.teamName}
              </p>
            )}
          </div>

          {/* Right: timer + logout */}
          <div className="flex items-center gap-4">
            <TimerBar
              endsAt={activeStrike?.endsAt}
              totalSeconds={5 * 60}
              onExpired={handleTimerExpired}
            />
            <button
              onClick={handleLogout}
              className="btn-ghost p-2"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* ── Strike context ── */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-white font-black text-2xl tracking-wide">
              STRIKE 1 —{' '}
              <span className="text-cyan-400 text-glow-cyan">PREDICT</span>
            </h1>
            <p className="text-slate-500 text-sm font-mono mt-1">
              3 MCQ questions · Member 1 active · 5 minute timer
            </p>
          </div>
          <QuestionNav
            questions={questions}
            activeIndex={activeQuestionIndex}
            onSelect={setActiveQuestionIndex}
            submittedIds={submittedIds}
            lockedIds={lockedIds}
          />
        </div>

        {/* ── Question area ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeQuestion.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="card-dark p-6 sm:p-8"
          >
            <MCQQuestion
              question={activeQuestion}
              selectedOption={
                isCurrentSubmitted
                  ? (currentSubmission?.answer ?? null)
                  : (selections[activeQuestion.id] ?? null)
              }
              onSelect={handleSelect}
              onSubmit={handleSubmit}
              isLocked={isCurrentLocked}
              isSubmitted={isCurrentSubmitted}
              isExpired={timerExpired}
            />
          </motion.div>
        </AnimatePresence>

        {/* ── Prev / Next navigation ── */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setActiveQuestionIndex((i) => Math.max(0, i - 1))}
            disabled={activeQuestionIndex === 0}
            className="btn-ghost flex items-center gap-2 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-slate-600 text-sm font-mono">
            {activeQuestionIndex + 1} / {questions.length}
          </span>
          <button
            onClick={() =>
              setActiveQuestionIndex((i) => Math.min(questions.length - 1, i + 1))
            }
            disabled={activeQuestionIndex === questions.length - 1}
            className="btn-ghost flex items-center gap-2 disabled:opacity-30"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* ── Progress summary ── */}
        <div className="mt-6 card-dark p-4 flex items-center gap-3">
          <span className="text-slate-500 text-xs font-mono tracking-widest uppercase">
            Progress:
          </span>
          {questions.map((q) => {
            const sub = getSubmission(q.id);
            const submitted = sub?.status === 'submitted';
            return (
              <div
                key={q.id}
                className={`flex items-center gap-1.5 text-xs font-mono ${
                  submitted ? 'text-green-400' : 'text-slate-600'
                }`}
              >
                {submitted ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-dark-500" />
                )}
                Q{q.index}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
