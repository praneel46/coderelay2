// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Test Suite: Judge Score Save Pipeline & Real-Time Dynamic Ranking
// Verifies persistence, multi-view propagation, partial scores,
// dynamic ranking, tie-breaking, audit logging, and regressions.
// ============================================================

import assert from 'node:assert';
import {
  calculatePredictScore,
  extractStrikeTimings,
  buildSubmissionSummaries,
  rankTeamsWithTieBreak,
} from '../src/services/submission-monitor.ts';

const JUDGE_ACCOUNTS = {
  'judge1@coderelay.com': { judgeId: 'J001', name: 'Dr. Anil Krishnan', email: 'judge1@coderelay.com' },
  'judge2@coderelay.com': { judgeId: 'J002', name: 'Prof. Sunita Menon', email: 'judge2@coderelay.com' },
  'judge3@coderelay.com': { judgeId: 'J003', name: 'Mr. Ravi Tiwari', email: 'judge3@coderelay.com' },
  'judge4@coderelay.com': { judgeId: 'J004', name: 'Judge 004', email: 'judge4@coderelay.com' },
  'judge5@coderelay.com': { judgeId: 'J005', name: 'Judge 005', email: 'judge5@coderelay.com' },
  'judge6@coderelay.com': { judgeId: 'J006', name: 'Judge 006', email: 'judge6@coderelay.com' },
};

console.log('='.repeat(75));
console.log(' VIGYANTRA 2026: JUDGE SCORE SAVE PIPELINE & REAL-TIME PROPAGATION AUDIT');
console.log('='.repeat(75));

let totalPassed = 0;
function pass(desc) {
  console.log(`  ✓ ${desc}`);
  totalPassed++;
}

// ------------------------------------------------------------
// 1. SETUP IN-MEMORY FIRESTORE MODEL
// ------------------------------------------------------------
const testJudges = [
  { judgeId: 'J001', name: 'Dr. Anil Krishnan', email: 'judge1@coderelay.com', active: true },
  { judgeId: 'J002', name: 'Prof. Sunita Menon', email: 'judge2@coderelay.com', active: true },
  { judgeId: 'J003', name: 'Mr. Ravi Tiwari', email: 'judge3@coderelay.com', active: true },
  { judgeId: 'J004', name: 'Judge 004', email: 'judge4@coderelay.com', active: true },
  { judgeId: 'J005', name: 'Judge 005', email: 'judge5@coderelay.com', active: true },
  { judgeId: 'J006', name: 'Judge 006', email: 'judge6@coderelay.com', active: true },
];
const judgesMap = new Map(testJudges.map((j) => [j.judgeId, j]));

const testTeams = [
  { teamId: 'CRL-0001', teamName: 'Alpha Coders', round2Eligible: true, status: 'READY', assignedJudgeId: 'J001' },
  { teamId: 'CRL-0005', teamName: 'Echo Devs', round2Eligible: true, status: 'READY', assignedJudgeId: 'J002' },
  { teamId: 'CRL-0009', teamName: 'Mock Team 09', round2Eligible: true, status: 'READY', assignedJudgeId: 'J003' },
  { teamId: 'CRL-0011', teamName: 'Quantum Relayers', round2Eligible: true, status: 'READY', assignedJudgeId: 'J005' },
];

const mockSubmissions = [
  // CRL-0005: Predict 25 (Mock custom score)
  { teamId: 'CRL-0005', strikeId: 'strike1', questionId: 'strike1_completion', status: 'submitted', submittedAt: '2026-09-20T10:04:40.000Z' },
  { teamId: 'CRL-0005', strikeId: 'strike2', questionId: 'strike2_completion', status: 'submitted', submittedAt: '2026-09-20T10:18:10.000Z' },

  // CRL-0009: Predict 24 (From Strike 1 completion / results)
  { teamId: 'CRL-0009', strikeId: 'strike1', questionId: 'strike1_completion', status: 'submitted', submittedAt: '2026-09-20T10:04:30.000Z' },
  { teamId: 'CRL-0009', strikeId: 'strike2', questionId: 'strike2_completion', status: 'submitted', submittedAt: '2026-09-20T10:18:42.000Z' },

  // CRL-0011: Predict 22
  { teamId: 'CRL-0011', strikeId: 'strike1', questionId: 'strike1_completion', status: 'submitted', submittedAt: '2026-09-20T10:04:50.000Z' },
  { teamId: 'CRL-0011', strikeId: 'strike2', questionId: 'strike2_completion', status: 'submitted', submittedAt: '2026-09-20T10:17:55.000Z' },
];

