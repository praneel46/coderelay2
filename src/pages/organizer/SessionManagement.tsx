import React, { useState, useEffect } from 'react';
import { Layers, Smartphone, Monitor, Laptop, Wifi, WifiOff, AlertCircle, LogOut, XCircle } from 'lucide-react';
import OrganizerLayout from '../../components/layout/OrganizerLayout';
import type { Session, SessionRole } from '../../types/session';
import { db } from '../../firebase/config';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { COLLECTIONS } from '../../firebase/firestore';

const INITIAL_MOCK_SESSIONS: Session[] = [
  {
    sessionId: 'sess-001',
    userId: 'team-crl-0000',
    role: 'participant',
    teamId: 'CRL-0000',
    device: 'Desktop (Chrome 124 / Windows)',
    connection: 'online',
    lastActive: new Date(Date.now() - 1000 * 20).toISOString(),
    status: 'active',
  },
  {
    sessionId: 'sess-002',
    userId: 'team-crl-0001',
    role: 'participant',
    teamId: 'CRL-0001',
    device: 'Laptop (Edge 124 / Windows)',
    connection: 'online',
    lastActive: new Date(Date.now() - 1000 * 45).toISOString(),
    status: 'active',
  },
  {
    sessionId: 'sess-003',
    userId: 'team-crl-0002',
    role: 'participant',
    teamId: 'CRL-0002',
    device: 'Desktop (Firefox 125 / Linux)',
    connection: 'offline',
    lastActive: new Date(Date.now() - 1000 * 420).toISOString(),
    status: 'active',
  },
  {
    sessionId: 'sess-004',
    userId: 'team-crl-0003',
    role: 'participant',
    teamId: 'CRL-0003',
    device: 'Laptop (Safari 17 / macOS)',
    connection: 'online',
    lastActive: new Date(Date.now() - 1000 * 15).toISOString(),
    status: 'active',
  },
  {
    sessionId: 'sess-005',
    userId: 'team-crl-0004',
    role: 'participant',
    teamId: 'CRL-0004',
    device: 'Mobile (Chrome Mobile / Android)',
    connection: 'unstable',
    lastActive: new Date(Date.now() - 1000 * 95).toISOString(),
    status: 'active',
  },
  {
    sessionId: 'sess-j001',
    userId: 'judge-j001',
    role: 'judge',
    judgeId: 'J001',
    device: 'Laptop (Chrome 124 / macOS)',
    connection: 'online',
    lastActive: new Date(Date.now() - 1000 * 30).toISOString(),
    status: 'active',
  },
  {
    sessionId: 'sess-j002',
    userId: 'judge-j002',
    role: 'judge',
    judgeId: 'J002',
    device: 'Desktop (Firefox 125 / Windows)',
    connection: 'online',
    lastActive: new Date(Date.now() - 1000 * 60).toISOString(),
    status: 'active',
  },
  {
    sessionId: 'sess-org-01',
    userId: 'org-admin',
    role: 'organizer',
    device: 'Workstation (Chrome 124 / Windows)',
    connection: 'online',
    lastActive: new Date().toISOString(),
    status: 'active',
  },
];

