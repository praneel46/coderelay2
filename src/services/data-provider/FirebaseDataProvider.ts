// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Firebase Data Provider
// Production-grade backend implementation using Firebase Auth,
// Cloud Firestore, and Security Rules (Spark-only architecture).
// ============================================================

import type { IDataProvider } from './types';
import type { CompetitionState } from '../../types/competition-state';
import type { Submission, StrikeId } from '../../types/competition';
import type { RankEntry, StrikeTiming, EvaluationStatus } from '../../types/results';
import type { EvaluationAuditEntry } from '../../types/judge';
import type { AuthUser } from '../../context/AuthContext';
import type { FirestoreResultDoc } from '../../firebase/schema';
import {
  signInOrganizerWithGoogle,
  signInJudgeWithCredentials,
  signInParticipantWithCredentials,
  signOutFromFirebase,
  subscribeToFirebaseAuthState,
  JUDGE_ACCOUNTS,
} from '../../firebase/auth';
import {
  subscribeToCompetitionState,
  subscribeToLeaderboard,
  saveSubmissionToFirestore,
  subscribeToTeamSubmissions,
  COLLECTIONS,
} from '../../firebase/firestore';
import {
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, auth } from '../../firebase/config';

const STRIKE_DURATIONS: Record<StrikeId, number> = {
  strike1: 5 * 60,   // 5 minutes (300s)
  strike2: 15 * 60,  // 15 minutes (900s)
  strike3: 20 * 60,  // 20 minutes (1200s)
};

import { sanitizeForFirestore } from '../../utils/sanitize';
export { sanitizeForFirestore };

export class FirebaseDataProvider implements IDataProvider {
  // ------------------------------------------------------------
  // Auth
  // ------------------------------------------------------------
  async loginParticipant(teamId: string, accessCode: string): Promise<AuthUser> {
    return signInParticipantWithCredentials(teamId, accessCode);
  }

  async loginOrganizer(): Promise<AuthUser> {
    return signInOrganizerWithGoogle();
  }

  async loginJudge(judgeId: string, password: string): Promise<AuthUser> {
    return signInJudgeWithCredentials(judgeId, password);
  }

  async logout(): Promise<void> {
    return signOutFromFirebase();
  }

  subscribeAuth(onUser: (user: AuthUser | null) => void): () => void {
    return subscribeToFirebaseAuthState(onUser);
  }

  // ------------------------------------------------------------
  // Competition State
  // ------------------------------------------------------------
  subscribeCompetitionState(onUpdate: (state: CompetitionState) => void, onError?: (err: Error) => void): () => void {
    return subscribeToCompetitionState(onUpdate, onError);
  }

