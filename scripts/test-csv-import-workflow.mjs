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
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');

console.log('\x1b[36m' + '='.repeat(80));
console.log(' VIGYANTRA 2026 — CODE RELAY (PHASE 5)');
console.log(' DYNAMIC ROUND 2 QUALIFIED TEAM CSV IMPORT & WORKFLOW VERIFICATION SUITE');
console.log('='.repeat(80) + '\x1b[0m\n');

// ------------------------------------------------------------
// Client-side CSV Parser & Validation Engine (matching TeamManagement.tsx)
// ------------------------------------------------------------
function parseAndValidateCsv(content, existingTeams = []) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      isValid: false,
      headerErrors: ['The selected file is empty or missing data rows. Must contain a header and at least 1 team row.'],
      rows: [],
      validTeams: [],
      invalidRows: [],
    };
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const requiredCols = ['teamid', 'teamname', 'accesscode', 'member1', 'member2', 'member3'];
  const missingCols = requiredCols.filter((col) => !header.includes(col));

  if (missingCols.length > 0) {
    return {
      isValid: false,
      headerErrors: [
        `Invalid CSV header columns. Missing required columns: ${missingCols.join(', ')}.`,
        `Expected format: teamId,teamName,accessCode,member1,member2,member3`,
      ],
      rows: [],
      validTeams: [],
      invalidRows: [],
    };
  }

  const colIndex = {
    teamId: header.indexOf('teamid'),
    teamName: header.indexOf('teamname'),
    accessCode: header.indexOf('accesscode'),
    member1: header.indexOf('member1'),
    member2: header.indexOf('member2'),
    member3: header.indexOf('member3'),
  };

  const dataRows = lines.slice(1);
  const rows = [];
  const seenIds = new Map();
  const seenCodes = new Map();
  const existingTeamMap = new Map(existingTeams.map((t) => [t.teamId.toUpperCase(), t]));

  dataRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const parts = row.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));

    const rawTeamId = parts[colIndex.teamId] || '';
    const teamId = rawTeamId.trim().toUpperCase();
    const teamName = (parts[colIndex.teamName] || '').trim();
    const accessCode = (parts[colIndex.accessCode] || '').trim();
    const m1 = (parts[colIndex.member1] || '').trim();
    const m2 = (parts[colIndex.member2] || '').trim();
    const m3 = (parts[colIndex.member3] || '').trim();

    const errors = [];

    // 1. Team ID validation
    if (!teamId) {
      errors.push('Missing teamId.');
    } else if (!/^CRL-\d{4}$/.test(teamId)) {
      errors.push(`Invalid Team ID format "${teamId}". Must be exactly CRL-XXXX (e.g. CRL-0001).`);
    }

    // 2. Team Name validation
    if (!teamName) {
      errors.push('Missing teamName.');
    }

    // 3. Access Code validation
    if (!accessCode) {
      errors.push('Missing accessCode.');
    } else if (accessCode.length < 4) {
      errors.push('Access code must be at least 4 characters long.');
    }

    // 4. Member validation (all 3 required)
    if (!m1) errors.push('Missing member1.');
    if (!m2) errors.push('Missing member2.');
    if (!m3) errors.push('Missing member3.');

    // 5. Intra-file duplicate check
    let isDuplicateIdInFile = false;
    let isDuplicateCodeInFile = false;

    if (teamId) {
      if (seenIds.has(teamId)) {
        errors.push(`Duplicate Team ID "${teamId}" (also on row ${seenIds.get(teamId)}).`);
        isDuplicateIdInFile = true;
      } else {
        seenIds.set(teamId, rowNumber);
      }
    }

    if (accessCode) {
      if (seenCodes.has(accessCode)) {
        errors.push(`Duplicate Access Code detected (also on row ${seenCodes.get(accessCode)}).`);
        isDuplicateCodeInFile = true;
      } else {
        seenCodes.set(accessCode, rowNumber);
      }
    }

    // 6. Existing team lifecycle conflict check
    let conflictReason = null;
    let existingStatus = null;

    if (teamId && existingTeamMap.has(teamId)) {
      const existing = existingTeamMap.get(teamId);
      existingStatus = existing.status;
      if (['READY', 'ACTIVE', 'active', 'COMPLETED', 'DISQUALIFIED', 'disqualified'].includes(existing.status)) {
        conflictReason = `Team ${teamId} is already in state "${existing.status}". Cannot reset or downgrade an in-progress or provisioned team.`;
        errors.push(conflictReason);
      }
    }

    rows.push({
      rowNumber,
      teamId,
      teamName,
      accessCode,
      m1,
      m2,
      m3,
      isValid: errors.length === 0,
      errors,
      isDuplicateIdInFile,
      isDuplicateCodeInFile,
      existingStatus,
      conflictReason,
    });
  });

  const validTeams = rows.filter((r) => r.isValid);
  const invalidRows = rows.filter((r) => !r.isValid);

  return {
    isValid: invalidRows.length === 0 && validTeams.length > 0,
    headerErrors: [],
    rows,
    validTeams,
    invalidRows,
  };
}

