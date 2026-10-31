import { Navigate, Route, Routes } from "react-router-dom";
import { PageLayout } from "./components/layout/PageLayout";
import HomePage from "./pages/HomePage";
import EventPage from "./pages/EventPage";
import NotFoundPage from "./pages/NotFoundPage";
import {
  CreateOrganizerEventPage,
  ManageOrganizerEventsPage,
  MyOrganizerEventsPage,
  OrganizerDashboardLayout,
  OrganizerGuard,
} from "./pages/OrganizerPage";

// Which page shows for which address.
export default function App() {
  return (
    <Routes>
      <Route element={<PageLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="/organizer" element={<OrganizerGuard />}>
          <Route element={<OrganizerDashboardLayout />}>
            <Route index element={<Navigate to="events" replace />} />
            <Route path="events" element={<MyOrganizerEventsPage />} />
            <Route path="create" element={<CreateOrganizerEventPage />} />
            <Route path="manage" element={<ManageOrganizerEventsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
