import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useHashRoute } from './hooks/useHashRoute';
import AdminApp from './pages/admin/AdminApp';
import { isAdminRoute } from './pages/admin/adminRoutes';
import CustomerAccountPage from './pages/CustomerAccountPage';
import GoogleCallback from './pages/GoogleCallback';
import Home from './pages/Home';
import Login from './pages/Login';
import ProfilePage from './pages/ProfilePage';
import Register from './pages/Register';

const CUSTOMER_ACCOUNT_ROUTES = ['/profile', '/payment', '/order-status', '/payment-status'];
const CUSTOMER_ROUTES = ['/', '/login', '/register', '/auth/google/callback', ...CUSTOMER_ACCOUNT_ROUTES];

function AppRoutes() {
  const { route, navigate } = useHashRoute();
  const { user, loading, logout } = useAuth();

  const goHome = () => navigate('/');
  const goAdmin = () => navigate('/admin');

  const redirectAfterLogin = (loggedInUser) => {
    if (loggedInUser?.role === 'admin') {
      goAdmin();
    } else {
      goHome();
    }
  };

  const handleLogout = () => {
    logout();
    goHome();
  };

  const redirectToCurrentCustomerRoute = (loggedInUser) => {
    if (loggedInUser?.role === 'admin') {
      goAdmin();
      return;
    }

    if (CUSTOMER_ACCOUNT_ROUTES.includes(route)) {
      navigate(route);
      return;
    }

    goHome();
  };

  useEffect(() => {
    if (loading || user?.role !== 'admin') return;
    if (CUSTOMER_ROUTES.includes(route)) {
      navigate('/admin');
    }
  }, [loading, user, route, navigate]);

  if (loading) {
    return (
      <div className="app-loading">
        <p>กำลังโหลด...</p>
      </div>
    );
  }

  if (user?.role === 'admin' && CUSTOMER_ROUTES.includes(route)) {
    return (
      <div className="app-loading">
        <p>กำลังเข้าสู่แดชบอร์ด...</p>
      </div>
    );
  }

  if (isAdminRoute(route)) {
    if (!user) {
      return <Login onNavigate={navigate} onSuccess={redirectAfterLogin} />;
    }

    if (user.role !== 'admin') {
      return (
        <div className="admin-access-denied">
          <p>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          <button type="button" className="home-btn home-btn-primary" onClick={goHome}>
            กลับหน้าแรก
          </button>
        </div>
      );
    }

    return (
      <AdminApp route={route} user={user} onNavigate={navigate} onLogout={handleLogout} />
    );
  }

  if (route.startsWith('/auth/google/callback')) {
    return <GoogleCallback onNavigate={navigate} />;
  }

  switch (route) {
    case '/login':
      return (
        <>
          <Home
            user={user}
            onNavigate={navigate}
            onLogout={handleLogout}
          />
          <Login
            onNavigate={navigate}
            onSuccess={redirectAfterLogin}
            variant="modal"
            onClose={goHome}
          />
        </>
      );
    case '/register':
      return (
        <>
          <Home
            user={user}
            onNavigate={navigate}
            onLogout={handleLogout}
          />
          <Register
            onNavigate={navigate}
            onSuccess={goHome}
            variant="modal"
            onClose={goHome}
          />
        </>
      );
    case '/payment':
    case '/order-status':
    case '/payment-status':
    case '/profile':
      if (!user) {
        return (
          <>
            <Home
              user={user}
              onNavigate={navigate}
              onLogout={handleLogout}
            />
            <Login
              onNavigate={navigate}
              onSuccess={redirectToCurrentCustomerRoute}
              variant="modal"
              onClose={goHome}
            />
          </>
        );
      }

      if (route === '/profile') {
        return (
          <ProfilePage
            user={user}
            onNavigate={navigate}
            onLogout={handleLogout}
          />
        );
      }

      return (
        <CustomerAccountPage
          route={route}
          user={user}
          onNavigate={navigate}
          onLogout={handleLogout}
        />
      );
    default:
      return (
        <Home
          user={user}
          onNavigate={navigate}
          onLogout={handleLogout}
        />
      );
  }
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
