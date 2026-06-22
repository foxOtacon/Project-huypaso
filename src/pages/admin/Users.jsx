import { useEffect, useMemo, useState } from 'react';
import { deleteUser, fetchUsers, updateUser } from '../../api/admin';

const ROLE_LABELS = {
  admin: 'Admin',
  customer: 'User',
};

const STATUS_LABELS = {
  active: 'ใช้งาน',
  suspended: 'ระงับ',
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
      setError('ไม่สามารถระงับบัญชีของตัวเองได้');
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
      setError('ไม่สามารถเปลี่ยนบทบาทบัญชีของตัวเองได้');
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
      setError('ไม่สามารถลบบัญชีของตัวเองได้');
      return;
    }

    const confirmed = window.confirm(`ลบผู้ใช้ "${user.full_name}" หรือไม่?`);
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

  if (loading) {
    return <div className="admin-loading">กำลังโหลดผู้ใช้งาน...</div>;
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
          placeholder="ค้นหา (ชื่อ, อีเมล, รหัสผู้ใช้)..."
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
          <option value="all">ทุกบทบาท</option>
          <option value="customer">User</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={filters.status}
          onChange={(event) =>
            setFilters((current) => ({ ...current, status: event.target.value }))
          }
        >
          <option value="all">ทุกสถานะ</option>
          <option value="active">ใช้งาน</option>
          <option value="suspended">ระงับ</option>
        </select>
        <button type="button" onClick={() => setFilters({ search: '', role: 'all', status: 'all' })}>
          ล้าง
        </button>
      </section>

      <section className="admin-panel users-table-panel">
        <div className="admin-table-wrap">
          <table className="admin-table users-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>ชื่อ</th>
                <th>อีเมล</th>
                <th>เบอร์โทร</th>
                <th>บทบาท</th>
                <th>สถานะ</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    ไม่พบผู้ใช้งาน
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => {
                  const isSaving = savingId === user.user_id;
                  const isCurrentUser = user.user_id === currentUser?.user_id;

                  return (
                    <tr key={user.user_id}>
                      <td>{index + 1}</td>
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
                            {user.role === 'admin' ? 'เป็น User' : 'เป็น Admin'}
                          </button>
                          <button
                            type="button"
                            className="users-suspend-button"
                            disabled={isSaving || isCurrentUser}
                            onClick={() => handleStatusToggle(user)}
                          >
                            {user.status === 'active' ? 'ระงับ' : 'เปิดใช้'}
                          </button>
                          <button
                            type="button"
                            className="users-delete-button"
                            disabled={isSaving || isCurrentUser}
                            onClick={() => handleDelete(user)}
                          >
                            ลบ
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
      </section>
    </>
  );
}
