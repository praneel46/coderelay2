// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Firestore Data Sanitization Utility
// Strips undefined fields recursively to prevent Firestore crashes
// while strictly preserving null, 0, false, empty string, and Dates.
// ============================================================

export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) return undefined as any;
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    return (obj as any[]).map(sanitizeForFirestore).filter((v) => v !== undefined) as any;
  }
  const clean: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      const sanitized = sanitizeForFirestore(v);
      if (sanitized !== undefined) {
        clean[k] = sanitized;
      }
    }
  }
  return clean;
}
