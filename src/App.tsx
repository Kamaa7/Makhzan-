import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { BootScreen } from "./components/BootScreen";
import { Layout } from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import { useDb } from "./context/DbContext";
import { CustomerStatement } from "./pages/CustomerStatement";
import { Customers } from "./pages/Customers";
import { Home } from "./pages/Home";
import { NewSale } from "./pages/NewSale";
import { ProductLabel } from "./pages/ProductLabel";
import { Products } from "./pages/Products";
import { SaleDetail } from "./pages/SaleDetail";
import { SalePrint } from "./pages/SalePrint";
import { SalesRegister } from "./pages/SalesRegister";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";
import { StoreProfilePage } from "./pages/StoreProfile";

function Guard() {
  const { session, loading } = useAuth();
  const { ready, error } = useDb();
  if (error) return <BootScreen message="Local database failed to open." error={error} />;
  if (!session) return <Navigate to="/signin" replace />;
  if (loading || !ready) return <BootScreen message="Opening Makhzan…" />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/login" element={<Navigate to="/signin" replace />} />
      <Route path="/signup" element={<SignUp />} />
      <Route element={<Guard />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/sale" element={<NewSale />} />
          <Route path="/sales" element={<SalesRegister />} />
          <Route path="/sales/:id" element={<SaleDetail />} />
          <Route path="/products" element={<Products />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerStatement />} />
          <Route path="/store" element={<StoreProfilePage />} />
        </Route>
        <Route path="/sales/:id/print" element={<SalePrint />} />
        <Route path="/products/:id/label" element={<ProductLabel />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
