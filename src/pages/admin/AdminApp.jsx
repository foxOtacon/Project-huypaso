import { lazy, Suspense } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPlaceholder from './AdminPlaceholder';
import Analytics from './Analytics';
import Categories from './Categories';
import Contacts from './Contacts';
import Dashboard from './Dashboard';
import News from './News';
import Orders from './Orders';
import Products from './Products';
import ShippingCarriers from './ShippingCarriers';
import Transactions from './Transactions';
import PaymentSettings from './PaymentSettings';
import BankTransferAccounts from './BankTransferAccounts';
import Users from './Users';

const HistoryContent = lazy(() => import('./HistoryContent'));

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
  if (route === '/admin/payment-settings') return <PaymentSettings />;
  if (route === '/admin/bank-transfer-accounts') return <BankTransferAccounts />;

  if (route === '/admin/categories') {
    return <Categories />;
  }

  if (route === '/admin/shipping-carriers') {
    return <ShippingCarriers />;
  }

  if (route === '/admin/contacts') {
    return <Contacts user={user} />;
  }

  if (route === '/admin/history') {
    return (
      <Suspense fallback={<div className="admin-loading">กำลังเปิดตัวแก้ไขความเป็นมา...</div>}>
        <HistoryContent />
      </Suspense>
    );
  }

  if (route === '/admin/news') {
    return <News user={user} />;
  }

  

  if (route === '/admin/users') {
    return <Users currentUser={user} />;
  }

  if (route === '/admin/analytics') {
    return <Analytics />;
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

