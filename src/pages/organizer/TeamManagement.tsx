import { useState } from 'react';
import { Plus, Upload, Edit2, Trash2, Search, Wifi, WifiOff } from 'lucide-react';
import OrganizerLayout from '../../components/layout/OrganizerLayout';
import { MOCK_TEAMS } from '../../data/mock-teams';
import type { Team } from '../../types/competition';

const MOCK_CONNECTION: Record<string, 'connected' | 'offline'> = {
  'CRL-0000': 'connected',
  'CRL-0001': 'connected',
  'CRL-0002': 'offline',
  'CRL-0003': 'connected',
  'CRL-0004': 'connected',
};

const EMPTY_FORM: Omit<Team, 'members'> & { m1: string; m2: string; m3: string } = {
  teamId: '', teamName: '', accessCode: '', status: 'active', m1: '', m2: '', m3: '',
};

export default function TeamManagement() {
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filtered = teams.filter(
    (t) => t.teamId.toLowerCase().includes(search.toLowerCase()) || t.teamName.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm(EMPTY_FORM); setEditTarget(null); setShowModal(true); };
  const openEdit = (team: Team) => {
    setForm({ teamId: team.teamId, teamName: team.teamName, accessCode: team.accessCode, status: team.status, m1: team.members[0].name, m2: team.members[1].name, m3: team.members[2].name });
    setEditTarget(team.teamId); setShowModal(true);
  };

  const handleSave = () => {
    if (!form.teamId || !form.teamName) return;
    const built: Team = {
      teamId: form.teamId, teamName: form.teamName, accessCode: form.accessCode, status: form.status,
      members: [{ index: 1, name: form.m1 || 'Member 1' }, { index: 2, name: form.m2 || 'Member 2' }, { index: 3, name: form.m3 || 'Member 3' }],
    };
    if (editTarget) setTeams((p) => p.map((t) => t.teamId === editTarget ? built : t));
    else setTeams((p) => [...p, built]);
    setShowModal(false);
    showToast(editTarget ? 'Team updated.' : 'Team added.');
  };

  const handleDelete = (teamId: string) => { setTeams((p) => p.filter((t) => t.teamId !== teamId)); setDeleteTarget(null); showToast('Team deleted.'); };

  return (
    <OrganizerLayout>
      <div className="space-y-6">
        {/* Toast */}
        {toast && <div className="fixed top-4 right-4 z-50 bg-green-900/90 border border-green-500/50 text-green-300 px-4 py-2 rounded-lg text-sm font-mono shadow-lg">{toast}</div>}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div><h1 className="text-white font-black text-2xl tracking-wide">TEAM MANAGEMENT</h1><p className="text-slate-500 text-sm font-mono mt-1">{teams.length} teams registered</p></div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => showToast('CSV import will be available after Firebase integration.')} className="btn-ghost flex items-center gap-2 text-sm"><Upload className="w-4 h-4" /> Import CSV</button>
            <button onClick={() => showToast('Spreadsheet import will be available after Firebase integration.')} className="btn-ghost flex items-center gap-2 text-sm"><Upload className="w-4 h-4" /> Spreadsheet</button>
            <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> Add Team</button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teams…" className="w-full pl-9 pr-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-slate-300 text-sm font-mono placeholder-slate-600 outline-none focus:border-cyan-600 transition-colors" />
        </div>

        {/* Table */}
        <div className="card-dark overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-slate-500 font-mono text-xs uppercase tracking-wider">
                  {['Team ID', 'Team Name', 'Member 1', 'Member 2', 'Member 3', 'Status', 'Connection', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((team, i) => {
                  const conn = MOCK_CONNECTION[team.teamId] ?? 'offline';
                  return (
                    <tr key={team.teamId} className={`border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors ${i % 2 === 0 ? '' : 'bg-dark-800/20'}`}>
                      <td className="px-4 py-3 font-mono font-bold text-cyan-400">{team.teamId}</td>
                      <td className="px-4 py-3 text-white font-medium">{team.teamName}</td>
                      {team.members.map((m) => <td key={m.index} className="px-4 py-3 text-slate-300 whitespace-nowrap">{m.name}</td>)}
                      <td className="px-4 py-3"><span className={`text-xs font-mono px-2 py-0.5 rounded border capitalize ${team.status === 'active' ? 'text-green-400 border-green-800/50 bg-green-900/10' : 'text-red-400 border-red-800/50 bg-red-900/10'}`}>{team.status}</span></td>
                      <td className="px-4 py-3"><span className={`flex items-center gap-1.5 text-xs font-mono ${conn === 'connected' ? 'text-green-400' : 'text-slate-500'}`}>{conn === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}{conn}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(team)} className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors" aria-label="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeleteTarget(team.teamId)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors" aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-600 font-mono">No teams found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-white font-bold text-lg">{editTarget ? 'Edit Team' : 'Add Team'}</h2>
            {[['Team ID', 'teamId'], ['Team Name', 'teamName'], ['Access Code', 'accessCode'], ['Member 1', 'm1'], ['Member 2', 'm2'], ['Member 3', 'm3']].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1 block">{label}</label>
                <input value={(form as Record<string, string>)[key] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-300 text-sm font-mono outline-none focus:border-cyan-600 transition-colors" />
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} className="btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 border border-red-800/50 rounded-xl w-full max-w-sm p-6 space-y-4 text-center">
            <Trash2 className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-white font-bold">Delete team <span className="text-red-400">{deleteTarget}</span>?</p>
            <p className="text-slate-500 text-sm font-mono">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </OrganizerLayout>
  );
}
