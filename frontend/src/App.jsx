import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Verify from "./pages/Verify.jsx";
import Entity from "./pages/Entity.jsx";
import Compare from "./pages/Compare.jsx";
import Docs from "./pages/Docs.jsx";
import EntityVerification from "./pages/EntityVerification.jsx";
import Preview from "./pages/Preview.jsx";

const DashboardRoutes = lazy(() => import("./app/DashboardRoutes.jsx"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function MiniPayConnect() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) {
      window.ethereum.request({ method: "eth_requestAccounts" }).catch(() => {});
    }
  }, []);
  return null;
}

/**
 * Sign-in links from Supabase land with the session in the fragment. If one
 * arrives anywhere other than /app/auth (an invitation sent before the redirect
 * was set, Supabase falling back to the site URL), hand it to the page that
 * reads it instead of dropping it.
 */
function useStrayAuthFragment() {
  const { pathname, hash } = useLocation();
  if (pathname !== "/app/auth" && /(^|[#&])(access_token|error_description)=/.test(hash)) {
    return `/app/auth${hash}`;
  }
  return null;
}

function App() {
  const authRedirect = useStrayAuthFragment();
  if (authRedirect) return <Navigate to={authRedirect} replace />;
  return (
    <>
      <ScrollToTop />
      <MiniPayConnect />
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/verify/:id" element={<Verify />} />
      <Route path="/entities/:id" element={<Entity />} />
      <Route path="/vs/:slug" element={<Compare />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/entity-verification" element={<EntityVerification />} />
      <Route path="/preview/:slug" element={<Preview />} />
      <Route
        path="/app/*"
        element={
          <Suspense fallback={<div className="dash-loading" />}>
            <DashboardRoutes />
          </Suspense>
        }
      />
    </Routes>
    </>
  );
}

export default App;
