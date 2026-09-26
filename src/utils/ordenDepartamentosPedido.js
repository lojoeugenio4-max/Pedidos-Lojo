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
    .normalize("NFD")A
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

// Reglas de reconocimiento de los departamentos prioritarios. No se exige
// el nombre EXACTO: basta con que el nombre del departamento (tal como
// está en Supabase, sin tildes y en mayúsculas) encaje con la regla. Así
// da igual que en el Admin se llame "AGUA" o "AGUAS", "ENERGÉTICAS" o
// "BEBIDAS ENERGÉTICAS", "CERVEZA" o "CERVEZAS", "REFRESCOS 2L/1,5L" o
// "REFRESCOS 2L / 1.5L". Antes se exigía coincidencia exacta, y en cuanto
// un departamento tenía un nombre algo distinto (o se renombraba en el
// Admin) dejaba de reconocerse y el pedido salía desordenado.
// El orden de esta lista es el orden en que salen en el pedido.
const REGLAS_PRIORITARIAS = [
  (n) => /^CERVEZ/.test(n), // CERVEZAS
  (n) => /REFRESC/.test(n) && !/LATA/.test(n) && /(2 ?L|1[.,]5)/.test(n), // REFRESCOS 2L / 1.5L
  (n) => /REFRESC/.test(n) && /LATA/.test(n), // REFRESCOS LATAS
  (n) => /ENERG/.test(n), // BEBIDAS ENERGÉTICAS
  (n) => /^AGUAS?\b/.test(n), // AGUAS
];

function indicePrioridadDepartamento(nombreDepartamento) {
  const normalizado = normalizarDepartamento(nombreDepartamento);
  if (!normalizado) return REGLAS_PRIORITARIAS.length;
  const indice = REGLAS_PRIORITARIAS.findIndex((regla) => regla(normalizado));
  return indice === -1 ? REGLAS_PRIORITARIAS.length : indice;
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
