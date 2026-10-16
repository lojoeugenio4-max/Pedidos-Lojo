// Lectura del texto de la etiqueta (OCR) para el pedido por foto.
//
// Se lee lo que pone en el envase (marca, tipo de producto...) y se
// compara con los nombres de los artículos del catálogo. Así, aunque dos
// envases se parezcan mucho a la vista, la marca escrita ayuda a
// distinguirlos.
//
// Usa Tesseract.js, que funciona dentro del móvil (gratis). La librería y
// el idioma español se descargan de internet la primera vez (~6 MB) y
// luego quedan guardados.

const URL_TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js";
const LADO_MAXIMO_OCR = 1600;
const CONFIANZA_MINIMA = 55; // 0-100: palabras leídas con menos seguridad se ignoran

let cargaLector = null;

// Prepara el lector una sola vez (se reutiliza en las siguientes fotos).
export function prepararLectorEtiqueta() {
  if (!cargaLector) {
    cargaLector = (async () => {
      const modulo = await import(/* @vite-ignore */ URL_TESSERACT);
      const Tesseract = modulo.default || modulo;
      // 1 = motor LSTM (el más preciso).
      return Tesseract.createWorker("spa", 1);
    })().catch((error) => {
      cargaLector = null;
      throw error;
    });
  }
  return cargaLector;
}

function abrirImagen(archivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo abrir la foto"));
    };
    img.src = url;
  });
}

// Lee el texto de la foto. Devuelve las palabras leídas con suficiente
// seguridad (sin repetir), ya normalizadas.
export async function leerTextoEtiqueta(archivo) {
  const lector = await prepararLectorEtiqueta();

  const img = await abrirImagen(archivo);
  const ancho = img.naturalWidth || img.width;
  const alto = img.naturalHeight || img.height;
  const escala = Math.min(1, LADO_MAXIMO_OCR / Math.max(ancho, alto));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(ancho * escala));
  lienzo.height = Math.max(1, Math.round(alto * escala));
  const ctx = lienzo.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

  const { data } = await lector.recognize(lienzo, {}, { text: true, blocks: true });

  const palabras = [];
  (data?.blocks || []).forEach((bloque) =>
    (bloque.paragraphs || []).forEach((parrafo) =>
      (parrafo.lines || []).forEach((linea) =>
        (linea.words || []).forEach((palabra) => {
          if ((palabra.confidence || 0) >= CONFIANZA_MINIMA) palabras.push(palabra.text);
        })
      )
    )
  );

  const tokens = new Set();
  palabras.forEach((p) =>
    trocear(p).forEach((t) => {
      if (tokenUtilOCR(t)) tokens.add(t);
    })
  );
  return [...tokens];
}

// ---------------------------------------------------------------------
// Comparación con los nombres del catálogo
// ---------------------------------------------------------------------

// "Atún en Aceite 3x80g" → ["atun", "en", "aceite", "3", "x", "80", "g"]
export function trocear(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .split(/[^a-z0-9ñ]+/)
    .filter(Boolean);
}

const PALABRAS_VACIAS = new Set([
  "de", "del", "la", "las", "el", "los", "en", "con", "sin", "y", "para", "por", "al",
  "un", "una", "pack", "pck", "caja", "cj", "uds", "ud", "unid", "x", "g", "gr", "kg",
  "ml", "cl", "l", "lt", "lts", "cc",
]);

function tokenUtilNombre(t) {
  if (PALABRAS_VACIAS.has(t)) return false;
  if (/^[0-9]+$/.test(t)) return t.length >= 2;
  return t.length >= 3;
}

function tokenUtilOCR(t) {
  if (PALABRAS_VACIAS.has(t)) return false;
  if (/^[0-9]+$/.test(t)) return t.length >= 2;
  // El OCR inventa muchas "palabras" cortas con el ruido de la foto.
  return t.length >= 3 && /[aeiou]/.test(t);
}

function distancia(a, b, maximo) {
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];
    let minimoFila = i;
    for (let j = 1; j <= b.length; j += 1) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + coste);
      if (actual[j] < minimoFila) minimoFila = actual[j];
    }
    if (minimoFila > maximo) return maximo + 1;
    previa = actual;
  }
  return previa[b.length];
}

// ¿La palabra leída (ocr) corresponde a la palabra del nombre (nombre)?
// Admite fallos de una letra y las abreviaturas típicas del catálogo
// ("CERV" ↔ "cerveza").
function coinciden(ocr, nombre) {
  if (ocr === nombre) return true;
  const esNumero = /^[0-9]+$/.test(nombre);
  if (esNumero || /^[0-9]+$/.test(ocr)) return false;
  if (nombre.length >= 3 && ocr.length > nombre.length && ocr.startsWith(nombre)) return true;
  if (nombre.length >= 4 && ocr.length >= 4) {
    const maximo = nombre.length >= 9 ? 2 : 1;
    return distancia(ocr, nombre, maximo) <= maximo;
  }
  return false;
}

// Prepara el índice de nombres del catálogo (se calcula una vez por lista).
const cacheIndices = new WeakMap();
function indiceCatalogo(productos) {
  if (cacheIndices.has(productos)) return cacheIndices.get(productos);

  const porProducto = productos.map((p) => {
    const tokens = [...new Set(trocear(p.name ?? p.nombre).filter(tokenUtilNombre))];
    return { producto: p, tokens };
  });

  const frecuencia = new Map();
  porProducto.forEach(({ tokens }) =>
    tokens.forEach((t) => frecuencia.set(t, (frecuencia.get(t) || 0) + 1))
  );
  const total = porProducto.length || 1;
  // Palabras raras (marcas) pesan mucho; palabras comunes ("aceite") poco.
  const peso = new Map();
  frecuencia.forEach((n, t) => peso.set(t, Math.log(1 + total / n)));

  const indice = { porProducto, peso };
  cacheIndices.set(productos, indice);
  return indice;
}

// Puntuación de texto (0 a 1) para cada artículo, según las palabras
// leídas en la etiqueta. Devuelve un Map id → puntos (solo los que > 0).
export function puntuarPorTexto(tokensLeidos, productos) {
  const resultado = new Map();
  if (!tokensLeidos?.length || !productos?.length) return resultado;

  const { porProducto, peso } = indiceCatalogo(productos);

  // Qué palabras del catálogo aparecen en la etiqueta (se calcula una vez
  // por palabra distinta, no por artículo).
  const encontradas = new Set();
  peso.forEach((_, palabraNombre) => {
    if (tokensLeidos.some((leida) => coinciden(leida, palabraNombre))) encontradas.add(palabraNombre);
  });
  if (!encontradas.size) return resultado;

  let maximoAcertado = 0;
  const parciales = [];
  porProducto.forEach(({ producto, tokens }) => {
    if (!tokens.length) return;
    let acertado = 0;
    let totalPeso = 0;
    tokens.forEach((t) => {
      const w = peso.get(t) || 0;
      totalPeso += w;
      if (encontradas.has(t)) acertado += w;
    });
    if (acertado > 0) {
      parciales.push({ id: String(producto.id), acertado, cobertura: acertado / (totalPeso || 1) });
      if (acertado > maximoAcertado) maximoAcertado = acertado;
    }
  });

  parciales.forEach(({ id, acertado, cobertura }) => {
    resultado.set(id, 0.5 * cobertura + 0.5 * (acertado / maximoAcertado));
  });
  return resultado;
}
