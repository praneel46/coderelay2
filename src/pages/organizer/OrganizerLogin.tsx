// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Organizer Login Page — Cinematic Glassmorphism Redesign
// Supports Google Sign-In with backend role verification
// and fallback credentials for local/emergency authentication.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sliders, Lock, KeyRound, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
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
    <div
      className="min-h-screen w-full flex flex-col items-center justify-between px-3 sm:px-6 py-3 sm:py-6 relative overflow-x-hidden bg-cover bg-[center_top] sm:bg-center bg-no-repeat selection:bg-cyan-500/30 selection:text-cyan-200"
      style={{
        backgroundImage: "url('/images/login-bg.jpg')",
        backgroundColor: '#020409',
      }}
    >
      {/* Subtle atmospheric vignette overlay to ensure pristine contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-dark-950/70 via-dark-950/40 to-dark-950/80 pointer-events-none" />

      {/* ── TOP BRANDING ── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 text-center pt-1 sm:pt-2 w-full max-w-full overflow-hidden"
      >
        <h1 className="text-[clamp(1.15rem,5.5vw,1.85rem)] font-black tracking-[0.18em] sm:tracking-[0.35em] text-white uppercase text-glow-white whitespace-nowrap leading-none flex items-center justify-center">
          <span>VIGYANTRA</span>
          <span className="text-cyan-400 font-extrabold text-glow-cyan ml-2 sm:ml-3">2026</span>
        </h1>
        <p className="text-[10px] sm:text-xs font-extrabold tracking-[0.3em] sm:tracking-[0.45em] text-slate-300 uppercase mt-1 whitespace-nowrap">
          ORGANIZER PORTAL
        </p>
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5 text-[8.5px] sm:text-[10px] font-mono tracking-[0.12em] sm:tracking-[0.2em] text-slate-400 uppercase whitespace-nowrap">
          <span>CONTROL</span>
          <span className="text-cyan-400">•</span>
          <span>MONITOR</span>
          <span className="text-cyan-400">•</span>
          <span>EXECUTE</span>
        </div>
      </motion.header>

      {/* ── MAIN GLASS LOGIN CARD ── */}
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[390px] sm:max-w-[450px] my-2 sm:my-4"
      >
        {/* Glassmorphism Container with inner grid texture */}
        <div className="relative rounded-2xl bg-[#060b14]/80 backdrop-blur-2xl border border-cyan-500/30 p-4 sm:p-7 shadow-[0_0_35px_-10px_rgba(6,182,212,0.15),0_20px_40px_-12px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_0_15px_rgba(6,182,212,0.03)] overflow-hidden">
          {/* Subtle internal architectural grid lines */}
          <div
            className="absolute inset-0 pointer-events-none opacity-10 sm:opacity-15"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(34, 211, 238, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(34, 211, 238, 0.08) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          {/* Micro corner brackets */}
          <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-cyan-400/40 pointer-events-none" />
          <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-cyan-400/40 pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-cyan-400/40 pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-cyan-400/40 pointer-events-none" />

          {/* Glowing Top Icon */}
          <div className="relative flex justify-center mb-2 sm:mb-2.5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-950/60 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <Sliders className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
            </div>
          </div>

          {/* Role & Titles */}
          <div className="relative text-center mb-4 sm:mb-5">
            <p className="text-[10px] sm:text-[11px] font-mono tracking-[0.2em] sm:tracking-[0.25em] text-cyan-400 font-semibold uppercase mb-0.5 whitespace-nowrap">
              ORGANIZER ACCESS
            </p>
            <h2 className="text-xl sm:text-2xl font-black tracking-wide text-white uppercase text-glow-white mb-0.5 whitespace-nowrap">
              ORGANIZER ACCESS
            </h2>
            <p className="text-[9.5px] sm:text-[10.5px] font-mono tracking-[0.15em] sm:tracking-[0.2em] text-slate-300 uppercase font-semibold mb-1 sm:mb-1.5 whitespace-nowrap">
              CONTROL • MONITOR • EXECUTE
            </p>
            <p className="text-slate-400 text-[11px] sm:text-xs font-sans leading-snug max-w-[280px] sm:max-w-[320px] mx-auto">
              Sign in to manage teams, control rounds and oversee the competition.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative mb-4 flex items-start gap-2 bg-red-950/50 border border-red-500/40 rounded-lg px-3 py-2 text-red-300 text-[11px] font-mono shadow-[0_0_15px_rgba(239,68,68,0.2)]"
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Primary Action: Google Sign-In with Role Verification */}
          <div className="relative space-y-3 sm:space-y-3.5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleSubmitting || submitting}
              className="w-full py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-lg sm:rounded-xl bg-[#09111e]/90 hover:bg-[#0e182c] border border-cyan-500/30 hover:border-cyan-400/60 text-slate-100 font-mono text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 shadow-[0_0_15px_rgba(6,182,212,0.12)] hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-cyan-400" />
                  <span>Verifying Role…</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" viewBox="0 0 24 24">
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
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative flex items-center py-0.5">
              <div className="flex-grow border-t border-cyan-900/40"></div>
              <span className="flex-shrink mx-2.5 text-[9.5px] sm:text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                OR
              </span>
              <div className="flex-grow border-t border-cyan-900/40"></div>
            </div>

            {/* Credential Form */}
            <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3" noValidate>
              <div className="space-y-0.5 sm:space-y-1">
                <label className="block text-[9.5px] sm:text-[10px] font-mono tracking-[0.15em] text-slate-400 uppercase pl-1">
                  Organizer Key
                </label>
                <div className="relative group">
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500/70 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter organizer password"
                    autoComplete="current-password"
                    disabled={submitting || googleSubmitting}
                    className="w-full bg-[#08101e]/85 border border-cyan-500/25 focus:border-cyan-400 rounded-lg sm:rounded-xl pl-9 sm:pl-10 pr-10 py-2.5 sm:py-3 text-slate-100 placeholder:text-slate-600 font-mono text-xs sm:text-sm outline-none transition-all duration-200 focus:ring-1 focus:ring-cyan-400/40 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)] disabled:opacity-50"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-300 transition-colors p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || googleSubmitting || !password.trim()}
                className="w-full py-2.5 sm:py-3 px-4 rounded-lg sm:rounded-xl font-mono text-xs sm:text-sm font-bold tracking-wider text-cyan-100 uppercase bg-gradient-to-r from-blue-950 via-cyan-900/90 to-blue-950 hover:from-blue-900 hover:via-cyan-800 hover:to-blue-900 border border-cyan-400/50 hover:border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.35)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-cyan-300" />
                    <span>AUTHENTICATING…</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />
                    <span>Sign in with Credentials</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Security Notice */}
          <div className="relative mt-3.5 sm:mt-5 pt-2.5 sm:pt-3 border-t border-cyan-900/30 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-slate-400">
            <ShieldCheck className="w-3 h-3 text-cyan-400/80" />
            <span>Restricted access for authorized organizers</span>
          </div>
        </div>
      </motion.main>

      {/* ── FOOTER & ROLE SWITCHER ── */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative z-10 text-center pb-1 sm:pb-2 space-y-1 sm:space-y-1.5"
      >
        <p className="text-[9.5px] sm:text-[11px] font-mono tracking-[0.25em] sm:tracking-[0.35em] text-slate-400 uppercase font-semibold whitespace-nowrap">
          MAKE IT HAPPEN
        </p>
        <div className="flex items-center justify-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-mono text-slate-500">
          <Link
            to="/participant/login"
            className="hover:text-cyan-400 transition-colors tracking-wider"
          >
            Participant Login
          </Link>
          <span className="text-slate-700">•</span>
          <Link
            to="/judge/login"
            className="hover:text-cyan-400 transition-colors tracking-wider"
          >
            Judge Portal
          </Link>
        </div>
      </motion.footer>
    </div>
  );
}

