// Acceso a la carpeta "Pedidos Recibidos" del escritorio usando la File
// System Access API del navegador (showDirectoryPicker). Solo funciona en
// navegadores basados en Chromium (Chrome, Edge) — es justo lo que usan los
// operarios del almacén.
//
// El "handle" de la carpeta elegida se guarda en IndexedDB para no tener que
// volver a elegirla cada vez que se abre la pantalla; Chrome permite
// recordar el permiso de un handle guardado así entre sesiones (aunque, por
// seguridad, puede pedir confirmarlo de nuevo de vez en cuando con
// requestPermission, sin volver a abrir el selector de carpetas).

const DB_NOMBRE = "lojo-admin-carpetas";
const ALMACEN_NOMBRE = "handles";
const CLAVE_CARPETA = "pedidosRecibidos";

function abrirBaseDatos() {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open(DB_NOMBRE, 1);
    peticion.onupgradeneeded = () => {
      peticion.result.createObjectStore(ALMACEN_NOMBRE);
    };
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

async function guardarHandle(handle) {
  const db = await abrirBaseDatos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN_NOMBRE, "readwrite");
    tx.objectStore(ALMACEN_NOMBRE).put(handle, CLAVE_CARPETA);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function leerHandleGuardado() {
  const db = await abrirBaseDatos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN_NOMBRE, "readonly");
    const peticion = tx.objectStore(ALMACEN_NOMBRE).get(CLAVE_CARPETA);
    peticion.onsuccess = () => resolve(peticion.result || null);
    peticion.onerror = () => reject(peticion.error);
  });
}

export function soportaCarpetaEscritorio() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// Comprueba (sin preguntar al usuario) si todavía tenemos permiso de
// lectura/escritura sobre una carpeta ya elegida antes.
export async function tienePermiso(handle) {
  if (!handle) return false;
  try {
    const estado = await handle.queryPermission({ mode: "readwrite" });
    return estado === "granted";
  } catch {
    return false;
  }
}

// Pide permiso sobre una carpeta ya elegida antes (esto SÍ requiere que se
// llame desde un gesto del usuario, p.ej. un click en un botón).
export async function pedirPermiso(handle) {
  if (!handle) return false;
  try {
    const estado = await handle.requestPermission({ mode: "readwrite" });
    return estado === "granted";
  } catch {
    return false;
  }
}

// Recupera la carpeta recordada de una vez anterior (o null si nunca se
// eligió ninguna en este ordenador/navegador).
export async function obtenerCarpetaRecordada() {
  try {
    return await leerHandleGuardado();
  } catch {
    return null;
  }
}

// Abre el selector de carpetas del sistema operativo, empezando en el
// escritorio, para que el operario cree o elija la carpeta "Pedidos
// Recibidos". Debe llamarse desde un gesto del usuario (click de un botón).
export async function elegirCarpetaEscritorio() {
  const handle = await window.showDirectoryPicker({
    id: "pedidos-recibidos-lojo",
    mode: "readwrite",
    startIn: "desktop",
  });
  await guardarHandle(handle);
  return handle;
}

// Genera un nombre de archivo seguro para el sistema de ficheros a partir de
// texto libre (nombre de cliente, etc.), quitando caracteres no permitidos.
export function nombreArchivoSeguro(texto) {
  const limpio = String(texto || "").trim();
  return limpio.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim() || "sin_dato";
}

// Escribe (o sobrescribe) un CSV con BOM UTF-8 dentro de la carpeta dada.
export async function escribirCSVEnCarpeta(carpetaHandle, nombreArchivo, contenidoCSV) {
  const ficheroHandle = await carpetaHandle.getFileHandle(nombreArchivo, { create: true });
  const escritor = await ficheroHandle.createWritable();
  await escritor.write("\uFEFF" + contenidoCSV);
  await escritor.close();
}
