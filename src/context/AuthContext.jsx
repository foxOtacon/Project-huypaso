import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe } from '../api/auth';

const AuthContext = createContext(null);

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

function readStoredAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);
  return {
    token,
    user: user ? JSON.parse(user) : null,
  };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredAuth().token);
  const [user, setUser] = useState(() => readStoredAuth().user);
  const [loading, setLoading] = useState(true);

  const persistAuth = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);

    if (nextToken && nextUser) {
      localStorage.setItem(TOKEN_KEY, nextToken);
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }, []);

  const loginSuccess = useCallback(
    (data) => {
      persistAuth(data.token, data.user);
    },
    [persistAuth]
  );

  const logout = useCallback(() => {
    persistAuth(null, null);
  }, [persistAuth]);

  const updateCurrentUser = useCallback((nextUser) => {
    setUser(nextUser);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    getMe(token)
      .then((res) => {
        if (res.success && res.data) {
          setUser(res.data);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data));
        }
      })
      .catch(() => {
        persistAuth(null, null);
      })
      .finally(() => setLoading(false));
  }, [token, persistAuth]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      loginSuccess,
      logout,
      updateCurrentUser,
    }),
    [token, user, loading, loginSuccess, logout, updateCurrentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
