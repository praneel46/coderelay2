// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Participant Login Page — Cinematic Glassmorphism Redesign
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Lock, ArrowRight, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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
          CODE RELAY
        </p>
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5 text-[8.5px] sm:text-[10px] font-mono tracking-[0.12em] sm:tracking-[0.2em] text-slate-400 uppercase whitespace-nowrap">
          <span>THINK</span>
          <span className="text-cyan-400">•</span>
          <span>CODE</span>
          <span className="text-cyan-400">•</span>
          <span>DEBUG</span>
          <span className="text-cyan-400">•</span>
          <span>RELAY</span>
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
          {/* Subtle internal architectural grid lines (reduced opacity on mobile) */}
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
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
            </div>
          </div>

          {/* Role & Titles */}
          <div className="relative text-center mb-4 sm:mb-5">
            <p className="text-[10px] sm:text-[11px] font-mono tracking-[0.2em] sm:tracking-[0.25em] text-cyan-400 font-semibold uppercase mb-0.5 whitespace-nowrap">
              PARTICIPANT ACCESS
            </p>
            <h2 className="text-xl sm:text-2xl font-black tracking-wide text-white uppercase text-glow-white mb-0.5 whitespace-nowrap">
              WELCOME, TEAM
            </h2>
            <p className="text-[9.5px] sm:text-[10.5px] font-mono tracking-[0.15em] sm:tracking-[0.2em] text-slate-300 uppercase font-semibold mb-1 sm:mb-1.5 whitespace-nowrap">
              YOUR JOURNEY STARTS HERE
            </p>
            <p className="text-slate-400 text-[11px] sm:text-xs font-sans leading-snug max-w-[280px] sm:max-w-[320px] mx-auto">
              Enter your Team ID and access code to enter the competition arena.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative mb-4 flex items-center gap-2 bg-red-950/50 border border-red-500/40 rounded-lg px-3 py-2 text-red-300 text-[11px] font-mono shadow-[0_0_15px_rgba(239,68,68,0.2)]"
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative space-y-3 sm:space-y-3.5" noValidate>
            {/* Team ID */}
            <div className="space-y-0.5 sm:space-y-1">
              <label className="block text-[9.5px] sm:text-[10px] font-mono tracking-[0.15em] text-slate-400 uppercase pl-1">
                Team ID
              </label>
              <div className="relative group">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500/70 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400" />
                <input
                  type="text"
                  value={teamId}
                  onChange={(e) => {
                    setTeamId(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="CRL-XXXX"
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={isSubmitting}
                  className="w-full bg-[#08101e]/85 border border-cyan-500/25 focus:border-cyan-400 rounded-lg sm:rounded-xl pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 text-slate-100 placeholder:text-slate-600 font-mono text-xs sm:text-sm outline-none transition-all duration-200 focus:ring-1 focus:ring-cyan-400/40 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Access Code */}
            <div className="space-y-0.5 sm:space-y-1">
              <label className="block text-[9.5px] sm:text-[10px] font-mono tracking-[0.15em] text-slate-400 uppercase pl-1">
                Access Code
              </label>
              <div className="relative group">
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500/70 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400" />
                <input
                  type={showCode ? 'text' : 'password'}
                  value={accessCode}
                  onChange={(e) => {
                    setAccessCode(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  spellCheck={false}
                  disabled={isSubmitting}
                  className="w-full bg-[#08101e]/85 border border-cyan-500/25 focus:border-cyan-400 rounded-lg sm:rounded-xl pl-9 sm:pl-10 pr-10 py-2.5 sm:py-3 text-slate-100 placeholder:text-slate-600 font-mono text-xs sm:text-sm outline-none transition-all duration-200 focus:ring-1 focus:ring-cyan-400/40 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)] disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCode((v) => !v)}
                  className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-300 transition-colors p-1"
                  aria-label={showCode ? 'Hide access code' : 'Show access code'}
                >
                  {showCode ? <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </button>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-1.5 sm:pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-lg sm:rounded-xl font-mono text-xs sm:text-sm font-bold tracking-wider sm:tracking-widest text-cyan-100 uppercase bg-gradient-to-r from-blue-950 via-cyan-900/90 to-blue-950 hover:from-blue-900 hover:via-cyan-800 hover:to-blue-900 border border-cyan-400/50 hover:border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.35)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-cyan-300" />
                    <span>ENTERING ARENA…</span>
                  </>
                ) : (
                  <>
                    <span>ENTER THE ARENA</span>
                    <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="relative mt-3.5 sm:mt-5 pt-2.5 sm:pt-3 border-t border-cyan-900/30 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-slate-400">
            <Lock className="w-3 h-3 text-cyan-400/80" />
            <span>Secure participant authentication</span>
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
          IDEAS MOVE BEYOND
        </p>
        <div className="flex items-center justify-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-mono text-slate-500">
          <Link
            to="/organizer/login"
            className="hover:text-cyan-400 transition-colors tracking-wider"
          >
            Organizer Access
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
