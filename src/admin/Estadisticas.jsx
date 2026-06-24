import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function fechaLocalISO(fecha = new Date()) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inicioMesISO() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
}

function inicioAnoISO() {
  return `${new Date().getFullYear()}-01-01`;
}

function formatearNumero(valor) {
  return Number(valor || 0).toLocaleString("es-ES", {
    maximumFractionDigits: 2,
  });
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [year, month, day] = String(fechaISO).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-ES");
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
  const [pedidosDia, setPedidosDia] = useState([]);
  const [articulosDia, setArticulosDia] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const [desde, setDesde] = useState(inicioMesISO());
  const [hasta, setHasta] = useState(fechaLocalISO());

  useEffect(() => {
    cargarEstadisticas(desde, hasta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarEstadisticas(desdeFiltro = desde, hastaFiltro = hasta) {
    setCargando(true);
    setError("");

    try {
      const { data: pedidosData, error: pedidosError } = await supabase
        .from("estadisticas_pedidos_dia")
        .select("fecha, total_pedidos")
        .gte("fecha", desdeFiltro)
        .lte("fecha", hastaFiltro)
        .order("fecha", { ascending: true });

      if (pedidosError) throw pedidosError;

      const { data: articulosData, error: articulosError } = await supabase
        .from("estadisticas_articulos_dia")
        .select(
          "fecha, articulo_id, codigo_articulo, nombre_articulo, departamento, cajas, unidades, veces_pedido"
        )
        .gte("fecha", desdeFiltro)
        .lte("fecha", hastaFiltro)
        .order("fecha", { ascending: true });

      if (articulosError) throw articulosError;

      setPedidosDia(pedidosData || []);
      setArticulosDia(articulosData || []);
    } catch (err) {
      console.error("Error cargando estadísticas:", err);
      setError(err?.message || JSON.stringify(err));
    } finally {
      setCargando(false);
    }
  }

  function aplicarHoy() {
    const hoy = fechaLocalISO();
    setDesde(hoy);
    setHasta(hoy);
    cargarEstadisticas(hoy, hoy);
  }

  function aplicarMes() {
    const inicio = inicioMesISO();
    const fin = fechaLocalISO();
    setDesde(inicio);
    setHasta(fin);
    cargarEstadisticas(inicio, fin);
  }

  function aplicarAno() {
    const inicio = inicioAnoISO();
    const fin = fechaLocalISO();
    setDesde(inicio);
    setHasta(fin);
    cargarEstadisticas(inicio, fin);
  }

  const resumen = useMemo(() => {
    const totalPedidos = pedidosDia.reduce(
      (total, fila) => total + Number(fila.total_pedidos || 0),
      0
    );

    const totalCajas = articulosDia.reduce(
      (total, fila) => total + Number(fila.cajas || 0),
      0
    );

    const totalUnidades = articulosDia.reduce(
      (total, fila) => total + Number(fila.unidades || 0),
      0
    );

    const articulosDistintos = new Set(
      articulosDia.map((fila) => String(fila.articulo_id || fila.codigo_articulo || ""))
    ).size;

    const departamentosDistintos = new Set(
      articulosDia.map((fila) => String(fila.departamento || "Sin departamento"))
    ).size;

    return {
      totalPedidos,
      totalCajas,
      totalUnidades,
      articulosDistintos,
      departamentosDistintos,
    };
  }, [pedidosDia, articulosDia]);

  const pedidosPorMes = useMemo(() => {
    const mapa = new Map();

    pedidosDia.forEach((fila) => {
      const mes = obtenerMes(fila.fecha);
      mapa.set(mes, (mapa.get(mes) || 0) + Number(fila.total_pedidos || 0));
    });

    return Array.from(mapa.entries())
      .map(([mes, total_pedidos]) => ({ mes, total_pedidos }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }, [pedidosDia]);

  const pedidosPorDia = useMemo(() => {
    return [...pedidosDia].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  }, [pedidosDia]);

  const topCajas = useMemo(() => {
    return agruparArticulos(articulosDia, "cajas").slice(0, 20);
  }, [articulosDia]);

  const topUnidades = useMemo(() => {
    return agruparArticulos(articulosDia, "unidades").slice(0, 20);
  }, [articulosDia]);

  const topVecesPedido = useMemo(() => {
    return agruparArticulos(articulosDia, "veces_pedido").slice(0, 20);
  }, [articulosDia]);

  const departamentos = useMemo(() => {
    const mapa = new Map();

    articulosDia.forEach((fila) => {
      const departamento = fila.departamento || "Sin departamento";
      const actual = mapa.get(departamento) || {
        departamento,
        cajas: 0,
        unidades: 0,
        veces_pedido: 0,
      };

      actual.cajas += Number(fila.cajas || 0);
      actual.unidades += Number(fila.unidades || 0);
      actual.veces_pedido += Number(fila.veces_pedido || 0);

      mapa.set(departamento, actual);
    });

    return Array.from(mapa.values()).sort(
      (a, b) =>
        b.cajas + b.unidades + b.veces_pedido -
        (a.cajas + a.unidades + a.veces_pedido)
    );
  }, [articulosDia]);

  const hayDatos = pedidosDia.length > 0 || articulosDia.length > 0;

  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Administración</div>
          <h1 style={title}>📊 Estadísticas</h1>
          <p style={subtitle}>
            Pedidos enviados por WhatsApp, artículos más vendidos y departamentos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => cargarEstadisticas(desde, hasta)}
          style={refreshButton}
        >
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
            onChange={(e) => setDesde(e.target.value)}
            style={input}
          />
        </div>

        <div>
          <label style={label}>Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            style={input}
          />
        </div>

        <div style={filterActions}>
          <button type="button" onClick={aplicarHoy} style={todayButton}>
            Hoy
          </button>

          <button type="button" onClick={aplicarMes} style={periodButton}>
            Este mes
          </button>

          <button type="button" onClick={aplicarAno} style={periodButton}>
            Este año
          </button>

          <button
            type="button"
            onClick={() => cargarEstadisticas(desde, hasta)}
            style={applyButton}
          >
            Aplicar filtro
          </button>
        </div>
      </section>

      {cargando ? (
        <div style={loadingBox}>Cargando estadísticas...</div>
      ) : (
        <>
          <section style={statsGrid}>
            <StatCard label="Pedidos" value={formatearNumero(resumen.totalPedidos)} />
            <StatCard label="Cajas" value={formatearNumero(resumen.totalCajas)} />
            <StatCard label="Unidades" value={formatearNumero(resumen.totalUnidades)} />
            <StatCard label="Artículos distintos" value={formatearNumero(resumen.articulosDistintos)} />
            <StatCard label="Departamentos" value={formatearNumero(resumen.departamentosDistintos)} />
          </section>

          {!hayDatos && (
            <section style={emptyPanel}>
              Todavía no hay estadísticas para el periodo seleccionado.
            </section>
          )}

          <section style={gridTwo}>
            <Panel title="Pedidos por día" subtitle={`${formatearFecha(desde)} - ${formatearFecha(hasta)}`}>
              <MiniBarChart
                data={pedidosPorDia.map((fila) => ({
                  label: formatearFecha(fila.fecha),
                  value: Number(fila.total_pedidos || 0),
                }))}
                valueLabel="pedidos"
              />

              <TablaPedidosDia filas={pedidosPorDia} />
            </Panel>

            <Panel title="Pedidos por mes" subtitle="Agrupado dentro del periodo filtrado">
              <MiniBarChart
                data={pedidosPorMes.map((fila) => ({
                  label: nombreMes(fila.mes),
                  value: Number(fila.total_pedidos || 0),
                }))}
                valueLabel="pedidos"
              />

              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Mes</th>
                    <th style={thRight}>Pedidos</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosPorMes.length === 0 ? (
                    <FilaVacia columnas={2} />
                  ) : (
                    pedidosPorMes.map((fila) => (
                      <tr key={fila.mes}>
                        <td style={td}>{nombreMes(fila.mes)}</td>
                        <td style={tdRightStrong}>{formatearNumero(fila.total_pedidos)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
          </section>

          <section style={gridTwo}>
            <Panel title="Departamentos más vendidos" subtitle="Cajas + unidades + veces pedido">
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

            <Panel title="Artículos que más se piden" subtitle="Número de pedidos en los que aparece">
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
    const key = String(fila.articulo_id || fila.codigo_articulo || fila.nombre_articulo || "");
    const actual = mapa.get(key) || {
      articulo_id: fila.articulo_id,
      codigo_articulo: fila.codigo_articulo || "",
      nombre_articulo: fila.nombre_articulo || "Sin nombre",
      departamento: fila.departamento || "",
      cajas: 0,
      unidades: 0,
      veces_pedido: 0,
    };

    actual.cajas += Number(fila.cajas || 0);
    actual.unidades += Number(fila.unidades || 0);
    actual.veces_pedido += Number(fila.veces_pedido || 0);

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
            <div style={chartLabel} title={fila.label}>
              {fila.label}
            </div>

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

function TablaPedidosDia({ filas }) {
  return (
    <table style={table}>
      <thead>
        <tr>
          <th style={th}>Fecha</th>
          <th style={thRight}>Pedidos</th>
        </tr>
      </thead>
      <tbody>
        {filas.length === 0 ? (
          <FilaVacia columnas={2} />
        ) : (
          filas.map((fila) => (
            <tr key={fila.fecha}>
              <td style={td}>{formatearFecha(fila.fecha)}</td>
              <td style={tdRightStrong}>{formatearNumero(fila.total_pedidos)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
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
              <tr key={`${fila.articulo_id}-${fila.codigo_articulo}-${fila.nombre_articulo}`}>
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

const page = {
  minHeight: "100vh",
  padding: "24px",
  background: "linear-gradient(180deg, #eef2ff 0%, #f8fafc 38%, #ffffff 100%)",
  boxSizing: "border-box",
};

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  background: "linear-gradient(135deg, #111827 0%, #1d4ed8 48%, #2563eb 100%)",
  borderRadius: "24px",
  padding: "28px",
  color: "#ffffff",
  boxShadow: "0 22px 45px rgba(37,99,235,0.22)",
  marginBottom: "18px",
};

const eyebrow = {
  display: "inline-block",
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "999px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: "900",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: "12px",
};

const title = {
  margin: 0,
  fontSize: "34px",
  lineHeight: "1",
  fontWeight: "950",
};

const subtitle = {
  margin: "10px 0 0",
  color: "#dbeafe",
  fontSize: "15px",
  maxWidth: "680px",
};

const refreshButton = {
  background: "#22c55e",
  color: "#fff",
  border: "none",
  borderRadius: "16px",
  padding: "15px 22px",
  fontSize: "15px",
  fontWeight: "950",
  cursor: "pointer",
  boxShadow: "0 14px 26px rgba(34,197,94,0.28)",
  whiteSpace: "nowrap",
};

const filtersBox = {
  display: "grid",
  gridTemplateColumns: "180px 180px 1fr",
  gap: "12px",
  alignItems: "end",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "20px",
  padding: "16px",
  marginBottom: "18px",
  boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
};

const label = {
  display: "block",
  fontWeight: "900",
  marginBottom: "7px",
  color: "#334155",
  fontSize: "13px",
};

const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  border: "1px solid #d1d5db",
  borderRadius: "13px",
  fontSize: "14px",
  outline: "none",
  background: "#ffffff",
};

const filterActions = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const todayButton = {
  background: "#22c55e",
  color: "#ffffff",
  border: "none",
  borderRadius: "13px",
  padding: "12px 14px",
  fontWeight: "950",
  cursor: "pointer",
};

const periodButton = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "none",
  borderRadius: "13px",
  padding: "12px 14px",
  fontWeight: "950",
  cursor: "pointer",
};

const applyButton = {
  background: "#111827",
  color: "#ffffff",
  border: "none",
  borderRadius: "13px",
  padding: "12px 14px",
  fontWeight: "950",
  cursor: "pointer",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "12px",
  marginBottom: "18px",
};

const statCard = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "16px",
  boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
};

const statValue = {
  fontSize: "28px",
  fontWeight: "950",
  color: "#111827",
  lineHeight: "1",
};

const statLabel = {
  marginTop: "8px",
  fontSize: "12px",
  fontWeight: "850",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const gridTwo = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "18px",
};

const panel = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "22px",
  padding: "16px",
  boxShadow: "0 14px 35px rgba(15,23,42,0.07)",
  marginBottom: "18px",
};

const panelHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  marginBottom: "14px",
};

const panelTitle = {
  margin: 0,
  color: "#111827",
  fontSize: "20px",
  fontWeight: "950",
};

const panelSubtitle = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "13px",
};

const tableWrap = {
  overflowX: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  background: "#fff",
};

const table = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const th = {
  background: "#f8fafc",
  color: "#475569",
  textAlign: "left",
  padding: "13px 14px",
  fontSize: "12px",
  fontWeight: "950",
  borderBottom: "1px solid #e5e7eb",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const thRight = {
  ...th,
  textAlign: "right",
};

const td = {
  padding: "13px 14px",
  verticalAlign: "middle",
  fontSize: "14px",
  borderBottom: "1px solid #f1f5f9",
};

const tdRight = {
  ...td,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const tdRightStrong = {
  ...tdRight,
  fontWeight: "950",
  color: "#1d4ed8",
};

const emptyCell = {
  textAlign: "center",
  padding: "30px",
  color: "#94a3b8",
  fontWeight: "800",
};

const smallText = {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "12px",
};

const chartBox = {
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "12px",
  marginBottom: "14px",
  background: "#f8fafc",
};

const chartRow = {
  display: "grid",
  gridTemplateColumns: "160px 1fr 90px",
  gap: "10px",
  alignItems: "center",
  marginBottom: "8px",
};

const chartLabel = {
  fontSize: "12px",
  fontWeight: "850",
  color: "#334155",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const chartTrack = {
  height: "11px",
  background: "#e2e8f0",
  borderRadius: "999px",
  overflow: "hidden",
};

const chartBar = {
  height: "100%",
  background: "linear-gradient(90deg, #1d4ed8, #60a5fa)",
  borderRadius: "999px",
};

const chartValue = {
  textAlign: "right",
  fontSize: "11px",
  fontWeight: "950",
  color: "#1e293b",
};

const chartEmpty = {
  border: "1px dashed #cbd5e1",
  borderRadius: "16px",
  padding: "20px",
  color: "#94a3b8",
  fontWeight: "850",
  textAlign: "center",
  marginBottom: "14px",
};

const emptyPanel = {
  background: "#ffffff",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  borderRadius: "18px",
  padding: "22px",
  fontWeight: "900",
  textAlign: "center",
  marginBottom: "18px",
};

const loadingBox = {
  padding: "30px",
  textAlign: "center",
  color: "#64748b",
  fontWeight: "900",
  background: "#ffffff",
  borderRadius: "16px",
};

const errorBox = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  padding: "16px",
  borderRadius: "18px",
  marginBottom: "18px",
};
