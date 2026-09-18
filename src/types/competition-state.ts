// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Competition State — authoritative state machine
// ============================================================

import type { StrikeId } from './competition';
export type { StrikeId } from './competition';

export type CompetitionPhase =
  | 'waiting'     // waiting for organizer to start
  | 'active'      // strike currently running
  | 'complete'    // strike ended, awaiting next start
  | 'finished';   // entire round finished

export interface StrikeConfig {
  id: StrikeId;
  label: string;
  subLabel: string;
  durationSeconds: number;
  /** 1-based member indices active in this strike */
  activeMembers: (1 | 2 | 3)[];
}

export const STRIKE_CONFIGS: Record<StrikeId, StrikeConfig> = {
  strike1: {
    id: 'strike1',
    label: 'STRIKE 1',
    subLabel: 'PREDICT',
    durationSeconds: 5 * 60,
    activeMembers: [1],
  },
  strike2: {
    id: 'strike2',
    label: 'STRIKE 2',
    subLabel: 'DEBUG',
    durationSeconds: 15 * 60,
    activeMembers: [1, 2],
  },
  strike3: {
    id: 'strike3',
    label: 'STRIKE 3',
    subLabel: 'CODE',
    durationSeconds: 20 * 60,
    activeMembers: [1, 2, 3],
  },
};

export const STRIKE_ORDER: StrikeId[] = ['strike1', 'strike2', 'strike3'];

export interface ActiveStrikeState {
  strikeId: StrikeId;
  /** ISO timestamp when this strike was started */
  startedAt: string;
  /** ISO timestamp when this strike will end (startedAt + duration) */
  endsAt: string;
}

/**
 * CompetitionState — the single source of truth.
 * UI components read from this; mock layer provides it; Firebase will replace it later.
 */
export interface CompetitionState {
  roundId: 'round2';
  phase: CompetitionPhase;
  currentStrikeId: StrikeId | null;
  activeStrike: ActiveStrikeState | null;
  /** strikes that have been completed */
  completedStrikes: StrikeId[];
  /** Whether the organizer has locked all submissions (emergency lock) */
  globalLock: boolean;
  /** ISO timestamp of last organizer action */
  lastUpdatedAt: string;
}
