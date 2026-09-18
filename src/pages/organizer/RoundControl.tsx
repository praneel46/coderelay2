// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// RoundControl — the organizer's primary competition control page
// ============================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Play,
  Square,
  Pause,
  PlayCircle,
  Lock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Timer,
  X,
} from 'lucide-react';
import OrganizerLayout from '../../components/layout/OrganizerLayout';
import { useCompetition } from '../../context/CompetitionContext';
import { STRIKE_CONFIGS, STRIKE_ORDER, type StrikeId } from '../../types/competition-state';

// ----------------------------------------------------------------
// Countdown timer hook
// ----------------------------------------------------------------
function useCountdown(endsAt: string | null): { h: string; m: string; s: string; expired: boolean } {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endsAt) { setRemaining(0); return; }
    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const h = String(Math.floor(remaining / 3600)).padStart(2, '0');
  const m = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  return { h, m, s, expired: remaining === 0 && !!endsAt };
}

// ----------------------------------------------------------------
// Confirmation dialog
// ----------------------------------------------------------------
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ open, title, message, confirmLabel, confirmClass = 'btn-danger', onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 bg-dark-800 border border-red-700/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
      >
        <button onClick={onCancel} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <p className="text-slate-300 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-ghost flex-1 text-center">
            Cancel
          </button>
          <button onClick={onConfirm} className={`${confirmClass} flex-1`}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ----------------------------------------------------------------
// Strike card
// ----------------------------------------------------------------
interface StrikeCardProps {
  strikeId: StrikeId;
  isActive: boolean;
  isComplete: boolean;
  isNext: boolean;
  canStart: boolean;
  endsAt: string | null;
  startedAt: string | null;
  onStart: (id: StrikeId) => void;
  onEnd: (id: StrikeId) => void;
}

