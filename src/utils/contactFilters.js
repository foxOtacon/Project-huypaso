import { matchesSearch } from './search.js';

export function filterContacts(items, filters = {}) {
  const safeFilters = {
    status: 'all',
    search: '',
    ...filters,
  };

  return (items || []).filter((item) => {
    const matchesStatus = safeFilters.status === 'all' || item.status === safeFilters.status;
    const matchesSearchText = matchesSearch(safeFilters.search, [
      item.name,
      item.email,
      item.subject,
      item.message,
      item.contact_id,
      item.category,
      item.account_name,
      item.account_email,
      item.account_phone,
    ]);

    return matchesStatus && matchesSearchText;
  });
}
