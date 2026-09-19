#!/usr/bin/env node
// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Offline Team Provisioning Script (Spark-Compatible)
// Run locally on organizer CLI with Admin SDK credentials.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to resolve firebase-admin
let admin;
try {
  const mod = await import('firebase-admin');
  admin = mod.default || mod;
} catch (e) {
  try {
    const fallbackPath = path.resolve(__dirname, '../functions/node_modules/firebase-admin/lib/index.js');
    const mod = await import(fallbackPath);
    admin = mod.default || mod;
  } catch (err) {
    console.error('\x1b[31m[ERROR] firebase-admin package not found.\x1b[0m');
    console.error('Please install it locally by running: npm install -D firebase-admin');
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let filePath = 'data/teams-sample.json';
let keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';
let isDryRun = false;
let singleTeamId = null;
let singleAccessCode = null;
let singleTeamName = null;
let singleM1 = 'Member 1';
let singleM2 = 'Member 2';
let singleM3 = 'Member 3';

for (const arg of args) {
  if (arg.startsWith('--file=')) {
    filePath = arg.split('=')[1];
  } else if (arg.startsWith('--team=')) {
    singleTeamId = arg.split('=')[1];
  } else if (arg.startsWith('--code=')) {
    singleAccessCode = arg.split('=')[1];
  } else if (arg.startsWith('--name=')) {
    singleTeamName = arg.split('=')[1];
  } else if (arg.startsWith('--m1=')) {
    singleM1 = arg.split('=')[1];
  } else if (arg.startsWith('--m2=')) {
    singleM2 = arg.split('=')[1];
  } else if (arg.startsWith('--m3=')) {
    singleM3 = arg.split('=')[1];
  } else if (arg.startsWith('--key=')) {
    keyPath = arg.split('=')[1];
  } else if (arg === '--dry-run') {
    isDryRun = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
\x1b[36mVIGYANTRA 2026 — CODE RELAY: Team Provisioning Utility\x1b[0m

Usage:
  node scripts/provision-teams.mjs [options]

Bulk Options:
  --file=<path>     Path to teams JSON or CSV file (default: data/teams-sample.json)

Single Team Options:
  --team=<teamId>   Single Team ID to provision (e.g. --team=CRL-0049)
  --code=<password> Access code for the team (min 4 chars)
  --name=<name>     Optional team name (default: Team <teamId>)
  --m1=<name>       Optional member 1 name
  --m2=<name>       Optional member 2 name
  --m3=<name>       Optional member 3 name

General Options:
  --key=<path>      Path to service-account JSON key (default: ./service-account.json)
  --dry-run         Validate inputs and simulate without making Firebase API calls
  --help, -h        Show this help message

Environment Variables:
  GOOGLE_APPLICATION_CREDENTIALS  Path to Firebase service account JSON key
`);
    process.exit(0);
  }
}

console.log('\x1b[35m' + '='.repeat(60));
console.log(' VIGYANTRA 2026 — CODE RELAY: OFFLINE TEAM PROVISIONING');
console.log('='.repeat(60) + '\x1b[0m');
if (singleTeamId && singleAccessCode) {
  console.log(`• Target Team:    ${singleTeamId}`);
} else {
  console.log(`• Input File:     ${filePath}`);
}
console.log(`• Key File:       ${keyPath}`);
console.log(`• Mode:           ${isDryRun ? '\x1b[33mDRY RUN (Simulation)\x1b[0m' : '\x1b[32mLIVE PROVISIONING\x1b[0m'}`);
console.log('-'.repeat(60));

let teamsList = [];

if (singleTeamId && singleAccessCode) {
  teamsList = [
    {
      teamId: singleTeamId.trim().toUpperCase(),
      teamName: singleTeamName || `Team ${singleTeamId.trim().toUpperCase()}`,
      accessCode: singleAccessCode.trim(),
      members: [
        { index: 1, name: singleM1 },
        { index: 2, name: singleM2 },
        { index: 3, name: singleM3 },
      ],
    },
  ];
  console.log(`\x1b[32m✓ Configured single team provisioning for ${singleTeamId}\x1b[0m\n`);
} else {
  // Load and parse team input file
  if (!fs.existsSync(filePath)) {
    console.error(`\x1b[31m[ERROR] Input file not found: ${filePath}\x1b[0m`);
    process.exit(1);
  }

  function parseTeamsInput(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    } else if (filePath.endsWith('.csv')) {
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      const rows = lines.slice(1);
      return rows.map(row => {
        const parts = row.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        const teamId = parts[0];
        const teamName = parts[1] || `Team ${teamId}`;
        const accessCode = parts[2];
        const m1 = parts[3] || 'Member 1';
        const m2 = parts[4] || 'Member 2';
        const m3 = parts[5] || 'Member 3';
        return {
          teamId,
          teamName,
          accessCode,
          members: [
            { index: 1, name: m1 },
            { index: 2, name: m2 },
            { index: 3, name: m3 },
          ],
        };
      });
    } else {
      throw new Error('Unsupported file extension. Use .json or .csv');
    }
  }

  try {
    teamsList = parseTeamsInput(filePath);
    console.log(`\x1b[32m✓ Successfully parsed ${teamsList.length} teams from ${filePath}\x1b[0m\n`);
  } catch (err) {
    console.error(`\x1b[31m[ERROR] Failed to parse input file: ${err.message}\x1b[0m`);
    process.exit(1);
  }
}

// Validate team data
const validationErrors = [];
for (let i = 0; i < teamsList.length; i++) {
  const t = teamsList[i];
  if (!t.teamId || !/^CRL-\d{4}$/i.test(t.teamId.trim())) {
    validationErrors.push(`Row ${i + 1}: Invalid teamId "${t.teamId}". Expected format: CRL-XXXX`);
  }
  if (!t.accessCode || t.accessCode.trim().length < 6) {
    validationErrors.push(`Row ${i + 1} (${t.teamId}): Missing or too short accessCode (min 6 characters required by Firebase Auth).`);
  }
}

if (validationErrors.length > 0) {
  console.error('\x1b[31mInput validation errors:\x1b[0m');
  validationErrors.forEach(e => console.error(` - ${e}`));
  process.exit(1);
}

// Initialize Firebase Admin SDK or Firebase CLI credentials if not dry-run
let auth;
let db;
let useCliAuth = false;
let cliToken = null;
const cliProjectId = 'coderelay-87c77';

if (!isDryRun) {
  if (fs.existsSync(keyPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      auth = admin.auth();
      db = admin.firestore();
      console.log(`\x1b[32m✓ Connected to Firebase Project via Service Account: ${serviceAccount.project_id}\x1b[0m\n`);
    } catch (err) {
      console.error(`\x1b[31m[ERROR] Failed to initialize Firebase Admin SDK: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  } else {
    // Check for Firebase CLI login credentials as seamless organizer fallback
    const possibleConfigPaths = [
      path.join(process.env.USERPROFILE || '', '.config', 'configstore', 'firebase-tools.json'),
      path.join(process.env.HOME || '', '.config', 'configstore', 'firebase-tools.json'),
      path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json'),
    ];
    let foundConfig = null;
    for (const p of possibleConfigPaths) {
      if (p && fs.existsSync(p)) {
        try {
          const c = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (c.tokens?.access_token) {
            foundConfig = c;
            break;
          }
        } catch (_) {}
      }
    }

    if (foundConfig) {
      cliToken = foundConfig.tokens.access_token;
      useCliAuth = true;
      console.log(`\x1b[32m✓ Authenticated via Firebase CLI credentials (${foundConfig.user?.email || 'Logged In Organizer'})\x1b[0m`);
      console.log(`\x1b[32m✓ Targeting Firebase Project: ${cliProjectId}\x1b[0m\n`);
    } else {
      console.error(`\x1b[31m[ERROR] Service account key not found at: ${keyPath}\x1b[0m`);
      console.error('\nTo obtain your Firebase service account key:');
      console.error('1. Open Firebase Console -> Project Settings -> Service Accounts');
      console.error('2. Click "Generate new private key"');
      console.error(`3. Save it locally as "${path.resolve(keyPath)}" (it is in .gitignore)`);
      console.error('Or log in via Firebase CLI: npx firebase login\n');
      process.exit(1);
    }
  }
}

// Provisioning loop
console.log('Starting provisioning for ' + teamsList.length + ' teams...\n');
const results = [];

for (const team of teamsList) {
  const teamId = team.teamId.trim().toUpperCase();
  const email = `${teamId.toLowerCase()}@coderelay.com`;
  const password = team.accessCode.trim();
  const displayName = team.teamName ? team.teamName.trim() : `Team ${teamId}`;

  const member1 = team.members?.[0]?.name || 'Member 1';
  const member2 = team.members?.[1]?.name || 'Member 2';
  const member3 = team.members?.[2]?.name || 'Member 3';

  if (isDryRun) {
    results.push({
      teamId,
      email,
      teamName: displayName,
      authStatus: 'SIMULATED (Dry Run)',
      firestoreStatus: 'SIMULATED (Dry Run)',
      status: 'SUCCESS',
    });
    continue;
  }

  let authStatus = 'UNKNOWN';
  let firestoreStatus = 'UNKNOWN';
  let errorMsg = null;

  try {
    if (useCliAuth) {
      // 1. Create or update user via Identity Toolkit API
      const createRes = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${cliProjectId}/accounts`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + cliToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          localId: teamId.toLowerCase(),
          email,
          password,
          displayName,
          emailVerified: true,
        }),
      }).then(r => r.json());

      if (createRes.localId) {
        authStatus = 'CREATED';
      } else if (createRes.error?.message?.includes('EMAIL_EXISTS') || createRes.error?.message?.includes('DUPLICATE_LOCAL_ID')) {
        const updateRes = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${cliProjectId}/accounts:update`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + cliToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            localId: teamId.toLowerCase(),
            password,
            displayName,
          }),
        }).then(r => r.json());

        if (updateRes.localId || updateRes.email) {
          authStatus = 'UPDATED';
        } else {
          throw new Error(updateRes.error?.message || 'Failed to update Auth account');
        }
      } else {
        throw new Error(createRes.error?.message || 'Failed to create Auth account');
      }

      // 2. Set Custom Claims for Identity
      await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${cliProjectId}/accounts:update`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + cliToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          localId: teamId.toLowerCase(),
          customAttributes: JSON.stringify({ role: 'participant', teamId }),
        }),
      });

      // 3. Write Public Team Data to Firestore /teams/{teamId}
      // CRITICAL: NEVER WRITE accessCode TO FIRESTORE!
      const firestoreBody = {
        fields: {
          teamId: { stringValue: teamId },
          teamName: { stringValue: displayName },
          status: { stringValue: 'READY' },
          round2Eligible: { booleanValue: true },
          member1: { mapValue: { fields: { name: { stringValue: member1 }, role: { stringValue: 'M1' } } } },
          member2: { mapValue: { fields: { name: { stringValue: member2 }, role: { stringValue: 'M2' } } } },
          member3: { mapValue: { fields: { name: { stringValue: member3 }, role: { stringValue: 'M3' } } } },
          updatedAt: { stringValue: new Date().toISOString() },
          createdAt: { stringValue: new Date().toISOString() },
        },
      };

      const firestoreRes = await fetch(`https://firestore.googleapis.com/v1/projects/${cliProjectId}/databases/(default)/documents/teams/${teamId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + cliToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(firestoreBody),
      }).then(r => r.json());

      if (firestoreRes.name) {
        firestoreStatus = 'READY';
      } else {
        throw new Error(firestoreRes.error?.message || 'Failed to write Firestore team document');
      }

    } else {
      // 1. Check or Create Auth Account via Admin SDK
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
        // Update existing account password & displayName
        await auth.updateUser(userRecord.uid, {
          password,
          displayName,
        });
        authStatus = 'UPDATED';
      } catch (authErr) {
        if (authErr.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({
            uid: teamId.toLowerCase(),
            email,
            password,
            displayName,
            emailVerified: true,
          });
          authStatus = 'CREATED';
        } else {
          throw authErr;
        }
      }

      // 2. Set Custom Claims for Identity
      await auth.setCustomUserClaims(userRecord.uid, {
        role: 'participant',
        teamId,
      });

      // 3. Write Public Team Data to Firestore /teams/{teamId}
      // CRITICAL: NEVER WRITE accessCode TO FIRESTORE!
      const teamDocRef = db.collection('teams').doc(teamId);
      const existingDoc = await teamDocRef.get();

      const payload = {
        teamId,
        teamName: displayName,
        member1: { name: member1, role: 'M1' },
        member2: { name: member2, role: 'M2' },
        member3: { name: member3, role: 'M3' },
        status: 'READY',
        round2Eligible: true,
        updatedAt: new Date().toISOString(),
      };

      if (!existingDoc.exists) {
        payload.createdAt = new Date().toISOString();
      }

      await teamDocRef.set(payload, { merge: true });
      firestoreStatus = existingDoc.exists ? 'MERGED' : 'CREATED';
    }

    results.push({
      teamId,
      email,
      teamName: displayName,
      authStatus,
      firestoreStatus,
      status: 'SUCCESS',
    });
  } catch (opErr) {
    results.push({
      teamId,
      email,
      teamName: displayName,
      authStatus,
      firestoreStatus,
      status: 'FAILED',
      error: opErr.message,
    });
  }
}

// Display Summary Table
console.log('\n' + '='.repeat(85));
console.log(' PROVISIONING EXECUTION SUMMARY');
console.log('='.repeat(85));
console.log(
  'Team ID'.padEnd(12) +
  'Email'.padEnd(28) +
  'Auth Account'.padEnd(16) +
  'Firestore'.padEnd(14) +
  'Result'
);
console.log('-'.repeat(85));

let successCount = 0;
let failCount = 0;

for (const r of results) {
  if (r.status === 'SUCCESS') {
    successCount++;
    console.log(
      `\x1b[32m${r.teamId.padEnd(12)}${r.email.padEnd(28)}${r.authStatus.padEnd(16)}${r.firestoreStatus.padEnd(14)}SUCCESS\x1b[0m`
    );
  } else {
    failCount++;
    console.log(
      `\x1b[31m${r.teamId.padEnd(12)}${r.email.padEnd(28)}${r.authStatus.padEnd(16)}${r.firestoreStatus.padEnd(14)}FAILED: ${r.error || ''}\x1b[0m`
    );
  }
}

console.log('-'.repeat(85));
console.log(`Total Teams Processed: ${results.length}`);
console.log(`Successful: \x1b[32m${successCount}\x1b[0m | Failed: \x1b[31m${failCount}\x1b[0m`);
console.log('='.repeat(85) + '\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m✓ Provisioning completed successfully.\x1b[0m');
  process.exit(0);
}
