// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// MOCK DATA — Judges
// 6 Authoritative Judge Profiles
// ============================================================

import type { Judge } from '../types/judge';

export const MOCK_JUDGES: Judge[] = [
  {
    judgeId: 'J001',
    name: 'Dr. Anil Krishnan',
    email: 'judge1@coderelay.com',
    active: true,
    assignedTeamIds: ['CRL-0000', 'CRL-0001'],
    pendingCount: 2,
    evaluatedCount: 0,
  },
  {
    judgeId: 'J002',
    name: 'Prof. Sunita Menon',
    email: 'judge2@coderelay.com',
    active: true,
    assignedTeamIds: ['CRL-0002', 'CRL-0003'],
    pendingCount: 1,
    evaluatedCount: 1,
  },
  {
    judgeId: 'J003',
    name: 'Mr. Ravi Tiwari',
    email: 'judge3@coderelay.com',
    active: true,
    assignedTeamIds: ['CRL-0004'],
    pendingCount: 1,
    evaluatedCount: 0,
  },
  {
    judgeId: 'J004',
    name: 'Judge 004',
    email: 'judge4@coderelay.com',
    active: true,
    assignedTeamIds: [],
    pendingCount: 0,
    evaluatedCount: 0,
  },
  {
    judgeId: 'J005',
    name: 'Judge 005',
    email: 'judge5@coderelay.com',
    active: true,
    assignedTeamIds: [],
    pendingCount: 0,
    evaluatedCount: 0,
  },
  {
    judgeId: 'J006',
    name: 'Judge 006',
    email: 'judge6@coderelay.com',
    active: true,
    assignedTeamIds: [],
    pendingCount: 0,
    evaluatedCount: 0,
  },
];
