import React, { useState } from 'react';
import { Lock, CheckCircle2, Terminal } from 'lucide-react';
import type { Question, Submission } from '../../types/competition';

interface CodeQuestionProps {
  question: Question;
  submission?: Submission;
  onSubmit: (code: string) => void;
  isLocked: boolean;
}

const LANG_COLORS: Record<string, string> = {
  python: 'text-yellow-400 border-yellow-800/50 bg-yellow-900/10',
  java: 'text-orange-400 border-orange-800/50 bg-orange-900/10',
  javascript: 'text-yellow-300 border-yellow-700/50 bg-yellow-900/10',
  cpp: 'text-blue-400 border-blue-800/50 bg-blue-900/10',
};

export default function CodeQuestion({ question, submission, onSubmit, isLocked }: CodeQuestionProps) {
  const isSubmitted = submission?.status === 'submitted';
  const effectiveLocked = isLocked || isSubmitted;
  const [code, setCode] = useState<string>(submission?.answer ?? question.starterCode ?? '');

  const langColor = question.language ? (LANG_COLORS[question.language] ?? 'text-slate-400 border-dark-600') : 'text-slate-400 border-dark-600';

  return (
    <div className="card-dark overflow-hidden">
      <div className="p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-bold text-base">{question.title}</span>
            {question.language && (
              <span className={`text-xs font-mono px-2 py-0.5 rounded border uppercase ${langColor}`}>
                {question.language}
              </span>
            )}
          </div>
          <div>
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

        {/* Code editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-wider">
              {isSubmitted ? 'Your Submitted Code' : 'Your Solution'}
            </p>
            {question.language && (
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${langColor}`}>
                {question.language}
              </span>
            )}
          </div>
          <textarea
            className="code-editor"
            rows={12}
            value={code}
            onChange={(e) => !effectiveLocked && setCode(e.target.value)}
            disabled={effectiveLocked}
            placeholder={`// Write your ${question.language ?? 'code'} solution here...`}
            aria-label={`Code solution for ${question.title}`}
            spellCheck={false}
          />
        </div>

        {/* Submit */}
        {!effectiveLocked && (
          <button
            onClick={() => { if (code.trim()) onSubmit(code); }}
            disabled={!code.trim()}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Submit Code
          </button>
        )}
        {isSubmitted && (
          <div className="flex items-center gap-2 text-green-400 text-sm font-mono">
            <CheckCircle2 className="w-4 h-4" />
            Solution submitted — question locked.
          </div>
        )}
      </div>
    </div>
  );
}
