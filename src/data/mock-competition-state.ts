// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// MOCK DATA — Competition State
// ============================================================

import type { CompetitionState } from '../types/competition-state';

/**
 * The initial competition state when the round has not started yet.
 * Organizer must explicitly start each strike.
 */
export const MOCK_INITIAL_STATE: CompetitionState = {
  roundId: 'round2',
  phase: 'waiting',
  currentStrikeId: null,
  activeStrike: null,
  completedStrikes: [],
  globalLock: false,
  lastUpdatedAt: new Date().toISOString(),
};

/**
 * Simulate organizer starting Strike 1 (for mock testing purposes).
 * Real implementation will come from Firebase in a later phase.
 */
export function createMockStrike1State(): CompetitionState {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 5 * 60 * 1000);
  return {
    roundId: 'round2',
    phase: 'active',
    currentStrikeId: 'strike1',
    activeStrike: {
      strikeId: 'strike1',
      startedAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
    },
    completedStrikes: [],
    globalLock: false,
    lastUpdatedAt: now.toISOString(),
  };
}

export function createMockStrike2State(): CompetitionState {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 15 * 60 * 1000);
  return {
    roundId: 'round2',
    phase: 'active',
    currentStrikeId: 'strike2',
    activeStrike: {
      strikeId: 'strike2',
      startedAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
    },
    completedStrikes: ['strike1'],
    globalLock: false,
    lastUpdatedAt: now.toISOString(),
  };
}

export function createMockStrike3State(): CompetitionState {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 20 * 60 * 1000);
  return {
    roundId: 'round2',
    phase: 'active',
    currentStrikeId: 'strike3',
    activeStrike: {
      strikeId: 'strike3',
      startedAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
    },
    completedStrikes: ['strike1', 'strike2'],
    globalLock: false,
    lastUpdatedAt: now.toISOString(),
  };
}
