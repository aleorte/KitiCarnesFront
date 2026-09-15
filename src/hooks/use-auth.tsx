import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '../types/api';
import { ApiError, getToken, setToken } from '../api/client';
import { authApi } from '../api/services';

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const USER_KEY = 'kitikitikiti.user';

function readUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [user, setUser] = useState<AuthUser | null>(readUser);

  const logout = () => {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setTokenState(null);
    setUser(null);
  };

  useEffect(() => {
    const onLogout = () => logout();
    window.addEventListener('kitikitikiti:logout', onLogout);
    return () => window.removeEventListener('kitikitikiti:logout', onLogout);
  }, []);

  useEffect(() => {
    if (!token) return;
    authApi
      .me()
      .then((fresh) => {
        localStorage.setItem(USER_KEY, JSON.stringify(fresh));
        setUser(fresh);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) logout();
      });
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      async login(email, password) {
        const response = await authApi.login(email, password);
        setToken(response.accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        setTokenState(response.accessToken);
        setUser(response.user);
        return response.user;
      },
      logout,
      hasPermission(permission) {
        return user?.permissions.includes(permission) ?? false;
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider missing');
  return ctx;
}
