// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Participant Login Page
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, AlertCircle, Loader2, Zap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// ----------------------------------------------------------------
// Shared input class
// ----------------------------------------------------------------
const INPUT_BASE =
  'w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-white placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all duration-200';

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export default function ParticipantLogin() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, loginAsParticipant } = useAuth();

  const [teamId, setTeamId] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated as participant
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role === 'participant') {
      navigate('/participant/waiting', { replace: true });
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId.trim() || !accessCode.trim()) {
      setError('Please enter both Team ID and Access Code.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await loginAsParticipant(teamId.trim(), accessCode.trim());
      if (result.success) {
        navigate('/participant/waiting', { replace: true });
      } else {
        setError(result.error ?? 'Login failed. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show spinner while restoring auth session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 bg-grid-pattern flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 bg-grid-pattern flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient glow blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[200px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* ── Branding ── */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1.5 mb-6"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-400 text-xs font-mono font-semibold tracking-widest uppercase">
              Round 2
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-4xl font-black tracking-tight text-white text-glow-white mb-1"
          >
            VIGYANTRA{' '}
            <span className="text-cyan-400 text-glow-cyan">2026</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-lg font-bold tracking-[0.3em] text-slate-400 uppercase mb-1"
          >
            Code Relay
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-sm font-mono text-slate-600 tracking-widest"
          >
            Participant Access
          </motion.p>
        </div>

        {/* ── Login card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="card-glow p-8"
        >
          <div className="flex items-center gap-2 mb-6">
            <LogIn className="w-5 h-5 text-cyan-400" />
            <h2 className="text-white font-bold text-lg tracking-wide">Team Login</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Team ID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono text-slate-400 tracking-widest uppercase">
                Team ID
              </label>
              <input
                type="text"
                value={teamId}
                onChange={(e) => {
                  setTeamId(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="e.g. CRL-0000"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={isSubmitting}
                className={INPUT_BASE}
              />
            </div>

            {/* Access Code */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono text-slate-400 tracking-widest uppercase">
                Access Code
              </label>
              <div className="relative">
                <input
                  type={showCode ? 'text' : 'password'}
                  value={accessCode}
                  onChange={(e) => {
                    setAccessCode(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  spellCheck={false}
                  disabled={isSubmitting}
                  className={`${INPUT_BASE} pr-11`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCode((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showCode ? 'Hide access code' : 'Show access code'}
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm font-mono">{error}</p>
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !teamId.trim() || !accessCode.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Enter Competition</span>
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* ── Credentials hint ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="mt-5 text-center"
        >
          <p className="text-slate-600 text-xs font-mono tracking-wider">
            Mock credentials:&nbsp;
            <span className="text-slate-400 font-semibold">Team ID: CRL-0000 | Code: MOCK-PASS</span>
          </p>
        </motion.div>

        {/* ── Footer ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-8 text-center text-slate-700 text-xs font-mono tracking-widest uppercase"
        >
          VIGYANTRA 2026 · Code Relay · Round 2
        </motion.p>
      </motion.div>
    </div>
  );
}
