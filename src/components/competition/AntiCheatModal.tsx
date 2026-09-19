// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Battle Mode / Anti-Cheat Warning Modal
// ============================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ShieldAlert, Lock, Maximize2 } from 'lucide-react';
import type { ViolationEvent } from '../../hooks/useAntiCheat';

interface AntiCheatModalProps {
  violation: ViolationEvent | null;
  warningCount: number;
  isLockedOut: boolean;
  onDismiss: () => void;
}

export const AntiCheatModal: React.FC<AntiCheatModalProps> = ({
  violation,
  warningCount,
  isLockedOut,
  onDismiss,
}) => {
  if (!violation) return null;

  const isFinal = warningCount >= 3 || isLockedOut;
  const isSecond = warningCount === 2;

  const borderColor = isFinal
    ? 'border-red-500/80 shadow-red-900/40'
    : isSecond
    ? 'border-amber-500/80 shadow-amber-900/40'
    : 'border-yellow-500/80 shadow-yellow-900/40';

  const badgeBg = isFinal
    ? 'bg-red-500/20 text-red-400 border-red-500/40'
    : isSecond
    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={`w-full max-w-md bg-dark-900 border ${borderColor} rounded-xl p-6 shadow-2xl relative overflow-hidden`}
        >
          {/* Top accent glow */}
          <div
            className={`absolute top-0 left-0 right-0 h-1.5 ${
              isFinal ? 'bg-red-500' : isSecond ? 'bg-amber-500' : 'bg-yellow-500'
            }`}
          />

          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-lg border ${
                isFinal
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              {isFinal ? <Lock className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${badgeBg}`}>
                  STRIKE VIOLATION #{warningCount}/3
                </span>
                <span className="text-xs text-gray-400 font-mono">{violation.timestamp}</span>
              </div>

              <h3 className="text-lg font-bold text-white mb-2">
                {isFinal
                  ? 'Strike Locked: Maximum Violations'
                  : isSecond
                  ? 'Final Warning: Disqualification Risk'
                  : 'Battle Mode Warning: Focus Lost'}
              </h3>

              <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                {violation.message}
              </p>

              <div className="p-3 bg-dark-800/80 rounded-lg border border-dark-700 text-xs text-gray-400 space-y-1 mb-5">
                <p className="font-semibold text-gray-300">Competition Security Notice:</p>
                <p>• Navigating away or switching tabs triggers an official infraction.</p>
                <p>• At 3 warnings, the active strike is automatically submitted and locked.</p>
                <p>• All infractions are logged in real-time to the Organizer monitoring feed.</p>
              </div>

              {!isFinal ? (
                <button
                  type="button"
                  onClick={onDismiss}
                  className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                    isSecond
                      ? 'bg-amber-600 hover:bg-amber-500 text-black font-bold'
                      : 'bg-yellow-500 hover:bg-yellow-400 text-black font-bold'
                  }`}
                >
                  <Maximize2 className="w-4 h-4" />
                  I Understand — Return to Fullscreen
                </button>
              ) : (
                <div className="text-center py-2 px-4 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-mono font-semibold">
                  ACTIVE STRIKE LOCKED & AUTO-SUBMITTED
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
