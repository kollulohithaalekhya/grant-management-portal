import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Role, User } from '../types';
import { authAPI, googleAuthUrl } from '../api/services';
import { hasRole as userHasRole } from '../utils/roles';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (redirectTo?: string) => void;
  /** Completes an OAuth redirect by storing the tokens and loading the user. */
  completeOAuthLogin: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const storeTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }
    try {
      const res = await authAPI.me();
      setUser(res.data.data.user);
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const res = await authAPI.login({ email, password });
    const { user: loggedIn, accessToken, refreshToken } = res.data.data;
    storeTokens(accessToken, refreshToken);
    setUser(loggedIn);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await authAPI.register({ name, email, password });
    const { user: registered, accessToken, refreshToken } = res.data.data;
    storeTokens(accessToken, refreshToken);
    setUser(registered);
  };

  // Full-page navigation: the browser must land on Google's consent screen.
  const loginWithGoogle = (redirectTo?: string) => {
    window.location.href = googleAuthUrl(redirectTo);
  };

  const completeOAuthLogin = async (accessToken: string, refreshToken: string) => {
    storeTokens(accessToken, refreshToken);
    const res = await authAPI.me();
    setUser(res.data.data.user);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken') || '';
    try { await authAPI.logout(refreshToken); } catch { /* the tokens are cleared regardless */ }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const updateUser = (u: User) => setUser(u);

  const hasRole = (...roles: Role[]) => userHasRole(user, ...roles);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginWithGoogle,
        completeOAuthLogin,
        logout,
        updateUser,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
