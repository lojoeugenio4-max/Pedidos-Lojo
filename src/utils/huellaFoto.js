// "Huella visual" de una foto para el pedido por cámara.
//
// Un modelo de visión (DINOv2 small) convierte cada foto en una lista de
// 384 números que resume cómo es la imagen (colores, formas, etiqueta...).
// Dos fotos del mismo artículo dan huellas parecidas, así que para
// reconocer la foto del cliente basta con buscar en Supabase las huellas
// del catálogo más cercanas a la suya.
//
// El modelo se ejecuta EN EL NAVEGADOR (no cuesta nada por foto). Se
// descarga la primera vez (~24 MB) y luego queda guardado en el móvil.
//
// IMPORTANTE: las huellas del catálogo (Admin → Búsqueda por foto) y la
// del cliente se tienen que calcular con el MISMO modelo y la MISMA
// preparación de la imagen. Si algún día se cambia MODELO_HUELLA, hay que
// cambiar también VERSION_HUELLA y volver a preparar el catálogo.

export const MODELO_HUELLA = "onnx-community/dinov2-small";
export const VERSION_HUELLA = "dinov2s-q8-v1";
const TIPO_MODELO = "q8"; // model_quantized.onnx (~24 MB)
const LADO_MAXIMO = 512; // la foto se reduce antes de pasarla al modelo

// La librería de reconocimiento se carga desde internet (CDN) solo cuando
// se usa la cámara. Así no hace falta instalarla en el proyecto ni en
// Vercel, y no pesa nada para quien no usa la cámara.
const URL_LIBRERIA = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";
let cargaLibreria = null;
function cargarLibreria() {
  if (!cargaLibreria) {
    cargaLibreria = import(/* @vite-ignore */ URL_LIBRERIA).catch((error) => {
      cargaLibreria = null;
      throw error;
    });
  }
  return cargaLibreria;
}

let cargaModelo = null;
const avisosProgreso = new Set();

function avisarProgreso(info) {
  avisosProgreso.forEach((fn) => {
    try {
      fn(info);
    } catch {
      // nada
    }
  });
}

// Carga el modelo una sola vez (aunque se llame varias veces a la vez).
// onProgreso recibe { fase: "descargando" | "listo", porcentaje }.
export async function prepararModeloHuella(onProgreso) {
  if (onProgreso) avisosProgreso.add(onProgreso);

  if (!cargaModelo) {
    cargaModelo = (async () => {
      const { AutoModel, AutoProcessor, env } = await cargarLibreria();
      env.allowLocalModels = false;

      const descargas = new Map();
      const progreso = (dato) => {
        if (dato?.status === "progress" && dato.file) {
          descargas.set(dato.file, { cargado: dato.loaded || 0, total: dato.total || 0 });
          let cargado = 0;
          let total = 0;
          descargas.forEach((d) => {
            cargado += d.cargado;
            total += d.total;
          });
          avisarProgreso({
            fase: "descargando",
            porcentaje: total ? Math.round((cargado / total) * 100) : 0,
          });
        }
      };

      const [procesador, modelo] = await Promise.all([
        AutoProcessor.from_pretrained(MODELO_HUELLA),
        AutoModel.from_pretrained(MODELO_HUELLA, {
          dtype: TIPO_MODELO,
          device: "wasm",
          progress_callback: progreso,
        }),
      ]);

      avisarProgreso({ fase: "listo", porcentaje: 100 });
      return { procesador, modelo };
    })().catch((error) => {
      cargaModelo = null; // para poder reintentar
      throw error;
    });
  }

  try {
    return await cargaModelo;
  } finally {
    if (onProgreso) avisosProgreso.delete(onProgreso);
  }
}

// Abre una imagen (File/Blob o URL) como <img>. Con URL se pide con CORS
// para poder leer sus píxeles (Supabase Storage lo permite).
function abrirImagen(origen) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let urlTemporal = null;

    if (typeof origen === "string") {
      // El "?huella=1" hace que no se use la copia de la foto que guarda
      // el service worker para el catálogo: esa copia se pidió sin CORS y
      // el navegador no dejaría leer sus píxeles.
      img.crossOrigin = "anonymous";
      img.src = origen + (origen.includes("?") ? "&" : "?") + "huella=1";
    } else {
      urlTemporal = URL.createObjectURL(origen);
      img.src = urlTemporal;
    }

    img.onload = () => {
      if (urlTemporal) URL.revokeObjectURL(urlTemporal);
      resolve(img);
    };
    img.onerror = () => {
      if (urlTemporal) URL.revokeObjectURL(urlTemporal);
      reject(new Error("No se pudo abrir la imagen"));
    };
  });
}

// Pasa la imagen a un lienzo con fondo BLANCO (las fotos del catálogo con
// fondo transparente saldrían si no con fondo negro) y la reduce.
function imagenALienzo(img) {
  const ancho = img.naturalWidth || img.width;
  const alto = img.naturalHeight || img.height;
  const escala = Math.min(1, LADO_MAXIMO / Math.max(ancho, alto));
  const w = Math.max(1, Math.round(ancho * escala));
  const h = Math.max(1, Math.round(alto * escala));

  const lienzo = document.createElement("canvas");
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return lienzo;
}

// Reduce la foto del cliente a un JPG pequeño (para mostrarla en pantalla
// sin gastar memoria).
export async function miniaturaFoto(archivo, lado = 320) {
  const img = await abrirImagen(archivo);
  const ancho = img.naturalWidth || img.width;
  const alto = img.naturalHeight || img.height;
  const escala = Math.min(1, lado / Math.max(ancho, alto));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(ancho * escala);
  lienzo.height = Math.round(alto * escala);
  lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
  return lienzo.toDataURL("image/jpeg", 0.8);
}

function normalizar(vector) {
  let suma = 0;
  for (let i = 0; i < vector.length; i += 1) suma += vector[i] * vector[i];
  const norma = Math.sqrt(suma) || 1;
  return Array.from(vector, (v) => Number((v / norma).toFixed(6)));
}

// Calcula la huella de una imagen (File/Blob de la cámara o URL de una
// foto del catálogo). Devuelve un array normal de números, listo para
// mandarlo a Supabase.
export async function calcularHuella(origen) {
  const { procesador, modelo } = await prepararModeloHuella();
  const { RawImage } = await cargarLibreria();

  const img = await abrirImagen(origen);
  const lienzo = imagenALienzo(img);
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  const rgba = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;

  const rgb = new Uint8ClampedArray(lienzo.width * lienzo.height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  const imagen = new RawImage(rgb, lienzo.width, lienzo.height, 3);

  const entradas = await procesador(imagen);
  const salida = await modelo(entradas);

  // Resumen global de la imagen: el "pooler_output" si el modelo lo da y,
  // si no, el primer token (CLS) de la última capa.
  let datos;
  if (salida.pooler_output) {
    datos = salida.pooler_output.data;
  } else {
    const ultima = salida.last_hidden_state;
    const dim = ultima.dims[ultima.dims.length - 1];
    datos = ultima.data.slice(0, dim);
  }

  return normalizar(datos);
}
