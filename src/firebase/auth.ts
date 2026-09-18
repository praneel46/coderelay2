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
  } catch (err) {
    console.warn('[FirebaseAuth] Error verifying organizers doc:', err);
  }

  // 3. Check authorized_organizer_emails collection in Firestore
  if (firebaseUser.email) {
    try {
      const normalizedEmail = firebaseUser.email.trim().toLowerCase();
      const emailDocRef = doc(db, 'authorized_organizer_emails', normalizedEmail);
      const emailDoc = await getDoc(emailDocRef);
      if (emailDoc.exists()) {
        const data = emailDoc.data();
        if (data.authorized === true || data.authorized === 'true') {
          return {
            role: 'organizer',
            isOrganizer: true,
          };
        }
      }
    } catch (err) {
      console.warn('[FirebaseAuth] Error verifying authorized_organizer_emails doc:', err);
    }
  }

  // If role check failed: unauthorized Google account -> ACCESS DENIED
  await signOut(auth);
  throw new Error('ACCESS DENIED: Your Google account is not authorized as an organizer for VIGYANTRA 2026.');
}

// ----------------------------------------------------------------
// 6 Authoritative Judge Accounts (Email to Judge Profile Mapping)
// ----------------------------------------------------------------
export interface JudgeProfile {
  judgeId: string;
  name: string;
  email: string;
}

export const JUDGE_ACCOUNTS: Record<string, JudgeProfile> = {
  'judge1@coderelay.com': { judgeId: 'J001', name: 'Dr. Anil Krishnan', email: 'judge1@coderelay.com' },
  'judge2@coderelay.com': { judgeId: 'J002', name: 'Prof. Sunita Menon', email: 'judge2@coderelay.com' },
  'judge3@coderelay.com': { judgeId: 'J003', name: 'Mr. Ravi Tiwari', email: 'judge3@coderelay.com' },
  'judge4@coderelay.com': { judgeId: 'J004', name: 'Judge 004', email: 'judge4@coderelay.com' },
  'judge5@coderelay.com': { judgeId: 'J005', name: 'Judge 005', email: 'judge5@coderelay.com' },
  'judge6@coderelay.com': { judgeId: 'J006', name: 'Judge 006', email: 'judge6@coderelay.com' },
};

export const JUDGE_ID_TO_ACCOUNT: Record<string, JudgeProfile> = Object.values(JUDGE_ACCOUNTS).reduce(
  (acc, curr) => {
    acc[curr.judgeId.toUpperCase()] = curr;
    return acc;
  },
  {} as Record<string, JudgeProfile>
);

// ----------------------------------------------------------------
// Judge Sign-In
// ----------------------------------------------------------------
/**
 * Authenticate judge via Firebase Authentication using the 6 authorized accounts.
 * Accepts either Judge ID (J001-J006) or direct judge email.
 * Passwords are never hardcoded or exposed.
 */
export async function signInJudgeWithCredentials(
  judgeIdOrEmail: string,
  password: string
): Promise<AuthUser> {
  const normalized = judgeIdOrEmail.trim().toLowerCase();
  let judgeEmail = '';

  if (normalized.includes('@')) {
    judgeEmail = normalized;
    const match = JUDGE_ACCOUNTS[judgeEmail];
    if (!match) {
      throw new Error('ACCESS DENIED: Email is not an authorized judge account.');
    }
  } else {
    const match = JUDGE_ID_TO_ACCOUNT[judgeIdOrEmail.trim().toUpperCase()];
    if (!match) {
      throw new Error(`Invalid Judge ID: ${judgeIdOrEmail}. Authorized IDs are J001 through J006.`);
    }
    judgeEmail = match.email;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, judgeEmail, password);
    const userEmail = (cred.user.email || judgeEmail).toLowerCase();
    const account = JUDGE_ACCOUNTS[userEmail];

    if (!account) {
      await signOut(auth);
      throw new Error('ACCESS DENIED: Authenticated account is not an authorized judge.');
    }

    // Verify against judges document if available
    let judgeName = account.name;
    try {
      const judgeDocRef = doc(db, COLLECTIONS.JUDGES, account.judgeId);
      const judgeDoc = await getDoc(judgeDocRef);
      if (judgeDoc.exists() && judgeDoc.data().name) {
        judgeName = judgeDoc.data().name;
      }
    } catch {
      // Use fallback configured profile name
    }

    return {
      role: 'judge',
      judgeId: account.judgeId,
      judgeName,
    };
  } catch (error: any) {
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      throw new Error('Invalid password for this judge account.');
    }
    if (error.code === 'auth/user-not-found') {
      throw new Error('Judge account not found in Firebase Authentication.');
    }
    throw new Error(error.message || 'Invalid Judge credentials.');
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

      // Check organizers collection (by UID) for session restoration
      try {
        const orgDoc = await getDoc(doc(db, 'organizers', user.uid));
        if (orgDoc.exists() && orgDoc.data()?.authorized === true) {
          onUserChanged({ role: 'organizer', isOrganizer: true });
          return;
        }
      } catch (_) {
        // Fall through to email whitelist check
      }

      // Check authorized_organizer_emails collection (by normalized email)
      const userEmail = (user.email || '').trim().toLowerCase();
      if (userEmail) {
        try {
          const emailDoc = await getDoc(doc(db, 'authorized_organizer_emails', userEmail));
          if (emailDoc.exists()) {
            const data = emailDoc.data();
            if (data?.authorized === true || data?.authorized === 'true') {
              onUserChanged({ role: 'organizer', isOrganizer: true });
              return;
            }
          }
        } catch (_) {
          // Fall through to judge/participant checks
        }
      }
      const judgeAccount = JUDGE_ACCOUNTS[userEmail];

      if (role === 'judge' || judgeAccount) {
        const judgeId = (tokenResult.claims.judgeId as string) || judgeAccount?.judgeId || '';
        const judgeName = (tokenResult.claims.name as string) || judgeAccount?.name || `Judge ${judgeId}`;
        onUserChanged({
          role: 'judge',
          judgeId,
          judgeName,
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
