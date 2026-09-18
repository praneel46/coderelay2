import { Lock, Zap } from 'lucide-react';

interface StrikeHeaderProps {
  strikeNumber: 1 | 2 | 3;
  label: string;
  subLabel: string;
  activeMembers: (1 | 2 | 3)[];
  members: { index: 1 | 2 | 3; name: string }[];
  isLocked?: boolean;
}

const STRIKE_COLORS: Record<number, { accent: string; glow: string; border: string }> = {
  1: { accent: 'text-cyan-400', glow: '0 0 24px rgba(34,211,238,0.5)', border: 'border-cyan-800/50' },
  2: { accent: 'text-indigo-400', glow: '0 0 24px rgba(129,140,248,0.5)', border: 'border-indigo-800/50' },
  3: { accent: 'text-purple-400', glow: '0 0 24px rgba(192,132,252,0.5)', border: 'border-purple-800/50' },
};

export default function StrikeHeader({ strikeNumber, label, subLabel, activeMembers, members, isLocked }: StrikeHeaderProps) {
  const colors = STRIKE_COLORS[strikeNumber];

  return (
    <div className={`bg-dark-800/60 border-b ${colors.border} px-4 sm:px-6 py-4`}>
      <div className="max-w-5xl mx-auto">
        {isLocked && (
          <div className="mb-3 flex items-center gap-2 bg-red-900/30 border border-red-500/50 rounded-lg px-4 py-2">
            <Lock className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-400 text-sm font-mono font-bold uppercase tracking-widest">
              Strike Locked — Submissions Closed
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Zap className={`w-4 h-4 ${colors.accent}`} />
                <span className={`font-black text-lg tracking-widest ${colors.accent}`} style={{ textShadow: colors.glow }}>
                  {label}
                </span>
                <span className="text-slate-400 font-bold text-sm tracking-widest">—</span>
                <span className="text-white font-bold text-lg tracking-widest">{subLabel}</span>
              </div>
              <p className="text-slate-500 text-xs font-mono">
                {activeMembers.length === 1
                  ? 'Member 1 active'
                  : activeMembers.length === 2
                  ? 'Members 1 + 2 active'
                  : 'Full team — all members active'}
              </p>
            </div>
          </div>

          {/* Compact relay status */}
          <div className="flex items-center gap-3">
            {([1, 2, 3] as const).map((idx) => {
              const member = members.find((m) => m.index === idx);
              const isActive = activeMembers.includes(idx);
              return (
                <div key={idx} className="flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full border ${
                      isActive
                        ? `bg-cyan-400 border-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.7)]`
                        : 'bg-transparent border-slate-600'
                    }`}
                  />
                  <span className={`text-xs font-mono ${isActive ? 'text-cyan-300' : 'text-slate-600'}`}>
                    M{idx}
                    {member && <span className="hidden sm:inline"> · {member.name.split(' ')[0]}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
