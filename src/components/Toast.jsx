import { useEffect, useRef } from 'react';
import './Toast.css';

export default function Toast({ message, onClose, duration = 1400 }) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!message) return undefined;
    const id = window.setTimeout(() => onCloseRef.current?.(), duration);
    return () => window.clearTimeout(id);
  }, [message, duration]);

  if (!message) return null;

  return (
    <div className="app-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
