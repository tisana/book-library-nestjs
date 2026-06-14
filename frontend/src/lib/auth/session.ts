import { useSyncExternalStore } from 'react';
import type { RoleArea, SessionUser } from '@/lib/api/types';

export interface AuthSessionSnapshot {
  accessToken?: string;
  roleArea?: RoleArea;
  user?: SessionUser;
  reason?: 'signed-out' | 'expired' | 'switched';
}

type SessionListener = () => void;

export function createAuthSessionStore() {
  let snapshot: AuthSessionSnapshot = { reason: 'signed-out' };
  const listeners = new Set<SessionListener>();

  function emit() {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: SessionListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setSession: (accessToken: string, user: SessionUser) => {
      snapshot = {
        accessToken,
        roleArea: user.roleArea,
        user,
        reason: 'switched',
      };
      emit();
    },
    clear: (reason: AuthSessionSnapshot['reason'] = 'signed-out') => {
      snapshot = { reason };
      emit();
    },
  };
}

export const authSession = createAuthSessionStore();

export function useAuthSession() {
  return useSyncExternalStore(
    authSession.subscribe,
    authSession.getSnapshot,
    authSession.getSnapshot,
  );
}
