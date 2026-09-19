// Control de la pantalla grande (TV, ?display=1) desde CUALQUIER pantalla del
// TPV — en concreto desde "Pedidos recibidos", que es lo primero que se abre
// y donde todavía no se ha escaneado ningún QR.
//
// Antes la TV solo se abría desde StorePage (?store=1), es decir, después de
// pasar el primer QR de un cliente, así que hasta ese momento no se podía ver
// ni el Bombo de Bingo ni el Sorteo.
//
// La TV y el TPV son el mismo ordenador con dos monitores (mismo navegador),
// por eso se comunican por localStorage + BroadcastChannel, igual que ya hace
// StorePage con Ruleta/Bingo/Sorteo.

export const DISPLAY_EVENT_KEY = "lojo-ruleta-display-event";
export const DISPLAY_CHANNEL = "lojo-ruleta-display";
export const VISTA_REPOSO_KEY = "lojo-tv-vista-reposo";
const NOMBRE_VENTANA_TV = "lojo-tv-grande";

// Vistas que se pueden dejar en la pantalla grande mientras no hay ningún
// cliente jugando.
export const VISTAS_REPOSO = ["bingo", "sorteo"];

// Qué se muestra en la TV entre cliente y cliente. Por defecto el Bombo de
// Bingo (como siempre); si en "Pedidos recibidos" se elige el Sorteo, se
// queda en el Sorteo hasta que se vuelva a elegir el Bombo.
export function leerVistaReposo() {
  try {
    return localStorage.getItem(VISTA_REPOSO_KEY) === "sorteo" ? "sorteo" : "bingo";
  } catch {
    return "bingo";
  }
}

export function enviarEventoDisplay(type, payload = {}) {
  if (typeof window === "undefined") return;

  const event = { type, payload, createdAt: Date.now() };

  try {
    localStorage.setItem(DISPLAY_EVENT_KEY, JSON.stringify(event));
  } catch {}

  try {
    const channel = new BroadcastChannel(DISPLAY_CHANNEL);
    channel.postMessage(event);
    channel.close();
  } catch {}
}

// Coloca la ventana de la TV en el OTRO monitor (no en el del TPV).
//
// Antes se colocaba "a la derecha del ancho del monitor actual", que solo
// acierta si la TV está a la derecha y tiene la misma resolución; si no, el
// navegador la dejaba en el monitor del TPV. Ahora se le pregunta al
// navegador por los monitores reales (Window Management API, Chrome/Edge):
// la primera vez pide permiso para "gestionar ventanas en todas las
// pantallas" y hay que pulsar Permitir.
//
// Devuelve "ok", "un-monitor" (solo se detecta un monitor), "denegado"
// (permiso no concedido) o "sin-api" (navegador sin esa función).
async function colocarEnMonitorTV(ventana) {
  if (typeof window.getScreenDetails !== "function") return "sin-api";

  let detalles;
  try {
    detalles = await window.getScreenDetails();
  } catch {
    return "denegado";
  }

  const actual = detalles.currentScreen;
  const otros = (detalles.screens || []).filter(
    (monitor) => monitor.left !== actual.left || monitor.top !== actual.top
  );
  if (!otros.length) return "un-monitor";

  // Con más de dos monitores, la TV es el más grande de los que no son el TPV.
  const tv = otros.reduce((mejor, monitor) =>
    monitor.width * monitor.height > mejor.width * mejor.height ? monitor : mejor
  );

  try {
    ventana.moveTo(tv.availLeft ?? tv.left, tv.availTop ?? tv.top);
    ventana.resizeTo(tv.availWidth ?? tv.width, tv.availHeight ?? tv.height);
  } catch {}

  return "ok";
}

const AVISO_MONITOR = {
  "un-monitor":
    "Solo detecto un monitor. Comprueba en Windows (Win+P) que la pantalla está en modo «Extender».",
  denegado:
    "No he podido saber cuál es el monitor de la TV. Si la ventana salió en el TPV, arrástrala una vez a la TV y se quedará ahí. Para que salga sola, permite «gestionar ventanas en todas las pantallas» en los permisos del sitio (icono junto a la dirección).",
  "sin-api":
    "Este navegador no permite elegir monitor. Si la ventana salió en el TPV, arrástrala una vez a la TV y se quedará ahí. Con Chrome o Edge sale sola en la TV.",
};

// Abre la TV grande (o la trae al frente) y, si se indica `vista`, la deja
// mostrando el Bombo de Bingo ("bingo") o el Sorteo ("sorteo"). Debe llamarse
// desde un clic para que el navegador no bloquee la ventana. Devuelve false si
// el navegador la bloqueó. `onAviso(texto)` se llama si no se ha podido
// colocar la ventana en el monitor de la TV.
//
// Si la ventana YA estaba abierta NO se recarga: solo cambia de vista por el
// aviso de arriba, y se recoloca en el monitor de la TV (por si estaba en el
// del TPV).
export function abrirPantallaGrande({ vista, onAviso } = {}) {
  if (typeof window === "undefined") return false;

  if (VISTAS_REPOSO.includes(vista)) {
    try {
      localStorage.setItem(VISTA_REPOSO_KEY, vista);
    } catch {}
    // Se avisa ANTES de abrir: si la ventana es nueva, al cargar aplica este
    // último aviso guardado; si ya estaba abierta, cambia al instante.
    enviarEventoDisplay("vista-reposo", { vista });
  }

  const url = new URL(window.location.href);
  url.search = "?display=1";
  url.hash = "";

  // Posición de reserva (navegadores sin detección de monitores): a la
  // derecha del monitor del TPV, como se hacía antes.
  const ancho = window.screen?.width || window.innerWidth || 1920;
  const alto = window.screen?.height || window.innerHeight || 1080;

  let ventana = null;
  try {
    // Con URL vacía, si ya hay una ventana con ese nombre se reutiliza tal
    // cual (sin recargarla); si no, se crea una nueva y en blanco.
    ventana = window.open("", NOMBRE_VENTANA_TV, `left=${ancho},top=0,width=${ancho},height=${alto}`);
  } catch {}

  if (!ventana) return false;

  let esNueva = false;
  try {
    esNueva = ventana.location.href === "about:blank";
    if (esNueva) ventana.location.href = url.toString();
  } catch {}

  try {
    ventana.focus();
  } catch {}

  // Se pide la lista de monitores AQUÍ, sin esperar antes a nada, para que
  // siga valiendo el permiso del clic. La ventana ya está abierta, así que el
  // bloqueador de ventanas emergentes no interviene.
  colocarEnMonitorTV(ventana).then((resultado) => {
    // Si no se pudo detectar el monitor, solo avisamos cuando la ventana es
    // nueva: una que ya estaba abierta puede estar ya bien colocada a mano.
    if (resultado !== "ok" && esNueva) onAviso?.(AVISO_MONITOR[resultado] || "");
  });

  return true;
}
