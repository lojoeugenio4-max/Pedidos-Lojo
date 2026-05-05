import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// 👉 Esto evita el zoom en móvil
let viewport = document.querySelector("meta[name=viewport]");

if (!viewport) {
  viewport = document.createElement("meta");
  viewport.setAttribute("name", "viewport");
  document.head.appendChild(viewport);
}

viewport.setAttribute(
  "content",
  "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
);

createRoot(document.getElementById("root")).render(<App />);import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
