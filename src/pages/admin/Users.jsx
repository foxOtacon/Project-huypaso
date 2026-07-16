import { useEffect, useMemo, useState } from 'react';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import { deleteUser, fetchUsers, updateUser } from '../../api/admin';

const ROLE_LABELS = {
  admin: 'Admin',
  customer: 'User',
};

const STATUS_LABELS = {
  active: 'à¹ƒà¸Šà¹‰à¸‡à¸²à¸™',
  suspended: 'à¸£à¸°à¸‡à¸±à¸š',
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export default function Users({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ search: '', role: 'all', status: 'all' });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadUsers() {
      try {
        setUsers(await fetchUsers());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = normalizeText(filters.search);

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        normalizeText(user.full_name).includes(query) ||
        normalizeText(user.email).includes(query) ||
        normalizeText(user.phone).includes(query) ||
        String(user.user_id).includes(query);
      const matchesRole = filters.role === 'all' || user.role === filters.role;
      const matchesStatus = filters.status === 'all' || user.status === filters.status;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [filters, users]);

  const handleStatusToggle = async (user) => {
    if (user.user_id === currentUser?.user_id) {
      setError('à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸£à¸°à¸‡à¸±à¸šà¸šà¸±à¸à¸Šà¸µà¸‚à¸­à¸‡à¸•à¸±à¸§à¹€à¸­à¸‡à¹„à¸”à¹‰');
      return;
    }

    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    setSavingId(user.user_id);
    setError('');

    try {
      const updated = await updateUser(user.user_id, { status: nextStatus });
      setUsers((current) =>
        current.map((item) => (item.user_id === updated.user_id ? updated : item)),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleRoleToggle = async (user) => {
    if (user.user_id === currentUser?.user_id) {
      setError('à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸šà¸—à¸šà¸²à¸—à¸šà¸±à¸à¸Šà¸µà¸‚à¸­à¸‡à¸•à¸±à¸§à¹€à¸­à¸‡à¹„à¸”à¹‰');
      return;
    }

    const nextRole = user.role === 'admin' ? 'customer' : 'admin';
    setSavingId(user.user_id);
    setError('');

    try {
      const updated = await updateUser(user.user_id, { role: nextRole });
      setUsers((current) =>
        current.map((item) => (item.user_id === updated.user_id ? updated : item)),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (user) => {
    if (user.user_id === currentUser?.user_id) {
      setError('à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¥à¸šà¸šà¸±à¸à¸Šà¸µà¸‚à¸­à¸‡à¸•à¸±à¸§à¹€à¸­à¸‡à¹„à¸”à¹‰');
      return;
    }

    const confirmed = window.confirm(`à¸¥à¸šà¸œà¸¹à¹‰à¹ƒà¸Šà¹‰ "${user.full_name}" à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ?`);
    if (!confirmed) return;

    setSavingId(user.user_id);
    setError('');

    try {
      await deleteUser(user.user_id);
      setUsers((current) => current.filter((item) => item.user_id !== user.user_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const pagination = usePagination(filteredUsers, 10, [filters]);

  if (loading) {
    return <div className="admin-loading">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™...</div>;
  }

  if (error && users.length === 0) {
    return <div className="admin-error">{error}</div>;
  }

  return (
    <>
      {error ? <div className="admin-error orders-inline-error">{error}</div> : null}

      <section className="users-toolbar">
        <input
          type="search"
          value={filters.search}
          placeholder="à¸„à¹‰à¸™à¸«à¸² (à¸Šà¸·à¹ˆà¸­, à¸­à¸µà¹€à¸¡à¸¥, à¸£à¸«à¸±à¸ªà¸œà¸¹à¹‰à¹ƒà¸Šà¹‰)..."
          onChange={(event) =>
            setFilters((current) => ({ ...current, search: event.target.value }))
          }
        />
        <select
          value={filters.role}
          onChange={(event) =>
            setFilters((current) => ({ ...current, role: event.target.value }))
          }
        >
          <option value="all">à¸—à¸¸à¸à¸šà¸—à¸šà¸²à¸—</option>
          <option value="customer">User</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={filters.status}
          onChange={(event) =>
            setFilters((current) => ({ ...current, status: event.target.value }))
          }
        >
          <option value="all">à¸—à¸¸à¸à¸ªà¸–à¸²à¸™à¸°</option>
          <option value="active">à¹ƒà¸Šà¹‰à¸‡à¸²à¸™</option>
          <option value="suspended">à¸£à¸°à¸‡à¸±à¸š</option>
        </select>
        <button type="button" onClick={() => setFilters({ search: '', role: 'all', status: 'all' })}>
          à¸¥à¹‰à¸²à¸‡
        </button>
      </section>

      <section className="admin-panel users-table-panel">
        <div className="admin-table-wrap">
          <table className="admin-table users-table">
            <thead>
              <tr>
                <th>à¸¥à¸³à¸”à¸±à¸š</th>
                <th>à¸Šà¸·à¹ˆà¸­</th>
                <th>à¸­à¸µà¹€à¸¡à¸¥</th>
                <th>à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£</th>
                <th>à¸šà¸—à¸šà¸²à¸—</th>
                <th>à¸ªà¸–à¸²à¸™à¸°</th>
                <th>à¸à¸²à¸£à¸ˆà¸±à¸”à¸à¸²à¸£</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    à¹„à¸¡à¹ˆà¸žà¸šà¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™
                  </td>
                </tr>
              ) : (
                pagination.pageItems.map((user, index) => {
                  const isSaving = savingId === user.user_id;
                  const isCurrentUser = user.user_id === currentUser?.user_id;

                  return (
                    <tr key={user.user_id}>
                      <td>{(pagination.page - 1) * pagination.pageSize + index + 1}</td>
                      <td>{user.full_name}</td>
                      <td>{user.email}</td>
                      <td>{user.phone || '-'}</td>
                      <td>
                        <span className={`user-role-badge user-role-${user.role}`}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`user-status-badge user-status-${user.status}`}>
                          {STATUS_LABELS[user.status] || user.status}
                        </span>
                      </td>
                      <td>
                        <div className="users-actions">
                          <button
                            type="button"
                            className="users-role-button"
                            disabled={isSaving || isCurrentUser}
                            onClick={() => handleRoleToggle(user)}
                          >
                            {user.role === 'admin' ? 'à¹€à¸›à¹‡à¸™ User' : 'à¹€à¸›à¹‡à¸™ Admin'}
                          </button>
                          <button
                            type="button"
                            className="users-suspend-button"
                            disabled={isSaving || isCurrentUser}
                            onClick={() => handleStatusToggle(user)}
                          >
                            {user.status === 'active' ? 'à¸£à¸°à¸‡à¸±à¸š' : 'à¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰'}
                          </button>
                          <button
                            type="button"
                            className="users-delete-button"
                            disabled={isSaving || isCurrentUser}
                            onClick={() => handleDelete(user)}
                          >
                            à¸¥à¸š
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} className="admin-pagination" />
      </section>
    </>
  );
}



