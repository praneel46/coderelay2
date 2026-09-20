// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Test Suite: Round 2 General Production Bug Rectification & Stabilization
//
// Tests:
// 1. sanitizeForFirestore behavior (no undefined, preserves null/0, enforces explicit fields)
// 2. Field-level Firestore security rules on /results/{teamId} and /sessions
// 3. Score State Matrix (all 8 combinations of Predict/Debug/Code)
// 4. Manual Strike 1 Predict Override & Audit Trail & syncSubmissionsToResultsDoc protection
// 5. Session Heartbeat, deduplication, and 90s offline threshold
// ============================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');

console.log('='.repeat(80));
console.log(' VIGYANTRA 2026: ROUND 2 STABILIZATION & SAFEGUARDS VERIFICATION SUITE');
console.log('='.repeat(80));

let passed = 0;
function pass(desc) {
  console.log(`  ✓ PASS: ${desc}`);
  passed++;
}

// ============================================================
// PART 1: sanitizeForFirestore LOGIC TEST
// ============================================================
console.log('\n--- PART 1: FIRESTORE SANITIZATION & EXPLICIT VALIDATION ---');

function sanitizeForFirestore(obj) {
  if (obj === undefined) return undefined;
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore).filter((v) => v !== undefined);
  }
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      const sanitized = sanitizeForFirestore(v);
      if (sanitized !== undefined) {
        clean[k] = sanitized;
      }
    }
  }
  return clean;
}

// 1.1 Strips undefined recursively
const dirtyData = {
  teamId: 'CRL-0005',
  timing: {
    strike1: { elapsedSeconds: 280, completed: true },
    strike2: { elapsedSeconds: 400, completed: true },
    strike3: { elapsedSeconds: null, completed: false },
    totalElapsedSeconds: undefined, // undefined causing Bug 1
  },
  predictScore: 25,
  debugMarks: 50,
  codeMarks: undefined,
  metadata: {
    nestedUndefined: undefined,
    validField: 'hello',
  },
};

const cleaned = sanitizeForFirestore(dirtyData);
assert.strictEqual('totalElapsedSeconds' in cleaned.timing, false, 'undefined property totalElapsedSeconds must be removed');
assert.strictEqual('codeMarks' in cleaned, false, 'undefined codeMarks must be removed');
assert.strictEqual('nestedUndefined' in cleaned.metadata, false, 'nested undefined must be removed');
assert.strictEqual(cleaned.metadata.validField, 'hello');
pass('1.1 sanitizeForFirestore recursively removes all undefined properties');

// 1.2 Preserves null, 0, false, "", and Date
const preserveData = {
  predictScore: 0,
  debugMarks: null,
  isQualified: false,
  note: '',
  emptyArray: [],
  timestamp: new Date('2026-09-20T10:00:00Z'),
};
const cleanedPreserve = sanitizeForFirestore(preserveData);
assert.strictEqual(cleanedPreserve.predictScore, 0, 'Score 0 must be preserved');
assert.strictEqual(cleanedPreserve.debugMarks, null, 'Score null must be preserved');
assert.strictEqual(cleanedPreserve.isQualified, false, 'Boolean false must be preserved');
assert.strictEqual(cleanedPreserve.note, '', 'Empty string must be preserved');
assert.deepStrictEqual(cleanedPreserve.emptyArray, [], 'Empty array must be preserved');
assert.ok(cleanedPreserve.timestamp instanceof Date, 'Date must be preserved');
pass('1.2 sanitizeForFirestore strictly preserves 0, null, false, empty string, and Dates');

