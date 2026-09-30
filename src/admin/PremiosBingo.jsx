import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { suscribirseAPremiosBingo } from "../utils/premiosBingoEvento";

// Lista de premios de Bingo conseguidos y control de "regalo entregado".
//
// · Los premios salen de admin_listar_premios_bingo (una fila por cartón),
//   que usa la misma obtener_estado_carton_bingo(...) que el TPV: un cliente
//   aparece aquí en el mismo momento en que se le celebra el premio en tienda.
// · Cada cartón puede tener 2 regalos: LÍNEA (normal o especial) y BINGO
//   (normal o especial). Cada uno se marca como entregado por separado.
// · Las entregas se guardan en bingo_premios_entregas
//   (migracion_premios_bingo_entregas.sql).
// · Se usa en el Admin (pestaña "Premios de Bingo") y en la pantalla de
//   almacén "Pedidos recibidos" (modoAlmacen), donde además avisa al momento
//   con sonido cuando un cliente gana un premio en caja.

const REFRESCO_RESPALDO_MS = 60 * 1000;

function normalizarBusqueda(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function formatearFechaHora(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function claveCarton(fila) {
  return String(fila.carton_id || `${fila.customer_token || ""}:${fila.ronda ?? 1}`);
}

// Pitido corto de aviso (sin archivos de audio).
function sonarAviso() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notas = [880, 1175, 1568];
    notas.forEach((frecuencia, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = frecuencia;
      const inicio = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, inicio);
      gain.gain.exponentialRampToValueAtTime(0.4, inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.4);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* sin sonido */
  }
}

async function cargarNombresRegalos() {
  try {
    const { data: promo } = await supabase
      .from("promociones_bingo")
      .select("*")
      .eq("activa", true)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!promo) return {};

    const ids = [
      promo.premio_linea_articulo_id,
      promo.premio_linea_especial_articulo_id,
      promo.premio_bingo_articulo_id,
      promo.premio_especial_articulo_id,
    ].filter(Boolean);
    let porId = new Map();
    if (ids.length) {
      const { data: articulos } = await supabase.from("articulos").select("id,nombre").in("id", ids);
      porId = new Map((articulos || []).map((a) => [String(a.id), a.nombre]));
    }
    const nombre = (tipo) =>
      promo[`premio_${tipo}_nombre`] || porId.get(String(promo[`premio_${tipo}_articulo_id`] || "")) || "";
    return {
      linea: nombre("linea"),
      lineaEspecial: nombre("linea_especial"),
      bingo: nombre("bingo"),
      bingoEspecial: nombre("especial"),
    };
  } catch {
    return {};
  }
}

// Convierte las filas por cartón en una fila por REGALO (línea / bingo).
function construirRegalos(filas, entregas, nombresRegalos) {
  const regalos = [];
  filas.forEach((fila) => {
    const clave = claveCarton(fila);
    const base = {
      clave,
      customer_name: fila.customer_name,
      customer_token: fila.customer_token,
      ronda: fila.ronda,
      bolas_cantadas: fila.bolas_cantadas,
      ultima_bola_en: fila.ultima_bola_en,
    };
    if (fila.tiene_linea || fila.tiene_linea_especial) {
      const especial = Boolean(fila.tiene_linea_especial);
      regalos.push({
        ...base,
        tipo: "linea",
        especial,
        etiqueta: especial ? "★ LÍNEA ESPECIAL" : "LÍNEA",
        regalo: especial ? nombresRegalos.lineaEspecial : nombresRegalos.linea,
        entregadoEn: entregas.get(`${clave}|linea`) || null,
      });
    }
    if (fila.tiene_bingo || fila.tiene_bingo_especial) {
      const especial = Boolean(fila.tiene_bingo_especial);
      regalos.push({
        ...base,
        tipo: "bingo",
        especial,
        etiqueta: especial ? "★ BINGO ESPECIAL" : "BINGO",
        regalo: especial ? nombresRegalos.bingoEspecial : nombresRegalos.bingo,
        entregadoEn: entregas.get(`${clave}|bingo`) || null,
      });
    }
  });
  // Pendientes primero; dentro de cada grupo, lo más reciente arriba.
  regalos.sort((a, b) => {
    if (Boolean(a.entregadoEn) !== Boolean(b.entregadoEn)) return a.entregadoEn ? 1 : -1;
    return new Date(b.ultima_bola_en || 0) - new Date(a.ultima_bola_en || 0);
  });
  return regalos;
}

/**
 * Hook compartido: carga premios + entregas y escucha en tiempo real los
 * premios que se ganan en caja.
 */
