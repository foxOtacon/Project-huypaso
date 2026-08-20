import { useEffect } from 'react';
import './Toast.css';

export default function Toast({ message, onClose, duration = 1400 }) {
  useEffect(() => {
    if (!message) return undefined;
    const id = window.setTimeout(() => onClose?.(), duration);
    return () => window.clearTimeout(id);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div className="app-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
