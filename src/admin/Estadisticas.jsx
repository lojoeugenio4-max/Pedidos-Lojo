import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function fechaISOHoy() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inicioMesISO() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function inicioAnoISO() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-01-01`;
}

function formatearNumero(valor) {
  return Number(valor || 0).toLocaleString("es-ES", {
    maximumFractionDigits: 2,
  });
}

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const [year, month, day] = String(fecha).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-ES");
}

function obtenerMes(fecha) {
  if (!fecha) return "";
  return String(fecha).slice(0, 7);
}

export default function Estadisticas() {
  const [pedidosDia, setPedidosDia] = useState([]);
  const [articulosDia, setArticulosDia] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtroDesde, setFiltroDesde] = useState(inicioMesISO());
  const [filtroHasta, setFiltroHasta] = useState(fechaISOHoy());

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  async function cargarEstadisticas() {
    setCargando(true);
    setError("");

    try {
      const { data: pedidosData, error: pedidosError } = await supabase
        .from("estadisticas_pedidos_dia")
        .select("*")
        .order("fecha", { ascending: false });

      if (pedidosError) throw pedidosError;

      const { data: articulosData, error: articulosError } = await supabase
        .from("estadisticas_articulos_dia")
        .select("*")
        .order("fecha", { ascending: false });

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

  const pedidosFiltrados = useMemo(() => {
    return pedidosDia.filter((fila) => {
      if (filtroDesde && fila.fecha < filtroDesde) return false;
      if (filtroHasta && fila.fecha > filtroHasta) return false;
      return true;
    });
  }, [pedidosDia, filtroDesde, filtroHasta]);

  const articulosFiltrados = useMemo(() => {
    return articulosDia.filter((fila) => {
      if (filtroDesde && fila.fecha < filtroDesde) return false;
      if (filtroHasta && fila.fecha > filtroHasta) return false;
      return true;
    });
  }, [articulosDia, filtroDesde, filtroHasta]);

  const resumen = useMemo(() => {
    const hoy = fechaISOHoy();
    const inicioMes = inicioMesISO();
    const inicioAno = inicioAnoISO();

    const pedidosHoy = pedidosDia
      .filter((fila) => fila.fecha === hoy)
      .reduce((total, fila) => total + Number(fila.total_pedidos || 0), 0);

    const pedidosMes = pedidosDia
      .filter((fila) => fila.fecha >= inicioMes)
      .reduce((total, fila) => total + Number(fila.total_pedidos || 0), 0);

    const pedidosAno = pedidosDia
      .filter((fila) => fila.fecha >= inicioAno)
      .reduce((total, fila) => total + Number(fila.total_pedidos || 0), 0);

    const cajasMes = articulosDia
      .filter((fila) => fila.fecha >= inicioMes)
      .reduce((total, fila) => total + Number(fila.cajas || 0), 0);

    const unidadesMes = articulosDia
      .filter((fila) => fila.fecha >= inicioMes)
      .reduce((total, fila) => total + Number(fila.unidades || 0), 0);

    return {
      pedidosHoy,
      pedidosMes,
      pedidosAno,
      cajasMes,
      unidadesMes,
    };
  }, [pedidosDia, articulosDia]);

  const pedidosPorMes = useMemo(() => {
    const mapa = new Map();

    pedidosDia.forEach((fila) => {
      const mes = obtenerMes(fila.fecha);
      mapa.set(mes, (mapa.get(mes) || 0) + Number(fila.total_pedidos || 0));
    });

    return Array.from(mapa.entries())
      .map(([mes, total]) => ({ mes, total }))
      .sort((a, b) => b.mes.localeCompare(a.mes))
      .slice(0, 12);
  }, [pedidosDia]);

  const topCajas = useMemo(() => {
    return agruparArticulos(articulosFiltrados, "cajas").slice(0, 20);
  }, [articulosFiltrados]);

  const topUnidades = useMemo(() => {
    return agruparArticulos(articulosFiltrados, "unidades").slice(0, 20);
  }, [articulosFiltrados]);

  const topMasPedidos = useMemo(() => {
    return agruparArticulos(articulosFiltrados, "veces_pedido").slice(0, 20);
  }, [articulosFiltrados]);

  const departamentos = useMemo(() => {
    const mapa = new Map();

    articulosFiltrados.forEach((fila) => {
      const nombre = fila.departamento || "Sin departamento";
      const actual = mapa.get(nombre) || {
        departamento: nombre,
        cajas: 0,
        unidades: 0,
        veces_pedido: 0,
      };

      actual.cajas += Number(fila.cajas || 0);
      actual.unidades += Number(fila.unidades || 0);
      actual.veces_pedido += Number(fila.veces_pedido || 0);

      mapa.set(nombre, actual);
    });

    return Array.from(mapa.values()).sort(
      (a, b) =>
        b.cajas + b.unidades + b.veces_pedido -
        (a.cajas + a.unidades + a.veces_pedido)
    );
  }, [articulosFiltrados]);

  const totalPedidosFiltrados = pedidosFiltrados.reduce(
    (total, fila) => total + Number(fila.total_pedidos || 0),
    0
  );

  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Administración</div>
          <h1 style={title}>📊 Estadísticas</h1>
          <p style={subtitle}>
            Resumen de pedidos enviados por WhatsApp, artículos vendidos y departamentos.
          </p>
        </div>

        <button type="button" onClick={cargarEstadisticas} style={refreshButton}>
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
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
            style={input}
          />
        </div>

        <div>
          <label style={label}>Hasta</label>
          <input
            type="date"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            style={input}
          />
        </div>

        <div style={filterActions}>
          <button
            type="button"
            onClick={() => {
              setFiltroDesde(inicioMesISO());
              setFiltroHasta(fechaISOHoy());
            }}
            style={periodButton}
          >
            Este mes
          </button>

          <button
            type="button"
            onClick={() => {
              setFiltroDesde(inicioAnoISO());
              setFiltroHasta(fechaISOHoy());
            }}
            style={periodButton}
          >
            Este año
          </button>
        </div>
      </section>

      {cargando ? (
        <div style={loadingBox}>Cargando estadísticas...</div>
      ) : (
        <>
          <section style={statsGrid}>
            <StatCard label="Pedidos hoy" value={resumen.pedidosHoy} />
            <StatCard label="Pedidos este mes" value={resumen.pedidosMes} />
            <StatCard label="Pedidos este año" value={resumen.pedidosAno} />
            <StatCard label="Pedidos filtrados" value={totalPedidosFiltrados} />
            <StatCard label="Cajas mes" value={formatearNumero(resumen.cajasMes)} />
            <StatCard label="Unidades mes" value={formatearNumero(resumen.unidadesMes)} />
          </section>

          <section style={gridTwo}>
            <Panel title="Pedidos por mes" subtitle="Últimos 12 meses">
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
                        <td style={td}>{fila.mes}</td>
                        <td style={tdRight}>{formatearNumero(fila.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>

            <Panel title="Departamentos más vendidos" subtitle="Según el periodo filtrado">
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Departamento</th>
                    <th style={thRight}>Cajas</th>
                    <th style={thRight}>Unid.</th>
                  </tr>
                </thead>
                <tbody>
                  {departamentos.length === 0 ? (
                    <FilaVacia columnas={3} />
                  ) : (
                    departamentos.slice(0, 15).map((fila) => (
                      <tr key={fila.departamento}>
                        <td style={td}>{fila.departamento}</td>
                        <td style={tdRight}>{formatearNumero(fila.cajas)}</td>
                        <td style={tdRight}>{formatearNumero(fila.unidades)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
          </section>

          <Panel title="Artículos más vendidos por cajas" subtitle="Según el periodo filtrado">
            <TablaArticulos filas={topCajas} campo="cajas" etiqueta="Cajas" />
          </Panel>

          <Panel title="Artículos más vendidos por unidades" subtitle="Según el periodo filtrado">
            <TablaArticulos filas={topUnidades} campo="unidades" etiqueta="Unidades" />
          </Panel>

          <Panel title="Artículos que más aparecen en pedidos" subtitle="Cuenta veces_pedido, no cantidad">
            <TablaArticulos filas={topMasPedidos} campo="veces_pedido" etiqueta="Veces" />
          </Panel>
        </>
      )}
    </div>
  );
}

function agruparArticulos(filas, campoOrden) {
  const mapa = new Map();

  filas.forEach((fila) => {
    const key = fila.articulo_id || fila.codigo_articulo || fila.nombre_articulo;
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

  return Array.from(mapa.values()).sort(
    (a, b) => Number(b[campoOrden] || 0) - Number(a[campoOrden] || 0)
  );
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

      <div style={tableWrap}>{children}</div>
    </section>
  );
}

function TablaArticulos({ filas, campo, etiqueta }) {
  return (
    <table style={table}>
      <thead>
        <tr>
          <th style={th}>Artículo</th>
          <th style={th}>Departamento</th>
          <th style={thRight}>{etiqueta}</th>
          <th style={thRight}>Cajas</th>
          <th style={thRight}>Unid.</th>
        </tr>
      </thead>
      <tbody>
        {filas.length === 0 ? (
          <FilaVacia columnas={5} />
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
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function FilaVacia({ columnas }) {
  return (
    <tr>
      <td colSpan={columnas} style={emptyCell}>
        Sin datos todavía
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
  gridTemplateColumns: "180px 180px auto",
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

const periodButton = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "none",
  borderRadius: "13px",
  padding: "12px 14px",
  fontWeight: "950",
  cursor: "pointer",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
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
