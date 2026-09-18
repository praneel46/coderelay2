// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// MOCK DATA — Submissions
// ============================================================

import type { Submission } from '../types/competition';

export const MOCK_SUBMISSIONS: Submission[] = [
  {
    questionId: 'q1-01',
    teamId: 'CRL-0000',
    strikeId: 'strike1',
    answer: 'A',
    submittedAt: new Date(Date.now() - 180000).toISOString(),
    status: 'submitted',
  },
  {
    questionId: 'q2-01',
    teamId: 'CRL-0000',
    strikeId: 'strike2',
    answer: `def sum_even(n):\n    total = 0\n    for i in range(1, n + 1):\n        if i % 2 == 0:\n            total += i\n    return total\n\nprint(sum_even(10))  # Expected: 30`,
    submittedAt: new Date(Date.now() - 60000).toISOString(),
    status: 'submitted',
  },
];
