import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Ofertas() {
  const formRef = useRef(null);

  const [ofertas, setOfertas] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busquedaArticulo, setBusquedaArticulo] = useState("");
  const [busquedaOferta, setBusquedaOferta] = useState("");

  const [form, setForm] = useState({
    articulo_id: "",
    texto: "",
    fecha_inicio: "",
    fecha_fin: "",
    es_push: false,
    push_titulo: "",
    push_activo: false,
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);

    const { data: ofertasData, error: ofertasError } = await supabase
      .from("ofertas")
      .select(`
        id,
        articulo_id,
        texto,
        fecha_inicio,
        fecha_fin,
        es_push,
        push_titulo,
        push_activo,
        articulos (
          id,
          codigo,
          nombre,
          activo,
          oculto
        )
      `);

    const { data: articulosData, error: articulosError } = await supabase
      .from("articulos")
      .select("id, codigo, nombre, activo, oculto");

    if (ofertasError) {
      console.error(ofertasError);
      alert("Error cargando ofertas");
    }

    if (articulosError) {
      console.error(articulosError);
      alert("Error cargando artículos");
    }

    setOfertas(ofertasData || []);
    setArticulos(articulosData || []);
    setCargando(false);
  }

  const ofertasOrdenadas = useMemo(() => {
    const texto = busquedaOferta.trim().toLowerCase();

    return [...ofertas]
      .filter((oferta) => {
        if (!texto) return true;

        const contenido = `
          ${oferta.articulos?.codigo || ""}
          ${oferta.articulos?.nombre || ""}
          ${oferta.texto || ""}
        `.toLowerCase();

        return contenido.includes(texto);
      })
      .sort((a, b) =>
        String(a.articulos?.nombre || "").localeCompare(
          String(b.articulos?.nombre || ""),
          "es",
          { sensitivity: "base" }
        )
      );
  }, [ofertas, busquedaOferta]);

  const articulosConOferta = useMemo(() => {
    return new Set(ofertas.map((oferta) => Number(oferta.articulo_id)));
  }, [ofertas]);

  const articulosFiltrados = useMemo(() => {
    const texto = busquedaArticulo.trim().toLowerCase();

    return [...articulos]
      .sort((a, b) =>
        String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
          sensitivity: "base",
        })
      )
      .filter((articulo) => {
        if (!texto) return true;

        return `${articulo.codigo} ${articulo.nombre}`
          .toLowerCase()
          .includes(texto);
      })
      .slice(0, 80);
  }, [articulos, busquedaArticulo]);

  function limpiarFormulario() {
    setEditando(null);
    setBusquedaArticulo("");
    setForm({
      articulo_id: "",
      texto: "",
      fecha_inicio: "",
      fecha_fin: "",
      es_push: false,
      push_titulo: "",
      push_activo: false,
    });
  }

  function nuevaOferta() {
    limpiarFormulario();
    setMostrarFormulario(true);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function editarOferta(oferta) {
    setEditando(oferta);
    setBusquedaArticulo(oferta.articulos?.nombre || "");

    setForm({
      articulo_id: String(oferta.articulo_id || ""),
      texto: oferta.texto || "",
      fecha_inicio: oferta.fecha_inicio || "",
      fecha_fin: oferta.fecha_fin || "",
      es_push: Boolean(oferta.es_push),
      push_titulo: oferta.push_titulo || "",
      push_activo: Boolean(oferta.push_activo),
    });

    setMostrarFormulario(true);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function cancelarFormulario() {
    limpiarFormulario();
    setMostrarFormulario(false);
  }

  function cambiarCampo(campo, valor) {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function seleccionarArticulo(articulo) {
    cambiarCampo("articulo_id", String(articulo.id));
    setBusquedaArticulo(articulo.nombre || "");
  }

  function estadoOferta(oferta) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicio = oferta.fecha_inicio ? new Date(oferta.fecha_inicio) : null;
    const fin = oferta.fecha_fin ? new Date(oferta.fecha_fin) : null;

    if (inicio && inicio > hoy) return "programada";
    if (fin && fin < hoy) return "caducada";
    return "activa";
  }

  async function guardarOferta() {
    if (!form.articulo_id) return alert("Selecciona un artículo");
    if (!form.texto.trim()) return alert("El texto de la oferta es obligatorio");

    const datosOferta = {
      articulo_id: Number(form.articulo_id),
      texto: form.texto.trim(),
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      es_push: Boolean(form.es_push || form.push_activo),
      push_titulo: form.push_titulo.trim() || null,
      push_activo: Boolean(form.push_activo),
    };

    if (datosOferta.push_activo) {
      await supabase
        .from("ofertas")
        .update({ push_activo: false })
        .neq("id", editando?.id || 0);
    }

    if (editando) {
      const { error } = await supabase
        .from("ofertas")
        .update(datosOferta)
        .eq("id", editando.id);

      if (error) {
        console.error(error);
        alert("Error actualizando oferta");
        return;
      }
    } else {
      const { error } = await supabase.from("ofertas").insert([datosOferta]);

      if (error) {
        console.error(error);
        alert("Error creando oferta");
        return;
      }
    }

    cancelarFormulario();
    cargarDatos();
  }

  async function activarPush(oferta) {
    await supabase
      .from("ofertas")
      .update({ push_activo: false })
      .neq("id", oferta.id);

    const { error } = await supabase
      .from("ofertas")
      .update({
        es_push: true,
        push_activo: true,
        push_titulo: oferta.push_titulo || "🔥 Oferta destacada",
      })
      .eq("id", oferta.id);

    if (error) {
      console.error(error);
      alert("Error activando push");
      return;
    }

    cargarDatos();
  }

  async function desactivarPush(oferta) {
    const { error } = await supabase
      .from("ofertas")
      .update({ push_activo: false })
      .eq("id", oferta.id);

    if (error) {
      console.error(error);
      alert("Error desactivando push");
      return;
    }

    cargarDatos();
  }

  async function eliminarOferta(oferta) {
    const confirmar = confirm(`¿Eliminar esta oferta?\n\n${oferta.texto}`);
    if (!confirmar) return;

    const { error } = await supabase.from("ofertas").delete().eq("id", oferta.id);

    if (error) {
      console.error(error);
      alert("Error eliminando oferta");
      return;
    }

    cargarDatos();
  }

  const totalOfertas = ofertas.length;
  const totalActivas = ofertas.filter((o) => estadoOferta(o) === "activa").length;
  const totalCaducadas = ofertas.filter((o) => estadoOferta(o) === "caducada").length;
  const totalProgramadas = ofertas.filter((o) => estadoOferta(o) === "programada").length;
  const pushActivo = ofertas.find((o) => o.push_activo);

  return (
    <div>
      <div style={header}>
        <div>
          <h1 style={title}>🏷️ Gestión de Ofertas</h1>
          <p style={subtitle}>
            {totalOfertas} ofertas · {totalActivas} activas · {totalCaducadas} caducadas · {totalProgramadas} programadas
          </p>
        </div>

        <button onClick={nuevaOferta} style={newButton}>
          + Nueva oferta
        </button>
      </div>

      {pushActivo && (
        <div style={pushBox}>
          <strong>📣 Push activo:</strong>{" "}
          {pushActivo.push_titulo || "🔥 Oferta destacada"} — {pushActivo.texto}
        </div>
      )}

      {mostrarFormulario && (
        <div ref={formRef} style={formBox}>
          <h2 style={formTitle}>{editando ? "Editar oferta" : "Nueva oferta"}</h2>

          <label style={label}>Buscar artículo para añadir oferta</label>
          <input
            type="text"
            value={busquedaArticulo}
            onChange={(e) => {
              setBusquedaArticulo(e.target.value);
              cambiarCampo("articulo_id", "");
            }}
            placeholder="Buscar por nombre o código..."
            style={input}
          />

          <div style={articleList}>
            {articulosFiltrados.map((articulo) => {
              const tieneOferta = articulosConOferta.has(Number(articulo.id));
              const seleccionado = String(articulo.id) === String(form.articulo_id);

              return (
                <button
                  key={articulo.id}
                  type="button"
                  onClick={() => seleccionarArticulo(articulo)}
                  style={articleOption(seleccionado)}
                >
                  <span>
                    <strong>{articulo.nombre}</strong>
                    <small style={articleCode}>Código {articulo.codigo}</small>
                  </span>

                  {tieneOferta && !seleccionado && (
                    <span style={hasOfferBadge}>Ya tiene oferta</span>
                  )}

                  {seleccionado && <span style={selectedBadge}>Seleccionado</span>}
                </button>
              );
            })}
          </div>

          <label style={label}>Texto de oferta</label>
          <textarea
            value={form.texto}
            onChange={(e) => cambiarCampo("texto", e.target.value)}
            placeholder="Ej: Comprando 10 cajas REGALO 1 caja"
            style={textarea}
          />

          <div style={dateGrid}>
            <div>
              <label style={label}>Fecha inicio</label>
              <input
                type="date"
                value={form.fecha_inicio}
                onChange={(e) => cambiarCampo("fecha_inicio", e.target.value)}
                style={input}
              />
            </div>

            <div>
              <label style={label}>Fecha fin</label>
              <input
                type="date"
                value={form.fecha_fin}
                onChange={(e) => cambiarCampo("fecha_fin", e.target.value)}
                style={input}
              />
            </div>
          </div>

          <label style={checkboxLabel}>
            <input
              type="checkbox"
              checked={form.es_push}
              onChange={(e) => cambiarCampo("es_push", e.target.checked)}
            />{" "}
            Preparar como Push / Banner
          </label>

          <label style={checkboxLabel}>
            <input
              type="checkbox"
              checked={form.push_activo}
              onChange={(e) => cambiarCampo("push_activo", e.target.checked)}
            />{" "}
            Mostrar este Push en la web pública
          </label>

          <label style={label}>Título del Push</label>
          <input
            type="text"
            value={form.push_titulo}
            onChange={(e) => cambiarCampo("push_titulo", e.target.value)}
            placeholder="Ej: 🔥 Oferta destacada"
            style={input}
          />

          <div style={formActions}>
            <button onClick={guardarOferta} style={saveButton}>
              Guardar oferta
            </button>

            <button onClick={cancelarFormulario} style={cancelButton}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={toolbar}>
        <input
          type="text"
          value={busquedaOferta}
          onChange={(e) => setBusquedaOferta(e.target.value)}
          placeholder="🔍 Buscar artículo con oferta por nombre, código o texto..."
          style={searchInput}
        />

        <p style={toolbarText}>
          Mostrando {ofertasOrdenadas.length} de {totalOfertas} ofertas
        </p>
      </div>

      {cargando ? (
        <p>Cargando ofertas...</p>
      ) : (
        <div style={tableCard}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Artículo</th>
                <th style={th}>Texto oferta</th>
                <th style={th}>Inicio</th>
                <th style={th}>Fin</th>
                <th style={th}>Estado</th>
                <th style={th}>Push</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {ofertasOrdenadas.length === 0 ? (
                <tr>
                  <td colSpan="7" style={emptyCell}>
                    No hay ofertas que coincidan con la búsqueda
                  </td>
                </tr>
              ) : (
                ofertasOrdenadas.map((oferta) => {
                  const estado = estadoOferta(oferta);

                  return (
                    <tr key={oferta.id}>
                      <td style={td}>
                        <strong>{oferta.articulos?.nombre || "Sin artículo"}</strong>
                        <div style={smallText}>Código: {oferta.articulos?.codigo || "-"}</div>
                      </td>

                      <td style={td}>
                        <span style={offerText}>🏷️ {oferta.texto}</span>
                      </td>

                      <td style={td}>{oferta.fecha_inicio || "—"}</td>
                      <td style={td}>{oferta.fecha_fin || "—"}</td>

                      <td style={td}>
                        {estado === "activa" && <span style={activeBadge}>✅ Activa</span>}
                        {estado === "caducada" && <span style={expiredBadge}>⏰ Caducada</span>}
                        {estado === "programada" && <span style={programmedBadge}>📅 Programada</span>}
                      </td>

                      <td style={td}>
                        {oferta.push_activo ? (
                          <span style={pushActiveBadge}>📣 Push activo</span>
                        ) : (
                          <span style={muted}>—</span>
                        )}
                      </td>

                      <td style={td}>
                        <div style={actions}>
                          <button style={editBtn} onClick={() => editarOferta(oferta)}>
                            ✏️ Editar
                          </button>

                          {oferta.push_activo ? (
                            <button style={offPushBtn} onClick={() => desactivarPush(oferta)}>
                              Quitar push
                            </button>
                          ) : (
                            <button style={pushBtn} onClick={() => activarPush(oferta)}>
                              Poner push
                            </button>
                          )}

                          <button style={deleteBtn} onClick={() => eliminarOferta(oferta)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "18px",
};

const title = {
  margin: 0,
  fontSize: "28px",
  color: "#111827",
};

const subtitle = {
  margin: "6px 0 0",
  color: "#6b7280",
  fontSize: "14px",
};

const newButton = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  padding: "13px 20px",
  fontSize: "15px",
  fontWeight: "bold",
  cursor: "pointer",
};

const pushBox = {
  background: "#fff7ed",
  color: "#9a3412",
  border: "1px solid #fed7aa",
  padding: "14px 16px",
  borderRadius: "14px",
  marginBottom: "18px",
  fontWeight: "700",
};

const formBox = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "18px",
  marginBottom: "18px",
};

const formTitle = {
  marginTop: 0,
};

const toolbar = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "16px",
  marginBottom: "18px",
};

const searchInput = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 15px",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  fontSize: "15px",
  outline: "none",
};

const toolbarText = {
  margin: "10px 0 0",
  color: "#6b7280",
  fontSize: "13px",
  fontWeight: "700",
};

const label = {
  display: "block",
  fontWeight: "800",
  marginBottom: "6px",
  color: "#374151",
};

const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  fontSize: "14px",
  marginBottom: "12px",
};

const textarea = {
  ...input,
  minHeight: "90px",
};

const articleList = {
  maxHeight: "260px",
  overflowY: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  background: "#fff",
  marginBottom: "14px",
};

const articleOption = (selected) => ({
  width: "100%",
  border: "none",
  borderBottom: "1px solid #f1f5f9",
  background: selected ? "#dbeafe" : "#fff",
  padding: "10px 12px",
  cursor: "pointer",
  textAlign: "left",
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  alignItems: "center",
});

const articleCode = {
  display: "block",
  color: "#64748b",
  fontSize: "12px",
  marginTop: "3px",
};

const hasOfferBadge = {
  background: "#fff7ed",
  color: "#9a3412",
  padding: "5px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: "900",
  whiteSpace: "nowrap",
};

const selectedBadge = {
  background: "#2563eb",
  color: "#fff",
  padding: "5px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: "900",
  whiteSpace: "nowrap",
};

const dateGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
};

const checkboxLabel = {
  display: "block",
  marginBottom: "10px",
  fontWeight: "700",
};

const formActions = {
  display: "flex",
  gap: "10px",
  marginTop: "12px",
};

const saveButton = {
  background: "#22c55e",
  color: "white",
  border: "none",
  padding: "10px 16px",
  borderRadius: "10px",
  fontWeight: "bold",
  cursor: "pointer",
};

const cancelButton = {
  background: "#e5e7eb",
  color: "#111827",
  border: "none",
  padding: "10px 16px",
  borderRadius: "10px",
  fontWeight: "bold",
  cursor: "pointer",
};

const tableCard = {
  overflowX: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  background: "#fff",
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
  textTransform: "uppercase",
};

const td = {
  padding: "13px 14px",
  verticalAlign: "middle",
  fontSize: "14px",
  borderBottom: "1px solid #f1f5f9",
};

const emptyCell = {
  textAlign: "center",
  padding: "30px",
  color: "#94a3b8",
  fontWeight: "700",
};

const smallText = {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "12px",
};

const offerText = {
  background: "#fff7ed",
  color: "#9a3412",
  padding: "8px 11px",
  borderRadius: "12px",
  fontSize: "12px",
  fontWeight: "800",
  display: "inline-block",
};

const activeBadge = {
  background: "#dcfce7",
  color: "#166534",
  padding: "6px 10px",
  borderRadius: "999px",
  fontWeight: "900",
  fontSize: "12px",
};

const expiredBadge = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: "6px 10px",
  borderRadius: "999px",
  fontWeight: "900",
  fontSize: "12px",
};

const programmedBadge = {
  background: "#dbeafe",
  color: "#1d4ed8",
  padding: "6px 10px",
  borderRadius: "999px",
  fontWeight: "900",
  fontSize: "12px",
};

const pushActiveBadge = {
  background: "#fef3c7",
  color: "#92400e",
  padding: "6px 10px",
  borderRadius: "999px",
  fontWeight: "900",
  fontSize: "12px",
};

const muted = {
  color: "#cbd5e1",
  fontWeight: "900",
};

const actions = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  minWidth: "110px",
};

const baseBtn = {
  border: "none",
  borderRadius: "10px",
  padding: "7px 9px",
  cursor: "pointer",
  fontWeight: "900",
  fontSize: "12px",
};

const editBtn = {
  ...baseBtn,
  background: "#dbeafe",
  color: "#1d4ed8",
};

const pushBtn = {
  ...baseBtn,
  background: "#fef3c7",
  color: "#92400e",
};

const offPushBtn = {
  ...baseBtn,
  background: "#e5e7eb",
  color: "#374151",
};

const deleteBtn = {
  ...baseBtn,
  background: "#fee2e2",
  color: "#b91c1c",
};
