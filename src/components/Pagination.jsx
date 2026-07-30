import './Pagination.css';

export default function Pagination({ page, totalPages, onPageChange, className = '' }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav className={`pagination ${className}`.trim()} aria-label="การแบ่งหน้า">
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1}>
        ก่อนหน้า
      </button>
      <div className="pagination-pages">
        {pages.map((number) => (
          <button
            type="button"
            key={number}
            className={number === page ? 'active' : ''}
            aria-current={number === page ? 'page' : undefined}
            aria-label={`หน้าที่ ${number}`}
            onClick={() => onPageChange(number)}
          >
            {number}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>
        ถัดไป
      </button>
    </nav>
  );
}

