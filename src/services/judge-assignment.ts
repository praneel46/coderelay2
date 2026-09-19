// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Authoritative Judge Assignment & Distribution Service
// Spark-only, Firestore-native, dynamic for any N teams and M judges
// ============================================================

export interface TeamAssignmentItem {
  teamId: string;
  teamName?: string;
  assignedJudgeId?: string | null;
}

export interface JudgeAssignmentItem {
  judgeId: string;
  name: string;
  email?: string;
  active: boolean;
  assignedTeamIds: string[];
  pendingCount?: number;
  evaluatedCount?: number;
}

/**
 * Deterministic round-robin equal distribution algorithm.
 * Dynamically handles ANY number of teams (N) and ANY number of active judges (M).
 * Guarantees:
 * 1. Every qualified team gets exactly one active judge assignment.
 * 2. No qualified team is left unassigned.
 * 3. No team is assigned to multiple judges.
 * 4. Maximum difference between any two judges' assigned team counts is <= 1.
 */
export function distributeTeamsToJudges(
  teams: { teamId: string }[],
  judges: { judgeId: string; active?: boolean }[]
): Record<string, string[]> {
  const activeJudges = judges.filter((j) => j.active !== false);
  if (activeJudges.length === 0) {
    return {};
  }

  // Deterministic sorting to ensure stable distribution across reloads
  const sortedTeams = [...teams].sort((a, b) => a.teamId.localeCompare(b.teamId));
  const sortedJudges = [...activeJudges].sort((a, b) => a.judgeId.localeCompare(b.judgeId));

  const result: Record<string, string[]> = {};
  for (const judge of sortedJudges) {
    result[judge.judgeId] = [];
  }

  // Round-robin distribution
  sortedTeams.forEach((team, index) => {
    const judge = sortedJudges[index % sortedJudges.length];
    result[judge.judgeId].push(team.teamId);
  });

  return result;
}

/**
 * Default fallback judge accounts (J001 through J006)
 */
export const DEFAULT_ACTIVE_JUDGES: JudgeAssignmentItem[] = [
  { judgeId: 'J001', name: 'Dr. Anil Krishnan', email: 'judge1@coderelay.com', active: true, assignedTeamIds: [], pendingCount: 0, evaluatedCount: 0 },
  { judgeId: 'J002', name: 'Prof. Sunita Menon', email: 'judge2@coderelay.com', active: true, assignedTeamIds: [], pendingCount: 0, evaluatedCount: 0 },
  { judgeId: 'J003', name: 'Mr. Ravi Tiwari', email: 'judge3@coderelay.com', active: true, assignedTeamIds: [], pendingCount: 0, evaluatedCount: 0 },
  { judgeId: 'J004', name: 'Judge 004', email: 'judge4@coderelay.com', active: true, assignedTeamIds: [], pendingCount: 0, evaluatedCount: 0 },
  { judgeId: 'J005', name: 'Judge 005', email: 'judge5@coderelay.com', active: true, assignedTeamIds: [], pendingCount: 0, evaluatedCount: 0 },
  { judgeId: 'J006', name: 'Judge 006', email: 'judge6@coderelay.com', active: true, assignedTeamIds: [], pendingCount: 0, evaluatedCount: 0 },
];

import { doc, getDocs, collection, setDoc, type Firestore } from 'firebase/firestore';

/**
 * Persists equal judge distribution to Firestore:
 * - Updates /judges/{judgeId} with assignedTeamIds
 * - Updates /teams/{teamId} with assignedJudgeId
 * - Initializes /results/{teamId} with assignedJudgeId and null placeholder scores
 */
export async function syncJudgeAssignmentsToFirestore(
  db: Firestore,
  qualifiedTeams: { teamId: string; teamName?: string }[],
  customJudges?: JudgeAssignmentItem[]
): Promise<Record<string, string[]>> {
  let judgesToUse = customJudges;

  if (!judgesToUse || judgesToUse.length === 0) {
    try {
      const judgesSnap = await getDocs(collection(db, 'judges'));
      if (!judgesSnap.empty) {
        judgesToUse = judgesSnap.docs.map((d) => d.data() as JudgeAssignmentItem);
      }
    } catch (err) {
      console.warn('[JudgeAssignment] Could not fetch judges collection, using defaults:', err);
    }
  }

  if (!judgesToUse || judgesToUse.length === 0) {
    judgesToUse = DEFAULT_ACTIVE_JUDGES;
  }

  const activeJudges = judgesToUse.filter((j) => j.active !== false);
  const assignments = distributeTeamsToJudges(qualifiedTeams, activeJudges);

  const writes: Promise<any>[] = [];

  // 1. Update /judges/{judgeId}
  for (const judge of activeJudges) {
    const assignedIds = assignments[judge.judgeId] || [];
    const judgeRef = doc(db, 'judges', judge.judgeId);
    writes.push(
      setDoc(
        judgeRef,
        {
          judgeId: judge.judgeId,
          name: judge.name,
          email: judge.email,
          active: true,
          assignedTeamIds: assignedIds,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
    );
  }

  // Map each team to assigned judge
  const teamToJudge = new Map<string, string>();
  for (const [judgeId, teamIds] of Object.entries(assignments)) {
    for (const teamId of teamIds) {
      teamToJudge.set(teamId, judgeId);
    }
  }

  // 2. Update /teams/{teamId} and initialize /results/{teamId}
  for (const team of qualifiedTeams) {
    const assignedJudgeId = teamToJudge.get(team.teamId) || null;
    const teamRef = doc(db, 'teams', team.teamId);
    writes.push(
      setDoc(
        teamRef,
        {
          assignedJudgeId,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
    );

    const resultRef = doc(db, 'results', team.teamId);
    writes.push(
      setDoc(
        resultRef,
        {
          teamId: team.teamId,
          teamName: team.teamName || team.teamId,
          assignedJudgeId,
          predictScore: 0,
          debugMarks: null,
          codeMarks: null,
          debugCodeTotal: null,
          finalScore: 0,
          evaluationStatus: 'pending',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
    );
  }

  await Promise.all(writes);
  return assignments;
}
