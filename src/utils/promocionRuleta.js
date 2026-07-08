function normalizarCodigo(valor) {
  return String(valor || "").trim();
}

function obtenerCantidadItem(item) {
  return Number(
    item.cantidad ??
      item.quantity ??
      item.unidades ??
      item.boxes ??
      item.cajas ??
      0
  );
}

function obtenerCodigoItem(item) {
  return normalizarCodigo(
    item.codigo_articulo ||
      item.codigo ||
      item.product?.codigo ||
      item.product?.idnum ||
      item.product?.id ||
      ""
  );
}

function obtenerDepartamentoItem(item) {
  return normalizarCodigo(
    item.departamento_id ||
      item.department_id ||
      item.product?.departamento_id ||
      item.product?.department_id ||
      ""
  );
}

function normalizarArticuloPermitido(articulo) {
  if (typeof articulo === "string" || typeof articulo === "number") {
    return {
      codigo: normalizarCodigo(articulo),
      cantidadMinima: 1,
    };
  }

  return {
    codigo: normalizarCodigo(
      articulo.codigo_articulo ||
        articulo.codigo ||
        articulo.idnum ||
        articulo.articulo?.codigo ||
        ""
    ),
    cantidadMinima: Number(articulo.cantidad_minima ?? articulo.cantidadMinima ?? 1),
  };
}

export function calcularResumenArticulosRuleta({
  itemsPedido = [],
  articulosPermitidos = [],
  codigosPermitidos = [],
  departamentosPermitidos = [],
}) {
  const permitidos = [
    ...articulosPermitidos.map(normalizarArticuloPermitido),
    ...codigosPermitidos.map(normalizarArticuloPermitido),
  ].filter((articulo) => articulo.codigo);

  const departamentos = new Set(
    departamentosPermitidos.map((id) => normalizarCodigo(id)).filter(Boolean)
  );

  const cantidadesPorCodigo = new Map();

  itemsPedido.forEach((item) => {
    const codigo = obtenerCodigoItem(item);
    const departamentoId = obtenerDepartamentoItem(item);
    const cantidad = obtenerCantidadItem(item);

    if (!codigo || cantidad <= 0) return;

    const permitidoPorCodigo = permitidos.some(
      (articulo) => articulo.codigo === codigo
    );

    const permitidoPorDepartamento =
      departamentos.size > 0 && departamentos.has(departamentoId);

    if (!permitidoPorCodigo && !permitidoPorDepartamento) return;

    cantidadesPorCodigo.set(
      codigo,
      (cantidadesPorCodigo.get(codigo) || 0) + cantidad
    );
  });

  const articulosConfigurados =
    permitidos.length > 0
      ? permitidos
      : Array.from(cantidadesPorCodigo.keys()).map((codigo) => ({
          codigo,
          cantidadMinima: 1,
        }));

  const articulos = articulosConfigurados.map((articulo) => {
    const cantidad = cantidadesPorCodigo.get(articulo.codigo) || 0;
    const cantidadMinima = Number(articulo.cantidadMinima || 1);

    return {
      codigo: articulo.codigo,
      cantidad,
      cantidadMinima,
      cumple: cantidad >= cantidadMinima,
      restante: Math.max(0, cantidadMinima - cantidad),
    };
  });

  const articulosValidos = articulos.filter((articulo) => articulo.cumple);
  const articulosIncompletos = articulos.filter((articulo) => !articulo.cumple);

  return {
    articulos,
    articulosValidos,
    articulosIncompletos,
    variedadValida: articulosValidos.length,
    totalUnidadesValidas: articulosValidos.reduce(
      (total, articulo) => total + articulo.cantidad,
      0
    ),
  };
}

export function pedidoCumplePromocionRuleta({
  itemsPedido = [],
  articulosPermitidos = [],
  codigosPermitidos = [],
  departamentosPermitidos = [],
  variedadMinima,
  variedad_minima,
}) {
  const minimo = Number(variedadMinima ?? variedad_minima ?? 1);

  const resumen = calcularResumenArticulosRuleta({
    itemsPedido,
    articulosPermitidos,
    codigosPermitidos,
    departamentosPermitidos,
  });

  return resumen.variedadValida >= minimo;
}

export function obtenerResumenPromocionRuleta({
  itemsPedido = [],
  articulosPermitidos = [],
  codigosPermitidos = [],
  departamentosPermitidos = [],
  variedadMinima,
  variedad_minima,
}) {
  const minimo = Number(variedadMinima ?? variedad_minima ?? 1);

  const resumen = calcularResumenArticulosRuleta({
    itemsPedido,
    articulosPermitidos,
    codigosPermitidos,
    departamentosPermitidos,
  });

  return {
    cumple: resumen.variedadValida >= minimo,
    variedadValida: resumen.variedadValida,
    variedadMinima: minimo,
    variedadRestante: Math.max(0, minimo - resumen.variedadValida),
    totalUnidadesValidas: resumen.totalUnidadesValidas,
    articulosValidos: resumen.articulosValidos,
    articulosIncompletos: resumen.articulosIncompletos,
    articulos: resumen.articulos,
  };
}

export function calcularCajasPermitidasPedido(args) {
  return calcularResumenArticulosRuleta(args).totalUnidadesValidas;
}
