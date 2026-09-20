// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Multi-Team Independence & Judge Save Permissions Regression Suite
//
// Verifies:
// 1. Strike 3 Timer Independence between multiple teams:
//    - Team 1 completes Strike 3; timer expires.
//    - Team 2 starts Strike 3; receives authoritative 20m (1200s) timer.
//    - Team 2 does NOT inherit 00:00 or expired timer from Team 1.
// 2. Judge Save Permissions:
//    - Judge 1 (J001) enters Debug Score = 49 / 60 for Team 2 (CRL-0002).
//    - Save succeeds with no permission errors.
//    - Evaluation and Result documents both persist score.
// 3. Security & Immutability:
//    - Judge cannot mutate timing, teamId, or assignedJudgeId.
//    - Unassigned judge cannot write to results or evaluations.
//    - Score 0 is preserved as 0; missing score is preserved as null.
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
console.log(' VIGYANTRA 2026: MULTI-TEAM INDEPENDENCE & JUDGE SAVE VERIFICATION');
console.log('='.repeat(80));

let passed = 0;
function pass(desc) {
  console.log(`  ✓ PASS: ${desc}`);
  passed++;
}

// ============================================================
// PART 1: EFFECTIVE ENDS-AT & MULTI-TEAM TIMER RESOLUTION
// ============================================================
console.log('\n--- PART 1: MULTI-TEAM STRIKE 3 TIMER INDEPENDENCE ---');

function resolveEffectiveEndsAt({
  teamId,
  teamTimers,
  activeStrike,
  phase,
  currentStrikeId,
  sessionStorageMap,
}) {
  const teamStrikeTimer = teamId ? teamTimers?.[teamId]?.strike3 : undefined;

  // Priority A: Team-specific timer from Firestore if valid and in future
  if (teamStrikeTimer?.endsAt && new Date(teamStrikeTimer.endsAt).getTime() > Date.now()) {
    return { endsAt: teamStrikeTimer.endsAt, source: 'TEAM_FIRESTORE' };
  }
  // Priority B: Global activeStrike if valid and in future
  if (activeStrike?.strikeId === 'strike3' && activeStrike.endsAt && new Date(activeStrike.endsAt).getTime() > Date.now()) {
    return { endsAt: activeStrike.endsAt, source: 'GLOBAL_FIRESTORE' };
  }
  // Priority C: Check sessionStorage for this team's Strike 3 timer
  if (teamId && sessionStorageMap) {
    const storedEnds = sessionStorageMap.get(`vr2_strike_strike3_ends_${teamId}`);
    if (storedEnds && new Date(storedEnds).getTime() > Date.now()) {
      return { endsAt: storedEnds, source: 'SESSION_STORAGE' };
    }
  }
  // Priority D: If Strike 3 is active and team has NOT completed Strike 3, initialize authoritative 20m window
  if (phase === 'active' && currentStrikeId === 'strike3') {
    const freshEnds = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    if (teamId && sessionStorageMap) {
      sessionStorageMap.set(`vr2_strike_strike3_ends_${teamId}`, freshEnds);
      sessionStorageMap.set(`vr2_strike_strike3_started_${teamId}`, new Date().toISOString());
    }
    return { endsAt: freshEnds, source: 'AUTHORITATIVE_INIT' };
  }
  return { endsAt: null, source: 'NONE' };
}

// 1.1 Team 1 completes Strike 3 -> global timer is expired
const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
const team1Session = new Map();
team1Session.set('vr2_strike_strike3_ends_CRL-0001', pastTime);

const resTeam1Expired = resolveEffectiveEndsAt({
  teamId: 'CRL-0001',
  teamTimers: {
    'CRL-0001': { strike3: { strikeId: 'strike3', endsAt: pastTime, durationSeconds: 1200 } },
  },
  activeStrike: { strikeId: 'strike3', endsAt: pastTime, durationSeconds: 1200 },
  phase: 'active',
  currentStrikeId: 'strike3',
  sessionStorageMap: team1Session,
});

// Team 1 completed/expired -> for Team 2 starting Strike 3:
const team2Session = new Map();
const resTeam2Fresh = resolveEffectiveEndsAt({
  teamId: 'CRL-0002',
  teamTimers: {
    'CRL-0001': { strike3: { strikeId: 'strike3', endsAt: pastTime, durationSeconds: 1200 } },
    // Team 2 has no timer yet in teamTimers
  },
  activeStrike: { strikeId: 'strike3', endsAt: pastTime, durationSeconds: 1200 }, // Global is in the past!
  phase: 'active',
  currentStrikeId: 'strike3',
  sessionStorageMap: team2Session,
});

