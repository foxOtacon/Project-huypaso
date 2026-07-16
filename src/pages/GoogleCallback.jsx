import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { queueGoogleProfileReminder } from '../utils/googleProfileReminder';

export default function GoogleCallback({ onNavigate }) {
  const { loginSuccess } = useAuth();

  useEffect(() => {
    const hash = window.location.hash || '';
    const queryIndex = hash.indexOf('?');
    const params = new URLSearchParams(queryIndex >= 0 ? hash.slice(queryIndex + 1) : '');
    const token = params.get('token');
    const encodedUser = params.get('user');
    const error = params.get('error');

    if (error) {
      window.setTimeout(() => onNavigate('/login'), 1200);
      return;
    }

    if (!token || !encodedUser) {
      window.setTimeout(() => onNavigate('/login'), 1200);
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(encodedUser));
      loginSuccess({ token, user });
      queueGoogleProfileReminder(user);
      onNavigate(user.role === 'admin' ? '/admin' : '/');
    } catch {
      window.setTimeout(() => onNavigate('/login'), 1200);
    }
  }, [loginSuccess, onNavigate]);

  return (
    <div className="app-loading">
      <p>กำลังเข้าสู่ระบบด้วย Google...</p>
    </div>
  );
}
