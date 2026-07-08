export default function RuletaDepartamentos({
  departamentos = [],
  departamentoFiltro = "TODOS",
  busqueda = "",
  totalArticulos = 0,
  totalSeleccionados = 0,
  onDepartamentoFiltro,
  onBusqueda,
}) {
  return (
    <div style={contenedor}>
      <div style={cabecera}>
        <div>
          <h5 style={titulo}>Filtrar artículos</h5>
          <p style={texto}>
            Selecciona un departamento y usa el buscador para añadir referencias
            concretas a la promoción.
          </p>
        </div>

        <div style={contador}>
          <strong>{totalSeleccionados}</strong> seleccionados ·{" "}
          <strong>{totalArticulos}</strong> disponibles
        </div>
      </div>

      <div style={filtros}>
        <label style={label}>
          Departamento
          <select
            style={input}
            value={departamentoFiltro}
            onChange={(e) => onDepartamentoFiltro?.(e.target.value)}
          >
            <option value="TODOS">Todos los departamentos</option>

            {departamentos.map((departamento) => (
              <option key={departamento.id} value={departamento.id}>
                {departamento.nombre}
              </option>
            ))}
          </select>
        </label>

        <label style={labelGrande}>
          Buscar artículo
          <input
            style={input}
            type="text"
            value={busqueda}
            onChange={(e) => onBusqueda?.(e.target.value)}
            placeholder="Código, nombre o departamento..."
          />
        </label>
      </div>
    </div>
  );
}

const contenedor = {
  display: "grid",
  gap: "12px",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "14px",
  background: "#ffffff",
};

const cabecera = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const titulo = {
  margin: "0 0 4px",
  fontSize: "15px",
  color: "#111827",
};

const texto = {
  margin: 0,
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: 1.4,
};

const contador = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#1e40af",
  borderRadius: "999px",
  padding: "7px 10px",
  fontSize: "13px",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const filtros = {
  display: "grid",
  gridTemplateColumns: "minmax(190px, 260px) minmax(240px, 1fr)",
  gap: "12px",
};

const label = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "13px",
  fontWeight: "700",
  color: "#374151",
};

const labelGrande = {
  ...label,
};

const input = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "10px",
  fontSize: "14px",
  background: "#ffffff",
};