  async startStrike(strikeId: StrikeId, teamId?: string): Promise<void> {
    const compRef = doc(db, COLLECTIONS.COMPETITION, 'round2');
    const compSnap = await getDoc(compRef);
    const currentData = compSnap.exists() ? compSnap.data() : null;

    // Filter out strikeId from completedStrikes so starting/restarting always works cleanly
    const rawCompleted: string[] = currentData?.completedStrikes || [];
    const completedStrikes = rawCompleted.filter((s) => s !== strikeId);

    const durationSeconds = STRIKE_DURATIONS[strikeId] || (strikeId === 'strike3' ? 1200 : strikeId === 'strike2' ? 900 : 300);
    const now = new Date();
    const startTime = now.toISOString();
    const endTime = new Date(now.getTime() + durationSeconds * 1000).toISOString();
    const actorUid = auth.currentUser?.uid || 'organizer';

    const updatePayload: Record<string, any> = {
      roundId: 'round2',
      currentStrikeId: strikeId,
      phase: 'active',
      status: strikeId.toUpperCase(),
      startTime,
      endTime,
      durationSeconds,
      completedStrikes,
      gracePeriodSeconds: 15,
      globalLock: false,
      updatedAt: startTime,
      updatedBy: actorUid,
      [`${strikeId}_startTime`]: startTime,
      [`${strikeId}_endTime`]: endTime,
      [`${strikeId}_durationSeconds`]: durationSeconds,
    };

    if (teamId) {
      updatePayload[`teamTimers.${teamId}.${strikeId}`] = {
        startedAt: startTime,
        endsAt: endTime,
        durationSeconds,
      };
    }

    await setDoc(compRef, updatePayload, { merge: true });

    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      logId: `log_${Date.now()}`,
      timestamp: startTime,
      actor: actorUid,
      role: 'organizer',
      action: 'START_STRIKE',
      target: strikeId,
      metadata: { startTime, endTime, durationSeconds, teamId: teamId || 'ALL' },
    });
  }

  async endStrike(strikeId: StrikeId): Promise<void> {
    const compRef = doc(db, COLLECTIONS.COMPETITION, 'round2');
    const compSnap = await getDoc(compRef);
    const currentData = compSnap.exists() ? compSnap.data() : null;

    const completedStrikes: StrikeId[] = currentData?.completedStrikes || [];
    if (strikeId && !completedStrikes.includes(strikeId)) {
      completedStrikes.push(strikeId);
    }

    const nowIso = new Date().toISOString();
    const actorUid = auth.currentUser?.uid || 'organizer';

    await setDoc(
      compRef,
      {
        phase: 'complete',
        currentStrikeId: null,
        completedStrikes,
        updatedAt: nowIso,
        updatedBy: actorUid,
      },
      { merge: true }
    );

    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      logId: `log_${Date.now()}`,
      timestamp: nowIso,
      actor: actorUid,
      role: 'organizer',
      action: 'END_STRIKE',
      target: strikeId,
    });
  }

  async pauseCompetition(): Promise<void> {
    const compRef = doc(db, COLLECTIONS.COMPETITION, 'round2');
    const nowIso = new Date().toISOString();
    const actorUid = auth.currentUser?.uid || 'organizer';

    await setDoc(
      compRef,
      {
        globalLock: true,
        updatedAt: nowIso,
        updatedBy: actorUid,
      },
      { merge: true }
    );

    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      logId: `log_${Date.now()}`,
      timestamp: nowIso,
      actor: actorUid,
      role: 'organizer',
      action: 'PAUSE_COMPETITION',
    });
  }

  async resumeCompetition(): Promise<void> {
    const compRef = doc(db, COLLECTIONS.COMPETITION, 'round2');
    const nowIso = new Date().toISOString();
    const actorUid = auth.currentUser?.uid || 'organizer';

    await setDoc(
      compRef,
      {
        globalLock: false,
        updatedAt: nowIso,
        updatedBy: actorUid,
      },
      { merge: true }
    );

    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      logId: `log_${Date.now()}`,
      timestamp: nowIso,
      actor: actorUid,
      role: 'organizer',
      action: 'RESUME_COMPETITION',
    });
  }

  async emergencyLock(): Promise<void> {
    const compRef = doc(db, COLLECTIONS.COMPETITION, 'round2');
    const nowIso = new Date().toISOString();
    const actorUid = auth.currentUser?.uid || 'organizer';

    await setDoc(
      compRef,
      {
        globalLock: true,
        phase: 'complete',
        updatedAt: nowIso,
        updatedBy: actorUid,
      },
      { merge: true }
    );

    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      logId: `log_${Date.now()}`,
      timestamp: nowIso,
      actor: actorUid,
      role: 'organizer',
      action: 'EMERGENCY_LOCK',
    });
  }

  async resetRound(): Promise<void> {
    const compRef = doc(db, COLLECTIONS.COMPETITION, 'round2');
    const nowIso = new Date().toISOString();
    const actorUid = auth.currentUser?.uid || 'organizer';

    await setDoc(compRef, {
      roundId: 'round2',
      currentStrikeId: null,
      phase: 'waiting',
      status: 'WAITING',
      startTime: null,
      endTime: null,
      completedStrikes: [],
      globalLock: false,
      updatedAt: nowIso,
      updatedBy: actorUid,
    });

    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      logId: `log_${Date.now()}`,
      timestamp: nowIso,
      actor: actorUid,
      role: 'organizer',
      action: 'RESET_ROUND',
    });
  }

  // ------------------------------------------------------------
  // Submissions
  // ------------------------------------------------------------
  async submitAnswer(submission: Omit<Submission, 'submittedAt'>): Promise<string> {
    return saveSubmissionToFirestore(submission);
  }

  subscribeTeamSubmissions(teamId: string, onUpdate: (subs: Submission[]) => void): () => void {
    return subscribeToTeamSubmissions(teamId, onUpdate);
  }

  // ------------------------------------------------------------
  // Leaderboard & Scoring
  // ------------------------------------------------------------
  subscribeLeaderboard(onUpdate: (results: RankEntry[]) => void, onError?: (err: Error) => void): () => void {
    return subscribeToLeaderboard(onUpdate, onError);
  }

  async updateTeamScores(
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
  ): Promise<void> {
    const canonicalTeamId = (teamId || '').trim().toUpperCase();
    if (!canonicalTeamId) {
      throw new Error('updateTeamScores: teamId is required.');
    }

    // Explicit validation before any database action (Safeguard 1)
    if (scores.debugMarks !== undefined && scores.debugMarks !== null) {
      if (typeof scores.debugMarks !== 'number' || isNaN(scores.debugMarks) || scores.debugMarks < 0 || scores.debugMarks > 60) {
        throw new Error(`Invalid debugMarks: ${scores.debugMarks}. Must be a valid number between 0 and 60.`);
      }
    }

    if (scores.codeMarks !== undefined && scores.codeMarks !== null) {
      if (typeof scores.codeMarks !== 'number' || isNaN(scores.codeMarks) || scores.codeMarks < 0 || scores.codeMarks > 60) {
        throw new Error(`Invalid codeMarks: ${scores.codeMarks}. Must be a valid number between 0 and 60.`);
      }
    }

    if (scores.predictScore !== undefined && scores.predictScore !== null) {
      if (typeof scores.predictScore !== 'number' || isNaN(scores.predictScore) || scores.predictScore < 0 || scores.predictScore > 30) {
        throw new Error(`Invalid predictScore: ${scores.predictScore}. Must be a valid number between 0 and 30.`);
      }
      if (scores.predictScoreSource === 'MANUAL_OVERRIDE' && !(scores.predictOverrideReason || '').trim()) {
        throw new Error('Override reason is required for manual Predict score override.');
      }
    }

    const evalId = `eval_${canonicalTeamId}`;
    const evalRef = doc(db, COLLECTIONS.EVALUATIONS, evalId);
    const resultRef = doc(db, COLLECTIONS.RESULTS, canonicalTeamId);

    // 1. Fetch existing result & evaluation documents to preserve un-updated scores and metadata
    let existingResult: FirestoreResultDoc | null = null;
    try {
      const resultSnap = await getDoc(resultRef);
      if (resultSnap.exists()) {
        existingResult = resultSnap.data() as FirestoreResultDoc;
      }
    } catch (err) {
      console.warn('[FirebaseDataProvider] Could not read existing result doc:', err);
    }

    let existingEval: any = null;
    try {
      const evalSnap = await getDoc(evalRef);
      if (evalSnap.exists()) {
        existingEval = evalSnap.data();
      }
    } catch (err) {
      // Non-fatal if does not exist or judge lacks permission on uncreated eval
    }

    // 2. Resolve authoritative Judge ID matching Security Rules currentJudgeId()
    const currentEmail = auth.currentUser?.email?.trim().toLowerCase() || '';
    const mappedJudge = JUDGE_ACCOUNTS[currentEmail];
    const authoritativeJudgeId =
      mappedJudge?.judgeId ||
      scores.judgeId ||
      existingEval?.judgeId ||
      existingResult?.assignedJudgeId ||
      'J001';

    const nowIso = new Date().toISOString();

    // 3. Resolve Predict Score (preserve existing, or use incoming; 0 is valid!)
    let predict: number | null = null;
    let predictSource: 'AUTO' | 'MANUAL_OVERRIDE' =
      (existingResult as any)?.predictScoreSource || 'AUTO';
    let overrideReason: string | null =
      (existingResult as any)?.predictOverrideReason || null;
    let overriddenBy: string | null =
      (existingResult as any)?.predictOverriddenBy || null;
    let overriddenAt: string | null =
      (existingResult as any)?.predictOverriddenAt || null;

    if (scores.predictScore !== undefined) {
      predict = scores.predictScore;
      if (scores.predictScoreSource === 'MANUAL_OVERRIDE') {
        predictSource = 'MANUAL_OVERRIDE';
        overrideReason = scores.predictOverrideReason?.trim() || 'Manual adjustment';
        overriddenBy = auth.currentUser?.uid || authoritativeJudgeId;
        overriddenAt = nowIso;
      }
    } else if (typeof existingResult?.predictScore === 'number') {
      predict = existingResult.predictScore;
    } else if (typeof existingEval?.predictScore === 'number') {
      predict = existingEval.predictScore;
    }

    // 4. Resolve Debug and Code marks (preserve untouched marks; 0 is valid!)
    const debug: number | null =
      scores.debugMarks !== undefined
        ? scores.debugMarks
        : typeof existingResult?.debugMarks === 'number'
        ? existingResult.debugMarks
        : typeof existingEval?.debugMarks === 'number'
        ? existingEval.debugMarks
        : null;

    const code: number | null =
      scores.codeMarks !== undefined
        ? scores.codeMarks
        : typeof existingResult?.codeMarks === 'number'
        ? existingResult.codeMarks
        : typeof existingEval?.codeMarks === 'number'
        ? existingEval.codeMarks
        : null;

    // 5. Aggregate calculated totals (Safeguard 5: Score State Matrix)
    // Both debug and code must be present for debugCodeTotal
    const debugCodeTotal: number | null =
      debug !== null && code !== null ? debug + code : null;

    // Final score is ONLY calculated when ALL THREE are present. Otherwise null.
    const finalScore: number | null =
      predict !== null && debug !== null && code !== null
        ? predict + debug + code
        : null;

    const evaluationStatus: EvaluationStatus =
      debug !== null && code !== null
        ? 'evaluated'
        : predict !== null || debug !== null || code !== null
        ? 'in_progress'
        : (existingResult?.evaluationStatus || 'pending');

    // 6. Preserve participant submission completion timings strictly (Bug 1 & Safeguard 2)
    const timingPayload: Record<string, any> = {
      strike1CompletedAt:
        scores.timing?.strike1CompletedAt ||
        existingResult?.timing?.strike1CompletedAt ||
        null,
      strike2CompletedAt:
        scores.timing?.strike2CompletedAt ||
        existingResult?.timing?.strike2CompletedAt ||
        null,
      strike3CompletedAt:
        scores.timing?.strike3CompletedAt ||
        existingResult?.timing?.strike3CompletedAt ||
        null,
      finalSubmittedAt:
        scores.timing?.finalSubmittedAt ||
        existingResult?.timing?.finalSubmittedAt ||
        null,
    };

    const elapsed =
      scores.timing?.totalElapsedSeconds !== undefined
        ? scores.timing.totalElapsedSeconds
        : existingResult?.timing?.totalElapsedSeconds !== undefined
        ? existingResult.timing.totalElapsedSeconds
        : undefined;

    // Only attach totalElapsedSeconds if it is a valid finite number; never undefined
    if (elapsed !== undefined && elapsed !== null && !isNaN(elapsed)) {
      timingPayload.totalElapsedSeconds = elapsed;
    }

    // 7. Construct and sanitize /results/{teamId} payload
    // If the document already exists, omit immutable fields (teamId, assignedJudgeId, timing)
    // so judge score saves adhere strictly to Security Rules !hasAny(['timing', 'teamId', 'assignedJudgeId'])
    const resultDocData = sanitizeForFirestore({
      ...(existingResult ? {} : { teamId: canonicalTeamId, assignedJudgeId: authoritativeJudgeId }),
      teamName: scores.teamName || existingResult?.teamName || `Team ${canonicalTeamId}`,
      predictScore: predict,
      predictScoreSource: predictSource,
      ...(overrideReason ? { predictOverrideReason: overrideReason } : {}),
      ...(overriddenBy ? { predictOverriddenBy: overriddenBy } : {}),
      ...(overriddenAt ? { predictOverriddenAt: overriddenAt } : {}),
      debugMarks: debug,
      codeMarks: code,
      debugCodeTotal,
      finalScore,
      evaluationStatus,
      ...(existingResult ? {} : { timing: timingPayload }),
      evaluatedAt: nowIso,
      ...(scores.debugMarks !== undefined ? { debugEvaluatedAt: nowIso } : {}),
      ...(scores.codeMarks !== undefined ? { codeEvaluatedAt: nowIso } : {}),
      updatedAt: nowIso,
    });

    await setDoc(resultRef, resultDocData, { merge: true });

    // 8. Construct and sanitize /evaluations/{evalId} payload
    const evalDocData = sanitizeForFirestore({
      evaluationId: evalId,
      teamId: canonicalTeamId,
      judgeId: authoritativeJudgeId,
      predictScore: predict ?? null,
      predictScoreSource: predictSource,
      debugMarks: debug,
      codeMarks: code,
      debugCodeTotal,
      finalScore,
      status: debug !== null && code !== null ? 'submitted' : 'in_progress',
      evaluatedAt: nowIso,
      updatedAt: nowIso,
    });

    await setDoc(evalRef, evalDocData, { merge: true });

    // 9. Write immutable audit log to /auditLogs
    try {
      const isOverride = scores.predictScoreSource === 'MANUAL_OVERRIDE';
      const auditPayload = sanitizeForFirestore({
        logId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        action: isOverride ? 'PREDICT_OVERRIDE' : 'UPDATE_SCORES',
        teamId: canonicalTeamId,
        judgeId: authoritativeJudgeId,
        actor: auth.currentUser?.uid || authoritativeJudgeId,
        previousPredictScore: existingResult?.predictScore ?? null,
        newPredictScore: predict,
        previousDebugMarks: existingResult?.debugMarks ?? null,
        newDebugMarks: debug,
        previousCodeMarks: existingResult?.codeMarks ?? null,
        newCodeMarks: code,
        finalScore,
        source: isOverride ? 'MANUAL_OVERRIDE' : 'JUDGE_INPUT',
        reason: isOverride ? overrideReason : null,
        timestamp: nowIso,
        note:
          scores.note ||
          (isOverride
            ? `Predict score manually overridden to ${predict}/30: ${overrideReason}`
            : debug !== null && code !== null
            ? 'Complete evaluation saved'
            : scores.debugMarks !== undefined
            ? `Debug score updated to ${scores.debugMarks}/60`
            : scores.codeMarks !== undefined
            ? `Code score updated to ${scores.codeMarks}/60`
            : 'Evaluation score adjusted'),
      });

      await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), auditPayload);
    } catch (auditErr) {
      console.warn('[FirebaseDataProvider] Could not write audit log:', auditErr);
    }
  }

  subscribeAuditLogs(onUpdate: (logs: EvaluationAuditEntry[]) => void, onError?: (err: Error) => void): () => void {
    const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy('timestamp', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const logs: EvaluationAuditEntry[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            auditId: d.logId || docSnap.id,
            teamId: d.teamId || '',
            judgeId: d.judgeId || d.actor || '',
            previousDebugMarks: d.previousDebugMarks ?? null,
            newDebugMarks: d.newDebugMarks ?? null,
            previousCodeMarks: d.previousCodeMarks ?? null,
            newCodeMarks: d.newCodeMarks ?? null,
            predictScore: d.predictScore ?? 0,
            finalScore: d.finalScore ?? 0,
            timestamp: d.timestamp || new Date().toISOString(),
            note: d.note,
          };
        });
        onUpdate(logs);
      },
      (err) => {
        if (onError) onError(err);
        else console.warn('[Firestore] Audit log subscription notice:', err.message);
      }
    );
  }

  getTeamEvaluation(teamId: string) {
    // Return nulls for unscored fields rather than hardcoded scores
    return {
      predictScore: null,
      debugMarks: null,
      codeMarks: null,
      debugCodeTotal: null,
      finalScore: null,
      status: 'pending' as const,
    };
  }

  getTeamTiming(teamId: string): StrikeTiming {
    return {
      strike1CompletedAt: null,
      strike2CompletedAt: null,
      strike3CompletedAt: null,
      finalSubmittedAt: null,
    };
  }
}
