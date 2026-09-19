import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, ArrowRight, CheckCircle2, Clock, Scale } from 'lucide-react';
import JudgeLayout from '../../components/layout/JudgeLayout';
import { useAuth } from '../../context/AuthContext';
import { useCompetition } from '../../context/CompetitionContext';
import { db } from '../../firebase/config';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { DEFAULT_ACTIVE_JUDGES } from '../../services/judge-assignment';

interface TeamEvaluationCardData {
  teamId: string;
  teamName: string;
  predictScore: number;
  debugStatus: 'SUBMITTED' | 'PENDING';
  codeStatus: 'SUBMITTED' | 'PENDING';
  evaluationStatus: 'EVALUATED' | 'IN_PROGRESS' | 'PENDING';
  evaluatedScore?: {
    debug: number | null;
    code: number | null;
    final: number;
  };
}

export default function AssignedTeams() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getTeamEvaluation } = useCompetition();

  const judgeId = user?.judgeId || 'J001';
  const defaultJudge = DEFAULT_ACTIVE_JUDGES.find((j) => j.judgeId === judgeId) || DEFAULT_ACTIVE_JUDGES[0];

  const [judgeData, setJudgeData] = useState<{
    judgeId: string;
    name: string;
    assignedTeamIds: string[];
  }>({
    judgeId,
    name: defaultJudge.name,
    assignedTeamIds: defaultJudge.assignedTeamIds || [],
  });

  const [teamsMap, setTeamsMap] = useState<Map<string, { teamId: string; teamName: string }>>(new Map());

  // 1. Subscribe to real-time /judges/{judgeId} doc
  useEffect(() => {
    const judgeRef = doc(db, 'judges', judgeId);
    const unsub = onSnapshot(
      judgeRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          setJudgeData({
            judgeId: d.judgeId || judgeId,
            name: d.name || defaultJudge.name,
            assignedTeamIds: Array.isArray(d.assignedTeamIds) ? d.assignedTeamIds : [],
          });
        }
      },
      (err) => {
        console.warn('[AssignedTeams] Judge doc subscription error:', err);
      }
    );
    return () => unsub();
  }, [judgeId, defaultJudge.name]);

  // 2. Subscribe to /teams to get team names
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'teams'),
      (snapshot) => {
        const nextMap = new Map<string, { teamId: string; teamName: string }>();
        snapshot.docs.forEach((docSnap) => {
          const d = docSnap.data();
          nextMap.set(docSnap.id, {
            teamId: d.teamId || docSnap.id,
            teamName: d.teamName || `Team ${docSnap.id}`,
          });
        });
        setTeamsMap(nextMap);
      },
      (err) => {
        console.warn('[AssignedTeams] Teams subscription error:', err);
      }
    );
    return () => unsub();
  }, []);

  const assignedIds = judgeData.assignedTeamIds;

  const getTeamCardData = (teamId: string): TeamEvaluationCardData => {
    const team = teamsMap.get(teamId);
    const evalData = getTeamEvaluation(teamId);

    const hasDebug = evalData.debugMarks !== null;
    const hasCode = evalData.codeMarks !== null;

    let evalStatus: TeamEvaluationCardData['evaluationStatus'] = 'PENDING';
    if (hasDebug && hasCode) evalStatus = 'EVALUATED';
    else if (hasDebug || hasCode) evalStatus = 'IN_PROGRESS';

    return {
      teamId,
      teamName: team ? team.teamName : `Team ${teamId}`,
      predictScore: evalData.predictScore,
      debugStatus: hasDebug ? 'SUBMITTED' : 'PENDING',
      codeStatus: hasCode ? 'SUBMITTED' : 'PENDING',
      evaluationStatus: evalStatus,
      evaluatedScore: {
        debug: evalData.debugMarks,
        code: evalData.codeMarks,
        final: evalData.finalScore,
      },
    };
  };

  const assignedCards = assignedIds.map(getTeamCardData);
  const totalAssigned = assignedCards.length;
  const totalEvaluated = assignedCards.filter((c) => c.evaluationStatus === 'EVALUATED').length;
  const totalPending = totalAssigned - totalEvaluated;

  return (
    <JudgeLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-white font-black text-2xl tracking-wide flex items-center gap-3">
              <Users className="w-6 h-6 text-emerald-400" />
              MY ASSIGNED TEAMS
            </h1>
            <p className="text-slate-500 text-sm font-mono mt-1">
              Teams allocated to <span className="text-emerald-400 font-semibold">{judgeData.name} ({judgeData.judgeId})</span> for Round 2 evaluation
            </p>
          </div>
          <div className="flex items-center gap-4 bg-dark-800 border border-dark-700 px-4 py-2 rounded-xl font-mono text-xs">
            <div>
              <span className="text-slate-500 uppercase block">Total</span>
              <span className="text-white font-bold text-sm">{totalAssigned}</span>
            </div>
            <div className="h-6 w-px bg-dark-600" />
            <div>
              <span className="text-slate-500 uppercase block">Evaluated</span>
              <span className="text-emerald-400 font-bold text-sm">{totalEvaluated}</span>
            </div>
            <div className="h-6 w-px bg-dark-600" />
            <div>
              <span className="text-slate-500 uppercase block">Pending</span>
              <span className="text-yellow-400 font-bold text-sm">{totalPending}</span>
            </div>
          </div>
        </div>

        {/* Assigned Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {assignedCards.map((card) => (
            <div
              key={card.teamId}
              className="card-dark p-6 border border-dark-700 rounded-xl space-y-5 hover:border-emerald-700/50 transition-colors"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-mono font-bold text-cyan-400">{card.teamId}</span>
                    <span className="text-slate-600">·</span>
                    <h2 className="text-white font-bold text-lg">{card.teamName}</h2>
                  </div>
                  <p className="text-slate-500 text-xs font-mono">Round 2 Qualified Team</p>
                </div>
                <div>
                  {card.evaluationStatus === 'EVALUATED' ? (
                    <span className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-950/30 border border-emerald-500/40 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> EVALUATED
                    </span>
                  ) : card.evaluationStatus === 'IN_PROGRESS' ? (
                    <span className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-yellow-950/30 border border-yellow-500/40 text-yellow-400">
                      <Clock className="w-3.5 h-3.5" /> PARTIALLY EVALUATED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                      <Clock className="w-3.5 h-3.5" /> PENDING EVALUATION
                    </span>
                  )}
                </div>
              </div>

              {/* Status Metrics */}
              <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                <div className="bg-dark-900/80 p-3 rounded-lg border border-dark-700">
                  <span className="text-slate-500 block uppercase text-[10px]">Strike 1 (Predict)</span>
                  <span className="text-cyan-300 font-bold text-sm mt-0.5 block">
                    {card.predictScore} / 30
                  </span>
                  <span className="text-[10px] text-slate-600 block mt-0.5">AUTO-CALCULATED</span>
                </div>
                <div className="bg-dark-900/80 p-3 rounded-lg border border-dark-700">
                  <span className="text-slate-500 block uppercase text-[10px]">Strike 2 (Debug)</span>
                  <span className="text-indigo-400 font-bold text-sm mt-0.5 block">
                    {card.evaluatedScore?.debug !== null ? `${card.evaluatedScore?.debug} / 60` : 'PENDING'}
                  </span>
                  <span className="text-[10px] text-slate-600 block mt-0.5">
                    {card.evaluatedScore?.debug !== null ? 'Score Saved' : 'Needs Review'}
                  </span>
                </div>
                <div className="bg-dark-900/80 p-3 rounded-lg border border-dark-700">
                  <span className="text-slate-500 block uppercase text-[10px]">Strike 3 (Code)</span>
                  <span className="text-purple-400 font-bold text-sm mt-0.5 block">
                    {card.evaluatedScore?.code !== null ? `${card.evaluatedScore?.code} / 60` : 'PENDING'}
                  </span>
                  <span className="text-[10px] text-slate-600 block mt-0.5">
                    {card.evaluatedScore?.code !== null ? 'Score Saved' : 'Needs Review'}
                  </span>
                </div>
              </div>

              {/* Evaluated Score Banner if scores exist */}
              {(card.evaluatedScore?.debug !== null || card.evaluatedScore?.code !== null) && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300">
                    Debug:{' '}
                    <strong className="text-emerald-400">
                      {card.evaluatedScore?.debug !== null ? `${card.evaluatedScore?.debug}/60` : '—'}
                    </strong>{' '}
                    · Code:{' '}
                    <strong className="text-emerald-400">
                      {card.evaluatedScore?.code !== null ? `${card.evaluatedScore?.code}/60` : '—'}
                    </strong>
                  </span>
                  <span className="text-white font-bold">
                    Total:{' '}
                    <strong className="text-cyan-400 text-sm">
                      {card.evaluatedScore?.final}/150
                    </strong>
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-dark-700/60">
                <button
                  onClick={() => navigate(`/judge/team/${card.teamId}`)}
                  className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)] text-white font-bold"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Review & Score Submissions</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => navigate(`/judge/evaluate/${card.teamId}`)}
                  className="btn-ghost text-xs py-2 px-3.5 flex items-center gap-1.5"
                >
                  <Scale className="w-3.5 h-3.5 text-slate-400" />
                  <span>Evaluation Summary</span>
                </button>
              </div>
            </div>
          ))}

          {assignedCards.length === 0 && (
            <div className="col-span-2 text-center py-12 card-dark">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-white font-bold text-base">No Teams Currently Assigned</h3>
              <p className="text-slate-500 text-xs font-mono mt-1">
                The competition administrator has not allocated any teams to your ID yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </JudgeLayout>
  );
}
