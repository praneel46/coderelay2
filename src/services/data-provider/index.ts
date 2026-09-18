// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Data Provider Factory & Active Instance
// ============================================================

import type { IDataProvider } from './types';
import { MockDataProvider } from './MockDataProvider';
import { FirebaseDataProvider } from './FirebaseDataProvider';

const providerMode = import.meta.env.VITE_DATA_PROVIDER || 'mock';

export const dataProvider: IDataProvider =
  providerMode === 'firebase'
    ? new FirebaseDataProvider()
    : new MockDataProvider();

export * from './types';
