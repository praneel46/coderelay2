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
import type { RankEntry, EvaluationStatus } from '../types/results';

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
  let teamsMap = new Map<string, { teamId: string; teamName: string; status: string; round2Eligible?: boolean }>();
  let resultsMap = new Map<string, FirestoreResultDoc>();

  const rebuildLeaderboard = () => {
    // 1. Source population: ALL qualified Round 2 teams
    const qualifiedTeams = Array.from(teamsMap.values()).filter(
      (t) =>
        t.round2Eligible === true ||
        t.status === 'QUALIFIED_FOR_ROUND_2' ||
        t.status === 'READY' ||
        t.status === 'ACTIVE' ||
        t.status === 'active' ||
        t.status === 'COMPLETED'
    );

    const rawEntries = qualifiedTeams.map((team) => {
      const d = resultsMap.get(team.teamId);
      const predictScore = d?.predictScore ?? 0;
      const debugMarks = d?.debugMarks ?? null;
      const codeMarks = d?.codeMarks ?? null;
      const debugCodeTotal =
        debugMarks !== null || codeMarks !== null
          ? (debugMarks ?? 0) + (codeMarks ?? 0)
          : null;
      const finalScore = predictScore + (debugMarks ?? 0) + (codeMarks ?? 0);

      let evaluationStatus: EvaluationStatus = 'pending';
      if (debugMarks !== null && codeMarks !== null) {
        evaluationStatus = 'evaluated';
      } else if (debugMarks !== null || codeMarks !== null) {
        evaluationStatus = 'in_progress';
      } else if (d?.evaluationStatus) {
        evaluationStatus = d.evaluationStatus;
      }

      return {
        teamId: team.teamId,
        teamName: team.teamName || d?.teamName || `Team ${team.teamId}`,
        predictScore,
        debugMarks,
        codeMarks,
        debugCodeTotal,
        finalScore,
        evaluationStatus,
        timing: d?.timing || {},
        tieBreakerApplied: false,
      };
    });

    // Strict tie-breaker sorting:
    // 1. Highest finalScore wins
    // 2. Lowest totalElapsedSeconds wins tie-break (time NEVER deducts score)
    // 3. Stable alphabetical teamId
    rawEntries.sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      const timeA = a.timing?.finalSubmittedAt
        ? new Date(a.timing.finalSubmittedAt).getTime()
        : a.timing?.totalElapsedSeconds ?? Number.MAX_SAFE_INTEGER;
      const timeB = b.timing?.finalSubmittedAt
        ? new Date(b.timing.finalSubmittedAt).getTime()
        : b.timing?.totalElapsedSeconds ?? Number.MAX_SAFE_INTEGER;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.teamId.localeCompare(b.teamId);
    });

    const entries: RankEntry[] = rawEntries.map((entry, index, arr) => {
      const isTiedWithPrev = index > 0 && arr[index - 1].finalScore === entry.finalScore;
      const isTiedWithNext = index < arr.length - 1 && arr[index + 1].finalScore === entry.finalScore;
      return {
        ...entry,
        rank: index + 1,
        tieBreakerApplied: isTiedWithPrev || isTiedWithNext,
      };
    });

    onUpdate(entries);
  };

  const unsubTeams = onSnapshot(
    collection(db, COLLECTIONS.TEAMS),
    (snapshot) => {
      teamsMap = new Map();
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        teamsMap.set(docSnap.id, {
          teamId: d.teamId || docSnap.id,
          teamName: d.teamName || `Team ${docSnap.id}`,
          status: d.status || 'QUALIFIED_FOR_ROUND_2',
          round2Eligible: d.round2Eligible ?? true,
        });
      });
      rebuildLeaderboard();
    },
    (err) => {
      if (onError) onError(err);
      else console.error('[Firestore] Teams subscription error in leaderboard:', err);
    }
  );

  const unsubResults = onSnapshot(
    collection(db, COLLECTIONS.RESULTS),
    (snapshot) => {
      resultsMap = new Map();
      snapshot.docs.forEach((docSnap) => {
        resultsMap.set(docSnap.id, docSnap.data() as FirestoreResultDoc);
      });
      rebuildLeaderboard();
    },
    (err) => {
      if (onError) onError(err);
      else console.error('[Firestore] Results subscription error in leaderboard:', err);
    }
  );

  return () => {
    unsubTeams();
    unsubResults();
  };
}

// ----------------------------------------------------------------
// Submissions Service
// ----------------------------------------------------------------
export async function saveSubmissionToFirestore(
  submission: Omit<Submission, 'submittedAt'> & { isCarriedForward?: boolean }
): Promise<string> {
  const submissionId = `${submission.teamId}_${submission.questionId}`;
  const subRef = doc(db, COLLECTIONS.SUBMISSIONS, submissionId);

  // Read current competition state to compute timing audit metadata
  let officialDeadline: string | null = null;
  let withinOfficialDeadline = true;
  let acceptedViaNetworkBuffer = false;

  try {
    const compSnap = await getDoc(doc(db, COLLECTIONS.COMPETITION, 'round2'));
    if (compSnap.exists()) {
      const compData = compSnap.data();
      let startTimeMs = 0;
      if (compData.startTime?.toDate) {
        startTimeMs = compData.startTime.toDate().getTime();
      } else if (compData.startTime) {
        startTimeMs = new Date(compData.startTime).getTime();
      }
      const durationSecs =
        compData.durationSeconds ||
        (submission.strikeId === 'strike1' ? 300 : submission.strikeId === 'strike2' ? 900 : 1200);

      if (startTimeMs > 0) {
        const deadlineMs = startTimeMs + durationSecs * 1000;
        officialDeadline = new Date(deadlineMs).toISOString();
        const now = Date.now();
        withinOfficialDeadline = now <= deadlineMs;
        acceptedViaNetworkBuffer = !withinOfficialDeadline;
      }
    }
  } catch (err) {
    console.warn('[Firestore] Could not calculate deadline metadata:', err);
  }

  const payload: Omit<FirestoreSubmissionDoc, 'submittedAt'> & { submittedAt: unknown } = {
    submissionId,
    teamId: submission.teamId,
    questionId: submission.questionId,
    round: 'round2',
    strikeId: submission.strikeId,
    answer: submission.answer,
    submittedAt: serverTimestamp(), // Authoritative server timestamp (required by security rules)
    serverReceivedAt: serverTimestamp(),
    clientSubmittedAt: new Date().toISOString(),
    officialDeadline,
    withinOfficialDeadline,
    acceptedViaNetworkBuffer,
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
