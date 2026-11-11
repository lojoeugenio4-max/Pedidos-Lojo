import { useRef } from "react";
import { supabaseStorage } from "../supabaseStorageClient";

export default function TablaArticulos({
  articulos,
  onEditar,
  onDesactivar,
  onActivar,
  onEliminar,
  // Artículo que se está editando (se resalta su fila).
  editandoId = null,
  // Selección múltiple (para asignar departamento o ubicación a muchos artículos a la vez)
  seleccionable = false,
  seleccionados = new Set(),
  onCambiarSeleccion = () => {},
}) {
  // Último artículo marcado, para poder marcar un rango con Mayúsculas+clic.
  const ultimoIndiceRef = useRef(null);

  const idsVisibles = articulos.map((articulo) => articulo.id);
  const todosMarcados =
    idsVisibles.length > 0 && idsVisibles.every((id) => seleccionados.has(id));
  const algunoMarcado = idsVisibles.some((id) => seleccionados.has(id));

  function marcarTodos(marcar) {
    const nuevos = new Set(seleccionados);
    idsVisibles.forEach((id) => (marcar ? nuevos.add(id) : nuevos.delete(id)));
    onCambiarSeleccion(nuevos);
  }

  function alternarArticulo(indice, evento) {
    const id = articulos[indice].id;
    const marcar = !seleccionados.has(id);
    const nuevos = new Set(seleccionados);

    if (evento.shiftKey && ultimoIndiceRef.current !== null) {
      const desde = Math.min(ultimoIndiceRef.current, indice);
      const hasta = Math.max(ultimoIndiceRef.current, indice);
      for (let i = desde; i <= hasta; i += 1) {
        if (marcar) nuevos.add(articulos[i].id);
        else nuevos.delete(articulos[i].id);
      }
    } else if (marcar) {
      nuevos.add(id);
    } else {
      nuevos.delete(id);
    }

    ultimoIndiceRef.current = indice;
    onCambiarSeleccion(nuevos);
  }
  function obtenerFoto(articulo) {
    if (!articulo.foto) return null;

    const { data } = supabaseStorage.storage
      .from("productos")
      .getPublicUrl(articulo.foto);

    return data.publicUrl;
  }

  function estiloFila(articulo) {
    if (!articulo.activo) return inactiveRow;
    if (articulo.oculto) return hiddenRow;
    return tr;
  }

  function formatearPrecio(precio) {
    if (precio === null || precio === undefined || precio === "") return null;

    const numero = Number(precio);
    if (!Number.isFinite(numero)) return null;

    return numero.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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
            {seleccionable && (
              <th style={{ ...th, width: "40px", textAlign: "center" }}>
                <input
                  type="checkbox"
                  style={casilla}
                  checked={todosMarcados}
                  ref={(el) => {
                    if (el) el.indeterminate = algunoMarcado && !todosMarcados;
                  }}
                  onChange={(e) => marcarTodos(e.target.checked)}
                  title="Marcar / desmarcar todos los de la lista (Mayúsculas + clic marca un rango)"
                />
              </th>
            )}
            <th style={{ ...th, width: "60px" }}>Foto</th>
            <th style={th}>Artículo</th>
            <th style={{ ...th, width: "190px" }}>Departamento · Ubicación</th>
            <th style={{ ...th, width: "100px", textAlign: "right" }}>Precio</th>
            <th style={{ ...th, width: "110px" }}>Estado</th>
            <th style={{ ...th, width: "200px", textAlign: "right" }}>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {articulos.map((articulo, indice) => {
            const tieneOferta = Array.isArray(articulo.ofertas) && articulo.ofertas.length > 0;
            const oferta = tieneOferta ? articulo.ofertas[0] : null;
            const estadoOferta = obtenerEstadoOferta(oferta);
            const precioFormateado = formatearPrecio(articulo.precio);
            const marcado = seleccionados.has(articulo.id);
            const enEdicion = editandoId !== undefined && editandoId !== null && editandoId === articulo.id;
            const departamento = articulo.departamentos;

            let fondoFila = estiloFila(articulo);
            if (marcado) fondoFila = { ...fondoFila, background: "#ecfdf5" };
            if (enEdicion) fondoFila = { ...fondoFila, background: "#eef2ff", boxShadow: "inset 4px 0 0 #4f46e5" };

            return (
              <tr
                key={articulo.id}
                style={fondoFila}
                onClick={(e) => {
                  // Clic en la fila = editar (salvo en casillas y botones).
                  if (e.target.closest("button, input, a, label")) return;
                  onEditar(articulo);
                }}
                title="Clic para editar"
              >
                {seleccionable && (
                  <td
                    style={{ ...td, textAlign: "center", cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.target.tagName !== "INPUT") alternarArticulo(indice, e);
                    }}
                  >
                    <input
                      type="checkbox"
                      style={casilla}
                      checked={marcado}
                      onChange={() => {}}
                      onClick={(e) => alternarArticulo(indice, e)}
                    />
                  </td>
                )}

                <td style={td}>
                  {articulo.foto ? (
                    <img src={obtenerFoto(articulo)} alt="" style={img} loading="lazy" />
                  ) : (
                    <div style={sinFoto} title="Sin foto">📷</div>
                  )}
                </td>

                <td style={td}>
                  <div style={productName}>{articulo.nombre}</div>
                  <div style={lineaCodigos}>
                    <span>Cód. {articulo.codigo}</span>
                    <span style={separador}>·</span>
                    {articulo.codigo_lojo ? (
                      <span>
                        Lojo <b>{articulo.codigo_lojo}</b>
                      </span>
                    ) : (
                      <span style={{ color: "#b45309", fontWeight: 800 }}>⚠️ Sin código Lojo</span>
                    )}
                    {Array.isArray(articulo.eans) && articulo.eans.length > 0 && (
                      <>
                        <span style={separador}>·</span>
                        <span title={articulo.eans.join("\n")}>
                          ▥ {articulo.eans.length} EAN
                        </span>
                      </>
                    )}
                  </div>
                  {(articulo.novedad || tieneOferta) && (
                    <div style={badgesRow}>
                      {articulo.novedad && <span style={newBadge}>⭐ Novedad</span>}
                      {tieneOferta && (
                        <span
                          style={
                            estadoOferta === "caducada"
                              ? offerExpiredBadge
                              : estadoOferta === "programada"
                                ? offerProgrammedBadge
                                : offerMiniBadge
                          }
                          title={oferta?.texto || ""}
                        >
                          🏷 {oferta?.texto || "Oferta"}
                          {estadoOferta === "caducada" ? " (caducada)" : estadoOferta === "programada" ? " (programada)" : ""}
                        </span>
                      )}
                    </div>
                  )}
                </td>

                <td style={td}>
                  {departamento?.nombre ? (
                    <div style={departmentText}>
                      {departamento.cod !== null &&
                      departamento.cod !== undefined &&
                      String(departamento.cod).trim() !== ""
                        ? `${departamento.cod} · `
                        : ""}
                      {departamento.nombre}
                    </div>
                  ) : (
                    <div style={{ ...departmentText, color: "#b45309" }}>🗂️ Sin departamento</div>
                  )}
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 12,
                      fontWeight: 700,
                      color: articulo.ubicacion ? "#0f766e" : "#94a3b8",
                    }}
                    title={articulo.ubicacion?.nombre || "Sin ubicación"}
                  >
                    📍 {articulo.ubicacion ? articulo.ubicacion.codigo : "Sin ubicación"}
                  </div>
                </td>

                <td style={{ ...td, textAlign: "right" }}>
                  {precioFormateado ? (
                    <span style={priceText}>{precioFormateado} €</span>
                  ) : (
                    <span style={sinPrecio}>Sin precio</span>
                  )}
                </td>

                <td style={td}>
                  {!articulo.activo ? (
                    <span style={inactiveBadge}>Inactivo</span>
                  ) : articulo.oculto ? (
                    <span style={hiddenBadge}>Oculto</span>
                  ) : (
                    <span style={activeBadge}>Activo</span>
                  )}
                  {!articulo.activo && articulo.oculto && (
                    <div style={{ marginTop: 4 }}>
                      <span style={hiddenBadge}>Oculto</span>
                    </div>
                  )}
                </td>

                <td style={{ ...td, textAlign: "right" }}>
                  <div style={actions}>
                    <button style={editBtn} onClick={() => onEditar(articulo)}>
                      ✏️ Editar
                    </button>
                    {articulo.activo ? (
                      <button style={iconBtn} onClick={() => onDesactivar(articulo)} title="Desactivar">
                        ⛔
                      </button>
                    ) : (
                      <button style={iconBtnVerde} onClick={() => onActivar(articulo)} title="Activar">
                        ✅
                      </button>
                    )}
                    <button style={iconBtnRojo} onClick={() => onEliminar(articulo)} title="Eliminar">
                      🗑️
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
  borderRadius: "16px",
  background: "#fff",
};

const table = {
  width: "100%",
  minWidth: "860px",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const th = {
  textAlign: "left",
  padding: "10px 10px",
  fontSize: "12px",
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  background: "#f8fafc",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const td = {
  padding: "8px 10px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
  fontSize: "14px",
  color: "#0f172a",
};

const tr = { background: "#fff", cursor: "pointer" };
const inactiveRow = { background: "#fef2f2", cursor: "pointer", opacity: 0.85 };
const hiddenRow = { background: "#f8fafc", cursor: "pointer" };

const casilla = { width: "18px", height: "18px", cursor: "pointer" };

const img = {
  width: "48px",
  height: "48px",
  objectFit: "contain",
  borderRadius: "10px",
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  display: "block",
};

const sinFoto = {
  width: "48px",
  height: "48px",
  borderRadius: "10px",
  background: "#f1f5f9",
  border: "1px dashed #cbd5e1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "18px",
  opacity: 0.6,
};

const productName = {
  fontSize: "15px",
  fontWeight: 900,
  color: "#0f172a",
  lineHeight: 1.25,
};

const lineaCodigos = {
  display: "flex",
  flexWrap: "wrap",
  gap: "4px",
  marginTop: "3px",
  fontSize: "12px",
  fontWeight: 700,
  color: "#64748b",
};

const separador = { color: "#cbd5e1" };

const badgesRow = { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "5px" };

const badgeBase = {
  display: "inline-block",
  borderRadius: "999px",
  padding: "2px 8px",
  fontSize: "11px",
  fontWeight: 900,
  maxWidth: "320px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const newBadge = { ...badgeBase, background: "#fef9c3", color: "#854d0e" };
const offerMiniBadge = { ...badgeBase, background: "#ffedd5", color: "#9a3412" };
const offerExpiredBadge = { ...badgeBase, background: "#f1f5f9", color: "#64748b" };
const offerProgrammedBadge = { ...badgeBase, background: "#e0f2fe", color: "#075985" };

const departmentText = { fontSize: "13px", fontWeight: 800, color: "#3730a3" };

const priceText = { fontSize: "15px", fontWeight: 900, color: "#166534", whiteSpace: "nowrap" };
const sinPrecio = { fontSize: "12px", fontWeight: 800, color: "#b45309", whiteSpace: "nowrap" };

const activeBadge = { ...badgeBase, background: "#dcfce7", color: "#166534", fontSize: "12px" };
const inactiveBadge = { ...badgeBase, background: "#fee2e2", color: "#b91c1c", fontSize: "12px" };
const hiddenBadge = { ...badgeBase, background: "#e2e8f0", color: "#334155", fontSize: "12px" };

const actions = { display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" };

const editBtn = {
  border: "none",
  borderRadius: "10px",
  padding: "8px 14px",
  background: "#4f46e5",
  color: "#fff",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const iconBtnBase = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  width: "34px",
  height: "34px",
  background: "#fff",
  cursor: "pointer",
  fontSize: "14px",
  padding: 0,
};

const iconBtn = { ...iconBtnBase };
const iconBtnVerde = { ...iconBtnBase, background: "#f0fdf4", borderColor: "#bbf7d0" };
const iconBtnRojo = { ...iconBtnBase, background: "#fef2f2", borderColor: "#fecaca" };
