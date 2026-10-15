import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { usePremiosBingo } from "./PremiosBingo";

// Regalos ganados en los juegos (Bingo + LojoPoly).
//
// · Pestañas Pendientes (por defecto) / Entregados / Todos.
// · Se usa en el Admin de Almacén ("Pedidos recibidos" → 🎁 Regalos) y en el
//   Admin de administradores (menú 🎁 Regalos).
// · Solo en el Admin de administradores sale además la pestaña "Valoración":
//   lista imprimible de los regalos ENTREGADOS para pasarlos al programa de
//   gestión, y marca de Valorado / No valorado (migracion_regalos.sql).

const REFRESCO_RESPALDO_MS = 60 * 1000;

const normalizar = (t) =>
  String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

function fechaHora(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function soloFecha(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}
// YYYY-MM-DD en hora local (para los filtros de fecha)
function diaLocal(valor) {
  const d = new Date(valor);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const cantidadTexto = (n) => {
  const v = Number(n ?? 1);
  return Number.isInteger(v) ? String(v) : v.toLocaleString("es-ES");
};

const ETIQUETA_LOJOPOLY = {
  suerte: "SUERTE",
  suerte_grande: "SUERTE GRANDE",
  caja: "CAJA LOJO",
};

/**
 * Hook compartido: regalos de Bingo + LojoPoly en una sola lista.
 */
export function useRegalos({ avisarConSonido = false } = {}) {
  const bingo = usePremiosBingo({ avisarConSonido });
  const [lojopoly, setLojopoly] = useState([]);
  const [lojopolyDisponible, setLojopolyDisponible] = useState(true);
  const [cargandoLojopoly, setCargandoLojopoly] = useState(false);
  const [clientesBingo, setClientesBingo] = useState(() => new Map());
  const montado = useRef(true);

  const cargarLojopoly = useCallback(async () => {
    setCargandoLojopoly(true);
    const { data, error } = await supabase.rpc("admin_listar_regalos_lojopoly");
    if (!montado.current) return;
    if (error) {
      console.warn("Regalos de LojoPoly no disponibles:", error);
      setLojopolyDisponible(false);
    } else {
      setLojopolyDisponible(true);
      setLojopoly(data || []);
    }
    setCargandoLojopoly(false);
  }, []);

  useEffect(() => {
    montado.current = true;
    cargarLojopoly();
    const intervalo = setInterval(cargarLojopoly, REFRESCO_RESPALDO_MS);
    return () => {
      montado.current = false;
      clearInterval(intervalo);
    };
  }, [cargarLojopoly]);

  // Cuando en caja se gana un premio (de Bingo o de LojoPoly) llega el aviso
  // por el canal de premios: se recarga también LojoPoly.
  useEffect(() => {
    if (!bingo.ultimoAviso) return undefined;
    const t = setTimeout(cargarLojopoly, 900);
    return () => clearTimeout(t);
  }, [bingo.ultimoAviso, cargarLojopoly]);

  // Código Lojo de los clientes de Bingo (la lista de Bingo solo trae el token)
  const tokensBingo = useMemo(
    () => [...new Set(bingo.regalos.map((r) => r.customer_token).filter(Boolean))].sort().join(","),
    [bingo.regalos]
  );
  useEffect(() => {
    if (!tokensBingo) return;
    let cancelado = false;
    supabase.rpc("admin_clientes_por_token", { p_tokens: tokensBingo.split(",") }).then(({ data, error }) => {
      if (cancelado || error) return;
      setClientesBingo(new Map((data || []).map((c) => [String(c.token), c])));
    });
    return () => {
      cancelado = true;
    };
  }, [tokensBingo]);

  const regalos = useMemo(() => {
    const lista = [];
    bingo.regalos.forEach((r) => {
      const cliente = clientesBingo.get(String(r.customer_token || ""));
      lista.push({
        id: `bingo:${r.clave}|${r.tipo}`,
        origen: "bingo",
        clave: `${r.clave}|${r.tipo}`,
        juego: "Bingo",
        clienteNombre: r.customer_name || cliente?.nombre || "",
        clienteToken: r.customer_token || "",
        codigoLojo: cliente?.codigo_lojo || "",
        etiqueta: r.etiqueta,
        especial: r.especial,
        detalle: r.ronda ? `Cartón nº ${r.ronda}` : "",
        regalo: r.regalo || r.articulo?.nombre || "",
        articulo: r.articulo || null,
        cantidad: 1,
        ganadoEn: r.ultima_bola_en,
        entregadoEn: r.entregadoEn,
        estado: r.entregadoEn ? "entregado" : "pendiente",
        editable: bingo.entregasDisponibles,
        original: r,
      });
    });
    lojopoly.forEach((p) => {
      const etiqueta =
        p.tipo === "grupo"
          ? `GRUPO ${String(p.grupo_nombre || "").toUpperCase()}`.trim()
          : ETIQUETA_LOJOPOLY[p.tipo_casilla] || "PREMIO";
      lista.push({
        id: `lojopoly:${p.id}`,
        origen: "lojopoly",
        clave: String(p.id),
        juego: "LojoPoly",
        clienteNombre: p.cliente_nombre || "",
        clienteToken: p.cliente_token || "",
        codigoLojo: p.cliente_codigo_lojo || "",
        etiqueta,
        grupoColor: p.tipo === "grupo" ? p.grupo_color : null,
        detalle: p.caduca_el ? `Recoger antes del ${soloFecha(`${p.caduca_el}T12:00:00`)}` : "",
        regalo: p.texto || p.articulo_nombre || "",
        articulo: p.articulo_id ? { id: p.articulo_id, codigo: p.articulo_codigo || "", nombre: p.articulo_nombre || "" } : null,
        cantidad: Number(p.cantidad ?? 1),
        ganadoEn: p.ganado_at,
        entregadoEn: p.estado === "entregado" ? p.entregado_at : null,
        estado: p.estado,
        editable: true,
        original: p,
      });
    });
    const orden = { pendiente: 0, entregado: 1, caducado: 2 };
    lista.sort((a, b) => {
      if (orden[a.estado] !== orden[b.estado]) return (orden[a.estado] ?? 3) - (orden[b.estado] ?? 3);
      return new Date(b.ganadoEn || 0) - new Date(a.ganadoEn || 0);
    });
    return lista;
  }, [bingo.regalos, bingo.entregasDisponibles, lojopoly, clientesBingo]);

  const pendientes = useMemo(() => regalos.filter((r) => r.estado === "pendiente" && r.editable), [regalos]);

  const cargar = useCallback(async () => {
    await Promise.all([bingo.cargar(), cargarLojopoly()]);
  }, [bingo, cargarLojopoly]);

  const marcarEntregado = useCallback(
    async (regalo, entregado) => {
      if (regalo.origen === "bingo") {
        await bingo.marcarEntregado(regalo.original, entregado);
        return;
      }
      const { error } = await supabase.rpc("admin_marcar_premio_lojopoly", {
        p_premio_id: regalo.clave,
        p_estado: entregado ? "entregado" : "pendiente",
      });
      if (error) throw error;
      const ahora = new Date().toISOString();
      setLojopoly((prev) =>
        prev.map((p) =>
          String(p.id) === regalo.clave
            ? { ...p, estado: entregado ? "entregado" : "pendiente", entregado_at: entregado ? ahora : null }
            : p
        )
      );
    },
    [bingo]
  );

  return {
    regalos,
    pendientes,
    // Compatibilidad con el aviso parpadeante de "Pedidos recibidos"
    entregasDisponibles: bingo.entregasDisponibles || lojopolyDisponible,
    bingoDisponible: bingo.entregasDisponibles,
    lojopolyDisponible,
    cargando: bingo.cargando || cargandoLojopoly,
    error: bingo.error,
    cargar,
    marcarEntregado,
    ultimoAviso: bingo.ultimoAviso,
  };
}

// Menú del Admin de administradores: carga sus propios datos y añade la
// pestaña de Valoración.
export default function Regalos() {
  const datos = useRegalos({ avisarConSonido: false });
  return <RegalosVista datos={datos} conValoracion />;
}

export function RegalosVista({ datos, modoAlmacen = false, conValoracion = false }) {
  const { regalos, bingoDisponible, lojopolyDisponible, cargando, error, cargar, marcarEntregado, ultimoAviso } = datos;

  const [vista, setVista] = useState("pendientes");
  const [busqueda, setBusqueda] = useState("");
  const [juego, setJuego] = useState("todos");
  const [guardando, setGuardando] = useState(() => new Set());
  const [errorGuardar, setErrorGuardar] = useState("");

  const porJuego = useMemo(
    () => regalos.filter((r) => juego === "todos" || r.origen === juego),
    [regalos, juego]
  );

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return porJuego.filter((r) => {
      if (vista === "pendientes" && r.estado !== "pendiente") return false;
      if (vista === "entregados" && r.estado !== "entregado") return false;
      if (!q) return true;
      return (
        normalizar(r.clienteNombre).includes(q) ||
        normalizar(r.clienteToken).includes(q) ||
        normalizar(r.codigoLojo).includes(q) ||
        normalizar(r.regalo).includes(q)
      );
    });
  }, [porJuego, busqueda, vista]);

  const totalPendientes = porJuego.filter((r) => r.estado === "pendiente").length;
  const totalEntregados = porJuego.filter((r) => r.estado === "entregado").length;

  async function cambiarEntrega(regalo, entregado) {
    if (!entregado) {
      const ok = window.confirm(
        `¿Quitar la marca de entregado a ${regalo.clienteNombre || "este cliente"} (${regalo.juego} · ${regalo.etiqueta})?`
      );
      if (!ok) return;
    }
    setErrorGuardar("");
    setGuardando((prev) => new Set(prev).add(regalo.id));
    try {
      await marcarEntregado(regalo, entregado);
    } catch (err) {
      console.error(err);
      setErrorGuardar("No se pudo guardar la entrega. Vuelve a intentarlo.");
    } finally {
      setGuardando((prev) => {
        const nuevo = new Set(prev);
        nuevo.delete(regalo.id);
        return nuevo;
      });
    }
  }

  async function marcarTodosMostrados() {
    const lista = filtrados.filter((r) => r.estado === "pendiente" && r.editable);
    if (!lista.length) return;
    const ok = window.confirm(`¿Marcar como ENTREGADOS los ${lista.length} regalo(s) pendientes que se ven en la lista?`);
    if (!ok) return;
    setErrorGuardar("");
    try {
      for (const regalo of lista) await marcarEntregado(regalo, true);
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
          <h2 style={titulo}>🎁 Regalos</h2>
          <p style={subtitulo}>
            Regalos que han ganado los clientes en el Bingo y en LojoPoly. Marca la casilla cuando se lo
            hayas dado.
          </p>
        </div>
        <div style={acciones}>
          <input
            type="text"
            placeholder="Buscar cliente, código o regalo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={inputBusqueda}
          />
          <select value={juego} onChange={(e) => setJuego(e.target.value)} style={selectJuego} aria-label="Juego">
            <option value="todos">Todos los juegos</option>
            <option value="bingo">🎱 Bingo</option>
            <option value="lojopoly">🎲 LojoPoly</option>
          </select>
          <button type="button" onClick={cargar} disabled={cargando} style={botonOscuro}>
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
          ⏳ Pendientes ({totalPendientes})
        </button>
        <button type="button" style={botonVista(vista === "entregados", "#16a34a")} onClick={() => setVista("entregados")}>
          ✅ Entregados ({totalEntregados})
        </button>
        <button type="button" style={botonVista(vista === "todos", "#0f172a")} onClick={() => setVista("todos")}>
          Todos ({porJuego.length})
        </button>
        {conValoracion && (
          <button type="button" style={botonVista(vista === "valoracion", "#7c3aed")} onClick={() => setVista("valoracion")}>
            💶 Valoración
          </button>
        )}
        {vista !== "valoracion" &&
          vista !== "entregados" &&
          filtrados.some((r) => r.estado === "pendiente" && r.editable) && (
            <button type="button" style={botonMarcarTodos} onClick={marcarTodosMostrados}>
              ✔ Marcar todos los mostrados como entregados
            </button>
          )}
      </div>

      {!bingoDisponible && (
        <div style={cajaAviso}>
          Para marcar los regalos del Bingo hay que ejecutar en Supabase <strong>migracion_premios_bingo_entregas.sql</strong>.
        </div>
      )}
      {!lojopolyDisponible && (
        <div style={cajaAviso}>
          Para ver los regalos de LojoPoly hay que ejecutar en Supabase <strong>migracion_regalos.sql</strong>.
        </div>
      )}
      {error && <div style={cajaError}>{error}</div>}
      {errorGuardar && <div style={cajaError}>{errorGuardar}</div>}

      {vista === "valoracion" ? (
        <ValoracionRegalos regalos={porJuego} busqueda={busqueda} />
      ) : (
        <>
          {!cargando && filtrados.length === 0 && (
            <div style={cajaVacia}>
              {vista === "pendientes" ? "No hay ningún regalo pendiente de entregar. 👍" : "No hay regalos que mostrar."}
            </div>
          )}

          {filtrados.length > 0 && (
            <div style={tablaContenedor}>
              <table style={tabla}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 130, textAlign: "center" }}>Entregado</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Juego</th>
                    <th style={th}>Regalo</th>
                    <th style={th}>Ganado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((r) => {
                    const entregado = r.estado === "entregado";
                    const caducado = r.estado === "caducado";
                    const ocupado = guardando.has(r.id);
                    const deshabilitado = !r.editable || ocupado || caducado;
                    return (
                      <tr key={r.id} style={{ background: entregado ? "#f0fdf4" : caducado ? "#f8fafc" : "#fff7ed" }}>
                        <td style={{ ...td, textAlign: "center" }}>
                          {caducado ? (
                            <span style={{ ...badge("gris"), fontSize: 11 }}>CADUCADO</span>
                          ) : (
                            <label style={etiquetaCheck(entregado, deshabilitado)}>
                              <input
                                type="checkbox"
                                checked={entregado}
                                disabled={deshabilitado}
                                onChange={(e) => cambiarEntrega(r, e.target.checked)}
                                style={checkGrande}
                              />
                              <span style={{ fontSize: 11, fontWeight: 800 }}>
                                {ocupado ? "Guardando…" : entregado ? "ENTREGADO" : "PENDIENTE"}
                              </span>
                              {entregado && <span style={{ fontSize: 11, color: "#15803d" }}>{fechaHora(r.entregadoEn)}</span>}
                            </label>
                          )}
                        </td>
                        <td style={td}>
                          <strong style={{ fontSize: modoAlmacen ? 16 : 14 }}>{r.clienteNombre || "Cliente sin nombre"}</strong>
                          <div style={textoPequeno}>
                            {r.codigoLojo ? `Cód. Lojo ${r.codigoLojo}` : r.clienteToken}
                            {r.detalle ? ` · ${r.detalle}` : ""}
                          </div>
                        </td>
                        <td style={td}>
                          <span style={badge(r.origen === "bingo" ? "azul" : "verde")}>
                            {r.origen === "bingo" ? "🎱 Bingo" : "🎲 LojoPoly"}
                          </span>
                        </td>
                        <td style={td}>
                          <span style={r.grupoColor ? { ...badge("gris"), background: r.grupoColor, color: "#fff" } : badge(r.especial ? "dorado" : "rojo")}>
                            {r.etiqueta}
                          </span>
                          {r.regalo && (
                            <div style={textoRegalo}>
                              🎁 {r.cantidad !== 1 ? `${cantidadTexto(r.cantidad)} × ` : ""}
                              {r.regalo}
                            </div>
                          )}
                        </td>
                        <td style={td}>{fechaHora(r.ganadoEn)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Valoración (solo Admin de administradores)
// ---------------------------------------------------------------------
function ValoracionRegalos({ regalos, busqueda }) {
  const [valorados, setValorados] = useState(() => new Map());
  const [disponible, setDisponible] = useState(true);
  const [filtro, setFiltro] = useState("no");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("admin_listar_regalos_valorados");
    if (err) {
      console.warn("Valoración no disponible:", err);
      setDisponible(false);
      return;
    }
    setDisponible(true);
    setValorados(new Map((data || []).map((v) => [`${v.origen}:${v.clave}`, v.valorado_at])));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Solo se valoran los regalos ya ENTREGADOS
  const entregados = useMemo(
    () =>
      regalos
        .filter((r) => r.estado === "entregado" && r.entregadoEn)
        .map((r) => ({ ...r, valoradoEn: valorados.get(r.id) || null }))
        .sort((a, b) => new Date(a.entregadoEn) - new Date(b.entregadoEn)),
    [regalos, valorados]
  );

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    return entregados.filter((r) => {
      if (filtro === "no" && r.valoradoEn) return false;
      if (filtro === "si" && !r.valoradoEn) return false;
      const dia = diaLocal(r.entregadoEn);
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;
      if (!q) return true;
      return (
        normalizar(r.clienteNombre).includes(q) ||
        normalizar(r.codigoLojo).includes(q) ||
        normalizar(r.regalo).includes(q) ||
        normalizar(r.articulo?.codigo).includes(q)
      );
    });
  }, [entregados, filtro, desde, hasta, busqueda]);

  // Al cambiar los filtros, la selección se queda solo con lo que se ve
  useEffect(() => {
    setSeleccion((prev) => {
      const ids = new Set(visibles.map((r) => r.id));
      const nuevo = new Set([...prev].filter((id) => ids.has(id)));
      return nuevo.size === prev.size ? prev : nuevo;
    });
  }, [visibles]);

  const cuentaNo = entregados.filter((r) => !r.valoradoEn).length;
  const cuentaSi = entregados.length - cuentaNo;
  const todosMarcados = visibles.length > 0 && visibles.every((r) => seleccion.has(r.id));
  const seleccionados = visibles.filter((r) => seleccion.has(r.id));
  const sinArticulo = visibles.filter((r) => !r.articulo).length;

  function alternar(id) {
    setSeleccion((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }
  function alternarTodos() {
    setSeleccion(todosMarcados ? new Set() : new Set(visibles.map((r) => r.id)));
  }

  async function marcar(valorado) {
    const lista = seleccionados.filter((r) => Boolean(r.valoradoEn) !== valorado);
    if (!lista.length) return;
    setError("");
    setMensaje("");
    setOcupado(true);
    const { error: err } = await supabase.rpc("admin_marcar_regalos_valorados", {
      p_items: lista.map((r) => ({ origen: r.origen, clave: r.clave })),
      p_valorado: valorado,
    });
    setOcupado(false);
    if (err) {
      setError(`No se ha podido guardar: ${err.message}`);
      return;
    }
    setMensaje(`${lista.length} regalo(s) marcados como ${valorado ? "VALORADOS" : "NO VALORADOS"}.`);
    setSeleccion(new Set());
    cargar();
  }

  function imprimir() {
    const lista = seleccionados.length ? seleccionados : visibles;
    if (!lista.length) return;
    const ventana = window.open("", "_blank");
    if (!ventana) {
      setError("El navegador ha bloqueado la ventana de impresión. Permite las ventanas emergentes para esta página.");
      return;
    }
    ventana.document.write(htmlListado(lista, { filtro, desde, hasta }));
    ventana.document.close();
    ventana.focus();
    setTimeout(() => ventana.print(), 300);
  }

  if (!disponible) {
    return (
      <div style={cajaAviso}>
        Para la valoración de regalos hay que ejecutar en Supabase <strong>migracion_regalos.sql</strong>.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ ...subtitulo, margin: 0 }}>
        Regalos ya <strong>entregados</strong>, para facturarlos en el programa de gestión. Cuando los hayas pasado,
        selecciónalos y márcalos como <strong>Valorados</strong>.
      </p>

      <div style={barraFiltros}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={botonVista(filtro === "no", "#dc2626")} onClick={() => setFiltro("no")}>
            No valorados ({cuentaNo})
          </button>
          <button type="button" style={botonVista(filtro === "si", "#16a34a")} onClick={() => setFiltro("si")}>
            Valorados ({cuentaSi})
          </button>
          <button type="button" style={botonVista(filtro === "todos", "#0f172a")} onClick={() => setFiltro("todos")}>
            Todos ({entregados.length})
          </button>
        </div>
        <label style={campoFecha}>
          Entregados desde
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} style={inputFecha} />
        </label>
        <label style={campoFecha}>
          hasta
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} style={inputFecha} />
        </label>
        {(desde || hasta) && (
          <button type="button" style={botonClaro} onClick={() => { setDesde(""); setHasta(""); }}>
            Quitar fechas
          </button>
        )}
      </div>

      <div style={barraFiltros}>
        <button type="button" style={botonOscuro} onClick={imprimir} disabled={!visibles.length}>
          🖨️ Imprimir listado {seleccionados.length ? `(${seleccionados.length} seleccionados)` : `(${visibles.length})`}
        </button>
        <button
          type="button"
          style={botonAccion("#16a34a")}
          disabled={ocupado || !seleccionados.some((r) => !r.valoradoEn)}
          onClick={() => marcar(true)}
        >
          ✔ Marcar como Valorados
        </button>
        <button
          type="button"
          style={botonAccion("#dc2626")}
          disabled={ocupado || !seleccionados.some((r) => r.valoradoEn)}
          onClick={() => marcar(false)}
        >
          ↩ Marcar como No valorados
        </button>
        <span style={textoPequeno}>{seleccionados.length} seleccionado(s)</span>
      </div>

      {sinArticulo > 0 && (
        <div style={cajaAviso}>
          ⚠️ {sinArticulo} regalo(s) de la lista no tienen artículo asignado. Asígnalo en la configuración del juego
          (premio del Bingo, o premio del grupo / casillas especiales de LojoPoly) para que salga el código.
        </div>
      )}
      {error && <div style={cajaError}>{error}</div>}
      {mensaje && <div style={cajaOk}>{mensaje}</div>}

      {visibles.length === 0 ? (
        <div style={cajaVacia}>
          {filtro === "no" ? "No hay regalos entregados pendientes de valorar. 👍" : "No hay regalos con estos filtros."}
        </div>
      ) : (
        <div style={tablaContenedor}>
          <table style={tabla}>
            <thead>
              <tr>
                <th style={{ ...th, width: 44, textAlign: "center" }}>
                  <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} style={checkMediano} aria-label="Seleccionar todos" />
                </th>
                <th style={th}>Entregado</th>
                <th style={th}>Cliente</th>
                <th style={th}>Juego</th>
                <th style={th}>Código</th>
                <th style={th}>Artículo</th>
                <th style={{ ...th, textAlign: "right" }}>Cant.</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => (
                <tr key={r.id} style={{ background: seleccion.has(r.id) ? "#f5f3ff" : "#fff", cursor: "pointer" }} onClick={() => alternar(r.id)}>
                  <td style={{ ...td, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={seleccion.has(r.id)}
                      onChange={() => alternar(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={checkMediano}
                    />
                  </td>
                  <td style={td}>{fechaHora(r.entregadoEn)}</td>
                  <td style={td}>
                    <strong>{r.clienteNombre || "—"}</strong>
                    <div style={textoPequeno}>{r.codigoLojo ? `Cód. Lojo ${r.codigoLojo}` : r.clienteToken}</div>
                  </td>
                  <td style={td}>
                    {r.juego}
                    <div style={textoPequeno}>{r.etiqueta}</div>
                  </td>
                  <td style={{ ...td, fontWeight: 800 }}>{r.articulo?.codigo || "—"}</td>
                  <td style={td}>
                    {r.articulo?.nombre || r.regalo || "—"}
                    {!r.articulo && <div style={{ ...textoPequeno, color: "#b45309" }}>⚠️ Sin artículo asignado</div>}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{cantidadTexto(r.cantidad)}</td>
                  <td style={td}>
                    {r.valoradoEn ? (
                      <>
                        <span style={badge("verde")}>VALORADO</span>
                        <div style={textoPequeno}>{fechaHora(r.valoradoEn)}</div>
                      </>
                    ) : (
                      <span style={badge("rojo")}>NO VALORADO</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const escapar = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function htmlListado(lista, { filtro, desde, hasta }) {
  const tituloListado =
    filtro === "no" ? "Regalos NO valorados" : filtro === "si" ? "Regalos valorados" : "Regalos entregados";
  const periodo =
    desde || hasta
      ? `Entregados ${desde ? `desde el ${soloFecha(`${desde}T12:00:00`)}` : ""} ${hasta ? `hasta el ${soloFecha(`${hasta}T12:00:00`)}` : ""}`
      : "Todas las fechas";

  // Resumen por artículo (lo que hay que facturar)
  const resumen = new Map();
  lista.forEach((r) => {
    const k = r.articulo ? `a:${r.articulo.id}` : `t:${r.regalo}`;
    const actual = resumen.get(k) || {
      codigo: r.articulo?.codigo || "",
      nombre: r.articulo?.nombre || r.regalo || "(sin artículo)",
      sinArticulo: !r.articulo,
      cantidad: 0,
      regalos: 0,
    };
    actual.cantidad += Number(r.cantidad ?? 1);
    actual.regalos += 1;
    resumen.set(k, actual);
  });
  const filasResumen = [...resumen.values()]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map(
      (a) => `<tr><td class="cod">${escapar(a.codigo || "—")}</td><td>${escapar(a.nombre)}${a.sinArticulo ? ' <span class="aviso">(sin artículo)</span>' : ""}</td><td class="num">${a.regalos}</td><td class="num">${escapar(cantidadTexto(a.cantidad))}</td></tr>`
    )
    .join("");
  const totalUnidades = [...resumen.values()].reduce((s, a) => s + a.cantidad, 0);

  const filas = lista
    .map(
      (r) => `<tr>
        <td>${escapar(fechaHora(r.entregadoEn))}</td>
        <td>${escapar(r.codigoLojo || "")}</td>
        <td>${escapar(r.clienteNombre || "")}</td>
        <td>${escapar(r.juego)} · ${escapar(r.etiqueta)}</td>
        <td class="cod">${escapar(r.articulo?.codigo || "—")}</td>
        <td>${escapar(r.articulo?.nombre || r.regalo || "—")}</td>
        <td class="num">${escapar(cantidadTexto(r.cantidad))}</td>
        <td>${r.valoradoEn ? "Valorado" : "No valorado"}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(tituloListado)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:22px 0 6px}
  .sub{color:#555;margin:0 0 14px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #bbb;padding:5px 7px;text-align:left;vertical-align:top}
  th{background:#eee;font-size:11px;text-transform:uppercase}
  .num{text-align:right;white-space:nowrap} .cod{font-weight:bold;white-space:nowrap}
  .aviso{color:#b45309;font-size:11px}
  tfoot td{font-weight:bold;background:#f6f6f6}
  @media print{body{margin:10mm} button{display:none}}
</style></head><body>
<h1>Cash Lojo · ${escapar(tituloListado)}</h1>
<p class="sub">${escapar(periodo)} · ${lista.length} regalo(s) · Impreso el ${escapar(fechaHora(new Date().toISOString()))}</p>
<h2>Resumen por artículo</h2>
<table><thead><tr><th>Código</th><th>Artículo</th><th class="num">Regalos</th><th class="num">Unidades</th></tr></thead>
<tbody>${filasResumen}</tbody>
<tfoot><tr><td colspan="2">Total</td><td class="num">${lista.length}</td><td class="num">${escapar(cantidadTexto(totalUnidades))}</td></tr></tfoot></table>
<h2>Detalle</h2>
<table><thead><tr><th>Entregado</th><th>Cód. Lojo</th><th>Cliente</th><th>Juego</th><th>Código</th><th>Artículo</th><th class="num">Cant.</th><th>Estado</th></tr></thead>
<tbody>${filas}</tbody></table>
</body></html>`;
}

const contenedor = { display: "flex", flexDirection: "column", gap: 16 };
const cabecera = { display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" };
const titulo = { margin: 0, fontSize: 22 };
const subtitulo = { margin: "4px 0 0", color: "#64748b", fontSize: 14, maxWidth: 720 };
const acciones = { display: "flex", gap: 10, flexWrap: "wrap" };
const inputBusqueda = { border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 14px", fontSize: 14, minWidth: 220 };
const selectJuego = { border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", fontSize: 14, background: "#fff" };
const botonOscuro = { border: "none", borderRadius: 10, background: "#0f172a", color: "#fff", padding: "10px 16px", fontWeight: 700, cursor: "pointer" };
const botonClaro = { border: "1px solid #cbd5e1", borderRadius: 10, background: "#fff", color: "#334155", padding: "8px 12px", fontWeight: 700, cursor: "pointer" };
const botonAccion = (color) => ({ border: `1px solid ${color}`, borderRadius: 10, background: "#fff", color, padding: "10px 14px", fontWeight: 800, cursor: "pointer" });
const barraVistas = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" };
const barraFiltros = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" };
const campoFecha = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#475569" };
const inputFecha = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 9px", fontSize: 14 };
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
const cajaError = { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: "12px 16px" };
const cajaOk = { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 12, padding: "12px 16px" };
const cajaAviso = { border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: 12, padding: "12px 16px" };
const cajaAvisoNuevo = {
  border: "2px solid #f59e0b",
  background: "linear-gradient(90deg, #fef3c7, #fde68a)",
  color: "#78350f",
  borderRadius: 14,
  padding: "14px 18px",
  fontSize: 17,
};
const cajaVacia = { border: "1px dashed #cbd5e1", borderRadius: 12, padding: "24px 16px", textAlign: "center", color: "#64748b" };
const tablaContenedor = { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 14 };
const tabla = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "12px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 13, color: "#475569" };
const td = { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle", fontSize: 14 };
const textoPequeno = { color: "#94a3b8", fontSize: 12, marginTop: 2 };
const textoRegalo = { marginTop: 6, fontSize: 13, fontWeight: 700, color: "#334155" };
const checkGrande = { width: 26, height: 26, cursor: "pointer", accentColor: "#16a34a" };
const checkMediano = { width: 20, height: 20, cursor: "pointer", accentColor: "#7c3aed" };
const etiquetaCheck = (entregado, deshabilitado) => ({
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  cursor: deshabilitado ? "not-allowed" : "pointer",
  color: entregado ? "#15803d" : "#c2410c",
});
function badge(tono) {
  const tonos = {
    gris: { bg: "#e2e8f0", color: "#334155" },
    azul: { bg: "#dbeafe", color: "#1d4ed8" },
    verde: { bg: "#dcfce7", color: "#166534" },
    rojo: { bg: "#fee2e2", color: "#b91c1c" },
    dorado: { bg: "#fef3c7", color: "#92400e" },
  };
  const e = tonos[tono] || tonos.gris;
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: e.bg,
    color: e.color,
    whiteSpace: "nowrap",
  };
}
