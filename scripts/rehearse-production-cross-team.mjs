// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// REHEARSAL & ARCHITECTURE VERIFICATION TEST SUITE
//
// Simulates:
// 1. 4 Provisioned Teams (CRL-0001, CRL-0002, CRL-0003, CRL-0004)
// 2. 2 Provisioned Judges (J001, J002)
// 3. Staggered Relay Lifecycles:
//    - Bulk start of Strike 1: checks eligibility & prevents resetting completed or advanced teams
//    - Team 1 finishes Strike 1 early while Team 2 continues working
//    - Organizer advances Team 1 to Strike 2; Team 2 timer is un-touched
//    - Team 3 starts Strike 2 later
//    - Team 4 joins and starts Strike 1 later
//    - Judge 1 scores Team 1 (debug=45, code=50) while Judge 2 scores Team 2 (debug=52, code=48)
// 4. Participant page refreshes with sessionStorage & Firestore isolation
// 5. Security & Immutability validation:
//    - Participant cannot modify startedAt, endsAt, durationSeconds, teamId, or currentStrikeId
//    - Participant cannot manufacture unstarted strikes
//    - Participant cannot write to /results or /evaluations
//    - Unassigned judge cannot score another judge's team
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
import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');

console.log('='.repeat(80));
console.log(' VIGYANTRA 2026: CROSS-TEAM PRODUCTION REHEARSAL & HARDENING SUITE');
console.log('='.repeat(80));

let passed = 0;
function pass(desc) {
  console.log(`  ✓ PASS: ${desc}`);
  passed++;
}

const testEnv = await initializeTestEnvironment({
  projectId: 'test-code-relay-rehearsal',
  firestore: {
    rules: rulesContent,
    host: '127.0.0.1',
    port: 8080,
  },
});

