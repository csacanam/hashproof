import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Verify from "./pages/Verify.jsx";
import Entity from "./pages/Entity.jsx";
import Docs from "./pages/Docs.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/verify/:id" element={<Verify />} />
      <Route path="/entities/:id" element={<Entity />} />
      <Route path="/docs" element={<Docs />} />
    </Routes>
  );
}

export default App;
