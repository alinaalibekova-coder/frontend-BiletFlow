import { Navigate, Route, Routes } from "react-router-dom";
import { PageLayout } from "./components/layout/PageLayout";
import HomePage from "./pages/HomePage";
import EventPage from "./pages/EventPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
import { EventCheckInPage, MyAccountPage, PlatformAdminPage } from "./pages/AccountPages";
import { OrganizerEventStaffPage, OrganizerSalesPage } from "./pages/OrganizerInsightsPage";
import { RoleGuard } from "./pages/RoleGuard";
import NotFoundPage from "./pages/NotFoundPage";
import {
  CreateOrganizerEventPage,
  EditOrganizerEventPage,
  ManageOrganizerEventsPage,
  MyOrganizerEventsPage,
  OrganizerDashboardLayout,
  OrganizerGuard,
  OrganizerTicketsPage,
} from "./pages/OrganizerPage";

// Which page shows for which address.
export default function App() {
  return (
    <Routes>
      <Route element={<PageLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="/orders/:orderId" element={<OrderConfirmationPage />} />
        <Route path="/account" element={<MyAccountPage />} />
        <Route path="/staff" element={<RoleGuard roles={["EVENT_ADMIN", "EVENT_STAFF", "CHECK_IN_STAFF"]}><EventCheckInPage /></RoleGuard>} />
        <Route path="/admin/users" element={<RoleGuard roles={["PLATFORM_ADMIN", "ADMIN"]}><PlatformAdminPage /></RoleGuard>} />
        <Route path="/organizer" element={<OrganizerGuard />}>
          <Route element={<OrganizerDashboardLayout />}>
            <Route index element={<Navigate to="events" replace />} />
            <Route path="events" element={<MyOrganizerEventsPage />} />
            <Route path="events/:eventId/tickets" element={<OrganizerTicketsPage />} />
            <Route path="events/:eventId/edit" element={<EditOrganizerEventPage />} />
            <Route path="events/:eventId/staff" element={<OrganizerEventStaffPage />} />
            <Route path="create" element={<CreateOrganizerEventPage />} />
            <Route path="manage" element={<ManageOrganizerEventsPage />} />
            <Route path="sales" element={<OrganizerSalesPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
