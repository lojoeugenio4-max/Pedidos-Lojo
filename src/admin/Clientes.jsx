import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const ACTIVO = "activo";
const INACTIVO = "inactivo";
const FORMULARIO_VACIO = { nombre: "", telefono: "", estado: ACTIVO };

function generarToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replaceAll("-", "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function crearEnlace(token) {
  return `${window.location.origin}/cliente/${token}`;
}

function mensajeError(error, fallback) {
  return error?.message || error?.details || fallback;
}

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [procesandoId, setProcesandoId] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [clienteAEliminar, setClienteAEliminar] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState(null);

  const mostrarAviso = useCallback((tipo, texto) => {
    setAviso({ tipo, texto });
  }, []);

  const cargarClientes = useCallback(async () => {
    setCargando(true);
    setAviso(null);

    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      setClientes([]);
      mostrarAviso(
        "error",
        mensajeError(
          error,
          "No se pudieron cargar los clientes. Comprueba la tabla clientes en Supabase."
        )
      );
    } finally {
      setCargando(false);
    }
  }, [mostrarAviso]);

  useEffect(() => {
    cargarClientes();
  }, [cargarClientes]);

  const clientesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return clientes;

    return clientes.filter((cliente) =>
      `${cliente.nombre || ""} ${cliente.telefono || ""}`
        .toLowerCase()
        .includes(texto)
    );
  }, [clientes, busqueda]);

  const totalActivos = clientes.filter((cliente) => cliente.estado === ACTIVO).length;

  function abrirNuevo() {
    setClienteEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setErrores({});
    setModalAbierto(true);
  }

  function abrirEditar(cliente) {
    setClienteEditando(cliente);
    setFormulario({
      nombre: cliente.nombre || "",
      telefono: cliente.telefono || "",
      estado: cliente.estado === INACTIVO ? INACTIVO : ACTIVO,
    });
    setErrores({});
    setModalAbierto(true);
  }

  function cerrarModal() {
    if (guardando) return;
    setModalAbierto(false);
    setClienteEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setErrores({});
  }

  function cambiarCampo(campo, valor) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => ({ ...actual, [campo]: "" }));
  }

  async function guardarCliente(evento) {
    evento.preventDefault();

    const nuevosErrores = {};
    if (!formulario.nombre.trim()) nuevosErrores.nombre = "El nombre es obligatorio.";
    if (!formulario.telefono.trim()) nuevosErrores.telefono = "El teléfono es obligatorio.";

    if (Object.keys(nuevosErrores).length) {
      setErrores(nuevosErrores);
      return;
    }

    setGuardando(true);
    setAviso(null);

    try {
      const datos = {
        nombre: formulario.nombre.trim(),
        telefono: formulario.telefono.trim(),
        estado: formulario.estado,
        updated_at: new Date().toISOString(),
      };

      if (clienteEditando) {
        const { data, error } = await supabase
          .from("clientes")
          .update(datos)
          .eq("id", clienteEditando.id)
          .select()
          .single();

        if (error) throw error;

        setClientes((actuales) =>
          actuales.map((cliente) => (cliente.id === data.id ? data : cliente))
        );
        mostrarAviso("exito", "Cliente actualizado correctamente.");
      } else {
        const token = generarToken();
        const { data, error } = await supabase
          .from("clientes")
          .insert({
            ...datos,
            token,
            enlace_personal: crearEnlace(token),
          })
          .select()
          .single();

        if (error) throw error;

        setClientes((actuales) => [data, ...actuales]);
        mostrarAviso("exito", "Cliente creado correctamente.");
      }

      cerrarModal();
    } catch (error) {
      mostrarAviso("error", mensajeError(error, "No se pudo guardar el cliente."));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(cliente) {
    const nuevoEstado = cliente.estado === ACTIVO ? INACTIVO : ACTIVO;
    setProcesandoId(cliente.id);
    setAviso(null);

    try {
      const { data, error } = await supabase
        .from("clientes")
        .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
        .eq("id", cliente.id)
        .select()
        .single();

      if (error) throw error;

      setClientes((actuales) =>
        actuales.map((item) => (item.id === cliente.id ? data : item))
      );
      mostrarAviso(
        "exito",
        nuevoEstado === ACTIVO ? "Cliente activado." : "Cliente desactivado."
      );
    } catch (error) {
      mostrarAviso("error", mensajeError(error, "No se pudo cambiar el estado."));
    } finally {
      setProcesandoId(null);
    }
  }

  async function copiarEnlace(cliente) {
    const enlace = cliente.enlace_personal || (cliente.token ? crearEnlace(cliente.token) : "");

    if (!enlace) {
      mostrarAviso("error", "Este cliente no tiene un enlace personal.");
      return;
    }

    try {
      await navigator.clipboard.writeText(enlace);
      mostrarAviso("exito", "Enlace copiado.");
    } catch {
      mostrarAviso("error", "No se pudo copiar el enlace.");
    }
  }

  async function eliminarCliente() {
    if (!clienteAEliminar) return;

    setProcesandoId(clienteAEliminar.id);
    setAviso(null);

    try {
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", clienteAEliminar.id);

      if (error) throw error;

      setClientes((actuales) =>
        actuales.filter((cliente) => cliente.id !== clienteAEliminar.id)
      );
      setClienteAEliminar(null);
      mostrarAviso("exito", "Cliente eliminado definitivamente.");
    } catch (error) {
      mostrarAviso("error", mensajeError(error, "No se pudo eliminar el cliente."));
    } finally {
      setProcesandoId(null);
    }
  }

  return (
    <div style={styles.pagina}>
      <div style={styles.cabecera}>
        <div>
          <h2 style={styles.titulo}>Clientes</h2>
          <p style={styles.descripcion}>Gestión de clientes y enlaces personales.</p>
        </div>
        <button type="button" style={styles.botonPrincipal} onClick={abrirNuevo}>
          + Nuevo cliente
        </button>
      </div>

      <div style={styles.resumen}>
        <Resumen titulo="Total" valor={clientes.length} />
        <Resumen titulo="Activos" valor={totalActivos} />
        <Resumen titulo="Inactivos" valor={clientes.length - totalActivos} />
      </div>

      <div style={styles.herramientas}>
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Buscar por nombre o teléfono"
          style={styles.inputBusqueda}
        />
        <button type="button" style={styles.botonSecundario} onClick={cargarClientes}>
          Actualizar
        </button>
      </div>

      {aviso && (
        <div style={{ ...styles.aviso, ...(aviso.tipo === "error" ? styles.error : styles.exito) }}>
          {aviso.texto}
        </div>
      )}

      <div style={styles.tablaCaja}>
        {cargando ? (
          <div style={styles.vacio}>Cargando clientes...</div>
        ) : clientesFiltrados.length === 0 ? (
          <div style={styles.vacio}>
            {busqueda ? "No hay coincidencias." : "No hay clientes registrados."}
          </div>
        ) : (
          <div style={styles.tablaScroll}>
            <table style={styles.tabla}>
              <thead>
                <tr>
                  <th style={styles.th}>Nombre</th>
                  <th style={styles.th}>Teléfono</th>
                  <th style={styles.th}>Copiar enlace</th>
                  <th style={styles.th}>Estado</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((cliente) => {
                  const activo = cliente.estado === ACTIVO;
                  const procesando = procesandoId === cliente.id;

                  return (
                    <tr key={cliente.id}>
                      <td style={styles.td}><strong>{cliente.nombre}</strong></td>
                      <td style={styles.td}>{cliente.telefono || "—"}</td>
                      <td style={styles.td}>
                        <button type="button" style={styles.botonLink} onClick={() => copiarEnlace(cliente)}>
                          Copiar enlace
                        </button>
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.estado, ...(activo ? styles.activo : styles.inactivo) }}>
                          {activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <div style={styles.acciones}>
                          <button type="button" style={styles.botonAccion} disabled={procesando} onClick={() => abrirEditar(cliente)}>
                            Editar
                          </button>
                          <button type="button" style={styles.botonAccion} disabled={procesando} onClick={() => cambiarEstado(cliente)}>
                            {activo ? "Desactivar" : "Activar"}
                          </button>
                          <button type="button" style={styles.botonEliminar} disabled={procesando} onClick={() => setClienteAEliminar(cliente)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <Modal cerrar={cerrarModal}>
          <h3 style={styles.modalTitulo}>{clienteEditando ? "Editar cliente" : "Nuevo cliente"}</h3>
          <form onSubmit={guardarCliente}>
            <Campo titulo="Nombre" error={errores.nombre}>
              <input style={styles.input} value={formulario.nombre} onChange={(e) => cambiarCampo("nombre", e.target.value)} autoFocus />
            </Campo>
            <Campo titulo="Teléfono" error={errores.telefono}>
              <input style={styles.input} type="tel" value={formulario.telefono} onChange={(e) => cambiarCampo("telefono", e.target.value)} />
            </Campo>
            <Campo titulo="Estado">
              <select style={styles.input} value={formulario.estado} onChange={(e) => cambiarCampo("estado", e.target.value)}>
                <option value={ACTIVO}>Activo</option>
                <option value={INACTIVO}>Inactivo</option>
              </select>
            </Campo>
            {!clienteEditando && <p style={styles.info}>El token y el enlace se generan automáticamente.</p>}
            <div style={styles.modalAcciones}>
              <button type="button" style={styles.botonSecundario} onClick={cerrarModal} disabled={guardando}>Cancelar</button>
              <button type="submit" style={styles.botonPrincipal} disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</button>
            </div>
          </form>
        </Modal>
      )}

      {clienteAEliminar && (
        <Modal cerrar={() => setClienteAEliminar(null)}>
          <h3 style={styles.modalTitulo}>Eliminar cliente</h3>
          <p>Vas a eliminar definitivamente a <strong>{clienteAEliminar.nombre}</strong>.</p>
          <p style={{ color: "#b91c1c", fontWeight: 700 }}>Esta acción no se puede deshacer.</p>
          <div style={styles.modalAcciones}>
            <button type="button" style={styles.botonSecundario} onClick={() => setClienteAEliminar(null)}>Cancelar</button>
            <button type="button" style={styles.botonEliminarFuerte} onClick={eliminarCliente}>Eliminar definitivamente</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Resumen({ titulo, valor }) {
  return <div style={styles.resumenCaja}><span style={styles.resumenTitulo}>{titulo}</span><strong style={styles.resumenValor}>{valor}</strong></div>;
}

function Campo({ titulo, error, children }) {
  return <label style={styles.campo}><span style={styles.label}>{titulo}</span>{children}{error && <span style={styles.errorCampo}>{error}</span>}</label>;
}

function Modal({ cerrar, children }) {
  return <div style={styles.fondoModal} onMouseDown={cerrar}><div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>{children}</div></div>;
}

const styles = {
  pagina: { width: "100%", minWidth: 0, color: "#111827" },
  cabecera: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 18 },
  titulo: { margin: 0, fontSize: 26 },
  descripcion: { margin: "5px 0 0", color: "#6b7280" },
  resumen: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 },
  resumenCaja: { padding: 14, border: "1px solid #e5e7eb", borderRadius: 12, background: "#f9fafb" },
  resumenTitulo: { display: "block", color: "#6b7280", fontSize: 13, marginBottom: 5 },
  resumenValor: { fontSize: 24 },
  herramientas: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 },
  inputBusqueda: { flex: 1, minWidth: 220, border: "1px solid #d1d5db", borderRadius: 10, padding: "11px 13px", fontSize: 14 },
  botonPrincipal: { border: 0, borderRadius: 10, background: "#2563eb", color: "white", padding: "11px 15px", fontWeight: 800, cursor: "pointer" },
  botonSecundario: { border: "1px solid #d1d5db", borderRadius: 10, background: "white", color: "#374151", padding: "10px 14px", fontWeight: 700, cursor: "pointer" },
  aviso: { padding: 12, borderRadius: 10, marginBottom: 14, fontWeight: 700 },
  error: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
  exito: { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" },
  tablaCaja: { border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" },
  tablaScroll: { overflowX: "auto" },
  tabla: { width: "100%", minWidth: 760, borderCollapse: "collapse" },
  th: { padding: "12px 14px", textAlign: "left", background: "#f9fafb", color: "#6b7280", fontSize: 12, borderBottom: "1px solid #e5e7eb" },
  td: { padding: "13px 14px", borderBottom: "1px solid #eef2f7", fontSize: 14 },
  vacio: { padding: 36, textAlign: "center", color: "#6b7280" },
  acciones: { display: "flex", justifyContent: "flex-end", gap: 7, flexWrap: "wrap" },
  botonAccion: { border: "1px solid #d1d5db", borderRadius: 8, background: "white", padding: "7px 9px", cursor: "pointer" },
  botonEliminar: { border: "1px solid #fecaca", borderRadius: 8, background: "#fff1f2", color: "#b91c1c", padding: "7px 9px", cursor: "pointer" },
  botonEliminarFuerte: { border: 0, borderRadius: 10, background: "#dc2626", color: "white", padding: "11px 15px", fontWeight: 800, cursor: "pointer" },
  botonLink: { border: 0, background: "transparent", color: "#2563eb", fontWeight: 800, cursor: "pointer" },
  estado: { display: "inline-block", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 800 },
  activo: { background: "#dcfce7", color: "#166534" },
  inactivo: { background: "#f3f4f6", color: "#4b5563" },
  fondoModal: { position: "fixed", inset: 0, zIndex: 5000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(15,23,42,.58)" },
  modal: { width: "100%", maxWidth: 520, background: "white", borderRadius: 16, padding: 22, boxShadow: "0 25px 70px rgba(0,0,0,.3)" },
  modalTitulo: { margin: "0 0 18px", fontSize: 22 },
  campo: { display: "block", marginBottom: 15 },
  label: { display: "block", marginBottom: 6, fontWeight: 800 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 10, padding: "11px 12px", fontSize: 15 },
  errorCampo: { display: "block", marginTop: 5, color: "#b91c1c", fontSize: 12, fontWeight: 700 },
  info: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 10, padding: 10 },
  modalAcciones: { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 20 },
};
