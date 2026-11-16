// Búsqueda de un artículo por su código de barras (EAN).
//
// Los EAN de cada artículo están en la columna "eans" de la tabla
// "articulos" (lista de códigos: unidad, caja, pack...). Se cargan con
// supabase/migracion_eans.sql o con "Importar CSV" en el Admin, y se pueden
// cambiar en el Admin, en la ficha del artículo.
import { supabase } from "../supabaseClient";

// Limpia el código: solo letras y números (fuera espacios, puntos, guiones,
// caracteres invisibles...). Se aceptan códigos de cualquier tamaño.
export function normalizarEan(codigo) {
  return String(codigo || "")
    .normalize("NFKC")
    .replace(/[^0-9A-Za-z]/g, "");
}

// Comprueba el dígito de control GS1 (EAN-8, UPC-A, EAN-13, ITF-14...).
export function digitoControlValido(codigo) {
  const cifras = String(codigo || "");
  if (!/^\d{8,18}$/.test(cifras)) return false;
  let suma = 0;
  const cuerpo = cifras.slice(0, -1);
  for (let i = 0; i < cuerpo.length; i += 1) {
    const cifra = Number(cuerpo[cuerpo.length - 1 - i]);
    suma += i % 2 === 0 ? cifra * 3 : cifra;
  }
  return (10 - (suma % 10)) % 10 === Number(cifras[cifras.length - 1]);
}

// Formas en que el mismo código puede estar guardado en la base de datos.
function variantesCodigo(codigo) {
  const limpio = normalizarEan(codigo);
  const variantes = new Set([limpio]);
  if (/^\d+$/.test(limpio)) {
    // Con y sin ceros delante: "0041234567890", "041234567890",
    // "41234567890"... (UPC-A/EAN-13, cajas de 14 cifras, o códigos a los
    // que Excel o el programa de gestión les quitó los ceros).
    const sinCeros = limpio.replace(/^0+/, "");
    if (sinCeros) {
      variantes.add(sinCeros);
      [8, 12, 13, 14].forEach((largo) => {
        if (sinCeros.length < largo) variantes.add(sinCeros.padStart(largo, "0"));
      });
    }
  }
  // Código largo GS1-128: "01" + 14 cifras del producto + más datos.
  const gs1 = limpio.match(/^01(\d{14})/);
  if (gs1) {
    variantes.add(gs1[1]);
    const sinCeros = gs1[1].replace(/^0+/, "");
    variantes.add(sinCeros);
    variantes.add(sinCeros.padStart(13, "0"));
  }
  return [...variantes].filter(Boolean);
}

// Busca el código y separa:
//   - encontrados: artículos que el cliente puede pedir (están en "productos").
//   - noDisponibles: tienen ese código pero no están en la app del cliente
//     (ocultos o desactivados).
export async function buscarPorEanDetalle(codigo, productos) {
  const variantes = variantesCodigo(codigo);
  if (!variantes.length) return { encontrados: [], noDisponibles: [] };

  const { data, error } = await supabase
    .from("articulos")
    .select("id, nombre, activo, oculto")
    .overlaps("eans", variantes)
    // Si no hay conexión, que no se quede esperando para siempre.
    .abortSignal(AbortSignal.timeout(8000));

  if (error) throw error;

  const porId = new Map((productos || []).map((p) => [String(p.id), p]));
  const encontrados = [];
  const noDisponibles = [];
  (data || []).forEach((fila) => {
    const producto = porId.get(String(fila.id));
    if (producto) encontrados.push(producto);
    else noDisponibles.push(fila);
  });
  return { encontrados, noDisponibles };
}

// Devuelve los artículos (de la lista "productos" que ve el cliente) que
// llevan ese EAN. Normalmente uno; puede haber más si dos artículos
// comparten código.
export async function buscarArticulosPorEan(codigo, productos) {
  const { encontrados } = await buscarPorEanDetalle(codigo, productos);
  return encontrados;
}

// Texto para avisar de que el artículo existe pero no se puede pedir.
export function motivoNoDisponible(articulo) {
  if (!articulo) return "";
  if (articulo.activo === false) return "desactivado";
  if (articulo.oculto) return "oculto";
  return "no disponible";
}
