import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Verify from "./pages/Verify.jsx";
import Entity from "./pages/Entity.jsx";
import Docs from "./pages/Docs.jsx";
import EntityVerification from "./pages/EntityVerification.jsx";
import Preview from "./pages/Preview.jsx";

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

function App() {
  return (
    <>
      <ScrollToTop />
      <MiniPayConnect />
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/verify/:id" element={<Verify />} />
      <Route path="/entities/:id" element={<Entity />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/entity-verification" element={<EntityVerification />} />
      <Route path="/preview/:slug" element={<Preview />} />
    </Routes>
    </>
  );
}

export default App;
