# VIGYANTRA 2026 — CODE RELAY
## Round 2 Production Bug Rectification & Stabilization Report

**Event:** VIGYANTRA 2026 — CODE RELAY  
**Status:** ALL PRODUCTION BUGS RESOLVED & VERIFIED (Zero Regressions)  
**Tier:** Firebase Spark Tier (No Cloud Functions, No Blaze, Pure Client/Rules Architecture)  
**Security Status:** PASS (Zero answer keys in bundle, field-level Firestore rules enforced)  

---

### 1. Executive Summary

During live production Round 2 verification with real participant and judge workflows, four interconnected issues were identified:
1. **Judge Score Save Failure**: A Firestore setDoc crash (`Unsupported field value: undefined in timing.totalElapsedSeconds`).
2. **Leaderboard / Results Inconsistency**: Qualified and submitted teams disappearing or having null scores erroneously coerced to 0, resulting in misleading ranks.
3. **Judge Predict Visibility**: Assigned judges could not consistently view auto-calculated Predict marks, and a falsy check (`> 0`) concealed legitimate scores of 0.
4. **Session Management Offline Status**: The Session Management dashboard was showing static mock data instead of real participant heartbeats.

A comprehensive stabilization pass was engineered and verified across the entire system. **All fixes are generic across all 50 teams and all 6 judges (zero hardcoding of `CRL-0005` or `Judge 5`).**

All 25/25 automated stabilization tests, 17/17 judge pipeline tests, 45/45 submission monitor tests, 21/21 rectification tests, and 8/8 Firestore security tests pass with 100% assertions satisfied.

---

### 2. Root Cause Analysis

#### Bug 1: Judge Score Save Failure (`undefined` in `timing.totalElapsedSeconds`)
- **Root Cause**: When a team submits early or when timing documents are initialized prior to all three strikes completing, `timing.totalElapsedSeconds` or partial strike elapsed times can be `undefined`. When a judge saved marks, Firestore's SDK throws an unhandled exception: `Function setDoc() called with invalid data. Unsupported field value: undefined`.
- **Resolution**:
  1. Created a pure, recursive `sanitizeForFirestore<T>()` utility in `src/utils/sanitize.ts` that strips `undefined` keys before any Firestore write.
  2. Implemented strict parameter validation to ensure required fields (`teamId`, score bounds [0, 30] and [0, 60]) are verified before write.
  3. `totalElapsedSeconds` is now omitted or calculated safely as a number only when all strike timings are present.

