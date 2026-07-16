import { useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { useHashRoute } from "./hooks/useHashRoute";
import AdminApp from "./pages/admin/AdminApp";
import CartPage from "./pages/CartPage";
import ContactPage from "./pages/ContactPage";
import { isAdminRoute } from "./pages/admin/adminRoutes";
import CustomerAccountPage from "./pages/CustomerAccountPage";
import GoogleCallback from "./pages/GoogleCallback";
import Home from "./pages/Home";
import KnowledgePage from "./pages/KnowledgePage";
import Login from "./pages/Login";
import NewsPage from "./pages/NewsPage";
import PaymentPage from "./pages/PaymentPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import ProductsPage from "./pages/ProductsPage";
import ProfilePage from "./pages/ProfilePage";
import Register from "./pages/Register";
import { isCustomerUser } from "./utils/roles";

const CUSTOMER_ACCOUNT_ROUTES = [
  "/profile",
  "/payment",
  "/order-status",
  "/payment-status",
];
const CUSTOMER_ROUTES = [
  "/",
  "/products",
  "/contact",
  "/news",
  "/knowledge",
  "/cart",
  "/payment-success",
  "/login",
  "/register",
  "/auth/google/callback",
  ...CUSTOMER_ACCOUNT_ROUTES,
];

function AppRoutes() {
  const { route, navigate } = useHashRoute();
  const { user, loading, logout } = useAuth();

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
    if (CUSTOMER_ROUTES.includes(route)) {
      navigate("/admin");
    }
  }, [loading, user, route, navigate]);

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

  if (user?.role === "admin" && CUSTOMER_ROUTES.includes(route)) {
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
    return <PaymentSuccessPage onNavigate={navigate} />;
  }

  if (route.startsWith("/knowledge")) {
    return (
      <KnowledgePage
        user={user}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
    );
  }
  if (route.startsWith("/news")) {
    return (
      <NewsPage
        route={route}
        user={user}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
    );
  }

  switch (route) {
    case "/contact":
      return <ContactPage user={user} onNavigate={navigate} onLogout={handleLogout} />;
    case "/products":
      return (
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

      return (
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
    case "/payment":
    case "/order-status":
    case "/payment-status":
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

      if (route === "/profile") {
        return (
          <ProfilePage
            user={user}
            onNavigate={navigate}
            onLogout={handleLogout}
          />
        );
      }

      if (route === "/payment") {
        return (
          <PaymentPage
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
      return <Home user={user} onNavigate={navigate} onLogout={handleLogout} />;
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


