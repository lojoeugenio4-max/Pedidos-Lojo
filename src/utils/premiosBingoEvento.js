import { supabase } from "../supabaseClient";

// Aviso en tiempo real (Supabase Realtime broadcast, igual que
// qrPendientesEvento.js) de que un cliente ACABA de conseguir un premio de
// Bingo en caja. Lo escucha la pantalla de almacén ("Pedidos recibidos") para
// avisar al momento de que hay un regalo pendiente de entregar, esté en el
// mismo ordenador que el TPV o en otro distinto.
const CANAL_PREMIOS_BINGO = "lojo-premios-bingo-sync";
const EVENTO_PREMIO_GANADO = "premio-ganado";

// Si en esta misma pestaña ya hay un canal suscrito (el de escucha), se usa
// ese para enviar; si no, se crea uno de usar y tirar que envía por REST y se
// elimina después, para no dejar canales colgados ni romper el de escucha.
async function enviarBroadcast(payload) {
  const topic = `realtime:${CANAL_PREMIOS_BINGO}`;
  const existente = supabase.getChannels().find((c) => c.topic === topic);
  if (existente) {
    await existente.send({ type: "broadcast", event: EVENTO_PREMIO_GANADO, payload });
    return;
  }
  const temporal = supabase.channel(CANAL_PREMIOS_BINGO);
  try {
    await temporal.send({ type: "broadcast", event: EVENTO_PREMIO_GANADO, payload });
  } finally {
    supabase.removeChannel(temporal);
  }
}

export function notificarPremioBingo(datos) {
  const payload = { ...datos, en: Date.now() };
  enviarBroadcast(payload).catch((err) => {
    console.warn("No se pudo avisar en tiempo real del premio de Bingo:", err);
  });
  // Mismo ordenador (el TPV y la pantalla de almacén en pestañas distintas):
  // el broadcast de Supabase no se devuelve al propio emisor, así que se
  // avisa también en local.
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_LOCAL, { detail: payload }));
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(CANAL_PREMIOS_BINGO);
      bc.postMessage(payload);
      bc.close();
    }
  } catch {
    /* sin aviso local */
  }
}

const EVENTO_LOCAL = "lojo-premio-bingo-local";

export function suscribirseAPremiosBingo(alRecibir) {
  const canal = supabase.channel(CANAL_PREMIOS_BINGO);
  canal
    .on("broadcast", { event: EVENTO_PREMIO_GANADO }, ({ payload }) => alRecibir(payload))
    .subscribe();

  const alLocal = (evento) => alRecibir(evento.detail);
  window.addEventListener(EVENTO_LOCAL, alLocal);

  let bc = null;
  if (typeof BroadcastChannel !== "undefined") {
    bc = new BroadcastChannel(CANAL_PREMIOS_BINGO);
    bc.onmessage = (evento) => alRecibir(evento.data);
  }

  return () => {
    supabase.removeChannel(canal);
    window.removeEventListener(EVENTO_LOCAL, alLocal);
    bc?.close();
  };
}
