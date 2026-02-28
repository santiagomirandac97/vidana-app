import { useState, useMemo } from 'react';

export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / pageSize);
  const pageItems = useMemo(
    () => items.slice(page * pageSize, (page + 1) * pageSize),
    [items, page, pageSize]
  );
  const goToNext = () => setPage((p) => Math.min(p + 1, totalPages - 1));
  const goToPrev = () => setPage((p) => Math.max(p - 1, 0));
  const reset = () => setPage(0);
  return { page, totalPages, pageItems, goToNext, goToPrev, reset, pageSize };
}
