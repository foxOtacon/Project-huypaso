import AdminLayout from '../../components/admin/AdminLayout';
import AdminPlaceholder from './AdminPlaceholder';
import Dashboard from './Dashboard';
import News from './News';
import Orders from './Orders';
import Products from './Products';
import Transactions from './Transactions';
import Users from './Users';

function AdminPageContent({ route, user }) {
  if (route === '/admin' || route === '/admin/dashboard') {
    return <Dashboard />;
  }

  if (route === '/admin/orders') {
    return <Orders />;
  }

  if (route === '/admin/transactions') {
    return <Transactions />;
  }

  if (route === '/admin/products') {
    return <Products user={user} />;
  }

  if (route === '/admin/news') {
    return <News user={user} />;
  }

  if (route === '/admin/users') {
    return <Users currentUser={user} />;
  }

  return <AdminPlaceholder route={route} />;
}

export default function AdminApp({ route, user, onNavigate, onLogout }) {
  return (
    <AdminLayout route={route} user={user} onNavigate={onNavigate} onLogout={onLogout}>
      <AdminPageContent key={route} route={route} user={user} />
    </AdminLayout>
  );
}
