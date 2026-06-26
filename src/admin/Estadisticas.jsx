import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

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

  if (ahora < corteHoy) {
    ahora.setDate(ahora.getDate() - 1);
  }

  return fechaLocalISO(ahora);
}

function sumarDias(fechaISO, dias) {
  const fecha = crearFechaLocal(fechaISO);
  fecha.setDate(fecha.getDate() + dias);
  return fechaLocalISO(fecha);
}

function inicioSemanaISO(fechaISO) {
  const fecha = crearFechaLocal(fechaISO);
  const diaSemana = fecha.getDay();
  const diferenciaLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  fecha.setDate(fecha.getDate() + diferenciaLunes);
  return fechaLocalISO(fecha);
}

function inicioMesISO(fechaISO) {
  const fecha = crearFechaLocal(fechaISO);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return "—";
  return crearFechaLocal(fechaISO).toLocaleDateString("es-ES");
}

function formatearNumero(valor) {
  return Number(valor || 0).toLocaleString("es-ES", {
    maximumFractionDigits: 2,
  });
}

function claveDiaEstadistico(createdAt) {
  const fecha = new Date(createdAt);
  const corte = new Date(fecha);
  corte.setHours(CORTE_HORA, CORTE_MINUTO, 0, 0);

  if (fecha < corte) {
    fecha.setDate(fecha.getDate() - 1);
  }

  return fechaLocalISO(fecha);
}

function obtenerMes(fechaISO) {
  return String(fechaISO || "").slice(0, 7);
}

function nombreMes(mesISO) {
  if (!mesISO) return "—";
  const [year, month] = mesISO.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-ES", {
    month: "short",
    year: "numeric",
  });
}

