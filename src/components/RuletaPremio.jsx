export default function RuletaPremio({
  premio,
  seleccionado = false,
  onClick,
}) {
  if (!premio) return null;

  return (
    <button
      type="button"
      onClick={() => onClick?.(premio)}
      style={{
        ...card,
        borderColor: seleccionado
          ? premio.color || "#f59e0b"
          : "#e5e7eb",
        background: seleccionado
          ? "#fff7ed"
          : "#ffffff",
      }}
    >
      <img
        src={premio.imagen_url}
        alt={premio.nombre}
        style={imagen}
      />

      <div style={contenido}>
        <strong style={nombre}>
          {premio.nombre}
        </strong>

        <div style={detalle}>
          Probabilidad: {premio.probabilidad}%
        </div>

        <div style={detalle}>
          Stock: {premio.stock ?? "∞"}
        </div>

        <div
          style={{
            ...estado,
            background: premio.activo
              ? "#dcfce7"
              : "#fee2e2",
            color: premio.activo
              ? "#166534"
              : "#991b1b",
          }}
        >
          {premio.activo ? "Activo" : "Inactivo"}
        </div>
      </div>
    </button>
  );
}

const card = {
  display: "flex",
  width: "100%",
  textAlign: "left",
  gap: 16,
  padding: 14,
  borderRadius: 16,
  border: "2px solid #e5e7eb",
  cursor: "pointer",
  transition: ".2s",
};

const imagen = {
  width: 84,
  height: 84,
  objectFit: "cover",
  borderRadius: 12,
  background: "#f3f4f6",
};

const contenido = {
  flex: 1,
};

const nombre = {
  display: "block",
  marginBottom: 8,
  fontSize: 17,
};

const detalle = {
  color: "#64748b",
  fontSize: 14,
  marginBottom: 4,
};

const estado = {
  display: "inline-block",
  marginTop: 8,
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
};
