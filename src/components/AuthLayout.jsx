import { useEffect } from 'react';
import BrandLogo from './BrandLogo';
import '../styles/auth.css';

export default function AuthLayout({
  title,
  subtitle,
  children,
  variant = 'page',
  onClose,
}) {
  const isModal = variant === 'modal';

  useEffect(() => {
    if (!isModal) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModal, onClose]);

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  }

  return (
    <div
      className={isModal ? 'auth-page auth-modal-backdrop' : 'auth-page'}
      onMouseDown={isModal ? handleBackdropClick : undefined}
      role={isModal ? 'dialog' : undefined}
      aria-modal={isModal ? 'true' : undefined}
    >
      <div className="auth-card">
        {isModal && (
          <button
            type="button"
            className="auth-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        )}

        <div className="auth-brand">
          <BrandLogo className="brand-logo-lg" />
          <div>
            <p className="auth-brand-name">สินค้าชุมชน</p>
            <p className="auth-brand-tagline">Village Products</p>
          </div>
        </div>

        <div className="auth-header">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>

        {children}
      </div>
    </div>
  );
}
