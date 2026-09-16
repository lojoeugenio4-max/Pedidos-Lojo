import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { suscribirseAQrLeidos } from "../utils/qrPendientesEvento";

// Mismo formato de QR que ya usa whatsappPedido.js (construirUrlQr): código
// suelto (sin URL) para que lo lean bien tanto un móvil como un lector físico
// de caja. Tamaño más grande aquí porque este QR se lee directamente de una
// pantalla de ordenador, no de un móvil en la mano.
function construirUrlQr(codigo) {
  if (!codigo) return "";
  const params = new URLSearchParams({
    size: "300",
    margin: "4",
    ecLevel: "M",
    text: codigo,
  });
  return `https://quickchart.io/qr?${params.toString()}`;
}

function normalizarBusqueda(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Lleva a la pantalla real de juego (la misma que usa caja) con ese código
// ya metido en la URL. StorePage, al cargar con "?store=1&code=...", valida
// el código solo y salta directamente a Ruleta/Bingo — igual que si se
// hubiera escrito/escaneado ahí mismo. Así no hay que duplicar nada de esa
// lógica aquí.
function irAPantallaDeJuego(codigo) {
  const limpio = String(codigo || "").trim();
  if (!limpio) return;
  const url = new URL(window.location.href);
  url.search = `?store=1&code=${encodeURIComponent(limpio)}`;
  window.location.href = url.toString();
}

function formatearFechaHora(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-ES");
}

// game_entitlements tiene RLS, así que no se puede suscribir a sus cambios
// en tiempo real por tabla (a diferencia de estadisticas_movimientos en
// PedidosExportar). En su lugar, StorePage avisa por un canal de broadcast
// de Supabase (qrPendientesEvento.js) en el instante en que se lee un QR en
// caja, y esta pestaña quita ese pedido al momento sin esperar a nada.
//
// El refresco periódico se mantiene solo como red de seguridad, por si se
// pierde algún aviso (ej. la pestaña del Admin estuvo sin conexión), con un
// intervalo mucho más largo para no resultar molesto.
const INTERVALO_REFRESCO_RESPALDO_MS = 120000;

export default function QrPendientes() {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [codigoLectura, setCodigoLectura] = useState("");
  const [eliminandoIds, setEliminandoIds] = useState(new Set());
  const [fechaLimiteBorrado, setFechaLimiteBorrado] = useState("");
  const [borrandoAntiguos, setBorrandoAntiguos] = useState(false);
  const montado = useRef(true);
  const inputLecturaRef = useRef(null);
  const temporizadorLecturaRef = useRef(null);

  async function cargar({ mostrarCargando = true } = {}) {
    if (mostrarCargando) setCargando(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_listar_qr_pendientes");
      if (rpcError) throw rpcError;
      if (montado.current) setFilas(data || []);
    } catch (err) {
      if (montado.current) {
        setError(
          err?.message ||
            "No se pudieron cargar los QR pendientes. Comprueba que la función admin_listar_qr_pendientes está creada en Supabase."
        );
      }
    } finally {
      if (montado.current && mostrarCargando) setCargando(false);
    }
  }

  async function eliminarUno(pedido) {
    if (!window.confirm(`¿Eliminar el código de ${pedido.customer_name || "este cliente"}? No se puede deshacer.`)) {
      return;
    }
    setEliminandoIds((prev) => new Set(prev).add(pedido.order_id));
    try {
      const { error: rpcError } = await supabase.rpc("admin_borrar_qr_pendiente", {
        p_order_id: pedido.order_id,
      });
      if (rpcError) throw rpcError;
      setFilas((prev) => prev.filter((fila) => fila.order_id !== pedido.order_id));
    } catch (err) {
      setError(err?.message || "No se pudo eliminar el código.");
    } finally {
      setEliminandoIds((prev) => {
        const nuevo = new Set(prev);
        nuevo.delete(pedido.order_id);
        return nuevo;
      });
    }
  }

  async function eliminarAntiguos() {
    if (!fechaLimiteBorrado) return;
    if (
      !window.confirm(
        `¿Eliminar TODOS los códigos pendientes de antes del ${fechaLimiteBorrado}? No se puede deshacer.`
      )
    ) {
      return;
    }
    setBorrandoAntiguos(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_borrar_qr_pendientes_antiguos", {
        p_antes: new Date(fechaLimiteBorrado).toISOString(),
      });
      if (rpcError) throw rpcError;
      await cargar({ mostrarCargando: false });
      window.alert(`Eliminados ${data ?? 0} código(s).`);
    } catch (err) {
      setError(err?.message || "No se pudieron eliminar los códigos antiguos.");
    } finally {
      setBorrandoAntiguos(false);
    }
  }

  // Antes había que escribir/escanear el código Y ADEMÁS pulsar "Ir al
  // juego". Un escáner físico escribe el código carácter a carácter muy
  // rápido; en cuanto deja de "teclear" durante un instante (180ms) sin que
  // nadie toque nada más, entendemos que el código ya está completo y
  // saltamos solos a la pantalla del juego. Si el escáner sí manda un
  // Enter al terminar, el formulario ya lo captura al instante (ver
  // onKeyDown más abajo), sin ni siquiera esperar esos 180ms.
  const LONGITUD_MINIMA_CODIGO = 6;

  function manejarCambioLectura(valor) {
    setCodigoLectura(valor);
    if (temporizadorLecturaRef.current) clearTimeout(temporizadorLecturaRef.current);
    const limpio = valor.trim();
    if (limpio.length < LONGITUD_MINIMA_CODIGO) return;
    temporizadorLecturaRef.current = setTimeout(() => {
      irAPantallaDeJuego(limpio);
    }, 180);
  }

  function manejarEnterLectura(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (temporizadorLecturaRef.current) clearTimeout(temporizadorLecturaRef.current);
    irAPantallaDeJuego(codigoLectura);
  }

  useEffect(() => {
    montado.current = true;
    cargar();

    // Quita el pedido de la lista al instante (sin esperar respuesta del
    // servidor) en cuanto caja avisa que se ha leído ese QR, y además pide
    // una recarga real un segundo después para que la lista quede
    // exactamente como en la base de datos (por si ese código tenía más de
    // un pedido pendiente, o cualquier otro caso raro).
    const desuscribir = suscribirseAQrLeidos((payload) => {
      const orderId = payload?.orderId ? String(payload.orderId) : null;
      if (orderId && montado.current) {
        setFilas((prev) => prev.filter((fila) => String(fila.order_id) !== orderId));
      }
      setTimeout(() => cargar({ mostrarCargando: false }), 1000);
    });

    const intervalo = setInterval(
      () => cargar({ mostrarCargando: false }),
      INTERVALO_REFRESCO_RESPALDO_MS
    );

    function alCambiarVisibilidad() {
      if (document.visibilityState === "visible") cargar({ mostrarCargando: false });
    }
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      montado.current = false;
      desuscribir();
      clearInterval(intervalo);
      if (temporizadorLecturaRef.current) clearTimeout(temporizadorLecturaRef.current);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Agrupadas por cliente (token, o nombre si no hay token) para poder
  // separar visualmente un cliente de otro con fondos alternos, y para que
  // el buscador filtre por cliente completo (todos sus QR pendientes).
  const grupos = useMemo(() => {
    const mapa = new Map();

    filas.forEach((fila) => {
      const clave = fila.customer_token || `nombre:${fila.customer_name || ""}`;
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          clave,
          nombre: fila.customer_name || "Sin nombre",
          codigoLojo: fila.codigo_lojo || "",
          pedidos: [],
        });
      }
      mapa.get(clave).pedidos.push(fila);
    });

    return Array.from(mapa.values()).sort((a, b) =>
      (a.codigoLojo || a.nombre).localeCompare(b.codigoLojo || b.nombre, "es", { sensitivity: "base" })
    );
  }, [filas]);

  const gruposFiltrados = useMemo(() => {
    const termino = normalizarBusqueda(busqueda);
    if (!termino) return grupos;
    return grupos.filter(
      (grupo) =>
        normalizarBusqueda(grupo.nombre).includes(termino) ||
        normalizarBusqueda(grupo.codigoLojo).includes(termino)
    );
  }, [grupos, busqueda]);

  const totalPedidosPendientes = filas.length;

  return (
    <div style={contenedor}>
      <div style={cabecera}>
        <div>
          <h2 style={titulo}>QR pendientes</h2>
          <p style={subtitulo}>
            Códigos de clientes con Bingo y/o Ruleta aún sin leer en caja. Desaparecen solos al instante
            en cuanto se leen.
          </p>
        </div>
        <button type="button" style={botonSecundario} onClick={() => cargar()} disabled={cargando}>
          {cargando ? "Actualizando…" : "🔄 Actualizar"}
        </button>
      </div>

      <input
        type="text"
        placeholder="Buscar cliente por nombre o código Lojo…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={inputBusqueda}
      />

      <div style={bloqueBorrarAntiguos}>
        <span style={etiquetaLectura}>🗑️ Eliminar todos los pendientes anteriores a:</span>
        <input
          type="date"
          value={fechaLimiteBorrado}
          onChange={(e) => setFechaLimiteBorrado(e.target.value)}
          style={inputLectura}
        />
        <button
          type="button"
          style={botonBorrarAntiguos(!fechaLimiteBorrado || borrandoAntiguos)}
          onClick={eliminarAntiguos}
          disabled={!fechaLimiteBorrado || borrandoAntiguos}
        >
          {borrandoAntiguos ? "Eliminando…" : "Eliminar antiguos"}
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (temporizadorLecturaRef.current) clearTimeout(temporizadorLecturaRef.current);
          irAPantallaDeJuego(codigoLectura);
        }}
        style={bloqueLectura}
      >
        <span style={etiquetaLectura}>📷 Escanea aquí — se abre el juego solo, sin tocar nada más:</span>
        <input
          ref={inputLecturaRef}
          type="text"
          value={codigoLectura}
          onChange={(e) => manejarCambioLectura(e.target.value)}
          onKeyDown={manejarEnterLectura}
          placeholder="Código del QR…"
          autoComplete="off"
          autoFocus
          style={inputLectura}
        />
        <button type="submit" style={botonPrimarioLectura} disabled={!codigoLectura.trim()}>
          Ir al juego →
        </button>
      </form>

      {error && <div style={cajaError}>{error}</div>}

      <p style={contador}>
        {totalPedidosPendientes} QR pendiente{totalPedidosPendientes === 1 ? "" : "s"} · {gruposFiltrados.length}{" "}
        cliente{gruposFiltrados.length === 1 ? "" : "s"}
      </p>

      <div style={tablaEnvoltorio}>
        <table style={tabla}>
          <thead>
            <tr>
              <th style={th}>Fecha Pedido</th>
              <th style={th}>Cod Lojo</th>
              <th style={th}>Nombre</th>
              <th style={th}>🎱 Bolas</th>
              <th style={th}>🎡 Ruleta</th>
              <th style={th}>QR</th>
              <th style={th}>Código QR</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {gruposFiltrados.length === 0 && !cargando && (
              <tr>
                <td style={td} colSpan={8}>
                  {filas.length === 0
                    ? "No hay ningún QR pendiente de leer ahora mismo."
                    : "Ningún cliente coincide con la búsqueda."}
                </td>
              </tr>
            )}
            {gruposFiltrados.map((grupo, indiceGrupo) => {
              const fondo = indiceGrupo % 2 === 0 ? filaGrupoPar : filaGrupoImpar;
              return grupo.pedidos.map((pedido) => (
                <tr key={pedido.order_id} style={fondo}>
                  <td style={td}>{formatearFechaHora(pedido.created_at)}</td>
                  <td style={td}>{grupo.codigoLojo || "—"}</td>
                  <td style={td}>{grupo.nombre}</td>
                  <td style={td}>
                    {pedido.bingo_remaining > 0 ? (
                      <span style={badgeBingo}>{pedido.bingo_remaining}</span>
                    ) : (
                      <span style={celdaVacia}>—</span>
                    )}
                  </td>
                  <td style={td}>
                    {pedido.roulette_remaining > 0 ? (
                      <span style={badgeRuleta}>{pedido.roulette_remaining}</span>
                    ) : (
                      <span style={celdaVacia}>—</span>
                    )}
                  </td>
                  <td style={td}>
                    {pedido.code ? (
                      <img
                        src={construirUrlQr(pedido.code)}
                        alt={`QR ${pedido.code}`}
                        width={110}
                        height={110}
                        style={imagenQr}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{pedido.code || "—"}</td>
                  <td style={td}>
                    <button
                      type="button"
                      style={botonEliminarFila}
                      onClick={() => eliminarUno(pedido)}
                      disabled={eliminandoIds.has(pedido.order_id)}
                      title="Eliminar este código"
                    >
                      {eliminandoIds.has(pedido.order_id) ? "…" : "🗑️"}
                    </button>
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const contenedor = { display: "flex", flexDirection: "column", gap: "14px" };

const cabecera = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" };

const titulo = { margin: 0, fontSize: "20px", color: "#111827" };

const subtitulo = { margin: "4px 0 0", color: "#6b7280", fontSize: "13px" };

const botonSecundario = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#374151",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const inputBusqueda = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  fontSize: "14px",
  maxWidth: "420px",
  width: "100%",
};

const bloqueLectura = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
};

const etiquetaLectura = { fontSize: "13px", fontWeight: 700, color: "#065f46" };

const inputLectura = {
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid #6ee7b7",
  fontSize: "14px",
  minWidth: "220px",
  fontFamily: "monospace",
};

const botonPrimarioLectura = {
  padding: "9px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#059669",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const botonEliminarFila = {
  padding: "4px 8px",
  borderRadius: "6px",
  border: "1px solid #fca5a5",
  background: "#fef2f2",
  color: "#b91c1c",
  fontSize: "13px",
  cursor: "pointer",
};

const bloqueBorrarAntiguos = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#fef2f2",
  border: "1px solid #fca5a5",
};

const botonBorrarAntiguos = (deshabilitado) => ({
  padding: "9px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#b91c1c",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "13px",
  opacity: deshabilitado ? 0.5 : 1,
  cursor: deshabilitado ? "not-allowed" : "pointer",
});

const contador = { margin: 0, color: "#6b7280", fontSize: "13px" };

const cajaError = {
  padding: "10px 14px",
  borderRadius: "10px",
  background: "#fee2e2",
  color: "#991b1b",
  fontSize: "13px",
  fontWeight: 600,
};

const tablaEnvoltorio = {
  overflowX: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
};

const tabla = { width: "100%", borderCollapse: "collapse", fontSize: "13px" };

const th = {
  textAlign: "left",
  padding: "10px 12px",
  background: "#f9fafb",
  color: "#374151",
  fontWeight: 800,
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
};

const td = { padding: "10px 12px", color: "#111827", verticalAlign: "middle" };

// Fondos claros y alternos por CLIENTE (no por fila), para que se distinga a
// simple vista dónde acaban los QR pendientes de un cliente y empiezan los
// del siguiente.
const filaGrupoPar = { background: "#ffffff", borderBottom: "1px solid #f3f4f6" };
const filaGrupoImpar = { background: "#eef2ff", borderBottom: "1px solid #f3f4f6" };

const imagenQr = { display: "block", borderRadius: "6px", background: "#fff" };

const celdaVacia = { color: "#9ca3af" };

const badgeBingo = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: "999px",
  background: "#fef3c7",
  color: "#92400e",
  fontWeight: 800,
};

const badgeRuleta = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: "999px",
  background: "#dbeafe",
  color: "#1e3a8a",
  fontWeight: 800,
};
