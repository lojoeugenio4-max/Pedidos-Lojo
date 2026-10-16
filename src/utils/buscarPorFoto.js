// Búsqueda de un artículo a partir de una foto, en dos pasos:
//   1) FORMA (en el móvil, gratis): se compara la foto con las del
//      catálogo (huella visual) y se quedan los 30 artículos más parecidos.
//   2) MARCA (IA, Claude Haiku): la foto y esos 30 nombres se mandan a la
//      función de Supabase "identificar-articulo". La IA lee la marca, el
//      producto y el formato en el envase y elige cuál de los 30 es.
//      Si no es ninguno, lo que ha leído se busca por nombre en todo el
//      catálogo.
// La usan la app del cliente y la prueba del Admin, para que den lo mismo.
import { supabase } from "../supabaseClient";
import { VERSION_HUELLA, calcularHuella, miniaturaFoto, prepararModeloHuella } from "./huellaFoto";
import { puntuarPorTexto } from "./textoEtiqueta";

const CANDIDATOS_POR_FORMA = 30;
// Tamaño de la foto que se manda a la IA (lado mayor). Con 768 px cuesta
// unos 800 "tokens" y la marca se lee perfectamente.
const LADO_FOTO_IA = 768;

// Empieza a cargar el modelo de forma (se llama al pulsar el botón de la
// cámara, para que vaya avanzando mientras el cliente hace la foto).
export function precargarBusquedaPorFoto() {
  prepararModeloHuella().catch(() => {});
}

async function finalistasPorForma(archivo, porId, onProgreso) {
  await prepararModeloHuella(onProgreso);
  const huella = await calcularHuella(archivo);
  const { data, error } = await supabase.rpc("buscar_articulos_por_foto", {
    p_huella: JSON.stringify(huella),
    p_version: VERSION_HUELLA,
    p_limite: CANDIDATOS_POR_FORMA,
  });
  if (error) throw error;
  return (data || [])
    .map((fila) => ({ producto: porId.get(String(fila.articulo_id)), similitud: Number(fila.similitud) || 0 }))
    .filter((f) => f.producto);
}

async function preguntarIA(archivo, finalistas) {
  const foto = await miniaturaFoto(archivo, LADO_FOTO_IA);
  const { data, error } = await supabase.functions.invoke("identificar-articulo", {
    body: {
      imagen: foto,
      candidatos: finalistas.map(({ producto }) => ({
        id: String(producto.id),
        nombre: producto.name ?? producto.nombre,
      })),
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// productos: lista de artículos visibles ({ id, name | nombre, ... }).
// Devuelve { resultados: [{ producto, similitud, puntosTexto, puntos }], palabrasLeidas, errorIA }
export async function buscarArticulosPorFoto(archivo, productos, { onProgreso, limite = 6 } = {}) {
  const lista = productos || [];
  const porId = new Map(lista.map((p) => [String(p.id), p]));

  // Paso 1: forma.
  let finalistas = [];
  try {
    finalistas = await finalistasPorForma(archivo, porId, onProgreso);
  } catch (error) {
    console.warn("No se pudo comparar la forma:", error);
  }

  // Paso 2: la IA lee la marca y elige.
  let ia = null;
  let errorIA = "";
  try {
    ia = await preguntarIA(archivo, finalistas);
  } catch (error) {
    console.warn("No se pudo preguntar a la IA:", error);
    errorIA = String(error?.message || error);
  }

  if (!finalistas.length && !ia) throw new Error("No se pudo buscar la foto");

  const palabrasLeidas = ia ? [ia.marca, ia.producto, ia.formato].filter(Boolean) : [];
  const similitudes = new Map(finalistas.map((f) => [String(f.producto.id), f.similitud]));
  const resultados = [];
  const yaPuestos = new Set();
  const poner = (id, puntosTexto) => {
    const clave = String(id);
    const producto = porId.get(clave);
    if (!producto || yaPuestos.has(clave)) return;
    yaPuestos.add(clave);
    const similitud = similitudes.get(clave) || 0;
    resultados.push({ producto, similitud, puntosTexto, puntos: similitud + 2 * puntosTexto });
  };

  // a) Lo que ha elegido la IA, y lo que ve como posible.
  if (ia?.id) poner(ia.id, 1);
  (ia?.otros || []).forEach((id) => poner(id, 0.8));

  // b) Si la IA no lo ha visto entre los de forma parecida, se busca lo que
  //    ha leído (marca, producto, formato) por nombre en TODO el catálogo.
  if (!ia?.id && palabrasLeidas.length) {
    const tokens = [];
    palabrasLeidas.forEach((t) =>
      String(t)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((p) => p.length >= 3)
        .forEach((p) => tokens.push(p))
    );
    const porNombre = puntuarPorTexto(tokens, lista);
    [...porNombre.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limite)
      .forEach(([id, puntos]) => poner(id, puntos * 0.7));
  }

  // c) El resto, por parecido de forma.
  finalistas.forEach((f) => poner(f.producto.id, 0));

  return { resultados: resultados.slice(0, limite), palabrasLeidas, errorIA };
}
