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
  startStrike(strikeId: StrikeId): Promise<void>;
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
      predictScore?: number;
      judgeId?: string;
      note?: string;
    }
  ): Promise<void>;
  subscribeAuditLogs(onUpdate: (logs: EvaluationAuditEntry[]) => void, onError?: (err: Error) => void): () => void;
  getTeamEvaluation(teamId: string): {
    predictScore: number;
    debugMarks: number | null;
    codeMarks: number | null;
    debugCodeTotal: number;
    finalScore: number;
    status: 'pending' | 'in_progress' | 'submitted';
  };
  getTeamTiming(teamId: string): StrikeTiming;
}
