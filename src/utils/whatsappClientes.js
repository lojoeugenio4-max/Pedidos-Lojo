// Utilidades para el envío masivo de enlaces personales por WhatsApp desde
// el ADMIN de Clientes. Reutiliza el mismo formato de número (código de
// país sin "+" ni "00") que ya usa src/utils/whatsappPedido.js para el
// número del negocio (WHATSAPP_NUMBER = "34670716744").

// Los teléfonos de clientes se guardan como el usuario los escriba
// (con espacios, guiones, con o sin prefijo). Aquí los normalizamos al
// formato que necesita wa.me: solo dígitos, con prefijo de país.
export function formatearTelefonoWhatsApp(telefono) {
  if (!telefono) return "";

  let limpio = String(telefono).trim().replace(/[^\d+]/g, "");
  if (!limpio) return "";

  if (limpio.startsWith("+")) {
    limpio = limpio.slice(1);
  } else if (limpio.startsWith("00")) {
    limpio = limpio.slice(2);
  }

  // Móvil/fijo español de 9 dígitos sin prefijo -> se antepone 34.
  if (limpio.length === 9 && /^[6789]/.test(limpio)) {
    limpio = `34${limpio}`;
  }

  // Si tras limpiar quedan muy pocos dígitos, no es un teléfono usable.
  return limpio.length >= 9 ? limpio : "";
}

// Sustituye los placeholders {nombre} y {enlace} de la plantilla editable
// por los datos reales de cada cliente.
export function construirMensajeClienteWhatsApp({ plantilla, nombre, enlace }) {
  return String(plantilla || "")
    .replaceAll("{nombre}", nombre || "")
    .replaceAll("{enlace}", enlace || "");
}

// Construye la URL wa.me lista para abrir en una pestaña nueva. Devuelve
// "" si el teléfono no es válido, para que quien la llame pueda avisar.
export function construirUrlWhatsApp({ telefono, texto }) {
  const numero = formatearTelefonoWhatsApp(telefono);
  if (!numero) return "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto || "")}`;
}
