import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Eye, Lock, Monitor, Smartphone, Laptop } from 'lucide-react';
import OrganizerLayout from '../../components/layout/OrganizerLayout';
import { MOCK_TEAMS } from '../../data/mock-teams';
import { useCompetition } from '../../context/CompetitionContext';

const MOCK_DEVICE: Record<string, { type: string; icon: React.ElementType }> = {
  'CRL-0000': { type: 'Desktop', icon: Monitor },
  'CRL-0001': { type: 'Laptop', icon: Laptop },
  'CRL-0002': { type: 'Desktop', icon: Monitor },
  'CRL-0003': { type: 'Laptop', icon: Laptop },
  'CRL-0004': { type: 'Mobile', icon: Smartphone },
};

const MOCK_CONNECTION_STATUS: Record<string, 'connected' | 'offline'> = {
  'CRL-0000': 'connected',
  'CRL-0001': 'connected',
  'CRL-0002': 'offline',
  'CRL-0003': 'connected',
  'CRL-0004': 'connected',
};

const MOCK_HEARTBEAT: Record<string, number> = {
  'CRL-0000': 5,
  'CRL-0001': 12,
  'CRL-0002': 0,
  'CRL-0003': 8,
  'CRL-0004': 3,
};

const MOCK_SUBMITTED_COUNT: Record<string, number> = {
  'CRL-0000': 2,
  'CRL-0001': 1,
  'CRL-0002': 0,
  'CRL-0003': 3,
  'CRL-0004': 0,
};

type Filter = 'all' | 'connected' | 'offline';

export default function LiveMonitoring() {
  const { competitionState } = useCompetition();
  const [filter, setFilter] = useState<Filter>('all');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const filtered = MOCK_TEAMS.filter((t) => {
    if (filter === 'connected') return MOCK_CONNECTION_STATUS[t.teamId] === 'connected';
    if (filter === 'offline') return MOCK_CONNECTION_STATUS[t.teamId] === 'offline';
    return true;
  });

  const currentStrikeLabel = competitionState.currentStrikeId
    ? competitionState.currentStrikeId.replace('strike', 'Strike ')
    : '—';

  return (
    <OrganizerLayout>
      <div className="space-y-6">
        {toast && <div className="fixed top-4 right-4 z-50 bg-green-900/90 border border-green-500/50 text-green-300 px-4 py-2 rounded-lg text-sm font-mono shadow-lg">{toast}</div>}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white font-black text-2xl tracking-wide">LIVE MONITORING</h1>
            <p className="text-slate-500 text-sm font-mono mt-1">Current strike: <span className="text-cyan-400">{currentStrikeLabel}</span></p>
          </div>
          <button onClick={() => showToast('Refreshing participant status…')} className="btn-ghost flex items-center gap-2 text-sm"><RefreshCw className="w-4 h-4" /> Refresh All</button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          {(['all', 'connected', 'offline'] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg font-mono text-xs uppercase tracking-wider transition-all border ${filter === f ? 'bg-cyan-900/30 border-cyan-600 text-cyan-300' : 'border-dark-600 text-slate-500 hover:text-slate-300'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Team cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((team) => {
            const conn = MOCK_CONNECTION_STATUS[team.teamId];
            const hb = MOCK_HEARTBEAT[team.teamId];
            const submitted = MOCK_SUBMITTED_COUNT[team.teamId];
            const device = MOCK_DEVICE[team.teamId] ?? { type: 'Desktop', icon: Monitor };
            const DevIcon = device.icon;
            const isOnline = conn === 'connected';
            return (
              <div key={team.teamId} className={`card-dark p-4 space-y-3 ${isOnline ? 'border-dark-600' : 'border-red-900/30'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-bold text-cyan-400 text-lg">{team.teamId}</span>
                    <p className="text-slate-300 text-sm font-medium">{team.teamName}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded border ${isOnline ? 'text-green-400 border-green-800/40 bg-green-900/10' : 'text-red-400 border-red-800/40 bg-red-900/10'}`}>
                    {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {conn}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-dark-900 rounded px-2 py-1.5">
                    <p className="text-slate-600 mb-0.5">Strike</p>
                    <p className="text-slate-300">{currentStrikeLabel}</p>
                  </div>
                  <div className="bg-dark-900 rounded px-2 py-1.5">
                    <p className="text-slate-600 mb-0.5">Submitted</p>
                    <p className="text-slate-300">{submitted} questions</p>
                  </div>
                  <div className="bg-dark-900 rounded px-2 py-1.5">
                    <p className="text-slate-600 mb-0.5">Device</p>
                    <p className="text-slate-300 flex items-center gap-1"><DevIcon className="w-3 h-3" />{device.type}</p>
                  </div>
                  <div className="bg-dark-900 rounded px-2 py-1.5">
                    <p className="text-slate-600 mb-0.5">Heartbeat</p>
                    <p className={isOnline ? 'text-green-400' : 'text-slate-600'}>{isOnline ? `${hb}s ago` : 'No signal'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => showToast(`Viewing team ${team.teamId} — detailed view not yet implemented.`)} className="btn-ghost text-xs flex items-center gap-1 py-1.5"><Eye className="w-3 h-3" /> View</button>
                  <button onClick={() => showToast(`Re-syncing ${team.teamId}…`)} className="btn-ghost text-xs flex items-center gap-1 py-1.5"><RefreshCw className="w-3 h-3" /> Re-sync</button>
                  <button onClick={() => showToast(`Lock will be available after Firebase integration.`)} className="text-xs font-mono text-slate-500 hover:text-red-400 border border-dark-600 hover:border-red-800/50 px-2 py-1.5 rounded transition-colors flex items-center gap-1"><Lock className="w-3 h-3" /> Lock</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </OrganizerLayout>
  );
}
