// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// RelayStatus component — baton-passing visual between 3 members
// ============================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Zap } from 'lucide-react';
import type { MemberIndex, Member } from '../../types/competition';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
interface RelayStatusProps {
  activeMembers: MemberIndex[];
  completedMembers?: MemberIndex[];
  members: Member[];
  showBatonAnimation?: boolean;
  className?: string;
}

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
type MemberStatus = 'active' | 'completed' | 'waiting';

function getMemberStatus(
  index: MemberIndex,
  activeMembers: MemberIndex[],
  completedMembers: MemberIndex[]
): MemberStatus {
  if (completedMembers.includes(index)) return 'completed';
  if (activeMembers.includes(index)) return 'active';
  return 'waiting';
}

// ----------------------------------------------------------------
// Status dot indicator
// ----------------------------------------------------------------
const StatusDot: React.FC<{ status: MemberStatus; animate: boolean }> = ({
  status,
  animate,
}) => {
  if (status === 'completed') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <CheckCircle2
          className="w-5 h-5 text-green-400"
          style={{ filter: 'drop-shadow(0 0 6px rgba(74,222,128,0.7))' }}
        />
      </motion.div>
    );
  }

  if (status === 'active') {
    return (
      <div className="relative flex items-center justify-center w-5 h-5">
        <motion.div
          className="w-3 h-3 rounded-full bg-cyan-400"
          animate={animate ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ boxShadow: '0 0 10px rgba(34,211,238,0.8)' }}
        />
        {animate && (
          <motion.div
            className="absolute inset-0 rounded-full border border-cyan-400/50"
            animate={{ scale: [1, 1.7], opacity: [0.6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </div>
    );
  }

  return <Circle className="w-5 h-5 text-slate-600" />;
};

// ----------------------------------------------------------------
// Row background per status
// ----------------------------------------------------------------
const ROW_BG: Record<MemberStatus, string> = {
  active: 'bg-cyan-950/40 border border-cyan-400/30',
  completed: 'bg-green-950/30 border border-green-400/20',
  waiting: 'bg-slate-900/30 border border-slate-700/30',
};

const STATUS_TEXT: Record<MemberStatus, string> = {
  active: 'ACTIVE',
  completed: 'COMPLETED',
  waiting: 'WAITING',
};

const STATUS_TEXT_CLASS: Record<MemberStatus, string> = {
  active: 'text-cyan-400 font-bold',
  completed: 'text-green-400 font-semibold',
  waiting: 'text-slate-500 font-medium',
};

// ----------------------------------------------------------------
// Baton connector between members
// ----------------------------------------------------------------
interface ConnectorProps {
  fromStatus: MemberStatus;
  toStatus: MemberStatus;
  showBatonAnimation: boolean;
}

const BatonConnector: React.FC<ConnectorProps> = ({
  fromStatus,
  toStatus,
  showBatonAnimation,
}) => {
  const isPassing = fromStatus === 'completed' && toStatus === 'active';
  const isPassed = fromStatus === 'completed' && toStatus === 'completed';
  const isLit = isPassing || isPassed;

  return (
    <div className="flex flex-col items-center py-0.5 pl-4">
      {/* Top line segment */}
      <div
        className={`w-0.5 h-4 rounded-full transition-colors duration-700 ${
          isLit ? 'bg-cyan-400/50' : 'bg-slate-700/50'
        }`}
      />

      {/* Baton icon */}
      <div className="flex items-center justify-center my-0.5">
        {isPassing && showBatonAnimation ? (
          <motion.div
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          >
            <Zap
              className="w-3.5 h-3.5 text-cyan-400"
              style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.9))' }}
            />
          </motion.div>
        ) : (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            className={`transition-colors duration-500 ${
              isLit ? 'text-cyan-400' : 'text-slate-600'
            }`}
          >
            <path
              d="M5 1 L5 9 M2 7 L5 9 L8 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Bottom line segment */}
      <div
        className={`w-0.5 h-4 rounded-full transition-colors duration-700 ${
          isPassed ? 'bg-cyan-400/50' : 'bg-slate-700/50'
        }`}
      />
    </div>
  );
};

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------
export const RelayStatus: React.FC<RelayStatusProps> = ({
  activeMembers,
  completedMembers = [],
  members,
  showBatonAnimation = true,
  className = '',
}) => {
  const sorted = [...members].sort((a, b) => a.index - b.index) as Member[];
  const statuses = sorted.map((m) =>
    getMemberStatus(m.index, activeMembers, completedMembers)
  );

  return (
    <div className={`flex flex-col items-stretch ${className}`}>
      {sorted.map((member, i) => {
        const status = statuses[i];
        return (
          <React.Fragment key={member.index}>
            {/* Member row */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`member-${member.index}-${status}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, delay: i * 0.06 }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${ROW_BG[status]} transition-colors duration-500`}
              >
                <StatusDot status={status} animate={showBatonAnimation} />

                <div className="flex flex-col leading-tight min-w-0">
                  <span className="text-slate-200 text-sm font-semibold truncate">
                    {member.name}
                  </span>
                  <span
                    className={`text-[10px] tracking-wider ${STATUS_TEXT_CLASS[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                </div>

                <span className="ml-auto text-[10px] text-slate-500 font-mono flex-shrink-0">
                  M{member.index}
                </span>
              </motion.div>
            </AnimatePresence>

            {/* Connector */}
            {i < sorted.length - 1 && (
              <BatonConnector
                fromStatus={statuses[i]}
                toStatus={statuses[i + 1]}
                showBatonAnimation={showBatonAnimation}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// re-export constant used in BatonConnector inline — avoid TS error
const STATUS_LABELS = STATUS_TEXT;

export default RelayStatus;
