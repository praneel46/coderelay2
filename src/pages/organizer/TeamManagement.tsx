// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Organizer Team Management & Dynamic Round 2 Qualification
// ============================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Upload,
  Edit2,
  Trash2,
  Search,
  Wifi,
  WifiOff,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Users,
  Shield,
  ArrowRight,
  RefreshCw,
  FileText,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import OrganizerLayout from '../../components/layout/OrganizerLayout';
import { MOCK_TEAMS } from '../../data/mock-teams';
import type { Team, TeamStatus } from '../../types/competition';
import { db } from '../../firebase/config';
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  query,
  orderBy,
  addDoc,
} from 'firebase/firestore';

const MOCK_CONNECTION: Record<string, 'connected' | 'offline'> = {
  'CRL-0000': 'connected',
  'CRL-0001': 'connected',
  'CRL-0002': 'offline',
  'CRL-0003': 'connected',
  'CRL-0004': 'connected',
};

const EMPTY_FORM: Omit<Team, 'members'> & { m1: string; m2: string; m3: string } = {
  teamId: '',
  teamName: '',
  accessCode: '',
  status: 'QUALIFIED_FOR_ROUND_2',
  m1: '',
  m2: '',
  m3: '',
};

type ViewTab = 'all' | 'qualified';
type FilterStatus = 'ALL' | TeamStatus;

interface ParsedQualifierRow {
  rowNumber: number;
  teamId: string;
  teamName: string;
  accessCode: string; // kept strictly in transient memory during validation
  m1: string;
  m2: string;
  m3: string;
  isValid: boolean;
  errors: string[];
  isDuplicateIdInFile?: boolean;
  isDuplicateCodeInFile?: boolean;
  existingStatus?: TeamStatus | null;
  conflictReason?: string | null;
}

