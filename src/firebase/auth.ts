// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Firebase Authentication Service
// Secure authentication layer for Organizer, Judge, and Participant roles.
// ============================================================

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
  type IdTokenResult,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from './config';
import { COLLECTIONS } from './firestore';
import type { AuthUser, AuthRole } from '../context/AuthContext';
import type { Team } from '../types/competition';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// ----------------------------------------------------------------
// Organizer Google Sign-In with Trusted Role Verification
// ----------------------------------------------------------------
/**
 * Sign in as Organizer using Google Sign-In.
 * Flow:
 * 1. Google Sign-In popup
 * 2. Authenticated Firebase User obtained
 * 3. Trusted role check (Custom Claims or Firestore trusted 'organizers' doc)
 * 4. If unauthorized, immediately sign out and reject with ACCESS DENIED.
 */
export async function signInOrganizerWithGoogle(): Promise<AuthUser> {
  const result = await signInWithPopup(auth, googleProvider);
  const firebaseUser = result.user;

  // 1. Check custom claims first (authoritative backend claim)
  const idTokenResult: IdTokenResult = await firebaseUser.getIdTokenResult(true);
  const isOrganizerClaim = idTokenResult.claims.role === 'organizer' || idTokenResult.claims.isOrganizer === true;

  if (isOrganizerClaim) {
    return {
      role: 'organizer',
      isOrganizer: true,
    };
  }

  // 2. Check trusted organizers collection in Firestore
  try {
    const organizerDocRef = doc(db, 'organizers', firebaseUser.uid);
    const orgDoc = await getDoc(organizerDocRef);

    if (orgDoc.exists() && orgDoc.data().authorized === true) {
      return {
        role: 'organizer',
        isOrganizer: true,
      };
    }

    // Also check email whitelist collection if configured
    if (firebaseUser.email) {
      const emailDocRef = doc(db, 'authorized_organizer_emails', firebaseUser.email.toLowerCase());
      const emailDoc = await getDoc(emailDocRef);
      if (emailDoc.exists() && emailDoc.data().authorized === true) {
        return {
          role: 'organizer',
          isOrganizer: true,
        };
      }
    }
  } catch (err) {
    console.warn('[FirebaseAuth] Error verifying organizer authorization doc:', err);
  }

  // If role check failed: unauthorized Google account -> ACCESS DENIED
  await signOut(auth);
  throw new Error('ACCESS DENIED: Your Google account is not authorized as an organizer for VIGYANTRA 2026.');
}

// ----------------------------------------------------------------
// Judge Sign-In
// ----------------------------------------------------------------
/**
 * Authenticate judge via email/password or custom credential validation.
 */
export async function signInJudgeWithCredentials(
  judgeId: string,
  password: string
): Promise<AuthUser> {
  // Option A: If configured with Firebase Auth email
  // Format: judgeId@vidyantra.internal
  const judgeEmail = `${judgeId.toLowerCase()}@vidyantra.internal`;

  try {
    const cred = await signInWithEmailAndPassword(auth, judgeEmail, password);
    const tokenResult = await cred.user.getIdTokenResult();
    const role = (tokenResult.claims.role as AuthRole) || 'judge';

    // Verify against judges document
    const judgeDocRef = doc(db, COLLECTIONS.JUDGES, judgeId);
    const judgeDoc = await getDoc(judgeDocRef);
    const judgeName = judgeDoc.exists() ? judgeDoc.data().name : `Judge ${judgeId}`;

    return {
      role: role === 'judge' ? 'judge' : 'judge',
      judgeId,
      judgeName,
    };
  } catch (error: any) {
    // If Firebase Auth fails, try Cloud Function validation or throw
    try {
      const verifyJudgeFn = httpsCallable<{ judgeId: string; password: string }, { customToken: string; judgeName: string }>(
        functions,
        'verifyJudgeCredentials'
      );
      const res = await verifyJudgeFn({ judgeId, password });
      if (res.data.customToken) {
        await signInWithCustomToken(auth, res.data.customToken);
        return {
          role: 'judge',
          judgeId,
          judgeName: res.data.judgeName,
        };
      }
    } catch {
      // Re-throw original credentials error
    }
    throw new Error(error.message || 'Invalid Judge ID or credentials.');
  }
}

// ----------------------------------------------------------------
// Participant Sign-In via Secure Backend Flow
// ----------------------------------------------------------------
/**
 * Participant authentication using Team ID (CRL-0000) and access code.
 * Backend verifies the credentials securely without exposing the whole
 * credential registry to the client, and returns a custom Firebase token.
 */
export async function signInParticipantWithCredentials(
  teamId: string,
  accessCode: string
): Promise<AuthUser> {
  const verifyTeamFn = httpsCallable<
    { teamId: string; accessCode: string },
    { customToken: string; team: Team }
  >(functions, 'verifyTeamCredentials');

  const response = await verifyTeamFn({ teamId, accessCode });
  const { customToken, team } = response.data;

  if (!customToken) {
    throw new Error('Authentication failed: No custom token returned.');
  }

  // Sign in to Firebase Auth using the issued custom token
  await signInWithCustomToken(auth, customToken);

  return {
    role: 'participant',
    team,
    activeMember: team.members[0],
  };
}

// ----------------------------------------------------------------
// Sign Out
// ----------------------------------------------------------------
export async function signOutFromFirebase(): Promise<void> {
  await signOut(auth);
}

// ----------------------------------------------------------------
// Auth State Observer
// ----------------------------------------------------------------
export function subscribeToFirebaseAuthState(
  onUserChanged: (authUser: AuthUser | null) => void
): () => void {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (!user) {
      onUserChanged(null);
      return;
    }

    try {
      const tokenResult = await user.getIdTokenResult();
      const role = (tokenResult.claims.role as AuthRole) || null;

      if (role === 'organizer' || tokenResult.claims.isOrganizer) {
        onUserChanged({ role: 'organizer', isOrganizer: true });
        return;
      }

      if (role === 'judge') {
        const judgeId = (tokenResult.claims.judgeId as string) || '';
        onUserChanged({
          role: 'judge',
          judgeId,
          judgeName: (tokenResult.claims.name as string) || `Judge ${judgeId}`,
        });
        return;
      }

      if (role === 'participant') {
        const teamId = (tokenResult.claims.teamId as string) || '';
        // Fetch team document from Firestore
        let teamData: Team | undefined;
        if (teamId) {
          const teamDocRef = doc(db, COLLECTIONS.TEAMS, teamId);
          const snap = await getDoc(teamDocRef);
          if (snap.exists()) {
            const d = snap.data();
            teamData = {
              teamId: d.teamId || teamId,
              teamName: d.teamName || `Team ${teamId}`,
              accessCode: '••••••••',
              status: d.status || 'active',
              members: [
                { index: 1, name: d.member1?.name || 'Member 1' },
                { index: 2, name: d.member2?.name || 'Member 2' },
                { index: 3, name: d.member3?.name || 'Member 3' },
              ],
            };
          }
        }

        onUserChanged({
          role: 'participant',
          team: teamData,
          activeMember: teamData?.members[0],
        });
        return;
      }

      // Default fallback
      onUserChanged(null);
    } catch (err) {
      console.error('[FirebaseAuth] Error reading token claims:', err);
      onUserChanged(null);
    }
  });
}
