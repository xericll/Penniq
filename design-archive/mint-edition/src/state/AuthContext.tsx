import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { KEYS, read, removeKey, write } from '../lib/storage';
import { supabase } from '../lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
}

/** Why a sign-in / sign-up attempt failed, mapped to a translated message by the screen. */
export type AuthFailure = 'invalid' | 'exists' | 'weak' | 'unconfirmed' | 'rate' | 'email' | 'notAllowed' | 'network' | 'unknown';

export type AuthResult = { ok: true; confirmEmail?: boolean } | { ok: false; reason: AuthFailure };

interface AuthValue {
  /** False in builds without a cloud project: the app is then device-only and never asks to sign in. */
  enabled: boolean;
  /** False until the saved session has been read. */
  ready: boolean;
  user: AuthUser | null;
  /** The user chose to keep using the app without an account. */
  guest: boolean;
  /** Nobody is signed in and nothing says they should not be asked. */
  needsAuth: boolean;
  /** Arrived from a "reset password" e-mail: a new password must be chosen. */
  recovering: boolean;

  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  sendReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  /** Back to the sign-in screen from guest mode. */
  askToSignIn: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function failure(error: { code?: string; status?: number; name?: string; message?: string }): AuthFailure {
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return 'network';
  switch (error.code) {
    case 'invalid_credentials':
      return 'invalid';
    case 'user_already_exists':
    case 'email_exists':
      return 'exists';
    case 'weak_password':
    case 'same_password':
      return 'weak';
    case 'email_not_confirmed':
      return 'unconfirmed';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'rate';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'email';
    case 'email_address_not_authorized':
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'notAllowed';
    default:
      return error.status === 429 ? 'rate' : 'unknown';
  }
}

/** Where e-mail links bring the user back to: this page, without the tab hash. */
function returnUrl(): string {
  return window.location.origin + window.location.pathname;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const enabled = supabase !== null;
  const [ready, setReady] = useState(!enabled);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [guest, setGuest] = useState(() => read(KEYS.guest) === '1');
  const [recovering, setRecovering] = useState(false);
  // A saved session that cannot be refreshed right now (offline) still means "signed in on this device".
  const [stored, setStored] = useState(() => read(KEYS.authSession) !== null);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null);
      setStored(read(KEYS.authSession) !== null);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
      if (session) {
        removeKey(KEYS.guest);
        setGuest(false);
      }
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, reason: 'unknown' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { ok: false, reason: failure(error) } : { ok: true };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, reason: 'unknown' };
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: returnUrl() } });
    if (error) return { ok: false, reason: failure(error) };
    // With e-mail confirmation on, an address that is already registered comes back as a user without identities.
    if (!data.session && data.user && data.user.identities?.length === 0) return { ok: false, reason: 'exists' };
    return { ok: true, confirmEmail: !data.session };
  }, []);

  const sendReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, reason: 'unknown' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: returnUrl() });
    return error ? { ok: false, reason: failure(error) } : { ok: true };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, reason: 'unknown' };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, reason: failure(error) };
    setRecovering(false);
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    // 'local' ends the session on this device even without a connection.
    await supabase?.auth.signOut({ scope: 'local' });
  }, []);

  const continueAsGuest = useCallback(() => {
    write(KEYS.guest, '1');
    setGuest(true);
  }, []);

  const askToSignIn = useCallback(() => {
    removeKey(KEYS.guest);
    setGuest(false);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      enabled,
      ready,
      user,
      guest,
      needsAuth: enabled && ready && !user && !guest && !stored,
      recovering,
      signIn,
      signUp,
      sendReset,
      updatePassword,
      signOut,
      continueAsGuest,
      askToSignIn,
    }),
    [enabled, ready, user, guest, stored, recovering, signIn, signUp, sendReset, updatePassword, signOut, continueAsGuest, askToSignIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
