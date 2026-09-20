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

  async startStrike(strikeId: StrikeId): Promise<void> {
    const compRef = doc(db, COLLECTIONS.COMPETITION, 'round2');
    const compSnap = await getDoc(compRef);
    const currentData = compSnap.exists() ? compSnap.data() : null;

    // Transition validation
    if (strikeId === 'strike2') {
      const completed: string[] = currentData?.completedStrikes || [];
      if (!completed.includes('strike1')) {
        throw new Error('Cannot start Strike 2 before Strike 1 is completed.');
      }
    }
    if (strikeId === 'strike3') {
      const completed: string[] = currentData?.completedStrikes || [];
      if (!completed.includes('strike2')) {
        throw new Error('Cannot start Strike 3 before Strike 2 is completed.');
      }
    }

    const durationSeconds = STRIKE_DURATIONS[strikeId] || 300;
    const now = new Date();
    const startTime = now.toISOString();
    const endTime = new Date(now.getTime() + durationSeconds * 1000).toISOString();
    const actorUid = auth.currentUser?.uid || 'organizer';

    await setDoc(
      compRef,
      {
        roundId: 'round2',
        currentStrikeId: strikeId,
        phase: 'active',
        status: strikeId.toUpperCase(),
        startTime,
        endTime,
        durationSeconds,
        gracePeriodSeconds: 15,
        globalLock: false,
        updatedAt: startTime,
        updatedBy: actorUid,
      },
      { merge: true }
    );

    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      logId: `log_${Date.now()}`,
      timestamp: startTime,
      actor: actorUid,
      role: 'organizer',
      action: 'START_STRIKE',
      target: strikeId,
      metadata: { startTime, endTime, durationSeconds },
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
      predictScore?: number;
      judgeId?: string;
      note?: string;
      timing?: StrikeTiming;
      teamName?: string;
    }
  ): Promise<void> {
    const canonicalTeamId = teamId.trim().toUpperCase();
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

    // 3. Resolve Predict Score (preserve existing, or use incoming, never overwrite with 0)
    let predict = scores.predictScore !== undefined ? scores.predictScore : null;
    if (predict === null || predict === undefined) {
      if (typeof existingResult?.predictScore === 'number' && existingResult.predictScore > 0) {
        predict = existingResult.predictScore;
      } else if (typeof existingEval?.predictScore === 'number' && existingEval.predictScore > 0) {
        predict = existingEval.predictScore;
      } else {
        predict = existingResult?.predictScore ?? 0;
      }
    }

    // 4. Resolve Debug and Code marks (preserve untouched marks)
    const debug =
      scores.debugMarks !== undefined
        ? scores.debugMarks
        : existingResult?.debugMarks !== undefined
        ? existingResult.debugMarks
        : existingEval?.debugMarks !== undefined
        ? existingEval.debugMarks
        : null;

    const code =
      scores.codeMarks !== undefined
        ? scores.codeMarks
        : existingResult?.codeMarks !== undefined
        ? existingResult.codeMarks
        : existingEval?.codeMarks !== undefined
        ? existingEval.codeMarks
        : null;

    // 5. Aggregate calculated totals
    const debugCodeTotal =
      debug !== null || code !== null
        ? (debug ?? 0) + (code ?? 0)
        : null;

    const finalScore =
      predict !== null || debug !== null || code !== null
        ? (predict ?? 0) + (debug ?? 0) + (code ?? 0)
        : null;

    const evaluationStatus: EvaluationStatus =
      debug !== null && code !== null
        ? 'evaluated'
        : debug !== null || code !== null
        ? 'in_progress'
        : (existingResult?.evaluationStatus || 'pending');

    const nowIso = new Date().toISOString();

    // Preserve participant submission completion timings strictly
    const timingPayload: StrikeTiming = {
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
      totalElapsedSeconds:
        scores.timing?.totalElapsedSeconds ??
        existingResult?.timing?.totalElapsedSeconds,
    };

    // 6. Write to /results/{teamId} (authoritative source for leaderboard & submissions monitor)
    await setDoc(
      resultRef,
      {
        teamId: canonicalTeamId,
        teamName: scores.teamName || existingResult?.teamName || `Team ${canonicalTeamId}`,
        assignedJudgeId: authoritativeJudgeId,
        predictScore: predict,
        debugMarks: debug,
        codeMarks: code,
        debugCodeTotal,
        finalScore,
        evaluationStatus,
        timing: timingPayload,
        evaluatedAt: nowIso,
        ...(scores.debugMarks !== undefined ? { debugEvaluatedAt: nowIso } : {}),
        ...(scores.codeMarks !== undefined ? { codeEvaluatedAt: nowIso } : {}),
        updatedAt: nowIso,
      },
      { merge: true }
    );

    // 7. Write to /evaluations/{evalId} (detailed evaluation document)
    await setDoc(
      evalRef,
      {
        evaluationId: evalId,
        teamId: canonicalTeamId,
        judgeId: authoritativeJudgeId,
        predictScore: predict ?? 0,
        debugMarks: debug,
        codeMarks: code,
        debugCodeTotal: debugCodeTotal ?? 0,
        finalScore: finalScore ?? 0,
        status: debug !== null && code !== null ? 'submitted' : 'in_progress',
        evaluatedAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    // 8. Write immutable audit log to /auditLogs
    try {
      await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
        logId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        action: 'UPDATE_SCORES',
        teamId: canonicalTeamId,
        judgeId: authoritativeJudgeId,
        actor: auth.currentUser?.uid || authoritativeJudgeId,
        previousDebugMarks: existingResult?.debugMarks ?? null,
        newDebugMarks: debug,
        previousCodeMarks: existingResult?.codeMarks ?? null,
        newCodeMarks: code,
        predictScore: predict,
        finalScore,
        timestamp: nowIso,
        note:
          scores.note ||
          (debug !== null && code !== null
            ? 'Complete evaluation saved'
            : scores.debugMarks !== undefined
            ? `Debug score updated to ${scores.debugMarks}/60`
            : scores.codeMarks !== undefined
            ? `Code score updated to ${scores.codeMarks}/60`
            : 'Evaluation score adjusted'),
      });
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
    // In Firebase mode, evaluations are synced real-time into the result/eval collections
    return {
      predictScore: 24,
      debugMarks: null,
      codeMarks: null,
      debugCodeTotal: 0,
      finalScore: 24,
      status: 'pending' as const,
    };
  }

  getTeamTiming(teamId: string): StrikeTiming {
    return {
      strike1CompletedAt: null,
      strike2CompletedAt: null,
      strike3CompletedAt: null,
      finalSubmittedAt: null,
      totalElapsedSeconds: 0,
    };
  }
}
