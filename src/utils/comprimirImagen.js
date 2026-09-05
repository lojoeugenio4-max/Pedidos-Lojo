// Redimensiona y comprime una foto en el propio navegador antes de
// subirla a Supabase Storage. Las fotos hechas con el móvil suelen
// pesar varios MB y medir miles de píxeles de lado, pero en la app se
// muestran en tarjetas pequeñas: con cientos de fotos en el catálogo,
// eso es lo que más nota un cliente al cargar el catálogo. Reducir
// aquí, una sola vez al subir la foto, evita mandar ese peso a todos
// los clientes que abran la app después.
//
// No usa ninguna librería nueva: usa <canvas>, que ya viene en el
// navegador.

const MAX_LADO_PX = 900; // lado más largo tras redimensionar
const CALIDAD_JPEG = 0.75;

/**
 * @param {File} archivo - archivo original tal cual viene del <input type="file">
 * @returns {Promise<File>} nuevo archivo comprimido, en JPEG, listo para subir
 */
export async function comprimirImagen(archivo) {
  if (!archivo || !archivo.type?.startsWith("image/")) {
    return archivo;
  }

  try {
    const bitmap = await createImageBitmap(archivo);

    const escala = Math.min(1, MAX_LADO_PX / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;

    const contexto = canvas.getContext("2d");
    contexto.drawImage(bitmap, 0, 0, ancho, alto);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", CALIDAD_JPEG)
    );

    if (!blob) return archivo; // por si el navegador no puede: subimos la original antes que fallar

    // Si por lo que sea la "comprimida" sale más pesada que la original
    // (puede pasar con imágenes ya muy pequeñas), nos quedamos con la
    // original.
    if (blob.size >= archivo.size) return archivo;

    const nombreBase = archivo.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${nombreBase}.jpg`, { type: "image/jpeg" });
  } catch (error) {
    console.error("No se pudo comprimir la imagen, se sube la original", error);
    return archivo; // nunca bloqueamos la subida por un fallo de compresión
  }
}
