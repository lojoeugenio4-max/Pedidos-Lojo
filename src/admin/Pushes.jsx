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
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busquedaArticulo, setBusquedaArticulo] = useState("");

  const [form, setForm] = useState({
    titulo: "🔥 Oferta del día",
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
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    setError("");

    try {
      const { data: pushesData, error: pushesError } = await supabase
        .from("push_ofertas")
        .select("*")
        .order("fecha_inicio", { ascending: true });

      if (pushesError) throw pushesError;

      const { data: calendarioData, error: calendarioError } = await supabase
        .from("push_calendario")
        .select("*")
        .order("fecha", { ascending: true });

      if (calendarioError) throw calendarioError;

      const { data: articulosData, error: articulosError } = await supabase
        .from("articulos")
        .select("id, codigo, nombre, activo, oculto")
        .order("nombre", { ascending: true });

      if (articulosError) throw articulosError;

      setPushes(pushesData || []);
      setCalendario(calendarioData || []);
      setArticulos(articulosData || []);
    } catch (err) {
      console.error("Error cargando Push Diario:", err);
      setError(err?.message || JSON.stringify(err));
    } finally {
      setCargando(false);
    }
  }

  const calendarioConPush = useMemo(() => {
    return calendario.map((dia) => {
      const push = pushes.find((p) => p.id === dia.push_id);
      return { ...dia, push };
    });
  }, [calendario, pushes]);

  const articulosFiltrados = useMemo(() => {
    const texto = busquedaArticulo.trim().toLowerCase();

    return articulos
      .filter((articulo) => !articulo.oculto)
      .filter((articulo) => {
        if (!texto) return true;
        return `${articulo.codigo || ""} ${articulo.nombre || ""}`
          .toLowerCase()
          .includes(texto);
      })
      .slice(0, 80);
  }, [articulos, busquedaArticulo]);

  function abrirFormulario() {
    setEditando(null);
    setMostrarFormulario(true);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function cerrarFormulario() {
    setEditando(null);
    setMostrarFormulario(false);
    setBusquedaArticulo("");
    setForm({
      titulo: "🔥 Oferta del día",
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
    });
  }

  function cambiarCampo(campo, valor) {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function seleccionarArticulo(articulo) {
    setForm((actual) => ({
      ...actual,
      articulo_id: String(articulo.id),
      codigo_articulo: articulo.codigo || "",
      nombre_articulo: articulo.nombre || "",
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

  function calcularFechas(fechaInicio, fechaFin, diasSemana) {
    if (!fechaInicio || !fechaFin) return [];

    const inicio = crearFechaLocal(fechaInicio);
    const fin = crearFechaLocal(fechaFin);
    const diasPermitidos = new Set((diasSemana || []).map(String));
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


  function editarPush(push) {
    setEditando(push);
    setBusquedaArticulo(push.nombre_articulo || "");

    setForm({
      titulo: push.titulo || "🔥 Oferta del día",
      descripcion: push.descripcion || push.texto || "",
      articulo_id: String(push.articulo_id || ""),
      codigo_articulo: push.codigo_articulo || "",
      nombre_articulo: push.nombre_articulo || "",
      departamento: push.departamento || "",
      texto: push.texto || "",
      ruta: push.ruta || "",
      fecha_inicio: push.fecha_inicio || "",
      fecha_fin: push.fecha_fin || "",
      dias_semana: Array.isArray(push.dias_semana)
        ? push.dias_semana.map(String)
        : [],
      activo: Boolean(push.activo),
    });

    setMostrarFormulario(true);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  async function guardarPush() {
    setError("");

    if (!form.titulo.trim()) return alert("El título es obligatorio");
    if (!form.articulo_id) return alert("Selecciona un artículo");
    if (!form.descripcion.trim()) return alert("El texto del push es obligatorio");
    if (!form.fecha_inicio) return alert("La fecha de inicio es obligatoria");
    if (!form.fecha_fin) return alert("La fecha fin es obligatoria");
    if (!form.dias_semana || form.dias_semana.length === 0) {
      return alert("Selecciona al menos un día de la semana para activar el push");
    }
    if (form.fecha_fin < form.fecha_inicio) {
      return alert("La fecha fin no puede ser anterior a la fecha inicio");
    }

    const fechas = calcularFechas(
      form.fecha_inicio,
      form.fecha_fin,
      form.dias_semana
    );

    if (fechas.length === 0) {
      return alert("No hay ningún día válido en ese rango");
    }

    const fechasOcupadas = calendarioConPush.filter((dia) => {
      if (editando && dia.push_id === editando.id) return false;
      return fechas.includes(dia.fecha);
    });

    if (fechasOcupadas.length > 0) {
      const listado = fechasOcupadas
        .slice(0, 10)
        .map(
          (dia) =>
            `${formatearFecha(dia.fecha)} - ${
              dia.push?.titulo || "Push existente"
            }`
        )
        .join("\n");

      return alert(`No se puede guardar.\n\nEstos días ya tienen push:\n\n${listado}`);
    }

    setCargando(true);

    try {
      const datosPush = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        articulo_id: Number(form.articulo_id),
        codigo_articulo: form.codigo_articulo,
        nombre_articulo: form.nombre_articulo,
        departamento: form.departamento.trim() || null,
        texto: form.descripcion.trim(),
        ruta: form.ruta.trim() || null,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        dias_semana: form.dias_semana,
        activo: Boolean(form.activo),
      };

      let pushId = editando?.id;

      if (editando) {
        const { error: pushError } = await supabase
          .from("push_ofertas")
          .update(datosPush)
          .eq("id", editando.id);

        if (pushError) throw pushError;

        const { error: borrarCalendarioError } = await supabase
          .from("push_calendario")
          .delete()
          .eq("push_id", editando.id);

        if (borrarCalendarioError) throw borrarCalendarioError;
      } else {
        const { data: pushCreado, error: pushError } = await supabase
          .from("push_ofertas")
          .insert([datosPush])
          .select("id")
          .single();

        if (pushError) throw pushError;

        pushId = pushCreado.id;
      }

      const registrosCalendario = fechas.map((fecha) => ({
        push_id: pushId,
        fecha,
      }));

      const { error: calendarioError } = await supabase
        .from("push_calendario")
        .insert(registrosCalendario);

      if (calendarioError) {
        if (!editando) {
          await supabase.from("push_ofertas").delete().eq("id", pushId);
        }
        throw calendarioError;
      }

      cerrarFormulario();
      await cargarDatos();
    } catch (err) {
      console.error("Error guardando push:", err);
      setError(err?.message || JSON.stringify(err));
      alert("Error guardando push. Revisa el mensaje rojo.");
    } finally {
      setCargando(false);
    }
  }



  async function cambiarEstadoPush(push) {
    setCargando(true);
    setError("");

    try {
      const { error: pushError } = await supabase
        .from("push_ofertas")
        .update({ activo: !push.activo })
        .eq("id", push.id);

      if (pushError) throw pushError;

      await cargarDatos();
    } catch (err) {
      console.error("Error cambiando estado del push:", err);
      setError(err?.message || JSON.stringify(err));
      alert("Error cambiando estado del push. Revisa el mensaje rojo.");
    } finally {
      setCargando(false);
    }
  }

  async function eliminarPush(push) {
    const confirmar = confirm(
      `¿Eliminar este push?\n\n${push.titulo || "Sin título"}\n${push.nombre_articulo || ""}`
    );

    if (!confirmar) return;

    setCargando(true);
    setError("");

    try {
      const { error: calendarioError } = await supabase
        .from("push_calendario")
        .delete()
        .eq("push_id", push.id);

      if (calendarioError) throw calendarioError;

      const { error: pushError } = await supabase
        .from("push_ofertas")
        .delete()
        .eq("id", push.id);

      if (pushError) throw pushError;

      await cargarDatos();
    } catch (err) {
      console.error("Error eliminando push:", err);
      setError(err?.message || JSON.stringify(err));
      alert("Error eliminando push. Revisa el mensaje rojo.");
    } finally {
      setCargando(false);
    }
  }

  const totalPushes = pushes.length;
  const totalDias = calendario.length;
  const totalActivos = pushes.filter((p) => p.activo).length;

  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Administración</div>
          <h1 style={title}>Push Diario</h1>
          <p style={subtitle}>
            Programa un único artículo push por día para no saturar a los clientes.
          </p>
        </div>

        <div style={heroActions}>
          <button type="button" onClick={abrirFormulario} style={newButton}>
            + Nuevo Push
          </button>

          <button type="button" onClick={cargarDatos} style={refreshHeroButton}>
            Actualizar
          </button>
        </div>
      </section>

      <section style={statsGrid}>
        <StatCard label="Pushes creados" value={totalPushes} />
        <StatCard label="Pushes activos" value={totalActivos} />
        <StatCard label="Días calendario" value={totalDias} />
      </section>

      {error && (
        <section style={errorBox}>
          <strong>Error</strong>
          <p>{error}</p>
        </section>
      )}

      {mostrarFormulario && (
        <section ref={formRef} style={formBox}>
          <div style={formHeader}>
            <div>
              <h2 style={formTitle}>{editando ? "Editar Push" : "Nuevo Push"}</h2>
              <p style={formSubtitle}>
                Selecciona artículo, fechas y días. El sistema bloqueará días ya usados.
              </p>
            </div>

            <button type="button" onClick={cerrarFormulario} style={closeButton}>
              Cerrar
            </button>
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
                  cambiarCampo("codigo_articulo", "");
                  cambiarCampo("nombre_articulo", "");
                }}
                placeholder="Buscar por nombre o código..."
                style={input}
              />

              <div style={articleList}>
                {articulosFiltrados.map((articulo) => {
                  const seleccionado =
                    String(articulo.id) === String(form.articulo_id);

                  return (
                    <button
                      key={articulo.id}
                      type="button"
                      onClick={() => seleccionarArticulo(articulo)}
                      style={articleOption(seleccionado)}
                    >
                      <span>
                        <strong>{articulo.nombre}</strong>
                        <small style={articleCode}>
                          Código {articulo.codigo || "-"}
                        </small>
                      </span>

                      {seleccionado && (
                        <span style={selectedBadge}>Seleccionado</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={label}>Título</label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => cambiarCampo("titulo", e.target.value)}
                style={input}
              />

              <label style={label}>Texto visible del push</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => cambiarCampo("descripcion", e.target.value)}
                placeholder="Ej: 2,50 € docena. Comprando 1 caja sale a 2 €"
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

              <label style={label}>Días de la semana</label>
              <div style={weekGrid}>
                {DIAS.map((dia) => (
                  <button
                    key={dia.id}
                    type="button"
                    onClick={() => alternarDia(dia.id)}
                    style={weekButton(form.dias_semana.includes(dia.id))}
                  >
                    {dia.label}
                  </button>
                ))}
              </div>

              <p style={hint}>
                Selecciona al menos un día de la semana. Si no seleccionas días, el push no se activará.
              </p>

              <div style={dateGrid}>
                <div>
                  <label style={label}>Departamento opcional</label>
                  <input
                    type="text"
                    value={form.departamento}
                    onChange={(e) => cambiarCampo("departamento", e.target.value)}
                    placeholder="Bebidas / Charcutería"
                    style={input}
                  />
                </div>

                <div>
                  <label style={label}>Ruta opcional</label>
                  <input
                    type="text"
                    value={form.ruta}
                    onChange={(e) => cambiarCampo("ruta", e.target.value)}
                    placeholder="Ej: Ruta Vigo"
                    style={input}
                  />
                </div>
              </div>

              <label style={checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => cambiarCampo("activo", e.target.checked)}
                />{" "}
                Push activo
              </label>

              <div style={previewBox}>
                <strong>{form.titulo || "🔥 Oferta del día"}</strong>
                <p>{form.descripcion || "Texto del push..."}</p>
                <small>{form.nombre_articulo || "Artículo seleccionado"}</small>
              </div>

              <div style={formActions}>
                <button type="button" onClick={guardarPush} style={saveButton}>
                  {editando ? "Actualizar Push" : "Guardar Push"}
                </button>

                <button type="button" onClick={cerrarFormulario} style={cancelButton}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {cargando ? (
        <div style={loadingBox}>Cargando push...</div>
      ) : (
        <>
          <section style={tableShell}>
            <div style={tableHeader}>
              <div>
                <h2 style={tableTitle}>Calendario Push</h2>
                <p style={tableSubtitle}>
                  Estos son los días realmente programados en push_calendario.
                </p>
              </div>
            </div>

            <div style={tableCard}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Fecha</th>
                    <th style={th}>Título</th>
                    <th style={th}>Artículo</th>
                    <th style={th}>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {calendarioConPush.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={emptyCell}>
                        No hay días programados en push_calendario
                      </td>
                    </tr>
                  ) : (
                    calendarioConPush.map((dia) => (
                      <tr key={dia.id}>
                        <td style={td}>{formatearFecha(dia.fecha)}</td>
                        <td style={td}>
                          <strong>{dia.push?.titulo || "Push no encontrado"}</strong>
                        </td>
                        <td style={td}>
                          {dia.push?.nombre_articulo || "Sin artículo"}
                          <div style={smallText}>
                            Código: {dia.push?.codigo_articulo || "-"}
                          </div>
                        </td>
                        <td style={td}>
                          {dia.push?.activo ? (
                            <span style={activeBadge}>Activo</span>
                          ) : (
                            <span style={inactiveBadge}>Inactivo</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={tableShell}>
            <div style={tableHeader}>
              <div>
                <h2 style={tableTitle}>Pushes creados</h2>
                <p style={tableSubtitle}>
                  Estos son los registros existentes en push_ofertas.
                </p>
              </div>
            </div>

            <div style={tableCard}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Título</th>
                    <th style={th}>Artículo</th>
                    <th style={th}>Inicio</th>
                    <th style={th}>Fin</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {pushes.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={emptyCell}>
                        No hay registros en push_ofertas
                      </td>
                    </tr>
                  ) : (
                    pushes.map((push) => (
                      <tr key={push.id}>
                        <td style={td}>
                          <strong>{push.titulo || "Sin título"}</strong>
                          <div style={smallText}>{push.descripcion || push.texto || ""}</div>
                        </td>
                        <td style={td}>
                          {push.nombre_articulo || "Sin artículo"}
                          <div style={smallText}>Código: {push.codigo_articulo || "-"}</div>
                        </td>
                        <td style={td}>{push.fecha_inicio || "—"}</td>
                        <td style={td}>{push.fecha_fin || "—"}</td>
                        <td style={td}>
                          {push.activo ? (
                            <span style={activeBadge}>Activo</span>
                          ) : (
                            <span style={inactiveBadge}>Inactivo</span>
                          )}
                        </td>

                        <td style={td}>
                          <div style={actionButtons}>
                            <button
                              type="button"
                              onClick={() => editarPush(push)}
                              style={editButton}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => cambiarEstadoPush(push)}
                              style={push.activo ? deactivateButton : activateButton}
                            >
                              {push.activo ? "Desactivar" : "Activar"}
                            </button>

                            <button
                              type="button"
                              onClick={() => eliminarPush(push)}
                              style={deleteButton}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={statCard}>
      <div style={statValue}>{value}</div>
      <div style={statLabel}>{label}</div>
    </div>
  );
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

const page = { minHeight: "100vh", padding: "24px", background: "linear-gradient(180deg, #eef2ff 0%, #f8fafc 38%, #ffffff 100%)", boxSizing: "border-box" };
const hero = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", background: "linear-gradient(135deg, #111827 0%, #7c2d12 48%, #ea580c 100%)", borderRadius: "24px", padding: "28px", color: "#ffffff", boxShadow: "0 22px 45px rgba(234,88,12,0.22)", marginBottom: "18px" };
const heroActions = { display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" };
const eyebrow = { display: "inline-block", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "6px 12px", fontSize: "12px", fontWeight: "900", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "12px" };
const title = { margin: 0, fontSize: "34px", lineHeight: "1", fontWeight: "950" };
const subtitle = { margin: "10px 0 0", color: "#ffedd5", fontSize: "15px", maxWidth: "680px" };
const newButton = { background: "#22c55e", color: "#fff", border: "none", borderRadius: "16px", padding: "15px 22px", fontSize: "15px", fontWeight: "950", cursor: "pointer", boxShadow: "0 14px 26px rgba(34,197,94,0.28)", whiteSpace: "nowrap" };
const refreshHeroButton = { background: "#ffffff", color: "#9a3412", border: "none", borderRadius: "16px", padding: "15px 22px", fontSize: "15px", fontWeight: "950", cursor: "pointer", whiteSpace: "nowrap" };
const statsGrid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", marginBottom: "18px" };
const statCard = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "18px", padding: "16px", boxShadow: "0 10px 28px rgba(15,23,42,0.06)" };
const statValue = { fontSize: "28px", fontWeight: "950", color: "#111827", lineHeight: "1" };
const statLabel = { marginTop: "8px", fontSize: "12px", fontWeight: "850", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" };
const errorBox = { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", padding: "16px", borderRadius: "18px", marginBottom: "18px" };
const formBox = { background: "#ffffff", border: "1px solid #fed7aa", borderRadius: "22px", padding: "18px", marginBottom: "18px", boxShadow: "0 18px 40px rgba(234,88,12,0.12)" };
const formHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px", marginBottom: "14px" };
const formTitle = { margin: 0, color: "#111827", fontSize: "21px", fontWeight: "950" };
const formSubtitle = { margin: "5px 0 0", color: "#64748b", fontSize: "13px" };
const closeButton = { border: "none", borderRadius: "999px", padding: "9px 14px", background: "#f1f5f9", color: "#334155", fontWeight: "900", cursor: "pointer" };
const formGrid = { display: "grid", gridTemplateColumns: "minmax(280px, 0.9fr) minmax(320px, 1.1fr)", gap: "18px", alignItems: "start" };
const label = { display: "block", fontWeight: "900", marginBottom: "7px", color: "#334155", fontSize: "13px" };
const input = { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #d1d5db", borderRadius: "13px", fontSize: "14px", marginBottom: "12px", outline: "none", background: "#ffffff" };
const textarea = { ...input, minHeight: "108px", resize: "vertical" };
const articleList = { maxHeight: "360px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "16px", background: "#fff", marginBottom: "14px" };
const articleOption = (selected) => ({ width: "100%", border: "none", borderBottom: "1px solid #f1f5f9", background: selected ? "#ffedd5" : "#fff", padding: "12px 13px", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" });
const articleCode = { display: "block", color: "#64748b", fontSize: "12px", marginTop: "3px" };
const selectedBadge = { background: "#ea580c", color: "#fff", padding: "6px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: "900", whiteSpace: "nowrap" };
const dateGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const weekGrid = { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" };
const weekButton = (selected) => ({ border: "none", borderRadius: "999px", padding: "9px 12px", background: selected ? "#ea580c" : "#f1f5f9", color: selected ? "#fff" : "#334155", cursor: "pointer", fontWeight: "950" });
const hint = { margin: "0 0 12px", color: "#64748b", fontSize: "12px", fontWeight: "800" };
const checkboxLabel = { display: "block", marginBottom: "10px", fontWeight: "850", color: "#334155" };
const previewBox = { background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "16px", padding: "14px", color: "#9a3412" };
const formActions = { display: "flex", gap: "10px", marginTop: "12px" };
const saveButton = { background: "#22c55e", color: "white", border: "none", padding: "12px 18px", borderRadius: "14px", fontWeight: "950", cursor: "pointer" };
const cancelButton = { background: "#e5e7eb", color: "#111827", border: "none", padding: "12px 18px", borderRadius: "14px", fontWeight: "950", cursor: "pointer" };
const loadingBox = { padding: "30px", textAlign: "center", color: "#64748b", fontWeight: "900", background: "#ffffff", borderRadius: "16px" };
const tableShell = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "22px", padding: "16px", boxShadow: "0 14px 35px rgba(15,23,42,0.07)", marginBottom: "18px" };
const tableHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", marginBottom: "14px" };
const tableTitle = { margin: 0, color: "#111827", fontSize: "20px", fontWeight: "950" };
const tableSubtitle = { margin: "5px 0 0", color: "#64748b", fontSize: "13px" };
const tableCard = { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "18px", background: "#fff" };
const table = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };
const th = { background: "#f8fafc", color: "#475569", textAlign: "left", padding: "13px 14px", fontSize: "12px", fontWeight: "950", borderBottom: "1px solid #e5e7eb", textTransform: "uppercase" };
const td = { padding: "13px 14px", verticalAlign: "middle", fontSize: "14px", borderBottom: "1px solid #f1f5f9" };
const emptyCell = { textAlign: "center", padding: "30px", color: "#94a3b8", fontWeight: "800" };
const smallText = { marginTop: "4px", color: "#64748b", fontSize: "12px" };
const activeBadge = { background: "#dcfce7", color: "#166534", padding: "6px 10px", borderRadius: "999px", fontWeight: "950", fontSize: "12px" };
const inactiveBadge = { background: "#fee2e2", color: "#991b1b", padding: "6px 10px", borderRadius: "999px", fontWeight: "950", fontSize: "12px" };

const deleteButton = {
  background: "#fee2e2",
  color: "#b91c1c",
  border: "none",
  padding: "8px 12px",
  borderRadius: "10px",
  fontWeight: "950",
  cursor: "pointer",
  fontSize: "12px",
};

const actionButtons = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  minWidth: "110px",
};

const activateButton = {
  background: "#dcfce7",
  color: "#166534",
  border: "none",
  padding: "8px 12px",
  borderRadius: "10px",
  fontWeight: "950",
  cursor: "pointer",
  fontSize: "12px",
};

const deactivateButton = {
  background: "#e5e7eb",
  color: "#374151",
  border: "none",
  padding: "8px 12px",
  borderRadius: "10px",
  fontWeight: "950",
  cursor: "pointer",
  fontSize: "12px",
};

const editButton = {
  background: "#dbeafe",
  color: "#1d4ed8",
  border: "none",
  padding: "8px 12px",
  borderRadius: "10px",
  fontWeight: "950",
  cursor: "pointer",
  fontSize: "12px",
};
