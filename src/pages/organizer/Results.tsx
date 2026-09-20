import React, { useState } from 'react';
import {
  Trophy,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Medal,
  ChevronDown,
  ChevronUp,
  Timer,
  Zap,
  History,
} from 'lucide-react';
import OrganizerLayout from '../../components/layout/OrganizerLayout';
import { useCompetition } from '../../context/CompetitionContext';
import type { EvaluationStatus } from '../../types/results';

export default function Results() {
  const { results, auditLogs } = useCompetition();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EvaluationStatus>('ALL');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleExportCSV = () => {
    // Generate valid CSV with scores and timing tie-breakers
    const headers = [
      'Rank',
      'Team ID',
      'Team Name',
      'Predict (/30)',
      'Debug (/60)',
      'Code (/60)',
      'Debug+Code (/120)',
      'Final Score (/150)',
      'Status',
      'Strike 1 Completed',
      'Strike 2 Completed',
      'Strike 3 Completed',
      'Final Submission Time',
      'Total Elapsed Seconds',
      'Tie Breaker Applied',
    ];

    const rows = results.map((r) => [
      r.rank !== null ? r.rank : 'UNRANKED',
      r.teamId,
      `"${r.teamName.replace(/"/g, '""')}"`,
      r.predictScore !== null ? r.predictScore : '—',
      r.debugMarks !== null ? r.debugMarks : '—',
      r.codeMarks !== null ? r.codeMarks : '—',
      r.debugCodeTotal !== null ? r.debugCodeTotal : '—',
      r.finalScore !== null ? r.finalScore : '—',
      r.evaluationStatus.toUpperCase(),
      r.timing?.strike1CompletedAt ? new Date(r.timing.strike1CompletedAt).toISOString() : '—',
      r.timing?.strike2CompletedAt ? new Date(r.timing.strike2CompletedAt).toISOString() : '—',
      r.timing?.strike3CompletedAt ? new Date(r.timing.strike3CompletedAt).toISOString() : '—',
      r.timing?.finalSubmittedAt ? new Date(r.timing.finalSubmittedAt).toISOString() : '—',
      r.timing?.totalElapsedSeconds ?? '—',
      r.tieBreakerApplied ? 'YES' : 'NO',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `code_relay_round2_leaderboard_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported official competition CSV with tie-breaker metadata.');
  };

  const filtered = results.filter((r) => {
    const matchesSearch =
      r.teamId.toLowerCase().includes(search.toLowerCase()) ||
      r.teamName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.evaluationStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getRankBadge = (rank: number | null) => {
    if (rank === null) {
      return (
        <span className="text-slate-500 font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-dark-800 border border-dark-700 tracking-wider">
          UNRANKED
        </span>
      );
    }
    if (rank === 1) {
      return (
        <span className="flex items-center gap-1 font-black text-yellow-400 font-mono text-base">
          <Medal className="w-4 h-4 text-yellow-400" /> #1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex items-center gap-1 font-bold text-slate-300 font-mono text-base">
          <Medal className="w-4 h-4 text-slate-300" /> #2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex items-center gap-1 font-bold text-amber-600 font-mono text-base">
          <Medal className="w-4 h-4 text-amber-600" /> #3
        </span>
      );
    }
    return <span className="font-mono text-slate-500 font-semibold pl-1">#{rank}</span>;
  };

  const getStatusBadge = (status: EvaluationStatus) => {
    switch (status) {
      case 'evaluated':
        return (
          <span className="flex items-center gap-1 text-xs font-mono px-2.5 py-0.5 rounded-full border text-emerald-400 border-emerald-800/40 bg-emerald-950/20 font-semibold">
            <CheckCircle2 className="w-3 h-3" /> EVALUATED
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex items-center gap-1 text-xs font-mono px-2.5 py-0.5 rounded-full border text-yellow-400 border-yellow-800/40 bg-yellow-950/20 font-semibold animate-pulse">
            <Clock className="w-3 h-3" /> PARTIALLY EVALUATED
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-xs font-mono px-2.5 py-0.5 rounded-full border text-slate-400 border-dark-600 bg-dark-800 font-semibold">
            <AlertCircle className="w-3 h-3" /> EVALUATION PENDING
          </span>
        );
    }
  };

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '—';
    }
  };

  return (
    <OrganizerLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-900/90 border border-emerald-500/50 text-emerald-200 px-5 py-3 rounded-xl text-sm font-mono shadow-2xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{toast}</span>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-white font-black text-2xl tracking-wide flex items-center gap-3">
                <Trophy className="w-6 h-6 text-yellow-400" />
                LIVE LEADERBOARD & RANKINGS
              </h1>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                REAL-TIME PROVISIONAL
              </span>
            </div>
            <p className="text-slate-500 text-sm font-mono">
              Deterministic Ranking: <strong className="text-slate-300">Final Score (/150)</strong> → Tie-breaker:{' '}
              <strong className="text-cyan-400">Earlier Valid Submission Time</strong> (No mark deductions)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAuditModal(true)}
              className="btn-ghost flex items-center gap-2 text-xs py-2 px-3.5"
            >
              <History className="w-4 h-4 text-slate-400" />
              <span>Judging Audit Trail ({auditLogs.length})</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="btn-primary flex items-center gap-2 text-xs py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 font-bold"
            >
              <Download className="w-4 h-4" />
              <span>EXPORT OFFICIAL CSV</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team ID or name..."
              className="w-full pl-9 pr-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-slate-300 text-sm font-mono outline-none focus:border-cyan-600 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            {(['ALL', 'evaluated', 'in_progress', 'pending'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all border ${
                  statusFilter === filter
                    ? 'bg-indigo-600 border-indigo-500 text-white font-bold shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                    : 'bg-dark-800 border-dark-600 text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter === 'ALL'
                  ? `All Teams (${results.length})`
                  : filter === 'evaluated'
                  ? `Evaluated (${results.filter((r) => r.evaluationStatus === 'evaluated').length})`
                  : filter === 'in_progress'
                  ? `Partial (${results.filter((r) => r.evaluationStatus === 'in_progress').length})`
                  : `Pending (${results.filter((r) => r.evaluationStatus === 'pending').length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Results Table with Tie-Break details */}
        <div className="card-dark overflow-hidden border border-dark-700 rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700 text-slate-500 font-mono text-xs uppercase tracking-wider bg-dark-900/80">
                  <th className="text-left px-5 py-3.5">Rank</th>
                  <th className="text-left px-4 py-3.5">Team ID</th>
                  <th className="text-left px-4 py-3.5">Team Name</th>
                  <th className="text-right px-4 py-3.5">Predict (/30)</th>
                  <th className="text-right px-4 py-3.5">Debug (/60)</th>
                  <th className="text-right px-4 py-3.5">Code (/60)</th>
                  <th className="text-right px-4 py-3.5">Debug + Code (/120)</th>
                  <th className="text-right px-4 py-3.5">Final Score (/150)</th>
                  <th className="text-center px-4 py-3.5">Final Submission Time</th>
                  <th className="text-center px-4 py-3.5">Evaluation Status</th>
                  <th className="text-center px-3 py-3.5">Timing Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {filtered.map((row) => {
                  const isExpanded = expandedTeamId === row.teamId;
                  return (
                    <React.Fragment key={row.teamId}>
                      <tr
                        className={`hover:bg-dark-800/60 transition-colors ${
                          row.rank === 1 ? 'bg-yellow-950/10' : row.rank === 2 ? 'bg-slate-900/20' : ''
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            {getRankBadge(row.rank)}
                            {row.tieBreakerApplied && (
                              <span
                                title="Rank determined by earlier submission time tie-breaker"
                                className="text-[10px] font-mono text-cyan-400 bg-cyan-950/50 border border-cyan-500/40 px-1 rounded"
                              >
                                TB
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono font-bold text-cyan-400">{row.teamId}</td>
                        <td className="px-4 py-4 text-white font-semibold">{row.teamName}</td>
                        <td className="px-4 py-4 text-right font-mono">
                          {row.predictScore !== null ? (
                            <span className="text-slate-200 font-bold">{row.predictScore}</span>
                          ) : (
                            <span className="text-slate-500 font-mono font-bold">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-mono">
                          {row.debugMarks !== null ? (
                            <span className="text-indigo-300 font-bold">{row.debugMarks}</span>
                          ) : (
                            <span className="text-slate-500 font-mono font-bold">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-mono">
                          {row.codeMarks !== null ? (
                            <span className="text-purple-300 font-bold">{row.codeMarks}</span>
                          ) : (
                            <span className="text-slate-500 font-mono font-bold">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-semibold">
                          {row.debugCodeTotal !== null ? (
                            <span className="text-cyan-300">{row.debugCodeTotal}</span>
                          ) : (
                            <span className="text-slate-500 font-mono font-bold">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-black text-lg text-white">
                          {row.finalScore !== null ? (
                            <span className="text-glow-cyan text-cyan-400">{row.finalScore}</span>
                          ) : (
                            <span className="text-slate-500 font-mono font-bold text-base">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center font-mono text-xs text-slate-400">
                          <span className="flex items-center justify-center gap-1">
                            {row.timing?.finalSubmittedAt ? (
                              <>
                                <Timer className="w-3.5 h-3.5 text-slate-500" />
                                {formatTimestamp(row.timing.finalSubmittedAt)}
                              </>
                            ) : (
                              <span className="text-slate-500 font-mono font-bold">—</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center">{getStatusBadge(row.evaluationStatus)}</div>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <button
                            onClick={() => setExpandedTeamId(isExpanded ? null : row.teamId)}
                            className="p-1.5 text-slate-400 hover:text-white transition-colors rounded hover:bg-dark-700"
                            title="Toggle Timing Details"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Strike Timing Breakdown */}
                      {isExpanded && (
                        <tr className="bg-dark-900/90 border-y border-dark-700">
                          <td colSpan={11} className="p-4 px-6">
                            <div className="flex items-center justify-between flex-wrap gap-4 text-xs font-mono">
                              <div className="flex items-center gap-6">
                                <div className="space-y-0.5">
                                  <span className="text-slate-500 uppercase block text-[10px]">
                                    Strike 1 (Predict) Completed
                                  </span>
                                  <span className="text-cyan-400 font-bold">
                                    {formatTimestamp(row.timing?.strike1CompletedAt)}
                                  </span>
                                </div>

                                <div className="space-y-0.5">
                                  <span className="text-slate-500 uppercase block text-[10px]">
                                    Strike 2 (Debug) Completed
                                  </span>
                                  <span className="text-indigo-400 font-bold">
                                    {formatTimestamp(row.timing?.strike2CompletedAt)}
                                  </span>
                                </div>

                                <div className="space-y-0.5">
                                  <span className="text-slate-500 uppercase block text-[10px]">
                                    Strike 3 (Code) Completed
                                  </span>
                                  <span className="text-purple-400 font-bold">
                                    {formatTimestamp(row.timing?.strike3CompletedAt)}
                                  </span>
                                </div>

                                <div className="space-y-0.5">
                                  <span className="text-slate-500 uppercase block text-[10px]">
                                    Total Elapsed Time
                                  </span>
                                  <span className="text-white font-bold">
                                    {row.timing?.totalElapsedSeconds
                                      ? `${Math.floor(row.timing.totalElapsedSeconds / 60)}m ${
                                          row.timing.totalElapsedSeconds % 60
                                        }s`
                                      : '—'}
                                  </span>
                                </div>
                              </div>

                              <div className="text-[11px] text-slate-500 bg-dark-950 p-2 rounded border border-dark-700">
                                <Zap className="w-3.5 h-3.5 text-yellow-400 inline mr-1" />
                                {row.tieBreakerApplied
                                  ? 'Tied on points: rank established by earlier final submission time.'
                                  : 'Rank determined purely by Final Score.'}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-slate-600 font-mono text-sm">
                      No results found matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Evaluation Audit Trail Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-dark-900 border border-dark-600 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-dark-700 pb-3">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                Judge Evaluation Audit Log
              </h2>
              <button
                onClick={() => setShowAuditModal(false)}
                className="btn-ghost text-xs py-1 px-2"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {auditLogs.map((log) => (
                <div
                  key={log.auditId}
                  className="bg-dark-950 p-3.5 rounded-xl border border-dark-700 space-y-1 text-xs font-mono"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-cyan-400 font-bold">{log.teamId}</span>
                    <span>Judge: {log.judgeId}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center gap-4 pt-1 text-slate-300">
                    <span>
                      Debug: {log.previousDebugMarks ?? '—'} →{' '}
                      <strong className="text-indigo-400">{log.newDebugMarks ?? '—'}</strong>
                    </span>
                    <span>
                      Code: {log.previousCodeMarks ?? '—'} →{' '}
                      <strong className="text-purple-400">{log.newCodeMarks ?? '—'}</strong>
                    </span>
                    <span className="ml-auto text-white font-bold">
                      Final: {log.finalScore} / 150
                    </span>
                  </div>
                  {log.note && <p className="text-[11px] text-slate-500 italic mt-1">{log.note}</p>}
                </div>
              ))}

              {auditLogs.length === 0 && (
                <p className="text-center py-8 text-slate-600 font-mono text-sm">
                  No judge scoring updates recorded in this session yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </OrganizerLayout>
  );
}
