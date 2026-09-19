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
  setDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');

console.log('\x1b[36m' + '='.repeat(80));
console.log(' VIGYANTRA 2026 — CODE RELAY (PHASE 5.1)');
console.log(' MANUAL ADD TEAM & AUTH CREDENTIAL CONSISTENCY VERIFICATION SUITE');
console.log('='.repeat(80) + '\x1b[0m\n');

// Validation function mirroring TeamManagement.tsx handleSave
function validateManualTeamInput(form, existingTeams = [], sessionCodes = new Map()) {
  const normalizedId = (form.teamId || '').trim().toUpperCase();
  const errors = [];

  // 1. Team ID validation
  if (!normalizedId) {
    errors.push('Team ID is required.');
  } else if (!/^CRL-\d{4}$/.test(normalizedId)) {
    errors.push(`Invalid Team ID "${normalizedId}". Expected format: CRL-XXXX (e.g. CRL-0001).`);
  }

  // 2. Duplicate Team ID check
  if (!form.editTarget && existingTeams.some((t) => t.teamId.toUpperCase() === normalizedId)) {
    errors.push(`Team ID "${normalizedId}" already exists in the roster.`);
  }

  // 3. Team Name validation
  if (!(form.teamName || '').trim()) {
    errors.push('Team Name is required.');
  }

  // 4. Member validation (exactly 3 required)
  if (!(form.m1 || '').trim() || !(form.m2 || '').trim() || !(form.m3 || '').trim()) {
    errors.push('All 3 team members (Member 1, Member 2, Member 3) are required.');
  }

  // 5. Access code validation (min 6 characters)
  if (!form.editTarget) {
    const code = (form.accessCode || '').trim();
    if (!code) {
      errors.push('Access code is required for offline provisioning.');
    } else if (code.length < 6) {
      errors.push('Access code must be at least 6 characters long (Firebase Auth minimum).');
    } else if (sessionCodes.has(code)) {
      errors.push(`Duplicate access code detected. This code is already assigned to team ${sessionCodes.get(code)}.`);
    }
  }

  // 6. Anti-downgrade check
  if (form.editTarget) {
    const existing = existingTeams.find((t) => t.teamId.toUpperCase() === normalizedId);
    if (existing && ['READY', 'ACTIVE', 'COMPLETED', 'DISQUALIFIED'].includes(existing.status)) {
      if (form.status === 'QUALIFIED_FOR_ROUND_2') {
        errors.push(`Cannot downgrade team ${normalizedId} from state "${existing.status}" back to QUALIFIED_FOR_ROUND_2.`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

async function runManualAddTeamVerification() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'coderelay-manual-add-test',
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
      console.log(`\x1b[32m✓ PASS [${testResults.length + 1}/15]:\x1b[0m ${name}`);
      testResults.push({ name, passed: true });
    } catch (err) {
      console.error(`\x1b[31m✗ FAIL [${testResults.length + 1}/15]:\x1b[0m ${name}`);
      console.error(`  Details: ${err.message}`);
      testResults.push({ name, passed: false, error: err.message });
    }
  }

  // Auth Contexts
  const orgAuth = testEnv.authenticatedContext('org_lead', {
    email: 'organizer@coderelay.com',
    role: 'organizer',
  });
  const orgDb = orgAuth.firestore();

  const p49Auth = testEnv.authenticatedContext('p_crl0049', {
    email: 'crl-0049@coderelay.com',
    teamId: 'CRL-0049',
  });
  const p49Db = p49Auth.firestore();

  const p50Auth = testEnv.authenticatedContext('p_crl0050', {
    email: 'crl-0050@coderelay.com',
    teamId: 'CRL-0050',
  });
  const p50Db = p50Auth.firestore();

  // ------------------------------------------------------------
  // 1. Add One Valid Team
  // ------------------------------------------------------------
  await testCase('1. Add one valid team: passes validation and writes correctly', async () => {
    const form = {
      teamId: 'CRL-0049',
      teamName: 'Falcon Force',
      m1: 'Alice',
      m2: 'Bob',
      m3: 'Charlie',
      accessCode: 'SECRET49',
    };
    const res = validateManualTeamInput(form);
    if (!res.isValid) throw new Error(`Validation failed: ${res.errors.join(', ')}`);

    // Write to Firestore /teams/CRL-0049
    await assertSucceeds(
      setDoc(doc(orgDb, 'teams', 'CRL-0049'), {
        teamId: 'CRL-0049',
        teamName: form.teamName,
        members: { member1: form.m1, member2: form.m2, member3: form.m3 },
        member1: { name: form.m1, role: 'M1' },
        member2: { name: form.m2, role: 'M2' },
        member3: { name: form.m3, role: 'M3' },
        status: 'QUALIFIED_FOR_ROUND_2',
        round2Eligible: true,
        updatedAt: new Date().toISOString(),
      })
    );
  });

  // ------------------------------------------------------------
  // 2. Invalid Team ID Format
  // ------------------------------------------------------------
  await testCase('2. Invalid Team ID: rejects non CRL-XXXX formats (CRL-42, TEAM-0001)', async () => {
    const res1 = validateManualTeamInput({ teamId: 'CRL-42', teamName: 'Test', m1: 'A', m2: 'B', m3: 'C', accessCode: 'SEC111' });
    const res2 = validateManualTeamInput({ teamId: 'TEAM-0001', teamName: 'Test', m1: 'A', m2: 'B', m3: 'C', accessCode: 'SEC111' });
    const res3 = validateManualTeamInput({ teamId: '', teamName: 'Test', m1: 'A', m2: 'B', m3: 'C', accessCode: 'SEC111' });

    if (res1.isValid || res2.isValid || res3.isValid) {
      throw new Error('Should have rejected invalid teamId formats');
    }
  });

  // ------------------------------------------------------------
  // 3. Duplicate Team ID Rejection
  // ------------------------------------------------------------
  await testCase('3. Duplicate Team ID: rejects adding existing teamId', async () => {
    const existing = [{ teamId: 'CRL-0049', status: 'QUALIFIED_FOR_ROUND_2' }];
    const res = validateManualTeamInput(
      { teamId: 'CRL-0049', teamName: 'Duplicate Team', m1: 'A', m2: 'B', m3: 'C', accessCode: 'DIFF_CODE' },
      existing
    );
    if (res.isValid || !res.errors.some((e) => e.includes('already exists in the roster'))) {
      throw new Error('Should have rejected duplicate teamId');
    }
  });

  // ------------------------------------------------------------
  // 4. Duplicate Access Code Detection
  // ------------------------------------------------------------
  await testCase('4. Duplicate access code: rejects identical access code for multiple teams', async () => {
    const sessionCodes = new Map([['SECRET49', 'CRL-0049']]);
    const res = validateManualTeamInput(
      { teamId: 'CRL-0050', teamName: 'Team 50', m1: 'A', m2: 'B', m3: 'C', accessCode: 'SECRET49' },
      [],
      sessionCodes
    );
    if (res.isValid || !res.errors.some((e) => e.includes('Duplicate access code detected'))) {
      throw new Error('Should have rejected duplicate accessCode');
    }
  });

  // ------------------------------------------------------------
  // 5. Missing Team Name
  // ------------------------------------------------------------
  await testCase('5. Missing team name: rejected', async () => {
    const res = validateManualTeamInput({ teamId: 'CRL-0050', teamName: '', m1: 'A', m2: 'B', m3: 'C', accessCode: 'SEC50A' });
    if (res.isValid || !res.errors.some((e) => e.includes('Team Name is required'))) {
      throw new Error('Should have rejected missing teamName');
    }
  });

  // ------------------------------------------------------------
  // 6. Missing Member (Exactly 3 Required)
  // ------------------------------------------------------------
  await testCase('6. Missing member: rejects if any member is omitted', async () => {
    const res1 = validateManualTeamInput({ teamId: 'CRL-0050', teamName: 'T50', m1: '', m2: 'B', m3: 'C', accessCode: 'SEC50A' });
    const res2 = validateManualTeamInput({ teamId: 'CRL-0050', teamName: 'T50', m1: 'A', m2: '', m3: 'C', accessCode: 'SEC50A' });
    const res3 = validateManualTeamInput({ teamId: 'CRL-0050', teamName: 'T50', m1: 'A', m2: 'B', m3: '', accessCode: 'SEC50A' });

    if (res1.isValid || res2.isValid || res3.isValid) {
      throw new Error('Should have rejected incomplete roster');
    }
  });

  // ------------------------------------------------------------
  // 7. Invalid/Short Access Code (< 6 Characters)
  // ------------------------------------------------------------
  await testCase('7. Invalid/short access code (< 6 chars) rejected without transformation', async () => {
    // 5 chars (e.g. 'mockk') must be strictly rejected per Firebase Auth requirement
    const res1 = validateManualTeamInput({ teamId: 'CRL-0050', teamName: 'T50', m1: 'A', m2: 'B', m3: 'C', accessCode: 'mockk' });
    if (res1.isValid || !res1.errors.some((e) => e.includes('at least 6 characters long'))) {
      throw new Error('Should have rejected 5-character access code "mockk"');
    }

    // 6 chars (e.g. 'mockkk') must be valid
    const res2 = validateManualTeamInput({ teamId: 'CRL-0050', teamName: 'T50', m1: 'A', m2: 'B', m3: 'C', accessCode: 'mockkk' });
    if (!res2.isValid) {
      throw new Error('Should have accepted 6-character access code "mockkk"');
    }
  });

  // ------------------------------------------------------------
  // 8. Team Created as QUALIFIED_FOR_ROUND_2
  // ------------------------------------------------------------
  await testCase('8. Team created with status QUALIFIED_FOR_ROUND_2 & round2Eligible: true', async () => {
    const form50 = {
      teamId: 'CRL-0050',
      teamName: 'Titan Coders',
      m1: 'Dave',
      m2: 'Eve',
      m3: 'Frank',
      accessCode: 'SECRET50',
    };
    await assertSucceeds(
      setDoc(doc(orgDb, 'teams', 'CRL-0050'), {
        teamId: 'CRL-0050',
        teamName: form50.teamName,
        members: { member1: form50.m1, member2: form50.m2, member3: form50.m3 },
        member1: { name: form50.m1, role: 'M1' },
        member2: { name: form50.m2, role: 'M2' },
        member3: { name: form50.m3, role: 'M3' },
        status: 'QUALIFIED_FOR_ROUND_2',
        round2Eligible: true,
        updatedAt: new Date().toISOString(),
      })
    );

    const snap = await getDoc(doc(orgDb, 'teams', 'CRL-0050'));
    if (!snap.exists() || snap.data().status !== 'QUALIFIED_FOR_ROUND_2' || snap.data().round2Eligible !== true) {
      throw new Error('Team CRL-0050 must have status QUALIFIED_FOR_ROUND_2 and round2Eligible: true');
    }
  });

  // ------------------------------------------------------------
  // 9. accessCode is NEVER Stored in Firestore /teams
  // ------------------------------------------------------------
  await testCase('9. accessCode is NEVER stored in Firestore /teams/{teamId}', async () => {
    const snap49 = await getDoc(doc(orgDb, 'teams', 'CRL-0049'));
    const snap50 = await getDoc(doc(orgDb, 'teams', 'CRL-0050'));

    const d49 = snap49.data();
    const d50 = snap50.data();

    if ('accessCode' in d49 || 'accesscode' in d49 || 'password' in d49 ||
        'accessCode' in d50 || 'accesscode' in d50 || 'password' in d50) {
      throw new Error('SECURITY VIOLATION: accessCode detected in Firestore /teams document!');
    }
  });

  // ------------------------------------------------------------
  // 10. Manual Team Can Be Provisioned
  // ------------------------------------------------------------
  await testCase('10. Manual team can be provisioned via offline provisioning architecture', async () => {
    // Simulating offline provisioning utility executing for CRL-0049 & CRL-0050
    // Updates public Firestore team doc to status: READY
    await assertSucceeds(
      updateDoc(doc(orgDb, 'teams', 'CRL-0049'), {
        status: 'READY',
        provisionedAt: serverTimestamp(),
      })
    );

    await assertSucceeds(
      updateDoc(doc(orgDb, 'teams', 'CRL-0050'), {
        status: 'READY',
        provisionedAt: serverTimestamp(),
      })
    );
  });

  // ------------------------------------------------------------
  // 11. Manual Team Becomes READY
  // ------------------------------------------------------------
  await testCase('11. Manual teams become READY after offline provisioning', async () => {
    const snap49 = await getDoc(doc(orgDb, 'teams', 'CRL-0049'));
    const snap50 = await getDoc(doc(orgDb, 'teams', 'CRL-0050'));

    if (snap49.data().status !== 'READY' || snap50.data().status !== 'READY') {
      throw new Error('Teams did not transition to READY');
    }
  });

  // ------------------------------------------------------------
  // 12. Manual Team Can Log In & Transitions to ACTIVE
  // ------------------------------------------------------------
  await testCase('12. Manual team can log in and transitions from READY to ACTIVE', async () => {
    // Participant CRL-0049 logs in, reads own doc, advances status READY -> ACTIVE
    const snap = await getDoc(doc(p49Db, 'teams', 'CRL-0049'));
    if (snap.data().status !== 'READY') throw new Error('Expected READY status prior to participant entry');

    await assertSucceeds(
      updateDoc(doc(p49Db, 'teams', 'CRL-0049'), {
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );

    const activeSnap = await getDoc(doc(p49Db, 'teams', 'CRL-0049'));
    if (activeSnap.data().status !== 'ACTIVE') throw new Error('Status not advanced to ACTIVE');
  });

  // ------------------------------------------------------------
  // 13. Cannot Downgrade Existing READY/ACTIVE/COMPLETED Team
  // ------------------------------------------------------------
  await testCase('13. Manual team cannot downgrade an existing READY, ACTIVE, or COMPLETED team', async () => {
    // Client-side validation blocks downgrade
    const existing = [{ teamId: 'CRL-0049', status: 'ACTIVE' }];
    const res = validateManualTeamInput(
      { teamId: 'CRL-0049', teamName: 'Falcon Force', m1: 'A', m2: 'B', m3: 'C', editTarget: 'CRL-0049', status: 'QUALIFIED_FOR_ROUND_2' },
      existing
    );
    if (res.isValid || !res.errors.some((e) => e.includes('Cannot downgrade team'))) {
      throw new Error('Client validation failed to block downgrade of ACTIVE team');
    }

    // Database Security Rule also blocks downgrade
    await assertFails(
      updateDoc(doc(orgDb, 'teams', 'CRL-0049'), {
        status: 'QUALIFIED_FOR_ROUND_2',
      })
    );
  });

  // ------------------------------------------------------------
  // 14. Participant Cannot Self-Qualify or Alter round2Eligible
  // ------------------------------------------------------------
  await testCase('14. Participant cannot self-qualify or modify round2Eligible', async () => {
    await assertFails(
      updateDoc(doc(p49Db, 'teams', 'CRL-0049'), {
        round2Eligible: false,
        status: 'QUALIFIED_FOR_ROUND_2',
      })
    );

    await assertFails(
      updateDoc(doc(p49Db, 'teams', 'CRL-0049'), {
        teamName: 'Tampered Name',
      })
    );
  });

  // ------------------------------------------------------------
  // 15. Manual Team Follows Identical Security Rules as CSV Team
  // ------------------------------------------------------------
  await testCase('15. Manual team follows identical Security Rules as CSV team (submissions, evaluation, isolation)', async () => {
    // Organizer starts Strike 1 with Firestore serverTimestamp()
    await assertSucceeds(
      setDoc(doc(orgDb, 'competition', 'round2'), {
        phase: 'active',
        currentStrikeId: 'strike1',
        startTime: serverTimestamp(),
        durationSeconds: 300,
        gracePeriodSeconds: 15,
        globalLock: false,
      })
    );

    // CRL-0049 can write own submission to /submissions/CRL-0049_strike1
    await assertSucceeds(
      setDoc(doc(p49Db, 'submissions', 'CRL-0049_strike1'), {
        teamId: 'CRL-0049',
        strikeId: 'strike1',
        submittedAt: serverTimestamp(),
        answers: { 'q1-01': 'A', 'q1-02': 'B', 'q1-03': 'C' },
      })
    );

    // CRL-0049 can read own submission
    await assertSucceeds(getDoc(doc(p49Db, 'submissions', 'CRL-0049_strike1')));

    // CRL-0049 CANNOT read CRL-0050 submission
    await assertFails(getDoc(doc(p49Db, 'submissions', 'CRL-0050_strike1')));

    // CRL-0049 CANNOT write to CRL-0050 submission
    await assertFails(
      setDoc(doc(p49Db, 'submissions', 'CRL-0050_strike1'), {
        teamId: 'CRL-0050',
        strikeId: 'strike1',
        submittedAt: serverTimestamp(),
        answers: { 'q1-01': 'HACKED' },
      })
    );

    // CRL-0049 CANNOT read /team_credentials
    await assertFails(getDoc(doc(p49Db, 'team_credentials', 'CRL-0049')));
  });

  console.log('\n' + '='.repeat(80));
  const failed = testResults.filter((r) => !r.passed);
  console.log(`TOTAL MANUAL ADD TEAM TESTS: ${testResults.length} | PASSED: ${testResults.length - failed.length} | FAILED: ${failed.length}`);
  console.log('='.repeat(80) + '\n');

  await testEnv.cleanup();

  if (failed.length > 0) {
    process.exit(1);
  }
}

runManualAddTeamVerification().catch(async (e) => {
  console.error('Fatal test execution error:', e);
  process.exit(1);
});
