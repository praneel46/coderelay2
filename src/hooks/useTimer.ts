// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// useTimer hook
// Architecture: timestamp-based, not value-every-second.
// endsAt is the authoritative source of truth.
// Future: receive endsAt from Firebase instead of deriving locally.
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export type TimerState = 'normal' | 'warning' | 'timeup';

export interface TimerResult {
  secondsRemaining: number;
  displayTime: string;   // "MM:SS"
  timerState: TimerState;
  isExpired: boolean;
  progress: number;      // 0–1 (1 = full time remaining)
}

const WARNING_THRESHOLD_SECONDS = 60;

/**
 * useTimer — computes countdown from an endsAt ISO timestamp.
 * @param endsAt ISO timestamp string or null (if no active strike)
 * @param totalSeconds Total duration of the strike for progress calculation
 * @param onExpired Callback fired exactly once when timer reaches 0
 */
export function useTimer(
  endsAt: string | null | undefined,
  totalSeconds: number,
  onExpired?: () => void
): TimerResult {
  const computeRemaining = useCallback((): number => {
    if (!endsAt) return 0;
    const diff = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
    return diff;
  }, [endsAt]);

  const [secondsRemaining, setSecondsRemaining] = useState<number>(computeRemaining);
  const [hasCalledExpired, setHasCalledExpired] = useState(false);

  useEffect(() => {
    if (!endsAt) {
      setSecondsRemaining(0);
      setHasCalledExpired(false);
      return;
    }
    // Reset expired flag when endsAt changes
    setHasCalledExpired(false);
    setSecondsRemaining(computeRemaining());

    const interval = setInterval(() => {
      const remaining = computeRemaining();
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endsAt, computeRemaining]);

  // Fire onExpired once when we cross 0
  useEffect(() => {
    if (secondsRemaining === 0 && endsAt && !hasCalledExpired) {
      setHasCalledExpired(true);
      onExpired?.();
    }
  }, [secondsRemaining, endsAt, hasCalledExpired, onExpired]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const displayTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const timerState: TimerState =
    secondsRemaining === 0
      ? 'timeup'
      : secondsRemaining <= WARNING_THRESHOLD_SECONDS
      ? 'warning'
      : 'normal';

  const progress = totalSeconds > 0 ? secondsRemaining / totalSeconds : 0;

  return {
    secondsRemaining,
    displayTime,
    timerState,
    isExpired: secondsRemaining === 0 && !!endsAt,
    progress: Math.min(1, Math.max(0, progress)),
  };
}
