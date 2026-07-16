import './Pagination.css';

export default function Pagination({ page, totalPages, onPageChange, className = '' }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav className={`pagination ${className}`.trim()} aria-label="à¸à¸²à¸£à¹à¸šà¹ˆà¸‡à¸«à¸™à¹‰à¸²">
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1}>
        à¸à¹ˆà¸­à¸™à¸«à¸™à¹‰à¸²
      </button>
      <div className="pagination-pages">
        {pages.map((number) => (
          <button
            type="button"
            key={number}
            className={number === page ? 'active' : ''}
            aria-current={number === page ? 'page' : undefined}
            aria-label={`à¸«à¸™à¹‰à¸²à¸—à¸µà¹ˆ ${number}`}
            onClick={() => onPageChange(number)}
          >
            {number}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>
        à¸–à¸±à¸”à¹„à¸›
      </button>
    </nav>
  );
}

