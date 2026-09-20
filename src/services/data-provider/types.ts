// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Data Provider Interface
// Clean separation between Mock and Firebase data implementations.
// ============================================================

import type { CompetitionState } from '../../types/competition-state';
import type { Submission, StrikeId, CarryForwardState } from '../../types/competition';
import type { RankEntry, StrikeTiming } from '../../types/results';
import type { EvaluationAuditEntry } from '../../types/judge';
import type { AuthUser } from '../../context/AuthContext';

export interface IDataProvider {
  // Auth
  loginParticipant(teamId: string, accessCode: string): Promise<AuthUser>;
  loginOrganizer(password?: string): Promise<AuthUser>;
  loginJudge(judgeId: string, password: string): Promise<AuthUser>;
  logout(): Promise<void>;
  subscribeAuth(onUser: (user: AuthUser | null) => void): () => void;

  // Competition State
  subscribeCompetitionState(onUpdate: (state: CompetitionState) => void, onError?: (err: Error) => void): () => void;
  startStrike(strikeId: StrikeId, teamId?: string): Promise<void>;
  endStrike(strikeId: StrikeId): Promise<void>;
  pauseCompetition(): Promise<void>;
  resumeCompetition(): Promise<void>;
  emergencyLock(): Promise<void>;
  resetRound(): Promise<void>;

  // Submissions
  submitAnswer(submission: Omit<Submission, 'submittedAt'>): Promise<string>;
  subscribeTeamSubmissions(teamId: string, onUpdate: (subs: Submission[]) => void): () => void;

  // Leaderboard & Evaluation
  subscribeLeaderboard(onUpdate: (results: RankEntry[]) => void, onError?: (err: Error) => void): () => void;
  updateTeamScores(
    teamId: string,
    scores: {
      debugMarks?: number | null;
      codeMarks?: number | null;
      predictScore?: number | null;
      predictScoreSource?: 'AUTO' | 'MANUAL_OVERRIDE';
      predictOverrideReason?: string;
      judgeId?: string;
      note?: string;
      timing?: StrikeTiming;
      teamName?: string;
    }
  ): Promise<void>;
  subscribeAuditLogs(onUpdate: (logs: EvaluationAuditEntry[]) => void, onError?: (err: Error) => void): () => void;
  getTeamEvaluation(teamId: string): {
    predictScore: number | null;
    debugMarks: number | null;
    codeMarks: number | null;
    debugCodeTotal: number | null;
    finalScore: number | null;
    status: 'pending' | 'in_progress' | 'submitted';
  };
  getTeamTiming(teamId: string): StrikeTiming;
}
