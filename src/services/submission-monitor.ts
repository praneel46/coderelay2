// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Authoritative Submission Monitor & Scoring Service
// Spark-only, Firestore-native, canonical teamId
// ============================================================

import type { Submission } from '../types/competition';
import type { StrikeTiming, RankEntry, EvaluationStatus } from '../types/results';
import type { FirestoreResultDoc } from '../firebase/schema';
import { doc, setDoc, type Firestore } from 'firebase/firestore';

export const STRIKE1_KEY: Record<string, { answer: string; points: number }> = {
  'q1-01': { answer: 'A', points: 10 },
  'q1-02': { answer: 'C', points: 10 },
  'q1-03': { answer: 'A', points: 10 },
};

export interface TeamSubmissionSummary {
  teamId: string;
  teamName: string;
  assignedJudgeId: string; // 'J001' or 'UNASSIGNED'
  judgeName?: string;
  // Strike 1
  strike1Submitted: boolean;
  strike1Score: number | null; // out of 30, null if not submitted
  strike1CompletedAt: string | null;
  // Strike 2
  strike2Submitted: boolean;
  strike2DebugMarks: number | null; // out of 60, null if not evaluated
  strike2CompletedAt: string | null;
  strike2EvaluatedAt?: string | null;
  // Strike 3
  strike3Submitted: boolean;
  strike3CodeMarks: number | null; // out of 60, null if not evaluated
  strike3CompletedAt: string | null;
  strike3EvaluatedAt?: string | null;
  // Aggregated
  finalScore: number | null; // sum of evaluated scores, null if no scores exist
  lastSubmittedAt: string | null; // authoritative participant submission timestamp
  status: 'NOT STARTED' | 'STRIKE 1 COMPLETE' | 'STRIKE 2 COMPLETE' | 'ROUND 2 FINISHED';
  evaluationStatus: EvaluationStatus;
  totalElapsedSeconds?: number;
  // Raw submissions list for audit view
  submissions: Submission[];
}

/**
 * Calculates Predict score from participant's Strike 1 MCQ submissions.
 * Returns null if the team has NOT submitted Strike 1.
 * Returns a number between 0 and 30 if Strike 1 was submitted.
 */
export function calculatePredictScore(
  teamSubs: Submission[],
  fallbackScore?: number | null
): number | null {
  const s1Subs = teamSubs.filter((s) => s.strikeId === 'strike1');
  const hasCompletion = s1Subs.some(
    (s) => s.questionId === 'strike1_completion' && s.status === 'submitted'
  );
  const mcqSubs = s1Subs.filter((s) => s.questionId !== 'strike1_completion' && s.status === 'submitted');

  if (!hasCompletion && mcqSubs.length === 0) {
    // Team has not submitted Strike 1
    if (typeof fallbackScore === 'number' && fallbackScore > 0) {
      return fallbackScore;
    }
    return null;
  }

  // If fallbackScore is explicitly provided and non-zero (e.g. from existing evaluated results or mock)
  if (typeof fallbackScore === 'number' && fallbackScore > 0 && mcqSubs.length === 0) {
    return fallbackScore;
  }

  // Auto-grade against STRIKE1_KEY
  let score = 0;
  for (const [qId, rule] of Object.entries(STRIKE1_KEY)) {
    const sub = mcqSubs.find((s) => s.questionId === qId);
    if (sub && sub.answer?.trim().toUpperCase() === rule.answer.toUpperCase()) {
      score += rule.points;
    }
  }

  return score;
}

/**
 * Extracts authoritative participant submission timestamps.
 * Critical: Never uses judge evaluation timestamps for competition timing.
 */
export function extractStrikeTimings(
  teamSubs: Submission[],
  existingTiming?: StrikeTiming
): StrikeTiming & { lastSubmittedAt: string | null } {
  // Helper to find earliest/latest ISO timestamp
  const getLatestTimestamp = (subs: Submission[]): string | null => {
    if (subs.length === 0) return null;
    const sorted = [...subs]
      .map((s) => s.submittedAt)
      .filter((t): t is string => Boolean(t))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return sorted[0] || null;
  };

  // Strike 1
  const s1Subs = teamSubs.filter((s) => s.strikeId === 'strike1' && s.status === 'submitted');
  const s1Completion = s1Subs.find((s) => s.questionId === 'strike1_completion');
  let strike1CompletedAt =
    s1Completion?.submittedAt ||
    getLatestTimestamp(s1Subs) ||
    existingTiming?.strike1CompletedAt ||
    null;

  // Strike 2
  const s2Subs = teamSubs.filter((s) => s.strikeId === 'strike2' && s.status === 'submitted');
  const s2Completion = s2Subs.find((s) => s.questionId === 'strike2_completion');
  let strike2CompletedAt =
    s2Completion?.submittedAt ||
    getLatestTimestamp(s2Subs) ||
    existingTiming?.strike2CompletedAt ||
    null;

  // Strike 3
  const s3Subs = teamSubs.filter((s) => s.strikeId === 'strike3' && s.status === 'submitted');
  const s3Completion = s3Subs.find((s) => s.questionId === 'strike3_completion');
  let strike3CompletedAt =
    s3Completion?.submittedAt ||
    getLatestTimestamp(s3Subs) ||
    existingTiming?.strike3CompletedAt ||
    null;

  let finalSubmittedAt =
    existingTiming?.finalSubmittedAt ||
    strike3CompletedAt ||
    strike2CompletedAt ||
    strike1CompletedAt ||
    null;

  // Last submission event (strictly participant submission)
  const validTimestamps = [strike1CompletedAt, strike2CompletedAt, strike3CompletedAt]
    .filter((t): t is string => Boolean(t))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const lastSubmittedAt = validTimestamps[0] || null;

  return {
    strike1CompletedAt,
    strike2CompletedAt,
    strike3CompletedAt,
    finalSubmittedAt,
    totalElapsedSeconds: existingTiming?.totalElapsedSeconds,
    lastSubmittedAt,
  };
}

