// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Firebase Data Provider
// Production-grade backend implementation using Firebase Auth,
// Cloud Firestore, and 2nd Gen Cloud Functions.
// ============================================================

import type { IDataProvider } from './types';
import type { CompetitionState } from '../../types/competition-state';
import type { Submission, StrikeId } from '../../types/competition';
import type { RankEntry, StrikeTiming } from '../../types/results';
import type { EvaluationAuditEntry } from '../../types/judge';
import type { AuthUser } from '../../context/AuthContext';
import {
  signInOrganizerWithGoogle,
  signInJudgeWithCredentials,
  signInParticipantWithCredentials,
  signOutFromFirebase,
  subscribeToFirebaseAuthState,
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
    const evalId = `eval_${teamId}`;
    const evalRef = doc(db, COLLECTIONS.EVALUATIONS, evalId);

    const predict = scores.predictScore ?? 0;
    const debug = scores.debugMarks ?? 0;
    const code = scores.codeMarks ?? 0;
    const total = predict + debug + code;

    const payload = {
      evaluationId: evalId,
      teamId,
      judgeId: scores.judgeId || 'J001',
      predictScore: predict,
      debugMarks: scores.debugMarks,
      codeMarks: scores.codeMarks,
      debugCodeTotal: debug + code,
      finalScore: total,
      status: scores.debugMarks !== null && scores.codeMarks !== null ? 'submitted' : 'in_progress',
      updatedAt: new Date().toISOString(),
    };

    await setDoc(evalRef, payload, { merge: true });

    // Also update public results document for leaderboard
    const resultRef = doc(db, COLLECTIONS.RESULTS, teamId);
    await setDoc(
      resultRef,
      {
        teamId,
        ...(scores.teamName ? { teamName: scores.teamName } : {}),
        predictScore: predict,
        debugMarks: scores.debugMarks,
        codeMarks: scores.codeMarks,
        debugCodeTotal: debug + code,
        finalScore: total,
        evaluationStatus: scores.debugMarks !== null && scores.codeMarks !== null ? 'evaluated' : 'in_progress',
        ...(scores.timing ? { timing: scores.timing } : {}),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
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
