// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// MOCK DATA — Judges
// ============================================================

import type { Judge } from '../types/judge';

export const MOCK_JUDGES: Judge[] = [
  {
    judgeId: 'J001',
    name: 'Dr. Anil Krishnan',
    email: 'anil.krishnan@vigyantra.in',
    active: true,
    assignedTeamIds: ['CRL-0000', 'CRL-0001'],
    pendingCount: 2,
    evaluatedCount: 0,
  },
  {
    judgeId: 'J002',
    name: 'Prof. Sunita Menon',
    email: 'sunita.menon@vigyantra.in',
    active: true,
    assignedTeamIds: ['CRL-0002', 'CRL-0003'],
    pendingCount: 1,
    evaluatedCount: 1,
  },
  {
    judgeId: 'J003',
    name: 'Mr. Ravi Tiwari',
    email: 'ravi.tiwari@vigyantra.in',
    active: false,
    assignedTeamIds: ['CRL-0004'],
    pendingCount: 1,
    evaluatedCount: 0,
  },
];
