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
        className="relative z-10 text-center pt-2 sm:pt-4 w-full max-w-full overflow-hidden flex flex-col items-center"
      >
        {/* Event/Brand Identifier (Small) */}
        <p className="text-[11px] sm:text-xs font-mono tracking-[0.35em] uppercase text-slate-400 font-medium whitespace-nowrap">
          <span className="text-slate-200 font-semibold">VIGYANTRA</span>
          <span className="text-cyan-400 font-bold ml-1.5">2026</span>
        </p>

        {/* Main Hero Title (Large, Bold, Futuristic) */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-[0.12em] sm:tracking-[0.18em] uppercase leading-none my-2 sm:my-3 whitespace-nowrap flex items-center justify-center">
          <span className="text-white text-glow-white">CODE</span>
          <span className="text-cyan-400 text-glow-cyan ml-3 sm:ml-4">RELAY</span>
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
            <span>JUDGE ACCESS</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
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
          <form onSubmit={handleSubmit} className="relative space-y-3.5" noValidate>
            {/* Judge Account Select */}
            <div className="space-y-1">
              <label className="block text-[10px] font-mono tracking-[0.2em] text-slate-400 uppercase pl-0.5">
                Judge Account
              </label>
              <div className="relative group">
                <UserCheck className="w-4 h-4 text-cyan-500/70 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400 pointer-events-none" />
                <select
                  value={judgeId}
                  onChange={(e) => {
                    setJudgeId(e.target.value);
                    setError(null);
                  }}
                  disabled={isLoading}
                  className="w-full bg-[#08101e]/85 border border-cyan-500/25 focus:border-cyan-400 rounded-lg pl-10 pr-8 py-2.5 sm:py-3 text-slate-100 font-mono text-xs sm:text-sm outline-none transition-all duration-200 focus:ring-1 focus:ring-cyan-400/40 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)] appearance-none cursor-pointer disabled:opacity-50"
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
            <div className="space-y-1">
              <label className="block text-[10px] font-mono tracking-[0.2em] text-slate-400 uppercase pl-0.5">
                Judge Password
              </label>
              <div className="relative group">
                <Lock className="w-4 h-4 text-cyan-500/70 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-cyan-400" />
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

            {/* Primary Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || !password.trim()}
                className="w-full py-3 px-5 rounded-lg font-mono text-xs sm:text-sm font-bold tracking-widest text-cyan-100 uppercase bg-gradient-to-r from-blue-950 via-cyan-900/90 to-blue-950 hover:from-blue-900 hover:via-cyan-800 hover:to-blue-900 border border-cyan-400/50 hover:border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.35)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                    <span>AUTHENTICATING…</span>
                  </>
                ) : (
                  <>
                    <span>AUTHENTICATE & ENTER</span>
                    <ArrowRight className="w-4 h-4 text-cyan-300" />
                  </>
                )}
              </button>
            </div>
          </form>
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

