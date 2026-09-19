// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Battle Mode / Anti-Cheat Hook
// Fullscreen enforcement, keyboard & right-click deterrence,
// Page Visibility API tab-switch tracking with 3-warning auto-submit.
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { StrikeId } from '../types/competition';
import { db } from '../firebase/config';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export type ViolationType = 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'DEVTOOLS_ATTEMPT';

export interface ViolationEvent {
  type: ViolationType;
  warningNumber: number;
  message: string;
  timestamp: string;
}

interface UseAntiCheatOptions {
  enabled: boolean;
  teamId: string;
  strikeId: StrikeId;
  onAutoSubmit: () => void;
}

export function useAntiCheat({
  enabled,
  teamId,
  strikeId,
  onAutoSubmit,
}: UseAntiCheatOptions) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [warningCount, setWarningCount] = useState<number>(0);
  const [activeViolation, setActiveViolation] = useState<ViolationEvent | null>(null);
  const [isLockedOut, setIsLockedOut] = useState<boolean>(false);

  const warningCountRef = useRef<number>(0);
  const isLockedOutRef = useRef<boolean>(false);
  const lastViolationTimeRef = useRef<number>(0);

  // Helper to log violation to Firestore
  const reportViolation = useCallback(
    async (type: ViolationType, warningNum: number, details?: string) => {
      if (!teamId || !enabled) return;
      try {
        const violationId = `${teamId}_${Date.now()}`;
        const violationRef = doc(db, 'violations', violationId);
        await setDoc(violationRef, {
          violationId,
          teamId,
          strikeId,
          violationType: type,
          warningNumber: warningNum,
          details: details || '',
          timestamp: serverTimestamp(),
        });
      } catch (err) {
        console.warn('[AntiCheat] Could not report violation to Firestore:', err);
      }
    },
    [teamId, strikeId, enabled]
  );

  // Trigger violation handler
  const handleViolation = useCallback(
    (type: ViolationType, message: string) => {
      if (!enabled || isLockedOutRef.current) return;

      // Throttle rapid repeated triggers within 1.5 seconds
      const now = Date.now();
      if (now - lastViolationTimeRef.current < 1500) return;
      lastViolationTimeRef.current = now;

      const newCount = warningCountRef.current + 1;
      warningCountRef.current = newCount;
      setWarningCount(newCount);

      const event: ViolationEvent = {
        type,
        warningNumber: newCount,
        message,
        timestamp: new Date().toLocaleTimeString(),
      };
      setActiveViolation(event);

      // Report to Firestore
      if (newCount >= 3) {
        isLockedOutRef.current = true;
        setIsLockedOut(true);
        console.warn('[AntiCheat] 3rd strike violation reached. Triggering auto-submit workflow.');

        const violationId = `${teamId}_${Date.now()}`;
        (async () => {
          // 1. Record AUTO_SUBMIT_TRIGGERED
          try {
            const violationRef = doc(db, 'violations', violationId);
            await setDoc(violationRef, {
              violationId,
              teamId,
              strikeId,
              violationType: type,
              warningNumber: newCount,
              autoSubmitStatus: 'AUTO_SUBMIT_TRIGGERED',
              details: message,
              timestamp: serverTimestamp(),
            });
          } catch (e) {
            console.error('[AntiCheat] Could not write initial violation record:', e);
          }

          // 2. Execute onAutoSubmit handler
          try {
            await Promise.resolve(onAutoSubmit());
            // 3. Confirm in Firestore that submission succeeded
            const violationRef = doc(db, 'violations', violationId);
            await setDoc(
              violationRef,
              {
                autoSubmitStatus: 'AUTO_SUBMIT_CONFIRMED',
                confirmedAt: serverTimestamp(),
              },
              { merge: true }
            );
            console.log('[AntiCheat] Auto-submit confirmed in Firestore.');
          } catch (submitErr: any) {
            console.error('[AntiCheat] Auto-submit failed:', submitErr);
            // 4. Record failure so organizer immediately sees it
            try {
              const violationRef = doc(db, 'violations', violationId);
              await setDoc(
                violationRef,
                {
                  autoSubmitStatus: 'AUTO_SUBMIT_FAILED',
                  autoSubmitError: submitErr?.message || 'Network / submission failed',
                },
                { merge: true }
              );
            } catch (failErr) {
              console.error('[AntiCheat] Could not log failure to Firestore:', failErr);
            }
          }
        })();
      } else {
        // Report Warning 1 or 2
        reportViolation(type, newCount, message);
      }
    },
    [enabled, teamId, strikeId, reportViolation, onAutoSubmit]
  );

  // Fullscreen helper
  const requestFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.warn('[AntiCheat] Fullscreen request prevented:', err);
    }
  }, []);

  const dismissModal = useCallback(() => {
    if (warningCountRef.current < 3) {
      setActiveViolation(null);
      // Attempt to re-enter fullscreen
      requestFullscreen();
    }
  }, [requestFullscreen]);

  // Listen to Fullscreen changes
  useEffect(() => {
    if (!enabled) return;

    const handleFullscreenChange = () => {
      const inFullscreen = !!document.fullscreenElement;
      setIsFullscreen(inFullscreen);

      if (!inFullscreen && enabled && !isLockedOutRef.current) {
        handleViolation(
          'FULLSCREEN_EXIT',
          'Fullscreen mode was exited. Competition requires full screen immersion.'
        );
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [enabled, handleViolation]);

  // Listen to Page Visibility API (Tab Switch / Window Minimize)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && enabled && !isLockedOutRef.current) {
        handleViolation(
          'TAB_SWITCH',
          'Tab switch or window change detected. Focus must remain on the competition portal.'
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, handleViolation]);

  // Keyboard and Right-Click Deterrents
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Common DevTools Shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U)
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        ((e.ctrlKey || e.metaKey) && ['u', 'U'].includes(e.key))
      ) {
        e.preventDefault();
        handleViolation(
          'DEVTOOLS_ATTEMPT',
          'Developer tools access attempt detected.'
        );
        return;
      }

      // 2. Clipboard shortcut deterrence (Ctrl+C, Ctrl+V, Ctrl+X) outside allowable editors
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
        const target = e.target as HTMLElement | null;
        const isEditor = target?.closest('.monaco-editor, textarea, input, [data-allow-clipboard="true"]');
        if (!isEditor) {
          e.preventDefault();
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Right-click remains available strictly inside code editor / textarea / inputs
      const target = e.target as HTMLElement | null;
      const isEditor = target?.closest('.monaco-editor, textarea, input, [data-allow-context-menu="true"]');
      if (!isEditor) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [enabled, handleViolation]);

  return {
    isFullscreen,
    warningCount,
    activeViolation,
    isLockedOut,
    requestFullscreen,
    dismissModal,
  };
}
