import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  soportaCarpetaEscritorio,
  obtenerCarpetaRecordada,
  tienePermiso,
  pedirPermiso,
  elegirCarpetaEscritorio,
  escribirCSVEnCarpeta,
  nombreArchivoSeguro,
} from "../utils/carpetaPedidosRecibidos";

const CORTE_HORA = 14;
const CORTE_MINUTO = 30;

function fechaLocalISO(fecha = new Date()) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function crearFechaLocal(fechaISO) {
  const [year, month, day] = String(fechaISO).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function inicioDiaEstadistico(fechaISO) {
  const fecha = crearFechaLocal(fechaISO);
  fecha.setHours(CORTE_HORA, CORTE_MINUTO, 0, 0);
  return fecha;
}

function finDiaEstadistico(fechaISO) {
  const fecha = inicioDiaEstadistico(fechaISO);
  fecha.setDate(fecha.getDate() + 1);
  return fecha;
}

function diaEstadisticoActualISO() {
  const ahora = new Date();
  const corteHoy = new Date();
  corteHoy.setHours(CORTE_HORA, CORTE_MINUTO, 0, 0);
  if (ahora < corteHoy) ahora.setDate(ahora.getDate() - 1);
  return fechaLocalISO(ahora);
}

function sumarDias(fechaISO, dias) {
  const fecha = crearFechaLocal(fechaISO);
  fecha.setDate(fecha.getDate() + dias);
  return fechaLocalISO(fecha);
}

function formatearNumero(valor) {
  return Number(valor || 0).toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

function formatearFechaHora(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-ES");
}

// Mismas columnas exactas que ya usa la app en Estadísticas > Exportar
// pedidos, para que el CSV de cada pedido tenga siempre el mismo formato.
const CABECERA_CSV_PEDIDO = [
  "Pedido",
  "Fecha",
  "Cliente",
  "Codigo Lojo",
  "Departamento",
  "Codigo articulo",
  "Nombre articulo",
  "Cajas",
  "Unidades",
];

function escaparCSV(valor) {
  const texto = String(valor ?? "");
  if (/[";\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

function construirContenidoCSV(cabecera, filas) {
  return [cabecera, ...filas].map((fila) => fila.map(escaparCSV).join(";")).join("\r\n");
}

function filaCSVDesdeMovimiento(fila, codigoLojoPorToken = {}) {
  return [
    fila.pedido_id || fila.id || "",
    fila.created_at ? new Date(fila.created_at).toLocaleString("es-ES") : "",
    fila.customer_name || "",
    (fila.cliente_token && codigoLojoPorToken[fila.cliente_token]) || "",
    fila.departamento || "",
    fila.codigo_articulo || "",
    fila.nombre_articulo || "",
    formatearNumero(fila.cajas),
    formatearNumero(fila.unidades),
  ];
}

export default function PedidosExportar() {
  const hoyEstadistico = diaEstadisticoActualISO();

  const [movimientos, setMovimientos] = useState([]);
  const [codigoLojoPorToken, setCodigoLojoPorToken] = useState({});
  const [exportados, setExportados] = useState({});
  const [desde, setDesde] = useState(hoyEstadistico);
  const [hasta, setHasta] = useState(hoyEstadistico);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [filtro, setFiltro] = useState("pendientes");

  const [carpetaHandle, setCarpetaHandle] = useState(null);
  const [carpetaConcedida, setCarpetaConcedida] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [mensajeExport, setMensajeExport] = useState("");

  const [pedidoDetalle, setPedidoDetalle] = useState(null);
  const [pedidosParaImprimir, setPedidosParaImprimir] = useState([]);

  const [borrando, setBorrando] = useState(false);
  const [revirtiendo, setRevirtiendo] = useState(false);
  const [modoTodasFechas, setModoTodasFechas] = useState(false);
  const [buscandoTodos, setBuscandoTodos] = useState(false);

  useEffect(() => {
    if (!pedidosParaImprimir.length) return;
    const id = setTimeout(() => window.print(), 60);
    return () => clearTimeout(id);
  }, [pedidosParaImprimir]);

  useEffect(() => {
    const alTerminar = () => setPedidosParaImprimir([]);
    window.addEventListener("afterprint", alTerminar);
    return () => window.removeEventListener("afterprint", alTerminar);
  }, []);

  function verPedido(pedido) {
    setPedidoDetalle(pedido);
  }

  function imprimirPedido(pedido) {
    setPedidosParaImprimir([pedido]);
  }

  function imprimirSeleccionados() {
    const lista = pedidos.filter((p) => seleccionados.has(p.pedido_id));
    if (lista.length) setPedidosParaImprimir(lista);
  }

  const soportado = soportaCarpetaEscritorio();

  useEffect(() => {
    // Por defecto se muestran SIEMPRE todos los pedidos pendientes de
    // exportar, sin importar su fecha, para que nunca se quede ninguno
    // atrás fuera del rango "Hoy/Ayer/…" que se esté mirando. Los
    // filtros de fecha de arriba quedan disponibles para consultar el
    // histórico (exportados) cuando se necesite.
    cargarTodosPendientes();

    (async () => {
      const { data } = await supabase.from("clientes").select("token, codigo_lojo");
      const mapa = {};
      (data || []).forEach((cliente) => {
        if (cliente.token) mapa[cliente.token] = cliente.codigo_lojo || "";
      });
      setCodigoLojoPorToken(mapa);
    })();

    (async () => {
      const handle = await obtenerCarpetaRecordada();
      if (handle) {
        const ok = await tienePermiso(handle);
        setCarpetaHandle(handle);
        setCarpetaConcedida(ok);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarPedidos(desdeFiltro = desde, hastaFiltro = hasta) {
    setModoTodasFechas(false);
    setCargando(true);
    setError("");
    setMensajeExport("");

    try {
      const inicio = inicioDiaEstadistico(desdeFiltro).toISOString();
      const fin = finDiaEstadistico(hastaFiltro).toISOString();

      const { data, error: movimientosError } = await supabase
        .from("estadisticas_movimientos")
        .select(
          "id, pedido_id, created_at, codigo_articulo, nombre_articulo, departamento, cajas, unidades, customer_name, cliente_token"
        )
        .gte("created_at", inicio)
        .lt("created_at", fin)
        .order("created_at", { ascending: true });

      if (movimientosError) throw movimientosError;

      setMovimientos(data || []);

      const idsPedidos = Array.from(new Set((data || []).map((f) => f.pedido_id).filter(Boolean)));

      if (idsPedidos.length) {
        const { data: exportadosData, error: exportadosError } = await supabase
          .from("pedidos_exportados")
          .select("pedido_id, exportado_at, ultimo_movimiento_at")
          .in("pedido_id", idsPedidos);

        if (exportadosError) throw exportadosError;

        const mapaExportados = {};
        (exportadosData || []).forEach((fila) => {
          mapaExportados[fila.pedido_id] = fila;
        });
        setExportados(mapaExportados);
      } else {
        setExportados({});
      }

      setSeleccionados(new Set());
    } catch (err) {
      setError(err.message || "No se pudieron cargar los pedidos.");
    } finally {
      setCargando(false);
    }
  }

  function cambiarPeriodoRapido(dias) {
    const nuevaDesde = dias === 0 ? hoyEstadistico : sumarDias(hoyEstadistico, -dias);
    setDesde(nuevaDesde);
    setHasta(hoyEstadistico);
    cargarPedidos(nuevaDesde, hoyEstadistico);
  }

  // Localiza TODOS los pedidos pendientes de exportar, sea cual sea su
  // fecha, para no dejar nunca un pedido antiguo olvidado fuera del rango
  // de fechas que se esté mirando en cada momento. Pagina en bloques de
  // 1000 filas (límite por defecto de Supabase) tanto para
  // "pedidos_exportados" como para "estadisticas_movimientos".
  async function cargarTodosPendientes() {
    setBuscandoTodos(true);
    setCargando(true);
    setError("");
    setMensajeExport("");
    setModoTodasFechas(true);

    const TAMANO_PAGINA = 1000;

    try {
      const idsExportados = new Set();
      let desdeExp = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error: expError } = await supabase
          .from("pedidos_exportados")
          .select("pedido_id")
          .range(desdeExp, desdeExp + TAMANO_PAGINA - 1);
        if (expError) throw expError;
        (data || []).forEach((f) => idsExportados.add(f.pedido_id));
        if (!data || data.length < TAMANO_PAGINA) break;
        desdeExp += TAMANO_PAGINA;
      }

      // La exclusión se hace aquí (en JS), no en la consulta: con muchos
      // pedidos ya exportados, meterlos todos en el filtro "not in" de la
      // URL la hace demasiado larga y Supabase la rechaza con "Bad
      // Request". Así no hay límite de tamaño.
      const todasLasLineas = [];
      let desdeMov = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error: movError } = await supabase
          .from("estadisticas_movimientos")
          .select(
            "id, pedido_id, created_at, codigo_articulo, nombre_articulo, departamento, cajas, unidades, customer_name, cliente_token"
          )
          .order("created_at", { ascending: true })
          .range(desdeMov, desdeMov + TAMANO_PAGINA - 1);

        if (movError) throw movError;

        (data || []).forEach((fila) => {
          if (!idsExportados.has(fila.pedido_id)) todasLasLineas.push(fila);
        });

        if (!data || data.length < TAMANO_PAGINA) break;
        desdeMov += TAMANO_PAGINA;
      }

      setMovimientos(todasLasLineas);
      setExportados({});
      setFiltro("pendientes");
      setSeleccionados(new Set());
    } catch (err) {
      setError(err.message || "No se pudieron buscar los pedidos pendientes.");
    } finally {
      setCargando(false);
      setBuscandoTodos(false);
    }
  }

  const pedidos = useMemo(() => {
    const mapa = new Map();

    movimientos.forEach((fila) => {
      const id = String(fila.pedido_id || fila.id);
      if (!mapa.has(id)) {
        mapa.set(id, {
          pedido_id: id,
          fecha: fila.created_at,
          customer_name: fila.customer_name,
          cliente_token: fila.cliente_token,
          lineas: [],
        });
      }
      const pedido = mapa.get(id);
      pedido.lineas.push(fila);
      if (new Date(fila.created_at) > new Date(pedido.fecha)) pedido.fecha = fila.created_at;
    });

    return Array.from(mapa.values())
      .map((pedido) => {
        const codigoLojo = (pedido.cliente_token && codigoLojoPorToken[pedido.cliente_token]) || "";
        const infoExportado = exportados[pedido.pedido_id];
        const exportado = Boolean(infoExportado);
        const modificadoTrasExportar =
          exportado && infoExportado.ultimo_movimiento_at
            ? new Date(pedido.fecha) > new Date(infoExportado.ultimo_movimiento_at)
            : false;

        return {
          ...pedido,
          codigoLojo,
          totalLineas: pedido.lineas.length,
          totalCajas: pedido.lineas.reduce((total, l) => total + Number(l.cajas || 0), 0),
          totalUnidades: pedido.lineas.reduce((total, l) => total + Number(l.unidades || 0), 0),
          exportado,
          exportadoAt: infoExportado?.exportado_at || null,
          modificadoTrasExportar,
        };
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [movimientos, codigoLojoPorToken, exportados]);

  const seleccionadosExportadosCount = pedidos.filter(
    (p) => seleccionados.has(p.pedido_id) && p.exportado
  ).length;

  const pendientesCount = pedidos.filter((p) => !p.exportado || p.modificadoTrasExportar).length;
  const exportadosCount = pedidos.length - pendientesCount;

  const pedidosFiltrados = useMemo(() => {
    if (filtro === "pendientes") return pedidos.filter((p) => !p.exportado || p.modificadoTrasExportar);
    if (filtro === "exportados") return pedidos.filter((p) => p.exportado && !p.modificadoTrasExportar);
    return pedidos;
  }, [pedidos, filtro]);

  function alternarSeleccion(id) {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  function seleccionarPendientesVisibles() {
    setSeleccionados(
      new Set(pedidosFiltrados.filter((p) => !p.exportado || p.modificadoTrasExportar).map((p) => p.pedido_id))
    );
  }

  function marcarTodosVisibles() {
    setSeleccionados(new Set(pedidosFiltrados.map((p) => p.pedido_id)));
  }

  function limpiarSeleccion() {
    setSeleccionados(new Set());
  }

  async function manejarElegirCarpeta() {
    try {
      setError("");
      const handle = await elegirCarpetaEscritorio();
      setCarpetaHandle(handle);
      setCarpetaConcedida(true);
    } catch (err) {
      if (err?.name !== "AbortError") {
        setError("No se pudo abrir el selector de carpetas del escritorio.");
      }
    }
  }

  async function manejarConfirmarPermiso() {
    const ok = await pedirPermiso(carpetaHandle);
    setCarpetaConcedida(ok);
    if (!ok) setError('No se concedió permiso sobre la carpeta. Pulsa "Elegir carpeta" de nuevo.');
  }

  async function exportarSeleccionados() {
    if (!carpetaHandle || !carpetaConcedida) {
      setError('Primero elige la carpeta "Pedidos Recibidos" del escritorio.');
      return;
    }

    const pedidosAExportar = pedidos.filter((p) => seleccionados.has(p.pedido_id));
    if (!pedidosAExportar.length) return;

    setExportando(true);
    setError("");
    setMensajeExport("");

    let exportadosOk = 0;
    const fallidos = [];

    for (const pedido of pedidosAExportar) {
      try {
        const filasCSV = pedido.lineas
          .slice()
          .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
          .map((fila) => filaCSVDesdeMovimiento(fila, codigoLojoPorToken));

        const contenido = construirContenidoCSV(CABECERA_CSV_PEDIDO, filasCSV);

        const fechaArchivo = pedido.fecha ? new Date(pedido.fecha) : new Date();
        const sufijoFecha =
          fechaLocalISO(fechaArchivo) +
          "_" +
          String(fechaArchivo.getHours()).padStart(2, "0") +
          String(fechaArchivo.getMinutes()).padStart(2, "0");

        const nombreArchivo = `Pedido_${nombreArchivoSeguro(pedido.codigoLojo || "SINCOD")}_${nombreArchivoSeguro(
          pedido.customer_name || "sin_nombre"
        )}_${sufijoFecha}.csv`;

        await escribirCSVEnCarpeta(carpetaHandle, nombreArchivo, contenido);

        const ultimoMovimiento = pedido.lineas.reduce((max, fila) => {
          const fecha = new Date(fila.created_at || 0);
          return fecha > max ? fecha : max;
        }, new Date(0));

        const { error: upsertError } = await supabase.from("pedidos_exportados").upsert(
          {
            pedido_id: pedido.pedido_id,
            exportado_at: new Date().toISOString(),
            ultimo_movimiento_at: ultimoMovimiento.toISOString(),
            nombre_archivo: nombreArchivo,
          },
          { onConflict: "pedido_id" }
        );

        if (upsertError) throw upsertError;

        exportadosOk += 1;
      } catch (err) {
        fallidos.push(pedido.customer_name || pedido.pedido_id);
      }
    }

    setExportando(false);
    if (modoTodasFechas) await cargarTodosPendientes();
    else await cargarPedidos(desde, hasta);

    if (fallidos.length) {
      setError(`No se pudieron exportar ${fallidos.length} pedido(s): ${fallidos.join(", ")}`);
    }
    if (exportadosOk) {
      setMensajeExport(`${exportadosOk} pedido(s) exportado(s) a la carpeta "Pedidos Recibidos".`);
    }
  }

  async function revertirPedidos(ids) {
    if (!ids.length) return;

    setRevirtiendo(true);
    setError("");
    setMensajeExport("");

    try {
      const { error: revertError } = await supabase
        .from("pedidos_exportados")
        .delete()
        .in("pedido_id", ids);
      if (revertError) throw revertError;

      setSeleccionados(new Set());
      setMensajeExport(`${ids.length} pedido(s) revertido(s) a pendientes.`);

      if (modoTodasFechas) await cargarTodosPendientes();
      else await cargarPedidos(desde, hasta);
    } catch (err) {
      setError(err.message || "No se pudieron revertir los pedidos seleccionados.");
    } finally {
      setRevirtiendo(false);
    }
  }

  function revertirSeleccionados() {
    const ids = pedidos.filter((p) => seleccionados.has(p.pedido_id) && p.exportado).map((p) => p.pedido_id);
    revertirPedidos(ids);
  }

  async function borrarSeleccionados() {
    const pedidosABorrar = pedidos.filter((p) => seleccionados.has(p.pedido_id));
    if (!pedidosABorrar.length) return;

    const listado = pedidosABorrar
      .slice(0, 6)
      .map((p) => `- ${p.customer_name || "Sin nombre"} (${formatearFechaHora(p.fecha)})`)
      .join("\n");
    const resto = pedidosABorrar.length > 6 ? `\n…y ${pedidosABorrar.length - 6} más` : "";

    const confirmado = window.confirm(
      `¿Seguro que quieres borrar ${pedidosABorrar.length} pedido(s)? Esta acción no se puede deshacer.\n\n${listado}${resto}`
    );
    if (!confirmado) return;

    setBorrando(true);
    setError("");
    setMensajeExport("");

    const ids = pedidosABorrar.map((p) => p.pedido_id);

    try {
      const { error: errorLineas } = await supabase
        .from("estadisticas_movimientos")
        .delete()
        .in("pedido_id", ids);
      if (errorLineas) throw errorLineas;

      const { error: errorExportados } = await supabase
        .from("pedidos_exportados")
        .delete()
        .in("pedido_id", ids);
      if (errorExportados) throw errorExportados;

      setSeleccionados(new Set());
      setMensajeExport(`${ids.length} pedido(s) borrado(s).`);

      if (modoTodasFechas) await cargarTodosPendientes();
      else await cargarPedidos(desde, hasta);
    } catch (err) {
      setError(err.message || "No se pudieron borrar los pedidos seleccionados.");
    } finally {
      setBorrando(false);
    }
  }

  return (
    <div style={contenedor}>
      <div style={cabecera}>
        <div>
          <h2 style={titulo}>Pedidos recibidos</h2>
          <p style={subtitulo}>
            Marca los pedidos y expórtalos como CSV directamente a la carpeta del escritorio.
          </p>
        </div>
      </div>

      {!soportado && (
        <div style={avisoNavegador}>
          Este navegador no permite guardar archivos directamente en una carpeta. Abre esta pantalla con
          Chrome o Edge.
        </div>
      )}

      <div style={bloqueCarpeta}>
        {!carpetaHandle && (
          <button type="button" style={botonPrimario} onClick={manejarElegirCarpeta} disabled={!soportado}>
            📁 Elegir carpeta "Pedidos Recibidos" del escritorio
          </button>
        )}
        {carpetaHandle && carpetaConcedida && (
          <span style={carpetaOk}>✅ Carpeta "{carpetaHandle.name}" lista para recibir los CSV.</span>
        )}
        {carpetaHandle && !carpetaConcedida && (
          <>
            <span style={carpetaAviso}>
              Carpeta "{carpetaHandle.name}" recordada, pero hay que confirmar el permiso.
            </span>
            <button type="button" style={botonSecundario} onClick={manejarConfirmarPermiso}>
              Confirmar permiso
            </button>
          </>
        )}
        {carpetaHandle && (
          <button type="button" style={botonTexto} onClick={manejarElegirCarpeta}>
            Cambiar carpeta
          </button>
        )}
      </div>

      <div style={filtrosFecha}>
        <button type="button" style={botonSecundario} onClick={() => cambiarPeriodoRapido(0)}>
          Hoy
        </button>
        <button type="button" style={botonSecundario} onClick={() => cambiarPeriodoRapido(1)}>
          Ayer
        </button>
        <button type="button" style={botonSecundario} onClick={() => cambiarPeriodoRapido(7)}>
          Últimos 7 días
        </button>

        <span style={separadorFecha} />

        <label style={etiquetaFecha}>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={inputFecha} />
        </label>
        <label style={etiquetaFecha}>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={inputFecha} />
        </label>
        <button type="button" style={botonPrimario} onClick={() => cargarPedidos(desde, hasta)}>
          🔎 Buscar
        </button>

        <span style={separadorFecha} />

        <button
          type="button"
          style={botonFiltro(modoTodasFechas)}
          onClick={cargarTodosPendientes}
          disabled={buscandoTodos}
        >
          {buscandoTodos ? "Buscando…" : "🔄 Actualizar pendientes (todas las fechas)"}
        </button>
      </div>

      {modoTodasFechas ? (
        <div style={avisoModoTodasFechas}>
          Mostrando siempre todos los pedidos pendientes de exportar, sin importar la fecha, para que
          no se quede ninguno atrás.{" "}
          <button type="button" style={botonTexto} onClick={() => cargarPedidos(desde, hasta)}>
            Consultar histórico por fecha
          </button>
        </div>
      ) : (
        <div style={avisoModoTodasFechas}>
          Consultando por fecha — los pedidos pendientes de otras fechas no se ven aquí.{" "}
          <button type="button" style={botonTexto} onClick={cargarTodosPendientes}>
            Volver a ver todos los pendientes
          </button>
        </div>
      )}

      <div style={filtrosEstado}>
        <button
          type="button"
          style={botonFiltro(filtro === "pendientes")}
          onClick={() => setFiltro("pendientes")}
        >
          Pendientes ({pendientesCount})
        </button>
        <button
          type="button"
          style={botonFiltro(filtro === "exportados")}
          onClick={() => setFiltro("exportados")}
          disabled={modoTodasFechas}
        >
          Exportados ({exportadosCount})
        </button>
        <button
          type="button"
          style={botonFiltro(filtro === "todos")}
          onClick={() => setFiltro("todos")}
          disabled={modoTodasFechas}
        >
          Todos ({pedidos.length})
        </button>
      </div>

      {error && <div style={cajaError}>{error}</div>}
      {mensajeExport && <div style={cajaExito}>{mensajeExport}</div>}

      <div style={barraAcciones}>
        <button type="button" style={botonTexto} onClick={seleccionarPendientesVisibles}>
          Marcar pendientes visibles
        </button>
        <button type="button" style={botonTexto} onClick={marcarTodosVisibles}>
          Marcar todos los visibles
        </button>
        <button type="button" style={botonTexto} onClick={limpiarSeleccion}>
          Quitar selección
        </button>

        <span style={{ flex: 1 }} />

        {(!carpetaHandle || !carpetaConcedida) && (
          <span style={avisoCarpetaFalta}>⚠️ Falta elegir la carpeta →</span>
        )}

        {!carpetaHandle && (
          <button type="button" style={botonSecundario} onClick={manejarElegirCarpeta} disabled={!soportado}>
            📁 Elegir carpeta
          </button>
        )}
        {carpetaHandle && !carpetaConcedida && (
          <button type="button" style={botonSecundario} onClick={manejarConfirmarPermiso}>
            Confirmar permiso
          </button>
        )}

        <button
          type="button"
          style={botonSecundario2(revirtiendo || seleccionadosExportadosCount === 0)}
          onClick={revertirSeleccionados}
          disabled={revirtiendo || seleccionadosExportadosCount === 0}
        >
          {revirtiendo
            ? "Revirtiendo…"
            : `↩️ Revertir a pendientes (${seleccionadosExportadosCount})`}
        </button>

        <button
          type="button"
          style={botonBorrar(borrando || seleccionados.size === 0)}
          onClick={borrarSeleccionados}
          disabled={borrando || seleccionados.size === 0}
        >
          {borrando ? "Borrando…" : `🗑️ Borrar seleccionados (${seleccionados.size})`}
        </button>

        <button
          type="button"
          style={botonSecundario}
          onClick={imprimirSeleccionados}
          disabled={seleccionados.size === 0}
        >
          🖨️ Imprimir seleccionados ({seleccionados.size})
        </button>

        <button
          type="button"
          style={botonPrimario2(exportando || seleccionados.size === 0)}
          onClick={exportarSeleccionados}
          disabled={exportando || seleccionados.size === 0}
        >
          {exportando ? "Exportando…" : `⬇️ Exportar seleccionados (${seleccionados.size})`}
        </button>
      </div>

      {cargando ? (
        <p style={textoCargando}>Cargando pedidos…</p>
      ) : (
        <div style={tablaEnvoltorio}>
          <table style={tabla}>
            <thead>
              <tr>
                <th style={th}></th>
                <th style={th}>Fecha</th>
                <th style={th}>Código Lojo</th>
                <th style={th}>Cliente</th>
                <th style={th}>Líneas</th>
                <th style={th}>Cajas</th>
                <th style={th}>Unidades</th>
                <th style={th}>Estado</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.map((pedido) => (
                <tr key={pedido.pedido_id} style={tr}>
                  <td style={td}>
                    <input
                      type="checkbox"
                      checked={seleccionados.has(pedido.pedido_id)}
                      onChange={() => alternarSeleccion(pedido.pedido_id)}
                    />
                  </td>
                  <td style={td}>{formatearFechaHora(pedido.fecha)}</td>
                  <td style={td}>{pedido.codigoLojo || "—"}</td>
                  <td style={td}>{pedido.customer_name || "Sin nombre"}</td>
                  <td style={td}>{pedido.totalLineas}</td>
                  <td style={td}>{formatearNumero(pedido.totalCajas)}</td>
                  <td style={td}>{formatearNumero(pedido.totalUnidades)}</td>
                  <td style={td}>
                    {pedido.modificadoTrasExportar ? (
                      <span style={estadoModificado}>✏️ Modificado tras exportar</span>
                    ) : pedido.exportado ? (
                      <span style={estadoExportado}>✅ Exportado {formatearFechaHora(pedido.exportadoAt)}</span>
                    ) : (
                      <span style={estadoPendiente}>⏳ Pendiente</span>
                    )}
                  </td>
                  <td style={td}>
                    <button type="button" style={botonTexto} onClick={() => verPedido(pedido)}>
                      👁 Ver
                    </button>
                    {pedido.exportado && (
                      <button
                        type="button"
                        style={botonTexto}
                        onClick={() => revertirPedidos([pedido.pedido_id])}
                        disabled={revirtiendo}
                      >
                        ↩️ Revertir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {pedidosFiltrados.length === 0 && (
                <tr>
                  <td style={td} colSpan={9}>
                    No hay pedidos en este periodo con este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pedidoDetalle && (
        <div style={overlayModal} onClick={() => setPedidoDetalle(null)}>
          <div style={cajaModal} onClick={(e) => e.stopPropagation()}>
            <div style={cabeceraModal}>
              <div>
                <h3 style={tituloModal}>{pedidoDetalle.customer_name || "Sin nombre"}</h3>
                <p style={subtituloModal}>
                  Código Lojo: {pedidoDetalle.codigoLojo || "—"} · {formatearFechaHora(pedidoDetalle.fecha)}
                </p>
              </div>
              <button type="button" style={botonCerrarModal} onClick={() => setPedidoDetalle(null)}>
                ✕
              </button>
            </div>

            <div style={tablaEnvoltorio}>
              <table style={tabla}>
                <thead>
                  <tr>
                    <th style={th}>Departamento</th>
                    <th style={th}>Código</th>
                    <th style={th}>Artículo</th>
                    <th style={th}>Cajas</th>
                    <th style={th}>Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidoDetalle.lineas.map((linea) => (
                    <tr key={linea.id} style={tr}>
                      <td style={td}>{linea.departamento || "—"}</td>
                      <td style={td}>{linea.codigo_articulo || "—"}</td>
                      <td style={td}>{linea.nombre_articulo || "—"}</td>
                      <td style={td}>{formatearNumero(linea.cajas)}</td>
                      <td style={td}>{formatearNumero(linea.unidades)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={piePresupuestoModal}>
              <span>
                Total: {pedidoDetalle.totalLineas} líneas · {formatearNumero(pedidoDetalle.totalCajas)} cajas ·{" "}
                {formatearNumero(pedidoDetalle.totalUnidades)} unidades
              </span>
              <button type="button" style={botonPrimario} onClick={() => imprimirPedido(pedidoDetalle)}>
                🖨️ Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media screen {
          #zona-impresion-pedidos { display: none; }
        }
        @media print {
          body * { visibility: hidden; }
          #zona-impresion-pedidos, #zona-impresion-pedidos * { visibility: visible; }
          #zona-impresion-pedidos { position: absolute; top: 0; left: 0; width: 100%; }
          .pedido-impresion { page-break-after: always; padding: 24px; font-family: Arial, sans-serif; }
          .pedido-impresion table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          .pedido-impresion th, .pedido-impresion td {
            border: 1px solid #999; padding: 6px 8px; font-size: 12px; text-align: left;
          }
        }
      `}</style>

      <div id="zona-impresion-pedidos">
        {pedidosParaImprimir.map((pedido) => (
          <div className="pedido-impresion" key={pedido.pedido_id}>
            <h2 style={{ margin: 0 }}>Pedido — Lojo</h2>
            <p style={{ margin: "4px 0" }}>
              <strong>Cliente:</strong> {pedido.customer_name || "Sin nombre"} &nbsp;·&nbsp;
              <strong>Código Lojo:</strong> {pedido.codigoLojo || "—"}
            </p>
            <p style={{ margin: "4px 0" }}>
              <strong>Fecha:</strong> {formatearFechaHora(pedido.fecha)}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Departamento</th>
                  <th>Código</th>
                  <th>Artículo</th>
                  <th>Cajas</th>
                  <th>Unidades</th>
                </tr>
              </thead>
              <tbody>
                {pedido.lineas
                  .slice()
                  .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
                  .map((linea) => (
                    <tr key={linea.id}>
                      <td>{linea.departamento || "—"}</td>
                      <td>{linea.codigo_articulo || "—"}</td>
                      <td>{linea.nombre_articulo || "—"}</td>
                      <td>{formatearNumero(linea.cajas)}</td>
                      <td>{formatearNumero(linea.unidades)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <p style={{ marginTop: "12px", fontWeight: "bold" }}>
              Total: {pedido.totalLineas} líneas · {formatearNumero(pedido.totalCajas)} cajas ·{" "}
              {formatearNumero(pedido.totalUnidades)} unidades
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const contenedor = { display: "flex", flexDirection: "column", gap: "14px" };

const cabecera = { display: "flex", justifyContent: "space-between", alignItems: "flex-start" };

const titulo = { margin: 0, fontSize: "20px", color: "#111827" };

const subtitulo = { margin: "4px 0 0", color: "#6b7280", fontSize: "13px" };

const avisoNavegador = {
  padding: "10px 14px",
  borderRadius: "10px",
  background: "#fef3c7",
  color: "#92400e",
  fontSize: "13px",
  fontWeight: 600,
};

const bloqueCarpeta = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  padding: "10px 14px",
  borderRadius: "12px",
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};

const carpetaOk = { color: "#166534", fontWeight: 700, fontSize: "13px" };
const carpetaAviso = { color: "#92400e", fontWeight: 700, fontSize: "13px" };

const filtrosFecha = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" };

const separadorFecha = { width: "1px", height: "24px", background: "#e5e7eb" };

const etiquetaFecha = {
  display: "flex",
  flexDirection: "column",
  fontSize: "11px",
  color: "#6b7280",
  gap: "2px",
};

const inputFecha = {
  padding: "6px 8px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "13px",
};

const filtrosEstado = { display: "flex", gap: "8px" };

const botonFiltro = (activo) => ({
  padding: "7px 14px",
  borderRadius: "999px",
  border: activo ? "1px solid #2563eb" : "1px solid #d1d5db",
  background: activo ? "#2563eb" : "#ffffff",
  color: activo ? "#ffffff" : "#374151",
  fontWeight: 700,
  fontSize: "12px",
  cursor: "pointer",
});

const cajaError = {
  padding: "10px 14px",
  borderRadius: "10px",
  background: "#fee2e2",
  color: "#991b1b",
  fontSize: "13px",
  fontWeight: 600,
};

const cajaExito = {
  padding: "10px 14px",
  borderRadius: "10px",
  background: "#dcfce7",
  color: "#166534",
  fontSize: "13px",
  fontWeight: 600,
};

const barraAcciones = { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" };

const botonPrimario = {
  padding: "9px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

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

const avisoCarpetaFalta = {
  color: "#b91c1c",
  fontWeight: 800,
  fontSize: "12px",
};

const avisoModoTodasFechas = {
  padding: "10px 14px",
  borderRadius: "10px",
  background: "#eef2ff",
  color: "#3730a3",
  fontSize: "13px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const botonBorrar = (deshabilitado) => ({
  padding: "9px 16px",
  borderRadius: "10px",
  border: "1px solid #fca5a5",
  background: "#fef2f2",
  color: "#b91c1c",
  fontWeight: 700,
  fontSize: "13px",
  opacity: deshabilitado ? 0.5 : 1,
  cursor: deshabilitado ? "not-allowed" : "pointer",
});

const botonPrimario2 = (deshabilitado) => ({
  ...botonPrimario,
  opacity: deshabilitado ? 0.5 : 1,
  cursor: deshabilitado ? "not-allowed" : "pointer",
});

const botonSecundario2 = (deshabilitado) => ({
  ...botonSecundario,
  opacity: deshabilitado ? 0.5 : 1,
  cursor: deshabilitado ? "not-allowed" : "pointer",
});

const botonTexto = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "none",
  background: "transparent",
  color: "#2563eb",
  fontWeight: 700,
  fontSize: "12px",
  cursor: "pointer",
};

const textoCargando = { color: "#6b7280", fontSize: "13px" };

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
};

const tr = { borderBottom: "1px solid #f3f4f6" };

const td = { padding: "9px 12px", color: "#111827", whiteSpace: "nowrap" };

const estadoPendiente = { color: "#92400e", fontWeight: 700 };
const estadoExportado = { color: "#166534", fontWeight: 700 };
const estadoModificado = { color: "#b91c1c", fontWeight: 700 };

const overlayModal = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  zIndex: 1000,
};

const cajaModal = {
  background: "#ffffff",
  borderRadius: "14px",
  padding: "20px",
  maxWidth: "720px",
  width: "100%",
  maxHeight: "85vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const cabeceraModal = { display: "flex", justifyContent: "space-between", alignItems: "flex-start" };

const tituloModal = { margin: 0, fontSize: "18px", color: "#111827" };

const subtituloModal = { margin: "4px 0 0", color: "#6b7280", fontSize: "13px" };

const botonCerrarModal = {
  border: "none",
  background: "#f3f4f6",
  borderRadius: "8px",
  width: "30px",
  height: "30px",
  cursor: "pointer",
  fontWeight: 700,
  color: "#374151",
};

const piePresupuestoModal = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  flexWrap: "wrap",
  fontSize: "13px",
  fontWeight: 700,
  color: "#111827",
};
