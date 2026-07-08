function etiquetaCelebracion(tipo) {
  if (tipo === "jackpot") return "Jackpot";
  if (tipo === "sirena") return "Sirena";
  return "Campana";
}

function colorCelebracion(tipo) {
  if (tipo === "jackpot") {
    return {
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  if (tipo === "sirena") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  return {
    background: "#dbeafe",
    color: "#1d4ed8",
  };
}

export default function RuletaFila({ premio, onEditar, onEliminar }) {
  const imagen =
    premio.imagen_url || premio.foto_url || premio.image_url || premio.foto || premio.imagen || "";

  return (
    <tr>
      <td style={td}>{premio.orden}</td>

      <td style={td}>
        <div style={premioBox}>
          {imagen ? (
            <img src={imagen} alt="" style={miniatura} />
          ) : (
            <div style={sinImagen}>Sin foto</div>
          )}

          <div>
            <strong>{premio.nombre}</strong>
            {premio.articulo_id && (
              <div style={detalle}>Artículo ID: {premio.articulo_id}</div>
            )}
          </div>
        </div>
      </td>

      <td style={td}>
        <span
          style={{
            ...muestraColor,
            background: premio.color || "#f59e0b",
          }}
        />
        {premio.color}
      </td>

      <td style={td}>{Number(premio.probabilidad || 0)}%</td>

      <td style={td}>
        {premio.stock === null || premio.stock === undefined
          ? "Ilimitado"
          : premio.stock}
      </td>

      <td style={td}>
        <span style={{ ...celebracion, ...colorCelebracion(premio.tipo_sonido) }}>
          {etiquetaCelebracion(premio.tipo_sonido)}
        </span>
      </td>

      <td style={td}>
        {premio.activo ? (
          <span style={activo}>Activo</span>
        ) : (
          <span style={inactivo}>Inactivo</span>
        )}
      </td>

      <td style={td}>
        <button
          type="button"
          style={botonEditar}
          onClick={() => onEditar(premio)}
        >
          Editar
        </button>

        <button
          type="button"
          style={botonEliminar}
          onClick={() => onEliminar(premio)}
        >
          Eliminar
        </button>
      </td>
    </tr>
  );
}

const td = {
  borderBottom: "1px solid #f3f4f6",
  padding: "10px",
  color: "#111827",
  verticalAlign: "middle",
};

const premioBox = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minWidth: "240px",
};

const miniatura = {
  width: "50px",
  height: "50px",
  borderRadius: "10px",
  objectFit: "contain",
  background: "#f3f4f6",
  border: "1px solid #e5e7eb",
};

const sinImagen = {
  width: "50px",
  height: "50px",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f3f4f6",
  border: "1px solid #e5e7eb",
  color: "#6b7280",
  fontSize: "10px",
  fontWeight: "800",
  textAlign: "center",
};

const detalle = {
  marginTop: "3px",
  color: "#6b7280",
  fontSize: "12px",
};

const muestraColor = {
  display: "inline-block",
  width: "16px",
  height: "16px",
  borderRadius: "999px",
  marginRight: "8px",
  verticalAlign: "middle",
  border: "1px solid #d1d5db",
};

const celebracion = {
  display: "inline-block",
  borderRadius: "999px",
  padding: "4px 9px",
  fontSize: "12px",
  fontWeight: "800",
};

const activo = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: "999px",
  padding: "4px 9px",
  fontSize: "12px",
  fontWeight: "800",
};

const inactivo = {
  display: "inline-block",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: "999px",
  padding: "4px 9px",
  fontSize: "12px",
  fontWeight: "800",
};

const botonEditar = {
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "7px 10px",
  marginRight: "6px",
  cursor: "pointer",
  fontWeight: "700",
};

const botonEliminar = {
  border: "none",
  background: "#dc2626",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "7px 10px",
  cursor: "pointer",
  fontWeight: "700",
};
