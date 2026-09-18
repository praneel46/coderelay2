// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Firebase Firestore Service Layer
// Subscriptions, real-time listeners, and queries.
// ============================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import type {
  FirestoreCompetitionDoc,
  FirestoreSubmissionDoc,
  FirestoreEvaluationDoc,
  FirestoreResultDoc,
  FirestoreAuditLogDoc,
  FirestoreTeamDoc,
} from './schema';
import type { CompetitionState } from '../types/competition-state';
import type { Submission } from '../types/competition';
import type { RankEntry } from '../types/results';

// ----------------------------------------------------------------
// Collection References
// ----------------------------------------------------------------
export const COLLECTIONS = {
  COMPETITION: 'competition',
  TEAMS: 'teams',
  QUESTIONS: 'questions',
  SUBMISSIONS: 'submissions',
  JUDGES: 'judges',
  EVALUATIONS: 'evaluations',
  SESSIONS: 'sessions',
  RESULTS: 'results',
  AUDIT_LOGS: 'auditLogs',
  PRIVATE_ANSWERS: 'private_answers',
} as const;

// ----------------------------------------------------------------
// Real-time Competition State Listener
// ----------------------------------------------------------------
export function subscribeToCompetitionState(
  onUpdate: (state: CompetitionState) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const roundRef = doc(db, COLLECTIONS.COMPETITION, 'round2');

  return onSnapshot(
    roundRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as FirestoreCompetitionDoc;
        onUpdate({
          roundId: 'round2',
          phase: data.phase,
          currentStrikeId: data.currentStrikeId,
          activeStrike: data.startTime && data.endTime && data.currentStrikeId
            ? {
                strikeId: data.currentStrikeId,
                startedAt: data.startTime,
                endsAt: data.endTime,
              }
            : null,
          completedStrikes: data.completedStrikes || [],
          globalLock: data.globalLock || false,
          lastUpdatedAt: data.updatedAt || new Date().toISOString(),
        });
      }
    },
    (err) => {
      if (onError) onError(err);
      else console.error('[Firestore] Competition state subscription error:', err);
    }
  );
}

// ----------------------------------------------------------------
// Real-time Leaderboard Results Listener
// ----------------------------------------------------------------
export function subscribeToLeaderboard(
  onUpdate: (results: RankEntry[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const resultsQuery = query(collection(db, COLLECTIONS.RESULTS), orderBy('finalScore', 'desc'));

  return onSnapshot(
    resultsQuery,
    (snapshot) => {
      const entries: RankEntry[] = snapshot.docs.map((docSnap, index) => {
        const d = docSnap.data() as FirestoreResultDoc;
        return {
          rank: index + 1,
          teamId: d.teamId,
          teamName: d.teamName,
          predictScore: d.predictScore,
          debugMarks: d.debugMarks,
          codeMarks: d.codeMarks,
          debugCodeTotal: d.debugCodeTotal,
          finalScore: d.finalScore,
          evaluationStatus: d.evaluationStatus,
          timing: d.timing,
          tieBreakerApplied: d.tieBreakerApplied,
        };
      });
      onUpdate(entries);
    },
    (err) => {
      if (onError) onError(err);
      else console.error('[Firestore] Leaderboard subscription error:', err);
    }
  );
}

// ----------------------------------------------------------------
// Submissions Service
// ----------------------------------------------------------------
export async function saveSubmissionToFirestore(
  submission: Omit<Submission, 'submittedAt'> & { isCarriedForward?: boolean }
): Promise<string> {
  const submissionId = `${submission.teamId}_${submission.questionId}`;
  const subRef = doc(db, COLLECTIONS.SUBMISSIONS, submissionId);

  const payload: Omit<FirestoreSubmissionDoc, 'submittedAt'> & { submittedAt: unknown } = {
    submissionId,
    teamId: submission.teamId,
    questionId: submission.questionId,
    round: 'round2',
    strikeId: submission.strikeId,
    answer: submission.answer,
    submittedAt: serverTimestamp(), // Authoritative server timestamp
    status: 'submitted',
    isCarriedForward: submission.isCarriedForward || false,
  };

  await setDoc(subRef, payload, { merge: true });
  return submissionId;
}

export function subscribeToTeamSubmissions(
  teamId: string,
  onUpdate: (submissions: Submission[]) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.SUBMISSIONS), where('teamId', '==', teamId));
  return onSnapshot(q, (snapshot) => {
    const list: Submission[] = snapshot.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        questionId: d.questionId,
        teamId: d.teamId,
        strikeId: d.strikeId,
        answer: d.answer,
        submittedAt: d.submittedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        status: d.status,
        isCarriedForward: d.isCarriedForward,
      };
    });
    onUpdate(list);
  });
}
