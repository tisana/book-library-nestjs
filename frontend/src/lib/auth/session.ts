import { useSyncExternalStore } from 'react';
import type {
  AuthPermission,
  AuthTokenMetadata,
  RoleArea,
  SessionUser,
} from '@/lib/api/types';

export interface AuthSessionSnapshot {
  accessToken?: string;
  tokenType?: AuthTokenMetadata['tokenType'];
  expiresIn?: number;
  scope?: string;
  permissions?: AuthPermission[];
  issuer?: string;
  audience?: string | string[];
  authVersion?: number;
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
    setSession: (
      accessToken: string,
      user: SessionUser,
      metadata?: Partial<AuthTokenMetadata>,
    ) => {
      const permissions = metadata?.permissions ?? user.permissions ?? [];
      snapshot = {
        accessToken,
        tokenType: metadata?.tokenType ?? 'Bearer',
        expiresIn: metadata?.expiresIn,
        scope: metadata?.scope ?? permissions.join(' '),
        permissions,
        issuer: metadata?.issuer,
        audience: metadata?.audience,
        authVersion: metadata?.authVersion,
        roleArea: user.roleArea,
        user: { ...user, permissions } as SessionUser,
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