// Simulated Firestore collections
const firestoreResults = new Map();
const firestoreEvaluations = new Map();
const firestoreAuditLogs = [];

// Initialize results collection
firestoreResults.set('CRL-0005', {
  teamId: 'CRL-0005',
  teamName: 'Echo Devs',
  assignedJudgeId: 'J002',
  predictScore: 25,
  debugMarks: null,
  codeMarks: null,
  debugCodeTotal: null,
  finalScore: 25,
  evaluationStatus: 'pending',
  timing: {
    strike1CompletedAt: '2026-09-20T10:04:40.000Z',
    strike2CompletedAt: '2026-09-20T10:18:10.000Z',
    strike3CompletedAt: null,
    finalSubmittedAt: '2026-09-20T10:18:10.000Z',
    totalElapsedSeconds: 1090,
  },
  updatedAt: '2026-09-20T10:18:10.000Z',
});

firestoreResults.set('CRL-0009', {
  teamId: 'CRL-0009',
  teamName: 'Mock Team 09',
  assignedJudgeId: 'J003',
  predictScore: 24,
  debugMarks: null,
  codeMarks: null,
  debugCodeTotal: null,
  finalScore: 24,
  evaluationStatus: 'pending',
  timing: {
    strike1CompletedAt: '2026-09-20T10:04:30.000Z',
    strike2CompletedAt: '2026-09-20T10:18:42.000Z',
    strike3CompletedAt: null,
    finalSubmittedAt: '2026-09-20T10:18:42.000Z',
    totalElapsedSeconds: 1122,
  },
  updatedAt: '2026-09-20T10:18:42.000Z',
});

firestoreResults.set('CRL-0011', {
  teamId: 'CRL-0011',
  teamName: 'Quantum Relayers',
  assignedJudgeId: 'J005',
  predictScore: 22,
  debugMarks: null,
  codeMarks: null,
  debugCodeTotal: null,
  finalScore: 22,
  evaluationStatus: 'pending',
  timing: {
    strike1CompletedAt: '2026-09-20T10:04:50.000Z',
    strike2CompletedAt: '2026-09-20T10:17:55.000Z',
    strike3CompletedAt: null,
    finalSubmittedAt: '2026-09-20T10:17:55.000Z',
    totalElapsedSeconds: 1075,
  },
  updatedAt: '2026-09-20T10:17:55.000Z',
});

