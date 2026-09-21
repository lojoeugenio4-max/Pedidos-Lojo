import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import SorteoGrid from "../components/sorteo/SorteoGrid";
import { construirUrlWhatsApp, formatearTelefonoWhatsApp } from "../utils/whatsappClientes";
import { formatearFechaSorteo } from "../utils/sorteoDirecto";

const REFRESCO_ADMIN_MS = 10000;

function dosDigitos(numero) {
  return String(numero).padStart(2, "0");
}

// ISO -> valor de <input type="datetime-local"> en hora local del navegador.
function aInputLocal(iso) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (!Number.isFinite(fecha.getTime())) return "";
  const dos = (n) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

// Cuándo se sorteó la cuadrícula: el instante en que arrancó el sorteo en
// directo o, en las anteriores a ese sistema, cuando se resolvió (resuelta_at).
function textoSorteado(edicion) {
  const cuando = edicion.sorteo_inicio_at || edicion.resuelta_at;
  return cuando ? `Sorteado el ${formatearFechaSorteo(Date.parse(cuando))}` : "";
}

function etiquetaEstado(edicion) {
  if (edicion.estado === "resuelta") return textoSorteado(edicion) || "Resuelta";
  if (edicion.sorteo_inicio_at) return "🎰 Sorteando en directo…";
  if (edicion.sorteo_programado_at) {
    return `📅 Sorteo el ${formatearFechaSorteo(Date.parse(edicion.sorteo_programado_at))}`;
  }
  if (edicion.estado === "llena") return "Llena · falta programar el sorteo";
  return "Abierta";
}

function mensajeGanador({ edicionNombre, numero, numeroPremiado, premioTexto }) {
  const premioLinea = premioTexto ? `\n\n🎁 Premio: *${premioTexto}*` : "";
  return (
    `🎉 *¡ENHORABUENA!* 🎉\n\n` +
    `Tu número *${dosDigitos(numero)}* de *${edicionNombre}* ha sido el número premiado en el sorteo en directo (*${dosDigitos(numeroPremiado)}*).${premioLinea}\n\n` +
    `Pásate por tienda para recoger tu premio. ¡Gracias por participar! 🎁`
  );
}

function mensajeAvisoSorteo({ nombre, edicionNombre, fechaMs, numeros, enlace }) {
  const linea = numeros.map(dosDigitos).join(" · ");
  const enlaceLinea = enlace ? `\n\n🔗 Tu enlace: ${enlace}` : "";
  return (
    `🎟️ *${edicionNombre}* · Cash Lojo\n\n` +
    `Hola${nombre ? ` ${nombre}` : ""}, el sorteo será el *${formatearFechaSorteo(fechaMs)}*.\n` +
    `Tus números: *${linea}*.\n\n` +
    `Se hace en directo: abre tu app de Cash Lojo a esa hora y lo verás en tu móvil. ¡Suerte! 🍀${enlaceLinea}`
  );
}