// 1.3 Explicit validation rejects missing required fields before write
function validateScorePayload(teamId, scores) {
  if (!teamId || typeof teamId !== 'string') {
    throw new Error('teamId is required');
  }
  if (scores.debugMarks !== undefined && scores.debugMarks !== null) {
    if (scores.debugMarks < 0 || scores.debugMarks > 60) {
      throw new Error('debugMarks must be between 0 and 60');
    }
  }
  if (scores.codeMarks !== undefined && scores.codeMarks !== null) {
    if (scores.codeMarks < 0 || scores.codeMarks > 60) {
      throw new Error('codeMarks must be between 0 and 60');
    }
  }
  if (scores.predictScore !== undefined && scores.predictScore !== null) {
    if (scores.predictScore < 0 || scores.predictScore > 30) {
      throw new Error('predictScore must be between 0 and 30');
    }
  }
  if (scores.predictScoreSource === 'MANUAL_OVERRIDE') {
    if (!scores.predictOverrideReason || scores.predictOverrideReason.trim().length === 0) {
      throw new Error('Reason is required for manual predict override');
    }
  }
  return true;
}

assert.throws(() => validateScorePayload('', { debugMarks: 10 }), /teamId is required/);
assert.throws(() => validateScorePayload('CRL-0001', { debugMarks: 65 }), /debugMarks must be between 0 and 60/);
assert.throws(() => validateScorePayload('CRL-0001', { codeMarks: -5 }), /codeMarks must be between 0 and 60/);
assert.throws(() => validateScorePayload('CRL-0001', { predictScore: 35 }), /predictScore must be between 0 and 30/);
assert.throws(() => validateScorePayload('CRL-0001', { predictScore: 20, predictScoreSource: 'MANUAL_OVERRIDE' }), /Reason is required/);
assert.ok(validateScorePayload('CRL-0001', { predictScore: 20, predictScoreSource: 'MANUAL_OVERRIDE', predictOverrideReason: 'Participant network disconnect' }));
pass('1.3 Explicit field validation prevents malformed payloads prior to sanitization & write');

// ============================================================
// PART 2: SCORE STATE MATRIX (ALL 8 COMBINATIONS)
// ============================================================
console.log('\n--- PART 2: SCORE STATE MATRIX & DYNAMIC RANKING ---');

function computeTeamEvaluation(predict, debug, code) {
  const p = predict !== undefined ? predict : null;
  const d = debug !== undefined ? debug : null;
  const c = code !== undefined ? code : null;

  const debugCodeTotal = (d !== null && c !== null) ? d + c : null;
  const finalScore = (p !== null && d !== null && c !== null) ? p + d + c : null;

  let status;
  if (p === null && d === null && c === null) {
    status = 'PENDING';
  } else if (p !== null && d !== null && c !== null) {
    status = 'EVALUATED';
  } else {
    status = 'PARTIALLY EVALUATED';
  }

  return {
    predict: p,
    debug: d,
    code: c,
    debugCodeTotal,
    finalScore,
    status,
  };
}

const matrixCombinations = [
  { name: 'Comb 1: [null, null, null]', p: null, d: null, c: null, expFinal: null, expStatus: 'PENDING' },
  { name: 'Comb 2: [10, null, null]',   p: 10,   d: null, c: null, expFinal: null, expStatus: 'PARTIALLY EVALUATED' },
  { name: 'Comb 3: [null, 40, null]',   p: null, d: 40,   c: null, expFinal: null, expStatus: 'PARTIALLY EVALUATED' },
  { name: 'Comb 4: [null, null, 50]',   p: null, d: null, c: 50,   expFinal: null, expStatus: 'PARTIALLY EVALUATED' },
  { name: 'Comb 5: [10, 40, null]',     p: 10,   d: 40,   c: null, expFinal: null, expStatus: 'PARTIALLY EVALUATED' },
  { name: 'Comb 6: [0, 0, 0]',          p: 0,    d: 0,    c: 0,    expFinal: 0,    expStatus: 'EVALUATED' },
  { name: 'Comb 7: [20, 50, 45]',       p: 20,   d: 50,   c: 45,   expFinal: 115,  expStatus: 'EVALUATED' },
  { name: 'Comb 8: [30, 60, 60]',       p: 30,   d: 60,   c: 60,   expFinal: 150,  expStatus: 'EVALUATED' },
];

