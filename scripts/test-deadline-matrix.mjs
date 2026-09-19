import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');

console.log('\x1b[35m' + '='.repeat(75));
console.log(' SUBMISSION DEADLINE & NETWORK BUFFER MATRIX VERIFICATION');
console.log(' Official Duration: 300s | Network Arrival Buffer: 15s');
console.log('='.repeat(75) + '\x1b[0m\n');

async function runDeadlineMatrix() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'coderelay-deadline-test',
    firestore: {
      rules: rulesContent,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  const participant = testEnv.authenticatedContext('p1', {
    email: 'crl-0001@coderelay.com',
  });
  const pDb = participant.firestore();

  // Helper to adjust competition start time relative to current server time
  async function setCompetitionStartTimeOffset(elapsedSeconds) {
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

  const results = [];

  async function testTimingScenario(scenarioName, elapsedSeconds, expectSuccess) {
    await setCompetitionStartTimeOffset(elapsedSeconds);
    const subId = `CRL-0001_test_${elapsedSeconds}`;
    const subRef = doc(pDb, 'submissions', subId);

    try {
      if (expectSuccess) {
        await assertSucceeds(
          setDoc(subRef, {
            submissionId: subId,
            teamId: 'CRL-0001',
            strikeId: 'strike1',
            questionId: 'q1-timing',
            status: 'submitted',
            answer: `Answer at elapsed ${elapsedSeconds}s`,
            submittedAt: serverTimestamp(),
          })
        );
        console.log(`\x1b[32m✓ PASS:\x1b[0m ${scenarioName.padEnd(45)} -> ACCEPTED (Expected)`);
        results.push({ name: scenarioName, passed: true, outcome: 'ACCEPTED' });
      } else {
        await assertFails(
          setDoc(subRef, {
            submissionId: subId,
            teamId: 'CRL-0001',
            strikeId: 'strike1',
            questionId: 'q1-timing',
            status: 'submitted',
            answer: `Answer at elapsed ${elapsedSeconds}s`,
            submittedAt: serverTimestamp(),
          })
        );
        console.log(`\x1b[32m✓ PASS:\x1b[0m ${scenarioName.padEnd(45)} -> REJECTED (Expected: PERMISSION_DENIED)`);
        results.push({ name: scenarioName, passed: true, outcome: 'REJECTED' });
      }
    } catch (err) {
      console.error(`\x1b[31m✗ FAIL:\x1b[0m ${scenarioName.padEnd(45)} -> ${err.message}`);
      results.push({ name: scenarioName, passed: false, error: err.message });
    }
  }

  // Official Strike 1 Duration: 300s. Buffer: 15s. Absolute Cutoff: 315s.
  // 1. 10s before deadline (elapsed = 290s)
  await testTimingScenario('1. 10 seconds before official deadline', 290, true);

  // 2. 1s before deadline (elapsed = 299s)
  await testTimingScenario('2. 1 second before official deadline', 299, true);

  // 3. Exactly at official deadline (elapsed = 300s)
  await testTimingScenario('3. Exactly at official deadline (00:00)', 300, true);

  // 4. 1s after official deadline (elapsed = 301s, within 15s buffer)
  await testTimingScenario('4. 1 second after deadline (Network Buffer)', 301, true);

  // 5. 10s after official deadline (elapsed = 310s, within 15s buffer)
  await testTimingScenario('5. 10 seconds after deadline (Network Buffer)', 310, true);

  // 6. 16s after official deadline (elapsed = 316s, exceeded 15s buffer)
  await testTimingScenario('6. 16 seconds after deadline (Exceeded Buffer)', 316, false);

  console.log('\n' + '='.repeat(75));
  const failed = results.filter((r) => !r.passed);
  console.log(`TIMING MATRIX TESTS: ${results.length} | PASSED: ${results.length - failed.length} | FAILED: ${failed.length}`);
  console.log('='.repeat(75) + '\n');

  await testEnv.cleanup();
  if (failed.length > 0) process.exit(1);
}

runDeadlineMatrix().catch((err) => {
  console.error('Matrix error:', err);
  process.exit(1);
});