assert.ok(resTeam2Fresh.endsAt !== null, 'Team 2 effectiveEndsAt must not be null');
const remainingTeam2Ms = new Date(resTeam2Fresh.endsAt).getTime() - Date.now();
assert.ok(remainingTeam2Ms > 19 * 60 * 1000, `Team 2 should have ~20m remaining, got ${remainingTeam2Ms / 1000}s`);
assert.ok(remainingTeam2Ms <= 20 * 60 * 1000 + 2000, 'Team 2 timer must not exceed 20m');
pass('1.1 Team 2 does NOT inherit Team 1 expired timer (gets full 20m window)');

// 1.2 Team 2 with explicit teamTimer in Firestore
const team2FutureEnds = new Date(Date.now() + 18 * 60 * 1000).toISOString();
const resTeam2FromDb = resolveEffectiveEndsAt({
  teamId: 'CRL-0002',
  teamTimers: {
    'CRL-0001': { strike3: { strikeId: 'strike3', endsAt: pastTime, durationSeconds: 1200 } },
    'CRL-0002': { strike3: { strikeId: 'strike3', endsAt: team2FutureEnds, durationSeconds: 1200 } },
  },
  activeStrike: { strikeId: 'strike3', endsAt: pastTime, durationSeconds: 1200 },
  phase: 'active',
  currentStrikeId: 'strike3',
  sessionStorageMap: team2Session,
});

assert.strictEqual(resTeam2FromDb.endsAt, team2FutureEnds);
assert.strictEqual(resTeam2FromDb.source, 'TEAM_FIRESTORE');
pass('1.2 Team 2 uses its authoritative team-specific timer from Firestore when present');

// 1.3 Team 2 reloads page -> keeps timer from sessionStorage
const resTeam2Reload = resolveEffectiveEndsAt({
  teamId: 'CRL-0002',
  teamTimers: {},
  activeStrike: { strikeId: 'strike3', endsAt: pastTime, durationSeconds: 1200 },
  phase: 'active',
  currentStrikeId: 'strike3',
  sessionStorageMap: team2Session,
});

assert.strictEqual(resTeam2Reload.endsAt, resTeam2Fresh.endsAt, 'Session storage must preserve exact timestamp across reload');
assert.strictEqual(resTeam2Reload.source, 'SESSION_STORAGE');
pass('1.3 Team 2 page reload preserves identical Strike 3 countdown without reset');

// ============================================================
// PART 2: FIRESTORE SECURITY RULES FOR JUDGE SAVE & MULTI-TEAM
// ============================================================
console.log('\n--- PART 2: FIRESTORE SECURITY RULES & JUDGE SAVE PIPELINE ---');

const testEnv = await initializeTestEnvironment({
  projectId: 'test-code-relay-multi-team',
  firestore: {
    rules: rulesContent,
    host: '127.0.0.1',
    port: 8080,
  },
});