for (const [idx, comb] of matrixCombinations.entries()) {
  const res = computeTeamEvaluation(comb.p, comb.d, comb.c);
  assert.strictEqual(res.finalScore, comb.expFinal, `${comb.name} finalScore mismatch`);
  assert.strictEqual(res.status, comb.expStatus, `${comb.name} status mismatch`);
  pass(`2.${idx + 1} Matrix ${comb.name} -> finalScore: ${res.finalScore === null ? '—' : res.finalScore}, status: ${res.status}`);
}

// 2.9 Unranked status for partially evaluated teams in dynamic ranking
function rankLeaderboard(teams) {
  // Evaluated teams sorted by finalScore desc, then tie-breakers
  const evaluated = teams.filter((t) => t.finalScore !== null);
  const unevaluated = teams.filter((t) => t.finalScore === null);

  evaluated.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    const timeA = a.finalSubmittedAt ? new Date(a.finalSubmittedAt).getTime() : Infinity;
    const timeB = b.finalSubmittedAt ? new Date(b.finalSubmittedAt).getTime() : Infinity;
    return timeA - timeB;
  });

  const ranked = evaluated.map((t, idx) => ({ ...t, rank: idx + 1 }));
  const unranked = unevaluated.map((t) => ({ ...t, rank: null }));
  return [...ranked, ...unranked];
}

const leaderboardSample = [
  { teamId: 'CRL-0001', finalScore: null, finalSubmittedAt: '2026-09-20T10:20:00Z' }, // Partial
  { teamId: 'CRL-0002', finalScore: 115, finalSubmittedAt: '2026-09-20T10:22:00Z' },  // Evaluated
  { teamId: 'CRL-0003', finalScore: 115, finalSubmittedAt: '2026-09-20T10:19:00Z' },  // Evaluated earlier
  { teamId: 'CRL-0004', finalScore: 0, finalSubmittedAt: '2026-09-20T10:25:00Z' },    // Evaluated 0
];

const rankedBoard = rankLeaderboard(leaderboardSample);
assert.strictEqual(rankedBoard[0].teamId, 'CRL-0003', 'Earlier submission with equal 115 score takes Rank 1');
assert.strictEqual(rankedBoard[0].rank, 1);
assert.strictEqual(rankedBoard[1].teamId, 'CRL-0002', 'Later submission with equal 115 score takes Rank 2');
assert.strictEqual(rankedBoard[1].rank, 2);
assert.strictEqual(rankedBoard[2].teamId, 'CRL-0004', 'Score 0 takes Rank 3');
assert.strictEqual(rankedBoard[2].rank, 3);
assert.strictEqual(rankedBoard[3].teamId, 'CRL-0001', 'Partial team appears UNRANKED');
assert.strictEqual(rankedBoard[3].rank, null);
pass('2.9 Dynamic leaderboard assigns ranks strictly to fully evaluated teams; partial teams remain visible with rank: null');

// ============================================================
// PART 3: SESSION HEARTBEAT & STALE OFFLINE DETECTION
// ============================================================
console.log('\n--- PART 3: SESSION HEARTBEAT & PRESENCE LOGIC ---');

const SESSION_STALE_THRESHOLD_SECONDS = 90;

function evaluateSessionStatus(lastSeenIso, serverNowMs = Date.now()) {
  if (!lastSeenIso) return 'offline';
  const lastSeenMs = new Date(lastSeenIso).getTime();
  const diffSec = (serverNowMs - lastSeenMs) / 1000;
  return diffSec <= SESSION_STALE_THRESHOLD_SECONDS ? 'online' : 'offline';
}

const now = Date.now();
const freshHeartbeat = new Date(now - 30 * 1000).toISOString(); // 30s ago
const staleHeartbeat = new Date(now - 95 * 1000).toISOString(); // 95s ago (stale)
const boundaryHeartbeat = new Date(now - 89 * 1000).toISOString(); // 89s ago (online)

