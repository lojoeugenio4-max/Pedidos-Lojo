import RuletaFila from "./RuletaFila";

export default function RuletaTabla({
  premios = [],
  cargando = false,
  onEditar,
  onEliminar,
}) {
  return (
    <div style={tablaContenedor}>
      <h4 style={bloqueTitulo}>Premios configurados</h4>

      {cargando ? (
        <p style={texto}>Cargando premios...</p>
      ) : premios.length === 0 ? (
        <div style={aviso}>
          Todavía no hay premios configurados. Crea el primer premio para empezar.
        </div>
      ) : (
        <table style={tabla}>
          <thead>
            <tr>
              <th style={th}>Orden</th>
              <th style={th}>Premio</th>
              <th style={th}>Color</th>
              <th style={th}>Probabilidad</th>
              <th style={th}>Stock</th>
              <th style={th}>Celebración</th>
              <th style={th}>Estado</th>
              <th style={th}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {premios.map((premio) => (
              <RuletaFila
                key={premio.id}
                premio={premio}
                onEditar={onEditar}
                onEliminar={onEliminar}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const bloqueTitulo = {
  margin: "0 0 14px",
  fontSize: "17px",
  color: "#111827",
};

const texto = {
  margin: "0 0 18px",
  color: "#6b7280",
  fontSize: "15px",
};

const tablaContenedor = {
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "16px",
  background: "#ffffff",
  overflowX: "auto",
};

const tabla = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
};

const th = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  color: "#374151",
  fontSize: "13px",
  whiteSpace: "nowrap",
};

const aviso = {
  background: "#f9fafb",
  border: "1px dashed #d1d5db",
  borderRadius: "12px",
  padding: "14px",
  color: "#374151",
  fontSize: "14px",
};