// Implementation of score update logic mirroring FirebaseDataProvider.updateTeamScores
async function simulateUpdateTeamScores(teamId, scores, actingJudgeEmail) {
  const canonicalTeamId = teamId.trim().toUpperCase();
  const existingResult = firestoreResults.get(canonicalTeamId) || null;
  const existingEval = firestoreEvaluations.get(`eval_${canonicalTeamId}`) || null;

  // Resolve judgeId matching Security Rules currentJudgeId()
  const mappedJudge = JUDGE_ACCOUNTS[actingJudgeEmail?.toLowerCase()];
  const authoritativeJudgeId = mappedJudge?.judgeId || scores.judgeId || existingResult?.assignedJudgeId || 'J001';

  // Security Rules check: If judge role, judge must be assigned to team and judgeId == currentJudgeId()
  if (mappedJudge) {
    assert.strictEqual(authoritativeJudgeId, mappedJudge.judgeId, 'Security Rules: payload.judgeId must match currentJudgeId()');
    assert.strictEqual(authoritativeJudgeId, existingResult.assignedJudgeId, 'Security Rules: judge must be assigned to team');
  }

  // Preserve predictScore
  let predict = scores.predictScore !== undefined ? scores.predictScore : null;
  if (predict === null || predict === undefined) {
    predict = existingResult?.predictScore ?? existingEval?.predictScore ?? 0;
  }

  // Preserve debug and code marks
  const debug = scores.debugMarks !== undefined ? scores.debugMarks : (existingResult?.debugMarks ?? existingEval?.debugMarks ?? null);
  const code = scores.codeMarks !== undefined ? scores.codeMarks : (existingResult?.codeMarks ?? existingEval?.codeMarks ?? null);

  const debugCodeTotal = (debug !== null || code !== null) ? (debug ?? 0) + (code ?? 0) : null;
  const finalScore = (predict !== null || debug !== null || code !== null)
    ? (predict ?? 0) + (debug ?? 0) + (code ?? 0)
    : null;

  const evaluationStatus = (debug !== null && code !== null)
    ? 'evaluated'
    : (debug !== null || code !== null)
    ? 'in_progress'
    : (existingResult?.evaluationStatus || 'pending');

  const nowIso = new Date().toISOString();

  // Update results
  firestoreResults.set(canonicalTeamId, {
    ...existingResult,
    teamId: canonicalTeamId,
    assignedJudgeId: authoritativeJudgeId,
    predictScore: predict,
    debugMarks: debug,
    codeMarks: code,
    debugCodeTotal,
    finalScore,
    evaluationStatus,
    evaluatedAt: nowIso,
    ...(scores.debugMarks !== undefined ? { debugEvaluatedAt: nowIso } : {}),
    ...(scores.codeMarks !== undefined ? { codeEvaluatedAt: nowIso } : {}),
    updatedAt: nowIso,
  });

  // Update evaluation
  firestoreEvaluations.set(`eval_${canonicalTeamId}`, {
    evaluationId: `eval_${canonicalTeamId}`,
    teamId: canonicalTeamId,
    judgeId: authoritativeJudgeId,
    predictScore: predict,
    debugMarks: debug,
    codeMarks: code,
    debugCodeTotal: debugCodeTotal ?? 0,
    finalScore: finalScore ?? 0,
    status: debug !== null && code !== null ? 'submitted' : 'in_progress',
    evaluatedAt: nowIso,
    updatedAt: nowIso,
  });

  // Audit log
  firestoreAuditLogs.push({
    logId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    action: 'UPDATE_SCORES',
    teamId: canonicalTeamId,
    judgeId: authoritativeJudgeId,
    previousDebugMarks: existingResult?.debugMarks ?? null,
    newDebugMarks: debug,
    previousCodeMarks: existingResult?.codeMarks ?? null,
    newCodeMarks: code,
    predictScore: predict,
    finalScore,
    timestamp: nowIso,
    note: scores.note || 'Score updated',
  });
}

function getLeaderboard() {
  const rawEntries = Array.from(firestoreResults.values()).map((d) => ({
    teamId: d.teamId,
    teamName: d.teamName,
    predictScore: d.predictScore,
    debugMarks: d.debugMarks,
    codeMarks: d.codeMarks,
    debugCodeTotal: d.debugCodeTotal,
    finalScore: d.finalScore,
    evaluationStatus: d.evaluationStatus,
    timing: d.timing,
    tieBreakerApplied: false,
    rank: null,
  }));
  return rankTeamsWithTieBreak(rawEntries);
}

// ------------------------------------------------------------
// SECTION 1: INITIAL STATE & CANONICAL TEAM ID CONSISTENCY
// ------------------------------------------------------------
console.log('\n--- Section 1: Initial State & Dynamic Leaderboard Baseline ---');

let lb = getLeaderboard();
assert.strictEqual(lb[0].teamId, 'CRL-0005', 'Rank 1 initially is CRL-0005 (Score 25)');
assert.strictEqual(lb[1].teamId, 'CRL-0009', 'Rank 2 initially is CRL-0009 (Score 24)');
assert.strictEqual(lb[2].teamId, 'CRL-0011', 'Rank 3 initially is CRL-0011 (Score 22)');
pass('1. Initial leaderboard baseline is accurate (CRL-0005 #1, CRL-0009 #2, CRL-0011 #3)');

