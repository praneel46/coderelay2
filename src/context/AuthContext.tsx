// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// Auth Context
// Backed by active DataProvider (Firebase or Mock).
// Enforces server-authoritative role verification.
// ============================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { Team, Member } from '../types/competition';
import { dataProvider } from '../services/data-provider';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
export type AuthRole = 'participant' | 'organizer' | 'judge' | null;

export interface AuthUser {
  role: AuthRole;
  team?: Team;
  activeMember?: Member;
  judgeId?: string;
  judgeName?: string;
  isOrganizer?: boolean;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAsParticipant: (teamId: string, accessCode: string) => Promise<{ success: boolean; error?: string }>;
  loginAsOrganizer: (password?: string) => Promise<{ success: boolean; error?: string }>;
  loginOrganizerWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginAsJudge: (judgeId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

// ----------------------------------------------------------------
// Context
// ----------------------------------------------------------------
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to provider auth state changes
  useEffect(() => {
    const unsubscribe = dataProvider.subscribeAuth((authUser) => {
      setUser(authUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginAsParticipant = useCallback(
    async (teamId: string, accessCode: string) => {
      try {
        const authUser = await dataProvider.loginParticipant(teamId, accessCode);
        setUser(authUser);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Invalid Team ID or Access Code.' };
      }
    },
    []
  );

  const loginAsOrganizer = useCallback(async (password?: string) => {
    try {
      const authUser = await dataProvider.loginOrganizer(password);
      setUser(authUser);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Organizer authentication failed.' };
    }
  }, []);

  const loginOrganizerWithGoogle = useCallback(async () => {
    try {
      const authUser = await dataProvider.loginOrganizer();
      setUser(authUser);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'ACCESS DENIED: Not authorized as an organizer.',
      };
    }
  }, []);

  const loginAsJudge = useCallback(async (judgeId: string, password: string) => {
    try {
      const authUser = await dataProvider.loginJudge(judgeId, password);
      setUser(authUser);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Invalid Judge ID or credentials.' };
    }
  }, []);

  const logout = useCallback(async () => {
    await dataProvider.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginAsParticipant,
        loginAsOrganizer,
        loginOrganizerWithGoogle,
        loginAsJudge,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
