import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe } from '../api/auth';
import { resetInvalidSessionState } from '../utils/session';

const AuthContext = createContext(null);

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

function readStoredAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);

  try {
    return {
      token,
      user: user ? JSON.parse(user) : null,
    };
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredAuth().token);
  const [user, setUser] = useState(() => readStoredAuth().user);
  const [loading, setLoading] = useState(true);
  const [sessionValidated, setSessionValidated] = useState(false);

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
      resetInvalidSessionState();
      sessionStorage.removeItem('auth_message');
      setSessionValidated(true);
      persistAuth(data.token, data.user);
    },
    [persistAuth]
  );

  const logout = useCallback(() => {
    setSessionValidated(false);
    persistAuth(null, null);
  }, [persistAuth]);

  const updateCurrentUser = useCallback((nextUser) => {
    setUser(nextUser);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }, []);

  useEffect(() => {
    const handleSessionInvalid = () => persistAuth(null, null);
    window.addEventListener('auth:session-invalid', handleSessionInvalid);
    return () => window.removeEventListener('auth:session-invalid', handleSessionInvalid);
  }, [persistAuth]);

  useEffect(() => {
    if (!token) {
      setSessionValidated(false);
      setLoading(false);
      return;
    }

    getMe(token)
      .then((res) => {
        if (res.success && res.data) {
          persistAuth(res.token || token, res.data);
          setSessionValidated(true);
        }
      })
      .catch((error) => {
        if (
          !sessionStorage.getItem('auth_message') &&
          (error.status === 401 || error.code === 'SESSION_INVALID')
        ) {
          sessionStorage.setItem(
            'auth_message',
            'เซสชันหมดอายุหรือข้อมูลบัญชีมีการเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่',
          );
        }
        persistAuth(null, null);
        setSessionValidated(false);
      })
      .finally(() => setLoading(false));
  }, [token, persistAuth]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      sessionValidated,
      loginSuccess,
      logout,
      updateCurrentUser,
    }),
    [token, user, loading, sessionValidated, loginSuccess, logout, updateCurrentUser]
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