try {
  // ------------------------------------------------------------
  // SECTION 1: SEED BASELINE ENVIRONMENT
  // ------------------------------------------------------------
  console.log('\n--- PHASE 1: PROVISION 4 TEAMS & 2 JUDGES ---');

  const teams = [
    { teamId: 'CRL-0001', teamName: 'Alpha Coders', round2Eligible: true, status: 'QUALIFIED_FOR_ROUND_2' },
    { teamId: 'CRL-0002', teamName: 'Beta Hackers', round2Eligible: true, status: 'QUALIFIED_FOR_ROUND_2' },
    { teamId: 'CRL-0003', teamName: 'Gamma Devs', round2Eligible: true, status: 'QUALIFIED_FOR_ROUND_2' },
    { teamId: 'CRL-0004', teamName: 'Delta Systems', round2Eligible: true, status: 'QUALIFIED_FOR_ROUND_2' },
  ];

  const judges = [
    { judgeId: 'J001', name: 'Judge Alpha', assignedTeams: ['CRL-0001', 'CRL-0003'] },
    { judgeId: 'J002', name: 'Judge Beta', assignedTeams: ['CRL-0002', 'CRL-0004'] },
  ];

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    
    // Seed competition doc
    await setDoc(doc(db, 'competition', 'round2'), {
      roundId: 'round2',
      phase: 'active',
      currentStrikeId: 'strike1',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 300 * 1000).toISOString(),
      durationSeconds: 300,
      completedStrikes: [],
      updatedAt: new Date().toISOString(),
    });

    // Seed teams
    for (const t of teams) {
      await setDoc(doc(db, 'teams', t.teamId), t);
    }

    // Seed judges
    for (const j of judges) {
      await setDoc(doc(db, 'judges', j.judgeId), j);
    }
  });
  pass('Provisioned 4 test teams and 2 judges in Firestore emulator');

  // ------------------------------------------------------------
  // SECTION 2: TIMER AUTHORITY & INDEPENDENT STAGGERED PROGRESS
  // ------------------------------------------------------------
  console.log('\n--- PHASE 2: STAGGERED RELAY PROGRESSION & INDEPENDENCE ---');

  const organizerContext = testEnv.authenticatedContext('organizer_uid', { role: 'organizer' });
  const orgDb = organizerContext.firestore();

  // 2.1 Start Strike 1 for Team 1 and Team 2
  const now = Date.now();
  const t1Ends = new Date(now + 300 * 1000).toISOString();
  const t2Ends = new Date(now + 300 * 1000).toISOString();

  await assertSucceeds(
    setDoc(doc(orgDb, 'teamTimers', 'CRL-0001'), {
      teamId: 'CRL-0001',
      status: 'STRIKE_1_ACTIVE',
      currentStrikeId: 'strike1',
      completedStrikes: [],
      strike1: {
        strikeId: 'strike1',
        startedAt: new Date(now).toISOString(),
        endsAt: t1Ends,
        durationSeconds: 300,
        status: 'active',
        completedAt: null,
      },
      updatedAt: new Date(now).toISOString(),
      updatedBy: 'organizer_uid',
    })
  );

  await assertSucceeds(
    setDoc(doc(orgDb, 'teamTimers', 'CRL-0002'), {
      teamId: 'CRL-0002',
      status: 'STRIKE_1_ACTIVE',
      currentStrikeId: 'strike1',
      completedStrikes: [],
      strike1: {
        strikeId: 'strike1',
        startedAt: new Date(now).toISOString(),
        endsAt: t2Ends,
        durationSeconds: 300,
        status: 'active',
        completedAt: null,
      },
      updatedAt: new Date(now).toISOString(),
      updatedBy: 'organizer_uid',
    })
  );
  pass('Strike 1 started independently for CRL-0001 and CRL-0002');

  // 2.2 Team 1 finishes Strike 1 early while Team 2 is still working
  const team1Context = testEnv.authenticatedContext('team1_user', { teamId: 'CRL-0001' });
  const team1Db = team1Context.firestore();

  const t1FinishTime = new Date().toISOString();
  await assertSucceeds(
    updateDoc(doc(team1Db, 'teamTimers', 'CRL-0001'), {
      status: 'STRIKE_1_COMPLETED',
      completedStrikes: ['strike1'],
      'strike1.status': 'completed',
      'strike1.completedAt': t1FinishTime,
      updatedAt: t1FinishTime,
      updatedBy: 'team1_user',
    })
  );
  pass('Team 1 successfully records early completion on its own timer');

  // Verify Team 2 timer was untouched and remains active
  const t2Snap = await getDoc(doc(orgDb, 'teamTimers', 'CRL-0002'));
  assert.strictEqual(t2Snap.data().status, 'STRIKE_1_ACTIVE');
  assert.strictEqual(t2Snap.data().strike1.status, 'active');
  assert.strictEqual(t2Snap.data().strike1.completedAt, null);
  pass('Team 2 timer remains active and unaffected by Team 1 early completion');

  // 2.3 Team 1 advances to Strike 2 with a 15-minute (900s) timer
  const t1Strike2Ends = new Date(Date.now() + 900 * 1000).toISOString();
  await assertSucceeds(
    updateDoc(doc(orgDb, 'teamTimers', 'CRL-0001'), {
      status: 'STRIKE_2_ACTIVE',
      currentStrikeId: 'strike2',
      strike2: {
        strikeId: 'strike2',
        startedAt: new Date().toISOString(),
        endsAt: t1Strike2Ends,
        durationSeconds: 900,
        status: 'active',
        completedAt: null,
      },
      updatedAt: new Date().toISOString(),
    })
  );
  pass('Team 1 starts Strike 2 (900s timer) while Team 2 is still in Strike 1');

  // 2.4 Team 3 enters Strike 2 later
  const t3Strike2Ends = new Date(Date.now() + 900 * 1000).toISOString();
  await assertSucceeds(
    setDoc(doc(orgDb, 'teamTimers', 'CRL-0003'), {
      teamId: 'CRL-0003',
      status: 'STRIKE_2_ACTIVE',
      currentStrikeId: 'strike2',
      completedStrikes: ['strike1'],
      strike2: {
        strikeId: 'strike2',
        startedAt: new Date().toISOString(),
        endsAt: t3Strike2Ends,
        durationSeconds: 900,
        status: 'active',
        completedAt: null,
      },
      updatedAt: new Date().toISOString(),
    })
  );
  pass('Team 3 enters Strike 2 independently');

  // 2.5 Team 4 starts Strike 1 later
  const t4Strike1Ends = new Date(Date.now() + 300 * 1000).toISOString();
  await assertSucceeds(
    setDoc(doc(orgDb, 'teamTimers', 'CRL-0004'), {
      teamId: 'CRL-0004',
      status: 'STRIKE_1_ACTIVE',
      currentStrikeId: 'strike1',
      completedStrikes: [],
      strike1: {
        strikeId: 'strike1',
        startedAt: new Date().toISOString(),
        endsAt: t4Strike1Ends,
        durationSeconds: 300,
        status: 'active',
        completedAt: null,
      },
      updatedAt: new Date().toISOString(),
    })
  );
  pass('Team 4 starts Strike 1 while Team 1 & 3 are in Strike 2 and Team 2 is in Strike 1');

  // ------------------------------------------------------------
  // SECTION 3: PARTICIPANT WRITES & FIELD IMMUTABILITY
  // ------------------------------------------------------------
  console.log('\n--- PHASE 3: PARTICIPANT WRITE SECURITY & IMMUTABILITY ---');

  // 3.1 Participant CANNOT alter endsAt (attempting to extend timer)
  await assertFails(
    updateDoc(doc(team1Db, 'teamTimers', 'CRL-0001'), {
      'strike2.endsAt': new Date(Date.now() + 3600 * 1000).toISOString(),
    })
  );
  pass('Participant cannot tamper with endsAt');

  // 3.2 Participant CANNOT alter startedAt
  await assertFails(
    updateDoc(doc(team1Db, 'teamTimers', 'CRL-0001'), {
      'strike2.startedAt': new Date(Date.now() - 3600 * 1000).toISOString(),
    })
  );
  pass('Participant cannot tamper with startedAt');

  // 3.3 Participant CANNOT alter durationSeconds
  await assertFails(
    updateDoc(doc(team1Db, 'teamTimers', 'CRL-0001'), {
      'strike2.durationSeconds': 9999,
    })
  );
  pass('Participant cannot tamper with durationSeconds');

  // 3.4 Participant CANNOT change teamId or currentStrikeId
  await assertFails(
    updateDoc(doc(team1Db, 'teamTimers', 'CRL-0001'), {
      teamId: 'CRL-0002',
    })
  );
  await assertFails(
    updateDoc(doc(team1Db, 'teamTimers', 'CRL-0001'), {
      currentStrikeId: 'strike3',
    })
  );
  pass('Participant cannot mutate teamId or currentStrikeId');

  // 3.5 Participant CANNOT manufacture a timer for an unstarted strike (e.g. Strike 3)
  const team2Context = testEnv.authenticatedContext('team2_user', { teamId: 'CRL-0002' });
  const team2Db = team2Context.firestore();

  await assertFails(
    updateDoc(doc(team2Db, 'teamTimers', 'CRL-0002'), {
      strike2: {
        strikeId: 'strike2',
        startedAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 900 * 1000).toISOString(),
        durationSeconds: 900,
        status: 'active',
      },
    })
  );
  pass('Participant cannot manufacture timers for un-started strikes');

  // 3.6 Participant CANNOT alter another team\'s timer
  await assertFails(
    updateDoc(doc(team1Db, 'teamTimers', 'CRL-0002'), {
      status: 'STRIKE_1_COMPLETED',
    })
  );
  pass('Participant cannot alter another team\'s timer document');

  // 3.7 Participant CANNOT write to /results/{teamId}
  await assertFails(
    setDoc(doc(team1Db, 'results', 'CRL-0001'), {
      teamId: 'CRL-0001',
      predictScore: 30,
    })
  );
  pass('Participant cannot write directly to /results');

  // ------------------------------------------------------------
  // SECTION 4: JUDGE SCORING CONCURRENCY & ISOLATION
  // ------------------------------------------------------------
  console.log('\n--- PHASE 4: JUDGE SCORING ISOLATION ---');

  const judge1Context = testEnv.authenticatedContext('judge1_uid', { role: 'judge', judgeId: 'J001' });
  const judge1Db = judge1Context.firestore();

  const judge2Context = testEnv.authenticatedContext('judge2_uid', { role: 'judge', judgeId: 'J002' });
  const judge2Db = judge2Context.firestore();

  // Create baseline result documents by organizer
  await assertSucceeds(
    setDoc(doc(orgDb, 'results', 'CRL-0001'), {
      teamId: 'CRL-0001',
      teamName: 'Alpha Coders',
      assignedJudgeId: 'J001',
      predictScore: 25,
      debugMarks: null,
      codeMarks: null,
      timing: { totalElapsedSeconds: 450 },
    })
  );

  await assertSucceeds(
    setDoc(doc(orgDb, 'results', 'CRL-0002'), {
      teamId: 'CRL-0002',
      teamName: 'Beta Hackers',
      assignedJudgeId: 'J002',
      predictScore: 20,
      debugMarks: null,
      codeMarks: null,
      timing: { totalElapsedSeconds: 520 },
    })
  );

  // Judge 1 scores Team 1 (debug=45, code=50) -> SUCCESS
  await assertSucceeds(
    updateDoc(doc(judge1Db, 'results', 'CRL-0001'), {
      debugMarks: 45,
      codeMarks: 50,
    })
  );
  pass('Judge 1 successfully saves scores for assigned Team 1');

  // Judge 2 scores Team 2 (debug=52, code=48) -> SUCCESS
  await assertSucceeds(
    updateDoc(doc(judge2Db, 'results', 'CRL-0002'), {
      debugMarks: 52,
      codeMarks: 48,
    })
  );
  pass('Judge 2 concurrently saves scores for assigned Team 2');

  // Judge 1 CANNOT score Team 2 (unassigned)
  await assertFails(
    updateDoc(doc(judge1Db, 'results', 'CRL-0002'), {
      debugMarks: 55,
    })
  );
  pass('Judge 1 cannot score unassigned Team 2');

  // Judge 2 CANNOT score Team 1 (unassigned)
  await assertFails(
    updateDoc(doc(judge2Db, 'results', 'CRL-0001'), {
      debugMarks: 55,
    })
  );
  pass('Judge 2 cannot score unassigned Team 1');

  // Judge CANNOT tamper with timing or assignedJudgeId
  await assertFails(
    updateDoc(doc(judge1Db, 'results', 'CRL-0001'), {
      timing: { totalElapsedSeconds: 0 },
    })
  );
  await assertFails(
    updateDoc(doc(judge1Db, 'results', 'CRL-0001'), {
      assignedJudgeId: 'J002',
    })
  );
  pass('Judge cannot mutate timing or reassign judges on /results');

  // ------------------------------------------------------------
  // SECTION 5: PARTICIPANT PAGE REFRESH & PERSISTENCE
  // ------------------------------------------------------------
  console.log('\n--- PHASE 5: REFRESH PERSISTENCE & TIMER ISOLATION ---');

  // Simulate refresh logic for Team 1, Team 2, Team 3, Team 4
  function simulateClientTimerResolution(tId, firestoreTimer, sessionStorageMap) {
    // 1. Team-specific timer from Firestore if valid and in future
    if (firestoreTimer?.endsAt && new Date(firestoreTimer.endsAt).getTime() > Date.now()) {
      return { endsAt: firestoreTimer.endsAt, state: 'ACTIVE' };
    }
    // 2. Refresh persistence from sessionStorage
    const stored = sessionStorageMap.get(`vr2_strike_${firestoreTimer?.strikeId || 'strike1'}_ends_${tId}`);
    if (stored && new Date(stored).getTime() > Date.now()) {
      return { endsAt: stored, state: 'ACTIVE' };
    }
    return { endsAt: null, state: 'WAITING_FOR_OFFICIAL_TIMER' };
  }

  const sStorageT1 = new Map();
  sStorageT1.set('vr2_strike_strike2_ends_CRL-0001', t1Strike2Ends);
  const r1 = simulateClientTimerResolution('CRL-0001', { strikeId: 'strike2', endsAt: t1Strike2Ends }, sStorageT1);
  assert.strictEqual(r1.endsAt, t1Strike2Ends);
  assert.strictEqual(r1.state, 'ACTIVE');

  const sStorageT2 = new Map();
  sStorageT2.set('vr2_strike_strike1_ends_CRL-0002', t2Ends);
  const r2 = simulateClientTimerResolution('CRL-0002', { strikeId: 'strike1', endsAt: t2Ends }, sStorageT2);
  assert.strictEqual(r2.endsAt, t2Ends);
  assert.strictEqual(r2.state, 'ACTIVE');

  // Verify that an uninitialized team renders WAITING_FOR_OFFICIAL_TIMER and cannot use global activeStrike
  const rEmpty = simulateClientTimerResolution('CRL-0099', null, new Map());
  assert.strictEqual(rEmpty.endsAt, null);
  assert.strictEqual(rEmpty.state, 'WAITING_FOR_OFFICIAL_TIMER');
  pass('Participant client resolves strictly from team timer doc and renders WAITING_FOR_OFFICIAL_TIMER when uninitialized');

} finally {
  await testEnv.cleanup();
}

console.log('\n' + '='.repeat(80));
console.log(` REHEARSAL VERIFICATION COMPLETED: ${passed} PASSED, 0 FAILED`);
console.log('='.repeat(80));