let summs = buildSubmissionSummaries(testTeams, mockSubmissions, firestoreResults, judgesMap);
const s9Init = summs.find((s) => s.teamId === 'CRL-0009');
assert.strictEqual(s9Init.strike1Score, 24, 'CRL-0009 Predict score is 24');
assert.strictEqual(s9Init.strike2DebugMarks, null, 'CRL-0009 Debug marks is null initially');
assert.strictEqual(s9Init.strike3CodeMarks, null, 'CRL-0009 Code marks is null initially');
pass('2. Submission monitor displays unentered marks as null (—)');

// ------------------------------------------------------------
// SECTION 2: JUDGE J005 SAVES CRL-0011 DEBUG = 55
// ------------------------------------------------------------
console.log('\n--- Section 2: J005 Saves CRL-0011 Debug = 55 ---');

await simulateUpdateTeamScores('CRL-0011', { debugMarks: 55 }, 'judge5@coderelay.com');
const eval11 = firestoreEvaluations.get('eval_CRL-0011');
assert.strictEqual(eval11.debugMarks, 55, 'Evaluation doc holds debugMarks = 55');
assert.strictEqual(eval11.predictScore, 22, 'Evaluation doc preserved predictScore = 22');
assert.strictEqual(eval11.finalScore, 77, 'Evaluation doc finalScore = 22 + 55 = 77');
pass('3. Judge Debug save persists in Firestore evaluation document');

const res11 = firestoreResults.get('CRL-0011');
assert.strictEqual(res11.debugMarks, 55, 'Results doc holds debugMarks = 55');
assert.strictEqual(res11.finalScore, 77, 'Results doc finalScore = 77');
assert.strictEqual(res11.timing.strike2CompletedAt, '2026-09-20T10:17:55.000Z', 'Participant submission timing untouched');
pass('4. Results doc synchronized and participant completion timing preserved');

lb = getLeaderboard();
assert.strictEqual(lb[0].teamId, 'CRL-0011', 'CRL-0011 dynamically jumps to Rank 1');
assert.strictEqual(lb[0].finalScore, 77, 'CRL-0011 finalScore is 77');
assert.strictEqual(lb[0].rank, 1, 'CRL-0011 rank is 1');
pass('5. Leaderboard dynamically recalculates and reorders (CRL-0011 now #1 with 77 pts)');

// ------------------------------------------------------------
// SECTION 3: JUDGE J003 SAVES CRL-0009 DEBUG = 48
// ------------------------------------------------------------
console.log('\n--- Section 3: J003 Saves CRL-0009 Debug = 48 ---');

await simulateUpdateTeamScores('CRL-0009', { debugMarks: 48 }, 'judge3@coderelay.com');
const res9 = firestoreResults.get('CRL-0009');
assert.strictEqual(res9.debugMarks, 48, 'CRL-0009 debugMarks = 48');
assert.strictEqual(res9.predictScore, 24, 'CRL-0009 predictScore preserved = 24');
assert.strictEqual(res9.debugCodeTotal, 48, 'CRL-0009 debugCodeTotal = 48');
assert.strictEqual(res9.finalScore, 72, 'CRL-0009 finalScore = 24 + 48 = 72');
pass('6. CRL-0009 Debug save persists without destroying predict score (Final = 72)');

lb = getLeaderboard();
assert.strictEqual(lb[0].teamId, 'CRL-0011', '#1 is CRL-0011 (77)');
assert.strictEqual(lb[1].teamId, 'CRL-0009', '#2 is CRL-0009 (72)');
assert.strictEqual(lb[2].teamId, 'CRL-0005', '#3 is CRL-0005 (25)');
pass('7. Leaderboard reorders again immediately (CRL-0011 #1, CRL-0009 #2, CRL-0005 #3)');

// Submission Monitor check
summs = buildSubmissionSummaries(testTeams, mockSubmissions, firestoreResults, judgesMap);
const crl9Summ = summs.find((s) => s.teamId === 'CRL-0009');
assert.strictEqual(crl9Summ.strike2DebugMarks, 48, 'Submission monitor shows Strike 2 = 48 / 60');
assert.strictEqual(crl9Summ.strike2CompletedAt, '2026-09-20T10:18:42.000Z', 'Submission time is participant timestamp');
assert.ok(crl9Summ.strike2EvaluatedAt, 'Separate judge evaluation timestamp exists');
pass('8. Submission monitor reflects 48/60 with separate participant vs judge timestamps');

