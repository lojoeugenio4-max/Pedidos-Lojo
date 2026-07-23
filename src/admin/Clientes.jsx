import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  construirMensajeClienteWhatsApp,
  construirUrlWhatsApp,
  formatearTelefonoWhatsApp,
} from "../utils/whatsappClientes";

const ACTIVO = "activo";
const INACTIVO = "inactivo";
const FORMULARIO_VACIO = { nombre: "", telefono: "", estado: ACTIVO };
const PLANTILLA_WHATSAPP_KEY = "lojo_admin_plantilla_whatsapp_clientes";
const PLANTILLA_WHATSAPP_ANTERIOR = `Hola 👋

Ya tienes tu enlace personal para hacer tus pedidos en Cash Lojo:
{enlace}

Guárdalo, es siempre el mismo enlace y es solo tuyo.`;
const PLANTILLA_WHATSAPP_ANTERIOR_V2 = `Hola 👋

Hemos añadido las siguientes mejoras:
✅ Puedes crear tu lista de artículos favoritos
✅ Puedes participar en nuestro Bingo mensual con regalos espectaculares !!

Ya tienes tu enlace personal para hacer tus pedidos en Cash Lojo:
{enlace}

Guárdalo, es siempre el mismo enlace y es solo tuyo.`;
const PLANTILLA_WHATSAPP_ANTERIOR_V3 = `¡Hola! 👋

*Novedades en Cash Lojo* 🎉
✅ Ya puedes crear tu lista de *artículos favoritos*
🎱 Participa en nuestro *Bingo mensual* ¡con regalos espectaculares!

🔗 *Tu enlace personal para hacer pedidos:*
{enlace}
_(es siempre el mismo, guárdalo)_

📲 *Truco: añádelo a la pantalla de inicio y úsalo como una app*

🍎 *iPhone (Safari)*
1️⃣ Abre el enlace de arriba
2️⃣ Toca el icono compartir ⬆️
3️⃣ Elige "Añadir a pantalla de inicio"

🤖 *Android (Chrome)*
1️⃣ Abre el enlace de arriba
2️⃣ Toca los tres puntos ⋮
3️⃣ Elige "Añadir a pantalla de inicio"

¡Gracias por confiar en nosotros! 🙌`;
const PLANTILLA_WHATSAPP_POR_DEFECTO = `¡Hola! 👋

*Novedades en Cash Lojo* 🎉
✅ Ya puedes crear tu lista de *artículos favoritos*
🎱 Participa en nuestro *Bingo mensual* ¡con regalos espectaculares!

🔗 *Tu enlace personal para hacer pedidos:*
{enlace}
_(es siempre el mismo, guárdalo)_

📲 Sigue las instrucciones para añadirlo a tu pantalla de inicio _(vienen dentro al abrir el enlace)_

¡Gracias por confiar en nosotros! 🙌`;

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
  const [seleccionados, setSeleccionados] = useState(() => new Set());
  const [plantillaAbierta, setPlantillaAbierta] = useState(false);
  const [plantillaWhatsApp, setPlantillaWhatsApp] = useState(() => {
    try {
      const guardada = localStorage.getItem(PLANTILLA_WHATSAPP_KEY);
      if (!guardada) return PLANTILLA_WHATSAPP_POR_DEFECTO;
      // Si lo guardado es alguna de las plantillas automáticas anteriores
      // (con "Hola {nombre}" o la versión sin nombre pero sin el aviso de
      // mejoras), se actualiza sola a la nueva por defecto; si el negocio
      // la había personalizado con otro texto propio, se respeta tal cual.
      const esPlantillaAntigua =
        guardada.trim().startsWith("Hola {nombre}") ||
        guardada.trim() === PLANTILLA_WHATSAPP_ANTERIOR.trim() ||
        guardada.trim() === PLANTILLA_WHATSAPP_ANTERIOR_V2.trim() ||
        guardada.trim() === PLANTILLA_WHATSAPP_ANTERIOR_V3.trim();
      if (esPlantillaAntigua) {
        return PLANTILLA_WHATSAPP_POR_DEFECTO;
      }
      return guardada;
    } catch {
      return PLANTILLA_WHATSAPP_POR_DEFECTO;
    }
  });
  const [colaWhatsApp, setColaWhatsApp] = useState(null);

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

  function cambiarPlantillaWhatsApp(valor) {
    setPlantillaWhatsApp(valor);
    try {
      localStorage.setItem(PLANTILLA_WHATSAPP_KEY, valor);
    } catch {
      // Si el navegador bloquea localStorage no pasa nada grave, solo no se recuerda la plantilla.
    }
  }

  // Solo se pueden seleccionar/enviar clientes con un teléfono utilizable.
  const seleccionablesFiltrados = useMemo(
    () => clientesFiltrados.filter((cliente) => formatearTelefonoWhatsApp(cliente.telefono)),
    [clientesFiltrados]
  );
  const todosSeleccionados =
    seleccionablesFiltrados.length > 0 &&
    seleccionablesFiltrados.every((cliente) => seleccionados.has(cliente.id));

  function alternarSeleccion(id) {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  function alternarSeleccionTodos() {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual);
      if (todosSeleccionados) {
        seleccionablesFiltrados.forEach((cliente) => nuevo.delete(cliente.id));
      } else {
        seleccionablesFiltrados.forEach((cliente) => nuevo.add(cliente.id));
      }
      return nuevo;
    });
  }

  function enviarWhatsAppIndividual(cliente) {
    const enlace = cliente.enlace_personal || (cliente.token ? crearEnlace(cliente.token) : "");
    const texto = construirMensajeClienteWhatsApp({
      plantilla: plantillaWhatsApp,
      nombre: cliente.nombre,
      enlace,
    });
    const url = construirUrlWhatsApp({ telefono: cliente.telefono, texto });

    if (!url) {
      mostrarAviso("error", `${cliente.nombre} no tiene un teléfono válido para WhatsApp.`);
      return;
    }

    window.open(url, "_blank", "noopener");
  }

  function abrirColaWhatsApp() {
    const cola = clientesFiltrados.filter(
      (cliente) => seleccionados.has(cliente.id) && formatearTelefonoWhatsApp(cliente.telefono)
    );

    if (cola.length === 0) {
      mostrarAviso("error", "Selecciona al menos un cliente con teléfono válido.");
      return;
    }

    setColaWhatsApp(cola);
  }

  function cerrarColaWhatsApp() {
    setColaWhatsApp(null);
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
        <button
          type="button"
          style={styles.botonSecundario}
          onClick={() => setPlantillaAbierta((actual) => !actual)}
        >
          {plantillaAbierta ? "Ocultar mensaje WhatsApp" : "Editar mensaje WhatsApp"}
        </button>
      </div>

      {plantillaAbierta && (
        <div style={styles.plantillaCaja}>
          <label style={styles.label}>Mensaje que se enviará por WhatsApp</label>
          <textarea
            style={styles.textareaPlantilla}
            value={plantillaWhatsApp}
            onChange={(e) => cambiarPlantillaWhatsApp(e.target.value)}
            rows={5}
          />
          <p style={styles.info}>
            Usa <strong>{"{nombre}"}</strong> y <strong>{"{enlace}"}</strong> donde quieras que se
            sustituyan por los datos de cada cliente. Se guarda en este navegador para la próxima vez.
          </p>
        </div>
      )}

      {seleccionados.size > 0 && (
        <div style={styles.barraSeleccion}>
          <span>{seleccionados.size} cliente(s) seleccionado(s)</span>
          <button type="button" style={styles.botonWhatsApp} onClick={abrirColaWhatsApp}>
            Enviar enlace por WhatsApp
          </button>
        </div>
      )}

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
                  <th style={styles.th}>
                    <input
                      type="checkbox"
                      checked={todosSeleccionados}
                      onChange={alternarSeleccionTodos}
                      disabled={seleccionablesFiltrados.length === 0}
                      title="Seleccionar todos los que tienen teléfono válido"
                    />
                  </th>
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

                  const tieneWhatsApp = Boolean(formatearTelefonoWhatsApp(cliente.telefono));

                  return (
                    <tr key={cliente.id}>
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          checked={seleccionados.has(cliente.id)}
                          onChange={() => alternarSeleccion(cliente.id)}
                          disabled={!tieneWhatsApp}
                          title={tieneWhatsApp ? "" : "Sin teléfono válido"}
                        />
                      </td>
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
                          <button
                            type="button"
                            style={styles.botonWhatsAppFila}
                            disabled={procesando || !tieneWhatsApp}
                            title={tieneWhatsApp ? "Enviar enlace por WhatsApp" : "Sin teléfono válido"}
                            onClick={() => enviarWhatsAppIndividual(cliente)}
                          >
                            WhatsApp
                          </button>
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

      {colaWhatsApp && (
        <ColaEnvioWhatsApp
          clientes={colaWhatsApp}
          plantilla={plantillaWhatsApp}
          crearEnlace={crearEnlace}
          cerrar={cerrarColaWhatsApp}
        />
      )}
    </div>
  );
}