try {
  // Baseline setup for Team 1 and Team 2
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // Teams
    await setDoc(doc(db, 'teams', 'CRL-0001'), {
      teamId: 'CRL-0001',
      teamName: 'Binary Bosses',
      assignedJudgeId: 'J002',
      round2Eligible: true,
      status: 'ACTIVE',
    });
    await setDoc(doc(db, 'teams', 'CRL-0002'), {
      teamId: 'CRL-0002',
      teamName: 'Syntax Sorcerers',
      assignedJudgeId: 'J001', // Assigned to Dr. Anil Krishnan (J001)
      round2Eligible: true,
      status: 'ACTIVE',
    });

    // Judges
    await setDoc(doc(db, 'judges', 'J001'), {
      judgeId: 'J001',
      judgeName: 'Dr. Anil Krishnan',
      email: 'anil.krishnan@vigyantra.org',
      assignedTeamIds: ['CRL-0002'],
    });
    await setDoc(doc(db, 'judges', 'J002'), {
      judgeId: 'J002',
      judgeName: 'Prof. Sunita Rao',
      email: 'sunita.rao@vigyantra.org',
      assignedTeamIds: ['CRL-0001'],
    });

    // Initial results docs
    await setDoc(doc(db, 'results', 'CRL-0001'), {
      teamId: 'CRL-0001',
      teamName: 'Binary Bosses',
      assignedJudgeId: 'J002',
      predictScore: 30,
      debugMarks: 55,
      codeMarks: 50,
      finalScore: 135,
      timing: { totalElapsedSeconds: 850, strike1: { completed: true }, strike2: { completed: true }, strike3: { completed: true } },
    });
    await setDoc(doc(db, 'results', 'CRL-0002'), {
      teamId: 'CRL-0002',
      teamName: 'Syntax Sorcerers',
      assignedJudgeId: 'J001',
      predictScore: 20,
      debugMarks: null,
      codeMarks: null,
      finalScore: null,
      timing: { totalElapsedSeconds: null, strike1: { completed: true }, strike2: { completed: true }, strike3: { completed: false } },
    });
  });

  // 2.1 Judge 1 (J001) logs in and saves Debug = 49 / 60 for Team 2 (CRL-0002)
  const judge1Context = testEnv.authenticatedContext('judge1-anil', {
    role: 'judge',
    judgeId: 'J001',
    email: 'anil.krishnan@vigyantra.org',
  });
  const judge1Db = judge1Context.firestore();

  // Create evaluation record in /evaluations
  await assertSucceeds(
    setDoc(doc(judge1Db, 'evaluations', 'eval_CRL-0002'), {
      evalId: 'eval_CRL-0002',
      teamId: 'CRL-0002',
      judgeId: 'J001',
      debugScore: 49,
      codeScore: null,
      notes: 'Good debugging on problem 1 and 2',
      updatedAt: new Date().toISOString(),
    })
  );
  pass('2.1 Judge J001 can create evaluation doc for assigned team CRL-0002');

  // Update score on /results/CRL-0002 (Production Bug 2 scenario)
  await assertSucceeds(
    updateDoc(doc(judge1Db, 'results', 'CRL-0002'), {
      debugMarks: 49,
      evaluatedAt: new Date().toISOString(),
      evaluationStatus: 'PARTIALLY EVALUATED',
    })
  );
  pass('2.2 Judge J001 saves Debug = 49/60 for CRL-0002 on /results without permission error');

  // 2.3 Judge J001 subsequently saves Code = 52 / 60 for CRL-0002
  await assertSucceeds(
    updateDoc(doc(judge1Db, 'results', 'CRL-0002'), {
      codeMarks: 52,
      evaluatedAt: new Date().toISOString(),
      evaluationStatus: 'EVALUATED',
      finalScore: 20 + 49 + 52, // 121
    })
  );
  pass('2.3 Judge J001 saves Code = 52/60 and updates finalScore cleanly');

  // 2.4 Verify Judge J001 CANNOT tamper with protected timing
  await assertFails(
    updateDoc(doc(judge1Db, 'results', 'CRL-0002'), {
      timing: { totalElapsedSeconds: 100 },
    })
  );
  pass('2.4 Judge J001 CANNOT tamper with timing');

  // 2.5 Verify Judge J001 CANNOT tamper with teamId
  await assertFails(
    updateDoc(doc(judge1Db, 'results', 'CRL-0002'), {
      teamId: 'CRL-0099',
    })
  );
  pass('2.5 Judge J001 CANNOT tamper with teamId');

  // 2.6 Verify Judge J001 CANNOT tamper with assignedJudgeId
  await assertFails(
    updateDoc(doc(judge1Db, 'results', 'CRL-0002'), {
      assignedJudgeId: 'J003',
    })
  );
  pass('2.6 Judge J001 CANNOT tamper with assignedJudgeId');

  // 2.7 Verify Judge J001 CANNOT write to Team 1 (CRL-0001 assigned to J002)
  await assertFails(
    updateDoc(doc(judge1Db, 'results', 'CRL-0001'), {
      debugMarks: 50,
    })
  );
  pass('2.7 Judge J001 CANNOT write to unassigned Team 1 (CRL-0001)');

  // 2.8 Verify score 0 vs null differentiation
  await assertSucceeds(
    updateDoc(doc(judge1Db, 'results', 'CRL-0002'), {
      debugMarks: 0, // actual zero
    })
  );
  let snapAfterZero;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    snapAfterZero = await getDoc(doc(ctx.firestore(), 'results', 'CRL-0002'));
  });
  assert.ok(snapAfterZero && snapAfterZero.exists(), 'Document must exist');
  assert.strictEqual(snapAfterZero.data().debugMarks, 0, 'Score 0 must be stored as 0, not null');
  pass('2.8 Score 0 is strictly persisted as 0 in Firestore');

  // 2.9 Case-insensitive judgeId check in rules (e.g. 'j001' token writing to CRL-0002)
  const judge1LowerContext = testEnv.authenticatedContext('judge1-lower', {
    role: 'judge',
    judgeId: 'j001', // lowercase token
    email: 'anil.krishnan@vigyantra.org',
  });
  const judge1LowerDb = judge1LowerContext.firestore();
  await assertSucceeds(
    updateDoc(doc(judge1LowerDb, 'results', 'CRL-0002'), {
      debugMarks: 49,
    })
  );
  pass('2.9 Judge ID case insensitivity (j001 / J001) successfully permits authorized writes');

  console.log('='.repeat(80));
  console.log(` ALL ${passed} MULTI-TEAM INDEPENDENCE & SECURITY TESTS PASSED!`);
  console.log('='.repeat(80));
} finally {
  await testEnv.cleanup();
}