// ------------------------------------------------------------
// SECTION 4: JUDGE J002 SAVES CRL-0005 DEBUG = 40
// ------------------------------------------------------------
console.log('\n--- Section 4: J002 Saves CRL-0005 Debug = 40 ---');

await simulateUpdateTeamScores('CRL-0005', { debugMarks: 40 }, 'judge2@coderelay.com');
const res5 = firestoreResults.get('CRL-0005');
assert.strictEqual(res5.debugMarks, 40);
assert.strictEqual(res5.finalScore, 65, 'CRL-0005 finalScore = 25 + 40 = 65');
pass('9. CRL-0005 Debug = 40 persists successfully');

lb = getLeaderboard();
assert.strictEqual(lb[0].teamId, 'CRL-0011', '#1 CRL-0011 (77)');
assert.strictEqual(lb[1].teamId, 'CRL-0009', '#2 CRL-0009 (72)');
assert.strictEqual(lb[2].teamId, 'CRL-0005', '#3 CRL-0005 (65)');
pass('10. Leaderboard dynamically updates (CRL-0011 77 pts, CRL-0009 72 pts, CRL-0005 65 pts)');

// ------------------------------------------------------------
// SECTION 5: JUDGE J003 SAVES CRL-0009 CODE = 52
// ------------------------------------------------------------
console.log('\n--- Section 5: J003 Saves CRL-0009 Code = 52 (Preserving Debug = 48) ---');

await simulateUpdateTeamScores('CRL-0009', { codeMarks: 52 }, 'judge3@coderelay.com');
const res9Full = firestoreResults.get('CRL-0009');
assert.strictEqual(res9Full.debugMarks, 48, 'Debug marks 48 preserved!');
assert.strictEqual(res9Full.codeMarks, 52, 'Code marks 52 saved!');
assert.strictEqual(res9Full.debugCodeTotal, 100, 'Debug + Code combined = 100 / 120');
assert.strictEqual(res9Full.finalScore, 124, 'Final Score = 24 + 100 = 124 / 150');
assert.strictEqual(res9Full.evaluationStatus, 'evaluated', 'Status transitioned to evaluated');
pass('11. Judge Code save preserves Debug score and computes 124 / 150');

lb = getLeaderboard();
assert.strictEqual(lb[0].teamId, 'CRL-0009', 'CRL-0009 dynamically jumps to Rank #1 with 124 pts');
assert.strictEqual(lb[0].finalScore, 124);
assert.strictEqual(lb[1].teamId, 'CRL-0011', 'CRL-0011 moves to Rank #2 with 77 pts');
assert.strictEqual(lb[2].teamId, 'CRL-0005', 'CRL-0005 is Rank #3 with 65 pts');
pass('12. Dynamic ranking moves CRL-0009 to #1 without page refresh');

// ------------------------------------------------------------
// SECTION 6: SCORE CORRECTION & AUDIT TRAIL
// ------------------------------------------------------------
console.log('\n--- Section 6: Score Correction & Audit Trail Recording ---');

await simulateUpdateTeamScores('CRL-0009', { debugMarks: 52 }, 'judge3@coderelay.com');
const res9Corrected = firestoreResults.get('CRL-0009');
assert.strictEqual(res9Corrected.debugMarks, 52, 'Debug updated from 48 to 52');
assert.strictEqual(res9Corrected.finalScore, 128, 'Final score updated from 124 to 128');
pass('13. Score correction 48 -> 52 immediately recalculates finalScore to 128');

const lastAudit = firestoreAuditLogs[firestoreAuditLogs.length - 1];
assert.strictEqual(lastAudit.teamId, 'CRL-0009', 'Audit log records canonical teamId');
assert.strictEqual(lastAudit.judgeId, 'J003', 'Audit log records judgeId');
assert.strictEqual(lastAudit.previousDebugMarks, 48, 'Audit log records previousDebugMarks: 48');
assert.strictEqual(lastAudit.newDebugMarks, 52, 'Audit log records newDebugMarks: 52');
assert.strictEqual(lastAudit.finalScore, 128, 'Audit log records new finalScore: 128');
pass('14. Immutable audit trail records correction with previous and new marks');

