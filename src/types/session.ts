// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Session & audit log types
// ============================================================

export type SessionRole = 'participant' | 'organizer' | 'judge';

export interface Session {
  sessionId: string;
  userId: string;
  role: SessionRole;
  teamId?: string;
  judgeId?: string;
  device: string;
  connection: 'online' | 'offline' | 'unstable';
  lastActive: string; // ISO timestamp
  status: 'active' | 'expired' | 'revoked';
}

export interface AuditLog {
  logId: string;
  timestamp: string;
  actor: string;
  actorRole: SessionRole;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
}
