// Búsqueda de un artículo por su código de barras (EAN).
//
// Los EAN de cada artículo están en la columna "eans" de la tabla
// "articulos" (lista de códigos: unidad, caja, pack...). Se cargan con
// supabase/migracion_eans.sql y se pueden cambiar en el Admin, en la ficha
// del artículo.
import { supabase } from "../supabaseClient";

// Deja el código como EAN-13: solo cifras, y los UPC-A de 12 cifras
// (productos americanos) con un 0 delante, que es su EAN-13.
export function normalizarEan(codigo) {
  const cifras = String(codigo || "").replace(/\D/g, "");
  if (cifras.length === 12) return `0${cifras}`;
  return cifras;
}

export function eanValido(codigo) {
  return /^\d{13}$/.test(String(codigo || "").trim());
}

// Devuelve los artículos (de la lista "productos" que ve el cliente) que
// llevan ese EAN. Normalmente uno; puede haber más si dos artículos
// comparten código.
export async function buscarArticulosPorEan(codigo, productos) {
  const ean = normalizarEan(codigo);
  if (!ean) return [];

  const { data, error } = await supabase
    .from("articulos")
    .select("id")
    .contains("eans", [ean])
    // Si no hay conexión, que no se quede esperando para siempre.
    .abortSignal(AbortSignal.timeout(8000));

  if (error) throw error;

  const porId = new Map((productos || []).map((p) => [String(p.id), p]));
  return (data || []).map((fila) => porId.get(String(fila.id))).filter(Boolean);
}
