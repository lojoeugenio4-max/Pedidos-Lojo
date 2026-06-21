import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Admin from "./admin";

const adminMode = window.location.search.includes("admin");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {adminMode ? <Admin /> : <App />}
  </React.StrictMode>
);
