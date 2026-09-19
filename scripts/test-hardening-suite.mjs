import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');

console.log('\x1b[35m' + '='.repeat(80));
console.log(' VIGYANTRA 2026 — CODE RELAY (STEP 4.1)');
console.log(' ADVANCED SECURITY & PRODUCTION HARDENING VERIFICATION SUITE');
console.log('='.repeat(80) + '\x1b[0m\n');

let testEnv;

async function runHardeningTests() {
  testEnv = await initializeTestEnvironment({
    projectId: 'coderelay-hardening-test',
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
      console.error(`  Details: ${err.message}`);
      testResults.push({ name, passed: false, error: err.message });
    }
  }

  // Participants
  const p1Auth = testEnv.authenticatedContext('p1_crl0001', {
    email: 'crl-0001@coderelay.com',
    teamId: 'CRL-0001',
  });
  const p2Auth = testEnv.authenticatedContext('p2_crl0002', {
    email: 'crl-0002@coderelay.com',
    teamId: 'CRL-0002',
  });

  // Judges
  const j1Auth = testEnv.authenticatedContext('judge_01', {
    email: 'judge1@coderelay.com',
    role: 'judge',
    judgeId: 'J001',
  });
  const j2Auth = testEnv.authenticatedContext('judge_02', {
    email: 'judge2@coderelay.com',
    role: 'judge',
    judgeId: 'J002',
  });

  // Organizer
  const orgAuth = testEnv.authenticatedContext('org_lead', {
    email: 'organizer@coderelay.com',
    role: 'organizer',
    isOrganizer: true,
  });

  const p1Db = p1Auth.firestore();
  const p2Db = p2Auth.firestore();
  const j1Db = j1Auth.firestore();
  const j2Db = j2Auth.firestore();
  const orgDb = orgAuth.firestore();

  // Admin DB for setup
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    // Setup Judges
    await setDoc(doc(adminDb, 'judges', 'J001'), {
      judgeId: 'J001',
      assignedTeamIds: ['CRL-0001'],
      name: 'Judge Alpha',
    });
    await setDoc(doc(adminDb, 'judges', 'J002'), {
      judgeId: 'J002',
      assignedTeamIds: ['CRL-0002'],
      name: 'Judge Beta',
    });

    // Setup active competition in Strike 1 (duration: 300s, buffer: 15s)
    await setDoc(doc(adminDb, 'competition', 'round2'), {
      roundId: 'round2',
      phase: 'active',
      currentStrikeId: 'strike1',
      status: 'STRIKE_1',
      startTime: Timestamp.fromDate(new Date()),
      durationSeconds: 300,
      gracePeriodSeconds: 15,
      globalLock: false,
    });

    // Setup initial questions
    await setDoc(doc(adminDb, 'questions', 'q_s1_01'), {
      questionId: 'q_s1_01',
      strikeId: 'strike1',
      title: 'Predict 1',
    });
    await setDoc(doc(adminDb, 'questions', 'q_s2_01'), {
      questionId: 'q_s2_01',
      strikeId: 'strike2',
      title: 'Debug 1',
    });
  });

  // ============================================================
  // 1. TEAM STATUS TRANSITION HARDENING
  // ============================================================
  console.log('\x1b[33m--- 1. TEAM STATUS TRANSITION HARDENING ---\x1b[0m');

  await testCase('1.1 Setup initial team in READY status', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'teams', 'CRL-0001'), {
        teamId: 'CRL-0001',
        teamName: 'Binary Bandits',
        status: 'READY',
        round2Eligible: true,
        member1: { name: 'Aarav' },
        member2: { name: 'Priya' },
        member3: { name: 'Rohan' },
      });
      await setDoc(doc(adminDb, 'teams', 'CRL-0002'), {
        teamId: 'CRL-0002',
        teamName: 'Quantum Quarks',
        status: 'READY',
        round2Eligible: true,
      });
    });
  });

  await testCase('1.2 READY -> ACTIVE: ALLOWED for own authenticated team', async () => {
    await assertSucceeds(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
  });

  await testCase('1.3 Reset team to READY; verify READY -> COMPLETED: DENIED', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'teams', 'CRL-0001'), { status: 'READY' });
    });
    await assertFails(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      })
    );
  });

  await testCase('1.4 READY -> DISQUALIFIED: DENIED', async () => {
    await assertFails(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        status: 'DISQUALIFIED',
      })
    );
  });

  await testCase('1.5 Set team to ACTIVE; verify ACTIVE -> COMPLETED: ALLOWED', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'teams', 'CRL-0001'), { status: 'ACTIVE' });
    });
    await assertSucceeds(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
  });

  await testCase('1.6 Set team to ACTIVE; verify ACTIVE -> READY: DENIED', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'teams', 'CRL-0001'), { status: 'ACTIVE' });
    });
    await assertFails(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        status: 'READY',
      })
    );
  });

  await testCase('1.7 ACTIVE -> DISQUALIFIED: DENIED', async () => {
    await assertFails(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        status: 'DISQUALIFIED',
      })
    );
  });

  await testCase('1.8 Set team to COMPLETED; verify COMPLETED -> ACTIVE: DENIED', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'teams', 'CRL-0001'), { status: 'COMPLETED' });
    });
    await assertFails(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        status: 'ACTIVE',
      })
    );
  });

  await testCase('1.9 COMPLETED -> READY: DENIED', async () => {
    await assertFails(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        status: 'READY',
      })
    );
  });

  await testCase('1.10 Set team to QUALIFIED_FOR_ROUND_2; verify direct -> ACTIVE: DENIED', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'teams', 'CRL-0001'), { status: 'QUALIFIED_FOR_ROUND_2' });
    });
    await assertFails(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
      })
    );
  });

  await testCase('1.11 Participant 1 CANNOT modify Team 2 status: DENIED', async () => {
    await assertFails(
      updateDoc(doc(p1Db, 'teams', 'CRL-0002'), {
        status: 'ACTIVE',
      })
    );
  });

  await testCase('1.12 Judge CANNOT modify participant team status: DENIED', async () => {
    await assertFails(
      updateDoc(doc(j1Db, 'teams', 'CRL-0001'), {
        status: 'COMPLETED',
      })
    );
  });

  await testCase('1.13 Participant CANNOT modify round2Eligible: DENIED', async () => {
    await assertFails(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        round2Eligible: false,
      })
    );
  });

  await testCase('1.14 Participant CANNOT modify teamId or members: DENIED', async () => {
    await assertFails(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        teamId: 'HACKED-001',
      })
    );
    await assertFails(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        member1: { name: 'Impostor' },
      })
    );
  });

  // ============================================================
  // 2. SCORE / RANK / TIMING TAMPERING
  // ============================================================
  console.log('\n\x1b[33m--- 2. SCORE / RANK / TIMING TAMPERING HARDENING ---\x1b[0m');

  await testCase('2.1 Participant CANNOT create or update results document: DENIED', async () => {
    await assertFails(
      setDoc(doc(p1Db, 'results', 'CRL-0001'), {
        teamId: 'CRL-0001',
        predictScore: 30,
        finalScore: 150,
        rank: 1,
      })
    );
  });

  await testCase('2.2 Participant CANNOT create or update evaluations document: DENIED', async () => {
    await assertFails(
      setDoc(doc(p1Db, 'evaluations', 'eval_CRL-0001'), {
        evaluationId: 'eval_CRL-0001',
        teamId: 'CRL-0001',
        judgeId: 'J001',
        finalScore: 150,
      })
    );
  });

  await testCase('2.3 Participant CANNOT modify Team 2 results: DENIED', async () => {
    await assertFails(
      setDoc(doc(p1Db, 'results', 'CRL-0002'), {
        teamId: 'CRL-0002',
        finalScore: 0,
      })
    );
  });

  await testCase('2.4 Judge 1 CANNOT write results or evaluations for unassigned Team 2: DENIED', async () => {
    await assertFails(
      setDoc(doc(j1Db, 'evaluations', 'eval_CRL-0002'), {
        evaluationId: 'eval_CRL-0002',
        teamId: 'CRL-0002',
        judgeId: 'J001',
        finalScore: 120,
      })
    );
    await assertFails(
      setDoc(doc(j1Db, 'results', 'CRL-0002'), {
        teamId: 'CRL-0002',
        finalScore: 120,
      })
    );
  });

  // ============================================================
  // 3. TIMING FIELD AUTHORITY & MALICIOUS CLAIMS REJECTION
  // ============================================================
  console.log('\n\x1b[33m--- 3. TIMING FIELD AUTHORITY HARDENING ---\x1b[0m');

  // Helper to adjust competition start time relative to current server time
  async function setCompetitionOffset(elapsedSeconds) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      const simulatedStartTime = new Date(Date.now() - elapsedSeconds * 1000);
      await setDoc(doc(adminDb, 'competition', 'round2'), {
        roundId: 'round2',
        phase: 'active',
        currentStrikeId: 'strike1',
        status: 'STRIKE_1',
        startTime: Timestamp.fromDate(simulatedStartTime),
        durationSeconds: 300,
        gracePeriodSeconds: 15,
        globalLock: false,
      });
    });
  }

  await testCase('3.1 Valid submission before deadline (elapsed = 290s): ACCEPTED', async () => {
    await setCompetitionOffset(290);
    await assertSucceeds(
      setDoc(doc(p1Db, 'submissions', 'CRL-0001_q_s1_01'), {
        submissionId: 'CRL-0001_q_s1_01',
        teamId: 'CRL-0001',
        strikeId: 'strike1',
        questionId: 'q_s1_01',
        status: 'submitted',
        submittedAt: serverTimestamp(),
        withinOfficialDeadline: true,
        acceptedViaNetworkBuffer: false,
      })
    );
  });

  await testCase('3.2 Submission inside buffer (elapsed = 305s) with truthful buffer fields: ACCEPTED', async () => {
    await setCompetitionOffset(305);
    await assertSucceeds(
      setDoc(doc(p1Db, 'submissions', 'CRL-0001_q_s1_buffer'), {
        submissionId: 'CRL-0001_q_s1_buffer',
        teamId: 'CRL-0001',
        strikeId: 'strike1',
        questionId: 'q_s1_01',
        status: 'submitted',
        submittedAt: serverTimestamp(),
        withinOfficialDeadline: false,
        acceptedViaNetworkBuffer: true,
      })
    );
  });

  await testCase('3.3 Malicious client inside buffer (elapsed = 305s) claims withinOfficialDeadline: true: REJECTED', async () => {
    await setCompetitionOffset(305);
    await assertFails(
      setDoc(doc(p1Db, 'submissions', 'CRL-0001_q_s1_lie1'), {
        submissionId: 'CRL-0001_q_s1_lie1',
        teamId: 'CRL-0001',
        strikeId: 'strike1',
        questionId: 'q_s1_01',
        status: 'submitted',
        submittedAt: serverTimestamp(),
        withinOfficialDeadline: true, // LIE: Elapsed is 305s > official 300s!
        acceptedViaNetworkBuffer: false,
      })
    );
  });

  await testCase('3.4 Malicious client inside buffer (elapsed = 305s) claims acceptedViaNetworkBuffer: false: REJECTED', async () => {
    await setCompetitionOffset(305);
    await assertFails(
      setDoc(doc(p1Db, 'submissions', 'CRL-0001_q_s1_lie2'), {
        submissionId: 'CRL-0001_q_s1_lie2',
        teamId: 'CRL-0001',
        strikeId: 'strike1',
        questionId: 'q_s1_01',
        status: 'submitted',
        submittedAt: serverTimestamp(),
        acceptedViaNetworkBuffer: false, // LIE
      })
    );
  });

  await testCase('3.5 Submission after buffer expired (elapsed = 316s): REJECTED', async () => {
    await setCompetitionOffset(316);
    await assertFails(
      setDoc(doc(p1Db, 'submissions', 'CRL-0001_q_s1_toolate'), {
        submissionId: 'CRL-0001_q_s1_toolate',
        teamId: 'CRL-0001',
        strikeId: 'strike1',
        questionId: 'q_s1_01',
        status: 'submitted',
        submittedAt: serverTimestamp(),
        withinOfficialDeadline: false,
        acceptedViaNetworkBuffer: true,
      })
    );
  });

  await testCase('3.6 Client lies about submittedAt by supplying past timestamp: REJECTED', async () => {
    await setCompetitionOffset(200);
    await assertFails(
      setDoc(doc(p1Db, 'submissions', 'CRL-0001_q_s1_faketime'), {
        submissionId: 'CRL-0001_q_s1_faketime',
        teamId: 'CRL-0001',
        strikeId: 'strike1',
        questionId: 'q_s1_01',
        status: 'submitted',
        submittedAt: Timestamp.fromDate(new Date(Date.now() - 50000)), // Must equal request.time
      })
    );
  });

  // ============================================================
  // 4. LIVE QUESTION IMMUTABILITY
  // ============================================================
  console.log('\n\x1b[33m--- 4. LIVE QUESTION IMMUTABILITY HARDENING ---\x1b[0m');

  await testCase('4.1 Organizer CANNOT modify active Strike 1 question while Strike 1 is live: LOCKED', async () => {
    // Reset competition to active Strike 1
    await setCompetitionOffset(100);
    await assertFails(
      updateDoc(doc(orgDb, 'questions', 'q_s1_01'), {
        title: 'Tampered Question During Live Strike',
      })
    );
  });

  await testCase('4.2 Organizer CAN update Strike 2 question while Strike 1 is active: ALLOWED', async () => {
    await assertSucceeds(
      updateDoc(doc(orgDb, 'questions', 'q_s2_01'), {
        title: 'Debug 1 - Prepared in Advance',
      })
    );
  });

  // ============================================================
  // 5. PRIVATE ANSWERS & CREDENTIALS IMMUTABILITY
  // ============================================================
  console.log('\n\x1b[33m--- 5. PRIVATE ANSWERS & CREDENTIALS HARDENING ---\x1b[0m');

  await testCase('5.1 Participant CANNOT read private_answers: DENIED', async () => {
    await assertFails(getDoc(doc(p1Db, 'private_answers', 'q_s1_01')));
  });

  await testCase('5.2 Participant CANNOT read auditLogs: DENIED', async () => {
    await assertFails(getDoc(doc(p1Db, 'auditLogs', 'log_01')));
  });

  await testCase('5.3 Client CANNOT read or write team_credentials: NEVER ALLOWED', async () => {
    await assertFails(getDoc(doc(p1Db, 'team_credentials', 'CRL-0001')));
    await assertFails(getDoc(doc(j1Db, 'team_credentials', 'CRL-0001')));
    await assertFails(
      setDoc(doc(p1Db, 'team_credentials', 'CRL-0001'), {
        accessCode: 'hack',
      })
    );
  });

  console.log('\n' + '='.repeat(80));
  const failed = testResults.filter((r) => !r.passed);
  console.log(`TOTAL HARDENING TESTS: ${testResults.length} | PASSED: ${testResults.length - failed.length} | FAILED: ${failed.length}`);
  console.log('='.repeat(80) + '\n');

  await testEnv.cleanup();

  if (failed.length > 0) {
    process.exit(1);
  }
}

runHardeningTests().catch(async (e) => {
  console.error('Fatal Hardening test error:', e);
  if (testEnv) await testEnv.cleanup();
  process.exit(1);
});
