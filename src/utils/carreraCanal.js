// LA LOCA CARRERA DE LOJO · aviso de la TV grande al TPV.
//
// El TPV tira el dado (carrera_tirar_qr) y manda la tirada a la TV con
// enviarEventoDisplay("carrera-tirada"). La TV la reproduce en el tablero
// (escenas de villanos, amigos, palets...) y, al acabar, avisa por aquí para
// que el TPV pase a la siguiente tirada. TV y TPV son el mismo ordenador
// (mismo navegador): BroadcastChannel + localStorage, igual que el resto.

const CANAL = "lojo-carrera-tv";
const CLAVE = "lojo-carrera-tv-fin";

export function avisarFinTiradaCarrera(token) {
  const msg = { tipo: "fin", token, en: Date.now() };
  try {
    const bc = new BroadcastChannel(CANAL);
    bc.postMessage(msg);
    bc.close();
  } catch {
    /* sin BroadcastChannel */
  }
  try {
    localStorage.setItem(CLAVE, JSON.stringify(msg));
  } catch {
    /* sin localStorage */
  }
}

// Llama a alTerminar(token) cada vez que la TV acaba una tirada. Devuelve la
// función para dejar de escuchar.
export function escucharFinTiradaCarrera(alTerminar) {
  let bc = null;
  try {
    bc = new BroadcastChannel(CANAL);
    bc.onmessage = (e) => e.data?.tipo === "fin" && alTerminar(e.data.token);
  } catch {
    /* sin BroadcastChannel */
  }
  const alStorage = (e) => {
    if (e.key !== CLAVE || !e.newValue) return;
    try {
      const msg = JSON.parse(e.newValue);
      if (msg?.tipo === "fin") alTerminar(msg.token);
    } catch {
      /* mensaje roto */
    }
  };
  window.addEventListener("storage", alStorage);
  return () => {
    bc?.close?.();
    window.removeEventListener("storage", alStorage);
  };
}
