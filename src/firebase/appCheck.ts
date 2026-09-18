// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Firebase App Check Configuration
// Protects backend resources using reCAPTCHA Enterprise.
// ============================================================

import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  CustomProvider,
  type AppCheck,
} from 'firebase/app-check';
import { getApps, getApp, type FirebaseApp } from 'firebase/app';

let appCheckInstance: AppCheck | null = null;

/**
 * Initialize Firebase App Check with reCAPTCHA Enterprise.
 * Ensures App Check is initialized exactly once before backend services are used.
 */
export function initAppCheck(firebaseApp?: FirebaseApp): AppCheck | null {
  // Only initialize in browser environment
  if (typeof window === 'undefined') return null;

  // Guarantee single initialization
  if (appCheckInstance) {
    return appCheckInstance;
  }

  const targetApp = firebaseApp || (getApps().length ? getApp() : undefined);
  if (!targetApp) return null;

  const recaptchaSiteKey = import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY;
  const isDev = import.meta.env.DEV;

  // Development debug token mechanism: only active in local development
  if (isDev) {
    const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
    if (debugToken) {
      // @ts-expect-error self debug token property for Firebase App Check
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
  }

  try {
    if (recaptchaSiteKey) {
      appCheckInstance = initializeAppCheck(targetApp, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else if (isDev) {
      // Offline / local development fallback when no site key is provided
      appCheckInstance = initializeAppCheck(targetApp, {
        provider: new CustomProvider({
          getToken: () =>
            Promise.resolve({
              token: 'mock-debug-app-check-token',
              expireTimeMillis: Date.now() + 3600 * 1000,
            }),
        }),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (err) {
    // Graceful fallback during offline development or testing
    console.info('[AppCheck] Initialized with development fallback.', err);
  }

  return appCheckInstance;
}
