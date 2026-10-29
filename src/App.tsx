import { Route, Routes } from "react-router-dom";
import { PageLayout } from "./components/layout/PageLayout";
import HomePage from "./pages/HomePage";
import EventPage from "./pages/EventPage";
import NotFoundPage from "./pages/NotFoundPage";

// Which page shows for which address.
export default function App() {
  return (
    <Routes>
      <Route element={<PageLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