/**
 * Builds the complete submission summaries for all qualified Round 2 teams.
 */
export function buildSubmissionSummaries(
  teams: { teamId: string; teamName: string; assignedJudgeId?: string; round2Eligible?: boolean; status?: string }[],
  allSubmissions: Submission[],
  resultsMap: Map<string, FirestoreResultDoc>,
  judgesMap: Map<string, { judgeId: string; name: string }>
): TeamSubmissionSummary[] {
  const qualified = teams.filter(
    (t) =>
      t.round2Eligible === true ||
      t.status === 'QUALIFIED_FOR_ROUND_2' ||
      t.status === 'READY' ||
      t.status === 'ACTIVE' ||
      t.status === 'active' ||
      t.status === 'COMPLETED'
  );

  // Group submissions by canonical teamId
  const subsByTeam = new Map<string, Submission[]>();
  for (const s of allSubmissions) {
    if (!subsByTeam.has(s.teamId)) {
      subsByTeam.set(s.teamId, []);
    }
    subsByTeam.get(s.teamId)!.push(s);
  }

  return qualified.map((team) => {
    const teamSubs = subsByTeam.get(team.teamId) || [];
    const resultDoc = resultsMap.get(team.teamId);

    // Judge info
    const assignedJudgeId = team.assignedJudgeId || (resultDoc as any)?.assignedJudgeId || 'UNASSIGNED';
    const judgeName = judgesMap.get(assignedJudgeId)?.name;

    // Timings
    const timings = extractStrikeTimings(teamSubs, resultDoc?.timing);

    // Strike 1
    const s1Subs = teamSubs.filter((s) => s.strikeId === 'strike1');
    const strike1Submitted =
      s1Subs.some((s) => s.status === 'submitted') || Boolean(timings.strike1CompletedAt);
    const strike1Score = strike1Submitted
      ? calculatePredictScore(teamSubs, resultDoc?.predictScore)
      : null;

    // Strike 2
    const s2Subs = teamSubs.filter((s) => s.strikeId === 'strike2');
    const strike2Submitted =
      s2Subs.some((s) => s.status === 'submitted') || Boolean(timings.strike2CompletedAt);
    const strike2DebugMarks = resultDoc?.debugMarks ?? null;

    // Strike 3
    const s3Subs = teamSubs.filter((s) => s.strikeId === 'strike3');
    const strike3Submitted =
      s3Subs.some((s) => s.status === 'submitted') || Boolean(timings.strike3CompletedAt);
    const strike3CodeMarks = resultDoc?.codeMarks ?? null;

    // Status derivation
    let status: TeamSubmissionSummary['status'] = 'NOT STARTED';
    if (strike3Submitted) {
      status = 'ROUND 2 FINISHED';
    } else if (strike2Submitted) {
      status = 'STRIKE 2 COMPLETE';
    } else if (strike1Submitted) {
      status = 'STRIKE 1 COMPLETE';
    }

    // Final score accumulation (null if no score has been recorded yet)
    let finalScore: number | null = null;
    if (strike1Score !== null || strike2DebugMarks !== null || strike3CodeMarks !== null) {
      finalScore = (strike1Score ?? 0) + (strike2DebugMarks ?? 0) + (strike3CodeMarks ?? 0);
    }

    let evaluationStatus: EvaluationStatus = 'pending';
    if (strike2DebugMarks !== null && strike3CodeMarks !== null) {
      evaluationStatus = 'evaluated';
    } else if (strike2DebugMarks !== null || strike3CodeMarks !== null) {
      evaluationStatus = 'in_progress';
    } else if (resultDoc?.evaluationStatus) {
      evaluationStatus = resultDoc.evaluationStatus;
    }

    return {
      teamId: team.teamId,
      teamName: team.teamName,
      assignedJudgeId,
      judgeName,
      strike1Submitted,
      strike1Score,
      strike1CompletedAt: timings.strike1CompletedAt || null,
      strike2Submitted,
      strike2DebugMarks,
      strike2CompletedAt: timings.strike2CompletedAt || null,
      strike2EvaluatedAt: resultDoc?.updatedAt || null,
      strike3Submitted,
      strike3CodeMarks,
      strike3CompletedAt: timings.strike3CompletedAt || null,
      strike3EvaluatedAt: resultDoc?.updatedAt || null,
      finalScore,
      lastSubmittedAt: timings.lastSubmittedAt || null,
      status,
      evaluationStatus,
      totalElapsedSeconds: timings.totalElapsedSeconds,
      submissions: teamSubs,
    };
  });
}