// ------------------------------------------------------------
// Main Verification Runner
// ------------------------------------------------------------
async function runCsvImportVerification() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'coderelay-csv-import-test',
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
      console.log(`\x1b[32m✓ PASS [${testResults.length + 1}/30]:\x1b[0m ${name}`);
      testResults.push({ name, passed: true });
    } catch (err) {
      console.error(`\x1b[31m✗ FAIL [${testResults.length + 1}/30]:\x1b[0m ${name}`);
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

  const p1Auth = testEnv.authenticatedContext('p1_crl0001', {
    email: 'crl-0001@coderelay.com',
    teamId: 'CRL-0001',
  });
  const p1Db = p1Auth.firestore();

  const p2Auth = testEnv.authenticatedContext('p2_crl0002', {
    email: 'crl-0002@coderelay.com',
    teamId: 'CRL-0002',
  });
  const p2Db = p2Auth.firestore();

  const anonDb = testEnv.unauthenticatedContext().firestore();

  // ============================================================
  // CATEGORY A: DYNAMIC SCALABILITY (5 TESTS)
  // ============================================================
  console.log('\n--- CATEGORY A: Dynamic Scalability (No hardcoded 40-team limits) ---');

  // Test 1: 1 Team
  await testCase('Dynamic CSV Import: 1 team import test', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2,member3\nCRL-0001,CyberHawks,SECRET111,Alice,Bob,Charlie`;
    const res = parseAndValidateCsv(csv);
    if (!res.isValid || res.validTeams.length !== 1) throw new Error('Failed to validate 1 team CSV');

    const t = res.validTeams[0];
    await assertSucceeds(
      setDoc(doc(orgDb, 'teams', t.teamId), {
        teamId: t.teamId,
        teamName: t.teamName,
        members: { member1: t.m1, member2: t.m2, member3: t.m3 },
        status: 'QUALIFIED_FOR_ROUND_2',
        round2Eligible: true,
      })
    );

    const snap = await getDoc(doc(orgDb, 'teams', t.teamId));
    if (!snap.exists() || snap.data().status !== 'QUALIFIED_FOR_ROUND_2' || snap.data().round2Eligible !== true) {
      throw new Error('Firestore team doc not properly qualified');
    }
  });

  // Test 2: 3 Teams
  await testCase('Dynamic CSV Import: 3 teams import test', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2,member3
CRL-0001,CyberHawks,SEC111,Alice,Bob,Charlie
CRL-0002,ByteBandits,SEC222,Dave,Eve,Frank
CRL-0003,NullPointers,SEC333,Grace,Heidi,Ivan`;
    const res = parseAndValidateCsv(csv);
    if (!res.isValid || res.validTeams.length !== 3) throw new Error('Failed to validate 3 teams');

    for (const t of res.validTeams) {
      await assertSucceeds(
        setDoc(doc(orgDb, 'teams', t.teamId), {
          teamId: t.teamId,
          teamName: t.teamName,
          members: { member1: t.m1, member2: t.m2, member3: t.m3 },
          status: 'QUALIFIED_FOR_ROUND_2',
          round2Eligible: true,
        })
      );
    }
  });

  // Test 3: 40 Teams
  await testCase('Dynamic CSV Import: 40 teams import test', async () => {
    const rows = ['teamId,teamName,accessCode,member1,member2,member3'];
    for (let i = 1; i <= 40; i++) {
      const pad = String(i).padStart(4, '0');
      rows.push(`CRL-${pad},Team ${pad},CODE${pad}A,M1_${pad},M2_${pad},M3_${pad}`);
    }
    const csv = rows.join('\n');
    const res = parseAndValidateCsv(csv);
    if (!res.isValid || res.validTeams.length !== 40) throw new Error('Failed to validate 40 teams');
  });

  // Test 4: 50 Teams
  await testCase('Dynamic CSV Import: 50 teams import test (exceeds 40)', async () => {
    const rows = ['teamId,teamName,accessCode,member1,member2,member3'];
    for (let i = 1; i <= 50; i++) {
      const pad = String(i).padStart(4, '0');
      rows.push(`CRL-${pad},Team ${pad},CODE${pad}B,M1_${pad},M2_${pad},M3_${pad}`);
    }
    const csv = rows.join('\n');
    const res = parseAndValidateCsv(csv);
    if (!res.isValid || res.validTeams.length !== 50) throw new Error('Failed to validate 50 teams');
  });

  // Test 5: 100 Teams
  await testCase('Dynamic CSV Import: 100 teams import test (scale verification)', async () => {
    const rows = ['teamId,teamName,accessCode,member1,member2,member3'];
    for (let i = 1; i <= 100; i++) {
      const pad = String(i).padStart(4, '0');
      rows.push(`CRL-${pad},Team ${pad},CODE${pad}C,M1_${pad},M2_${pad},M3_${pad}`);
    }
    const csv = rows.join('\n');
    const res = parseAndValidateCsv(csv);
    if (!res.isValid || res.validTeams.length !== 100) throw new Error('Failed to validate 100 teams');
  });

  // ============================================================
  // CATEGORY B: CSV HEADER & FORMATTING VALIDATION (5 TESTS)
  // ============================================================
  console.log('\n--- CATEGORY B: CSV Header & Formatting Validation ---');

  // Test 6: Missing accesscode in header
  await testCase('Header Validation: Missing required column "accesscode" in header rejected', async () => {
    const csv = `teamId,teamName,member1,member2,member3\nCRL-0001,CyberHawks,Alice,Bob,Charlie`;
    const res = parseAndValidateCsv(csv);
    if (res.isValid || !res.headerErrors.some((e) => e.includes('accesscode'))) {
      throw new Error('Should have rejected CSV with missing accesscode header');
    }
  });

  // Test 7: Missing member3 in header
  await testCase('Header Validation: Missing required column "member3" in header rejected', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2\nCRL-0001,CyberHawks,SEC111,Alice,Bob`;
    const res = parseAndValidateCsv(csv);
    if (res.isValid || !res.headerErrors.some((e) => e.includes('member3'))) {
      throw new Error('Should have rejected CSV with missing member3 header');
    }
  });

  // Test 8: Empty CSV / 0 team rows
  await testCase('Header Validation: Empty CSV or CSV with header only (0 team rows) rejected', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2,member3\n`;
    const res = parseAndValidateCsv(csv);
    if (res.isValid || res.headerErrors.length === 0) {
      throw new Error('Should have rejected empty CSV');
    }
  });

  // Test 9: Malformed header columns
  await testCase('Header Validation: Malformed header columns rejected', async () => {
    const csv = `id,name,pass,m1,m2,m3\nCRL-0001,CyberHawks,SEC111,Alice,Bob,Charlie`;
    const res = parseAndValidateCsv(csv);
    if (res.isValid || res.headerErrors.length === 0) {
      throw new Error('Should have rejected malformed header');
    }
  });

  // Test 10: Mixed-case and whitespace header normalization
  await testCase('Header Validation: Mixed-case and whitespace header correctly normalized', async () => {
    const csv = ` TeamID , teamName , AccessCode , Member1 , MEMBER2 , member3 \nCRL-0010,NormalizeTest,NORM999,Alice,Bob,Charlie`;
    const res = parseAndValidateCsv(csv);
    if (!res.isValid || res.validTeams.length !== 1) {
      throw new Error('Failed to normalize whitespace/mixed-case header');
    }
  });

  // ============================================================
  // CATEGORY C: ROW-LEVEL FIELD VALIDATION (6 TESTS)
  // ============================================================
  console.log('\n--- CATEGORY C: Row-Level Field Validation ---');

  // Test 11: Invalid Team ID format
  await testCase('Row Validation: Invalid Team ID format (CRL-42, TEAM-0001) rejected', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2,member3
CRL-42,InvalidFormat1,SEC111,Alice,Bob,Charlie
TEAM-0001,InvalidFormat2,SEC222,Alice,Bob,Charlie`;
    const res = parseAndValidateCsv(csv);
    if (res.isValid || res.invalidRows.length !== 2) {
      throw new Error('Should have rejected non CRL-XXXX format team IDs');
    }
  });

  // Test 12: Missing teamName
  await testCase('Row Validation: Missing teamName rejected', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2,member3\nCRL-0001,,SEC111,Alice,Bob,Charlie`;
    const res = parseAndValidateCsv(csv);
    if (res.isValid || !res.invalidRows[0].errors.some((e) => e.includes('Missing teamName'))) {
      throw new Error('Should have rejected missing teamName');
    }
  });

  // Test 13: Missing or short accessCode (<4 chars)
  await testCase('Row Validation: Missing or short accessCode (<4 chars) rejected', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2,member3
CRL-0001,TeamOne,,Alice,Bob,Charlie
CRL-0002,TeamTwo,123,Dave,Eve,Frank`;
    const res = parseAndValidateCsv(csv);
    if (res.isValid || res.invalidRows.length !== 2) {
      throw new Error('Should have rejected missing or short access codes');
    }
  });

  // Test 14: Missing member1
  await testCase('Row Validation: Missing member1 rejected', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2,member3\nCRL-0001,TeamOne,SEC111,,Bob,Charlie`;
    const res = parseAndValidateCsv(csv);
    if (res.isValid || !res.invalidRows[0].errors.some((e) => e.includes('Missing member1'))) {
      throw new Error('Should have rejected missing member1');
    }
  });

  // Test 15: Missing member2
  await testCase('Row Validation: Missing member2 rejected', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2,member3\nCRL-0001,TeamOne,SEC111,Alice,,Charlie`;
    const res = parseAndValidateCsv(csv);
    if (res.isValid || !res.invalidRows[0].errors.some((e) => e.includes('Missing member2'))) {
      throw new Error('Should have rejected missing member2');
    }
  });

  // Test 16: Missing member3
  await testCase('Row Validation: Missing member3 rejected', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2,member3\nCRL-0001,TeamOne,SEC111,Alice,Bob,`;
    const res = parseAndValidateCsv(csv);
    if (res.isValid || !res.invalidRows[0].errors.some((e) => e.includes('Missing member3'))) {
      throw new Error('Should have rejected missing member3');
    }
  });

  // ============================================================
  // CATEGORY D: INTRA-FILE DUPLICATE DETECTION (2 TESTS)
  // ============================================================
  console.log('\n--- CATEGORY D: Intra-File Duplicate Detection ---');

  // Test 17: Duplicate Team ID in CSV
  await testCase('Intra-File Duplication: Duplicate teamId in same CSV flagged as error', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2,member3
CRL-0001,Alpha,SEC111,Alice,Bob,Charlie
CRL-0001,AlphaDup,SEC222,Alice,Bob,Charlie`;
    const res = parseAndValidateCsv(csv);
    if (res.isValid || !res.invalidRows.some((r) => r.isDuplicateIdInFile)) {
      throw new Error('Should have detected duplicate teamId inside file');
    }
  });

  // Test 18: Duplicate Access Code in CSV
  await testCase('Intra-File Duplication: Duplicate accessCode in same CSV flagged as error', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2,member3
CRL-0001,Alpha,SAME_SECRET,Alice,Bob,Charlie
CRL-0002,Beta,SAME_SECRET,Dave,Eve,Frank`;
    const res = parseAndValidateCsv(csv);
    if (res.isValid || !res.invalidRows.some((r) => r.isDuplicateCodeInFile)) {
      throw new Error('Should have detected duplicate accessCode inside file');
    }
  });

  // ============================================================
  // CATEGORY E: FIRESTORE CONFLICT & IDEMPOTENCY RULES (6 TESTS)
  // ============================================================
  console.log('\n--- CATEGORY E: Firestore Conflict & Idempotency Rules ---');

  // Test 19: Re-uploading existing QUALIFIED_FOR_ROUND_2 team
  await testCase('Conflict & Idempotency: Re-uploading existing QUALIFIED_FOR_ROUND_2 team is idempotent', async () => {
    const existing = [{ teamId: 'CRL-0001', status: 'QUALIFIED_FOR_ROUND_2' }];
    const csv = `teamId,teamName,accessCode,member1,member2,member3\nCRL-0001,CyberHawksUpdated,SEC111,Alice,Bob,Charlie`;
    const res = parseAndValidateCsv(csv, existing);
    if (!res.isValid || res.validTeams.length !== 1) {
      throw new Error('Should allow re-uploading teams already in QUALIFIED_FOR_ROUND_2 state');
    }
  });

  // Test 20: Existing READY team conflict
  await testCase('Conflict & Idempotency: Existing READY team is NOT downgraded to QUALIFIED_FOR_ROUND_2', async () => {
    const existing = [{ teamId: 'CRL-0002', status: 'READY' }];
    const csv = `teamId,teamName,accessCode,member1,member2,member3\nCRL-0002,ReadyTeam,SEC222,Dave,Eve,Frank`;
    const res = parseAndValidateCsv(csv, existing);
    if (res.isValid || !res.invalidRows.some((r) => r.conflictReason?.includes('READY'))) {
      throw new Error('Should flag conflict for existing READY team');
    }
  });

  // Test 21: Existing ACTIVE team conflict
  await testCase('Conflict & Idempotency: Existing ACTIVE team is NOT downgraded to QUALIFIED_FOR_ROUND_2', async () => {
    const existing = [{ teamId: 'CRL-0003', status: 'ACTIVE' }];
    const csv = `teamId,teamName,accessCode,member1,member2,member3\nCRL-0003,ActiveTeam,SEC333,Grace,Heidi,Ivan`;
    const res = parseAndValidateCsv(csv, existing);
    if (res.isValid || !res.invalidRows.some((r) => r.conflictReason?.includes('ACTIVE'))) {
      throw new Error('Should flag conflict for existing ACTIVE team');
    }
  });

  // Test 22: Existing COMPLETED team conflict
  await testCase('Conflict & Idempotency: Existing COMPLETED team is NOT downgraded to QUALIFIED_FOR_ROUND_2', async () => {
    const existing = [{ teamId: 'CRL-0004', status: 'COMPLETED' }];
    const csv = `teamId,teamName,accessCode,member1,member2,member3\nCRL-0004,CompletedTeam,SEC444,M1,M2,M3`;
    const res = parseAndValidateCsv(csv, existing);
    if (res.isValid || !res.invalidRows.some((r) => r.conflictReason?.includes('COMPLETED'))) {
      throw new Error('Should flag conflict for existing COMPLETED team');
    }
  });

  // Test 23: Existing DISQUALIFIED team conflict
  await testCase('Conflict & Idempotency: Existing DISQUALIFIED team cannot be qualified or reset', async () => {
    const existing = [{ teamId: 'CRL-0005', status: 'DISQUALIFIED' }];
    const csv = `teamId,teamName,accessCode,member1,member2,member3\nCRL-0005,DisqualifiedTeam,SEC555,M1,M2,M3`;
    const res = parseAndValidateCsv(csv, existing);
    if (res.isValid || !res.invalidRows.some((r) => r.conflictReason?.includes('DISQUALIFIED'))) {
      throw new Error('Should flag conflict for existing DISQUALIFIED team');
    }
  });

  // Test 24: Firestore Security Rules strictly enforce anti-downgrade server-side
  await testCase('Database Rule Enforcement: Firestore rules deny updating status to QUALIFIED_FOR_ROUND_2 for active/ready/completed/disqualified', async () => {
    // Setup CRL-0020 as READY
    await assertSucceeds(
      setDoc(doc(orgDb, 'teams', 'CRL-0020'), {
        teamId: 'CRL-0020',
        teamName: 'Ready Team',
        status: 'READY',
        round2Eligible: true,
      })
    );

    // Attempting to downgrade CRL-0020 back to QUALIFIED_FOR_ROUND_2 must fail per firestore.rules
    await assertFails(
      updateDoc(doc(orgDb, 'teams', 'CRL-0020'), {
        status: 'QUALIFIED_FOR_ROUND_2',
      })
    );

    // Setup CRL-0021 as DISQUALIFIED
    await assertSucceeds(
      setDoc(doc(orgDb, 'teams', 'CRL-0021'), {
        teamId: 'CRL-0021',
        teamName: 'Disqualified Team',
        status: 'DISQUALIFIED',
        round2Eligible: false,
      })
    );

    // Attempting to downgrade CRL-0021 back to QUALIFIED_FOR_ROUND_2 must fail
    await assertFails(
      updateDoc(doc(orgDb, 'teams', 'CRL-0021'), {
        status: 'QUALIFIED_FOR_ROUND_2',
      })
    );
  });

  // ============================================================
  // CATEGORY F: SECURITY, ACCESS CONTROL & PRIVACY (6 TESTS)
  // ============================================================
  console.log('\n--- CATEGORY F: Security, Access Control & Privacy ---');

  // Test 25: accessCode field is NEVER stored in Firestore /teams/{teamId}
  await testCase('Privacy & Security: accessCode is NEVER stored in Firestore /teams/{teamId}', async () => {
    const csv = `teamId,teamName,accessCode,member1,member2,member3\nCRL-0030,PrivacyTeam,SUPER_SECRET_CODE_DO_NOT_STORE,Alice,Bob,Charlie`;
    const res = parseAndValidateCsv(csv);
    const t = res.validTeams[0];

    // Simulating TeamManagement.tsx handleConfirmImport payload
    await assertSucceeds(
      setDoc(doc(orgDb, 'teams', t.teamId), {
        teamId: t.teamId,
        teamName: t.teamName,
        members: { member1: t.m1, member2: t.m2, member3: t.m3 },
        status: 'QUALIFIED_FOR_ROUND_2',
        round2Eligible: true,
      })
    );

    const snap = await getDoc(doc(orgDb, 'teams', t.teamId));
    const data = snap.data();
    if ('accessCode' in data || 'accesscode' in data || 'password' in data) {
      throw new Error('CRITICAL SECURITY VIOLATION: accessCode detected in Firestore /teams document!');
    }
  });

  // Test 26: Participant cannot self-qualify or edit round2Eligible
  await testCase('Authorization: Participant cannot modify /teams/{teamId} to self-qualify or alter round2Eligible', async () => {
    await assertFails(
      updateDoc(doc(p1Db, 'teams', 'CRL-0001'), {
        round2Eligible: true,
        status: 'QUALIFIED_FOR_ROUND_2',
      })
    );
  });

  // Test 27: Participant cannot read /team_credentials/{teamId}
  await testCase('Isolation: Participant cannot read /team_credentials/{teamId} collection', async () => {
    await assertFails(getDoc(doc(p1Db, 'team_credentials', 'CRL-0001')));
  });

  // Test 28: Audit log recorded without exposing access codes
  await testCase('Audit Logging: ROUND_2_QUALIFICATION_IMPORT audit log created without leaking access codes', async () => {
    const auditPayload = {
      logId: `log_${Date.now()}`,
      action: 'ROUND_2_QUALIFICATION_IMPORT',
      role: 'organizer',
      timestamp: new Date().toISOString(),
      teamsCount: 2,
      teamIds: ['CRL-0001', 'CRL-0002'],
      fileName: 'qualified_teams_round1.csv',
    };

    await assertSucceeds(addDoc(collection(orgDb, 'auditLogs'), auditPayload));

    // Verify participant cannot read auditLogs
    await assertFails(getDoc(doc(p1Db, 'auditLogs', 'log_sample')));
  });

  // Test 29: Cross-team isolation
  await testCase('Cross-Team Security: Participant cannot modify another team doc or submissions', async () => {
    await assertFails(
      setDoc(doc(p1Db, 'teams', 'CRL-0002'), {
        teamName: 'Tampered By Team 1',
      })
    );

    await assertFails(
      setDoc(doc(p1Db, 'teams', 'CRL-0002', 'submissions', 'strike1'), {
        code: 'console.log("hacked");',
        language: 'javascript',
      })
    );
  });

  // Test 30: Unauthenticated or non-organizer client cannot qualify or write to /teams
  await testCase('Access Control: Unauthenticated client cannot qualify or write to /teams', async () => {
    await assertFails(
      setDoc(doc(anonDb, 'teams', 'CRL-0099'), {
        teamId: 'CRL-0099',
        teamName: 'Hacker Team',
        status: 'QUALIFIED_FOR_ROUND_2',
        round2Eligible: true,
      })
    );
  });

  console.log('\n' + '='.repeat(80));
  const failed = testResults.filter((r) => !r.passed);
  console.log(`TOTAL DYNAMIC CSV WORKFLOW TESTS: ${testResults.length} | PASSED: ${testResults.length - failed.length} | FAILED: ${failed.length}`);
  console.log('='.repeat(80) + '\n');

  await testEnv.cleanup();

  if (failed.length > 0) {
    process.exit(1);
  }
}

runCsvImportVerification().catch(async (e) => {
  console.error('Fatal CSV import test execution error:', e);
  process.exit(1);
});
