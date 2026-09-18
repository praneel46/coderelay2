// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Firebase Cloud Functions Service Layer
// Authoritative backend operations for state management and privileged actions.
// ============================================================

import { httpsCallable } from 'firebase/functions';
import { functions } from './config';
import type { StrikeId, Team } from '../types/competition';

export interface VerifyTeamResponse {
  customToken: string;
  team: Team;
}

export interface StrikeOperationResponse {
  success: boolean;
  strikeId: StrikeId;
  startTime: string;
  endTime: string;
  message?: string;
}

/**
 * Verify team credentials and obtain a custom authentication token.
 */
export async function callVerifyTeamCredentials(
  teamId: string,
  accessCode: string
): Promise<VerifyTeamResponse> {
  const fn = httpsCallable<{ teamId: string; accessCode: string }, VerifyTeamResponse>(
    functions,
    'verifyTeamCredentials'
  );
  const result = await fn({ teamId, accessCode });
  return result.data;
}

/**
 * Authoritative organizer action to start a strike.
 * Computes official server startTime and endTime on Cloud Functions.
 */
export async function callStartStrike(strikeId: StrikeId): Promise<StrikeOperationResponse> {
  const fn = httpsCallable<{ strikeId: StrikeId }, StrikeOperationResponse>(
    functions,
    'startStrike'
  );
  const result = await fn({ strikeId });
  return result.data;
}

/**
 * Authoritative organizer action to end a strike.
 */
export async function callEndStrike(strikeId: StrikeId): Promise<{ success: boolean }> {
  const fn = httpsCallable<{ strikeId: StrikeId }, { success: boolean }>(
    functions,
    'endStrike'
  );
  const result = await fn({ strikeId });
  return result.data;
}

/**
 * Authoritative organizer action to pause competition.
 */
export async function callPauseCompetition(): Promise<{ success: boolean }> {
  const fn = httpsCallable<void, { success: boolean }>(functions, 'pauseCompetition');
  const result = await fn();
  return result.data;
}

/**
 * Authoritative organizer action to resume competition.
 */
export async function callResumeCompetition(): Promise<{ success: boolean }> {
  const fn = httpsCallable<void, { success: boolean }>(functions, 'resumeCompetition');
  const result = await fn();
  return result.data;
}

/**
 * Authoritative organizer action for emergency lockdown.
 */
export async function callEmergencyLock(): Promise<{ success: boolean }> {
  const fn = httpsCallable<void, { success: boolean }>(functions, 'emergencyLock');
  const result = await fn();
  return result.data;
}
