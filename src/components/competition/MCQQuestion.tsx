// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// MCQQuestion component — Strike 1 predict question card
// ============================================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Lock, Send } from 'lucide-react';
import type { Question, Submission } from '../../types/competition';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
interface MCQQuestionProps {
  question: Question;
  submission?: Submission;
  onSubmit: (answer: string) => void;
  isLocked: boolean;
  isActive: boolean;
}

// ----------------------------------------------------------------
// Option key type
// ----------------------------------------------------------------
type OptionKey = 'A' | 'B' | 'C' | 'D';

// ----------------------------------------------------------------
// Option button styles
// ----------------------------------------------------------------
function getOptionClass(
  key: OptionKey,
  selectedKey: OptionKey | null,
  submittedKey: OptionKey | null,
  isLocked: boolean
): string {
  const base =
    'w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 focus-ring disabled:cursor-not-allowed';

  if (isLocked || submittedKey !== null) {
    if (key === submittedKey) {
      return `${base} bg-green-950/40 border-green-400/50 text-green-300 cursor-default`;
    }
    return `${base} bg-slate-800/30 border-slate-700/30 text-slate-500 cursor-default`;
  }

  if (key === selectedKey) {
    return `${base} bg-cyan-950/60 border-cyan-400 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.2)]`;
  }

  return `${base} bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800/60 hover:border-slate-600 hover:text-slate-100`;
}

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------
export const MCQQuestion: React.FC<MCQQuestionProps> = ({
  question,
  submission,
  onSubmit,
  isLocked,
  isActive,
}) => {
  const submittedKey = (submission?.answer ?? null) as OptionKey | null;
  const isSubmitted = submission?.status === 'submitted' || submission?.status === 'locked';

  const [selectedKey, setSelectedKey] = useState<OptionKey | null>(
    submittedKey
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const options = question.options ?? [];

  const handleSelect = (key: OptionKey) => {
    if (isLocked || isSubmitted) return;
    setSelectedKey(key);
  };

  const handleSubmit = async () => {
    if (!selectedKey || isLocked || isSubmitted || isSubmitting) return;
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 120)); // micro-delay for animation feel
    onSubmit(selectedKey);
    setIsSubmitting(false);
  };

  const effectiveLocked = isLocked || isSubmitted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`card-dark rounded-2xl border transition-colors duration-500 ${
        isSubmitted
          ? 'border-green-400/40 shadow-[0_0_20px_rgba(74,222,128,0.08)]'
          : isLocked
          ? 'border-slate-700/50'
          : isActive
          ? 'border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.06)]'
          : 'border-slate-800/60'
      }`}
    >
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between gap-3 p-4 sm:p-6 pb-0">
        {/* Index badge + title */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-xs font-black text-cyan-400">
            Q{question.index}
          </span>
          <h3 className="text-slate-100 font-bold text-base sm:text-lg leading-tight truncate">
            {question.title}
          </h3>
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0">
          <AnimatePresence mode="wait">
            {isSubmitted ? (
              <motion.span
                key="submitted"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="badge-submitted flex items-center gap-1 text-[10px] font-black tracking-wider"
              >
                <CheckCircle2 className="w-3 h-3" />
                SUBMITTED
              </motion.span>
            ) : isLocked ? (
              <motion.span
                key="locked"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="badge-locked flex items-center gap-1 text-[10px] font-black tracking-wider"
              >
                <Lock className="w-3 h-3" />
                LOCKED
              </motion.span>
            ) : (
              <motion.span
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="badge-active text-[10px] font-black tracking-wider"
              >
                MCQ
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ---- Statement ---- */}
      <div className="px-4 sm:px-6 pt-4">
        <pre className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-slate-900/50 border border-slate-800/60 rounded-xl p-4 overflow-x-auto">
          {question.statement}
        </pre>
      </div>

      {/* ---- Options ---- */}
      <div className="px-4 sm:px-6 pt-4 pb-4 space-y-2.5">
        {options.map((opt) => (
          <button
            key={opt.key}
            onClick={() => handleSelect(opt.key)}
            disabled={effectiveLocked}
            className={getOptionClass(
              opt.key,
              selectedKey,
              isSubmitted ? submittedKey : null,
              isLocked
            )}
          >
            {/* Key circle */}
            <span
              className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-black transition-colors duration-200 ${
                opt.key === selectedKey && !isSubmitted
                  ? 'bg-cyan-400 border-cyan-400 text-slate-900'
                  : isSubmitted && opt.key === submittedKey
                  ? 'bg-green-400 border-green-400 text-slate-900'
                  : 'border-current'
              }`}
            >
              {opt.key}
            </span>
            <span className="text-sm leading-snug">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* ---- Submit button ---- */}
      {!isSubmitted && !isLocked && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            disabled={!selectedKey || isSubmitting}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-slate-900/40 border-t-slate-900 rounded-full"
                />
                Submitting…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Answer
              </>
            )}
          </motion.button>
        </div>
      )}

      {/* Submitted + locked state footer */}
      {isSubmitted && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-950/30 border border-green-400/30">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-green-300 text-sm font-semibold">
              Answer submitted — option {submittedKey} locked in.
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MCQQuestion;
