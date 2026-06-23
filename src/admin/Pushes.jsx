import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Pushes() {
  const [pushes, setPushes] = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    setError("");

    try {
      const { data: pushesData, error: pushesError } = await supabase
        .from("push_ofertas")
        .select("*")
        .order("fecha_inicio", { ascending: true });

      if (pushesError) throw pushesError;

      const { data: calendarioData, error: calendarioError } = await supabase
        .from("push_calendario")
        .select("*")
        .order("fecha", { ascending: true });

      if (calendarioError) throw calendarioError;

      setPushes(pushesData || []);
      setCalendario(calendarioData || []);
    } catch (err) {
      console.error("Error cargando Push Diario:", err);
      setError(err?.message || JSON.stringify(err));
    } finally {
      setCargando(false);
    }
  }

  const calendarioConPush = useMemo(() => {
    return calendario.map((dia) => {
      const push = pushes.find((p) => p.id === dia.push_id);

      return {
        ...dia,
        push,
      };
    });
  }, [calendario, pushes]);

  const totalPushes = pushes.length;
  const totalDias = calendario.length;
  const totalActivos = pushes.filter((p) => p.activo).length;

  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Administración</div>
          <h1 style={title}>Push Diario</h1>
          <p style={subtitle}>
            Calendario de artículos push. Solo debe haber un push por día.
          </p>
        </div>

        <button type="button" onClick={cargarDatos} style={newButton}>
          Actualizar
        </button>
      </section>

      <section style={statsGrid}>
        <StatCard label="Pushes creados" value={totalPushes} />
        <StatCard label="Pushes activos" value={totalActivos} />
        <StatCard label="Días calendario" value={totalDias} />
      </section>

      {error && (
        <section style={errorBox}>
          <strong>Error cargando Push Diario</strong>
          <p>{error}</p>
        </section>
      )}

      {cargando ? (
        <div style={loadingBox}>Cargando push...</div>
      ) : (
        <>
          <section style={tableShell}>
            <div style={tableHeader}>
              <div>
                <h2 style={tableTitle}>Calendario Push</h2>
                <p style={tableSubtitle}>
                  Estos son los días realmente programados en push_calendario.
                </p>
              </div>
            </div>

            <div style={tableCard}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Fecha</th>
                    <th style={th}>Título</th>
                    <th style={th}>Artículo</th>
                    <th style={th}>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {calendarioConPush.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={emptyCell}>
                        No hay días programados en push_calendario
                      </td>
                    </tr>
                  ) : (
                    calendarioConPush.map((dia) => (
                      <tr key={dia.id}>
                        <td style={td}>{formatearFecha(dia.fecha)}</td>
                        <td style={td}>
                          <strong>{dia.push?.titulo || "Push no encontrado"}</strong>
                        </td>
                        <td style={td}>
                          {dia.push?.nombre_articulo || "Sin artículo"}
                          <div style={smallText}>
                            Código: {dia.push?.codigo_articulo || "-"}
                          </div>
                        </td>
                        <td style={td}>
                          {dia.push?.activo ? (
                            <span style={activeBadge}>Activo</span>
                          ) : (
                            <span style={inactiveBadge}>Inactivo</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={tableShell}>
            <div style={tableHeader}>
              <div>
                <h2 style={tableTitle}>Pushes creados</h2>
                <p style={tableSubtitle}>
                  Estos son los registros existentes en push_ofertas.
                </p>
              </div>
            </div>

            <div style={tableCard}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Título</th>
                    <th style={th}>Artículo</th>
                    <th style={th}>Inicio</th>
                    <th style={th}>Fin</th>
                    <th style={th}>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {pushes.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={emptyCell}>
                        No hay registros en push_ofertas
                      </td>
                    </tr>
                  ) : (
                    pushes.map((push) => (
                      <tr key={push.id}>
                        <td style={td}>
                          <strong>{push.titulo || "Sin título"}</strong>
                          <div style={smallText}>{push.descripcion || push.texto || ""}</div>
                        </td>
                        <td style={td}>
                          {push.nombre_articulo || "Sin artículo"}
                          <div style={smallText}>Código: {push.codigo_articulo || "-"}</div>
                        </td>
                        <td style={td}>{push.fecha_inicio || "—"}</td>
                        <td style={td}>{push.fecha_fin || "—"}</td>
                        <td style={td}>
                          {push.activo ? (
                            <span style={activeBadge}>Activo</span>
                          ) : (
                            <span style={inactiveBadge}>Inactivo</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
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

function formatearFecha(fechaISO) {
  if (!fechaISO) return "—";

  const [year, month, day] = fechaISO.split("-").map(Number);
  const fecha = new Date(year, month - 1, day);

  return fecha.toLocaleDateString("es-ES");
}

const page = {
  minHeight: "100vh",
  padding: "24px",
  background:
    "linear-gradient(180deg, #eef2ff 0%, #f8fafc 38%, #ffffff 100%)",
  boxSizing: "border-box",
};

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  background: "linear-gradient(135deg, #111827 0%, #7c2d12 48%, #ea580c 100%)",
  borderRadius: "24px",
  padding: "28px",
  color: "#ffffff",
  boxShadow: "0 22px 45px rgba(234,88,12,0.22)",
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
  color: "#ffedd5",
  fontSize: "15px",
  maxWidth: "680px",
};

const newButton = {
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

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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

const errorBox = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  padding: "16px",
  borderRadius: "18px",
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

const tableShell = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "22px",
  padding: "16px",
  boxShadow: "0 14px 35px rgba(15,23,42,0.07)",
  marginBottom: "18px",
};

const tableHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  marginBottom: "14px",
};

const tableTitle = {
  margin: 0,
  color: "#111827",
  fontSize: "20px",
  fontWeight: "950",
};

const tableSubtitle = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "13px",
};

const tableCard = {
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
};

const td = {
  padding: "13px 14px",
  verticalAlign: "middle",
  fontSize: "14px",
  borderBottom: "1px solid #f1f5f9",
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

const activeBadge = {
  background: "#dcfce7",
  color: "#166534",
  padding: "6px 10px",
  borderRadius: "999px",
  fontWeight: "950",
  fontSize: "12px",
};

const inactiveBadge = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: "6px 10px",
  borderRadius: "999px",
  fontWeight: "950",
  fontSize: "12px",
};
