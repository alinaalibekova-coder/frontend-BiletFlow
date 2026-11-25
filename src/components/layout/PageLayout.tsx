import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { CategoryNav } from "./CategoryNav";
import { LoginModal } from "../auth/LoginModal";
import { EmailVerificationNotice } from "../../pages/AuthPages";
import { LanguageProvider } from "../../i18n/LanguageContext";
import { useAuth } from "../../auth/AuthContext";
import { RequestError } from "../events/EventExtras";
import { ToastProvider } from "../ui/Toast";

// The frame shared by every page. <Outlet /> is where the current page appears.
export function PageLayout() {
  const { sessionError } = useAuth();
  const { pathname } = useLocation();
  return (
    <LanguageProvider><ToastProvider><div className="min-h-screen bg-[#fafafc] text-brand">
      <Header />
      <CategoryNav />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <RequestError error={sessionError} />
        <EmailVerificationNotice />
        {/* A short fade-in per page (opacity/transform only; off under reduced motion). */}
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>
      <LoginModal />
    </div></ToastProvider></LanguageProvider>
  );
}
