/**
 * Auth Context - Global authentication state
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const decodeJwt = (token) => {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('rw_token'));
  const [sessionWarningOpen, setSessionWarningOpen] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState(false);

  useEffect(() => {
    if (!token) {
      setSessionWarningOpen(false);
      return undefined;
    }

    const payload = decodeJwt(token);
    const expMs = payload?.exp ? payload.exp * 1000 : 0;
    if (!expMs) return undefined;

    const now = Date.now();
    const warnAt = expMs - 60 * 1000;
    const logoutAt = expMs;
    const warnDelay = Math.max(0, warnAt - now);
    const logoutDelay = Math.max(0, logoutAt - now);

    const warnTimer = window.setTimeout(() => {
      setSessionWarningOpen(true);
    }, warnDelay);

    const logoutTimer = window.setTimeout(() => {
      void logout();
    }, logoutDelay);

    return () => {
      window.clearTimeout(warnTimer);
      window.clearTimeout(logoutTimer);
    };
  }, [token]);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('rw_token');
      const savedUser = localStorage.getItem('rw_user');
      if (savedToken && savedUser) {
        try {
          setUser(JSON.parse(savedUser));
          // Refresh profile from server
          const { data } = await authAPI.getProfile();
          setUser(data.user);
          localStorage.setItem('rw_user', JSON.stringify(data.user));
        } catch {
          void logout();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password, role, rememberMe = false) => {
    const { data } = await authAPI.login({ email, password, role, rememberMe });
    localStorage.setItem('rw_token', data.token);
    localStorage.setItem('rw_user', JSON.stringify(data.user));
    localStorage.setItem('rw_remember_me', rememberMe ? 'true' : 'false');
    setToken(data.token);
    setUser(data.user);
    setSessionWarningOpen(false);
    return data;
  };

  const register = async (userData) => {
    const { data } = await authAPI.register(userData);
    if (data.token) {
      localStorage.setItem('rw_token', data.token);
      localStorage.setItem('rw_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const logout = async () => {
    if (localStorage.getItem('rw_token')) {
      try {
        await authAPI.logout();
      } catch {
        // Always continue local logout to avoid stuck sessions.
      }
    }
    localStorage.removeItem('rw_token');
    localStorage.removeItem('rw_user');
    localStorage.removeItem('rw_remember_me');
    setToken(null);
    setUser(null);
    setSessionWarningOpen(false);
  };

  const keepSessionAlive = async () => {
    setRefreshingToken(true);
    try {
      const rememberMe = localStorage.getItem('rw_remember_me') === 'true';
      const { data } = await authAPI.refreshToken({ rememberMe });
      if (data?.token) {
        localStorage.setItem('rw_token', data.token);
        setToken(data.token);
      }
      setSessionWarningOpen(false);
    } catch {
      await logout();
    } finally {
      setRefreshingToken(false);
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('rw_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
      {sessionWarningOpen && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Session Expiring Soon</h3>
            <p className="text-sm text-gray-600 mb-5">
              For security, your session will expire in about 1 minute. Stay signed in?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { void logout(); }}
                className="flex-1 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
              >
                Logout Now
              </button>
              <button
                type="button"
                onClick={keepSessionAlive}
                disabled={refreshingToken}
                className="flex-1 px-4 py-2 rounded-xl bg-primary text-white font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                {refreshingToken ? 'Refreshing...' : 'Stay Signed In'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
