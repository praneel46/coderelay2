// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// MOCK DATA — Teams
//
// FORMAT SPECIFICATION:
// - Team ID format: CRL-0000 (four digits after CRL-)
// - Default mock team: CRL-0000
// - Access codes: Real access codes have already been randomly generated
//   and will be uploaded/provided by the organizer later.
// - DO NOT hardcode or invent real participant credentials.
// - This structure is ready to accept the uploaded access code list.
// ============================================================

import type { Team } from '../types/competition';

/**
 * Mock teams data using the authoritative CRL-0000 format.
 * Access codes here are temporary mock tokens for local UI development only.
 * They will be replaced dynamically once the official access-code list is uploaded.
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
    accessCode: 'MOCK-PASS',
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
    accessCode: 'MOCK-PASS',
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
    accessCode: 'MOCK-PASS',
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
    accessCode: 'MOCK-PASS',
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
    accessCode: 'MOCK-PASS',
    status: 'active',
  },
];

/**
 * In-memory / dynamic access code registry ready for organizer upload.
 * When the real access code list is provided, loadUploadedAccessCodes() can ingest it.
 */
let uploadedAccessCodes: Map<string, string> | null = null;

export function loadUploadedAccessCodes(mapping: Record<string, string>): void {
  uploadedAccessCodes = new Map(
    Object.entries(mapping).map(([id, code]) => [id.trim().toUpperCase(), code.trim()])
  );
}

/**
 * Validate participant credentials against mock data or uploaded access code list.
 * Supports the authoritative CRL-0000 format.
 */
export function validateParticipantCredentials(
  teamId: string,
  accessCode: string
): Team | null {
  const normalizedTeamId = teamId.trim().toUpperCase();
  const normalizedCode = accessCode.trim();

  // If official list was uploaded, check that first
  if (uploadedAccessCodes && uploadedAccessCodes.has(normalizedTeamId)) {
    const expectedCode = uploadedAccessCodes.get(normalizedTeamId);
    if (expectedCode === normalizedCode) {
      return (
        MOCK_TEAMS.find((t) => t.teamId === normalizedTeamId) || {
          teamId: normalizedTeamId,
          teamName: `Team ${normalizedTeamId}`,
          members: [
            { index: 1, name: 'Member 1' },
            { index: 2, name: 'Member 2' },
            { index: 3, name: 'Member 3' },
          ],
          accessCode: normalizedCode,
          status: 'active',
        }
      );
    }
    return null;
  }

  // Fallback to mock teams during development
  const team = MOCK_TEAMS.find(
    (t) =>
      t.teamId.toUpperCase() === normalizedTeamId &&
      t.accessCode === normalizedCode
  );
  return team ?? null;
}
