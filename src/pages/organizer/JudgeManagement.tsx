import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Users,
  Search,
  RefreshCw,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import OrganizerLayout from '../../components/layout/OrganizerLayout';
import { db } from '../../firebase/config';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import type { Judge } from '../../types/judge';
import {
  DEFAULT_ACTIVE_JUDGES,
  syncJudgeAssignmentsToFirestore,
} from '../../services/judge-assignment';

const DEFAULT_JUDGES: Judge[] = DEFAULT_ACTIVE_JUDGES.map((j) => ({
  judgeId: j.judgeId,
  name: j.name,
  email: j.email || `${j.judgeId.toLowerCase()}@coderelay.com`,
  active: j.active !== false,
  assignedTeamIds: j.assignedTeamIds || [],
  pendingCount: j.pendingCount || 0,
  evaluatedCount: j.evaluatedCount || 0,
}));

export default function JudgeManagement() {
  const [judges, setJudges] = useState<Judge[]>(DEFAULT_JUDGES);
  const [teams, setTeams] = useState<{ teamId: string; teamName: string; assignedJudgeId?: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ judgeId: '', name: '', email: '', password: '' });
  const [toast, setToast] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Subscribe to Firestore judges collection
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'judges'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: Judge[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              judgeId: d.judgeId || docSnap.id,
              name: d.name || `Judge ${docSnap.id}`,
              email: d.email || `${docSnap.id.toLowerCase()}@coderelay.com`,
              active: d.active !== false,
              assignedTeamIds: Array.isArray(d.assignedTeamIds) ? d.assignedTeamIds : [],
              pendingCount: d.pendingCount || 0,
              evaluatedCount: d.evaluatedCount || 0,
            };
          });
          // Sort by judgeId J001, J002...
          loaded.sort((a, b) => a.judgeId.localeCompare(b.judgeId));
          setJudges(loaded);
        } else {
          // Initialize with default 6 judges if Firestore is empty
          DEFAULT_ACTIVE_JUDGES.forEach(async (dj) => {
            await setDoc(doc(db, 'judges', dj.judgeId), dj, { merge: true });
          });
          setJudges(DEFAULT_JUDGES);
        }
      },
      (err) => {
        console.warn('[JudgeManagement] Judges subscription error:', err);
      }
    );

    return () => unsub();
  }, []);

  // 2. Subscribe to qualified teams
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'teams'),
      (snapshot) => {
        const loaded = snapshot.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              teamId: d.teamId || docSnap.id,
              teamName: d.teamName || `Team ${docSnap.id}`,
              assignedJudgeId: d.assignedJudgeId,
              status: d.status,
              round2Eligible: d.round2Eligible,
            };
          })
          .filter(
            (t) =>
              t.round2Eligible === true ||
              t.status === 'QUALIFIED_FOR_ROUND_2' ||
              t.status === 'READY' ||
              t.status === 'ACTIVE' ||
              t.status === 'COMPLETED'
          );
        setTeams(loaded);
      },
      (err) => {
        console.warn('[JudgeManagement] Teams subscription error:', err);
      }
    );

    return () => unsub();
  }, []);

  const toggleActive = async (judgeId: string) => {
    const judge = judges.find((j) => j.judgeId === judgeId);
    if (!judge) return;
    const nextActive = !judge.active;
    try {
      await setDoc(doc(db, 'judges', judgeId), { active: nextActive }, { merge: true });
      showToast(`Judge ${judgeId} is now ${nextActive ? 'Active' : 'Inactive'}.`);
    } catch (err: any) {
      showToast(`Error updating judge status: ${err.message}`);
    }
  };

  const handleAdd = async () => {
    if (!form.judgeId || !form.name) return;
    const normalizedJudgeId = form.judgeId.trim().toUpperCase();
    const newJudge: Judge = {
      judgeId: normalizedJudgeId,
      name: form.name.trim(),
      email: form.email.trim() || `${normalizedJudgeId.toLowerCase()}@coderelay.com`,
      active: true,
      assignedTeamIds: [],
      pendingCount: 0,
      evaluatedCount: 0,
    };

    try {
      await setDoc(doc(db, 'judges', normalizedJudgeId), newJudge, { merge: true });
      setShowModal(false);
      setForm({ judgeId: '', name: '', email: '', password: '' });
      showToast(`Judge ${normalizedJudgeId} created in Firestore.`);
    } catch (err: any) {
      showToast(`Failed to add judge: ${err.message}`);
    }
  };

  const handleDelete = async (judgeId: string) => {
    try {
      await deleteDoc(doc(db, 'judges', judgeId));
      setDeleteTarget(null);
      showToast(`Judge ${judgeId} removed.`);
    } catch (err: any) {
      showToast(`Failed to delete judge: ${err.message}`);
    }
  };

  const handleAutoAssign = async () => {
    if (teams.length === 0) {
      showToast('No qualified teams available to distribute.');
      return;
    }
    const activeJudges = judges.filter((j) => j.active);
    if (activeJudges.length === 0) {
      showToast('Error: No active judges configured.');
      return;
    }

    setIsAssigning(true);
    try {
      const assignments = await syncJudgeAssignmentsToFirestore(db, teams, judges);
      const summary = Object.entries(assignments)
        .map(([jId, tIds]) => `${jId}: ${tIds.length}`)
        .join(', ');
      showToast(`✓ Distributed ${teams.length} teams across ${activeJudges.length} judges (${summary})`);
    } catch (err: any) {
      showToast(`Assignment failed: ${err.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  // Filter judges / team search
  const normalizedQuery = searchQuery.trim().toUpperCase();
  const filteredJudges = useMemo(() => {
    if (!normalizedQuery) return judges;
    return judges.filter((judge) => {
      const matchesJudge =
        judge.judgeId.includes(normalizedQuery) ||
        judge.name.toUpperCase().includes(normalizedQuery);
      const matchesAssignedTeam = judge.assignedTeamIds.some((id) =>
        id.toUpperCase().includes(normalizedQuery)
      );
      return matchesJudge || matchesAssignedTeam;
    });
  }, [judges, normalizedQuery]);

  // Which judge owns the searched team?
  const searchMatchJudge = useMemo(() => {
    if (!normalizedQuery || !normalizedQuery.startsWith('CRL-')) return null;
    return judges.find((j) =>
      j.assignedTeamIds.some((id) => id.toUpperCase() === normalizedQuery)
    );
  }, [judges, normalizedQuery]);

  return (
    <OrganizerLayout>
      <div className="space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-green-900/90 border border-green-500/50 text-green-300 px-5 py-3 rounded-xl text-sm font-mono shadow-2xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            {toast}
          </div>
        )}

        {/* Top Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-white font-black text-2xl tracking-wide flex items-center gap-3">
              <Shield className="w-6 h-6 text-cyan-400" />
              JUDGE MANAGEMENT & TEAM ALLOCATION
            </h1>
            <p className="text-slate-500 text-sm font-mono mt-1">
              {judges.filter((j) => j.active).length} active judges · {teams.length} qualified teams
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAutoAssign}
              disabled={isAssigning || teams.length === 0}
              className="btn-primary flex items-center gap-2 text-sm bg-cyan-600 hover:bg-cyan-500 border border-cyan-400/30"
              title="Evenly distribute all qualified teams across active judges"
            >
              <RefreshCw className={`w-4 h-4 ${isAssigning ? 'animate-spin' : ''}`} />
              {isAssigning ? 'Assigning...' : 'Auto-Assign All Teams'}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="btn-ghost flex items-center gap-2 text-sm border border-dark-600"
            >
              <Plus className="w-4 h-4" /> Add Judge
            </button>
          </div>
        </div>

        {/* Search & Team Lookup Banner */}
        <div className="card-dark p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search by Team ID (e.g. CRL-0011) or Judge Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="btn-ghost text-xs px-3 py-2 text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {searchMatchJudge && (
            <div className="p-3 bg-cyan-950/40 border border-cyan-500/40 rounded-lg flex items-center justify-between text-xs font-mono text-cyan-300">
              <span>
                ✓ <strong>{normalizedQuery}</strong> is assigned to{' '}
                <strong className="text-white">{searchMatchJudge.judgeId}</strong> ({searchMatchJudge.name})
              </span>
              <span className="text-slate-400">Total assigned: {searchMatchJudge.assignedTeamIds.length} teams</span>
            </div>
          )}
        </div>

        {/* Judges & Assigned Teams Table */}
        <div className="card-dark overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-slate-500 font-mono text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 whitespace-nowrap">Judge ID</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Name</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Email</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Assigned Teams</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJudges.map((judge) => {
                  const isHighlighted = searchMatchJudge?.judgeId === judge.judgeId;
                  return (
                    <tr
                      key={judge.judgeId}
                      className={`border-b border-dark-700/50 transition-colors ${
                        isHighlighted
                          ? 'bg-cyan-950/30 border-cyan-500/50'
                          : 'hover:bg-dark-800/50'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-cyan-400">
                        {judge.judgeId}
                      </td>
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                        {judge.name}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                        {judge.email}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(judge.judgeId)}
                          className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border transition-colors ${
                            judge.active
                              ? 'text-green-400 border-green-800/50 bg-green-900/10 hover:bg-green-900/20'
                              : 'text-slate-500 border-dark-600 bg-dark-700 hover:bg-dark-600'
                          }`}
                        >
                          {judge.active ? (
                            <ToggleRight className="w-3.5 h-3.5" />
                          ) : (
                            <ToggleLeft className="w-3.5 h-3.5" />
                          )}
                          {judge.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="font-mono font-bold text-white text-xs">
                              {judge.assignedTeamIds.length} teams
                            </span>
                          </div>
                          {judge.assignedTeamIds.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xl max-h-24 overflow-y-auto pr-1">
                              {judge.assignedTeamIds.map((tId) => {
                                const isTargetMatch =
                                  normalizedQuery && tId.toUpperCase().includes(normalizedQuery);
                                return (
                                  <span
                                    key={tId}
                                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                      isTargetMatch
                                        ? 'bg-cyan-500 text-black font-bold border-cyan-400'
                                        : 'bg-dark-800 border-dark-600 text-slate-300'
                                    }`}
                                  >
                                    {tId}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs font-mono italic">
                              No teams assigned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeleteTarget(judge.judgeId)}
                          className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete Judge"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredJudges.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-600 font-mono">
                      No judges matching search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Judge Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-white font-bold text-lg">Add Judge</h2>
            {[
              ['Judge ID (e.g. J007)', 'judgeId'],
              ['Name', 'name'],
              ['Email', 'email'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1 block">
                  {label}
                </label>
                <input
                  type="text"
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-300 text-sm font-mono outline-none focus:border-cyan-600 transition-colors"
                />
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-ghost">
                Cancel
              </button>
              <button onClick={handleAdd} className="btn-primary">
                Add Judge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 border border-red-800/50 rounded-xl w-full max-w-sm p-6 space-y-4 text-center">
            <p className="text-white font-bold">
              Remove judge <span className="text-red-400">{deleteTarget}</span>?
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteTarget)} className="btn-danger">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </OrganizerLayout>
  );
}
