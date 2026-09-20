// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Competition Context — manages competition state, submissions,
// authoritative timestamp recording, and live leaderboard with tie-breaking.
// Backed by dataProvider (Firebase / Mock).
// ============================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { CompetitionState, TeamTimerDoc } from '../types/competition-state';
import type { Submission, StrikeId, CarryForwardState } from '../types/competition';
import type { RankEntry, StrikeTiming } from '../types/results';
import type { EvaluationAuditEntry } from '../types/judge';
import { MOCK_INITIAL_STATE } from '../data/mock-competition-state';
import { MOCK_RESULTS } from '../data/mock-results';
import { dataProvider } from '../services/data-provider';
import { useAuth } from './AuthContext';
import { useSessionHeartbeat } from '../hooks/useSessionHeartbeat';
import { subscribeToTeamTimer } from '../firebase/firestore';

// ----------------------------------------------------------------
// Context value
// ----------------------------------------------------------------
export interface CompetitionContextValue {
  competitionState: CompetitionState;
  teamTimerDoc: TeamTimerDoc | null;
  submissions: Submission[];
  carryForward: CarryForwardState;
  results: RankEntry[];
  auditLogs: EvaluationAuditEntry[];

  // Organizer actions
  organizerStartStrike: (strikeId: StrikeId, teamId?: string, forceRestart?: boolean) => Promise<void>;
  organizerEndStrike: (strikeId: StrikeId, teamId?: string) => Promise<void>;
  organizerPauseStrike: () => Promise<void>;
  organizerResumeStrike: () => Promise<void>;
  organizerEmergencyLock: () => Promise<void>;
  organizerResetRound: () => Promise<void>;

  // Participant actions
  submitAnswer: (submission: Omit<Submission, 'submittedAt'>) => Promise<void>;
  isQuestionLocked: (questionId: string) => boolean;
  getSubmission: (questionId: string) => Submission | undefined;
  getTeamSubmissions: (teamId: string) => Submission[];

  // Timer expired — called by Timer component
  onStrikeTimerExpired: () => void;
  submitStrikeEarly: (strikeId: StrikeId) => Promise<void>;
  isStrikeCompleted: (strikeId: StrikeId) => boolean;

  // Judge scoring action
  updateTeamScores: (
    teamId: string,
    scores: {
      debugMarks?: number | null;
      codeMarks?: number | null;
      predictScore?: number | null;
      predictScoreSource?: 'AUTO' | 'MANUAL_OVERRIDE';
      predictOverrideReason?: string;
      judgeId?: string;
      note?: string;
    }
  ) => Promise<void>;
  getTeamEvaluation: (teamId: string) => {
    predictScore: number | null;
    debugMarks: number | null;
    codeMarks: number | null;
    debugCodeTotal: number | null;
    finalScore: number | null;
    status: 'pending' | 'in_progress' | 'submitted';
  };
  getTeamTiming: (teamId: string) => StrikeTiming;
}

const CompetitionContext = createContext<CompetitionContextValue | null>(null);

/**
 * Deterministic tie-breaker ranking logic:
 * 1. Final Score (Predict + Debug + Code) descending.
 * 2. If Final Score is equal: Earlier final valid submission/completion time wins.
 * 3. If final submission time is equal or missing: Earlier Strike 2 / Strike 1 completion.
 * (Time is purely a ranking tie-breaker factor; NEVER deducted from marks).
 */
