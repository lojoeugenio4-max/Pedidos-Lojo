// Búsqueda de un artículo a partir de una foto, combinando dos pistas:
//   1) Cuánto se parece la foto a la foto del catálogo (huella visual).
//   2) Las palabras de la etiqueta que coinciden con el nombre del artículo.
// La usan la app del cliente y la prueba del Admin, para que den lo mismo.
import { supabase } from "../supabaseClient";
import { VERSION_HUELLA, calcularHuella, prepararModeloHuella } from "./huellaFoto";
import { leerTextoEtiqueta, prepararLectorEtiqueta, puntuarPorTexto } from "./textoEtiqueta";

const CANDIDATOS_POR_FOTO = 40;
const CANDIDATOS_POR_TEXTO = 20;
// Cuánto pesa el texto frente a la foto. Con 1, si se lee la marca en la
// etiqueta (p. ej. MAIZENA), ese artículo pasa por delante de cualquier
// envase que solo "se parezca" a la vista.
export const PESO_TEXTO = 1;
// Cuándo el texto "manda" (ver más abajo).
const TEXTO_CLARO = 0.65;
const VENTAJA_CLARA = 0.15;

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
      p_limite: CANDIDATOS_POR_FOTO,
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

  const puntosTexto = puntuarPorTexto(palabrasLeidas, productos || []);

  if (filasFoto === null && !puntosTexto.size) {
    throw new Error("No se pudo buscar la foto");
  }

  const similitudes = new Map();
  (filasFoto || []).forEach((fila) => {
    similitudes.set(String(fila.articulo_id), Number(fila.similitud) || 0);
  });
  // Los que no salen entre los parecidos por foto cuentan como el menos
  // parecido de la lista (no como cero, para no hundirlos del todo).
  const similitudMinima = similitudes.size ? Math.min(...similitudes.values()) : 0;

  const candidatos = new Set(similitudes.keys());
  [...puntosTexto.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, CANDIDATOS_POR_TEXTO)
    .forEach(([id]) => candidatos.add(id));

  const resultados = [...candidatos]
    .map((id) => {
      const producto = porId.get(id);
      if (!producto) return null;
      const similitud = similitudes.has(id) ? similitudes.get(id) : similitudMinima;
      const texto = puntosTexto.get(id) || 0;
      return { producto, similitud, puntosTexto: texto, puntos: similitud + PESO_TEXTO * texto };
    })
    .filter(Boolean)
    .sort((a, b) => b.puntos - a.puntos);

  // Si la etiqueta señala claramente un artículo (p. ej. se ha leído
  // MAIZENA y solo hay un artículo con esa palabra), ese va el primero
  // aunque otra foto "se parezca" más.
  const porTextoOrdenados = [...puntosTexto.entries()].sort((a, b) => b[1] - a[1]);
  if (porTextoOrdenados.length) {
    const [idLider, puntosLider] = porTextoOrdenados[0];
    const segundo = porTextoOrdenados[1]?.[1] || 0;
    if (puntosLider >= TEXTO_CLARO && puntosLider - segundo >= VENTAJA_CLARA) {
      const posicion = resultados.findIndex((r) => String(r.producto.id) === idLider);
      if (posicion > 0) resultados.unshift(resultados.splice(posicion, 1)[0]);
    }
  }

  return { resultados: resultados.slice(0, limite), palabrasLeidas };

}
