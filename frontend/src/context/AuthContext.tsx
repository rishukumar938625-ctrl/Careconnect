import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '../types';
import { authApi, userApi } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check current session on application launch
  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.getCurrentUser();
      setUser(res.user);
    } catch {
      // 401 or network error - user is unauthenticated
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await authApi.login(credentials);
    setUser(res.user);
  };

  const register = async (data: { name: string; email: string; password: string }) => {
    const res = await authApi.register(data);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  const updateProfile = async (data: Partial<AuthUser>): Promise<AuthUser> => {
    const updated = await userApi.updateProfile(data);
    setUser(updated);
    return updated;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
