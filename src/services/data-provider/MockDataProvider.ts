// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Mock Data Provider
// Preserves Phase 1 mock persistence and behavior.
// ============================================================

import type { IDataProvider } from './types';
import type { CompetitionState } from '../../types/competition-state';
import type { Submission, StrikeId } from '../../types/competition';
import type { RankEntry, StrikeTiming, EvaluationStatus } from '../../types/results';
import type { EvaluationAuditEntry } from '../../types/judge';
import type { AuthUser } from '../../context/AuthContext';
import { validateParticipantCredentials } from '../../data/mock-teams';
import {
  MOCK_INITIAL_STATE,
  createMockStrike1State,
  createMockStrike2State,
  createMockStrike3State,
} from '../../data/mock-competition-state';
import { MOCK_RESULTS } from '../../data/mock-results';

const COMP_STATE_KEY = 'vr2_comp_state';
const SUBMISSIONS_KEY = 'vr2_submissions';
const RESULTS_KEY = 'vr2_results';
const AUDIT_LOG_KEY = 'vr2_eval_audit';
const TIMING_KEY = 'vr2_team_timings';
const AUTH_KEY = 'vr2_auth';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
  }
  return fallback;
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export class MockDataProvider implements IDataProvider {
  // ------------------------------------------------------------
  // Auth
  // ------------------------------------------------------------
  async loginParticipant(teamId: string, accessCode: string): Promise<AuthUser> {
    await new Promise((r) => setTimeout(r, 400));
    const team = validateParticipantCredentials(teamId, accessCode);
    if (!team) {
      throw new Error('Invalid Team ID or Access Code.');
    }
    const user: AuthUser = {
      role: 'participant',
      team,
      activeMember: team.members[0],
    };
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  }

  async loginOrganizer(password?: string): Promise<AuthUser> {
    await new Promise((r) => setTimeout(r, 400));
    if (password && password !== 'organizer2026') {
      throw new Error('Invalid organizer credentials.');
    }
    const user: AuthUser = { role: 'organizer', isOrganizer: true };
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  }

  async loginJudge(judgeId: string, password: string): Promise<AuthUser> {
    await new Promise((r) => setTimeout(r, 400));
    const judgeCredentials: Record<string, { name: string; password: string }> = {
      J001: { name: 'Dr. Anil Krishnan', password: 'judge001' },
      J002: { name: 'Prof. Sunita Menon', password: 'judge002' },
      J003: { name: 'Mr. Ravi Tiwari', password: 'judge003' },
    };
    const judge = judgeCredentials[judgeId];
    if (!judge || judge.password !== password) {
      throw new Error('Invalid Judge ID or password.');
    }
    const user: AuthUser = {
      role: 'judge',
      judgeId,
      judgeName: judge.name,
    };
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  }

  async logout(): Promise<void> {
    sessionStorage.removeItem(AUTH_KEY);
  }

  subscribeAuth(onUser: (user: AuthUser | null) => void): () => void {
    try {
      const stored = sessionStorage.getItem(AUTH_KEY);
      onUser(stored ? JSON.parse(stored) : null);
    } catch {
      onUser(null);
    }
    return () => {};
  }

  // ------------------------------------------------------------
  // Competition State
  // ------------------------------------------------------------
  subscribeCompetitionState(onUpdate: (state: CompetitionState) => void): () => void {
    const current = loadFromStorage(COMP_STATE_KEY, MOCK_INITIAL_STATE);
    onUpdate(current);

    const handler = (e: StorageEvent) => {
      if (e.key === COMP_STATE_KEY && e.newValue) {
        try {
          onUpdate(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  async startStrike(strikeId: StrikeId): Promise<void> {
    let newState: CompetitionState;
    if (strikeId === 'strike1') newState = createMockStrike1State();
    else if (strikeId === 'strike2') newState = createMockStrike2State();
    else newState = createMockStrike3State();

    saveToStorage(COMP_STATE_KEY, newState);
    window.dispatchEvent(new StorageEvent('storage', { key: COMP_STATE_KEY, newValue: JSON.stringify(newState) }));
  }

  async endStrike(strikeId: StrikeId): Promise<void> {
    const current = loadFromStorage(COMP_STATE_KEY, MOCK_INITIAL_STATE);
    const nowIso = new Date().toISOString();
    const updated: CompetitionState = {
      ...current,
      phase: 'complete',
      activeStrike: null,
      completedStrikes: current.completedStrikes.includes(strikeId)
        ? current.completedStrikes
        : [...current.completedStrikes, strikeId],
      lastUpdatedAt: nowIso,
    };
    saveToStorage(COMP_STATE_KEY, updated);
    window.dispatchEvent(new StorageEvent('storage', { key: COMP_STATE_KEY, newValue: JSON.stringify(updated) }));
  }

  async pauseCompetition(): Promise<void> {
    const current = loadFromStorage(COMP_STATE_KEY, MOCK_INITIAL_STATE);
    const updated = { ...current, globalLock: true, lastUpdatedAt: new Date().toISOString() };
    saveToStorage(COMP_STATE_KEY, updated);
    window.dispatchEvent(new StorageEvent('storage', { key: COMP_STATE_KEY, newValue: JSON.stringify(updated) }));
  }

  async resumeCompetition(): Promise<void> {
    const current = loadFromStorage(COMP_STATE_KEY, MOCK_INITIAL_STATE);
    const updated = { ...current, globalLock: false, lastUpdatedAt: new Date().toISOString() };
    saveToStorage(COMP_STATE_KEY, updated);
    window.dispatchEvent(new StorageEvent('storage', { key: COMP_STATE_KEY, newValue: JSON.stringify(updated) }));
  }

  async emergencyLock(): Promise<void> {
    const current = loadFromStorage(COMP_STATE_KEY, MOCK_INITIAL_STATE);
    const updated: CompetitionState = {
      ...current,
      globalLock: true,
      phase: 'complete',
      activeStrike: null,
      lastUpdatedAt: new Date().toISOString(),
    };
    saveToStorage(COMP_STATE_KEY, updated);
    window.dispatchEvent(new StorageEvent('storage', { key: COMP_STATE_KEY, newValue: JSON.stringify(updated) }));
  }

  async resetRound(): Promise<void> {
    const fresh = { ...MOCK_INITIAL_STATE, lastUpdatedAt: new Date().toISOString() };
    saveToStorage(COMP_STATE_KEY, fresh);
    saveToStorage(SUBMISSIONS_KEY, []);
    saveToStorage(RESULTS_KEY, MOCK_RESULTS);
    saveToStorage(AUDIT_LOG_KEY, []);
    window.dispatchEvent(new StorageEvent('storage', { key: COMP_STATE_KEY, newValue: JSON.stringify(fresh) }));
  }

  // ------------------------------------------------------------
  // Submissions
  // ------------------------------------------------------------
  async submitAnswer(submission: Omit<Submission, 'submittedAt'>): Promise<string> {
    const existing = loadFromStorage<Submission[]>(SUBMISSIONS_KEY, []);
    const submittedAt = new Date().toISOString();
    const newSub: Submission = {
      ...submission,
      status: 'submitted',
      submittedAt,
    };
    const updated = [...existing.filter((s) => s.questionId !== submission.questionId), newSub];
    saveToStorage(SUBMISSIONS_KEY, updated);
    return `${submission.teamId}_${submission.questionId}`;
  }

  subscribeTeamSubmissions(teamId: string, onUpdate: (subs: Submission[]) => void): () => void {
    const all = loadFromStorage<Submission[]>(SUBMISSIONS_KEY, []);
    onUpdate(all.filter((s) => s.teamId === teamId));
    return () => {};
  }

  // ------------------------------------------------------------
  // Leaderboard & Scoring
  // ------------------------------------------------------------
  subscribeLeaderboard(onUpdate: (results: RankEntry[]) => void): () => void {
    const current = loadFromStorage<RankEntry[]>(RESULTS_KEY, MOCK_RESULTS);
    onUpdate(current);

    const handler = (e: StorageEvent) => {
      if (e.key === RESULTS_KEY && e.newValue) {
        try {
          onUpdate(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  async updateTeamScores(
    teamId: string,
    scores: {
      debugMarks?: number | null;
      codeMarks?: number | null;
      predictScore?: number;
      judgeId?: string;
      note?: string;
    }
  ): Promise<void> {
    const currentResults = loadFromStorage<RankEntry[]>(RESULTS_KEY, MOCK_RESULTS);
    const existing = currentResults.find((r) => r.teamId === teamId);
    const newPredict = scores.predictScore ?? existing?.predictScore ?? 24;
    const newDebug = scores.debugMarks !== undefined ? scores.debugMarks : (existing?.debugMarks ?? null);
    const newCode = scores.codeMarks !== undefined ? scores.codeMarks : (existing?.codeMarks ?? null);
    const debugCodeTotal = (newDebug ?? 0) + (newCode ?? 0);
    const finalScore = newPredict + debugCodeTotal;

    const isBothEvaluated = newDebug !== null && newCode !== null;
    const evalStatus: EvaluationStatus = isBothEvaluated
      ? 'evaluated'
      : (newDebug !== null || newCode !== null ? 'in_progress' : 'pending');

    const updatedResults = currentResults.map((r) => {
      if (r.teamId === teamId) {
        return {
          ...r,
          predictScore: newPredict,
          debugMarks: newDebug,
          codeMarks: newCode,
          debugCodeTotal,
          finalScore,
          evaluationStatus: evalStatus,
        };
      }
      return r;
    });

    saveToStorage(RESULTS_KEY, updatedResults);
    window.dispatchEvent(new StorageEvent('storage', { key: RESULTS_KEY, newValue: JSON.stringify(updatedResults) }));
  }

  subscribeAuditLogs(onUpdate: (logs: EvaluationAuditEntry[]) => void): () => void {
    const current = loadFromStorage<EvaluationAuditEntry[]>(AUDIT_LOG_KEY, []);
    onUpdate(current);
    return () => {};
  }

  getTeamEvaluation(teamId: string) {
    const currentResults = loadFromStorage<RankEntry[]>(RESULTS_KEY, MOCK_RESULTS);
    const fallback = currentResults.find((r) => r.teamId === teamId);
    const predictScore = fallback ? fallback.predictScore : 24;
    const debugMarks = fallback?.debugMarks ?? null;
    const codeMarks = fallback?.codeMarks ?? null;
    return {
      predictScore,
      debugMarks,
      codeMarks,
      debugCodeTotal: (debugMarks ?? 0) + (codeMarks ?? 0),
      finalScore: predictScore + (debugMarks ?? 0) + (codeMarks ?? 0),
      status: (fallback ? fallback.evaluationStatus : 'pending') as any,
    };
  }

  getTeamTiming(teamId: string): StrikeTiming {
    const timings = loadFromStorage<Record<string, StrikeTiming>>(TIMING_KEY, {});
    return timings[teamId] || {
      strike1CompletedAt: null,
      strike2CompletedAt: null,
      strike3CompletedAt: null,
      finalSubmittedAt: null,
      totalElapsedSeconds: 0,
    };
  }
}
