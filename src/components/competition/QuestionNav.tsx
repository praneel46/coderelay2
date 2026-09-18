// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// QuestionNav component — horizontal scrollable question navigator
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ArrowRight, Lock, Loader2 } from 'lucide-react';
import type { Submission, SubmissionStatus } from '../../types/competition';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
interface QuestionNavItem {
  id: string;
  index: number;
  type: string;
}

interface QuestionNavProps {
  questions: QuestionNavItem[];
  submissions: Submission[];
  activeQuestionId?: string;
  onSelect: (id: string) => void;
  isLocked?: boolean;
  carriedForwardIds?: string[];
}

// ----------------------------------------------------------------
// Derive effective status for a question
// ----------------------------------------------------------------
function getEffectiveStatus(
  questionId: string,
  submissions: Submission[],
  carriedForwardIds: string[]
): SubmissionStatus {
  if (carriedForwardIds.includes(questionId)) return 'carried_forward';
  const sub = submissions.find((s) => s.questionId === questionId);
  return sub?.status ?? 'unanswered';
}

// ----------------------------------------------------------------
// Status icon
// ----------------------------------------------------------------
const StatusIcon: React.FC<{ status: SubmissionStatus }> = ({ status }) => {
  switch (status) {
    case 'submitted':
    case 'locked':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />;
    case 'carried_forward':
      return <ArrowRight className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />;
    case 'in_progress':
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
        </motion.div>
      );
    default:
      return <Circle className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />;
  }
};

// ----------------------------------------------------------------
// Button styles per status + active state
// ----------------------------------------------------------------
function getButtonClass(
  status: SubmissionStatus,
  isActive: boolean,
  isLocked: boolean
): string {
  const base =
    'relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex-shrink-0 min-w-[52px] focus-ring';

  if (isLocked) {
    return `${base} bg-slate-800/50 border border-slate-700/50 text-slate-500 cursor-not-allowed`;
  }

  if (isActive) {
    return `${base} bg-cyan-950/60 border-2 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.25)]`;
  }

  switch (status) {
    case 'submitted':
    case 'locked':
      return `${base} bg-green-950/40 border border-green-400/40 text-green-300 hover:border-green-400/70`;
    case 'carried_forward':
      return `${base} bg-yellow-950/40 border border-yellow-400/40 text-yellow-300 hover:border-yellow-400/70`;
    case 'in_progress':
      return `${base} bg-cyan-950/30 border border-cyan-400/30 text-cyan-400 hover:border-cyan-400/60`;
    default:
      return `${base} bg-slate-800/40 border border-slate-700/40 text-slate-400 hover:border-slate-500 hover:text-slate-300`;
  }
}

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------
export const QuestionNav: React.FC<QuestionNavProps> = ({
  questions,
  submissions,
  activeQuestionId,
  onSelect,
  isLocked = false,
  carriedForwardIds = [],
}) => {
  return (
    <div className="w-full">
      {/* Scroll container */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
        role="tablist"
        aria-label="Question navigation"
      >
        {questions.map((q) => {
          const status = getEffectiveStatus(q.id, submissions, carriedForwardIds);
          const isActive = q.id === activeQuestionId;

          return (
            <motion.button
              key={q.id}
              role="tab"
              aria-selected={isActive}
              aria-label={`Question ${q.index} — ${status}`}
              whileTap={{ scale: 0.93 }}
              onClick={() => !isLocked && onSelect(q.id)}
              className={getButtonClass(status, isActive, isLocked && !isActive)}
              disabled={isLocked && !isActive}
            >
              {/* Active indicator bar */}
              {isActive && (
                <motion.div
                  layoutId="active-q-bar"
                  className="absolute -bottom-px left-2 right-2 h-0.5 bg-cyan-400 rounded-full"
                  style={{ boxShadow: '0 0 6px rgba(34,211,238,0.7)' }}
                />
              )}

              {/* Lock overlay badge */}
              {isLocked && (
                <Lock className="absolute top-1 right-1 w-2.5 h-2.5 text-slate-600" />
              )}

              {/* Question number */}
              <span className="font-black text-sm leading-none">Q{q.index}</span>

              {/* Status icon */}
              <StatusIcon status={status} />
            </motion.button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        <LegendItem icon={<Circle className="w-3 h-3 text-slate-500" />} label="Unanswered" />
        <LegendItem
          icon={<Loader2 className="w-3 h-3 text-cyan-400" />}
          label="In Progress"
        />
        <LegendItem
          icon={<CheckCircle2 className="w-3 h-3 text-green-400" />}
          label="Submitted"
        />
        <LegendItem
          icon={<ArrowRight className="w-3 h-3 text-yellow-400" />}
          label="Carried Forward"
        />
      </div>
    </div>
  );
};

// ----------------------------------------------------------------
// Legend item
// ----------------------------------------------------------------
const LegendItem: React.FC<{ icon: React.ReactNode; label: string }> = ({
  icon,
  label,
}) => (
  <div className="flex items-center gap-1 text-[10px] text-slate-500">
    {icon}
    <span>{label}</span>
  </div>
);

export default QuestionNav;
