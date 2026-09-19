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

// Abre la TV grande (o la trae al frente si ya estaba abierta) y, si se indica
// `vista`, la deja mostrando el Bombo de Bingo ("bingo") o el Sorteo
// ("sorteo"). Debe llamarse desde un clic para que el navegador no bloquee la
// ventana. Devuelve false si el navegador la bloqueó.
//
// Si la ventana YA estaba abierta NO se recarga: solo cambia de vista por el
// aviso de arriba. Así no se pierde nada de lo que hubiera en esa ventana.
export function abrirPantallaGrande({ vista } = {}) {
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

  // Misma colocación que ya usaba StorePage: a partir del ancho del monitor
  // del TPV, para que caiga en el segundo monitor del escritorio extendido.
  const ancho = window.screen?.width || window.innerWidth || 1920;
  const alto = window.screen?.height || window.innerHeight || 1080;

  let ventana = null;
  try {
    // Con URL vacía, si ya hay una ventana con ese nombre se reutiliza tal
    // cual (sin recargarla); si no, se crea una nueva y en blanco.
    ventana = window.open("", NOMBRE_VENTANA_TV, `left=${ancho},top=0,width=${ancho},height=${alto}`);
  } catch {}

  if (!ventana) return false;

  try {
    if (ventana.location.href === "about:blank") {
      ventana.location.href = url.toString();
    }
  } catch {}

  try {
    ventana.focus();
  } catch {}

  return true;
}
