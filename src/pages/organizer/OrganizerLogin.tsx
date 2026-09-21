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

  // Client-side keyboard deterrence (F12, DevTools shortcuts, View Source)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

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
      className="min-h-screen w-full flex flex-col items-center justify-between px-4 py-4 sm:py-8 relative overflow-x-hidden bg-cover bg-[center_top] sm:bg-center bg-no-repeat selection:bg-cyan-500/30 selection:text-cyan-200"
      style={{
        backgroundImage: "url('/images/login-bg.jpg')",
        backgroundColor: '#020409',
      }}
    >
      {/* Atmospheric vignette overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-dark-950/60 via-dark-950/30 to-dark-950/80 pointer-events-none" />

      {/* ── TOP HERO HEADER ── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 text-center pt-2 sm:pt-4 w-full max-w-full overflow-hidden flex flex-col items-center mb-1 sm:mb-2"
      >
        {/* Event/Brand Identifier */}
        <div className="font-novarese flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base tracking-[0.22em] sm:tracking-[0.32em] uppercase text-slate-300 font-semibold whitespace-nowrap">
          <span className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">VIGYANTRA</span>
          <span className="text-cyan-400 font-bold drop-shadow-[0_0_12px_rgba(6,182,212,0.4)]">'26</span>
        </div>

        {/* Main Hero Title (NOVARESE, Reduced Balanced Size, Stylish, Futuristic) */}
        <h1 className="font-novarese text-2xl sm:text-4xl md:text-5xl font-bold italic tracking-[0.14em] sm:tracking-[0.2em] uppercase leading-tight mt-1.5 sm:mt-2.5 whitespace-nowrap flex items-center justify-center select-none transform -skew-x-3">
          <span className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.35)]">CODE</span>
          <span className="text-cyan-400 drop-shadow-[0_0_20px_rgba(6,182,212,0.55)] ml-2.5 sm:ml-3.5">RELAY</span>
        </h1>
      </motion.header>

      {/* ── MODERN FUTURISTIC HUD GRID PANEL ── */}
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[380px] sm:max-w-[420px] my-2 sm:my-3"
      >
        <div className="relative rounded-xl bg-[#040813]/65 backdrop-blur-xl border border-cyan-500/30 p-5 sm:p-7 shadow-[0_0_35px_-10px_rgba(6,182,212,0.2),0_20px_40px_-12px_rgba(0,0,0,0.85)] overflow-hidden">
          {/* Subtle Technical Grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(34, 211, 238, 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(34, 211, 238, 0.12) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          {/* Top Scan Line Highlight */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none" />

          {/* Precision HUD Corner Brackets */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

          {/* Panel HUD Header */}
          <div className="relative flex items-center justify-between pb-3 mb-4 border-b border-cyan-500/20 text-[10px] sm:text-[11px] font-mono tracking-[0.25em] text-cyan-400 font-semibold uppercase">
            <span>ORGANIZER ACCESS</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
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
          <div className="relative space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleSubmitting || submitting}
              className="w-full py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-lg bg-[#09111e]/90 hover:bg-[#0e182c] border border-cyan-500/30 hover:border-cyan-400/60 text-slate-100 font-mono text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 shadow-[0_0_15px_rgba(6,182,212,0.12)] hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="space-y-1">
                <label className="block text-[10px] font-mono tracking-[0.2em] text-slate-400 uppercase pl-0.5">
                  Organizer Key
                </label>
                <div className="relative group">
                  <Lock className="w-4 h-4 text-cyan-500/70 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400" />
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
                    className="w-full bg-[#08101e]/85 border border-cyan-500/25 focus:border-cyan-400 rounded-lg pl-10 pr-10 py-2.5 sm:py-3 text-slate-100 placeholder:text-slate-600 font-mono text-xs sm:text-sm outline-none transition-all duration-200 focus:ring-1 focus:ring-cyan-400/40 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)] disabled:opacity-50"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-300 transition-colors p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || googleSubmitting || !password.trim()}
                className="w-full py-2.5 sm:py-3 px-4 rounded-lg font-mono text-xs sm:text-sm font-bold tracking-wider text-cyan-100 uppercase bg-gradient-to-r from-blue-950 via-cyan-900/90 to-blue-950 hover:from-blue-900 hover:via-cyan-800 hover:to-blue-900 border border-cyan-400/50 hover:border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.35)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
        </div>
      </motion.main>

      {/* ── FOOTER & ROLE SWITCHER ── */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative z-10 text-center pb-2"
      >
        <div className="flex items-center justify-center gap-4 text-xs font-mono text-slate-500">
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

