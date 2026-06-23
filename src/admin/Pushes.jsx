import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const DIAS = [
  { id: "1", label: "Lunes" },
  { id: "2", label: "Martes" },
  { id: "3", label: "Miércoles" },
  { id: "4", label: "Jueves" },
  { id: "5", label: "Viernes" },
  { id: "6", label: "Sábado" },
  { id: "0", label: "Domingo" },
];

export default function Pushes() {
  const formRef = useRef(null);

  const [pushes, setPushes] = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busquedaArticulo, setBusquedaArticulo] = useState("");
  const [busquedaPush, setBusquedaPush] = useState("");

  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    articulo_id: "",
    codigo_articulo: "",
    nombre_articulo: "",
    departamento: "",
    texto: "",
    ruta: "",
    fecha_inicio: "",
    fecha_fin: "",
    dias_semana: [],
    activo: true,
    color: "#ea580c",
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);

    const { data: pushesData, error: pushesError } = await supabase
      .from("push_ofertas")
      .select("*")
      .order("fecha_inicio", { ascending: false });

    const { data: calendarioData, error: calendarioError } = await supabase
      .from("push_calendario")
      .select(`
        id,
        fecha,
        push_id,
        push_ofertas (
          id,
          titulo,
          nombre_articulo,
          activo
        )
      `)
      .order("fecha", { ascending: true });

    const { data: articulosData, error: articulosError } = await supabase
      .from("articulos")
      .select("id, codigo, nombre, activo, oculto");

    if (pushesError) {
      console.error(pushesError);
      alert("Error cargando pushes");
    }

    if (calendarioError) {
      console.error(calendarioError);
      alert("Error cargando calendario");
    }

    if (articulosError) {
      console.error(articulosError);
      alert("Error cargando artículos");
    }

    setPushes(pushesData || []);
    setCalendario(calendarioData || []);
    setArticulos(articulosData || []);
    setCargando(false);
  }

  const pushesFiltrados = useMemo(() => {
    const texto = busquedaPush.trim().toLowerCase();

    return [...pushes].filter((push) => {
      if (!texto) return true;

      return `
        ${push.titulo || ""}
        ${push.descripcion || ""}
        ${push.codigo_articulo || ""}
        ${push.nombre_articulo || ""}
        ${push.departamento || ""}
        ${push.ruta || ""}
      `
        .toLowerCase()
        .includes(texto);
    });
  }, [pushes, busquedaPush]);

  const articulosFiltrados = useMemo(() => {
    const texto = busquedaArticulo.trim().toLowerCase();

    return [...articulos]
      .filter((articulo) => !articulo.oculto)
      .sort((a, b) =>
        String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
          sensitivity: "base",
        })
      )
      .filter((articulo) => {
        if (!texto) return true;
        return `${articulo.codigo || ""} ${articulo.nombre || ""}`
          .toLowerCase()
          .includes(texto);
      })
      .slice(0, 80);
  }, [articulos, busquedaArticulo]);

  const proximosDias = useMemo(() => {
    const hoy = fechaLocalISO(new Date());
    return calendario.filter((dia) => dia.fecha >= hoy).slice(0, 12);
  }, [calendario]);

  function limpiarFormulario() {
    setEditando(null);
    setBusquedaArticulo("");
    setForm({
      titulo: "",
      descripcion: "",
      articulo_id: "",
      codigo_articulo: "",
      nombre_articulo: "",
      departamento: "",
      texto: "",
      ruta: "",
      fecha_inicio: "",
      fecha_fin: "",
      dias_semana: [],
      activo: true,
      color: "#ea580c",
    });
  }

  function nuevoPush() {
    limpiarFormulario();
    setMostrarFormulario(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  function editarPush(push) {
    setEditando(push);
    setBusquedaArticulo(push.nombre_articulo || "");
    setForm({
      titulo: push.titulo || "",
      descripcion: push.descripcion || "",
      articulo_id: String(push.articulo_id || ""),
      codigo_articulo: push.codigo_articulo || "",
      nombre_articulo: push.nombre_articulo || "",
      departamento: push.departamento || "",
      texto: push.texto || "",
      ruta: push.ruta || "",
      fecha_inicio: push.fecha_inicio || "",
      fecha_fin: push.fecha_fin || "",
      dias_semana: Array.isArray(push.dias_semana) ? push.dias_semana.map(String) : [],
      activo: Boolean(push.activo),
      color: push.color || "#ea580c",
    });
    setMostrarFormulario(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  function cancelarFormulario() {
    limpiarFormulario();
    setMostrarFormulario(false);
  }

  function cambiarCampo(campo, valor) {
    setForm((actual) => ({ ...actual, [campo]: valor }));
  }

  function seleccionarArticulo(articulo) {
    setForm((actual) => ({
      ...actual,
      articulo_id: String(articulo.id),
      codigo_articulo: articulo.codigo || "",
      nombre_articulo: articulo.nombre || "",
      departamento: actual.departamento || "",
    }));
    setBusquedaArticulo(articulo.nombre || "");
  }

  function alternarDia(diaId) {
    setForm((actual) => {
      const existe = actual.dias_semana.includes(diaId);
      return {
        ...actual,
        dias_semana: existe
          ? actual.dias_semana.filter((d) => d !== diaId)
          : [...actual.dias_semana, diaId],
      };
    });
  }

  function calcularFechasPush(fechaInicio, fechaFin, diasSemana) {
    if (!fechaInicio || !fechaFin) return [];

    const inicio = crearFechaLocal(fechaInicio);
    const fin = crearFechaLocal(fechaFin);
    const diasPermitidos = new Set(diasSemana.map(String));
    const fechas = [];
    const actual = new Date(inicio);

    while (actual <= fin) {
      const diaSemana = String(actual.getDay());
      if (diasPermitidos.size === 0 || diasPermitidos.has(diaSemana)) {
        fechas.push(fechaLocalISO(actual));
      }
      actual.setDate(actual.getDate() + 1);
    }

    return fechas;
  }

  function validarFormulario() {
    if (!form.titulo.trim()) return "El título es obligatorio";
    if (!form.articulo_id) return "Selecciona un artículo";
    if (!form.fecha_inicio) return "La fecha de inicio es obligatoria";
    if (!form.fecha_fin) return "La fecha de fin es obligatoria";
    if (form.fecha_fin < form.fecha_inicio) return "La fecha fin no puede ser anterior a la fecha inicio";

    const fechas = calcularFechasPush(form.fecha_inicio, form.fecha_fin, form.dias_semana);
    if (fechas.length === 0) return "No hay ningún día válido dentro de ese rango";

    return null;
  }

  async function guardarPush() {
    const errorValidacion = validarFormulario();
    if (errorValidacion) {
      alert(errorValidacion);
      return;
    }

    const fechas = calcularFechasPush(form.fecha_inicio, form.fecha_fin, form.dias_semana);

    const fechasOcupadas = calendario.filter((dia) => {
      if (editando && dia.push_id === editando.id) return false;
      return fechas.includes(dia.fecha);
    });

    if (fechasOcupadas.length > 0) {
      const listado = fechasOcupadas
        .slice(0, 8)
        .map((dia) => `${formatearFecha(dia.fecha)}: ${dia.push_ofertas?.titulo || "Push existente"}`)
        .join("\n");

      alert(`No se puede guardar.\n\nEstos días ya tienen push:\n\n${listado}`);
      return;
    }

    const datosPush = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      articulo_id: form.articulo_id ? Number(form.articulo_id) : null,
      codigo_articulo: form.codigo_articulo,
      nombre_articulo: form.nombre_articulo,
      departamento: form.departamento || null,
      texto: form.texto.trim() || form.descripcion.trim() || null,
      ruta: form.ruta.trim() || null,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      dias_semana: form.dias_semana,
      activo: Boolean(form.activo),
      color: form.color || "#ea580c",
    };

    let pushId = editando?.id;

    if (editando) {
      const { error } = await supabase
        .from("push_ofertas")
        .update(datosPush)
        .eq("id", editando.id);

      if (error) {
        console.error(error);
        alert("Error actualizando push");
        return;
      }

      await supabase.from("push_calendario").delete().eq("push_id", editando.id);
    } else {
      const { data, error } = await supabase
        .from("push_ofertas")
        .insert([datosPush])
        .select("id")
        .single();

      if (error) {
        console.error(error);
        alert("Error creando push");
        return;
      }

      pushId = data.id;
    }

    const registrosCalendario = fechas.map((fecha) => ({ push_id: pushId, fecha }));

    const { error: calendarioError } = await supabase
      .from("push_calendario")
      .insert(registrosCalendario);

    if (calendarioError) {
      console.error(calendarioError);
      if (!editando) await supabase.from("push_ofertas").delete().eq("id", pushId);
      alert("Error guardando calendario. Puede que alguna fecha ya esté ocupada.");
      return;
    }

    cancelarFormulario();
    cargarDatos();
  }

  async function cambiarActivo(push) {
    const { error } = await supabase
      .from("push_ofertas")
      .update({ activo: !push.activo })
      .eq("id", push.id);

    if (error) {
      console.error(error);
      alert("Error cambiando estado");
      return;
    }

    cargarDatos();
  }

  async function eliminarPush(push) {
    const confirmar = confirm(`¿Eliminar este push?\n\n${push.titulo}`);
    if (!confirmar) return;

    const { error } = await supabase.from("push_ofertas").delete().eq("id", push.id);

    if (error) {
      console.error(error);
      alert("Error eliminando push");
      return;
    }

    cargarDatos();
  }

  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Administración</div>
          <h1 style={title}>Push Diario</h1>
          <p style={subtitle}>Programa un único artículo push por día para no saturar a los clientes.</p>
        </div>
        <button onClick={nuevoPush} style={newButton}>+ Nuevo push</button>
      </section>

      <section style={statsGrid}>
        <StatCard label="Pushes" value={pushes.length} />
        <StatCard label="Activos" value={pushes.filter((p) => p.activo).length} />
        <StatCard label="Días programados" value={calendario.length} />
        <StatCard label="Próximos días" value={proximosDias.length} />
      </section>

      {proximosDias.length > 0 && (
        <section style={calendarBox}>
          <div style={tableHeader}>
            <div>
              <h2 style={tableTitle}>Próximos push programados</h2>
              <p style={tableSubtitle}>El calendario impide que dos push usen la misma fecha.</p>
            </div>
          </div>
          <div style={calendarGrid}>
            {proximosDias.map((dia) => (
              <div key={dia.id} style={dayCard}>
                <strong>{formatearFecha(dia.fecha)}</strong>
                <span>{dia.push_ofertas?.titulo || "Push"}</span>
                <small>{dia.push_ofertas?.nombre_articulo || ""}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {mostrarFormulario && (
        <section ref={formRef} style={formBox}>
          <div style={formHeader}>
            <div>
              <h2 style={formTitle}>{editando ? "Editar push" : "Nuevo push"}</h2>
              <p style={formSubtitle}>Selecciona artículo, rango de fechas y días de la semana.</p>
            </div>
            <button type="button" onClick={cancelarFormulario} style={closeButton}>Cerrar</button>
          </div>

          <div style={formGrid}>
            <div>
              <label style={label}>Buscar artículo</label>
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
                  const seleccionado = String(articulo.id) === String(form.articulo_id);
                  return (
                    <button key={articulo.id} type="button" onClick={() => seleccionarArticulo(articulo)} style={articleOption(seleccionado)}>
                      <span style={articleInfo}>
                        <strong>{articulo.nombre}</strong>
                        <small style={articleCode}>Código {articulo.codigo}</small>
                      </span>
                      {seleccionado && <span style={selectedBadge}>Seleccionado</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={label}>Título del push</label>
              <input type="text" value={form.titulo} onChange={(e) => cambiarCampo("titulo", e.target.value)} placeholder="Ej: 🔥 Oferta del día" style={input} />

              <label style={label}>Texto visible</label>
              <textarea value={form.descripcion} onChange={(e) => cambiarCampo("descripcion", e.target.value)} placeholder="Ej: Precio especial solo hoy" style={textarea} />

              <div style={dateGrid}>
                <div>
                  <label style={label}>Fecha inicio</label>
                  <input type="date" value={form.fecha_inicio} onChange={(e) => cambiarCampo("fecha_inicio", e.target.value)} style={input} />
                </div>
                <div>
                  <label style={label}>Fecha fin</label>
                  <input type="date" value={form.fecha_fin} onChange={(e) => cambiarCampo("fecha_fin", e.target.value)} style={input} />
                </div>
              </div>

              <label style={label}>Días de la semana</label>
              <div style={weekGrid}>
                {DIAS.map((dia) => (
                  <button key={dia.id} type="button" onClick={() => alternarDia(dia.id)} style={weekButton(form.dias_semana.includes(dia.id))}>
                    {dia.label}
                  </button>
                ))}
              </div>
              <p style={hint}>Si no marcas ningún día, saldrá todos los días del rango.</p>

              <div style={dateGrid}>
                <div>
                  <label style={label}>Departamento</label>
                  <input type="text" value={form.departamento} onChange={(e) => cambiarCampo("departamento", e.target.value)} placeholder="Bebidas / Charcutería" style={input} />
                </div>
                <div>
                  <label style={label}>Ruta opcional</label>
                  <input type="text" value={form.ruta} onChange={(e) => cambiarCampo("ruta", e.target.value)} placeholder="Ej: Vigo" style={input} />
                </div>
              </div>

              <label style={checkboxLabel}>
                <input type="checkbox" checked={form.activo} onChange={(e) => cambiarCampo("activo", e.target.checked)} /> Push activo
              </label>

              <div style={previewBox}>
                <strong>{form.titulo || "🔥 Oferta del día"}</strong>
                <p>{form.descripcion || "Texto del push..."}</p>
                <small>{form.nombre_articulo || "Artículo seleccionado"}</small>
              </div>

              <div style={formActions}>
                <button onClick={guardarPush} style={saveButton}>Guardar push</button>
                <button onClick={cancelarFormulario} style={cancelButton}>Cancelar</button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section style={toolbar}>
        <div style={searchRow}>
          <div style={searchBox}>
            <span style={searchIcon}>🔎</span>
            <input type="text" value={busquedaPush} onChange={(e) => setBusquedaPush(e.target.value)} placeholder="Buscar push..." style={searchInput} />
          </div>
          <div style={resultCounter}><strong>{pushesFiltrados.length}</strong><span> de {pushes.length} pushes</span></div>
        </div>
      </section>

      <section style={tableShell}>
        <div style={tableHeader}>
          <div>
            <h2 style={tableTitle}>Listado de push</h2>
            <p style={tableSubtitle}>Edita, elimina o activa/desactiva campañas push.</p>
          </div>
          <button type="button" onClick={cargarDatos} style={refreshButton}>Actualizar</button>
        </div>

        {cargando ? (
          <div style={loadingBox}>Cargando push...</div>
        ) : (
          <div style={tableCard}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Push</th>
                  <th style={th}>Artículo</th>
                  <th style={th}>Fechas</th>
                  <th style={th}>Días</th>
                  <th style={th}>Estado</th>
                  <th style={th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pushesFiltrados.length === 0 ? (
                  <tr><td colSpan="6" style={emptyCell}>No hay push que coincidan con la búsqueda</td></tr>
                ) : (
                  pushesFiltrados.map((push) => (
                    <tr key={push.id}>
                      <td style={td}><strong>{push.titulo}</strong><div style={smallText}>{push.descripcion || push.texto || "—"}</div></td>
                      <td style={td}><strong>{push.nombre_articulo || "Sin artículo"}</strong><div style={smallText}>Código: {push.codigo_articulo || "-"}</div></td>
                      <td style={td}>{push.fecha_inicio || "—"} → {push.fecha_fin || "—"}</td>
                      <td style={td}>{nombreDias(push.dias_semana)}</td>
                      <td style={td}>{push.activo ? <span style={activeBadge}>✅ Activo</span> : <span style={expiredBadge}>⛔ Inactivo</span>}</td>
                      <td style={td}>
                        <div style={actions}>
                          <button style={editBtn} onClick={() => editarPush(push)}>✏️ Editar</button>
                          <button style={push.activo ? offPushBtn : pushBtn} onClick={() => cambiarActivo(push)}>{push.activo ? "Desactivar" : "Activar"}</button>
                          <button style={deleteBtn} onClick={() => eliminarPush(push)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return <div style={statCard}><div style={statValue}>{value}</div><div style={statLabel}>{label}</div></div>;
}

function crearFechaLocal(fechaISO) {
  const [year, month, day] = fechaISO.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function fechaLocalISO(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return "—";
  return crearFechaLocal(fechaISO).toLocaleDateString("es-ES");
}

function nombreDias(dias) {
  if (!Array.isArray(dias) || dias.length === 0) return "Todos los días";
  return dias.map(String).map((dia) => DIAS.find((d) => d.id === dia)?.label).filter(Boolean).join(", ");
}

const page = { minHeight: "100vh", padding: "24px", background: "linear-gradient(180deg, #eef2ff 0%, #f8fafc 38%, #ffffff 100%)", boxSizing: "border-box" };
const hero = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", background: "linear-gradient(135deg, #111827 0%, #7c2d12 48%, #ea580c 100%)", borderRadius: "24px", padding: "28px", color: "#ffffff", boxShadow: "0 22px 45px rgba(234,88,12,0.22)", marginBottom: "18px" };
const eyebrow = { display: "inline-block", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "6px 12px", fontSize: "12px", fontWeight: "900", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "12px" };
const title = { margin: 0, fontSize: "34px", lineHeight: "1", fontWeight: "950" };
const subtitle = { margin: "10px 0 0", color: "#ffedd5", fontSize: "15px", maxWidth: "680px" };
const newButton = { background: "#22c55e", color: "#fff", border: "none", borderRadius: "16px", padding: "15px 22px", fontSize: "15px", fontWeight: "950", cursor: "pointer", boxShadow: "0 14px 26px rgba(34,197,94,0.28)", whiteSpace: "nowrap" };
const statsGrid = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px", marginBottom: "18px" };
const statCard = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "18px", padding: "16px", boxShadow: "0 10px 28px rgba(15,23,42,0.06)" };
const statValue = { fontSize: "28px", fontWeight: "950", color: "#111827", lineHeight: "1" };
const statLabel = { marginTop: "8px", fontSize: "12px", fontWeight: "850", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" };
const calendarBox = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "22px", padding: "16px", marginBottom: "18px", boxShadow: "0 12px 30px rgba(15,23,42,0.06)" };
const calendarGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "10px" };
const dayCard = { background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "16px", padding: "12px", display: "flex", flexDirection: "column", gap: "5px", color: "#9a3412" };
const formBox = { background: "#ffffff", border: "1px solid #fed7aa", borderRadius: "22px", padding: "18px", marginBottom: "18px", boxShadow: "0 18px 40px rgba(234,88,12,0.12)" };
const formHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px", marginBottom: "14px" };
const formTitle = { margin: 0, color: "#111827", fontSize: "21px", fontWeight: "950" };
const formSubtitle = { margin: "5px 0 0", color: "#64748b", fontSize: "13px" };
const closeButton = { border: "none", borderRadius: "999px", padding: "9px 14px", background: "#f1f5f9", color: "#334155", fontWeight: "900", cursor: "pointer" };
const formGrid = { display: "grid", gridTemplateColumns: "minmax(280px, 0.9fr) minmax(320px, 1.1fr)", gap: "18px", alignItems: "start" };
const toolbar = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "22px", padding: "16px", marginBottom: "18px", boxShadow: "0 12px 30px rgba(15,23,42,0.06)" };
const searchRow = { display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "center" };
const searchBox = { display: "flex", alignItems: "center", gap: "10px", background: "#f8fafc", border: "1px solid #dbe4ef", borderRadius: "16px", padding: "0 14px" };
const searchIcon = { fontSize: "17px" };
const searchInput = { width: "100%", boxSizing: "border-box", padding: "15px 0", border: "none", fontSize: "15px", outline: "none", background: "transparent", color: "#111827" };
const resultCounter = { background: "#fff7ed", color: "#9a3412", borderRadius: "14px", padding: "12px 15px", fontSize: "14px", whiteSpace: "nowrap" };
const label = { display: "block", fontWeight: "900", marginBottom: "7px", color: "#334155", fontSize: "13px" };
const input = { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #d1d5db", borderRadius: "13px", fontSize: "14px", marginBottom: "12px", outline: "none", background: "#ffffff" };
const textarea = { ...input, minHeight: "108px", resize: "vertical" };
const articleList = { maxHeight: "360px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "16px", background: "#fff", marginBottom: "14px", boxShadow: "inset 0 1px 0 rgba(15,23,42,0.03)" };
const articleOption = (selected) => ({ width: "100%", border: "none", borderBottom: "1px solid #f1f5f9", background: selected ? "#ffedd5" : "#fff", padding: "12px 13px", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" });
const articleInfo = { display: "flex", flexDirection: "column", minWidth: 0 };
const articleCode = { display: "block", color: "#64748b", fontSize: "12px", marginTop: "3px" };
const selectedBadge = { background: "#ea580c", color: "#fff", padding: "6px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: "900", whiteSpace: "nowrap" };
const dateGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const weekGrid = { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" };
const weekButton = (selected) => ({ border: "none", borderRadius: "999px", padding: "9px 12px", background: selected ? "#ea580c" : "#f1f5f9", color: selected ? "#fff" : "#334155", cursor: "pointer", fontWeight: "950" });
const hint = { margin: "0 0 12px", color: "#64748b", fontSize: "12px", fontWeight: "800" };
const checkboxLabel = { display: "block", marginBottom: "10px", fontWeight: "850", color: "#334155" };
const previewBox = { background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "16px", padding: "14px", color: "#9a3412" };
const formActions = { display: "flex", gap: "10px", marginTop: "12px" };
const saveButton = { background: "#22c55e", color: "white", border: "none", padding: "12px 18px", borderRadius: "14px", fontWeight: "950", cursor: "pointer", boxShadow: "0 12px 24px rgba(34,197,94,0.22)" };
const cancelButton = { background: "#e5e7eb", color: "#111827", border: "none", padding: "12px 18px", borderRadius: "14px", fontWeight: "950", cursor: "pointer" };
const tableShell = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "22px", padding: "16px", boxShadow: "0 14px 35px rgba(15,23,42,0.07)" };
const tableHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", marginBottom: "14px" };
const tableTitle = { margin: 0, color: "#111827", fontSize: "20px", fontWeight: "950" };
const tableSubtitle = { margin: "5px 0 0", color: "#64748b", fontSize: "13px" };
const refreshButton = { border: "none", borderRadius: "14px", padding: "11px 15px", background: "#fff7ed", color: "#9a3412", fontWeight: "950", cursor: "pointer" };
const loadingBox = { padding: "30px", textAlign: "center", color: "#64748b", fontWeight: "900", background: "#f8fafc", borderRadius: "16px" };
const tableCard = { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "18px", background: "#fff" };
const table = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };
const th = { background: "#f8fafc", color: "#475569", textAlign: "left", padding: "13px 14px", fontSize: "12px", fontWeight: "950", borderBottom: "1px solid #e5e7eb", textTransform: "uppercase" };
const td = { padding: "13px 14px", verticalAlign: "middle", fontSize: "14px", borderBottom: "1px solid #f1f5f9" };
const emptyCell = { textAlign: "center", padding: "30px", color: "#94a3b8", fontWeight: "800" };
const smallText = { marginTop: "4px", color: "#64748b", fontSize: "12px" };
const activeBadge = { background: "#dcfce7", color: "#166534", padding: "6px 10px", borderRadius: "999px", fontWeight: "950", fontSize: "12px" };
const expiredBadge = { background: "#fee2e2", color: "#991b1b", padding: "6px 10px", borderRadius: "999px", fontWeight: "950", fontSize: "12px" };
const actions = { display: "flex", flexDirection: "column", gap: "6px", minWidth: "110px" };
const baseBtn = { border: "none", borderRadius: "10px", padding: "8px 10px", cursor: "pointer", fontWeight: "950", fontSize: "12px" };
const editBtn = { ...baseBtn, background: "#dbeafe", color: "#1d4ed8" };
const pushBtn = { ...baseBtn, background: "#fef3c7", color: "#92400e" };
const offPushBtn = { ...baseBtn, background: "#e5e7eb", color: "#374151" };
const deleteBtn = { ...baseBtn, background: "#fee2e2", color: "#b91c1c" };
