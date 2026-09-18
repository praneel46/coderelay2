import React, { useState } from 'react';
import { ServerCog, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Shield, Database, Radio, Cpu, Network, FileCheck } from 'lucide-react';
import OrganizerLayout from '../../components/layout/OrganizerLayout';

interface SystemModuleStatus {
  id: string;
  name: string;
  category: string;
  icon: React.ElementType;
  status: 'CONNECTED' | 'WARNING' | 'ERROR';
  latency: string;
  uptime: string;
  details: string;
}

const SYSTEM_SERVICES: SystemModuleStatus[] = [
  {
    id: 'auth',
    name: 'Authentication Service',
    category: 'Security & Access',
    icon: Shield,
    status: 'CONNECTED',
    latency: '18ms',
    uptime: '99.98%',
    details: 'Session token validation & access verification active',
  },
  {
    id: 'db',
    name: 'Database Cluster',
    category: 'Persistence Engine',
    icon: Database,
    status: 'CONNECTED',
    latency: '24ms',
    uptime: '100%',
    details: 'Firestore replica pool synchronized with master',
  },
  {
    id: 'state',
    name: 'Competition State Engine',
    category: 'Event Orchestration',
    icon: Radio,
    status: 'CONNECTED',
    latency: '12ms',
    uptime: '99.95%',
    details: 'Authoritative timestamp clock broadcast running',
  },
  {
    id: 'submissions',
    name: 'Submissions Pipeline',
    category: 'Ingestion Layer',
    icon: FileCheck,
    status: 'CONNECTED',
    latency: '31ms',
    uptime: '100%',
    details: 'Lock enforcement & idempotency guard operational',
  },
  {
    id: 'participant-conn',
    name: 'Participant WebSockets',
    category: 'Live Gateway',
    icon: Network,
    status: 'WARNING',
    latency: '115ms',
    uptime: '98.8%',
    details: 'Team CR003 heartbeat delayed; 4 of 5 teams nominal',
  },
  {
    id: 'judge-conn',
    name: 'Judge Connection Pool',
    category: 'Live Gateway',
    icon: Cpu,
    status: 'CONNECTED',
    latency: '22ms',
    uptime: '100%',
    details: 'All active evaluation terminals responsive',
  },
];

export default function SystemStatus() {
  const [services] = useState<SystemModuleStatus[]>(SYSTEM_SERVICES);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState(new Date().toLocaleTimeString());

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastChecked(new Date().toLocaleTimeString());
      setIsRefreshing(false);
    }, 600);
  };

  const getStatusBadge = (status: SystemModuleStatus['status']) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-green-900/20 border border-green-500/40 text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            CONNECTED
          </span>
        );
      case 'WARNING':
        return (
          <span className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-yellow-900/20 border border-yellow-500/40 text-yellow-400 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            WARNING
          </span>
        );
      case 'ERROR':
        return (
          <span className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-red-900/20 border border-red-500/40 text-red-400">
            <XCircle className="w-3.5 h-3.5" />
            ERROR
          </span>
        );
    }
  };

  return (
    <OrganizerLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-white font-black text-2xl tracking-wide flex items-center gap-3">
              <ServerCog className="w-6 h-6 text-indigo-400" />
              SYSTEM STATUS & TELEMETRY
            </h1>
            <p className="text-slate-500 text-sm font-mono mt-1">
              Infrastructure health, real-time node health, and latency monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-500 hidden sm:inline">
              Last checked: {lastChecked}
            </span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-ghost text-sm flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Refresh Telemetry</span>
            </button>
          </div>
        </div>

        {/* Global summary card */}
        <div className="card-dark p-5 border border-dark-700 flex items-center justify-between flex-wrap gap-4 bg-dark-900/50">
          <div className="flex items-center gap-4">
            <div className="w-3.5 h-3.5 rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.7)] animate-pulse" />
            <div>
              <h2 className="text-white font-bold text-base">Competition Infrastructure Operational</h2>
              <p className="text-slate-400 text-xs font-mono mt-0.5">
                5 of 6 systems optimal · 1 service in degraded latency notice
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 font-mono text-xs text-slate-400">
            <div>
              <span className="text-slate-600 block">Avg Ingestion Latency</span>
              <span className="text-indigo-300 font-bold text-sm">24 ms</span>
            </div>
            <div>
              <span className="text-slate-600 block">Clock Sync Drift</span>
              <span className="text-green-400 font-bold text-sm">&lt; 3 ms</span>
            </div>
            <div>
              <span className="text-slate-600 block">Round 2 Uptime</span>
              <span className="text-slate-200 font-bold text-sm">99.98%</span>
            </div>
          </div>
        </div>

        {/* Status cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((svc) => {
            const Icon = svc.icon;
            return (
              <div
                key={svc.id}
                className="card-dark p-5 border border-dark-700/80 rounded-xl space-y-4 hover:border-dark-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-dark-800 border border-dark-600 flex items-center justify-center text-indigo-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-sm">{svc.name}</h3>
                      <p className="text-slate-500 text-[11px] font-mono">{svc.category}</p>
                    </div>
                  </div>
                  <div>{getStatusBadge(svc.status)}</div>
                </div>

                <p className="text-slate-300 text-xs leading-relaxed bg-dark-900/60 p-3 rounded-lg border border-dark-700 font-mono">
                  {svc.details}
                </p>

                <div className="flex items-center justify-between text-xs font-mono pt-1 text-slate-400 border-t border-dark-700/60">
                  <span>Latency: <strong className="text-slate-200">{svc.latency}</strong></span>
                  <span>Uptime: <strong className="text-green-400">{svc.uptime}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </OrganizerLayout>
  );
}
