// Búsqueda de un artículo por su código de barras (EAN).
//
// Los EAN de cada artículo están en la columna "eans" de la tabla
// "articulos" (lista de códigos: unidad, caja, pack...). Se cargan con
// supabase/migracion_eans.sql y se pueden cambiar en el Admin, en la ficha
// del artículo.
import { supabase } from "../supabaseClient";

// Limpia el código leído: sin espacios ni caracteres de control.
// Se aceptan códigos de cualquier tamaño (EAN-13, EAN-8, cajas de 14
// cifras, códigos largos GS1-128...).
export function normalizarEan(codigo) {
  return String(codigo || "")
    .replace(/[\s\u0000-\u001f]/g, "")
    .trim();
}

// Formas en que el mismo código puede estar guardado en la base de datos.
function variantesCodigo(codigo) {
  const limpio = normalizarEan(codigo);
  const variantes = new Set([limpio]);
  if (/^\d+$/.test(limpio)) {
    // UPC-A (12 cifras) = EAN-13 con un 0 delante, y al revés.
    if (limpio.length === 12) variantes.add(`0${limpio}`);
    if (limpio.length === 13 && limpio.startsWith("0")) variantes.add(limpio.slice(1));
    // Código de caja de 14 cifras que empieza por 0 = EAN-13 del producto.
    if (limpio.length === 14 && limpio.startsWith("0")) variantes.add(limpio.slice(1));
  }
  // Código largo GS1-128: "01" + 14 cifras del producto + más datos.
  const gs1 = limpio.match(/^01(\d{14})/);
  if (gs1) {
    variantes.add(gs1[1]);
    if (gs1[1].startsWith("0")) variantes.add(gs1[1].slice(1));
  }
  return [...variantes].filter(Boolean);
}

// Devuelve los artículos (de la lista "productos" que ve el cliente) que
// llevan ese EAN. Normalmente uno; puede haber más si dos artículos
// comparten código.
export async function buscarArticulosPorEan(codigo, productos) {
  const variantes = variantesCodigo(codigo);
  if (!variantes.length) return [];

  const { data, error } = await supabase
    .from("articulos")
    .select("id")
    .overlaps("eans", variantes)
    // Si no hay conexión, que no se quede esperando para siempre.
    .abortSignal(AbortSignal.timeout(8000));

  if (error) throw error;

  const porId = new Map((productos || []).map((p) => [String(p.id), p]));
  return (data || []).map((fila) => porId.get(String(fila.id))).filter(Boolean);
}
