import { useMemo, useState } from 'react';

export default function usePagination(items, pageSize = 10, resetKeys = []) {
  const resetKey = JSON.stringify(resetKeys);
  const [pagination, setPagination] = useState({ key: resetKey, page: 1 });
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = pagination.key === resetKey ? Math.min(pagination.page, totalPages) : 1;

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const setPage = (nextPage) => {
    setPagination({
      key: resetKey,
      page: Math.max(1, Math.min(nextPage, totalPages)),
    });
  };

  return { page, pageItems, pageSize, setPage, totalPages };
}

