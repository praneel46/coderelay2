import * as admin from 'firebase-admin';
import { setGlobalOptions } from 'firebase-functions/v2';

// Initialize Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp();
}

// Global defaults for all 2nd gen Cloud Functions
setGlobalOptions({
  region: 'asia-south1',
});

export * from './auth';
export * from './competition';

