// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// MOCK DATA — Results & Live Leaderboard Seed
// ============================================================

import type { RankEntry } from '../types/results';

const BASE_TIME = Date.now() - 3600000; // 1 hour ago

export const MOCK_RESULTS: RankEntry[] = [
  {
    rank: 1,
    teamId: 'CRL-0000',
    teamName: 'Quantum Coders',
    predictScore: 27,
    debugMarks: 52,
    codeMarks: 48,
    debugCodeTotal: 100,
    finalScore: 127,
    evaluationStatus: 'evaluated',
    timing: {
      strike1CompletedAt: new Date(BASE_TIME + 280000).toISOString(),
      strike2CompletedAt: new Date(BASE_TIME + 1120000).toISOString(),
      strike3CompletedAt: new Date(BASE_TIME + 2240000).toISOString(),
      finalSubmittedAt: new Date(BASE_TIME + 2240000).toISOString(),
      totalElapsedSeconds: 2240,
    },
  },
  {
    rank: 2,
    teamId: 'CRL-0002',
    teamName: 'Stack Overflow',
    predictScore: 24,
    debugMarks: 50,
    codeMarks: 45,
    debugCodeTotal: 95,
    finalScore: 119,
    evaluationStatus: 'evaluated',
    timing: {
      strike1CompletedAt: new Date(BASE_TIME + 295000).toISOString(),
      strike2CompletedAt: new Date(BASE_TIME + 1150000).toISOString(),
      strike3CompletedAt: new Date(BASE_TIME + 2310000).toISOString(),
      finalSubmittedAt: new Date(BASE_TIME + 2310000).toISOString(),
      totalElapsedSeconds: 2310,
    },
  },
  {
    rank: 3,
    teamId: 'CRL-0001',
    teamName: 'Binary Blazers',
    predictScore: 21,
    debugMarks: 44,
    codeMarks: 42,
    debugCodeTotal: 86,
    finalScore: 107,
    evaluationStatus: 'evaluated',
    timing: {
      strike1CompletedAt: new Date(BASE_TIME + 298000).toISOString(),
      strike2CompletedAt: new Date(BASE_TIME + 1180000).toISOString(),
      strike3CompletedAt: new Date(BASE_TIME + 2390000).toISOString(),
      finalSubmittedAt: new Date(BASE_TIME + 2390000).toISOString(),
      totalElapsedSeconds: 2390,
    },
  },
  {
    rank: 4,
    teamId: 'CRL-0003',
    teamName: 'Neural Ninjas',
    predictScore: 18,
    debugMarks: 38,
    codeMarks: null,
    debugCodeTotal: 38,
    finalScore: 56,
    evaluationStatus: 'in_progress',
    timing: {
      strike1CompletedAt: new Date(BASE_TIME + 290000).toISOString(),
      strike2CompletedAt: new Date(BASE_TIME + 1170000).toISOString(),
      strike3CompletedAt: null,
      finalSubmittedAt: new Date(BASE_TIME + 1170000).toISOString(),
      totalElapsedSeconds: 1170,
    },
  },
  {
    rank: 5,
    teamId: 'CRL-0004',
    teamName: 'Recursive Dreams',
    predictScore: 15,
    debugMarks: null,
    codeMarks: null,
    debugCodeTotal: 0,
    finalScore: 15,
    evaluationStatus: 'pending',
    timing: {
      strike1CompletedAt: new Date(BASE_TIME + 299000).toISOString(),
      strike2CompletedAt: null,
      strike3CompletedAt: null,
      finalSubmittedAt: new Date(BASE_TIME + 299000).toISOString(),
      totalElapsedSeconds: 299,
    },
  },
];
