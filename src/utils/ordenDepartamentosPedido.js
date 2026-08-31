// Orden de departamentos para el resumen del pedido (pantalla del cliente
// y mensaje de WhatsApp): estos departamentos deben salir siempre los
// primeros, en este orden exacto. El resto de departamentos van después,
// por orden alfabético, igual que hasta ahora.
export const DEPARTAMENTOS_PRIORITARIOS_PEDIDO = [
  "CERVEZAS",
  "REFRESCOS 2L / 1.5L",
  "REFRESCOS LATAS",
  "AGUAS",
];

function indicePrioridadDepartamento(nombreDepartamento) {
  const normalizado = String(nombreDepartamento || "").trim().toUpperCase();
  const indice = DEPARTAMENTOS_PRIORITARIOS_PEDIDO.indexOf(normalizado);
  return indice === -1 ? DEPARTAMENTOS_PRIORITARIOS_PEDIDO.length : indice;
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