export default function Estadisticas() {
  const hoyEstadistico = diaEstadisticoActualISO();

  const [movimientos, setMovimientos] = useState([]);
  const [desde, setDesde] = useState(hoyEstadistico);
  const [hasta, setHasta] = useState(hoyEstadistico);
  const [periodoActivo, setPeriodoActivo] = useState("hoy");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarEstadisticas(hoyEstadistico, hoyEstadistico);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarEstadisticas(desdeFiltro = desde, hastaFiltro = hasta, periodo = periodoActivo) {
    setCargando(true);
    setError("");
    setPeriodoActivo(periodo);

    try {
      const inicio = inicioDiaEstadistico(desdeFiltro).toISOString();
      const fin = finDiaEstadistico(hastaFiltro).toISOString();

      const { data, error: movimientosError } = await supabase
        .from("estadisticas_movimientos")
        .select("id, created_at, codigo_articulo, nombre_articulo, departamento, cajas, unidades")
        .gte("created_at", inicio)
        .lt("created_at", fin)
        .order("created_at", { ascending: true });

      if (movimientosError) throw movimientosError;

      setMovimientos(data || []);
    } catch (err) {
      console.error("Error cargando estadísticas:", err);
      setError(err?.message || JSON.stringify(err));
    } finally {
      setCargando(false);
    }
  }

  function aplicarHoy() {
    const hoy = diaEstadisticoActualISO();
    setDesde(hoy);
    setHasta(hoy);
    cargarEstadisticas(hoy, hoy, "hoy");
  }

  function aplicarAyer() {
    const ayer = sumarDias(diaEstadisticoActualISO(), -1);
    setDesde(ayer);
    setHasta(ayer);
    cargarEstadisticas(ayer, ayer, "ayer");
  }

  function aplicarSemana() {
    const hoy = diaEstadisticoActualISO();
    const inicio = inicioSemanaISO(hoy);
    setDesde(inicio);
    setHasta(hoy);
    cargarEstadisticas(inicio, hoy, "semana");
  }

  function aplicarMes() {
    const hoy = diaEstadisticoActualISO();
    const inicio = inicioMesISO(hoy);
    setDesde(inicio);
    setHasta(hoy);
    cargarEstadisticas(inicio, hoy, "mes");
  }

  function aplicarFiltroManual() {
    cargarEstadisticas(desde, hasta, "manual");
  }

  const resumen = useMemo(() => {
    const diasConPedido = new Set(movimientos.map((fila) => claveDiaEstadistico(fila.created_at)));
    const totalCajas = movimientos.reduce((total, fila) => total + Number(fila.cajas || 0), 0);
    const totalUnidades = movimientos.reduce((total, fila) => total + Number(fila.unidades || 0), 0);
    const articulosDistintos = new Set(
      movimientos.map((fila) => String(fila.codigo_articulo || fila.nombre_articulo || ""))
    ).size;

    return {
      totalLineas: movimientos.length,
      diasConPedido: diasConPedido.size,
      totalCajas,
      totalUnidades,
      articulosDistintos,
    };
  }, [movimientos]);

  const pedidosPorDia = useMemo(() => {
    const mapa = new Map();

    movimientos.forEach((fila) => {
      const dia = claveDiaEstadistico(fila.created_at);
      const actual = mapa.get(dia) || {
        fecha: dia,
        lineas: 0,
        cajas: 0,
        unidades: 0,
      };

      actual.lineas += 1;
      actual.cajas += Number(fila.cajas || 0);
      actual.unidades += Number(fila.unidades || 0);

      mapa.set(dia, actual);
    });

    return Array.from(mapa.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [movimientos]);

  const pedidosPorMes = useMemo(() => {
    const mapa = new Map();

    pedidosPorDia.forEach((fila) => {
      const mes = obtenerMes(fila.fecha);
      const actual = mapa.get(mes) || { mes, lineas: 0, cajas: 0, unidades: 0 };

      actual.lineas += fila.lineas;
      actual.cajas += fila.cajas;
      actual.unidades += fila.unidades;

      mapa.set(mes, actual);
    });

    return Array.from(mapa.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [pedidosPorDia]);

  const topCajas = useMemo(() => agruparArticulos(movimientos, "cajas").slice(0, 20), [movimientos]);
  const topUnidades = useMemo(() => agruparArticulos(movimientos, "unidades").slice(0, 20), [movimientos]);
  const topVecesPedido = useMemo(() => agruparArticulos(movimientos, "veces_pedido").slice(0, 20), [movimientos]);

  const departamentos = useMemo(() => {
    const mapa = new Map();

    movimientos.forEach((fila) => {
      const departamento = fila.departamento || "Sin departamento";
      const actual = mapa.get(departamento) || {
        departamento,
        cajas: 0,
        unidades: 0,
        veces_pedido: 0,
      };

      actual.cajas += Number(fila.cajas || 0);
      actual.unidades += Number(fila.unidades || 0);
      actual.veces_pedido += 1;

      mapa.set(departamento, actual);
    });

    return Array.from(mapa.values()).sort(
      (a, b) =>
        b.cajas + b.unidades + b.veces_pedido -
        (a.cajas + a.unidades + a.veces_pedido)
    );
  }, [movimientos]);

  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Administración</div>
          <h1 style={title}>📊 Estadísticas</h1>
          <p style={subtitle}>
            Día estadístico real: de 14:30 a 14:30. Hoy es {formatearFecha(hoyEstadistico)}.
          </p>
        </div>

        <button type="button" onClick={() => cargarEstadisticas(desde, hasta, periodoActivo)} style={refreshButton}>
          Actualizar
        </button>
      </section>

      {error && (
        <section style={errorBox}>
          <strong>Error cargando estadísticas</strong>
          <p>{error}</p>
        </section>
      )}

      <section style={filtersBox}>
        <div>
          <label style={label}>Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(event) => {
              setDesde(event.target.value);
              setPeriodoActivo("manual");
            }}
            style={input}
          />
        </div>

        <div>
          <label style={label}>Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(event) => {
              setHasta(event.target.value);
              setPeriodoActivo("manual");
            }}
            style={input}
          />
        </div>

        <div style={filterActions}>
          <button type="button" onClick={aplicarHoy} style={periodoActivo === "hoy" ? activeFilterButton : periodButton}>Hoy</button>
          <button type="button" onClick={aplicarAyer} style={periodoActivo === "ayer" ? activeFilterButton : periodButton}>Ayer</button>
          <button type="button" onClick={aplicarSemana} style={periodoActivo === "semana" ? activeFilterButton : periodButton}>Semana</button>
          <button type="button" onClick={aplicarMes} style={periodoActivo === "mes" ? activeFilterButton : periodButton}>Mes</button>
          <button type="button" onClick={aplicarFiltroManual} style={periodoActivo === "manual" ? activeApplyButton : applyButton}>
            Aplicar filtro
          </button>
        </div>
      </section>

      {cargando ? (
        <div style={loadingBox}>Cargando estadísticas...</div>
      ) : (
        <>
          <section style={statsGrid}>
            <StatCard label="Líneas pedidas" value={formatearNumero(resumen.totalLineas)} />
            <StatCard label="Cajas" value={formatearNumero(resumen.totalCajas)} />
            <StatCard label="Unidades" value={formatearNumero(resumen.totalUnidades)} />
            <StatCard label="Artículos distintos" value={formatearNumero(resumen.articulosDistintos)} />
          </section>

          <section style={noticeBox}>
            <strong>Importante:</strong> desde ahora los datos salen de movimientos reales con hora. Las estadísticas anteriores a este cambio no pueden reconstruirse con corte 14:30 exacto.
          </section>

          <section style={gridTwo}>
            <Panel title="Actividad por día" subtitle="Cada día va de 14:30 a 14:30">
              <MiniBarChart
                data={pedidosPorDia.map((fila) => ({
                  label: formatearFecha(fila.fecha),
                  value: Number(fila.lineas || 0),
                }))}
                valueLabel="líneas"
              />

              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Día estadístico</th>
                    <th style={thRight}>Líneas</th>
                    <th style={thRight}>Cajas</th>
                    <th style={thRight}>Unid.</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosPorDia.length === 0 ? (
                    <FilaVacia columnas={4} />
                  ) : (
                    pedidosPorDia.map((fila) => (
                      <tr key={fila.fecha}>
                        <td style={td}>{formatearFecha(fila.fecha)}</td>
                        <td style={tdRightStrong}>{formatearNumero(fila.lineas)}</td>
                        <td style={tdRight}>{formatearNumero(fila.cajas)}</td>
                        <td style={tdRight}>{formatearNumero(fila.unidades)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>

            <Panel title="Actividad por mes" subtitle="Agrupado por día estadístico">
              <MiniBarChart
                data={pedidosPorMes.map((fila) => ({
                  label: nombreMes(fila.mes),
                  value: Number(fila.lineas || 0),
                }))}
                valueLabel="líneas"
              />

              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Mes</th>
                    <th style={thRight}>Líneas</th>
                    <th style={thRight}>Cajas</th>
                    <th style={thRight}>Unid.</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosPorMes.length === 0 ? (
                    <FilaVacia columnas={4} />
                  ) : (
                    pedidosPorMes.map((fila) => (
                      <tr key={fila.mes}>
                        <td style={td}>{nombreMes(fila.mes)}</td>
                        <td style={tdRightStrong}>{formatearNumero(fila.lineas)}</td>
                        <td style={tdRight}>{formatearNumero(fila.cajas)}</td>
                        <td style={tdRight}>{formatearNumero(fila.unidades)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
          </section>

          <section style={gridTwo}>
            <Panel title="Departamentos" subtitle="Departamento con más movimiento">
              <MiniBarChart
                data={departamentos.slice(0, 10).map((fila) => ({
                  label: fila.departamento,
                  value: Number(fila.cajas || 0) + Number(fila.unidades || 0),
                }))}
                valueLabel="total"
              />

              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Departamento</th>
                    <th style={thRight}>Cajas</th>
                    <th style={thRight}>Unid.</th>
                    <th style={thRight}>Veces</th>
                  </tr>
                </thead>
                <tbody>
                  {departamentos.length === 0 ? (
                    <FilaVacia columnas={4} />
                  ) : (
                    departamentos.slice(0, 20).map((fila) => (
                      <tr key={fila.departamento}>
                        <td style={td}>{fila.departamento}</td>
                        <td style={tdRight}>{formatearNumero(fila.cajas)}</td>
                        <td style={tdRight}>{formatearNumero(fila.unidades)}</td>
                        <td style={tdRight}>{formatearNumero(fila.veces_pedido)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>

            <Panel title="Artículos que más se piden" subtitle="Veces que aparecen en pedidos">
              <MiniBarChart
                data={topVecesPedido.slice(0, 10).map((fila) => ({
                  label: fila.nombre_articulo,
                  value: Number(fila.veces_pedido || 0),
                }))}
                valueLabel="veces"
              />

              <TablaArticulos filas={topVecesPedido} campo="veces_pedido" etiqueta="Veces" />
            </Panel>
          </section>

          <Panel title="Artículos más vendidos por cajas" subtitle="Suma de cajas del periodo seleccionado">
            <MiniBarChart
              data={topCajas.slice(0, 10).map((fila) => ({
                label: fila.nombre_articulo,
                value: Number(fila.cajas || 0),
              }))}
              valueLabel="cajas"
            />

            <TablaArticulos filas={topCajas} campo="cajas" etiqueta="Cajas" />
          </Panel>

          <Panel title="Artículos más vendidos por unidades" subtitle="Suma de unidades del periodo seleccionado">
            <MiniBarChart
              data={topUnidades.slice(0, 10).map((fila) => ({
                label: fila.nombre_articulo,
                value: Number(fila.unidades || 0),
              }))}
              valueLabel="unidades"
            />

            <TablaArticulos filas={topUnidades} campo="unidades" etiqueta="Unidades" />
          </Panel>
        </>
      )}
    </div>
  );
}

function agruparArticulos(filas, campoOrden) {
  const mapa = new Map();

  filas.forEach((fila) => {
    const key = String(fila.codigo_articulo || fila.nombre_articulo || "");
    const actual = mapa.get(key) || {
      codigo_articulo: fila.codigo_articulo || "",
      nombre_articulo: fila.nombre_articulo || "Sin nombre",
      departamento: fila.departamento || "",
      cajas: 0,
      unidades: 0,
      veces_pedido: 0,
    };

    actual.cajas += Number(fila.cajas || 0);
    actual.unidades += Number(fila.unidades || 0);
    actual.veces_pedido += 1;

    mapa.set(key, actual);
  });

  return Array.from(mapa.values()).sort((a, b) => {
    const principal = Number(b[campoOrden] || 0) - Number(a[campoOrden] || 0);
    if (principal !== 0) return principal;

    return String(a.nombre_articulo || "").localeCompare(
      String(b.nombre_articulo || ""),
      "es",
      { sensitivity: "base" }
    );
  });
}

function StatCard({ label, value }) {
  return (
    <div style={statCard}>
      <div style={statValue}>{value}</div>
      <div style={statLabel}>{label}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section style={panel}>
      <div style={panelHeader}>
        <div>
          <h2 style={panelTitle}>{title}</h2>
          {subtitle && <p style={panelSubtitle}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function MiniBarChart({ data, valueLabel }) {
  const filas = (data || []).filter((fila) => Number(fila.value || 0) > 0).slice(0, 10);
  const max = Math.max(...filas.map((fila) => Number(fila.value || 0)), 0);

  if (!filas.length) {
    return <div style={chartEmpty}>Sin datos para gráfico</div>;
  }

  return (
    <div style={chartBox}>
      {filas.map((fila) => {
        const valor = Number(fila.value || 0);
        const width = max > 0 ? Math.max(6, (valor / max) * 100) : 0;

        return (
          <div key={fila.label} style={chartRow}>
            <div style={chartLabel} title={fila.label}>{fila.label}</div>
            <div style={chartTrack}>
              <div style={{ ...chartBar, width: `${width}%` }} />
            </div>
            <div style={chartValue}>
              {formatearNumero(valor)} {valueLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TablaArticulos({ filas, campo, etiqueta }) {
  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Artículo</th>
            <th style={th}>Departamento</th>
            <th style={thRight}>{etiqueta}</th>
            <th style={thRight}>Cajas</th>
            <th style={thRight}>Unid.</th>
            <th style={thRight}>Veces</th>
          </tr>
        </thead>

        <tbody>
          {filas.length === 0 ? (
            <FilaVacia columnas={6} />
          ) : (
            filas.map((fila) => (
              <tr key={`${fila.codigo_articulo}-${fila.nombre_articulo}`}>
                <td style={td}>
                  <strong>{fila.nombre_articulo}</strong>
                  <div style={smallText}>Código: {fila.codigo_articulo || "-"}</div>
                </td>
                <td style={td}>{fila.departamento || "—"}</td>
                <td style={tdRightStrong}>{formatearNumero(fila[campo])}</td>
                <td style={tdRight}>{formatearNumero(fila.cajas)}</td>
                <td style={tdRight}>{formatearNumero(fila.unidades)}</td>
                <td style={tdRight}>{formatearNumero(fila.veces_pedido)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function FilaVacia({ columnas }) {
  return (
    <tr>
      <td colSpan={columnas} style={emptyCell}>
        Sin datos en este periodo
      </td>
    </tr>
  );
}

const page = { minHeight: "100vh", padding: "24px", background: "linear-gradient(180deg, #eef2ff 0%, #f8fafc 38%, #ffffff 100%)", boxSizing: "border-box" };
const hero = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", background: "linear-gradient(135deg, #111827 0%, #1d4ed8 48%, #2563eb 100%)", borderRadius: "24px", padding: "28px", color: "#ffffff", boxShadow: "0 22px 45px rgba(37,99,235,0.22)", marginBottom: "18px" };
const eyebrow = { display: "inline-block", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "6px 12px", fontSize: "12px", fontWeight: "900", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "12px" };
const title = { margin: 0, fontSize: "34px", lineHeight: "1", fontWeight: "950" };
const subtitle = { margin: "10px 0 0", color: "#dbeafe", fontSize: "15px", maxWidth: "720px" };
const refreshButton = { background: "#22c55e", color: "#fff", border: "none", borderRadius: "16px", padding: "15px 22px", fontSize: "15px", fontWeight: "950", cursor: "pointer", boxShadow: "0 14px 26px rgba(34,197,94,0.28)", whiteSpace: "nowrap" };
const filtersBox = { display: "grid", gridTemplateColumns: "180px 180px 1fr", gap: "12px", alignItems: "end", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "16px", marginBottom: "18px", boxShadow: "0 10px 28px rgba(15,23,42,0.06)" };
const label = { display: "block", fontWeight: "900", marginBottom: "7px", color: "#334155", fontSize: "13px" };
const input = { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #d1d5db", borderRadius: "13px", fontSize: "14px", outline: "none", background: "#ffffff" };
const filterActions = { display: "flex", gap: "8px", flexWrap: "wrap" };
const periodButton = { background: "#eff6ff", color: "#1d4ed8", border: "none", borderRadius: "13px", padding: "12px 14px", fontWeight: "950", cursor: "pointer" };
const activeFilterButton = { ...periodButton, background: "#22c55e", color: "#ffffff", boxShadow: "0 10px 20px rgba(34,197,94,0.24)" };
const applyButton = { background: "#111827", color: "#ffffff", border: "none", borderRadius: "13px", padding: "12px 14px", fontWeight: "950", cursor: "pointer" };
const activeApplyButton = { ...applyButton, background: "#2563eb" };
const statsGrid = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px", marginBottom: "18px" };
const statCard = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "18px", padding: "16px", boxShadow: "0 10px 28px rgba(15,23,42,0.06)" };
const statValue = { fontSize: "28px", fontWeight: "950", color: "#111827", lineHeight: "1" };
const statLabel = { marginTop: "8px", fontSize: "12px", fontWeight: "850", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" };
const noticeBox = { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: "16px", padding: "13px 15px", marginBottom: "18px", fontSize: "13px" };
const gridTwo = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" };
const panel = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "22px", padding: "16px", boxShadow: "0 14px 35px rgba(15,23,42,0.07)", marginBottom: "18px" };
const panelHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", marginBottom: "14px" };
const panelTitle = { margin: 0, color: "#111827", fontSize: "20px", fontWeight: "950" };
const panelSubtitle = { margin: "5px 0 0", color: "#64748b", fontSize: "13px" };
const tableWrap = { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "18px", background: "#fff" };
const table = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };
const th = { background: "#f8fafc", color: "#475569", textAlign: "left", padding: "13px 14px", fontSize: "12px", fontWeight: "950", borderBottom: "1px solid #e5e7eb", textTransform: "uppercase", whiteSpace: "nowrap" };
const thRight = { ...th, textAlign: "right" };
const td = { padding: "13px 14px", verticalAlign: "middle", fontSize: "14px", borderBottom: "1px solid #f1f5f9" };
const tdRight = { ...td, textAlign: "right", whiteSpace: "nowrap" };
const tdRightStrong = { ...tdRight, fontWeight: "950", color: "#1d4ed8" };
const emptyCell = { textAlign: "center", padding: "30px", color: "#94a3b8", fontWeight: "800" };
const smallText = { marginTop: "4px", color: "#64748b", fontSize: "12px" };
const chartBox = { border: "1px solid #e5e7eb", borderRadius: "16px", padding: "12px", marginBottom: "14px", background: "#f8fafc" };
const chartRow = { display: "grid", gridTemplateColumns: "160px 1fr 90px", gap: "10px", alignItems: "center", marginBottom: "8px" };
const chartLabel = { fontSize: "12px", fontWeight: "850", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const chartTrack = { height: "11px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" };
const chartBar = { height: "100%", background: "linear-gradient(90deg, #1d4ed8, #60a5fa)", borderRadius: "999px" };
const chartValue = { textAlign: "right", fontSize: "11px", fontWeight: "950", color: "#1e293b" };
const chartEmpty = { border: "1px dashed #cbd5e1", borderRadius: "16px", padding: "20px", color: "#94a3b8", fontWeight: "850", textAlign: "center", marginBottom: "14px" };
const loadingBox = { padding: "30px", textAlign: "center", color: "#64748b", fontWeight: "900", background: "#ffffff", borderRadius: "16px" };
const errorBox = { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", padding: "16px", borderRadius: "18px", marginBottom: "18px" };
