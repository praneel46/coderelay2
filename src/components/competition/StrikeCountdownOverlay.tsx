import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Flame } from 'lucide-react';
import type { StrikeId } from '../../types/competition';

interface CountdownOverlayProps {
  strikeId: StrikeId;
  durationSeconds?: number;
  onComplete: () => void;
}

const STRIKE_META: Record<StrikeId, { label: string; sub: string; color: string; ringColor: string }> = {
  strike1: {
    label: 'STRIKE 1',
    sub: 'OUTPUT PREDICTION (MCQ)',
    color: 'text-cyan-400',
    ringColor: 'border-cyan-500',
  },
  strike2: {
    label: 'STRIKE 2',
    sub: 'CODE DEBUGGING',
    color: 'text-indigo-400',
    ringColor: 'border-indigo-500',
  },
  strike3: {
    label: 'STRIKE 3',
    sub: 'FULL CODE IMPLEMENTATION',
    color: 'text-purple-400',
    ringColor: 'border-purple-500',
  },
};

export default function StrikeCountdownOverlay({
  strikeId,
  durationSeconds = 5,
  onComplete,
}: CountdownOverlayProps) {
  const [count, setCount] = useState<number>(durationSeconds);
  const meta = STRIKE_META[strikeId] || STRIKE_META.strike1;

  useEffect(() => {
    if (count <= 0) {
      const timer = setTimeout(() => {
        onComplete();
      }, 700);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      setCount((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [count, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md overflow-hidden bg-grid-pattern select-none">
      {/* Background radial pulses */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(6, 182, 212, 0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-lg space-y-6">
        {/* Strike Identification Tag */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 bg-dark-900/90 border border-dark-600 px-4 py-1.5 rounded-full shadow-lg"
        >
          <Zap className={`w-4 h-4 ${meta.color} animate-pulse`} />
          <span className={`text-xs font-mono font-bold uppercase tracking-widest ${meta.color}`}>
            {meta.label} BEGINNING
          </span>
        </motion.div>

        {/* Subtitle / Challenge Name */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-white font-black text-2xl tracking-wider uppercase font-mono">
            GET READY
          </h2>
          <p className="text-slate-400 font-mono text-xs tracking-widest uppercase mt-1">
            {meta.sub}
          </p>
        </motion.div>

        {/* Large Animated Countdown Ring */}
        <div className="relative w-44 h-44 flex items-center justify-center my-4">
          <motion.div
            animate={{
              scale: [1, 1.06, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'linear',
            }}
            className={`absolute inset-0 rounded-full border-2 border-dashed ${meta.ringColor} opacity-40`}
          />

          <AnimatePresence mode="wait">
            {count > 0 ? (
              <motion.div
                key={count}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="flex flex-col items-center justify-center"
              >
                <span
                  className={`text-8xl font-black font-mono tracking-tighter ${meta.color} drop-shadow-[0_0_35px_rgba(6,182,212,0.6)]`}
                >
                  {count}
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="start"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="flex flex-col items-center justify-center space-y-1"
              >
                <Flame className="w-12 h-12 text-yellow-400 animate-bounce" />
                <span className="text-3xl font-black font-mono tracking-widest text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
                  START!
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Relay instruction notice */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-slate-500 font-mono text-xs max-w-xs leading-relaxed"
        >
          Official round clock synchronized. Questions unlocking in {count > 0 ? count : 0}s...
        </motion.p>
      </div>
    </div>
  );
}