export default function TeamManagement() {
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS);
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [search, setSearch] = useState('');

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [sessionAccessCodes, setSessionAccessCodes] = useState<Map<string, string>>(new Map());
  const [singleTeamHandoff, setSingleTeamHandoff] = useState<{ teamId: string; accessCode: string } | null>(null);
  const [copiedSingleHandoff, setCopiedSingleHandoff] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Import Workflow State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStage, setImportStage] = useState<'SELECT' | 'PREVIEW' | 'IMPORTING' | 'HANDOFF'>('SELECT');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedQualifierRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [handoffCount, setHandoffCount] = useState<number>(0);
  const [copiedHandoff, setCopiedHandoff] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Real-time Firestore subscription for teams
  useEffect(() => {
    try {
      const q = query(collection(db, 'teams'), orderBy('teamId', 'asc'));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Team[] = snapshot.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                teamId: d.teamId || docSnap.id,
                teamName: d.teamName || `Team ${docSnap.id}`,
                accessCode: '••••••••',
                status: d.status || 'QUALIFIED_FOR_ROUND_2',
                round2Eligible: d.round2Eligible ?? true,
                members: [
                  { index: 1, name: d.member1?.name || d.members?.member1 || 'Member 1' },
                  { index: 2, name: d.member2?.name || d.members?.member2 || 'Member 2' },
                  { index: 3, name: d.member3?.name || d.members?.member3 || 'Member 3' },
                ],
              };
            });
            setTeams(list);
          }
        },
        (err) => {
          console.warn('[TeamManagement] Firestore subscription fallback to mock:', err);
        }
      );
      return () => unsub();
    } catch (e) {
      console.warn('[TeamManagement] Error initiating teams subscription:', e);
    }
  }, []);

  // Top dynamic summary counts (calculated dynamically, no fixed limits)
  const summaryCounts = useMemo(() => {
    const total = teams.length;
    const qualified = teams.filter(
      (t) => t.status === 'QUALIFIED_FOR_ROUND_2' || t.status === 'READY' || t.status === 'ACTIVE' || t.status === 'active' || t.status === 'COMPLETED'
    ).length;
    const ready = teams.filter((t) => t.status === 'READY').length;
    const active = teams.filter((t) => t.status === 'ACTIVE' || t.status === 'active').length;
    const completed = teams.filter((t) => t.status === 'COMPLETED').length;
    const disqualified = teams.filter((t) => t.status === 'DISQUALIFIED' || t.status === 'disqualified').length;
    return { total, qualified, ready, active, completed, disqualified };
  }, [teams]);

  // CSV Validation & Parsing Engine
  const processCsvContent = (content: string, fileName: string) => {
    setSelectedFileName(fileName);
    setImportErrors([]);

    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setImportErrors(['The selected file is empty or missing data rows. Must contain a header and at least 1 team row.']);
      setParsedRows([]);
      setImportStage('PREVIEW');
      return;
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const requiredCols = ['teamid', 'teamname', 'accesscode', 'member1', 'member2', 'member3'];
    const missingCols = requiredCols.filter((col) => !header.includes(col));

    if (missingCols.length > 0) {
      setImportErrors([
        `Invalid CSV header columns. Missing required columns: ${missingCols.join(', ')}.`,
        `Expected format: teamId,teamName,accessCode,member1,member2,member3`,
      ]);
      setParsedRows([]);
      setImportStage('PREVIEW');
      return;
    }

    const colIndex = {
      teamId: header.indexOf('teamid'),
      teamName: header.indexOf('teamname'),
      accessCode: header.indexOf('accesscode'),
      member1: header.indexOf('member1'),
      member2: header.indexOf('member2'),
      member3: header.indexOf('member3'),
    };

    const dataRows = lines.slice(1);
    const parsed: ParsedQualifierRow[] = [];
    const seenIds = new Map<string, number>();
    const seenCodes = new Map<string, number>();
    const existingTeamMap = new Map(teams.map((t) => [t.teamId.toUpperCase(), t]));

    dataRows.forEach((row, idx) => {
      const rowNumber = idx + 2;
      const parts = row.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));

      const rawTeamId = parts[colIndex.teamId] || '';
      const teamId = rawTeamId.trim().toUpperCase();
      const teamName = (parts[colIndex.teamName] || '').trim();
      const accessCode = (parts[colIndex.accessCode] || '').trim();
      const m1 = (parts[colIndex.member1] || '').trim();
      const m2 = (parts[colIndex.member2] || '').trim();
      const m3 = (parts[colIndex.member3] || '').trim();

      const errors: string[] = [];

      // 1. Team ID validation
      if (!teamId) {
        errors.push('Missing teamId.');
      } else if (!/^CRL-\d{4}$/.test(teamId)) {
        errors.push(`Invalid Team ID format "${teamId}". Must be exactly CRL-XXXX (e.g. CRL-0001).`);
      }

      // 2. Team Name validation
      if (!teamName) {
        errors.push('Missing teamName.');
      }

      // 3. Access Code validation
      if (!accessCode) {
        errors.push('Missing accessCode.');
      } else if (accessCode.length < 6) {
        errors.push('Access code must be at least 6 characters long (Firebase Auth minimum).');
      }

      // 4. Member validation (exactly 3 required)
      if (!m1) errors.push('Missing member1.');
      if (!m2) errors.push('Missing member2.');
      if (!m3) errors.push('Missing member3.');

      // 5. Intra-file duplicate check
      let isDuplicateIdInFile = false;
      let isDuplicateCodeInFile = false;

      if (teamId) {
        if (seenIds.has(teamId)) {
          errors.push(`Duplicate Team ID "${teamId}" (also on row ${seenIds.get(teamId)}).`);
          isDuplicateIdInFile = true;
        } else {
          seenIds.set(teamId, rowNumber);
        }
      }

      if (accessCode) {
        if (seenCodes.has(accessCode)) {
          errors.push(`Duplicate Access Code detected (also on row ${seenCodes.get(accessCode)}). Each team must have a unique access code.`);
          isDuplicateCodeInFile = true;
        } else {
          seenCodes.set(accessCode, rowNumber);
        }
      }

      // 6. Existing team lifecycle conflict check
      let conflictReason: string | null = null;
      let existingStatus: TeamStatus | null = null;

      if (teamId && existingTeamMap.has(teamId)) {
        const existing = existingTeamMap.get(teamId)!;
        existingStatus = existing.status;
        if (['READY', 'ACTIVE', 'active', 'COMPLETED', 'DISQUALIFIED', 'disqualified'].includes(existing.status)) {
          conflictReason = `Team ${teamId} is already in state "${existing.status}". Cannot reset or downgrade an in-progress or provisioned team.`;
          errors.push(conflictReason);
        }
      }

      parsed.push({
        rowNumber,
        teamId,
        teamName,
        accessCode,
        m1,
        m2,
        m3,
        isValid: errors.length === 0,
        errors,
        isDuplicateIdInFile,
        isDuplicateCodeInFile,
        existingStatus,
        conflictReason,
      });
    });

    setParsedRows(parsed);
    setImportStage('PREVIEW');
  };

  // CSV file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      processCsvContent(text, file.name);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Metrics for Preview
  const previewMetrics = useMemo(() => {
    const totalRows = parsedRows.length;
    const validTeams = parsedRows.filter((r) => r.isValid);
    const invalidRows = parsedRows.filter((r) => !r.isValid);
    const duplicateIds = parsedRows.filter((r) => r.isDuplicateIdInFile);
    const duplicateCodes = parsedRows.filter((r) => r.isDuplicateCodeInFile);
    const conflicts = parsedRows.filter((r) => r.conflictReason);
    return {
      totalRows,
      validCount: validTeams.length,
      invalidCount: invalidRows.length,
      duplicateIdCount: duplicateIds.length,
      duplicateCodeCount: duplicateCodes.length,
      conflictCount: conflicts.length,
      validTeams,
      invalidRows,
    };
  }, [parsedRows]);

  // Execute Confirmation & Firestore Import
  const handleConfirmImport = async () => {
    if (previewMetrics.invalidCount > 0 || previewMetrics.validCount === 0) {
      showToast('Cannot import: CSV contains invalid rows or conflicts.');
      return;
    }

    setIsSubmittingImport(true);
    setImportStage('IMPORTING');

    try {
      const valid = previewMetrics.validTeams;

      // 1. Write public metadata to Firestore /teams (NEVER write accessCode!)
      const writePromises = valid.map((team) => {
        const docRef = doc(db, 'teams', team.teamId);
        return setDoc(
          docRef,
          {
            teamId: team.teamId,
            teamName: team.teamName,
            members: {
              member1: team.m1,
              member2: team.m2,
              member3: team.m3,
            },
            member1: { name: team.m1, role: 'M1' },
            member2: { name: team.m2, role: 'M2' },
            member3: { name: team.m3, role: 'M3' },
            status: 'QUALIFIED_FOR_ROUND_2',
            round2Eligible: true,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });

      await Promise.all(writePromises);

      // 2. Append immutable audit log event
      try {
        await addDoc(collection(db, 'auditLogs'), {
          logId: `log_${Date.now()}`,
          action: 'ROUND_2_QUALIFICATION_IMPORT',
          role: 'organizer',
          timestamp: new Date().toISOString(),
          teamsCount: valid.length,
          teamIds: valid.map((t) => t.teamId),
          fileName: selectedFileName,
        });
      } catch (auditErr) {
        console.warn('Audit log write notice:', auditErr);
      }

      setHandoffCount(valid.length);
      // Clear sensitive in-memory accessCode state immediately
      setParsedRows([]);
      setImportStage('HANDOFF');
      showToast(`✓ Successfully qualified ${valid.length} teams for Round 2!`);
    } catch (err: any) {
      console.error('[TeamManagement] Qualification import error:', err);
      showToast(`Import failed: ${err.message}`);
      setImportStage('PREVIEW');
    } finally {
      setIsSubmittingImport(false);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportStage('SELECT');
    setParsedRows([]);
    setImportErrors([]);
    setSelectedFileName('');
  };

  // Filtered teams for display
  const filteredTeams = useMemo(() => {
    let list = teams;

    // Filter by tab
    if (activeTab === 'qualified') {
      list = list.filter(
        (t) =>
          t.round2Eligible === true ||
          t.status === 'QUALIFIED_FOR_ROUND_2' ||
          t.status === 'READY' ||
          t.status === 'ACTIVE' ||
          t.status === 'active' ||
          t.status === 'COMPLETED'
      );
    }

    // Filter by status chip
    if (statusFilter !== 'ALL') {
      list = list.filter((t) => t.status === statusFilter);
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) => t.teamId.toLowerCase().includes(q) || t.teamName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [teams, activeTab, statusFilter, search]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditTarget(null);
    setShowAddEditModal(true);
  };

  const openEdit = (team: Team) => {
    setFormError(null);
    setForm({
      teamId: team.teamId,
      teamName: team.teamName,
      accessCode: '',
      status: team.status,
      m1: team.members[0]?.name || '',
      m2: team.members[1]?.name || '',
      m3: team.members[2]?.name || '',
    });
    setEditTarget(team.teamId);
    setShowAddEditModal(true);
  };

  const handleSave = async () => {
    setFormError(null);
    const normalizedId = form.teamId.trim().toUpperCase();

    // 1. Validate Team ID
    if (!normalizedId) {
      setFormError('Team ID is required.');
      return;
    }
    if (!/^CRL-\d{4}$/.test(normalizedId)) {
      setFormError(`Invalid Team ID "${normalizedId}". Expected format: CRL-XXXX (e.g. CRL-0001).`);
      return;
    }

    // 2. Duplicate Team ID check (when creating new)
    if (!editTarget && teams.some((t) => t.teamId.toUpperCase() === normalizedId)) {
      setFormError(`Team ID "${normalizedId}" already exists in the roster.`);
      return;
    }

    // 3. Validate Team Name
    if (!form.teamName.trim()) {
      setFormError('Team Name is required.');
      return;
    }

    // 4. Exactly 3 members required
    if (!form.m1.trim() || !form.m2.trim() || !form.m3.trim()) {
      setFormError('All 3 team members (Member 1, Member 2, Member 3) are required.');
      return;
    }

    // 5. Access code validation (when creating new)
    if (!editTarget) {
      if (!form.accessCode.trim()) {
        setFormError('Access code is required for offline provisioning.');
        return;
      }
      if (form.accessCode.trim().length < 6) {
        setFormError('Access code must be at least 6 characters long (Firebase Auth minimum).');
        return;
      }
      if (sessionAccessCodes.has(form.accessCode.trim())) {
        const conflictTeam = sessionAccessCodes.get(form.accessCode.trim());
        setFormError(`Duplicate access code detected. This code is already assigned to team ${conflictTeam}.`);
        return;
      }
    }

    // 6. Existing team lifecycle anti-downgrade check
    const existing = teams.find((t) => t.teamId.toUpperCase() === normalizedId);
    if (existing && ['READY', 'ACTIVE', 'active', 'COMPLETED', 'DISQUALIFIED', 'disqualified'].includes(existing.status)) {
      if (form.status === 'QUALIFIED_FOR_ROUND_2' && editTarget) {
        setFormError(`Cannot downgrade team ${normalizedId} from state "${existing.status}" back to QUALIFIED_FOR_ROUND_2.`);
        return;
      }
    }

    const assignedStatus: TeamStatus = editTarget
      ? (existing?.status || form.status)
      : 'QUALIFIED_FOR_ROUND_2';

    const savedAccessCode = form.accessCode.trim();

    // Payload for Firestore: CRITICAL — NEVER WRITE accessCode TO FIRESTORE!
    const firestorePayload = {
      teamId: normalizedId,
      teamName: form.teamName.trim(),
      status: assignedStatus,
      round2Eligible: true,
      members: {
        member1: form.m1.trim(),
        member2: form.m2.trim(),
        member3: form.m3.trim(),
      },
      member1: { name: form.m1.trim(), role: 'M1' },
      member2: { name: form.m2.trim(), role: 'M2' },
      member3: { name: form.m3.trim(), role: 'M3' },
      updatedAt: new Date().toISOString(),
    };

    const built: Team = {
      teamId: normalizedId,
      teamName: form.teamName.trim(),
      accessCode: '••••••••',
      status: assignedStatus,
      round2Eligible: true,
      members: [
        { index: 1, name: form.m1.trim() },
        { index: 2, name: form.m2.trim() },
        { index: 3, name: form.m3.trim() },
      ],
    };

    try {
      await setDoc(doc(db, 'teams', normalizedId), firestorePayload, { merge: true });

      // Audit log
      try {
        await addDoc(collection(db, 'auditLogs'), {
          logId: `log_${Date.now()}`,
          action: editTarget ? 'ORGANIZER_MANUAL_TEAM_UPDATE' : 'ORGANIZER_MANUAL_TEAM_ADD',
          role: 'organizer',
          timestamp: new Date().toISOString(),
          teamId: normalizedId,
          teamName: form.teamName.trim(),
        });
      } catch (_) {}

      showToast(editTarget ? `Team ${normalizedId} updated.` : `Team ${normalizedId} created & qualified.`);
    } catch (e: any) {
      console.warn('Firestore write warning:', e);
      if (editTarget) setTeams((p) => p.map((t) => (t.teamId === editTarget ? built : t)));
      else setTeams((p) => [...p, built]);
      showToast(editTarget ? 'Team updated locally.' : 'Team saved locally.');
    }

    setShowAddEditModal(false);
    setForm(EMPTY_FORM);

    // If adding a new team with an access code, display offline provisioning handoff banner
    if (!editTarget && savedAccessCode) {
      setSessionAccessCodes((prev) => new Map(prev).set(savedAccessCode, normalizedId));
      setSingleTeamHandoff({
        teamId: normalizedId,
        accessCode: savedAccessCode,
      });
    }
  };

  const handleDelete = async (teamId: string) => {
    try {
      await deleteDoc(doc(db, 'teams', teamId));
      showToast(`Team ${teamId} deleted from Firestore.`);
    } catch (e) {
      setTeams((p) => p.filter((t) => t.teamId !== teamId));
      showToast('Team deleted locally.');
    }
    setDeleteTarget(null);
  };

  return (
    <OrganizerLayout>
      <div className="space-y-6">
        {/* Hidden CSV file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".csv"
          className="hidden"
        />

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-green-900/90 border border-green-500/50 text-green-300 px-4 py-2.5 rounded-lg text-sm font-mono shadow-xl backdrop-blur flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {/* Header & Actions */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-black text-2xl tracking-wide">TEAM MANAGEMENT</h1>
              <span className="badge-active text-xs">Round 2</span>
            </div>
            <p className="text-slate-400 text-xs font-mono mt-1">
              Qualified team roster, state tracking & offline credential handoff
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setImportStage('SELECT');
                setShowImportModal(true);
              }}
              className="btn-primary flex items-center gap-2 text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-glow-cyan"
            >
              <Upload className="w-4 h-4" /> Import Qualified Teams
            </button>
            <button
              onClick={openAdd}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> Add Single Team
            </button>
          </div>
        </div>

        {/* Dynamic Top Summary Metrics (No fixed 40 limit, calculated dynamically) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card-dark p-3 text-center border-dark-600">
            <span className="text-slate-500 text-[11px] font-mono uppercase tracking-wider block">Total</span>
            <span className="text-white font-black text-2xl font-mono">{summaryCounts.total}</span>
          </div>
          <div className="card-dark p-3 text-center border-cyan-800/40 bg-cyan-950/10">
            <span className="text-cyan-400 text-[11px] font-mono uppercase tracking-wider block">Qualified</span>
            <span className="text-cyan-300 font-black text-2xl font-mono">{summaryCounts.qualified}</span>
          </div>
          <div className="card-dark p-3 text-center border-emerald-800/40 bg-emerald-950/10">
            <span className="text-emerald-400 text-[11px] font-mono uppercase tracking-wider block">Ready</span>
            <span className="text-emerald-300 font-black text-2xl font-mono">{summaryCounts.ready}</span>
          </div>
          <div className="card-dark p-3 text-center border-blue-800/40 bg-blue-950/10">
            <span className="text-blue-400 text-[11px] font-mono uppercase tracking-wider block">Active</span>
            <span className="text-blue-300 font-black text-2xl font-mono">{summaryCounts.active}</span>
          </div>
          <div className="card-dark p-3 text-center border-purple-800/40 bg-purple-950/10">
            <span className="text-purple-400 text-[11px] font-mono uppercase tracking-wider block">Completed</span>
            <span className="text-purple-300 font-black text-2xl font-mono">{summaryCounts.completed}</span>
          </div>
          <div className="card-dark p-3 text-center border-red-800/40 bg-red-950/10">
            <span className="text-red-400 text-[11px] font-mono uppercase tracking-wider block">Disqualified</span>
            <span className="text-red-300 font-black text-2xl font-mono">{summaryCounts.disqualified}</span>
          </div>
        </div>

        {/* View Tabs & Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-dark-700 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold font-mono transition-colors ${
                activeTab === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Teams ({summaryCounts.total})
            </button>
            <button
              onClick={() => setActiveTab('qualified')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold font-mono transition-colors ${
                activeTab === 'qualified'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Qualified Teams ({summaryCounts.qualified})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Team ID or name..."
                className="w-full pl-9 pr-4 py-1.5 bg-dark-800 border border-dark-600 rounded-lg text-slate-300 text-xs font-mono placeholder-slate-600 outline-none focus:border-cyan-600 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
          <span className="text-slate-500 uppercase tracking-widest text-[10px]">Filter:</span>
          {(['ALL', 'QUALIFIED_FOR_ROUND_2', 'READY', 'ACTIVE', 'COMPLETED', 'DISQUALIFIED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded border transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-dark-700 text-cyan-300 border-cyan-500/60'
                  : 'bg-dark-900/60 text-slate-400 border-dark-700 hover:border-slate-600'
              }`}
            >
              {st === 'ALL' ? 'ALL' : st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Teams Table (ACCESS CODE IS NEVER DISPLAYED) */}
        <div className="card-dark overflow-hidden border border-dark-700">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700 text-slate-400 font-mono text-xs uppercase tracking-wider bg-dark-900/50">
                  <th className="text-left px-4 py-3">Team ID</th>
                  <th className="text-left px-4 py-3">Team Name</th>
                  <th className="text-left px-4 py-3">Members</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Round 2</th>
                  <th className="text-left px-4 py-3">Live Session</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((team, i) => {
                  const conn = MOCK_CONNECTION[team.teamId] ?? 'offline';
                  return (
                    <tr
                      key={team.teamId}
                      className={`border-b border-dark-700/50 hover:bg-dark-800/40 transition-colors ${
                        i % 2 === 0 ? '' : 'bg-dark-900/20'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-cyan-400">{team.teamId}</td>
                      <td className="px-4 py-3 text-white font-medium">{team.teamName}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-400">M1:</span>
                          <span className="text-slate-200">{team.members[0]?.name || '—'}</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-slate-400">M2:</span>
                          <span className="text-slate-200">{team.members[1]?.name || '—'}</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-slate-400">M3:</span>
                          <span className="text-slate-200">{team.members[2]?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[11px] font-mono px-2 py-0.5 rounded border font-semibold inline-flex items-center gap-1 ${
                            team.status === 'READY'
                              ? 'text-emerald-400 border-emerald-800/50 bg-emerald-950/30'
                              : team.status === 'QUALIFIED_FOR_ROUND_2'
                              ? 'text-cyan-400 border-cyan-800/50 bg-cyan-950/30'
                              : team.status === 'ACTIVE' || team.status === 'active'
                              ? 'text-blue-400 border-blue-800/50 bg-blue-950/30'
                              : team.status === 'COMPLETED'
                              ? 'text-purple-400 border-purple-800/50 bg-purple-950/30'
                              : team.status === 'DISQUALIFIED' || team.status === 'disqualified'
                              ? 'text-red-400 border-red-800/50 bg-red-950/30'
                              : 'text-slate-400 border-slate-700 bg-slate-800/20'
                          }`}
                        >
                          {team.status === 'READY' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          {team.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {team.round2Eligible ? (
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-800/40 px-2 py-0.5 rounded">
                            ELIGIBLE
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500 bg-dark-900 border border-dark-700 px-2 py-0.5 rounded">
                            NO
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`flex items-center gap-1.5 text-xs font-mono ${
                            conn === 'connected' ? 'text-green-400' : 'text-slate-500'
                          }`}
                        >
                          {conn === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {conn}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(team)}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors"
                            aria-label="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(team.teamId)}
                            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredTeams.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-mono text-sm">
                      No teams match the current criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ROUND 2 QUALIFIED TEAMS IMPORT MODAL & WORKFLOW              */}
      {/* ============================================================ */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-dark-900 border border-cyan-800/50 rounded-2xl w-full max-w-2xl p-6 space-y-6 shadow-2xl relative my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-dark-700 pb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Import Round 2 Qualified Teams</h2>
                  <p className="text-slate-400 text-xs font-mono">Dynamic CSV qualification pipeline</p>
                </div>
              </div>
              <button
                onClick={closeImportModal}
                className="text-slate-400 hover:text-white text-xl font-bold p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Stage: SELECT CSV FILE */}
            {importStage === 'SELECT' && (
              <div className="space-y-5 flex-1 overflow-y-auto py-2">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-cyan-700/50 hover:border-cyan-400 rounded-xl p-8 text-center cursor-pointer transition-colors bg-cyan-950/10 hover:bg-cyan-950/20 group"
                >
                  <Upload className="w-10 h-10 text-cyan-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-white font-semibold text-sm">Select or drop Round 2 Qualified Teams CSV</p>
                  <p className="text-slate-400 text-xs font-mono mt-1">Supports any dynamic team count (e.g. 37, 50, 63, 100+)</p>
                </div>

                <div className="bg-dark-800/70 border border-dark-600 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold uppercase tracking-wider">
                    <FileText className="w-4 h-4" /> Required CSV Header Format
                  </div>
                  <pre className="bg-dark-950 border border-dark-700 rounded p-2.5 text-[11px] font-mono text-slate-300 overflow-x-auto">
teamId,teamName,accessCode,member1,member2,member3
CRL-0001,Binary Beasts,CR-5001,Aarav Sharma,Diya Patel,Rohan Verma
CRL-0002,Neural Knights,CR-5002,Kavya Nair,Arjun Mehta,Ananya Sen</pre>
                  <div className="text-slate-400 text-xs space-y-1 font-mono">
                    <p>• <strong>Team ID</strong>: Exactly CRL-XXXX (e.g. CRL-0001, CRL-0050).</p>
                    <p>• <strong>Members</strong>: Exactly 3 team members required per team.</p>
                    <p className="text-amber-300">
                      • <strong>Security notice</strong>: Access codes exist in the CSV for offline Auth provisioning handoff. They are <u>never</u> saved to Firestore.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={closeImportModal} className="btn-ghost text-sm">Cancel</button>
                </div>
              </div>
            )}

            {/* Stage: PREVIEW & VALIDATION */}
            {importStage === 'PREVIEW' && (
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {/* File summary banner */}
                <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest block">Selected File</span>
                    <span className="text-white font-bold text-sm font-mono">{selectedFileName}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div>Total: <span className="text-white font-bold">{previewMetrics.totalRows}</span></div>
                    <div>Valid: <span className="text-emerald-400 font-bold">{previewMetrics.validCount}</span></div>
                    <div>Invalid: <span className={previewMetrics.invalidCount > 0 ? 'text-red-400 font-bold' : 'text-slate-400'}>{previewMetrics.invalidCount}</span></div>
                    {previewMetrics.conflictCount > 0 && (
                      <div>Conflicts: <span className="text-amber-400 font-bold">{previewMetrics.conflictCount}</span></div>
                    )}
                  </div>
                </div>

                {/* Validation errors banner if any */}
                {(importErrors.length > 0 || previewMetrics.invalidCount > 0) && (
                  <div className="bg-red-950/30 border border-red-500/50 rounded-xl p-4 space-y-2 text-xs font-mono">
                    <div className="flex items-center gap-2 text-red-400 font-bold">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>CSV Validation Issues Detected (0 invalid rows required before qualification):</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-red-300 max-h-36 overflow-y-auto">
                      {importErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {previewMetrics.invalidRows.slice(0, 15).map((r) => (
                        <li key={r.rowNumber}>
                          Row {r.rowNumber} {r.teamId ? `(${r.teamId})` : ''}: {r.errors.join('; ')}
                        </li>
                      ))}
                      {previewMetrics.invalidRows.length > 15 && (
                        <li>...and {previewMetrics.invalidRows.length - 15} more invalid rows.</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Valid Teams Preview */}
                {previewMetrics.validCount > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 uppercase tracking-wider font-semibold">
                        Valid Teams Ready for Round 2 Qualification ({previewMetrics.validCount})
                      </span>
                      <span className="text-emerald-400">✓ All valid metadata ready</span>
                    </div>
                    <div className="bg-dark-950 border border-dark-700 rounded-xl max-h-48 overflow-y-auto text-xs font-mono divide-y divide-dark-800">
                      {previewMetrics.validTeams.map((row) => (
                        <div key={row.teamId} className="p-2.5 flex items-center justify-between gap-2 hover:bg-dark-900/50">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-cyan-400 w-20">{row.teamId}</span>
                            <span className="text-white font-medium">{row.teamName}</span>
                          </div>
                          <div className="text-slate-400 text-[11px] truncate max-w-[200px]">
                            {row.m1}, {row.m2}, {row.m3}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explicit Event-Day Confirmation Statement */}
                {previewMetrics.invalidCount === 0 && previewMetrics.validCount > 0 && (
                  <div className="bg-cyan-950/30 border border-cyan-500/50 rounded-xl p-4 space-y-2 text-xs font-mono text-cyan-300">
                    <p className="font-bold text-sm text-white">CONFIRM ROUND 2 QUALIFICATION</p>
                    <p>
                      You are about to qualify <strong>{previewMetrics.validCount} teams</strong> for Round 2.
                    </p>
                    <p className="text-slate-400">
                      These teams will be marked <code className="text-cyan-400">QUALIFIED_FOR_ROUND_2</code> with <code className="text-emerald-400">round2Eligible = true</code>.
                      Access codes will <strong>NOT</strong> be saved in Firestore.
                    </p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-dark-700 flex-shrink-0">
                  <button onClick={closeImportModal} className="btn-ghost text-sm">
                    Cancel
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-ghost text-sm flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Re-upload CSV
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={previewMetrics.invalidCount > 0 || previewMetrics.validCount === 0 || isSubmittingImport}
                      className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm & Qualify {previewMetrics.validCount} Teams
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stage: IMPORTING */}
            {importStage === 'IMPORTING' && (
              <div className="py-12 text-center space-y-4">
                <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
                <p className="text-white font-bold text-base">Qualifying teams in Firestore...</p>
                <p className="text-slate-400 text-xs font-mono">Writing public metadata and recording audit log</p>
              </div>
            )}

            {/* Stage: HANDOFF TO OFFLINE PROVISIONING */}
            {importStage === 'HANDOFF' && (
              <div className="space-y-5 flex-1 overflow-y-auto py-2">
                <div className="bg-emerald-950/30 border border-emerald-500/50 rounded-xl p-5 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h3 className="text-white font-bold text-lg">
                    {handoffCount} Teams Successfully Qualified!
                  </h3>
                  <p className="text-emerald-300 text-xs font-mono">
                    Firestore records created with status QUALIFIED_FOR_ROUND_2.
                  </p>
                </div>

                <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-3 font-mono text-xs">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-wider">
                    <Shield className="w-4 h-4" /> Next Step: Offline Auth Provisioning
                  </div>
                  <p className="text-slate-300">
                    To generate the participants&apos; Firebase Auth accounts and passwords, run the provisioning utility from your terminal:
                  </p>
                  <div className="bg-dark-950 border border-dark-700 rounded-lg p-3 flex items-center justify-between text-slate-200">
                    <code className="text-cyan-300 font-mono text-[11px] overflow-x-auto select-all">
                      npm run teams:provision -- --file={selectedFileName || 'data/qualifiers.csv'}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`npm run teams:provision -- --file=${selectedFileName || 'data/qualifiers.csv'}`);
                        setCopiedHandoff(true);
                        setTimeout(() => setCopiedHandoff(false), 2000);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white"
                      title="Copy command"
                    >
                      {copiedHandoff ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-slate-400 text-[11px] space-y-1">
                    <p>• The provisioning script connects securely with your service account key.</p>
                    <p>• Successfully provisioned teams will automatically update to <strong>READY</strong>.</p>
                    <p>• Once <strong>READY</strong>, participants can log in using their Team ID and access code.</p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      closeImportModal();
                      setActiveTab('qualified');
                    }}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    View Qualified Teams <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Single Team Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-white font-bold text-lg">{editTarget ? 'Edit Team' : 'Add Single Team'}</h2>

            {formError && (
              <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-lg flex items-center gap-2 text-red-300 text-xs font-mono">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1 block">
                  Team ID (e.g. CRL-0001)
                </label>
                <input
                  value={form.teamId}
                  disabled={!!editTarget}
                  onChange={(e) => setForm((p) => ({ ...p, teamId: e.target.value.toUpperCase() }))}
                  placeholder="CRL-XXXX"
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-300 text-sm font-mono outline-none focus:border-cyan-600 transition-colors disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1 block">
                  Team Name
                </label>
                <input
                  value={form.teamName}
                  onChange={(e) => setForm((p) => ({ ...p, teamName: e.target.value }))}
                  placeholder="e.g. CyberHawks"
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-300 text-sm font-mono outline-none focus:border-cyan-600 transition-colors"
                />
              </div>

              {!editTarget && (
                <div>
                  <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1 block">
                    Access Code (for offline provisioning)
                  </label>
                  <input
                    type="password"
                    value={form.accessCode}
                    onChange={(e) => setForm((p) => ({ ...p, accessCode: e.target.value }))}
                    placeholder="Min 6 characters (e.g. SEC49A)"
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-300 text-sm font-mono outline-none focus:border-cyan-600 transition-colors"
                  />
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                    * Used for CLI Auth provisioning only; NEVER stored in Firestore.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1 block">
                    Member 1
                  </label>
                  <input
                    value={form.m1}
                    onChange={(e) => setForm((p) => ({ ...p, m1: e.target.value }))}
                    placeholder="Alice"
                    className="w-full px-2.5 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-slate-300 text-xs font-mono outline-none focus:border-cyan-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1 block">
                    Member 2
                  </label>
                  <input
                    value={form.m2}
                    onChange={(e) => setForm((p) => ({ ...p, m2: e.target.value }))}
                    placeholder="Bob"
                    className="w-full px-2.5 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-slate-300 text-xs font-mono outline-none focus:border-cyan-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1 block">
                    Member 3
                  </label>
                  <input
                    value={form.m3}
                    onChange={(e) => setForm((p) => ({ ...p, m3: e.target.value }))}
                    placeholder="Charlie"
                    className="w-full px-2.5 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-slate-300 text-xs font-mono outline-none focus:border-cyan-600 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowAddEditModal(false);
                  setFormError(null);
                }}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
              <button onClick={handleSave} className="btn-primary text-sm">
                Save Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Team Offline Provisioning Handoff Modal */}
      {singleTeamHandoff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-dark-800 border border-cyan-500/40 rounded-xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-cyan-400">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-white font-bold text-lg">
                Team {singleTeamHandoff.teamId} Registered for Round 2
              </h2>
            </div>
            <p className="text-slate-300 text-sm">
              Public team records are now set to{' '}
              <span className="font-mono text-cyan-300 font-semibold">QUALIFIED_FOR_ROUND_2</span>.
              To provision this participant&apos;s Firebase Auth account, execute this command in your local terminal:
            </p>
            <div className="bg-dark-950 border border-dark-700 rounded-lg p-3 flex items-center justify-between text-slate-200">
              <code className="text-cyan-300 font-mono text-xs overflow-x-auto select-all">
                npm run teams:provision -- --team={singleTeamHandoff.teamId} --code={singleTeamHandoff.accessCode}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `npm run teams:provision -- --team=${singleTeamHandoff.teamId} --code=${singleTeamHandoff.accessCode}`
                  );
                  setCopiedSingleHandoff(true);
                  setTimeout(() => setCopiedSingleHandoff(false), 2000);
                }}
                className="p-1.5 text-slate-400 hover:text-white"
                title="Copy command"
              >
                {copiedSingleHandoff ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="text-slate-400 text-xs font-mono space-y-1">
              <p>• The CLI script creates the Firebase Auth user and transitions the team to <strong>READY</strong>.</p>
              <p>• Once <strong>READY</strong>, participants can log in using their Team ID and access code.</p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSingleTeamHandoff(null)}
                className="btn-primary text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 border border-red-800/50 rounded-xl w-full max-w-sm p-6 space-y-4 text-center">
            <Trash2 className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-white font-bold">
              Delete team <span className="text-red-400">{deleteTarget}</span>?
            </p>
            <p className="text-slate-500 text-sm font-mono">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} className="btn-danger text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </OrganizerLayout>
  );
}
