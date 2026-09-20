import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Scale,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Code,
  Calculator,
  Check,
  Edit3,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import JudgeLayout from '../../components/layout/JudgeLayout';
import { useCompetition } from '../../context/CompetitionContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';

export default function Evaluation() {
  const { teamId = '' } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { getTeamEvaluation, updateTeamScores } = useCompetition();
  const { user } = useAuth();

  const [teamInfo, setTeamInfo] = useState<{
    teamId: string;
    teamName: string;
    members?: { name: string }[];
  }>(() => ({
    teamId: teamId || '',
    teamName: teamId ? `Team ${teamId}` : 'Team',
    members: [{ name: 'Member 1' }, { name: 'Member 2' }, { name: 'Member 3' }],
  }));

  useEffect(() => {
    if (!teamId) return;
    const unsub = onSnapshot(
      doc(db, 'teams', teamId),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setTeamInfo({
            teamId: d.teamId || teamId,
            teamName: d.teamName || `Team ${teamId}`,
            members: d.members || [{ name: 'M1' }, { name: 'M2' }, { name: 'M3' }],
          });
        }
      },
      (err) => {
        console.warn('[Evaluation] Error fetching team doc:', err);
      }
    );
    return () => unsub();
  }, [teamId]);

  const team = teamInfo;

  const teamEval = getTeamEvaluation(teamId);

  const [predictScore, setPredictScore] = useState<number | null>(teamEval.predictScore ?? null);
  const [predictSource, setPredictSource] = useState<'AUTO' | 'MANUAL_OVERRIDE'>('AUTO');
  const [predictOverrideReason, setPredictOverrideReason] = useState<string>('');
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideInput, setOverrideInput] = useState<string>('');
  const [overrideReasonInput, setOverrideReasonInput] = useState<string>('');
  const [overrideStatus, setOverrideStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [debugMarks, setDebugMarks] = useState<number | ''>(
    teamEval.debugMarks !== null ? teamEval.debugMarks : ''
  );
  const [codeMarks, setCodeMarks] = useState<number | ''>(
    teamEval.codeMarks !== null ? teamEval.codeMarks : ''
  );

  const [savedDebugScore, setSavedDebugScore] = useState<number | null>(teamEval.debugMarks);
  const [savedCodeScore, setSavedCodeScore] = useState<number | null>(teamEval.codeMarks);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Authoritative real-time listener to /results/{teamId}
  useEffect(() => {
    if (!teamId) return;
    const unsub = onSnapshot(
      doc(db, 'results', teamId),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (typeof d.predictScore === 'number') {
            setPredictScore(d.predictScore);
          }
          if (d.predictScoreSource) {
            setPredictSource(d.predictScoreSource);
          }
          if (d.predictOverrideReason) {
            setPredictOverrideReason(d.predictOverrideReason);
          }
          if (d.debugMarks !== undefined) {
            setSavedDebugScore(d.debugMarks);
            if (d.debugMarks !== null) setDebugMarks(d.debugMarks);
          }
          if (d.codeMarks !== undefined) {
            setSavedCodeScore(d.codeMarks);
            if (d.codeMarks !== null) setCodeMarks(d.codeMarks);
          }
        }
      },
      (err) => {
        console.warn('[Evaluation] Error listening to results doc:', err);
      }
    );
    return () => unsub();
  }, [teamId]);

  // Sync state whenever competition context updates
  useEffect(() => {
    const updated = getTeamEvaluation(teamId);
    if (updated.predictScore !== null && updated.predictScore !== undefined) {
      setPredictScore(updated.predictScore);
    }
    if (updated.debugMarks !== null) {
      setDebugMarks(updated.debugMarks);
      setSavedDebugScore(updated.debugMarks);
    }
    if (updated.codeMarks !== null) {
      setCodeMarks(updated.codeMarks);
      setSavedCodeScore(updated.codeMarks);
    }
  }, [teamId, getTeamEvaluation]);

  const numDebug = typeof debugMarks === 'number' ? debugMarks : null;
  const numCode = typeof codeMarks === 'number' ? codeMarks : null;
  const debugCodeTotal =
    numDebug !== null && numCode !== null ? numDebug + numCode : null;
  const finalScore =
    predictScore !== null && numDebug !== null && numCode !== null
      ? predictScore + numDebug + numCode
      : null;

  const hasDebugScore = savedDebugScore !== null;
  const hasCodeScore = savedCodeScore !== null;
  const isBothEvaluated = hasDebugScore && hasCodeScore;

  const handleSavePredictOverride = async () => {
    if (overrideInput === '') return;
    const val = Number(overrideInput);
    if (isNaN(val) || val < 0 || val > 30) {
      setErrorMessage('Predict score must be a number between 0 and 30.');
      return;
    }
    if (!overrideReasonInput.trim()) {
      setErrorMessage('Please provide a reason for the manual Predict override.');
      return;
    }

    setOverrideStatus('saving');
    setErrorMessage(null);
    try {
      await updateTeamScores(teamId, {
        predictScore: val,
        predictScoreSource: 'MANUAL_OVERRIDE',
        predictOverrideReason: overrideReasonInput.trim(),
        judgeId: user?.judgeId,
      });
      setPredictScore(val);
      setPredictSource('MANUAL_OVERRIDE');
      setPredictOverrideReason(overrideReasonInput.trim());
      setOverrideStatus('saved');
      setShowOverrideModal(false);
      setToast(`Predict score manually overridden to ${val}/30.`);
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setOverrideStatus('error');
      setErrorMessage(err.message || 'Failed to save predict override.');
    }
  };

  const handleUpdate = async () => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      await updateTeamScores(teamId, {
        debugMarks: typeof debugMarks === 'number' ? debugMarks : null,
        codeMarks: typeof codeMarks === 'number' ? codeMarks : null,
        judgeId: user?.judgeId,
      });
      setSavedDebugScore(typeof debugMarks === 'number' ? debugMarks : null);
      setSavedCodeScore(typeof codeMarks === 'number' ? codeMarks : null);
      setSaveStatus('saved');
      setToast('Evaluation updated. Leaderboard synchronized.');
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMessage(err.message || 'Failed to save evaluation.');
    }
  };

  return (
    <JudgeLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-900/90 border border-emerald-500/50 text-emerald-200 px-5 py-3 rounded-xl text-sm font-mono shadow-2xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{toast}</span>
          </div>
        )}

        {/* Back navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/judge/teams')}
            className="btn-ghost text-xs flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Assigned Teams</span>
          </button>
          <button
            onClick={() => navigate(`/judge/team/${teamId}`)}
            className="btn-ghost text-xs flex items-center gap-2"
          >
            <Code className="w-4 h-4" />
            <span>Inspect Team Submissions</span>
          </button>
        </div>

        {/* Team Header */}
        <div className="card-dark p-6 border border-dark-700 rounded-xl flex items-center justify-between flex-wrap gap-4 bg-dark-900/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xl font-bold text-cyan-400">{team.teamId}</span>
              <span className="text-slate-600">·</span>
              <h1 className="text-white font-black text-2xl">{team.teamName}</h1>
            </div>
            <p className="text-slate-500 text-xs font-mono">
              Official Evaluation Summary · Automatically Retrieved from Strike Reviews
            </p>
          </div>

          <div>
            {isBothEvaluated ? (
              <span className="badge-submitted px-3 py-1 text-xs flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4" /> EVALUATION COMPLETE
              </span>
            ) : (
              <span className="badge-active px-3 py-1 text-xs font-bold">
                EVALUATION IN PROGRESS
              </span>
            )}
          </div>
        </div>

        {/* Retained & Retrieved Evaluation Cards */}
        <div className="space-y-6">
          {/* SECTION 1: PREDICT */}
          <div className="card-dark p-6 border border-dark-700 rounded-xl space-y-3 bg-dark-900/40">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <h3 className="text-white font-bold text-sm tracking-wider uppercase font-mono">
                  1. PREDICT SCORE (STRIKE 1)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {predictSource === 'MANUAL_OVERRIDE' ? (
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded border border-amber-500/40 bg-amber-950/30 text-amber-400 flex items-center gap-1 font-semibold">
                    MANUAL OVERRIDE
                  </span>
                ) : (
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded border border-dark-600 bg-dark-800 text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> AUTO-CALCULATED
                  </span>
                )}
                {(user?.role === 'organizer' || user?.role === 'judge') && (
                  <button
                    type="button"
                    onClick={() => {
                      setOverrideInput(predictScore !== null ? String(predictScore) : '');
                      setOverrideReasonInput(predictOverrideReason || '');
                      setShowOverrideModal(!showOverrideModal);
                    }}
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline font-semibold px-2 py-0.5 rounded bg-dark-800 border border-dark-700 hover:border-cyan-500/50 transition-colors"
                  >
                    {showOverrideModal ? 'Cancel Override' : 'Manual Override'}
                  </button>
                )}
              </div>
            </div>

            <p className="text-slate-400 text-xs font-mono">
              {predictSource === 'MANUAL_OVERRIDE'
                ? `Manually adjusted. Reason: "${predictOverrideReason || 'Not specified'}"`
                : "Computed automatically from participant's Strike 1 output predictions. No manual entry needed."}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <div className="bg-dark-950 border border-dark-700 px-5 py-3 rounded-xl font-mono text-2xl font-black text-cyan-400">
                {predictScore !== null ? predictScore : '—'}{' '}
                <span className="text-slate-600 text-base font-normal">/ 30</span>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {predictScore !== null ? '(Strike 1 Output Prediction Total)' : '(Evaluation Pending)'}
              </span>
            </div>

            {/* Manual Override Form */}
            {showOverrideModal && (
              <div className="mt-4 p-4 rounded-xl border border-amber-500/40 bg-dark-950/80 space-y-3 font-mono">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4" /> Strike 1 Manual Score Override
                </div>
                <p className="text-[11px] text-slate-400">
                  Emergency scoring fallback. This replaces the canonical Strike 1 score and is recorded in the immutable audit log.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Predict Score (0 – 30):</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={overrideInput}
                      onChange={(e) => setOverrideInput(e.target.value)}
                      placeholder="e.g. 20"
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-cyan-400 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Override Reason:</label>
                    <input
                      type="text"
                      value={overrideReasonInput}
                      onChange={(e) => setOverrideReasonInput(e.target.value)}
                      placeholder="e.g. Evaluation fallback test case verification"
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOverrideModal(false)}
                    className="btn-ghost text-xs py-1.5 px-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePredictOverride}
                    disabled={overrideStatus === 'saving' || overrideInput === ''}
                    className="btn-primary text-xs py-1.5 px-4 bg-amber-600 hover:bg-amber-500 text-dark-950 font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {overrideStatus === 'saving' ? (
                      <>
                        <div className="w-3 h-3 border-2 border-dark-950 border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Predict Override</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: DEBUG MARKS (RETRIEVED FROM STRIKE 2) */}
          <div className="card-dark p-6 border border-indigo-500/30 rounded-xl space-y-4 bg-dark-900/40">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <h3 className="text-white font-bold text-sm tracking-wider uppercase font-mono">
                  2. DEBUG SCORE (STRIKE 2)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {hasDebugScore ? (
                  <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    <Check className="w-3.5 h-3.5" /> Retrieved from Strike 2
                  </span>
                ) : (
                  <span className="text-xs font-mono text-yellow-400 bg-yellow-950/30 border border-yellow-500/30 px-2.5 py-0.5 rounded-full">
                    Not scored yet
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/judge/team/${teamId}`)}
                  className="btn-ghost text-xs py-1 px-2 text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono"
                >
                  <span>Review Code</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>

            <p className="text-slate-400 text-xs font-mono">
              Score entered while reviewing the participant's Strike 2 debugging submission.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <div className="bg-dark-950 border border-dark-700 px-5 py-3 rounded-xl font-mono text-2xl font-black text-indigo-400">
                {hasDebugScore ? savedDebugScore : '—'}{' '}
                <span className="text-slate-600 text-base font-normal">/ 60</span>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {hasDebugScore ? '(Strike 2 Debug Total)' : '(Pending Evaluation)'}
              </span>
            </div>
          </div>

          {/* SECTION 3: CODE MARKS (RETRIEVED FROM STRIKE 3) */}
          <div className="card-dark p-6 border border-purple-500/30 rounded-xl space-y-4 bg-dark-900/40">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <h3 className="text-white font-bold text-sm tracking-wider uppercase font-mono">
                  3. CODE SCORE (STRIKE 3)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {hasCodeScore ? (
                  <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    <Check className="w-3.5 h-3.5" /> Retrieved from Strike 3
                  </span>
                ) : (
                  <span className="text-xs font-mono text-yellow-400 bg-yellow-950/30 border border-yellow-500/30 px-2.5 py-0.5 rounded-full">
                    Not scored yet
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/judge/team/${teamId}`)}
                  className="btn-ghost text-xs py-1 px-2 text-purple-400 hover:text-purple-300 flex items-center gap-1 font-mono"
                >
                  <span>Review Code</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>

            <p className="text-slate-400 text-xs font-mono">
              Score entered while reviewing the participant's Strike 3 final implementation.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <div className="bg-dark-950 border border-dark-700 px-5 py-3 rounded-xl font-mono text-2xl font-black text-purple-400">
                {hasCodeScore ? savedCodeScore : '—'}{' '}
                <span className="text-slate-600 text-base font-normal">/ 60</span>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {hasCodeScore ? '(Strike 3 Code Total)' : '(Pending Evaluation)'}
              </span>
            </div>
          </div>

          {/* SECTION 4: AGGREGATE CALCULATED TOTALS */}
          <div className="card-dark p-6 border border-emerald-500/30 rounded-xl space-y-5 bg-gradient-to-br from-dark-900 via-dark-850 to-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              <h3 className="text-white font-bold text-base font-mono uppercase tracking-wider">
                AGGREGATE ROUND 2 TOTALS
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Debug + Code Combined */}
              <div className="bg-dark-950/80 p-5 rounded-xl border border-dark-700 space-y-1">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                  DEBUG + CODE COMBINED
                </span>
                <div className="font-mono text-2xl font-black text-emerald-400">
                  {debugCodeTotal !== null ? debugCodeTotal : '—'}{' '}
                  <span className="text-slate-600 text-sm font-normal">/ 120</span>
                </div>
                <p className="text-[11px] font-mono text-slate-500">
                  {numDebug !== null ? numDebug : '—'} (Debug) + {numCode !== null ? numCode : '—'} (Code)
                </p>
              </div>

              {/* Final Score */}
              <div className="bg-dark-950/80 p-5 rounded-xl border border-dark-700 space-y-1">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                  FINAL COMPETITION SCORE
                </span>
                <div className="font-mono text-3xl font-black text-cyan-400 text-glow-cyan">
                  {finalScore !== null ? finalScore : '—'}{' '}
                  <span className="text-slate-600 text-base font-normal">/ 150</span>
                </div>
                <p className="text-[11px] font-mono text-slate-500">
                  {predictScore !== null ? predictScore : '—'} (Predict) +{' '}
                  {numDebug !== null ? numDebug : '—'} (Debug) +{' '}
                  {numCode !== null ? numCode : '—'} (Code) ={' '}
                  {finalScore !== null ? `${finalScore} / 150` : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick inline adjustments if judge wishes to tweak directly */}
          <div className="card-dark p-5 border border-dark-700 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-white font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-slate-400" />
                Optional Direct Mark Adjustment
              </h4>
              <span className="text-[11px] font-mono text-slate-500">
                Syncs with Leaderboard & Strike reviews
              </span>
            </div>

            {errorMessage && (
              <div className="bg-rose-950/60 border border-rose-500/50 p-3 rounded-lg text-xs font-mono text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">
                  Debug Score (/60):
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={debugMarks}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.min(60, Math.max(0, Number(e.target.value)));
                    setDebugMarks(val);
                  }}
                  className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white font-mono text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">
                  Code Score (/60):
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={codeMarks}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.min(60, Math.max(0, Number(e.target.value)));
                    setCodeMarks(val);
                  }}
                  className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white font-mono text-sm outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={(debugMarks === '' && codeMarks === '') || saveStatus === 'saving'}
                className="btn-primary py-2 px-4 text-xs flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-dark-950 font-bold disabled:opacity-40"
              >
                {saveStatus === 'saving' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : saveStatus === 'saved' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </>
                ) : saveStatus === 'error' ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                    <span>Save Failed — Retry</span>
                  </>
                ) : (
                  <>
                    <Scale className="w-3.5 h-3.5" />
                    <span>Save & Sync Marks</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </JudgeLayout>
  );
}