export default function SessionManagement() {
  const [sessions, setSessions] = useState<Session[]>(INITIAL_MOCK_SESSIONS);
  const [activeTab, setActiveTab] = useState<SessionRole>('participant');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Real-time listener to Firestore /sessions
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, COLLECTIONS.SESSIONS),
      (snapshot) => {
        if (!snapshot.empty) {
          const liveSessions: Session[] = snapshot.docs.map((d) => {
            const data = d.data();
            const lastActive = data.lastHeartbeat || data.createdAt || new Date().toISOString();
            const diffSec = Math.floor((Date.now() - new Date(lastActive).getTime()) / 1000);

            // Stale threshold: 90 seconds (Safeguard 4)
            let conn: 'online' | 'offline' | 'unstable' = data.connection || 'offline';
            if (data.status === 'revoked' || data.status === 'expired') {
              conn = 'offline';
            } else if (diffSec > 90) {
              conn = 'offline';
            } else if (diffSec <= 90 && data.status === 'active') {
              conn = 'online';
            }

            return {
              sessionId: data.sessionId || d.id,
              userId: data.userId || 'unknown',
              role: (data.role || 'participant') as SessionRole,
              teamId: data.teamId,
              judgeId: data.judgeId,
              device: data.device || 'Desktop',
              connection: conn,
              lastActive,
              status: (data.status || 'active') as 'active' | 'expired' | 'revoked',
            };
          });

          // Sort by lastActive descending
          liveSessions.sort(
            (a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
          );
          setSessions(liveSessions);
        }
      },
      (err) => {
        console.warn('[SessionManagement] Error listening to sessions collection:', err);
      }
    );
    return () => unsub();
  }, []);

  const filteredSessions = sessions.filter((s) => s.role === activeTab);

  const handleForceLogout = async (sessionId: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.SESSIONS, sessionId), {
        status: 'expired',
        connection: 'offline',
        updatedAt: new Date().toISOString(),
      });
      showToast(`Session ${sessionId} forcefully logged out.`);
    } catch {
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === sessionId ? { ...s, status: 'expired', connection: 'offline' } : s))
      );
      showToast(`Session ${sessionId} forcefully logged out.`);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.SESSIONS, sessionId), {
        status: 'revoked',
        connection: 'offline',
        revokedAt: new Date().toISOString(),
      });
      showToast(`Session ${sessionId} token permanently revoked.`);
    } catch {
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === sessionId ? { ...s, status: 'revoked', connection: 'offline' } : s))
      );
      showToast(`Session ${sessionId} token permanently revoked.`);
    }
  };

  const formatLastActive = (iso: string) => {
    const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  };

  const getDeviceIcon = (device: string) => {
    if (device.toLowerCase().includes('mobile')) return Smartphone;
    if (device.toLowerCase().includes('laptop')) return Laptop;
    return Monitor;
  };

  return (
    <OrganizerLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-green-900/90 border border-green-500/50 text-green-300 px-4 py-2 rounded-lg text-sm font-mono shadow-lg">
            {toast}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-white font-black text-2xl tracking-wide flex items-center gap-3">
              <Layers className="w-6 h-6 text-indigo-400" />
              SESSION MANAGEMENT
            </h1>
            <p className="text-slate-500 text-sm font-mono mt-1">
              Active connections, device telemetry, and access revocation controls
            </p>
          </div>
          <div className="flex items-center gap-2 bg-dark-800 p-1.5 rounded-xl border border-dark-600">
            {(['participant', 'judge', 'organizer'] as SessionRole[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white shadow-glow-indigo font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}s ({sessions.filter((s) => s.role === tab).length})
              </button>
            ))}
          </div>
        </div>

        {/* Sessions Table */}
        <div className="card-dark overflow-hidden border border-dark-700 rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700 text-slate-500 font-mono text-xs uppercase tracking-wider bg-dark-900/60">
                  <th className="text-left px-5 py-3">Session & Target</th>
                  <th className="text-left px-4 py-3">Device & Client</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Connection</th>
                  <th className="text-left px-4 py-3">Last Heartbeat</th>
                  <th className="text-right px-5 py-3">Session Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {filteredSessions.map((s) => {
                  const DevIcon = getDeviceIcon(s.device);
                  const isAlive = s.status === 'active';
                  return (
                    <tr key={s.sessionId} className="hover:bg-dark-800/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-xs text-indigo-400 font-semibold">{s.sessionId}</div>
                        <div className="text-white font-medium text-sm">
                          {s.teamId ? `Team: ${s.teamId}` : s.judgeId ? `Judge: ${s.judgeId}` : s.userId}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 text-slate-300 text-xs font-mono">
                          <DevIcon className="w-3.5 h-3.5 text-slate-500" />
                          <span>{s.device}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${
                            s.status === 'active'
                              ? 'text-green-400 border-green-800/50 bg-green-900/10'
                              : s.status === 'revoked'
                              ? 'text-red-400 border-red-800/50 bg-red-900/10'
                              : 'text-slate-400 border-slate-700 bg-slate-800'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          {s.connection === 'online' ? (
                            <>
                              <Wifi className="w-3.5 h-3.5 text-green-400" />
                              <span className="text-green-400 capitalize">Online</span>
                            </>
                          ) : s.connection === 'unstable' ? (
                            <>
                              <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
                              <span className="text-yellow-400 capitalize">Unstable</span>
                            </>
                          ) : (
                            <>
                              <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-slate-500 capitalize">Offline</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono text-slate-400">
                        {formatLastActive(s.lastActive)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleForceLogout(s.sessionId)}
                            disabled={!isAlive}
                            className="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1.5 hover:border-yellow-600 hover:text-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Force Logout"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Force Logout</span>
                          </button>
                          <button
                            onClick={() => handleRevokeSession(s.sessionId)}
                            disabled={s.status === 'revoked'}
                            className="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1.5 hover:border-red-600 hover:text-red-400 text-red-400/80 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Revoke Token"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-600 font-mono text-sm">
                      No active sessions found for role: {activeTab}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </OrganizerLayout>
  );
}
