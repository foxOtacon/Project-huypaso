import { useEffect, useMemo, useState } from 'react';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import { deleteUser, fetchUsers, updateUser } from '../../api/admin';
import { matchesSearch } from '../../utils/search';

const ROLE_LABELS = {
  admin: 'Admin',
  customer: 'User',
};

const STATUS_LABELS = {
  active: 'ใช้งาน',
  suspended: 'ระงับ',
};

const USER_HAS_REFERENCES_MESSAGE =
  'ไม่สามารถลบผู้ใช้นี้ได้ เนื่องจากมีสินค้า คำสั่งซื้อ หรือประวัติการใช้งานเชื่อมโยงอยู่ กรุณาระงับบัญชีแทนการลบ';

function isUserReferenceError(error) {
  const message = String(error?.message || '').trim();

  return (
    error?.data?.code === 'USER_HAS_REFERENCES' ||
    /foreign\s+key|reference constraint|referenced row/i.test(message)
  );
}

function getUserActionError(error) {
  const message = String(error?.message || '').trim();

  if (isUserReferenceError(error)) return USER_HAS_REFERENCES_MESSAGE;

  return message || 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
}

export default function Users({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ search: '', role: 'all', status: 'all' });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [blockedDeleteUser, setBlockedDeleteUser] = useState(null);

  useEffect(() => {
    async function loadUsers() {
      try {
        setUsers(await fetchUsers());
      } catch (err) {
        setError(getUserActionError(err));
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesKeyword = matchesSearch(filters.search, [
        user.full_name,
        user.email,
        user.phone,
        user.user_id,
      ]);
      const matchesRole = filters.role === 'all' || user.role === filters.role;
      const matchesStatus = filters.status === 'all' || user.status === filters.status;

      return matchesKeyword && matchesRole && matchesStatus;
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
      setError(getUserActionError(err));
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
      setError(getUserActionError(err));
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
      if (isUserReferenceError(err)) {
        setBlockedDeleteUser(user);
      } else {
        setError(getUserActionError(err));
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleSuspendFromModal = async () => {
    if (!blockedDeleteUser || blockedDeleteUser.status !== 'active') return;

    const user = blockedDeleteUser;
    setSavingId(user.user_id);
    setError('');

    try {
      const updated = await updateUser(user.user_id, { status: 'suspended' });
      setUsers((current) =>
        current.map((item) => (item.user_id === updated.user_id ? updated : item)),
      );
      setBlockedDeleteUser(null);
    } catch (err) {
      setBlockedDeleteUser(null);
      setError(getUserActionError(err));
    } finally {
      setSavingId(null);
    }
  };

  const pagination = usePagination(filteredUsers, 10, [filters]);
  const userStats = {
    total: users.length,
    customers: users.filter((user) => user.role === 'customer').length,
    admins: users.filter((user) => user.role === 'admin').length,
    active: users.filter((user) => user.status === 'active').length,
  };

  if (loading) {
    return <div className="admin-loading">กำลังโหลดผู้ใช้งาน...</div>;
  }

  if (error && users.length === 0) {
    return <div className="admin-error">{error}</div>;
  }

  return (
    <div className="admin-users-page">
      {error ? <div className="admin-error orders-inline-error">{error}</div> : null}

      <section className="admin-users-stat-grid">
        <article><span>ผู้ใช้ทั้งหมด</span><strong>{userStats.total}</strong></article>
        <article><span>ลูกค้า</span><strong>{userStats.customers}</strong></article>
        <article><span>ผู้ดูแลระบบ</span><strong>{userStats.admins}</strong></article>
        <article><span>บัญชีที่ใช้งาน</span><strong>{userStats.active}</strong></article>
      </section>

      <section className="users-toolbar">
        <div className="admin-users-toolbar-heading">
          <div><span>ค้นหาและกรอง</span><h2>จัดการบัญชีผู้ใช้</h2></div>
          <strong>{filteredUsers.length} รายการ</strong>
        </div>
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
        <div className="admin-users-table-heading">
          <div><span>สมาชิกทั้งหมด</span><h2>ผู้ใช้งาน</h2></div>
          <p>จัดการบทบาท สถานะ และสิทธิ์การเข้าใช้งาน</p>
        </div>
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
                pagination.pageItems.map((user, index) => {
                  const isSaving = savingId === user.user_id;
                  const isCurrentUser = user.user_id === currentUser?.user_id;

                  return (
                    <tr key={user.user_id}>
                      <td>{(pagination.page - 1) * pagination.pageSize + index + 1}</td>
                      <td className="admin-table-data-left">{user.full_name}</td>
                      <td className="admin-table-data-left">{user.email}</td>
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
                            style={{ backgroundColor: user.status === 'active' ? 'red' : 'green' }}
                          >
                            {user.status === 'active' ? 'ระงับ' : 'เปิดใช้'}
                          </button>
                          <button
                            type="button"
                            className="users-delete-button"
                            disabled={isSaving || isCurrentUser}
                            onClick={() => handleDelete(user)}
                            style={{ display:'none'}}
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
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} className="admin-pagination" />
      </section>

      {blockedDeleteUser ? (
        <div
          className="products-modal-backdrop users-warning-modal-backdrop"
          role="presentation"
          onMouseDown={() => setBlockedDeleteUser(null)}
        >
          <section
            className="products-modal users-warning-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="users-warning-modal-title"
            aria-describedby="users-warning-modal-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="users-warning-modal-accent" />
            <div className="users-warning-modal-content">
              <button
                type="button"
                className="users-warning-modal-close"
                aria-label="ปิด"
                disabled={savingId === blockedDeleteUser.user_id}
                onClick={() => setBlockedDeleteUser(null)}
              >
                ×
              </button>
              <div className="users-warning-modal-icon" aria-hidden="true">!</div>
              <p className="users-warning-modal-eyebrow">ไม่สามารถลบผู้ใช้ได้</p>
              <h2 id="users-warning-modal-title">บัญชีนี้มีข้อมูลเชื่อมโยง</h2>
              <p id="users-warning-modal-description">{USER_HAS_REFERENCES_MESSAGE}</p>
              <div className="users-warning-modal-user">
                <span>บัญชีผู้ใช้</span>
                <strong>{blockedDeleteUser.full_name}</strong>
                <small>{blockedDeleteUser.email}</small>
              </div>
            </div>
            <footer className="users-warning-modal-actions">
              {blockedDeleteUser.status === 'active' ? (
                <button
                  type="button"
                  className="users-warning-modal-suspend"
                  disabled={savingId === blockedDeleteUser.user_id}
                  onClick={handleSuspendFromModal}
                >
                  {savingId === blockedDeleteUser.user_id ? 'กำลังระงับ...' : 'ระงับบัญชีแทน'}
                </button>
              ) : null}
              <button
                type="button"
                className="users-warning-modal-dismiss"
                disabled={savingId === blockedDeleteUser.user_id}
                onClick={() => setBlockedDeleteUser(null)}
              >
                รับทราบ
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}



