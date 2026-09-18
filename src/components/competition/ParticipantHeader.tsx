// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// ParticipantHeader — top competition header with branding,
// team info, timer, and connection status
// ============================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Activity, Zap } from 'lucide-react';
import { Timer } from './Timer';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
type ConnectionStatus = 'online' | 'offline' | 'unstable';

interface ParticipantHeaderProps {
  teamId: string;
  teamName: string;
  currentStrikeLabel?: string;
  currentStrikeSubLabel?: string;
  endsAt?: string | null;
  totalSeconds?: number;
  connectionStatus?: ConnectionStatus;
  onExpired?: () => void;
}

// ----------------------------------------------------------------
// Connection indicator
// ----------------------------------------------------------------
const CONNECTION_CONFIG: Record<
  ConnectionStatus,
  { icon: React.ReactNode; label: string; dot: string }
> = {
  online: {
    icon: <Wifi className="w-3.5 h-3.5" />,
    label: 'Online',
    dot: 'bg-green-400',
  },
  offline: {
    icon: <WifiOff className="w-3.5 h-3.5" />,
    label: 'Offline',
    dot: 'bg-red-400',
  },
  unstable: {
    icon: <Activity className="w-3.5 h-3.5" />,
    label: 'Unstable',
    dot: 'bg-yellow-400',
  },
};

const ConnectionIndicator: React.FC<{ status: ConnectionStatus }> = ({
  status,
}) => {
  const cfg = CONNECTION_CONFIG[status];
  const isPulsing = status === 'unstable';

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex items-center justify-center">
        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        {isPulsing && (
          <motion.div
            className={`absolute inset-0 rounded-full ${cfg.dot} opacity-60`}
            animate={{ scale: [1, 2], opacity: [0.6, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>
      <span className="text-[10px] text-slate-400 hidden sm:inline">
        {cfg.label}
      </span>
    </div>
  );
};

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------
export const ParticipantHeader: React.FC<ParticipantHeaderProps> = ({
  teamId,
  teamName,
  currentStrikeLabel,
  currentStrikeSubLabel,
  endsAt,
  totalSeconds = 0,
  connectionStatus = 'online',
  onExpired,
}) => {
  const hasTimer = !!endsAt && totalSeconds > 0;

  return (
    <header className="sticky top-0 z-50 w-full bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* ---- Main row ---- */}
        <div className="flex items-center gap-3 py-2 sm:py-3">
          {/* ---- LEFT: Branding ---- */}
          <div className="flex-shrink-0 min-w-0">
            <div className="flex items-center gap-2">
              {/* Zap icon */}
              <div className="w-7 h-7 rounded-md bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="leading-tight">
                <div className="text-[11px] font-black tracking-widest text-cyan-400 uppercase hidden xs:block"
                  style={{ textShadow: '0 0 10px rgba(34,211,238,0.5)' }}>
                  VIGYANTRA 2026
                </div>
                <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                  Code Relay
                </div>
              </div>
              {/* Round badge */}
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 uppercase">
                R2
              </span>
            </div>
          </div>

          {/* ---- CENTER: Team info ---- */}
          <div className="flex-1 flex flex-col items-center text-center min-w-0 px-2">
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span className="text-[10px] font-mono text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                {teamId}
              </span>
              <span className="text-sm font-black text-slate-100 truncate max-w-[140px] sm:max-w-[220px]">
                {teamName}
              </span>
            </div>

            {/* Strike label (shows on desktop center, hidden on very small) */}
            {(currentStrikeLabel || currentStrikeSubLabel) && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStrikeLabel}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 mt-0.5"
                >
                  {currentStrikeLabel && (
                    <span className="text-[9px] font-black tracking-widest text-cyan-400 uppercase">
                      {currentStrikeLabel}
                    </span>
                  )}
                  {currentStrikeLabel && currentStrikeSubLabel && (
                    <span className="text-slate-600 text-[9px]">·</span>
                  )}
                  {currentStrikeSubLabel && (
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                      {currentStrikeSubLabel}
                    </span>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* ---- RIGHT: Timer + connection ---- */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <ConnectionIndicator status={connectionStatus} />

            {hasTimer ? (
              <Timer
                endsAt={endsAt}
                totalSeconds={totalSeconds}
                onExpired={onExpired}
                className="scale-75 sm:scale-90 origin-center"
              />
            ) : (
              <div className="w-[90px] h-[90px] sm:w-[108px] sm:h-[108px] flex items-center justify-center">
                <span className="text-slate-600 text-xs font-mono">--:--</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ParticipantHeader;
