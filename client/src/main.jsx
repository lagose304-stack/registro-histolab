import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <div className="site-shell">
        <App />
        <SiteFooter />
      </div>
    </ErrorBoundary>
  </React.StrictMode>
);
