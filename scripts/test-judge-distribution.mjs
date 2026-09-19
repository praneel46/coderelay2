// ============================================================
// Test Suite: Judge Distribution Algorithm Verification
// Tests cases: 1, 3, 37, 40, 50, 60, 100 teams across 6 active judges
// Verifies no team is unassigned, no duplicate assignment, equal spread (<= 1 diff)
// ============================================================

import { distributeTeamsToJudges, DEFAULT_ACTIVE_JUDGES } from '../src/services/judge-assignment.ts';

const testCases = [1, 3, 37, 40, 50, 60, 100];
let passed = 0;
let total = 0;

function assert(condition, desc) {
  total++;
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${desc}`);
  } else {
    console.error(`  \x1b[31m✗ FAIL:\x1b[0m ${desc}`);
  }
}

console.log('\x1b[36m' + '='.repeat(70));
console.log(' JUDGE DISTRIBUTION ALGORITHM VERIFICATION');
console.log('='.repeat(70) + '\x1b[0m\n');

for (const teamCount of testCases) {
  console.log(`\x1b[33m--- Testing ${teamCount} qualified teams across 6 active judges ---\x1b[0m`);
  const teams = Array.from({ length: teamCount }, (_, i) => ({
    teamId: `CRL-${String(i + 1).padStart(4, '0')}`,
  }));

  const assignments = distributeTeamsToJudges(teams, DEFAULT_ACTIVE_JUDGES);

  // 1. Check all judges exist
  assert(Object.keys(assignments).length === 6, `All 6 judges present in assignment map`);

  // 2. Check total assigned equals total teams
  const allAssigned = Object.values(assignments).flat();
  assert(allAssigned.length === teamCount, `Total assigned teams (${allAssigned.length}) === input teams (${teamCount})`);

  // 3. Check uniqueness (no team assigned multiple times)
  const uniqueAssigned = new Set(allAssigned);
  assert(uniqueAssigned.size === teamCount, `All assigned team IDs are unique (no duplicates)`);

  // 4. Check no qualified team left unassigned
  const missing = teams.filter((t) => !uniqueAssigned.has(t.teamId));
  assert(missing.length === 0, `Zero qualified teams left unassigned`);

  // 5. Check even distribution: difference between max and min counts <= 1
  const counts = Object.values(assignments).map((arr) => arr.length);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  assert(max - min <= 1, `Even distribution verified: counts = [${counts.join(', ')}] (spread = ${max - min} <= 1)`);
}

console.log('\n' + '='.repeat(70));
console.log(` RESULTS: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
console.log('='.repeat(70) + '\n');

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
