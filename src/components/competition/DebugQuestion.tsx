import React, { useState } from 'react';
import { Lock, CheckCircle2, AlertTriangle, Code2 } from 'lucide-react';
import type { Question, Submission } from '../../types/competition';

interface DebugQuestionProps {
  question: Question;
  submission?: Submission;
  onSubmit: (code: string) => void;
  isLocked: boolean;
  isCarriedForward?: boolean;
  className?: string;
}

export default function DebugQuestion({
  question,
  submission,
  onSubmit,
  isLocked,
  isCarriedForward = false,
  className = '',
}: DebugQuestionProps) {
  const isSubmitted = submission?.status === 'submitted';
  const effectiveLocked = isLocked || isSubmitted;

  const [code, setCode] = useState<string>(
    submission?.answer ?? question.starterCode ?? ''
  );

  const handleSubmit = () => {
    if (effectiveLocked || !code.trim()) return;
    onSubmit(code);
  };

  return (
    <div className={`card-dark overflow-hidden ${className}`}>
      {/* Carried-forward banner */}
      {isCarriedForward && !isSubmitted && (
        <div className="bg-yellow-900/30 border-b border-yellow-500/40 px-5 py-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
          <span className="text-yellow-400 text-xs font-mono uppercase tracking-wider">
            Carried from Strike 2 — Complete in this strike
          </span>
        </div>
      )}

      <div className="p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-bold text-base">{question.title}</span>
            {question.language && (
              <span className="text-xs font-mono text-slate-400 bg-dark-800 border border-dark-600 px-2 py-0.5 rounded uppercase">
                {question.language}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isCarriedForward && !isSubmitted && (
              <span className="badge-carried">Carried</span>
            )}
            {isSubmitted ? (
              <span className="badge-submitted flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Submitted · Locked
              </span>
            ) : isLocked ? (
              <span className="badge-locked flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked
              </span>
            ) : null}
          </div>
        </div>

        {/* Problem statement */}
        <div className="bg-dark-900 rounded-lg border border-dark-600 p-4">
          <p className="text-slate-300 text-sm leading-relaxed">{question.statement}</p>
        </div>

        {/* Buggy starter code (read-only reference) */}
        {question.starterCode && (
          <div>
            <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
              Original Code
            </p>
            <pre className="bg-dark-900 border border-dark-600 rounded-lg p-4 text-sm font-mono text-slate-400 overflow-x-auto leading-relaxed">
              {question.starterCode}
            </pre>
          </div>
        )}

        {/* Editable fix area */}
        <div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
            {isSubmitted ? 'Your Submitted Fix' : 'Your Fix'}
          </p>
          <textarea
            className="code-editor"
            rows={10}
            value={code}
            onChange={(e) => !effectiveLocked && setCode(e.target.value)}
            disabled={effectiveLocked}
            placeholder="Write your corrected code here..."
            aria-label={`Debug fix for ${question.title}`}
            spellCheck={false}
          />
        </div>

        {/* Submit */}
        {!effectiveLocked && (
          <button
            onClick={handleSubmit}
            disabled={!code.trim()}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Submit Fix
          </button>
        )}
        {isSubmitted && (
          <div className="flex items-center gap-2 text-green-400 text-sm font-mono">
            <CheckCircle2 className="w-4 h-4" />
            Fix submitted — question locked.
          </div>
        )}
      </div>
    </div>
  );
}
