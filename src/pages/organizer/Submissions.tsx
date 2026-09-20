// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Organizer Submissions — Live Round 2 Submission Monitor
// Authoritative, table-based, real-time Firestore pipeline
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck2,
  Search,
  Users,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
  Eye,
  Scale,
  Code,
  Zap,
} from 'lucide-react';
import OrganizerLayout from '../../components/layout/OrganizerLayout';
import { db } from '../../firebase/config';
import {
  collection,
  onSnapshot,
  doc,
  getDocs,
} from 'firebase/firestore';
import type { Submission } from '../../types/competition';
import type { FirestoreResultDoc } from '../../firebase/schema';
import {
  buildSubmissionSummaries,
  syncSubmissionsToResultsDoc,
  type TeamSubmissionSummary,
} from '../../services/submission-monitor';

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

export default function Submissions() {
  const [teams, setTeams] = useState<
    { teamId: string; teamName: string; assignedJudgeId?: string; round2Eligible?: boolean; status?: string }[]
  >([]);
  const [judges, setJudges] = useState<{ judgeId: string; name: string; active?: boolean }[]>([]);
  const [resultsMap, setResultsMap] = useState<Map<string, FirestoreResultDoc>>(new Map());
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [strikeFilter, setStrikeFilter] = useState<'all' | 'strike1' | 'strike2' | 'strike3' | 'submitted' | 'not_submitted'>('all');
  const [judgeFilter, setJudgeFilter] = useState<string>('all');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // 1. Subscribe to /teams (all qualified Round 2 teams)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'teams'),
      (snapshot) => {
        const loaded = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            teamId: data.teamId || d.id,
            teamName: data.teamName || `Team ${d.id}`,
            assignedJudgeId: data.assignedJudgeId || undefined,
            round2Eligible: data.round2Eligible,
            status: data.status,
          };
        });
        setTeams(loaded);
        setIsLoading(false);
      },
      (err) => {
        console.warn('[SubmissionsMonitor] Teams subscription notice:', err.message);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Subscribe to /judges
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'judges'),
      (snapshot) => {
        const loaded = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            judgeId: data.judgeId || d.id,
            name: data.name || `Judge ${d.id}`,
            active: data.active !== false,
          };
        });
        setJudges(loaded);
      },
      (err) => {
        console.warn('[SubmissionsMonitor] Judges subscription notice:', err.message);
      }
    );
    return () => unsub();
  }, []);

  // 3. Subscribe to /results
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'results'),
      (snapshot) => {
        const map = new Map<string, FirestoreResultDoc>();
        snapshot.docs.forEach((d) => {
          map.set(d.id, d.data() as FirestoreResultDoc);
        });
        setResultsMap(map);
      },
      (err) => {
        console.warn('[SubmissionsMonitor] Results subscription notice:', err.message);
      }
    );
    return () => unsub();
  }, []);

  // 4. Subscribe to /submissions (authoritative participant submissions)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'submissions'),
      (snapshot) => {
        const loaded: Submission[] = snapshot.docs.map((d) => {
          const data = d.data();
          let submittedAtIso = '';
          if (data.submittedAt?.toDate) {
            submittedAtIso = data.submittedAt.toDate().toISOString();
          } else if (typeof data.submittedAt === 'string') {
            submittedAtIso = data.submittedAt;
          } else if (data.clientSubmittedAt) {
            submittedAtIso = data.clientSubmittedAt;
          } else {
            submittedAtIso = new Date().toISOString();
          }

          return {
            questionId: data.questionId || '',
            teamId: data.teamId || '',
            strikeId: data.strikeId || 'strike1',
            answer: data.answer || '',
            submittedAt: submittedAtIso,
            status: data.status || 'submitted',
            isCarriedForward: data.isCarriedForward,
          };
        });
        setSubmissions(loaded);
      },
      (err) => {
        console.warn('[SubmissionsMonitor] Submissions subscription notice:', err.message);
      }
    );
    return () => unsub();
  }, []);

  // Build authoritative team summaries
  const judgesMap = useMemo(() => {
    const m = new Map<string, { judgeId: string; name: string }>();
    judges.forEach((j) => m.set(j.judgeId, j));
    return m;
  }, [judges]);

  const summaries: TeamSubmissionSummary[] = useMemo(() => {
    return buildSubmissionSummaries(teams, submissions, resultsMap, judgesMap);
  }, [teams, submissions, resultsMap, judgesMap]);

  // Auto-synchronize missing Predict scores and timings to /results
  useEffect(() => {
    if (summaries.length === 0) return;
    summaries.forEach(async (sum) => {
      const existing = resultsMap.get(sum.teamId);
      await syncSubmissionsToResultsDoc(db, sum, existing);
    });
  }, [summaries, resultsMap]);

  // Derived Dynamic Counters
  const counters = useMemo(() => {
    const total = summaries.length;
    let submittedCount = 0;
    let strike1Count = 0;
    let strike2Count = 0;
    let strike3Count = 0;

    summaries.forEach((s) => {
      if (s.strike1Submitted || s.strike2Submitted || s.strike3Submitted) {
        submittedCount++;
      }
      if (s.strike1Submitted) strike1Count++;
      if (s.strike2Submitted) strike2Count++;
      if (s.strike3Submitted) strike3Count++;
    });

    return {
      total,
      submitted: submittedCount,
      notSubmitted: Math.max(0, total - submittedCount),
      strike1: strike1Count,
      strike2: strike2Count,
      strike3: strike3Count,
    };
  }, [summaries]);

  // Active Judges for dynamic filter dropdown
  const activeJudgesList = useMemo(() => {
    return judges.filter((j) => j.active !== false).sort((a, b) => a.judgeId.localeCompare(b.judgeId));
  }, [judges]);

  // Filtered & Searched summaries
  const filteredSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return summaries.filter((team) => {
      // 1. Search Query (Team ID or Team Name)
      if (q) {
        const matchesId = team.teamId.toLowerCase().includes(q);
        const matchesName = team.teamName.toLowerCase().includes(q);
        if (!matchesId && !matchesName) return false;
      }

      // 2. Judge Filter
      if (judgeFilter !== 'all') {
        if (judgeFilter === 'UNASSIGNED') {
          if (team.assignedJudgeId !== 'UNASSIGNED') return false;
        } else if (team.assignedJudgeId !== judgeFilter) {
          return false;
        }
      }

      // 3. Strike Filter
      if (strikeFilter === 'strike1' && !team.strike1Submitted) return false;
      if (strikeFilter === 'strike2' && !team.strike2Submitted) return false;
      if (strikeFilter === 'strike3' && !team.strike3Submitted) return false;
      if (strikeFilter === 'submitted' && !team.strike1Submitted && !team.strike2Submitted && !team.strike3Submitted) {
        return false;
      }
      if (strikeFilter === 'not_submitted' && (team.strike1Submitted || team.strike2Submitted || team.strike3Submitted)) {
        return false;
      }

      return true;
    });
  }, [summaries, searchQuery, judgeFilter, strikeFilter]);

  const getStatusBadge = (status: TeamSubmissionSummary['status']) => {
    switch (status) {
      case 'ROUND 2 FINISHED':
        return (
          <span className="badge-submitted px-2.5 py-1 text-[11px] font-mono font-bold tracking-wider">
            ROUND 2 FINISHED
          </span>
        );
      case 'STRIKE 2 COMPLETE':
        return (
          <span className="bg-indigo-900/40 text-indigo-300 border border-indigo-500/40 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider">
            STRIKE 2 COMPLETE
          </span>
        );
      case 'STRIKE 1 COMPLETE':
        return (
          <span className="bg-cyan-900/40 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider">
            STRIKE 1 COMPLETE
          </span>
        );
      default:
        return (
          <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider">
            NOT STARTED
          </span>
        );
    }
  };

  return (
    <OrganizerLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FileCheck2 className="w-7 h-7 text-indigo-400" />
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                ROUND 2 SUBMISSION MONITOR
              </h1>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm font-mono">
              Authoritative live telemetry of participant submissions, strike completion times & judge assignments
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card-dark p-4 border border-dark-700 rounded-xl bg-dark-900/60">
            <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider block mb-1">
              Total Teams
            </span>
            <div className="text-2xl font-black font-mono text-white">{counters.total}</div>
          </div>

          <div className="card-dark p-4 border border-dark-700 rounded-xl bg-dark-900/60">
            <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider block mb-1">
              Submitted
            </span>
            <div className="text-2xl font-black font-mono text-emerald-400">{counters.submitted}</div>
          </div>

          <div className="card-dark p-4 border border-dark-700 rounded-xl bg-dark-900/60">
            <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider block mb-1">
              Not Submitted
            </span>
            <div className="text-2xl font-black font-mono text-slate-400">{counters.notSubmitted}</div>
          </div>

          <div className="card-dark p-4 border border-dark-700 rounded-xl bg-dark-900/60">
            <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider block mb-1">
              Strike 1 (Predict)
            </span>
            <div className="text-2xl font-black font-mono text-cyan-400">{counters.strike1}</div>
          </div>

          <div className="card-dark p-4 border border-dark-700 rounded-xl bg-dark-900/60">
            <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider block mb-1">
              Strike 2 (Debug)
            </span>
            <div className="text-2xl font-black font-mono text-indigo-400">{counters.strike2}</div>
          </div>

          <div className="card-dark p-4 border border-dark-700 rounded-xl bg-dark-900/60">
            <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider block mb-1">
              Strike 3 (Code)
            </span>
            <div className="text-2xl font-black font-mono text-purple-400">{counters.strike3}</div>
          </div>
        </div>

        {/* Search & Filters Controls */}
        <div className="card-dark p-4 border border-dark-700 rounded-xl bg-dark-900/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Prominent Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Team ID (e.g. CRL-0009) or Team Name..."
              className="w-full bg-dark-950 border border-dark-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Strike Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500">Strike:</span>
              <select
                value={strikeFilter}
                onChange={(e) => setStrikeFilter(e.target.value as any)}
                className="bg-dark-950 border border-dark-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
              >
                <option value="all">ALL STRIKES</option>
                <option value="strike1">Strike 1 (Predict)</option>
                <option value="strike2">Strike 2 (Debug)</option>
                <option value="strike3">Strike 3 (Code)</option>
                <option value="submitted">Submitted Any</option>
                <option value="not_submitted">Not Submitted</option>
              </select>
            </div>

            {/* Dynamic Judges Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500">Judge:</span>
              <select
                value={judgeFilter}
                onChange={(e) => setJudgeFilter(e.target.value)}
                className="bg-dark-950 border border-dark-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
              >
                <option value="all">ALL JUDGES</option>
                {activeJudgesList.map((j) => (
                  <option key={j.judgeId} value={j.judgeId}>
                    {j.judgeId} — {j.name}
                  </option>
                ))}
                <option value="UNASSIGNED">UNASSIGNED</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submission Monitor Table */}
        <div className="card-dark border border-dark-700 rounded-xl overflow-hidden bg-dark-900/60 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1050px]">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-800/80 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3.5">Team ID</th>
                  <th className="px-4 py-3.5">Team Name</th>
                  <th className="px-4 py-3.5">Judge</th>
                  <th className="px-4 py-3.5 text-center">Strike 1</th>
                  <th className="px-4 py-3.5 text-center">Strike 1 Time</th>
                  <th className="px-4 py-3.5 text-center">Strike 2</th>
                  <th className="px-4 py-3.5 text-center">Strike 2 Time</th>
                  <th className="px-4 py-3.5 text-center">Strike 3</th>
                  <th className="px-4 py-3.5 text-center">Strike 3 Time</th>
                  <th className="px-4 py-3.5 text-center">Last Submission</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-3 py-3.5 text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-12 text-center text-slate-500 font-mono">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                      Loading authoritative Round 2 submission telemetry...
                    </td>
                  </tr>
                ) : filteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-12 text-center text-slate-500 font-mono">
                      No matching teams or submissions found for query.
                    </td>
                  </tr>
                ) : (
                  filteredSummaries.map((row) => {
                    const isExpanded = expandedTeamId === row.teamId;

                    return (
                      <React.Fragment key={row.teamId}>
                        <tr
                          onClick={() => setExpandedTeamId(isExpanded ? null : row.teamId)}
                          className={`hover:bg-dark-800/60 transition-colors cursor-pointer ${
                            isExpanded ? 'bg-dark-800/40' : ''
                          }`}
                        >
                          {/* 1. Team ID */}
                          <td className="px-4 py-3.5 font-mono font-bold text-cyan-400">
                            {row.teamId}
                          </td>

                          {/* 2. Team Name */}
                          <td className="px-4 py-3.5 text-white font-medium max-w-[160px] truncate">
                            {row.teamName}
                          </td>

                          {/* 3. Judge */}
                          <td className="px-4 py-3.5 font-mono text-xs">
                            {row.assignedJudgeId === 'UNASSIGNED' ? (
                              <span className="text-red-400 font-bold bg-red-950/60 border border-red-800 px-2 py-0.5 rounded">
                                UNASSIGNED
                              </span>
                            ) : (
                              <span className="text-indigo-300 font-bold bg-indigo-950/50 border border-indigo-800/50 px-2 py-0.5 rounded" title={row.judgeName}>
                                {row.assignedJudgeId}
                              </span>
                            )}
                          </td>

                          {/* 4. Strike 1 (Predict) */}
                          <td className="px-4 py-3.5 text-center font-mono text-xs">
                            {row.strike1Submitted ? (
                              <div className="flex flex-col items-center">
                                <span className="text-cyan-300 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  {row.strike1Score !== null ? `${row.strike1Score} / 30` : 'SUBMITTED'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 font-bold">—</span>
                            )}
                          </td>

                          {/* 5. Strike 1 Time */}
                          <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-300">
                            {formatTimestamp(row.strike1CompletedAt)}
                          </td>

                          {/* 6. Strike 2 (Debug) */}
                          <td className="px-4 py-3.5 text-center font-mono text-xs">
                            {row.strike2Submitted ? (
                              <div className="flex flex-col items-center">
                                <span className="text-indigo-300 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  {row.strike2DebugMarks !== null
                                    ? `${row.strike2DebugMarks} / 60`
                                    : '— / 60'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 font-bold">—</span>
                            )}
                          </td>

                          {/* 7. Strike 2 Time */}
                          <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-300">
                            {formatTimestamp(row.strike2CompletedAt)}
                          </td>

                          {/* 8. Strike 3 (Code) */}
                          <td className="px-4 py-3.5 text-center font-mono text-xs">
                            {row.strike3Submitted ? (
                              <div className="flex flex-col items-center">
                                <span className="text-purple-300 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  {row.strike3CodeMarks !== null
                                    ? `${row.strike3CodeMarks} / 60`
                                    : '— / 60'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 font-bold">—</span>
                            )}
                          </td>

                          {/* 9. Strike 3 Time */}
                          <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-300">
                            {formatTimestamp(row.strike3CompletedAt)}
                          </td>

                          {/* 10. Last Submission (Participant) */}
                          <td className="px-4 py-3.5 text-center font-mono text-xs text-emerald-400 font-bold">
                            {formatTimestamp(row.lastSubmittedAt)}
                          </td>

                          {/* 11. Status */}
                          <td className="px-4 py-3.5 text-center">
                            {getStatusBadge(row.status)}
                          </td>

                          {/* 12. Toggle Details */}
                          <td className="px-3 py-3.5 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTeamId(isExpanded ? null : row.teamId);
                              }}
                              className="p-1 text-slate-400 hover:text-white rounded hover:bg-dark-700"
                              title="Inspect Full Audit Breakdown"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-indigo-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Audit Drawer */}
                        {isExpanded && (
                          <tr className="bg-dark-900/95 border-y border-dark-700">
                            <td colSpan={12} className="p-6">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-dark-700 pb-3 flex-wrap gap-2">
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-lg font-bold text-cyan-400">
                                      {row.teamId}
                                    </span>
                                    <span className="text-slate-600">·</span>
                                    <span className="text-white font-semibold text-base">
                                      {row.teamName}
                                    </span>
                                    <span className="text-xs font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-700/50 px-2.5 py-0.5 rounded">
                                      Judge: {row.assignedJudgeId} {row.judgeName ? `(${row.judgeName})` : ''}
                                    </span>
                                  </div>
                                  <div className="font-mono text-xs text-slate-400">
                                    Total Submissions Recorded:{' '}
                                    <span className="text-white font-bold">{row.submissions.length}</span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Strike 1 Details */}
                                  <div className="bg-dark-950/80 p-4 rounded-xl border border-dark-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-cyan-400 font-bold text-xs uppercase tracking-wider font-mono">
                                        STRIKE 1 — PREDICT
                                      </span>
                                      <span className="text-xs font-mono font-bold text-white">
                                        {row.strike1Score !== null ? `${row.strike1Score} / 30` : '—'}
                                      </span>
                                    </div>
                                    <div className="text-xs font-mono space-y-1 text-slate-400">
                                      <div>Status: <span className="text-white">{row.strike1Submitted ? 'COMPLETED' : 'NOT STARTED'}</span></div>
                                      <div>Submitted: <span className="text-slate-300">{formatTimestamp(row.strike1CompletedAt)}</span></div>
                                    </div>
                                  </div>

                                  {/* Strike 2 Details */}
                                  <div className="bg-dark-950/80 p-4 rounded-xl border border-dark-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-indigo-400 font-bold text-xs uppercase tracking-wider font-mono">
                                        STRIKE 2 — DEBUG
                                      </span>
                                      <span className="text-xs font-mono font-bold text-white">
                                        {row.strike2DebugMarks !== null ? `${row.strike2DebugMarks} / 60` : '— / 60'}
                                      </span>
                                    </div>
                                    <div className="text-xs font-mono space-y-1 text-slate-400">
                                      <div>Status: <span className="text-white">{row.strike2Submitted ? 'SUBMITTED' : 'NOT STARTED'}</span></div>
                                      <div>Participant Submitted: <span className="text-slate-300">{formatTimestamp(row.strike2CompletedAt)}</span></div>
                                      <div>Judge Evaluated: <span className="text-slate-300">{formatTimestamp(row.strike2EvaluatedAt)}</span></div>
                                    </div>
                                  </div>

                                  {/* Strike 3 Details */}
                                  <div className="bg-dark-950/80 p-4 rounded-xl border border-dark-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-purple-400 font-bold text-xs uppercase tracking-wider font-mono">
                                        STRIKE 3 — CODE
                                      </span>
                                      <span className="text-xs font-mono font-bold text-white">
                                        {row.strike3CodeMarks !== null ? `${row.strike3CodeMarks} / 60` : '— / 60'}
                                      </span>
                                    </div>
                                    <div className="text-xs font-mono space-y-1 text-slate-400">
                                      <div>Status: <span className="text-white">{row.strike3Submitted ? 'SUBMITTED' : 'NOT STARTED'}</span></div>
                                      <div>Participant Submitted: <span className="text-slate-300">{formatTimestamp(row.strike3CompletedAt)}</span></div>
                                      <div>Judge Evaluated: <span className="text-slate-300">{formatTimestamp(row.strike3EvaluatedAt)}</span></div>
                                    </div>
                                  </div>
                                </div>

                                {/* Summary Bar */}
                                <div className="p-3 bg-dark-950 rounded-lg border border-dark-800 flex items-center justify-between flex-wrap gap-4 text-xs font-mono">
                                  <div className="flex items-center gap-6">
                                    <div>
                                      <span className="text-slate-500 uppercase block text-[10px]">Accumulated Score</span>
                                      <span className="text-cyan-400 font-bold text-sm">
                                        {row.finalScore !== null ? `${row.finalScore} / 150` : '—'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500 uppercase block text-[10px]">Latest Participant Event</span>
                                      <span className="text-emerald-400 font-bold text-sm">
                                        {formatTimestamp(row.lastSubmittedAt)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-slate-500 text-[11px]">
                                    * Note: Access credentials strictly protected. Submission timestamps govern competition tie-break ordering.
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </OrganizerLayout>
  );
}
