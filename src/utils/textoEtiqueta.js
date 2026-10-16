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
// 0-100: palabras leídas con menos seguridad se ignoran. Es bajo a
// propósito: lo que se lea solo cuenta si coincide con un nombre del
// catálogo, así que el "ruido" no estorba.
const CONFIANZA_MINIMA = 35;

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

  // 1ª lectura: en gris y con el contraste estirado. Con letras sobre
  // fondos de color (p. ej. MAIZENA negro sobre amarillo) se lee mucho
  // mejor que en color.
  const gris = document.createElement("canvas");
  gris.width = lienzo.width;
  gris.height = lienzo.height;
  const ctxGris = gris.getContext("2d");
  ctxGris.drawImage(lienzo, 0, 0);
  pasarAGrisConContraste(ctxGris, gris.width, gris.height);

  const tokens = new Set();
  await leerPalabras(lector, gris, tokens);

  // 2ª lectura, en color: según el envase, unas palabras salen mejor en
  // gris y otras en color, así que se juntan las dos.
  await leerPalabras(lector, lienzo, tokens);

  return [...tokens];
}

async function leerPalabras(lector, lienzo, tokens) {
  const { data } = await lector.recognize(lienzo, {}, { text: true, blocks: true });
  (data?.blocks || []).forEach((bloque) =>
    (bloque.paragraphs || []).forEach((parrafo) =>
      (parrafo.lines || []).forEach((linea) =>
        (linea.words || []).forEach((palabra) => {
          const segura = (palabra.confidence || 0) >= CONFIANZA_MINIMA;
          trocear(palabra.text).forEach((t) => {
            if (!tokenUtilOCR(t)) return;
            // Las palabras leídas con poca seguridad solo se guardan si son
            // largas: suelen ser varias palabras pegadas
            // ("ELMAIZDELAREBUJINA") y dentro puede haber una marca.
            if (segura || t.length >= 8) tokens.add(t);
          });
        })
      )
    )
  );
}

// Escala de grises + "autocontraste" (el 1 % más oscuro pasa a negro y el
// 1 % más claro a blanco).
function pasarAGrisConContraste(ctx, ancho, alto) {
  const imagen = ctx.getImageData(0, 0, ancho, alto);
  const d = imagen.data;
  const histograma = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = y;
    histograma[y] += 1;
  }
  const total = ancho * alto;
  let acumulado = 0;
  let bajo = 0;
  while (bajo < 255 && acumulado + histograma[bajo] < total * 0.01) acumulado += histograma[bajo++];
  acumulado = 0;
  let alto2 = 255;
  while (alto2 > 0 && acumulado + histograma[alto2] < total * 0.01) acumulado += histograma[alto2--];
  const rango = Math.max(1, alto2 - bajo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, Math.round(((d[i] - bajo) * 255) / rango)));
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(imagen, 0, 0);
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
// Admite fallos de lectura ("MALENA" ↔ "maizena", "REVILA" ↔ "revilla")
// y las abreviaturas típicas del catálogo ("CERV" ↔ "cerveza"), pero no
// confunde una palabra con otra más larga que empieza igual ("leche" no
// es "lechera").
function coinciden(ocr, nombre) {
  if (ocr === nombre) return true;
  const esNumero = /^[0-9]+$/.test(nombre);
  if (esNumero || /^[0-9]+$/.test(ocr)) return false;
  // Abreviaturas del catálogo ("CERV" ↔ "cerveza"). Con al menos 2 letras
  // de diferencia: "natural" NO es la marca "NATURA".
  if (nombre.length >= 3 && ocr.length >= nombre.length + 2 && ocr.startsWith(nombre)) return true;
  if (ocr.length > nombre.length && ocr.startsWith(nombre)) return false;
  if (nombre.length > ocr.length && nombre.startsWith(ocr)) return false;
  // Palabras pegadas: "elmaizdelarebujina" contiene "rebujina".
  if (nombre.length >= 5 && ocr.length >= nombre.length + 2 && ocr.includes(nombre)) return true;
  // Palabras largas (marcas como FUENTELAJARA): se admiten hasta 1 fallo
  // cada 4 letras, aunque falle el principio ("Nentelajara").
  if (nombre.length >= 8 && ocr.length >= 7) {
    const maximo = Math.floor(nombre.length / 4);
    return distancia(ocr, nombre, maximo) <= maximo;
  }
  // Fallos de lectura: solo si empiezan igual (las dos primeras letras).
  // Sin esto "harina" se confundía con "pardina" y "fina" con "piña".
  if (nombre.length >= 5 && ocr.length >= 4 && ocr.slice(0, 2) === nombre.slice(0, 2)) {
    const maximo = nombre.length >= 7 && ocr.length >= 5 ? 2 : 1;
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

  const indice = { porProducto, peso, frecuencia };
  cacheIndices.set(productos, indice);
  return indice;
}

// Puntuación de texto (0 a 1) para cada artículo, según las palabras
// leídas en la etiqueta. Devuelve un Map id → puntos (solo los que > 0).
// soloIds (opcional): puntuar solo estos artículos (los finalistas por
// forma). La rareza de cada palabra se sigue midiendo en TODO el catálogo.
export function puntuarPorTexto(tokensLeidos, productos, soloIds = null) {
  const resultado = new Map();
  if (!tokensLeidos?.length || !productos?.length) return resultado;

  const { porProducto, peso, frecuencia } = indiceCatalogo(productos);

  // Qué palabras del catálogo aparecen en la etiqueta (se calcula una vez
  // por palabra distinta, no por artículo).
  const encontradas = new Set();
  peso.forEach((_, palabraNombre) => {
    if (tokensLeidos.some((leida) => coinciden(leida, palabraNombre))) encontradas.add(palabraNombre);
  });
  if (!encontradas.size) return resultado;

  // Por cada artículo:
  //   cobertura = qué parte de su nombre se ha leído,
  //   acertado  = cuánto pesa lo leído (suma),
  //   rareza    = 1 / en cuántos artículos sale la palabra más rara
  //               leída. Una marca que solo tiene este artículo (MAIZENA)
  //               decide; una palabra que tienen varios (MAÍZ, HARINA)
  //               cuenta mucho menos.
  let maximoAcertado = 0;
  let maximaRareza = 0;
  const parciales = [];
  porProducto.forEach(({ producto, tokens }) => {
    if (!tokens.length) return;
    if (soloIds && !soloIds.has(String(producto.id))) return;
    let acertado = 0;
    let totalPeso = 0;
    let rareza = 0;
    tokens.forEach((t) => {
      const w = peso.get(t) || 0;
      totalPeso += w;
      if (encontradas.has(t)) {
        acertado += w;
        const r = 1 / (frecuencia.get(t) || 1);
        if (r > rareza) rareza = r;
      }
    });
    if (acertado > 0) {
      parciales.push({ id: String(producto.id), acertado, rareza, cobertura: acertado / (totalPeso || 1) });
      if (acertado > maximoAcertado) maximoAcertado = acertado;
      if (rareza > maximaRareza) maximaRareza = rareza;
    }
  });

  parciales.forEach(({ id, acertado, rareza, cobertura }) => {
    resultado.set(
      id,
      0.2 * cobertura + 0.15 * (acertado / maximoAcertado) + 0.65 * (rareza / maximaRareza)
    );
  });
  return resultado;
}
