const SUPABASE_URL = "https://bohlxagrtpjvqrgkonlo.supabase.co";

export default function TablaArticulos({
  articulos,
  onEditar,
  onDesactivar,
  onActivar,
  onEliminar,
}) {
  function obtenerFoto(articulo) {
    if (!articulo.foto) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/productos/${articulo.foto}`;
  }

  function estiloFila(articulo) {
    if (!articulo.activo) return inactiveRow;
    if (articulo.oculto) return hiddenRow;
    return tr;
  }

  function obtenerEstadoOferta(oferta) {
    if (!oferta) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicio = oferta.fecha_inicio ? new Date(oferta.fecha_inicio) : null;
    const fin = oferta.fecha_fin ? new Date(oferta.fecha_fin) : null;

    if (inicio && inicio > hoy) return "programada";
    if (fin && fin < hoy) return "caducada";

    return "activa";
  }

  return (
    <div style={tableCard}>
      <table style={table}>
        <thead>
          <tr>
            <th style={{ ...th, width: "78px" }}>Foto</th>
            <th style={{ ...th, width: "80px" }}>Código</th>
            <th style={th}>Artículo</th>
            <th style={{ ...th, width: "140px" }}>Departamento</th>
            <th style={{ ...th, minWidth: "260px" }}>Oferta</th>
            <th style={{ ...th, width: "110px" }}>Estado</th>
            <th style={{ ...th, width: "150px" }}>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {articulos.map((articulo) => {
            const tieneOferta =
              Array.isArray(articulo.ofertas) && articulo.ofertas.length > 0;

            const oferta = tieneOferta ? articulo.ofertas[0] : null;
            const textoOferta = oferta?.texto || "";
            const estadoOferta = obtenerEstadoOferta(oferta);

            return (
              <tr key={articulo.id} style={estiloFila(articulo)}>
                <td style={td}>
                  {articulo.foto ? (
                    <img src={obtenerFoto(articulo)} alt="" style={img} />
                  ) : (
                    <span style={noPhoto}>Sin foto</span>
                  )}
                </td>

                <td style={td}>
                  <strong style={code}>{articulo.codigo}</strong>
                </td>

                <td style={td}>
                  <div style={productName}>{articulo.nombre}</div>

                  <div style={badgesRow}>
                    {articulo.novedad && (
                      <span style={newBadge}>⭐ Novedad</span>
                    )}

                    {tieneOferta && (
                      <span style={offerMiniBadge}>🏷 Oferta</span>
                    )}

                    {articulo.oculto && (
                      <span style={hiddenNameBadge}>🙈 Oculto</span>
                    )}

                    {!articulo.activo && (
                      <span style={inactiveMiniBadge}>⛔ Inactivo</span>
                    )}
                  </div>
                </td>

                <td style={td}>
                  <span style={departmentBadge}>
                    {articulo.departamentos?.nombre || "-"}
                  </span>
                </td>

                <td style={td}>
                  {tieneOferta ? (
                    <div>
                      <div style={offerBadge}>🏷️ {textoOferta}</div>

                      {estadoOferta === "activa" && (
                        <div style={offerActiveBadge}>✅ Oferta activa</div>
                      )}

                      {estadoOferta === "caducada" && (
                        <div style={offerExpiredBadge}>⏰ Oferta caducada</div>
                      )}

                      {estadoOferta === "programada" && (
                        <div style={offerProgrammedBadge}>
                          📅 Oferta programada
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={emptyOffer}>—</span>
                  )}
                </td>

                <td style={td}>
                  {articulo.activo ? (
                    <span style={activeBadge}>Activo</span>
                  ) : (
                    <span style={inactiveBadge}>Inactivo</span>
                  )}

                  <div style={{ marginTop: "6px" }}>
                    {articulo.oculto ? (
                      <span style={hiddenBadge}>Oculto</span>
                    ) : (
                      <span style={visibleBadge}>Visible</span>
                    )}
                  </div>
                </td>

                <td style={td}>
                  <div style={actions}>
                    <button style={editBtn} onClick={() => onEditar(articulo)}>
                      ✏️ Editar
                    </button>

                    {articulo.activo ? (
                      <button
                        style={offBtn}
                        onClick={() => onDesactivar(articulo)}
                      >
                        ❌ Desactivar
                      </button>
                    ) : (
                      <button
                        style={activeBtn}
                        onClick={() => onActivar(articulo)}
                      >
                        ✅ Activar
                      </button>
                    )}

                    <button
                      style={deleteBtn}
                      onClick={() => onEliminar(articulo)}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const tableCard = {
  overflowX: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  background: "#fff",
  boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
};

const table = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const th = {
  background: "#f8fafc",
  color: "#475569",
  textAlign: "left",
  padding: "13px 14px",
  fontSize: "12px",
  fontWeight: "900",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const tr = {
  background: "#ffffff",
};

const hiddenRow = {
  background: "#f9fafb",
};

const inactiveRow = {
  background: "#fff1f2",
};

const td = {
  padding: "12px 14px",
  verticalAlign: "middle",
  fontSize: "14px",
  borderBottom: "1px solid #f1f5f9",
};

const img = {
  width: "56px",
  height: "56px",
  objectFit: "contain",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  background: "#fff",
};

const noPhoto = {
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: "700",
};

const code = {
  color: "#111827",
  fontSize: "14px",
};

const productName = {
  fontWeight: "800",
  color: "#111827",
  marginBottom: "6px",
  lineHeight: "1.25",
};

const badgesRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "5px",
};

const newBadge = {
  display: "inline-block",
  background: "#fef3c7",
  color: "#92400e",
  padding: "3px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: "800",
};

const offerMiniBadge = {
  display: "inline-block",
  background: "#ffedd5",
  color: "#9a3412",
  padding: "3px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: "800",
};

const hiddenNameBadge = {
  display: "inline-block",
  background: "#e5e7eb",
  color: "#374151",
  padding: "3px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: "800",
};

const inactiveMiniBadge = {
  display: "inline-block",
  background: "#fee2e2",
  color: "#991b1b",
  padding: "3px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: "800",
};

const departmentBadge = {
  background: "#eef2ff",
  color: "#3730a3",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "800",
  display: "inline-block",
  maxWidth: "120px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const offerBadge = {
  background: "#fff7ed",
  color: "#9a3412",
  padding: "8px 11px",
  borderRadius: "12px",
  fontSize: "12px",
  fontWeight: "800",
  display: "inline-block",
  maxWidth: "340px",
  lineHeight: "1.35",
};

const offerActiveBadge = {
  marginTop: "6px",
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  padding: "4px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: "800",
};

const offerExpiredBadge = {
  marginTop: "6px",
  display: "inline-block",
  background: "#fee2e2",
  color: "#991b1b",
  padding: "4px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: "800",
};

const offerProgrammedBadge = {
  marginTop: "6px",
  display: "inline-block",
  background: "#dbeafe",
  color: "#1d4ed8",
  padding: "4px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: "800",
};

const emptyOffer = {
  color: "#cbd5e1",
  fontWeight: "800",
};

const activeBadge = {
  background: "#dcfce7",
  color: "#166534",
  padding: "6px 10px",
  borderRadius: "999px",
  fontWeight: "900",
  fontSize: "12px",
  display: "inline-block",
};

const inactiveBadge = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: "6px 10px",
  borderRadius: "999px",
  fontWeight: "900",
  fontSize: "12px",
  display: "inline-block",
};

const visibleBadge = {
  background: "#dbeafe",
  color: "#1d4ed8",
  padding: "5px 9px",
  borderRadius: "999px",
  fontWeight: "900",
  fontSize: "11px",
  display: "inline-block",
};

const hiddenBadge = {
  background: "#e5e7eb",
  color: "#374151",
  padding: "5px 9px",
  borderRadius: "999px",
  fontWeight: "900",
  fontSize: "11px",
  display: "inline-block",
};

const actions = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  minWidth: "120px",
};

const baseBtn = {
  border: "none",
  borderRadius: "10px",
  padding: "7px 9px",
  cursor: "pointer",
  fontWeight: "900",
  fontSize: "12px",
  textAlign: "center",
};

const editBtn = {
  ...baseBtn,
  background: "#dbeafe",
  color: "#1d4ed8",
};

const offBtn = {
  ...baseBtn,
  background: "#ffedd5",
  color: "#c2410c",
};

const activeBtn = {
  ...baseBtn,
  background: "#dcfce7",
  color: "#166534",
};

const deleteBtn = {
  ...baseBtn,
  background: "#fee2e2",
  color: "#b91c1c",
};