/**
 * Synchronizes auto-calculated Predict scores and submission timings to /results/{teamId}.
 * Only writes if updates are detected, minimizing Firestore write volume.
 */
export async function syncSubmissionsToResultsDoc(
  db: Firestore,
  summary: TeamSubmissionSummary,
  existingResult?: FirestoreResultDoc
): Promise<void> {
  const resultRef = doc(db, 'results', summary.teamId);

  const needsPredictUpdate =
    summary.strike1Score !== null &&
    (existingResult?.predictScore === undefined ||
      existingResult?.predictScore === 0 ||
      existingResult?.predictScore !== summary.strike1Score);

  const needsTimingUpdate =
    (summary.strike1CompletedAt && !existingResult?.timing?.strike1CompletedAt) ||
    (summary.strike2CompletedAt && !existingResult?.timing?.strike2CompletedAt) ||
    (summary.strike3CompletedAt && !existingResult?.timing?.strike3CompletedAt) ||
    (summary.lastSubmittedAt && !existingResult?.timing?.finalSubmittedAt);

  if (needsPredictUpdate || needsTimingUpdate) {
    const predict = summary.strike1Score ?? existingResult?.predictScore ?? 0;
    const debug = existingResult?.debugMarks ?? null;
    const code = existingResult?.codeMarks ?? null;
    const debugCodeTotal =
      debug !== null || code !== null ? (debug ?? 0) + (code ?? 0) : null;
    const finalScore =
      summary.finalScore !== null ? summary.finalScore : predict + (debug ?? 0) + (code ?? 0);

    const timingPayload: StrikeTiming = {
      strike1CompletedAt:
        summary.strike1CompletedAt || existingResult?.timing?.strike1CompletedAt || null,
      strike2CompletedAt:
        summary.strike2CompletedAt || existingResult?.timing?.strike2CompletedAt || null,
      strike3CompletedAt:
        summary.strike3CompletedAt || existingResult?.timing?.strike3CompletedAt || null,
      finalSubmittedAt:
        summary.lastSubmittedAt || existingResult?.timing?.finalSubmittedAt || null,
      totalElapsedSeconds: existingResult?.timing?.totalElapsedSeconds,
    };

    await setDoc(
      resultRef,
      {
        teamId: summary.teamId,
        teamName: summary.teamName,
        assignedJudgeId: summary.assignedJudgeId,
        predictScore: predict,
        debugMarks: debug,
        codeMarks: code,
        debugCodeTotal,
        finalScore,
        timing: timingPayload,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
}

/**
 * Authoritative tie-breaker ranking function.
 * 1. Final Score (Predict + Debug + Code) descending.
 * 2. Unsubmitted / unscored teams receive rank: null ('UNRANKED').
 * 3. Tied scores resolved by earlier final valid participant submission time.
 * 4. Time is purely a tie-breaker factor; NEVER deducted from marks.
 */
export function rankTeamsWithTieBreak(entries: RankEntry[]): RankEntry[] {
  const scored = entries.filter((e) => e.finalScore !== null);
  const unranked = entries.filter((e) => e.finalScore === null);

  scored.sort((a, b) => {
    if (b.finalScore !== a.finalScore) {
      return (b.finalScore ?? 0) - (a.finalScore ?? 0);
    }
    const timeA = a.timing?.finalSubmittedAt ? new Date(a.timing.finalSubmittedAt).getTime() : Infinity;
    const timeB = b.timing?.finalSubmittedAt ? new Date(b.timing.finalSubmittedAt).getTime() : Infinity;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    const elapsedA = a.timing?.totalElapsedSeconds ?? Infinity;
    const elapsedB = b.timing?.totalElapsedSeconds ?? Infinity;
    if (elapsedA !== elapsedB) {
      return elapsedA - elapsedB;
    }
    return a.teamId.localeCompare(b.teamId);
  });

  unranked.sort((a, b) => a.teamId.localeCompare(b.teamId));

  const rankedEntries: RankEntry[] = scored.map((entry, idx, arr) => {
    const prev = arr[idx - 1];
    const next = arr[idx + 1];
    const isTiedScore =
      (prev && prev.finalScore === entry.finalScore) ||
      (next && next.finalScore === entry.finalScore);

    return {
      ...entry,
      rank: idx + 1,
      tieBreakerApplied: !!isTiedScore,
    };
  });

  const unrankedEntries: RankEntry[] = unranked.map((entry) => ({
    ...entry,
    rank: null,
    tieBreakerApplied: false,
  }));

  return [...rankedEntries, ...unrankedEntries];
}