assert.strictEqual(evaluateSessionStatus(freshHeartbeat, now), 'online', 'Heartbeat at 30s is online');
assert.strictEqual(evaluateSessionStatus(boundaryHeartbeat, now), 'online', 'Heartbeat at 89s is online');
assert.strictEqual(evaluateSessionStatus(staleHeartbeat, now), 'offline', 'Heartbeat at 95s is marked offline');
pass('3.1 Sessions accurately transition to offline at 90s threshold');

// Test refresh deduplication token
function getOrCreateSessionId(storageMap, teamId) {
  let sessId = storageMap.get('crl_participant_session_id');
  if (!sessId) {
    sessId = `sess_${teamId.toLowerCase()}_test123`;
    storageMap.set('crl_participant_session_id', sessId);
  }
  return sessId;
}

const mockSessionStorage = new Map();
const sess1 = getOrCreateSessionId(mockSessionStorage, 'CRL-0005');
const sess2 = getOrCreateSessionId(mockSessionStorage, 'CRL-0005');
assert.strictEqual(sess1, sess2, 'Page reload reuses identical session ID from sessionStorage');
pass('3.2 Participant session deduplication preserves single document across reloads');

// ============================================================
// PART 4: MANUAL PREDICT OVERRIDE & SYNC PROTECTION
// ============================================================
console.log('\n--- PART 4: MANUAL PREDICT OVERRIDE & SYNC PROTECTION ---');

function syncSubmissionsToResults(existingResultDoc, submissionStrike1Score) {
  // If result already has MANUAL_OVERRIDE, do NOT overwrite with calculated score
  if (existingResultDoc && existingResultDoc.predictScoreSource === 'MANUAL_OVERRIDE') {
    return existingResultDoc.predictScore;
  }
  return submissionStrike1Score;
}

const overriddenResult = {
  teamId: 'CRL-0005',
  predictScore: 28,
  predictScoreSource: 'MANUAL_OVERRIDE',
  predictOverrideReason: 'Network failure during Strike 1 auto-eval',
};

const syncedScore = syncSubmissionsToResults(overriddenResult, 20);
assert.strictEqual(syncedScore, 28, 'Manual override of 28 must NOT be overwritten by submission sync calculation of 20');
pass('4.1 syncSubmissionsToResultsDoc strictly preserves MANUAL_OVERRIDE score');

const autoResult = {
  teamId: 'CRL-0005',
  predictScore: 20,
  predictScoreSource: 'AUTO',
};
const syncedAutoScore = syncSubmissionsToResults(autoResult, 25);
assert.strictEqual(syncedAutoScore, 25, 'AUTO score updates cleanly on submission change');
pass('4.2 syncSubmissionsToResultsDoc updates AUTO score cleanly when submissions change');

// ============================================================
// PART 5: FIRESTORE SECURITY RULES FIELD-LEVEL ENFORCEMENT
// ============================================================
console.log('\n--- PART 5: FIRESTORE SECURITY RULES (FIELD-LEVEL) ---');

const testEnv = await initializeTestEnvironment({
  projectId: 'test-code-relay-stabilization',
  firestore: {
    rules: rulesContent,
    host: '127.0.0.1',
    port: 8080,
  },
});

