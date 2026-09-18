import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const ALLOWED_ORIGINS = [
  'https://coderelay2.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

const STRIKE_DURATIONS: Record<string, number> = {
  strike1: 5 * 60,   // 5 minutes in seconds
  strike2: 15 * 60,  // 15 minutes in seconds
  strike3: 20 * 60,  // 20 minutes in seconds
};

function assertOrganizer(auth: any) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const isOrg = auth.token?.role === 'organizer' || auth.token?.isOrganizer === true;
  if (!isOrg) {
    throw new HttpsError('permission-denied', 'Only organizers can perform this action.');
  }
}

/**
 * Authoritative Start Strike Cloud Function.
 * Determines official server timestamps for startTime and endTime.
 */
export const startStrike = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  assertOrganizer(request.auth);

  const { strikeId } = request.data || {};
  if (!strikeId || !['strike1', 'strike2', 'strike3'].includes(strikeId)) {
    throw new HttpsError('invalid-argument', 'Invalid strikeId provided.');
  }

  const db = admin.firestore();
  const compRef = db.collection('competition').doc('round2');
  const compSnap = await compRef.get();
  const currentData = compSnap.exists ? compSnap.data() : null;

  // Strict state transition validation:
  // Strike 2 can only start if Strike 1 completed
  if (strikeId === 'strike2') {
    const completed = currentData?.completedStrikes || [];
    if (!completed.includes('strike1')) {
      throw new HttpsError('failed-precondition', 'Cannot start Strike 2 before Strike 1 is completed.');
    }
  }

  // Strike 3 can only start if Strike 2 completed
  if (strikeId === 'strike3') {
    const completed = currentData?.completedStrikes || [];
    if (!completed.includes('strike2')) {
      throw new HttpsError('failed-precondition', 'Cannot start Strike 3 before Strike 2 is completed.');
    }
  }

  const durationSeconds = STRIKE_DURATIONS[strikeId] || 300;
  const now = new Date();
  const startTime = now.toISOString();
  const endTime = new Date(now.getTime() + durationSeconds * 1000).toISOString();

  // Update competition document authoritatively
  await compRef.set(
    {
      roundId: 'round2',
      currentStrikeId: strikeId,
      phase: 'active',
      status: strikeId.toUpperCase(),
      startTime,
      endTime,
      globalLock: false,
      updatedAt: startTime,
      updatedBy: request.auth?.uid,
    },
    { merge: true }
  );

  // Write immutable audit log
  await db.collection('auditLogs').add({
    logId: `log_${Date.now()}`,
    timestamp: startTime,
    actor: request.auth?.uid,
    role: 'organizer',
    action: 'START_STRIKE',
    target: strikeId,
    metadata: { startTime, endTime, durationSeconds },
  });

  return {
    success: true,
    strikeId,
    startTime,
    endTime,
  };
});

/**
 * Authoritative End Strike Cloud Function.
 */
export const endStrike = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  assertOrganizer(request.auth);

  const { strikeId } = request.data || {};
  const db = admin.firestore();
  const compRef = db.collection('competition').doc('round2');
  const compSnap = await compRef.get();
  const currentData = compSnap.exists ? compSnap.data() : null;

  const completedStrikes = currentData?.completedStrikes || [];
  if (strikeId && !completedStrikes.includes(strikeId)) {
    completedStrikes.push(strikeId);
  }

  const nowIso = new Date().toISOString();

  await compRef.set(
    {
      phase: 'complete',
      activeStrike: null,
      completedStrikes,
      updatedAt: nowIso,
      updatedBy: request.auth?.uid,
    },
    { merge: true }
  );

  await db.collection('auditLogs').add({
    logId: `log_${Date.now()}`,
    timestamp: nowIso,
    actor: request.auth?.uid,
    role: 'organizer',
    action: 'END_STRIKE',
    target: strikeId,
  });

  return { success: true };
});

/**
 * Authoritative Pause Competition.
 */
export const pauseCompetition = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  assertOrganizer(request.auth);
  const db = admin.firestore();
  const nowIso = new Date().toISOString();

  await db.collection('competition').doc('round2').set(
    {
      globalLock: true,
      updatedAt: nowIso,
      updatedBy: request.auth?.uid,
    },
    { merge: true }
  );

  await db.collection('auditLogs').add({
    logId: `log_${Date.now()}`,
    timestamp: nowIso,
    actor: request.auth?.uid,
    role: 'organizer',
    action: 'PAUSE_COMPETITION',
  });

  return { success: true };
});

/**
 * Authoritative Resume Competition.
 */
export const resumeCompetition = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  assertOrganizer(request.auth);
  const db = admin.firestore();
  const nowIso = new Date().toISOString();

  await db.collection('competition').doc('round2').set(
    {
      globalLock: false,
      updatedAt: nowIso,
      updatedBy: request.auth?.uid,
    },
    { merge: true }
  );

  await db.collection('auditLogs').add({
    logId: `log_${Date.now()}`,
    timestamp: nowIso,
    actor: request.auth?.uid,
    role: 'organizer',
    action: 'RESUME_COMPETITION',
  });

  return { success: true };
});

/**
 * Authoritative Emergency Lock.
 */
export const emergencyLock = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  assertOrganizer(request.auth);
  const db = admin.firestore();
  const nowIso = new Date().toISOString();

  await db.collection('competition').doc('round2').set(
    {
      globalLock: true,
      phase: 'complete',
      updatedAt: nowIso,
      updatedBy: request.auth?.uid,
    },
    { merge: true }
  );

  await db.collection('auditLogs').add({
    logId: `log_${Date.now()}`,
    timestamp: nowIso,
    actor: request.auth?.uid,
    role: 'organizer',
    action: 'EMERGENCY_LOCK',
  });

  return { success: true };
});