function ColaEnvioWhatsApp({ clientes, plantilla, crearEnlace, cerrar }) {
  const [indice, setIndice] = useState(0);
  const [enviados, setEnviados] = useState(() => new Set());

  const actual = clientes[indice];
  const terminado = indice >= clientes.length;

  function enviarActual() {
    if (!actual) return;

    const enlace = actual.enlace_personal || (actual.token ? crearEnlace(actual.token) : "");
    const texto = construirMensajeClienteWhatsApp({ plantilla, nombre: actual.nombre, enlace });
    const url = construirUrlWhatsApp({ telefono: actual.telefono, texto });

    if (url) {
      window.open(url, "_blank", "noopener");
      setEnviados((prev) => new Set(prev).add(actual.id));
    }

    setIndice((i) => i + 1);
  }

  function saltarActual() {
    setIndice((i) => i + 1);
  }

  return (
    <Modal cerrar={cerrar}>
      <h3 style={styles.modalTitulo}>Enviar enlaces por WhatsApp</h3>

      {!terminado ? (
        <>
          <p style={styles.info}>
            Cliente {indice + 1} de {clientes.length}. Al pulsar, se abre WhatsApp en una pestaña
            nueva con el mensaje ya escrito para este cliente — solo falta darle a enviar allí.
          </p>
          <div style={styles.filaColaActual}>
            <strong>{actual.nombre}</strong>
            <span style={{ color: "#6b7280" }}>{actual.telefono}</span>
          </div>
          <div style={styles.modalAcciones}>
            <button type="button" style={styles.botonSecundario} onClick={saltarActual}>
              Saltar
            </button>
            <button type="button" style={styles.botonWhatsApp} onClick={enviarActual}>
              Abrir WhatsApp y pasar al siguiente
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Enviado a {enviados.size} de {clientes.length} clientes.</p>
          <div style={styles.modalAcciones}>
            <button type="button" style={styles.botonPrincipal} onClick={cerrar}>
              Cerrar
            </button>
          </div>
        </>
      )}
    </Modal>
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
  tabla: { width: "100%", minWidth: 800, borderCollapse: "collapse" },
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
  plantillaCaja: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 14, background: "#f9fafb" },
  textareaPlantilla: { width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 10, padding: "11px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical" },
  barraSeleccion: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontWeight: 700, color: "#166534" },
  botonWhatsApp: { border: 0, borderRadius: 10, background: "#22c55e", color: "white", padding: "11px 15px", fontWeight: 800, cursor: "pointer" },
  botonWhatsAppFila: { border: "1px solid #86efac", borderRadius: 8, background: "#f0fdf4", color: "#166534", padding: "7px 9px", cursor: "pointer", fontWeight: 700 },
  filaColaActual: { display: "flex", flexDirection: "column", gap: 4, border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 16 },
};
