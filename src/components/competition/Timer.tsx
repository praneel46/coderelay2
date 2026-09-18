// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Timer component — prominent countdown display
// ============================================================

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimer } from '../../hooks/useTimer';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
interface TimerProps {
  endsAt: string | null | undefined;
  totalSeconds: number;
  onExpired?: () => void;
  className?: string;
}

// ----------------------------------------------------------------
// SVG Arc progress helpers
// ----------------------------------------------------------------
const RADIUS = 42;

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const s = polarToCartesian(cx, cy, r, startAngle);
  const e = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

// ----------------------------------------------------------------
// Color map by timer state
// ----------------------------------------------------------------
const STATE_COLORS = {
  normal: {
    text: 'text-cyan-400',
    stroke: '#22d3ee',
    glow: '0 0 20px rgba(34, 211, 238, 0.6)',
    trackStroke: 'rgba(34, 211, 238, 0.15)',
  },
  warning: {
    text: 'text-yellow-400',
    stroke: '#facc15',
    glow: '0 0 20px rgba(250, 204, 21, 0.6)',
    trackStroke: 'rgba(250, 204, 21, 0.15)',
  },
  timeup: {
    text: 'text-red-400',
    stroke: '#f87171',
    glow: '0 0 24px rgba(248, 113, 113, 0.8)',
    trackStroke: 'rgba(248, 113, 113, 0.15)',
  },
} as const;

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export const Timer: React.FC<TimerProps> = ({
  endsAt,
  totalSeconds,
  onExpired,
  className = '',
}) => {
  const { displayTime, timerState, isExpired, progress } = useTimer(
    endsAt,
    totalSeconds,
    onExpired
  );

  const colors = STATE_COLORS[timerState];
  const prevStateRef = useRef(timerState);
  const isEnteringWarning =
    timerState === 'warning' && prevStateRef.current === 'normal';

  useEffect(() => {
    prevStateRef.current = timerState;
  }, [timerState]);

  // Arc angle: 360deg * progress, clockwise from top
  const arcAngle = Math.max(0, Math.min(360, progress * 360));
  const hasFullArc = arcAngle >= 359.9;

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      <div className="relative w-[120px] h-[120px]">
        {/* SVG arc ring */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 100 100"
          className="block"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke={colors.trackStroke}
            strokeWidth="5"
          />

          {/* Progress arc */}
          {arcAngle > 0 &&
            (hasFullArc ? (
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={colors.stroke}
                strokeWidth="5"
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 6px ${colors.stroke})`,
                  transition: 'stroke 0.4s ease',
                }}
              />
            ) : (
              <path
                d={arcPath(50, 50, RADIUS, 0, arcAngle)}
                fill="none"
                stroke={colors.stroke}
                strokeWidth="5"
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 6px ${colors.stroke})`,
                  transition: 'stroke 0.4s ease',
                }}
              />
            ))}
        </svg>

        {/* Centered time text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            {isExpired ? (
              <motion.div
                key="timeup"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="text-center"
              >
                <span
                  className="text-red-400 font-black text-xs tracking-widest leading-tight block"
                  style={{ textShadow: '0 0 14px rgba(248,113,113,0.9)' }}
                >
                  TIME
                  <br />
                  UP
                </span>
              </motion.div>
            ) : (
              <motion.span
                key="time"
                initial={isEnteringWarning ? { scale: 1.25 } : { scale: 1 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                className={`font-black text-lg leading-none tabular-nums ${colors.text}`}
                style={{ textShadow: colors.glow }}
              >
                {displayTime}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Pulse rings */}
        <AnimatePresence>
          {timerState === 'warning' && !isExpired && (
            <motion.div
              key="pulse-warn"
              className="absolute inset-0 rounded-full border border-yellow-400/40 pointer-events-none"
              animate={{ scale: [1, 1.13, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {timerState === 'timeup' && (
            <motion.div
              key="pulse-timeup"
              className="absolute inset-0 rounded-full border border-red-400/50 pointer-events-none"
              animate={{ scale: [1, 1.2, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Timer;
