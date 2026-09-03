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
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Cada vez que el cliente vuelve a poner la app en primer plano
        // (abre el icono de pantalla de inicio sin haberla cerrado del
        // todo, o cambia de otra app a esta), se comprueba activamente
        // si hay una versión nueva en el servidor. Sin esto, si el móvil
        // mantiene la app "viva" en segundo plano indefinidamente, podría
        // no comprobarlo por su cuenta durante mucho tiempo.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });
      })
      .catch((error) => {
        console.error("No se pudo registrar la aplicación instalable:", error);
      });
  });

  // Si mientras la app está abierta (o en segundo plano, en el móvil
  // instalado en pantalla de inicio) se activa una versión nueva del
  // Service Worker, la pestaña se recarga sola una vez para que se
  // apliquen los archivos nuevos sin que el cliente tenga que cerrar y
  // volver a abrir la app manualmente.
  let recargando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recargando) return;
    recargando = true;
    window.location.reload();
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
