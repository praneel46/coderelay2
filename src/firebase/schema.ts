// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Firestore Schema Definitions & Types
// ============================================================

import type { StrikeId, QuestionType } from '../types/competition';
import type { EvaluationStatus, StrikeTiming } from '../types/results';

export interface FirestoreTeamDoc {
  teamId: string; // e.g. 'CRL-0000'
  teamName: string;
  member1: { name: string; email?: string; role: 'M1' };
  member2: { name: string; email?: string; role: 'M2' };
  member3: { name: string; email?: string; role: 'M3' };
  status: 'active' | 'disqualified' | 'withdrawn';
  createdAt: string; // ISO
  updatedAt: string; // ISO
  // NOTE: accessCode is NOT stored in the public team document
}

export interface FirestoreTeamCredentialDoc {
  teamId: string; // Document ID: CRL-0000
  accessCodeHash: string; // Hashed or securely mapped access code
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreCompetitionDoc {
  roundId: 'round2';
  currentStrikeId: StrikeId | null;
  phase: 'waiting' | 'active' | 'complete' | 'finished';
  status: 'WAITING' | 'STRIKE_1' | 'STRIKE_2' | 'STRIKE_3' | 'COMPLETED';
  startTime: string | null; // ISO server timestamp
  endTime: string | null;   // ISO server timestamp (startTime + duration)
  completedStrikes: StrikeId[];
  globalLock: boolean;
  updatedAt: string;        // ISO
  updatedBy: string;        // Organizer UID
}

export interface FirestoreQuestionDoc {
  questionId: string;
  round: 'round2';
  strikeId: StrikeId;
  type: QuestionType;
  index: number;
  title: string;
  statement: string;
  options?: { key: 'A' | 'B' | 'C' | 'D'; label: string }[];
  starterCode?: string;
  language?: string;
  points: number;
  status: 'published' | 'draft';
  // NOTE: Answers, solutions, and test suites live strictly in a private collection
}

export interface FirestorePrivateAnswerDoc {
  questionId: string;
  correctAnswer?: string;      // MCQ key
  officialSolution?: string;  // reference bug fix / implementation
  rubricNotes?: string;       // guide for judges
  updatedAt: string;
}

export interface FirestoreSubmissionDoc {
  submissionId: string; // e.g. 'CRL-0000_q1-01'
  teamId: string;
  memberRole?: 'M1' | 'M2' | 'M3';
  questionId: string;
  round: 'round2';
  strikeId: StrikeId;
  answer: string;
  submittedAt: string; // Authoritative server timestamp
  status: 'submitted' | 'locked';
  isCarriedForward?: boolean;
  lockedAt?: string;
}

export interface FirestoreJudgeDoc {
  judgeId: string; // e.g. 'J001'
  uid?: string;    // Firebase Auth UID
  name: string;
  email: string;
  status: 'active' | 'inactive';
  assignedTeamIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreEvaluationDoc {
  evaluationId: string;
  teamId: string;
  judgeId: string;
  predictScore: number;       // Auto-calculated from MCQ
  debugMarks: number | null;   // Judge entered (0–60)
  codeMarks: number | null;    // Judge entered (0–60)
  debugCodeTotal: number;     // Sum
  finalScore: number;         // Predict + Debug + Code (/150)
  status: EvaluationStatus;
  updatedAt: string;
  updatedBy: string;
}

export interface FirestoreSessionDoc {
  sessionId: string;
  userId: string;
  role: 'participant' | 'judge' | 'organizer';
  teamId?: string;
  judgeId?: string;
  device: string;
  connection: 'online' | 'offline' | 'unstable';
  lastHeartbeat: string;
  createdAt: string;
  status: 'active' | 'expired' | 'revoked';
  revokedAt?: string;
}

export interface FirestoreResultDoc {
  teamId: string;
  rank: number;
  teamName: string;
  predictScore: number;
  debugMarks: number | null;
  codeMarks: number | null;
  debugCodeTotal: number;
  finalScore: number;
  evaluationStatus: EvaluationStatus;
  timing: StrikeTiming;
  tieBreakerApplied: boolean;
  updatedAt: string;
}

export interface FirestoreAuditLogDoc {
  logId: string;
  timestamp: string; // ISO server timestamp
  actor: string;     // UID or system
  role: 'organizer' | 'judge' | 'system';
  action:
    | 'START_STRIKE'
    | 'END_STRIKE'
    | 'PAUSE_COMPETITION'
    | 'RESUME_COMPETITION'
    | 'EMERGENCY_LOCK'
    | 'SUBMIT_EVALUATION'
    | 'UPDATE_SCORES'
    | 'REVOKE_SESSION';
  target?: string;
  teamId?: string;
  metadata?: Record<string, unknown>;
}
