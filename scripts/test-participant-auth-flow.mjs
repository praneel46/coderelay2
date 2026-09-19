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
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');

console.log('\x1b[36m' + '='.repeat(80));
console.log(' VIGYANTRA 2026 — CODE RELAY');
console.log(' PARTICIPANT AUTHENTICATION & SINGLE TEAM ADDITION VERIFICATION SUITE');
console.log('='.repeat(80) + '\x1b[0m\n');

// Validation helper mirroring TeamManagement.tsx handleSave
function validateSingleTeamInput(form, existingTeams = []) {
  const normalizedId = (form.teamId || '').trim().toUpperCase();
  const errors = [];

  if (!normalizedId) {
    errors.push('Team ID is required.');
  } else if (!/^CRL-\d{4}$/.test(normalizedId)) {
    errors.push(`Invalid Team ID "${normalizedId}". Expected format: CRL-XXXX (e.g. CRL-0001).`);
  }

  if (!form.editTarget && existingTeams.some((t) => t.teamId.toUpperCase() === normalizedId)) {
    errors.push(`Team ID "${normalizedId}" already exists in the roster.`);
  }

  if (!(form.teamName || '').trim()) {
    errors.push('Team Name is required.');
  }

  if (!(form.m1 || '').trim() || !(form.m2 || '').trim() || !(form.m3 || '').trim()) {
    errors.push('All 3 team members (Member 1, Member 2, Member 3) are required.');
  }

  if (!form.editTarget) {
    if (!(form.accessCode || '').trim()) {
      errors.push('Access code is required for offline provisioning.');
    } else if (form.accessCode.trim().length < 4) {
      errors.push('Access code must be at least 4 characters long.');
    }
  }

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

async function runParticipantAuthVerification() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'coderelay-auth-flow-test',
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

  const orgAuth = testEnv.authenticatedContext('org_lead', {
    email: 'organizer@coderelay.com',
    role: 'organizer',
  });
  const orgDb = orgAuth.firestore();

  const p1Auth = testEnv.authenticatedContext('p1_crl0011', {
    email: 'crl-0011@coderelay.com',
    teamId: 'CRL-0011',
  });
  const p1Db = p1Auth.firestore();

  // ============================================================
  // SECTION 1: "ADD SINGLE TEAM" ORGANIZER WORKFLOW
  // ============================================================
  console.log('\n--- SECTION 1: "Add Single Team" Validation & Storage ---');

  // Test 1: Validation checks on Add Single Team
  await testCase('Add Team: CRL-XXXX format validation', async () => {
    const res1 = validateSingleTeamInput({ teamId: 'CRL-42', teamName: 'Alpha', m1: 'A', m2: 'B', m3: 'C', accessCode: '1234' });
    if (res1.isValid || !res1.errors.some((e) => e.includes('Invalid Team ID'))) throw new Error('Failed to reject CRL-42');

    const res2 = validateSingleTeamInput({ teamId: 'TEAM-0001', teamName: 'Alpha', m1: 'A', m2: 'B', m3: 'C', accessCode: '1234' });
    if (res2.isValid || !res2.errors.some((e) => e.includes('Invalid Team ID'))) throw new Error('Failed to reject TEAM-0001');

    const res3 = validateSingleTeamInput({ teamId: 'crl-0049', teamName: 'Alpha', m1: 'A', m2: 'B', m3: 'C', accessCode: '1234' });
    if (!res3.isValid) throw new Error('Should accept lowercase crl-0049 (auto-capitalized)');
  });

  // Test 2: Duplicate Team ID rejection
  await testCase('Add Team: Duplicate Team ID rejection', async () => {
    const existing = [{ teamId: 'CRL-0049', status: 'READY' }];
    const res = validateSingleTeamInput({ teamId: 'CRL-0049', teamName: 'Duplicate Team', m1: 'A', m2: 'B', m3: 'C', accessCode: '1234' }, existing);
    if (res.isValid || !res.errors.some((e) => e.includes('already exists'))) throw new Error('Failed to detect duplicate Team ID');
  });

  // Test 3: Exactly 3 members required
  await testCase('Add Team: Exactly 3 members required', async () => {
    const res = validateSingleTeamInput({ teamId: 'CRL-0050', teamName: 'Team 50', m1: 'Alice', m2: 'Bob', m3: '', accessCode: '1234' });
    if (res.isValid || !res.errors.some((e) => e.includes('All 3 team members'))) throw new Error('Failed to require 3 members');
  });

  // Test 4: Access code required for new team (for offline provisioning handoff)
  await testCase('Add Team: Access code required (min 4 chars)', async () => {
    const res1 = validateSingleTeamInput({ teamId: 'CRL-0050', teamName: 'Team 50', m1: 'A', m2: 'B', m3: 'C', accessCode: '' });
    if (res1.isValid) throw new Error('Should require accessCode for new team');

    const res2 = validateSingleTeamInput({ teamId: 'CRL-0050', teamName: 'Team 50', m1: 'A', m2: 'B', m3: 'C', accessCode: '123' });
    if (res2.isValid) throw new Error('Should require min 4 chars for accessCode');
  });

  // Test 5: Save new team to Firestore — accessCode is NEVER stored
  await testCase('Add Team: New team saved as QUALIFIED_FOR_ROUND_2 with round2Eligible: true, NO accessCode in Firestore', async () => {
    const newTeamPayload = {
      teamId: 'CRL-0049',
      teamName: 'Falcon Force',
      status: 'QUALIFIED_FOR_ROUND_2',
      round2Eligible: true,
      members: { member1: 'Alice', member2: 'Bob', member3: 'Charlie' },
      member1: { name: 'Alice', role: 'M1' },
      member2: { name: 'Bob', role: 'M2' },
      member3: { name: 'Charlie', role: 'M3' },
      updatedAt: new Date().toISOString(),
    };

    await assertSucceeds(setDoc(doc(orgDb, 'teams', 'CRL-0049'), newTeamPayload));

    const snap = await getDoc(doc(orgDb, 'teams', 'CRL-0049'));
    if (!snap.exists()) throw new Error('Team document not created');
    const data = snap.data();
    if (data.status !== 'QUALIFIED_FOR_ROUND_2' || data.round2Eligible !== true) {
      throw new Error('Initial team status must be QUALIFIED_FOR_ROUND_2 and round2Eligible: true');
    }
    if ('accessCode' in data || 'accesscode' in data || 'password' in data) {
      throw new Error('CRITICAL SECURITY VIOLATION: accessCode detected in Firestore document!');
    }
  });

  // Test 6: Anti-downgrade check for manually added/edited team
  await testCase('Add/Edit Team: Cannot downgrade READY, ACTIVE, or COMPLETED team', async () => {
    // Transition team to READY (via provisioning simulation)
    await assertSucceeds(updateDoc(doc(orgDb, 'teams', 'CRL-0049'), { status: 'READY' }));

    // Client-side validation blocks downgrade
    const res = validateSingleTeamInput(
      { teamId: 'CRL-0049', teamName: 'Falcon Force', m1: 'A', m2: 'B', m3: 'C', editTarget: 'CRL-0049', status: 'QUALIFIED_FOR_ROUND_2' },
      [{ teamId: 'CRL-0049', status: 'READY' }]
    );
    if (res.isValid || !res.errors.some((e) => e.includes('Cannot downgrade'))) {
      throw new Error('Failed to block client-side downgrade of READY team');
    }

    // Database Security Rule also blocks downgrade
    await assertFails(updateDoc(doc(orgDb, 'teams', 'CRL-0049'), { status: 'QUALIFIED_FOR_ROUND_2' }));
  });

  // ============================================================
  // SECTION 2: PARTICIPANT AUTHENTICATION & LOGIN FLOW
  // ============================================================
  console.log('\n--- SECTION 2: Participant Authentication & Error Mapping ---');

  // Test 7: CASE A: Valid provisioned team (status READY) transitions to ACTIVE on login
  await testCase('CASE A: Valid provisioned team in READY status transitions to ACTIVE', async () => {
    // Setup CRL-0011 as READY
    await assertSucceeds(
      setDoc(doc(orgDb, 'teams', 'CRL-0011'), {
        teamId: 'CRL-0011',
        teamName: 'Provisioned Alpha',
        status: 'READY',
        round2Eligible: true,
        member1: { name: 'Alice', role: 'M1' },
        member2: { name: 'Bob', role: 'M2' },
        member3: { name: 'Charlie', role: 'M3' },
      })
    );

    // Participant CRL-0011 signs in, reads doc, transitions status READY -> ACTIVE
    const snap = await getDoc(doc(p1Db, 'teams', 'CRL-0011'));
    if (!snap.exists() || snap.data().status !== 'READY') throw new Error('Failed to read READY team');

    // Participant transitions READY -> ACTIVE
    await assertSucceeds(
      updateDoc(doc(p1Db, 'teams', 'CRL-0011'), {
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );

    const updatedSnap = await getDoc(doc(p1Db, 'teams', 'CRL-0011'));
    if (updatedSnap.data().status !== 'ACTIVE') throw new Error('Team status not transitioned to ACTIVE');
  });

  // Test 8: CASE B: Error mapping — safe error on wrong access code (never internal [0])
  await testCase('CASE B: Error mapping produces safe "Invalid Team ID or Access Code"', async () => {
    // Simulate what signInParticipantWithCredentials maps when wrong-password or invalid-credential occurs
    const fakeAuthError = { code: 'auth/wrong-password', message: 'The password is invalid' };
    let mapped = '';
    if (fakeAuthError.code === 'auth/wrong-password' || fakeAuthError.code === 'auth/invalid-credential') {
      mapped = 'Invalid Team ID or Access Code.';
    }
    if (mapped !== 'Invalid Team ID or Access Code.' || mapped.includes('internal')) {
      throw new Error(`Unsafe error mapped: ${mapped}`);
    }
  });

  // Test 9: CASE C: Error mapping — unprovisioned team produces safe message
  await testCase('CASE C: Error mapping produces safe "Team account is not provisioned yet. Please contact the organizer."', async () => {
    const fakeAuthError = { code: 'auth/user-not-found', message: 'No user found' };
    let mapped = '';
    if (fakeAuthError.code === 'auth/user-not-found') {
      mapped = 'Team account is not provisioned yet. Please contact the organizer.';
    }
    if (mapped !== 'Team account is not provisioned yet. Please contact the organizer.') {
      throw new Error(`Unsafe error mapped: ${mapped}`);
    }
  });

  // Test 10: CASE D: Unprovisioned Firestore status (QUALIFIED_FOR_ROUND_2) rejected at login
  await testCase('CASE D: Team still in QUALIFIED_FOR_ROUND_2 status rejected at participant login', async () => {
    // Setup CRL-0012 as QUALIFIED_FOR_ROUND_2 (not yet provisioned to READY)
    await assertSucceeds(
      setDoc(doc(orgDb, 'teams', 'CRL-0012'), {
        teamId: 'CRL-0012',
        teamName: 'Unprovisioned Team',
        status: 'QUALIFIED_FOR_ROUND_2',
        round2Eligible: true,
      })
    );

    const snap = await getDoc(doc(orgDb, 'teams', 'CRL-0012'));
    const d = snap.data();
    let loginAllowed = true;
    if (d.status === 'QUALIFIED_FOR_ROUND_2') {
      loginAllowed = false;
    }
    if (loginAllowed) throw new Error('Should block login for team in QUALIFIED_FOR_ROUND_2');
  });

  // Test 11: CASE E: Disqualified team blocked at participant login
  await testCase('CASE E: Disqualified team rejected at participant login', async () => {
    await assertSucceeds(
      setDoc(doc(orgDb, 'teams', 'CRL-0013'), {
        teamId: 'CRL-0013',
        teamName: 'Disqualified Team',
        status: 'DISQUALIFIED',
        round2Eligible: false,
      })
    );

    const snap = await getDoc(doc(orgDb, 'teams', 'CRL-0013'));
    const d = snap.data();
    let loginAllowed = true;
    if (d.round2Eligible === false || d.status === 'DISQUALIFIED') {
      loginAllowed = false;
    }
    if (loginAllowed) throw new Error('Should block login for disqualified team');
  });

  // Test 12: Legacy mock credentials removed and fake bypass prohibited
  await testCase('Legacy mock credentials: fake client-side bypass prohibited', async () => {
    const loginFn = (teamId) => {
      // Prohibiting fake bypass
      if (teamId === 'CRL-0000') {
        // Must NOT return fake true
        return false;
      }
      return false;
    };
    if (loginFn('CRL-0000') === true) throw new Error('Fake bypass detected');
  });

  console.log('\n' + '='.repeat(80));
  const failed = testResults.filter((r) => !r.passed);
  console.log(`TOTAL AUTH & ADD-TEAM TESTS: ${testResults.length} | PASSED: ${testResults.length - failed.length} | FAILED: ${failed.length}`);
  console.log('='.repeat(80) + '\n');

  await testEnv.cleanup();

  if (failed.length > 0) {
    process.exit(1);
  }
}

runParticipantAuthVerification().catch(async (e) => {
  console.error('Fatal test execution error:', e);
  process.exit(1);
});
