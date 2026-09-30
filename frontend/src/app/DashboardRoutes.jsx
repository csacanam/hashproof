import { Route, Routes } from "react-router-dom";
import { DashboardProvider } from "./DashboardContext.jsx";
import AppShell from "./AppShell.jsx";
import Login from "./pages/Login.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";
import NewOrganization from "./pages/NewOrganization.jsx";
import Overview from "./pages/Overview.jsx";
import Issue from "./pages/Issue.jsx";
import Credentials from "./pages/Credentials.jsx";
import Templates from "./pages/Templates.jsx";
import TemplateEditor from "./pages/TemplateEditor.jsx";
import Developers from "./pages/Developers.jsx";
import Billing from "./pages/Billing.jsx";
import Team from "./pages/Team.jsx";
import "./dashboard.css";

/** Everything under /app. Loaded lazily from App.jsx so the public pages don't carry it. */
export default function DashboardRoutes() {
  return (
    <DashboardProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="auth" element={<AuthCallback />} />
        <Route path="new" element={<NewOrganization />} />
        <Route element={<AppShell />}>
          <Route index element={<Overview />} />
          <Route path="issue" element={<Issue />} />
          <Route path="credentials" element={<Credentials />} />
          <Route path="templates" element={<Templates />} />
          <Route path="templates/new" element={<TemplateEditor />} />
          <Route path="templates/:id" element={<TemplateEditor />} />
          <Route path="billing" element={<Billing />} />
          <Route path="developers" element={<Developers />} />
          <Route path="team" element={<Team />} />
        </Route>
      </Routes>
    </DashboardProvider>
  );
}
