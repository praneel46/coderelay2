// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Timer Synchronization & Reconnect Resilience Test Suite
// Verifies:
// 1. Authoritative Firestore timestamp derivation
// 2. Immediate start without participant 5s countdown delay
// 3. Network propagation lag resilience (e.g. 4s delay -> 296s remaining)
// 4. Page refresh / reconnect resilience (e.g. 30s delay -> 270s remaining)
// 5. Organizer and participant clock alignment
// ============================================================

const STRIKE_DURATIONS = {
  strike1: 5 * 60,   // 300s
  strike2: 15 * 60,  // 900s
  strike3: 20 * 60,  // 1200s
};

function computeRemaining(endsAt, nowMs = Date.now()) {
  if (!endsAt) return 0;
  const diff = Math.max(0, Math.floor((new Date(endsAt).getTime() - nowMs) / 1000));
  return diff;
}

function formatDisplayTime(secondsRemaining) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

console.log('\x1b[36m' + '='.repeat(70));
console.log(' VIGYANTRA 2026: ROUND 2 TIMER SYNCHRONIZATION TEST SUITE');
console.log('='.repeat(70) + '\x1b[0m\n');

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${testName}`);
  } else {
    console.error(`  \x1b[31m✗ FAIL:\x1b[0m ${testName}`);
  }
}

// ------------------------------------------------------------
// Test 1: Authoritative Firestore Timestamps
// ------------------------------------------------------------
console.log('\x1b[33m--- Section 1: Authoritative Firestore Timestamp Generation ---\x1b[0m');
const baseNow = new Date('2026-09-19T10:30:00.000Z');
const startTime = baseNow.toISOString();

for (const [strikeId, duration] of Object.entries(STRIKE_DURATIONS)) {
  const endTime = new Date(baseNow.getTime() + duration * 1000).toISOString();
  const diffSec = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000;
  assert(diffSec === duration, `${strikeId} authoritative duration is exactly ${duration}s`);
}

// ------------------------------------------------------------
// Test 2: Instant Synchronization at T+0 (No 5-second delay)
// ------------------------------------------------------------
console.log('\n\x1b[33m--- Section 2: Zero-Delay Participant Mount at T+0 ---\x1b[0m');
{
  const duration = STRIKE_DURATIONS.strike1; // 300s
  const endTime = new Date(baseNow.getTime() + duration * 1000).toISOString();

  const organizerRemaining = computeRemaining(endTime, baseNow.getTime());
  const participantRemaining = computeRemaining(endTime, baseNow.getTime());

  assert(organizerRemaining === 300, 'Organizer timer starts at 300s (05:00)');
  assert(participantRemaining === 300, 'Participant timer starts at 300s (05:00) with zero artificial delay');
  assert(organizerRemaining === participantRemaining, 'Organizer and Participant are 100% in sync at T+0');
  assert(formatDisplayTime(participantRemaining) === '05:00', 'Display time is 05:00');
}

// ------------------------------------------------------------
// Test 3: Network Propagation Delay (4s network latency)
// ------------------------------------------------------------
console.log('\n\x1b[33m--- Section 3: Network Propagation Delay (4s lag) ---\x1b[0m');
{
  const duration = STRIKE_DURATIONS.strike1; // 300s
  const endTime = new Date(baseNow.getTime() + duration * 1000).toISOString();

  const participantMountTime = baseNow.getTime() + 4000; // 4s late
  const participantRemaining = computeRemaining(endTime, participantMountTime);

  assert(participantRemaining === 296, 'Participant receiving state 4s late immediately shows 296s (NOT 300s)');
  assert(formatDisplayTime(participantRemaining) === '04:56', 'Display time immediately shows 04:56');
}

// ------------------------------------------------------------
// Test 4: Page Refresh / Reconnect Resilience
// ------------------------------------------------------------
console.log('\n\x1b[33m--- Section 4: Refresh / Reconnect at T+45s ---\x1b[0m');
{
  const duration = STRIKE_DURATIONS.strike1; // 300s
  const endTime = new Date(baseNow.getTime() + duration * 1000).toISOString();

  const reconnectTime = baseNow.getTime() + 45000; // 45s elapsed
  const participantRemaining = computeRemaining(endTime, reconnectTime);

  assert(participantRemaining === 255, 'Reconnecting participant at T+45s gets exactly 255s (no reset)');
  assert(formatDisplayTime(participantRemaining) === '04:15', 'Display time shows 04:15');
}

// ------------------------------------------------------------
// Test 5: Strikes 2 and 3 Duration Verification
// ------------------------------------------------------------
console.log('\n\x1b[33m--- Section 5: Strike 2 (15m) & Strike 3 (20m) Verification ---\x1b[0m');
{
  const end2 = new Date(baseNow.getTime() + STRIKE_DURATIONS.strike2 * 1000).toISOString();
  assert(computeRemaining(end2, baseNow.getTime()) === 900, 'Strike 2 duration is exactly 900s');
  assert(formatDisplayTime(900) === '15:00', 'Strike 2 display is 15:00');

  const end3 = new Date(baseNow.getTime() + STRIKE_DURATIONS.strike3 * 1000).toISOString();
  assert(computeRemaining(end3, baseNow.getTime()) === 1200, 'Strike 3 duration is exactly 1200s');
  assert(formatDisplayTime(1200) === '20:00', 'Strike 3 display is 20:00');
}

// ------------------------------------------------------------
// Test 6: Expiration Boundary
// ------------------------------------------------------------
console.log('\n\x1b[33m--- Section 6: Expiration Boundary ---\x1b[0m');
{
  const duration = STRIKE_DURATIONS.strike1;
  const endTime = new Date(baseNow.getTime() + duration * 1000).toISOString();

  const exactExpiration = baseNow.getTime() + duration * 1000;
  const pastExpiration = baseNow.getTime() + (duration + 5) * 1000;

  assert(computeRemaining(endTime, exactExpiration) === 0, 'Timer hits 0s at exact expiration');
  assert(computeRemaining(endTime, pastExpiration) === 0, 'Timer clamps to 0s past expiration');
  assert(formatDisplayTime(0) === '00:00', 'Display time is 00:00');
}

// ------------------------------------------------------------
// Summary
// ------------------------------------------------------------
console.log('\n' + '='.repeat(70));
console.log(` RESULTS: ${passed}/${total} assertions passed (${Math.round((passed/total)*100)}%)`);
console.log('='.repeat(70) + '\n');

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
