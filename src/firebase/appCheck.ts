// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Firebase App Check Configuration
// Protects backend resources from abuse without replacing auth.
// ============================================================

import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } from 'firebase/app-check';
import app from './config';

export function initAppCheck(): void {
  // Only initialize if running in browser
  if (typeof window === 'undefined') return;

  const recaptchaSiteKey = import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY;
  const isDebug = import.meta.env.DEV || !!import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;

  if (isDebug) {
    // In development mode, set self-debug token for emulator / local testing
    // @ts-expect-error self debug token property
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || true;
  }

  try {
    if (recaptchaSiteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else if (isDebug) {
      initializeAppCheck(app, {
        provider: new CustomProvider({
          getToken: () => Promise.resolve({
            token: 'mock-debug-app-check-token',
            expireTimeMillis: Date.now() + 3600 * 1000,
          }),
        }),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (err) {
    // Graceful fallback during offline development
    console.info('[AppCheck] Initialized with development fallback.', err);
  }
}
