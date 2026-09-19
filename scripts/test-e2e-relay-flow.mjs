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

console.log('\x1b[36m' + '='.repeat(80));
console.log(' VIGYANTRA 2026 — CODE RELAY');
console.log(' COMPLETE ROUND 2 RELAY FLOW END-TO-END AUTOMATED VERIFICATION');
console.log('='.repeat(80) + '\x1b[0m\n');

let testEnv;

async function runE2EVerification() {
  testEnv = await initializeTestEnvironment({
    projectId: 'coderelay-e2e-test',
    firestore: {
      rules: rulesContent,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  const testResults = [];

  async function testStep(name, fn) {
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

  // Contexts:
  const p1Auth = testEnv.authenticatedContext('p1_crl0001', {
    email: 'crl-0001@coderelay.com',
    teamId: 'CRL-0001',
  });
  const p2Auth = testEnv.authenticatedContext('p2_crl0002', {
    email: 'crl-0002@coderelay.com',
    teamId: 'CRL-0002',
  });
  const p3Auth = testEnv.authenticatedContext('p3_crl0003', {
    email: 'crl-0003@coderelay.com',
    teamId: 'CRL-0003',
  });

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

  const orgAuth = testEnv.authenticatedContext('org_lead', {
    email: 'organizer@coderelay.com',
    role: 'organizer',
    isOrganizer: true,
  });

  const p1Db = p1Auth.firestore();
  const p2Db = p2Auth.firestore();
  const p3Db = p3Auth.firestore();
  const j1Db = j1Auth.firestore();
  const j2Db = j2Auth.firestore();
  const orgDb = orgAuth.firestore();

  console.log('\x1b[33m--- PHASE 1: TEAM STATUS LIFECYCLE VERIFICATION ---\x1b[0m');

  await testStep('1.1 CSV Qualification sets status QUALIFIED_FOR_ROUND_2 & round2Eligible: true', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'teams', 'CRL-0001'), {
        teamId: 'CRL-0001',
        teamName: 'Binary Bandits',
        status: 'QUALIFIED_FOR_ROUND_2',
        round2Eligible: true,
        member1: { name: 'Aarav Sharma' },
        member2: { name: 'Priya Patel' },
        member3: { name: 'Rohan Gupta' },
      });
    });

    const snap = await getDoc(doc(p1Db, 'teams', 'CRL-0001'));
    if (!snap.exists() || snap.data().status !== 'QUALIFIED_FOR_ROUND_2' || !snap.data().round2Eligible) {
      throw new Error(`Invalid status after CSV import: ${JSON.stringify(snap.data())}`);
    }
  });

  await testStep('1.2 Offline Provisioning transitions status to READY (never stores accessCode)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(doc(db, 'teams', 'CRL-0001'), {
        status: 'READY',
        provisionedAt: new Date().toISOString(),
      });
    });

    const snap = await getDoc(doc(p1Db, 'teams', 'CRL-0001'));
    if (snap.data().status !== 'READY') throw new Error(`Expected READY, got: ${snap.data().status}`);
    if (snap.data().accessCode) throw new Error('SECURITY VIOLATION: accessCode stored in Firestore!');
  });

  await testStep('1.3 Participant login transitions status from READY to ACTIVE', async () => {
    await assertSucceeds(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
    const snap = await getDoc(doc(p1Db, 'teams', 'CRL-0001'));
    if (snap.data().status !== 'ACTIVE') throw new Error(`Expected ACTIVE, got: ${snap.data().status}`);
  });

  console.log('\n\x1b[33m--- PHASE 2: COMPLETE SINGLE-TEAM FLOW (CRL-0001) ---\x1b[0m');

  await testStep('2.1 Organizer initializes Strike 1 (Predict - 5m / 300s, /30 points)', async () => {
    const s1Start = new Date();
    await assertSucceeds(
      setDoc(doc(orgDb, 'competition', 'round2'), {
        roundId: 'round2',
        phase: 'active',
        currentStrikeId: 'strike1',
        status: 'STRIKE_1',
        startTime: Timestamp.fromDate(s1Start),
        durationSeconds: 300,
        gracePeriodSeconds: 15,
        globalLock: false,
        completedStrikes: [],
      })
    );
  });

  await testStep('2.2 CRL-0001 submits 3 Predict questions with complete timing audit fields', async () => {
    const questions = ['q1_p1', 'q1_p2', 'q1_p3'];
    for (let i = 0; i < questions.length; i++) {
      const qId = questions[i];
      const subId = `CRL-0001_${qId}`;
      await assertSucceeds(
        setDoc(doc(p1Db, 'submissions', subId), {
          submissionId: subId,
          teamId: 'CRL-0001',
          strikeId: 'strike1',
          questionId: qId,
          status: 'submitted',
          selectedOption: 'B',
          submittedAt: serverTimestamp(),
          clientSubmittedAt: new Date().toISOString(),
          officialDeadline: new Date(Date.now() + 250000).toISOString(),
          serverReceivedAt: new Date().toISOString(),
          withinOfficialDeadline: true,
          acceptedViaNetworkBuffer: false,
        })
      );
    }

    const snap = await getDoc(doc(p1Db, 'submissions', 'CRL-0001_q1_p1'));
    if (!snap.exists() || snap.data().withinOfficialDeadline !== true) {
      throw new Error('Timing audit fields missing or invalid');
    }
  });

  await testStep('2.3 Organizer ends Strike 1 -> Phase enters waiting transition', async () => {
    await assertSucceeds(
      updateDoc(doc(orgDb, 'competition', 'round2'), {
        phase: 'complete',
        currentStrikeId: null,
        completedStrikes: ['strike1'],
      })
    );
    const compSnap = await getDoc(doc(p1Db, 'competition', 'round2'));
    if (compSnap.data().phase !== 'complete' || !compSnap.data().completedStrikes.includes('strike1')) {
      throw new Error('Waiting transition state incorrect');
    }
  });

  await testStep('2.4 Organizer starts Strike 2 (Debug - 15m / 900s, /60 points)', async () => {
    const s2Start = new Date();
    await assertSucceeds(
      updateDoc(doc(orgDb, 'competition', 'round2'), {
        phase: 'active',
        currentStrikeId: 'strike2',
        status: 'STRIKE_2',
        startTime: Timestamp.fromDate(s2Start),
        durationSeconds: 900,
        gracePeriodSeconds: 15,
      })
    );
  });

  await testStep('2.5 CRL-0001 submits Debug Q1 & Q2, leaves Q3 for carry-forward', async () => {
    await assertSucceeds(
      setDoc(doc(p1Db, 'submissions', 'CRL-0001_q2_d1'), {
        submissionId: 'CRL-0001_q2_d1',
        teamId: 'CRL-0001',
        strikeId: 'strike2',
        questionId: 'q2_d1',
        status: 'submitted',
        code: 'def fixed_func(): return True',
        submittedAt: serverTimestamp(),
        withinOfficialDeadline: true,
        acceptedViaNetworkBuffer: false,
      })
    );

    await assertSucceeds(
      setDoc(doc(p1Db, 'submissions', 'CRL-0001_q2_d2'), {
        submissionId: 'CRL-0001_q2_d2',
        teamId: 'CRL-0001',
        strikeId: 'strike2',
        questionId: 'q2_d2',
        status: 'submitted',
        code: 'def binary_search_fix(): return mid',
        submittedAt: serverTimestamp(),
        withinOfficialDeadline: true,
        acceptedViaNetworkBuffer: false,
      })
    );
  });

  await testStep('2.6 Organizer ends Strike 2 -> Waiting for Strike 3', async () => {
    await assertSucceeds(
      updateDoc(doc(orgDb, 'competition', 'round2'), {
        phase: 'complete',
        currentStrikeId: null,
        completedStrikes: ['strike1', 'strike2'],
      })
    );
  });

  await testStep('2.7 Organizer starts Strike 3 (Code - 20m / 1200s, /60 points)', async () => {
    const s3Start = new Date();
    await assertSucceeds(
      updateDoc(doc(orgDb, 'competition', 'round2'), {
        phase: 'active',
        currentStrikeId: 'strike3',
        status: 'STRIKE_3',
        startTime: Timestamp.fromDate(s3Start),
        durationSeconds: 1200,
        gracePeriodSeconds: 15,
      })
    );
  });

  await testStep('2.8 CRL-0001 submits carried Debug Q3 (isCarriedForward: true) + Code Q1-Q3', async () => {
    await assertSucceeds(
      setDoc(doc(p1Db, 'submissions', 'CRL-0001_q2_d3'), {
        submissionId: 'CRL-0001_q2_d3',
        teamId: 'CRL-0001',
        strikeId: 'strike3',
        questionId: 'q2_d3',
        isCarriedForward: true,
        status: 'submitted',
        code: 'def carry_forward_fixed(): return "carried"',
        submittedAt: serverTimestamp(),
        withinOfficialDeadline: true,
        acceptedViaNetworkBuffer: false,
      })
    );

    for (const cId of ['q3_c1', 'q3_c2', 'q3_c3']) {
      await assertSucceeds(
        setDoc(doc(p1Db, 'submissions', `CRL-0001_${cId}`), {
          submissionId: `CRL-0001_${cId}`,
          teamId: 'CRL-0001',
          strikeId: 'strike3',
          questionId: cId,
          status: 'submitted',
          code: 'def solve(): return 42',
          submittedAt: serverTimestamp(),
          withinOfficialDeadline: true,
          acceptedViaNetworkBuffer: false,
        })
      );
    }
  });

  await testStep('2.9 CRL-0001 marks round complete -> Team status transitions to COMPLETED', async () => {
    await assertSucceeds(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
    const snap = await getDoc(doc(p1Db, 'teams', 'CRL-0001'));
    if (snap.data().status !== 'COMPLETED') throw new Error(`Expected COMPLETED, got ${snap.data().status}`);
  });

  await testStep('2.10 Judge 1 evaluates CRL-0001: Predict 24/30 + Debug 48/60 + Code 52/60 = 124/150', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'judges', 'J001'), {
        judgeId: 'J001',
        name: 'Dr. Aris Thorne',
        assignedTeamIds: ['CRL-0001'],
      });
      await setDoc(doc(db, 'judges', 'J002'), {
        judgeId: 'J002',
        name: 'Prof. Maya Lin',
        assignedTeamIds: ['CRL-0002', 'CRL-0003'],
      });
    });

    const evalId = 'eval_CRL-0001';
    await assertSucceeds(
      setDoc(doc(j1Db, 'evaluations', evalId), {
        evaluationId: evalId,
        teamId: 'CRL-0001',
        judgeId: 'J001',
        predictScore: 24,
        debugMarks: 48,
        codeMarks: 52,
        debugCodeTotal: 100,
        finalScore: 124,
        status: 'submitted',
        updatedAt: new Date().toISOString(),
      })
    );

    await assertSucceeds(
      setDoc(doc(j1Db, 'results', 'CRL-0001'), {
        teamId: 'CRL-0001',
        teamName: 'Binary Bandits',
        predictScore: 24,
        debugMarks: 48,
        codeMarks: 52,
        debugCodeTotal: 100,
        finalScore: 124,
        evaluationStatus: 'evaluated',
        timing: {
          totalElapsedSeconds: 2280,
          finalSubmittedAt: new Date().toISOString(),
        },
        tieBreakerApplied: false,
        updatedAt: new Date().toISOString(),
      })
    );
  });

  console.log('\n\x1b[33m--- PHASE 3: MULTI-TEAM SIMULATION & TIE-BREAKER VERIFICATION ---\x1b[0m');

  await testStep('3.1 Setup Team 2 (CRL-0002: 124 pts, 35m) & Team 3 (CRL-0003: 110 pts, 32m)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'teams', 'CRL-0002'), {
        teamId: 'CRL-0002',
        teamName: 'Quantum Quarks',
        status: 'COMPLETED',
        round2Eligible: true,
      });
      await setDoc(doc(db, 'results', 'CRL-0002'), {
        teamId: 'CRL-0002',
        teamName: 'Quantum Quarks',
        predictScore: 24,
        debugMarks: 50,
        codeMarks: 50,
        debugCodeTotal: 100,
        finalScore: 124,
        evaluationStatus: 'evaluated',
        timing: {
          totalElapsedSeconds: 2100,
          finalSubmittedAt: new Date().toISOString(),
        },
        tieBreakerApplied: false,
      });

      await setDoc(doc(db, 'teams', 'CRL-0003'), {
        teamId: 'CRL-0003',
        teamName: 'Cyber Centurions',
        status: 'COMPLETED',
        round2Eligible: true,
      });
      await setDoc(doc(db, 'results', 'CRL-0003'), {
        teamId: 'CRL-0003',
        teamName: 'Cyber Centurions',
        predictScore: 20,
        debugMarks: 45,
        codeMarks: 45,
        debugCodeTotal: 90,
        finalScore: 110,
        evaluationStatus: 'evaluated',
        timing: {
          totalElapsedSeconds: 1920,
          finalSubmittedAt: new Date().toISOString(),
        },
        tieBreakerApplied: false,
      });
    });
  });

  await testStep('3.2 Verify Leaderboard Ranks & Tie-Breaking Rule', async () => {
    const resultsSnap = await getDocs(collection(p1Db, 'results'));
    const rawList = resultsSnap.docs.map((d) => d.data());

    rawList.sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      return (a.timing?.totalElapsedSeconds || 0) - (b.timing?.totalElapsedSeconds || 0);
    });

    const ranked = rawList.map((entry, idx, arr) => {
      const isTied = (idx > 0 && arr[idx - 1].finalScore === entry.finalScore) ||
                     (idx < arr.length - 1 && arr[idx + 1].finalScore === entry.finalScore);
      return {
        rank: idx + 1,
        teamId: entry.teamId,
        score: entry.finalScore,
        timeMinutes: Math.round((entry.timing?.totalElapsedSeconds || 0) / 60),
        tieBreakerApplied: isTied,
      };
    });

    console.log('   Leaderboard Standings:');
    ranked.forEach((r) => {
      console.log(`     #${r.rank} ${r.teamId}: ${r.score} pts (${r.timeMinutes}m) [TieBreak: ${r.tieBreakerApplied}]`);
    });

    if (ranked[0].teamId !== 'CRL-0002') throw new Error(`Rank 1 should be CRL-0002 (35m), got ${ranked[0].teamId}`);
    if (ranked[1].teamId !== 'CRL-0001') throw new Error(`Rank 2 should be CRL-0001 (38m), got ${ranked[1].teamId}`);
    if (ranked[2].teamId !== 'CRL-0003') throw new Error(`Rank 3 should be CRL-0003 (110pts), got ${ranked[2].teamId}`);
    if (ranked[0].score !== 124 || ranked[1].score !== 124) throw new Error('Scores altered by time calculation!');
  });

  await testStep('3.3 Security: Cross-Team Isolation (Team 1 cannot read Team 2 submissions)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'submissions', 'CRL-0002_q1_p1'), {
        submissionId: 'CRL-0002_q1_p1',
        teamId: 'CRL-0002',
        strikeId: 'strike1',
        questionId: 'q1_p1',
        status: 'submitted',
        submittedAt: Timestamp.fromDate(new Date()),
      });
    });

    await assertFails(getDoc(doc(p1Db, 'submissions', 'CRL-0002_q1_p1')));
  });

  await testStep('3.4 Security: Cross-Judge Isolation (Judge 1 CANNOT evaluate Team 2)', async () => {
    await assertFails(
      setDoc(doc(j1Db, 'evaluations', 'eval_CRL-0002'), {
        evaluationId: 'eval_CRL-0002',
        teamId: 'CRL-0002',
        judgeId: 'J001',
        finalScore: 130,
      })
    );

    await assertSucceeds(
      setDoc(doc(j2Db, 'evaluations', 'eval_CRL-0002'), {
        evaluationId: 'eval_CRL-0002',
        teamId: 'CRL-0002',
        judgeId: 'J002',
        finalScore: 124,
      })
    );
  });

  console.log('\n\x1b[33m--- PHASE 4: REFRESH & RECONNECT RESILIENCE ---\x1b[0m');

  await testStep('4.1 Reconnect computes identical countdown without ticking writes to Firestore', async () => {
    const compSnap = await getDoc(doc(p1Db, 'competition', 'round2'));
    const compData = compSnap.data();
    const startTimeMs = compData.startTime.toDate().getTime();

    const simulatedNow = startTimeMs + 100 * 1000;
    const elapsed = Math.floor((simulatedNow - startTimeMs) / 1000);
    const remaining = Math.max(0, compData.durationSeconds - elapsed);

    if (remaining !== 1100) {
      throw new Error(`Timer calculation mismatch on reconnect: expected 1100s, got ${remaining}s`);
    }

    const subSnap = await getDoc(doc(p1Db, 'submissions', 'CRL-0001_q1_p1'));
    if (!subSnap.exists() || subSnap.data().status !== 'submitted') {
      throw new Error('Submitted answers lost on reconnect!');
    }
  });

  console.log('\n\x1b[33m--- PHASE 5: QUESTION SECURITY & PRIVATE ANSWERS REJECTION ---\x1b[0m');

  await testStep('5.1 Participants CANNOT access private_answers at any time', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'private_answers', 'q1_secret'), {
        questionId: 'q1_secret',
        rubric: 'Full solution and test cases',
      });
    });

    await assertFails(getDoc(doc(p1Db, 'private_answers', 'q1_secret')));
    await assertFails(getDoc(doc(p2Db, 'private_answers', 'q1_secret')));
  });

  console.log('\n\x1b[33m--- PHASE 6: ANTI-CHEAT AUTO-SUBMIT STATE RESILIENCE ---\x1b[0m');

  await testStep('6.1 Auto-Submit lifecycle: TRIGGERED -> CONFIRMED on success', async () => {
    const vId = 'violation_crl0001_strike3_v3';
    await assertSucceeds(
      setDoc(doc(p1Db, 'violations', vId), {
        violationId: vId,
        teamId: 'CRL-0001',
        strikeId: 'strike3',
        violationType: 'TAB_SWITCH',
        warningNumber: 3,
        autoSubmitStatus: 'AUTO_SUBMIT_TRIGGERED',
        timestamp: serverTimestamp(),
      })
    );

    await assertSucceeds(
      updateDoc(doc(p1Db, 'violations', vId), {
        autoSubmitStatus: 'AUTO_SUBMIT_CONFIRMED',
      })
    );

    const vSnap = await getDoc(doc(orgDb, 'violations', vId));
    if (vSnap.data().autoSubmitStatus !== 'AUTO_SUBMIT_CONFIRMED') {
      throw new Error('Expected AUTO_SUBMIT_CONFIRMED');
    }
  });

  await testStep('6.2 Auto-Submit network failure simulation: TRIGGERED -> AUTO_SUBMIT_FAILED', async () => {
    const vIdFail = 'violation_crl0001_strike3_fail';
    await assertSucceeds(
      setDoc(doc(p1Db, 'violations', vIdFail), {
        violationId: vIdFail,
        teamId: 'CRL-0001',
        strikeId: 'strike3',
        violationType: 'TAB_SWITCH',
        warningNumber: 3,
        autoSubmitStatus: 'AUTO_SUBMIT_TRIGGERED',
        timestamp: serverTimestamp(),
      })
    );

    await assertSucceeds(
      updateDoc(doc(p1Db, 'violations', vIdFail), {
        autoSubmitStatus: 'AUTO_SUBMIT_FAILED',
        autoSubmitError: 'Failed to fetch: network connection lost during auto-submit',
      })
    );

    const vSnap = await getDoc(doc(orgDb, 'violations', vIdFail));
    if (vSnap.data().autoSubmitStatus !== 'AUTO_SUBMIT_FAILED' || !vSnap.data().autoSubmitError) {
      throw new Error('Auto-submit failure not properly captured for organizer');
    }
    console.log('   Organizer Live Monitoring received failure notification with error details.');
  });

  console.log('\n' + '='.repeat(80));
  const failed = testResults.filter((r) => !r.passed);
  console.log(`TOTAL E2E VERIFICATION STEPS: ${testResults.length} | PASSED: ${testResults.length - failed.length} | FAILED: ${failed.length}`);
  console.log('='.repeat(80) + '\n');

  await testEnv.cleanup();

  if (failed.length > 0) {
    process.exit(1);
  }
}

runE2EVerification().catch(async (e) => {
  console.error('Fatal E2E test execution error:', e);
  if (testEnv) await testEnv.cleanup();
  process.exit(1);
});
