import * as admin from 'firebase-admin';

// Initialize Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp();
}

export * from './auth';
export * from './competition';
