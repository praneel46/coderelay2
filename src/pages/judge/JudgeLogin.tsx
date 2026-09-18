import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MOCK_JUDGES } from '../../data/mock-judges';

export default function JudgeLogin() {
  const navigate = useNavigate();
  const { loginAsJudge, user } = useAuth();
  const [judgeId, setJudgeId] = useState('J001');
  const [password, setPassword] = useState('judge001');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in as judge, redirect
  React.useEffect(() => {
    if (user?.role === 'judge') {
      navigate('/judge/teams', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await loginAsJudge(judgeId, password);
      if (res.success) {
        navigate('/judge/teams', { replace: true });
      } else {
        setError(res.error || 'Authentication failed');
      }
    } catch {
      setError('An unexpected error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-4 relative bg-grid-pattern">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(16, 185, 129, 0.05) 0%, transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-6 relative z-10"
      >
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 mb-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Scale className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide">
            VIGYANTRA 2026 · JUDGE PORTAL
          </h1>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Evaluation Console · Round 2 Code Relay
          </p>
        </div>

        {/* Login Card */}
        <div className="card-dark p-6 sm:p-8 border border-dark-700 space-y-5 bg-dark-900/80 backdrop-blur-sm">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg flex items-center gap-2.5 text-red-400 text-xs font-mono">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                Judge Credential
              </label>
              <select
                value={judgeId}
                onChange={(e) => {
                  setJudgeId(e.target.value);
                  if (e.target.value === 'J001') setPassword('judge001');
                  else if (e.target.value === 'J002') setPassword('judge002');
                  else if (e.target.value === 'J003') setPassword('judge003');
                }}
                className="w-full px-3.5 py-2.5 bg-dark-950 border border-dark-600 rounded-lg text-slate-200 text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
              >
                {MOCK_JUDGES.map((j) => (
                  <option key={j.judgeId} value={j.judgeId}>
                    {j.judgeId} — {j.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                Evaluation Passkey
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter judge passkey..."
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-950 border border-dark-600 rounded-lg text-slate-200 text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-dark-950 font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-dark-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>AUTHENTICATE & ENTER</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-dark-800 text-center">
            <p className="text-[11px] font-mono text-slate-500">
              Mock Credentials: <span className="text-emerald-400">J001 / judge001</span> or{' '}
              <span className="text-emerald-400">J002 / judge002</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
