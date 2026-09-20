// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Data Provider Factory & Active Instance
//
// Production strictly uses FirebaseDataProvider (Firebase Auth +
// Cloud Firestore + App Check). MockDataProvider is quarantined
// from production bundle to guarantee zero credential leakage.
// ============================================================

import type { IDataProvider } from './types';
import { FirebaseDataProvider } from './FirebaseDataProvider';

export const dataProvider: IDataProvider = new FirebaseDataProvider();

export * from './types';
