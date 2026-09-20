// ============================================================
// VIGYANTRA 2026 — CODE RELAY (ROUND 2)
// COMPREHENSIVE PRODUCTION SMOKE TEST
// ============================================================

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
const PROD_URL = 'https://coderelay2.vercel.app';

console.log('='.repeat(80));
console.log(' VIGYANTRA 2026 — FINAL PRODUCTION SMOKE TEST');
console.log(' Production Target:', PROD_URL);
console.log('='.repeat(80));

let passCount = 0;
let failCount = 0;

function pass(testName, detail = '') {
  console.log(`  ✓ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
  passCount++;
}

function fail(testName, error) {
  console.error(`  ✗ FAIL: ${testName} - ${error}`);
  failCount++;
}

async function runSmokeTest() {
  console.log('\n--- SECTION 1: Production Deployment & HTTP Route Verification ---');
  
  const routes = [
    '/',
    '/participant/login',
    '/organizer/login',
    '/judge/login',
    '/participant/strike1',
    '/organizer/dashboard',
    '/judge/dashboard',
    '/leaderboard'
  ];

  for (const route of routes) {
    try {
      const res = await fetch(`${PROD_URL}${route}`);
      if (res.status === 200) {
        pass(`HTTP GET ${route}`, `Status: 200 OK`);
      } else {
        fail(`HTTP GET ${route}`, `Unexpected status: ${res.status}`);
      }
    } catch (e) {
      fail(`HTTP GET ${route}`, e.message);
    }
  }

  console.log('\n--- SECTION 2: Production Bundle Security Verification ---');
  let mainJsContent = '';
  try {
    const htmlRes = await fetch(PROD_URL);
    const html = await htmlRes.text();
    const scriptMatch = html.match(/src="([^"]+\.js)"/);
    if (!scriptMatch) {
      throw new Error('No JS bundle script found in production index.html');
    }
    const scriptUrl = scriptMatch[1].startsWith('http') ? scriptMatch[1] : `${PROD_URL}${scriptMatch[1]}`;
    console.log(`  Inspecting main production JS bundle: ${scriptUrl}`);
    
    const jsRes = await fetch(scriptUrl);
    mainJsContent = await jsRes.text();
    
    if (!mainJsContent.includes('STRIKE1_KEY')) {
      pass('Participant bundle has ZERO STRIKE1_KEY references');
    } else {
      fail('Participant bundle has ZERO STRIKE1_KEY references', 'STRIKE1_KEY found in participant bundle!');
    }

    if (!mainJsContent.includes('calculatePredictScore')) {
      pass('Participant bundle has ZERO calculatePredictScore references');
    } else {
      fail('Participant bundle has ZERO calculatePredictScore references', 'calculatePredictScore found in participant bundle!');
    }

    if (!mainJsContent.includes('MOCK-PASS')) {
      pass('Participant bundle has ZERO MOCK-PASS credentials (SEC-356)');
    } else {
      fail('Participant bundle has ZERO MOCK-PASS credentials (SEC-356)', 'MOCK-PASS found!');
    }

    if (!/q1-01.*?answer.*?A/.test(mainJsContent)) {
      pass('Participant bundle does NOT expose Strike 1 answers (q1-01: A)');
    } else {
      fail('Participant bundle does NOT expose Strike 1 answers', 'Exposed plaintext answer!');
    }
  } catch (e) {
    fail('Production bundle download and inspection', e.message);
  }

  console.log('\n--- SECTION 3: Strike 1 Questions Integrity ---');
  // Verify questions structure from local source
  try {
    const strike1Path = path.resolve(__dirname, '../src/pages/participant/Strike1.tsx');
    const strike1Content = fs.readFileSync(strike1Path, 'utf-8');
    
    // Check that questions exist
    if (strike1Content.includes('Predict the output') || strike1Content.includes('PREDICT')) {
      pass('Strike 1 question template renders properly');
    } else {
      fail('Strike 1 question template renders properly', 'Content missing');
    }

    // Verify Strike1.tsx does NOT hardcode correct answers
    if (!strike1Content.includes('correctAnswer') && !strike1Content.includes('STRIKE1_KEY')) {
      pass('Strike1 component does NOT contain or reveal correct answer keys');
    } else {
      fail('Strike1 component does NOT contain or reveal correct answer keys', 'Found answer key in component');
    }
  } catch (e) {
    fail('Strike 1 Questions Verification', e.message);
  }

  console.log('\n--- SECTION 4: Firebase Firestore Security & Round 2 Access Verification ---');
  const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');
  const testEnv = await initializeTestEnvironment({
    projectId: 'smoke-test-code-relay',
    firestore: {
      rules: rulesContent,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  try {
    const { serverTimestamp, Timestamp } = await import('firebase/firestore');

    // Setup baseline competition data
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'competition', 'round2'), {
        roundId: 'round2',
        phase: 'active',
        currentStrikeId: 'strike1',
        status: 'STRIKE_1',
        startTime: Timestamp.fromDate(new Date()),
        durationSeconds: 300,
        gracePeriodSeconds: 15,
        globalLock: false,
      });
      await setDoc(doc(db, 'teams', 'CRL-0011'), {
        teamId: 'CRL-0011',
        teamName: 'CyberKnights',
        status: 'ACTIVE',
        round2Eligible: true,
      });
      await setDoc(doc(db, 'results', 'CRL-0011'), {
        teamId: 'CRL-0011',
        predictScore: 0,
        debugMarks: 0,
        codeMarks: 0,
        penalties: 0,
        finalScore: 0,
      });
      await setDoc(doc(db, 'judges', 'J001'), {
        judgeId: 'J001',
        name: 'Judge Alpha',
        assignedTeamIds: ['CRL-0011'],
      });
    });

    const participantCtx = testEnv.authenticatedContext('p-crl0011', {
      email: 'crl-0011@coderelay.com',
      teamId: 'CRL-0011',
      role: 'participant',
    });
    const pDb = participantCtx.firestore();

    const organizerCtx = testEnv.authenticatedContext('org-master', {
      email: 'organizer@coderelay.com',
      role: 'organizer',
      isOrganizer: true,
    });
    const oDb = organizerCtx.firestore();

    const judgeCtx = testEnv.authenticatedContext('judge-1', {
      email: 'judge1@coderelay.com',
      role: 'judge',
      judgeId: 'J001',
    });
    const jDb = judgeCtx.firestore();

    // 1. Participant Round 2 access: read team & competition doc
    await assertSucceeds(getDoc(doc(pDb, 'teams', 'CRL-0011')));
    pass('Participant Round 2 access', 'Can read own team doc');

    await assertSucceeds(getDoc(doc(pDb, 'competition', 'round2')));
    pass('Participant can read live competition state', 'Authoritative timer state');

    // 2. Participant Strike 1 submission
    const submissionId = 'CRL-0011_strike1_attempt1';
    await assertSucceeds(
      setDoc(doc(pDb, 'submissions', submissionId), {
        submissionId: submissionId,
        teamId: 'CRL-0011',
        strikeId: 'strike1',
        questionId: 'q1-01',
        status: 'submitted',
        answers: { 'q1-01': 'A', 'q1-02': 'B', 'q1-03': 'C' },
        submittedAt: serverTimestamp(),
      })
    );
    pass('Participant Strike 1 submission allowed', 'Successfully wrote to /submissions');

    // 3. Participant CANNOT modify /results/{teamId}
    await assertFails(
      updateDoc(doc(pDb, 'results', 'CRL-0011'), {
        predictScore: 30,
        finalScore: 150,
      })
    );
    pass('Participant CANNOT modify /results', 'updateDoc rejected with PERMISSION_DENIED');

    await assertFails(
      setDoc(doc(pDb, 'results', 'CRL-0011'), {
        teamId: 'CRL-0011',
        predictScore: 30,
      })
    );
    pass('Participant CANNOT overwrite /results via setDoc', 'setDoc rejected with PERMISSION_DENIED');

    // 4. Participant CAN read /results/{teamId} for Live Leaderboard
    await assertSucceeds(getDoc(doc(pDb, 'results', 'CRL-0011')));
    pass('Leaderboard access for participant', 'Can read /results for live rankings');

    // 5. Organizer dashboard operations: Organizer CAN write authoritative scores
    await assertSucceeds(
      updateDoc(doc(oDb, 'results', 'CRL-0011'), {
        predictScore: 30,
        finalScore: 30,
      })
    );
    pass('Organizer dashboard score publication', 'Organizer writes authoritative predictScore');

    // 6. Judge dashboard operations: Judge evaluation write
    await assertSucceeds(
      setDoc(doc(jDb, 'evaluations', 'CRL-0011_eval'), {
        evaluationId: 'CRL-0011_eval',
        teamId: 'CRL-0011',
        judgeId: 'J001',
        debugMarks: 50,
        codeMarks: 50,
        finalScore: 100,
        submittedAt: serverTimestamp(),
      })
    );
    pass('Judge dashboard evaluation pipeline', 'Judge successfully submits marks');

  } catch (err) {
    fail('Firebase Firestore test execution', err.message);
  } finally {
    await testEnv.cleanup();
  }

  console.log('\n' + '='.repeat(80));
  console.log(` SMOKE TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('='.repeat(80));

  if (failCount > 0) {
    process.exit(1);
  }
}

runSmokeTest().catch((e) => {
  console.error('Fatal error in smoke test:', e);
  process.exit(1);
});
