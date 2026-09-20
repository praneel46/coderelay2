// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Authoritative Leaderboard Ranking & Strike Timings
//
// Pure timing and ranking logic for client-facing Leaderboard.
// GUARANTEE: Zero private answer keys, zero grading rubrics.
// Safe for inclusion in shared participant/public client code.
// ============================================================

import type { Submission } from '../types/competition';
import type { StrikeTiming, RankEntry } from '../types/results';

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
  const strike1CompletedAt =
    s1Completion?.submittedAt ||
    getLatestTimestamp(s1Subs) ||
    existingTiming?.strike1CompletedAt ||
    null;

  // Strike 2
  const s2Subs = teamSubs.filter((s) => s.strikeId === 'strike2' && s.status === 'submitted');
  const s2Completion = s2Subs.find((s) => s.questionId === 'strike2_completion');
  const strike2CompletedAt =
    s2Completion?.submittedAt ||
    getLatestTimestamp(s2Subs) ||
    existingTiming?.strike2CompletedAt ||
    null;

  // Strike 3
  const s3Subs = teamSubs.filter((s) => s.strikeId === 'strike3' && s.status === 'submitted');
  const s3Completion = s3Subs.find((s) => s.questionId === 'strike3_completion');
  const strike3CompletedAt =
    s3Completion?.submittedAt ||
    getLatestTimestamp(s3Subs) ||
    existingTiming?.strike3CompletedAt ||
    null;

  const finalSubmittedAt =
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
    lastSubmittedAt,
    totalElapsedSeconds: existingTiming?.totalElapsedSeconds,
  };
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