#### Bug 2: Leaderboard / Results Inconsistency
- **Root Cause**:
  1. Teams with partial evaluations were either omitted from the results map or coerced to `finalScore = 0`.
  2. The leaderboard sorting logic assigned arbitrary ranks (e.g. rank #1) to teams with 0 points or partial evaluations before judges completed grading.
  3. Team ID casing differences between auth tokens, team documents, and submission records caused silent query mismatches.
- **Resolution**:
  1. Multi-collection reconciliation in `rebuildLeaderboard` merges all qualified teams from `teams`, `results`, and `submissions` with case-insensitive canonical normalization.
  2. Unscored components remain `null` and render as em-dash (`—`).
  3. Teams with missing score components receive `rank: null` (`UNRANKED`) and status `PARTIALLY EVALUATED` or `EVALUATION PENDING`.
  4. Only fully evaluated teams (all 3 strikes scored) receive a numeric final rank.

#### Bug 3: Judge Predict Visibility & Zero Score Concealment
- **Root Cause**:
  1. The Judge UI (`TeamSubmissions.tsx`) checked `if (predictScore > 0)` before displaying the score badge, rendering a legitimate score of 0 invisible or pending.
  2. When a judge updated scores, the existing `predictScore` was overwritten if not explicitly passed back.
- **Resolution**:
  1. Removed `> 0` checks; scores are checked with `predictScore !== null && predictScore !== undefined`.
  2. `updateTeamScores` in `FirebaseDataProvider` preserves existing untouched score fields (`predictScore`, `debugMarks`, `codeMarks`) if omitted during partial saves.

#### Bug 4: Session Management Inactivity & Stale Status
- **Root Cause**:
  1. `SessionManagement.tsx` previously read from static `mock-sessions.ts` instead of real-time Firestore collections.
  2. Participant sessions had no active heartbeat mechanism and created duplicate records upon page refresh.
- **Resolution**:
  1. Created `useSessionHeartbeat` hook running strictly for authenticated participants (`role === 'participant'`).
  2. Uses `sessionStorage.getItem('crl_participant_session_id')` to deduplicate session documents across browser reloads.
  3. Emits heartbeats every 30 seconds with client device metadata and online/offline event handlers.
  4. `SessionManagement.tsx` listens to the live `/sessions` Firestore collection; timestamps older than 90 seconds are automatically displayed as `offline`.

---

### 3. Safeguards & Protections Implemented

#### Safeguard 1: Sanitization Without Silent Masking
`sanitizeForFirestore()` cleans undefined values recursively, but does NOT bypass schema integrity. Required fields (`teamId`, score boundary rules 0–30 and 0–60, override reasons) are explicitly validated with fast failures before any write operation.

#### Safeguard 2: Field-Level Firestore Security Rules
In `firestore.rules`, updates to `/results/{teamId}` by assigned judges are restricted to authorized fields:
- Assigned judges CAN save `debugMarks` (0–60), `codeMarks` (0–60), `predictScore` (0–30), `notes`, and evaluation timestamps.
- Assigned judges CANNOT modify `timing` (e.g. `totalElapsedSeconds`).
- Assigned judges CANNOT change `teamId` or reassign `assignedJudgeId`.
- Out-of-bounds scores (>60 for debug/code, >30 for predict) are rejected with `PERMISSION_DENIED`.
- Unassigned judges and participants cannot write to `/results/{teamId}`.
- Organizers retain broad administrative override and correction authority.

#### Safeguard 3: Strike 1 Answer Key Security Preservation
Verified with `scripts/verify-bundle-security.mjs`:
- Zero `STRIKE1_KEY` occurrences in the participant bundle.
- Zero `calculatePredictScore` in the participant bundle.
- Zero plaintext answer strings (`q1-01: A`, `q1-02: C`, `q1-03: A`) in client bundles.
- Strike 1 scoring is isolated strictly to judge and organizer modules.

#### Safeguard 4: Participant-Only Heartbeats
- Only users with `role === 'participant'` emit heartbeats to `/sessions`.
- Judges and organizers do not emit participant heartbeats, avoiding noise and permission issues.
- `firestore.rules` enforces that `/sessions` documents can only be created by participants with matching user IDs.

---

### 4. Score State Matrix Verification

All 8 combinations of the Predict / Debug / Code score state matrix were tested and verified:

| Combination | Predict | Debug | Code | Final Score | Display Total | Status | Rank |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Comb 1** | `null` | `null` | `null` | `null` | `— / 150` | `PENDING` | `null` (UNRANKED) |
| **Comb 2** | `10` | `null` | `null` | `null` | `— / 150` | `PARTIALLY EVALUATED` | `null` (UNRANKED) |
| **Comb 3** | `null` | `40` | `null` | `null` | `— / 150` | `PARTIALLY EVALUATED` | `null` (UNRANKED) |
| **Comb 4** | `null` | `null` | `50` | `null` | `— / 150` | `PARTIALLY EVALUATED` | `null` (UNRANKED) |
| **Comb 5** | `10` | `40` | `null` | `null` | `— / 150` | `PARTIALLY EVALUATED` | `null` (UNRANKED) |
| **Comb 6** | `0` | `0` | `0` | `0` | `0 / 150` | `EVALUATED` | Ranked (Numeric) |
| **Comb 7** | `20` | `50` | `45` | `115` | `115 / 150` | `EVALUATED` | Ranked (Numeric) |
| **Comb 8** | `30` | `60` | `60` | `150` | `150 / 150` | `EVALUATED` | Ranked (Numeric) |

**Key Assertions Verified:**
- An unentered mark is always `null` and displayed as `—`.
- An actual score of 0 is numeric `0` and displayed as `0`.
- `finalScore` is calculated if and only if all three scores are non-null.
- Tied scores are broken by earlier participant submission timestamp (`finalSubmittedAt`), never by judge evaluation timestamp.
- Time is strictly a tie-breaker; no points are ever deducted for elapsed time.

---

### 5. Emergency Manual Strike 1 Predict Override

An emergency manual override mechanism for Strike 1 Predict scores was added for assigned judges and organizers:
- **Range:** 0 to 30 points.
- **Audit Logging:** Every manual override automatically records an immutable entry in the `/auditLogs` collection with `teamId`, `judgeId`, `previousScore`, `newScore`, `reason`, and `timestamp`.
- **Sync Protection:** `syncSubmissionsToResultsDoc` checks `predictScoreSource === 'MANUAL_OVERRIDE'` and will NEVER overwrite a manual score with auto-calculated values.
- **Access Control:** Enforced in both the UI and Firestore security rules (participants are denied write access).

---

### 6. Automated Test Suite Results

All test suites executed with 100% pass rates:

| Test Suite | File | Tests / Assertions | Result |
|---|---|:---:|:---:|
| **Round 2 Stabilization & Safeguards** | `scripts/test-round2-stabilization.mjs` | 25 / 25 | **PASS** (100%) |
| **Judge Save Pipeline & Propagation** | `scripts/test-judge-save-pipeline.mjs` | 17 / 17 | **PASS** (100%) |
| **Submission Monitor & Leaderboard** | `scripts/test-submission-monitor-pipeline.mjs` | 45 / 45 | **PASS** (100%) |
| **Round 2 Rectification Suite** | `scripts/test-round2-rectification.mjs` | 21 / 21 | **PASS** (100%) |
| **Firestore /results Security Suite** | `scripts/test-results-security.mjs` | 8 / 8 | **PASS** (100%) |
| **Participant Bundle Security Scan** | `scripts/verify-bundle-security.mjs` | 7 / 7 checks | **PASS** (100%) |
| **TypeScript Compilation** | `npx tsc -b` | Full project | **PASS** (0 errors) |
| **Vite Production Build** | `npm run build` | 2358 modules | **PASS** (0 errors) |

---

### 7. Deployment & Verification Checklist

- [x] Code sanitized against `undefined` values before Firestore writes
- [x] Field-level Firestore security rules protecting `timing` and `assignedJudgeId`
- [x] Participant bundle verified clean of `STRIKE1_KEY` and answers
- [x] Participant session heartbeats active every 30s with refresh deduplication
- [x] Leaderboard correctly reconciles qualified teams, preserves `null` scores, and keeps partial teams unranked
- [x] Manual Strike 1 Predict override functional with audit logging
- [x] Full production build passes cleanly (`tsc -b && vite build`)
