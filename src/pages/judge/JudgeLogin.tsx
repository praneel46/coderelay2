// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Judge Login Page — Cinematic Glassmorphism Redesign
// Evaluation Console Authentication
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, Lock, UserCheck, ArrowRight, AlertCircle, Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MOCK_JUDGES } from '../../data/mock-judges';
import { db } from '../../firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';

export default function JudgeLogin() {
  const navigate = useNavigate();
  const { loginAsJudge, user } = useAuth();
  const [judgeList, setJudgeList] = useState<{ judgeId: string; name: string; email: string }[]>(MOCK_JUDGES);
  const [judgeId, setJudgeId] = useState('J001');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Subscribe to real-time judges from Firestore
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'judges'), (snapshot) => {
        if (!snapshot.empty) {
          const fetched = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              judgeId: data.judgeId || d.id,
              name: data.name || `Judge ${d.id}`,
              email: data.email || `${d.id.toLowerCase()}@vigyantra.internal`,
            };
          });
          fetched.sort((a, b) => a.judgeId.localeCompare(b.judgeId));
          setJudgeList(fetched);
          if (fetched.length > 0) {
            setJudgeId((prev) => (fetched.some((j) => j.judgeId === prev) ? prev : fetched[0].judgeId));
          }
        }
      });
      return () => unsub();
    } catch {
      // fallback to MOCK_JUDGES
    }
  }, []);

  // If already logged in as judge, redirect
  useEffect(() => {
    if (user?.role === 'judge') {
      navigate('/judge/teams', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your judge password.');
      return;
    }
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
          JUDGE PORTAL
        </p>
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5 text-[8.5px] sm:text-[10px] font-mono tracking-[0.12em] sm:tracking-[0.2em] text-slate-400 uppercase whitespace-nowrap">
          <span>EVALUATE</span>
          <span className="text-cyan-400">•</span>
          <span>ANALYZE</span>
          <span className="text-cyan-400">•</span>
          <span>SCORE</span>
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
              <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
            </div>
          </div>

          {/* Role & Titles */}
          <div className="relative text-center mb-4 sm:mb-5">
            <p className="text-[10px] sm:text-[11px] font-mono tracking-[0.2em] sm:tracking-[0.25em] text-cyan-400 font-semibold uppercase mb-0.5 whitespace-nowrap">
              JUDGE ACCESS
            </p>
            <h2 className="text-xl sm:text-2xl font-black tracking-wide text-white uppercase text-glow-white mb-0.5 whitespace-nowrap">
              JUDGE ACCESS
            </h2>
            <p className="text-[9.5px] sm:text-[10.5px] font-mono tracking-[0.15em] sm:tracking-[0.2em] text-slate-300 uppercase font-semibold mb-1 sm:mb-1.5 whitespace-nowrap">
              EVALUATE • ANALYZE • SCORE
            </p>
            <p className="text-slate-400 text-[11px] sm:text-xs font-sans leading-snug max-w-[280px] sm:max-w-[320px] mx-auto">
              Sign in to view assigned teams and submit evaluations.
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
            {/* Judge Account Select */}
            <div className="space-y-0.5 sm:space-y-1">
              <label className="block text-[9.5px] sm:text-[10px] font-mono tracking-[0.15em] text-slate-400 uppercase pl-1">
                Judge Account
              </label>
              <div className="relative group">
                <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500/70 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400 pointer-events-none" />
                <select
                  value={judgeId}
                  onChange={(e) => {
                    setJudgeId(e.target.value);
                    setError(null);
                  }}
                  disabled={isLoading}
                  className="w-full bg-[#08101e]/85 border border-cyan-500/25 focus:border-cyan-400 rounded-lg sm:rounded-xl pl-9 sm:pl-10 pr-7 sm:pr-8 py-2.5 sm:py-3 text-slate-100 font-mono text-xs sm:text-sm outline-none transition-all duration-200 focus:ring-1 focus:ring-cyan-400/40 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)] appearance-none cursor-pointer disabled:opacity-50"
                >
                  {judgeList.map((j) => (
                    <option key={j.judgeId} value={j.judgeId} className="bg-dark-900 text-slate-200 py-1.5">
                      {j.judgeId} — {j.name} ({j.email})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-0.5 sm:space-y-1">
              <label className="block text-[9.5px] sm:text-[10px] font-mono tracking-[0.15em] text-slate-400 uppercase pl-1">
                Judge Password
              </label>
              <div className="relative group">
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500/70 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter judge account password"
                  autoComplete="current-password"
                  disabled={isLoading}
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

            {/* Primary Action Button */}
            <div className="pt-1.5 sm:pt-2">
              <button
                type="submit"
                disabled={isLoading || !password.trim()}
                className="w-full py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-lg sm:rounded-xl font-mono text-xs sm:text-sm font-bold tracking-wider sm:tracking-widest text-cyan-100 uppercase bg-gradient-to-r from-blue-950 via-cyan-900/90 to-blue-950 hover:from-blue-900 hover:via-cyan-800 hover:to-blue-900 border border-cyan-400/50 hover:border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.35)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-cyan-300" />
                    <span>AUTHENTICATING…</span>
                  </>
                ) : (
                  <>
                    <span>AUTHENTICATE & ENTER</span>
                    <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="relative mt-3.5 sm:mt-5 pt-2.5 sm:pt-3 border-t border-cyan-900/30 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-slate-400">
            <Shield className="w-3 h-3 text-cyan-400/80" />
            <span>Authorized judges only</span>
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
          FAIR CODE • STRONGER MINDS
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
            to="/organizer/login"
            className="hover:text-cyan-400 transition-colors tracking-wider"
          >
            Organizer Access
          </Link>
        </div>
      </motion.footer>
    </div>
  );
}

