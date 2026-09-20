// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// MOCK DATA — Teams (Structure Reference Only)
//
// FORMAT SPECIFICATION:
// - Team ID format: CRL-0000 (four digits after CRL-)
// - Default mock team: CRL-0000
// - Access codes: Official access codes are stored securely in Firestore
//   and managed via Firebase Auth / Admin SDK.
// - No plaintext passwords or mock credentials are stored here.
// ============================================================

import type { Team } from '../types/competition';

/**
 * Mock teams data using the authoritative CRL-0000 format.
 * Access codes are masked tokens only.
 */
export const MOCK_TEAMS: Team[] = [
  {
    teamId: 'CRL-0000',
    teamName: 'Quantum Coders',
    members: [
      { index: 1, name: 'Arjun Sharma', email: 'arjun@example.com' },
      { index: 2, name: 'Priya Nair', email: 'priya@example.com' },
      { index: 3, name: 'Rahul Verma', email: 'rahul@example.com' },
    ],
    accessCode: '••••••••',
    status: 'active',
  },
  {
    teamId: 'CRL-0001',
    teamName: 'Binary Blazers',
    members: [
      { index: 1, name: 'Sneha Reddy', email: 'sneha@example.com' },
      { index: 2, name: 'Kiran Patel', email: 'kiran@example.com' },
      { index: 3, name: 'Dev Mehta', email: 'dev@example.com' },
    ],
    accessCode: '••••••••',
    status: 'active',
  },
  {
    teamId: 'CRL-0002',
    teamName: 'Stack Overflow',
    members: [
      { index: 1, name: 'Aditya Kumar', email: 'aditya@example.com' },
      { index: 2, name: 'Meera Iyer', email: 'meera@example.com' },
      { index: 3, name: 'Varun Singh', email: 'varun@example.com' },
    ],
    accessCode: '••••••••',
    status: 'active',
  },
  {
    teamId: 'CRL-0003',
    teamName: 'Neural Ninjas',
    members: [
      { index: 1, name: 'Lakshmi Rao', email: 'lakshmi@example.com' },
      { index: 2, name: 'Amit Joshi', email: 'amit@example.com' },
      { index: 3, name: 'Nisha Gupta', email: 'nisha@example.com' },
    ],
    accessCode: '••••••••',
    status: 'active',
  },
  {
    teamId: 'CRL-0004',
    teamName: 'Recursive Dreams',
    members: [
      { index: 1, name: 'Sanjay Bose', email: 'sanjay@example.com' },
      { index: 2, name: 'Pooja Choudhary', email: 'pooja@example.com' },
      { index: 3, name: 'Raj Pillai', email: 'raj@example.com' },
    ],
    accessCode: '••••••••',
    status: 'active',
  },
];

/**
 * Validate participant credentials: In production, all authentication
 * must route through Firebase Authentication (signInParticipantWithCredentials).
 */
export function validateParticipantCredentials(): Team | null {
  throw new Error('Direct mock authentication is disabled. All authentication must proceed through official Firebase Auth.');
}