export default function SorteoEditions() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [promocionId, setPromocionId] = useState(null);
  const [ediciones, setEdiciones] = useState([]);
  const [conteos, setConteos] = useState({});
  const [ganadoresPorEdicion, setGanadoresPorEdicion] = useState({});
  const [edicionAbierta, setEdicionAbierta] = useState(null);
  const [cuadricula, setCuadricula] = useState(null);
  const [fechaInput, setFechaInput] = useState("");
  const [premioTextoInput, setPremioTextoInput] = useState("");
  const [programando, setProgramando] = useState(false);
  const [sorteandoAhora, setSorteandoAhora] = useState(false);
  const [guardandoPremioTexto, setGuardandoPremioTexto] = useState(false);
  const [preparandoMensajes, setPreparandoMensajes] = useState(false);
  const [creandoCuadricula, setCreandoCuadricula] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  // { titulo, ayuda, mensajes: [{nombre, detalle, telefono, texto, enviado, ganador}] }
  const [cola, setCola] = useState(null);

  useEffect(() => {
    cargarEdiciones();
    // El estado de los sorteos cambia solo (llega la hora, se sortea, se
    // resuelve): se refresca sin parpadeos para que el Admin lo vea al vuelo.
    const intervalo = window.setInterval(() => cargarEdiciones(true), REFRESCO_ADMIN_MS);
    return () => window.clearInterval(intervalo);
  }, []);

  // Cuando una cuadrícula abierta en pantalla pasa a "resuelta", se vuelve a
  // pedir para que se marque la casilla ganadora.
  useEffect(() => {
    if (edicionAbierta?.estado === "resuelta") recargarCuadricula(edicionAbierta.id);
  }, [edicionAbierta?.estado]);

  // Mientras hay una cuadrícula abierta en pantalla, se vuelve a pedir cada
  // pocos segundos para que aparezcan los números que se van asignando en
  // caja (antes solo se cargaba al pulsar «Ver cuadrícula»).
  useEffect(() => {
    if (!edicionAbierta?.id) return undefined;
    const id = edicionAbierta.id;
    const intervalo = window.setInterval(() => recargarCuadricula(id), REFRESCO_ADMIN_MS);
    return () => window.clearInterval(intervalo);
  }, [edicionAbierta?.id]);

  async function cargarEdiciones(silencioso = false) {
    if (!silencioso) {
      setCargando(true);
      setError("");
    }

    const { data: promo, error: promoError } = await supabase
      .from("promociones_sorteo")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (promoError) {
      if (!silencioso) {
        setError("No se ha podido cargar el Sorteo.");
        setCargando(false);
      }
      return;
    }
    setPromocionId(promo?.id || null);
    if (!promo?.id) {
      setEdiciones([]);
      setCargando(false);
      return;
    }

    const { data: eds, error: edsError } = await supabase
      .from("sorteo_editions")
      .select("*")
      .eq("promocion_id", promo.id)
      .order("numero", { ascending: false });

    if (edsError) {
      if (!silencioso) {
        setError("No se han podido cargar las cuadrículas.");
        setCargando(false);
      }
      return;
    }

    setEdiciones(eds || []);
    // Si hay una cuadrícula abierta en pantalla, se actualizan sus datos
    // (estado, fecha...) sin tocar lo que se esté escribiendo en los campos.
    setEdicionAbierta((actual) => (actual ? (eds || []).find((e) => e.id === actual.id) || actual : actual));

    if ((eds || []).length > 0) {
      const { data: numeros } = await supabase
        .from("sorteo_numeros")
        .select("edition_id, numero, cliente_nombre")
        .in("edition_id", eds.map((e) => e.id));

      const mapaConteos = {};
      const mapaGanadores = {};
      (numeros || []).forEach((n) => {
        mapaConteos[n.edition_id] = (mapaConteos[n.edition_id] || 0) + 1;
      });
      eds.forEach((ed) => {
        if (ed.numero_premiado == null) return;
        const fila = (numeros || []).find((n) => n.edition_id === ed.id && n.numero === ed.numero_premiado);
        if (fila) mapaGanadores[ed.id] = fila.cliente_nombre;
      });
      setConteos(mapaConteos);
      setGanadoresPorEdicion(mapaGanadores);
    }

    setCargando(false);
  }

  async function recargarCuadricula(edicionId) {
    const { data, error: cuadriculaError } = await supabase.rpc("obtener_cuadricula_sorteo", {
      p_edition_id: edicionId,
    });
    if (cuadriculaError) {
      console.error(cuadriculaError);
      return;
    }
    setCuadricula(data);
  }

  async function verCuadricula(edicion) {
    if (edicionAbierta?.id === edicion.id) {
      // Ya estaba abierta esta misma: actúa como "ocultar".
      setEdicionAbierta(null);
      setCuadricula(null);
      setCola(null);
      return;
    }

    setEdicionAbierta(edicion);
    setCuadricula(null);
    setCola(null);
    setFechaInput(aInputLocal(edicion.sorteo_programado_at));
    setPremioTextoInput(edicion.premio_texto || "");
    await recargarCuadricula(edicion.id);
  }

  async function crearCuadriculaNueva() {
    if (!promocionId) return;
    if (!window.confirm("Se cerrará la cuadrícula activa (aunque no esté llena) y se abrirá una nueva. ¿Continuar?")) {
      return;
    }
    setCreandoCuadricula(true);
    try {
      const { error: rpcError } = await supabase.rpc("forzar_nueva_cuadricula_sorteo");
      if (rpcError) throw rpcError;
      await cargarEdiciones();
    } catch (err) {
      console.error(err);
      alert(err?.message || "No se ha podido abrir una cuadrícula nueva.");
    } finally {
      setCreandoCuadricula(false);
    }
  }

  async function eliminarEdicion(edicion) {
    if (
      !window.confirm(
        `Esto borra para siempre "Sorteo ${edicion.numero}" y todos sus números. Úsalo solo para liberar espacio con cuadrículas antiguas ya resueltas. ¿Seguro?`
      )
    ) {
      return;
    }
    setEliminandoId(edicion.id);
    try {
      const { error: deleteError } = await supabase.from("sorteo_editions").delete().eq("id", edicion.id);
      if (deleteError) throw deleteError;
      if (edicionAbierta?.id === edicion.id) {
        setEdicionAbierta(null);
        setCuadricula(null);
      }
      await cargarEdiciones();
    } catch (err) {
      console.error(err);
      alert(err?.message || "No se ha podido eliminar la cuadrícula.");
    } finally {
      setEliminandoId(null);
    }
  }

  // Guarda fecha/hora y premio. Solo si el sorteo todavía no ha arrancado.
  async function guardarProgramacion({ fechaIso, avisoOk }) {
    const { data, error: updateError } = await supabase
      .from("sorteo_editions")
      .update({ sorteo_programado_at: fechaIso, premio_texto: premioTextoInput.trim() || null })
      .eq("id", edicionAbierta.id)
      .is("sorteo_inicio_at", null)
      .select();
    if (updateError) throw updateError;
    if (!data || data.length === 0) {
      throw new Error("Este sorteo ya ha arrancado o la cuadrícula ya no existe: no se puede cambiar la fecha.");
    }
    setEdicionAbierta((actual) => (actual ? { ...actual, ...data[0] } : actual));
    await cargarEdiciones(true);
    if (avisoOk) avisoOk();
  }

  async function programarSorteo() {
    if (!edicionAbierta) return;
    if (!fechaInput) {
      alert("Elige la fecha y la hora del sorteo.");
      return;
    }
    const fecha = new Date(fechaInput);
    if (!Number.isFinite(fecha.getTime()) || fecha.getTime() <= Date.now()) {
      alert("La fecha y la hora del sorteo tienen que ser futuras. Para sortear ahora mismo usa «Sortear ahora».");
      return;
    }
    setProgramando(true);
    try {
      await guardarProgramacion({ fechaIso: fecha.toISOString() });
    } catch (err) {
      console.error(err);
      alert(err?.message || "No se ha podido programar el sorteo.");
    } finally {
      setProgramando(false);
    }
  }

  async function quitarProgramacion() {
    if (!edicionAbierta) return;
    if (!window.confirm("Se quitará la fecha del sorteo. Los clientes dejarán de ver el aviso. ¿Continuar?")) return;
    setProgramando(true);
    try {
      await guardarProgramacion({ fechaIso: null, avisoOk: () => setFechaInput("") });
    } catch (err) {
      console.error(err);
      alert(err?.message || "No se ha podido quitar la fecha.");
    } finally {
      setProgramando(false);
    }
  }

  async function sortearAhora() {
    if (!edicionAbierta) return;
    if (
      !window.confirm(
        `Se sorteará "Sorteo ${edicionAbierta.numero}" AHORA MISMO: saldrá en la pantalla grande (tiene que estar abierta) y en el móvil de los participantes que tengan la app abierta. El número se elige al azar y no se puede repetir. ¿Empezar?`
      )
    ) {
      return;
    }
    setSorteandoAhora(true);
    try {
      const { error: premioError } = await supabase
        .from("sorteo_editions")
        .update({ premio_texto: premioTextoInput.trim() || null })
        .eq("id", edicionAbierta.id)
        .is("sorteo_inicio_at", null);
      if (premioError) throw premioError;

      const { data, error: rpcError } = await supabase.rpc("iniciar_sorteo_edition", {
        p_edition_id: String(edicionAbierta.id),
        p_forzar: true,
      });
      if (rpcError) throw rpcError;
      if (!data?.ok) {
        throw new Error(
          data?.motivo === "sin_numeros"
            ? "Esta cuadrícula todavía no tiene ningún número repartido: no hay a quién sortear."
            : "No se ha podido arrancar el sorteo."
        );
      }
      await cargarEdiciones(true);
    } catch (err) {
      console.error(err);
      alert(err?.message || "No se ha podido arrancar el sorteo.");
    } finally {
      setSorteandoAhora(false);
    }
  }

  async function guardarPremioTexto() {
    if (!edicionAbierta) return;
    setGuardandoPremioTexto(true);
    try {
      const { error: updateError } = await supabase
        .from("sorteo_editions")
        .update({ premio_texto: premioTextoInput.trim() || null })
        .eq("id", edicionAbierta.id);
      if (updateError) throw updateError;
      setEdicionAbierta((actual) => (actual ? { ...actual, premio_texto: premioTextoInput.trim() || null } : actual));
      await cargarEdiciones(true);
    } catch (err) {
      console.error(err);
      alert(err?.message || "No se ha podido guardar el premio.");
    } finally {
      setGuardandoPremioTexto(false);
    }
  }

  // Filas de sorteo_numeros de la cuadrícula + teléfono/enlace de cada cliente.
  async function cargarParticipantes(edicionId, soloNumero = null) {
    let consulta = supabase.from("sorteo_numeros").select("*").eq("edition_id", edicionId);
    if (soloNumero != null) consulta = consulta.eq("numero", soloNumero);
    const { data: filas, error: filasError } = await consulta;
    if (filasError) throw filasError;

    const porToken = new Map();
    (filas || []).forEach((fila) => {
      const token = fila.cliente_token;
      if (!token) return;
      const actual = porToken.get(token) || { token, nombre: fila.cliente_nombre || "", numeros: [] };
      actual.numeros.push(Number(fila.numero));
      porToken.set(token, actual);
    });

    const tokens = [...porToken.keys()];
    let clientesPorToken = {};
    if (tokens.length > 0) {
      const { data: clientesData } = await supabase
        .from("clientes")
        .select("token,telefono,enlace_personal")
        .in("token", tokens);
      clientesPorToken = Object.fromEntries((clientesData || []).map((c) => [c.token, c]));
    }

    return [...porToken.values()].map((p) => ({
      ...p,
      numeros: p.numeros.sort((a, b) => a - b),
      telefono: clientesPorToken[p.token]?.telefono || "",
      enlace: clientesPorToken[p.token]?.enlace_personal || `${window.location.origin}/cliente/${p.token}`,
    }));
  }

  // Aviso por WhatsApp a todos los participantes de la cuadrícula. Se suma al
  // aviso que ya ven dentro de la app: no todos abrirán la app antes.
  async function prepararAvisoParticipantes() {
    if (!edicionAbierta?.sorteo_programado_at) return;
    setPreparandoMensajes(true);
    try {
      const participantes = await cargarParticipantes(edicionAbierta.id);
      const fechaMs = Date.parse(edicionAbierta.sorteo_programado_at);
      setCola({
        titulo: `Aviso del sorteo · ${`Sorteo ${edicionAbierta.numero}`}`,
        ayuda: 'Pulsa "WhatsApp" en cada cliente para abrir el aviso ya escrito y enviarlo.',
        mensajes: participantes.map((p) => ({
          nombre: p.nombre || "Cliente",
          detalle: `Números ${p.numeros.map(dosDigitos).join(", ")}`,
          telefono: p.telefono,
          texto: mensajeAvisoSorteo({
            nombre: p.nombre,
            edicionNombre: `Sorteo ${edicionAbierta.numero}`,
            fechaMs,
            numeros: p.numeros,
            enlace: p.enlace,
          }),
          enviado: false,
          ganador: false,
        })),
      });
    } catch (err) {
      console.error(err);
      alert(err?.message || "No se han podido preparar los avisos.");
    } finally {
      setPreparandoMensajes(false);
    }
  }

  async function prepararMensajeGanador() {
    if (!edicionAbierta || edicionAbierta.numero_premiado == null) return;
    setPreparandoMensajes(true);
    try {
      const ganadores = await cargarParticipantes(edicionAbierta.id, edicionAbierta.numero_premiado);
      setCola({
        titulo: `Ganador de Sorteo ${edicionAbierta.numero}`,
        ayuda: 'Pulsa "WhatsApp" para abrir el mensaje de felicitación ya escrito y enviarlo.',
        mensajes: ganadores.map((p) => ({
          nombre: p.nombre || "Cliente",
          detalle: `Número ${dosDigitos(edicionAbierta.numero_premiado)}`,
          telefono: p.telefono,
          texto: mensajeGanador({
            edicionNombre: `Sorteo ${edicionAbierta.numero}`,
            numero: edicionAbierta.numero_premiado,
            numeroPremiado: edicionAbierta.numero_premiado,
            premioTexto: edicionAbierta.premio_texto,
          }),
          enviado: false,
          ganador: true,
        })),
      });
    } catch (err) {
      console.error(err);
      alert(err?.message || "No se ha podido preparar el mensaje del ganador.");
    } finally {
      setPreparandoMensajes(false);
    }
  }

  function marcarEnviado(index) {
    setCola((actual) => {
      if (!actual) return actual;
      const mensajes = [...actual.mensajes];
      mensajes[index] = { ...mensajes[index], enviado: true };
      return { ...actual, mensajes };
    });
  }

  if (cargando) return <p style={texto}>Cargando cuadrículas del Sorteo...</p>;
  if (error) return <div style={avisoError}>{error}</div>;

  const enMarcha = Boolean(edicionAbierta?.sorteo_inicio_at) && edicionAbierta?.estado !== "resuelta";
  const puedeProgramar = edicionAbierta && edicionAbierta.estado !== "resuelta" && !edicionAbierta.sorteo_inicio_at;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h4 style={titulo}>Cuadrículas</h4>
        {promocionId && (
          <button type="button" style={botonSecundario} onClick={crearCuadriculaNueva} disabled={creandoCuadricula}>
            {creandoCuadricula ? "Abriendo..." : "+ Empezar cuadrícula nueva"}
          </button>
        )}
      </div>
      <p style={texto}>
        Una cuadrícula se cierra sola al llenar las 100 casillas o cuando se sortea. Tú solo eliges la fecha y la
        hora del sorteo de cada cuadrícula (pulsa «Ver cuadrícula»): a esa hora el sistema elige el número al azar
        y se ve en directo en la pantalla grande y en el móvil de los participantes. Si a un cliente le quedan
        números por asignar cuando eso pasa, se le asignan automáticamente en la cuadrícula siguiente la próxima
        vez que pase el QR.
      </p>

      {ediciones.length === 0 && <p style={texto}>Todavía no se ha asignado ningún número. Se crea la primera cuadrícula automáticamente en cuanto un pedido cumpla las condiciones.</p>}

      <div style={{ display: "grid", gap: 10 }}>
        {ediciones.map((ed) => (
          <div key={ed.id} style={filaEdicion}>
            <div>
              <strong>Sorteo {ed.numero}</strong>
              <div style={texto}>
                {etiquetaEstado(ed)} · {conteos[ed.id] || 0}/100 números
                {ed.numero_premiado != null ? ` · Premiado: ${dosDigitos(ed.numero_premiado)}` : ""}
                {ganadoresPorEdicion[ed.id] ? ` (${ganadoresPorEdicion[ed.id]})` : ""}
              </div>
              {ed.premio_texto && <div style={{ ...texto, fontWeight: 700, color: "#166534" }}>🎁 {ed.premio_texto}</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={botonSecundario} onClick={() => verCuadricula(ed)}>
                {edicionAbierta?.id === ed.id ? "Ocultar cuadrícula" : "Ver cuadrícula"}
              </button>
              {ed.estado === "resuelta" && (
                <button
                  type="button"
                  style={botonPeligro}
                  onClick={() => eliminarEdicion(ed)}
                  disabled={eliminandoId === ed.id}
                >
                  {eliminandoId === ed.id ? "Borrando..." : "Eliminar"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {edicionAbierta && cuadricula && (
        <div style={panelDetalle}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => verCuadricula(edicionAbierta)}
              style={botonCerrarPanel}
              aria-label="Ocultar cuadrícula"
            >
              Ocultar ✕
            </button>
          </div>
          <SorteoGrid
            titulo={`Sorteo ${edicionAbierta.numero}`}
            subtitulo={
              edicionAbierta.estado === "resuelta"
                ? `🏁 ${textoSorteado(edicionAbierta) || "Sorteo resuelto"}`
                : edicionAbierta.sorteo_programado_at
                  ? `📅 Sorteo el ${formatearFechaSorteo(Date.parse(edicionAbierta.sorteo_programado_at))}`
                  : ""
            }
            casillas={cuadricula.casillas}
            numeroPremiado={cuadricula.numero_premiado}
            compacto
          />

          {puedeProgramar && (
            <div style={resolverBox}>
              <label style={campo}>
                <span>Fecha y hora del sorteo</span>
                <input
                  style={{ ...input, width: 230 }}
                  type="datetime-local"
                  value={fechaInput}
                  onChange={(e) => setFechaInput(e.target.value)}
                />
              </label>
              <label style={{ ...campo, flex: 1, minWidth: 220 }}>
                <span>Qué se gana (se le mostrará al cliente ganador)</span>
                <input
                  style={{ ...input, width: "100%" }}
                  type="text"
                  placeholder="Ej: Cesta de Navidad, 50€ en productos..."
                  value={premioTextoInput}
                  onChange={(e) => setPremioTextoInput(e.target.value)}
                />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={boton} onClick={programarSorteo} disabled={programando}>
                  {programando ? "Guardando..." : edicionAbierta.sorteo_programado_at ? "Cambiar fecha" : "📅 Programar sorteo"}
                </button>
                {edicionAbierta.sorteo_programado_at && (
                  <button type="button" style={botonSecundario} onClick={quitarProgramacion} disabled={programando}>
                    Quitar fecha
                  </button>
                )}
                <button type="button" style={botonSorteo} onClick={sortearAhora} disabled={sorteandoAhora}>
                  {sorteandoAhora ? "Arrancando..." : "🎲 Sortear ahora"}
                </button>
              </div>
              <p style={{ ...texto, flexBasis: "100%" }}>
                {edicionAbierta.sorteo_programado_at
                  ? `Sorteo programado: ${formatearFechaSorteo(Date.parse(edicionAbierta.sorteo_programado_at))}. Los clientes con números aquí ven el aviso en su app. `
                  : "Todavía sin fecha: los clientes no ven ningún aviso. "}
                A esa hora tiene que haber una pantalla grande abierta (o algún participante con la app abierta) para que
                arranque; si no, arranca en cuanto se abra. El número se elige al azar entre los ya repartidos.
              </p>
              {edicionAbierta.sorteo_programado_at && (
                <div style={{ flexBasis: "100%" }}>
                  <button type="button" style={botonSecundario} onClick={prepararAvisoParticipantes} disabled={preparandoMensajes}>
                    {preparandoMensajes ? "Preparando..." : "📲 Avisar por WhatsApp a los participantes"}
                  </button>
                </div>
              )}
            </div>
          )}

          {enMarcha && (
            <div style={resolverBox}>
              <p style={{ ...texto, flexBasis: "100%", color: "#166534", fontWeight: 700 }}>
                🎰 El sorteo está en marcha: se está mostrando en la pantalla grande y en los móviles. En unos segundos
                se guarda el ganador en la cuadrícula y se avisa al cliente.
              </p>
              <label style={{ ...campo, flex: 1 }}>
                <span>Qué se gana (se le mostrará al cliente ganador)</span>
                <input
                  style={{ ...input, width: "100%" }}
                  type="text"
                  placeholder="Ej: Cesta de Navidad, 50€ en productos..."
                  value={premioTextoInput}
                  onChange={(e) => setPremioTextoInput(e.target.value)}
                />
              </label>
              <button type="button" style={boton} onClick={guardarPremioTexto} disabled={guardandoPremioTexto}>
                {guardandoPremioTexto ? "Guardando..." : "Guardar premio"}
              </button>
            </div>
          )}

          {edicionAbierta.estado === "resuelta" && (
            <div style={resolverBox}>
              <label style={{ ...campo, flex: 1 }}>
                <span>Qué ha ganado (se le mostrará al cliente ganador)</span>
                <input
                  style={{ ...input, width: "100%" }}
                  type="text"
                  placeholder="Ej: Cesta de Navidad, 50€ en productos..."
                  value={premioTextoInput}
                  onChange={(e) => setPremioTextoInput(e.target.value)}
                />
              </label>
              <button type="button" style={boton} onClick={guardarPremioTexto} disabled={guardandoPremioTexto}>
                {guardandoPremioTexto ? "Guardando..." : "Guardar premio"}
              </button>
              <button type="button" style={botonSecundario} onClick={prepararMensajeGanador} disabled={preparandoMensajes}>
                {preparandoMensajes ? "Preparando..." : "📲 WhatsApp al ganador"}
              </button>
            </div>
          )}
        </div>
      )}

      {cola && (
        <div style={colaBox}>
          <h4 style={titulo}>{cola.titulo}</h4>
          <p style={texto}>{cola.ayuda}</p>
          {cola.mensajes.length === 0 && <p style={texto}>No hay participantes con número en esta cuadrícula.</p>}
          <div style={{ display: "grid", gap: 8 }}>
            {cola.mensajes.map((m, i) => {
              const url = construirUrlWhatsApp({ telefono: m.telefono, texto: m.texto });
              const tieneWhatsApp = Boolean(formatearTelefonoWhatsApp(m.telefono));
              return (
                <div key={i} style={m.ganador ? filaGanador : filaParticipante}>
                  <div>
                    <strong>{m.nombre}</strong> {m.ganador && <span style={badgeGanador}>GANADOR</span>}
                    <div style={texto}>{m.detalle} {!tieneWhatsApp && "· sin teléfono válido"}</div>
                  </div>
                  {tieneWhatsApp ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...botonSecundario, ...(m.enviado ? botonEnviado : null) }}
                      onClick={() => marcarEnviado(i)}
                    >
                      {m.enviado ? "Enviado ✓" : "WhatsApp"}
                    </a>
                  ) : (
                    <span style={texto}>—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const texto = { margin: 0, color: "#6b7280", fontSize: 13 };
const titulo = { margin: 0, fontSize: 17, color: "#111827" };
const filaEdicion = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" };
const botonSecundario = { border: "1px solid #d1d5db", borderRadius: 9, padding: "8px 14px", background: "#fff", color: "#111827", fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "none" };
const botonPeligro = { border: "1px solid #fecaca", borderRadius: 9, padding: "8px 14px", background: "#fef2f2", color: "#991b1b", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const botonCerrarPanel = { border: "1px solid rgba(255,255,255,.3)", borderRadius: 999, padding: "5px 12px", background: "rgba(255,255,255,.08)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" };
const botonEnviado = { background: "#dcfce7", borderColor: "#16a34a", color: "#166534" };
const panelDetalle = { display: "grid", gap: 14, padding: 16, borderRadius: 14, border: "1px solid #e5e7eb", background: "#0b1220" };
const resolverBox = { display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", background: "#fff", padding: 14, borderRadius: 12 };
const campo = { display: "grid", gap: 6, fontSize: 14, color: "#374151", fontWeight: 600 };
const input = { padding: "9px 11px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 14, width: 140 };
const boton = { border: 0, borderRadius: 10, padding: "11px 18px", background: "#059669", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" };
const colaBox = { display: "grid", gap: 10, padding: 16, borderRadius: 14, border: "1px solid #e5e7eb", background: "#fff" };
const filaGanador = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "#fef9c3", border: "1px solid #eab308" };
const badgeGanador = { marginLeft: 8, padding: "2px 8px", borderRadius: 999, background: "#16a34a", color: "#fff", fontSize: 11, fontWeight: 800 };
const avisoError = { padding: "9px 12px", borderRadius: 9, background: "#fef2f2", color: "#991b1b", fontSize: 13, fontWeight: 700 };
const botonSorteo = { border: 0, borderRadius: 10, padding: "11px 18px", background: "#ff1e1e", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" };
const filaParticipante = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb" };
