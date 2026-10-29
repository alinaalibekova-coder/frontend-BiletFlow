import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { CategoryNav } from "./CategoryNav";
import { LoginModal } from "../auth/LoginModal";

// The frame shared by every page. <Outlet /> is where the current page appears.
export function PageLayout() {
  return (
    <div className="min-h-screen bg-white text-black">
      <Header />
      <CategoryNav />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <LoginModal />
    </div>
  );
}
