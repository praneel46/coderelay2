// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// FIRESTORE /results/{teamId} SECURITY VERIFICATION
// Step 4 Mandatory Security Checks
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
const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');

console.log('='.repeat(75));
console.log(' FIRESTORE /results/{teamId} PARTICIPANT WRITE SECURITY TEST');
console.log('='.repeat(75));

const testEnv = await initializeTestEnvironment({
  projectId: 'test-code-relay-results',
  firestore: {
    rules: rulesContent,
    host: '127.0.0.1',
    port: 8080,
  },
});

let passed = 0;
function pass(desc) {
  console.log(`  ✓ PASS: ${desc}`);
  passed++;
}

try {
  // Setup baseline data using admin context
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // Create initial competition
    await setDoc(doc(db, 'competition', 'round2'), {
      phase: 'active',
      currentStrikeId: 'strike1',
      startTime: new Date(),
    });
    // Create teams
    await setDoc(doc(db, 'teams', 'CRL-0001'), {
      teamId: 'CRL-0001',
      teamName: 'Team 1',
      status: 'ACTIVE',
      round2Eligible: true,
    });
    await setDoc(doc(db, 'teams', 'CRL-0002'), {
      teamId: 'CRL-0002',
      teamName: 'Team 2',
      status: 'ACTIVE',
      round2Eligible: true,
    });
    // Create initial /results/CRL-0001
    await setDoc(doc(db, 'results', 'CRL-0001'), {
      teamId: 'CRL-0001',
      teamName: 'Team 1',
      predictScore: null,
      debugMarks: null,
      codeMarks: null,
      finalScore: null,
    });
  });

  // Create participant context for CRL-0001
  const participantContext = testEnv.authenticatedContext('user-crl-0001', {
    teamId: 'CRL-0001',
    email: 'crl-0001@coderelay.com',
    role: 'participant',
  });
  const participantDb = participantContext.firestore();

  // Test 1: Participant attempts to set predictScore = 30 on own result
  await assertFails(
    updateDoc(doc(participantDb, 'results', 'CRL-0001'), {
      predictScore: 30,
    })
  );
  pass('1. Participant CANNOT set predictScore = 30 on own result');

  // Test 2: Participant attempts to set predictScore = 0 on own result
  await assertFails(
    updateDoc(doc(participantDb, 'results', 'CRL-0001'), {
      predictScore: 0,
    })
  );
  pass('2. Participant CANNOT set predictScore = 0 on own result');

  // Test 3: Participant attempts to set predictScore = 999 on own result
  await assertFails(
    updateDoc(doc(participantDb, 'results', 'CRL-0001'), {
      predictScore: 999,
    })
  );
  pass('3. Participant CANNOT set predictScore = 999 on own result');

  // Test 4: Participant attempts to set finalScore = 150 on own result
  await assertFails(
    updateDoc(doc(participantDb, 'results', 'CRL-0001'), {
      finalScore: 150,
    })
  );
  pass('4. Participant CANNOT set finalScore = 150 on own result');

  // Test 5: Participant attempts to modify another team\'s result (CRL-0002)
  await assertFails(
    setDoc(doc(participantDb, 'results', 'CRL-0002'), {
      predictScore: 30,
      finalScore: 150,
    }, { merge: true })
  );
  pass('5. Participant CANNOT modify another team result (CRL-0002)');

  // Test 6: Participant attempts setDoc write to own team\'s result (CRL-0001)
  await assertFails(
    setDoc(doc(participantDb, 'results', 'CRL-0001'), {
      predictScore: 30,
      finalScore: 150,
    })
  );
  pass('6. Participant CANNOT create or overwrite own result via setDoc');

  // Test 7: Participant CAN read /results/{teamId}
  await assertSucceeds(
    getDoc(doc(participantDb, 'results', 'CRL-0001'))
  );
  pass('7. Participant CAN read /results/{teamId} (leaderboard requirement)');

  // Test 8: Organizer CAN write /results/{teamId}
  const organizerContext = testEnv.authenticatedContext('user-organizer', {
    role: 'organizer',
    isOrganizer: true,
  });
  const organizerDb = organizerContext.firestore();
  await assertSucceeds(
    updateDoc(doc(organizerDb, 'results', 'CRL-0001'), {
      predictScore: 30,
      finalScore: 30,
    })
  );
  pass('8. Organizer CAN write authoritative scores to /results/{teamId}');

  console.log('='.repeat(75));
  console.log(` ALL ${passed} / 8 SECURITY CHECKS PASSED (100% PERMISSION_DENIED ENFORCED)`);
  console.log('='.repeat(75));
} finally {
  await testEnv.cleanup();
}
