import { useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { useHashRoute } from "./hooks/useHashRoute";
import AdminApp from "./pages/admin/AdminApp";
import CartPage from "./pages/CartPage";
import ContactPage from "./pages/ContactPage";
import { isAdminRoute } from "./pages/admin/adminRoutes";
import CustomerAccountPage from "./pages/CustomerAccountPage";
import CustomerSupportPage from "./pages/CustomerSupportPage";
import ForgotPassword from "./pages/ForgotPassword";
import GoogleCallback from "./pages/GoogleCallback";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NewsPage from "./pages/NewsPage";
import PaymentPage from "./pages/PaymentPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import ProductsPage from "./pages/ProductsPage";
import ProfilePage from "./pages/ProfilePage";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import { isCustomerUser } from "./utils/roles";

function FloatingContactButton({ onNavigate }) {
  return (
    <button type="button" className="floating-contact-button" onClick={() => onNavigate('/support')}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H12l-4.2 3.2A.8.8 0 0 1 6.5 17.6V15A2.5 2.5 0 0 1 4 12.5v-6Z" />
        <path d="M8 8h8M8 11h5" />
      </svg>
      <span>ติดต่อ</span>
    </button>
  );
}
const CUSTOMER_ACCOUNT_ROUTES = [
  "/profile",
  "/payment",
  "/order-status",
  "/payment-status",
  "/support",
];
const CUSTOMER_ROUTES = [
  "/",
  "/products",
  "/contact",
  "/news",
  "/cart",
  "/payment-success",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/google/callback",
  ...CUSTOMER_ACCOUNT_ROUTES,
];

function AppRoutes() {
  const { route, navigate } = useHashRoute();
  const routePath = route.split('?')[0];
  const { user, loading, logout } = useAuth();
  const showFloatingContact = isCustomerUser(user);

  const goHome = () => navigate("/");
  const goAdmin = () => navigate("/admin");

  const redirectAfterLogin = (loggedInUser) => {
    if (loggedInUser?.role === "admin") {
      goAdmin();
    } else {
      goHome();
    }
  };

  const handleLogout = () => {
    logout();
    goHome();
  };

  function withFloatingContact(content) {
    if (!showFloatingContact) return content;
    return (
      <>
        {content}
        <FloatingContactButton onNavigate={navigate} />
      </>
    );
  }

  const redirectToCurrentCustomerRoute = (loggedInUser) => {
    if (loggedInUser?.role === "admin") {
      goAdmin();
      return;
    }

    if (route === "/cart" || CUSTOMER_ACCOUNT_ROUTES.includes(route)) {
      navigate(route);
      return;
    }

    goHome();
  };

  useEffect(() => {
    if (loading || user?.role !== "admin") return;
    // Only automatically redirect admins from the public homepage to the admin dashboard.
    // Allow admins to visit customer-facing routes like /products, /news, /contact.
    if (routePath === '/') {
      navigate('/admin');
    }
  }, [loading, user, routePath, navigate]);

  useEffect(() => {
    if (loading || !user) return;
    if (route === "/login" || route === "/register") {
      navigate(user.role === "admin" ? "/admin" : "/");
    }
  }, [loading, user, route, navigate]);

  if (loading) {
    return (
      <div className="app-loading">
        <p>กำลังโหลด...</p>
      </div>
    );
  }

  if (user?.role === "admin" && CUSTOMER_ROUTES.includes(routePath)) {
    return (
      <div className="app-loading">
        <p>กำลังเข้าสู่แดชบอร์ด...</p>
      </div>
    );
  }

  if (user && (route === "/login" || route === "/register")) {
    return (
      <div className="app-loading">
        <p>กำลังพาไปหน้าหลัก...</p>
      </div>
    );
  }

  if (isAdminRoute(route)) {
    if (!user) {
      return <Login onNavigate={navigate} onSuccess={redirectAfterLogin} />;
    }

    if (user.role !== "admin") {
      return (
        <div className="admin-access-denied">
          <p>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          <button
            type="button"
            className="home-btn home-btn-primary"
            onClick={goHome}
          >
            กลับหน้าแรก
          </button>
        </div>
      );
    }

    return (
      <AdminApp
        route={route}
        user={user}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
    );
  }

  if (route.startsWith("/auth/google/callback")) {
    return <GoogleCallback onNavigate={navigate} />;
  }

  if (route.startsWith("/payment-success")) {
    return (
      withFloatingContact(<PaymentSuccessPage
        user={user}
        onNavigate={navigate}
        onLogout={handleLogout}
      />)
    );
  }

  if (route.startsWith("/news")) {
    return (
      withFloatingContact(<NewsPage
        route={route}
        user={user}
        onNavigate={navigate}
        onLogout={handleLogout}
      />)
    );
  }

  switch (routePath) {
    case "/contact":
      return withFloatingContact(<ContactPage user={user} onNavigate={navigate} onLogout={handleLogout} />);
    case "/products":
      return withFloatingContact(
        <ProductsPage
          user={user}
          onNavigate={navigate}
          onLogout={handleLogout}
        />
      );
    case "/cart":
      if (!isCustomerUser(user)) {
        return (
          <>
            <Home user={user} onNavigate={navigate} onLogout={handleLogout} />
            <Login
              onNavigate={navigate}
              onSuccess={redirectToCurrentCustomerRoute}
              variant="modal"
              onClose={goHome}
            />
          </>
        );
      }

      return withFloatingContact(
        <CartPage
          user={user}
          onNavigate={navigate}
          onLogout={handleLogout}
        />
      );
    case "/login":
      return (
        <>
          <Home user={user} onNavigate={navigate} onLogout={handleLogout} />
          <Login
            onNavigate={navigate}
            onSuccess={redirectAfterLogin}
            variant="modal"
            onClose={goHome}
          />
        </>
      );
    case "/register":
      return (
        <>
          <Home user={user} onNavigate={navigate} onLogout={handleLogout} />
          <Register
            onNavigate={navigate}
            onSuccess={goHome}
            variant="modal"
            onClose={goHome}
          />
        </>
      );
    case "/forgot-password":
      return <><Home user={user} onNavigate={navigate} onLogout={handleLogout} /><ForgotPassword onNavigate={navigate} variant="modal" onClose={goHome} /></>;
    case "/reset-password":
      return <><Home user={user} onNavigate={navigate} onLogout={handleLogout} /><ResetPassword route={route} onNavigate={navigate} variant="modal" onClose={goHome} /></>;
    case "/payment":
    case "/order-status":
    case "/payment-status":
    case "/support":
    case "/profile":
      if (!user) {
        return (
          <>
            <Home user={user} onNavigate={navigate} onLogout={handleLogout} />
            <Login
              onNavigate={navigate}
              onSuccess={redirectToCurrentCustomerRoute}
              variant="modal"
              onClose={goHome}
            />
          </>
        );
      }

      if (routePath === "/profile") {
        return withFloatingContact(
          <ProfilePage
            user={user}
            onNavigate={navigate}
            onLogout={handleLogout}
          />
        );
      }

      if (routePath === "/support") {
        return withFloatingContact(
          <CustomerSupportPage
            user={user}
            onNavigate={navigate}
            onLogout={handleLogout}
          />
        );
      }

      if (routePath === "/payment") {
        return withFloatingContact(
          <PaymentPage
            user={user}
            onNavigate={navigate}
            onLogout={handleLogout}
          />
        );
      }

      return withFloatingContact(
        <CustomerAccountPage
          route={route}
          user={user}
          onNavigate={navigate}
          onLogout={handleLogout}
        />
      );
    default:
      return withFloatingContact(<Home user={user} onNavigate={navigate} onLogout={handleLogout} />);
  }
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppRoutes />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;









