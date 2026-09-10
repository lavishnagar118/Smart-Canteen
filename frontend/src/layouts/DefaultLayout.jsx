import { Outlet } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import Navbar from "../components/Navbar";
import CustomerAIChat from "../components/ai/CustomerAIChat";

export default function DefaultLayout() {
  return (
    <div className="min-h-screen bg-[#f7f8f6]">
      <Navbar />
      <Outlet />
      <BottomNavigation />
      <CustomerAIChat />
    </div>
  );
}