function StrikeCard({
  strikeId, isActive, isComplete, isNext, canStart, endsAt, startedAt, onStart, onEnd,
}: StrikeCardProps) {
  const cfg = STRIKE_CONFIGS[strikeId];
  const { h, m, s, expired } = useCountdown(isActive ? endsAt : null);

  const durationMins = Math.floor(cfg.durationSeconds / 60);

  const statusBorder = isComplete
    ? 'border-green-700/40'
    : isActive
    ? 'border-indigo-500/50'
    : isNext
    ? 'border-yellow-700/30'
    : 'border-dark-600';

  const statusBg = isComplete
    ? 'bg-green-900/5'
    : isActive
    ? 'bg-indigo-900/10'
    : 'bg-dark-800';

  return (
    <div className={`rounded-xl border ${statusBorder} ${statusBg} p-5`}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-black text-white tracking-wider">{cfg.label}</span>
            <span className="text-xs font-mono text-slate-500 bg-dark-700 px-2 py-0.5 rounded">
              {cfg.subLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono">
            Duration: {durationMins} min · Members:{' '}
            {cfg.activeMembers.map((m: number) => `M${m}`).join(', ')}
          </p>
        </div>
        {/* Status badge */}
        {isComplete && (
          <span className="flex items-center gap-1 bg-green-900/30 border border-green-600/40 text-green-400 text-xs font-mono px-3 py-1 rounded-full uppercase">
            <CheckCircle2 className="w-3 h-3" />
            Complete
          </span>
        )}
        {isActive && (
          <span className="flex items-center gap-1 bg-indigo-900/30 border border-indigo-500/50 text-indigo-300 text-xs font-mono px-3 py-1 rounded-full uppercase animate-pulse">
            <Zap className="w-3 h-3" />
            Active
          </span>
        )}
        {!isActive && !isComplete && isNext && (
          <span className="flex items-center gap-1 bg-yellow-900/20 border border-yellow-700/30 text-yellow-400 text-xs font-mono px-3 py-1 rounded-full uppercase">
            <Timer className="w-3 h-3" />
            Next
          </span>
        )}
        {!isActive && !isComplete && !isNext && (
          <span className="badge-unanswered">Not Started</span>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-dark-700 my-4" />

      {/* Active state: timer + end button */}
      {isActive && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-1">
              Time Remaining
            </p>
            <div className={`text-3xl font-black font-mono ${expired ? 'text-red-400' : 'text-cyan-400'}`}>
              {h}:{m}:{s}
            </div>
            {expired && (
              <p className="text-xs text-red-400 font-mono mt-1">Timer expired — end strike manually</p>
            )}
          </div>
          <button
            onClick={() => onEnd(strikeId)}
            className="btn-danger flex items-center gap-2"
          >
            <Square className="w-4 h-4" />
            END {cfg.label}
          </button>
        </div>
      )}

      {/* Complete state: show timestamp */}
      {isComplete && startedAt && (
        <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          Completed · Started at{' '}
          {new Date(startedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Next: start button with warning */}
      {!isActive && !isComplete && canStart && (
        <div>
          <div className="flex items-center gap-2 bg-yellow-900/10 border border-yellow-700/20 rounded-lg px-4 py-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <p className="text-yellow-300 text-xs font-mono">
              This action starts the timer for <strong>ALL participants</strong>. Ensure everyone is ready.
            </p>
          </div>
          <button
            onClick={() => onStart(strikeId)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Play className="w-4 h-4" />
            START {cfg.label}
          </button>
        </div>
      )}

      {/* Waiting — not yet unlocked */}
      {!isActive && !isComplete && !canStart && (
        <p className="text-slate-600 text-xs font-mono">
          Complete the previous strike to unlock this.
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------
export default function RoundControl() {
  const {
    competitionState,
    organizerStartStrike,
    organizerEndStrike,
    organizerPauseStrike,
    organizerResumeStrike,
    organizerEmergencyLock,
    organizerResetRound,
  } = useCompetition();

  const { phase, currentStrikeId, completedStrikes, globalLock, activeStrike } = competitionState;

  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmEmergency, setConfirmEmergency] = useState(false);

  // Determine which strikes are startable
  function canStart(strikeId: StrikeId): boolean {
    const idx = STRIKE_ORDER.indexOf(strikeId);
    if (completedStrikes.includes(strikeId)) return false;
    if (currentStrikeId === strikeId && phase === 'active') return false;
    if (idx === 0) return phase === 'waiting' || phase === 'complete';
    // For strike2: strike1 must be complete
    // For strike3: strike2 must be complete
    const prevStrike = STRIKE_ORDER[idx - 1];
    return completedStrikes.includes(prevStrike) && phase !== 'active';
  }

  function isNext(strikeId: StrikeId): boolean {
    if (completedStrikes.includes(strikeId)) return false;
    if (currentStrikeId === strikeId && phase === 'active') return false;
    const idx = STRIKE_ORDER.indexOf(strikeId);
    if (idx === 0) return !completedStrikes.includes('strike1');
    return completedStrikes.includes(STRIKE_ORDER[idx - 1]) && !completedStrikes.includes(strikeId);
  }

  const isLocked = globalLock;

  return (
    <OrganizerLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white tracking-wider mb-1">
            ROUND CONTROL
          </h1>
          <p className="text-slate-500 text-sm font-mono">
            Manually advance strikes · Monitor competition state · Emergency controls
          </p>
        </div>

        {/* Current State Banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={[
            'mb-8 rounded-xl border p-5',
            globalLock
              ? 'bg-red-900/10 border-red-700/40'
              : phase === 'active'
              ? 'bg-indigo-900/10 border-indigo-500/30'
              : phase === 'finished'
              ? 'bg-green-900/10 border-green-700/30'
              : 'bg-dark-800 border-dark-600',
          ].join(' ')}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-2">
                Current State
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={[
                    'text-2xl font-black tracking-widest',
                    phase === 'active' ? 'text-indigo-300' :
                    phase === 'finished' ? 'text-green-300' :
                    phase === 'complete' ? 'text-yellow-300' : 'text-slate-300',
                  ].join(' ')}
                >
                  {phase.toUpperCase()}
                </span>
                {currentStrikeId && (
                  <span className="text-base font-mono text-slate-400">
                    · {STRIKE_CONFIGS[currentStrikeId].label} ({STRIKE_CONFIGS[currentStrikeId].subLabel})
                  </span>
                )}
              </div>
            </div>
            {globalLock && (
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-600/40 px-4 py-2 rounded-lg">
                <Lock className="w-5 h-5 text-red-400" />
                <span className="text-red-300 font-mono text-sm font-bold">GLOBAL LOCK ON</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* ---- Strike Cards ---- */}
        <div className="space-y-4 mb-8">
          <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest">
            Strike Progression
          </h2>
          {STRIKE_ORDER.map((strikeId) => (
            <motion.div
              key={strikeId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <StrikeCard
                strikeId={strikeId}
                isActive={currentStrikeId === strikeId && phase === 'active'}
                isComplete={completedStrikes.includes(strikeId)}
                isNext={isNext(strikeId)}
                canStart={canStart(strikeId)}
                endsAt={activeStrike?.endsAt ?? null}
                startedAt={activeStrike?.startedAt ?? null}
                onStart={organizerStartStrike}
                onEnd={organizerEndStrike}
              />
            </motion.div>
          ))}
        </div>

        {/* ---- Additional Controls ---- */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 space-y-6">
          <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest">
            Additional Controls
          </h2>

          {/* Pause / Resume */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-dark-700">
            <div>
              <p className="text-sm font-semibold text-white mb-1">
                {isLocked ? 'Resume Strike' : 'Pause Strike'}
              </p>
              <p className="text-xs text-slate-500 font-mono">
                {isLocked
                  ? 'Remove global lock and allow submissions.'
                  : 'Apply global lock to freeze all participant submissions.'}
              </p>
            </div>
            <button
              onClick={isLocked ? organizerResumeStrike : organizerPauseStrike}
              className={isLocked ? 'btn-primary flex items-center gap-2' : 'btn-ghost flex items-center gap-2'}
            >
              {isLocked ? (
                <>
                  <PlayCircle className="w-4 h-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              )}
            </button>
          </div>

          {/* Emergency Lock */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-dark-700">
            <div>
              <p className="text-sm font-semibold text-red-300 mb-1 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Emergency Lock
              </p>
              <p className="text-xs text-slate-500 font-mono">
                Immediately locks all submissions and ends the current strike.
              </p>
            </div>
            <button
              onClick={() => setConfirmEmergency(true)}
              className="btn-danger flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Emergency Lock
            </button>
          </div>

          {/* Reset Round */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-400 mb-1 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Reset Entire Round
              </p>
              <p className="text-xs text-slate-500 font-mono">
                Clears all submissions, resets state to waiting. <strong className="text-red-400">Irreversible.</strong>
              </p>
            </div>
            <button
              onClick={() => setConfirmReset(true)}
              className="btn-danger flex items-center gap-2 bg-red-800 hover:bg-red-700"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Round
            </button>
          </div>
        </div>
      </div>

      {/* ---- Confirmation dialogs ---- */}
      <AnimatePresence>
        {confirmEmergency && (
          <ConfirmDialog
            open
            title="Emergency Lock"
            message="This will immediately lock ALL participant submissions and end the current strike. This action cannot be undone. Are you sure?"
            confirmLabel="Yes, Emergency Lock"
            confirmClass="btn-danger"
            onConfirm={() => { organizerEmergencyLock(); setConfirmEmergency(false); }}
            onCancel={() => setConfirmEmergency(false)}
          />
        )}
        {confirmReset && (
          <ConfirmDialog
            open
            title="Reset Entire Round"
            message="This will delete ALL submissions and reset the competition state back to the beginning. This action is IRREVERSIBLE. Are you absolutely sure?"
            confirmLabel="Yes, Reset Everything"
            confirmClass="btn-danger"
            onConfirm={() => { organizerResetRound(); setConfirmReset(false); }}
            onCancel={() => setConfirmReset(false)}
          />
        )}
      </AnimatePresence>
    </OrganizerLayout>
  );
}
