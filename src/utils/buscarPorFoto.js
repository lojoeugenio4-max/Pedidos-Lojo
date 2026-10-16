// Búsqueda de un artículo a partir de una foto, en dos pasos:
//   1) FORMA: se compara la foto con las del catálogo (huella visual) y se
//      quedan los 30 artículos más parecidos.
//   2) ETIQUETA: entre esos 30 (y solo entre esos), gana el que tiene en su
//      nombre las palabras leídas en la etiqueta. Así la etiqueta nunca
//      puede traer un artículo de forma distinta (agua → jamón).
// La usan la app del cliente y la prueba del Admin, para que den lo mismo.
import { supabase } from "../supabaseClient";
import { VERSION_HUELLA, calcularHuella, prepararModeloHuella } from "./huellaFoto";
import { leerTextoEtiqueta, prepararLectorEtiqueta, puntuarPorTexto } from "./textoEtiqueta";

// Paso 1: cuántos artículos "de forma parecida" pasan a la final.
const CANDIDATOS_POR_FORMA = 30;
// Paso 2: dentro de esos, lo que coincide la etiqueta pesa el doble que el
// parecido de la foto (la foto solo desempata).
export const PESO_TEXTO = 2;

// Empieza a cargar todo (se llama al pulsar el botón de la cámara, para
// que vaya avanzando mientras el cliente hace la foto).
export function precargarBusquedaPorFoto() {
  prepararModeloHuella().catch(() => {});
  prepararLectorEtiqueta().catch(() => {});
}

// productos: lista de artículos visibles ({ id, name | nombre, ... }).
// Devuelve { resultados: [{ producto, similitud, puntosTexto, puntos }], palabrasLeidas }
export async function buscarArticulosPorFoto(archivo, productos, { onProgreso, limite = 6 } = {}) {
  const porId = new Map((productos || []).map((p) => [String(p.id), p]));

  // Las dos lecturas van a la vez.
  const porFoto = (async () => {
    await prepararModeloHuella(onProgreso);
    const huella = await calcularHuella(archivo);
    const { data, error } = await supabase.rpc("buscar_articulos_por_foto", {
      p_huella: JSON.stringify(huella),
      p_version: VERSION_HUELLA,
      p_limite: CANDIDATOS_POR_FORMA,
    });
    if (error) throw error;
    return data || [];
  })();

  const porTexto = leerTextoEtiqueta(archivo).catch((error) => {
    // Si el OCR falla (sin conexión al CDN, etc.) se sigue solo con la foto.
    console.warn("No se pudo leer la etiqueta:", error);
    return [];
  });

  const [filasFoto, palabrasLeidas] = await Promise.all([
    porFoto.catch((error) => {
      console.warn("No se pudo comparar la foto:", error);
      return null;
    }),
    porTexto,
  ]);

  // Paso 1: la lista corta por forma.
  const finalistas = (filasFoto || [])
    .map((fila) => ({ producto: porId.get(String(fila.articulo_id)), similitud: Number(fila.similitud) || 0 }))
    .filter((f) => f.producto);

  // Si la comparación de fotos falla del todo (sin conexión, etc.), se
  // busca solo por la etiqueta en todo el catálogo, para no dejar al
  // cliente sin nada.
  if (!finalistas.length) {
    const soloTexto = puntuarPorTexto(palabrasLeidas, productos || []);
    if (!soloTexto.size) throw new Error("No se pudo buscar la foto");
    const resultados = [...soloTexto.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, texto]) => ({ producto: porId.get(id), similitud: 0, puntosTexto: texto, puntos: texto }))
      .filter((r) => r.producto)
      .slice(0, limite);
    return { resultados, palabrasLeidas };
  }

  // Paso 2: la etiqueta elige SOLO entre los finalistas. Lo "rara" que es
  // cada palabra se mide en todo el catálogo: MAIZENA (un artículo) pesa
  // mucho más que HARINA o NATURAL (muchos artículos).
  const puntosTexto = puntuarPorTexto(
    palabrasLeidas,
    productos || [],
    new Set(finalistas.map((f) => String(f.producto.id)))
  );

  const resultados = finalistas
    .map(({ producto, similitud }) => {
      const texto = puntosTexto.get(String(producto.id)) || 0;
      return { producto, similitud, puntosTexto: texto, puntos: similitud + PESO_TEXTO * texto };
    })
    .sort((a, b) => b.puntos - a.puntos);

  return { resultados: resultados.slice(0, limite), palabrasLeidas };
}
