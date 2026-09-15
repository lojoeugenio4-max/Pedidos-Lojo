import { supabase } from "../supabaseClient";

// Canal de Supabase Realtime (broadcast puro, sin tabla ni RLS de por medio)
// usado para avisar a la pestaña "QR pendientes" del Admin, en cuanto se
// posible, de que un código se acaba de leer en caja — así desaparece al
// instante en vez de esperar al refresco periódico. Funciona entre
// dispositivos distintos (a diferencia de BroadcastChannel/localStorage, que
// solo sincronizan pestañas del MISMO ordenador, como ya se usa entre
// StorePage y DisplayPage).
const CANAL_QR_PENDIENTES = "lojo-qr-pendientes-sync";
const EVENTO_QR_LEIDO = "qr-leido";

let canalEnvioCache = null;

function obtenerCanalEnvio() {
  if (canalEnvioCache) return canalEnvioCache;
  canalEnvioCache = supabase.channel(CANAL_QR_PENDIENTES);
  canalEnvioCache.subscribe();
  return canalEnvioCache;
}

// Se llama justo cuando validate_game_qr confirma que un código es válido y
// tenía algo pendiente (es decir, se acaba de "leer" de verdad en caja).
export function notificarQrLeido({ orderId, code }) {
  try {
    const canal = obtenerCanalEnvio();
    canal.send({
      type: "broadcast",
      event: EVENTO_QR_LEIDO,
      payload: { orderId: orderId || null, code: code || null, en: Date.now() },
    });
  } catch (err) {
    console.warn("No se pudo avisar en tiempo real de la lectura del QR:", err);
  }
}

// Usado por QrPendientes.jsx (Admin) para escuchar esos avisos.
export function suscribirseAQrLeidos(alRecibir) {
  const canal = supabase.channel(CANAL_QR_PENDIENTES);
  canal
    .on("broadcast", { event: EVENTO_QR_LEIDO }, ({ payload }) => alRecibir(payload))
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
