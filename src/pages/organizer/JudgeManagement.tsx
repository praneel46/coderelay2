import React, { useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Users } from 'lucide-react';
import OrganizerLayout from '../../components/layout/OrganizerLayout';
import { MOCK_JUDGES } from '../../data/mock-judges';
import type { Judge } from '../../types/judge';

export default function JudgeManagement() {
  const [judges, setJudges] = useState<Judge[]>(MOCK_JUDGES);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ judgeId: '', name: '', email: '', password: '' });
  const [toast, setToast] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const toggleActive = (judgeId: string) => {
    setJudges((p) => p.map((j) => j.judgeId === judgeId ? { ...j, active: !j.active } : j));
  };

  const handleAdd = () => {
    if (!form.judgeId || !form.name) return;
    const newJudge: Judge = { judgeId: form.judgeId, name: form.name, email: form.email, active: true, assignedTeamIds: [], pendingCount: 0, evaluatedCount: 0 };
    setJudges((p) => [...p, newJudge]);
    setShowModal(false);
    setForm({ judgeId: '', name: '', email: '', password: '' });
    showToast('Judge added.');
  };

  const handleDelete = (judgeId: string) => { setJudges((p) => p.filter((j) => j.judgeId !== judgeId)); setDeleteTarget(null); showToast('Judge removed.'); };

  return (
    <OrganizerLayout>
      <div className="space-y-6">
        {toast && <div className="fixed top-4 right-4 z-50 bg-green-900/90 border border-green-500/50 text-green-300 px-4 py-2 rounded-lg text-sm font-mono shadow-lg">{toast}</div>}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white font-black text-2xl tracking-wide">JUDGE MANAGEMENT</h1>
            <p className="text-slate-500 text-sm font-mono mt-1">{judges.filter((j) => j.active).length} active judges · {judges.length} total</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> Add Judge</button>
        </div>

        <div className="card-dark overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-slate-500 font-mono text-xs uppercase tracking-wider">
                  {['Judge ID', 'Name', 'Email', 'Status', 'Assigned Teams', 'Pending', 'Evaluated', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {judges.map((judge) => (
                  <tr key={judge.judgeId} className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-cyan-400">{judge.judgeId}</td>
                    <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{judge.name}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">{judge.email}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(judge.judgeId)} className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border transition-colors ${judge.active ? 'text-green-400 border-green-800/50 bg-green-900/10 hover:bg-green-900/20' : 'text-slate-500 border-dark-600 bg-dark-700 hover:bg-dark-600'}`}>
                        {judge.active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        {judge.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-600" />
                        <span className="text-slate-300 font-mono">{judge.assignedTeamIds.length}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-yellow-400">{judge.pendingCount}</td>
                    <td className="px-4 py-3 font-mono text-green-400">{judge.evaluatedCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => showToast('Team assignment will be available after Firebase integration.')} className="text-xs font-mono text-slate-400 hover:text-cyan-400 transition-colors border border-dark-600 hover:border-cyan-700 px-2 py-1 rounded">Assign Teams</button>
                        <button onClick={() => setDeleteTarget(judge.judgeId)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {judges.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-600 font-mono">No judges configured.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-dark p-4">
          <p className="text-slate-500 text-xs font-mono">
            <span className="text-cyan-400 font-semibold">Note:</span> Judge count is dynamic. Add as many judges as needed. Team assignment to judges will be configured in a later phase.
          </p>
        </div>
      </div>

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-white font-bold text-lg">Add Judge</h2>
            {[['Judge ID', 'judgeId'], ['Name', 'name'], ['Email', 'email'], ['Password', 'password']].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1 block">{label}</label>
                <input type={key === 'password' ? 'password' : 'text'} value={(form as Record<string, string>)[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-300 text-sm font-mono outline-none focus:border-cyan-600 transition-colors" />
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleAdd} className="btn-primary">Add Judge</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 border border-red-800/50 rounded-xl w-full max-w-sm p-6 space-y-4 text-center">
            <p className="text-white font-bold">Remove judge <span className="text-red-400">{deleteTarget}</span>?</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} className="btn-danger">Remove</button>
            </div>
          </div>
        </div>
      )}
    </OrganizerLayout>
  );
}
