function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function RuletaArticulosTabla({
  articulos = [],
  articulosSeleccionados = [],
  departamentosSeleccionados = [],
  busqueda = "",
  departamentoFiltro = "TODOS",
  soloSeleccionados = false,
  guardandoId = null,
  onBusqueda,
  onDepartamentoFiltro,
  onSoloSeleccionados,
  onCambiarArticulo,
}) {
  const codigosSeleccionados = new Set(
    articulosSeleccionados.map((item) => String(item.codigo_articulo))
  );

  const departamentosMarcados = new Set(
    departamentosSeleccionados.map((item) => String(item.departamento_id))
  );

  const departamentosDisponibles = Array.from(
    new Map(
      articulos
        .map((articulo) => articulo.departamentos)
        .filter(Boolean)
        .map((departamento) => [String(departamento.id), departamento])
    ).values()
  ).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));

  const texto = normalizar(busqueda);

  const articulosFiltrados = articulos.filter((articulo) => {
    const codigo = normalizar(articulo.codigo);
    const nombre = normalizar(articulo.nombre);
    const departamentoNombre = normalizar(articulo.departamentos?.nombre);

    const coincideBusqueda =
      !texto ||
      codigo.includes(texto) ||
      nombre.includes(texto) ||
      departamentoNombre.includes(texto);

    const coincideDepartamento =
      departamentoFiltro === "TODOS" ||
      String(articulo.departamento_id) === String(departamentoFiltro);

    const seleccionadoIndividual = codigosSeleccionados.has(
      String(articulo.codigo)
    );

    const seleccionadoPorDepartamento = departamentosMarcados.has(
      String(articulo.departamento_id)
    );

    const estaSeleccionado =
      seleccionadoIndividual || seleccionadoPorDepartamento;

    const coincideSeleccionados =
      !soloSeleccionados || estaSeleccionado;

    return coincideBusqueda && coincideDepartamento && coincideSeleccionados;
  });

  return (
    <div style={contenedor}>
      <div style={barraFiltros}>
        <input
          style={input}
          type="text"
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder="Buscar por código, nombre o departamento..."
        />

        <select
          style={select}
          value={departamentoFiltro}
          onChange={(e) => onDepartamentoFiltro(e.target.value)}
        >
          <option value="TODOS">Todos los departamentos</option>

          {departamentosDisponibles.map((departamento) => (
            <option key={departamento.id} value={departamento.id}>
              {departamento.nombre}
            </option>
          ))}
        </select>

        <label style={checkLabel}>
          <input
            type="checkbox"
            checked={soloSeleccionados}
            onChange={(e) => onSoloSeleccionados(e.target.checked)}
          />
          Solo seleccionados
        </label>
      </div>

      <div style={resumen}>
        Mostrando <strong>{articulosFiltrados.length}</strong> artículos.
      </div>

      <div style={tablaWrapper}>
        <table style={tabla}>
          <thead>
            <tr>
              <th style={th}>✔</th>
              <th style={th}>Código</th>
              <th style={th}>Artículo</th>
              <th style={th}>Departamento</th>
              <th style={th}>Origen</th>
            </tr>
          </thead>

          <tbody>
            {articulosFiltrados.map((articulo) => {
              const codigo = String(articulo.codigo || "");
              const seleccionadoIndividual = codigosSeleccionados.has(codigo);

              const seleccionadoPorDepartamento = departamentosMarcados.has(
                String(articulo.departamento_id)
              );

              const estaSeleccionado =
                seleccionadoIndividual || seleccionadoPorDepartamento;

              return (
                <tr
                  key={articulo.id}
                  style={{
                    ...(estaSeleccionado ? filaSeleccionada : {}),
                    ...(!articulo.activo ? filaInactiva : {}),
                  }}
                >
                  <td style={tdCentro}>
                    <input
                      type="checkbox"
                      checked={estaSeleccionado}
                      disabled={
                        seleccionadoPorDepartamento ||
                        guardandoId === articulo.id
                      }
                      onChange={() => onCambiarArticulo(articulo)}
                    />
                  </td>

                  <td style={tdCodigo}>{articulo.codigo}</td>

                  <td style={td}>{articulo.nombre}</td>

                  <td style={td}>{articulo.departamentos?.nombre || "-"}</td>

                  <td style={td}>
                    {seleccionadoPorDepartamento ? (
                      <span style={badgeAzul}>Departamento</span>
                    ) : seleccionadoIndividual ? (
                      <span style={badgeVerde}>Artículo</span>
                    ) : (
                      <span style={badgeGris}>No incluido</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {articulosFiltrados.length === 0 && (
              <tr>
                <td style={tdVacio} colSpan={5}>
                  No hay artículos con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const contenedor = {
  display: "grid",
  gap: "12px",
};

const barraFiltros = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 260px) auto",
  gap: "10px",
  alignItems: "center",
};

const input = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "10px",
  fontSize: "14px",
};

const select = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "10px",
  fontSize: "14px",
  background: "#ffffff",
};

const checkLabel = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  fontWeight: "700",
  color: "#374151",
};

const resumen = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  color: "#374151",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "14px",
};

const tablaWrapper = {
  overflowX: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
};

const tabla = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
  background: "#ffffff",
};

const th = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  color: "#374151",
  fontSize: "13px",
  background: "#f9fafb",
};

const td = {
  borderBottom: "1px solid #f3f4f6",
  padding: "10px",
  color: "#111827",
};

const tdCentro = {
  ...td,
  textAlign: "center",
  width: "42px",
};

const tdCodigo = {
  ...td,
  fontWeight: "800",
  width: "90px",
};

const tdVacio = {
  padding: "18px",
  textAlign: "center",
  color: "#6b7280",
};

const filaSeleccionada = {
  background: "#ecfdf5",
};

const filaInactiva = {
  opacity: 0.55,
};

const badgeAzul = {
  display: "inline-block",
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: "999px",
  padding: "4px 8px",
  fontSize: "12px",
  fontWeight: "800",
};

const badgeVerde = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: "999px",
  padding: "4px 8px",
  fontSize: "12px",
  fontWeight: "800",
};

const badgeGris = {
  display: "inline-block",
  background: "#f3f4f6",
  color: "#6b7280",
  borderRadius: "999px",
  padding: "4px 8px",
  fontSize: "12px",
  fontWeight: "800",
};
