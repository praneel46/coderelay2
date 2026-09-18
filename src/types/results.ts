// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Results domain types
// ============================================================

export type EvaluationStatus = 'pending' | 'in_progress' | 'evaluated';

export interface StrikeTiming {
  strike1CompletedAt?: string | null; // ISO timestamp
  strike2CompletedAt?: string | null; // ISO timestamp
  strike3CompletedAt?: string | null; // ISO timestamp
  finalSubmittedAt?: string | null;   // ISO timestamp of last valid submission
  totalElapsedSeconds?: number;       // total competition duration in seconds
}

export interface RankEntry {
  rank: number;
  teamId: string;
  teamName: string;
  predictScore: number;     // out of 30
  debugMarks: number | null; // out of 60 (null when pending)
  codeMarks: number | null;  // out of 60 (null when pending)
  debugCodeTotal: number;   // debugMarks + codeMarks
  finalScore: number;       // predictScore + debugCodeTotal
  evaluationStatus: EvaluationStatus;
  timing: StrikeTiming;
  tieBreakerApplied?: boolean;
}

export interface AuditEvaluationRecord {
  teamId: string;
  judgeId: string;
  predictScore: number;
  debugMarks: number | null;
  codeMarks: number | null;
  debugCodeTotal: number;
  finalScore: number;
  status: EvaluationStatus;
  updatedAt: string; // ISO server timestamp
  updatedBy: string;
  notes?: string;
}
