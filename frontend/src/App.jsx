import { Navigate, Route, Routes } from "react-router-dom";
import DefaultLayout from "./layouts/DefaultLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import CanteenHome from "./pages/CanteenHome";
import Menu from "./pages/Menu";
import { Login, Register } from "./pages/AuthPages";
import { OrderDetails, Orders, Profile } from "./pages/PlaceholderPages";
import Cart from "./pages/Cart";
import OrderPreview from "./pages/OrderPreview";
import PaymentPreparation from "./pages/PaymentPreparation";
import AdminLayout from "./layouts/AdminLayout";
import RoleProtectedRoute from "./routes/RoleProtectedRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminQueue from "./pages/admin/AdminQueue";
import MenuManagement from "./pages/admin/MenuManagement";
import CanteenManagement from "./pages/admin/CanteenManagement";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import StaffManagement from "./pages/admin/StaffManagement";

export default function App() {
  return (
    <Routes>
      <Route element={<DefaultLayout />}>
        <Route path="/" element={<CanteenHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/canteen/:canteenId" element={<CanteenHome />} />
        <Route path="/menu" element={<Menu />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<OrderPreview />} />
          <Route path="/payment/:orderId" element={<PaymentPreparation />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:orderId" element={<OrderDetails />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        </Route>
        <Route element={<RoleProtectedRoute roles={["STAFF", "ADMIN"]} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/queue" element={<AdminQueue />} />
            <Route path="/admin/menu" element={<MenuManagement />} />
            <Route element={<RoleProtectedRoute roles={["ADMIN"]} />}>
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/canteens" element={<CanteenManagement />} />
              <Route path="/admin/staff" element={<StaffManagement />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
