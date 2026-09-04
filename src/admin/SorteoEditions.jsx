import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import SorteoGrid from "../components/sorteo/SorteoGrid";
import { construirUrlWhatsApp, formatearTelefonoWhatsApp } from "../utils/whatsappClientes";

const ESTADO_LABEL = { abierta: "Abierta", llena: "Llena · pendiente de resolver", resuelta: "Resuelta" };

function mensajeParticipante({ edicionNombre, numero, numeroPremiado, premioTexto }) {
  const premioLinea = premioTexto ? `\n\n🎁 Premio: *${premioTexto}*` : "";
  return (
    `🎉 *¡ENHORABUENA!* 🎉\n\n` +
    `Tu número *${String(numero).padStart(2, "0")}* de *${edicionNombre}* ha sido el número premiado de la Lotería Nacional (*${String(numeroPremiado).padStart(2, "0")}*).${premioLinea}\n\n` +
    `Pásate por tienda para recoger tu premio. ¡Gracias por participar! 🎁`
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
  const [numeroPremiadoInput, setNumeroPremiadoInput] = useState("");
  const [premioTextoInput, setPremioTextoInput] = useState("");
  const [resolviendo, setResolviendo] = useState(false);
  const [guardandoPremioTexto, setGuardandoPremioTexto] = useState(false);
  const [creandoCuadricula, setCreandoCuadricula] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [cola, setCola] = useState(null); // { edicionNombre, mensajes: [{nombre, telefono, texto, enviado}] }

  useEffect(() => {
    cargarEdiciones();
  }, []);

  async function cargarEdiciones() {
    setCargando(true);
    setError("");

    const { data: promo, error: promoError } = await supabase
      .from("promociones_sorteo")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (promoError) {
      setError("No se ha podido cargar el Sorteo.");
      setCargando(false);
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
      setError("No se han podido cargar las cuadrículas.");
      setCargando(false);
      return;
    }

    setEdiciones(eds || []);

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
    setNumeroPremiadoInput(edicion.numero_premiado != null ? String(edicion.numero_premiado) : "");
    setPremioTextoInput(edicion.premio_texto || "");

    const { data, error: cuadriculaError } = await supabase.rpc("obtener_cuadricula_sorteo", {
      p_edition_id: edicion.id,
    });
    if (cuadriculaError) {
      console.error(cuadriculaError);
      return;
    }
    setCuadricula(data);
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

  async function resolverEdicion() {
    if (!edicionAbierta) return;
    const numero = Number(numeroPremiadoInput);
    if (!Number.isInteger(numero) || numero < 0 || numero > 99) {
      alert("Introduce el número premiado de la Lotería Nacional (00-99).");
      return;
    }

    setResolviendo(true);
    try {
      const { data, error: resolverError } = await supabase.rpc("resolver_sorteo_edition", {
        p_edition_id: edicionAbierta.id,
        p_numero_premiado: numero,
        p_premio_texto: premioTextoInput.trim() || null,
      });
      if (resolverError) throw resolverError;

      const resultado = Array.isArray(data) ? data[0] : data;
      const participantes = resultado?.participantes || [];
      const ganadores = participantes.filter((p) => p.ganador);

      const tokens = [...new Set(ganadores.map((p) => p.cliente_token).filter(Boolean))];
      let telefonosPorToken = {};
      if (tokens.length > 0) {
        const { data: clientesData } = await supabase
          .from("clientes")
          .select("token,telefono")
          .in("token", tokens);
        telefonosPorToken = Object.fromEntries((clientesData || []).map((c) => [c.token, c.telefono]));
      }

      const mensajes = ganadores.map((p) => ({
        nombre: p.cliente_nombre || "Cliente",
        numero: p.numero,
        telefono: telefonosPorToken[p.cliente_token] || "",
        texto: mensajeParticipante({
          edicionNombre: resultado.edition_nombre,
          numero: p.numero,
          numeroPremiado: numero,
          premioTexto: resultado.premio_texto,
        }),
        enviado: false,
      }));

      setCola({ edicionNombre: resultado.edition_nombre, mensajes });
      await cargarEdiciones();
      setEdicionAbierta((actual) =>
        actual ? { ...actual, estado: "resuelta", numero_premiado: numero, premio_texto: premioTextoInput.trim() || null } : actual
      );
    } catch (err) {
      console.error(err);
      alert(err?.message || "No se ha podido resolver la cuadrícula.");
    } finally {
      setResolviendo(false);
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
      await cargarEdiciones();
    } catch (err) {
      console.error(err);
      alert(err?.message || "No se ha podido guardar el premio.");
    } finally {
      setGuardandoPremioTexto(false);
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
        Una cuadrícula se cierra sola al llenar las 100 casillas, o al resolverla con un número premiado. Si a un
        cliente le quedan números por asignar cuando eso pasa, se le asignan automáticamente en la cuadrícula
        siguiente la próxima vez que pase el QR.
      </p>

      {ediciones.length === 0 && <p style={texto}>Todavía no se ha asignado ningún número. Se crea la primera cuadrícula automáticamente en cuanto un pedido cumpla las condiciones.</p>}

      <div style={{ display: "grid", gap: 10 }}>
        {ediciones.map((ed) => (
          <div key={ed.id} style={filaEdicion}>
            <div>
              <strong>Sorteo {ed.numero}</strong>
              <div style={texto}>
                {ESTADO_LABEL[ed.estado] || ed.estado} · {conteos[ed.id] || 0}/100 números
                {ed.numero_premiado != null ? ` · Premiado: ${String(ed.numero_premiado).padStart(2, "0")}` : ""}
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
            casillas={cuadricula.casillas}
            numeroPremiado={cuadricula.numero_premiado}
            compacto
          />

          {edicionAbierta.estado !== "resuelta" && (
            <div style={resolverBox}>
              <label style={campo}>
                <span>Número premiado (Lotería Nacional, 00-99)</span>
                <input
                  style={input}
                  type="number"
                  min={0}
                  max={99}
                  value={numeroPremiadoInput}
                  onChange={(e) => setNumeroPremiadoInput(e.target.value)}
                />
              </label>
              <label style={{ ...campo, flex: 1 }}>
                <span>Qué ha ganado (se le mostrará al cliente)</span>
                <input
                  style={{ ...input, width: "100%" }}
                  type="text"
                  placeholder="Ej: Cesta de Navidad, 50€ en productos..."
                  value={premioTextoInput}
                  onChange={(e) => setPremioTextoInput(e.target.value)}
                />
              </label>
              <button type="button" style={boton} onClick={resolverEdicion} disabled={resolviendo}>
                {resolviendo ? "Resolviendo..." : "Resolver y preparar mensaje"}
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
            </div>
          )}
        </div>
      )}

      {cola && (
        <div style={colaBox}>
          <h4 style={titulo}>Ganador de {cola.edicionNombre}</h4>
          <p style={texto}>Pulsa "WhatsApp" para abrir el mensaje de felicitación ya escrito y enviarlo.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {cola.mensajes.map((m, i) => {
              const url = construirUrlWhatsApp({ telefono: m.telefono, texto: m.texto });
              const tieneWhatsApp = Boolean(formatearTelefonoWhatsApp(m.telefono));
              return (
                <div key={i} style={filaGanador}>
                  <div>
                    <strong>{m.nombre}</strong> <span style={badgeGanador}>GANADOR</span>
                    <div style={texto}>Número {String(m.numero).padStart(2, "0")} {!tieneWhatsApp && "· sin teléfono válido"}</div>
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
