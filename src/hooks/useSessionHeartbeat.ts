import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { COLLECTIONS } from '../firebase/firestore';

function getClientDeviceDescription(): string {
  if (typeof navigator === 'undefined') return 'Unknown Device';
  const ua = navigator.userAgent;
  let os = 'Desktop';
  if (/Android/i.test(ua)) os = 'Android Mobile';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS Mobile';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edge/i.test(ua)) browser = 'Edge';

  return `${os} (${browser})`;
}

export function useSessionHeartbeat() {
  const { user, isAuthenticated } = useAuth();
  const heartbeatTimerRef = useRef<any>(null);

  useEffect(() => {
    // Strictly apply ONLY to authenticated participants (Safeguard 4)
    if (!isAuthenticated || !user || user.role !== 'participant') {
      return;
    }

    const teamId = user.team?.teamId || 'PARTICIPANT';
    const userId = auth.currentUser?.uid || `user_${teamId.toLowerCase()}`;

    // Deduplication across page refresh: check sessionStorage for existing session ID (strictly scoped by teamId)
    const storageKey = `crl_participant_session_id_${teamId.toLowerCase()}`;
    let sessionId = sessionStorage.getItem(storageKey);
    if (!sessionId) {
      sessionId = `sess_${teamId.toLowerCase()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem(storageKey, sessionId);
    }

    const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
    const deviceDesc = getClientDeviceDescription();

    const writeHeartbeat = async (connectionState?: 'online' | 'offline', isInitial = false) => {
      try {
        const nowIso = new Date().toISOString();
        const connection = connectionState || (navigator.onLine ? 'online' : 'offline');
        await setDoc(
          sessionRef,
          {
            sessionId,
            userId,
            role: 'participant',
            teamId,
            device: deviceDesc,
            connection,
            lastHeartbeat: nowIso,
            status: 'active',
            ...(isInitial ? { createdAt: nowIso } : {}),
          },
          { merge: true }
        );
      } catch (err) {
        // Non-blocking for offline or network blips
        console.warn('[SessionHeartbeat] Failed to pulse heartbeat:', err);
      }
    };

    // Initial heartbeat on login / mount
    writeHeartbeat(navigator.onLine ? 'online' : 'offline', true);

    // Heartbeat every 30 seconds (sensible interval, avoids excessive writes)
    heartbeatTimerRef.current = setInterval(() => {
      writeHeartbeat();
    }, 30000);

    const handleOnline = () => writeHeartbeat('online');
    const handleOffline = () => writeHeartbeat('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, isAuthenticated]);
}
