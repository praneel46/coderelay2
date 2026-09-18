// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Judge domain types
// ============================================================

export interface Judge {
  judgeId: string;
  name: string;
  email: string;
  active: boolean;
  assignedTeamIds: string[];
  pendingCount: number;
  evaluatedCount: number;
}

/**
 * Evaluation submitted by a judge for one team.
 * Judges enter ONLY debugMarks and codeMarks.
 * predictScore is auto-calculated from MCQ submissions.
 */
export interface Evaluation {
  evaluationId: string;
  judgeId: string;
  teamId: string;
  /** read-only, auto-calculated from Strike 1 MCQ answers */
  predictScore: number; // out of 30
  /** judge-entered: 0–60 */
  debugMarks: number | null;
  /** judge-entered: 0–60 */
  codeMarks: number | null;
  /** debugMarks + codeMarks (calculated) */
  debugCodeTotal: number | null;
  /** predictScore + debugMarks + codeMarks */
  finalScore: number | null;
  status: 'pending' | 'in_progress' | 'submitted';
  submittedAt?: string;
  updatedAt?: string;
}

export interface EvaluationAuditEntry {
  auditId: string;
  teamId: string;
  judgeId: string;
  previousDebugMarks: number | null;
  newDebugMarks: number | null;
  previousCodeMarks: number | null;
  newCodeMarks: number | null;
  predictScore: number;
  finalScore: number;
  timestamp: string; // ISO server timestamp
  note?: string;
}
