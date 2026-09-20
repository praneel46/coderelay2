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
import type { CompetitionState, TeamTimerDoc } from '../types/competition-state';
import type { Submission } from '../types/competition';
import type { RankEntry, EvaluationStatus } from '../types/results';
import {
  rankTeamsWithTieBreak,
  extractStrikeTimings,
} from '../services/leaderboard-ranking';

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
  TEAM_TIMERS: 'teamTimers',
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
          teamTimers: (data as any).teamTimers || {},
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
// Real-time Team-Specific Authoritative Timer Listener
// ----------------------------------------------------------------
export function subscribeToTeamTimer(
  teamId: string,
  onUpdate: (timerDoc: TeamTimerDoc | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const canonicalTeamId = (teamId || '').trim().toUpperCase();
  const timerRef = doc(db, COLLECTIONS.TEAM_TIMERS, canonicalTeamId);

  return onSnapshot(
    timerRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as TeamTimerDoc);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      if (onError) onError(err);
      else console.warn(`[Firestore] Timer subscription error for ${canonicalTeamId}:`, err);
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
  let submissionsByTeam = new Map<string, Submission[]>();

  const rebuildLeaderboard = () => {
    // 1. Source population: ALL qualified Round 2 teams + any team in results or submissions
    const qualifiedTeamIds = new Set<string>();

    teamsMap.forEach((t, docId) => {
      const statusUpper = (t.status || '').toUpperCase();
      if (
        t.round2Eligible === true ||
        statusUpper === 'QUALIFIED_FOR_ROUND_2' ||
        statusUpper === 'READY' ||
        statusUpper === 'ACTIVE' ||
        statusUpper === 'COMPLETED'
      ) {
        qualifiedTeamIds.add((t.teamId || docId).trim().toUpperCase());
      }
    });

    // Also include any team present in resultsMap so no scored team ever disappears
    resultsMap.forEach((_res, docId) => {
      qualifiedTeamIds.add(docId.trim().toUpperCase());
    });

    // Also include any team with submissions
    submissionsByTeam.forEach((_subs, teamId) => {
      qualifiedTeamIds.add(teamId.trim().toUpperCase());
    });

    const rawEntries: RankEntry[] = Array.from(qualifiedTeamIds).map((canonicalTeamId) => {
      // Find matching team in teamsMap (case-insensitive)
      let teamObj = teamsMap.get(canonicalTeamId);
      if (!teamObj) {
        for (const [k, v] of teamsMap.entries()) {
          if (k.toUpperCase() === canonicalTeamId || v.teamId?.toUpperCase() === canonicalTeamId) {
            teamObj = v;
            break;
          }
        }
      }

      // Find matching result in resultsMap (case-insensitive)
      let d = resultsMap.get(canonicalTeamId);
      if (!d) {
        for (const [k, v] of resultsMap.entries()) {
          if (k.toUpperCase() === canonicalTeamId || v.teamId?.toUpperCase() === canonicalTeamId) {
            d = v;
            break;
          }
        }
      }

      // Find matching submissions (case-insensitive)
      let teamSubs = submissionsByTeam.get(canonicalTeamId) || [];
      if (teamSubs.length === 0) {
        for (const [k, v] of submissionsByTeam.entries()) {
          if (k.toUpperCase() === canonicalTeamId) {
            teamSubs = v;
            break;
          }
        }
      }

      // Authoritative predictScore comes exclusively from /results/{teamId} (0 is a valid score!)
      const predictScore: number | null = typeof d?.predictScore === 'number' ? d.predictScore : null;
      const debugMarks: number | null = typeof d?.debugMarks === 'number' ? d.debugMarks : null;
      const codeMarks: number | null = typeof d?.codeMarks === 'number' ? d.codeMarks : null;

      // Both debug and code must be evaluated for debugCodeTotal
      const debugCodeTotal: number | null =
        debugMarks !== null && codeMarks !== null ? debugMarks + codeMarks : null;

      // Final score is ONLY calculated when ALL THREE are present. Otherwise null (displays '—').
      const finalScore: number | null =
        predictScore !== null && debugMarks !== null && codeMarks !== null
          ? predictScore + debugMarks + codeMarks
          : null;

      let evaluationStatus: EvaluationStatus = 'pending';
      if (debugMarks !== null && codeMarks !== null) {
        evaluationStatus = 'evaluated';
      } else if (predictScore !== null || debugMarks !== null || codeMarks !== null) {
        evaluationStatus = 'in_progress';
      } else if (d?.evaluationStatus) {
        evaluationStatus = d.evaluationStatus;
      }

      const timing = extractStrikeTimings(teamSubs, d?.timing);

      return {
        teamId: canonicalTeamId,
        teamName: teamObj?.teamName || d?.teamName || `Team ${canonicalTeamId}`,
        predictScore,
        debugMarks,
        codeMarks,
        debugCodeTotal,
        finalScore,
        evaluationStatus,
        timing,
        tieBreakerApplied: false,
        rank: null,
      };
    });

    const entries = rankTeamsWithTieBreak(rawEntries);
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
          status: d.status,
          round2Eligible: d.round2Eligible,
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

  let unsubSubmissions = () => {};
  try {
    unsubSubmissions = onSnapshot(
      collection(db, COLLECTIONS.SUBMISSIONS),
      (snapshot) => {
        submissionsByTeam = new Map();
        snapshot.docs.forEach((docSnap) => {
          const sData = docSnap.data();
          const teamId = sData.teamId;
          if (!teamId) return;
          if (!submissionsByTeam.has(teamId)) {
            submissionsByTeam.set(teamId, []);
          }
          let submittedAtIso = '';
          if (sData.submittedAt?.toDate) {
            submittedAtIso = sData.submittedAt.toDate().toISOString();
          } else if (typeof sData.submittedAt === 'string') {
            submittedAtIso = sData.submittedAt;
          } else if (sData.clientSubmittedAt) {
            submittedAtIso = sData.clientSubmittedAt;
          } else {
            submittedAtIso = new Date().toISOString();
          }
          submissionsByTeam.get(teamId)!.push({
            questionId: sData.questionId || '',
            teamId,
            strikeId: sData.strikeId || 'strike1',
            answer: sData.answer || '',
            submittedAt: submittedAtIso,
            status: sData.status || 'submitted',
            isCarriedForward: sData.isCarriedForward,
          });
        });
        rebuildLeaderboard();
      },
      () => {
        // Expected and safe when called by participant due to Firestore security rules
      }
    );
  } catch {
    // ignore
  }

  return () => {
    unsubTeams();
    unsubResults();
    unsubSubmissions();
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

  // Read team's authoritative timer to compute timing audit metadata
  let officialDeadline: string | null = null;
  let withinOfficialDeadline = true;
  let acceptedViaNetworkBuffer = false;

  try {
    const canonicalTeamId = (submission.teamId || '').trim().toUpperCase();
    let teamStrikeTimer: { startedAt?: string; endsAt?: string; durationSeconds?: number } | null = null;

    // Check team's dedicated timer doc
    const timerSnap = await getDoc(doc(db, COLLECTIONS.TEAM_TIMERS, canonicalTeamId));
    if (timerSnap.exists()) {
      const tData = timerSnap.data() as TeamTimerDoc;
      teamStrikeTimer = tData[submission.strikeId] || null;
    }

    // Fallback to competition/round2 teamTimers map or global
    if (!teamStrikeTimer) {
      const compSnap = await getDoc(doc(db, COLLECTIONS.COMPETITION, 'round2'));
      if (compSnap.exists()) {
        const compData = compSnap.data();
        teamStrikeTimer = compData.teamTimers?.[canonicalTeamId]?.[submission.strikeId] || null;
        if (!teamStrikeTimer && compData.currentStrikeId === submission.strikeId) {
          teamStrikeTimer = {
            startedAt: compData.startTime,
            endsAt: compData.endTime,
            durationSeconds: compData.durationSeconds,
          };
        }
      }
    }

    if (teamStrikeTimer?.endsAt) {
      officialDeadline = teamStrikeTimer.endsAt;
      const deadlineMs = new Date(teamStrikeTimer.endsAt).getTime();
      const now = Date.now();
      withinOfficialDeadline = now <= deadlineMs;
      acceptedViaNetworkBuffer = !withinOfficialDeadline;
    }
  } catch (err) {
    console.warn('[Firestore] Could not calculate team deadline metadata:', err);
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