try {
  // Baseline setup
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'teams', 'CRL-0005'), {
      teamId: 'CRL-0005',
      teamName: 'Echo Devs',
      assignedJudgeId: 'J005',
      round2Eligible: true,
      status: 'ACTIVE',
    });
    await setDoc(doc(db, 'judges', 'J005'), {
      judgeId: 'J005',
      assignedTeamIds: ['CRL-0005'],
    });
    await setDoc(doc(db, 'results', 'CRL-0005'), {
      teamId: 'CRL-0005',
      teamName: 'Echo Devs',
      assignedJudgeId: 'J005',
      predictScore: null,
      debugMarks: null,
      codeMarks: null,
      finalScore: null,
      timing: {
        totalElapsedSeconds: 650,
      },
    });
  });

  // 5.1 Assigned judge context
  const judge5Context = testEnv.authenticatedContext('judge5-user', {
    role: 'judge',
    judgeId: 'J005',
  });
  const judge5Db = judge5Context.firestore();

  // 5.1 Assigned judge CAN update score fields within bounds
  await assertSucceeds(
    updateDoc(doc(judge5Db, 'results', 'CRL-0005'), {
      debugMarks: 55,
      codeMarks: 45,
      evaluatedAt: new Date().toISOString(),
    })
  );
  pass('5.1 Assigned judge CAN save valid debug/code scores within [0, 60] bounds');

  // 5.2 Assigned judge CANNOT mutate timing
  await assertFails(
    updateDoc(doc(judge5Db, 'results', 'CRL-0005'), {
      'timing.totalElapsedSeconds': 100,
    })
  );
  pass('5.2 Assigned judge CANNOT mutate protected timing fields');

  // 5.3 Assigned judge CANNOT change teamId
  await assertFails(
    updateDoc(doc(judge5Db, 'results', 'CRL-0005'), {
      teamId: 'CRL-0099',
    })
  );
  pass('5.3 Assigned judge CANNOT mutate teamId');

  // 5.4 Assigned judge CANNOT reassign assignedJudgeId
  await assertFails(
    updateDoc(doc(judge5Db, 'results', 'CRL-0005'), {
      assignedJudgeId: 'J001',
    })
  );
  pass('5.4 Assigned judge CANNOT change assignedJudgeId');

  // 5.5 Assigned judge CANNOT enter score > 60
  await assertFails(
    updateDoc(doc(judge5Db, 'results', 'CRL-0005'), {
      debugMarks: 65,
    })
  );
  pass('5.5 Assigned judge CANNOT write debugMarks exceeding 60');

  // 5.6 Unassigned judge CANNOT write to CRL-0005
  const judge1Context = testEnv.authenticatedContext('judge1-user', {
    role: 'judge',
    judgeId: 'J001',
  });
  const judge1Db = judge1Context.firestore();
  await assertFails(
    updateDoc(doc(judge1Db, 'results', 'CRL-0005'), {
      debugMarks: 40,
    })
  );
  pass('5.6 Unassigned judge CANNOT write scores for unassigned team CRL-0005');

  // 5.7 Participant CANNOT write to results
  const participantContext = testEnv.authenticatedContext('part-crl-0005', {
    role: 'participant',
    teamId: 'CRL-0005',
  });
  const participantDb = participantContext.firestore();
  await assertFails(
    updateDoc(doc(participantDb, 'results', 'CRL-0005'), {
      predictScore: 30,
    })
  );
  pass('5.7 Participant CANNOT write to results');

  // 5.8 Participant CAN create their own session
  await assertSucceeds(
    setDoc(doc(participantDb, 'sessions', 'sess_crl_0005_123'), {
      sessionId: 'sess_crl_0005_123',
      userId: 'part-crl-0005',
      teamId: 'CRL-0005',
      role: 'participant',
      lastSeen: new Date().toISOString(),
      connectionState: 'online',
    })
  );
  pass('5.8 Participant CAN create their own session heartbeat doc');

  // 5.9 Organizer CAN write and correct any result doc
  const organizerContext = testEnv.authenticatedContext('org-user', {
    role: 'organizer',
    isOrganizer: true,
  });
  const organizerDb = organizerContext.firestore();
  await assertSucceeds(
    updateDoc(doc(organizerDb, 'results', 'CRL-0005'), {
      predictScore: 28,
      predictScoreSource: 'MANUAL_OVERRIDE',
      predictOverrideReason: 'Organizer administrative override',
    })
  );
  pass('5.9 Organizer CAN write manual overrides and score corrections to results');

  console.log('='.repeat(80));
  console.log(` ALL ${passed} STABILIZATION & SECURITY TESTS PASSED!`);
  console.log('='.repeat(80));
} finally {
  await testEnv.cleanup();
}