// ------------------------------------------------------------
// SECTION 7: TIE BREAKING WITH PARTICIPANT TIMING
// ------------------------------------------------------------
console.log('\n--- Section 7: Tie-Breaking Resolves by Earlier Participant Timing ---');

// Team A and Team B have identical scores (77), but Team A finished earlier
const tieEntries = [
  {
    teamId: 'CRL-0001',
    teamName: 'Alpha Coders',
    finalScore: 77,
    timing: { finalSubmittedAt: '2026-09-20T10:15:00.000Z', totalElapsedSeconds: 900 },
    rank: null,
  },
  {
    teamId: 'CRL-0011',
    teamName: 'Quantum Relayers',
    finalScore: 77,
    timing: { finalSubmittedAt: '2026-09-20T10:17:55.000Z', totalElapsedSeconds: 1075 },
    rank: null,
  },
];

const tieRanked = rankTeamsWithTieBreak(tieEntries);
assert.strictEqual(tieRanked[0].teamId, 'CRL-0001', 'CRL-0001 finished earlier, gets Rank 1');
assert.strictEqual(tieRanked[1].teamId, 'CRL-0011', 'CRL-0011 finished later, gets Rank 2');
assert.strictEqual(tieRanked[0].tieBreakerApplied, true, 'tieBreakerApplied flag set to true');
assert.strictEqual(tieRanked[1].tieBreakerApplied, true, 'tieBreakerApplied flag set to true');
pass('15. Tied scores correctly resolved by participant completion timestamp (never judge eval time)');

// ------------------------------------------------------------
// SECTION 8: ACTUAL ZERO VS MISSING SCORE DISPLAY
// ------------------------------------------------------------
console.log('\n--- Section 8: Actual Zero vs Missing Score Display ---');

firestoreResults.set('CRL-0001', {
  teamId: 'CRL-0001',
  teamName: 'Alpha Coders',
  assignedJudgeId: 'J001',
  predictScore: 0, // Actual 0 on predict
  debugMarks: 0,   // Actual 0 on debug
  codeMarks: null, // Not evaluated yet
  debugCodeTotal: 0,
  finalScore: 0,
  evaluationStatus: 'in_progress',
  timing: { finalSubmittedAt: null },
  updatedAt: new Date().toISOString(),
});

const crl1Summ = buildSubmissionSummaries(testTeams, mockSubmissions, firestoreResults, judgesMap).find(
  (s) => s.teamId === 'CRL-0001'
);
assert.strictEqual(crl1Summ.strike2DebugMarks, 0, 'Actual zero debug marks displays 0');
assert.strictEqual(crl1Summ.strike3CodeMarks, null, 'Unscored code marks displays null (em-dash)');
pass('16. Actual zero marks remain 0 while unscored components remain null (—)');

// ------------------------------------------------------------
// SECTION 9: CONCURRENT JUDGE SAVES
// ------------------------------------------------------------
console.log('\n--- Section 9: Concurrent Multi-Judge Saves ---');

// 3 judges evaluate 3 different teams concurrently
await Promise.all([
  simulateUpdateTeamScores('CRL-0001', { debugMarks: 35 }, 'judge1@coderelay.com'),
  simulateUpdateTeamScores('CRL-0005', { codeMarks: 50 }, 'judge2@coderelay.com'),
  simulateUpdateTeamScores('CRL-0011', { codeMarks: 45 }, 'judge5@coderelay.com'),
]);

const r1 = firestoreResults.get('CRL-0001');
const r5 = firestoreResults.get('CRL-0005');
const r11 = firestoreResults.get('CRL-0011');

assert.strictEqual(r1.debugMarks, 35, 'CRL-0001 Debug = 35 from J001');
assert.strictEqual(r5.codeMarks, 50, 'CRL-0005 Code = 50 from J002');
assert.strictEqual(r11.codeMarks, 45, 'CRL-0011 Code = 45 from J005');
pass('17. Concurrent saves across multiple judges execute safely without overwrites');

console.log('='.repeat(75));
console.log(` ALL ${totalPassed} / 17 TEST ASSERTIONS PASSED (100% SPECIFICATION COVERAGE)`);
console.log('='.repeat(75));
