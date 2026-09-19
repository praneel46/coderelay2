import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');

console.log('\x1b[35m' + '='.repeat(70));
console.log(' FIRESTORE SECURITY RULES VERIFICATION TEST SUITE');
console.log('='.repeat(70) + '\x1b[0m\n');

let testEnv;

async function runTests() {
  testEnv = await initializeTestEnvironment({
    projectId: 'coderelay-rules-test',
    firestore: {
      rules: rulesContent,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  const testResults = [];

  async function testCase(name, fn) {
    try {
      await fn();
      console.log(`\x1b[32m✓ PASS:\x1b[0m ${name}`);
      testResults.push({ name, passed: true });
    } catch (err) {
      console.error(`\x1b[31m✗ FAIL:\x1b[0m ${name}`);
      console.error(`  Error: ${err.message}`);
      testResults.push({ name, passed: false, error: err.message });
    }
  }

  // Setup initial fixture data using admin context (bypasses rules)
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    // 1. Setup Competition
    // Start Time: 2026-09-19T10:00:00.000Z
    // Strike 1 duration: 300s (ends at 10:05:00.000Z)
    // Network buffer: 15s (grace until 10:05:15.000Z)
    const baseStartTime = new Date('2026-09-19T10:00:00.000Z');
    await setDoc(doc(adminDb, 'competition', 'round2'), {
      roundId: 'round2',
      phase: 'active',
      currentStrikeId: 'strike1',
      status: 'STRIKE_1',
      startTime: Timestamp.fromDate(baseStartTime),
      durationSeconds: 300,
      gracePeriodSeconds: 15,
      globalLock: false,
    });

    // 2. Setup Teams
    await setDoc(doc(adminDb, 'teams', 'CRL-0001'), {
      teamId: 'CRL-0001',
      teamName: 'Team One',
      status: 'active',
    });
    await setDoc(doc(adminDb, 'teams', 'CRL-0002'), {
      teamId: 'CRL-0002',
      teamName: 'Team Two',
      status: 'active',
    });

    // 3. Setup Questions
    await setDoc(doc(adminDb, 'questions', 'q1-01'), {
      questionId: 'q1-01',
      round: 'round2',
      strikeId: 'strike1',
      points: 10,
    });
    await setDoc(doc(adminDb, 'private_answers', 'q1-01'), {
      questionId: 'q1-01',
      correctAnswer: 'B',
      officialSolution: 'Option B is correct',
    });

    // 4. Setup Judge
    await setDoc(doc(adminDb, 'judges', 'J001'), {
      judgeId: 'J001',
      assignedTeamIds: ['CRL-0001'],
      name: 'Judge Alpha',
    });

    // 5. Setup Organizer
    await setDoc(doc(adminDb, 'organizers', 'org_alice'), {
      uid: 'org_alice',
      authorized: true,
    });

    // 6. Setup Locked Submission
    await setDoc(doc(adminDb, 'submissions', 'CRL-0001_locked'), {
      submissionId: 'CRL-0001_locked',
      teamId: 'CRL-0001',
      strikeId: 'strike1',
      questionId: 'q1-locked',
      status: 'locked',
      answer: 'Initial Answer',
      submittedAt: Timestamp.fromDate(baseStartTime),
    });
  });

  // Client Contexts
  const participant1 = testEnv.authenticatedContext('user_p1', {
    email: 'crl-0001@coderelay.com',
  });
  const participant2 = testEnv.authenticatedContext('user_p2', {
    email: 'crl-0002@coderelay.com',
  });
  const judge1 = testEnv.authenticatedContext('user_j1', {
    email: 'judge1@coderelay.com',
    role: 'judge',
    judgeId: 'J001',
  });
  const organizer = testEnv.authenticatedContext('org_alice', {
    role: 'organizer',
    isOrganizer: true,
  });
  const unauthed = testEnv.unauthenticatedContext();

  const p1Db = participant1.firestore();
  const p2Db = participant2.firestore();
  const j1Db = judge1.firestore();
  const orgDb = organizer.firestore();
  const anonDb = unauthed.firestore();

  console.log('--- SECTION 1: PARTICIPANT ISOLATION & ACCESS CONTROL ---');

  await testCase('Participant 1 can read own team submission', async () => {
    await assertSucceeds(getDoc(doc(p1Db, 'submissions', 'CRL-0001_locked')));
  });

  await testCase('Participant 2 CANNOT read Participant 1 team submission', async () => {
    await assertFails(getDoc(doc(p2Db, 'submissions', 'CRL-0001_locked')));
  });

  await testCase('Participant 1 CANNOT write to Participant 2 submission', async () => {
    await assertFails(
      setDoc(doc(p1Db, 'submissions', 'CRL-0002_q1-01'), {
        submissionId: 'CRL-0002_q1-01',
        teamId: 'CRL-0002',
        strikeId: 'strike1',
        questionId: 'q1-01',
        status: 'submitted',
        submittedAt: serverTimestamp(),
      })
    );
  });

  console.log('\n--- SECTION 2: COMPETITION STATE & LOCKED DATA ---');

  await testCase('Participant CANNOT modify competition state', async () => {
    await assertFails(
      updateDoc(doc(p1Db, 'competition', 'round2'), {
        phase: 'complete',
      })
    );
  });

  await testCase('Judge CANNOT modify competition state', async () => {
    await assertFails(
      updateDoc(doc(j1Db, 'competition', 'round2'), {
        phase: 'complete',
      })
    );
  });

  await testCase('Organizer CAN modify competition state', async () => {
    await assertSucceeds(
      updateDoc(doc(orgDb, 'competition', 'round2'), {
        updatedAt: new Date().toISOString(),
      })
    );
  });

  await testCase('Participant CANNOT modify a locked submission', async () => {
    await assertFails(
      updateDoc(doc(p1Db, 'submissions', 'CRL-0001_locked'), {
        answer: 'Hacked after lock',
        submittedAt: serverTimestamp(),
      })
    );
  });

  console.log('\n--- SECTION 3: JUDGES & RUBRICS PROTECTION ---');

  await testCase('Participant CANNOT read private answers/solutions', async () => {
    await assertFails(getDoc(doc(p1Db, 'private_answers', 'q1-01')));
  });

  await testCase('Judge CAN read private answers/solutions', async () => {
    await assertSucceeds(getDoc(doc(j1Db, 'private_answers', 'q1-01')));
  });

  await testCase('Judge CANNOT modify participant submissions', async () => {
    await assertFails(
      updateDoc(doc(j1Db, 'submissions', 'CRL-0001_locked'), {
        answer: 'Judge altered code',
      })
    );
  });

  await testCase('Participant CANNOT read or write evaluations', async () => {
    await assertFails(
      setDoc(doc(p1Db, 'evaluations', 'eval_01'), {
        evaluationId: 'eval_01',
        teamId: 'CRL-0001',
        judgeId: 'J001',
        finalScore: 150,
      })
    );
  });

  await testCase('Team credentials collection is NEVER accessible to clients', async () => {
    await assertFails(getDoc(doc(p1Db, 'team_credentials', 'CRL-0001')));
    await assertFails(getDoc(doc(j1Db, 'team_credentials', 'CRL-0001')));
    await assertFails(getDoc(doc(anonDb, 'team_credentials', 'CRL-0001')));
  });

  console.log('\n--- SECTION 4: ANTI-CHEAT VIOLATIONS FEED ---');

  await testCase('Participant CAN log an anti-cheat violation for their own team', async () => {
    await assertSucceeds(
      setDoc(doc(p1Db, 'violations', 'CRL-0001_v1'), {
        violationId: 'CRL-0001_v1',
        teamId: 'CRL-0001',
        strikeId: 'strike1',
        violationType: 'TAB_SWITCH',
        warningNumber: 1,
        timestamp: serverTimestamp(),
      })
    );
  });

  await testCase('Participant CANNOT read violations collection', async () => {
    await assertFails(getDoc(doc(p1Db, 'violations', 'CRL-0001_v1')));
  });

  await testCase('Organizer CAN read violations', async () => {
    await assertSucceeds(getDoc(doc(orgDb, 'violations', 'CRL-0001_v1')));
  });

  await testCase('Participant CANNOT tamper with violation warningNumber', async () => {
    await assertFails(
      updateDoc(doc(p1Db, 'violations', 'CRL-0001_v1'), {
        warningNumber: 0,
      })
    );
  });

  await testCase('Participant CAN transition autoSubmitStatus to AUTO_SUBMIT_CONFIRMED', async () => {
    // 1. Create with AUTO_SUBMIT_TRIGGERED
    await setDoc(doc(p1Db, 'violations', 'CRL-0001_v3'), {
      violationId: 'CRL-0001_v3',
      teamId: 'CRL-0001',
      strikeId: 'strike1',
      violationType: 'TAB_SWITCH',
      warningNumber: 3,
      autoSubmitStatus: 'AUTO_SUBMIT_TRIGGERED',
      details: 'Tab switch 3',
      timestamp: serverTimestamp(),
    });

    // 2. Transition to AUTO_SUBMIT_CONFIRMED
    await assertSucceeds(
      updateDoc(doc(p1Db, 'violations', 'CRL-0001_v3'), {
        autoSubmitStatus: 'AUTO_SUBMIT_CONFIRMED',
      })
    );
  });

  await testCase('Participant 2 CANNOT transition Participant 1 autoSubmitStatus', async () => {
    await assertFails(
      updateDoc(doc(p2Db, 'violations', 'CRL-0001_v3'), {
        autoSubmitStatus: 'AUTO_SUBMIT_CONFIRMED',
      })
    );
  });

  console.log('\n' + '='.repeat(70));
  const failed = testResults.filter((r) => !r.passed);
  console.log(`TOTAL TESTS: ${testResults.length} | PASSED: ${testResults.length - failed.length} | FAILED: ${failed.length}`);
  console.log('='.repeat(70) + '\n');

  await testEnv.cleanup();

  if (failed.length > 0) {
    process.exit(1);
  }
}

runTests().catch(async (e) => {
  console.error('Fatal test error:', e);
  if (testEnv) await testEnv.cleanup();
  process.exit(1);
});
