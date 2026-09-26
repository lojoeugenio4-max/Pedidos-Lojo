// Orden de preparación de los pedidos por UBICACIÓN de almacén.
//
// Regla única:
//   1. Artículos CON ubicación: por el código de la ubicación (orden
//      "natural": 1, 2, 10… y A-1, A-2, A-10…). Si varios artículos
//      comparten ubicación, entre ellos por nombre alfabético.
//   2. Artículos SIN ubicación: al final, por nombre alfabético.
//
// Se usa en el resumen del cliente, en el mensaje de WhatsApp, en
// "Pedidos recibidos" (ver, imprimir y CSV) y en Estadísticas.

function textoLimpio(valor) {
  return String(valor ?? "").trim();
}

export function compararCodigosUbicacion(codigoA, codigoB) {
  return textoLimpio(codigoA).localeCompare(textoLimpio(codigoB), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

function compararNombres(nombreA, nombreB) {
  return textoLimpio(nombreA).localeCompare(textoLimpio(nombreB), "es", {
    sensitivity: "base",
  });
}

/**
 * Compara dos artículos de un pedido. Cada uno se describe con el código
 * de su ubicación (vacío o null = sin ubicación) y su nombre.
 */
export function compararPorUbicacion(codigoUbicacionA, nombreA, codigoUbicacionB, nombreB) {
  const tieneA = textoLimpio(codigoUbicacionA) !== "";
  const tieneB = textoLimpio(codigoUbicacionB) !== "";

  if (tieneA && !tieneB) return -1;
  if (!tieneA && tieneB) return 1;

  if (tieneA && tieneB) {
    const porUbicacion = compararCodigosUbicacion(codigoUbicacionA, codigoUbicacionB);
    if (porUbicacion !== 0) return porUbicacion;
  }

  return compararNombres(nombreA, nombreB);
}

/**
 * Devuelve la ubicación ACTUAL de una línea de pedido guardada en
 * estadisticas_movimientos (se busca por articulo_id), para que si se
 * asigna o cambia la ubicación de un artículo, los pedidos ya recibidos
 * también salgan con el orden nuevo.
 */
export function ubicacionDeLinea(linea, ubicacionPorArticulo = {}) {
  if (linea?.articulo_id == null) return null;
  return ubicacionPorArticulo[String(linea.articulo_id)] || null;
}

/**
 * Ordena las líneas de un pedido tal como se guardan en
 * estadisticas_movimientos (articulo_id, nombre_articulo).
 */
export function ordenarLineasPedido(lineas = [], ubicacionPorArticulo = {}) {
  return lineas.slice().sort((a, b) =>
    compararPorUbicacion(
      ubicacionDeLinea(a, ubicacionPorArticulo)?.codigo,
      a.nombre_articulo,
      ubicacionDeLinea(b, ubicacionPorArticulo)?.codigo,
      b.nombre_articulo
    )
  );
}

/**
 * Carga todas las ubicaciones y la ubicación de cada artículo.
 * Se hace en una consulta APARTE del catálogo a propósito: si algo falla
 * (por ejemplo, si aún no se ha ejecutado migracion_ubicaciones.sql), no
 * se rompe nada; simplemente todos los artículos cuentan como "sin
 * ubicación" y se ordenan alfabéticamente.
 *
 * Devuelve { ok, ubicaciones, porArticulo } donde porArticulo es
 * { [articulo_id]: { id, codigo, nombre } }.
 */
export async function cargarUbicacionesPorArticulo(supabase) {
  const vacio = { ok: false, ubicaciones: [], porArticulo: {} };

  try {
    const { data: ubicacionesData, error: ubicacionesError } = await supabase
      .from("ubicaciones")
      .select("id, codigo, nombre");

    if (ubicacionesError) {
      console.warn("No se pudieron cargar las ubicaciones:", ubicacionesError);
      return vacio;
    }

    const ubicaciones = (ubicacionesData || [])
      .slice()
      .sort((a, b) => compararCodigosUbicacion(a.codigo, b.codigo));

    const porId = {};
    ubicaciones.forEach((ubicacion) => {
      porId[String(ubicacion.id)] = ubicacion;
    });

    const porArticulo = {};
    const TAMANO_PAGINA = 1000;
    let desde = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from("articulos")
        .select("id, ubicacion_id")
        .not("ubicacion_id", "is", null)
        .order("id", { ascending: true })
        .range(desde, desde + TAMANO_PAGINA - 1);

      if (error) {
        console.warn("No se pudo cargar la ubicación de los artículos:", error);
        return { ok: false, ubicaciones, porArticulo: {} };
      }

      (data || []).forEach((articulo) => {
        const ubicacion = porId[String(articulo.ubicacion_id)];
        if (ubicacion) porArticulo[String(articulo.id)] = ubicacion;
      });

      if (!data || data.length < TAMANO_PAGINA) break;
      desde += TAMANO_PAGINA;
    }

    return { ok: true, ubicaciones, porArticulo };
  } catch (error) {
    console.warn("Error cargando ubicaciones:", error);
    return vacio;
  }
}
