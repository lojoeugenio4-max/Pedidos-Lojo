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

// Comprobación DIRECTA de si hay una versión nueva desplegada, aparte de
// la del Service Worker de más abajo. Motivo: en la app instalada en
// pantalla de inicio de iOS, volver a tocar el icono muchas veces NO
// relanza la página desde cero -iOS simplemente saca de segundo plano la
// misma página que ya tenía cargada en memoria-, así que ni "load" ni
// "visibilitychange" llegan a disparar ninguna comprobación nueva. Aquí
// se pide el index.html real del servidor (sin caché) y se compara el
// archivo .js principal que contiene con el que está cargado ahora
// mismo en la pantalla: si no coincide, es que hay una versión más
// reciente y se recarga la página para cogerla.
function extraerScriptPrincipal(html) {
  const match = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/i);
  return match ? match[1] : null;
}

async function comprobarVersionNueva() {
  try {
    const scriptActual = document.querySelector('script[type="module"][src]');
    if (!scriptActual) return;

    const respuesta = await fetch(`/index.html?_=${Date.now()}`, {
      cache: "no-store",
    });
    if (!respuesta.ok) return;

    const htmlServidor = await respuesta.text();
    const scriptServidor = extraerScriptPrincipal(htmlServidor);

    if (scriptServidor && scriptServidor !== scriptActual.getAttribute("src")) {
      window.location.reload();
    }
  } catch (error) {
    // Sin conexión o fallo de red: no forzamos nada, se sigue usando la
    // versión que ya hubiera en el móvil.
  }
}

// Se comprueba nada más cargar la página...
window.addEventListener("load", () => {
  comprobarVersionNueva();
});

// ...y también cada vez que la app vuelve a primer plano (tocar el
// icono con la app ya "abierta" de antes en segundo plano, cambiar de
// otra app a esta, etc.), que es precisamente el caso que no quedaba
// cubierto solo con el evento "load".
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    comprobarVersionNueva();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Comprobar aquí mismo, nada más abrir la app (icono de pantalla
        // de inicio), si hay una versión nueva en el servidor. El
        // navegador ya lo hace por su cuenta de vez en cuando, pero de
        // forma bastante espaciada; forzarlo en cada apertura es lo que
        // hace que cada vez que se abra el enlace se coja la última
        // versión, sin depender de esa comprobación automática.
        registration.update().catch(() => {});

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
