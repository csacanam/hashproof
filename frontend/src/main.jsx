/**
 * Polyfill for Map.prototype.getOrInsertComputed (used by pdf.js for optional content).
 * Some browsers (especially older desktop) don't support it yet; without this, PDF
 * rendering can throw "getOrInsertComputed is not a function" on the verify page.
 */
if (typeof Map !== "undefined" && !Map.prototype.getOrInsertComputed) {
  Map.prototype.getOrInsertComputed = function (key, callback) {
    if (!this.has(key)) this.set(key, callback(key));
    return this.get(key);
  };
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThirdwebProvider } from "thirdweb/react";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import "./App.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HelmetProvider>
      <ThirdwebProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThirdwebProvider>
    </HelmetProvider>
  </StrictMode>
);
