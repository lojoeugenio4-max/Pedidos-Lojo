// Orden de departamentos para el resumen del pedido (pantalla del cliente
// y mensaje de WhatsApp): estos departamentos deben salir siempre los
// primeros, en este orden exacto. El resto de departamentos van después,
// por orden alfabético, igual que hasta ahora.
export const DEPARTAMENTOS_PRIORITARIOS_PEDIDO = [
  "CERVEZAS",
  "REFRESCOS 2L / 1.5L",
  "REFRESCOS LATAS",
  "BEBIDAS ENERGÉTICAS",
  "AGUAS",
];

// Normaliza el nombre para comparar sin que afecten mayúsculas, tildes,
// espacios dobles o los espacios alrededor de la barra: así "Refrescos
// 2L/1.5L", "REFRESCOS 2L / 1.5L" o "Bebidas energeticas" se reconocen igual.
function normalizarDepartamento(nombreDepartamento) {
  return String(nombreDepartamento || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

const PRIORITARIOS_NORMALIZADOS = DEPARTAMENTOS_PRIORITARIOS_PEDIDO.map(normalizarDepartamento);

function indicePrioridadDepartamento(nombreDepartamento) {
  const indice = PRIORITARIOS_NORMALIZADOS.indexOf(normalizarDepartamento(nombreDepartamento));
  return indice === -1 ? PRIORITARIOS_NORMALIZADOS.length : indice;
}

/**
 * Compara dos nombres de departamento para ordenar el pedido: primero los
 * departamentos prioritarios (por el orden fijado arriba) y, tras ellos,
 * el resto por orden alfabético.
 */
export function compararDepartamentosPedido(deptA, deptB) {
  const prioridadA = indicePrioridadDepartamento(deptA);
  const prioridadB = indicePrioridadDepartamento(deptB);

  if (prioridadA !== prioridadB) return prioridadA - prioridadB;

  return String(deptA || "").localeCompare(String(deptB || ""), "es", {
    sensitivity: "base",
  });
}

/**
 * Ordena las líneas de un pedido tal como se guardan en
 * estadisticas_movimientos (campos departamento y nombre_articulo), con el
 * mismo criterio que el resumen del cliente y el WhatsApp. Se usa en
 * "Pedidos recibidos" (pantalla, impresión y CSV para el almacén).
 */
export function ordenarLineasPedido(lineas = []) {
  return lineas.slice().sort((a, b) => {
    const porDepartamento = compararDepartamentosPedido(a.departamento, b.departamento);
    if (porDepartamento !== 0) return porDepartamento;
    return String(a.nombre_articulo || "").localeCompare(String(b.nombre_articulo || ""), "es", {
      sensitivity: "base",
    });
  });
}
