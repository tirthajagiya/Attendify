import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, tokenStore } from '../lib/api';
import type { User, UserRole } from '../lib/types';

interface AuthState {
  user: User | null;
  initializing: boolean;
}

interface AuthContextValue extends AuthState {
  login(email: string, password: string): Promise<User>;
  register(payload: RegisterPayload): Promise<User>;
  logout(): void;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  rollNumber?: string;
  department?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, initializing: true });

  // On first load, if a token exists, fetch the current user. Otherwise we're
  // unauthenticated and the app shows the public routes.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setState({ user: null, initializing: false });
      return;
    }
    api
      .get<{ user: User }>('/auth/me')
      .then((res) => setState({ user: res.data.user, initializing: false }))
      .catch(() => {
        tokenStore.clear();
        setState({ user: null, initializing: false });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    tokenStore.set(res.data.token);
    setState({ user: res.data.user, initializing: false });
    return res.data.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await api.post<{ token: string; user: User }>('/auth/register', payload);
    tokenStore.set(res.data.token);
    setState({ user: res.data.user, initializing: false });
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setState({ user: null, initializing: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
