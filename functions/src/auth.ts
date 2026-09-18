import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const ALLOWED_ORIGINS = [
  'https://coderelay2.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

/**
 * Verify team credentials and issue custom authentication token.
 * Prevents exposing credential maps to clients.
 */
export const verifyTeamCredentials = onCall(
  {
    region: 'asia-south1',
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    const { teamId, accessCode } = request.data || {};

    if (!teamId || !accessCode) {
      throw new HttpsError('invalid-argument', 'teamId and accessCode are required.');
    }

    // Enforce CRL-0000 format
    if (!/^CRL-\d{4}$/.test(teamId)) {
      throw new HttpsError('invalid-argument', 'Invalid Team ID format. Expected format: CRL-0000');
    }

    const db = admin.firestore();

    // 1. Look up secure credentials document in Firestore
    const credDoc = await db.collection('team_credentials').doc(teamId).get();

    let isValid = false;
    if (credDoc.exists) {
      const credData = credDoc.data();
      // Validate stored hash or code
      isValid = credData?.accessCode === accessCode || credData?.accessCodeHash === accessCode;
    } else {
      // Development / mock fallback for initial setup
      if (teamId === 'CRL-0000' && (accessCode === 'CR-4401' || accessCode === 'MOCK-PASS')) {
        isValid = true;
      }
    }

    if (!isValid) {
      throw new HttpsError('unauthenticated', 'Invalid Team ID or Access Code.');
    }

    // 2. Fetch public team data
    let teamDoc = await db.collection('teams').doc(teamId).get();
    let teamData: any = null;

    if (teamDoc.exists) {
      const d = teamDoc.data();
      teamData = {
        teamId: d?.teamId || teamId,
        teamName: d?.teamName || `Team ${teamId}`,
        status: d?.status || 'active',
        accessCode,
        members: [
          { index: 1, name: d?.member1?.name || 'Member 1' },
          { index: 2, name: d?.member2?.name || 'Member 2' },
          { index: 3, name: d?.member3?.name || 'Member 3' },
        ],
      };
    } else {
      teamData = {
        teamId,
        teamName: `Team ${teamId}`,
        status: 'active',
        accessCode,
        members: [
          { index: 1, name: 'Aarav Sharma' },
          { index: 2, name: 'Diya Patel' },
          { index: 3, name: 'Rohan Verma' },
        ],
      };
    }

    // 3. Create Custom Auth Token with claims
    const customClaims = {
      role: 'participant',
      teamId,
      member: 'M1',
    };

    const customToken = await admin.auth().createCustomToken(teamId, customClaims);

    return {
      customToken,
      team: teamData,
    };
  }
);

/**
 * Assign organizer custom claims.
 * Restricted to existing organizers or bootstrap setup.
 */
export const setOrganizerClaims = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  // Check if caller is already an authorized organizer
  const db = admin.firestore();
  const callerDoc = await db.collection('organizers').doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data()?.authorized !== true) {
    throw new HttpsError('permission-denied', 'Unauthorized. Only organizers can assign claims.');
  }

  const { targetUid } = request.data;
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'targetUid is required.');
  }

  await admin.auth().setCustomUserClaims(targetUid, {
    role: 'organizer',
    isOrganizer: true,
  });

  return { success: true, message: `Organizer claims set for ${targetUid}` };
});
