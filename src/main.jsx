import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Antes "Admin" se importaba de forma fija (import normal) igual que
// "App", así que TODO su código —incluido admin/Configuracion.jsx, que
// carga de golpe las 877 fotos de producto de src/assets/productos
// (35 MB) y el propio App.jsx entero como texto plano— acababa metido
// en el mismo paquete .js que descarga cualquier cliente que entra a
// hacer un pedido, aunque jamás vaya a abrir el panel de Admin. Con
// lazy() + Suspense, ese código pesado solo se descarga cuando alguien
// entra de verdad con ?admin en la URL.
const Admin = lazy(() => import("./admin"));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("No se pudo registrar la aplicación instalable:", error);
    });
  });
}

const adminMode = window.location.search.includes("admin");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {adminMode ? (
      <Suspense fallback={null}>
        <Admin />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
