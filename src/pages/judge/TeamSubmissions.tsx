import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Scale,
  Code2,
  Terminal,
  HelpCircle,
  CheckCircle2,
  ChevronRight,
  Save,
  Check,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import JudgeLayout from '../../components/layout/JudgeLayout';
import { MOCK_TEAMS } from '../../data/mock-teams';
import { db } from '../../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  MOCK_STRIKE1_QUESTIONS,
  MOCK_STRIKE2_QUESTIONS,
  MOCK_STRIKE3_QUESTIONS,
} from '../../data/mock-questions';
import { useCompetition } from '../../context/CompetitionContext';
import { useAuth } from '../../context/AuthContext';

export default function TeamSubmissions() {
  const { teamId = 'CRL-0000' } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { getTeamEvaluation, updateTeamScores } = useCompetition();
  const { user } = useAuth();

  const [activeStrikeTab, setActiveStrikeTab] = useState<'strike1' | 'strike2' | 'strike3'>('strike2');

  // Retrieve current saved scores
  const teamEval = getTeamEvaluation(teamId);

  const [predictScore, setPredictScore] = useState<number>(teamEval.predictScore ?? 0);
  const [debugInput, setDebugInput] = useState<number | ''>(
    teamEval.debugMarks !== null ? teamEval.debugMarks : ''
  );
  const [codeInput, setCodeInput] = useState<number | ''>(
    teamEval.codeMarks !== null ? teamEval.codeMarks : ''
  );

  const [savedDebugScore, setSavedDebugScore] = useState<number | null>(teamEval.debugMarks);
  const [savedCodeScore, setSavedCodeScore] = useState<number | null>(teamEval.codeMarks);

  const [debugSaveStatus, setDebugSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [codeSaveStatus, setCodeSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  // Authoritative real-time listener to /results/{teamId}
  useEffect(() => {
    if (!teamId) return;
    const unsub = onSnapshot(
      doc(db, 'results', teamId),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (typeof d.predictScore === 'number' && d.predictScore > 0) {
            setPredictScore(d.predictScore);
          }
          if (d.debugMarks !== undefined) {
            setSavedDebugScore(d.debugMarks);
            if (d.debugMarks !== null) {
              setDebugInput(d.debugMarks);
              setDebugSaved(true);
            }
          }
          if (d.codeMarks !== undefined) {
            setSavedCodeScore(d.codeMarks);
            if (d.codeMarks !== null) {
              setCodeInput(d.codeMarks);
              setCodeSaved(true);
            }
          }
        }
      },
      (err) => {
        console.warn('[TeamSubmissions] Error listening to results doc:', err);
      }
    );
    return () => unsub();
  }, [teamId]);

  // Context fallback sync
  useEffect(() => {
    const updated = getTeamEvaluation(teamId);
    if (updated.predictScore) setPredictScore(updated.predictScore);
    if (updated.debugMarks !== null) {
      setDebugInput(updated.debugMarks);
      setSavedDebugScore(updated.debugMarks);
      setDebugSaved(true);
    }
    if (updated.codeMarks !== null) {
      setCodeInput(updated.codeMarks);
      setSavedCodeScore(updated.codeMarks);
      setCodeSaved(true);
    }
  }, [teamId, getTeamEvaluation]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveDebug = async () => {
    if (debugInput === '') return;
    const score = Math.min(60, Math.max(0, Number(debugInput)));
    setDebugSaveStatus('saving');
    setSaveError(null);
    try {
      await updateTeamScores(teamId, {
        debugMarks: score,
        judgeId: user?.judgeId,
      });
      setSavedDebugScore(score);
      setDebugSaved(true);
      setDebugSaveStatus('saved');
      showToast(`Debug score saved (${score}/60). Leaderboard updated.`);
      setTimeout(() => setDebugSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('[TeamSubmissions] Save Debug failed:', err);
      setDebugSaveStatus('error');
      setSaveError(err.message || 'Failed to save Debug score. Please check your assignment permissions.');
    }
  };

  const handleSaveCode = async () => {
    if (codeInput === '') return;
    const score = Math.min(60, Math.max(0, Number(codeInput)));
    setCodeSaveStatus('saving');
    setSaveError(null);
    try {
      await updateTeamScores(teamId, {
        codeMarks: score,
        judgeId: user?.judgeId,
      });
      setSavedCodeScore(score);
      setCodeSaved(true);
      setCodeSaveStatus('saved');
      showToast(`Code score saved (${score}/60). Leaderboard updated.`);
      setTimeout(() => setCodeSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('[TeamSubmissions] Save Code failed:', err);
      setCodeSaveStatus('error');
      setSaveError(err.message || 'Failed to save Code score. Please check your assignment permissions.');
    }
  };

  const [teamInfo, setTeamInfo] = useState<{
    teamId: string;
    teamName: string;
    members: { name: string }[];
  }>(() => {
    const found = MOCK_TEAMS.find((t) => t.teamId === teamId);
    return (
      found || {
        teamId: teamId || 'CRL-0000',
        teamName: `Team ${teamId}`,
        members: [{ name: 'M1' }, { name: 'M2' }, { name: 'M3' }],
      }
    );
  });

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
        console.warn('[TeamSubmissions] Error fetching team doc:', err);
      }
    );
    return () => unsub();
  }, [teamId]);

  const team = teamInfo;

  // Mock participant submission data for the judge to inspect
  const mockPredictAnswers: Record<string, string> = {
    'q1-01': 'A',
    'q1-02': 'C',
    'q1-03': 'A',
  };

  const mockDebugFixes: Record<string, string> = {
    'q2-01': `def sum_even(n):\n    total = 0\n    for i in range(1, n + 1):\n        if i % 2 == 0:  # FIXED: checked for even remainder\n            total += i\n    return total\n\nprint(sum_even(10)) # Returns 30 correctly`,
    'q2-02': `public static int findMax(int[] arr) {\n    int max = arr[0];\n    for (int i = 1; i < arr.length; i++) { // FIXED: corrected <= to <\n        if (arr[i] > max) {\n            max = arr[i];\n        }\n    }\n    return max;\n}`,
    'q2-03': `function reverseString(str) {\n    if (!str) return ''; // FIXED: added null/undefined defensive check\n    return str.split('').reverse().join('');\n}`,
  };

  const mockCodeSolutions: Record<string, string> = {
    'q3-01': `def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        complement = target - n\n        if complement in seen:\n            return [seen[complement], i]\n        seen[n] = i\n    return []`,
    'q3-02': `public static boolean isPalindrome(String s) {\n    String cleaned = s.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();\n    int left = 0, right = cleaned.length() - 1;\n    while (left < right) {\n        if (cleaned.charAt(left++) != cleaned.charAt(right--)) return false;\n    }\n    return true;\n}`,
    'q3-03': `function fibonacci(n) {\n    if (n <= 0) return 0;\n    if (n === 1) return 1;\n    let a = 0, b = 1;\n    for (let i = 2; i <= n; i++) {\n        let temp = a + b;\n        a = b;\n        b = temp;\n    }\n    return b;\n}`,
  };

  return (
    <JudgeLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-900/90 border border-emerald-500/50 text-emerald-200 px-5 py-3 rounded-xl text-sm font-mono shadow-2xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{toast}</span>
          </div>
        )}

        {/* Top bar back button and Actions */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <button
            onClick={() => navigate('/judge/teams')}
            className="btn-ghost text-xs flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Assigned Teams</span>
          </button>
          <button
            onClick={() => navigate(`/judge/evaluate/${teamId}`)}
            className="btn-primary text-xs py-2.5 px-4 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-dark-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            <Scale className="w-4 h-4" />
            <span>View Full Evaluation Summary</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Team Overview Card */}
        <div className="card-dark p-6 border border-dark-700 rounded-xl flex items-center justify-between flex-wrap gap-4 bg-dark-900/60">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-xl font-bold text-cyan-400">{team.teamId}</span>
              <span className="text-slate-600">/</span>
              <h1 className="text-white font-black text-2xl">{team.teamName}</h1>
            </div>
            <p className="text-slate-500 text-xs font-mono">
              Members:{' '}
              <span className="text-slate-300">
                {team.members.map((m) => m.name).join(' · ')}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="bg-dark-800/80 p-3 rounded-lg border border-dark-700 flex items-center gap-3 font-mono text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Predict Score</span>
                <span className="text-cyan-400 font-bold text-base">
                  {predictScore !== null ? `${predictScore} / 30` : '— / 30'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 bg-dark-900 px-2 py-0.5 rounded border border-dark-700">
                AUTO
              </span>
            </div>

            <div className="bg-dark-800/80 p-3 rounded-lg border border-dark-700 font-mono text-xs">
              <span className="text-slate-500 block text-[10px] uppercase">Debug Score</span>
              <span className="text-indigo-400 font-bold text-base">
                {savedDebugScore !== null ? `${savedDebugScore} / 60` : 'Not Scored'}
              </span>
            </div>

            <div className="bg-dark-800/80 p-3 rounded-lg border border-dark-700 font-mono text-xs">
              <span className="text-slate-500 block text-[10px] uppercase">Code Score</span>
              <span className="text-purple-400 font-bold text-base">
                {savedCodeScore !== null ? `${savedCodeScore} / 60` : 'Not Scored'}
              </span>
            </div>
          </div>
        </div>

        {/* Strike Selection Tabs */}
        <div className="flex items-center gap-2 border-b border-dark-700 pb-3">
          <button
            onClick={() => setActiveStrikeTab('strike1')}
            className={`px-4 py-2 rounded-t-lg font-mono text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeStrikeTab === 'strike1'
                ? 'border-cyan-500 text-cyan-300 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Strike 1: Predict (MCQ)
          </button>
          <button
            onClick={() => setActiveStrikeTab('strike2')}
            className={`px-4 py-2 rounded-t-lg font-mono text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeStrikeTab === 'strike2'
                ? 'border-indigo-500 text-indigo-300 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Strike 2: Debug Submissions
          </button>
          <button
            onClick={() => setActiveStrikeTab('strike3')}
            className={`px-4 py-2 rounded-t-lg font-mono text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeStrikeTab === 'strike3'
                ? 'border-purple-500 text-purple-300 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Strike 3: Code Submissions
          </button>
        </div>

        {/* Tab 1: Strike 1 Predict View */}
        {activeStrikeTab === 'strike1' && (
          <div className="space-y-4">
            <div className="bg-cyan-950/20 border border-cyan-500/30 p-4 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="text-cyan-300 font-bold text-sm">Output Prediction Submissions</h3>
                <p className="text-slate-400 text-xs font-mono mt-0.5">
                  Predict marks are automatically computed from MCQ choices. No manual entry needed.
                </p>
              </div>
              <span className="text-xs font-mono text-cyan-400 px-3 py-1 bg-cyan-950/50 border border-cyan-500/40 rounded-full font-bold">
                AUTO: {teamEval.predictScore} / 30
              </span>
            </div>

            {MOCK_STRIKE1_QUESTIONS.map((q) => (
              <div key={q.id} className="card-dark p-5 border border-dark-700 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-bold text-sm">
                    Question {q.index}: {q.title}
                  </h4>
                  <span className="text-xs font-mono text-slate-500 uppercase">{q.language}</span>
                </div>
                <pre className="bg-dark-950 p-3 rounded-lg border border-dark-700 text-xs font-mono text-slate-300 overflow-x-auto">
                  {q.statement}
                </pre>
                <div className="flex items-center gap-3 pt-2 text-xs font-mono">
                  <span className="text-slate-500">Team Selected:</span>
                  <span className="px-2.5 py-1 rounded bg-cyan-900/30 border border-cyan-500/50 text-cyan-300 font-bold">
                    Option {mockPredictAnswers[q.id] || 'A'}
                  </span>
                  <span className="text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Recorded & Validated
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Strike 2 Debug Submissions */}
        {activeStrikeTab === 'strike2' && (
          <div className="space-y-6">
            <div className="bg-indigo-950/20 border border-indigo-500/30 p-4 rounded-xl">
              <h3 className="text-indigo-300 font-bold text-sm">Strike 2 Debug Fixes</h3>
              <p className="text-slate-400 text-xs font-mono mt-0.5">
                Review all 3 debug challenges below, then award a single combined Debug Score.
              </p>
            </div>

            {MOCK_STRIKE2_QUESTIONS.map((q) => (
              <div key={q.id} className="card-dark p-6 border border-dark-700 rounded-xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="badge-active bg-indigo-900/40 border-indigo-500/50 text-indigo-300 text-xs">
                      DEBUG {q.index}
                    </span>
                    <h4 className="text-white font-bold text-sm">{q.title}</h4>
                  </div>
                  <span className="text-xs font-mono text-slate-500 uppercase px-2 py-0.5 bg-dark-900 border border-dark-700 rounded">
                    {q.language}
                  </span>
                </div>

                <p className="text-slate-300 text-xs">{q.statement}</p>

                <div>
                  <span className="text-slate-500 text-[11px] font-mono uppercase block mb-1">
                    Team's Submitted Code Fix:
                  </span>
                  <pre className="bg-dark-950 p-4 rounded-lg border border-dark-700 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                    {mockDebugFixes[q.id] || q.starterCode}
                  </pre>
                </div>
              </div>
            ))}

            {/* End-of-Section Debug Score Box */}
            <div className="card-dark p-6 border-2 border-indigo-500/50 rounded-xl bg-gradient-to-r from-dark-900 via-indigo-950/20 to-dark-900 shadow-[0_0_25px_rgba(99,102,241,0.15)] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-white font-black text-base font-mono uppercase tracking-wider flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-indigo-400" />
                    DEBUG SCORE (COMBINED FOR ALL 3 QUESTIONS)
                  </h4>
                  <p className="text-slate-400 text-xs font-mono mt-1">
                    Enter the team's combined mark for Strike 2 Debug (0 – 60). This automatically flows to Evaluation and Leaderboard.
                  </p>
                </div>
                {savedDebugScore !== null && (
                  <span className="flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/50 text-emerald-400 font-bold">
                    <Check className="w-4 h-4" /> Saved: {savedDebugScore} / 60
                  </span>
                )}
              </div>

              {saveError && (
                <div className="bg-rose-950/60 border border-rose-500/50 p-3 rounded-lg text-xs font-mono text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="flex items-center gap-4 flex-wrap pt-2">
                <div className="relative w-44">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={debugInput}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.min(60, Math.max(0, Number(e.target.value)));
                      setDebugInput(val);
                      setDebugSaved(false);
                    }}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-dark-950 border border-indigo-500/50 rounded-xl text-white font-mono text-2xl font-black outline-none focus:border-indigo-400 transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">
                    / 60
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSaveDebug}
                  disabled={debugInput === '' || debugSaveStatus === 'saving'}
                  className="btn-primary py-3 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {debugSaveStatus === 'saving' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Debug Marks...</span>
                    </>
                  ) : debugSaveStatus === 'saved' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Saved ({savedDebugScore}/60)</span>
                    </>
                  ) : debugSaveStatus === 'error' ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-300" />
                      <span>Save Failed — Retry</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{savedDebugScore !== null ? 'Update Debug Score' : 'Save Debug Score'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Strike 3 Code Submissions */}
        {activeStrikeTab === 'strike3' && (
          <div className="space-y-6">
            <div className="bg-purple-950/20 border border-purple-500/30 p-4 rounded-xl">
              <h3 className="text-purple-300 font-bold text-sm">Strike 3 Complete Code Challenges</h3>
              <p className="text-slate-400 text-xs font-mono mt-0.5">
                Review all 3 code solutions below, then award a single combined Code Score.
              </p>
            </div>

            {MOCK_STRIKE3_QUESTIONS.map((q) => (
              <div key={q.id} className="card-dark p-6 border border-dark-700 rounded-xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="badge-active bg-purple-900/40 border-purple-500/50 text-purple-300 text-xs">
                      CODE {q.index}
                    </span>
                    <h4 className="text-white font-bold text-sm">{q.title}</h4>
                  </div>
                  <span className="text-xs font-mono text-slate-500 uppercase px-2 py-0.5 bg-dark-900 border border-dark-700 rounded">
                    {q.language}
                  </span>
                </div>

                <p className="text-slate-300 text-xs">{q.statement}</p>

                <div>
                  <span className="text-slate-500 text-[11px] font-mono uppercase block mb-1">
                    Team's Solution Code:
                  </span>
                  <pre className="bg-dark-950 p-4 rounded-lg border border-dark-700 text-xs font-mono text-purple-200 overflow-x-auto leading-relaxed">
                    {mockCodeSolutions[q.id] || q.starterCode}
                  </pre>
                </div>
              </div>
            ))}

            {/* End-of-Section Code Score Box */}
            <div className="card-dark p-6 border-2 border-purple-500/50 rounded-xl bg-gradient-to-r from-dark-900 via-purple-950/20 to-dark-900 shadow-[0_0_25px_rgba(168,85,247,0.15)] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-white font-black text-base font-mono uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-purple-400" />
                    CODE SCORE (COMBINED FOR ALL 3 QUESTIONS)
                  </h4>
                  <p className="text-slate-400 text-xs font-mono mt-1">
                    Enter the team's combined mark for Strike 3 Code (0 – 60). This automatically flows to Evaluation and Leaderboard.
                  </p>
                </div>
                {savedCodeScore !== null && (
                  <span className="flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/50 text-emerald-400 font-bold">
                    <Check className="w-4 h-4" /> Saved: {savedCodeScore} / 60
                  </span>
                )}
              </div>

              {saveError && (
                <div className="bg-rose-950/60 border border-rose-500/50 p-3 rounded-lg text-xs font-mono text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="flex items-center gap-4 flex-wrap pt-2">
                <div className="relative w-44">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={codeInput}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.min(60, Math.max(0, Number(e.target.value)));
                      setCodeInput(val);
                      setCodeSaved(false);
                    }}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-dark-950 border border-purple-500/50 rounded-xl text-white font-mono text-2xl font-black outline-none focus:border-purple-400 transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">
                    / 60
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSaveCode}
                  disabled={codeInput === '' || codeSaveStatus === 'saving'}
                  className="btn-primary py-3 px-5 bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {codeSaveStatus === 'saving' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Code Marks...</span>
                    </>
                  ) : codeSaveStatus === 'saved' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Saved ({savedCodeScore}/60)</span>
                    </>
                  ) : codeSaveStatus === 'error' ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-300" />
                      <span>Save Failed — Retry</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{savedCodeScore !== null ? 'Update Code Score' : 'Save Code Score'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </JudgeLayout>
  );
}
