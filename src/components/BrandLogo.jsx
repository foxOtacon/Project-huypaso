import logoUrl from '../assets/huypaso-logo.png';

export default function BrandLogo({ className = '' }) {
  return (
    <img
      className={`brand-logo${className ? ` ${className}` : ''}`}
      src={logoUrl}
      alt=""
      aria-hidden="true"
    />
  );
}