export function rankTeamsWithTieBreak(entries: RankEntry[]): RankEntry[] {
  // Separate scored entries vs unranked entries (finalScore === null)
  const scored = entries.filter((e) => e.finalScore !== null);
  const unranked = entries.filter((e) => e.finalScore === null);

  scored.sort((a, b) => {
    // 1. Primary: Final score higher is better
    if (b.finalScore !== a.finalScore) {
      return (b.finalScore ?? 0) - (a.finalScore ?? 0);
    }

    // 2. Secondary: Time tie-break (Earlier valid submission time ranks higher)
    const timeA = a.timing?.finalSubmittedAt ? new Date(a.timing.finalSubmittedAt).getTime() : Infinity;
    const timeB = b.timing?.finalSubmittedAt ? new Date(b.timing.finalSubmittedAt).getTime() : Infinity;

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // 3. Tertiary: Total elapsed seconds (lower is better)
    const elapsedA = a.timing?.totalElapsedSeconds ?? Infinity;
    const elapsedB = b.timing?.totalElapsedSeconds ?? Infinity;
    if (elapsedA !== elapsedB) {
      return elapsedA - elapsedB;
    }

    // 4. Stable fallback: teamId alphabetical
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

// ----------------------------------------------------------------
// Provider
// ----------------------------------------------------------------
export function CompetitionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  useSessionHeartbeat();
  const [competitionState, setCompetitionState] = useState<CompetitionState>(MOCK_INITIAL_STATE);
  const [teamTimerDoc, setTeamTimerDoc] = useState<TeamTimerDoc | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [carryForward, setCarryForward] = useState<CarryForwardState>({ debugQuestionIds: [] });
  const [results, setResults] = useState<RankEntry[]>(() => rankTeamsWithTieBreak(MOCK_RESULTS));
  const [auditLogs, setAuditLogs] = useState<EvaluationAuditEntry[]>([]);

  // Real-time subscriptions through dataProvider (only active when authenticated)
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const unsubComp = dataProvider.subscribeCompetitionState(
      (state) => {
        setCompetitionState(state);
      },
      (err) => {
        console.warn('[CompetitionContext] Competition state subscription notice:', err.message);
      }
    );

    const unsubLeaderboard = dataProvider.subscribeLeaderboard(
      (newResults) => {
        setResults(rankTeamsWithTieBreak(newResults));
      },
      (err) => {
        console.warn('[CompetitionContext] Leaderboard subscription notice:', err.message);
      }
    );

    let unsubTeamTimer: (() => void) | undefined;
    let unsubTeamSubs: (() => void) | undefined;

    if (user?.team?.teamId) {
      unsubTeamTimer = subscribeToTeamTimer(
        user.team.teamId,
        (tDoc) => {
          setTeamTimerDoc(tDoc);
        },
        (err) => {
          console.warn('[CompetitionContext] Team timer subscription notice:', err.message);
        }
      );

      unsubTeamSubs = dataProvider.subscribeTeamSubmissions(
        user.team.teamId,
        (teamSubs) => {
          setSubmissions(teamSubs);
        }
      );
    }

    let unsubAudit: (() => void) | undefined;
    if (user?.role === 'organizer' || user?.isOrganizer) {
      unsubAudit = dataProvider.subscribeAuditLogs(
        (logs) => {
          setAuditLogs(logs);
        },
        (err) => {
          console.warn('[CompetitionContext] Audit logs subscription notice:', err.message);
        }
      );
    }

    return () => {
      unsubComp();
      unsubLeaderboard();
      if (unsubTeamTimer) unsubTeamTimer();
      if (unsubTeamSubs) unsubTeamSubs();
      if (unsubAudit) unsubAudit();
    };
  }, [isAuthenticated, user?.role, user?.isOrganizer, user?.team?.teamId]);

  // Compute carry-forward when strike2 completes
  useEffect(() => {
    const isStrike2Done =
      competitionState.completedStrikes.includes('strike2') ||
      teamTimerDoc?.completedStrikes?.includes('strike2') ||
      teamTimerDoc?.strike2?.status === 'completed';

    if (isStrike2Done) {
      const submittedDebugIds = submissions
        .filter((s) => s.strikeId === 'strike2' && s.status === 'submitted')
        .map((s) => s.questionId);
      const allDebugIds = ['q2-01', 'q2-02', 'q2-03'];
      const unsubmittedIds = allDebugIds.filter((id) => !submittedDebugIds.includes(id));
      setCarryForward({ debugQuestionIds: unsubmittedIds });
    }
  }, [competitionState.completedStrikes, teamTimerDoc?.completedStrikes, teamTimerDoc?.strike2?.status, submissions]);

  // ---------- Organizer actions ----------
  const organizerStartStrike = useCallback(async (strikeId: StrikeId, teamId?: string, forceRestart = false) => {
    await dataProvider.startStrike(strikeId, teamId, forceRestart);
  }, []);

  const organizerEndStrike = useCallback(async (strikeId: StrikeId, teamId?: string) => {
    await dataProvider.endStrike(strikeId, teamId);
  }, []);

  const organizerPauseStrike = useCallback(async () => {
    await dataProvider.pauseCompetition();
  }, []);

  const organizerResumeStrike = useCallback(async () => {
    await dataProvider.resumeCompetition();
  }, []);

  const organizerEmergencyLock = useCallback(async () => {
    await dataProvider.emergencyLock();
  }, []);

  const organizerResetRound = useCallback(async () => {
    await dataProvider.resetRound();
    setSubmissions([]);
    setCarryForward({ debugQuestionIds: [] });
    try {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('vr2_strike_')) sessionStorage.removeItem(k);
      });
    } catch {
      // ignore
    }
  }, []);

  // ---------- Timer expired ----------
  const onStrikeTimerExpired = useCallback(() => {
    // Timer reached 00:00: locks strike, does NOT auto-start next strike
    setCompetitionState((prev) => {
      if (!prev.currentStrikeId || prev.phase !== 'active') return prev;
      return {
        ...prev,
        phase: 'complete',
        activeStrike: null,
        completedStrikes: prev.completedStrikes.includes(prev.currentStrikeId)
          ? prev.completedStrikes
          : [...prev.completedStrikes, prev.currentStrikeId],
        lastUpdatedAt: new Date().toISOString(),
      };
    });
  }, []);

  // ---------- Participant actions ----------
  const isStrikeCompleted = useCallback(
    (strikeId: StrikeId): boolean => {
      const teamId = user?.team?.teamId;
      if (!teamId) return false;
      if (
        teamTimerDoc?.completedStrikes?.includes(strikeId) ||
        teamTimerDoc?.[strikeId]?.status === 'completed'
      ) {
        return true;
      }
      try {
        if (sessionStorage.getItem(`vr2_strike_${strikeId}_completed_${teamId}`)) {
          return true;
        }
      } catch {
        // ignore
      }
      return submissions.some(
        (s) => s.teamId === teamId && s.strikeId === strikeId && s.questionId === `${strikeId}_completion`
      );
    },
    [user?.team?.teamId, teamTimerDoc, submissions]
  );

  const submitStrikeEarly = useCallback(
    async (strikeId: StrikeId) => {
      const teamId = user?.team?.teamId;
      if (!teamId) return;
      const nowIso = new Date().toISOString();

      try {
        sessionStorage.setItem(`vr2_strike_${strikeId}_completed_${teamId}`, nowIso);
      } catch {
        // ignore
      }

      try {
        await dataProvider.endStrike(strikeId, teamId);
      } catch (err) {
        console.warn('[CompetitionContext] End strike call notice:', err);
      }

      try {
        await dataProvider.submitAnswer({
          questionId: `${strikeId}_completion`,
          teamId,
          strikeId,
          answer: JSON.stringify({ completedAt: nowIso, type: 'EARLY_COMPLETION' }),
          status: 'submitted',
        });
      } catch (err) {
        console.warn('[CompetitionContext] Early strike completion write notice:', err);
      }
    },
    [user?.team?.teamId]
  );

  const submitAnswer = useCallback(async (sub: Omit<Submission, 'submittedAt'>) => {
    await dataProvider.submitAnswer(sub);
    const nowIso = new Date().toISOString();
    const newSub: Submission = {
      ...sub,
      status: 'submitted',
      submittedAt: nowIso,
    };
    setSubmissions((prev) => [...prev.filter((s) => s.questionId !== sub.questionId), newSub]);
  }, []);

  const isQuestionLocked = useCallback(
    (questionId: string): boolean => {
      if (competitionState.globalLock) return true;
      const sub = submissions.find((s) => s.questionId === questionId);
      if (sub?.status === 'submitted' || sub?.status === 'locked') return true;
      if (competitionState.phase === 'complete' || competitionState.phase === 'finished') {
        return true;
      }
      return false;
    },
    [competitionState, submissions]
  );

  const getSubmission = useCallback(
    (questionId: string) => submissions.find((s) => s.questionId === questionId),
    [submissions]
  );

  const getTeamSubmissions = useCallback(
    (teamId: string) => submissions.filter((s) => s.teamId === teamId),
    [submissions]
  );

  const getTeamTiming = useCallback(
    (teamId: string): StrikeTiming => {
      const res = results.find((r) => r.teamId === teamId);
      if (res?.timing) {
        return res.timing;
      }
      return dataProvider.getTeamTiming(teamId);
    },
    [results]
  );

  const getTeamEvaluation = useCallback(
    (teamId: string) => {
      const res = results.find((r) => r.teamId === teamId);
      if (res) {
        return {
          predictScore: res.predictScore ?? null,
          debugMarks: res.debugMarks,
          codeMarks: res.codeMarks,
          debugCodeTotal: res.debugCodeTotal ?? null,
          finalScore: res.finalScore ?? null,
          status: (res.evaluationStatus === 'evaluated'
            ? 'submitted'
            : res.evaluationStatus) as 'pending' | 'in_progress' | 'submitted',
        };
      }
      return dataProvider.getTeamEvaluation(teamId);
    },
    [results]
  );

  const updateTeamScores = useCallback(
    async (
      teamId: string,
      scores: {
        debugMarks?: number | null;
        codeMarks?: number | null;
        predictScore?: number | null;
        predictScoreSource?: 'AUTO' | 'MANUAL_OVERRIDE';
        predictOverrideReason?: string;
        judgeId?: string;
        note?: string;
        timing?: StrikeTiming;
        teamName?: string;
      }
    ) => {
      const judgeId = scores.judgeId || user?.judgeId;
      await dataProvider.updateTeamScores(teamId, {
        ...scores,
        ...(judgeId ? { judgeId } : {}),
      });
    },
    [user?.judgeId]
  );

  return (
    <CompetitionContext.Provider
      value={{
        competitionState,
        teamTimerDoc,
        submissions,
        carryForward,
        results,
        auditLogs,
        organizerStartStrike,
        organizerEndStrike,
        organizerPauseStrike,
        organizerResumeStrike,
        organizerEmergencyLock,
        organizerResetRound,
        submitAnswer,
        submitStrikeEarly,
        isStrikeCompleted,
        isQuestionLocked,
        getSubmission,
        getTeamSubmissions,
        onStrikeTimerExpired,
        updateTeamScores,
        getTeamEvaluation,
        getTeamTiming,
      }}
    >
      {children}
    </CompetitionContext.Provider>
  );
}

export function useCompetition(): CompetitionContextValue {
  const ctx = useContext(CompetitionContext);
  if (!ctx) throw new Error('useCompetition must be used within CompetitionProvider');
  return ctx;
}
