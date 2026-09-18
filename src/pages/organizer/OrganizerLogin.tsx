// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// OrganizerLogin — organizer authentication page
// Supports Google Sign-In with backend role verification
// and fallback credentials for local testing.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ShieldCheck, Eye, EyeOff, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function OrganizerLogin() {
  const { user, isLoading, loginAsOrganizer, loginOrganizerWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated as organizer
  useEffect(() => {
    if (!isLoading && user?.role === 'organizer') {
      navigate('/organizer/overview', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleGoogleSignIn = async () => {
    setGoogleSubmitting(true);
    setError(null);
    const result = await loginOrganizerWithGoogle();
    setGoogleSubmitting(false);
    if (result.success) {
      navigate('/organizer/overview', { replace: true });
    } else {
      setError(result.error || 'ACCESS DENIED: Organizer authorization failed.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the organizer password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await loginAsOrganizer(password.trim());
    setSubmitting(false);
    if (result.success) {
      navigate('/organizer/overview', { replace: true });
    } else {
      setError(result.error ?? 'Authentication failed.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 bg-grid-pattern flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Header badge */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 bg-indigo-900/30 border border-indigo-500/40 px-4 py-2 rounded-full">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="text-indigo-300 text-xs font-mono uppercase tracking-widest">
              Restricted Access
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-dark-900 border border-dark-600 rounded-2xl p-8 shadow-2xl">
          {/* Logo / title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-4">
              <Lock className="w-8 h-8 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-black tracking-widest text-white uppercase mb-1">
              ORGANIZER ACCESS
            </h1>
            <p className="text-slate-500 text-sm font-mono">
              VIGYANTRA 2026 · CODE RELAY · ROUND 2
            </p>
          </div>

          {/* Primary Action: Google Sign-In with Trusted Role Check */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleSubmitting || submitting}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-4 py-3 rounded-lg transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mb-6 font-mono text-sm"
          >
            {googleSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-800" />
                <span>Verifying Organizer Role…</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-dark-700"></div>
            <span className="flex-shrink mx-4 text-xs font-mono text-slate-500 uppercase tracking-widest">
              or organizer key
            </span>
            <div className="flex-grow border-t border-dark-700"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-2">
                Organizer Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter organizer password"
                  className="w-full bg-dark-800 border border-dark-600 focus:border-indigo-500 rounded-lg px-4 py-3 pr-12 text-white placeholder-slate-600 font-mono text-sm outline-none transition-colors focus-ring"
                  disabled={submitting || googleSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 bg-red-900/20 border border-red-500/40 rounded-lg px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm font-mono leading-relaxed">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={submitting || googleSubmitting || !password.trim()}
              className="w-full btn-organizer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Access Control Panel</span>
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-dark-700">
            <div className="flex items-start gap-2 bg-dark-800/60 border border-dark-600 rounded-lg px-4 py-3">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400 font-mono font-semibold">
                  Role Authorization Active
                </p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Only authorized organizers have access. Unauthorized accounts are blocked.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-700 font-mono mt-6">
          VIGYANTRA 2026 · COMPETITION MANAGEMENT SYSTEM
        </p>
      </motion.div>
    </div>
  );
}
