// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// TypeScript interfaces — Competition domain
// ============================================================

export type MemberIndex = 1 | 2 | 3;

export interface Member {
  index: MemberIndex;
  name: string;
  /** present when authenticated; may be absent in mock */
  email?: string;
}

export type TeamStatus =
  | 'NOT_QUALIFIED'
  | 'QUALIFIED_FOR_ROUND_2'
  | 'PROVISIONING'
  | 'READY'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'DISQUALIFIED'
  | 'active'
  | 'disqualified'
  | 'withdrawn';

export interface Team {
  teamId: string;
  teamName: string;
  members: [Member, Member, Member];
  accessCode: string;
  round2Eligible?: boolean;
  /** status managed by organizer */
  status: TeamStatus;
}

// ----------------------------------------------------------------
// Questions
// ----------------------------------------------------------------

export type QuestionType = 'mcq' | 'debug' | 'code';
export type StrikeId = 'strike1' | 'strike2' | 'strike3';

export interface MCQOption {
  key: 'A' | 'B' | 'C' | 'D';
  label: string;
}

export interface Question {
  id: string;
  strikeId: StrikeId;
  type: QuestionType;
  index: number; // 1-based display index within the strike
  title: string;
  statement: string;
  /** only for mcq */
  options?: MCQOption[];
  /** only for debug / code */
  starterCode?: string;
  language?: string;
}

// ----------------------------------------------------------------
// Submissions
// ----------------------------------------------------------------

export type SubmissionStatus =
  | 'unanswered'
  | 'in_progress'
  | 'submitted'
  | 'locked'
  | 'carried_forward';

export interface Submission {
  questionId: string;
  teamId: string;
  strikeId: StrikeId;
  /** selected option key for MCQ, code text for debug/code */
  answer: string;
  submittedAt: string; // ISO timestamp (authoritative server-time standard)
  status: SubmissionStatus;
  isCarriedForward?: boolean; // flags whether this debug problem was completed in Strike 3
}

// ----------------------------------------------------------------
// Carry-forward state (Strike 2 → Strike 3)
// ----------------------------------------------------------------
export interface CarryForwardState {
  debugQuestionIds: string[]; // IDs of unsubmitted debug questions
}