export function usePremiosBingo({ avisarConSonido = false } = {}) {
  const [filas, setFilas] = useState([]);
  const [entregas, setEntregas] = useState(() => new Map());
  const [entregasDisponibles, setEntregasDisponibles] = useState(true);
  const [nombresRegalos, setNombresRegalos] = useState({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [ultimoAviso, setUltimoAviso] = useState(null);
  const montado = useRef(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [premiosRes, entregasRes, nombres] = await Promise.all([
        supabase.rpc("admin_listar_premios_bingo"),
        supabase.rpc("admin_listar_entregas_premios_bingo"),
        cargarNombresRegalos(),
      ]);
      if (premiosRes.error) throw premiosRes.error;
      if (!montado.current) return;

      setFilas(premiosRes.data || []);
      setNombresRegalos(nombres);

      if (entregasRes.error) {
        console.warn("Entregas de premios no disponibles:", entregasRes.error);
        setEntregasDisponibles(false);
      } else {
        setEntregasDisponibles(true);
        setEntregas(
          new Map((entregasRes.data || []).map((e) => [`${e.clave}|${e.tipo}`, e.entregado_en]))
        );
      }
    } catch (err) {
      if (montado.current) {
        setError(
          err?.message ||
            "No se pudieron cargar los premios de Bingo. Comprueba que la función admin_listar_premios_bingo está creada en Supabase."
        );
      }
    } finally {
      if (montado.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    cargar();
    const intervalo = setInterval(cargar, REFRESCO_RESPALDO_MS);
    const desuscribir = suscribirseAPremiosBingo((payload) => {
      setUltimoAviso({ ...payload, recibido: Date.now() });
      if (avisarConSonido) sonarAviso();
      // Pequeña espera para que la bola quede guardada del todo en Supabase.
      setTimeout(cargar, 800);
    });
    return () => {
      montado.current = false;
      clearInterval(intervalo);
      desuscribir();
    };
  }, [cargar, avisarConSonido]);

  const regalos = useMemo(
    () => construirRegalos(filas, entregas, nombresRegalos),
    [filas, entregas, nombresRegalos]
  );
  const pendientes = useMemo(() => regalos.filter((r) => !r.entregadoEn), [regalos]);

  const marcarEntregado = useCallback(async (regalo, entregado) => {
    const { data, error: rpcError } = await supabase.rpc("admin_marcar_premio_bingo_entregado", {
      p_clave: regalo.clave,
      p_tipo: regalo.tipo,
      p_entregado: entregado,
      p_customer_token: regalo.customer_token || null,
      p_ronda: regalo.ronda ?? null,
    });
    const resultado = Array.isArray(data) ? data[0] : data;
    if (rpcError || !resultado?.ok) {
      throw rpcError || new Error("No se pudo guardar la entrega.");
    }
    setEntregas((prev) => {
      const nuevo = new Map(prev);
      const k = `${regalo.clave}|${regalo.tipo}`;
      if (entregado) nuevo.set(k, resultado.entregado_en || new Date().toISOString());
      else nuevo.delete(k);
      return nuevo;
    });
  }, []);

  return {
    regalos,
    pendientes,
    entregasDisponibles,
    cargando,
    error,
    cargar,
    marcarEntregado,
    ultimoAviso,
  };
}

function Badge({ children, tono = "gris" }) {
  return <span style={badgeStyle(tono)}>{children}</span>;
}

// Pestaña del Admin: carga sus propios datos.
export default function PremiosBingo() {
  const datos = usePremiosBingo({ avisarConSonido: false });
  return <PremiosBingoVista datos={datos} />;
}

// Vista reutilizable. En "Pedidos recibidos" los datos vienen de la pantalla
// padre (que también los usa para el aviso parpadeante de arriba), para no
// cargarlos ni escuchar el canal dos veces.
export function PremiosBingoVista({ datos, modoAlmacen = false }) {
  const { regalos, entregasDisponibles, cargando, error, cargar, marcarEntregado, ultimoAviso } = datos;

  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState(modoAlmacen ? "pendientes" : "todos");
  const [guardando, setGuardando] = useState(() => new Set());
  const [errorGuardar, setErrorGuardar] = useState("");

  const regalosFiltrados = useMemo(() => {
    const query = normalizarBusqueda(busqueda);
    return regalos.filter((r) => {
      if (vista === "pendientes" && r.entregadoEn) return false;
      if (vista === "entregados" && !r.entregadoEn) return false;
      if (!query) return true;
      return (
        normalizarBusqueda(r.customer_name).includes(query) ||
        normalizarBusqueda(r.customer_token).includes(query)
      );
    });
  }, [regalos, busqueda, vista]);

  const totalPendientes = regalos.filter((r) => !r.entregadoEn).length;
  const totalEntregados = regalos.length - totalPendientes;

  async function cambiarEntrega(regalo, entregado) {
    if (!entregado) {
      const ok = window.confirm(
        `¿Quitar la marca de entregado a ${regalo.customer_name || "este cliente"} (${regalo.etiqueta})?`
      );
      if (!ok) return;
    }
    const k = `${regalo.clave}|${regalo.tipo}`;
    setErrorGuardar("");
    setGuardando((prev) => new Set(prev).add(k));
    try {
      await marcarEntregado(regalo, entregado);
    } catch (err) {
      console.error(err);
      setErrorGuardar(
        "No se pudo guardar la entrega. Comprueba que está aplicada la migración migracion_premios_bingo_entregas.sql."
      );
    } finally {
      setGuardando((prev) => {
        const nuevo = new Set(prev);
        nuevo.delete(k);
        return nuevo;
      });
    }
  }

  async function marcarTodosMostrados() {
    const lista = regalosFiltrados.filter((r) => !r.entregadoEn);
    if (!lista.length) return;
    const ok = window.confirm(
      `¿Marcar como ENTREGADOS los ${lista.length} regalo(s) pendientes que se ven en la lista?\n\nÚtil para dar por entregados de golpe los premios antiguos.`
    );
    if (!ok) return;
    setErrorGuardar("");
    try {
      for (const regalo of lista) {
        await marcarEntregado(regalo, true);
      }
    } catch (err) {
      console.error(err);
      setErrorGuardar("No se pudieron marcar todos. Vuelve a intentarlo.");
    }
  }

  const avisoReciente =
    ultimoAviso && Date.now() - ultimoAviso.recibido < 5 * 60 * 1000 ? ultimoAviso : null;

  return (
    <div style={contenedor}>
      <div style={cabecera}>
        <div>
          <h2 style={titulo}>🎁 Premios de Bingo</h2>
          <p style={subtitulo}>
            Clientes que han conseguido línea o bingo (normal o especial). Marca la casilla cuando le
            hayas dado el regalo. Si un cliente completa su cartón y sigue con otro, cada cartón sale por
            separado.
          </p>
        </div>
        <div style={acciones}>
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            style={inputBusqueda}
          />
          <button type="button" onClick={cargar} disabled={cargando} style={botonRefrescar}>
            {cargando ? "Actualizando…" : "🔄 Actualizar"}
          </button>
        </div>
      </div>

      {avisoReciente && (
        <div style={cajaAvisoNuevo}>
          🎉 Acaba de ganar <strong>{avisoReciente.etiqueta}</strong>
          {avisoReciente.premioNombre ? ` (${avisoReciente.premioNombre})` : ""}:{" "}
          <strong>{avisoReciente.customerName || avisoReciente.customerToken}</strong> — a las{" "}
          {new Date(avisoReciente.en || avisoReciente.recibido).toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}

      <div style={barraVistas}>
        <button type="button" style={botonVista(vista === "pendientes", "#dc2626")} onClick={() => setVista("pendientes")}>
          ⏳ Pendientes de entregar ({totalPendientes})
        </button>
        <button type="button" style={botonVista(vista === "entregados", "#16a34a")} onClick={() => setVista("entregados")}>
          ✅ Entregados ({totalEntregados})
        </button>
        <button type="button" style={botonVista(vista === "todos", "#0f172a")} onClick={() => setVista("todos")}>
          Todos ({regalos.length})
        </button>
        {entregasDisponibles && vista !== "entregados" && regalosFiltrados.some((r) => !r.entregadoEn) && (
          <button type="button" style={botonMarcarTodos} onClick={marcarTodosMostrados}>
            ✔ Marcar todos los mostrados como entregados
          </button>
        )}
      </div>

      {!entregasDisponibles && (
        <div style={cajaAviso}>
          Para poder marcar los regalos como entregados hay que ejecutar primero en Supabase la migración{" "}
          <strong>migracion_premios_bingo_entregas.sql</strong>.
        </div>
      )}
      {error && <div style={cajaError}>{error}</div>}
      {errorGuardar && <div style={cajaError}>{errorGuardar}</div>}

      {!error && !cargando && regalosFiltrados.length === 0 && (
        <div style={cajaVacia}>
          {vista === "pendientes"
            ? "No hay ningún regalo pendiente de entregar. 👍"
            : "No hay premios que mostrar."}
        </div>
      )}

      {regalosFiltrados.length > 0 && (
        <div style={tablaContenedor}>
          <table style={tabla}>
            <thead>
              <tr>
                <th style={{ ...th, width: 130, textAlign: "center" }}>Regalo entregado</th>
                <th style={th}>Cliente</th>
                <th style={th}>Premio</th>
                <th style={th}>Bolas cantadas</th>
                <th style={th}>Última bola</th>
              </tr>
            </thead>
            <tbody>
              {regalosFiltrados.map((regalo) => {
                const k = `${regalo.clave}|${regalo.tipo}`;
                const entregado = Boolean(regalo.entregadoEn);
                const ocupado = guardando.has(k);
                return (
                  <tr key={k} style={{ background: entregado ? "#f0fdf4" : "#fff7ed" }}>
                    <td style={{ ...td, textAlign: "center" }}>
                      <label style={etiquetaCheck(entregado, !entregasDisponibles || ocupado)}>
                        <input
                          type="checkbox"
                          checked={entregado}
                          disabled={!entregasDisponibles || ocupado}
                          onChange={(e) => cambiarEntrega(regalo, e.target.checked)}
                          style={checkGrande}
                        />
                        <span style={{ fontSize: 11, fontWeight: 800 }}>
                          {ocupado ? "Guardando…" : entregado ? "ENTREGADO" : "PENDIENTE"}
                        </span>
                        {entregado && (
                          <span style={{ fontSize: 11, color: "#15803d" }}>
                            {formatearFechaHora(regalo.entregadoEn)}
                          </span>
                        )}
                      </label>
                    </td>
                    <td style={td}>
                      <strong style={{ fontSize: modoAlmacen ? 16 : 14 }}>
                        {regalo.customer_name || "Cliente sin nombre"}
                      </strong>
                      <div style={tokenPequeno}>
                        {regalo.customer_token}
                        {regalo.ronda ? ` · Cartón nº ${regalo.ronda}` : ""}
                      </div>
                    </td>
                    <td style={td}>
                      <Badge tono={regalo.especial ? "dorado" : regalo.tipo === "bingo" ? "rojo" : "azul"}>
                        {regalo.etiqueta}
                      </Badge>
                      {regalo.regalo && <div style={textoRegalo}>🎁 {regalo.regalo}</div>}
                    </td>
                    <td style={td}>{regalo.bolas_cantadas ?? "—"}</td>
                    <td style={td}>{formatearFechaHora(regalo.ultima_bola_en)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const contenedor = { display: "flex", flexDirection: "column", gap: 16 };
const cabecera = {
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  alignItems: "center",
  justifyContent: "space-between",
};
const titulo = { margin: 0, fontSize: 22 };
const subtitulo = { margin: "4px 0 0", color: "#64748b", fontSize: 14, maxWidth: 720 };
const acciones = { display: "flex", gap: 10, flexWrap: "wrap" };
const inputBusqueda = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 14,
  minWidth: 220,
};
const botonRefrescar = {
  border: "none",
  borderRadius: 10,
  background: "#0f172a",
  color: "#fff",
  padding: "10px 16px",
  fontWeight: 700,
  cursor: "pointer",
};
const barraVistas = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" };
const botonVista = (activo, color) => ({
  border: activo ? `2px solid ${color}` : "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "9px 15px",
  background: activo ? color : "#fff",
  color: activo ? "#fff" : "#334155",
  fontWeight: 800,
  cursor: "pointer",
});
const botonMarcarTodos = {
  marginLeft: "auto",
  border: "1px solid #16a34a",
  borderRadius: 999,
  padding: "9px 15px",
  background: "#f0fdf4",
  color: "#15803d",
  fontWeight: 800,
  cursor: "pointer",
};
const cajaError = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  borderRadius: 12,
  padding: "12px 16px",
};
const cajaAviso = {
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  borderRadius: 12,
  padding: "12px 16px",
};
const cajaAvisoNuevo = {
  border: "2px solid #f59e0b",
  background: "linear-gradient(90deg, #fef3c7, #fde68a)",
  color: "#78350f",
  borderRadius: 14,
  padding: "14px 18px",
  fontSize: 17,
};
const cajaVacia = {
  border: "1px dashed #cbd5e1",
  borderRadius: 12,
  padding: "24px 16px",
  textAlign: "center",
  color: "#64748b",
};
const tablaContenedor = { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 14 };
const tabla = { width: "100%", borderCollapse: "collapse" };
const th = {
  textAlign: "left",
  padding: "12px 14px",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 13,
  color: "#475569",
};
const td = { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle", fontSize: 14 };
const tokenPequeno = { color: "#94a3b8", fontSize: 12, marginTop: 2 };
const textoRegalo = { marginTop: 6, fontSize: 13, fontWeight: 700, color: "#334155" };
const checkGrande = { width: 26, height: 26, cursor: "pointer", accentColor: "#16a34a" };
const etiquetaCheck = (entregado, deshabilitado) => ({
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  cursor: deshabilitado ? "not-allowed" : "pointer",
  color: entregado ? "#15803d" : "#c2410c",
});

function badgeStyle(tono) {
  const tonos = {
    gris: { bg: "#e2e8f0", color: "#334155" },
    azul: { bg: "#dbeafe", color: "#1d4ed8" },
    rojo: { bg: "#fee2e2", color: "#b91c1c" },
    dorado: { bg: "#fef3c7", color: "#92400e" },
  };
  const elegido = tonos[tono] || tonos.gris;
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: elegido.bg,
    color: elegido.color,
    whiteSpace: "nowrap",
  };
}
