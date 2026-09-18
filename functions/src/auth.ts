import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

/**
 * Verify team credentials and issue custom authentication token.
 * Prevents exposing credential maps to clients.
 */
export const verifyTeamCredentials = onCall(async (request) => {
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
    if (teamId === 'CRL-0000' && accessCode === 'CR-4401') {
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
      id: d?.teamId || teamId,
      name: d?.teamName || `Team ${teamId}`,
      status: d?.status || 'active',
      members: [
        { id: `${teamId}-m1`, name: d?.member1?.name || 'Member 1', role: 'M1', isLead: true },
        { id: `${teamId}-m2`, name: d?.member2?.name || 'Member 2', role: 'M2' },
        { id: `${teamId}-m3`, name: d?.member3?.name || 'Member 3', role: 'M3' },
      ],
    };
  } else {
    teamData = {
      id: teamId,
      name: `Team ${teamId}`,
      status: 'active',
      members: [
        { id: `${teamId}-m1`, name: 'Aarav Sharma', role: 'M1', isLead: true },
        { id: `${teamId}-m2`, name: 'Diya Patel', role: 'M2' },
        { id: `${teamId}-m3`, name: 'Rohan Verma', role: 'M3' },
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
});

/**
 * Assign organizer custom claims.
 * Restricted to existing organizers or bootstrap setup.
 */
export const setOrganizerClaims = onCall(async (request) => {
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
